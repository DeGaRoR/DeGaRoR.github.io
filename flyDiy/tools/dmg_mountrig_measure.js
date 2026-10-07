#!/usr/bin/env node
// G2361-G2364 (DMG-MOUNTRIG): THE NOSE-ENGINE RIG'S CENSUS - what a nose engine's mount does in the ground's crashes, on the
// validated builds as the game flies them (tools/_load_build.js through _treecrash_lib), damage on, the certificate
// stamped (what the game stamps when the layer is on):
//   the taxi into a trunk at 1-5 m/s (the throttle shut, and at 0.3), on the centreline (TREECRASH's: the trunk 4 m ahead);
//   the nose-over (DMG-DRIVE's, the nose falling at 4 m/s about the mains); the flight into a trunk at 30 m/s, 4 m up, on
//   the centreline and with the wing 2.5 m out (TREECRASH's).
// Each row: the members broken (all / the mount's: an end on an ENG / CGE / MNT node), the plastic work (all / the
// mount's), crashed (and why), the engine running / seized, the nose's crush. A floatplane's ground rows are flown on
// the flat world's grass (its floats on the ground: what a trunk does to its mount, not a water taxi).
//   node tools/dmg_mountrig_measure.js [--out file.json] [builds...]
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
process.env.FLYDIY_CERT = '1';
const L = require('./_treecrash_lib.js');
const isMnt = t => /^(ENG|CGE|MNT)/.test(t || '');

function row(r, sim, def) {
  const D = sim.damage(), N = def.nodes, B = def.beams;
  const mnt = bi => isMnt(N[B[bi].a].tag) || isMnt(N[B[bi].b].tag);
  const br = D.broken || [], wB = D.wB || [];
  let wM = 0, top = [];
  for (let bi = 0; bi < B.length; bi++) { if (mnt(bi)) wM += wB[bi] || 0; if ((wB[bi] || 0) > 1) top.push([bi, wB[bi]]); }
  top.sort((a, b) => b[1] - a[1]);
  const tag = bi => N[B[bi].a].tag + '-' + N[B[bi].b].tag;
  const dr = (D.drive || [])[0] || {};
  return { broken: br.length, brokenMount: br.filter(mnt).length, mountBroken: br.filter(mnt).map(tag),
    work: Math.round(D.work), workMount: Math.round(wM), crashed: !!D.crashed, reason: D.reason || null,
    running: sim.eng.map(e => !!e.running), seized: sim.eng.map(e => !!e.seized), crush: +(dr.crush || 0).toFixed(3),
    top: top.slice(0, 6).map(([bi, w]) => tag(bi) + ' ' + Math.round(w)), finite: L.finite(sim) };
}
if (argv[0] === '--build') {
  const k = argv[1], C = L.core(), out = { key: k, rows: [] };
  const def0 = L.defOf(k);
  out.nodes = def0.nodes.length; out.beams = def0.beams.length;
  const push = (lab, fn) => { try { const r = fn(); out.rows.push(Object.assign({ lab }, row(r, L.lastRun.sim, L.lastRun.sim.def || r.def))); }
    catch (e) { out.rows.push({ lab, err: String(e && e.message || e) }); } };
  for (const thr of [0, 0.3]) for (const V of [1, 2, 3, 4, 5])
    push('taxi ' + V + ' m/s thr ' + thr, () => L.atTrunk(k, { D: 4, V, thr, secs: 8, cert: true }));
  push('nose-over 4 m/s', () => require('./_dmg_drive_lib.js').noseOver(k, { V: 4, cert: true, secs: 3 }));
  for (const off of [0, 2.5]) push('30 m/s ' + (off ? off + ' m out' : 'centreline'), () => L.atTrunk(k, { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off, cert: true }));
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}
(async () => {
  const { spawn } = require('child_process');
  const oi = argv.indexOf('--out'), outF = oi >= 0 ? argv[oi + 1] : null;
  const keys = argv.filter((a, i) => !a.startsWith('--') && (oi < 0 || i !== oi + 1));
  const ks = keys.length ? keys : Object.keys(L.BUILDS), R = {}, q = ks.slice();
  const run = k => new Promise(res => { const c = spawn(process.execPath, [__filename, '--build', k], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-600) }); }); });
  await Promise.all([0, 1].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  for (const k of ks) {
    const r = R[k]; console.log('== ' + L.BUILDS[k].label + (r.err ? ' ERROR ' + r.err : ' (' + r.nodes + ' nodes, ' + r.beams + ' members)'));
    if (r.err) continue;
    for (const x of r.rows) console.log(x.err ? '  ' + x.lab + ': ERROR ' + x.err
      : '  ' + x.lab.padEnd(22) + ' broken ' + String(x.broken).padStart(3) + ' (mount ' + x.brokenMount + ')  work ' + String(x.work).padStart(6) + ' J (mount ' + x.workMount + ')  '
        + (x.crashed ? 'CRASH (' + x.reason + ')' : 'no crash') + '  engine ' + (x.seized.some(s => s) ? 'seized' : x.running.every(s => s) ? 'on' : 'off') + '  nose ' + (100 * x.crush).toFixed(0) + ' cm'
        + (x.finite ? '' : ' NOT FINITE') + (x.top.length ? '  [' + x.top.join(', ') + ']' : ''));
  }
  if (outF) fs.writeFileSync(outF, JSON.stringify(R, null, 1));
})();
