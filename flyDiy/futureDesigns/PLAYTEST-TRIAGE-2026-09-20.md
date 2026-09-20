# PLAYTEST TRIAGE — 2026-09-20 (the 17-19 September playtest, ~135 remarks)

Source: `bugReports/bugReport.txt` + the user's message of 2026-09-20 (the
float, pusher and Cessna sections), the 13 screenshots in `bugReports/`, and
the builds `flydiy-build (3).json`, `flydiy-build (4).json`, `cessna (2).json`.
Baseline: HEAD `30cbf395` (G434.3b), built `4adae7bb` 2026-09-19.

**Four builds named in the report are NOT in `bugReports/`** — they are in
`~/Downloads`: `birdman.json`, `cessnaFloats.json`, `cessnaFloatsWOrks.json`,
`pusherLight.json`. `cessnaMetal (1).json` was not found anywhere. Copy them
into `bugReports/` before starting A1 / S1 / A7 (nothing was moved by this
triage).

Nothing in the tree was modified by this triage. Every "investigated" line
below was measured headless at HEAD with the commands quoted; each session's
starter prompt carries what its agent needs to reproduce.

---

## 0. HOW TO RUN THIS

- One thread per session ID below. Paste the STARTER PROMPT verbatim (§4);
  it names the files, the repro, the evidence and the acceptance.
- Every session obeys HANDOVER's ritual: read the handover + the code first,
  one chantier, `node tools/run_gates.js` green before delivery, the
  shared-tree commit recipe (`docs/SHARED-TREE-PRACTICES.md`), one G number
  per landing, and a HANDOVER entry. Sessions in the same phase can run in
  PARALLEL only when their OWNERSHIP lines do not overlap (given per session).
- **The order the user asked for**, and how the sessions map to it:

| Phase | Goal | Sessions |
|---|---|---|
| **A** STABLE RELEASE | every playtest BUG fixed, one built commit that plays clean | A1 → A2 … A9 (A1 first; A2-A9 in any order, parallel by ownership) |
| **S** FLOATS | the float physics cost + the 35 km/h ceiling, then the modelling | S1 (in phase A, it is a bug), S2 (with T2) |
| **B** FINISH VEGETATION | impostor rebake productized, impostor-first LOD, grass ruling, bushes/muskeg | B1 → B2 → B3 → B4 |
| **C** ALPHA SPLATTING | terrain material library from the Jolene bench's 11 types, the techniques inventory | C1 → C2 |
| **D** PERFORMANCE | profiling first, optimisation second (holistic, after B and C so it measures the real thing) | D1 → D2 |
| **T1** (parallel, always) | the aeroplanes made perfect: C172 fiche, pusher, blurred prop, drawing bugs | T1.x |
| **T2** (parallel, always) | the garage easier to operate: pillar chantier, windows, floats presets, small controls | T2.x |
| **W** later | world building, AP robustness, new airports, cross-country under the AP | W1 → W3 |
| **G** last | welcome screen, credits, career(s), wallet, costs, events | G1 → G4 |

- Severity tags in §3: **P0** blocks play · **P1** wrong and visible every
  flight · **P2** wrong, visible sometimes · **P3** polish/feature.

---

## 1. WHAT THE INVESTIGATION FOUND (answers to the "what happens?" questions)

