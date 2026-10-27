// DMG-LOOKS PORT KIT: the ported alloy slot (dmg_looks_alloy.js: the canonical 480-triangle mesh, poseJS / fragJS - the
// GLSL's mirror, held to it by check_port.js) drawn crushed and torn, to show the port reads as the prototype did - shaded
// SMOOTH from the pose's own vertex normals (the user, 27 Oct: no flat shading on a deformed part).
//   node futureDesigns/dmg-looks/port/render_port.js  -> port/port_alloy.png
'use strict';
const path = require('path'), R3 = require('../raster3d.js'), AL = require('./dmg_looks_alloy.js');
const W = 420, H = 230, BG = [0.12, 0.13, 0.15], C = AL.canon();
const V = { yaw: -0.62, pitch: 0.45, scale: 1150, ox: 215, oy: 120, cx: 0.22, cy: 0.01, cz: 0 };
function slot(tris, S, A, B, up, part) {
  const P = [], X = [];
  const Nn = [];
  for (let v = 0; v < C.nv; v++) { const a = Array.from(C.attr.slice(v * C.stride, v * C.stride + C.stride)), r = AL.poseJS(a, S, A, B, up); P.push(part ? r.pos.map((q, j) => q + part[j]) : r.pos); X.push([r.x, a[5], a]); Nn.push(r.nrm); }
  for (let t = 0; t < C.ntri; t++) { const i = [C.index[t * 3], C.index[t * 3 + 1], C.index[t * 3 + 2]];
    const flat = i.every(j => X[j][2][3] === 0) && X[i[0]][2][2] === X[i[1]][2][2] && X[i[1]][2][2] === X[i[2]][2][2] ? 1 : 0;
    tris.push({ p: i.map(j => P[j]), n: i.map(j => Nn[j]), col: [0.62, 0.63, 0.64], back: [0.55, 0.56, 0.58], spec: 0.1, attr: i.map(j => [X[j][0], X[j][1], flat]),
      frag: (a, front) => { const f = AL.fragJS(a[0], a[1], a[2], front, S); return f[3] > 0.5 ? { col: f.slice(0, 3), spec: 0.2 } : null; } }); }
}
const cells = [];
const L0 = 0.45, up = [0, 1, 0];
for (const d of [0.012, 0.042, 0.075]) { const Cv = R3.Canvas(W, H, BG), tris = []; slot(tris, AL.slotState({ mode: 0, L0, kt1: 0.5, seed: 3 }), [0, 0, 0], [L0 - d, 0, 0], up); R3.draw(Cv, V, tris); cells.push(Cv); }
{ const Cv = R3.Canvas(W, H, BG), tris = []; slot(tris, AL.slotState({ mode: 1, L0, tb: 0.5, seed: 11 }), [0, 0, 0], [L0, 0, 0], up); slot(tris, AL.slotState({ mode: 2, L0, tb: 0.5, seed: 11 }), [0, 0, 0], [L0, 0, 0], up, [0.018, -0.006, 0.008]); R3.draw(Cv, V, tris); cells.push(Cv); }
// tile 2 x 2
const out = R3.Canvas(2 * W + 10, 2 * H + 10, [0.1, 0.1, 0.11]);
cells.forEach((Cv, i) => { const ox = (i % 2) * (W + 10), oy = Math.floor(i / 2) * (H + 10);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) out.img[((oy + y) * out.w + ox + x) * 4 + c] = Cv.img[(y * W + x) * 4 + c]; });
R3.save(out, path.join(__dirname, 'port_alloy.png')); console.log('wrote port_alloy.png (crushed 12 / 42 / 75 mm, torn) -', C.ntri, 'triangles a slot');
