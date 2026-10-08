#!/usr/bin/env node
// GATE DMGSKINGPU (G1819, DMG-SKINGPU) - THE WRECK'S SKIN RIDDEN ON THE GPU (G1818: src/viewer/skin_gpu.js, a transform
// feedback writing the drawn buffers), node only. On the user's validated builds, damage ON, on the crash cases (the four
// Cub crashes the coordinator named - a trunk at 30 m/s on the centreline and 2.5 m out, a 3 m/s taxi into a trunk, the
// severe nose-in that puts the Cub on its back; the trunk and the nose-in on the Jodel and the metal Cessna; the severe
// float nose-in on the floatplanes), the skin as the PAGE binds it (DMGSKIN's measured skin - genWing's groups and every
// member's tube - UNWELDED as the cage snapshot is, three vertices a triangle with their flat normals; app.js brkCage's
// records: welded, riding whole in the world frame, the binding made BRK budget places a frame, the nodes' frames held to
// their pieces' turns), two records a group - the CPU's riding (poseCage, the full tear: the page before G1818) and the
// GPU's (G1818: its data packed as skin_gpu.js packs and sends it, the tear on its read-back places):
//   1. THE SHADER'S MIRROR = THE CPU'S RIDING: rideMirror (skin_break.js: RIDE_VS line for line, rounded as float32) on the
//      textures skin_gpu.js packStale leaves - whole after an event, by place after a binding step - against poseCage on
//      the same record and frame: every vertex's drawn position within 0.1 mm, its normal within 1 degree (the
//      coordinator's bound), every 6th frame from the first break and every frame with a new break;
//   2. THE TEAR WITHOUT THE CPU RIDING (skin_break.js tearPlaces on the places' world positions read back a frame old)
//      against the CPU's full tear: what it tears and when, how far past the bound a live edge stands; THE INCREMENTAL
//      EVENT (a record far from the break skipped, a near one re-made where touched) = the full event, byte for byte;
//      every record on the GPU (no CPU fallback), the bindings pruned past 8 slots counted;
//   3. NOTHING CHANGES WITH NOTHING BROKEN, OR DAMAGE OFF (static, the page's code): app.js reaches the GPU path only
//      inside brkCage past the damage state's guard, links its program only there; no material, program key or
//      onBeforeCompile is touched by it (the drawn buffers change, never a program); skin_gpu.js makes nothing at load;
//      poseModel's rig rows skip a group only while the page holds a break and its record rides it whole; under the
//      physics worker the page's sim mirrors the view's damage state (GATE DMGPAGEW flies the page itself);
//   4. the shader's text carries the mirror's steps (the slots, the hemisphere, the turn, the frame, the normal).
// Reported: the records the GPU rides and any that would fall back to the CPU, the bindings pruned past 8 slots, the costs.
// Run: node tools/_dmg_skingpu_check.js [--out <file.json>] [--builds cub,jodel]   (one final `GATE DMGSKINGPU: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const L = require('./_treecrash_lib.js');
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
if (process.env.DMGSKINGPU_FULLCOV === '1') SB.OPT.localCov = false;   // (train 41: the covering records' events made whole - the fallback's A/B)
const SG = require(path.join(ROOT, 'src', 'viewer', 'skin_gpu.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));

const TOL_P = 1e-4, TOL_N = 1;                          // m, degrees (the coordinator's bound for READY)
const BRK_BIND = 1500;                                  // places a frame (the page's 4000 is for ~85k places; the measured skin is ~20k)
const TEAR_FRAMES = 3;                                  // the page's TEAR_EVERY 0.05 s at 60 Hz
// (train 39, the coordinator's ruling: ONE GPU SAMPLING PERIOD - a tear check every TEAR_FRAMES frames on a read-back one
// frame old - is the longest a live edge may stand past the bound on the GPU path, and a miss must be such a transient)
const PERIOD_G = TEAR_FRAMES + 1;
function overRun(R, run, maxRun) {
  // (train 41: each triangle on the bound its tear holds it to - skin_break.js tear() / over(): a HELD covering triangle
  // (G2040) stretches to HELD, a tube / a composite shell / sheet metal to theirs; a record that never tears is not measured)
  if (R.noTear && !R.tubeTear && !R.sheetTear && !R.shellTear) return 0;
  const i0 = R.idx0 || R.idx, dead = R.dead, base = R.baseD, pos = R.w, H = R.held; let mx = 0;
  const k1 = R.tubeTear ? 1.2 : R.shellTear ? 1 + SB.SHELL_TEAR : R.sheetTear ? 1.4 : 1 + SB.TEAR, ab = R.tubeTear ? 0.003 : R.shellTear ? SB.SHELL_ABS : R.sheetTear ? 0.02 : SB.TEAR_ABS;
  for (let t = 0; t < R.nt; t++) {
    if (dead && dead[t]) { run[t] = 0; continue; }
    let o = false; const kk = H && H[t] ? SB.HELD : k1, aa = H && H[t] ? SB.TEAR_ABS : ab;
    for (let e = 0; e < 3 && !o; e++) { const a = i0[t * 3 + e] * 3, b = i0[t * 3 + (e + 1) % 3] * 3;
      const r = Math.hypot(base[a] - base[b], base[a + 1] - base[b + 1], base[a + 2] - base[b + 2]);
      const l = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]);
      if (!(l <= kk * r + aa)) o = true; }
    run[t] = o ? run[t] + 1 : 0;
    if (maxRun && run[t] > maxRun[t]) maxRun[t] = run[t];
    if (run[t] > mx) mx = run[t];
  }
  return mx;
}
const MIRROR_EVERY = 6;
const SEVERE = { V: 50, sink: 10, pitch: 60, secs: 4 }, WATER_SEVERE = { V: 150 / 3.6, sink: 10, pitch: 60, secs: 4 };
const ALL = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
const casesOf = k => /floats/i.test(k)
  ? [{ id: 'nosein-water', label: 'a severe float nose-in (150 km/h, 10 m/s, 60 deg)', kind: 'water', o: WATER_SEVERE }]
  : [{ id: 'trunk-0', label: 'a trunk at 30 m/s, the centreline', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 0 } }]
    .concat(k === 'cub' ? [{ id: 'trunk-2.5', label: 'a trunk at 30 m/s, the wing 2.5 m out', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 2.5 } },
                           // (train 39: TUNE's body floor at 0.5 x the physics holds the mount - the 5 m/s taxi breaks nothing now, by
                           // design; the brief's nose-over takes its place: GATE DMGWALL's, a 0.35 m stump at 12 m/s)
                           { id: 'noseover', label: 'a nose-over on a 0.35 m stump at 12 m/s', kind: 'trunk', o: { D: 12, agl: 0, V: 12, thr: 0, secs: 6, off: 0, top: 0.35, r: 0.25 } }] : [])
    .concat([{ id: 'nosein-ground', label: 'a severe nose-in on the ground (180 km/h, 10 m/s, 60 deg): over on its back', kind: 'ground', o: SEVERE }]);

