#!/usr/bin/env node
// GATE TREEHIT (G1112, TREES-NEAR) - the collidable woodland, and the solver actually meeting it.
//
// The user (2026-09-30): "we have collisions for the trees, right?" On Jolene the answer was no. Two faults, each alone
// enough: (1) the solver tested trees only while its anchor node was under y = 24 m - the ANALYTIC world's field is at
// y = 0, Jolene's HOME at 31.7 m, so no tree was ever tested at the default field; (2) the woodland kept the analytic
// biome's 165 m treeline on the island, so nothing over 165 m was collidable although the tree map forests it to ~900 m.
//
//   1. the island's woodland: trees rooted over 165 m exist, and every one stands on the tree map's TREE class
//   2. the solver meets a trunk AT ANY ELEVATION: an aeroplane rolled at a lone tree on a flat world at 0 m and at 300 m
//      stops against it the same way (its CG never past the trunk); with no tree it rolls through
//
//   G1330 (TREE-HITBOX), the user (2026-10-03): "trees have no hitbox, only some of them. We should at least be able
//   to hit the trunks." Only the woodland's physics trees (0.8 % of the drawn) could be hit; the forest fill, the
//   woodland's clump neighbours, the hand-placed and the premises' trees were pictures. Every drawn tree now registers
//   a trunk on world.treeHits (29_obstacles.js TREE_HITS):
//   3. THE RULE AND THE BINS: TREE_HITS.trunkOf (radius 2 % of the drawn height held to 0.3..0.6 m, the top 0.5..0.8 H
//      by the crown's width); a set binned once, a point inside a trunk found by its own cell only, a wide set on
//      coarser cells; set / drop / clear; the sim worker's world takes the same sets (sim_host simHostWorldOp 'tset')
//   4. A FLIGHT INTO A FOREST-FILL TRUNK (the fill's rule: a 15 m realistic fir, r 0.3 m), through the world's own
//      set: taxied at it - on the centreline and across the span to the tip - it stops the aeroplane like the
//      woodland's cylinder (the solver tests BEAMS against trunks: the nodes alone let a 0.3 m trunk through);
//      flown at it at 4 m AGL, 30 m/s, the airframe meets it and loses speed (with no set it flies through untouched)
//   5. THE CENSUS (FULL: the page in node, Jolene, rolled out - tools/_page_node.js): every tree drawn within 1 km of
//      the aeroplane, by kind (the fill, the woodland with its neighbours and placed trees, the premises' trees),
//      collidable now (a trunk at its root, or the woodland's core cylinder) against before (the core cylinder alone);
//      and the page's own trunk of the fill tree nearest the stand, flown as in 4
//
// Run: node tools/_treehit_check.js   (contract: one final `GATE TREEHIT: ...`; the census under --all or outside
//      the runner's core tier, as GATE RWYTREES' page part)
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);

