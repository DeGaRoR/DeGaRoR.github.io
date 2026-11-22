// GARAGE-VIEW: a small PNG reader / writer for the cook's pictures (8-bit, RGB or RGBA or grey, not interlaced: what a
// canvas writes and what these tools write). No dependency: zlib is node's.
'use strict';
const zlib = require('zlib');
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

// -> { w, h, ch (channels of data: 1, 3 or 4), data: Uint8Array (rows top to bottom) }
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('png: not a PNG');
  let p = 8, w = 0, h = 0, bd = 0, ct = 0, il = 0, pal = null; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; }
    else if (type === 'PLTE') pal = d; else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
    p += 12 + len; }
  if (bd !== 8 || il) throw new Error('png: only 8-bit, not interlaced (bit depth ' + bd + ', interlace ' + il + ')');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error('png: colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w * ch, out = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], o = y * st, r = y * (st + 1) + 1;
    for (let x = 0; x < st; x++) { const a = x >= ch ? out[o + x - ch] : 0, b = y ? out[o - st + x] : 0, c = (x >= ch && y) ? out[o - st + x - ch] : 0; let v = raw[r + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; }
      out[o + x] = v & 255; } }
  if (ct === 3) { const o = new Uint8Array(w * h * 3); for (let i = 0; i < w * h; i++) { o[i * 3] = pal[out[i] * 3]; o[i * 3 + 1] = pal[out[i] * 3 + 1]; o[i * 3 + 2] = pal[out[i] * 3 + 2]; } return { w, h, ch: 3, data: o }; }
  if (ct === 4) { const o = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = out[i * 2]; o[i * 4 + 3] = out[i * 2 + 1]; } return { w, h, ch: 4, data: o }; }
  return { w, h, ch, data: out };
}
// data: w * h * ch bytes (ch 1 grey, 3 RGB, 4 RGBA), rows top to bottom
function encode(w, h, ch, data, level) {
  const st = w * ch, raw = Buffer.alloc((st + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (st + 1)] = 0; Buffer.from(data.buffer, data.byteOffset + y * st, st).copy(raw, y * (st + 1) + 1); }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = { 1: 0, 3: 2, 4: 6 }[ch];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: level === undefined ? 6 : level })), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { decode, encode };
