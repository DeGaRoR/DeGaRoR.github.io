#!/usr/bin/env node
// NODE-ACCEPT's detectors (the design: flydiy-notes/NODE-ACCEPT-DESIGN-2026-11-09.md section 3.3, Pilot 9 Nov). The user
// (via A0, 8 Nov): "it's frustrating to have a session declare that the plane flies really well, try it, and it
// absolutely doesn't fly" - so a node leg stops on the FIRST thing that would make the user say "it doesn't fly".
//
// A detector is { name, onFrame(ctx) -> null | { verdict, t, what } }, called every step by _tour_lib flyLeg through
// opts.detectors; the first verdict ends the leg. ctx = { sim, ap, t, legName, surface: 'land' | 'water', base }, base
// frozen at the leg's start: { pitch0, D0 (a copy of the damage record), gear: 'tail' | 'tri' | 'float' | 'hull' }.
// A detector may keep `warnings` ([{ t, what }]): listed on the leg, never an end.
//
// Each detector here is made by a factory that takes the run's env { W, def } (the world: the ground and water under a
// node; the def: the nodes' radii) - a fresh one per leg (they keep state). `make(env)` makes every one of this file.
//
// SEAPLANES' three, then Pilot's five (below; make() runs noseOver first - a flip over the nose is a noseOver):
//   capsize      the up axis under cos 60 deg (roll or pitch past 60) with any node touching the ground or the water;
//                a 30 deg roll on the surface is a warning only
//   propStrike   damage().propStrike turns true (not already in base.D0)
//   gearAtTouch  the first touch after >= 1 s clear of every surface, with the retractable gear the wrong way for the
//                surface under it: DOWN on the water (the amphibian's classic accident - it trips and flips, the user's
//                Petrel photo 1) or UP on land (the forgotten gear - a belly landing is not a pass, C8). A fixed gear
//                (sim.gear() null) never fires
//   porpoise     (later: the name reserved)
// Run: node tools/_accept_detect.js --selftest      (each detector fires on a forced case and stays quiet on a clean one)
'use strict';
const COS60 = 0.5, COS30 = Math.cos(30 * Math.PI / 180), TOUCH = 0.05;

// the surface under (x, z): the water's when it stands over the ground there
function surfaceH(W, x, z) {
  const g = W.terrainH(x, z), w = typeof W.waterH === 'function' ? W.waterH(x, z) : -Infinity;
  return Number.isFinite(w) && w > g ? { h: w, water: true } : { h: g, water: false };
}
// the lowest node's clearance over the surface under it (its radius taken off), and whether that surface is water
function lowest(sim, W, def) {
  let best = { c: Infinity, water: false, i: -1 };
  for (let i = 0; i < sim.n; i++) {
    const x = sim.p[i * 3], y = sim.p[i * 3 + 1], z = sim.p[i * 3 + 2];
    const r = (def && def.nodes && def.nodes[i] && def.nodes[i].r) || 0, S = surfaceH(W, x, z), c = y - r - S.h;
    if (c < best.c) best = { c, water: S.water, i };
  }
  return best;
}
// touching: a contact the solver counts (a wheel, a wet float or hull) or a node within 5 cm of the surface
function touching(sim, W, def) {
  if (sim.wheelsOnGround && sim.wheelsOnGround() > 0) return true;
  return lowest(sim, W, def).c < TOUCH;
}
const r1 = v => Math.round(v * 10) / 10;
const deg = v => Math.round(v * 180 / Math.PI);

function capsize(env) {
  const { W, def } = env;
  let warned = false, leg = null;
  const d = { name: 'capsize', warnings: [] };
  d.onFrame = ctx => {
    if (ctx.legName !== leg) { leg = ctx.legName; warned = false; }
    if (env.noseArmed) return null;   // (Pilot: a flip over the nose is noseOver's)
    const up = ctx.sim.axes()[1][1];
    if (up >= COS30) return null;
    if (!touching(ctx.sim, W, def)) return null;   // (aerobatics in the air are not a capsize)
    if (up < COS60) return { verdict: 'capsize', t: r1(ctx.t), what: 'the up axis ' + deg(Math.acos(Math.max(-1, Math.min(1, up)))) + ' deg off the vertical, touching the ' + ctx.surface + (ctx.ap && ctx.ap.phase ? ' (' + ctx.ap.phase + ')' : '') };
    if (!warned) { warned = true; d.warnings.push({ t: r1(ctx.t), what: 'tilted ' + deg(Math.acos(up)) + ' deg on the ' + ctx.surface }); }
    return null;
  };
  return d;
}

