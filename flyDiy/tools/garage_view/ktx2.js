#!/usr/bin/env node
// GARAGE-VIEW, step 4a: THE SCENE'S PICTURES AS KTX2 (the cost: a plain RGBA picture is 4 bytes a texel on the GPU, 5.3 with
// its mips, and is decoded and mipped on the main thread; a KTX2 one is transcoded in a worker to the GPU's own block
// format - 1 byte a texel, its mips inside - a quarter of the memory and nothing on the frame).
//
//   BASISU=<path to basisu> node tools/garage_view/ktx2.js --scene <cook's out dir>
//     every PNG scene.json names gets a twin <stem>.ktx2 (tools/_ktx2_lib.js, the game's own encoder and roles):
//       the near ground       ktx2-color, UASTC (seen from a few metres: every crack of the apron kept; ~1.7 B a texel on the wire)
//       the other ground, the cards, the props, the far band   ktx2-color, ETC1S (~0.3 B a texel on the wire: the whole pavement's
//                             picture is 14 MB as UASTC, 4 as ETC1S; ETC1S's blue lift is in the mips from 16 px down, never drawn here)
//       the cards' normals    ktx2-normal
//     written rows bottom first (the page's image path flips its bitmaps; a compressed texture cannot be flipped at upload),
//     its sides padded to a multiple of 4 by repeating the last row / column (a block format's rule; under 0.1 % of a side).
//     scene.json: textures.<key>.ktx2 = the twin's name. Run BEFORE textures.py (which turns the PNGs into the fallbacks).
'use strict';
const fs = require('fs'), path = require('path');
const PNG = require('./png.js');
const K = require(path.join(__dirname, '..', '_ktx2_lib.js'));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const DIR = opt('scene');
if (!DIR || !fs.existsSync(path.join(DIR, 'scene.json'))) { console.error('usage: ktx2.js --scene <dir with scene.json>'); process.exit(2); }
if (!K.hasEncoder || !K.hasEncoder()) { console.error('ktx2: no basisu v' + K.BASISU_VERSION + ' here (cd flyDiy && npm install, or BASISU=<path>): the scene keeps its plain pictures'); process.exit(3); }
const J = JSON.parse(fs.readFileSync(path.join(DIR, 'scene.json'), 'utf8'));
let wire = 0, gpu = 0, gpu0 = 0;
for (const key of Object.keys(J.textures)) {
  const T = J.textures[key], src = path.join(DIR, T.file); if (!/\.png$/i.test(T.file) || !fs.existsSync(src)) continue;
  const I = PNG.decode(fs.readFileSync(src)), W = Math.ceil(I.w / 4) * 4, H = Math.ceil(I.h / 4) * 4, px = new Uint8Array(W * H * 4), t0 = Date.now();
  // RGBA, padded, the rows bottom first
  for (let y = 0; y < H; y++) { const sy = Math.min(I.h - 1, H - 1 - y); for (let x = 0; x < W; x++) { const sx = Math.min(I.w - 1, x), s = (sy * I.w + sx) * I.ch, d = (y * W + x) * 4;
      if (I.ch >= 3) { px[d] = I.data[s]; px[d + 1] = I.data[s + 1]; px[d + 2] = I.data[s + 2]; px[d + 3] = I.ch === 4 ? I.data[s + 3] : 255; } else { px[d] = px[d + 1] = px[d + 2] = I.data[s]; px[d + 3] = 255; } } }
  const nrm = key === 'trees_nrm', role = nrm ? 'ktx2-normal' : 'ktx2-color', o = nrm ? {} : (key.startsWith('ground_near') || key === 'far' ? { codec: 'uastc' } : {})   /* (far: the skyline's cut - ETC1S blocks its alpha in 4 x 4 stairs) */;
  if (nrm) for (let i = 3; i < px.length; i += 4) px[i] = 255;
  const bytes = K.encodeRGBA(px, W, H, role, o), out = path.basename(T.file, path.extname(T.file)) + '.ktx2';
  fs.writeFileSync(path.join(DIR, out), bytes); T.ktx2 = out; T.ktx2Size = [W, H];
  wire += bytes.length; gpu += W * H * 1.33; gpu0 += I.w * I.h * 4 * 1.33;
  console.log('  ' + key.padEnd(22) + String(W).padStart(5) + ' x ' + String(H).padEnd(5) + ' ' + role + (o.codec ? ' ' + o.codec : '') + '  ' + (bytes.length / 1048576).toFixed(2) + ' MB  ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}
fs.writeFileSync(path.join(DIR, 'scene.json'), JSON.stringify(J));
console.log('ktx2: ' + (wire / 1048576).toFixed(2) + ' MB on the wire; on the GPU about ' + (gpu / 1048576).toFixed(0) + ' MB (plain RGBA with mips: ' + (gpu0 / 1048576).toFixed(0) + ' MB)');
