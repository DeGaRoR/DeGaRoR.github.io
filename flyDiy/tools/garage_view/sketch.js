#!/usr/bin/env node
// GARAGE-VIEW, step 1d: THE SCHEMATIC VIEWS - what the measured world looks like from each hangar's door, drawn plain
// (flat colours, cones and balls for trees, boxes for buildings) but with TRUE places, sizes and distances; for the
// user's validation while the GPU is busy (the user, 22 Nov: "simple renders of the constructed scene and reference
// scenes, schematic but accurate"). A software z-buffer in node: no GPU, no browser, no dependency.
//
//   node tools/garage_view/sketch.js [--in dir] [--out dir] [--w 1280] [--scene ref|today|both]
//     ref     the measured world (measure.json + census.json) in each shed's room frame, by its true yaw
//     today   what TODAY's garage builds outside (hangar.js's outdoors as the code places them: the quarter-turn field,
//             the strip, the slab, the box cars, the ring of tree cards) - schematic too, for the same eyes
//     -> <out>/sketch_<scene>_<shed>_<view>.png and sketch.json (every view's eye, and the labels' places in the picture)
// Views per shed: at the door (eye 1.7 m) straight out, 45 deg left, 45 deg right; from the back of the room through
// the door (the door's frame drawn); FOV 46 (the garage's default).
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const T = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const IN = opt('in', path.join(T, 'perf', 'garage_view')), OUT = opt('out', IN);
const WID = +opt('w', 1280), HEI = Math.round(WID * 9 / 16), WHICH = opt('scene', 'both');
// --scene built --built <dir>: THE COOKED SCENE ITSELF (cook.js's scene.json + scene.bin), its own triangles and cards, through
// the same eyes - the check that what was built stands where the measured world stands
const BUILT = opt('built', null);
const M = JSON.parse(fs.readFileSync(path.join(IN, 'measure.json'), 'utf8'));
const CEN = fs.existsSync(path.join(IN, 'census.json')) ? JSON.parse(fs.readFileSync(path.join(IN, 'census.json'), 'utf8')) : null;
const TREES = [];
if (CEN) { const R = CEN.rec; for (let i = 0; i < CEN.trees.length; i += R) TREES.push({ key: CEN.keys[CEN.trees[i]], x: CEN.trees[i + 2], y: CEN.trees[i + 3], z: CEN.trees[i + 4], H: CEN.trees[i + 8] * CEN.trees[i + 7], s: CEN.trees[i + 6] }); }
const kindOf = key => /dead|snag|stump|stick|trunk/i.test(key) ? 'dead' : /cedar|fir|larch|spruce|pine/i.test(key) ? 'conifer' : /birch|maple|oak|ash/i.test(key) ? 'broadleaf' : /shrub|holly|raspberry|sapling|bush/i.test(key) ? 'shrub' : 'other';
const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };

