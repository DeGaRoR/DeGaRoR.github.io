#!/usr/bin/env node
// G1882 (DMG-FLOATTO): THE COST - the pilot's update (ap.update) and the solver's step (sim.step), timed apart, per core,
// in ALTERNATING child processes (A B A B ...: the machine's drift falls on both sides alike); each process flies a case
// for its frames and reports the median ms of each call; the side's figure is the median of its processes' medians.
// Cases:
//   water   the twin on floats' take-off run on the SEA lane, 3 m/s across (--wind=: G1880's law armed: the case it costs in)
//   land    the user's Cub's take-off from HOME (the law never armed: the base's pilot)
//   air     the metal Cessna in level flight on THE PILOT (the step's air case)
//   ground  the metal Cessna's take-off roll from HOME (the step's ground case)
//   damage  each case's def.params.damage (off: the game's default; on: GATE TREECRASH's layer)
//   node tools/dmgfloatto_perf.js --a=<core A> --b=<core B> [--procs=15] [--frames=600] [--cases=water,land,air,ground] [--damage=off,on] [--json=<file>]
'use strict';
const path = require('path'), cp = require('child_process'), fs = require('fs');
const ARGS = process.argv.slice(2);
const arg = (k, d) => { const a = ARGS.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

const CHILD = arg('child', null);
if (CHILD) {
  const [core, cas, dmg, frames, wnd] = CHILD.split('|');
  const abs = path.resolve(core); require(abs); require.cache[path.join(__dirname, 'flight_core.js')] = require.cache[abs];
  const C = require(path.join(__dirname, 'flight_core.js'));
  const LB = require(path.join(__dirname, '_load_build.js'));
  const key = cas === 'water' ? 'twinFloats' : cas === 'land' ? 'cub' : 'metal';
  const d0 = C.buildGen(C.genMigrateSpec(LB.loadValidated(key).spec));
  const def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage: dmg === 'on' }) });
  const world = C.makeWorld();
  if (cas === 'water' && +(wnd ?? 3)) world.setWind({ base: [+(wnd ?? 3), 0, 0], gust: 0 });
  const a = cas === 'water' ? world.aerodromes.find(x => x.id === 'SEA') : world.aerodromes[0];
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, a);
  const ap = C.makePilot(sim, def, world); ap.setRoute(a, a);
  // warm: the air case flies until CLIMB first (the take-off is not what it times); the others start at the hold
  let n = 0;
  if (cas === 'air') while (ap.phase !== 'CLIMB' && n++ < 120 * 60) { ap.update(1 / 60); sim.step(1 / 60); }
  else for (let i = 0; i < 30; i++) { ap.update(1 / 60); sim.step(1 / 60); }
  const tu = [], ts = [], N = +frames;
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint(); ap.update(1 / 60); const t1 = process.hrtime.bigint(); sim.step(1 / 60); const t2 = process.hrtime.bigint();
    tu.push(Number(t1 - t0) / 1e6); ts.push(Number(t2 - t1) / 1e6);
  }
  const med = x => { const s = x.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
  process.stdout.write('RESULT ' + JSON.stringify({ update: med(tu), step: med(ts), phase: ap.phase, armed: ap.thrCap != null }) + '\n');
  process.exit(0);
}

const A = path.resolve(arg('a')), B = path.resolve(arg('b'));
const PROCS = +arg('procs', 15), FRAMES = +arg('frames', 600);
const CASES = arg('cases', 'water,land,air,ground').split(','), DMG = arg('damage', 'off').split(',');
const med = x => { const s = x.slice().sort((p, q) => p - q); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const one = (core, cas, dmg) => { const so = cp.execFileSync(process.execPath, [__filename, `--child=${core}|${cas}|${dmg}|${FRAMES}|${arg('wind', 3)}`], { maxBuffer: 1 << 26 }).toString(); return JSON.parse(so.split('\n').find(l => l.startsWith('RESULT ')).slice(7)); };
const out = {};
for (const dmg of DMG) for (const cas of CASES) {
  const ra = [], rb = [];
  for (let i = 0; i < PROCS; i++) { const first = i % 2 ? B : A; const r1 = one(first, cas, dmg), r2 = one(first === A ? B : A, cas, dmg); (first === A ? ra : rb).push(r1); (first === A ? rb : ra).push(r2); }
  const row = { update: [med(ra.map(r => r.update)), med(rb.map(r => r.update))], step: [med(ra.map(r => r.step)), med(rb.map(r => r.step))] };
  out[`${cas}:${dmg}`] = row;
  const pc = (x, y) => ((y / x - 1) * 100).toFixed(1).padStart(5) + ' %';
  console.log(`${cas.padEnd(5)} damage ${dmg.padEnd(3)}  pilot update ${row.update[0].toFixed(4)} -> ${row.update[1].toFixed(4)} ms (${pc(row.update[0], row.update[1])})   step ${row.step[0].toFixed(4)} -> ${row.step[1].toFixed(4)} ms (${pc(row.step[0], row.step[1])})   [${ra[0].phase} / ${rb[0].phase}]`);
}
console.log(`(A ${A}, B ${B}; ${PROCS} processes a side, alternating, ${FRAMES} frames each; medians of the processes' medians)`);
if (arg('json', null)) fs.writeFileSync(arg('json'), JSON.stringify({ A, B, PROCS, FRAMES, out }, null, 1));
