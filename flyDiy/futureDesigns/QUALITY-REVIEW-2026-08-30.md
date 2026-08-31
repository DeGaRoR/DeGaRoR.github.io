# flyDiy — QUALITY REVIEW (2026-08-30): state of the product, sim honesty, priorities

> Three parallel deep reviews (sim physics, architecture/contracts, product loop), key claims
> spot-verified against source. Priorities curated WITH the user the same day — notably: the
> TEST PILOT (P-2) replaces missions as the next loop, and `spec.finish` belongs to the session
> already carrying it. **If you are the P4/energy session: read P-1 and P-4 before bumping
> `GEN_SPEC_V` to 6 — two of the fixes bake in permanently if the bump lands first.**

## Context

The user asked for a checkpoint, not a chantier: where are we, is what we built solid and extensible,
are the contracts future-proof, is there lying physics or a rough approximation that betrays the
spirit of the sim, and what does the product need now. The deliverable is this written analysis —
product analysis + code review + sim review + a curated priority list.

## Where we are (established from ROADMAP.md + HANDOVER.md tail, 2026-08-30)

- **The loop is live.** P3's turn is a real turn since G65: pick the Garage build → hangar with the
  editor open (game boots there since G67.1) → bench runs a declared test list → plaque fills →
  ROLL OUT & FLY exports through the join and flies what you built. First design→fly turn verified G45.
- **Today was a five-session day.** G81–G104 all landed 2026-08-30 in one shared tree:
  GEN_ACCESS fittings (G81–85), lift-strut feet (G86–88), reference plane (G89–93), the P8 editor
  rebuild (G86/G91/G94–96/G102–104), atmosphere (G72), materials arc closures (G67.2/.3, G68–70).
  ~19k lines inserted, 64 files touched, all uncommitted since this morning's commit.
- **P4 (energy) is opened**: G97 (interior volume + wing spars) landed; G98–G101 (vessel catalogue,
  placement, loading table, balance panel) are next. Burn/discharge deliberately deferred to a
  flight-loop chantier.
- **P3 remainders**: the ONE MISSION (logbook stub written, never read back) and TEST FLIGHT
  (declared bench row, no `run`; would add landing run to the plaque).

## Known-open items already named by the project (verify, don't rediscover)

- `spec.finish` — per-section tint/finish/dials/wear/decals live in ONE localStorage key
  (`flydiy.aeroSections`): the whole fleet wears one paint; a saved build doesn't carry its own.
  Named "the next chantier" in G104.
- View state flies: explode/alpha still ride into flight (declared bug, ROADMAP P8 list).
- The `spec.cage` boundary defect: a template aeroplane still writes ~16 layer keys because layer
  defaults aren't in CAGE_PARAMS (G85's finding; cure sketched in code comment).
- GATE WIND deliberately RED (DC-3 crosswind arrival; two stacked pre-existing faults, traced, to be
  fixed WITH the user).
- Fixed-step accumulator missing (sim runs at display refresh) — P10.
- No Reynolds effects (P12), turbo aspiration reserved but not modeled, battery model absent
  (electric aeroplanes have free energy until P4 lands — EMRAX undercuts a Rotax).
- Cross-layer clearance not checked by GATE FIT (found the tail tie-down inside the castor by pixels).
- 108 native checkboxes with OS accent red; heading hierarchy; focus/hover sweep (P8 "the pass").

## Findings

### Sim review

**What is honestly modeled (the good list):** strip-theory aero with emergent dihedral effect;
lifting-line lift slope + Raymer Oswald; thin-airfoil zero-lift/Cm0 numerically integrated from the
NACA mean line; V-tail mixing derived from panel normals; momentum-theory static thrust + propwash;
Gagg-Ferrar lapse with prop scalings RE-DERIVED from the same synthesis (best-argued block:
`05_atmos.js`); exact ISA; symplectic Euler with beam-stiffness-derived substeps; FAR-23 sandbag
load test with linearity acceptance (`65_gen_loadtest.js`). CG→static margin genuinely measured;
AR→induced drag works; heavier engine moves CG/gear/margin correctly.

