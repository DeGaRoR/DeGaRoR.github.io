#!/usr/bin/env node
// exclusion_map.js - WHERE THE GRASS AND THE TREES MAY NOT GROW, ROUND EVERY RUNWAY OF JOLENE (GRASS-DENSE G2560, 2026-10-08; the
// user, 8 Oct: "I also want to look at the grass/trees exclusions from the runways"). Node only: Jolene composed headless
// (island_node + the premises fixture, as GATE RWYLIGHTS does), every land strip rastered in ITS OWN FRAME (the runway
// horizontal, the take-off direction to the right), two panels over the island's own imagery (grey):
//   GRASS   what the cover ring is told at each point - the same tests it makes (cover_ring.js subGrid + render_world okAt):
//           no ground for a tuft (a paved / gravel / sand surface, the declared surface box, water) dark grey;
//           coverAt kill 1 (the pavement, its band) RED; the 6 m fade ORANGE -> clear; the verge's boost brighter GREEN;
//           a plot lawn LIGHT GREEN; a plot that plants nothing PURPLE; the meadow GREEN.
//   TREES   world.treeAeroBlocked (the one rule the woodland, the fill and the stand cards read): blocked RED tint; where the
//           island's canopy says a stand would be (canopy >= 5 m: the canopy grid is a height) DARK GREEN outside the block, MAGENTA inside (the trees
//           the clearance removes).
// Writes <out>/<id>.ppm + <id>.json (the frame, the scale, the strips' outlines in pixels); exclusion_map.py lays the legend.
// Usage: node tools/perf/grass_study/exclusion_map.js <outDir> [--px 2] [--ids HOME,w2,...]
'use strict';
const path = require('path'), fs = require('fs');
const T = path.join(__dirname, '..', '..');
require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : 'exclusion');
fs.mkdirSync(OUT, { recursive: true });
const J = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
if (!J) { console.error('exclusion_map: Jolene is not on disk'); process.exit(1); }
const S = J.SURFACE, I = J.island;
const IDS = opt('ids', null) ? opt('ids').split(',') : null;
const strips = J.aerodromes.filter(a => a.kind !== 'water' && a.len && a.wid && (!IDS || IDS.includes(a.id)));
const lin2s = v => Math.round(255 * Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
const imgAt = (x, z) => { const k = I.cellAt(x, z); if (k < 0) return [20, 30, 50];
  const g = (I.albedo[k * 3] * 0.3 + I.albedo[k * 3 + 1] * 0.59 + I.albedo[k * 3 + 2] * 0.11); const v = Math.round(60 + g * 0.55); return [v, v, v]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const okGround = (x, z) => { const h = J.terrainH(x, z); if (h < 0.3 || J.waterH(x, z) > h - 0.3) return 'water';
  const s = J.surface(x, z); return (s === S.GRASS || s === S.FOREST_FLOOR || s === S.SCREE || s === S.ROCK) ? 'ok' : 'hard'; };
const summary = [];
for (const A of strips) {
  const px = +opt('px', A.len > 1000 ? 2 : 1);
  const mU = A.len > 1000 ? 350 : 250, mV = A.len > 1000 ? 220 : 160;   // the margins past the ends and each side (m)
  const U0 = -A.len / 2 - mU, U1 = A.len / 2 + mU, V0 = -A.wid / 2 - mV, V1 = A.wid / 2 + mV;
  const W = Math.round((U1 - U0) / px), H = Math.round((V1 - V0) / px);
  const d = [Math.cos(A.hdg), Math.sin(A.hdg)], p = [-d[1], d[0]];
  const at = (u, v) => [A.x + d[0] * u + p[0] * v, A.z + d[1] * u + p[1] * v];
  const G = Buffer.alloc(W * H * 3), Tr = Buffer.alloc(W * H * 3);
  const tally = { px2: px * px, grassNone: 0, grassKill: 0, grassFade: 0, grassOk: 0, boost: 0, lawn: 0, treeBlocked: 0, treeLost: 0, treeKept: 0 };
  // the band's and the fade's widths measured across the middle of the strip (the first metre where kill < 1, then 0)
  let killEnd = null, fadeEnd = null, noGroundEnd = null;
  for (let v = A.wid / 2; v < A.wid / 2 + 200; v += 0.5) { const [x, z] = at(0, v); const c = J.coverAt(x, z); const k = c ? c.kill : 0;
    if (killEnd === null && k < 1) killEnd = v - A.wid / 2; if (fadeEnd === null && k <= 0) { fadeEnd = v - A.wid / 2; }
    if (noGroundEnd === null && okGround(x, z) === 'ok') noGroundEnd = v - A.wid / 2; if (fadeEnd !== null && noGroundEnd !== null) break; }
  let treeSide = null, treeEnd = null;
  for (let v = 0; v < 1500; v += 1) { const [x, z] = at(0, v); if (!J.treeAeroBlocked(x, z)) { treeSide = v - A.wid / 2; break; } }
  for (let u = 0; u < 4000; u += 2) { const [x, z] = at(u, 0); if (!J.treeAeroBlocked(x, z)) { treeEnd = u - A.len / 2; break; } }
  // THE PROPOSAL'S TREES: ICAO Annex 14's obstacle limitation surfaces for a NON-INSTRUMENT runway of the strip's code (by its
  // length), against each stand's own height (the island's canopy grid, metres): a stand is cleared where its top stands over the
  // lowest surface - the strip (0), the transitional beside it and beside the approach, the approach past each end - capped by
  // the inner horizontal (45 m). Table 4-1 (non-instrument): strip half-width 30 / 40 / 75 / 75 m and 30 / 60 / 60 / 60 m past
  // the end; approach inner edge 60 / 80 / 150 / 150 m, divergence 10 %, slope 5 / 4 / 3.33 / 2.5 %; transitional 20 / 20 / 14.3 / 14.3 %.
  const code = A.len < 800 ? 1 : A.len < 1200 ? 2 : A.len < 1800 ? 3 : 4;
  const OLS = { 1: [30, 30, 60, 0.05, 0.20], 2: [40, 60, 80, 0.04, 0.20], 3: [75, 60, 150, 1 / 30, 0.143], 4: [75, 60, 150, 0.025, 0.143] }[code];
  const olsH = (u, v) => { const [SH, SB, IE, SL, TR] = OLS, ue = Math.abs(u) - A.len / 2, av = Math.abs(v);
    if (ue <= SB) return av <= SH ? 0 : Math.min(45, (av - SH) * TR);
    const s = ue - SB, hw = IE / 2 + 0.10 * s; return Math.min(45, SL * s + (av > hw ? (av - hw) * TR : 0)); };
  const elev = isFinite(A.elev) ? A.elev : J.terrainH(A.x, A.z);
  const PG = (typeof PREMISES_GEN !== 'undefined') ? PREMISES_GEN : require(path.join(T, 'flight_core.js')).PREMISES_GEN;
  const law = law => PG.grassSides({ law });
  const P = Buffer.alloc(W * H * 3), Tp = Buffer.alloc(W * H * 3);
  Object.assign(tally, { pNone: 0, pCut: 0, pSurf: 0, pWild: 0, pAsk: 0, oLost: 0, oKept: 0, oBlocked: 0 });
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = U0 + (i + 0.5) * px, v = V1 - (j + 0.5) * px, [x, z] = at(u, v), o = (j * W + i) * 3;
    const base = imgAt(x, z);
    // GRASS today
    let g;
    const okg = okGround(x, z);
    law('today');
    const c0 = J.coverAt(x, z) || { kill: 0, boost: 0, kind: null };
    if (okg === 'water') { g = [40, 60, 110]; tally.grassNone++; }
    else if (okg === 'hard') { g = [70, 70, 75]; tally.grassNone++; }
    else {
      const c = c0;
      if (c.kind === 'lawn' && c.kill < 1) { g = mixc(base, [170, 235, 120], 0.75); tally.lawn++; }
      else if (c.kind === 'none') { g = mixc(base, [150, 70, 190], 0.7); tally.grassNone++; }
      else if (c.kill >= 1) { g = mixc(base, [215, 40, 40], 0.75); tally.grassKill++; }
      else if (c.kill > 0) { g = mixc(mixc(base, [60, 170, 60], 0.55), [240, 150, 30], 0.3 + 0.6 * c.kill); tally.grassFade++; }
      else { g = mixc(base, c.boost > 0.05 ? [90, 230, 90] : [60, 170, 60], c.boost > 0.05 ? 0.55 + 0.3 * c.boost : 0.55); tally.grassOk++; if (c.boost > 0.05) tally.boost++; }
    }
    G[o] = g[0]; G[o + 1] = g[1]; G[o + 2] = g[2];
    // GRASS proposed (the 'sides' law)
    law('sides');
    const c1 = J.coverAt(x, z) || { kill: 0, boost: 0, kind: null, cut: 0, surf: 0 };
    law('today');
    let q;
    if (okg === 'water') q = [40, 60, 110];
    else if (c1.kill >= 1 || c1.kind === 'none') { q = mixc(base, [215, 40, 40], 0.75); tally.pNone++; }
    else if (c1.kind === 'lawn') { q = mixc(base, [170, 235, 120], 0.75); }
    else if (okg === 'hard') { q = mixc([70, 70, 75], [235, 215, 60], 0.55); tally.pAsk++; }   // physics hard, drawn as ground: the user's call
    else if (c1.surf) { q = mixc(base, [250, 240, 120], 0.8); tally.pSurf++; }
    else if (c1.cut > 0) { q = mixc(mixc(base, [60, 170, 60], 0.55), [185, 230, 110], 0.85 * c1.cut); tally.pCut++; }
    else { q = mixc(base, c1.boost > 0.05 ? [90, 230, 90] : [60, 170, 60], c1.boost > 0.05 ? 0.55 + 0.3 * c1.boost : 0.55); tally.pWild++; }
    P[o] = q[0]; P[o + 1] = q[1]; P[o + 2] = q[2];
    // TREES today
    const blocked = J.treeAeroBlocked(x, z), can = I.canopyAt ? I.canopyAt(x, z) : 0;
    let t = base;
    if (blocked) { t = mixc(base, [215, 40, 40], 0.45); tally.treeBlocked++; if (can >= 5) { t = [230, 60, 230]; tally.treeLost++; } }
    else if (can >= 5) { t = mixc(base, [20, 90, 30], 0.8); tally.treeKept++; }
    if (okg === 'water') t = [40, 60, 110];
    Tr[o] = t[0]; Tr[o + 1] = t[1]; Tr[o + 2] = t[2];
    // TREES proposed: the OLS against the stand's own top; the pavement and its drawn side kept bare as 'map' does
    const hS = olsH(u, v), top = J.terrainH(x, z) + can, over = top > elev + hS;
    let tp = mixc(base, [255, 255, 255], Math.max(0, 0.35 - hS / 45 * 0.35) * (hS < 45 ? 1 : 0));   // the surface's height: paler where it is low
    if ((hS <= 0.01 || c1.kill >= 1) && can < 5) { tp = mixc(base, [215, 40, 40], 0.45); tally.oBlocked++; }
    if (can >= 5) { if (over || c1.kill >= 1) { tp = [230, 60, 230]; tally.oLost++; } else { tp = mixc(base, [20, 90, 30], 0.8); tally.oKept++; } }
    if (okg === 'water') tp = [40, 60, 110];
    Tp[o] = tp[0]; Tp[o + 1] = tp[1]; Tp[o + 2] = tp[2];
  }
  const ppm = buf => Buffer.concat([Buffer.from('P6\n' + W + ' ' + H + '\n255\n'), buf]);
  fs.writeFileSync(path.join(OUT, A.id + '_grass.ppm'), ppm(G));
  fs.writeFileSync(path.join(OUT, A.id + '_trees.ppm'), ppm(Tr));
  fs.writeFileSync(path.join(OUT, A.id + '_grassP.ppm'), ppm(P));
  fs.writeFileSync(path.join(OUT, A.id + '_treesP.ppm'), ppm(Tp));
  // the strips in this frame, as pixel rectangles (corners), the others' too where they cross the window
  const toPx = (x, z) => { const dx = x - A.x, dz = z - A.z, u = dx * d[0] + dz * d[1], v = dx * p[0] + dz * p[1]; return [(u - U0) / px, (V1 - v) / px]; };
  const outlines = J.aerodromes.filter(b => b.kind !== 'water' && b.len && b.wid).map(b => { const bd = [Math.cos(b.hdg), Math.sin(b.hdg)], bp = [-bd[1], bd[0]];
    const c = (su, sv) => toPx(b.x + bd[0] * su * b.len / 2 + bp[0] * sv * b.wid / 2, b.z + bd[1] * su * b.len / 2 + bp[1] * sv * b.wid / 2);
    return { id: b.id, pts: [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)] }; });
  const info = { id: A.id, name: A.name, look: A.look, surface: A.surface, len: A.len, wid: A.wid, band: A.band, treeBox: A.treeBox, treeClear: A.treeClear || null,
    hdgDeg: +(A.hdg * 180 / Math.PI).toFixed(1), px, W, H, U0, V1, rwyTrees: J.rwyTrees ? J.rwyTrees() : null,
    across: { killEnd, fadeEnd, noGroundEnd, treeSide }, along: { treeEnd }, code, ols: OLS, grassSides: PG.grassSides(), tally, outlines };
  fs.writeFileSync(path.join(OUT, A.id + '.json'), JSON.stringify(info, null, 1));
  summary.push(info);
  console.log(A.id.padEnd(9) + (A.look || '').padEnd(7) + (A.len + 'x' + A.wid).padEnd(10) + 'band ' + String(A.band).padEnd(4) +
    'grass: none to ' + noGroundEnd + ' m, kill to ' + killEnd + ' m, fade to ' + fadeEnd + ' m past the edge · trees: blocked to ' + treeSide + ' m past the edge, ' + treeEnd + ' m past the end');
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary.map(s => Object.assign({}, s, { outlines: undefined })), null, 1));
