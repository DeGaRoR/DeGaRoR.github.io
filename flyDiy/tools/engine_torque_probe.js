#!/usr/bin/env node
// G2080 ENGINE-TORQUE: THE EVIDENCE - what the propeller's four moments (30_solver propMoments: reaction torque,
// gyroscopic, P-factor, slipstream swirl) do to the user's validated builds, each flown with the effects ON and OFF
// (PAR.propFx), node only:
//   STATIC    full throttle against the brakes: the shaft (rpm, torque Q, angular momentum H, the prop's I), the
//             swirl (rate, wake radius, the angle it makes at the fin's strips) and the bank the torque leans the
//             aeroplane on its gear
//   HANDS-OFF the brakes off at full throttle, every control at zero, 6 s: the swing (heading change, + = LEFT) and
//             how far off the line it ran
//   EACH      the Cub with one effect at a time (cub:torque, cub:gyro, cub:pfactor, cub:swirl)
//   CUT       the twin's port or starboard engine cut 4 s into the climb, effects on and off: the critical engine
//   PILOT     THE PILOT (43) from HOME (the floatplanes from SEA) round a circuit to a stop: per phase the rudder and
//             aileron it holds (mean, extremes; dr < 0 = RIGHT rudder, da > 0 = roll right), the sideslip and the
//             bank, the moments' own means (torque roll, P-factor yaw, gyroscopic yaw; + = nose LEFT / left wing
//             DOWN), the gyroscopic peak on the roll (the tail-up), the roll's off-line and where the pilot rotates (the LIFTOFF phase's first frame: off-line, heading)
//
//   node tools/engine_torque_probe.js                  -> every case, 4 at a time, the table + reports/evidence/
//                                                         engine_torque_g2080.json
//   node tools/engine_torque_probe.js --case=cub:on    -> one case's JSON on stdout
//   --jobs=N, --only=cub,jodel (keys), --no-pilot (static and hands-off only)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const T = __dirname;
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const NOPILOT = process.argv.includes('--no-pilot');

const KEYS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
// the variants: on / off for every build; the twin also counter-rotating (tops inward: port +1, starboard -1)
const CASES = [];
for (const k of KEYS) { CASES.push(k + ':on', k + ':off'); if (k === 'twinFloats') CASES.push(k + ':counter'); }
// each effect ALONE on the Cub (what each one asks of the rudder); the twin's engine cut in the climb, port (0) or
// starboard (1), effects on and off - the critical engine
for (const e of ['torque', 'gyro', 'pfactor', 'swirl']) CASES.push('cub:' + e);
for (const v of ['cut0', 'cut1', 'cut0off', 'cut1off']) CASES.push('twinFloats:' + v);

const r2 = (x, n = 2) => (typeof x === 'number' && Number.isFinite(x)) ? +x.toFixed(n) : x;

