// HYDRO CHECK — H0, the float-drop spike, headless (WATER-2026-09-13.md §5).
//
// The four questions, each a MEASUREMENT with a bound, and every number
// printed before the verdict so the reader can argue with it:
//   1. ARCHIMEDES — the level float's hydrostatic sum against the analytic
//      sections (sharing nothing with the clipper), the settled drop's
//      total force against the weight, and the settled pose's submerged
//      volume by ray-parity Monte Carlo (the independent arbiter).
//   2. STABILITY — omega*dt of the stiffest panel on a 3 kg node share and
//      c*dt of the slam law over a table of entry speeds, at the fleet's
//      substep counts, against the measured envelope (proven 0.50 / 0.73,
//      diverged 0.615 / 0.947); and the node-on-panel drop integrated with
//      the solver's own scheme, capped and uncapped. THIS IS THE GO/NO-GO.
//   3. THE HUMP — tows at a ramping speed: the seaplane (free to heave and
//      trim, the wing unloading it, a tail holding the attitude), the tank's
//      form (trim held), and the lone float. Resistance must rise to a
//      maximum inside the tank floats' band and fall past it, the trim must
//      peak at the hump, the afterbody must unwet.
//   4. THE GRADIENT — a 1 m/s touchdown at 16 m/s, decelerating under its
//      own drag: the drag must climb over frames to its first peak, no frame
//      may add more than a small fraction of the weight.
// Plus the Savitsky comparison: the transom fade's static lift against his
// buoyant term over (tau, lambda, Cv), reported, not bounded (H3's job).
//   5. THE COST (S1, G451.1) — sim.step(1/60) on the user's 172 on Wipline
//      2350s at rest on the sea against the same build 10 m in the air,
//      best-of-windows (the machine is shared; the minimum is the honest
//      figure): the water may cost at most 2.5 x the dry step, and the pass
//      must land the same weight with the sub-rate as at every substep.
//
// node tools/_hydro_check.js [--verbose] [--trace]
'use strict';
const H = require('./_hydro_gen.js');
const VERB = process.argv.includes('--verbose');
const TRACE = process.argv.includes('--trace');
const G = H.G;
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);

const F = H.makeFloat();
const W = F.m * G;
console.log(`float: L ${F.P.L} m, beam ${F.P.B} m, deadrise ${F.P.beta} deg, step ${F.P.xs} m aft of the bow / ${F.P.hs} m deep; ` +
            `${F.panels.length} panels; mass ${F.m} kg (W ${f(W, 0)} N), CG [${F.cg.map(v => f(v)).join(', ')}], displacement to the deck ${f(F.volDeck * F.P.rho, 0)} kg`);
{ // closure: the hull's vector area must vanish
  let s = [0, 0, 0]; for (const p of F.panels) for (let k = 0; k < 3; k++) s[k] += p.n0[k] * p.area0;
  verdict(Math.hypot(...s) < 1e-6, `hull closed: sum n*A = [${s.map(v => f(v, 6)).join(', ')}]`);
}

