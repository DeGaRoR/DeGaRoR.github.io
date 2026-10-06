// G2357-G2360 (DMG-SCAR): the standard crashes GATE DMGSCAR (_dmg_scar_check.js) and its evidence (dmg_scar_evidence.js)
// fly, on the user's validated builds, node only - TREE-CRASH's (tools/_treecrash_lib.js atTrunk: the 3 m/s taxi into a
// trunk, the 30 m/s flight into one on the centreline and 2.5 m out), DMG-DRIVE's nose-over (4 m/s) and the drops onto
// the wheels (FAR 23.473's cap, 10 ft/s; and a severe 6 m/s one) - each with the certificate stamped (the game's), each
// run long enough for the wreck to come to rest (the scar is sealed then), each with readers of its own on every frame:
// the ground's contacts by the gate's rule (a node that is not a wheel, its bottom at or under the ground), the CG's
// track. Returns the scar the solver sealed (sim.damage().scar), the record's counters (sim.damageScar()), the readings.
'use strict';
const L = require('./_treecrash_lib.js');

const BUILDS = ['cub', 'jodel', 'metal'];
// elev: the flat world's ground (atTrunk flies at 300 m, the drops and the nose-over at 0)
const CASES = [
  { id: 'taxi', label: 'a 3 m/s taxi into a trunk', elev: 300, run: (k, o) => L.atTrunk(k, Object.assign({ D: 4, V: 3, thr: 0, secs: 8 }, o)) },
  { id: 'noseover', label: 'a nose-over at 4 m/s', elev: 0, run: (k, o) => require('./_dmg_drive_lib.js').noseOver(k, Object.assign({ V: 4, secs: 8 }, o)) },
  { id: 'fly0', label: '30 m/s into a trunk, the centreline', elev: 300, run: (k, o) => L.atTrunk(k, Object.assign({ D: 40, agl: 4, V: 30, thr: 0, secs: 8 }, o)) },
  { id: 'fly25', label: '30 m/s into a trunk, 2.5 m out', elev: 300, run: (k, o) => L.atTrunk(k, Object.assign({ D: 40, agl: 4, V: 30, thr: 0, secs: 8, off: 2.5 }, o)) },
  { id: 'drop', label: 'a drop onto the wheels at 10 ft/s (FAR 23.473 cap)', elev: 0, run: (k, o) => L.hardLanding(k, Object.assign({ sink: 0.3048 * 10, frames: 240 }, o)) },
  { id: 'drop6', label: 'a severe drop onto the wheels at 6 m/s', elev: 0, run: (k, o) => L.hardLanding(k, Object.assign({ sink: 6, frames: 300 }, o)) },
];

// one case. opt: { cert (default true), scar: false (no record: params.scar), elastic (the layer off), onFrame }
function runCase(key, c, opt) {
  opt = opt || {};
  const refs = L.defOf(key).refs, wheel = new Uint8Array(L.defOf(key).nodes.length);
  for (const i of (refs.mains || [])) wheel[i] = 1; if (refs.tw != null && refs.tw >= 0) wheel[refs.tw] = 1;
  const contacts = [], cg = [], hubs = [], elev = c.elev, E = refs.engine || [];
  let frames = 0;
  const o = { cert: opt.cert !== false, scar: opt.scar, elastic: opt.elastic,
    onFrame: (sim, f) => {
      frames++;
      const t = sim.t;
      for (let i = 0; i < sim.n; i++) {
        if (wheel[i]) continue;
        if (sim.p[i * 3 + 1] - sim.r[i] <= elev + 0.005) contacts.push(sim.p[i * 3], sim.p[i * 3 + 2], t, i);
      }
      const g = sim.cgPos(); cg.push(g[0], g[2], t);
      if (E.length) { let x = 0, z = 0; for (const i of E) { x += sim.p[i * 3]; z += sim.p[i * 3 + 2]; } hubs.push(x / E.length, z / E.length); }
      if (opt.onFrame) opt.onFrame(sim, f);
    } };
  const tA = process.hrtime.bigint();
  const r = c.run(key, o);
  const wallMs = Number(process.hrtime.bigint() - tA) / 1e6;
  const sim = L.lastRun.sim, Dm = sim.damage(), R = sim.damageScar ? sim.damageScar() : null;
  const S = Dm.scar || { v: 0, prims: [] }, dr = Dm.drive && Dm.drive[0];
  return { key, id: c.id, label: c.label, elev, prims: S.prims, v: S.v, bytes: S.prims.length ? JSON.stringify(S.prims).length : 0,
    rec: R ? { hits: R.hits, frames: R.frames, seals: R.seals, ms: R.ms } : null, frames,
    crashed: Dm.crashed, breaks: Dm.breaks, reason: Dm.reason, over: Dm.over, strike: dr ? dr.strike : null, crushOn: dr ? dr.crushOn : null,
    contacts, cg, hubs, wallMs, sim, r, R: (sim.def && sim.def.params) || null };
}
module.exports = { BUILDS, CASES, runCase };
