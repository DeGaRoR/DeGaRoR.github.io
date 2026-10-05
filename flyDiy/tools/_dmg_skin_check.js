#!/usr/bin/env node
// GATE DMGSKIN (G1850-G1853, DMG-D4a SKIN) - THE SKIN OVER A BREAK, node only (DEFORM-AND-BREAK §2.5, §5.1, §8.4; TREE-CRASH's
// G1474 owed it). On the user's validated builds, damage ON (params.damage true), on the crash cases of GATE TREECRASH /
// DMGINTEGRITY - the 30 m/s trunk on the centreline and 2.5 m out, the severe ground nose-in (180 km/h, 10 m/s, 60 deg) on
// the land builds; the severe float nose-in (150 km/h, 10 m/s, 60 deg) on the floatplanes:
//   1. THE HOP (G1850): the broken list, the pieces and the sets reach the page the same inline (app.js: the hop on the
//      page's own sim) and under the worker (makeSimHost on its own sim, H.step, each snapshot's meta through a structured
//      clone into sim_view.js's state) - at EVERY step the broken list and the pieces are equal, the sets equal once the
//      hop's 0.1 s window has passed; the pieces are DMG-D1b's (the gate's own union-find: the live members and the
//      clusters still on). Its cost in the crash (payloads, bytes, ms) and with nothing broken (a FAR 23.473 drop: no
//      payload, no byte; the per-snapshot check in us).
//   2. THE SKIN (G1851 / G1852): the generator's own node-bound skin - genWing's groups (the covering, the surfaces,
//      the struts) and every member drawn as its tube (genBeamInto) - posed through poseSkinGen with skin_break.js's
//      records, and the same meshes bound as the flown cage snapshot is (skin_break.bindNearest, its rigid core,
//      poseCage). From the first break to the run's end, EVERY frame: no live triangle spans two pieces (each vertex's
//      kept nodes against the gate's own union-find) or a broken member's pair; no live triangle's edge is longer than
//      (1 + TEAR) x its rest length - TEAR = 0.15, the skin's elongation at break (doped fabric 15-20 %, AC 43.13-1B
//      Table 2-1, GEN_CRASH.fabric.etu; 2024-T3 sheet 15 %, MIL-HDBK-5J 3.2.3.0(b)); every position finite. Reported:
//      the triangles removed (on two pieces / across a broken member) and torn (stretched), the pieces carried, the
//      rigid fits' residual, the drape's deepest sag.
//   3. NOTHING CHANGES WITH NOTHING BROKEN: with the layer off, no payload is ever sent and poseSkinGen (with an idle
//      record passed) is BITWISE the base's loop (frozen below) on every frame of the crash; with it on, every frame
//      before the first break likewise.
//   4. app.js calls the skin's break path only through brkGen / brkCage, each behind the one damage state (static).
// Run: node tools/_dmg_skin_check.js [--out <file.json>]   (one final `GATE DMGSKIN: PASS|FAIL`; the builds in children)
'use strict';
const path = require('path'), fs = require('fs'), v8 = require('v8');
const argv = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const L = require('./_treecrash_lib.js');
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));

const SEVERE = { V: 50, sink: 10, pitch: 60, secs: 4 };                   // GATE TREECRASH's severe nose-in, on the ground
const WATER_SEVERE = { V: 150 / 3.6, sink: 10, pitch: 60, secs: 4 };      // its severe float nose-in
const BUILDS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
const casesOf = k => /floats/i.test(k)
  ? [{ id: 'nosein-water', label: 'a severe float nose-in (150 km/h, 10 m/s, 60 deg)', kind: 'water', o: WATER_SEVERE }]
  : [{ id: 'trunk-0', label: 'a trunk at 30 m/s, the centreline', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 0 } },
     { id: 'trunk-2.5', label: 'a trunk at 30 m/s, the wing 2.5 m out', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 2.5 } },
     { id: 'nosein-ground', label: 'a severe nose-in on the ground (180 km/h, 10 m/s, 60 deg)', kind: 'ground', o: SEVERE }];

