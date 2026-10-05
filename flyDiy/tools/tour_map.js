#!/usr/bin/env node
// tour_map.js - THE ISLAND TOUR'S MAP (ISLAND-TOUR, G1970): the island (the land shaded by height, the sea, the woods
// the fill plants), every strip as drawn, and each tour's track from tools/island_tour.js --json, a colour a leg, the
// landings marked. One SVG (the raster inlined as a PNG); --png also writes a PNG of it (Playwright's Chromium).
//   node tools/tour_map.js <out.svg> <tour.json> [<tour.json> ...] [--px 20] [--png]
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--px'));
const out = files.shift();
const tours = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const PX = +opt('px', 20);
// the extent: the strips and the tracks, 1.5 km round
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
const grow = (x, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
for (const a of W.aerodromes) grow(a.x, a.z);
for (const t of tours) for (const p of t.track) grow(p[0], p[1]);
x0 -= 1500; x1 += 1500; z0 -= 1500; z1 += 1500;
const nx = Math.ceil((x1 - x0) / PX), nz = Math.ceil((z1 - z0) / PX);
// the raster: sea blue, land by height (green to brown to grey), the woods darker
const ISL = W.island;
const img = Buffer.alloc(nz * (1 + nx * 3));
for (let j = 0; j < nz; j++) {
  img[j * (1 + nx * 3)] = 0;
  for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * PX, z = z0 + (j + 0.5) * PX;
    const h = W.terrainH(x, z), w = W.waterH ? W.waterH(x, z) : -Infinity;
    let rgb;
    if (w > h + 0.05) rgb = [168, 196, 214];
    else {
      const u = Math.max(0, Math.min(1, h / 700));
      rgb = [Math.round(196 + 40 * u), Math.round(210 - 20 * u), Math.round(170 + 40 * u)];
      if (ISL && ISL.effClass && ISL.effClass(x, z) === ISL.WC.TREE) rgb = rgb.map(v => Math.round(v * 0.82));
    }
    const k = j * (1 + nx * 3) + 1 + i * 3; img[k] = rgb[0]; img[k + 1] = rgb[1]; img[k + 2] = rgb[2];
  }
}
const crc = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return b => { let c = -1; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
const chunk = (ty, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(ty), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(nx, 0); ihdr.writeUInt32BE(nz, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(img)), chunk('IEND', Buffer.alloc(0))]);
// the SVG: 1 unit = 1 m, north (-z) up
const S = [];
const vw = x1 - x0, vh = z1 - z0, scale = 1100 / Math.max(vw, vh);
S.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(vw * scale) + '" height="' + Math.round(vh * scale + 60) + '" viewBox="' + x0 + ' ' + (z0 - 60 / scale) + ' ' + vw + ' ' + (vh + 60 / scale) + '">');
S.push('<rect x="' + x0 + '" y="' + (z0 - 60 / scale) + '" width="' + vw + '" height="' + (60 / scale) + '" fill="#fff"/>');
S.push('<image x="' + x0 + '" y="' + z0 + '" width="' + vw + '" height="' + vh + '" preserveAspectRatio="none" href="data:image/png;base64,' + png.toString('base64') + '"/>');
const sw = 1.2 / scale, fs1 = 13 / scale;
for (const a of W.aerodromes) {
  const R = C.siteRunway(a), water = a.water || a.kind === 'water';
  const c = [[R.end0.x + R.nx * R.half, R.end0.z + R.nz * R.half], [R.end1.x + R.nx * R.half, R.end1.z + R.nz * R.half], [R.end1.x - R.nx * R.half, R.end1.z - R.nz * R.half], [R.end0.x - R.nx * R.half, R.end0.z - R.nz * R.half]];
  const wmin = 30 / scale;   // a short strip is drawn at least 30 px long
  if (!water && R.len < wmin) { /* drawn as is: the marker below finds it */ }
  S.push('<polygon points="' + c.map(q => q.join(',')).join(' ') + '" fill="' + (water ? 'none' : '#333') + '" stroke="' + (water ? '#2a6fb0' : '#111') + '" stroke-width="' + sw + '"' + (water ? ' stroke-dasharray="' + 4 * sw + '"' : '') + '/>');
  S.push('<circle cx="' + a.x + '" cy="' + a.z + '" r="' + 5 / scale + '" fill="none" stroke="#111" stroke-width="' + sw + '"/>');
  S.push('<text x="' + (a.x + 8 / scale) + '" y="' + (a.z - 8 / scale) + '" font-size="' + fs1 + '" font-family="sans-serif" fill="#111" stroke="#fff" stroke-width="' + 3 / scale + '" paint-order="stroke">' + (a.name || a.id) + '</text>');
}
const COL = ['#d7263d', '#f46036', '#2e294e', '#1b998b', '#c5d86d', '#8e44ad', '#0077b6', '#e76f51'];
let ty = z0 - 40 / scale;
tours.forEach((t, ti) => {
  t.legs.forEach((L, li) => {
    const pts = t.track.slice(L.trackI[0], L.trackI[1] + 1);
    if (pts.length < 2) return;
    S.push('<polyline points="' + pts.map(p => p[0] + ',' + p[1]).join(' ') + '" fill="none" stroke="' + COL[(li + ti * 3) % COL.length] + '" stroke-width="' + 2.2 / scale + '"' + (ti ? ' stroke-dasharray="' + 6 / scale + ' ' + 3 / scale + '"' : '') + ' stroke-linejoin="round"/>');
    const e = pts[pts.length - 1];
    S.push('<circle cx="' + e[0] + '" cy="' + e[1] + '" r="' + 4 / scale + '" fill="' + (L.ok ? COL[(li + ti * 3) % COL.length] : '#000') + '"/>');
  });
  S.push('<text x="' + (x0 + 10 / scale) + '" y="' + ty + '" font-size="' + fs1 + '" font-family="sans-serif">' + (ti ? '- - ' : '—— ') + t.build + ': ' + t.order.join(' > ') + ' - ' + (t.done ? 'DONE' : 'NOT DONE') + ', fuel left ' + t.fuel + ' L</text>');
  ty += 18 / scale;
});
S.push('</svg>');
fs.writeFileSync(out, S.join('\n'));
console.log('tour_map: wrote ' + out + ' (' + nx + ' x ' + nz + ' px raster, ' + tours.length + ' tour(s))');
if (argv.includes('--png')) {
  let chromium = null;
  try { chromium = require('playwright').chromium; } catch (e) {
    try { chromium = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')).chromium; } catch (e2) {}
  }
  if (!chromium) { console.log('tour_map: no playwright - the PNG skipped'); process.exit(0); }
  (async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 1300 } });
    await p.goto('file://' + path.resolve(out)); const el = await p.$('svg'); await el.screenshot({ path: out.replace(/\.svg$/, '.png') }); await b.close();
    console.log('tour_map: wrote ' + out.replace(/\.svg$/, '.png'));
  })();
}
