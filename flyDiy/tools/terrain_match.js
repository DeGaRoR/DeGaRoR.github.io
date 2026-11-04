#!/usr/bin/env node
// TERRAIN MATCH (G2115, TERRAIN-MATCH) - THE DRAWN GROUND AGAINST THE SOLVER'S, WHERE WHEELS AND WRECKAGE TOUCH, at every
// Jolene aerodrome, in node.
//
// The wheels, the wreck's nodes and WRECK_DEBRIS's bodies stand on world.terrainH (the premises raster, the page's
// default). The eye sees the ground the page draws: tools/ground_drawn.js's stack (the pavement on top where it is
// opaque, else the higher of the premises' patch and the layer under it), and - new here - the layer under the patch
// where the fine tiles do not reach (|x| or |z| past INNER - R - band - 50: mn_strip, nv_strip, tw_ski): the FAR
// TERRAIN (render_world.js FARLOD's cut of the island's quadtree, its patch triangles, the far tier's sink under the
// premises), cut for an eye 10 m from the point, 3 m over the ground, at the preset's terrain tolerance.
//
//   node tools/terrain_match.js [--preset gamer|potato] [--json f] [--site <id substring>] [--notier] [--brief] [--tol mm]
//     --notier  the ground as drawn away from the aeroplane (no contact tier: ground_tier.js)
//     FLYDIY_GROUND_RASTER=1 is set by the rig itself (the page's terrainH)
//
// THE SITES, per aerodrome (a land strip with a premises record):
//   stand      the stand +-12 m (0.5 m grid) - where the aeroplane parks and a wreck is towed back to
//   strip      the runway box past the pavement's lift (dE >= SINK.liftIn: where the drawn pavement is at terrainH by
//              law, G1001), 1 m jittered grid;  strip rim: the outer liftIn, reported (the side's lift is G1001's law)
//   overrun    past each end, 0..100 m, the runway's width + 5 m each side, 1 m jittered
//   lane       the declared way out (siteOf().taxiOut / taxiOut1, from the stand) +-3 m across, 0.5 m along
// A pavement's own EDGE (pavedAt's paved extent under SINK.liftIn: its side's fade outside the edge, its lift inside) is
// taken out of every site and reported as '<site> (edges)': G1001 keeps 7 cm between the pavement and the patch there and
// G1541 2 cm under the side - by law, the wheels on the pavement past it or on the grass past the side
// Per site: n, the median |drawn - terrainH|, p95, the worst (signed; + drawn over the solver: a resting tyre reads
// sunk, - under: afloat) and where, and the layer on top there. The verdict line: every stand / strip / lane / overrun
// within --tol mm (default 10) at p95 and worst.
'use strict';
process.env.FLYDIY_GROUND_RASTER = process.env.FLYDIY_GROUND_RASTER || '1';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const GD = (() => { const a = process.argv; a.push('--none'); try { return require(path.join(T, 'ground_drawn.js')); } finally { a.pop(); } })();
const C = require(path.join(T, 'flight_core.js'));
const PAV = require(path.join(ROOT, 'src', 'viewer', 'pavement.js'));
const W = GD.W, O = W.premises.overlay, I = W.island;
const RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
const GFX = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'gfx_settings.js'), 'utf8');
const INNER = +(/INNER = (\d+);/.exec(RW) || [])[1];
const FR = +(/const FINE = \{[^}]*?R: (\d+)/.exec(RW) || [])[1], FBAND = +(/const FINE = \{[^}]*?band: (\d+)/.exec(RW) || [])[1];
const RIME = +(/const FARLOD = \{[^}]*?rimE: ([\d.]+)/.exec(RW) || [])[1];
const PRESET = arg('--preset', 'gamer');
// the preset's terrain tolerance (gfx_settings PRESETS terrain) and scale (the drawing buffer's height: the cut's K)
const presetRow = (() => { const m = new RegExp(PRESET + ':\\s+Object\\.assign\\(\\{([^}]*)\\}').exec(GFX); if (!m) throw new Error('terrain_match: no preset ' + PRESET); return m[1]; })();
const TOLPX = Math.max(1, +(/terrain: (\d+)/.exec(presetRow) || [])[1] || 1), SCALE = +(/scale: ([\d.]+)/.exec(presetRow) || [])[1] || 1;
const K = 1080 * SCALE / (2 * Math.tan(46 * Math.PI / 360));   // FARLOD.update: H / (2 tan(fov / 2)), a 1080-line screen
const TOL = +arg('--tol', 10);