// ---- the page child (G1330): the census round the aeroplane on HOME's stand, JSON on stdout's last line ----------
if (argv[0] === '--page') {
  (async () => {
    const { openPage } = require('./_page_node.js');
    const P = await openPage({ quiet: true, storage: {} });
    const W = P.win;
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
    W.document.getElementById('bGo').click();
    const tripDone = () => { const Tr = W.FLYDIY_TRIPS; const t = Tr && Tr[Tr.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
    await P.until(() => W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
    await P.frames(30);
    const w = W.FLIGHT_PROBE.world(), sim = W.FLIGHT_PROBE.sim(), TH = w.treeHits, cg = sim.cgPos(), R = 1000;
    const scratch = [];
    const legacy = (x, y, z) => { w.treesNear(x, z, scratch); for (const i of scratch) { const T = w.trees[i], r = 0.7 * T.s + 0.12;
      if ((T.x - x) ** 2 + (T.z - z) ** 2 <= r * r && y <= T.h + 4.6 * T.s) return true; } return false; };
    const K = { fill: [0, 0, 0], wood: [0, 0, 0], prem: [0, 0, 0] };   // drawn, collidable now, collidable before
    const D = W.TREE_LOD.drawn(cg[0], cg[2], R);
    for (let i = 0; i < D.length; i += 4) {
      // probed 0.2 m over its root: a 1.5 m sapling's trunk tops out at 1 m (it read as a miss at root + 1 m)
      const k = D[i + 3] ? K.wood : K.fill, x = D[i], y = D[i + 1] + 0.2, z = D[i + 2], was = legacy(x, y, z);
      k[0]++; if (was || TH.at(x, y, z) > 0) k[1]++; if (was) k[2]++;
    }
    const O = w.premises && w.premises.overlay;
    if (O) for (const t of O.records.trees) {
      if (!t.key || t.key === 'stub|tree') continue;
      const p = O.frame.toWorld(t.x, t.z); if ((p[0] - cg[0]) ** 2 + (p[1] - cg[2]) ** 2 > R * R) continue;
      const y = t.y + 0.2, was = legacy(p[0], y, p[1]);
      K.prem[0]++; if (was || TH.at(p[0], y, p[1]) > 0) K.prem[1]++; if (was) K.prem[2]++;
    }
    // the fill trunk nearest the stand, as the page registered it
    let best = null, bd = Infinity;
    for (const key of TH.keys()) { if (key.indexOf('fill:') !== 0) continue; const a = TH.get(key);
      for (let o = 0; o < a.length; o += 5) { const d = Math.hypot(a[o] - cg[0], a[o + 1] - cg[2]); if (d < bd) { bd = d; best = Array.from(a.subarray(o, o + 5)); } } }
    const phys = w.trees.filter(T => (T.x - cg[0]) ** 2 + (T.z - cg[2]) ** 2 <= R * R).length;   // the woodland's physics trees (drawn or not)
    const out = { world: W.FLYDIY_WORLD, phys, cg: Array.from(cg), R, K, sets: TH.sets, keys: TH.keys().length, count: TH.count, fillSets: TH.keys().filter(k => k.indexOf('fill:') === 0).length,
                  wood: TH.has('wood'), prem: TH.has('prem'), trunk: best, trunkD: bd,
                  errors: P.errors.filter(e => /^(script |timer: |frame: )/.test(e)).slice(0, 5) };
    process.stdout.write('\nPAGE ' + JSON.stringify(out) + '\n');
    process.exit(0);
  })().catch(e => { console.error(e); process.exit(2); });
  return;
}
const C = require('./flight_core.js');
let fails = 0, checks = 0;
const yes = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + m); };

console.log('1. the island\'s collidable woodland');
{
  let IN = null; try { IN = require('./island_node.js'); } catch (e) {}
  const fx = path.join(__dirname, 'fixtures', 'island_jolene.json');
  const W = IN && IN.islandWorld('jolene', { premises: fs.readFileSync(fx, 'utf8') });
  yes(!!W, 'Jolene composes in node');
  if (W) {
    const hi = W.trees.filter(t => t.h > 165).length;
    yes(hi > 1000, 'trees rooted over the analytic treeline (165 m) are collidable: ' + hi + ' of ' + W.trees.length);
    let off = 0; for (const t of W.trees) if (W.island.effClass(t.x, t.z) !== W.island.WC.TREE) off++;
    yes(off === 0, 'every collidable tree stands on the tree map\'s TREE class (' + off + ' off it)');
    const home = W.aerodromes.find(a => a.id === 'HOME');
    yes(home && W.terrainH(home.x, home.z) > 24, 'HOME stands over 24 m (' + (home ? W.terrainH(home.x, home.z).toFixed(1) : '?') + ' m): the case the old altitude gate missed');
  }
}

console.log('2. the solver meets a trunk at any elevation');
{
  const W0 = C.makeWorld(0, {});
  const strip = W0.aerodromes.find(a => a.id === 'HOME') || W0.aerodromes[0];
  const D = 60;
  // a flat world at `elev`, one tree (size 1.5: R 1.17 m, 6.9 m tall) stood on the aeroplane's measured track D m on
  const run = (elev, tree) => {
    const trees = [];
    const W = Object.assign({}, W0, { terrainH: () => elev, obstacles: C.OBSTACLES.make(), trees,
      treesNear: (x, z, o) => { o.length = 0; for (let i = 0; i < trees.length; i++) if (Math.abs(trees[i].x - x) < 192 && Math.abs(trees[i].z - z) < 192) o.push(i); return o; } });
    const def = C.buildGen(), sim = C.makeSim(def, W);
    sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev }));
    for (let f = 0; f < 120; f++) sim.step(1 / 60);
    const c0 = sim.cgPos();
    sim.ctl.thr = 1;
    let fx = 0, fz = 0, stood = false, along = 0, reach = -Infinity, bad = false, vmax = 0;
    for (let f = 0; f < 14 * 60; f++) {
      sim.step(1 / 60);
      if (sim.stats().bad) { bad = true; break; }
      const c = sim.cgPos(), dx = c[0] - c0[0], dz = c[2] - c0[2], d = Math.hypot(dx, dz);
      if (!stood && d > 6) {
        fx = dx / d; fz = dz / d; stood = true;
        if (tree) trees.push({ x: c0[0] + fx * D, z: c0[2] + fz * D, h: elev, s: 1.5, sp: 0 });
        sim.ctl.thr = 0.35;
      }
      if (stood) { along = dx * fx + dz * fz; reach = Math.max(reach, along); vmax = Math.max(vmax, sim.out.V || 0); }
      if (stood && sim.wheelsOnGround && sim.wheelsOnGround() === 0 && !tree) sim.ctl.thr = 0;
    }
    return { bad, stood, along, reach, vmax };
  };
  const free = run(300, false), low = run(0, true), high = run(300, true);
  yes(!free.bad && !low.bad && !high.bad && free.stood && low.stood && high.stood, 'the three runs finite and rolling (' + free.vmax.toFixed(1) + ' m/s at the most)');
  yes(free.along > D + 2, 'with no tree the aeroplane rolls through the place (' + free.along.toFixed(1) + ' m)');
  // the trunk springs the aeroplane back (it rolls back and forth against it under a third of throttle), so the verdict
  // is the FURTHEST the CG got: short of the trunk, and within a few metres of it (stopped BY the tree, not before it)
  const TOUCH = 6;   // the CG is ~1.2 m behind the nose on the stock build, the trunk's radius 1.17 m, the spring's give
  yes(low.reach < D && low.reach > D - TOUCH, 'at 0 m the trunk stops it (the CG got to ' + low.reach.toFixed(1) + ' m of ' + D + ')');
  yes(high.reach < D && high.reach > D - TOUCH, 'at 300 m the trunk stops it too (' + high.reach.toFixed(1) + ' m of ' + D + ') - the altitude gate is gone');
}

