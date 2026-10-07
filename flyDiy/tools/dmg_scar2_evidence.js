#!/usr/bin/env node
// dmg_scar2_evidence.js - G2378-G2382 (DMG-SCAR2): THE SIX CASES OF THE BOX STILLS, FROM ABOVE. The 30 m/s flight into a
// trunk 2.5 m off the centreline and the 12 m/s taxi into a 35 cm stump on the runway (paved), on the Cub, the Jodel and
// the metal Cessna (the certificate stamped). One SVG a case, two panels: BEFORE - the record and the decal of DMG-SCAR
// (4575e99f's core and ground_scar.js, given with --before <its flyDiy dir>) - and AFTER (this tree). Each panel, top-down
// at the case's scale (the bar):
//   the ground (turf green / the runway's concrete grey); the CULL AREA (pale: the grass's footprint - the craters' discs,
//   the gouges' strips, the resting wreck's hulls with their margin); the DECAL as laid (ground_scar.js's own triangles,
//   each the soil map's mean x its vertices' colour at their alpha over the ground); the outlines - craters (dashed),
//   gouges (their centre line), the scar's hulls (red), the WRECK AS IT LIES (blue: each piece's hull from the gate's own
//   reader, _dmg_scar_lib.js restOf, at the run's end), the ground contacts the gate saw (grey dots).
//   node tools/dmg_scar2_evidence.js [--before <flyDiy of the base>] [--out reports/evidence/DMG-SCAR2]
// Writes <build>_<case>.svg (six) and cases.json (the primitives, before and after).
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-SCAR2')));
const BEFORE = opt('before', null);

// ---- a child: one build, one case, one tree (its core and its decal) ----------------------------------------------
if (argv[0] === '--child') {
  const [, key, id, tree] = argv;
  if (tree !== 'after') {   // the base's core in place of this tree's: the lib requires tools/flight_core.js
    const base = require(path.join(tree, 'tools', 'flight_core.js'));
    require.cache[require.resolve(path.join(__dirname, 'flight_core.js'))] = require.cache[require.resolve(path.join(tree, 'tools', 'flight_core.js'))];
    void base;
  }
  const S = require('./_dmg_scar_lib.js'), L = require('./_treecrash_lib.js'), C = L.core();
  const c = S.CASES.find(x => x.id === id), r = S.runCase(key, c, {});
  // the decal (the tree's ground_scar.js, on a stub of three: it only makes buffers)
  global.scarSurf = C.scarSurf; global.SCAR = C.SCAR;
  const G = require(path.join(tree === 'after' ? path.join(__dirname, '..') : tree, 'src', 'viewer', 'ground_scar.js'));
  class Attr { constructor(a, n) { this.array = a; this.itemSize = n; } }
  const THREE = { BufferGeometry: class { constructor() { this.at = {}; } setAttribute(k, a) { this.at[k] = a; } setIndex(i) { this.index = i; } computeBoundingSphere() {} dispose() {} },
    Float32BufferAttribute: Attr };
  const parked = new THREE.BufferGeometry(), mesh = { geometry: parked, visible: false, userData: { parked, stat: { tris: 0, verts: 0, bytes: 0, ms: 0, prims: 0 } } };
  const world = { terrainH: () => r.elev, waterH: () => -1e9, surface: () => (c.hard ? 5 : 0) };
  G.build(THREE, mesh, r.prims, world);
  const g = mesh.geometry, P = g.at.position ? g.at.position.array : [], Cl = g.at.color ? g.at.color.array : [], I = g.index || [];
  // the soil map's mean (linear)
  const lin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  let tm = [0.09, 0.07, 0.05];
  try { const T = G.soil({ DataTexture: class { constructor(d) { this.image = { data: d }; } }, RepeatWrapping: 0, LinearFilter: 0, LinearMipmapLinearFilter: 0, RGBAFormat: 0 });
    const D = T.image.data; tm = [0, 0, 0]; for (let i = 0; i < D.length; i += 4) for (let j = 0; j < 3; j++) tm[j] += lin(D[i + j] / 255) / (D.length / 4); } catch (e) {}
  const tris = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], d = I[t + 2];
    const al = (Cl[a * 4 + 3] + Cl[b * 4 + 3] + Cl[d * 4 + 3]) / 3; if (!(al > 0.02)) continue;
    const col = [0, 1, 2].map(j => tm[j] * (Cl[a * 4 + j] + Cl[b * 4 + j] + Cl[d * 4 + j]) / 3);
    tris.push([P[a * 3], P[a * 3 + 2], P[b * 3], P[b * 3 + 2], P[d * 3], P[d * 3 + 2]].map(v => +v.toFixed(3)), col.map(v => +v.toFixed(4)), +al.toFixed(3));
  }
  console.log('RESULT ' + JSON.stringify({ key, id, label: c.label, hard: !!c.hard, elev: r.elev, prims: r.prims, crashed: r.crashed, reason: r.reason,
    contacts: r.contacts.filter((v, j) => j % 4 < 2).map(v => +v.toFixed(2)), rest: r.rest.pieces.map(pc => pc.hull.map(q => [+q[0].toFixed(2), +q[1].toFixed(2)])),
    last: r.sim.damageScar() ? r.sim.damageScar().last || null : null, tris }));
  process.exit(0);
}

