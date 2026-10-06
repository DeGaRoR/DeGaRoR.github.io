#!/usr/bin/env node
// GATE DMGHULL (G1849, DMG-HULL): THE HULL'S SIDE FORCE (G1847, 32_hydro.js hullSide) and what it does on the water.
// DMG-DAMP (G1885) took the solver's hidden 2 s angular damper out and read the twin on floats "water-looping" in a
// crosswind take-off at 2 m/s and from 4 m/s; its open question 2 asked for the hull's lift-type side force, which
// 32_hydro did not carry (the floats felt only the quadratic cross-flow sideways). G1847 adds it: slender-body, per
// station, -U d(m w)/dx with m = kSide (pi/2) rho T^2 on the keel's draft, the impulse shed where a section shrinks.
// This gate asserts the law and measures the water:
//   LAW (the rigid bench, each validated floatplane's own float, at the hump and on the step as the calm take-off
//        flies them):
//     - ZERO AT REST: no forward speed, any slip -> 0 N (the dock is the base's)
//     - ZERO DRY: the float a metre over the water -> 0 N
//     - LINEAR in the slip at a fixed speed (F(2v) = 2 F(v) within 1 % to 6 deg) and in the speed at a fixed slip
//       angle's tangent... (F(2U, v) = 2 F(U, v) within 1 %): linear in U x v
//     - THE SLENDER-BODY CLOSED FORM where the keel's draft grows to the step (on the step): F = kSide (pi/2) rho
//       T_step^2 U v within 2 % (the per-station walk telescopes to it; the instrument checks the code)
//     - SATURATING: the side term is U w = V^2 sin(b) cos(b) - its peak at 45 deg, nothing at 90 deg, where the side
//       panels' quadratic cross-flow (the base's) carries the whole lateral force. G2030: Jones' form holds at a FIXED
//       wetted hull - asserted as the side term over U w being the hull's constant at every slip angle whose wetted
//       keel is the small-slip one; a peak off 45 deg must come with the afterbody re-wetting as U = V cos b falls
//     - THE CENTRE OF PRESSURE on the step ahead of the step, on the wetted forebody; at the hump, reported
//   SWEEP (the SEAPLANE crosswind take-off: the SEA lane, THE PILOT, 0..5 m/s across in 0.5 m/s steps, the twin on
//        floats and the Cessna on floats, both as the game flies them - G2031): lift-off, the heading swing from the roll's own heading, |x| off the
//        lane, the lowest pitch on the water run; each failure CLASSED - a YAW water loop (the swing past 30 deg
//        with the nose up) or a NOSE-OVER (the pitch past -30 deg first: the bows bury at the plough and the heading
//        reads 180 deg once the nose has gone through the vertical - not a yaw).
//        Asserted: the Cessna on floats clean everywhere (no loop; swing and lane under 30); the twin clean over
//        0-1.5 m/s (the base's own clean band). The twin's failures past that - nose-overs at the plough and one yaw
//        swing - are NOT asserted: G1848's acceptance (no loop 0-5 m/s) is NOT met, and the gate prints every one,
//        classed, as OWED on every run (HANDOVER G1847-G1849, open questions 1 and 2).
//   KICK (a 0.3 rad/s yaw-rate kick about the body's up axis through the CG, the kicked run minus an unkicked one
//        from the same state, controls frozen, rudder neutral; at rest (settled, idle), at the hump and on the step
//        of the calm take-off): the yaw rate left after 1, 2 (and 6 at rest) s, three cores' worth on this one -
//        BEFORE (the pre-G1885 damper, params.defDampMean), AFTER (DMG-DAMP: kSide 0), NOW. Asserted: at rest NOW
//        decays no slower than AFTER (a spinning aeroplane's floats move ahead and astern a metre off the CG: the
//        term acts on that, and may only take yaw out). At the hump and on the step REPORTED: the term damps the yaw
//        rate and also turns the slip with its centre ahead of the CG - on the twin the second wins (OWED).
//   node tools/_dmghull_check.js [--show] [--json] [--only=law,sweep,kick] [--winds=0,1,2] [--evidence=<dir>]
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process'), os = require('os');
const ARGS = process.argv.slice(2);
const arg = (k, d) => { const a = ARGS.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const SHOW = ARGS.includes('--show');
const L = require(path.join(__dirname, '_treecrash_lib.js'));
const C = L.core();
const H = C.HYDRO;
const D2R = Math.PI / 180;

// ---- the builds: the two validated floatplanes AS THE GAME FLIES THEM (tools/_load_build.js `twinFloats` and
// `floats`, through _treecrash_lib's one table). G2031 (DMG-RECAL): the twin was the raw fixture (the file with
// gear.type 'floats', buildGen on it) - the pre-JOIN-PARITY aeroplane, which the game never flies (G1985: the join puts
// its drawn floats on it); FLYDIY_RAW_BUILDS=1 still flies the files as written, for a before/after ---------------
const BUILDS = { twin: 'twin on floats', cessna: 'Cessna on floats' };
function defOf(key, over) {
  let def = L.defOf(key === 'twin' ? 'twinFloats' : 'floats', { elastic: true });
  def = Object.assign({}, def, { params: Object.assign({}, def.params) });
  if (over && over.mode === 'before') def.params.defDampMean = true;
  if (over && over.mode === 'after') def.parts = Object.assign({}, def.parts, { floats: def.parts.floats.map(r => Object.assign({}, r, { P: Object.assign({}, r.P, { kSide: 0 }) })) });
  return def;
}

// ---- the flight instruments ---------------------------------------------------------------------------------------
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
// the mass-weighted rigid fit: CG, its velocity, w = I^-1 L (dmgdamp_evidence.js's)
function rigid(sim) {
  const m = sim.m; let M = 0, cx = 0, cy = 0, cz = 0, ux = 0, uy = 0, uz = 0;
  for (let i = 0; i < sim.n; i++) { const mi = m[i]; M += mi; cx += mi*sim.p[i*3]; cy += mi*sim.p[i*3+1]; cz += mi*sim.p[i*3+2]; ux += mi*sim.v[i*3]; uy += mi*sim.v[i*3+1]; uz += mi*sim.v[i*3+2]; }
  cx /= M; cy /= M; cz /= M; ux /= M; uy /= M; uz /= M;
  let Lx = 0, Ly = 0, Lz = 0, Sxx = 0, Syy = 0, Szz = 0, Sxy = 0, Sxz = 0, Syz = 0;
  for (let i = 0; i < sim.n; i++) {
    const mi = m[i], rx = sim.p[i*3] - cx, ry = sim.p[i*3+1] - cy, rz = sim.p[i*3+2] - cz, vx = sim.v[i*3] - ux, vy = sim.v[i*3+1] - uy, vz = sim.v[i*3+2] - uz;
    Lx += mi*(ry*vz - rz*vy); Ly += mi*(rz*vx - rx*vz); Lz += mi*(rx*vy - ry*vx);
    Sxx += mi*rx*rx; Syy += mi*ry*ry; Szz += mi*rz*rz; Sxy += mi*rx*ry; Sxz += mi*rx*rz; Syz += mi*ry*rz;
  }
  const a = Syy + Szz, b = Sxx + Szz, c = Sxx + Syy;
  const k0 = b*c - Syz*Syz, k1 = Sxy*c + Syz*Sxz, k2 = Sxy*Syz + b*Sxz, k4 = a*c - Sxz*Sxz, k5 = a*Syz + Sxy*Sxz, k8 = a*b - Sxy*Sxy;
  const det = a*k0 - Sxy*k1 - Sxz*k2;
  return { c: [cx, cy, cz], u: [ux, uy, uz], w: [(k0*Lx + k1*Ly + k2*Lz) / det, (k1*Lx + k4*Ly + k5*Lz) / det, (k2*Lx + k5*Ly + k8*Lz) / det] };
}
const yawRate = sim => dot(rigid(sim).w, sim.axes()[1]);
const pitchOf = sim => Math.asin(Math.max(-1, Math.min(1, -sim.axes()[0][1]))) / D2R;
const hdgOf = sim => { const xA = sim.axes()[0]; return Math.atan2(-xA[0], -xA[2]) / D2R; };
const wetOf = sim => sim.hydro.floats.reduce((a, x) => a + x.wet, 0) > 0;
function seaSim(def, wind) {
  const world = C.makeWorld();
  if (wind) world.setWind({ base: [wind, 0, 0], gust: 0 });
  const sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  return { sim, world, sea };
}

// ---- SWEEP: GATE SEAPLANE's crosswind take-off, measured and classed ------------------------------------------------
function crosswind(key, wind, mode, trace) {
  const def = defOf(key, { mode });
  const { sim, world, sea } = seaSim(def, wind);
  const ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea);
  const R = { key, wind, mode, lift: null, swing: 0, x: 0, skips: 0, pitchMin: 0, tSwing30: null, pitchAt30: null, tNose30: null, finite: true, tr: trace ? [] : null };
  let T = 0, wasWet = true, dryFrom = null, airborne = false, hRef = null;
  for (let s = 0; s < 120 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60); T += 1 / 60;
    const cg = sim.cgPos();
    if (!Number.isFinite(cg[0])) { R.finite = false; break; }
    const wet = wetOf(sim), hdg = hdgOf(sim), pit = pitchOf(sim);
    if (wet && !airborne) {
      if (ap.phase === 'ROLL' || ap.phase === 'LIFTOFF') {
        if (hRef == null) hRef = hdg;
        const d = ((hdg - hRef + 540) % 360) - 180;
        R.swing = Math.max(R.swing, Math.abs(d));
        if (R.tSwing30 == null && Math.abs(d) > 30) { R.tSwing30 = T; R.pitchAt30 = pit; }
        R.pitchMin = Math.min(R.pitchMin, pit);
        if (R.tNose30 == null && pit < -30) R.tNose30 = T;
      }
      R.x = Math.max(R.x, Math.abs(cg[0]));
    }
    if (R.tr && s % 6 === 0) { const v = sim.cgVel(); R.tr.push([+T.toFixed(2), +(hRef == null ? 0 : ((hdg - hRef + 540) % 360) - 180).toFixed(2), +pit.toFixed(2), +Math.hypot(v[0], v[2]).toFixed(2), wet ? 1 : 0]); }
    if (!wet && wasWet && T > 2 && !airborne) dryFrom = T;
    if (wet && !wasWet && dryFrom != null && !airborne) { R.skips++; dryFrom = null; }
    if (!wet && dryFrom != null && !airborne && T - dryFrom >= 2) { airborne = true; R.lift = dryFrom; }
    wasWet = wet;
    if (ap.phase === 'CLIMB') break;
  }
  // the class: a nose-over is the pitch past -30 deg on the water run before (or without) the swing past 30 deg
  R.noseOver = R.tNose30 != null && (R.tSwing30 == null || R.tNose30 <= R.tSwing30 + 0.05);
  R.yawLoop = R.tSwing30 != null && !R.noseOver;
  R.ok = R.finite && R.lift != null && R.swing < 30 && R.x < 30;
  return R;
}

