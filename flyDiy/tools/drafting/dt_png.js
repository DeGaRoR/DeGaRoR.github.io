// dt_png.js - a small PNG reader / writer for the drafting table's node side (8-bit gray, gray+alpha, RGB, RGBA;
// no interlace). The page uses the browser's own decoder; this is only for the CLI's overlays.
'use strict';
const zlib = require('zlib');
const CH = { 0: 1, 2: 3, 4: 2, 6: 4 };
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, W = 0, H = 0, ct = 0, bd = 0, il = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || il || !CH[ct]) throw new Error('PNG: 8-bit non-interlaced gray/RGB(A) only');
  const n = CH[ct], raw = zlib.inflateSync(Buffer.concat(idat)), stride = W * n, out = Buffer.alloc(W * H * 4);
  let prev = Buffer.alloc(stride), q = 0;
  for (let y = 0; y < H; y++) {
    const f = raw[q++], line = Buffer.from(raw.slice(q, q + stride)); q += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= n ? line[x - n] : 0, b = prev[x], c = x >= n ? prev[x - n] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; }
      line[x] = v & 255;
    }
    for (let x = 0; x < W; x++) {
      const s = x * n, o = (y * W + x) * 4;
      if (n === 1) { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = 255; }
      else if (n === 2) { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = line[s + 1]; }
      else { out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = n === 4 ? line[s + 3] : 255; }
    }
    prev = line;
  }
  return { W, H, rgba: out };
}
function crc32(b) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < b.length; i++) { c = (crc ^ b[i]) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encode(W, H, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { decode, encode };
