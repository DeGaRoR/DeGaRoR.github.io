#!/usr/bin/env node
// _flown_bake_check.js — GATE FLOWNBAKE: the flown aeroplane's texture bake (C4a, G870), headless.
//
// The bake itself needs a WebGL renderer (the roll-out screen draws the flown shader into the atlas); everything
// around it is pure and proven here, on parked.js's own synthetic-payload shape and the real vendor three.js:
//
//   1  what bakes: the exterior AEROSKIN buckets - never glass, the inside, a turning blade, the facia, a
//      see-through bucket, nor a bucket that also rides a gauge / a control / a link
//   2  the unwrap: every baked vertex gets ONE atlas uv inside the atlas; a soup needs no split; a vertex two
//      charts claim IS split (every per-vertex array grows with it, the index follows, the positions agree)
//   3  the key: the same build keys the same, a changed spec or a changed group size keys anew
//   4  TANGENT SPACE: the frame the bake encodes in is three's getTangentFrame over the atlas uv, and it rides the
//      flex - a normal encoded on the rest triangle decodes, on the same triangle ROTATED (a flexed wing, a
//      hinged surface), to the rotated normal; and it does not depend on the screen that drew it
//   5  the mips: albedo averaged in LINEAR light (black + white -> sRGB 188, not 128), a flat normal map keeps
//      its roughness at every level, a bumpy one widens it (Toksvig) and the widening grows down the chain
//   6  the dilation: every unwritten texel takes its nearest written one's four channels, the inside flag
//      comes back to 0 / 255
//   7  the wiring: the flown factory's arguments are the same list in app.js, parked.js and flown_bake.js;
//      the snapshot notes the rest positions; buildModel reads the bake; the roll-out's 'bake' step sits after
//      'sync'; the bake hook's splices; the build manifest carries the file after parked.js
//
// Usage: node tools/_flown_bake_check.js          (prints GATE FLOWNBAKE: PASS|FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;
const ROOT = path.join(TOOLS, '..');
const fail = [];
let checks = 0;
const check = (ok, label, extra) => { checks++; if (!ok) fail.push(label + (extra ? ' — ' + extra : '')); return ok; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const W = { THREE, console, setTimeout, clearTimeout, performance, Math, JSON, Object, Array, Map, Set, WeakMap, WeakSet,
            Float32Array, Int16Array, Int8Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, ArrayBuffer, Promise, Number,
            String, isFinite, Infinity };
W.window = W; W.globalThis = W;
vm.createContext(W);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'parked.js'), 'utf8'), W, { filename: 'parked.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'flown_bake.js'), 'utf8'), W, { filename: 'flown_bake.js' });
const FB = W.FLOWN_BAKE, PK = W.PARKED;
check(!!FB && typeof FB.step === 'function' && !!PK && typeof PK.unwrap === 'function', 'the module loads headless beside parked.js');
FB.FB.quiet = true; PK.quiet = true;

// ---- the synthetic payload (parked's shape: unwelded soups, buckets by material, parts about their pivots) --------
function box(x0, y0, z0, x1, y1, z1, n) {
  const pos = [], nrm = [], idx = [], srf = [];
  const face = (o, u, v, N) => {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = (a, b) => [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b];
      const a = p(i / n, j / n), b = p((i + 1) / n, j / n), c = p((i + 1) / n, (j + 1) / n), d = p(i / n, (j + 1) / n);
      for (const q of [a, b, c, a, c, d]) { idx.push(pos.length / 3); pos.push(...q); nrm.push(...N); srf.push(q[0], q[2], 0, 0); }
    }
  };
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  face([x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1]);
  face([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], [0, 0, -1]);
  face([x1, y0, z1], [0, 0, -dz], [0, dy, 0], [1, 0, 0]);
  face([x0, y0, z0], [0, 0, dz], [0, dy, 0], [-1, 0, 0]);
  face([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], [0, 1, 0]);
  face([x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0]);
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx), nv: pos.length / 3,
           uv: new Float32Array((pos.length / 3) * 2), srf: new Float32Array(srf) };
}
function synthVis() {
  const groups = {}, mats = {};
  const bucket = (k, g, m) => { groups[k] = g; mats[k] = Object.assign({ color: 0xafa893, rough: 0.7, metal: 0 }, m); };
  bucket('sbody', box(-3, -0.6, -0.5, 3, 0.6, 0.5, 4), { sec: 'body', fin: 'fabric', surf: 1, grm: 'fabric' });
  bucket('cowl', box(-4, -0.5, -0.45, -3, 0.5, 0.45, 3), { fin: 'alclad', surf: 1 });
  bucket('wing', box(-1, 0.8, -5, 0.5, 0.9, 5, 4), { fin: 'alclad', wing: 1, surf: 1 });
  bucket('liner', box(-2, 0, -0.3, 0, 0.4, 0.3, 2), { fin: 'liner', inside: 1 });
  bucket('glass', box(-2.4, 0.2, -0.52, -1.2, 0.7, 0.52, 2), { fin: 'glass', opacity: 0.3, sec: 'windshield' });
  bucket('facia', box(-2.3, 0.1, -0.4, -2.2, 0.4, 0.4, 1), { fin: 'alclad', sec: 'dashFace' });
  bucket('tint', box(-0.1, 1, -0.1, 0.1, 1.1, 0.1, 1), { fin: 'alclad', opacity: 0.6 });
  bucket('knob', box(-2.1, 0.2, -0.1, -2.05, 0.25, -0.05, 1), { fin: 'plasticGrn' });   // also on a control, below
  mats.tyre = { color: 0x101010, fin: 'rubber' };
  mats.blade = { color: 0x925220, fin: 'ply', spin: 1 };
  mats.lamp = { lamp: 'nav', color: 0xff0000 };
  const parts = [
    { kind: 'mainsL', R: 0.25, pivot: [-1.5, -0.8, 0.8], stretch: false, groups: { tyre: box(-0.25, -0.25, -0.08, 0.25, 0.25, 0.08, 2) } },
    { kind: 'prop', R: 0, pivot: [-4.15, 0, 0], stretch: false, groups: { blade: box(-0.05, -0.9, -0.03, 0.05, 0.9, 0.03, 1) } },
    { kind: 'legL', R: 0, pivot: [-1.5, -0.8, 0.8], stretch: true, groups: { cowl: box(-1.6, -0.8, 0.6, -1.4, -0.2, 0.7, 1) } },
    { kind: 'ctlMove', R: 0, pivot: [-2, 0, 0], stretch: false, groups: { knob: box(-0.02, -0.02, -0.02, 0.02, 0.02, 0.02, 1), lamp: box(0, 0, 0, 0.01, 0.01, 0.01, 1) } },
  ];
  return { cage: true, groups, mats, parts };
}