// ---- KICK: the yaw-rate kick on the water ------------------------------------------------------------------------
// the state: at rest (placed, idle, settled 10 s) or the calm take-off flown by the pilot to V >= Vt; then the controls
// are frozen (rudder and aileron neutral) and the kicked run (0.3 rad/s about the body's up axis) is compared with the
// unkicked one from the same state, frame by frame - every run re-flies the same deterministic history
function kickRun(key, mode, where, kick, secs) {
  const def = defOf(key, { mode });
  const { sim, world, sea } = seaSim(def, 0);
  const Vs = def.params.gen.Vs, Vt = where === 'hump' ? 0.43 * Vs : where === 'step' ? 0.73 * Vs : 0;
  let ap = null;
  if (where !== 'rest') { ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea); }
  let T = 0;
  for (let s = 0; s < 60 * 60; s++) {
    if (ap) ap.update(1 / 60); else { sim.ctl.thr = 0; }
    sim.step(1 / 60); T += 1 / 60;
    const v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
    if (where === 'rest' ? T >= 10 : V >= Vt) break;
  }
  const ctl = Object.assign({}, sim.ctl); ctl.dr = 0; ctl.da = 0;
  const v0 = sim.cgVel(), V0 = Math.hypot(v0[0], v0[2]);
  if (kick) {
    const R = rigid(sim), up = sim.axes()[1];
    for (let i = 0; i < sim.n; i++) {
      const dv = cross(up.map(x => x * kick), [sim.p[i*3] - R.c[0], sim.p[i*3+1] - R.c[1], sim.p[i*3+2] - R.c[2]]);
      sim.v[i*3] += dv[0]; sim.v[i*3+1] += dv[1]; sim.v[i*3+2] += dv[2];
    }
  }
  const r = [yawRate(sim)], pit = [pitchOf(sim)];
  for (let f = 1; f <= secs * 60; f++) { Object.assign(sim.ctl, ctl); sim.step(1 / 60); r.push(yawRate(sim)); pit.push(pitchOf(sim)); }
  return { r, pit, V0, T0: T };
}
function kick(key, mode, where) {
  const secs = where === 'rest' ? 6 : 2;
  const A = kickRun(key, mode, where, 0, secs), B = kickRun(key, mode, where, 0.3, secs);
  const d = B.r.map((x, i) => x - A.r[i]);
  const at = s => d[Math.round(s * 60)] / d[0];
  let tHalf = null; for (let i = 1; i < d.length; i++) if (Math.abs(d[i]) <= 0.5 * Math.abs(d[0])) { tHalf = i / 60; break; }
  return { key, mode, where, V0: A.V0, T0: A.T0, r0: d[0], at1: at(1), at2: at(2), at6: where === 'rest' ? at(6) : null, tHalf,
           pitchMin: Math.min(...B.pit), d: d.filter((x, i) => i % 6 === 0).map(x => +x.toFixed(4)) };
}

