#!/usr/bin/env node
// GROUND DRAWN (G1540, GROUND-LATTICE) — the WHOLE drawn ground the eye sees under a wheel, against the height the
// wheel stands on, at every aerodrome of Jolene, in node.
//
// G1380 (GEAR-WATER) measured the open ground's 5 m lattice and G1001 (A6-GROUND) the pavement and the premises' patch,
// each alone. This rig stacks them the way the page does and asks which one is ON TOP where a tyre is:
//   - the PAVEMENT (pavement.js stripGeometry / roadGeometry / polyGeometry, render_premises' and render_world's own
//     arguments): opaque inside its edge (aPav dE >= 0.3 m, G1004's trap 1), drawn at terrainH there since G1001;
//   - the premises' GROUND PATCH (render_premises.js buildPatchSteps): 64 m chunks over what the record touches
//     (activeChunks, LIFTED from the source), a 2 m world grid, the diagonal (i+1, j)-(i, j+1), its vertex law LIFTED
//     too: terrainH - PATCH_TUCK.drop r - tuck (1 - r)^2 - the pavement's sink;
//   - the FINE TILES (render_world.js FINE.build): FINE.step (LIFTED) on the world grid, terrainH - ringSink, the
//     a-b-d / b-c-d split - where the patch tucks under them or is not built at all.
// Opaque ground over opaque ground: the higher one is seen (the patch / fine pair), the pavement over both.
//
//   node tools/ground_drawn.js [--lattice] [--stands] [--taxi] [--builds cub,jodel,cessna] [--secs 90] [--json f]
//     (no section flag: all three)
//   --lattice  drawn - terrainH (mm) over every Jolene aerodrome's footprint (the runway box + 120 m, 1 m jittered
//              grid), per layer on top, and per POSITION IN THE LATTICE CELL (vertex / edge / centre)
//   --stands   each build placed at each stand (siteOf().stand, placeAtStand), settled; per wheel: the DRAWN tyre's
//              least height over the drawn ground (tools/ground_gap.js poseWheels: the editor's own wheel meshes posed
//              by app.js poseModel's arithmetic, TW_DRAW_DROP read off app.js) and the physics contact over terrainH
//   --taxi     THE PILOT out of HOME's and w3's stands (placeAtStand + departFrom, ground_surface.js's flight) until
//              the take-off roll; the same per wheel, 10 Hz, by the layer on top
// FLYDIY_GROUND_RASTER=1 (the page's default since build.js: ?raster=0 turns it off) for the page's own terrainH.
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ALL = !argv.some(a => /^--(lattice|stands|taxi|none)$/.test(a));   // --none: the module alone (require it)
const DO = { lattice: ALL || argv.includes('--lattice'), stands: ALL || argv.includes('--stands'), taxi: ALL || argv.includes('--taxi') };
const BUILDS = { cub: path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), jodel: path.join(ROOT, 'builds', 'jodel_2026-09-20_corrected.json'),
  cessna: path.join(ROOT, 'bugReports', 'cessnaMetal (1).json') };
const buildKeys = String(arg('--builds', 'cub,jodel,cessna')).split(',');

