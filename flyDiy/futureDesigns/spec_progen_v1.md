# SPEC — PROGEN: Procedural Aircraft Structure Generator & Editor
**Version:** 1.0 (design spec, pre-implementation)
**Status:** Agreed design, phases 1–5. Patch layer deferred to Phase 3. Editor standalone, same codebase family as sim, integration via fiche loader.
**Fleet envelope:** Foam Trainer 1 kg · Birdman Chinook 1S · Piper J-3 Cub · Cessna 172S · Douglas DC-3 · SubSonex JSX-2 (jet, V-tail)
**Regime:** propeller + one microjet, all well subsonic. No turboprops.

---

## 0. Principles

- **P1 — Fiche is a compiled artifact.** Source of truth = parameter set (later + patch layer). Generator is deterministic: same params → byte-identical node/beam output.
- **P2 — Structure rules live in code.** Blood-rules (spar box always, torsion box for anything fast, keel nodes through belly roots, gear tripod bracing, and the remaining rules per the fleet handover doc) are enforced by generators, not remembered by the author.
- **P3 — Semantic names are the stable contract.** Node IDs survive parameter changes wherever topologically possible. Patches, polars strips, engine mounts and sim references all bind to names, never to indices.
- **P4 — Sim frame native.** All generation in the sim's frame: **+z = physically left** (the axis trap is encoded exactly once, here). Mesh import remaps into this frame at load.
- **P5 — Gates before delivery.** Headless QC gate on every generated fiche; fleet regeneration must pass the existing per-aircraft circuit and stress gates (Phase 3 acceptance).
- **P6 — Measurements are targets.** Real-world spec values (span, length, area, empty mass, CG range) are stored as *targets*; the tool continuously reports generated-vs-target deltas. Fitting = driving deltas green.

---

## 1. Conventions

### 1.1 Frame
- x: longitudinal, +x forward (nose).
- y: vertical, +y up.
- z: lateral, **+z physically left**.
- Origin: fuselage datum at nose tip, y = fuselage centerline. CG and station coordinates reported relative to datum, plus %MAC for wing-relative values.
- Units: SI internally (m, kg). Editor may display ft/in/lb toggles; storage is SI only.

### 1.2 Node naming
`<subsystem><side?><station><position>`

| Prefix | Subsystem |
|---|---|
| `f` | fuselage ring nodes: `f<ring><U/D/L/R>` e.g. `f2U`, `f2D`, `f2L`, `f2R` |
| `w` | wing: `w<L/R><station><u/d><f/a>` = upper/lower, fore(spar)/aft(rear spar) e.g. `wR3uf` |
| `h` | horizontal stab / V-tail panel (same scheme as wing) |
| `v` | vertical stab (no side letter; `v<station><f/a>`) |
| `g` | gear: `g<N/L/R/T><contact/top>` (N nose, T tailwheel) |
| `e` | engine/powerplant: `e<index><mount node letter>` |
| `s` | struts/bracing external: `s<L/R><index>` |
| `k` | keel nodes: `k<station>` |

- Symmetry contract: every `L` node has an `R` twin with identical (x, y) and negated z. Centerline nodes carry no side letter.
- Station indices increase root→tip (wing) and nose→tail (fuselage).

### 1.3 Beam classes
Beams carry a `class` resolved to (spring, damp, strain limits) via the **material/stiffness table** accumulated in the fleet handover, keyed by speed class:

`sparCap`, `sparWeb`, `torsion`, `rib`, `skinBrace`, `fusFrame`, `fusLongeron`, `fusDiag`, `keel`, `gearLeg`, `gearBrace`, `mountEngine`, `strutLift`, `tailBrace`

Class → values mapping is data (`STRUCTCLASSES` registry), not code; per-aircraft overrides allowed in the fiche, patch layer can override per-beam (Phase 3).

---

## 2. Parameter schema (`progen` block)

Target size: ≤ ~55 parameters covering the six-aircraft envelope. Anything the fleet doesn't differentiate on stays out (coverage table, §5.3, enforces this).

### 2.1 `meta`
| param | type | notes |
|---|---|---|
| name, id | str | fiche identity |
| speedClass | enum `foam/slow/GA/fast` | drives STRUCTCLASSES lookup and torsion-box arming |
| massBudget | kg | empty mass target for rollup check |
| cgRange | [xFwd, xAft] m or %MAC | gate bound |

### 2.2 `wing` (~14)
span, chordRoot, chordTip, sweepLE (deg), dihedral (deg), incidence (deg), twist/washout (deg), verticalPos (enum high/mid/low + yOffset), xLE root, stations (int, default 4–6), strut (bool + attach station), polarRef (POLARS id), sparBoxDepth (frac of thickness), torsionBox (auto by speedClass, overridable).

### 2.3 `fuselage` (~10)
length, sections: 3–4 stations each `{x, width, height, yCenter}` (nose, cabin, aft, tailpost), ringSpacing (or ring count), keel (bool, default on), noseShape (enum blunt/round/pointed — affects first ring only), canopyBulge (bool — extra U node offset, cheap silhouette win for SubSonex/C172).

