#!/usr/bin/env node
// GATE ENGTORQUE (G2080) - the propeller's four moments (30_solver propMoments) on the user's Cub and twin, each
// read off a PHYSICAL response of the airframe, never off the solver's own published numbers alone:
//   INERT     PAR.propFx all 0: nothing published, the hands-off full-power roll runs dead straight (master's solver)
//   SHAFT     the static full-throttle point: rpm within 3 % of the J-3's tied-down 2150 (the shaft law's anchor), the
//             torque at the prop shaft P/omega_rated (A-65: 48.5 kW at 2300 rpm), H = I . Omega with the prop's
//             I = GEN_PROP_IK . m . R^2 from the build's own blades
//   SIGNS     each effect ALONE, the Lycoming hand (+1, clockwise from behind) against the effects off, then the other
//             hand (-1) mirrored:
//               torque   on the brakes at full power the aeroplane leans LEFT wing down on its gear
//               swirl    hands-off at full power the roll swings LEFT (the swirl strikes the fin's left side)
//               gyro     in the air, a nose-DOWN pitch rate (the tail coming up) yaws the nose LEFT
//               P-factor in the air at a positive angle of attack the nose yaws LEFT
//             and every one the other way round with sense -1, each within 25 % of its mirror
//   COUPLES   the moments add no force: the forces each couple puts on its node set (summed by the solver every pass,
//             out.propFx.netF / mErr - a whole frame's CG velocity cannot say it, the attitude it turns moves the air
//             loads by 1e-3 m/s a frame) sum to nothing and make exactly the moment
//   TWIN      the same-hand twin (the fixture: both +1) leans and swings; counter-rotating (+1 / -1) the reaction
//             torques cancel to the N.m and the hands-off swing falls under a fifth of the same-hand one
//
//   node tools/_engtorque_check.js             -> "GATE ENGTORQUE: PASS|FAIL"
//   node tools/_engtorque_check.js --selftest  -> a doctored record each way must go red
'use strict';
const path = require('path');
const L = require(path.join(__dirname, '_treecrash_lib.js'));
const C = L.core();
const SELF = process.argv.includes('--selftest');
const ALL = { torque: 1, gyro: 1, pfactor: 1, swirl: 1 }, NONE = { torque: 0, gyro: 0, pfactor: 0, swirl: 0 };
const only = k => Object.assign({}, NONE, { [k]: 1 });
const f = (x, n = 3) => (typeof x === 'number' && Number.isFinite(x)) ? x.toFixed(n) : String(x);

const _defs = {};
function defOf(key, sense) {
  const id = key + ':' + sense.join(',');
  if (_defs[id]) return _defs[id];
  const d = L.defOf(key, { elastic: true });
  const o = Object.assign({}, d, { params: Object.assign({}, d.params, { engines: d.params.engines.map((e, i) => Object.assign({}, e, { sense: sense[i] })) }) });
  return (_defs[id] = o);
}
function simOf(key, sense, fx, agl, V) {
  C.PAR.propFx = fx;
  const def = defOf(key, sense), { W, strip } = L.flatWorld(0);
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: agl || 0 }));
  C.PAR.propFx = ALL;
  return { sim, def, strip };
}
const fwd = sim => { const [xA] = sim.axes(); const h = Math.hypot(xA[0], xA[2]) || 1; return [-xA[0] / h, -xA[2] / h]; };
const leftOf = (f0, f1) => Math.atan2(f0[1] * f1[0] - f0[0] * f1[1], f0[0] * f1[0] + f0[1] * f1[1]) * 180 / Math.PI;   // + = LEFT

