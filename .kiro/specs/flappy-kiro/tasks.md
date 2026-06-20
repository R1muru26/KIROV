# Implementation Plan: Flappy Kiro

## Overview

Implement a single self-contained `index.html` file containing all JavaScript and CSS inline. The game uses HTML5 Canvas, Web Audio API, and localStorage — no build tools or external dependencies. Tasks are ordered so each step wires directly into the previous one, culminating in a fully playable game.

## Tasks

- [x] 1. Bootstrap the single-file scaffold and constants
  - Create `index.html` with `<style>`, `<canvas id="gameCanvas">`, and a `<script>` block
  - Define all game constants: `GRAVITY`, `FLAP_VELOCITY`, `TERMINAL_VELOCITY`, `BASELINE_SPEED`, `SPEED_CAP`, `PIPE_GAP`, `PIPE_WIDTH`, `FRAME_MS`, `SHAKE_DURATION`, `SHAKE_MAX`, `INVINCIBILITY_DURATION`, `SCORE_BAR_HEIGHT`, `HS_KEY`
  - Define the `gameState` object with fields: `phase`, `score`, `highScore`, `invincible`, `invincibilityStart`, `shaking`, `shakeStart`, `shakeMagnitude`
  - _Requirements: 1.1, 10.1_

- [x] 2. Implement localStorage persistence and high-score helpers
  - [x] 2.1 Implement `loadHighScore()` and `saveHighScore(value)` with try/catch guards
    - Read from `flappyKiroHighScore`, parse as integer with fallback 0; write as String
    - _Requirements: 6.1, 6.2_

  - [ ]* 2.2 Write property test for localStorage round-trip
    - **Property 20: localStorage round-trip for High_Score**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 2.3 Write property test for High_Score update on game over
    - **Property 18: High_Score updated when score exceeds stored value**
    - **Validates: Requirements 5.7, 6.2**

  - [ ]* 2.4 Write property test for High_Score unchanged when score does not exceed it
    - **Property 19: High_Score unchanged when score does not exceed it**
    - **Validates: Requirements 7.3**

- [x] 3. Implement PhysicsEngine
  - [x] 3.1 Implement `PhysicsEngine.update(ghosty)` — gravity accumulation, terminal velocity clamp, Euler y-integration, ceiling clamp
    - Apply `vy += GRAVITY`, clamp to `TERMINAL_VELOCITY`, update `y += vy`, clamp top edge to 0
    - _Requirements: 2.1, 2.3, 2.4, 2.6_

  - [ ]* 3.2 Write property test for gravity accumulation
    - **Property 1: Gravity accumulates velocity correctly**
    - **Validates: Requirements 2.1, 2.3**

  - [ ]* 3.3 Write property test for terminal velocity clamp
    - **Property 3: Terminal velocity clamp**
    - **Validates: Requirements 2.3**

  - [ ]* 3.4 Write property test for Euler position integration
    - **Property 4: Euler position integration**
    - **Validates: Requirements 2.4**

  - [x] 3.5 Implement `PhysicsEngine.flap(ghosty)` — set `vy` to `FLAP_VELOCITY` (−8)
    - _Requirements: 2.2_

  - [ ]* 3.6 Write property test for flap velocity
    - **Property 2: Flap always sets velocity to −8 regardless of prior state**
    - **Validates: Requirements 2.2**

  - [x] 3.7 Implement `PhysicsEngine.tiltAngle(vy)` — `clamp(atan2(vy, 4) * 180/π, −30, 90)`
    - _Requirements: 2.5_

  - [ ]* 3.8 Write property test for tilt angle formula
    - **Property 5: Tilt angle formula**
    - **Validates: Requirements 2.5**

- [x] 4. Implement CollisionDetector
  - [x] 4.1 Implement `CollisionDetector.insetHitbox(ghosty)` — inset by 20% each side
    - Return `{x: x+0.2w, y: y+0.2h, w: 0.6w, h: 0.6h}`
    - _Requirements: 4.2_

  - [ ]* 4.2 Write property test for inset hitbox dimensions
    - **Property 12: Inset hitbox dimensions**
    - **Validates: Requirements 4.2**

  - [x] 4.3 Implement `CollisionDetector.aabbOverlap(rectA, rectB)` — axis-aligned overlap check
    - _Requirements: 4.1_

  - [ ]* 4.4 Write property test for AABB overlap detection
    - **Property 11: AABB overlap detection is correct**
    - **Validates: Requirements 4.1**

  - [x] 4.5 Implement `CollisionDetector.checkPipes(hitbox, pipes)`, `CollisionDetector.checkBounds(hitbox, canvas, scoreBarH)`, and `CollisionDetector.check(ghosty, pipes, canvas, scoreBarH)`
    - _Requirements: 4.1, 4.3, 4.4_

