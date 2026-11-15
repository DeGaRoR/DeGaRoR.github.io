#!/usr/bin/env node
// GATE MUDDEPOSIT (GROUND-FX, 2026-11-15) — THE MUD ON THE AEROPLANE LANDS WHERE THE THROWN MUD HITS ITS ACTUAL GEOMETRY.
//
// The user (15 Nov): "I also suspect the plane's projections to be a little slapped. I'd really want that we do some
// calculations for projecting on the right places, as a function of the actual plane geometry". ground_deposit.js: the drawn
// aeroplane voxelised in craft space, dust.js's own clods and drops marched against it, a four-way deposit; tools/mud_roll.js
// rolls a build on soft mud in node (a 6 s taxi, a take-off run to 22 m/s, the tail coming up on a tail-dragger).
//
//   node tools/_muddeposit_check.js            -> "GATE MUDDEPOSIT: PASS|FAIL"
//   node tools/_muddeposit_check.js --show     -> the numbers by part
//   node tools/_muddeposit_check.js --selftest -> negative verification (a grid with no airframe, a wrong facing)
//
// A. THE GRID AND THE MARCH (unit): a box voxelises with no hole; a segment through it hits its near face's cell, one beside
//    it misses, one starting past it misses; a tyre's cells are not targets; the deposit's four channels follow the arrival
//    (up -> what faces down, aft -> what faces forward, sideways -> the flank facing it) and nothing reaches what faces away.
// B. THE STOCK CUB (builds/cub_2026-09-20_corrected.json) after 20 s on soft mud: the gear legs and the belly aft of the mains
//    hold mud; the wing tops, the windscreen and the cowl's top hold none; a leg's lee (aft-facing) side under a third of its
//    front; the tail wheel's fork caked.
// C. THE CANON C172 (builds/cessna172r_2026-11-08.json, list:50) after 20 s: its gear (legs and fairings) caked; the wing
//    tops, the windscreen and the cowl's top clean; a leg's lee under a third of its front.
// D. WASH: ten minutes of steady rain takes more than half off what faces sideways, less off the undersides; a water line
//    clears what is under it; the coat's one number falls with both.
// F. THE EDGE: the texture's cover blurred a cell (no square per hit); the spatter's streaks run aft; its erosion keeps
//    the amount (a thin coat flecks, it does not vanish).
// E. DETERMINISM AND COST: the same seed, the same deposit; the grid built under 600 ms and a 20 s run (1200 frames) under
//    2 s in node, i.e. the collide well under the 64-march budget a frame.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const GD = require(path.join(ROOT, 'src', 'viewer', 'ground_deposit.js'));
const MR = require(path.join(ROOT, 'tools', 'mud_roll.js'));
const SHOW = process.argv.includes('--show'), SELF = process.argv.includes('--selftest');
const fails = [], say = s => console.log(s), fail = s => { fails.push(s); say('  FAIL ' + s); }, ok = (c, s) => { if (!c) fail(s); else if (SHOW) say('  ok ' + s); };

