#!/usr/bin/env node
// world_topmap.js (G1560 WORLD-STRIPS) - a top-down before/after of a world, node only, no GPU: two flight cores (the
// old build and the new one) on the same world, three panels - BEFORE | AFTER | WHAT MOVED - written as a PNG.
//   node tools/world_topmap.js <coreBefore.js> <coreAfter.js> <seedN|jolene> <out.png> [x0 z0 x1 z1 px]
// Hillshade + water (blue; waterH over terrainH) + strips (red: before, yellow: after). The diff panel: grey
// hillshade, water gained (cyan), water lost (magenta), ground moved > 0.25 m (orange), both strip sets.
// jolene composes the island with its premises fixture (island_node.js, pointed at each core in turn).
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = path.join(__dirname, '..');
function world(corePath, which) {
  corePath = path.resolve(corePath);
  if (which === 'jolene') {
    const real = path.join(ROOT, 'tools', 'flight_core.js');
    for (const k of Object.keys(require.cache)) if (k.endsWith('island_node.js') || k === real) delete require.cache[k];
    require.cache[real] = { id: real, filename: real, loaded: true, exports: require(corePath) };
    const IN = require(path.join(ROOT, 'tools', 'island_node.js'));
    return IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(ROOT, 'tools/fixtures/island_jolene.json'), 'utf8') });
  }
  return require(corePath).makeWorld(+which.replace('seed', ''));
}
const [cA, cB, which, out, ...rest] = process.argv.slice(2);
const WA = world(cA, which), WB = world(cB, which);
const bd = WA.bounds;
const [x0, z0, x1, z1, PX] = rest.length ? rest.map(Number) : [bd.x0, bd.z0, bd.x1, bd.z1, 800];
const PZ = Math.round(PX * (z1 - z0) / (x1 - x0)), sx = (x1 - x0) / PX, sz = (z1 - z0) / PZ;
function sample(W) {
  const h = new Float32Array(PX * PZ), w = new Uint8Array(PX * PZ);
  for (let j = 0; j < PZ; j++) for (let i = 0; i < PX; i++) {
    const x = x0 + (i + 0.5) * sx, z = z0 + (j + 0.5) * sz, t = W.terrainH(x, z), wt = W.waterH(x, z);
    h[j * PX + i] = t; w[j * PX + i] = wt > t ? 1 : 0;
  }
  return { h, w };
}
const A = sample(WA), B = sample(WB);
const GAP = 6, IW = PX * 3 + GAP * 2, img = Buffer.alloc(IW * PZ * 3, 255);
const shade = (H, i, j) => { const k = j * PX + i, e = H[k] - H[Math.max(0, j - 1) * PX + Math.max(0, i - 1)]; return Math.max(0, Math.min(1, 0.6 + e / (sx * 0.8))); };
const put = (panel, i, j, r, g, b) => { if (i < 0 || j < 0 || i >= PX || j >= PZ) return; const p = (j * IW + panel * (PX + GAP) + i) * 3; img[p] = r; img[p + 1] = g; img[p + 2] = b; };
for (let j = 0; j < PZ; j++) for (let i = 0; i < PX; i++) {
  const k = j * PX + i;
  for (const [pn, S] of [[0, A], [1, B]]) {
    const s = shade(S.h, i, j), hh = S.h[k];
    if (S.w[k]) put(pn, i, j, 40 * s + 20, 90 * s + 40, 160 * s + 60);
    else { const g = Math.min(1, Math.max(0, hh / 400)); put(pn, i, j, (90 + 120 * g) * s, (130 + 60 * g) * s, (70 + 110 * g) * s); }
  }
  const s = shade(B.h, i, j) * 200;
  let c = [s, s, s];
  if (Math.abs(A.h[k] - B.h[k]) > 0.25) c = [255, 140, 0];
  if (B.w[k] && !A.w[k]) c = [0, 230, 255];
  if (A.w[k] && !B.w[k]) c = [255, 0, 200];
  put(2, i, j, ...c);
}
function strip(pn, a, col) {
  if (a.kind === 'meadow' || a.kind === 'water') return;
  const c = Math.cos(a.hdg), s = Math.sin(a.hdg), L = a.len / 2, Wd = Math.max(a.wid / 2, sx * 1.5);
  for (const [u0, v0, u1, v1] of [[-L, -Wd, L, -Wd], [-L, Wd, L, Wd], [-L, -Wd, -L, Wd], [L, -Wd, L, Wd]])
    for (let t = 0; t <= 1; t += 0.002) { const u = u0 + (u1 - u0) * t, v = v0 + (v1 - v0) * t; const x = a.x + u * c - v * s, z = a.z + u * s + v * c;
      for (const d of [-1, 0, 1]) put(pn, Math.floor((x - x0) / sx) + d, Math.floor((z - z0) / sz), ...col); }
}
for (const a of WA.aerodromes) { strip(0, a, [230, 0, 0]); strip(2, a, [230, 0, 0]); }
for (const a of WB.aerodromes) { strip(1, a, [255, 230, 0]); strip(2, a, [255, 230, 0]); }
// PNG
const raw = Buffer.alloc((IW * 3 + 1) * PZ);
for (let j = 0; j < PZ; j++) { raw[j * (IW * 3 + 1)] = 0; img.copy(raw, j * (IW * 3 + 1) + 1, j * IW * 3, (j + 1) * IW * 3); }
const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(IW, 0); ih.writeUInt32BE(PZ, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
let gained = 0, lost = 0, moved = 0; for (let k = 0; k < PX * PZ; k++) { if (B.w[k] && !A.w[k]) gained++; if (A.w[k] && !B.w[k]) lost++; if (Math.abs(A.h[k] - B.h[k]) > 0.25) moved++; }
console.log(`${out}: ${PX}x${PZ} px at ${sx.toFixed(1)} m; water gained ${gained} px, lost ${lost} px, ground moved >0.25 m ${moved} px`);