- [x] 5. Checkpoint — Ensure all tests pass for pure logic modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Scroller
  - [x] 6.1 Implement `Scroller.getSpeed(score)` — pure formula: `min(BASELINE_SPEED + floor(score/5)*0.2, SPEED_CAP)`
    - _Requirements: 3.5, 12.2, 12.3, 12.4_

  - [ ]* 6.2 Write property test for scroll speed formula
    - **Property 8: Scroll speed formula**
    - **Validates: Requirements 3.5, 12.2, 12.3, 12.4**

  - [x] 6.3 Implement `Scroller.update(score)` — advance all pipes by current speed, spawn new Pipe_Pair when `distanceScrolled` crosses a 150 px multiple, remove off-screen pipes
    - _Requirements: 3.1, 3.4, 3.6_

  - [ ]* 6.4 Write property test for pipe movement per frame
    - **Property 9: Pipe movement per frame**
    - **Validates: Requirements 3.4**

  - [ ]* 6.5 Write property test for off-screen pipe removal
    - **Property 10: Off-screen pipes are removed**
    - **Validates: Requirements 3.6**

  - [x] 6.6 Implement pipe spawning with gap constraints: `gapTop ≥ 50`, `gapBottom ≤ canvasH − SCORE_BAR_HEIGHT − 50`, fixed gap height of 150 px
    - _Requirements: 3.2, 3.3_

  - [ ]* 6.7 Write property test for pipe gap constraints on spawn
    - **Property 6: Pipe gap constraints on spawn**
    - **Validates: Requirements 3.3**

  - [ ]* 6.8 Write property test for pipe gap height invariant
    - **Property 7: Pipe gap height is always 150 px**
    - **Validates: Requirements 3.2**

  - [x] 6.9 Implement `Scroller.reset()` — clear pipes, reset `distanceAccumulator`, reset speed to `BASELINE_SPEED`
    - _Requirements: 7.2, 12.5_

- [x] 7. Implement HUD format functions and scoring
  - [x] 7.1 Implement `formatScore(x)`, `formatHigh(x)`, `formatSpeed(spd)` pure string helpers
    - `"Score: " + x`, `"High: " + x`, `"Speed: " + spd.toFixed(1)`
    - _Requirements: 5.4, 5.5, 12.7_

  - [ ]* 7.2 Write property test for score and high-score display format
    - **Property 17: Score and High_Score display format**
    - **Validates: Requirements 5.4, 5.5, 12.7**

  - [x] 7.3 Implement score increment logic: increment `gameState.score` exactly once per Pipe_Pair (set `pipe.scored = true`), call `saveHighScore` if score exceeds highScore, trigger speed recalculation
    - _Requirements: 5.1, 5.7, 12.6_

  - [ ]* 7.4 Write property test for score incrementing once per pipe pass
    - **Property 16: Score increments exactly once per pipe pass**
    - **Validates: Requirements 5.1**

  - [ ]* 7.5 Write property test for speed applied on same frame as score increment
    - **Property 24: Speed applied to all pipes on the same frame as score increment**
    - **Validates: Requirements 12.6**

- [x] 8. Implement ParticleSystem
  - [x] 8.1 Implement `ParticleSystem.emit(x, y, count)` — add `count` Particle objects with random color, radius 2–5 px, initial opacity 0.6, lifetime 300 ms, leftward ±45° velocity
    - _Requirements: 13.1_

  - [ ]* 8.2 Write property test for particle emission rate
    - **Property 25: Particle emission rate**
    - **Validates: Requirements 13.1**

  - [x] 8.3 Implement `ParticleSystem.update(dt)` — advance all particles, apply opacity decay `0.6 × (1 − age / 300)`, prune expired
    - _Requirements: 13.2, 13.3_

  - [ ]* 8.4 Write property test for particle opacity decay
    - **Property 26: Particle opacity decay**
    - **Validates: Requirements 13.2**

  - [ ]* 8.5 Write property test for expired particle removal
    - **Property 27: Expired particles are removed**
    - **Validates: Requirements 13.3**

  - [x] 8.6 Implement `ParticleSystem.draw(ctx)` and `ParticleSystem.clear()`
    - `clear()` empties the particle array; draw renders each live particle as a filled circle
    - _Requirements: 13.4_

