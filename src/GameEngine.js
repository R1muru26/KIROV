// ── GameEngine.js ─────────────────────────────────────────────────────────
// Main game loop, state machine, and rendering coordinator.
// Follows game-coding-standards.md architecture patterns and
// flappy-kiro-domain.md state machine specifications.
//
// In the single-file build this lives in the same <script> scope as all other
// subsystems. The module.exports at the bottom enables unit testing only.

// ── Pre-declared working variables (no per-frame allocation) ───────────────
let _shakeDx    = 0;   // screen shake x offset, recomputed each frame
let _shakeDy    = 0;   // screen shake y offset
let _hitCx      = 0;   // ghosty circle hitbox center x (reused each frame)
let _hitCy      = 0;   // ghosty circle hitbox center y
let _hitR       = 0;   // ghosty circle hitbox radius
let _skyGradient = null; // cached CanvasGradient — recreated only on theme change

// ── Constants ──────────────────────────────────────────────────────────────
const FRAME_MS          = 1000 / 60;  // ≈16.67ms — assumed frame duration for timers
const SCORE_BAR_H       = 40;         // px — score bar height (ground boundary)
const SHAKE_DURATION    = 300;        // ms
const SHAKE_MAX         = 8;          // px max displacement
const INV_DURATION      = 500;        // ms invincibility grace period
const INV_FLASH_CYCLE   = 100;        // ms per visible/invisible toggle

// ── GameState ──────────────────────────────────────────────────────────────
// Single source of truth for all mutable game state.
// Never create a new object here — mutate fields in place.
const gameState = {
  phase:               'IDLE',   // 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'
  score:               0,
  highScore:           0,
  sfxEnabled:          true,     // loaded from localStorage on init
  isInvincible:        false,
  invincibilityStart:  null,     // timestamp ms
  shaking:             false,
  shakeStart:          null,     // timestamp ms
  isNewBest:           false,    // set true on GAME_OVER if score beats highScore
  themeTransition: {
    active:    false,
    fromIdx:   0,
    toIdx:     0,
    startMs:   0,
    progress:  1.0,             // 0.0 = start, 1.0 = settled
  },
};

