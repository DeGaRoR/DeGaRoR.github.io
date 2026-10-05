#!/usr/bin/env node
// G1865 (DMG-D4b WRECK DRAWN): GATE DMGWRECK - the wreck's non-member parts (src/viewer/wreck_debris.js), node only, on
// TREECRASH / DMGINTEGRITY / DMGSKIN's crash cases on the five validated builds (the user's Cub
// builds/cub_2026-09-20_corrected.json, the Jodel, the metal Cessna, the Cessna on floats, the twin on floats), the damage
// state read as the page reads it inline (sim_host.js simDmgHop -> sim_view.js simViewDmgApply, app.js dmgNow):
//   1. THE DEBRIS (G1860): each case's candidates - the cowl, the spinner, the wheels, the windscreen (their carrying
//      node sets by WRECK_DEBRIS.carry, the boxes the page measures off the drawn parts stood in for by the frame's own
//      sizes) - which leave and why (their set off the core / crushed past CRUSH), and every body: finite, asleep
//      within LIFE, at rest on the ground or the water (its lowest corner within 3 cm of the surface it rests on, never
//      under it), the same rest whatever the frame rate (stepped at 60 and at 12 frames a second);
//   2. THE PROP STRIKE (G1861): the seized engines - the strike's energy, bend or break by WRECK_DEBRIS.strike (the
//      3 m/s taxi into a trunk bends, the 30 m/s impacts break a blade), seeded (the same strike, the same answer), a
//      broken blade's body at rest; the curl and the dent on a drawn prop (a synthetic two-blade prop and spinner: the
//      tips move aft, each blade keeps its length, the dent only on the strike's side);
//   3. THE CLIP ON THE WRECK (G1862, §8.5 at the end states): no debris body's corner inside a live cabin bay of the core
//      deeper than 5 cm (DMG-D1b's probe margin), the wreck's own non-body nodes in the bays (DMG-D1b's pass-through
//      probe) reported against D1b's own numbers;
//   4. THE COCKPIT CAMERA RULE (G1863): the eye's bay at the end of each case - crushed or clear, and why;
//   5. NOTHING NEW WITH NOTHING BROKEN: damage OFF, every case: no payload, no candidate leaves, no strike drawn; damage
//      ON with nothing broken (a FAR 23.473 drop): no release, no strike; and the wreck layer only READS - the same crash
//      flown with it and without it ends on the same bits (FNV of p and v);
//   6. app.js: the wreck path only behind the damage state (wreckFrame returns at once with nothing damaged).
//   node tools/_dmg_wreck_check.js [--out file.json] [--report]
// The runner's contract: exactly one `GATE DMGWRECK: PASS|FAIL`, exit code to match.
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const L = require('./_treecrash_lib.js');
const IL = require('./_dmg_integrity_lib.js');
const WD = require(path.join(ROOT, 'src', 'viewer', 'wreck_debris.js'));
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));

const BUILDS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
const SEVERE = { V: 50, sink: 10, pitch: 60, secs: 4 };
const WATER_SEVERE = { V: 150 / 3.6, sink: 10, pitch: 60, secs: 4 };
const casesOf = k => /floats/i.test(k)
  ? [{ id: 'nosein-water', label: 'a severe float nose-in (150 km/h, 10 m/s, 60 deg)', kind: 'water', o: WATER_SEVERE },
     { id: 'float-nosein', label: 'the float nose-in (90 km/h, 5 m/s, 20 deg)', kind: 'water', o: { V: 90 / 3.6, sink: 5, pitch: 20, secs: 4 } }]
  : [{ id: 'trunk-0', label: 'a trunk at 30 m/s, the centreline', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 0 } },
     { id: 'trunk-2.5', label: 'a trunk at 30 m/s, the wing 2.5 m out', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 2.5 } },
     { id: 'taxi', label: 'a taxi into a trunk at 3 m/s, the throttle shut', kind: 'trunk', o: { D: 6, agl: 0, V: 3, thr: 0, secs: 6, off: 0 } },
     { id: 'nosein-ground', label: 'a severe nose-in on the ground (180 km/h, 10 m/s, 60 deg)', kind: 'ground', o: SEVERE }];
const MARGIN = 0.05, REST_TOL = 0.03;