// ---- 1. Archimedes ----------------------------------------------------------
console.log('\n1. ARCHIMEDES');
for (const dr of [0.12, 0.2, 0.3]) {
  const S = H.makeBody(F, { keelY: -dr, trim: 0 }), out = H.makeScratch(F);
  H.hydroForces(F, S, H.stillWater, out);
  const lv = H.levelVolume(F, dr) * F.P.rho * G;
  const r = out.terms.static[1] / lv;
  verdict(Math.abs(r - 1) < 0.015 && Math.abs(out.terms.static[0]) < 1 && Math.abs(out.terms.static[2]) < 1,
    `level draft ${dr} m: clipper ${f(out.terms.static[1], 1)} N vs analytic sections ${f(lv, 1)} N (${f(r, 4)}); fore-aft ${f(out.terms.static[0], 2)} N, side ${f(out.terms.static[2], 2)} N`);
}
const drop = H.expDrop(F, { keelY: 0.05, tEnd: 10, sub: 45 });
while (!drop.done) drop.step();
{
  const L = drop.log, tail = L.filter(r => r.t > 8.5);
  const Fy = tail.reduce((s, r) => s + r.Fy, 0) / tail.length;
  const draft = tail.reduce((s, r) => s + r.draft, 0) / tail.length;
  const trim = tail.reduce((s, r) => s + r.trim, 0) / tail.length;
  const mc = H.submergedVolumeMC(F, drop.S, H.stillWater, 200000);
  const Wmc = mc.vol * F.P.rho * G;
  // G451: the arbiter is compared with the clipper's hydrostatic force AT
  // THE SAME INSTANT — the Wipline hull bobs a little longer than the old
  // one (its heave damping is the same kRad over a narrower waterplane),
  // and a residual 5 mm of heave at 10 s is 1.5 % of volume that has
  // nothing to do with whether the clipper integrates Archimedes right
  const outEnd = H.makeScratch(F); H.hydroForces(F, drop.S, H.stillWater, outEnd);
  const FsEnd = outEnd.terms.static[1];
  // the settle's decay: peak |vy| in 1-2 s against 6-7 s
  const pk = (a, b) => Math.max(...L.filter(r => r.t > a && r.t < b).map(r => Math.abs(r.vy)));
  const v12 = pk(1, 2), v67 = pk(6, 7);
  const zeta = v12 > 0 && v67 > 0 ? Math.log(v12 / v67) / (2 * Math.PI * 5 / 0.55) : NaN;   // ~0.55 s period, 5 s apart
  const peakFy = Math.max(...L.map(r => r.Fy)), peakFm = Math.max(...L.map(r => r.Fm));
  console.log(`   drop from 5 cm: peak force ${f(peakFy / W, 2)} W (slam ${f(peakFm / W, 2)} W), settled draft at the step ${f(draft, 3)} m, trim ${f(trim, 2)} deg nose-up, ` +
              `|vy| peak 1-2 s ${f(v12, 3)} -> 6-7 s ${f(v67, 3)} m/s (zeta ~ ${f(zeta, 3)})`);
  verdict(Math.abs(Fy / W - 1) < 0.01, `settled: mean hydro force ${f(Fy, 1)} N over 8.5-10 s vs weight ${f(W, 1)} N (${f(Fy / W, 4)})`);
  verdict(Math.abs(Wmc / FsEnd - 1) < 0.03, `settled pose: Monte-Carlo submerged volume ${f(mc.vol, 4)} m3 = ${f(Wmc, 1)} N vs the clipper's hydrostatic ${f(FsEnd, 1)} N at that instant (${f(Wmc / FsEnd, 4)}; vs weight ${f(Wmc / W, 4)}, ${mc.wet} wet of ${mc.n})`);
  verdict(draft < H.sectionOf(F.P, -1e-9).yd, `freeboard: the deck stays dry (draft ${f(draft, 3)} m at the step, deck at ${f(H.sectionOf(F.P, -1e-9).yd, 3)})`);
  verdict(v67 < 0.5 * v12, `the settle decays (the bob at 6-7 s is under half of 1-2 s)`);
  if (TRACE) for (const r of L.filter((r, i) => i % 6 === 0 && r.t < 3)) console.log(`     t ${f(r.t, 2)} draft ${f(r.draft, 4)} trim ${f(r.trim, 2)} vy ${f(r.vy, 3)} Fy ${f(r.Fy, 0)} Fs ${f(r.Fs, 0)} Fm ${f(r.Fm, 0)} Fp ${f(r.Fp, 0)}`);
}

