# Game Mechanics Guidelines — Flappy Kiro

## Physics Constants

All values are frame-based, assuming 60 FPS. Do not convert to time-based units.

```js
const GRAVITY           = 0.5;   // px/frame² — downward acceleration per frame
const FLAP_VELOCITY     = -8;    // px/frame  — instant upward snap on flap
const TERMINAL_VELOCITY = 12;    // px/frame  — max downward speed (clamp)
const TILT_REF_SPEED    = 4;     // px/frame  — denominator in atan2 tilt formula
const TILT_MIN_DEG      = -30;   // degrees   — max nose-up rotation
const TILT_MAX_DEG      = 90;    // degrees   — max nose-down rotation (vertical dive)
```

---

## Ghosty Movement Physics

### Per-Frame Update Sequence

Always apply in this exact order to avoid order-of-operations bugs:

```
1. ghosty.vy += GRAVITY                          // accumulate gravity
2. ghosty.vy = min(ghosty.vy, TERMINAL_VELOCITY) // clamp terminal velocity
3. ghosty.y  += ghosty.vy                        // Euler position integration
4. if ghosty.y < 0: ghosty.y = 0; ghosty.vy = 0 // ceiling clamp
5. tilt = clamp(atan2(vy, TILT_REF_SPEED) * (180/π), TILT_MIN_DEG, TILT_MAX_DEG)
```

### Flap Response

A flap **sets** velocity — it does not add to it. This is intentional: holding Space does not give extra lift.

```js
function flap(ghosty) {
  ghosty.vy = FLAP_VELOCITY;  // override, not +=
}
```

### Tilt Formula

Tilt is derived from velocity, not from acceleration. This means it lags slightly behind
direction changes, which feels natural.

```js
function tiltAngle(vy) {
  const raw = Math.atan2(vy, TILT_REF_SPEED) * (180 / Math.PI);
  return Math.max(TILT_MIN_DEG, Math.min(TILT_MAX_DEG, raw));
}
```

At `vy = FLAP_VELOCITY (-8)`: `atan2(-8, 4) ≈ -63°` → clamped to `-30°` (nose-up cap).
At `vy = TERMINAL_VELOCITY (12)`: `atan2(12, 4) ≈ 72°` → unclamped (below 90° cap).

---

## Sprite Animation System

Ghosty uses a 3-frame sprite sheet (96×32px source, rendered at 48×48px):

| Frame | Index | Sheet X | Trigger |
|---|---|---|---|
| Idle | 0 | 0 | Default during fall / IDLE state |
| Flap | 1 | 32 | Show for `FLAP_FRAME_HOLD_MS` (80ms) after flap input |
| Death | 2 | 64 | On GAME_OVER transition, held until restart |

### Animation State Machine

```
IDLE_FRAME ──flap input──► FLAP_FRAME
                               │
                        80ms elapsed
                               │
                               ▼
                          IDLE_FRAME

Any state ──GAME_OVER──► DEATH_FRAME (held)
DEATH_FRAME ──restart──► IDLE_FRAME
```

### AnimationSystem Interface

```js
const AnimationSystem = {
  frameIndex: 0,           // 0=idle, 1=flap, 2=death
  flapTimer: 0,            // ms remaining on flap frame hold

  triggerFlap() {
    this.frameIndex = 1;
    this.flapTimer  = FLAP_FRAME_HOLD_MS;  // 80
  },

  triggerDeath() {
    this.frameIndex = 2;
    this.flapTimer  = 0;
  },

  reset() {
    this.frameIndex = 0;
    this.flapTimer  = 0;
  },

  update(dtMs) {
    if (this.flapTimer > 0) {
      this.flapTimer -= dtMs;
      if (this.flapTimer <= 0) {
        this.flapTimer  = 0;
        this.frameIndex = 0;  // return to idle
      }
    }
  },

  // Returns {sx, sy, sw, sh} — source rect on the sprite sheet
  getSourceRect() {
    return { sx: this.frameIndex * 32, sy: 0, sw: 32, sh: 32 };
  },
};
```

### drawGhosty with Sprite Sheet

```js
function drawGhosty(ctx, ghosty) {
  if (!ghosty.visible) return;
  const { sx, sy, sw, sh } = AnimationSystem.getSourceRect();
  const cx = ghosty.x + ghosty.width  / 2;
  const cy = ghosty.y + ghosty.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ghosty.tilt * Math.PI / 180);
  ctx.drawImage(
    ghosty.sprite,
    sx, sy, sw, sh,           // source: correct animation frame
    -ghosty.width  / 2,
    -ghosty.height / 2,
    ghosty.width,
    ghosty.height
  );
  ctx.restore();
}
```

---

## Wall (Pipe) Generation Algorithm

### Spawning Trigger

A `distanceScrolled` accumulator advances by `currentSpeed` px each frame. When it crosses
a multiple of `SPAWN_INTERVAL` (150px), a new pipe is spawned.

```js
// Inside Scroller.update():
scroller.distanceScrolled += scroller.currentSpeed;
while (scroller.distanceScrolled >= SPAWN_INTERVAL) {
  scroller.distanceScrolled -= SPAWN_INTERVAL;  // subtract, don't reset
  _spawnPipe();
}
```

### Gap Positioning

```js
function _spawnPipe() {
  const pipe = acquirePipe();
  if (!pipe) return;

  const minGapTop = PIPE_MARGIN_TOP;
  const maxGapTop = canvasH - SCORE_BAR_H - PIPE_MARGIN_BOT - PIPE_GAP;
  const gapTop    = minGapTop + Math.random() * (maxGapTop - minGapTop);

  pipe.active     = true;
  pipe.x          = canvasW;
  pipe.width      = PIPE_WIDTH;
  pipe.gapTop     = gapTop;
  pipe.gapBottom  = gapTop + PIPE_GAP;
  pipe.scored     = false;
}
```