// ---- the far terrain (render_world.js FARLOD: patchOf's vertex law, cutFor's walk, TPL's triangles) ------------------
const FH = I.farHeader, NP = FH.patch, NN1 = NP + 1;
const hts = n => { if (!n.q) return n.h; if (n._h) return n._h; const h = new Float64Array(n.q.length); for (let k = 0; k < n.q.length; k++) h[k] = n.h0 + n.q[k] * n.sc; return (n._h = h); };
(function measure(n) {   // the node's height range and its error against its descendants (FARLOD's own measure)
  const nh = hts(n); let lo = Infinity, hi = -Infinity; for (let k = 0; k < nh.length; k++) { lo = Math.min(lo, nh[k]); hi = Math.max(hi, nh[k]); }
  n._lo = lo; n._hi = hi; n._e = 0; if (!n.kids) return;
  let e = 0;
  for (const c of n.kids) {
    measure(c);
    const qx = c.ix - n.ix * 2, qz = c.iz - n.iz * 2, ch = hts(c); let ec = 0;
    for (let j = 0; j < NN1; j++) for (let i = 0; i < NN1; i++) {
      const u = (qx * NP + i) / 2, v = (qz * NP + j) / 2, i0 = Math.min(NP - 1, u | 0), j0 = Math.min(NP - 1, v | 0), fu = u - i0, fv = v - j0, b = j0 * NN1 + i0;
      const p = (nh[b] * (1 - fu) + nh[b + 1] * fu) * (1 - fv) + (nh[b + NN1] * (1 - fu) + nh[b + NN1 + 1] * fu) * fv;
      ec = Math.max(ec, Math.abs(p - ch[j * NN1 + i]));
    }
    e = Math.max(e, ec + c._e);
  }
  n._e = e;
})(I.farRoot);
const boxOf = n => { const s = FH.side / (1 << n.d); return [FH.bounds.x0 + n.ix * s, FH.bounds.z0 + n.iz * s, s]; };
const underRing = (ox, oz, s) => ox > -INNER + 250 && ox + s < INNER - 250 && oz > -INNER + 250 && oz + s < INNER - 250;
const nearRing = (ox, oz, s) => ox < INNER + 250 && ox + s > -INNER - 250 && oz < INNER + 250 && oz + s > -INNER - 250;
const farComposedH = (x, z) => O.terrainH(x, z, W.premises.base.terrainH(x, z));
function farVertex(n, i, j) {
  const [ox, oz, s] = boxOf(n), step = s / NP, x = ox + i * step, z = oz + j * step;
  let y = hts(n)[j * NN1 + i];
  if (I.seaFloor) { const sd = I.coastAt(x, z); if (sd < 0) y = Math.min(y, I.seaFloor(sd)); }
  if (I.lakeBed) { const b = I.lakeBed(x, z, y); if (b < y) y = b; }
  const din = Math.max(Math.abs(x), Math.abs(z)); if (din < INNER) y -= 1.5 * Math.min(1, (INNER - din) / 200);
  const sk = GD.PATCH.ringSink(x, z); if (sk) y = Math.min(y, farComposedH(x, z)) - sk;   // farSinkOn: the patch stands
  return y;
}
// the far terrain drawn at (x, z) for an eye at (ex, ey, ez): NaN under the inner ring (the ring / the fine tiles are)
function farAt(x, z, ex, ey, ez) {
  let n = I.farRoot;
  for (;;) {
    const [ox, oz, s] = boxOf(n);
    if (underRing(ox, oz, s)) return NaN;
    if (!n.kids) break;
    let desc = n.d < 2 || (nearRing(ox, oz, s) && n._e > RIME);
    if (!desc) { const dx = Math.max(ox - ex, 0, ex - ox - s), dz = Math.max(oz - ez, 0, ez - oz - s), dy = Math.max(n._lo - ey, 0, ey - n._hi);
      desc = n._e * K > TOLPX * Math.max(1, Math.hypot(dx, dy, dz)); }
    if (!desc) break;
    const h = s / 2, cx = (x - ox) >= h ? 1 : 0, cz = (z - oz) >= h ? 1 : 0;
    n = n.kids[cz * 2 + cx];
  }
  const [ox, oz, s] = boxOf(n), u = (x - ox) / s * NP, v = (z - oz) / s * NP;
  const i = Math.max(0, Math.min(NP - 1, Math.floor(u))), j = Math.max(0, Math.min(NP - 1, Math.floor(v))), fu = u - i, fv = v - j;
  // TPL: (a, a+N, a+1), (a+1, a+N, a+N+1) - the diagonal from (i+1, j) to (i, j+1)
  if (fu + fv <= 1) { const a = farVertex(n, i, j), b = farVertex(n, i + 1, j), c = farVertex(n, i, j + 1); return a + fu * (b - a) + fv * (c - a); }
  const d = farVertex(n, i + 1, j + 1), b = farVertex(n, i + 1, j), c = farVertex(n, i, j + 1);
  return d + (1 - fu) * (c - d) + (1 - fv) * (b - d);
}
const fineOn = (x, z) => Math.max(Math.abs(x), Math.abs(z)) <= INNER - FR - FBAND - 50;
// THE DRAWN GROUND at (x, z), the eye 10 m off and 3 m up: ground_drawn's stack, the far terrain under the patch where
// the fine tiles are off
function drawn(x, z) {
  const d = GD.drawnAt(x, z);
  if (d.kind !== 'patch' && d.kind !== 'far') return d;
  if (fineOn(x, z)) return d;                        // (the fine tiles: ground_drawn's)
  const h = W.terrainH(x, z), f = farAt(x, z, x + 8, h + 3, z + 6);
  if (!Number.isFinite(f)) return d.kind === 'far' ? { y: NaN, kind: 'ring' } : d;   // (the inner ring past the disc: not modelled)
  if (d.kind === 'far' || f > d.y) return { y: f, kind: 'far terrain' };
  return d;
}