// ---- A. unit -----------------------------------------------------------------------------------------------------------
function box(x0, y0, z0, x1, y1, z1) {   // 12 triangles
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const F = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
  const t = []; for (const f of F) for (const i of f) t.push(...P[i]); return t;
}
{
  const t = box(-0.5, -0.5, 0, 0.5, 0.5, 0.2).concat(box(2, 0, 0, 2.3, 0.3, 0.3));
  const part = new Uint8Array(24); for (let i = 12; i < 24; i++) part[i] = 2;   // the second box: a tyre
  const G = GD.make(t, part, { h: 0.05, reach: 1 });
  // the slab's whole surface marked (a 1 m x 1 m top: 20 x 20 cells at least)
  let top = 0; const kTop = Math.floor((0.2 - G.o[2]) / G.h);
  for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) if (G.occ[(kTop * G.ny + j) * G.nx + i] === 1) top++;
  ok(top >= 400, 'A1 a 1 m square voxelises whole at 5 cm (' + top + ' cells >= 400)');
  const c = GD.march(G, 0, 0, -0.5, 0, 0, 0.1);
  ok(c >= 0 && Math.abs((Math.floor(c / (G.nx * G.ny)) + 0.5) * G.h + G.o[2] - 0) < G.h, 'A2 an upward segment hits the slab\'s bottom face cell');
  ok(GD.march(G, 0.8, 0, -0.5, 0.8, 0, 0.6) < 0, 'A3 a segment beside the slab misses');
  ok(GD.march(G, 0, 0, 0.5, 0, 0, 0.9) < 0, 'A4 a segment above it, going up, misses');
  ok(GD.march(G, 2.15, 0.15, -0.3, 2.15, 0.15, 0.6) < 0, 'A5 a tyre\'s cells are not a target');
  GD.deposit(G, c, 0, 0, 1, 2);   // arriving moving up
  const under = GD.sample(G, 0, 0, 0, 0, 0, -1), topS = GD.sample(G, 0, 0, 0.0, 0, 0, 1), side = GD.sample(G, 0, 0, 0, 1, 0, 0);
  ok(under > 0.5 && topS === 0 && side === 0, 'A6 an upward arrival covers what faces down (' + under.toFixed(2) + '), not what faces up or sideways');
  GD.clear(G); GD.deposit(G, c, 0, 1, 0, 2);   // arriving moving aft
  ok(GD.sample(G, 0, 0, 0, 0, -1, 0) > 0.5 && GD.sample(G, 0, 0, 0, 0, 1, 0) === 0, 'A7 an aft arrival covers what faces forward, not its lee');
  GD.clear(G); GD.deposit(G, c, 1, 0, 0, 2);   // arriving moving to starboard
  ok(GD.sample(G, 0, 0, 0, -1, 0, 0) > 0.5 && GD.sample(G, 0, 0, 0, 1, 0, 0) === 0, 'A8 a sideways arrival covers the flank facing it');
  if (SELF) {
    const E = GD.make(box(5, 5, 5, 5.1, 5.1, 5.1), new Uint8Array([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]), { h: 0.05 });
    say('  selftest: an all-tyre grid has ' + E.occupied + ' airframe cells (must be 0) and the march ' + GD.march(E, 5.05, 5.05, 4, 5.05, 5.05, 6));
    if (E.occupied !== 0) fail('selftest: tyre cells counted as airframe');
  }
}

// ---- B, C. the builds --------------------------------------------------------------------------------------------------
const grp = (lab, nx, ny, nz) => {
  const f = nz > 0.5 ? 'top' : nz < -0.5 ? 'under' : ny < -0.5 ? 'front' : ny > 0.5 ? 'back' : 'side';
  if (/^gear:edLeg/.test(lab)) return 'leg ' + f;
  if (/^gear:/.test(lab) && !/edWheel/.test(lab)) return 'gear ' + f;
  if (/^wing:/.test(lab) && !/strut/i.test(lab)) return 'wing ' + f;
  if (/^sheet:windshield/.test(lab)) return 'windshield';
  if (/^cowl:/.test(lab)) return 'cowl ' + f;
  if (/^sheet:(body|aluminium|taper|floorLoop)/.test(lab)) return 'body ' + f;
  return null;
};
function plane(name, file, want) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')), spec = raw.spec || raw;
  const R = MR.run(spec, { seed: 7 });
  const st = R.stats, C = MR.coverBy(R, grp), m = k => (C[k] ? C[k].mean : 0);
  say(name + ': grid ' + st.dims.join('x') + ' (' + st.occupied + ' airframe cells) ' + st.msGrid + ' ms, 20 s run ' + st.msAll + ' ms; thrown ' + st.emitted + ', hits ' + st.hits + ', coat ' + st.coat.toFixed(3));
  if (SHOW) Object.keys(C).sort().forEach(k => say('    ' + k.padEnd(16) + ' mean ' + C[k].mean.toFixed(3) + '  max ' + C[k].max.toFixed(2) + '  area ' + C[k].area.toFixed(2)));
  want(m, C, R);
  ok(st.msGrid < 600, name + ' grid under 600 ms (' + st.msGrid + ')');
  ok(st.msAll < 2000, name + ' grid + 20 s run under 2 s (' + st.msAll + ')');
  return R;
}
const clean = (m, C, name) => {
  ok(m('wing top') < 0.01, name + ' wing tops clean (' + m('wing top').toFixed(3) + ')');
  ok(m('windshield') < 0.01, name + ' windscreen clean (' + m('windshield').toFixed(3) + ')');
  ok(m('cowl top') < 0.01, name + ' cowl top clean (' + m('cowl top').toFixed(3) + ')');
  ok(m('body top') < 0.01, name + ' fuselage top clean (' + m('body top').toFixed(3) + ')');
};
const cub = plane('CUB', 'builds/cub_2026-09-20_corrected.json', (m, C) => {
  ok(m('leg front') > 0.1 && m('leg side') > 0.15, 'CUB gear legs hold mud (front ' + m('leg front').toFixed(3) + ', side ' + m('leg side').toFixed(3) + ')');
  ok(m('leg back') < m('leg front') / 3, 'CUB a leg\'s lee under a third of its front (' + m('leg back').toFixed(3) + ' vs ' + m('leg front').toFixed(3) + ')');
  ok(m('body under') > 0.02 && (C['body under'] || { max: 0 }).max > 0.6, 'CUB the belly holds mud (mean ' + m('body under').toFixed(3) + ', max ' + (C['body under'] || { max: 0 }).max.toFixed(2) + ')');
  ok(m('gear front') > 0.5, 'CUB the tail wheel\'s fork caked (' + m('gear front').toFixed(3) + ')');
  clean(m, C, 'CUB');
});
const c172 = plane('C172', 'builds/cessna172r_2026-11-08.json', (m, C) => {
  ok(m('leg side') > 0.3 && m('gear side') > 0.5, 'C172 legs and fairings caked (leg ' + m('leg side').toFixed(3) + ', fairing ' + m('gear side').toFixed(3) + ')');
  ok(m('leg back') < m('leg front') / 3, 'C172 a leg\'s lee under a third of its front (' + m('leg back').toFixed(3) + ' vs ' + m('leg front').toFixed(3) + ')');
  clean(m, C, 'C172');
});

