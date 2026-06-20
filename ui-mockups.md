# UI Mockups — Flappy Kiro

Canvas dimensions: **480 × 640 px**. All coordinates are canvas-relative (origin top-left).
The Score Bar occupies the bottom 40 px (y = 600–640). Playfield is y = 0–600.

---

## 1. Main Menu / Start Screen (`IDLE` state)

```
┌─────────────────────────────────────┐  y=0
│                                     │
│         ·  ·  ·  ·  ·  ·  ·        │  ← far parallax clouds (opacity 0.4)
│    ·  ·  ·  ·  ·  ·  ·  ·  ·  ·    │  ← near parallax clouds (opacity 0.65)
│                                     │
│                                     │
│           ┌──────────┐              │  y=200
│           │  👻 Ghosty│              │  ← Ghosty sprite, centered x, y=200
│           └──────────┘              │
│                                     │
│       F L A P P Y  K I R O          │  y=300, 28px bold white, shadow
│                                     │
│    ── Press Space or Tap to ──       │  y=360, 16px white
│    ────────  Start  ─────────        │  y=385, 18px bold white (pulses)
│                                     │
│         Best: 42                    │  y=440, 14px white, centered
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤  y=600
│  Score: 0          High: 42         │  ← Score Bar (dark bg, 40px tall)
└─────────────────────────────────────┘  y=640
```

### Elements

| Element | Position | Style |
|---|---|---|
| Background | full canvas | `#87CEEB` sky blue |
| Parallax clouds | scrolling, 2 layers | white ellipses, opacity 0.4 / 0.65 |
| Ghosty sprite | x=216, y=200 (centered) | 48×48 px, Idle frame, gentle bob animation (±4px, 1.5s cycle) |
| Title text | x=240 (center), y=305 | `28px bold "Press Start 2P", #FFFFFF`, 2px black shadow |
| Start prompt line 1 | x=240, y=365 | `14px "Press Start 2P", #FFFFFF`, centered |
| Start prompt line 2 | x=240, y=388 | `16px bold "Press Start 2P", #FFFFFF`, pulses opacity 0.5→1.0 every 800ms |
| Best score | x=240, y=445 | `13px "Press Start 2P", #EEEEEE`, centered, format: `Best: X` |
| Score Bar | y=600, full width | `rgba(0,0,0,0.75)`, 40px tall |
| Score Bar text | left: x=16, right: x=464 | `14px "Press Start 2P", #FFFFFF` |

**Note:** No "Play" or "High Scores" buttons — input is a single tap/click/space anywhere, matching requirements. A dedicated button layout would require pointer hit-testing which is out of scope for this design.

---

## 2. In-Game HUD (`PLAYING` state)

```
┌─────────────────────────────────────┐  y=0
│  [score popup: +1]                  │  ← floats upward, fades out over 600ms
│                                     │
│   ·  ·  ·                           │  ← parallax clouds (always scrolling)
│                                     │
│        ████████                     │  ← top pipe (green)
│        ██CAP███                     │  ← pipe cap/rim (darker green)
│                                     │
│           👻~~~~                    │  ← Ghosty + particle trail
│                                     │
│        ███CAP███                    │  ← pipe cap/rim
│        ████████                     │  ← bottom pipe
│                                     │
│                                     │
├─────────────────────────────────────┤  y=600
│  Score: 7   Speed: 2.2   High: 42   │
└─────────────────────────────────────┘  y=640
```

### Score Bar Layout

```
┌──────────────────────────────────────────────────┐
│  Score: 7          Speed: 2.2          High: 42  │
└──────────────────────────────────────────────────┘
  x=16               x=240 (center)        x=464 (right-align)
```

| Element | Position | Style |
|---|---|---|
| Score | x=16, y=626 | `14px "Press Start 2P", #FFFFFF`, left-aligned |
| Speed | x=240, y=626 | `14px "Press Start 2P", #FFEE88`, center-aligned |
| High score | x=464, y=626 | `14px "Press Start 2P", #FFFFFF`, right-aligned |
| Score Bar bg | y=600, w=480, h=40 | `rgba(0,0,0,0.75)` |

