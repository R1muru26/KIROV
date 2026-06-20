# Requirements Document

## Introduction

Flappy Kiro is a browser-based retro endless scroller game inspired by Flappy Bird. The player controls a ghost character (Ghosty) that must navigate through a series of vertically-gapped pipe obstacles scrolling from right to left. Ghosty falls continuously due to a defined gravity constant and the player taps, clicks, or presses Space to flap upward; a terminal velocity cap and momentum accumulation give the physics a natural, weighted feel. Ghosty's sprite tilts to reflect the current velocity direction, providing visual feedback for the flight arc.

The obstacle system spawns Pipe_Pairs at regular horizontal intervals with randomly positioned gaps. Scroll speed starts at a fixed baseline and increases gradually as the player's score grows, raising difficulty over time.

Collision detection uses an inset hitbox smaller than Ghosty's sprite for fairness. On collision, the screen shakes briefly and the game enters a short Invincibility_Frame period showing a flash effect before transitioning to Game Over. The player may also pause and resume the game at any time.

The world features multi-layer parallax clouds rendered at semi-transparent opacity and scrolled at different speeds to convey visual depth. Ghosty emits a continuous Particle_Trail while flying. Each successful pipe pass triggers a floating Score_Popup ("+1") and plays a scoring sound. Looping background music and sound effects for flapping, scoring, and collisions provide a complete audio experience.

The score increments each time Ghosty successfully passes through a Pipe_Gap, and the all-time High_Score is persisted across sessions via localStorage.

---

## Glossary

- **Game**: The browser-based Flappy Kiro application running in an HTML5 Canvas element.
- **Ghosty**: The ghost character sprite (`assets/ghosty.png`) controlled by the player.
- **Pipe**: A vertically-split obstacle consisting of a top section and a bottom section with a fixed gap between them; rendered in green with a cap/rim at the opening end.
- **Pipe_Gap**: The vertical opening between the top and bottom sections of a Pipe through which Ghosty must pass.
- **Pipe_Pair**: A single pair of top and bottom Pipes that share the same horizontal position and move together.
- **Scroller**: The component responsible for spawning Pipe_Pairs at regular intervals and scrolling all game objects from right to left.
- **Score**: The integer count of Pipe_Pairs that Ghosty has successfully passed through in the current game session.
- **High_Score**: The highest Score ever recorded by the player, persisted in localStorage under the key `flappyKiroHighScore`.
- **Score_Bar**: The dark horizontal bar rendered at the bottom of the canvas displaying the current Score and High_Score.
- **Physics_Engine**: The component that applies gravity, flap impulse, terminal velocity clamping, and momentum accumulation to Ghosty each frame, and computes Ghosty's tilt angle from velocity.
- **Collision_Detector**: The component that checks whether Ghosty's inset hitbox overlaps any Pipe section, the ceiling, or the ground each frame.
- **Inset_Hitbox**: A reduced axis-aligned bounding box centered within Ghosty's sprite, inset by 20% on each side, used for all collision checks.
- **Game_State**: The current phase of the Game; one of `IDLE`, `PLAYING`, `PAUSED`, or `GAME_OVER`.
- **Pause_State**: The `PAUSED` value of Game_State in which all physics, scrolling, and spawning are suspended and a pause overlay is displayed.
- **Audio_Manager**: The component that loads and plays `assets/jump.wav`, `assets/score.wav`, `assets/game_over.wav`, and the looping background music track.
- **HUD**: Heads-Up Display — collectively the Score_Bar and any in-canvas text overlays (start prompt, pause overlay, game-over message, Score_Popup).
- **Parallax_Layer**: A background layer of cloud shapes rendered at a distinct scroll speed and semi-transparent opacity to create the visual impression of depth.
- **Particle_Trail**: A stream of small semi-transparent ghost-like particles emitted continuously from Ghosty's trailing edge while the Game_State is `PLAYING`, fading out over their lifetime.
- **Screen_Shake**: A short-duration camera offset effect applied to the canvas render transform on collision, lasting 300 milliseconds with a maximum displacement of 8 pixels.
- **Invincibility_Frame**: A brief grace period of 500 milliseconds after a collision is first detected, during which Ghosty flashes and no Game_Over transition is triggered; if Ghosty is still colliding at the end of this period the Game transitions to `GAME_OVER`.
- **Score_Popup**: A floating "+1" text label that appears at Ghosty's position when a Pipe_Pair is successfully passed, rises 40 pixels over 600 milliseconds, and then disappears.
- **Progressive_Difficulty**: The mechanism by which the Scroller's scroll speed increases incrementally as the Score grows.
- **Baseline_Speed**: The initial scroll speed of 2 pixels per frame applied at Score 0.
- **Speed_Cap**: The maximum scroll speed of 6 pixels per frame, which Progressive_Difficulty may not exceed.

