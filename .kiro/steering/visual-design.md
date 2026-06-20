# Visual Design Guidelines — Flappy Kiro

## Design Philosophy

Retro pixel-art aesthetic with modern polish. Every visual element serves gameplay
readability first, decoration second. The game should feel alive through animation,
particle effects, and environmental storytelling (background themes).

---

## Sprite Rendering

### Sprite Sheet Layout

`assets/ghosty.png` — 96×32px, 3 frames horizontal, no padding.

```
┌──────────┬──────────┬──────────┐
│ Frame 0  │ Frame 1  │ Frame 2  │
│  IDLE    │  FLAP    │  DEATH   │
│  0,0     │  32,0    │  64,0    │
└──────────┴──────────┴──────────┘
```

Source frame size: 32×32px. Rendered size: 48×48px (1.5× scale).

### drawImage Source Rect Pattern

Always use the 9-argument form of `drawImage` for sprite sheets:

```js
ctx.drawImage(
  spriteSheet,
  sx, sy, sw, sh,   // source rect (frame on sheet)
  dx, dy, dw, dh    // destination rect (canvas position + render size)
);
```

### Custom Character Upload

When a user uploads a custom character, treat it as a single-frame sprite:

```js
ctx.drawImage(ghosty.sprite, 0, 0, ghosty.sprite.width, ghosty.sprite.height,
              dx, dy, ghosty.width, ghosty.height);
```

`AnimationSystem` is bypassed when `ghosty.isCustomSprite === true`.
Tilt and invincibility flash still apply.

---

## Animation System

### Ghosty Animation States

| State | Frame | Duration | Trigger |
|---|---|---|---|
| Idle | 0 | Held until flap | Default / falling |
| Flap | 1 | 80ms then reverts | On flap input |
| Death | 2 | Held | On GAME_OVER |

### Idle Bob Animation (IDLE game state only)

```js
const bobOffset = Math.sin(Date.now() / 400) * 4;  // ±4px, ~1.6s cycle
ghosty.renderY = ghosty.y + bobOffset;              // render only, not ghosty.y
```

`ghosty.y` is never modified by the bob.

### Flap Frame Hold

80ms time-based hold, consistent at any frame rate.

### Death Frame

On `GAME_OVER`: switch to frame 2, remove tilt (`ghosty.tilt = 0`), hold until `resetSession()`.

---

## Background Themes & Transitions

### Theme Definitions

| Milestone | Theme | Sky Top | Sky Bottom | Pipe Tint |
|---|---|---|---|---|
| Score 0 | Day | `#87CEEB` | `#B0E2FF` | `#4caf50` / `#388e3c` |
| Score 10 | Sunset | `#FF6B35` | `#FFB347` | `#8B4513` / `#6B3410` |
| Score 25 | Night | `#0D0D2B` | `#191970` | `#2E4057` / `#1A2A3A` |
| Score 50 | Dawn | `#FF6B9D` | `#C8A2C8` | `#7B2D8B` / `#5A1F6A` |
| Score 75 | Storm | `#2C3E50` | `#00CED1` | `#1B6CA8` / `#145280` |

### Sky Gradient Rendering

Cache the gradient object and only recreate it when the theme changes:

```js
if (BackgroundSystem.themeChanged) {
  _skyGradient = ctx.createLinearGradient(0, 0, 0, canvasH - SCORE_BAR_H);
  _skyGradient.addColorStop(0, currentTheme.skyTop);
  _skyGradient.addColorStop(1, currentTheme.skyBottom);
  BackgroundSystem.themeChanged = false;
}
ctx.fillStyle = _skyGradient;
ctx.fillRect(0, 0, canvasW, canvasH - SCORE_BAR_H);
```

During transitions, lerp the color stops between themes using `lerpColor`.

### Theme Transition Toast

Display a label for 1500ms when a milestone is crossed:

```js
const ThemeToast = {
  text: '', age: 0, lifetime: 1500,
  show(label) { this.text = label; this.age = 0; },
  update(dtMs) { this.age = Math.min(this.age + dtMs, this.lifetime); },
  draw(ctx, canvasW) {
    if (this.age >= this.lifetime) return;
    const t = this.age / this.lifetime;
    const opacity = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(canvasW / 2 - 80, 12, 160, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, canvasW / 2, 33);
    ctx.globalAlpha = 1;
  },
};
```

---

## Parallax Cloud Layers

```js
const ParallaxSystem = {
  layers: [
    { speed: 0.6, alpha: 0.4,  clouds: [] },  // far
    { speed: 1.2, alpha: 0.65, clouds: [] },  // near
  ],
};
```

