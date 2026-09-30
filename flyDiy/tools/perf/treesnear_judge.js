#!/usr/bin/env node
// treesnear_judge.js - BEFORE vs AFTER, PHASE BY PHASE, BY THE RATCHET'S RULES (G1110, TREES-NEAR)
//   node tools/perf/treesnear_judge.js <before.json> <after.json> [phase ...]     (rollout_perf outputs; phases stand taxi air)
// For each phase: fps delivered, uneven (the share of consecutive frame intervals that change their 60 Hz refresh count -
// rollout_ratchet.js's definition), dt p99, render ms (renderer.render's CPU, median), loop JS; the raw delta, and the
// ratchet's verdict with its slack (tools/rollout_ratchet.js RULES). 'air' is the low pass (treesnear_lowpass.js).
// The ratchet's slack is a CEILING (A0, 2026-09-30): anything worse but inside it is reported for the user to decide.
'use strict';
const fs = require('fs');
const [A, B, ...ph] = process.argv.slice(2);
if (!A || !B) { console.error('usage: treesnear_judge.js before.json after.json [phase ...]'); process.exit(2); }
const PHASES = ph.length ? ph : ['stand', 'taxi', 'air'];
const REFRESH = 1000 / 60;
const RULES = { fps: { up: true, rel: 0.05, abs: 1.0 }, uneven: { up: false, rel: 0, abs: 0.05 }, p99: { up: false, rel: 0.10, abs: 2 },
                render: { up: false, rel: 0.10, abs: 0.6 }, loop: { up: false, rel: 0.10, abs: 0.8 } };
const PH = new Set(['stand', 'taxi', 'takeoff', 'air']);
function metrics(j, phase) {
  const p = (j.phases || {})[phase];
  if (!p) return null;
  const f0 = (j.frames || []).find(r => r.some(v => PH.has(v)));
  let li = -1; if (f0) for (let i = f0.length - 1; i >= 0; i--) if (PH.has(f0[i])) { li = i; break; }
  const fr = li < 0 ? [] : j.frames.filter(r => r[li] === phase);
  let uneven = null;
  if (fr.length > 10) { let n = 0, ch = 0, prev = null; for (const r of fr) { const k = Math.max(1, Math.round(r[1] / REFRESH)); if (prev !== null) { n++; if (k !== prev) ch++; } prev = k; } uneven = n ? ch / n : null; }
  return { fps: p.fpsDelivered, uneven, p99: p.dtP99, render: p.renderMed, loop: p.workMed, frames: p.frames, secs: p.secs, cap30: p.cap30 };
}
const ja = JSON.parse(fs.readFileSync(A, 'utf8')), jb = JSON.parse(fs.readFileSync(B, 'utf8'));
let red = 0, worse = 0;
for (const phase of PHASES) {
  const a = metrics(ja, phase), b = metrics(jb, phase);
  if (!a || !b) { console.log(`${phase}: missing on ${!a ? 'BEFORE' : 'AFTER'}`); continue; }
  console.log(`${phase}  (before ${a.frames} frames / ${a.secs} s, at the 30 cap ${Math.round(a.cap30 * 100)} %; after ${b.frames} / ${b.secs} s, ${Math.round(b.cap30 * 100)} %)`);
  for (const [n, R] of Object.entries(RULES)) {
    const was = a[n], now = b[n];
    if (was == null || now == null) { console.log(`  ${n.padEnd(7)} n/a`); continue; }
    const bad = R.up ? was - now : now - was, slack = Math.max(R.abs, Math.abs(was) * R.rel);
    const v = bad > slack ? 'RED' : bad > 0 ? 'worse, inside the slack' : bad < 0 ? 'better' : 'same';
    if (v === 'RED') red++; else if (bad > 0) worse++;
    const fmt = x => n === 'uneven' ? (x * 100).toFixed(1) + ' %' : (+x).toFixed(n === 'fps' ? 1 : 2);
    console.log(`  ${n.padEnd(7)} ${fmt(was).padStart(8)} -> ${fmt(now).padStart(8)}  delta ${(R.up ? now - was : now - was) >= 0 ? '+' : ''}${n === 'uneven' ? ((now - was) * 100).toFixed(1) + ' pt' : (now - was).toFixed(2)}  (slack ${n === 'uneven' ? (slack * 100).toFixed(0) + ' pt' : slack.toFixed(2)})  ${v}`);
  }
}
console.log(`VERDICT: ${red ? red + ' RED' : 'no red'}; ${worse} worse inside the slack`);
process.exit(red ? 1 : 0);