// ---- 2. stability ------------------------------------------------------------
console.log('\n2. STABILITY (node share 3 kg; envelope: proven omega*dt 0.50 / c*dt 0.73, diverged 0.615 / 0.947)');
const rep = H.stabilityReport(F, { mNode: 3, subs: [24, 45, 72], Vns: [0.5, 1, 2, 3, 5] });
for (const row of rep.rows) {
  console.log(`   sub ${String(row.sub).padStart(2)} dt ${row.dt.toExponential(2)}: stiffest panel ${f(row.aMax, 4)} m2, k ${f(row.kMax, 0)} N/m -> omega*dt ${f(row.omegaDt, 3)}`);
  for (const s of row.slam)
    console.log(`        Vn ${String(s.Vn).padStart(3)} m/s: c_eff ${f(s.peakC, 0).padStart(6)} N s/m, c*dt ${f(s.cdt, 3)}  uncapped ${s.diverged ? 'DIVERGED' : 'stable'} (peak ${f(s.peakF, 0)} N)  capped ${s.divergedCapped ? 'DIVERGED' : 'stable'} (peak ${f(s.peakFCapped, 0)} N)`);
}
{
  const r45 = rep.rows.find(r => r.sub === 45), r24 = rep.rows.find(r => r.sub === 24);
  verdict(r45.omegaDt < 0.5 && r24.omegaDt < 0.5, `buoyancy stiffness inside the envelope: omega*dt ${f(r24.omegaDt, 3)} at 24, ${f(r45.omegaDt, 3)} at 45 (bound 0.50)`);
  const okCap = rep.rows.every(r => r.slam.every(s => !s.divergedCapped));
  verdict(okCap, `the slam with the impulse cap never diverges (24/45/72 substeps, 0.5-5 m/s)`);
  const worst = Math.max(...rep.rows.filter(r => r.sub >= 45).flatMap(r => r.slam.filter(s => s.Vn <= 3).map(s => s.cdt)));
  verdict(worst < 0.73, `the slam's linearised c*dt up to 3 m/s at 45+ substeps ${f(worst, 3)} (bound 0.73)`);
  const uncappedBad = rep.rows.flatMap(r => r.slam.filter(s => s.diverged).map(s => `${r.sub}@${s.Vn}`));
  console.log(`   uncapped divergences: ${uncappedBad.length ? uncappedBad.join(' ') : 'none'}`);
}

