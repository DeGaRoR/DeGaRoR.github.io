#!/usr/bin/env node
// G1807 DMG-PLOUGH: trace a floatplane's take-off on the SEA lane (THE PILOT): speed, Fn, pitch, the drafts at the
// bow / step / stern, the wave term's readings. node tools/dmgplough_trace.js <twin|cessna> [wind] [--core=<path>] [--every=0.25] [--kWave=x]
'use strict';
const path = require('path'), fs = require('fs');
const ARGS = process.argv.slice(2);
const arg = (k, d) => { const a = ARGS.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const C = require(arg('core', path.join(__dirname, 'flight_core.js')));
const L = require(path.join(__dirname, '_treecrash_lib.js'));
const key = ARGS[0] || 'twin', wind = +(ARGS[1] || 0), every = +arg('every', 0.25);
function defOf(key) {
  let def;
  if (key === 'twin') {
    const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'build_v7_ultralight_2026-09-05.json'), 'utf8')).spec;
    spec.gear.type = 'floats';
    def = C.buildGen(C.genMigrateSpec(spec));
  } else def = L.defOf('floats', { elastic: true });
  def = Object.assign({}, def, { params: Object.assign({}, def.params) });
  const kw = arg('kWave', null);
  if (kw != null) def.parts = Object.assign({}, def.parts, { floats: def.parts.floats.map(r => Object.assign({}, r, { P: Object.assign({}, r.P, { kWave: +kw }) })) });
  // INSTRUMENT (not a build change): --thrustAt=upHi applies the thrust at the nose frame's upper nodes (0.17 m over
  // the twin's CG) instead of the engines (0.57 m over it) - is the plough nose-down the thrust couple?
  const ta = arg('thrustAt', null);
  if (ta) def.refs = Object.assign({}, def.refs, { engine: def.refs[ta].slice(0, def.refs.engine.length) });
  return def;
}
const def = defOf(key);
const world = C.makeWorld();
if (wind) world.setWind({ base: [wind, 0, 0], gust: 0 });
const sea = world.aerodromes.find(a => a.id === 'SEA');
const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
const ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea);
const P = def.parts.floats[0].P;
console.log(`${key}: float L ${P.L} xs ${P.xs} B ${P.B} H ${P.H} mass ${def.params.gen && def.params.gen.mass} Vs ${def.params.gen.Vs}`);
const pitchOf = s => Math.asin(Math.max(-1, Math.min(1, -s.axes()[0][1]))) * 180 / Math.PI;
let T = 0, minP = 0, maxP = -99;
for (let s = 0; s < 60 * 60; s++) {
  ap.update(1 / 60);
  // INSTRUMENT (not the pilot): --thrCap=c --capUntil=V holds the throttle at c until the speed through the water passes V
  { const cap = arg('thrCap', null), vv = sim.cgVel(); if (cap != null && Math.hypot(vv[0], vv[2]) < +arg('capUntil', 6)) sim.ctl.thr = Math.min(sim.ctl.thr, +cap); }
  sim.step(1 / 60); T += 1 / 60;
  const fx = sim.hydro.floats[0], F = fx.F, o = fx.out, W = o.W, d = o.d;
  const v = sim.cgVel(), V = Math.hypot(v[0], v[2]), pit = pitchOf(sim);
  const wet = sim.hydro.floats.reduce((a, x) => a + x.wet, 0);
  if (wet && T > 1) { minP = Math.min(minP, pit); maxP = Math.max(maxP, pit); }
  if (Math.abs(T / every - Math.round(T / every)) < 1e-6) {
    const sta = F.sta, bow = d[sta[0].K], dk = d[F.edge.K], st = d[F.stern.K];
    let maxD = -9; for (const q of sta) maxD = Math.max(maxD, d[q.K]);
    const wv = o.wave || {};
    console.log(`t ${T.toFixed(2)} ${ap.phase.padEnd(8)} V ${V.toFixed(2)} Fn ${(V / Math.sqrt(9.81 * P.L)).toFixed(2)} pitch ${pit.toFixed(2)} thr ${sim.ctl.thr.toFixed(2)} de ${(sim.ctl.de||0).toFixed(2)} d(bow ${bow.toFixed(3)} step ${dk.toFixed(3)} stern ${st.toFixed(3)} max ${maxD.toFixed(3)}) wetF ${o.wetF.toFixed(2)} wetA ${o.wetA.toFixed(2)} vent ${o.vent.toFixed(2)} wet ${wet.toFixed(2)}` + (wv.a != null ? ` wave a ${wv.a.toFixed(3)} Fn ${wv.Fn.toFixed(2)} env ${wv.env.toFixed(2)}` : ''));
  }
  if (ap.phase === 'CLIMB' || !Number.isFinite(V)) break;
}
console.log(`pitch on the water: ${minP.toFixed(2)} .. ${maxP.toFixed(2)} deg`);