Each cloud: `{ x, y, rx, ry }`. Draw as overlapping ellipses for a fluffy look.
Layer speeds are fixed constants, independent of pipe scroll speed.

---

## Particle Trail

3 particles per frame from Ghosty's trailing (left) edge:

```js
const emitX = ghosty.x;
const emitY = ghosty.y + ghosty.height / 2;
```

| Property | Value |
|---|---|
| Color | `'#FFFFFF'` or `'#ADD8E6'` (random) |
| Radius | 2–5 px (random) |
| Initial opacity | 0.6 |
| Lifetime | 300ms |
| Direction | Leftward ±45° |
| Speed | 1 px/frame |

Batch all particles under one `ctx.globalAlpha` block — don't set per particle.
Group by color to reduce `fillStyle` switches.

---

## Screen Shake

Applied as a canvas transform before any drawing:

```js
function applyScreenShake(ctx, timestamp) {
  if (!gameState.shaking) return;
  const elapsed = timestamp - gameState.shakeStart;
  if (elapsed >= SHAKE_DURATION) { gameState.shaking = false; return; }
  const factor = 1 - elapsed / SHAKE_DURATION;
  _shakeDx = (Math.random() * 2 - 1) * SHAKE_MAX * factor;
  _shakeDy = (Math.random() * 2 - 1) * SHAKE_MAX * factor;
  ctx.translate(_shakeDx, _shakeDy);
}
```

`ctx.save()` before shake, `ctx.restore()` after full scene.

---

## Pipe Visual Design

Pipe colors are theme-aware:

```js
const PIPE_THEMES = {
  'Day':    { body: '#4caf50', cap: '#388e3c' },
  'Sunset': { body: '#8B4513', cap: '#6B3410' },
  'Night':  { body: '#2E4057', cap: '#1A2A3A' },
  'Dawn':   { body: '#7B2D8B', cap: '#5A1F6A' },
  'Storm':  { body: '#1B6CA8', cap: '#145280' },
};
```

Cap overhangs pipe body by `PIPE_CAP_OVERHANG` (4px) on each side.

---

## HUD Visual Patterns

### Start Screen Buttons

| Button | Size | Color |
|---|---|---|
| PLAY | 160×44px | `#4CAF50` (green) |
| Sound ON/OFF | 160×36px | `#555555` (dark grey) |
| Upload Character | 200×32px | `#2196F3` (blue) |

```js
function drawButton(ctx, rect, label, bgColor, textColor = '#FFFFFF') {
  ctx.fillStyle = bgColor;
  _roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.font = '11px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
}
```

### Score Popup

Font: `bold 16px "Press Start 2P"`. Always stroke before fill:

```js
ctx.strokeStyle = '#000000';
ctx.lineWidth = 2;
ctx.strokeText('+1', popup.x, popup.y);
ctx.fillStyle = '#FFFFFF';
ctx.fillText('+1', popup.x, popup.y);
```

### Score Bar

Height: 40px, bottom of canvas. `rgba(0,0,0,0.75)` background.
Layout: `Score` left | `Speed` center (yellow `#FFEE88`) | `High` right.

---

## Draw Order (Full Frame)

```
ctx.save()                          ← screen shake outer transform
  1. BackgroundSystem.draw()        ← sky gradient
  2. ParallaxSystem.draw()          ← far clouds, then near clouds
  3. drawPipes()                    ← pipes (body + cap, batched by color)
  4. drawGhosty()                   ← sprite with tilt + animation frame
  5. ParticleSystem.draw()          ← particle trail
ctx.restore()                       ← end screen shake

  6. HUD.drawScoreBar()             ← score bar (outside shake)
  7. HUD.drawPopups()               ← score popups
  8. ThemeToast.draw()              ← milestone label (if active)
  9. overlay (phase-dependent):
       IDLE      → drawStartOverlay()
       PAUSED    → drawPauseOverlay()
       GAME_OVER → drawGameOverOverlay()
```

Score bar and overlays are drawn **outside** the shake `save/restore` — UI chrome never shifts.

---

## Font Stack

```
'Press Start 2P', monospace
```

Load from Google Fonts. `monospace` fallback preserves layout.

---

## Accessibility

- All buttons: ≥4.5:1 contrast ratio.
- Sound state shown as text (`SFX ON` / `SFX OFF`), not just an icon.
- Instructions describe all control methods (Space, click, tap).
- Custom upload accepts PNG, JPG, GIF, WebP.
