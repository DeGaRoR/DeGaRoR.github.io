// GATE BIPLANE (G185) — the truss and the second plane.
//
// What it holds, step by step of the arc (each block names the sub-step that
// landed it, so a red here says which construction moved):
//   G185.2  THE PARASOL. A plane on a cabane: the root ties are the drawn
//           cabane members (class 'cabane', ext), the root stands cabaneH
//           above the roof and splays cabaneSplay outboard, the framework is
//           rigid (rank 3n-6) and STOPS being rigid without its cabane, the
//           tension-only wire law (a slack wire is not there), and the
//           parasol flies the test pilot's circuit.
//   G185.3  THE SECOND PLANE'S STRUCTURE. Two planes built, six N-strut
//           members and eight wires drawn, the shared interplane station
//           (and the sesquiplane's leaning one), no fuselage lift strut, a
//           rigid framework, every wire taut at 1 g, the I-strut cantilever
//           alternative, the truss's drag.
//   G185.5  THE VORTEX KERNEL. The horseshoe against a brute-force
//           Biot-Savart integral, Munk's stagger theorem at 1e-9 (and its
//           negative), the ground image, Prandtl's sigma over four gaps,
//           Diehl's lift split with stagger and decalage, the tail-downwash
//           window on three monoplanes and the biplane, the probe's residual,
//           the model switch, and the build-time ratio.
//
// node tools/test_biplane.js            -> the checks
// node tools/test_biplane.js --selftest -> the checks proven able to go red
'use strict';
const { buildGen, makeSim, makeWorld, makeTestPilot, genShakedown,
        GEN_RULES, vortexKernel } = require('./flight_core.js');
const { rigidityRank } = require('./_rigidity.js');

const fails = [];
const say = s => console.log(s);
const check = (ok, label, detail) => {
  say('  ' + (ok ? 'ok   ' : 'FAIL ') + label + (detail ? '  (' + detail + ')' : ''));
  if (!ok) fails.push(label);
  return ok;
};

// ---------------------------------------------------------------------------
// the builds
// ---------------------------------------------------------------------------
// the wired biplane (BIP), the sesquiplane (SESQ) and the I-strut cantilever
// (EAGLE): a parasol first plane over a low second plane
function bipSpec(over) {
  const sp = { wings: [
    { position: 'parasol', cabaneH: 0.50, chord: 1.4, span: 9, taper: 1.0, tip: 'rounded' },
    { position: 'low', chord: 1.4, span: 9, taper: 1.0, tip: 'rounded', stagger: 0.35,
      controls: { aileron: { span: 0.38, chord: 0.22 }, flap: { type: 'none', span: 0.5, chord: 0.2 } } } ],
    bracing: { type: 'cantilever', interplane: 'N', interplaneAt: 0.62, wires: 'both', cabane: 'N' } };
  if (over) over(sp);
  return sp;
}
// a lower plane short enough (the clamp's 6.5 m floor) under a long enough
// upper (11 m: station at 0.62 of its exposed semispan, ~3.6 m) that the
// shared station falls past the lower plane's own clamp (semi 3.25 - 0.12)
// — the strut leans inboard, as a sesquiplane's does
const SESQ = s => { s.wings[0].span = 11; s.wings[1].span = 6.5; s.wings[1].chord = 1.1; };
const EAGLE = s => { s.bracing.interplane = 'I'; s.bracing.wires = 'none'; };
function paraSpec(over) {
  return Object.assign({
    wings: [{ position: 'parasol', cabaneH: 0.50, span: 8.8, chord: 1.52,
              taper: 1.0, tip: 'rounded' }],
    bracing: { type: 'strut', cabane: 'N' },
  }, over || {});
}

