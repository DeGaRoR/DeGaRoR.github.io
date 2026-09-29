#!/usr/bin/env node
// GATE HITBOX (G1060-G1062) — A PARKED AEROPLANE'S HITBOX IS ITS OWN GEOMETRY.
//
// The user (2026-09-28): "the hitbox of the wing of the cub is a few centimeters too long compared to the wing mesh,
// and the plane rolling out hits it, while there is no mesh contact" ... "can't the editor tell you the exact
// dimensions of the wing box? And the fuselage?" ... "you have literal parameters like wingspan, chord and incidence
// ... and you also have the original cage, for the fuselage at least". The cause: render_premises rasterised every
// obstacle into 0.5 m columns, a cell a triangle touched solid - a wingtip's cell overhung the drawn tip by up to the
// cell (measured below: the Cub 15 cm, the 172 50, the Jodel 35). The fix (29_obstacles.js aircraftShape): convex
// pieces cut from the build's own physics frame (the spec's wing loft rows, tail stations, the cage, struts, wheels,
// engines) and carried into the parked object's frame by the capture's own map. The rolling aeroplane's side of the
// contact is its nodes as POINTS (30_solver.js: OBSTACLES.penetration per node, no radius) - nothing to shrink there.
//
//   1 THE PIECES (pure): a hull is its faces; a point inside goes out through the nearest face; a face shared with the
//     next piece is no way out; a piece on the ground never pushes a node down; the yaw carries the push to the world
//   2 EVERY ARCHETYPE (pure): its spec stands a shape (the frame's own map, no capture), the wing's reach IS the
//     span (half-span to 2 mm), in milliseconds
//   3 THE CAPTURES (the page in node: tools/_page_node.js, the garage boot, PARKED.capture - ~1.5 min, ~3 GB): for
//     the Jolene keys (arch:cub FIRST, arch:c172, arch:jodel), the shape exactly as render_premises registers it:
//       a  the WING: every vertex of the wing buckets (surface class 1) inside the shape to 5 mm; the ailerons' and
//          flaps' parts (their horns and hinges hang off the skin) to 5 cm
//       b  the OVERHANG at wing height: the shape's outboard wing surface (|z| past the cage + 25 cm) no farther than
//          5 cm from the wing mesh anywhere, the tip's reach within 5 cm of the drawn tip's - against the old 0.5 m
//          raster's tip (printed: what the user flew into)
//       c  the rest, by identity, printed and bounded (the cage is not the drawn skin: the crown, the windscreen, the
//          editor's own struts and legs are the def's approximation - a regression guard, not a promise)
//       d  THE TAXI PAST (the node side): the Cub and the stock build, each settled on the flat by its own solver,
//          rolled rigid past a parked capture on a parallel heading, 1 cm a step - the first whose drawn wing reaches
//          out at the tip node's own height (the Cub past the Cub; the stock build's tips ride over the Cub's, so past
//          the 172): with the wingtip's track 10 cm clear of that drawn wing the new shape reports NO contact (the old
//          raster's count printed: the user's bug); 1 cm into the drawn wing the new shape reports contact
//       e  THE COST: the shape's build per key against the old path (the L1 mesh's vertex walk and its 0.5 m raster),
//          and the bytes it keeps
//
//   node tools/_hitbox_check.js            -> "GATE HITBOX: PASS|FAIL"
//   node tools/_hitbox_check.js --pure     -> 1 and 2 only (seconds)
'use strict';
const path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const D = require(path.join(T, '_cage_design.js'));
const OB = C.OBSTACLES;
const PURE = process.argv.includes('--pure');
let bad = 0, n = 0;
const check = (ok, what, detail) => { n++; if (!ok) bad++; console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : '')); return ok; };
const f3 = v => (+v).toFixed(3), cm = v => (v * 100).toFixed(1) + ' cm';
const ms = t0 => Number(process.hrtime.bigint() - t0) / 1e6;

