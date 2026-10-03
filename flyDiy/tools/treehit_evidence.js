#!/usr/bin/env node
// treehit_evidence.js - G1330 (TREE-HITBOX): the evidence pictures, from the solver itself (node + the pre-installed
// Chromium to turn SVG into JPEG). A hitbox is invisible in a render - the trees draw the same before and after - so the
// pictures are the AEROPLANE'S OWN BEAMS seen from above as the flight runs, against a forest-fill trunk:
//   taxi_before_after.jpg  taxied at a fill trunk (r 0.3 m, a 15 m fir): master (no fill trunk in the physics) vs now
//   wing_offset.jpg        now, the trunk 2.5 m off the centreline: the wing meets it, the aeroplane slews round it
//   flight_before_after.jpg  flown at it at 4 m AGL, 30 m/s: master vs now
//   sweep.jpg              the CG's furthest point by lateral offset (G1332's measured table: node test / beams KTn / beams KGn)
//   census.jpg             the page census at HOME (GATE TREEHIT 5): drawn vs collidable, before / now
// Run: node tools/treehit_evidence.js   -> reports/evidence/TREE-HITBOX/*.jpg
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js');
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'TREE-HITBOX');
fs.mkdirSync(OUT, { recursive: true });
const W0 = C.makeWorld(0, {}), STRIP = W0.aerodromes.find(a => a.id === 'HOME');
const TK = C.TREE_HITS.trunkOf(15, 0.28);

function fly(o) {
  const elev = 300, TH = C.TREE_HITS.make();
  const W = Object.assign({}, W0, { terrainH: () => elev, obstacles: C.OBSTACLES.make(), trees: [], treesNear: (x, z, q) => { q.length = 0; return q; }, treeHits: TH });
  const def = C.buildGen(), sim = C.makeSim(def, W);
  sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, STRIP, { elev, spawnElev: elev + (o.agl || 0) }));
  const fx = Math.cos(STRIP.hdg), fz = Math.sin(STRIP.hdg);
  if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
  if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = o.V * fx; sim.v[i * 3 + 2] = o.V * fz; }
  const c0 = sim.cgPos().slice(), off = o.off || 0;
  if (o.tree) TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev, TK[0], elev + TK[1]]);
  sim.ctl.thr = o.thr;
  const loc = (x, z) => [(x - c0[0]) * fx + (z - c0[2]) * fz, -(x - c0[0]) * fz + (z - c0[2]) * fx];
  const frames = [];
  for (let f = 0; f <= o.secs * 60; f++) {
    if (f) sim.step(1 / 60);
    const c = sim.cgPos(), along = loc(c[0], c[2])[0];
    if (o.rollThen != null && along > 6) sim.ctl.thr = o.rollThen;
    if (f % o.every === 0) frames.push({ t: f / 60, along, beams: def.beams.map(b => [loc(sim.p[b.a * 3], sim.p[b.a * 3 + 2]), loc(sim.p[b.b * 3], sim.p[b.b * 3 + 2])]), v: (v => v[0] * fx + v[2] * fz)(sim.cgVel()) });
  }
  return { frames, hits: sim.trunkHits(), off };
}