---

## Requirements

### Requirement 1: Game Initialization and Start Screen

**User Story:** As a player, I want to see a start screen when I open the game, so that I know how to begin playing.

#### Acceptance Criteria

1. WHEN the Game page is loaded, THE Game SHALL render the canvas with a solid background color and display Ghosty centered horizontally at 50% of the canvas height.
2. WHEN the Game page is loaded, THE HUD SHALL display the prompt "Press Space or Tap to Start" overlaid on the canvas between 50% and 75% of canvas height.
3. WHILE the Game_State is `IDLE`, THE Scroller SHALL NOT spawn or move any Pipe_Pairs.
4. WHILE the Game_State is `IDLE`, THE Physics_Engine SHALL NOT apply gravity to Ghosty.
5. WHEN the player presses the Space key or clicks or taps the canvas, WHILE the Game_State is `IDLE`, THE Game SHALL transition the Game_State to `PLAYING`.
6. WHEN the Game_State transitions from `IDLE` to `PLAYING`, THE HUD SHALL hide the "Press Space or Tap to Start" prompt.
7. WHEN the Game page is loaded, THE HUD SHALL display the current High_Score on the start screen in the format "Best: X".

---

### Requirement 2: Ghosty Physics

**User Story:** As a player, I want Ghosty to fall due to gravity and flap upward when I press Space or tap, so that I can control the character's height with a natural, weighted feel.

#### Acceptance Criteria

1. WHILE the Game_State is `PLAYING`, THE Physics_Engine SHALL apply a constant downward acceleration of exactly 0.5 pixels per frame² to Ghosty each frame, accumulating downward velocity across frames (momentum conservation).
2. WHEN the player presses the Space key or clicks or taps the canvas, WHILE the Game_State is `PLAYING`, THE Physics_Engine SHALL set Ghosty's vertical velocity to exactly −8 pixels per frame (upward), overriding the current velocity.
3. WHILE the Game_State is `PLAYING`, THE Physics_Engine SHALL constrain Ghosty's downward velocity to a maximum of 12 pixels per frame (terminal velocity); if the accumulated velocity exceeds 12 pixels per frame downward, THE Physics_Engine SHALL clamp it to 12 pixels per frame.
4. WHILE the Game_State is `PLAYING`, THE Physics_Engine SHALL update Ghosty's vertical position each frame by adding the current clamped velocity to Ghosty's y-coordinate (Euler integration).
5. WHILE the Game_State is `PLAYING`, THE Physics_Engine SHALL compute Ghosty's tilt angle each frame as the arctangent of the current vertical velocity divided by a reference horizontal speed of 4 pixels per frame, clamped to a minimum of −30 degrees (nose-up) and a maximum of 90 degrees (nose-down), and SHALL apply this rotation to Ghosty's sprite rendering.
6. WHEN Ghosty's top edge would move above the top boundary of the canvas, THE Physics_Engine SHALL clamp Ghosty's vertical position so that the top edge equals 0 and SHALL set Ghosty's vertical velocity to 0.
7. WHEN the player triggers a flap, THE Audio_Manager SHALL attempt to play `assets/jump.wav`; IF the audio resource fails to load, THE Game SHALL continue without audio and SHALL NOT throw an unhandled error.

