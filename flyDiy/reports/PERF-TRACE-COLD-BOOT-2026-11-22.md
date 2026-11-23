# A cold load of perf-codex, explained by its own log

**PERF-TRACE, 22 November 2026.** One real cold load read with the new instruments: every program by its owner,
what each loading step waited for, the freeze ledger, the decision table. Measured against `flyDiy/PERF-OBJECTIVES.md`.

## What was captured

A0 ran four cold loads on the RTX 3080 box between 07:00 and 07:18 with `tools/perf/log_capture.js` (on the shared
`page_rig.js`). Evidence: `D:/Dev/flydiy-notes/evidence/perf-trace-2026-11-22/`.

| Run | Build | Garage | Flying | Programs | Package at start / peak |
|---|---|---:|---:|---:|---|
| cold1 | perf-trace-1 `9ff42735a` (on perf-codex-green) | 138.1 s | 154.0 s | 544 | 86 / 97 °C |
| cold2 | same | 137.4 s | 153.4 s | 544 | 80 / 97 °C |
| off | same, `?progid=0` (registry off) | 132.2 s | 148.1 s | 544 | 71 / 98 °C |
| base | perf-codex-green `cc0495b93` (no owner labels) | 130.6 s | 146.5 s | 544 | 70 / 94 °C |

**This is not the user's benchmark condition.** The capture is a new player's default state (page_rig wipes the saved
game), in headless Chrome at 1600x900 with the frame rate uncapped. PERF-LEAD's own loads use a pinned Cub in a
visible 5K window and link 456 programs in about 114 s. The two series are not comparable in absolute seconds; what
this report says about *what the load is made of* is what carries over.

## 1. The loading steps and what held each

The garage screen's steps run one after the other, so their chain is the critical path. For cold1 (126.7 s of steps):

| Step (the game's own name) | Start | Seconds | Main thread busy | Held by |
|---|---:|---:|---:|---|
| world: laying out the world | 11.2 | 34.1 | 25.9 | **main thread** |
| town | 46.3 | 2.6 | 0.9 | network (ended with its last fetch) |
| ring: growing the forest | 49.3 | 2.9 | 0.2 | not proven |
| settle: the world settling | 52.2 | 15.8 | 4.8 | **not proven** |
| upload | 69.5 | 1.8 | 0.3 | not proven |
| **worldCompile** | 71.4 | **51.6** | 0.8 | **programs** (ended with its last link) |
| compile (the shed) | 122.9 | 4.5 | 0.2 | programs |
| firstFrame | 127.4 | 3.7 | 3.3 | main thread |
| frames | 131.2 | 4.3 | 4.0 | main thread |

By kind: 56.3 s waiting on shader links, 46.9 s of main-thread work, 20.5 s not proven, 3 s network.

"Not proven" is a real gap, not a rounding: `settle` is 15.8 s with the main thread busy for 4.8 s and no link that
ends with it. The page's workers (houses, forest, physics) leave no event in the log, so a step waiting on one cannot
be named. That is the next thing to instrument.

## 2. The 51.6 s shader wait is two things

`worldCompile` submitted 350 of the load's 550 links.

- **For about 38 s it is a queue.** The pacer lets 8 programs link at once, and the number in flight sits at exactly 8,
  two seconds after two seconds. The page always has more to submit; the limit is the pacer and the driver behind it.
- **For its last 12 s it waits on one program.** `pavement / runways and aprons / surface` (202 KB of GLSL) was
  submitted at 46.3 s, during the town step, and was first seen ready at 122.8 s: 76.5 s pending. The step ends 0.1 s
  later, and only then are its last 24 programs submitted. They link in under 2 s.

The whole load had something linking for 87.6 s. Splitting that wall time between the programs pending at each instant
("pending share", an upper bound on what each could give back, not a CPU measurement):

| Owner | Programs | Pending share |
|---|---:|---:|
| pavement / runways and aprons / surface | 1 | 27.2 s |
| aircraft / skin (all finishes and variants) | 79 | 30.7 s |
| terrain / island ground rings + premises patch | 5 | about 12 s |
| props / prop library / baked record | 67 | 2.8 s |
| everything else | about 400 | about 15 s |

## 3. The aircraft's skin: 79 programs, most of them never drawn

Every skin program carries the whole fragment shader, 187 to 210 KB. Together they are 15.8 MB of the load's 53.9 MB of
GLSL.

- The finish is **not** what multiplies them. Every finish value is a uniform; the finish in an owner label is only
  the name of the material found holding the program. (An early reading of mine said otherwise; PERF-LEAD's map of
  the skin code corrected it.)
- What multiplies them is context: Standard or Physical, the surface switch, the side (front, back, double), the
  near-only variant, the scuff wrapper, the scene's light counts, and the render target.
- **Two targets.** 53 skin programs are keyed for the view. 22 are keyed for the hangar's 256-pixel reflection cube
  (`ensureEnvRT`, app.js), and only 2 of those 22 were ever drawn. The aircraft is deliberately hidden when that cube
  is shot, so they are linked for a picture it is never in. PERF-LEAD is testing a switch for this (`?cubelean=1`).

Over the whole run (garage plus two minutes of flight) **217 of 550 programs were linked and never drawn**: 22.8 MB of
GLSL and 24 s of pending share. 123 of them were compiled by `worldCompile`. "Never drawn" means no `gl.useProgram`
of it in this log; a longer run with a crash, a cutaway or the interior view will reach some. The afternoon's
27-minute journey gives the honest list.

## 4. Two things that turned out not to matter

- **77 links re-link a text already linked** in the same load (31 texts, 2.3 MB). Every one was submitted after its
  first copy was ready and most return at once. They cost a key and a source build each, not a compile and not a pacer
  slot.
- **Eight cache keys differ between two loads of the same build.** They are all full-screen passes (anti-aliasing
  blit, bloom, the frame catcher) and their shader text is identical in both loads; the key carries three.js's own
  shader counter, which follows the order the passes are first compiled. The browser caches on the text, so these are
  not misses. The labelled build and the unlabelled base differ by the same eight and nothing else: **the owner labels
  changed no program.**

## 5. Frames (read with care: uncapped, headless, two minutes)

| Objective | Verdict | What the log shows |
|---|---|---|
| 8. No world freeze over 100 ms | not met | 2 frames over 100 ms in 128 s, worst 232 ms |
| 9. Evenness, 20-second blocks | not met | 6 of 6 blocks have a frame over 35 ms; 2 have one over 100 ms |
| 10. Loading screens stay responsive | not met | 13 frames over 100 ms, **worst 1.9 s** |

- 99.5 % of the world's excess frame time is attributed. The largest named causes are the cover ring (1.2 s over 90
  frames) and the scene's posing (0.9 s over 42 frames), then one 206 ms frame held on a shader link.