// ---- SVG ----------------------------------------------------------------------------------------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function panel(run, x0, y0, w, h, a0, a1, title, D, tree) {
  const sx = w / (a1 - a0), sy = sx, cy = y0 + h / 2;
  const X = a => x0 + (a - a0) * sx, Y = c => cy - c * sy;
  let s = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#f7f6f2" stroke="#bbb"/>`;
  s += `<text x="${x0 + 8}" y="${y0 + 20}" font-size="15" font-weight="600" fill="#222">${esc(title)}</text>`;
  for (let a = Math.ceil(a0 / 5) * 5; a <= a1; a += 5) s += `<line x1="${X(a)}" y1="${y0 + h - 14}" x2="${X(a)}" y2="${y0 + h - 8}" stroke="#999"/><text x="${X(a)}" y="${y0 + h - 1}" font-size="10" fill="#777" text-anchor="middle">${a} m</text>`;
  const n = run.frames.length;
  run.frames.forEach((F, k) => {
    const op = 0.15 + 0.85 * (k + 1) / n, col = k === n - 1 ? '#1d4e89' : '#5b7fa8';
    let d = ''; for (const b of F.beams) d += `M${X(b[0][0]).toFixed(1)},${Y(b[0][1]).toFixed(1)}L${X(b[1][0]).toFixed(1)},${Y(b[1][1]).toFixed(1)}`;
    s += `<path d="${d}" stroke="${col}" stroke-opacity="${op.toFixed(2)}" stroke-width="${k === n - 1 ? 1.2 : 0.7}" fill="none"/>`;
  });
  // the trunk (drawn at its true radius) and, faint, where the drawn crown would be
  s += `<circle cx="${X(D)}" cy="${Y(run.off)}" r="${(4.2 * sx).toFixed(1)}" fill="#3c7a3c" fill-opacity="0.10" stroke="#3c7a3c" stroke-opacity="0.3" stroke-dasharray="3 3"/>`;
  s += `<circle cx="${X(D)}" cy="${Y(run.off)}" r="${Math.max(2, TK[0] * sx).toFixed(1)}" fill="${tree ? '#6b3e1f' : 'none'}" stroke="#6b3e1f" stroke-width="1.5"/>`;
  s += `<text x="${X(D) + 8}" y="${Y(run.off) + 16 + 4.2 * sx}" font-size="11" fill="#3c5a2c">fill tree, trunk r ${TK[0]} m${tree ? '' : ' (not in the physics)'}</text>`;
  const L = run.frames[n - 1];
  s += `<text x="${x0 + 8}" y="${y0 + 38}" font-size="12" fill="#444">${esc(`CG furthest ${Math.max(...run.frames.map(F => F.along)).toFixed(1)} m · trunk at ${D} m · beam contacts ${run.hits} · end speed ${L.v.toFixed(1)} m/s`)}</text>`;
  return s;
}
const svgDoc = (w, h, body, cap) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Helvetica,Arial,sans-serif"><rect width="100%" height="100%" fill="#fff"/>${body}<text x="10" y="${h - 8}" font-size="11" fill="#666">${esc(cap)}</text></svg>`;

