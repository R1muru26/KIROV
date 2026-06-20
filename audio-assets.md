# Audio Asset Specifications

All sound effects are short, loopable-safe WAV files. Background music is optional and loaded
conditionally (see design.md — Audio_Manager). All assets go in the `assets/` directory.

---

## Sound Effects

### `assets/jump.wav` — Flap Sound

| Property    | Value                              |
|-------------|------------------------------------|
| Duration    | 0.1 s                              |
| Character   | Short upward whoosh                |
| Pitch       | Mid-high, rising (220 Hz → 440 Hz) |
| Envelope    | Instant attack, fast decay         |
| Volume      | 0.8 normalized                     |
| Triggered   | On every flap input                |
| Behavior    | Restarts from beginning if already playing (rapid-fire safe) |

**Design intent:** Lightweight and snappy. Should feel responsive without being fatiguing on repeated presses. Think a quick puff of air or a soft wing beat.

**Synthesis notes (if generating programmatically):**
```
Oscillator: sine or triangle wave
Frequency sweep: 220 Hz → 440 Hz over 80 ms
Amplitude envelope: attack 2ms, decay 80ms, sustain 0, release 20ms
Optional: add light white noise layer at -18dB for texture
```

---

### `assets/score.wav` — Score Sound

| Property    | Value                                  |
|-------------|----------------------------------------|
| Duration    | 0.2 s                                  |
| Character   | Pleasant two-note chime, ascending     |
| Pitch       | E5 (659 Hz) → G5 (784 Hz)             |
| Envelope    | Fast attack, medium decay, light reverb tail |
| Volume      | 0.7 normalized                         |
| Triggered   | Each time score increments (+1 per pipe pass) |
| Behavior    | Plays from beginning; overlapping instances allowed |

**Design intent:** Rewarding and cheerful without being loud or distracting. Short enough to not overlap with the next pipe if the player is skilled.

**Synthesis notes:**
```
Two sine tones played sequentially:
  Note 1: 659 Hz, duration 80ms, amplitude envelope: attack 5ms, decay 70ms
  Note 2: 784 Hz, duration 100ms, amplitude envelope: attack 5ms, decay 90ms, slight reverb
Optional: add a soft bell-like harmonic at 2× frequency, -12dB
```

---

### `assets/game_over.wav` — Collision / Death Sound

| Property    | Value                              |
|-------------|------------------------------------|
| Duration    | 0.3 s                              |
| Character   | Soft thud with a descending tone   |
| Pitch       | Low, descending (300 Hz → 120 Hz)  |
| Envelope    | Short attack, medium decay         |
| Volume      | 0.9 normalized                     |
| Triggered   | On `GAME_OVER` state transition    |
| Behavior    | Plays once; does not loop          |

**Design intent:** Communicates failure clearly but not harshly — this is a casual game. A soft thud or muffled bump, not a harsh buzzer or explosion.

**Synthesis notes:**
```
Oscillator: sine wave with slight pitch bend
Frequency sweep: 300 Hz → 120 Hz over 250ms
Amplitude envelope: attack 5ms, decay 200ms, release 50ms
Optional: add low-frequency rumble (60–80 Hz) at -10dB for impact feel
```

---

## Background Music (Optional)

### `assets/music.ogg` / `assets/music.mp3`

| Property    | Value                                      |
|-------------|--------------------------------------------|
| Duration    | 60–90 s loop                               |
| Character   | Upbeat chiptune / retro 8-bit style        |
| Tempo       | 140–160 BPM                                |
| Key         | C major or G major (bright, energetic)     |
| Volume      | Loaded at 0.3 (30%) via `MUSIC_VOLUME` constant |
| Loop        | Seamless loop (loop point at end of phrase) |
| Triggered   | On transition from `IDLE` → `PLAYING`      |
| Paused      | On `PAUSED` state (resumes from same position) |
| Stopped     | On `GAME_OVER` state                       |

**Format priority:** `.ogg` loaded first, `.mp3` as fallback. If neither is present, the game runs silently with no error.

**Design intent:** Light background texture that complements gameplay without competing with sound effects. Should loop without an audible seam.

**File delivery:** Both formats provided for cross-browser compatibility (`<audio>` codec support varies by browser).

---

## General Requirements

- All WAV files: 44.1 kHz, 16-bit, mono
- All files normalized to avoid clipping
- No silence padding at start (immediate transient on play)
- Silence at end kept to < 10 ms to avoid clicks on replay
- Total assets size target: < 500 KB combined (important for single-file game load time)

---

## File Delivery Checklist

- [ ] `assets/jump.wav` — 0.1s flap whoosh
- [ ] `assets/score.wav` — 0.2s ascending chime
- [ ] `assets/game_over.wav` — 0.3s soft thud
- [ ] `assets/music.ogg` — optional, looping chiptune (or omit entirely)
- [ ] `assets/music.mp3` — optional, same track as .ogg fallback