### 2.4 `empennage` (~9)
type (enum `conventional/vtail`), hStab: {span, chord, xLE, incidence}, vStab: {height, chord, xLE} (ignored for vtail), vtail: {span, chord, dihedral, xLE} (ignored for conventional), tailBraceWires (bool — Cub/DC-3 era).

### 2.5 `gear` (~6)
type (enum `taildragger/tricycle`), mainTrack, mainX, mainLegLength, nose/tail: {x, legLength}, retracted geometry: **out of scope v1** (DC-3 modeled gear-down).

### 2.6 `powerplants` (array, ≤2 entries × ~5)
Per entry: type (enum `prop/jet`), engineRef + propRef (POWERPLANTS/registry ids; propRef null for jet), mount (enum `nose/nacelleWing/dorsalRear`), position: {x, z (nacelle span station or 0), y}, thrustline incidence (deg).
- `nose`: mounts to ring 0/1 nodes. `nacelleWing`: emits nacelle sub-frame hung on wing station nodes (DC-3). `dorsalRear`: pylon frame on aft-cabin U nodes (SubSonex TJ-100).

### 2.7 `targets` (§0 P6 — display/gate only, never generative)
spanTarget, lengthTarget, wingAreaTarget, emptyMassTarget, cruiseTarget, stallTarget, source (str, e.g. "POH", "factory sheet").

### 2.8 Explicitly out of scope v1
Flaps/slats geometry (roadmap session 2 owns high-lift; generator reserves aft-spar nodes so hinge lines exist), retractable gear, floats/skis, multi-fuselage, canard.

---

## 3. Generators

Each generator = pure function `(params, STRUCTCLASSES) → {nodes[], beams[]}` for its subsystem, then an **assembler** joins subsystems with interface beams and runs global passes.

### 3.1 Fuselage
- Rings of 4 nodes (U/D/L/R) at computed stations from `sections` interpolation + ringSpacing; longerons U-U, D-D, L-L, R-R; ring perimeter beams; **X-diagonals on every bay, both side panels + top/bottom panels** (rigid-box rule); keel beams `k<i>` chain through D nodes when keel=true, class `keel`.
- Belly root rule: wing root lower spar nodes tie into keel chain, not into skin nodes.