---

### Requirement 3: Pipe Spawning and Scrolling

**User Story:** As a player, I want pipes to scroll continuously from right to left at an increasing speed, so that the game presents an endless series of obstacles with growing challenge.

#### Acceptance Criteria

1. WHILE the Game_State is `PLAYING`, THE Scroller SHALL spawn a new Pipe_Pair at the right edge of the canvas every 150 pixels scrolled.
2. WHEN a Pipe_Pair is spawned, THE Scroller SHALL assign its Pipe_Gap a fixed height of 150 pixels.
3. WHEN a Pipe_Pair is spawned, THE Scroller SHALL assign the Pipe_Gap a random vertical center position such that the top of the gap is at least 50 pixels below the top edge of the canvas and the bottom of the gap is at least 50 pixels above the upper boundary of the Score_Bar.
4. WHILE the Game_State is `PLAYING`, THE Scroller SHALL move all active Pipe_Pairs from right to left at the current scroll speed each frame.
5. THE Scroller SHALL apply Progressive_Difficulty: the current scroll speed SHALL equal the Baseline_Speed of 2 pixels per frame plus 0.2 pixels per frame for every 5 points of Score, capped at the Speed_Cap of 6 pixels per frame.
6. WHEN a Pipe_Pair moves entirely off the left edge of the canvas, THE Scroller SHALL remove that Pipe_Pair from the active set.
7. THE Scroller SHALL render each Pipe as a green rectangle with a darker green cap/rim of 10 pixels height at the opening end facing the Pipe_Gap.

---

### Requirement 4: Collision Detection and Game Over

**User Story:** As a player, I want the game to end when Ghosty hits a pipe, the ceiling, or the ground, with clear visual feedback before the game over screen, so that collisions feel fair and responsive.

#### Acceptance Criteria

1. WHILE the Game_State is `PLAYING`, THE Collision_Detector SHALL check each frame whether Ghosty's Inset_Hitbox intersects the axis-aligned bounding box of any Pipe section.
2. THE Inset_Hitbox SHALL be centered within Ghosty's sprite and inset by 20% of the sprite's width on the left and right sides and 20% of the sprite's height on the top and bottom, making it smaller than the rendered sprite for fairness.
3. WHILE the Game_State is `PLAYING`, THE Collision_Detector SHALL check each frame whether Ghosty's Inset_Hitbox top edge reaches or exceeds the top boundary of the canvas (ceiling collision).
4. WHILE the Game_State is `PLAYING`, THE Collision_Detector SHALL check each frame whether Ghosty's Inset_Hitbox bottom edge reaches or exceeds the upper boundary of the Score_Bar (ground collision).
5. WHEN a collision is first detected, WHILE no Invincibility_Frame is active, THE Game SHALL begin an Invincibility_Frame period of 500 milliseconds during which Ghosty SHALL flash at a rate of one visible/invisible cycle per 100 milliseconds.
6. WHEN an Invincibility_Frame period ends and a collision condition is still present, THE Game SHALL transition the Game_State to `GAME_OVER`.
7. WHEN the Game_State transitions to `GAME_OVER`, THE Audio_Manager SHALL play `assets/game_over.wav`.
8. WHEN a collision is first detected, THE Game SHALL trigger a Screen_Shake effect lasting 300 milliseconds with a maximum canvas displacement of 8 pixels in a random direction per frame, decaying linearly to 0 over the duration.
9. WHEN the Game_State transitions to `GAME_OVER`, THE HUD SHALL display a "Game Over" message and a "Press Space or Tap to Restart" prompt on the canvas above the Score_Bar layer.
10. WHILE the Game_State is `GAME_OVER`, THE HUD SHALL continue to display the "Game Over" message and restart prompt until the player triggers a restart.

---

### Requirement 5: Scoring

**User Story:** As a player, I want my score to increment each time I pass through a pipe gap with clear visual and audio feedback, so that I can measure my performance.

#### Acceptance Criteria

