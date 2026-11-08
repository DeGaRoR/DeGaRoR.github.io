#!/usr/bin/env node
// SEA-AMPHIB (test tool, no game code): ONE TOUR OF A FLOAT / AMPHIBIAN BUILD THE GAME'S WAY, MEASURED EVERY STEP.
// The aeroplane: the load door's (tools/_load_build.js LB.gameSpec), damage ON. The flight: _tour_lib's game host (the
// page's own placement, pilot with the shakedown, nav, the game's day ticked: --wind 8 = the game's default 'light
// breeze' 8 kt from 250; --wind 0 = calm) and flyLeg per leg (the first off the host's start, every next the page's
// chained 'leg' command). Added per leg, from the sim every 4th step:
//   propMin     the disc's lowest point over max(ground, water) - the solver's own driveFrame geometry (30_solver.js:2120)
//   propMinSurf the same, only while on the surface (wheels / floats / hull touching)
//   roll/pitch  extremes on the surface (deg; roll + = right wing down, pitch + = nose up) and |roll| max in the air
//   tipMin      the outer 20 % of the span's nodes' least height over the water / ground while on the surface
//   capsize     90 - max |roll| on the surface (deg; negative = past the line: on its side / back) - the pilot's own capsize line is |roll| > 90 (43_pilot.js:2174)
//   gear        out.gear min / max (a retract build only), wheelsOnGround's max while the hull/floats are wet
//   hash        sha1 of the node positions at the leg's end (a parity rig: two trees, one hash = one flight)
//   --trace f.csv [--hz 10]: every 1 s (60 steps; --hz 10 every 0.1 s) the leg, t, phase, Vg, vy, CG height, the disc's gap, pitch, roll, on surface, wet
//   node reports/evidence/SEA-AMPHIB/fly.js [--root <flyDiy dir>] --build <file> --order SEA,mk_sea,SEA --wind 0|8 [--out f.json] [--tmax s] [--tmax-last s: the last leg only]
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
// --root <a flyDiy/ dir>: the tree under test (default this one) - the same driver flies another worktree's code
const R = path.resolve(opt('root', path.join(__dirname, '..', '..', '..'))), T = path.join(R, 'tools');
const TRACE = opt('trace', null), TRC = [], HZ = +opt('hz', 1), EVERY = HZ >= 10 ? 2 : 4, TSTEP = Math.round(60 / HZ);   // --hz 10: a 10 Hz trace (measures every 2nd step)
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const LB = require(path.join(T, '_load_build.js'));
const BUILD = opt('build'), order = opt('order', 'SEA,mk_sea,SEA').split(','), WIND = +opt('wind', 8);
const raw = JSON.parse(fs.readFileSync(path.isAbsolute(BUILD) ? BUILD : path.join(R, BUILD), 'utf8'));
const spec = LB.gameSpec(raw);
const def0 = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
def0.params = Object.assign({}, def0.params, { damage: true });
const TW = TR.tourWorld(C, IN, fs), W = TW.W;
const A = id => W.aerodromes.find(q => q.id === id);
const res = { build: BUILD, order, wind: WIND, gear: C.stripGear(spec), legs: [], refused: [] };
// THE ROUTE DOOR: may this gear use each end at all (25_airfield stripAllows - the map's and the route's rule)
for (const id of new Set(order)) { const al = C.stripAllows(spec, A(id)); if (!al.ok) res.refused.push(id + ': ' + al.why); }
const day = WIND === 0 ? null : undefined;
const H = TR.gameHost(C, W, def0, A(order[0]), A(order[1]), { day, damage: true });
const sim = H.sim, def = H.def;
res.mass = Math.round(sim.totalM * 10) / 10; res.retract = !!(def.params && def.params.retract);
// the tips: the outer 20 % of the span (the def's rest lateral coordinate)
let zMax = 0; for (const nd of def.nodes) zMax = Math.max(zMax, Math.abs(nd.p[2]));
const TIPS = def.nodes.map((nd, i) => Math.abs(nd.p[2]) > 0.8 * zMax ? i : -1).filter(i => i >= 0);
const ENG = def.refs.engine || [];
const D0 = sim.damage && sim.damage().drive && sim.damage().drive[0];
const Rp = (def.params.prop && def.params.prop.D ? def.params.prop.D : 1.8) / 2;
const surfH = (x, z) => { const g = W.terrainH(x, z), w = W.waterH ? W.waterH(x, z) : -1e9; return w > -1e8 && w > g ? w : g; };
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
let M = null, n = 0, tAll = 0;
const step0 = sim.step;
sim.step = dt => {
  step0(dt); tAll += dt;
  if ((n++ % EVERY) !== 0 || !M) return;
  const ax = sim.axes(), xA = ax[0], zR = ax[2], p = sim.p;
  const pitch = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 57.2958, roll = Math.atan2(-zR[1], ax[1][1]) * 57.2958;   // (full range: on its back reads +-180, not ~0 as asin did)
  const HY = sim.hydro, wet = !!(HY && HY.floats && HY.floats.some(f => f.wet > 0.05));
  const wog = sim.wheelsOnGround ? sim.wheelsOnGround() : 0;
  const onS = wet || wog > 0;
  // the disc's lowest point (30_solver driveFrame)
  if (ENG.length) {
    let cx = 0, cy = 0, cz = 0; for (const i of ENG) { cx += p[i * 3]; cy += p[i * 3 + 1]; cz += p[i * 3 + 2]; } cx /= ENG.length; cy /= ENG.length; cz /= ENG.length;
    const ay = -xA[1], dl = Math.max(0.2, Math.sqrt(Math.max(0, 1 - ay * ay)));
    const lx = cx + Rp * (-xA[0]) * ay / dl, ly = cy + Rp * (-1 + ay * ay) / dl, lz = cz + Rp * (-xA[2]) * ay / dl;
    const gap = ly - surfH(lx, lz);
    if (gap < M.propMin.v) M.propMin = { v: gap, t: M.t(), ph: H.ap.phase };
    if (TRACE && ((n - 1) % TSTEP) === 0) { const cg = sim.cgPos(), v = sim.cgVel(); TRC.push([M.leg, r2(tAll), H.ap.phase, r1(Math.hypot(v[0], v[2])), r2(v[1]), r2(cg[1] - surfH(cg[0], cg[2])), r2(gap), r1(pitch), r1(roll), onS ? 1 : 0, wet ? 1 : 0, r1(Math.atan2(-xA[2], -xA[0]) * 57.2958), r2(sim.ctl.thr), r2(sim.ctl.da), r2(sim.ctl.dr), r2(sim.ctl.de)]); }
    if (onS && gap < M.propMinSurf.v) M.propMinSurf = { v: gap, t: M.t(), ph: H.ap.phase };
  }
  if (onS) {
    M.rollS[0] = Math.min(M.rollS[0], roll); M.rollS[1] = Math.max(M.rollS[1], roll);
    M.pitchS[0] = Math.min(M.pitchS[0], pitch); M.pitchS[1] = Math.max(M.pitchS[1], pitch);
    let tl = Infinity; for (const i of TIPS) tl = Math.min(tl, p[i * 3 + 1] - surfH(p[i * 3], p[i * 3 + 2]));
    if (tl < M.tipMin.v) M.tipMin = { v: tl, t: M.t(), ph: H.ap.phase };
    if (wet) M.wogWet = Math.max(M.wogWet, wog);
    const cg = sim.cgPos(), w = W.waterH ? W.waterH(cg[0], cg[2]) : -1e9, g = W.terrainH(cg[0], cg[2]);
    M.onLand = M.onLand || (!(w > -1e8 && w > g) && wog > 0);
  } else M.rollA = Math.max(M.rollA, Math.abs(roll));
  if (sim.out && typeof sim.out.gear === 'number') { M.gear[0] = Math.min(M.gear[0], sim.out.gear); M.gear[1] = Math.max(M.gear[1], sim.out.gear); }
};
let from = A(order[0]); const t0 = Date.now();
for (let i = 1; i < order.length; i++) {
  const a = from, b = A(order[i]); let tL = 0;
  M = { leg: a.id + '>' + b.id, t: () => r1(tL), propMin: { v: Infinity }, propMinSurf: { v: Infinity }, rollS: [Infinity, -Infinity], pitchS: [Infinity, -Infinity], rollA: 0, tipMin: { v: Infinity }, wogWet: 0, gear: [Infinity, -Infinity], onLand: false };
  const s1 = sim.step; sim.step = dt => { tL += dt; s1(dt); };
  let L;
  try { L = TR.flyLeg(C, W, sim, def, a, b, Object.assign({ first: i === 1, host: H }, opt('tmax') ? { tMax: +opt('tmax') } : {}, opt('tmax-last') && i === order.length - 1 ? { tMax: +opt('tmax-last') } : {})); } finally { sim.step = s1; }
  const ld = L.arr && L.arr.landing;
  const h = crypto.createHash('sha1').update(Buffer.from(new Float64Array(sim.p).buffer)).digest('hex').slice(0, 12);
  const row = { leg: a.id + '>' + b.id, ok: L.ok, faults: L.faults.map(f => f.k + (f.note ? ' (' + f.note.slice(0, 90) + ')' : '')), outcome: L.outcome, t: r1(L.t), landedOn: L.landedOn,
    sink: ld ? ld.sink : null, V: ld ? ld.V : null, run: ld ? ld.run : null, toDist: L.dep.toDist,
    propMin: isFinite(M.propMin.v) ? Object.assign({}, M.propMin, { v: r2(M.propMin.v) }) : null,
    propMinSurf: isFinite(M.propMinSurf.v) ? Object.assign({}, M.propMinSurf, { v: r2(M.propMinSurf.v) }) : null,
    rollS: M.rollS.map(r1), pitchS: M.pitchS.map(r1), rollA: r1(M.rollA), tipMin: isFinite(M.tipMin.v) ? Object.assign({}, M.tipMin, { v: r2(M.tipMin.v) }) : null,
    capsize: isFinite(M.rollS[1]) ? r1(90 - Math.max(Math.abs(M.rollS[0]), Math.abs(M.rollS[1]))) : null,
    wogWet: M.wogWet, onLand: M.onLand, gear: isFinite(M.gear[0]) ? M.gear.map(r2) : null, damage: L.damage, verdicts: (L.verdicts || []).filter(v => /vref|capsiz|gear|gumps|prop|reject|abort|divert|go-around|water/i.test(v)).slice(0, 8), hash: h };
  res.legs.push(row);
  console.log((row.ok ? 'ok   ' : 'FAIL ') + row.leg.padEnd(16) + ' ' + String(row.t).padStart(6) + ' s  sink ' + row.sink + ' run ' + row.run + ' propMin ' + (row.propMin && row.propMin.v) + ' (surf ' + (row.propMinSurf && row.propMinSurf.v) + ') roll ' + row.rollS + ' pitch ' + row.pitchS + ' tip ' + (row.tipMin && row.tipMin.v) + ' cap ' + row.capsize + ' gear ' + row.gear + ' hash ' + h + (row.faults.length ? '  FAULTS ' + row.faults.join('; ') : ''));
  if (!L.ok && !L.declined && !L.heldOff) break;
  from = L.declined || L.heldOff ? A(L.declined || L.heldOff) : b;
}
res.wall = Math.round((Date.now() - t0) / 1000); res.game = H.game;
if (TRACE) fs.writeFileSync(TRACE, '# leg, t (tour s), phase, Vg m/s, vy m/s, CG over surface m, prop disc gap m, pitch, roll, onSurface, wet, nose heading (deg, atan2(-x_z, -x_x)), thr, da, dr, de\n' + TRC.map(r => r.join(',')).join('\n') + '\n');
const OUT = opt('out'); if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log('DONE ' + path.basename(BUILD) + ' ' + order.join('>') + ' wind ' + WIND + ': gear ' + res.gear + ', ' + res.mass + ' kg' + (res.refused.length ? ', ROUTE REFUSES ' + res.refused.join('; ') : '') + ', ' + res.wall + ' s wall');
