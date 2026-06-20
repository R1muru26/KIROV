// ── Ghosty.js ─────────────────────────────────────────────────────────────
// Ghosty character: physics state, sprite-sheet animation, and circle hitbox.
// Follows the subsystem object pattern from game-coding-standards.md.
// All constants reference the shared constants block (game-config.json values).

// ── Constants (mirrored from the main constants block) ─────────────────────
const GRAVITY             = 0.5;    // px/frame² — downward acceleration
const FLAP_VELOCITY       = -8;     // px/frame  — instant upward snap on flap
const TERMINAL_VELOCITY   = 12;     // px/frame  — max downward speed
const TILT_REF_SPEED      = 4;      // px/frame  — atan2 denominator for tilt
const TILT_MIN_DEG        = -30;    // degrees   — nose-up clamp
const TILT_MAX_DEG        = 90;     // degrees   — nose-down clamp
const HITBOX_RADIUS_FACTOR = 0.4;   // circle r = factor * min(w,h) / 2
const FLAP_FRAME_HOLD_MS  = 80;     // ms to hold flap sprite frame
const SPRITE_SRC_W        = 32;     // sprite sheet frame width, px
const SPRITE_SRC_H        = 32;     // sprite sheet frame height, px
const SPRITE_DST_W        = 48;     // rendered width of Ghosty, px
const SPRITE_DST_H        = 48;     // rendered height of Ghosty, px

// ── AnimationSystem ────────────────────────────────────────────────────────
// Manages 3-frame sprite sheet selection for Ghosty.
// Frame 0 = Idle, Frame 1 = Flap (held 80ms), Frame 2 = Death (locked).
const AnimationSystem = {
  frameIndex: 0,   // 0=idle, 1=flap, 2=death
  flapTimer:  0,   // ms remaining on flap frame hold

  /** Called on every flap input. Switches to flap frame for FLAP_FRAME_HOLD_MS. */
  triggerFlap() {
    this.frameIndex = 1;
    this.flapTimer  = FLAP_FRAME_HOLD_MS;
  },

  /** Called on GAME_OVER transition. Locks to death frame until reset. */
  triggerDeath() {
    this.frameIndex = 2;
    this.flapTimer  = 0;
  },

  /** Restores idle frame. Called by resetSession(). */
  reset() {
    this.frameIndex = 0;
    this.flapTimer  = 0;
  },

  /**
   * Advance animation timer. Auto-reverts flap frame to idle when timer expires.
   * @param {number} dtMs - elapsed ms this frame (use FRAME_MS constant ≈ 16.67)
   */
  update(dtMs) {
    if (this.flapTimer > 0) {
      this.flapTimer -= dtMs;
      if (this.flapTimer <= 0) {
        this.flapTimer  = 0;
        this.frameIndex = 0;  // revert to idle
      }
    }
  },

  /**
   * Returns the source rect on the sprite sheet for the current frame.
   * @returns {{ sx: number, sy: number, sw: number, sh: number }}
   */
  getSourceRect() {
    return {
      sx: this.frameIndex * SPRITE_SRC_W,
      sy: 0,
      sw: SPRITE_SRC_W,
      sh: SPRITE_SRC_H,
    };
  },
};

// ── PhysicsEngine ──────────────────────────────────────────────────────────
// All kinematic updates on the ghosty object. Pure side effects on the object.
const PhysicsEngine = {
  /**
   * Apply one frame of physics to ghosty.
   * Order: gravity → terminal clamp → position integration → ceiling clamp → tilt.
   * @param {object} ghosty
   */
  update(ghosty) {
    ghosty.vy += GRAVITY;                                          // 1. accumulate gravity
    ghosty.vy  = Math.min(ghosty.vy, TERMINAL_VELOCITY);          // 2. clamp terminal velocity
    ghosty.y  += ghosty.vy;                                        // 3. Euler integration
    if (ghosty.y < 0) { ghosty.y = 0; ghosty.vy = 0; }           // 4. ceiling clamp
    ghosty.tilt = this.tiltAngle(ghosty.vy);                       // 5. update tilt
  },

  /**
   * Apply flap impulse — sets vy, does not add to it.
   * @param {object} ghosty
   */
  flap(ghosty) {
    ghosty.vy = FLAP_VELOCITY;
  },

  /**
   * Compute tilt angle in degrees from vertical velocity.
   * Clamped to [TILT_MIN_DEG, TILT_MAX_DEG].
   * @param {number} vy
   * @returns {number} degrees
   */
  tiltAngle(vy) {
    const raw = Math.atan2(vy, TILT_REF_SPEED) * (180 / Math.PI);
    return Math.max(TILT_MIN_DEG, Math.min(TILT_MAX_DEG, raw));
  },
};