// ---- the contact tier (G2115, src/viewer/ground_tier.js): under the aeroplane the ground is drawn at 1 m off the law -----
// render_world.js's modeAt, in node: the patch's 2 m level under it ('patch') where the square is ring1 + its half-diagonal
// deep in the patch, the fine tiles ('fine') where no chunk of the patch is within 64 m and the disc is on; else none.
// An aeroplane AT (x, z) has its tier centred on centreOf(x, z): (x, z) lies in its core, where the drawn ground is the law
// on the tier's triangles (S.patch 0.5 m: the patch's near-level law over terrainH; S.fine 1 m: terrainH - ringSink)
const GT = require(path.join(ROOT, 'src', 'viewer', 'ground_tier.js'));
const PLW = GD.PATCH;
const tierLawPatch = (x, z) => { const r = Math.min(1, PLW.patchDepth(x, z) / PT0.tuckW); return W.terrainH(x, z) - PLW.dropAt(x, z) * r - PT0.tuck * (1 - r) * (1 - r) - PLW.sink0Of(x, z); };
const tierLawFine = (x, z) => W.terrainH(x, z) - PLW.ringSink(x, z);
const PT0 = PLW.PATCH_TUCK;
function tierMode(cx, cz) {
  if (GD.covers(cx, cz)) return PLW.patchDepth(cx, cz) >= PT0.ring1 + GT.S.patch.half * Math.SQRT2 ? 'patch' : null;
  const h = GT.S.fine.half;
  for (let x = cx - h - 64; x <= cx + h + 64; x += 32) for (let z = cz - h - 64; z <= cz + h + 64; z += 32) if (GD.covers(x, z)) return null;
  return Math.max(Math.abs(cx), Math.abs(cz)) <= INNER - FR - FBAND - 50 - 2 * h ? 'fine' : null;
}
const tierLat = { patch: GT.lattice(GT.S.patch.step, tierLawPatch), fine: GT.lattice(GT.S.fine.step, tierLawFine) };
const TIER_ON = !argv.includes('--notier');
function drawnUnder(x, z) {           // the ground drawn under an aeroplane standing at (x, z)
  const d = drawn(x, z);
  if (!TIER_ON || (d.kind !== 'patch' && d.kind !== 'fine' && d.kind !== 'far terrain')) return d;   // (a pavement draws over the tier)
  const c = GT.centreOf(x, z), m = tierMode(c[0], c[1]);
  return m ? { y: tierLat[m](x, z), kind: 'tier (' + m + ')' } : d;
}

