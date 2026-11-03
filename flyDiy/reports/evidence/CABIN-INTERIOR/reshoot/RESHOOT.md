# CABIN-RESHOOT: the cabin interior on the fixed head (3 Nov 2026, cloud, for A0 → the user)

**STATUS: INTERIM 2.**
- First push: the first twin set, at the user's ask ("anything to push to A0?").
- This push: SET 2, the twin with its centre section top-only and the Jodel, on the simplified renderer, at the
  user's ask.
- The headless measures cover all builds and every canopy case, and they are final.

Evidence only. No game code moved; nothing built is committed.

## SET 2: the twin with its wing's centre section "top only", and the Jodel (the user, 3 Nov ~21:00)

The user: "you've been looking on a plane where the wing goes through the frame, so you did not see anything from your
work. On the twin Bush, swap the wing center section to top only ... You can also try the jodel. Use the simplified
renderer for your screenshots."

Set-up:
- **twin2:** `bugReports/Twin_busher_floats_2.json` with `wgCentre: 2`. That is the row's "open (upper only)"; the
  saved file has 3, "aft half cut".
- **jodel:** `builds/jodel_2026-09-20_corrected.json` as saved.
- Both BEFORE (rows absent) and AFTER (`hdlOn, wallTrimOn, ohConsoleOn = 1`), at day and at the rig dusk (lamps rows
  on, `--dim 0.12`).
- **Renderer:** the simplified one, the phone material tier `phmat=lite`, on the same SwiftShader rig.
- **Pictures:** `set2/<build>_<set>_<view>.jpg`, each BEFORE | AFTER. 24 pairs so far; `jodel_dusk_*` is still
  rendering.
- **Page errors:** none (`"errors": []` in every run).

