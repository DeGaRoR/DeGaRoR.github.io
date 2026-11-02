#!/usr/bin/env node
// tank_shot.js - A CUTAWAY OF A BUILD'S TANKS, NO BROWSER (TANK-FIT, 2026-11-03)
//
// quickshot.js draws the outside of an aeroplane; a tank lives inside it, and the tank's verdict is about what is
// around it. This loads the build through THE PAGE'S OWN LOAD DOOR (tools/_load_build.js: the join, the crew with its
// characters, the energy layer's own fit and write-back), optionally puts tanks of your choosing in it, and draws
// the result with the port half of the skin cut away (or the starboard, or none), the tanks coloured by their own
// verdict (green fits, red does not), the crew's posed bodies in blue-grey, and a ring on every contact the
// clearance names.
//
//   node tools/tank_shot.js <build.json | --key <archetype>> <out-prefix> [options]
//     --views side,top,front,q   (default side)
//     --cut 0                    the skin with x > cut is not drawn (the near half, in the side view); --cut none keeps it
//     --vessels '<json>'         the energy section's vessel list to draw instead of the build's own
//     --fit '<json>'             ...or one candidate vessel, asked through CAGE_ENERGY.fitOf and drawn alone
//     --crop z0,z1,y0,y1         the side view's window, metres
//     --w 1400                   width, px
//     --with wing,brace          more layers drawn (default: the crew, the engine, the cowl, the pod, the floats)
//     --legacy                   the legacy verdict (window.TANK_FIT_LEGACY: the before)
//     --label 'text'             a caption burnt into the top-left (the verdict line is added under it)
//   -> <out-prefix>_<view>.png, and a line `TANK_SHOT {json}` with each tank's verdict and why.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const KEY = opt('key', null);
const FILE = KEY ? null : pos[0], OUT = KEY ? pos[0] : pos[1];
if (!OUT || (!FILE && !KEY)) { console.error('usage: node tools/tank_shot.js <build.json | --key <archetype>> <out-prefix> [--views side] [--cut 0|none] [--vessels JSON] [--fit JSON] [--crop z0,z1,y0,y1] [--w px]'); process.exit(2); }
const T = __dirname;
const LB = require(path.join(T, '_load_build.js'));
const VIEWS = opt('views', 'side').split(',');
const WPX = +opt('w', 1400);
const CUT = opt('cut', '0') === 'none' ? Infinity : +opt('cut', '0');

