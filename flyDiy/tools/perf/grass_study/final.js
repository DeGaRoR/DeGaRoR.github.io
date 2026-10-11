const { avg } = require('./cost_model.js');
const LAND = 0.44, BL = 0.55;
const V = { stand: { h: 1.7, pitch: -4 }, taxi: { h: 1.7, pitch: -2 }, '10 m': { h: 10, pitch: -6 }, '30 m': { h: 30, pitch: -8 }, '60 m': { h: 60, pitch: -8 }, '150 m': { h: 150, pitch: -8 } };
const today = (density, reach, scale) => ({ kind: 'patch', rho: 0.48 * density * BL * LAND, s: 0.009, near: 50, reach, taper: 0.5, aglFull: 60, aglOff: 150, cell: 32, B: 4, trunc: false, band: 0.25, draws: 3, scale });
const prop = (eff, near, reach, scale, aglFull) => ({ kind: 'tuft', rho: eff * LAND, s: 0.30 / 103.8, near, reach, taper: 1, aglFull, aglOff: reach, cell: 16, B: 2, trunc: true, band: 0.25, draws: 3, scale });
const P = [
  ['ultra', today(2, 220, 1), prop(78, 25, 120, 1, 35)],
  ['gamer (default)', today(2, 220, 1), prop(78, 15, 90, 1, 27)],
  ['current', today(2, 220, 1), prop(78, 10, 70, 1, 20)],
  ['retro (laptop target)', today(1, 120, 0.85), prop(47, 8, 50, 0.85, 15)],
];
let md = '| preset | view | today: tris M / card Mpx (overdraw) / draws | proposed: tris M / card Mpx (overdraw) / draws | tris | card px |\n|---|---|---|---|---|---|\n';
for (const [pn, a, b] of P) for (const [vn, v] of Object.entries(V)) {
  const A = avg(a, Object.assign({ scale: a.scale }, v)), Bq = avg(b, Object.assign({ scale: b.scale }, v));
  const pc = (x, y) => y > 0.005e6 ? ((x / y - 1) * 100).toFixed(0) + ' %' : (x > 0 ? 'new' : '-');
  md += `| ${pn} | ${vn} | ${(A.tris / 1e6).toFixed(2)} / ${(A.px / 1e6).toFixed(2)} (${A.over.toFixed(2)}) / ${A.draws.toFixed(0)} | ${(Bq.tris / 1e6).toFixed(2)} / ${(Bq.px / 1e6).toFixed(2)} (${Bq.over.toFixed(2)}) / ${Bq.draws.toFixed(0)} | ${pc(Bq.tris, A.tris)} | ${pc(Bq.px, A.px)} |\n`;
}
console.log(md);
