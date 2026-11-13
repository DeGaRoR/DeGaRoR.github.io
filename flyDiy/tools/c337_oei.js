#!/usr/bin/env node
// c337_oei.js - THE SKYMASTER'S ENGINE-OUT CLIMB (13 Nov, FIT-PROCEDURE): the 337D Owner's Manual gives the sea-level
// rate of climb at 4400 lb on both engines (1200 fpm), the front engine only (300 fpm) and the rear engine only
// (385 fpm) - centreline thrust, so an engine out yaws by drag alone, and the rear engine alone climbs better. This
// flies the joined card at the manual's gross weight through the pilot's own departure, cuts one engine (its lever
// off: the solver's stopped disc, no thrust and no windmill drag - an ideally feathered prop) once the climb is
// established, and reads the steady climb rate at the pilot's own climb speed. The manual's best single-engine speed
// is 100 mph IAS; the pilot climbs at its own Vy - both are printed.
//
//   node tools/c337_oei.js <joined build.json> [--kg 1996]     -> both / front only / rear only, against the manual
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
const BJ = require(path.join(T, '_bake_joined.js'));
const { C } = BJ.loadPanel();
const { ballast } = require(path.join(T, '_perf_probe.js'));
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const kgArg = (() => { const i = args.indexOf('--kg'); return i >= 0 ? +args[i + 1] : 1996; })();
const ref = JSON.parse(fs.readFileSync(path.join(T, 'drafting', 'refs', 'c337.json'), 'utf8')).figures;
const spec = JSON.parse(fs.readFileSync(file, 'utf8')).spec;
const def = C.buildGen(spec);
const nE = def.params.nEngines || 1;

function climb(cut) {
  const world = C.makeWorld();
  const sim = C.makeSim(def, world); sim.reset(0);
  const sim0 = C.makeSim(def, null); sim0.reset(0);
  ballast(sim, Math.max(0, kgArg - sim0.totalM));
  for (let i = 0; i < 300; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world);
  let t0 = null, vs = 0, n = 0, V = 0, beta = 0, cutAt = null, outcome = null;
  for (let s = 0; s < 400 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase === 'CLIMB' && t0 == null) t0 = s;
    if (t0 != null && cut != null && cutAt == null && s - t0 > 10 * 60) {
      sim.ctl.eng = Array.from({ length: nE }, (_, i) => ({ on: i !== cut, thr: 1 }));
      cutAt = s;
    }
    const from = cutAt != null ? cutAt : t0;
    if (from != null && s - from > 20 * 60 && s - from < 60 * 60 && ap.phase === 'CLIMB') {
      vs += sim.out.vs; V += sim.out.V; beta += Math.abs(sim.out.beta || 0); n++;
    }
    if (from != null && s - from >= 60 * 60) break;
    if (sim.stats().bad) { outcome = 'nan'; break; }
  }
  return { n, vs: n ? vs / n : null, V: n ? V / n * 3.6 : null, beta: n ? beta / n * 180 / Math.PI : null, outcome: outcome || ap.phase };
}
const fpm = x => (x / 0.00508).toFixed(0);
const rows = [['both engines', null, ref['perf.roc'].v], ['front engine only', 1, ref['perf.rocFrontOnly'].v], ['rear engine only', 0, ref['perf.rocRearOnly'].v]];
console.log('THE 337 ENGINE-OUT CLIMB at ' + kgArg + ' kg (' + nE + ' engines: ' + (spec.engines || []).map(e => e.mount).join(' + ') + ')');
for (const [label, cut, real] of rows) {
  const r = climb(cut);
  const ok = r.vs != null;
  console.log('  ' + label.padEnd(18) + (ok ? (r.vs.toFixed(2) + ' m/s (' + fpm(r.vs) + ' fpm)').padEnd(22) : 'no climb read'.padEnd(22)) +
              ' manual ' + real.toFixed(2) + ' m/s (' + fpm(real) + ' fpm)' + (ok ? '  ' + ((r.vs / real - 1) * 100).toFixed(0) + ' %' : '') +
              (ok ? '   at ' + r.V.toFixed(0) + ' km/h TAS, |beta| ' + r.beta.toFixed(2) + ' deg' : '') + '  [' + r.outcome + ']');
}
console.log('  (the manual\'s best single-engine rate-of-climb speed: 100 mph IAS = 161 km/h; the cut engine\'s prop stops, no windmill drag)');
