#!/usr/bin/env node
// SEA-PETREL test driver (a tester's rig, not game code). One leg (or a chain) of the Super Petrel V4.1, the game's way:
// the load door (_load_build via pilot_trace specOf), the worker's host (_tour_lib gameHost), the game's day with the
// wind replaced, Expert pilot (the host's default auto profile), damage ON. Instruments, every frame: the propeller
// disc's lowest point (the solver's own geometry: engine nodes' centre + R down in the disc plane) against the WAVED
// water (waterH(x,z,t), what propWater reads), the level water (waterH(x,z), what driveFrame reads) and the terrain;
// pitch / roll on the water; the phases; go-arounds; the landing record.
//   node sp_fly.js --root /workspace/base --order SEA,mk_sea --wind 8@250 | 0 | xw10 --load full|solo|solo72
//        [--pre N frames idle at the start: the repeat's phase] [--gear up|down (held from FINAL)] [--out f.json]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ROOT = path.resolve(opt('root', '/workspace/base'));
const T = path.join(ROOT, 'flyDiy', 'tools');
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const BUILD = path.resolve(ROOT, 'flyDiy', opt('build', 'builds/candidates/superpetrel_V4_1.json'));
const order = opt('order', 'SEA,mk_sea').split(',');
const WIND = opt('wind', '8@250'), LOAD = opt('load', 'full'), PRE = +opt('pre', 0), GEARHOLD = opt('gear', null);
const TMAX = +opt('tmax', 1800);
const OUT = opt('out', null), DUMP0 = +opt('dump0', 0);

const VKEY = opt('vkey', null);
const spec = VKEY ? require(path.join(T, '_load_build.js')).loadValidated(VKEY).spec : PT.specOf(BUILD).spec;
if (LOAD === 'solo' || LOAD === 'solo72') {
  spec.cabin = Object.assign({}, spec.cabin, { occupied: [1, 0] });
  spec.fuel = Object.assign({}, spec.fuel, { litres: LOAD === 'solo' ? 20 : 72 });
} else if (LOAD !== 'full') throw new Error('load?');
const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
def.params = Object.assign({}, def.params, { damage: true });
const TW = TR.tourWorld(C, IN, fs), W = TW.W;
const A = id => W.aerodromes.find(q => q.id === id);
const day = TR.gameDay(C);
const lastTo = A(order[order.length - 1]);
let wind;
if (WIND === '0') wind = Object.assign({}, day.wind, { kts: 0, gust: 0 });
else if (/^xw/.test(WIND)) {     // a crosswind from the right of the destination lane's landing direction (compass = 90 + hdg deg)
  const kts = +WIND.slice(2), lane = ((90 + lastTo.hdg * 57.29578) % 360 + 360) % 360;
  wind = Object.assign({}, day.wind, { kts, dirDeg: Math.round((lane + 90) % 360) });
} else { const [k, d] = WIND.split('@'); wind = Object.assign({}, day.wind, { kts: +k, dirDeg: +d }); }
day.wind = wind;

const H = TR.gameHost(C, W, def, A(order[0]), A(order[1]), { day, damage: true });
const sim = H.sim;
const info = { build: VKEY || path.basename(BUILD), order, wind, load: LOAD, pre: PRE, gearHold: GEARHOLD, mass: H.game.mass, fuel: H.game.fuel, crew: spec.cabin.occupied };
console.log('sp_fly ' + JSON.stringify(info));