// ---- 1 what bakes -------------------------------------------------------------------------------------------------
const vis = synthVis();
const names = FB.bakedNames(vis);
{
  const want = ['sbody', 'cowl', 'wing', 'tyre'].sort().join(',');
  check([...names].sort().join(',') === want, '1 the exterior AEROSKIN buckets bake, nothing else', [...names].sort().join(','));
  check(!names.has('glass') && !names.has('liner') && !names.has('blade') && !names.has('facia') && !names.has('tint'), '1 glass, the inside, a blade, the facia, a see-through bucket stay live');
  check(!names.has('knob'), '1 a bucket that also rides a cockpit control stays live (one material per name)');
}
const list = FB.groupsOf(vis, names);
check(list.length === 5 && list.filter(e => e.at).length === 1 && list.some(e => e.k === 'cowl' && !e.at && e.g === vis.parts[2].groups.cowl),
  '1 the baked groups in the payload\'s order: statics, then parts (a stretch part unrebased, a wheel at its pivot)', list.map(e => e.k + (e.at ? '@' : '')).join(','));

// ---- 2 the unwrap -------------------------------------------------------------------------------------------------
{
  FB.note(vis);
  const ext = FB.extOf(list);
  const uw = PK.unwrap(ext, { S: 256, gutter: 2 });
  if (check(!!uw, '2 the baked exterior unwraps')) {
    const split = FB.uvsOf(list, uw);
    check(split === 0, '2 a soup needs no split', String(split));
    let bad = 0, zero = 0, tot = 0;
    for (const e of list) {
      if (!e.uv || e.uv.length !== e.g.pos.length / 3 * 2) { bad++; continue; }
      for (let i = 0; i < e.uv.length; i += 2) { tot++; if (e.uv[i] === 0 && e.uv[i + 1] === 0) zero++; }
    }
    check(bad === 0 && zero === 0 && tot > 0, '2 every baked vertex has its atlas uv (Uint16, inside the atlas)', bad + ' groups wrong, ' + zero + ' of ' + tot + ' at the origin');
    // the uv per vertex IS the unwrap's per corner (a vertex is one corner of a soup)
    let off = 0;
    for (const e of list) for (let c = 0; c < e.g.idx.length; c++) {
      const v = e.g.idx[c], w = uw.idx[e.i0 + c];
      if (Math.abs(e.uv[v * 2] / 65535 - uw.uv[w * 2]) > 1 / 65535 || Math.abs(e.uv[v * 2 + 1] / 65535 - uw.uv[w * 2 + 1]) > 1 / 65535) off++;
    }
    check(off === 0, '2 each vertex carries its corner\'s wedge uv', off + ' off');
  }
  // a WELDED group: two faces sharing an edge's vertices across a fold -> the fold's vertices split
  const g = { pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]), nrm: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
              srf: new Float32Array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]), uv: new Float32Array(8),
              idx: new Uint32Array([0, 1, 2, 0, 3, 1]), nv: 4 };   // z = 0 (+z facing) and y = 0 (-y facing): one shared edge 0-1
  const v2 = { cage: true, groups: { w: g }, mats: { w: { fin: 'alclad' } }, parts: [] };
  const l2 = FB.groupsOf(v2, FB.bakedNames(v2));
  const ext2 = FB.extOf(l2), uw2 = PK.unwrap(ext2, { S: 64, gutter: 1 });
  const sp = FB.uvsOf(l2, uw2);
  check(sp === 2 && g.pos.length === 18 && g.nrm.length === 18 && g.srf.length === 24 && g.uv.length === 12 && g.nv === 6,
    '2 a vertex two charts claim is split, every per-vertex array with it', 'split ' + sp + ', pos ' + g.pos.length + ', srf ' + g.srf.length);
  let same = true;
  for (let c = 0; c < 6; c++) { const a = [0, 1, 2, 0, 3, 1][c], b = g.idx[c]; for (let q = 0; q < 3; q++) if (g.pos[b * 3 + q] !== [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1][a * 3 + q]) same = false; }
  check(same, '2 the split index draws the same triangles');
  check(g.idx[3] >= 4 || g.idx[5] >= 4, '2 the second chart\'s corners use the new vertices');
}