// ---- G1330 (TREE-HITBOX) ------------------------------------------------------------------------------------------
console.log('3. the trunk rule, the bins, the worker\'s world');
{
  const TH = C.TREE_HITS, tk = TH.trunkOf(15, 0.28);
  yes(Math.abs(tk[0] - 0.3) < 1e-9 && Math.abs(tk[1] - 0.67 * 15) < 1e-9, 'a 15 m realistic fir (crown 0.28 H): r 0.3 m, the trunk to ' + tk[1].toFixed(2) + ' m');
  const tb = TH.trunkOf(25, 0.45);
  yes(Math.abs(tb[0] - 0.5) < 1e-9 && Math.abs(tb[1] - 12.5) < 1e-9, 'a 25 m maple (crown 0.45 H): r 0.5 m, the trunk splits at ' + tb[1].toFixed(1) + ' m');
  // a random field, every point against the brute force
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const H = TH.make(), A = [];
  for (let i = 0; i < 3000; i++) { const x = rnd() * 1024 - 300, z = rnd() * 1024 + 50, y0 = rnd() * 20; A.push(x, z, y0, 0.3 + rnd() * 0.3, y0 + 3 + rnd() * 12); }
  H.set('a', A);
  const W2 = []; for (let i = 0; i < 400; i++) W2.push(rnd() * 24000 - 12000, rnd() * 24000 - 12000, 0, 0.6, 10);   // an island-wide set
  H.set('w', W2);
  const all = A.concat(W2);
  let bad = 0;
  for (let q = 0; q < 20000; q++) {
    const pick = q % 2 ? (rnd() * all.length / 5 | 0) * 5 : -1;
    const x = pick >= 0 ? all[pick] + (rnd() - 0.5) * 1.4 : rnd() * 1024 - 300, z = pick >= 0 ? all[pick + 1] + (rnd() - 0.5) * 1.4 : rnd() * 1024 + 50, y = rnd() * 25 - 1;
    let want = 0; for (let o = 0; o < all.length; o += 5) { const dx = x - all[o], dz = z - all[o + 1]; if (dx * dx + dz * dz <= all[o + 3] * all[o + 3] && y <= all[o + 4] && y >= all[o + 2] - 1) want++; }
    if (H.at(x, y, z) !== want) bad++;
  }
  yes(bad === 0, '20 000 points (half beside a trunk) against the brute force: ' + bad + ' differ; ' + H.count + ' trunks in ' + H.sets + ' sets, the island-wide set on ' + H.list.find(S => S.key === 'w').cell + ' m cells');
  H.drop('a'); yes(H.count === 400 && H.sets === 1, 'a set dropped goes whole (' + H.count + ' left)');
  // the worker's world: the page's ops replayed (sim_host.js simHostWorldOp), the same trunks
  const SH = require(path.join(__dirname, '..', 'src', 'viewer', 'sim_host.js'));
  const Wk = C.makeWorld(0, {});
  SH.simHostWorldOp(Wk, { cmd: 'obst', ops: [{ op: 'tset', key: 'fill:0,0:0', arr: Float32Array.from(A) }, { op: 'tset', key: 'wood', arr: Float32Array.from(W2) }, { op: 'tdrop', key: 'wood' }] });
  yes(SH.simHostIsWorldOp({ cmd: 'obst' }) && Wk.treeHits.count === 3000 && Wk.treeHits.keys().join() === 'fill:0,0:0' && Wk.__simV === 1, 'the worker\'s world takes the page\'s tset / tdrop (' + Wk.treeHits.count + ' trunks, version ' + Wk.__simV + ')');
  SH.simHostWorldOp(Wk, { cmd: 'obst', ops: [{ op: 'tclear' }] });
  yes(Wk.treeHits.count === 0, 'and its tclear');
}