// ---- PNG ---------------------------------------------------------------------------------------------------------
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- the rasteriser: view space x right, y up, z forward (depth) ---------------------------------------------------
function makeCam(eye, fwd, fovDeg) {
  const n = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = n(fwd), r = n(cr(f, [0, 1, 0])), u = cr(r, f), F = (HEI / 2) / Math.tan(fovDeg * Math.PI / 360);
  return { eye, f, r, u, F, toView: p => { const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]]; return [d[0] * r[0] + d[1] * r[1] + d[2] * r[2], d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * f[0] + d[1] * f[1] + d[2] * f[2]]; },
    px: v => [WID / 2 + v[0] / v[2] * F, HEI / 2 - v[1] / v[2] * F] };
}
function makeTarget() {
  const col = Buffer.alloc(WID * HEI * 3), zb = new Float32Array(WID * HEI).fill(Infinity);
  const NEARZ = 0.25, HAZE = [196, 211, 222];
  const tri2 = (a, b, c, rgb, cam, flat) => {   // three view-space points in front of the near plane
    const A = cam.px(a), B = cam.px(b), C = cam.px(c);
    let x0 = Math.floor(Math.min(A[0], B[0], C[0])), x1 = Math.ceil(Math.max(A[0], B[0], C[0])), y0 = Math.floor(Math.min(A[1], B[1], C[1])), y1 = Math.ceil(Math.max(A[1], B[1], C[1]));
    if (x1 < 0 || y1 < 0 || x0 >= WID || y0 >= HEI) return;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(WID - 1, x1); y1 = Math.min(HEI - 1, y1);
    const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) return;
    const ia = 1 / a[2], ib = 1 / b[2], ic = 1 / c[2];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den, w1 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den, w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = 1 / (w0 * ia + w1 * ib + w2 * ic), i = y * WID + x;
      if (z >= zb[i]) continue; zb[i] = z;
      const hz = flat ? 0 : 1 - Math.exp(-z / 7000);
      col[i * 3] = rgb[0] + (HAZE[0] - rgb[0]) * hz; col[i * 3 + 1] = rgb[1] + (HAZE[1] - rgb[1]) * hz; col[i * 3 + 2] = rgb[2] + (HAZE[2] - rgb[2]) * hz;
    }
  };
  // a world triangle: to view space, clipped on the near plane
  const tri = (cam, p0, p1, p2, rgb, flat) => {
    const V = [cam.toView(p0), cam.toView(p1), cam.toView(p2)];
    if (V[0][2] < NEARZ && V[1][2] < NEARZ && V[2][2] < NEARZ) return;
    if (V[0][2] >= NEARZ && V[1][2] >= NEARZ && V[2][2] >= NEARZ) return tri2(V[0], V[1], V[2], rgb, cam, flat);
    const out = [];
    for (let i = 0; i < 3; i++) { const a = V[i], b = V[(i + 1) % 3], ina = a[2] >= NEARZ, inb = b[2] >= NEARZ;
      if (ina) out.push(a);
      if (ina !== inb) { const t = (NEARZ - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEARZ]); } }
    for (let i = 1; i + 1 < out.length; i++) tri2(out[0], out[i], out[i + 1], rgb, cam, flat);
  };
  return { col, zb, tri };
}
const shade = (rgb, k) => [Math.max(0, Math.min(255, rgb[0] * k)), Math.max(0, Math.min(255, rgb[1] * k)), Math.max(0, Math.min(255, rgb[2] * k))];
const SUN = (() => { const v = [0.45, 0.78, -0.43], l = Math.hypot(...v); return v.map(c => c / l); })();   // a mid-morning sun from the south-east (world)
const lit = (p0, p1, p2, rot) => { const a = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], b = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const l = Math.hypot(...n) || 1; n = n.map(c => c / l); if (n[1] < 0) n = n.map(c => -c);
  return 0.62 + 0.42 * Math.max(0, n[0] * rot[0] + n[1] * rot[1] + n[2] * rot[2]); };