// ── GameEngine ─────────────────────────────────────────────────────────────
const GameEngine = {
  canvas:   null,
  ctx:      null,
  ghosty:   null,   // set by init()
  pauseStartMs: 0,  // timestamp when PAUSED state was entered

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Bootstrap the engine. Call once after the DOM is ready.
   * @param {HTMLCanvasElement} canvas
   * @param {object} ghosty    - from createGhosty()
   * @param {object} options   - { highScore, sfxEnabled }
   */
  init(canvas, ghosty, options) {
    this.canvas           = canvas;
    this.ctx              = canvas.getContext('2d');
    this.ghosty           = ghosty;
    gameState.highScore   = options.highScore  || 0;
    gameState.sfxEnabled  = options.sfxEnabled !== false;
    gameState.phase       = 'IDLE';

    // Initialise subsystems that need canvas dimensions
    ParallaxSystem.init(canvas.width, canvas.height);
    BackgroundSystem.reset();
    AnimationSystem.reset();
    ScoreManager.init();

    // Register all inputs once
    InputHandler.init(canvas, {
      onFlap:        () => this._handleFlap(),
      onPause:       () => this._handlePause(),
      onSoundToggle: () => this._toggleSfx(),
      onUpload:      () => CharacterCustomizer.openPicker(),
    });

    requestAnimationFrame((ts) => this._tick(ts));
  },

  // ── Game loop ──────────────────────────────────────────────────────────────

  /**
   * Main loop tick. Dispatches to update and render based on current phase.
   * Always re-queues itself — never skips requestAnimationFrame.
   * @param {number} timestamp - DOMHighResTimeStamp from rAF
   */
  _tick(timestamp) {
    const phase = gameState.phase;

    // ── 1. Update (PLAYING only) ──────────────────────────────────────────
    if (phase === 'PLAYING') {
      PhysicsEngine.update(this.ghosty);
      Scroller.update(gameState.score, this.canvas.width, this.canvas.height);
      ParticleSystem.emit(this.ghosty.x, this.ghosty.y + this.ghosty.height / 2, 3);
      ParticleSystem.update(FRAME_MS);
      AnimationSystem.update(FRAME_MS);
      HUD.updatePopups(FRAME_MS);
      this._updateInvincibility(timestamp);
      this._checkCollision(timestamp);
      checkScoring(this.ghosty, gameState, (newScore) => {
        AudioManager.score();
        HUD.spawnPopup(
          this.ghosty.x + this.ghosty.width  / 2,
          this.ghosty.y + this.ghosty.height / 2
        );
        // Speed recalculated inside Scroller.update() next frame
      });
      this._updateScreenShake(timestamp);
    }

    // ── 2. Background update (all non-paused states) ──────────────────────
    if (phase !== 'PAUSED') {
      BackgroundSystem.update(gameState.score, FRAME_MS);
      ThemeToast.update(FRAME_MS);
      ParallaxSystem.update();
    }

    // ── 3. Render (always) ────────────────────────────────────────────────
    this._render(timestamp);

    requestAnimationFrame((ts) => this._tick(ts));
  },

  // ── State transitions ─────────────────────────────────────────────────────

  _handleFlap() {
    const phase = gameState.phase;
    if (phase === 'IDLE') {
      this._startGame();
    } else if (phase === 'PLAYING') {
      PhysicsEngine.flap(this.ghosty);
      AnimationSystem.triggerFlap();
      AudioManager.flap();
    } else if (phase === 'GAME_OVER') {
      this._startGame();
    }
    // PAUSED: no-op (domain rule 11.6)
  },

  _handlePause() {
    if (gameState.phase === 'PLAYING') {
      this.pauseStartMs   = performance.now();
      gameState.phase     = 'PAUSED';
      AudioManager.pauseMusic();
    } else if (gameState.phase === 'PAUSED') {
      const pauseDuration = performance.now() - this.pauseStartMs;
      // Offset timestamp-based timers so they don't advance during pause
      if (gameState.invincibilityStart !== null) gameState.invincibilityStart += pauseDuration;
      if (gameState.shakeStart         !== null) gameState.shakeStart         += pauseDuration;
      gameState.phase = 'PLAYING';
      AudioManager.resumeMusic();
    }
    // IDLE | GAME_OVER: no-op (domain rule 11.8)
  },

  _toggleSfx() {
    gameState.sfxEnabled = !gameState.sfxEnabled;
    ScoreManager.saveSfxPref(gameState.sfxEnabled);
  },

  _startGame() {
    this._resetSession();
    gameState.phase = 'PLAYING';
    AudioManager.startMusic();
  },

  _onGameOver(timestamp) {
    gameState.phase = 'GAME_OVER';
    gameState.isNewBest = ScoreManager.onGameOver();
    gameState.highScore = ScoreManager.highScore;
    AnimationSystem.triggerDeath();
    this.ghosty.tilt = 0;  // no rotation on death frame
    ParticleSystem.clear();
    AudioManager.stopMusic();
    AudioManager.gameOver();
    // Screen shake was already triggered at collision detection
  },

  // ── Session management ────────────────────────────────────────────────────

  _resetSession() {
    ScoreManager.reset();
    gameState.score              = 0;
    gameState.isInvincible       = false;
    gameState.invincibilityStart = null;
    gameState.shaking            = false;
    gameState.shakeStart         = null;
    gameState.isNewBest          = false;
    this.ghosty.y                = this.canvas.height / 2 - this.ghosty.height / 2;
    this.ghosty.vy               = 0;
    this.ghosty.visible          = true;
    this.ghosty.tilt             = 0;
    Scroller.reset();
    ParticleSystem.clear();
    HUD.clearPopups();
    AnimationSystem.reset();
    BackgroundSystem.reset();
  },

  // ── Collision & invincibility ──────────────────────────────────────────────

  _checkCollision(timestamp) {
    if (gameState.isInvincible) return;  // already in grace period
    const groundY = this.canvas.height - SCORE_BAR_H;
    const hit = CollisionDetector.check(
      this.ghosty, pipePool, groundY, this.canvas.height
    );
    if (!hit) return;

    // Begin invincibility grace period
    gameState.isInvincible       = true;
    gameState.invincibilityStart = timestamp;
    gameState.shaking            = true;
    gameState.shakeStart         = timestamp;
  },

  _updateInvincibility(timestamp) {
    if (!gameState.isInvincible) return;
    const elapsed = timestamp - gameState.invincibilityStart;

    // Flash: toggle visible every INV_FLASH_CYCLE ms
    this.ghosty.visible = (Math.floor(elapsed / INV_FLASH_CYCLE) % 2 === 0);

    if (elapsed >= INV_DURATION) {
      // Grace period over — check if still colliding
      const groundY = this.canvas.height - SCORE_BAR_H;
      const stillHit = CollisionDetector.check(
        this.ghosty, pipePool, groundY, this.canvas.height
      );
      if (stillHit) {
        gameState.isInvincible = false;
        this.ghosty.visible    = true;
        this._onGameOver(timestamp);
      } else {
        // Cleared — resume normal play
        gameState.isInvincible = false;
        this.ghosty.visible    = true;
      }
    }
  },

  // ── Screen shake ──────────────────────────────────────────────────────────

  _updateScreenShake(timestamp) {
    if (!gameState.shaking) return;
    const elapsed = timestamp - gameState.shakeStart;
    if (elapsed >= SHAKE_DURATION) {
      gameState.shaking = false;
      _shakeDx = 0;
      _shakeDy = 0;
    }
  },

  // ── Render ────────────────────────────────────────────────────────────────

  /**
   * Full frame render. Order matches visual-design.md draw order spec.
   * @param {number} timestamp
   */
  _render(timestamp) {
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const phase = gameState.phase;

    // Clear canvas (first operation every frame — Property 30)
    ctx.clearRect(0, 0, W, H);

    // ── World layer (inside screen shake) ─────────────────────────────────
    ctx.save();
    if (gameState.shaking && gameState.shakeStart !== null) {
      const elapsed = timestamp - gameState.shakeStart;
      const factor  = Math.max(0, 1 - elapsed / SHAKE_DURATION);
      _shakeDx = (Math.random() * 2 - 1) * SHAKE_MAX * factor;
      _shakeDy = (Math.random() * 2 - 1) * SHAKE_MAX * factor;
      ctx.translate(_shakeDx, _shakeDy);
    }

    // 1. Background sky gradient
    BackgroundSystem.draw(ctx, gameState.score, W, H);

    // 2. Parallax clouds
    ParallaxSystem.draw(ctx);

    // 3. Pipes (only in PLAYING or GAME_OVER — not in IDLE)
    if (phase !== 'IDLE') {
      drawPipes(ctx, H, BackgroundSystem.currentThemeName());
    }

    // 4. Ghosty (suppressed during invincibility flash via ghosty.visible)
    drawGhosty(ctx, this.ghosty, phase);

    // 5. Particle trail
    ParticleSystem.draw(ctx);

    ctx.restore();
    // ── End world layer ───────────────────────────────────────────────────

    // 6. Score bar (outside shake — never shifts)
    ScoreManager.drawScoreBar(ctx, W, H, SCORE_BAR_H, Scroller.currentSpeed);

    // 7. Score popups
    HUD.drawPopups(ctx);

    // 8. Theme toast
    ThemeToast.draw(ctx, W);

    // 9. Phase overlay
    if (phase === 'IDLE') {
      HUD.drawStartOverlay(ctx, W, H, gameState.highScore, gameState.sfxEnabled, this.ghosty);
    } else if (phase === 'PAUSED') {
      HUD.drawPauseOverlay(ctx, W, H, gameState.score, gameState.highScore);
    } else if (phase === 'GAME_OVER') {
      HUD.drawGameOverOverlay(ctx, W, H, gameState.score, gameState.highScore, gameState.isNewBest);
    }
  },
};

// ── Exports ────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { GameEngine, gameState, FRAME_MS, SCORE_BAR_H };
}