**Lying physics, ranked:**
- **S1 — No undercarriage/strut drag anywhere.** Only body drag is fuselage-station CdA
  (`62_gen_aero.js:178-191`); gear is "geometry ONLY" (`60_gen_spec.js:1704-1710`). Real fixed gear
  = 20-30% of parasite drag. L/D, VCruise, climb, TORun, density-altitude sheet all optimistic; a
  bush gear moves ZERO numbers.
- **S2 — Rolling resistance is one global `CRR=0.05`;** the world's `surfaceAt(x,z)` exists
  (`24_world_aero.js:153-162`) and is never asked. Takeoff run identical on paved vs gravel.
  Corrupts TORun; makes backcountry strips aerodynamically meaningless.
- **S3 — `DEFDAMP` (`30_solver.js:354,460-467`) is an undeclared rigid-body rate damper**, τ=2s on
  all rates: ~35% of pitch damping, ~half of yaw/Dutch-roll damping is numerical, constant while
  real damping scales with q. Shrinking the fin doesn't hurt as it should.
- **S4 — The fin flies on the HORIZONTAL tail's aspect ratio** (`62_gen_aero.js:574`,
  `30_solver.js:285-288`): hAR 3.70 vs vAR 1.90 → directional stiffness/rudder power ~25% high, and
  fin AR responds to nothing.
- **S5 — Propwash footprint reads the registry prop, not the aeroplane's** (`62_gen_aero.js:91-92`);
  stabWash/finWash constants regardless of tail geometry; no pusher/tractor distinction (a pusher
  blows its wake forward).
- **S6 — Downwash ε=0.40 hardcoded** and applied to TOTAL local α, so pitch-rate damping at the tail
  is wrongly scaled ×0.6 — `genPlant`'s "real numbers" claim false for Mq (`30_solver.js:271`,
  `62_gen_aero.js:623,534`).
- **S7 — Plaque TORun = 1.8×roll**, flat padding regardless of climb rate (`64_gen_build.js:300`).
- **S8 — Plaque Vs is analytic while VsFlap is measured** — the two displayed cells are from
  different instruments and their ratio ≠ the displayed VsRatio (`64_gen_build.js:405,483,554-561`).
- **S9 — `dAStall=0.02` for every flap type** — Fowler vs plain flap identical stall-angle cost.
- **S10 — Gust field has no energy at span scale** (wavelengths 480-3000 m), so the per-strip
  sampling buys ~nothing at ~180k `world.wind()` calls/s (`20_world.js:333-338`, `30_solver.js:150`).
- **S11 — flare trigger mixes EAS with groundspeed** (`62_gen_aero.js:345`): flare starts ~25% late
  hot-and-high with tailwind; `VBrakeOn` similar.
- **S12 — AP's AGL is height above FIELD ELEVATION, not terrain** (`40_autopilot.js:160`); solver
  has `world.terrainH`, AP doesn't ask.

**Missing physics (vs "the player is the engineer"):**
1. **The fin is invisible** — auto-sized to fixed Vv, flown on wrong AR (S4), damped numerically
   (S3), and MEASURED BY NOTHING: `probe()` returns `yawLeft` (`30_solver.js:523`) and nothing ever
   reads it. No Cnβ, no Izz anywhere in src/core. Sharpest single gap.
2. **AP retunes itself to mask bad designs**: `pitchP/pitchD` re-placed against the plant at build
   time (`62_gen_aero.js:270-275`) — an aft-CG aeroplane flies the same with different gains. Deep
   conflict between AP-as-pilot and engineer-discovers-consequences. No measured phugoid/short-period.
3. No torque reaction / P-factor / precession / swirl — nothing punishes the 1200hp-radial-on-a-
   light-airframe build.
