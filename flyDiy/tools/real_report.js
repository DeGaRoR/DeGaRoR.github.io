#!/usr/bin/env node
// REAL REPORT (REAL-FIGURES-2, 2026-11-08) — ONE SELF-CONTAINED HTML REPORT OUT OF real_check's RESULTS.
//
// The user (8 Nov): "a little HTML report generator, that it can easily re-use in the future, and that outputs a great
// looking report, with clear graphics, color coding for the mismatches, conclusion on global performance and next steps,
// and graphical illustrations of statistics as much as possible ... a global 'accuracy' score to all planes in a global
// visualization, possibly on several axes like 'geometry', 'specs', 'performance'".
//
//   node tools/real_report.js                                   -> reads reports/evidence/REAL-CHECK-*/ (every folder,
//                                                                  the newest result per plane wins), writes
//                                                                  reports/REAL-CHECK-<today>.html
//   node tools/real_report.js --in=dirA,dirB --out=file.html --date=2026-11-08 --title="..."
//
// INPUT: real_check's per-plane JSON (`node tools/real_check.js <key> --json=<dir>/<key>.json`; a `<key>.shape.json` from
// a `--quick` run adds the geometry and specs to a plane flown before the shape was measured). The reference rows, the
// plane list, the history and the campaign's written findings come from tools/real_refs.js (REFS, PLANES, HISTORY, NOTES).
// The verdicts are recomputed from the CURRENT real_refs.js, so a corrected reference re-scores without a re-flight.
// OUTPUT: one HTML file - inline CSS and SVG, no script, no font or image fetched, light and dark (prefers-color-scheme,
// and data-theme on <html> wins both ways), phone width without a horizontal scroll. Every chart has a table beside it;
// every mark carries a native hover title.
//
// THE SCORES (stated again in the report's own "How the scores are computed" section, from the constants below):
//   item score   = 100 x max(0, 1 - gap / 0.30), gap = 0 inside the reference band (the figure +- its tolerance), else the
//                  relative distance to the band's nearest edge: 10 % out scores 67, 30 % out scores 0
//   GEOMETRY     = the weighted mean of the item scores of the key dimensions the reference states (W_GEO)
//   SPECS        = the same over the engine (family named right), power, engine count, propeller, weights, fuel, seats (W_SPEC)
//   PERFORMANCE  = the same over real_check's verdict bands, one reading per indicator: the airframe's (no pilot), else
//                  the handbook-flown (POH) - the aeroplane's capability; the shipped pilot's own gap is shown apart (W_PERF)
//   OVERALL      = W_AXES-weighted mean of the axes present (an axis with no item is left out and the rest renormalised)
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

// ---- scoring constants (the report prints these) ---------------------------------------------------------------------
const GAP0 = 0.30;
const W_AXES = { geometry: 0.30, specs: 0.30, performance: 0.40 };
const W_GEO = { span: 2, S: 2, length: 1.5, cRoot: 1, cTip: 0.5, hSpan: 1, Sh: 1, Sv: 1, track: 0.5, height: 0.5 };
const TOL_GEO = { span: 0.03, S: 0.03, length: 0.06, cRoot: 0.05, cTip: 0.05, hSpan: 0.05, Sh: 0.05, Sv: 0.05, track: 0.05, height: 0.10 };
const W_SPEC = { engine: 1.5, hp: 2, nE: 1, propD: 1, blades: 0.5, empty: 2, mtow: 1, fuelL: 0.5, seats: 0.5 };
const TOL_SPEC = { hp: 0.03, propD: 0.05, empty: 0.03, mtow: 0.05, fuelL: 0.10 };
const W_PERF = { Vs1: 1, V75: 1, Vmax: 1, roc: 1.5, roc2: 1, LD: 0.5, TO: 1, TO50: 0.5, LDG: 0.75, LDG50: 0.5, TOW: 1, TOW2: 0.75, TOWs: 0.5, TOW50: 0.5 };
const BANDS = [[80, 'good', 'close'], [60, 'warn', 'fair'], [0, 'bad', 'far']];
const LABEL = { span: 'span', S: 'wing area', length: 'length', cRoot: 'root chord', cTip: 'tip chord', hSpan: 'stab span', Sh: 'stab area', Sv: 'fin area',
  track: 'track', height: 'height', engine: 'engine', hp: 'power / engine', nE: 'engines', propD: 'prop diameter', blades: 'blades', empty: 'empty weight',
  mtow: 'max weight', fuelL: 'fuel', seats: 'seats', Vs1: 'stall (clean)', V75: 'cruise 75 %', Vmax: 'top speed', roc: 'rate of climb', roc2: 'climb (2nd weight)',
  LD: 'best glide', TO: 'take-off roll', TO50: 'take-off to 50 ft', LDG: 'landing roll', LDG50: 'landing from 50 ft', TOW: 'water run', TOW2: 'water run (2nd weight)',
  TOWs: 'water time', TOW50: 'water to 50 ft' };
const UNIT = { span: 'm', S: 'm²', length: 'm', cRoot: 'm', cTip: 'm', hSpan: 'm', Sh: 'm²', Sv: 'm²', track: 'm', height: 'm', hp: 'hp', propD: 'm', empty: 'kg', mtow: 'kg',
  fuelL: 'L', Vs1: 'km/h', V75: 'km/h', Vmax: 'km/h', roc: 'm/s', roc2: 'm/s', LD: '', TO: 'm', TO50: 'm', LDG: 'm', LDG50: 'm', TOW: 'm', TOW2: 'm', TOWs: 's', TOW50: 'm' };