function propStrike(env) {
  return { name: 'propStrike', onFrame: ctx => {
    if (env && env.noseArmed) return null;   // (Pilot: the strike in a nose-over is noseOver's)
    const D = ctx.sim.damage ? ctx.sim.damage() : null;
    if (!D || !D.propStrike || (ctx.base && ctx.base.D0 && ctx.base.D0.propStrike)) return null;
    return { verdict: 'propStrike', t: r1(ctx.t), what: 'the propeller struck' + (D.propAt ? ' (' + D.propAt.what + ', engine ' + D.propAt.eng + ')' : '') + ' on the ' + ctx.surface };
  } };
}

function gearAtTouch(env) {
  const { W, def } = env;
  let clear = 0, leg = null, tPrev = null;
  return { name: 'gearAtTouch', onFrame: ctx => {
    const G = ctx.sim.gear ? ctx.sim.gear() : null;
    if (!G) return null;                                                          // a fixed gear: nothing to forget
    if (ctx.legName !== leg) { leg = ctx.legName; clear = 0; tPrev = null; }
    const dt = tPrev === null ? 0 : Math.max(0, ctx.t - tPrev); tPrev = ctx.t;
    if (!touching(ctx.sim, W, def)) { clear += dt; return null; }
    const was = clear; clear = 0;
    if (was < 1) return null;                                                     // not a touchdown: still on the surface
    const cg = ctx.sim.cgPos(), water = surfaceH(W, cg[0], cg[2]).water, down = G.pos > 0.5;
    if (water && down) return { verdict: 'gearAtTouch', t: r1(ctx.t), what: 'touched the WATER with the gear DOWN (pos ' + G.pos.toFixed(2) + ')' };
    if (!water && !down) return { verdict: 'gearAtTouch', t: r1(ctx.t), what: 'touched LAND with the gear UP (pos ' + G.pos.toFixed(2) + ', a belly landing)' };
    return null;
  } };
}


// ---- Pilot's five (the design 3.3; noseOver agreed with Deform 9 Nov: DMG.noseAt is the one contact test, Deform's) ----
const D2R = Math.PI / 180;
const vg = sim => { const v = sim.cgVel ? sim.cgVel() : [0, 0, 0]; return Math.hypot(v[0], v[2]); };
// the nose's pitch from the body axes, UNWRAPPED past the vertical (a Cub at 18 m/s goes right over: an asin reads back)
function pitchOf(sim) {
  const A = sim.axes(), nx = -A[0][0], ny = -A[0][1], nz = -A[0][2], h = Math.hypot(nx, nz);
  return Math.atan2(ny, (A[1][1] < 0 ? -1 : 1) * h);
}
const taxiLeg = n => /^(taxi|fastTaxi|waterTaxi)/.test(n || '');

// groundLoop: on land, the nose off the ground track - over 30 deg at Vg > 5 m/s (a taxi leg: 45 deg at Vg > 3), held 0.25 s
function groundLoop(env) {
  const { W, def } = env; let leg = null, since = null;
  return { name: 'groundLoop', onFrame: ctx => {
    if (ctx.legName !== leg) { leg = ctx.legName; since = null; }
    const sim = ctx.sim, taxi = taxiLeg(ctx.legName), lim = (taxi ? 45 : 30) * D2R, vMin = taxi ? 3 : 5;
    if (ctx.surface !== 'land' || !touching(sim, W, def)) { since = null; return null; }
    const v = sim.cgVel ? sim.cgVel() : [0, 0, 0], V = Math.hypot(v[0], v[2]);
    if (V <= vMin) { since = null; return null; }
    const A = sim.axes(), nh = Math.atan2(-A[0][2], -A[0][0]), th = Math.atan2(v[2], v[0]);
    let e = Math.abs(nh - th); if (e > Math.PI) e = 2 * Math.PI - e;
    if (e <= lim) { since = null; return null; }
    if (since === null) since = ctx.t;
    if (ctx.t - since < 0.25) return null;
    return { verdict: 'groundLoop', t: r1(ctx.t), what: 'the nose ' + deg(e) + ' deg off the track at ' + r1(V) + ' m/s (' + (ctx.ap && ctx.ap.phase) + ')' };
  } };
}