1. WHEN Ghosty's trailing edge (right edge of the Inset_Hitbox) passes the leading edge (left edge) of a Pipe_Pair's gap, WHILE the Game_State is `PLAYING`, THE Game SHALL increment the Score by exactly 1, and this increment SHALL occur exactly once per Pipe_Pair.
2. WHEN the Score is incremented, THE Audio_Manager SHALL attempt to play `assets/score.wav`; IF the audio resource fails to load, THE Game SHALL continue without the sound and SHALL NOT throw an unhandled error.
3. WHEN the Score is incremented, THE HUD SHALL spawn a Score_Popup at Ghosty's current canvas position displaying the text "+1", which SHALL rise 40 pixels over 600 milliseconds while fading from full opacity to 0, then be removed.
4. THE Score_Bar SHALL display the current Score in the format "Score: X" where X is the integer Score value.
5. THE Score_Bar SHALL display the High_Score in the format "High: X" where X is the integer High_Score value.
6. THE Score_Bar SHALL render as a dark horizontal bar at least 40 pixels tall with a background opacity of at least 70%, spanning the full width of the canvas at the bottom.
7. WHEN the Game_State transitions to `GAME_OVER`, IF the current Score exceeds the stored High_Score, THEN THE Game SHALL update the High_Score in localStorage under the key `flappyKiroHighScore`.
8. WHEN a game session is reset, THE Score SHALL be set to 0; IF no High_Score exists in localStorage, THE High_Score SHALL be initialized to 0.

---

### Requirement 6: High Score Persistence

**User Story:** As a player, I want my high score to be saved between sessions, so that I can try to beat my personal best over time.

#### Acceptance Criteria

1. WHEN the Game page is loaded, THE Game SHALL read the High_Score from localStorage key `flappyKiroHighScore`; IF no value is stored, THEN THE Game SHALL initialize the High_Score to 0.
2. WHEN the High_Score is updated, THE Game SHALL write the new High_Score value to localStorage key `flappyKiroHighScore` as a string representation of the integer.
3. THE Score_Bar SHALL reflect the persisted High_Score immediately upon page load, before any game session begins.

---

### Requirement 7: Game Restart

**User Story:** As a player, I want to restart the game after a game over without reloading the page, so that I can quickly try again.

#### Acceptance Criteria

1. WHEN the player presses the Space key or clicks or taps the canvas, WHILE the Game_State is `GAME_OVER`, THE Game SHALL transition the Game_State to `PLAYING` and reset the game session.
2. WHEN a game session is reset, THE Game SHALL set the Score to 0, remove all active Pipe_Pairs, reset Ghosty's vertical velocity to 0, reset the Scroller scroll speed to the Baseline_Speed, and return Ghosty to the vertical position and velocity used at the start of a new game.
3. THE High_Score SHALL remain unchanged at all times during a game session reset; it SHALL only be updated when the current Score exceeds it at game over.

---

### Requirement 8: Visual Presentation

**User Story:** As a player, I want the game to have a retro visual style with a sky-blue background, parallax clouds, and a rotating Ghosty sprite, so that it is visually appealing and conveys depth and motion.

#### Acceptance Criteria

1. THE Game SHALL render the canvas background in a sky-blue color each frame.
2. THE Game SHALL render at least two Parallax_Layers of decorative cloud shapes, where the furthest layer scrolls at no more than 30% of the Baseline_Speed and the nearest layer scrolls at no more than 60% of the Baseline_Speed, both independently of the current pipe scroll speed.
3. WHILE the Game_State is `PLAYING`, `IDLE`, or `GAME_OVER`, each Parallax_Layer SHALL render its clouds at a semi-transparent opacity between 40% and 80%, with the furthest layer rendered at lower opacity than the nearest layer to reinforce the depth effect.
4. WHILE the Game_State is `PLAYING`, `IDLE`, or `GAME_OVER`, THE Game SHALL render elements in this order: (1) background color, (2) far Parallax_Layer clouds, (3) near Parallax_Layer clouds, (4) pipes (if any), (5) Ghosty (if visible), (6) Particle_Trail particles, (7) Score_Bar, (8) HUD overlays including Score_Popups.
5. WHILE the Game_State is `PLAYING` or `IDLE`, THE Game SHALL render Ghosty using the sprite image `assets/ghosty.png` at Ghosty's current canvas position, rotated by the tilt angle computed by the Physics_Engine, with the rotation pivot at the sprite's center.
6. WHEN the Game_State is `GAME_OVER`, THE Game SHALL render Ghosty at its final position without tilt rotation.
7. THE Score_Bar SHALL be rendered in draw order step 7, after all game world elements and before HUD overlays.