// the cases, set up as GATE DMGSKIN sets them up (TREE-CRASH / DMGINTEGRITY's)
function go(k, c) {
  const C = L.core(), o = c.o, d0 = L.defOf(k, { cert: k === 'cub' }), def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage: true }) });
  const pitchAndDrop = (sim, top) => {
    const n = sim.n, p = sim.p, v = sim.v, [xA, , zR] = sim.axes(), c0 = sim.cgPos();
    const th = -(o.pitch || 0) * Math.PI / 180, kk = zR, cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const d = [p[i*3] - c0[0], p[i*3+1] - c0[1], p[i*3+2] - c0[2]], kd = kk[0]*d[0] + kk[1]*d[1] + kk[2]*d[2];
      const cr = [kk[1]*d[2] - kk[2]*d[1], kk[2]*d[0] - kk[0]*d[2], kk[0]*d[1] - kk[1]*d[0]];
      for (let j = 0; j < 3; j++) p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + kk[j] * kd * (1 - cs);
    }
    let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - def.nodes[i].r);
    const hl = Math.hypot(xA[0], xA[2]);
    for (let i = 0; i < n; i++) { p[i*3+1] += top(c0) + 0.3 - yMin; v[i*3] = -o.V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -o.V * xA[2] / hl; }
    sim.ctl.thr = 0;
  };
  if (c.kind === 'trunk') {
    const elev = 300, { W, TH, strip } = L.flatWorld(elev), sim = C.makeSim(def, W);
    sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
    if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
    if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
    const c0 = sim.cgPos().slice(), off = o.off || 0, tk = { r: o.r || 0.3, h: o.top || 10.05, sink: 0 };
    TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev - tk.sink, tk.r, elev - tk.sink + tk.h]);
    sim.ctl.thr = o.thr == null ? 0 : o.thr;
    return { sim, def, N: o.secs * 60 };
  }
  if (c.kind === 'ground') { const { W } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0); pitchAndDrop(sim, () => 0); return { sim, def, N: o.secs * 60 }; }
  const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  pitchAndDrop(sim, c0 => world.waterH(c0[0], c0[2]));
  return { sim, def, N: o.secs * 60 };
}
// a mesh as the cage snapshot stores it: three vertices a triangle, each with its triangle's normal
function unweld(g) {
  const nt = g.nt, pos = new Float32Array(nt * 9), nrm = new Float32Array(nt * 9), idx = new Uint32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = g.idx[t * 3] * 3, b = g.idx[t * 3 + 1] * 3, c = g.idx[t * 3 + 2] * 3, P = g.pos;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    for (let q = 0; q < 3; q++) { const s = g.idx[t * 3 + q] * 3, d = (t * 3 + q) * 3;
      pos[d] = P[s]; pos[d + 1] = P[s + 1]; pos[d + 2] = P[s + 2]; nrm[d] = nx; nrm[d + 1] = ny; nrm[d + 2] = nz; idx[t * 3 + q] = t * 3 + q; }
  }
  return { pos, nrm, idx, nv: nt * 3, nt };
}
const inv3 = (X, Y) => { const Z = [X[1]*Y[2]-X[2]*Y[1], X[2]*Y[0]-X[0]*Y[2], X[0]*Y[1]-X[1]*Y[0]];
  const a = X[0], b = Y[0], c = Z[0], d = X[1], e = Y[1], f = Z[1], g = X[2], h = Y[2], k = Z[2];
  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g) || 1e-9;
  return [(e * k - f * h) / det, (c * h - b * k) / det, (b * f - c * e) / det, (f * g - d * k) / det, (a * k - c * g) / det,
          (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det]; };
const basis = (X, Y) => { const Z = [X[1]*Y[2]-X[2]*Y[1], X[2]*Y[0]-X[0]*Y[2], X[0]*Y[1]-X[1]*Y[0]]; return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]]; };
const ms = t0 => Number(process.hrtime.bigint() - t0) / 1e6;

