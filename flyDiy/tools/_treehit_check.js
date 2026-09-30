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
// Run: node tools/_treehit_check.js   (contract: one final `GATE TREEHIT: ...`)
'use strict';
const fs = require('fs'), path = require('path');
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

// (train 18: the verdict on a line of its own - run_gates reads /^GATE TREEHIT: PASS$/m, so a trailing count read as a FAIL)
console.log('  ' + (checks - fails) + '/' + checks + ' checks');
console.log('GATE TREEHIT: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
