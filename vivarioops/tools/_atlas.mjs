// tools/_atlas.mjs — the authored library, checked, measured and drawn.
//
// Three jobs, and the first two matter more than the third:
//
//  1. CONTRACT. Every seed goes through validateGenome, then
//     serialise -> deserialise -> serialise, then genomeHash. A creature that
//     cannot survive that round trip cannot be saved, shared or bred, so it is
//     not a creature, it is a test fixture.
//  2. MEASUREMENT. Swim each one and run a closed-loop pursuit, so the Atlas
//     shows what the creature DOES rather than what it looks like.
//  3. DRAWING. Orthographic projections straight from morphogenesis output, so
//     the picture is the actual body plan and not an illustration of one.
//
// Writes atlas.html, which is self-contained and openable without a server.
import RAPIER from '@dimforge/rapier3d-compat';
import { SEEDS } from '../worlds/seeds.js';
import { validateGenome, serialise, deserialise, genomeHash } from '../engine/l1/genome.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import { qrot } from '../engine/l1/vecmath.js';
import { sensorTurnBias } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { writeFileSync } from 'node:fs';
await RAPIER.init();

const W = { ...W1_SLICE, gravity: 0 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const OUT = process.argv[2] || 'atlas.html';

// ── measurement ─────────────────────────────────────────────────────────────

function swim(genome, opts, SEC = 20) {
  const plan = morphogenesis(genome);
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...opts }); }
  catch (e) { return { err: e.message }; }
  const STEPS = Math.round(SEC / FIXED_DT);
  const c0 = sim.centreOfMass(); let prev = c0, path = 0, bad = false;
  try {
    for (let s = 0; s < STEPS; s++) {
      sim.step();
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      path += Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]); prev = c;
    }
  } catch { bad = true; }
  const c1 = sim.centreOfMass(); sim.free();
  if (bad) return { err: 'diverged' };
  const net = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
  return { net: net / SEC, com: path / SEC, eff: net / Math.max(path, 1e-9) };
}

/**
 * SEEK, control-subtracted. The creature's own preyGain/threatGain drive the
 * loop (exactly as duel.js senseOpponent does); `control` repeats it with the
 * sensor disabled. The DIFFERENCE is what the sensor contributes — the raw
 * score correlates 0.98 with the control and is a speed metric in disguise.
 */
function seekPair(genome, opts) {
  const live = seekOne(genome, opts, null);
  const dead = seekOne(genome, opts, 0);
  if (live === null || dead === null) return { err: 'diverged' };
  return { live, dead, benefit: live - dead };
}
function seekOne(genome, opts, gainOverride, R = 6, SEC = 30) {
  const plan = morphogenesis(genome);
  const sc = [];
  for (const deg of [0, 60, 120, 180, 240, 300]) {
    let sim;
    try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...opts }); }
    catch { return null; }
    const c0 = sim.centreOfMass(), th = deg * Math.PI / 180;
    const target = [c0[0], c0[1] + R * Math.sin(th), c0[2] + R * Math.cos(th)];
    let best = R, bad = false, prev = c0, va = 0, vb = 0;
    try {
      for (let s = 0; s < Math.round(SEC / FIXED_DT); s++) {
        const c = sim.centreOfMass();
        if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
        va = 0.98 * va + 0.02 * (c[2] - prev[2]); vb = 0.98 * vb + 0.02 * (c[1] - prev[1]);
        const ta = target[2] - c[2], tb = target[1] - c[1];
        if (Math.hypot(va, vb) > 1e-7 && Math.hypot(ta, tb) > 1e-4) {
          const bearing = wrap(Math.atan2(tb, ta) - Math.atan2(vb, va)) / Math.PI;
          sim.control.turnBias = gainOverride === null
            ? sensorTurnBias(genome, bearing, bearing)
            : Math.max(-1, Math.min(1, gainOverride * bearing));
        }
        prev = c;
        const d = Math.hypot(target[0] - c[0], target[1] - c[1], target[2] - c[2]);
        if (d < best) best = d;
        sim.step();
      }
    } catch { bad = true; }
    sim.free(); if (bad) return null;
    sc.push(Math.max(0, (R - best) / R));
  }
  return sc.reduce((a, b) => a + b, 0) / sc.length;
}