4. **No in-flight structural failure**: beams are linear springs forever (`30_solver.js:390`); the
   load test proves a structure against loads the sim can never apply.
5. Tail auto-sizing (Vh=0.370, Vv=0.0267, `60_gen_spec.js:1950-1951`) silently rescues the player
   from the classic mistake.
6. No Reynolds (known, P12); no washout as aero input; no stall hysteresis; no ridge/thermal/sink in
   a mountain world; no fuel burn yet (P4).

**Numeric hygiene:** `blob()` hardcodes 4 nodes twice (`30_solver.js:334,343`); `PAR.rudderSign`
global escape hatch in solver (`30_solver.js:283,286`); `Vt` name shadowed as both true-airspeed and
target-speed in `40_autopilot.js:182,270,286`; ground stiffness is a function of node mass
(stability hack, `30_solver.js:361`); one `sparSpacing` scalar under-applies outboard Cm on tapered
wings; stance test reads settle values at 2.5 s while DEFDAMP τ=2 s (`64_gen_build.js:345`).

**P4 breakage forecast (mass changing in flight):**
- **B1 `totalM` captured once, never recomputed** (`30_solver.js:40-41`; `reset()` re-reads node
  masses but not the sum) — corrupts the CoM-velocity that alpha/vs/DEFDAMP/probe all build on: as
  tanks drain, an invisible growing drag + rate damper. Nothing NaNs.
- **B2 substeps sized at full tanks** (`62_gen_aero.js:454-464`): burning wing-tank fuel raises ω
  past the recorded divergence neighbourhood — stable full, divergent at reserves.
- **B3 ground spring/damping constants precomputed from build-time node masses**
  (`30_solver.js:356-365`) — mismatched on the landing rollout after burn.
- **B4 `taxiFF` frozen at design mass** (`40_autopilot.js:47-52`) — exactly the bug class its own
  comment documents.
- **B5 every plaque stat quoted at one mass/CG**; with outboard/nose tanks, static margin moves with
  fuel — the honest sheet becomes a range, needing a loading table.
- **B6 gains placed on build-time Ixx/Iyy**; panel tanks dominate Ixx.
- Per-node dynamics already read live `m[i]` — the fix is small and localized (recompute totalM,
  rebuild ground constants, size substeps on empty case).
- **B8 multi-engine reserved but wired to nose nodes only** — a future twin gets total thrust with
  zero asymmetry and no Vmc; wants a declared guard now.
### Code / architecture review (key claims spot-verified in source)

