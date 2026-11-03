# CANDIDATES-LOOK: the candidate official pool, in the page (3 Nov 2026)

An evidence run, not a gate or a fix. Asked by the Game coordinator via A0. Base: `origin/master` @ `adb2d2a9` (train L30b
(built)). No game file and no built file was touched. The rig is new (`flyDiy/tools/candidates_look.js`, an evidence tool,
not in `run_gates.js`); it copies `plane_shot.js`'s serve + raw CDP + asserted-still code.

**Renderer (every run):** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` on Chrome/153.0.8010.12 headless (`--use-angle=swiftshader`). SwiftShader: no frame time from this run is quoted anywhere.

**The page:** `flyDiy/index.html?profile=phone&gfx=laptop&intro=0&phmat=full&idle=0` (plane_shot.js's URL plus `&idle=0`),
at 1280x800 and at 360x800, each in a fresh browser profile. Both sizes boot the **phone profile** (the rig's
garage-only boot; the desktop profile's world is not booted on SwiftShader). The rig turns off `backdrop-filter`, as
plane_shot.js does, so the scrims of the rack and the NEW overlay show through more than on a real screen.

## Verdict per step

| step | 1280x800 | 360x800 |
|---|---|---|
| 1 rack: the candidate rows = index.json names, in order | PASS (9/9) | PASS (9/9) |
| 2 each offered candidate clicked: no alert, no page error, spec name = file's, spec = file's | PASS 9/9 planes | PASS 9/9 planes |
| 2 ... and in frame (plane_shot's frame assert, q view) | **FAIL 9/9**: cut off at an edge | **FAIL 5/9**: cut off (Tiger Moth, Camel, ugly bi, mosquito pass) |
| 3 NEW overlay: .dfCandH heading + 9 .dfArch.dfCand cards = index names, in order | PASS | PASS |
| 3 DC-3-alike card clicked: no alert, no page error, spec name, spec | PASS | PASS |
| 3 ... DC-3-alike in frame | **FAIL** (cut at bottom, left, right) | **FAIL** (same) |
| 4 2 builds saved via the name menu's Save As (the page's prompt answered) | PASS | PASS |
| 4 #gExportAll download caught; `{what:'flydiy-fleet', v:1, builds: one per slot}` | PASS | PASS |
| 4 the file imported via #gFile: alert starts `That is an "export all" file` | PASS | PASS |
| 5 review files through `plane_shot.js` itself (`--views q,s`) | **FAIL 24/24 views**: "the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)"; the 12 imports PASS | |
| 5 review files through this rig with `&idle=0` (q, s at 1920x1080) | imports 12/12 PASS (no alert, spec = file's); in frame: **FAIL 12/24 views**, all cut off at an edge: q on 11 of 12 (only build_v8_pusher passes), s on Twin_busher_floats_4 | |

**Page errors: none.** Not one uncaught exception in any run (steps 1-4 at both sizes, plane_shot.js, the review run).
The only dialogs were the ones asked for: two `prompt: Save as:` and the `alert: That is an "export all" file of 2
aeroplanes - import opens one build (export one from its slot).` per size.

**Which planes did not load or draw: none.** All 9 offered and all 12 review planes loaded (no alert, the spec the
file's) and drew. Every FAIL in the stills is framing (the fixed preset eye), or plane_shot.js's idle-hold blind spot. None is a plane that did not draw.

## Findings (named, not fixed)

1. **plane_shot.js cannot see the build on today's master.** `flyDiy/tools/plane_shot.js:189` boots
   `?profile=phone&gfx=laptop&intro=0&phmat=...` with no `idle=0`. The phone idle hold (PHONE-EDIT-PERF B, `ebba1557`,
   2 Nov; `flyDiy/src/viewer/app.js:19403` `IDLE_ON`) stops drawing 5 s after the last touch. So plane_shot's
   build-hidden frame (`CAGE_UI_SCENE.visible = false`, then a capture) is the same held canvas: the difference is 0.00 % and
   every view fails exit 6. Its FAIL frames do show the aeroplane drawn (`review/plane_shot/*_FAIL.jpg`). The same views
   with `&idle=0` (this rig) measure normally.
2. **The rack hides every candidate's name.** In `#gFleet` each `.gfCandRow` shows only `CANDIDATE OFFICIAL · <the
   index note>`; the name is not visible at either size (`rack/*.jpg`). The DOM holds it: step 1 reads the `<b>` and
   passes. Cause: `flyDiy/src/viewer/garage.js:1189` passes the whole index note as the row's sub-label, and
   `flyDiy/src/viewer/editor.css:921-924` makes `.gfLoad span` `white-space:nowrap; margin-left:auto` and `.gfLoad b`
   `overflow:hidden; white-space:nowrap`. The long nowrap span takes the row and the name shrinks to zero width. At
   360x800 the sub-label also runs past the dashed border to the screen edge.
3. **The cards and the rack show the index notes verbatim, internal references included.** For example
   `DC3-2 v1 (G3579b, flown 28 Oct); its swivel tailwheel and nose dome rows ride dc3-2` and
   `flies as meant with claude/ready/boom-reach's float-step fix and 916 iS row`
   (`flyDiy/src/viewer/design_flow.js:706`, `flyDiy/src/viewer/garage.js:1189`, from
   `flyDiy/builds/candidates/index.json` `note`). A player reads branch names and G numbers.
4. **The 3/4 front (q) preset is a fixed 12 m eye.** `flyDiy/src/viewer/app.js:18970`
   (`azT = -2.5; elT = 0.25; distT = 12`). On the phone profile's canvas (640x800 at 1280x800 with the sheet beside it;
   360x400 at 360x800; 960x1080 at 1920x1080) most aeroplanes run off the left or right edge. The 29 m DC-3-alike fills
   the frame and is cut at three edges at every size. That is the frame assert's FAIL in steps 2, 3 and 5; the
   aeroplanes themselves draw.
5. **Two-cockpit biplanes: crew figures' legs come out through the bottom of the fuselage.**
   - **Stearman-alike** (`offered/*stearman*`): a full-length figure stands in the cockpit, and its legs and white
     trainers hang below the fuselage in front of the gear.
   - **Tiger Moth-alike** (`offered/*tigermoth*`): blue jeans and white trainers show below the fuselage, just behind
     the gear legs.
   - **Camel-alike** (one cockpit, no `pilotRear`): no legs show.
   - The Stearman figure is the same in both of its loads: the first over the stock Cub, the second
     (`offered/*_export_second_stearman_q*`) over the DC-3. So it belongs to the build; it is not left over from the
     previous aeroplane.
   - The rows, from `flyDiy/builds/candidates/stearman_2026-10.json` / `tigermoth_2026-10.json`: `crewOn 1,
     pilotRear 1, seatZ 0.205, seatH 0.08, pilotLen 1.19 / 1.04`. The Camel carries the same seat rows, without
     `pilotRear`.
6. **Tiger Moth-alike: the index's open finding ("the prop passes through the body") does not show from the q eye.**
   The blade stands in front of the nose (`offered/*tigermoth*`). Not checked from other angles.
7. **The rig (`flyDiy/tools/candidates_look.js`), fixed during this run:** its first `--review` run ended
   with `TypeError [ERR_INVALID_ARG_TYPE]` after the last still (an early `return` in review mode left no results to
   write). It was fixed and the review was re-run; the stills and the JSON here are from the re-run.

## How to re-run

    node flyDiy/tools/candidates_look.js --out flyDiy/reports/evidence/CANDIDATES                 # steps 1-4, 1280x800 + 360x800
    node flyDiy/tools/candidates_look.js --out flyDiy/reports/evidence/CANDIDATES --sizes 1920x1080 \
      --review "$(ls flyDiy/builds/candidates/review/*.json | paste -sd, -)"                        # step 5, this rig
    node flyDiy/tools/plane_shot.js --build "$(ls flyDiy/builds/candidates/review/*.json | paste -sd, -)" --out <dir> --views q,s

`look_*.json` hold every assert, every dialog and every page error, verbatim.

## Every still

A `_FAIL` in a file name means an assert on that still failed. The still is kept so the failure can be seen.

### Steps 1-4 at 1280x800 - look_1280x800.json

Page: `http://localhost:<port>/flyDiy/index.html?profile=phone&gfx=laptop&intro=0&phmat=full&idle=0` (profile phone, idle hold off). Asserts: 68 / 79 pass. Page errors: 0. Dialogs: prompt "Save as:"; prompt "Save as:"; alert "That is an "export all" file of 2 aeroplanes - import opens one build (export one from its slot).".

| still | what it shows | asserts |
|---|---|---|
| [rack/1280x800_rack.jpg](rack/1280x800_rack.jpg) | the fleet rack, scrolled to the candidate group (UI shown) | rows = index names in order: PASS |
| [rack/1280x800_rack_end.jpg](rack/1280x800_rack_end.jpg) | the fleet rack, scrolled to its last candidate row (UI shown) | rows = index names in order: PASS |
| [offered/1280x800_stearman_2026-10_q_FAIL.jpg](offered/1280x800_stearman_2026-10_q_FAIL.jpg) | offered candidate "Stearman-alike" (stearman_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [offered/1280x800_tigermoth_2026-10_q_FAIL.jpg](offered/1280x800_tigermoth_2026-10_q_FAIL.jpg) | offered candidate "Tiger Moth-alike" (tigermoth_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [offered/1280x800_camel_2026-10_q_FAIL.jpg](offered/1280x800_camel_2026-10_q_FAIL.jpg) | offered candidate "Camel-alike" (camel_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the right edge) |
| [offered/1280x800_dc3_2026-10_q_FAIL.jpg](offered/1280x800_dc3_2026-10_q_FAIL.jpg) | offered candidate "DC-3-alike" (dc3_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the bottom and left and right edge) |
| [offered/1280x800_stol_cub_showcase_q_FAIL.jpg](offered/1280x800_stol_cub_showcase_q_FAIL.jpg) | offered candidate "STOL Cub" (stol_cub_showcase.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [offered/1280x800_cub_fittings_hand_2026-10_q_FAIL.jpg](offered/1280x800_cub_fittings_hand_2026-10_q_FAIL.jpg) | offered candidate "Cub, fittings by hand" (cub_fittings_hand_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [offered/1280x800_Twin_busher_floats_4b_q_FAIL.jpg](offered/1280x800_Twin_busher_floats_4b_q_FAIL.jpg) | offered candidate "Twin busher floats 4b" (Twin_busher_floats_4b.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [offered/1280x800_ugly_bi_q_FAIL.jpg](offered/1280x800_ugly_bi_q_FAIL.jpg) | offered candidate "ugly bi" (ugly_bi.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the right edge) |
| [offered/1280x800_mosquito_q_FAIL.jpg](offered/1280x800_mosquito_q_FAIL.jpg) | offered candidate "mosquito" (mosquito.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [cards/1280x800_cards.jpg](cards/1280x800_cards.jpg) | the NEW overlay, scrolled to the candidate heading and cards (UI shown) | heading present: PASS<br>cards = index names in order: PASS |
| [cards/1280x800_cards_end.jpg](cards/1280x800_cards_end.jpg) | the NEW overlay, scrolled to the last candidate card (UI shown) | cards = index names in order: PASS |
| [cards/1280x800_dc3_card_q_FAIL.jpg](cards/1280x800_dc3_card_q_FAIL.jpg) | the DC-3-alike card clicked in the NEW overlay, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the bottom and left and right edge) |
| [offered/1280x800_export_second_stearman_q_FAIL.jpg](offered/1280x800_export_second_stearman_q_FAIL.jpg) | the second build to save: Stearman-alike from the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |

<details><summary>every assert at 1280x800</summary>

| step | assert | verdict | detail |
|---|---|---|---|
| 1 | the candidate rows = index.json names, in order | PASS | 9 rows |
| 2 | stearman_2026-10.json: clicked | PASS | true |
| 2 | stearman_2026-10.json: no alert | PASS |  |
| 2 | stearman_2026-10.json: no page error | PASS |  |
| 2 | stearman_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", unnamed slot |
| 2 | stearman_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 1009/1026 |
| 2 | stearman_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 2 | tigermoth_2026-10.json: clicked | PASS | true |
| 2 | tigermoth_2026-10.json: no alert | PASS |  |
| 2 | tigermoth_2026-10.json: no page error | PASS |  |
| 2 | tigermoth_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", unnamed slot |
| 2 | tigermoth_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 1013/1035 |
| 2 | tigermoth_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 2 | camel_2026-10.json: clicked | PASS | true |
| 2 | camel_2026-10.json: no alert | PASS |  |
| 2 | camel_2026-10.json: no page error | PASS |  |
| 2 | camel_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", unnamed slot |
| 2 | camel_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 1016/1033 |
| 2 | camel_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the right edge |
| 2 | dc3_2026-10.json: clicked | PASS | true |
| 2 | dc3_2026-10.json: no alert | PASS |  |
| 2 | dc3_2026-10.json: no page error | PASS |  |
| 2 | dc3_2026-10.json: spec name = file's (spec.meta.name) | PASS | "cessnaMetal" vs "cessnaMetal", unnamed slot |
| 2 | dc3_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 998/1016 |
| 2 | dc3_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the bottom and left and right edge |
| 2 | stol_cub_showcase.json: clicked | PASS | true |
| 2 | stol_cub_showcase.json: no alert | PASS |  |
| 2 | stol_cub_showcase.json: no page error | PASS |  |
| 2 | stol_cub_showcase.json: spec name = file's (spec.meta.name) | PASS | "STOL Cub" vs "STOL Cub", unnamed slot |
| 2 | stol_cub_showcase.json: spec = file's (>= 90 % cage rows) | PASS | 994/1012 |
| 2 | stol_cub_showcase.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 2 | cub_fittings_hand_2026-10.json: clicked | PASS | true |
| 2 | cub_fittings_hand_2026-10.json: no alert | PASS |  |
| 2 | cub_fittings_hand_2026-10.json: no page error | PASS |  |
| 2 | cub_fittings_hand_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Piper Cub" vs "Piper Cub", unnamed slot |
| 2 | cub_fittings_hand_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 884/910 |
| 2 | cub_fittings_hand_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 2 | Twin_busher_floats_4b.json: clicked | PASS | true |
| 2 | Twin_busher_floats_4b.json: no alert | PASS |  |
| 2 | Twin_busher_floats_4b.json: no page error | PASS |  |
| 2 | Twin_busher_floats_4b.json: spec name = file's (spec.meta.name) | PASS | "Twin busher floats 4b" vs "Twin busher floats 4b", unnamed slot |
| 2 | Twin_busher_floats_4b.json: spec = file's (>= 90 % cage rows) | PASS | 1027/1027 |
| 2 | Twin_busher_floats_4b.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 2 | ugly_bi.json: clicked | PASS | true |
| 2 | ugly_bi.json: no alert | PASS |  |
| 2 | ugly_bi.json: no page error | PASS |  |
| 2 | ugly_bi.json: spec name = file's (spec.meta.name) | PASS | "ugly bi" vs "ugly bi", unnamed slot |
| 2 | ugly_bi.json: spec = file's (>= 90 % cage rows) | PASS | 1017/1017 |
| 2 | ugly_bi.json: in frame (q) | **FAIL** | the aeroplane is cut off at the right edge |
| 2 | mosquito.json: clicked | PASS | true |
| 2 | mosquito.json: no alert | PASS |  |
| 2 | mosquito.json: no page error | PASS |  |
| 2 | mosquito.json: spec name = file's (spec.meta.name) | PASS | "mosquito" vs "mosquito", unnamed slot |
| 2 | mosquito.json: spec = file's (>= 90 % cage rows) | PASS | 974/987 |
| 2 | mosquito.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 3 | the candidate cards = index.json names, in order | PASS | 9 cards |
| 3 | the .dfCandH heading | PASS | "candidate official — built, not validated" |
| 3 | a DC-3-alike row in index.json | PASS |  |
| 3 | dc3_2026-10.json: clicked | PASS | true |
| 3 | dc3_2026-10.json: no alert | PASS |  |
| 3 | dc3_2026-10.json: no page error | PASS |  |
| 3 | dc3_2026-10.json: spec name = file's (spec.meta.name) | PASS | "cessnaMetal" vs "cessnaMetal", unnamed slot |
| 3 | dc3_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 998/1016 |
| 3 | dc3_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the bottom and left and right edge |
| 3 | the overlay closed after the card | PASS |  |
| 4 | Save As "candidates-look A" through the name menu (menu) | PASS | prompt: Save as: |
| 4 | stearman_2026-10.json: clicked | PASS | true |
| 4 | stearman_2026-10.json: no alert | PASS |  |
| 4 | stearman_2026-10.json: no page error | PASS |  |
| 4 | stearman_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", unnamed slot |
| 4 | stearman_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 1009/1026 |
| 4 | stearman_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 4 | Save As "candidates-look B" through the name menu (menu) | PASS | prompt: Save as: |
| 4 | at least 2 builds saved | PASS | ["candidates-look A","candidates-look B"] |
| 4 | #gExportAll download caught (menu) | PASS | flydiy-all-aeroplanes-2026-11-03.json |
| 4 | what = "flydiy-fleet" | PASS | "flydiy-fleet" |
| 4 | v = 1 | PASS | 1 |
| 4 | builds: one per slot | PASS | slots ["candidates-look A","candidates-look B"] vs localStorage ["candidates-look A","candidates-look B"], each with spec.cage: true |
| 4 | import of it: alert starts 'That is an "export all" file' | PASS | alert: That is an "export all" file of 2 aeroplanes - import opens one build (export one from its slot). |

</details>

### Steps 1-4 at 360x800 - look_360x800.json

Page: `http://localhost:<port>/flyDiy/index.html?profile=phone&gfx=laptop&intro=0&phmat=full&idle=0` (profile phone, idle hold off). Asserts: 72 / 79 pass. Page errors: 0. Dialogs: prompt "Save as:"; prompt "Save as:"; alert "That is an "export all" file of 2 aeroplanes - import opens one build (export one from its slot).".

| still | what it shows | asserts |
|---|---|---|
| [rack/360x800_rack.jpg](rack/360x800_rack.jpg) | the fleet rack, scrolled to the candidate group (UI shown) | rows = index names in order: PASS |
| [rack/360x800_rack_end.jpg](rack/360x800_rack_end.jpg) | the fleet rack, scrolled to its last candidate row (UI shown) | rows = index names in order: PASS |
| [offered/360x800_stearman_2026-10_q_FAIL.jpg](offered/360x800_stearman_2026-10_q_FAIL.jpg) | offered candidate "Stearman-alike" (stearman_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the right edge) |
| [offered/360x800_tigermoth_2026-10_q.jpg](offered/360x800_tigermoth_2026-10_q.jpg) | offered candidate "Tiger Moth-alike" (tigermoth_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [offered/360x800_camel_2026-10_q.jpg](offered/360x800_camel_2026-10_q.jpg) | offered candidate "Camel-alike" (camel_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [offered/360x800_dc3_2026-10_q_FAIL.jpg](offered/360x800_dc3_2026-10_q_FAIL.jpg) | offered candidate "DC-3-alike" (dc3_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the bottom and left and right edge) |
| [offered/360x800_stol_cub_showcase_q_FAIL.jpg](offered/360x800_stol_cub_showcase_q_FAIL.jpg) | offered candidate "STOL Cub" (stol_cub_showcase.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [offered/360x800_cub_fittings_hand_2026-10_q_FAIL.jpg](offered/360x800_cub_fittings_hand_2026-10_q_FAIL.jpg) | offered candidate "Cub, fittings by hand" (cub_fittings_hand_2026-10.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [offered/360x800_Twin_busher_floats_4b_q_FAIL.jpg](offered/360x800_Twin_busher_floats_4b_q_FAIL.jpg) | offered candidate "Twin busher floats 4b" (Twin_busher_floats_4b.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left edge) |
| [offered/360x800_ugly_bi_q.jpg](offered/360x800_ugly_bi_q.jpg) | offered candidate "ugly bi" (ugly_bi.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [offered/360x800_mosquito_q.jpg](offered/360x800_mosquito_q.jpg) | offered candidate "mosquito" (mosquito.json) clicked in the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [cards/360x800_cards.jpg](cards/360x800_cards.jpg) | the NEW overlay, scrolled to the candidate heading and cards (UI shown) | heading present: PASS<br>cards = index names in order: PASS |
| [cards/360x800_cards_end.jpg](cards/360x800_cards_end.jpg) | the NEW overlay, scrolled to the last candidate card (UI shown) | cards = index names in order: PASS |
| [cards/360x800_dc3_card_q_FAIL.jpg](cards/360x800_dc3_card_q_FAIL.jpg) | the DC-3-alike card clicked in the NEW overlay, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the bottom and left and right edge) |
| [offered/360x800_export_second_stearman_q_FAIL.jpg](offered/360x800_export_second_stearman_q_FAIL.jpg) | the second build to save: Stearman-alike from the rack, 3/4 front, UI hidden | clicked: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the right edge) |

<details><summary>every assert at 360x800</summary>

| step | assert | verdict | detail |
|---|---|---|---|
| 1 | the candidate rows = index.json names, in order | PASS | 9 rows |
| 2 | stearman_2026-10.json: clicked | PASS | true |
| 2 | stearman_2026-10.json: no alert | PASS |  |
| 2 | stearman_2026-10.json: no page error | PASS |  |
| 2 | stearman_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", unnamed slot |
| 2 | stearman_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 1009/1026 |
| 2 | stearman_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the right edge |
| 2 | tigermoth_2026-10.json: clicked | PASS | true |
| 2 | tigermoth_2026-10.json: no alert | PASS |  |
| 2 | tigermoth_2026-10.json: no page error | PASS |  |
| 2 | tigermoth_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", unnamed slot |
| 2 | tigermoth_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 1013/1035 |
| 2 | tigermoth_2026-10.json: in frame (q) | PASS |  |
| 2 | camel_2026-10.json: clicked | PASS | true |
| 2 | camel_2026-10.json: no alert | PASS |  |
| 2 | camel_2026-10.json: no page error | PASS |  |
| 2 | camel_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", unnamed slot |
| 2 | camel_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 1016/1033 |
| 2 | camel_2026-10.json: in frame (q) | PASS |  |
| 2 | dc3_2026-10.json: clicked | PASS | true |
| 2 | dc3_2026-10.json: no alert | PASS |  |
| 2 | dc3_2026-10.json: no page error | PASS |  |
| 2 | dc3_2026-10.json: spec name = file's (spec.meta.name) | PASS | "cessnaMetal" vs "cessnaMetal", unnamed slot |
| 2 | dc3_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 998/1016 |
| 2 | dc3_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the bottom and left and right edge |
| 2 | stol_cub_showcase.json: clicked | PASS | true |
| 2 | stol_cub_showcase.json: no alert | PASS |  |
| 2 | stol_cub_showcase.json: no page error | PASS |  |
| 2 | stol_cub_showcase.json: spec name = file's (spec.meta.name) | PASS | "STOL Cub" vs "STOL Cub", unnamed slot |
| 2 | stol_cub_showcase.json: spec = file's (>= 90 % cage rows) | PASS | 994/1012 |
| 2 | stol_cub_showcase.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 2 | cub_fittings_hand_2026-10.json: clicked | PASS | true |
| 2 | cub_fittings_hand_2026-10.json: no alert | PASS |  |
| 2 | cub_fittings_hand_2026-10.json: no page error | PASS |  |
| 2 | cub_fittings_hand_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Piper Cub" vs "Piper Cub", unnamed slot |
| 2 | cub_fittings_hand_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 884/910 |
| 2 | cub_fittings_hand_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 2 | Twin_busher_floats_4b.json: clicked | PASS | true |
| 2 | Twin_busher_floats_4b.json: no alert | PASS |  |
| 2 | Twin_busher_floats_4b.json: no page error | PASS |  |
| 2 | Twin_busher_floats_4b.json: spec name = file's (spec.meta.name) | PASS | "Twin busher floats 4b" vs "Twin busher floats 4b", unnamed slot |
| 2 | Twin_busher_floats_4b.json: spec = file's (>= 90 % cage rows) | PASS | 1027/1027 |
| 2 | Twin_busher_floats_4b.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left edge |
| 2 | ugly_bi.json: clicked | PASS | true |
| 2 | ugly_bi.json: no alert | PASS |  |
| 2 | ugly_bi.json: no page error | PASS |  |
| 2 | ugly_bi.json: spec name = file's (spec.meta.name) | PASS | "ugly bi" vs "ugly bi", unnamed slot |
| 2 | ugly_bi.json: spec = file's (>= 90 % cage rows) | PASS | 1017/1017 |
| 2 | ugly_bi.json: in frame (q) | PASS |  |
| 2 | mosquito.json: clicked | PASS | true |
| 2 | mosquito.json: no alert | PASS |  |
| 2 | mosquito.json: no page error | PASS |  |
| 2 | mosquito.json: spec name = file's (spec.meta.name) | PASS | "mosquito" vs "mosquito", unnamed slot |
| 2 | mosquito.json: spec = file's (>= 90 % cage rows) | PASS | 974/987 |
| 2 | mosquito.json: in frame (q) | PASS |  |
| 3 | the candidate cards = index.json names, in order | PASS | 9 cards |
| 3 | the .dfCandH heading | PASS | "candidate official — built, not validated" |
| 3 | a DC-3-alike row in index.json | PASS |  |
| 3 | dc3_2026-10.json: clicked | PASS | true |
| 3 | dc3_2026-10.json: no alert | PASS |  |
| 3 | dc3_2026-10.json: no page error | PASS |  |
| 3 | dc3_2026-10.json: spec name = file's (spec.meta.name) | PASS | "cessnaMetal" vs "cessnaMetal", unnamed slot |
| 3 | dc3_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 998/1016 |
| 3 | dc3_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the bottom and left and right edge |
| 3 | the overlay closed after the card | PASS |  |
| 4 | Save As "candidates-look A" through the name menu (menu) | PASS | prompt: Save as: |
| 4 | stearman_2026-10.json: clicked | PASS | true |
| 4 | stearman_2026-10.json: no alert | PASS |  |
| 4 | stearman_2026-10.json: no page error | PASS |  |
| 4 | stearman_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", unnamed slot |
| 4 | stearman_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 1009/1026 |
| 4 | stearman_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the right edge |
| 4 | Save As "candidates-look B" through the name menu (menu) | PASS | prompt: Save as: |
| 4 | at least 2 builds saved | PASS | ["candidates-look A","candidates-look B"] |
| 4 | #gExportAll download caught (menu) | PASS | flydiy-all-aeroplanes-2026-11-03.json |
| 4 | what = "flydiy-fleet" | PASS | "flydiy-fleet" |
| 4 | v = 1 | PASS | 1 |
| 4 | builds: one per slot | PASS | slots ["candidates-look A","candidates-look B"] vs localStorage ["candidates-look A","candidates-look B"], each with spec.cage: true |
| 4 | import of it: alert starts 'That is an "export all" file' | PASS | alert: That is an "export all" file of 2 aeroplanes - import opens one build (export one from its slot). |

</details>

### Step 5 (review files, this rig with &idle=0) at 1920x1080 - look_review_1920x1080.json

Page: `http://localhost:<port>/flyDiy/index.html?profile=phone&gfx=laptop&intro=0&phmat=full&idle=0` (profile phone, idle hold off). Asserts: 72 / 84 pass. Page errors: 0. Dialogs: .

| still | what it shows | asserts |
|---|---|---|
| [review/1920x1080_Twin_busher_floats_2_q_FAIL.jpg](review/1920x1080_Twin_busher_floats_2_q_FAIL.jpg) | review file "Twin_busher_floats_2.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [review/1920x1080_Twin_busher_floats_2_s.jpg](review/1920x1080_Twin_busher_floats_2_s.jpg) | review file "Twin_busher_floats_2.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_Twin_busher_floats_3_q_FAIL.jpg](review/1920x1080_Twin_busher_floats_3_q_FAIL.jpg) | review file "Twin_busher_floats_3.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left edge) |
| [review/1920x1080_Twin_busher_floats_3_s.jpg](review/1920x1080_Twin_busher_floats_3_s.jpg) | review file "Twin_busher_floats_3.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_Twin_busher_floats_3b_q_FAIL.jpg](review/1920x1080_Twin_busher_floats_3b_q_FAIL.jpg) | review file "Twin_busher_floats_3b.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left edge) |
| [review/1920x1080_Twin_busher_floats_3b_s.jpg](review/1920x1080_Twin_busher_floats_3b_s.jpg) | review file "Twin_busher_floats_3b.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_Twin_busher_floats_4_q_FAIL.jpg](review/1920x1080_Twin_busher_floats_4_q_FAIL.jpg) | review file "Twin_busher_floats_4.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left edge) |
| [review/1920x1080_Twin_busher_floats_4_s_FAIL.jpg](review/1920x1080_Twin_busher_floats_4_s_FAIL.jpg) | review file "Twin_busher_floats_4.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left edge) |
| [review/1920x1080_birdman_q_FAIL.jpg](review/1920x1080_birdman_q_FAIL.jpg) | review file "birdman.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [review/1920x1080_birdman_s.jpg](review/1920x1080_birdman_s.jpg) | review file "birdman.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_build_v7_twin_2026-09-04_q_FAIL.jpg](review/1920x1080_build_v7_twin_2026-09-04_q_FAIL.jpg) | review file "build_v7_twin_2026-09-04.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left edge) |
| [review/1920x1080_build_v7_twin_2026-09-04_s.jpg](review/1920x1080_build_v7_twin_2026-09-04_s.jpg) | review file "build_v7_twin_2026-09-04.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_build_v7_ultralight_2026-09-05_q_FAIL.jpg](review/1920x1080_build_v7_ultralight_2026-09-05_q_FAIL.jpg) | review file "build_v7_ultralight_2026-09-05.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [review/1920x1080_build_v7_ultralight_2026-09-05_s.jpg](review/1920x1080_build_v7_ultralight_2026-09-05_s.jpg) | review file "build_v7_ultralight_2026-09-05.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_build_v8_pusher_2026-09-11_q.jpg](review/1920x1080_build_v8_pusher_2026-09-11_q.jpg) | review file "build_v8_pusher_2026-09-11.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_build_v8_pusher_2026-09-11_s.jpg](review/1920x1080_build_v8_pusher_2026-09-11_s.jpg) | review file "build_v8_pusher_2026-09-11.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_composite_jodel_2026-10-07_q_FAIL.jpg](review/1920x1080_composite_jodel_2026-10-07_q_FAIL.jpg) | review file "composite_jodel_2026-10-07.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the right edge) |
| [review/1920x1080_composite_jodel_2026-10-07_s.jpg](review/1920x1080_composite_jodel_2026-10-07_s.jpg) | review file "composite_jodel_2026-10-07.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_cub_quadwin_2026-10_q_FAIL.jpg](review/1920x1080_cub_quadwin_2026-10_q_FAIL.jpg) | review file "cub_quadwin_2026-10.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [review/1920x1080_cub_quadwin_2026-10_s.jpg](review/1920x1080_cub_quadwin_2026-10_s.jpg) | review file "cub_quadwin_2026-10.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_flydiy-build_(4)_q_FAIL.jpg](review/1920x1080_flydiy-build_(4)_q_FAIL.jpg) | review file "flydiy-build (4).json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left edge) |
| [review/1920x1080_flydiy-build_(4)_s.jpg](review/1920x1080_flydiy-build_(4)_s.jpg) | review file "flydiy-build (4).json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |
| [review/1920x1080_stol_cub_kit_q_FAIL.jpg](review/1920x1080_stol_cub_kit_q_FAIL.jpg) | review file "stol_cub_kit.json" imported through #gFile, 3/4 front, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): **FAIL** (the aeroplane is cut off at the left and right edge) |
| [review/1920x1080_stol_cub_kit_s.jpg](review/1920x1080_stol_cub_kit_s.jpg) | review file "stol_cub_kit.json" imported through #gFile, side, UI hidden | imported through #gFile: PASS<br>no alert: PASS<br>no page error: PASS<br>spec name = file's (spec.meta.name): PASS<br>spec = file's (>= 90 % cage rows): PASS<br>in frame (eye, not flat, aeroplane > 2 %, not cut): PASS |

<details><summary>every assert at 1920x1080</summary>

| step | assert | verdict | detail |
|---|---|---|---|
| 5 | Twin_busher_floats_2.json: imported through #gFile | PASS | true |
| 5 | Twin_busher_floats_2.json: no alert | PASS |  |
| 5 | Twin_busher_floats_2.json: no page error | PASS |  |
| 5 | Twin_busher_floats_2.json: spec name = file's (spec.meta.name) | PASS | "Twin busher floats" vs "Twin busher floats", slot "Twin busher floats" |
| 5 | Twin_busher_floats_2.json: spec = file's (>= 90 % cage rows) | PASS | 1012/1012 |
| 5 | Twin_busher_floats_2.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 5 | Twin_busher_floats_2.json: in frame (s) | PASS |  |
| 5 | Twin_busher_floats_3.json: imported through #gFile | PASS | true |
| 5 | Twin_busher_floats_3.json: no alert | PASS |  |
| 5 | Twin_busher_floats_3.json: no page error | PASS |  |
| 5 | Twin_busher_floats_3.json: spec name = file's (spec.meta.name) | PASS | "Twin busher floats 3" vs "Twin busher floats 3", slot "Twin busher floats 3" |
| 5 | Twin_busher_floats_3.json: spec = file's (>= 90 % cage rows) | PASS | 1027/1027 |
| 5 | Twin_busher_floats_3.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left edge |
| 5 | Twin_busher_floats_3.json: in frame (s) | PASS |  |
| 5 | Twin_busher_floats_3b.json: imported through #gFile | PASS | true |
| 5 | Twin_busher_floats_3b.json: no alert | PASS |  |
| 5 | Twin_busher_floats_3b.json: no page error | PASS |  |
| 5 | Twin_busher_floats_3b.json: spec name = file's (spec.meta.name) | PASS | "Twin busher floats 3b" vs "Twin busher floats 3b", slot "Twin busher floats 3b" |
| 5 | Twin_busher_floats_3b.json: spec = file's (>= 90 % cage rows) | PASS | 1027/1027 |
| 5 | Twin_busher_floats_3b.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left edge |
| 5 | Twin_busher_floats_3b.json: in frame (s) | PASS |  |
| 5 | Twin_busher_floats_4.json: imported through #gFile | PASS | true |
| 5 | Twin_busher_floats_4.json: no alert | PASS |  |
| 5 | Twin_busher_floats_4.json: no page error | PASS |  |
| 5 | Twin_busher_floats_4.json: spec name = file's (spec.meta.name) | PASS | "Twin busher floats 4" vs "Twin busher floats 4", slot "Twin busher floats 4" |
| 5 | Twin_busher_floats_4.json: spec = file's (>= 90 % cage rows) | PASS | 1027/1027 |
| 5 | Twin_busher_floats_4.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left edge |
| 5 | Twin_busher_floats_4.json: in frame (s) | **FAIL** | the aeroplane is cut off at the left edge |
| 5 | birdman.json: imported through #gFile | PASS | true |
| 5 | birdman.json: no alert | PASS |  |
| 5 | birdman.json: no page error | PASS |  |
| 5 | birdman.json: spec name = file's (spec.meta.name) | PASS | "birdman" vs "birdman", slot "birdman" |
| 5 | birdman.json: spec = file's (>= 90 % cage rows) | PASS | 879/905 |
| 5 | birdman.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 5 | birdman.json: in frame (s) | PASS |  |
| 5 | build_v7_twin_2026-09-04.json: imported through #gFile | PASS | true |
| 5 | build_v7_twin_2026-09-04.json: no alert | PASS |  |
| 5 | build_v7_twin_2026-09-04.json: no page error | PASS |  |
| 5 | build_v7_twin_2026-09-04.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", slot "flydiy-build" |
| 5 | build_v7_twin_2026-09-04.json: spec = file's (>= 90 % cage rows) | PASS | 68/69 |
| 5 | build_v7_twin_2026-09-04.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left edge |
| 5 | build_v7_twin_2026-09-04.json: in frame (s) | PASS |  |
| 5 | build_v7_ultralight_2026-09-05.json: imported through #gFile | PASS | true |
| 5 | build_v7_ultralight_2026-09-05.json: no alert | PASS |  |
| 5 | build_v7_ultralight_2026-09-05.json: no page error | PASS |  |
| 5 | build_v7_ultralight_2026-09-05.json: spec name = file's (spec.meta.name) | PASS | "Garage Special" vs "Garage Special", slot "flydiy-build" |
| 5 | build_v7_ultralight_2026-09-05.json: spec = file's (>= 90 % cage rows) | PASS | 119/121 |
| 5 | build_v7_ultralight_2026-09-05.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 5 | build_v7_ultralight_2026-09-05.json: in frame (s) | PASS |  |
| 5 | build_v8_pusher_2026-09-11.json: imported through #gFile | PASS | true |
| 5 | build_v8_pusher_2026-09-11.json: no alert | PASS |  |
| 5 | build_v8_pusher_2026-09-11.json: no page error | PASS |  |
| 5 | build_v8_pusher_2026-09-11.json: spec name = file's (spec.meta.name) | PASS | "pusherLight" vs "pusherLight", slot "pusherLight" |
| 5 | build_v8_pusher_2026-09-11.json: spec = file's (>= 90 % cage rows) | PASS | 105/107 |
| 5 | build_v8_pusher_2026-09-11.json: in frame (q) | PASS |  |
| 5 | build_v8_pusher_2026-09-11.json: in frame (s) | PASS |  |
| 5 | composite_jodel_2026-10-07.json: imported through #gFile | PASS | true |
| 5 | composite_jodel_2026-10-07.json: no alert | PASS |  |
| 5 | composite_jodel_2026-10-07.json: no page error | PASS |  |
| 5 | composite_jodel_2026-10-07.json: spec name = file's (spec.meta.name) | PASS | "Jodel D112 glass" vs "Jodel D112 glass", slot "JodelGlass" |
| 5 | composite_jodel_2026-10-07.json: spec = file's (>= 90 % cage rows) | PASS | 880/906 |
| 5 | composite_jodel_2026-10-07.json: in frame (q) | **FAIL** | the aeroplane is cut off at the right edge |
| 5 | composite_jodel_2026-10-07.json: in frame (s) | PASS |  |
| 5 | cub_quadwin_2026-10.json: imported through #gFile | PASS | true |
| 5 | cub_quadwin_2026-10.json: no alert | PASS |  |
| 5 | cub_quadwin_2026-10.json: no page error | PASS |  |
| 5 | cub_quadwin_2026-10.json: spec name = file's (spec.meta.name) | PASS | "Piper Cub" vs "Piper Cub", slot "piperCub - quad rear window (WINDOWS-FREE)" |
| 5 | cub_quadwin_2026-10.json: spec = file's (>= 90 % cage rows) | PASS | 890/917 |
| 5 | cub_quadwin_2026-10.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 5 | cub_quadwin_2026-10.json: in frame (s) | PASS |  |
| 5 | flydiy-build (4).json: imported through #gFile | PASS | true |
| 5 | flydiy-build (4).json: no alert | PASS |  |
| 5 | flydiy-build (4).json: no page error | PASS |  |
| 5 | flydiy-build (4).json: spec name = file's (spec.meta.name) | PASS | "twinBoomFail" vs "twinBoomFail", slot "flydiy-build" |
| 5 | flydiy-build (4).json: spec = file's (>= 90 % cage rows) | PASS | 880/905 |
| 5 | flydiy-build (4).json: in frame (q) | **FAIL** | the aeroplane is cut off at the left edge |
| 5 | flydiy-build (4).json: in frame (s) | PASS |  |
| 5 | stol_cub_kit.json: imported through #gFile | PASS | true |
| 5 | stol_cub_kit.json: no alert | PASS |  |
| 5 | stol_cub_kit.json: no page error | PASS |  |
| 5 | stol_cub_kit.json: spec name = file's (spec.meta.name) | PASS | "Piper Cub" vs "Piper Cub", slot "piperCub STOL" |
| 5 | stol_cub_kit.json: spec = file's (>= 90 % cage rows) | PASS | 882/909 |
| 5 | stol_cub_kit.json: in frame (q) | **FAIL** | the aeroplane is cut off at the left and right edge |
| 5 | stol_cub_kit.json: in frame (s) | PASS |  |

</details>

### Step 5, as asked: `plane_shot.js` itself (`--views q,s`, its default 1920x1080)

Command: `node flyDiy/tools/plane_shot.js --build <the 12 review files> --out <scratch> --views q,s --secs 6000`. Exit code 6 (frame). profile phone, room studio, preset laptop. Page errors: 0. Dialogs: 0.

| file (its FAIL frame, kept as JPG) | import (cage rows equal) | q | s |
|---|---|---|---|
| Twin_busher_floats_2 ([q](review/plane_shot/Twin_busher_floats_2_q_FAIL.jpg), [s](review/plane_shot/Twin_busher_floats_2_s_FAIL.jpg)) | PASS 1012/1012 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| Twin_busher_floats_3 ([q](review/plane_shot/Twin_busher_floats_3_q_FAIL.jpg), [s](review/plane_shot/Twin_busher_floats_3_s_FAIL.jpg)) | PASS 1027/1027 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| Twin_busher_floats_3b ([q](review/plane_shot/Twin_busher_floats_3b_q_FAIL.jpg), [s](review/plane_shot/Twin_busher_floats_3b_s_FAIL.jpg)) | PASS 1027/1027 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| Twin_busher_floats_4 ([q](review/plane_shot/Twin_busher_floats_4_q_FAIL.jpg), [s](review/plane_shot/Twin_busher_floats_4_s_FAIL.jpg)) | PASS 1027/1027 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| birdman ([q](review/plane_shot/birdman_q_FAIL.jpg), [s](review/plane_shot/birdman_s_FAIL.jpg)) | PASS 879/905 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| build_v7_twin_2026-09-04 ([q](review/plane_shot/build_v7_twin_2026-09-04_q_FAIL.jpg), [s](review/plane_shot/build_v7_twin_2026-09-04_s_FAIL.jpg)) | PASS 68/69 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| build_v7_ultralight_2026-09-05 ([q](review/plane_shot/build_v7_ultralight_2026-09-05_q_FAIL.jpg), [s](review/plane_shot/build_v7_ultralight_2026-09-05_s_FAIL.jpg)) | PASS 119/121 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| build_v8_pusher_2026-09-11 ([q](review/plane_shot/build_v8_pusher_2026-09-11_q_FAIL.jpg), [s](review/plane_shot/build_v8_pusher_2026-09-11_s_FAIL.jpg)) | PASS 105/107 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| composite_jodel_2026-10-07 ([q](review/plane_shot/composite_jodel_2026-10-07_q_FAIL.jpg), [s](review/plane_shot/composite_jodel_2026-10-07_s_FAIL.jpg)) | PASS 880/906 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| cub_quadwin_2026-10 ([q](review/plane_shot/cub_quadwin_2026-10_q_FAIL.jpg), [s](review/plane_shot/cub_quadwin_2026-10_s_FAIL.jpg)) | PASS 890/917 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| flydiy-build (4) ([q](review/plane_shot/flydiy-build%20(4)_q_FAIL.jpg), [s](review/plane_shot/flydiy-build%20(4)_s_FAIL.jpg)) | PASS 880/905 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |
| stol_cub_kit ([q](review/plane_shot/stol_cub_kit_q_FAIL.jpg), [s](review/plane_shot/stol_cub_kit_s_FAIL.jpg)) | PASS 882/909 | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) | **FAIL** the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels) |


## Every failure, verbatim

    [1280x800] FAIL 2 stearman_2026-10.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1280x800] FAIL 2 tigermoth_2026-10.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1280x800] FAIL 2 camel_2026-10.json: in frame (q) - the aeroplane is cut off at the right edge
    [1280x800] FAIL 2 dc3_2026-10.json: in frame (q) - the aeroplane is cut off at the bottom and left and right edge
    [1280x800] FAIL 2 stol_cub_showcase.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1280x800] FAIL 2 cub_fittings_hand_2026-10.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1280x800] FAIL 2 Twin_busher_floats_4b.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1280x800] FAIL 2 ugly_bi.json: in frame (q) - the aeroplane is cut off at the right edge
    [1280x800] FAIL 2 mosquito.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1280x800] FAIL 3 dc3_2026-10.json: in frame (q) - the aeroplane is cut off at the bottom and left and right edge
    [1280x800] FAIL 4 stearman_2026-10.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [360x800] FAIL 2 stearman_2026-10.json: in frame (q) - the aeroplane is cut off at the right edge
    [360x800] FAIL 2 dc3_2026-10.json: in frame (q) - the aeroplane is cut off at the bottom and left and right edge
    [360x800] FAIL 2 stol_cub_showcase.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [360x800] FAIL 2 cub_fittings_hand_2026-10.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [360x800] FAIL 2 Twin_busher_floats_4b.json: in frame (q) - the aeroplane is cut off at the left edge
    [360x800] FAIL 3 dc3_2026-10.json: in frame (q) - the aeroplane is cut off at the bottom and left and right edge
    [360x800] FAIL 4 stearman_2026-10.json: in frame (q) - the aeroplane is cut off at the right edge
    [1920x1080 review] FAIL 5 Twin_busher_floats_2.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1920x1080 review] FAIL 5 Twin_busher_floats_3.json: in frame (q) - the aeroplane is cut off at the left edge
    [1920x1080 review] FAIL 5 Twin_busher_floats_3b.json: in frame (q) - the aeroplane is cut off at the left edge
    [1920x1080 review] FAIL 5 Twin_busher_floats_4.json: in frame (q) - the aeroplane is cut off at the left edge
    [1920x1080 review] FAIL 5 Twin_busher_floats_4.json: in frame (s) - the aeroplane is cut off at the left edge
    [1920x1080 review] FAIL 5 birdman.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1920x1080 review] FAIL 5 build_v7_twin_2026-09-04.json: in frame (q) - the aeroplane is cut off at the left edge
    [1920x1080 review] FAIL 5 build_v7_ultralight_2026-09-05.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1920x1080 review] FAIL 5 composite_jodel_2026-10-07.json: in frame (q) - the aeroplane is cut off at the right edge
    [1920x1080 review] FAIL 5 cub_quadwin_2026-10.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [1920x1080 review] FAIL 5 flydiy-build (4).json: in frame (q) - the aeroplane is cut off at the left edge
    [1920x1080 review] FAIL 5 stol_cub_kit.json: in frame (q) - the aeroplane is cut off at the left and right edge
    [plane_shot.js] FAIL Twin_busher_floats_2 q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL Twin_busher_floats_2 s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL Twin_busher_floats_3 q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL Twin_busher_floats_3 s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL Twin_busher_floats_3b q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL Twin_busher_floats_3b s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL Twin_busher_floats_4 q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL Twin_busher_floats_4 s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL birdman q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL birdman s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL build_v7_twin_2026-09-04 q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL build_v7_twin_2026-09-04 s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL build_v7_ultralight_2026-09-05 q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL build_v7_ultralight_2026-09-05 s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL build_v8_pusher_2026-09-11 q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL build_v8_pusher_2026-09-11 s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL composite_jodel_2026-10-07 q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL composite_jodel_2026-10-07 s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL cub_quadwin_2026-10 q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL cub_quadwin_2026-10 s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL flydiy-build (4) q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL flydiy-build (4) s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL stol_cub_kit q: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)
    [plane_shot.js] FAIL stol_cub_kit s: the aeroplane is not in the frame (hiding it changes 0.00 % of the pixels)

## Page errors, verbatim

None: `Runtime.exceptionThrown` fired 0 times in all four runs (look_*.json `errors: []`; plane_shot.js `errors: []`).