// ---------------------------------------------------------------------------
// the instruments
// ---------------------------------------------------------------------------
// the cabane's members, and what they join
function cabaneOf(def) {
  const N = def.nodes;
  const all = def.beams.filter(b => b.cls === 'cabane');
  const drawn = all.filter(b => b.ext);
  const spar = i => N[i].tag === 'WF' || N[i].tag === 'WR';
  const wellFormed = all.every(b => spar(b.a) !== spar(b.b));   // one spar end, one body end
  return { all, drawn, wellFormed };
}
// THE CABANE CARRIES THE WING. The rank test cannot see it (the depth tie
// and the lateral tie still pin the root kinematically) and a deflection
// under load is contaminated by the whole aeroplane pitching on its gear —
// so the instrument is the LOAD PATH itself: settled at 1 g, the vertical
// component of the drawn cabane members' forces at the root spar nodes,
// against the vertical component of every member's force there. A cabane
// that is decoration carries nothing; a real one carries the wing.
function cabaneShare(def) {
  const sim = makeSim(def, null);
  sim.reset(0);
  for (let s2 = 0; s2 < 300; s2++) sim.step(1 / 60);
  const N = def.nodes, zR = def.parts.planes[0].zRoot;
  const roots = new Set();
  N.forEach((n, i) => {
    if ((n.tag === 'WF' || n.tag === 'WR') && (n.plane || 0) === 0 &&
        Math.abs(Math.abs(n.p[2]) - zR) < 1e-6) roots.add(i);
  });
  let cab = 0, all = 0;
  for (const bm of sim.beams) {
    const r = roots.has(bm.a) ? bm.a : roots.has(bm.b) ? bm.b : -1;
    if (r < 0) continue;
    const o = r === bm.a ? bm.b : bm.a;
    const dx = sim.p[o*3] - sim.p[r*3], dy = sim.p[o*3+1] - sim.p[r*3+1], dz = sim.p[o*3+2] - sim.p[r*3+2];
    const L = Math.hypot(dx, dy, dz) || 1e-9;
    const Fb = bm.k * (L - bm.L0);                 // + = tension, pulls r toward o
    const fy = Math.abs(Fb * dy / L);               // vertical load carried, either sign
    all += fy;
    if (bm.cls === 'cabane' && bm.ext) cab += fy;
  }
  return { cab, all, share: all > 0 ? cab / all : 0 };
}
function rigid(def, beams) {
  const n = def.nodes.length;
  return { rank: rigidityRank(def.nodes, beams || def.beams), want: 3 * n - 6 };
}
// THE WIRE LAW, on the solver itself: a synthetic wire between two nodes of
// the stock build, once tension-only and once ordinary. Shortened, the
// ordinary member pushes its end away and the wire does nothing; lengthened,
// both pull the same. Read as the difference in the end node's velocity after
// one step, along the member.
// tens: true = the wire, false = an ordinary member, null = NO added member
function wireLaw(delta, tens) {
  const def = buildGen();
  const wf = def.parts.wf, a = wf.L.F[0], b = wf.R.F[0];
  const A = def.nodes[a].p, B = def.nodes[b].p;
  const L = Math.hypot(B[0]-A[0], B[1]-A[1], B[2]-A[2]);
  const wire = { a, b, k: 1.0e6, c: 300, gear: false, cls: 'wire', ext: true,
                 vis: null, L, tens: !!tens, pre: 5e-4 };
  const d2 = Object.assign({}, def, { beams: tens == null ? def.beams : def.beams.concat([wire]) });
  const sim = makeSim(d2, null);
  sim.reset(0);
  const w = tens == null ? { L0: L } : sim.beams[sim.beams.length - 1];
  // reset() zeroes b.strain; the rigged strain is read off the lengths
  const strain0 = L / w.L0 - 1, L0 = w.L0;
  // move b along the member by delta (negative = shorten)
  const ux = (B[0]-A[0]) / L, uy = (B[1]-A[1]) / L, uz = (B[2]-A[2]) / L;
  sim.p[b*3] += ux * delta; sim.p[b*3+1] += uy * delta; sim.p[b*3+2] += uz * delta;
  sim.step(1e-4, 1);
  const vb = sim.v[b*3] * ux + sim.v[b*3+1] * uy + sim.v[b*3+2] * uz;
  return { strain0, L0, L, vb };
}
// ---- G185.5 instruments ----------------------------------------------------
// a prescribed-flow probe at body alpha (64_gen_build's genProbeAt, verbatim)
function probeAt(sim, V, a) {
  const [xA, yU] = sim.axes();
  const vel = [0, 0, 0];
  for (let k = 0; k < 3; k++) vel[k] = -V * (Math.cos(a) * xA[k] + Math.sin(a) * yU[k]);
  const r = sim.probe(vel);
  r.drag = -(r.Fx * -Math.cos(a) * xA[0] + r.Fy * -Math.cos(a) * xA[1] + r.Fz * -Math.cos(a) * xA[2])
           - (r.Fx * -Math.sin(a) * yU[0] + r.Fy * -Math.sin(a) * yU[1] + r.Fz * -Math.sin(a) * yU[2]);
  return r;
}
// the def with only some strips: 'none' (fuselage blobs alone), a plane's
// wing strips, or every wing strip — the tail left out so the wings' own
// numbers are what is compared
function onlyStrips(d, keep) {
  return Object.assign({}, d, { strips: d.strips.filter(s =>
    keep === 'none' ? false : (s.kind === 'wing' && (keep == null || s.plane === keep))) });
}
const V_PROBE = 30, RHO = 1.225, Q_PROBE = 0.5 * RHO * V_PROBE * V_PROBE, D2R = Math.PI / 180;
// PRANDTL'S SIGMA, MEASURED. Munk: D_i = (L1^2/b1^2 + 2 sigma L1 L2/(b1 b2) + L2^2/b2^2)/(pi q).
// The mutual term is what the kernel adds, so it is read as the drag of both
// planes together minus each plane's OWN drag at the lift it carries in
// company — that own drag fitted, per plane alone, as D0 + c L^2 off two
// alphas (profile plus its polar's induced term) — with the fuselage's drag
// taken out of every run. The classical fit is for ELLIPTIC loading; these
// planes are rectangular and four strips a side, and the model read 0.85-0.88
// of the fit at every gap when this was written (G/b 0.114 -> 0.537 vs 0.628,
// 0.178 -> 0.440/0.517, 0.246 -> 0.370/0.427, 0.354 -> 0.284/0.325).
function sigmaAt(spec) {
  const d = buildGen(spec);
  const G = d.parts.planes[0].wingY0 - d.parts.planes[1].wingY0, b = spec.wings[0].span;
  const mk = k => { const s = makeSim(onlyStrips(d, k), null); s.reset(0); return s; };
  const Dfus = probeAt(mk('none'), V_PROBE, 4 * D2R).drag;
  const self = [0, 1].map(k => {
    const s = mk(k);
    const r1 = probeAt(s, V_PROBE, 2 * D2R), r2 = probeAt(s, V_PROBE, 6 * D2R);
    const L1 = r1.planeFy[k], L2 = r2.planeFy[k];
    const cK = (r2.drag - r1.drag) / (L2 * L2 - L1 * L1);
    const D0 = (r1.drag - Dfus) - cK * L1 * L1;
    return L => D0 + cK * L * L;
  });
  const both = probeAt(mk(null), V_PROBE, 4 * D2R);
  const L1 = both.planeFy[0], L2 = both.planeFy[1];
  const D12 = (both.drag - Dfus) - self[0](L1) - self[1](L2);
  return { gb: G / b, sigma: D12 * Math.PI * Q_PROBE * b * b / (2 * L1 * L2),
           fit: (1 - 0.66 * G / b) / (1.05 + 3.7 * G / b), D12, L1, L2 };
}
// the lift split of the two planes at a fixed alpha, wings only
function splitAt(spec, a) {
  const d = buildGen(spec);
  const s = makeSim(onlyStrips(d), null); s.reset(0);
  const r = probeAt(s, V_PROBE, a);
  const L = r.planeFy[0] + r.planeFy[1];
  return { upper: r.planeFy[0] / L, L, D: r.drag };
}
// brute-force Biot-Savart over a horseshoe cut into small elements
function horseshoeNumeric(A, B, d, P) {
  const out = [0, 0, 0];
  const add = (a, b, n) => {
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const x0 = a.map((v, k) => v + (b[k] - v) * t0), x1 = a.map((v, k) => v + (b[k] - v) * t1);
      const dl = x1.map((v, k) => v - x0[k]), mid = x0.map((v, k) => 0.5 * (v + x1[k]));
      const r = P.map((v, k) => v - mid[k]), Rm = Math.hypot(r[0], r[1], r[2]);
      const cr = [dl[1]*r[2] - dl[2]*r[1], dl[2]*r[0] - dl[0]*r[2], dl[0]*r[1] - dl[1]*r[0]];
      for (let k = 0; k < 3; k++) out[k] += cr[k] / (4 * Math.PI * Rm * Rm * Rm);
    }
  };
  const far = 400;
  add(A, B, 4000);
  add(B, [B[0] + far * d[0], B[1] + far * d[1], B[2] + far * d[2]], 200000);
  add([A[0] + far * d[0], A[1] + far * d[1], A[2] + far * d[2]], A, 200000);
  return out;
}
// MUNK'S STAGGER THEOREM on the kernel: two straight discretised planes of
// uniform circulation; the mutual sum over both planes of Gamma dy w is the
// same at any streamwise displacement of one plane. Exact here because the
// control points lie ON the bound lines (the bound-segment terms cancel
// pairwise and the trailing legs' odd parts cancel in the sum).
function munkSum(stagger, offCP) {
  const N = 13, b = 9, dy = b / N, G = 1.6, K = vortexKernel;
  const mk = (x0, y0) => { const S = [];
    for (let i = 0; i < N; i++) { const z0 = -b / 2 + i * dy;
      S.push({ A: [x0, y0, z0], B: [x0, y0, z0 + dy], P: [x0 + (offCP || 0), y0, z0 + 0.5 * dy] }); }
    return S; };
  const P1 = mk(0, 0), P2 = mk(stagger, -G), dir = [1, 0, 0];
  let M = 0;
  for (const [T, S] of [[P1, P2], [P2, P1]]) for (const t of T) {
    const o = [0, 0, 0];
    for (const s of S) K.horseshoe(s.A, s.B, dir, 1e-9, t.P, o);
    M += dy * (-o[1]);
  }
  return M;
}
function fly(spec, maxS) {
  const world = makeWorld();
  const def = buildGen(spec);
  const sim = makeSim(def, world);
  sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = makeTestPilot(sim, def, world);
  let tEnd = maxS, nan = false;
  for (let s = 0; s < maxS * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { nan = true; tEnd = s / 60; break; }
    if (ap.phase === 'STOPPED' && ap.t > 5) { tEnd = s / 60; break; }
  }
  return { phase: ap.phase, t: tEnd, nan, report: ap.report };
}