// on the brakes at full power: the bank (deg, + = right wing down) and the published shaft numbers
function staticRun(key, sense, fx) {
  const { sim } = simOf(key, sense, fx);
  for (let i = 0; i < 180; i++) sim.step(1 / 60);
  const r0 = sim.out.roll;
  sim.ctl.thr = 1; sim.ctl.brake = 1;
  for (let i = 0; i < 180; i++) sim.step(1 / 60);
  const P = sim.out.propFx;
  return { bank: (sim.out.roll - r0) * 57.2958, rpm: P.rpm[0], Q: Array.from(P.Q), H: P.H[0], tq: Array.from({ length: P.Q.length }, (_, k) => P.tq[k*3]),
    published: Math.abs(P.tq[0]) + Math.abs(P.gyro[1]) + Math.abs(P.pf[1]) + Math.abs(P.swirl[0]), sim };
}
// hands-off from the brakes at full power, 5 s: the swing (deg, + = LEFT)
function handsOff(key, sense, fx) {
  const { sim } = simOf(key, sense, fx);
  for (let i = 0; i < 180; i++) sim.step(1 / 60);
  sim.ctl.thr = 1; sim.ctl.brake = 1;
  for (let i = 0; i < 60; i++) sim.step(1 / 60);
  const f0 = fwd(sim); sim.ctl.brake = 0;
  for (let i = 0; i < 300; i++) sim.step(1 / 60);
  return leftOf(f0, fwd(sim));
}
// in the air at V, full power, 150 m up, settled 0.5 s with the controls at `de`; then `kick` (a rigid pitch rate,
// rad/s, + = nose up) and 0.5 s more: the heading change (+ = LEFT) and, for COUPLES, the CG velocity after ONE frame
function airRun(key, sense, fx, o) {
  const { sim, strip } = simOf(key, sense, fx, 150, 0);
  const hx = Math.cos(strip.hdg), hz = Math.sin(strip.hdg), n = sim.n;
  for (let i = 0; i < n; i++) { sim.v[i*3] = o.V * hx; sim.v[i*3+1] = 0; sim.v[i*3+2] = o.V * hz; }
  sim.ctl.thr = 1; sim.ctl.de = o.de || 0;
  for (let i = 0; i < (o.settle != null ? o.settle : 30); i++) sim.step(1 / 60);
  if (o.kick) {
    const c = sim.cgPos(), [, , zR] = sim.axes(), w = [zR[0] * o.kick, zR[1] * o.kick, zR[2] * o.kick];
    for (let i = 0; i < n; i++) { const r = [sim.p[i*3] - c[0], sim.p[i*3+1] - c[1], sim.p[i*3+2] - c[2]];
      sim.v[i*3] += w[1]*r[2] - w[2]*r[1]; sim.v[i*3+1] += w[2]*r[0] - w[0]*r[2]; sim.v[i*3+2] += w[0]*r[1] - w[1]*r[0]; }
  }
  const f0 = fwd(sim), v0 = sim.cgVel().slice();
  sim.step(1 / 60);
  const v1 = sim.cgVel().slice(), f1 = fwd(sim);
  for (let i = 1; i < (o.frames || 30); i++) sim.step(1 / 60);
  return { yaw: leftOf(f0, fwd(sim)), dv: [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]], yaw1: leftOf(f0, f1), alpha: sim.out.alpha * 57.2958, sim };
}

