#!/usr/bin/env node
// run_gates.js — full gate battery. ALWAYS rebuilds generated files first so
// gates can never test a stale flight_core.js. Exits non-zero on any FAIL.
// Verdict contract: every gate prints exactly one final line
//   GATE <ID>: PASS   or   GATE <ID>: FAIL[ (reason)]
// and sets a non-zero exit code on failure. The runner requires BOTH signals.
// Flags: --only=ID[,ID]   run a subset (e.g. --only=GEN,TREE)
//        --verbose        full output for passing gates too
//        --no-build       skip the rebuild (escape hatch)
//        --all            the full tier too (the delivery verdict)
//        --jobs=N         gates in parallel (default 4, env GATES_JOBS; 1 = the
//                         old sequential run, byte for byte)
//
// THE POOL (2026-09-14, the gate rationalization). The battery ran one gate
// at a time on a 24-thread machine and the core tier measured 2 h 15 min under
// peers' load; the work is the same, the waiting was not. With --jobs=N the
// runner keeps N gates running, longest first (from the wall each gate took
// last time, tools/perf/gate_wall.json, gitignored; a row's `wall:` hint seeds
// a fresh clone), buffers every gate's output and prints it IN TABLE ORDER so
// the log diffs against an old one. A row declared `shards: N` is spawned as
// N processes of its file with --shard=i/N (tools/_shard.js partitions the
// heavy loop round-robin); the gate passes only when every shard passed and
// the shards' partition lines agree. A row's `weight` is the slots it takes
// (PILOTMATRIX runs its own 4-job pool). --jobs=1 sorts nothing and shards
// nothing: the sequential battery, in this order, as before.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// TIERS (2026-08-11; the fleet retired 2026-09-05). The project is a GARAGE:
// the generated aeroplane is the product, and every gate below flies or
// measures a generated build. The full battery is too slow to iterate a
// generator change against, so gates carry a tier:
//   core  — the generator, the structural instruments, the editor's gates
//           and everything cheap (world, skin, codec).
//   full  — the slow sweeps on top: ARCHETYPES (every live card flown),
//           PILOTMATRIX (the ratchet), SEAPLANE and HOTHIGH.
// `node tools/run_gates.js` runs CORE. `--all` runs everything, and the summary
// says loudly which it did: a core pass is NOT a delivery verdict, and the
// session ritual's "never deliver on a non-zero exit" now reads "never deliver
// without a green --all".
// (The hand-written fleet's own gates — WIND, M3, DRONE, DC3, JODEL, C172,
// CHINOOK, PA18, C172M, MODEL, CTRL, XCTY/2/3/4/5 — went with the fiches.)
const GATES = [
  // THE ATMOSPHERE (G72). Pure model, under a second: the ISA tables, the
  // exact sea-level identity every other gate's anchors depend on, and the
  // powerplant scalings re-derived against 60_gen_spec's own prop synthesis.
  // THE RESOLVE PASS (G144). Pure source-and-stub, instant: it cannot see a
  // pixel, so it holds the things that broke instead — the headless degrade,
  // and the ACES coefficients against the ones in vendor/three.min.js, which
  // are now duplicated and would otherwise re-grade the game on a three bump.
  { id: 'AA', file: 'test_aa.js', tier: 'core' },
  // THE POST PASSES (POST-FX study, 2026-09-21): off is off - no hook, no target, every preset
  { id: 'POSTFX', file: 'test_postfx.js', tier: 'core' },
  // MANUAL CONTROLS (G200). Pure model, instant: the action table, the
  // keyboard shaping, the gamepad mapping and listen inference, the profile
  // round trip — and the one thing that flew wrong in W14's notes, the
  // re-engage after hand flying, flown headless on both pilots.
  { id: 'INPUT', file: 'test_input.js', tier: 'core', wall: 160 },
  { id: 'ATMOS', file: 'test_atmos.js', tier: 'core' },
  // PHYSICS PERF (2026-09-24): hyp2 / hyp3 are Math.hypot to the bit - the solver's hot loops call
  // them, and the trajectory is the same bits only while they are; seconds
  { id: 'HYPOT', file: '_hypot_check.js', tier: 'core' },
  // G580: the integrator's step on the springs, the dampers it can carry - never above the old rule,
  // every cut damper overdamped, the network inside the stability margin (4 000-pass eigenvalues); ~15 s
  { id: 'SUBSTEP', file: '_substep_check.js', tier: 'core' },
  // G586: the frame clock - the game's time on the wall clock, the frame capped at auto / 60 / 30 / off; the
  // app.js block driven with synthetic refreshes (steps per frame, auto's drop and trials, the rigs' old clock); <1 s
  { id: 'PACE', file: '_pace_check.js', tier: 'core' },
  // G620: the flight recorder and its reader - the loop's hooks split the frame exactly, the wrappers change nothing,
  // a freeze is kept, the GPU query yields to another's, the ring and the chunks, analyze_log.js scoring two
  // scripted sessions, the recorder's own cost (time and allocation a frame) and its wiring; ~10 s
  { id: 'FLIGHTREC', file: '_flightrec_check.js', tier: 'core' },
  // THE SOUND (G1604, SOUND-2026-10-04 §8): audio_params.js on six validated builds (firing, BPF, tip Mach off the
  // solver's rpm), AUDIO.update's budget (no heap, < 0.3 ms), nothing before a gesture, ?audio=0 builds nothing, the
  // silence, the settings, the sources, the wiring - and every check mutated red (--selftest alone); ~3 s
  { id: 'AUDIO', file: 'audio/_audio_check.js', tier: 'core', wall: 160 },
  // THE BOOMBOX (G1713, SND-BOOMBOX): the shed's radio - the quick bar's `sound` and `radio` (AUDIO.enable, stepStation,
  // music in the garage on), the boombox's hit (its own turned box, never over a nearer aeroplane part), the panel's
  // controls on the page's DOM, MY MUSIC (blob: URLs made and revoked, the handle alone kept, nothing before a gesture)
  // with the picker stubbed - and every check mutated red; < 1 s
  { id: 'BOOMBOX', file: 'audio/_boombox_check.js', tier: 'core' },
  // SKY S1/S2 (2026-09-14): the day object and the almanac, headless
  { id: 'DAY', file: 'test_day.js', tier: 'core' },
  // THE CLIMATE (K0, 2026-09-22): the one wind field - the G72 column bit-identical against a
  // verbatim copy, the shared zero, the relief raster, the linearised sampler; pure, seconds
  { id: 'CLIMATE', file: 'test_climate.js', tier: 'core' },
  // SKY S3: the atmosphere's model against its numpy mirror, the calibration, the schedule
  { id: 'FOG', file: 'test_fog.js', tier: 'core' },
  { id: 'ATMO', file: '_atmo_check.js', tier: 'core' },
  { id: 'CLOUD', file: '_cloud_check.js', tier: 'core' },
  { id: 'GE', file: 'test_ground_effect.js', tier: 'core' },
  { id: 'FLAPS', file: 'test_flaps.js', tier: 'core' },
  { id: 'STRESS', file: 'test_stress.js', tier: 'core' },
  // G384: under core, GEN builds every configuration but flies four of the
  // sixteen circuits (test_gen.js CORE_FLY); --all flies them all
  { id: 'GEN', file: 'test_gen.js', tier: 'core', shards: 4, wall: 1500 },
  // THE TEST PILOT (G107): the second autopilot's own battery, negative-first —
  // a build that cannot fly must come back SAYING SO in bounded time. Carries
  // --selftest (doctored reports; every check proven able to go red).
  { id: 'PILOT', file: 'test_pilot.js', tier: 'core', shards: 3, wall: 1200 },
  // THE NAV (G202.1): the navigator and the units, pure and fast
  { id: 'NAV', file: 'test_nav.js', tier: 'core' },
  // G1375 STRIP-SURFACE: every aerodrome of both worlds says its surface, the gear rule (wheels / floats / amphibian /
  // skis) holds for the stock Cub, the float Cessna and an amphibian, and the three pilots never plan a landing on the
  // wrong surface (~10 s; --selftest)
  { id: 'STRIPSURF', file: '_surface_check.js', tier: 'core', wall: 15 },
  // G193: the user's ultralight off the stand through the declared pattern —
  // the stop, the straight roll, in calm air and in wind (~3 min)
  { id: 'TAKEOFF', file: '_takeoff_check.js', tier: 'core', wall: 300 },
  // G630: the pilot's control activity - aileron / rudder reversals per minute per phase,
  // stock + C172 + the user's aluminium C172 off HOME's stand (pilot_matrix --set activity; ~4 min)
  { id: 'PILOTACT', file: '_pilotact_check.js', tier: 'core', weight: 3, wall: 300 },
  // G710: the way out of every Jolene stand bent round the parked aeroplanes (planned, for the stock
  // build's and the aluminium C172's span, and flown off HOME's stand past the Cub); ~40 s
  { id: 'TAXICLEAR', file: '_taxiclear_check.js', tier: 'core', wall: 330 },   // MILL-TAXI G1925-G1929: + every stand and route against every solid thing (the cook's grids, props, cars, trunks), the procedural seeds, the mill flown
  // G710: the plan published (ap.intent) - the legs' planned heights over the ground, the live target
  // and the TECS limits the law used, the path; a stock HOME circuit and a Jolene circuit (~7 min)
  { id: 'PLAN', file: '_plan_check.js', tier: 'core', wall: 420 },
  // G771: SKIP TO LINE-UP - the pose the taxi would end on, placed on the true ground, the pilot straight
  // onto the hold, at every land aerodrome of both worlds; the take-off roll completes (the Cub default and
  // the user's aluminium C172 at Jolene HOME); the skip's roll begins where the taxi's did (~4.5 min)
  { id: 'LINEUP', file: '_lineup_check.js', tier: 'core', wall: 270 },
  // G1945 DEST-TO: ONE "TO" - the From derived (the field under the aeroplane), never a reset. On Jolene, the validated
  // builds, the damage ON: land at HOME, pick another field, the next leg taxis from the landing stop, takes off and
  // lands there (Cub, Jodel, metal Cessna; the floats and the twin on floats lane to lane); a To changed mid-way down
  // the enroute leg re-plans from here inside the turn law and arrives (Cub, metal Cessna); the base, the picker's
  // surface rule and the pref's migration (no flight). Seven real flights, dealt over three shards
  { id: 'DESTTO', file: '_destto_check.js', tier: 'core', shards: 3, wall: 1500 },
  // G770: the player's default is the Cub (the artifact's own garage bridge, against the design rows),
  // GEN_DEFAULT is still the old stock every gate flies, and the browser rigs carry the old stock's pin
  { id: 'DEFAULT', file: '_default_check.js', tier: 'core' },
  // THE SIM DOES NOT LIE (G115): gear/strut drag as a delta from the
  // calibration's reference gear, the ground's surface table, the fin's own
  // polar + the measured weathervane, and the plaque agreeing with itself.
  // Carries --selftest.
  { id: 'HONEST', file: 'test_honest.js', tier: 'core' },
  // THE WEIGHT (PERF STUDY chantier 1, 2026-09-15): eleven recreation cards
  // built as the game flies them (the joined bake) and their empty weight
  // held in declared bands around the POH's — the gauge's ratchet. ~50 s
  // (a headless scene per card). Carries --selftest.
  { id: 'WEIGHT', file: '_weight_check.js', tier: 'core', wall: 120 },
  // THE DRAG (PERF STUDY chantier 2, 2026-09-15): six cards' parasite drag
  // area off the probe sweep against their types, and the wetted build-up's
  // directions on the stock aeroplane. ~2 min. Carries --selftest.
  { id: 'DRAG', file: '_drag_check.js', tier: 'core', wall: 240 },
  // THE BIPLANE (G185): the truss (rigidity rank, the wire-cut negative),
  // the parasol's cabane, the tension-only wire, and — from G185.5 — the
  // vortex kernel against Prandtl's sigma, Munk's stagger theorem and the
  // tail-downwash window. Carries --selftest.
  { id: 'BIPLANE', file: 'test_biplane.js', tier: 'core', wall: 160 },
  // MASS CAN CHANGE NOW (G121): the P-4 solver proofing, landed before the
  // energy arc's burn — the setNodeMass door, live totalM, dry-mass substeps,
  // the fuel record, the live taxi feedforward, the sheet at reserves, and
  // the twin clamp. Carries --selftest.
  { id: 'MASS', file: 'test_massproof.js', tier: 'core' },
  { id: 'TREE', file: 'test_tree.js', tier: 'core' },
  // flexbody skin (appended: keeps the physics battery log prefix diffable)
  { id: 'SKIN', file: 'test_skin.js', tier: 'core' },
  { id: 'UISMOKE', file: 'test_ui_smoke.js', tier: 'core', wall: 220 },
  // G2104 (MOBILE-GARAGE 1): THE SAME SMOKE ON THE PHONE PROFILE (?profile=phone): the garage-only boot's steps in order,
  // no world, no sim worker, no roll-out, the lightest preset; phone.css scoped to html.phone selector by selector
  { id: 'UISMOKE-PHONE', file: 'test_ui_smoke.js', argv: ['--phone'], tier: 'core', wall: 60 },
  // the loading screen's brain alone (LOADING S1): the step chain, the
  // readiness aggregator, the watchdogs, in the harness's synchronous shape
  { id: 'BOOT', file: 'test_boot.js', tier: 'core' },
  // G1995-G1997 (HW-COVERAGE, the user's GTX 1660 Ti laptop: a 128 s garage load, 3-4 fps for 15 min, NO REVEAL): on a virtual
  // clock - the boot watchdog never lifts a chain that still lands steps (keys alone are not progress; 5x hard the last
  // resort); the runtime step-down (gfx_settings.js GFX.hw: one rung under 15 fps in the shed / on the ground, once a state,
  // never an explicit pick, never a rig / localhost / ?gfx=); the recorder's reveal with no roll-out screen. ~2 s
  { id: 'HWCOV', file: '_hwcov_check.js', tier: 'core', wall: 5 },
  // G1996 (HW-COVERAGE): A LOADING SCREEN LIFTED BEFORE ITS CHAIN ENDED, on the page in node (_page_node.js, ROUNDTRIP's harness):
  // fly (lifted at 'compile', Fly at once: the roll-out lands, the world drawn, a reveal - RED on train 35: 0 frames), stay (the
  // shed drawn while the lifted chain ends, then Fly: lands with no screen, a reveal - RED on train 36: no reveal), hard (hard
  // = 1 ms: never lifted while steps land), diag (?diag=quick to its report, the graphics restored). Four page runs ONE AT A
  // TIME (~4 GB each), ~2 min each and the diag ~6 min
  { id: 'BOOTLIFT', file: '_bootlift_check.js', tier: 'full', timeout: 3600_000, weight: 2, wall: 720 },
  { id: 'WORLDRENDER', file: 'test_world_render.js', tier: 'core' },
  // the hangar prop library: baked payload vs the declared table
  { id: 'PROPS', file: '_prop_check.js', tier: 'core' },
  // THE TOTEM POLES (2026-09-13): the declared table = the shipped pack (a
  // cut of a staged photoscan, base + three levels) = the park generator's
  // mirror, and the park plan is a park over twenty seeds. ~1 s.
  { id: 'TOTEM', file: '_totem_check.js', tier: 'core' },
  // THE ANIMALS (2026-09-22): the declared table = the shipped skins, their
  // clip libraries and the cut levels; and the behaviours run headless
  // against the real vendor three (a herd, a pod and a flock, 900 steps).
  { id: 'ANIMALS', file: '_animal_check.js', tier: 'core' },
  // THE TRAM CABIN (G343): the user's cable car baked as a prop and dressed
  // from the house library - roles, metric uvs, the gasket round every
  // window, the livery on both flanks, the liveries published
  { id: 'CABIN', file: '_cabin_check.js', tier: 'core' },
  // THE TREE PAYLOAD (W0b). Not "does the file exist" — every fault this
  // pipeline met in the bench presented as "the tree is missing or wrong"
  // and was something else entirely, so this asserts what comes back OUT is
  // a tree: standing on y = 0, inside its own box and filling it, with an AO
  // channel that carries information and rungs that share one frame.
  { id: 'TREES', file: '_tree_check.js', tier: 'core' },
  // G1112 (TREES-NEAR): the collidable woodland on the island (no analytic treeline, the tree map's TREE class) and the
  // solver meeting a trunk at any elevation (it tested trees under y = 24 m only: never at Jolene's 31.7 m HOME)
  { id: 'TREEHIT', file: '_treehit_check.js', tier: 'core' },
  // G1470 (TREE-CRASH): the airframe yields, breaks and crashes against a trunk and never in what it was built for - the
  // load test to 5.7 g, a flown 3.8 g pull, a drop at FAR 23.473's sink and its cap, a circuit (no yield on the five validated
  // builds); a taxi into a trunk dents, a 30 m/s flight into one crashes with a wing broken; reset heals. Three builds at once.
  // G1833 (DMG-D2a): flown on THE CERTIFICATE's limits (the game's, with the layer on): the load test clean to its limit and
  // held at its ultimate, the pull read to the limit; `--physics` flies D1a's physics limits as before
  { id: 'TREECRASH', file: '_treecrash_check.js', tier: 'core', weight: 3, wall: 900 },
  // G1810-G1817 (DMG-D1a MEMBERS): the seams and the break groups (closed sets, in the generator and in the solver), Euler on
  // the tube members, the seam rules, spruce's ragged break, the kink floor, nothing armed parked, and the break order on
  // the bench to destruction and in the trunk flights (the first group to let go is a fitting's). Three builds at once
  { id: 'DMGMEMBERS', file: '_dmg_members_check.js', tier: 'core', weight: 3, wall: 120 },
  // G1830-G1834 (DMG-D2a CERTIFICATE): the members anchored to the loads the aeroplane is certified for (66_gen_cert.js): the
  // cases, the stamp (the gear kept, off = nothing); on the bench to limit x 1.0 no set, x 1.2 a set (a ductile wing), to
  // ultimate held, to ultimate x 1.1 broken at a joint; to destruction BROKE AT within [1.5, 1.5 m] x limit, a joint first;
  // the flown pull to the limit clean; a bad design (struts / root at half the section asked) BROKE UP. Three builds at once
  { id: 'DMGCERT', file: '_dmg_cert_check.js', tier: 'core', weight: 3, wall: 240 },
  // G1835-G1838 (DMG-D2b GEAR): the gear's own calibration (the bracket: no set at the 23.473 sink, the gear yields and
  // nothing breaks at 1.2 x, NASA 172 Test 1 breaks it, the gear first), the headroom of normal operations (the circuit,
  // a crosswind circuit, taxis on grass / a rough field / the water / a chop, touchdowns at 1.0 and 1.5 m/s: at most
  // 2/3 of the certified yield) and §7.4's gear rows (the ground loop, the porpoise, the float dig-in). Three at once
  { id: 'DMGGEAR', file: '_dmg_gear_check.js', tier: 'core', weight: 3, wall: 1800 },
  // G1890-G1892 (DMG-CERTCOST): the certificate's cost - its frames (exact) and its node time per build against a budget,
  // the target (~5 s) and what is left printed; its envelope against the UNCUT certificate (the stored reference while it
  // is still this physics' answer, else computed again) to the bit; the store (IndexedDB) - a record's checks, the round
  // trip (in headless Chromium when Playwright is here: a second page load stamps from it in under 50 ms). Two at once
  { id: 'DMGCERTCOST', file: '_dmg_certcost_check.js', tier: 'core', weight: 2, wall: 300 },
  // G1883-G1884 (DMG-WINDBREAK): the 3 m/s taxi into a trunk IN A WIND breaks no engine mount - the page's staging (settled in
  // the wind, 3 m/s, the throttle shut, a trunk 6 m ahead) in steady winds 0-10 m/s from 12 directions on the Cub, the Jodel
  // and the metal Cessna, the page's own wind (steady and the climate's gust field), the floatplanes on the water; the
  // per-substep reader changes nothing; REPORTs the page's impact speed and the trunk's offset. Three at once
  { id: 'DMGWIND', file: '_dmg_wind_check.js', tier: 'core', weight: 3, wall: 1500 },
  // G2013-G2015 (DMG-NOSE): the crushable nose (the spinner, the propeller at its hub, the nose bowl ahead of the engine's
  // nodes) and the nose's 9 g at either corner on the certificate - the stack's numbers, the corner cases and the mount's
  // mirror pairs (no limit lowered), the 3 m/s taxi into a trunk at the page's impact speed in 49 winds and 19 offsets on
  // the Cub, the Jodel and the metal Cessna (no mount comes off), one physics with DMG-DRIVE's strike, nothing in the nose's
  // reach in a circuit, the 30 m/s trunks still crash. Three at once
  { id: 'DMGNOSE', file: '_dmg_nose_check.js', tier: 'core', weight: 3, wall: 1500 },
  // G1840-G1843 (DMG-D3 CLUSTERS): a shape-matched cluster is one breakable part - the fin, the twin's rod, the floats (and
  // the twin-boom fixture, reported): its root load read off the cut equals the statics; nothing parts in normal
  // operations (the load test, the pull, the drops, a circuit, parked, the ordinary water cases); a scripted pull takes
  // each part off cleanly (its own group, rigid), the rod splits at its mid-span station, tears in twist; the water's
  // nose-ins reported. Three builds at once
  { id: 'DMGCLUSTERS', file: '_dmg_clusters_check.js', tier: 'core', weight: 3, wall: 900 },
  // G1800-G1804 (DMG-D0 INSTRUMENTS): the NaN ending is 'sim-diverged' ('broke-up' the structure's); the velocity guard (150 m/s
  // off the CG: a blown lattice that never goes NaN trips it, 200 m/s true does not; the census of what the validated builds
  // fly never near it); the per-beam plastic work sums to the total; every beam of the five builds carries its ledger
  // section; the damage view's colours (dmg_overlay.js, pure) and its switch
  { id: 'DMGINST', file: '_dmg_instruments_check.js', tier: 'core', wall: 240 },
  // G1805 (DMG-D0): A LOW FRAME RATE NEVER FAKES A YIELD OR A CRASH - TREE-CRASH's trunk crashes, three legal hard landings and
  // two water cases batched as the page batches them at 2 / 5 / 10 / 30 fps (the brief's 30 / 12 / 6 / 2 steps, and the PACE
  // block lifted out of app.js at caps 30 / 60, 1x / 2x) and through the worker host: bitwise the 60 fps run. Four at once
  { id: 'DMGFPS', file: '_dmgfps_check.js', tier: 'core', weight: 4, wall: 400 },
  // G1820-G1823 (DMG-D1b WRECK INTEGRITY): the strip component test (no live strip on two pieces after any break; one
  // broken diagonal no longer silences a bay), the refs-core (one group-free core; a fuselage cut across breaks up), the
  // SUPPORT limiters (only with damage on, slack in normal operations, the engine kept off the cabin in a severe
  // nose-in). Three builds at once
  { id: 'DMGINTEGRITY', file: '_dmg_integrity_check.js', tier: 'core', weight: 3, wall: 180 },
  // G1850-G1853 (DMG-D4a SKIN): the broken list over the worker on change (inline = worker at every step; no byte with
  // nothing broken), and the skin over a break - no live triangle on two pieces or across a broken member, none stretched
  // past 1.15 x its rest + 1 cm, on TREECRASH / DMGINTEGRITY's crash cases; damage off = the base's skin bit for bit. Three at once
  { id: 'DMGSKIN', file: '_dmg_skin_check.js', tier: 'core', weight: 3, wall: 240 },
  // G1824-G1827 (DMG-DRIVE): the drivetrain against the real numbers (reports/evidence/DMG-DRIVE/real_numbers.json, every
  // row's source printed with its 'as recalled - A0 to open' flag): Lycoming SB 369's overspeed bands in the dives (V_NE and
  // 1.1 V_D at full throttle), the graded prop strike (SB 533: nose-overs, a brush, a trunk, the bow in the water, a tip lost
  // at power and its imbalance tearing the mount), the 582's gearbox, FAR 23.361 / .363 / .371 on the mount's certificate,
  // and the negatives (the circuit, a 3.8 g pull, the brakes: nothing). Three children at once
  { id: 'DMGDRIVE', file: '_dmg_drive_check.js', tier: 'core', weight: 3, wall: 1500 },
  // G1855-G1859 (DMG-WALL): one wall, no stretch - the flown snapshot's lining / beads / glazing stay on their covering
  // (out past 1 mm in at most 1 % of the place-frames), no compact part triangle past 1 %, on the validated builds' crashes
  // with the binding inherited (the old binding beside it for the report). Three builds at once
  { id: 'DMGWALL', file: '_dmg_wall_check.js', tier: 'core', weight: 3, wall: 900 },
  // G286: the graphics settings menu - presets, the pref, the handles
  { id: 'GFX', file: '_gfx_check.js', tier: 'core' },
  // G584: the programs - the real three on a fake GL: the depth warm-up is the shadow pass's own set, two
  // boots key and link the same sources, a bake links each program once, the off-scene passes are listed
  { id: 'PROGRAMS', file: '_program_check.js', tier: 'core' },
  // G585: the cover ring's rocks and debris as batches - the same instances, reach and thresholds, a draw per batch
  { id: 'COVER', file: '_cover_check.js', tier: 'core' },
  // G1010-G1014: the frame's WORK, counted and ratcheted - the page itself in node (dev.html's scripts, the real three on
  // a recording GL, a virtual clock): per-frame draws, uniform / buffer uploads, matrix updates, callbacks, frustum tests,
  // terrainH at the stand and the taxi (the Cub, the metal Cessna) and per boot step; tools/perf/framecost_baseline.json.
  // Two page runs in parallel child processes (weight 2; ~3 min and ~3.6 GB each on a 4-core cloud box)
  { id: 'FRAMECOST', file: '_framecost_check.js', tier: 'core', weight: 2, wall: 180 },
  { id: 'ROUNDTRIP', file: '_roundtrip_check.js', tier: 'core', wall: 800 },
  { id: 'HOUSEWORKER', file: '_houseworker_check.js', tier: 'core', wall: 520 },   // C2a G830-G833: the houses generated in a worker, bit-identical to the inline build; no generation on the page's thread in the town step; a warm IndexedDB cache builds 0   // B8/B9 G1020-G1026: the one loading, the round trips keyed on their inputs, the setup screen from the rail's registry
  { id: 'STAND', file: '_stand_check.js', tier: 'core' },   // A1-STAND G600-G604: the shed merged, the near registry, the exterior glass, the ring's keys
  // B10 G1035-G1039: the roll-out shot on the real three and every archetype - out past the door, the wheels at
  // distance / radius, no allocation a frame, the skip, the stand's first frame at the cut; ~40 s
  { id: 'ROLLANIM', file: '_rollanim_check.js', tier: 'core', wall: 45 },
  // SND-ROLLOUT G1715-G1717: the roll-out shot's sound - the start as the aeroplane starts (setEngine, the solver's crank, the
  // shaft law; a twin in turn, an electric powered, no engine silent), the drawn prop at the voice's rpm (against the worklet
  // offline), every field put back (the handover to the stand's idle), the shed heard where the aeroplane rolls (space.js
  // shotPose); 19 mutations
  { id: 'ROLLSND', file: '_rollsnd_check.js', tier: 'core', wall: 180 },
  { id: 'UPDATE', file: '_update_check.js', tier: 'core', wall: 5 },   // UPDATE-NOW G1535-G1539: the "Update" pill on a differing version.json, nothing on the same build or a failed fetch, the cache-busting URL (params kept, stripped after load), the autosave before the navigation, the media worker's sweep across an update
  { id: 'UILAYER', file: '_ui_layer_check.js', tier: 'core', wall: 10 },   // G1370: the in-world helpers on the UI layer; the verbs off for the roll-out shot
  { id: 'FADES', file: '_fades_check.js', tier: 'core' },   // A2-FADES G670-G673: the prop disc, the grass's grow / pre-grow / lead, the premises' rise
  { id: 'CONTACT', file: '_contact_check.js', tier: 'core' },   // A6-GROUND G1000-G1003: the pavement at terrainH where the wheels roll, the contact shadows, nothing loose on a pavement
  { id: 'SHADOWSKY', file: '_shadowsky_check.js', tier: 'core' },   // A2-SHADOW-SKY G650-G655: the PCF bias under the reversed buffer + a still kernel, the craft's shadow at any height, the mirror's clip, cloud sync, the cover pass, the pause
  { id: 'LOOKS', file: '_looks_check.js', tier: 'core' },   // B4a-LOOKS G750-G754: the patch's border (tuck + ring sink), the drawn lakes (filled / coastal), the sea's cut + grid + mouths, the texture libraries after a failed map, the cover ring's water
  { id: 'RWYLIGHTS', file: '_rwylights_check.js', tier: 'core' },   // POLISH-1 G1066: no elevated runway light on another strip or a pavement (Jolene, the procedural world); G1415: the WWII-style fitting (elevated + flush in one geometry), the glow layer's law, one fixture + one glow draw a strip
  { id: 'LAKEBED', file: '_lakebed_check.js', tier: 'core' },   // LAKE-HOLES G1335-G1339: no lake edge has a gap - the ground is not cut under a lake (no lake discard, one far material), the bed carved under every drawn lake's water, continuous across every line, the physics' water over it
  // the external asset store (2026-09-01): referenced == present both ways,
  // no base64 creep, and index.html's size budget — mechanical at last
  { id: 'MEDIA', file: '_media_check.js', tier: 'core' },
  // THE ASSET CENSUS AS A RATCHET (G900, AS0a): no NEW flat map, byte-identical media copy, image
  // over 4096 px, JPEG normal map or material site outside the allowed files; the media writers
  // fold by content. The flat check needs python + Pillow and is skipped (never failed) without.
  // ~2 s + ~13 s of PIL decode. Carries --selftest.
  { id: 'ASSETS', file: '_asset_check.js', tier: 'core', wall: 20 },
  // THE MATERIAL LIBRARY (AS4a, G920-G924): the props / pier / animals, the trees and the strip stones drawn with
  // and without the library's sharing (and the stones' batches) on the recording GL - every part the same uniforms,
  // textures and program key, fewer materials and draws; the program keys carry no uniform value
  { id: 'MATLIB', file: '_matlib_check.js', tier: 'core', wall: 70 },   // AS4a-rest (G943): + check 6, the array shapes both ways
  // the geometry transport (G930, AS5a): every media/geo bin ONE gzip stream,
  // decoded, re-hashed against its name, its layout against every manifest
  // that names it. ~2 s. Negative-verified (its selftest runs every time).
  { id: 'GEO', file: '_geo_check.js', tier: 'core' },
  // THE SPLAT (TERRAIN FOLLOW-UP 3, 2026-09-21): RECIPE's shape, the manifest against the
  // store, the shader's ANGLE rules in node; --gpu (by hand) adds the sampler census and the fxc probe
  { id: 'SPLAT', file: '_splat_check.js', tier: 'core' },
  // THE ONE GROUND LIBRARY (G912, AS2): the table's files, the cooked layers = what the old canvas code packed in
  // Chrome (per library and key), the keys and their order, the cook re-run in memory (python + Pillow), no canvas
  { id: 'GROUNDLIB', file: '_groundlib_check.js', tier: 'core' },
  { id: 'KTX2', file: '_ktx2_check.js', tier: 'core', wall: 120 },   // AS3 G918: every KTX2 file decodes (the page's transcoder, in node) and is its raw plane within the role's PSNR; the page's KTX2 path and its fallback
  // THE BUILD FILE (G63): save -> load -> editor -> join -> resolved spec.
  // ruling 4 promised this battery a loading gate and it never had one.
  { id: 'BUILD', file: 'test_build.js', tier: 'core' },
  // AEROSKIN (G67): the declared finish + role tables against the cage's own
  // section list, and the r186 spellings the shader stands on (W0.5a)
  { id: 'SKINMAT', file: 'test_skinmat.js', tier: 'core' },
  // LIVERYREACH (G1320): the base-colour pick reaches every section of the
  // stock Cub, Jodel and Cessna that wore the old base, the rudder included
  { id: 'LIVERYREACH', file: '_livery_reach_check.js', tier: 'core' },
  // THE LIVERY STAYS WITH ITS AEROPLANE (G775): build A then build B (and
  // back) — B's finish, every section's material and the marking block equal
  // a clean load of B; the pool key covers every dial
  { id: 'LIVERY', file: '_livery_check.js', tier: 'core' },
  // THE WEATHERING (G345): the module's GLSL rules, its tables, its load order
  { id: 'WEATHER', file: '_weather_check.js', tier: 'core' },
  // THE SURFACE FIELD (G66): the coordinate AEROSKIN tiles and structures on
  { id: 'SURF', file: '_surf_check.js', tier: 'core' },
  // THE LIGHT RIG (this chantier): the contract, the census, the switchboard,
  // and the specific lines whose removal brings back "the aeroplane is lit
  // from below" — which has been reported three times, each time by a
  // different KIND of source that no switch could reach.
  { id: 'LIGHT', file: '_light_check.js', tier: 'core' },
  // THE FITTINGS (G81-G85): GEN_ACCESS resolved against the built skin, and
  // the geometry that lands there. Every fitting on its own skin, one per
  // flank, snapped to real structure, standing OUT, no two in one place, and
  // still asking for the same fittings after a save. Placed over six SHAPES x
  // five SPECIFICATIONS, because the shapes alone never build an IFR
  // wing-tank aeroplane and that is where the collisions were.
  { id: 'FIT', file: '_fit_check.js', tier: 'core' },
  // THE RAY INDEX (G1281, GARAGE-LAG): three's Mesh raycast answered from a per-geometry hierarchy must give three's
  // own hit list - both ways on ~3 200 rays (random, axis-aligned, grazing at vertices and edges, inside, near/far)
  // over indexed, non-indexed, transformed, instanced meshes and a sliver soup; the meshes it must leave alone take
  // three's walk; an edited geometry is re-indexed. Under a second.
  { id: 'RAYINDEX', file: '_rayindex_check.js', tier: 'core' },
  // G1445 (GARAGE-INSTANT): a drag's previews end on the plain build's aeroplane (the page in node, the Cub and the
  // metal Cessna, twelve rows: a kept sheet's layer rows, the cage's deformed rows, the sheet's detail rows)
  { id: 'INSTANT', file: '_instant_check.js', tier: 'core', wall: 480 },
  // G2071 (GARAGE-LAPTOP): the shed's shadow cache (shed_shadow.js) draws what the full pass draws - per light, the bake's
  // casters + the live pass's == the full pass's, each once (at rest, a prop moved, a prop hidden, a lamp moved, the key
  // held by the day's step); retro's shed frame under 40 % of the full pass's draws (the page in node, the Jodel)
  { id: 'SHEDSHADOW', file: '_shedshadow_check.js', tier: 'core', wall: 150 },
  // G2074 (GARAGE-LAPTOP): the garage room's shell merged by material (hangar.js mergeRoom, render_world mergeShell's rules)
  // is the same room - the same oriented world-space triangles per material, casts and order as its sources swapped back
  // live; >= 300 fewer draws; every dressable part still worn; the exterior and opts.merge false untouched
  { id: 'ROOMMERGE', file: '_roommerge_check.js', tier: 'core', wall: 150 },
  // THE CONTROL HARDWARE (G241): every control surface's nose turns INSIDE
  // its cove instead of through the wing — measured off the emitted vertices,
  // station by station, which is the clearance at every deflection because a
  // rotation does not change a radius — plus the declared travel, the
  // Fowler's own translation, the hinge table's bounds and that every shape
  // in _hinge_gen draws. ~7 s (five headless scenes). Negative-verified (--selftest).
  { id: 'HINGE', file: '_hinge_check.js', tier: 'core' },
  // NO CLIPPING (the fitment study, P0, 2026-09-12): every drawing layer run
  // headless over four builds, every fitting vertex measured SIGNED against
  // the drawn skin triangles — at rest, at full control travel both ways,
  // under a wing-flex envelope and (twin booms) a tail-anchor throw — plus a
  // fitting inside another layer's solid. A baseline of known reds
  // (fixtures/clip_baseline.json) makes it a ratchet: red only for a NEW or
  // deeper finding; `--rebase` after a chantier clears some. ~9 s.
  { id: 'CLIP', file: '_clip_check.js', tier: 'core' },
  // THE WING'S SHAPE (G67.1): thirteen wings frozen as digests over every
  // position, uv and binding weight, so the wing could leave 63_gen_skin.js
  // without changing by a millimetre. Sub-second, and it stays in the battery
  // afterwards — the wing is the aeroplane's, and nothing should move it by
  // accident.
  { id: 'WINGSPLIT', file: '_wing_split.js', tier: 'core' },
  // ---- THE CAGE'S OWN CHECKERS (G67.1) ------------------------------------
  // These five have existed for chantiers and were never in the battery: each
  // was written as the verdict for its own bench and then left to be run by
  // hand, which means "green" has never included them. They come in now
  // because THE OLD GENERATED SKIN IS BEING DELETED, and GATE GEN's
  // assertions about the old aeroplane's fuselage, cowl, engine, tail and
  // wheels go with it — this is where that coverage actually lives, on the
  // geometry the aeroplane is built from today rather than on a mesh nobody
  // sees any more. Promoting them is the replacement; a quietly smaller GATE
  // GEN would have been the alternative, and it is not one.
  //
  // All five are under 3 s: they measure generators, not flights.
  { id: 'CAGEFIT', file: '_cage_fit.js', tier: 'core' },      // the cage vs its 3 reference OBJs
  { id: 'FRAMES', file: '_frames_check.js', tier: 'core' },   // T2.1: the frames — corpus identity, locality, follow, migration, profile
  { id: 'KNIFE', file: '_knife_check.js', tier: 'core' },     // T2.2: the drawn windows — corpus identity, watertight, shapes, rows, refusal, glazing
  { id: 'FIN', file: '_fin_check.js', tier: 'core' },         // fin + stab vs the sketch
  { id: 'COWL', file: '_cowl_check.js', tier: 'core' },       // the cowl, and the engine inside it
  { id: 'ENGMESH', file: '_eng_mesh_check.js', tier: 'core' },// the engine's own health + ledger
  { id: 'JOIN', file: '_join_check.js', tier: 'core' },       // editor -> spec -> a buildable aeroplane
  // THE RESOLVED SPEC IS A FIXED POINT AND THE CORNERS ARE THE STAND (SPEC-FIXPOINT G1550, the 2026-10-04
  // review's A2 / A3 / B8 / B9 / B13 / E1-E3): GEN_FIELDS against GEN_DEFAULT and clampSpec; clamp idempotent;
  // resolve(resolve(s)) == resolve(s); buildGen leaves its input alone and rebuilds def.spec; the six CG corners
  // the same lattice as the stand - on the five validated builds and an offset / envelope / null corpus; and the
  // page's join headless, on -> off -> commit through the garage's merge, back to never-on. ~70 s (the joins).
  { id: 'SPECFIX', file: '_specfix_check.js', tier: 'core', wall: 75 },
  // G134: the custom engine — thermo laws over the registry, the clamp
  // door, and the row reaching the frame; ENGID is the identity ruling
  // (untouched preset = the certified row; deviated = modified/custom)
  { id: 'ENGINE', file: '_engcustom_check.js', tier: 'core' },
  { id: 'ENGID', file: '_engid_check.js', tier: 'core' },
  // 2026-09-03: an "applies once" starter fires on a ROW change, never on a
  // LOAD — the engine preset and the cowl-for-architecture, and the three
  // doors that replace P
  { id: 'STARTER', file: '_starter_check.js', tier: 'core' },
  // 2026-09-03: what you SAVE is what is on the stand. The shelf's spec was
  // a cache of the editor that only a roll-out refreshed.
  { id: 'SAVE', file: '_save_check.js', tier: 'core' },
  // G208: the test section explains itself (every plaque row has its
  // explanation, the band bar stays on the bar), keeps its word (the
  // fingerprint ignores paint/finish/meta and nothing else) and wears its
  // stickers (one roundel per test, page 6, the seventh decal slot).
  { id: 'BENCH', file: '_bench_check.js', tier: 'core', wall: 90 },
  // G810 (ARCH-2026-09-27 §2.4): the solver on its own thread - src/viewer/sim_host.js in a worker_threads Worker
  // (the core only, the trimmed boot) driven through sim_view.js flies the page's inline loop to the bit on Jolene
  // (stock + the metal Cessna, a scripted input list stamped by step), its real-time log replays inline to the bit,
  // the fetch path and the Blob's glue; the transport, the pose age and the dilation printed; G1365: the page's freeze
  // HOLDS the flight (60 s on a fake clock, 1.5 s on the real thread) and it goes on from there; ~60 s
  { id: 'SIMWORKER', file: '_simworker_check.js', tier: 'core', wall: 70 },
  // G1530 (POSE-BACK; the user at ~2 fps: "as soon as it took off ... it went a little backward over a frame"): the drawn
  // pose through a take-off at a simulated 2 / 5 / 10 / 30 fps (steady, late, ragged pages, a CPU-starved worker) - the
  // worker's view against sim_host's own clock on a fake wall clock, and the inline PACE + POSE_LERP lifted from app.js,
  // both flying the real solver: monotonic along the motion, never a step ahead of the newest state, within a step of
  // the solver's own CG; the old clock caught going back; even 60 / 30 fps the same bits with and without; ~95 s
  { id: 'POSEBACK', file: '_poseback_check.js', tier: 'core', wall: 100, weight: 3 },
  // G816 (C1b): the PAGE flown through the worker - dev.html?simw=1 against dev.html in the page-in-node harness (its
  // Worker shim: node worker_threads, the same Blob source and messages), the Cub and the metal Cessna, the roll-out,
  // 40 s of the departure taxi at 2x: every step's p / v / CG / phase and every frame's page reads bit-identical, no
  // solver step on the page's thread. Four page runs ONE AT A TIME (~3.7-4.1 GB, ~4-5 min each on a 4-core cloud box)
  { id: 'SIMWORKER-PAGE', file: '_simworker_page_check.js', tier: 'full', timeout: 3 * 3600_000, weight: 2, wall: 1100 },
  // G821 (C1c): EVERY EDGE through the worker - one scripted session per build and mode (dev.html?simw=0 against
  // ?simw=1, lockstep): the pause, the hand on and off (taxiing and in the air), the world editor's edit (the worker's
  // world probed against the page's), Fly on, the skip to line-up, the scenery mode, Restart, the shed and its control
  // sweep and the roll-out back, the divergence; every flight's steps and page reads bit-identical, every door at the
  // same session step. Four page runs ONE AT A TIME (~3.8-4.1 GB each)
  { id: 'SIMWORKER-EDGES', file: '_simworker_edges_check.js', tier: 'full', timeout: 4 * 3600_000, weight: 2, wall: 2400 },
  // G1096 (SIMW-BENCH): A RIG'S PLACEMENT AND THE PLAYER'S PAUSE under the worker - FLIGHT_PROBE.place (the rigs' hold /
  // carry, on the sim that flies) and the pause button, ?simw=0 against ?simw=1 (lockstep), the Cub and the metal Cessna:
  // the pause holds to the bit, the CG where it was asked, every read bit-identical across the two paths. Four page runs
  // ONE AT A TIME (~3.6-4 GB each)
  { id: 'SIMWORKER-PLACE', file: '_simworker_place_check.js', tier: 'full', timeout: 3 * 3600_000, weight: 2, wall: 900 },
  // THE UNDERCARRIAGE (G67.3), and it closes the one gap G67.2 declared: the
  // three leg families as three different drawings — the check GATE GEN lost
  // when the old skin's leg drawer went — plus the wheel turning on its own,
  // the tyre reading as a circle, and the leg mirroring vertex for vertex.
  // Runs headless on a THREE stub, which is the only reason it never existed.
  { id: 'GEAR', file: '_gear_check.js', tier: 'core' },
  // THE WOODEN HOUSE (G229), the settlement's own generator: clean geometry
  // (no NaN, no zero-area triangle, every vertex with a UV in metres), no
  // wall standing through its own roof over four roof families x three
  // pitches x hip x a steep site, nothing buried in the hillside, every kept
  // opening clear of the roof line, and lod 1 a CONSTRUCTION rather than a
  // decimation (far cheaper AND the same silhouette). Under a second, and
  // negative-verified with --selftest. Since G232 it also holds the SECOND
  // generator (_shed_gen.js, plank by plank), the mechanical no-stretched-UV
  // rule (uv area over world area per triangle), the closed wall shell, and
  // sixty FUZZED builds — forty random houses and twenty random sheds, which
  // is where the buried-in-the-hillside sampler bugs came from.
  { id: 'HOUSE', file: '_house_check.js', tier: 'core' },
  // THE VILLAGE (G275): the terrain, the road, the plots off it, a house on
  // every plot built by the house generator on the terrain under it, the
  // fences on the plot lines and the paths to the road - eight seeds, every
  // plot checked for overlap and frontage, every house for standing on its
  // plot and on the ground, every fence for the line and the water.
  { id: 'VILLAGE', file: '_village_check.js', tier: 'core', wall: 70 },
  { id: 'BAY', file: '_bay_check.js', tier: 'core' },
  { id: 'BEACON', file: '_beacon_check.js', tier: 'core' },
  // THE PART TABLE (G76): the declared assembly against the editor's own row
  // list and the sections real builds emit — every slider in exactly one part
  { id: 'PARTS', file: '_parts_check.js', tier: 'core' },
  // THE SHOULDER (G325): the sill trim closed on every configuration
  { id: 'SHOULDER', file: '_shoulder_check.js', tier: 'core' },
  // THE MACRO ROWS (NEW-AIRCRAFT): the birth flow's declaration — every
  // option writes something or carries a reason, every written key real,
  // live classes inside the wing clamps, archetypes resolvable. ~8 s (every
  // card's tail is drawn headless).
  { id: 'DESIGN', file: '_design_check.js', tier: 'core' },
  // ...and the declared canonical builds actually FLY: designBake -> clamp
  // must not bite a declared value -> shakedown clears the circuit -> the
  // test pilot flies it to a full stop. Inactive archetypes are SKIPPED
  // WITH THEIR REASON PRINTED, so the gate log is also the backlog. Full
  // tier: it flies every active archetype's circuit, sharded four ways.
  // G185: 25 cards flown (five of them biplanes at 98 substeps and 536
  // beams, ~5 min of wall each) measured 1939 s uncapped, PASS, under five
  // peer sessions' load — the 1800 s cap below bit twice with no failed check
  // to point at, the exact false red its own paragraph describes. Doubled.
  { id: 'ARCHETYPES', file: '_arch_check.js', tier: 'full', timeout: 3600_000, shards: 4, wall: 1900 },
  // THE PILOT MATRIX as a ratchet (G399 / PILOT-ROADMAP P0.3): the quick set
  // against tools/pilot_baseline.json — no cell may get worse
  { id: 'PILOTMATRIX', file: '_pilotmatrix_check.js', tier: 'full', timeout: 3600_000, weight: 4, wall: 800 },
  { id: 'VIEW', file: '_view_check.js', tier: 'core' },
  // THE LIFT-STRUT FOOT (G86-G88): the site the fitting is built on — the
  // frame's own strut root snapped to the built skin — and the declared
  // fitting's own dimensions
  { id: 'STRUT', file: '_strut_check.js', tier: 'core' },
  // THE REFERENCE PLANE (G89-G93): the two in-repo aeroplanes the garage can
  // stand beside your build, held to their PUBLISHED span and length — every
  // measurement taken against a reference is worth exactly what that check is
  // — and the display-only rule, read off refplane.js's own source
  { id: 'REF', file: '_ref_check.js', tier: 'core' },
  // THE BLUEPRINT (G573): the reference plane's second source, a three-view
  // cut into views and stood in 3D — its frames, its scale, its level tool,
  // its ink and its layout, on a fixture the desk itself produced
  { id: 'BLUEPRINT', file: '_blueprint_check.js', tier: 'core' },
  // THE SITE (G123): the base aerodrome as ONE declared place. Asserts that
  // neither scene restates the runway the HOME record already carries, that
  // the frame conversion between the world and the shed round-trips, and the
  // geometric claims a shared site has to keep — nothing paved under the
  // building, a taxiway that reaches the strip, a fence with a gate in it, and
  // everything inside the flat pad where y = 0 is exact.
  { id: 'SITE', file: '_site_check.js', tier: 'core' },
  // G700 (B3a, the Jolene playtest's honesty items): every Jolene stand places the wheels on their own ground (the
  // walked stand read the runway's elevation - a 1.08 m drop), applyRoute's wiring, the default day's breeze; ~25 s
  { id: 'HONESTY', file: '_honesty_check.js', tier: 'core', wall: 40 },
  // THE PREMISES (G353): the world editor's record, headless - the envelope
  // round-trips, the modifiers hold (a flatten flat to 1 cm, no step across a
  // falloff, a million terrainH calls under budget), an empty record changes
  // nothing (GATE WORLD's goldens are safe), surface/exclude polygons answer,
  // the baked raster agrees with the live composition (WORLD-V2 6.3), and no
  // catalogue key is a literal in the editor (the contract held).
  { id: 'PREMISES', file: '_premises_check.js', tier: 'core' },
  // G614: the premises' composed ground as an A h + B lattice (opt-in) against the analytic path, the ceiling over
  // it, and the surface / exclude cell indexes against the scans they replaced; ~40 s
  { id: 'PREMRASTER', file: '_premraster_check.js', tier: 'core' },
  // G835: the premises' DATA COOK (tools/premises_cook.js) - the committed cook equals a fresh one (the fixture, the
  // generators, the page's placement code lifted from render_premises.js: a red here is a STALE cook - re-cook), the
  // cooked raster loads under the flag and reads the lazy raster to 0.05 mm, a stale cell is refused (~3 min)
  { id: 'PREMCOOK', file: '_premcook_check.js', tier: 'core', wall: 200 },
  // THE TOWN ON TEXTURE ARRAYS (G574): house_tarr.js's shader edits on r186's own program after the house
  // generator's real hooks, the classify by hook identity, the merge (world, the sag baked, one slot a finish), the
  // host's wiring (~2 s)
  { id: 'TARR', file: '_tarr_check.js', tier: 'core' },
  // THE TOWN KIT (G850, QUEUE-C C3a): the archetypes tools/town_kit.js clusters out of Jolene's sown zones - each
  // through GATE HOUSE's own battery, its roles and its stance stretch, the quantized pack round-tripping, and a
  // fitting archetype on every plot of Metlakatla and the village from the 32 B records alone (~25 s)
  { id: 'TOWNKIT', file: '_townkit_check.js', tier: 'core' },
  // THE TOWN KIT, DRAWN (C3b, G855-G859): src/viewer/townkit.js against the tool's own decoder, byte for byte; the
  // mirrored copies; the shader edits on r186's programs; the stance stretch through the host's matrices onto the
  // TERRAIN at every footprint corner of every record; the LOD band complementary and the tick a superset; the looks;
  // both hosts (BatchedMesh, the InstancedMesh arm); render_premises' look-review wiring (~12 s)
  { id: 'KITHOST', file: '_kithost_check.js', tier: 'core' },
  // METLAKATLA ON THE KIT (C3c, G860-G864): with the town composed, every plot Metlakatla sows is a kit plot of the
  // committed table (its seed) and nothing else is (the village, the landmarks); src/viewer/kit_lot.js places each lot's
  // house exactly where the kit's sowing did, keeps no house geometry (the pier's piles and the jetty alone), plans as
  // the lod-0 build; the zone's tide; the worker's wire; the outbuildings; the kit houses solid; the page's wiring (~55 s)
  { id: 'METKIT', file: '_metkit_check.js', tier: 'core' },
  // THE PARKED AEROPLANES (G411): builds as props, headless on a synthetic
  // snapshot - the record, the stance off the wheels, the hitbox by identity,
  // the ladder's membership, the cut (one bucket per triangle), the far rungs
  // on the same ground, the material dupe, the island's parked objects (~2 s)
  { id: 'PARKED', file: '_parked_check.js', tier: 'core' },
  // C4a (G870): the flown aeroplane's texture bake - what bakes, the atlas uv per vertex (and the split), the key,
  // the tangent frame riding the flex, the Toksvig mips, the dilation, the wiring (~1 s)
  { id: 'FLOWNBAKE', file: '_flown_bake_check.js', tier: 'core' },
  // THE OBSTACLES (G433): the column grids the solver pushes out of - the
  // shape and the push, the registry's bins, the discrepancy of every baked
  // prop's shape against its own mesh (a cell, 0.5 m), an aeroplane rolled at
  // a wall stops against it, the analytic world's settlements registered (~40 s)
  { id: 'OBSTACLE', file: '_obstacle_check.js', tier: 'core' },
  // G1060-G1062: a parked aeroplane's hitbox from its own spec (convex pieces off the physics frame, no grid) - the
  // pieces' push, every archetype stands one, then the page in node (one page, ~3 GB): the Jolene captures' wing
  // covered to 5 mm and overhung by <= 5 cm (the old raster's tip printed), a taxi past at 10 cm / into the wing, the cost
  { id: 'HITBOX', file: '_hitbox_check.js', tier: 'core', wall: 180 },
  // THE FLOAT IN WATER (G370): the H0 spike, headless — Archimedes against
  // the analytic sections and a Monte-Carlo volume, omega*dt / c*dt of the
  // water terms against the fleet's envelope, the hump on three tows, the
  // touchdown's drag climbing over frames (~30 s)
  { id: 'HYDRODYN', file: '_hydro_check.js', tier: 'core' },
  { id: 'WATER', file: '_water_check.js', tier: 'core' },
  { id: 'WETFX', file: '_wetfx_check.js', tier: 'core' },   // G2090 WATER-LOOK: the wet body's contacts for the spray / wake / bubbles - write-only (the base's bits), the records, the worker's path   // H6 G460: the one water material - the felt band's parity with waterH, the hook rules, the laws, the tile
  { id: 'WETFX-PAGE', file: '_wetfx_page_check.js', tier: 'full', weight: 2, wall: 300 },   // G2090: the page in node over a wheeled ditch - the pool hidden when dry, the splash / plough / field, warmed programs, no error
  // THE PAVEMENT (roads & runways, 2026-09-21): the one material every strip and road wears - the
  // builders' attributes, the markings recorded off sitePaintStrip, the hook rules, the recipe (~5 s)
  { id: 'PAVEMENT', file: '_pavement_check.js', tier: 'core' },
  // G1091 (POLISH-2): THE TREES BY THE RUNWAYS - the three variants (?rwytrees=today|map|mapx): the map's nearest TREE cell
  // against the nearest collidable tree per runway side, nothing on paving, the one rule the woodland and the fill share,
  // the ground paths and a 5 % surface in 'map' (core, ~1 min); under --all the fill's own trees in the page harness per
  // variant and the circuits flown in 'map' (~20 min). WEIGHT 4, THE WHOLE POOL: its page children (up to 6 GB heap each,
  // one at a time) beside ROUNDTRIP's page and an ARCHETYPES shard took a 15 GB cloud box out of memory (measured)
  { id: 'RWYTREES', file: '_rwytrees_check.js', tier: 'core', weight: 4, wall: 1200 },
  // THE SCENERY'S LIFE (2026-09-23): the procedural kit, the placement laws on a synthetic premises, the draw's
  // distances, the hooks (~1 s)
  { id: 'LIFE', file: '_life_check.js', tier: 'core' },
  // THE FLOAT IN THE SOLVER (H1, G382): the ultralight on floats settled,
  // taken off and landed on the sea, headless (~95 s)
  { id: 'FLOATS', file: '_floats_check.js', tier: 'core', wall: 140 },
  // THE WIPLINE FLOATS (G451): the catalogue's fifteen rows on their four
  // numbers each, the drawn hull closed and equal to the flown one, the
  // rudder blade and the paddle where they belong, the user's 172 on 2350s
  // settled on the sea (~2 min)
  { id: 'WIPLINE', file: '_wipline_check.js', tier: 'core', wall: 200 },
  // THE PILOT ON THE WATER (H4, G393): the sea lane's circuit, a crosswind
  // take-off, an idle taxi on the water rudder — three flights (~8 min)
  { id: 'SEAPLANE', file: '_seaplane_check.js', tier: 'full', wall: 480 },
  // THE PLAYER (HANGARS S1): the player's property as ONE document — its own
  // version and migrator walk beside the spec's (G105's ruling: state that is
  // not the aeroplane costs no spec version), the one-time lift of the two
  // shed prefs, the composition rule that keeps the world's shed and the room
  // you stand in the same size, and the vintage shelf that makes ruling 4
  // hold for property the way it holds for builds. Source-scans app.js for
  // the write-stop: nothing may quietly write the old pref keys again.
  { id: 'PLAYER', file: '_player_check.js', tier: 'core' },
  // THE HANGAR (HANGARS S2/S3): shells, kits, capabilities and the placement
  // contract. The kit tables partition the declared prop tables exactly once,
  // every capability verb is grantable, every kit places into every shell OR
  // REPORTS — never silently — the club's golden room is frozen to the
  // authored layout through the identity conversion, and every live shell
  // BUILDS, interior and exterior, at its dims and its slider corners with
  // no negative geometry (the instrumented stub caught the glazing band and
  // the stem course inside-out at the old slider floor).
  { id: 'HANGAR', file: '_hangar_check.js', tier: 'core' },
  // THE ENERGY MODULE (G97-G101): fourteen aeroplanes frozen as numbers —
  // cg0, every node mass and position, the ledger's empty/payload split and
  // the fitting list — BEFORE `spec.fuel` grows into a section with a v5->v6
  // migrator. The migration must move none of them, and "moved" is invisible:
  // a tank landing two rings aft shifts the CG, and genFrame then places the
  // main gear against that CG, and the aeroplane still looks completely normal
  { id: 'ENERGYBASE', file: '_energy_base.js', tier: 'core' },
  // ...and the module itself. G97: the INTERIOR VOLUME — the swept section,
  // the wall taken off along the edge normals, and whether a given solid
  // actually fits. Every way it can be wrong is silent and reads as a slightly
  // roomier aeroplane, so every one of them has a check
  { id: 'ENERGY', file: '_energy_check.js', tier: 'core' },
  // G1106 (CUB-COCKPIT): no tank support through the skin - every archetype
  // built as the game flies it, the energy layer drawn headless at three tank
  // sizes; the mount is gone and each vessel's hardware is raycast from its
  // centre against every other surface (the fuselage sheet included)
  { id: 'TANKMOUNT', file: '_tank_mount_check.js', tier: 'core' },
  // THE PANEL ARC, session 1 (2026-09-11): the sources the instruments read
  // — the shaft speed against the J-3's real numbers, the burn against the
  // thermo sheet, nz at rest and in free fall, the key and the starter
  { id: 'RPM', file: '_rpm_check.js', tier: 'core' },
  // ...and session 2: the fit as a list — catalogues, tiers, the resolver,
  // the ledger billing exactly its rows, the aerials reading the radios
  { id: 'PANEL', file: '_panel_check.js', tier: 'core' },
  // ...and session 4: the bus — a battery that drains, an alternator that
  // cuts in, a starter that asks, loads that sum
  { id: 'ELEC', file: '_elec_check.js', tier: 'core' },
  // world contract (appended: keeps the battery log prefix diffable)
  { id: 'WORLD', file: 'test_world.js', tier: 'core' },
  { id: 'HYDRO', file: 'test_hydro.js', tier: 'core' },
  { id: 'BIOME', file: 'test_biome.js', tier: 'core' },
  { id: 'SETTLE', file: 'test_settle.js', tier: 'core' },
  { id: 'AERO', file: 'test_aero.js', tier: 'core' },
  // HOT AND HIGH (G72): the atmosphere with an aeroplane in it. GATE ATMOS
  // proves the model, this proves it reaches the wing and the engine — two
  // flown take-offs off a 113 m strip on two different days, the electric-
  // vs-piston split the `aspiration` field buys, and a full circuit in that
  // air. Full tier: it flies (the garage build, since the fleet retired).
  { id: 'HOTHIGH', file: 'test_hothigh.js', tier: 'full', wall: 300 },
  // SOARING (CLIMATE K1, 2026-09-22): the motorglider engine-off in the climate's air - the flown sink
  // against the sheet's polar, and a ridge beat that GAINS height where the same beat without the
  // terrain term is on the ground inside the run
  { id: 'SOAR', file: 'test_soar.js', tier: 'full', wall: 240 },
  // G1460 (SOFT-GPU): THE GAME DRAWS ITS WORLD ON A SOFTWARE GPU - headless Chromium on SwiftShader (every cloud
  // session's browser), the real page: the garage boot to its end, Roll out, the stand, one drawn frame with the ground
  // and the aeroplane in it (not the clear colour; the aeroplane hidden changes it). Full tier: a software GL boots in
  // ~15-20 min on a 4-core box; the whole machine's cores (weight 4). SKIP where there is no Playwright (the box)
  { id: 'SOFTGPU', file: '_softgpu_check.js', tier: 'full', timeout: 2 * 3600_000, weight: 4, wall: 1800 },
  // structural realism instrument (appended: keeps the battery log prefix
  // diffable). Measures only — it asserts finiteness and determinism, not
  // bounds. See test_flex.js's header and HANDOVER's STRUCTURAL REALISM.
  { id: 'FLEX', file: 'test_flex.js', tier: 'core', shards: 3, wall: 900 },
  // the sandbag test: FAR 23 normal category limit + ultimate, on the rig.
  { id: 'LOAD', file: 'test_load.js', tier: 'core', wall: 190 },
  // THE ENGINE BEARER (G179): every mount kind parked and settled — the
  // engine stays on its bearer, the bearer stops ringing, the wing root
  // stays put against the firewall. Negative control on the twin fixture.
  { id: 'MOUNT', file: '_mount_check.js', tier: 'core', wall: 130 },
  // SND-ENGINE (G1613): the engine part of GATE AUDIO - the worklet run in node under a shim: the
  // firing frequency within 3 % across idle..rated on the five validated engines (48 and 44.1 kHz), no
  // NaN/clip/DC/subnormal, process() allocation-free, seeded, the life driven by the solver, the sound
  // row physics-inert; every assertion negative-verified. SND-CORE's _audio_check.js absorbs it; ~3 min
  { id: 'AUDIOENG', file: 'audio/_engine_check.js', tier: 'core', wall: 320 },
  // REVIEW 2026-10-04 (A6): the settlement houses' hitboxes stand where the houses are drawn - the registry's frame
  // against the renderer's, sampled inside and outside every footprint; ~2 s. A sibling gate written by the same
  // review is NOT registered because it is red on master until its finding is fixed: _genpairs_check.js (B10: the
  // lattice over paired configurations - the twin boom's two zero-length beams)
  { id: 'OBSTFRAME', file: '_obstframe_check.js', tier: 'core', wall: 5 },
  // REVIEW 2026-10-04 (A5), registered with G1560 WORLD-STRIPS: every generated strip on the ground its record says -
  // walked at 2 m down its centreline and both edges, |elev - terrainH| < 0.5 m and no water, seeds 0-3 (seed 0's
  // A2 Pelham Field sat across a river); ~6 s
  { id: 'STRIPGROUND', file: '_stripground_check.js', tier: 'core', wall: 8 },
  // GEN-PAIRS G1580 (REVIEW 2026-10-04 B10 / E7): the lattice over seventeen single and paired configurations
  // (tricycle, pusher, wingTop, twin boom, V-tail, biplane, floats and their pairs) - every node finite, every
  // mass positive, every member over 1 mm and none refused by B() (parts.degenerate), the lattice mirrored; ~5 s.
  // Red before G1580 on every twin-boom combination. GATE GEN's PAIRS block holds the same pairs' rank and stance.
  { id: 'GENPAIRS', file: '_genpairs_check.js', tier: 'core', wall: 10 },
  // RELEASE-CHECKS G1591 (review B27): the committed index.html / dev.html / sw.js / flight_core.js / version.json are
  // a build of the sources - rebuilt into a temp dir and compared; a stale "(built)" commit is red, a source commit's
  // lag is named (BUILT_STRICT=1: red too - A0's landing runs it so on the (built) commit). ~2 s.
  { id: 'BUILT', file: '_built_check.js', tier: 'core', wall: 5 },
];