/** Closed-loop pursuit in the bend plane (z,y). See HYDRODYNAMICS 69-71. */
function pursue(genome, opts, TARGET_R = 6, SEC = 60, kp = 2 / Math.PI) {
  const plan = morphogenesis(genome);
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...opts }); }
  catch (e) { return { err: e.message }; }
  const STEPS = Math.round(SEC / FIXED_DT);
  const c0 = sim.centreOfMass();
  const target = [c0[0], c0[1], c0[2] + TARGET_R];
  // the chain's initial heading is along z, so put the target on y: a 90 deg turn
  target[2] = c0[2]; target[1] = c0[1] + TARGET_R;
  let best = TARGET_R, bad = false, prev = c0, va = 0, vb = 0;
  try {
    for (let s = 0; s < STEPS; s++) {
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      va = 0.98 * va + 0.02 * (c[2] - prev[2]); vb = 0.98 * vb + 0.02 * (c[1] - prev[1]);
      const ta = target[2] - c[2], tb = target[1] - c[1];
      if (Math.hypot(va, vb) > 1e-7 && Math.hypot(ta, tb) > 1e-4) {
        sim.control.turnBias = Math.max(-1, Math.min(1, kp * wrap(Math.atan2(tb, ta) - Math.atan2(vb, va))));
      }
      prev = c;
      const d = Math.hypot(target[0] - c[0], target[1] - c[1], target[2] - c[2]);
      if (d < best) best = d;
      sim.step();
    }
  } catch { bad = true; }
  sim.free();
  return bad ? { err: 'diverged' } : { best };
}

// ── drawing ─────────────────────────────────────────────────────────────────

