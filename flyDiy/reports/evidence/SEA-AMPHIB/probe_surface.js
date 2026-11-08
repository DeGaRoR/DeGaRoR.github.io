// SEA-AMPHIB (test tool): THE SURFACE PHYSICS OF THE AMPHIBIANS, PLACED - NOT THE GAME (the game's route never puts a
// float build on land: stripAllows refuses it; a placed plane is a physics probe, said as such).
//  A. ON THE RUNWAY (HOME 13/31, placeAtAerodrome, damage ON): settle 10 s, then full throttle, brakes off, 30 s, the
//     controls neutral. Reads: what touches (wheelsOnGround, the lowest nodes' tags), the distance and speed reached,
//     damage. The float Cessna with fltAmph 1 (Wipline wheels DRAWN) and the Super Petrel V4.1 (the hull amphibian).
//  B. ON THE WATER (SEA, placeAtAerodrome): the Petrel gear DOWN vs gear UP (sim.ctl.gear, the retract's own input),
//     full throttle 25 s. Reads: sim.wetBody (the wheeled-aeroplane water model, 32_hydro wetBuild - the tyres' plough),
//     out.gear, the speed at 10 / 25 s, the CG track. Same run down and up = the water does not see the wheels.
//   node reports/evidence/SEA-AMPHIB/probe_surface.js [--root <flyDiy dir>]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), oi = argv.indexOf('--root');
const R = oi >= 0 ? path.resolve(argv[oi + 1]) : path.join(__dirname, '..', '..', '..'), T = path.join(R, 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const LB = require(path.join(T, '_load_build.js'));
const W = TR.tourWorld(C, IN, fs).W, A = id => W.aerodromes.find(q => q.id === id);
const r2 = v => Math.round(v * 100) / 100;
function mk(file) {
  const g = LB.gameSpec(JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(R, file), 'utf8')));
  const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(g) : g); def.params = Object.assign({}, def.params, { damage: true });
  return { g, def };
}
function place(def, at) { const s = C.makeSim(def, W); s.reset(0); if (s.stance) s.stance(); C.placeAtAerodrome(s, A(at)); return s; }
const steps = (s, sec, f) => { for (let i = 0; i < sec * 60; i++) { if (f) f(s, i); s.step(1 / 60); } };
const Vg = s => { const v = s.cgVel(); return Math.hypot(v[0], v[2]); };
function touching(s, def) {
  const out = [];
  for (let i = 0; i < s.n; i++) { const gap = s.p[i * 3 + 1] - (s.r[i] || 0) - W.terrainH(s.p[i * 3], s.p[i * 3 + 2]); if (gap < 0.03) out.push((def.nodes[i].tag || def.nodes[i].name || '#' + i)); }
  return out;
}
const full = s => { s.ctl.thr = 1; s.ctl.brake = 0; if (s.ctl.eng) s.ctl.eng = s.ctl.eng.map ? s.ctl.eng.map(() => 1) : s.ctl.eng; };
console.log('A. ON THE RUNWAY (HOME), placed');
for (const [name, file] of [['float Cessna fltAmph 1', path.join(__dirname, 'cessna_floats_amph1.json')], ['Super Petrel V4.1', 'builds/candidates/superpetrel_V4_1.json']]) {
  if (!fs.existsSync(path.isAbsolute(file) ? file : path.join(R, file))) { console.log('  ' + name + ': no file on this tree'); continue; }
  const { g, def } = mk(file), s = place(def, 'HOME');
  steps(s, 10);
  const t = touching(s, def), c0 = s.cgPos(), wog = s.wheelsOnGround();
  steps(s, 30, full);
  const c1 = s.cgPos(), D = s.damage();
  const tags = {}; for (const q of t) { const k = String(q).replace(/\d+$/, ''); tags[k] = (tags[k] || 0) + 1; }
  console.log('  ' + name + ': stripGear ' + C.stripGear(g) + ', parts.amph ' + !!(def.parts && def.parts.amph) + ', retract ' + !!def.params.retract + ' | at rest: wheelsOnGround ' + wog + ', touching ' + JSON.stringify(tags) +
    ' | 30 s full throttle: moved ' + r2(Math.hypot(c1[0] - c0[0], c1[2] - c0[2])) + ' m, V ' + r2(Vg(s)) + ' m/s, wheelsOnGround ' + s.wheelsOnGround() + ', damage yields ' + D.yields + ' breaks ' + D.breaks + ' dented ' + !!D.dented + ' prop ' + !!D.propStrike);
}
console.log('B. THE PETREL ON THE WATER (SEA), placed: gear down vs up, full throttle');
{
  const file = 'builds/candidates/superpetrel_V4_1.json';
  if (fs.existsSync(path.join(R, file))) for (const gear of [1, 0]) {
    const { def } = mk(file), s = place(def, 'SEA');
    s.ctl.gear = gear; steps(s, 12);   // 12 s: the 6 s electric retract has run
    const g0 = s.out.gear, rec = {};
    let wbSeen = false;
    steps(s, 25, (s2, i) => { full(s2); if (s2.wetBody) wbSeen = true; if (i === 600) rec.v10 = r2(Vg(s2)); });
    rec.v25 = r2(Vg(s)); const cg = s.cgPos();
    console.log('  gear ' + (gear ? 'DOWN' : 'UP  ') + ': out.gear at the start ' + r2(g0) + ' | wetBody (the tyres\' water model) ever built: ' + wbSeen + ' | V 10 s ' + rec.v10 + ', 25 s ' + rec.v25 + ' m/s | CG ' + cg.map(r2) + ' | hull wet ' + (s.hydro ? s.hydro.floats.map(f => r2(f.wet)) : '-'));
  }
}