// ---- LAW: the rigid bench ---------------------------------------------------------------------------------------
// the pose (the step keel's draft, the trim) each float flies at the hump and on the step of the calm take-off
function poses(key) {
  const def = defOf(key);
  const { sim, world, sea } = seaSim(def, 0);
  const ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea);
  const Vs = def.params.gen.Vs, want = [['hump', 0.43 * Vs], ['step', 0.73 * Vs]], out = {};
  for (let s = 0; s < 60 * 60 && want.length; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    const v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
    if (V >= want[0][1]) {
      const fx = sim.hydro.floats[0];
      out[want[0][0]] = { V, draft: fx.h - fx.out.W[fx.F.edge.K][1], trim: pitchOf(sim) };
      want.shift();
    }
  }
  return { P: def.parts.floats[0].P, poses: out };
}
function bench(P, draft, trimDeg, U, w, lift) {
  const F = H.makeFloat(P), S = H.makeBody(F, { trim: trimDeg, keelY: lift ? 1 : -draft }), out = H.makeScratch(F);
  S.v[0] = -U; S.v[1] = 0; S.v[2] = w;   // forward is -x; +z is the float frame's lateral axis (port)
  H.hydroForces(F, S, H.stillWater, out);
  // the step keel's draft and the slender-body closed form there
  const side = out.terms.side[2], panels = out.F[2] - side;
  return { side, panels, total: out.F[2], xcp: out.side.xcp, n: out.side.n, M: out.side.M, F, out };
}
function law(key) {
  const { P, poses: PO } = poses(key);
  const R = { key, P: { L: P.L, B: P.B, kSide: P.kSide }, poses: PO, checks: [], curves: {} };
  const chk = (ok, line) => R.checks.push({ ok, line });
  for (const where of ['hump', 'step']) {
    const ps = PO[where]; if (!ps) { chk(false, `${where}: the calm take-off never reached it`); continue; }
    const U = ps.V, dr = ps.draft, tr = ps.trim;
    const f = (u, w, lift) => bench(P, dr, tr, u, w, lift);
    // zero at rest, zero dry
    const r0 = f(0, 0.5), dry = f(U, 0.1 * U, true);
    chk(r0.side === 0, `${where}: at rest (U 0, slip 0.5 m/s) the side force is ${r0.side} N (0)`);
    chk(dry.side === 0 && dry.total === 0, `${where}: a metre over the water the side force is ${dry.side} N, the hull's ${dry.total} N (0, 0)`);
    // linear in v and in U
    const v1 = Math.tan(3 * D2R) * U, a = f(U, v1), b = f(U, 2 * v1), c = f(2 * U, v1);
    const lv = b.side / (2 * a.side), lu = c.side / (2 * a.side);
    chk(Math.abs(lv - 1) < 0.01, `${where}: F(2v) / 2F(v) = ${lv.toFixed(4)} at 3 -> 6 deg of slip (1 +- 1 %)`);
    chk(Math.abs(lu - 1) < 0.01, `${where}: F(2U) / 2F(U) = ${lu.toFixed(4)} at the same slip velocity (1 +- 1 %)`);
    // the closed form on the step keel's draft (exact where the keel's draft grows to the step and the afterbody is dry)
    const Tk = Math.max(0, a.out.d[a.F.edge.K]), cf = P.kSide * 0.5 * Math.PI * P.rho * Tk * Tk * U * v1;
    R[where] = { U, draft: dr, trim: tr, F3: a.side, panels3: a.panels, closed: cf, xcp: a.xcp, Mmax: a.M, Tstep: Tk };
    if (where === 'step') chk(Math.abs(Math.abs(a.side) / cf - 1) < 0.02, `step: ${Math.abs(a.side).toFixed(1)} N against the slender body's (pi/2) rho T^2 U v = ${cf.toFixed(1)} N on T = ${Tk.toFixed(3)} m (2 %)`);
    // the curve: 0..90 deg at V = U. Each point also carries the side term over U w (the slender body's m(TE): the
    // wetted keel's own constant) and the wetted keel (the keel stations under the water)
    const curve = [];
    const wetN = q => { let n = 0; for (const s of q.F.sta) if (q.out.d[s.K] > 0) n++; return n; };
    for (let deg = 0; deg <= 90; deg += 5) {
      const q = f(U * Math.cos(deg * D2R), U * Math.sin(deg * D2R)), uw = U * U * Math.cos(deg * D2R) * Math.sin(deg * D2R);
      curve.push([deg, +Math.abs(q.side).toFixed(2), +Math.abs(q.panels).toFixed(2), uw > 1e-9 ? Math.abs(q.side) / uw : null, wetN(q)]);
    }
    R.curves[where] = curve;
    const pk = curve.reduce((m, x) => x[1] > m[1] ? x : m, curve[0]);
    // G2030 (DMG-RECAL): JONES' FORM IS A STATEMENT AT A FIXED WETTED HULL. U w = V^2 sin b cos b peaks at 45 deg only
    // while the hull the water sees stays the same; the slip takes the forward speed off (U = V cos b), and a hull
    // whose step ventilates by the cavity number (2 g d / U^2) re-wets its afterbody as U falls, and a re-wetted stern
    // starts its own piece (G1847's law, as written). The game's Cessna on floats rides its hump 7 cm deeper than the
    // file's did (0.343 m against 0.274: the drawn hulls, G1985), and at 50 deg of slip (U 6.9 m/s) its afterbody is
    // back in the water: m(TE) +9 %, the peak at 50. So the law is asserted where it is a law - the side term over U w
    // is the hull's constant to 1 % at every slip angle whose wetted keel is the small-slip one - and its peak at 45
    // where that holds through 40-50 deg; where it does not, every departure from the constant must come with a
    // change of the wetted keel (the afterbody re-wetting), never on its own
    const k0 = curve[1][3], n0 = curve[1][4];
    const same = curve.filter(x => x[3] != null && x[4] === n0), dev = same.reduce((m, x) => Math.max(m, Math.abs(x[3] / k0 - 1)), 0);
    chk(same.length >= 3 && dev < 0.01, `${where}: the side term is U w x ${k0.toFixed(1)} kg/m (the wetted keel's m(TE)) to ${(100 * dev).toFixed(2)} % at the ${same.length} slip angles whose wetted keel is the small-slip one (${n0} stations; Jones' U w = V^2 sin b cos b, 1 %)`);
    const fixed4050 = curve.filter(x => x[0] >= 40 && x[0] <= 50).every(x => x[4] === n0);
    if (fixed4050) chk(pk[0] === 45, `${where}: the side term peaks at ${pk[0]} deg of slip (45: Jones' U w = V^2 sin b cos b, the wetted keel the same through 40-50 deg)`);
    else {
      const loose = curve.filter(x => x[3] != null && Math.abs(x[3] / k0 - 1) >= 0.01 && x[4] === n0);
      const reW = curve.find(x => x[4] !== n0 && x[0] > 0);
      chk(loose.length === 0, `${where}: the side term peaks at ${pk[0]} deg of slip - the afterbody re-wets from ${reW ? reW[0] : '-'} deg (${n0} -> ${reW ? reW[4] : '-'} keel stations wet as U falls to ${reW ? (U * Math.cos(reW[0] * D2R)).toFixed(1) : '-'} m/s), m(TE) up to x${Math.max(...curve.filter(x => x[3] != null).map(x => x[3] / k0)).toFixed(3)}; no departure from U w without it`);
    }
    chk(curve[curve.length - 1][1] < 1e-6 * pk[1] + 1e-9 && curve[curve.length - 1][2] > 0, `${where}: at 90 deg the side term is ${curve[curve.length - 1][1]} N and the cross-flow carries ${curve[curve.length - 1][2]} N`);
    if (where === 'step') chk(a.xcp < 0 && a.xcp > -P.xs, `step: the side force's centre ${a.xcp.toFixed(3)} m from the step (ahead of it, on the forebody: -${P.xs.toFixed(2)}..0)`);
  }
  return R;
}