// the cases, set up as DMGSKIN's `go` sets them up (TREECRASH's flyRun, DMGINTEGRITY's groundCase, TREECRASH's waterCase)
function go(k, c, damage) {
  const C = L.core(), o = c.o, d0 = L.defOf(k), def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage }) });
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
    const c0 = sim.cgPos().slice(), off = o.off || 0;
    TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev, 0.3, elev + 10.05]);
    sim.ctl.thr = o.thr == null ? 0 : o.thr;
    return { sim, def, N: o.secs * 60, env: { ground: () => elev, water: null } };
  }
  if (c.kind === 'ground') {
    const { W } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0);
    pitchAndDrop(sim, () => 0);
    return { sim, def, N: o.secs * 60, env: { ground: () => 0, water: null } };
  }
  const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  pitchAndDrop(sim, c0 => world.waterH(c0[0], c0[2]));
  // (the bodies read the water at its mean - the page reads it at the drawn time: a few cm of wave, inside the bound)
  return { sim, def, N: o.secs * 60, env: { ground: (x, z) => world.terrainH(x, z), water: (x, z) => world.waterH(x, z, 0) } };
}

// ---- the candidates a build's drawn parts make, in the frame's own sizes (the page measures them off the drawing) ----
function candidates(def) {
  const R = def.refs, N = def.nodes, cen = ids => { const c = [0, 0, 0]; for (const i of ids) for (let j = 0; j < 3; j++) c[j] += N[i].p[j] / ids.length; return c; };
  const E = R.engine || [], EO = R.engineOf || E.map(() => 0), units = [...new Set(EO.map(x => x | 0))];
  const out = [];
  const D = (def.params.prop && def.params.prop.D) || 1.9;
  for (const u of units) {
    const ids = E.filter((i, j) => (EO[j] | 0) === u), at = cen(ids);
    // the cowl: about the engine, half the prop's disc across; a nose engine's runs back to the firewall ring
    const nose = Math.abs(at[2]) < 0.3;
    const cAt = nose ? cen(ids.concat(R.noseFrame)) : at;
    out.push({ kind: 'cowl', unit: u, at: cAt, box: { lo: [-0.45, -0.32, -0.32], hi: [0.45, 0.32, 0.32] }, mass: 7, floats: false });
    // the engine unit (block, prop and spinner on it): leaves only loose; the spinner alone only crushed
    out.push({ kind: 'eng', unit: u, at, nodes: ids.slice(), rule: 'loose', box: { lo: [-0.4, -0.3, -0.3], hi: [0.4, 0.3, 0.3] }, mass: 90, floats: false });
    out.push({ kind: 'spinner', unit: u, at, rule: 'crush', box: { lo: [-0.14, -0.12, -0.12], hi: [0.14, 0.12, 0.12] }, mass: 1, floats: true });
  }
  const axles = [].concat(R.mains || [], R.tw != null && R.tw >= 0 ? [R.tw] : []);
  if (!(def.parts && def.parts.floats && def.parts.floats.length))
    for (const i of axles) { const r = Math.max(0.12, N[i].r || 0.2); out.push({ kind: 'wheel', at: N[i].p.slice(), nodes: [i], box: { lo: [-r, -r, -0.07], hi: [r, r, 0.07] }, mass: 6, floats: true }); }
  // the windscreen: over the first two rings' tops
  const T = {}; N.forEach((nd, i) => { if (nd.tag) T[nd.tag] = i; });
  if (T.S0TL != null && T.S1TL != null) out.push({ kind: 'pane', at: cen([T.S0TL, T.S0TR, T.S1TL, T.S1TR]), box: { lo: [-0.25, -0.2, -0.38], hi: [0.25, 0.2, 0.38] }, mass: 3, floats: false });
  return { list: out, D };
}
const fnv = (a, b) => { let h = 2166136261; for (const A of [a, b]) { const u = new Uint8Array(A.buffer, A.byteOffset, A.byteLength); for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619); } } return (h >>> 0).toString(16); };

