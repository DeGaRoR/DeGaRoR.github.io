#!/usr/bin/env node
// box_render.js - A CHEAP PICTURE OF THE AEROPLANE, ON ANY BOX: NO BROWSER, NO GPU (the user, 27 Oct: "a super simple
// tool for cheap rendering directly on your box")
//
// The cloud's Chromium draws the sky only (SwiftShader: avionics_stills.js's header), so the stills rigs need A0's GPU.
// This draws the aeroplane the editor draws - tools/_scene_headless.js's scene, the page's own drawing layers on the real
// three.js, and the cage sheet (the fuselage's skin) at its plane scale - in plain node: every visible mesh (instanced ones
// too), a z-buffer on the CPU, two-sided flat shading off the material's colour, 2 x 2 supersampled, a PNG through zlib.
// A geometry check, not a beauty shot: no textures (but the GPS screen's, below), no transparency (a mesh under 0.15
// opacity is left out), no shadows, no sky.
//
//   node tools/box_render.js [what] [out.png] [view] [px] [--fit portable|panel|glass|flat|flatPair] [--side pilot|copilot]
//                            [--gps screen.png] [--gps2 mfd.png] [--fov deg]
//   (G2815: --side puts a single 10 in display in front of the passenger; --gps2 textures a pair's second display)
//     what   a saved build (builds/cub_2026-09-20_corrected.json), card:<archetype key> (card:c172), or nothing for the
//            page's default aeroplane
//     view   iso (default), side, top, front, sheet (the four in a 2 x 2) - orthographic, fitted to the aeroplane; or
//            cockpit: perspective from the pilot's eye (the crew layer's CAGE_CREW_EYE, the head hidden) at the dash (the crew and panel layers drawn: the dials, the
//            switch row, the breakers, the GPS unit), the GPS screen textured with --gps (tools/gps_shots.js's picture:
//            the game's own painter's output)
//     px     the picture's width (default 1200; sheet: each panel's)
//   e.g. node tools/box_render.js "bugReports/cessnaMetal (1).json" /tmp/metal.png sheet 800
//        node tools/gps_shots.js /tmp/gps glass &&
//        node tools/box_render.js "bugReports/cessnaMetal (1).json" /tmp/dash.png cockpit 1400 --fit glass --gps /tmp/gps/gps_map.png
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const T = __dirname;

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const GPS_PNG = (v => v && path.resolve(v))(opt('--gps')), GPS2_PNG = (v => v && path.resolve(v))(opt('--gps2'));
const FIT = opt('--fit'), SIDE = opt('--side'), FOV = +(opt('--fov') || 66);
const what = argv[0] || '', OUT = path.resolve(argv[1] || 'box_render.png');
const VIEW = argv[2] || 'iso', PX = +(argv[3] || (VIEW === 'sheet' ? 800 : 1200));
const COCKPIT = VIEW === 'cockpit';

