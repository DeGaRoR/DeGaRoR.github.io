#!/usr/bin/env node
// _rwytrees_check.js - GATE RWYTREES (G1091-G1093, POLISH-2): THE TREES BY THE RUNWAYS FOLLOW THE TREE MAP, IN THE
// VARIANT THE USER PICKS, AND A TREE YOU SEE STANDS WHERE A TREE YOU HIT MAY.
//
// The user (2026-09-29): "just follow the map first ... You can do both, only the map, and the map + the gravel and
// approach fans, and I'll judge". Three variants, one switch (27_premises.js RWY_TREES: ?rwytrees=today|map|mapx,
// localStorage flydiy.rwytrees, FLYDIY_RWYTREES in node); 'today' the default until the user has judged.
//
// CORE (every tier, ~1 min: Jolene composed three times):
//   1 the runway clearances are named: 9 approach fans, 6 strip boxes, 4 gravel shoulders (y_sh13_*, y_sh02_*) -
//     and each variant lifts the ones it should ('map' all, 'mapx' the boxes), 'today' none
//   2 THE TABLE: for every land runway of Jolene, each side, the map's nearest TREE cell past the paved edge (WorldCover
//     TREE with canopy >= 2.5 m: the island's effClass), and per variant the nearest collidable tree (world.trees) -
//     and, under --all, the nearest VISIBLE tree (the fill's own walk, TREE_FILL.plants, in the node page harness)
//   3 no collidable tree stands on paving in any variant (a strip, a road, an apron, a PAVED surface - pavedNear at 0 m),
//     and in 'map' / 'mapx' none on a pavement's drawn side either (treePaveAt)
//   4 the variants do what they say: 'today' keeps the aerodrome box (no collidable tree inside len/2 + 150 x wid/2 + 60
//     - the unseen hitboxes at 47.5 m are gone), 'map' brings the woods in (13/31 and 02/20 nearer than 'today' on
//     every side), 'mapx' keeps the shoulders and the fans clear, and no variant keeps the analytic world's corridor
//   5 THE ONE RULE: every collidable tree stands where the fill may plant (world.treeAeroBlocked false, the trees'
//     ground FOREST_FLOOR, no premises exclude) - the woodland and the fill ask the same three calls
//   6 the pilot's ground paths stay clear in 'map': HOME's stand, its two ways out and the runway's centreline (the
//     roll, the landing), every land runway's stand and way out, against every collidable tree's cylinder (the
//     solver's: 0.7 s + 0.12) and the WIDEST parked footprint's half-span; the climb-out and the approach over each
//     end against a 5 % surface from the threshold - margins printed
// FULL (--all, or run by hand; ~12 min):
//   7 the fill, per variant, in the page harness (tools/_page_node.js, dev.html's scripts, Jolene, rolled out):
//     nearest visible tree per side (the map's forest rule / the biome's open ground), none on paving, every one
//     outside the core's clearances (the one rule, from the fill's side)
//   8 THE CIRCUIT FLOWN in 'map': the user's aluminium C172 and the Cub off HOME's stand, the Cub off East Point's,
//     the pilot to a stop; every node against every collidable tree's cylinder every 6th step - no contact, the
//     margin printed per phase group
//
//   node tools/_rwytrees_check.js            core (+ full when GATES_CORE is not set by the runner's core tier)
//   node tools/_rwytrees_check.js --page <v> the page harness child for one variant (JSON on stdout's last line)
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const T = __dirname;
const FX = path.join(T, 'fixtures', 'island_jolene.json');
const VARIANTS = ['today', 'map', 'mapx'];
const argv = process.argv.slice(2);