// ---- helpers: a piece's faces (the vertices of its half-spaces), point-triangle distance, a triangle grid ------------
function vertsOf(pc) {
  const P = pc.planes, k = P.length / 4, V = [];
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) for (let c = b + 1; c < k; c++) {
    const A = [P[a * 4], P[a * 4 + 1], P[a * 4 + 2]], B = [P[b * 4], P[b * 4 + 1], P[b * 4 + 2]], Cc = [P[c * 4], P[c * 4 + 1], P[c * 4 + 2]];
    const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const bc = cr(B, Cc), det = A[0] * bc[0] + A[1] * bc[1] + A[2] * bc[2];
    if (Math.abs(det) < 1e-9) continue;
    const ca = cr(Cc, A), ab = cr(A, B), da = P[a * 4 + 3], db = P[b * 4 + 3], dc = P[c * 4 + 3];
    const p = [0, 1, 2].map(i => (da * bc[i] + db * ca[i] + dc * ab[i]) / det);
    if (OB.sdist(pc, p[0], p[1], p[2]) <= 1e-6) V.push(p);
  }
  return V;
}
function faceTris(pc) {
  const V = vertsOf(pc), P = pc.planes, out = [];
  for (let m = 0; m < P.length; m += 4) {
    const nrm = [P[m], P[m + 1], P[m + 2]], on = V.filter(p => Math.abs(nrm[0] * p[0] + nrm[1] * p[1] + nrm[2] * p[2] - P[m + 3]) < 1e-6);
    if (on.length < 3) continue;
    const c = [0, 1, 2].map(a => on.reduce((s, p) => s + p[a], 0) / on.length);
    let u = [on[0][0] - c[0], on[0][1] - c[1], on[0][2] - c[2]]; const ul = Math.hypot(u[0], u[1], u[2]) || 1; u = u.map(x => x / ul);
    const v = [nrm[1] * u[2] - nrm[2] * u[1], nrm[2] * u[0] - nrm[0] * u[2], nrm[0] * u[1] - nrm[1] * u[0]];
    const ang = p => Math.atan2((p[0] - c[0]) * v[0] + (p[1] - c[1]) * v[1] + (p[2] - c[2]) * v[2], (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1] + (p[2] - c[2]) * u[2]);
    const ring = on.slice().sort((a, b) => ang(a) - ang(b));
    for (let i = 1; i + 1 < ring.length; i++) out.push({ a: ring[0], b: ring[i], c: ring[i + 1], n: nrm });
  }
  return out;
}
function ptTri(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  const at = (o, e, t) => [o[0] + e[0] * t, o[1] + e[1] * t, o[2] + e[2] * t];
  let q;
  if (d1 <= 0 && d2 <= 0) q = a; else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b; else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) q = at(a, ab, d1 / (d1 - d3)); else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c; else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) q = at(a, ac, d2 / (d2 - d6)); else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) q = at(b, sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
            else { const den = 1 / (va + vb + vc); q = [a[0] + ab[0] * vb * den + ac[0] * vc * den, a[1] + ab[1] * vb * den + ac[1] * vc * den, a[2] + ab[2] * vb * den + ac[2] * vc * den]; }
          } } } } }
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
function triGrid(pos, idx, cell) {
  const G = new Map(), key = (i, j, k) => i + ',' + j + ',' + k;
  for (let t = 0; t < idx.length; t += 3) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) { const x = pos[idx[t + v] * 3 + a]; if (x < b[a]) b[a] = x; if (x > b[a + 3]) b[a + 3] = x; }
    for (let i = Math.floor(b[0] / cell); i <= Math.floor(b[3] / cell); i++) for (let j = Math.floor(b[1] / cell); j <= Math.floor(b[4] / cell); j++)
      for (let k = Math.floor(b[2] / cell); k <= Math.floor(b[5] / cell); k++) { const K = key(i, j, k); let L = G.get(K); if (!L) G.set(K, L = []); L.push(t); }
  }
  const V = (t, x) => [pos[idx[t + x] * 3], pos[idx[t + x] * 3 + 1], pos[idx[t + x] * 3 + 2]];
  return { near(p, rmax) {
    const r = Math.ceil(rmax / cell), i0 = Math.floor(p[0] / cell), j0 = Math.floor(p[1] / cell), k0 = Math.floor(p[2] / cell), seen = new Set(); let best = rmax;
    for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) for (let k = k0 - r; k <= k0 + r; k++) { const L = G.get(key(i, j, k)); if (!L) continue;
      for (const t of L) { if (seen.has(t)) continue; seen.add(t); const d = ptTri(p, V(t, 0), V(t, 1), V(t, 2)); if (d < best) best = d; } }
    return best; } };
}
const outside = (S, x, y, z) => { let m = Infinity; for (const pc of S.pieces) { const b = pc.bb; if (Math.max(b[0] - x, x - b[3], b[1] - y, y - b[4], b[2] - z, z - b[5]) >= m) continue; m = Math.min(m, OB.sdist(pc, x, y, z)); if (m <= 0) return 0; } return Math.max(0, m); };