// ---- one case: the crash with the wreck layer reading it; `fps` the frame batching the bodies are stepped at ----
function runCase(k, c, damage, opt) {
  const C = L.core(), IN = go(k, c, damage), sim = IN.sim, def = IN.def, n = sim.n;
  const core = def.refs.noseFrame[0];
  if (opt.bare) { for (let f = 0; f < IN.N; f++) sim.step(1 / 60); return { hash: fnv(sim.p, sim.v) }; }
  const CD = candidates(def), P = WD.plan(def, CD.list), W = WD.watcher(), T = SB.topo(def.beams, n);
  const hop = SH.simDmgHop0(), st = SV.simViewDmgState(n, def.beams.length);
  const rest = new Float64Array(n * 3); def.nodes.forEach((nd, i) => { rest[i*3] = nd.p[0]; rest[i*3+1] = nd.p[1]; rest[i*3+2] = nd.p[2]; });
  // the eye: over the cabin's first bay behind the firewall, a quarter of its height up from its middle (the page reads the crew's)
  const BY = WD.bays(def), eyeBay = BY[Math.min(1, BY.length - 1)];
  const eye = [0, 0, 0]; for (const i of eyeBay.n) for (let j = 0; j < 3; j++) eye[j] += rest[i*3+j] / 8;
  let hTop = 0, hBot = 0; for (const i of eyeBay.n.slice(2, 4)) hTop += rest[i*3+1] / 2; for (const i of eyeBay.n.slice(0, 2)) hBot += rest[i*3+1] / 2; eye[1] += 0.2 * (hTop - hBot);
  const CAB = WD.cabin(def, eye);
  const rel = [], strikes = [], prevRpm = [], seized = sim.eng.map(e => !!e.seized);
  let payloads = 0;
  const stepEvery = Math.round(60 / (opt.fps || 60));
  let accDt = 0;
  const onFrame = (f) => {
    const PL = SH.simDmgHop(sim, hop, core, 0);
    if (PL) { SV.simViewDmgApply(st, PL); payloads++; }
    // the strikes (a seized engine, once): its rpm the frame before, the hub's speed, the aeroplane's mass
    sim.eng.forEach((e, ki) => {
      if (e.seized && !seized[ki]) {
        seized[ki] = true;
        const E = def.refs.engine.filter((i, j) => ((def.refs.engineOf || [])[j] | 0) === ki);
        let vx = 0, vy = 0, vz = 0; for (const i of E) { vx += sim.v[i*3]; vy += sim.v[i*3+1]; vz += sim.v[i*3+2]; }
        const D = sim.damage(), info = { rpm: prevRpm[ki] || 0, V: Math.hypot(vx, vy, vz) / Math.max(1, E.length), M: sim.totalM, D: CD.D, nb: 2, what: D.propAt ? D.propAt.what : 'ground', eng: ki, t: sim.t };
        const S = WD.strike(info), S2 = WD.strike(info);
        const s = { t: sim.t, eng: ki, info, E: S.E, Espin: S.Espin, Ehit: S.Ehit, pBreak: S.pBreak, breaks: S.breaks, lost: S.lost, curl: S.curl, dent: S.dent, same: JSON.stringify(S) === JSON.stringify(S2) };
        if (S.breaks) {
          if (accDt) { WD.step(W, accDt, IN.env); accDt = 0; }
          // the lost blade: a body off the engine's nodes, at half the radius out along the strike's seeded direction
          const at = [0, 0, 0]; for (const i of E) for (let j = 0; j < 3; j++) at[j] += rest[i*3+j] / E.length;
          const az = S.dentAz; at[1] += Math.cos(az) * CD.D / 4; at[2] += Math.sin(az) * CD.D / 4;
          const cb = { id: P.parts.length, kind: 'blade', nodes: E.slice(), at, why: 'strike' }; P.parts.push(Object.assign(cb, { L0: [] }));
          const F = WD.fit(cb.nodes, rest, sim.p), Rm = F.R, d = [at[0] - F.cr[0], at[1] - F.cr[1], at[2] - F.cr[2]];
          const x = [F.cl[0] + Rm[0]*d[0] + Rm[1]*d[1] + Rm[2]*d[2], F.cl[1] + Rm[3]*d[0] + Rm[4]*d[1] + Rm[5]*d[2], F.cl[2] + Rm[6]*d[0] + Rm[7]*d[1] + Rm[8]*d[2]];
          const B = WD.release(W, cb, { x, q: Array.from(F.q) }, { lo: [-0.04, -CD.D / 4, -0.07], hi: [0.04, CD.D / 4, 0.07] }, 3, sim.p, sim.v, true);
          rel.push({ id: cb.id, kind: 'blade', why: 'strike', t: sim.t, body: B });
        }
        strikes.push(s);
      }
      prevRpm[ki] = sim.out.rpm ? sim.out.rpm[ki] : 0;
    });
    // the releases (the bodies already flying carried to this moment first: a body released inside a batch of frames
    // flies from its release, not from the batch's start - the page releases at its own frame, its dt then whole)
    const ids = WD.watch(W, P, st, sim.p, T.adj);
    if (ids.length && accDt) { WD.step(W, accDt, IN.env); accDt = 0; }
    for (const id of ids) {
      const cnd = P.parts[id], F = WD.fit(cnd.nodes, rest, sim.p), Rm = F.R, a = cnd.at;
      const d = [a[0] - F.cr[0], a[1] - F.cr[1], a[2] - F.cr[2]];
      const x = [F.cl[0] + Rm[0]*d[0] + Rm[1]*d[1] + Rm[2]*d[2], F.cl[1] + Rm[3]*d[0] + Rm[4]*d[1] + Rm[5]*d[2], F.cl[2] + Rm[6]*d[0] + Rm[7]*d[1] + Rm[8]*d[2]];
      const B = WD.release(W, cnd, { x, q: Array.from(F.q) }, cnd.box, cnd.mass, sim.p, sim.v, cnd.floats);
      rel.push({ id, kind: cnd.kind, why: cnd.why, crush: cnd.crush, t: sim.t, body: B });
    }
    accDt += 1 / 60;
    if ((f + 1) % stepEvery === 0) { WD.step(W, accDt, IN.env); accDt = 0; }
  };
  let bad = false;
  for (let f = 0; f < IN.N; f++) { sim.step(1 / 60); onFrame(f); if (!L.finite(sim)) { bad = true; break; } }
  const hash = fnv(sim.p, sim.v);
  // the wreck frozen, the bodies carried on to their rest (LIFE at most)
  let t = 0; while (W.bodies.some(B => !B.asleep) && t < WD.LIFE + 1) { WD.step(W, stepEvery / 60, IN.env); t += stepEvery / 60; }
  // the clip: each body's corners in the live cabin bays of the core; the wreck's own pass-through (D1b's probe at the end)
  const fd = IL.pieces(sim), coreR = fd(core);
  const cabin = BY.filter(B => B.n.every(i => fd(i) === coreR));
  const bodies = W.bodies.map(B => {
    const Rm = WD.rotOf(B.q, new Float64Array(9));
    let deep = -Infinity, bay = -1;
    for (const pl of B.pts) { const X = [B.x[0] + Rm[0]*pl[0] + Rm[1]*pl[1] + Rm[2]*pl[2], B.x[1] + Rm[3]*pl[0] + Rm[4]*pl[1] + Rm[5]*pl[2], B.x[2] + Rm[6]*pl[0] + Rm[7]*pl[1] + Rm[8]*pl[2]];
      for (const by of cabin) { const d = WD.depth(sim.p, by.n, X[0], X[1], X[2]); if (d > deep) { deep = d; bay = by.i; } } }
    const surf = B.floats && IN.env.water ? { ground: (x, z) => Math.max(IN.env.ground(x, z), IN.env.water(x, z)) } : IN.env;
    const fin = B.x.concat(B.q, B.v, B.w).every(Number.isFinite);
    return { kind: B.kind, why: B.why, asleep: B.asleep, sunk: B.sunk, age: +B.age.toFixed(2), clear: WD.clearance(B, surf), deep, bay, fin, wet: B.wet || (B.floats && !!IN.env.water && surf !== IN.env), x: B.x.map(v => +v.toFixed(3)), from: Math.hypot(B.x[0] - sim.cgPos()[0], B.x[2] - sim.cgPos()[2]) };
  });
  const D = sim.damage();
  return { hash, bad, crashed: D.crashed, reason: D.reason, broken: D.broken.length, payloads, rel: rel.map(r => ({ kind: r.kind, why: r.why, crush: r.crush != null ? +r.crush.toFixed(3) : null, t: +r.t.toFixed(2) })),
    bodies, strikes, eye: CAB ? WD.crushed(CAB, sim.p, st.pc) : null, eyeBay: CAB ? CAB.bay : null, eyeD0: CAB ? CAB.d0 : null,
    stillN: P.parts.filter(q => !q.gone).length, final: W.bodies.map(B => B.x.concat(B.q)) };
}

