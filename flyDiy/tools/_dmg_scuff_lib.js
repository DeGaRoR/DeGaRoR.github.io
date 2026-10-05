// G2005 (DMG-SCUFF): the cases GATE DMGSCUFF flies and the skin it reads, node only. The user's validated builds, damage
// ON (params.damage true) unless asked; the crashes of the brief - the 30 m/s trunk on the centreline, a 3 m/s taxi into
// a trunk, a nose-over (a 12 m/s taxi into a 35 cm stump, DMG-WALL's staging) - plus a WING-LOW SLIDE (the aeroplane
// rolled 25 degrees left onto its tip at 15 m/s: the scrape's own case) and an INTACT taxi (nothing touches).
// The skin: the generator's wing payload (genWing's groups: the covering, the surfaces, the struts) and every member as
// its tube (genBeamInto), in genRestFrame's frame, bound as the flown cage snapshot is (skin_break.make, cage: its
// nearest node, then the full binding where the damage is, riding whole) - and two synthetic PANES on the fuselage's
// top stations (the generator draws no glazing): the WINDSCREEN between stations 0 and 1, a REAR WINDOW between 3 and 4.
'use strict';
const path = require('path');
const L = require('./_treecrash_lib.js');
const ROOT = path.join(__dirname, '..');
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const SS = require(path.join(ROOT, 'src', 'viewer', 'skin_scuff.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));

const CASES = {
  intact: { label: 'an intact taxi at 5 m/s (nothing touches)', kind: 'taxi', o: { V: 5, secs: 3, trunk: null } },
  'trunk-0': { label: 'a trunk at 30 m/s, the centreline', kind: 'trunk', o: { D: 40, agl: 4, V: 30, secs: 5, off: 0, r: 0.3, h: 10.05 } },
  'taxi-3': { label: 'a 3 m/s taxi into a trunk', kind: 'trunk', o: { D: 6, agl: 0, V: 3, secs: 6, off: 0, r: 0.3, h: 10.05 } },
  noseover: { label: 'a nose-over (12 m/s into a 35 cm stump)', kind: 'trunk', o: { D: 8, agl: 0, V: 12, secs: 6, off: 0, r: 0.25, h: 0.35, stumpAtWheels: true } },
  'slide-L': { label: 'a wing-low slide (rolled 25 deg left onto the tip, 15 m/s)', kind: 'slide', o: { V: 15, roll: 25, sink: 0.8, secs: 3 } },
};

// the case's sim, staged (TREE-CRASH's atTrunk for the trunks; the slide rolled about the body's own axis)
function stage(k, c, damage) {
  const C = L.core(), o = c.o, d0 = L.defOf(k), def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage }) });
  const elev = 300, { W, TH, strip } = L.flatWorld(elev), sim = C.makeSim(def, W);
  sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
  if (c.kind === 'slide') {
    // roll about the body's longitudinal axis (xAft) through the CG, the left wing down; then down onto the tip
    const n = sim.n, p = sim.p, v = sim.v, [xA] = sim.axes(), c0 = sim.cgPos(), kk = xA, th = (o.roll || 25) * Math.PI / 180;
    // the left wing down: a rotation about +aft by -roll lowers +z-left... chosen by its effect: the left wing ends lower
    const rot = s => { const out = new Float64Array(n * 3); const cs = Math.cos(s), sn = Math.sin(s);
      for (let i = 0; i < n; i++) { const d = [p[i*3] - c0[0], p[i*3+1] - c0[1], p[i*3+2] - c0[2]], kd = kk[0]*d[0] + kk[1]*d[1] + kk[2]*d[2];
        const cr = [kk[1]*d[2] - kk[2]*d[1], kk[2]*d[0] - kk[0]*d[2], kk[0]*d[1] - kk[1]*d[0]];
        for (let j = 0; j < 3; j++) out[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + kk[j] * kd * (1 - cs); } return out; };
    const leftOf = i => /L$/.test(def.nodes[i].tag || '') ? 1 : /R$/.test(def.nodes[i].tag || '') ? -1 : 0;
    let P = rot(th), score = 0; for (let i = 0; i < n; i++) score += leftOf(i) * (P[i*3+1] - p[i*3+1]);
    if (score > 0) P = rot(-th);        // the left side must go DOWN
    let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, P[i*3+1] - def.nodes[i].r);
    for (let i = 0; i < n; i++) { p[i*3] = P[i*3]; p[i*3+1] = P[i*3+1] + (elev + 0.02 - yMin); p[i*3+2] = P[i*3+2];
      v[i*3] = o.V * fx; v[i*3+1] = -o.sink; v[i*3+2] = o.V * fz; }
    sim.ctl.thr = 0;
    return { sim, def, N: o.secs * 60 };
  }
  if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
  if (c.kind === 'trunk') {
    const c0 = sim.cgPos().slice(), off = o.off || 0;
    TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev, o.r, elev + o.h]);
  }
  sim.ctl.thr = 0;
  return { sim, def, N: o.secs * 60 };
}