| Area | Verdict | Evidence in one line |
|---|---|---|
| Sectioned spec (resolve/clamp/normalise) | **SOLID** | null-means-derive enforced end to end (`genClampN`, `put()` records into `auto`); adding a section is 2 lines |
| Versioning / migration (ruling 4) | **FRAGILE** | `GEN_SPEC_V` written in 5 places, **read in 0** (spot-verified); no migrator table, no vintage save corpus — v1-v4 have no representative file in the repo |
| `spec.cage` boundary | **FRAGILE** | measured: a stock save carries **392 cage keys, 350 of them frozen layer defaults** (CAGE_PARAMS has 160 keys, PAGE.defaults 392) — incl. `mass: 620, cgZ, cgY`; "a build carries its deviations" does not hold; future generator improvements will never reach saved builds for 89% of the cage |
| Gates: generator/core | **SOLID** | 52 gates, two-signal verdict (exit code AND `^GATE X: PASS$`), always-rebuild-first, 10 negative-verified via `--selftest` |
| Gates: viewer/editor | **FRAGILE** | ~8,500 lines (hangar.js, _cage_ui.js, editor.js, workshop.js, refplane.js) executed by NO gate; GATE LIGHT reaches them by regex-on-source (hex literals, local var names) and will false-red on renames |
| Viewer structure | **FRAGILE** | `render_world.js` is one 1,559-line function; `app.js` one 3,385-line IIFE with a landed merge scar (`app.js:3174-3181` duplicated paragraph); 60+ undeclared `window.*` handles |
| The `_cage_ui.js` ↔ `editor.js` seam | **highest-risk seam** | editor physically re-parents the bench's DOM rows (WeakMap `homeOf`, borrow/park/drop invariant maintained by hand); two owners, two sessions, zero execution coverage |
| Build system | **SOLID** (design) / **FRAGILE** (workflow) | MANIFEST-as-authority with reasons inline, per-file `node --check`, sha-stamped generated core, post-build assertions — but **index.html is 89.3 MB, tracked, rewritten by every battery run**: the repo's biggest merge-pain source (NB: it is also the deployed GitHub Pages artifact, so "untrack" needs a release story) |
| Bench/game seam | **ADEQUATE→FRAGILE** | the two script lists (build.js MANIFEST vs _cage8.html) have already drifted (`_cage_parts.js`, `_cage_join.js` missing bench-side despite a "verbatim" claim); 8 layers push groups into a shared array in load order, two look up host groups by display-string (`'2 · engine'`) |
| Persistence: builds | **SOLID** | one store, one envelope (`{what, v, name, spec, plaque, log}` — results beside the spec, correctly), unwrap accepts bare specs, gated end-to-end |
| Persistence: appearance | **FRAGILE** | `flydiy.aeroSections` = one global key for every aeroplane's finish/tint/dials/WEAR/decals; registration TEXT is per-build in spec.meta while its PLACEMENT is global — the split is the tell |

**Top contract risks for what's coming (P4 energy, P5 missions, P6 fleet):**
- **R1 — the first migrator ever will be written against an untested mechanism** (P4's v5→v6 is
  imminent, in another session). Mitigate BEFORE the bump: a `MIGRATORS` table with an identity 4→5
  entry so the mechanism is exercised and gated; commit one real save per vintage to
  `tools/fixtures/`; `test_build.js` loads each.
- **R2 — the 350 frozen keys must be fixed BEFORE v6** or they bake in permanently. The cure is
  named in `_cage_gen.js:5800-5811`'s own comment: layers register defaults (~8 one-line edits +
  ~15 lines in `_cage_gen.js`); add a gate: stock `spec.cage` < ~50 keys (today 392).
- **R3 — appearance is global and P6 is a fleet**: move finish/tint/dials/decal-placement into
  `spec.finish` on the SAME v6 bump (one bump, two moves); keep WEAR beside the spec as state
  (the `log` precedent), since P5's economy will want wear to accumulate per airframe.
- **R4 — core must not grow a second reader of cage keys**: `genAccessNeedsCage`
  (`60_gen_spec.js:693-700`) already reads 4 cage keys by name with fallbacks that DISAGREE with
  CAGE_PARAMS (`keelY ?? -0.7` vs -0.921). Direction of travel: join more (measured fields via
  `cageJoinSpec`), never read cage from core.
- **R5 — editor UI has two owners and no coverage**: a jsdom smoke gate that boots
  `CAGE_UI_BOOT()` + `editorInit()`, selects every part, asserts every borrowed row returns home.
- **R6 — resolveSpec's design-flow ordering is enforced by comment only**, and P4 inserts energy
  into the middle of it; a cheap Proxy-based gate can assert no step reads a later step's writes.

**Dead/stale worth sweeping**: dead benches `_cage.html`–`_cage7.html` (none can load); stale
header in `_cage_ui.js:1-3` ("gitignored, never in MANIFEST" — both false); 18+ comment refs to
deleted `63_gen_skin.js`; duplicated paragraph `app.js:3174-3181`; superseded `spec.paint` vs
AEROSKIN (two live paint contracts); the `pasengerWindow` typo now load-bearing in 4 copies of an
undeclared section-name enum; "save format v7" caption vs `GEN_SPEC_V=5`.