- [x] 9. Implement HUD overlays and Score_Popup system
  - [x] 9.1 Implement `HUD.spawnPopup(x, y)` and `HUD.updatePopups(dt)` — advance age, compute y-offset `−40 × (age / 600)` and opacity `1 − age / 600`, prune expired
    - _Requirements: 13.6, 13.8_

  - [ ]* 9.2 Write property test for Score_Popup animation formula
    - **Property 28: Score_Popup animation formula**
    - **Validates: Requirements 13.6**

  - [ ]* 9.3 Write property test for expired Score_Popup removal
    - **Property 29: Expired Score_Popups are removed**
    - **Validates: Requirements 13.8**

  - [x] 9.4 Implement `HUD.drawPopups(ctx)` — render "+1" in bold white 16px with black outline at computed position and opacity
    - _Requirements: 13.6_

  - [x] 9.5 Implement `HUD.drawScoreBar(ctx, score, highScore, speed, canvasW, canvasH)` — dark bar ≥40 px tall, full-width, with Score/High/Speed labels
    - _Requirements: 5.4, 5.5, 5.6, 12.7_

  - [x] 9.6 Implement `HUD.drawStartOverlay`, `HUD.drawPauseOverlay`, `HUD.drawGameOverOverlay`
    - Start: "Press Space or Tap to Start" + high-score "Best: X" between 50%–75% canvas height
    - Pause: semi-transparent overlay (50–80% opacity) with "PAUSED" + "Press P or Escape to Resume"
    - Game Over: "Game Over" + "Press Space or Tap to Restart" above Score_Bar
    - _Requirements: 1.2, 1.7, 4.9, 11.3_

- [x] 10. Implement ParallaxSystem
  - [x] 10.1 Implement `ParallaxSystem.init(canvasW, canvasH)` — create far and near cloud layers with fixed speeds and opacities
    - Far: `0.3 × BASELINE_SPEED = 0.6 px/frame`, opacity 0.4; Near: `0.6 × BASELINE_SPEED = 1.2 px/frame`, opacity 0.65
    - _Requirements: 8.2, 8.3_

  - [ ]* 10.2 Write property test for parallax layer speed and opacity constraints
    - **Property 22: Parallax layer speeds satisfy depth constraints**
    - **Validates: Requirements 8.2, 8.3**

  - [x] 10.3 Implement `ParallaxSystem.update()` and `ParallaxSystem.draw(ctx)` — advance clouds by layer speed, wrap at canvas edge, draw far then near
    - _Requirements: 8.2, 8.4_

- [x] 11. Implement AudioManager
  - [x] 11.1 Implement `AudioManager.init()` — create `HTMLAudioElement` instances for `jump.wav`, `score.wav`, `game_over.wav`, and attempt `music.ogg`/`music.mp3`; attach `onerror` handlers to null references
    - _Requirements: 14.1, 14.3, 14.4, 14.5, 14.10_

  - [x] 11.2 Implement `AudioManager.flap()` — reset playback position to 0 and play `jump.wav`, wrapped in promise catch
    - _Requirements: 14.1, 14.2_

  - [x] 11.3 Implement `AudioManager.score()`, `AudioManager.gameOver()`, `AudioManager.startMusic()`, `AudioManager.pauseMusic()`, `AudioManager.resumeMusic()`, `AudioManager.stopMusic()`
    - Each method guards against null audio reference and catches play errors with `console.warn`
    - _Requirements: 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10_

- [x] 12. Implement InputHandler and state machine transitions
  - [x] 12.1 Implement `InputHandler.init(canvas, callbacks)` — register `window keydown` (Space, P, Escape), `canvas click`, `canvas touchstart` with `preventDefault`; use `inputConsumed` guard to prevent double-fire
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 12.2 Implement `handleFlap()` routing: IDLE→PLAYING, PLAYING→physics flap + audio, GAME_OVER→reset + PLAYING, PAUSED→no-op
    - _Requirements: 1.5, 2.2, 7.1, 11.6_

  - [ ]* 12.3 Write property test for no flap processed while PAUSED
    - **Property 23: No flap input processed while PAUSED**
    - **Validates: Requirements 11.6**

  - [x] 12.4 Implement `handlePause()` routing: PLAYING→PAUSED (pause music), PAUSED→PLAYING (resume music), IDLE/GAME_OVER→no-op
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.8_

- [x] 13. Implement session reset
  - [x] 13.1 Implement `resetSession()` — set score to 0, call `Scroller.reset()`, reset ghosty vy and y to start position, clear particles, hide overlays
    - _Requirements: 7.2, 12.5_

  - [ ]* 13.2 Write property test for session reset producing clean state
    - **Property 21: Session reset produces clean state**
    - **Validates: Requirements 7.2, 12.5**

