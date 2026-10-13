#!/usr/bin/env node
// GATE DMGTYRE (G1846, DMG-TYRE): THE TYRE'S SIDE FORCE IS ITS SLIP ANGLE'S. The wheel contact's side force was Coulomb
// friction regularised at 0.02 m/s at every speed (30_solver, `kL`): at 14 m/s a slip of 0.08 deg took the full mu N,
// so a rolling tyre had no cornering stiffness and a yawing aeroplane met no rate-proportional resistance from its
// wheels - the hidden 2 s angular damper G1885 removed had been the ground's only one, and the user's Cub ground-looped
// on a crosswind roll-out (PILOTMATRIX cub:HOME:x4, a 106-140 deg swing). G1844 makes it F = C_alpha tan(alpha),
// C_alpha = cN N (TYRE_CN, per unit load, by the build's wheel), linear until the same Coulomb limit mu N; below
// ~0.2 m/s of rolling the old law holds the wheel bit for bit. This gate, node only:
//   1. THE LAW, IN THE SOLVER: the Cub (a taildragger) and the metal Cessna (a tricycle) settled on flat ground in
//      vacuum (no air's side force), every node set to 10 m/s at a slip angle beta to the heading, one substep: the
//      ground's lateral impulse / dt over the weight, per tyre class (every wheel given the class's cN):
//      - zero at zero slip (|F|/W <= 1e-6);
//      - linear: where cN tan(beta) <= 0.6 mu, F/W = cN tan(beta) within 2 %;
//      - saturating: where cN tan(beta) >= 1.5 mu, F/W = mu (grass 0.8) within 1 %; never above mu, monotone in beta;
//      - a property of the slip, not the speed: at 2 deg, 5 and 20 m/s read 10 m/s's within 2 %;
//      - THE CONTROL, the pre-G1844 law (params.tyreCoulomb): at 10 m/s it reads >= 0.45 mu by 0.5 deg and mu by 1 deg
//        (the "before" this replaces).
//   2. PARKED 30 s: the Cub, the Jodel and the metal Cessna at HOME (the analytic world, calm), from the reset: over
//      the last 20 s the fastest node moves <= 2e-3 m/s horizontally and the CG drifts <= 5 mm (no jitter, no creep),
//      and the CG at 30 s is the control's (the old law) within 1 mm (the at-rest law is the old one).
//   3. THE CROSSWIND ROLL-OUT: the user's Cub (builds/cub_2026-09-20_corrected.json) flown by THE PILOT round HOME's
//      circuit (tools/pilot_trace.js, the matrix's instrument) in a steady 3, 4 and 5 m/s straight across the strip
//      (3 m/s: FAR 23.233's demonstrated 0.2 V_SO, ~3.4 m/s for a Cub, recalled; 5 m/s: normal practice for a
//      competent pilot), each on PILOTMATRIX's own bars: the landing completed, the roll-out's largest heading error
//      (`swing`) <= 15 deg (the matrix's line between warn and bad: no ground loop), its heading reversals <= 3 and
//      the touchdown <= 3 m off the centre line (the matrix's `good`). The tyre holds the aeroplane; the swing left
//      under 15 deg is the pilot's steady error against the weathercock with the tail up (HANDOVER G1845: 8-12 deg,
//      the pilot's P+D rudder has no anticipation of it - a PILOT question, not the tyre's). Three child processes,
//      in parallel with 1, 2 and 4. (The pre-G1844 tyre ground-loops: 106-140 deg in 3.5-4.5 m/s, DMG-DAMP's count.)
//   4. TAXI TURNS UNCHANGED IN FEEL: the Jodel (a taildragger) and the metal Cessna (a tricycle) on flat ground,
//      the throttle on a PI to 3 m/s, the rudder held at 0.2 and 0.4 from 3 s, 30 s: the radius over the last 10 s
//      (V / yaw rate) against the control's (the old law, which turned on the kinematic bicycle radius):
//      0.80 <= R / R_old <= 1.10, the same sense. Why that band: at a taxi steer of 4-11 deg a tyre's slip of ~1 deg
//      moves the radius 10-20 %, and the rudder in the prop wash now yaws the aeroplane against a finite cornering
//      stiffness (it could not against a 0.02 m/s Coulomb wall).
//   node tools/_dmgtyre_check.js [--show] [--json]      -> "GATE DMGTYRE: PASS|FAIL"
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const L = require(path.join(__dirname, '_treecrash_lib.js'));
const C = L.core();
const SHOW = process.argv.includes('--show');
const ROLL_BAR = 15, ROLL_REV = 3, ROLL_OFF = 3;
const CUB = path.join(__dirname, '..', 'builds', 'cub_2026-09-20_corrected.json');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; if (!ok || SHOW) console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const res = { slip: {}, parked: {}, rollout: {}, taxi: {} };