**Patterns already proven that the fixes should copy**: the three `*Init(api)` bridges in app.js,
and `CAGE_TREE_ROOTS` self-registration (`editor.js:85-111`) — nearly every hazard above is a spot
where one of these two patterns wasn't used.
### Product review

**One-line verdict:** the workshop half is further along than the roadmap credits — design → test →
certificate → withdrawal genuinely works, the sandbag test is the best moment in the product, and
the plaque is nearly the unit of pride. Everything AFTER the aeroplane leaves the shed is missing:
the flight returns nothing, the certificate doesn't survive refresh, the paint belongs to the
browser, and there is no way to skip a flight.

**The player's path today, dead-ends marked:**
1. Boot → hangar, workshop mode, four panels, plaque section hidden (`plaqueLive` starts false,
   `app.js:2095-2101`). **DEAD-END: the empty room** — nothing says "Run the bench" fills it, and
   "Roll out & fly" is styled primary over it.
2. Bench runs 3 tests; plaque fills (~28 rows, verdict line with WHY). **DEAD-END: certificate
   almost never says PASSED** — `passed()` requires EVERY test ok incl. the hot-and-high mountain
   strip (`bench.js:117,190-191`), so a sound sea-level trainer reads NOT PASSED and the button says
   "Roll out untested" (factually wrong — it was tested).
3. Any slider withdraws everything — **seat pitch +1 cm withdraws the 40 s sandbag certificate**
   (no per-test invalidation mapping).
4. Roll out → AP flies the circuit at 1× only (`sim.step(1/60)` per rAF, `app.js:3297-3298`), orbit
   camera, debug-rig chrome (Skin/Wire/UV buttons). **DEAD-END: the flight has no ending** — the
   phase rail says STOPPED, `ap.tdInfo` (sink/speed/centreline) renders only inside the telemetry
   panel which `fullReset()` closes (`app.js:2022-2027,2628`); `bGo` is dead after landing
   (`app.js:2610-2621`).
5. **The turn does not close**: nothing from the flight reaches the plaque, build, or shelf.

**Load-bearing product defects:**
- **The certificate is amnesiac**: `GARAGE_SPEC.plaque` rides in the save envelope but is NEVER
  written (`app.js:3173` boolean only; `garage.js:593-601,897`) — `plaque:null` in every save/
  export; refresh → whole fleet UNTESTED. Contradicts ruling 4's spirit; kills collection.
- **The livery is the page's, not the aeroplane's**: tint/finish/dials/wear/registration/decals all
  in ONE global key `flydiy.aeroSections` (`_cage_ui.js:298-339`). Paint A red → B is red; export
  arrives in default colours; wear ages the whole fleet. (= the `spec.finish` chantier, confirmed
  from the product side.)
- **Logbook is write-only and lossy**: `logFlight` doesn't persist itself (survives via the
  neighbouring `note()`'s writeWip, `app.js:2042-2047`); flights on an unsaved build destroyed on
  design switch; `log.tests` grows unbounded.
- **No time control** — blocks THREE things at once: missions ("skip to outcome" is mandatory per
  ROADMAP:181-184), the TEST FLIGHT bench row (landing run), and watchable flights. The headless
  `tools/circuit_harness.js` is the reference implementation; `bench.js:144-149` is the socket.
- **Mission void but thin**: zero mission code, yet ALL substrate exists — 9 aerodromes with
  surfaces/elevations, A→B AP routing, multi-leg chaining, weather, arrival quality measured, and
  `spec.cargo = {len, kg}` 0-400 kg ALREADY PHYSICS-BEARING with no UI (`60_gen_spec.js:1194,1711`).
- **Nothing explains WHY** beyond the one verdict sentence — but `genShakedown` + `ap.dbg`/`tdInfo`/
  `gaN` already compute the raw material for the WHY report; it's a sentence table over existing
  fields, no new physics.