// ---- the page child: one variant's fill, near every land runway ----------------------------------------------
if (argv[0] === '--page') {
  const v = argv[1];
  (async () => {
    const { openPage } = require('./_page_node.js');
    const P = await openPage({ quiet: true, storage: {}, query: 'rwytrees=' + v });
    const W = P.win;
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
    W.document.getElementById('bGo').click();
    const tripDone = () => { const Tr = W.FLYDIY_TRIPS; const t = Tr && Tr[Tr.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
    await P.until(() => W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
    const w = W.FLIGHT_PROBE.world(), O = w.premises && w.premises.overlay;
    const out = { v, world: W.FLYDIY_WORLD, flag: W.FLYDIY_RWYTREES, mode: w.rwyTrees ? w.rwyTrees() : null, runways: {} };
    for (const r of O.rec.layers.runways) {
      if (+r.surface === 4) continue;
      const E = [Math.cos(r.hdg), Math.sin(r.hdg)], hl = r.len / 2, reach = r.wid / 2 + 200;
      const x0 = r.c[0] - Math.abs(E[0]) * hl - Math.abs(E[1]) * reach, x1 = r.c[0] + Math.abs(E[0]) * hl + Math.abs(E[1]) * reach;
      const z0 = r.c[1] - Math.abs(E[1]) * hl - Math.abs(E[0]) * reach, z1 = r.c[1] + Math.abs(E[1]) * hl + Math.abs(E[0]) * reach;
      const pl = W.TREE_FILL.plants(x0, z0, x1, z1);
      const near = { L: [Infinity, Infinity], R: [Infinity, Infinity] };
      let onPave = 0, blocked = 0, n = 0; const bad = [];
      for (let i = 0; i < pl.length; i += 3) {
        const x = pl[i], z = pl[i + 1], forest = pl[i + 2];
        const dx = x - r.c[0], dz = z - r.c[1], u = dx * E[0] + dz * E[1], vv = -dx * E[1] + dz * E[0];
        n++;
        if (O.pavedNear(x, z, 0)) { onPave++; if (bad.length < 4) bad.push('on paving ' + x.toFixed(1) + ',' + z.toFixed(1)); }
        if (w.treeAeroBlocked(x, z) || O.excludeAt(x, z, 'trees')) { blocked++; if (bad.length < 4) bad.push('in a clearance ' + x.toFixed(1) + ',' + z.toFixed(1)); }
        if (Math.abs(u) > hl) continue;
        const side = vv > 0 ? 'L' : 'R', past = Math.abs(vv) - r.wid / 2;
        near[side][forest ? 0 : 1] = Math.min(near[side][forest ? 0 : 1], past);
      }
      out.runways[r.id] = { n, onPave, blocked, bad, near };
    }
    // the pavement kinds round the field (the taxiways, the aprons, the other roads): the nearest visible tree past each
    { const K = pavementKinds(O), bb = fieldBox(O), pl = W.TREE_FILL.plants(bb[0], bb[1], bb[2], bb[3]);
      out.kinds = {}; for (const k of Object.keys(K)) out.kinds[k] = Infinity;
      for (let i = 0; i < pl.length; i += 3) for (const k of Object.keys(K)) out.kinds[k] = Math.min(out.kinds[k], K[k](pl[i], pl[i + 1])); }
    out.errors = P.errors.filter(e => /^(script |timer: |frame: )/.test(e)).slice(0, 5);
    process.stdout.write('\nPAGE ' + JSON.stringify(out) + '\n');
    process.exit(0);
  })().catch(e => { console.error(e); process.exit(2); });
  return;
}

const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const FULL = process.env.GATES_CORE !== '1' || argv.includes('--all');
let bad = 0;
const check = (ok, what, detail) => { if (!ok) bad++; console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : '')); return ok; };
const f1 = v => (v === Infinity || v == null ? '  -  ' : v.toFixed(1).padStart(5));

// THE PAGE CHILDREN FIRST (full): each is the whole page (~3.6 GB, up to a 6 GB heap), and they run before this
// process composes its own three Jolenes, so the two never hold their memory at once (a 15 GB cloud box, measured)
const pageRaw = {};
if (FULL) for (const v of VARIANTS) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000', __filename, '--page', v], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 1800000 });
  pageRaw[v] = { line: (r.stdout || '').split('\n').filter(l => l.startsWith('PAGE ')).pop() || null, status: r.status, err: String(r.stderr || '').slice(-400), secs: (Date.now() - t0) / 1000 };
}

