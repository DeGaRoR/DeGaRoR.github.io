// Probe: two sims in one world, a C172-alike tug and the motorglider (engine off) on a 50 m rope, crude pitch-holds.
'use strict';
const path = require('path');
const T = path.join(__dirname, '..', '..', 'tools');   // run from anywhere: node futureDesigns/glider-launch/probe_aerotow.js
const src = require('fs').readFileSync(path.join(T, 'arch_fly.js'), 'utf8');
eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(T)).replace('function loadPanel()', 'global.loadPanel = function ()'));
global.loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const C = require(path.join(T, 'flight_core.js'));
const bake = k => { const a = D.ARCHETYPES.find(x => x.key === k); return C.buildGen(D.designBake(a.sel, a.over)); };
const world = C.makeWorld();
const tug = C.makeSim(bake(process.argv[2] || 'c172'), world); tug.reset(0);
const gl = C.makeSim(bake('motorglider'), world); gl.reset(0);
for (let i = 0; i < 600; i++) { tug.step(1/60); gl.step(1/60); }
const fwdOf = s => { const [xa] = s.axes(); const f = [-xa[0], 0, -xa[2]], l = Math.hypot(f[0], f[2]); return [f[0]/l, 0, f[2]/l]; };
const fwd = fwdOf(tug);
const L0 = 50;
// put the glider L0 + its hook offset behind the tug: translate every node
function hookOf(s, sign) { // sign +1 = most forward, -1 = most aft
  const cg = s.cgPos(), [, , zR] = s.axes(); let h = -1, b = -1e9;
  for (let i = 0; i < s.n; i++) { const d = [s.p[i*3]-cg[0], s.p[i*3+1]-cg[1], s.p[i*3+2]-cg[2]];
    const ah = sign * (d[0]*fwd[0] + d[2]*fwd[2]), sd = d[0]*zR[0]+d[1]*zR[1]+d[2]*zR[2];
    if (Math.abs(sd) < 0.25 && d[1] < 0.4 && ah > b) { b = ah; h = i; } }
  return h; }
const hT = hookOf(tug, -1), hG = hookOf(gl, +1);
const P = (s, i) => [s.p[i*3], s.p[i*3+1], s.p[i*3+2]], V = (s, i) => [s.v[i*3], s.v[i*3+1], s.v[i*3+2]];
{ const a = P(tug, hT), b = P(gl, hG); const tx = a[0] - fwd[0]*(L0 - 0.5) - b[0], tz = a[2] - fwd[2]*(L0 - 0.5) - b[2];
  for (let i = 0; i < gl.n; i++) { gl.p[i*3] += tx; gl.p[i*3+2] += tz; } }
for (let i = 0; i < 120; i++) { tug.step(1/60); gl.step(1/60); }
const k = 3000, c = 400;
let F = [0, 0, 0], Tmax = 0, snap = { a: null, b: null, va: null, vb: null };
function ropeAt(s, i, other, tSub) {   // force on sim s's hook, the other end extrapolated from the frame start
  const a = P(s, i), o = [other.a[0] + other.v[0]*tSub, other.a[1] + other.v[1]*tSub, other.a[2] + other.v[2]*tSub];
  const d = [o[0]-a[0], o[1]-a[1], o[2]-a[2]], L = Math.hypot(...d), u = d.map(x => x / L);
  const va = V(s, i), vr = (other.v[0]-va[0])*u[0] + (other.v[1]-va[1])*u[1] + (other.v[2]-va[2])*u[2];
  let f = k*(L - L0) + c*vr; if (L <= L0 || f < 0) f = 0; Tmax = Math.max(Tmax, f); return u.map(x => x*f); }