// ---- 3. the hump ----------------------------------------------------------------
// Three tows, the carriage ramping 0 -> 20 m/s at 0.6 m/s2:
//   (a) free to heave and trim, the wing unloading the float as V^2 toward
//       a 20 m/s lift-off, a Cub's half-tail holding 6 deg — the seaplane;
//   (b) trim HELD at 5 deg, the same unloading — the NACA tank's form, the
//       calibration target for H3;
//   (c) free, the full load at every speed, no tail — the lone float.
function towTable(tow, label, printAll) {
  const L = tow.log.filter(r => r.t > 3);
  const bins = new Map();
  for (const r of L) { const k = Math.round(r.V); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(r); }
  const rows = [...bins.entries()].map(([V, a]) => {
    const m = key => a.reduce((s, r) => s + r[key], 0) / a.length;
    return { V, R: m('R'), Rs: m('Rs'), Rp: m('Rp'), Rf: m('Rf'), Rk: m('Rk'), Ls: m('Ls'), Lp: m('Lp'), trim: m('trim'), draft: m('draft'), cgY: m('cgY'), wetF: m('wetF'), wetA: m('wetA'), vent: m('vent'), lift: m('lift') };
  }).sort((a, b) => a.V - b.V);
  console.log(`   ${label}`);
  console.log('      V    R/W   static planing   fric   suck |  Ls/W   Lp/W  load/W | trim  draft   rise  wetF  wetA  vent');
  for (const r of rows) if (printAll || r.V % 2 === 0)
    console.log(`   ${String(r.V).padStart(4)}  ${f(r.R / W)}  ${f(r.Rs / W).padStart(6)} ${f(r.Rp / W).padStart(7)} ${f(r.Rf / W).padStart(6)} ${f(r.Rk / W).padStart(6)} | ${f(r.Ls / W).padStart(6)} ${f(r.Lp / W).padStart(6)} ${f(1 - r.lift / W, 2).padStart(6)} | ${f(r.trim, 1).padStart(4)}  ${f(r.draft)} ${f(r.cgY - rows[0].cgY).padStart(6)} ${f(r.wetF, 2).padStart(5)} ${f(r.wetA, 2).padStart(5)}  ${f(r.vent, 2)}`);
  const pre = rows.filter(r => r.V >= 2 && r.V <= 14);
  const hump = pre.reduce((a, b) => (b.R > a.R ? b : a));
  const after = rows.filter(r => r.V > hump.V);
  const dip = after.length ? after.reduce((a, b) => (b.R < a.R ? b : a)) : hump;
  const trimPeak = rows.reduce((a, b) => (b.trim > a.trim ? b : a));
  const last = rows[rows.length - 1];
  const Cv = hump.V / Math.sqrt(G * F.P.B);
  console.log(`   -> hump R/W ${f(hump.R / W)} at ${hump.V} m/s (Cv ${f(Cv, 2)}, Fn_vol ${f(hump.V / Math.sqrt(G * Math.cbrt(F.m / F.P.rho)), 2)}); after it R/W falls to ${f(dip.R / W)} at ${dip.V} m/s; ` +
              `trim peaks ${f(trimPeak.trim, 1)} deg at ${trimPeak.V} m/s; afterbody wet ${f(rows[0].wetA, 2)} m2 at rest -> ${f(last.wetA, 2)} m2 at ${last.V} m/s`);
  return { rows, hump, dip, trimPeak, last, Cv };
}
console.log('\n3. THE HUMP (tow, 0 -> 20 m/s at 0.6 m/s2)');
const towA = H.expTow(F, { V1: 20, rate: 0.6, sub: 24, Vlo: 20, tail: true, trim: 6 });
while (!towA.done) towA.step();
const A = towTable(towA, '(a) the seaplane: free trim, wing unloading to 20 m/s, tail at 6 deg', VERB);
verdict(A.hump.R > 0.10 * W && A.hump.R < 0.40 * W, `a hump of R/W ${f(A.hump.R / W)} (bound 0.10-0.40: tank floats at this loading read ~0.2-0.3)`);
verdict(A.Cv > 2 && A.Cv < 4.5, `the hump at Cv ${f(A.Cv, 2)} (bound 2-4.5: tank floats ~2.5-3.5)`);
verdict(A.dip.R < 0.5 * A.hump.R, `resistance falls ${f(100 * (1 - A.dip.R / A.hump.R), 0)} % past the hump (bound 50 %)`);
verdict(A.trimPeak.V >= A.hump.V - 1 && A.trimPeak.V <= A.hump.V + 3, `the trim peaks at or just past the hump (${A.trimPeak.V} vs ${A.hump.V} m/s)`);
verdict(A.last.wetA < 0.1 * A.rows[0].wetA, `the afterbody unwets when planing (${f(100 * A.last.wetA / A.rows[0].wetA, 0)} % of its rest area)`);
verdict(A.rows.every(r => Number.isFinite(r.R) && Number.isFinite(r.trim)), `the tow stays finite`);
const towB = H.expTow(F, { V1: 20, rate: 0.6, sub: 24, Vlo: 20, fixedTrim: true, trim: 5 });
while (!towB.done) towB.step();
const B = towTable(towB, '(b) the tank: trim held at 5 deg, wing unloading — H3 calibrates this against the NACA curves', VERB);
verdict(B.dip.R < 0.5 * B.hump.R && B.hump.R < 0.45 * W, `held at 5 deg: hump R/W ${f(B.hump.R / W)} at Cv ${f(B.Cv, 2)}, falling ${f(100 * (1 - B.dip.R / B.hump.R), 0)} % past it`);
const towC = H.expTow(F, { V1: 16, rate: 0.6, sub: 24, Vlo: 0 });
while (!towC.done) towC.step();
const C = towTable(towC, '(c) the lone float: free trim, the full load at every speed, no tail', VERB);
verdict(C.last.wetA < 0.1 * C.rows[0].wetA && C.rows.every(r => Number.isFinite(r.R)), `the lone float gets over its hump (afterbody ${f(100 * C.last.wetA / C.rows[0].wetA, 0)} % wet at ${C.last.V} m/s; R/W ${f(C.hump.R / W)} at Cv ${f(C.Cv, 2)})`);