// ---- D. wash -------------------------------------------------------------------------------------------------------------
{
  const G = cub.G, dep0 = Float32Array.from(G.dep), c0 = GD.total(G);
  for (let i = 0; i < 600; i++) GD.wash(G, 1, 1, null);
  let u0 = 0, u1 = 0, s0 = 0, s1 = 0;
  for (let q = 0; q < G.N * 4; q += 4) { u0 += dep0[q]; u1 += G.dep[q]; s0 += dep0[q + 2] + dep0[q + 3]; s1 += G.dep[q + 2] + G.dep[q + 3]; }
  ok(s1 < 0.5 * s0 && u1 > s1 / s0 * u0, 'D1 ten minutes of rain: the flanks lose more than half (' + (1 - s1 / s0).toFixed(2) + '), the undersides less (' + (1 - u1 / u0).toFixed(2) + ')');
  const c1 = GD.total(G);
  G.dep.set(dep0);
  const zw = G.o[2] + 0.5;
  for (let i = 0; i < 30; i++) GD.wash(G, 1, 0, zw);
  let under = 0; for (let k = 0; k < G.nz; k++) if (G.o[2] + (k + 0.5) * G.h < zw) for (let c = k * G.nx * G.ny; c < (k + 1) * G.nx * G.ny; c++) under += G.dep[c * 4] + G.dep[c * 4 + 1] + G.dep[c * 4 + 2] + G.dep[c * 4 + 3];
  ok(under < 0.01 * Math.max(1e-6, dep0.reduce((a, b) => a + b, 0)), 'D2 30 s in water clears what is under the line');
  ok(c1 < c0 && GD.total(G) < c0, 'D3 the coat\'s number falls with rain (' + c0.toFixed(3) + ' -> ' + c1.toFixed(3) + ') and with water');
  G.dep.set(dep0);
}
// ---- E. determinism ------------------------------------------------------------------------------------------------------
{
  // (the headless scene is one: the C172's, built last, is the one still standing)
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/cessna172r_2026-11-08.json'), 'utf8'));
  const R2 = MR.run(raw.spec || raw, { seed: 7, S: c172.S });
  ok(Math.abs(R2.G.mass - c172.G.mass) < 1e-6 && R2.stats.hits === c172.stats.hits, 'E1 the same seed, the same deposit (' + R2.stats.hits + ' hits, mass ' + R2.G.mass.toFixed(2) + ')');
  if (SELF) { const R3 = MR.run(raw.spec || raw, { seed: 8, S: c172.S }); say('  selftest: another seed gives ' + R3.stats.hits + ' hits (must differ from ' + c172.stats.hits + ')'); if (R3.stats.hits === c172.stats.hits && Math.abs(R3.G.mass - c172.G.mass) < 1e-6) fail('selftest: the seed does not reach the throw'); }
}
// ---- F. THE EDGE (A0, 15 Nov: the first pictures' belly "hard voxel squares", "the user will call that slapped too") ----
{
  const G = cub.G;
  // F1 the texture's cover is smooth: neighbouring cells (along any axis) differ by little where there is mud - no cell
  // draws as a square; measured against the raw deposit's own steps
  // (between neighbouring AIRFRAME cells only: those are what a fragment on the skin reads; the air round it is never drawn)
  const steps = (get) => { const d = [], nx = G.nx, ny = G.ny, nz = G.nz;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = (k * ny + j) * nx + i; if (G.occ[c] !== 1) continue;
      for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        if (i + di >= nx || j + dj >= ny || k + dk >= nz) continue;
        const c2 = c + di + dj * nx + dk * nx * ny; if (G.occ[c2] !== 1) continue;
        for (let b = 0; b < 4; b++) { const a = get(c * 4 + b), e = get(c2 * 4 + b); if (a > 0.02 || e > 0.02) d.push(Math.abs(a - e)); }
      } }
    d.sort((x, y) => x - y); return { p99: d[Math.floor(0.99 * d.length)] || 0, max: d[d.length - 1] || 0, n: d.length }; };
  GD.smooth(G);
  const raw = steps(q => 1 - Math.exp(-G.dep[q] / GD.K.D0)), sm = steps(q => G.cov[q]);
  ok(sm.p99 < 0.4 && sm.p99 < 0.5 * raw.p99, 'F1 the cover, cell to cell: step: p99 ' + sm.p99.toFixed(2) + ' (raw ' + raw.p99.toFixed(2) + '), max ' + sm.max.toFixed(2) + ' (raw ' + raw.max.toFixed(2) + ') over ' + sm.n + ' channel-cells');
  // F2 the spatter runs along the airflow: its correlation falls to a half 2.5x further along y (aft) than across
  let s0 = 0; const P = []; let x = 0.123;
  const rr = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  for (let i = 0; i < 6000; i++) { const p = [rr() * 4 - 2, rr() * 6 - 3, rr() * 2 - 1]; P.push(p); const n = GD.spatter(p[0], p[1], p[2]) - 0.5; s0 += n * n; }
  s0 /= P.length;
  const corr = (dx, dy, dz) => { let s = 0; for (const p of P) s += (GD.spatter(p[0], p[1], p[2]) - 0.5) * (GD.spatter(p[0] + dx, p[1] + dy, p[2] + dz) - 0.5); return s / P.length / s0; };
  const half = (u) => { for (let d = 0.002; d < 0.5; d *= 1.15) if (corr(u[0] * d, u[1] * d, u[2] * d) < 0.5) return d; return 0.5; };
  const Lx = half([1, 0, 0]), Ly = half([0, 1, 0]), Lz = half([0, 0, 1]);
  ok(Ly > 2.5 * Lx && Ly > 2.5 * Lz, 'F2 the spatter streaks run aft: half-correlation ' + (Ly * 100).toFixed(1) + ' cm along vs ' + (Lx * 100).toFixed(1) + ' / ' + (Lz * 100).toFixed(1) + ' cm across');
  // F3 the erosion keeps the mud's amount: the eroded cover's mean within 0.08 of the cover, from a trace to caked
  let worst = 0;
  for (const c of [0.05, 0.15, 0.3, 0.5, 0.7, 0.9]) { let m = 0; for (const p of P) m += GD.erode(c, GD.spatter(p[0], p[1], p[2])); m /= P.length; worst = Math.max(worst, Math.abs(m - c)); }
  ok(worst < 0.08, 'F3 the spatter keeps the amount: eroded mean within ' + worst.toFixed(3) + ' of the cover (< 0.08)');
  if (SELF) { const sv = GD.SP.spread; GD.SP.spread = 1; let m = 0; for (const p of P) m += GD.erode(0.15, GD.spatter(p[0], p[1], p[2])); GD.SP.spread = sv; m /= P.length;
    say('  selftest: without the spread, a 0.15 cover erodes to ' + m.toFixed(3) + ' (F3 must catch it)'); if (Math.abs(m - 0.15) < 0.08) fail('selftest: F3 blind to the unspread noise'); }
}
say('GATE MUDDEPOSIT: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
process.exit(fails.length ? 1 : 0);