// ---- the cause: which part of the construction puts the drawn ground off the solver's at a point ------------------
const PT = GD.PATCH.PATCH_TUCK;
function causeOf(x, z, d) {
  // the solver's ground itself not continuous here (a coarse DEM leaf beside a fine one, G1335's coast): no surface drawn
  // through it can meet it on both sides
  // (a crease or a step within the tier's cell: the second difference over its half-step (0.25 m) past 10 mm - a slope that
  // turns by 0.08 or more inside 0.5 m: no 0.5 m chord meets it to a centimetre)
  { const H0 = W.terrainH(x, z); let k2 = 0;
    for (const h of [GT.S.patch.step / 2, GT.S.patch.step]) for (const [dx, dz] of [[h, 0], [0, h], [h, h], [h, -h]]) k2 = Math.max(k2, Math.abs(W.terrainH(x + dx, z + dz) - 2 * H0 + W.terrainH(x - dx, z - dz)) * (h > GT.S.patch.step / 2 ? 0.5 : 1));
    if (k2 > 0.01) return 'terrainH creased or stepped within the tier\'s cell (a cut\'s bank, a DEM seam, the coast)'; }
  if (/rim$/.test(d.kind)) return 'pavement rim (the side\'s lift, G1001)';
  if (d.kind === 'far terrain') return 'far terrain (the raw DEM / its cut at the patch\'s border)';
  if (d.kind === 'fine') return 'fine tiles (the 5 m lattice)';
  if (/^tier/.test(d.kind)) return 'the contact tier (the 1 m lattice)';
  if (d.kind !== 'patch') return 'pavement lattice';
  const R = GD.PATCH.R, i = Math.floor(x / R), j = Math.floor(z / R), fu = x / R - i, fv = z / R - j;
  const vs = fu + fv <= 1 ? [[i, j], [i + 1, j], [i, j + 1]] : [[i + 1, j + 1], [i + 1, j], [i, j + 1]];
  let sink = 0, tuck = 0, drop = 0, off = 0;
  for (const [a, b] of vs) { const X = a * R, Z = b * R, r = Math.min(1, GD.PATCH.patchDepth(X, Z) / PT.tuckW);
    sink = Math.max(sink, GD.sinkOf(X, Z)); if (r < 1) tuck = Math.max(tuck, PT.tuck * (1 - r) * (1 - r)); drop = Math.max(drop, GD.PATCH.dropAt(X, Z) * r);
    off = Math.max(off, Math.abs(W.terrainHBuild(X, Z) - W.terrainH(X, Z))); }
  if (sink > 1e-3) return 'patch: a sunk vertex (the pavement\'s sink)';
  if (tuck > 1e-3) return 'patch: the border\'s tuck';
  if (off > 1e-3) return 'patch: the build read off the raster';
  if (drop > 1e-3) return 'patch: the 2 cm drop (a pavement\'s side, a lot)';
  return 'patch: the 2 m lattice (terrainH curved / creased in the cell)';
}

