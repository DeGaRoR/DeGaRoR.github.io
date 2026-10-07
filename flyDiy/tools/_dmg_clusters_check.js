#!/usr/bin/env node
// GATE DMGCLUSTERS (G1840-G1843, DMG-D3 CLUSTERS) - a shape-matched cluster is ONE BREAKABLE PART (DEFORM-AND-BREAK §4.7 (i),
// §7.1 #8, §7.4), on the user's validated builds, damage ON (params.damage true). The clusters they carry: the FIN on all
// five (the user's Cub, the Jodel, the metal Cessna, the Cessna on floats, the twin on floats), the twin's ROD (its tail
// boom: a tube cluster with a twist constraint and a mid-span station), the rigid FLOATS of both floatplanes. No validated
// build has a twin boom: the boom is flown on the twin-boom FIXTURE (tools/fixtures/build_v8_twin-boom_2026-09-11.json) and
// REPORTED, tuned on nothing.
//   1. THE CUTS (G1840): every cluster of every build has its root cut, its limits finite and positive (the fitting rule on
//      the section of its EI / GJ); the rod and the boom their station (G1842) and their twist limits (G1841)
//   2. THE MEASURE IS THE STATICS: the airframe pinned, the part (and what hangs on it) at 5 g of its own weight - the
//      root moment the solver reads equals sum(m g x lever) about the cut to 2 %
//   3. NOTHING PARTS IN NORMAL OPERATIONS (the probe: nothing breaks, every cut's peak load over its limit per substep): the
//      load test to 5.7 g (the wing, the fin, the stab), TREECRASH's flown pull, the drops at FAR 23.473 and 10 ft/s, a circuit
//      with the pilot, parked 10 s (damage on: no cut armed once settled); on the floatplanes the ordinary touchdowns (the
//      drops onto the water, the water circuit) and the 5 m/s level pancake
//   4. THE PARTS COME OFF CLEANLY (damage on, a scripted pull: the airframe pinned, a load ramped on the part until its root
//      gives): the fin (a side load), the twin's rod at its root (a vertical load on the tail), the rod at its STATION (the
//      tail tied down, the boom loaded at mid-span), the rod torn in TWIST (a couple at the stab's tips), a float (the bow
//      driven up and aft, a dig-in). Each: the intended cut parts first, by the intended mode; only its own group / bay
//      breaks; the part stays rigid (its nodes' distances to 1 cm) and moves off; all finite
//   5. THE WATER (§11.2 #4, §7.4's float dig-in): the twin's float nose-in (90 km/h, 5 m/s, 20 deg) parts nothing; the
//      severe nose-in (150 km/h, 10 m/s, 60 deg) on both floatplanes is REPORTED with what the floats' root limits do
//   6. THE TWIN-BOOM FIXTURE (REPORT): the boom's root and station pulls
// Run: node tools/_dmg_clusters_check.js   (one final `GATE DMGCLUSTERS: PASS|FAIL`; the builds in parallel children)
//      node tools/_dmg_clusters_check.js --build <key> [--trace <file>]   (one build's numbers as JSON on its last line)
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const L = require('./_treecrash_lib.js');
L.BUILDS.twinBoom = { label: 'twin boom (FIXTURE, report only)', build: 'tools/fixtures/build_v8_twin-boom_2026-09-11.json' };
const VALID = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];

