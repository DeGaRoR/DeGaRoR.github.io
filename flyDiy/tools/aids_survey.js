#!/usr/bin/env node
// aids_survey.js - DESIGN-AIDS: the certificate's tiers over a set of builds. Per build, the airworthiness verdict
// BEFORE (master's rule: every design-check fail rejects; the circuit bar is climb + the 1100 m take-off) and AFTER
// (only a safe-tier fail rejects - the promoted float step, float reserve and prop clearance included, the tail volumes,
// the elevator and the flare commercial -; a float build's circuit is the climb, its take-off the hydroplane run), the
// hydroplane run on float builds (the bench's gating 'hydro' row, flown headless as app.js htStart / htPoll fly it),
// and the commercial verdict. Prints a markdown table; CHANGED marks a build whose airworthiness verdict moved.
//   node flyDiy/tools/aids_survey.js <build.json> [...]      (a cage build is baked as the page would: _bake_joined)
'use strict';
const path = require('path'), fs = require('fs');
const C = require('./flight_core.js'), BJ = require('./_bake_joined.js');
BJ.loadPanel();
global.genCertTiers = C.genCertTiers;
const BN = require('../src/viewer/bench.js');
// the hydroplane run: lifts off (both floats dry, > 12 m/s) inside 75 s, the pilot's own water technique
function hydro(def) {
  const world = C.makeWorld(), sea = (world.aerodromes || []).find(a => a.kind === 'water');
  if (!sea) return { none: true };
  const s = C.makeSim(def, world); s.reset(0); C.placeAtAerodrome(s, sea);
  const ap = C.makePilot(s, def, world); ap.setRoute(sea, sea);
  let t = 0, lift = null, wetLast = 1, bad = false;
  while (t < 75) {
    ap.update(1 / 60); s.step(1 / 60); t += 1 / 60;
    if (s.stats().bad) { bad = true; break; }
    const v = s.cgVel(), V = Math.hypot(v[0], v[2]);
    let wet = 0; for (const x of s.hydro.floats) wet += x.wet;
    if (wet === 0 && wetLast > 0 && V > 12 && !lift) lift = t;
    wetLast = wet;
    if (lift && t > lift + 2) break;
    if (ap.phase === 'ABORT' || ap.phase === 'STOPPED') break;
  }
  return { ok: !!lift && !bad, t: lift };
}
const rows = [];
for (const f of process.argv.slice(2)) {
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8')), s0 = j.spec || j;
    const B = s0.cage ? BJ.bakeJoined(s0) : null, J = B ? B.spec : s0;
    const def = C.buildGen(J), sh = C.genShakedown(def, { corners: false });
    const A = C.genDesignAids(def, sh, { propOff: B ? C.genAidPropOff(B.W && B.W.CAGE_ENG) : null });
    const all = sh.design.rows.concat(A.rows), T = C.genCertTiers(all);
    const floats = !!(def.parts && def.parts.floats && def.parts.floats.length);
    const H = floats ? hydro(def) : null;
    const oldFail = sh.design.rows.filter(r => r.level === 'fail').map(r => r.id);
    const oldFly = !!sh.flyableCircuit, newFly = BN.benchCircuit(sh, floats).flies;
    const before = oldFly && !oldFail.length && (!H || H.ok);
    const after = newFly && T.safe !== 'fail' && (!H || H.ok);
    const why = (fly, fails) => [].concat(fly ? [] : ['circuit'], fails, H && !H.ok ? ['hydro'] : []).join(', ');
    rows.push({ f: path.basename(f), sm: (sh.staticMargin * 100).toFixed(0), to: sh.TORun,
      hydro: H ? (H.none ? 'no sea' : H.ok ? 'off in ' + Math.round(H.t) + ' s' : 'STAYS ON') : '-',
      before: before ? 'certifies' : 'refused (' + why(oldFly, oldFail) + ')',
      after: (after ? 'certifies' + (T.warns.length ? ' + ' + T.warns.length + ' warn' : '') : 'refused (' + why(newFly, T.safeFail.map(r => r.id)) + ')'),
      changed: before !== after ? (after ? 'CHANGED: now certifies' : 'CHANGED: now refused') : '',
      comm: (after ? T.comm : 'fail') + (T.commFail.length ? ' (' + T.commFail.map(r => r.id).join(', ') + ')' : '') });
  } catch (e) { rows.push({ f: path.basename(f), sm: '-', to: '-', hydro: '', before: 'error: ' + String(e.message).slice(0, 60), after: '', changed: '', comm: '' }); }
}
console.log('| build | margin % | take-off m | hydroplane | before (master) | after (the tiers) | | commercial |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.f} | ${r.sm} | ${r.to} | ${r.hydro} | ${r.before} | ${r.after} | ${r.changed} | ${r.comm} |`);
