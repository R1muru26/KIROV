# Design Document — Flappy Kiro

## Overview

Flappy Kiro is a browser-based retro endless-scroller implemented as a **single self-contained `index.html` file** with all JavaScript and CSS inlined. There are no build tools, no npm packages, and no external CDN dependencies. The runtime surface is a single HTML5 `<canvas>` element driven by `requestAnimationFrame`.

The design deliberately keeps complexity local: every subsystem is a plain JavaScript object or closure living in the same script block. Communication between subsystems happens through a shared `gameState` object rather than event buses or frameworks, which keeps the call graph flat and easy to trace.

Key technology choices:
- **HTML5 Canvas 2D API** — all rendering, including sprite transforms for tilt.
- **Web Audio API / HTML `<audio>` elements** — sound effects loaded via `Audio` objects for simplicity.
- **`localStorage`** — single key `flappyKiroHighScore` for high-score persistence.
- **`requestAnimationFrame`** — main loop; no `setInterval` or `setTimeout` for game logic.

---

## Architecture

### Single-File Structure

```
index.html
├── <head>
│   └── <style>  (CSS: canvas centering, body background)
├── <body>
│   ├── <canvas id="gameCanvas">
│   └── <input type="file" id="spriteUpload" accept="image/*" style="display:none">
└── <script>
    ├── Constants (GRAVITY, FLAP_V, TERMINAL_V, BASELINE_SPEED, SPEED_CAP, …)
    ├── State machine  (IDLE | PLAYING | PAUSED | GAME_OVER)
    ├── Physics_Engine
    ├── Scroller
    ├── Collision_Detector
    ├── Audio_Manager
    ├── AnimationController          ← sprite-sheet frame management
    ├── BackgroundTheme              ← dynamic sky gradient + milestone transitions
    ├── CharacterCustomizer          ← custom sprite upload / localStorage restore
    ├── ParallaxSystem
    ├── ParticleSystem
    ├── HUD  (Score_Bar, Score_Popup, overlays, start-screen buttons + instructions)
    ├── InputHandler
    └── GameLoop  (requestAnimationFrame driver)
</script>
```

### Constants Block

All tunable values are declared at the top of the `<script>` block as `const` variables, grouped by category. No magic numbers appear elsewhere in the code — every subsystem references these named constants.

```js
// ── Physics ────────────────────────────────────────────────────────────────
const GRAVITY           = 0.5;   // downward acceleration, px/frame²
const FLAP_VELOCITY     = -8;    // instant upward velocity on flap, px/frame
const TERMINAL_VELOCITY = 12;    // max downward velocity, px/frame
const TILT_REF_SPEED    = 4;     // reference horizontal speed for tilt calc, px/frame
const TILT_MIN_DEG      = -30;   // max nose-up tilt, degrees
const TILT_MAX_DEG      = 90;    // max nose-down tilt, degrees

// ── Scrolling ──────────────────────────────────────────────────────────────
const BASELINE_SPEED    = 2;     // initial scroll speed, px/frame
const SPEED_CAP         = 6;     // maximum scroll speed, px/frame
const SPEED_STEP        = 0.2;   // speed increment per 5-point score interval
const SPEED_SCORE_STEP  = 5;     // score points between speed increments
const SPAWN_INTERVAL    = 150;   // horizontal distance between pipe spawns, px

// ── Pipes ──────────────────────────────────────────────────────────────────
const PIPE_WIDTH        = 60;    // pipe rectangle width, px
const PIPE_GAP          = 150;   // vertical gap height between top and bottom pipe, px
const PIPE_MARGIN_TOP   = 50;    // min gap distance from canvas top, px
const PIPE_MARGIN_BOT   = 50;    // min gap distance from score bar top, px
const PIPE_CAP_H        = 10;    // height of the cap/rim at pipe opening, px
const PIPE_CAP_OVERHANG = 4;     // extra width on each side of the cap, px

// ── Collision ──────────────────────────────────────────────────────────────
const HITBOX_RADIUS_FACTOR = 0.4; // circle hitbox radius = factor * min(w,h)/2

// ── Effects ────────────────────────────────────────────────────────────────
const SHAKE_DURATION    = 300;   // screen shake duration, ms
const SHAKE_MAX         = 8;     // max shake displacement, px
const INV_DURATION      = 500;   // invincibility frame duration, ms
const INV_FLASH_CYCLE   = 100;   // one visible/invisible cycle during invincibility, ms

// ── Audio ──────────────────────────────────────────────────────────────────
const MUSIC_VOLUME      = 0.3;   // background music volume (0–1)

// ── Visuals ────────────────────────────────────────────────────────────────
const SKY_BLUE               = '#87CEEB';            // canvas background color
const PIPE_COLOR             = '#4caf50';            // pipe body fill color
const PIPE_CAP_COLOR         = '#388e3c';            // pipe cap/rim fill color
const SCORE_BAR_H            = 40;                   // score bar height, px
const SCORE_BAR_ALPHA        = 0.75;                 // score bar background opacity
const FAR_LAYER_SPEED        = 0.3 * BASELINE_SPEED; // far parallax scroll speed, px/frame
const NEAR_LAYER_SPEED       = 0.6 * BASELINE_SPEED; // near parallax scroll speed, px/frame
const FAR_LAYER_ALPHA        = 0.4;                  // far cloud opacity
const NEAR_LAYER_ALPHA       = 0.65;                 // near cloud opacity
const PARTICLE_RATE          = 3;                    // particles emitted per frame
const PARTICLE_LIFETIME      = 300;                  // particle lifetime, ms
const PARTICLE_MIN_R         = 2;                    // min particle radius, px
const PARTICLE_MAX_R         = 5;                    // max particle radius, px
const PARTICLE_INIT_OPACITY  = 0.6;                  // particle starting opacity
const POPUP_LIFETIME         = 600;                  // score popup duration, ms
const POPUP_RISE             = 40;                   // score popup rise distance, px

// ── Object Pooling ─────────────────────────────────────────────────────────
const PIPE_POOL_SIZE     = 10;  // fixed PipePair pool size (no runtime allocation)
const PARTICLE_POOL_SIZE = 200; // fixed particle buffer size (pre-allocated slots)
```

### State Machine

```
          input (Space/click/tap)
IDLE ─────────────────────────────► PLAYING
  ▲                                  │    ▲
  │                          P/Esc   │    │ P/Esc
  │                          ┌───────▼────┴──┐
  │                          │    PAUSED     │
  │                          └───────────────┘
  │                                  │
  │                          collision + inv. frame expires
  │                                  ▼
  │          input (Space/click/tap) GAME_OVER
  └──────────────────────────────────┘
```