const cutsOf = sim => sim.clusterCuts();
const findCut = (sim, tag, kind) => cutsOf(sim).cuts.find(c => c.tag === tag && c.kind === kind);
// the free set of a cut: its part, and everything that hangs on it (a flood that never crosses the cut's own members)
function freeOf(def, ct, extraCut) {
  const Xs = new Set(ct.X.concat(extraCut || [])), adj = def.nodes.map(() => []);
  def.beams.forEach((b, bi) => { if (!Xs.has(bi)) { adj[b.a].push(b.b); adj[b.b].push(b.a); } });
  const free = new Set(ct.P), q = [...ct.P];
  while (q.length) { const i = q.pop(); for (const j of adj[i]) if (!free.has(j)) { free.add(j); q.push(j); } }
  return free;
}
// THE PIN-AND-PULL RIG: a world-free sim, every node not `free` held where it starts (every substep, the load test's
// trestles), and on top of gravity the loads [node, [x, y, z] N per unit ramp] ramped at `rate` per second (or `body`:
// n g on every free node along `dir`, n ramped). Stepped substep by substep (sim.step(dt, 1), as the load test). Stops
// `after` s past the first cluster event, or at `secs`. Records each frame the watched cuts' moments.
function pinPull(k, o) {
  const C = L.core(), def = L.defOf(k, o.probe ? { probe: true } : null), sim = C.makeSim(def, null); sim.reset(0);
  const sub = def.params.substepsTrue || def.params.substeps || 24, dt = 1 / 60 / sub;
  const free = o.free, P0 = Float64Array.from(sim.p), pin = [];
  for (let i = 0; i < sim.n; i++) if (!free.has(i) || (o.hold && o.hold.includes(i))) pin.push(i);
  const clamp = () => { for (const i of pin) for (let j = 0; j < 3; j++) { sim.p[i*3+j] = P0[i*3+j]; sim.v[i*3+j] = 0; } };
  const hist = [], watch = o.watch || [];
  let t = 0, tEv = null, evN = 0, rp = null;
  // settle 0.5 s under gravity alone (the part's own sag is the datum)
  for (let f = 0; f < 30; f++) for (let s = 0; s < sub; s++) { sim.step(dt, 1); clamp(); for (const i of free) for (let j = 0; j < 3; j++) sim.v[i*3+j] *= 0.995; }
  const t0 = sim.t;
  for (let f = 0; f < (o.secs || 6) * 60; f++) {
    // (the load comes off once the part has: what came off falls free)
    let lam = tEv !== null && !o.keep ? 0 : Math.min(o.cap || Infinity, o.rate * (sim.t - t0));
    for (let s = 0; s < sub; s++) {
      if (tEv === null && !o.keep && lam > 0 && sim.damage().cl.length) lam = 0;   // (off at the substep the part came off)
      if (o.body) for (const i of (o.bodyOn || free)) { const m = sim.m[i] * 9.81 * lam * dt; sim.impulse(i, o.body[0] * m, o.body[1] * m, o.body[2] * m); }
      if (o.loads) for (const [i, F] of o.loads) sim.impulse(i, F[0] * lam * dt, F[1] * lam * dt, F[2] * lam * dt);
      sim.step(dt, 1); clamp();
    }
    const D = sim.damage(), X = cutsOf(sim);
    hist.push({ t: sim.t - t0, lam, cuts: watch.map(([tag, kind]) => { const c = X.cuts.find(c => c.tag === tag && c.kind === kind); return c ? { Mb: c.Mb, Tq: c.Tq, rb: c.rb, rt: c.rt, done: c.done } : null; }) });
    if (tEv === null && D.cl.length) {
      tEv = sim.t; evN = D.breaks;
      const e = D.cl[0], c = X.cuts.find(c => c.tag === e.tag && c.kind === e.cut);
      rp = rigidRef(sim, c ? c.P : o.part);
      // (a held end lets go at the event: the piece that came off is free to fall)
      if (o.hold) for (const i of o.hold) { const j = pin.indexOf(i); if (j >= 0 && free.has(i)) pin.splice(j, 1); }
    }
    if (tEv !== null && sim.t - tEv > (o.after || 0.5)) break;
    if (!L.finite(sim)) break;
  }
  const D = sim.damage(), X = cutsOf(sim);
  return { sim, def, D, X, hist, tEv: tEv === null ? null : tEv - t0, lamEv: tEv === null ? null : hist.find(h => h.t >= tEv - t0 - 1e-9)?.lam,
           breaksAtEv: evN, rigid: rp ? rigidNow(sim, rp) : null, finite: L.finite(sim) };
}
// the part's pairwise distances at the event, and how far they moved since (a rigid part: nothing); its centroid's travel
function rigidRef(sim, part) {
  const P = part.map(i => [sim.p[i*3], sim.p[i*3+1], sim.p[i*3+2]]);
  return { part, P, c: P.reduce((a, q) => a.map((x, j) => x + q[j] / P.length), [0, 0, 0]) };
}
function rigidNow(sim, R) {
  let dmax = 0; const Q = R.part.map(i => [sim.p[i*3], sim.p[i*3+1], sim.p[i*3+2]]);
  for (let a = 0; a < Q.length; a++) for (let b = a + 1; b < Q.length; b++) {
    const d0 = Math.hypot(R.P[a][0] - R.P[b][0], R.P[a][1] - R.P[b][1], R.P[a][2] - R.P[b][2]), d1 = Math.hypot(Q[a][0] - Q[b][0], Q[a][1] - Q[b][1], Q[a][2] - Q[b][2]);
    dmax = Math.max(dmax, Math.abs(d1 - d0));
  }
  const c = Q.reduce((a, q) => a.map((x, j) => x + q[j] / Q.length), [0, 0, 0]);
  return { dmax, moved: Math.hypot(c[0] - R.c[0], c[1] - R.c[1], c[2] - R.c[2]) };
}
// the probe's cluster peaks for the last run: per cut its peak load over its limit (bend, twist) and, per tube, the twist bays'
const clPeak = sim => { const P = sim.damagePeak(), X = cutsOf(sim);
  return { cuts: X.cuts.filter(c => c.k * 2 < P.cl.length).map(c => ({ tag: c.tag, kind: c.kind, b: P.cl[c.k*2], t: P.cl[c.k*2+1], yb: c.yb, yt: c.yt })),
           tw: X.twist.map(t => ({ tag: t.tag, r: P.tw[t.cl] })) }; };
