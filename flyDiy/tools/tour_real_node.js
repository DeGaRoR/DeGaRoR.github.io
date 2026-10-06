#!/usr/bin/env node
// tour_real_node.js - TOUR-REAL (G2065-G2069): THE NODE TOUR AGAIN, SAMPLED THE WAY THE PAGE RIG SAMPLES.
//
// ISLAND-TOUR's runner (tools/_tour_lib.js flyTour) keeps a point every 2 s with no phase; TOUR-REAL compares the
// page's flight with it leg by leg, so this flies the SAME tour with the SAME library (flyLeg: the first leg off the
// stand, each next leg the page's chain - flightLeg's From under the aeroplane, a fresh pilot's departFrom) and
// samples it every 0.25 s of sim time in tools/tour_real.js's row format:
//   [t, x, y, z, agl, phase, Vg, nose (rad, the heading the nose points), onG, leg]
// plus each leg's record (flyLeg's own: departure, arrival, faults, verdicts) and the obstacles the node world holds
// (the map draws them beside the page's). The modules come from --root (the tree under test), so node and page run
// one source.
//   node tools/tour_real_node.js --root D:/Dev/wt-tour [--build builds/cub_2026-09-20_corrected.json]
//        [--order HOME,w3,tw_ski,mn_strip,w2,HOME] [--damage 0|1] [--out <file.json>] [--hz 4]
// A heavy node job (~10-15 min, one process): boxlock.sh take cpu <who> first.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ROOT = path.resolve(opt('root', path.join(__dirname, '..', '..')));
const T = path.join(ROOT, 'flyDiy', 'tools');
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const BUILD = path.resolve(ROOT, 'flyDiy', opt('build', 'builds/cub_2026-09-20_corrected.json'));
const order = opt('order', 'HOME,w3,tw_ski,mn_strip,w2,HOME').split(',');
const DAMAGE = opt('damage', '0') === '1';
const HZ = +opt('hz', 4);
const LEGS = +opt('legs', 99), TMAX = opt('tmax', null);   // a smoke run: --legs 1 --tmax 20
const OUT = opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'TOUR-REAL', 'node_tour.json'));

const spec = PT.specOf(BUILD).spec;
// --fuel <litres>: the load the page flies (its first sample's fuelL - the game does not take the build file's spec.fuel)
if (opt('fuel', null) != null) { spec.fuel = Object.assign({}, spec.fuel || {}, { litres: +opt('fuel') }); console.log('  fuel set to ' + spec.fuel.litres + ' L'); }
const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
def.params = Object.assign({}, def.params, { damage: DAMAGE });
const t0 = Date.now();
const TW = TR.tourWorld(C, IN, fs);
const W = TW.W;
// --day <json | @file>: the page's own day (tour_real.js legs.json start.day - the default 'Standard · light breeze 8 kt',
// its clock and its wind) instead of the node world's calm default; frozen for the flight (node has no viewer clock)
const DAYJ = opt('day', null);
if (DAYJ) { const d = JSON.parse(DAYJ[0] === '@' ? fs.readFileSync(DAYJ.slice(1), 'utf8') : DAYJ); W.setDay(d.start && d.start.day ? d.start.day : d); console.log('  the day: ' + JSON.stringify(W.day.spec())); }
console.log('tour_real_node: ' + path.basename(BUILD) + ' (span ' + def.params.gen.span.toFixed(2) + ' m), damage ' + (DAMAGE ? 'ON' : 'off') + ', ' + TW.obstacles + ' obstacles + ' + TW.trunks + ' trunks; ' + order.join(' > '));

// the pilot flyLeg makes, caught as it is made (the sampler reads its phase)
let AP = null;
const mk = C.makePilot;
C.makePilot = function () { AP = mk.apply(this, arguments); return AP; };

const A = id => W.aerodromes.find(q => q.id === id);
const sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
const a0 = A(order[0]);
const st0 = C.siteOf(a0.id) && C.siteOf(a0.id).stand;
if (st0) C.placeAtStand(sim, a0, st0); else C.placeAtAerodrome(sim, a0);
for (let i = 0; i < 600; i++) sim.step(1 / 60);

