#!/usr/bin/env node
// G2470 JODEL-PITCH - THE EVIDENCE: GATE ROUTE's flight (tools/_route_check.js B: Jolene, lined up at HOME, the same
// five points, the damage ON) flown by THE PILOT, every step measured on the route. Runs on whichever tree it sits in
// (copy it into a worktree of the base to fly the "before").
//
//   node tools/jodel_pitch_probe.js jodel [--propfx off] [--csv out.csv] [--t0 360 --t1 480] [--budget]
//
// The summary (the last line, JSON): the gate's own vertical-speed check (the 1 s mean against TECS's limits +-0.5:
// steps outside, the worst), the pitch rate's peak and the seconds over 5 deg/s, the elevator's reversals per minute
// (GATE PILOTACT's counter), the flown-minus-asked vertical speed rms, the elevator's range on the route, and the WP
// captures. --csv: the 0.1 s trace between t0 and t1 (pitch, q, elevator, TECS's pitch demand, vs flown / asked, V,
// throttle, alpha, the stab's lift, the heading, and the Munk couple as the solver applies it vs as it should be).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const L = require(path.join(T, '_treecrash_lib.js'));
const C = L.core();
const IN = require(path.join(T, 'island_node.js'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const KEY = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'jodel';
const END = KEY === 'cub' ? 'home' : KEY === 'metal' ? 'land' : 'hold';
const T0 = +opt('t0', 360), T1 = +opt('t1', 480), CSV = opt('csv', null);
if (opt('propfx', 'on') === 'off') C.PAR.propFx = { torque: 0, gyro: 0, pfactor: 0, swirl: 0 };
const D = 180 / Math.PI;
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const H = W.aerodromes.find(a => a.id === 'HOME');
const ROUTE_PTS = [[1500, -2500, 170], [-1500, -5500, 350], [-4000, -3000, 300], [-3500, 0, 220], [-1500, 2500, 170]];
const R = C.routeNew('gate'); R.end = END;
for (const [dx, dz, h] of ROUTE_PTS) R.pts.push({ x: Math.round(H.x + dx), z: Math.round(H.z + dz), alt: h, ref: 'msl', V: null });
const def = L.defOf(KEY);
const sim = C.makeSim(def, W);
sim.reset(0); if (sim.stance) sim.stance();
const site = C.siteOf(H.id);
C.placeAtStand(sim, H, site.stand); C.seatOnGround(sim, (x, z) => W.terrainH(x, z), def.refs);
const q0 = C.makePilot(sim, def, W, {}); q0.setRoute(H, H); q0.departFrom(H, H, site);
const pose = q0.lineupPose();
sim.reset(0); if (sim.stance) sim.stance();
C.placeAtLineup(sim, H, pose, W, def.refs);
if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
const ap = C.makePilot(sim, def, W, {});
ap.departFrom(H, H, site, { atHold: pose });
ap.flyRoute(R);
// the Munk couple: what the solver's force pair makes (the pair's own moment: F x the rings' spacing along the body) -
// read off the def's records, the same formula, for the trace only
const MK = def.params.bodyMunk, rA = def.refs.fusDrag, rB = def.refs.fusDragAft;
function munk() {
  if (!MK || !rA || !rB) return [0, 0];
  const p = sim.p, v = sim.v, o = sim.out, cen = ids => { const c = [0, 0, 0]; for (const i of ids) for (let k = 0; k < 3; k++) c[k] += p[i * 3 + k] / ids.length; return c; };
  const a = cen(rA), b = cen(rB);
  let vx = 0, vy = 0, vz = 0; for (const i of rA) { vx += v[i * 3] / rA.length; vy += v[i * 3 + 1] / rA.length; vz += v[i * 3 + 2] / rA.length; }
  const ax = sim.axes ? sim.axes() : null;
  if (!ax) return [0, 0];
  const xA = ax.xAft || ax[0], yU = ax.yUp || ax[1];
  const u = -(vx * xA[0] + vy * xA[1] + vz * xA[2]), wn = -(vx * yU[0] + vy * yU[1] + vz * yU[2]);
  const M = 2 * MK.K * MK.vol * 0.5 * o.rho * (u * u + wn * wn) * Math.sin(2 * Math.atan2(wn, u)) * 0.5;
  const Lb = Math.abs((b[0] - a[0]) * xA[0] + (b[1] - a[1]) * xA[1] + (b[2] - a[2]) * xA[2]), Lw = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [M, Lw > 0.3 ? M * Lb / Lw : 0];   // [the true couple, the pre-G2470 pair's (the world x-y arm)]
}
const ACT_H = 0.03;
const rev = () => { const S = { r: 0, d: 0, x: null }; return { step(v) { if (S.x == null) { S.x = v; return; } const dv = v - S.x;
  if (S.d === 0) { if (Math.abs(dv) > ACT_H) { S.d = Math.sign(dv); S.x = v; } } else if (S.d * dv > 0) S.x = v;
  else if (-S.d * dv > ACT_H) { S.r++; S.d = -S.d; S.x = v; } }, get n() { return S.r; } }; };
const de = rev();
const rows = [];
const vsWin = []; let vsSum = 0, bad = 0, worst = 0, worstT = null, qMax = 0, qT = null, qN = 0, n = 0, eSq = 0, deMin = 1, deMax = -1;
const capT = R.pts.map(() => ({ d: Infinity, t: null }));
const maxS = END === 'hold' ? 700 : 1700;
for (let s = 0; s < maxS * 60; s++) {
  ap.update(1 / 60); sim.step(1 / 60);
  const I = ap.intent, o = sim.out, v = sim.cgVel(), c = sim.cgPos(), d = ap.dbg || {}, td = d.tecs || {};
  if (I.phase === 'ROUTE') {
    n++; de.step(sim.ctl.de);
    deMin = Math.min(deMin, sim.ctl.de); deMax = Math.max(deMax, sim.ctl.de);
    vsWin.push(v[1]); vsSum += v[1]; if (vsWin.length > 60) vsSum -= vsWin.shift();
    if (vsWin.length === 60) { const m = vsSum / 60, ex = Math.max(m - I.vsUp, I.vsDn - m); if (ex > 0.5) bad++; if (ex > worst) { worst = ex; worstT = ap.t; } }
    const qq = Math.abs(d.q || 0) * D; if (qq > qMax) { qMax = qq; qT = ap.t; } if (qq > 5) qN++;
    if (td.hdotC != null) eSq += (v[1] - td.hdotC) ** 2;
    for (let i = 0; i < R.pts.length; i++) { const dd = Math.hypot(R.pts[i].x - c[0], R.pts[i].z - c[2]); if (dd < capT[i].d) { capT[i].d = dd; capT[i].t = ap.t; } }
  }
  if (CSV && ap.t >= T0 && ap.t <= T1 && s % 6 === 0) {
    const [mT, mW] = munk();
    rows.push([ap.t.toFixed(1), ap.phase, (d.th * D).toFixed(2), (d.q * D).toFixed(2), sim.ctl.de.toFixed(4), td.thC != null ? (td.thC * D).toFixed(2) : '',
      v[1].toFixed(2), td.hdotC != null ? td.hdotC.toFixed(2) : '', o.V.toFixed(2), sim.ctl.thr.toFixed(3), (o.alpha * D).toFixed(2), o.stabFy.toFixed(0),
      (((o.hdg * D) % 360) + 360) % 360 | 0, mT.toFixed(0), mW.toFixed(0)].join(','));
  }
  if (ap.phase === 'LOITER' && ap.t > 600) break;
  if (ap.phase === 'STOPPED' && ap.t > 3) break;
  if (!L.finite(sim)) break;
}
if (CSV) fs.writeFileSync(CSV, 't,phase,pitch_deg,q_dps,de,thC_deg,vs,vs_asked,V,thr,alpha_deg,stabFy_N,hdg_deg,munk_true_Nm,munk_worldarm_Nm\n' + rows.join('\n') + '\n');
const r1 = x => Math.round(x * 10) / 10, r3 = x => Math.round(x * 1000) / 1000;
const out = { key: KEY, propfx: opt('propfx', 'on'), routeS: r1(n / 60), vsFlownBadSteps: bad, vsFlownWorst: r3(worst), vsFlownWorstT: worstT && r1(worstT),
  qMaxDps: r1(qMax), qMaxT: qT && r1(qT), qOver5S: r1(qN / 60), deRevPerMin: r1(de.n / Math.max(0.5, n / 3600)), vsErrRms: r3(Math.sqrt(eSq / Math.max(1, n))),
  deRange: [r3(deMin), r3(deMax)], captures: capT.map(q => Math.round(q.d)), end: ap.phase };
console.log(JSON.stringify(out));
