#!/usr/bin/env node
// GATE OBSTACLE (G433) — the solid things on the ground, headless.
//
//   1. the shape: a box rasterises to its own footprint and height, a cell round; a point inside
//      is pushed the shortest way out (up from a roof, sideways from a wall, never into the ground
//      under a thing that stands on it, down only from under a deck on posts)
//   2. the registry: bins, near(), move re-bins, remove, maxTop
//   3. THE DISCREPANCY (the user: "no more than 1 meter discrepancy with the visual mesh"): every
//      baked prop of the pier packs rasterised from its OWN geometry - every vertex of the mesh lies
//      in an occupied column between that column's lo and hi (nothing of the mesh is outside the
//      shape), and no occupied column lies more than a cell outside the mesh's own box (nothing of
//      the shape is far outside the mesh) - at the cells the viewer uses (0.5 m props)
//   4. THE SOLVER STOPS: an aeroplane rolled at a wall of settlement-house height on the flat world
//      comes to rest against it - its nose never past the far face, its CG never inside, the
//      simulation finite; the same aeroplane with the wall removed rolls through
//   5. the world: the analytic world registers its settlements' buildings at makeWorld
//
// Run: node tools/_obstacle_check.js   (contract: one final `GATE OBSTACLE: ...`)
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js');
const OB = C.OBSTACLES;
let fails = 0, checks = 0;
const fail = m => { console.log('  FAIL ' + m); fails++; checks++; };
const ok = m => { console.log('  ok   ' + m); checks++; };
const yes = (c, m) => (c ? ok : fail)(m);

console.log('1. the shape');
{
  const b = OB.box(4.5, 1.8, 1.5, 0.5);
  yes(!!b && b.cells === 40 && Math.abs(b.top - 1.5) < 1e-6, 'a 4.5 x 1.8 x 1.5 box at 0.5 m is 4 x 10 occupied cells, top 1.5 (' + (b && b.cells) + ', ' + (b && b.top) + ')');
  const r = { x: 100, z: 50, yaw: 0.3, y0: 10, c: Math.cos(0.3), s: Math.sin(0.3), shape: b };
  const P = (dx, dy, dz) => OB.penetration(r, 100 + dx * r.c + dz * r.s, 10 + dy, 50 - dx * r.s + dz * r.c, [0, 0, 0]);
  let p = P(0, 1.3, 0); yes(p && p[0] === 0 && p[2] === 0 && p[1] > 0.2 && p[1] < 0.3, 'a point near the roof goes UP ' + (p && p[1].toFixed(2)));
  p = P(0, 0.5, 0); yes(p && p[1] > 1.0 && p[1] < 1.1, 'a point deep in a grounded box goes UP, never into the ground (' + (p && p[1].toFixed(2)) + ')');
  p = P(0.8, 0.3, 0); yes(p && Math.abs(p[1]) < 1e-9 && Math.hypot(p[0], p[2]) > 0.6 && Math.hypot(p[0], p[2]) < 1.0 && (p[0] * r.c - p[2] * r.s) > 0.5, 'a point by the side wall goes SIDEWAYS, outward, in the world frame (' + (p && p.map(v => v.toFixed(2)).join(',')) + ')');
  p = P(0, 0.3, 2.1); yes(p && (p[0] * r.s + p[2] * r.c) > 0.5, 'a point by the nose goes out through the nose');
  yes(P(1.6, 0.3, 0) === null && P(0, 1.7, 0) === null && P(0, -0.2, 0) === null, 'outside, above and below are free');
  // a deck on posts: a slab from 2 to 2.3 m over a 4 x 4 footprint
  const deck = OB.rasterise([-2, 2, -2, 2, 2, -2, 2, 2, 2, -2, 2, 2, -2, 2.3, -2, 2, 2.3, -2, 2, 2.3, 2, -2, 2.3, 2], [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7], 0.5);
  const rd = { x: 0, z: 0, yaw: 0, y0: 0, c: 1, s: 0, shape: deck };
  yes(OB.penetration(rd, 0, 1.0, 0, [0, 0, 0]) === null, 'under a deck on posts the air is free');
  p = OB.penetration(rd, 0, 2.05, 0, [0, 0, 0]); yes(p && p[1] < 0 && p[1] > -0.2, 'just under its underside a point goes DOWN (' + (p && p[1].toFixed(2)) + ')');
}