// a box on the ground, turned by yaw (three's rotation.y): 12 triangles, a ridge optional (a gable along its long side)
function box(RT, cam, c, w, d, h, yaw, rgb, sun, ridge) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw), P = (lx, y, lz) => [c[0] + lx * cs + lz * sn, c[1] + y, c[2] - lx * sn + lz * cs];
  const q = (a, b, c2, d2, col) => { const k = lit(a, b, c2, sun); RT.tri(cam, a, b, c2, shade(col, k)); RT.tri(cam, a, c2, d2, shade(col, k)); };
  const x = w / 2, z = d / 2;
  q(P(-x, 0, -z), P(x, 0, -z), P(x, h, -z), P(-x, h, -z), rgb); q(P(-x, 0, z), P(x, 0, z), P(x, h, z), P(-x, h, z), rgb);
  q(P(-x, 0, -z), P(-x, 0, z), P(-x, h, z), P(-x, h, -z), rgb); q(P(x, 0, -z), P(x, 0, z), P(x, h, z), P(x, h, -z), rgb);
  if (ridge) { const top = shade(rgb, 0.8);
    q(P(-x, h, -z), P(x, h, -z), P(x, h + ridge, 0), P(-x, h + ridge, 0), top); q(P(-x, h, z), P(x, h, z), P(x, h + ridge, 0), P(-x, h + ridge, 0), top);
    RT.tri(cam, P(-x, h, -z), P(-x, h, z), P(-x, h + ridge, 0), rgb); RT.tri(cam, P(x, h, -z), P(x, h, z), P(x, h + ridge, 0), rgb);
  } else q(P(-x, h, -z), P(x, h, -z), P(x, h, z), P(-x, h, z), shade(rgb, 0.9));
}
// a tree, facing the eye: its true height, a crown as wide as its kind is
function tree(RT, cam, b, H, kind, seed) {
  const r = cam.r, v = 0.86 + 0.28 * hash(seed, 3.3), P = (dx, dy) => [b[0] + r[0] * dx, b[1] + dy, b[2] + r[2] * dx];
  if (kind === 'conifer' || kind === 'other') {
    const Rc = H * 0.17, g = shade([44, 86, 56], v), gd = shade([33, 66, 44], v);
    RT.tri(cam, P(-0.03 * H, 0), P(0.03 * H, 0), P(0, H * 0.3), [84, 66, 50]);
    RT.tri(cam, P(-Rc, H * 0.1), P(0, H * 0.1), P(0, H), g); RT.tri(cam, P(0, H * 0.1), P(Rc, H * 0.1), P(0, H), gd);
  } else if (kind === 'dead') {
    RT.tri(cam, P(-0.025 * H, 0), P(0.025 * H, 0), P(0, H), [128, 116, 100]); RT.tri(cam, P(0, H * 0.55), P(H * 0.16, H * 0.72), P(0, H * 0.6), [128, 116, 100]);
  } else {
    const shr = kind === 'shrub', Rc = H * (shr ? 0.45 : 0.3), cy = H * (shr ? 0.5 : 0.64), ry = H * (shr ? 0.5 : 0.37), g = shade(shr ? [112, 146, 84] : [88, 132, 62], v), gd = shade(shr ? [92, 124, 70] : [70, 108, 50], v);
    if (!shr) { RT.tri(cam, P(-0.03 * H, 0), P(0.03 * H, 0), P(0.03 * H, cy), [92, 74, 56]); RT.tri(cam, P(-0.03 * H, 0), P(0.03 * H, cy), P(-0.03 * H, cy), [92, 74, 56]); }
    const N = 10; for (let i = 0; i < N; i++) { const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832;
      RT.tri(cam, P(0, cy), P(Math.cos(a0) * Rc, cy + Math.sin(a0) * ry), P(Math.cos(a1) * Rc, cy + Math.sin(a1) * ry), Math.cos((a0 + a1) / 2) < 0 ? g : gd); }
  }
}
const SURF = s => s === 5 ? [150, 148, 141] : s === 6 ? [172, 158, 128] : s === 4 ? [112, 150, 178] : s === 11 || s === 20 || s === 21 || s === 22 ? [140, 118, 88] : s === 9 ? [236, 240, 244] : [124, 140, 92];

