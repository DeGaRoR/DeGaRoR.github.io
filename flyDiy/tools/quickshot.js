// QUICKSHOT - a FAST picture of a build, no browser and no GPU: the editor's own layers built headless
// (_scene_headless.sceneBuild - the same PAGE.post chain the cage bench runs) plus the cage sheet, rasterised in
// node (orthographic, z-buffer, flat shading, the meshes' own material colours) and written as PNG. Seconds, where
// the bench in a headless browser takes minutes - for a cloud session, a review or anyone the cage 8 bench is too
// slow for. Guide: tools/QUICKSHOT.md.
//
//   node tools/quickshot.js <build.json | --key <archetype>> <out-prefix> [options]
//     --views side,top,front,q   which pictures (default side,top); q = a three-quarter from ahead, starboard, above
//     --over '{"row":value}'     panel rows over the build (try a slider without saving a file)
//     --crop z0,z1,y0,y1         the side view's window, metres (z forward, y up)
//     --w 1400                   picture width, px
//     --marks fittings|corners|reg   rings on the placed fittings / a quad window's corners / the registration
//   A build is a saved file ({spec} or a bare spec); --key births an archetype card the way the shed does
//   (designBake + the load door, the cowl fitted once) and draws that.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const KEY = opt('key', null);
const FILE = KEY ? null : pos[0], OUT = KEY ? pos[0] : pos[1];
if (!OUT || (!FILE && !KEY)) { console.error('usage: node tools/quickshot.js <build.json | --key <archetype>> <out-prefix> [--views side,top,front,q] [--over JSON] [--crop z0,z1,y0,y1] [--w px] [--marks ...]'); process.exit(2); }
const ROOT = path.resolve(__dirname, '..');
const over = JSON.parse(opt('over', '{}'));
const VIEWS = opt('views', 'side,top').split(',');
const WPX = +opt('w', 1400);
const MARKS = opt('marks', '');
const SH = require(path.join(ROOT, 'tools', '_scene_headless.js'));
let spec;
if (KEY) {
  const BJ = require(path.join(ROOT, 'tools', '_bake_joined.js')), LB = require(path.join(ROOT, 'tools', '_load_build.js'));
  const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === KEY);
  if (!a) { console.error('no archetype ' + KEY + ' - one of: ' + D.ARCHETYPES.map(x => x.key).join(' ')); process.exit(2); }
  const s0 = D.designBake(a.sel, a.over);
  const r = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 });
  if (r.errors.length) console.log('join errors: ' + r.errors.length + ' ' + r.errors[0]);
  spec = r.spec;
} else {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  spec = raw.spec || raw;
}
const t0 = Date.now();
const S = SH.sceneBuild(spec, { over, garage: spec });
if (S.errors.length) console.log('layer errors: ' + S.errors.length + ' ' + S.errors[0].split('\n')[0]);
const THREE = SH.context().THREE;

// ---- the triangles, world metres, with a colour --------------------------------------------------------------
const SKIP_SHEET = new Set(['tube', 'cloth', 'dash', 'dashFace', 'bulkhead', 'fireProof', 'firewall', 'fireSeal',
  'shoulder', 'toele', 'plywood', 'floorBoard', 'seat']);
const GLASS = new Set(['windshield', 'pilotWindow', 'pasengerWindow', 'skyWindows', 'drawnPane']);
const tris = [];   // [ax,ay,az, bx,by,bz, cx,cy,cz, r,g,b]
const P = S.P, FS = S.FS, sheet = S.built.sheet;
const skin = P.base != null ? P.base : 0xe8a33a;
const hex = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
// the REGISTRATION's footprint (the decal is a texture layer this renderer does not draw): the faces whose field
// along the body (sL, m) and round the section from the waist (sC, m) fall inside the marking, painted white
const DEC = Object.assign({ regL: 2.10, regC: 0.28, regH: 0.30, regW: 0.96 }, (spec.finish && spec.finish.decals) || {});
const inReg = f => { if (!sheet.A || f.v.some(i => !sheet.A[i])) return false;
  let sl = 0, sc = 0; for (const i of f.v) { sl += sheet.A[i][0]; sc += sheet.A[i][1]; } sl = sl / f.v.length * FS; sc = sc / f.v.length * FS;
  return Math.abs(sl - DEC.regL) < DEC.regW / 2 && Math.abs(sc - DEC.regC) < DEC.regH / 2; };