// noseOver (with Deform): ARMED on the ground at pitch < pitch0 - 12 deg; the window runs to the pitch's minimum or 1.5 s.
//   noseOver            DMG.noseAt appears in the window (what = its what; the delay from arming printed)
//   noseOver-undamaged  the window ends with no noseAt AND the nose really got down: pitch < pitch0 - 15 deg or the disc's
//                       gapMin under 5 cm (fallen in the window) - the user's STOL Cub (9 Nov), red until Deform's fix
//   else                a warning only (the Cub braked stick-back from 18 m/s: 12.1 deg below, the disc 22 cm clear)
// While armed, capsize and propStrike stay quiet (env.noseArmed): a flip over the nose is a noseOver.
// pitch0: this detector's own, the attitude at the leg's first frame (every leg starts parked or stopped).
// noseAt is set ONCE a flight: one already there at the leg's start is not this leg's - then the disc's gap is the evidence.
// THE HORIZON FLOOR (Pilot): a taildragger's take-off roll lifts the tail from the three-point attitude to about level -
// a Jodel or a Stearman parked at 12-13 deg is "12 below parked" in an ordinary tail-up roll. So it arms only with the
// nose also under ARM_FLOOR (-3 deg), and "really down" also needs DOWN_FLOOR (-6 deg): the Cub (parked 7.2) is unchanged
// (-4.8 / -7.8 are below both), a tricycle (parked ~0) too.
const ARM_FLOOR = -3 * D2R, DOWN_FLOOR = -6 * D2R;
function noseOver(env) {
  const { W, def } = env; let leg = null, p0 = null, arm = null, pMin = 0, nose0 = null, gap0 = Infinity;
  const gapNow = sim => { const D = sim.damage ? sim.damage() : null; const d = D && D.drive && D.drive[0]; return d && Number.isFinite(d.gapMin) ? d.gapMin : Infinity; };
  const d = { name: 'noseOver', warnings: [] };
  d.onFrame = ctx => {
    const sim = ctx.sim, D = sim.damage ? sim.damage() : null;
    if (ctx.legName !== leg) { leg = ctx.legName; p0 = pitchOf(sim); arm = null; env.noseArmed = false; nose0 = D && D.noseAt ? D.noseAt : null; }
    const p = pitchOf(sim);
    if (arm === null) {
      if (ctx.surface !== 'land' || p >= Math.min(p0 - 12 * D2R, ARM_FLOOR) || !touching(sim, W, def)) return null;
      arm = ctx.t; pMin = p; gap0 = gapNow(sim); env.noseArmed = true;
    }
    if (p < pMin) pMin = p;
    const nA = D && D.noseAt && D.noseAt !== nose0 ? D.noseAt : null;
    if (nA) return { verdict: 'noseOver', t: r1(ctx.t), what: 'nosed over: ' + nA.what + ' on the ' + (nA.surf || ctx.surface) + ' (tier ' + nA.tier + '), ' + r1(ctx.t - arm) + ' s after the nose passed 12 deg below parked; pitch ' + deg(pMin) + ' deg (parked ' + deg(p0) + ')' };
    const ended = ctx.t - arm >= 1.5 || p > pMin + 0.5 * D2R;
    if (!ended) return null;
    const g = gapNow(sim), down = pMin < Math.min(p0 - 15 * D2R, DOWN_FLOOR) || (g < 0.05 && g < gap0);
    const gs = Number.isFinite(g) ? Math.round(g * 100) + ' cm' : '?';
    if (down) return { verdict: 'noseOver-undamaged', t: r1(ctx.t), what: 'the nose went down (pitch ' + deg(pMin) + ' deg, parked ' + deg(p0) + ', disc gap ' + gs + ') with NO nose contact in the damage record' + (nose0 ? ' (noseAt was already set before this leg)' : '') };
    d.warnings.push({ t: r1(ctx.t), what: 'nose low ' + deg(p0 - pMin) + ' deg below parked, disc ' + gs + ' clear' });
    arm = null; env.noseArmed = false;
    return null;
  };
  return d;
}