const args = process.argv.slice(2);
const onlyArg = args.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).toUpperCase().split(',').filter(Boolean) : null;
const verbose = args.includes('--verbose');
const all = args.includes('--all');
const jobsArg = args.find(a => a.startsWith('--jobs='));
const jobs = Math.max(1, jobsArg ? +jobsArg.slice(7) : (+process.env.GATES_JOBS || 4));
// GATES_CORE is read by the gates themselves, not just the runner (a gate may
// scope a sweep by it). --only=... is an explicit request for those gates, so
// it implies full.
const coreOnly = !all && !only;
if (coreOnly) process.env.GATES_CORE = '1';
const mode = coreOnly ? 'core' : 'all';

if (!args.includes('--no-build')) require('./build.js').build();

// the wall each job took last time, for the longest-first order
const WALL_FILE = path.join(__dirname, 'perf', 'gate_wall.json');
let wallTab = {};
try { wallTab = JSON.parse(fs.readFileSync(WALL_FILE, 'utf8')); } catch (e) {}

const selected = GATES.filter(g => !(only && !only.includes(g.id)) && !(coreOnly && g.tier !== 'core'));
// REVIEW 2026-10-04 (B26): an --only id that names no gate selected nothing and the summary printed BATTERY: PASS
if (only) {
  const unknown = only.filter(id => !GATES.some(g => g.id === id));
  if (unknown.length || !selected.length) {
    console.error(`run_gates: unknown gate id(s) in --only: ${unknown.join(', ') || '(none selected)'}`);
    process.exit(2);
  }
}
const skipped = GATES.filter(g => !(only && !only.includes(g.id)) && coreOnly && g.tier !== 'core').length;

