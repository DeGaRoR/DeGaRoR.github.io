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

const GATES = [
  { id: 'GE', file: 'test_ground_effect.js' },
  { id: 'FLAPS', file: 'test_flaps.js' },
  { id: 'WIND', file: 'test_wind.js' },
  { id: 'M3', file: 'test_m3.js' },
  { id: 'DRONE', file: 'test_drone.js' },
  { id: 'DC3', file: 'test_dc3.js' },
  { id: 'JODEL', file: 'test_jodel.js' },
  { id: 'C172', file: 'test_c172.js' },
  { id: 'CHINOOK', file: 'test_chinook.js' },
  { id: 'STRESS', file: 'test_stress.js' },
  { id: 'TREE', file: 'test_tree.js' },
];

const args = process.argv.slice(2);
const onlyArg = args.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).toUpperCase().split(',').filter(Boolean) : null;
const verbose = args.includes('--verbose');

if (!args.includes('--no-build')) require('./build.js').build();

let anyFail = false;
const rows = [];
for (const g of GATES) {
  if (only && !only.includes(g.id)) continue;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [g.file], { cwd: __dirname, encoding: 'utf8', timeout: 300_000 });
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
console.log(anyFail ? '\nBATTERY: FAIL — never deliver red.' : '\nBATTERY: PASS');
process.exitCode = anyFail ? 1 : 0;