// ---- 1 the pieces ---------------------------------------------------------------------------------------------------
console.log('1. the pieces');
{
  const cube = (x0, y0, z0, s) => { const p = []; for (const x of [x0, x0 + s]) for (const y of [y0, y0 + s]) for (const z of [z0, z0 + s]) p.push([x, y, z]); return p; };
  const h = OB.hull(cube(0, 0, 0, 1));
  check(!!h && h.length === 24, 'a cube\'s hull is its six faces', h && (h.length / 4) + ' faces');
  check(OB.hull([[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]]) === null, 'a flat set is no piece');
  const S = OB.pieces([{ tag: 'a', pts: cube(-1, 0.5, -0.5, 1) }, { tag: 'b', pts: cube(0, 0.5, -0.5, 1) }]);
  const rec = { x: 0, z: 0, yaw: 0, y0: 0, c: 1, s: 0, shape: S };
  let p = OB.penetration(rec, -0.05, 1.3, 0, [0, 0, 0]);
  check(p && p[0] === 0 && p[2] === 0 && p[1] > 0.2 && p[1] < 0.3, 'a point by the shared face goes UP (its own nearest external face), not into the next piece', p && p.map(f3).join(','));
  p = OB.penetration(rec, 0.9, 1.0, 0, [0, 0, 0]);
  check(p && p[0] > 0.1 && p[0] < 0.2 && Math.abs(p[1]) < 1e-9, 'a point by the end goes out through the end', p && p.map(f3).join(','));
  check(OB.penetration(rec, 1.2, 1.0, 0, [0, 0, 0]) === null && OB.penetration(rec, 0, 0.4, 0, [0, 0, 0]) === null && OB.penetration(rec, 0, 1.6, 0, [0, 0, 0]) === null, 'outside, under and over are free');
  p = OB.penetration(rec, 0, 0.55, 0, [0, 0, 0]);
  check(p && p[1] < 0, 'a piece clear of the ground pushes a point just under its floor DOWN', p && p.map(f3).join(','));
  const G = OB.pieces([{ tag: 'g', pts: cube(-1, 0, -1, 2) }]), rg = { x: 0, z: 0, yaw: 0, y0: 0, c: 1, s: 0, shape: G };
  p = OB.penetration(rg, 0.2, 0.05, 0.1, [0, 0, 0]);
  check(p && p[1] >= 0, 'a piece on the ground never pushes a node into it', p && p.map(f3).join(','));
  const yaw = 0.7, ry = { x: 10, z: -5, yaw, y0: 2, c: Math.cos(yaw), s: Math.sin(yaw), shape: S };
  const w = (lx, ly, lz) => [10 + lx * ry.c + lz * ry.s, 2 + ly, -5 - lx * ry.s + lz * ry.c];
  const q = w(0.9, 1.0, 0); p = OB.penetration(ry, q[0], q[1], q[2], [0, 0, 0]);
  check(p && Math.abs(p[0] - 0.15 * ry.c) < 1e-6 && Math.abs(p[2] + 0.15 * ry.s) < 1e-6, 'the yaw carries the push into the world frame', p && p.map(f3).join(','));
}