// ---- inputs ----------------------------------------------------------------------------------------------------------
const RC = require(path.join(T, 'real_check.js'));
const RR = require(path.join(T, 'real_refs.js'));
const { REFS, PLANES, HISTORY } = RR;
const NOTES = RR.NOTES || {};
function inputDirs() {
  const given = opt('in', '');
  if (given) return given.split(',').map(d => path.resolve(d));
  const ev = path.join(ROOT, 'reports', 'evidence');
  return fs.readdirSync(ev).filter(d => /^REAL-CHECK-/.test(d)).sort().map(d => path.join(ev, d));
}
function loadResults() {
  const by = {}, shapes = {};
  for (const dir of inputDirs()) for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let o; try { o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
    if (!o || !o.key || !o.cases) continue;
    o._src = path.relative(ROOT, path.join(dir, f));
    if (f.endsWith('.shape.json')) { shapes[o.key] = o; continue; }
    by[o.key] = o;                                           // later folders (sorted by date) win
  }
  for (const k in shapes) { if (by[k]) { if (!by[k].shape) by[k].shape = shapes[k].shape; } else by[k] = shapes[k]; }
  for (const k in by) { try { by[k].verdicts = RC.verdicts(by[k]); } catch (e) { by[k].verdicts = by[k].verdicts || []; } }
  return by;
}

// ---- scoring ---------------------------------------------------------------------------------------------------------
const num = v => typeof v === 'number' && isFinite(v);
const rng = v => Array.isArray(v) ? [Math.min(...v), Math.max(...v)] : [v, v];
function gapOf(ours, ref, tol) {
  const [lo, hi] = rng(ref), a = lo * (1 - tol), b = hi * (1 + tol);
  if (ours >= a && ours <= b) return 0;
  return ours > b ? ours / b - 1 : 1 - ours / a;
}
const itemScore = g => 100 * Math.max(0, 1 - g / GAP0);
const signedErr = (ours, ref) => { const [lo, hi] = rng(ref); return ours > hi ? ours / hi - 1 : ours < lo ? ours / lo - 1 : 0; };
const famOf = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').match(/[A-Z]{1,3}-?\d{2,4}|GIPSY|CLERGET|TWIN WASP|ROTAX \d+/g) || [];
function scorePlane(o) {
  const R = REFS[o.ref] || {}, sh = o.shape || null, out = { geometry: null, specs: null, performance: null, items: { geometry: [], specs: [], performance: [] } };
  const agg = (items, W) => { let s = 0, w = 0; for (const it of items) { if (it.score == null) continue; s += it.score * (W[it.k] || 1); w += W[it.k] || 1; } return w > 0 ? s / w : null; };
  if (sh && R.dims) {
    for (const k of Object.keys(W_GEO)) {
      const ref = R.dims[k], ours = sh.dims[k];
      if (ref == null || !num(ours)) continue;
      const g = gapOf(ours, ref, TOL_GEO[k]);
      out.items.geometry.push({ k, ours, ref, err: signedErr(ours, ref), gap: g, score: itemScore(g) });
    }
    out.geometry = agg(out.items.geometry, W_GEO);
  }
  if (sh && R.specs) {
    const S = R.specs, o2 = sh.specs;
    for (const k of Object.keys(W_SPEC)) {
      const ref = S[k], ours = o2[k];
      if (ref == null || ours == null) continue;
      let g;
      if (k === 'engine') { const a = famOf(ours), b = famOf(ref); g = a.some(x => b.some(y => y.replace('-', '') === x.replace('-', ''))) ? 0 : 1; }
      else if (k === 'nE' || k === 'blades' || k === 'seats') { const [lo, hi] = rng(ref); g = ours >= lo && ours <= hi ? 0 : (k === 'nE' ? 1 : Math.min(1, Math.abs(ours - (ours < lo ? lo : hi)) / Math.max(1, hi) * 1.5)); }
      else g = gapOf(ours, ref, TOL_SPEC[k] || 0.05);
      out.items.specs.push({ k, ours, ref, err: typeof ours === 'number' ? signedErr(ours, ref) : null, gap: g, score: itemScore(g) });
    }
    out.specs = agg(out.items.specs, W_SPEC);
  }
  const seen = {};
  const pref = v => /^airframe/.test(v.src) ? 0 : /^POH/.test(v.src) ? 1 : /^rig/.test(v.src) ? 2 : 9;
  const rows = (o.verdicts || []).filter(v => v.k !== 'empty' && pref(v) < 9).sort((a, b) => pref(a) - pref(b));
  for (const v of rows) {
    if (seen[v.k]) continue; seen[v.k] = 1;
    const [a, b] = v.refBand, lo = v.ours[0], hi = v.ours[1];
    const g = (hi >= a && lo <= b) ? 0 : lo > b ? lo / b - 1 : 1 - hi / a;
    out.items.performance.push({ k: v.k, src: v.src, ours: v.ours, ref: v.ref, verdict: v.verdict, extrap: v.extrap, gap: g, score: itemScore(g), err: lo > b ? lo / b - 1 : hi < a ? hi / a - 1 : 0 });
  }
  out.performance = agg(out.items.performance, W_PERF);
  let s = 0, w = 0; for (const ax in W_AXES) if (out[ax] != null) { s += out[ax] * W_AXES[ax]; w += W_AXES[ax]; }
  out.overall = w > 0 ? s / w : null;
  return out;
}

// ---- html helpers ----------------------------------------------------------------------------------------------------
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (v, d = 0) => num(v) ? v.toFixed(d) : '—';
const fr = (v, d = 0) => Array.isArray(v) ? (v[0] === v[1] ? f(v[0], d) : f(v[0], d) + '–' + f(v[1], d)) : (typeof v === 'number' ? f(v, d) : esc(v));
const DEC = { roc: 2, roc2: 2, LD: 1, TOWs: 1, span: 2, length: 2, height: 2, cRoot: 2, cTip: 2, hSpan: 2, Sh: 2, Sv: 2, track: 2, propD: 2, S: 1 };
const pctS = e => num(e) ? (e >= 0 ? '+' : '−') + Math.abs(e * 100).toFixed(0) + ' %' : '—';
const band = s => s == null ? ['na', 'no data'] : (BANDS.find(b => s >= b[0]) || BANDS[2]).slice(1);
const ICON = { good: '●', warn: '▲', bad: '■', na: '○', inside: '●', near: '▲', outside: '■' };
const VCLS = { inside: 'good', near: 'warn', outside: 'bad' };
function chip(s, label) { const [c, w] = band(s); return '<span class="chip ' + c + '" title="' + esc((label ? label + ': ' : '') + (s == null ? 'no data' : f(s) + ' / 100, ' + w)) + '"><i>' + ICON[c] + '</i>' + (s == null ? '—' : f(s)) + '</span>'; }
function vchip(v, extrap) { const c = VCLS[v] || 'na'; return '<span class="chip ' + c + '"><i>' + ICON[c] + '</i>' + esc(v) + (extrap ? '*' : '') + '</span>'; }

