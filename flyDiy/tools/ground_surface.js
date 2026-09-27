#!/usr/bin/env node
// GROUND SURFACE (A6-GROUND, G1001) — the DRAWN ground under each wheel against the height the wheel stands on, along a
// real taxi, in node.
//
// The wheel's contact is the core's world.terrainH at the wheel node (30_solver.js). What the eye sees under the tyre is
// a MESH: the pavement's drape (pavement.js stripGeometry / roadGeometry / polyGeometry: terrainH + lift x liftK at its
// vertices, linear between them) or the premises' ground patch (render_premises.js buildPatch: terrainH - 2 cm - the
// G660 sink on a 2 m grid, linear between). This rig builds those meshes with the page's own modules and arguments
// (pavement.js under node with the vendor three; the premises composition off tools/island_node.js), flies THE PILOT
// (43_pilot.js) out of a Jolene stand the way the game does (placeAtStand + departFrom), and at every step reads, for
// every wheel: the drawn surface right under the node (the mesh on top there), terrainH, and the tyre's drawn bottom
// (node y - r: tools/ground_gap.js measures the drawn tyre ON its node within 5 mm).
//
//   node tools/ground_surface.js [--build cub|stock|<json>] [--from HOME] [--secs 150] [--csv file] [--grid]
//     --grid: no flight - the surface gap on a 1 m grid over every paved polygon, road and strip on Jolene (the
//             statistics per surface kind: mean / p5 / p95 / worst, in mm)
// The gap printed is DRAWN SURFACE - CONTACT HEIGHT (mm): + = the drawn surface stands over the height the wheel meets
// (the tyre looks sunk), - = under it (the tyre looks afloat). "tyre" = drawn tyre bottom - drawn surface.
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname;
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const THREE = require(path.join(T, '..', 'vendor', 'three.min.js'));
const PAV = require(path.join(T, '..', 'src', 'viewer', 'pavement.js'));
const IN = require(path.join(T, 'island_node.js'));
const PG = C.PREMISES_GEN;

const FX = path.join(T, 'fixtures', 'island_jolene.json');
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(FX, 'utf8') });
const O = W.premises.overlay;
const hAt = W.terrainH;