// ---- nothing broken: a FAR 23.473 drop, the layer on - no release, no strike ----
function calm(k) {
  const def = L.defOf(k), n = def.nodes.length, CD = candidates(def), P = WD.plan(def, CD.list), W = WD.watcher(), T = SB.topo(def.beams, n);
  const hop = SH.simDmgHop0(), st = SV.simViewDmgState(n, def.beams.length);
  let rel = 0, seized = 0, payloads = 0;
  const r = L.hardLanding(k, { sink: L.far473(k), onFrame: (sim) => {
    const PL = SH.simDmgHop(sim, hop, def.refs.noseFrame[0], 0); if (PL) { SV.simViewDmgApply(st, PL); payloads++; }
    rel += WD.watch(W, P, st, sim.p, T.adj).length; seized += sim.eng.filter(e => e.seized).length; } });
  return { rel, seized, payloads, yields: r.dmg.yields };
}

// ---- the drawn prop: a synthetic two-blade prop (rods along +-y, 0.95 m) and a cone spinner about +x, curled and dented ----
function propUnit() {
  const axis = [1, 0, 0], pos = [];
  for (const sg of [1, -1]) for (let s = 0; s <= 20; s++) for (const dz of [-0.06, 0.06]) pos.push(0, sg * (0.1 + 0.85 * s / 20), dz);
  const base = Float64Array.from(pos), nv = base.length / 3, out = new Float64Array(base.length);
  const BF = WD.bladeFrame(base, nv, axis);
  const S = WD.strike({ rpm: 1100, V: 3, M: 500, D: 1.9, nb: BF.nb, what: 'trunk', eng: 0 });
  const curl = [0.6, 0.9];
  WD.curlBlades(base, out, nv, axis, BF, curl, 0.08);
  // each blade's length kept (hub to tip, along its polyline), its tip aft (-x), the inner third untouched
  const len = (P, sg) => { let L = 0; const ids = []; for (let v = 0; v < nv; v++) if (Math.sign(base[v*3+1]) === sg && base[v*3+2] < 0) ids.push(v);
    for (let j = 1; j < ids.length; j++) { const a = ids[j-1] * 3, b = ids[j] * 3; L += Math.hypot(P[a] - P[b], P[a+1] - P[b+1], P[a+2] - P[b+2]); } return L; };
  const tipAft = []; for (const sg of [1, -1]) { let best = -1, rr = 0; for (let v = 0; v < nv; v++) if (Math.sign(base[v*3+1]) === sg && Math.abs(base[v*3+1]) > rr) { rr = Math.abs(base[v*3+1]); best = v; } tipAft.push(-out[best*3]); }
  let innerMoved = 0; for (let v = 0; v < nv; v++) if (Math.abs(base[v*3+1]) < WD.CURL_S0 * BF.R) innerMoved = Math.max(innerMoved, Math.abs(out[v*3] - base[v*3]) + Math.abs(out[v*3+1] - base[v*3+1]));
  // the spinner: a cone along +x (base at x 0, r 0.12, apex at x 0.25)
  const sp = []; for (let i = 0; i <= 10; i++) for (let a = 0; a < 24; a++) { const t = i / 10, r = 0.12 * (1 - t), az = a / 24 * 2 * Math.PI; sp.push(0.25 * t, r * Math.cos(az), r * Math.sin(az)); }
  const sb = Float64Array.from(sp), snv = sb.length / 3, so = new Float64Array(sb.length);
  WD.dentSpinner(sb, so, snv, axis, { u0: [0, 1, 0] }, 0.04, 0);
  let inFace = 0, inBack = 0;
  for (let v = 0; v < snv; v++) { const y = sb[v*3+1], z = sb[v*3+2], r0 = Math.hypot(y, z), r1 = Math.hypot(so[v*3+1], so[v*3+2]); if (r0 < 1e-6) continue;
    const az = Math.atan2(z, y); if (Math.cos(az) > 0.9) inFace = Math.max(inFace, r0 - r1); if (Math.cos(az) < 0) inBack = Math.max(inBack, Math.abs(r0 - r1)); }
  return { nb: BF.nb, R: BF.R, lens: [len(base, 1), len(out, 1), len(base, -1), len(out, -1)], tipAft, innerMoved, inFace, inBack, strike: S };
}