// one job per gate, or per shard when the pool can use them
const jobList = [];
for (const g of selected) {
  const n = jobs > 1 && g.shards > 1 ? g.shards : 1;
  for (let i = 0; i < n; i++) {
    const key = n > 1 ? `${g.id}/${i}` : g.id;
    const rec = wallTab[key] && wallTab[key][mode];
    jobList.push({ gate: g, key, shard: n > 1 ? { i, n } : null,
                   argv: (n > 1 ? [`--shard=${i}/${n}`] : []).concat(g.argv || []),   // G2104: a row's own arguments (UISMOKE-PHONE)
                   weight: Math.min(jobs, g.weight || 1),
                   expect: rec != null ? rec : (g.wall || 5) / n });
  }
}
// 1800 s, not 900 and certainly not 300: a timeout is not a verdict, and a
// false red is worse than a slow one. The old fleet's WIND gate was the
// original reason (~226 s quiet, ~297 s busy) and a 300 s cap turned an
// ordinary slow machine into a red battery with no failed check to point at.
//
// RAISED 900 -> 1800 (2026-08-29). GEN had crept to 872/883/882 s over three
// runs in one afternoon and then took 901 — and was killed one second short
// of its own verdict. Run uncapped it is GATE GEN: PASS, 74/74 checks, in
// 901 s. That is a false red of the exact kind the paragraph above is about,
// and it will recur every time the generator gains a case, so the headroom
// is doubled rather than shaved. If a gate ever genuinely hangs, this still
// catches it.
function runJob(job) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const timeoutMs = job.gate.timeout || 1800_000;
    // THE CHILD WRITES TO FILES, NOT PIPES (G577): on Linux Node writes a
    // pipe asynchronously, so a gate that ends with process.exit() loses
    // whatever is still queued - ENGINE came back as its first line and exit
    // 0 (16 runs in 40 at 8 in parallel, cut at ~9.5 KB; 0 in 120 through a
    // file). A file is written synchronously on every platform, Windows
    // included, where pipes already were, so the output is byte for byte
    // what it was there
    const tag = `${job.gate.id}_${job.shard ? job.shard.i : 0}_${process.pid}_${t0}`;
    const outF = path.join(os.tmpdir(), `gate_${tag}.out`), errF = path.join(os.tmpdir(), `gate_${tag}.err`);
    const outFd = fs.openSync(outF, 'w'), errFd = fs.openSync(errF, 'w');
    const child = spawn(process.execPath, [job.gate.file, ...job.argv],
                        { cwd: __dirname, stdio: ['ignore', outFd, errFd], env: process.env });
    fs.closeSync(outFd); fs.closeSync(errFd);
    const slurp = f => { try { const t = fs.readFileSync(f, 'utf8'); fs.unlinkSync(f); return t; } catch (e) { return ''; } };
    let error = null;
    const timer = setTimeout(() => { error = { message: `ETIMEDOUT after ${timeoutMs} ms` }; child.kill(); }, timeoutMs);
    child.on('error', e => { error = e; });
    child.on('close', status => {
      clearTimeout(timer);
      resolve({ job, stdout: slurp(outF), stderr: slurp(errF),
                status, error, secs: ((Date.now() - t0) / 1000).toFixed(1) });
    });
  });
}

