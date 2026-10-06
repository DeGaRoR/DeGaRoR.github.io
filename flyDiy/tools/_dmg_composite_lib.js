// G2047-G2049 (DMG-COMPOSITE): the composite build and its runs, node only - the GATE DMGCOMPOSITE's
// (_dmg_composite_check.js) and its evidence's (dmg_composite_evidence.js). The user (2026-10-06): "I would also like to
// see ... something made out of glassfiber/carbon" crash.
//
//   composite    builds/composite_jodel_2026-10-07.json: the validated Jodel D112 (builds/jodel_2026-09-20_corrected.json),
//                its geometry untouched, built in E-glass / epoxy the garage's way - the construction tile on glassfibre
//                (cage intCons 5 -> spec.fuselage.material 'glass'), every surface 'as the aeroplane' (GEN_SURF_DEFAULT:
//                the glass wing and tail), the member screws off
//   compositeC   the same file with the tile on composite (intCons 0: carbon) - reported beside it, not gated
//
//   card(k)      the certificate (genCertify) and the garage's bench on it: to the limit, to the ultimate, to destruction
//   fly(k)       the pilot's circuit from HOME on the certificate's limits
//   crash(k, id) one of DMG-TUNE's standard crashes (tools/_dmg_tune_lib.js), with the composite census beside it: the
//                laminate members set (must be none), broken by how, the pieces, the energy
//   skin(k, id)  the generated skin over that crash with skin_break.js's records (shellTear): its worst live edge over
//                its rest, the triangles cracked / removed, the pieces the shell rides
'use strict';
const path = require('path'), fs = require('fs');
const L = require('./_treecrash_lib.js');
const T = require('./_dmg_tune_lib.js');
const ROOT = path.join(__dirname, '..');
const BUILD = 'builds/composite_jodel_2026-10-07.json';
L.BUILDS.composite = { label: 'Jodel in glass', build: BUILD };
L.BUILDS.compositeC = { label: 'Jodel in carbon (report)', build: BUILD, patch: j => { j.spec.cage.intCons = 0; j.spec.fuselage.material = 'carbon'; return j; } };
const LAM = new Set(['carbon', 'glass']);
// a laminate member: the airframe's own (not the steel engine bearer, the struts or the gear's - the gear is the bracket's)
const lamMember = b => LAM.has(b.mat) && b.cls !== 'gear';

// the garage's rig on the certified airframe (GATE DMGCERT's bench, verbatim)
function bench(def, o) {
  const C = L.core(), spec = def.spec, sim = C.makeSim(def, null); sim.reset(0);
  const BW = require(path.join(ROOT, 'src', 'viewer', 'bench_worker.js'));
  const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, spec, o.destroy ? { destroy: true } : { limit: Math.min(C.GEN_LOAD_LIMIT, o.ult), ult: o.ult, holdS: o.hold == null ? 1.5 : o.hold });
  if (cfg.destroy) { cfg.ult = 3 * C.GEN_LOAD_ULT; cfg.rampS = 4 * cfg.ult / C.GEN_LOAD_ULT; }
  cfg.surface = 'wing';
  const rig = C.makeLoadTest(sim, def, cfg);
  for (let f = 0; f < 60 * 120 && !rig.state.done; f++) rig.step(1 / 60);
  const D = sim.damage(), st = rig.state, fb = D.firstBreak, b = fb ? sim.beams[fb.beam] : null;
  const lamSet = sim.beams.filter(x => lamMember(x) && x.yielded && !x.broken).length;
  return { verdict: st.verdict, set: D.members, lamSet, breaks: D.breaks, yieldAt: st.yieldAt, breakAt: st.breakAt, brokeAt: st.brokeAt,
    brokeKey: st.brokeKey || null, brokeSeam: st.brokeSeam || null, groups: D.groups.map(G => G.key),
    fb: fb && { cls: fb.cls, seam: fb.seam, how: fb.how, mat: b.mat, tags: def.nodes[b.a].tag + '-' + def.nodes[b.b].tag }, finite: L.finite(sim) };
}

// the build as the garage reads it: its weight, its CG on the MAC, the ledger by section, its materials
function sheet(k) {
  const C = L.core(), d = L.defOf(k, { elastic: true }), g = d.params.gen, cg = C.defCG(d), led = (d.parts && d.parts.ledger) || {};
  const mats = {}; for (const b of d.beams) mats[b.mat] = (mats[b.mat] || 0) + 1;
  const seams = {}; for (const b of d.beams) if (LAM.has(b.mat) && b.seam) seams[b.seam] = (seams[b.seam] || 0) + 1;
  const ledger = {}; for (const s of Object.keys(led)) if (led[s] && typeof led[s].mass === 'number') ledger[s] = +led[s].mass.toFixed(1);
  return { k, material: d.spec.material, wing: C.genSurfKey(d.spec, 'wing', 0), fin: C.genSurfKey(d.spec, 'fin'), stab: C.genSurfKey(d.spec, 'stab'),
    mass: +g.mass.toFixed(1), Vs: +g.Vs.toFixed(2), VsFlap: g.VsFlap ? +g.VsFlap.toFixed(2) : null, cgMAC: +((cg[0] - g.xLEmac) / g.cBar * 100).toFixed(1),
    beams: d.beams.length, mats, seams, ledger, cost: +Object.values(led).reduce((a, s) => a + (s && s.cost || 0), 0).toFixed(0) };
}

