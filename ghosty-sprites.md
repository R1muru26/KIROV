# Ghosty Sprite Specifications

## Source File

`assets/ghosty.png` — single sprite sheet containing all animation frames.

---

## Sprite Sheet Layout

- **Frame size:** 32 × 32 px per frame
- **Sheet dimensions:** 96 × 32 px (3 frames across, 1 row)
- **Format:** PNG with transparency (alpha channel required)

```
┌──────────┬──────────┬──────────┐
│  Frame 0 │  Frame 1 │  Frame 2 │
│   IDLE   │   FLAP   │   DEATH  │
│  (32×32) │  (32×32) │  (32×32) │
└──────────┴──────────┴──────────┘
  x=0        x=32       x=64
```

---

## Animation States

### Frame 0 — Idle

- **Sheet offset:** x=0, y=0
- **Usage:** displayed while `Game_State` is `IDLE` and during normal falling in `PLAYING` state
- **Description:** Ghosty in neutral floating pose, eyes open, body relaxed
- **Loop:** static (single frame held)

### Frame 1 — Flap

- **Sheet offset:** x=32, y=0
- **Usage:** displayed for 80 ms after a flap input is received, then returns to Idle frame
- **Description:** Ghosty with wings/arms raised upward, slight upward body arc, excited expression
- **Loop:** single flash (show for 1 frame duration ≈ 80 ms, then revert)

### Frame 2 — Death

- **Sheet offset:** x=64, y=0
- **Usage:** displayed when `Game_State` transitions to `GAME_OVER`; tilt rotation is removed (sprite held flat)
- **Description:** Ghosty with X eyes, body drooping, frowning expression
- **Loop:** static (held until game restarts)

---

## Hitbox

- **Shape:** circle
- **Radius:** 12 px
- **Center:** sprite center (16, 16) relative to the frame's top-left corner
- **Formula:** `r = HITBOX_RADIUS_FACTOR × min(width, height) / 2 = 0.4 × 16 = 6.4 px`

> **Note:** The formula-derived radius at 32×32 is 6.4 px. The designer target of 12 px corresponds to a `HITBOX_RADIUS_FACTOR` of ~0.75. Confirm which value to use before implementation:
> - **6.4 px** — tighter, more forgiving (design default, factor=0.4)
> - **12 px** — larger, less forgiving (designer intent, factor=0.75)
>
> Update `HITBOX_RADIUS_FACTOR` in `game-config.json` accordingly.

---

## Render Size

Ghosty is rendered at **48 × 48 px** on canvas (scaled up 1.5× from the 32 × 32 source for visibility). The hitbox circle is computed from the **rendered** dimensions, not the source sheet dimensions.

At render size 48×48:
- Default (factor=0.4): `r = 0.4 × 24 = 9.6 px`
- Designer target (factor=0.75): `r = 0.75 × 24 = 18 px`

---

## Tilt Behavior

- Tilt is applied via `ctx.rotate()` centered on the sprite's render midpoint.
- Range: −30° (nose up, on flap) → 90° (nose down, terminal fall)
- Frame selection is independent of tilt — tilt is a continuous rotation, not a separate sprite.
- In `GAME_OVER` state, tilt is reset to 0° and the Death frame is held.

---

## Invincibility Flash

During the 500 ms invincibility period after a collision:
- Ghosty alternates between **visible** and **invisible** every 100 ms (5 cycles).
- This is achieved by toggling `ghosty.visible` — no separate sprite frame is needed.
- The current animation frame (Idle or Flap) is preserved during flashing.

---

## Color Palette (reference for artist)

| Element        | Color       | Notes                        |
|----------------|-------------|------------------------------|
| Body           | `#F0F0F0`   | Near-white, semi-translucent |
| Eyes           | `#222222`   | Dark pupils                  |
| Cheeks (idle)  | `#FFAAAA`   | Soft pink blush              |
| X eyes (death) | `#CC2222`   | Red X marks                  |
| Outline        | `#888888`   | Thin 1px border              |

---

## File Delivery Checklist

- [ ] `assets/ghosty.png` — 96×32 px sprite sheet, 3 frames, transparent background
- [ ] Frames ordered left-to-right: Idle (0), Flap (1), Death (2)
- [ ] No padding between frames
- [ ] Exported at 1× pixel density (no @2x — canvas handles scaling)
