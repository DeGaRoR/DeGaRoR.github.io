# SND-ANIMALS — the animals' voices, heard offline (G1705–G1709)

Five short scenes on **Jolene** — the shipped island, its own eight animal hotspots, run by the page's own animals layer
(`src/viewer/animal_run.js` on three and the shipped payload: the real dive cycle, clip machine and flocks) and heard
through the page's own sound code (`samples.js`, the ambience, `emitters_model.js`, `emitters.js` in a vm on a recording
AudioContext; the shipped MP3s decoded by ffmpeg). The animals reach the sound through the same read-only reader the page
uses (`animal_run.js sound()` → `render_premises.animalSounds` → the emitters' provider).

**The emitters ALONE**: no engine, no ambience beds (the beds are SND-AMB-1's evidence). Every call goes through what the
page scheduled: its gain, the air's absorption, inverse distance, the equal-power pan in the camera's frame (the eye looks
along the path), its playback rate (the doppler on a flock's gull, the orca's breath at 0.82). Headphones help: the pan
says where each call is. Levels are true (nothing normalised; the peaks are 0.09–0.22). The calls, their times and places are deterministic (the seeds); WHICH recording of a key plays is the loader's own `Math.random` (never the one just played), so a re-render may pick other variants at the same moments.

Rendered by `node tools/audio/animals_render.js` (57 s on this container). Every number below is from `summary.json`.
All recordings are the Coordinator's picks, **unheard by the user**; every level, reach, mean and gap is a first guess
(SND-TUNE).

| file | scene | listen for |
|---|---|---|
| `orca.opus` (40 s) | a pass at 40 m over the orca pod on Annette's sea lane, 45 m/s, noon | three blows of the pod: a far, dull one at **4.6 s** (560 m, absorbed), then two as the pass leaves the pod: **26.3 s** (377 m) and **28.5 s** (101 m, the nearest and brightest, behind on the left). A gull at 7.4 s (the shore's own). The pass was timed from a scan of the pod's own dive cycle (`podScan` in the summary): the blows are the frames the plume fires. |
| `elk.opus` (150 s) | the Tamgas sanctuary's herd of six, standing 250 m off at 21:48 (the sun 2.5° below the horizon) | two bugles, at **61.3 s** (238 m) and **126.6 s** (221 m) — a herd's clock: never sooner than 40 s apart, a mean gap over a minute, most at dawn and dusk. A varied thrush at 126.5 s (62 m, the forest's) under the second. |
| `bear.opus` (120 s) | three low passes at 25 m AGL, 20 m beside the bear, 40 m/s, noon | **the startle at 18.9 s** (59.7 m: the first pass coming in close and low — 40 % a pass, at most once in 3 minutes, so the next two passes are quiet). An eagle at 29.2 s. The passes themselves are silent: the emitters alone. |
| `gulls.opus` (90 s) | standing on the dock under its flock (seven gulls circling 200 m at 45 m), the ambient flocks crossing | the dock flock's calls at **31.9, 50.6, 72.9 s** (200, 97, 172 m) — each RIDES its bird (listen to the pan move, and the pitch bend a little as it passes: the doppler at 11 m/s); the ambient flocks at 31.9, 45.4, 58.0, 73.7 s (340–450 m, high and thin); the shore's own gulls (nature species) at 1.9, 16.1, 27.6, 86.8 s; a dog in the village at 44.3 s, an eagle at 59.1 s. |
| `mill.opus` (45 s) | the walk to the Kennecott mill (260 m → 90 m), noon | **the recorded stamp mill** (`mill.stamp`, CC BY 4.0) in the loop slot, growing as you walk in: the crusher's pounds, steady across the loop's seam: it is baked UNCUT (the file is cut onset to onset; a crossfade would shorten the period by 1.5 s and break the time every loop). Measured on the file looped three times (8 kHz envelope onsets): the gaps run 0.93, 0.90, 0.91, 0.91, 0.72, 0.67, 0.69, 0.71 s and repeat exactly, and the gap across the seam (0.71 s) is one of them. No procedural rumble was made (`proc: 0`); it is only the fallback when the file is absent. |

`timeline.png`: a row a scene, a lane a sound (a tick a call, taller when nearer; a bar a loop); in scene 1 a line per orca
while it is up. `summary.json`: per scene its hours, sun, seed (one draw each, stated: 2001–2005), the loader (fetches,
decoded MB), every call (t, sound, which animal it came from, where, how far) and the listener's track with the nearest
animal of each species.

## What is not in these files

- The engine and the cockpit's muffle (−12 dB / 900 Hz with the canopy closed): the emitters' chain applies it in the
  page; here the listener is outside.
- The page itself: a cloud session cannot render the world. **`node tools/audio/animals_box.js`** (on the box: Chrome,
  the game on Jolene, one real gesture) carries the aeroplane along the same five scenes, records the page's master bus
  (MediaRecorder, Opus in WebM — the whole mix, engine included; `--quiet-engine` turns the aircraft bus down) and dumps
  the emitters' call log and an animal census a second into `box/`. Unrun by its author. The pod there surfaces on the
  page's own clock, so the rig flies three passes over it.