// THE BASE'S poseSkinGen, frozen (63_gen_wing.js before G1851): what "nothing changes" is measured against
function poseSkinGenBase(g, rest, live, base, pos, gain, hinged, GEN_INFL) {
  const { wi, ww, nv } = g;
  for (let v = 0; v < nv; v++) {
    let dx = 0, dy = 0, dz = 0;
    for (let k = 0; k < GEN_INFL; k++) {
      const o = v * GEN_INFL + k, w = ww[o];
      if (w === 0) continue;
      const i3 = wi[o] * 3;
      dx += w * (live[i3] - rest[i3]);
      dy += w * (live[i3+1] - rest[i3+1]);
      dz += w * (live[i3+2] - rest[i3+2]);
    }
    dx *= gain; dy *= gain; dz *= gain;
    const o3 = v * 3;
    if (hinged && hinged[v]) { pos[o3] += dx; pos[o3+1] += dy; pos[o3+2] += dz; }
    else { pos[o3] = base[o3] + dx; pos[o3+1] = base[o3+1] + dy; pos[o3+2] = base[o3+2] + dz; }
  }
}

// ---- the cases, set up as TREE-CRASH / DMGINTEGRITY set them up (DMGFPS's `go`, plus the ground nose-in), with `hook`
// called on the sim as it is made (the worker host is made on it there, as DMGFPS makes it) ----
function go(k, c, damage, hook) {
  const C = L.core(), o = c.o, d0 = L.defOf(k), def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage }) });
  const mk = W => { const s = C.makeSim(def, W); if (hook) hook(s, def, W); return s; };
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
  if (c.kind === 'trunk') {   // _treecrash_lib.js atTrunk / flyRun
    const elev = 300, { W, TH, strip } = L.flatWorld(elev), sim = mk(W);
    sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
    if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
    if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
    const c0 = sim.cgPos().slice(), off = o.off || 0, tk = { r: 0.3, h: 10.05, sink: 0 };
    TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev - tk.sink, tk.r, elev - tk.sink + tk.h]);
    sim.ctl.thr = o.thr == null ? 0 : o.thr;
    return { sim, def, N: o.secs * 60 };
  }
  if (c.kind === 'ground') {  // _dmg_integrity_lib.js groundCase
    const { W } = L.flatWorld(0), sim = mk(W); sim.reset(0);
    pitchAndDrop(sim, () => 0);
    return { sim, def, N: o.secs * 60 };
  }
  // _treecrash_lib.js waterCase
  const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = mk(world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  pitchAndDrop(sim, c0 => world.waterH(c0[0], c0[2]));
  return { sim, def, N: o.secs * 60 };
}

// the gate's own pieces: the live members and the clusters still on (DMG-D1b's rule, not the hop's code)
function piecesOf(sim) {
  const n = sim.n, P = new Int32Array(n); for (let i = 0; i < n; i++) P[i] = i;
  const f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; };
  for (const b of sim.beams) if (!b.broken) { const x = f(b.a), y = f(b.b); if (x !== y) P[x] = y; }
  for (const C of sim.clusterCuts().clusters) if (!C.off) for (const i of C.nodes) { const x = f(i), y = f(C.nodes[0]); if (x !== y) P[x] = y; }
  const out = new Int32Array(n); for (let i = 0; i < n; i++) out[i] = f(i);
  return out;
}
const samePartition = (a, b) => { if (!a || !b) return false; const m = new Map(), r = new Map();
  for (let i = 0; i < a.length; i++) { if (m.has(a[i]) && m.get(a[i]) !== b[i]) return false; if (r.has(b[i]) && r.get(b[i]) !== a[i]) return false; m.set(a[i], b[i]); r.set(b[i], a[i]); } return true; };

