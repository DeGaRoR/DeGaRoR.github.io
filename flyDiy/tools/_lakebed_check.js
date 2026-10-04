#!/usr/bin/env node
// _lakebed_check.js — GATE LAKEBED (LAKE-HOLES G1335-G1339, the user 2026-10-03): NO LAKE EDGE HAS A GAP.
//
// The lakes were made by CUTTING the ground: every island ground program discarded its fragments a metre inside the lake
// field, and wherever the shore stood over the water the eye saw a vertical gap between the ground's cut edge and the
// flat water (the clear colour through it, worst on far shores). Now the lakebed is CARVED (28_island.js lakeBed, taken
// by makeWorld's terrainH and by the far terrain's patches) and the ground is drawn whole. This gate holds that:
//
//   1. THE CUT IS GONE. No island ground program discards for the lake field (the near ring, the fine tiles, the twin
//      under the premises, the far terrain - one hook makes them all, render_world.js islandGroundHookFor); the far
//      terrain is one material again (no lake-free `|dry` twin); its patches take the bed as they take the sea's shelf;
//      the ring and the fine tiles read world.terrainH (which carries the bed), the fine tiles at a shore too (their blend
//      back to the ring's chords within 30 m of a lake is gone: those chords stood over the water inside the line).
//   2. THE BED (Jolene with its premises, tools/island_node.js). The law: under the level from the line in (`edge` at
//      the line, `depth` by `shoreW`), the bank sloped down to it, only ever lowering the ground. For every drawn lake
//      (the renderer's own field copy lakeR and its quad rules, LIFTED from render_world.js; the quad's level lakeY as
//      the renderer takes it, the median of the physics' waterH): every field texel more than a metre inside the line
//      has its ground UNDER the drawn water - the old cut's census (the raw ground over the drawn water there, i.e. the
//      height of the gap the cut showed) is printed beside it; a lake the premises filled keeps no texel (G753).
//   3. THE EDGE WALK. Along every drawn lake's line (each field texel on the line, the field's gradient for the normal):
//      the ground is continuous across it (no step a 0.1 m walk from 6 m out to 6 m in shows more than the raw DEM's own
//      plus 0.5 m: where two lakes' beds meet the step is their levels' difference, 0.43 m the worst on Jolene), it is
//      under the drawn water 2 m in, and the physics agrees (waterH over terrainH there: the floats
//      ride what is drawn).
//
//   node tools/_lakebed_check.js   -> "GATE LAKEBED: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
const lift = (src, a, b) => { const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i + a.length); return i < 0 || j < 0 ? null : src.slice(i, j); };
console.log('GATE LAKEBED');

