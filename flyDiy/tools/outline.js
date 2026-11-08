#!/usr/bin/env node
// outline.js - THE BUILD'S OUTLINES, MEASURED (the user, 5 Nov, the Super Petrel: "render the outlines and ensure that
// your global dimensions match the blueprints ... Use the blueprints, do that carefully"). A TOOL, not a gate.
//
// The build goes through the page's own load door, as tools/quick_view.js does (_load_build.js --child with the quick
// view's probe: every visible mesh of the editor's scene, world space, metres); the triangles are projected
// ORTHOGRAPHICALLY into the three views - side (z forward to the right, y up), top (z, x), front (x, y) - filled as
// silhouettes on a 0.5 m grid, the extents printed on each, and a TARGET's outlines (the blueprint, as polylines in
// metres in the same axes) drawn over in red when one is given.
//
//   node tools/outline.js build.json [--out=file.png] [--target=target.json] [--ppm=110]
//
//   target.json  { "name": "...", "side": [[ [z,y], ... ], ...], "top": [...], "front": [...],
//                  "dims": { "length": 6.25, "span": 8.9, ... } }  - polylines in the view's own axes; any view may be
//                  absent. z is measured from the build's own aft-most point (the tail) unless "zFrom": "bow".
// Prints the build's measured dimensions (overall, and per view the silhouette's extents) as JSON on stdout.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const T = __dirname;
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const file = argv.find(a => !a.startsWith('--'));
if (!file) { console.error('usage: node tools/outline.js build.json [--out=file.png] [--target=target.json]'); process.exit(2); }
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const spec = j.spec && typeof j.spec === 'object' ? j.spec : j;
const tmp = path.join(os.tmpdir(), 'outline_' + process.pid + '.json'), fd = fs.openSync(tmp, 'w');
require('child_process').spawnSync(process.execPath, ['--max-old-space-size=4096', path.join(T, '_load_build.js'), '--child'],
  { input: JSON.stringify(spec), stdio: ['pipe', fd, 'pipe'], cwd: path.join(T, '..'), encoding: 'utf8',
    env: Object.assign({}, process.env, { FLYDIY_JOIN_PROBE: path.join(T, '_quick_view_probe.js') }) });
