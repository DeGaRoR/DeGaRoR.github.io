#!/usr/bin/env node
// GARAGE-VIEW, step 1c: THE MAP - the measured world round the two hangars from above, with distances, for the user's
// page. Drawn only from measure.json (measure.js) and census.json (census.js: the drawn forest, optional).
//
//   node tools/garage_view/map.js [--in dir] [--out dir]
//     -> map_near.svg     +-300 m: the two sheds and their doors, the view cones, rings every 50 m from each door, the
//                         paving, the runway, the buildings, the parked aircraft, the vehicles, the props, every tree
//     -> map_wide.svg     +-2 km: 10 m contours, the canopy, the runways, the sea, the trees as dots
//     -> horizon_<shed>.svg  the skyline from each door: elevation against bearing, the ridges behind one another
//     -> map_today.svg    the near map with, in red, where TODAY's garage shows the runway and the aprons (its fixed
//                         quarter turn, 25_airfield.js siteToLocal, against each shed's true yaw)
// North is up (north = -z), metres. No node dependency.
'use strict';
const fs = require('fs'), path = require('path');
const T = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const IN = opt('in', path.join(T, 'perf', 'garage_view')), OUT = opt('out', IN);
const M = JSON.parse(fs.readFileSync(path.join(IN, 'measure.json'), 'utf8'));
const CEN = fs.existsSync(path.join(IN, 'census.json')) ? JSON.parse(fs.readFileSync(path.join(IN, 'census.json'), 'utf8')) : null;
const f1 = v => (+v).toFixed(1), f2 = v => (+v).toFixed(2);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// the census, unpacked
const TREES = [];
if (CEN) { const R = CEN.rec; for (let i = 0; i < CEN.trees.length; i += R) { const k = CEN.keys[CEN.trees[i]];
  TREES.push({ key: k, ser: CEN.trees[i + 1], x: CEN.trees[i + 2], y: CEN.trees[i + 3], z: CEN.trees[i + 4], yaw: CEN.trees[i + 5], s: CEN.trees[i + 6], sy: CEN.trees[i + 7], h: CEN.trees[i + 8], town: CEN.trees[i + 9] }); } }
const kindOf = key => /dead|snag|stump|stick|trunk/i.test(key) ? 'dead' : /cedar|fir|larch|spruce|pine/i.test(key) ? 'conifer' : /birch|maple|oak|ash/i.test(key) ? 'broadleaf' : /shrub|holly|raspberry|sapling|bush/i.test(key) ? 'shrub' : /rock/i.test(key) ? 'rock' : 'other';
const KCOL = { conifer: '#2f5d3a', broadleaf: '#5c8a3c', dead: '#8a7a66', shrub: '#7da058', rock: '#8d8d8d', other: '#4f7a4a' };

// ---- a contour set off a regular grid (marching squares, segments) --------------------------------------------
function contours(g, vals, levels) {
  const out = [], n = g.n, at = (i, j) => vals[j * n + i];
  const lerp = (a, b, va, vb, L) => a + (b - a) * ((L - va) / (vb - va || 1e-9));
  for (const L of levels) {
    let d = '';
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const v0 = at(i, j), v1 = at(i + 1, j), v2 = at(i + 1, j + 1), v3 = at(i, j + 1);
      const c = (v0 > L ? 1 : 0) | (v1 > L ? 2 : 0) | (v2 > L ? 4 : 0) | (v3 > L ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const x0 = g.x0 + i * g.step, z0 = g.z0 + j * g.step, s = g.step;
      const E = [[lerp(x0, x0 + s, v0, v1, L), z0], [x0 + s, lerp(z0, z0 + s, v1, v2, L)], [lerp(x0, x0 + s, v3, v2, L), z0 + s], [x0, lerp(z0, z0 + s, v0, v3, L)]];
      const segs = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] }[c];
      for (const [a, b] of segs) d += 'M' + f1(E[a][0]) + ' ' + f1(E[a][1]) + 'L' + f1(E[b][0]) + ' ' + f1(E[b][1]);
    }
    if (d) out.push({ L, d });
  }
  return out;
}
const poly = (P, extra) => '<polygon points="' + P.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ') + '" ' + extra + '/>';
const line = (P, extra) => '<polyline points="' + P.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ') + '" fill="none" ' + extra + '/>';
// text that stays upright and a fixed size on screen: sizes are in metres of map
const text = (x, z, s, size, extra) => '<text x="' + f1(x) + '" y="' + f1(z) + '" font-size="' + size + '" ' + (extra || '') + '>' + esc(s) + '</text>';

