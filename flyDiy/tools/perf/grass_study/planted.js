// instances HELD by the ring (memory, planting CPU): today = full density in every cell within reach + cell;
// proposed = tiered planting (a cell keeps the candidates whose rand < its tier's keep x (1 + band), nested)
const keepF = (d, near, reach, taper) => Math.pow(1 - Math.max(0, Math.min(1, (d - near) / Math.max(1, reach - near))), 1 + 2 * taper);
function held(rho, near, reach, taper, cell, tiered) {
  let n = 0; const Rpl = reach + cell;
  for (let r = 0.5; r < Rpl; r += 1) { const a = 2 * Math.PI * r; n += rho * a * (tiered ? Math.min(1, keepF(Math.max(0, r - cell * 0.7), near, reach, taper) * 1.25) : 1); }
  return n;
}
const LAND = 0.44;
const rows = [
  ['today gamer (patch 0.96 x .55 blotch, 220 m)', held(0.96 * 0.55 * LAND, 50, 220, 0.5, 32, false), 21],
  ['today retro (0.48 x .55, 120 m)', held(0.48 * 0.55 * LAND, 50, 120, 0.5, 32, false), 21],
  ['proposed gamer (78/m2 eff, near 15 reach 90 taper 1, tiered)', held(78 * LAND, 15, 90, 1, 16, true), 21],
  ['proposed current (78, 10/70)', held(78 * LAND, 10, 70, 1, 16, true), 21],
  ['proposed retro (47, 8/50)', held(47 * LAND, 8, 50, 1, 16, true), 21],
  ['proposed ultra (78, 25/120)', held(78 * LAND, 25, 120, 1, 16, true), 21],
  ['proposed gamer UNTIERED (for scale)', held(78 * LAND, 15, 90, 1, 16, false), 21],
];
for (const [k, n, f] of rows) console.log(k.padEnd(64), (n / 1e3).toFixed(0).padStart(6), 'k instances', (n * f * 4 / 1048576).toFixed(1).padStart(6), 'MB (matrix 16 + colour 3 + rand + born floats)');