let ends = {};
tug.onSubstep = (s, dt) => { const f = ropeAt(tug, hT, ends.g, (s+1)*dt); tug.impulse(hT, f[0]*dt, f[1]*dt, f[2]*dt); };
gl.onSubstep  = (s, dt) => { const f = ropeAt(gl, hG, ends.t, (s+1)*dt); gl.impulse(hG, f[0]*dt, f[1]*dt, f[2]*dt); };
const pitchOf = s => Math.asin(-s.axes()[0][1]) * 57.3, speed = s => Math.hypot(...s.cgVel());
const clamp = x => Math.max(-0.7, Math.min(0.7, x));
const left = [fwd[2], 0, -fwd[0]];   // candidate left vector; sign measured below via zRt
const org = tug.cgPos();
const bankR = s => { const zR = s.axes()[2]; return -Math.asin(zR[1]) * 57.3; };      // right wing down = +
const headL = s => { const f = fwdOf(s); return Math.atan2(f[0]*left[0] + f[2]*left[2], f[0]*fwd[0] + f[2]*fwd[2]) * 57.3; }; // nose left of runway = +
const offL = (s, q) => { const c = q || s.cgPos(); return (c[0]-org[0])*left[0] + (c[2]-org[2])*left[2]; };
function lat(s, wantHeadL) { s.ctl.da = clamp(-0.03 * bankR(s) + 0.02 * (headL(s) - wantHeadL)); s.ctl.dr = clamp(-0.04 * (headL(s) - wantHeadL)); }
const ZRL = tug.axes()[2]; console.log('left-vector check (should be ~ -1):', (ZRL[0]*left[0] + ZRL[2]*left[2]).toFixed(2));
const y0T = tug.cgPos()[1], y0G = gl.cgPos()[1], out = [];
let msT = 0;
for (let f = 0; f < 60 * 70; f++) {
  const t = f / 60;
  ends = { t: { a: P(tug, hT), v: V(tug, hT) }, g: { a: P(gl, hG), v: V(gl, hG) } };
  tug.ctl.thr = 1; gl.ctl.thr = 0;
  const vT = speed(tug), hT_ = tug.cgPos()[1] - y0T, hG_ = gl.cgPos()[1] - y0G;
  tug.ctl.de = clamp(0.06 * ((vT < 27 ? 0 : (vT < 33 ? 6 : 6 + 0.8*(vT - 33))) - pitchOf(tug)));   // rotate at 27 m/s, then climb with speed
  // the glider holds the tug's height (the "high tow" station) via a pitch target
  const tgtPitch = speed(gl) < 18 ? 2 : Math.max(-4, Math.min(10, 3 + 0.4 * ((hT_ + 1.5) - hG_)));
  gl.ctl.de = clamp(0.06 * (tgtPitch - pitchOf(gl)));
  lat(tug, Math.max(-20, Math.min(20, -2 * offL(tug))));
  { const a = P(tug, hT), b = P(gl, hG); lat(gl, Math.max(-30, Math.min(30, -1.5 * (offL(gl, b) - offL(gl, a))))); }
  const t0 = process.hrtime.bigint(); tug.step(1/60); gl.step(1/60); msT += Number(process.hrtime.bigint() - t0) / 1e6;
  if (tug.stats().bad || gl.stats().bad) { out.push('DIVERGED ' + t.toFixed(1)); break; }
  if (f % 300 === 0) {
    const d = Math.hypot(...P(tug, hT).map((x, j) => x - P(gl, hG)[j]));
    out.push(`t ${t.toFixed(0).padStart(2)}  tug V ${vT.toFixed(1)} h ${hT_.toFixed(0).padStart(4)} pitch ${pitchOf(tug).toFixed(1).padStart(5)} | glider V ${speed(gl).toFixed(1)} h ${hG_.toFixed(0).padStart(4)} pitch ${pitchOf(gl).toFixed(1).padStart(5)} | rope ${d.toFixed(1)} m | lat tug ${offL(tug).toFixed(1)} gl ${offL(gl).toFixed(1)} thrust ${(tug.out.thrust||0).toFixed(0)}`);
  }
}
console.log(out.join('\n'));
console.log('peak tension', (Tmax/1000).toFixed(2), 'kN; two-sim step', (msT / (60*70)).toFixed(1), 'ms/frame');
