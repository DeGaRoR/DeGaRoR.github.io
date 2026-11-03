#!/usr/bin/env node
// png_same.js <dirA> <dirB> - PIXEL IDENTITY of every PNG the two directories both hold (PHONE-EDIT-PERF, 2 Nov: the decal
// loop's early break proved by stills - plane_shot.js before / after). Per file: same size, the count of differing pixels,
// the largest channel difference. Exit 1 when any pixel differs. (The PNG reader is light_shot.js's: 8-bit RGB / RGBA.)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
function readPNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    else if (type === 'IDAT') idat.push(buf.slice(p + 8, p + 8 + len));
    p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], row = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255; }
    cur.copy(out, y * stride); prev = cur; }
  return { w, h, bpp, data: out };
}
const [A, B] = process.argv.slice(2);
if (!A || !B) { console.error('usage: node tools/perf/png_same.js <dirA> <dirB>'); process.exit(2); }
const files = fs.readdirSync(A).filter(f => /\.png$/i.test(f) && fs.existsSync(path.join(B, f)));
let bad = 0;
for (const f of files) {
  const a = readPNG(fs.readFileSync(path.join(A, f))), b = readPNG(fs.readFileSync(path.join(B, f)));
  if (a.w !== b.w || a.h !== b.h || a.bpp !== b.bpp) { console.log(f + ': SIZE ' + a.w + 'x' + a.h + ' vs ' + b.w + 'x' + b.h); bad++; continue; }
  let n = 0, mx = 0;
  for (let i = 0; i < a.w * a.h; i++) { let d = 0; for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(a.data[i * a.bpp + k] - b.data[i * b.bpp + k])); if (d) { n++; if (d > mx) mx = d; } }
  console.log(f + ': ' + (n ? 'DIFFER ' + n + ' px (max channel diff ' + mx + ')' : 'IDENTICAL') + ' ' + a.w + 'x' + a.h);
  if (n) bad++;
}
console.log(files.length + ' file(s), ' + bad + ' differing');
process.exit(bad ? 1 : 0);