// ── CollisionDetector (Ghosty-specific) ───────────────────────────────────
// Pure circle-hitbox collision logic. No side effects.
const CollisionDetector = {
  /**
   * Compute the circle hitbox centered on ghosty's sprite.
   * @param {object} ghosty
   * @returns {{ cx: number, cy: number, r: number }}
   */
  circleHitbox(ghosty) {
    return {
      cx: ghosty.x + ghosty.width  / 2,
      cy: ghosty.y + ghosty.height / 2,
      r:  HITBOX_RADIUS_FACTOR * Math.min(ghosty.width, ghosty.height) / 2,
    };
  },

  /**
   * Test circle vs axis-aligned rectangle using nearest-point clamp.
   * @param {{ cx, cy, r }} circle
   * @param {{ rx, ry, rw, rh }} rect
   * @returns {boolean}
   */
  circleVsRect(circle, rect) {
    const nearX = Math.max(rect.rx, Math.min(circle.cx, rect.rx + rect.rw));
    const nearY = Math.max(rect.ry, Math.min(circle.cy, rect.ry + rect.rh));
    const dx = circle.cx - nearX;
    const dy = circle.cy - nearY;
    return dx * dx + dy * dy < circle.r * circle.r;
  },

  /**
   * Check if the circle hitbox hits the ceiling (y=0) or ground (y=groundY).
   * @param {{ cx, cy, r }} circle
   * @param {number} groundY - top of score bar (canvasH - SCORE_BAR_H)
   * @returns {boolean}
   */
  checkBounds(circle, groundY) {
    return (circle.cy - circle.r) <= 0 ||
           (circle.cy + circle.r) >= groundY;
  },

  /**
   * Check if the circle hitbox overlaps any active pipe's top or bottom rect.
   * @param {{ cx, cy, r }} circle
   * @param {Array} pipePool - fixed-size pool array; entries have .active flag
   * @param {number} canvasH
   * @returns {boolean}
   */
  checkPipes(circle, pipePool, canvasH) {
    for (let i = 0; i < pipePool.length; i++) {
      const p = pipePool[i];
      if (!p.active) continue;
      // Top pipe rect: from y=0 to y=gapTop
      if (this.circleVsRect(circle, { rx: p.x, ry: 0,        rw: p.width, rh: p.gapTop })) return true;
      // Bottom pipe rect: from y=gapBottom to y=canvasH
      if (this.circleVsRect(circle, { rx: p.x, ry: p.gapBottom, rw: p.width, rh: canvasH - p.gapBottom })) return true;
    }
    return false;
  },

  /**
   * Full collision check: pipes + bounds.
   * @param {object} ghosty
   * @param {Array}  pipePool
   * @param {number} groundY
   * @param {number} canvasH
   * @returns {boolean}
   */
  check(ghosty, pipePool, groundY, canvasH) {
    const circle = this.circleHitbox(ghosty);
    return this.checkBounds(circle, groundY) ||
           this.checkPipes(circle, pipePool, canvasH);
  },
};

// ── Ghosty factory ─────────────────────────────────────────────────────────
/**
 * Create a new ghosty state object.
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {HTMLImageElement} sprite - preloaded ghosty.png sprite sheet
 * @returns {object} ghosty
 */
function createGhosty(canvasW, canvasH, sprite) {
  return {
    x:       canvasW * 0.25 - SPRITE_DST_W / 2,  // fixed horizontal position
    y:       canvasH / 2    - SPRITE_DST_H / 2,  // vertical start: canvas center
    vy:      0,                                    // vertical velocity
    width:   SPRITE_DST_W,
    height:  SPRITE_DST_H,
    sprite:  sprite,          // HTMLImageElement — sprite sheet or custom upload
    tilt:    0,               // degrees, computed each frame by PhysicsEngine
    visible: true,            // toggled during invincibility flash
    customSprite: false,      // true when user has uploaded a custom image
    statusMsg:    null,       // { text: string, expiry: number } | null
  };
}

// ── Ghosty render ──────────────────────────────────────────────────────────
/**
 * Draw Ghosty on the canvas using the correct animation frame.
 * Must be called inside a ctx.save/restore block if screen shake is active.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} ghosty
 * @param {string} phase - current game phase ('IDLE'|'PLAYING'|'GAME_OVER')
 */
function drawGhosty(ctx, ghosty, phase) {
  if (!ghosty.visible) return;

  // Idle bob — only in IDLE state; never modifies ghosty.y
  let renderY = ghosty.y;
  if (phase === 'IDLE') {
    renderY += Math.sin(Date.now() / 400) * 4;  // ±4px, ~1.6s cycle
  }

  const cx = ghosty.x    + ghosty.width  / 2;
  const cy = renderY     + ghosty.height / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ghosty.tilt * Math.PI / 180);

  if (ghosty.customSprite) {
    // Custom upload: draw full image as single frame
    ctx.drawImage(
      ghosty.sprite,
      0, 0, ghosty.sprite.width, ghosty.sprite.height,
      -ghosty.width  / 2, -ghosty.height / 2,
       ghosty.width,       ghosty.height
    );
  } else {
    // Sprite sheet: crop to current animation frame
    const { sx, sy, sw, sh } = AnimationSystem.getSourceRect();
    ctx.drawImage(
      ghosty.sprite,
      sx, sy, sw, sh,
      -ghosty.width  / 2, -ghosty.height / 2,
       ghosty.width,       ghosty.height
    );
  }

  ctx.restore();
}

// ── Exports (for test harness / module bundler if needed) ──────────────────
// In the single-file build these are all in the same <script> scope.
// Expose for unit testing in a Node/browser test runner:
if (typeof module !== 'undefined') {
  module.exports = {
    AnimationSystem,
    PhysicsEngine,
    CollisionDetector,
    createGhosty,
    drawGhosty,
    GRAVITY,
    FLAP_VELOCITY,
    TERMINAL_VELOCITY,
    HITBOX_RADIUS_FACTOR,
    FLAP_FRAME_HOLD_MS,
  };
}
