#!/usr/bin/env node
// run_gates.js — full gate battery. ALWAYS rebuilds generated files first so
// gates can never test a stale flight_core.js. Exits non-zero on any FAIL.
// Verdict contract: every gate prints exactly one final line
//   GATE <ID>: PASS   or   GATE <ID>: FAIL[ (reason)]
// and sets a non-zero exit code on failure. The runner requires BOTH signals.
// Flags: --only=ID[,ID]   run a subset (e.g. --only=M3,TREE)
//        --verbose        full output for passing gates too
//        --no-build       skip the rebuild (escape hatch)
const { spawnSync } = require('child_process');

// TIERS (2026-08-11; the fleet retired 2026-09-05). The project is a GARAGE:
// the generated aeroplane is the product, and every gate below flies or
// measures a generated build. The full battery is too slow to iterate a
// generator change against, so gates carry a tier:
//   core  — the generator, the structural instruments, the editor's gates
//           and everything cheap (world, skin, codec).
//   full  — the slow sweeps on top: ARCHETYPES (fourteen builds flown) and
//           HOTHIGH (the hot-day circuit).
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
  // MANUAL CONTROLS (G200). Pure model, instant: the action table, the
  // keyboard shaping, the gamepad mapping and listen inference, the profile
  // round trip — and the one thing that flew wrong in W14's notes, the
  // re-engage after hand flying, flown headless on both pilots.
  { id: 'INPUT', file: 'test_input.js', tier: 'core' },
  { id: 'ATMOS', file: 'test_atmos.js', tier: 'core' },
  { id: 'GE', file: 'test_ground_effect.js', tier: 'core' },
  { id: 'FLAPS', file: 'test_flaps.js', tier: 'core' },
  { id: 'STRESS', file: 'test_stress.js', tier: 'core' },
  { id: 'GEN', file: 'test_gen.js', tier: 'core' },
  // THE TEST PILOT (G107): the second autopilot's own battery, negative-first —
  // a build that cannot fly must come back SAYING SO in bounded time. Carries
  // --selftest (doctored reports; every check proven able to go red).
  { id: 'PILOT', file: 'test_pilot.js', tier: 'core' },
  // THE NAV (G202.1): the navigator and the units, pure and fast
  { id: 'NAV', file: 'test_nav.js', tier: 'core' },
  // G193: the user's ultralight off the stand through the declared pattern —
  // the stop, the straight roll, in calm air and in wind (~3 min)
  { id: 'TAKEOFF', file: '_takeoff_check.js', tier: 'core' },
  // THE SIM DOES NOT LIE (G115): gear/strut drag as a delta from the
  // calibration's reference gear, the ground's surface table, the fin's own
  // polar + the measured weathervane, and the plaque agreeing with itself.
  // Carries --selftest.
  { id: 'HONEST', file: 'test_honest.js', tier: 'core' },
  // THE BIPLANE (G185): the truss (rigidity rank, the wire-cut negative),
  // the parasol's cabane, the tension-only wire, and — from G185.5 — the
  // vortex kernel against Prandtl's sigma, Munk's stagger theorem and the
  // tail-downwash window. Carries --selftest.
  { id: 'BIPLANE', file: 'test_biplane.js', tier: 'core' },
  // MASS CAN CHANGE NOW (G121): the P-4 solver proofing, landed before the
  // energy arc's burn — the setNodeMass door, live totalM, dry-mass substeps,
  // the fuel record, the live taxi feedforward, the sheet at reserves, and
  // the twin clamp. Carries --selftest.
  { id: 'MASS', file: 'test_massproof.js', tier: 'core' },
  { id: 'TREE', file: 'test_tree.js', tier: 'core' },
  // flexbody skin (appended: keeps the physics battery log prefix diffable)
  { id: 'SKIN', file: 'test_skin.js', tier: 'core' },
  { id: 'UISMOKE', file: 'test_ui_smoke.js', tier: 'core' },
  { id: 'WORLDRENDER', file: 'test_world_render.js', tier: 'core' },
  // the hangar prop library: baked payload vs the declared table
  { id: 'PROPS', file: '_prop_check.js', tier: 'core' },
  // THE TREE PAYLOAD (W0b). Not "does the file exist" — every fault this
  // pipeline met in the bench presented as "the tree is missing or wrong"
  // and was something else entirely, so this asserts what comes back OUT is
  // a tree: standing on y = 0, inside its own box and filling it, with an AO
  // channel that carries information and rungs that share one frame.
  { id: 'TREES', file: '_tree_check.js', tier: 'core' },
  // G286: the graphics settings menu - presets, the pref, the handles
  { id: 'GFX', file: '_gfx_check.js', tier: 'core' },
  // the external asset store (2026-09-01): referenced == present both ways,
  // no base64 creep, and index.html's size budget — mechanical at last
  { id: 'MEDIA', file: '_media_check.js', tier: 'core' },
  // THE BUILD FILE (G63): save -> load -> editor -> join -> resolved spec.
  // ruling 4 promised this battery a loading gate and it never had one.
  { id: 'BUILD', file: 'test_build.js', tier: 'core' },
  // AEROSKIN (G67): the declared finish + role tables against the cage's own
  // section list, and the r128 constraints the shader stands on
  { id: 'SKINMAT', file: 'test_skinmat.js', tier: 'core' },
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
  // THE CONTROL HARDWARE (G241): every control surface's nose turns INSIDE
  // its cove instead of through the wing — measured off the emitted vertices,
  // station by station, which is the clearance at every deflection because a
  // rotation does not change a radius — plus the declared travel, the
  // Fowler's own translation, the hinge table's bounds and that every shape
  // in _hinge_gen draws. Sub-second. Negative-verified (--selftest).
  { id: 'HINGE', file: '_hinge_check.js', tier: 'core' },
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
  { id: 'FIN', file: '_fin_check.js', tier: 'core' },         // fin + stab vs the sketch
  { id: 'COWL', file: '_cowl_check.js', tier: 'core' },       // the cowl, and the engine inside it
  { id: 'ENGMESH', file: '_eng_mesh_check.js', tier: 'core' },// the engine's own health + ledger
  { id: 'JOIN', file: '_join_check.js', tier: 'core' },       // editor -> spec -> a buildable aeroplane
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
  { id: 'BENCH', file: '_bench_check.js', tier: 'core' },
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
  { id: 'VILLAGE', file: '_village_check.js', tier: 'core' },
  { id: 'BAY', file: '_bay_check.js', tier: 'core' },
  { id: 'BEACON', file: '_beacon_check.js', tier: 'core' },
  // THE PART TABLE (G76): the declared assembly against the editor's own row
  // list and the sections real builds emit — every slider in exactly one part
  { id: 'PARTS', file: '_parts_check.js', tier: 'core' },
  // THE MACRO ROWS (NEW-AIRCRAFT): the birth flow's declaration — every
  // option writes something or carries a reason, every written key real,
  // live classes inside the wing clamps, archetypes resolvable. Sub-second.
  { id: 'DESIGN', file: '_design_check.js', tier: 'core' },
  // ...and the declared canonical builds actually FLY: designBake -> clamp
  // must not bite a declared value -> shakedown clears the circuit -> the
  // test pilot flies it to a full stop. Inactive archetypes are SKIPPED
  // WITH THEIR REASON PRINTED, so the gate log is also the backlog. Full
  // tier: it flies every active archetype's circuit (~13 min).
  // G185: 25 cards flown (five of them biplanes at 98 substeps and 536
  // beams, ~5 min of wall each) measured 1939 s uncapped, PASS, under five
  // peer sessions' load — the 1800 s cap below bit twice with no failed check
  // to point at, the exact false red its own paragraph describes. Doubled.
  { id: 'ARCHETYPES', file: '_arch_check.js', tier: 'full', timeout: 3600_000 },
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
  // THE SITE (G123): the base aerodrome as ONE declared place. Asserts that
  // neither scene restates the runway the HOME record already carries, that
  // the frame conversion between the world and the shed round-trips, and the
  // geometric claims a shared site has to keep — nothing paved under the
  // building, a taxiway that reaches the strip, a fence with a gate in it, and
  // everything inside the flat pad where y = 0 is exact.
  { id: 'SITE', file: '_site_check.js', tier: 'core' },
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
  { id: 'HOTHIGH', file: 'test_hothigh.js', tier: 'full' },
  // structural realism instrument (appended: keeps the battery log prefix
  // diffable). Measures only — it asserts finiteness and determinism, not
  // bounds. See test_flex.js's header and HANDOVER's STRUCTURAL REALISM.
  { id: 'FLEX', file: 'test_flex.js', tier: 'core' },
  // the sandbag test: FAR 23 normal category limit + ultimate, on the rig.
  { id: 'LOAD', file: 'test_load.js', tier: 'core' },
  // THE ENGINE BEARER (G179): every mount kind parked and settled — the
  // engine stays on its bearer, the bearer stops ringing, the wing root
  // stays put against the firewall. Negative control on the twin fixture.
  { id: 'MOUNT', file: '_mount_check.js', tier: 'core' },
];

