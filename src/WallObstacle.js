// ── WallObstacle.js ───────────────────────────────────────────────────────
// Pipe-pair obstacle: object pool, spawning, movement, and rendering.
// Follows game-coding-standards.md: pool pattern, no per-frame allocations,
// fillStyle batching, all constants named.

// ── Constants (mirrored from main constants block) ─────────────────────────
const PIPE_POOL_SIZE    = 10;    // fixed pool — no runtime allocation
const PIPE_WIDTH        = 60;    // pipe body width, px
const PIPE_GAP          = 150;   // vertical gap height, px
const PIPE_MARGIN_TOP   = 50;    // min px from canvas top to gap top
const PIPE_MARGIN_BOT   = 50;    // min px from score bar to gap bottom
const PIPE_CAP_H        = 10;    // pipe cap/rim height, px
const PIPE_CAP_OVERHANG = 4;     // cap extends this many px beyond pipe body on each side
const SPAWN_INTERVAL    = 150;   // px scrolled between spawns
const BASELINE_SPEED    = 2;     // px/frame — starting scroll speed
const SPEED_CAP         = 6;     // px/frame — max scroll speed
const SPEED_STEP        = 0.2;   // speed increment per SPEED_SCORE_STEP points
const SPEED_SCORE_STEP  = 5;     // score interval for speed step
const SCORE_BAR_H       = 40;    // score bar height (ground boundary), px

// Theme-aware pipe colors — keyed to BackgroundTheme label
const PIPE_THEMES = {
  'Day':    { body: '#4caf50', cap: '#388e3c' },
  'Sunset': { body: '#8B4513', cap: '#6B3410' },
  'Night':  { body: '#2E4057', cap: '#1A2A3A' },
  'Dawn':   { body: '#7B2D8B', cap: '#5A1F6A' },
  'Storm':  { body: '#1B6CA8', cap: '#145280' },
};

// ── Pipe pool ──────────────────────────────────────────────────────────────
// Pre-allocated at startup. Entries are reused; never new'd during gameplay.
const pipePool = [];
for (let i = 0; i < PIPE_POOL_SIZE; i++) {
  pipePool.push({
    active:     false,
    x:          0,
    width:      PIPE_WIDTH,
    gapTop:     0,    // y of top of gap (= bottom of top pipe)
    gapBottom:  0,    // y of bottom of gap (= top of bottom pipe)
    scored:     false,
  });
}

// ── Pool helpers ───────────────────────────────────────────────────────────
/** Find first inactive slot in pipePool. Returns null if pool is exhausted. */
function acquirePipe() {
  for (let i = 0; i < PIPE_POOL_SIZE; i++) {
    if (!pipePool[i].active) return pipePool[i];
  }
  console.warn('Pool exhausted: pipes');
  return null;
}

/** Mark a pipe as inactive — returns it to the pool without array mutation. */
function releasePipe(pipe) {
  pipe.active = false;
}

// ── Scroller ───────────────────────────────────────────────────────────────
// Manages spawning cadence, movement, and speed calculation.
const Scroller = {
  currentSpeed:      BASELINE_SPEED,
  distanceScrolled:  0,

  /**
   * Pure speed formula — no side effects.
   * @param {number} score
   * @returns {number} px/frame
   */
  getSpeed(score) {
    return Math.min(
      BASELINE_SPEED + Math.floor(score / SPEED_SCORE_STEP) * SPEED_STEP,
      SPEED_CAP
    );
  },

  /**
   * Advance all active pipes by currentSpeed, spawn new ones as needed,
   * release off-screen pipes back to pool.
   * @param {number} score  - used to recalculate speed same frame as score change
   * @param {number} canvasW
   * @param {number} canvasH
   */
  update(score, canvasW, canvasH) {
    // Recalculate speed on every update — applied same frame as score changes
    this.currentSpeed = this.getSpeed(score);

    // Advance all active pipes
    for (let i = 0; i < PIPE_POOL_SIZE; i++) {
      const p = pipePool[i];
      if (!p.active) continue;
      p.x -= this.currentSpeed;
      if (p.x + p.width < 0) releasePipe(p);  // off-screen: return to pool
    }

    // Spawn cadence: subtract, don't reset, to preserve sub-interval remainder
    this.distanceScrolled += this.currentSpeed;
    while (this.distanceScrolled >= SPAWN_INTERVAL) {
      this.distanceScrolled -= SPAWN_INTERVAL;
      _spawnPipe(canvasW, canvasH);
    }
  },

  /** Reset to initial state. Called by resetSession(). */
  reset() {
    this.currentSpeed     = BASELINE_SPEED;
    this.distanceScrolled = 0;
    for (let i = 0; i < PIPE_POOL_SIZE; i++) pipePool[i].active = false;
  },
};