// the skin: genWing's groups and the members' tubes (class by what they are), and the two panes
function skinOf(k) {
  const C = L.core(), d0 = L.defOf(k);
  const W = C.genWing(d0), FR = C.genRestFrame(d0), rest = W.rest;
  const M = C.genMesh(); for (const b of d0.beams) C.genBeamInto(M, b.cls === 'tail' ? Object.assign({}, b, { cls: 'fus' }) : b, d0.nodes, FR.to);
  const surf = C.genSurfKey(d0.spec, 'wing', 0), fabW = /fabric|steel|aluFabric/.test(surf), woodW = /ply|wood|spruce/.test(surf);
  const meshes = Object.keys(W.groups).map(nm => ({ nm, g: W.groups[nm], cls: /^(skin|ail|flap)/.test(nm) ? (fabW ? 1 : woodW ? 2 : 0) : 0 }));
  meshes.push({ nm: 'members', g: M.done(), cls: 0 });
  // the panes: a bilinear patch over four top station nodes, 3 cm out (up), 12 x 8 quads
  const tag = t => d0.nodes.findIndex(n => n.tag === t);
  const pane = (nm, a, b, c, d) => {
    const P = [a, b, c, d].map(i => FR.to(d0.nodes[i].p));
    const nu = 12, nw = 8, nv = (nu + 1) * (nw + 1), pos = new Float32Array(nv * 3), idx = [];
    for (let j = 0; j <= nw; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, w = j / nw, v = j * (nu + 1) + i;
      for (let q = 0; q < 3; q++) pos[v * 3 + q] = (1 - u) * (1 - w) * P[0][q] + u * (1 - w) * P[1][q] + (1 - u) * w * P[2][q] + u * w * P[3][q] + (q === 1 ? 0.03 : 0); }
    for (let j = 0; j < nw; j++) for (let i = 0; i < nu; i++) { const v = j * (nu + 1) + i; idx.push(v, v + 1, v + nu + 1, v + 1, v + nu + 2, v + nu + 1); }
    return { nm, g: { nv, nt: idx.length / 3, pos, idx: Uint32Array.from(idx) }, cls: SS.CLS.glass };
  };
  meshes.push(pane('windscreen', tag('S0TL'), tag('S0TR'), tag('S1TL'), tag('S1TR')));
  meshes.push(pane('rearWindow', tag('S3TL'), tag('S3TR'), tag('S4TL'), tag('S4TR')));
  // the body's rest axes in this frame (brkCage's rest basis, from the refs)
  const avg = ids => { const q = [0, 0, 0]; for (const i of ids) for (let j = 0; j < 3; j++) q[j] += rest[i * 3 + j] / ids.length; return q; };
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const R2 = d0.refs, t1 = avg(R2.noseFrame), t2 = avg(R2.tailMid), u1 = avg(R2.upLo), u2 = avg(R2.upHi);
  const B = { X0: nrm([t2[0] - t1[0], t2[1] - t1[1], t2[2] - t1[2]]), Y0: nrm([u2[0] - u1[0], u2[1] - u1[1], u2[2] - u1[2]]) };
  // which side is the LEFT in this frame: the mean of the L-tagged nodes against the R-tagged
  const lr = [0, 0, 0]; d0.nodes.forEach((nd, i) => { const s = /L$/.test(nd.tag || '') ? 1 : /R$/.test(nd.tag || '') ? -1 : 0; for (let j = 0; j < 3; j++) lr[j] += s * rest[i * 3 + j]; });
  return { d0, rest, meshes, B, left: nrm(lr), FR, mid: avg([].concat(R2.noseFrame, R2.tailMid)) };
}

