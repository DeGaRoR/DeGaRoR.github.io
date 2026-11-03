# AFT-BULKHEAD-LOOK: close stills of today's aft bulkhead (3 Nov 2026, cloud, for CABIN-CRAFT via A0 → the user)

Evidence only. No game code moved, and nothing built is committed.

- **Code shot:** origin/master **adb2d2a9** (train L30b).
  - It was checked out into a scratch worktree and built there with `node tools/build.js` (build **fe35dc5b2cb3**).
  - The page is that tree's built `index.html`.
- **Files:**
  - `RESEARCH.md`: part 1, real aft walls, and the features ranked for a side window;
  - `MEASURE.md`: part 3, the headless measure, with the visible fraction per view;
  - `stills/`: part 2, `<build>_<set>_<view>.jpg`, JPG q85;
  - `rig/`: the scripts (below).

## The run

**Renderer**, verbatim, the same in every run:

    ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)

Chrome/153.0.8010.12 headless (`/opt/pw-browsers/chromium-1243`). No frame time is quoted.

**Page settings:**
- the URL is `index.html?profile=phone&gfx=laptop&intro=0&phmat=full&idle=0` (plane_shot's own, plus `idle=0`);
- the room is the phone's black `studio`, preset `laptop`;
- the window is 1800 x 1000, and the 3D canvas is **900 x 1000** CSS px at DPR 1.

**Page errors:**
- none. Every `PLANE_SHOT` line that loaded a build has `"errors": []`;
- the logs hold no other error.

**Two failed runs, not page errors:**
- The first Tiger Moth runs (day and dusk) stopped before the browser loaded the build, with the rig's own check:

      FAIL .../b/day/tigermoth.json is not a flyDiy build (what: NEW-SHAPES-1 G3510-G3519 - de Havilland DH.82A Tiger Moth (D...

  - `builds/candidates/tigermoth_2026-10.json` has `what: "NEW-SHAPES-1 ..."`, not `"flydiy-build"`.
  - The game's own Import does not care (`src/viewer/garage.js:1312`, `unwrap` → `loadSpec`); plane_shot's check
    does.
  - The scratch copy was relabelled `what: "flydiy-build"`, with the old label kept as `what0`. The spec is
    untouched.
- The first Jodel runs aimed 0.5 m low and were discarded (see "Rig notes" 2).

**Import check (cage rows equal to the file, as the page clamps them):**

| build | rows equal |
|---|---|
| Cub | 879/905 |
| C172 | 879/905 |
| Jodel | 880/906 |
| twin | 1012/1012 |
| Mosquito | 973/987 |
| Tiger Moth | 1012/1035 |

### The builds

`intOn 1` and `intBulk 1` are **as saved on all six**, so no "switched on" copies were needed.

| key | file | what it is | `intCons` (construction) |
|---|---|---|---|
| `cub` | `builds/cub_2026-09-20_corrected.json` | the validated Cub, tandem | 1 steel tube |
| `c172` | `builds/cessna172_2026-09-20_corrected.json` | the C172, 2 + 2 | 3 aluminium |
| `jodel` | `builds/jodel_2026-09-20_corrected.json` | the validated Jodel (`_load_build.js` VALIDATED.jodel), side by side | 2 plywood |
| `twin` | `bugReports/Twin_busher_floats_2.json` | the twin, 2 + 2, floats | 3 aluminium |
| `mosquito` | `builds/candidates/mosquito.json` | **the bubble canopy** (`canopy 3`), one seat | 0 composite |
| `tigermoth` | `builds/candidates/tigermoth_2026-10.json` | **open cockpits** (`cpOpen 1`, `paxOpen1 1`), tandem | 2 plywood |

### The sets

| set | rows | page |
|---|---|---|
| `day` | as saved | the studio as is |
| `dusk` | as saved, plus `lightOn 1, li_pax 1` | `&day=dusk` and the rig's dim: the studio's own lights and `environmentIntensity` x 0.12 (CABIN-SHOTS' dusk; the phone studio has no hour). The cabin point lights are untouched |

**The cabin flood is on in EVERY frame, day included.**
- The garage turns it on for the first load of a name in a page (G3358, `src/viewer/app.js` per CABIN-SHOTS), and
  every build here was the first and only load of its page.
- The logs read `li_flood 1` and one point light of 4.0 lit, even where the file saves `li_flood 0` (Cub, C172,
  Jodel, Mosquito, Tiger Moth).
- `li_pax 1` (dusk) adds no point light ("2 point lights, 1 lit" in every dusk log). The passenger lamps show only as
  their fittings.

### The views

All aim at the bulkhead's cabin face. The face is the forward sheet of the `bulkhead` faces, at the middle of its
x/y box. The frame is the layers' own: +x port, +z forward.

| view | rig view | what it is |
|---|---|---|
| `sideAft` | `bk:out/0/0/3` | outside, port beam, eye level with the face's middle, 3 m (the brief's) |
| `q34Aft` | `bk:out/30/0/3` | outside, 30° aft of the beam (the brief's "azimuth about -60"), level, 3 m |
| `q34Fwd` | `bk:out/-30/0/3` | **extra**: 30° forward of the beam, level, 3 m. MEASURE.md shows the face is only seen from forward of the beam |
| `inFwd` | `bk:infwd` | inside: the eye at the pilot's eye (`CAGE_CREW_EYE.p`), the pilot's body hidden (the game's own `heads` list), the near plane set to 0.03 m (`FLIGHT_PROBE.camera()`), skin on |
| `inClose` | `bk:inclose/0.6` | inside: the eye 0.6 m forward of the face's middle, along the axis, near plane 0.03 m |
| `sideAftMid`, `q34FwdMid` | `bk:out/0/0/3/0.42`, `bk:out/-30/0/3/0.42` | **C172 extras**: the same, aimed at mid-cabin height (y 0.42, halfway from the waist to the roof), because the C172's "face" is a strip at the roof (MEASURE.md) |
| `inFwdFwd` | `bk:infwd/-0.215/0/0.4@0.005` | **Jodel extra**: the eye on the centreline, 40 cm forward of the pilot's eye (about where the panel sits), looking back at the face |

## The stills

What each shows, and what is wrong or dull.

### Cub (steel tube; the face 0.75 x 0.90 m, 5.5 cm behind the rear seat)

| still | what it shows | wrong / dull |
|---|---|---|
| `cub_day_sideAft` | The yellow fabric side at the face's station; the rear window's aft end at the left; the wing above | **No bulkhead in sight.** The face is edge-on behind the aft pax pillar (MEASURE: 0.1 % visible). The rear window ends 5 mm forward of it |
| `cub_day_q34Aft` | The tail cone's side from 30° aft; the rear window from behind; the crew's red shirt in the front window | Nothing of the bulkhead: it faces away from this eye |
| `cub_day_q34Fwd` | Through the rear window's aft end: **a dark slice of the cabin's back**, the top of the face. The lift strut crosses the frame | The face reads as a flat dark band, no detail, no edge. The strut covers 28 % of it (MEASURE) |
| `cub_day_inFwd` | From the pilot's eye: **a near-black rounded-rectangle wall** filling the cabin's back. The rear seat in front of it; a dome lamp on the roof just forward of it; the stabiliser seen through the rear side windows | The wall is near-black: flat, no edge, no feature. The rear seat's back goes **21.6 cm into it** (MEASURE), so the seat looks glued to the wall |
| `cub_day_inClose` | Close: a dark brown, slightly grained face; the rear seat's back in the lower half | Dull. The only texture is the finish grain |
| `cub_dusk_sideAft` | As day, dimmed | Nothing of the bulkhead |
| `cub_dusk_inFwd` | As day; the roof dome glows | The wall stays black under the lamp. A lamp beside it does not light it (the cabin darkening scales the lamps too, MEASURE) |

### C172 (aluminium; the "face" is a 0.84 x 0.14 m strip at the roof)

| still | what it shows | wrong / dull |
|---|---|---|
| `c172_day_sideAft` | Eye level with the strip, i.e. **with the wing**: the wing's trailing edge across the top, the two small rear windows below | The aim is the roof strip, so the frame is mostly the wing's underside and the sky. Through the rear windows the cabin is **cream, open aft**: no wall |
| `c172_day_q34Aft` | The rear fuselage from 30° aft at roof height; the crew in the side windows | Nothing of a bulkhead |
| `c172_day_q34Fwd` | **The eye is inside the wing** (the level eye at roof height, 30° forward of the beam): a blue-on-grey box fills the top half. It is the energy layer's tank (`edVessel_0R`; the probe's first hit), seen from inside the wing skin | A rig artefact of the strip's height, kept as shot. Use `c172_day_q34FwdMid` |
| `c172_day_inFwd` | From the pilot's eye: **a dark riveted panel across the ceiling**, then the cream rear cabin, open aft into **the tail cone**, its frames and an orange item at the far end | The cabin has no back wall. The dark panel is the wing layer's mesh inside the cabin top (the probe: the wing covers 93 % of the strip from this eye) |
| `c172_day_inClose` | 0.6 m forward of the strip, at roof height: the headliner, and the tail cone's frames at the bottom edge | Only a ceiling. The strip is a sliver |
| `c172_day_sideAftMid` | **Extra**, aimed at mid-cabin: the two rear side windows; through them the cream back of the cabin and the light of the open bay | No wall, no shelf, nothing at the back: an empty cream box |
| `c172_day_q34FwdMid` | **Extra**, the same from 30° forward | The same empty bay |
| `c172_dusk_sideAft` | As day (the wing, the windows), dimmed | As day |
| `c172_dusk_inFwd` | As day; the cabin by the flood; the tail cone dark | The open tail cone reads as a dark hole. It is the one "feature" this aeroplane has back there |

### Jodel (plywood; the face 1.03 x 1.06 m, 36 cm behind the seat backs: the baggage room)

| still | what it shows | wrong / dull |
|---|---|---|
| `jodel_day_sideAft` | The canopy and the crew from the beam; the low wing's red top across the bottom | The face is behind the solid fuselage aft of the canopy (MEASURE: 0 % from the beam) |
| `jodel_day_q34Aft` | The canopy's aft frame from behind | Nothing of the face |
| `jodel_day_q34Fwd` | Through the canopy's side: the crew, and behind them **a warm orange-brown wall** at the canopy's aft end | The face reads as one flat warm-brown board above the seat backs. The crew hide part of it (12 %, MEASURE) |
| `jodel_day_inFwd` | From the pilot's eye: **the seat backs** (dark leather, a tan frame) and the floor, steeply down | The face is only 33 cm behind the eye, so aiming at it looks about 50° down. The pilot never sees it without turning round. Kept as the brief's view |
| `jodel_day_inFwdFwd` | **Extra**, from the panel looking back: **a plain warm-brown wall** over the two seat backs, lit as a gradient by the flood | The dullest wall of the six: a flat sheet, no edge, no shelf, no fitting. Yet it is lit (spruce finish), so a feature would read here |
| `jodel_day_inClose` | Close: the brown face with a bright patch of flood light at its top; the seat backs' frame; a crew sleeve at the right | The flood hits it, the only bulkhead lit like this. The eye is in among the crew |
| `jodel_dusk_sideAft` | As day, dimmed | As day |
| `jodel_dusk_inFwd` | As day's inFwd | As day's inFwd |

### Twin (aluminium; the face 0.95 x 1.23 m, 3.1 cm behind the rear seats)

| still | what it shows | wrong / dull |
|---|---|---|
| `twin_day_sideAft` | The rear door and window under the wing; the nacelle and the prop at the right | The face is edge-on behind the pillar: 0 % (MEASURE) |
| `twin_day_q34Aft` | The nacelle and the prop fill the right half | Nothing of the face: the nacelle covers 90 % of the line (MEASURE) |
| `twin_day_q34Fwd` | Through the rear window: **a plain warm-brown board**, the top of the face; the wing strut crosses the frame | The only through-glass view that shows a wall at all: a flat brown card, no edge or detail |
| `twin_day_inFwd` | From the pilot's eye: **a dark wall** behind the two rear seats, a light edge at its left | Dark and flat. The rear seats go **10.8 cm into it** (MEASURE) |
| `twin_day_inClose` | Close: a dark brown face, the two rear seat backs at the bottom | Dull |
| `twin_dusk_sideAft` | As day, dimmed | As day |
| `twin_dusk_inFwd` | As day, darker | The wall goes nearly black |

### Mosquito (composite, bubble canopy; the face 0.54 x 0.61 m, top 10 cm above the waist)

| still | what it shows | wrong / dull |
|---|---|---|
| `mosquito_day_sideAft` | The bubble's aft end and the green fuselage | The face is below the canopy rail, behind the skin: 0 % from any level eye (MEASURE). It is only seen from above (57 % at 60° forward, 35° up) |
| `mosquito_day_q34Aft` | The bubble from behind; the pilot inside | Nothing of the face |
| `mosquito_day_q34Fwd` | The bubble from 30° forward; the wing root | Nothing of the face |
| `mosquito_day_inFwd` | From the pilot's eye: a long empty bay. **A big metal fuel tank** on the floor, **a lamp on the bulkhead's top edge** (the flood's `bulkhead` rung, the only build where today's lamp lands on this wall), the black face behind | The face is near-black. The tank, 1.5 m of bay and the lamp are what reads |
| `mosquito_day_inClose` | Close: black, with the carbon-weave edge of the face at the bottom left | Black |
| `mosquito_dusk_sideAft` | Dimmed: the bubble barely shows | Nothing |
| `mosquito_dusk_inFwd` | As day, with the lamp glowing | The lamp glows; the wall under it stays black |

### Tiger Moth (plywood, open cockpits; the face 0.67 x 0.82 m behind the rear cockpit)

| still | what it shows | wrong / dull |
|---|---|---|
| `tigermoth_day_sideAft` | The yellow fuselage, the roundel, the rear cockpit's coaming, a helmet | The face is below the coaming: 0 % from a level eye (MEASURE). It is only seen from above (22 % at 60° up) |
| `tigermoth_day_q34Aft` | The same from 30° aft | Nothing of the face |
| `tigermoth_day_q34Fwd` | From 30° forward: the screen, the helmet, a flying wire | Nothing of the face |
| `tigermoth_day_inFwd` | From the rear-cockpit pilot's eye: **a bright orange wall** filling the frame, a tan rail across it, a leather top below | Lit (spruce, open to the sky) but bare: one colour from edge to edge |
| `tigermoth_day_inClose` | The eye is inside the rear-cockpit pilot: red cloth | A rig artefact (the eye 0.6 m forward of the face is where the pilot sits; MEASURE: crew 100 %). Kept as shot |
| `tigermoth_dusk_sideAft` | As day, dimmed | As day |
| `tigermoth_dusk_inFwd` | As day; the wall goes from orange to dark brown at the bottom | As day |

## What the stills say, in short

1. **From outside, through a side window at 3 m, today's aft bulkhead is not seen.** On every build it is 0 % from
   the beam and from aft of it.
   - It shows only from forward of the beam, through the rear glass, as a flat dark or brown band above the seat
     backs: Cub, twin, Jodel.
   - It shows only from above on the bubble and the open cockpit.
2. **From inside it is a featureless sheet.**
   - It is near-black on the steel-tube, aluminium and composite builds, and plain warm brown on the plywood ones.
   - No edge, bevel, shelf or fitting breaks it. The Mosquito's lamp is the only object on any bulkhead.
3. **The C172 has none.** Its aft-pax "bulkhead" is a 14 cm strip at the roof (MEASURE, `_cage_gen.js:3633-3657`), and
   the cabin is open into the tail cone.
4. **The Cub's and the twin's rear seat backs go into the wall** (21.6 cm and 10.8 cm).

## Rig notes (for the next rig user)

1. **The rig** (`rig/plane_shot_bk.diff`) is a scratch copy of `tools/plane_shot.js` from `origin/claude/pillar-anchors`
   (b6299ae8, the one with `at:` and `fit:`):
   - plus CABIN-SHOTS' `plane_shot_cab.diff` (eb2a7f10a: `--qs`, `--dim`, the lights log, `cab:`);
   - plus this run's `bk:` views. It ran in the scratch tree; nothing in the repo moved.
   - The diff ignores CR: the base has mixed line endings.
2. **The aim: use the face's twin sheet, not a z.**
   - The rig picks the face as the bulkhead vertices at the panel's largest z (± 4 mm). On a leaning panel that is
     its bottom edge.
   - **The first Jodel runs aimed at y -0.499, 0.5 m low**, under the cabin floor. They were discarded and re-shot
     with `@0.005`, the probe's face centre (MEASURE's twin-sheet pick).
   - The Mosquito's aim is 4 cm under the probe's centre; the others match.
   - A real tool should take the face from the twin sheets, as `rig/bulk_probe.body.txt` does.
3. **`inFwd` needs care on short cabins.**
   - The Jodel's face is 33 cm behind the eye. Aiming at it looks down into the seats.
   - An eye raised 20 cm (a first extra, `inFwdHigh`) left the roof (y 0.63 > `roofY` 0.562) and was dropped.
4. **G3358 (the flood on the first load of a name in a page):** one page per build per set, so each set saw the flood
   as a player does.
5. **`rig/` holds:**

   | file | what it does |
   |---|---|
   | `run_stills.sh` | one page per build per set |
   | `to_jpg.py` | the PNGs → `stills/` names |
   | `bulk_probe.body.txt`, `probe_run.js`, `summ.js` | the headless measure |
   | `bverts.body.txt` | the C172's raw vertices |
   | `measure_out/` | the measure's outputs |