// ---- the drawn meshes, built as the game builds them --------------------------------------------------------------
const LK = process.env.GS_LIFT != null ? +process.env.GS_LIFT : 1;   // a trial: the builders' lift scaled
const MESHES = [];         // { name, kind, order, pos (Float32Array), idx, dE (per vertex), grid }
function indexMesh(name, kind, order, g, d0) {
  const pos = g.attributes.position.array, idx = g.index.array, pav = g.attributes.aPav ? g.attributes.aPav.array : null;
  const CELL = 4, cells = new Map();
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let t = 0; t < idx.length; t += 3) {
    let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
    for (let k = 0; k < 3; k++) { const v = idx[t + k]; a0 = Math.min(a0, pos[v * 3]); a1 = Math.max(a1, pos[v * 3]); b0 = Math.min(b0, pos[v * 3 + 2]); b1 = Math.max(b1, pos[v * 3 + 2]); }
    x0 = Math.min(x0, a0); x1 = Math.max(x1, a1); z0 = Math.min(z0, b0); z1 = Math.max(z1, b1);
    for (let i = Math.floor(a0 / CELL); i <= Math.floor(a1 / CELL); i++) for (let j = Math.floor(b0 / CELL); j <= Math.floor(b1 / CELL); j++) {
      const k = i * 100003 + j; let L = cells.get(k); if (!L) cells.set(k, L = []); L.push(t);
    }
  }
  MESHES.push({ name, kind, order, pos, idx, pav, cells, CELL, box: [x0, z0, x1, z1], d0 });
}
// the mesh's own surface at (x, z): { y, dE } by barycentrics in xz, or null
function meshAt(M, x, z) {
  if (x < M.box[0] || x > M.box[2] || z < M.box[1] || z > M.box[3]) return null;
  const L = M.cells.get(Math.floor(x / M.CELL) * 100003 + Math.floor(z / M.CELL));
  if (!L) return null;
  const P = M.pos, I = M.idx;
  for (const t of L) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ax = P[a * 3], az = P[a * 3 + 2], bx = P[b * 3], bz = P[b * 3 + 2], cx = P[c * 3], cz = P[c * 3 + 2];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
    const y = l1 * P[a * 3 + 1] + l2 * P[b * 3 + 1] + l3 * P[c * 3 + 1];
    const dE = M.pav ? l1 * M.pav[a * 4 + 2] + l2 * M.pav[b * 4 + 2] + l3 * M.pav[c * 4 + 2] : 0;
    return { y, dE };
  }
  return null;
}
{
  const rec = O.rec;
  // the premises' roads (render_premises.js buildRoads, o.game)
  for (const rd of O.roads) {
    if (rd.ribbon === false) continue;
    const L = PG.RUNWAY_LOOKS[rd.look]; if (!L || !L.cls) continue;
    const RS = PAV.resolve(rd, rec, L);
    const pr = PG.polyRoad(rd.pts, rd.w);
    const g = PAV.roadGeometry(THREE, { road: pr, w: rd.w, shoulderW: PAV.shoulderFor(RS.band, RS.recipe), cls: RS.cls, seed: 1,
      toWorld: (x, z) => O.frame.toWorld(x, z), heightAt: hAt, lift: LK * 0.07, step: 3, resV: Math.max(0.5, rd.w / 6),
      sinkD0: PAV.opaqueDepth(RS.cls, rd.w / 2, RS.recipe) });
    indexMesh('road:' + rd.id, 'road', 3, g, PAV.opaqueDepth(RS.cls, rd.w / 2, RS.recipe));
  }
  // the paved polygons (buildPolys)
  for (const pp of O.pavePolys || []) {
    const L = PG.RUNWAY_LOOKS[pp.look]; if (!L || !L.cls) continue;
    const RS = PAV.resolve(pp, rec, L);
    const poly = pp.poly.map(q => O.frame.toWorld(q[0], q[1]));
    const g = PAV.polyGeometry(THREE, { poly, cls: RS.cls, seed: 1, shoulderW: PAV.shoulderFor(RS.band, RS.recipe), heightAt: hAt, lift: LK * 0.08, res: 2,
      yaw: (pp.yaw || 0) + O.frame.yaw, sinkD0: PAV.opaqueDepth(RS.cls, 1e3, RS.recipe) });
    indexMesh('pave:' + pp.id, 'apron', 2 + (pp.z || 0) * 0.01, g, PAV.opaqueDepth(RS.cls, 1e3, RS.recipe));
  }
  // the game's strips (render_world.js standStrip), on the patch
  for (const a of W.aerodromes) {
    if (!a.len || !a.wid || a.kind === 'water') continue;
    const LKp = a.premises && a.look ? PG.RUNWAY_LOOKS[a.look] : PG.RUNWAY_LOOKS[a.surface === W.SURFACE.PAVED ? 'asphalt' : a.surface === W.SURFACE.GRAVEL ? 'gravel' : 'grass'];
    if (!LKp || !LKp.cls) continue;
    const RS = PAV.resolve(a.premises ? a : null, a.premises ? rec : null, LKp);
    const g = PAV.stripGeometry(THREE, { len: a.len, wid: a.wid, hdg: a.hdg, cx: a.x, cz: a.z, shoulderW: PAV.shoulderFor(RS.band, RS.recipe), cls: RS.cls, seed: 1,
      heightAt: hAt, lift: LK * 0.07, resU: 6, resV: 3, sinkD0: a.premises && O.pavedAt ? PAV.opaqueDepth(RS.cls, a.wid / 2, RS.recipe) : null });
    indexMesh('strip:' + a.id, 'strip:' + RS.cls, 1.99, g, PAV.opaqueDepth(RS.cls, a.wid / 2, RS.recipe));
  }
}
// the premises' ground patch, level 0 (2 m grid, the diagonal (i+1, j)-(i, j+1)), sunk under the pavement (G660)
const pavR = PAV.resolve(null, O.rec, null).recipe;
const sinkOf = (x, z) => { const q = O.pavedAt(x, z); return q ? PAV.sinkAt(q.d, PAV.opaqueDepth(q.cls, q.halfW, pavR)) : 0; };
const patchV = (x, z) => hAt(x, z) - 0.02 - sinkOf(x, z);
function patchAt(x, z) {
  const R = 2, i = Math.floor(x / R), j = Math.floor(z / R), fu = x / R - i, fv = z / R - j;
  const x0 = i * R, z0 = j * R;
  // triangles (a, cc, b2) and (b2, cc, dd): a (i, j), b2 (i+1, j), cc (i, j+1), dd (i+1, j+1)
  if (fu + fv <= 1) return patchV(x0, z0) * (1 - fu - fv) + patchV(x0 + R, z0) * fu + patchV(x0, z0 + R) * fv;
  return patchV(x0 + R, z0 + R) * (fu + fv - 1) + patchV(x0 + R, z0) * (1 - fv) + patchV(x0, z0 + R) * (1 - fu);
}
// what the eye sees at (x, z): the pavement on top where it is opaque (inside its edge), else the patch
function drawnAt(x, z) {
  let best = null;
  for (const M of MESHES) {
    const q = meshAt(M, x, z);
    if (!q || q.dE < 0.3) continue;
    if (!best || M.order > best.order) best = { y: q.y, kind: M.kind, name: M.name, order: M.order, dE: q.dE };
  }
  if (best) return best;
  return { y: patchAt(x, z), kind: 'ground', name: 'patch', dE: -1 };
}