// a radar on the three axes (one plane), 0-100
function radar(sc, size) {
  const r = size / 2 - 14, cx = size / 2, cy = size / 2 + 4, ax = ['geometry', 'specs', 'performance'], ang = i => -Math.PI / 2 + i * 2 * Math.PI / 3;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * r * v / 100, cy + Math.sin(ang(i)) * r * v / 100];
  let s = '<svg class="radar" viewBox="0 0 ' + size + ' ' + (size + 6) + '" width="' + size + '" height="' + (size + 6) + '" role="img" aria-label="three-axis accuracy">';
  for (const lv of [25, 50, 75, 100]) s += '<polygon class="grid" points="' + ax.map((a, i) => pt(i, lv).join(',')).join(' ') + '"/>';
  ax.forEach((a, i) => { const [x, y] = pt(i, 100); s += '<line class="grid" x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '"/>'; });
  const vals = ax.map(a => sc[a] == null ? 0 : sc[a]);
  s += '<polygon class="area ' + band(sc.overall)[0] + '" points="' + vals.map((v, i) => pt(i, v).join(',')).join(' ') + '"><title>geometry ' + f(sc.geometry) + ', specs ' + f(sc.specs) + ', performance ' + f(sc.performance) + '</title></polygon>';
  vals.forEach((v, i) => { const [x, y] = pt(i, v); s += '<circle class="dot ' + band(sc[ax[i]])[0] + '" cx="' + x + '" cy="' + y + '" r="4"><title>' + ax[i] + ' ' + f(sc[ax[i]]) + '</title></circle>'; });
  const lab = ['G', 'S', 'P'];
  ax.forEach((a, i) => { const [x, y] = pt(i, 118); s += '<text class="ax" x="' + x + '" y="' + (y + 4) + '" text-anchor="middle">' + lab[i] + '</text>'; });
  return s + '</svg>';
}
// horizontal score bars for the whole set
function overallBars(list) {
  const W = 640, rh = 26, L = 220, H = list.length * rh + 30, X = v => L + (W - L - 50) * v / 100;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="overall accuracy by plane">';
  for (const v of [0, 20, 40, 60, 80, 100]) s += '<line class="gridl" x1="' + X(v) + '" x2="' + X(v) + '" y1="4" y2="' + (H - 22) + '"/><text class="tick" x="' + X(v) + '" y="' + (H - 6) + '" text-anchor="middle">' + v + '</text>';
  list.forEach((p, i) => {
    const y = 6 + i * rh, sc = p.sc.overall;
    s += '<text class="lab" x="' + (L - 8) + '" y="' + (y + 15) + '" text-anchor="end">' + esc(p.short) + '</text>';
    if (sc != null) s += '<rect class="bar ' + band(sc)[0] + '" x="' + L + '" y="' + (y + 4) + '" width="' + Math.max(2, X(sc) - L) + '" height="' + (rh - 10) + '" rx="3"><title>' + esc(p.label) + ': ' + f(sc) + ' / 100</title></rect><text class="val" x="' + (X(sc) + 6) + '" y="' + (y + 15) + '">' + f(sc) + '</text>';
  });
  return s + '</svg>';
}
// the verdicts stacked per plane
function verdictStack(list) {
  const W = 640, rh = 24, L = 220, H = list.length * rh + 30;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="verdicts per plane">';
  const max = Math.max(1, ...list.map(p => (p.o.verdicts || []).length)), X = n => (W - L - 40) * n / max;
  list.forEach((p, i) => {
    const y = 6 + i * rh, V = p.o.verdicts || [];
    s += '<text class="lab" x="' + (L - 8) + '" y="' + (y + 14) + '" text-anchor="end">' + esc(p.short) + '</text>';
    let x = L;
    for (const k of ['inside', 'near', 'outside']) {
      const n = V.filter(v => v.verdict === k).length; if (!n) continue;
      s += '<rect class="bar ' + VCLS[k] + '" x="' + x + '" y="' + (y + 3) + '" width="' + Math.max(2, X(n) - 2) + '" height="' + (rh - 9) + '" rx="2"><title>' + esc(p.label) + ': ' + n + ' ' + k + '</title></rect>';
      if (X(n) > 16) s += '<text class="inbar" x="' + (x + X(n) / 2 - 1) + '" y="' + (y + 15) + '" text-anchor="middle">' + n + '</text>';
      x += X(n);
    }
  });
  return s + '</svg>';
}
// per indicator, every plane's signed deviation (performance items; dots on a % axis): the systematic biases
function biasDots(list) {
  const keys = ['Vs1', 'V75', 'Vmax', 'roc', 'LD', 'TO', 'TO50', 'LDG', 'TOW'], W = 640, rh = 30, L = 150, H = keys.length * rh + 34, lim = 0.6;
  const X = e => L + (W - L - 20) * (Math.max(-lim, Math.min(lim, e)) + lim) / (2 * lim);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="deviation by indicator across planes">';
  for (const e of [-0.6, -0.3, -0.1, 0, 0.1, 0.3, 0.6]) s += '<line class="' + (e === 0 ? 'zero' : 'gridl') + '" x1="' + X(e) + '" x2="' + X(e) + '" y1="4" y2="' + (H - 24) + '"/><text class="tick" x="' + X(e) + '" y="' + (H - 8) + '" text-anchor="middle">' + (e > 0 ? '+' : '') + (e * 100).toFixed(0) + ' %</text>';
  s += '<rect class="okzone" x="' + X(-0.1) + '" y="4" width="' + (X(0.1) - X(-0.1)) + '" height="' + (H - 28) + '"/>';
  keys.forEach((k, i) => {
    const y = 6 + i * rh;
    s += '<text class="lab" x="' + (L - 8) + '" y="' + (y + 16) + '" text-anchor="end">' + esc(LABEL[k]) + '</text><line class="gridl" x1="' + L + '" x2="' + (W - 20) + '" y1="' + (y + 12) + '" y2="' + (y + 12) + '"/>';
    list.forEach((p, j) => {
      const it = p.sc.items.performance.find(q => q.k === k); if (!it) return;
      const jit = ((j % 5) - 2) * 3;
      s += '<circle class="dot ' + VCLS[it.verdict] + '" cx="' + X(it.err) + '" cy="' + (y + 12 + jit) + '" r="5"><title>' + esc(p.short + ' ' + LABEL[k] + ': ' + pctS(it.err) + ' outside the band (' + it.verdict + ', ' + it.src + ')') + '</title></circle>';
    });
  });
  return s + '</svg>';
}
// the pilot's share: landing roll and climb, game vs best vs reference
function pilotBars(list) {
  const rows = list.filter(p => p.o.pilotShare && p.o.sweep);
  if (!rows.length) return '<p class="muted">No technique sweep in these results.</p>';
  const W = 640, rh = 34, L = 150, H = rows.length * rh + 40;
  const vmax = Math.max(...rows.map(p => Math.max(p.o.pilotShare.game.LDG || 0, p.o.sweep.best.LDG || 0, refMid(p, 'LDG') || 0))) * 1.08;
  const X = v => L + (W - L - 60) * v / vmax;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="landing roll: the game pilot against the best schedule">';
  for (const v of [0, 200, 400, 600, 800].filter(v => v <= vmax)) s += '<line class="gridl" x1="' + X(v) + '" x2="' + X(v) + '" y1="4" y2="' + (H - 26) + '"/><text class="tick" x="' + X(v) + '" y="' + (H - 10) + '" text-anchor="middle">' + v + ' m</text>';
  rows.forEach((p, i) => {
    const y = 6 + i * rh, g = p.o.pilotShare.game.LDG, b = p.o.sweep.best.LDG, r = refMid(p, 'LDG');
    s += '<text class="lab" x="' + (L - 8) + '" y="' + (y + 16) + '" text-anchor="end">' + esc(p.short) + '</text>';
    if (num(g)) s += '<rect class="bar s2" x="' + L + '" y="' + (y + 3) + '" width="' + Math.max(2, X(g) - L) + '" height="10" rx="2"><title>' + esc(p.short) + ': the game\'s pilot ' + f(g) + ' m</title></rect>';
    if (num(b)) s += '<rect class="bar s1" x="' + L + '" y="' + (y + 15) + '" width="' + Math.max(2, X(b) - L) + '" height="10" rx="2"><title>' + esc(p.short) + ': the best schedule ' + f(b) + ' m</title></rect>';
    if (num(r)) s += '<line class="refmark" x1="' + X(r) + '" x2="' + X(r) + '" y1="' + y + '" y2="' + (y + 28) + '"><title>reference ' + f(r) + ' m</title></line>';
  });
  return s + '</svg>';
}
const refMid = (p, k) => { const row = (REFS[p.o.ref] || {}).rows && REFS[p.o.ref].rows[k]; if (!row) return null; const [a, b] = rng(row.v); return (a + b) / 2; };
// one plane's band chart: per verdict row, the reference band (box), our MIN / TYP / MTOW values (markers, slots 1-3),
// our band at the reference's weights (the bar, coloured by verdict)
function bandChart(o) {
  const V = (o.verdicts || []).filter(v => v.k !== 'empty');
  if (!V.length) return '';
  const W = 680, rh = 26, L = 250, H = V.length * rh + 34, lim = 0.6;
  const X = e => L + (W - L - 16) * (Math.max(-lim, Math.min(lim, e)) + lim) / (2 * lim);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + esc(o.label) + ' bands">';
  for (const e of [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6]) s += '<line class="' + (e === 0 ? 'zero' : 'gridl') + '" x1="' + X(e) + '" x2="' + X(e) + '" y1="2" y2="' + (H - 24) + '"/><text class="tick" x="' + X(e) + '" y="' + (H - 8) + '" text-anchor="middle">' + (e > 0 ? '+' : '') + (e * 100).toFixed(0) + ' %</text>';
  V.forEach((v, i) => {
    const y = 4 + i * rh, mid = 0.5 * (v.ref[0] + v.ref[1]), pc = x => x / mid - 1, d = DEC[v.k] || 0;
    s += '<text class="lab" x="' + (L - 8) + '" y="' + (y + 15) + '" text-anchor="end">' + esc(LABEL[v.k] || v.k) + ' · ' + esc(v.src) + ' <tspan class="g ' + VCLS[v.verdict] + '">' + ICON[v.verdict] + '</tspan></text>';
    const a = X(pc(v.refBand[0])), b = X(pc(v.refBand[1]));
    s += '<rect class="refband" x="' + a + '" y="' + (y + 2) + '" width="' + Math.max(2, b - a) + '" height="' + (rh - 6) + '" rx="3"><title>reference ' + fr(v.ref, d) + ' ' + (UNIT[v.k] || '') + ' (band ' + fr(v.refBand, d) + ')</title></rect>';
    const oa = X(pc(v.ours[0])), ob = X(pc(v.ours[1]));
    s += '<rect class="bar ' + VCLS[v.verdict] + '" x="' + (Math.min(oa, ob) - 3) + '" y="' + (y + rh - 11) + '" width="' + Math.max(6, Math.abs(ob - oa) + 6) + '" height="7" rx="3"><title>ours at the reference\'s weights ' + fr(v.ours, d) + ' ' + (UNIT[v.k] || '') + ': ' + v.verdict + (v.extrap ? ' (extrapolated)' : '') + '</title></rect>';
    const ser = (v.series || []);
    ser.forEach((q, j) => { if (!num(q.v)) return; s += '<circle class="ld s' + (j + 1) + '" cx="' + X(pc(q.v)) + '" cy="' + (y + 8) + '" r="3.5"><title>' + ['MIN', 'TYP', 'MTOW'][j] + ' ' + f(q.m) + ' kg: ' + f(q.v, d) + ' ' + (UNIT[v.k] || '') + '</title></circle>'; });
  });
  return s + '</svg>';
}
// the global heatmap: planes x axes, a score in every cell
function heatmap(list) {
  let h = '<div class="tablewrap"><table class="heat"><thead><tr><th>plane</th><th>parent</th><th>geometry</th><th>specs</th><th>performance</th><th>overall</th><th>items</th></tr></thead><tbody>';
  for (const p of list) {
    const sc = p.sc, n = sc.items.geometry.length + sc.items.specs.length + sc.items.performance.length;
    h += '<tr><td><a href="#p-' + esc(p.key) + '">' + esc(p.short) + '</a>' + (p.o.provisional ? ' <span class="tag">provisional</span>' : '') + (p.light ? ' <span class="tag">light check</span>' : '') + (p.partial ? ' <span class="tag">partial: not ranked</span>' : '') + '</td><td class="muted">' + esc((REFS[p.o.ref] || {}).name || p.o.ref) + '</td>' +
      ['geometry', 'specs', 'performance', 'overall'].map(a => '<td class="cell ' + band(sc[a])[0] + '">' + chip(sc[a], a) + '</td>').join('') + '<td class="muted">' + n + '</td></tr>';
  }
  return h + '</tbody></table></div>';
}

// ---- the written conclusion (computed) + the campaign's own findings (real_refs NOTES) -------------------------------
function conclusion(list) {
  const sc = list.map(p => p.sc), mean = a => { const b = a.filter(num); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : null; };
  const full = list.filter(p => !p.partial).map(p => p.sc);
  const mG = mean(full.map(s => s.geometry)), mS = mean(full.map(s => s.specs)), mP = mean(full.map(s => s.performance)), mO = mean(full.map(s => s.overall));
  const ranked = list.filter(p => p.sc.overall != null && !p.partial).slice().sort((a, b) => b.sc.overall - a.sc.overall);
  const bias = {};
  // (the systematic biases leave out the planes on another engine than their parent's: their power rows are the build's
  // choice, which the specs axis already scores)
  for (const p of list) if (!p.o.engineNote) for (const it of p.sc.items.performance) (bias[it.k] = bias[it.k] || []).push(it.err);
  const biasL = Object.entries(bias).filter(([k, a]) => a.length >= 3).map(([k, a]) => ({ k, n: a.length, m: mean(a), out: a.filter(e => Math.abs(e) > 0.10).length }))
    .sort((a, b) => Math.abs(b.m) - Math.abs(a.m));
  let h = '<div class="tiles">' +
    '<div class="tile"><div class="big">' + chip(mO) + '</div><div class="lab2">overall, mean of ' + ranked.length + ' complete planes</div></div>' +
    '<div class="tile"><div class="big">' + chip(mG) + '</div><div class="lab2">geometry</div></div>' +
    '<div class="tile"><div class="big">' + chip(mS) + '</div><div class="lab2">specs</div></div>' +
    '<div class="tile"><div class="big">' + chip(mP) + '</div><div class="lab2">performance</div></div></div>';
  h += '<p>The set scores <b>' + f(mO) + ' / 100</b> overall. ';
  const ax = [['geometry', mG], ['specs', mS], ['performance', mP]].filter(x => x[1] != null).sort((a, b) => b[1] - a[1]);
  if (ax.length) h += 'The strongest axis is ' + ax[0][0] + ' (' + f(ax[0][1]) + '), the weakest ' + ax[ax.length - 1][0] + ' (' + f(ax[ax.length - 1][1]) + '). ';
  if (ranked.length) h += 'Closest to its real parent: <b>' + esc(ranked[0].short) + '</b> (' + f(ranked[0].sc.overall) + '); furthest: <b>' + esc(ranked[ranked.length - 1].short) + '</b> (' + f(ranked[ranked.length - 1].sc.overall) + ').';
  h += '</p>';
  const sys = biasL.filter(b => Math.abs(b.m) >= 0.05);
  if (sys.length) h += '<p>Systematic across the set (mean deviation outside the band, ≥ 3 planes on their parent\'s engine): ' + sys.map(b => esc(LABEL[b.k]) + ' ' + pctS(b.m) + ' (' + b.out + ' of ' + b.n + ' planes beyond 10 %)').join('; ') + '.</p>';
  return h;
}
function notesBlock(key) {
  const n = NOTES[key]; if (!n || !n.length) return '';
  return '<ul class="notes">' + n.map(x => '<li>' + x + '</li>').join('') + '</ul>';
}

// ---- the page --------------------------------------------------------------------------------------------------------
const CSS = `
:root{color-scheme:light;--bg:#f6f6f4;--surface:#fcfcfb;--card:#ffffff;--ink:#0b0b0b;--ink2:#52514e;--muted:#7a7974;--line:#e2e1dc;--grid:#ecebe7;
--good:#0ca30c;--warn:#fab219;--bad:#d03b3b;--na:#b9b8b2;--good-bg:#e4f4e4;--warn-bg:#fdf1d6;--bad-bg:#f8e1e1;--na-bg:#f0efec;
--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--ref:#52514e;--refbg:rgba(42,120,214,.10);--accent:#2a78d6}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){color-scheme:dark;--bg:#121211;--surface:#1a1a19;--card:#1f1f1d;--ink:#f0efec;--ink2:#c3c2b7;--muted:#9a998f;--line:#34332f;--grid:#2a2a27;
--good-bg:#173317;--warn-bg:#3a2f10;--bad-bg:#3d1b1b;--na-bg:#2a2a27;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--ref:#c3c2b7;--refbg:rgba(57,135,229,.16);--accent:#3987e5}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#121211;--surface:#1a1a19;--card:#1f1f1d;--ink:#f0efec;--ink2:#c3c2b7;--muted:#9a998f;--line:#34332f;--grid:#2a2a27;
--good-bg:#173317;--warn-bg:#3a2f10;--bad-bg:#3d1b1b;--na-bg:#2a2a27;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--ref:#c3c2b7;--refbg:rgba(57,135,229,.16);--accent:#3987e5}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:0 16px 64px}
.wrap{max-width:1100px;margin:0 auto}header{padding:32px 0 20px;border-bottom:2px solid var(--ink)}h1{font-size:clamp(28px,5vw,46px);line-height:1.05;margin:0 0 8px;letter-spacing:-.01em}
h2{font-size:24px;margin:44px 0 10px;padding-top:12px;border-top:1px solid var(--line)}h3{font-size:19px;margin:0}h4{font-size:14px;margin:18px 0 6px;color:var(--ink2);text-transform:uppercase;letter-spacing:.06em}
p{margin:8px 0;max-width:75ch}.muted{color:var(--muted)}.lede{color:var(--ink2);font-size:16px;max-width:75ch}a{color:var(--accent)}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin:16px 0}
.chip{display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums;font-weight:600;padding:1px 8px;border-radius:999px;border:1px solid var(--line);background:var(--na-bg);color:var(--ink);white-space:nowrap}
.chip i{font-style:normal;font-size:11px}.chip.good{background:var(--good-bg)}.chip.good i{color:var(--good)}.chip.warn{background:var(--warn-bg)}.chip.warn i{color:var(--warn)}.chip.bad{background:var(--bad-bg)}.chip.bad i{color:var(--bad)}
.tag{font-size:11px;text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--line);border-radius:3px;padding:0 5px;color:var(--ink2)}
.tablewrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}td.num,th.num{text-align:right}
table.heat td.cell{text-align:center}table.heat td.cell.good{background:var(--good-bg)}table.heat td.cell.warn{background:var(--warn-bg)}table.heat td.cell.bad{background:var(--bad-bg)}
.grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.mini{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px;text-align:center}
.mini .nm{font-size:13px;font-weight:600;line-height:1.2;min-height:2.4em}
svg{display:block;max-width:100%;height:auto}svg text{fill:var(--ink2);font-size:12px}svg .tick{fill:var(--muted);font-size:11px}svg .lab{fill:var(--ink)}svg .val{fill:var(--ink);font-weight:600}svg .inbar{fill:#fff;font-size:11px;font-weight:600}
svg .ax{fill:var(--muted);font-size:11px;font-weight:600}svg .grid,svg .gridl{stroke:var(--grid);fill:none;stroke-width:1}svg .zero{stroke:var(--ink2);stroke-width:1}svg .okzone{fill:var(--good-bg);opacity:.6}
svg .bar.good,svg .dot.good{fill:var(--good)}svg .bar.warn,svg .dot.warn{fill:var(--warn)}svg .bar.bad,svg .dot.bad{fill:var(--bad)}svg .bar.na{fill:var(--na)}svg .dot{stroke:var(--surface);stroke-width:2}
svg .g.good{fill:var(--good)}svg .g.warn{fill:var(--warn)}svg .g.bad{fill:var(--bad)}svg .bar.s1{fill:var(--s1)}svg .bar.s2{fill:var(--s2)}svg .ld.s1{fill:var(--s1)}svg .ld.s2{fill:var(--s2)}svg .ld.s3{fill:var(--s3)}svg .ld{stroke:var(--surface);stroke-width:2}
svg .refband{fill:var(--refbg);stroke:var(--ref);stroke-dasharray:4 3;stroke-width:1}svg .refmark{stroke:var(--ink);stroke-width:2;stroke-dasharray:3 2}
svg .area{fill-opacity:.25;stroke-width:2}svg .area.good{fill:var(--good);stroke:var(--good)}svg .area.warn{fill:var(--warn);stroke:var(--warn)}svg .area.bad{fill:var(--bad);stroke:var(--bad)}svg .area.na{fill:var(--na);stroke:var(--na)}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--ink2);margin:6px 0}.legend span{display:inline-flex;align-items:center;gap:6px}.sw{width:12px;height:12px;border-radius:3px;display:inline-block}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0}.tile{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.tile .big .chip{font-size:24px;padding:2px 12px}.lab2{font-size:13px;color:var(--ink2);margin-top:6px}
@media (max-width:640px){.tiles{grid-template-columns:repeat(2,1fr)}}
.plane-head{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}.plane-head .scores{display:flex;gap:6px;flex-wrap:wrap}
.notes li{margin:4px 0}details summary{cursor:pointer;color:var(--accent);margin:8px 0}code{font-size:13px;background:var(--na-bg);padding:0 4px;border-radius:3px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}@media (max-width:860px){.cols{grid-template-columns:minmax(0,1fr)}}
`;
function legendBands() {
  return '<div class="legend"><span><span class="sw" style="background:var(--refbg);border:1px dashed var(--ref)"></span>reference band (figure ± its tolerance)</span>' +
    '<span><span class="sw" style="background:var(--good)"></span>● inside</span><span><span class="sw" style="background:var(--warn)"></span>▲ near (≤ 10 % out)</span><span><span class="sw" style="background:var(--bad)"></span>■ outside</span>' +
    '<span><span class="sw" style="background:var(--s1);border-radius:50%"></span>MIN</span><span><span class="sw" style="background:var(--s2);border-radius:50%"></span>TYP (solo, ½ fuel)</span><span><span class="sw" style="background:var(--s3);border-radius:50%"></span>MTOW</span></div>';
}
function planeSection(p) {
  const o = p.o, R = REFS[o.ref] || {}, sc = p.sc;
  let h = '<section class="card" id="p-' + esc(p.key) + '"><div class="plane-head"><div><h3>' + esc(o.label) + '</h3><div class="muted">against the ' + esc(R.name || o.ref) + (o.provisional ? ' · <b>provisional</b>' : '') + (p.light ? ' · <b>light check</b>' : '') + '</div></div>' +
    '<div class="scores">' + ['geometry', 'specs', 'performance', 'overall'].map(a => '<span title="' + a + '">' + a[0].toUpperCase() + ' ' + chip(sc[a], a) + '</span>').join('') + '</div></div>';
  if (o.note || o.engineNote) h += '<p class="muted">' + esc([o.note, o.engineNote].filter(Boolean).join(' · ')) + '</p>';
  h += notesBlock(p.key);
  if ((o.verdicts || []).length) { h += '<h4>Performance bands</h4>' + legendBands() + bandChart(o); }
  h += '<div class="cols">';
  if (sc.items.geometry.length) {
    h += '<div><h4>Geometry</h4><div class="tablewrap"><table><thead><tr><th>dimension</th><th class="num">ours</th><th class="num">real</th><th class="num">off</th><th></th></tr></thead><tbody>';
    for (const it of sc.items.geometry) h += '<tr><td>' + esc(LABEL[it.k]) + ' <span class="muted">' + esc(UNIT[it.k] || '') + '</span></td><td class="num">' + f(it.ours, DEC[it.k] || 0) + '</td><td class="num">' + fr(it.ref, DEC[it.k] || 0) + '</td><td class="num">' + pctS(it.err) + '</td><td>' + chip(it.score) + '</td></tr>';
    h += '</tbody></table></div>' + (R.lengthNote ? '<p class="muted">The type\'s length runs ' + esc(R.lengthNote) + '; ours runs engine flange to rudder (~0.3 m shorter with a spinner).</p>' : '') + '</div>';
  }
  if (sc.items.specs.length) {
    h += '<div><h4>Specs</h4><div class="tablewrap"><table><thead><tr><th>item</th><th class="num">ours</th><th class="num">real</th><th class="num">off</th><th></th></tr></thead><tbody>';
    for (const it of sc.items.specs) h += '<tr><td>' + esc(LABEL[it.k]) + ' <span class="muted">' + esc(UNIT[it.k] || '') + '</span></td><td class="num">' + (typeof it.ours === 'number' ? f(it.ours, DEC[it.k] || 0) : esc(it.ours)) + '</td><td class="num">' + fr(it.ref, DEC[it.k] || 0) + '</td><td class="num">' + (it.err != null ? pctS(it.err) : (it.gap ? 'differs' : 'same')) + '</td><td>' + chip(it.score) + '</td></tr>';
    h += '</tbody></table></div></div>';
  }
  h += '</div>';
  if ((o.verdicts || []).length) {
    h += '<details><summary>Every verdict (table view of the chart)</summary><div class="tablewrap"><table><thead><tr><th>indicator</th><th>reading</th><th class="num">reference</th><th class="num">at kg</th><th class="num">ours</th><th>verdict</th><th class="num">ours = theirs at</th></tr></thead><tbody>';
    for (const v of o.verdicts) { const d = DEC[v.k] || 0;
      h += '<tr><td>' + esc(LABEL[v.k] || v.k) + '</td><td>' + esc(v.src) + '</td><td class="num">' + fr(v.ref, d) + '</td><td class="num">' + (v.kg ? fr(v.kg) : '—') + '</td><td class="num">' + fr(v.ours, d) + '</td><td>' + vchip(v.verdict, v.extrap) + '</td><td class="num">' + (v.mAt ? f(v.mAt) + ' kg' : '—') + '</td></tr>'; }
    h += '</tbody></table></div><p class="muted">* extrapolated: the reference\'s weights lie outside the loads flown (at most 15 % past them, along the MIN-MTOW secant).</p></details>';
  }
  if (o.cases && o.cases.length) {
    h += '<details><summary>The loads and the airframe readings</summary><div class="tablewrap"><table><thead><tr><th>load</th><th class="num">kg</th><th class="num">CG % MAC</th><th class="num">margin %</th><th class="num">Vs</th><th class="num">V75</th><th class="num">Vmax</th><th class="num">ROC</th><th class="num">L/D</th><th class="num">approach trim</th></tr></thead><tbody>';
    for (const c of o.cases) h += '<tr><td>' + esc(c.id) + '</td><td class="num">' + f(c.mass) + '</td><td class="num">' + f(c.cgMAC) + '</td><td class="num">' + f(c.sm) + '</td><td class="num">' + f(c.Vs) + '</td><td class="num">' + f(c.V75) + '</td><td class="num">' + f(c.Vmax) + '</td><td class="num">' + f(c.roc, 2) + '</td><td class="num">' + f(c.LD, 1) + '</td><td class="num">' + f(c.deAppr, 3) + '</td></tr>';
    h += '</tbody></table></div></details>';
  }
  if (o.pilotShare) { const ps = o.pilotShare;
    h += '<p><b>The pilot\'s share</b> (the game\'s pilot minus the best schedule, at ' + esc(ps.load) + '): take-off roll ' + sgn(ps.TO) + ' m, to 50 ft ' + sgn(ps.TO50) + ' m, climb ' + sgn(ps.climb, 2) + ' m/s, landing roll ' + sgn(ps.LDG) + ' m.</p>'; }
  h += '<p class="muted">Source: <code>' + esc(o._src || '') + '</code>' + (o.wall ? ' · ' + f(o.wall / 60) + ' min to measure' : '') + '</p>';
  return h + '</section>';
}
const sgn = (v, d = 0) => num(v) ? (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) : '—';
function scoringSection() {
  const w = o => Object.entries(o).map(([k, v]) => esc(LABEL[k] || k) + ' ' + v).join(', ');
  return '<h2 id="scoring">How the scores are computed</h2><div class="card">' +
    '<p><b>An item</b> scores <code>100 × max(0, 1 − gap / ' + GAP0 + ')</code>. The gap is 0 when ours sits inside the reference band (the figure ± its tolerance), otherwise the relative distance to the band\'s nearest edge: 10 % outside scores 67, ' + (GAP0 * 100) + ' % outside scores 0.</p>' +
    '<p><b>Geometry</b>: the weighted mean over the key dimensions the reference states. Weights: ' + w(W_GEO) + '. Tolerances: span and area 3 %, chords and tail 5 %, length 6 % (ours runs flange to rudder), height 10 % (the pose).</p>' +
    '<p><b>Specs</b>: the engine family (named right or not), power per engine (3 %), the engine count, the propeller diameter (5 %) and blades, the empty (3 %) and maximum (5 %) weights, fuel (10 %), seats. Weights: ' + w(W_SPEC) + '.</p>' +
    '<p><b>Performance</b>: real_check\'s verdict bands (our MIN–MTOW band at the reference\'s weights against the reference\'s condition band), one reading per indicator - the airframe\'s (probes, no pilot) where it exists, else the handbook-flown one. That is the aeroplane\'s capability; the shipped pilot\'s extra cost is shown apart as <i>the pilot\'s share</i>. Weights: ' + w(W_PERF) + '.</p>' +
    '<p><b>Overall</b> = ' + Object.entries(W_AXES).map(([k, v]) => v + ' × ' + k).join(' + ') + ', over the axes a plane has (the rest renormalised). Bands: ● ≥ 80 close, ▲ 60–80 fair, ■ under 60 far.</p>' +
    '<p class="muted">A reference marked THIN in tools/real_refs.js (one source, or sources that disagree) carries a wider tolerance or a range: a thin figure can neither condemn nor clear a plane by much.</p></div>';
}
function historySection() {
  let h = '<h2 id="history">Every earlier comparison</h2><p class="muted">From tools/real_refs.js HISTORY (the reports each row names).</p><div class="tablewrap"><table><thead><tr><th>plane</th><th>date</th><th>numbers then</th><th>still in the game</th></tr></thead><tbody>';
  for (const r of HISTORY) {
    const t = r.then ? Object.entries(r.then).map(([k, v]) => esc(LABEL[k] || k) + ' ' + esc(v)).join(', ') : '';
    h += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.date) + '</td><td>' + t + (r.flown ? '<br><span class="muted">flown: ' + Object.entries(r.flown).map(([k, v]) => esc(k) + ' ' + esc(v)).join(', ') + '</span>' : '') + '</td><td>' + esc(r.alive) + '</td></tr>';
  }
  return h + '</tbody></table></div>';
}