// ---- 1. the cut is gone ----------------------------------------------------------------------------------------
{
  const hook = lift(RW, '      const islandGroundHookFor = (side, rock) => sh => {', '      islandGroundHook = islandGroundHookFor(-1, true);');
  ok(!!hook, '1 the island ground hook found (islandGroundHookFor(side, rock): no `dry` twin)');
  if (hook) {
    const disc = (hook.match(/discard/g) || []).length;
    ok(!/lsd\s*>\s*[0-9.]+\)\s*discard/.test(hook) && !/gLake\([^)]*\)[^;]*discard/.test(hook), '1 no ground program discards for the lake field');
    ok(disc === 2 && hook.includes("if (uFine.z > 0.0 && distance(vWPi.xz, uFine.xy) < uFine.z) discard;") && hook.includes("if (distance(vWPi.xz, uFine.xy) > uFine.z) discard;"),
      '1 the hook\'s only discards are the fine disc\'s (the near ring inside it, a fine tile outside it)', disc + ' discard(s)');
  }
  ok(!/OuterDry|outer-dry|\|dry/.test(RW), '1 the far terrain is one material (the lake-free twin and its quadrant split are gone)');
  ok(RW.includes('const seaFloor = world.island.seaFloor, lakeBed = world.island.lakeBed,') && RW.includes('if (lakeBed) { const b = lakeBed(x, z); if (b < y) y = b; }'),
    '1 the far terrain\'s patches take the carved bed (the asset is the raw DEM)');
  // (train 28: METLA-LOAD's ring reads the build read gB = world.terrainHBuild || world.terrainH - accepted only while the
  // build read carves the bed too, 20_world.js lakeCarve on both paths)
  const W20 = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', '20_world.js'), 'utf8');
  const buildCarves = /function terrainHBuild\(x, z\) \{[\s\S]{0,400}lakeCarve\(/.test(W20) && /if \(LAKE_BED\) h = lakeCarve\(/.test(W20);
  ok((RW.includes('posA.setY(i, world.terrainH(posA.getX(i), posA.getZ(i)));') || (RW.includes('posA.setY(i, gB(posA.getX(i), posA.getZ(i)));') && RW.includes('const gB = world.terrainHBuild || world.terrainH;') && buildCarves)) && RW.includes('const H = (x, z) => world.terrainH(x, z) - groundSink(x, z);'),
    '1 the near ring and the fine tiles sample world.terrainH (the carved ground)');
  ok(!/sm\(-30, -6, lakeSD\(x, z\)\)/.test(RW) && RW.includes('pos[k * 3] = x; pos[k * 3 + 1] = H(x, z); pos[k * 3 + 2] = z;'),
    '1 the fine tiles are the carved surface at a shore too (no blend back to the ring\'s 17.6 m chords within 30 m of a lake)');
}

// ---- 2. the bed ------------------------------------------------------------------------------------------------
require(path.join(ROOT, 'tools', 'flight_core.js'));
let IN = null; try { IN = require(path.join(ROOT, 'tools', 'island_node.js')); } catch (e) {}
const fx = fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8');
let W = null; try { W = IN && IN.islandWorld('jolene', { premises: fx }); } catch (e) { console.log('  (island: ' + e.message + ')'); }
ok(!!W, '2 Jolene composed with its premises (island_node)');
const blkR = lift(RW, '    const lakeR = (() => {', '    let islandTex = null');
const blkS = lift(RW, '        const lakeTexels = L => {', '        let filled = 0;');
const blkY = lift(RW, '          const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, qx = (L.x1 - L.x0) / 4, qz = (L.z1 - L.z0) / 4;', '          g.translate(cx, lakeY, cz);');
ok(!!blkR && !!blkS && !!blkY, '2 the renderer\'s lake field, quad rules and quad level found in render_world.js (lakeR, lakeTexels .. isSea, lakeY)');
if (W && blkR && blkS && blkY) {
  const I = W.island, G = I.grid, LB = I.LAKE_BED;
  const haveBed = typeof I.lakeBed === 'function' && typeof I.lakeBed.levelAt === 'function';
  ok(haveBed && LB && LB.edge > 0 && LB.depth > LB.edge && LB.shoreW > 0, '2 the island carries the bed and its law',
    LB && ('edge ' + LB.edge + ' m at the line, ' + LB.depth + ' m by ' + LB.shoreW + ' m in, the bank to ' + LB.bank + ' m out'));
  if (haveBed) {
  const env = new Function('ISLA', 'world', 'console', blkR + '\n' + blkS + '\nreturn { lakeR, lakeRsd, lakeTexels, isSea };')(I, W, { log: () => {} });
  const lakeYOf = new Function('world', 'L', blkY + '\nreturn lakeY;').bind(null, W);
  // the island's raw ground (no bed): the base world's, under the same premises - the old cut's census
  const B = W.premises.base, O = W.premises.overlay;
  const rawH = (x, z) => { const b = B.terrainH(x, z); return O && O.terrainH ? O.terrainH(x, z, b) : b; };
  let drawn = 0, filled = 0, sea = 0, tex = 0, over = 0, prem = 0, worstOver = -Infinity, oldGap = 0, oldWorst = 0, oldLakes = 0;
  const drawnL = [];
  for (const L of I.lakes) {
    if (L.level <= 0.2 || L.cells < 3) continue;
    if (env.isSea(L)) { sea++; continue; }
    if (!env.lakeTexels(L).inside) { filled++; continue; }
    const y = lakeYOf(L); drawn++; drawnL.push([L, y]);
    const i0 = Math.max(0, Math.floor((L.x0 - G.x0) / G.cell)), i1 = Math.min(G.w - 1, Math.ceil((L.x1 - G.x0) / G.cell));
    const j0 = Math.max(0, Math.floor((L.z0 - G.z0) / G.cell)), j1 = Math.min(G.h - 1, Math.ceil((L.z1 - G.z0) / G.cell));
    let hadGap = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell;
      if (env.lakeRsd(x, z) < 1) continue;
      // (the texel's own lake: the one that owns its bed - 28_island lakeBed, one lake a texel; a pond's box inside a big
      // lake's is the pond's water, not the big lake's)
      if (I.lakeBed.levelAt(x, z) !== y) continue;
      tex++;
      const h = W.terrainH(x, z), d = h - y;
      // (a texel a premises modifier holds - a runway's shoulder over a bank - is the premises' ground, not the bed's)
      if (d > -0.05) { const b0 = B.terrainH(x, z); if (Math.abs(rawH(x, z) - b0) > 1e-9) { prem++; continue; } over++; if (d > worstOver) worstOver = d; }
      const g0 = rawH(x, z) - y; if (g0 > 0.1) { oldGap++; hadGap = true; if (g0 > oldWorst) oldWorst = g0; }
    }
    if (hadGap) oldLakes++;
  }
  console.log('  (drawn lakes ' + drawn + ', filled by the premises ' + filled + ', left to the sea ' + sea + '; ' + tex + ' field texels a metre or more inside a drawn line)');
  console.log('  (THE OLD CUT: the raw ground stood over the drawn water at ' + oldGap + ' of them, in ' + oldLakes + ' lakes, up to ' + oldWorst.toFixed(2) + ' m - the gap the cut showed)');
  ok(over === 0, '2 every texel a metre inside a drawn lake has its ground under the drawn water', over + ' over' + (over ? ', worst ' + worstOver.toFixed(2) + ' m' : '') + '; ' + prem + ' a premises modifier holds over it');
  const pond = I.lakes.find(L => Math.hypot((L.x0 + L.x1) / 2 - 241, (L.z0 + L.z1) / 2 - 599) < 15);
  ok(!!pond && env.lakeTexels(pond).inside === 0, '2 02/20\'s pond stays the runway\'s fill (G753: no texel, no quad)', pond && ('texels ' + env.lakeTexels(pond).inside));
  // the law itself, at a point: the bed only ever lowers, and it is continuous at the line
  let lower = true; for (let k = 0; k < 4000; k++) { const x = -13000 + ((k * 7919) % 38000), z = -29000 + ((k * 104729) % 38000); if (W.terrainH(x, z) > rawH(x, z) + 1e-9) { lower = false; break; } }
  ok(lower, '2 the bed only ever lowers the ground (every ceiling the codec gives still holds)');

  // ---- 3. the edge walk ----------------------------------------------------------------------------------------
  let pts = 0, steps = 0, worstStep = 0, wetFail = 0, physFail = 0, worstAt = '';
  for (const [L, y] of drawnL) {
    const i0 = Math.max(1, Math.floor((L.x0 - G.x0) / G.cell) - 1), i1 = Math.min(G.w - 2, Math.ceil((L.x1 - G.x0) / G.cell) + 1);
    const j0 = Math.max(1, Math.floor((L.z0 - G.z0) / G.cell) - 1), j1 = Math.min(G.h - 2, Math.ceil((L.z1 - G.z0) / G.cell) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell, s = env.lakeRsd(x, z);
      if (Math.abs(s) > G.cell / 2) continue;   // a texel on the line
      const gx = env.lakeRsd(x + 2, z) - env.lakeRsd(x - 2, z), gz = env.lakeRsd(x, z + 2) - env.lakeRsd(x, z - 2), gl = Math.hypot(gx, gz);
      if (gl < 1e-6) continue;
      const nx = gx / gl, nz = gz / gl, px = x - nx * s, pz = z - nz * s;   // onto the line, the normal pointing in
      if (Math.abs(env.lakeRsd(px, pz)) > 1.5) continue;
      // only this lake's own line (the bed 2 m in is this lake's)
      if (px < L.x0 - 8 || px > L.x1 + 8 || pz < L.z0 - 8 || pz > L.z1 + 8 || I.lakeBed.levelAt(px + nx * 2, pz + nz * 2) !== y) continue;
      pts++;
      // a 0.1 m walk: a slope (the bank's, up to 1.75 at 6 m out) moves under 0.2 m a step; a STEP in the ground is a jump
      let prevC = null, prevR = null;
      for (let t = -6; t <= 6.0001; t += 0.1) {
        const qx = px + nx * t, qz = pz + nz * t, hc = W.terrainH(qx, qz), hr = rawH(qx, qz);
        if (prevC !== null) { const st = Math.abs(hc - prevC) - Math.abs(hr - prevR); if (st > worstStep) { worstStep = st; worstAt = qx.toFixed(0) + ', ' + qz.toFixed(0); } if (st > 0.5) steps++; }
        prevC = hc; prevR = hr;
      }
      const ix = px + nx * 2, iz = pz + nz * 2, hi = W.terrainH(ix, iz);
      if (env.lakeRsd(ix, iz) > 1.5 && hi > y - 0.05 && Math.abs(rawH(ix, iz) - B.terrainH(ix, iz)) < 1e-9) wetFail++;
      if (env.lakeRsd(ix, iz) > 1.5 && hi < y - 0.05 && !(W.waterH(ix, iz) > hi + 0.1)) physFail++;
    }
  }
  ok(pts > 5000, '3 the walk crosses every drawn lake\'s line', pts + ' line points');
  ok(steps === 0, '3 the ground is continuous across every line (no jump over the raw DEM\'s own + 0.5 m on a 0.1 m walk)', steps + ' steps; worst +' + worstStep.toFixed(2) + ' m' + (worstAt ? ' at ' + worstAt : ''));
  ok(wetFail === 0, '3 two metres in, the ground is under the drawn water', wetFail + ' dry');
  ok(physFail === 0, '3 ...and the physics has water there (the floats ride what is drawn)', physFail + ' without');
  }
}
console.log('GATE LAKEBED: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