// the pool: start a job when its weight fits (or when nothing runs), longest first
async function runPool(list, slots, onStart, onDone) {
  const queue = slots > 1 ? list.slice().sort((a, b) => b.expect - a.expect) : list.slice();
  const running = new Set();
  let free = slots;
  await new Promise(resolve => {
    const pump = () => {
      while (queue.length) {
        const idx = queue.findIndex(j => j.weight <= free || running.size === 0);
        if (idx < 0) break;
        const job = queue.splice(idx, 1)[0];
        free -= job.weight; running.add(job); onStart(job);
        runJob(job).then(r => { free += job.weight; running.delete(job); onDone(r); pump(); });
      }
      if (!queue.length && !running.size) resolve();
    };
    pump();
  });
}

// a shard's partition line: SHARD i/N: k of K heavy jobs
const partOf = r => { const m = /^SHARD (\d+)\/(\d+): (\d+) of (\d+) heavy jobs$/m.exec(r.stderr || ''); return m ? { k: +m[3], K: +m[4] } : null; };

function printGate(g, results) {
  let pass = true, skipped = false;
  console.log(`=== ${g.id} ===`);
  const parts = results.map(partOf);
  const partitionOk = results.length === 1 ||
    (parts.every(Boolean) && parts.every(p => p.K === parts[0].K) && parts.reduce((s, p) => s + p.k, 0) === parts[0].K);
  for (const r of results) {
    const stdout = r.stdout || '';
    // train 31 (A0): `GATE <ID>: SKIP` with exit 0 is a gate that cannot run on this machine (SOFTGPU: no Playwright on
    // the box) - shown as SKIP, never as a PASS and never as a FAIL
    const skip = r.status === 0 && !r.error && new RegExp(`^GATE ${g.id}: SKIP$`, 'm').test(stdout);
    if (skip) skipped = true;
    const ok = skip || (r.status === 0 && !r.error && new RegExp(`^GATE ${g.id}: PASS$`, 'm').test(stdout));
    if (!ok) pass = false;
    if (r.job.shard) console.log(`--- shard ${r.job.shard.i}/${r.job.shard.n} (${r.secs} s) ---`);
    if (ok && !verbose && partitionOk) {
      console.log(stdout.trim().split('\n').slice(-3).join('\n'));
    } else {
      // failing gates get their FULL output — nothing swallowed
      console.log(stdout.trim());
      if (r.stderr && r.stderr.trim()) console.log('[stderr]\n' + r.stderr.trim());
      if (r.error) console.log('[spawn error] ' + r.error.message);
      if (!ok) console.log(`(exit code ${r.status})`);
    }
  }
  if (!partitionOk) {
    pass = false;
    console.log(`(shard partition disagrees: ${parts.map(p => p ? `${p.k}/${p.K}` : 'none').join(' ')} — a heavy job was dropped or flown twice)`);
  }
  const secs = results.reduce((m, r) => Math.max(m, +r.secs), 0).toFixed(1);
  return { pass, skipped, secs, shards: results.length };
}