// ---- 3 the key ---------------------------------------------------------------------------------------------------
{
  const s1 = { cage: { a: 1 }, finish: { weather: { age: 0.2 } } };
  const k1 = FB.keyOf(list, s1), k2 = FB.keyOf(list, JSON.parse(JSON.stringify(s1)));
  const k3 = FB.keyOf(list, { cage: { a: 2 }, finish: { weather: { age: 0.2 } } });
  const k4 = FB.keyOf(list.slice(1), s1);
  check(k1 === k2 && k1 !== k3 && k1 !== k4, '3 the key: same build same key; the spec or the snapshot moving keys anew');
  W.FLYDIY_BUILD = 'b2'; const k5 = FB.keyOf(list, s1); W.FLYDIY_BUILD = undefined;
  check(k5 !== k1, '3 ...and so does the game\'s build (the shaders the bake ran)');
}

// ---- 4 TANGENT SPACE ------------------------------------------------------------------------------------------------
// three's getTangentFrame(eye_pos, N, uv) over a triangle drawn through a "screen" (s, t): q0 = dP/ds, q1 = dP/dt,
// st0 = duv/ds, st1 = duv/dt; the bake solves m = inverse(tbn) * Nf; the runtime decodes normalize(tbn' * m)
{
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrmz = a => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
  function frame(P, U, N, M) {   // M: the screen's 2x2 (s, t) -> barycentric (b1, b2): a change of screen
    const e1 = sub(P[1], P[0]), e2 = sub(P[2], P[0]), f1 = [U[1][0] - U[0][0], U[1][1] - U[0][1]], f2 = [U[2][0] - U[0][0], U[2][1] - U[0][1]];
    const q0 = add(mul(e1, M[0]), mul(e2, M[2])), q1 = add(mul(e1, M[1]), mul(e2, M[3]));
    const st0 = [f1[0] * M[0] + f2[0] * M[2], f1[1] * M[0] + f2[1] * M[2]], st1 = [f1[0] * M[1] + f2[0] * M[3], f1[1] * M[1] + f2[1] * M[3]];
    const q1p = cross(q1, N), q0p = cross(N, q0);
    const T = add(mul(q1p, st0[0]), mul(q0p, st1[0])), B = add(mul(q1p, st0[1]), mul(q0p, st1[1]));
    const sc = 1 / Math.sqrt(Math.max(dot(T, T), dot(B, B)));
    return [mul(T, sc), mul(B, sc), N];
  }
  const solve = (F, v) => {   // inverse(mat3(T, B, N)) * v by Cramer
    const [a, b, c] = F, det = dot(a, cross(b, c));
    return [dot(v, cross(b, c)) / det, dot(a, cross(v, c)) / det, dot(a, cross(b, v)) / det];
  };
  const apply = (F, m) => nrmz(add(add(mul(F[0], m[0]), mul(F[1], m[1])), mul(F[2], m[2])));
  const P = [[0.1, 0.2, 0.0], [0.9, 0.25, 0.1], [0.3, 1.1, 0.05]], U = [[0.20, 0.30], [0.26, 0.31], [0.21, 0.37]];
  const Ng = nrmz(cross(sub(P[1], P[0]), sub(P[2], P[0])));
  const Nf = nrmz(add(Ng, [0.25, -0.15, 0.1]));      // a rivet's slope
  const F0 = frame(P, U, Ng, [1, 0, 0, 1]);
  const m = nrmz(solve(F0, Nf));
  check(m[2] > 0, '4 the encoded normal leans out of the surface (z > 0)');
  const back = apply(F0, m);
  check(dot(back, Nf) > 0.99999, '4 decoded on the rest triangle, the normal is the flown shader\'s', String(dot(back, Nf)));
  const F1 = frame(P, U, Ng, [2, 1, 1, 3]);           // another screen: another projection of the same triangle
  check(dot(apply(F1, m), Nf) > 0.99999, '4 the frame does not depend on the screen that drew it (the bake\'s atlas vs the chase camera)');
  // the flex: the triangle turned 25 deg about an axis (a wing bending, an aileron on its hinge)
  const ax = nrmz([0.9, 0.3, 0.2]), th = 25 * Math.PI / 180;
  const rot = v => add(add(mul(v, Math.cos(th)), mul(cross(ax, v), Math.sin(th))), mul(ax, dot(ax, v) * (1 - Math.cos(th))));
  const Pr = P.map(p => add(rot(p), [3, -1, 2])), Ngr = nrmz(cross(sub(Pr[1], Pr[0]), sub(Pr[2], Pr[0])));
  const Fr = frame(Pr, U, Ngr, [1, 0.5, -0.2, 1.4]);
  check(dot(apply(Fr, m), rot(Nf)) > 0.99999, '4 TANGENT SPACE RIDES THE FLEX: on the turned triangle the decode is the turned normal', String(dot(apply(Fr, m), rot(Nf))));
  // object space (G569) would not: the same map read as object space points the old way
  check(dot(Nf, rot(Nf)) < 0.95, '4 ...where G569\'s object space would keep the rest direction (the reason for the change)');
  // the GLSL writes the same arithmetic
  const fs0 = FB.BAKE_FS;
  check(/cross\(fbQ1, fbNg\)/.test(fs0) && /cross\(fbNg, fbQ0\)/.test(fs0) && /inverse\(fbTBN\) \* fbNf/.test(fs0) && /dFdx\(vFbUv\)/.test(fs0),
    '4 the bake\'s GLSL is three\'s getTangentFrame over the atlas uv, solved by inverse(tbn)');
}