// ---- the instruments -------------------------------------------------------------------------------------------------
const ENG_N = def.refs.engine || [];
const PR = def.params.prop || null;
const R = PR && PR.D ? PR.D / 2 : 0.8;
let simT = 0;
function disc() {
  const ax = sim.axes(), xA = ax[0];
  const ay = -xA[1], dl = Math.max(0.2, Math.sqrt(Math.max(0, 1 - ay * ay)));
  const dx = (-xA[0]) * ay / dl, dy = (-1 + ay * ay) / dl, dz = (-xA[2]) * ay / dl;
  let cx = 0, cy = 0, cz = 0;
  for (const i of ENG_N) { cx += sim.p[i * 3]; cy += sim.p[i * 3 + 1]; cz += sim.p[i * 3 + 2]; }
  const c = ENG_N.length || 1; cx /= c; cy /= c; cz /= c;
  return { x: cx + R * dx, y: cy + R * dy, z: cz + R * dz, hubY: cy };
}
const r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10, dg = v => r1(v * 57.29578);
const legsOut = [];
let cur = null;
function newLeg(a, b) {
  cur = { from: a, to: b, phases: [], phaseT: {}, clear: {}, water: { rollMax: 0, rollMin: 0, pitchMax: -9, pitchMin: 9, t: 0, wetMax: 0 },
          seaAmax: 0, hist: [], strike: null, gearHeldFrom: null, gearDownAtTd: null, minHull: null, cost: {}, hist0: [] };
}
function clearKey(ph, surf) { return ph + '/' + surf; }
let holdOn = false;
const stepRaw = sim.step;
sim.step = (dt) => {
  if (holdOn && GEARHOLD) sim.ctl.gear = GEARHOLD === 'up' ? 0 : 1;   // the held handle wins over the AP's write (set after ap.update, before the solver)
  const h0 = process.hrtime.bigint();
  stepRaw(dt); simT += dt;
  const us = Number(process.hrtime.bigint() - h0) / 1000;
  if (!cur) return;
  const ap = H.ap, ph = ap ? ap.phase : '?';
  if (GEARHOLD && ph === 'FINAL' && !holdOn) { holdOn = true; cur.gearHeldFrom = r1(simT); }
  const d = disc();
  const wT = W.waterH(d.x, d.z, sim.t != null ? sim.t : simT), w0 = W.waterH(d.x, d.z), g = W.terrainH(d.x, d.z);
  const onWater = w0 > -1e8 && w0 > g;
  const surfY = onWater ? wT : g, gap = d.y - surfY, gap0 = onWater ? d.y - w0 : gap;
  const HY = sim.out && sim.out.hydro, wet = HY && HY.wet > 0 ? HY.wet : 0;
  const onG = sim.wheelsOnGround ? sim.wheelsOnGround() : 0;
  const v = sim.cgVel(), Vg = Math.hypot(v[0], v[2]), cg = sim.cgPos();
  const surfOn = wet > 0 ? 'water' : onG > 0 ? 'ground' : 'air';
  const k = clearKey(ph, surfOn);
  const pitch = sim.out.pitch, roll = sim.out.roll;
  if (surfOn !== 'air' || cg[1] - (onWater ? 0 : g) < 6) {
    const c = cur.clear[k] || (cur.clear[k] = { min: Infinity, min0: Infinity, t: 0, V: 0, pitch: 0, thr: 0, wave: 0 });
    if (gap < c.min) Object.assign(c, { min: r2(gap), t: r1(simT), V: r1(Vg), pitch: dg(pitch), roll: dg(roll), thr: r2(sim.ctl.thr), wave: onWater ? r2(wT - w0) : 0 });
    if (gap0 < c.min0) c.min0 = r2(gap0);
  }
  if (wet > 0) {
    const Wd = cur.water; Wd.t += dt;
    Wd.rollMax = Math.max(Wd.rollMax, dg(roll)); Wd.rollMin = Math.min(Wd.rollMin, dg(roll));
    Wd.pitchMax = Math.max(Wd.pitchMax, dg(pitch)); Wd.pitchMin = Math.min(Wd.pitchMin, dg(pitch));
    Wd.wetMax = Math.max(Wd.wetMax, wet);
  }
  if (W.sea && W.sea.A) cur.seaAmax = Math.max(cur.seaAmax, r2(W.sea.A));
  cur.phaseT[ph] = (cur.phaseT[ph] || 0) + dt;
  const cs = cur.cost[surfOn] || (cur.cost[surfOn] = { steps: 0, us: 0 }); cs.steps++; cs.us += us;
  // the last 4 s, kept for a strike's story
  if ((Math.round(simT * 60) % 6) === 0) {
    cur.hist.push([r1(simT), ph, r2(gap), r2(gap0), r2(onWater ? wT - w0 : 0), r1(Vg), dg(pitch), dg(roll), r2(sim.ctl.thr), surfOn, r2(d.hubY - (onWater ? w0 : g)), sim.ctl.gear, r2(sim.ctl.de), r1(cg[1] - (onWater ? w0 : g))]);
    if (DUMP0 && simT <= DUMP0) cur.hist0.push(cur.hist[cur.hist.length - 1]);
    if (cur.hist.length > 80) cur.hist.shift();
  }
  const D = sim.damage ? sim.damage() : null;
  if (D && D.propStrike && !cur.strike) cur.strike = { t: r1(simT), what: D.propAt && D.propAt.what, phase: ph, story: cur.hist.slice() };
};
H.dayTick = H.dayTick || (() => {});
// the repeat's phase: idle frames on the stand / at the dock before the start (the waves and the gusts move on)
for (let i = 0; i < PRE; i++) H.step();
for (let i = 1; i < order.length; i++) {
  const a = A(order[i - 1]), b = A(order[i]);
  newLeg(a.id, b.id); holdOn = false;
  const t0 = simT;
  const L = TR.flyLeg(C, W, sim, def, a, b, { first: i === 1, host: H, tMax: TMAX });
  const ld = L.arr && L.arr.landing;
  const rec = {
    leg: a.id + '>' + b.id, ok: L.ok, t: r1(L.t), faults: L.faults.map(f => f.k + (f.note ? ': ' + f.note : '')),
    verdicts: L.verdicts, goArounds: (L.verdicts || []).filter(v => /go-?around|balk|gumps/i.test(v)).length,
    landing: ld ? { sink: ld.sink, V: ld.V, run: ld.run, off: ld.offCentre, onStrip: ld.onStrip } : null,
    dep: L.dep, landedOn: L.landedOn, phases: L.phases.join('>'),
    clear: cur.clear, water: cur.water, seaAmax: cur.seaAmax, strike: cur.strike, gearHeldFrom: cur.gearHeldFrom,
    damage: L.damage, fuel: L.fuel, tStart: r1(t0), cost: cur.cost, phaseT: cur.phaseT, hist0: cur.hist0,
  };
  legsOut.push(rec);
  console.log(JSON.stringify({ leg: rec.leg, ok: rec.ok, t: rec.t, faults: rec.faults, landing: rec.landing, goArounds: rec.goArounds, strike: rec.strike ? { t: rec.strike.t, what: rec.strike.what, phase: rec.strike.phase } : null, water: rec.water }));
  if (!L.ok && !L.faults.every(f => ['diverted', 'where'].includes(f.k))) break;
}
const res = { info, legs: legsOut };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res));