---

### Requirement 9: Responsive Input

**User Story:** As a player, I want to control Ghosty using keyboard, mouse click, or touch tap, so that the game works on both desktop and mobile browsers.

#### Acceptance Criteria

1. THE Game SHALL register a `keydown` event listener on the `window` object for the Space key (`code === "Space"`) to trigger flap and state transitions.
2. THE Game SHALL register a `keydown` event listener on the `window` object for the `p` key (`code === "KeyP"`) and the Escape key (`code === "Escape"`) to trigger pause and resume transitions.
3. THE Game SHALL register a `click` event listener on the canvas element to trigger flap and state transitions.
4. THE Game SHALL register a `touchstart` event listener on the canvas element to trigger flap and state transitions on touch devices.
5. IF a `touchstart` event is received, THEN THE Game SHALL call `preventDefault()` on the event to suppress default browser touch behaviors such as scrolling and double-tap zoom.
6. THE Game SHALL ensure that a single physical interaction (one keypress, click, or tap) triggers the flap action exactly once, preventing duplicate state transitions from overlapping event handlers.

---

### Requirement 10: Game Loop and Frame Rate

**User Story:** As a developer, I want the game to use a consistent frame-based game loop, so that gameplay is smooth and deterministic.

#### Acceptance Criteria

1. THE Game SHALL use `requestAnimationFrame` to drive the main game loop continuously regardless of Game_State.
2. WHILE the Game_State is `PLAYING`, THE Game SHALL execute Physics_Engine updates, Scroller updates, Particle_Trail updates, Collision_Detector checks, Score_Popup updates, and canvas rendering on each animation frame, in that order.
3. WHEN a new animation frame begins, THE Game SHALL clear the entire canvas before rendering any game elements.
4. WHILE the Game_State is `IDLE` or `GAME_OVER`, THE Game SHALL execute only canvas rendering (background, Parallax_Layer clouds, Ghosty if visible, Score_Bar, HUD overlays) on each animation frame, skipping Physics_Engine, Scroller, and Particle_Trail updates.
5. WHILE the Game_State is `PAUSED`, THE Game SHALL execute only canvas rendering of the last frame's content plus the pause overlay on each animation frame, skipping all update steps.

---

### Requirement 11: Pause Functionality

**User Story:** As a player, I want to pause and resume the game at any time during play, so that I can take a break without losing my progress.

#### Acceptance Criteria

1. WHEN the player presses the `p` key or the Escape key, WHILE the Game_State is `PLAYING`, THE Game SHALL transition the Game_State to `PAUSED` and suspend all Physics_Engine updates, Scroller updates, Collision_Detector checks, and Particle_Trail updates.
2. WHEN the Game_State transitions to `PAUSED`, THE Audio_Manager SHALL pause any currently playing background music without restarting it.
3. WHEN the Game_State transitions to `PAUSED`, THE HUD SHALL display an overlay covering the canvas at 50%–80% opacity with the text "PAUSED" centered, and a sub-prompt "Press P or Escape to Resume".
4. WHEN the player presses the `p` key or the Escape key, WHILE the Game_State is `PAUSED`, THE Game SHALL transition the Game_State to `PLAYING` and resume all suspended updates from their last state.
5. WHEN the Game_State transitions from `PAUSED` to `PLAYING`, THE Audio_Manager SHALL resume background music playback from the position at which it was paused.
6. WHILE the Game_State is `PAUSED`, THE Game SHALL NOT process Space key, click, or tap events as flap inputs.
7. WHILE the Game_State is `PAUSED`, THE HUD SHALL continue to display the current Score and High_Score in the Score_Bar.
8. WHEN the player presses the `p` key or the Escape key, WHILE the Game_State is `IDLE` or `GAME_OVER`, THE Game SHALL NOT transition to `PAUSED` and SHALL ignore the input.