Transitions:
| From | Event | To | Side effects |
|---|---|---|---|
| IDLE | Space / click / tap | PLAYING | Hide start prompt, start music |
| PLAYING | P / Escape | PAUSED | Pause music, show overlay |
| PAUSED | P / Escape | PLAYING | Resume music, hide overlay |
| PLAYING | invincibility expires + collision | GAME_OVER | Play game_over.wav, stop music, clear particles, update High_Score if needed |
| GAME_OVER | Space / click / tap | PLAYING | Full session reset, restart music |

---

## Components and Interfaces

### Physics_Engine

Responsible for all kinematic updates on Ghosty each frame.

```js
PhysicsEngine.update(ghosty, dt)   // dt = 1 frame unit
PhysicsEngine.flap(ghosty)         // set vy = FLAP_VELOCITY
PhysicsEngine.tiltAngle(vy)        // returns degrees, clamped [-30, 90]
```

Internal logic per frame:
1. `ghosty.vy += GRAVITY`  (GRAVITY = 0.5)
2. `ghosty.vy = Math.min(ghosty.vy, TERMINAL_VELOCITY)`  (TERMINAL_VELOCITY = 12)
3. `ghosty.y += ghosty.vy`
4. Ceiling clamp: if `ghosty.y < 0` → `ghosty.y = 0; ghosty.vy = 0`
5. Tilt: `angle = clamp(Math.atan2(ghosty.vy, 4) * (180/Math.PI), -30, 90)`

### Scroller

Manages all active Pipe_Pairs, scroll distance accumulator, and spawning.

```js
Scroller.update(score)    // advance all pipes, spawn if threshold crossed, remove off-screen
Scroller.reset()          // clear pipes, reset distanceAccumulator, reset speed
Scroller.getSpeed(score)  // pure: Baseline + floor(score/5)*0.2, capped at Speed_Cap
Scroller.pipes            // Array<PipePair>
```

Spawning trigger: a `distanceScrolled` accumulator increments by `currentSpeed` each frame; when it crosses a multiple of 150 a new Pipe_Pair is created at `x = canvasWidth`.

### Collision_Detector

Pure collision logic with no side effects. Uses a **circle hitbox** for Ghosty against axis-aligned pipe rectangles and flat boundary lines.

```js
CollisionDetector.circleHitbox(ghosty)           // returns {cx, cy, r}
CollisionDetector.circleVsRect(circle, rect)      // returns boolean
CollisionDetector.checkPipes(circle, pipes)       // returns boolean
CollisionDetector.checkBounds(circle, groundY)    // returns boolean
CollisionDetector.check(ghosty, pipes, groundY)   // returns boolean
```

**Circle hitbox formula:** given Ghosty's sprite at `(x, y)` with dimensions `(width, height)`:

```js
const cx = ghosty.x + ghosty.width  / 2;
const cy = ghosty.y + ghosty.height / 2;
const r  = HITBOX_RADIUS_FACTOR * Math.min(ghosty.width, ghosty.height) / 2;
// HITBOX_RADIUS_FACTOR = 0.4  → circle is 40% of the sprite's smaller half-dimension
```

**Circle vs. AABB pipe test:**

```js
// circle: {cx, cy, r}  rect: {rx, ry, rw, rh}
function circleVsRect(circle, rect) {
  const nearX = Math.max(rect.rx, Math.min(circle.cx, rect.rx + rect.rw));
  const nearY = Math.max(rect.ry, Math.min(circle.cy, rect.ry + rect.rh));
  const dx = circle.cx - nearX;
  const dy = circle.cy - nearY;
  return dx * dx + dy * dy < circle.r * circle.r;
}
```

**Boundary tests** (ceiling and ground are horizontal lines):

```js
cy - r <= 0          // ceiling collision
cy + r >= groundY    // ground collision (groundY = top of Score_Bar)
```

`checkPipes` calls `circleVsRect` for both sections (top pipe rectangle and bottom pipe rectangle) of each active Pipe_Pair. `check` computes the circle hitbox once and delegates to `checkPipes` and `checkBounds`.

### AnimationController

Manages sprite-sheet frame selection for Ghosty. Lives as a plain object (`AnimationSystem`) alongside the other subsystems.

```js
AnimationController.update(dtMs, ghosty)   // advance flapTimer; auto-return to idle when expired
AnimationController.triggerFlap()          // set frameIndex=1, flapTimer=FLAP_FRAME_HOLD_MS (80)
AnimationController.triggerDeath()         // set frameIndex=2, flapTimer=0 (locked)
AnimationController.reset()               // set frameIndex=0, flapTimer=0
AnimationController.getSourceRect()       // returns {sx, sy, sw, sh} for current frame
```

Frame layout on the sprite sheet (`assets/ghosty.png`, 96×32 px source):

| Frame | Index | Sheet sx | Trigger |
|---|---|---|---|
| Idle | 0 | 0 | Default; held during fall and IDLE state |
| Flap | 1 | 32 | Set immediately on flap input; held for 80 ms |
| Death | 2 | 64 | Set on GAME_OVER transition; held until restart |

State transitions:
```
IDLE_FRAME ──flap input──► FLAP_FRAME
                               │
                        80 ms elapsed
                               ▼
                          IDLE_FRAME
Any state ──GAME_OVER──► DEATH_FRAME (held)
DEATH_FRAME ──restart──► IDLE_FRAME
```

`getSourceRect()` returns `{ sx: frameIndex * 32, sy: 0, sw: 32, sh: 32 }`. The render call scales the 32×32 source to 48×48 destination (1.5× scale):

```js
ctx.drawImage(ghosty.sprite, sx, sy, 32, 32, -24, -24, 48, 48);
// (called inside the ctx.save/translate/rotate/restore block)
```

Constants added to the Constants block:
```js
const FLAP_FRAME_HOLD_MS = 80;   // ms to hold flap frame before returning to idle
const SPRITE_SRC_W       = 32;   // source frame width on sprite sheet, px
const SPRITE_SRC_H       = 32;   // source frame height on sprite sheet, px
const SPRITE_DST_W       = 48;   // rendered width of Ghosty sprite, px
const SPRITE_DST_H       = 48;   // rendered height of Ghosty sprite, px
```

---

### BackgroundTheme

Manages the dynamic sky gradient and milestone-triggered color transitions.

```js
BackgroundTheme.getTheme(score)             // returns current theme object (no transition logic)
BackgroundTheme.update(score, dtMs)         // checks milestone; advances themeTransition.progress
BackgroundTheme.draw(ctx, score, W, H)      // draws vertical gradient sky using createLinearGradient
BackgroundTheme.reset()                     // snap to theme index 0, clear transition
```

