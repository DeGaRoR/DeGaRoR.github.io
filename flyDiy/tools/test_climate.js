// GATE CLIMATE — the one wind field and its keeper (K0, 2026-09-22).
// Pure model, no renderer, under a few seconds:
//   1. the zero path — no spec is the SHARED exact zero vector (every calm gate's fast path)
//   2. the legacy field is BIT-IDENTICAL to G72's — held against a verbatim copy of the old
//      20_world.js wind() embedded HERE, so it cannot drift with the source
//   3. the rich field is deterministic across two worlds
//   4. the relief raster: exact heights, bounded slopes, the coast's sign, the heat class, the build cost
//   7. the linearised sampler agrees with the full field and earns its keep
//  14. the sources: no Date / THREE / DOM in 09_climate.js; the manifests carry it; the world has no wind of its own
//   5-6. the ridge lifts and the lee sinks; the crest speeds the wind up and the valley shelters it
//  10. the column: the layered day (continuous, hydrostatic), and a condensation level DERIVED here
//      that reproduces the day's own 125 m rule; humidity never moves the density
//  11. the front on the clock: it rises, veers, drops the temperature and the pressure, closes the
//      sky, and leaves behind the day it found - smoothly
//  15. the two clocks: the sim's moves the gusts, the day's moves the front, and neither moves the other
//   8-9. the thermals (a core, a sink ring that balances it, a lid, a night that is an exact zero,
//        a lattice that walks downwind) and the sea breeze that reverses overnight
//  13. the thermals cluster under the cumulus, because the clouds and the columns are ONE field
//  12. the sea: the legacy draw golden, the felt band invariant, and a sea that BUILDS under a
//      changing wind instead of jumping (the phase anchored at the aeroplane)
//
//   src/core/09_climate.js, 20_world.js  ->  tools/flight_core.js  ->  here
// Run: node tools/test_climate.js   (contract: one final `GATE CLIMATE: ...`)

const fs = require('fs'), path = require('path');
const { CLIMATE, CLOUD_FIELD, makeWorld } = require('./flight_core.js');

let fails = 0;
const fail = (m) => { console.log('  FAIL ' + m); fails++; };
const ok = (m) => console.log('  ok   ' + m);
const yes = (c, m) => (c ? ok : fail)(m);
let seed = 0xC11A7E;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const fnvStr = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };

const W = makeWorld();

// ---- 1. the zero path ----------------------------------------------------------
console.log('1. the zero path');
{
  const a = W.wind(0, 0, 0, 0), b = W.wind(5, 5, 5, 1);
  yes(a === b && a[0] === 0 && a[1] === 0 && a[2] === 0, 'no spec: the two calls return the SAME array of exact zeros');
  yes(W.climate.mode === 'zero', 'mode is zero');
  const s = W.climate.sample(100, 50, 100, 3);
  yes(s[0] === 0 && s[1] === 0 && s[2] === 0 && s !== a, 'sample() is zero too, and its own array');
  W.setWind({ base: [1, 0, 2] }); W.setWind(null);
  yes(W.wind(1, 1, 1, 1) === a, 'clearing the spec restores the shared zero');
}

// ---- 2. the legacy field, bit for bit ---------------------------------------------
// A verbatim copy of 20_world.js's wind() as it stood at G486 (the G72 model), over THIS world's terrainH.
console.log('2. the legacy field against the G72 copy');
{
  const GC = [
    [0.63, 0.011, 0.005, 0.7, 1.0, 0.35, 0.55],
    [1.37, 0.004, 0.013, 2.9, 0.55, 0.6, 1.0],
    [2.71, 0.009, 0.008, 5.1, 0.7, 1.0, 0.6],
    [0.29, 0.002, 0.003, 1.9, 1.0, 0.25, 0.8],
  ];
  const WIND_TOP_H = 300, WIND_ALPHA = 0.14, WV = [0, 0, 0];
  let windSpec = null;
  const terrainH = W.terrainH;
  function shearK(x, y, z, refH, alpha) {
    const agl = y - terrainH(x, z);
    const h = Math.min(WIND_TOP_H, Math.max(0.2, agl));
    return Math.pow(h / refH, alpha);
  }
  function windRef(x, y, z, t) {
    const b = windSpec.base, g = windSpec.gust || 0;
    const k = windSpec.refH ? shearK(x, y, z, windSpec.refH, windSpec.alpha) : 1;
    WV[0] = b[0] * k; WV[1] = b[1] * k; WV[2] = b[2] * k;
    const gk = g * k;
    if (gk > 0) for (const [om, kx, kz, ph, ax, ay, az] of GC) {
      const s = Math.sin(om * t + kx * x + kz * z + ph);
      WV[0] += gk * 0.30 * ax * s; WV[1] += gk * 0.18 * ay * s; WV[2] += gk * 0.30 * az * s;
    }
    return WV;
  }
  const setRef = spec => { windSpec = { base: spec.base || [0, 0, 0], gust: spec.gust || 0, refH: spec.refH || 0, alpha: spec.alpha != null ? spec.alpha : WIND_ALPHA }; };
  const FORMS = [
    ['a uniform column', { base: [0, 0, 3], gust: 0 }],
    ['a gusty column', { base: [1, 0, 0], gust: 1.5 }],
    ['a sheared column', { base: [-2.6, 0, 3.0], gust: 0.5, refH: 10 }],
    ['a rough sheared column', { base: [-3.9, 0.2, 4.6], gust: 0.9, refH: 10, alpha: 0.2 }],
  ];
  const bounds = W.bounds;
  for (const [name, spec] of FORMS) {
    W.setWind(spec); setRef(spec);
    let bad = 0, n = 0;
    for (let i = 0; i < 2000; i++) {
      const x = bounds.x0 + rnd() * (bounds.x1 - bounds.x0), z = bounds.z0 + rnd() * (bounds.z1 - bounds.z0);
      const y = W.terrainH(x, z) + (rnd() < 0.3 ? rnd() * 3 : rnd() * 800), t = rnd() * 300;
      const a = W.wind(x, y, z, t), r = windRef(x, y, z, t);
      n++;
      if (!Object.is(a[0], r[0]) || !Object.is(a[1], r[1]) || !Object.is(a[2], r[2])) bad++;
    }
    yes(bad === 0 && W.climate.mode === 'legacy', `${name}: ${n} samples bit-identical to the G72 field (${bad} differ)`);
  }
  // the declared form resolves to the same column: 10 kt from the west is +x at 5.14 m/s
  W.setWind({ kts: 10, dirDeg: 270 });
  const w = W.wind(0, 100, 0, 0);
  yes(Math.abs(w[0] - 10 * 0.514444) < 1e-9 && Math.abs(w[2]) < 1e-9 && w[1] === 0, `10 kt from 270 blows +x at ${w[0].toFixed(3)} m/s (${w[2].toExponential(1)} across)`);
  W.setWind({ mps: 4, dirDeg: 0 });
  const wn = W.wind(0, 100, 0, 0);
  yes(Math.abs(wn[2] - 4) < 1e-9 && Object.is(wn[0], 0), 'from north (000) blows toward +z (south), the x component an exact 0');
  yes(W.day.spec().wind == null, 'setWind alone leaves the day untouched');
  W.setDay({ wind: { kts: 12, dirDeg: 240, gust: 0.3, refH: 10 } });
  const sp = W.day.spec().wind;
  yes(sp && sp.kts === 12 && sp.dirDeg === 240 && sp.gust === 0.3, 'setDay({ wind }) round-trips the declared form through day.spec()');
  yes(W.climate.spec.refH === 10 && Math.abs(Math.hypot(W.climate.spec.base[0], W.climate.spec.base[2]) - 12 * 0.514444) < 1e-9, 'and the climate resolved it');
  W.setDay({ wind: null });
  yes(W.wind(0, 0, 0, 0)[0] === 0 && W.day.spec().wind == null, 'setDay({ wind: null }) clears both');
  // the sea follows the legacy law exactly as before: 32 trains, A = 0.018 W, L = 3 + 1.4 W
  W.setWind({ base: [3, 0, 4] });
  const S = W.sea;
  yes(S.W.length === 32 && Math.abs(S.A - 0.09) < 1e-12 && Math.abs(S.L - 10) < 1e-12 && Math.abs(S.dir - Math.atan2(4, 3)) < 1e-12, `the sea follows the wind: ${S.W.length} trains, A ${S.A.toFixed(3)} L ${S.L.toFixed(1)}`);
  const seaHash = fnvStr(JSON.stringify(S.W));
  // pinned at K0 from the unchanged seaFrom (re-pin in the same commit as any intentional change to it)
  yes(seaHash === '63eccad3', `the trains' golden ${seaHash}`);
  W.setWind(null);
}