// ---- the sites ---------------------------------------------------------------------------------------------------
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sites = [];
const liftIn = PAV.SINK.liftIn;
for (const a of W.aerodromes) {
  if (!a.len || !a.wid || a.kind === 'water' || !a.premises) continue;
  const c = Math.cos(a.hdg), s = Math.sin(a.hdg), at = (u, v) => [a.x + u * c + v * s, a.z + u * s - v * c];
  const site = C.siteOf(a.id);
  if (site && site.stand) { const P = []; for (let i = -24; i <= 24; i++) for (let j = -24; j <= 24; j++) P.push([site.stand.x + i * 0.5, site.stand.z + j * 0.5]); sites.push({ id: a.id + ' stand', kind: 'stand', P }); }
  { const P = [], R = []; for (let u = -a.len / 2; u <= a.len / 2; u += 1) for (let v = -a.wid / 2; v <= a.wid / 2; v += 1) {
      const uu = u + rnd() - 0.5, vv = v + rnd() - 0.5, dE = Math.min(a.len / 2 - Math.abs(uu), a.wid / 2 - Math.abs(vv)); if (dE < 0) continue;
      (dE >= liftIn ? P : R).push(at(uu, vv)); }
    sites.push({ id: a.id + ' strip', kind: 'strip', P }); sites.push({ id: a.id + ' strip rim', kind: 'rim', P: R }); }
  for (const sg of [1, -1]) { const P = []; for (let u = 0; u <= 100; u += 1) for (let v = -a.wid / 2 - 5; v <= a.wid / 2 + 5; v += 1) P.push(at(sg * (a.len / 2 + u + rnd()), v + rnd() - 0.5));
    sites.push({ id: a.id + (sg > 0 ? ' overrun end' : ' overrun start'), kind: 'overrun', P }); }
  if (site && site.stand) for (const key of ['taxiOut', 'taxiOut1']) {
    const pts = site[key]; if (!pts || !pts.length) continue;
    const line = [[site.stand.x, site.stand.z]].concat(pts), P = [];
    for (let k = 1; k < line.length; k++) { const A = line[k - 1], B = line[k], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (!(L > 0)) continue;
      const tx = (B[0] - A[0]) / L, tz = (B[1] - A[1]) / L;
      for (let t = 0; t <= L; t += 0.5) for (let w = -3; w <= 3; w += 0.5) P.push([A[0] + tx * t - tz * w, A[1] + tz * t + tx * w]); }
    sites.push({ id: a.id + ' lane' + (key === 'taxiOut1' ? ' 2' : ''), kind: 'lane', P });
  }
}
const want = arg('--site', null);
const pct = (s, p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
const rows = [];
for (const S of sites) {
  if (want && S.id.indexOf(want) < 0) continue;
  const e = [], e2 = [], kinds = {}, causes = {}; let worst = null, smooth = null, unmod = 0;   // (e2, smooth: off the creases and steps)
  const E = { id: S.id + ' (edges)', kind: 'edge', e: [], worst: null };
  for (const [x, z] of S.P) {
    const d = drawnUnder(x, z); if (!Number.isFinite(d.y)) { unmod++; continue; }
    // A PAVEMENT'S OWN EDGE (its side's fade outside, its lift over liftIn inside: G1001's 7 cm between the two, G1541's 2 cm)
    // is reported apart: the wheels roll on the pavement past it, or on the grass past its side
    // (and a road's square END, past which pavedAt reports nothing: within liftIn of a paved point - G1542's last 2 m take
    // the edge's 7 cm there, the patch's cell carrying it a little way out)
    const q = S.kind !== 'rim' ? (O.pavedAt(x, z, PT.sideR1) || ([[liftIn, 0], [-liftIn, 0], [0, liftIn], [0, -liftIn]].some(([dx, dz]) => { const r = O.pavedAt(x + dx, z + dz); return r && r.kind === 'road'; }) ? { dPre: 0 } : null)) : null;
    if (q && q.dPre < liftIn) { const v = 1000 * (d.y - W.terrainH(x, z)); E.e.push(v); if (!E.worst || Math.abs(v) > Math.abs(E.worst.v)) E.worst = { v, x, z, kind: d.kind }; continue; }
    const v = 1000 * (d.y - W.terrainH(x, z)); e.push(v); kinds[d.kind] = (kinds[d.kind] || 0) + 1;
    if (!worst || Math.abs(v) > Math.abs(worst.v)) worst = { v, x, z, kind: d.kind };
    let crease = false;
    if (Math.abs(v) > TOL) { const k = causeOf(x, z, d); crease = /creased or stepped/.test(k); const q = causes[k] = causes[k] || { n: 0, worst: 0 }; q.n++; if (Math.abs(v) > Math.abs(q.worst)) q.worst = v; }
    if (!crease) { if (!smooth || Math.abs(v) > Math.abs(smooth.v)) smooth = { v, x, z, kind: d.kind }; e2.push(v); }
  }
  if (!e.length) { rows.push({ id: S.id, kind: S.kind, n: 0, unmod }); continue; }
  const a = e.map(Math.abs).sort((p, q) => p - q);
  const a2 = e2.map(Math.abs).sort((p, q) => p - q);
  rows.push({ id: S.id, kind: S.kind, n: e.length, unmod, p50: pct(a, 0.5), p95: pct(a, 0.95), worst: worst.v, at: [+worst.x.toFixed(1), +worst.z.toFixed(1)], on: worst.kind, kinds, causes,
    p95s: a2.length ? pct(a2, 0.95) : 0, worstS: smooth ? smooth.v : 0, atS: smooth ? [+smooth.x.toFixed(1), +smooth.z.toFixed(1)] : null, onS: smooth ? smooth.kind : null, creased: e.length - e2.length });
  if (E.e.length) { const b = E.e.map(Math.abs).sort((p, q) => p - q);
    rows.push({ id: E.id, kind: 'edge', n: E.e.length, unmod: 0, p50: pct(b, 0.5), p95: pct(b, 0.95), worst: E.worst.v, at: [+E.worst.x.toFixed(1), +E.worst.z.toFixed(1)], on: E.worst.kind, kinds: {}, causes: {} }); }
}
console.log(`TERRAIN MATCH (${PRESET}: far terrain at ${TOLPX} px, K ${K.toFixed(0)}; ${TIER_ON ? 'the contact tier under the aeroplane' : 'no contact tier (--notier)'}): |drawn - terrainH| (mm) where wheels and wreckage touch`);
for (const r of rows) {
  if (!r.n) { console.log('  ' + r.id.padEnd(24) + ' n 0' + (r.unmod ? ' (' + r.unmod + ' unmodelled)' : '')); continue; }
  console.log('  ' + r.id.padEnd(24) + ` n ${String(r.n).padStart(6)}  p50 ${r.p50.toFixed(1).padStart(6)}  p95 ${r.p95.toFixed(1).padStart(7)}  worst ${r.worst.toFixed(1).padStart(8)} at ${r.at.join(', ')} on ${r.on}` +
    '   ' + Object.entries(r.kinds).sort((p, q) => q[1] - p[1]).map(([k, v]) => k + ' ' + v).join(', ') + (r.unmod ? '  (' + r.unmod + ' unmodelled)' : '') +
    (r.creased ? `   | off ${r.creased} creased / stepped points: p95 ${r.p95s.toFixed(1)}, worst ${r.worstS.toFixed(1)} at ${r.atS} on ${r.onS}` : ''));
  if (!argv.includes('--brief')) for (const [k, q] of Object.entries(r.causes).sort((p, q2) => q2[1].n - p[1].n)) console.log('      over ' + TOL + ' mm: ' + String(q.n).padStart(5) + ' pts, worst ' + q.worst.toFixed(0).padStart(6) + '  ' + k);
}
const gated = rows.filter(r => r.n && r.kind !== 'rim' && r.kind !== 'edge');
const bad = gated.filter(r => r.p95 > TOL || Math.abs(r.worst) > TOL);
console.log(`TERRAIN MATCH ${PRESET}: ${gated.length - bad.length} of ${gated.length} sites within ${TOL} mm (p95 and worst)` + (bad.length ? '; over: ' + bad.map(r => r.id + ' ' + r.worst.toFixed(0)).join(', ') : ''));
// ---- the wheels: the user's builds settled at every stand, the drawn ground under each wheel against terrainH -------------
// (the user's Cub - builds/cub_2026-09-20_corrected.json -, the Jodel, the metal Cessna; the Cessna on floats stands on no land
// stand: tools/terrain_still.js shoots it on the water)
const WHEELS = [];
if (!argv.includes('--nowheels')) {
  const BUILDS = { cub: path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), jodel: path.join(ROOT, 'builds', 'jodel_2026-09-20_corrected.json'), cessna: path.join(ROOT, 'bugReports', 'cessnaMetal (1).json') };
  const BJ = require(path.join(T, 'ground_gap.js')).BJ;   // (the editor's bake of a build, as ground_drawn --stands)
  for (const [key, file] of Object.entries(BUILDS)) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')), spec = BJ.bakeJoined(raw.spec || raw).spec;
    for (const a of W.aerodromes) {
      const site = C.siteOf(a.id); if (!site || !site.stand || a.kind === 'water') continue;
      const def = C.buildGen(JSON.parse(JSON.stringify(spec))), sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
      C.placeAtStand(sim, a, site.stand); for (let i = 0; i < 600; i++) sim.step(1 / 60);
      const ws = def.refs.mains.concat(def.refs.tw >= 0 ? [def.refs.tw] : []);
      const per = ws.map(i => { const x = sim.p[i * 3], z = sim.p[i * 3 + 2], d = drawnUnder(x, z); return { mm: 1000 * (d.y - W.terrainH(x, z)), on: d.kind }; });
      WHEELS.push({ build: key, aero: a.id, per });
    }
  }
  console.log('  THE WHEELS at the stands (settled 10 s; the drawn ground under each wheel - terrainH, mm):');
  for (const w of WHEELS) console.log('    ' + (w.aero + ' ' + w.build).padEnd(18) + w.per.map(q => q.mm.toFixed(1).padStart(6) + ' on ' + q.on).join('  |  '));
}
const jf = arg('--json', null);
if (jf) fs.writeFileSync(jf, JSON.stringify({ preset: PRESET, tolPx: TOLPX, rows, wheels: WHEELS }, null, 1));
module.exports = { drawn, drawnUnder, farAt, tierMode, rows, wheels: WHEELS };