Theme table (4 themes, score-indexed):

| Theme | Score trigger | Sky top | Sky bottom | Cloud tint | Pipe color |
|---|---|---|---|---|---|
| Dawn | 0 | `#FFB347` | `#87CEEB` | white | `#4caf50` (green) |
| Day | 10 | `#87CEEB` | `#4FC3F7` | white | `#4caf50` (green) |
| Dusk | 25 | `#FF7043` | `#7E57C2` | orange-tinted | `#5D4037` (dark brown) |
| Night | 50 | `#1A237E` | `#0D47A1` | dark | `#424242` (dark grey); stars rendered as small white dots |

Color transitions between themes use linear RGB lerp over 60 frames (≈1 second at 60 fps):

```js
function lerpColor(hexA, hexB, t) {
  // parse r/g/b channels from each hex, lerp each channel, return 'rgb(r,g,b)'
}
```

`BackgroundTheme.draw` uses `createLinearGradient(0, 0, 0, H)` with two color stops (top and bottom), using the interpolated colors when a transition is active.

Stars (Night theme only): on each draw call during the Night theme, render N small white dots at pre-seeded positions drawn into the sky region above the score bar. Star positions are seeded once at init and reused each frame — no per-frame allocation.

Constants added:
```js
const BG_TRANSITION_FRAMES = 60;    // transition duration in frames (≈1 second at 60 fps)
```

---

### CharacterCustomizer

Manages custom sprite upload, validation, and localStorage persistence. Owns the hidden `<input type="file">` DOM element.

```js
CharacterCustomizer.init(ghosty)              // check localStorage; attach file input listener
CharacterCustomizer.openPicker()              // trigger input.click()
CharacterCustomizer.onFileSelected(e, ghosty) // read, validate, apply or show error
CharacterCustomizer.clearCustom(ghosty)       // reset ghosty.sprite to assets/ghosty.png
```

Flow for `onFileSelected`:
1. Read `e.target.files[0]`; reject if `file.size > 512 * 1024` — set `ghosty.statusMsg` with error text, 2 s expiry.
2. Use `FileReader.readAsDataURL(file)` on success.
3. `onload`: create a new `Image`, set `src` to the data URL.
4. Image `onload`: assign to `ghosty.sprite`, set `ghosty.customSprite = true`, store data URL in `localStorage` key `flappyKiroCustomSprite`, set `ghosty.statusMsg = { text: 'Character updated!', expiry: now + 2000 }`.
5. Image `onerror`: set error `statusMsg`, do not update `ghosty.sprite`.

On page load (`init`): if `localStorage.getItem('flappyKiroCustomSprite')` exists, load it as `ghosty.sprite` instead of `assets/ghosty.png`.

`ghosty.statusMsg` is read by `HUD.drawStartOverlay` and cleared once its `expiry` timestamp is exceeded.

Constants added:
```js
const CUSTOM_SPRITE_KEY    = 'flappyKiroCustomSprite'; // localStorage key
const MAX_SPRITE_BYTES     = 524288;                   // 512 KB file size limit
const STATUS_MSG_DURATION  = 2000;                     // ms to show status message
```

---

### Audio_Manager

Wraps `HTMLAudioElement` instances with error-safe play helpers.

```js
AudioManager.init()         // load all assets, attach error handlers
AudioManager.flap()         // reset + play jump.wav
AudioManager.score()        // play score.wav
AudioManager.gameOver()     // play game_over.wav
AudioManager.startMusic()   // play looping music if asset present
AudioManager.pauseMusic()   // pause at current position
AudioManager.resumeMusic()  // resume from paused position
AudioManager.stopMusic()    // stop and reset music
```

All methods catch errors and log to `console.warn`. If an asset is absent the corresponding Audio object is `null` and the method is a no-op.

### ParallaxSystem

Two independent layer objects, each an array of cloud shapes.

```js
ParallaxSystem.init(canvasW, canvasH)
ParallaxSystem.update()        // advance each layer at its fixed speed
ParallaxSystem.draw(ctx)       // draw far layer then near layer
```

Layer speeds are fixed constants independent of pipe scroll speed:
- Far layer: `0.3 * BASELINE_SPEED = 0.6 px/frame`, opacity 0.4
- Near layer: `0.6 * BASELINE_SPEED = 1.2 px/frame`, opacity 0.65

### ParticleSystem

```js
ParticleSystem.emit(x, y, count)   // add `count` particles at position
ParticleSystem.update(dt)          // advance all particles, prune expired
ParticleSystem.draw(ctx)           // render all live particles
ParticleSystem.clear()             // remove all particles (GAME_OVER transition)
```

### HUD

```js
HUD.drawScoreBar(ctx, score, highScore, speed, canvasW, canvasH)
HUD.drawStartOverlay(ctx, canvasW, canvasH, highScore, audioEnabled)
// drawStartOverlay renders (in order):
//   1. Title text
//   2. Instructions panel  — rgba(0,0,0,0.35) rounded rect at x=60,y=300,w=360,h=90
//      Line 1 (y=322): "SPACE / TAP — Flap"
//      Line 2 (y=342): "P / ESC — Pause"
//      Line 3 (y=362): "Pass pipes to score"
//      Line 4 (y=382): "Avoid walls & floor"
//   3. Play button          — x=180,y=400,w=120,h=40, fill #43A047, label "▶ PLAY"
//   4. Upload Character btn — x=160,y=455,w=160,h=32, fill #546E7A, label "👤 Upload Character"
//   5. Sound toggle button  — x=424,y=16,w=48,h=32, label 🔊 or 🔇
//   6. statusMsg overlay    — brief text (upload success / error) if ghosty.statusMsg active
HUD.drawPauseOverlay(ctx, canvasW, canvasH)
HUD.drawGameOverOverlay(ctx, canvasW, canvasH, score)
HUD.spawnPopup(x, y)              // create Score_Popup
HUD.updatePopups(dt)              // advance animation
HUD.drawPopups(ctx)               // render active popups
```

### InputHandler