function measure() {
  const R = {};
  // INERT
  const s0 = staticRun('cub', [1], NONE);
  R.inertPublished = s0.published;
  R.inertSwing = handsOff('cub', [1], NONE);
  // SHAFT
  const sA = staticRun('cub', [1], ALL);
  const def = defOf('cub', [1]), EN = def.params.engine, PR = def.params.prop;
  R.rpm = sA.rpm; R.Q = sA.Q[0]; R.H = sA.H;
  R.Qref = EN.powerW * (sA.sim.out.powerK || 1) / (2 * Math.PI * EN.rpm / 60);
  R.Href = PR.I * 2 * Math.PI * sA.rpm / 60;
  R.I = PR.I;
  // SIGNS, each effect alone against off, both hands
  const S = {};
  for (const sn of [1, -1]) {
    const b0 = staticRun('cub', [sn], NONE).bank;
    S['torque' + sn] = staticRun('cub', [sn], only('torque')).bank - b0;          // + = right wing down
    S['swirl' + sn] = handsOff('cub', [sn], only('swirl')) - handsOff('cub', [sn], NONE);
    const g0 = airRun('cub', [sn], NONE, { V: 30, kick: -0.6, frames: 20 }).yaw;
    S['gyro' + sn] = airRun('cub', [sn], only('gyro'), { V: 30, kick: -0.6, frames: 20 }).yaw - g0;
    const p0 = airRun('cub', [sn], NONE, { V: 22, de: 0.12, settle: 40, frames: 60 });
    S['pfactor' + sn] = airRun('cub', [sn], only('pfactor'), { V: 22, de: 0.12, settle: 40, frames: 60 }).yaw - p0.yaw;
    S.pfAlpha = p0.alpha;
  }
  R.signs = S;
  // COUPLES
  // (the forces each couple put on its node set, summed in the solver every pass: worst net force per N.m of moment,
  // and the moment's miss, over a kicked second in the air and over the twin's static run)
  const cOn = airRun('cub', [1], ALL, { V: 30, kick: -0.6, frames: 60 }), tw = staticRun('twinFloatsLand', [1, 1], ALL);
  R.coupleF = Math.max(cOn.sim.out.propFx.netF, tw.sim.out.propFx.netF);
  R.coupleM = Math.max(cOn.sim.out.propFx.mErr, tw.sim.out.propFx.mErr);
  // TWIN
  const tSame = staticRun('twinFloatsLand', [1, 1], ALL), tCtr = staticRun('twinFloatsLand', [1, -1], ALL), tOff = staticRun('twinFloatsLand', [1, 1], NONE);
  R.twinSameTq = tSame.tq.reduce((a, b) => a + b, 0); R.twinCtrTq = tCtr.tq.reduce((a, b) => a + b, 0);
  R.twinSameBank = tSame.bank - tOff.bank; R.twinCtrBank = tCtr.bank - tOff.bank;
  R.twinSameSwing = handsOff('twinFloatsLand', [1, 1], ALL); R.twinCtrSwing = handsOff('twinFloatsLand', [1, -1], ALL);
  R.twinOffSwing = handsOff('twinFloatsLand', [1, 1], NONE);
  return R;
}
// the twin on its wheels (the fixture as the take-off gates fly it; the floats are SEAPLANE's)
L.BUILDS.twinFloatsLand = { label: 'twin (wheels)', build: 'tools/fixtures/build_v7_ultralight_2026-09-05.json' };

