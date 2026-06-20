// ── ScoreManager.js ───────────────────────────────────────────────────────
// Point tracking, high score persistence, and display formatting.
// Follows game-coding-standards.md and flappy-kiro-domain.md.
// All localStorage operations are wrapped in try/catch (private-browsing safe).

// ── Constants ──────────────────────────────────────────────────────────────
const HS_KEY  = 'flappyKiroHighScore';  // localStorage key for high score
const SFX_KEY = 'flappyKiroSfx';       // localStorage key for sfx preference

// ── ScoreManager ───────────────────────────────────────────────────────────
const ScoreManager = {
  score:      0,    // current session score
  highScore:  0,    // all-time best, loaded from localStorage on init

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Load persisted high score at page start.
   * Call once before the first render frame.
   */
  init() {
    this.highScore = this._loadHighScore();
    this.score     = 0;
  },

  /**
   * Reset session score to 0. Does NOT change highScore.
   * Called by resetSession() at the start of every game.
   */
  reset() {
    this.score = 0;
  },

  // ── Score updates ─────────────────────────────────────────────────────────

  /**
   * Increment score by 1. Called when Ghosty passes a pipe.
   * @returns {number} new score
   */
  increment() {
    this.score++;
    return this.score;
  },

  /**
   * Called on GAME_OVER transition. Updates and persists high score if beaten.
   * High score is NEVER decreased.
   * @returns {boolean} true if a new high score was set
   */
  onGameOver() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHighScore(this.highScore);
      return true;  // new record
    }
    return false;
  },

  // ── Display formatting ────────────────────────────────────────────────────

  /**
   * @returns {string} e.g. "Score: 7"
   */
  formatScore() {
    return 'Score: ' + this.score;
  },

  /**
   * @returns {string} e.g. "High: 42"
   */
  formatHigh() {
    return 'High: ' + this.highScore;
  },

  /**
   * Format scroll speed for Score Bar display.
   * @param {number} speed - current scroll speed in px/frame
   * @returns {string} e.g. "Speed: 2.4"
   */
  formatSpeed(speed) {
    return 'Speed: ' + speed.toFixed(1);
  },

  /**
   * @returns {string} e.g. "Best: 42"  (used on start screen)
   */
  formatBest() {
    return 'Best: ' + this.highScore;
  },

  // ── Score Bar renderer ────────────────────────────────────────────────────

  /**
   * Draw the Score Bar at the bottom of the canvas.
   * Layout: Score (left) | Speed (center, yellow) | High (right).
   * Always drawn outside the screen-shake save/restore — UI chrome never shifts.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} barH    - score bar height (SCORE_BAR_H constant)
   * @param {number} speed   - current scroll speed
   */
  drawScoreBar(ctx, canvasW, canvasH, barH, speed) {
    const barY = canvasH - barH;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, barY, canvasW, barH);

    const textY = canvasH - 12;  // text baseline within the bar
    ctx.font = '14px "Press Start 2P", monospace';

    // Score — left aligned
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(this.formatScore(), 16, textY);

    // Speed — center aligned, yellow for visibility
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFEE88';
    ctx.fillText(this.formatSpeed(speed), canvasW / 2, textY);

    // High — right aligned
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(this.formatHigh(), canvasW - 16, textY);
  },

  // ── Game Over overlay helper ───────────────────────────────────────────────

  /**
   * Draw the score summary lines on the Game Over overlay.
   * Caller is responsible for the overlay background and positioning.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx        - horizontal center of canvas
   * @param {number} baseY     - y baseline for first score line
   * @param {boolean} isNewBest - true when a new high score was just set
   */
  drawGameOverScore(ctx, cx, baseY, isNewBest) {
    ctx.textAlign = 'center';

    // Final score
    ctx.font      = '18px "Press Start 2P", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(this.formatScore(), cx, baseY);

    // High score
    ctx.font      = '14px "Press Start 2P", monospace';
    ctx.fillStyle = '#FFEE88';
    ctx.fillText(this.formatHigh(), cx, baseY + 28);

    // New best badge — only when earned
    if (isNewBest) {
      ctx.font      = '12px "Press Start 2P", monospace';
      ctx.fillStyle = '#FFD700';
      ctx.fillText('\u2605 New Best!', cx, baseY + 52);  // ★ New Best!
    }
  },

  // ── SFX preference ────────────────────────────────────────────────────────

  /**
   * Load sound-effects on/off preference from localStorage.
   * Defaults to true (enabled) if no value is stored.
   * @returns {boolean}
   */
  loadSfxPref() {
    try { return localStorage.getItem(SFX_KEY) !== 'false'; } catch { return true; }
  },

  /**
   * Persist sound-effects preference.
   * @param {boolean} enabled
   */
  saveSfxPref(enabled) {
    try { localStorage.setItem(SFX_KEY, String(enabled)); } catch { /* silent */ }
  },

  // ── Private localStorage helpers ──────────────────────────────────────────

  _loadHighScore() {
    try {
      const raw = localStorage.getItem(HS_KEY);
      return raw !== null ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch { return 0; }
  },

  _saveHighScore(value) {
    try { localStorage.setItem(HS_KEY, String(value)); } catch { /* silent */ }
  },
};

// ── Exports ────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { ScoreManager, HS_KEY, SFX_KEY };
}