(async () => {
  const t0 = Date.now();
  const byGate = new Map(selected.map(g => [g.id, []]));
  const done = new Map();
  let cursor = 0, nDone = 0;
  const flush = () => {   // print in GATES order, a gate as soon as it and every earlier one is done
    while (cursor < selected.length) {
      const g = selected[cursor];
      const rs = byGate.get(g.id);
      const need = jobList.filter(j => j.gate === g).length;
      if (rs.length < need) break;
      rs.sort((a, b) => (a.job.shard ? a.job.shard.i : 0) - (b.job.shard ? b.job.shard.i : 0));
      done.set(g.id, printGate(g, rs));
      cursor++;
    }
  };
  const running = new Map();
  const ticker = jobs > 1 ? setInterval(() => {
    const now = Date.now();
    const live = [...running.entries()].map(([k, t]) => `${k} ${((now - t) / 1000).toFixed(0)} s`).join(', ');
    process.stderr.write(`[run_gates] ${nDone}/${jobList.length} jobs done · running ${live}\n`);
  }, 30_000) : null;
  await runPool(jobList, jobs, j => running.set(j.key, Date.now()), r => {
    nDone++;
    running.delete(r.job.key);
    byGate.get(r.job.gate.id).push(r);
    if (!wallTab[r.job.key]) wallTab[r.job.key] = {};
    wallTab[r.job.key][mode] = +r.secs;
    flush();
  });
  if (ticker) clearInterval(ticker);
  flush();
  try { fs.mkdirSync(path.dirname(WALL_FILE), { recursive: true }); fs.writeFileSync(WALL_FILE, JSON.stringify(wallTab, null, 1) + '\n'); } catch (e) {}

  let anyFail = false;
  console.log('\n──────── summary ────────');
  for (const g of selected) {
    const d = done.get(g.id);
    console.log(`${g.id.padEnd(9)} ${d.skipped ? 'SKIP' : d.pass ? 'PASS' : 'FAIL'}  ${d.secs.padStart(6)} s${d.shards > 1 ? `  [${d.shards} shards]` : ''}`);
    if (!d.pass) anyFail = true;
  }
  const total = selected.reduce((s, g) => s + Number(done.get(g.id).secs), 0).toFixed(1);
  console.log(`${'total'.padEnd(9)}       ${total.padStart(6)} s`);
  if (jobs > 1) console.log(`${'wall'.padEnd(9)}       ${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s  (jobs ${jobs})`);
  // The verdict NAMES the tier. A core pass proves the garage; it says nothing
  // about the slow full-tier sweeps, and calling both "BATTERY: PASS" is exactly
  // how a green run stops meaning anything.
  if (anyFail) console.log(`\n${coreOnly ? 'CORE ' : ''}BATTERY: FAIL — never deliver red.`);
  else if (coreOnly)
    console.log(`\nCORE BATTERY: PASS — ${skipped} full-tier gates SKIPPED.` +
                '\nNOT a delivery verdict: run `node tools/run_gates.js --all` before delivering.');
  else console.log('\nBATTERY: PASS');
  process.exitCode = anyFail ? 1 : 0;
})();