// tailStrike: a tricycle on land - a node aft of the mains by > 0.5 m (no wheel) within 5 cm of the ground
function tailStrike(env) {
  const { W, def } = env;
  return { name: 'tailStrike', onFrame: ctx => {
    if (!ctx.base || ctx.base.gear !== 'tri' || ctx.surface !== 'land') return null;
    const sim = ctx.sim, R = def && def.refs; if (!R || !R.mains || !R.mains.length) return null;
    const skip = new Set([...R.mains, R.tw].filter(i => i >= 0));
    let mx = 0, mz = 0; for (const i of R.mains) { mx += sim.p[i * 3]; mz += sim.p[i * 3 + 2]; } mx /= R.mains.length; mz /= R.mains.length;
    const A = sim.axes(), ax = A[0][0], az = A[0][2], al = Math.hypot(ax, az) || 1;   // +x body = aft
    for (let i = 0; i < sim.n; i++) {
      if (skip.has(i)) continue;
      const x = sim.p[i * 3], y = sim.p[i * 3 + 1], z = sim.p[i * 3 + 2];
      if (((x - mx) * ax + (z - mz) * az) / al < 0.5) continue;
      const r = (def.nodes && def.nodes[i] && def.nodes[i].r) || 0;
      if (y - r - surfaceH(W, x, z).h < TOUCH) return { verdict: 'tailStrike', t: r1(ctx.t), what: 'node ' + i + ' (aft of the mains) on the ground in ' + (ctx.ap && ctx.ap.phase) };
    }
    return null;
  } };
}

// yield: a member yields (more than at the leg's start)
function yieldDet() {
  return { name: 'yield', onFrame: ctx => {
    const D = ctx.sim.damage ? ctx.sim.damage() : null, y0 = ctx.base && ctx.base.D0 ? ctx.base.D0.yields || 0 : 0;
    if (!D || !(D.yields > y0)) return null;
    return { verdict: 'yield', t: r1(ctx.t), what: (D.yields - y0) + ' member(s) yielded' + (D.firstYield ? ' (first: beam ' + D.firstYield.beam + ', ' + D.firstYield.cls + ')' : '') };
  } };
}

// stuck: Vg < 0.3 m/s for 20 s with the throttle over 0.5, outside HOLD / STOP / STOPPED
function stuck() {
  let leg = null, since = null;
  return { name: 'stuck', onFrame: ctx => {
    if (ctx.legName !== leg) { leg = ctx.legName; since = null; }
    const ph = ctx.ap && ctx.ap.phase, thr = ctx.sim.ctl ? ctx.sim.ctl.thr : 0;
    if (ph === 'HOLD' || ph === 'STOP' || ph === 'STOPPED' || !(thr > 0.5) || vg(ctx.sim) >= 0.3) { since = null; return null; }
    if (since === null) since = ctx.t;
    if (ctx.t - since < 20) return null;
    return { verdict: 'stuck', t: r1(ctx.t), what: 'not moving for 20 s at throttle ' + thr.toFixed(2) + ' in ' + ph };
  } };
}

// the order matters: noseOver first (it arms before the nose reaches capsize's 60 deg or the disc the ground)
const FACTORIES = { noseOver, capsize, propStrike, gearAtTouch, groundLoop, tailStrike, yield: yieldDet, stuck };
// every detector of this file, fresh, for one leg
const make = (env, names) => (names || Object.keys(FACTORIES)).map(k => FACTORIES[k](env));

module.exports = { FACTORIES, make, capsize, propStrike, gearAtTouch, noseOver, groundLoop, tailStrike, yieldDet, stuck, pitchOf, touching, lowest, surfaceH };

