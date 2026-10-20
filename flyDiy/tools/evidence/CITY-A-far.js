#!/usr/bin/env node
// CITY-A-far.js — EVIDENCE for the cooked town (CITY-A, G3400-G3414): what the pack's FAR cells and NEAR rows look like,
// drawn in node by a small software rasteriser off the committed pack's own bytes (the cloud cannot render the game).
// Flat-shaded, no textures, no fog: it is there to judge where things stand and what shape the far town has, not the look.
//
//   node tools/evidence/CITY-A-far.js [--out DIR]       (default DIR: reports/evidence/CITY-A)
//
// Writes:
//   town_far.png     the whole town, far cells only (walls, roofs, roads, lots), an oblique view from the south-east
//   cell_near.png    the busiest cell, two panes on one camera: LEFT its far mesh (the 2 draws), RIGHT its kit rows at lod 1
//                    (the archetypes off the kit pack, the row's transform, mirror, stretch and stance as townkit.js draws
//                    them) on the same ground bucket - the far shells must sit where the houses do
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..');
const CC = require(path.join(ROOT, 'tools', 'city_cook.js'));

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUTDIR = path.resolve(arg('--out', path.join(ROOT, 'reports', 'evidence', 'CITY-A')));

// ---- the pack, decoded -------------------------------------------------------------------------------------------
const man = JSON.parse(fs.readFileSync(CC.OUT, 'utf8'));
const town = man.towns[0];
const cells = town.cells.map(c => Object.assign({ m: c }, CC.decodeCell(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, c.src))))));
function farTris(C, buckets) {
  const H = C.head, b = H.box, out = [];
  const vb = C.vb, ib = C.ib, wide = H.far.index === 32;
  const V = n => { const o = n * 12; return { p: [b[0] + vb.readUInt16LE(o) / 65535 * (b[3] - b[0]), b[1] + vb.readUInt16LE(o + 2) / 65535 * (b[4] - b[1]), b[2] + vb.readUInt16LE(o + 4) / 65535 * (b[5] - b[2])], c: [vb[o + 8], vb[o + 9], vb[o + 10]], k: vb[o + 11] }; };
  for (const B of H.far.buckets) {
    if (buckets && buckets.indexOf(B.name) < 0) continue;
    for (let t = B.first; t < B.first + B.count; t += 3) {
      const ix = k => (wide ? ib.readUInt32LE((t + k) * 4) : ib.readUInt16LE((t + k) * 2));
      const a = V(ix(0)), c = V(ix(1)), d = V(ix(2));
      out.push({ p: [a.p, c.p, d.p], c: a.c, k: a.k });
    }
  }
  return out;
}
// the kit rows at lod 1, as townkit.js stands them
const K = CC.kitOf();
function kitTris(C) {
  const T = K.TK.decodeInstances(C.kit), BAGS = K.BAGS, out = [];
  const roof = new Set(['roof', 'roof2', 'roof3', 'rib'].map(k => BAGS.indexOf(k)));
  const wallR = new Set(['siding', 'siding2', 'siding3', 'log', 'logend'].map(k => BAGS.indexOf(k)));
  const glass = new Set(['glass', 'pane'].map(k => BAGS.indexOf(k)));
  for (const r of T.rows) {
    const L = K.lods[r.arch], A = K.H.archetypes[r.arch], c = Math.cos(r.yaw), s = Math.sin(r.yaw), sx = (r.mirror ? -1 : 1) * r.scale;
    const Lh = A.foot.L * r.scale / 2, Wh = A.foot.w / 2, g = r.ground;
    const fs0 = K.H.finishSets[r.finish] || {};
    const wallC = r.wallCol > 0 ? hexRGB(COLS[r.wallCol]) : (CC.MEANS[K.H.roleSets.wall[fs0.wallSet]] || [0, 128, 120, 108]).slice(1);
    const roofC = r.roofCol > 0 ? hexRGB(COLS[r.roofCol]) : (CC.MEANS[K.H.roleSets.roof[fs0.roofSet]] || [0, 84, 84, 82]).slice(1);
    const P = i => {
      let x = L.pos[i * 3] * sx, y = L.pos[i * 3 + 1], z = L.pos[i * 3 + 2];
      // the stance: the bilinear of the four corners' ground (0 (-,-) 1 (+,-) 2 (+,+) 3 (-,+)) in the drawn frame
      const u = Math.max(0, Math.min(1, x / (2 * Lh) + 0.5)), v = Math.max(0, Math.min(1, z / (2 * Wh) + 0.5));
      const gy = (g[0] * (1 - u) + g[1] * u) * (1 - v) + (g[3] * (1 - u) + g[2] * u) * v;
      y += L.stance[i] * gy;
      return [r.x + x * c + z * s, r.y + y, r.z - x * s + z * c];
    };
    for (let t = 0; t < L.idx.length; t += 3) {
      const role = L.role[L.idx[t]];
      const col = roof.has(role) ? roofC : wallR.has(role) ? wallC : glass.has(role) ? [60, 70, 80] : [150, 145, 135];
      out.push({ p: [P(L.idx[t]), P(L.idx[t + 1]), P(L.idx[t + 2])], c: col, k: 0 });
    }
  }
  return out;
}
const COLS = (() => { const src = fs.readFileSync(path.join(ROOT, 'tools', '_house_gen.js'), 'utf8'), a = src.indexOf('const COLS = ['), b = src.indexOf('];', a), o = [], re = /\['([^']+)', 0x([0-9a-fA-F]{6})\]/g; let m; while ((m = re.exec(src.slice(a, b)))) o.push(parseInt(m[2], 16)); return o; })();
function hexRGB(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }

// ---- the rasteriser: orthographic, a z-buffer, a sun ------------------------------------------------------------
function raster(W, H, tris, view, img, zb, x0) {
  const sun = (() => { const v = [-0.4, 0.8, 0.45], l = Math.hypot(...v); return v.map(t => t / l); })();
  for (const t of tris) {
    const q = t.p.map(view);
    const [a, b, c] = t.p;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if (ny < 0 && t.k >= 2) { nx = -nx; ny = -ny; nz = -nz; }
    const lam = Math.abs(nx * sun[0] + ny * sun[1] + nz * sun[2]), sh = t.k >= 2 ? 0.75 + 0.25 * lam : 0.45 + 0.6 * lam;
    const col = t.c.map(v => Math.min(255, v * sh));
    const area = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    const bx0 = Math.max(x0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), bx1 = Math.min(x0 + W - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
    const by0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), by1 = Math.min(H - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const sx = px + 0.5, sy = py + 0.5;
      const w0 = ((q[1][0] - sx) * (q[2][1] - sy) - (q[2][0] - sx) * (q[1][1] - sy)) / area, w1 = ((q[2][0] - sx) * (q[0][1] - sy) - (q[0][0] - sx) * (q[2][1] - sy)) / area, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * q[0][2] + w1 * q[1][2] + w2 * q[2][2] + (t.k >= 2 ? -0.02 : 0), o = py * img.W + px;
      if (z <= zb[o]) continue;
      zb[o] = z; img.d[o * 3] = col[0]; img.d[o * 3 + 1] = col[1]; img.d[o * 3 + 2] = col[2];
    }
  }
}
function canvas(W, H) { const d = new Uint8Array(W * H * 3); for (let i = 0; i < W * H; i++) { d[i * 3] = 205; d[i * 3 + 1] = 214; d[i * 3 + 2] = 222; } return { W, H, d }; }
function viewOf(cx, cy, cz, yawDeg, pitchDeg, scale, ox, oy) {
  const ya = yawDeg * Math.PI / 180, pa = pitchDeg * Math.PI / 180, cyw = Math.cos(ya), syw = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
  return p => { const x = p[0] - cx, y = p[1] - cy, z = p[2] - cz; const X = x * cyw - z * syw, Z0 = x * syw + z * cyw; return [ox + X * scale, oy - (y * cp - Z0 * sp) * scale, y * sp + Z0 * cp]; };
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function png(img) {
  const { W, H, d } = img, row = W * 3 + 1, raw = Buffer.alloc(row * H);
  for (let y = 0; y < H; y++) { raw[y * row] = 0; Buffer.from(d.buffer, d.byteOffset + y * W * 3, W * 3).copy(raw, y * row + 1); }
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- the two sheets ----------------------------------------------------------------------------------------------
fs.mkdirSync(OUTDIR, { recursive: true });
{
  const all = [].concat(...cells.map(C => farTris(C)));
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity;
  for (const t of all) for (const p of t.p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); y0 = Math.min(y0, p[1]); }
  const W = 2000, H = 1200, img = canvas(W, H), zb = new Float32Array(W * H).fill(-Infinity);
  // frame the projected town: project once at scale 1, then fit and centre
  const v1 = viewOf((x0 + x1) / 2, y0, (z0 + z1) / 2, -25, 35, 1, 0, 0);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const t of all) for (const p of t.p) { const q = v1(p); a0 = Math.min(a0, q[0]); a1 = Math.max(a1, q[0]); b0 = Math.min(b0, q[1]); b1 = Math.max(b1, q[1]); }
  const sc = Math.min(W / (a1 - a0), H / (b1 - b0)) * 0.94;
  raster(W, H, all, viewOf((x0 + x1) / 2, y0, (z0 + z1) / 2, -25, 35, sc, W / 2 - (a0 + a1) / 2 * sc, H / 2 - (b0 + b1) / 2 * sc), img, zb, 0);
  fs.writeFileSync(path.join(OUTDIR, 'town_far.png'), png(img));
  console.log('town_far.png  ' + all.length + ' far triangles over ' + cells.length + ' cells (' + Math.round(x1 - x0) + ' x ' + Math.round(z1 - z0) + ' m)');
}
{
  const C = cells.slice().sort((a, b) => b.head.kit.rows - a.head.kit.rows)[0];
  const far = farTris(C), ground = farTris(C, ['roads', 'lots']), kit = kitTris(C).concat(ground);
  // the camera: the cell's busiest 200 m round its rows' mean
  const T = K.TK.decodeInstances(C.kit);
  let mx = 0, mz = 0, my = 0; for (const r of T.rows) { mx += r.x; mz += r.z; my += r.y; } mx /= T.rows.length; mz /= T.rows.length; my /= T.rows.length;
  const W = 1100, H = 900, img = canvas(2 * W, H), zb = new Float32Array(2 * W * H).fill(-Infinity), sc = W / 260;
  const near = t => t.p.some(p => Math.abs(p[0] - mx) < 170 && Math.abs(p[2] - mz) < 170);
  raster(W, H, far.filter(near), viewOf(mx, my, mz, -25, 40, sc, W / 2, H / 2), img, zb, 0);
  raster(W, H, kit.filter(near), viewOf(mx, my, mz, -25, 40, sc, W + W / 2, H / 2), img, zb, W);
  fs.writeFileSync(path.join(OUTDIR, 'cell_near.png'), png(img));
  console.log('cell_near.png  cell ' + C.head.cell.join(',') + ': far ' + far.length + ' tris in ' + C.head.far.draws.length + ' draws | near ' + T.rows.length + ' kit rows, ' + (kit.length - ground.length) + ' lod-1 tris');
}
console.log('wrote ' + path.relative(process.cwd(), OUTDIR));
