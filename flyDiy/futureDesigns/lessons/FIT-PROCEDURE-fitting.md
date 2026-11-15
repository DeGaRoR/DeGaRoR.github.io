# Lessons learnt on fitting a plane to its blueprints (FIT-PROCEDURE, 11-15 Nov 2026)

Two planes fitted with the Drafting Table: the Pilatus PC-6/B2-H4 (15 rounds) and the Cessna 337D Super Skymaster.
The tool: `flyDiy/tools/drafting/` (`table.js`), its how-to and full logs: `flyDiy/tools/DRAFTING_TABLE.md`.

## 0. The user's procedure (the Drafting Table spec, 11 Nov - "The steps", the user's order, verbatim)

> Eight steps in the tool, then the garage and REAL-FIGURES. Each step is finished before the next starts, and a later
> step never moves an earlier step's rows without re-measuring them.
> 1. New reference plane. The name, then the exact variant and its engine, locked before any figure is entered ("LS is
>    not XP"). Optional start: an earlier matched plane.
> 2. References. Published figures (geometry, specs, performance), each with its conditions and source. Images: a
>    blueprint sheet or three separate views.
> 3. Sanitise and scale. Cut the sheet into views; rotate, mirror, level. Scale each view on its own figure: side by
>    length, top and front by span. A second figure checks each one. Done when every view's check figure is within 1 %.
> 4. Architecture. Only the choices that change the cage or the mass. The 2 closest presets are drawn over the
>    blueprint before the user picks.
> 5. Sections and pillars. The fuselage first. Per pillar: top, bottom, half-width, roundness top and bottom, the
>    waistline height and its softness. The drawn windows are placed here.
> 6. Wings and tail. Fin and stabs from the presets plus a global scale and a station.
> 7. Drivetrain, cowl and gear.
> 8. Check and save.

The user's corrections that shaped it (their words): "my eye wins over the drawing"; "measure but don't get crazy
matching, show me first"; "first step is matching the pillars and the sections, not much before that"; "cowl - nose -
cabin - pax1 - pax2 (different length) - aft bulkhead - back cowl"; "get straight lines out of the fuselage, in profile
and top view"; "start the stabs from the twin busher's"; "the cowl would need to fit perfectly with the firewall".

## 1. The workflow, as it finally worked

1. **Reference block first** (`tools/drafting/refs/<key>.json`, `pc6.json` the model): every figure with its source;
   the type certificate or the maker's manual prevails; a figure no source states stays empty. Private images listed
   in a `dossier` (file, what, use) - never committed.
2. **Register the sheet, then CHECK it**: each view's `ox oy k rot` - and `ky` when the scan is stretched (see 2).
   Read the scale on the dimension's EXTENSION LINES, not the drawn extremes.
3. **Birth from the right card** (`table.js new --key <card>`): the user picks it (the 337 from the C172, not the
   Skymaster-alike). Then the design tiles' own writes for the architecture (push-pull, twin booms).
4. **Pillars**: station by station, the drawing's pillar lines read on a metric grid drawn over the sheet. Show.
5. **Sections**: the frames' top / bottom / half-width at THEIR OWN stations, the targets on straight lines. The coupled
   rows fitted TOGETHER by least squares. Show.
6. **Wing planform** off a metric grid over the top view; the area checked against the manual's. Show.
7. **Tail** from a preset (the user's pick), then macro (mount, span, chord), then micro (corners). Show.
8. **Gear**: wheel stations and bottoms from the sheet; then the SETTLE check (3 s on the ground: pitch, `seized`).
9. Only now: the bench (`perf_study.js --build=<joined> --vs=<key> --fly`) and REAL-FIGURES.

## 2. Where time was lost, and the cause

| stone | the cause |
|---|---|
| Heights and stations "a bit off" everywhere, the top view never agreeing with the side | the scan was STRETCHED 2.9 % (100.3 px/m across, 97.4 down). Read as one scale per view, every top-view station ran 3-6 % short and I blamed the drawing |
| The scale itself 1 % off | read on the drawn extremes; the fin's aft corner sits ON the 29 ft 10 in extension line, 9 px further |
| The waistline raised to "the windows' bottom" wrecked the nose and the windscreen | `waistY` also sets the nose frame's top (its default) AND the engine's axis (the cowl seals to the nose face). Raised 0.9, the whole body dropped 0.38 m against the spinner and the windscreen stood up as a box. I took the windscreen base for the window bottom |
| Frame-by-frame solves diverged | the frame rows are COUPLED (the nose face centre sets the prop axis, the keel sets the gear's hang). A per-row secant fights itself |
| A solver started from guesses | a frame row absent = "follow" its derived default; start from `DT.followValue(spec,row)`, never from a number |
| Wing "much aft" in the user's eyes | the stretched top view (above) - and I sent an old overlay |
| Rows in "metres" moved by 0.745 | `planeScale` 0.745 (the C172 family) scales the BODY rows only; wing, cowl, gear are metres |
| Fin fit by sweep went the wrong way | the sweep pivots at the root: the fin's station (`finZ`) and tip (`finTipZ`) first |
| Front overlay meaningless | its origin read on the wing line, not the spinner hub |
| The 337 rejected every take-off | the rear engine had SEIZED at 0.7 s: the sheet's long nose leg bounced it onto its tail, the rear disc struck. Nobody looked at `sim.eng` before flying the bench |
| Gates red, "is it mine?" | run the same gate on each base branch; my reds were exactly the bases' |

## 3. What fixed it

- **`ky`** in the view mapping (`tools/drafting/dt_core.js` toPx/fromPx; GATE DRAFTING tests it). Measure both
  dimension lines of a sheet before anything else.
- **The metric grid** drawn over a view (5 lines of PIL in the session): read stations and heights in METRES, not px.
- **Marks at the frames' own stations** (`profile.<i>` / `profileW.<i>` in the ref; `C.stations(ref)`), straight-line
  targets (the user's "straight lines").
- **The coupled least-squares fit** (Gauss-Newton with a full Jacobian over `frNoseTopY frNoseBotY roofY keelY
  cw_lidRise`): rms 4 cm in 4 iterations where the per-frame solve diverged.
- **`fitNose 2` + `cw_sqAftTop/Bot 1`**: the cowl sealed to the firewall face (PC-6 round 9).
- **The tricycle reader** in `dt_core.measure` (mains = off the centreline; the third wheel nose or tail).
- **The settle check** before any flight; the nose leg that settles (`s2Drop`).
- **`tools/drafting/card_roundtrip.js`**: the card loads through the game's load door and keeps an edit.
- Commits: claude/fit-procedure-skymaster 71573c90 (ky, pool), fc12f52e (the waist undo), 6e89f590 (re-flown).

## 4. Minute one for a new session

- Read `DRAFTING_TABLE.md` sections "The steps" and the last plane's round; `KICKOFF.md`.
- **Measure the sheet's two scales** (a horizontal and a vertical dimension) before registering anything.
- `table.js rows <filter>` lists every row with its range; `table.js check <plane> --sheet <img> --png <prefix>` draws
  the overlays; `--json` dumps the key-measurement rows (`profile.<station>.top|bottom|halfw`, `window.*`, `wing.le`).
- The body's chain: `noseLen` (firewall -> windscreen base) - `wsRun` / `wsTopOff` (the windscreen) - the cabin ring -
  `pilotLen` - `paxLen2..n` (counted from the AFT bay) - `paxLen` (the aft bay) - the aft face. Lengths in cage units
  x `planeScale`.
- The frames: `nose win post cab pax boom tail` x `TopY WaistY BotY TopW WaistW BotW` (`CAGE_FRAME_KEYS`,
  `_cage_gen.js`); absent = follow `roofY keelY halfW waistY`. `waistY` is ALSO the nose's top and so the thrust line.
- The windscreen's run is `wsRun` (the base) and `wsTopOff` (the top); the A-pillar's angle follows.
- Wing: `wgChord wgCrankChord wgCrankAt wgChordTip wgTipX wgDx` (`wgTipX` moves the tip LE aft).
- Tail: `stMount` (0 keel, 1 deck, 2 fin tip, 3 between booms, 4 V), `stOver`, `fin*` (`finZ`, `finTipZ`, chords).
- Gear: `s1Z s1X s1Drop` / `s2Z s2Drop`; the tailwheel is `s2Leg 3` (tail-relative station).

## 5. Still missing

- A sheet-registration step that READS the dimension lines (the two scales, the origins) instead of eyes.
- A coupled-section fitter in `table.js` (the Gauss-Newton the session wrote: `fit` is a grid search, one-step rows).
- A window/pillar reader: the windows' corners off the sheet into `paxWin*` rows.
- The settle check and a pre-flight `sim.eng` check inside `perf_study`.
- A push-pull's REAR cowl with its own axis and shape (it is the nose cowl's clone: REF_MATCH section 7).
- A `planeScale` converter to 1 (body rows rescaled, the table's measurements held).