// ---- the probe that runs in the page context after the last build ------------------------------------------------
const probe = `
const E = window.CAGE_ENERGY, L = E.last(), T3 = window.THREE;
const ARGS = ${JSON.stringify({ vessels: opt('vessels', null), fit: opt('fit', null) })};
${argv.includes('--legacy') ? 'window.__TANK_LEGACY = 1;' : ''}
let fitRes = null;
// THE PAGE'S FRAME (tank_fit_probe.js says why): the layers' parent is the layer's scene
{ let host = null; L.ctx.scene.traverse(o => { if (!host && o.children && o.children.some(c => /^cageLayer:/.test(c.name || ''))) host = o; });
  if (host) L.ctx.scene = host; }
if (window.__TANK_LEGACY) window.TANK_FIT_LEGACY = true;
E.relayout();
if (ARGS.vessels) { const cur = E.toSpec(); cur.vessels = JSON.parse(ARGS.vessels); E.fromSpec(cur); E.relayout(); }
if (ARGS.fit) { const cur = E.toSpec(); cur.vessels = [JSON.parse(ARGS.fit)]; E.fromSpec(cur); E.relayout(); }
const scene = L.ctx.scene, FS = (window.CAGE2.CAGE_UNIT || 1) * ((L.ctx.P && L.ctx.P.planeScale) || 1);
scene.updateMatrixWorld(true);
const out = { sheet: [], sheetCol: [], lay: [], layCol: [], tank: [], tankCol: [], rings: [], res: [] };
const M = L.ctx.mesh;
const GL = new Set(['windshield', 'pilotWindow', 'pasengerWindow', 'skyWindows', 'drawnPane']);
for (const f of M.F) {
  if (!f.v || f.v.length < 3) continue;
  const col = GL.has(f.m) ? 1 : /joint|frame|Frame|tube|pillar/i.test(f.m) ? 2 : /dash/.test(f.m) ? 3 : /fire|bulkhead|ply|floor/i.test(f.m) ? 4 : 0;
  for (let t = 1; t + 1 < f.v.length; t++) for (const k of [f.v[0], f.v[t], f.v[t + 1]]) { const q = M.V[k]; out.sheet.push(q[0] * FS, q[1] * FS, q[2] * FS); }
  out.sheetCol.push(col);
}
// the energy group's frame is the layers' frame (relayout: a fresh group on the scene); every mesh goes through inv
const inv = new T3.Matrix4().copy(L.group.matrixWorld).invert();
const V = new T3.Vector3();
scene.traverse(o => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
  const nm = o.name || '';
  let top = o; while (top.parent && !/^cageLayer:/.test(top.name || '')) top = top.parent;
  const layer = top.name || '';
  const isTank = /^ed(Vessel|Fuel|TankClash)_/.test(nm);
  const pick = o.userData && o.userData.charPick;
  if (!isTank && !pick) {
    let hid = false; for (let q = o; q; q = q.parent) if (q.visible === false) hid = true;
    if (hid) return;
    const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m0 && (m0.visible === false || (m0.transparent && m0.opacity < 0.3))) return;
    if (o.isSkinnedMesh) return;
  }
  if (/^edFuel_/.test(nm)) return;
  // only what a tank can meet (the pipe to the parent is finite): the crew, the engine, the cowl, the energy layer
  if (!isTank && !/crew|eng|cowl|pod|float${opt('with', null) ? '|' + opt('with').split(',').join('|') : ''}/.test(layer)) return;
  const P = o.geometry.attributes.position, I = o.geometry.index, n = I ? I.count : P.count;
  const dst = isTank ? out.tank : out.lay, cd = isTank ? out.tankCol : out.layCol;
  let col;
  if (isTank) col = (o.userData && o.userData.edUnfit) ? 1 : 0;
  else if (pick) col = 5; else if (/crew/.test(layer)) col = 6; else if (/eng/.test(layer)) col = 2; else if (/cowl/.test(layer)) col = 3; else if (/wing|brace/.test(layer)) col = 4; else col = 7;
  if (/^edTankClash_/.test(nm)) col = 2;
  for (let i = 0; i + 2 < n; i += 3) {
    for (let k = 0; k < 3; k++) { V.fromBufferAttribute(P, I ? I.getX(i + k) : i + k).applyMatrix4(o.matrixWorld).applyMatrix4(inv); dst.push(V.x, V.y, V.z); }
    cd.push(col);
  }
});
for (const r of E.results()) {
  out.res.push({ bay: r.v.bay, ok: !!r.ok, why: r.why, along: r.v.along, lv: r.v.lv, dims: r.v.dims, cap: r.v.capacity, c: r.c, clash: r.clash || null });
  if (r.clash && r.clash.at) out.rings.push(r.clash.at);
  for (const k of (r.clash && r.clash.marks) || []) out.rings.push(k);
}
const b64 = a => a.map(x => Math.round(x * 1e3) / 1e3);   // (no Buffer in the page context: plain numbers, 1 mm)
const b8 = a => a;
return JSON.stringify({ sheet: b64(out.sheet), sheetCol: b8(out.sheetCol), lay: b64(out.lay), layCol: b8(out.layCol), tank: b64(out.tank), tankCol: b8(out.tankCol), rings: out.rings, res: out.res });
`;
const pf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tankshot_')), 'probe.js');
fs.writeFileSync(pf, probe);
process.env.FLYDIY_JOIN_PROBE = pf;
process.env.FLYDIY_JOIN_NOCACHE = '1';
let raw;
if (KEY) {
  const BJ = require(path.join(T, '_bake_joined.js'));
  const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === KEY);
  if (!a) { console.error('no archetype ' + KEY); process.exit(2); }
  const s0 = D.designBake(a.sel, a.over);
  raw = { v: s0.v, birth: 1, spec: s0 };
} else raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const r = LB.gameSpecFull(raw);
let P;
try { P = JSON.parse(r.probe); } catch (e) { console.error('the probe failed: ' + String(r.probe).slice(0, 2000)); process.exit(1); }
const f32 = a => Float32Array.from(a);
const u8 = a => Uint8Array.from(a);
const SHEET_C = [[232, 163, 58], [60, 110, 160], [120, 84, 52], [70, 70, 78], [150, 120, 90]];
const LAY_C = [, , [90, 90, 98], [200, 200, 205], [205, 150, 60], [96, 128, 170], [70, 90, 120], [170, 170, 170]];
const TANK_C = [[70, 200, 110], [235, 50, 40]];
const tris = [];
const push = (buf, cols, pal, cut) => {
  for (let t = 0, k = 0; t + 8 < buf.length; t += 9, k++) {
    if (cut && (buf[t] > CUT && buf[t + 3] > CUT && buf[t + 6] > CUT)) continue;
    const c = pal[cols[k]] || [180, 180, 180];
    tris.push([buf[t], buf[t + 1], buf[t + 2], buf[t + 3], buf[t + 4], buf[t + 5], buf[t + 6], buf[t + 7], buf[t + 8], c[0], c[1], c[2]]);
  }
};
push(f32(P.sheet), u8(P.sheetCol), SHEET_C, true);
push(f32(P.lay), u8(P.layCol), LAY_C, true);
push(f32(P.tank), u8(P.tankCol), TANK_C, false);
console.log('TANK_SHOT ' + JSON.stringify(P.res));