console.log('4. a flight into a forest-fill trunk');
// the trunk: arr [x, z, y0, r, y1] relative to nothing - stood D m on along the aeroplane's nose
const W0b = C.makeWorld(0, {});
const STRIP = W0b.aerodromes.find(a => a.id === 'HOME') || W0b.aerodromes[0];
function flyAt(trunk, o) {
  const elev = o.elev, TH = C.TREE_HITS.make();
  const W = Object.assign({}, W0b, { terrainH: () => elev, obstacles: C.OBSTACLES.make(), trees: [], treesNear: (x, z, q) => { q.length = 0; return q; }, treeHits: TH });
  const def = C.buildGen(), sim = C.makeSim(def, W);
  sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, STRIP, { elev, spawnElev: elev + (o.agl || 0) }));
  const fx = Math.cos(STRIP.hdg), fz = Math.sin(STRIP.hdg);   // the nose (placeAtAerodrome turns the def's -x onto hdg)
  if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);   // on the ground: settled on its wheels first
  if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = o.V * fx; sim.v[i * 3 + 2] = o.V * fz; }
  const c0 = sim.cgPos().slice();
  // the trunk D m on, its foot sunk as the fill's is (the collection's sink), on this world's ground
  const off = o.off || 0;   // across the track (to the left wing), m
  if (trunk) TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev - trunk.sink, trunk.r, elev - trunk.sink + trunk.h]);
  sim.ctl.thr = o.thr;
  let reach = -Infinity, hits = 0, vPass = null, bad = false;
  for (let f = 0; f < o.secs * 60; f++) {
    sim.step(1 / 60);
    if (sim.stats().bad) { bad = true; break; }
    const c = sim.cgPos(), along = (c[0] - c0[0]) * fx + (c[2] - c0[2]) * fz;
    reach = Math.max(reach, along);
    if (o.rollThen != null && along > 6) sim.ctl.thr = o.rollThen;   // the old gate's roll: full power to get going, then a third
    if (vPass === null && along > o.D + 10) { const v = sim.cgVel(); vPass = v[0] * fx + v[2] * fz; }
  }
  hits = sim.trunkHits();
  return { bad, reach, hits, vPass };
}
function flightChecks(trunk, tag) {
  const D = 60, TOUCH = 6;
  // the taxi: the old gate's run (full power to get rolling, then a third), stopped by the trunk alone
  const free = flyAt(null, { elev: 300, D, thr: 1, rollThen: 0.35, secs: 14 }), taxi = flyAt(trunk, { elev: 300, D, thr: 1, rollThen: 0.35, secs: 14 });
  yes(!free.bad && !taxi.bad && free.reach > D + 2 && taxi.reach < D && taxi.reach > D - TOUCH && taxi.hits > 0,
    tag + ': taxied at it, the trunk stops the aeroplane (the CG to ' + taxi.reach.toFixed(1) + ' m of ' + D + '; ' + free.reach.toFixed(1) + ' m with none)');
  // across the span (the stock build's tips at +-5 m): the wing meets it - the aeroplane slews round it, its CG held
  // within a few metres past the trunk's line, never the free run's 80+
  const offs = [0.7, 1.5, 2.5, 3.5, 4.5], side = offs.map(off => flyAt(trunk, { elev: 300, D, thr: 1, rollThen: 0.35, secs: 14, off }));
  yes(side.every(r => !r.bad && r.hits > 0 && r.reach < D + 5), tag + ': across the span, ' + offs.map((off, i) => off + ' m -> ' + side[i].reach.toFixed(0)).join(', ') + ' m (the CG past the trunk\'s line by 5 m at most)');
  const Df = 40, a = flyAt(null, { elev: 300, agl: 4, V: 30, D: Df, thr: 1, secs: 4 }), b = flyAt(trunk, { elev: 300, agl: 4, V: 30, D: Df, thr: 1, secs: 4 });
  yes(!a.bad && !b.bad && a.hits === 0 && a.vPass !== null && b.hits > 0 && (b.vPass === null || a.vPass - b.vPass > 5),
    tag + ': flown at it (4 m AGL, 30 m/s): ' + b.hits + ' beam contacts, ' + (b.vPass === null ? 'stopped by it (the CG to ' + b.reach.toFixed(1) + ' m of ' + Df + ')' : (a.vPass - b.vPass).toFixed(1) + ' m/s lost passing it')
    + '; with no trunk it flies on past at ' + a.vPass.toFixed(1) + ' m/s, nothing touched');
}
{
  // the fill's rule (render_world.js trunksOf): the realistic fir (9.29 m model, crown 0.28 H, size 2.1, sink 0) at
  // the island's canopy - about 15 m drawn
  const tk = C.TREE_HITS.trunkOf(15, 0.28);
  flightChecks({ r: tk[0], h: tk[1], sink: 0 }, 'the fill\'s rule, a 15 m fir');
}