function judge(R) {
  const out = [];
  const chk = (ok, label, val) => out.push({ ok: !!ok, label, val });
  chk(R.inertPublished === 0 && Math.abs(R.inertSwing) < 0.01, 'INERT: propFx off publishes nothing and the hands-off roll runs straight', `published ${f(R.inertPublished)} swing ${f(R.inertSwing)} deg`);
  chk(Math.abs(R.rpm / 2150 - 1) < 0.03, 'SHAFT: the static rpm within 3 % of the J-3 tied down (2150)', `${f(R.rpm, 0)} rpm`);
  chk(Math.abs(R.Q / R.Qref - 1) < 0.01, 'SHAFT: the static torque is P/omega_rated at the prop shaft', `${f(R.Q, 1)} vs ${f(R.Qref, 1)} N.m`);
  chk(R.I > 0.2 && R.I < 2 && Math.abs(R.H / R.Href - 1) < 0.01, 'SHAFT: H = I . Omega, I from the blades (0.2-2 kg.m2)', `I ${f(R.I)} H ${f(R.H, 1)} vs ${f(R.Href, 1)}`);
  const S = R.signs;
  const sign = (k, want, unit) => {
    const a = S[k + '1'], b = S[k + '-1'];
    chk(Math.sign(a) === want && Math.abs(a) > 1e-3, `SIGN ${k}: the Lycoming hand ${want > 0 ? '+' : '-'} (${unit})`, `${f(a, 4)}`);
    chk(Math.sign(b) === -want && Math.abs(b + a) < 0.25 * Math.abs(a), `SIGN ${k}: the other hand mirrors it (25 %)`, `${f(b, 4)} vs ${f(-a, 4)}`);
  };
  sign('torque', -1, 'bank on the gear, + = right wing down');
  sign('swirl', 1, 'hands-off swing, + = left');
  sign('gyro', 1, 'yaw after a nose-down pitch rate, + = left');
  sign('pfactor', 1, `yaw at alpha ${f(S.pfAlpha, 1)} deg, + = left`);
  chk(S.pfAlpha > 3, 'SIGN pfactor: flown at a positive angle of attack (> 3 deg)', f(S.pfAlpha, 1));
  chk(R.coupleF < 1e-9 && R.coupleM < 1e-9, 'COUPLES: every pass, the forces on a node set sum to nothing and make exactly the moment (1e-9 per N.m)', `net ${R.coupleF.toExponential(2)} /m, miss ${R.coupleM.toExponential(2)}`);
  chk(R.twinSameTq > 300 && Math.abs(R.twinCtrTq) < 1, 'TWIN: same-hand torques add (> 300 N.m), counter-rotating cancel (< 1 N.m)', `${f(R.twinSameTq, 1)} / ${f(R.twinCtrTq, 3)} N.m`);
  chk(R.twinSameBank < -0.01 && Math.abs(R.twinCtrBank) < 0.2 * Math.abs(R.twinSameBank), 'TWIN: same-hand leans left on the gear, counter-rotating under a fifth of it', `${f(R.twinSameBank)} / ${f(R.twinCtrBank)} deg`);
  chk(Math.abs(R.twinCtrSwing - R.twinOffSwing) < 0.2 * Math.abs(R.twinSameSwing - R.twinOffSwing) && Math.abs(R.twinSameSwing - R.twinOffSwing) > 0.05,
    'TWIN: the counter-rotating swing under a fifth of the same-hand swing', `same ${f(R.twinSameSwing - R.twinOffSwing, 2)} counter ${f(R.twinCtrSwing - R.twinOffSwing, 2)} deg`);
  return out;
}

const R = measure();
const rows = judge(R);
let fails = 0;
for (const r of rows) { if (!r.ok) fails++; console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.label} - ${r.val}`); }
if (SELF) {
  // each doctored record must turn its own check red
  const doc = [
    ['torque wrong way', R2 => { R2.signs.torque1 *= -1; }],
    ['gyro unmirrored', R2 => { R2.signs['gyro-1'] = R2.signs.gyro1; }],
    ['swirl absent', R2 => { R2.signs.swirl1 = 0; }],
    ['P-factor at negative alpha', R2 => { R2.signs.pfAlpha = -2; }],
    ['a couple with a force', R2 => { R2.coupleF = 1e-3; }],
    ['counter-rotation not cancelling', R2 => { R2.twinCtrTq = 50; }],
    ['the switch leaking', R2 => { R2.inertSwing = 0.5; }],
    ['the torque off its rating', R2 => { R2.Q *= 1.05; }],
  ];
  let caught = 0;
  for (const [name, fn] of doc) { const R2 = JSON.parse(JSON.stringify(R)); fn(R2); const red = judge(R2).some(r => !r.ok); if (red) caught++; console.log(`selftest ${red ? 'caught' : 'MISSED'}: ${name}`); }
  if (caught !== doc.length) fails++;
}
console.log(`GATE ENGTORQUE: ${fails ? 'FAIL' : 'PASS'} (${rows.length - fails}/${rows.length})`);
process.exit(fails ? 1 : 0);