const pct = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const stat = a => ({ n: a.length, mean: a.reduce((s, x) => s + x, 0) / Math.max(1, a.length), p5: pct(a, 0.05), p95: pct(a, 0.95), min: a.reduce((m, x) => Math.min(m, x), Infinity), max: a.reduce((m, x) => Math.max(m, x), -Infinity) });
const fmt = s => s.n ? `n ${String(s.n).padStart(6)}  mean ${s.mean.toFixed(1).padStart(6)}  p5 ${s.p5.toFixed(1).padStart(6)}  p95 ${s.p95.toFixed(1).padStart(6)}  min ${s.min.toFixed(1).padStart(6)}  max ${s.max.toFixed(1).padStart(6)}` : 'n 0';

if (argv.includes('--sep')) {
  // the pavement over the ground patch: drawn pavement - drawn patch (mm), where the pavement is seen (dE > -1.2 m, the
  // side fade's reach), by zone: side (dE < 0), edge (0..d0, not yet opaque for sure), band (d0..d0 + 8 m), interior
  const Z = {};
  for (const M of MESHES) for (let x = Math.ceil(M.box[0]); x <= M.box[2]; x += 0.5) for (let z = Math.ceil(M.box[1]); z <= M.box[3]; z += 0.5) {
    const px = x + 0.137, pz = z + 0.291, q = meshAt(M, px, pz);
    if (!q || q.dE < -1.2) continue;
    const zone = q.dE < 0 ? 'side' : q.dE < M.d0 ? 'edge' : q.dE < M.d0 + 8 ? 'band' : 'interior';
    const k = M.kind.replace(/^strip:/, '') + ' ' + zone;
    (Z[k] = Z[k] || []).push(1000 * (q.y - patchAt(px, pz)));
  }
  console.log('DRAWN PAVEMENT - DRAWN PATCH (mm), 0.5 m grid, where the pavement is seen');
  for (const k of Object.keys(Z).sort()) { const a = Z[k], s = stat(a), neg = a.filter(v => v < 5).length;
    console.log('  ' + k.padEnd(22) + fmt(s) + '  p1 ' + pct(a, 0.01).toFixed(1).padStart(6) + '  under 5 mm ' + neg); }
  process.exit(0);
}