// ---- the selftest: forced cases on a FAKE sim (a box of 4 nodes; no flight, milliseconds). The forced cases on a real
// sim (a sim tipped 70 deg, a prop node in the ground) belong to Pilot's runner selftest (section 3.3)
if (require.main === module && process.argv.includes('--selftest')) {
  let fails = 0;
  const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
  // the world: the ground at 0 for x < 100, the water at 0.0 over a bed at -3 for x >= 100
  const W = { terrainH: x => (x < 100 ? 0 : -3), waterH: x => (x < 100 ? -Infinity : 0) };
  const def = { nodes: [{ r: 0.1 }, { r: 0.1 }, { r: 0.1 }, { r: 0.1 }] };
  const fake = o => {
    const y0 = o.y == null ? 0.1 : o.y, x0 = o.x || 0;
    return { n: 4, p: [x0, y0, 0, x0 + 1, y0, 0, x0, y0 + 1, 0, x0, y0, 1], up: o.up == null ? 1 : o.up,
      axes() { const u = this.up; return [[1, 0, 0], [0, u, Math.sqrt(Math.max(0, 1 - u * u))], [0, 0, 1]]; },
      wheelsOnGround: () => 0, cgPos() { return [this.p[0], this.p[1], this.p[2]]; },
      damage: () => o.D || { propStrike: false }, gear: () => (o.gear == null ? null : { pos: o.gear }) };
  };
  const ctx = (sim, t, surface, extra) => Object.assign({ sim, ap: { phase: 'TAXI' }, t, legName: 'leg1', surface, base: { pitch0: 0, D0: { propStrike: false }, gear: 'hull' } }, extra || {});
  console.log('capsize');
  { const d = capsize({ W, def }); check(d.onFrame(ctx(fake({ up: Math.cos(70 / 57.3) }), 1, 'water')) && true, 'tipped 70 deg on the ground: capsize'); }
  { const d = capsize({ W, def }); check(d.onFrame(ctx(fake({ up: Math.cos(70 / 57.3), y: 50 }), 1, 'land')) === null, 'tipped 70 deg 50 m up: nothing (in the air)'); }
  { const d = capsize({ W, def }); const v = d.onFrame(ctx(fake({ up: Math.cos(40 / 57.3) }), 1, 'land')); check(v === null && d.warnings.length === 1, 'tilted 40 deg on the ground: a warning, no verdict'); }
  { const d = capsize({ W, def }); check(d.onFrame(ctx(fake({ up: 1 }), 1, 'land')) === null, 'upright: nothing'); }
  { const d = capsize({ W, def }); check(!!d.onFrame(ctx(fake({ up: -1, x: 120, y: 0.05 }), 1, 'water')), 'on its back in the water: capsize'); }
  console.log('propStrike');
  { const d = propStrike(); check(!!d.onFrame(ctx(fake({ D: { propStrike: true, propAt: { what: 'ground', eng: 0 } } }), 3, 'land')), 'the flag turns true: propStrike'); }
  { const d = propStrike(); check(d.onFrame(ctx(fake({ D: { propStrike: true } }), 3, 'land', { base: { D0: { propStrike: true } } })) === null, 'already struck before the leg: nothing'); }
  { const d = propStrike(); check(d.onFrame(ctx(fake({}), 3, 'land')) === null, 'no strike: nothing'); }
  console.log('gearAtTouch');
  const flyThenTouch = (d, x, gear) => { let v = null;
    for (let k = 0; k < 120 && !v; k++) v = d.onFrame(ctx(fake({ x, y: 30, gear }), k / 60, 'water'));   // 2 s clear
    return v || d.onFrame(ctx(fake({ x, y: 0.12, gear }), 2.1, x >= 100 ? 'water' : 'land')); };
  check(!!flyThenTouch(gearAtTouch({ W, def }), 120, 1), 'touches the water with the gear down: gearAtTouch');
  check(flyThenTouch(gearAtTouch({ W, def }), 120, 0) === null, 'touches the water with the gear up: nothing');
  check(!!flyThenTouch(gearAtTouch({ W, def }), 0, 0), 'touches land with the gear up: gearAtTouch (a belly landing)');
  check(flyThenTouch(gearAtTouch({ W, def }), 0, 1) === null, 'touches land with the gear down: nothing');
  check(flyThenTouch(gearAtTouch({ W, def }), 120, null) === null, 'a fixed gear: nothing');
  { const d = gearAtTouch({ W, def }); let v = null; for (let k = 0; k < 300 && !v; k++) v = d.onFrame(ctx(fake({ x: 120, y: 0.12, gear: 1 }), k / 60, 'water'));
    check(v === null, 'taxiing on the water with the gear down, never clear: nothing (not a touchdown)'); }
  // ---- Pilot's five: a second fake with a pitch and a heading (deg), the mains (0, 1), the nosewheel (2), a tail node (3)
  const NOSE_AT = { t: 1, what: 'spinner', surf: 'soft', bite: 0.02, tier: 1 };
  const def2 = { refs: { mains: [0, 1], tw: 2 }, nodes: [{ r: 0 }, { r: 0 }, { r: 0 }, { r: 0 }] };
  const fk = o => {
    const p = (o.pitch || 0) * D2R, ps = (o.psi || 0) * D2R, y = o.y == null ? 0 : o.y, ty = o.tailY == null ? y + 0.6 : o.tailY;
    const n = [Math.cos(p) * Math.cos(ps), Math.sin(p), Math.cos(p) * Math.sin(ps)], up = [-Math.sin(p) * Math.cos(ps), Math.cos(p), -Math.sin(p) * Math.sin(ps)];
    return { n: 4, p: [0, y, 0.5, 0, y, -0.5, 1.5, y, 0, -3, ty, 0],
      axes: () => [[-n[0], -n[1], -n[2]], up, [0, 0, 1]], wheelsOnGround: () => 0, cgPos: () => [0, y, 0], cgVel: () => o.v || [0, 0, 0],
      ctl: { thr: o.thr == null ? 0 : o.thr }, damage: () => o.D || { propStrike: false, yields: 0 }, gear: () => null };
  };
  const cx2 = (sim, t, o) => Object.assign({ sim, ap: { phase: (o && o.phase) || 'ROLLOUT' }, t, legName: (o && o.leg) || 'circuit', surface: (o && o.surface) || 'land',
    base: { pitch0: 0, D0: (o && o.D0) || { propStrike: false, yields: 0 }, gear: (o && o.gear) || 'tail' } }, {});
  // a nose-down roll: pitch from 7 deg (parked) to `to`, 0.02 s a frame, `D(k)` the damage record at frame k; the dets run in order
  const pitchRun = (dets, to, D, extra) => { let v = null; const N = 200;
    for (let k = 0; k <= N && !v; k++) {
      const p0 = (extra && extra.from) || 7, pt = k < N / 2 ? p0 + (to - p0) * k / (N / 2) : to + 2 * (k - N / 2) / N;   // down, then a little back
      const sim = fk(Object.assign({ pitch: pt, D: D(k) }, extra || {}));
      for (const d of dets) { v = d.onFrame(cx2(sim, k * 0.02)); if (v) break; }
    } return v; };
  const drv = gap => [{ gapMin: gap }];
  console.log('pitchOf');
  check(Math.abs(pitchOf(fk({ pitch: -120 })) / D2R + 120) < 0.01, 'past the vertical: -120 deg reads -120 (unwrapped)');
  check(Math.abs(pitchOf(fk({ pitch: 7, psi: 130 })) / D2R - 7) < 0.01, 'any heading: 7 deg reads 7');
  console.log('noseOver');
  { const v = pitchRun([noseOver({ W, def: def2 })], -10, k => ({ yields: 0, drive: drv(0.2), noseAt: k > 80 ? NOSE_AT : undefined }));
    check(v && v.verdict === 'noseOver' && /spinner/.test(v.what), 'down 17 deg, noseAt in the window: noseOver (' + (v && v.what) + ')'); }
  { const v = pitchRun([noseOver({ W, def: def2 })], -10, () => ({ yields: 0, drive: drv(0.2) }));
    check(v && v.verdict === 'noseOver-undamaged', 'down 17 deg, no noseAt: noseOver-undamaged (the user\'s STOL Cub)'); }
  { const v = pitchRun([noseOver({ W, def: def2 })], -6, k => ({ yields: 0, drive: drv(k > 95 ? 0.03 : 0.3) }));
    check(v && v.verdict === 'noseOver-undamaged', 'down 13 deg but the disc 3 cm from the ground, no noseAt: noseOver-undamaged'); }
  { const d = noseOver({ W, def: def2 }); const v = pitchRun([d], -5.5, () => ({ yields: 0, drive: drv(0.22) }));
    check(v === null && d.warnings.length >= 1, 'down 12.5 deg, the disc 22 cm clear: a warning only (Deform\'s stick-back Cub)'); }
  { const v = pitchRun([noseOver({ W, def: def2 })], -10, () => ({ yields: 0, drive: drv(0.2) }), { y: 30 });
    check(v === null, 'nose down 50 m up: nothing (in the air)'); }
  { const d = noseOver({ W, def: def2 }); const v = pitchRun([d], -1.5, () => ({ yields: 0, drive: drv(0.4) }), { from: 13 });
    check(v === null && d.warnings.length === 0, 'parked at 13 deg, the tail-up roll to -1.5 (14.5 below): nothing (the horizon floor)'); }
  { const v = pitchRun([noseOver({ W, def: def2 })], -9, () => ({ yields: 0, drive: drv(0.4) }), { from: 13 });
    check(v && v.verdict === 'noseOver-undamaged', 'parked at 13 deg, down to -9 (22 below, under -6): noseOver-undamaged'); }
  { const old = NOSE_AT; const v = pitchRun([noseOver({ W, def: def2 })], -10, () => ({ yields: 0, drive: drv(0.2), noseAt: old }));
    check(v && v.verdict === 'noseOver-undamaged' && /already set/.test(v.what), 'noseAt set before the leg is not this leg\'s: undamaged, said'); }
  { const env = { W, def: def2 }; const dets = make(env); const v = pitchRun(dets, -120, k => (k > 80 ? { yields: 0, drive: drv(0), propStrike: true, propAt: { what: 'ground', eng: 0 } } : { yields: 0, drive: drv(0.2), propStrike: false }));
    check(v && /^noseOver/.test(v.verdict), 'right over onto its back, the prop struck: noseOver first, not capsize / propStrike (' + (v && v.verdict) + ')'); }
  console.log('groundLoop');
  const hold = (d, o, n) => { let v = null; for (let k = 0; k < n && !v; k++) v = d.onFrame(cx2(fk(o), k / 60, o)); return v; };
  check(hold(groundLoop({ W, def: def2 }), { psi: 0, v: [10, 0, 0] }, 60) === null, 'the nose on the track at 10 m/s: nothing');
  check(!!hold(groundLoop({ W, def: def2 }), { psi: 40, v: [10, 0, 0] }, 30), 'the nose 40 deg off the track at 10 m/s, 0.5 s: groundLoop');
  check(hold(groundLoop({ W, def: def2 }), { psi: 40, v: [10, 0, 0] }, 10) === null, 'the same for 0.17 s: nothing yet (0.25 s held)');
  check(hold(groundLoop({ W, def: def2 }), { psi: 40, v: [10, 0, 0], leg: 'fastTaxi' }, 60) === null, 'a taxi leg at 40 deg: nothing (45 there)');
  check(hold(groundLoop({ W, def: def2 }), { psi: 40, v: [4, 0, 0] }, 60) === null, '40 deg at 4 m/s on a circuit leg: nothing (5 m/s)');
  check(hold(groundLoop({ W, def: def2 }), { psi: 40, v: [10, 0, 0], surface: 'water' }, 60) === null, 'on the water: nothing (land only)');
  console.log('tailStrike');
  check(!!hold(tailStrike({ W, def: def2 }), { gear: 'tri', tailY: 0.02, phase: 'ROTATE' }, 1), 'a tricycle, the tail node on the ground: tailStrike');
  check(hold(tailStrike({ W, def: def2 }), { gear: 'tri' }, 1) === null, 'a tricycle, the tail clear: nothing');
  check(hold(tailStrike({ W, def: def2 }), { gear: 'tail', tailY: 0.02 }, 1) === null, 'a taildragger: nothing (its tail is meant to be down)');
  console.log('yield');
  check(!!hold(yieldDet(), { D: { yields: 1, firstYield: { beam: 7, cls: 'gear' } } }, 1), 'a member yields: yield');
  check(hold(yieldDet(), { D: { yields: 1 }, D0: { yields: 1 } }, 1) === null, 'yielded before the leg: nothing');
  console.log('stuck');
  check(!!hold(stuck(), { thr: 0.8, phase: 'TAXI' }, 60 * 20 + 2), 'throttle 0.8, not moving, 20 s in TAXI: stuck');
  check(hold(stuck(), { thr: 0.8, phase: 'HOLD' }, 60 * 21) === null, 'the same in HOLD: nothing');
  check(hold(stuck(), { thr: 0.3, phase: 'TAXI' }, 60 * 21) === null, 'throttle 0.3: nothing');
  check(make({ W, def }).map(d => d.name).join(',') === 'noseOver,capsize,propStrike,gearAtTouch,groundLoop,tailStrike,yield,stuck', 'make(): the eight, noseOver first');
  console.log(fails ? 'ACCEPT-DETECT SELFTEST: FAIL (' + fails + ')' : 'ACCEPT-DETECT SELFTEST: PASS');
  process.exit(fails ? 1 : 0);
}