// ---- 5 the mips ------------------------------------------------------------------------------------------------------
{
  const S = 8, n = S * S * 4;
  const run = (tex) => { const o = {}; const g = FB.mipSteps(tex, S, o); while (!g.next().done); return o.levels; };
  // a checker of black and white; a flat normal map; roughness 0.2 everywhere
  const A = new Uint8Array(n), N = new Uint8Array(n), O = new Uint8Array(n);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, w = (x + y) & 1 ? 255 : 0;
    A[i] = A[i + 1] = A[i + 2] = w; A[i + 3] = 255; N[i] = 128; N[i + 1] = 128; N[i + 2] = 255; N[i + 3] = 255;
    O[i] = 255; O[i + 1] = 51; O[i + 2] = 0; O[i + 3] = 51; }
  const L = run([A, N, O]);
  check(L[0].length === 4 && L[0][3].width === 1 && L[1].length === 4 && L[2].length === 4, '5 the chain runs to 1x1 for every map', L[0].map(l => l.width).join(','));
  check(near(L[0][1].data[0], 188, 1), '5 black + white average in LINEAR light (sRGB 188, not 128)', String(L[0][1].data[0]));
  check(L[2].every(l => near(l.data[1], 51, 1) && near(l.data[3], 51, 1)), '5 a flat normal map keeps its roughness (and the clear coat\'s) at every level', L[2].map(l => l.data[1]).join(','));
  // bumpy: alternate normals tilted +-30 deg in x
  const Nb = new Uint8Array(n);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, s = (x & 1) ? 1 : -1;
    Nb[i] = Math.round((s * 0.5 * 0.5 + 0.5) * 255); Nb[i + 1] = 128; Nb[i + 2] = Math.round((0.866 * 0.5 + 0.5) * 255); Nb[i + 3] = 255; }
  const Lb = run([A, Nb, O]);
  const r1 = Lb[2][1].data[1], r3 = Lb[2][3].data[1];
  check(r1 > 70 && r3 >= r1, '5 TOKSVIG: a bumpy normal map widens the roughness where it folds into a texel', 'L1 ' + r1 + ', L3 ' + r3 + ' (L0 51)');
  check(Lb[2][1].data[3] > 70, '5 ...and the clear coat\'s with it', String(Lb[2][1].data[3]));
  const nz = Lb[1][1].data[2] / 127.5 - 1, nx = Lb[1][1].data[0] / 127.5 - 1;
  check(nz > 0.99 && Math.abs(nx) < 0.02, '5 the averaged normal is renormalised (the variance went into the roughness)', nx.toFixed(3) + ',' + nz.toFixed(3));
  check(near(FB.toksvig(0.5, 1), 0.5, 1e-9) && FB.toksvig(0.5, 0.9) > 0.5 && FB.toksvig(0.5, 0.8) > FB.toksvig(0.5, 0.9) && FB.toksvig(0.9, 0.3) <= 1,
    '5 toksvig(): identity at |n| = 1, monotonic in the variance, capped at 1');
}