- The 1.9 s frame under the loading screen is one timer: a `poll` function in app.js. It is one of the loops that ask
  whether programs have finished linking; a poll that blocks for 1.9 s is exactly what should never happen there.
- **In flight the game sends about 4 MB to the GPU every frame**: about 73 buffer updates, 54 buffer creations and 70
  texture calls, whether anything new arrived or not. That is the frame's floor, not a spike. The `?recup=1`
  diagnostic (in perf-trace-4) names whose buffers and textures those are.

## 6. By feature

What each feature cost in this load. "Bound" is its own steps plus its share of the compile steps: the most the load
could gain without it. The marginal delay is **unknown** for every row: only a controlled on/off pair measures it.

| Feature | Programs | GLSL | Link-queue share | Own steps | Bound |
|---|---:|---:|---:|---:|---:|
| terrain | 6 | 0.9 MB | 12.1 s | 34.1 s | 36.8 s |
| aircraft | 142 | 21.8 MB | 32.8 s | 4.0 s | 35.5 s |
| pavement | 3 | 0.3 MB | 27.2 s | 0 | 17.8 s |
| town | 47 | 4.9 MB | 2.3 s | 2.6 s | 3.4 s |
| garage | 72 | 7.3 MB | 2.6 s | 0.9 s | 3.1 s |
| forest | 18 | 1.2 MB | 0.4 s | 2.9 s | 3.0 s |
| props | 87 | 10.1 MB | 3.6 s | 0 | 2.4 s |
| sky | 23 | 0.4 MB | 2.8 s | 0 | 0.8 s |
| unowned | 61 | 4.3 MB | 2.1 s | 0 | 0.8 s |

## 7. What the recording itself costs: not settled

The two registry-on loads reached the garage about 5.5 s later than the registry-off load and 7 s later than the base.
The registry times itself in the log: 104 and 114 ms of source hashing and 25 ms of owner look-ups per load, about
0.13 s in all. The gap also shows in steps the registry barely touches (world, settle), and the two "on" loads were
the two hottest starts (86 and 80 °C against 71 and 70 °C, in run order). I read it as the box, but four runs in that
order cannot prove it. PERF-LEAD's quiet-box rows (registry off, recorder off, base) decide; if the cost is real the
hashing goes behind a flag.

One defect the captures did expose, fixed in perf-trace-4: the recorder's new GPU-data event fired on 4 929 of 5 788
frames, because its bar was below the game's steady traffic. It now fires only on frames that create GPU data, and the
steady traffic is a per-run total.

## 8. Still open

- **61 programs have no owner** (4.3 MB, 2.1 s of share). Their materials are unnamed and this log cannot say whose
  they are. From perf-trace-4 an unowned row describes its material and the object wearing it; the next capture names
  them. Until then the census for GATE PROGRAMS part 8 is not pinned: pinning 61 unowned would be a truthful red.
- **Workers are not recorded**, so 20.5 s of this load's steps read "not proven".
- **The variant signature was incomplete** in this capture (it stopped at the fragment prefix). Light and shadow
  counts, tone mapping, output encoding and the scuff switch are added in perf-trace-4; the first skin matrix on its
  real axes comes from the next load on that build.
- **The user's own condition** (visible 5K window, pinned Cub, the 27-minute journey) is the 14:00 slot's.

## How to reproduce

```
node tools/perf/log_capture.js --out <dir> --tag cold1 --page dev.html --q "" --flight 120 --cap 900 --reports
node tools/program_report.js <dir>/flightlog-cold1.json      # steps, queue or heavy, owners, never drawn
node tools/freeze_ledger.js  <dir>/flightlog-cold1.json      # frames over 50 ms with causes, objectives 7-10
node tools/load_timeline.js  <dir>/flightlog-cold1.json      # Perfetto trace + the per-step table
node tools/decision_table.js <dir>/flightlog-cold1.json      # by feature
node tools/load_brief.js     <dir>/flightlog-cold1.json      # ten lines
```

`cold1.trace.json` in the evidence folder opens in ui.perfetto.dev: 23 lanes, the steps by their own names, every
program from its link to its first ready by owner.