// ---------------------------------------------------------------------------
// the checks (named, over plain numbers, so --selftest can doctor them)
// ---------------------------------------------------------------------------
const C = {
  cabaneDrawn: n => n === 8,                       // 2 root nodes x 2 sides x (post + diagonal)
  cabaneHeight: (dy, want) => Math.abs(dy - want) < 1e-6,
  splay: (zRoot, halfW) => Math.abs(zRoot - halfW - GEN_RULES.cabaneSplay) < 1e-6,
  rigid: r => r.rank === r.want,
  notRigid: r => r.rank < r.want,
  taut: s => s > 0 && s < 2e-3,
  // against the NO-MEMBER control: the wire's contribution is nothing, the
  // ordinary member's is the whole difference
  slackDoesNothing: (dvWire, dvBeam, dvNone) =>
    Math.abs(dvWire - dvNone) < 1e-3 * Math.abs(dvBeam - dvNone),
  // measured 35 % on the parasol: the rest is the lift-strut fan (which takes
  // the LIFT on the real aeroplane) and rule 3's depth ties; a decorative
  // cabane would read ~0
  cabaneCarries: sh => sh.all > 50 && sh.share >= 0.25,
  tautPullsAlike: (dvWire, dvBeam) => Math.abs(dvWire - dvBeam) < 1e-6 * Math.max(1e-9, Math.abs(dvBeam)),
  flew: r => r.phase === 'STOPPED' && !r.nan,
  // G185.3 — the truss
  wires: n => n === 8,                       // 2 sides x 2 spars x (flying + landing)
  nStruts: n => n === 6,                     // 2 sides x (2 posts + a diagonal)
  iStruts: n => n === 4,                     // 2 sides x 2 posts (the diagonal is inner)
  stationShared: (zU, zL) => Math.abs(zU - zL) < 1e-9,
  leans: (zU, zL) => zL < zU - 0.3,          // the sesquiplane's strut leans inboard
  lowerAft: (x1, x0, st) => Math.abs((x1 - x0) - st) < 1e-9,
  taut: s => s > 0 && s < 2e-3,
  allTaut: n => n === 8,
  // G185.5 — the kernel
  kernelMatches: (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-6),
  munkExact: (m0, m1, m2) => Math.abs(m1 - m0) < 1e-9 * Math.max(1, Math.abs(m0)) &&
                             Math.abs(m2 - m0) < 1e-9 * Math.max(1, Math.abs(m0)),
  munkBroken: (m0, m1) => Math.abs(m1 - m0) > 1e-4 * Math.max(1, Math.abs(m0)),
  imageMirror: (up, dn) => Math.abs(up[1] + dn[1]) < 1e-9 && Math.abs(up[0] - dn[0]) < 1e-9,
  sigmaBand: s => s.sigma > 0.75 * s.fit && s.sigma < 1.05 * s.fit,
  sigmaFalls: (a, b) => b.sigma < a.sigma,
  sigmaGone: s => s.sigma < 0.05,
  splitRises: (m, z, p) => m.upper < z.upper && z.upper < p.upper,
  splitDecalage: (z, dec) => dec.upper > z.upper + 0.03,
  staggerDrag: (m, z, p) => Math.abs(m.D - z.D) < 0.04 * z.D && Math.abs(p.D - z.D) < 0.04 * z.D,
  // the tail's measured downwash slope: the classical far-field estimate for
  // the stock build is 0.43; the tail sits 2.6 chords aft and below the
  // wake, and the kernel read 0.223 (stock) / 0.229 (cantilever) when this
  // was set — the window catches a kernel reading nonsense, not a taste
  epsWindow: e => e > 0.15 && e < 0.55,
  // G197 — the sources shed the polar's elliptic loading. The uniform control
  // reproduces G185's stock reading (0.223); elliptic reads 1.3x+ of it (the
  // far-field ratio is 2, the tail sits 0.9 m below a wake that tilts away
  // with alpha); the weights conserve each plane's circulation-length to
  // 1e-9 and shape it root-heavy, tip-light
  loadingLifts: (ell, uni) => ell > 1.3 * uni,
  uniformAnchor: u => Math.abs(u - 0.223) < 0.03,
  weightsConserve: (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a)),
  weightsShape: (root, tip) => root > 1.1 && tip < 0.6,
  epsBiplaneMore: (bip, mono) => bip > mono,
  resid: r => r >= 0 && r < 0.02,
  perf: (bip, stock) => bip < 3.0 * stock,
  margin: sm => sm >= 0.05 && sm <= 0.35,
};