### 3.2 Wing
- Per station: 4 nodes (uf, ua/df, da → upper/lower × main/rear spar); spar box = 4 chord-wise + 2 vertical + 2 diagonal beams per station cell (**always**, foam included).
- Torsion box: leading-edge D-brace + inter-station diagonals on all four faces — **auto-armed when speedClass ∈ {GA, fast}**; overridable.
- Dihedral/sweep/twist applied per station transform; washout linear root→tip.
- Strut: `strutLift` beams from fuselage keel/lower-ring node to wing attach station (Cub, C172, Chinook).
- Mirror pass: generate right half, emit left by z-negation + name swap. (Single-sided generation guarantees symmetry by construction; the QC symmetry audit then verifies the assembler didn't break it.)

### 3.3 Empennage
- Conventional: mini-wing generator for hStab (2–3 stations), planar frame for vStab, tail cone interface beams to last two fuselage rings; optional brace wires (class `tailBrace`).
- V-tail: two mirrored mini-wing panels at `vtail.dihedral`; **control mapping (ruddervator mixing) is sim-side, not structure-side** — generator only guarantees hinge-line node pairs exist and are named.

### 3.4 Gear
- Tripod per leg: contact node + top node + 3 `gearBrace` beams into nearest keel/ring nodes; contact params (friction, restitution) from fiche contact block as today.
- Taildragger: tailwheel single node + 2 braces to tailpost ring.

### 3.5 Powerplants
- `nose`: engine mass node `e0m` + 4 `mountEngine` beams to ring 0; thrust application node = `e0m`.
- `nacelleWing`: 4-node nacelle box hung below wing station, 6 mount beams into spar box nodes (never skin), mirrored L/R (DC-3).
- `dorsalRear`: 2-node pylon on aft U nodes, jet thrust node aft-facing (SubSonex). **Requires one jet entry in POWERPLANTS: `{type:'jet', thrustStatic, thrustLapse(v)}` — flat-rated simple model, no spool dynamics v1.**

### 3.6 Global passes (assembler)
1. Interface beams (wing↔fuselage carry-through box, empennage↔tailcone, struts).
2. Mass distribution: massBudget allocated by subsystem fractions (data-driven per speedClass, overridable) onto nodes; engine/prop masses from registry onto mount nodes; residual balanced to hit cgRange midpoint.
3. Name uniqueness + symmetry finalization.

---

## 4. QC gate (headless, runs on every generation)

| check | rule |
|---|---|
| G1 symmetry | every sided node has twin, coords mirror-exact (ε = 1e-9); every sided beam has twin |
| G2 orphans | no node with degree 0; warn on degree 1 (only allowed: prop/thrust reference nodes) |
| G3 duplicates | no repeated beam (unordered pair) |
| G4 bracing | every quad face in fuselage bays and spar cells has ≥1 diagonal (rigidity audit) |
| G5 mass | Σ node masses = massBudget ± 0.5% |
| G6 CG | computed CG ∈ cgRange |
| G7 targets | span/length/area deltas vs targets reported (warn > 2%, not fail — fitting is the user's job) |
| G8 determinism | double-generate, byte-compare |
| G9 schema | fiche validates against current sim fiche schema (exact field mapping frozen at Phase 1 kickoff against one reference fiche from the fleet handover) |

Gate output format follows the existing QC harness conventions (counts, zero-fail requirement for delivery).

---

## 5. Phases

### Phase 1 — Schema + generators, headless
**Deliverables:** `progen.js` (schema, generators, assembler, gate), CLI runner, 2 seed aircraft (Foam Trainer, J-3) generated and gate-green.
**Acceptance:** G1–G9 green; fiche loads in sim; seed aircraft fly a circuit (numbers not yet matched — that's Phase 3).
**Kickoff input needed:** one reference fiche + material/stiffness table + subsystem mass fractions from handover.

### Phase 2 — Editor PWA
**Deliverables:** single-codebase PWA. Layout: tri-view (top/side/front, orthographic) + 3D perspective; parameter panel grouped per §2 subsystems; **live regeneration on every change**; measurement block showing target vs generated deltas (green/amber/red); fiche export (download / clipboard); node name toggle; color-by-beam-class; hide-by-subsystem.
**Touch-first:** parameters are steppers/sliders/numeric fields — no precision picking anywhere in the core loop.
**Acceptance:** build Foam Trainer from blank in < 10 min on phone; export loads in sim.

### Phase 3 — Fleet regeneration + patch layer
**Deliverables:** all six aircraft as parameter sets; **patch layer v1**; coverage table.
**Patch layer (agreed deferred to here):** ordered list of named ops applied post-generation, pre-gate:
`moveNode(name, dx,dy,dz)`, `addNode(name, x,y,z, mass)`, `addBeam(a,b,class)`, `removeBeam(a,b)`, `setBeamClass(a,b,class)`, `setNodeMass(name, m)`.
Patches bind to names (P3); regeneration re-applies them; a patch referencing a vanished name is a **gate failure**, not a silent skip. Expected first customers: DC-3 nacelle detailing, SubSonex pylon.
**Acceptance — the honest bar:** each regenerated aircraft passes its *existing* circuit gate and stress gate within current tolerances (Cub, Chinook glide, C172 cruise, DC-3 stall, Speedjojo-class discipline throughout). Any miss ⇒ schema gap; add parameter, update coverage table, justify.
**Coverage table:** param × aircraft matrix; any parameter not differentiating ≥2 aircraft and not required by a blood-rule is removed.

### Phase 4 — Mesh import (manual workflow)
**Deliverables:** GLB/OBJ loader (Sketchfab-grade tolerance: multi-object → merged, arbitrary origin, unknown units, Y-up/Z-up presets); manual rescale by declaring one true dimension (span or length) → uniform scale; datum placement (drag/nudge to nose); ghost rendering in all 4 views (wireframe/translucent toggle, per-view opacity).
**No assumptions** about mesh naming, hierarchy, manifoldness. The mesh is only ever a backdrop.
**Acceptance:** import a Sketchfab C172, rescale to 11.0 m span, visually fit the generated skeleton inside the ghost using parameters only.

### Phase 5 — Auto-fit (seam pre-cut, not built)
Fitting functions write into the *same* parameter fields the UI does:
- fuselage: mesh slicing at candidate stations → width/height envelopes → §2.3 sections;
- wing: planform projection (y-collapse) → chord(z) distribution → span, chords, sweep, taper;
- extremities: lowest clusters → gear positions; lateral protrusion clusters → nacelle stations.
Output is a parameter *proposal* diff the user accepts per-field — never silent overwrite.

---

## 6. Risks / open items

- **R1** Fiche schema drift between spec-time memory and actual handover fiche → frozen at Phase 1 kickoff against a real fiche (G9).
- **R2** Mass-fraction allocation may be too coarse to hit both massBudget and cgRange for the DC-3 → fallback: per-subsystem mass overrides (3 extra params, only if Phase 3 forces it).
- **R3** Jet model realism for SubSonex (flat thrust + lapse) — acceptable v1; spool/TSFC belongs to the energy-module rider, not here.
- **R4** Chinook's minimal-structure ultralight may fight the "spar box always" rule at 1S weights → resolve with a `foam/slow` STRUCTCLASSES row, not a rule exception.
- **R5** Hinge-line reservations for the future flap session: rear-spar node spacing must anticipate flap span fractions — take flap span/chord fractions as *reserved but inert* params now (2 params, no geometry effect v1).
