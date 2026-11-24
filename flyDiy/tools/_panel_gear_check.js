#!/usr/bin/env node
// _panel_gear_check.js - PERF-SLIDERS (23 Nov 2026): THE GEAR SELECTOR'S PLACE IS THE PLAIN SEARCH'S.
// placeGear (tools/_panel_gen.js) tries every 5 mm of the dash's plate, both sides, for the selector's gate and lamps. It
// asked the plate's outline at every sample of every candidate (the DC-3's dash: 0.56 s of every crew build in the page in
// node); it now asks once a column of candidates and judges every height against that answer. This check holds the claim
// that nothing moved: placeGearPlain below is the search as it stood before (a candidate refused at its first failing
// sample), and over --n random dashes (2000: plates with a curved crown and floor, columns missing at the edges, dials,
// switches, screens and keep-outs scattered over them, the throttle anywhere, every `at`, a plate with no outline, a
// dash too full for any place) both must answer the SAME gate - x, y, side, box, lamps, bit for bit - or the same
// overflow. Pure node, no page: under a second.
// Usage: node tools/_panel_gear_check.js [--n 2000] [--seed 1]. Exit 1 on any difference; the last line is the verdict.
'use strict';
const fs = require('fs'), path = require('path');
const G = require('./_panel_gen.js');
const { GEAR_GATE, GEAR_LAMP_DX, gearLamps, placeGear } = G;
const PAN_INSET = +/PAN_INSET = ([0-9.]+)/.exec(fs.readFileSync(path.join(__dirname, '_panel_gen.js'), 'utf8'))[1];
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const N = +opt('n', 2000);
let seed = +opt('seed', 1) >>> 0;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const R = (a, b) => a + (b - a) * rnd();

// ---- the plain search: placeGear as it stood before the column's answer was kept (the oracle) -------------------------
function placeGearPlain(A, o, L) {
  const G = o && o.gearLever;
  if (!G) return L;
  const F = A && A.face ? A.face : null;
  const KO = Array.isArray(A && A.keepOut) ? A.keepOut : [];
  const yTop = L.yTop, yBot = L.yBot, xLim = L.xLim, pX = o.pilotX || 0;
  const thrX = A && typeof A.thrX === 'number' && isFinite(A.thrX) ? A.thrX : null;
  const at = ['throttle', 'pilot', 'centre', 'copilot'].includes(G.at) ? G.at : 'throttle';
  const xT = at === 'centre' ? 0 : at === 'copilot' ? (Math.abs(pX) > 0.05 ? -pX : -0.20)
           : at === 'pilot' ? pX : thrX != null ? thrX : pX;
  const boxes = [];
  for (const d of L.dials) if (!d.coaming) boxes.push({ circle: true, cx: d.cx, cy: d.cy, r: d.r + 0.006 });
  for (const s of L.switches) {
    const hw = s.kind === 'key' ? 0.022 : 0.013;
    boxes.push({ x0: s.x - hw, x1: s.x + hw, y0: s.y - (s.kind === 'flap' ? 0.024 : 0.016), y1: s.y + (s.kind === 'flap' ? 0.046 : 0.032) });
  }
  for (const k of KO) boxes.push({ x0: k.x0 - 0.004, x1: k.x1 + 0.004, y0: k.y0 - 0.004, y1: k.y1 + 0.004 });
  for (const q of (L.screens || [])) if (!q.coaming) boxes.push({ x0: q.cx - q.w / 2 - 0.006, x1: q.cx + q.w / 2 + 0.006, y0: q.cy - q.h / 2 - 0.006, y1: q.cy + q.h / 2 + 0.006 });
  const hits = (x0, x1, y0, y1) => boxes.some(b => {
    if (b.circle) { const nx = Math.max(x0, Math.min(b.cx, x1)), ny = Math.max(y0, Math.min(b.cy, y1)); return Math.hypot(nx - b.cx, ny - b.cy) < b.r; }
    return x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1;
  });
  const onPlate = (x0, x1, y0, y1) => {
    if (x0 < -xLim - 1e-6 || x1 > xLim + 1e-6 || y1 > yTop + 1e-6 || y0 < yBot - 1e-6) return false;
    if (!F) return true;
    const ns = Math.max(1, Math.ceil((x1 - x0) / 0.01));
    for (let i = 0; i <= ns; i++) {
      const x = x0 + (x1 - x0) * i / ns, c = F.at(x);
      if (!c || Math.abs(c.x - x) > 0.03) return false;
      if (y1 > c.y1 - PAN_INSET + 1e-6 || y0 < c.y0 + PAN_INSET - 1e-6) return false;
    }
    return true;
  };
  const ext = s => ({ x0: Math.min(-GEAR_GATE.w / 2 - 0.001, s * GEAR_LAMP_DX - 0.014), x1: Math.max(GEAR_GATE.w / 2 + 0.001, s * GEAR_LAMP_DX + 0.014),
                      y0: -GEAR_GATE.half, y1: GEAR_GATE.half });
  let best = null;
  for (let cx = -xLim; cx <= xLim + 1e-9; cx += 0.005)
    for (let cy = yBot + GEAR_GATE.half; cy + GEAR_GATE.half <= yTop + 1e-9; cy += 0.005) {
      // the lamps toward the panel's middle (and toward the throttle when it stands beside the plate's edge)
      for (const s of cx > 1e-9 ? [-1, 1] : [1, -1]) {
        const e = ext(s), x0 = cx + e.x0, x1 = cx + e.x1, y0 = cy + e.y0, y1 = cy + e.y1;
        if (!onPlate(x0, x1, y0, y1) || hits(x0 - 0.004, x1 + 0.004, y0 - 0.004, y1 + 0.004)) continue;
        const score = Math.abs(cx - xT) + 0.5 * (y0 - yBot) + (s === (cx > 1e-9 ? -1 : 1) ? 0 : 0.002);
        if (!best || score < best.score - 1e-12) best = { cx, cy, s, score, x0, x1, y0, y1 };
      }
    }
  if (!best) { L.extraOverflow.push('gear'); return L; }
  const n = [1, 2, 4].includes(G.n) ? G.n : 3, amph = !!G.amph;
  L.gear = { x: best.cx, y: best.cy, s: best.s, at, n, amph, lamps: gearLamps(n, amph, best.s),
             box: { x0: best.x0 - 0.004, x1: best.x1 + 0.004, y0: best.y0 - 0.004, y1: best.y1 + 0.004 } };
  return L;
}