// ---- 4. the gradient ------------------------------------------------------------
// The touchdown: 16 m/s, sinking 1.0 m/s, the wing carrying 85 % at the
// touch and falling as V^2 from there, the tail holding 4 deg, the float
// decelerating under its own drag. THE KSP FAILURE, MEASURED: the drag must
// grow over frames, not arrive in one.
console.log('\n4. THE GRADIENT (touchdown: 16 m/s, sinking 1.0 m/s, the wing carrying 85 %, trim 4 deg, free to decelerate)');
const land = H.expLand(F, { Vx: 16, sink: 1.0, liftK: 0.85, trim: 4, keelY: 0.25, tEnd: 12, sub: 45 });
while (!land.done) land.step();
{
  const L = land.log;
  const i0 = L.findIndex(r => r.wetF + r.wetA > 0);
  const t0 = L[i0].t;
  // the first peak of the drag after the touch
  let iPk = i0; for (let i = i0; i < L.length && i < i0 + 60; i++) { if (L[i].R > L[iPk].R) iPk = i; }
  const Rpk = L[iPk].R;
  const iHalf = L.findIndex((r, i) => i >= i0 && r.R >= 0.5 * Rpk);
  const framesHalf = iHalf - i0, framesPk = iPk - i0;
  let maxDR = 0; for (let i = i0; i < L.length; i++) maxDR = Math.max(maxDR, L[i].R - L[i - 1].R);
  const peakFy = Math.max(...L.map(r => r.Fy)), peakFm = Math.max(...L.map(r => r.Fm));
  const iOut = L.findIndex((r, i) => i > iPk && r.wetF + r.wetA === 0);
  const end = L[L.length - 1];
  console.log(`   first wet at ${f(t0, 3)} s (sink ${f(-L[i0].vy, 2)} m/s at the touch); drag frame by frame: ` +
              L.slice(i0, i0 + 8).map(r => f(r.R / W)).join(' ') + ` ... first peak ${f(Rpk / W)} W after ${framesPk} frames, half of it after ${framesHalf} frames; ` +
              `largest one-frame rise ${f(maxDR / W)} W`);
  console.log(`   vertical: peak ${f(peakFy / W, 2)} W (slam ${f(peakFm / W, 2)} W) — the sink arrested in ${f((L.findIndex((r, i) => i > i0 && r.vy >= 0) - i0) / 60, 2)} s; ` +
              (iOut > 0 ? `the float skips out at +${f(L[iOut].t - t0, 2)} s; ` : 'no skip; ') +
              `at ${f(end.t, 1)} s: V ${f(end.vx, 1)} m/s, trim ${f(end.trim, 1)} deg, draft ${f(end.draft)} m, R/W ${f(end.R / W)}`);
  verdict(maxDR < 0.08 * W, `no step in the drag: the largest one-frame rise is ${f(100 * maxDR / W, 1)} % of the weight (bound 8 %)`);
  verdict(framesHalf >= 2 && framesPk >= 3, `the drag climbs over ${framesPk} frames to its first peak (bound 3), ${framesHalf} to half (bound 2)`);
  verdict(peakFy < 2.5 * W, `the touchdown peaks at ${f(peakFy / W, 2)} W vertical (bound 2.5)`);
  verdict(end.vx < 0.7 * 16, `the float decelerates under its own drag (${f(end.vx, 1)} m/s at ${f(end.t, 1)} s)`);
  verdict(L.every(r => Number.isFinite(r.Fy) && Number.isFinite(r.trim)), `the landing stays finite`);
  if (TRACE) for (const r of L.filter(r => r.t > t0 - 0.05 && r.t < t0 + 0.6)) console.log(`     t ${f(r.t - t0, 3)} V ${f(r.vx, 2)} R ${f(r.R / W)} Fy ${f(r.Fy / W)} Fs ${f(r.Fs / W)} Fp ${f(r.Fp / W)} Fm ${f(r.Fm / W)} draft ${f(r.draft)} trim ${f(r.trim, 2)} vy ${f(r.vy)} wet ${f(r.wetF + r.wetA, 2)}`);
}

// ---- the Savitsky comparison (report only) ----------------------------------------
console.log('\nSavitsky buoyant term vs the transom fade (flat plate; ratio = model/Savitsky, Archimedes/Savitsky):');
for (const [tau, lam, Cv] of [[4, 2, 2], [4, 2, 3], [4, 3, 3], [6, 2, 3], [4, 2, 5], [2, 3, 4]]) {
  const r = H.savitskyStatic(F.P, tau, lam, Cv);
  console.log(`   tau ${tau} lambda ${lam} Cv ${Cv}: CL_sav ${f(r.CLsav, 4)} model ${f(r.CLmodel, 4)} (${f(r.ratio, 2)})  bare Archimedes ${f(r.CLarch, 4)} (${f(r.ratioArch, 2)})`);
}