// ---- 3. the rich field is deterministic --------------------------------------------
console.log('3. determinism');
const RICH = { kts: 15, dirDeg: 250, gust: 0.4, refH: 10, aloftK: 1.3, veerDeg: 20, terrain: 1 };
{
  const W2 = makeWorld();
  W.setWind(RICH); W2.setWind(RICH);
  yes(W.climate.mode === 'rich' && W2.climate.mode === 'rich', 'a spec with aloftK/veerDeg/terrain is rich');
  const parts = [];
  let bad = 0;
  const out = [0, 0, 0], out2 = [0, 0, 0];
  for (let i = 0; i < 4096; i++) {
    const x = (rnd() - 0.5) * 20000, z = (rnd() - 0.5) * 20000, y = W.terrainH(x, z) + rnd() * 1500, t = rnd() * 100;
    W.climate.sample(x, y, z, t, out); W2.climate.sample(x, y, z, t, out2);
    if (!Object.is(out[0], out2[0]) || !Object.is(out[1], out2[1]) || !Object.is(out[2], out2[2])) bad++;
    parts.push(out[0].toFixed(6), out[1].toFixed(6), out[2].toFixed(6));
  }
  yes(bad === 0, `4096 rich samples identical across two worlds (hash ${fnvStr(parts.join(','))})`);
  yes(W.climate.relief && W2.climate.relief && W.climate.relief.hash === W2.climate.relief.hash, `the relief rasters agree (${W.climate.relief.hash})`);
}

// ---- 4. the relief raster ------------------------------------------------------------
console.log('4. the relief raster');
{
  const R = W.climate.relief, CH = CLIMATE.CH, N = R.nx * R.nz;
  yes(R.cell === 200 && R.nx >= 120 && R.nz >= 120, `${R.nx} x ${R.nz} cells of ${R.cell} m over the bounds, built in ${R.ms.toFixed(0)} ms`);
  // the runner keeps four gates going at once, so a wall bound here is a bound on the BOX, not on
  // the code: generous, and the number printed above is the one to read
  yes(R.ms < 6000, `the raster built in ${R.ms.toFixed(0)} ms (52 quiet; the bound is the pool's, not the code's)`);
  let exact = 0, slopeMax = 0, promBad = 0, heatBad = 0;
  for (let k = 0; k < N; k += 97) {
    const i = k % R.nx, j = Math.floor(k / R.nx), x = R.x0 + (i + 0.5) * R.cell, z = R.z0 + (j + 0.5) * R.cell;
    if (R.data[k * R.NCH + CH.h] === Math.fround(W.terrainH(x, z))) exact++;
  }
  for (let k = 0; k < N; k++) {
    const o = k * R.NCH;
    slopeMax = Math.max(slopeMax, Math.hypot(R.data[o + CH.gxc] + R.data[o + CH.gxf], R.data[o + CH.gzc] + R.data[o + CH.gzf]));
    const p = R.data[o + CH.prom]; if (!(p >= -1 && p <= 1)) promBad++;
    const h = R.data[o + CH.heat]; if (!(h >= 0 && h <= 1)) heatBad++;
  }
  yes(exact === Math.ceil(N / 97), `the height channel is terrainH at every sampled centre (${exact} of ${Math.ceil(N / 97)})`);
  yes(slopeMax > 0.05 && slopeMax < 2, `the smoothed slope peaks at ${slopeMax.toFixed(3)} (a real relief, no spike)`);
  yes(promBad === 0 && heatBad === 0, 'prominence in [-1, 1], heat in [0, 1] everywhere');
  // the coast: negative on the sea, positive inland, the gradient pointing inland
  let seaPt = null, landPt = null;
  for (let k = 0; k < N && !(seaPt && landPt); k += 13) {
    const i = k % R.nx, j = Math.floor(k / R.nx), x = R.x0 + (i + 0.5) * R.cell, z = R.z0 + (j + 0.5) * R.cell;
    const h = W.terrainH(x, z);
    if (!seaPt && h <= 0.05 && W.surface(x, z) === W.SURFACE.WATER) seaPt = [x, z];
    if (!landPt && h > 50) landPt = [x, z];
  }
  const ra = W.climate.reliefAt(seaPt[0], seaPt[1], new Float32Array(R.NCH)), rb = W.climate.reliefAt(landPt[0], landPt[1], new Float32Array(R.NCH));   // own arrays: reliefAt's default is a shared scratch
  yes(ra[CH.coast] < 0, `at sea (${seaPt.map(v => v.toFixed(0))}) the coast distance is ${ra[CH.coast].toFixed(0)} m`);
  yes(rb[CH.coast] > 0, `inland (${landPt.map(v => v.toFixed(0))}) it is +${rb[CH.coast].toFixed(0)} m`);
  yes(ra[CH.heat] === 0 && rb[CH.heat] > 0, 'water does not heat; land does');
  // the gradient of the coast distance points inland: stepping along it from the sea raises the distance
  const step = 600, x2 = seaPt[0] + ra[CH.cgx] * step, z2 = seaPt[1] + ra[CH.cgz] * step;
  yes(W.climate.reliefAt(x2, z2, new Float32Array(R.NCH))[CH.coast] > ra[CH.coast], 'the coast gradient points inland');
}

