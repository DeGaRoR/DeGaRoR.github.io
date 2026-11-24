# PERF-TRACE handover (23 Nov 2026)

The session that built the program registry, the owners, GATE PROGRAMS and the log readers. Branch `claude/perf-trace`
(base `claude/perf-codex`); ready refs numbered and never moved: `claude/ready/perf-trace-7` (L40M), `-8` (L40N, tools
only). The how-to for reading a log is `tools/PERF_TRACE.md`; the history is `HANDOVER.md` (PERF-TRACE 2-5, 6, 7, 7c).

## 1. The tools, one line each

Every reader takes one `*.flightlog.json`, prints text, `--json` for data. On the box: through `cpu_token.sh`, nice 19.

| Tool | Use | What it answers |
|---|---|---|
| `tools/freeze_ledger.js <log>` | the first reader to run on any flight | rows 7-10 met or not; every frame over 50 ms with its cause; the still pictures with what linked over them and what the guard held |
| `tools/crash_window.js <log> [--at S \| --mark name] [--stills-recorded]` | a crash | row 14; half-second bins after the impact; the wreck at rest; programs linked / first drawn after it, each against its nearest earlier sibling; the scene slot's split (`?recscene=1`) |
| `tools/link_waits.js <log> [--until garage\|reveal\|world\|all]` | a load | the page blocked on a shader link, by owner and by boot step; drawn "at once" (a prelink removes it) or "late" |
| `tools/load_timeline.js <log>` | a load | the steps, what each waited for, worker lanes; a Chrome-trace JSON for ui.perfetto.dev |
| `tools/program_report.js <log>` | a load | every program by owner: count, text KB, link and pending time, never drawn, unowned |
| `tools/program_diff.js <A> <B>` | two loads | programs only in A / only in B by owner, heavy ones in both, linked more than once, the steps side by side |
| `tools/program_matrix.js <log> [--family "aircraft / skin"] [--against <log>]` | one family | its programs on their real axes: defines, light signature, twins |
| `tools/slot_frames.js <log> --slot <name>` | one slot of the loop ran long | what the events put inside it; a streamer's own split; the slot over time (laps); the 15 worst |
| `tools/big_uploads.js <log>` | hitches from new GPU data | each upload of 30 ms or more with what delivered just before it |
| `tools/decision_table.js <log>` | keep / cut decisions | one row a feature: programs, link seconds, frame cost |
| `tools/program_sites.js` | the source, no log | every place a material is made and whether it declares an owner (GATE PROGRAMS part 7) |
| `tools/perf/log_capture.js` | on the page rig | captures a log from a load |
| `tools/_program_check.js`, `_progid_check.js` | GATE PROGRAMS | owners declared at every site, every Worker named, the registry adds no GL call, the tables' shapes |

In the page: `src/viewer/program_id.js` (the registry: `material.userData.progOwner`, metadata only, never in a cache key)
and the hooks in `flight_recorder.js`.

## 2. What tools 5-8 added to the log