if (argv[0] === '--build') {
  const k = argv[1], C = L.core(), out = { key: k, label: L.BUILDS[k].label, cases: [] };
  const d0 = L.defOf(k), core = d0.refs.noseFrame[0], n = d0.nodes.length;
  out.cert = k === 'cub';
  const W = C.genWing(d0), FR = C.genRestFrame(d0), rest = W.rest;
  const M = C.genMesh(); for (const b of d0.beams) C.genBeamInto(M, b.cls === 'tail' ? Object.assign({}, b, { cls: 'fus' }) : b, d0.nodes, FR.to);
  const fab = /fabric|steel|aluFabric/.test(C.genSurfKey(d0.spec, 'wing', 0));
  const meshes = Object.keys(W.groups).map(nm => ({ nm, g: unweld(W.groups[nm]), fabric: fab && /^(skin|ail|flap)/.test(nm) })).concat([{ nm: 'members', g: unweld(M.done()), fabric: false }]);
  out.skin = { groups: meshes.length, verts: meshes.reduce((a, m) => a + m.g.nv, 0), tris: meshes.reduce((a, m) => a + m.g.nt, 0) };
  const T = SB.topo(d0.beams, n), restD = Float64Array.from(rest);
  for (const c of casesOf(k)) {
    const RS = { id: c.id, label: c.label };
    const IN = go(k, c), sim = IN.sim, hop = SH.simDmgHop0(), st = SV.simViewDmgState(n, d0.beams.length);
    const o = [0.31, -0.12, 0.04];                  // a group offset (the page's o = off + oRest): any, the same both ways
    const mk = (m, gpu) => {
      const g = { nv: m.g.nv, idx: m.g.idx.slice() };
      const R = SB.make(g, SB.NEAR_K, { fabric: m.fabric, cage: true, pos: m.g.pos, rest: restD, weld: true, rideAll: true });
      R.baseD = Float64Array.from(m.g.pos); R.w = new Float64Array(m.g.nv * 3); R.nB = m.g.nrm;
      return { R, P: new Float32Array(m.g.nv * 3), N: Float32Array.from(m.g.nrm), gpu, firstTorn: new Int32Array(m.g.nt).fill(-1) };
    };
    let recs = null;
    const NF = {}, S = { frames: 0, breakFrames: 0, mirrorFrames: 0, verts: 0, dP: 0, dN: 0, dPat: null, finite: true, pruned: 0, gpuRecs: 0, cpuFallback: 0,
      tornC: 0, tornG: 0, missed: 0, late: 0, lateMax: 0, early: 0, excessG: -Infinity, excessC: -Infinity, checks: 0, checksC: 0, zeroN: 0, dNat: null, ambiguous: 0, qCpu: 0, over: 0, overCond: 0, dPover: 0, dPoverAt: null, overCap: 0, goneOther: 0, evCmp: 0, evBad: 0, evBadAt: null, evSkipped: 0,
      ms: { tear: 0, tearPl: 0, pack: 0, nodes: 0, event: 0, pose: 0 } };
    let nbSeen = 0, ND = new Float32Array(n * 8);
    for (let s = 1; s <= IN.N; s++) {
      sim.step(1 / 60);
      const P0 = SH.simDmgHop(sim, hop, core, 0); if (P0) SV.simViewDmgApply(st, P0);
      const D = st;
      if (!D.br.length) continue;
      S.frames++;
      if (!recs) {
        recs = meshes.map(m => ({ m, C: mk(m, false), G: mk(m, true), F: mk(m, false), L: mk(m, false), B: mk(m, false) }));
        for (const r of recs) r.B.R.reachCopies = true;   // (B: FABRIC's reach / vx at the copy corners - before the train-41 fix)
        for (const r of recs) r.F.R.fullNext = true;   // (F: every event full - the reference; L: skipped / local as the page)
        // the GPU's side of each record: its own drawer's CPU arrays, laid out as skin_gpu.js layout lays them (p0 = 0)
        for (const r of recs) { SB.placesOf(r.G.R); r.Dm = { recs: [{ R: r.G.R, p0: 0 }], cpu: SB.placeArrays(Math.ceil(r.G.R.pl.length / SB.GPU_W)) }; r.G.R.dvUp = -1; S.gpuRecs++; }
      }
      const brokeNow = D.br.length !== nbSeen; nbSeen = D.br.length; if (brokeNow) S.breakFrames++;
      // the events and the binding, as brkCage: a budget of places a frame, each family its own (the same decisions)
      for (const fam of ['C', 'G', 'F', 'L', 'B']) {
        let bud = BRK_BIND;
        for (const r of recs) { const R = r[fam].R; R.lastBound = 0; const t0 = process.hrtime.bigint(); SB.event(R, T, D, restD, R.baseD, Math.max(0, bud)); S.ms.event += ms(t0); bud -= R.lastBound || 0; }
        for (const r of recs) { if (bud <= 0) break; const R = r[fam].R; if (R.pending) bud -= SB.bindMore(R, T, bud); }
      }
      // THE INCREMENTAL EVENT = THE FULL ONE: the event-only families (no riding, no tear) compared byte for byte - every
      // vertex's piece / dominant / ride, every place's kept weights, every triangle's state and index, the drape
      if (brokeNow) for (const r of recs) {
        const F = r.F.R, Lr = r.L.R; if (!F.active || !Lr.active) continue;
        S.evCmp++;
        const eq = (a, b) => a === b || (a && b && a.length === b.length && Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0);
        // per place, on the places bound in both (a place bound in one and not yet in the other - the binding budget reached
        // it a frame or two apart: a skipped record binds through the frame's budget, not its event - rides its nearest
        // node meanwhile); the triangles' state and the index everywhere
        const K = F.K; SB.placesOf(F); let unb = 0, pok = true;
        for (const v of F.pl) { if (!F.g.bound[v] || !Lr.g.bound[v]) { unb++; continue; }
          if (F.vp[v] !== Lr.vp[v] || F.dom[v] !== Lr.dom[v] || F.ride[v] !== Lr.ride[v] || (F.sag ? F.sag[v] : 0) !== (Lr.sag ? Lr.sag[v] : 0)) { pok = false; break; }
          for (let k = 0; k < K; k++) if (F.w2[v * K + k] !== Lr.w2[v * K + k]) { pok = false; break; } if (!pok) break; }
        S.evUnbound = Math.max(S.evUnbound || 0, unb);
        // (train 41: the triangles compared where both families' bindings agree - a triangle over a place bound in one family
        // and not yet in the other rides that place's nearest node there, as the weights' comparison above allows)
        let tok = true, tSkip = 0; { const i0 = F.idx0, rp = F.rep, nt = F.nt, bF = F.g.bound, bL = Lr.g.bound;
          for (let t = 0; t < nt && tok; t++) { const a = rp ? rp[i0[t * 3]] : i0[t * 3], b = rp ? rp[i0[t * 3 + 1]] : i0[t * 3 + 1], c = rp ? rp[i0[t * 3 + 2]] : i0[t * 3 + 2];
            if (bF[a] !== bL[a] || bF[b] !== bL[b] || bF[c] !== bL[c]) { tSkip++; continue; }
            if (F.dead[t] !== Lr.dead[t] || F.idx[t * 3] !== Lr.idx[t * 3] || F.idx[t * 3 + 1] !== Lr.idx[t * 3 + 1] || F.idx[t * 3 + 2] !== Lr.idx[t * 3 + 2]) tok = false; } }
        S.evTriSkip = Math.max(S.evTriSkip || 0, tSkip);
        if (!tok && !S.evTriAt) { const i0 = F.idx0, rp = F.rep, ch = Lr._chg;
          for (let t = 0; t < F.nt; t++) if (F.dead[t] !== Lr.dead[t] || F.idx[t * 3] !== Lr.idx[t * 3] || F.idx[t * 3 + 1] !== Lr.idx[t * 3 + 1] || F.idx[t * 3 + 2] !== Lr.idx[t * 3 + 2]) {
            const vs = [i0[t * 3], i0[t * 3 + 1], i0[t * 3 + 2]], ps = vs.map(v => rp ? rp[v] : v);
            S.evTriAt = { t, deadF: F.dead[t], deadL: Lr.dead[t], heldF: F.held ? F.held[t] : null, heldL: Lr.held ? Lr.held[t] : null, cov: [F.cov, Lr.cov],
              chgL: ch ? vs.map(v => ch[v]) : null, vpF: ps.map(p => F.vp[p]), vpL: ps.map(p => Lr.vp[p]), domF: ps.map(p => F.dom[p]), domL: ps.map(p => Lr.dom[p]),
              vpCopyF: vs.map(v => F.vp[v]), vpCopyL: vs.map(v => Lr.vp[v]), skipped: Lr.skipped | 0 }; break; } }
        const ok = pok && tok;
        if (!ok) { S.evBad++; if (!S.evBadAt) S.evBadAt = { t: +sim.t.toFixed(3), mesh: r.m.nm, places: pok, tris: tok, trisSkipped: tSkip, tri: S.evTriAt || null, dead: eq(F.dead, Lr.dead), idx: eq(F.idx, Lr.idx), unb }; }
        S.evSkipped = recs.reduce((a, q) => a + (q.L.R.skipped || 0), 0);
      }
      { const t0 = process.hrtime.bigint(); SB.nodeFrames(NF, T, D, restD, sim.p, true); S.ms.nodes += ms(t0); }
      const [xA, yU] = sim.axes(), cg = sim.bodyOrigin ? sim.bodyOrigin() : sim.cgPos();
      const X = { Mi: inv3(xA, yU), B: basis(xA, yU), cg, o, w: null, n: null, nB: null }, down = [0, -1, 0];
      const U = { Mi: X.Mi, B: X.B, px: o, down };
      const tearDue = R => R.tearF == null || s - R.tearF >= TEAR_FRAMES, mirrorNow = brokeNow || S.frames % MIRROR_EVERY === 1;
      for (const r of recs) {
        const nt = r.m.g.nt;
        // THE CPU'S RIDING (the page before G1818): every frame, the full tear at its rate
        { const R = r.C.R; if (!R.active) continue;
          X.w = R.w; X.n = r.C.N; X.nB = R.nB;
          const t0 = process.hrtime.bigint(); SB.poseCage(R, restD, sim.p, R.baseD, r.C.P, NF, down, null, X); S.ms.pose += ms(t0);
          if (tearDue(R)) { R.tearF = s; const t1 = process.hrtime.bigint(); SB.tear(R, R.baseD, R.w); S.ms.tear += ms(t1); S.checksC++; }
          const ws = SB.worstStretch({ idx0: R.idx0, idx: R.idx, dead: R.dead, nt: R.nt }, R.baseD, R.w); if (ws.ex > S.excessC) S.excessC = ws.ex;
          for (let t = 0; t < nt; t++) if (R.dead[t] === 2 && r.C.firstTorn[t] < 0) { r.C.firstTorn[t] = s;
            // (train 41: how far past its bound the CPU found it - a tear within float32's reach of the bound (0.2 mm, twice the
            // mirror's) may fall either side on the GPU's float32 places: the two paths then part at the next event, which may
            // hold the triangle (FABRIC) - a late tear by sampling, not a divergence)
            if (!r.C.margin) r.C.margin = new Float32Array(nt).fill(Infinity);
            { const i0 = R.idx0, base = R.baseD, pos = R.w, H = R.heldAsk !== undefined ? R.heldAsk : R.held; let mg = -Infinity;
              const k1 = H && H[t] ? SB.HELD : R.tubeTear ? 1.2 : R.shellTear ? 1 + SB.SHELL_TEAR : R.sheetTear ? 1.4 : 1 + SB.TEAR, ab = H && H[t] ? SB.TEAR_ABS : R.tubeTear ? 0.003 : R.shellTear ? SB.SHELL_ABS : R.sheetTear ? 0.02 : SB.TEAR_ABS;
              for (let e = 0; e < 3; e++) { const a = i0[t * 3 + e] * 3, b = i0[t * 3 + (e + 1) % 3] * 3;
                const rr = Math.hypot(base[a] - base[b], base[a + 1] - base[b + 1], base[a + 2] - base[b + 2]), l = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]);
                mg = Math.max(mg, l - (k1 * rr + ab)); }
              r.C.margin[t] = mg; } }
          if (R.held) { let h = 0; for (let t = 0; t < nt; t++) if (R.held[t] && !R.dead[t]) h++; S.heldMax = Math.max(S.heldMax || 0, h); S.heldTorn = Math.max(S.heldTorn || 0, R.heldTorn || 0); }   // (G2040: the drawing's held covering)
          { const RB = r.B.R; if (RB.active && RB.held) { let h = 0; for (let t = 0; t < nt; t++) if (RB.held[t] && !RB.dead[t]) h++; S.heldMaxB = Math.max(S.heldMaxB || 0, h); }
            if (RB.active) { let gB = 0, gC = 0; for (let t = 0; t < nt; t++) { if (RB.dead[t] === 1) gB++; if (R.dead[t] === 1) gC++; } r.goneB = gB; r.goneC = gC; } }
          if (!r.C.run) r.C.run = new Uint16Array(nt);
          S.runC = Math.max(S.runC || 0, overRun(R, r.C.run, null)); }
        // THE GPU'S: the stale places packed as skin_gpu.js packs them; a places pass read back the frame after it ran
        const R = r.G.R; if (!R.active) continue;
        { const t0 = process.hrtime.bigint(); const [r0, r1] = SG.packStale(r.Dm, SB, restD, () => R.baseD); if (r1 > r0) S.ms.pack += ms(t0); }
        if (r.pend) { r.Wp = r.pend; r.wTag = r.pendTag; r.pend = null; r.wSeq = (r.wSeq | 0) + 1; }   // (skin_gpu.js poll: last frame's pass, its tag)
        // what the GPU draws this frame, exactly (poseCage on this record): the shader's mirror against it; the bound
        const PT = new Float64Array(R.nv * 3), NT = Float32Array.from(r.G.N);   // (exact: the CPU path stores it as float32)
        X.w = R.w; X.n = NT; X.nB = R.nB;
        SB.poseCage(R, restD, sim.p, R.baseD, PT, NF, down, null, X);
        if (mirrorNow) {
          S.mirrorFrames++;
          const PG = new Float32Array(R.nv * 3), NG = new Float32Array(R.nv * 3);
          SB.packNodes(NF, sim.p, n, cg, ND);
          const pf = R.plOf, nB = R.nB;
          for (let v = 0; v < R.nv; v++) {
            const v3 = v * 3;
            SB.rideMirror(r.Dm.cpu, ND, pf[v], nB[v3], nB[v3 + 1], nB[v3 + 2], U, PG, NG, v3, Math.fround);
            if (!Number.isFinite(PG[v3]) || !Number.isFinite(PG[v3 + 1]) || !Number.isFinite(PG[v3 + 2])) { S.finite = false; continue; }
            // AMBIGUOUS: a slot's turn a quarter turn of quaternion off the dominant's (|q_i . q_0| under 1e-5: two nodes'
            // rotations 180 degrees apart) - either hemisphere is a blend, float32 or float64 picks; counted, not held
            { const t4 = pf[v] * 4, i0 = SB.slotNode(r.Dm.cpu.PI0[t4]) * 4; let amb = false;
              for (let a = 1; a < 8 && !amb; a++) { const TXw = a < 4 ? r.Dm.cpu.PW0 : r.Dm.cpu.PW1, TXi = a < 4 ? r.Dm.cpu.PI0 : r.Dm.cpu.PI1, w = TXw[t4 + (a & 3)];
                if (w === 0 || !SB.slotTurns(TXi[t4 + (a & 3)])) continue; const i = SB.slotNode(TXi[t4 + (a & 3)]) * 4, Q = NF.q;
                if (Math.abs(Q[i] * Q[i0] + Q[i + 1] * Q[i0 + 1] + Q[i + 2] * Q[i0 + 2] + Q[i + 3] * Q[i0 + 3]) < 1e-5) amb = true; }
              if (amb) { S.ambiguous++; S.verts++; continue; } }
            // in the WORLD: the drawn frame is the body's oblique basis, which a broken-up wreck turns near-singular (its
            // coordinates magnified ~100x there); the group's matrix maps a drawn difference back by B, a drawn normal by Mi^T
            const Bm = X.B, Mm = X.Mi, toW = (ex, ey, ez) => Math.hypot(Bm[0] * ex + Bm[1] * ey + Bm[2] * ez, Bm[3] * ex + Bm[4] * ey + Bm[5] * ez, Bm[6] * ex + Bm[7] * ey + Bm[8] * ez);
            const d = toW(PG[v3] - PT[v3], PG[v3 + 1] - PT[v3 + 1], PG[v3 + 2] - PT[v3 + 2]);
            // ...and what the CPU path itself drew there: its exact riding stored as float32 (the drawn frame's own precision)
            const q = toW(Math.fround(PT[v3]) - PT[v3], Math.fround(PT[v3 + 1]) - PT[v3 + 1], Math.fround(PT[v3 + 2]) - PT[v3 + 2]);
            const mx = Math.max(Math.abs(PT[v3]), Math.abs(PT[v3 + 1]), Math.abs(PT[v3 + 2])), ulp = mx > 0 ? Math.pow(2, Math.floor(Math.log2(mx)) - 23) : 0;
            if (q > S.qCpu) S.qCpu = q;
            // (train 39: THE BLEND'S OWN FLOAT32 BOUND - the shader sums the kept turns on the dominant's hemisphere in float32
            // and normalises: when they nearly cancel (|sum| = L small, a place whose nodes turned far apart at a violent
            // break) the turn's float32 error is ~K eps / L, and the offset e (up to metres) turned by it moves the place by
            // ~|e| K eps / L; the exact CPU riding has no such error. Counted past 0.1 mm, 8 steps of the drawn frame AND
            // 16 eps (|e| + 1 m) / L - the GPU's own precision there, not a divergence)
            let cond = 0;
            { const T = r.Dm.cpu, t4 = pf[v] * 4, Q = NF.q, i0 = SB.slotNode(T.PI0[t4]) * 4; let qx = 0, qy = 0, qz = 0, qw = 0;
              for (let a = 0; a < 8; a++) { const w = (a < 4 ? T.PW0 : T.PW1)[t4 + (a & 3)]; if (a >= 4 && w === 0) break; if (w === 0) continue;
                const fI = (a < 4 ? T.PI0 : T.PI1)[t4 + (a & 3)]; if (!SB.slotTurns(fI)) continue; const i = SB.slotNode(fI) * 4, sg = (Q[i] * Q[i0] + Q[i + 1] * Q[i0 + 1] + Q[i + 2] * Q[i0 + 2] + Q[i + 3] * Q[i0 + 3]) < 0 ? -w : w;
                qx += sg * Q[i]; qy += sg * Q[i + 1]; qz += sg * Q[i + 2]; qw += sg * Q[i + 3]; }
              const Lq = Math.hypot(qx, qy, qz, qw), eN = Math.hypot(T.PA[t4], T.PA[t4 + 1], T.PA[t4 + 2]);
              let sw = 0; for (let a = 0; a < 8; a++) sw += (a < 4 ? T.PW0 : T.PW1)[t4 + (a & 3)];
              var _sw = sw, _cgN = Math.hypot(cg[0], cg[1], cg[2]);
              cond = 16 * Math.pow(2, -24) * (eN + 1) / Math.max(Lq, 1e-9);
              // (...and THE REFERENCE'S OWN ERROR: the kept weights are stored float32 (R.w2, both paths), their sum 1 +- ~1e-7;
              // the CPU riding blends ABSOLUTE world positions, so its result moves by (sum - 1) x the world position - 0.115 mm
              // at the twin's 1.29 km from the world origin (measured: d = |sum - 1| |cg| to 4 digits) - where the GPU's blend,
              // relative to the CG, moves by (sum - 1) x metres. The reference is the one off there, not the GPU)
              cond += 2 * Math.abs(sw - 1) * (Math.hypot(cg[0], cg[1], cg[2]) + 10);
              if (d > TOL_P && d > 8 * ulp && d > S.dPover) { S.dPover = d; S.dPoverAt = { t: +sim.t.toFixed(3), mesh: r.m.nm, v, L: +Lq.toFixed(5), e: +eN.toFixed(3), bound: +cond.toExponential(2), sumW1: +(_sw - 1).toExponential(3), cg: +_cgN.toFixed(1), sumWxCg: +(Math.abs(_sw - 1) * _cgN).toExponential(3) }; } }
            if (d > TOL_P && d > 8 * ulp) S.over++;
            if (d > TOL_P && d > 8 * ulp && d > cond) S.overCond++;
            if (d > 5e-4 && d > 8 * ulp) S.overCap++;
            if (d > S.dP) { S.dP = d; S.dPat = { t: +sim.t.toFixed(3), mesh: r.m.nm, v, ulpWorld: +ulp.toExponential(2), drawn: +Math.max(Math.abs(PT[v3]), Math.abs(PT[v3 + 1]), Math.abs(PT[v3 + 2])).toFixed(1) }; }
            const wn = (N0, o) => [Mm[0] * N0[o] + Mm[3] * N0[o + 1] + Mm[6] * N0[o + 2], Mm[1] * N0[o] + Mm[4] * N0[o + 1] + Mm[7] * N0[o + 2], Mm[2] * N0[o] + Mm[5] * N0[o + 1] + Mm[8] * N0[o + 2]];
            const nG = wn(NG, v3), nT = wn(NT, v3);
            const lg = Math.hypot(nG[0], nG[1], nG[2]), lt = Math.hypot(nT[0], nT[1], nT[2]);
            if (lg < 1e-6 && lt < 1e-6) { S.zeroN++; S.verts++; continue; }   // (a degenerate triangle's normal: nought both ways)
            const cs = (nG[0] * nT[0] + nG[1] * nT[1] + nG[2] * nT[2]) / Math.max(1e-12, lg * lt);
            const a = Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI; if (a > S.dN) { S.dN = a; S.dNat = { t: +sim.t.toFixed(3), mesh: r.m.nm, v, lg, lt }; }
            S.verts++;
          }
        }
        // THE TEAR as the page tears the GPU's record (train 41: at the CPU's cadence): the frame it is due asks the places
        // pass (this frame's positions, at its end); the read lands the next frame and the tear runs on those positions
        const fresh = () => r.wSeq && r.wSeq !== r.wUsed;
        if (R.tearAsk != null) {
          if (fresh() && r.wTag >= R.tearAsk) { r.wUsed = r.wSeq; R.tearF = r.wTag; R.tearAsk = null; const t0 = process.hrtime.bigint(); SB.tearPlaces(R, r.Wp, 0, R.baseD, R.heldAsk !== undefined ? R.heldAsk : R.held); R.heldAsk = undefined; S.ms.tearPl += ms(t0); S.checks++; }
        } else if (tearDue(R)) { r.wantW = true; R.tearAsk = s; R.heldAsk = R.held ? R.held.slice() : null; }
        const ws = SB.worstStretch({ idx0: R.idx0, idx: R.idx, dead: R.dead, nt: R.nt }, R.baseD, R.w); if (ws.ex > S.excessG) S.excessG = ws.ex;
        for (let t = 0; t < nt; t++) if (R.dead[t] === 2 && r.G.firstTorn[t] < 0) r.G.firstTorn[t] = s;
        if (!r.G.run) { r.G.run = new Uint16Array(nt); r.G.maxRun = new Uint16Array(nt); }
        S.runG = Math.max(S.runG || 0, overRun(R, r.G.run, r.G.maxRun));
        // ...the places pass, at the frame's end (skin_gpu.js frame): every place's world position, the shader's places mode
        if (r.wantW && !r.pend) {
          SB.packNodes(NF, sim.p, n, cg, ND);
          const np = R.pl.length, Wp = new Float32Array(np * 3), UW = { world: true, down };
          for (let j = 0; j < np; j++) SB.rideMirror(r.Dm.cpu, ND, j, 0, 0, 0, UW, Wp, null, j * 3, Math.fround);
          r.pend = Wp; r.pendTag = s; r.wantW = false;
        }
      }
    }
    if (recs) { S.goneB = recs.reduce((a, r) => a + (r.goneB || 0), 0); S.goneC = recs.reduce((a, r) => a + (r.goneC || 0), 0); if (S.heldMax == null && S.heldMaxB) S.heldMax = 0; }
    if (recs) for (const r of recs) {
      for (let t = 0; t < r.m.g.nt; t++) {
        const fc = r.C.firstTorn[t], fg = r.G.firstTorn[t];
        if (fc >= 0) S.tornC++; if (fg >= 0) S.tornG++;
        if (fc >= 0 && fg < 0) { if (r.G.R.dead[t] === 0) { S.missed++; const mr = r.G.maxRun ? r.G.maxRun[t] : 0; S.missRun = Math.max(S.missRun || 0, mr);
          S.missedAt = S.missedAt || []; if (S.missedAt.length < 6) S.missedAt.push({ mesh: r.m.nm, t, frame: fc, overFramesGpu: mr }); } else S.goneOther++; }   // (a miss: still drawn on the GPU path; gone by an event instead - removed on two pieces - is not one)
        else if (fc >= 0 && fg > fc) { S.late++;
          const border = r.C.margin && r.C.margin[t] < 2e-4;
          if (fg - fc > PERIOD_G && border) { S.lateBorder = (S.lateBorder || 0) + 1; S.lateBorderMax = Math.max(S.lateBorderMax || 0, fg - fc); }
          else { S.lateMax = Math.max(S.lateMax, fg - fc); if (fg - fc > PERIOD_G && !S.lateAt) S.lateAt = { mesh: r.m.nm, t, fc, fg, margin: r.C.margin ? +(r.C.margin[t] * 1000).toFixed(3) : null, heldC: r.C.R.held ? r.C.R.held[t] : null, heldG: r.G.R.held ? r.G.R.held[t] : null }; } }
        else if (fg >= 0 && (fc < 0 || fg < fc)) S.early++;
      }
      S.pruned += r.G.R.pruned || 0;
    }
    const Dm = sim.damage(); S.nb = Dm.broken.length; S.crashed = Dm.crashed; S.reason = Dm.reason;
    RS.S = S; out.cases.push(RS);
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now();
  const bi = argv.indexOf('--builds'), BUILDS = bi >= 0 ? argv[bi + 1].split(',') : ALL;
  const run = k => new Promise(res => {
    const ch = spawn(process.execPath, [__filename, '--build', k], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
    ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-1500) }); });
  });
  const R = {}, q = BUILDS.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + BUILDS.length + ' builds, damage on; the bound: ' + TOL_P * 1000 + ' mm, ' + TOL_N + ' deg)');
  for (const k of BUILDS) {
    const r = R[k];
    console.log((r.label || k) + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    console.log('  the skin as the snapshot stores it: ' + r.skin.groups + ' groups, ' + r.skin.verts + ' vertices (unwelded), ' + r.skin.tris + ' triangles');
    for (const c of r.cases) {
      const S = c.S;
      console.log('  ' + c.label + ': ' + (S.crashed ? 'CRASHED (' + S.reason + ')' : 'no crash') + ', ' + S.nb + ' broken, ' + S.breakFrames + ' frames with a new break, ' + S.frames + ' frames from the first');
      if (!S.frames) { yes(false, 'the case breaks something (the skin is only ridden over a break)'); continue; }
      // the bound: 0.1 mm in the world - or, where the wreck has turned the drawn frame near-singular, 8 float32 steps of
      // the drawn coordinate mapped to the world (the CPU path's own storage is that coarse there: qCpu) - for all but 1 in
      // 100 000 vertex poses (a place whose kept weights nearly cancel blends an ill-conditioned turn: float32 moves it a
      // tenth of a millimetre; the twin's float nose-in, 24 of 2.7M), and never past 0.5 mm
      yes(S.finite && S.mirrorFrames > 0 && S.overCond <= 1e-5 * S.verts && !S.overCap && S.ambiguous <= 0.005 * S.verts, 'the shader\'s mirror = the CPU\'s exact riding: positions within ' + (S.dP * 1000).toFixed(4) + ' mm in the world over '
        + S.verts + ' vertex poses on ' + S.mirrorFrames + ' record-frames (' + S.over + ' past both 0.1 mm and 8 float32 steps of the drawn frame, ' + S.overCond + ' of them past their blend\'s float32 bound too (at most 1 in 100 000; none past 0.5 mm)'
        + (S.dPoverAt ? '; the worst past 0.1 mm ' + (S.dPover * 1000).toFixed(4) + ' mm ' + JSON.stringify(S.dPoverAt) : '') + (S.dPat ? '; worst ' + JSON.stringify(S.dPat) : '')
        + '); the CPU path\'s own float32 storage up to ' + (S.qCpu * 1000).toFixed(4) + ' mm; every one finite; ' + S.ambiguous + ' ambiguous (two turns 180 deg apart: either blend is one)');
      yes(S.dN <= TOL_N, 'the normals within ' + S.dN.toFixed(4) + ' deg (bound ' + TOL_N + ' deg)' + (S.dNat ? ' (worst ' + JSON.stringify(S.dNat) + ')' : '') + '; ' + S.zeroN + ' degenerate (nought both ways)');
      yes(S.evCmp > 0 && S.evBad === 0, 'the incremental event (a record far from the break skipped, a near one re-made where touched) = the full event, byte for byte (every triangle\'s state and index; every place bound in both), at each of '
        + S.evCmp + ' record-events (' + S.evSkipped + ' skipped whole; the weights compared on places bound in both - up to ' + (S.evUnbound || 0) + ' places a record bound a frame or two apart)' + (S.evBadAt ? ' - FIRST DIFFERENCE ' + JSON.stringify(S.evBadAt) : ''));
      yes(S.cpuFallback === 0, 'every record rides on the GPU (' + S.gpuRecs + ' records, ' + S.cpuFallback + ' on the CPU); bindings pruned past 8 slots: ' + S.pruned);
      // the tear: on the GPU's own positions a frame old, at the CPU's cadence - within 1 % of the full tear's triangles
      // missed, none later than a check and a frame (an edge stretching fast stands past the bound that frame longer:
      // reported, the worst live edge on any frame, both ways)
      // (train 39: both tears are SAMPLED - the CPU's every TEAR_FRAMES on the frame's positions, the GPU's from half that on
      // the read-back a frame old: an edge past the bound only between the GPU's samples is torn by one and not the other.
      // A miss is held to 5 % of the CPU's tears (and 3 at least); tearPlaces = tear() on the same positions by construction)
      // ...and (the coordinator's conditions for 39) every miss a transient: on the GPU path its edges stood past the bound
      // no longer than one GPU sampling period; no live edge past the bound longer than that period on either path; a tear
      // the GPU path makes later than the CPU's, within it
      // (train 41: the GPU path samples the CPU's frames - the misses back to the 1 % / 3 of the CPU tear's own phase)
      yes(S.missed <= Math.max(3, 0.01 * S.tornC) && (S.missRun || 0) <= PERIOD_G && (S.runG || 0) <= PERIOD_G && (S.runC || 0) <= PERIOD_G && S.lateMax <= PERIOD_G && (S.lateBorder || 0) <= Math.max(3, 0.01 * S.tornC),
        'the tear on the read-back places: ' + S.tornG + ' torn (the CPU\'s full tear ' + S.tornC + '): ' + S.missed + ' it tore that this still draws (' + S.goneOther + ' more gone here by an event instead), ' + S.late + ' later (up to '
        + S.lateMax + ' frames), ' + S.early + ' earlier; the worst live edge past the bound on any frame ' + (S.excessG * 1000).toFixed(1) + ' mm (the CPU\'s ' + (S.excessC * 1000).toFixed(1) + ' mm)'
        + (S.heldMax != null ? '; FABRIC held covering (the CPU path): up to ' + S.heldMax + ' triangles held at once (' + (S.heldMaxB || 0) + ' before the reach fix, which drew ' + (S.goneB || 0) + ' gone against ' + (S.goneC || 0) + ' now at the end), ' + (S.heldTorn || 0) + ' torn past HELD' : '')
        + '; the longest a live edge stood past the bound: GPU path ' + (S.runG || 0) + ' frames, CPU ' + (S.runC || 0) + ' (one GPU sampling period: ' + PERIOD_G + ')'
        + (S.lateBorder ? '; ' + S.lateBorder + ' torn later past one period that the CPU tore within 0.2 mm of the bound (float32\'s reach: up to ' + S.lateBorderMax + ' frames)' : '')
        + (S.lateAt ? '; the first late past one period ' + JSON.stringify(S.lateAt) : '')
        + (S.missedAt ? '; misses (transients between the read-backs, past the bound at most ' + (S.missRun || 0) + ' frames on the GPU path) ' + JSON.stringify(S.missedAt) : ''));
      const f = (x, k) => (x / Math.max(1, k)).toFixed(2);
      console.log('    the cost (node): a check - the full tear ' + f(S.ms.tear, S.checksC) + ' ms (' + S.checksC + '), on the read-back places ' + f(S.ms.tearPl, S.checks) + ' ms (' + S.checks + '); packing the stale places '
        + S.ms.pack.toFixed(1) + ' ms in all; the CPU riding (what the GPU now does) ' + f(S.ms.pose, S.frames) + ' ms a frame; the nodes\' frames ' + f(S.ms.nodes, S.frames) + ' ms a frame; the events ' + S.ms.event.toFixed(1) + ' ms in all');
    }
  }
  // 3. the page's code: the GPU path only past the damage state's guard; no material or program touched; nothing at load
  {
    const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), gpu = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'skin_gpu.js'), 'utf8');
    const cage = app.slice(app.indexOf('function brkCage('), app.indexOf('// ---- G1826') > 0 ? app.indexOf('// ---- G1826') : app.indexOf('// ---- G1860-G1863'));
    const guard = /function brkCage\([^)]*\) \{\s*const D = brkState\(\);\s*if \(!D \|\| model\.gen\) return;/.test(app);
    const gpuCalls = (app.match(/brkGpu\(K\);/g) || []).length, inCage = cage.indexOf('const GP = brkGpu(K);') > 0;
    const prep = (app.match(/SKIN_GPU\.prepare\(/g) || []).length, prepIn = /function brkGpu\(K\) \{[\s\S]{0,400}SKIN_GPU\.prepare\(renderer\);/.test(app);
    yes(guard && gpuCalls === 1 && inCage && prep === 1 && prepIn, 'app.js: the GPU riding (brkGpu) is reached once, inside brkCage past the damage state\'s guard (nothing broken: it returns first); its program is linked only there (at the first break)');
    const code = t => t.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');   // (the comments say why; the code is checked)
    const g18 = app.slice(app.indexOf('// ---- G1818 (DMG-SKINGPU): THE RIDING ON THE GPU'), app.indexOf('const brkCageOn = () =>'));
    const touch = /onBeforeCompile|customProgramCacheKey|\.material\b|needsUpdate\s*=\s*true[^;]*material|defines/;
    yes(g18.length > 500 && !touch.test(code(g18)) && !/onBeforeCompile|customProgramCacheKey|\.material\b|\.defines/.test(code(gpu)),
      'no material, program key, define or onBeforeCompile is touched by the GPU riding (app.js G1818 block, skin_gpu.js): the drawn buffers change, never a program');
    const fake = { getContext: () => null }, before = Object.keys(SG.G).map(k => SG.G[k] && typeof SG.G[k] === 'object' ? 'o' : SG.G[k]).join();
    yes(SG.G.prog === null && SG.G.ok === null && !/^\s*(gl|THREE)\./m.test(gpu.slice(gpu.indexOf('(function () {'), gpu.indexOf('const G = {'))),
      'skin_gpu.js makes nothing at load (no program, no GL object; node loads it bare)');
    SG.prepare(fake); yes(SG.G.ok === false && !SG.G.prog, 'without WebGL2 the program is never made and the CPU rides (' + SG.G.err + ')'); void before;
    // G1818: the rows a wreck rides whole are not posed by the rig loops - only while breaks are on the page, only a
    // record that overwrites every position and normal (active, rideAll, its rest normals); nothing broken: the base's loops
    const pm = code(app.slice(app.indexOf('const brkW = '), app.indexOf('// G239: ...AND THE RODS AND CABLES') + 400));
    const wOk = /const brkW = !still && !model\.gen && window\.FLYDIY_SKINBREAK !== false && window\.FLYDIY_BRK_RIGSKIP !== false && BRK\.recs\.length > 0 && \(\(\) => \{ const D = dmgNow\(\); return !!\(D && D\.br\.length\); \}\)\(\);/.test(pm)
      && /const brkWhole = brkW \? \(r => \{ const R = r\.brkR; return !!\(R && R\.active && R\.rideAll && R\.nB && R\.nAttr\); \}\) : \(\) => false;/.test(pm);
    const skips = (pm.match(/if \(brkWhole\((r|s)\)\) continue;/g) || []).length;
    yes(wOk && skips === 6, 'app.js poseModel: a group the wreck rides whole skips its rig row (' + skips + ' rows: rigs, struts, legs, surfaces, anchored, links) only while the page holds a break, only for an active whole-riding record with its rest normals; nothing broken: every row as the base');
    // G1818 (the box, 12:50): under the physics worker the page's sim is the view's mirror - its damage state too
    const link = code(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'sim_link.js'), 'utf8'));
    const att = link.slice(link.indexOf('function attach()'), link.indexOf('function detach()'));
    const savedL = (/for \(const k of \[([^\]]*)\]\) saved\[k\] = own\(k\);/.exec(att) || [])[1] || '';
    yes(/'dmgState'/.test(savedL) && /def\('dmgState',\s*\{[^}]*value:\s*\(\)\s*=>\s*V\.dmgState\(\)/.test(att)
      && /function dmgNow\(\) \{\s*if \(!sim\) return null;\s*if \(sim\.dmgState\) return sim\.dmgState\(\);/.test(app),
      'sim_link.js attach mirrors the view\'s damage state on the page\'s sim (saved and given back at detach) and app.js dmgNow reads it first: under the worker the breaks reach the page (GATE DMGPAGEW flies it)');
  }
  // 4. the shader's text carries the mirror's steps
  {
    const V = SG.RIDE_VS;
    const steps = ['for (int a = 0; a < 8; a++)', 'q += (dot(qi, q0) < 0.0 ? -w[a] : w[a]) * qi;', 'l += w[a] * texelFetch(uNd, ivec2(2 * id[a], 0), 0).xyz;',
      'float L = length(q); if (L > 0.0) q /= L;', 'vec3 p = (l + qrot(q, A.xyz)) + A.w * uDown;', 'vPos = uMi * p - uPx;', 'vec3 n = uBt * qrot(q, aN0);',
      'return v + q.w * t + cross(q.xyz, t);', 'vec3 t = 2.0 * cross(q.xyz, v);'];
    const miss = steps.filter(x => V.indexOf(x) < 0);
    yes(!miss.length, 'RIDE_VS carries the mirror\'s steps (the 8 slots on the dominant\'s hemisphere, the normalised turn, the offset turned, the drape, the frame, B^T n)' + (miss.length ? ' - MISSING ' + JSON.stringify(miss) : ''));
  }
  const outI = argv.indexOf('--out');
  if (outI >= 0) { fs.mkdirSync(path.dirname(argv[outI + 1]), { recursive: true }); fs.writeFileSync(argv[outI + 1], JSON.stringify(R, null, 1)); }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGSKINGPU: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
