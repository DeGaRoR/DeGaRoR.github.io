#!/usr/bin/env node
// GATE POD's flight (G2416, BELLY-POD): THE ACCEPTANCE LEG (72_accept, ACCEPT's own procedure) flown on a validated
// build with and without its belly pod, printed as one JSON line. The same flight as tools/_accept_fly.js's (the
// analytic world, calm, lined up at HOME, the pilot's own take-off; the AP box from the end of CLIMB; 5 min at 75 %
// throttle, HOME + 300 m), no way home.
//
//   node tools/_pod_fly.js <build> <off|on|full>     build: cub | jodel | c172 (the wheel builds ACCEPT flies)
//     off   the build as saved
//     on    the default pod fitted, empty (spec.pod = { on: 1 })
//     full  the default pod fitted and loaded to its rated load (loadKg = maxKg)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const L = require(path.join(T, '_treecrash_lib.js'));
const C = L.core();
const B = require(path.join(T, '..', 'src', 'viewer', 'bench.js'));
const FILES = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
                c172: 'builds/cessna172_2026-09-20_corrected.json' };

function specOf(build, mode) {
  const j = JSON.parse(fs.readFileSync(path.join(T, '..', FILES[build]), 'utf8'));
  const spec = j.spec || j;
  if (mode === 'off') return spec;
  spec.pod = { on: 1 };
  if (mode === 'full') {
    const d = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
    spec.pod.loadKg = d.parts.pod.maxKg;
  }
  return spec;
}

function fly(build, mode) {
  const wall0 = Date.now();
  const spec = specOf(build, mode);
  const fp = B.benchFingerprint(spec, null);
  const def0 = C.buildGen(C.genMigrateSpec(spec));
  const def = Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: false }), cert: null });
  const sh = C.genShakedown(def, { corners: false });
  const W = C.makeWorld();
  const HOME = W.aerodromes[0];
  const sim = C.makeSim(def, W); sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, W);
  const L_ = C.acceptLegStart(sim, ap, def, { fieldElev: HOME.elev || 0, resume: 'auto',
    legMin: process.env.POD_FLY_LEGMIN ? +process.env.POD_FLY_LEGMIN : undefined, meta: { fp, when: '2026-10-07', from: HOME.id } });
  let n = 0, bad = false;
  const step = () => { ap.update(1 / 60); sim.step(1 / 60); if (sim.stats().bad) bad = true; };
  while (!bad && ap.phase !== 'CROSSWIND' && n++ < 60 * 300) step();
  n = 0;
  while (!bad && L_.stage !== 'done' && L_.stage !== 'aborted' && n++ < 60 * 1200) { L_.tick(sim, ap); step(); }
  const m = L_.result || L_.rec.result();
  return { build, mode, bad, stage: L_.stage, fp,
           massKg: +sim.totalM.toFixed(1), podKg: def.parts.pod ? def.parts.pod.loadKg : 0,
           shake: { VCruiseKmh: +(sh.VCruise * 3.6).toFixed(1), rangeKm: sh.rangeKm, climbRate: sh.climbRate,
                    pod: sh.pod ? { cda: sh.pod.cda, cruise: sh.pod.cruise } : null },
           leg: m ? { valid: !!m.valid, why: m.why || [], tasKmh: m.tasKmh, flow: m.flow, enduranceMin: m.enduranceMin,
                      rangeKm: m.rangeKm, grossMin: m.grossMin } : null,
           sig: L_.record ? L_.record.sig : null, wallMs: Date.now() - wall0 };
}

if (require.main === module) {
  const [build, mode] = process.argv.slice(2);
  if (!FILES[build] || !['off', 'on', 'full'].includes(mode)) { console.error('usage: _pod_fly.js <cub|jodel|c172> <off|on|full>'); process.exit(2); }
  console.log(JSON.stringify(fly(build, mode)));
}
module.exports = { fly, FILES };