if (arg('--probe', null)) {                   // the worst points of one mesh past 1.5 m: where and why
  const M = MESHES.find(m => m.name === arg('--probe')), pts = [];
  for (let x = Math.ceil(M.box[0]); x <= M.box[2]; x += 0.5) for (let z = Math.ceil(M.box[1]); z <= M.box[3]; z += 0.5) {
    const q = meshAt(M, x + 0.13, z + 0.29); if (!q || q.dE < 1.5) continue;
    const h = hAt(x + 0.13, z + 0.29);
    // the terrain's curvature there: the second difference over 3 m, x and z
    const c2 = (hAt(x + 3, z) + hAt(x - 3, z) - 2 * h) / 9, c3 = (hAt(x, z + 3) + hAt(x, z - 3) - 2 * h) / 9;
    pts.push([1000 * (q.y - h), x, z, q.dE, c2, c3]);
  }
  pts.sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]));
  for (const p of pts.slice(0, 12)) console.log('  gap ' + p[0].toFixed(1) + ' mm at (' + p[1] + ', ' + p[2] + ') dE ' + p[3].toFixed(2) + '  h_xx ' + p[4].toFixed(4) + ' h_zz ' + p[5].toFixed(4));
  process.exit(0);
}

if (argv.includes('--grid')) {
  const byKind = {};
  for (const M of MESHES) {
    for (let x = Math.ceil(M.box[0]); x <= M.box[2]; x += 1) for (let z = Math.ceil(M.box[1]); z <= M.box[3]; z += 1) {
      const q = meshAt(M, x + 0.37, z + 0.61); if (!q || q.dE < 0.3) continue;
      const d = drawnAt(x + 0.37, z + 0.61); if (d.name !== M.name) continue;
      const kk = M.kind + (q.dE < 1.5 ? ' dE<1.5' : '');
      (byKind[kk] = byKind[kk] || []).push(1000 * (q.y - hAt(x + 0.37, z + 0.61)));
    }
  }
  // the ground patch over the premises' extent on the paved and strip grass
  const gr = [];
  for (const M of MESHES) if (/strip/.test(M.kind)) for (let x = Math.ceil(M.box[0]); x <= M.box[2]; x += 3) for (let z = Math.ceil(M.box[1]); z <= M.box[3]; z += 3) {
    const d = drawnAt(x + 0.37, z + 0.61); if (d.kind !== 'ground') continue;
    gr.push(1000 * (d.y - hAt(x + 0.37, z + 0.61)));
  }
  byKind.ground_near_strips = gr;
  if (argv.includes('--worst')) {           // the meshes by their p95 |gap| past 1.5 m
    const per = [];
    for (const M of MESHES) { const a = [];
      for (let x = Math.ceil(M.box[0]); x <= M.box[2]; x += 1) for (let z = Math.ceil(M.box[1]); z <= M.box[3]; z += 1) {
        const q = meshAt(M, x + 0.37, z + 0.61); if (!q || q.dE < 1.5) continue;
        a.push(Math.abs(1000 * (q.y - hAt(x + 0.37, z + 0.61)))); }
      if (a.length) per.push([M.name, a.length, pct(a, 0.5), pct(a, 0.95), a.reduce((m, v) => Math.max(m, v), 0)]); }
    per.sort((p, q) => q[3] - p[3]);
    for (const r of per.slice(0, 25)) console.log('  ' + r[0].padEnd(28) + ' n ' + String(r[1]).padStart(6) + '  |gap| p50 ' + r[2].toFixed(1) + '  p95 ' + r[3].toFixed(1) + '  max ' + r[4].toFixed(1));
  }
  console.log('DRAWN SURFACE - terrainH (mm), per surface kind, 1 m grid (ground: 3 m)');
  for (const k in byKind) console.log('  ' + k.padEnd(20) + fmt(stat(byKind[k])));
  process.exit(0);
}