console.log('2. the registry');
{
  const reg = OB.make(), b = OB.box(4, 2, 1.5, 0.5), out = [];
  const a = reg.add({ x: 10, z: 10, yaw: 0, y0: 5, shape: b, tag: 'a' }), c = reg.add({ x: 300, z: 300, yaw: 0, y0: 0, shape: b });
  yes(reg.count === 2 && Math.abs(reg.maxTop - 6.5) < 1e-6, 'two added, maxTop the taller');
  yes(reg.near(12, 8, out).length === 1 && out[0] === a && reg.near(300, 310, out).length === 1 && out[0] === c && reg.near(150, 150, out).length === 0, 'near() answers by bin');
  reg.move(a, 300, 290, 1.0, 0);
  yes(reg.near(12, 8, out).length === 0 && reg.near(300, 300, out).length === 2 && Math.abs(reg.get(a).c - Math.cos(1.0)) < 1e-9, 'move re-bins and turns');
  reg.remove(c); yes(reg.count === 1 && Math.abs(reg.maxTop - 1.5) < 1e-6 && reg.near(300, 300, out).length === 1, 'remove drops the bins and re-reads maxTop');
  const e = reg.add({ x: 64, z: 64, yaw: 0, y0: 0, shape: b }); yes(reg.near(60, 60, out).indexOf(e) >= 0 && reg.near(70, 70, out).indexOf(e) >= 0, 'a thing astride a bin edge is in both bins');
}

console.log('3. the discrepancy against the baked meshes');
{
  const dir = path.join(__dirname, '..', 'src', 'pier'), mf = path.join(dir, 'pier_packs.json');
  const vm = require('vm');
  const REG = { props: {}, order: [] };
  const sb = { registerPropPack: p => { for (const k of p.order || Object.keys(p.props)) { REG.props[k] = p.props[k]; REG.order.push(k); } }, console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(mf, 'utf8'))) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sb, { filename: f });
  const keys = REG.order.filter(k => !REG.props[k].lodOf);
  let worstOut = 0, worstMiss = 0, n = 0, badKeys = [];
  for (const k of keys) {
    const prop = REG.props[k];
    if (!prop.bin) continue;
    const raw = fs.readFileSync(path.join(__dirname, '..', prop.bin));
    const bin = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);   // the codec wants a view with a buffer (a DataView is taken over it)
    const dec = C.decodeProp(prop, bin);    // the viewer's own decode: metres in the prop's frame
    let nvT = 0, ntT = 0; for (const pt of dec.parts) { nvT += pt.nv; ntT += pt.nt; }
    const pos = new Float32Array(nvT * 3), idx = new Uint32Array(ntT * 3); let vo = 0, to = 0;
    for (const pt of dec.parts) { pos.set(pt.pos, vo * 3); for (let i = 0; i < pt.idx.length; i++) idx[to + i] = pt.idx[i] + vo; vo += pt.nv; to += pt.idx.length; }
    const M = { pos, idx, nv: nvT };
    const cell = 0.5;
    const S = OB.rasterise(M.pos, M.idx, cell);
    if (!S) { badKeys.push(k + ':empty'); continue; }
    n++;
    // every vertex inside an occupied column, between lo and hi (to a millimetre)
    let miss = 0;
    for (let i = 0; i < M.nv; i++) {
      const x = M.pos[i * 3], y = M.pos[i * 3 + 1], z = M.pos[i * 3 + 2];
      const ci = Math.floor((x - S.ox) / cell), cj = Math.floor((z - S.oz) / cell), kk = cj * S.nx + ci;
      if (ci < 0 || cj < 0 || ci >= S.nx || cj >= S.nz || S.hi[kk] < S.lo[kk]) { miss = 1e9; break; }
      const m = Math.max(0, S.lo[kk] - y, y - S.hi[kk]); if (m > miss) miss = m;
    }
    if (miss > worstMiss) worstMiss = miss;
    // no occupied column further than a cell outside the mesh's box; no column top above the mesh
    const bb = prop.bb; let outside = 0;
    for (let j = 0; j < S.nz; j++) for (let i = 0; i < S.nx; i++) { const kk = j * S.nx + i; if (S.hi[kk] < S.lo[kk]) continue;
      const cx0 = S.ox + i * cell, cz0 = S.oz + j * cell;
      const dx = Math.max(0, bb[0] - (cx0 + cell), cx0 - bb[3]), dz = Math.max(0, bb[2] - (cz0 + cell), cz0 - bb[5]);
      outside = Math.max(outside, dx, dz, S.hi[kk] - bb[4], bb[1] - S.lo[kk]); }
    if (outside > worstOut) worstOut = outside;
    if (miss > 1e-3 || outside > cell + 1e-3) badKeys.push(k + ':' + miss.toFixed(3) + '/' + outside.toFixed(3));
  }
  yes(n >= 90, n + ' baked props rasterised from their own geometry');
  yes(worstMiss <= 1e-3, 'every vertex of every mesh lies inside its shape (worst miss ' + worstMiss.toFixed(4) + ' m)');
  yes(worstOut <= 0.5 + 1e-3, 'no shape reaches more than a cell (0.5 m) outside its mesh\'s box (worst ' + worstOut.toFixed(3) + ' m) - the 1 m rule holds by construction');
  yes(badKeys.length === 0, 'no prop off the rule' + (badKeys.length ? ': ' + badKeys.slice(0, 6).join(' ') : ''));
}