```js
InputHandler.init(canvas, callbacks)
// callbacks: { flap, togglePause, toggleAudio, openUpload }
// Registers: window keydown (Space, P, Escape), canvas click, canvas touchstart
// Ensures single-trigger per physical interaction via event.preventDefault on touch
//
// Button regions (pre-declared objects, not allocated per event):
// InputHandler.buttonRegions = {
//   play:            { x: 180, y: 400, w: 120, h: 40 },
//   soundToggle:     { x: 424, y: 16,  w: 48,  h: 32 },
//   uploadCharacter: { x: 160, y: 455, w: 160, h: 32 },
// }
//
// During IDLE state, click/touchstart handlers check coordinates against buttonRegions
// using a simple AABB point-in-rect test before routing to the appropriate callback.
// Clicks outside all button regions during IDLE still trigger flap (legacy behavior).
InputHandler.hitTest(px, py, rect)  // pure: returns true iff point (px,py) is inside rect
```

---

## Data Models

### Ghosty

```js
{
  x: number,        // fixed horizontal position (canvas center-left region)
  y: number,        // current vertical position (top edge)
  vy: number,       // vertical velocity (positive = downward)
  width: number,    // sprite render width (px) — 48 with sprite-sheet scaling
  height: number,   // sprite render height (px) — 48 with sprite-sheet scaling
  sprite: Image,    // preloaded HTMLImageElement (assets/ghosty.png or custom)
  tilt: number,     // current tilt angle in degrees
  visible: boolean, // toggled during invincibility flash
  // ── Animation fields (managed by AnimationController) ──────────────────
  animFrame: number,  // current frame index: 0=idle, 1=flap, 2=death
  animTimer: number,  // ms remaining on flap frame hold (0 when not in flap frame)
  flapFlashMs: number,// alias for FLAP_FRAME_HOLD_MS; stored per-ghosty for testability
  // ── Custom sprite fields (managed by CharacterCustomizer) ───────────────
  customSprite: boolean,             // true if a user-uploaded sprite is active
  statusMsg: { text: string, expiry: number } | null,  // brief overlay message (upload result)
}
```

### PipePair

```js
{
  x: number,        // left edge of both pipes
  width: number,    // pipe width in px (constant: 60)
  gapTop: number,   // y of top of gap (bottom of top pipe)
  gapBottom: number,// y of bottom of gap (top of bottom pipe)
  scored: boolean,  // true once Ghosty has passed this pair
}
```

### Particle

```js
{
  x: number,
  y: number,
  radius: number,   // 2–5 px
  color: string,    // 'white' or '#add8e6'
  opacity: number,  // 0.0–0.6
  age: number,      // ms elapsed since birth
  lifetime: number, // 300 ms constant
  dx: number,       // x velocity (negative, leftward ±45°)
  dy: number,       // y velocity component
}
```

### ScorePopup

```js
{
  x: number,        // spawn x (Ghosty center)
  y: number,        // current y (starts at Ghosty center, moves up)
  originY: number,  // initial y at spawn time
  age: number,      // ms elapsed
  lifetime: number, // 600 ms
}
```

### GameState Object

```js
{
  phase: 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER',
  score: number,
  highScore: number,
  invincible: boolean,
  invincibilityStart: number | null,  // timestamp ms
  shaking: boolean,
  shakeStart: number | null,
  shakeMagnitude: number,
  // ── Audio ──────────────────────────────────────────────────────────────
  audioEnabled: boolean,              // when false, all AudioManager methods are no-ops
  // ── Background theme transition ────────────────────────────────────────
  themeTransition: {
    active: boolean,                  // true while lerp is in progress
    fromTheme: number,                // index into BG_THEMES of the outgoing theme
    toTheme: number,                  // index into BG_THEMES of the incoming theme
    progress: number,                 // 0.0 (start) → 1.0 (complete), advances each frame
  },
}
```

---

## Rendering Pipeline and Draw Order

Each frame `GameLoop.tick()` calls `render(ctx)`:

```
render(ctx):
  ctx.save()                             — outer save for screen shake translate
  [applyScreenShake if shaking]

  1. ctx.clearRect(0, 0, W, H)           — clear canvas
  2. BackgroundTheme.draw(ctx, score, W, H)  — sky gradient (replaces flat SKY_BLUE fill)
  3. ParallaxSystem.draw(ctx)            — far clouds, then near clouds
  4. drawPipes(ctx, pipePool)            — all active Pipe_Pairs (theme-aware colors)
  5. drawGhosty(ctx, ghosty)            — animated sprite with tilt transform
  6. ParticleSystem.draw(ctx)            — particle trail
  ctx.restore()                          — end screen shake region

  7. HUD.drawScoreBar(...)              — Score_Bar (outside shake — never shifts)
  8. HUD.drawPopups(ctx)               — Score_Popups
  9. overlay (if applicable):
       IDLE      → HUD.drawStartOverlay  (includes instructions panel + buttons)
       PAUSED    → HUD.drawPauseOverlay
       GAME_OVER → HUD.drawGameOverOverlay
```

Steps 4–5 are skipped when `phase === 'IDLE'` (no pipes yet) or when `drawGhosty` is suppressed during the invincibility flash cycle. `BackgroundTheme.draw` and `ParallaxSystem.draw` run on every frame regardless of phase.

### Ghosty Sprite Transform

```js
function drawGhosty(ctx, ghosty) {
  if (!ghosty.visible) return;
  const cx = ghosty.x + ghosty.width  / 2;
  const cy = ghosty.y + ghosty.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ghosty.tilt * Math.PI / 180);
  if (ghosty.customSprite) {
    // Custom upload: single-frame, full source image
    ctx.drawImage(ghosty.sprite,
      0, 0, ghosty.sprite.width, ghosty.sprite.height,
      -ghosty.width / 2, -ghosty.height / 2, ghosty.width, ghosty.height);
  } else {
    // Sprite sheet: crop to current animation frame
    const { sx, sy, sw, sh } = AnimationController.getSourceRect();
    ctx.drawImage(ghosty.sprite,
      sx, sy, sw, sh,
      -ghosty.width / 2, -ghosty.height / 2, ghosty.width, ghosty.height);
    // sw=32, sh=32 source → dw=48, dh=48 destination (1.5× scale via ghosty.width/height)
  }
  ctx.restore();
}
```

### Screen Shake

Applied as an outer transform wrapping the entire render call:

```js
if (gameState.shaking) {
  const elapsed = now - gameState.shakeStart;
  const factor = Math.max(0, 1 - elapsed / SHAKE_DURATION);  // 0..1 decaying
  const dx = (Math.random() * 2 - 1) * SHAKE_MAX * factor;
  const dy = (Math.random() * 2 - 1) * SHAKE_MAX * factor;
  ctx.translate(dx, dy);
}
```

### Pipe Rendering

Each Pipe_Pair renders two sections:

