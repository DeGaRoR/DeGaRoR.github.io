// DMG-LOOKS PORT KIT: dmg_looks_rim.js RimState ON THE REAL THING, PER EVENT, OUTER SKIN ONLY (the user, 26 Oct): the flown
// snapshot built headless and ridden by skin_break as GATE DMGWALL rides it (tools/_dmg_wall_study.js, the inherited
// binding); after every skin_break.event of a record, RimState.update() - timed. One build a process.
//   node futureDesigns/dmg-looks/port/rim_events.js [--builds cub,jodel,metal] [--cases trunk-0,trunk-2.5,noseover]  -> port/rim_events.txt
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..', '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BUILDS = opt('builds', 'cub,jodel,metal').split(','), CASES = opt('cases', 'trunk-0,trunk-2.5,noseover').split(',');
if (BUILDS.length > 1) {
  const { execFileSync } = require('child_process'), all = ['RimState per event, outer skin only (B3), on the headless snapshot ridden by skin_break; one build a process'];
  for (const b of BUILDS) { const o = execFileSync(process.execPath, [__filename, '--builds', b, '--cases', CASES.join(','), '--child', '1'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    for (const l of o.split('\n')) if (/^(cub|jodel|metal) /.test(l)) { all.push(l); console.log(l); } }
  fs.writeFileSync(path.join(__dirname, 'rim_events.txt'), all.join('\n') + '\n'); process.exit(0);
}
process.argv.push('--schemes', 'inh');
process.chdir(ROOT);
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const WS = require(path.join(ROOT, 'tools', '_dmg_wall_study.js'));
const RM = require('./dmg_looks_rim.js');
const CLS = Object.fromEntries(Object.entries(SB.INH).map(([k, v]) => [v, k]));
let states = null, perFrame = null, buildMs = 0; const ev0 = SB.event;
const b0 = RM.RimState.prototype._build; RM.RimState.prototype._build = function () { const t0 = process.hrtime.bigint(); const r = b0.apply(this, arguments); buildMs += Number(process.hrtime.bigint() - t0) / 1e6; return r; };
SB.event = function (R) {
  const r = ev0.apply(this, arguments);
  // (only when the event changed the record - as the game would call it)
  if (states && R.gk && r) { let S = states.get(R); const g = R.gk;
    if (!S) states.set(R, S = new RM.RimState(R, v => RM.isOuter(g.sec, g.role, g.layer[v], CLS[g.cv[v]])));
    const t0 = process.hrtime.bigint(); const u = S.update(); perFrame.ms += Number(process.hrtime.bigint() - t0) / 1e6; if (u) perFrame.n++; }
  return r;
};
for (const k of BUILDS) {
  const P = WS.prepare(k);
  for (const cid of CASES) {
    states = new Map(); const frames = []; perFrame = { ms: 0, n: 0 }; buildMs = 0;
    // one frame = the run's loop calls SB.event on every record; close a frame when the next one starts (sim steps)
    const step0 = SB.nodeFrames; SB.nodeFrames = function () { if (perFrame.n) frames.push(perFrame.ms); perFrame = { ms: 0, n: 0 }; return step0.apply(this, arguments); };
    WS.run(P, cid); SB.nodeFrames = step0;
    let verts = 0, tris = 0, added = 0, drawers = 0, dropped = 0, total = 0;
    for (const S of states.values()) { verts += S.nVerts; tris += S.ovTri.size; added += S.nTris; dropped += S.dropped; if (S.ovTri.size) drawers++; }
    for (const f of frames) total += f; const worst = frames.length ? Math.max(...frames) : 0, sorted = frames.slice().sort((a, b) => a - b);
    console.log(`${k.padEnd(6)} ${cid.padEnd(10)} outer rim: ${String(tris).padStart(5)} triangles live (${added} added, ${verts} overlay vertices - a triangle that dies later keeps its slots), in ${drawers} groups (= transform-feedback draws, + 1 overlay draw)  dropped ${dropped}  |  the adjacency (once a record; belongs at binding) ${buildMs.toFixed(1)} ms  |  update an event-frame, the adjacency included: worst ${worst.toFixed(1)} ms, p50 ${(sorted[Math.floor(sorted.length / 2)] || 0).toFixed(2)} ms, total ${total.toFixed(0)} ms over ${frames.length} frames`);
  }
}