// ---- the scene: the editor's drawing layers, headless ----------------------------------------------------------------
// a 2D canvas that paints nothing (the panel's dial atlas, its AO patch): the cockpit's geometry needs the panel layer to
// run, not its printing (headless, document.createElement hands out no canvas)
function fakeCanvas() {
  const cv = { width: 300, height: 150, style: {}, addEventListener() {}, toDataURL: () => '' };
  const dummy = { addColorStop() {} };
  const store = {};
  const g = new Proxy(store, {
    get: (t, k) => k === 'canvas' ? cv : k in t ? t[k] : k === 'measureText' ? (s => ({ width: 7 * String(s).length })) :
      (k === 'getImageData' || k === 'createImageData') ? ((x, y, w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)), width: w, height: h })) :
      () => dummy,
    set: (t, k, v) => { t[k] = v; return true; } });
  cv.getContext = () => g;
  return cv;
}
function sceneOf(w) {
  const SH = require(path.join(T, '_scene_headless.js'));
  if (COCKPIT) {
    for (const f of ['_panel_gen.js', '_cage_panel.js', '_cage_crew.js']) SH.EXCLUDE.delete(f);
    SH.context({ before: ctx => { const el0 = ctx.document.createElement; ctx.document.createElement = tag => (tag === 'canvas' ? fakeCanvas() : el0(tag)); } });
  }
  const BJ = require(path.join(T, '_bake_joined.js'));
  const { D } = BJ.loadPanel();
  let spec = null, name = w || 'the default aeroplane';
  if (w.startsWith('card:')) { const a = D.ARCHETYPES.find(x => x.key === w.slice(5)); if (!a) throw new Error('no archetype card ' + w.slice(5));
    spec = D.designBake(a.sel, a.over); name = a.name; }
  else if (w) { const j = JSON.parse(fs.readFileSync(path.resolve(path.join(T, '..'), w), 'utf8')); spec = j.spec || j; }
  // --fit <portable|panel|glass>: a GPS fitted as the Instruments column fits it (systems.avionics.gps)
  if (FIT && spec) { spec.systems = spec.systems || {}; spec.systems.avionics = Object.assign({}, spec.systems.avionics, { gps: FIT }); name += ' + ' + FIT + ' GPS'; }
  if (SIDE && spec) { spec.systems = spec.systems || {}; spec.systems.gpsSide = SIDE; name += ' (' + SIDE + ' side)'; }
  let r = SH.sceneBuild(spec, spec ? { garage: spec } : {});
  // the cockpit: the panel layer keeps its own Instruments column state, which the editor fills from the build it loads
  // (CAGE_PANEL.fromSpec) - the first build seeds the layer, the build's systems go in, and it builds again
  if (COCKPIT && spec && r.W.CAGE_PANEL) { r.W.CAGE_PANEL.fromSpec(spec.systems || {}); r = SH.sceneBuild(spec, { garage: spec }); }
  if (r.errors && r.errors.length) console.log('(the scene: ' + r.errors.map(e => String(e).split('\n')[0]).join('; ') + ')');
  // the skin's scale: the sheet is in cage units, the layers in the aeroplane's (CAGE_UNIT x planeScale, as the layers read it)
  const k = (r.W.CAGE2 ? r.W.CAGE2.CAGE_UNIT : 1) * ((r.P && r.P.planeScale) || 1);
  return { scene: r.scene, THREE: r.W.THREE, name, skin: r.built && r.built.mesh, k, eye: r.W.CAGE_CREW_EYE || null };
}