```
Top pipe:    fillRect(x, 0, pipeW, gapTop)               // body
             fillRect(x-capOverhang, gapTop-capH, pipeW+capOverhang*2, capH)  // rim cap

Bottom pipe: fillRect(x, gapBottom, pipeW, canvasH)       // body
             fillRect(x-capOverhang, gapBottom, pipeW+capOverhang*2, capH)    // rim cap
```

Colors: body `#4caf50`, cap `#388e3c`.

---

## Game Loop Design

```
GameLoop.start():
  requestAnimationFrame(tick)

tick(timestamp):
  if phase === PLAYING:
    PhysicsEngine.update(ghosty)
    Scroller.update(gameState.score)
    ParticleSystem.emit(ghosty.trailingX, ghosty.centerY, 3)
    ParticleSystem.update(FRAME_MS)
    AnimationController.update(FRAME_MS, ghosty)  // advance flap timer; auto-revert to idle
    HUD.updatePopups(FRAME_MS)
    const hit = CollisionDetector.check(ghosty, pipes, groundY)
    handleCollision(hit)
    checkScoring()
    updateScreenShake()

  if phase === PAUSED:
    // no updates — last frame is re-rendered with pause overlay

  // All states except PAUSED: update background and parallax
  if phase !== PAUSED:
    BackgroundTheme.update(gameState.score, FRAME_MS)  // milestone check + transition lerp
    ParallaxSystem.update()   // clouds scroll in background regardless of game state

  render(ctx)
  requestAnimationFrame(tick)
```

`FRAME_MS` is a constant (≈16.67 ms at 60 fps) used for particle and popup age accounting. The loop uses `requestAnimationFrame` exclusively — there is no delta-time normalisation because the requirements specify fixed pixel-per-frame physics constants (gravity = 0.5 px/frame²) that assume 60 fps display. This matches typical Flappy Bird physics implementations.

---

## localStorage Persistence

```js
const HS_KEY            = 'flappyKiroHighScore';   // integer score as string
const AUDIO_KEY         = 'flappyKiroAudioEnabled'; // 'true' or 'false'
const CUSTOM_SPRITE_KEY = 'flappyKiroCustomSprite'; // data URL of uploaded sprite

function loadHighScore() {
  try {
    const raw = localStorage.getItem(HS_KEY);
    return raw !== null ? parseInt(raw, 10) || 0 : 0;
  } catch { return 0; }
}

function saveHighScore(value) {
  try { localStorage.setItem(HS_KEY, String(value)); } catch {}
}

function loadAudioEnabled() {
  try { return localStorage.getItem(AUDIO_KEY) !== 'false'; } catch { return true; }
}

function saveAudioEnabled(enabled) {
  try { localStorage.setItem(AUDIO_KEY, String(enabled)); } catch {}
}
```

`loadHighScore()` and `loadAudioEnabled()` are called at page load.
`CharacterCustomizer` reads/writes `CUSTOM_SPRITE_KEY` directly (data URL).
High score is written on `GAME_OVER` transition only if `score > highScore`.
Audio preference is written whenever the sound toggle is activated.

---

## Input Handling

All inputs are registered once in `InputHandler.init()`. A guard flag `inputConsumed` prevents double-firing when both a `keydown` and a `click` arrive from the same physical action.

```js
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') handleFlap();
  if (e.code === 'KeyP' || e.code === 'Escape') handlePause();
  if (e.code === 'KeyM') toggleAudio();
});

canvas.addEventListener('click', (e) => {
  const { offsetX: px, offsetY: py } = e;
  // During IDLE: check buttons first, then fall through to flap
  if (gameState.phase === 'IDLE') {
    if (InputHandler.hitTest(px, py, InputHandler.buttonRegions.soundToggle)) {
      toggleAudio(); return;
    }
    if (InputHandler.hitTest(px, py, InputHandler.buttonRegions.uploadCharacter)) {
      CharacterCustomizer.openPicker(); return;
    }
    // BTN_PLAY or anywhere else on IDLE screen → start game
  }
  handleFlap();
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  // Translate touch coordinates to canvas space, then same routing as click
  // ... (same logic as click handler above)
  handleFlap();
});
```

`handleFlap()` routes based on current phase:
- `IDLE` → `resetSession()` + transition to `PLAYING` + `AudioManager.startMusic()`
- `PLAYING` → `PhysicsEngine.flap(ghosty)` + `AnimationController.triggerFlap()` + `AudioManager.flap()`
- `GAME_OVER` → `resetSession()` + transition to `PLAYING`
- `PAUSED` → no-op (requirement 11.6)

`handlePause()` routes:
- `PLAYING` → `PAUSED`
- `PAUSED` → `PLAYING`
- `IDLE` | `GAME_OVER` → no-op (requirement 11.8)

`toggleAudio()`: flips `gameState.audioEnabled`, saves preference, updates sound toggle button label.

---

## Error Handling

**Audio failures** — all `Audio.play()` calls return a Promise. Each is wrapped:
```js
const p = audio.play();
if (p) p.catch(err => console.warn('Audio play failed:', err));
```
If an `<audio>` element could not be loaded, `onerror` sets the reference to `null` and every play method checks for null before proceeding.

**localStorage failures** — wrapped in try/catch; if unavailable (e.g., private browsing quota exceeded), `highScore` lives only in memory.

**Sprite load failure** — `ghosty.sprite.onerror` sets a flag; `drawGhosty` falls back to drawing a simple colored rectangle.

**Missing background music** — `AudioManager.init()` attempts to load `assets/music.ogg` then `assets/music.mp3`. If neither loads, the `bgMusic` reference is null and all music methods are no-ops. The game proceeds normally (requirement 14.5 specifies this as conditional: "WHERE a background music asset is available").

---

## Performance

### Target Frame Rate

The game targets **60 FPS** driven exclusively by `requestAnimationFrame`. All physics constants (gravity, flap velocity, terminal velocity, scroll speed) are expressed in px/frame and assume a 60 fps display. There is no delta-time normalisation — this matches conventional Flappy Bird implementations and keeps arithmetic in the hot path simple.

### Pipe Object Pooling

Repeated allocation of `PipePair` objects and subsequent garbage collection causes GC pauses that interrupt the frame budget. Instead, a **fixed pool** of `PIPE_POOL_SIZE` (10) `PipePair` objects is allocated once at startup and reused throughout the session:

```js
// Initialise pool once
const pipePool = Array.from({ length: PIPE_POOL_SIZE }, () => ({
  active: false, x: 0, width: 0, gapTop: 0, gapBottom: 0, scored: false,
}));

// Spawn: find first inactive slot and initialise
function acquirePipe() {
  return pipePool.find(p => !p.active) ?? null; // null = pool exhausted (should not happen at 60fps)
}

// Despawn: mark inactive instead of removing from array
function releasePipe(pipe) {
  pipe.active = false;
}
```

