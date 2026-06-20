# Game Coding Standards — Flappy Kiro

## Overview

Flappy Kiro is a single-file HTML5 Canvas game. All code lives in one `<script>` block inside `index.html`. These standards govern how that code is written, organised, and maintained.

---

## File & Module Structure

The script block is divided into clearly labelled sections, in this order:

```
1. Constants
2. Asset preloading (images, audio)
3. Object pools (pipe pool, particle pool)
4. Subsystem objects (PhysicsEngine, Scroller, CollisionDetector, …)
5. GameState object
6. Game logic functions (handleFlap, handleCollision, checkScoring, resetSession)
7. Render functions (render, drawGhosty, drawPipes, …)
8. InputHandler registration
9. GameLoop bootstrap (requestAnimationFrame)
```

Each section is separated by a comment banner:

```js
// ── SECTION NAME ──────────────────────────────────────────────────────────
```

---

## Naming Conventions

| Concept | Convention | Example |
|---|---|---|
| Constants | `SCREAMING_SNAKE_CASE` | `GRAVITY`, `PIPE_POOL_SIZE` |
| Subsystem objects | `PascalCase` | `PhysicsEngine`, `AudioManager` |
| Plain functions | `camelCase` | `handleFlap()`, `resetSession()` |
| Private helpers | `_camelCase` | `_acquireParticle()` |
| Game state fields | `camelCase` | `gameState.phase`, `ghosty.vy` |
| Pool objects | `camelCase + Pool` | `pipePool`, `particlePool` |
| Boolean flags | `is` / `has` / `can` prefix | `isInvincible`, `hasScored` |
| Event callbacks | `on` prefix | `onFlap`, `onPause` |

---

## Subsystem Object Pattern

Each subsystem is a plain object literal with named methods. No classes, no `new`, no prototype chains.

```js
const PhysicsEngine = {
  update(ghosty) { /* ... */ },
  flap(ghosty)   { /* ... */ },
  tiltAngle(vy)  { /* ... */ },
};
```

Subsystems do not hold references to each other — they receive what they need as arguments. The game loop is the only coordinator.

---

## Constants Block

All magic numbers live in the Constants section at the top. No literal values anywhere else.

```js
// BAD
ghosty.vy = Math.min(ghosty.vy, 12);

// GOOD
ghosty.vy = Math.min(ghosty.vy, TERMINAL_VELOCITY);
```

When adding a new tunable value, add it to `game-config.json` AND the Constants block simultaneously.

---

## Game Loop Structure

```js
function tick(timestamp) {
  // 1. Update phase (PLAYING only)
  if (gameState.phase === 'PLAYING') {
    PhysicsEngine.update(ghosty);
    Scroller.update(gameState.score);
    ParticleSystem.emit(ghosty.cx, ghosty.cy, PARTICLE_RATE);
    ParticleSystem.update(FRAME_MS);
    AnimationSystem.update(FRAME_MS);          // sprite frame advancement
    HUD.updatePopups(FRAME_MS);
    const hit = CollisionDetector.check(ghosty, pipePool, groundY);
    handleCollision(hit);
    checkScoring();
    updateScreenShake(timestamp);
  }

  // 2. Background update (all states)
  BackgroundSystem.update(gameState.score);   // milestone transitions
  ParallaxSystem.update();

  // 3. Render (always)
  render(ctx, timestamp);

  requestAnimationFrame(tick);
}
```

Rules:
- Update before render, always.
- Never skip `requestAnimationFrame` — always re-queue regardless of state.
- Never call `render` from inside an update function.
- Never call update functions from inside `render`.

---

## Memory Management

### Object Pools

All objects created repeatedly during gameplay must use pools:

```js
// POOL PATTERN — acquire / release, never new
function acquirePipe() {
  for (let i = 0; i < PIPE_POOL_SIZE; i++) {
    if (!pipePool[i].active) return pipePool[i];
  }
  return null; // pool exhausted — log warning, skip spawn
}

function releasePipe(pipe) {
  pipe.active = false;
}
```

Never use `Array.push` / `Array.splice` / `Array.filter` on hot-path arrays during gameplay.

### No Per-Frame Allocations

Inside `tick()` and all functions it calls:
- No `{}` or `[]` literals
- No `new` keyword
- No `Array.map`, `Array.filter`, `Array.reduce`
- No string concatenation (use template literals only for debug/HUD format functions called outside the loop)
- Pre-declare working variables at module scope:

```js
// Declared once at top of script, reused every frame
let _shakeDx = 0, _shakeDy = 0;
let _tiltAngle = 0;
let _hitCx = 0, _hitCy = 0, _hitR = 0;
```

---

## Canvas API Patterns

### State Save/Restore

`ctx.save()` / `ctx.restore()` are expensive. Use them **only** for Ghosty's tilt transform and screen shake outer transform. Everything else uses direct property assignment.

```js
// CORRECT — one save/restore for Ghosty
ctx.save();
ctx.translate(cx, cy);
ctx.rotate(tiltRad);
ctx.drawImage(sprite, -hw, -hh, w, h);
ctx.restore();

// WRONG — unnecessary save/restore for a fillRect
ctx.save();
ctx.fillStyle = PIPE_COLOR;
ctx.fillRect(x, y, w, h);
ctx.restore();
```

### fillStyle Batching

Group all `fillRect` calls that share the same `fillStyle`. Minimise `fillStyle` assignments per frame:

```js
// Draw all pipe bodies first (one fillStyle assignment)
ctx.fillStyle = PIPE_COLOR;
for (let i = 0; i < PIPE_POOL_SIZE; i++) {
  if (!pipePool[i].active) continue;
  const p = pipePool[i];
  ctx.fillRect(p.x, 0, p.width, p.gapTop);
  ctx.fillRect(p.x, p.gapBottom, p.width, canvasH);
}

// Then draw all caps (one fillStyle assignment)
ctx.fillStyle = PIPE_CAP_COLOR;
for (let i = 0; i < PIPE_POOL_SIZE; i++) {
  if (!pipePool[i].active) continue;
  // ... cap rects
}
```

### Text Rendering

All HUD text uses `ctx.fillText` with `ctx.textAlign` set once before a group of related text draws. Never set `textAlign` per-character.

---

## Event Handling

All event listeners are registered once at startup in `InputHandler.init()`. No event listeners are added or removed during gameplay.

```js
const InputHandler = {
  init(canvas, { onFlap, onPause }) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space')                       onFlap();
      if (e.code === 'KeyP' || e.code === 'Escape') onPause();
    });
    canvas.addEventListener('click',      () => onFlap());
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onFlap(); });
  },
};
```

Button hit-testing (Start, Sound toggle, Upload) is handled inside the canvas `click` and
`touchstart` handlers using simple AABB point-in-rect checks against pre-declared button
bounds objects.

---

## Error Handling Conventions

- Audio play failures: caught via Promise `.catch`, logged via `console.warn`, never thrown.
- Asset load failures: `onerror` sets reference to `null`; all consumers null-check before use.
- localStorage failures: wrapped in `try/catch`; fallback to in-memory value.
- Pool exhaustion: log `console.warn('Pool exhausted: pipes')` and skip the operation — never throw.
- Custom character upload: validate `FileReader` result is a valid image before assigning to `ghosty.sprite`.

---

## Code Formatting

- 2-space indentation
- Single quotes for strings
- Semicolons required
- Max line length: 100 characters
- Functions longer than 30 lines should be split
- Comments on every constant and every non-obvious algorithm step