// ---- the triangles, in the world frame, with their colour (and the GPS screen's uv) ----------------------------------
// a triangle: Float64Array [ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b] (+ .uv [u0, v0, u1, v1, u2, v2] on the screen)
function trianglesOf(scene, THREE, texOf, hide) {
  scene.updateMatrixWorld(true);
  const tris = [];
  const v = new THREE.Vector3(), M = new THREE.Matrix4(), IM = new THREE.Matrix4();
  const shown = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
  let gps = null;
  scene.traverse(o => {
    if (!o.isMesh || !shown(o) || !o.geometry || !o.geometry.attributes.position || (hide && hide.has(o))) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const m0 = mats[0] || {};
    if (m0.visible === false || (m0.transparent && (m0.opacity ?? 1) < 0.15)) return;
    const set = (m0.userData && m0.userData.panelSet) || (o.userData && o.userData.panelSet);   // (the screen's material carries it)
    const isGps = set === 'gps' || set === 'gps2', gpsTex = isGps ? texOf[set] : null;          // (G2815: a pair's second)
    if (m0.type === 'MeshBasicMaterial' && m0.transparent && !isGps) return;   // (the AO patches, the glows: painted shadows)
    const col = m0.color ? [m0.color.r, m0.color.g, m0.color.b] : [0.7, 0.7, 0.7];
    const P = o.geometry.attributes.position, I = o.geometry.index, UV = o.geometry.attributes.uv;
    const n = I ? I.count : P.count;
    const copies = o.isInstancedMesh ? o.count : 1;
    for (let c = 0; c < copies; c++) {
      if (o.isInstancedMesh) { o.getMatrixAt(c, IM); M.multiplyMatrices(o.matrixWorld, IM); } else M.copy(o.matrixWorld);
      for (let k = 0; k + 2 < n; k += 3) {
        const t = new Float64Array(12);
        const uv = isGps && gpsTex && UV ? [] : null;
        for (let j = 0; j < 3; j++) {
          const id = I ? I.getX(k + j) : k + j;
          v.fromBufferAttribute(P, id).applyMatrix4(M);
          t[j * 3] = v.x; t[j * 3 + 1] = v.y; t[j * 3 + 2] = v.z;
          if (uv) uv.push(UV.getX(id), UV.getY(id));
        }
        t[9] = col[0]; t[10] = col[1]; t[11] = col[2];
        if (uv) { t.uv = uv; t.tex = gpsTex; }
        tris.push(t);
      }
    }
    if (isGps) {                                          // (the screens' box: the cockpit view aims at its middle)
      const b = new THREE.Box3().setFromObject(o);
      if (!gps) gps = { min: b.min.toArray(), max: b.max.toArray() };
      else for (let i = 0; i < 3; i++) { gps.min[i] = Math.min(gps.min[i], b.min.getComponent(i)); gps.max[i] = Math.max(gps.max[i], b.max.getComponent(i)); }
    }
  });
  return { tris, gps };
}
// the fuselage's skin (the cage sheet: faces { v: [vertex ids], m: material name }), coloured by its material's kind
const GLASS = /pane|window|windshield|glass|canopy/i, INSIDE = /ceiling|floor|dash|door|shoulder|bulkhead|fire|seat|reveal/i;
function skinTriangles(M, k, cockpit) {
  const tris = [];
  if (!M || !M.V || !M.F) return tris;
  for (const f of M.F) {
    if (!f.v || f.v.length < 3) continue;
    if (cockpit && GLASS.test(f.m)) continue;   // (from inside: the glass is seen through)
    const col = GLASS.test(f.m) ? [0.55, 0.72, 0.86] : INSIDE.test(f.m) ? [0.78, 0.7, 0.58] : /joint/.test(f.m) ? [0.62, 0.64, 0.66] : [0.86, 0.87, 0.88];
    const p0 = M.V[f.v[0]];
    for (let j = 1; j + 1 < f.v.length; j++) {
      const p1 = M.V[f.v[j]], p2 = M.V[f.v[j + 1]];
      tris.push(Float64Array.of(p0[0] * k, p0[1] * k, p0[2] * k, p1[0] * k, p1[1] * k, p1[2] * k, p2[0] * k, p2[1] * k, p2[2] * k, col[0], col[1], col[2]));
    }
  }
  return tris;
}