function shedSvg(S, rings, coneR) {
  let o = poly(S.corners, 'fill="#c9b79a" stroke="#3b332a" stroke-width="0.5"');
  // the door: the room's local -x edge, DOOR_W wide, centred
  const dn = [S.doorDir.x, S.doorDir.z], dt = [-dn[1], dn[0]], c = [S.doorCentre.x, S.doorCentre.z], hw = S.door.w / 2;
  o += line([[c[0] - dt[0] * hw, c[1] - dt[1] * hw], [c[0] + dt[0] * hw, c[1] + dt[1] * hw]], 'stroke="#e0832a" stroke-width="1.4"');
  for (const r of rings) o += '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + r + '" fill="none" stroke="#e0832a" stroke-opacity="0.45" stroke-width="0.35" stroke-dasharray="3 3"/>'
    + text(c[0] + dn[0] * r + 2, c[1] + dn[1] * r, r + ' m', Math.max(5, r * 0.035), 'fill="#b5651d"');
  // the cone out of the door: +-80 degrees about the door's line
  const a0 = Math.atan2(dn[1], dn[0]), R = coneR;
  for (const da of [-80, -40, 0, 40, 80]) { const a = a0 + da * Math.PI / 180;
    o += line([c, [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R]], 'stroke="#e0832a" stroke-opacity="' + (da === 0 ? 0.9 : 0.35) + '" stroke-width="0.4"' + (da === 0 ? '' : ' stroke-dasharray="6 4"')); }
  o += text(S.x, S.z, S.name, 5.5, 'text-anchor="middle" fill="#2b241c" font-weight="700"');
  return o;
}
const acSvg = o => { const A = { 'arch:cub': [10.7, 6.8], 'arch:c172': [11.0, 8.3], 'arch:jodel': [8.2, 6.4] }[o.key] || [10, 7];
  const nx = -Math.sin(o.yaw), nz = Math.cos(o.yaw), wx = -nz, wz = nx;          // the premises' yaw: -pi/2 faces +x
  const nose = [o.x + nx * A[1] * 0.45, o.z + nz * A[1] * 0.45], tail = [o.x - nx * A[1] * 0.55, o.z - nz * A[1] * 0.55], wc = [nose[0] - nx * A[1] * 0.3, nose[1] - nz * A[1] * 0.3];
  return line([nose, tail], 'stroke="#27408b" stroke-width="1.1"') + line([[wc[0] + wx * A[0] / 2, wc[1] + wz * A[0] / 2], [wc[0] - wx * A[0] / 2, wc[1] - wz * A[0] / 2]], 'stroke="#27408b" stroke-width="1.3"'); };
const carSvg = o => { const L = /truck|boxtruck|flatbed|fire|bus/.test(o.key) ? 7 : 4.6, Wd = 1.9, nx = -Math.sin(o.yaw), nz = Math.cos(o.yaw), wx = -nz, wz = nx;
  return poly([[1, 1], [1, -1], [-1, -1], [-1, 1]].map(q => [o.x + nx * q[0] * L / 2 + wx * q[1] * Wd / 2, o.z + nz * q[0] * L / 2 + wz * q[1] * Wd / 2]), 'fill="#b0332b" stroke="#5b1512" stroke-width="0.25"'); };
// a building's footprint: the game's own dims where measure.json carries them (boxes read off the live scene), else a
// marker square (the model's true box comes with the capture run)
const bldSvg = b => { const w = (b.box && b.box.w) || 8, d = (b.box && b.box.d) || 6, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  return poly([[1, 1], [1, -1], [-1, -1], [-1, 1]].map(q => [b.x + q[0] * w / 2 * c + q[1] * d / 2 * s, b.z - q[0] * w / 2 * s + q[1] * d / 2 * c]), 'fill="#b9a88c" stroke="#3b332a" stroke-width="0.35"' + (b.box ? '' : ' stroke-dasharray="1.5 1"'))
    + text(b.x, b.z - Math.max(w, d) / 2 - 1.5, b.key.split('/').pop() + (b.box ? '' : ' (size approx.)'), 3.6, 'text-anchor="middle" fill="#3b332a"'); };