// ---- 6 the dilation --------------------------------------------------------------------------------------------------
{
  const S = 8, A = new Uint8Array(S * S * 4), B = new Uint8Array(S * S * 4), C = new Uint8Array(S * S * 4);
  const i0 = (3 * S + 3) * 4, i1 = (6 * S + 1) * 4;
  A[i0] = 200; A[i0 + 3] = 255; B[i0 + 1] = 77; C[i0 + 3] = 90;
  A[i1] = 10; A[i1 + 3] = 128; B[i1 + 1] = 9; C[i1 + 3] = 11;
  const cov = FB.dilate([A, B, C], S);
  let left = 0; for (let i = 0; i < S * S; i++) if (A[i * 4] !== 200 && A[i * 4] !== 10) left++;
  check(near(cov, 2 / 64, 1e-9) && left === 0, '6 every unwritten texel takes a written one', 'cov ' + cov + ', ' + left + ' left');
  check(A[(3 * S + 4) * 4] === 200 && B[(3 * S + 4) * 4 + 1] === 77 && C[(3 * S + 4) * 4 + 3] === 90, '6 ...all four channels of its NEAREST (the clear coat\'s roughness rides A)');
  check(A[i0 + 3] === 255 && A[i1 + 3] === 0 && A[(6 * S + 2) * 4 + 3] === 0, '6 the inside flag comes back to 255 / 0');
}