// ---- a random dash ----------------------------------------------------------------------------------------------------
function dash() {
  const xLim = R(0.12, 0.75), yBot = R(-0.25, -0.05), yTop = yBot + R(0.12, 0.45);
  let F = null;
  if (rnd() > 0.08) {
    const step = R(0.008, 0.05), cols = [], bow = R(-0.08, 0.08), sag = R(-0.05, 0.05), cut = rnd() < 0.3 ? R(0.5, 0.95) : 2;
    for (let x = -xLim * R(0.9, 1.1); x <= xLim * 1.1; x += step * R(0.7, 1.3)) {
      if (Math.abs(x) > xLim * cut) continue;
      const t = x / xLim;
      cols.push({ x, y1: yTop + bow * t * t + (rnd() < 0.02 ? NaN : 0), y0: yBot + sag * t * t });
    }
    cols.sort((a, b) => a.x - b.x);
    F = { cols, at(x) { let best = null; for (const c of cols) if (!best || Math.abs(c.x - x) < Math.abs(best.x - x)) best = c; return best; } };
  }
  const full = rnd() < 0.06, nd = full ? 60 : Math.floor(R(0, 9)), dials = [], switches = [], screens = [], keepOut = [];
  for (let i = 0; i < nd; i++) dials.push({ cx: R(-xLim, xLim), cy: R(yBot, yTop), r: full ? 0.06 : R(0.02, 0.045), coaming: rnd() < 0.1 });
  for (let i = 0, n = Math.floor(R(0, 7)); i < n; i++) switches.push({ x: R(-xLim, xLim), y: R(yBot, yTop), kind: ['key', 'flap', 'toggle'][Math.floor(R(0, 3))] });
  for (let i = 0, n = Math.floor(R(0, 3)); i < n; i++) screens.push({ cx: R(-xLim, xLim), cy: R(yBot, yTop), w: R(0.08, 0.25), h: R(0.06, 0.18), coaming: rnd() < 0.15 });
  for (let i = 0, n = Math.floor(R(0, 3)); i < n; i++) { const x0 = R(-xLim, xLim), y0 = R(yBot, yTop); keepOut.push({ x0, x1: x0 + R(0.01, 0.2), y0, y1: y0 + R(0.01, 0.15) }); }
  const A = { face: F, keepOut, thrX: rnd() < 0.7 ? R(-xLim * 1.2, xLim * 1.2) : (rnd() < 0.5 ? NaN : undefined) };
  const o = { pilotX: rnd() < 0.8 ? R(-0.4, 0.4) : 0, gearLever: { at: ['throttle', 'pilot', 'centre', 'copilot', 'elsewhere'][Math.floor(R(0, 5))], n: [1, 2, 3, 4, 7][Math.floor(R(0, 5))], amph: rnd() < 0.2 } };
  const L = () => ({ yTop, yBot, xLim, dials: dials.map(d => Object.assign({}, d)), switches: switches.map(s => Object.assign({}, s)), screens: screens.map(s => Object.assign({}, s)), extraOverflow: [] });
  return { A, o, L };
}
let bad = 0, placed = 0, over = 0, tNew = 0, tOld = 0;
for (let i = 0; i < N; i++) {
  const d = dash();
  const t0 = process.hrtime.bigint(); const a = placeGear(d.A, d.o, d.L());
  const t1 = process.hrtime.bigint(); const b = placeGearPlain(d.A, d.o, d.L());
  const t2 = process.hrtime.bigint(); tNew += Number(t1 - t0) / 1e6; tOld += Number(t2 - t1) / 1e6;
  const ja = JSON.stringify([a.gear || null, a.extraOverflow]), jb = JSON.stringify([b.gear || null, b.extraOverflow]);
  if (a.gear) placed++; else over++;
  if (ja !== jb) { bad++; if (bad <= 5) console.log('  DIFFER dash ' + i + '\n    now:   ' + ja.slice(0, 300) + '\n    plain: ' + jb.slice(0, 300)); }
}
console.log('  ' + N + ' dashes: ' + placed + ' placed, ' + over + ' with no place; ' + bad + ' differ; the search ' + tOld.toFixed(0) + ' ms plain, ' + tNew.toFixed(0) + ' ms now');
if (!placed || !over) { console.log('  the dashes did not cover both a place and an overflow'); bad++; }
console.log('GATE PANELGEAR: ' + (bad ? 'FAIL' : 'PASS'));
process.exit(bad ? 1 : 0);