function view(name) {
  const Vw = {
    side: { u: p => -p[2], w: p => p[1], d: p => p[0] },                 // from starboard, the near (x > cut) half cut away, nose left
    top: { u: p => -p[2], w: p => -p[0], d: p => p[1] },
    front: { u: p => -p[0], w: p => p[1], d: p => p[2] },
    q: {},
  }[name];
  if (name === 'q') {
    const cy = Math.cos(0.65), sy = Math.sin(0.65), cp = Math.cos(0.38), sp = Math.sin(0.38);
    Vw.u = p => -p[2] * cy + p[0] * sy;
    const dd = p => p[0] * cy + p[2] * sy;
    Vw.w = p => p[1] * cp - dd(p) * sp;
    Vw.d = p => dd(p) * cp + p[1] * sp;
  }
  let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (const t of tris) for (let k = 0; k < 9; k += 3) { const p = [t[k], t[k + 1], t[k + 2]]; const u = Vw.u(p), w = Vw.w(p); u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
  const crop = opt('crop', null);
  if (crop && name === 'side') { const [z0, z1, y0, y1] = crop.split(',').map(Number); u0 = -z1; u1 = -z0; w0 = y0; w1 = y1; }
  const pad = 0.04 * (u1 - u0);
  u0 -= pad; u1 += pad; w0 -= pad; w1 += pad;
  const sc = WPX / (u1 - u0), H = Math.ceil((w1 - w0) * sc), Wd = WPX;
  const img = new Uint8Array(Wd * H * 3), zb = new Float32Array(Wd * H).fill(-Infinity);
  for (let i = 0; i < Wd * H; i++) { img[i * 3] = 22; img[i * 3 + 1] = 26; img[i * 3 + 2] = 32; }
  const Lt = [0.35, 0.8, 0.45], Ll = Math.hypot(...Lt);
  for (const t of tris) {
    const A = [t[0], t[1], t[2]], B = [t[3], t[4], t[5]], C = [t[6], t[7], t[8]];
    const ax = (Vw.u(A) - u0) * sc, ay = (w1 - Vw.w(A)) * sc, az = Vw.d(A);
    const bx = (Vw.u(B) - u0) * sc, by = (w1 - Vw.w(B)) * sc, bz = Vw.d(B);
    const cx = (Vw.u(C) - u0) * sc, cy = (w1 - Vw.w(C)) * sc, cz = Vw.d(C);
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lam = 0.35 + 0.65 * Math.abs((nx * Lt[0] + ny * Lt[1] + nz * Lt[2]) / (nl * Ll));
    const rr = Math.min(255, t[9] * lam), gg = Math.min(255, t[10] * lam), bb = Math.min(255, t[11] * lam);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(Wd - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const a0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
      const a1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      const a2 = 1 - a0 - a1;
      if (a0 < -1e-6 || a1 < -1e-6 || a2 < -1e-6) continue;
      const z = a0 * az + a1 * bz + a2 * cz, i = y * Wd + x;
      if (z <= zb[i]) continue;
      zb[i] = z; img[i * 3] = rr; img[i * 3 + 1] = gg; img[i * 3 + 2] = bb;
    }
  }
  const o = new Uint8Array(img);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < Wd - 1; x++) {
    const i = y * Wd + x, z = zb[i];
    if (!isFinite(z)) continue;
    const jump = Math.max(...[i - 1, i + 1, i - Wd, i + Wd].map(j => isFinite(zb[j]) ? Math.abs(zb[j] - z) : 1));
    if (jump > 0.04) for (let k = 0; k < 3; k++) o[i * 3 + k] = Math.round(img[i * 3 + k] * 0.35);
  }
  // the contacts: a yellow ring each, drawn over everything
  for (const p of P.rings) {
    const x = Math.round((Vw.u(p) - u0) * sc), y = Math.round((w1 - Vw.w(p)) * sc), R = 9;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const rr = Math.hypot(dx, dy); if (rr > R || rr < R - 2.5) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= Wd || Y >= H) continue;
      const i = Y * Wd + X; o[i * 3] = 255; o[i * 3 + 1] = 230; o[i * 3 + 2] = 40;
    }
  }
  const lines = [];
  if (opt('label', null)) lines.push(opt('label'));
  for (const q of P.res) lines.push(q.bay + ' ' + (q.cap != null ? Math.round(q.cap) + ' L ' : '') + (q.ok ? 'FITS' : 'RED: ' + q.why.join('; ')));
  text(o, Wd, H, lines);
  writePNG(OUT + '_' + name + '.png', o, Wd, H);
  console.log('wrote ' + OUT + '_' + name + '.png ' + Wd + 'x' + H);
}
// a 5x7 bitmap font, enough for a caption
const FONT = (() => {
  const g = {
    ' ': '00000000000000000000000000000000000', A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
    D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000', G: '01110100011000010111100011000101111',
    H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001',
    L: '10000100001000010000100001000011111', M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
    P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110',
    T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010',
    X: '10001100010101000100010101000110001', Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
    0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111', 3: '11111000100010000010000011000101110',
    4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110', 6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000',
    8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100', '.': '00000000000000000000000000110001100', ',': '00000000000000000000001100010001000',
    ':': '00000011000110000000011000110000000', ';': '00000011000110000000011000010001000', '-': '00000000000000011111000000000000000', '(': '00010001000100001000010000010000010',
    ')': '01000001000001000010000100010001000', '/': '00000000010001000100010001000000000', '=': '00000000001111100000111110000000000', '%': '11000110010001000100010001001100011',
    '+': '00000001000010011111001000010000000', "'": '00100001000100000000000000000000000', '_': '00000000000000000000000000000011111', '<': '00010001000100010000010000010000010',
    '>': '01000001000001000001000100010001000', '|': '00100001000010000100001000010000100',
  };
  return g;
})();
function text(o, Wd, H, lines) {
  const S = 2, CW = 6 * S, LH = 9 * S;
  lines.forEach((ln, li) => {
    const s = String(ln).toUpperCase();
    const y0 = 10 + li * LH;
    for (let y = y0 - 2; y < y0 + LH - 2 && y < H; y++) for (let x = 8; x < Math.min(Wd, 12 + s.length * CW); x++) { const i = y * Wd + x; o[i * 3] = o[i * 3] >> 2; o[i * 3 + 1] = o[i * 3 + 1] >> 2; o[i * 3 + 2] = o[i * 3 + 2] >> 2; }
    [...s].forEach((ch, ci) => {
      const g = FONT[ch] || FONT[' '];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '1')
        for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
          const X = 10 + ci * CW + c * S + b, Y = y0 + r * S + a; if (X >= Wd || Y >= H) continue;
          const i = Y * Wd + X; o[i * 3] = 240; o[i * 3 + 1] = 240; o[i * 3 + 2] = 240;
        }
    });
  });
}
function writePNG(file, rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
for (const n of VIEWS) view(n);
