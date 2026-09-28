#!/usr/bin/env node
// _flown_bake_check.js — GATE FLOWNBAKE: the flown aeroplane's texture bake (C4a, G870; C4b, G875-G878), headless.
//
// The bake itself needs a WebGL renderer (the roll-out screen draws the flown shader into the atlas); everything
// around it is pure and proven here, on parked.js's own synthetic-payload shape and the real vendor three.js:
//
//   1  what bakes, into which atlas: the AEROSKIN buckets - the exterior's ('ext') and the cabin's ('in', C4b) - never
//      glass, a turning blade, the facia, a see-through bucket; a bucket on a cockpit control bakes (C4b)
//   2  the unwrap: every baked vertex gets ONE atlas uv inside the atlas; a soup needs no split; a vertex two
//      charts claim IS split (every per-vertex array grows with it, the index follows, the positions agree)
//   3  the key: the same build keys the same, a changed spec or a changed group size keys anew
//   4  TANGENT SPACE: the frame the bake encodes in is three's getTangentFrame over the atlas uv, and it rides the
//      flex - a normal encoded on the rest triangle decodes, on the same triangle ROTATED (a flexed wing, a
//      hinged surface), to the rotated normal; and it does not depend on the screen that drew it
//   5  the mips: albedo averaged in LINEAR light (black + white -> sRGB 188, not 128), a flat normal map keeps
//      its roughness at every level, a bumpy one widens it (Toksvig) and the widening grows down the chain
//   6  the dilation: every unwritten texel takes its nearest written one's four channels, the inside flag
//      comes back to 0 / 128 / 255 (none / the back face / both faces)
//   7  the wiring: the flown factory's arguments are the same list in app.js, parked.js and flown_bake.js;
//      the snapshot notes the rest positions; buildModel reads the bake; the roll-out's 'bake' step sits after
//      'sync'; the bake hook's splices; the build manifest carries the file after parked.js
//   8  THE FOLD (C4b): the baked meshes fold into one draw per motion and crumb class - the still ones a plain Mesh,
//      a part's a SkinnedMesh with the part as its bone (the vertex lands where the part put it), the rigs' attribute
//      objects keep writing (their arrays are views into the fold; a write flags its range), a crumb folds apart (it
//      casts nothing after the roll-out) but a wheel's does not; the raycast names the part it hit and a hidden fold
//      answers nothing; the cabin's fold keeps its live members for the cockpit's swap
//   9  THE WORKER (C4b): its source is these very functions' text and runs alone (no closure): its unwrap and its
//      gutters + mips give the page's own answers, byte for byte
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
const FB_SRC = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'flown_bake.js'), 'utf8');
const FB_HOOK_SRC = () => FB_SRC.slice(FB_SRC.indexOf('const FB_HOOK = function'), FB_SRC.indexOf('FB_HOOK.toString'));
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
const names = FB.bakedNames(vis, 'ext');
{
  const want = ['sbody', 'cowl', 'wing', 'tyre', 'knob'].sort().join(',');
  check([...names].sort().join(',') === want, '1 the exterior AEROSKIN buckets bake into the exterior atlas', [...names].sort().join(','));
  const inn = FB.bakedNames(vis, 'in');
  check([...inn].join(',') === 'liner' && FB.bakedSets(vis).get('liner') === 'in', '1 the cabin\'s (inside) buckets bake into the cabin\'s atlas (C4b)', [...inn].join(','));
  const all = FB.bakedNames(vis);
  check(!all.has('glass') && !all.has('blade') && !all.has('facia') && !all.has('tint') && !all.has('lamp'), '1 glass, a blade, the facia, a see-through bucket, a lamp stay live');
  check(names.has('knob'), '1 a bucket that also rides a cockpit control bakes (C4b: the fold makes its part a bone)');
}
const list = FB.groupsOf(vis, names);
check(list.length === 7 && list.filter(e => e.at).length === 2 && list.some(e => e.k === 'cowl' && !e.at && e.g === vis.parts[2].groups.cowl),
  '1 the baked groups in the payload\'s order: statics, then parts (a stretch part unrebased, a wheel and a control at their pivots)', list.map(e => e.k + (e.at ? '@' : '')).join(','));

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
  A[i1] = 10; A[i1 + 3] = 64; B[i1 + 1] = 9; C[i1 + 3] = 11;
  const i2 = (0 * S + 7) * 4; A[i2] = 10; A[i2 + 3] = 128;
  const cov = FB.dilate([A, B, C], S);
  let left = 0; for (let i = 0; i < S * S; i++) if (A[i * 4] !== 200 && A[i * 4] !== 10) left++;
  check(near(cov, 3 / 64, 1e-9) && left === 0, '6 every unwritten texel takes a written one', 'cov ' + cov + ', ' + left + ' left');
  check(A[(3 * S + 4) * 4] === 200 && B[(3 * S + 4) * 4 + 1] === 77 && C[(3 * S + 4) * 4 + 3] === 90, '6 ...all four channels of its NEAREST (the clear coat\'s roughness rides A)');
  check(A[i0 + 3] === 255 && A[i2 + 3] === 128 && A[i1 + 3] === 0 && A[(6 * S + 2) * 4 + 3] === 0, '6 the inside flag comes back to 255 / 128 / 0 (both faces / the back / none)');
  check(/0\.25 \+ 0\.25 \* clamp\(uInside\.y, 0\.0, 1\.0\) \+ 0\.75 \* clamp\(uInside\.x, 0\.0, 1\.0\)/.test(FB.BAKE_FS) &&
        /max\(clamp\(2\.0 \* fbIn - 1\.0, 0\.0, 1\.0\), min\(1\.0, 2\.0 \* fbIn\) \* step\(faceDirection, 0\.0\)\)/.test(String(FB.FB_HOOK) + FB_HOOK_SRC()),
    '6 the bake writes 64 / 128 / 255 (none, uInside.y, uInside.x) and the runtime reads both faces at 1, the back face at 0.5');
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
        /const matFor = name => \(FBK && FBK\.has\(grpMat\(name\)\) && !FBK\.inner\(grpMat\(name\)\)\) \? FBK\.matOf\(grpMat\(name\)\) : matLive\(name\);/.test(bm) &&
        /if \(fbUv && !FBK\.ab && !FBK\.innerGroup\(g\)\)/.test(bm), '7 buildModel reads the bake: the atlas uv, the baked material per atlas, the cabin\'s live geometry kept');
  check(/window\.FLOWN_BAKE\.mergeModel\(THREE, grp, FBK\.mat, \{ written, wheel \}\)/.test(app) && /members: inMeshes, keep: true/.test(app) &&
        app.indexOf('FLOWN_BAKE.mergeModel(') > 0 && app.indexOf('FLOWN_BAKE.mergeModel(') < app.indexOf('const still = data.cage ? mergeStill(grp, meshes'), '7 the folds are made before G576\'s still merge (the exterior\'s; the cabin\'s keeping its members)');
  check(/if \(m\.userData\.flownMerge\) \{ if \(m\.userData\.crumbR != null\) m\.castShadow = false; return; \}/.test(app), '7 the roll-out\'s crumb rule reads a fold\'s class, not its sphere');
  check(/model\.fold\.view\(cam\.mode === 'cockpit'\)/.test(app), '7 the frame swaps the cabin live in the cockpit view');
  const ck = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'cockpit.js'), 'utf8');
  check(/let a = h\.part \|\| h\.object;/.test(ck) && /pad\.visible = false;/.test(ck), '7 the cockpit\'s pick reads the part through a fold; its pads answer unshown');
  // G1027 (B8B9 on train 14): the roll-out is a keyed step table (app.js TRIP_STEPS) - the aircraft's rows snapshot -> bake ->
  // spec (the model built once, on the bake), the landed interface; the stand (rollOutStand) after the aircraft's phase
  const iTb = app.indexOf('const TRIP_STEPS = ['), tbl = iTb > 0 ? app.slice(iTb, iTb + 8000) : '';
  const iS = tbl.indexOf("id: 'snapshot'"), iB = tbl.indexOf("id: 'bake'"), iA = tbl.indexOf("id: 'spec'");
  const bakeRow = iB > 0 && iA > iB ? tbl.slice(iB, iA) : '';
  const ro = app.slice(app.indexOf('function rollOut(after'), app.indexOf('function rollOut(after') + 3000);
  check(iS > 0 && iB > iS && iA > iB && /FLOWN_BAKE\.step\(\{ payload: window\.CAGE_VISUAL, spec:/.test(bakeRow) && /phase:/.test(bakeRow) && /rebuild:/.test(bakeRow)
        && /tripPhase\(trip, 'craft', anim\)/.test(ro) && /const toWorld = \(\) => \{ rollOutStand\(\);/.test(ro),
        "7 the roll-out's 'bake' row sits between 'snapshot' and 'spec' (TRIP_STEPS: step({ payload, spec, phase, rebuild })), the stand after them");
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

// ---- 8 THE FOLD (C4b) -------------------------------------------------------------------------------------------------
{
  const T = THREE, mat = new T.MeshStandardMaterial(), other = new T.MeshStandardMaterial();
  // a baked mesh as buildModel makes it: position, normal, the atlas uv (Uint16 normalised), the index
  const bakedMesh = (b, m, extra) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(b.nrm, 3));
    g.setAttribute('uv1', new T.BufferAttribute(new Uint16Array(b.nv * 2).fill(1000), 2, true));
    if (extra) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(b.nv * 2), 2));
    g.setIndex(new T.BufferAttribute(b.idx, 1));
    const o = new T.Mesh(g, m || mat); o.castShadow = true; o.receiveShadow = true;
    return o;
  };
  const grp = new T.Group(); grp.matrixAutoUpdate = false;
  const s1 = bakedMesh(box(-1, -0.5, -0.5, 1, 0.5, 0.5, 2)), s2 = bakedMesh(box(2, 0, 0, 3, 1, 1, 2));
  const c1 = bakedMesh(box(0, 0, 0, 0.05, 0.05, 0.05, 1));                      // a crumb: a bolt
  const pg = new T.Group(); pg.position.set(1, 0.2, 0); pg.rotation.z = 0.5;     // a part: its own transform
  const p1 = bakedMesh(box(0, -0.3, -0.2, 0.6, 0.3, 0.2, 2));
  const wg = new T.Group(); wg.position.set(-1, -1, 0.8);                         // a wheel
  const w1 = bakedMesh(box(-0.05, -0.05, -0.02, 0.05, 0.05, 0.02, 1));             // its hub: 7 cm, casts (G1005)
  const o1 = bakedMesh(box(0, 2, 0, 1, 3, 1, 1), other);                           // another material: not folded
  const u1 = bakedMesh(box(0, 4, 0, 1, 5, 1, 1)); u1.userData.mine = 1;             // its own userData: not folded
  pg.add(p1); wg.add(w1); grp.add(s1, s2, c1, pg, wg, o1, u1);
  const p1v0 = Array.from(p1.geometry.attributes.position.array.slice(0, 3));
  const sPA = s1.geometry.attributes.position, pPA = p1.geometry.attributes.position;
  const out = FB.mergeModel(T, grp, mat, { written: new Set([s2.geometry.attributes.position]), wheel: new Set([w1]) });
  const folds = out ? out.meshes : [];
  const byName = k => folds.filter(f => f.userData.flownMerge && ((k === 'bone') === !!f.isSkinnedMesh) && ((k === 'crumb') === (f.userData.crumbR != null)));
  const still = byName('rest')[0], crumb = byName('crumb')[0], bone = folds.find(f => f.isSkinnedMesh);
  check(!!out && out.to === 3 && out.from === 5 && out.skip.own === 1, '8 five baked meshes fold into three draws: the still, the crumbs, the parts', out && JSON.stringify({ from: out.from, to: out.to, skip: out.skip }));
  check(!!still && !still.isSkinnedMesh && !!crumb && !!bone && bone.skeleton.bones.length === 2, '8 the still fold is a plain Mesh, the parts\' a SkinnedMesh with a bone each');
  check(s1.parent === null && p1.parent === null && o1.parent === grp && u1.parent === grp && folds.every(f => f.parent === grp), '8 the members leave the graph, the rest stays, the folds join the model group');
  check(!!crumb && near(crumb.userData.crumbR, c1.geometry.boundingSphere.radius, 1e-6) && bone.userData.crumbR == null && still.userData.crumbR == null,
    '8 a crumb folds apart and says how big it was (it casts nothing after the roll-out); a wheel\'s 7 cm hub casts with its part');
  // the rigs' arrays are views: the written bucket first, its write flags its range
  check(sPA.array.buffer === still.geometry.attributes.position.array.buffer && pPA.array.buffer === bone.geometry.attributes.position.array.buffer,
    '8 a member\'s position array is a VIEW into its fold (the rigs keep their attribute objects)');
  const s2PA = s2.geometry.attributes.position;
  check(s2PA.array.byteOffset === 0, '8 the bucket a rig writes goes first (one upload range)', String(s2PA.array.byteOffset));
  grp.updateMatrixWorld(true);
  const v0 = still.geometry.attributes.position.version;
  still.geometry.attributes.position.clearUpdateRanges();
  s2PA.array[0] += 0.25; s2PA.needsUpdate = true;
  grp.updateMatrixWorld(true);
  const rg = still.geometry.attributes.position.updateRanges;
  check(still.geometry.attributes.position.version > v0 && rg.length === 1 && rg[0].start === 0 && rg[0].count === s2PA.array.length &&
        still.geometry.attributes.position.array[0] === s2PA.array[0], '8 a rig\'s write lands in the fold and flags exactly its range', JSON.stringify(rg));
  const v1 = still.geometry.attributes.position.version;
  grp.updateMatrixWorld(true);
  check(still.geometry.attributes.position.version === v1, '8 ...and a frame with no write uploads nothing');
  // a fold not drawn (the model in the shed, the cabin's in the cockpit) piles no ranges up: it owes one whole upload
  const sPos = still.geometry.attributes.position;
  sPos.clearUpdateRanges(); grp.visible = false;
  for (let f = 0; f < 5; f++) { s2PA.array[0] += 0.01; s2PA.needsUpdate = true; grp.updateMatrixWorld(true); }
  const hidRanges = sPos.updateRanges.length, vHid = sPos.version;
  grp.visible = true; grp.updateMatrixWorld(true);
  check(hidRanges === 0 && sPos.version > vHid && sPos.updateRanges.length === 0 && sPos.array[0] === s2PA.array[0],
    '8 a fold not drawn piles up no upload ranges, and owes one whole upload when it shows again', 'ranges while hidden ' + hidRanges + ', after ' + sPos.updateRanges.length);
  // the bone: the part's transform in the model group's frame; a vertex lands where the part put it
  const at = (o, v) => { const q = new T.Vector3().fromArray(v); o.updateMatrix(); return q.applyMatrix4(o.matrix); };
  const skinned = i => bone.getVertexPosition(i, new T.Vector3());
  const PB = bone.geometry.attributes.position.array, iP = (PB[0] === p1v0[0] && PB[1] === p1v0[1] && PB[2] === p1v0[2] && bone.geometry.attributes.skinIndex.array[0] === 0) ? 0 : -1;   // the part's first vertex, bone 0
  const e0 = skinned(iP).distanceTo(at(pg, p1v0));
  { const sph = bone.geometry.boundingSphere, n = bone.geometry.attributes.position.count; let out = 0;
    for (let i = 0; i < n; i++) if (skinned(i).distanceTo(sph.center) > sph.radius + 1e-4) out++;
    check(out === 0, '8 the parts\' fold is bounded where its parts stand (the craft\'s cascade fits the spheres)', out + ' of ' + n + ' vertices outside'); }
  pg.rotation.z = -0.4; pg.position.y = 0.6;                                       // the part moves (a deflection, a spring)
  grp.updateMatrixWorld(true);
  const e1 = skinned(iP).distanceTo(at(pg, p1v0));
  check(iP >= 0 && e0 < 1e-6 && e1 < 1e-6, '8 a part\'s vertex lands where the part puts it, at rest and moved (the bone is the part)', 'err ' + e0 + ', ' + e1);
  check(bone.bindMode === (T.DetachedBindMode || 'detached') && bone.bindMatrix.equals(new T.Matrix4()), '8 the bind is the identity, detached (the bones are relative to the model group)');
  // the raycast: member by member, the part named
  grp.matrix.makeTranslation(100, 0, 0); grp.matrixWorldNeedsUpdate = true; grp.updateMatrixWorld(true);
  const tgt = at(pg, [0.3, 0, 0]).add(new T.Vector3(100, 0, 0));
  const rc = new T.Raycaster(new T.Vector3(tgt.x, tgt.y, 10), new T.Vector3(0, 0, -1));
  const hits = rc.intersectObject(grp, true);
  check(hits.length > 0 && hits[0].object === bone && hits[0].part === pg, '8 the fold\'s raycast finds the part\'s triangle and names the part', hits.slice(0, 2).map(h => (h.object.name || h.object.type) + (h.part === pg ? '/pg' : '')).join(','));
  bone.visible = false;
  check(rc.intersectObject(bone, false).length === 0, '8 a hidden fold answers no ray');
  bone.visible = true;
  // THE CABIN: live members kept (hidden), the fold draws them; the cockpit's swap
  const g2 = new T.Group(); g2.matrixAutoUpdate = false;
  const live = new T.MeshStandardMaterial(), inMat = new T.MeshStandardMaterial();
  const k1 = bakedMesh(box(0, 0, 0, 1, 1, 1, 1), live, true), k2 = bakedMesh(box(1, 0, 0, 2, 1, 1, 1), live, true);
  g2.add(k1, k2);
  const o2 = FB.mergeModel(T, g2, inMat, { members: [k1, k2], keep: true });
  check(!!o2 && o2.to === 1 && k1.parent === g2 && !k1.visible && !k2.visible && o2.meshes[0].visible && o2.meshes[0].material === inMat &&
        k1.geometry.attributes.position.array.buffer === o2.meshes[0].geometry.attributes.position.array.buffer,
    '8 the cabin\'s fold keeps its live members in place, hidden, on the same arrays');
  o2.view(true);
  const on = k1.visible && k2.visible && !o2.meshes[0].visible;
  o2.view(false);
  check(on && !k1.visible && o2.meshes[0].visible, '8 the cockpit\'s swap: the live cabin at arm\'s length, the fold everywhere else');
  W.FLYDIY_FLOWN_MERGE = 0;
  const g3 = new T.Group(); g3.add(bakedMesh(box(0, 0, 0, 1, 1, 1, 1)), bakedMesh(box(1, 0, 0, 2, 1, 1, 1)));
  check(FB.mergeModel(T, g3, mat, {}) === null && g3.children.length === 2, '8 FLYDIY_FLOWN_MERGE = 0 folds nothing (the dial)');
  W.FLYDIY_FLOWN_MERGE = undefined;
}