// ---- 5. the ridge: lift windward, sink in the lee ------------------------------------------
console.log('5. the ridge');
{
  W.setWind({ mps: 10, dirDeg: 270, refH: 10, terrain: 1 });                   // 10 m/s from the west, at 10 m
  const R = W.climate.relief, CH = CLIMATE.CH;
  let best = null, worst = null;
  for (let k = 0; k < R.nx * R.nz; k++) {
    const g = R.data[k * R.NCH + CH.gxc] + R.data[k * R.NCH + CH.gxf];          // the smoothed slope along the wind
    if (!best || g > best.g) best = { k, g }; if (!worst || g < worst.g) worst = { k, g };
  }
  const at = o => { const i = o.k % R.nx, j = Math.floor(o.k / R.nx); return [R.x0 + (i + 0.5) * R.cell, R.z0 + (j + 0.5) * R.cell]; };
  const s = [0, 0, 0];
  const wy = (p, h) => { const g = W.terrainH(p[0], p[1]); W.climate.sample(p[0], g + h, p[1], 0, s); return { wy: s[1], u: Math.hypot(s[0], s[2]) }; };
  const pw = at(best), pl = at(worst);
  const w50 = wy(pw, 50), w400 = wy(pw, 400), l50 = wy(pl, 50);
  yes(w50.wy > 1, `the steepest windward face (slope ${best.g.toFixed(3)}) lifts ${w50.wy.toFixed(2)} m/s at 50 m agl in a ${w50.u.toFixed(1)} m/s wind`);
  yes(l50.wy < -0.5, `the steepest lee face (slope ${worst.g.toFixed(3)}) sinks ${l50.wy.toFixed(2)} m/s`);
  yes(w400.wy > 0 && w400.wy < 0.5 * w50.wy, `the lift decays with height: ${w400.wy.toFixed(2)} at 400 m`);
  const rr = W.climate.reliefAt(pw[0], pw[1], new Float32Array(R.NCH));
  const gl = Math.hypot(W.terrainH(pw[0] + 60, pw[1]) - W.terrainH(pw[0] - 60, pw[1]), W.terrainH(pw[0], pw[1] + 60) - W.terrainH(pw[0], pw[1] - 60)) / 120;
  const bound = w50.u * (Math.hypot(rr[CH.gxc], rr[CH.gzc]) + Math.hypot(rr[CH.gxf], rr[CH.gzf]) + Math.min(0.7, gl));
  yes(w50.wy <= bound * 1.01, `and never more than the wind times the slope (${w50.wy.toFixed(2)} <= ${bound.toFixed(2)}; the true slope here ${gl.toFixed(2)})`);
  // the lee is rough on a calm declared day: the rotor gusts on its own
  let lo = 1e9, hi = -1e9;
  for (let t = 0; t < 30; t += 0.25) { W.climate.sample(pl[0], W.terrainH(pl[0], pl[1]) + 30, pl[1], t, s); const m = Math.hypot(s[0], s[1], s[2]); lo = Math.min(lo, m); hi = Math.max(hi, m); }
  let lo2 = 1e9, hi2 = -1e9;
  for (let t = 0; t < 30; t += 0.25) { W.climate.sample(pw[0], W.terrainH(pw[0], pw[1]) + 30, pw[1], t, s); const m = Math.hypot(s[0], s[1], s[2]); lo2 = Math.min(lo2, m); hi2 = Math.max(hi2, m); }
  yes(hi - lo > 0.5 && hi2 - lo2 < 1e-9, `gust 0: the lee spreads ${(hi - lo).toFixed(2)} m/s over 30 s (the rotor), the windward face ${(hi2 - lo2).toFixed(2)}`);
  // terrain 0 is the plain column again
  W.setWind({ mps: 10, dirDeg: 270, refH: 10, terrain: 0, aloftK: 1.3 });
  const w0 = wy(pw, 50);
  yes(Math.abs(w0.wy) < 1e-9, 'terrain 0: no vertical component');
}

// ---- 6. the crest and the valley ---------------------------------------------------------------
console.log('6. the crest and the valley');
{
  const R = W.climate.relief, CH = CLIMATE.CH;
  let crest = null, valley = null;
  for (let k = 0; k < R.nx * R.nz; k++) {
    const p = R.data[k * R.NCH + CH.prom], hf = Math.abs(R.data[k * R.NCH + CH.hf]);
    if (hf < 40) continue;                                                     // a real relief, not a ripple
    if (!crest || p > crest.p) crest = { k, p, hf }; if (!valley || p < valley.p) valley = { k, p, hf };
  }
  const at = o => { const i = o.k % R.nx, j = Math.floor(o.k / R.nx); return [R.x0 + (i + 0.5) * R.cell, R.z0 + (j + 0.5) * R.cell]; };
  const s = [0, 0, 0];
  const uAt = (p, terrain) => { W.setWind({ mps: 10, dirDeg: 270, refH: 10, terrain }); const g = W.terrainH(p[0], p[1]); W.climate.sample(p[0], g + 50, p[1], 0, s); return Math.hypot(s[0], s[2]); };
  const pc = at(crest), pv = at(valley);
  const rc = uAt(pc, 1) / uAt(pc, 0), rv = uAt(pv, 1) / uAt(pv, 0);
  yes(rc > 1.05 && rc < 1.9, `the crest (prominence ${crest.p.toFixed(2)}, ${crest.hf.toFixed(0)} m above its surroundings) speeds the wind up x${rc.toFixed(2)}`);
  yes(rv < 0.95 && rv >= 0.5, `the valley floor (prominence ${valley.p.toFixed(2)}, ${valley.hf.toFixed(0)} m below) shelters it to x${rv.toFixed(2)}`);
  W.setWind(null);
}

// ---- 7. the linearised sampler ---------------------------------------------------------
console.log('7. the linearised sampler');
{
  W.setWind(RICH);
  const cl = W.climate;
  cl.stats.full = cl.stats.linear = cl.stats.recentres = 0;
  let worst = 0, worstRel = 0, worstLow = 0, worstFar = 0, worstV = 0, n = 0;
  const s = [0, 0, 0];
  for (let i = 0; i < 1000; i++) {
    const x = (rnd() - 0.5) * 20000, z = (rnd() - 0.5) * 20000, g = W.terrainH(x, z);
    const low = rnd() < 0.2, y = g + (low ? 1 + rnd() * 6 : 20 + rnd() * 1200), t = 100 + i;   // a fresh instant: this call re-centres
    W.wind(x, y, z, t);
    // the solver's footprint: a wing's strips and the tail within ~12 m of the mean wing, +-2 m in height
    const dx = (rnd() - 0.5) * 24, dy = (rnd() - 0.5) * 4, dz = (rnd() - 0.5) * 24;
    const w = W.wind(x + dx, y + dy, z + dz, t);                     // the same instant, within the radius
    cl.sample(x + dx, y + dy, z + dz, t, s);
    const e = Math.hypot(w[0] - s[0], w[2] - s[2]), ev = Math.abs(w[1] - s[1]), m = Math.hypot(s[0], s[2]);
    if (low) worstLow = Math.max(worstLow, e, ev); else { worst = Math.max(worst, e); worstRel = Math.max(worstRel, e / Math.max(0.5, m)); worstV = Math.max(worstV, ev); n++; }
    // and the whole radius, for the record
    const fx = (rnd() - 0.5) * 60, fz = (rnd() - 0.5) * 60;
    const wf = W.wind(x + fx, y + dy, z + fz, t); cl.sample(x + fx, y + dy, z + fz, t, s);
    if (!low) worstFar = Math.max(worstFar, Math.hypot(wf[0] - s[0], wf[1] - s[1], wf[2] - s[2]));
  }
  yes(worst < 0.15 && worstRel < 0.01, `above 20 m agl the linearised HORIZONTAL wind is within ${worst.toFixed(4)} m/s (${(worstRel * 100).toFixed(2)} %) of the full field over ${n} pairs of the solver's footprint`);
  // the vertical: the local band's slope is the reference's across the footprint (one slope per
  // aeroplane), and sample() reads its own - on the analytic world's 140 m ground waves they differ
  yes(worstV < 1.0, `the VERTICAL within ${worstV.toFixed(3)} m/s (the local band's slope, one per aeroplane, against the point's own)`);
  console.log(`       (${worstFar.toFixed(3)} m/s at the 30 m radius; within 7 m of the ground the ground's own curvature costs up to ${worstLow.toFixed(3)} m/s)`);
  // a solver-like pattern: 25 calls per instant within 10 m, 200 instants
  cl.stats.full = cl.stats.linear = cl.stats.recentres = 0;
  for (let k = 0; k < 200; k++) {
    const t = 1000 + k / 60, x = 500 + k, y = 300, z = -200;
    for (let i = 0; i < 25; i++) W.wind(x + (rnd() - 0.5) * 10, y + (rnd() - 0.5) * 2, z + (rnd() - 0.5) * 10, t);
  }
  yes(cl.stats.recentres === 200 && cl.stats.linear === 200 * 24 && cl.stats.linear / cl.stats.full >= 4,
      `200 instants x 25 calls: ${cl.stats.recentres} re-centres, ${cl.stats.full} full, ${cl.stats.linear} linear (ratio ${(cl.stats.linear / cl.stats.full).toFixed(1)})`);
  // a far call at the same instant does not re-centre
  const before = cl.stats.recentres;
  W.wind(500, 300, -200, 1000); W.wind(9000, 300, 4000, 1000);
  yes(cl.stats.recentres === before + 1, 'a far call at the same instant is a full sample, not a re-centre');
  // cost: full samples per second
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20000; i++) cl.sample(i % 3000, 200 + (i % 7), -i % 2000, i * 0.01, s);
  const us = Number(process.hrtime.bigint() - t0) / 1e3 / 20000;
  console.log(`       full sample ${us.toFixed(2)} us`);
  // A WALL IS A BOUND ON THE BOX, NOT ON THE CODE. The runner keeps four gates
  // going at once and this one now flies thermals and builds seas, so a tight
  // microsecond bound here is a coin toss decided by whatever ARCHETYPES is
  // doing on the other three cores. The number is PRINTED (2.3 us quiet) and
  // the bound only catches a pathological regression - an order of magnitude,
  // not a percent. tools/frame_perf.js is where cost is actually measured.
  yes(us < 60, `a full sample is ${us.toFixed(2)} us here (2.3 quiet; this bound only catches an order-of-magnitude regression)`);
  W.setWind(null);
}