function runCase(id) {
  const [key, variant] = id.split(':');
  const L = require(path.join(T, '_treecrash_lib.js'));
  const C = L.core();
  const NONE = { torque: 0, gyro: 0, pfactor: 0, swirl: 0 };
  if (variant === 'off' || /off$/.test(variant)) C.PAR.propFx = NONE;
  if (NONE[variant] === 0) C.PAR.propFx = Object.assign({}, NONE, { [variant]: 1 });
  const CUT = /^cut(\d)/.test(variant) ? +variant[3] : null;
  const B = L.BUILDS[key];
  if (variant === 'counter') {
    const p0 = B.patch;
    B.patch = j => { j = p0 ? p0(j) : j; j.spec.engines[0].sense = 1; j.spec.engines[1].sense = -1; return j; };
  }
  const def = L.defOf(key, { elastic: true });
  const out = { id, key, variant, label: B.label, sense: (def.params.engines || []).map(e => e.sense), I: r2(def.params.prop.I, 3), D: def.params.prop.D };
  const fwd = sim => { const [xA] = sim.axes(); const h = Math.hypot(xA[0], xA[2]) || 1; return [-xA[0] / h, -xA[2] / h]; };
  const leftOf = (f0, f) => Math.atan2(f0[1] * f[0] - f0[0] * f[1], f0[0] * f[0] + f0[1] * f[1]) * 180 / Math.PI;   // + = turned LEFT
  // --- STATIC and HANDS-OFF, on the flat world (land) or the sea lane (floats) ---
  {
    let sim, world;
    if (def.parts && def.parts.floats) { world = C.makeWorld(); sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, world.aerodromes.find(a => a.id === 'SEA')); }
    else { const F = L.flatWorld(300); world = F.W; sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, F.strip, { elev: 300, spawnElev: 300 })); }
    for (let f = 0; f < 180; f++) sim.step(1 / 60);
    const roll0 = sim.out.roll;
    sim.ctl.thr = 1; sim.ctl.brake = 1;
    for (let f = 0; f < 150; f++) sim.step(1 / 60);
    const P = sim.out.propFx, nE = P.Q.length;
    // the swirl's angle at the fin's strips: v = w_s . d at their mean distance off the thrust axis, over the wake speed
    const fins = def.strips.filter(s => s.kind === 'fin' && s.wash > 0);
    let finAng = null;
    if (fins.length && P.swirl[0]) {
      const [xA] = sim.axes(), hub = [0, 0, 0]; let c = 0;
      for (let j = 0; j < def.refs.engine.length; j++) if ((def.refs.engineOf || [])[j] === 0 || !def.refs.engineOf) { const e = def.refs.engine[j] * 3; hub[0] += sim.p[e]; hub[1] += sim.p[e+1]; hub[2] += sim.p[e+2]; c++; }
      hub[0] /= c; hub[1] /= c; hub[2] /= c;
      let dSum = 0;
      for (const s of fins) {
        let x = 0, y = 0, z = 0; for (const [i, w] of s.w) { x += sim.p[i*3] * w; y += sim.p[i*3+1] * w; z += sim.p[i*3+2] * w; }
        let dx = x - hub[0], dy = y - hub[1], dz = z - hub[2]; const a = dx * xA[0] + dy * xA[1] + dz * xA[2];
        dx -= a * xA[0]; dy -= a * xA[1]; dz -= a * xA[2]; dSum += Math.min(Math.hypot(dx, dy, dz), P.wakeR[0]);
      }
      const Vw = Math.sqrt(2 * sim.out.thrust / nE / (sim.out.rho * Math.PI * (def.params.prop.D / 2) ** 2));
      finAng = Math.atan(Math.abs(P.swirl[0]) * dSum / fins.length / Math.max(1, Vw)) * 180 / Math.PI;
    }
    out.static = { rpm: Array.from(P.rpm, x => r2(x, 0)), Q: Array.from(P.Q, x => r2(x, 1)), H: Array.from(P.H, x => r2(x, 1)),
      swirl: Array.from(P.swirl, x => r2(x, 2)), wakeR: Array.from(P.wakeR, x => r2(x, 2)), finSwirlDeg: r2(finAng, 1),
      thrust: r2(sim.out.thrust, 0), bankDeg: r2((sim.out.roll - roll0) * 57.2958, 2) };
    // HANDS-OFF: brakes off, every control at zero
    const f0 = fwd(sim), c0 = sim.cgPos().slice();
    sim.ctl.brake = 0; sim.ctl.dr = 0; sim.ctl.da = 0; sim.ctl.de = 0;
    let swing = 0;
    for (let f = 0; f < 360; f++) { sim.step(1 / 60); }
    swing = leftOf(f0, fwd(sim));
    const c = sim.cgPos(), off = -(c[0] - c0[0]) * f0[1] + (c[2] - c0[2]) * f0[0];
    out.handsOff = { swingDeg: r2(swing, 2), V: r2(Math.hypot(sim.cgVel()[0], sim.cgVel()[2]), 1), offM: r2(off, 2) };
  }
  if (NOPILOT) return out;
  // --- THE PILOT round a circuit ---
  {
    const world = C.makeWorld(), sim = C.makeSim(def, world); sim.reset(0);
    const a = world.aerodromes.find(x => x.id === (sim.hydro ? 'SEA' : 'HOME')) || world.aerodromes[0];
    if (sim.hydro) C.placeAtAerodrome(sim, a);
    for (let i = 0; i < 600; i++) sim.step(1 / 60);
    const ap = C.makePilot(sim, def, world); if (sim.hydro) ap.setRoute(a, a);
    const ph = {}, P = sim.out.propFx;
    let rollF0 = null, rollC0 = null, maxOff = 0, lift = null, gyroPk = 0, gyroPkQ = 0, cutT = null;
    const tailUp = { yaw: 0, q: 0, V: 0 };
    const cut = { n: 0, dr: 0, da: 0, beta: 0, bank: 0, drMin: 0, V: 0 };
    for (let s = 0; s < 420 * 60; s++) {
      ap.update(1 / 60); sim.step(1 / 60);
      const k = ap.phase;
      if (k === 'ROLL' && !rollF0) { rollF0 = fwd(sim); rollC0 = sim.cgPos().slice(); }
      if (rollF0 && !lift && (k === 'ROLL' || k === 'LIFTOFF')) {
        const c = sim.cgPos(); maxOff = Math.max(maxOff, Math.abs(-(c[0] - rollC0[0]) * rollF0[1] + (c[2] - rollC0[2]) * rollF0[0]));
        let g = 0; for (let e = 0; e < P.Q.length; e++) g += P.gyro[e*3+1];
        const q = P.rate[0] * sim.axes()[2][0] + P.rate[1] * sim.axes()[2][1] + P.rate[2] * sim.axes()[2][2];   // + = nose up
        if (Math.abs(g) > Math.abs(gyroPk)) { gyroPk = g; gyroPkQ = q; }
        // THE TAIL-UP: the largest left yaw while the nose comes DOWN on the roll (a taildragger's tail rising)
        if (k === 'ROLL' && q < 0 && g > tailUp.yaw) { tailUp.yaw = g; tailUp.q = q; tailUp.V = sim.out.V; }
      }
      // THE ENGINE CUT: 4 s into the climb one engine stops (its lever off); 3 s for the pilot to catch it, then 10 s read
      if (CUT != null && k === 'CLIMB' && cutT == null && ph.CLIMB && ph.CLIMB.n >= 240) { cutT = ap.t; sim.ctl.eng = [0, 1].map(i => ({ on: i !== CUT, thr: 1 })); }
      if (cutT != null && ap.t > cutT + 3 && ap.t <= cutT + 13) { cut.n++; cut.dr += sim.ctl.dr; cut.da += sim.ctl.da; cut.beta += sim.out.beta; cut.bank += sim.out.roll; cut.V += sim.out.V; cut.drMin = Math.min(cut.drMin, sim.ctl.dr); }
      if (cutT != null && ap.t > cutT + 13) break;
      const r = ph[k] = ph[k] || { n: 0, dr: 0, da: 0, drMin: 0, drMax: 0, daMin: 0, daMax: 0, V: 0, beta: 0, bank: 0, tq: 0, pf: 0, gy: 0, t0: r2(ap.t, 1) };
      r.n++; r.dr += sim.ctl.dr; r.da += sim.ctl.da; r.V += sim.out.V; r.beta += sim.out.beta; r.bank += sim.out.roll;
      r.drMin = Math.min(r.drMin, sim.ctl.dr); r.drMax = Math.max(r.drMax, sim.ctl.dr); r.daMin = Math.min(r.daMin, sim.ctl.da); r.daMax = Math.max(r.daMax, sim.ctl.da);
      for (let e = 0; e < P.Q.length; e++) { r.tq += P.tq[e*3]; r.pf += P.pf[e*3+1]; r.gy += P.gyro[e*3+1]; }
      if (!lift && rollF0 && (k === 'CLIMB' || k === 'LIFTOFF') && ph.LIFTOFF && ph.LIFTOFF.n === 1) {
        const c = sim.cgPos(); lift = { offM: r2(-(c[0] - rollC0[0]) * rollF0[1] + (c[2] - rollC0[2]) * rollF0[0], 2), hdgDeg: r2(leftOf(rollF0, fwd(sim)), 2), along: r2((c[0] - rollC0[0]) * rollF0[0] + (c[2] - rollC0[2]) * rollF0[1], 1), t: r2(ap.t, 1) };
      }
      if (k === 'STOPPED' && ap.t > 3) break;
    }
    const phases = {};
    for (const [k, r] of Object.entries(ph)) phases[k] = { s: r2(r.n / 60, 1), V: r2(r.V / r.n, 1), dr: r2(r.dr / r.n, 3), drMin: r2(r.drMin, 3), drMax: r2(r.drMax, 3),
      da: r2(r.da / r.n, 3), daMin: r2(r.daMin, 3), daMax: r2(r.daMax, 3), betaDeg: r2(r.beta / r.n * 57.2958, 2), bankDeg: r2(r.bank / r.n * 57.2958, 2),
      tqRoll: r2(r.tq / r.n, 1), pfYaw: r2(r.pf / r.n, 1), gyroYaw: r2(r.gy / r.n, 1) };
    if (CUT != null) out.cut = { engine: CUT ? 'starboard' : 'port', at: r2(cutT, 1), n: cut.n, V: r2(cut.V / cut.n, 1), dr: r2(cut.dr / cut.n, 3), drMin: r2(cut.drMin, 3), da: r2(cut.da / cut.n, 3),
      betaDeg: r2(cut.beta / cut.n * 57.2958, 2), bankDeg: r2(cut.bank / cut.n * 57.2958, 2) };
    out.pilot = { outcome: ap.report && ap.report.outcome, t: r2(ap.t, 1), rollMaxOffM: r2(maxOff, 2), liftoff: lift, gyroPeakYaw: r2(gyroPk, 1), gyroPeakPitchRate: r2(gyroPkQ, 3),
      tailUp: { yaw: r2(tailUp.yaw, 1), q: r2(tailUp.q, 3), V: r2(tailUp.V, 1) }, phases };
  }
  return out;
}