if (!process.argv.includes('--selftest')) {
  say('=== BIPLANE ===');
  // ---- G185.2 the parasol -------------------------------------------------
  const def = buildGen(paraSpec());
  const S = def.spec, pl = def.parts.planes[0];
  const cb = cabaneOf(def);
  say('PARASOL: ' + def.nodes.length + ' nodes, ' + def.beams.length + ' beams, cabane ' +
      cb.all.length + ' members (' + cb.drawn.length + ' drawn), root ' +
      (pl.wingY0 - S.cabin.h).toFixed(3) + ' m above the roof, zRoot ' + pl.zRoot.toFixed(3));
  check(cb.wellFormed && cb.all.length > 0, 'cabane members join a root spar node to the body');
  check(C.cabaneDrawn(cb.drawn.length), 'eight cabane struts drawn (N: post + diagonal per root)', String(cb.drawn.length));
  check(C.cabaneHeight(pl.wingY0 - S.cabin.h, 0.50), 'the root stands cabaneH above the roof');
  check(C.splay(pl.zRoot, S.cabin.halfW), 'the roots splay cabaneSplay outboard of the cabin side');
  check(pl.useStrut, 'a parasol keeps its lift struts');
  const r0 = rigid(def);
  check(C.rigid(r0), 'parasol framework is rigid', r0.rank + '/' + r0.want);
  const sh0 = cabaneShare(def);
  say('ROOT LOAD at 1 g: cabane ' + sh0.cab.toFixed(0) + ' N of ' + sh0.all.toFixed(0) +
      ' N vertical at the root spar nodes (' + (100 * sh0.share).toFixed(0) + ' %)');
  check(C.cabaneCarries(sh0), 'the drawn cabane carries the wing (>= 25 % of the root load)',
        (100 * sh0.share).toFixed(0) + ' %');
  // ---- the wire law -------------------------------------------------------
  const sW = wireLaw(-0.02, true), sB = wireLaw(-0.02, false), sN = wireLaw(-0.02, null);
  const tW = wireLaw(+0.02, true), tB = wireLaw(+0.02, false);
  say('WIRE: rigged strain ' + sW.strain0.toExponential(2) + ' · shortened: wire ' +
      sW.vb.toExponential(3) + ' vs beam ' + sB.vb.toExponential(3) + ' vs none ' +
      sN.vb.toExponential(3) + ' · lengthened: ' +
      tW.vb.toExponential(3) + ' vs ' + tB.vb.toExponential(3));
  check(C.taut(sW.strain0), 'a rigged wire stands in tension at rest', sW.strain0.toExponential(2));
  check(Math.abs(sW.L0 - sW.L * (1 - 5e-4)) < 1e-9, 'pre-strain shortens the rest length');
  check(C.slackDoesNothing(sW.vb, sB.vb, sN.vb), 'a slack wire pushes nothing (the ordinary member would)');
  check(C.tautPullsAlike(tW.vb, tB.vb), 'a taut wire pulls exactly as an ordinary member');
  // ---- it flies -----------------------------------------------------------
  const sh = genShakedown(def);
  check(C.margin(sh.staticMargin), 'parasol static margin 5-35 %', (100 * sh.staticMargin).toFixed(1) + ' %');
  if (!process.argv.includes('--quick')) {
    const f = fly(paraSpec(), 420);
    check(C.flew(f), 'the parasol flies the circuit to a stop', f.phase + ' at ' + f.t.toFixed(0) + ' s');
  }
  // ---- G185.3 the second plane's structure -------------------------------
  {
    const d = buildGen(bipSpec()), S2 = d.spec, pls = d.parts.planes;
    const cls = c => d.beams.filter(b => b.cls === c && b.ext).length;
    say('BIPLANE: ' + d.nodes.length + ' nodes, ' + d.beams.length + ' beams, planes ' + pls.length +
        ', interplane ' + cls('interplane') + ' drawn, wires ' + cls('wire') +
        ', stations ' + pls.map(p => p.zIP.toFixed(2)).join('/') +
        ', gap ' + (pls[0].wingY0 - pls[1].wingY0).toFixed(2) + ' m');
    check(pls.length === 2 && S2.wings.length === 2, 'two planes built');
    check(C.nStruts(cls('interplane')), 'N interplane struts: six drawn members', String(cls('interplane')));
    check(C.wires(cls('wire')), 'eight wires', String(cls('wire')));
    check(C.stationShared(pls[0].zIP, pls[1].zIP), 'equal planes share the interplane station');
    check(C.lowerAft(S2.wings[1].xLE, S2.wings[0].xLE, 0.35), 'the lower plane sits its stagger aft');
    check(pls[0].truss && pls[1].truss && pls[0].upper && !pls[1].upper,
          'both planes are the wired truss; the parasol is the upper');
    check(pls[0].bracing === 'interplane truss' && d.beams.filter(b => b.ext && b.cls === 'wing').length === 0,
          'no fuselage lift strut on a biplane');
    const r = rigid(d);
    check(C.rigid(r), 'the biplane framework is rigid', r.rank + '/' + r.want);
    // every wire taut at 1 g, settled
    const sim = makeSim(d, null); sim.reset(0);
    for (let s2 = 0; s2 < 300; s2++) sim.step(1 / 60);
    let taut = 0;
    for (const bm of sim.beams) if (bm.cls === 'wire') {
      const L = Math.hypot(sim.p[bm.b*3]-sim.p[bm.a*3], sim.p[bm.b*3+1]-sim.p[bm.a*3+1], sim.p[bm.b*3+2]-sim.p[bm.a*3+2]);
      if (L > bm.L0) taut++;
    }
    check(C.allTaut(taut), 'every wire stands taut at 1 g', taut + '/8');
    const dS = buildGen(bipSpec(SESQ)), pS = dS.parts.planes;
    check(C.leans(pS[0].zIP, pS[1].zIP), 'the sesquiplane\'s lower station clamps inboard (the strut leans)',
          pS[0].zIP.toFixed(2) + ' vs ' + pS[1].zIP.toFixed(2));
    const dE = buildGen(bipSpec(EAGLE));
    const clsE = c => dE.beams.filter(b => b.cls === c && b.ext).length;
    check(C.iStruts(clsE('interplane')) && clsE('wire') === 0 && !dE.parts.planes[0].truss,
          'I-strut cantilever: four drawn posts, no wires, boxed planes',
          clsE('interplane') + ' / ' + clsE('wire'));
    const rE = rigid(dE);
    check(C.rigid(rE), 'the I-strut cantilever is rigid', rE.rank + '/' + rE.want);
    check(d.params.gen.braceDCdA > 0.10 && dE.params.gen.braceDCdA < d.params.gen.braceDCdA,
          'the truss pays its drag, the cleaner one less',
          d.params.gen.braceDCdA.toFixed(3) + ' / ' + dE.params.gen.braceDCdA.toFixed(3));
  }
  // ---- G185.5 the vortex kernel ------------------------------------------
  {
    const K = vortexKernel, A = [0, 0, -1], B = [0, 0, 1], dir = [1, 0, 0];
    say('KERNEL: horseshoe vs a 400 000-element Biot-Savart integral, Munk at 1e-9, the ground image');
    for (const P of [[2, -0.3, 0.4], [0, -1, 0], [-1, 0.5, 0.2]]) {
      const o = K.horseshoe(A, B, dir, 1e-9, P, [0, 0, 0]);
      check(C.kernelMatches(o, horseshoeNumeric(A, B, dir, P)), 'kernel = Biot-Savart integral at ' + JSON.stringify(P));
    }
    const m0 = munkSum(0), m1 = munkSum(0.5), m2 = munkSum(-0.5);
    check(C.munkExact(m0, m1, m2), 'Munk: the mutual sum is stagger-invariant to 1e-9', m0.toFixed(9) + ' / ' + m1.toFixed(9));
    check(C.munkBroken(munkSum(0, 0.14), munkSum(0.5, 0.14)), 'NEGATIVE: control points off the bound line break it');
    // the image: a horseshoe's field at a point mirrored about y = 0, from
    // the horseshoe mirrored with its circulation reversed, is the mirror
    const up = K.horseshoe([0, 0.5, -1], [0, 0.5, 1], dir, 1e-9, [1, 0.2, 0.3], [0, 0, 0]);
    const dn = K.horseshoe([0, -0.5, 1], [0, -0.5, -1], dir, 1e-9, [1, -0.2, 0.3], [0, 0, 0]);
    check(C.imageMirror(up, dn), 'the ground image is the mirrored horseshoe with reversed circulation');
  }
  // ---- G185.5 Prandtl, Munk and Diehl on the aeroplane ---------------------
  {
    const sig = [[14, 0.5], [9, 0.5], [6.5, 0.5], [6.5, 1.2]].map(([span, cabH]) =>
      sigmaAt(bipSpec(s => { s.wings[0].span = span; s.wings[1].span = span;
                              s.wings[0].cabaneH = cabH; s.wings[1].stagger = 0; })));
    say('SIGMA: ' + sig.map(s => 'G/b ' + s.gb.toFixed(3) + ' model ' + s.sigma.toFixed(3) + ' Prandtl ' + s.fit.toFixed(3)).join(' · '));
    for (const s of sig) check(C.sigmaBand(s), 'sigma within 0.75-1.05 of Prandtl at G/b ' + s.gb.toFixed(3), s.sigma.toFixed(3) + ' vs ' + s.fit.toFixed(3));
    for (let i = 1; i < sig.length; i++) check(C.sigmaFalls(sig[i - 1], sig[i]), 'sigma falls with the gap (' + sig[i - 1].gb.toFixed(2) + ' -> ' + sig[i].gb.toFixed(2) + ')');
    const m = splitAt(bipSpec(s => { s.wings[1].stagger = -0.4; }), 4 * D2R);
    const z = splitAt(bipSpec(s => { s.wings[1].stagger = 0; }), 4 * D2R);
    const p = splitAt(bipSpec(s => { s.wings[1].stagger = 0.4; }), 4 * D2R);
    say('STAGGER: upper share ' + m.upper.toFixed(3) + ' / ' + z.upper.toFixed(3) + ' / ' + p.upper.toFixed(3) +
        ' at -0.4 / 0 / +0.4 m; drag ' + m.D.toFixed(1) + ' / ' + z.D.toFixed(1) + ' / ' + p.D.toFixed(1) + ' N');
    check(C.splitRises(m, z, p), 'Diehl: the forward plane carries more as the stagger grows');
    check(C.staggerDrag(m, z, p), 'Munk: the total drag at fixed alpha moves under 4 % with stagger');
    const dec = splitAt(bipSpec(s => { s.wings[1].stagger = 0; s.wings[0].incidence = 3.5; }), 4 * D2R);
    check(C.splitDecalage(z, dec), 'Diehl: +2 deg decalage on the upper plane raises its share by > 0.03', (dec.upper - z.upper).toFixed(3));
  }
  // ---- G185.5 the tail's downwash ------------------------------------------
  {
    const eps = {};
    for (const [nm, spec] of [['stock', undefined], ['cantilever', { bracing: { type: 'cantilever' } }],
                              ['mid wing', { wings: [{ position: 'mid' }] }]]) {
      const sh = genShakedown(buildGen(spec));
      eps[nm] = sh.dEpsDa;
      check(C.epsWindow(sh.dEpsDa), 'tail downwash slope in the window on the ' + nm + ' monoplane', sh.dEpsDa.toFixed(3));
    }
    const dB = buildGen(bipSpec()), shB = genShakedown(dB);
    say('DOWNWASH d(eps)/d(alpha): stock ' + eps.stock.toFixed(3) + ' · cantilever ' + eps.cantilever.toFixed(3) +
        ' · mid wing ' + eps['mid wing'].toFixed(3) + ' · biplane ' + shB.dEpsDa.toFixed(3) +
        ' (applied on the biplane, a readout on the others; constant 0.40)');
    check(C.epsWindow(shB.dEpsDa) && C.epsBiplaneMore(shB.dEpsDa, eps.stock), 'the biplane\'s tail sees more downwash than a monoplane\'s');
    // ---- G197 the loading the sources shed --------------------------------
    {
      const dU = buildGen(); dU.params.induction.loading = 'uniform';
      const uni = genShakedown(dU).dEpsDa;
      say('LOADING: stock tail slope elliptic ' + eps.stock.toFixed(3) + ' · uniform control ' + uni.toFixed(3) +
          ' (G185 read 0.223 with uniform sources; classical far-field 2a/(pi AR) 0.41)');
      check(C.uniformAnchor(uni), 'the uniform control reproduces the G185 reading', uni.toFixed(3));
      check(C.loadingLifts(eps.stock, uni), 'elliptic sources lift the tail slope 1.3x over uniform', (eps.stock / uni).toFixed(2));
      const dE = buildGen(), sim = makeSim(dE, null); sim.reset(0);
      const [xA, yU] = sim.axes(), vel = [0, 0, 0];
      for (let k = 0; k < 3; k++) vel[k] = -25 * (Math.cos(0.05) * xA[k] + Math.sin(0.05) * yU[k]);
      sim.probe(vel);
      const I = sim.induction();
      let sG = 0, sW = 0, root = null, tip = null, zMax = 0;
      I.WS.forEach((j, n) => {
        const st = dE.strips[j], sg = st.side < 0 ? -1 : 1;
        sG += sg * I.Gam[j] * I.Dz[j]; sW += sg * I.Wg[j] * I.Dz[j];
        const zo = Math.max(Math.abs(I.zA[n]), Math.abs(I.zB[n]));
        if (st.t === 0.5) root = I.Wg[j] / I.Gam[j];
        if (zo > zMax) { zMax = zo; tip = I.Wg[j] / I.Gam[j]; }
      });
      say('WEIGHTS: centre ' + root.toFixed(3) + ' · tip ' + tip.toFixed(3) + ' of the strip circulation; sum(W dz) ' + sW.toFixed(6) + ' vs sum(Gam dz) ' + sG.toFixed(6));
      check(C.weightsConserve(sW, sG), 'the weights conserve each plane circulation-length');
      check(C.weightsShape(root, tip), 'the weights are root-heavy and tip-light', root.toFixed(2) + ' / ' + tip.toFixed(2));
    }
    const sim = makeSim(dB, null); sim.reset(0); sim.probe([-30, 0, 0]);
    check(C.resid(sim.out.gamResid), 'the probe\'s circulation converges (residual < 2 %)', sim.out.gamResid.toExponential(2));
    check(dB.params.downwashModel === 'vortex' && buildGen().params.downwashModel === 'const',
          'the biplane flies the vortex model, the monoplane keeps its constant');
    const t0 = Date.now(); for (let i = 0; i < 3; i++) buildGen(); const tS = (Date.now() - t0) / 3;
    const t1 = Date.now(); for (let i = 0; i < 3; i++) buildGen(bipSpec()); const tB = (Date.now() - t1) / 3;
    say('PERF: buildGen stock ' + tS.toFixed(0) + ' ms, biplane ' + tB.toFixed(0) + ' ms');
    check(C.perf(tB, Math.max(tS, 20)), 'a biplane builds in under 3x the stock (floored at 20 ms)', (tB / Math.max(tS, 20)).toFixed(2) + 'x');
  }
  say('GATE BIPLANE: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}

// ---------------------------------------------------------------------------
// --selftest: doctored numbers, no sims flown
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  const cases = [
    ['cabaneDrawn 6',        !C.cabaneDrawn(6)],
    ['height off by 5 mm',   !C.cabaneHeight(0.505, 0.50)],
    ['splay missing',        !C.splay(0.52, 0.52)],
    ['rank short by one',    !C.rigid({ rank: 100, want: 101 })],
    ['cabane carrying 10 %',   !C.cabaneCarries({ all: 900, share: 0.10 })],
    ['wire slack at rest',   !C.taut(0)],
    ['slack wire pushing',   !C.slackDoesNothing(0.5, 1.0, 0.0)],
    ['taut wire weaker',     !C.tautPullsAlike(0.9, 1.0)],
    ['circuit not finished', !C.flew({ phase: 'CRUISE', nan: false })],
    ['margin 40 %',          !C.margin(0.40)],
    ['seven wires',          !C.wires(7)],
    ['five N members',       !C.nStruts(5)],
    ['stations 1 mm apart',  !C.stationShared(3.0, 3.001)],
    ['a strut that does not lean', !C.leans(3.0, 2.8)],
    ['a slack wire at 1 g',  !C.allTaut(7)],
    ['kernel off by 1e-5',   !C.kernelMatches([0.1, 0.2, 0.3], [0.1, 0.2, 0.30001])],
    ['Munk off by 1e-6',     !C.munkExact(1, 1 + 1e-6, 1)],
    ['sigma at half Prandtl', !C.sigmaBand({ sigma: 0.25, fit: 0.5 })],
    ['sigma rising with gap', !C.sigmaFalls({ sigma: 0.4 }, { sigma: 0.5 })],
    ['a split that ignores stagger', !C.splitRises({ upper: 0.5 }, { upper: 0.5 }, { upper: 0.5 })],
    ['decalage doing nothing', !C.splitDecalage({ upper: 0.5 }, { upper: 0.51 })],
    ['downwash slope 0.9',   !C.epsWindow(0.9)],
    ['elliptic no better than uniform', !C.loadingLifts(0.25, 0.22)],
    ['uniform control off by 0.05', !C.uniformAnchor(0.28)],
    ['weights losing 1e-6 of the circulation', !C.weightsConserve(1, 1 + 1e-6)],
    ['weights flat along the span', !C.weightsShape(1.0, 1.0)],
    ['a residual of 5 %',    !C.resid(0.05)],
    ['a biplane 4x the stock', !C.perf(80, 20)],
  ];
  let pass = true;
  for (const [nm, caught] of cases) {
    say('  selftest ' + nm.padEnd(30) + (caught ? 'CAUGHT' : 'MISSED'));
    if (!caught) pass = false;
  }
  say('GATE BIPLANE: ' + (pass ? 'PASS' : 'FAIL (selftest)'));
  process.exit(pass ? 0 : 1);
}
