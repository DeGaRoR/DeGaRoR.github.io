#!/usr/bin/env node
// PAVEMENT WIDTHS (G1393, RUNWAY-LOOK): the census of DRAWN widths against DECLARED widths, for every strip kind and
// road class - the user, 3 Oct: "the grass runway for example is very thin at the same dimensions as the dirt runway /
// path, which is very large". Headless: the shader's alpha law through its CPU twin (PAVEMENT.alphaTwin), across the
// middle of a strip / a road, over 2 km of u. BEFORE is the law as it shipped until G1391, ported here (the soft edge
// centred 0.3 x edgeSoft outside with +-2 x edgeSoft of noise; a grass strip at 45 % + its worn band; no side on the
// soft classes) - only so the census can show what moved.
//   drawn    mean width where alpha >= 0.5 (what reads as the pavement)
//   surface  mean width where the surface's own share (wPav) >= 0.5
//   opaque   the narrowest width, over every u, where alpha >= 0.99 all across (what is landable, and what the patch sinks under)
//   reach    the widest extent where alpha >= 0.05 (the side's last island)
// node tools/pavement_widths.js [--json]
'use strict';
const P = require('../src/viewer/pavement.js');
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const N = P.twinNoise;

// the law until G1391 (pavement.js before RUNWAY-LOOK), at a point of a strip (side) or a road (band + fade)
function legacy(o) {
  const r = o.recipe || P.recipe, cls = o.cls, paved = cls === 'concrete' || cls === 'asphalt', u = o.u, v = o.v, halfW = o.halfW;
  const seed = Math.round((o.seed || 0) * 37) / 37, us = u + seed * 37, vs = v + seed * 91, dE = halfW - Math.abs(v);
  const eEdge = dE + r.edgeChip * (N.noise(u / 1.5, seed + 9) - 0.5) * 2;
  let wPav;
  if (paved) wPav = ss(-0.05, 0.05, eEdge);
  else {
    const soft = Math.max(0.3, Math.min(6, Math.min(r.edgeSoft, halfW * 0.6)));
    const e2 = dE + soft * (0.9 * (N.noise(u / 15, seed + 19) - 0.5) * 2 + 0.7 * (N.fbm(us / 4 + 23, vs / 4 + 23) - 0.5) * 2 + 0.35 * (N.noise(us, vs) - 0.5) * 2);
    wPav = ss(-soft * 1.1, soft * 0.5, e2);
  }
  let a;
  if (o.side) a = Math.max(wPav, paved ? (r.sideA === undefined ? 0.35 : r.sideA) * (1 - ss(0, r.sideW || 1.2, -eEdge)) : 0);
  else {
    const shW = P.shoulderFor(o.band, r), f0 = Math.max(0, Math.min(Math.min(o.band + 0.3, shW - Math.max(r.fadeW, 0.6)), shW - 0.3));
    a = 1 - ss(f0, shW, -dE);
  }
  if (cls === 'grass' && !o.road) {
    // the worn band a third of the width (the strip's wheel band; the two wandering pairs of ruts left out)
    const aE = Math.abs(v) / Math.max(halfW, 0.5);
    const wb = 1 - ss(0.12, 0.52, aE + (N.noise(u / 9, seed + 4) - 0.5) * 0.2 + (N.noise(us / 1.7, vs / 1.7) - 0.5) * 0.1);
    const worn = Math.min(1, wb * r.wheelBand * P.CLASS_DEF.grass.soft[2] * (0.75 + 0.25 * N.noise(us / 3, vs / 3)));
    a *= Math.min(1, 0.45 + worn);
  }
  return { a, surf: wPav, worn: cls === 'grass' && !!o.road };
}

// the census of one kind: declared width `wid`, strip (side) or road (band)
function census(fn, o, du) {
  const halfW = o.wid / 2, r = o.recipe || P.recipe, band = o.band, ext = halfW + (o.side ? 12 : P.shoulderFor(band, r) + 1), dv = 0.05;
  let sumD = 0, sumS = 0, nU = 0, opq = Infinity, reach = 0, worn = false;
  for (let u = 37.3; u < 2037; u += du || 2.31) {
    let wd = 0, ws = 0, lo = 0, hi = 0;
    for (let v = -ext; v <= ext + 1e-9; v += dv) {
      const q = fn({ cls: o.cls, road: o.road, side: o.side, band, u, v, halfW, seed: 0.27, recipe: r });
      if (q.worn) worn = true;
      if (q.a >= 0.5) wd += dv;
      if (q.surf >= 0.5) ws += dv;
      if (q.a >= 0.05) reach = Math.max(reach, 2 * Math.abs(v));
    }
    // the opaque core: out from the centreline each way until alpha < 0.99
    for (lo = 0; lo < ext && fn({ cls: o.cls, road: o.road, side: o.side, band, u, v: -lo, halfW, seed: 0.27, recipe: r }).a >= 0.99; lo += dv);
    for (hi = 0; hi < ext && fn({ cls: o.cls, road: o.road, side: o.side, band, u, v: hi, halfW, seed: 0.27, recipe: r }).a >= 0.99; hi += dv);
    opq = Math.min(opq, lo + hi); sumD += wd; sumS += ws; nU++;
  }
  return { drawn: sumD / nU, surface: sumS / nU, opaque: opq, reach, worn };
}

const KINDS = [];
for (const cls of P.CLASSES) KINDS.push({ name: cls + ' strip', cls, wid: 18, side: true, road: false, band: P.CLASS_DEF[cls].band });
// a road: BEFORE drew its band and the fade past it; NOW it is sided (G1391, roadSide 1) unless its entry declares a band
for (const cls of P.CLASSES) KINDS.push({ name: cls + ' road', cls, wid: 6, side: P.RECIPE.roadSide > 0.5, sideBefore: false, road: true, band: Math.min(P.CLASS_DEF[cls].band, 1.2) });

function run(o) {
  const rows = [], du = o && o.du, nowOnly = o && o.nowOnly;
  for (const k of KINDS) rows.push({ kind: k.name, cls: k.cls, road: k.road, declared: k.wid,
    before: nowOnly ? null : census(legacy, Object.assign({}, k, { side: k.sideBefore !== undefined ? k.sideBefore : k.side }), du), now: census(P.alphaTwin, k, du) });
  return rows;
}
if (require.main === module) {
  const rows = run();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }
  const f = x => x.toFixed(2).padStart(6);
  console.log('PAVEMENT WIDTHS - drawn (alpha >= .5) / surface (wPav >= .5) / opaque core (min) / reach (alpha >= .05), metres');
  console.log('kind             decl |  BEFORE drawn  surf opaque  reach |     NOW drawn  surf opaque  reach');
  for (const r of rows) {
    const b = r.before, n = r.now;
    console.log(r.kind.padEnd(15) + String(r.declared).padStart(5) + ' | ' + ' '.repeat(6) + f(b.drawn) + f(b.surface) + f(b.opaque) + f(b.reach) + ' | ' + ' '.repeat(6) + f(n.drawn) + f(n.surface) + f(n.opaque) + f(n.reach) + (n.worn ? '  (grass road: its tracks, by design)' : ''));
  }
}
module.exports = { run, census, legacy, KINDS };
