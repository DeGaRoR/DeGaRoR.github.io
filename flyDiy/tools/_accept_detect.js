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
// SEAPLANES' (this file's first three; Pilot adds groundLoop, noseOver, tailStrike, yield, stuck):
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
    const up = ctx.sim.axes()[1][1];
    if (up >= COS30) return null;
    if (!touching(ctx.sim, W, def)) return null;   // (aerobatics in the air are not a capsize)
    if (up < COS60) return { verdict: 'capsize', t: r1(ctx.t), what: 'the up axis ' + deg(Math.acos(Math.max(-1, Math.min(1, up)))) + ' deg off the vertical, touching the ' + ctx.surface + (ctx.ap && ctx.ap.phase ? ' (' + ctx.ap.phase + ')' : '') };
    if (!warned) { warned = true; d.warnings.push({ t: r1(ctx.t), what: 'tilted ' + deg(Math.acos(up)) + ' deg on the ' + ctx.surface }); }
    return null;
  };
  return d;
}

function propStrike() {
  return { name: 'propStrike', onFrame: ctx => {
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

const FACTORIES = { capsize, propStrike, gearAtTouch };
// every detector of this file, fresh, for one leg
const make = (env, names) => (names || Object.keys(FACTORIES)).map(k => FACTORIES[k](env));

module.exports = { FACTORIES, make, capsize, propStrike, gearAtTouch, touching, lowest, surfaceH };

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
  check(make({ W, def }).map(d => d.name).join(',') === 'capsize,propStrike,gearAtTouch', 'make(): the three, in order');
  console.log(fails ? 'ACCEPT-DETECT SELFTEST: FAIL (' + fails + ')' : 'ACCEPT-DETECT SELFTEST: PASS');
  process.exit(fails ? 1 : 0);
}
