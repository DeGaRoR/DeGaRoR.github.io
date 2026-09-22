#!/usr/bin/env node
// fog_diff.js - the pixel difference between two shots of the sheet (GATE FOG's instrument).
// The PNG reader is postfx_shot.js's, lifted verbatim (zlib + the filters, no dependency).
'use strict';
const fs = require('fs'), zlib = require('zlib'), path = require('path');
function pngPixels(file) {
  const buf = fs.readFileSync(file); let p = 8, w = 0, h = 0, idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || (d[9] !== 6 && d[9] !== 2)) throw new Error('png: not 8-bit RGB/RGBA'); }
    if (type === 'IDAT') idat.push(d); if (type === 'IEND') break; p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = 4, stride = w * ch, out = Buffer.alloc(h * stride); let q = 0;
  for (let y = 0; y < h; y++) { const f = raw[q++]; const row = raw.slice(q, q + stride); q += stride;
    for (let x = 0; x < stride; x++) { const a = x >= ch ? out[y * stride + x - ch] : 0, b = y > 0 ? out[(y - 1) * stride + x] : 0, c = (x >= ch && y > 0) ? out[(y - 1) * stride + x - ch] : 0; let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[y * stride + x] = v & 255; } }
  return { w, h, px: out };
}
function diff(a, b) {
  const A = pngPixels(a), B = pngPixels(b);
  if (A.w !== B.w || A.h !== B.h) return { error: 'sizes differ' };
  let n = 0, max = 0, sum = 0, over8 = 0;
  for (let i = 0; i < A.px.length; i += 4) for (let k = 0; k < 3; k++) {
    const d = Math.abs(A.px[i + k] - B.px[i + k]);
    if (d) { if (k === 0) n++; sum += d; if (d > max) max = d; if (d > 8) over8++; } }
  return { pixels: A.w * A.h, differingPx: n, pctPx: +(100 * n / (A.w * A.h)).toFixed(2), maxDelta: max, meanDeltaOverDiffering: n ? +(sum / (n * 3)).toFixed(2) : 0, channelsOver8: over8 };
}
// THE TILE MEAN (GATE FOG's real measure). A whole-frame pixel diff cannot judge a distance
// cut: the world ANIMATES - water, propeller, foliage, the cloud noise - so two IDENTICAL
// configurations differ in ~49 % of pixels even with the clock stopped and the drift off
// (FOG-MIST SS1f). A ripple moves a pixel; it does not move the MEAN of the 32x18 tile it sits
// in. A missing ridge does. So the gate compares tile means and takes the worst tile.
function tiles(file, NX, NY) {
  const A = pngPixels(file), tw = A.w / NX, th = A.h / NY, out = new Float64Array(NX * NY);
  for (let ty = 0; ty < NY; ty++) for (let tx = 0; tx < NX; tx++) {
    let sum = 0, n = 0;
    for (let y = Math.floor(ty * th); y < Math.floor((ty + 1) * th); y++)
      for (let x = Math.floor(tx * tw); x < Math.floor((tx + 1) * tw); x++) {
        const i = (y * A.w + x) * 4;
        sum += 0.2126 * A.px[i] + 0.7152 * A.px[i + 1] + 0.0722 * A.px[i + 2]; n++; }
    out[ty * NX + tx] = sum / n; }
  return out;
}
function tileDiff(a, b, NX = 32, NY = 18) {
  const A = tiles(a, NX, NY), B = tiles(b, NX, NY);
  let max = 0, sum = 0, over2 = 0, worst = -1;
  for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); sum += d; if (d > 2) over2++; if (d > max) { max = d; worst = i; } }
  return { tiles: A.length, maxTileDelta: +max.toFixed(2), worstTile: '(' + (worst % NX) + ',' + (worst / NX | 0) + ')',
           meanTileDelta: +(sum / A.length).toFixed(2), tilesOver2: over2 };
}

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: node fog_diff.js <a.png> <b.png>'); process.exit(2); }
console.log(path.basename(a) + ' vs ' + path.basename(b));
console.log('  pixels: ' + JSON.stringify(diff(a, b)));
console.log('  tiles : ' + JSON.stringify(tileDiff(a, b)));