// ---- 7 the wiring ---------------------------------------------------------------------------------------------------
{
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const parked = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'parked.js'), 'utf8');
  const fb = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'flown_bake.js'), 'utf8');
  const build = fs.readFileSync(path.join(TOOLS, 'build.js'), 'utf8');
  // the aeroMaterial argument KEYS, in order, from each call site
  const keysOf = (src, start) => {
    const i = src.indexOf(start);
    if (i < 0) return null;
    let d = 0, j = src.indexOf('{', i);
    const k0 = j;
    for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) break; } }
    const body = src.slice(k0, j + 1).replace(/\/\/[^\n]*/g, '').replace(/\?[^:,]*:/g, ' ');
    return (body.match(/([A-Za-z]\w*)\s*:/g) || []).map(s => s.replace(/\s*:$/, '')).filter(k => k !== 'THREE').join(',');
  };
  const kApp = keysOf(app, 'A.aeroMaterial(THREE, {'), kPk = keysOf(parked, 'A.aeroMaterial(THREE, {'), kFb = keysOf(fb, 'return { finish:');
  check(kApp && kApp === kPk && kApp === 'finish,' + kFb.replace(/^finish,/, ''), '7 the flown factory\'s arguments: ONE list in app.js, parked.js and flown_bake.js',
    '\n    app    ' + kApp + '\n    parked ' + kPk + '\n    fb     ' + kFb);
  const sync = app.slice(app.indexOf('function* syncBuildSteps'), app.indexOf('function* syncBuildSteps') + 2500);
  check(/snapshotSteps\(flown\)[\s\S]*FLOWN_BAKE\.note\(window\.CAGE_VISUAL\)[\s\S]*GARAGE_SPEC\.update/.test(sync), '7 the snapshot notes the rest positions before the spec applies');
  const bm = app.slice(app.indexOf('function buildModel('), app.indexOf('function buildModel(') + 30000);
  check(/FLOWN_BAKE\.forPayload\(data\)/.test(bm) && /setAttribute\('uv1', new THREE\.BufferAttribute\(fbUv, 2, true\)\)/.test(bm) &&
        /const matFor = name => \(FBK && FBK\.has\(grpMat\(name\)\)\) \? FBK\.mat : matLive\(name\);/.test(bm), '7 buildModel reads the bake: the atlas uv and the one material');
  const scr = app.slice(app.indexOf('function rollOutScreen('), app.indexOf('function rollOutScreen(') + 3000);
  const iS = scr.indexOf("id: 'sync'"), iB = scr.indexOf("id: 'bake'"), iT = scr.indexOf("id: 'stand'");
  check(iS > 0 && iB > iS && iT > iB && /FLOWN_BAKE\.step\(/.test(scr), "7 the roll-out's 'bake' step sits between 'sync' and 'stand'");
  const hs = { vertexShader: 'void main() {\n  gl_Position = vec4(0.0);\n}\n', fragmentShader: 'void main() {\n  gl_FragColor = vec4(1.0);\n}\n', uniforms: {} };
  const src = function (sh) { sh.uniforms.x = 1; };
  const hk = FB.bakeHook(src);
  hk.call({ userData: {} }, hs);
  check(hk === FB.bakeHook(src) && String(hk) !== String(src) && String(hk).indexOf(String(src)) >= 0, '7 one bake twin per flown program, keyed apart from it');
  check(/gl_Position = vec4\(aFbUv \* 2\.0 - 1\.0/.test(hs.vertexShader) && hs.vertexShader.lastIndexOf('aFbUv') > hs.vertexShader.indexOf('gl_Position = vec4(0.0)') &&
        hs.fragmentShader.lastIndexOf('gl_FragColor = uFbOut') > hs.fragmentShader.indexOf('gl_FragColor = vec4(1.0)'), '7 the bake splices land after the flown program\'s own lines');
  const rs = { vertexShader: '#include <common>\n#include <project_vertex>\n', uniforms: {},
    fragmentShader: '#include <common>\n#include <map_fragment>\n#include <clearcoat_normal_fragment_begin>\n#include <lights_physical_fragment>\n#include <lights_fragment_end>\n' };
  FB.FB_HOOK.call({ userData: {} }, rs);
  check(/fbIn = sampledDiffuseColor\.a/.test(rs.fragmentShader) && /clearcoatNormal = normal/.test(rs.fragmentShader) &&
        /material\.clearcoatRoughness = min\(max\(texture2D\(clearcoatMap, vClearcoatMapUv\)\.a/.test(rs.fragmentShader) &&
        /step\(faceDirection, 0\.0\)/.test(rs.fragmentShader) && /vFbCraft = \(uCraftInv/.test(rs.vertexShader),
    '7 the baked material: the inside flag, the clear coat on the perturbed normal and its roughness from T2.A, the cabin on the back face');
  const iP = build.indexOf("['src/viewer', 'parked.js']"), iF = build.indexOf("['src/viewer', 'flown_bake.js']");
  check(iP > 0 && iF > iP, '7 the build manifest carries flown_bake.js after parked.js');
}

console.log('FLOWNBAKE: ' + checks + ' checks');
if (fail.length) { for (const f of fail) console.log('  FAIL ' + f); console.log('GATE FLOWNBAKE: FAIL'); process.exit(1); }
console.log('GATE FLOWNBAKE: PASS');
