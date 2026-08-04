// tools/_ztrails.mjs — DRAW WHAT THE SIX ACTUALLY DO.
//
// The numbers keep answering a different question than the one being asked. This
// draws two paths per creature, top-down, so "do they move better and can they
// orient themselves" is a thing you look at rather than a column you interpret.
//
//   LEFT   free swim, turnBias 0 — the forage condition. A creature that swims
//          traces a line. A creature that thrashes traces a knot. The old
//          physics note recorded heading persistence at -0.22, meaning
//          consecutive seconds of travel were ANTI-correlated: oscillation in
//          place, drawn as a scribble the size of the animal.
//
//   RIGHT  steering, turnBias 0.8 — the orientation question. Under a constant
//          steering command a creature that can turn traces an arc or a circle;
//          one that cannot traces the same straight line as on the left. Before
//          Phase A the corpus median was 0.18 deg/s, which over this window is
//          about three degrees — visually indistinguishable from straight.
//
// Both panels are drawn to the SAME scale per creature, so the two are directly
// comparable, and the scale bar states it in cm rather than leaving it implied.
//
// Run: node tools/_ztrails.mjs [SECONDS=180] > trails.svg
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { binomial } from '../engine/l1/naming.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { authoredList } from '../worlds/atlas_seed.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? 180);
const CAST = authoredList().slice(0, 6);

function path(plan, genome, turnBias) {
  const sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: false, effort: 1, turnBias });
  for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();
  const pts = [];
  const steps = Math.round(SECONDS / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    try { sim.step(); } catch { break; }
    if (s % 24) continue;
    const c = sim.centreOfMass();
    if (Number.isFinite(c[0] + c[2])) pts.push([c[0], c[2]]);
  }
  sim.free();
  return pts;
}

const W = 300, H = 210, PAD = 26;

function panel(pts, span, title, accent) {
  if (!pts.length) return `<text x="${W / 2}" y="${H / 2}" class="mut" text-anchor="middle">no path</text>`;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const k = (Math.min(W, H) - 2 * PAD) / span;
  const X = (p) => W / 2 + (p[0] - cx) * k;
  const Y = (p) => H / 2 + (p[1] - cy) * k;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)},${Y(p).toFixed(1)}`).join('');
  const a = pts[0], b = pts[pts.length - 1];
  return `<path d="${d}" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linejoin="round" opacity="0.95"/>
    <circle cx="${X(a).toFixed(1)}" cy="${Y(a).toFixed(1)}" r="3.4" fill="none" stroke="${accent}" stroke-width="1.4"/>
    <circle cx="${X(b).toFixed(1)}" cy="${Y(b).toFixed(1)}" r="3" fill="${accent}"/>
    <text x="10" y="16" class="lbl">${title}</text>`;
}

const ACC = ['#5ec8f2', '#f2a65e'];
const rows = [];
for (let i = 0; i < CAST.length; i++) {
  const entry = CAST[i];
  const plan = morphogenesis(entry.genome);
  const name = entry.commonName || binomial(plan, entry.genome).binomial;
  const free = path(plan, entry.genome, 0);
  const steer = path(plan, entry.genome, 0.8);

  // ONE SCALE FOR BOTH PANELS, or the comparison is a lie: a creature that goes
  // nowhere would be auto-zoomed until its scribble filled the frame and looked
  // like travel.
  const all = free.concat(steer);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const span = Math.max(2, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.1);

  const netFree = free.length > 1
    ? Math.hypot(free[free.length - 1][0] - free[0][0], free[free.length - 1][1] - free[0][1]) : 0;

  rows.push(`<g transform="translate(0,${i * (H + 34)})">
    <text x="0" y="14" class="name">${name}</text>
    <text x="0" y="30" class="mut">${plan.bodyCount} bodies · ${totalMass(plan).toFixed(1)} g · net ${(netFree / SECONDS).toFixed(3)} cm/s · scale ${span.toFixed(1)} cm</text>
    <g transform="translate(0,36)"><rect width="${W}" height="${H}" class="box"/>${panel(free, span, 'free swim · turnBias 0', ACC[0])}</g>
    <g transform="translate(${W + 22},36)"><rect width="${W}" height="${H}" class="box"/>${panel(steer, span, 'steering · turnBias 0.8', ACC[1])}</g>
  </g>`);
}

const TOTAL_H = CAST.length * (H + 34) + 60;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2 + 22}" height="${TOTAL_H}" viewBox="0 0 ${W * 2 + 22} ${TOTAL_H}">
<style>
  text { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .name { font-size: 13px; fill: #e8eef4; font-weight: 600; }
  .mut  { font-size: 10px; fill: #8ea0b0; }
  .lbl  { font-size: 10px; fill: #8ea0b0; }
  .box  { fill: #0f151b; stroke: #24303a; stroke-width: 1; }
  .hdr  { font-size: 12px; fill: #8ea0b0; }
</style>
<rect width="100%" height="100%" fill="#0a0e12"/>
<text x="0" y="16" class="hdr">Phase A — six creatures, ${SECONDS} s each, top-down (X/Z). Open circle = start.</text>
<g transform="translate(0,30)">${rows.join('')}</g>
</svg>`;

writeFileSync(new URL('../dev screenshots/phaseA_trails.svg', import.meta.url), svg);
console.log(`wrote "dev screenshots/phaseA_trails.svg" — ${CAST.length} creatures x ${SECONDS} s`);