// ── Spawn helper ───────────────────────────────────────────────────────────
/**
 * Initialise one pipe from the pool at the right edge of the canvas.
 * Gap position is uniformly random within the safe zone.
 * @param {number} canvasW
 * @param {number} canvasH
 */
function _spawnPipe(canvasW, canvasH) {
  const pipe = acquirePipe();
  if (!pipe) return;

  const minGapTop = PIPE_MARGIN_TOP;
  const maxGapTop = canvasH - SCORE_BAR_H - PIPE_MARGIN_BOT - PIPE_GAP;
  const gapTop    = minGapTop + Math.random() * (maxGapTop - minGapTop);

  pipe.active    = true;
  pipe.x         = canvasW;
  pipe.width     = PIPE_WIDTH;
  pipe.gapTop    = gapTop;
  pipe.gapBottom = gapTop + PIPE_GAP;
  pipe.scored    = false;
}

// ── Pipe rendering ─────────────────────────────────────────────────────────
/**
 * Draw all active pipes. Uses fillStyle batching:
 * all bodies in one fillStyle pass, all caps in a second pass.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasH
 * @param {string} themeName - current BackgroundTheme label (e.g. 'Day')
 */
function drawPipes(ctx, canvasH, themeName) {
  const colors = PIPE_THEMES[themeName] || PIPE_THEMES['Day'];

  // Pass 1: pipe bodies (one fillStyle assignment for all)
  ctx.fillStyle = colors.body;
  for (let i = 0; i < PIPE_POOL_SIZE; i++) {
    const p = pipePool[i];
    if (!p.active) continue;
    ctx.fillRect(p.x, 0,          p.width, p.gapTop);                    // top pipe body
    ctx.fillRect(p.x, p.gapBottom, p.width, canvasH - p.gapBottom);      // bottom pipe body
  }

  // Pass 2: pipe caps (one fillStyle assignment for all)
  ctx.fillStyle = colors.cap;
  for (let i = 0; i < PIPE_POOL_SIZE; i++) {
    const p = pipePool[i];
    if (!p.active) continue;
    const capX = p.x - PIPE_CAP_OVERHANG;
    const capW = p.width + PIPE_CAP_OVERHANG * 2;
    ctx.fillRect(capX, p.gapTop - PIPE_CAP_H, capW, PIPE_CAP_H);         // top cap (at opening)
    ctx.fillRect(capX, p.gapBottom,            capW, PIPE_CAP_H);         // bottom cap (at opening)
  }
}

// ── Scoring check ──────────────────────────────────────────────────────────
/**
 * Check whether Ghosty's hitbox center has crossed each pipe's left edge.
 * Increments score exactly once per pipe (guarded by pipe.scored flag).
 * Calls the provided callbacks on score and speed update.
 *
 * @param {object} ghosty       - needs .x, .width (center derived here)
 * @param {object} gameState    - mutated: score, updated via onScore callback
 * @param {function} onScore    - called with (newScore) when a pipe is passed
 */
function checkScoring(ghosty, gameState, onScore) {
  const ghostyCx = ghosty.x + ghosty.width / 2;
  for (let i = 0; i < PIPE_POOL_SIZE; i++) {
    const p = pipePool[i];
    if (!p.active || p.scored) continue;
    if (ghostyCx >= p.x) {
      p.scored = true;
      gameState.score++;
      onScore(gameState.score);
    }
  }
}

// ── Exports ────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = {
    pipePool,
    acquirePipe,
    releasePipe,
    Scroller,
    drawPipes,
    checkScoring,
    PIPE_POOL_SIZE,
    PIPE_WIDTH,
    PIPE_GAP,
    PIPE_MARGIN_TOP,
    PIPE_MARGIN_BOT,
    SPAWN_INTERVAL,
    BASELINE_SPEED,
    SPEED_CAP,
    PIPE_THEMES,
  };
}
