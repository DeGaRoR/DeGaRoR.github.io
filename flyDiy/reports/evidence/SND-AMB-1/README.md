# SND-AMB-1 — the ambience's flight log (G1653)

**The world is Jolene, the island the game ships**: `media/world/jolene` composed through `tools/island_node.js`
with the premises fixture `tools/fixtures/island_jolene.json`. That is the real world module, not the analytic stand-in.
The day is the game's own: 2026-06-21, 16:00 local, the 8 kt breeze from 250° (`day_clock.js` GAME_DAY).

**What plays it is the page's own code.** `src/viewer/audio/ambience.js` + `ambience_model.js` + `samples.js` run in a vm
on a *recording* AudioContext. The beds are the shipped MP3s from `sfx_catalogue.json`, fetched off the disk with a
simulated 120 ms latency, decoded by ffmpeg at 48 kHz, and baked by the loader's own `bakeLoop` (the full tier: 20 s
loops, equal-power crossfade). The mix is then rendered from what the source **scheduled**: every buffer source, its
random start offset, its stop, and every `setTargetAtTime` on its gain. What you hear is what the page would play,
loading delays included. It is rendered at unit bus gain (before the player's *environment* and *master* volumes) and
not normalised: peak ~0.5, ~−28 dB RMS. Each loop starts at a random offset, as on the page, so these move a
little from run to run.

Regenerate: `node tools/audio/ambience_render.js` (about 30 s; `--wav` keeps a WAV as well).

## The files

| File | What |
|---|---|
| `flight_day.opus` | 200 s, mono, 48 kb/s: the path below, by day |
| `flight_day.png` | the weight timeline: one lane per bed (the smoothed weight filled, its target dotted), the height, the beds decoded at once |
| `flight_night.png` | the same path at 23:45 (weights only, no audio) |
| `places.png` | the steady weights at seven canned places on Jolene (also checked in GATE AUDIO AMBJOLENE) |
| `summary.json` | every round's weights and targets, the loader's counts, the places by day and by night |

## The path

A straight line from the stand at Jolene AFB (−154, 712) toward the bay (1072, −3375), 4.27 km. The camera is the
listener.

| t (s) | where | height |
|---|---|---|
| 0–12 | the stand at the airfield | 1.7 m |
| 16–62 | the heath (shrub, grass, a pond, a creek), 60 m/s | 6 m |
| 66–96 | into the forest (it lies inside the village zone `z_village`) | 6 → 4 m |
| 96–128 | a street of the village, standing 10 s at 108–118 | 1.7 m |
| 128–146 | the shore: the forest thins, the waterline at ~d 3700 m | 4 → 3 m |
| 146–156 | on the harbour's water (`z_harbour`) | 3 m |
| 156–184 | the climb over the bay | 3 → 300 m |
| 184–200 | 300 m over the water | 300 m |

## What you should hear when

- **0–12 s, the stand.** The **airfield** bed (the windsock, a far generator) fades in over ~3 s, under the
  **light wind**, with a touch of **clear wind** (the stand is open apron). Nothing pops: every bed starts silent
  and rises at most 0.35 a second.
- **16–62 s, the heath.** The airfield goes away behind you. **Meadow** comes up (shrub and grass). Near 25–35 s you
  pass a **pond** (the edge bed *lake.near* briefly, *lake.lap* a little longer) and a **creek** (*stream*,
  25–45 s). Thin stands of trees bring the **forest** in and out at low weight.
- **66–96 s, the forest.** **Forest by day** takes over (0.8). The **village** murmur rises at the same time,
  because this forest *is* the village zone of the premises record (houses among the trees).
- **96–128 s, the village street.** Forest and village hold. The **harbour** starts to come in from the north, and
  the **surf** begins far off (the shoreline is ~250 m ahead).
- **128–146 s, the shore.** The forest drops out and the **surf** rises to ~0.75, with a little **rocks** where
  the shore steepens. **Harbour** and **village** are at full.
- **146–156 s, on the harbour's water.** **Surf** and **harbour**, the village behind you (0.36).
- **156–184 s, the climb.** Everything on the ground fades with height. By ~150 m it is gone, the surf last (it
  carries to ~220 m). The **clear wind** and then the **mountain wind** (altitude) take over.
- **184–200 s, 300 m.** Only wind: *clear* and *mountain*.

**At night (`flight_night.png`)** the forest lanes swap to **forest by night**. **Frogs** sing at the stand (a pond
100 m away) and **loons** sit very low in the background (−17 dB, the user's "really background"). On the open heath
the **mountain wind** bed carries the crickets.

## The loader along the path

The full tier (gamer): N = 6, 24 MB decoded.

- At most **6 beds decoded at once**; the decoded peak was **21.3 MB of 24**.
- **28 fetches/decodes** in 200 s. A bed that leaves the top 6 fades out over 0.4 s and gives up its slot. A bed
  silent for 12 s is released anyway.
- Nothing is fetched before the gesture (GATE AUDIO AMBGESTURE).

## Places (Jolene, 16:00 — `places.png`)

| place | where | the beds |
|---|---|---|
| forest interior | (1840, −4640) | forest.day 0.97, wind.light 0.71 (sheltered: no clear wind under the canopy) |
| beach | (2480, 180) | surf 0.81, meadow 0.48, wind.light 1 |
| village street | Metlakatla (−3400, −8700) | village 1, meadow 0.64, wind.light 1 |
| lake shore | the island's biggest lake, west edge (1771, −7701) | lake.lap 1, lake.near 0.68, forest.day 0.50 |
| stand at Jolene AFB | (−154, 712) | airfield 1, wind.light 0.85, wind.clear 0.48 |
| 500 m AGL | over HOME | wind.mountain 1, wind.clear 0.40 — every ground bed 0 |
| garage | — | hangar 1; through the door forest.day 0.22, meadow 0.15, wind.light 0.15 |

## What this evidence does not show

- **The muffle.** The cockpit duck and lowpass, the garage's door, and under water are not heard here, because this
  path is exterior. GATE AUDIO AMBMUFFLE holds their values.
- **Rain.** There is no precipitation in the world yet (owed by CLIMATE). `AMBIENCE.rain(v)` is the hook, and the
  garage's roof-rain bed answers it (GATE AUDIO AMBPLACES).
- **The listening.** No session can hear this file. The levels are first guesses for SND-TUNE.

## The SOUND section of the world editor (G1656–G1658, `editor/`)

`tools/audio/sound_editor_proof.js` drives the **built game page** in headless Chromium. The game boots on Jolene, rolls
out, a click unlocks the sound, and the world editor opens. Then the editor's own script API (the same paths the mouse
runs) does the following:

1. It drops a **point sound**: loons, 80 m off the stand.
2. It draws a **sound area**: the harbour's bed, over the heath.
3. It draws an **OFF area**: the airfield's bed, silenced around the stand.
4. It drags the point 30 m.
5. It probes what is heard.

What the page reported (`proof.json`):

| What | Result |
|---|---|
| The record | `snd1` (a point, dragged from x −100 to −70), `snd2` (an area, on), `snd3` (an area, off); no issues |
| The renderer's sound lines | 7: the point's pin, full-strength ring and reach ring; each area's outline and reach line |
| The ambience | holds 3 sounds, told by the editor without a recomposition |
| At the point | loons 1.00 (no loons by the rules there, by day) |
| In the harbour area | harbour 1.00 |
| At the stand | the airfield bed silenced (1.00 → absent) |
| The cost of an edit | a sound edit 141 ms (the inspector's probe included); a zone edit 3760 ms (a full composition); no page error |

- `inspector_point.png`: the SOUND section in the editor's rail, a selected point sound (the bed, ON / OFF, its reach,
  and **HEARD HERE**: the beds the ambience plays at that spot, as bars).
- `inspector_probe.png`: the section with no selection, the bed to draw, and the probe's bars.
- `map.png`: the editor's whole page. The 3D viewport stays blank under this box's software renderer (SwiftShader), so the
  drawn lines are proved by name in `proof.json`, not by the picture. A GPU box shows them.
