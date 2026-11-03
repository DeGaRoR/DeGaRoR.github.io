# AFT BULKHEAD: what of it the player actually sees (AFT-BULKHEAD-LOOK, part 3: headless, node, no Chrome)

**Code measured:** origin/master adb2d2a9 (train L30b), unchanged.

**How it was measured:**
- `rig/probe_run.js` runs `rig/bulk_probe.body.txt` in the page context after the build, through
  `tools/_load_build.js` (`FLYDIY_JOIN_PROBE`, with `FLYDIY_HEADLESS_MS=1` so the layers get the sheet as the page
  does).
- Raw output: `rig/measure_out/<build>.json`. A one-line-per-view summary: `node rig/summ.js <dir> <builds>`.

**Frame:** the layers' own (`CAGE_UI.MS` x `CAGE_UNIT` x `planeScale`), in metres: +x port, +y up, +z forward.
`A.waistY` and `A.roofY` are the crew layer's anchors (`CAGE_CREW.A`).

## Method

1. **The face.**
   - The bulkhead is drawn as two sheets 5 cage-mm apart along z, joined by a rim wall (`_cage_gen.js:3709-3737`).
   - The forward (cabin) sheet is picked by its twins: a vertex of that sheet has a twin at the same x, y, 5 mm
     further aft.
   - A sheet cannot be picked by a single z: each panel vertex takes its z from the pillar ring's own vertex
     (`_cage_gen.js:3695`, `p[2] - SETB`), so on a raked ring the panel leans or bends.
2. **The grid.** A 3 cm grid over the face's x/y box. Each point is kept where a ray along -z lands on the forward
   sheet, and the point is that landing.
3. **The rays.** From each eye, a segment to each grid point. It is tested against:
   - every cage face except the bulkhead;
   - every visible mesh of the scene: seats, crew, wing, struts, lamps, floats, booms, tanks.

   **The first opaque thing crossed names the point's fate.**
   - Glass (`CAGE2.CAGE_GLASS_MATS`) is see-through. The ray records that it crossed a pane (`thruGlass`) or no pane
     (`thruOpen`).
   - A lamp within 8 cm of the face counts as part of the wall.
   - For `inFwd` the pilot's own body is left out, as the game hides it when you look out of it
     (`CAGE_CREW_EYE.heads`).
4. **The eyes.** All are aimed at the face's centre (the middle of its x/y box; z the mean of the top and bottom
   rows).

   | eye | where |
   |---|---|
   | `sideAft` | port beam, level, 3 m |
   | `q34Aft` | 30° aft of the beam, level, 3 m (the brief's azimuth about -60) |
   | `q34Fwd` | 30° forward of the beam, level, 3 m. Not in the brief: the side the face is seen from |
   | `inFwd` | the pilot's eye (`CAGE_CREW_EYE.p`) |
   | `inClose` | 0.6 m forward of the centre |
   | sweep | 3 m, azimuth -60…45° (minus = forward of the beam), elevation 0 / 15 / 35 / 60° |

5. **Above the seat.** "Above the seat" is above the top of the rear seat's own mesh (the crew layer's `edSeat<n>`
   box).

**Limits of the method:**
- The crew are skinned meshes; three.js's raycast of them is close, not exact.
- The eye is a point (no near plane). `inFwd` sits inside the cabin with the skin on, as in the game's interior view.

## 1. The outline

