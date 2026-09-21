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

// the runner reads the WHOLE verdict line (GATE <ID>: PASS), not the exit code
console.log(fails ? `\nGATE HYDRODYN: FAIL (${fails})` : '\nGATE HYDRODYN: PASS');
process.exit(fails ? 1 : 0);