// ---- 8. the thermals -----------------------------------------------------------------------
console.log('8. the thermals');
{
  const W8 = makeWorld();
  const DAY8 = { date: '2026-06-21', localHours: 14, oatC: 24, dewC: 9, lapse: 'mixed', mixH: 1800,
                 cloudCover: 0.4, cloudType: 'cu', cloudSeed: 1 };
  W8.setDay(Object.assign({ wind: { kts: 0, dirDeg: 0, refH: 10, thermals: 1 } }, DAY8));
  const c = W8.climate, C = c.conv;
  yes(!!C && C.zi === 1800, `a summer afternoon convects: z_i ${C ? C.zi.toFixed(0) : '-'} m, the lid under a ${c.profile(0).lcl.toFixed(0)} m base`);
  yes(C.beam > 300 && C.beam < 800, `the beam is ${C.beam.toFixed(0)} W/m2 after the albedo and the cloud`);
  const wsRock = C.wstarOf(0.6), wsGrass = C.wstarOf(0.35), wsWater = C.wstarOf(0);
  yes(wsRock > wsGrass && wsGrass > 1.4 && wsGrass < 3.2 && wsWater === 0,
      `w* is ${wsGrass.toFixed(2)} m/s over grass, ${wsRock.toFixed(2)} over rock, and exactly ${wsWater} over water`);
  const th = c.thermals(0, 0, 8000);
  yes(th.length >= 2, `${th.length} live columns within 8 km, spaced ${C.spacing.toFixed(0)} m (1.5 z_i, Lenschow)`);
  const t = th[0];
  yes(t.wpk > 2 && t.wpk < 6, `the best of them peaks at ${t.wpk.toFixed(2)} m/s in a ${t.r2.toFixed(0)} m core`);
  // UP THE COLUMN: nothing at the ground, a peak in the lower half, nothing at the lid
  const s8 = [0, 0, 0];
  const at = (dx, agl) => { c.sample(t.x + dx, t.ground + agl, t.z, 0, s8); return s8[1]; };
  const prof = [50, 300, 600, 900, 1200, 1500, 1790].map(a => at(0, a));
  yes(prof[1] > 2 && prof[6] < 0.3 && prof[1] > prof[5],
      `up the core: ${prof.map(v => v.toFixed(1)).join(' / ')} m/s at 50 / 300 / 600 / 900 / 1200 / 1500 / 1790 m`);
  yes(at(0, 1900) === 0 && at(0, -5) === 0, 'above the lid and under the ground there is nothing at all');
  // ACROSS IT: a core, a ring of sink, then air that is merely turbulent. The
  // mixed layer gusts everywhere, so `outside` is a MEAN over half a minute -
  // the column is done there, the roughness is not.
  const mean30 = (dx, agl) => { let q = 0, n = 0;
    for (let tt = 0; tt < 30; tt += 0.5) { c.sample(t.x + dx, t.ground + agl, t.z, tt, s8); q += s8[1]; n++; }
    return q / n; };
  yes(at(t.r2 * 1.5, 600) < -0.1 && Math.abs(mean30(t.r2 * 3, 600)) < 0.15,
      `across it: ${at(0, 600).toFixed(2)} in the core, ${at(t.r2 * 1.5, 600).toFixed(2)} in the sink ring, ${mean30(t.r2 * 3, 600).toFixed(2)} outside (a 30 s mean: the layer is rough there, but the column is done)`);
  // MASS BALANCE. Measured at a constant HEIGHT ABOVE THE GROUND, because the
  // column's profile is a function of agl and sloping ground would otherwise
  // tilt the sum by geometry rather than by the model.
  {
    const R = 2.2 * t.r2, st = 2;
    let net = 0, abs = 0;
    for (let dx = -R; dx <= R; dx += st) for (let dz = -R; dz <= R; dz += st) {
      const r = Math.hypot(dx, dz); if (r > R) continue;
      const X = t.x + dx, Z = t.z + dz;
      c.sample(X, W8.terrainH(X, Z) + 600, Z, 0, s8);
      net += s8[1]; abs += Math.abs(s8[1]);                          // a cartesian grid: every cell the same area
    }
    yes(Math.abs(net) < 0.02 * abs, `what the core lifts, the ring brings back: the net flux is ${(100 * Math.abs(net) / abs).toFixed(2)} % of the gross`);
  }
  // THE NIGHT, and the lattice's clock
  W8.setDay({ localHours: 2 });
  yes(c.conv === null && at(0, 600) === 0, 'at two in the morning there is no convection at all, and the field is an exact zero');
  W8.setDay({ localHours: 14 });
  yes(Math.abs(at(0, 600) - prof[2]) < 1e-9, 'and the same hour is the same air again');
  // THE LATTICE DRIFTS with the boundary layer's wind, on the DAY clock
  W8.setDay(Object.assign({ wind: { kts: 12, dirDeg: 270, refH: 10, thermals: 1 } }, DAY8));
  const a0 = W8.climate.thermals(0, 0, 9000)[0];
  W8.setDay({ localHours: 14 + 600 / 3600 });                       // ten minutes later
  const a1 = W8.climate.thermals(0, 0, 12000).filter(q => q.i === a0.i && q.j === a0.j)[0];
  if (a1) {
    const moved = (a1.x0 - a0.x0) / 600;
    yes(moved > 1 && moved < 12, `and the whole field walks downwind at ${moved.toFixed(1)} m/s of the boundary layer's wind`);
  } else fail('the same column could not be found ten minutes later');
  // GROUND THAT HEATS: a column stands over the land, never over the water
  W8.setDay(Object.assign({ wind: { kts: 0, dirDeg: 0, refH: 10, thermals: 1 } }, DAY8));
  const over = c.thermals(0, 0, 12000);
  const RLh = new Float32Array(CLIMATE.NCH);
  const cold = over.filter(q => c.reliefAt(q.x0, q.z0, RLh)[CLIMATE.CH.heat] < 0.06);
  const wet = over.filter(q => W8.surface(q.x0, q.z0) === W8.SURFACE.WATER);
  yes(over.length > 0 && cold.length === 0, `all ${over.length} columns stand on ground that heats (${wet.length} of them within a raster cell of open water, which is the 200 m raster's own edge)`);
}