const worst = pk => { let w = { r: 0 }; for (const c of pk.cuts) for (const [m, r, y] of [['bend', c.b, c.yb], ['twist', c.t, c.yt]]) if (r > w.r) w = { r, tag: c.tag, kind: c.kind, mode: m, yr: r / y };
  for (const t of pk.tw) if (t.r > w.r) w = { r: t.r, tag: t.tag, kind: 'twist bay', mode: 'twist', yr: null }; return w; };
// the pinned statics: the part and what hangs on it at 5 g of its own weight; the root moment read against sum(m g x lever)
function statics(k, tag, kind) {
  const C = L.core(), d0 = L.defOf(k), s0 = C.makeSim(d0, null); s0.reset(0);
  const ct = findCut(s0, tag, kind), free = freeOf(d0, ct);
  if (free.size > s0.n / 2) return { skip: 'the part is half the aeroplane' };
  // gravity, and 4 g more as a constant body load (a ramp capped at once)
  const N = 5, r2 = pinPull(k, { free, body: [0, -1, 0], rate: 1e9, cap: N - 1, secs: 3, part: ct.P, watch: [[tag, kind]], probe: true });
  const tail = r2.hist.slice(-60), Mb = tail.reduce((a, h) => a + Math.hypot(h.cuts[0].Mb, h.cuts[0].Tq), 0) / tail.length;
  // the statics about the cut's reference (the solver's own: its ref nodes' mean as built)
  const sim = r2.sim, cut = sim.clusterCuts().cuts.find(c => c.tag === tag && c.kind === kind);
  const ref = kind === 'station' ? d0.clusters.find(c => c.tag === tag).rings[d0.clusters.find(c => c.tag === tag).dmg.station]
    : (d0.clusters.find(c => c.tag === tag).dmg.ref || d0.clusters.find(c => c.tag === tag).dmg.root || cut.X.map(x => cut.P.includes(sim.beams[x].a) ? sim.beams[x].a : sim.beams[x].b));
  let cx = 0, cy = 0, cz = 0; for (const i of ref) { cx += sim.p[i*3]; cy += sim.p[i*3+1]; cz += sim.p[i*3+2]; } cx /= ref.length; cy /= ref.length; cz /= ref.length;
  const M = [0, 0, 0];
  for (const i of free) { const F = -9.81 * N * sim.m[i], rx = sim.p[i*3] - cx, rz = sim.p[i*3+2] - cz; M[0] += -rz * F; M[2] += rx * F; }
  return { Mb, Mst: Math.hypot(M[0], M[1], M[2]), nFree: free.size };
}