`Scroller.update` iterates `pipePool`, skipping inactive slots. Off-screen pipes call `releasePipe` rather than `Array.splice`. No heap allocation occurs during normal gameplay.

### Particle Array Management

Particles are similarly pre-allocated in a fixed buffer of `PARTICLE_POOL_SIZE` (200) slots. A simple linear scan finds the first slot with `active === false` for emission; expired particles are marked `active = false` without `Array.splice`:

```js
const particlePool = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
  active: false, x: 0, y: 0, radius: 0, color: '', opacity: 0,
  age: 0, lifetime: 0, dx: 0, dy: 0,
}));
```

At 3 particles/frame and a 300 ms lifetime (≈18 frames at 60fps), at most ~54 slots are live at any time — well within the 200-slot buffer. `ParticleSystem.clear()` iterates the pool and sets all `active = false`.

### Sprite Batching

Ghosty is a single `drawImage` call per frame — no batching needed. Pipe bodies and caps are rendered with direct `fillRect` calls using two `fillStyle` assignments per pipe pair, which is already the most efficient Canvas 2D approach. Off-screen canvases, `ImageData` manipulation, and pre-composited sprite atlases are not used and should not be introduced.

### Avoiding Per-Frame Allocations

The game loop `tick` function must not create objects, closures, or array spreads on every frame. Rules:
- Screen-shake offsets, tilt angle, and the circle hitbox are computed into **pre-declared `let` variables** at the top of the script, not with `{}` literals inside the loop.
- `Math.random()` is called inline — no helper wrappers that return new objects.
- `Scroller.getSpeed` returns a number (not an object).
- Particle direction is computed with scalar trigonometry into pre-declared `dx`/`dy` variables.

### Canvas State Minimisation

`ctx.save()` / `ctx.restore()` are called **only** for Ghosty's tilt transform. All other drawing — background, parallax clouds, pipes, Score_Bar, HUD overlays — uses direct `fillStyle` / `fillRect` / `fillText` with no transform stack manipulation. This keeps the Canvas 2D state machine overhead to a minimum each frame.

---

## Testing Strategy

### Dual Approach

Unit tests cover specific examples, edge cases, and error conditions. Property tests verify universal invariants across many generated inputs. Both are necessary: unit tests catch concrete bugs; property tests verify that no edge case breaks invariants.

Since this is a single-file game, the testing approach extracts pure logic functions into testable units:
- `PhysicsEngine` — pure functions operating on numbers
- `CollisionDetector` — pure circle-vs-AABB math and boundary line checks
- `Scroller.getSpeed` — pure formula
- `HUD` format functions — pure string operations
- `loadHighScore` / `saveHighScore` — testable with a mocked localStorage

### Property-Based Testing Library

Use **fast-check** (browser-compatible, no Node required for basic use). Each property test runs a minimum of **100 iterations**.

Tag format for each test:
> `// Feature: flappy-kiro, Property N: <property text>`

### Unit Test Examples

- Ghosty starts at correct canvas center position on init
- IDLE → PLAYING transition hides start prompt
- GAME_OVER overlay present after invincibility expiry
- Score resets to 0 on session reset
- High_Score unchanged during reset when score ≤ highScore
- Audio errors are caught and do not throw

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the software is supposed to do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection:**
After prework analysis, several properties were consolidated to eliminate redundancy:
- Properties covering ceiling/ground collision (4.3, 4.4) are edge cases of the general AABB overlap property (4.1/4.2) and are handled by the generator.
- The reset invariant (7.2) subsumes the speed-reset check (12.5) — both are covered by a single comprehensive reset property.
- Draw-order properties (8.4, 8.7, 13.7) are merged into one draw-order property.
- Score format (5.4) and High_Score format (5.5) are merged into one formatting property.
- Screen shake (4.8, 13.5) merged into one property.
- Particle opacity decay (13.2) and popup animation (13.6) each remain distinct.

---

### Property 1: Gravity accumulates velocity correctly

*For any* initial vertical velocity `v0` and any number of frames `n` (where no clamping or flap occurs), after `n` physics steps the vertical velocity shall equal `v0 + 0.5 * n`, subject to the terminal velocity cap of 12 px/frame.

**Validates: Requirements 2.1, 2.3**

---

### Property 2: Flap always sets velocity to −8 regardless of prior state

*For any* Ghosty vertical velocity `v` (positive, negative, or zero), applying a flap shall set `ghosty.vy` to exactly `−8`.

**Validates: Requirements 2.2**

---

### Property 3: Terminal velocity clamp

*For any* velocity value `v > 12`, after one Physics_Engine update step (gravity application + clamp), `ghosty.vy` shall be at most `12`.

**Validates: Requirements 2.3**

---

### Property 4: Euler position integration

*For any* Ghosty y-position `y` and clamped vertical velocity `v` (where `v ≤ 12`), after one physics step `ghosty.y` shall equal `y + v`.

**Validates: Requirements 2.4**

---

### Property 5: Tilt angle formula

*For any* vertical velocity `v`, `PhysicsEngine.tiltAngle(v)` shall return a value in degrees equal to `clamp(atan2(v, 4) * (180 / π), −30, 90)`.

**Validates: Requirements 2.5**

---

### Property 6: Pipe gap constraints on spawn

*For any* newly spawned Pipe_Pair on a canvas of height `H` with Score_Bar height `S`, the gap top shall be at least 50 px below the canvas top edge and the gap bottom shall be at least 50 px above the Score_Bar top edge.

Formally: `gapTop ≥ 50` and `gapBottom ≤ H − S − 50`.

**Validates: Requirements 3.3**

---

### Property 7: Pipe gap height is always 150 px

*For any* spawned Pipe_Pair, `pipe.gapBottom − pipe.gapTop` shall equal exactly 150.

**Validates: Requirements 3.2**

---

### Property 8: Scroll speed formula

*For any* non-negative integer score `S`, `Scroller.getSpeed(S)` shall equal `min(2 + Math.floor(S / 5) * 0.2, 6)`.

**Validates: Requirements 3.5, 12.2, 12.3, 12.4**

---

### Property 9: Pipe movement per frame

*For any* Pipe_Pair at horizontal position `x` and current scroll speed `spd`, after one Scroller update step the pipe's x shall equal `x − spd`.

**Validates: Requirements 3.4**

---

### Property 10: Off-screen pipes are removed