- [x] 14. Implement invincibility frame and screen shake
  - [x] 14.1 Implement invincibility logic — on first collision detection, set `gameState.invincible = true` and record `invincibilityStart`; toggle `ghosty.visible` every 100 ms for flash effect; on expiry if still colliding, transition to GAME_OVER
    - _Requirements: 4.5, 4.6_

  - [x] 14.2 Implement screen shake — on collision, set `gameState.shaking = true` and record `shakeStart`; in render, apply `ctx.translate(dx, dy)` decaying over `SHAKE_DURATION` (300 ms) before all draw calls
    - _Requirements: 4.8, 13.5_

  - [ ]* 14.3 Write property test for screen shake amplitude decay
    - **Property 13: Screen shake amplitude decay**
    - **Validates: Requirements 4.8, 13.5**

- [x] 15. Implement the rendering pipeline and GameLoop
  - [x] 15.1 Implement `drawGhosty(ctx, ghosty)` — `ctx.save/translate/rotate/drawImage/restore` using tilt; sprite-load error fallback to filled rectangle; suppress render during invincibility invisible frames
    - _Requirements: 8.5, 8.6_

  - [x] 15.2 Implement `drawPipes(ctx, pipes)` — green body + darker green cap/rim on each Pipe_Pair (top and bottom section)
    - _Requirements: 3.7_

  - [x] 15.3 Implement `render(ctx)` — full draw order: clearRect → background → far parallax → near parallax → pipes → ghosty → particles → Score_Bar → popups → overlay; wrap with screen-shake transform when active
    - _Requirements: 8.1, 8.4, 8.7, 10.3_

  - [ ]* 15.4 Write property test for canvas cleared before every frame render
    - **Property 30: Canvas cleared before every frame render**
    - **Validates: Requirements 10.3**

  - [x] 15.5 Implement `GameLoop.start()` and `tick(timestamp)` — call physics/scroller/particles/collision/scoring/shake update only when `PLAYING`; parallax update in `IDLE`/`GAME_OVER`; skip all updates when `PAUSED`; always call render
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

  - [ ]* 15.6 Write property test for update steps skipped in non-PLAYING states
    - **Property 31: Update steps skipped in non-PLAYING states**
    - **Validates: Requirements 10.4, 10.5**

  - [ ]* 15.7 Write property test for idle state suppressing physics and scrolling
    - **Property 14: Idle state suppresses physics and scrolling**
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 15.8 Write property test for GAME_OVER overlay persistence
    - **Property 15: GAME_OVER overlay persists**
    - **Validates: Requirements 4.10**

- [x] 16. Wire everything together and initialize on page load
  - [x] 16.1 Add page-load initialization: load high score, create Ghosty object with preloaded sprite, call `ParallaxSystem.init`, `AudioManager.init`, `InputHandler.init`, set `gameState.phase = 'IDLE'`, and call `GameLoop.start()`
    - _Requirements: 1.1, 6.1, 6.3, 8.5_

  - [x] 16.2 Verify GAME_OVER transition wires: clear particles, stop music, play game_over audio, update high score if needed, display overlay
    - _Requirements: 4.6, 4.7, 4.9, 5.7, 13.4_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery.
- The entire game lives in a single `index.html` — no build step, no npm, no external dependencies.
- Property tests use **fast-check** loaded via a `<script>` tag or a separate test HTML file that imports the pure logic under test.
- Each property test carries the tag `// Feature: flappy-kiro, Property N: <property text>` and runs a minimum of 100 iterations.
- Unit tests cover concrete examples (correct canvas positions, overlay visibility, audio error handling) complementing the property suite.
- Checkpoints at tasks 5 and 17 ensure correctness gates before and after full integration.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1", "4.1", "4.3"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "3.4", "3.5", "4.2", "4.4", "4.5"] },
    { "id": 2, "tasks": ["3.6", "3.7", "3.8", "6.1", "7.1"] },
    { "id": 3, "tasks": ["6.2", "6.3", "6.9", "7.2"] },
    { "id": 4, "tasks": ["6.4", "6.5", "6.6", "6.7", "6.8", "7.3", "8.1"] },
    { "id": 5, "tasks": ["6.7", "7.4", "7.5", "8.2", "8.3", "9.1", "10.1", "11.1"] },
    { "id": 6, "tasks": ["8.4", "8.5", "8.6", "9.2", "9.3", "9.4", "9.5", "9.6", "10.2", "10.3", "11.2", "11.3"] },
    { "id": 7, "tasks": ["12.1", "12.2", "12.4", "13.1"] },
    { "id": 8, "tasks": ["12.3", "13.2", "14.1", "14.2"] },
    { "id": 9, "tasks": ["14.3", "15.1", "15.2"] },
    { "id": 10, "tasks": ["15.3", "15.5"] },
    { "id": 11, "tasks": ["15.4", "15.6", "15.7", "15.8", "16.1"] },
    { "id": 12, "tasks": ["16.2"] }
  ]
}
```