// ---- 2 every archetype from its spec alone ----------------------------------------------------------------------------
// the capture's map needs the drawn mains; with none, the frame's own (B^-1 of the frame's mains: T = 0) and a level
// stance - the pieces stand in the frame's own metres, which is what this checks
function frameDrawn(spec) {
  const RS = C.resolveSpec(JSON.parse(JSON.stringify(spec))), fr = C.genFrame(RS.spec || RS), r = fr.refs;
  const mean = ids => { let x = 0, y = 0; for (const i of ids) { x += fr.nodes[i].p[0]; y += fr.nodes[i].p[1]; } return [x / ids.length, y / ids.length]; };
  const nF = mean(r.noseFrame), tM = mean(r.tailMid), uH = mean(r.upHi), uL = mean(r.upLo);
  const la = Math.hypot(tM[0] - nF[0], tM[1] - nF[1]), lu = Math.hypot(uH[0] - uL[0], uH[1] - uL[1]);
  const xA = [(tM[0] - nF[0]) / la, (tM[1] - nF[1]) / la], yU = [(uH[0] - uL[0]) / lu, (uH[1] - uL[1]) / lu], det = xA[0] * yU[1] - yU[0] * xA[1];
  const m = mean(r.mains);
  return { fr, S: RS.spec || RS, drawn: { mains: [(yU[1] * m[0] - yU[0] * m[1]) / det, (-xA[1] * m[0] + xA[0] * m[1]) / det], stance: { pitch: 0, lift: 0 } } };
}
console.log('2. every archetype from its spec');
{
  let nA = 0, worst = 0, tMax = 0, wk = '';
  for (const a of D.ARCHETYPES) {
    if (D.archInactive(a)) continue;
    const spec = D.designBake(a.sel, a.over), F = frameDrawn(spec);
    if (F.S.gear && F.S.gear.type === 'floats') { console.log('  --   ' + a.key + ': floats (no mains: the mesh raster stands it)'); continue; }
    const t0 = process.hrtime.bigint(), S = OB.aircraftShape(spec, F.drawn), t = ms(t0);
    tMax = Math.max(tMax, t);
    if (!check(!!S && S.pieces.length >= 20 && isFinite(S.xr) && isFinite(S.top), a.key + ' stands a shape', S ? S.pieces.length + ' pieces, ' + t.toFixed(0) + ' ms' : 'none')) continue;
    let zr = 0; for (const pc of S.pieces) if (/^wing/.test(pc.tag)) zr = Math.max(zr, -pc.bb[2], pc.bb[5]);
    const semi = F.S.wings.reduce((m, w) => Math.max(m, w.span / 2), 0), e = Math.abs(zr - semi);
    if (e > worst) { worst = e; wk = a.key; }
    nA++;
  }
  check(nA >= 20, nA + ' archetypes stand an analytic shape');
  check(worst <= 0.002, 'the wing\'s reach is the spec\'s half-span on every one (to 2 mm: a bowed tip\'s last loft row stands at sin(0.965 x 90 deg) of its radius, as drawn)', 'worst ' + (worst * 1000).toFixed(1) + ' mm, ' + wk);
  check(tMax < 400, 'each in a fraction of a second', 'slowest ' + tMax.toFixed(0) + ' ms (first calls pay the JIT)');
}
if (PURE) { console.log((n - bad) + '/' + n + ' checks (--pure)'); console.log('GATE HITBOX: ' + (bad ? 'FAIL' : 'PASS')); process.exit(bad ? 1 : 0); }