// ---- 5. THE COST (S1, G451.1): the solver's step on water vs dry -----------------------
{
  console.log('\nTHE COST (the 172 on Wipline 2350s, sim.step(1/60), best of 12 windows of 10 steps)');
  const C = require('./flight_core.js');
  const FIX = require('path').join(__dirname, 'fixtures', 'build_v10_c172_wipline2350_2026-09-20.json');
  const spec = JSON.parse(require('fs').readFileSync(FIX, 'utf8')).spec;
  const mk = every => {
    const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
    if (every) def.params.hydroEvery = every;
    const world = C.makeWorld(), h = world.waterH(0, 1600);
    const sim = C.makeSim(def, world); sim.reset(0);
    const p = sim.p, v = sim.v, iK = def.refs.mains[0], dx = -p[iK * 3], dz = 1600 - p[iK * 3 + 2], dy = (h + 0.3) - p[iK * 3 + 1];
    for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0; }
    sim.ctl.thr = 0;
    let M = 0; for (const n of def.nodes) M += n.m;
    return { sim, W: M * G };
  };
  const best = (sim, n, win) => { let b = Infinity; for (let w = 0; w < n; w++) { const t0 = process.hrtime.bigint(); for (let s = 0; s < win; s++) sim.step(1 / 60); b = Math.min(b, Number(process.hrtime.bigint() - t0) / 1e6 / win); } return b; };
  const lw = sim => { let Fy = 0; for (const x of sim.hydro.floats) Fy += x.out.F[1]; return Fy; };
  // the settle: 10 s, L/W averaged over the last 2 s (the hull still bobs a few mm)
  const settle = R => { let a = 0, n = 0; for (let s = 0; s < 600; s++) { R.sim.step(1 / 60); if (s >= 480) { a += lw(R.sim) / R.W; n++; } } return a / n; };
  const A = mk(0);                                   // the shipped sub-rate
  const lwA = settle(A);
  const water = best(A.sim, 12, 10);
  for (let i = 0; i < A.sim.n; i++) { A.sim.p[i * 3 + 1] += 10; A.sim.v[i * 3] = A.sim.v[i * 3 + 1] = A.sim.v[i * 3 + 2] = 0; }
  for (let s = 0; s < 30; s++) A.sim.step(1 / 60);
  const dry = best(A.sim, 12, 10);
  const B = mk(1);                                   // every substep, the calibration's own rate
  const lwB = settle(B);
  console.log(`   water ${f(water, 2)} ms/step (hydro every ${A.sim.hydro.every} of 24 substeps)  dry ${f(dry, 2)} ms/step  ratio ${f(water / dry, 2)} x  L/W at rest ${f(lwA, 4)} (every substep: ${f(lwB, 4)})`);
  verdict(water / dry <= 2.5, `the water costs ${f(water / dry, 2)} x the dry step (bound 2.5)`);
  verdict(Math.abs(lwA - lwB) < 0.005 && Math.abs(lwA - 1) < 0.02, `the sub-rated pass carries the weight as the full-rate one does (L/W ${f(lwA, 4)} vs ${f(lwB, 4)})`);
}