if (argv[0] === '--build') {
  const k = argv[1], C = L.core(), out = { key: k, label: L.BUILDS[k].label, cases: [] };
  const d0 = L.defOf(k), core = d0.refs.noseFrame[0], n = d0.nodes.length;
  // ---- the skins: the generator's wing payload and every member as its tube, in genRestFrame's frame ----
  const W = C.genWing(d0), FR = C.genRestFrame(d0), rest = W.rest, oNode = FR.to(C.defOrigin(d0));
  // (genBeamInto's tube radius is by class and has no 'tail' row - the generator never drew the tail's members: drawn here as the fuselage's)
  const M = C.genMesh(); for (const b of d0.beams) C.genBeamInto(M, b.cls === 'tail' ? Object.assign({}, b, { cls: 'fus' }) : b, d0.nodes, FR.to);
  const fab = /fabric|steel|aluFabric/.test(C.genSurfKey(d0.spec, 'wing', 0));
  const meshes = Object.keys(W.groups).map(nm => ({ nm, g: W.groups[nm], fabric: fab && /^(skin|ail|flap)/.test(nm) })).concat([{ nm: 'members', g: M.done(), fabric: false }]);
  out.skin = { groups: meshes.length, verts: meshes.reduce((a, m) => a + m.g.nv, 0), tris: meshes.reduce((a, m) => a + m.g.nt, 0), fabric: fab };
  const T = SB.topo(d0.beams, n), K0 = C.GEN_INFL;
  for (const c of casesOf(k)) {
    const R = { id: c.id, label: c.label };
    // ---- 1. the hop: inline (the page's own sim) and through the worker host, step by step ----
    const IN = go(k, c, true), simI = IN.sim;
    let H = null;
    const WK = go(k, c, true, (s, def, Wd) => { H = SH.makeSimHost(C, { keepSim: { def, sim: s }, day: false, withV: true, world: {} }, Wd); }), simW = WK.sim;
    H.started = true; H.manual = true; H.hand = null; H.ap = { t: 0, box: null, phase: 'FLY', report: null };
    H.end = { air: false, wasAir: false, still: 0, over: false };
    const hopI = SH.simDmgHop0(), stI = SV.simViewDmgState(n, d0.beams.length), stW = SV.simViewDmgState(n, d0.beams.length);
    // the skins' records (generated: own weights; cage: nearest-node binding) and their positions
    const recs = meshes.map(m => {
      const idxG = m.g.idx.slice(), idxC = m.g.idx.slice();
      // the generated skin's record (app.js brkGen): its whole binding at the first break; the cage's (brkCage): its
      // nearest nodes, then the full binding where the breaks are - both made lazily, as the page makes them
      return { m, RG: null, RC: null, idxG, idxC, posG: m.g.pos.slice(), posC: m.g.pos.slice(), posB: m.g.pos.slice() };
    });
    const mkRecs = () => { for (const r of recs) if (!r.RG) {
      const t0 = process.hrtime.bigint();
      const bn = SB.bindNearest(r.m.g.pos, r.m.g.nv, rest, n);
      r.RG = SB.make({ nv: r.m.g.nv, idx: r.idxG, wi: bn.wi, ww: bn.ww }, SB.NEAR_K, { fabric: r.m.fabric });
      const t1 = process.hrtime.bigint();
      r.RC = SB.make({ nv: r.m.g.nv, idx: r.idxC }, SB.NEAR_K, { fabric: r.m.fabric, cage: true, pos: r.m.g.pos, rest });
      S.bindG += Number(t1 - t0) / 1e6; S.bindC += Number(process.hrtime.bigint() - t1) / 1e6;
    } };
    const IDLE = { active: false };          // an idle record: what poseSkinGen is handed before anything breaks
    const NF = {}, live = new Float32Array(n * 3);
    const S = { steps: 0, mismatch: 0, firstMis: null, setMis: 0, piecesMis: 0, frames: 0, breakFrames: 0, bitwiseBefore: 0, bitwiseBad: 0,
                span: 0, spanBad: null, crossBroken: 0, stretch: 1, excess: -Infinity, stretchAt: null, finite: true, removedG: 0, tornG: 0, removedC: 0, tornC: 0,
                pieces: 1, detachedSkin: 0, sagMax: 0, nb: 0, nfMs: 0, nfN: 0, bindG: 0, bindC: 0, eventMs: 0, events: 0, poseMs: 0, poses: 0 };
    let nbSeen = 0;
    for (let s = 1; s <= IN.N; s++) {
      simI.step(1 / 60); H.step(true);
      // the inline hop, every step (app.js dmgNow: no window); the host's meta, every step (a snapshot a step: the strictest)
      const PI = SH.simDmgHop(simI, hopI, core, 0); if (PI) SV.simViewDmgApply(stI, PI);
      const meta = H.meta(); if (meta.dmgB) SV.simViewDmgApply(stW, v8.deserialize(v8.serialize(meta.dmgB)));
      S.steps = s;
      const brEq = stI.br.length === stW.br.length && stI.br.every((x, i) => x === stW.br[i]);
      const pcEq = (!stI.pc && !stW.pc) || (stI.pc && stW.pc && stI.pc.every((x, i) => x === stW.pc[i]));
      if (!brEq || !pcEq) { S.mismatch++; if (!S.firstMis) S.firstMis = { s, br: [stI.br.length, stW.br.length], pc: !pcEq }; }
      // the sets: equal once the window has passed (at the end, and whenever the host has just sent them)
      if (meta.dmgB && meta.dmgB.st) { const same = stI.set.every((x, i) => x === stW.set[i]); if (!same) S.setMis++; }
      // ---- 2. the skin, from the first break ----
      C.genNodeBody(simI, live, oNode);
      const D = stI;
      if (!D.br.length) {
        // 3. nothing broken: poseSkinGen with an idle record is the base's loop, bit for bit
        for (const r of recs) {
          const a = r.posB, b = r.posG;
          poseSkinGenBase(r.m.g, rest, live, r.m.g.pos, a, 1, null, K0);
          C.poseSkinGen(r.m.g, rest, live, r.m.g.pos, b, 1, null, { R: IDLE, NF, down: [0, -1, 0], poseGen: SB.poseGen });
          S.bitwiseBefore++; if (Buffer.compare(Buffer.from(a.buffer), Buffer.from(b.buffer)) !== 0) S.bitwiseBad++;
        }
        continue;
      }
      S.frames++; mkRecs();
      const brokeNow = D.br.length !== nbSeen; nbSeen = D.br.length; if (brokeNow) S.breakFrames++;
      const own = piecesOf(simI);
      if (!samePartition(own, D.pc || new Int32Array(n))) S.piecesMis++;
      const [xA, yU] = simI.axes(), zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]], down = [-xA[1], -yU[1], -zL[1]];
      { const t0 = process.hrtime.bigint(); SB.nodeFrames(NF, T, D, rest, live); S.nfMs += Number(process.hrtime.bigint() - t0) / 1e6; S.nfN++; }
      const BP = SB.brokenPairs(T, D);
      for (const r of recs) {
        const g = r.m.g;
        { const t0 = process.hrtime.bigint(); if (SB.event(r.RG, T, D, rest, g.pos) | SB.event(r.RC, T, D, rest, g.pos)) { S.events++; S.eventMs += Number(process.hrtime.bigint() - t0) / 1e6; } }
        C.poseSkinGen(g, rest, live, g.pos, r.posG, 1, null, { R: r.RG, NF, down, poseGen: SB.poseGen });
        SB.tear(r.RG, g.pos, r.posG);
        r.posC.set(g.pos);                          // the cage's own pose of an intact part: rigid in the body frame
        SB.poseCage(r.RC, rest, live, g.pos, r.posC, NF, down, null);
        SB.tear(r.RC, g.pos, r.posC);
        for (const [RR, pos] of [[r.RG, r.posG], [r.RC, r.posC]]) {
          for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) { S.finite = false; break; }
          const ws = SB.worstStretch(RR, g.pos, pos);
          if (ws.ex > S.excess) { S.excess = ws.ex; S.stretchAt = { t: +simI.t.toFixed(3), mesh: r.m.nm, cage: RR === r.RC, tri: ws.t }; }
          if (ws.m > S.stretch) S.stretch = ws.m;
          // every live triangle: its vertices' kept nodes on one piece (the gate's own), no broken pair among its dominants
          const i0 = RR.idx0, Kk = RR.K;
          for (let t = 0; t < RR.nt; t++) {
            if (RR.dead[t]) continue;
            let piece = -1, bad = false;
            for (let q = 0; q < 3 && !bad; q++) { const v = i0[t * 3 + q];
              for (let kk = 0; kk < Kk; kk++) if (RR.w2[v * Kk + kk] > 0) { const p = own[RR.wi[v * Kk + kk]]; if (piece < 0) piece = p; else if (p !== piece) { bad = true; break; } } }
            if (bad) { S.span++; if (!S.spanBad) S.spanBad = { t: +simI.t.toFixed(3), mesh: r.m.nm, cage: RR === r.RC, tri: t }; }
            const a = RR.dom[i0[t * 3]], b = RR.dom[i0[t * 3 + 1]], cc = RR.dom[i0[t * 3 + 2]];
            if (BP.has(a, b) || BP.has(b, cc) || BP.has(a, cc)) S.crossBroken++;
          }
          if (RR.sag) for (let v = 0; v < RR.nv; v++) if (RR.sag[v] > S.sagMax) S.sagMax = RR.sag[v];
        }
      }
      // the detached pieces: how many skin vertices ride them
      if (D.pc) {
        S.pieces = Math.max(S.pieces, D.nPc);
        let dv = 0; for (const r of recs) for (let v = 0; v < r.RC.nv; v++) if (r.RC.vp[v] > 0) dv++;
        S.detachedSkin = Math.max(S.detachedSkin, dv);
      }
    }
    // the sets at the end, past the window (the host's last send)
    for (let j = 0; j < 7; j++) { simW.step(1 / 60); simI.step(1 / 60); const PI = SH.simDmgHop(simI, hopI, core, 0); if (PI) SV.simViewDmgApply(stI, PI); const m2 = H.meta(); if (m2.dmgB) SV.simViewDmgApply(stW, v8.deserialize(v8.serialize(m2.dmgB))); }
    S.setsEnd = stI.set.every((x, i) => x === stW.set[i]);
    for (const r of recs) { S.removedG += r.RG.removed; S.tornG += r.RG.torn; S.removedC += r.RC.removed; S.tornC += r.RC.torn; }
    const Dm = simI.damage();
    S.nb = Dm.broken.length; S.crashed = Dm.crashed; S.reason = Dm.reason; S.groups = Dm.groups.map(g => g.key);
    S.hop = { sends: H.dmgSends, bytes: H.dmgBytes, ms: +H.dmgMs.toFixed(3), perSend: H.dmgSends ? Math.round(H.dmgBytes / H.dmgSends) : 0 };
    R.S = S;
    // ---- 3. the layer off: no payload; the skin the base's, bit for bit, on every frame ----
    {
      const OFF = go(k, c, false), sim = OFF.sim, hop = SH.simDmgHop0(); let sends = 0, frames = 0, bad = 0;
      const liveO = new Float32Array(n * 3);
      for (let s = 1; s <= OFF.N; s++) {
        sim.step(1 / 60);
        if (SH.simDmgHop(sim, hop, core, 0)) sends++;
        C.genNodeBody(sim, liveO, oNode);
        for (const r of recs) {
          const a = r.posB, b = r.posG;
          poseSkinGenBase(r.m.g, rest, liveO, r.m.g.pos, a, 1, null, K0);
          C.poseSkinGen(r.m.g, rest, liveO, r.m.g.pos, b, 1, null, null);
          frames++; if (Buffer.compare(Buffer.from(a.buffer), Buffer.from(b.buffer)) !== 0) bad++;
        }
      }
      R.off = { sends, frames, bad, broken: sim.damage().broken.length };
    }
    out.cases.push(R);
  }
  // ---- the hop with nothing broken: a FAR 23.473 drop through the host (nothing yields) - no payload, no byte; and the
  // check a snapshot costs (us) ----
  {
    let H = null;
    const def = L.defOf(k), probe = C.makeSim(def, null);
    let Wd, strip;
    if (probe.hydro) { Wd = C.makeWorld(); strip = Wd.aerodromes.find(a => a.id === 'SEA'); } else ({ W: Wd, strip } = L.flatWorld(0));
    const sim = C.makeSim(def, Wd); H = SH.makeSimHost(C, { keepSim: { def, sim }, day: false, withV: true, world: {} }, Wd);
    sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, probe.hydro ? {} : { elev: 0, spawnElev: 0 }));
    H.started = true; H.manual = true; H.hand = null; H.ap = { t: 0, box: null, phase: 'FLY', report: null }; H.end = { air: false, wasAir: false, still: 0, over: false };
    for (let f = 0; f < 240; f++) { H.step(true); H.meta(); }
    const sink = L.far473(k);
    for (let i = 0; i < sim.n; i++) { sim.p[i*3+1] += 0.02; sim.v[i*3] = 0; sim.v[i*3+1] = -sink; sim.v[i*3+2] = 0; }
    let keys = 0;
    for (let f = 0; f < 120; f++) { H.step(true); const m = H.meta(); if ('dmgB' in m) keys++; }
    const hop = SH.simDmgHop0(), N = 20000, t0 = process.hrtime.bigint();
    for (let q = 0; q < N; q++) SH.simDmgHop(sim, hop, core);
    out.calm = { sends: H.dmgSends, bytes: H.dmgBytes, keys, yields: sim.damage().yields, us: Number(process.hrtime.bigint() - t0) / N / 1000 };
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now();
  const run = k => new Promise(res => {
    const ch = spawn(process.execPath, [__filename, '--build', k], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
    ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-1500) }); });
  });
  const R = {}, q = BUILDS.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + BUILDS.length + ' builds, damage on; TEAR ' + SB.TEAR + ')');
  for (const k of BUILDS) {
    const r = R[k];
    console.log((r.label || k) + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    console.log('  the skin measured: ' + r.skin.groups + ' groups (genWing\'s and every member\'s tube), ' + r.skin.verts + ' vertices, ' + r.skin.tris + ' triangles; the wing ' + (r.skin.fabric ? 'fabric' : 'not fabric'));
    for (const c of r.cases) {
      const S = c.S;
      console.log('  ' + c.label + ': ' + (S.crashed ? 'CRASHED (' + S.reason + ')' : 'no crash') + ', ' + S.nb + ' broken, ' + S.breakFrames + ' frames with a new break, the skin checked on ' + S.frames + ' frames; pieces up to ' + S.pieces);
      yes(S.mismatch === 0, 'the hop: inline and through the worker the same broken list and pieces at every one of ' + S.steps + ' steps' + (S.firstMis ? ' - FIRST MISMATCH ' + JSON.stringify(S.firstMis) : ''));
      yes(S.setsEnd && S.setMis === 0, 'the hop: the sets the same whenever the host sends them, and at the end past its window');
      yes(S.piecesMis === 0, 'the hop\'s pieces are DMG-D1b\'s (the gate\'s own union-find of the live members and clusters) on every frame');
      yes(S.hop.sends > 0 && S.hop.bytes > 0, 'the hop\'s cost in the crash: ' + S.hop.sends + ' payloads over ' + S.steps + ' snapshots, ' + S.hop.bytes + ' bytes (' + S.hop.perSend + ' a payload), ' + S.hop.ms + ' ms building them');
      if (S.frames) {
        yes(S.span === 0, 'no live skin triangle spans two pieces (generated and cage bindings, every frame from the first break)' + (S.spanBad ? ' - ' + JSON.stringify(S.spanBad) : ''));
        yes(S.crossBroken === 0, 'no live triangle spans a broken member (its vertices\' dominant nodes joined only by broken members)');
        yes(S.excess <= 1e-6, 'no live triangle edge past (1 + ' + SB.TEAR + ') x its rest + ' + SB.TEAR_ABS * 1000 + ' mm: the worst ' + (S.excess * 1000).toFixed(2) + ' mm from it'
          + (S.stretchAt ? ' (' + JSON.stringify(S.stretchAt) + ')' : '') + '; the worst stretch of an edge of 2 cm or more ' + S.stretch.toFixed(4));
        yes(S.finite, 'every skin position finite');
      }
      console.log('    the cost (node): the first break\'s binding ' + S.bindG.toFixed(1) + ' ms generated (whole), ' + S.bindC.toFixed(1) + ' ms cage (nearest nodes; ' + r.skin.verts + ' vertices); '
        + S.events + ' events, ' + (S.events ? (S.eventMs / S.events).toFixed(2) : '-') + ' ms each (both records of every group)');
      console.log('    removed (two pieces / a broken member): generated ' + S.removedG + ', cage ' + S.removedC + '; torn (stretched past TEAR): generated ' + S.tornG + ', cage ' + S.tornC
        + '; vertices on detached pieces up to ' + S.detachedSkin + '; the drape\'s deepest sag ' + (S.sagMax * 100).toFixed(1) + ' cm; the nodes\' frames ' + (S.nfN ? (S.nfMs / S.nfN).toFixed(3) : '-') + ' ms a frame');
      yes(S.bitwiseBad === 0 && (S.bitwiseBefore > 0 || S.frames >= S.steps - 1), 'before the first break poseSkinGen (an idle record passed) is the base\'s loop bit for bit (' + S.bitwiseBefore + ' group poses' + (S.bitwiseBefore ? '' : ': it broke on the first step') + ')');
      yes(c.off.sends === 0 && c.off.bad === 0 && c.off.frames > 0, 'damage OFF: no payload (' + c.off.sends + '), ' + c.off.broken + ' broken, the skin the base\'s bit for bit on every frame (' + c.off.frames + ' group poses)');
    }
    const z = r.calm;
    yes(z.sends === 0 && z.bytes === 0 && z.keys === 0 && z.yields === 0, 'nothing broken (a FAR 23.473 drop through the host, ' + z.yields + ' yields): no payload, no byte, no key in the meta; the check ' + z.us.toFixed(3) + ' us a snapshot');
  }
  // 4. app.js: the break path only behind the damage state
  {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    const calls = (src.match(/SKIN_BREAK\.|SB\.(event|fit|poseCage|tear|bindNearest)/g) || []).length;
    const okGen = /const BK = brkGen\(gain\);/.test(src) && /function brkGen\(gain\) \{\s*const D = brkState\(\);\s*if \(!D\) return null;/.test(src);
    const okCage = /function brkCage\([^)]*\) \{\s*const D = brkState\(\);\s*if \(!D \|\| model\.gen\) return;/.test(src);
    const okState = /if \(!D \|\| !D\.br\.length\) \{/.test(src);
    yes(okGen && okCage && okState, 'app.js: the skin\'s break path (' + calls + ' calls) runs only through brkGen / brkCage, each returning at once unless the damage state holds a broken member');
  }
  const outI = argv.indexOf('--out');
  if (outI >= 0) { fs.mkdirSync(path.dirname(argv[outI + 1]), { recursive: true }); fs.writeFileSync(argv[outI + 1], JSON.stringify(R, null, 1)); }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGSKIN: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
