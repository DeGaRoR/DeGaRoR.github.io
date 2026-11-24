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