function draw(half, cx, cz, o) {
  const x0 = cx - half, z0 = cz - half, S = [];
  S.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f1(x0) + ' ' + f1(z0) + ' ' + (2 * half) + ' ' + (2 * half) + '" width="' + o.px + '" height="' + o.px + '" font-family="IBM Plex Sans, Segoe UI, sans-serif">');
  S.push('<rect x="' + f1(x0) + '" y="' + f1(z0) + '" width="' + 2 * half + '" height="' + 2 * half + '" fill="#dfe6cf"/>');
  const g = o.wide ? M.terrain.mid : M.terrain.near;
  // the sea, the canopy (wide), then the contours
  if (o.wide && g.canopy) {   // run-length rows: one rect a run of the same class (sea / three canopy shades)
    const cls = (i, j) => { const h = g.h[j * g.n + i], c = g.canopy[j * g.n + i]; return h <= M.sea + 0.05 ? 1 : c >= 14 ? 4 : c >= 7 ? 3 : c >= 2.5 ? 2 : 0; };
    const FILL = { 1: 'fill="#9fc3d8"', 2: 'fill="#6f9a63" fill-opacity="0.3"', 3: 'fill="#6f9a63" fill-opacity="0.5"', 4: 'fill="#5f8a56" fill-opacity="0.72"' };
    for (let j = 0; j < g.n; j++) { let i = 0; while (i < g.n) { const c = cls(i, j); let k = i + 1; while (k < g.n && cls(k, j) === c) k++;
      if (c) S.push('<rect x="' + f1(g.x0 + (i - 0.5) * g.step) + '" y="' + f1(g.z0 + (j - 0.5) * g.step) + '" width="' + (k - i) * g.step + '" height="' + g.step + '" ' + FILL[c] + '/>'); i = k; } } }
  const lo = Math.min(...g.h), hi = Math.max(...g.h), stepL = o.wide ? 10 : 1, levels = [];
  for (let L = Math.ceil(lo / stepL) * stepL; L <= hi; L += stepL) levels.push(L);
  for (const c of contours(g, g.h, levels)) S.push('<path d="' + c.d + '" fill="none" stroke="#8a7f5c" stroke-opacity="' + (c.L % (stepL * 5) === 0 ? 0.75 : 0.32) + '" stroke-width="' + (o.wide ? 1.2 : 0.22) + '"/>');
  // paving
  for (const r of M.roads) S.push(line(r.pts, 'stroke="' + (r.cls === 'paved' ? '#a9a59b' : '#b9a57e') + '" stroke-width="' + r.w + '" stroke-linejoin="round" stroke-linecap="butt" stroke-opacity="0.9"'));
  for (const s of M.surfaces) S.push(poly(s.poly, 'fill="#aeaaa0" stroke="#6f6b63" stroke-width="' + (o.wide ? 1.5 : 0.3) + '"'));
  for (const r of M.runways) { S.push(poly(r.poly, 'fill="' + (+r.surface === 5 ? '#8f8c86' : '#b59f79') + '" stroke="#55524c" stroke-width="' + (o.wide ? 1.5 : 0.3) + '"'));
    S.push(text(r.c[0], r.c[1], r.name, o.wide ? 46 : 7, 'text-anchor="middle" fill="#2c2a27" transform="rotate(' + f1(r.hdg * 180 / Math.PI) + ' ' + f1(r.c[0]) + ' ' + f1(r.c[1]) + ')"')); }
  // the forest, tree by tree
  if (!o.wide) for (const t of TREES) { if (Math.abs(t.x - cx) > half || Math.abs(t.z - cz) > half) continue; const k = kindOf(t.key), H = t.h * t.sy;
    S.push('<circle cx="' + f1(t.x) + '" cy="' + f1(t.z) + '" r="' + f1(o.wide ? 5 : Math.max(0.6, H * (k === 'conifer' ? 0.16 : 0.26))) + '" fill="' + KCOL[k] + '" fill-opacity="' + (o.wide ? 0.55 : 0.6) + '"' + (t.town ? ' stroke="#111" stroke-width="0.2"' : '') + '/>'); }
  if (!o.wide) {
    for (const b of M.buildings) S.push(bldSvg(b));
    for (const ob of M.objects) {
      if (ob.kind === 'aircraft') S.push(acSvg(ob));
      else if (/^(auto_|truck_|machine_)/.test(ob.key)) S.push(carSvg(ob));
      else if (ob.person) S.push('<circle cx="' + f1(ob.x) + '" cy="' + f1(ob.z) + '" r="0.7" fill="none" stroke="#c2185b" stroke-width="0.3"/>');
      else if (ob.kind === 'tree') S.push('<circle cx="' + f1(ob.x) + '" cy="' + f1(ob.z) + '" r="1.2" fill="' + KCOL[kindOf(ob.key)] + '" stroke="#222" stroke-width="0.2"/>');
      else if (ob.kind === 'prop') S.push('<rect x="' + f1(ob.x - 0.5) + '" y="' + f1(ob.z - 0.5) + '" width="1" height="1" fill="#6a5a3c"/>');
      else if (ob.kind === 'billboard') S.push('<rect x="' + f1(ob.x - 1) + '" y="' + f1(ob.z - 0.3) + '" width="2" height="0.6" fill="#b71c1c"/>');
    }
    for (const st of M.stands) S.push('<circle cx="' + f1(st.x) + '" cy="' + f1(st.z) + '" r="1.6" fill="none" stroke="#27408b" stroke-width="0.4"/>' + text(st.x + 2.5, st.z + 1.5, 'stand ' + st.id, 3.6, 'fill="#27408b"'));
  }
  if (o.today) for (const S0 of M.sheds.slice(0, 1)) {   // (the club's room; the large hangar's is the same turn about its own centre)
    // where TODAY's room shows a world point: the quarter turn's local place, stood back in the world by the true yaw
    const c = Math.cos(S0.ry), s = Math.sin(S0.ry), today = (x, z) => { const lx = z - S0.z, lz = S0.x - x; return [S0.x + lx * c + lz * s, S0.z - lx * s + lz * c]; };
    for (const r of M.runways) S.push(poly(r.poly.map(q => today(q[0], q[1])), 'fill="#d32f2f" fill-opacity="0.10" stroke="#d32f2f" stroke-width="0.7" stroke-dasharray="5 3"'));
    for (const a of M.surfaces) S.push(poly(a.poly.map(q => today(q[0], q[1])), 'fill="none" stroke="#d32f2f" stroke-width="0.6" stroke-dasharray="3 2"'));
  }
  for (const S0 of M.sheds) S.push(shedSvg(S0, o.wide ? [500, 1000] : [50, 100, 200], o.wide ? 1900 : 280));
  // north, the scale bar
  const bx = x0 + half * 0.08, bz = z0 + 2 * half * 0.955, bl = o.wide ? 1000 : 100;
  S.push(line([[bx, bz], [bx + bl, bz]], 'stroke="#111" stroke-width="' + (o.wide ? 8 : 1) + '"') + text(bx, bz - half * 0.02, bl + ' m', half * 0.035, 'fill="#111"'));
  S.push(text(x0 + 2 * half * 0.955, z0 + half * 0.09, 'N', half * 0.06, 'text-anchor="middle" fill="#111" font-weight="700"') + line([[x0 + 2 * half * 0.955, z0 + half * 0.2], [x0 + 2 * half * 0.955, z0 + half * 0.105]], 'stroke="#111" stroke-width="' + half * 0.006 + '"'));
  S.push('</svg>');
  return S.join('\n');
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'map_near.svg'), draw(300, M.mid.x + 60, M.mid.z - 60, { px: 1800 }));
fs.writeFileSync(path.join(OUT, 'map_today.svg'), draw(300, M.mid.x + 60, M.mid.z - 60, { px: 1800, today: true }));
fs.writeFileSync(path.join(OUT, 'map_wide.svg'), draw(2000, M.terrain.mid.x0 + 2000, M.terrain.mid.z0 + 2000, { px: 1600, wide: true }));