for (const f of sheet.F) {
  if (SKIP_SHEET.has(f.m) || f.v.length < 3) continue;
  const col = MARKS.includes('reg') && inReg(f) ? [245, 245, 245] : GLASS.has(f.m) ? (f.m === 'drawnPane' ? [70, 170, 230] : [60, 110, 160])
    : f.m === 'joint' || f.m === 'paneEdge' || f.m === 'doorSeal' || f.m === 'reveal' ? [40, 40, 44]
    : /pillar/.test(f.m) ? [210, 140, 50] : [232, 163, 58];
  const off = f.cutOff || [0, 0, 0];
  for (let t = 1; t + 1 < f.v.length; t++) {
    const a = sheet.V[f.v[0]], b = sheet.V[f.v[t]], c = sheet.V[f.v[t + 1]];
    tris.push([a[0] * FS, a[1] * FS, a[2] * FS, b[0] * FS, b[1] * FS, b[2] * FS, c[0] * FS, c[1] * FS, c[2] * FS, ...col]);
  }
}
let nLayer = 0;
S.scene.updateMatrixWorld(true);
const v = new THREE.Vector3();
S.scene.traverse(o => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
  if (o.visible === false || /^edVessel_|^edFuel_|^edDum|^edCrew/.test(o.name || '')) return;
  let hidden = false; for (let q = o; q; q = q.parent) if (q.visible === false) hidden = true;
  if (hidden) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  let col = m && m.color ? [m.color.r * 255, m.color.g * 255, m.color.b * 255].map(Math.round) : [180, 180, 180];
  if (/^edAcc_/.test(o.name || '') || (o.parent && /access/.test(o.parent.name || ''))) col = [220, 40, 40];
  if (m && m.transparent && m.opacity < 0.3) return;
  const pos = o.geometry.attributes.position, idx = o.geometry.index;
  const n = idx ? idx.count : pos.count;
  const W = i => { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld); return [v.x, v.y, v.z]; };
  for (let i = 0; i + 2 < n; i += 3) { const a = W(i), b = W(i + 1), c = W(i + 2); tris.push([...a, ...b, ...c, ...col]); nLayer++; }
});
console.log('tris: sheet ' + (tris.length - nLayer) + ', layers ' + nLayer + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s build)');

// ---- the marks: fittings placed, quad corners ---------------------------------------------------------------
const marks = [];
if (MARKS.includes('fittings') && S.W.CAGE_ACCESS)
  for (const q of S.W.CAGE_ACCESS.placed) if (/step|doorHandle|fuelCap|grabHandle/.test(q.key) && q.side !== 'port') marks.push({ p: q.p, col: [255, 255, 255], r: 5 });
if (MARKS.includes('corners'))
  for (const w of (S.spec.windows || [])) if (w.shape === 'quad' && w.corners) for (const c of w.corners) marks.push({ p: [P.halfW * FS * 1.2, c[1] * FS, c[0] * FS], col: [255, 230, 60], r: 5 });