// ---- 9. the breeze --------------------------------------------------------------------------
console.log('9. the breeze');
{
  const W9 = makeWorld();
  const base = { date: '2026-06-21', oatC: 20, dewC: 10, cloudCover: 0 };
  const c = W9.climate, CH = CLIMATE.CH, s9 = [0, 0, 0], R9 = new Float32Array(CLIMATE.NCH);
  // a point a few kilometres inland of a real coastline
  let pt = null;
  for (let x = -9000; x <= 9000 && !pt; x += 500) for (let z = -9000; z <= 9000; z += 500) {
    W9.setDay(Object.assign({ localHours: 15, wind: { kts: 0, dirDeg: 0, refH: 10, breeze: 1 } }, base));
    const r = c.reliefAt(x, z, R9);
    if (r[CH.coast] > 1500 && r[CH.coast] < 6000 && Math.hypot(r[CH.cgx], r[CH.cgz]) > 0.9) { pt = [x, z, r[CH.cgx], r[CH.cgz], r[CH.coast]]; break; }
  }
  if (!pt) fail('no clean coastline on this world'); else {
    const [x, z, gx, gz, dc] = pt;
    const g = Math.max(0, W9.terrainH(x, z));
    const onshore = () => { c.sample(x, g + 100, z, 0, s9); return s9[0] * gx + s9[2] * gz; };   // along the coast's gradient: + is inland
    const lift = () => { c.sample(x, g + 300, z, 0, s9); return s9[1]; };
    W9.setDay({ localHours: 15 });
    const day = onshore(), dayW = lift(), spd = Math.hypot(s9[0], s9[2]);
    yes(day > 0.5, `${(dc / 1000).toFixed(1)} km inland at three in the afternoon the breeze blows ONSHORE at ${day.toFixed(2)} m/s`);
    yes(dayW > 0, `and the air it pushes inland has to rise: ${dayW.toFixed(3)} m/s (broad, as a smeared front is - see the note in 09_climate.js)`);
    W9.setDay({ localHours: 2 });
    yes(onshore() < 0, `at two in the morning it has reversed and runs seaward (${onshore().toFixed(2)} m/s)`);
    // cloud kills it
    W9.setDay({ localHours: 15, cloudCover: 0.95 });
    yes(onshore() < 0.5 * day, `an overcast afternoon kills it: ${onshore().toFixed(2)} against ${day.toFixed(2)} m/s in the clear`);
    // and it dies out to sea and inland, and with height
    W9.setDay({ localHours: 15, cloudCover: 0 });
    c.sample(x, g + 900, z, 0, s9);
    yes(Math.hypot(s9[0], s9[2]) < 0.2 * spd, `it is 700 m deep: ${Math.hypot(s9[0], s9[2]).toFixed(2)} m/s at 900 m against ${spd.toFixed(2)} at 100`);
  }
}

// ---- 12. the sea follows a wind that moves --------------------------------------------------
console.log('12. the sea');
{
  const W12 = makeWorld();
  // THE GOLDEN: the legacy path draws exactly the trains it always drew. The
  // water session owns this law (GATE WATER 1); this is the climate's copy of
  // the promise, because the climate is what made the wind able to move.
  W12.setWind({ base: [3, 0, 4] });
  const hash = fnvStr(JSON.stringify(W12.sea.W));
  yes(hash === '63eccad3', `the legacy sea is the sea it always was (${hash})`);
  yes(W12.sea.W.length === 32 && W12.sea.W.filter(w => w.felt).length === 8,
      'thirty-two trains, eight of them felt - the swell band the hull rides');
  W12.setSea({ A: 0.09, L: 10, n: 2 });        // setSea has always needed an amplitude of its own
  yes(W12.sea.W.length === 2 && W12.sea.W.every(w => w.felt), 'setSea({A,L,n:2}) still gives the old pair, felt whole');
  // THE FELT SET IS THE DRAW'S, not the wavelength's: it cannot change in flight,
  // whatever the wind does, or waterH would step under a float.
  W12.setWind({ base: [3, 0, 4] });
  const felt0 = W12.sea.W.map(w => (w.felt ? 1 : 0)).join('');
  let same = true;
  for (const spd of [2, 6, 11, 18, 25]) {
    W12.setWind({ base: [spd * 0.6, 0, spd * 0.8] });
    if (W12.sea.W.map(w => (w.felt ? 1 : 0)).join('') !== felt0) same = false;
  }
  yes(same, `the felt band is the same eight trains at every wind from 2 to 25 m/s (${felt0.slice(0, 12)}...)`);
  // seaTau 0 - the default - rebuilds on the spot, as it always did
  const U = makeWorld();
  U.setDay({ wind: { mps: 5, dirDeg: 270, refH: 10 } });
  const t12 = 137;
  const pts = [];
  for (let z = 3000; z <= 9000 && pts.length < 4; z += 1500) for (let x = -4000; x <= 4000; x += 2000) if (U.waterH(x, z) === 0 && pts.length < 4) pts.push([x, z]);
  const step = (W, at) => { const a = pts.map(([x, z]) => W.waterH(x, z, t12)); W.setDay({ wind: { mps: 16, dirDeg: 300, refH: 10 } });
    const b = pts.map(([x, z]) => W.waterH(x, z, t12)); let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(b[i] - a[i])); return m; };
  const jump0 = step(U);
  yes(jump0 > 0.05, `with seaTau 0 a wind change steps the surface ${jump0.toFixed(3)} m at once - which is what it has always done`);
  // with a seaTau the same change moves NOTHING at once, and builds smoothly after
  const V = makeWorld();
  V.setDay({ seaTau: 900, wind: { mps: 5, dirDeg: 270, refH: 10 } });
  const jump1 = step(V);
  yes(jump1 < 1e-12, `with seaTau 900 it steps ${jump1.toExponential(1)} m - the wind moved, the sea has not yet`);
  // THE ANCHOR IS THE AEROPLANE, so that is where continuity is measured. A
  // wave field whose WAVELENGTH is changing cannot be continuous everywhere at
  // once; the phase is held where the hull is and the residual grows with the
  // distance from it, out where the water's own LOD has turned those ridges
  // into roughness. Both numbers are taken, and both are printed.
  const AX = pts[0][0], AZ = pts[0][1];
  const near = [[AX, AZ], [AX + 60, AZ + 40], [AX - 120, AZ + 90]];
  let pN = near.map(([x, z]) => V.waterH(x, z, t12)), pF = pts.map(([x, z]) => V.waterH(x, z, t12));
  let wN = 0, wF = 0, n = 0;
  for (let i = 0; i < 1800; i++) {
    V.dayTick(1, t12, AX, AZ);
    const cN = near.map(([x, z]) => V.waterH(x, z, t12)), cF = pts.map(([x, z]) => V.waterH(x, z, t12));
    for (let k = 0; k < cN.length; k++) wN = Math.max(wN, Math.abs(cN[k] - pN[k]));
    for (let k = 0; k < cF.length; k++) wF = Math.max(wF, Math.abs(cF[k] - pF[k]));
    pN = cN; pF = cF; n++;
    if (Math.abs(V.sea.A - V.seaTarget.A) < 1e-4) break;
  }
  yes(V.sea.A > 0.25 && V.sea.L > 22, `and builds to A ${V.sea.A.toFixed(3)} / L ${V.sea.L.toFixed(1)} over ${n} s of the day's clock`);
  yes(wN < 0.06, `within 120 m of the hull it never moves more than ${wN.toFixed(4)} m in a second of it (the phase is anchored there); out at the probes 4-8 km away, ${wF.toFixed(2)} m - the slide, where the LOD has already eaten the ridges`);
  yes(V.sea.W.map(w => (w.felt ? 1 : 0)).join('') === felt0, 'and the felt band came through the whole build unchanged');
}