if (argv[0] === '--build') {
  const k = argv[1], out = { key: k, label: L.BUILDS[k].label, cases: [] };
  for (const c of casesOf(k)) {
    const R = { id: c.id, label: c.label };
    R.on = runCase(k, c, true, {});
    R.lowFps = runCase(k, c, true, { fps: 12 });
    R.bare = runCase(k, c, true, { bare: true });
    R.off = runCase(k, c, false, {});
    R.offBare = runCase(k, c, false, { bare: true });
    delete R.on.final; delete R.off.final;
    const a = R.lowFps.final; delete R.lowFps.final;
    out.cases.push(R);
  }
  out.calm = calm(k);
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const f2 = x => (x == null || !Number.isFinite(x)) ? String(x) : x.toFixed(2);
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now();
  const run = k => new Promise(res => {
    const ch = spawn(process.execPath, [__filename, '--build', k], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
    ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-1500) }); });
  });
  const R = {}, q = BUILDS.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + BUILDS.length + ' builds; CRUSH ' + WD.CRUSH * 100 + ' cm, E_BEND ' + WD.E_BEND / 1000 + ' kJ, E_BREAK ' + WD.E_BREAK / 1000 + ' kJ, the eye clear ' + WD.EYE_CLEAR * 100 + ' cm)');
  for (const k of BUILDS) {
    const r = R[k];
    console.log((r.label || k) + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    for (const c of r.cases) {
      const S = c.on;
      console.log('  ' + c.label + ': ' + (S.crashed ? 'CRASHED (' + S.reason + ')' : 'no crash') + ', ' + S.broken + ' broken, ' + S.payloads + ' damage payloads');
      console.log('    released: ' + (S.rel.length ? S.rel.map(x => x.kind + ' (' + x.why + (x.crush != null && x.why === 'crushed' ? ' ' + (x.crush * 100).toFixed(0) + ' cm' : '') + ', t ' + x.t + ' s)').join(', ') : 'nothing') + '; ' + S.stillN + ' parts stay on');
      for (const s of S.strikes) console.log('    prop strike (engine ' + s.eng + ', ' + s.info.what + ', t ' + f2(s.t) + ' s): ' + Math.round(s.info.rpm) + ' rpm, the hub at ' + f2(s.info.V) + ' m/s - E ' + (s.E / 1000).toFixed(1) + ' kJ (spin ' + (s.Espin / 1000).toFixed(1) + ', impact ' + (s.Ehit / 1000).toFixed(1) + '), p(break) ' + f2(s.pBreak) + ': ' + (s.breaks ? 'blade ' + s.lost + ' BROKE OFF' : 'the blades curl') + ' (curl ' + s.curl.map(f2).join(' / ') + ' rad), the spinner dented ' + (s.dent * 100).toFixed(1) + ' cm');
      yes(!S.bad, 'the crash flown finite with the wreck layer reading it');
      yes(S.hash === c.bare.hash, 'the wreck layer only reads: the crash ends on the same bits with it and without it (' + S.hash + ')');
      for (const b of S.bodies) console.log('    body ' + b.kind + ' (' + b.why + '): ' + (b.sunk ? 'SUNK (out of sight)' : b.asleep ? 'at rest' : 'MOVING') + ' after ' + b.age + ' s, ' + f2(b.from) + ' m from the wreck' + (b.sunk ? '' : ', its lowest corner ' + (b.clear * 100).toFixed(1) + ' cm over ' + (b.wet ? 'the water' : 'the ground')) + ', ' + (b.deep > -2 ? 'the deepest corner ' + (b.deep * 100).toFixed(1) + ' cm in cabin bay ' + b.bay : 'no cabin bay near'));
      if (S.bodies.length) {
        yes(S.bodies.every(b => b.fin), 'every body finite');
        yes(S.bodies.every(b => b.asleep), 'every body comes to rest (within ' + WD.LIFE + ' s)');
        yes(S.bodies.every(b => b.sunk || (b.clear > -REST_TOL && b.clear < REST_TOL)), 'every body rests ON the surface (its lowest corner within ' + REST_TOL * 100 + ' cm: ' + S.bodies.map(b => b.sunk ? 'sunk' : (b.clear * 100).toFixed(1)).join(', ') + ' cm) or has sunk out of sight');
        yes(S.bodies.every(b => !(b.deep > MARGIN)), 'the clip: no body corner inside a live cabin bay deeper than ' + MARGIN * 100 + ' cm (worst ' + (Math.max(...S.bodies.map(b => b.deep)) * 100).toFixed(1) + ' cm)');
        const lo = c.lowFps;
        const dmax = Math.max(0, ...S.bodies.map((b, i) => lo.bodies[i] ? Math.hypot(b.x[0] - lo.bodies[i].x[0], b.x[1] - lo.bodies[i].x[1], b.x[2] - lo.bodies[i].x[2]) : Infinity));
        yes(lo.rel.length === S.rel.length && lo.bodies.every(b => b.asleep) && dmax < 0.05, 'the frame rate does not move the debris: stepped at 12 frames a second, the same ' + lo.rel.length + ' releases at rest within ' + (dmax * 100).toFixed(1) + ' cm of the 60 fps rest');
      }
      for (const s of S.strikes) yes(s.same, 'the strike is seeded: the same strike, the same answer (engine ' + s.eng + ')');
      if (c.id === 'taxi') yes(S.strikes.length > 0 && S.strikes.every(s => !s.breaks), 'the 3 m/s taxi into a trunk: the prop strikes and its blades curl, none breaks');
      if (/^trunk-0|^nosein-ground/.test(c.id)) yes(S.strikes.some(s => s.breaks), 'the ' + c.label + ': a blade breaks off');
      if (S.eye) console.log('    the cockpit (eye in bay ' + S.eyeBay + ', ' + (S.eyeD0 * 100).toFixed(0) + ' cm clear at rest): ' + (S.eye.crushed ? 'CRUSHED - ' + S.eye.why + ': the chase view' : 'clear (' + (S.eye.depth * 100).toFixed(0) + ' cm, the bay at ' + (S.eye.vol * 100).toFixed(0) + ' % of its volume)'));
      yes(c.off.rel.length === 0 && c.off.payloads === 0 && c.off.bodies.length === 0 && c.off.hash === c.offBare.hash, 'damage OFF: no payload, nothing released, no body (' + c.off.strikes.length + ' strikes the solver itself does not make), the same bits as without the layer');
    }
    const z = r.calm;
    yes(z.rel === 0 && z.seized === 0 && z.payloads === 0, 'nothing broken (a FAR 23.473 drop, ' + z.yields + ' yields): no payload, no release, no strike');
  }
  // the drawn prop, curled and dented
  {
    const U = propUnit();
    console.log('the drawn prop (synthetic, ' + U.nb + ' blades of ' + f2(U.R) + ' m read off its vertices):');
    yes(U.nb === 2, 'the blade count read off the vertices: ' + U.nb);
    yes(Math.abs(U.lens[0] - U.lens[1]) < 2e-3 && Math.abs(U.lens[2] - U.lens[3]) < 2e-3, 'the curl keeps each blade\'s length (' + U.lens.map(x => x.toFixed(3)).join(' / ') + ' m)');
    yes(U.tipAft.every(a => a > 0.05) && U.innerMoved < 1e-9, 'the tips curl aft (' + U.tipAft.map(x => (x * 100).toFixed(1)).join(' / ') + ' cm), the blades\' inner ' + WD.CURL_S0 * 100 + ' % untouched');
    yes(U.inFace > 0.01 && U.inBack < 1e-9, 'the spinner dented on the strike\'s side only (' + (U.inFace * 100).toFixed(1) + ' cm in; ' + (U.inBack * 100).toFixed(2) + ' cm behind)');
  }
  // app.js: the wreck path behind the damage state
  {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    const ok = /function wreckFrame\(\) \{\s*const D = wreckState\(\);\s*if \(!D\) return;/.test(src) && /function wreckState\(\) \{/.test(src);
    yes(ok, 'app.js: the wreck path (debris, the strike\'s drawing, the cockpit rule) only through wreckFrame, returning at once unless the damage state holds damage or an engine has seized');
  }
  const outI = argv.indexOf('--out');
  if (outI >= 0) { fs.mkdirSync(path.dirname(argv[outI + 1]), { recursive: true }); fs.writeFileSync(argv[outI + 1], JSON.stringify(R, null, 1)); }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGWRECK: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
