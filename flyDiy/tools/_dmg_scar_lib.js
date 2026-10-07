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
// elev: the flat world's ground (atTrunk flies at 300 m, the drops and the nose-over at 0). G2382: the 30 m/s crashes and
// the stump run 12 s (were 8): the wreck comes to rest in the run (a loose wheel rolled on to 8 s), its rest's hulls sealed
const CASES = [
  { id: 'taxi', label: 'a 3 m/s taxi into a trunk', elev: 300, run: (k, o) => L.atTrunk(k, Object.assign({ D: 4, V: 3, thr: 0, secs: 8 }, o)) },
  { id: 'noseover', label: 'a nose-over at 4 m/s', elev: 0, run: (k, o) => require('./_dmg_drive_lib.js').noseOver(k, Object.assign({ V: 4, secs: 8 }, o)) },
  { id: 'fly0', label: '30 m/s into a trunk, the centreline', elev: 300, run: (k, o) => L.atTrunk(k, Object.assign({ D: 40, agl: 4, V: 30, thr: 0, secs: 12 }, o)) },
  { id: 'fly25', label: '30 m/s into a trunk, 2.5 m out', elev: 300, run: (k, o) => L.atTrunk(k, Object.assign({ D: 40, agl: 4, V: 30, thr: 0, secs: 12, off: 2.5 }, o)) },
  { id: 'drop', label: 'a drop onto the wheels at 10 ft/s (FAR 23.473 cap)', elev: 0, run: (k, o) => L.hardLanding(k, Object.assign({ sink: 0.3048 * 10, frames: 240 }, o)) },
  { id: 'drop6', label: 'a severe drop onto the wheels at 6 m/s', elev: 0, run: (k, o) => L.hardLanding(k, Object.assign({ sink: 6, frames: 300 }, o)) },
  // G2382 (DMG-SCAR2): the coordinator's runway nose-over - taxied at 12 m/s into a stump 35 cm high (the standard trunk's
  // 0.3 m radius), the ground PAVED everywhere (world.SURFACE 5: a scuff, no bowl, no furrow)
  { id: 'stump', label: 'a 12 m/s taxi into a 35 cm stump, on the runway (paved)', elev: 300, hard: true, run: (k, o) => L.atTrunk(k, Object.assign({ D: 8, V: 12, thr: 0, secs: 12, trunk: { r: 0.3, h: 0.35, sink: 0 }, surface: 5 }, o)) },
];
// G2382: the six cases of the box stills (7 Oct) - the 30 m/s trunk 2.5 m out and the runway's 12 m/s nose-over, each build
const STILLS = ['fly25', 'stump'];

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
  const rest = restOf(key, sim, elev);
  return { key, id: c.id, label: c.label, elev, prims: S.prims, v: S.v, bytes: S.prims.length ? JSON.stringify(S.prims).length : 0,
    rec: R ? { hits: R.hits, frames: R.frames, seals: R.seals, ms: R.ms } : null, frames,
    crashed: Dm.crashed, breaks: Dm.breaks, reason: Dm.reason, over: Dm.over, strike: dr ? dr.strike : null, crushOn: dr ? dr.crushOn : null,
    contacts, cg, hubs, wallMs, sim, r, R: (sim.def && sim.def.params) || null, rest };
}
// G2382: THE WRECK AS IT LIES at the run's end, the gate's own reading: its pieces (the nodes joined by members not broken -
// a union-find of its own over the build's beams less sim.damage().broken), each piece's nodes whose bottom is within
// `hLow` (the core's hSweep, 1.2 m) of the flat ground, their convex hull (gift wrapping - not the core's monotone chain)
function restOf(key, sim, elev, hLow) {
  const def = L.defOf(key), n = def.nodes.length, par = [], br = new Set(sim.damage().broken || []);
  hLow = hLow == null ? 1.2 : hLow;
  for (let i = 0; i < n; i++) par.push(i);
  const f = i => (par[i] === i ? i : (par[i] = f(par[i])));
  def.beams.forEach((b, j) => { if (!br.has(j)) { const a = f(b.a), c = f(b.b); if (a !== c) par[a] = c; } });
  const by = {};
  for (let i = 0; i < n; i++) { if (sim.p[i * 3 + 1] - (def.nodes[i].r || 0) - elev > hLow) continue; (by[f(i)] = by[f(i)] || []).push([sim.p[i * 3], sim.p[i * 3 + 2]]); }
  const pieces = Object.values(by).map(pts => ({ n: pts.length, pts, hull: wrap(pts) })).sort((a, b) => b.n - a.n);
  return { pieces };
}
function wrap(pts) {
  if (pts.length < 3) return pts.slice();
  let s = 0; for (let i = 1; i < pts.length; i++) if (pts[i][0] < pts[s][0] || (pts[i][0] === pts[s][0] && pts[i][1] < pts[s][1])) s = i;
  const out = []; let a = s;
  for (let it = 0; it <= pts.length; it++) {
    out.push(pts[a]); let b = (a + 1) % pts.length;
    for (let c = 0; c < pts.length; c++) { const cr = (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
      if (cr < 0 || (cr === 0 && Math.hypot(pts[c][0] - pts[a][0], pts[c][1] - pts[a][1]) > Math.hypot(pts[b][0] - pts[a][0], pts[b][1] - pts[a][1]))) b = c; }
    a = b; if (a === s) break;
  }
  return out;
}
// the area of a polygon [[x, z], ...] (shoelace)
const polyArea = P => { let a = 0; for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; a += P[i][0] * P[j][1] - P[j][0] * P[i][1]; } return Math.abs(a) / 2; };
module.exports = { BUILDS, CASES, STILLS, runCase, restOf, wrap, polyArea };
