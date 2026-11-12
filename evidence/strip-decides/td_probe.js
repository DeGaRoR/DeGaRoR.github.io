// td_probe.js <tree> <out.json> <key,key,...> [order]
// The touchdown probe (FIT-PROCEDURE for Pilot, via A0): each build flies a tour the game's way (TOUR's gameHost: the
// game's day, the 8 kt breeze, the shakedown, the expert = no profile), and every landing records the BANK AT THE
// TOUCHDOWN (the first wheel contact after > 15 m), the largest bank on the roll, the ROLL-OUT HEADING DRIFT (the nose
// against its heading at the touchdown, the largest while > 2 m/s) and the largest error to the strip's axis (> 5 m/s;
// over 30 deg = a ground loop, _tour_lib's own rule), with the go-arounds, the diverts and the faults of the leg.
// Reads the tree's code only; writes nothing in the tree.
'use strict';
const path = require('path'), fs = require('fs');
const TREE = path.resolve(process.argv[2]), OUT = process.argv[3];
const KEYS = process.argv[4].split(',');
const ORDER = (process.argv[5] || 'HOME,nv_strip,HOME,tw_ski,HOME').split(',');
const T = path.join(TREE, 'flyDiy', 'tools');
const say = s => process.stdout.write(s + '\n');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const SH = require(path.join(TREE, 'flyDiy', 'src', 'viewer', 'sim_host.js'));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const axisErr = (nose, hdg) => Math.min(Math.abs(wrap(nose - hdg)), Math.abs(wrap(nose - hdg - Math.PI)));
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const D = 180 / Math.PI;

let S = null;   // the sampler of the current leg
const fresh = () => ({ airborne: false, td: null, preBank: 0, rollBankMax: 0, driftMax: 0, axisMax: 0, phases: [], li: null, ui: null, nose0: null, landB: null, ga: 0, last: null });
const orig = SH.makeSimHost;
SH.makeSimHost = function (Cc, opts, W) {
  const H = orig.apply(this, arguments);
  const step0 = H.step.bind(H);
  // the body axes: [0] the fuselage (nose = -x); of the other two, the one most upright at rest is 'up', the other the span
  const ax = H.sim.axes();
  const ui = Math.abs(ax[1][1]) > Math.abs(ax[2][1]) ? 1 : 2, li = 3 - ui;
  H.step = function () {
    const r = step0();
    const sim = H.sim, ap = H.ap;
    if (!S) return r;
    const ph = ap.phase;
    if (ph !== S.last) { S.phases.push(ph); if (ph === 'GOAROUND') S.ga++; S.last = ph; }
    const cg = sim.cgPos(), A = sim.axes();
    const bank = Math.asin(Math.max(-1, Math.min(1, A[li][1]))) * D * Math.sign(A[ui][1] || 1);
    const xA = A[0], nl = Math.hypot(xA[0], xA[2]) || 1e-9, nose = Math.atan2(-xA[2] / nl, -xA[0] / nl);
    const v = sim.cgVel(), Vg = Math.hypot(v[0], v[2]);
    const onG = sim.wheelsOnGround ? sim.wheelsOnGround() > 0 : false;
    const hAGL = cg[1] - W.terrainH(cg[0], cg[2]);
    if (hAGL > 15) { S.airborne = true; S.td = null; S.rollBankMax = 0; S.driftMax = 0; S.axisMax = 0; S.nose0 = null; }   // a go-around resets the touchdown
    if (S.airborne && !S.td && (ph === 'FINAL' || ph === 'FLARE')) S.preBank = Math.max(S.preBank * 0.999, Math.abs(bank));
    if (S.airborne && !S.td && onG && (ph === 'FLARE' || ph === 'ROLLOUT' || ph === 'FINAL')) {
      const wh = typeof C.flightWhere === 'function' ? C.flightWhere(W, cg[0], cg[2]) : null;
      S.landB = wh && wh.aero ? wh.aero : null;
      S.td = { bank: r1(bank), V: r1(Vg), sink: r1(-v[1]), phase: ph, on: S.landB && S.landB.id, preBankMax: r1(S.preBank) };
      S.nose0 = nose;
    }
    if (S.td && onG) {
      S.rollBankMax = Math.max(S.rollBankMax, Math.abs(bank));
      if (Vg > 2) S.driftMax = Math.max(S.driftMax, Math.abs(wrap(nose - S.nose0)));
      if (Vg > 5 && S.landB) S.axisMax = Math.max(S.axisMax, axisErr(nose, S.landB.hdg));
    }
    return r;
  };
  return H;
};

const TW = TR.tourWorld(C, IN, fs);
const W = TW.W;
const res = [];
for (const key of KEYS) {
  const t0 = Date.now();
  let def;
  try { def = /\.json$/.test(key) ? TR.defOf(C, PT, key) : TR.defOf(C, PT, key); }
  catch (e) { res.push({ key, err: String(e.message).slice(0, 120) }); say(key + ' ERR ' + e.message); continue; }
  const legs = [];
  S = fresh();
  let R;
  try {
    R = TR.flyTour(C, W, def, ORDER, { game: {}, roundOK: 'nv_strip', tMax: 2800, log: L2 => {
      legs.push({ from: L2.from, to: L2.to, landedOn: L2.landedOn, heldOff: L2.heldOff || null, declined: L2.declined || null, divertedTo: L2.divertedTo || null,
        warnings: L2.warnings, faults: L2.faults.map(f => f.k + ': ' + f.note), landing: L2.arr && L2.arr.landing,
        td: S.td, rollBankMax: r1(S.rollBankMax), driftMax: r1(S.driftMax * D), axisMax: r1(S.axisMax * D), goArounds: S.ga });
      S = fresh();
    } });
  } catch (e) { legs.push({ err: String(e.stack).slice(0, 300) }); }
  res.push({ key, done: R && R.done, legs, wall: Math.round((Date.now() - t0) / 1000) });
  for (const l of legs) say(key.padEnd(14) + ' ' + (l.from + '>' + l.to).padEnd(18) + ' on ' + String(l.landedOn).padEnd(9) + ' GA ' + l.goArounds + ' td ' + JSON.stringify(l.td) + ' rollBank ' + l.rollBankMax + ' drift ' + l.driftMax + ' axis ' + l.axisMax + ' | ' + (l.faults || []).join('; ').slice(0, 160));
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
}
say('PROBE DONE');