- **Zero onboarding**: no first-run copy anywhere; the only instructional string ("drag to orbit")
  is flight-only chrome, hidden on the boot screen. Fresh localStorage boots the Jodel wearing the
  name "Garage Special".
- **Fleet is a `<select>`**: no rack, no side-by-side plaques, 3 stock designs; the 7 hand-built
  reference aircraft are unreachable as objects of study (picking one ejects you to the runway).
- Cosmetic lie: shelf caption says "save format v7", `GEN_SPEC_V = 5` (`body.html:165`).

**UI-MODEL.md compliance**: G86/G87/G88/G90-explode LANDED and verified; G89 half-landed (UI yes,
`spec.finish` no); the RACK and TEST FLIGHT not built. Gap the doc itself has: it ratifies the
flight screen as-is — there is NO design authority for FLIGHT (outcome surface, camera language),
and missions land there next.

**Quick wins named by the agent** (hours each): persist the plaque snapshot; split TESTED from
PASSED (hot-and-high → advisory badge); arrival card on STOPPED with "back to the hangar"; revive
`bGo`; persist logFlight properly + cap log.tests; fix v7→v5 caption; move `#hint` + one empty-state
sentence in the plaque section.

## The verdict, against the questions asked

- **Is it solid?** Split. The generator/spec/gates core is genuinely solid — better-disciplined
  than most professional codebases (null-means-derive, two-signal gates, always-rebuild, negative
  verification). The viewer is fragile: two monolith files, an undeclared window.* bus, a
  hand-maintained DOM-borrowing seam, and ~8.5k lines with zero execution coverage — exactly where
  five concurrent sessions work.
- **Extensible?** The sectioned spec, the declared-table pattern (parts, fittings, lights, props)
  and the self-registration patterns are exemplary and cheap to extend. The `spec.cage` passthrough
  is the opposite: 89% of every save is a frozen snapshot of today's defaults, which quietly
  disables the project's own forward-compatibility story for the whole cage.