console.log('16. two media, not one');
{
  const W16 = makeWorld();
  W16.setDay({ oatC: 15, dewC: 13.5, turbidity: 2.5 });          // rh about 0.90
  const hz = W16.climate.haze(), day = W16.day;
  yes(hz.column && hz.layer && hz.surfaceVisM != null && hz.rho0 === undefined,
      'haze() hands over a COLUMN and a LAYER, and no bare rho0 to mistake for either');
  yes(Math.abs(hz.column.rho0 - 3.912 / (hz.column.visibilityKm * 1000)) < 1e-12,
      `the column is Koschmieder on the day's own visibility (${hz.column.visibilityKm.toFixed(1)} km -> ${hz.column.rho0.toExponential(2)} /m)`);
  yes(hz.layer.rho0 === day.mistRho0,
      "the layer is the DAY's own density, read and not recomputed");
  const ratio = hz.layer.rho0 / hz.column.rho0;
  yes(ratio > 5 && ratio < 20,
      `and it is a different medium: the layer is ${ratio.toFixed(1)}x denser than the column at rh ${(day.rh * 100).toFixed(0)} %`);
  // the surface sees both; an eye above the lid sees only the column
  yes(Math.abs(hz.surfaceVisM - 3.912 / (hz.column.rho0 + hz.layer.rho0)) < 1e-9,
      `at the surface the extinctions ADD: ${(hz.surfaceVisM / 1000).toFixed(1)} km on the deck against ${hz.column.visibilityKm.toFixed(0)} in the column`);
  yes(hz.surfaceVisM < hz.column.visibilityKm * 1000,
      'so the deck is never rosier than the column - the fog morning cannot report 37 km any more');
  // a dry day: no layer at all, and the two numbers become one
  W16.setDay({ oatC: 15, dewC: -5, turbidity: 2.5 });
  const dry = W16.climate.haze();
  yes(dry.layer.rho0 === 0, 'a dry day has no layer at all (rho0 exactly 0)');
  yes(Math.abs(dry.surfaceVisM / 1000 - dry.column.visibilityKm) < 1e-9,
      'and then the deck IS the column, to the metre');
  // the storm still thickens the column only
  const clear = W16.climate.haze().column.visibilityKm;
  W16.setDay({ storm: { at: W16.day.utc, intensity: 1 }, utc: W16.day.utc + 3900 });
  yes(W16.climate.haze().column.visibilityKm < clear, 'and a front still thickens the column');
}


// ---- 13. the thermals are under the clouds ---------------------------------------------------
console.log('13. one field, not two');
{
  const W13 = makeWorld();
  W13.setDay({ date: '2026-06-21', localHours: 14, oatC: 24, dewC: 9, lapse: 'mixed', mixH: 1800,
               cloudCover: 0.4, cloudType: 'cu', cloudSeed: 7,
               wind: { kts: 0, dirDeg: 0, refH: 10, thermals: 1 } });
  const c = W13.climate, C = c.conv;
  const map = C.map;
  yes(map && map.seed === 7, 'the climate reads the weather map the SKY is drawn from, by the day’s own seed');
  // UNDER CLOUD means under a real one: the map's coverage carries a soft edge,
  // and counting every texel it touches would call a quarter of the sky's fringe
  // 'cloud'. The threshold here is the same one the odds step over.
  const th = c.thermals(0, 0, 20000);
  let under = 0;
  for (const t of th) if (CLOUD_FIELD.sample(map, t.x0, t.z0)[0] > 0.25) under++;
  // THE BASELINE IS CLOUD OVER GROUND THAT CAN HOLD A THERMAL, not over the
  // whole map: half this world is sea, no column stands there, and counting the
  // sky over the water would flatter the comparison in the wrong direction.
  let land = 0, landUnder = 0;
  const RLc = new Float32Array(CLIMATE.NCH);
  for (let gx = -20000; gx <= 20000; gx += 500) for (let gz = -20000; gz <= 20000; gz += 500) {
    if (c.reliefAt(gx, gz, RLc)[CLIMATE.CH.heat] < 0.06) continue;
    land++; if (CLOUD_FIELD.sample(map, gx, gz)[0] > 0.25) landUnder++;
  }
  const byArea = landUnder / Math.max(1, land), frac = th.length ? under / th.length : 0;
  yes(th.length > 20 && frac > byArea * 1.6,
      `${(frac * 100).toFixed(0)} % of ${th.length} columns stand under cloud, where cloud covers ${(byArea * 100).toFixed(0)} % of the ground that could hold one - twice over, because they are the same field`);
  // and the cover's hand on the strength: more cloud, less sun, weaker thermals
  const w0 = C.wstarOf(0.35);
  W13.setDay({ cloudCover: 0.9 });
  yes(W13.climate.conv.wstarOf(0.35) < w0, `and a covered sky weakens them (w* ${w0.toFixed(2)} -> ${W13.climate.conv.wstarOf(0.35).toFixed(2)} m/s)`);
}

// ---- 10. the column: the layered day and the water in it -------------------------------
console.log('10. the column');
{
  const { makeAtmos, atmosWater, ATMOS_ISA, ATM } = require('./flight_core.js');
  // the ISA path is untouched: byte for byte, whatever else the file grew
  const I = makeAtmos({});
  yes(I.p(1000) === ATMOS_ISA.p(1000) && I.T(5000) === ATMOS_ISA.T(5000) && I.sigma(0) === 1,
      'a cfg naming no shape runs the G72 closed form: sigma(0) is exactly 1 and the tables are the same numbers');
  yes(I.layered === false && I.mixH === null, 'and says so: layered false');
  // the hot-and-high day GATE HOTHIGH flies, still the closed form and still its own numbers
  const H = makeAtmos({ oatC: 35, qnhPa: 100800 });
  yes(H.layered === false && H.sigma(0) < 1 && Math.abs(H.densityAlt(420) - 1133) < 2,
      `the hot-and-high day is unlayered and reads DA ${H.densityAlt(420).toFixed(0)} m at the 420 m bench`);
  // the layered day: continuous, hydrostatic, and exact at sea level
  const A = makeAtmos({ oatC: 22, qnhPa: 101000, lapse: 'mixed', mixH: 1400, inversion: { dT: 2.5, thick: 150 } });
  yes(A.layered && A.mixH === 1400, 'a mixed day is layered');
  yes(Math.abs(A.T(0) - (22 + 273.15)) < 1e-9 && A.p(0) === 101000, 'it starts at the declared temperature and QNH');
  let worstT = 0, worstP = 0;
  for (const h of [1400, 1550]) {                                     // the layer edges
    const dT = Math.abs(A.T(h + 1e-6) - A.T(h - 1e-6)), dP = Math.abs(A.p(h + 1e-6) - A.p(h - 1e-6)) / A.p(h);
    worstT = Math.max(worstT, dT); worstP = Math.max(worstP, dP);
  }
  yes(worstT < 1e-5 && worstP < 1e-9, `T and p are continuous across every layer edge (${worstT.toExponential(1)} K, ${worstP.toExponential(1)} rel)`);
  // hydrostatic: dp/dh = -rho g, inside every layer
  let worstH = 0;
  for (const h of [100, 700, 1300, 1450, 1500, 1700, 3000, 8000]) {
    const d = 0.5, num = (A.p(h + d) - A.p(h - d)) / (2 * d), want = -A.rho(h) * ATM.G0;
    worstH = Math.max(worstH, Math.abs((num - want) / want));
  }
  yes(worstH < 1e-6, `and hydrostatic to ${worstH.toExponential(1)} relative inside every layer`);
  // the mixed layer IS the dry adiabatic, and the lid really is a lid
  const lapse = (a, b) => (A.T(a) - A.T(b)) / (b - a);
  yes(Math.abs(lapse(0, 1000) - ATM.LD) < 1e-9, `the mixed layer lapses at the dry adiabatic (${(lapse(0, 1000) * 1000).toFixed(2)} K/km)`);
  yes(A.T(1550) > A.T(1400), `the inversion is an inversion: ${(A.T(1400) - 273.15).toFixed(2)} C at 1400 m, ${(A.T(1550) - 273.15).toFixed(2)} at 1550`);
  yes(Math.abs(lapse(2000, 5000) - ATM.L) < 1e-9, 'and the free atmosphere above it is the standard lapse again');
  // THE WATER: under a mixed layer the profile's own LCL reproduces the day's 125 m rule EXACTLY
  let worstL = 0;
  for (const [T0, Td0] of [[22, 8], [30, 12], [15, 10], [35, 5], [8, 2]]) {
    const M = makeAtmos({ oatC: T0, lapse: 'mixed', mixH: 5000 }), w = atmosWater(M, Td0);
    worstL = Math.max(worstL, Math.abs(w.lcl - 125 * (T0 - Td0)));
  }
  yes(worstL < 1e-6, `the derived condensation level IS the day's 125 m per degree rule under a mixed layer (worst ${worstL.toExponential(1)} m over five pairs)`);
  const W2 = atmosWater(A, 8);
  yes(Math.abs(W2.rh(W2.lcl) - 1) < 1e-9 && W2.rh(0) < 0.6, `rh reaches exactly 1 at the base (${W2.lcl.toFixed(0)} m) and is ${(W2.rh(0) * 100).toFixed(0)} % at the surface`);
  yes(W2.rh(W2.lcl + 600) < 0.55 && W2.Td(W2.lcl + 200) === A.T(W2.lcl + 200) - 273.15,
      'above it the air is saturated through the deck and dries out over 500 m');
  const dry = atmosWater(makeAtmos({ oatC: 30, lapse: 'mixed', mixH: 900, inversion: { dT: 4, thick: 200 } }), -5);
  yes(dry.lcl == null || dry.lcl > 3000, `a capped dry day has no base a thermal can reach (${dry.lcl == null ? 'none' : dry.lcl.toFixed(0) + ' m'})`);
  yes(atmosWater(A, null).lcl === null && atmosWater(A, null).rh(0) === null, 'and with no dew point declared there is no water at all');
  // the world's column, and the thermals' ceiling
  const W3 = makeWorld();
  W3.setDay({ oatC: 22, dewC: 8, lapse: 'mixed', mixH: 1600 });
  const pr = W3.climate.profile(500);
  yes(pr && Math.abs(pr.T - (22 - 9.8 * 0.5)) < 0.02 && pr.rho > 1.1 && pr.rh > 0.4,
      `world.climate.profile(500) reads T ${pr.T.toFixed(1)} C, rho ${pr.rho.toFixed(3)}, rh ${(pr.rh * 100).toFixed(0)} %`);
  yes(Math.abs(W3.climate.mixTop() - 1600) < 1e-6, `the thermals' ceiling is the LOWER of the lid and the base (${W3.climate.mixTop().toFixed(0)} m: the lid, under a ${pr.lcl.toFixed(0)} m base)`);
  W3.setDay({ mixH: 2500 });
  yes(Math.abs(W3.climate.mixTop() - W3.climate.profile(0).lcl) < 1e-6, 'and the base when the lid is above it');
  // HUMIDITY DOES NOT MOVE THE AIR (the dry-air cut, and GATE DAY's invariant)
  const before = W3.atmos;
  W3.setDay({ dewC: 2 });
  yes(W3.atmos === before, 'moving the humidity leaves world.atmos the SAME OBJECT');
  yes(Math.abs(W3.climate.profile(0).Td - 2) < 1e-9, 'while the water follows it live');
}