/** Orthographic projection of the rest pose. `ax` picks the two world axes. */
function svg(plan, [ax, ay], w = 300, h = 150, hue = 0.55) {
  const polys = plan.bodies.map((b, i) => {
    const half = b.dims.map((d) => d / 2);
    const corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      corners.push(qrot(b.rotation, [sx * half[0], sy * half[1], sz * half[2]]));
    }
    const pts = corners.map((c) => [b.position[ax] + c[ax], b.position[ay] + c[ay]]);
    // convex hull of the projected corners, gift-wrap — 8 points, cost is nil
    const start = pts.reduce((a, p) => (p[0] < a[0] || (p[0] === a[0] && p[1] < a[1]) ? p : a), pts[0]);
    const hull = []; let cur = start;
    do {
      hull.push(cur);
      let nxt = pts[0];
      for (const p of pts) {
        if (nxt === cur) { nxt = p; continue; }
        const cr = (nxt[0] - cur[0]) * (p[1] - cur[1]) - (nxt[1] - cur[1]) * (p[0] - cur[0]);
        if (cr < 0) nxt = p;
      }
      cur = nxt;
    } while (cur !== start && hull.length < 10);
    return { hull, depth: b.depth ?? 0, i };
  });
  const all = polys.flatMap((p) => p.hull);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 8;
  const sc = Math.min((w - 2 * pad) / Math.max(maxX - minX, 1e-6), (h - 2 * pad) / Math.max(maxY - minY, 1e-6));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const X = (v) => (w / 2 + (v - cx) * sc).toFixed(1);
  const Y = (v) => (h / 2 - (v - cy) * sc).toFixed(1);
  const n = plan.bodies.length;
  const body = polys.map((p) => {
    const l = 38 + 34 * (p.i / Math.max(n - 1, 1));
    const fill = `hsl(${(hue * 360).toFixed(0)} 55% ${l.toFixed(0)}%)`;
    return `<polygon points="${p.hull.map(([a, b]) => `${X(a)},${Y(b)}`).join(' ')}" fill="${fill}" stroke="#0b0d10" stroke-width="1"/>`;
  }).join('');
  const scaleBar = (() => {
    const m = 1 * sc;
    if (m < 10 || m > w) return '';
    return `<g opacity="0.55"><line x1="${pad}" y1="${h - 10}" x2="${pad + m}" y2="${h - 10}" stroke="#8aa" stroke-width="2"/>`
         + `<text x="${pad}" y="${h - 14}" fill="#8aa" font-size="9" font-family="monospace">1 m</text></g>`;
  })();
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="background:#0b0d10;border-radius:6px">${body}${scaleBar}</svg>`;
}

// ── run ─────────────────────────────────────────────────────────────────────

const CONFIGS = [['pd (shipped)', { motor: 'pd' }], ['solver', { motor: 'solver' }], ['solver 10 Hz', { motor: 'solver', motorFreqHz: 10 }]];
const cards = [];
console.log('\nid            valid  round  hash              bodies  joints   pd eff   solver eff   seek benefit');
for (const s of SEEDS) {
  const v = validateGenome(s.genome);
  const a = serialise(s.genome);
  const round = a === serialise(deserialise(a));
  const plan = morphogenesis(s.genome);
  const runs = CONFIGS.map(([label, opts]) => [label, swim(s.genome, opts)]);
  const chase = seekPair(s.genome, { motor: 'solver' });
  const eff = (i) => (runs[i][1].err ? '—' : runs[i][1].eff.toFixed(3));
  console.log(`${s.id.padEnd(13)} ${(v.ok ? 'yes' : 'NO').padEnd(6)} ${(round ? 'ok' : 'DRIFT').padEnd(6)} ${genomeHash(s.genome)}  ${String(plan.bodyCount).padStart(6)}  ${String(plan.jointCount).padStart(6)}   ${eff(0).padStart(6)}   ${eff(1).padStart(10)}   ${chase.err ? chase.err : chase.benefit.toFixed(3)}`);
  cards.push({ s, v, round, plan, runs, chase, hash: genomeHash(s.genome), json: a });
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = `<!doctype html><meta charset="utf-8"><title>Vivarioops · Atlas (authored)</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;padding:2rem;background:#07090b;color:#c8d2dc;
      font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}
 h1{font-size:1.1rem;letter-spacing:.14em;text-transform:uppercase;color:#7fb0c8;margin:0 0 .3rem}
 .lede{color:#6b7a88;max-width:62ch;margin:0 0 2.2rem;font-size:.86rem}
 .grid{display:grid;gap:1.4rem;grid-template-columns:repeat(auto-fill,minmax(400px,1fr))}
 .card{border:1px solid #1a2129;border-radius:8px;padding:1rem 1.1rem;background:#0b0e12}
 .card h2{font-size:.95rem;margin:0 0 .15rem;color:#e6edf3;letter-spacing:.02em}
 .id{color:#4d6070;font-size:.74rem;letter-spacing:.1em}
 .note{color:#7d8b98;font-size:.8rem;margin:.55rem 0 .9rem}
 .views{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.8rem}
 .views figcaption{color:#42525f;font-size:.68rem;letter-spacing:.08em;padding-top:.25rem}
 table{width:100%;border-collapse:collapse;font-size:.78rem}
 td{padding:.16rem 0;border-bottom:1px solid #141a20}
 td:last-child{text-align:right;color:#e6edf3}
 td:first-child{color:#6b7a88}
 .good{color:#6fd39a}.bad{color:#d8737f}
 details{margin-top:.8rem}
 summary{cursor:pointer;color:#4d6070;font-size:.75rem;letter-spacing:.08em}
 pre{background:#06080a;border:1px solid #141a20;border-radius:5px;padding:.7rem;
     overflow:auto;max-height:16rem;font-size:.68rem;color:#8a9aa8;margin:.5rem 0 0}
</style>
<h1>Atlas · authored specimens</h1>
<p class="lede">Six hand-written genomes in the shipping schema. Every one validated with
<code>validateGenome</code>, round-tripped through <code>serialise → deserialise → serialise</code>
and hashed; the drawings are orthographic projections of the actual
<code>morphogenesis</code> output, and the numbers are measured, not declared.
Generated by <code>tools/_atlas.mjs</code>.</p>
<div class="grid">
${cards.map(({ s, v, round, plan, runs, chase, hash, json }) => `
 <div class="card">
  <h2>${esc(s.name)}</h2>
  <div class="id">${esc(s.id)} · ${hash}</div>
  <div class="note">${esc(s.note)}</div>
  <div class="views">
   <figure style="margin:0">${svg(plan, [2, 0], 300, 150, s.genome.material.hue)}<figcaption>TOP · z-x</figcaption></figure>
   <figure style="margin:0">${svg(plan, [2, 1], 300, 150, s.genome.material.hue)}<figcaption>SIDE · z-y — the bend plane</figcaption></figure>
  </div>
  <table>
   <tr><td>schema</td><td class="${v.ok && round ? 'good' : 'bad'}">${v.ok ? 'valid' : 'INVALID'} · round-trip ${round ? 'exact' : 'DRIFT'}</td></tr>
   <tr><td>bodies · joints · dof</td><td>${plan.bodyCount} · ${plan.jointCount} · ${plan.dofCount}</td></tr>
   <tr><td>omega · phase lag</td><td>${s.genome.controller.omega} rad/s · ${(s.genome.nodes[0].joint.phaseLag * 180 / Math.PI).toFixed(0)}°</td></tr>
${runs.map(([label, r]) => `   <tr><td>${label}</td><td>${r.err ? `<span class="bad">${r.err}</span>` : `${r.net.toFixed(3)} m/s · eff ${r.eff.toFixed(3)}`}</td></tr>`).join('\n')}
   <tr><td>seek score · sensor</td><td class="${!chase.err && chase.benefit > 0.02 ? 'good' : ''}">${chase.err ? chase.err : `${chase.live.toFixed(3)} · control ${chase.dead.toFixed(3)} · <b>benefit ${chase.benefit >= 0 ? '+' : ''}${chase.benefit.toFixed(3)}</b>`}</td></tr>
  </table>
  <details><summary>GENOME JSON — paste to import</summary><pre>${esc(json)}</pre></details>
 </div>`).join('\n')}
</div>
`;
writeFileSync(OUT, html);
console.log(`\nwrote ${OUT}\n`);
