# The Workbench: the tools every session uses

The user, 15 Nov 2026: "We are now building a standard set of tools for sessions ... a central, aptly named place to store and procedures available, maybe even as skills ... Failures of tests and reinvention of the wheel are chopping too much of our productive time."

**Rule: use the tool in this table for the job. Don't write a new harness, rig, server, CDP shim or renderer.** If the tool lacks something, extend it in its own file and add the line to its card. A new tool needs A0's yes and a row here.

Each tool has a skill in `.claude/skills/workbench-*` that loads its procedure when you start that kind of job. GATE WORKBENCH checks that every row here names a file that exists.

| Job | The tool | Command | Runs on | Skill / doc |
|---|---|---|---|---|
| Run tests (gates) | `flyDiy/tools/run_gates.js` | `node flyDiy/tools/run_gates.js --only=A,B [--jobs=3] [--no-build]` | node (CPU) | workbench-gates |
| Commit, merge, push a ready | `flyDiy/tools/_commit_hygiene.js` (+ the hook `flyDiy/tools/workbench/hook_git.js`, live for every session) | `node flyDiy/tools/_commit_hygiene.js` | node | workbench-commit, COMMIT-PROCEDURE.md |
| Quick render of a build, everything the player sees (pilot, dash, controls, livery; no browser, ~12 s; `--parts` the part colours, ~3 s). CUT VIEWS for fitting: `--cut side\|top\|front[@m]` (a section plane, the pilot, seats, controls and dash drawn whole, a dark section line) and `--cutq` (the side cut three-quarter from above-behind, framed on the cabin); GATE QSCUT | `flyDiy/tools/quickshot.js` | `node flyDiy/tools/quickshot.js <build.json\|--key k> <prefix> --views side,top,front,q [--cut side\|top\|front[@m] --cutq --focus cabin --parts --over --crop --gear --marks]` | node | workbench-quick-render, ../QUICKSHOT.md |
| A build on its blueprint: the drawing scaled by the table, our render over it, the red veil, the score table, the dimensions diff | `flyDiy/tools/quickshot.js` `--sheet` (the one projector: `flyDiy/tools/drafting/dt_sheet.js`) | `node flyDiy/tools/quickshot.js <plane.json> <prefix> --sheet <img.png> [--ref ref.json --level 0 --parts]` | node | workbench-quick-render, ../QUICKSHOT.md |
| Plane pictures in the garage look, thumbs, fiches | `flyDiy/tools/plane_shot.js` | `node flyDiy/tools/plane_shot.js --build a.json --out dir [--views q,s,t,f,hero] [--gpu]` | SwiftShader (or GPU in a slot) | workbench-quick-render |
| Phone-profile page stills + touch | `flyDiy/tools/phone_still.js` | `node flyDiy/tools/phone_still.js --out <dir>/phone` | SwiftShader | workbench-phone |
| The real phone (S20 FE over USB) | `flyDiy/tools/perf/mobile_phone_cdp.js` | see its header; A0 or the user only | the phone | workbench-phone |
| World / flight pictures, any page run | `flyDiy/tools/page_rig.js` | `node flyDiy/tools/page_rig.js --views v.json --out dir` (module: start/fly/place/eye/grab/why/close) | GPU, in a slot | workbench-page-rig, ../RIG-PROCEDURE.md |
| A page still from a cloud session | `flyDiy/tools/soft_still.js` | `node flyDiy/tools/soft_still.js --out x.jpg` | SwiftShader | workbench-page-rig |
| Scripted flights (steps + deep log) | `flyDiy/tools/flight_script.js` (Pilot, coming Tue) | node runner for tests, page runner for perf | node / GPU | cards/flight_script.md |
| Fit a plane to its blueprints (rows, searches, the score; `--png` is quickshot's `--sheet`, GATE QSPARITY holds the two to one measurement) | `flyDiy/tools/drafting/table.js` | `node flyDiy/tools/drafting/table.js check <plane.json> [--sheet img --png prefix]` | node | workbench-quick-render, ../DRAFTING_TABLE.md |
| Real-figure validation | `flyDiy/tools/real_report.js` (+ real_refs.js, real_check.js) | `node flyDiy/tools/real_report.js` | node | ../FIT_AND_VALIDATE.md |
| Vegetation of an island area: where trees stand, which rule refuses them, before/after of a biome edit | `flyDiy/tools/veg_bench.js` | `node flyDiy/tools/veg_bench.js --out <dir> [--areas skyline,ardent,cabin,north] [--subalpine 0]` | node | cards/veg_bench.md |
| Build the game files | `flyDiy/tools/build.js` | `node flyDiy/tools/build.js` (after any src edit, BEFORE judging a gate) | node | workbench-commit |
| Career snapshots of the validated builds | `flyDiy/tools/snapshots.js` | `--write` after a build edit, `--check` = GATE SNAPSHOTS | node | header |
| Load time | `flyDiy/tools/boot_perf.js` | `node flyDiy/tools/boot_perf.js --url <dev.html> --cold` (A0's coldload.sh wraps it) | GPU, in a slot | workbench-box |
| Frame cost per train | `flyDiy/tools/rollout_perf.js` via `flyDiy/tools/perf/train_gate.js` | see headers | GPU, in a slot | workbench-box |
| The GPU/CPU slot | `flyDiy/tools/perf/boxlock.sh` | `bash flyDiy/tools/perf/boxlock.sh take gpu WHO "what"` / `drop gpu WHO` / `show` | box | workbench-box |
| Serve a tree | `flyDiy/tools/_serve.js` | `node flyDiy/tools/_serve.js PORT ROOT --fallback D:/Dev/DeGaRoR.github.io` | node | workbench-page-rig |
| Compare two pictures | `flyDiy/tools/perf/png_same.js` | `node flyDiy/tools/perf/png_same.js A.png B.png` | node | header |

## What not to use (folded or retiring; inventory D:/Dev/flydiy-notes/WORKBENCH-INVENTORY.md)
- The ~100 one-off `*_shot.js` / `*_stills.js` / `*_page.js` / `*_chrome.js` rigs: page stills go through page_rig.js.
- garage_shot, bench_shot (the cage8 bench the user stopped), aids_shot, wing_struct_shot, tyres_shot, livery5_shot, stickers_shot: use plane_shot.js.
- Renderers: quickshot.js is the one node renderer (QUICKSHOT-ONE, 15 Nov). Retired, deleted after L40e in their own commit (a train branch still edits their paths): box_render.js (its scene and its cockpit layers are quickshot's default now), pod_shots.js + _pod_view.html (a playwright rig) - do not use them. Retired but kept, because something still reads them: tank_shot.js (the tank cutaway: the energy layer quickshot leaves out), _geoparity_shot.js (required by perf/g2640_overlay/shoot_all.js). No gate reads any of them.
- Projectors onto a drawing: quickshot.js --sheet (tools/drafting/dt_sheet.js) is the one. Retired but kept: outline.js (a chromium screenshot of an SVG; its dimensions diff is in the sheet's table) - HULL-TYPES' Petrel projector still reads its polyline targets, until quickshot does. photo_match/ovls_threeview.py (a branch's, never on master): its veil is the sheet's. lattice_overlay.js stays a separate tool (the flown lattice over quickshot --parts, not a projector).
- ref_match/ (GLB matching): only for GLB overlays; fitting is the drafting table.
- perf/run_f*_perf.js, run_fog_*.js: rollout_perf / train_gate.
- Never `Page.captureScreenshot` for the world; never a pattern kill; never a page run beside a node battery.

## Keeping it true
- When a tool bites you, add the trap to its skill's "Traps" list in the same branch.
- A new canonical tool: add a row here + a skill or a card in `cards/`, and the WORKBENCH gate checks it.