function card(k) {
  const C = L.core(), t0 = Date.now(), cert = L.certOf(k), ms = Date.now() - t0;
  const def = L.defOf(k, { cert: true });
  const sim = C.makeSim(def, null); sim.reset(0);
  const caps = sim.damageCaps(), B = sim.beams;
  // every laminate member brittle on the stamp: no plastic range (its yield IS its break), crushed at once
  let lamN = 0, brittle = 0, ecu0 = 0;
  for (let i = 0; i < B.length; i++) { const b = B[i]; if (!lamMember(b) || !(caps.PHY[i * 4] < Infinity)) continue; lamN++;
    if (!(b.etu > 0) && b.fy0 === b.fu) brittle++; if (!(b.ecu > 0)) ecu0++; }
  const off = C.makeSim(Object.assign({}, def, { params: Object.assign({}, def.params, { damage: false }) }), null);
  const offInf = off.beams.every(b => !(b.fy0 < Infinity)) && off.certStamp(cert) === false;
  const lim = cert.limit, ult = cert.ult;
  return { k, certMs: ms, limit: lim, ult, m: cert.m, certV: C.GEN_CERT_V, lamN, brittle, ecu0, offInf,
    lim10: bench(def, { ult: lim }), lim12: bench(def, { ult: 1.2 * lim }), ultR: bench(def, { ult }), destroy: bench(def, { destroy: true }), sheet: sheet(k) };
}

function fly(k, maxS) {
  const t0 = Date.now(), r = L.circuit(k, { cert: true, maxS: maxS || 700 }), sim = L.lastRun.sim;
  return { k, outcome: r.outcome, t: +r.t.toFixed(1), phases: r.phases, nzMax: +r.nzMax.toFixed(2), finite: r.finite,
    yields: r.dmg.yields, breaks: r.dmg.breaks, crashed: r.dmg.crashed, fuel: sim.fuelKg ? +sim.fuelKg().toFixed(1) : null, s: (Date.now() - t0) / 1000 };
}

// one standard crash, with the census: the energy taken out of the aeroplane (its mechanical energy at the first frame minus
// at the end: the trunk's contact damping, the ground, the members' work), the laminate members set, the members broken
// by how (tension / kink = crushed / core / fold / bond ...), the pieces
function crash(k, id, o) {
  let e0 = null, eEnd = null;
  const onFrame = sim => { let e = 0; for (let i = 0; i < sim.n; i++) e += sim.m[i] * (0.5 * (sim.v[i*3] ** 2 + sim.v[i*3+1] ** 2 + sim.v[i*3+2] ** 2) + 9.81 * sim.p[i*3+1]); if (e0 === null) e0 = e; eEnd = e; };
  const r = T.runCrash(k, id, Object.assign({ cert: true, onFrame }, o || {}));
  const sim = L.lastRun.sim, B = sim.beams;
  const lamSet = B.filter(b => lamMember(b) && b.yielded && !b.broken).length;
  const steelSet = B.filter(b => !LAM.has(b.mat) && b.yielded && !b.broken).length;
  const lamBroken = B.filter(b => lamMember(b) && b.broken).length;
  const bySeam = {}; for (const row of r.rows) { const bb = B[row.bi]; if (!LAM.has(bb.mat)) continue; const s = row.how.replace(/^trigger:/, '') + (bb.seam ? '/' + bb.seam : ''); bySeam[s] = (bySeam[s] || 0) + 1; }
  delete r.rows;
  return Object.assign(r, { k, lamSet, steelSet, lamBroken, lamBySeam: bySeam, eTaken: e0 === null ? null : e0 - eEnd });
}

