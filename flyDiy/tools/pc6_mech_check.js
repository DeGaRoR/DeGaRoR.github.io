#!/usr/bin/env node
// PC6-OLEO MECHANISM CHECK (15 Nov, the user: "make sure that this whole mechanism works as expected, you know, that
// all the links do actually link like they should and move like they should").
//   node tools/pc6_mech_check.js [card.json]      -> "PC6 MECHANISM: PASS|FAIL" and a table over the stroke
// The PC-6 tailwheel (twStyle 1) drawn headless at every compression from the RELAXED pose (the drawing, the flight)
// to the stroke's end (pc6CompMax: the crosshead at the collar's wiper), and at the steering's ends. At each pose:
//   1 THE SCISSOR REACHES   the V's upper arm (the collar's pin to the hinge) and its lower (the hinge to the axle)
//                           keep their lengths, to a micron, and the two circles still cross (no lock-out, no flip)
//   2 THE PISTON STAYS IN   the axle rides the strut's own axis; the crosshead never climbs into the collar's wiper
//   3 THE V STAYS A V       its angle between 15 and 170 deg, its hinge ahead of the strut and under the keel
//   4 THE BANDS CLEAR       the lower arms ride outside the tyre, inside the fork's legs
//   5 THE STEERING TURNS IT ALL   at +-30 deg the arms keep their lengths (they turn with the collar)
// A card: its station-2 rows (s2_*) over the gear page's defaults; none: the PC-6 test values.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const TOOLS = __dirname;
function makeTHREE() {
  function Mat(o) { Object.assign(this, { isMat: 1 }, o || {}); }
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = i; } computeVertexNormals() {} }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class LineSegments { constructor(g, m) { this.geometry = g; this.material = m; } }
  return { BufferAttribute, BufferGeometry, Mesh, LineSegments, LineBasicMaterial: Mat, MeshLambertMaterial: Mat, MeshBasicMaterial: Mat, DoubleSide: 2, FrontSide: 0 };
}
const win = {};
{
  const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_rod_fit.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
}
const GG = win.GEAR_GEN, GP = win.GEAR_PAGE, K = win.GEAR_KIT;
const P = Object.assign({}, (GP && GP.DEF) || {}, { twStyle: 1, twPostD: 0.085, twPostLen: 0.9, twLegDrop: 0.58, twTrail: 0.048, twRake: 0, twSteerVis: 1, twGuard: 1, whProfile: 0 });
let R = 0.17;
if (process.argv[2]) {
  const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), c = (doc.spec && doc.spec.cage) || doc.cage || doc.spec || doc;
  for (const k of Object.keys(c)) if (k.startsWith('s2_')) P[k.slice(3)] = c[k];
  if (c.s2R) R = c.s2R;
  if (c.whProfile != null) P.whProfile = c.whProfile;
}
const bagSet = () => new Proxy({}, { get: (o, k) => (o[k] = o[k] || (K.Bag ? new K.Bag() : GG.Bag ? new GG.Bag() : null)) });
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const D2 = 180 / Math.PI;
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); return c; };
const top = [0, -0.32, -4.6];
const Dp = Math.max(0.03, +P.twPostD || 0.07), cMax = GG.pc6CompMax(P, R);
const TY = GG.TYRE[Math.round(P.whProfile || 0)] || GG.TYRE[0];
let a0 = null, b0 = null, rows = [];
for (const yaw of [0, -30, 30]) {
  for (let i = 0; i <= 12; i++) {
    const comp = cMax * i / 12, Q = Object.assign({}, P, { _twComp: comp });
    const u = GG.castorUnit({ steel: bagSet().x, alloy: bagSet().x, bronze: bagSet().x, tyre: bagSet().x, hub: bagSet().x, fair: bagSet().x }, Q, top, 1, R, yaw, true, null);
    const m = u.pc6, tag = 'yaw ' + yaw + ' comp ' + comp.toFixed(3);
    if (!ok(!!m, tag + ': no mechanism returned')) break;
    const a = len(m.pin, m.apex), b = len(m.apex, m.hub);
    if (a0 == null) { a0 = a; b0 = b; }
    ok(m.ok, tag + ': the scissor cannot reach (lock-out)');
    ok(Math.abs(a - a0) < 1e-6 && Math.abs(b - b0) < 1e-6, tag + ': an arm changed length (' + (a - a0).toExponential(1) + ', ' + (b - b0).toExponential(1) + ')');
    // 2 the axle on the axis, the crosshead under the wiper
    const onAx = sub(sub(m.hub, top), m.ax.map(v => v * (P.twLegDrop - comp)));
    ok(Math.abs(Math.hypot(...onAx) - P.twTrail) < 1e-6, tag + ': the axle left the strut\'s axis');
    const show = dot(sub(m.pB, top), m.ax);
    ok(show >= Dp * 1.0 - 1e-9, tag + ': the crosshead climbs into the wiper (' + show.toFixed(3) + ' m of piston)');
    // 3 the V's angle, the hinge ahead and under the keel
    const e1 = sub(m.pin, m.apex), e2 = sub(m.hub, m.apex);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(e1, e2) / (Math.hypot(...e1) * Math.hypot(...e2))))) * D2;
    ok(ang > 15 && ang < 170, tag + ': the V opens to ' + ang.toFixed(1) + ' deg');
    ok(dot(sub(m.apex, top), m.W) > Dp, tag + ': the hinge is not ahead of the strut');
    ok(m.apex[1] < top[1] - 0.01, tag + ': the hinge rises to the keel');
    // 4 the bands between the tyre and the fork
    ok(m.bx - Dp * 0.08 > R * TY.hw * (TY.bulge || 1), tag + ': the bands rub the tyre');
    ok(m.xH - 0.004 > m.bx + Dp * 0.08, tag + ': the bands foul the fork\'s legs');
    if (yaw === 0) rows.push([comp, show, ang, m.apex]);
  }
}
// 6 THE GAME'S POSE (app.js pc6Rigs): the relaxed parts carried by the flight's own transforms - the slider by the
//   travel d up the axis and the yaw; the upper arm about the collar's pin by the table's phi; the bands about the
//   relaxed axle by psi, carried by d - land every joint where the drawing solved at that stroke and steering has it:
//   the arm's hinge on the bands' hinge, the bands' axle on the slider's axle, both on the drawn ones (0.1 mm)
{
  const rodr = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), d = dot(k, v), x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)]; };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const bagsN = () => ({ steel: bagSet().x, alloy: bagSet().x, bronze: bagSet().x, tyre: bagSet().x, hub: bagSet().x, fair: bagSet().x });
  const m0 = GG.castorUnit(bagsN(), Object.assign({}, P, { _twComp: 0 }), top, 1, R, 0, true, null).pc6, tb = m0.tab;
  let worst = 0;
  for (const yaw of [0, 25, -25]) for (let i = 0; i <= 8; i++) {
    const c = m0.compMax * i / 8, n = tb.comp.length - 1, f = Math.min(n, c / m0.compMax * n), i0 = Math.min(n - 1, Math.floor(f)), w = f - i0;
    const phi = tb.phi[i0] + (tb.phi[i0 + 1] - tb.phi[i0]) * w, psi = tb.psi[i0] + (tb.psi[i0 + 1] - tb.psi[i0]) * w;
    const d = m0.ax.map(v => -v * c), Y = v => rodr(v, m0.ax, yaw * Math.PI / 180);
    const upper = x => add(add(m0.top, Y(sub(m0.pin, m0.top))), Y(rodr(sub(x, m0.pin), m0.S, phi)));
    const lower = x => add(add(add(m0.top, d), Y(sub(m0.hub0, m0.top))), Y(rodr(sub(x, m0.hub0), m0.S, psi)));
    const slider = x => add(add(m0.top, d), Y(sub(x, m0.top)));
    const mk = GG.castorUnit(bagsN(), Object.assign({}, P, { _twComp: c }), top, 1, R, yaw, true, null).pc6;
    const e = [len(upper(m0.apex), lower(m0.apex)), len(lower(m0.hub0), slider(m0.hub0)), len(upper(m0.apex), mk.apex), len(slider(m0.hub0), mk.hub)];
    worst = Math.max(worst, ...e);
    ok(Math.max(...e) < 1e-4, 'the game\'s pose at yaw ' + yaw + ' comp ' + c.toFixed(3) + ' parts a joint by ' + (Math.max(...e) * 1000).toFixed(2) + ' mm');
  }
  console.log('  the game\'s pose: every joint within ' + (worst * 1000).toFixed(4) + ' mm at every stroke and steering angle');
}
console.log('PC6 MECHANISM (twLegDrop ' + P.twLegDrop + ', R ' + R + ', stroke ' + cMax.toFixed(3) + ' m; arms ' + (a0 || 0).toFixed(3) + ' / ' + (b0 || 0).toFixed(3) + ' m)');
console.log('  comp m   piston m   V deg   hinge (y, z) m');
for (const [c, s, g, ap] of rows.filter((r, i) => i % 3 === 0 || i === rows.length - 1))
  console.log('  ' + c.toFixed(3).padStart(6) + '   ' + s.toFixed(3).padStart(7) + '   ' + g.toFixed(1).padStart(5) + '   ' + ap[1].toFixed(3) + ', ' + ap[2].toFixed(3));
for (const f of fails.slice(0, 8)) console.log('  FAIL ' + f);
console.log('PC6 MECHANISM: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
process.exit(fails.length ? 1 : 0);