*For any* Pipe_Pair whose `x + pipeWidth < 0`, after a Scroller update step the pipe shall not appear in `Scroller.pipes`.

**Validates: Requirements 3.6**

---

### Property 11: Circle-vs-rect overlap detection is correct

*For any* circle `(cx, cy, r)` and axis-aligned rectangle `(rx, ry, rw, rh)`, `CollisionDetector.circleVsRect(circle, rect)` shall return `true` if and only if the distance from the circle's centre to the nearest point on the rectangle is strictly less than `r` (i.e. the circle and rectangle share at least one interior point).

The nearest-point computation used is:
```
nearX = clamp(cx, rx, rx+rw)
nearY = clamp(cy, ry, ry+rh)
overlap ⟺ (cx−nearX)² + (cy−nearY)² < r²
```

**Validates: Requirements 4.1**

---

### Property 12: Circle hitbox dimensions

*For any* Ghosty with sprite dimensions `(width, height)` at position `(x, y)`, `CollisionDetector.circleHitbox(ghosty)` shall return a circle with:

- centre `cx = x + width / 2`, `cy = y + height / 2`
- radius `r = HITBOX_RADIUS_FACTOR × min(width, height) / 2`

where `HITBOX_RADIUS_FACTOR = 0.4`.

For example, a 60 × 60 sprite produces `r = 0.4 × 30 = 12 px`.

**Validates: Requirements 4.2**

---

### Property 13: Screen shake amplitude decay

*For any* time `t` in `[0, 300]` ms since shake start, the canvas displacement magnitude applied by the shake effect shall be at most `8 × (1 − t / 300)`.

**Validates: Requirements 4.8, 13.5**

---

### Property 14: Idle state suppresses physics and scrolling

*For any* number of frames `n ≥ 1` elapsed while `phase === 'IDLE'`, Ghosty's `vy` shall remain 0 and `Scroller.pipes` shall remain empty.

**Validates: Requirements 1.3, 1.4**

---

### Property 15: GAME_OVER overlay persists

*For any* number of frames `n ≥ 1` elapsed while `phase === 'GAME_OVER'`, the game-over overlay shall remain visible and the game shall not auto-advance to any other state.

**Validates: Requirements 4.10**

---

### Property 16: Score increments exactly once per pipe pass

*For any* Pipe_Pair, as Ghosty's hitbox trailing edge crosses the pipe's left edge, the score shall increment by exactly 1 and the pipe's `scored` flag shall be set to `true`, preventing any further increment for that pipe.

**Validates: Requirements 5.1**

---

### Property 17: Score and High_Score display format

*For any* non-negative integer `X`, `formatScore(X)` shall return `"Score: " + X` and `formatHigh(X)` shall return `"High: " + X`. *For any* speed value `spd`, `formatSpeed(spd)` shall return `"Speed: " + spd.toFixed(1)`.

**Validates: Requirements 5.4, 5.5, 12.7**

---

### Property 18: High_Score updated when score exceeds stored value

*For any* pair `(score, highScore)` where `score > highScore`, on `GAME_OVER` transition `localStorage.getItem('flappyKiroHighScore')` shall equal `String(score)`.

**Validates: Requirements 5.7, 6.2**

---

### Property 19: High_Score unchanged when score does not exceed it

*For any* pair `(score, highScore)` where `score ≤ highScore`, after a session reset `localStorage.getItem('flappyKiroHighScore')` shall remain `String(highScore)`.

**Validates: Requirements 7.3**

---

### Property 20: localStorage round-trip for High_Score

*For any* non-negative integer `H`, calling `saveHighScore(H)` followed by `loadHighScore()` shall return `H`.

**Validates: Requirements 6.1, 6.2**

---

### Property 21: Session reset produces clean state

*For any* game state (arbitrary score, arbitrary pipe set, arbitrary Ghosty velocity), after `resetSession()`:
- `score === 0`
- `Scroller.pipes` is empty
- `ghosty.vy === 0`
- `Scroller.currentSpeed === BASELINE_SPEED (2)`
- Ghosty's `y` equals the initial start position

**Validates: Requirements 7.2, 12.5**

---

### Property 22: Parallax layer speeds satisfy depth constraints

*For any* configured ParallaxSystem, `farLayer.speed ≤ 0.3 × BASELINE_SPEED` and `nearLayer.speed ≤ 0.6 × BASELINE_SPEED`, and `farLayer.opacity < nearLayer.opacity`, with both opacities in `[0.4, 0.8]`.

**Validates: Requirements 8.2, 8.3**

---

### Property 23: No flap input processed while PAUSED

*For any* Space key, click, or touchstart event received while `phase === 'PAUSED'`, `ghosty.vy` shall remain unchanged.

**Validates: Requirements 11.6**

---

### Property 24: Speed applied to all pipes on the same frame as score increment

*For any* set of active Pipe_Pairs and any score increment that triggers a speed change, all pipes in `Scroller.pipes` shall move by the **new** speed value on the same frame the score changes.

**Validates: Requirements 12.6**

---

### Property 25: Particle emission rate

*For any* frame while `phase === 'PLAYING'`, exactly 3 new particles shall be added to `ParticleSystem.particles` before any pruning of expired particles occurs.

**Validates: Requirements 13.1**

---

### Property 26: Particle opacity decay

*For any* particle with `lifetime = 300` ms and elapsed age `t` ms (where `0 ≤ t ≤ 300`), the particle's opacity shall equal `0.6 × (1 − t / 300)`.

**Validates: Requirements 13.2**

---

### Property 27: Expired particles are removed

*For any* particle whose `age ≥ lifetime`, after a `ParticleSystem.update()` call the particle shall not be present in `ParticleSystem.particles`.

**Validates: Requirements 13.3**

---

### Property 28: Score_Popup animation formula

*For any* Score_Popup with elapsed age `t` ms (where `0 ≤ t ≤ 600`), the popup's `y` offset from its origin shall equal `−40 × (t / 600)` and its opacity shall equal `1 − t / 600`.

**Validates: Requirements 13.6**

---

### Property 29: Expired Score_Popups are removed

*For any* Score_Popup whose `age ≥ 600` ms, after a `HUD.updatePopups()` call the popup shall not be present in `HUD.popups`.

**Validates: Requirements 13.8**

---

### Property 30: Canvas cleared before every frame render

*For any* animation frame, `ctx.clearRect(0, 0, canvasWidth, canvasHeight)` shall be the first canvas operation executed in the render function before any draw calls.

**Validates: Requirements 10.3**

---

### Property 31: Update steps skipped in non-PLAYING states