if (arg('case')) { process.stdout.write(JSON.stringify(runCase(arg('case')))); process.exit(0); }

const only = arg('only') ? arg('only').split(',') : null;
const todo = CASES.filter(c => !only || only.includes(c.split(':')[0]));
const jobs = +arg('jobs', 4), res = {};
let next = 0, running = 0;
function launch(done) {
  while (running < jobs && next < todo.length) {
    const id = todo[next++]; running++;
    const args = [__filename, '--case=' + id].concat(NOPILOT ? ['--no-pilot'] : []);
    const ch = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = ''; ch.stdout.on('data', d => buf += d);
    ch.on('close', code => { running--; try { res[id] = JSON.parse(buf); } catch (e) { res[id] = { id, error: 'exit ' + code }; } process.stderr.write(`  done ${id}\n`); if (next >= todo.length && running === 0) done(); else launch(done); });
  }
}
launch(() => {
  const rows = todo.map(id => res[id]);
  const f = (x, n = 2) => x == null ? '-' : (typeof x === 'number' ? x.toFixed(n) : String(x));
  console.log('\nSTATIC (full throttle, brakes) and HANDS-OFF (6 s, controls at zero; swing + = LEFT)');
  console.log('case               | I kg.m2 | rpm   | Q N.m  | H N.m.s | swirl rad/s | Rw m | fin swirl deg | bank deg | swing deg | off m');
  for (const r of rows) { if (r.error) { console.log(r.id, r.error); continue; } const s = r.static, h = r.handsOff;
    console.log(`${r.id.padEnd(18)} | ${f(r.I, 3)} | ${s.rpm.join('/')} | ${s.Q.join('/')} | ${s.H.join('/')} | ${s.swirl.join('/')} | ${s.wakeR.join('/')} | ${f(s.finSwirlDeg, 1)} | ${f(s.bankDeg)} | ${f(h.swingDeg)} | ${f(h.offM)}`); }
  if (!NOPILOT) {
    console.log('\nTHE PILOT (dr < 0 = right rudder; da > 0 = roll right; moments + = nose left / left wing down, N.m)');
    console.log('case               | outcome   | roll off m | lift-off off m / hdg deg | ROLL dr mean [min] | gyro pk yaw (q) | tail-up gyro yaw (q, V) | CLIMB dr | da | beta deg | bank | tq roll | pf yaw | gyro yaw');
    for (const r of rows) { if (r.error || !r.pilot) continue; const p = r.pilot, R = p.phases.ROLL || {}, Cl = p.phases.CLIMB || {};
      console.log(`${r.id.padEnd(18)} | ${String(p.outcome).padEnd(9)} | ${f(p.rollMaxOffM)} | ${p.liftoff ? f(p.liftoff.offM) + ' / ' + f(p.liftoff.hdgDeg) : '-'} | ${f(R.dr, 3)} [${f(R.drMin)}] | ${f(p.gyroPeakYaw, 1)} (${f(p.gyroPeakPitchRate, 2)}) | ${f(p.tailUp.yaw, 1)} (${f(p.tailUp.q, 2)}, ${f(p.tailUp.V, 1)}) | ${f(Cl.dr, 3)} | ${f(Cl.da, 3)} | ${f(Cl.betaDeg)} | ${f(Cl.bankDeg)} | ${f(Cl.tqRoll, 0)} | ${f(Cl.pfYaw, 1)} | ${f(Cl.gyroYaw, 1)}`); }
  }
  const cuts = rows.filter(r => r && r.cut);
  if (cuts.length) {
    console.log('\nTHE ENGINE CUT, the twin in the climb (10 s from 3 s after the cut): the rudder, aileron, slip and bank the pilot holds');
    for (const r of cuts) console.log(`${r.id.padEnd(22)} | ${r.cut.engine.padEnd(9)} out | V ${f(r.cut.V, 1)} | dr ${f(r.cut.dr, 3)} [${f(r.cut.drMin)}] | da ${f(r.cut.da, 3)} | beta ${f(r.cut.betaDeg)} | bank ${f(r.cut.bankDeg)}`);
  }
  const dst = path.join(T, '..', 'reports', 'evidence', 'engine_torque_g2080.json');
  if (!only) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, JSON.stringify({ when: new Date().toISOString().slice(0, 10), cases: res }, null, 1)); console.log('\nwrote ' + path.relative(path.join(T, '..'), dst)); }
});