- **Contracts future-proof?** The save envelope yes; the migration discipline is a promise with no
  implementation, and the FIRST real format change (P4's v6) is already in flight in another
  session. This is the one genuinely urgent item in this report.
- **The area that clearly lacks?** Two: (1) everything after the aeroplane leaves the shed — the
  flight returns nothing to the build, no landing run, no arrival card, no time control, no mission;
  (2) the yaw/directional axis of the sim — the fin is auto-sized, flown on the wrong aspect ratio,
  half-damped by an artificial constant, and measured by nothing (yawLeft is computed and discarded).
- **Lying physics?** Yes, and most of it reaches the plaque: no gear/strut drag at all (L/D,
  VCruise, TO run all optimistic; a bush gear moves zero numbers), one global rolling-resistance
  constant while `surfaceAt()` goes unasked (paved = gravel), DEFDAMP quietly supplying ~half the
  yaw damping, the plaque's Vs and VsFlap from two different instruments, TORun = 1.8×roll flat.
- **What does the product need?** (User's direction, 2026-08-30:) the near-term game is build →
  test → try, not missions. The blocker is the autopilot: it trusts the aircraft completely where
  a test pilot trusts himself — it climbs forever, attempts impossible take-offs, rolls forever,
  lands in surprising ways off faulty descent profiles. The next loop is a parametrized TEST
  FLIGHT flown by a test-pilot autopilot that aborts with verdicts, plus the things you earn
  (certificate, logbook) surviving a refresh.

## Priorities (curated)

### P-1 · Protect the spec before the v6 bump — **LANDED as G106, same day**
Both items below shipped (HANDOVER G106): the boundary reads `CAGE_PAGE.defaults` lazily with a
split baseline (default bake 42 keys, was 518; negative-verified), `GEN_MIGRATORS`/`genMigrateSpec`
is the exercised empty walk the energy arc's v6 plugs into, and `tools/fixtures/` holds a fat
v5 vintage frozen BEFORE the fix plus the pre-versioned flat shape — GATE BUILD loads both forever.
The original text, for the record:

**(original)** URGENT, sequenced, small
The P4 session will ship the project's first-ever real migration. Two moves, both cheap, both
BEFORE `GEN_SPEC_V` 6:
1. **Layer defaults registration** (kills the 350-frozen-keys defect; cure already named in
   `_cage_gen.js:5800-5811`; ~25 lines total) + gate: stock `spec.cage` < 50 keys.
2. **Exercise the migrator mechanism**: `MIGRATORS` table, identity 4→5 entry, vintage save
   fixtures committed, loaded by `test_build.js`.
NOT ours: **`spec.finish` is ongoing in another session** — coordinate only, so that its bump goes
through the migrator mechanism above rather than around it (its landing is the mechanism's first
real customer).
Coordination note: touches `60_gen_spec.js`, `_cage_gen.js`, `garage.js` — files other live
sessions own pieces of; this wants to be agreed as an opening move, not done around them.

### P-2 · THE TEST PILOT — **LANDED as G107, 2026-08-31** (items 1-3 + 5, plus the
TESTED≠PASSED rider; plaque persistence deferred — blocked on load-path BENCH_DIRTY
sequencing owned by the finish session; test-card parameters are the named next cut)
(Missions are dropped from the near-term plan per the user's direction. The coming days' game is
build → test → try. The current AP's failures are the blocker: it climbs forever, attempts
impossible take-offs, rolls forever — it trusts the aircraft completely, where a test pilot trusts
himself. It also lands "in surprising ways" off faulty descent profiles.)

1. **AP2, the test pilot — a NEW autopilot module** (e.g. `41_test_pilot.js`), used for generated
   builds; `40_autopilot.js` stays untouched for the hand-built fleet so the 11 fleet gates keep
   their calibration as benchmarks. Its defining property: **bounded attempts with structured
   verdicts, never open-ended trust**:
   - *Rejected takeoff*: on the roll, if acceleration/rotation isn't achieved by a declared
     runway fraction → brake, stop, verdict "would not take off (reached X kt of Y needed)".
   - *Climb management*: if VS falls below a floor at full power → level off / return, verdict
     "cannot climb past N ft". Never climbs forever.
   - *Authority checks*: if a commanded bank/heading isn't achievable → abandon the manoeuvre and
     report, never rolls forever.
   - *Stabilized approach*: aim at the runway's TDZ — **the aim point already exists in the
     registry** (`tdz` at `24_world_aero.js:66-69`, threshold + 25%) — with declared
     stabilized-approach criteria (slope, speed, sink), a go-around on violation, a bounded retry
     count, then a verdict. Knows where it is and where it's going (position/route awareness over
     the existing runway-frame geometry).
2. **Touchdown markers rendered on the strips** (render_world) so the player can SEE what the
   pilot is aiming at — and judge the landing against it.
3. **TEST FLIGHT, the parametrized bench row** — the declared-but-unbuilt row gets its `run`:
   set target altitude, target speed (the game "imposes" a test card on you); AP2 flies it in-page
   (fast-stepped — `tools/circuit_harness.js` is the reference pipeline, `bench.js:144-149` the
   socket); the outcome is a structured test report — setpoints reached or the verdict for why not
   — and the landing run finally joins the plaque. This formalizes build → test alongside the two
   tests already ported to the new plane: **wing loading** (in-game `bench.js` runs the same
   `65_gen_loadtest.js` rig as GATE LOAD — confirmed ported) and **density altitude**.
4. **Riders that make the test loop stick** (small, land with the arc): persist the plaque snapshot
   into the save envelope (the field exists and is always null today), split TESTED from PASSED
   (hot-and-high becomes an advisory badge; "Roll out untested" stops accusing tested builds).