const txt = fs.readFileSync(FX, 'utf8');
const worlds = {};
for (const v of VARIANTS) worlds[v] = IN.islandWorld('jolene', { premises: txt, rwyTrees: v });
const W0 = worlds.today, O0 = W0.premises.overlay, I = W0.island, WC = I.WC;
const land = O0.rec.layers.runways.filter(r => +r.surface !== 4);
const HALF = Math.max(...Object.values(C.GP_PARKED_FOOT).map(f => f[0]));   // the widest parked footprint's half-span
const widest = Object.entries(C.GP_PARKED_FOOT).find(([, f]) => f[0] === HALF)[0];
const R_OF = Tr => 0.7 * Tr.s + 0.12;                                      // the solver's tree cylinder (30_solver.js)
const frame = r => { const E = [Math.cos(r.hdg), Math.sin(r.hdg)]; return p => { const dx = p[0] - r.c[0], dz = p[1] - r.c[1]; return [dx * E[0] + dz * E[1], -dx * E[1] + dz * E[0]]; }; };

// 1 the clearances, named, and lifted by the variant
console.log('GATE RWYTREES - the trees by the runways (' + (FULL ? 'core + full' : 'core') + ')');
{
  const cl = O0.rwyClearances(), by = k => cl.filter(c => c.kind === k).map(c => c.id).sort();
  check(by('fan').length === 9 && by('box').length === 6 && by('shoulder').join() === 'y_sh02_0,y_sh02_1,y_sh13_0,y_sh13_1',
    '1 Jolene\'s runway clearances are named', 'fans ' + by('fan').join(' ') + ' | boxes ' + by('box').length + ' | shoulders ' + by('shoulder').join(' '));
  for (const v of VARIANTS) {
    const O = worlds[v].premises.overlay, off = O.rwyClearances().filter(c => c.off), kinds = [...new Set(off.map(c => c.kind))].sort().join('+') || 'none';
    const want = { today: 'none', map: 'box+fan+shoulder', mapx: 'box' }[v];
    check(O.rwyTrees === v && worlds[v].rwyTrees() === v && kinds === want, '1 ' + v + ' lifts ' + want, off.length + ' lifted: ' + kinds);
  }
}

// 2 the map's nearest TREE cell, and the collidable per variant, per runway side (inside the runway's length)
const table = {};
for (const r of land) {
  const toF = frame(r);
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1, row = table[r.id + ' ' + side] = { map: Infinity, med: Infinity, col: {}, vis: {} };
    const st = [];   // per 10 m station along the runway, the first TREE cell out to 200 m past the edge
    for (let u = -r.len / 2 + 5; u <= r.len / 2 - 5; u += 10) for (let e = 0; e <= 200; e += 0.5) {
      const vv = sg * (r.wid / 2 + e), x = r.c[0] + u * Math.cos(r.hdg) - vv * Math.sin(r.hdg), z = r.c[1] + u * Math.sin(r.hdg) + vv * Math.cos(r.hdg);
      if (I.effClass(x, z) === WC.TREE) { st.push(e); break; }
    }
    if (st.length) { st.sort((a, b) => a - b); row.map = st[0]; row.med = st[st.length >> 1]; }
    for (const v of VARIANTS) {
      let m = Infinity;
      for (const Tr of worlds[v].trees) { const q = toF([Tr.x, Tr.z]); if (Math.abs(q[0]) <= r.len / 2 && q[1] * sg > 0) m = Math.min(m, Math.abs(q[1]) - r.wid / 2); }
      row.col[v] = m;
    }
  }
}

