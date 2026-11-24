# PERF-SLIDERS: every aeroplane workable in the garage - handover (Mon 23 Nov 2026)

Row 1 of `PERF-OBJECTIVES.md`: "Garage sliders instantaneous: no frame over 50 ms while a slider moves". The user, 22 Nov:
"editing the dc3 is really laggy on the phone, while the chinook was really easy. Let's make sure that all planes are
workable. The thing is laggy even before it updates." The user, 23 Nov, on the phone: "I found the chinook performance to
be acceptable ... Nothing longer ... The DC3 should do the same."

Branch `claude/perf-sliders` (off perf-lead-lab d21f414f7). Readies: `claude/ready/perf-sliders-release-1` (off
origin/master, the two release rules alone) and `claude/ready/perf-sliders-1`. Evidence, every log and table named
below: `D:/Dev/flydiy-notes/evidence/perf-sliders-2026-11-23/`. The state of each gate at the time of writing is in
section 4; a line that says PENDING was not green when this file was last committed.

## 1. The tables

Measured Mon 23 Nov 08:20-10:12 in a real, visible Chrome (page_rig, headed), build bec4beda88ff (branch at 21d6a1c11),
every aeroplane a player can open (30), three sliders dragged 3 s each: the wing span (`wgSpan`), the cabin length
(`paxLen`), the main gear station (`s1X`). THE BOX WAS SHARED (A0's train and two other sessions, CPU package 88-95 C):
compare inside one table and before against after; no cell is this box's best. Full tables, worst first:
`TABLES.md` in the evidence folder (made by `make_tables.js` there from the four passes' JSON).

| set-up | result |
|---|---|
| Desktop garage at 5120x1271, today | **0 of 30** keep every drag frame at or under 50 ms. Worst frame: DC-3 684 ms, Super Petrel 384, Pawnee 350, sailPlane 283, ... Chinook 117, Cessna 172 83, the Cub variants 67 |
| Desktop, `?dragbudget=auto` | **10 of 30** (19 of 30 if the two frames after the press are left out) - but 61 of the 90 rows were mostly HELD (the model still, the knob smooth): the bar met by not following |
| Phone profile (Chrome's emulation: 412x915, DPR 2.625, touch, CPU x4), today | against the Chinook's own row of the same pass, **6 of 30** are as quick on all three drags (PC-6 Turbo Porter, Client Cub, Twin busher floats 4b, Carbon Cub, STOL Cub, the Chinook). The DC-3: wing span x2.4, gear station x13, release 4.0-9.3 s in one task against the Chinook's 0.36-1.5 s |
| Phone profile, `?dragbudget=auto` at 100 ms | nearly every tick held, the Chinook's too: the phone's auto budget was wrong at 100 and is 150 since 53488e973 - NOT MEASURED |
| Picture (row 15), desktop | no flat frame at the load, at rest or in a drag on the 29 aeroplanes reached |

Why even the Cub fails on the desktop: the garage's own frame at 5120 costs about 17 ms and frames come in 16.7 ms
steps, so a tick over about 30 ms is a 67 ms frame; the Cub's wing tick is 30-46 ms there.

THE USER'S S20 FE (SM-G781B, on the cable, 23 Nov 00:30, `realphone_*.json`), drag frame median / worst ms, the tick's
build, the release:

| | wing span | cabin length | main gear station | release | idle |
|---|---|---|---|---|---|
| Chinook, today (THE PINNED BAR) | 145 / 440, tick 100 (worst 203) | 55 / 80, tick 23 | 124 / 247, tick 84 | 0.2-1.3 s | 30 fps held |
| DC-3, today | 306 / 918, tick 236 | 112 / 128, tick 55 | 2 162 / 2 865, tick 2 026 | 2.9-7.1 s | 30 fps held |

The bar for the phone (the user, pinned by PERF-LEAD): no player aeroplane worse than the Chinook's row on any drag or
on the release, the model FOLLOWING the finger. The desktop stays row 1 as written.

The DC-3 against the Chinook, named (the page in node, `node_dc3_chinook.json`, and the browser's profiles): on the
stand 1.07 M triangles / 834 meshes against 0.36 M / 303; the gear station's tick 1 962 ms against 57 - 1 439 ms of it
the whole crew layer re-run for a lamp count that had not changed (fixed, 2.1); the wing span's tick: the DC-3's gear
hangs off the wing (gear + wing layers); a whole build 2.8-3.7 s against 0.44-0.60 s.

## 2. What is on the branch, and under which switch

2.1 ON BY DEFAULT, each exact (it changes WHEN a layer runs or how often a thing is computed, never what is built), each
with an off switch for its proof:
- THE DERIVED READ (`CAGE_CHAIN.derived`, `?derived=0` off): the dash's gear selector asks "do the mains stand off the
  centreline" (s1X > 0.01); with the raw read every tick of the gear station re-ran the crew layer on a gear that
  retracts. DC-3 gear station tick in node 1 962 -> 75-83 ms.
- THE ROWS LAID OVER P (`CAGE_CHAIN.over`, same switch): four places handed a generator `Object.assign({}, P, {..})`,
  which reads every row, so the layer re-ran on EVERY tick of ANY slider: the wing with a cabin pylon (the Super Petrel:
  proven - GATE DERIVED's stand lists the wing among the every-row layers with the switch off and not with it on; its
  gear-station tick in node 495 -> 79 ms with the derived read), the cowl on engMount 4-7, the gear with a spare
  wheel, the crew with the passengers on another seat type (no aeroplane of the list is known to use those three).
  NOT THE PAWNEE / sailPlane / twinBoomFail, as first written here: their cowl still runs on every tick - see 6.1.
- THE GEAR SELECTOR'S SEARCH (`_panel_gen.js` placeGear): the plate's outline asked once a column. Exact (GATE
  PANELGEAR: 2 000 random dashes against the old function). DC-3 seat height tick in node 2 010 -> 563 ms.
- THE AIRFRAME OF A SHEET, ONCE (`CAGE_CHAIN.afMemo`, `?afmemo=0` off, off under `RELEASE_FAST_OFF`): `cageAirframe`
  was rebuilt 3-4 times a whole build on the Cub and the Chinook (a dozen call sites; the chain's comment says "a
  dozen calls", which is the sites, not the calls) and 1-3 times a wing or gear tick from the same sheet (the
  Chinook: ~4 of its 26 ms wing tick). In node the wing layer's tick: the Cub 42 -> 28 ms, the Chinook 36 -> 26. Kept per sheet and scale under a stamp of everything the function reads.
- THE STAND MEASURED AT A PRESS ONLY WHEN THE ROW CAN MOVE THE SHEET (`CAGE_UI.standAlways = true` restores): the
  ~300 ms frame right after every press of a wing, tail or gear row (the Cub's 383 ms frame; 250-414 ms on the S20).
  PROVEN ON FOUR AEROPLANES ONLY (INSTANT's and INSTANTREL's 44 rows: every row is pressed before it is dragged), and by
  its construction (it moves WHEN the stand is measured: a deforming tick that comes first measures it itself).
- THE TWO RELEASE RULES (section 3; also alone on the release ready).

2.2 A SWITCH, OFF BY DEFAULT: THE DRAG BUDGET, `?dragbudget=auto` (or `=<ms>`; `?dragrest=<ms>`). A tick whose last
measured cost fits the budget is built (the model follows); one whose own layer fits but not the layers it feeds is
built LITE (those are owed and run when the hand rests or lets go); else it is HELD (a small spinner; one preview
when the hand rests 0.12 s, the release as always). `auto`: the desktop 50 ms less the frame's measured work less 6
(8-40 ms); the touch profile 150 ms (the Chinook's wing ticks on the S20 are 99.7 ms median, 203 worst: at 100 the
reference aeroplane itself was held). PERF-LEAD, 23 Nov: the desktop's default does not change; the user drags the same
aeroplane with and without the switch and says which he prefers.
What the player sees with the switch: the knob never stutters; on a heavy aeroplane the model waits for the hand to
slow down. Without it: the model follows every move, each frame as long as the tick.

## 3. Defects found, and their state

1. THE DC-3'S WING-SPAN RELEASE (master): the drag ends 587 objects and the resolved spec from the plain build - the
   nacelle engines' layer one build behind (the wing ran in the previews, so the release's plan ran neither it nor
   its edge to the engines). FIXED: a wing that moved in the drag under its engines sends the release whole
   (`_cage_ui.js`). Proof on master's files: `instant_dc3_base.log`.
2. THE CUB'S MAIN GEAR STATION (s1Z) RELEASE (master): after the drag the Cub still shows its fuel tank (5 meshes) where
   the plain build draws none, the limbs a hair off; the resolved spec the same (`cub_s1Z_multiset_before_rule.log`).
   FIXED by the safe rule: a sit that TURNED in the drag under a kept crew sends the release whole (a sit that only
   moved keeps the plan). Cub-only run on the branch: same, 695/695 (12:32). OPEN: why a 5 % move of the gear's
   station makes the plain build draw no tank at all - the tank's clearance reads the pilot's posed body, a fit by a
   hair is my reading, not proven; worth a look by whoever owns the tanks.
3. THE CREW'S POSE DEPENDS ON THE SIT IT WAS BUILT UNDER (master; the cause under 2): `_cage_crew.js` solveGripJob aims
   the elbows' and knees' poles along the WORLD's axes under the garage's sit mount. Rule 2 hides it at the release;
   the root repair (the poles in the aeroplane's frame) moves every tail-dragger pilot's elbows and knees by an
   estimated 1-2 cm: THE USER'S EYE, before and after, on the Cub and the DC-3. Not done. The three repairs and their
   costs: the shared note `PERF-SLIDERS.md`.
4. TRIED AND DROPPED: firing the release's own edges on what ran in the drag (engine + cowl alone in the release):
   372 objects off on the DC-3. The whole build is right by construction.
5. A HULL'S TUB, SPONSONS AND STRAKES STOOD AHEAD OF THE FUSELAGE AFTER A RELEASE BY THE PLAN (the Super Petrel's tail-span
   release: the same objects, the scene's order off the plain build's). Hidden on master because every Petrel release is
   whole there (its wing layer runs on every tick); CAGE_CHAIN.over exposed it. FIXED on this branch (the chain records
   what a layer adds BEFORE the layers under it, `pre`; the release puts it where a whole build does): f45ebda65 +
   56f3924d6, GATE INSTANTREL's Petrel shard PASS at 17:40. NOT on the release ready (not needed there).
   The same kind, NOT fixed, order only: a kept energy layer whose last run was a deferred tick has no `objs`, so its
   group is put ahead of the fuselage's (seen on the Cub's s1Z before rule 2 sent that release whole).
6. THE CABIN LENGTH ROW IS DEAD ON ABOUT A DOZEN AEROPLANES (no passenger bay) and still rebuilds the sheet on every
   tick (26-95 ms at 5120). Not fixed; a hidden or disabled row would be the honest answer.
7. THE COST OF RULES 1-2, NAMED: those releases are whole builds again (the DC-3 at 5120 about 1.9 s where the wrong plan
   took 0.83 s; on the phone seconds). The release in steps (section 6) is what makes whole releases bearable.

## 4. The gates, and how to run them

All in the page in node (`tools/_page_node.js`), each ends with `GATE <ID>: PASS|FAIL`; through the box's token:
`bash D:/Dev/flydiy-notes/cpu_token.sh run <WHO> -- node --max-old-space-size=8192 tools/<file>`.

| gate (run_gates.js row, core) | file | what it holds | alone | state |
|---|---|---|---|---|
| INSTANTREL (new) | `_instant_rel_check.js` | GATE INSTANT's check on the DC-3, the Super Petrel and the Cub, six rows with s1Z: a drag's release ends on the plain build's aeroplane | ~25 min, or three shards (the DC-3 ~7, the Petrel ~13, the Cub ~4) | PASS, 18 rows: on the release ready's own tree 14:54 (unsharded), and on this branch's game code 56f3924d6 as three shards (17:10, 17:16, 17:40) |
| DERIVED (new) | `_derived_check.js` | derived / over ON against OFF: every aeroplane's stand (ON, OFF, OFF), the walks where a derived read or an overlay is in use; `GATES_CORE=1`: the DC-3 and the Petrel | ~25 min the 23 light aeroplanes, ~70 the 7 heavy | PASS on all 30, the game code 56f3924d6: the 7 that matter (DC-3, Petrel, Pawnee, sailPlane, twinBoomFail, Chinook, Cub) compared 17:40-18:30 - 7 stands, 9 walks, all same, the crew's runs saved in the ticks 16, the Petrel's stSpan a release by the plan (ON) against a whole one (OFF), the same aeroplane; the other 23 call neither derived nor over (counted, one plain build each: the same code in both modes), 18:30-18:49 |
| PANELGEAR (new) | `_panel_gear_check.js` | the gear selector's cheap search against the plain one, 2 000 dashes | 3 s | PASS (04:10 on 21d6a1c11; 14:59 on 457f3b288) |
| AFMEMO (a mode of DERIVED's file, not a battery row yet) | `_derived_check.js --mode afmemo` | the sheet's airframe built once against built every time: every aeroplane, four plain builds ON / OFF / OFF / ON from a settled aeroplane; a difference counts where the two ON agree, the two OFF agree and ON is not OFF | ~25 min on two lanes | PASS on all 30 (3020e6efb, 18:50-19:27): no object and no spec differs by the memo, the memo used in every ON build (2-4 hits); three floatplanes drift build after build (the PC-6 on Wiplines 41 objects, the Ultralight twin 19, the Petrel 2) and are told apart by the ON / OFF / OFF / ON order |
| INSTANT | `_instant_check.js` | unchanged rows; new options `--gate`, `--multiset`, `--budget held|lite`, `--budget-rest`, builds `dc3`, `petrel` | ~11-18 min | PASS, 26 rows on 56f3924d6 (17:27, 655 s) |

THE SWEEP (row 1 per aeroplane, a real browser; needs the GPU lane and a built page):
`node tools/build.js` then
`bash D:/Dev/flydiy-notes/cpu_token.sh run <WHO> --gpu -- node tools/perf/slider_sweep.js --setup desktop|phone [--query dragbudget=auto] [--planes list:12,list:8] [--prof list:12] [--gate] --out <file.json>`
- `--gate` exits 1 when an aeroplane has a drag frame over `--bar` (50): the one-command check a train's perf run can
  call. Today it is red on all 30 by design of the bar; it becomes a gate when the default path can pass it.
- `--picture` is row 15's pass (flat frames). The window's script, as run: `slot_0820b.sh` in the evidence folder
  (about 23 min a desktop pass, 26 min a phone pass at 30 aeroplanes).
- the same drags in node (layer ms, GL counts, CPU profiles, no GPU): `tools/perf/slider_sweep_node.js`; which layers
  re-run for nothing, per slider: `tools/perf/slider_audit_node.js`; the real phone: `tools/perf/phone_edit.js --phone`.

## 5. For the user's test build (Mon 21:15)

- plain: `http://localhost:8811/flyDiy/index.html` - the model follows every move.
- with the switch: `http://localhost:8811/flyDiy/index.html?dragbudget=auto` - the knob stays smooth; the model follows
  only the ticks that fit and otherwise waits for the hand to rest or let go.
- on the phone the same two with `?profile=phone` as the build sets it (`&dragbudget=auto`, 150 ms).

## 6. Next steps, in order (none started)

1. THE COWL THAT RUNS ON EVERY TICK OF ANY SLIDER on the Pawnee, the sailPlane and the twinBoomFail (104-126 ms of each
   tick in node, ~70 at 5120): FOUND, NOT FIXED. `tools/perf/slider_all_probe.js` names it: the cowl's own slider sync
   (`_cage_cowl.js` syncFitted -> `CAGE_UI.syncSliders` -> applyRowVis / syncFollow -> frameVal -> `CAGE2.cageQuadRect` ->
   cageWinRow's `Object.assign` of the rows) runs INSIDE the cowl layer's turn while `CAGE_UI.P` is the chain's recording
   view, so the UI's reads of every row are booked as the cowl's. The fix is a few lines (the sync run with the
   recording off - a `CAGE_CHAIN` helper that clears the current layer round a UI call - or syncFitted deferred until
   after the chain), under GATE DERIVED's ON / OFF proof on those three and every aeroplane with a fitted cowl. Also
   worth asking: why those three sync on every run (the fitted rows never read back as written?).
2. CHEAPER WING AND GEAR TICKS - the real answer for the desktop bar. What the browser's profile says of the Chinook's
   26 ms wing layer a tick (`desktop_before_list8_wgSpan.cpuprofile`): the wing's own geometry ~10 ms (genWing,
   pickParts, computeVertexNormals); the struts' and pads' fuselage work ~14 ms (strutBuild 6.6, cageAirframe +
   meshAirframe 4.2 - now memoised -, fitPad / padArc / radAt 3.1, wingRay 2.6). So the shape is NOT "move and scale
   the standing wing": it is "do not redo the fuselage side of the struts while only the wing moves" (the pads' fit
   and the rays keyed on the sheet + the root's station). The Cub's own wing tick, profiled in node with every cut on
   (`node6_after_list1_wgSpan.cpuprofile`, 46 ms a tick under the profiler): strutBuild 31 % (the pads fitted on the
   fuselage: padOn / fitPad / radAt / surf), pickParts 20 % (the generated wing turned into drawn geometry), wingRay 16 %
   (rays against the meshes), genWing 16 %. The DC-3 needs its gear-on-wing tick split the same way (gear 36-57 ms a tick).
3. THE RELEASE IN STEPS (`releaseSteps` under a frame budget): the DC-3's release is one task of 4-9 s in the phone
   profile; the light layer alone is 260-418 ms on the desktop, ~900 ms on the S20; access 103 ms on the Cub.
4. THE AUDIT'S OTHER WINS (`audit_list12/8/50.json`: about a quarter of first-tick time in layers that built the same
   objects). Engines re-run by every cowl row (DC-3: 150 rows x 74 ms) - NOT a free cut: the engine layer reads the
   cowl's drawn shell for its cooling figure (CAGE_COOL_HEADS); the gear's raw reads of every leg type's rows (65-100
   rows an aeroplane); fin and stab fed on ~150 rows. Each needs GATE DERIVED's kind of proof on every aeroplane.
5. THE CABIN FLOOR'S WALL RAYS (`rayAt`, ~225 ms of the DC-3's 563 ms seat tick) and the GC beside it (~90 ms).
6. THE CREW'S POSE (defect 3): the poles in the aeroplane's frame, shown to the user before and after.
7. THE REAL PHONE at the 150 ms budget, the three worst aeroplanes (the user said yes to the phone on 22 Nov night
   for that night; ask again).
