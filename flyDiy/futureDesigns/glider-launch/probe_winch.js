// Probe: a WINCH launch - the car tow's line with its far end a fixed drum that reels in. The motorglider (engine off) at
// the end of a 600 m line; the drum spins up to the reel-in speed under a tension cap (the driver's throttle as a
// constant-tension law); the glider holds a pitch schedule (ground run, the rotation, the full climb, eased when slow);
// released when the line passes 65 deg above the horizon at the glider. node futureDesigns/glider-launch/probe_winch.js [L0] [vReel] [Tcap]
'use strict';
const path = require('path');
const T = path.join(__dirname, '..', '..', 'tools');
const src = require('fs').readFileSync(path.join(T, 'arch_fly.js'), 'utf8');
eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(T)).replace('function loadPanel()', 'global.loadPanel = function ()'));
global.loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const C = require(path.join(T, 'flight_core.js'));
const L0 = +(process.argv[2] || 600), VR = +(process.argv[3] || 24), TCAP = +(process.argv[4] || 4500);
const a = D.ARCHETYPES.find(x => x.key === 'motorglider');
const def = C.buildGen(D.designBake(a.sel, a.over));
const world = C.makeWorld();
const sim = C.makeSim(def, world); sim.reset(0);
for (let i = 0; i < 600; i++) sim.step(1/60);
if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'off' });
const [xA, , zR] = sim.axes();
const fwd = [-xA[0], 0, -xA[2]]; { const l = Math.hypot(fwd[0], fwd[2]); fwd[0] /= l; fwd[2] /= l; }
const p = sim.p, v = sim.v, cg0 = sim.cgPos(), M = sim.totalM;
let hook = -1, best = -1e9;
for (let i = 0; i < sim.n; i++) {
  const d = [p[i*3]-cg0[0], p[i*3+1]-cg0[1], p[i*3+2]-cg0[2]], ah = d[0]*fwd[0] + d[2]*fwd[2], sd = d[0]*zR[0]+d[1]*zR[1]+d[2]*zR[2];
  if (Math.abs(sd) < 0.25 && d[1] < 0.3 && ah > best) { best = ah; hook = i; }
}
const DRUM = [p[hook*3] + fwd[0]*L0, p[hook*3+1] + 0.4, p[hook*3+2] + fwd[2]*L0];   // the drum's fairlead, 1 m up on the far end
const EA = 1e6, zeta = 0.5;
let Lrest = L0 + 1, vd = 0, F = 0, Fmax = 0, released = null, relInfo = null, tNow = 0;
sim.onSubstep = (s, dt) => {
  if (released) { F = 0; return; }
  const d = [DRUM[0]-p[hook*3], DRUM[1]-p[hook*3+1], DRUM[2]-p[hook*3+2]], L = Math.hypot(...d), u = d.map(x => x / L);
  const k = EA / Lrest, c = 2 * zeta * Math.sqrt(k * M);
  const rate = -(v[hook*3]*u[0] + v[hook*3+1]*u[1] + v[hook*3+2]*u[2]) + vd;   // d(L - Lrest)/dt: the glider closing shortens L, the drum shortens Lrest
  F = L > Lrest ? Math.max(0, k * (L - Lrest) + c * rate) : 0;
  if (F > Fmax) Fmax = F;
  if (F > 0) sim.impulse(hook, u[0]*F*dt, u[1]*F*dt, u[2]*F*dt);
  Lrest -= vd * dt;
};
const out = [], deg = r => r * 57.2958;
for (let f = 0; f < 60 * 90; f++) {
  tNow = f / 60;
  // the drum: the driver opens up over 3 s to the reel-in speed, and backs off whenever the line pulls over the cap
  vd = F > TCAP ? Math.max(0, vd - 6 / 60) : Math.min(VR, vd + (VR / 3) / 60);
  const [xa] = sim.axes(), pitch = deg(Math.asin(-xa[1])), cg = sim.cgPos(), cv = sim.cgVel(), V = Math.hypot(...cv), h = cg[1] - cg0[1];
  // the glider's pitch schedule: tail up on the run, rotate at 22 m/s, the full climb from 10 m, eased off below 24 m/s
  let want = V < 22 ? 2 : h < 10 ? 10 : 34;
  if (V < 24 && h >= 10) want = Math.max(5, want - 3 * (24 - V) * 3);
  if (released) want = -2;
  sim.ctl.thr = 0; sim.ctl.de = Math.max(-1, Math.min(1, 0.12 * (want - pitch)));
  sim.step(1/60);
  if (sim.stats().bad) { out.push('DIVERGED ' + tNow.toFixed(1)); break; }
  if (!released) {
    const d = [DRUM[0]-p[hook*3], DRUM[1]-p[hook*3+1], DRUM[2]-p[hook*3+2]], ang = deg(Math.atan2(-d[1], Math.hypot(d[0], d[2])));
    if (ang > 65) { released = 'line at ' + ang.toFixed(0) + ' deg'; relInfo = { t: tNow, h, V, ground: Math.hypot(d[0], d[2]), Lrest }; }
    if (Lrest < 30) { released = 'line wound in'; relInfo = { t: tNow, h, V, ground: Math.hypot(d[0], d[2]), Lrest }; }
  }
  if (f % 180 === 0) out.push(`t ${tNow.toFixed(0).padStart(2)}  drum ${vd.toFixed(1)} m/s  line ${(F/1000).toFixed(2)} kN  V ${V.toFixed(1)}  h ${h.toFixed(0).padStart(4)}  pitch ${pitch.toFixed(0).padStart(3)}  ${released ? 'FREE' : 'on'}`);
  if (released && tNow > relInfo.t + 6) break;
}
console.log(`winch: line ${L0} m, reel ${VR} m/s, tension cap ${TCAP/1000} kN; glider ${M.toFixed(0)} kg (weight ${(M*9.81/1000).toFixed(2)} kN)`);
console.log(out.join('\n'));
console.log('release:', released, relInfo && `t ${relInfo.t.toFixed(1)} s, height ${relInfo.h.toFixed(0)} m, V ${relInfo.V.toFixed(1)} m/s, ${relInfo.ground.toFixed(0)} m from the drum`, '| peak line', (Fmax/1000).toFixed(2), 'kN');