// ---- the skyline from each door ---------------------------------------------------------------------------------
for (const Hz of M.horizon) {
  const S0 = M.sheds.find(s => s.id === Hz.shed), b0 = S0.doorBearing, Wd = 1400, Hd = 420, pad = 46, el2y = e => Hd - pad - (e + 1) * (Hd - 2 * pad) / 13, a2x = da => pad + (da + 110) * (Wd - 2 * pad) / 220;
  const S = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + Wd + ' ' + Hd + '" width="' + Wd + '" height="' + Hd + '" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="13">', '<rect width="' + Wd + '" height="' + Hd + '" fill="#eef3f7"/>'];
  const rows = []; for (let da = -110; da <= 110; da++) rows.push(Object.assign({ da }, Hz.rows[((Math.round(b0 + da) % 360) + 360) % 360]));
  // the skyline's body, and the nearest ridge in front of it (a bearing with one ridge only: the skyline itself)
  const band = (f, op) => S.push('<polygon points="' + a2x(-110) + ',' + el2y(-1) + ' ' + rows.map(r => f1(a2x(r.da)) + ',' + f1(el2y(Math.max(-1, f(r))))).join(' ') + ' ' + a2x(110) + ',' + el2y(-1) + '" fill="#5d7a5a" fill-opacity="' + op + '"/>');
  band(r => r.el, 0.22); band(r => (r.ridges.length ? r.ridges[0].el : r.el), 0.34);
  S.push('<polyline points="' + rows.map(r => f1(a2x(r.da)) + ',' + f1(el2y(r.el))).join(' ') + '" fill="none" stroke="#263238" stroke-width="1.6"/>');
  for (const r of rows) if (r.sea && r.el < 0.15) S.push('<rect x="' + f1(a2x(r.da) - 3) + '" y="' + f1(el2y(0)) + '" width="6" height="5" fill="#4f8fb3"/>');
  for (let e = 0; e <= 12; e += 2) S.push('<line x1="' + pad + '" x2="' + (Wd - pad) + '" y1="' + el2y(e) + '" y2="' + el2y(e) + '" stroke="#90a4ae" stroke-width="0.5"/>' + '<text x="6" y="' + (el2y(e) + 4) + '" fill="#455a64">' + e + '°</text>');
  for (let da = -90; da <= 90; da += 30) S.push('<line x1="' + a2x(da) + '" x2="' + a2x(da) + '" y1="' + pad + '" y2="' + (Hd - pad) + '" stroke="#90a4ae" stroke-width="' + (da === 0 ? 1.4 : 0.5) + '"/>' + '<text x="' + a2x(da) + '" y="' + (Hd - pad + 18) + '" text-anchor="middle" fill="#455a64">' + (da === 0 ? 'straight out of the door' : (da > 0 ? da + '° right' : -da + '° left')) + '</text>');
  const top = rows.filter(r => Math.abs(r.da) <= 80).sort((a, b) => b.el - a.el)[0];
  S.push('<text x="' + a2x(top.da) + '" y="' + (el2y(top.el) - 8) + '" text-anchor="middle" fill="#263238" font-weight="700">' + top.h + ' m high, ' + (top.d / 1000).toFixed(1) + ' km away, ' + top.el + '° up</text>');
  S.push('<text x="' + pad + '" y="24" fill="#263238" font-weight="700" font-size="16">The skyline from the ' + esc(S0.name) + ' door (eye 1.7 m; the door looks to compass ' + b0 + '°)</text>');
  S.push('</svg>');
  fs.writeFileSync(path.join(OUT, 'horizon_' + S0.id.replace(/\W/g, '_') + '.svg'), S.join('\n'));
}
console.log('map: ' + ['map_near.svg', 'map_today.svg', 'map_wide.svg'].concat(M.horizon.map(h => 'horizon_' + h.shed.replace(/\W/g, '_') + '.svg')).join(', ') + ' -> ' + OUT + (CEN ? '  (' + TREES.length + ' trees)' : '  (no census.json: no forest drawn)'));