let GG = null;   // tools/ground_gap.js (poseWheels, the panel's core): loaded only for --stands / --taxi
const TWD = (() => { const m = /const TW_DRAW_DROP = ([\d.]+);/.exec(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8')); return m ? +m[1] : 0; })();
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const PAV = require(path.join(ROOT, 'src', 'viewer', 'pavement.js'));
const IN = require(path.join(T, 'island_node.js'));
const PG = C.PREMISES_GEN;
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const O = W.premises.overlay;
const hAt = W.terrainH, hB = W.terrainHBuild || W.terrainH;   // the wheels' ground; the meshes' build read (G1406)
const RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');

// ---- the patch, its chunks and its law lifted from render_premises.js (tools/_patch_law.js) --------------------------
const PATCH = require(path.join(T, '_patch_law.js'))(O, PG, hB);
const covers = PATCH.covers, sinkOf = PATCH.sinkOf, PRES = PATCH.R, patchAt = PATCH.at;
// ---- the fine tiles (render_world.js FINE), their step lifted -------------------------------------------------------
const FSTEP = +(/const FINE = \{[^}]*?step: ([\d.]+)/.exec(RW) || [])[1];
const INNER = +(/INNER = (\d+);/.exec(RW) || [])[1];
const FR = +(/const FINE = \{[^}]*?R: (\d+)/.exec(RW) || [])[1], FBAND = +(/const FINE = \{[^}]*?band: (\d+)/.exec(RW) || [])[1];
if (!(FSTEP > 0) || !(INNER > 0)) throw new Error('ground_drawn: FINE.step / INNER not found in render_world.js');
const fineV = (x, z) => hAt(x, z) - PATCH.ringSink(x, z);   // (ringSink is 0 off the patch)
function fineAt(x, z) {
  const s = FSTEP, u = x / s, v = z / s, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, X = i * s, Z = j * s;
  const ha = fineV(X, Z), hb = fineV(X, Z + s), hc = fineV(X + s, Z + s), hd = fineV(X + s, Z);
  return fu + fv <= 1 ? ha + fv * (hb - ha) + fu * (hd - ha) : hc + (1 - fu) * (hb - hc) + (1 - fv) * (hd - hc);
}
const fineOn = (x, z) => Math.max(Math.abs(x), Math.abs(z)) <= INNER - FR - FBAND - 50;   // FINE.update's `far` (eye at the wheel)

// ---- the pavement, built as the game builds it (tools/ground_surface.js's meshes, the kind argument as the page) ------
const MESHES = [];
function indexMesh(name, kind, order, g) {
  const pos = g.attributes.position.array, idx = g.index.array, pav = g.attributes.aPav ? g.attributes.aPav.array : null;
  const CELL = 4, cells = new Map(); let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let t = 0; t < idx.length; t += 3) {
    let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
    for (let k = 0; k < 3; k++) { const v = idx[t + k]; a0 = Math.min(a0, pos[v * 3]); a1 = Math.max(a1, pos[v * 3]); b0 = Math.min(b0, pos[v * 3 + 2]); b1 = Math.max(b1, pos[v * 3 + 2]); }
    x0 = Math.min(x0, a0); x1 = Math.max(x1, a1); z0 = Math.min(z0, b0); z1 = Math.max(z1, b1);
    for (let i = Math.floor(a0 / CELL); i <= Math.floor(a1 / CELL); i++) for (let j = Math.floor(b0 / CELL); j <= Math.floor(b1 / CELL); j++) {
      const k = i * 100003 + j; let L = cells.get(k); if (!L) cells.set(k, L = []); L.push(t); }
  }
  MESHES.push({ name, kind, order, pos, idx, pav, cells, CELL, box: [x0, z0, x1, z1] });
}
function meshAt(M, x, z) {
  if (x < M.box[0] || x > M.box[2] || z < M.box[1] || z > M.box[3]) return null;
  const L = M.cells.get(Math.floor(x / M.CELL) * 100003 + Math.floor(z / M.CELL)); if (!L) return null;
  const P = M.pos, I = M.idx;
  for (const t of L) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ax = P[a * 3], az = P[a * 3 + 2], bx = P[b * 3], bz = P[b * 3 + 2], cx = P[c * 3], cz = P[c * 3 + 2];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
    return { y: l1 * P[a * 3 + 1] + l2 * P[b * 3 + 1] + l3 * P[c * 3 + 1], dE: M.pav ? l1 * M.pav[a * 4 + 2] + l2 * M.pav[b * 4 + 2] + l3 * M.pav[c * 4 + 2] : 0 };
  }
  return null;
}
{
  const rec = O.rec;
  for (const rd of O.roads) {
    if (rd.ribbon === false) continue;
    const L = PG.RUNWAY_LOOKS[rd.look]; if (!L || !L.cls) continue;
    const RS = PAV.resolve(rd, rec, L), pr = PG.polyRoad(rd.pts, rd.w);
    indexMesh('road:' + rd.id, 'road', 3, PAV.roadGeometry(THREE, { road: pr, w: rd.w, shoulderW: PAV.shoulderFor(RS.band, RS.recipe), cls: RS.cls, seed: 1,
      toWorld: (x, z) => O.frame.toWorld(x, z), heightAt: hB, lift: 0.07, step: 3, resV: Math.max(0.5, rd.w / 6), sinkD0: PAV.opaqueDepth(RS.cls, rd.w / 2, RS.recipe, 'road') }));
  }
  for (const pp of O.pavePolys || []) {
    const L = PG.RUNWAY_LOOKS[pp.look]; if (!L || !L.cls) continue;
    const RS = PAV.resolve(pp, rec, L), poly = pp.poly.map(q => O.frame.toWorld(q[0], q[1]));
    indexMesh('pave:' + pp.id, 'apron:' + RS.cls, 2 + (pp.z || 0) * 0.01, PAV.polyGeometry(THREE, { poly, cls: RS.cls, seed: 1, shoulderW: PAV.shoulderFor(RS.band, RS.recipe), heightAt: hB, lift: 0.08, res: 2,
      yaw: (pp.yaw || 0) + O.frame.yaw, sinkD0: PAV.opaqueDepth(RS.cls, 1e3, RS.recipe, 'poly') }));
  }
  for (const a of W.aerodromes) {
    if (!a.len || !a.wid || a.kind === 'water') continue;
    const LKp = a.premises && a.look ? PG.RUNWAY_LOOKS[a.look] : PG.RUNWAY_LOOKS[a.surface === W.SURFACE.PAVED ? 'asphalt' : a.surface === W.SURFACE.GRAVEL ? 'gravel' : 'grass'];
    if (!LKp || !LKp.cls) continue;
    const RS = PAV.resolve(a.premises ? a : null, a.premises ? rec : null, LKp);
    indexMesh('strip:' + a.id, 'strip:' + RS.cls, 1.99, PAV.stripGeometry(THREE, { len: a.len, wid: a.wid, hdg: a.hdg, cx: a.x, cz: a.z, shoulderW: PAV.shoulderFor(RS.band, RS.recipe), cls: RS.cls, seed: 1,
      heightAt: W.terrainH, lift: 0.07, resU: 6, resV: 3, sinkD0: a.premises && O.pavedAt ? PAV.opaqueDepth(RS.cls, a.wid / 2, RS.recipe, 'strip') : null }));
  }
}
// THE DRAWN GROUND at (x, z): { y, kind, fu, fv (the position in the cell of the lattice on top) }
function drawnAt(x, z) {
  let best = null;
  for (const M of MESHES) { const q = meshAt(M, x, z); if (!q || q.dE < 0.3) continue; if (!best || M.order > best.order) best = { y: q.y, kind: M.kind + (q.dE < 1.5 ? ' rim' : ''), order: M.order }; }
  if (best) return best;
  const pOn = covers(x, z), fOn = fineOn(x, z);
  const p = pOn ? patchAt(x, z) : -Infinity, f = fOn ? fineAt(x, z) : -Infinity;
  if (!pOn && !fOn) return { y: NaN, kind: 'far' };
  if (p >= f) return { y: p, kind: 'patch', fu: x / PRES - Math.floor(x / PRES), fv: z / PRES - Math.floor(z / PRES) };
  return { y: f, kind: 'fine', fu: x / FSTEP - Math.floor(x / FSTEP), fv: z / FSTEP - Math.floor(z / FSTEP) };
}

const pct = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const stat = a => ({ n: a.length, mean: a.reduce((s, x) => s + x, 0) / Math.max(1, a.length), p5: pct(a, 0.05), p50: pct(a, 0.5), p95: pct(a, 0.95), min: a.reduce((m, x) => Math.min(m, x), Infinity), max: a.reduce((m, x) => Math.max(m, x), -Infinity) });
const fmt = s => s.n ? `n ${String(s.n).padStart(6)}  mean ${s.mean.toFixed(1).padStart(6)}  p5 ${s.p5.toFixed(1).padStart(6)}  p50 ${s.p50.toFixed(1).padStart(6)}  p95 ${s.p95.toFixed(1).padStart(6)}  min ${s.min.toFixed(1).padStart(6)}  max ${s.max.toFixed(1).padStart(6)}` : 'n 0';
const dropW3 = (() => { const st = C.siteOf('w3') && C.siteOf('w3').stand; return st ? PATCH.dropAt(st.x, st.z) : NaN; })();   // w3's stand: the patch's open grass
const OUT = { patchDropW3: dropW3, fineStep: FSTEP, twDrawDrop: TWD, raster: process.env.FLYDIY_GROUND_RASTER === '1' };
console.log(`GROUND DRAWN: the patch's drop at w3's stand (open grass) ${(dropW3 * 1000).toFixed(0)} mm, its grid ${PRES} m; FINE.step ${FSTEP} m; TW_DRAW_DROP ${(TWD * 1000).toFixed(0)} mm; ` +
  `terrainH ${OUT.raster ? 'the premises raster (the page\'s default)' : 'analytic (FLYDIY_GROUND_RASTER unset)'}; ${MESHES.length} pavement meshes, ${PATCH.act.act.size} patch chunks`);

// ---- 1. the lattice ------------------------------------------------------------------------------------------------
if (DO.lattice) {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const LZ = O.rec.layers.zones.filter(z => z.poly && z.poly.length >= 3 && ['residential', 'commercial', 'industrial', 'harbour', 'park'].indexOf(z.kind) >= 0);
  const inLotZone = (x, z) => { const L = O.frame.toLocal(x, z); return LZ.some(zn => PG.sdPoly(zn.poly, L[0], L[1]) < 12); };
  const by = {}, cellBins = { patch: {}, fine: {} };
  const binOf = (fu, fv) => { const e = Math.min(fu, 1 - fu, fv, 1 - fv), dg = Math.abs(fu + fv - 1); return Math.hypot(Math.min(fu, 1 - fu), Math.min(fv, 1 - fv)) < 0.15 ? 'vertex' : e < 0.1 ? 'edge' : dg < 0.1 ? 'diagonal' : 'interior'; };
  for (const a of W.aerodromes) {
    if (!a.len || !a.wid || a.kind === 'water') continue;
    const c = Math.cos(a.hdg), s = Math.sin(a.hdg), HL = a.len / 2 + 120, HW = a.wid / 2 + 120;
    for (let u = -HL; u <= HL; u += 1) for (let v = -HW; v <= HW; v += 1) {
      const uu = u + rnd() - 0.5, vv = v + rnd() - 0.5;
      const x = a.x + uu * c + vv * s, z = a.z + uu * s - vv * c;   // along (cos, sin) the heading, across it (GATE CONTACT's frame)
      const d = drawnAt(x, z); if (d.kind === 'far') continue;
      const e = 1000 * (d.y - hAt(x, z));
      (by[d.kind] = by[d.kind] || []).push(e);
      // the patch's OPEN grass (the same points in any tree: 3 m and more off any pavement by pavedNear, outside the lots'
      // zones, past the border's tuck) - where a tyre on the patch stands; the cell bins are that subset's
      const open = d.kind === 'patch' && PATCH.patchDepth(x, z) >= PATCH.PATCH_TUCK.tuckW && !O.pavedNear(x, z, 3, null) && !inLotZone(x, z);
      if (open) (by['patch, open grass'] = by['patch, open grass'] || []).push(e);
      if (cellBins[d.kind] && (open || d.kind === 'fine')) { const b = binOf(d.fu, d.fv); (cellBins[d.kind][b] = cellBins[d.kind][b] || []).push(e); }
    }
  }
  console.log('\n1. THE LATTICE - drawn ground on top - terrainH (mm; - = drawn under the wheels\' surface: a tyre reads afloat), every Jolene aerodrome\'s runway box + 120 m, 1 m jittered');
  for (const k of Object.keys(by).sort()) console.log('  ' + k.padEnd(16) + fmt(stat(by[k])) + '   |e| p95 ' + pct(by[k].map(Math.abs), 0.95).toFixed(1));
  for (const L of ['patch', 'fine']) { const B = cellBins[L]; if (!Object.keys(B).length) continue;
    console.log('  ' + (L === 'patch' ? 'the patch\'s open grass' : 'fine') + ' by position in its ' + (L === 'patch' ? PRES : FSTEP) + ' m cell:');
    for (const b of ['vertex', 'edge', 'diagonal', 'interior']) if (B[b]) console.log('    ' + b.padEnd(10) + fmt(stat(B[b])) + '   |e| p95 ' + pct(B[b].map(Math.abs), 0.95).toFixed(1)); }
  OUT.lattice = Object.fromEntries(Object.entries(by).map(([k, a]) => [k, stat(a)]));
}

// ---- the aeroplanes --------------------------------------------------------------------------------------------------
if (DO.stands || DO.taxi) GG = require(path.join(T, 'ground_gap.js'));
const planes = !(DO.stands || DO.taxi) ? [] : buildKeys.map(k => {
  const file = BUILDS[k] || k, raw = JSON.parse(fs.readFileSync(file, 'utf8')), spec = raw.spec || raw;
  const r = GG.BJ.bakeJoined(spec);
  const vis = r.W.CAGE_JOIN.snapshot(r.spec);
  return { key: k, spec: r.spec, vis };
});
// (the tyre's lowest vertices ask the drawn ground at points 1 cm apart: memoised on a 1 cm grid, cleared each sample)
const gMemo = new Map();
const gndDrawn = (x, z) => { const k = Math.round(x * 100) * 1e7 + Math.round(z * 100); let y = gMemo.get(k); if (y === undefined) { y = drawnAt(x, z).y; gMemo.set(k, y); } return y; };
function wheelRow(def, sim, vis) {
  gMemo.clear();
  const ws = GG.poseWheels(def, sim, vis, gndDrawn), rC = sim.rC;
  return ws.map(w => { const d = drawnAt(w.node[0], w.node[2]);
    return { kind: w.kind === 'tw' ? (def.spec.gear.type === 'tricycle' ? 'nose' : 'tail') : w.kind, on: d.kind,
      tyre: 1000 * w.clear,                                                       // the drawn tyre over the drawn ground
      contact: 1000 * (w.node[1] - (rC ? rC[w.idx] : def.nodes[w.idx].r) - hAt(w.node[0], w.node[2])),   // physics: the contact over terrainH
      ground: 1000 * (d.y - hAt(w.node[0], w.node[2])) }; });
}
function settleAt(P, a) {
  const def = C.buildGen(JSON.parse(JSON.stringify(P.spec)));
  const sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
  const site = C.siteOf(a.id); C.placeAtStand(sim, a, site.stand);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  return { def, sim, site };
}
if (DO.stands) {
  console.log('\n2. THE STANDS - the drawn tyre\'s least height over the drawn ground (mm; + = afloat, - = into it), and the physics contact over terrainH, settled 10 s');
  OUT.stands = [];
  for (const a of W.aerodromes) {
    const site = C.siteOf(a.id); if (!site || !site.stand || a.kind === 'water') continue;
    for (const P of planes) {
      const { def, sim } = settleAt(P, a), rows = wheelRow(def, sim, P.vis);
      console.log('  ' + (a.id + ' ' + P.key).padEnd(16) + rows.map(r => `${r.kind} on ${r.on}: tyre ${r.tyre.toFixed(1)} (ground ${r.ground.toFixed(1)}, contact ${r.contact.toFixed(1)})`).join('  |  '));
      OUT.stands.push({ aero: a.id, build: P.key, wheels: rows });
    }
  }
}
if (DO.taxi) {
  const secs = +arg('--secs', 90);
  console.log(`\n3. THE TAXI - THE PILOT out of the stand until the roll (V > 16 m/s) or ${secs} s; per wheel and layer on top, 10 Hz: drawn tyre over drawn ground (mm)`);
  OUT.taxi = [];
  for (const id of String(arg('--from', 'HOME,w3')).split(',')) {
    const a = W.aerodromes.find(q => q.id === id); if (!a) continue;
    for (const P of planes) {
      const { def, sim, site } = settleAt(P, a);
      const ap = C.makePilot(sim, def, W, { style: 'normal' }); ap.setRoute(a, a); ap.departFrom(a, a, site);
      const per = {}; let t = 0;
      for (let k = 0; k < secs * 60; k++) {
        ap.update(1 / 60); sim.step(1 / 60); t += 1 / 60;
        const cv = sim.cgVel(); if (Math.hypot(cv[0], cv[2]) > 16) break;
        if (k % 6) continue;
        for (const r of wheelRow(def, sim, P.vis)) { const q = per[r.kind + ' on ' + r.on] = per[r.kind + ' on ' + r.on] || []; q.push(r.tyre); }
      }
      console.log(`  ${id} ${P.key} (${t.toFixed(1)} s)`);
      for (const k of Object.keys(per).sort()) console.log('    ' + k.padEnd(22) + fmt(stat(per[k])));
      OUT.taxi.push({ aero: id, build: P.key, secs: t, per: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, stat(v)])) });
    }
  }
}
const jf = arg('--json', null);
if (jf) { fs.writeFileSync(jf, JSON.stringify(OUT, null, 1)); console.log('json: ' + jf); }
module.exports = { drawnAt, patchAt, fineAt, PATCH, FSTEP, W, sinkOf, covers, MESHES, meshAt };
