#!/usr/bin/env node
// join_parity_shift.js (G1985, JOIN-PARITY) - WHAT MOVES when node flies the game's aeroplane instead of the file as
// written: for each validated build, the pre-G1985 def (buildGen on the file) against tools/_load_build.js's (the
// page's load chain) - the structure, the mass, the CG and the margin, the engine's station, the tanks, the stall, the
// take-off run the shakedown predicts, the propeller's clearance settled on the gear (DMG-DRIVE's open question 2).
//
//   node tools/join_parity_shift.js [--only metal,cub] [--json out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const T = __dirname, FLY = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
const LB = require(path.join(T, '_load_build.js'));
const TL = require(path.join(T, '_treecrash_lib.js'));
const KEYS = opt('only', Object.keys(LB.VALIDATED).join(',')).split(',');
const clone = o => JSON.parse(JSON.stringify(o));

function rawSpec(k) {
  const B = LB.VALIDATED[k];
  let j = JSON.parse(fs.readFileSync(path.join(FLY, B.build), 'utf8'));
  if (B.patch) j = B.patch(j);
  return C.genMigrateSpec(j.spec || j);
}
// the disc's lowest point over flat ground, the aeroplane settled 12 s on its gear, brakes on, idle
function propClear(def) {
  const S = def.spec, R = (S.prop && S.prop.D) / 2;
  const e = def.refs.engine || [];
  if (!(R > 0) || !e.length) return null;
  const { W, strip } = TL.flatWorld(0);
  const d2 = Object.assign({}, def, { params: Object.assign({}, def.params, { damage: false }) });
  const sim = C.makeSim(d2, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0 }));
  sim.ctl.thr = 0; sim.ctl.brake = 1;
  for (let f = 0; f < 60 * 12; f++) sim.step(1 / 60);
  const P = i => [sim.p[i * 3], sim.p[i * 3 + 1], sim.p[i * 3 + 2]];
  const tag = t => def.nodes.findIndex(n => n.tag === t);
  const mid = ix => [0, 1, 2].map(k => ix.reduce((s, i) => s + P(i)[k], 0) / ix.length);
  const rings = def.nodes.map(n => n.tag).filter(t => /^S\d+BL$/.test(t)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  const ring = s => ['BL', 'BR', 'TL', 'TR'].map(q => tag(s + q)).filter(i => i >= 0);
  const nose = mid(ring(rings[0].slice(0, -2))), tail = mid(ring(rings[rings.length - 1].slice(0, -2)));
  const ax = nose.map((v, k) => v - tail[k]), l = Math.hypot(...ax), n = ax.map(v => v / l);
  // a wing pair: the lower disc
  const hubs = e.length === 2 && Math.abs(def.nodes[e[0]].p[2] - def.nodes[e[1]].p[2]) > 1 ? [[e[0]], [e[1]]] : [e];
  let low = Infinity;
  for (const h of hubs) low = Math.min(low, mid(h)[1] - R * Math.sqrt(1 - n[1] * n[1]));
  return { low, pitch: Math.asin(n[1]) * 180 / Math.PI };
}
function facts(def) {
  const sh = C.genShakedown(def, { slim: true });
  let m = 0, cx = 0, cy = 0;
  for (const nd of def.nodes) { m += nd.m; cx += nd.p[0] * nd.m; cy += nd.p[1] * nd.m; }
  const e = def.refs.engine || [];
  const pc = propClear(def);
  const S = def.spec;
  return { n: def.nodes.length, nb: def.beams.length, mass: m, cgM: [cx / m, cy / m], engX: e.length ? def.nodes[e[0]].p[0] : null,
    cgX: sh.cgX, npX: sh.npX, margin: sh.staticMargin, Vs: sh.Vs, TORun: sh.TORun, climb: sh.climbRate,
    fuelL: S.fuel && S.fuel.litres, tank: (S.energy.vessels || []).map(v => v.capacity + ' L ' + v.bay + (v.dims ? ' ' + v.dims.L + 'x' + v.dims.W + 'x' + v.dims.H : '')).join(', '),
    glazedM2: S.cabin.glazedM2, propLow: pc && pc.low, pitch: pc && pc.pitch };
}
const f = (v, n) => v == null || !isFinite(v) ? '-' : (+v).toFixed(n);
const out = {};
for (const k of KEYS) {
  const a = facts(C.buildGen(rawSpec(k))), b = facts(C.buildGen(clone(LB.loadValidated(k).spec)));
  out[k] = { asWritten: a, game: b };
  console.log('== ' + LB.VALIDATED[k].label + ' (' + LB.VALIDATED[k].build + ')');
  const row = (lab, x, y, n, unit) => console.log('   ' + lab.padEnd(26) + f(x, n).padStart(10) + ' -> ' + f(y, n).padEnd(10) +
    (typeof x === 'number' && typeof y === 'number' ? ' (' + (y - x >= 0 ? '+' : '') + f(y - x, n) + ')' : '') + (unit ? ' ' + unit : ''));
  row('nodes', a.n, b.n, 0); row('members', a.nb, b.nb, 0);
  row('mass', a.mass, b.mass, 2, 'kg');
  row('CG x (model frame)', a.cgM[0], b.cgM[0], 3, 'm'); row('CG y (model frame)', a.cgM[1], b.cgM[1], 3, 'm');
  row('engine node x', a.engX, b.engX, 3, 'm');
  row('shakedown cgX', a.cgX, b.cgX, 3, 'm'); row('neutral point npX', a.npX, b.npX, 3, 'm');
  row('static margin', a.margin, b.margin, 3);
  row('Vs', a.Vs, b.Vs, 2, 'm/s'); row('take-off run (shakedown)', a.TORun, b.TORun, 0, 'm'); row('climb rate', a.climb, b.climb, 2, 'm/s');
  row('fuel litres', a.fuelL, b.fuelL, 0, 'L');
  console.log('   ' + 'tanks'.padEnd(26) + a.tank + ' -> ' + b.tank);
  row('glazed area', a.glazedM2, b.glazedM2, 3, 'm2');
  row('prop disc low point, settled', a.propLow * 100, b.propLow * 100, 1, 'cm over the ground');
  row('stance pitch, settled', a.pitch, b.pitch, 2, 'deg');
}
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