// ---- the two scenes, each in a shed's ROOM frame (the door at local -x; y = 0 the room's floor) -------------------------
function frame(S) {
  const c = Math.cos(S.ry), s = Math.sin(S.ry), y0 = S.ySite !== null && S.ySite !== undefined ? S.ySite : S.y;
  return { R: (x, y, z) => { const dx = x - S.x, dz = z - S.z; return [dx * c - dz * s, y - y0, dx * s + dz * c]; }, y0,
    sun: [SUN[0] * c - SUN[2] * s, SUN[1], SUN[0] * s + SUN[2] * c] };
}
function sky(RT) { for (let y = 0; y < HEI; y++) { const t = y / HEI, c = [118 + 84 * t, 160 + 56 * t, 208 + 18 * t]; for (let x = 0; x < WID; x++) { const i = (y * WID + x) * 3; RT.col[i] = c[0]; RT.col[i + 1] = c[1]; RT.col[i + 2] = c[2]; } } }
// the far skyline behind everything: per picture column, the ground's elevation from the door at that bearing
function skyline(RT, cam, S, Fm) {
  const Hz = M.horizon.find(h => h.shed === S.id); if (!Hz) return;
  for (let x = 0; x < WID; x++) {
    // the column's direction at the horizon, back in the world: room -> world bearing
    const vx = (x + 0.5 - WID / 2) / cam.F, d = [cam.f[0] + cam.r[0] * vx, 0, cam.f[2] + cam.r[2] * vx], cs = Math.cos(S.ry), sn = Math.sin(S.ry);
    const wx = d[0] * cs + d[2] * sn, wz = -d[0] * sn + d[2] * cs, br = ((Math.atan2(wx, -wz) * 180 / Math.PI) + 360) % 360, b0 = Math.floor(br) % 360, row = Hz.rows[b0], rowN = Hz.rows[(b0 + 1) % 360], tb = br - Math.floor(br);
    if (!row) continue;
    const lay = r => r.ridges.concat([{ el: r.el, d: r.d }]).sort((a, b) => b.d - a.d);
    const layers = lay(row), layN = rowN ? lay(rowN) : layers;
    for (let li = 0; li < layers.length; li++) { const L = layers[li], Ln = layN[Math.max(0, layN.length - (layers.length - li))] || L;   // matched from the nearest ridge back
      const el = (L.el + (Ln.el - L.el) * tb) * Math.PI / 180, hd = Math.hypot(d[0], d[2]), dir = [d[0] / hd * Math.cos(el), Math.sin(el), d[2] / hd * Math.cos(el)];
      const yv = dir[0] * cam.u[0] + dir[1] * cam.u[1] + dir[2] * cam.u[2], zv = dir[0] * cam.f[0] + dir[1] * cam.f[1] + dir[2] * cam.f[2]; if (zv <= 0) continue;
      const ys = Math.max(0, Math.round(HEI / 2 - yv / zv * cam.F)), hz = 1 - Math.exp(-L.d / 9000), base = row.sea && L.el < 0.1 ? [104, 142, 170] : [84, 112, 88], c = base.map((b, i) => b + ([196, 211, 222][i] - b) * hz);
      for (let y = ys; y < HEI; y++) { const i = y * WID + x; if (RT.zb[i] < 1e8) continue; RT.col[i * 3] = c[0]; RT.col[i * 3 + 1] = c[1]; RT.col[i * 3 + 2] = c[2]; }
    }
  }
}
function drawRef(RT, cam, S, Fm, labels) {
  const lab = (name, p) => { const v = cam.toView(p); if (v[2] < 1) return; const q = cam.px(v); if (q[0] < 0 || q[0] >= WID || q[1] < 0 || q[1] >= HEI) return; labels.push({ name, x: Math.round(q[0]), y: Math.round(q[1]), d: +v[2].toFixed(0) }); };
  const grid = (g, skip) => { const n = g.n;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const x = g.x0 + i * g.step, z = g.z0 + j * g.step; if (skip && skip(x + g.step / 2, z + g.step / 2)) continue;
      const p = (a, b) => Fm.R(g.x0 + a * g.step, g.h[b * n + a], g.z0 + b * g.step), p00 = p(i, j), p10 = p(i + 1, j), p11 = p(i + 1, j + 1), p01 = p(i, j + 1);
      let c = SURF(g.surf[j * n + i]);
      if (g.canopy && g.canopy[j * n + i] >= 2.5 && g.surf[j * n + i] !== 5) c = [86, 108, 70];
      c = shade(c, 0.95 + 0.1 * hash(i, j));
      RT.tri(cam, p00, p10, p11, shade(c, lit(p00, p10, p11, Fm.sun))); RT.tri(cam, p00, p11, p01, shade(c, lit(p00, p11, p01, Fm.sun)));
    } };
  const N = M.terrain.near, nx1 = N.x0 + (N.n - 1) * N.step, nz1 = N.z0 + (N.n - 1) * N.step;
  grid(M.terrain.mid, (x, z) => x > N.x0 + 10 && x < nx1 - 10 && z > N.z0 + 10 && z < nz1 - 10);
  grid(N);
  for (const t of TREES) tree(RT, cam, Fm.R(t.x, t.y, t.z), t.H, kindOf(t.key), t.x * 0.37 + t.z);
  for (const o of M.objects) if (o.kind === 'tree' && !/rock/.test(o.key)) tree(RT, cam, Fm.R(o.x, o.y, o.z), /sapling/.test(o.key) ? 3 * (o.size || 1) : /stump|stick/.test(o.key) ? 0.8 : 9, kindOf(o.key), o.x);
  const yawR = y => y - S.ry;   // a world rotation.y in the room's frame (schematic boxes only)
  for (const O of M.sheds) if (O.id !== S.id) { box(RT, cam, Fm.R(O.x, O.ySite !== null ? O.ySite : O.y, O.z), 2 * O.HD, 2 * O.HW, O.EAVE, yawR(O.ry), [186, 96, 74], Fm.sun, O.EAVE * 0.25); lab(O.name, Fm.R(O.x, O.y + O.EAVE, O.z)); }
  for (const b of M.buildings) { const w = (b.box && b.box.w) || 8, d = (b.box && b.box.d) || 6, h = (b.box && b.box.h) || (/tower/.test(b.key) ? 9 : 3.2);
    box(RT, cam, Fm.R(b.x, b.y, b.z), w, d, h, yawR(b.yaw), [198, 182, 150], Fm.sun, /tower/.test(b.key) ? 0 : 1.4); lab(b.key.split('/').pop(), Fm.R(b.x, b.y + h, b.z)); }
  for (const o of M.objects) {
    const yw = yawR(-o.yaw + Math.PI / 2);   // the premises' yaw (-pi/2 faces +x) as a box's long axis
    if (o.kind === 'aircraft') { box(RT, cam, Fm.R(o.x, o.y + 0.9, o.z), 7, 1.0, 1.1, yw, [232, 226, 204], Fm.sun); box(RT, cam, Fm.R(o.x, o.y + 1.9, o.z), 1.5, 10.6, 0.18, yw, [232, 226, 204], Fm.sun); lab(o.key.replace('arch:', '') + ' (parked)', Fm.R(o.x, o.y + 2.6, o.z)); }
    else if (/^(auto_|truck_|machine_)/.test(o.key)) { const big = /truck|boxtruck|flatbed|fire|bus|loader/.test(o.key); box(RT, cam, Fm.R(o.x, o.y, o.z), big ? 7 : 4.5, big ? 2.4 : 1.8, big ? 2.8 : 1.5, yw, /red|fire/.test(o.key) ? [176, 52, 44] : /blue/.test(o.key) ? [58, 92, 150] : [222, 220, 212], Fm.sun); lab(o.key.replace(/^auto_|^truck_/, ''), Fm.R(o.x, o.y + (big ? 3.2 : 1.9), o.z)); }
  }
  for (const r of M.runways) lab(r.name, Fm.R(r.c[0], S.y, r.c[1]));
}
function drawToday(RT, cam, S, Fm, labels) {
  // hangar.js's outdoors for this shell, as the code places them (the quarter turn: local = (z - Hz, Hx - x))
  const HD = S.HD, HW = S.HW, LP = (x, z) => [z - S.z, S.x - x], R0 = 160, KD = 3.5e-4, yR = (x, z) => { const r = Math.hypot(x, z); return r > R0 ? -KD * (r - R0) * (r - R0) : 0; };
  const quad = (a, b, c, d, col) => { RT.tri(cam, a, b, c, col); RT.tri(cam, a, c, d, col); };
  const FS = 700, n = 40, cx = -150, cz = 60;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const p = (a, b) => { const x = cx - FS / 2 + a * FS / n, z = cz - FS / 2 + b * FS / n; return [x, -0.10 + yR(x, z), z]; };
    quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), shade([118, 158, 74], 0.95 + 0.1 * hash(i, j))); }
  const flat = (P, y, col) => { for (let i = 1; i + 1 < P.length; i++) RT.tri(cam, [P[0][0], y + yR(P[0][0], P[0][1]), P[0][1]], [P[i][0], y + yR(P[i][0], P[i][1]), P[i][1]], [P[i + 1][0], y + yR(P[i + 1][0], P[i + 1][1]), P[i + 1][1]], col); };
  const home = M.runways.find(r => r.id === 'HOME');
  if (home) { // the 900 m of the strip nearest the shed
    const c = Math.cos(home.hdg), s = Math.sin(home.hdg), s0 = (S.x - home.c[0]) * c + (S.z - home.c[1]) * s, a = Math.max(-home.len / 2, s0 - 450), b = Math.min(home.len / 2, s0 + 450), hw = home.wid / 2;
    flat([[a, -hw], [b, -hw], [b, hw], [a, hw]].map(q => LP(home.c[0] + q[0] * c - q[1] * s, home.c[1] + q[0] * s + q[1] * c)), -0.085, [146, 144, 138]); labels.push(null); }
  for (const A of M.surfaces) flat(A.poly.map(q => LP(q[0], q[1])), -0.0925, [160, 157, 150]);
  flat([[-HD - 42, -HW - 12], [-HD + 0.5, -HW - 12], [-HD + 0.5, HW + 12], [-HD - 42, HW + 12]], -0.02, [168, 164, 156]);
  const APR = M.surfaces.map(A => A.poly.map(q => LP(q[0], q[1])));
  if (S.shell === 'club') { let fx = -HD - 120; for (const P of APR) for (const q of P) fx = Math.min(fx, q[0]); const ex = Math.max(fx + 10, -HD - 170);
    for (let i = 0; i < 5; i++) { const z = -34 + i * 15, col = [[140, 43, 34], [47, 74, 107], [216, 212, 200], [61, 74, 58], [107, 102, 96]][i];
      box(RT, cam, [ex, -0.09 + yR(ex, z) + 0, z], 1.76, 4.3, 1.06, 0, col, Fm.sun); box(RT, cam, [ex, -0.09 + yR(ex, z) + 1.06, z - 0.25], 1.56, 2.3, 0.62, 0, [43, 50, 56], Fm.sun); } }
  const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const xi = P[i][0], zi = P[i][1], xj = P[j][0], zj = P[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi) c = !c; } return c; };
  const front = 175, back = S.shell === 'works' ? HD + 26 : HD + 55;
  for (let row = 0; row < 3; row++) { const nT = 260 + row * 30; for (let i = 0; i < nT; i++) {
    const a = (i + hash(i, row) * 0.7) / nT * Math.PI * 2, c = Math.cos(a), k = Math.max(0, Math.min(1, (c + 0.35) / 0.7)), k2 = k * k * (3 - 2 * k), r = back + (front - back) * k2 + row * 9 + (hash(i, row + 9) - 0.5) * 6, x = -r * c, z = r * Math.sin(a);
    if (APR.some(P => inPoly(P, x, z))) continue;
    tree(RT, cam, [x, -0.3 + yR(x, z), z], 17 * (0.85 + hash(i, row + 3) * 0.55), hash(i, row + 5) < 0.6 ? 'conifer' : 'broadleaf', i + row * 1000); } }
}