**Headless first** (`rig/wing_probe2_out.txt`, `rig/probe2_out.txt`):
- **twin2:** the wing now runs ABOVE the headliner from z 1.09 to 1.89 (wing 0.600-0.633 vs headliner 0.603). It
  still dips under it:
  - at the front, 2-6 cm at z 1.99-2.09 (the leading edge behind the screen, around the console's nose);
  - at the rear, 3 cm at z 0.89-0.99.

  Console: every vertex under the skin, 3.5 mm at the closest.
- **Jodel:** no wing in the cabin (low wing). **No console:** its raked windscreen lies over the console's footprint
  (6 windshield faces), so `buildOverheadConsole` refuses at `tools/_cage_crew.js:1092` by its own rule. The Jodel
  shows the headliner and the wall trim only; its lamps stay on the roof rung.

**What the close shots show:**

| pair | what it shows |
|---|---|
| `set2/twin2_day_inUp` | **The console reads.** BEFORE: a plain cream liner and the roof flood. AFTER: the dark moulded pod with its two eyeball vents and the two lamp bezels with lit lenses, and the brown quilted headliner to the right. Left of it, in both: a cream surface with a ragged edge, the wing's leading edge still inside the cabin (the 2-6 cm above). A dark vertical strip from the pod to the ceiling, in both. |
| `set2/twin2_dusk_inUp`, `_inLamp` | At the rig dusk the console's two lamps light the headliner round them; the quilted channels show in the lamp light. `details/twin2_console_lamp_dusk.jpg`: the lamp sits in its bezel (the CABIN-SHOTS fix holds). |
| `set2/twin2_day_inRear`, `_dusk_inRear` | From the rear seat over the front heads: the console on the ceiling ahead with its two lamps, the headliner over the cabin, the wall trim on both sides. Across the cabin's front, in both: a cream band with a row of rectangular holes, the wing's centre section where it dips under the headliner. **At dusk the AFTER ceiling reads much DARKER than BEFORE's.** BEFORE: two roof lamps wash a cream liner. AFTER: the lamps are in the console and the headliner is a dark brown. This is the "darker ceiling" CABIN-SHOTS named; paint (warm tan) is the suggested answer. |
| `set2/twin2_day_inSide` | The wall trim (cream → brown vinyl) above the windows, as on the first twin. |
| `set2/twin2_day_ws`, `_q34` | From outside through the glass the change is small: the console lights the right-seat helmet from above. |
| `set2/twin2_day_roofLampFront` | **The two front roof domes are gone in AFTER** (the lamps are in the console). BEFORE has them. |
| `set2/twin2_day_roofLampRear` | **The rear pair of domes: still there, BEFORE and AFTER (FAIL).** The reflector cup (below). |
| `set2/jodel_day_inUp`, `_inLamp`, `_dusk_inUp` | **The clearest headliner of the run.** BEFORE: a plain orange ceiling. AFTER: the quilted headliner, its stitched channels reading as a strong zig-zag across the ceiling round the two roof lamps. The flood's flange (1.34 r) looks large up close. |
| `set2/jodel_day_inSide` | The Jodel's upper wall is mostly window frame: little trim to see. |
| `set2/jodel_day_inRear` | **n/a:** the Jodel has no rear seat. The fallback eye sits behind the seat in the dark (the dusk one was flat: the rig failed it and it was dropped). |
| `set2/jodel_day_roofHdr`, `_roofLampFront`, `_roofGraze` | **FAIL, BEFORE and AFTER, pre-existing:** two lamp-cup domes on the outer roof (11.3 and 3.9 mm out). Also **the right-seat occupant's black helmet comes up through the roof** at the window's top edge (`details/jodel_roof_helmet_and_lamp_domes.jpg`; lamp at crew (0.091, 0.570, 2.139) = world (-1.813, 1.997, 0.091)). The rows change neither. |

**Roof checks, set 2:**
- **twin2: FAIL** on the rear lamp domes (BEFORE and AFTER). The front domes are gone with the rows on. No console
  on the outer skin.
- **jodel: FAIL** on the front lamp domes and the helmet (BEFORE and AFTER, the rows not involved).

**The rest of the first run** (the Cub and C172 standard set, the canopy stills, the twin's wing-hidden set) was
paused for this one:
- Cub BEFORE is complete (full tier); Cub AFTER day is complete.
- The rest resumes on the lite tier.
- The canopy asserts (headless) are already final, below.

- **Code shot:** `origin/claude/ready/cabin-interior` 20243a3ed (carries ready/seats 652d927d1 and the CABIN-SHOTS
  fixes 3891d68d5). Checked out in a scratch tree and built with `node tools/build.js` (build f1714111366c).
- **Rig:** as CABIN-SHOTS (`../README.md`, `../rig/plane_shot_cab.diff`), plus an `in:<name>` door
  (`rig/look_door.js`, `rig/plane_shot_reshoot.diff` against pillar-anchors' plane_shot b6299ae8):
  - a named eye and target in the crew layer's frame;
  - fov 75 (50 for `inLamp`) and near 0.02 m for the inside views;
  - the crew character whose head is within 0.3-0.45 m of the eye is hidden;
  - `...NW` views hide the wing layer (a rig view, not the game's).

  The 30 standard shots use the CABIN-SHOTS rig unchanged:
  - SwiftShader, phone studio, `idle=0`, 900 x 1000 canvas;
  - each build in its own page (the G3358 flood: every build file is the first load of its name in its page).
- **Renderer:** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`,
  Chrome/153.0.8010.12 headless. No frame time is quoted.
- **Page errors so far:** none (`"errors": []` in every finished run's `PLANE_SHOT` line).

## The answers so far

1. **The console's black slot on the twin's roof is GONE.** Pixels: `pairs/twin_day_ws__old-new.jpg` and
   `details/twin_roof_ws_old-before_new-before_old-after_new-after.jpg`. Headless, every console vertex has the sheet
   over it on all three builds (`rig/probe_main_out.txt`), with this much clearance under the outer skin at its
   closest:

   | build | clearance |
   |---|---|
   | twin | 3.5 mm |
   | Cub | 2.5 mm |
   | C172 | 7.2 mm |

2. **The "poking" is still there: it is the roof lamps' REFLECTOR CUP, not the flange.**
   - `skinOver` (`tools/_cage_light.js:1309`) checks only the flange rim, in the flange's plane.
   - The cup (`PROF.cup`, `:397`, revolved at `:1741`) reaches 0.55 r further up, behind the flange.
   - On a roof sandwich 5-12 mm thick it comes out through the skin.

   Headless, the cup's highest point above the outer skin (vertical rays, `rig/probe_main_out.txt`):

   | build | lamp | crew-frame x, y, z (m) | BEFORE | AFTER |
   |---|---|---|---|---|
   | twin | front flood | 0.245, 0.621, 1.856 | **15.9 mm out** | in the console, clear |
   | twin | front pax | -0.245, 0.612, 1.923 | **8.5 mm out** | in the console, clear |
   | twin | rear pax x2 | ±0.245, 0.614, 0.946 | **8.3 mm out** | **8.3 mm out** |
   | Cub | front flood | 0.037, 0.698, 1.573 | **17.7 mm out** | in the console, clear |
   | Cub | rear pax | 0.037, 0.498, 0.193 | **10.4 mm out** | **10.4 mm out** |
   | C172 | front flood | 0.129, 0.770, 1.830 | **10.6 mm out** | in the console, clear |
   | C172 | front pax | -0.129, 0.763, 1.830 | **3.1 mm out** | in the console, clear |
   | C172 | rear pax x2 | ±0.209, 0.760, 0.775 | **3.1 mm out** | **3.1 mm out** |

   On the twin they show from outside WITH the wing on, as silver domes on the roof where it rises through the wing
   root:
   - `details/twin_roofLampRear_domes_before_after.jpg`: BEFORE and AFTER;
   - `details/twin_roofLampFront_domes_before_after.jpg`: BEFORE only.

   World positions (the twin on its floats): rear (-0.946, 2.164, ±0.245); front (-1.856, 2.171, 0.245) and
   (-1.923, 2.162, -0.245).

   The fix moved the front pair 6-12 cm aft but left them poking. The rows remove the front pair (it goes into the
   console), so AFTER is better than BEFORE. The rear pair is the same in both.

   **Roof checks, twin: FAIL (BEFORE and AFTER), on the rear lamp domes.** The console itself passes.

3. **The twin's wing runs THROUGH its cabin, 12-18 cm under the headliner** (`rig/wing_probe_out.txt`):
   - a ray up from the waist meets the wing layer at y 0.42-0.49 m from z 0.99 to 2.09;
   - the headliner is at 0.60.

   From the seats, the "ceiling" is the wing's riveted underside, and the console and the headliner's middle are
   behind it. A ray pick from the pilot's eye found the wing at 0.10-0.14 m and the console behind it at 0.28 m.

   So on the twin, `inside/twin_*_inUp`, `inRear` and `inLamp` show the wing, the same BEFORE and AFTER. It is the
   build's geometry (the user's `Twin_busher_floats_2`), not the rows. A wing-hidden set (`twin_*_wingoff`) is queued
   to show the ceiling work there.
   - The C172's wing also dips into the rear cabin: up to 10 cm under the headliner at z 0.73-1.13, over the rear
     seats, where its rear passenger lamps hang.
   - The Cub's wing stays above its skin everywhere.
4. **What reads up close on the twin:** the WALL TRIM. `inside/twin_day_inSide.jpg`: the cream liner above the window
   becomes a brown vinyl with a fine grain, and the ceiling's edge turns brown with the channel lines. The headliner's
   middle and the console are behind the wing (item 3).
5. **Canopies: the console is ABSENT on all of them, PASS (headless, `rig/probe_canopies_out.txt`).**
   `A.ohc = null` and no `edOhConsole` mesh, with `ohConsoleOn = hdlOn = wallTrimOn = 1`:

   | case | file | why null (`tools/_cage_crew.js`) |
   |---|---|---|
   | canopy 1 convertible | twin + `canopy: 1` (no saved build has it) | `:1059` canopy ≠ 0 |
   | canopy 2 open | twin + `canopy: 2` | `:1059` |
   | canopy 3 bubble | `builds/candidates/mosquito.json` | `:1059` |
   | open cockpit | `builds/candidates/tigermoth_2026-10.json` (cpOpen 1) | `:1121` no roof over the pod |
   | open cockpit | `builds/candidates/camel_2026-10.json`, `stearman_2026-10.json` | `:1092` windscreen over the footprint |
   | skylight | C172 + `skylight: 1` (skyExt 1, and 5) | `:1092` skyWindows over the footprint |
   | skylight | twin + `skylight: 1` | `:1092` |

   Side notes:
   - On the convertible twin, the cabin flood takes the `header` rung, with open air above it. It is not a skin poke.
   - On the skylight twin, a passenger lamp on the ceiling loop pokes 9.9 mm (the same cup).

## Folders (so far)

- `before/`, `after/`, `pairs/`: the CABIN-SHOTS names, twin complete (13 incl. the Cub's first).
- `pairs/*__old-new.jpg`: eb2a7f10a's AFTER | this AFTER.
- `roof/`: BEFORE | AFTER pairs:
  - `roofHdr`: 1.2 m, 25° down from ahead-port;
  - `roofHdrLo`: 8°, under the leading edge;
  - `roofGraze`: eye 5 cm over the skin ahead of the header, looking aft. On these high wings it shows the wing's
    leading edge;
  - `roofLampRear`, `roofLampFront`: 0.9 m over each poking lamp;
  - `...NW`: the same with the wing hidden.
- `inside/`: BEFORE | AFTER pairs (`inUp`, `inSide`, `inRear`, `inLamp`; day and the rig dusk).
- `details/`: the crops above. `rig/`: the door, the job list, the compositor, the probes and their output.