---

### Requirement 12: Progressive Difficulty

**User Story:** As a player, I want the game to become harder as my score increases, so that I remain challenged throughout a session.

#### Acceptance Criteria

1. WHEN a game session begins, THE Scroller SHALL initialize the current scroll speed to the Baseline_Speed of 2 pixels per frame.
2. WHEN the Score is incremented, THE Scroller SHALL recalculate the current scroll speed as: Baseline_Speed + (floor(Score / 5) × 0.2) pixels per frame.
3. THE Scroller SHALL clamp the current scroll speed to a maximum of the Speed_Cap of 6 pixels per frame.
4. IF the recalculated scroll speed exceeds the Speed_Cap, THE Scroller SHALL set the current scroll speed to exactly the Speed_Cap and SHALL NOT increase it further regardless of Score.
5. WHEN a game session is reset, THE Scroller SHALL reset the current scroll speed to the Baseline_Speed of 2 pixels per frame.
6. WHEN the Score is incremented, THE Scroller SHALL apply the updated scroll speed to all active Pipe_Pairs on the same frame in which the Score change is detected.
7. WHILE the Game_State is `PLAYING`, THE Score_Bar SHALL display the current scroll speed in the format "Speed: X.X" (rounded down to one decimal place) to give the player awareness of the current difficulty level.

---

### Requirement 13: Particle Effects and Visual Feedback

**User Story:** As a player, I want visual effects such as Ghosty's particle trail, a screen shake on collision, and floating score popups, so that the game feels lively and responsive.

#### Acceptance Criteria

1. WHILE the Game_State is `PLAYING`, THE Game SHALL emit a Particle_Trail particle from Ghosty's trailing edge at a rate of 3 particles per frame; each particle SHALL have a color randomly chosen per particle as either white or light-blue, a radius between 2 and 5 pixels selected randomly per particle, an initial opacity of 0.6, and a lifetime of 300 milliseconds.
2. WHILE the Game_State is `PLAYING`, THE Game SHALL update each live Particle_Trail particle each frame by moving it 1 pixel in a random direction within ±45 degrees of the leftward direction and reducing its opacity linearly to 0 over its 300-millisecond lifetime.
3. WHEN a Particle_Trail particle's lifetime expires, THE Game SHALL remove it from the active particle set.
4. WHEN the Game_State transitions to `GAME_OVER`, THE Game SHALL clear all active Particle_Trail particles immediately.
5. WHEN a collision is detected, THE Game SHALL apply a Screen_Shake effect to the canvas for 300 milliseconds; the displacement per frame SHALL be re-randomized each frame starting at a maximum of 8 pixels and decaying linearly to 0 by the end of the 300-millisecond duration.
6. WHEN the Score is incremented, THE HUD SHALL create a Score_Popup centered at Ghosty's current canvas coordinates displaying "+1" in bold white 16px text with a black outline, which SHALL translate upward by 40 pixels and fade from opacity 1.0 to 0.0 over 600 milliseconds.
7. WHILE a Score_Popup is active, THE Game SHALL render it above the Particle_Trail layer and below the Score_Bar.
8. WHEN a Score_Popup's 600-millisecond animation completes, THE Game SHALL remove it from the active set.

---

### Requirement 14: Audio Feedback

**User Story:** As a player, I want sound effects for flapping, scoring, and collisions, plus optional looping background music, so that the game has a complete audio experience.

#### Acceptance Criteria