5. **Gates for AP2 are negative-first**: a deliberately unflyable build MUST come back with the
   right verdict (won't-take-off, won't-climb, won't-land), gated. Old fleet gates unchanged as
   benchmarks. On battery runtime ("soooo long"): `--only=ID,ID` already exists
   (`run_gates.js:7`) and the slow gates are exactly the fleet tier (WIND alone 222 s) — a
   `--tier=core` convenience flag + the habit of `--only` during chantiers is the cheap relief;
   keeping the fleet gates as benchmarks costs nothing when they aren't in the inner loop.

### P-3 · The sim stops lying (ruling 3-conformant increments, no rewrite)
Ranked by plaque corruption per unit of work:
1. **Gear/strut drag increment** — the declared join the spats note has promised since POST-G6;
   makes L/D, VCruise, TO run honest and makes the gear choice a real trade.
2. **Surface-aware rolling resistance/braking** — `surfaceAt()` exists and is never asked; paved vs
   grass vs gravel finally makes the strips mean something — and gives the test pilot's
   rejected-takeoff verdict real ground to stand on.
3. **The fin becomes real**: its own AR polar (vAR not hAR), read `yawLeft` into a Cnβ/"fin margin"
   plaque row (the directional analogue of static margin — one function), and MEASURE DEFDAMP's
   share of yaw damping (free-yaw decay at two damper settings) before choosing the fix.
4. **Plaque self-consistency**: Vs and VsFlap from one instrument; declare or derive the TORun air
   segment.
Explicitly deferred as the roadmap already rules: Reynolds (P12), P-factor/torque (worth doing when
P7 makes engines plural), stall hysteresis.

### P-4 · P4-proofing the solver — write into the burn/discharge chantier's spec
Small and localized, but silent if missed: recompute `totalM` when masses change (else alpha itself
corrupts and DEFDAMP becomes a growing invisible drag), size substeps at MINIMUM fuel (stable full,
divergent at reserves today), rebuild ground spring/damping constants, un-freeze `taxiFF`, and quote
the plaque at two masses (full/reserves) — with outboard tanks the static margin genuinely moves,
and a single-number plaque would be the new lie. Guard the reserved-but-wired multi-engine path
(thrust multiplies, asymmetry doesn't exist — no Vmc surprise later).

### P-5 · Structural debt, background cadence (one per session, not an arc)
1. **The index.html workflow**: 89 MB tracked artifact rewritten every battery run is the repo's
   biggest merge hazard — but it IS the GitHub Pages deployable, so the fix is a release protocol
   (rebuild/commit deliberately, dev flow on dev.html), not a simple untrack. Needs the user's call.
2. **jsdom editor smoke gate** over the `_cage_ui.js`↔`editor.js` borrow/park/drop seam (the
   highest-risk seam, zero coverage, two owners).
3. **The resolveSpec ordering gate** (Proxy-based, cheap) before P4 inserts energy mid-chain.
4. **The sweep**: dead benches, stale `63_gen_skin` comments, duplicate paragraph in app.js,
   `spec.paint` vs AEROSKIN decision, section-name enum declared once, GATE LIGHT's brittlest
   regexes replaced by the values they meant to pin.
5. **A FLIGHT design authority** — UI-MODEL.md covers only the workshop; the test flight's report
   lands on the flight screen next and it is still a debug rig (orbit-only camera, Skin/Wire/UV
   chrome, no outcome surface — `tdInfo` hides in a panel that `fullReset()` closes).

## Verification

This plan is an analysis; the verifiable claims were spot-checked against source during review
(DEFDAMP damping all rigid rates, plaque never persisted, GEN_SPEC_V read nowhere, the 392/350 key
measurement run headless against the checked-in modules). If any P-item is taken up as a chantier,
each carries its own gate as usual (named above per item: spec.cage key-count gate, vintage-fixture
loading gate, jsdom seam gate, resolveSpec Proxy gate, free-yaw decay measurement).
