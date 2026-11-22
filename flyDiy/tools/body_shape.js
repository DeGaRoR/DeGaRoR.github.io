#!/usr/bin/env node
// THE BODY AS DRAWN, MEASURED (FUSELAGE-DRAG STUDY, 22 Nov 2026) - a node-side reader, nothing in the game reads it yet.
// It slices the body the editor draws (cageSheet: the cage, subdivided, with its creases - what the page shows) at
// stations along its length and measures each section: area, perimeter, width, height, the top / bottom / side lines,
// and how much of the outline's turning sits in sharp corners. From those: the steps, the closure, the fineness.
//   node tools/body_shape.js <plane key> [--profile]      (keys: tools/real_refs.js PLANES)
//   require('./body_shape.js').measure(cageRows) -> { stations: [...], ... }
'use strict';
const path = require('path');
const T = __dirname;
let PANEL = null;
function panel() {
  if (PANEL) return PANEL;
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  if (!global.THREE) global.THREE = new Proxy({}, { get: (t, k) => k === 'Vector3' ? function () { return { set: noop, x: 0, y: 0, z: 0 }; } : class extends Obj {} });
  if (!global.window) global.window = { THREE: global.THREE };
  // (the editor's own list and order: tools/_parts_check.js loadPanel)
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_panel_gen.js', '_cage_panel.js', '_cage_furnish.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_float_gen.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js', '_hinge_gen.js', '_rod_fit.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js',
    '_cage_stab.js', '_cage_access.js', '_cage_light.js', '_bay_site.js', '_vessel_gen.js', '_cage_energy.js', '_cage_hinge.js']) require(path.join(T, f));
  PANEL = { G: require(path.join(T, '_cage_gen.js')), W: global.window };
  return PANEL;
}
const NB = 72;                                   // the outline, one point every 5 degrees round the section's centre
// one section: the mesh cut at z, the outer outline by direction from the section's own centre
function sectionAt(V, F, z) {
  const segs = [];
  for (const f of F) {
    const q = f.v, n = q.length;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = V[q[i]], b = V[q[(i + 1) % n]], da = a[2] - z, db = b[2] - z;
      if ((da > 0) !== (db > 0)) { const t = da / (da - db); pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    if (pts.length >= 2) segs.push([pts[0], pts[1]]);
  }
  if (segs.length < 3) return null;
  let yLo = Infinity, yHi = -Infinity, xHi = 0;
  for (const s of segs) for (const p of s) { yLo = Math.min(yLo, p[1]); yHi = Math.max(yHi, p[1]); xHi = Math.max(xHi, Math.abs(p[0])); }
  const cy = 0.5 * (yLo + yHi), r = new Array(NB).fill(0);
  // the farthest crossing of each direction's ray with the cut's segments (the outer skin; frames inside are ignored)
  for (let k = 0; k < NB; k++) {
    const th = 2 * Math.PI * (k + 0.5) / NB, dx = Math.cos(th), dy = Math.sin(th);
    for (const s of segs) {
      const ax = s[0][0], ay = s[0][1] - cy, ex = s[1][0] - s[0][0], ey = s[1][1] - s[0][1];
      const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
      const t = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t > r[k]) r[k] = t;
    }
  }
  if (r.some(v => !(v > 0))) return null;
  const P = r.map((v, k) => { const th = 2 * Math.PI * (k + 0.5) / NB; return [v * Math.cos(th), cy + v * Math.sin(th)]; });
  let A = 0, per = 0, sharp = 0;
  const base = 2 * Math.PI / NB;
  for (let k = 0; k < NB; k++) {
    const a = P[k], b = P[(k + 1) % NB], c = P[(k + 2) % NB];
    A += a[0] * b[1] - b[0] * a[1]; per += Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let dt = t2 - t1; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
    sharp += Math.max(0, Math.abs(dt) - 3 * base);        // the turning beyond three times a circle's share at one point
  }
  return { z, A: 0.5 * Math.abs(A), per, w: 2 * xHi, h: yHi - yLo, yTop: yHi, yBot: yLo, sharp: sharp / (2 * Math.PI) };
}
function measure(cageRows, n) {
  const { G, W } = panel();
  const P = Object.assign({}, G.CAGE_PARAMS, (W.CAGE_PAGE && W.CAGE_PAGE.defaults) || {}, cageRows);
  const sh = G.cageSheet(P, {}).sheet, V = sh.V, F = sh.F;
  let z0 = Infinity, z1 = -Infinity; for (const v of V) { z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]); }
  const N = n || 60, st = [];
  for (let i = 0; i < N; i++) { const z = z1 - (z1 - z0) * (i + 0.5) / N, s = sectionAt(V, F, z); if (s) { s.x = z1 - z; st.push(s); } }   // x from the front, aft
  return { len: z1 - z0, stations: st };
}
// THE SHAPE NUMBERS: what a drag law can read off the profile (all ratios or angles: the cage's unit drops out)
//   fineness   length over the largest section's equivalent diameter
//   fullness   area over width x height at the large sections (a rectangle 1, an ellipse 0.785)
//   sharp      the share of the outline's turning that sits in sharp corners, perimeter-weighted (a tube 0, a sharp box ~0.65)
//   screen     the steepest forward-facing rise of the top line (deg) and the height it gains there over the largest height
//   closure    the steepest closing of the equivalent radius behind the largest section (deg), and of the bottom line (upsweep)
//   kink       the largest change of the equivalent radius' slope between two stations (deg): a step, a break
//   noseA, tailA   the first and last sections' areas over the largest: a blunt front, a base
function shape(M) {
  const st = M.stations, n = st.length, deg = 180 / Math.PI;
  let iMax = 0; for (let i = 0; i < n; i++) if (st[i].A > st[iMax].A) iMax = i;
  const Amax = st[iMax].A, dEq = Math.sqrt(4 * Amax / Math.PI), hMax = Math.max(...st.map(s => s.h));
  let fw = 0, fs = 0, wS = 0, wF = 0, swet = 0;
  for (let i = 0; i < n; i++) { const s = st[i]; fs += s.sharp * s.per; wS += s.per; if (s.A > 0.5 * Amax) { fw += s.A / (s.w * s.h) * s.per; wF += s.per; }
    if (i) swet += 0.5 * (s.per + st[i - 1].per) * (s.x - st[i - 1].x); }
  const r = st.map(s => Math.sqrt(s.A / Math.PI)), sl = [], top = [], bot = [];
  for (let i = 1; i < n; i++) { const dx = st[i].x - st[i - 1].x; sl.push(Math.atan2(r[i] - r[i - 1], dx) * deg); top.push(Math.atan2(st[i].yTop - st[i - 1].yTop, dx) * deg); bot.push(Math.atan2(st[i].yBot - st[i - 1].yBot, dx) * deg); }
  let scrA = 0, scrH = 0, close = 0, up = 0, kink = 0;
  for (let i = 0; i < sl.length; i++) {
    if (i < iMax && top[i] > scrA) scrA = top[i];
    if (i < iMax && top[i] > 12) scrH += st[i + 1].yTop - st[i].yTop;      // the height gained on a slope steeper than a body's own nose
    if (i >= iMax) { close = Math.max(close, -sl[i]); up = Math.max(up, bot[i]); }
    if (i) kink = Math.max(kink, Math.abs(sl[i] - sl[i - 1]));
  }
  // THE STEPS AND THE BASE, as areas (in the cage's unit squared; the caller scales them):
  //   stepA   forward-facing area met ON A BODY (not its own nose) at more than 25 deg: the top line's rise x the width
  //           there, the sides' spread x the height there, each weighted g = (sin2 - sin2 25) / (1 - sin2 25) - a wall
  //           square to the flow counts whole, a 45 deg screen 0.39, a 30 deg one 0.09, a nose under 25 deg nothing
  //   baseA   area closed behind the largest section faster than the flow follows (13 deg of the equivalent radius),
  //           weighted (sin - sin 13) / (1 - sin 13): a cut-off end counts whole
  const s25 = Math.pow(Math.sin(25 / deg), 2), s13 = Math.sin(13 / deg);
  const g = th => Math.max(0, (Math.pow(Math.sin(Math.max(0, th) / deg), 2) - s25) / (1 - s25));
  let stepA = 0, baseA = 0, xTrip = null;
  for (let i = 1; i < n; i++) {
    const a = st[i - 1], c = st[i], dx = c.x - a.x;
    if (i <= iMax) {
      const gt = g(Math.atan2(c.yTop - a.yTop, dx) * deg), gs = g(Math.atan2(0.5 * (c.w - a.w), dx) * deg), gb = g(Math.atan2(a.yBot - c.yBot, dx) * deg);
      const d = Math.max(0, c.yTop - a.yTop) * 0.5 * (a.w + c.w) * gt + Math.max(0, c.w - a.w) * 0.5 * (a.h + c.h) * gs + Math.max(0, a.yBot - c.yBot) * 0.5 * (a.w + c.w) * gb;
      // (a nose growing from its own point is not a step: the area met counts by how much body already stands ahead of it)
      stepA += d * Math.min(1, (a.A / Amax) / 0.5);
      if (xTrip == null && (gt > 0.15 || gs > 0.15 || gb > 0.15)) xTrip = a.x;     // the first step: where a laminar layer ends
    } else {
      const th = Math.atan2(r[i - 1] - r[i], dx);
      baseA += Math.max(0, a.A - c.A) * Math.max(0, (Math.sin(th) - s13) / (1 - s13));
    }
  }
  baseA += st[n - 1].A * (st[n - 1].A / Amax > 0.08 ? 1 : 0);                      // an end left open
  return { stepA, baseA, trip: (xTrip == null ? st[iMax].x : xTrip) / M.len, boxMax: Math.max(...st.map(q => q.w * q.h)),
           fineness: M.len / dEq, fullness: fw / wF, sharp: Math.min(1, fs / wS), screenDeg: scrA, screenH: scrH / hMax, closeDeg: close, upsweepDeg: up, kinkDeg: kink,
           noseA: st[0].A / Amax, tailA: st[n - 1].A / Amax, at: st[iMax].x / M.len, swet, Amax, dEq, len: M.len };
}
module.exports = { measure, sectionAt, shape };
if (require.main === module) {
  const RC = require(path.join(T, 'real_check.js')), key = process.argv[2];
  if (key === '--all') {
    const f = (x, n = 2) => (+x).toFixed(n);
    console.log('| plane | fineness | fullness | sharp corners | screen: steepest rise, height gained | closure | upsweep | largest kink | front area | tail area | largest section at |');
    console.log('|' + '---|'.repeat(11));
    for (const k of process.argv.slice(3)) { try { const h = shape(measure(RC.loadSpec(RC.PLANES[k]).spec.cage, 60));
      console.log('| ' + [k, f(h.fineness, 1), f(h.fullness), f(h.sharp), f(h.screenDeg, 0) + ' deg, ' + f(h.screenH), f(h.closeDeg, 0) + ' deg', f(h.upsweepDeg, 0) + ' deg', f(h.kinkDeg, 0) + ' deg', f(h.noseA), f(h.tailA), f(h.at)].join(' | ') + ' |');
    } catch (e) { console.log('| ' + k + ' | ' + String(e.message).slice(0, 80) + ' |'); } }
    process.exit(0);
  }
  const M = measure(RC.loadSpec(RC.PLANES[key]).spec.cage, 24);
  console.log(key + ': cage body ' + M.len.toFixed(2) + ' long (cage units)');
  for (const s of M.stations) console.log('  x ' + s.x.toFixed(2).padStart(5) + '  w ' + s.w.toFixed(2) + ' h ' + s.h.toFixed(2) + '  top ' + s.yTop.toFixed(2).padStart(5) + ' bot ' + s.yBot.toFixed(2).padStart(5) +
    '  A ' + s.A.toFixed(3) + '  fullness ' + (s.A / (s.w * s.h)).toFixed(2) + '  sharp ' + s.sharp.toFixed(2) + '  ' + '#'.repeat(Math.round(20 * Math.sqrt(s.A))));
}