*For any* number of frames `n ≥ 1` elapsed while `phase` is `IDLE`, `PAUSED`, or `GAME_OVER`, the functions `PhysicsEngine.update`, `Scroller.update`, and `ParticleSystem.update` shall not be called.

**Validates: Requirements 10.4, 10.5**

---

### Property 32: Animation frame selection correctness

*For any* combination of `(gamePhase, flapTimer, dtMs)`, `AnimationController.getSourceRect()` shall return the correct source rectangle according to the following rules:
- If `gamePhase === 'GAME_OVER'`: `sx = 64` (Death frame, index 2), regardless of flapTimer.
- If `flapTimer > 0`: `sx = 32` (Flap frame, index 1).
- Otherwise: `sx = 0` (Idle frame, index 0).
- In all cases: `sy = 0`, `sw = 32`, `sh = 32`.

Additionally, *for any* `flapTimer` value `t > 0` and elapsed time `dtMs ≥ t`, after calling `AnimationController.update(dtMs)` the `flapTimer` shall be `≤ 0` and `frameIndex` shall be `0` (returned to Idle).

**Validates: Requirements 15.1, 15.2, 15.3**

---

### Property 33: Theme selection by score

*For any* non-negative integer score `S`, `BackgroundTheme.getTheme(S)` shall return the theme whose milestone score is the largest value `≤ S` in the theme table. Formally, if the four milestones are `[0, 10, 25, 50]` and corresponding theme indices are `[0, 1, 2, 3]`, then `getTheme(S)` shall return theme index `max { i : milestone[i] ≤ S }`.

Additionally, *for any* two RGB hex colors `A` and `B` and any progress `t ∈ [0, 1]`, `lerpColor(A, B, t)` shall produce a color whose red, green, and blue channels each equal `round(channelA + (channelB − channelA) × t)`, ensuring values stay in `[0, 255]`.

**Validates: Requirements 16.1, 16.2, 16.3**

---

### Property 34: Button hit detection correctness

*For any* canvas point `(px, py)` and any button bounding box `{ x, y, w, h }`, `InputHandler.hitTest(px, py, rect)` shall return `true` if and only if `px ≥ rect.x AND px ≤ rect.x + rect.w AND py ≥ rect.y AND py ≤ rect.y + rect.h`.

This property must hold for all boundary conditions: points exactly on the border edges, points one pixel inside, and points one pixel outside on all four sides.

**Validates: Requirements 17.1, 17.2**

---

### Property 35: Custom sprite load and persistence round-trip

*For any* valid image data URL `d` (representing an image whose encoded size is ≤ 512 KB), after `CharacterCustomizer.onFileSelected` successfully processes the file:
- `localStorage.getItem('flappyKiroCustomSprite')` shall equal `d`.
- `ghosty.customSprite` shall be `true`.

Subsequently, calling `CharacterCustomizer.init(ghosty)` on a fresh page load (simulated by reading the same localStorage) shall set `ghosty.sprite.src` to a value derived from `d`, restoring the custom character.

*For any* file whose size exceeds 512 KB, `onFileSelected` shall leave `ghosty.sprite` unchanged and `ghosty.customSprite` shall remain `false`.

**Validates: Requirements 18 (custom character upload and persistence)**

---

### Property 36: Audio toggle produces no-op behavior

*For any* `AudioManager` method `m` in `{ flap, score, gameOver, startMusic, resumeMusic }`, when `gameState.audioEnabled === false`, invoking `m()` shall not call `.play()` on any `HTMLAudioElement` instance. The method shall return without side effects.

Additionally, toggling `audioEnabled` twice (false → true → false, or true → false → true) shall return `audioEnabled` to its original value, confirming the toggle is a pure boolean inversion.

**Validates: Requirements 17.2 (sound toggle), 14.1–14.9 (audio no-op when disabled)**

---

### Property 32: Sprite animation frame selection

*For any* `AnimationController` state with `frameIndex` ∈ {0, 1, 2}, `getSourceRect()` shall return `{ sx: frameIndex * 32, sy: 0, sw: 32, sh: 32 }`. After `triggerFlap()` is called, the flap frame (index 1) shall revert to idle (index 0) after exactly `FLAP_FRAME_HOLD_MS` ms of accumulated `update(dtMs)` calls. `triggerDeath()` shall lock `frameIndex` at 2 and `update()` shall not change it until `reset()` is called.

**Validates: Sprite animation feature**

---

### Property 33: Background theme index is monotonically non-decreasing per session

*For any* sequence of score values `S0, S1, S2, …` (where `Si ≤ Si+1` — score never decreases in a session), `BackgroundTheme.currentThemeIdx` shall never decrease. It shall equal the index of the highest-threshold theme whose `score` field ≤ the current score.

**Validates: Background milestone feature**

---

### Property 34: Background transition progress is bounded in [0, 1]

*For any* elapsed time `t ≥ 0` ms since a theme transition started, `themeTransition.progress` shall equal `min(t / BG_TRANSITION_FRAMES × FRAME_MS, 1.0)` and shall always be in `[0.0, 1.0]`.

**Validates: Background transition feature**

---

### Property 35: Audio preference round-trip

*For any* boolean value `enabled`, calling `saveAudioEnabled(enabled)` followed by `loadAudioEnabled()` shall return `enabled`. If localStorage is unavailable, `loadAudioEnabled()` shall return `true` (default on).

**Validates: Sound toggle persistence**

---

### Property 36: Custom sprite bypasses AnimationController frame selection

When `ghosty.customSprite === true`, `drawGhosty` shall call `drawImage` with source rect `(0, 0, ghosty.sprite.width, ghosty.sprite.height)` — the full image — regardless of `AnimationController.frameIndex`. Tilt rotation and invincibility flash (`ghosty.visible`) still apply.

**Validates: Custom character upload feature**

---

### Property 37: Button hit regions are accurate

*For any* canvas point `(px, py)` that lies within the visual bounding box of `BTN_PLAY`, `BTN_SOUND`, or `BTN_UPLOAD`, `InputHandler.hitTest(px, py, btn)` shall return `true`. *For any* point outside all button bounds, the function shall return `false`.

**Validates: Start screen interactive buttons**

---

### Property 38: Pipe colors match the active background theme

*For any* active `BackgroundTheme` with theme index `i`, `drawPipes` shall use `PIPE_THEMES[BG_THEMES[i].label].body` as `fillStyle` for pipe bodies and `PIPE_THEMES[BG_THEMES[i].label].cap` for pipe caps. During a theme transition, colors shall be linearly interpolated between the outgoing and incoming theme values.

**Validates: Theme-aware pipe colors**
