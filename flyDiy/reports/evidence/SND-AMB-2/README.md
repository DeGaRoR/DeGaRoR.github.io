# SND-AMB-2: the positional emitters, heard on Jolene (G1665)

`node tools/audio/emitters_render.js` regenerates everything here (about 15 s; `--wav` also writes a WAV).

## What ran

- **The world:** Jolene, the island the game ships (`media/world/jolene` plus the premises fixture `tools/fixtures/island_jolene.json`, composed by the real world module). This is the same world SND-AMB-1's evidence flies. It is not the analytic world.
- **The code:** the page's own code: `samples.js`, `ambience_model.js`, `ambience.js` (its features are what the emitters read), `emitters_model.js` and `emitters.js`. They run in a vm on a recording AudioContext. The shipped MP3s are fetched off the disk (120 ms latency simulated) and decoded by ffmpeg. The procedural sounds come from the model's own `synth()`.
- **The movers** are simulated by their own laws from the record:
  - The proto traffic: 36 roads with traffic, 40 cars. This is render_premises' `moveTraffic` law (35-55 km/h, on the right, turning at the road's ends).
  - The tram: the record's cable link `tw_l_tram`, run by `TRAM_RUN.make` (6 m/s, a 12 s dwell) between the two stations' items.
- **The mill:** the record's site items whose HOUSE_GEN preset says `mill: 1`. The presets are read off `tools/_house_gen.js`, because the generator is a page script. This finds one anchor, the Jumbo Mine's Kennecott mill.
- **Boats:** none. The house piers' boats are HOUSE_GEN's build output. They are not in the record and are not built in node. GATE AUDIO EMITOBJECTS drives the boats on a synthetic provider instead.
- **The tier:** gamer (a cap of 6 one-shots, 3 loops, an 8 MB budget).
- **The seed:** each place gets its own seed (1000 + its index), so one place's draw does not depend on the others' lengths. The counts below are one random draw. GATE AUDIO measures the rates over hours.

## The timeline (610 s, places joined by cuts)

| t (s) | place | local time | what was called (nearest m) |
|---|---|---|---|
| 0-90 | Metlakatla street, 9 m off road `mk_sc40` (traffic) | 15:00 | gull ×2 (151, over the bay), crow (87), **a pickup's pass bound to a car** (44) |
| 90-140 | the harbour shore | 15:00 | pickup ×3 (40, the shore road), crow ×5 in two bursts (51), gull ×3 (103) |
| 140-210 | 30 m from the Skyline tram's valley station | 15:00 | the **rope hum** comes on at the docked cabin (low), the **bell** as the cabin leaves (27), the hum rises with its speed, a **cabin creak** (28), crow ×4, pickup ×2 |
| 210-300 | a forest walk | 15:00 | crow ×2 (89, in the trees), eagle (204) |
| 300-345 | walking to the Kennecott mill | 15:00 | the **mill's rumble** loop |
| 345-405 | Jolene AFB: a taxi, a low pass at 60 m, a climb to 300 m | 15:00 | one crow while taxiing (51); nothing from 60 m up; **silent from 150 m** |
| 405-585 | the forest at night | 23:30 | **an owl** (105, in a tree); no crow, eagle or gull |
| 585-610 | a lake at dusk | 22:36 | nothing: the loon is declared, but no recording ships (`bird.loon` is absent) |

At most 4 one-shots sounded at once (the cap is 6). Peak decoded bytes were 4.79 MB of 8 in the emitters' class. The procedural buffers took 1.35 MB (the tram's hum and bell, and the mill), made off the frame when wanted. The dog and the door did not happen in this draw. The dog averages one bark per 7.5 minutes inside a village by day, so 90 s of street rarely hears it. GATE AUDIO EMITRATE counts them over 3 h of walk.

## Files

- `timeline.png`: one lane per sound. A tick is a call; a taller tick is a nearer call. A bar is a loop; its height is the loop's gain. Below the lanes are the height above the ground and the number of one-shots sounding.
- `places.png`: one 400 m panel per place, north up, with the path in grey. Each call is a dot where it was placed; a ring is a loop coming on. The trees, the sea, the village, the car and the cabin are where the model put each call.
- `walk.opus` (stereo, 40 kb/s): **the emitters alone** (the beds are in SND-AMB-1's evidence). Each call goes through its own gain, the air-absorption low-pass, the panner's inverse distance and an equal-power pan in the camera's frame (the eye looks along the path), at its playbackRate.
- `summary.json`: every call (t, sound, x, y, z, distance), each place's counts and the nearest call per sound, the loader, the movers.

## What to listen for

- **0:00-1:30:** gulls far off over the bay, a crow, and at about 1:23 a pickup crunching past from left to right. Its pitch falls as it passes: the doppler on the car's own velocity.
- **2:20-3:30:** the tram's low hum at the dock, a two-strike bell at 2:28, then the hum swelling as the cabin climbs away overhead, and one creak.
- **5:00-5:45:** the mill's stamps (about 1.6 a second) and its rumble, growing as you walk in.
- **6:00-6:45:** a crow during the taxi, then nothing from the low pass on (the ceiling).
- **8:45:** an owl in the night forest.

**The A/B:** `?audio=0` builds none of this. The emitters' own switch is their tier: `EMITTERS.setTier('light')` gives a cap of 3, 2 loops and 3 MB.
