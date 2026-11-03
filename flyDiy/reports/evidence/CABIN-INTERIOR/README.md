# CABIN-INTERIOR — before / after through the glass (CABIN-SHOTS, 3 Nov 2026, cloud, for A0 → the user)

Evidence only. No game code moved; nothing built is committed.

- **Code shot:** `origin/claude/cabin-interior` 28ad47471 (= claude/seats b7e28ac36 + cabin-craft-3 + the three rows).
  It was checked out into a scratch tree and built with `node tools/build.js` (build b4d84aec0060). The page is the
  built `index.html`.
- **BEFORE:** each build as saved (the three rows absent).
- **AFTER:** the same file with `hdlOn: 1, wallTrimOn: 1, ohConsoleOn: 1` added to `spec.cage`. Nothing else changes.
- **Builds:**

  | key | build file | canopy |
  |---|---|---|
  | twin | `bugReports/Twin_busher_floats_2.json` (same bytes as `builds/candidates/` and `tools/fixtures/`) | 0, closed |
  | cub | `builds/cub_2026-09-20_corrected.json` | 0, closed |
  | c172 | `builds/cessna172_2026-09-20_corrected.json` | 0, closed |

- **Renderer:** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`,
  Chrome/153.0.8010.12 headless. Page settings:
  - `?profile=phone&gfx=laptop&intro=0&phmat=full&idle=0` (the plane_shot defaults plus `idle=0`);
  - room `studio` (the phone's black studio), preset `laptop`;
  - canvas 900 x 1000 CSS px at DPR 1 (the phone layout gives the 3D view half of the 1800 px window).

  No frame time is quoted: SwiftShader's frame times mean nothing.
- **No page errors** in any run (each `PLANE_SHOT` line has `"errors": []`).
- **Import check:** every build came in through the fleet's own Import (`#gFile`). Cage rows matching the file:
  twin 1012/1012 (BEFORE) and 1015/1015 (AFTER); Cub and C172 883/908 (the page's own clamps).

## Folders

- `before/`, `after/`: one JPG per shot, q85.
- `pairs/`: the same shot as BEFORE | AFTER side by side, q85, labelled. **Every pair file has a twin of the same
  name in `before/` and `after/`.**
- `details/`: crops, see "What looks wrong".
- `rig/`:
  - `plane_shot_cab.diff`: the scratch rig's changes;
  - `ohc_probe.body.txt`, `lamp_probe.body.txt` with `probe_run.js`: the headless measures, and
    `ohc_probe_out.txt`, their output;
  - `pairs.py`: the compositor.

File name: `<build>_<set>_<view>.jpg`.

### Views

All views are from OUTSIDE, port side, looking through the glass. They are aimed at the cabin's middle: x 0, y halfway
from the waist to the roof (A.waistY → A.roofY), z at the front seat's back.

| view | plane_shot view | what it is |
|---|---|---|
| `q34` | `cab:-125/-4/3.4` | 3/4 front: azimuth -125°, eye 4° below the cabin's middle (looking up into the ceiling through the side glass), 3.4 m |
| `side` | `cab:-100/-4/3.6` | near-side view, 3.6 m, the same low eye (under a high wing a level eye looks into the wing) |
| `ws` | `cab:170/2/2.4/0.25/0.05` | close through the windscreen: 2.4 m off the nose, the anchor 25 cm forward and 5 cm up, a near-level eye over the cowl |

### Sets

| set | spec rows | page | meaning |
|---|---|---|---|
| `day` | as saved | the studio as is | what the user sees on the phone stand. The garage puts the cabin flood on for the first load of each aeroplane in a page (G3358, `src/viewer/app.js:10638-10655`), so the flood is ON in every `day` frame, BEFORE and AFTER (see `fresh`). |
| `lamps` | `lightOn 1, li_flood 1, li_pax 1` | `&day=dusk` | **The phone studio has no hour** (`src/viewer/studio.js:15`: "no room, no moods"), so `day=dusk` does not darken it. This is the lamps-on look under the full studio light. |
| `dusk` | as `lamps` | `&day=dusk`, plus the rig dims the studio | **The rig's dusk, not a game hour.** The studio's key, fill, rim and hemisphere lights (2.80 / 0.80 / 1.70 / 0.50) go to 12 %, and `scene.environmentIntensity` to 0.12. The cabin flood's point light (4.0) and the lamp lenses are left as the game draws them. |
| `skin` | as saved | the editor's own "fuselage α" and "glass α" dials (`CAGE_VIEW.bodyA = glassA = 0.05`, `tools/_cage_ui.js:3123-3124`) | the fallback. It adds little: the faded body draws dark grey, and the through-glass frames already show more. |
| `lite` | as saved | `phmat=lite` | the phone's material tier (aeroLite) |
| `fresh` | as saved | Cub BEFORE then AFTER, in one new page | the record of the G3358 effect (below). It is **not** a fair pair, by design. |

## The pictures

All pairs are in `pairs/`, with the same names in `before/` and `after/`.

| picture | build | view | time | what to look at |
|---|---|---|---|---|
| `twin_day_q34` | twin | 3/4 front | day | Ceiling over the heads and the aft wall through the side glass. No visible change at this distance. The headliner channels and the vinyl grain do not resolve. |
| `twin_day_side` | twin | side | day | The top of the pilot window. The flood's glare is at the top of the glass in both. AFTER: the console's dark edge shows in the gap under the wing root. |
| `twin_day_ws` | twin | windscreen | day | **The console's black top showing ON the outer roof** above the windscreen header (AFTER). BEFORE has two small lamp domes breaking through the roof at the front corners. See `details/`. |
| `twin_lamps_q34` | twin | 3/4 front | lamps | Same as day (the twin's saved file already has the flood on), plus the passenger lamps. |
| `twin_lamps_side` | twin | side | lamps | Same. |
| `twin_lamps_ws` | twin | windscreen | lamps | Same slot on the roof. |
| `twin_dusk_q34` | twin | 3/4 front | dusk (rig) | Cabin lit by its own lamps. The ceiling reads warm in both. AFTER: the console's lamp lights the windscreen header area. |
| `twin_dusk_ws` | twin | windscreen | dusk (rig) | The slot on the roof is still visible at dusk. AFTER: the faces are lit from the console above. |
| `twin_skin_q34` | twin | 3/4 front | day, skin faded | The fallback. The console's slot shows again at the roof line. |
| `twin_lite_q34` | twin | 3/4 front | day, phone tier | The phone material tier: plainer skin (no weathering), the same cabin. AFTER: the console's slot on the roof line. Nothing new is wrong on the light tier. |
| `twin_lite_ws` | twin | windscreen | day, phone tier | The slot on the roof is also there on the light tier. |
| `cub_day_q34` | Cub | 3/4 front | day | Ceiling through the door glass. AFTER: the flood hangs under the console, and the ceiling round it is darker than BEFORE's cream. |
| `cub_day_side` | Cub | side | day | Same: ceiling darker with the rows on. |
| `cub_day_ws` | Cub | windscreen | day | **The console and the lamp under it**, at the top of the screen. The flood fitting (75 mm) is wider than its bezel (52 mm): see `details/cub_console_lamp_before_after.jpg`. |
| `cub_lamps_q34` | Cub | 3/4 front | lamps | Same as day (the flood was already on in day, G3358), plus the passenger lamp at the rear seat. |
| `cub_lamps_side` | Cub | side | lamps | Same. |
| `cub_lamps_ws` | Cub | windscreen | lamps | Same. |
| `cub_dusk_q34` | Cub | 3/4 front | dusk (rig) | **The clearest difference.** BEFORE: the flood on the ceiling washes it bright, and the cabin glows through the glass. AFTER: a lamp dot under the console, and a darker ceiling. |
| `cub_dusk_ws` | Cub | windscreen | dusk (rig) | Same, from the front. |
| `cub_skin_q34` | Cub | 3/4 front | day, skin faded | Fallback. Same reading as `cub_day_q34`. |
| `cub_fresh_ws` | Cub | windscreen | day | **Not a fair pair, kept on purpose.** In one page BEFORE got the G3358 flood (first Cub load) and AFTER did not (second load of the same name). The page logged `li_flood` 1 vs 0 and the flood light at 4 vs 0. |
| `c172_day_q34` | C172 | 3/4 front | day | Ceiling through the door glass and the windscreen's side. AFTER: the lamp in the console, behind the windscreen header. |
| `c172_day_side` | C172 | side | day | Ceiling over the front seats. |
| `c172_day_ws` | C172 | windscreen | day | The ceiling just aft of the header. The flat roof, so the console sits right (measured, below). |
| `c172_lamps_q34` | C172 | 3/4 front | lamps | As day, plus the rear passenger lamps. |
| `c172_lamps_side` | C172 | side | lamps | Same. |
| `c172_lamps_ws` | C172 | windscreen | lamps | The cabin flood also lights the cowl top through the screen, in both (physical: the light falls through the glass). |
| `c172_dusk_q34` | C172 | 3/4 front | dusk (rig) | The cabin by its lamps. AFTER: the light comes from the console, aft of the header. |
| `c172_dusk_ws` | C172 | windscreen | dusk (rig) | AFTER: the lamp dot under the console. The ceiling right over the front row is dimmer than BEFORE's. |
| `c172_skin_q34` | C172 | 3/4 front | day, skin faded | Fallback. |

### Details

- `details/twin_roof_ws_before-day_before-dusk_after-day_after-dusk.jpg`: the twin's roof over the windscreen, x3. The
  rows from top to bottom are BEFORE day, BEFORE dusk, AFTER day, AFTER dusk.
- `details/cub_console_lamp_before_after.jpg`: the Cub's ceiling behind the windscreen, x5, BEFORE on top.

## Does the darkened cabin hide the interior from outside?

Partly, and less than the SEATS session found.

- With the eye 4° below the cabin's middle and 2.4-3.6 m off, all three cabins show the seats, the crew, the aft wall
  and the ceiling through the glass.
- At these distances the ceiling is a dim band. The headliner's quilted channels (18 cm) and the trim's vinyl grain
  **do not resolve on any of the three** at 900 x 1000. What reads from outside is:
  - the brightness of the ceiling;
  - the console;
  - where the lamp is.
- The skin-faded fallback (the `skin` set) was shot as asked. It shows no more than the through-glass views, which stay
  the main ones.

## What looks wrong

Lines are on `origin/claude/cabin-interior` 28ad47471.

1. **The overhead console pokes through the outer roof on the twin, and by measure on the Cub.**
   `tools/_cage_crew.js:1101`: `top = yC + 0.004` gives the pod ONE flat top height. `yC` is the lowest roof-face
   centroid within ±10 cm of the pod's centre (`:1091-1096`). On a roof that slopes down towards a raked windscreen,
   the forward end of the pod rises above the skin and the aft end hangs below the headliner. Rays straight up through
   the pod's footprint, headless (`rig/ohc_probe_out.txt`), in metres:

   | build | pod top | forward end | aft end | verdict |
   |---|---|---|---|---|
   | twin | 0.5646 | ceilingLoop (outer) 0.5541, headliner 0.5471 | headliner 0.6026 | **1.0 cm above the outer skin** forward (the black slot on the roof in `twin_*_ws`); **3.8 cm gap** under the headliner aft |
   | Cub | 0.6636 | ceilingLoop 0.6531, headliner 0.6484 | headliner 0.6759 | **1.0 cm through the skin** forward; 1.2 cm gap aft. Not seen from these outside views (the windscreen header hides it); the numbers say it is there |
   | C172 | 0.7534 | headliner 0.7495 | headliner 0.7495 | 4 mm into the headliner, 7 mm under the skin: **right** (a flat roof) |

   The console top wants to follow the ceiling along z (per lofted row, not one `top`).
2. **The lamp is bigger than its bezel.**
   - The console's lamp bezel: outer radius 26 mm (`tools/_cage_crew.js:1135`).
   - The flood fitting the light layer puts in it: 75 mm wide (`tools/_cage_light.js:57`).
   - The light layer's `consoleAt` (`tools/_cage_light.js:1436-1442`) drops the lamp under the bezel.

   From outside the lamp reads as a fitting hanging under the pod, not one set into it (`cub_day_ws`, `details/`).
3. **The ceiling reads darker with the rows on (Cub, C172), day and dusk.** Not separated.
   - The flood moved from the ceiling (Cub y 0.654) to under the console (y 0.590), 6 cm lower, so it no longer
     grazes the ceiling.
   - The headliner/trim materials (`src/viewer/aeroskin.js:212`, base 0x9d968a) may also read darker than the cloth
     liner they replace.

   A `hdlOn`-only vs `ohConsoleOn`-only pair would tell them apart. The twin's frames barely change in brightness.
4. **Pre-existing, seen in the BEFORE frames:** the twin's two front roof lamps (CABIN-CRAFT's `roofAt`, at y 0.575
   under a `pillarWindow` face at 0.6027) show as small domes **through the outer roof** at the windscreen's top
   corners (`details/`, top row). The console replaces them, with the slot of item 1.
5. **T2's panel joins are not there.** The brief says "vinyl trim finish with panel joins". The branch's HANDOVER
   section 6 says the joins at the frame stations "are NOT drawn yet" (`flyDiy/HANDOVER.md:310485-310486` on that
   tree). Nothing in the pictures shows joins.
6. **The garage never lights the cabin by the hour.**
   - The shed's night drive (`src/viewer/app.js:1833`) passes `nav, beacon, instr` from `CK.lightsFor`
     (`src/viewer/cockpit.js:211-217`), which also returns `flood: 0.5, pedal: 0.5`.
   - The phone studio has no hour at all (`src/viewer/studio.js:15`).

   So the "cabin lamps on at dusk" exist only in flight (and through G3358's flood in the garage). Here they come
   from the rows.
7. **A comment left behind:** `tools/_cage_crew.js:1049-1050` ("THE BRAKE: a pull knob under the dash ...") now sits
   above `buildOverheadConsole` (`:1059`). `buildBrakeKnob` is at `:1143`.

Not seen at these distances:
- seams;
- z-fighting between the headliner/trim and the liner (same faces relabelled, so none is expected);
- the console clipping the **windscreen** (its front stops 3 cm aft of the screen's aft edge, `:1079`; it clips the
  roof skin instead, item 1).

The phone tier (`lite`) shows the same picture as the full tier. It adds no fault of its own.

## The rig (`rig/plane_shot_cab.diff`)

- **Base:** `tools/plane_shot.js` from `claude/pillar-anchors` 8d2d2328b. That is the one with `at:` / `fit:`;
  cabin-interior's own copy predates them. It ran as a scratch copy in the scratch tree; nothing in the repo moved.
- **`cab:<az>/<el>/<dist>[/<dz>/<dy>]`:** the `at:` door (pan to a point, then `camSet`) with the point read in the
  page from the crew layer: `CAGE_CREW.A` waist and roof, and the first seat's back. `at:` takes fixed metres, and
  this way one framing fits three aeroplanes.
- **`--qs`:** extra URL parameters (`idle=0`, `day=dusk`).
- **`--dim f`:** the studio's own lights and reflections scaled. The cabin point lights are untouched.
- **`--body-alpha a`:** the editor's view dials.
- **A per-build log:** the page's own point and spot lights (intensity, visible) and the `li_*` rows. That log found
  the G3358 effect.

**Ordering, for the next rig user:** the garage switches the cabin flood on only for the first load of each
aeroplane name in a page (G3358). The Cub and C172 AFTER `day` and `skin` frames were therefore re-shot in a new
page, where each is the first load of its name, as a player would see it. The `lamps` and `dusk` files carry
`li_flood 1` and are not affected.
