// array_cook.js - THE OFFLINE TEXTURE-ARRAY COOK (G910, AS2; futureDesigns/ASSETS-2026-09-27.md §5.3 M7).
//
// A page used to assemble its texture arrays at run time: every map fetched as a JPEG, decoded, drawn
// into a 2D canvas, read back with getImageData and shuffled channel by channel into a Uint8Array
// (pavement.js library(), splat_ground.js buildArrays: ~130 images at the roll-out). This does that
// ONCE, here, and writes each layer entry as a file the page only has to fetch and hand to the GPU.
//
// GENERIC ON PURPOSE: the ground library (tools/ground_tex_prep.js) is the first user; C2c's TARR arrays
// (house_tarr.js builds its arrays from a wish list today) are meant to be the second, with their own
// packing. A layer entry is a list of PLANES, each plane px x px RGBA8, each of its four channels taken
// from one channel of one source image or a constant:
//
//   cookLayers({ sub: 'tex/ground', px: 512, entries: [
//     { stem: 'grass_layers_512', planes: [
//         [{ img: diff, ch: 0 }, { img: diff, ch: 1 }, { img: diff, ch: 2 }, { img: height, ch: 0, or: 128 }],
//         [{ img: nor, ch: 0 }, { img: nor, ch: 1 }, { img: nor, ch: 2 }, { img: rough, ch: 0, or: 230 }] ] } ] })
//   -> { grass_layers_512: 'media/tex/ground/grass_layers_512.<h8>.gz.bin' }
//
// `img` is a file path (or null: the channel takes `or`, a byte). The file holds the planes one after the
// other, raw (px * px * 4 bytes each), as ONE gzip stream named by the hash of the RAW bytes
// (tools/_media_lib.js writeMedia 'gz.bin'): the page's ASSET_FETCH gunzips it by the suffix, and a gate
// re-hashes the gunzipped bytes against the name.
//
// AND KTX2 (AS3, G916): an entry may ask for KTX2 files of its planes - `ktx2: [{ plane, stem, role, opts }]` -
// each plane encoded by tools/_ktx2_lib.js in a media_lib role (ktx2-color / ktx2-normal / ktx2-data) with its mips
// in the file, and named by its INPUT (the plane's texels + the role's settings + the encoder's version: ktx2Name),
// so a re-bake of unchanged texels writes nothing whatever basisu build the box has, and GATE KTX2 re-derives every
// name from the raw planes. The page transcodes them in workers and stacks the layers into a compressed array
// (src/viewer/ground_lib.js); the raw file stays the fallback (no workers, no WebAssembly, no compressed format,
// ?ktx2=0). -> { stem: raw rel }, and out.ktx2[stem] = { <ktx2 stem>: rel }.
//
// THE DECODE IS THE BROWSER'S, BYTE FOR BYTE: tools/media_lib.py decode_rgba (Pillow's libjpeg-turbo, the
// same ISLOW IDCT and fancy upsampling Chromium decodes with; no colour management - an ICC profile is
// refused). Verified on the ground's 261 maps against headless Chromium's canvas, 0 differ (HANDOVER
// G910), and every source must already be px x px: a canvas drawImage that RESAMPLES cannot be
// reproduced exactly offline, so the cook refuses rather than guess.
'use strict';
const zlib = require('zlib');
const fs = require('fs'), path = require('path');
const { writeMedia, decodeRGBA, readGeo, MEDIA } = require('./_media_lib.js');

// the planes of one entry, from decoded images (a Map path -> { w, h, data }) -> one Buffer
function packEntry(entry, px, dec) {
  const S = px * px * 4, out = Buffer.alloc(S * entry.planes.length);
  entry.planes.forEach((plane, p) => {
    if (plane.length !== 4) throw new Error(`array_cook: ${entry.stem} plane ${p} has ${plane.length} channels, not 4`);
    const o = p * S;
    for (let c = 0; c < 4; c++) {
      const src = plane[c];
      const im = src.img ? dec.get(src.img) : null;
      if (im) {
        const d = im.data, k = src.ch | 0;
        for (let q = 0; q < px * px; q++) out[o + q * 4 + c] = d[q * 4 + k];
      } else {
        if (src.img && !src.optional) throw new Error(`array_cook: ${entry.stem}: ${src.img} did not decode`);
        const v = src.or === undefined ? 0 : src.or | 0;
        for (let q = 0; q < px * px; q++) out[o + q * 4 + c] = v;
      }
    }
  });
  return out;
}

// decode every source once (one python process), checking the size
function decodeAll(entries, px) {
  const files = [...new Set(entries.flatMap(e => e.planes.flat().map(s => s.img).filter(Boolean)))];
  const dec = new Map();
  if (!files.length) return dec;
  const res = decodeRGBA(files);
  files.forEach((f, i) => {
    const r = res[i];
    if (r.w !== px || r.h !== px) throw new Error(`array_cook: ${f} is ${r.w} x ${r.h}, not ${px} x ${px} - a resample is the page's canvas's, not reproducible offline`);
    dec.set(f, r);
  });
  return dec;
}

// cook and write -> { stem: page-relative path }; opts.dry: name only, write nothing
function cookLayers({ sub, px, entries, dry, log }) {
  const dec = decodeAll(entries, px);
  const out = {}, S = px * px * 4;
  Object.defineProperty(out, 'ktx2', { value: {}, enumerable: false });
  Object.defineProperty(out, 'encoded', { value: 0, writable: true, enumerable: false });
  for (const e of entries) {
    const raw = packEntry(e, px, dec);
    out[e.stem] = dry ? require('./_media_lib.js').mediaRel(sub, e.stem, 'gz.bin', raw) : writeMedia(sub, e.stem, 'gz.bin', raw);
    if (!e.ktx2) continue;
    const K = require('./_ktx2_lib.js'), got = out.ktx2[e.stem] = {};
    for (const k of e.ktx2) {
      const plane = raw.subarray(k.plane * S, (k.plane + 1) * S);
      const rel = `media/${sub}/${K.ktx2Name(k.stem, plane, px, px, k.role, k.opts)}`;
      const abs = path.join(MEDIA, '..', ...rel.split('/'));
      if (!dry && !fs.existsSync(abs)) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, K.encodeRGBA(plane, px, px, k.role, k.opts));
        out.encoded++;
        if (log) log(rel);
      }
      got[k.stem] = rel;
    }
  }
  return out;
}

// the node twin of the page's read: a cooked file -> its planes (Buffers of px * px * 4)
function readLayers(rel, px, planes) {
  const b = Buffer.from(readGeo(rel)), S = px * px * 4;
  if (b.length !== S * planes) throw new Error(`array_cook: ${rel} holds ${b.length} bytes, not ${planes} planes of ${px}^2`);
  return Array.from({ length: planes }, (_, p) => b.subarray(p * S, (p + 1) * S));
}

module.exports = { cookLayers, packEntry, decodeAll, readLayers, gunzip: zlib.gunzipSync };