// ---- 6. THE LAKE A FLOATPLANE LANDS ON IS THE ONE IT IS DRAWN ON ------------
// (2026-09-23; the Metlakatla session on Jolene's Skaters Lake: "waterH returns
// 16.19 while terrainH returns 10.09 and the lake declares level 10.1".) The
// island's lakes are DATA with a level each; the hydrology is handed them so
// its reaches end there, but its own surface for those cells is the priority
// flood's `filled` - the RIM of the basin when the outlet is narrower than a
// bake cell. The renderer had grown a guard against the number (G460.11.7
// discards a waterH sample more than 3 m off the declared level), so the lake
// was drawn right while the physics rode the rim: 6.09 m of hover on Skaters
// Lake, 23.15 m on the worst of the 96 lakes (of 317) that were over 3 m out.
// THE FIXTURE IS A STUB ISLAND, so this runs on any box, island files or not:
// a 300 m bowl with a flat floor, a rim 30 m above it and NO OUTLET, which is
// exactly the shape that makes the fill disagree. The gate is not vacuous by
// construction - it asserts the fill STILL answers the rim, so a waterAt that
// went back to asking it goes red here.
console.log('\n6. THE LAKE\'S SURFACE IS THE DATA\'S (a stub island: a bowl with no outlet)');
{
  const CORE = require('./flight_core.js');
  const WC = { TREE: 10, SHRUB: 20, GRASS: 30, CROP: 40, BUILT: 50, BARE: 60, SNOW: 70, WATER: 80, WETLAND: 90, MOSS: 100 };
  const CX = 3000, CZ = 3000;            // away from HOME's pad, which grades the origin flat
  const FLOOR = 10, LEVEL = 10.5, RIM = 40;
  const LK = { x0: CX - 150, x1: CX + 150, z0: CZ - 150, z1: CZ + 150, level: LEVEL, cells: 900 };
  const inLake = (x, z) => x > LK.x0 && x < LK.x1 && z > LK.z0 && z < LK.z1;
  const terrainH = (x, z) => { const r = Math.max(Math.abs(x - CX), Math.abs(z - CZ));
    return inLake(x, z) ? FLOOR : Math.min(RIM, FLOOR + (r - 150) * 0.2); };
  const island = {
    id: 'stub', bounds: { x0: -6000, z0: -6000, x1: 6000, z1: 6000 }, hydro: 'blend', terrainH, hMax: RIM,
    WC, classAt: (x, z) => inLake(x, z) ? WC.WATER : WC.TREE, effClass: (x, z) => inLake(x, z) ? WC.WATER : WC.TREE,
    lakes: [LK], lakeAt: (x, z) => inLake(x, z) ? 1 : -1,
    canopyAt: () => 0, coastAt: () => 500, cellAt: () => 0, ttype: null, seaFloor: () => -10,
    albedo: null, tint: null, ori1: null, coverU8: null, canopyU8: null, coastU8: null, ndvi: null, lake: null, canopyP90: 0,
    farHeader: null, farRoot: null, grid: { w: 12, h: 12, cell: 1000, x0: -6000, z0: -6000 },
    geo: { lat: 55, lon: -131, convergenceDeg: 0, tz: { std: -9, dst: 'us', name: 'AKST', dstName: 'AKDT' } },
  };
  const W6 = CORE.makeWorld(0, { island });
  const bed = W6.terrainH(CX, CZ), wh = W6.waterH(CX, CZ), fill = W6.hydro.water(CX, CZ);
  console.log(`   the bowl: floor ${f(bed, 2)} m, the record says ${f(LEVEL, 2)} m, the depression fill says ${f(fill, 2)} m (the rim)`);
  verdict(Math.abs(fill - RIM) < 0.5, `the fill still answers the rim (${f(fill, 2)} m) - the fixture reproduces the defect it guards`);
  verdict(Math.abs(wh - LEVEL) < 1e-6, `waterH is the RECORD'S level (${f(wh, 3)} m), not the fill's (${f(fill, 2)} m)`);
  verdict(Math.abs(wh - bed) < 3, `the surface stands on its own bed (${f(wh - bed, 2)} m of water, not ${f(fill - bed, 1)})`);
  // the waterline is where the bed crosses the level, not where the record's box ends
  const bankIn = W6.waterH(CX + 140, CZ), bankOut = W6.waterH(CX + 260, CZ);
  verdict(Math.abs(bankIn - LEVEL) < 1e-6 && !(bankOut > -1e30),
    `the waterline is where the bed crosses the level: water at 140 m from the centre (${f(bankIn, 2)}), dry at 260 m (ground ${f(W6.terrainH(CX + 260, CZ), 1)} m)`);
  // and the renderer's own guard would now KEEP these samples (G460.11.7 takes the
  // median of the finite ones within 3 m of the level; all five are the level)
  const q = [[CX, CZ], [CX - 75, CZ], [CX + 75, CZ], [CX, CZ - 75], [CX, CZ + 75]].map(p => W6.waterH(p[0], p[1]));
  verdict(q.every(h => Number.isFinite(h) && Math.abs(h - LEVEL) < 3),
    `the renderer's five samples all survive its 3 m guard (${q.map(h => f(h, 2)).join(' ')}) - the drawn quad IS the physics' surface`);
}
// ON THIS BOX ONLY: the real island, if its files are here. bench/ is gitignored
// per machine, and a worktree has none of its own - absent, this says so and is
// not a red; FLYDIY_BENCH points it at the checkout that baked them.
{
  let W7 = null;
  try { W7 = require('./island_node.js').islandWorld('jolene'); } catch (e) { W7 = null; }
  if (!W7) console.log('   (Jolene\'s files are not on this box - the stub above is the whole of rule 6 here; FLYDIY_BENCH=<path> to add them)');
  else {
    const lakes = (W7.island.lakes || []).filter(L => L.level > 0.2 && L.cells >= 3);
    // (a) every lake whose own box gives a finite surface answers ITS OWN level
    let n = 0, bad = [], gone = 0;
    for (const L of lakes) {
      const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, qx = (L.x1 - L.x0) / 4, qz = (L.z1 - L.z0) / 4;
      const hs = [[cx, cz], [cx - qx, cz], [cx + qx, cz], [cx, cz - qz], [cx, cz + qz]]
        .map(p => W7.waterH(p[0], p[1])).filter(Number.isFinite).sort((a, b) => a - b);
      if (!hs.length) { gone++; continue; }   // a pond the 5-level quadtree smoothed away: its bed is over its own level
      const med = hs[hs.length >> 1];
      if (med === 0) continue;                // a coastal pool: the SEA answers, and the renderer skips it too
      n++; if (Math.abs(med - L.level) > 0.05) bad.push([L, med]);
    }
    // (b) THE HOVER, directly: over every point the cover calls water and whose
    // bed is under its lake's level, waterH may never stand ABOVE that level -
    // which is the defect, in the one sentence a floatplane cares about.
    let tot = 0, ok = 0, sea = 0, other = 0, over = 0, worst = 0;
    for (const L of lakes) for (let x = L.x0 + 5; x <= L.x1 - 5; x += 10) for (let z = L.z0 + 5; z <= L.z1 - 5; z += 10) {
      const t = W7.terrainH(x, z);
      if (t > L.level || W7.island.classAt(x, z) !== W7.island.WC.WATER) continue;
      tot++; const w = W7.waterH(x, z), d = w - L.level;
      if (Math.abs(d) <= 0.05) { ok++; continue; }
      if (d > 0.05) { over++; if (d > worst) worst = d; } else if (w === 0) sea++; else other++;
    }
    console.log(`   Jolene: ${n} lakes answer their own level, ${bad.length} do not; ${gone} ponds have no basin left in the quadtree (their bed is over their own level)`);
    console.log(`   ${tot} water points: ${ok} at their level (${f(100 * ok / Math.max(tot, 1), 2)} %), ${sea} answered the sea (a lagoon at the coast), ${other} a neighbouring record, ${over} ABOVE their level`);
    verdict(!bad.length, `every lake on Jolene answers its own declared level${bad.length ? ' - ' + bad.length + ' do not, worst ' + f(bad[0][1], 2) + ' vs ' + f(bad[0][0].level, 2) : ''}`);
    // NOTHING HOVERS. Two points of 73 203 do stand a little over their record:
    // where two boxes overlap and the smaller one is a pond above the lake, the
    // pond's level wins and the lake is 0.42 m under it. That is a bounding box
    // being a rectangle, not the rim coming back - the rim was 6 to 23 m and
    // thousands of points, which this bound catches on sight.
    verdict(over <= 10 && worst <= 0.5, `${over} of ${tot} water points stand above their own record, by at most ${f(worst, 2)} m (bound: 10 points and 0.5 m - overlapping boxes; the fill's rim was 6.09 m at Skaters Lake and 23.15 m at worst)`);
    verdict(ok / Math.max(tot, 1) > 0.97, `${f(100 * ok / Math.max(tot, 1), 2)} % of the island's lake water is exactly its record's level (bound 97 %; the rest is the coast, where the sea answers)`);
  }
}

// the runner reads the WHOLE verdict line (GATE <ID>: PASS), not the exit code
console.log(fails ? `\nGATE HYDRODYN: FAIL (${fails})` : '\nGATE HYDRODYN: PASS');
process.exit(fails ? 1 : 0);
