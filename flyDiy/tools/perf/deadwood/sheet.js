// sheet.js <out.png> <cols comma> <rows comma> <prefix> [scale] - a contact sheet of out2/raw/<prefix><row>_<col>.png, each box-downscaled
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const src = fs.readFileSync(path.join(__dirname, 'match.js'), 'utf8');
eval(src.slice(src.indexOf('function readPNG'), src.indexOf('module.exports')).replace(/^const /gm, 'var '));
const [OUTF, COLS, ROWS, PRE, SC] = process.argv.slice(2); const cols = COLS.split(','), rows = ROWS.split(','), s = +(SC || 3), gap = 8;
let W = 0, H = 0, cw = 0, chh = 0; const tiles = [];
for (const r of rows) for (const c of cols) { const I = readPNG(fs.readFileSync(`out2/raw/${PRE}${r}_${c}.png`)); cw = Math.floor(I.w / s); chh = Math.floor(I.h / s); tiles.push(I); }
W = cols.length * cw + (cols.length - 1) * gap; H = rows.length * chh + (rows.length - 1) * gap;
const rgb = Buffer.alloc(W * H * 3, 255);
tiles.forEach((I, t) => { const ci = t % cols.length, ri = Math.floor(t / cols.length), ox = ci * (cw + gap), oy = ri * (chh + gap);
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) { let a = [0, 0, 0];
    for (let v = 0; v < s; v++) for (let u = 0; u < s; u++) { const o = ((y * s + v) * I.w + x * s + u) * I.bpp; a[0] += I.data[o]; a[1] += I.data[o + 1]; a[2] += I.data[o + 2]; }
    const d = ((oy + y) * W + ox + x) * 3; rgb[d] = a[0] / (s * s); rgb[d + 1] = a[1] / (s * s); rgb[d + 2] = a[2] / (s * s); } });
writePNG(OUTF, W, H, rgb); console.log(OUTF, W, H);