module.exports = { pinPull, freeOf, findCut, clPeak, worst, VALID };
const MAIN = require.main === module;
if (MAIN && argv[0] === '--build') {
  const k = argv[1], C = L.core(), out = { key: k }, def = L.defOf(k), sim = C.makeSim(def, null); sim.reset(0);
  const X = cutsOf(sim);
  // 1. the cuts
  out.cuts = X.cuts.map(c => ({ tag: c.tag, cls: c.cls, kind: c.kind, Mu: c.Mu, Mv: c.Mv, T: c.T, yb: c.yb, yt: c.yt, grp: c.grp, nP: c.P.length, nX: c.X.length }));
  out.twist = X.twist.map(t => ({ tag: t.tag, lim: t.lim }));
  out.clusters = def.clusters.map(c => ({ tag: c.tag, cls: c.cls, n: c.nodes.length, dmg: !!c.dmg, station: c.dmg ? c.dmg.station : null }));
  if (VALID.includes(k)) {
    // 2. the statics
    out.statics = X.cuts.filter(c => c.kind === 'root' || c.kind === 'station').map(c => Object.assign({ tag: c.tag, kind: c.kind }, statics(k, c.tag, c.kind)));
    // 3. normal operations, under the probe
    const g = def.params.gen, run = (lab, f) => { const r = f(); out.ops.push({ lab, pk: worst(clPeak(L.lastRun.sim)), all: clPeak(L.lastRun.sim), finite: r.finite !== false }); };
    out.ops = [];
    run('load test 5.7 g, the wing', () => L.loadTest(k, { probe: true }));
    run('load test 5.7 g, the fin', () => L.loadTest(k, { probe: true, surface: 'fin' }));
    run('load test 5.7 g, the stab', () => L.loadTest(k, { probe: true, surface: 'stab' }));
    run('flown pull (TREECRASH\'s, from ' + (2.6 * g.Vs).toFixed(0) + ' m/s)', () => L.pull(k, { V: 2.6 * g.Vs, sgn: 1, probe: true }));
    run('drop at FAR 23.473 (' + (L.far473(k) / 0.3048).toFixed(1) + ' ft/s)' + (/floats/i.test(k) ? ', onto the water' : ''), () => L.hardLanding(k, { probe: true, sink: L.far473(k) }));
    run('drop at 10 ft/s' + (/floats/i.test(k) ? ', onto the water' : ''), () => L.hardLanding(k, { probe: true, sink: 0.3048 * 10 }));
    if (k === 'floats') run('the 5 m/s level pancake on the water', () => L.waterCase(k, { probe: true, V: 0.3, sink: 5, pitch: 0, secs: 4 }));
    // (train 41, A0 7 Oct: the ordinary nose-in at the aeroplane's own V_S0 - V_S0, a sink of 0.2 V_S0, 20 deg: the Cessna on
    // floats' 90 km/h / 5 m/s ratio; the fixed 90 km/h was 1.5 V_S0 and 2.6 x FAR 23.527's load on the twin - section 5)
    const vso = g.VsFlap || g.Vs;
    if (k === 'twinFloats') run('the float nose-in at its own V_S0 (' + (3.6 * vso).toFixed(0) + ' km/h, ' + (0.2 * vso).toFixed(1) + ' m/s, 20 deg)', () => L.waterCase(k, { probe: true, V: vso, sink: 0.2 * vso, pitch: 20, secs: 4 }));
    if (!argv.includes('--quick')) run('a circuit with the pilot' + (/floats/i.test(k) ? ' (on the water)' : ''), () => L.circuit(k, { probe: true }));
    // parked 10 s, damage on: nothing parts, no cut arms once settled
    {
      let W = null, s3; const pr = C.makeSim(def, null);
      if (pr.hydro) { W = C.makeWorld(); s3 = C.makeSim(def, W); s3.reset(0); C.placeAtAerodrome(s3, W.aerodromes.find(a => a.id === 'SEA')); }
      else { const F = L.flatWorld(0); s3 = C.makeSim(def, F.W); s3.reset(0); C.placeAtAerodrome(s3, Object.assign({}, F.strip, { elev: 0, spawnElev: 0 })); }
      for (let f = 0; f < 120; f++) s3.step(1 / 60);
      const a0 = s3.damage().armedN;
      let pk = 0; for (let f = 0; f < 600; f++) { s3.step(1 / 60); for (const c of cutsOf(s3).cuts) pk = Math.max(pk, c.rb, c.rt); }
      out.parked = { cl: s3.damage().cl.length, armed: s3.damage().armedN - a0, pk };
    }
    // the drops with damage on: nothing parts
    out.dropOn = [L.far473(k), 0.3048 * 10].map(sink => { L.hardLanding(k, { sink }); return L.lastRun.sim.damage().cl.length; });
  }
  // 4. the parts come off cleanly
  const pulls = [];
  const pull = (lab, tag, kind, mk, expect) => {
    const ct = findCut(sim, tag, kind); if (!ct) return;
    const o = mk(ct);
    // the ramp: the cut's limit (o.lim) reached in about 3 s at the load's crude lever about the cut's own reference
    if (!o.rate && o.Mper) o.rate = o.lim / o.Mper / 3;
    if (!o.rate) {
      const refN = ct.kind === 'station' ? def.clusters.find(q => q.tag === tag).rings[def.clusters.find(q => q.tag === tag).dmg.station] : ct.P;
      const rc = [0, 1, 2].map(j => refN.reduce((a, i) => a + def.nodes[i].p[j], 0) / refN.length);
      const lev = i => Math.hypot(def.nodes[i].p[0] - rc[0], def.nodes[i].p[1] - rc[1], def.nodes[i].p[2] - rc[2]);
      let Mper = 0;
      if (o.body) for (const i of (o.bodyOn || o.free)) Mper += sim.m[i] * 9.81 * lev(i);
      if (o.loads) for (const [i, F] of o.loads) Mper += Math.hypot(...F) * lev(i);
      o.rate = o.lim / Math.max(1e-9, Mper) / 3;
    }
    const r = pinPull(k, Object.assign({ watch: [[tag, 'root'], [tag, 'station']].filter(w => findCut(sim, w[0], w[1])), part: o.part || ct.P }, o));
    const ev = r.D.cl[0] || null;
    // what broke at the event: its own group (or bay) only - every broken member in the cut's X or its group
    // (the cut that parted: the one the pull aimed at, or the tube's other - a torque parts the weaker station first)
    const cE = (ev && r.X.cuts.find(c => c.tag === ev.tag && c.kind === ev.cut)) || ct;
    const grp = cE.grp ? def.parts.dmg.groups.find(G => G.key === cE.grp) : null, own = new Set(cE.X.concat(grp ? grp.t0.concat(grp.t1) : []));
    const brokenAtEv = r.D.broken.slice(0, r.breaksAtEv), stray = brokenAtEv.filter(bi => !own.has(bi));
    pulls.push({ lab, tag, kind, expect, ev: ev && { tag: ev.tag, cut: ev.cut, why: ev.why, t: r.tEv, M: ev.Mb, T: ev.T, grp: ev.grp }, lam: r.lamEv,
      lim: { Mu: cE.Mu, Mv: cE.Mv, T: cE.T }, broken: brokenAtEv.length, stray: stray.length, groups: r.D.groups.map(G => G.key), cl: r.D.cl.map(c => c.tag + '/' + c.cut + '/' + c.why),
      rigid: r.rigid, finite: r.finite, clusters: r.X.clusters.map(c => c.tag + ':' + c.nodes.length + (c.off ? ' off' : '')), partedOk: !!(cE && cE.done),
      hist: argv.includes('--trace') ? r.hist : undefined });
  };
  const nd = i => def.nodes[i].p;
  // the fin: a side load, n g on the fin's own nodes, ramped
  for (const c of X.cuts.filter(c => c.cls === 'fin' && c.kind === 'root'))
    pull('the ' + c.tag + ' pulled sideways (n g on the fin, ramped)', c.tag, 'root', ct => ({ free: new Set(ct.P), body: [0, 0, 1], lim: ct.Mu, secs: 12 }), { cut: 'root', why: 'bend' });
  // a tube's root: a vertical load on what hangs on it (n g on the tail, ramped)
  // (the flood stops at every root cut of the same kind: a twin boom's tail joins both booms, which stay on their wing)
  const sameCls = ct => X.cuts.filter(q => q.kind === 'root' && q.cls === ct.cls).flatMap(q => q.X);
  for (const c of X.cuts.filter(c => (c.cls === 'rod' || c.cls === 'boom') && c.kind === 'root'))
    pull('the ' + c.tag + ' loaded down at its tail (n g on the tube and the tail, ramped)', c.tag, 'root', ct => ({ free: freeOf(def, ct, sameCls(ct)), body: [0, -1, 0], bodyOn: ct.cls === 'boom' ? new Set(ct.P) : null, lim: ct.Mu, secs: 12 }), { cut: 'root', why: 'bend' });
  // a tube's station: the boom LEVERED over an obstacle at its station (its station ring pushed up, its tail end down,
  // 1.5 : 1) - the moment just aft of the station is the tail's load x its lever, the root's less by the obstacle's: the
  // case that loads mid-span (a shape-matched tube between two clamps carries no beam's mid-span peak: its load must be
  // statically determinate to be read as a beam's)
  const tipOf = cd => cd.rings[cd.rings.length - 1].concat(cd.cls === 'rod' ? cd.nodes.filter(i => /^TP/.test(def.nodes[i].tag)) : []);
  for (const c of X.cuts.filter(c => c.kind === 'station')) {
    const cd = def.clusters.find(q => q.tag === c.tag), k0 = cd.dmg.station, up = cd.rings[k0], dn = tipOf(cd);
    pull('the ' + c.tag + ' levered over an obstacle at its mid-span station (bay ' + k0 + '; the station pushed up, the tail down)', c.tag, 'station', () => {
      const rootCut = findCut(sim, c.tag, 'root'), free = freeOf(def, rootCut, sameCls(rootCut));
      const loads = up.map(i => [i, [0, 1500 / up.length, 0]]).concat(dn.map(i => [i, [0, -1000 / dn.length, 0]]));
      return { free, loads, lim: c.Mu, secs: 12, part: c.P };
    }, { cut: 'station', why: 'bend' });
  }
  // the rod torn in twist: a pure torque on its last ring (each node pushed square to its radius about the tube's axis)
  for (const c of X.cuts.filter(c => c.cls === 'rod' && c.kind === 'root')) {
    const cd = def.clusters.find(q => q.tag === c.tag), ring = cd.rings[cd.rings.length - 1], a0 = nd(cd.dmg.ax[0]), a1 = nd(cd.dmg.ax[1]);
    const ax = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], la = Math.hypot(...ax); for (let j = 0; j < 3; j++) ax[j] /= la;
    const cen = [0, 1, 2].map(j => ring.reduce((s, i) => s + nd(i)[j], 0) / ring.length);
    const loads = ring.map(i => { const r = [0, 1, 2].map(j => nd(i)[j] - cen[j]), d = r[0] * ax[0] + r[1] * ax[1] + r[2] * ax[2];
      for (let j = 0; j < 3; j++) r[j] -= d * ax[j];
      const t = [ax[1] * r[2] - ax[2] * r[1], ax[2] * r[0] - ax[0] * r[2], ax[0] * r[1] - ax[1] * r[0]], r2 = r[0] ** 2 + r[1] ** 2 + r[2] ** 2;
      return [i, t.map(x => 1000 * x / r2 / ring.length)]; });   // 1 kN.m a unit of the ramp
    pull('the ' + c.tag + ' twisted (a torque on its last ring, ramped)', c.tag, 'root', ct => ({ free: freeOf(def, ct), loads, lim: ct.T, Mper: 1000, secs: 12 }), { why: 'twist' });
  }
  // a float dug in: its bow keel driven up and aft (the water's push on a buried bow), the rest of the aeroplane held
  for (const c of X.cuts.filter(c => c.cls === 'float')) {
    const cd = def.clusters.find(q => q.tag === c.tag), bow = cd.dmg.ax[0], st = cd.dmg.ax[1];
    const ax = [nd(st)[0] - nd(bow)[0], 0, nd(st)[2] - nd(bow)[2]], la = Math.hypot(...ax);
    pull('the ' + c.tag + ' dug in (its bow driven up and aft, ramped)', c.tag, 'root', ct => ({ free: new Set(ct.P), loads: [[bow, [1000 * ax[0] / la, 1000, 1000 * ax[2] / la]]], lim: ct.Mu, secs: 12 }), { cut: 'root' });
  }
  out.pulls = pulls;
  // 5. the water (both floatplanes): the ordinary and the severe nose-in, damage on
  // (train 41, A0 7 Oct: the ordinary nose-in at the aeroplane's own V_S0, V_S0 / 0.2 V_S0 / 20 deg; on the twin the old 90 km/h
  // case stays as a SEVERE row whose boom root must go first - 2.6 x its FAR 23.527 water load, past its ultimate)
  const gv = def.params.gen, vs0 = gv.VsFlap || gv.Vs;
  if (/floats/i.test(k)) out.water = [['the float nose-in at its own V_S0 (' + (3.6 * vs0).toFixed(0) + ' km/h, ' + (0.2 * vs0).toFixed(1) + ' m/s, 20 deg)', { V: vs0, sink: 0.2 * vs0, pitch: 20 }], ['SEVERE: 150 km/h, 10 m/s, 60 deg nose-in', { V: 150 / 3.6, sink: 10, pitch: 60, severe: true }]]
    .concat(k === 'twinFloats' ? [['SEVERE for the twin: 90 km/h, 5 m/s, 20 deg nose-in (2.6 x its FAR 23.527 load)', { V: 90 / 3.6, sink: 5, pitch: 20, severe: true, boom: true }]] : []).map(([lab, o]) => {
    const pk = (L.waterCase(k, Object.assign({ secs: 4, probe: true }, o)), clPeak(L.lastRun.sim));
    const r = L.waterCase(k, Object.assign({ secs: 4 }, o)), D = L.lastRun.sim.damage();
    return { lab, severe: !!o.severe, boom: !!o.boom, pk, cl: D.cl.map(c => ({ tag: c.tag, cut: c.cut, why: c.why, t: c.t, grp: c.grp })), groups: D.groups.map(G => G.key + '@' + G.t.toFixed(3)),
             crashed: D.crashed, reason: D.reason, breaks: D.breaks, finite: r.finite };
  });
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const rep = msg => console.log('  REPORT  ' + msg);
const kNm = x => (x / 1000).toFixed(2);
const f2 = x => (x == null ? '-' : x.toFixed(2)), f3 = x => (x == null ? '-' : x.toFixed(3));
if (MAIN) (async () => {
  const { spawn } = require('child_process');
  const keys = VALID.concat(['twinBoom']), t0 = Date.now(), extra = argv.filter(a => a === '--quick');
  const run = k => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--build', k, ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-800) }); });
  });
  const R = {}; const q = keys.slice(), J = Math.max(1, Math.min(4, +(process.env.DMGCL_JOBS || 3)));
  await Promise.all(Array.from({ length: J }, async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + keys.length + ' builds)');
  if (argv.includes('--json')) fs.writeFileSync(argv[argv.indexOf('--json') + 1], JSON.stringify(R, null, 1));
  for (const k of keys) {
    const r = R[k], lab = L.BUILDS[k].label, valid = VALID.includes(k);
    console.log(lab + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    console.log('1. the cuts (break limits: bending about the weak axis / the other / torque, kN.m; the first-yield share)');
    const want = r.clusters.filter(c => c.dmg);
    yes(want.length === r.clusters.length && want.every(c => r.cuts.some(x => x.tag === c.tag && x.kind === 'root')) &&
        r.cuts.every(c => c.Mu > 0 && c.Mv > 0 && c.T > 0 && Number.isFinite(c.Mu + c.Mv + c.T)),
      r.clusters.length + ' clusters, each with its root cut: ' + r.cuts.map(c => c.tag + ' ' + c.kind + ' ' + kNm(c.Mu) + ' / ' + kNm(c.Mv) + ' / ' + kNm(c.T) + (c.grp ? ' (' + c.grp + ')' : ' (its bay)')).join('; '));
    for (const c of r.clusters.filter(c => c.cls === 'rod' || c.cls === 'boom'))
      yes(c.station >= 1 && r.cuts.some(x => x.tag === c.tag && x.kind === 'station') && r.twist.some(t => t.tag === c.tag && t.lim.every(x => x > 0)),
        c.tag + ': its mid-span station at bay ' + c.station + ' (at 0.7 of the tube), the twist limits per bay ' + (r.twist.find(t => t.tag === c.tag) || { lim: [] }).lim.map(kNm).join(' / '));
    if (valid) {
      console.log('2. the measure is the statics (pinned, the part and what hangs on it at 5 g)');
      for (const s of r.statics) {
        if (s.skip) { console.log('  --    ' + s.tag + ' ' + s.kind + ': ' + s.skip); continue; }
        yes(Math.abs(s.Mb - s.Mst) <= 0.02 * s.Mst, s.tag + ' ' + s.kind + ': read ' + kNm(s.Mb) + ' kN.m, the statics ' + kNm(s.Mst) + ' (' + s.nFree + ' nodes)');
      }
      console.log('3. nothing parts in normal operations (the worst cut\'s peak load over its break limit; its first-yield share)');
      for (const o of r.ops) yes(o.finite && o.pk.r < 1, o.lab + ': ' + (o.pk.tag ? f3(o.pk.r) + ' (' + o.pk.tag + ' ' + o.pk.kind + ', ' + o.pk.mode + (o.pk.yr != null ? '; ' + f2(o.pk.yr) + ' of first yield' : '') + ')' : '0'));
      yes(r.parked.cl === 0 && r.parked.armed === 0, 'parked 10 s, damage on: nothing parts, no frame armed once settled (worst cut ' + f3(r.parked.pk) + ')');
      yes(r.dropOn.every(n => n === 0), 'the two drops with damage on: no cluster parts');
    }
    console.log('4. the parts come off cleanly' + (valid ? '' : ' (the FIXTURE: reported)'));
    for (const p of r.pulls) {
      const ok = p.ev && p.ev.tag === p.tag && (!p.expect.cut || p.ev.cut === p.expect.cut) && (!p.expect.why || p.ev.why === p.expect.why) && p.partedOk !== false && p.stray === 0 && p.finite &&
        p.rigid && p.rigid.dmax < 0.01 && p.rigid.moved > 0.05;
      const msg = p.lab + ': ' + (p.ev ? p.ev.tag + ' ' + p.ev.cut + ' by ' + p.ev.why + ' at ' + f2(p.ev.t) + ' s (' + kNm(p.ev.M) + ' kN.m bending, ' + kNm(p.ev.T) + ' torque; limits ' + kNm(p.lim.Mu) + ' / ' + kNm(p.lim.Mv) + ' / ' + kNm(p.lim.T) + ')'
        + ', ' + p.broken + ' members broken (' + (p.ev.grp || 'its bay') + ', ' + p.stray + ' others), the part rigid to ' + (p.rigid ? (1000 * p.rigid.dmax).toFixed(1) + ' mm and ' + f2(p.rigid.moved) + ' m off' : '-') + '; clusters now ' + p.clusters.join(', ') : 'NOTHING PARTED');
      if (valid) yes(ok, msg); else rep((ok ? '(clean) ' : '(NOT clean) ') + msg);
    }
    if (r.water) {
      console.log('5. the water');
      for (const w of r.water) {
        const fl = w.pk.cuts.filter(c => c.tag && /^FLT/.test(c.tag)), flt = fl.map(c => c.tag + ' ' + f2(c.b) + ' bend / ' + f2(c.t) + ' twist').join(', ');
        const msg = w.lab + ': the worst cut ' + f3(worst(w.pk).r) + ' (' + worst(w.pk).tag + ' ' + worst(w.pk).kind + ', ' + worst(w.pk).mode + '); the floats\' roots ' + flt + '; damage on: '
          + (w.cl.length ? w.cl.map(c => c.tag + ' ' + c.cut + ' by ' + c.why + ' at ' + f2(c.t) + ' s').join(', ') : 'no cluster parts') + '; groups ' + (w.groups.join(' ') || '-') + (w.crashed ? '; CRASHED (' + w.reason + ')' : '');
        if (!w.severe && k === 'twinFloats') yes(w.finite && w.cl.length === 0 && worst(w.pk).r < 1, msg);
        else if (w.boom) yes(w.finite && w.cl.length > 0 && w.cl[0].tag === 'ROD' && w.cl[0].cut === 'root', msg + ' - the boom (ROD) parts first, at its root');
        else { yes(w.finite, msg + ' - finite'); rep(w.lab + ': the float fittings ' + (w.cl.some(c => /^FLT/.test(c.tag)) || w.groups.some(g => /^float/.test(g)) ? 'LET GO' : 'held') + ' (§7.4)'); }
      }
    }
  }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGCLUSTERS: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