| build | z (m) | lean | width x height (m) | y range (m) | vs waist / roof (m) | forward-sheet area | rear seat back → face | glass aft end vs face |
|---|---|---|---|---|---|---|---|---|
| **Cub** (cub_2026-09-20_corrected) | 0.040 | flat, vertical | 0.745 x 0.897 | -0.441 … 0.456 | from 0.506 below the waist to 0.224 under the roof (roof 0.680) | 0.62 m² | 5.5 cm | rear window ends 5 mm **forward** of it (0.045) |
| **C172** (cessna172_2026-09-20_corrected) | 0.602 … 0.677 | n/a: **a strip, not a wall** | 0.844 x **0.136** | **0.613 … 0.749** | all of it **above** the waist; its top is 4 mm over `roofY` 0.745 | 0.18 m² | 9.3 cm | the rear window (`drawnPane`) runs from z 0.367 to 1.311, **past it both ways** |
| **Jodel** (jodel_2026-09-20_corrected) | 1.659 … 1.710 | leans back 2.6° (top 5 cm aft of the bottom) | 1.030 x 1.058 | -0.524 … 0.534 | 0.554 below the waist, 2.9 cm under the roof | 0.98 m² | 35.7 cm (the baggage shelf's room) | side window ends 6.7 cm forward (1.777) |
| **Twin** (Twin_busher_floats_2) | 0.855 | flat, vertical | 0.945 x 1.232 | -0.655 … 0.577 | 0.729 below the waist, 3.0 cm under the roof | 1.07 m² | 3.1 cm | rear window ends 1.1 cm forward (0.866) |
| **Mosquito** (candidates/mosquito, canopy 3 = bubble) | 0.038 … 0.043 | flat | 0.539 x 0.607 | -0.430 … 0.176 | **only 10 cm above the waist**, 0.49 m under the canopy top | 0.27 m² | 1.49 m (one seat; an empty bay between) | the bubble ends 13 cm forward (0.172) |
| **Tiger Moth** (candidates/tigermoth_2026-10, cpOpen 1, paxOpen1 1) | 0.282 | flat, vertical | 0.671 x 0.823 | -0.356 … 0.467 | 0.520 below the waist, 3.9 cm under the roof line | 0.49 m² | 26.1 cm | no side glass (the screen ends at 0.832) |

What the outline says:

- **On every build the panel runs well below the waist** (0.5-0.7 m), down into the belly, behind and under the rear
  seat. Only the band above the seat backs can ever be seen. That band is:

  | build | share of the face above the rear seat |
  |---|---|
  | Cub | 27 % |
  | Jodel | 38 % |
  | Twin | 39 % |
  | Tiger Moth | 36 % |
  | Mosquito | 2 % (the single seat's top) |

- **The C172 has no aft wall.**
  - Its aft passenger pillar (`pillarPassenger` at pilPaxA) is an **arch** over the rear window, not a full hoop.
  - Its band therefore has ONE boundary cycle. `_cage_gen.js:3633-3657` assumes two (the cabin side and the aft
    side) and takes the larger-z one.
  - The "bulkhead" it builds is the arch strip itself, copied inward by the shell: 0.84 x 0.14 m along the roof at
    the pillar's own z span (vertices at z 0.602 / 0.639 / 0.677; the pillar spans 0.608-0.682,
    `rig/measure_out/c172_bulkhead_vertices.json`).
  - Below it, the cabin is open aft into the rear window bay.
  - `bulkheadAt` (`tools/_cage_light.js:1349-1392`) wants a face with |n.z| ≥ 0.8 between the waist and the roof, so
    its rung has almost nothing to land on here.
- **The Mosquito's panel is low.** Under a bubble the face stops 10 cm above the waist, so it is a low board behind
  an empty bay.
- **Two rear seats go THROUGH the bulkhead.** These are the seat meshes' vertices aft of the face, inside its
  outline:

  | build | seat | vertices aft of the face | deepest | at y |
  |---|---|---|---|---|
  | Cub | seat 2 | 726 / 2762 | **21.6 cm** | 0.124 |
  | Twin | seats 3 and 4 | 679 / 2762 each | **10.8 cm** | 0.013 |

  The causes:
  - the passenger row's station is the section's aft waist + 5 cm (`tools/_cage_crew.js:3222`);
  - the seat's raked back reaches aft of it (`seatGeom`, `:360`);
  - the bulkhead stands only 10 mm behind the pillar's cabin face (`_cage_gen.js:3684`).

  No other build's seats cross the face.

## 2. How much of it the player sees

`vis` is the % of the face's grid with nothing opaque in the way. `above seat` is the % of the part above the rear
seat's top that is clear. The blockers are listed largest first, as % of the grid.

| build | view | vis | thru glass | thru opening | above seat | blocked by |
|---|---|---|---|---|---|---|
| Cub | sideAft | **0.1** | 0 | 0.1 | 0 | pillarPassenger 70.2, joint 29.6 |
| Cub | q34Aft | **0** | 0 | 0 | 0 | body 61.2, floorLoop 19.7, pillarPassenger 9.3, waistband 7.7 |
| Cub | q34Fwd | **24.5** | 24.5 | 0 | **85.3** | strut 28.2, body 26.9, floorLoop 17.2 |
| Cub | inFwd | 69.5 | 0 | 69.5 | 100 | seat 29.2, tube 1.3 |
| Cub | inClose | 67.0 | 0 | 67.0 | 99.5 | seat 32.6 |
| C172 | sideAft | **0** | 0 | 0 | 0 | pillarPassenger 49.2, ceilingLoop 49.2 |
| C172 | q34Aft | **0** | 0 | 0 | 0 | taper 62.7, ceilingLoop 37.3 |
| C172 | q34Fwd | **0** | 0 | 0 | 0 | a fuel tank of the energy layer (`edVessel_0R`) 100 |
| C172 | inFwd | 6.8 | 0 | 6.8 | 6.8 | **wing 93.2** |
| C172 | inClose | 6.8 | 0 | 6.8 | 6.8 | wing 93.2 |
| Jodel | sideAft | **0** | 0 | 0 | 0 | pillarPassenger 79.1, wing 20.9 |
| Jodel | q34Aft | **0** | 0 | 0 | 0 | body 59.0, wing 16.4, waistband 10.4 |
| Jodel | q34Fwd | **10.5** | 10.5 | 0 | 27.5 | body 28.7, wing 21.1, crew 11.9, waistband 10.2 |
| Jodel | inFwd | 59.0 | 0 | 59.0 | 97.3 | seat 39.8 |
| Jodel | inClose | 18.7 | 0 | 18.7 | 48.8 | seat 42.8, crew 37.9 |
| Twin | sideAft | **0** | 0 | 0 | 0 | pillarPassenger 94.8, float struts 1.9, boom 1.9 |
| Twin | q34Aft | **0** | 0 | 0 | 0 | the nacelle / cowl 90.0, pillarPassenger 5.6 |
| Twin | q34Fwd | **31.5** | 31.5 | 0 | **62.5** | body 32.0, floorLoop 18.5, wing 7.4 |
| Twin | inFwd | 53.7 | 0 | 53.7 | 74.1 | seat 36.3, wing 10.0 |
| Twin | inClose | 55.1 | 0 | 55.1 | 79.5 | seat 36.9, wing 7.9 |
| Mosquito | sideAft | **0** | 0 | 0 | 0 | pillarPassenger 100 |
| Mosquito | q34Aft | **0** | 0 | 0 | 0 | body 69.5, floorLoop 30.5 |
| Mosquito | q34Fwd | **0** | 0 | 0 | 0 | body 79.3, floorLoop 20.7 |
| Mosquito | inFwd | 89.5 | 0 | 89.5 | 100 | the tank (`edVessel_0_shell`) 10.2 |
| Mosquito | inClose | 100 | 0 | 100 | 100 | - |
| Tiger Moth | sideAft | **0** | 0 | 0 | 0 | pillarPassenger 100 |
| Tiger Moth | q34Aft | **0** | 0 | 0 | 0 | taper 54.3, floorLoop 20.3, waistband 12.7 |
| Tiger Moth | q34Fwd | **0** | 0 | 0 | 0 | body 67.2, floorLoop 16.8, waistband 14.9 |
| Tiger Moth | inFwd | 74.4 | 0 | 74.4 | 93.8 | seat 22.9, woodFrame 2.1 |
| Tiger Moth | inClose | 0 | 0 | 0 | 0 | crew 100 (the eye is inside the rear-cockpit pilot) |

### The sweep: % of the face visible from 3 m

Minus is forward of the beam. Only the azimuths with a non-zero cell are shown: every build reads 0 aft of the beam,
at 15, 30 and 45°.

| build | el | -60 | -45 | -30 | -15 | 0 (beam) |
|---|---|---|---|---|---|---|
| Cub | 0 | 27.5 | **29.0** | 24.5 | 27.6 | 0.1 |
| Cub | 15 | 3.3 | 0 | 0 | 0 | 0.1 |
| Cub | 35 | 0 | 0.6 | 4.6 | 24.3 | 0 |
| Cub | 60 | 4.4 | 8.2 | 9.2 | 8.0 | 0 |
| C172 | all | 0 | 0 | 0 | 0 | 0 (1.7 at +45° aft, 60° up) |
| Jodel | 0 | 9.5 | 8.3 | 10.5 | 12.9 | 0 |
| Jodel | 15 | 16.3 | 8.2 | 12.8 | **18.2** | 0 |
| Jodel | 35 | 8.4 | 10.1 | 13.5 | 18.1 | 0 |
| Jodel | 60 | 8.1 | 10.1 | 9.9 | 1.9 | 0 |
| Twin | 0 | 19.6 | 23.1 | **31.5** | 31.4 | 0 |
| Twin | 15 | 23.2 | 12.6 | 0 | 0 | 0 |
| Twin | 35-60 | 0 | 0 | 0 | ≤ 0.1 | 0 |
| Mosquito | 15 | 30.8 | 8.5 | 0 | 0 | 0 |
| Mosquito | 35 | **57.3** | 26.4 | 3.4 | 0 | 0 |
| Mosquito | 60 | 35.6 | 17.3 | 0 | 0 | 0 |
| Tiger Moth | 15 | 2.8 | 2.2 | 1.1 | 0 | 0 |
| Tiger Moth | 35 | 0 | 0 | 8.2 | 0 | 0 |
| Tiger Moth | 60 | 17.5 | **22.2** | 17.0 | 0 | 0 |

## 3. The answers to the brief

1. **The outline:** section 1.
2. **Visible from `sideAft` (port beam, level, 3 m), above the seat backs and inside the window outline:**

   | build | visible |
   |---|---|
   | Cub | 0.1 % |
   | C172 | 0 |
   | Jodel | 0 |
   | Twin | 0 |
   | Mosquito | 0 |
   | Tiger Moth | 0 |

   - From the beam the face is edge-on behind the aft passenger pillar, on all six builds.
   - The face is seen only from **forward** of the beam, through the rear side glass:

     | build | visible | where from |
     |---|---|---|
     | Cub | up to 29 % | 45° forward, level; 85 % of the part above the seat at 30° |
     | Twin | up to 31.5 % | 30° forward, level |
     | Jodel | up to 18 % | 15° forward, 15° up |
     | Mosquito (bubble) | up to 57 % | from above, 60° forward, 35° up |
     | Tiger Moth (open) | up to 22 % | from above, 60° up |
     | C172 | about 0 | anywhere outside |

   - From inside, the pilot sees 54-90 % of it, the rest hidden by the rear seats.
3. **Do the side window frames reach aft of the bulkhead?**
   - **No, on the four closed cabins with a rear window.** It ends 5 mm (Cub), 11 mm (twin) and 67 mm (Jodel) forward
     of the face. So from the beam we see the face edge-on, behind the pillar.
   - **The C172 is the exception:** its rear window runs aft of the strip, but there is no face behind it to see.
   - The Mosquito's bubble ends 13 cm forward of the low panel. The Tiger Moth has no side glass.
4. **What hides it.** For each view the largest blockers are in section 2.
   - **The aft passenger pillar** (from the beam, all builds).
   - **The fuselage skin aft of the window** (from aft of the beam, all builds).
   - **The lift strut** (Cub, 28 % at 30° forward).
   - **The wing** (Jodel 21 % from the beam; Cub 100 % from 15° up and forward; the C172's strip from inside, 93 %:
     the wing layer's mesh lies between the pilot's eye and the strip at the roof).
   - **A C172 fuel tank of the energy layer** (`edVessel_0R`, from 30° forward).
   - **The rear seats** (23-43 % of the face from inside).
   - **The crew** (Jodel 12 % from 30° forward; the Tiger Moth's rear-cockpit pilot fills `inClose`).

## Where each fact is in the code (nothing here is fixed; named only)

- **The C172 strip:** `tools/_cage_gen.js:3633-3657`. The boundary walk assumes the aft pax band is a closed hoop
  with two cycles. On an arch over a window it is one cycle, and the panel becomes a copy of the arch.
- **Not flat on a raked ring:** `tools/_cage_gen.js:3695` puts each vertex at its ring vertex's own z
  (`p[2] - SETB`). The comment at `:3658-3666` says "flat and vertical regardless of the aft shoulder"; the Jodel
  leans 2.6° and the C172 strip spans 7.5 cm in z.
- **The rear seat through the face:**
  - `tools/_cage_crew.js:3222` (the pax row's station: aft waist + 5 cm + `paxSeatZ`);
  - the back's rake (`seatGeom`, `tools/_cage_crew.js:360`);
  - the panel's 10 mm setback (`tools/_cage_gen.js:3684`).
- **Near-black from inside:** the bulkhead is an inside section (`tools/_cage_ui.js:825`, role `struct` at
  `src/viewer/aeroskin.js:444`). The cabin shader multiplies all its light by 1 - uCabin.x, the lamps included
  (`src/viewer/aeroskin.js:3805-3825`; uCabin.x = 0.81 x coverage, `:3867`, `:3897`). A lamp's emissive lens is
  spared. Not measured in the page; seen in the stills (README.md).
- **The tube construction's bulkhead finish:** the bulkhead's role `struct` resolves per construction to
  `steelTube` (tube-and-fabric), `spruce` (wood), `bareAlu` (alloy), `composite` or `gelcoat`
  (`src/viewer/aeroskin.js:496-516`). The panel wears its builder's FRAME finish.
