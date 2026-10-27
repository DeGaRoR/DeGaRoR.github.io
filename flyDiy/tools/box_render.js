#!/usr/bin/env node
// box_render.js - A CHEAP PICTURE OF THE AEROPLANE, ON ANY BOX: NO BROWSER, NO GPU (the user, 27 Oct: "a super simple
// tool for cheap rendering directly on your box")
//
// The cloud's Chromium draws the sky only (SwiftShader: avionics_stills.js's header), so the stills rigs need A0's GPU.
// This draws the aeroplane the editor draws - tools/_scene_headless.js's scene, the page's own drawing layers on the real
// three.js - in plain node: every visible mesh (instanced ones too) through an orthographic camera fitted to it, a z-buffer
// on the CPU, two-sided flat shading off the material's colour, 2 x 2 supersampled, a PNG through node's zlib. A geometry
// check, not a beauty shot: no textures, no transparency (a mesh under 0.15 opacity is left out), no shadows, no sky.
//
//   node tools/box_render.js [what] [out.png] [view] [px]
//     what   a saved build (builds/cub_2026-09-20_corrected.json), card:<archetype key> (card:c172), or nothing for the
//            page's default aeroplane
//     view   iso (default), side, top, front, or sheet (the four in a 2 x 2)
//     px     the picture's width (default 1200; sheet: each panel's)
//   e.g. node tools/box_render.js "bugReports/cessnaMetal (1).json" /tmp/metal.png sheet 800
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const T = __dirname;

const what = process.argv[2] || '', OUT = path.resolve(process.argv[3] || 'box_render.png');
const VIEW = process.argv[4] || 'iso', PX = +(process.argv[5] || (VIEW === 'sheet' ? 800 : 1200));

// ---- the scene: the editor's drawing layers, headless ----------------------------------------------------------------
function sceneOf(w) {
  const BJ = require(path.join(T, '_bake_joined.js')), SH = require(path.join(T, '_scene_headless.js'));
  const { D } = BJ.loadPanel();
  let spec = null, name = w || 'the default aeroplane';
  if (w.startsWith('card:')) { const a = D.ARCHETYPES.find(x => x.key === w.slice(5)); if (!a) throw new Error('no archetype card ' + w.slice(5));
    spec = D.designBake(a.sel, a.over); name = a.name; }
  else if (w) { const j = JSON.parse(fs.readFileSync(path.resolve(path.join(T, '..'), w), 'utf8')); spec = j.spec || j; }
  const r = SH.sceneBuild(spec, spec ? { garage: spec } : {});
  // the skin's scale: the sheet is in cage units, the layers in the aeroplane's (CAGE_UNIT x planeScale, as the layers read it)
  const k = (r.W.CAGE2 ? r.W.CAGE2.CAGE_UNIT : 1) * ((r.P && r.P.planeScale) || 1);
  return { scene: r.scene, THREE: r.W.THREE, name, skin: r.built && r.built.mesh, k };
}