console.log('4. the solver stops at a wall');
{
  const W0 = C.makeWorld(0, {});
  const strip = W0.aerodromes.find(a => a.id === 'HOME') || W0.aerodromes[0];
  // a flat world at the strip's elevation, no trees, its own obstacle registry; the aeroplane at full
  // throttle down the strip, the wall stood across its measured track once it is rolling
  const D = 70;
  const run = (wall) => {
    const reg = OB.make();
    const W = Object.assign({}, W0, { terrainH: () => strip.elev, treesNear: (x, z, o) => { o.length = 0; return o; }, obstacles: reg });
    const def = C.buildGen(), sim = C.makeSim(def, W);
    sim.reset(0); C.placeAtAerodrome(sim, strip);
    for (let f = 0; f < 120; f++) sim.step(1 / 60);
    const c0 = sim.cgPos();
    sim.ctl.thr = 1;
    let fx = 0, fz = 0, stood = false, maxNose = -Infinity, maxObst = 0, bad = false, along = 0, vmax = 0;
    const noseOf = () => { let m = -Infinity; for (let i = 0; i < sim.n; i++) { const a = (sim.p[i * 3] - c0[0]) * fx + (sim.p[i * 3 + 2] - c0[2]) * fz; if (a > m) m = a; } return m; };
    for (let f = 0; f < 14 * 60; f++) {
      sim.step(1 / 60);
      if (sim.stats().bad) { bad = true; break; }
      const c = sim.cgPos(), dx = c[0] - c0[0], dz = c[2] - c0[2], d = Math.hypot(dx, dz);
      if (!stood && d > 6) {
        fx = dx / d; fz = dz / d; stood = true;
        if (wall) reg.add({ x: c0[0] + fx * (D + 4), z: c0[2] + fz * (D + 4), yaw: Math.atan2(fx, fz), y0: strip.elev, shape: OB.box(8, 30, 5, 1.0), tag: 'wall' });
        sim.ctl.thr = 0.35;   // enough to keep rolling on the ground, not to fly
      }
      if (stood) { maxNose = Math.max(maxNose, noseOf()); maxObst = Math.max(maxObst, sim.out.obst || 0); along = dx * fx + dz * fz; vmax = Math.max(vmax, sim.out.V || 0); }
      if (stood && sim.wheelsOnGround && sim.wheelsOnGround() === 0 && !wall) { sim.ctl.thr = 0; }
    }
    return { bad, stood, maxNose, maxObst, along, speed: Math.hypot(sim.v[0], sim.v[2]), vmax };
  };
  const hit = run(true), free = run(false);
  yes(!hit.bad && !free.bad && hit.stood && free.stood, 'both runs finite and rolling (' + free.vmax.toFixed(1) + ' m/s at the most)');
  yes(free.along > D + 4, 'with no wall the aeroplane rolls through the place (' + free.along.toFixed(1) + ' m)');
  yes(hit.maxObst > 0, 'against the wall the solver reports nodes in contact (' + hit.maxObst + ' at the most)');
  yes(hit.maxNose < D + 8.0, 'the nose never passes the far face of the wall (' + hit.maxNose.toFixed(1) + ' m of ' + (D + 8).toFixed(0) + ')');
  yes(hit.along < D + 0.5, 'the CG stays this side of the wall (' + hit.along.toFixed(1) + ' m of ' + D + ')');
  yes(hit.speed < 1.5, 'the aeroplane comes to rest against it under a third of throttle (' + hit.speed.toFixed(2) + ' m/s)');
}

console.log('5. the world');
{
  const W = C.makeWorld(0, {});
  yes(!!W.obstacles && W.obstacles.count === W.roadNet.buildings.length && W.obstacles.count > 0, 'the analytic world registers its ' + W.roadNet.buildings.length + ' settlement buildings (' + (W.obstacles && W.obstacles.count) + ')');
  const b = W.roadNet.buildings[0], out = [];
  yes(W.obstacles.near(b.x, b.z, out).length >= 1, 'a settlement building answers near() at its own place');
}

console.log(checks + ' checks, ' + fails + ' failed');
console.log('GATE OBSTACLE: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