// ---- the views -------------------------------------------------------------------------------------------------------
// (the scene's frame: z forward - the nose at +z - x across, y up). Each orthographic view: toward the eye, and the
// picture's up. The cockpit: an eye and a look direction (perspective)
const VIEWS = { iso: [[0.62, 0.42, 0.66], [0, 1, 0]], side: [[1, 0, 0], [0, 1, 0]], top: [[0, 1, 0], [0, 0, 1]], front: [[0, 0, 1], [0, 1, 0]] };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// cam: { r, u, f (toward the eye), eye (perspective only), F (focal, px) }. Projects every triangle, z-buffers, shades
function render(tris, cam, W, H) {
  const { r, u, f } = cam, persp = !!cam.eye;
  const S = 2, w = W * S, h = H * S;
  const dot = (t, o, a) => t[o] * a[0] + t[o + 1] * a[1] + t[o + 2] * a[2];
  let k = 1, ox = w / 2, oy = h / 2;
  if (!persp) {   // the fit: every vertex in the view's frame
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const t of tris) for (let j = 0; j < 9; j += 3) { const x = dot(t, j, r), y = dot(t, j, u); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const m = 0.06;
    k = Math.min(w * (1 - 2 * m) / (x1 - x0 || 1), h * (1 - 2 * m) / (y1 - y0 || 1));
    ox = w / 2 - k * (x0 + x1) / 2; oy = h / 2 + k * (y0 + y1) / 2;
  }
  const Fp = (cam.F || 1) * S, E = cam.eye || [0, 0, 0], NEAR = 0.04;
  const Z = new Float32Array(w * h).fill(-Infinity), C = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const g = persp ? 205 - 40 * Math.floor(i / w) / h : 236 - 28 * Math.floor(i / w) / h; C[i * 3] = g - (persp ? 30 : 0); C[i * 3 + 1] = g - (persp ? 10 : -2); C[i * 3 + 2] = g + (persp ? 25 : 8); }
  // the light, in the view's frame: over the left shoulder outside; inside, from behind the eye (a cabin's light falls
  // on the faces that look at the pilot)
  const L = persp ? [0.22, 0.5, 0.84] : [0.35, 0.8, 0.5], ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const sx = new Float64Array(3), sy = new Float64Array(3), sz = new Float64Array(3), iz = new Float64Array(3);
  for (const t of tris) {
    let behind = false;
    for (let j = 0; j < 3; j++) {
      const px = t[j * 3] - E[0], py = t[j * 3 + 1] - E[1], pz = t[j * 3 + 2] - E[2];
      const xr = px * r[0] + py * r[1] + pz * r[2], yu = px * u[0] + py * u[1] + pz * u[2], zf = px * f[0] + py * f[1] + pz * f[2];
      if (persp) {
        const d = -zf;                      // the distance ahead of the eye (f points back at it)
        if (d < NEAR) { behind = true; break; }
        sx[j] = w / 2 + Fp * xr / d; sy[j] = h / 2 - Fp * yu / d; sz[j] = 1 / d; iz[j] = 1 / d;   // (1/d: linear in the picture)
      } else { sx[j] = ox + k * xr; sy[j] = oy - k * yu; sz[j] = zf; iz[j] = 1; }
    }
    if (behind) continue;
    // the face's normal in the view's frame (two-sided: lit from whichever side faces the eye)
    const ax = t[3] - t[0], ay = t[4] - t[1], az = t[5] - t[2], bx = t[6] - t[0], by = t[7] - t[1], bz = t[8] - t[2];
    const N = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx], nl = Math.hypot(...N) || 1;
    const nv = [(N[0] * r[0] + N[1] * r[1] + N[2] * r[2]) / nl, (N[0] * u[0] + N[1] * u[1] + N[2] * u[2]) / nl, (N[0] * f[0] + N[1] * f[1] + N[2] * f[2]) / nl];
    const s = nv[2] < 0 ? -1 : 1, sh = 0.32 + 0.68 * Math.max(0, s * (nv[0] * L[0] + nv[1] * L[1] + nv[2] * L[2]));
    const cr = Math.min(255, 255 * t[9] * sh), cg = Math.min(255, 255 * t[10] * sh), cb = Math.min(255, 255 * t[11] * sh);
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
    if (Math.abs(area) < 1e-9) continue;
    const bx0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2]))), bx1 = Math.min(w - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
    const by0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2]))), by1 = Math.min(h - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
    if (bx1 < bx0 || by1 < by0) continue;
    const tx = t.tex, uv = t.uv;
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const qx = px + 0.5, qy = py + 0.5;
      const w0 = ((sx[1] - qx) * (sy[2] - qy) - (sx[2] - qx) * (sy[1] - qy)) / area;
      const w1 = ((sx[2] - qx) * (sy[0] - qy) - (sx[0] - qx) * (sy[2] - qy)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * sz[0] + w1 * sz[1] + w2 * sz[2], i = py * w + px;
      if (z <= Z[i]) continue;
      Z[i] = z;
      if (tx) {   // the screen: its texture, perspective-correct (u/z, v/z, 1/z), unlit (it is a lit screen)
        const a0 = w0 * iz[0], a1 = w1 * iz[1], a2 = w2 * iz[2], q = a0 + a1 + a2;
        const U = (a0 * uv[0] + a1 * uv[2] + a2 * uv[4]) / q, V = (a0 * uv[1] + a1 * uv[3] + a2 * uv[5]) / q;
        const X = Math.min(tx.W - 1, Math.max(0, Math.floor(U * tx.W))), Y = Math.min(tx.H - 1, Math.max(0, Math.floor((1 - V) * tx.H)));
        const o = (Y * tx.W + X) * tx.ch;
        C[i * 3] = tx.px[o]; C[i * 3 + 1] = tx.px[o + 1]; C[i * 3 + 2] = tx.px[o + 2];
      } else { C[i * 3] = cr; C[i * 3 + 1] = cg; C[i * 3 + 2] = cb; }
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
const orthoCam = view => { const f = unit(VIEWS[view][0]), r = unit(cross(VIEWS[view][1], f)); return { r, u: cross(f, r), f }; };
// the pilot's eye: the crew layer's published eye point (CAGE_CREW_EYE, G107: world space, the head's forward), looking
// at the GPS unit (else 14 deg down the head's forward); 66 deg across. Without a pilot drawn: 0.68 m aft of the GPS unit and 0.3 m over it
function cockpitCam(eyeP, gps, W) {
  let eye, look;
  if (eyeP && eyeP.p) {
    eye = eyeP.p;
    if (gps) { const c = [0, 1, 2].map(i => (gps.min[i] + gps.max[i]) / 2); look = unit([c[0] - eye[0], c[1] + 0.06 * FOV / 66 - 0.03 * (1 - FOV / 66) - eye[1], c[2] - eye[2]]); }   // (at the GPS: over it wide, its keys close)
    else { const fw = unit(eyeP.fwd || [0, 0, 1]); look = unit([fw[0], fw[1] - 0.25, fw[2]]); }
  }
  else {
    if (!gps) throw new Error('no pilot and no GPS unit drawn: nothing to look from');
    const c = [0, 1, 2].map(i => (gps.min[i] + gps.max[i]) / 2);
    eye = [c[0], c[1] + 0.3, c[2] - 0.68]; look = unit([c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]]);
  }
  const f = [-look[0], -look[1], -look[2]], r = unit(cross([0, 1, 0], f));
  return { r, u: cross(f, r), f, eye, F: (W / 2) / Math.tan(FOV / 2 * Math.PI / 180) };
}
// the pilot's head (or the whole skinned body of a character pilot): hidden while looking out of it, as the game's
// interior view hides it
function hiddenOf(eyeP) {
  const h = new Set();
  for (const o of (eyeP && eyeP.heads) || []) if (o && o.traverse) o.traverse(q => { if (q.isMesh) h.add(q); });
  return h;
}

// ---- PNG out (RGB, filter 0, zlib) and in (8-bit RGB / RGBA, the five filters) ----------------------------------------
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
function unpng(buf) {
  let o = 8, W = 0, H = 0, type = 0; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), ty = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (ty === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); type = d[9]; if (d[8] !== 8 || (type !== 2 && type !== 6)) throw new Error('8-bit RGB / RGBA only'); }
    else if (ty === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const ch = type === 6 ? 4 : 3, row = W * ch, raw = zlib.inflateSync(Buffer.concat(idat)), px = new Uint8Array(W * H * ch);
  for (let y = 0; y < H; y++) {
    const ft = raw[y * (row + 1)], src = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1)), o2 = y * row;
    for (let x = 0; x < row; x++) {
      const a = x >= ch ? px[o2 + x - ch] : 0, b = y ? px[o2 - row + x] : 0, c = x >= ch && y ? px[o2 - row + x - ch] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o2 + x] = (src[x] + (ft === 1 ? a : ft === 2 ? b : ft === 3 ? (a + b) >> 1 : ft === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0)) & 255;
    }
  }
  return { W, H, ch, px };
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
const texOf = { gps: GPS_PNG ? unpng(fs.readFileSync(GPS_PNG)) : null, gps2: GPS2_PNG ? unpng(fs.readFileSync(GPS2_PNG)) : null };
const { tris: layerTris, gps } = trianglesOf(S.scene, S.THREE, texOf, COCKPIT ? hiddenOf(S.eye) : null);
const tris = layerTris.concat(skinTriangles(S.skin, S.k, COCKPIT));
const t1 = Date.now();
const H0 = Math.round(PX * (COCKPIT ? 0.6 : 0.66));
const img = COCKPIT ? render(tris, cockpitCam(S.eye, gps, PX), PX, H0)
  : VIEW === 'sheet' ? sheet(['iso', 'side', 'top', 'front'].map(v => render(tris, orthoCam(v), PX, H0))) : render(tris, orthoCam(VIEW), PX, H0);
fs.writeFileSync(OUT, png(img));
console.log(S.name + ': ' + tris.length + ' triangles (' + ((t1 - t0) / 1000).toFixed(1) + ' s the scene), ' + VIEW + ' ' + img.W + ' x ' + img.H +
            ' in ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s' + (COCKPIT ? ', the eye at ' + JSON.stringify(S.eye && S.eye.p && S.eye.p.map(v => +v.toFixed(3))) + ', the GPS unit at ' + JSON.stringify(gps && gps.min.map((v, i) => +((v + gps.max[i]) / 2).toFixed(3))) : '') + ' -> ' + OUT);