function drawBuilt(RT, cam, S, Fm) {
  const J = JSON.parse(fs.readFileSync(path.join(BUILT, 'scene.json'), 'utf8')), B = fs.readFileSync(path.join(BUILT, 'scene.bin')), ab = B.buffer.slice(B.byteOffset, B.byteOffset + B.length);
  const arr = a => a.t === 'f32' ? new Float32Array(ab, a.at, a.n) : new Uint32Array(ab, a.at, a.n), O = J.origin;
  const N = M.terrain.near, surfAt = (x, z) => { const i = Math.round((x - N.x0) / N.step), j = Math.round((z - N.z0) / N.step); return (i >= 0 && j >= 0 && i < N.n && j < N.n) ? N.surf[j * N.n + i] : -1; };
  for (const m of J.meshes) { const P = arr(m.pos), I = arr(m.idx), C = m.col ? arr(m.col) : null, cs = m.kind === 'decal' ? 4 : 3, wp = k => [P[k * 3] + O[0], P[k * 3 + 1] + O[1], P[k * 3 + 2] + O[2]];
    for (let t = 0; t < I.length; t += 3) { const a = wp(I[t]), b = wp(I[t + 1]), c = wp(I[t + 2]), ra = Fm.R(a[0], a[1], a[2]), rb = Fm.R(b[0], b[1], b[2]), rc = Fm.R(c[0], c[1], c[2]);
      let col;
      if (m.kind === 'cards') col = (t / 3) % 2 ? [40, 80, 52] : [48, 92, 60];
      else if (m.kind === 'props') col = [200, 184, 152];
      else if (m.kind === 'ring') col = [C[I[t] * 3], C[I[t] * 3 + 1], C[I[t] * 3 + 2]].map(v => 255 * Math.pow(v, 1 / 2.2));
      else if (m.kind === 'decal') col = [176, 172, 160];
      else { const sf = surfAt((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3); col = sf < 0 ? [112, 128, 86] : SURF(sf); }
      RT.tri(cam, ra, rb, rc, m.kind === 'cards' ? col : shade(col, lit(ra, rb, rc, Fm.sun))); } }
}

// ---- the views -------------------------------------------------------------------------------------------------------
const VIEWS = S => [
  { name: 'door_out', label: 'standing in the door, looking straight out', eye: [-S.HD - 0.3, 1.7, 0], az: 0 },
  { name: 'door_left', label: 'standing in the door, 45 degrees to the left', eye: [-S.HD - 0.3, 1.7, 0], az: -45 },
  { name: 'door_right', label: 'standing in the door, 45 degrees to the right', eye: [-S.HD - 0.3, 1.7, 0], az: 45 },
  { name: 'inside', label: 'from the back of the room, through the door', eye: [S.HD * 0.55, 2.2, -S.HW * 0.25], az: -Math.atan2(S.HW * 0.25, S.HD * 1.55) * 180 / Math.PI, frameDoor: true },
];
fs.mkdirSync(OUT, { recursive: true });
const META = [];
for (const S of M.sheds) for (const scene of (WHICH === 'both' ? ['ref', 'today'] : WHICH.split(','))) for (const V of VIEWS(S)) {
  const t0 = Date.now(), a = V.az * Math.PI / 180, cam = makeCam(V.eye, [-Math.cos(a), -0.02, -Math.sin(a)], 46), RT = makeTarget(), Fm = frame(S), labels = [];
  sky(RT);
  if (scene === 'ref') drawRef(RT, cam, S, Fm, labels); else if (scene === 'built') drawBuilt(RT, cam, S, Fm); else drawToday(RT, cam, S, Fm, labels);
  if (scene === 'ref') skyline(RT, cam, S, Fm);
  if (V.frameDoor) { // the room round the door: everything outside the door's opening is the wall, dark
    const hw = S.door.w / 2, C = [[-S.HD, 0, -hw], [-S.HD, 0, hw], [-S.HD, S.door.h, hw], [-S.HD, S.door.h, -hw]].map(p => cam.px(cam.toView(p)));
    const xs = C.map(q => q[0]), ys = C.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let y = 0; y < HEI; y++) for (let x = 0; x < WID; x++) if (x < x0 || x > x1 || y < y0 || y > y1) { const i = (y * WID + x) * 3, fl = y > y1; RT.col[i] = fl ? 86 : 58; RT.col[i + 1] = fl ? 70 : 46; RT.col[i + 2] = fl ? 52 : 38; } }
  const file = 'sketch_' + scene + '_' + S.id.replace(/\W/g, '_') + '_' + V.name + '.png';
  fs.writeFileSync(path.join(OUT, file), png(WID, HEI, RT.col));
  META.push({ file, scene, shed: S.id, shedName: S.name, view: V.name, label: V.label, eyeRoom: V.eye, az: V.az, fov: 46, w: WID, h: HEI, labels: labels.filter(Boolean), ms: Date.now() - t0 });
  console.log('sketch: ' + file + '  ' + (Date.now() - t0) + ' ms');
}
fs.writeFileSync(path.join(OUT, 'sketch.json'), JSON.stringify(META));