// ---- 11. the front on the clock ----------------------------------------------------------
console.log('11. the front');
{
  const W4 = makeWorld();
  const AT = 18 * 3600 + 3600;
  W4.setDay({ date: '2026-06-21', utc: 18 * 3600, oatC: 20, qnhPa: 101300, dewC: 10,
              wind: { kts: 10, dirDeg: 270, refH: 10 }, storm: { at: AT, intensity: 1 } });
  const read = t => {
    W4.setDay({ utc: 18 * 3600 + t });
    const w = W4.wind(0, 100, 0, 0);
    return { I: W4.day.storm.I, phase: W4.day.storm.phase, spd: Math.hypot(w[0], w[2]),
             dir: Math.atan2(w[2], w[0]) * 180 / Math.PI, oat: W4.day.oatC, qnh: W4.day.qnhEff,
             cover: W4.day.cloudCoverEff, type: W4.day.cloudTypeEff, vis: W4.climate.haze().column.visibilityKm };
  };
  const calm = read(-7200), pre = read(1800), pass = read(3900), post = read(9000), gone = read(20000);
  yes(calm.I === 0 && calm.phase === 'none', 'before it, nothing: I 0');
  yes(pre.I > 0.5 && pre.spd > calm.spd * 1.4, `the wind rises ahead of it (${calm.spd.toFixed(1)} -> ${pre.spd.toFixed(1)} m/s at I ${pre.I.toFixed(2)})`);
  yes(pass.I === 1 && Math.abs(pass.dir - calm.dir) > 10, `it veers through the passage (${calm.dir.toFixed(0)} -> ${pass.dir.toFixed(0)} deg)`);
  yes(pass.oat < calm.oat - 3 && pass.qnh < calm.qnh - 500, `the temperature drops ${(calm.oat - pass.oat).toFixed(1)} C and the pressure ${((calm.qnh - pass.qnh) / 100).toFixed(1)} hPa`);
  yes(pass.cover > 0.9 && pass.type === 'cb' && pass.vis < calm.vis * 0.6, `the sky closes to ${pass.cover.toFixed(2)} ${pass.type} and the visibility falls ${calm.vis.toFixed(0)} -> ${pass.vis.toFixed(0)} km`);
  yes(post.I < 1 && post.I > 0 && gone.I === 0 && Math.abs(gone.spd - calm.spd) < 1e-9 && gone.type === 'cu',
      'and it clears: the day it leaves behind is the day it found');
  // no jumps: the field is smooth in the clock
  let worst = 0, prev = null;
  for (let t = -3600; t <= 22000; t += 60) { const r = read(t); if (prev) worst = Math.max(worst, Math.abs(r.spd - prev)); prev = r.spd; }
  yes(worst < 3, `and it arrives smoothly: never more than ${worst.toFixed(2)} m/s of change in a minute of the clock`);
  // the SWING, which is the day's own and not a front's
  const W5 = makeWorld();
  W5.setDay({ date: '2026-06-21', oatC: 15, diurnalC: 12, dewC: 5 });
  const at = h => { W5.setDay({ localHours: h }); return W5.day.oatC; };
  const dawn = at(5), noon = at(15), night = at(2);
  yes(noon > dawn + 6 && night < dawn + 3, `the diurnal swing: ${dawn.toFixed(1)} C at 05:00, ${noon.toFixed(1)} at 15:00, ${night.toFixed(1)} at 02:00`);
  W5.setDay({ diurnalC: 0 });
  yes(Math.abs(W5.day.oatC - 15) < 1e-9, 'and diurnalC 0 - the default - is exactly the declared temperature');
}

// ---- 15. the two clocks -------------------------------------------------------------------
console.log('15. the two clocks');
{
  const W6 = makeWorld();
  W6.setDay({ date: '2026-06-21', utc: 18 * 3600, rate: 0, oatC: 18, dewC: 6,
              wind: { kts: 14, dirDeg: 200, refH: 10, gust: 0.4 },
              storm: { at: 18 * 3600 + 1800, intensity: 1 } });
  // the SIM clock moves: the gusts move, the front does not
  const a0 = W6.wind(10, 100, 20, 0).slice(), a1 = W6.wind(10, 100, 20, 7).slice();
  const I0 = W6.day.storm.I;
  yes(Math.hypot(a0[0] - a1[0], a0[1] - a1[1], a0[2] - a1[2]) > 0.05, 'the sim clock moves the gusts');
  yes(W6.day.storm.I === I0 && W6.day.utc === 18 * 3600, 'and moves neither the front nor the day (rate 0, and the solver never advances it)');
  // the DAY clock moves only when the viewer ticks it, and then the front follows
  W6.setDay({ rate: 1 });
  W6.dayTick(600);
  yes(W6.day.utc === 18 * 3600 + 600 && W6.day.storm.I > I0, `world.dayTick(600) walks the day and the front with it (I ${I0.toFixed(2)} -> ${W6.day.storm.I.toFixed(2)})`);
  const b0 = Math.hypot(...W6.wind(0, 100, 0, 0));
  W6.dayTick(900);
  yes(Math.hypot(...W6.wind(0, 100, 0, 0)) > b0, 'and the wind it has made is the wind the solver reads');
  // determinism: the same clock, the same field, whatever route was taken to it
  const W7 = makeWorld();
  W7.setDay({ date: '2026-06-21', utc: 18 * 3600 + 1500, rate: 1, oatC: 18, dewC: 6,
              wind: { kts: 14, dirDeg: 200, refH: 10, gust: 0.4 },
              storm: { at: 18 * 3600 + 1800, intensity: 1 } });
  const p6 = W6.wind(33, 210, -77, 12.5), p7 = W7.wind(33, 210, -77, 12.5);
  yes(Object.is(p6[0], p7[0]) && Object.is(p6[1], p7[1]) && Object.is(p6[2], p7[2]),
      'a day ticked to an instant and a day set to it are the same air, bit for bit');
}