// ---- the flight: the pilot out of the stand, as the game departs --------------------------------------------------
const key = arg('--build', 'cub');
const S = PT.specOf(key);
const def = C.buildGen(S.spec);
const sim = C.makeSim(def, W);
sim.reset(0);
const from = W.aerodromes.find(a => a.id === arg('--from', 'HOME'));
const site = C.siteOf(from.id);
if (sim.stance) sim.stance();
C.placeAtStand(sim, from, site.stand);
for (let i = 0; i < 600; i++) sim.step(1 / 60);
const ap = C.makePilot(sim, def, W, { style: 'normal' });
ap.setRoute(from, from); ap.departFrom(from, from, site);
const wheels = [...def.refs.mains, def.refs.tw].filter(i => i != null && i >= 0);
const names = wheels.map(i => i === def.refs.tw ? (def.spec.gear.type === 'tricycle' ? 'nose' : 'tail') : (def.nodes[i].p[2] > 0 ? 'mainL' : 'mainR'));
const secs = +arg('--secs', 150);
const rows = [], per = {};
let t = 0, maxV = 0;
for (let k = 0; k < secs * 60; k++) {
  ap.update(1 / 60);
  sim.step(1 / 60);
  t += 1 / 60;
  const cv = sim.cgVel(), V = Math.hypot(cv[0], cv[2]);
  maxV = Math.max(maxV, V);
  const ph = ap.phase || (ap.state && ap.state.phase) || '';
  if (V > 16) break;                                    // the take-off roll is under way: the taxi is done
  if (k % 6) continue;                                  // 10 Hz
  const row = { t: +t.toFixed(2), V: +V.toFixed(2), ph };
  // THE RIDE: the CG over the ground under the wheels (mean) and the pitch - the bob a soft gear would show
  { const cg = sim.cgPos(); let gm = 0; for (const i of wheels) gm += hAt(sim.p[i * 3], sim.p[i * 3 + 2]); gm /= wheels.length;
    const xa = sim.axes()[0]; row.cgh = cg[1] - gm; row.pitch = Math.atan2(-xa[1], Math.hypot(xa[0], xa[2])) * 180 / Math.PI; }
  wheels.forEach((i, w) => {
    const x = sim.p[i * 3], y = sim.p[i * 3 + 1], z = sim.p[i * 3 + 2];
    const h = hAt(x, z), d = drawnAt(x, z), r = def.nodes[i].r;
    const gap = 1000 * (d.y - h), tyre = 1000 * (y - r - d.y);
    row[names[w]] = { kind: d.kind, gap: +gap.toFixed(1), tyre: +tyre.toFixed(1) };
    const P = per[names[w] + ' on ' + d.kind] = per[names[w] + ' on ' + d.kind] || { gap: [], tyre: [] };
    P.gap.push(gap); P.tyre.push(tyre);
  });
  rows.push(row);
}
console.log(`${S.name || key} out of ${from.id}'s stand: ${t.toFixed(1)} s, V max ${maxV.toFixed(1)} m/s, ${rows.length} samples`);
console.log('drawn surface - terrainH (mm):');
for (const k in per) console.log('  ' + k.padEnd(22) + fmt(stat(per[k].gap)));
console.log('drawn tyre bottom - drawn surface (mm; + = afloat, - = sunk):');
for (const k in per) console.log('  ' + k.padEnd(22) + fmt(stat(per[k].tyre)));
// the bob: the CG height and the pitch less their 2 s running mean, in the taxi (1 < V < 12 m/s), RMS and peak
{
  const T = rows.filter(r => r.V > 1 && r.V < 12), W2 = 10;
  const hp = k => T.map((r, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - W2); j <= Math.min(T.length - 1, i + W2); j++) { s += T[j][k]; n++; } return r[k] - s / n; });
  const rms = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length)), pk = a => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const h = hp('cgh'), q = hp('pitch');
  console.log(`the ride in the taxi (1-12 m/s, ${T.length} samples at 10 Hz, less the 2 s mean): CG height rms ${(1000 * rms(h)).toFixed(1)} mm, peak ${(1000 * pk(h)).toFixed(1)} mm; pitch rms ${rms(q).toFixed(3)} deg, peak ${pk(q).toFixed(3)} deg`);
}
const csv = arg('--csv', null);
if (csv) {
  const head = ['t', 'V', 'ph'].concat(...names.map(n => [n + '_kind', n + '_gap', n + '_tyre']));
  fs.writeFileSync(csv, head.join(',') + '\n' + rows.map(r => [r.t, r.V, r.ph].concat(...names.map(n => [r[n].kind, r[n].gap, r[n].tyre])).join(',')).join('\n'));
  console.log('csv: ' + csv);
}
