# CABIN-RESHOOT: the cabin interior on the fixed head (3 Nov 2026, cloud, for A0 → the user)

**STATUS: COMPLETE.** Evidence only. No game code moved; nothing built is committed.

## Set-up

- **Code shot:** `origin/claude/ready/cabin-interior` 20243a3ed (ready/seats 652d927d1 + the CABIN-SHOTS fixes
  3891d68d5). Scratch tree, `node tools/build.js` (build f1714111366c), the page is the built `index.html`.
- **BEFORE / AFTER:** each build as saved (the three rows absent) / the same file with
  `hdlOn: 1, wallTrimOn: 1, ohConsoleOn: 1` in `spec.cage` (`rig/mkbuilds.js`, `rig/mkbuilds2.js`).
- **Rig:** CABIN-SHOTS' (`../README.md`, `../rig/plane_shot_cab.diff`) plus an `in:<name>` door (`rig/look_door.js`;
  the full diff against pillar-anchors' plane_shot b6299ae8 in `rig/plane_shot_reshoot.diff`):
  - a named eye and target in the crew layer's frame (x port, y up, z forward);
  - fov 75 (50 for `inLamp`) and near 0.02 m inside;
  - the crew character whose head is within 0.3-0.45 m of the eye is hidden;
  - `...NW` = the same view with the wing layer hidden (a rig view, not the game's);
  - the in: views take no hidden-build frame.

  The standard views are untouched:
  - `q34` = `cab:-125/-4/3.4`, `side` = `cab:-100/-4/3.6`, `ws` = `cab:170/2/2.4/0.25/0.05`;
  - SwiftShader, phone studio, `idle=0`, canvas 900 x 1000;
  - **each build file in its own page** (the G3358 flood: every file is the first load of its name);
  - `cub_fresh` is the deliberate exception (BEFORE then AFTER in one page).
- **Tiers.** The user (3 Nov ~21:00): "use the simplified renderer for your screenshots". That is the phone material
  tier, `phmat=lite`.
  - Shot before that word, on the **full** tier: the twin's day / lamps / dusk / skin; the Cub's day (standard,
    roof, inside).
  - Everything after, on **lite**: the Cub's lamps / dusk / skin / fresh; all of the C172; the canopies; set 2.
  - `twin_lite_*` is lite by definition.

  **Every pair is within one tier**, and each pair's label names it. The OLD-AFTER | NEW-AFTER pairs compare
  eb2a7f10a's full-tier frames with the new ones: where the new one is lite, part of that difference is the tier.
- **Renderer:** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`,
  Chrome/153.0.8010.12 headless. No frame time is quoted.
- **Page errors:** none. Every run's `PLANE_SHOT` line has `"errors": []` (25 + 7 + 23 runs).
- **Rig refusals**, both handled:
  - `jodel_after_dusk_inRear` was one flat colour. The Jodel has no rear seat, so the view was dropped from the
    Jodel's dusk set.
  - The Tiger Moth candidate's `what` header ("NEW-SHAPES-1 ...") was refused by plane_shot's own build check; the
    game's Import takes any file with a `spec`. The derived copy was re-tagged `flydiy-build` (`what_was` keeps the
    original) and shot.

## The answers

### 1. The console's slot on the roof: GONE

- Pixels: `pairs/twin_day_ws__old-new.jpg` and `details/twin_roof_ws_old-before_new-before_old-after_new-after.jpg`.
  The black top over the twin's windscreen header in the old AFTER is not in the new one.
- Headless (`rig/probe_main_out.txt`): every console vertex has the sheet over it, with this much clearance under the
  outer skin at its closest:

  | build | clearance |
  |---|---|
  | twin | 3.5 mm |
  | Cub | 2.5 mm |
  | C172 | 7.2 mm |
  | twin, centre section top-only (set 2) | 3.5 mm |

### 2. The "poking" that is left: every roof lamp's REFLECTOR CUP

- `skinOver` (`tools/_cage_light.js:1309`) checks the flange rim in the flange's plane.
- The cup (`PROF.cup`, `:397`, revolved at `:1741`) reaches 0.55 r further up, behind the flange.
- On a roof sandwich 5-12 mm thick it comes out through the skin.

Headless, the cup's highest point above the outer skin (vertical rays; `rig/probe_main_out.txt`,
`rig/probe2_out.txt`):

| build | lamp | crew frame x, y, z (m) | BEFORE | AFTER |
|---|---|---|---|---|
| twin | front flood | 0.245, 0.621, 1.856 | **15.9 mm out** | in the console, clear |
| twin | front pax | -0.245, 0.612, 1.923 | **8.5 mm out** | in the console, clear |
| twin | rear pax x2 | ±0.245, 0.614, 0.946 | **8.3 mm out** | **8.3 mm out** |
| Cub | front flood | 0.037, 0.698, 1.573 | **17.7 mm out** | in the console, clear |
| Cub | rear pax | 0.037, 0.498, 0.193 | **10.4 mm out** | **10.4 mm out** |
| C172 | front flood | 0.129, 0.770, 1.830 | **10.6 mm out** | in the console, clear |
| C172 | front pax | -0.129, 0.763, 1.830 | **3.1 mm out** | in the console, clear |
| C172 | rear pax x2 | ±0.209, 0.760, 0.775 | **3.1 mm out** | **3.1 mm out** |
| Jodel | front flood / pax | ±0.09, 0.570 / 0.563, 2.139 | **11.3 / 3.9 mm out** | the same (the Jodel gets no console) |

Where they show from outside with the wing on (a silver dome on the roof):
- **twin:** the rear pair, BEFORE and AFTER (`details/twin_roofLampRear_domes_before_after.jpg`), and the front pair
  in BEFORE (`details/twin_roofLampFront_domes_before_after.jpg`). The roof rises through the wing root there.
- **Cub:** the rear one, on the deck behind the wing (`roof/cub_day_roofLampRear.jpg`).
- **C172:** the rear pair, behind the wing (`roof/c172_day_roofLampRear.jpg`).
- **Jodel:** both front ones (`details/jodel_roof_helmet_and_lamp_domes.jpg`).
- The Cub's and the C172's front lamps are under the wing: invisible from outside.

The fix moved the twin's front pair 6-12 cm aft, but they still poke. **The rows help:** they take the front pair
into the console. The rear pair is the same in both.

### 3. Roof checks per build (PASS = nothing dark or lamp-coloured on the outer skin)

| build | BEFORE | AFTER | what |
|---|---|---|---|
| twin | **FAIL** | **FAIL** | rear lamp domes (both); front lamp domes (BEFORE only). No console on the skin. |
| Cub | **FAIL** | **FAIL** | rear lamp dome behind the wing (both). The front is under the wing. |
| C172 | **FAIL** | **FAIL** | rear lamp domes behind the wing (both, 3.1 mm: small). The front is under the wing. |
| twin, centre section top-only (set 2) | **FAIL** | **FAIL** | rear domes (both); the front domes in BEFORE only. |
| Jodel (set 2) | **FAIL** | **FAIL** | the front lamp domes; **the right-seat occupant's helmet through the roof** (both). |

The console itself passes on every build.

### 4. Canopies: the console is ABSENT on every one, PASS

Headless (`rig/probe_canopies_out.txt`): `A.ohc = null` and no `edOhConsole` mesh, with all three rows on.

| case | file | why null (`tools/_cage_crew.js`) | stills |
|---|---|---|---|
| canopy 1 convertible | twin + `canopy: 1` (no saved build has it) | `:1059` canopy ≠ 0 | `canopies/can1_twin_{q34,inUp}` |
| canopy 2 open | twin + `canopy: 2` | `:1059` | `canopies/can2_twin_*` |
| canopy 3 bubble | `builds/candidates/mosquito.json` | `:1059` | `canopies/can3_mosquito_*` |
| open cockpit | `builds/candidates/tigermoth_2026-10.json` (cpOpen 1) | `:1121` no roof over the pod | `canopies/open_tigermoth_*` |
| open cockpit | `builds/candidates/camel_2026-10.json`, `stearman_2026-10.json` | `:1092` windscreen over the footprint | (headless only) |
| skylight | C172 + `skylight: 1` (skyExt 1; and 5) | `:1092` skyWindows over the footprint | `canopies/sky_c172_*` |
| skylight | twin + `skylight: 1` | `:1092` | `canopies/sky_twin_*` |
| low wing, raked screen | the Jodel as saved (set 2) | `:1092` windscreen over the footprint | `set2/jodel_*` |

No console in any canopy still. Notes:
- The twin cases keep the saved wing, so their `inUp` shows the wing's underside (item 5).
- The Tiger Moth's `inUp` looks down into the open cockpit.
- On the convertible twin the flood takes the `header` rung, with open air above it (not a skin poke).
- On the skylight twin, a passenger lamp on the ceiling loop pokes 9.9 mm (the cup).

### 5. The twin's wing ran through its cabin, and set 2

`rig/wing_probe_out.txt`, plus a ray pick from the pilot's eye: the wing layer at 0.10-0.14 m, the console behind
it at 0.28 m.
- The saved twin (`wgCentre 3`, "aft half cut") has the wing's underside at y 0.42-0.49 m from z 0.99 to 2.09,
  **12-18 cm under the headliner** (0.60).
- From the seats, the "ceiling" was the wing's riveted underside, the same BEFORE and AFTER. That is why the first
  inside set showed nothing of the console on the twin.
- The C172's wing also dips up to 10 cm under the headliner over the rear seats (z 0.73-1.13). In the stills it is a
  curved band at the top of `inside/c172_*_inRear`.
- The Cub's wing stays above its skin.

**Set 2** (the user, 3 Nov ~21:00: "swap the wing center section to top only ... You can also try the jodel"):
- **twin2** = `Twin_busher_floats_2` + `wgCentre: 2` ("open (upper only)"), and **jodel** =
  `builds/jodel_2026-09-20_corrected.json`.
- BEFORE / AFTER, day and rig dusk, lite tier: `set2/`, 29 pairs.
- twin2's wing is now above the headliner from z 1.09 to 1.89. It still dips 2-6 cm at the front (z 1.99-2.09,
  around the console's nose) and 3 cm at the rear (`rig/wing_probe2_out.txt`).

## The stills, one row each (each file is BEFORE | AFTER)

### The 30 standard shots (`pairs/`, with `before/` and `after/` twins; `pairs/<name>__old-new.jpg` = eb2a7f10a AFTER | this AFTER)

Through the glass from outside, at 2.4-3.6 m, the three rows change little.
- The headliner's channels and the trim's grain do not resolve at this distance.
- What reads is the ceiling's brightness (dimmer with the rows on, most at dusk), the console as a dark shape behind
  the header, and its lamp.
- The roof checks for these views are in the table above. None of these 30 shows a console on the outer skin.

| still | tier | what it shows |
|---|---|---|
| `twin_day_q34` | full | Ceiling and aft wall through the side glass: no visible change. |
| `twin_day_side` | full | The pilot window's top: no visible change. |
| `twin_day_ws` | full | **The old AFTER's black slot over the header is gone** (`__old-new`). BEFORE: small lamp domes at the roof's front corners, at this scale only in the crop. |
| `twin_lamps_q34`, `_side`, `_ws` | full | As day, plus the passenger lamps. |
| `twin_dusk_q34`, `_ws` | full | The cabin by its own lamps. AFTER: the light from the console behind the header, on the faces. |
| `twin_skin_q34` | full | The fallback (body α 0.05): no more than through the glass. |
| `twin_lite_q34`, `_ws` | lite | The phone tier: the same reading. |
| `cub_day_q34`, `_side`, `_ws` | full | AFTER: the console and its lamp just aft of the windscreen top. The ceiling round it is a little darker than BEFORE's cream. |
| `cub_lamps_q34`, `_side`, `_ws` | lite | As day, plus the rear passenger lamp. |
| `cub_dusk_q34`, `_ws` | lite | BEFORE: the flood on the ceiling lights the cabin. AFTER: a dimmer cabin, the light from the console. |
| `cub_skin_q34` | lite | Fallback: as day. |
| `cub_fresh_ws` | lite | **Not a fair pair, kept on purpose** (G3358): BEFORE got the first-load flood, AFTER did not. |
| `c172_day_q34`, `_side`, `_ws` | lite | The console sits behind the windscreen header. Small change through the glass. |
| `c172_lamps_q34`, `_side`, `_ws` | lite | As day, plus the rear lamps. |
| `c172_dusk_q34`, `_ws` | lite | AFTER: the light comes from the console; the ceiling over the front row is dimmer. |
| `c172_skin_q34` | lite | Fallback. |

### Roof close-ups from outside (`roof/`, day)

| still | tier | shows | roof check |
|---|---|---|---|
| `twin_day_roofHdr` (1.2 m, 25° down, from ahead-port) | full | The wing sits on the header. The cabin roof shows through the wing root's top as a pale patch with a ragged edge (the saved centre section; pre-existing). BEFORE: the front pair's two domes beside it, and one rear dome in the distance; AFTER: the rear dome only (`details/twin_roofHdr_domes_before_top_after_bottom.jpg`, full-res crop). | **FAIL** both (BEFORE 3 domes, AFTER 1) |
| `twin_day_roofHdrLo` (8°, under the leading edge) | full | The header under the wing; the same patch. | PASS both |
| `twin_day_roofGraze` (5 cm over the skin, ahead of the header, looking aft) | full | On a high wing it runs into the wing's leading edge: no roof to graze. | n/a |
| `twin_day_roofLampRear`, `...NW` | full | Two silver domes on the roof aft of the wing root: BEFORE and AFTER. `NW` (wing hidden) also shows the header tank. | **FAIL** both |
| `twin_day_roofLampFront`, `...NW` | full | BEFORE: the front pair's domes. AFTER: none. | BEFORE **FAIL**, AFTER PASS |
| `cub_day_roofHdr`, `roofHdrLo` | full | The wing covers the whole roof and the header. | PASS both (nothing visible) |
| `cub_day_roofGraze` | full | Into the wing's leading edge. | n/a |
| `cub_day_roofLampRear`, `...NW` | full | A silver dome on the deck behind the wing, by the fin's fairing: both. | **FAIL** both |
| `cub_day_roofLampFront`, `...NW` | full | Under the wing: only the wing (NW: the roof with the BEFORE cup). | PASS with the wing on |
| `c172_day_roofHdr`, `roofHdrLo` | lite | The wing over the header. | PASS both |
| `c172_day_roofGraze` | lite | Into the wing. | n/a |
| `c172_day_roofLampRear`, `...NW` | lite | Small silver domes on the roof behind the wing: both. | **FAIL** both (3.1 mm) |
| `c172_day_roofLampFront`, `...NW` | lite | Under the wing. | PASS with the wing on |

### Close inside (`inside/`, day and the rig dusk with lightOn 1, li_flood 1, li_pax 1)

| still | tier | the ceiling work up close |
|---|---|---|
| `twin_{day,dusk}_inUp`, `_inRear`, `_inLamp` | full | **The wing's underside, the same BEFORE and AFTER** (item 5): the console and the headliner's middle are behind it. See set 2. |
| `twin_{day,dusk}_inSide` | full | **The wall trim reads:** the cream liner above the windows becomes brown vinyl with a fine grain, and the ceiling's edge turns brown with the channel lines. |
| `cub_day_inUp`, `cub_day_inLamp` | full | **The console reads:** a narrow dark pod over the windscreen bow with the flood in its bezel and a vent. BEFORE: the bare flood on a cream woven ceiling. The headliner is a finer, darker pattern than the cloth. |
| `cub_day_inRear` | full | From the rear seat: BEFORE, a bright ceiling (the flood washing it); AFTER, darker, the console over the pilot. The rear passenger lamp hangs at the top left in both. |
| `cub_day_inSide` | full | Little change: the upper wall a shade darker. |
| `cub_dusk_*` | lite | As day, by lamp light: AFTER dimmer overall, the light pooled under the console. |
| `c172_{day,dusk}_inUp`, `_inLamp` | lite | **The console reads clearly:** the pod, two vents, two lamps lit in their bezels. Round it the tan quilted headliner, its channels visible. BEFORE: the bare flood ring and a pax lamp on a cream liner. |
| `c172_{day,dusk}_inRear` | lite | Over the two front heads: the console on the ceiling ahead; the headliner warmer and darker than the cream. The wing's dip shows as a curved band overhead in both. |
| `c172_{day,dusk}_inSide` | lite | The wall trim: cream → tan vinyl above the windows. |

### Set 2: the twin with its centre section top-only, and the Jodel (`set2/`, lite)

| still | the ceiling work up close; roof |
|---|---|
| `twin2_day_inUp` | **The console reads:** dark moulded pod, two eyeball vents, two lamp bezels with lit lenses, the brown quilted headliner beside it. BEFORE: a plain cream liner and the roof flood. Left, in both: a cream surface with a ragged edge, the wing's leading edge still inside the cabin. A dark vertical strip from the pod to the ceiling, in both. |
| `twin2_dusk_inUp`, `_inLamp` | The console's lamps light the headliner round them. `details/twin2_console_lamp_dusk.jpg`: the lamp sits in its bezel (the CABIN-SHOTS fix holds). |
| `twin2_{day,dusk}_inRear` | The console ahead, the headliner, the trim both sides. Across the front, in both: a cream band with a row of rectangular holes (the wing's centre section under the headliner). **At dusk the AFTER ceiling is much darker than BEFORE's** (BEFORE: two roof lamps wash a cream liner; AFTER: the lamps are in the console and the headliner is dark brown). |
| `twin2_{day,dusk}_inSide` | The wall trim, cream → brown vinyl. |
| `twin2_{day,dusk}_q34`, `_ws` | From outside: small change; the console lights the right-seat helmet from above. |
| `twin2_day_roofHdr` | The header under the wing. PASS. |
| `twin2_day_roofLampFront` | BEFORE: two domes on the roof. AFTER: none. BEFORE **FAIL**, AFTER PASS. |
| `twin2_day_roofLampRear` | The rear domes, both. **FAIL** both. |
| `jodel_{day,dusk}_inUp`, `_inLamp` | **The clearest headliner of the run:** BEFORE a plain orange ceiling, AFTER the quilted headliner, its stitched channels a strong zig-zag round the two roof lamps (no console: item 4). The flood's flange (1.34 r) looks large this close. At dusk the AFTER ceiling is not darker (the lamps did not move). |
| `jodel_{day,dusk}_inSide` | The upper wall is mostly window frame: little trim to see; the ceiling's edge quilted in AFTER. |
| `jodel_day_inRear` | **n/a:** no rear seat; the fallback eye is behind the seat in the dark. |
| `jodel_{day,dusk}_q34`, `_ws` | Small change through the canopy. |
| `jodel_day_roofHdr`, `_roofLampFront`, `_roofGraze` | Two lamp domes on the roof; **the right-seat occupant's black helmet through the roof** at the window's top edge (`details/jodel_roof_helmet_and_lamp_domes.jpg`; lamp at crew (0.091, 0.570, 2.139) = world (-1.813, 1.997, 0.091)). **FAIL** both, the rows not involved. |

## Does the ceiling work read?

- **Up close, yes:** wherever nothing sits between the seats and the ceiling.
  - The console reads on the Cub, the C172 and the top-only twin: pod, vents, lamps in their bezels.
  - The headliner's channels show on all of them; the Jodel's is the strongest.
  - The wall trim reads as a colour and finish change above the windows.
- **From outside through the glass, hardly:** a dimmer ceiling and the console's dark shape and lamp. The textures do
  not resolve at 2.4-3.6 m.
- **The darker ceiling is real** wherever the console takes the lamps (the dusk pairs): the light is lower and pooled,
  and the headliner's default is dark. Paint (the warm tan suggested in the picker) is the named answer.

## Named, not fixed

1. `tools/_cage_light.js:1309` (`skinOver`) clears the flange only. The reflector cup (`:1741`, `PROF.cup` `:397`)
   reaches 0.55 r higher and comes out of every thin roof: 3-18 mm on the twin, Cub, C172 and Jodel. This is the
   "poking" left.
2. **The saved twin's wing crosses its cabin** 12-18 cm under the headliner (`wgCentre 3`). With `wgCentre 2` it is
   mostly above, but its leading edge still dips 2-6 cm round the console's nose. The C172's wing dips up to 10 cm
   over the rear seats, where its rear lamps hang. Build geometry, not the rows.
3. **The Jodel's right-seat helmet comes through its roof** (BEFORE and AFTER). The crew / seats, not the rows.
4. **The Jodel gets no console:** its raked windscreen lies over the footprint (`_cage_crew.js:1092`), by the rule as
   written. If the Jodel should carry one, the footprint rule (or the pod's position) is the place.
5. **The twin's saved centre section shows its cabin roof through the wing root's top** as a pale ragged patch
   (`roof/twin_day_roofHdr*`). Pre-existing.
6. `pairs/cub_fresh_ws` is unfair by design (G3358's first-load flood).

## Folders

- `before/`, `after/`, `pairs/`: the 30, CABIN-SHOTS names. `pairs/*__old-new.jpg`: eb2a7f10a AFTER | this AFTER.
- `roof/`: the outside close-ups. `inside/`: the inside close-ups. `canopies/`: one q34 and one inUp per case (AFTER).
- `set2/`: the top-only twin and the Jodel.
- `details/`: the crops named above.
- `rig/`:
  - the door, `look_door.js`;
  - the job list, `jobs.js` (JOBSET 1 / 2 / 3);
  - the compositors, `compose.py` and `compose2.py`;
  - the build makers, `mkbuilds*.js`;
  - the probes (`*.body.txt`, `probe_run.js`) and their output (`*_out.txt`);
  - the plane_shot diff, `plane_shot_reshoot.diff`.
