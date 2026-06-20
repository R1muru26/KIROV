# Flappy Kiro Domain Knowledge

## Game Identity

Flappy Kiro is a single-session, skill-based endless runner. No level progression,
no save states, no unlockables — only the score. Design decisions: keep retry instant,
make feedback crisp, make difficulty feel earned (gradual speed ramp, not sudden jumps).

---

## Game State Machine

```
IDLE ──────────────────────────────► PLAYING
 ▲        (Space / click / tap)         │  ▲
 │                              P/Esc   │  │ P/Esc
 │                         ┌────────────▼──┴───┐
 │                         │      PAUSED        │
 │                         └────────────────────┘
 │                                    │
 │                         collision + invincibility expires
 │                                    ▼
 │        (Space / click / tap)    GAME_OVER
 └────────────────────────────────────┘
```

### Phase Responsibilities

| Phase | Physics | Scrolling | Collision | Parallax | Rendering |
|---|---|---|---|---|---|
| IDLE | ✗ | ✗ | ✗ | ✓ | ✓ |
| PLAYING | ✓ | ✓ | ✓ | ✓ | ✓ |
| PAUSED | ✗ | ✗ | ✗ | ✗ | ✓ (static) |
| GAME_OVER | ✗ | ✗ | ✗ | ✓ | ✓ |

### State Transitions — Side Effects

**IDLE → PLAYING**: hide start overlay, start music, begin pipe spawning, reset BackgroundSystem.

**PLAYING → PAUSED**: suspend all updates, pause music, show pause overlay.

**PAUSED → PLAYING**: resume updates, resume music, hide pause overlay.

**PLAYING → GAME_OVER**: stop music, play `game_over.wav`, screen shake, clear particles,
`AnimationSystem.triggerDeath()`, update + save high score if `score > highScore`.

**GAME_OVER → PLAYING**: call `resetSession()`, restart music, hide game over overlay.

### Input Routing by Phase

| Input | IDLE | PLAYING | PAUSED | GAME_OVER |
|---|---|---|---|---|
| Space / click / tap | → PLAYING | flap | no-op | → PLAYING (reset) |
| P / Escape | no-op | → PAUSED | → PLAYING | no-op |
| Start button click | → PLAYING | — | — | — |
| Sound toggle click | toggle sfx | — | — | — |
| Upload button click | open file picker | — | — | — |

---

## Start Screen — Interactive Elements

### Button: PLAY

```js
if (pointInRect(clickX, clickY, BTN_PLAY)) { handleFlap(); }
```

### Button: Sound ON/OFF

Toggles `gameState.sfxEnabled`. Persisted to `localStorage` key `'flappyKiroSfx'`.

```js
function loadSfxPref() {
  try { return localStorage.getItem('flappyKiroSfx') !== 'false'; } catch { return true; }
}
```

All `AudioManager` play methods check `gameState.sfxEnabled` before playing.
Label alternates: `'SFX ON'` or `'SFX OFF'`.

### Button: Upload Custom Character

Hidden `<input type="file">` element in DOM, triggered via `.click()`.
Custom sprite is session-only — not persisted to localStorage (binary data too large).

```js
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => { ghosty.sprite = img; ghosty.isCustomSprite = true; };
    img.onerror = () => console.warn('Custom sprite load failed');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  fileInput.value = '';  // reset so same file can be re-selected
});
```

---

## Start Screen — Instructions

```
┌─────────────────────────────────────────┐
│           FLAPPY KIRO                   │
│         👻 (bob animation)              │
│  HOW TO PLAY                            │
│  • Press SPACE or tap to flap           │
│  • Fly through the gaps                 │
│  • Don't hit the walls or edges         │
│  • Score increases each pipe you pass   │
│  • Press P to pause                     │
│         [ ▶  PLAY ]                     │
│         [ 🔊 SFX ON ]                   │
│         [ 📁 Upload Character ]         │
│            Best: 42                     │
└─────────────────────────────────────────┘
```

Rendered as static `fillText` lines in `drawStartOverlay()`.

---

## Background Milestone Progression

```js
const BG_THEMES = [
  { score: 0,  skyTop: '#87CEEB', skyBot: '#B0E2FF', label: '☀ Day'    },
  { score: 10, skyTop: '#FF6B35', skyBot: '#FFB347', label: '🌅 Sunset' },
  { score: 25, skyTop: '#0D0D2B', skyBot: '#191970', label: '🌙 Night'  },
  { score: 50, skyTop: '#FF6B9D', skyBot: '#C8A2C8', label: '🌸 Dawn'   },
  { score: 75, skyTop: '#2C3E50', skyBot: '#00CED1', label: '⛈ Storm'  },
];
```

`BackgroundSystem.update(score)` checks milestones every frame during PLAYING.
Transition cross-fades over `BG_TRANSITION_MS` (1500ms) using `lerpColor`.
`reset()` restores `currentThemeIdx = 0` and clears any active transition.

---

## Obstacle Generation Rules

Gap height is fixed at `PIPE_GAP` (150px). Difficulty comes from speed, not narrowing gaps.
Gap position uniformly random in safe zone: `[50, canvasH - SCORE_BAR_H - 50 - PIPE_GAP]`.
Spawn cadence: one pipe per `SPAWN_INTERVAL` (150px) scrolled, using subtraction remainder.

---

## Difficulty Progression

Speed is the sole difficulty axis.

```
Speed = min(2 + floor(score / 5) * 0.2, 6)
```

| Score | Speed | Notes |
|---|---|---|
| 0 | 2.0 | Tutorial pace |
| 10 | 2.4 | Sunset theme |
| 25 | 3.0 | Night theme |
| 50 | 4.0 | Dawn theme |
| 75 | 5.0 | Storm theme |
| 100 | 6.0 | Speed cap |

---

## High Score System

Key: `'flappyKiroHighScore'` (string int, default `'0'`).
Updated only on `PLAYING → GAME_OVER` when `score > highScore`. Never decreased.
Displayed: start screen (`Best: X`), score bar (`High: X`), game over (`★ New Best!` if new record).

---

## Session Lifecycle

```
Page load → loadHighScore() → loadSfxPref() → preload assets → phase = IDLE
IDLE → PLAYING → resetSession() → startMusic()
PLAYING → GAME_OVER → onGameOver() → stopMusic()
GAME_OVER → PLAYING → resetSession() → startMusic()
```

`resetSession()` is always called before entering PLAYING.

---

## Collision Response Sequence

1. `CollisionDetector.check()` returns `true`
2. Guard: if `gameState.isInvincible`, skip
3. Begin invincibility: set flag, record timestamp, begin flash + screen shake
4. Grace period (500ms): physics continues, Ghosty flashes
5. At expiry: if still colliding → `GAME_OVER`; if clear → resume normal play

---

## Pause Behaviour Rules

Pause only available during PLAYING. Timestamp-based timers offset by pause duration on resume:

```js
function onResume(pauseDuration) {
  if (gameState.invincibilityStart !== null) gameState.invincibilityStart += pauseDuration;
  if (gameState.shakeStart !== null)         gameState.shakeStart += pauseDuration;
}
```

---

## localStorage Keys Summary

| Key | Type | Default | Purpose |
|---|---|---|---|
| `flappyKiroHighScore` | string (int) | `'0'` | Persisted best score |
| `flappyKiroSfx` | string (bool) | `'true'` | Sound effects on/off |

Both read at page load, written only when value changes.
