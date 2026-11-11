# PHYSICS-PAGES: READY (branch claude/physics-pages, for after L39b)

The user's four fiche pages (11 Nov, "go with the defaults"): LOAD TEST + BREAKING POINT, DRAG, X-RAY (electrics + tanks),
WHAT THE SIM FLIES. Drawn on the fiche's cream sheet (printable, the share's 2400 x 1600) and on the dark garage panel (promo).

## What is in it
- `src/core/66c_gen_fiche_pages.js` genFichePages(def): the pages' data, read off the core (no physics of its own): the load
  test at the limit (makeLoadTest), the bench to destruction (bench_worker benchLoadRun's destroy path), the drag rows +
  genGearCdA's terms + km/h by 64_gen_build's pod cruise rule, genSystemsResolve + makeBus, the vessels, the model. 16-27 KB.
- `src/viewer/fiche_physics.js` FICHE_PHYSICS: svg(page, data, opts) in theme 'sheet' | 'screen'; fitFrame (the model's nodes
  onto the fiche picture's alpha: its frame, no re-bake needed); mount(el, rec, page) and compose(rec, page) for the board.
- `src/viewer/bench_worker.js` job kind 'fiche' (the stand's plane, off the page: 15-90 s).
- `media/fiches/<key>/physics.json` for the ten official planes (`tools/fiche_physics_bake.js`, node, no GPU).
- `tools/physics_pages_shot.js` the pages as 2400 x 1600 PNGs (Playwright, SVG only, no GPU), --theme screen|sheet.
- GATE PHYSPAGES (`tools/_physpages_check.js`, tier full, ~90 s): every page's numbers against an independent call of the
  function it reads, on the Cub, the Metal Cessna and the Twin; the fit on a known frame; the pages in both themes.

## Not done here (waits for AIRCRAFT-LOOKS' "Fiche | Mass & price" switch in fiche_board.js, Thursday)
The board hook, about 15 lines in fiche_board.js show(): the switch's buttons for load / drag / xray / model, each calling
`FICHE_PHYSICS.mount(sheetEl, r, page, { spec: <the stand's spec when the fiche is the stand's plane>, title: nmS })`, and share
calling `FICHE_PHYSICS.compose(r, page)` when a physics page is showing. Category colours: the shared set (A0, 11 Nov).

## Findings sent to A0 (not fixed here)
AFT-PODS (the tail-arm floor invents a tail cone on twin-boom pods; rod booms fly a family cone), the float hulls carry no
air drag, the metal Cessna takes a set at 3.85 g (its limit is 3.8). Evidence on claude/admiring-planck-9zvm6n.