const imgs = [];
{ // 1. taxi, before / after
  const D = 60, o = { D, thr: 1, rollThen: 0.35, secs: 14, every: 50 };
  const a = fly(Object.assign({ tree: false }, o)), b = fly(Object.assign({ tree: true }, o));
  imgs.push(['taxi_before_after', 1000, 560, svgDoc(1000, 560,
    panel(a, 10, 10, 980, 255, 30, 90, 'MASTER - taxied at a forest-fill tree: the fill had no trunk in the physics, the aeroplane rolls through', D, false) +
    panel(b, 10, 275, 980, 255, 30, 90, 'NOW (G1330) - the fill tree\'s trunk registered on world.treeHits, tested against every beam: stopped', D, true),
    'The stock build seen from above (its beams, every 0.83 s; darkest = last). Headless solver, flat world at 300 m. tools/treehit_evidence.js')]);
}
{ // 2. the wing meets it
  const D = 60, b = fly({ tree: true, D, off: 2.5, thr: 1, rollThen: 0.35, secs: 14, every: 50 });
  imgs.push(['wing_offset', 1000, 300, svgDoc(1000, 300,
    panel(b, 10, 10, 980, 265, 30, 90, 'NOW - the trunk 2.5 m left of the centreline: the wing meets it and the aeroplane slews round it', D, true),
    'A node-only test let this through (CG to 83 m); beams against the trunk hold it. Headless solver. tools/treehit_evidence.js')]);
}
{ // 3. low flight, before / after
  const D = 40, o = { D, agl: 4, V: 30, thr: 1, secs: 2.5, every: 15 };
  const a = fly(Object.assign({ tree: false }, o)), b = fly(Object.assign({ tree: true }, o));
  imgs.push(['flight_before_after', 1000, 560, svgDoc(1000, 560,
    panel(a, 10, 10, 980, 255, -5, 80, 'MASTER - flown at a forest-fill tree, 4 m AGL, 30 m/s: straight through it', D, false) +
    panel(b, 10, 275, 980, 255, -5, 80, 'NOW - the same flight: the airframe meets the trunk and is stopped (no damage model: a stop, not a crash)', D, true),
    'From above, every 0.25 s. The trunk reaches 10 m (0.67 x 15 m); the aeroplane is at ~4 m. Headless solver. tools/treehit_evidence.js')]);
}
{ // 4. the sweep (G1332's measured table)
  const offs = [0, 0.7, 1.5, 2.5, 3.5, 4.5, 5.5], rows = [['node test (the woodland\'s, tried first)', [72, 82, 82, 83, 82, 83, 83], '#c0504d'],
    ['beams, the woodland spring KTn (tried)', [60, 76, 79, 77, 63, 64, 83], '#e0a030'], ['beams, the ground spring KGn (SHIPPED)', [59, 60, 60, 61, 63, 64, 83], '#1d4e89']];
  const x0 = 70, y0 = 40, w = 860, h = 330, X = o => x0 + o / 5.5 * w, Y = r => y0 + h - (r - 55) / 30 * h;
  let s = `<text x="20" y="24" font-size="15" font-weight="600">A 0.3 m fill trunk 60 m ahead, the taxiing aeroplane's CG furthest point, by the trunk's offset from the centreline</text>`;
  for (let r = 55; r <= 85; r += 5) s += `<line x1="${x0}" y1="${Y(r)}" x2="${x0 + w}" y2="${Y(r)}" stroke="#eee"/><text x="${x0 - 8}" y="${Y(r) + 4}" font-size="11" text-anchor="end" fill="#666">${r} m</text>`;
  s += `<line x1="${x0}" y1="${Y(60)}" x2="${x0 + w}" y2="${Y(60)}" stroke="#6b3e1f" stroke-dasharray="4 3"/><text x="${x0 + 4}" y="${Y(60) - 4}" font-size="11" fill="#6b3e1f">the trunk's line</text>`;
  s += `<line x1="${X(5)}" y1="${y0}" x2="${X(5)}" y2="${y0 + h}" stroke="#aaa" stroke-dasharray="2 3"/><text x="${X(5) + 4}" y="${y0 + 12}" font-size="11" fill="#777">wingtip (5 m)</text>`;
  for (const o of offs) s += `<text x="${X(o)}" y="${y0 + h + 16}" font-size="11" text-anchor="middle" fill="#666">${o} m</text>`;
  rows.forEach(([lab, v, col], k) => { s += `<polyline points="${offs.map((o, i) => X(o) + ',' + Y(v[i])).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5"/>` + offs.map((o, i) => `<circle cx="${X(o)}" cy="${Y(v[i])}" r="3.5" fill="${col}"/>`).join('') + `<rect x="${x0 + 10}" y="${y0 + h + 30 + k * 18}" width="14" height="4" fill="${col}"/><text x="${x0 + 30}" y="${y0 + h + 36 + k * 18}" font-size="12">${esc(lab)}</text>`; });
  imgs.push(['sweep', 1000, 480, svgDoc(1000, 480, s, 'Measured in node (the stock build, 14 s at a third of throttle). Over the line = through or round the trunk. HANDOVER G1332.')]);
}
{ // 5. the census
  const K = JSON.parse(process.env.TREEHIT_CENSUS || '{"fill":[15857,15857,2]}');
  let s = `<text x="20" y="26" font-size="15" font-weight="600">Every tree drawn within 1 km of the aeroplane on Jolene's HOME stand: can it be hit? (GATE TREEHIT 5, the page in node)</text>`;
  const max = K.fill[0], bw = 700;
  [['drawn (forest fill)', K.fill[0], '#8aa67a'], ['collidable on MASTER', K.fill[2], '#c0504d'], ['collidable NOW', K.fill[1], '#1d4e89']].forEach(([lab, v, col], k) => {
    const y = 60 + k * 50; s += `<text x="20" y="${y + 20}" font-size="13">${esc(lab)}</text><rect x="220" y="${y}" width="${Math.max(2, v / max * bw)}" height="30" fill="${col}"/><text x="${228 + Math.max(2, v / max * bw)}" y="${y + 20}" font-size="13">${v.toLocaleString('en')}</text>`; });
  s += `<text x="20" y="235" font-size="12" fill="#444">The woodland drew nothing here on master or now (a pre-existing throw in plantWoodland - HANDOVER G1330): its 92 physics trees within 1 km are the core's unseen cylinders.</text>`;
  imgs.push(['census', 1000, 270, svgDoc(1000, 270, s, 'The 2 on master are fill trees that happened to stand on a woodland physics tree\'s cylinder.')]);
}

(async () => {
  const { chromium } = require('playwright');
  const br = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const pg = await br.newPage();
  for (const [name, w, h, svg] of imgs) {
    await pg.setViewportSize({ width: w, height: h });
    await pg.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    const f = path.join(OUT, name + '.jpg');
    await pg.screenshot({ path: f, type: 'jpeg', quality: 82 });
    console.log(name + '.jpg', (fs.statSync(f).size / 1024).toFixed(0) + ' KB');
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