// ---- child mode: one unit of work per process (the sweep's runs are minutes each) --------------------------------
const CHILD = arg('child', null);
if (CHILD) {
  const [what, key, a1, a2] = CHILD.split(':');
  let r;
  if (what === 'xw') r = crosswind(key, +a1, a2 || 'now', ARGS.includes('--trace'));
  else if (what === 'kick') r = kick(key, a1, a2);
  else if (what === 'law') r = law(key);
  process.stdout.write('RESULT ' + JSON.stringify(r) + '\n');
  process.exit(0);
}
function pool(jobs, n) {
  return new Promise(resolve => {
    const out = new Array(jobs.length); let next = 0, done = 0;
    const run = () => {
      if (next >= jobs.length) return;
      const i = next++;
      cp.execFile(process.execPath, [__filename, '--child=' + jobs[i].id].concat(jobs[i].trace ? ['--trace'] : []), { maxBuffer: 64 << 20 }, (err, so, se) => {
        const line = (so || '').split('\n').find(l => l.startsWith('RESULT '));
        out[i] = line ? JSON.parse(line.slice(7)) : { error: (se || String(err)).slice(-400), job: jobs[i].id };
        if (++done === jobs.length) resolve(out); else run();
      });
    };
    for (let k = 0; k < Math.min(n, jobs.length); k++) run();
  });
}

