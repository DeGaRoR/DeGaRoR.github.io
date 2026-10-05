#!/usr/bin/env node
// _obstframe_check.js — GATE OBSTFRAME (REVIEW 2026-10-04, finding A6): the settlement houses' hitboxes stand where
// the houses are DRAWN. The renderer (render_world.js) places a house with rotation.y = -b.rot and scale (w, hgt, l);
// the registry (29_obstacles.js) turns its box the other way, so `yaw: b.rot` mirrored every box against its drawing
// (rotated -2.rot: 90 deg off at 45). This samples points inside and just outside each drawn footprint, in the
// renderer's own frame, and asks the registry; agreement must be >= 97 % (the rest is the 1 m raster cell).
// Verdict contract: one final `GATE OBSTFRAME: PASS|FAIL`, exit code to match. ~2 s.
const C = require('./flight_core.js');
const W = C.makeWorld(), OB = W.obstacles, BL = (W.roadNet && W.roadNet.buildings) || [];
const pen = [0, 0, 0], scratch = [];
let n = 0, agree = 0, nF = 0, agreeF = 0, houses = 0, missing = 0;
for (const b of BL) {
  if (!(b.w > 0 && b.l > 0 && b.hgt > 0)) continue;
  // the registered record nearest this house's centre, tagged settle
  let rec = null, best = 1e9;
  for (const id of OB.near(b.x, b.z, scratch)) {
    const r = OB.get(id); if (!r || r.tag !== 'settle') continue;
    const d = (r.x - b.x) ** 2 + (r.z - b.z) ** 2; if (d < best) { best = d; rec = r; }
  }
  if (!rec || best > 0.25) { missing++; continue; }
  houses++;
  const th = -b.rot, c = Math.cos(th), s = Math.sin(th);
  const flip = Object.assign({}, rec, { s: -rec.s });   // the same box registered with the OPPOSITE yaw (the old bug)
  const ask = (R, lx, lz) => !!C.OBSTACLES.penetration(R, b.x + lx * c + lz * s, rec.y0 + 1.0, b.z - lx * s + lz * c, pen);   // THREE rotation.y = th
  // inside: an ellipse at 0.6 of the half sizes (inscribed in the 0.6 rectangle); outside: the rectangle's perimeter
  // offset OUT metres past the walls (the raster rounds a footprint outward by under its 1 m cell)
  for (let i = 0; i < 12; i++) {
    const ang = i / 12 * 2 * Math.PI, lx = Math.cos(ang) * b.w / 2 * 0.6, lz = Math.sin(ang) * b.l / 2 * 0.6;
    n++; if (ask(rec, lx, lz)) agree++;  nF++; if (ask(flip, lx, lz)) agreeF++;
  }
  const OUT = 2.0, hw = b.w / 2 + OUT, hl = b.l / 2 + OUT, per = 4 * (hw + hl);
  for (let i = 0; i < 12; i++) {
    let u = (i + 0.5) / 12 * per, lx, lz;
    if (u < 2 * hw) { lx = -hw + u; lz = -hl; } else if ((u -= 2 * hw) < 2 * hl) { lx = hw; lz = -hl + u; }
    else if ((u -= 2 * hl) < 2 * hw) { lx = hw - u; lz = hl; } else { u -= 2 * hw; lx = -hw; lz = hl - u; }
    n++; if (!ask(rec, lx, lz)) agree++;  nF++; if (!ask(flip, lx, lz)) agreeF++;
  }
}
const pct = n ? 100 * agree / n : 0, pctF = nF ? 100 * agreeF / nF : 0;
console.log(`houses ${houses} (unmatched ${missing}), samples ${n}, agreement ${pct.toFixed(1)} % (the opposite yaw would read ${pctF.toFixed(1)} %)`);
const fails = [];
if (houses < 10) fails.push('fewer than 10 houses matched');
if (pct < 97) fails.push(`agreement ${pct.toFixed(1)} % < 97 %`);
if (pct < pctF) fails.push(`the opposite yaw fits better (${pctF.toFixed(1)} %)`);
if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log(fails.length ? 'GATE OBSTFRAME: FAIL' : 'GATE OBSTFRAME: PASS');
process.exitCode = fails.length ? 1 : 0;