fs.closeSync(fd);
let P = null;
try { const s = fs.readFileSync(tmp, 'utf8'); P = JSON.parse(s.slice(s.indexOf('\u0001') + 1)).probe; } catch (e) {}
try { fs.unlinkSync(tmp); } catch (e) {}
if (!P || !P.V) { console.error('outline: no scene from the load door'); process.exit(1); }
const V = Float64Array.from(P.V, x => x / 1e4), I = P.I, C = P.C;
const nV = V.length / 3, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], V[i * 3 + k]); hi[k] = Math.max(hi[k], V[i * 3 + k]); }
const tgt = opt('target') ? JSON.parse(fs.readFileSync(opt('target'), 'utf8')) : null;
const PPM = +opt('ppm', 110), PAD = 0.4;
// the views: [name, horizontal axis, its sign, vertical axis]
const VIEWS = [['side', 2, 1, 1], ['top', 2, 1, 0], ['front', 0, 1, 1]];
// x from the centreline, z from the tail, y from the lowest point - or, for a target that says yFrom 'keel', from the
// lowest point within 0.15 m of the centreline (a boat's keel: floats and wheels hang lower)
let yKeel = Infinity;
for (let i = 0; i < nV; i++) if (Math.abs(V[i * 3] - 0.5 * (lo[0] + hi[0])) < 0.15) yKeel = Math.min(yKeel, V[i * 3 + 1]);
const zero = { 0: 0.5 * (lo[0] + hi[0]), 1: (tgt0 => tgt0 && tgt0.yFrom === 'keel' && isFinite(yKeel) ? yKeel : lo[1])(opt('target') ? JSON.parse(fs.readFileSync(opt('target'), 'utf8')) : null), 2: lo[2] };
const svgViews = [], meas = { overall: { length: +(hi[2] - lo[2]).toFixed(3), span: +(hi[0] - lo[0]).toFixed(3), height: +(hi[1] - lo[1]).toFixed(3) } };
for (const [name, ha, hs, va] of VIEWS) {
  const h0 = lo[ha] - zero[ha] - PAD, h1 = hi[ha] - zero[ha] + PAD, v0 = lo[va] - zero[va] - PAD, v1 = hi[va] - zero[va] + PAD;
  const W = Math.ceil((h1 - h0) * PPM), H = Math.ceil((v1 - v0) * PPM);
  const img = new Uint8Array(W * H * 3).fill(255), dep = new Float32Array(W * H).fill(-Infinity);
  const da = 3 - ha - va;                                       // the depth axis (nearest drawn on top)
  const dsg = name === 'side' ? 1 : name === 'top' ? 1 : 1;     // side from +x, top from +y, front from +z
  const px = (h) => (h - h0) * PPM, py = (v) => (v1 - v) * PPM;
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const P3 = [a, b, c].map(i => [px(V[i * 3 + ha] - zero[ha]), py(V[i * 3 + va] - zero[va]), dsg * V[i * 3 + da]]);
    // flat Lambert from the triangle's own normal (two-sided), a light from over the viewer's left shoulder
    const ax = V[a * 3], ay = V[a * 3 + 1], az = V[a * 3 + 2];
    const ux = V[b * 3] - ax, uy = V[b * 3 + 1] - ay, uz = V[b * 3 + 2] - az, wx = V[c * 3] - ax, wy = V[c * 3 + 1] - ay, wz = V[c * 3 + 2] - az;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const Lt = name === 'side' ? [0.35, 0.6, 0.72] : name === 'top' ? [0.3, 0.9, 0.3] : [0.35, 0.6, 0.72];
    const nd = [nx, ny, nz], Ld = [0, 0, 0]; Ld[ha] = Lt[0] * -1; Ld[va] = Lt[1]; Ld[da] = Lt[2];
    const shade = 0.38 + 0.62 * Math.abs(nd[0] * Ld[0] + nd[1] * Ld[1] + nd[2] * Ld[2]) / Math.hypot(Ld[0], Ld[1], Ld[2]);
    const col = [C[a * 4] * shade, C[a * 4 + 1] * shade, C[a * 4 + 2] * shade].map(x => Math.max(0, Math.min(255, x | 0)));
    const xs = P3.map(p => p[0]), ys = P3.map(p => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    const [A, B, Cc] = P3, den = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]);
    if (Math.abs(den) < 1e-12) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const l1 = ((B[1] - Cc[1]) * (x + 0.5 - Cc[0]) + (Cc[0] - B[0]) * (y + 0.5 - Cc[1])) / den;
      const l2 = ((Cc[1] - A[1]) * (x + 0.5 - Cc[0]) + (A[0] - Cc[0]) * (y + 0.5 - Cc[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const d = l1 * A[2] + l2 * B[2] + l3 * Cc[2], k = y * W + x;
      if (d < dep[k]) continue;
      dep[k] = d; img[k * 3] = col[0]; img[k * 3 + 1] = col[1]; img[k * 3 + 2] = col[2];
    }
  }
  // the silhouette's extents in this view, and its upper / lower boundary per column (the side view's keel and deck)
  let e = { h: [Infinity, -Infinity], v: [Infinity, -Infinity] };
  for (let i = 0; i < nV; i++) { const h = V[i * 3 + ha] - zero[ha], v = V[i * 3 + va] - zero[va];
    e.h[0] = Math.min(e.h[0], h); e.h[1] = Math.max(e.h[1], h); e.v[0] = Math.min(e.v[0], v); e.v[1] = Math.max(e.v[1], v); }
  meas[name] = { h: e.h.map(x => +x.toFixed(3)), v: e.v.map(x => +x.toFixed(3)) };
  // PNG (zlib, filter 0 per row)
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const zl = require('zlib'), crcT = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (tp, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(tp), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zl.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  // the SVG view: the raster, the 0.5 m grid (1 m darker), the extents, the target in red
  let g = '';
  for (let m = Math.ceil(h0 * 2) / 2; m <= h1; m += 0.5) g += `<line x1="${px(m)}" y1="0" x2="${px(m)}" y2="${H}" stroke="${Math.abs(m % 1) < 1e-6 ? '#8aa' : '#cdd'}" stroke-width="1"/>` + (Math.abs(m % 1) < 1e-6 ? `<text x="${px(m) + 2}" y="${H - 4}" font-size="11" fill="#577">${m.toFixed(0)}</text>` : '');
  for (let m = Math.ceil(v0 * 2) / 2; m <= v1; m += 0.5) g += `<line x1="0" y1="${py(m)}" x2="${W}" y2="${py(m)}" stroke="${Math.abs(m % 1) < 1e-6 ? '#8aa' : '#cdd'}" stroke-width="1"/>` + (Math.abs(m % 1) < 1e-6 ? `<text x="2" y="${py(m) - 2}" font-size="11" fill="#577">${m.toFixed(0)}</text>` : '');
  let tg = '';
  const zShift = tgt && tgt.zFrom === 'bow' ? (hi[2] - lo[2]) : 0;   // a target measured from the bow: z = length - its own
  if (tgt && Array.isArray(tgt[name])) for (const pl of tgt[name]) {
    const pts = pl.map(([h, v]) => `${px((ha === 2 && zShift ? zShift - h : h)).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    tg += `<polyline points="${pts}" fill="none" stroke="#d22" stroke-width="2"/>`;
  }
  const lab = `${name}: ${(e.h[1] - e.h[0]).toFixed(2)} x ${(e.v[1] - e.v[0]).toFixed(2)} m`;
  svgViews.push({ W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 18}"><rect width="100%" height="100%" fill="#fff"/>` +
    `<image href="data:image/png;base64,${png.toString('base64')}" x="0" y="0" width="${W}" height="${H}" opacity="0.92"/>${g}${tg}` +
    `<text x="6" y="${H + 14}" font-size="13" font-family="monospace" fill="#123">${lab}</text></svg>` });
}
console.log(JSON.stringify(meas));
const out = opt('out');
if (out) {
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff;font-family:monospace">` +
    `<div style="padding:6px 10px;font-size:13px">${path.basename(file)}: overall ${meas.overall.length} m long, ${meas.overall.span} m span, ${meas.overall.height} m high` +
    (tgt && tgt.dims ? ` &nbsp;|&nbsp; <span style="color:#d22">target ${tgt.name || ''}: ${Object.entries(tgt.dims).map(([k, v]) => k + ' ' + v).join(', ')}</span>` : '') + `</div>` +
    `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:6px">${svgViews.map(v => v.svg).join('')}</div></body>`;
  const htmlF = out.replace(/\.png$/, '') + '.html';
  fs.writeFileSync(htmlF, html);
  if (/\.png$/.test(out)) {
    const { chromium } = require('playwright');
    (async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1600, height: 900 } });
      await pg.goto('file://' + path.resolve(htmlF)); await pg.screenshot({ path: out, fullPage: true }); await b.close(); })();
  }
}
