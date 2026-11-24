# PERF_TRACE.md - reading a flight log for performance (the handover of 23 Nov 2026)

One file answers almost every "why was it slow" question: the flight recorder's log (`*.flightlog.json`, saved by the page
and by every rig run). These readers turn it into named causes. All are plain node, read one log, print text (`--json` for
the data). On the box every run goes through the token queue:
`bash D:/Dev/flydiy-notes/cpu_token.sh run <WHO> -- nice -n 19 node tools/<reader>.js <log>`.
The history and every finding are in `HANDOVER.md` (sections PERF-TRACE 2-5, 6, 7, 7c); the official targets are
`PERF-OBJECTIVES.md`.

## Which reader for which question

| The question | The reader | What to look at first |
|---|---|---|
| Are the user's rows met (freezes, orange frames)? | `freeze_ledger.js <log>` | the verdicts at the top (rows 7-10), then THE PICTURE STOOD STILL |
| Why is the load long? | `load_timeline.js <log>` | the steps and what each waited for; its trace JSON opens in ui.perfetto.dev |
| Whose shader programs, how many, how heavy? | `program_report.js <log>` | by owner; never-drawn; unowned (must be 0) |
| What blocked the page on a shader link? | `link_waits.js <log> [--until garage\|reveal\|world\|all]` | BY OWNER, then "at once" vs "late" |
| Two loads: what did the change do? | `program_diff.js <A> <B>` | only-in-A / only-in-B by owner, the steps side by side |
| One program family on its real axes | `program_matrix.js <log> [--against <log>]` | the light signatures, the twins |
| One slot of the loop ran long: why? | `slot_frames.js <log> --slot <name>` | WHAT THE EVENTS SAY HAPPENED INSIDE IT, the 15 worst |
| Big GPU uploads | `big_uploads.js <log>` | what delivered just before each (far terrain, cover ring) |
| A crash (row 14) | `crash_window.js <log> [--stills-recorded]` | ROW 14, THE SECONDS AFTER, THE WRECK AT REST, PROGRAMS LINKED AFTER |
| A feature's cost, one row each | `decision_table.js <log>` | programs, link seconds, frames |
| Does every material say whose it is? | `program_sites.js` (GATE PROGRAMS part 7) | the sites without an owner |

## What is in the log

- `frames`: one row a frame - its time `t` (the rAF timestamp), the loop's slots in ms (`script solver world prem cover fill
  scene hud mirror render shadow shader other`), draw calls, triangles, GPU ms, speed, height, flags.
- `events`: `[t, kind, ms, data]`. The ones that matter: `link` / `linkwait` (a link submitted / the page blocked on one),
  `proguse` (a program's first draw), `gpuup` (new GPU data in a frame), `deliver` (a streamer says what it delivered: far
  terrain, the cover ring's layers), `still` (the screen showed no new picture: its length), `guardhold` (the draw guard
  kept draws out: how many, which materials, the ground's share), `crash`, `mark` (`seg:<step>` of a flight script),
  `boot`, `reveal`, `wkmsg` (a worker's reply that held the main thread), `sceneDetail` (only with `?recscene=1`).
- `programs`: one row a shader link - its OWNER (`material.userData.progOwner`, declared where the material is made), its
  text's size and hash, its defines and light counts, when it was linked, seen ready, first drawn, how long draws waited.
- `uploads`, `workers`, `laps`, `premises`, `resources`: the tables their readers use.

Page switches: `?rec=0` (recorder off), `?recscene=1` (the scene slot's split), `?recup=1|2` (uploads by owner / with the
naming walk), `?reclaps=N`, `?recgpu=0`, `?recwk=0`, `?progid=0`. A capture on the rig: `tools/perf/log_capture.js`.

## The reading rules (each one cost a wrong conclusion once)

1. READ A FREEZE ON THE SCREEN, NOT ON THE FRAME TIMES. A frame the draw guard holds is rendered and not presented: its
   time is an ordinary frame's while the picture stands still for seconds. The `still` events are the truth; a log without
   them says "STILL PICTURES NOT RECORDED" and proves nothing about the screen.
2. THE COUNTING RULE: a frame is over 50 / 100 / 250 ms from 54 / 104 / 254 ms (the limits sit on whole display intervals);
   the frames AT a limit are printed beside, never dropped.
3. A row's work is drawn in the interval that ENDS at the next row. Map an event to the row whose `t + work` is nearest.
4. Light and shadow counts are read from the shader's array DECLARATION, never from the largest index used.
5. A CPU profile charges a native GL call to the JS function that made it: with the recorder on, that is the recorder's
   wrapper. It is the call's time (a link wait, an upload), not the recorder's - check against the log's own sums.
6. An owner is metadata only: never in a cache key, never a reason for a new program. A change to GLSL, defines or
   variants is PERF-LEAD's; an owner LABEL at a material site is this tool's.
7. A wrong hypothesis is said as one, then tested on the log. Several here were wrong (the grass ring for the big uploads:
   it was the far terrain; "the scene slot is the links": it is the wreck's cage).

## Where things stood on 23 Nov

- Ready refs are numbered and never moved: `claude/ready/perf-trace-7` (L40M), `-8` (the readers above; L40N).
- GATE PROGRAMS (`tools/_program_check.js`, `_progid_check.js`): every material site declares an owner, every Worker has a
  name, the registry adds no GL call. GATE FLIGHTREC: the frame path allocates nothing.
- Open: the census pin (`tools/perf/program_owners.json`, GATE PROGRAMS part 8) wants a cold capture on the landed build;
  the rock ring does not report itself in the cover slot's split; a new material whose program already exists still costs
  one held frame in the draw guard (shader_warm.js: `props.get(material).programs === undefined`) - PERF-LEAD's to decide.
- Evidence, by window: `D:/Dev/flydiy-notes/evidence/perf-*/trace/`.

## Added 24 Nov: the GPU's time by pass

`?recgpu=pass` on the page (one frame in 4; `?recgpu=pass:1` for every frame the recorder owns), then
`tools/gpu_passes.js <log> [--from S --to S | --mark step] [--against other.json]`: the GPU's milliseconds by pass (mirror,
shadow maps, clouds march, scene pass, clouds overlay, AA resolve, post), their sum against the whole-frame timer, and the
render scale as it moved. A family inside the scene pass (cover ring, far terrain, trees) is read by flying the same
seconds with it off and comparing the two logs with `--against`. Nothing is timed by pass without the switch.