1. WHEN the player triggers a flap, WHILE the Game_State is `PLAYING`, THE Audio_Manager SHALL play `assets/jump.wav` from the beginning.
2. IF `assets/jump.wav` is already playing when a new flap is triggered, THE Audio_Manager SHALL reset the playback position to the beginning before playing.
3. WHEN the Score is incremented, THE Audio_Manager SHALL play `assets/score.wav` from the beginning; IF the asset is unavailable, THE Game SHALL continue silently without error.
4. WHEN the Game_State transitions to `GAME_OVER`, THE Audio_Manager SHALL play `assets/game_over.wav` from the beginning.
5. WHERE a background music asset (`assets/music.ogg` or `assets/music.mp3`) is available, THE Audio_Manager SHALL load and play it as a looping track at a volume of 0.3 (30% of maximum) WHEN the Game_State transitions from `IDLE` to `PLAYING`.
6. WHERE background music is playing, WHEN the Game_State transitions to `PAUSED`, THE Audio_Manager SHALL pause the music at the current playback position.
7. WHERE background music has been paused, WHEN the Game_State transitions from `PAUSED` to `PLAYING`, THE Audio_Manager SHALL resume the music from the position at which it was paused.
8. WHERE background music is playing, WHEN the Game_State transitions to `GAME_OVER`, THE Audio_Manager SHALL stop the background music.
9. WHEN the Game_State transitions from `GAME_OVER` to `PLAYING`, THE Audio_Manager SHALL restart the background music from the beginning.
10. IF any audio asset fails to load or play (e.g., due to browser autoplay policy or missing file), THEN THE Audio_Manager SHALL catch the error, log a warning to the browser console, and THE Game SHALL continue without that audio without throwing an unhandled error.

---

### Requirement 15: Sprite-Based Smooth Ghost Animation

**User Story:** As a player, I want Ghosty to have smooth sprite-based animations for idle, flapping, and death states, so that the character feels alive and responsive.

#### Acceptance Criteria

1. WHILE the Game_State is `IDLE`, THE Game SHALL play a looping idle animation cycling through idle frames at approximately 8 FPS, holding each frame for approximately 125 milliseconds.
2. WHEN the player triggers a flap, THE Game SHALL switch Ghosty's displayed frame to the flap animation frame (Frame 1) immediately and hold it for exactly 80 milliseconds before returning to the idle cycling animation.
3. WHEN the Game_State transitions to `GAME_OVER`, THE Game SHALL switch Ghosty's displayed frame to the death frame (Frame 2) and hold it statically until the next game session begins.
4. THE sprite sheet SHALL be a single PNG (`assets/ghosty.png`) with frames arranged horizontally in the order: Frame 0 = Idle (x=0), Frame 1 = Flap (x=32), Frame 2 = Death (x=64), each frame 32×32 pixels, as specified in `ghosty-sprites.md`.
5. THE Game SHALL crop each frame from the sprite sheet using `drawImage` source-rectangle parameters (sx, sy, sw, sh); THE Game SHALL NOT scale the sprite sheet itself before cropping.
6. THE animation system SHALL accumulate elapsed time in milliseconds each frame to determine frame transitions; THE Game SHALL NOT use frame-count-based timing, ensuring animation speed is independent of the display frame rate.

---

### Requirement 16: Dynamic Background with Score Milestones

**User Story:** As a player, I want the background to change as my score increases, so that the game feels progressive and rewarding.

#### Acceptance Criteria

1. THE Game SHALL define exactly 4 background themes with the following score-milestone triggers: Day (Score 0), Sunset (Score 10), Dusk (Score 25), Night (Score 50).
2. WHEN the player's Score reaches a theme milestone, THE Game SHALL begin a linear color interpolation (lerp) between the current theme's sky color and the next theme's sky color, completing the transition over exactly 1 second.
3. EACH background theme SHALL define a distinct sky gradient (top color and bottom color), a distinct cloud tint color, and a distinct pipe color scheme used during that theme.
4. THE parallax cloud layers SHALL continue scrolling without interruption during a background theme transition.
5. WHEN a game session is reset, THE Game SHALL immediately set the background to the Day theme without any transition animation.

---

### Requirement 17: Enhanced Start Screen UI

**User Story:** As a player, I want the start screen to have a Play button, a Sound On/Off toggle, and instructions, so that I understand how to play before starting.