### Score Popup

| Property | Value |
|---|---|
| Text | `+1` |
| Font | `bold 16px "Press Start 2P"` |
| Fill | `#FFFFFF` |
| Stroke | `#000000`, 2px |
| Spawn position | Ghosty center (x, y) |
| Animation | rises 40px, fades opacity 1→0 over 600ms |
| Draw order | above particle trail, below Score Bar |

---

## 3. Pause Overlay (`PAUSED` state)

```
┌─────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← semi-transparent dark overlay (65% opacity)
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│    covers full playfield (y=0 to y=600)
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░                            │
│░░░░░░░░░     P A U S E D            │  y=290, 24px bold white, centered
│░░░░░░░░░                            │
│░░░░░░░░░  Press P or Esc to Resume  │  y=330, 13px white, centered
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
├─────────────────────────────────────┤  y=600
│  Score: 7          High: 42         │  ← Score Bar still visible
└─────────────────────────────────────┘
```

| Element | Position | Style |
|---|---|---|
| Overlay | full canvas | `rgba(0,0,0,0.65)` |
| "PAUSED" | x=240, y=295 | `24px bold "Press Start 2P", #FFFFFF`, centered |
| Resume prompt | x=240, y=335 | `12px "Press Start 2P", #CCCCCC`, centered |
| Score Bar | y=600 | unchanged, always visible |

---

## 4. Game Over Screen (`GAME_OVER` state)

```
┌─────────────────────────────────────┐
│                                     │
│   ·  ·  ·  ·                        │  ← clouds still render (no scrolling)
│                                     │
│           ┌──────────┐              │
│           │  😵 Ghosty│              │  ← Death frame, no tilt, at final position
│           └──────────┘              │
│                                     │
│         G A M E  O V E R            │  y=290, 26px bold, #FF4444, centered
│                                     │
│          Score:  7                  │  y=335, 18px white, centered
│         Best: 42                    │  y=360, 14px #FFEE88, centered
│   ★ New Best! (if new high score)   │  y=382, 13px #FFDD00, centered, only shown if new record
│                                     │
│   ── Press Space or Tap to ──        │  y=430, 13px white
│   ────────  Restart  ──────          │  y=452, 16px bold white (pulses)
│                                     │
├─────────────────────────────────────┤  y=600
│  Score: 7          High: 42         │
└─────────────────────────────────────┘
```

| Element | Position | Style |
|---|---|---|
| Background | full canvas | `#87CEEB` sky blue (same as always) |
| Ghosty (death frame) | final collision position | Death sprite frame, tilt=0, no bob |
| "GAME OVER" | x=240, y=295 | `26px bold "Press Start 2P", #FF4444`, centered, 2px `#880000` shadow |
| Final score | x=240, y=340 | `18px "Press Start 2P", #FFFFFF`, centered, format `Score: X` |
| High score | x=240, y=365 | `14px "Press Start 2P", #FFEE88`, centered, format `Best: X` |
| New record badge | x=240, y=387 | `12px "Press Start 2P", #FFDD00`, centered, `★ New Best!`, only when score > previous high |
| Restart prompt line 1 | x=240, y=433 | `12px "Press Start 2P", #EEEEEE`, centered |
| Restart prompt line 2 | x=240, y=455 | `15px bold "Press Start 2P", #FFFFFF`, pulses opacity 0.5→1.0 every 800ms |
| Score Bar | y=600 | unchanged |

---

## Font

All text uses `"Press Start 2P"` (retro pixel font) loaded from Google Fonts, or falls back to `monospace`. Load via `<link>` in `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
```

If the font fails to load (offline play), `monospace` fallback preserves readability.

---

## Pulsing Animation

The start/restart prompts pulse using a sine-driven opacity:

```js
const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
ctx.globalAlpha = pulse;
// draw prompt text
ctx.globalAlpha = 1;
```

This runs during `IDLE` and `GAME_OVER` renders without any additional state.