// 3 nothing on paving; 4 the variants do what they say; 5 the one rule
const inPoly = (poly, x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const kept = { shoulder: O0.rec.layers.surface.filter(s => /^y_sh/.test(s.id)).map(s => s.poly), fan: O0.rec.layers.exclude.filter(e => O0.rwyClearances().some(c => c.kind === 'fan' && c.id === e.id)).map(e => e.poly) };
for (const v of VARIANTS) {
  const Wv = worlds[v], O = Wv.premises.overlay;
  let onPave = 0, onSide = 0, inBox = 0, ruleBad = 0, inCorr = 0, inKept = 0; const why = [];
  for (const Tr of Wv.trees) {
    if (O.pavedNear(Tr.x, Tr.z, 0)) { onPave++; if (why.length < 3) why.push('paving ' + Tr.x.toFixed(0) + ',' + Tr.z.toFixed(0)); }
    if (v !== 'today' && O.treePaveAt(Tr.x, Tr.z)) onSide++;
    if (Math.abs(Tr.z) < 60 && Tr.x < 150 && Tr.x > -3300) inCorr++;
    for (const a of Wv.aerodromes) if (a.treeBox !== false && typeof a.hdg === 'number' && a.wid) {
      const dx = Tr.x - a.x, dz = Tr.z - a.z;
      if (Math.abs(dx * Math.cos(a.hdg) + dz * Math.sin(a.hdg)) < a.len / 2 + 150 && Math.abs(-dx * Math.sin(a.hdg) + dz * Math.cos(a.hdg)) < a.wid / 2 + 60) { inBox++; break; }
    }
    if (Wv.treeAeroBlocked(Tr.x, Tr.z) || O.excludeAt(Tr.x, Tr.z, 'trees') || Wv.treeGround(Tr.x, Tr.z) !== Wv.SURFACE.FOREST_FLOOR) { ruleBad++; if (why.length < 3) why.push('rule ' + Tr.x.toFixed(0) + ',' + Tr.z.toFixed(0)); }
    if (v === 'mapx' && (kept.shoulder.some(p => inPoly(p, Tr.x, Tr.z)) || kept.fan.some(p => inPoly(p, Tr.x, Tr.z)))) inKept++;
  }
  check(onPave === 0 && onSide === 0, '3 ' + v + ': no collidable tree on paving' + (v === 'today' ? '' : ' or its drawn side'), Wv.trees.length + ' trees; ' + onPave + ' on paving, ' + onSide + ' on a side' + (why.length ? '; ' + why.join(', ') : ''));
  check(ruleBad === 0, '5 ' + v + ': every collidable tree stands where the fill may plant (one rule)', ruleBad + ' outside it');
  check(inCorr > 0, '4 ' + v + ': the analytic world\'s corridor is not the island\'s', inCorr + ' collidable trees in |z| < 60, -3300 < x < 150');
  if (v === 'today') check(inBox === 0, '4 today: no collidable tree inside the aerodrome box the fill keeps (no unseen hitbox)', inBox + ' inside');
  if (v === 'mapx') check(inKept === 0, '4 mapx: the shoulders and the fans stay clear', inKept + ' inside');
}
{
  const nearer = ['HOME L', 'HOME R', 'w2 L', 'w2 R'].filter(k => table[k].col.map < table[k].col.today);
  check(nearer.length === 4, '4 map: 13/31 and 02/20 have their woods nearer than today on every side', nearer.join(', '));
}

// 6 the ground paths and the climb-out / approach surfaces in 'map', against the collidable trees
const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
const pathMargin = (Wv, pts) => { let m = Infinity, at = null; for (const Tr of Wv.trees) for (let i = 0; i + 1 < pts.length; i++) { const d = segDist([Tr.x, Tr.z], pts[i], pts[i + 1]) - R_OF(Tr) - HALF; if (d < m) { m = d; at = Tr; } } return { m, at }; };
const margins = {};
for (const v of VARIANTS) {
  const Wv = worlds[v];
  margins[v] = {};
  for (const r of land) {
    const E = [Math.cos(r.hdg), Math.sin(r.hdg)], hl = r.len / 2;
    const e0 = [r.c[0] - E[0] * hl, r.c[1] - E[1] * hl], e1 = [r.c[0] + E[0] * hl, r.c[1] + E[1] * hl];
    const st = C.siteOf(r.id), ways = [];
    if (st && st.stand) { if (st.taxiOut) ways.push([[st.stand.x, st.stand.z]].concat(st.taxiOut)); if (st.taxiOut1) ways.push([[st.stand.x, st.stand.z]].concat(st.taxiOut1)); }
    const taxi = ways.map(p => pathMargin(Wv, p).m), roll = pathMargin(Wv, [e0, e1]).m;
    // the climb-out and the approach: along the extended centreline to 1.5 km past each end, a window of the half-span +
    // 30 m either side, the tree's top (its collision cylinder's, h + 4.6 s; and the drawn canopy, 16 s) against 5 %
    const hEnd = [W0.terrainH(e0[0], e0[1]), W0.terrainH(e1[0], e1[1])];
    let surf = Infinity, surfAt = null;
    for (const Tr of Wv.trees) {
      const dx = Tr.x - r.c[0], dz = Tr.z - r.c[1], u = dx * E[0] + dz * E[1], vv = -dx * E[1] + dz * E[0];
      if (Math.abs(u) <= hl || Math.abs(u) > hl + 1500 || Math.abs(vv) > r.wid / 2 + HALF + 30) continue;
      const k = u > 0 ? 1 : 0, s = Math.abs(u) - hl, top = Tr.h + 4.6 * Tr.s;
      const m = hEnd[k] + 0.05 * s - top;
      if (m < surf) { surf = m; surfAt = (k ? 'past end 1, ' : 'past end 0, ') + s.toFixed(0) + ' m out'; }
    }
    margins[v][r.id] = { taxi, roll, surf, surfAt };
  }
}
{
  const M = margins.map;
  const taxiMin = Math.min(...land.flatMap(r => M[r.id].taxi)), rollMin = Math.min(...land.map(r => M[r.id].roll));
  check(taxiMin > 0, '6 map: every stand\'s way out clears every collidable tree by the widest half-span (' + widest + ' ' + HALF + ' m)', 'least margin ' + taxiMin.toFixed(1) + ' m');
  check(rollMin > 0, '6 map: every runway\'s centreline clears every collidable tree by the widest half-span', 'least margin ' + rollMin.toFixed(1) + ' m');
  const H = M.HOME;
  check(H.surf > 0, '6 map: 13/31\'s climb-out and approach clear a 5 % surface over the collidable trees', H.surf.toFixed(1) + ' m under it at worst (' + H.surfAt + ')');
}

// the pavement kinds, per variant: the nearest collidable tree past a taxiway's, an apron's and a road's edge (the whole
// island), and under --all the nearest visible one round HOME's field; the variants' rules for them are printed below
const kindsCol = {};
{ const K = pavementKinds(O0);
  for (const v of VARIANTS) { kindsCol[v] = {}; for (const k of Object.keys(K)) { let m = Infinity; for (const Tr of worlds[v].trees) m = Math.min(m, K[k](Tr.x, Tr.z)); kindsCol[v][k] = m; } }
  check(VARIANTS.every(v => Object.values(kindsCol[v]).every(m => m > 0)), '3 no collidable tree on a taxiway, an apron or a road in any variant',
    VARIANTS.map(v => v + ' ' + Object.entries(kindsCol[v]).map(([k, m]) => k + ' ' + m.toFixed(1)).join(' ')).join(' | '));
}

// 7 the fill, per variant (full)
const page = {};
if (FULL) {
  for (const v of VARIANTS) {
    const R0 = pageRaw[v], line = R0.line;
    if (!line) { check(false, '7 ' + v + ': the page harness ran', 'exit ' + R0.status + ' ' + R0.err); continue; }
    page[v] = JSON.parse(line.slice(5));
    const P = page[v];
    check(P.world === 'jolene' && P.mode === v, '7 ' + v + ': the page composed Jolene in its variant', P.world + ' / ' + P.flag + ' / ' + P.mode + ', ' + R0.secs.toFixed(0) + ' s');
    let n = 0, onPave = 0, blocked = 0; const why = [];
    for (const [id, R] of Object.entries(P.runways)) { n += R.n; onPave += R.onPave; blocked += R.blocked; why.push(...R.bad.map(b => id + ' ' + b)); for (const s of ['L', 'R']) table[id + ' ' + s].vis[v] = R.near[s]; }
    check(n > 1000 && onPave === 0, '7 ' + v + ': no visible tree on paving', n + ' fill trees near the runways; ' + onPave + ' on paving' + (why.length ? '; ' + why.slice(0, 3).join(', ') : ''));
    check(blocked === 0, '7 ' + v + ': every visible tree stands outside the core\'s clearances (one rule)', blocked + ' inside');
    check(!P.errors.length, '7 ' + v + ': the page threw nothing', P.errors.join(' | '));
    if (P.kinds) check(Object.values(P.kinds).every(m => m > 0), '7 ' + v + ': no visible tree on a taxiway, an apron or a road round HOME\'s field', Object.entries(P.kinds).map(([k, m]) => k + ' ' + m.toFixed(1)).join(' '));
  }
  const nearer = ['HOME L', 'HOME R', 'w2 L', 'w2 R'].filter(k => page.map && page.today && table[k].vis.map && table[k].vis.today && table[k].vis.map[0] < table[k].vis.today[0]);
  check(nearer.length === 4, '7 map: the visible forest of 13/31 and 02/20 nearer than today on every side', nearer.join(', '));
}

// 8 the circuit flown in 'map' (full)
if (FULL) {
  const PT = require(path.join(T, 'pilot_trace.js'));
  PT.loadPanel();
  const GROUP = { DEPART: 'taxi', TAXI: 'taxi', LINEUP: 'taxi', STOP: 'taxi', HOLD: 'taxi', ROLL: 'roll', ABORT: 'roll', LIFTOFF: 'climb', PUTDOWN: 'climb', CLIMB: 'climb',
    CROSSWIND: 'circuit', DOWNWIND: 'circuit', BASE: 'circuit', ENROUTE: 'circuit', INBOUND: 'circuit', FINAL: 'final', GOAROUND: 'final', GLIDE: 'final', FLARE: 'landing', ROLLOUT: 'landing', STOPPED: 'landing' };
  // HOME's circuit with the user's aluminium C172 and the Cub (the player's default); East Point's with the Cub - the
  // strip whose fans and box the map lifts nearest (its 5 % surface goes 0.4 m under). Tamgas Hill (w3) is not flown:
  // the Cub cycles taxi / hold / line-up there without taking off in every variant (measured: 'today' and 'map' alike)
  for (const [name, key, fld] of [['aluminium C172', path.join(T, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json'), 'HOME'], ['Cub', 'cub', 'HOME'], ['Cub', 'cub', 'nv_strip']]) {
    const world = worlds.map;
    const def = C.buildGen(PT.specOf(key).spec);
    const sim = C.makeSim(def, world); sim.reset(0);
    const a = world.aerodromes.find(q => q.id === fld), site = C.siteOf(fld);
    if (sim.stance) sim.stance(); C.placeAtStand(sim, a, site.stand);
    for (let i = 0; i < 600; i++) sim.step(1 / 60);
    const ap = C.makePilot(sim, def, world, { style: 'normal' });
    ap.setRoute(a, a); ap.departFrom(a, a, site);
    const g = {}, out = [];
    let contact = 0, contactAt = null;
    for (let k = 0; k < 60 * 800; k++) {
      ap.update(1 / 60); sim.step(1 / 60);
      if (k % 6) continue;
      const grp = GROUP[ap.phase] || ap.phase, cg = sim.cgPos();
      const near = world.treesNear(cg[0], cg[2], out);
      let m = Infinity;
      for (const ti of near) {
        const Tr = world.trees[ti], R = R_OF(Tr), top = Tr.h + 4.6 * Tr.s;
        for (let i = 0; i < sim.n; i++) {
          if (sim.p[i * 3 + 1] > top) continue;
          const d = Math.hypot(sim.p[i * 3] - Tr.x, sim.p[i * 3 + 2] - Tr.z) - R;
          if (d < m) m = d;
        }
      }
      if (m <= 0) { contact++; if (!contactAt) contactAt = ap.phase + ' at ' + cg.map(q => q.toFixed(0)).join(','); }
      if (!(grp in g) || m < g[grp]) g[grp] = m;
      if (ap.phase === 'STOPPED') break;
    }
    check(ap.phase === 'STOPPED' && contact === 0, '8 map: the ' + name + ' flies ' + a.name + '\'s circuit to a stop and touches no tree',
      ap.phase + ' at ' + ap.t.toFixed(0) + ' s; ' + (contact ? contact + ' contacts, first ' + contactAt : 'nearest node to a tree cylinder (below its top): ' + Object.entries(g).map(([k, m]) => k + ' ' + (m === Infinity ? 'none within 64 m' : m.toFixed(1) + ' m')).join(', ')));
  }
}

// THE TABLE
console.log('\n  metres past the paved edge, inside the runway\'s length: the MAP\'s nearest TREE cell (canopy >= 2.5 m);');
console.log('  per variant the nearest COLLIDABLE tree (col) and VISIBLE tree (vis: the forest rule / the open ground; --all)');
console.log('  (map: the nearest / the median over 10 m stations of the first TREE cell within 200 m)');
console.log('  runway side  map near/median |  today col   vis(for/open) |    map col   vis(for/open) |   mapx col   vis(for/open)');
for (const r of land) for (const s of ['L', 'R']) {
  const row = table[r.id + ' ' + s];
  const cell = v => f1(row.col[v]) + '  ' + (row.vis[v] ? f1(row.vis[v][0]) + '/' + f1(row.vis[v][1]) : '     -     ');
  console.log('  ' + (r.id + ' ' + s).padEnd(12) + f1(row.map) + '/' + f1(row.med) + ' | ' + VARIANTS.map(v => '    ' + cell(v)).join(' |'));
}
console.log('\n  the pavement kinds - the nearest collidable tree past the edge (the island) / the nearest visible (HOME\'s field, --all), m:');
console.log('    rule: today - the pavement + its band + 6 m fade (taxiway 3+6, apron 3+6, road <= 1.2+6), the aerodrome box, the strip box');
console.log('          map / mapx - taxiways and aprons: the paving + ' + C.PREMISES_GEN.PAVE_SIDE + ' m (their drawn side); roads: unchanged (band + fade: what they draw)');
for (const k of ['taxiway', 'apron', 'road']) console.log('  ' + k.padEnd(10) + VARIANTS.map(v => v + ' ' + f1(kindsCol[v][k]) + ' / ' + (page[v] && page[v].kinds ? f1(page[v].kinds[k]) : '  -  ')).join('   '));
console.log('\n  the ground paths (the widest footprint, ' + widest + ' half-span ' + HALF + ' m, against each tree\'s cylinder), per variant: taxi | roll | 5 % surface');
for (const r of land) console.log('  ' + r.id.padEnd(10) + VARIANTS.map(v => { const M = margins[v][r.id]; return v + ' ' + (M.taxi.length ? Math.min(...M.taxi).toFixed(1) : '-') + ' | ' + M.roll.toFixed(1) + ' | ' + (M.surf === Infinity ? 'clear' : M.surf.toFixed(1)); }).join('   '));
console.log('GATE RWYTREES: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);

// THE PAVEMENT KINDS (the taxiways, the aprons, the other roads): a point's distance past the nearest edge of each kind
// (negative inside), off the overlay's own records - O.roads (w, pts; `taxiway` G980) and O.pavePolys (the aprons)
function pavementKinds(O) {
  const seg = (px, pz, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2)); return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz); };
  const roadD = list => (x, z) => { const L = O.frame.toLocal(x, z); let m = Infinity; for (const r of list) for (let i = 0; i + 1 < r.pts.length; i++) m = Math.min(m, seg(L[0], L[1], r.pts[i], r.pts[i + 1]) - r.w / 2); return m; };
  const inP = (poly, x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const polyD = list => (x, z) => { const L = O.frame.toLocal(x, z); let m = Infinity; for (const p of list) { let d = Infinity; for (let i = 0, j = p.poly.length - 1; i < p.poly.length; j = i++) d = Math.min(d, seg(L[0], L[1], p.poly[j], p.poly[i])); m = Math.min(m, inP(p.poly, L[0], L[1]) ? -d : d); } return m; };
  const ribbon = O.roads.filter(r => r.ribbon !== false);
  return { taxiway: roadD(ribbon.filter(r => r.taxiway)), apron: polyD(O.pavePolys), road: roadD(ribbon.filter(r => !r.taxiway)) };
}
// HOME's field: its aprons and taxiways, 150 m round
function fieldBox(O) {
  const pts = [].concat(...O.pavePolys.filter(p => /^m_(pad|turn)/.test(p.id)).map(p => p.poly), ...O.roads.filter(r => r.taxiway).map(r => r.pts)).map(q => O.frame.toWorld(q[0], q[1]));
  return [Math.min(...pts.map(q => q[0])) - 150, Math.min(...pts.map(q => q[1])) - 150, Math.max(...pts.map(q => q[0])) + 150, Math.max(...pts.map(q => q[1])) + 150];
}