#### Acceptance Criteria

1. WHEN the Game_State is `IDLE`, THE HUD SHALL display a "PLAY" button centered on the canvas; WHEN the player clicks or taps the "PLAY" button, THE Game SHALL transition the Game_State to `PLAYING` (equivalent to pressing Space).
2. WHEN the Game_State is `IDLE`, THE HUD SHALL display a Sound toggle button in the top-right corner of the canvas showing a speaker icon (🔊 when sound is on, 🔇 when sound is off); WHEN the player clicks or taps the toggle button, THE Audio_Manager SHALL invert the current audio-enabled state and persist the new preference to localStorage under the key `flappyKiroSoundEnabled`.
3. WHEN the Game_State is `IDLE`, THE HUD SHALL display a brief instructions section below the title listing: the flap control (Space or tap), the pause control (P or Esc), and a note that the background changes as score increases.
4. THE "PLAY" button SHALL function as the primary call-to-action on the start screen; the existing Space key, click, and tap-anywhere inputs SHALL remain functional alongside the button.
5. WHEN the sound preference stored in localStorage under `flappyKiroSoundEnabled` is `false`, THE Audio_Manager SHALL skip all audio playback silently for all sound events; the Sound toggle button SHALL reflect the stored preference on every page load.

---

### Requirement 18: Custom Character Upload

**User Story:** As a player, I want to upload my own image to replace Ghosty, so that I can personalize my character.

#### Acceptance Criteria

1. WHEN the Game_State is `IDLE`, THE HUD SHALL display an "Upload Character" button on the start screen.
2. WHEN the player activates the "Upload Character" button, THE Game SHALL open a native file picker filtered to image file types PNG, JPG, GIF, and WebP.
3. WHEN the player selects a valid image file, THE Game SHALL load it as an `HTMLImageElement` and use it in place of the default Ghosty sprite sheet for all rendering during the current browser session.
4. THE custom image SHALL be scaled to 48×48 pixels on canvas regardless of its original dimensions, matching the standard Ghosty render dimensions.
5. THE Collision_Detector hitbox circle SHALL remain computed from the render dimensions (48×48) and the configured `HITBOX_RADIUS_FACTOR`, independent of the original image dimensions, preserving collision fairness.
6. WHEN a custom image is active, THE animation frame selection logic (idle, flap, death frames) SHALL NOT apply; THE Game SHALL render the custom image as a single static frame with tilt rotation applied normally according to Ghosty's current velocity.
7. THE custom character SHALL persist for the current browser session only; THE Game SHALL NOT write image data to localStorage.
8. IF the file picker is cancelled or the selected file cannot be loaded as a valid image, THEN THE Game SHALL retain the currently active character (default Ghosty or previously uploaded image) without error and SHALL NOT display an error message to the player.

---

### Requirement 19: Visual Enhancement Pass

**User Story:** As a player, I want the game to look more polished and visually appealing, so that it feels like a quality retro experience.

#### Acceptance Criteria

1. THE Game SHALL render each Pipe using a vertical linear gradient fill with a lighter green at the horizontal center and a darker green at the left and right edges, replacing the previous flat-color fill, to create a rounded 3D appearance.
2. THE Score_Bar SHALL render a 1-pixel semi-transparent white horizontal line along its top edge to visually separate the Score_Bar from the playfield above it.
3. THE HUD SHALL render the start screen title "FLAPPY KIRO" with a drop shadow and a vertical bounce animation cycling between −4 pixels and +4 pixels offset at a period of 1.5 seconds using a sine curve.
4. WHEN the Game_State transitions to `GAME_OVER` and the current Score exceeds the previous High_Score, THE HUD SHALL display a "★ NEW BEST!" badge that plays a scale-pulse animation from scale 1.0 to 1.2 and back to 1.0 over 400 milliseconds.
5. THE Score_Popup text SHALL use the `"Press Start 2P"` font (or `monospace` fallback) consistent with all other Score_Bar text, replacing any previously specified font for Score_Popup rendering.
