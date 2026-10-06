// G2035 (DMG-DRIVE2): THE TAXI INTO A TRUNK, FRAME BY FRAME - what DMG-DRIVE graded, when, from what bite, at what rpm and
// where the trunk was against the propeller's disc at that moment; when the first engine-mount member broke. The user's
// Cub / the Jodel / the metal Cessna on TREECRASH's flat world (tools/_treecrash_lib.js atTrunk: the certificate stamped,
// damage ON), a trunk 6 m ahead of the CG (r 0.3 m), the throttle held at `thr` from the push.
//   node tools/dmg_drive2_probe.js [--builds cub,jodel,metal] [--V 1,2,3,4,5] [--thr 0,0.3] [--json out.json] [--trace]
//   (FLYDIY_CERT_DIR=<dir> reads each build's certificate from <dir>/<key>.json, as GATE DMGNOSE's children do)
'use strict';
const path = require('path'), fs = require('fs');
const L = require('./_treecrash_lib.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const builds = arg('builds', 'cub,jodel,metal').split(','), Vs = arg('V', '1,2,3,4,5').split(',').map(Number);
const thrs = arg('thr', '0,0.3').split(',').map(Number), wantTrace = process.argv.includes('--trace');

function run(key, V, thr) {
  const C = L.core();
  let mountT = null, mountM = null, strikeT = null, strikeRec = null, axAt = null, latAt = null, Vat = null;
  const trace = [];
  const r = L.atTrunk(key, { D: 6, V, thr, cert: true, secs: 6, onFrame(sim, f) {
    const D = sim.damage(), dr = D.drive && D.drive[0], def = sim.def || null;
    const dfn = r0.def;
    // the disc: the thrust nodes' mean (the flange), the heading
    const E = dfn.refs.engine || [], EO = dfn.refs.engineOf || E.map(() => 0);
    let hx = 0, hy = 0, hz = 0, c = 0;
    for (let j = 0; j < E.length; j++) if ((EO[j] | 0) === 0) { hx += sim.p[E[j]*3]; hy += sim.p[E[j]*3+1]; hz += sim.p[E[j]*3+2]; c++; }
    hx /= c; hy /= c; hz /= c;
    const ax = sim.axes()[0], hl = Math.hypot(ax[0], ax[2]), fx = -ax[0] / hl, fz = -ax[2] / hl;
    const T = r0.trunk, dx = T.x - hx, dz = T.z - hz, along = dx * fx + dz * fz, lat = Math.abs(-dx * fz + dz * fx);
    const v = sim.cgVel(), Vf = v[0] * fx + v[2] * fz;
    if (dr && dr.strike && strikeT == null) { strikeT = sim.t; strikeRec = Object.assign({}, dr.strikeAt); axAt = along - T.r; latAt = lat; Vat = Vf; }
    if (mountT == null && D.broken.length) for (const bi of D.broken) { const b = sim.beams[bi], ta = dfn.nodes[b.a].tag || '', tb = dfn.nodes[b.b].tag || '';
      if (/^(ENG|CGE)/.test(ta) !== /^(ENG|CGE)/.test(tb)) { mountT = sim.t; mountM = ta + '-' + tb; break; } }
    if (wantTrace && f % 2 === 0) trace.push({ t: +sim.t.toFixed(3), V: +Vf.toFixed(3), rpm: Math.round(sim.out.rpm[0] || 0), gap: +(along - T.r).toFixed(3), lat: +lat.toFixed(3),
      strike: dr ? dr.strike : null, crush: dr ? +dr.crush.toFixed(3) : 0, layer: dr ? dr.crushLayer : null, broken: D.broken.length });
  } , onStart(sim, def) { r0.def = def; trunkAt(sim, 6, 0.3); } });
  const D = r.sim.damage(), dr = D.drive && D.drive[0], dfn = r.def;
  const mountN = D.broken.filter(bi => { const b = r.sim.beams[bi], ta = dfn.nodes[b.a].tag || '', tb = dfn.nodes[b.b].tag || ''; return /^(ENG|CGE)/.test(ta) !== /^(ENG|CGE)/.test(tb); }).length;
  return { key, V, thr, strike: dr ? dr.strike : null, strikeT, strikeAt: strikeRec, gapAtStrike: axAt, latAtStrike: latAt, VAtStrike: Vat,
           crush: dr ? dr.crush : 0, crushLayer: dr ? dr.crushLayer : null, crushJ: dr ? dr.crushJ : 0, bladeLost: dr ? dr.bladeLost : 0,
           broken: D.broken.length, mountBroken: mountN, mountT, mountM, crashed: D.crashed, reason: D.reason, work: D.work, gPeak: D.gPeak,
           ke0: r.ke0, finite: r.finite, trace: wantTrace ? trace : undefined };
}
// the trunk's placement (atTrunk's own: the CG at the push + D along the strip's heading, `off` 0)
const r0 = { def: null, trunk: null };
let HDG = null;
function trunkAt(sim, D, r) { if (HDG == null) HDG = L.flatWorld(300).strip.hdg; const c = sim.cgPos(); r0.trunk = { x: c[0] + Math.cos(HDG) * D, z: c[2] + Math.sin(HDG) * D, r }; }

const out = [];
for (const key of builds) for (const thr of thrs) for (const V of Vs) {
  const t0 = Date.now(), o = run(key, V, thr);
  out.push(o);
  const s = o.strikeAt;
  console.log(`${key.padEnd(6)} V ${V} thr ${thr.toFixed(2)}: ${String(o.strike).padEnd(10)} ` +
    (s ? `t ${o.strikeT.toFixed(3)} biteR ${s.biteR.toFixed(3)} rpm ${Math.round(s.rpm)} tip ${s.tip.toFixed(0)} V@ ${o.VAtStrike.toFixed(2)} gap ${o.gapAtStrike.toFixed(3)} lat ${o.latAtStrike.toFixed(3)} | ` : '| ') +
    `crush ${(o.crush * 100).toFixed(1)} cm ${o.crushLayer} ${o.crushJ.toFixed(0)} J | broken ${o.broken} mount ${o.mountBroken}${o.mountT != null ? ' first ' + o.mountM + ' t ' + o.mountT.toFixed(3) : ''} | ${o.reason || '-'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
const J = arg('json', null);
if (J) fs.writeFileSync(J, JSON.stringify(out, null, 1));