// ---- the triangles, in the world frame, with their colour -------------------------------------------------------------
function trianglesOf(scene, THREE) {
  scene.updateMatrixWorld(true);
  const tris = [];   // [ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b] per triangle
  const v = new THREE.Vector3(), M = new THREE.Matrix4(), IM = new THREE.Matrix4();
  const shown = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
  scene.traverse(o => {
    if (!o.isMesh || !shown(o) || !o.geometry || !o.geometry.attributes.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const m0 = mats[0] || {};
    if (m0.visible === false || (m0.transparent && (m0.opacity ?? 1) < 0.15)) return;
    const col = m0.color ? [m0.color.r, m0.color.g, m0.color.b] : [0.7, 0.7, 0.7];
    const P = o.geometry.attributes.position, I = o.geometry.index;
    const n = I ? I.count : P.count;
    const copies = o.isInstancedMesh ? o.count : 1;
    for (let c = 0; c < copies; c++) {
      if (o.isInstancedMesh) { o.getMatrixAt(c, IM); M.multiplyMatrices(o.matrixWorld, IM); } else M.copy(o.matrixWorld);
      for (let k = 0; k + 2 < n; k += 3) {
        const t = new Float64Array(12);
        for (let j = 0; j < 3; j++) {
          v.fromBufferAttribute(P, I ? I.getX(k + j) : k + j).applyMatrix4(M);
          t[j * 3] = v.x; t[j * 3 + 1] = v.y; t[j * 3 + 2] = v.z;
        }
        t[9] = col[0]; t[10] = col[1]; t[11] = col[2];
        tris.push(t);
      }
    }
  });
  return tris;
}
// the fuselage's skin (the cage sheet: faces { v: [vertex ids], m: material name }), coloured by its material's kind
const GLASS = /pane|window|windshield|glass|canopy/i, INSIDE = /ceiling|floor|dash|door|shoulder|bulkhead|fire|seat|reveal/i;
function skinTriangles(M, k) {
  const tris = [];
  if (!M || !M.V || !M.F) return tris;
  for (const f of M.F) {
    if (!f.v || f.v.length < 3) continue;
    const col = GLASS.test(f.m) ? [0.55, 0.72, 0.86] : INSIDE.test(f.m) ? [0.78, 0.7, 0.58] : /joint/.test(f.m) ? [0.62, 0.64, 0.66] : [0.86, 0.87, 0.88];
    const p0 = M.V[f.v[0]];
    for (let j = 1; j + 1 < f.v.length; j++) {
      const p1 = M.V[f.v[j]], p2 = M.V[f.v[j + 1]];
      tris.push(Float64Array.of(p0[0] * k, p0[1] * k, p0[2] * k, p1[0] * k, p1[1] * k, p1[2] * k, p2[0] * k, p2[1] * k, p2[2] * k, col[0], col[1], col[2]));
    }
  }
  return tris;
}

// ---- one view: the camera's axes (right, up, toward the eye) from an azimuth and an elevation -------------------------
// (the scene's frame: z forward - the nose at +z - x across, y up). Each view: toward the eye, and the picture's up
const VIEWS = { iso: [[0.62, 0.42, 0.66], [0, 1, 0]], side: [[1, 0, 0], [0, 1, 0]], top: [[0, 1, 0], [0, 0, 1]], front: [[0, 0, 1], [0, 1, 0]] };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function axes(view) {
  const f = unit(VIEWS[view][0]), r = unit(cross(VIEWS[view][1], f)), u = cross(f, r);
  return { r, u, f };
}
function render(tris, view, W) {
  const { r, u, f } = axes(view);
  const dot = (t, o, a) => t[o] * a[0] + t[o + 1] * a[1] + t[o + 2] * a[2];
  // the fit: every vertex in the view's frame
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const t of tris) for (let j = 0; j < 9; j += 3) { const x = dot(t, j, r), y = dot(t, j, u); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const S = 2, H = Math.round(W * 0.66), w = W * S, h = H * S, m = 0.06;
  const k = Math.min(w * (1 - 2 * m) / (x1 - x0 || 1), h * (1 - 2 * m) / (y1 - y0 || 1));
  const ox = w / 2 - k * (x0 + x1) / 2, oy = h / 2 + k * (y0 + y1) / 2;
  const Z = new Float32Array(w * h).fill(-Infinity), C = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const g = 236 - 28 * Math.floor(i / w) / h; C[i * 3] = g; C[i * 3 + 1] = g + 2; C[i * 3 + 2] = g + 8; }
  const L = [0.35, 0.8, 0.5], ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;   // the light, in the view's frame
  const sx = new Float64Array(3), sy = new Float64Array(3), sz = new Float64Array(3);
  for (const t of tris) {
    for (let j = 0; j < 3; j++) { sx[j] = ox + k * dot(t, j * 3, r); sy[j] = oy - k * dot(t, j * 3, u); sz[j] = dot(t, j * 3, f); }
    // the face's normal in the view's frame (two-sided: the light from whichever side faces the eye)
    const ax = t[3] - t[0], ay = t[4] - t[1], az = t[5] - t[2], bx = t[6] - t[0], by = t[7] - t[1], bz = t[8] - t[2];
    const N = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx], nl = Math.hypot(...N) || 1;
    const nv = [(N[0] * r[0] + N[1] * r[1] + N[2] * r[2]) / nl, (N[0] * u[0] + N[1] * u[1] + N[2] * u[2]) / nl, (N[0] * f[0] + N[1] * f[1] + N[2] * f[2]) / nl];
    const s = nv[2] < 0 ? -1 : 1, sh = 0.32 + 0.68 * Math.max(0, s * (nv[0] * L[0] + nv[1] * L[1] + nv[2] * L[2]));
    const cr = Math.min(255, 255 * t[9] * sh), cg = Math.min(255, 255 * t[10] * sh), cb = Math.min(255, 255 * t[11] * sh);
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
    if (Math.abs(area) < 1e-9) continue;
    const bx0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2]))), bx1 = Math.min(w - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
    const by0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2]))), by1 = Math.min(h - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const qx = px + 0.5, qy = py + 0.5;
      const w0 = ((sx[1] - qx) * (sy[2] - qy) - (sx[2] - qx) * (sy[1] - qy)) / area;
      const w1 = ((sx[2] - qx) * (sy[0] - qy) - (sx[0] - qx) * (sy[2] - qy)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * sz[0] + w1 * sz[1] + w2 * sz[2], i = py * w + px;
      if (z <= Z[i]) continue;
      Z[i] = z; C[i * 3] = cr; C[i * 3 + 1] = cg; C[i * 3 + 2] = cb;
    }
  }
  // 2 x 2 down to the picture
  const out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let a = 0; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) a += C[((y * S + dy) * w + x * S + dx) * 3 + c];
    out[(y * W + x) * 3 + c] = a / (S * S);
  }
  return { W, H, px: out };
}

// ---- a PNG (RGB, filter 0, zlib) -------------------------------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png({ W, H, px }) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// the four views in a 2 x 2
function sheet(views) {
  const W = views[0].W, H = views[0].H, out = new Uint8Array(4 * W * H * 3);
  views.forEach((v, q) => { const qx = (q % 2) * W, qy = Math.floor(q / 2) * H;
    for (let y = 0; y < H; y++) out.set(v.px.subarray(y * W * 3, (y + 1) * W * 3), ((qy + y) * 2 * W + qx) * 3); });
  return { W: 2 * W, H: 2 * H, px: out };
}

const t0 = Date.now();
const S = sceneOf(what);
const tris = trianglesOf(S.scene, S.THREE).concat(skinTriangles(S.skin, S.k));
const t1 = Date.now();
const img = VIEW === 'sheet' ? sheet(['iso', 'side', 'top', 'front'].map(v => render(tris, v, PX))) : render(tris, VIEW, PX);
fs.writeFileSync(OUT, png(img));
console.log(S.name + ': ' + tris.length + ' triangles (' + ((t1 - t0) / 1000).toFixed(1) + ' s the scene), ' + VIEW + ' ' + img.W + ' x ' + img.H +
            ' in ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s -> ' + OUT);
