// Probe: the floatplane on a kinematic trailer deck (1 m up), held by four latched spring-dampers at its keels;
// the car drives, the plane runs full power, the latches open when the wing carries the weight.
'use strict';
const path = require('path');
const T = path.join(__dirname, '..', '..', 'tools');   // run from anywhere: node futureDesigns/glider-launch/probe_trailer.js
const src = require('fs').readFileSync(path.join(T, 'arch_fly.js'), 'utf8');
eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(T)).replace('function loadPanel()', 'global.loadPanel = function ()'));
global.loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const C = require(path.join(T, 'flight_core.js'));
const a = D.ARCHETYPES.find(x => x.key === 'floatplane');
const def = C.buildGen(D.designBake(a.sel, a.over));
const world = C.makeWorld();
const sim = C.makeSim(def, world); sim.reset(0);
for (let i = 0; i < 300; i++) sim.step(1/60);
const [xA, , zR] = sim.axes();
const fwd = [-xA[0], 0, -xA[2]]; { const l = Math.hypot(fwd[0], fwd[2]); fwd[0] /= l; fwd[2] /= l; }
const DECK = 1.0, n = sim.n, p = sim.p, v = sim.v, M = sim.totalM, g = 9.81;
for (let i = 0; i < n; i++) { p[i*3+1] += DECK; v[i*3] = v[i*3+1] = v[i*3+2] = 0; }
// the four cradle points: the lowest node in each (fore/aft x left/right) quadrant
const cg = sim.cgPos(); const quad = [[-1,-1],[-1,1],[1,-1],[1,1]].map(() => ({ i: -1, y: 1e9 }));
for (let i = 0; i < n; i++) {
  const d = [p[i*3]-cg[0], p[i*3+1]-cg[1], p[i*3+2]-cg[2]];
  const ah = d[0]*fwd[0]+d[2]*fwd[2], sd = d[0]*zR[0]+d[1]*zR[1]+d[2]*zR[2];
  if (Math.abs(sd) < 0.3) continue;
  const q = (ah > 0 ? 2 : 0) + (sd > 0 ? 1 : 0);
  if (Math.abs(ah) > 0.8 && p[i*3+1] < quad[q].y) quad[q] = { i, y: p[i*3+1] };
}
const pins = quad.map(q => ({ i: q.i, a: [p[q.i*3], p[q.i*3+1], p[q.i*3+2]] }));
const k = 40000, c = 3000; const PL = [0,0,0,0]; let latched = true, deckX = 0, deckV = 0, Fz = 0, relT = null, relV = null, minClear = 1e9;
sim.onSubstep = (s, dt) => {
  if (!latched) return;
  const off = deckX + deckV * (s + 1) * dt; Fz = 0;
  for (let qi = 0; qi < 4; qi++) { const q = pins[qi]; PL[qi] = 0;
    const tx = q.a[0] + fwd[0]*off, ty = q.a[1], tz = q.a[2] + fwd[2]*off, i = q.i;
    const fx = k*(tx - p[i*3]) + c*(fwd[0]*deckV - v[i*3]), fy = k*(ty - p[i*3+1]) + c*(0 - v[i*3+1]), fz = k*(tz - p[i*3+2]) + c*(fwd[2]*deckV - v[i*3+2]);
    if (fy <= 0) continue;                 // a cradle pushes up, it never holds down: the aeroplane can rotate off it
    const hx = Math.max(-fy, Math.min(fy, fx)), hz = Math.max(-fy, Math.min(fy, fz));   // the chocks hold sideways up to mu 1
    PL[qi] = fy; Fz += fy; sim.impulse(i, hx*dt, fy*dt, hz*dt);
  }
};
const out = [], y0 = sim.cgPos()[1];
let FzAvg = M * g;
for (let f = 0; f < 60 * 45; f++) {
  const t = f / 60;
  sim.ctl.thr = 1;
  const [xa] = sim.axes(), pitch = Math.asin(-xa[1]) * 57.3, V = Math.hypot(...sim.cgVel());
  sim.ctl.de = Math.max(-1, Math.min(1, 0.25 * ((V < 22 ? 0 : 7) - pitch)));
  // the car: the trailer keeps pace with the aeroplane up to 30 m/s, never faster than it can accelerate
  deckV = Math.min(+(process.argv[2] || 30), deckV + 2.5/60);
  sim.step(1/60);
  deckX += deckV / 60;
  FzAvg += (Fz - FzAvg) * 0.1;
  if (latched && FzAvg < 0.1 * M * g && t > 3) { latched = false; relT = t; relV = V; }
  if (!latched) { const lo = Math.min(...Array.from({ length: n }, (_, i) => p[i*3+1])); minClear = Math.min(minClear, lo - (y0 - DECK - 1)); }
  if (sim.stats().bad) { out.push('DIVERGED ' + t.toFixed(1)); break; }
  if (f % 180 === 0) out.push(`t ${t.toFixed(0).padStart(2)} deck ${deckV.toFixed(1)}  plane V ${V.toFixed(1)}  h ${(sim.cgPos()[1]-y0).toFixed(1)}  pitch ${pitch.toFixed(1)}  cradle load ${(FzAvg/(M*g)*100).toFixed(0)}% W  ${latched ? 'latched' : 'free'} pins ${PL.map(x => (x/1000).toFixed(1)).join('/')} kN thr ${(sim.out.thrust||0).toFixed(0)} N de ${sim.ctl.de.toFixed(2)}`);
}
console.log(`floatplane ${M.toFixed(0)} kg, pins ${pins.map(q => q.i).join(',')}`);
console.log(out.join('\n'));
console.log('released at', relT && relT.toFixed(1), 's, V', relV && relV.toFixed(1), 'm/s');