// one run: the sim stepped, the hop applied (app.js's inline path), the records made at the first damage (cage style,
// riding whole), the break events, the riding and the tear (for the torn band), and the scuff's passes on each event,
// budgeted as the page runs them. Returns the state, the records and the costs
function run(k, caseId, opts) {
  const o = opts || {}, C = L.core(), c = CASES[caseId], damage = o.damage !== false;
  const SK = o.skin || skinOf(k), { d0, rest, meshes, B } = SK, n = d0.nodes.length;
  const { sim, def, N } = stage(k, c, damage);
  const T = SB.topo(d0.beams, n), core = d0.refs.noseFrame[0];
  const hop = SH.simDmgHop0(), D = SV.simViewDmgState(n, d0.beams.length);
  const st = SS.state(), NF = {}, live = new Float32Array(n * 3);
  let recs = null, Fl = null, vB = 0, vS = 0, payloads = 0, passes = 0, frameMax = 0, bound = 0, recMs = 0;
  const mk = () => {
    const t0 = process.hrtime.bigint();
    recs = meshes.map(m => {
      const g = { nv: m.g.nv, idx: Uint32Array.from(m.g.idx) };
      const R = SB.make(g, SB.NEAR_K, { cage: true, pos: m.g.pos, rest, rideAll: true, fabric: m.cls === 1 });
      const nrm = SS.restNormals(m.g.pos, m.g.idx, m.g.nv, null);
      SS.prep(R, { cls: m.cls, nrm, base: m.g.pos, Mi: null, nA: nrm });
      R.restN = rest; R.mesh = m; R.pos = m.g.pos.slice();
      return R;
    });
    recMs += Number(process.hrtime.bigint() - t0) / 1e6;
  };
  const passAll = () => { while (st.q.length) SS.tick(st, Infinity); };
  const oNode = SK.FR.to(C.defOrigin(d0));
  for (let s = 1; s <= N; s++) {
    sim.step(1 / 60);
    const P = SH.simDmgHop(sim, hop, core, 0);
    if (P) { payloads++; SV.simViewDmgApply(D, P); }
    if (!P && !recs) continue;
    if (!recs) mk();
    // the break events (the page's brkCage: the binding's budget, then bindMore)
    let bud = 4000;
    for (const R of recs) { R.lastBound = 0; if (D.br.length || R.active) SB.event(R, T, D, rest, R.mesh.g.pos, Math.max(0, bud)); bud -= R.lastBound || 0; }
    for (const R of recs) { if (bud <= 0) break; if (R.pending) bud -= SB.bindMore(R, T, bud); }
    // the riding and the tear (world frame, as the page's): only once broken
    if (D.br.length) {
      C.genNodeBody(sim, live, oNode);
      const [xA, yU] = sim.axes(), zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]], down = [-xA[1], -yU[1], -zL[1]];
      SB.nodeFrames(NF, T, D, rest, live);
      for (const R of recs) if (R.active) { const pos = R.pos; pos.set(R.mesh.g.pos); SB.poseCage(R, rest, live, R.mesh.g.pos, pos, NF, down, null); SB.tear(R, R.mesh.g.pos, pos); }
    }
    // THE SCUFF: a new pass on each event (vB, vS), budgeted ticks between
    if (D.vB !== vB || D.vS !== vS) {
      vB = D.vB; vS = D.vS;
      Fl = SS.fields(d0, D, B); SS.request(st, Fl, recs);
    }
    if (!D.br.length && Fl) for (const R of recs) bound += SS.bindWanted(R, Fl, SB, T, SS.SC.bindBudget);
    const t0 = process.hrtime.bigint();
    SS.tick(st);
    frameMax = Math.max(frameMax, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  // to the end: the binding owed, the last pass whole
  if (recs) {
    for (const R of recs) while (R.pending) SB.bindMore(R, T, 1e9);
    for (let q = 0; q < 50; q++) { let b = 0; for (const R of recs) b += SS.bindWanted(R, SS.fields(d0, D, B), SB, T, 1e9); if (!b) break; bound += b; }
    st.next = null; SS.begin(st, SS.fields(d0, D, B), recs); passAll();
  }
  passes = st.passes;
  return { sim, def, D, recs, st, payloads, passes, frameMax, bound, recMs, SK, damage: sim.damage() };
}
// the records' bytes, hashed (FNV-1a over every record's rec and dir, in order)
function hashOf(recs) {
  let h = 0x811c9dc5;
  for (const R of recs || []) for (const A of [R.sc.rec, new Uint8Array(R.sc.dir.buffer)]) for (let i = 0; i < A.length; i++) { h ^= A[i]; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
module.exports = { CASES, stage, skinOf, run, hashOf, L, SB, SS, SH, SV };