function main() {
  const res = loadResults();
  const order = Object.keys(PLANES).filter(k => res[k]).concat(Object.keys(res).filter(k => !PLANES[k]));
  const list = order.map(k => { const o = res[k], P = PLANES[k] || {}; return { key: k, o, label: o.label || P.label || k, short: (o.label || P.label || k).replace(/\s*\(.*\)\s*$/, ''), light: k === 'skymaster' || !!P.light, sc: scorePlane(o) }; });
  const date = opt('date', new Date().toISOString().slice(0, 10));
  const title = opt('title', 'Real Check');
  for (const p of list) p.partial = p.sc.geometry == null || p.sc.specs == null || p.sc.performance == null;
  const sorted = list.filter(p => p.sc.overall != null && !p.partial).slice().sort((a, b) => b.sc.overall - a.sc.overall);
  let sha = ''; try { sha = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) {}
  let html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body><div class="wrap">';
  html += '<header><div class="muted">flyDiy · ' + esc(date) + (sha ? ' · tree ' + esc(sha) : '') + '</div><h1>' + esc(title) + ': the planes against their real parents</h1>' +
    '<p class="lede">' + list.length + ' planes, each measured at three loads (one light pilot, solo with half fuel, the type\'s gross) and compared with its real parent\'s published figures, each read at the conditions it was stated at. Scored on three axes: <b>geometry</b> (do we reproduce the shape), <b>specs</b> (did we pick the right engine, propeller and weights), <b>performance</b> (does it fly like the real one).</p></header>';
  html += '<h2 id="global">The global view</h2>' + conclusion(list) + notesBlock('_global');
  html += '<h4>Accuracy, every plane on every axis</h4>' + heatmap(list);
  html += '<h4>The three axes, plane by plane</h4><div class="grid2">' + list.map(p => '<a class="mini" href="#p-' + esc(p.key) + '" style="text-decoration:none;color:inherit"><div class="nm">' + esc(p.short) + '</div>' + radar(p.sc, 120) + '<div>' + chip(p.sc.overall, 'overall') + '</div></a>').join('') + '</div><p class="muted">G geometry · S specs · P performance; the further out, the closer to the real parent.</p>';
  html += '<h4>Overall score, ranked</h4>' + overallBars(sorted);
  html += '<h2 id="stats">The statistics</h2>';
  html += '<h4>Verdicts per plane (every indicator and reading)</h4><div class="legend"><span><span class="sw" style="background:var(--good)"></span>● inside</span><span><span class="sw" style="background:var(--warn)"></span>▲ near</span><span><span class="sw" style="background:var(--bad)"></span>■ outside</span></div>' + verdictStack(list);
  html += '<h4>Where the set is off: each plane\'s deviation, indicator by indicator</h4><p class="muted">One dot per plane: 0 = inside the reference band, otherwise how far outside its edge. The shaded zone is ±10 %. A column of dots on one side is a model-wide bias, not one plane\'s.</p>' + biasDots(list);
  html += '<h4>The pilot\'s share: the landing roll</h4><div class="legend"><span><span class="sw" style="background:var(--s2)"></span>the game\'s pilot</span><span><span class="sw" style="background:var(--s1)"></span>the best schedule (same pilot, handbook braking)</span><span><span class="sw" style="border:2px dashed var(--ink)"></span>reference</span></div>' + pilotBars(list);
  html += '<h2 id="next">Conclusions and next steps</h2><div class="card">' + (notesBlock('_conclusion') || '<p class="muted">No written conclusion in real_refs.js NOTES._conclusion.</p>') + '<h4>Next steps</h4>' + (notesBlock('_next') || '<p class="muted">None written.</p>') + '</div>';
  html += '<h2 id="planes">Plane by plane</h2>' + list.map(planeSection).join('');
  html += scoringSection() + historySection();
  html += '<h2>Regenerate</h2><p><code>node tools/real_check.js &lt;plane&gt; --json=reports/evidence/REAL-CHECK-&lt;date&gt;/&lt;plane&gt;.json</code> then <code>node tools/real_report.js</code>. The verdicts and scores are recomputed from tools/real_refs.js every time.</p>';
  html += '</div></body></html>\n';
  const out = opt('out', path.join(ROOT, 'reports', 'REAL-CHECK-' + date + '.html'));
  fs.writeFileSync(out, html);
  console.log('wrote ' + path.relative(process.cwd(), out) + ' (' + (html.length / 1024).toFixed(0) + ' KB, ' + list.length + ' planes)');
  for (const p of sorted) console.log('  ' + p.short.padEnd(34) + ' G ' + f(p.sc.geometry).padStart(3) + '  S ' + f(p.sc.specs).padStart(3) + '  P ' + f(p.sc.performance).padStart(3) + '  = ' + f(p.sc.overall));
}
if (require.main === module) main();
module.exports = { scorePlane, gapOf, itemScore };