// ---- 9 THE WORKER (C4b) -------------------------------------------------------------------------------------------------
{
  const src = FB.workerSource();
  const got = [];
  const ctx = { self: { postMessage: (d) => got.push(d) }, Date, Math, performance, Map, Set, Array, Object, JSON, Number, Infinity,
                Float32Array, Float64Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, String, Error };
  vm.createContext(ctx);
  let ran = true; try { vm.runInContext(src, ctx, { filename: 'flown_bake_worker.js' }); } catch (e) { ran = false; check(false, '9 the worker\'s text runs alone', e.message); }
  if (ran) {
    check(typeof ctx.self.onmessage === 'function', '9 the worker\'s text runs alone (no closure crosses into it)');
    // the unwrap: the worker's against the page's, on the synthetic exterior
    const e1 = FB.extOf(list), e2 = FB.extOf(list);
    const mine = PK.unwrap(e1, { S: 256, gutter: 2 });
    ctx.self.onmessage({ data: { id: 1, op: 'unwrap', ext: e2, S: 256, gutter: 2 } });
    const wu = got[0] && got[0].uw;
    check(!!wu && wu.charts === mine.charts && wu.uv.length === mine.uv.length && wu.uv.every((v, i) => v === mine.uv[i]) && wu.idx.every((v, i) => v === mine.idx[i]),
      '9 the worker\'s unwrap is the page\'s, to the bit', wu ? wu.charts + ' / ' + mine.charts + ' charts' : 'no answer');
    // the gutters and the mips: the worker's against the page's (dilate, then the sliced chain)
    const S = 16, n = S * S * 4, mk = () => { const a = [new Uint8Array(n), new Uint8Array(n), new Uint8Array(n)];
      for (let i = 0; i < S * S; i++) if ((i * 7) % 5 === 0) { a[0][i * 4] = i % 251; a[0][i * 4 + 3] = (i % 3) ? 128 : 255; a[1][i * 4] = 128 + (i % 60); a[1][i * 4 + 1] = 128; a[1][i * 4 + 2] = 240; a[2][i * 4 + 1] = i % 200; }
      return a; };
    const pA = mk(), wA = mk();
    FB.dilate(pA, S); const mo = {}; const gen = FB.mipSteps(pA, S, mo); while (!gen.next().done);
    ctx.self.onmessage({ data: { id: 2, op: 'finish', tex: wA, S, dilate: true } });
    const wf = got[1];
    let same = !!(wf && wf.levels && wf.levels.length === 3);
    if (same) for (let k = 0; k < 3; k++) for (let l = 0; l < mo.levels[k].length; l++) { const a = mo.levels[k][l].data, b = wf.levels[k][l].data; if (a.length !== b.length || a.some((v, i) => v !== b[i])) same = false; }
    check(same && wf.cov > 0, '9 the worker\'s gutters and mips are the page\'s, byte for byte (every level of the three maps)');
  }
  const fbs = FB_SRC;
  check(/readRenderTargetPixelsAsync\(rt, 0, 0, S, S, buf\)/.test(fbs) && /Promise\.all\(reads\)/.test(fbs), '9 the passes read back asynchronously (a pixel-pack buffer and a fence), awaited together');
  check(/unwrapOff\(list, S, set === 'in' \? FB\.gutterIn : FB\.gutter, t\)/.test(fbs) && /finishOff\(at\.tex, S, true, t\)/.test(fbs) && /finishOff\(tex, S, false, t\)/.test(fbs), '9 the bake and the cache hit both go through the worker (the page the fallback)');
}

console.log('FLOWNBAKE: ' + checks + ' checks');
if (fail.length) { for (const f of fail) console.log('  FAIL ' + f); console.log('GATE FLOWNBAKE: FAIL'); process.exit(1); }
console.log('GATE FLOWNBAKE: PASS');