// ---- 3 the captures, the page in node ------------------------------------------------------------------------------
(async () => {
  console.log('3. the captures (the page in node)');
  const { openPage } = require(path.join(T, '_page_node.js'));
  const P = await openPage({ quiet: true, storage: {} });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  const THREE = W.THREE, PK = W.PARKED, POB = require('vm').runInContext('OBSTACLES', W);   // a script's const: the page's lexical global
  PK.quiet = true;
  const KEYS = ['arch:cub', 'arch:c172', 'arch:jodel'];
  const PARKS = [];
  for (const key of KEYS) {
    const rec = PK.capture(key);
    if (!check(!!rec, key + ' captured')) continue;
    const grp = new THREE.Group(), lod = PK.build(THREE, rec, grp); grp.updateMatrixWorld(true);
    const st = lod.userData.stance, cs = Math.cos(st.pitch), sn = Math.sin(st.pitch);
    // THE SHAPE, as render_premises registers it (aircraftOf: the same two calls)
    let t0 = process.hrtime.bigint();
    const S = POB.aircraftShape(rec.spec, POB.parkedDrawn(rec.vis, st));
    const tNew = ms(t0);
    if (!check(!!S, key + ' stands its spec shape', S ? S.pieces.length + ' pieces' : '')) continue;
    // the identity, in the object frame (parked.js hitboxOf's chain)
    const cls = {}, tris = {};
    const put = (name, g, at) => {
      const A = cls[name] || (cls[name] = []), I = tris[name] || (tris[name] = []), base = A.length / 3, q = g.pos;
      const dx = at ? at[0] : 0, dy = at ? at[1] : 0, dz = at ? at[2] : 0;
      for (let i = 0; i < q.length; i += 3) { const x0 = q[i] + dx, y0 = q[i + 1] + dy; A.push(-(x0 * cs - y0 * sn), x0 * sn + y0 * cs + st.lift, -(q[i + 2] + dz)); }
      if (g.idx) for (let i = 0; i < g.idx.length; i++) I.push(base + g.idx[i]);
    };
    for (const k in rec.vis.groups) { const m = rec.vis.mats[k] || {}; if (PK.isInterior(m)) continue; put(m.wing === 1 ? 'wing' : m.wing === 2 ? 'tail' : m.sec ? 'fuselage' : 'hardware', rec.vis.groups[k], null); }
    for (const p of rec.vis.parts) { if (!PK.PART_L1(p)) continue;
      const nm = /^surf_(ail|flap)/.test(p.kind) ? 'controls' : /^surf_/.test(p.kind) ? 'tail' : /^(mains|tw)/.test(p.kind) ? 'wheels' : /^(leg|castor)/.test(p.kind) ? 'legs' : /strut/.test(p.kind) ? 'struts' : /^(eng|prop)/.test(p.kind) ? 'engine' : 'hardware';
      for (const k in p.groups) put(nm, p.groups[k], p.stretch ? null : p.pivot); }
    const worstOut = name => { const A = cls[name] || []; let w = 0, at = null; for (let i = 0; i < A.length; i += 3) { const o = outside(S, A[i], A[i + 1], A[i + 2]); if (o > w) { w = o; at = [A[i], A[i + 1], A[i + 2]]; } } return { w, at, n: A.length / 3 }; };
    // a  the wing covered
    const wo = worstOut('wing'), co = worstOut('controls');
    check(wo.n > 1000 && wo.w <= 0.005, key + ' a: every wing vertex inside the shape', wo.n + ' vertices, worst ' + cm(wo.w));
    check(co.w <= 0.05, key + ' a: the ailerons\' and flaps\' parts inside to 5 cm (their horns hang off the skin)', 'worst ' + cm(co.w));
    // b  the overhang at wing height: the shape's outboard wing surface against the wing mesh (skin + controls)
    const cage = S.pieces.filter(pc => pc.tag === 'fuselage').reduce((m, pc) => Math.max(m, pc.bb[5], -pc.bb[2]), 0);
    const wp = [].concat(cls.wing, cls.controls || []), wi = [].concat(tris.wing, (tris.controls || []).map(i => i + cls.wing.length / 3));
    const TG = triGrid(wp, wi, 0.1);
    let over = 0, overAt = null, ns = 0;
    const wingPcs = S.pieces.filter(pc => /^wing/.test(pc.tag));
    let zTip = 0; for (const pc of wingPcs) zTip = Math.max(zTip, pc.bb[5], -pc.bb[2]);
    for (const pc of wingPcs) for (const t of faceTris(pc)) {
      const e1 = Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]), e2 = Math.hypot(t.c[0] - t.a[0], t.c[1] - t.a[1], t.c[2] - t.a[2]), m = Math.max(1, Math.ceil(Math.max(e1, e2) / 0.04));
      for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) {
        const f = i / m, g = j / m, h = 1 - f - g, q = [0, 1, 2].map(a => t.a[a] * h + t.b[a] * f + t.c[a] * g);
        // the tip's own face is the drawn tip's open end (no cap to measure to): its reach is the tip check below
        if (Math.abs(q[2]) < cage + 0.25 || Math.abs(q[2]) > zTip - 0.005) continue;
        const o = [q[0] + t.n[0] * 0.002, q[1] + t.n[1] * 0.002, q[2] + t.n[2] * 0.002];
        if (S.pieces.some(p2 => p2 !== pc && OB.sdist(p2, o[0], o[1], o[2]) < 0)) continue;   // inside the union: no surface
        ns++; const d = TG.near(q, 0.15); if (d > over) { over = d; overAt = q; }
      }
    }
    check(ns > 2000 && over <= 0.05, key + ' b: the shape\'s outboard wing surface within 5 cm of the wing mesh everywhere', ns + ' samples, worst ' + cm(over) + (overAt ? ' at ' + overAt.map(f3).join(',') : ''));
    // the tip, and the old raster's (the L1 mesh as shapeOf walks it, 0.5 m)
    let zMesh = 0; for (let i = 2; i < wp.length; i += 3) zMesh = Math.max(zMesh, Math.abs(wp[i]));
    let zNew = 0; for (const pc of wingPcs) zNew = Math.max(zNew, pc.bb[5], -pc.bb[2]);
    t0 = process.hrtime.bigint();
    const pos = [], idx = [], v = new THREE.Vector3();
    const walk = o => { if (o.isLOD) { walk(o.levels[0].object); return; }
      if (o.isMesh && o.geometry && o.geometry.attributes.position) { const A = o.geometry.attributes.position, base = pos.length / 3; let y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i < A.count; i++) { v.fromBufferAttribute(A, i).applyMatrix4(o.matrixWorld); pos.push(v.x, v.y, v.z); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
        if (y1 - y0 < 0.15) pos.length = base * 3; else { const I = o.geometry.index; if (I) for (let i = 0; i < I.count; i++) idx.push(base + I.getX(i)); else for (let i = 0; i < A.count; i++) idx.push(base + i); } }
      for (const c of o.children) walk(c); };
    walk(lod);
    const G = OB.rasterise(pos, idx, 0.5), tOld = ms(t0);
    let zOld = 0; for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) { const k = j * G.nx + i; if (G.hi[k] >= G.lo[k]) zOld = Math.max(zOld, Math.abs(G.oz + j * 0.5), Math.abs(G.oz + (j + 1) * 0.5)); }
    check(Math.abs(zNew - zMesh) <= 0.05, key + ' b: the tip reaches ' + f3(zNew) + ' m against the drawn tip\'s ' + f3(zMesh) + ' (' + cm(zNew - zMesh) + ')', 'the old 0.5 m raster reached ' + f3(zOld) + ': ' + cm(zOld - zMesh) + ' past it');
    // c  the rest, by identity (a regression guard: the cage is the fuselage's approximation, the def's struts and legs
    // the editor's)
    const BOUND = { tail: 0.45, fuselage: 0.30, hardware: 0.45, wheels: 0.05, legs: 0.35, struts: 0.45, engine: 0.20 };
    for (const nm of Object.keys(BOUND)) { if (!cls[nm]) continue; const r = worstOut(nm);
      check(r.w <= BOUND[nm], key + ' c: ' + nm + ' within ' + cm(BOUND[nm]) + ' of the shape', r.n + ' vertices, worst ' + cm(r.w) + (r.at ? ' at ' + r.at.map(f3).join(',') : '')); }
    // e  the cost
    const bytes = S.pieces.reduce((s, pc) => s + pc.planes.length * 8 + 48, 0), gBytes = G.nx * G.nz * 13;
    check(tNew < tOld, key + ' e: the spec shape costs less than the raster it replaces', tNew.toFixed(0) + ' ms against ' + tOld.toFixed(0) + ' ms (walk + 0.5 m raster, ' + (idx.length / 3) + ' tris); ' + (bytes / 1024).toFixed(1) + ' KB against ' + (gBytes / 1024).toFixed(1) + ' KB');
    PARKS.push({ key, S, G, wp });
  }
  // d  THE TAXI PAST: the stock build and the Cub, settled on the flat, rolled rigid past the parked Cub
  if (PARKS.length) {
    const W0 = C.makeWorld(0, {}), strip = W0.aerodromes.find(a => a.id === 'HOME') || W0.aerodromes[0];
    for (const B of [{ name: 'stock build', spec: JSON.parse(JSON.stringify(C.GEN_DEFAULT)) }, { name: 'Cub', spec: PT.specOf('cub').spec }]) {
      const Wf = Object.assign({}, W0, { terrainH: () => strip.elev, treesNear: (x, z, o) => { o.length = 0; return o; }, obstacles: null });
      const sim = C.makeSim(C.buildGen(B.spec), Wf); sim.reset(0); C.placeAtAerodrome(sim, strip);
      for (let f = 0; f < 180; f++) sim.step(1 / 60);
      const def = sim.def || null, nn = sim.n, p = Array.from(sim.p.slice(0, nn * 3));
      // the heading off the frame's own body axis (noseFrame -> tailMid, reversed), the right-hand lateral
      const refs = (def && def.refs) || C.buildGen(B.spec).refs, mean = ids => { let x = 0, z = 0; for (const i of ids) { x += p[i * 3]; z += p[i * 3 + 2]; } return [x / ids.length, z / ids.length]; };
      const nF = mean(refs.noseFrame), tM = mean(refs.tailMid), hl = Math.hypot(nF[0] - tM[0], nF[1] - tM[1]), h = [(nF[0] - tM[0]) / hl, (nF[1] - tM[1]) / hl];
      const yaw = Math.atan2(-h[1], h[0]), rgt = [Math.sin(yaw), Math.cos(yaw)];
      // the tip node: the node farthest to the right
      let tip = 0, lat = -Infinity; for (let i = 0; i < nn; i++) { const l = p[i * 3] * rgt[0] + p[i * 3 + 2] * rgt[1]; if (l > lat) { lat = l; tip = i; } }
      const ty = p[tip * 3 + 1] - strip.elev;
      // the parked wing it crosses: the first of the captures (the Cub first) whose drawn wing reaches out at the tip
      // node's own height (+-2 cm) - the stock build's tips ride over the Cub's and through the 172's. That reach, to
      // the parked aeroplane's LEFT (-z), is where the meshes first touch; it stands to the right, same heading, and
      // slides past from 15 m ahead to 15 m behind
      let PK2 = null, reach = 0;
      for (const q of PARKS) { let r = 0; const A = q.wp; for (let i = 0; i < A.length; i += 3) if (Math.abs(A[i + 1] - ty) < 0.02) r = Math.max(r, -A[i + 2]); if (r > 1) { PK2 = q; reach = r; break; } }
      if (!check(!!PK2, B.name + ' d: its wingtip node rides at ' + f3(ty) + ' m, in a parked wing\'s band', PK2 ? PK2.key + '\'s drawn wing reaches ' + f3(reach) + ' m out at that height' : 'none')) continue;
      const hits = (shape, gap) => {
        const c = Math.cos(yaw), s = Math.sin(yaw), off = lat + gap + reach, rec = { x: 0, z: 0, yaw, y0: strip.elev, c, s, shape }, o = [0, 0, 0];
        let n = 0;
        for (let t = -15; t <= 15; t += 0.01) {
          rec.x = rgt[0] * off + h[0] * t; rec.z = rgt[1] * off + h[1] * t;
          for (let i = 0; i < nn; i++) if (OB.penetration(rec, p[i * 3], p[i * 3 + 1], p[i * 3 + 2], o)) n++;
        }
        return n;
      };
      const a10 = hits(PK2.S, 0.10), a0 = hits(PK2.S, -0.01), o10 = hits(PK2.G, 0.10);
      check(a10 === 0, B.name + ' d: its wingtip\'s track 10 cm clear of ' + PK2.key + '\'s drawn wing - NO contact', a10 + ' node-steps in contact; the old raster: ' + o10 + (o10 ? ' (the user\'s bug)' : ''));
      check(a0 > 0, B.name + ' d: 1 cm into ' + PK2.key + '\'s drawn wing - contact', a0 + ' node-steps');
    }
  }
  console.log((n - bad) + '/' + n + ' checks'); console.log('GATE HITBOX: ' + (bad ? 'FAIL' : 'PASS'));   // (the runner reads the exact line)
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); console.log('GATE HITBOX: FAIL (' + (e && e.message) + ')'); process.exit(1); });