const rows = [], legs = [];
const r2 = v => Math.round(v * 100) / 100;
let T0 = 0, leg = 0, n = 0;
const every = Math.max(1, Math.round(60 / HZ));
const step0 = sim.step;
sim.step = dt => {
  step0(dt); T0 += dt;
  if ((n++ % every) !== 0) return;
  const cg = sim.cgPos(), v = sim.cgVel(), xA = sim.axes()[0], nl = Math.hypot(xA[0], xA[2]) || 1e-9;
  rows.push([r2(T0), r2(cg[0]), r2(cg[1]), r2(cg[2]), r2(cg[1] - W.terrainH(cg[0], cg[2])), AP ? AP.phase : '', r2(Math.hypot(v[0], v[2])),
    +Math.atan2(-xA[2] / nl, -xA[0] / nl).toFixed(4), sim.wheelsOnGround ? sim.wheelsOnGround() : -1, leg]);
};
for (let i = 1; i < order.length && i <= LEGS; i++) {
  leg = i;
  const a = A(order[i - 1]), b = A(order[i]);
  const tStart = T0, i0 = rows.length;
  let L = TR.flyLeg(C, W, sim, def, a, b, Object.assign({ first: i === 1 }, TMAX ? { tMax: +TMAX } : {}));
  // A REJECTED TAKE-OFF: ONE retry, as the page rig does (the same To from where it stopped - flightLeg's From)
  if (L.faults.some(f => f.k === 'abort')) {
    for (let k = 0; k < 600 && !(AP && AP.phase === 'STOPPED'); k++) sim.step(1 / 60);
    console.log(TR.fmtLeg(L) + '  <- rejected; one retry');
    const L1 = L;
    L = TR.flyLeg(C, W, sim, def, a, b, Object.assign({ first: false }, TMAX ? { tMax: +TMAX } : {}));
    L.retryOf = { faults: L1.faults, verdicts: L1.verdicts, t: L1.t, dep: L1.dep };
    L.faults = L1.faults.map(f => Object.assign({}, f, { k: f.k === 'abort' ? 'abort-retried' : f.k + '-try1' })).concat(L.faults);
  }
  L.tStart = r2(tStart); L.tEnd = r2(T0); L.rows = [i0, rows.length];
  L.landedAt = AP && AP.route && AP.route.to ? AP.route.to.id : null;   // the field it really landed on (a diversion's)
  legs.push(L);
  console.log(TR.fmtLeg(L));
  writeOut(false);   // after every leg: a killed run keeps what it flew
  // a leg that did not end at its To: the tour stops - unless it is a DIVERSION (stopped on the ground at another field,
  // the sim sane), which the page rig flies on from too (the next To picked where the aeroplane stands)
  // (_tour_lib judges a landing roll against the PLANNED To's box: after a diversion its ground-loop / off-strip are the
  // other field's roll measured on the wrong strip - tour_real_report re-measures each leg on the field really landed on)
  const hard = L.faults.filter(f => !['diverted', 'where', 'ground-loop', 'off-strip', 'obstacle', 'trunk', 'abort-retried'].includes(f.k) && !/-try1$/.test(f.k));
  const arrived = L.arr && L.arr.stopS != null;   // stopped at its To (flyLeg's stopAt)
  if (!L.ok && !((arrived || L.faults.some(f => f.k === 'diverted')) && !hard.length)) break;
}
sim.step = step0;
const done = legs.length === order.length - 1 && legs.every(L => L.ok);
console.log((done ? 'TOUR DONE' : 'TOUR NOT DONE') + ' - ' + legs.length + ' legs, ' + T0.toFixed(0) + ' s sim, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall');
writeOut(done);
console.log('-> ' + OUT);
process.exit(done ? 0 : 1);
function writeOut(done) {
  const obst = W.obstacles && W.obstacles.list ? W.obstacles.list().map(o => ({ x: r2(o.x), z: r2(o.z), tag: o.tag || null, r: o.shape && o.shape.r != null ? r2(o.shape.r) : null })) : [];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ kind: 'node', build: path.basename(BUILD), damage: DAMAGE, order, done, hz: HZ,
  cols: ['t', 'x', 'y', 'z', 'agl', 'phase', 'Vg', 'nose', 'onG', 'leg'], rows, legs, obstacles: obst,
  fuel: sim.fuel ? r2(sim.fuel.litres) : null, wall: (Date.now() - t0) / 1000,
  world: { weather: JSON.parse(JSON.stringify(W.weather || null)), day: W.day && W.day.spec ? JSON.parse(JSON.stringify(W.day.spec())) : null, woodSolid: W.woodSolid,
    obstacles: W.obstacles ? W.obstacles.count : null, trunks: TW.trunks } }));
}