(async () => {
  const ONLY = arg('only', 'law,sweep,kick').split(',');
  const WINDS = arg('winds', '0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5').split(',').map(Number);
  const EVID = arg('evidence', null);
  const NPROC = Math.max(1, Math.min(+arg('procs', os.cpus().length), 8));
  let fails = 0;
  const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
  const res = {};
  const jobs = [];
  if (ONLY.includes('law')) for (const k of Object.keys(BUILDS)) jobs.push({ id: `law:${k}` });
  if (ONLY.includes('sweep')) for (const k of Object.keys(BUILDS)) for (const w of WINDS) jobs.push({ id: `xw:${k}:${w}:now`, trace: [2, 4, 5].includes(w) });
  if (ONLY.includes('kick')) for (const k of Object.keys(BUILDS)) for (const where of ['rest', 'hump', 'step']) for (const mode of ['before', 'after', 'now']) jobs.push({ id: `kick:${k}:${mode}:${where}` });
  const t0 = Date.now();
  const out = await pool(jobs, NPROC);
  const bad = out.filter(r => r.error);
  for (const b of bad) verdict(false, `child ${b.job} failed: ${b.error}`);
  const ok = out.filter(r => !r.error);

  if (ONLY.includes('law')) {
    console.log('LAW (the rigid bench: each build\'s own float at the hump and on the step of its calm take-off)');
    res.law = ok.filter(r => r.checks);
    for (const r of res.law) {
      for (const w of ['hump', 'step']) if (r[w]) console.log(`   ${BUILDS[r.key]} ${w}: V ${r[w].U.toFixed(1)} m/s, step keel ${r[w].draft.toFixed(3)} m deep, trim ${r[w].trim.toFixed(1)} deg; ` +
        `at 3 deg of slip the side force ${Math.abs(r[w].F3).toFixed(1)} N (the base's panels ${Math.abs(r[w].panels3).toFixed(1)} N), centre ${r[w].xcp.toFixed(3)} m from the step; slender body on the step keel ${r[w].closed.toFixed(1)} N`);
      for (const c of r.checks) verdict(c.ok, `${BUILDS[r.key]} ${c.line}`);
    }
  }
  if (ONLY.includes('sweep')) {
    console.log('\nSWEEP (GATE SEAPLANE\'s crosswind take-off, THE PILOT, the SEA lane; swing from the roll\'s own heading)');
    res.sweep = ok.filter(r => r.wind != null && r.mode);
    for (const k of Object.keys(BUILDS)) {
      const rows = res.sweep.filter(r => r.key === k).sort((a, b) => a.wind - b.wind);
      console.log(`   ${BUILDS[k]}:  wind | lift-off s | swing deg | |x| m | lowest pitch deg | skips | class`);
      for (const r of rows) console.log(`     ${r.wind.toFixed(1).padStart(4)} | ${r.lift == null ? '   -  ' : r.lift.toFixed(1).padStart(6)} | ${r.swing.toFixed(1).padStart(6)} | ${r.x.toFixed(1).padStart(6)} | ${r.pitchMin.toFixed(1).padStart(6)} | ${r.skips} | ${r.ok ? 'ok' : r.noseOver ? 'NOSE-OVER at the plough (pitch ' + r.pitchMin.toFixed(0) + ' deg)' : r.yawLoop ? 'YAW WATER LOOP' : 'FAIL'}`);
      const yaw = rows.filter(r => r.yawLoop), nose = rows.filter(r => r.noseOver);
      if (k === 'cessna') {
        verdict(yaw.length === 0, `${BUILDS[k]}: no yaw water loop at any crosswind 0-5 m/s`);
        verdict(rows.every(r => r.ok), `${BUILDS[k]}: every take-off off the water, swing and lane under 30 (worst ${Math.max(...rows.map(r => r.swing)).toFixed(1)} deg, ${Math.max(...rows.map(r => r.x)).toFixed(1)} m)`);
      } else {
        // THE TWIN IS NOT ASSERTED (G1848's acceptance is NOT met, HANDOVER G1847-G1849): its failures are printed on
        // every run, classed, so a change that fixes or worsens them shows here
        verdict(rows.filter(r => r.wind <= 1.5).every(r => r.ok), `${BUILDS[k]}: 0-1.5 m/s across clean (the base's clean band)`);
        if (yaw.length) console.log(`OWED ${BUILDS[k]}: YAW swing past 30 deg at ${yaw.map(r => r.wind + ' m/s (' + r.swing.toFixed(1) + ' deg)').join(', ')} - the side force's centre is ahead of the CG on the step (HANDOVER G1847-G1849, open question 2)`);
        if (nose.length) console.log(`OWED ${BUILDS[k]}: NOSE-OVER at the plough at ${nose.map(r => r.wind).join(', ')} m/s across (the bows bury at 6-7 m/s, the pitch past -30 deg; not a yaw loop - HANDOVER G1847-G1849, open question 1)`);
      }
    }
  }
  if (ONLY.includes('kick')) {
    console.log('\nKICK (0.3 rad/s of yaw rate on the water, kicked minus unkicked, controls frozen, rudder neutral)');
    res.kick = ok.filter(r => r.where);
    for (const k of Object.keys(BUILDS)) for (const where of ['rest', 'hump', 'step']) {
      const g = m => res.kick.find(r => r.key === k && r.where === where && r.mode === m);
      const B = g('before'), A = g('after'), N = g('now');
      if (!A || !N || !B) continue;
      const fmt = r => `${(r.at1 * 0.3).toFixed(3)} / ${(r.at2 * 0.3).toFixed(3)}${r.at6 != null ? ' / ' + (r.at6 * 0.3).toFixed(3) : ''} rad/s (t1/2 ${r.tHalf == null ? '>' + (where === 'rest' ? 6 : 2) : r.tHalf.toFixed(2)} s)`;
      console.log(`   ${BUILDS[k]} ${where} (V ${N.V0.toFixed(1)} m/s): after 1 / 2${where === 'rest' ? ' / 6' : ''} s - before ${fmt(B)}; after ${fmt(A)}; now ${fmt(N)}`);
      // at rest the floats are not at rest once the aeroplane spins: a metre each side of the CG, 0.3 rad/s drives
      // them 0.3 m/s ahead and astern, and the term acts on that (real); it may only take yaw rate out, never add it
      if (where === 'rest') verdict(Math.abs(N.at6) <= Math.abs(A.at6) + 1e-3 && Math.abs(N.at1) <= Math.abs(A.at1) + 1e-3, `${BUILDS[k]} at rest: the kick decays no slower than DMG-DAMP's after: ${(N.at6 * 0.3).toFixed(4)} against ${(A.at6 * 0.3).toFixed(4)} rad/s at 6 s`);
      // at speed the term both damps the yaw rate and turns the slip ahead of the CG (the slender body's Munk-type
      // N_v): which wins is the hull's attitude - REPORTED, not asserted (HANDOVER G1847-G1849, open question 2)
      else console.log(`${Math.abs(N.at1) < Math.abs(A.at1) ? 'NOTE' : 'OWED'} ${BUILDS[k]} ${where}: ${(N.at1 * 0.3).toFixed(3)} rad/s left after 1 s against ${(A.at1 * 0.3).toFixed(3)} without the side force (${Math.abs(N.at1) < Math.abs(A.at1) ? 'damped' : 'LESS stable: the centre ahead of the CG'})`);
    }
  }
  console.log(`\n(${jobs.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${NPROC} processes)`);
  if (EVID) { fs.mkdirSync(EVID, { recursive: true }); fs.writeFileSync(path.join(EVID, 'dmghull.json'), JSON.stringify(res)); }
  if (ARGS.includes('--json')) console.log('JSON ' + JSON.stringify(res));
  console.log(fails ? `GATE DMGHULL: FAIL (${fails})` : 'GATE DMGHULL: PASS');
  process.exit(fails ? 1 : 0);
})();
