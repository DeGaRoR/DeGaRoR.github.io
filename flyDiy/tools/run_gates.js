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

// TIERS (2026-08-11). The project is a GARAGE: the generated aeroplane and the
// two imported meshes (PA-18, C172) are the product, and the hand fiches are
// reference and gating that will eventually be replaced by procedural builds.
// The full battery is ~19 min, which is too slow to iterate a generator change
// against, so gates carry a tier:
//   core  — the two mesh aircraft, the generator, the structural instrument,
//           and everything cheap (world, skin, codec). ~10 min.
//   fleet — the reference fiches and their cross-country legs. ~9 min on top.
// `node tools/run_gates.js` runs CORE. `--all` runs everything, and the summary
// says loudly which it did: a core pass is NOT a delivery verdict, and the
// session ritual's "never deliver on a non-zero exit" now reads "never deliver
// without a green --all".
const GATES = [
  { id: 'GE', file: 'test_ground_effect.js', tier: 'core' },
  { id: 'FLAPS', file: 'test_flaps.js', tier: 'core' },
  { id: 'WIND', file: 'test_wind.js', tier: 'fleet' },   // flies the WHOLE fleet: 222 s
  { id: 'M3', file: 'test_m3.js', tier: 'fleet' },
  { id: 'DRONE', file: 'test_drone.js', tier: 'fleet' },
  { id: 'DC3', file: 'test_dc3.js', tier: 'fleet' },
  { id: 'JODEL', file: 'test_jodel.js', tier: 'fleet' },
  { id: 'C172', file: 'test_c172.js', tier: 'core' },    // mesh aircraft
  { id: 'CHINOOK', file: 'test_chinook.js', tier: 'fleet' },
  { id: 'STRESS', file: 'test_stress.js', tier: 'core' },   // covers `gen` too
  { id: 'GEN', file: 'test_gen.js', tier: 'core' },
  { id: 'TREE', file: 'test_tree.js', tier: 'core' },
  // flexbody skin (appended: keeps the physics battery log prefix diffable)
  { id: 'MODEL', file: 'test_model.js', tier: 'core' },
  { id: 'SKIN', file: 'test_skin.js', tier: 'core' },
  { id: 'CTRL', file: 'test_ctrl.js', tier: 'core' },
  { id: 'UISMOKE', file: 'test_ui_smoke.js', tier: 'core' },
  { id: 'PA18', file: 'test_pa18.js', tier: 'core' },     // mesh aircraft
  { id: 'C172M', file: 'test_c172_model.js', tier: 'core' },
  { id: 'WORLDRENDER', file: 'test_world_render.js', tier: 'core' },
  // world contract (appended: keeps the battery log prefix diffable)
  { id: 'WORLD', file: 'test_world.js', tier: 'core' },
  { id: 'HYDRO', file: 'test_hydro.js', tier: 'core' },
  { id: 'BIOME', file: 'test_biome.js', tier: 'core' },
  { id: 'SETTLE', file: 'test_settle.js', tier: 'core' },
  { id: 'AERO', file: 'test_aero.js', tier: 'core' },
  { id: 'XCTY', file: 'test_xcty.js', tier: 'fleet' },    // cub
  { id: 'XCTY2', file: 'test_xcty2.js', tier: 'fleet' },  // c172, but a ROUTE test
  { id: 'XCTY3', file: 'test_xcty3.js', tier: 'fleet' },  // cub
  // XCTY4 is the original user short-field repro (PA-18 into Stein) and stays
  // in core: it is the only gate that asserts an upright arrival on a bench.
  { id: 'XCTY4', file: 'test_xcty4.js', tier: 'core' },
  { id: 'XCTY5', file: 'test_xcty5.js', tier: 'fleet' },
  // structural realism instrument (appended: keeps the battery log prefix
  // diffable). Measures only — it asserts finiteness and determinism, not
  // bounds. See test_flex.js's header and HANDOVER's STRUCTURAL REALISM.
  { id: 'FLEX', file: 'test_flex.js', tier: 'core' },
  // the sandbag test: FAR 23 normal category limit + ultimate, on the rig.
  { id: 'LOAD', file: 'test_load.js', tier: 'core' },
];

const args = process.argv.slice(2);
const onlyArg = args.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).toUpperCase().split(',').filter(Boolean) : null;
const verbose = args.includes('--verbose');
const all = args.includes('--all');
// GATES_CORE is read by the gates themselves, not just the runner: FLEX uses it
// to measure the two mesh aircraft and the generator instead of all seven
// fiches. --only=... is an explicit request for those gates, so it implies full.
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
  // 900 s, not 300: WIND flies the WHOLE fleet through gusty circuits and is
  // the long pole (~226 s on a quiet machine, ~297 s on a busy one). A 300 s
  // cap turned an ordinary slow machine into a red battery with no failed
  // check to point at — a timeout is not a verdict, and a false red is worse
  // than a slow one. If a gate ever genuinely hangs, this still catches it.
  const r = spawnSync(process.execPath, [g.file], { cwd: __dirname, encoding: 'utf8', timeout: 900_000 });
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
// The verdict NAMES the tier. A core pass proves the garage and the two mesh
// aircraft; it says nothing about the reference fiches, and calling both
// "BATTERY: PASS" is exactly how a green run stops meaning anything.
if (anyFail) console.log(`\n${coreOnly ? 'CORE ' : ''}BATTERY: FAIL — never deliver red.`);
else if (coreOnly)
  console.log(`\nCORE BATTERY: PASS — ${skipped} fleet gates SKIPPED.` +
              '\nNOT a delivery verdict: run `node tools/run_gates.js --all` before delivering.');
else console.log('\nBATTERY: PASS');
process.exitCode = anyFail ? 1 : 0;
