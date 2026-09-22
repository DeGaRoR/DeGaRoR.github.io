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
// (8-9 thermals/breeze, 12 the sea, 13 the cloud link: added by their sessions —
//  futureDesigns/CLIMATE-2026-09-22.md)
//
//   src/core/09_climate.js, 20_world.js  ->  tools/flight_core.js  ->  here
// Run: node tools/test_climate.js   (contract: one final `GATE CLIMATE: ...`)

const fs = require('fs'), path = require('path');
const { CLIMATE, makeWorld } = require('./flight_core.js');

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
  yes(R.ms < 1500, 'the build is well under a second and a half even under the pool');
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
  yes(us < 8, 'a full sample under 8 us (2.3 quiet; the bound is loose because the pool runs four gates at once)');
  W.setWind(null);
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
             cover: W4.day.cloudCoverEff, type: W4.day.cloudTypeEff, vis: W4.climate.haze().visibilityKm };
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
}

// ---- verdict -------------------------------------------------------------------------------
console.log(`GATE CLIMATE: ${fails ? 'FAIL (' + fails + ' check' + (fails > 1 ? 's' : '') + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