| Tool | Where | What | Shape |
|---|---|---|---|
| 5 | events | `wk`, `wkend`, `wkmsg` | a worker made / ended; a reply whose handler held the main thread 16 ms or more |
| 5 | header, table | `workers` | by worker name: made, ended, first sent, last reply, 250 ms buckets `[bucket, sent, received, handler ms, still out]` |
| 6 | table | `uploads` (+ `.gl`) | by owner with `site`, `dim`; GL-level rows keyed by the array or image uploaded; only under `?recup=1` |
| 6 | event | `recupwalk` | the naming walk's cost under `?recup=2` |
| 6 | table | `laps` | `{ every, frames, rows, longFrames, long }`; a lap = `[slot, t, GPU ms, GPU calls, updated bytes, draw calls, triangles]`; frames of 50 ms or more kept apart |
| 6 | event | `deliver` (far terrain) | `{ s: 'far terrain', what: 'quadrant re-cut', n, was, kb }` |
| 7 | flags | `fewDraws` 512, `notShown` 1024 | a world frame under 60 draw calls (header `fewDrawsUnder`); a frame rendered and not presented |
| 7 | event | `crash` | `{ k: 'impact', breaks, spd, agl }`, `{ k: 'breaks' }`, `{ k: 'rest' }` |
| 7 | event | `guardhold` | `{ held, new: [object/material <owner>] }`; the lab adds `ground` |
| 7 | event | `deliver` (cover ring) | `{ s: 'cover ring: <layer>', n, what, plantMs, blocks, blockMs, queued }` for an update of 4 ms or more |
| lab | event | `still` | `[t at its end, ms, { f: frames held, keep }]` (PERF-LEAD's app.js) |
| 7b, 7c, 8 | readers only | no change to the log | the counting rule (over 50 / 100 / 250 ms from 54 / 104 / 254), `link_waits.js`, the crash bins |

## 3. What the readers do NOT see

- INSIDE A SLOT. A slot is one number. It is split only where a streamer reports itself (`deliver`), for `scene` under
  `?recscene=1` (one frame in 31), or by a CPU profile. "The scene slot is 45 ms over" names no function.
- THE SCREEN. Frame times are not what was shown. Only `still` / `notShown` say the picture stood; nothing says a frame
  was shown with parts missing (the guard's held draws under `?holdframe=ground`): `guardhold` counts them, a screenshot
  proves it.
- WHEN A LINK REALLY ENDED. `readyT` is when three's poll first SAW it ready; a program nobody polls reads pending.
- A KEY THAT CHANGES WITHOUT A NEW MATERIAL (a light count): it is a new row with the same owner, not flagged as a relink
  of the same material; `program_matrix.js` shows the signatures.
- RAW GL PROGRAMS (the skin's own): a link with no three.js program and no owner.
- A WORKER'S OWN TIME: only the messages and the main thread's handler time.
- UPLOADS BY OWNER unless the page ran `?recup=1`; the per-frame buffer updates are bytes and a count, never timed.
- EARLY EVENTS OF A LONG RUN once the ring wraps (header `eventsDropped`); memory; the network (the rig's own JSON).
- GPU TIME where another timer query is open (`gpuForeign`) or under `?recgpu=0`.

## 4. What I would do next

1. THE DRAW GUARD HOLDS A FRAME FOR A MATERIAL WHOSE PROGRAM EXISTS (shader_warm.js: `props.get(material).programs ===
   undefined` is true for any new material object). Six of the eight stills of the 07:00 journey of 23 Nov had no program
   linking over them. The 13:00 journey's `guardhold` names the materials; the change, if wanted, is PERF-LEAD's.
2. THE CENSUS PIN (`tools/perf/program_owners.json`, GATE PROGRAMS part 8) from a cold capture on the landed build: after
   it, a new program without an owner, or a family that grows, fails the gate.
3. THE SCENE SPLIT ON THE FRAMES THAT NEED IT: sample `sceneDetail` on every frame of 50 ms or more instead of one in 31.
4. `link_waits` IN THE RIG'S OWN SUMMARY (against-objectives): the blocked seconds of a load by owner, every row.
5. The rock ring reports itself like the cover ring's four layers; the far terrain's `deliver` gains its quadrant key.
6. One origin for "seconds since the reveal" across the readers (crash_window says both; slot_frames uses the first).
7. The recorder's own cost written up from the PROGID0 / REC0 rows of 22 Nov (measured, never reported).

## 5. Added 24 Nov: the GPU's time by pass (the user: "get some headroom on the graphic card, maybe reach below 30 ms per frame")

Ready refs `claude/ready/perf-trace-9` (the tool) and `-10` (it keeps the heavy frames), both on the lab's tip.

| Tool | Use | What it answers |
|---|---|---|
| `?recgpu=pass[:N]` on the page | one frame in N (4) timed as a chain of GPU timer queries | nothing without the switch; the log's table `gpuPasses` |
| `tools/gpu_passes.js <log> [--mark step] [--against other.json]` | a cruise flown with the switch | GPU ms by pass (median, p90, share, ms a megapixel), the passes' sum against the whole-frame timer, the render scale in time order with what the controller aims at, two logs side by side |
| `tools/flight_scripts/perf/cruise_gpu*.json` | the journey's start, 30 s of climb, 75 s en route | the same seconds for every row; `_auto` switches the automatic scale on, `_smoke` is load + 8 s |
| `evidence/perf-trace-gpu-2026-11-24/rows_0736.sh`, `rows_1300.sh` | a GPU window in one command (`PT_DRY=1` = the preflight alone) | the pattern for the next one: a smoke first, a baseline flown in the same hour, one setting down a row |

The log's additions: table `gpuPasses { every, labels, frames, kept, lost, lostBy, segMax, segCap, rows }`, header
`gpuTimer.byPass`, event `aascale { scale, auto, w, h, targetMs }` (the render scale when it changes).

WHAT THE FIRST REAL ROWS SAID (24 Nov 07:36, RTX 3080, 5120x1271, the 75 s en route over land, the lab's tip):
- The whole frame: 30.0 ms median, 42 at the 90th percentile with `mirpace` + `farslots` on (36 % of frames over 33.3 ms);
  32.9 / 45.1 without them. 899 draw calls and 14.8 M triangles a frame (on the ground: 2 009 draws, 28.5 M, GPU 40 ms).
- By pass (median ms, the base): scene pass 28.6 (87 %), clouds march 2.55, shadow maps 0.58, post 0.26, AA resolve 0.16,
  uploads 0.1, the mirror 0 over land. The sums agree with the whole-frame timer (32.6 against 33.1; 30.0 against 30).
- THE GPU'S TIME IS PIXELS PLUS TRIANGLES, read over THE SAME SECONDS of two rows (full scale against the automatic
  scale): about 1.9 ms a megapixel (12 ms of a full-scale cruise frame), and a part that does not scale with resolution and
  FOLLOWS THE TRIANGLE COUNT - 12 ms at 12 M triangles, 18 at 15 M, 31 at 38 M, roughly 0.75 ms a million.
  So THE FRAMES OVER 33.3 ms ARE THE LOW ONES: in the first 77 s after the reveal (the ground, the climb) the card takes
  37-39 ms median with 37-38 M triangles a frame whatever the scale; at altitude the same build cruises at 24-30 ms.
  "Below 30 ms" is met at altitude and missed near the ground, where resolution buys almost nothing: geometry (the
  cover, forest density and detail, the far terrain) is the lever.
  (I first compared different seconds and wrote "a fixed 13 ms": the scene's load changes too much along a flight for
  that. COMPARE THE SAME SECONDS - `--from / --to`, or the same script step.)
- THE AUTOMATIC SCALE WAS HELD LOW LONGER THAN NEEDED: the climb pushes it down (1 -> 0.85 -> 0.75 -> 0.67 -> 0.5); its
  way back up asked g x k^2 < 0.8 T, the GPU's time as if all of it were pixels, so at 0.5 it waited 37.6 s (until g fell
  under 14.8 ms) before climbing to 0.67 by itself. PERF-LEAD changed the rule the same morning (the lab, aaAutoDecide: the
  part that does not scale is learnt). That part is not a constant - it runs from 12 to 31 ms with the scene. The
  controller's target follows the frame cap (app.js tellScale) - I first wrote that it chased 60 whatever the cap: wrong.

WHAT THE TOOL DOES NOT DO, learnt the same morning:
- IT CANNOT SPLIT ONE PASS. Cover ring, far terrain, trees, the aeroplane are drawn interleaved in the scene pass. A
  family's cost is the difference of two flights of the same seconds (`--against`), one setting down.
- ITS FIRST BUILD (-9) LOST 60-70 % OF THE PASS FRAMES, the heavy ones: more renders in a frame than its 48 segments (the
  shadow map's wrapper pushes on every renderer.render). The medians stood (the sums agreed); the tail was not in the split.
  -10 fixes the cause I believe it was and counts every lost frame by its reason: READ `lostBy` FIRST on any new log.
- A link wait's owner (tools/link_waits.js) is the program ASKED for its status. Where the driver was busy with something
  else - the clouds march's two-output variant built at its first draw, 1.4 s - the owner is wrong and the milliseconds
  are right. The program first drawn just before the wait is the one to look at.

THE LEVERS (24 Nov 13:00, the same cruise, one setting down a row, against a base of the same hour; whole-frame GPU
median / p90 change in ms; base climb 38.1 / 49.8 at 38 M triangles, cruise 30.1 / 42.8 at 15 M; noise about 0.6):

| lever | climb med / p90 | cruise med / p90 | CPU loop, climb |
|---|---|---|---|
| render scale 0.75 | -5.9 / -3.6 | -3.9 / -5.7 | -4.3 |
| ground blend lean | -4.9 / -4.3 | -2.8 / -4.9 | -4.3 |
| shadows off | -4.6 / -8.9 | not valid (the rig's cap) | -8.0 |
| msaa4 | -3.1 / -2.9 | -1.8 / -2.1 | -3.6 |
| ground cover off | -2.5 / -10.8 | +0.5 / -3.4 | -6.7 |
| forest detail minimum | -1.4 / -4.7 | +0.3 / +0.1 | -2.9 |
| forest density 100 | +0.9 / +2.8 | -0.4 / +0.6 | +1.6 |

- The median is pixels and the ground shader (scale, ground blend). The tail near the ground is the cover and the
  shadows: each halves the climb's triangles (the shadow maps' draws are in renderer.info's count) and cuts the CPU loop
  by 7-8 ms - near the ground the loop is 36.8 ms, over the 33.3 budget on the CPU side too.
- The per-pass "shadow" segment (three's shadowMap.render) reads 0.1-0.6 ms while shadows off saves 4.6: most shadow work
  is elsewhere. Use the knock-out's number.
- SETTING clouds 'off' THROUGH GFX.set MID-FLIGHT RESTARTS THE FLIGHT (the sim's clock back to 0, a fresh recorder): that
  row has no data. A setting that rebuilds the page goes in the query, not in a page step.
- PERF-LEAD's new scale rule (the part that does not scale, learnt): it now tries to climb back (two trials up in the
  cruise); after a failed trial its 60 s hold kept it at 0.5 to the end of the 75 s window. A longer cruise is the test.

NEXT, in order: ground blend 'lean' judged by the user's eye as a default (the cheapest median lever, no pixels lost);
the cover's shadow-map copies near the ground (a cover that casts no shadow, or a nearer shadow cut-off for it - the p90
lever, not "cover off"); the automatic scale's new rule on a cruise long enough for its 60 s hold to expire; the clouds
and terrain rows again with the setting in the page's query; then the census pin of section 4.