// the generated skin over a crash (GATE DMGSKIN's generator-side pass, the shell's record): every frame from the first
// break, the worst live triangle's edge past the shell's bound (<= 0: nothing drawn stretched), the cracked / removed
function skin(k, c) {
  const C = L.core(), SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
  const d0 = L.defOf(k), n = d0.nodes.length;
  const W = C.genWing(d0), FR = C.genRestFrame(d0), rest = W.rest, oNode = FR.to(C.defOrigin(d0));
  const fab = /fabric|steel|aluFabric/.test(C.genSurfKey(d0.spec, 'wing', 0)), shell = LAM.has(d0.spec.material);
  const groups = Object.keys(W.groups).map(nm => ({ nm, g: W.groups[nm], fabric: fab && /^(skin|ail|flap)/.test(nm) }));
  const Tp = SB.topo(d0.beams, n), NF = {}, live = new Float32Array(n * 3);
  const recs = groups.map(m => ({ m, R: null, idx: m.g.idx.slice(), pos: m.g.pos.slice() }));
  const S = { frames: 0, excess: -Infinity, stretch: 1, removed: 0, torn: 0, finite: true, shell, fabric: fab, tris: recs.reduce((a, r) => a + r.m.g.nt, 0), live: 0, pieces: 1, shellPieces: 0 };
  let sim = null;
  const onFrame = s => {
    sim = s; const D = s.damage(); if (!D.broken.length) return;
    S.frames++;
    for (const r of recs) if (!r.R) { const bn = SB.bindNearest(r.m.g.pos, r.m.g.nv, rest, n); r.R = SB.make({ nv: r.m.g.nv, idx: r.idx, wi: bn.wi, ww: bn.ww }, SB.NEAR_K, { fabric: r.m.fabric, shell: shell && !r.m.fabric }); }
    const pcs = piecesOf(s), fl = new Uint8Array(s.beams.length); for (const bi of D.broken) fl[bi] = 1;
    const st = { br: D.broken.slice(), broken: fl, nb: fl.length, vB: D.broken.length, pc: pcs, nPc: new Set(pcs).size, set: new Float32Array(fl.length) };   // (sim_view.js simViewDmgState's shape)
    C.genNodeBody(s, live, oNode);
    const [xA, yU] = s.axes(), zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]], down = [-xA[1], -yU[1], -zL[1]];
    SB.nodeFrames(NF, Tp, st, rest, live);
    for (const r of recs) {
      const g = r.m.g;
      SB.event(r.R, Tp, st, rest, g.pos);
      C.poseSkinGen(g, rest, live, g.pos, r.pos, 1, null, { R: r.R, NF, down, poseGen: SB.poseGen });
      SB.tear(r.R, g.pos, r.pos);
      for (let i = 0; i < r.pos.length; i++) if (!Number.isFinite(r.pos[i])) { S.finite = false; break; }
      // the shell's own bound: l - (1 + SHELL_TEAR) r - SHELL_ABS over every live edge
      const i0 = r.R.idx0 || r.R.idx;
      for (let t = 0; t < r.R.nt; t++) { if (r.R.dead && r.R.dead[t]) continue;
        for (let e = 0; e < 3; e++) { const a = i0[t*3+e]*3, b = i0[t*3+(e+1)%3]*3;
          const rr = Math.hypot(g.pos[a]-g.pos[b], g.pos[a+1]-g.pos[b+1], g.pos[a+2]-g.pos[b+2]), ll = Math.hypot(r.pos[a]-r.pos[b], r.pos[a+1]-r.pos[b+1], r.pos[a+2]-r.pos[b+2]);
          const x = ll - (1 + SB.SHELL_TEAR) * rr - SB.SHELL_ABS; if (x > S.excess) S.excess = x; if (rr >= 0.02 && ll / rr > S.stretch) S.stretch = ll / rr; } }
    }
    S.pieces = Math.max(S.pieces, st.nPc);
  };
  const r = T.runCrash(k, c, { cert: true, onFrame });
  for (const q of recs) if (q.R) { S.removed += q.R.removed; S.torn += q.R.torn; if (q.R.dead) for (let t = 0; t < q.R.nt; t++) if (!q.R.dead[t]) S.live++; }
  // the shell's pieces: the pieces of the frame that carry live skin (a vertex rides its piece: vp)
  if (sim) { const pcs = piecesOf(sim), seen = new Set();
    for (const q of recs) if (q.R && q.R.dead && q.R.dom) { const i0 = q.R.idx0; for (let t = 0; t < q.R.nt; t++) if (!q.R.dead[t]) seen.add(pcs[q.R.dom[i0[t*3]]]); }
    S.shellPieces = seen.size; }
  S.excess = +S.excess.toFixed(4); S.stretch = +S.stretch.toFixed(4); S.broken = r.broken;
  return S;
}
function piecesOf(sim) {
  const n = sim.n, P = new Int32Array(n); for (let i = 0; i < n; i++) P[i] = i;
  const f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; };
  for (const b of sim.beams) if (!b.broken) { const x = f(b.a), y = f(b.b); if (x !== y) P[x] = y; }
  for (const C of sim.clusterCuts().clusters) if (!C.off) for (const i of C.nodes) { const x = f(i), y = f(C.nodes[0]); if (x !== y) P[x] = y; }
  const out = new Int32Array(n); for (let i = 0; i < n; i++) out[i] = f(i);
  return out;
}

module.exports = { L, T, BUILD, LAM, lamMember, bench, sheet, card, fly, crash, skin };