### 1.1 "The pushers are giving thrust in the wrong direction" — NOT the sign. The birdman NOSES OVER under thrust.
Reproduced headless: `node tools/pilot_trace.js ~/Downloads/birdman.json --max 240`
→ `ROLL@0 ABORT@8 · rejected-takeoff: not accelerating (-0.17 m/s^2 at V=0.0) — thrust is going nowhere`.
A raw-sim probe (full throttle from rest, no pilot) shows what the pilot's
line hides: thrust is applied (985 N on `refs.engine` = the ENGL/ENGR pair at
x 2.49, y 1.12, along −xAft exactly like a puller — the solver has NO
pusher-specific sign, `30_solver.js:920-935`), the plane moves forward 1.5 m
in 2 s, and pitches to **−19° (nose down)**: station S0's keel touches the
ground (y −0.009), the mains unload (axle y 0.22 = the wheel just off the
ground), the tail is 1.9 m in the air, and the nose skid stops it. Same
build with the engine lowered to y 0.55 still fails (−0.89 m/s² at 8 s).
The older `pusherLight.json` (2026-09-11, engine y 1.05, mains 0.17 m BEHIND
the CG) flies a full circuit at HEAD — so this is a GEOMETRY case, not a
solver regression. Suspects, in order: (a) the birdman's mains at x 1.36 vs a
CG the probe reports at 2.54 — `sim.cgPos()` says 1.18 m AFT of the axle,
which cannot nose over statically (weight moment 4295 N·m vs thrust moment
1320 N·m) — so either `cgPos` is not the mass centre the ground sees (check
its frame/`bodyOrigin`) or the gear rule placed the mains off the nose station
rather than off the CG when the engine went aft (`gear.x` did not follow the
pusher's CG shift, 60_gen_spec §4 `engAt` / the taildragger gear rule);
(b) the tailwheel at `twX 4.9, twY 0.0009` (the rod boom's inclination —
the user's own remark "the rod inclination impacts the position of
everything related to tail wheel"). ALSO: the plaque says `FLIES A CIRCUIT`
(fp 1fea3615, 2026-09-18) — either the certificate flew a different spec
(the birth spec vs the joined one, a known split: "the gate flies the birth
spec, the game the joined one") or the user moved the engine after
certifying. Both must be closed: the pilot's diagnosis must say "nose-over:
pitched −19°, keel on the ground", and the shakedown must fail what the game
fails. Owner: session **A1**.

### 1.2 The Tyl trip: the battery ran out — 2 kWh is ~2 minutes of full power. It is realistic for 2 kWh; it is not a realistic pack.
`flydiy-build (4).json` = `e811_velis` (57.6 kW) on a **2 kWh** LiFePO4 pack.
Headless (`pilot_trace … "bugReports/flydiy-build (4).json" --csv`): at
t≈130 s, still on the downwind leg, the throttle is at 1.00 and V falls 31 →
19 m/s, vs −8 m/s, bank −44° → spiral, stopped at t=160. The pilot logged
`wont-climb: no climb left — accepting 10 m`; it has NO notion of energy at
all (`43_pilot.js`: the only "reserve" is runway length). A real Velis Electro
carries 24.8 kWh (~21 usable) for 50 min + reserve; 2 kWh is a paramotor's
pack — at this build's ~25 kW cruise it is ~5 min ≈ 9 km. Fixes, split:
the plaque already prints `full-throttle draw` "divide the pack into it" —
print the endurance and the still-air range instead (A5 plaque); a FUEL /
CHARGE gauge on the panel and the PFD (A3); an explicit "OUT OF CHARGE"
event + the pilot's emergency-landing manoeuvre (A8); and the visual props
must stop: `app.js:2975` spins the prop from `ctl.thr × lever`, never from
`sim.out.rpm` — so a dead engine (or one at the bottom of the sea) turns at
full rate forever (A3). Submerged physics: nothing in the solver knows the
craft is under water (the hydro model is the floats'; a wheeled build in the
sea is a wheeled build on a ground at the seabed) — A8 defines the "crashed
in water" end state.

### 1.3 The AP rudder oscillation on downwind — reproduced, and it is rudder SATURATION, not a track-following fight.
Same trace: on DOWNWIND with the track error steady at −557 m (a 260 m
overshoot the L1 law never recovers, `xt` flat), `dr` sits on its ±0.25 stop
for 10-15 s at a time and flips 21 times, bank wandering ±7° with it, period
~40 s. `rollTo()` (`43_pilot.js:931-937`) writes
`dr = −betaK·β − yawDampK·(eAR − eARslow) − ariK·da` clamped ±0.25 — on this
twin-boom (two fins, `tail.type twinBoom`) the β term or the yaw-damper's
high-pass is winding the rudder to its stop. Instrument β, eAR and the three
terms in the CSV, then retune per configuration (a twin boom has ~2× the fin
authority the gains were set on) — and clamp the rudder's contribution to a
fraction of `drMax` in cruise. Owner **A8**.

### 1.4 "Frame rate with floats is dramatic, even static" — it is the SOLVER, not the renderer.
Measured at HEAD, node, `sim.step(1/60)` averaged over 300 steps after settle
(`cessnaFloats.json`): **floats on water 121 ms/step · the same build on land
8.7 ms · the same build as a tricycle 6.9 ms**. A 1/60 s step costing 121 ms
is 14× the dry cost and cannot run at any frame rate; this is `32_hydro.js`
(per-panel Sutherland-Hodgman clipping of every hull triangle of both floats
against the free surface, every substep, with `per[]` re-allocated).
`pilot_trace` on water runs at 7.5× SLOWER than real time (455 s wall for
60 s). Owner **S1**, first item. (Note the dry 8.7 ms is also worth a look in
D1 — 124 nodes / 513 beams; the substep budget.)

### 1.5 The Cessna on floats cannot get past 35-44 km/h — reproduced; the bigger floats lift off.
`pilot_trace cessnaFloats.json --from SEA --to SEA` (L 6.3 m, B 0.61,
IO-360): still in `ROLL` at 60 s. `cessnaFloatsWOrks.json` (L 6.95, B 0.68,
O-540): lift-off at 28.2 s, 421 m run, `run needed 1259 m of 1500`. The user
is right that power does not matter (O-540 vs IO-360 same ceiling): the hull
never gets on the step — the hump is the wall. Candidates: the volume/beam
rule vs the Cessna's 1 100 kg (Wipaire 2350/3000 floats for a 172 are
7.1-7.5 m, beam 0.75-0.8, ~1.1 m³ EACH — the 6.3 m build is undersized, so
the sim may be honest), the `kTr` transom fade / ventilation (`dVent`) not
opening, the `inc −0.5°` float incidence, and the pilot's back-stick schedule
on the water (`deWater 0.70`). S1 must (1) settle whether the drag is honest
with the H3 calibration numbers (WATER-H0/H1 docs), (2) publish a FLOAT
SIZING ADVISOR (mass → L/B/volume, from Wipaire's range) on the floats page,
and (3) make the hydroplane test a certificate with a verdict that says WHY.

### 1.6 The garage time-of-day picker is off by one row — an exclusive threshold.
`hangar.js:3226 moodFor(day)`: `el > 25 ? AFTERNOON : el > 8 ? GOLDEN : el > 0 ? SUNSET : el > −6 ? DUSK : NIGHT`.
The presets (`day_clock.js:44-56`) put the sun at **−0.833°** for `sunset`
(→ `el > 0` false → DUSK) and at **−6°** for `dusk` (→ `el > −6` false →
NIGHT). Exactly the user's report. Fix the bands (sunset = −6 < el ≤ 8 low
sun, dusk = −12 < el ≤ −6, night below) or, better, pick the row by the
PRESET name when one was chosen. Owner **A2**.

### 1.7 Clouds drawn over the aircraft and the hangar in the garage — a depth flag.
`hangar.js:3202`: the shed's cloud dome is `CLOUDS.domeMesh(…, 598, 24)`
with `renderOrder = 1`; `clouds.js:361 domeMat` is `transparent, depthTest:
false, depthWrite: false`. Drawn after the opaques with no depth test, it
paints over everything. Draw it BEFORE the opaques (renderOrder below the
sky's, or depthTest on: the walls are opaque at 12 m, the dome is at 598 m,
the test resolves it for free). Owner **A2**. (Same family: the 1-px sky
line round the aeroplane over a cloud in flight — the composite's
depth-aware upsample at the silhouette — A6.)

### 1.8 "Log the flight" / "the shed" from the cockpit view leaves the camera outside the hangar.
`enterGarage()` (`app.js:5518`) resets the sim, the room and the plaque but
touches NO camera state: `cam.mode` stays `'cockpit'`, `HEADCAM` state, and
the azT/elT/distT targets stay whatever the chase/cockpit wrote in flight;
`flCamera()` returns early `if (inGarage)`. The interior-then-any-view trick
works because `rail.camera('i'…)` → `exitInterior()` writes `distT 12, azT
−2.5, elT 0.25`. Fix: enterGarage applies the garage's framing preset
(`camera('q')` semantics) and clears the flight camera mode. The "renderer
still shows sky" is the same camera looking out of the door. Owner **A2**.

### 1.9 Impostors dark and thin — no single culprit found; four candidates, all post-W0c.
The impostor material (`render_world.js:1917 impostorMat`) is a
MeshStandardMaterial with the leaf wrap/SSS terms and `uIGain` default 6;
since it was judged: the SKY chantier changed the light unit and exposure
(G408-G419: `LIGHT_UNIT = PI`, Hillaire sun, the `_C = directionalLights[0]
.color * RECIPROCAL_PI` take-back in `trees.js:208`), the CLOUD shadow
multiplies `_C` inside the leaf term (G425, `cloudShadow()` — returns 1 when
`uCloudP[0].w < 0.5`, so only live with clouds on), the roll-out ring THINS
(`uThin`, G420) and the vegetation V1 species/gain payload (G427). The map
readiness race (TREE-IMPORT §6 trap 2) is guarded (`treeSettle`), so "thin"
is more likely `uThin`/`IMP_CUT` than a missing alpha. Method, not a guess:
`tools/make_probe.js` or `tools/island_shot.js` — the SAME pack, the SAME
hour, bench (`tools/_trees.html`) beside game, read the pixels back (the
G302 lesson), then bisect the four. Owner **B1** (it is the first item of
the vegetation phase because the rebake pipeline is the fix's vehicle), but
tagged P1 — if B1 cannot start immediately, A6 takes the bisect.

### 1.10 Smaller confirmed pointers
- **Key / master / alternator missing on the small build**: `_panel_gen.js:365` puts them only `if (o.elec && o.elec.hasBus)`; the e811 build has `elec.battery null`. "Battery" in the systems picker sets the bus → the panel re-fits — which is the user's "selecting battery recomputes it correctly". Make the key/master row unconditional and define what the key does on a build without a bus (A3).
- **Dash auto-placement overlaps (throttle over the toggles)**: same fitter, `ySw = max(yBot + 0.010, lowest dial − SW_DROP)` and the throttle placed by another rule — no collision test between the switch row and the levers (A3).
- **Prop spins forever at 0 rpm**: `app.js:2975-2997` — spin from `ctl.thr`, not `out.rpm[i]` (A3).
- **Shadow "refresh every so many metres"**: one 1024² map whose half-width grows with height (`render_world.js:3910-3931`, 105 + reach·0.55, 210-1080 m across) → 0.4-2 m texels, PCF hard (r186 dropped PCFSoft), texel-snapped so the grid JUMPS a texel at a time — that is the refresh. The craft needs its own tight cascade (~40 m, 1024) and the world its coarse one; or three.js CSM (A6).
- **Sun through every material**: the flare is occlusion-gated by five rays against `setOccluders()` — check what that list holds (skin only? cowl, panel, wing loft, the pilot?) and that the interior view passes the cabin (A6).
- **Jolene not loading by default**: fixed in G434.3 (2026-09-19, after the playtest); verify on `index.html` at HEAD and close (A2).
- **Version number**: `storage.js` already reads `FLYDIY_BUILD` against `version.json` — surface it on the garage's rail/plaque and the welcome screen (A2).
- **Terrain types for the splat library** (C1): `tools/island_prep.py:531-560` — `0 sea 1 lake 2 heath/grass 3 muskeg 4 sand/beach 5 scree 6 rock 7 scrub 8 forest 9 snow 10 built` (the `ttype.u8` layer; the game reads it at `28_island.js:106` and `render_world.js:879/2901`), plus the analytic world's `W.surface` classes (`22_world_biomes.js`) which must map onto the same library.
- **Grass**: the bench holds four shapes (VEGETATION-2026-09-15 §0: `dry_grass` tussocks 8-20 tris, `grass_patches` 236-1157 tris, `realtime_grass` 6-tri crossed plates, `simple_grass_chunks` photogrammetry) and `tools/tree_perf.js` is the metrics instrument (B3).

---

## 2. THE SESSIONS (ID · title · owner files · size)

### PHASE A — STABLE RELEASE
| ID | Title | Owns | Size |
|---|---|---|---|
| **A1** | THE TWO BLOCKERS: the pusher nose-over (+ certificate honesty) and the energy-out end state | `src/core/60_gen_spec.js` (gear rule, engAt), `61_gen_frame.js` (pusher mount), `43_pilot.js` (diagnosis text only), `31_elec.js`, `30_solver.js` (running/energy), `65_gen_loadtest.js` untouched | L |
| **A2** | SCREENS & FLOW: camera home on enterGarage, dusk picker, clouds in the shed, loading-screen words, shed freeze, version line, Jolene verify, world loader UI | `src/viewer/app.js` (enterGarage/rollOut/boot paths), `boot.js`, `hangar.js` (moodFor, cloud dome), `body.html`, `storage.js` | M |
| **A3** | THE PANEL: gauges (fuel/charge), needles, blur, horns, key row, auto-fit, RPM zero, units, flap switch, yoke, twin throttle, night lights, reg abbreviation, prop spin, control materials | `tools/_panel_gen.js`, `_cage_panel.js`, `src/viewer/cockpit.js`, `panel_tex.js`, `app.js` (prop spin block, PFD readouts), `input.js` (dash mappings) | L |
| **A4** | FLIGHT CAMERA & THE LEFT RAIL: head-look toggle, pilot eye drifting aft / stuck on the back seat, pause moves the camera, orbit below the horizon, show-interior stall, rail regroup + time-of-day row, cut-engine row out, fps row | `app.js` (flCamera/headCam/rail), `flight.css`, `dev_panel.js` | M |
| **A5** | THE GARAGE ROOM: floor through the fuselage, camera to the floor, god rays out, bubble arcs off by default, drawing table, floor shading, FOV slider, dim box → plaque (span/length/empty weight/endurance), explode moved the wing, shed-switch exposure, shed lights toggling | `hangar.js`, `hangar_floor.js`, `hangar_walls.js`, `light_rig.js`, `plaque.js`, `garage.js`, `editor.js` (bubble arcs) | M |
| **A6** | SKY / WORLD RENDERING REGRESSIONS: cloud bands, shadow cascade for the craft, sun through materials, night horizon bands, 1-px silhouette line, night interior overexposed with lights, green tint in the cabin, runway/yellow-line materials lit at night in the shed, (impostor bisect if B1 is not started) | `clouds.js`, `atmo.js`, `sky_glare.js`, `sky_light.js`, `render_world.js` (shadow rig), `aa_resolve.js`, `cabin.js` (interior probe) | L |
| **A7** | AIRFRAME DRAWING BUGS: nose cone jiggle/alignment, wing normals + grazing-angle texture settings, trap bay colour/bend, wingtip lights, fairing edges, winglet, carbon seat edges, aileron/flap actuator sticking out, nose subdivision, twin-boom tips, hinge count in flight, in-game livery ≠ garage, cowl gap uneven, fuel-wing clips, tailwheel vs rod inclination, floats→tricycle hands/bulkhead, part colour precedence, pilot feet vs pedals, control poking under the cowl, inspection traps pixelated, light sockets emissive, center-section rivet stretch, fin mapping | `src/core/63_gen_skin.js`, `60b_gen_loft.js`, `tools/_cage_*.js` (gear/cowl/light/hinge/crew), `aeroskin.js`, `cabin_livery.js` | XL — split A7a (nose/cowl/wing/tail) and A7b (fittings/lights/crew/livery) |
| **A8** | THE PILOT: rudder saturation on downwind, energy-out → emergency landing, water go-around aborts (no flaps, lands short), water rotation at 1.2 Vs, crosswind certification stuck, RPM in the trace | `43_pilot.js`, `42_crosswind.js`, `44_machine_sheet.js`, `tools/pilot_trace.js`, `tools/test_pilot.js` (baseline ratchet) | L |
| **A9** | THE CERTIFICATES: wing loading fails too often with no way out, freezes the UI, raise the plane during the test, a shorter cinematic test flight (three tests, the global award on the first real flight), the crosswind test separate with feedback | `65_gen_loadtest.js`, `garage.js` (bench tab), `plaque.js`, a Worker for the load test | M |
| **S1** | FLOATS — THE PHYSICS: hydro step cost (121 ms → budget), the 35 km/h ceiling, the sizing advisor, invalid floats+wheels, spawn on a buoy, double floats on first swap, support structure not drawn in game, not selectable in the garage, macro L/H/W + beam | `32_hydro.js`, `30_solver.js` (hydro call), `tools/_cage_float.js`, `_floats_check.js`, `_seaplane_check.js`, `app.js` (float drawing) | L |

### PHASE B — FINISH VEGETATION
| **B1** | THE REBAKE, PRODUCTIZED: why the impostors went dark/thin (bisect, §1.9), then the bench's bake as a one-command tool (`tools/tree_prep.py` + a `--rebake` that re-emits `trees_pack.json` for every pack) | `render_world.js` (bake + impostorMat), `trees.js`, `tools/_trees.html`, `tree_prep.py`, `docs/TREE-IMPORT.md` | L |
| **B2** | IMPOSTOR-FIRST LOD: impostors everywhere, L0 (full model) only inside ~20 m, L1/L2 kept in the payload but not drawn; finer controls (near distance, hysteresis, per-pack override) on the GRAPHICS row and F8; the same for bushes and the muskeg sticks | `render_world.js` (ladder, lodUpdate), `gfx_settings.js`, `dev_panel.js`, GATE WORLDRENDER's ladder asserts | M |
| **B3** | THE GRASS RULING: the three fill models at matched density and blade size, screenshots side by side, ms/instance count/draw calls/overdraw from `tree_perf.js`; "is scattered geometry still the right approach" argued against a cover TEXTURE + splat (C1) | `tools/_trees.html`, `tree_perf.js`, `render_world.js` (fill layer) | M |
| **B4** | BUSHES + MUSKEG PROFILES on the same strategy (full model close, impostor otherwise), the four mixes in the game by terrain type | `render_world.js` (species by place), `trees_pack`, `22_world_biomes.js` | M |

### PHASE C — ALPHA SPLATTING
| **C1** | THE TERRAIN MATERIAL LIBRARY: the 11 `ttype` codes + the analytic `W.surface` classes → one library (albedo/normal/roughness per type, tiling scales, a macro variation), the splat weights from `ttype` with the bench's blend, near/far split; AND the resource-intensive techniques inventory (every pass, target, sampler, bake) as the input to D1 | `render_world.js` (ground program — at the 16-sampler limit, G425), `tools/island_prep.py`, `tools/_island.html`, `site_ground.js` | L |
| **C2** | THE SPLAT IN THE GAME: island + analytic world on the library, the roads/lots/premises patches on top, the shore blend, GATE WORLDRENDER extended | same | L |

### PHASE D — PERFORMANCE
| **D1** | PROFILING: CPU (solver per step: the 8.7 ms dry / 121 ms wet; the interior rebuild; the load test) and GPU (`EXT_disjoint_timer_query` per pass — clouds already have it; the ground program; shadows; the resolve; trees), on the playtest build in the playtest places, numbers in a doc with the easy culprits ranked | `tools/make_probe.js`, `boot_perf.js`, `premises_perf.js`, `tree_perf.js`, a new `tools/frame_perf.js` | M |
| **D2** | OPTIMISATION: whatever D1 ranked, holistically (the hydro budget, the solver substeps, the shadow cascades, the sampler budget, the LOD distances), each change measured against D1's baseline | per finding | L |

### T1 — THE AEROPLANES (parallel)
| **T1.1** | THE C172 FICHE: `tools/ref_table.py` comparison against the real 172 (weights, Vs, climb, take-off, cruise) with `cessna (2).json`; what the generator gets wrong, as a list for T2 | `tools/ref_*.py`, `44_machine_sheet.js` | M |
| **T1.2** | THE PROP DISC: the blurred flat disc at speed (MSFS style) replacing the spinning blades above an rpm threshold | `app.js` (prop block), `aeroskin.js` | S |
| **T1.3** | THE PUSHER ARCHETYPE (after A1): engine angle at the mount, the birdman as a design fixture in GATE ARCHETYPES, strut-mounted ogival tanks | `_cage_design.js`, `60_gen_spec.js`, `60c_gen_energy.js` | M |

### T2 — THE GARAGE, EASIER TO OPERATE (parallel)
| **T2.1** | THE PILLAR CHANTIER (the user's own spec): window / cabin(pilot) / passenger pillars each with width AND height, separately for keel, waist and top; the cabin roof and passenger bay angled (a linear profile pillar to pillar); waist width per pillar; tail-cone roof/keel allowed negative; the cabin section no longer straight-only; "Pillar window" slider that does nothing; retire the "rings" controls | `tools/_cage_gen.js`, `_cage_ui.js`, `60_gen_spec.js` (cage schema), GATE DESIGN | XL |
| **T2.2** | WINDOWS: on the taper section too; per-corner manipulation (quad base, rounded corners); several independent window layers; glazing material (glass vs polycarbonate: weight + look) | `tools/_knife_gen.js`, `_cage_ui.js`, `_win.html` | L |
| **T2.3** | SMALL CONTROLS BATCH: tanks auto-fit by downsizing, flap floor lever 2-axis placement, outside lights as their own section (+ wing-bay light click opens it), wing beams optional + proper tube/square section, hinge finish option (parent colour / bare / own), nose joint hide, nose collapse split H/V, single wing truss, cowl ease top/bottom separately, stab incidence for pushers, crew seating (pax count), cockpit-side options | `_cage_ui.js`, the relevant `_cage_*.js` | L — split as needed |
| **S2** | FLOATS — THE MODELLING: Wipaire-based hull (angled deck faces, panels, seams, rivets, bolts), liveries on floats, presets from the Wipaire range, the water lane's pier/patterns/glideslope (with W), the splash on a water crash (the seaplane's spray system), the bottom fin streamlined, the hangar cart under a seaplane | `tools/_cage_float.js`, `_hydro_gen.js`, `vessel_tex.js`, `app.js` (spray) | L |

### W — THE WORLD (later)
| **W1** | THE WORLD LOADER UI (Jolene / procedural / seed) with a proper screen; the water runway dressed (pier, patterns, glideslope) | `boot.js`, `gfx_settings.js`, `jolene_author.py` | M |
| **W2** | AP ROBUSTNESS: the pilot matrix over every archetype × both worlds × wind, the ratchet extended (P2 of PILOT-ROADMAP) | `43_pilot.js`, `pilot_matrix.js` | L |
| **W3** | NEW AIRPORTS + CROSS-COUNTRY: two more premises on Jolene, a leg between them under the AP with the energy model (A1/A8) deciding the go/no-go | premises, `38_nav.js` | L |

### G — THE GAME (last)
| **G1** | WELCOME + CREDITS SCREENS (the credits centralised; the inline attributions removed) | `boot.js`, `body.html`, `CREDITS.md` | M |
| **G2** | CAREER(S): profiles, the logbook per career, save/restore | `70_player.js`, `storage.js` | L |
| **G3** | WALLET + COSTS REVIEW: the price law, parts, fuel/charge, tests | `70_player.js`, `60_gen_spec.js` (prices) | M |
| **G4** | EVENTS: a system of events (weather, mission cards, failures) | new | L |

---

## 3. EVERY REMARK, MAPPED (nothing lost)

Legend: session · severity · note. "inv." = investigated in §1.

**Legacy map, build (4)**
1. Impostors dark, little furnished → **B1** (A6 fallback) · P1 · inv. §1.9
2. Interior view: a way in/out of mouse-as-head → **A4** · P1 · a key + a rail pill; the pointer lock must release on Esc and never eat the UI
3. Blurred prop disc at speed → **T1.2** · P3
4. Airspeed needle crosses the dial → **A3** · P2 · the needle's z vs the face (panel_tex / cockpit)
5. Instrument numerals blurred, not HD → **A3** · P1 · the 512-px slot in a 4096×2048 atlas (`_panel_gen.js` ATLAS) at the eye's distance ≈ 3 px/mm — raise the slot for the primary six or render the faces at 1024; check aniso + mip bias
6. 98 % impostors, L0 at ~20 m, finer controls → **B2** · P1
7. Clouds blocky, clear bands → **A6** · P2 · the far-step 0.4 % + the half-res upsample; the temporal reprojection C2 skipped
8. Loading screen mentions the garage after "roll out untested" → **A2** · P2 · `boot.js` words
9. "Log the flight" → garage UI over sky → **A2** · P1 · inv. §1.8
10. "The shed" same; only interior-then-other-view recovers → **A2** · P1 · inv. §1.8
11. Clouds over the aircraft in the garage → **A2** · P1 · inv. §1.7
12. Floor pokes through the fuselage → **A5** · P2 · `groundY` from the main wheel; guard on the keel's lowest skin vertex
13. Camera down to floor level → **A5** · P3
14. Tanks auto-fit by downsizing capacity → **T2.3** · P3
15. Nose cones jiggle / not perpendicular to the rotation → **A7a** · P2 · (also in the floats section) — the spinner's axis vs `spinAxis`, and `poseRigid` per frame
16. Retire the fake god rays → **A5** · P3
17. Flaps initialised as a dash switch → **A3** · P3
18. Flap floor lever: 2-axis placement on the floor → **T2.3** · P3
19. Controls not all PBR → **A3** · P2 · audit `cockpit.js` materials against CAGE_MATS
20. A control poking through under the cowl (190717) → **A7b** · P2 · the nose-gear steering link / pedal ends below the cowl
21. Pilot camera goes aft with speed, ends behind the seat → **A4** · P1 · `flyEyeAt` maps the crew eye through `edSitP` + `V.pitch` once (flEyeSrc cache); `headCam.off` accumulates? measure the eye's model-frame position vs V
22. Sun through every material → **A6** · P1 · inv. §1.10
23. Wing normals too low-definition → **A7a** · P2
24. Show-interior takes seconds, UI frozen → **A4** · P1 · the crew layer + panel rebuild on the main thread; profile (was fast before G357?)
25. Pilot feet vs pedals → **A7b** · P2
26. Jolene by default → **A2** · verify (G434.3 landed 09-19)
27. Dial "horns" at 3 and 9 o'clock → **A3** · P2 · the bezel's screw bosses? identify in `_panel_gen.js` faceBase / cockpit bezel
28. Battery/alternator/key missing on the small build → **A3** · P1 · inv. §1.10
29. Version number somewhere → **A2** · P2
30. AP oscillates with the rudder (build 3) → **A8** · P1 · inv. §1.3
31. Flight → "the shed" freezes without a loading screen → **A2** · P1 · the room rebuild + `drawPlaque` (a settle) synchronous
32. Wing textures at grazing angles: aniso/normals settings → **A7a** · P2 · `anisotropy` on the skin maps, normal-map mip
33. Top trap bay colour ≠ cowl, pixelated, not bent → **A7a** · P2 · (192338)
34. Wingtip lights redone (cutout or fitted) → **A7b** · P2
35. Fairing faulty edges front/back → **A7a** · P2 · (192550/192612)
36. Wing loading test fails too often, no option → **A9** · P1
37. Shadow refresh/jitter → **A6** · P1 · inv. §1.10
38. Bubble UI arcs hidden by default → **A5** · P3
39. Drawing table: PBR, lip, plan in contact → **A5** · P3
40. Outside lights own section; wing-bay light click opens it → **T2.3** · P3
41. Proper winglet → **A7a** · P2
42. Green tint on dash/interior → **A6** · P2 · the cabin probe / hemisphere ground colour
43. Registration > 8 chars → 7 + "." → **A3** · P3 · (build 4 is "EXPERIMENTAL")
44. Dial placement optimised per dash, central first → **A3** · P2
45. Pause changes the camera → **A4** · P2 · `running=false` path in flCamera/placeCamera
46. Floor shading issues → **A5** · P3
47. Carbon seat interior edges → **A7b** · P2
48. Wing beams optional ("transversal beam"), proper tube/square, raw metal → **T2.3** · P3
49. Light-control tape bigger until they touch → **A3** · P3
50. Bubble mode: flood light in the aft bulkhead or none → **A3** · P3
51. Hinge finish option → **T2.3** · P3
52. Aileron/flap actuator rendering (195236) → **A7b** · P2
53. Time-of-day row in flight; regroup small options → **A4** · P2
54. Welcome screen + career → **G1/G2**
55. Tyl trip crash in the sea → **A1/A8/A3** · P0 · inv. §1.2
56. Fuel & charge indicator (UI + panel) → **A3** · P0
57. Cut-engine option = the key → drop from the rail → **A4** · P3
58. Twin engines: double throttle → **A3** · P2
59. Dusk → night, sunset → dusk → **A2** · P1 · inv. §1.6
60. Dim box useless → span/length + empty weight on the plaque → **A5** · P2
61. Cockpit lights on when starting dark → **A3** · P2
62. Potentiometers glow with position → **A3** · P3
63. All dash controls joystick-mappable + keyboard defaults → **A3** (with `input.js`) · P2
64. Garage FOV slider → **A5** · P3
65. Fuel indicator follows fuel/electric → **A3** · P1
66. Needles on empty (come back to full?) → **A3** · P1
67. No-fuel stated plainly; AP emergency landing → **A8** · P0
68. Water crash splash → **S2** · P3
69. RPM needle: zero wrong, falls below; RPM in the trace → **A3** + **A8** (trace) · P1
70. Gauge graduations follow the units convention → **A3** · P2
71. Fuel gauge urgently → **A3** · P0 (dup 56)
72. Is a few km on that charge realistic? → **answered §1.2**: yes for 2 kWh; the pack is 1/12 of a Velis
73. Nose extra subdivision seen from the cockpit → **A7a** · P2
74. Submerged physics → **A8** · P1 · define the crashed-in-water end state
75. Twin-boom tips low-poly → **A7a** · P2
76. Blade spins forever at 0 RPM → **A3** · P1 · inv. §1.10
77. Dash auto-placement fails (no key, throttle over toggles) → **A3** · P1 · inv. §1.10
78. "Battery" recomputes it → same
79. Credits screen; drop the inline attributions → **G1** · P3
80. AP rudder oscillation on downwind, large amplitude → **A8** · P1 · inv. §1.3

**Making the Cessna 172**
81. Cabin section straight only; passenger pillar adjustable → **T2.1**
82. Tail cone roof/keel must go negative → **T2.1**
83. Single wing truss option → **T2.3**
84. Cowl ease along its length, top/bottom separately → **T2.3**
85. Certification stuck on crosswinds → **A8/A9** · P1
86. Yoke renders into the panel; absent in the garage → **A3** · P2
87. Too many hinges in flight; some stick out (191521/193659) → **A7b** · P2
88. Comparison fiche vs the real 172 → **T1.1**
89. Retire the "rings" controls → **T2.1**
90. "Pillar window" slider does nothing → **T2.1** (check first: a `when` gate?)
91. In-game livery mapping ≠ garage → **A7b** · P1 · `aeroApplySpecDecals` vs the garage's projector
92. Painted cowl gap uneven when deformed (191443) → **A7a** · P2

**Floats**
93. Frame rate with floats dramatic → **S1** · P0 · inv. §1.4
94. Double floats drawn on first swap → **S1** · P2
95. Support structure not drawn in game → **S1** · P1
96. Cessna stuck at 35 km/h → **S1** · P0 · inv. §1.5
97. Floats not selectable in the garage → **S1** · P2
98. Macro L/H/W + beam → **S1** · P2
99. Hydroplane test + guidance → **S1** · P1
100. Spawn on top of a buoy → **S1** · P2
101. Framerate indicator, optional → **A4** · P3 (F8 has counters; a rail row)
102. Nose cone not perpendicular → dup 15
103. Drag model accuracy — should the 172 lift off on stock floats? → **S1** · inv. §1.5
104. Tricycle much better frame rate → dup 93
105. Floats ticked with wheels = invalid config → **S1** · P2
106. O-540 no better (44 km/h) → dup 96
107. Inspection traps at the doors pixelated (191558) → **A7a** · P2
108. Detailed Wipaire floats, panels/seams/bolts, liveries → **S2**
109. Pilot camera on the back seat, will not go fore → **A4** · P1 (with 21)
110. Water runway: pier, patterns, glideslope → **W1/S2**
111. Automated float-sizing advice → **S1** · P1
112. AP aborts the water approach for no reason, no flaps, lands short → **A8** · P1
113. AP rotates too early on water → 1.2 Vs → **A8** · P1
114. Logistical cart under seaplanes in the hangar → **S2** · P3
115. Explode moved the wing height → **A5** · P2
116. Windows on the taper section → **T2.2**
117. Per-corner window shapes → **T2.2**
118. Several window layers → **T2.2**
119. Lights on at night → interior overexposed (195801) → **A6** · P1
120. White bands on the night horizon (200031) → **A6** · P2
121. All lights on when starting at night → **A3** (dup 61)
122. 1-px sky line round the plane over clouds → **A6** · P2
123. Light sockets emissive like the hangar lamps → **A7b** · P3
124. Static on water, frame rate dramatic → dup 93
125. Floats → tricycle: hands misplaced, aft bulkhead gone (cessnaMetal (1).json — file missing) → **A7b** · P1
126. Hangar runway material + yellow lines lit at night → **A6** · P2 (unlit/emissive material on the apron)

**The pusher (birdman)**
127. Engine angle at its mount → **T1.3**
128. Strut-mounted ogival fuel tanks → **T1.3**
129. Part settings precedence over the overall colour → **A7b** · P2
130. Rod inclination moves the tailwheel → **A7a/A1** · P1 (part of the nose-over geometry)
131. Fuel-wing option clips everywhere → **A7b** · P2
132. Crew seating options / passengers → **T2.3**
133. Wing loading test freezes the UI, no feedback → **A9** · P1
134. Nose joint hide option → **T2.3**
135. Nose collapse split H/V → **T2.3**
136. Pushers thrust "wrong direction" → **A1** · P0 · inv. §1.1
137. Angled roof/passenger bays, pillar heights independent → **T2.1**
138. Waist width per pillar → **T2.1**
139. Glass vs polycarbonate glazing → **T2.2**
140. Stabiliser incidence option (birdman inclined at rest) → **T2.3**
141. The full pillar chantier → **T2.1**
142. Float presets from Wipaire → **S2**
143. Streamlined "bottom fin" (125639/125912) → **S2**
144. Test flight shorter, cinematic; global award on the first real flight → **A9**
145. Raise the plane during the load test → **A9**
146. Crosswind test separate, better feedback → **A9**
147. Club hangar → field shed: overexposure (003140), survives reload → **A5** · P1 · `LAMP_EX_CAP` / `applyDay exposureCap` on a shed with no lamps
148. Shed lights: settings alternate, broken → **A5** · P1
149. Centre-section back/belly mapping stretched rivets (162154) → **A7a** · P2
150. Flight orbit camera restricted to the upper dome → **A4** · P2
151. Fin never mapped right — projection instead of topology (162359) → **A7a** · P2
152. Oscillation braking/accelerating, suspension wiggles → **A8/A1** · P2 · the taxi governor vs the oleo/spring rates
153. Performance profiling + recommendations → **D1**
154. Trees: rebake streamlined, impostor-first, L1/L2 ignored, crown variation kept → **B1/B2**
155. Grass ruling with metrics + screenshots → **B3**
156. Bushes + swamp on the same strategy → **B4**
157. Alpha splatting + the techniques inventory → **C1**
158. Exhaustive terrain-type list → **C1** (§1.10 has the 11 codes)
159. Proper world loader UI → **W1** (a first cut in A2)

---

## 4. STARTER PROMPTS

Each block is self-contained: paste it as the first message of the thread.
They assume the thread starts in `flyDiy/` on a fresh worktree of `master`.

---

### A1 — THE TWO BLOCKERS

```
Session A1 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §1.1, §1.2, §2 A1). Read HANDOVER.md's ritual, AXES & SIGNS, THE GARAGE, and docs/SHARED-TREE-PRACTICES.md first. One chantier, two blockers, the battery green before delivery.

BLOCKER 1 — the pusher "gives thrust in the wrong direction" (the user's words). It does not: it noses over. Repro: `node tools/pilot_trace.js bugReports/birdman.json --max 240` → rejected take-off, "thrust is going nowhere". A raw sim probe (full throttle from rest) shows 985 N applied along −xAft on the ENGL/ENGR pair (x 2.49, y 1.12), the plane moves forward, pitches to −19° in 2 s, station S0's keel touches the ground, the mains unload, and the nose skid stops it. Lowering the engine to y 0.55 still fails. `pusherLight.json` (the user's 2026-09-11 pusher, mains 0.17 m behind the CG) flies a circuit at HEAD. Trace first, do not guess: (1) where the ground-reaction CG really is vs the mains — `sim.cgPos()` reports x 2.54 (1.18 m aft of the axle at 1.36), which cannot nose over statically; check its frame/bodyOrigin against a mass-weighted sum of def.nodes; (2) the taildragger gear rule in 60_gen_spec (does gear.x follow the CG when the engine goes to the aft bulkhead? engAt/pusher at §4, the frame's pusher mount at 61_gen_frame.js:1069-1120); (3) the tailwheel at twX 4.9 / twY 0.0009 — the user also reports "the rod inclination impacts the position of everything related to the tail wheel". Then: the pilot's diagnosis must name what happened ("nose-over: pitched −19°, keel on the ground; thrust line X m above the mains" — 43_pilot.js's rejected-takeoff text), and the CERTIFICATE must fail what the game fails — the plaque says FLIES A CIRCUIT (fp 1fea3615) for this build; find out whether the shakedown flew the birth spec rather than the joined one, and close that split or prove it is not the cause. Add the birdman as a fixture in GATE DESIGN/ARCHETYPES so the case cannot come back.

BLOCKER 2 — the energy-out end state. bugReports/flydiy-build (4).json is an e811_velis on a 2 kWh pack: `node tools/pilot_trace.js "bugReports/flydiy-build (4).json" --max 300 --csv` shows the throttle at 1.00 and V collapsing at t≈130 s on the downwind leg, a spiral, a crash — the user's "Tyl trip crashed in the sea". The pilot knows nothing about energy (43_pilot.js), the solver's `eng[i].running` goes false silently, and the visual prop keeps spinning (app.js:2975 spins from ctl.thr, never from out.rpm — A3 owns that line, coordinate). Your part: 31_elec.js / 30_solver.js publish an explicit energy state on `sim.out` (remaining kWh or litres, endurance at the current draw, a `starved` flag with the reason), the plaque's "full-throttle draw" row becomes ENDURANCE and STILL-AIR RANGE (plaque.js — coordinate with A5 who owns the plaque layout), and a roll-out WARNING when the endurance is under the leg's need. The AP's emergency-landing behaviour is A8's; give it the signal. Also define the submerged end state: a wheeled build in the sea currently keeps "flying" at the seabed — the solver must declare the flight over (crashed-in-water) when the CG is under waterH by more than the fuselage height; publish it, A8 consumes it.

OWNERSHIP: src/core/60_gen_spec.js (gear rule, engAt), 61_gen_frame.js (pusher mount), 31_elec.js, 30_solver.js, 43_pilot.js diagnosis TEXT only (A8 owns the laws), 65_gen_loadtest.js untouched. Do not touch src/viewer/ except plaque row names by agreement with A5.
ACCEPTANCE: birdman.json lifts off or the shakedown rejects it with the nose-over reason; the certificate and the game agree; build (4) flies its circuit off HOME with a 2 kWh pack and STOPS with `starved` set and the pilot told, no spiral; GATE GEN/PILOT/ARCHETYPES/DESIGN green, `node tools/run_gates.js --all` for delivery.
```

### A2 — SCREENS & FLOW

```
Session A2 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §1.6-1.8, §2 A2). Read HANDOVER.md's ritual and the LOADING chantier entries (G406/G407/G420/G421), the SKY chantier (G408-G419) for the day/mood model, then docs/SHARED-TREE-PRACTICES.md. Viewer-owned session; verify in the Browser pane on dev.html (rAF is dead in the pane — hand-pump frames, read pixels back; see HANDOVER's CDP notes).

Items, in order:
1. THE CAMERA COMES HOME. "Log the flight" and "The shed" from the cockpit view leave the garage looking out of the door (sky in the render area; screenshots 185124/185549/185937). enterGarage() (app.js:5518) resets everything but the camera: cam.mode stays 'cockpit', HEADCAM state and azT/elT/distT keep the flight's values, flCamera() returns early in the garage. exitInterior() (app.js:310) is what the workaround triggers. Make enterGarage apply the garage framing preset and clear the flight camera mode, for every door (bLog, bHangar2, fullReset, GARAGE_SPEC.apply).
2. THE DUSK PICKER. hangar.js:3226 moodFor(day) uses exclusive thresholds (el > 0 → SUNSET, el > −6 → DUSK) while day_clock.js presets put 'sunset' at −0.833° and 'dusk' at −6°: sunset shows DUSK, dusk shows NIGHT. Fix the bands (or pick by preset name when a preset was chosen) and add a UISMOKE-level check that each preset lands on its own mood row.
3. CLOUDS OVER THE AIRCRAFT IN THE SHED (185731). hangar.js:3202 adds CLOUDS.domeMesh at renderOrder 1; clouds.js:361 domeMat is transparent + depthTest:false + depthWrite:false → painted over the opaques. Draw it before the opaques (or depth-tested at its 598 m radius). Keep GATE CLOUD's static rules.
4. THE WORDS ON THE LOADING SCREENS: after "roll out untested" the roll-out screen mentions the garage — fix the copy in boot.js's step chain so each screen says where you are going.
5. FLIGHT → THE SHED FREEZES with no screen: the room rebuild + drawPlaque's settle are synchronous; put the roll-in behind the same overlay the roll-out uses (G420's pattern) or yield between the steps.
6. THE VERSION LINE: storage.js already knows FLYDIY_BUILD/version.json — show "build 4adae7bb · 2026-09-19" on the garage rail (and G1 will put it on the welcome screen).
7. JOLENE BY DEFAULT: G434.3 (2026-09-19) landed after the playtest — verify index.html at HEAD boots Jolene with no pref set, close the item; and make the WORLD pills (analytic / Jolene / seed) a proper row with a label — a first cut of W1's loader UI, no screen yet.
8. A frame-rate row on the flight rail's GRAPHICS flyout (F8 has the counters; the user wants it optional and visible without F8) — coordinate with A4 who owns the rail's regroup.

OWNERSHIP: src/viewer/app.js (enterGarage/rollOut/boot paths only), boot.js, hangar.js (moodFor + the cloud dome line), body.html, storage.js, gfx_settings.js (the WORLD row). A4 owns flCamera/headCam/rail regroup; A5 owns the room's lights/exposure; A6 owns clouds.js internals.
ACCEPTANCE: each of the eight verified on dev.html with a pixel read-back or a DOM read (state it), GATE UISMOKE/CLOUD/BOOT green, `run_gates.js --all` before delivery.
```

### A3 — THE PANEL

```
Session A3 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §1.2, §1.10, §2 A3, §3 items 4-5, 17, 19, 27-28, 43-44, 49-50, 56-58, 61-63, 65-66, 69-71, 76-78, 86). Read HANDOVER.md's PANEL ARC (G3xx: S1-S5, the SHEAR TRAP G357), futureDesigns/PANEL-2026-09-11.md, docs/SHARED-TREE-PRACTICES.md. Bench: tools/_panel.html; generator tools/_panel_gen.js; the cockpit's meshes src/viewer/cockpit.js; the faces panel_tex.js.

The user's playtest verdict on the panel, in priority order:
P0 — A FUEL / CHARGE GAUGE, on the panel and on the PFD, that follows the build's energy kind (litres or kWh, the units convention), reads the solver's remaining energy (A1 publishes it on sim.out — agree the field names with A1 in your first hour), and behaves on EMPTY (the user believes needles come back to full and stay — check every gauge's empty/zero behaviour, the RPM one included).
P1 — the RPM needle's zero is wrong (it "falls much lower than zero, its real zero seems near the max graduation") — trace the tacho's scale vs out.rpm (00_registry genShaftRpm) and fix; the airspeed needle crosses through the dial (z-fight/offset of the needle vs the face); the numerals are blurred (512-px atlas slots at ~3 px/mm — raise the primary six to 1024 or render at 2× with mips; check anisotropy); the KEY / MASTER / ALT row is missing on builds without a bus (_panel_gen.js:365 gates it on o.elec.hasBus — make it unconditional and define what the key means without a bus); the AUTO-PLACEMENT fails by default (201832: no key, the throttle over the metal toggles) and is right after picking "battery" (202009) — the fitter runs before the systems resolve; the switch row (ySw) and the levers have no collision test; place dials for the ACTUAL dash, central positions first; the VISUAL PROP spins from ctl.thr (app.js:2975) — drive it from sim.out.rpm[i] so a dead engine stops (and the blade can later be swapped for T1.2's blurred disc); the yoke renders into the panel in flight and is absent in the garage.
P2 — the two "horns" at 3 and 9 o'clock on the dials (identify: bezel screw bosses? light hoods?); twin engines get a double throttle; flaps initialised as a dash switch; cockpit lights ON when starting in the dark; the potentiometers glow with their position; the registration abbreviated to 7 chars + "." past 8 (build 4 is "EXPERIMENTAL"); graduations follow the units convention; all controls given PBR materials (audit cockpit.js against the CAGE_MATS idiom); the light-control tape bigger until they touch; in bubble mode the flood light in the aft bulkhead or not drawn.
P2 (with input.js) — every dash control joystick-mappable with keyboard defaults: input.js is the model, #ctlPanel a host (G200); add the dash controls as bindable actions.

OWNERSHIP: tools/_panel_gen.js, _cage_panel.js, src/viewer/cockpit.js, panel_tex.js, input.js/input_panel.js, app.js ONLY the prop-spin block (2970-2998) and the PFD readouts. Coordinate with A1 (energy fields), A4 (rail rows), A7b (light sockets).
ACCEPTANCE: GATE PANEL + UISMOKE + INPUT green; a before/after sheet from the bench for the atlas resolution; the empty-tank and dead-engine behaviours shown in a headless probe (sim.out.rpm → 0, gauge → 0) and on dev.html.
```

### A4 — FLIGHT CAMERA & THE LEFT RAIL

```
Session A4 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §2 A4, §3 items 2, 21, 24, 45, 53, 57, 101, 109, 150). Read HANDOVER.md G141 (flight interface), G200 (manual controls + the pane traps), the HEADCAM notes around app.js:7500-7800, docs/SHARED-TREE-PRACTICES.md. Viewer-owned; verify on dev.html with the CDP camera-hook rig (HANDOVER G381) — rAF is dead in the Browser pane.

1. MOUSE-AS-HEAD IN/OUT: once in the interior view the mouse is captured and the UI cannot be clicked. Give it an explicit toggle (a key and a rail pill), Esc releases, and the capture never starts from a UI click.
2. THE PILOT'S EYE DRIFTS AFT WITH SPEED, ends behind the seat / the aft bulkhead; on the Cessna it sits on the BACK seat and refuses to go forward. flyEyeAt (app.js:7662) maps CAGE_CREW_EYE through edSitP once (flEyeSrc cache) with V.pitch; headCam.update adds headCam.off. Measure the eye's model-frame position against V over a take-off (log it) and find what moves it — a flexing anchor node? the cache going stale when the crew layer rebuilds? the seat index (seatsX[]) chosen for the eye on a 4-seat cabin? Fix both symptoms.
3. PAUSE CHANGES THE CAMERA ANGLE: bPause flips `running`; find what in flCamera/placeCamera keys on `running` and stop it.
4. THE ORBIT IS LIMITED TO THE UPPER DOME: allow the eye below the horizon in flight (the belly), with the ground as the only floor.
5. SHOW-INTERIOR TAKES SECONDS and freezes the UI ("it was fast before"): profile the click (the crew layer rebuild + the panel bake on the main thread?) and either cache what is rebuilt or move it off-thread; report the ms before/after.
6. THE RAIL: a proper time-of-day row in flight (the day_clock presets + hour + rate, the same brief as the garage's), the small options regrouped into fewer flyouts, the "cut engines" row removed (the key on the dash does it), an optional fps row (A2 may have added the counter — coordinate).

OWNERSHIP: src/viewer/app.js (flCamera, headCam, placeCamera, the rail's flyouts), flight.css, dev_panel.js. A2 owns enterGarage's camera reset; A3 owns the dash.
ACCEPTANCE: the eye-vs-speed log flat over a take-off; each rail change on the shipped index.html too (build.js), GATE UISMOKE/VIEW green.
```

### A5 — THE GARAGE ROOM

```
Session A5 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §2 A5, §3 items 12-13, 16, 38-39, 46, 60, 64, 115, 147-148). Read HANDOVER.md's THE GARAGE, hangar.js's header (moods, lamps, LAMP_EX_CAP, applyDay), G94 (lighting rig), G405.x (the shells as assets), G434 (the club hangar is the garage's shell via the runway `hangar`), docs/SHARED-TREE-PRACTICES.md. Verify on dev.html with pixel read-backs (G302: read pixels before tuning colours).

1. SWITCHING CLUB HANGAR → FIELD SHED OVEREXPOSES (003140), and survives a reload: hangar.js applyDay caps the exposure by the LAMPS (LAMP_EX_CAP) — a shed with different/no lamps takes a different cap; find the state that leaks between shells (the mood index? the baked probe? the stored pref) and make the switch re-apply the day from scratch.
2. THE SHED'S LIGHT BUTTONS ALTERNATE SETTINGS, "quite broken": audit the light rig's controls (light_rig.js + hangar.js lamps) — which state each button owns, and the re-entrancy (setMood re-applied on every slider drag).
3. THE FLOOR POKES THROUGH THE FUSELAGE: groundY is the main wheel's contact; guard on the lowest skin vertex too (a keel below the axle line, a low-slung float).
4. THE CAMERA MAY GO DOWN TO FLOOR LEVEL (the drag bounds).
5. RETIRE THE FAKE GOD RAYS (`shaft` in the mood rows, faceShafts).
6. THE BUBBLE UI ARCS hidden by default, an option beside their settings to show them.
7. THE DRAWING TABLE: PBR materials, a lip at the table's bottom, the plan in contact and stable.
8. THE FLOOR'S SHADING: smooth shading on the flat parts (hangar_floor.js).
9. A GARAGE FOV SLIDER in the options (the user wants to try a lower FOV).
10. THE DIM BOX measures only the fuselage — retire it; put length / wingspan and EMPTY weight beside the all-up mass at the top of the plaque; take A1's ENDURANCE and RANGE rows (agree names with A1).
11. EXPLODE moved the wing height — find the state the explode offset leaves behind.

OWNERSHIP: hangar.js, hangar_floor.js, hangar_walls.js, light_rig.js, hangar_sky.js, plaque.js (layout), garage.js, editor.js (the arcs' option). A2 owns moodFor's bands and the cloud dome line — coordinate.
ACCEPTANCE: GATE LIGHT/HANGAR/UISMOKE green; a shell-switch sequence (club → field → club, reload) with the exposure read back each time; the plaque's new header on dev.html.
```

### A6 — SKY / WORLD RENDERING REGRESSIONS

```
Session A6 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §1.9-1.10, §2 A6, §3 items 7, 22, 37, 42, 119-120, 122, 126). Read HANDOVER.md's SKY CHANTIER (G408-G419) and CLOUD CHANTIER (G423-G426) entries, futureDesigns/SKY-CHANTIER-2026-09-14.md and CLOUDS-2026-09-15.md, W0.5a (r186 facts: PCFSoft gone, LIGHT_UNIT = PI), docs/SHARED-TREE-PRACTICES.md. Measure with tools/make_probe.js / island_shot.js and pixel read-backs — never tune by eye alone.

1. SHADOWS "REFRESH EVERY SO MANY METRES" (P1): render_world.js:3910-3931 — one 1024² map whose half-width grows with height (210-1080 m across → 0.4-2 m texels), PCF hard, texel-snapped so the grid steps a whole texel at a time — that step is what the user sees on the aeroplane and the ground. Give the CRAFT its own tight cascade (~40 m, 1024) and keep the world's coarse one (or three.js's CSM); measure the ms.
2. THE SUN SHOWS THROUGH EVERY MATERIAL (P1): sky_glare.js gates the flare on five rays against setOccluders() — audit what app.js passes (the skin only? the cowl, the wing loft, the panel, the shed?) and the interior case; the dome's corona itself must be behind the opaques.
3. NIGHT: lights on → the interior overexposed (195801); white bands on the night horizon (200031); the hangar's runway material and the yellow lines visible unlit at night (an unlit/emissive apron material) — the night's exposure schedule (G417) vs the cabin lights' candela, and the atmosphere LUT's horizon at very low sun.
4. THE GREEN TINT on the dash and every interior light: the cabin's reflection probe / hemisphere ground colour — read the probe.
5. CLOUDS: blocky shapes, clear bands in the sky ("not chopped off enough") — the far steps at 0.4 % of the horizon distance and the half-res upsample; the 1-px sky line round the aeroplane over a cloud — the depth-aware upsample at the silhouette (premultiplied, the key distance in half float). Consider the temporal reprojection C2 skipped, measured.
6. IF B1 HAS NOT STARTED: the impostor bisect (§1.9): same pack, same hour, bench beside game, pixels read back; the four candidates are the light unit/exposure (G408-419), the cloud shadow multiply (G425), the roll-out thinning uThin (G420), the V1 gain payload (G427). Report the culprit to B1; fix only if it is a one-liner.

OWNERSHIP: clouds.js, atmo.js, sky_glare.js, sky_light.js, render_world.js (the shadow rig only), aa_resolve.js, cabin.js (the interior probe). A2 owns the shed's cloud dome line; A5 owns the shed's lamps/exposure.
ACCEPTANCE: GATE CLOUD/LIGHT/WORLDRENDER/AA green; a before/after sheet per item (screenshots/…-2026-09-2x/), the shadow cascade's cost in ms.
```

### A7a / A7b — AIRFRAME DRAWING BUGS

```
Session A7a (nose / cowl / wing / tail) of the 2026-09-20 playtest triage — A7b (fittings / lights / crew / livery) is a sibling thread; do not overlap. Read futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §2 A7 and §3 items 15, 23, 32-33, 35, 41, 73, 75, 92, 107, 130, 149, 151; HANDOVER.md THE GARAGE, G243 (firewall lip), G213 (cowl editor), G133 (wheel fairings), G266-G271 (twin boom), G299 (GATE CLIP), G209 (control surfaces), docs/SHARED-TREE-PRACTICES.md. Builds: bugReports/flydiy-build (4).json, cessna (2).json, birdman.json. Screenshots: 192338 (trap bay), 192550/192612 (fairing edges), 201309 (nose facets from the cockpit), 201534 (twin-boom tips), 191443 (cowl gap uneven), 191558 (door traps pixelated), 162154 (belly rivets stretched), 162359 (fin mapping).

Items: the nose cone jiggles and is not perpendicular to its rotation (the spinner's axis vs spinAxis and poseRigid); the top trap bay is not the cowl's colour, is pixelated and does not bend to the cowl — fit it to the loft and drop the pixelated look unless the user rules to keep it; the door inspection traps likewise; the fairings' faulty front/back edges; a proper winglet (not a straight band); the nose needs a subdivision when seen from inside; the twin-boom tips are low-poly; the painted cowl gap becomes uneven under deformation; the wing's normals are too coarse and the skin maps need grazing-angle settings (anisotropy, normal-map mips); the belly/back rivets stretch on the centre section; the fin has never mapped right — try projection over topology; the rod boom's inclination moves the tailwheel station (share the finding with A1). Everything through GATE CLIP's signed-distance instrument; new findings ratchet the baseline.

OWNERSHIP A7a: src/core/63_gen_skin.js, 60b_gen_loft.js, tools/_cowl_gen.js/_cage_cowl.js, _cage_gear.js (fairings), _fin_gen.js, _boom_gen.js, skin_tex.js (map settings). A7b: tools/_cage_light.js, _cage_hinge.js/_hinge_gen.js, _cage_crew.js/_cage_char.js, _cage_access.js, aeroskin.js, cabin_livery.js, 60c_gen_energy.js (fuel-wing).
ACCEPTANCE: GATE CLIP/SKIN/PARTS/FIT green, a before/after sheet per item.
```

```
Session A7b (fittings / lights / crew / livery) of the 2026-09-20 playtest triage — sibling of A7a. Read futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §2 A7 and §3 items 20, 25, 34, 47, 52, 87, 91, 123, 125, 129, 131; HANDOVER.md G96-G99 (aeroplane lights), G237-G241 (hinges), G204/G246 (characters), G109-G112 + G156 + G160 (livery, decals in flight), G196 (holes), docs/SHARED-TREE-PRACTICES.md. Screenshots: 190717 (a control poking out under the cowl), 195236 (the aileron/flap actuator sticking out of the wing underside), 191521/193659 (hinges too many / sticking out).

Items: identify and house the control poking under the cowl (the nose-gear steering link / pedal ends?); the aileron/flap actuator rendering; the Cessna grows more hinges in flight than the garage shows and some stick out — the hinge count must be the garage's; the wingtip lights redone (a cutout, or properly fitted) and the light sockets given the hangar lamps' emissive idiom; the carbon seat's interior edges (it would cut the neck and the legs); the pilot's feet vs the pedals; floats → tricycle leaves the pilot's hands misplaced and the aft bulkhead undrawn (the user's cessnaMetal (1).json is missing — reproduce by toggling on cessna (2).json); the fuel-wing option clips everywhere — fit the mesh to the loft; the IN-GAME LIVERY MAPPING DIFFERS FROM THE GARAGE (P1 — the game's aeroApplySpecDecals vs the garage's projector; one keeper, G160); a part's own finish takes precedence over the overall colour.

OWNERSHIP as listed above; A3 owns the cockpit's controls, A7a the lofts.
ACCEPTANCE: GATE CLIP/PARTS/BEACON/BAY/CHAR green; the livery identical in a garage-vs-game pixel comparison.
```

### A8 — THE PILOT

```
Session A8 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §1.2, §1.3, §2 A8, §3 items 30, 67, 69, 74, 80, 85, 112-113, 152). Read futureDesigns/PILOT-ROADMAP-2026-09-14.md (P0/P1 closed, P2 next), HANDOVER.md G202/G381/G399/G422 series, WATER-H1 (G382-G396.1) for the water pilot, and the memory rule: measure signs empirically, trace first. Instruments: tools/pilot_trace.js (--csv, --world jolene, --from/--to, --wind), tools/test_pilot.js (the ratchet), tools/pilot_matrix.js.

1. RUDDER SATURATION ON DOWNWIND (P1). `node tools/pilot_trace.js "bugReports/flydiy-build (4).json" --max 300 --csv` — on DOWNWIND `dr` sits on its ±0.25 stop for 10-15 s at a time, 21 flips, bank ±7°, period ~40 s, the track error steady at −557 m (a 260 m overshoot never recovered). rollTo() at 43_pilot.js:931 writes −betaK·β − yawDampK·(eAR−eARslow) − ariK·da. Add β, eAR and the three terms to the CSV, find which winds it to the stop on this twin boom (two fins), retune per configuration (fin authority from the machine sheet, not one constant), bound the cruise rudder to a fraction of drMax, and fix the L1 leg capture that leaves it 557 m off. Ratchet in GATE PILOT.
2. ENERGY-OUT → EMERGENCY LANDING (P0). A1 publishes `sim.out` energy (remaining, endurance, `starved`); the pilot must (a) say it plainly on the rail and the arrival card ("out of charge at t=…"), (b) on `starved` fly a glide to the nearest strip or a straight-ahead forced landing into wind, flaps as the sheet says — no spiral; (c) before departure, refuse a leg the endurance cannot cover (the same arithmetic as the runway reject). Consume the crashed-in-water state (A1) as an ending.
3. WATER (P1): the go-around fires for no reason on a good glideslope at 30 m, no flaps are used, it sinks too fast and lands short — trace on cessnaFloatsWOrks.json --from SEA (the lift-off works: 28 s, 421 m); the water rotation comes too early and rebounds — target 1.2 Vs on the water.
4. THE CROSSWIND CERTIFICATION STUCK on the Cessna — it wants to fly a circuit; find why the crosswind item never closes (42_crosswind.js) and make its verdict say what it saw.
5. RPM IN THE TRACE (the tacho column) so A3's needle can be compared.
6. Oscillation while braking/accelerating on the ground — the taxi PI governor vs the oleo/spring rates; measure, then damp the governor, not the suspension.

OWNERSHIP: 43_pilot.js (laws), 42_crosswind.js, 44_machine_sheet.js, 38_nav.js, tools/pilot_trace.js, test_pilot.js, pilot_matrix.js. A1 owns the solver's energy state and the diagnosis strings for the nose-over.
ACCEPTANCE: GATE PILOT/PILOTMATRIX/SEAPLANE green with the ratchet updated and each number cited; the trace before/after for items 1-3.
```

### A9 — THE CERTIFICATES

```
Session A9 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §2 A9, §3 items 36, 133, 144-146). Read HANDOVER.md G208 (bench certified), GATE LOAD under STRUCTURAL REALISM, 65_gen_loadtest.js's header, docs/SHARED-TREE-PRACTICES.md.

The user: "the wing loading test is cool visually but a lot of planes fail it and there seems to be really no option, especially when the wing geometry is a real plane's — annoying"; "it freezes the interface for much too long without feedback"; "during the test the plane should be put further up so the wings do not touch the ground"; "the test flight is too long and not cinematic enough — do the three first tests, award the global one after the first actual successful flight"; "the crosswind test should be separate and offer better feedback"; "the last certification remains stuck on crosswinds".

1. WHY DO REAL WINGS FAIL: run the load test over the archetypes and the playtest builds (cessna (2).json, build (4), birdman) and list which member yields and why (the lift strut class average? the spar's k from the material table? the sandbag distribution?). Then give the player OPTIONS the verdict names: spar material/thickness, strut, bracing, a lower category (FAR 23 utility vs LSA) — the fix line on the card must be actionable, and the numbers honest (STRUCTURAL REALISM: never move a k on an impression).
2. OFF THE MAIN THREAD: the load test in a Worker (the readouts already run in one — the slider-lag chantier), a progress line on the card, the rig lifted so the wings clear the floor under deformation.
3. THE TEST FLIGHT: three cards (shake, load, hot-and-high) award the certificate; the FLIGHT card is awarded by the first real flight that arrives (logFlight), and the shakedown flight shown is short and cinematic (the reveal shot, the circuit at 2× with the camera presets).
4. THE CROSSWIND TEST as its own card with feedback (coordinate with A8 who owns the crosswind law).

OWNERSHIP: 65_gen_loadtest.js, garage.js (the bench tab + cards), plaque.js (cards only — A5 owns the header), a worker entry in build.js's MANIFEST if needed.
ACCEPTANCE: GATE LOAD/FLEX unchanged in their numbers (or the change argued in HANDOVER), the UI never blocked > 100 ms during a test, the card's fix line names a control that exists.
```

### S1 — FLOATS, THE PHYSICS

```
Session S1 of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §1.4, §1.5, §2 S1, §3 items 93-100, 103, 105, 111). Read futureDesigns/WATER-2026-09-13.md, WATER-H0-2026-09-13.md, HANDOVER.md G370 (H0) and G382-G396.2 (H1-H4, the float calibration, the thrust line, the stale CG trap), 32_hydro.js's header, docs/SHARED-TREE-PRACTICES.md. Builds: ~/Downloads/cessnaFloats.json (L 6.3 B 0.61, IO-360, stuck) and cessnaFloatsWOrks.json (L 6.95 B 0.68, O-540, lifts off at 28 s) — copy them to bugReports/.

1. THE COST (P0). Measured at HEAD: sim.step(1/60) = 121 ms with the floats on water, 8.7 ms on land, 6.9 ms as a tricycle — the "dramatic frame rate on water, even static" is the solver. 32_hydro.js clips every hull triangle of both floats against the free surface every substep (Sutherland-Hodgman) and re-allocates `per[]`. Profile (node --cpu-prof), then: reject dry panels by a corner-depth bound before clipping, share the free-surface sample per float, hoist the allocations, consider a hydro sub-rate with the force held between (measure omega·dt stability per the H0 rules), and a coarser hull for the FORCE model than for the drawing. Budget: ≤ 2× the dry step. Prove with the same measurement, and add the ms to GATE HYDRODYN's report.
2. THE 35-44 km/h CEILING (P0). pilot_trace --from SEA: the 6.3 m build never leaves ROLL in 60 s; power does not matter (the user's O-540 same). Decide whether the drag is honest — Wipaire floats for a 172 are 7.1-7.5 m × 0.75-0.8 beam, ~1.1 m³ each, so the 6.3 m build is undersized and the sim may be right — by comparing against the H3 calibration figures (hump R/W 0.18-0.22, T/W ~0.30) at THIS mass; then check the transom/step ventilation (kTr, dVent) actually opens at hump speed, the inc −0.5° incidence, and A8's back-stick schedule. Write the answer down with numbers.
3. THE SIZING ADVISOR: on the floats page, from all-up mass → recommended L / beam / volume / step position, the Wipaire range as the table (S2 makes them presets); a HYDROPLANE test card with a verdict that says why (hump speed, T/W, trim) — coordinate with A9 on the card idiom.
4. THE GARAGE BUGS: floats ticked while wheels stay = an invalid configuration (one gear kind); the double floats drawn on the first swap; the float support structure not drawn in the game; the floats not selectable/clickable; macro controls length / height / width plus the global beam parameter.
5. THE SPAWN on top of a buoy (the SEA lane's buoys vs the stand).

OWNERSHIP: 32_hydro.js, 30_solver.js (the hydro call site), tools/_cage_float.js, _hydro_gen.js/_hydro_check.js, _floats_check.js, _seaplane_check.js, app.js (the float drawing / selection only).
ACCEPTANCE: the ms table before/after; GATE HYDRODYN/SEAPLANE/FLOATS green; cessnaFloats.json's verdict explained by the advisor; cessnaFloatsWOrks.json still lifts off in ≤ 30 s.
```

### B1 — THE REBAKE, PRODUCTIZED

```
Session B1, phase B (vegetation) of the 2026-09-20 playtest triage (futureDesigns/PLAYTEST-TRIAGE-2026-09-20.md §1.9, §2 B1). Read docs/TREE-IMPORT.md (§5 ladder, §6 bake, §7 payload), futureDesigns/VEGETATION-2026-09-15.md, HANDOVER.md W0c (G-buffer impostors, three shadow passes, the F8 panel, tree_perf), G400 (impostors to the eye), G420 (ring thinning), G427 (V0/V1), the memory trap "impostor bake cache served a stale alpha-zero sheet; the bake races async texture decode". Instruments: tools/_trees.html (the bench), tools/make_probe.js, island_shot.js, tree_perf.js.

1. WHY ARE THE IMPOSTORS DARK AND THIN IN THE GAME while the bench looks right? Method: the same pack, the same hour, the same rig, bench beside game, pixels read back (G302). Bisect four candidates: the SKY chantier's light unit/exposure (G408-G419, `_C = directionalLights[0].color * RECIPROCAL_PI` in trees.js:208 tuned against the legacy rig), the cloud-shadow multiply in the leaf term (G425), the roll-out thinning uThin/IMP_CUT (G420), the V1 species/gain payload (G427). Unless A6 already reported the culprit — check that thread's HANDOVER entry first.
2. PRODUCTIZE THE BAKE: one command (tools/tree_prep.py --rebake or a node tool) that re-emits every pack's impostor sheets + trees_pack.json from the bench's current dials, deterministic, with a contact sheet per pack, and a GATE TREE check that the sheets are not alpha-zero and match the game's light unit. The user's ruling: LOD1/LOD2 stay in the payload, unused; crown variation kept.
3. Re-bake every pack under the current rig; ship the sheets through media/ (G149/G421 rules).

OWNERSHIP: render_world.js (bakeImpostorAtlas + impostorMat), trees.js, trees_pack.js/json, tools/_trees.html, tree_prep.py, docs/TREE-IMPORT.md. B2 owns the ladder distances; A6 owns the sky.
ACCEPTANCE: a bench-vs-game sheet with matched luminance (numbers), GATE TREE/TREES/WORLDRENDER green, one command documented.
```

### B2 — IMPOSTOR-FIRST LOD

```
Session B2, phase B of the 2026-09-20 playtest triage (§2 B2). The user's ruling: "impostors everywhere, then straight to LOD0 (the full model) at extremely close range — basically if the plane is about to hit the tree or is parked alongside it; LOD1 and LOD2 are useless, keep them but ignore them; keep the forest variation (crown only)"; "we need finer controls; LOD0 at 20 m or so". Read HANDOVER.md W0c (the ladder per pack, the three shadow passes, tree_perf), G400/G420, GATE WORLDRENDER's ladder asserts (tools/test_world_render.js).

Deliver: the ladder collapsed to two tiers in the DRAW (L0 inside a near radius, the impostor beyond, with hysteresis and a fade), the near radius and the fade on the GRAPHICS row (a user dial) and F8 (dev), per-pack overrides in trees_pack, the shadow passes re-cut for the new tiers, the same rule for bushes and the muskeg sticks (B4 places them). Measure with tree_perf.js at the playtest places (the stand, the village, the SEA lane) before and after, at 20 / 40 / 80 m near radii — the user judges with the numbers ready.

OWNERSHIP: render_world.js (ladder, lodUpdate, shadow passes), gfx_settings.js, dev_panel.js, test_world_render.js. B1 owns the bake.
ACCEPTANCE: GATE WORLDRENDER's ladder asserts updated and green; the ms/draw-call table; a sheet at the three radii.
```

### B3 — THE GRASS RULING

```
Session B3, phase B of the 2026-09-20 playtest triage (§2 B3). The user: "the bench has 3 grass models; I need the most performance-friendly one at similar visual densities — find similar density profiles and grass sizes, screenshot, I'll judge, but have all your metrics ready. And is this still the right approach?" Read futureDesigns/VEGETATION-2026-09-15.md §0 (dry_grass tussocks 8-20 tris; grass_patches 236-1157 tris; realtime_grass 6-tri crossed plates; simple_grass_chunks photogrammetry, look reference only), §1-2 (the grassland mix, the implight fitter), HANDOVER.md G427, W0c tree_perf.

Deliver, without changing the game: (1) the three candidates on the bench at MATCHED coverage (blades per m² and blade height equalised — say how), three viewpoints (standing, 20 m, 100 m), one contact sheet; (2) the metrics per candidate: instances, triangles, draw calls, overdraw (fill rate at the eye), ms on the bench's GPU timer, and the memory of the sheets; (3) the argument on the approach: scattered geometry vs a cover texture on the splat (C1) vs a hybrid (cards near, splat far) — with a cost estimate for each at the Jolene meadow's area; (4) a one-page recommendation. The user rules; B4 applies it.

OWNERSHIP: tools/_trees.html, tree_perf.js, a doc futureDesigns/GRASS-RULING-2026-09-xx.md. No game code.
```

### B4 — BUSHES + MUSKEG

```
Session B4, phase B of the 2026-09-20 playtest triage (§2 B4), after B2 and B3. "We'll apply the same strategy with the new bushes and the swamp profiles: full model extremely close, impostors everywhere otherwise." Read VEGETATION-2026-09-15.md §2 (the species model, the four mixes, the understory + wet ground), HANDOVER.md G427, G405 (terrain-type map: 3 muskeg, 7 scrub, 8 forest), G399/G400 (the fill from the map).

Deliver: the deciduous/shrub pack and the muskeg profile (dead sticks + pines + sedge) placed by terrain type on Jolene and by biome in the analytic world, through B2's two-tier draw and B1's baked sheets; the grass per B3's ruling; GATE WORLDRENDER/BIOME extended for the new species by place; the ms at the playtest places within B2's budget.

OWNERSHIP: render_world.js (species by place, the fill), 22_world_biomes.js, trees_pack, test_world_render.js.
```

### C1 — THE TERRAIN MATERIAL LIBRARY + THE TECHNIQUES INVENTORY

```
Session C1, phase C (alpha splatting) of the 2026-09-20 playtest triage (§1.10, §2 C1). The user: "start on alpha splatting and finally gather all the resource-intensive techniques so we can start optimising holistically; I need an exhaustive list of our terrain types to constitute the material library, as defined in the Jolene bench." Read HANDOVER.md G398 (the island's own ground), G404 (the stack on F8), G405 (the maps as metadata — the terrain-type map), G425 (the ground program at the 16-sampler limit), G424 (the premises patch), futureDesigns/THEME-ALASKA-RURAL-2026-09-14.md, tools/island_prep.py:531-560, tools/_island.html.

Deliver (a design + a bench, no game change yet):
1. THE TYPE LIST, exhaustive: the island's `ttype` codes — 0 sea, 1 lake, 2 heath/grass, 3 muskeg, 4 sand/beach, 5 scree, 6 rock, 7 scrub, 8 forest (floor), 9 snow, 10 built — with their share of land from the prep's printout, PLUS the analytic world's W.surface classes (22_world_biomes.js) and the premises grounds (lots, roads, aprons, G401's one-ground-per-category), mapped onto ONE library. Where the eleven are too coarse for a material (forest floor under conifer vs deciduous, wet vs dry heath, tidal flat vs beach), say so and propose the split.
2. THE LIBRARY: per type an albedo / normal / roughness set (sources per the licence rules in docs/TREE-IMPORT.md §1 and the media store G149/G421), tiling scale near and far, a macro-variation term, the blend order and the splat-weight source (ttype + a distance-to-water/slope modulation), and the SAMPLER BUDGET — the ground program already stands at 16; an array texture or an atlas is required. Prototype on the bench (_island.html) with a before/after.
3. THE INVENTORY: every resource-intensive technique in the frame — each render pass, target, resolve, bake, sampler, per-frame CPU job (the solver, the crew IK, the readouts worker, the trams) — as a table with its cost where known (the clouds' GPU timer, tree_perf, boot_perf) and unknown where not. This is D1's input.

OWNERSHIP: tools/_island.html, island_prep.py (a library export), a doc futureDesigns/SPLAT-2026-09-xx.md; render_world.js read-only in C1 (C2 ports it).
```

### C2, D1, D2 — (open after C1's design is ruled)

```
C2: port C1's library into the game's ground program for both worlds (island + analytic), roads/lots/premises patches on top, the shore blend, GATE WORLDRENDER extended; measure against C1's sampler budget.

D1 (PROFILING): on the playtest build (build (4) and the float Cessna) at the playtest places (the stand, the village, over the sea), measure CPU per frame (the solver per step: 8.7 ms dry / 121 ms wet at HEAD; the crew IK; the readouts; the interior rebuild; the load test) and GPU per pass (EXT_disjoint_timer_query — the clouds already have it; add it to the ground, shadows, trees, resolve, premises), rank the easy culprits, write futureDesigns/PERF-FRAME-2026-09-xx.md with the numbers and the recommendations. tools/make_probe.js, boot_perf.js, premises_perf.js, tree_perf.js are the instruments; add tools/frame_perf.js. No optimisation in D1.

D2 (OPTIMISATION): D1's list, top down, each change measured against D1's baseline and landed alone; the hydro budget (S1), the solver's substeps, the shadow cascades (A6), the sampler budget (C1/C2), the LOD radii (B2).
```

### T1.x, T2.x, S2, W, G — one-liners to open with

```
T1.1 THE C172 FICHE: with bugReports/cessna (2).json, run the reference comparison (tools/ref_table.py / ref_prep.py, the machine sheet 44_machine_sheet.js) against the real 172's published figures (empty 767 kg, MTOW 1111, Vs0 48 kt, climb 730 fpm, TO 293 m, cruise 122 kt at 75 %) and list every gap with its cause in the generator; the list feeds T2.

T1.2 THE PROP DISC: replace the spinning blades above a threshold rpm with a blurred flat disc (MSFS style) — a translucent disc texture with the blade shadow banding, driven by sim.out.rpm (after A3 moved the spin to rpm); keep the blades below the threshold.

T1.3 THE PUSHER ARCHETYPE (after A1): engine angle at its mount (thrust line pitch/yaw), the birdman as a GATE ARCHETYPES fixture, strut-mounted ogival tanks (60c_gen_energy.js: a new vessel form + placement on a strut), the stab incidence option.

T2.1 THE PILLAR CHANTIER: the user's spec verbatim — "window pillar, pilot (cabin) pillar and passenger pillar should all have width and height options, separately for the keel, waist and top sections; the cabin roof and passenger bays angled — the passenger pillar's height independent, a linear profile up to the pilot pillar, the window pillar's and pilot pillar's heights independent; waist width per pillar; the tail cone's roof/keel allowed negative; the cabin section no longer straight-only; the 'Pillar window' slider does nothing; get rid of all the 'rings' controls." Open with a design conversation (tools/_cage_gen.js is the user's 3-step Blender cage — HANDOVER G12, the template cage); GATE DESIGN/ARCHETYPES must keep every archetype's birth identical (the migrator idiom, GEN_MIGRATORS).

T2.2 WINDOWS: the knife (_knife_gen.js, G245) on the taper section; per-corner control of a window (a quad base with rounded corners, so triangles and odd shapes are reachable); several independent window layers; a glazing material choice (glass vs polycarbonate: mass in the weight model, look in the two-pass glass) — overlapping windows must still be refused.

T2.3 SMALL CONTROLS BATCH (split as needed): tanks auto-fitted by downsizing capacity until they fit; the flap floor lever placed on two axes constrained to the floor; the outside lights as their own section (and clicking a wing-bay light opens it); the wing's transversal beams optional (default on) and drawn as real tube/square sections in raw metal with fitments; a hinge finish option (parent colour default / bare metal / own); the nose joint hideable; the nose collapse split horizontal/vertical; a single wing truss option; the cowl eased along its length, top and bottom separately; crew seating options (how many passengers); the immersion cart under seaplanes (S2).

S2 FLOATS, THE MODELLING (after S1): Wipaire-based hull detail (the angled upper faces presenting the largest face to the water, panels, seams, bolts, screws), liveries on the floats, presets from the Wipaire range (the sizing advisor's table), the streamlined bottom fin as a seaplane option, the water lane's pier + patterns + glideslope (with W1), the water-crash splash from the seaplane's spray system.

W1 THE WORLD LOADER: a proper screen to choose Jolene / the procedural world (seed) with a preview, replacing the pills; the water runway dressed.
W2 AP ROBUSTNESS: PILOT-ROADMAP P2 — the matrix over every archetype × both worlds × wind, the ratchet extended.
W3 NEW AIRPORTS + CROSS-COUNTRY: two more premises on Jolene, an AP leg between them with the energy model deciding go/no-go.

G1 WELCOME + CREDITS: a welcome screen (the version line, the career, the last build, the world choice) and a credits screen that centralises every attribution (CREDITS.md is the source; remove the inline "PA-18 model: Emmanuel Baranger (helijah) · …" strings).
G2 CAREERS: profiles with their own logbook and rack of builds (70_player.js, storage.js).
G3 WALLET + COSTS: the price law reviewed (parts, engines, fuel/charge, tests), a wallet on the welcome screen and the plaque.
G4 EVENTS: a system of events (weather, mission cards, failures) — design conversation first.
```

---

## 5. NOTES FOR THE RECORD
- Two remarks are ANSWERED rather than assigned: "is a few km on 2 kWh realistic?" (§1.2, yes — the pack is 1/12 of a Velis's) and "pushers give thrust in the wrong direction" (§1.1, it is a nose-over; the sign is right).
- Two items landed between the playtest and this triage: Jolene by default (G434.3, 2026-09-19) — A2 verifies; nothing else.
- The headless instruments used here, for the agents: `tools/pilot_trace.js <build.json> [--from SEA --to SEA] [--max S] [--csv f]`; a raw-sim probe is ten lines on `require('./tools/flight_core.js')` (`buildGen`, `makeWorld`, `makeSim`, `placeAtAerodrome`, `sim.step(1/60)`, `sim.out`, `sim.cgPos()`, `sim.wheelContacts()`); the water sim runs ~7.5× slower than real time at HEAD, budget accordingly.