// ---- the panels ----------------------------------------------------------------------------------------------------
const S = require('./_dmg_scar_lib.js');
const LAB = { cub: "the user's Cub", jodel: 'the Jodel', metal: 'the metal Cessna' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const srgb = v => { v = Math.max(0, Math.min(1, v)); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
const hex = c => '#' + c.map(v => ('0' + Math.round(srgb(v) * 255).toString(16)).slice(-2)).join('');
const GROUND = { turf: [0.105, 0.155, 0.045], paved: [0.0662, 0.045, 0.0276] };   // grass, the runway (ground_tex.js concreteA's mean)
const PW = 560, PH = 470, TOP = 46, PAD = 14;
function panel(r, title, ox, oy, box) {
  const [cx, cz, span] = box, sc = (PW - 2 * PAD) / span;
  const X = x => ox + PW / 2 + (x - cx) * sc, Y = z => oy + TOP + (PH - TOP - PAD) / 2 + (z - cz) * sc;
  const id = 'k' + Math.round(ox) + '_' + Math.round(oy), g = [];
  const gr = r.hard ? GROUND.paved : GROUND.turf;
  g.push(`<clipPath id="${id}"><rect x="${ox + 2}" y="${oy + TOP}" width="${PW - 4}" height="${PH - TOP - 2}"/></clipPath>`);
  g.push(`<rect x="${ox + 2}" y="${oy + 2}" width="${PW - 4}" height="${PH - 4}" fill="#fff" stroke="#bbb"/>`);
  const cnt = k => r.prims.filter(p => p.k === k).length, slots = r.prims.filter(p => p.ps).length;
  g.push(`<text x="${ox + 8}" y="${oy + 17}" font-size="12" font-weight="bold">${esc(title)}</text>`);
  g.push(`<text x="${ox + 8}" y="${oy + 31}" font-size="10" fill="#333">${cnt('c')} crater(s), ${cnt('g') - slots} gouge(s)${slots ? ' + ' + slots + ' prop slot' : ''}, ${cnt('h')} hull(s) - ${r.tris.length} decal triangles${r.crashed ? ' - crashed (' + esc(r.reason) + ')' : ''}</text>`);
  if (r.last) g.push(`<text x="${ox + 8}" y="${oy + 43}" font-size="9.5" fill="#555">the join (the last seal): ${r.last.slides} slides in ${r.last.chains} chains, ${r.last.joined} joined; ${r.last.blows} blows over eBlow - ${r.last.stopped} stopped (craters), ${r.last.onWay} on the way (the furrow's)</text>`);
  g.push(`<g clip-path="url(#${id})">`);
  g.push(`<rect x="${ox + 2}" y="${oy + TOP}" width="${PW - 4}" height="${PH - TOP - 2}" fill="${hex(gr)}"/>`);
  const pts = P => Array.from({ length: P.length / 2 }, (_, j) => X(P[j * 2]).toFixed(1) + ',' + Y(P[j * 2 + 1]).toFixed(1)).join(' ');
  // the cull area (the grass's footprint)
  const CULL = '#d9cfae';
  for (const p of r.prims) {
    if (p.k === 'c') g.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.z).toFixed(1)}" r="${(p.r * sc).toFixed(1)}" fill="${CULL}"/>`);
    else if (p.k === 'g') g.push(`<polyline points="${pts(p.p)}" fill="none" stroke="${CULL}" stroke-width="${(p.w * sc).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    else if (p.k === 'h') g.push(p.p.length >= 6 ? `<polygon points="${pts(p.p)}" fill="${CULL}" stroke="${CULL}" stroke-width="${(2 * p.m * sc).toFixed(2)}" stroke-linejoin="round"/>`
      : `<polyline points="${pts(p.p.length === 2 ? p.p.concat(p.p) : p.p)}" fill="none" stroke="${CULL}" stroke-width="${(2 * p.m * sc).toFixed(2)}" stroke-linecap="round"/>`);
  }
  // the decal: its triangles grouped by their colour (quantized) into one path each
  const by = new Map();
  for (const [T, col, al] of r.tris) {
    const c = col.map((v, j) => gr[j] * (1 - al) + v * al), k = hex(c);
    let s = by.get(k); if (!s) by.set(k, s = []);
    s.push('M' + X(T[0]).toFixed(1) + ' ' + Y(T[1]).toFixed(1) + 'L' + X(T[2]).toFixed(1) + ' ' + Y(T[3]).toFixed(1) + 'L' + X(T[4]).toFixed(1) + ' ' + Y(T[5]).toFixed(1) + 'Z');
  }
  for (const [k, s] of by) g.push(`<path d="${s.join('')}" fill="${k}" stroke="${k}" stroke-width="0.3"/>`);
  // the outlines
  for (const p of r.prims) {
    if (p.k === 'c') g.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.z).toFixed(1)}" r="${(p.r * sc).toFixed(1)}" fill="none" stroke="#2a180a" stroke-dasharray="3 2"/>`);
    else if (p.k === 'g') g.push(`<polyline points="${pts(p.p)}" fill="none" stroke="${p.ps ? '#000' : '#5a3010'}" stroke-width="0.7" stroke-opacity="0.8"/>`);
    else if (p.k === 'h' && p.p.length >= 4) g.push(`<polygon points="${pts(p.p)}" fill="none" stroke="#c0282d" stroke-width="1"/>`);
  }
  for (const H of r.rest) if (H.length >= 2) g.push(`<polygon points="${H.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join(' ')}" fill="none" stroke="#1e5bd8" stroke-width="1.2" stroke-dasharray="4 2"/>`);
  { const seen = new Set(); for (let j = 0; j < r.contacts.length; j += 2) { const px = Math.round(X(r.contacts[j])), py = Math.round(Y(r.contacts[j + 1])), key = px * 8192 + py;
    if (seen.has(key)) continue; seen.add(key); g.push(`<circle cx="${px}" cy="${py}" r="0.7" fill="#eee" fill-opacity="0.55"/>`); } }
  g.push('</g>');
  const m = span > 40 ? 10 : span > 12 ? 5 : 1;
  g.push(`<line x1="${(ox + PW - PAD - m * sc).toFixed(1)}" y1="${oy + PH - 9}" x2="${ox + PW - PAD}" y2="${oy + PH - 9}" stroke="#fff" stroke-width="3"/><text x="${(ox + PW - PAD - m * sc).toFixed(1)}" y="${oy + PH - 13}" font-size="10" fill="#fff">${m} m</text>`);
  return g.join('\n');
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const jobs = [];
  for (const key of S.BUILDS) for (const id of S.STILLS) { jobs.push({ key, id, tree: 'after' }); if (BEFORE) jobs.push({ key, id, tree: path.resolve(BEFORE) }); }
  const res = {};
  let at = 0;
  const one = () => { if (at >= jobs.length) return Promise.resolve(); const j = jobs[at++];
    return new Promise(done => { const c = cp.spawn(process.execPath, [__filename, '--child', j.key, j.id, j.tree], { stdio: ['ignore', 'pipe', 'inherit'] }); let so = '';
      c.stdout.on('data', d => { so += d; }); c.on('close', () => { const l = so.split('\n').find(x => x.indexOf('RESULT ') === 0); res[j.key + ':' + j.id + ':' + (j.tree === 'after' ? 'after' : 'before')] = l ? JSON.parse(l.slice(7)) : null; console.log(j.key + ' ' + j.id + ' ' + (j.tree === 'after' ? 'after' : 'before') + (l ? '' : ' FAILED')); done(); }); }).then(one); };
  await Promise.all([one(), one(), one(), one()]);
  const J = [];
  for (const key of S.BUILDS) for (const id of S.STILLS) {
    const A = res[key + ':' + id + ':after'], B = res[key + ':' + id + ':before'];
    if (!A) continue;
    // the frame: the footprint (no sweep), the wreck as it lies and the contacts, both trees
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const ext = (x, z, h) => { h = h || 0; x0 = Math.min(x0, x - h); x1 = Math.max(x1, x + h); z0 = Math.min(z0, z - h); z1 = Math.max(z1, z + h); };
    for (const r of [A, B]) { if (!r) continue;
      for (const p of r.prims) { if (p.k === 'c') ext(p.x, p.z, p.r); else if (p.k !== 's') for (let j = 0; j < p.p.length; j += 2) ext(p.p[j], p.p[j + 1], p.k === 'h' ? p.m : p.w / 2); }
      for (const H of r.rest) for (const q of H) ext(q[0], q[1], 0.5);
      for (let j = 0; j < r.contacts.length; j += 2) ext(r.contacts[j], r.contacts[j + 1]); }
    const span = Math.max(6, x1 - x0, (z1 - z0) * (PW - 2 * PAD) / (PH - TOP - PAD)) * 1.06, box = [(x0 + x1) / 2, (z0 + z1) / 2, span];
    const W = 2 * PW + 20, H = PH + 92;
    const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif">`, `<rect width="${W}" height="${H}" fill="#fff"/>`,
      `<text x="10" y="20" font-size="14" font-weight="bold">${esc(LAB[key])} - ${esc(A.label)}: the scar from above, before (DMG-SCAR) and after (DMG-SCAR2)</text>`,
      `<text x="10" y="37" font-size="10.5" fill="#333">pale: the grass culled (the craters' discs, the gouges' strips, the resting wreck's hulls + margin); the decal as laid (its own triangles: the soil map x its colours at their alpha); dashed discs: craters; brown lines: gouges' paths (black: the prop's slot);</text>`,
      `<text x="10" y="51" font-size="10.5" fill="#333">red: the scar's hulls; blue dashed: the wreck as it lies at the run's end (the gate's own reader: each piece's nodes within 1.2 m of the ground); grey dots: the ground contacts the gate saw. The sweep (shrubs only) is not drawn.</text>`];
    if (B) svg.push(panel(B, 'BEFORE - DMG-SCAR (4575e99f)', 0, 60, box));
    else svg.push(`<text x="20" y="200" font-size="12">(no base tree given: --before)</text>`);
    svg.push(panel(A, 'AFTER - DMG-SCAR2 (this tree)', PW + 20, 60, box));
    svg.push('</svg>');
    const f = path.join(OUT, key + '_' + id + '.svg'); fs.writeFileSync(f, svg.join('\n'));
    console.log('wrote ' + f + ' (' + (fs.statSync(f).size / 1024).toFixed(0) + ' KB)');
    const strip = r => r && { prims: r.prims, last: r.last, rest: r.rest, decalTris: r.tris.length, crashed: r.crashed, reason: r.reason };
    J.push({ key, id, label: A.label, before: strip(B), after: strip(A) });
  }
  fs.writeFileSync(path.join(OUT, 'cases.json'), JSON.stringify(J, null, 1));
})();
