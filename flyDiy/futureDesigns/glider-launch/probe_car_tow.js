// Probe: a kinematic car tows the motorglider (engine off) on a 40 m elastic rope, hands-off or with a pitch-hold.
'use strict';
const path = require('path');
const T = path.join(__dirname, '..', '..', 'tools');   // run from anywhere: node futureDesigns/glider-launch/probe_car_tow.js
const src = require('fs').readFileSync(path.join(T, 'arch_fly.js'), 'utf8');
eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(T)).replace('function loadPanel()', 'global.loadPanel = function ()'));
global.loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const C = require(path.join(T, 'flight_core.js'));
const key = process.argv[2] || 'motorglider';
const Vcar = +(process.argv[3] || 28), pitchHold = process.argv[4] === 'hold';
const a = D.ARCHETYPES.find(x => x.key === key);
const def = C.buildGen(D.designBake(a.sel, a.over));
const world = C.makeWorld();
const sim = C.makeSim(def, world); sim.reset(0);
for (let i = 0; i < 600; i++) sim.step(1/60);
const [xA, yU] = sim.axes();
const fwd = [-xA[0], 0, -xA[2]]; const fl = Math.hypot(fwd[0], fwd[2]); fwd[0] /= fl; fwd[2] /= fl;
const cg0 = sim.cgPos(); const n = sim.n, p = sim.p, v = sim.v;
// tow hook = the most-forward node within 0.25 m of the centre plane, lower half
let hook = -1, best = -1e9;
const [, , zR] = sim.axes();
for (let i = 0; i < n; i++) {
  const d = [p[i*3]-cg0[0], p[i*3+1]-cg0[1], p[i*3+2]-cg0[2]];
  const ahead = d[0]*fwd[0] + d[2]*fwd[2], side = d[0]*zR[0]+d[1]*zR[1]+d[2]*zR[2], up = d[1];
  if (Math.abs(side) < 0.25 && up < 0.3 && ahead > best) { best = ahead; hook = i; }
}
const L0 = 40, k = 2500, c = 300;  // rope: 40 m, ~2.5 kN/m (a nylon tow rope), light damping
const hp0 = [p[hook*3], p[hook*3+1], p[hook*3+2]];
let car = [hp0[0] + fwd[0]*L0, hp0[1], hp0[2] + fwd[2]*L0], carV = 0;
const acc = 2.0;   // m/s^2, a car flat out
let Tmax = 0, liftT = null, slack = 0, tNow = 0;
sim.onSubstep = (s, dt) => {
  const cx = car[0] + fwd[0]*carV*s*dt, cz = car[2] + fwd[2]*carV*s*dt;
  const d = [cx - p[hook*3], car[1] - p[hook*3+1], cz - p[hook*3+2]];
  const L = Math.hypot(d[0], d[1], d[2]); const u = d.map(x => x / L);
  const vr = -(v[hook*3]*u[0] + v[hook*3+1]*u[1] + v[hook*3+2]*u[2]) + carV;   // stretch rate
  let F = k * (L - L0) + c * vr; if (L <= L0 || F < 0) { F = 0; slack++; }
  Tmax = Math.max(Tmax, F);
  sim.impulse(hook, u[0]*F*dt, u[1]*F*dt, u[2]*F*dt);
};
const g0 = world.terrainH ? world.terrainH(cg0[0], cg0[2]) : cg0[1];
const out = [];
for (let f = 0; f < 60 * 40; f++) {
  tNow = f / 60;
  carV = Math.min(Vcar, carV + acc / 60);
  sim.ctl.thr = 0;
  if (pitchHold) { const [xa] = sim.axes(); const pitch = Math.asin(-xa[1]) * 57.3; const want = tNow < 6 ? 2 : 8; sim.ctl.de = Math.max(-0.6, Math.min(0.6, 0.05 * (want - pitch))); }
  sim.step(1/60);
  car[0] += fwd[0]*carV/60; car[2] += fwd[2]*carV/60;
  if (sim.stats().bad) { out.push('DIVERGED at ' + tNow.toFixed(1)); break; }
  const cg = sim.cgPos(), cv = sim.cgVel();
  const agl = cg[1] - cg0[1];
  if (liftT === null && !sim.wheelsOnGround()) liftT = tNow;
  if (f % 120 === 0) { const [xa] = sim.axes(); out.push(`t ${tNow.toFixed(0).padStart(2)}  car ${carV.toFixed(1)}  glider V ${Math.hypot(cv[0],cv[1],cv[2]).toFixed(1)}  height ${agl.toFixed(1)}  pitch ${(Math.asin(-xa[1])*57.3).toFixed(1)}  wheelsOn ${sim.wheelsOnGround()}`); }
}
console.log(`${key} mass ${sim.totalM.toFixed(0)} kg, hook node ${hook} (${best.toFixed(2)} m ahead of CG), car to ${Vcar} m/s${pitchHold ? ', pitch-hold' : ', hands-off'}`);
console.log(out.join('\n'));
console.log('peak rope tension', (Tmax/1000).toFixed(2), 'kN; first wheels-off at', liftT, 's; slack substeps', slack);
