#!/usr/bin/env node
// _rollreal_prof.js - THE WORLD ROLL'S CPU AGAINST TAXI'S (G1119): two Chrome CPU profiles from one rollout_perf run
// (--profile-shot -> <label>_shot.cpuprofile: the click to the shot's end; --profile-live a,s -> <label>_live.cpuprofile: taxi),
// each function's busy time PER SECOND OF WALL in the world roll (the shot after the cut, +3.4 s) and in taxi, side by side:
// what the roll pays that taxi does not (its own), and what both pay (the motion's common cost).
//   node tools/_rollreal_prof.js C:/t/rrp_prof/prof_1.json [more runs' json]   -> a table, roll vs taxi, ms per second
'use strict';
const fs = require('fs');
const files = process.argv.slice(2);
const key = n => (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url || '').split('/').pop().split('?')[0] + ':' + (n.callFrame.lineNumber + 1);
function load(file, from, to) {   // self and inclusive ms over [from, to] ms since the profile's start; and the window's wall
  const pr = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byId = new Map(pr.nodes.map(n => [n.id, n])), par = new Map();
  for (const n of pr.nodes) for (const c of (n.children || [])) par.set(c, n.id);
  const self = new Map(), incl = new Map(); let t = 0, t0 = null, t1 = 0;
  for (let i = 0; i < pr.samples.length; i++) {
    const d = (pr.timeDeltas[i] || 0) / 1000; t += d;
    if (t < from || t > to) continue;
    if (t0 == null) t0 = t; t1 = t;
    const n = byId.get(pr.samples[i]); if (n.callFrame.functionName === '(idle)' || n.callFrame.functionName === '(program)') continue;
    self.set(key(n), (self.get(key(n)) || 0) + d);
    const seen = new Set();
    for (let x = pr.samples[i]; x != null; x = par.get(x)) { const k = key(byId.get(x)); if (seen.has(k)) continue; seen.add(k); incl.set(k, (incl.get(k) || 0) + d); }
  }
  return { self, incl, wall: Math.max(1, t1 - (t0 || 0)) / 1000 };
}
const acc = { roll: { self: new Map(), incl: new Map(), wall: 0 }, taxi: { self: new Map(), incl: new Map(), wall: 0 } };
const add = (A, B) => { for (const [k, v] of B.self) A.self.set(k, (A.self.get(k) || 0) + v); for (const [k, v] of B.incl) A.incl.set(k, (A.incl.get(k) || 0) + v); A.wall += B.wall; };
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const secs = j.shot && j.shot.secs ? j.shot.secs * 1000 : 9500;
  const shot = f.replace(/\.json$/, '_shot.cpuprofile'), live = f.replace(/\.json$/, '_live.cpuprofile');
  if (fs.existsSync(shot)) add(acc.roll, load(shot, 3400, secs));
  if (fs.existsSync(live)) add(acc.taxi, load(live, 0, 1e9));
}
const per = (A, m, k) => (A[m].get(k) || 0) / Math.max(1e-3, A.wall);
const busy = A => [...A.self.values()].reduce((a, b) => a + b, 0) / Math.max(1e-3, A.wall);
console.log('busy ms per second of wall: the world roll ' + busy(acc.roll).toFixed(0) + ' (' + acc.roll.wall.toFixed(1) + ' s), taxi ' + busy(acc.taxi).toFixed(0) + ' (' + acc.taxi.wall.toFixed(1) + ' s)');
for (const m of ['incl', 'self']) {
  const keys = new Set([...acc.roll[m].keys(), ...acc.taxi[m].keys()]);
  const rows = [...keys].map(k => [k, per(acc.roll, m, k), per(acc.taxi, m, k)]).filter(r => r[1] > 4 || r[2] > 4)
    .sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
  console.log('\n' + (m === 'incl' ? 'INCLUSIVE' : 'SELF') + ' ms/s - sorted by what the roll pays over taxi:  roll  taxi  diff  function');
  for (const r of rows.slice(0, m === 'incl' ? 45 : 30)) console.log('  ' + r[1].toFixed(1).padStart(6) + r[2].toFixed(1).padStart(6) + (r[1] - r[2]).toFixed(1).padStart(7) + '  ' + r[0]);
}