// ---- the raster ---------------------------------------------------------------------------------------------
function view(name) {
  // u right, w up on the picture; d = toward the camera (larger = nearer)
  const V = {
    side: { u: p => -p[2], w: p => p[1], d: p => p[0] },                 // from starboard, the nose to the left
    top: { u: p => -p[2], w: p => -p[0], d: p => p[1] },                  // from above, the nose to the left
    front: { u: p => -p[0], w: p => p[1], d: p => p[2] },                // head-on, starboard on the left
    q: {},                                                                 // set below
  }[name];
  if (name === 'q') {   // a three-quarter from ahead, starboard, above: yaw 37 deg, pitch 22 deg
    const cy = Math.cos(0.65), sy = Math.sin(0.65), cp = Math.cos(0.38), sp = Math.sin(0.38);
    V.u = p => -p[2] * cy + p[0] * sy;
    const dd = p => p[0] * cy + p[2] * sy;
    V.w = p => p[1] * cp - dd(p) * sp;
    V.d = p => dd(p) * cp + p[1] * sp;
  }
  let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (const t of tris) for (let k = 0; k < 9; k += 3) { const p = [t[k], t[k + 1], t[k + 2]]; const u = V.u(p), w = V.w(p); u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
  const crop = opt('crop', null);
  if (crop && name === 'side') { const [z0, z1, y0, y1] = crop.split(',').map(Number); u0 = -z1; u1 = -z0; w0 = y0; w1 = y1; }
  const pad = 0.04 * (u1 - u0);
  u0 -= pad; u1 += pad; w0 -= pad; w1 += pad;
  const sc = WPX / (u1 - u0), H = Math.ceil((w1 - w0) * sc), Wd = WPX;
  const img = new Uint8Array(Wd * H * 3), zb = new Float32Array(Wd * H).fill(-Infinity);
  for (let i = 0; i < Wd * H; i++) { img[i * 3] = 22; img[i * 3 + 1] = 26; img[i * 3 + 2] = 32; }
  const L = [0.35, 0.8, 0.45], Ll = Math.hypot(...L);
  for (const t of tris) {
    const A = [t[0], t[1], t[2]], B = [t[3], t[4], t[5]], C = [t[6], t[7], t[8]];
    const ax = (V.u(A) - u0) * sc, ay = (w1 - V.w(A)) * sc, az = V.d(A);
    const bx = (V.u(B) - u0) * sc, by = (w1 - V.w(B)) * sc, bz = V.d(B);
    const cx = (V.u(C) - u0) * sc, cy = (w1 - V.w(C)) * sc, cz = V.d(C);
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;
    // flat shade: the world normal against a fixed light, both faces lit
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lam = 0.35 + 0.65 * Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / (nl * Ll));
    const r = Math.min(255, t[9] * lam), g = Math.min(255, t[10] * lam), b = Math.min(255, t[11] * lam);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(Wd - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0_ = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
      const w1_ = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      const w2_ = 1 - w0_ - w1_;
      if (w0_ < -1e-6 || w1_ < -1e-6 || w2_ < -1e-6) continue;
      const z = w0_ * az + w1_ * bz + w2_ * cz, i = y * Wd + x;
      if (z <= zb[i]) continue;
      zb[i] = z; img[i * 3] = r; img[i * 3 + 1] = g; img[i * 3 + 2] = b;
    }
  }
  // an edge darkening where the depth jumps (a silhouette line)
  const out = new Uint8Array(img);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < Wd - 1; x++) {
    const i = y * Wd + x, z = zb[i];
    if (!isFinite(z)) continue;
    const jump = Math.max(...[i - 1, i + 1, i - Wd, i + Wd].map(j => isFinite(zb[j]) ? Math.abs(zb[j] - z) : 1));
    if (jump > 0.04) for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round(img[i * 3 + k] * 0.35);
  }
  for (const m of marks) {
    const x = Math.round((V.u(m.p) - u0) * sc), y = Math.round((w1 - V.w(m.p)) * sc);
    for (let dy = -m.r; dy <= m.r; dy++) for (let dx = -m.r; dx <= m.r; dx++) {
      const rr = Math.hypot(dx, dy); if (rr > m.r || rr < m.r - 2) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= Wd || Y >= H) continue;
      const i = Y * Wd + X; out[i * 3] = m.col[0]; out[i * 3 + 1] = m.col[1]; out[i * 3 + 2] = m.col[2];
    }
  }
  writePNG(OUT + '_' + name + '.png', out, Wd, H);
  console.log('wrote ' + OUT + '_' + name + '.png ' + Wd + 'x' + H + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
}
function writePNG(file, rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
for (const n of VIEWS) view(n);