const args = process.argv.slice(2);
const onlyArg = args.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).toUpperCase().split(',').filter(Boolean) : null;
const verbose = args.includes('--verbose');
const all = args.includes('--all');
// GATES_CORE is read by the gates themselves, not just the runner (a gate may
// scope a sweep by it). --only=... is an explicit request for those gates, so
// it implies full.
const coreOnly = !all && !only;
if (coreOnly) process.env.GATES_CORE = '1';

if (!args.includes('--no-build')) require('./build.js').build();

let anyFail = false;
const rows = [];
let skipped = 0;
for (const g of GATES) {
  if (only && !only.includes(g.id)) continue;
  if (coreOnly && g.tier !== 'core') { skipped++; continue; }
  const t0 = Date.now();
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
  const r = spawnSync(process.execPath, [g.file], { cwd: __dirname, encoding: 'utf8', timeout: g.timeout || 1800_000 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const stdout = r.stdout || '';
  const pass = r.status === 0 && new RegExp(`^GATE ${g.id}: PASS$`, 'm').test(stdout);
  console.log(`=== ${g.id} ===`);
  if (pass && !verbose) {
    console.log(stdout.trim().split('\n').slice(-3).join('\n'));
  } else {
    // failing gates get their FULL output — nothing swallowed
    console.log(stdout.trim());
    if (r.stderr && r.stderr.trim()) console.log('[stderr]\n' + r.stderr.trim());
    if (r.error) console.log('[spawn error] ' + r.error.message);
    if (!pass) console.log(`(exit code ${r.status})`);
  }
  rows.push([g.id, pass, secs]);
  if (!pass) anyFail = true;
}

console.log('\n──────── summary ────────');
for (const [id, pass, secs] of rows)
  console.log(`${id.padEnd(9)} ${pass ? 'PASS' : 'FAIL'}  ${secs.padStart(6)} s`);
const total = rows.reduce((s, r) => s + Number(r[2]), 0).toFixed(1);
console.log(`${'total'.padEnd(9)}       ${total.padStart(6)} s`);
// The verdict NAMES the tier. A core pass proves the garage; it says nothing
// about the slow full-tier sweeps, and calling both "BATTERY: PASS" is exactly
// how a green run stops meaning anything.
if (anyFail) console.log(`\n${coreOnly ? 'CORE ' : ''}BATTERY: FAIL — never deliver red.`);
else if (coreOnly)
  console.log(`\nCORE BATTERY: PASS — ${skipped} full-tier gates SKIPPED.` +
              '\nNOT a delivery verdict: run `node tools/run_gates.js --all` before delivering.');
else console.log('\nBATTERY: PASS');
process.exitCode = anyFail ? 1 : 0;