Invariants:
- `gapTop >= PIPE_MARGIN_TOP` (50px from top)
- `gapBottom <= canvasH - SCORE_BAR_H - PIPE_MARGIN_BOT` (50px above score bar)
- `gapBottom - gapTop === PIPE_GAP` (always 150px)

### Pipe Movement & Removal

```js
for (let i = 0; i < PIPE_POOL_SIZE; i++) {
  const p = pipePool[i];
  if (!p.active) continue;
  p.x -= scroller.currentSpeed;
  if (p.x + p.width < 0) releasePipe(p);  // off-screen: return to pool
}
```

---

## Progressive Difficulty (Scroll Speed)

Speed is a pure function of score — no mutable speed state beyond what `getSpeed` computes.

```js
function getSpeed(score) {
  return Math.min(
    BASELINE_SPEED + Math.floor(score / SPEED_SCORE_STEP) * SPEED_STEP,
    SPEED_CAP
  );
  // score=0 → 2.0, score=5 → 2.2, score=10 → 2.4 … score=100 → 6.0 (cap)
}
```

Speed milestones:
| Score | Speed | Feel |
|---|---|---|
| 0 | 2.0 px/frame | Gentle intro pace |
| 10 | 2.4 px/frame | Noticeable pickup |
| 25 | 3.0 px/frame | Moderate challenge |
| 50 | 4.0 px/frame | Fast |
| 100 | 6.0 px/frame | Maximum — speed cap reached |

---

## Background Milestone System

```js
const BG_THEMES = [
  { score: 0,  sky: '#87CEEB', ground: '#90EE90', label: 'Day'     },
  { score: 10, sky: '#FFB347', ground: '#DEB887', label: 'Sunset'  },
  { score: 25, sky: '#191970', ground: '#2F4F4F', label: 'Night'   },
  { score: 50, sky: '#FF6B9D', ground: '#C8A2C8', label: 'Dawn'    },
  { score: 75, sky: '#00CED1', ground: '#20B2AA', label: 'Storm'   },
];
```

Colour interpolation:

```js
function lerpColor(a, b, t) {
  const ra = parseInt(a.slice(1,3),16), ga = parseInt(a.slice(3,5),16), ba = parseInt(a.slice(5,7),16);
  const rb = parseInt(b.slice(1,3),16), gb = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16);
  const r  = Math.round(ra + (rb-ra)*t);
  const g  = Math.round(ga + (gb-ga)*t);
  const bv = Math.round(ba + (bb-ba)*t);
  return `rgb(${r},${g},${bv})`;
}
```

---

## Scoring System

Score increments exactly once per pipe when Ghosty's hitbox circle centre `cx` crosses
the pipe's left edge `pipe.x`:

```js
function checkScoring() {
  for (let i = 0; i < PIPE_POOL_SIZE; i++) {
    const p = pipePool[i];
    if (!p.active || p.scored) continue;
    if (ghosty.cx >= p.x) {
      p.scored = true;
      gameState.score++;
      AudioManager.score();
      HUD.spawnPopup(ghosty.cx, ghosty.cy);
      scroller.currentSpeed = getSpeed(gameState.score);
    }
  }
}
```

### High Score Persistence

```js
const HS_KEY = 'flappyKiroHighScore';

function loadHighScore() {
  try {
    const raw = localStorage.getItem(HS_KEY);
    return raw !== null ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch { return 0; }
}

function saveHighScore(score) {
  try { localStorage.setItem(HS_KEY, String(score)); } catch { /* silent */ }
}
```

---

## Collision Detection

### Circle Hitbox (Ghosty)

```js
// Computed once per frame into pre-declared variables
_hitCx = ghosty.x + ghosty.width  / 2;
_hitCy = ghosty.y + ghosty.height / 2;
_hitR  = HITBOX_RADIUS_FACTOR * Math.min(ghosty.width, ghosty.height) / 2;
```

### Circle vs. AABB (pipes)

```js
function circleVsRect(cx, cy, r, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}
```

### Boundary Tests

```js
const hitCeiling = (_hitCy - _hitR) <= 0;
const hitGround  = (_hitCy + _hitR) >= groundY;  // groundY = canvasH - SCORE_BAR_H
```

### Invincibility Frame & Flash

On first collision detection:
1. Set `gameState.isInvincible = true`, record `gameState.invincibilityStart = timestamp`.
2. Toggle `ghosty.visible` every `INV_FLASH_CYCLE` ms (100ms) for 5 cycles.
3. After `INV_DURATION` ms (500ms): if still colliding → transition to `GAME_OVER`.

---

## Input Responsiveness

Flap input must be processed on the **same frame** it arrives — no input buffering delay.
Touch `preventDefault()` suppresses the 300ms tap delay on mobile browsers.

---

## Session Reset

```js
function resetSession() {
  gameState.score           = 0;
  gameState.isInvincible    = false;
  gameState.shaking         = false;
  ghosty.y                  = canvasH / 2 - ghosty.height / 2;
  ghosty.vy                 = 0;
  ghosty.visible            = true;
  scroller.currentSpeed     = BASELINE_SPEED;
  scroller.distanceScrolled = 0;
  for (let i = 0; i < PIPE_POOL_SIZE; i++) pipePool[i].active = false;
  ParticleSystem.clear();
  HUD.clearPopups();
  AnimationSystem.reset();
  BackgroundSystem.reset();
}
```