// ---- 14. the sources -------------------------------------------------------------------
console.log('14. the sources');
{
  const core = f => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', f), 'utf8');
  const cl = core('09_climate.js');
  yes(!/new Date\(|Date\.now\(|THREE\.|window\.|document\./.test(cl), '09_climate.js has no Date, no THREE, no DOM');
  yes(/'09_climate\.js'/.test(fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8')), 'build.js MANIFEST.core carries 09_climate.js');
  yes(/\bCLIMATE\b/.test(core('90_node_exports.js')), '90_node_exports.js exports CLIMATE');
  const world = core('20_world.js');
  yes(!/function wind\(/.test(world) && /CLIMATE\.make\(/.test(world), '20_world.js has no wind() of its own: the climate makes it');
  yes(/const GC = \[/.test(cl) && /function windLegacy\(/.test(cl) && /WV\[1\] \+= gk \* 0\.18 \* ay \* s/.test(cl), 'the G72 field lives in 09_climate.js verbatim');
  // K2: the water is its own function, so humidity can never rebuild the air
  const at = core('05_atmos.js');
  // makeAtmos's own body - from its head to the comment block that opens the water's - must not
  // mention the humidity at all: that is what keeps a dew point from rebuilding the density
  const mkBody = at.slice(at.indexOf('function makeAtmos'), at.indexOf('// ---- THE WATER IN THE COLUMN'));
  yes(/function atmosWater\(/.test(at) && !/dewC|\brh\b/.test(mkBody),
      'the water is atmosWater(), outside makeAtmos: humidity cannot rebuild the density');
  const dayS = core('07_day.js');
  yes(/AIR_KEYS = \['oatC', 'dISA', 'qnhPa', 'lapse', 'mixH', 'inversion'\]/.test(dayS), "and the day's AIR_KEYS carry the column's shape but not the humidity");
  yes(!/new Date\(|Date\.now\(|THREE\.|window\.|document\./.test(dayS), '07_day.js still has no Date, no THREE, no DOM');
  // K2: the viewer's wiring
  const vw = f => fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', f), 'utf8');
  // THE MIST'S DENSITY IS A WEATHER FACT AND LIVES IN ONE PLACE. It was derived in
  // atmo.js, where the climate could not see it, which is how haze() came to publish a
  // COLUMN density in the same flat object as a LAYER geometry. The law is the day's
  // now; this asserts nobody has quietly put a second copy back.
  const LAW = /0\.0025\s*\*\s*Math\.pow/;
  yes(LAW.test(dayS), "the mist's density law is derived in 07_day.js, beside the visibility it is not");
  const atmoS = vw('atmo.js');
  yes(!LAW.test(atmoS), 'and atmo.js carries no copy of it - it reads day.mistRho0');
  yes(/MIST\.rhoDay = day\.mistRho0/.test(atmoS), 'the renderer reads the day for the density and owns only the SHAPE');
  yes(/pub\.visM/.test(vw('climate_link.js')),
      "the link publishes what the RENDERER measured, so the panel can prefer it over the weather's own");
  const app = vw('app.js');
  yes(!/windBase/.test(app), 'app.js has no windBase: every reader is on the climate now');
  yes(/selCond.\)\.onchange/.test(app) && /WEATHER_UI[\s\S]{0,200}PRESETS\.find/.test(app),
      'the #selCond handler is still the one keeper, and what it applies is a WEATHER panel preset');
  yes(/flWeatherLive/.test(app) && /flyOpen === 'weather'/.test(app), "and the panel's live rows tick on its own flyout");
  yes(/'weather_ui\.js'/.test(fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8')), 'build.js MANIFEST carries weather_ui.js');
  const wu = vw('weather_ui.js');
  // every write is a day write: no setWeather CALL anywhere in the panel's code
  // (the header comment names it as the thing this replaced, which is not a call)
  yes(/CK\.set\(/.test(wu) && !/\.setWeather\(/.test(wu), 'the panel writes through the day, never through setWeather');
  const dc = vw('day_clock.js');
  yes(/weatherFromUrl/.test(dc) && /wind=/.test(dc) && /storm=/.test(dc), 'day_clock.js parses ?wind= and ?storm=');
  yes(/sp\.wind \|\| null/.test(dc), 'and saves the weather with the day');
  yes(/world\.dayTick/.test(dc), "and its tick is the world's, so a front reaches the wind");
  const ed = vw('editor.js');
  yes(/WEATHER_UI\.mount/.test(ed), 'the shed mounts the same panel (one panel, two rails)');
  const dp = vw('dev_panel.js');
  yes(/fold\(root, 'climate'/.test(dp), 'and the F8 panel has a climate fold');
  // K3: the variometer, and the day that owns the sky's seed
  const ms = core('44_machine_sheet.js');
  yes(/S\.sinkAt = /.test(ms), 'the machine sheet carries the whole polar (sinkAt), not just two points of it');
  const pil = core('43_pilot.js');
  yes(/get sheet\(\)/.test(pil), 'and the pilot publishes it, as its own header has said since P0.4');
  yes(/instOn && instOn\.netto/.test(app) && /sinkAt\(o\.V/.test(app), 'the HUD has a netto variometer, off until the instruments row asks for it');
  yes(/cloudSeed/.test(core('07_day.js')), 'the DAY owns the sky’s seed, so the clouds and the thermals are one field');
  yes(/CLOUD_FIELD\.weatherMap/.test(cl) && /thermalCell/.test(cl), 'and the climate reads that same map to place its columns');
  // K4: the render links - one link, and every consumer reading IT
  const lk = vw('climate_link.js');
  yes(/function frame\(/.test(lk) && /cloudDrift/.test(lk), 'climate_link.js is the one place the picture asks the climate');
  yes(/'climate_link\.js'/.test(fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8')), 'and the build carries it');
  const rw = vw('render_world.js');
  yes(/CLIMATE_LINK\.frame\(/.test(rw) && /sockFrame/.test(rw), 'render_world runs it once a frame, and aims every sock in its OWN wind');
  yes(/function aimSock/.test(rw), 'one sag law, two callers (the boot vector and the field)');
  yes(/uWind/.test(rw), 'the impostor cards lean');
  const tj = vw('trees.js');
  yes(/SWAY_GLSL/.test(tj) && /window\.TREE_WIND/.test(tj), 'the leaves and the cover lean on one shared uniform');
  yes(!/objectNormal/.test(tj.slice(tj.indexOf('const SWAY_GLSL'), tj.indexOf('const UP_VS'))),
      "and the sway bends the POSITION only - a cover tuft still shades with the ground's normal (G484)");
  yes(/\.cloudDrift\(/.test(vw('clouds.js')), "the clouds' drift is the link's integral, not wind x seconds");
  yes(/swayGain/.test(vw('gfx_settings.js')), 'and the graphics tier can switch the sway off without a recompile');
  const wd = core('20_world.js');
  yes(/function seaApply/.test(wd) && /function seaRelax/.test(wd), 'the sea can be re-applied without being redrawn, and walks after the wind');
  yes(/w\.felt = r\.felt/.test(wd), 'the felt band is the draw’s, never re-decided');
}

// ---- verdict -------------------------------------------------------------------------------
console.log(`GATE CLIMATE: ${fails ? 'FAIL (' + fails + ' check' + (fails > 1 ? 's' : '') + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