// THE CENSUS (FULL): the page in node
const FULL = process.env.GATES_CORE !== '1' || argv.includes('--all');
if (FULL) {
  console.log('5. the census: every tree drawn within 1 km of the aeroplane on HOME\'s stand (the page in node)');
  const { spawnSync } = require('child_process');
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000', __filename, '--page'], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 1800000 });
  const line = (r.stdout || '').split('\n').reverse().find(l => l.indexOf('PAGE ') === 0);
  const pg = line ? JSON.parse(line.slice(5)) : null;
  yes(!!pg, 'the page booted and rolled out (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)' + (pg ? '' : ': ' + (r.stderr || '').slice(-400)));
  if (pg) {
    console.log('       kind       drawn   collidable now   before');
    for (const k of ['fill', 'wood', 'prem']) console.log('       ' + k.padEnd(8) + String(pg.K[k][0]).padStart(8) + String(pg.K[k][1]).padStart(17) + String(pg.K[k][2]).padStart(9));
    yes(pg.K.fill[0] > 1000 && pg.K.fill[1] === pg.K.fill[0], 'every fill tree drawn is collidable (' + pg.K.fill[1] + ' of ' + pg.K.fill[0] + '; before: ' + pg.K.fill[2] + ')');
    yes(pg.K.wood[1] === pg.K.wood[0], 'every woodland tree drawn - its neighbours and the placed ones too - is collidable (' + pg.K.wood[1] + ' of ' + pg.K.wood[0] + '; before: ' + pg.K.wood[2] + ')');
    yes(pg.K.prem[1] === pg.K.prem[0], 'every premises tree drawn is collidable (' + pg.K.prem[1] + ' of ' + pg.K.prem[0] + '; before: ' + pg.K.prem[2] + ')');
    yes(pg.fillSets > 0 && (pg.wood || !pg.K.wood[0]), 'the world holds ' + pg.count + ' trunks in ' + pg.sets + ' sets (' + pg.fillSets + ' fill chunk parts round the aeroplane' + (pg.wood ? ', the woodland' : '') + (pg.prem ? ', the premises' : '') + ')');
    // FOUND HERE, NOT FIXED (G1330): on Jolene the woodland draws NOTHING - plantWoodland's fill() reads H.imps[0], null
    // when no tree of a side was dealt series 0, and throws on the first cell (master too). Its physics trees are
    // still the core's cylinders: hit, not seen. Printed so the day it is drawn the census counts it
    if (!pg.K.wood[0] && pg.phys) console.log('       NOTE: the woodland draws nothing here (' + pg.phys + ' physics trees within ' + pg.R + ' m: the core\'s cylinders, unseen) - plantWoodland throws on H.imps[0] (pre-existing; see HANDOVER G1330)');
    yes(!pg.errors.length, 'no page error' + (pg.errors.length ? ': ' + pg.errors[0] : ''));
    if (pg.trunk) {
      const a = pg.trunk, ground = pg.cg[1];   // (the sink: the drawn foot under the ground it stands on is not known here; the trunk's own length is)
      console.log('       the page\'s fill trunk nearest the stand (' + pg.trunkD.toFixed(0) + ' m): r ' + a[3].toFixed(2) + ' m, ' + (a[4] - a[2]).toFixed(1) + ' m long');
      flightChecks({ r: a[3], h: a[4] - a[2], sink: 0 }, 'the page\'s own fill trunk');
    } else yes(false, 'a fill trunk near the stand');
  }
}

// (train 18: the verdict on a line of its own - run_gates reads /^GATE TREEHIT: PASS$/m, so a trailing count read as a FAIL)
console.log('  ' + (checks - fails) + '/' + checks + ' checks');
console.log('GATE TREEHIT: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