// 3 first: the roll-outs are the long pole, three children while this process does the rest
function trace(w) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(__dirname, 'pilot_trace.js'), CUB, '--wind', '0,' + w, '--quiet'],
                    { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => {
      const lines = out.trim().split('\n');
      try { resolve(JSON.parse(lines[lines.length - 1])); } catch (e) { resolve({ error: (err || out).slice(-300) || ('exit ' + code) }); }
    });
  });
}
const WINDS = [3, 4, 5];
const rolls = Promise.all(WINDS.map(trace));

// 1. THE LAW
const VAC = Object.assign({}, C.ATMOS_ISA, { rho: () => 1e-9, sigma: () => 1e-9 / C.ATMOS_ISA.rho(0) });
function settled(key, params) {
  const d = L.defOf(key, { elastic: true });
  Object.assign(d.params, params);
  const { W, strip } = L.flatWorld(0);
  const sim = C.makeSim(d, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
  sim.setAtmos(VAC, 0);
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const m = d.nodes.map(nd => nd.m);
  return { sim, m, M: m.reduce((a, b) => a + b, 0) };
}
function sideForce(R, V, bDeg) {
  const { sim, m, M } = R, P0 = Float64Array.from(sim.p), V0 = Float64Array.from(sim.v);
  const ax = sim.axes()[0], h = Math.hypot(ax[0], ax[2]), hx = ax[0] / h, hz = ax[2] / h, lx = -hz, lz = hx;
  const b = bDeg * Math.PI / 180, vx = V * (Math.cos(b) * hx + Math.sin(b) * lx), vz = V * (Math.cos(b) * hz + Math.sin(b) * lz);
  for (let i = 0; i < sim.n; i++) { sim.v[i*3] = vx; sim.v[i*3+2] = vz; }
  const Pl = () => { let s = 0; for (let i = 0; i < sim.n; i++) s += m[i] * (sim.v[i*3] * lx + sim.v[i*3+2] * lz); return s; };
  const p0 = Pl(), dt = 1 / 60 / 24;
  sim.step(dt, 1);
  const F = -(Pl() - p0) / dt;                        // the force OPPOSES the slip: read positive
  sim.p.set(P0); sim.v.set(V0);
  return F / (M * 9.81);
}
const MU = C.GROUND_SURF[0][2], BETAS = [0, 0.25, 0.5, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30, 45];
const CLASSES = [['cub', 'standard'], ['cub', 'tundra'], ['cub', 'slim'], ['cub', 'tailwheel'], ['metal', 'standard'], ['metal', 'nosewheel']];
for (const [key, cls] of CLASSES) {
  const cN = C.TYRE_CN[cls], R = settled(key, { tyre: { main: cN, tw: cN } }), lab = L.BUILDS[key].label + ' ' + cls + ' (cN ' + cN + ' /rad)';
  const row = BETAS.map(b => sideForce(R, 10, b));
  res.slip[key + ':' + cls] = { cN, beta: BETAS, FW: row };
  verdict(Math.abs(row[0]) <= 1e-6, `${lab}: zero slip, F/W = ${row[0].toExponential(1)} (<= 1e-6)`);
  let lin = 0, sat = 0, mono = true, nl = 0, ns = 0;
  BETAS.forEach((b, i) => {
    const t = cN * Math.tan(b * Math.PI / 180);
    if (b > 0 && t <= 0.6 * MU) { lin = Math.max(lin, Math.abs(row[i] / t - 1)); nl++; }
    if (t >= 1.5 * MU) { sat = Math.max(sat, Math.abs(row[i] / MU - 1)); ns++; }
    if (i && row[i] < row[i - 1] - 1e-9) mono = false;
    if (row[i] > MU * 1.001) mono = false;
  });
  verdict(nl >= 3 && lin <= 0.02, `${lab}: linear, F/W = cN tan(beta) at ${nl} slips to ${(100 * lin).toFixed(2)} % (<= 2 %)`);
  verdict(ns >= 2 && sat <= 0.01, `${lab}: saturated, F/W = mu ${MU} at ${ns} slips to ${(100 * sat).toFixed(2)} % (<= 1 %)`);
  verdict(mono, `${lab}: monotone in the slip, never above mu`);
  const s5 = sideForce(R, 5, 2), s10 = sideForce(R, 10, 2), s20 = sideForce(R, 20, 2);
  const sd = Math.max(Math.abs(s5 / s10 - 1), Math.abs(s20 / s10 - 1));
  verdict(sd <= 0.02, `${lab}: at 2 deg, 5 / 10 / 20 m/s read F/W ${s5.toFixed(4)} / ${s10.toFixed(4)} / ${s20.toFixed(4)} (the slip's, not the speed's: ${(100 * sd).toFixed(2)} %, <= 2 %)`);
}
{
  const R = settled('cub', { tyreCoulomb: true }), row = BETAS.map(b => sideForce(R, 10, b));
  res.slip['cub:coulomb'] = { cN: null, beta: BETAS, FW: row };
  verdict(row[2] >= 0.45 * MU && Math.abs(row[3] / MU - 1) <= 0.01,
    `CONTROL, the pre-G1844 law (Cub, 10 m/s): F/W ${row[2].toFixed(3)} at 0.5 deg (>= 0.45 mu), ${row[3].toFixed(3)} at 1 deg (= mu within 1 %)`);
}

// 2. PARKED 30 s at HOME
function parked(key, params) {
  const d = L.defOf(key, { elastic: true });
  Object.assign(d.params, params);
  const sim = C.makeSim(d, C.makeWorld()); sim.reset(0);
  let vMax = 0, c10 = null;
  for (let f = 1; f <= 1800; f++) {
    sim.step(1 / 60);
    if (f === 600) c10 = sim.cgPos();
    if (f > 600) for (let i = 0; i < sim.n; i++) vMax = Math.max(vMax, Math.hypot(sim.v[i*3], sim.v[i*3+2]));
  }
  const c = sim.cgPos();
  return { vMax, drift: Math.hypot(c[0] - c10[0], c[2] - c10[2]), c };
}
for (const key of ['cub', 'jodel', 'metal']) {
  const a = parked(key, {}), o = parked(key, { tyreCoulomb: true }), lab = L.BUILDS[key].label;
  const dOld = Math.hypot(a.c[0] - o.c[0], a.c[1] - o.c[1], a.c[2] - o.c[2]);
  res.parked[key] = { vMax: a.vMax, drift: a.drift, vMaxOld: o.vMax, driftOld: o.drift, dOld };
  verdict(a.vMax <= 2e-3 && a.drift <= 5e-3, `${lab} parked 30 s: the fastest node over the last 20 s ${(1e3 * a.vMax).toFixed(3)} mm/s (<= 2), the CG drift ${(1e3 * a.drift).toFixed(3)} mm (<= 5); the old law ${(1e3 * o.vMax).toFixed(3)} mm/s, ${(1e3 * o.drift).toFixed(3)} mm`);
  verdict(dOld <= 1e-3, `${lab} parked 30 s: the CG against the old law's ${(1e3 * dOld).toFixed(4)} mm (<= 1)`);
}

// 4. TAXI TURNS
function taxi(key, dr, params) {
  const d = L.defOf(key, { elastic: true });
  Object.assign(d.params, params);
  const { W, strip } = L.flatWorld(0);
  const sim = C.makeSim(d, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  let I = 0, turn = 0, Vs = 0, h0 = null;
  for (let f = 0; f < 1800; f++) {
    const v = sim.cgVel(), V = Math.hypot(v[0], v[2]), e = 3 - V;
    I += e / 60; sim.ctl.thr = Math.max(0, Math.min(1, 0.3 * e + 0.1 * I));
    sim.ctl.dr = f > 180 ? dr : 0;
    sim.step(1 / 60);
    const ax = sim.axes()[0], h = Math.atan2(ax[2], ax[0]);
    if (f >= 1200) { let dh = h - h0; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI; turn += dh; Vs += V; }
    h0 = h;
  }
  const r = turn / 10, V = Vs / 600;
  return { R: V / Math.abs(r), V, sense: Math.sign(r) };
}
for (const key of ['jodel', 'metal']) for (const dr of [0.2, 0.4]) {
  const a = taxi(key, dr, {}), o = taxi(key, dr, { tyreCoulomb: true }), g = L.defOf(key, { elastic: true }).spec.gear;
  const Lwb = Math.abs(g.twX - g.x), st = Math.abs(L.defOf(key, { elastic: true }).params.twSteer) * dr, Rk = Lwb / Math.tan(st);
  const k = a.R / o.R, lab = L.BUILDS[key].label;
  res.taxi[key + ':' + dr] = { R: a.R, Rold: o.R, Rkin: Rk, V: a.V, ratio: k };
  verdict(k >= 0.8 && k <= 1.1 && a.sense === o.sense, `${lab} taxi turn, rudder ${dr}: R ${a.R.toFixed(1)} m at ${a.V.toFixed(2)} m/s against the old law's ${o.R.toFixed(1)} m (x${k.toFixed(3)}, 0.80-1.10; the kinematic bicycle ${Rk.toFixed(1)} m)`);
}

rolls.then(rs => {
  rs.forEach((r, i) => {
    const w = WINDS[i];
    if (r.error) { verdict(false, `the Cub's crosswind roll-out at ${w} m/s: errored (${String(r.error).replace(/\s+/g, ' ').slice(0, 120)})`); return; }
    const e = r.rollout ? r.rollout.maxE : null, zx = r.rollout ? r.rollout.zeroX : null, off = r.landing ? Math.abs(r.landing.off) : null;
    res.rollout[w] = { outcome: r.outcome, maxE: e, zeroX: r.rollout && r.rollout.zeroX, maxDr: r.rollout && r.rollout.maxDr, sink: r.landing && r.landing.sink, off: r.landing && r.landing.off };
    verdict(r.outcome === 'completed' && e != null && e <= ROLL_BAR && zx <= ROLL_REV && off <= ROLL_OFF,
      `the Cub's crosswind roll-out at ${w} m/s across: ${r.outcome}, the heading's largest error ${e} deg (<= ${ROLL_BAR}), ${zx} reversals (<= ${ROLL_REV}), touchdown ${off} m off the centre line (<= ${ROLL_OFF}) at ${r.landing ? r.landing.sink : '-'} m/s, rudder peak ${r.rollout ? r.rollout.maxDr : '-'}`);
  });
  if (process.argv.includes('--json')) console.log('JSON ' + JSON.stringify(res));
  console.log(fails ? `GATE DMGTYRE: FAIL (${fails})` : 'GATE DMGTYRE: PASS');
  process.exit(fails ? 1 : 0);
});
