#!/usr/bin/env node
// GATE DRAFTING - the drafting table stays the garage's (tools/DRAFTING_TABLE.md).
//   node tools/drafting/dt_check.js        -> "GATE DRAFTING: PASS|FAIL"
// 1 MANIFEST   every editor file build.js MANIFEST.editor lists is in dt_manifest.js's EDITOR or its LEFT_OUT, in the
//              same order; every core file it loads is in MANIFEST.core, in order (a layer added to the game is noticed)
// 2 BUILDS     the PC-6 plane file builds through the garage's generator with no layer error, every part drawn
// 3 THE PC-6   its key measurements and line checks hold the floor this session reached (122 of 175, floor 120: rounds 5-6 left the drawing where the user chose the look - the windscreen line, the wing top, the user's pillar lines and the straight boom), its skin has no
//              fold, no inside face shows through a gap (the open ring at the firewall, 11 Nov), and the trends the user named hold (the cowl's slope, the 45 deg A-pillar, the straight fin and dorsal): a change that loses a match is
//              seen; a better fit raises the floor
// 4 PURE       dt_core's view mapping round-trips (toPx / fromPx) for every turn and mirror, two sheet scales (ky) and a
//              free tilt (rot in degrees about the origin, a pixel or a mark); the PC-6 sheet turned 4.8 deg scores as level
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
console.log('GATE DRAFTING');
const { MANIFEST } = require(path.join(ROOT, 'tools', 'build.js'));
const MAN = require('./dt_manifest.js');
{
  const ed = MAN.EDITOR.map(f => path.basename(f)), out = new Set(MAN.LEFT_OUT);
  const missing = MANIFEST.editor.filter(f => !ed.includes(f) && !out.has(f));
  ok(!missing.length, 'every editor file is loaded or left out on purpose' + (missing.length ? ': new ' + missing.join(' ') : ''));
  const order = MANIFEST.editor.filter(f => ed.includes(f));
  ok(order.join() === ed.join(), 'the editor files load in build.js order');
  const core = MAN.CORE.map(f => path.basename(f)), corder = MANIFEST.core.filter(f => core.includes(f));
  ok(corder.join() === core.join() && core.every(f => MANIFEST.core.includes(f)), 'the core files exist and load in build.js order');
}
const DT = require('./dt_node.js'), C = DT.CORE;
{
  const L = DT.load();
  ok(!L.errors.length, 'the table\'s files load (' + L.ms + ' ms)' + (L.errors.length ? ': ' + L.errors[0] : ''));
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'candidates', 'pc6_drafting_2026-11-11.json'), 'utf8'));
  const B = DT.build(doc.spec, null, { level: 0 });
  ok(!B.errors.length, 'the PC-6 builds with no layer error (' + B.ms + ' ms)');
  const have = new Set(Array.from(B.parts).map(p => C.PARTS[p]));
  const want = ['body', 'glass', 'screen', 'pillar', 'wing', 'strut', 'fin', 'stab', 'cowl', 'engine', 'gear'];
  ok(want.every(p => have.has(p)), 'every part is drawn' + (want.some(p => !have.has(p)) ? ': missing ' + want.filter(p => !have.has(p)).join(' ') : ''));
  // A FLOAT CARD DRAWS ITS FLOATS (13 Nov: the table loaded no hydro core - the float layer saw no Wipline catalogue and
  // drew nothing, silently; dt_manifest now loads src/core/32_hydro.js)
  const fdoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'candidates', 'pc6_floats_2026-11-13.json'), 'utf8'));
  const FB = DT.build(fdoc.spec, null, { level: 0 });
  const fparts = Array.from(FB.parts).filter(p => C.PARTS[p] === 'float').length;
  ok(!FB.errors.length && fparts > 1000, 'the PC-6 on Wiplines draws its floats (' + fparts + ' triangles)');
  const T = C.compare(doc.ref, C.measure(B, { stations: C.stations(doc.ref), probes: C.probes(doc.ref) }), C.windows(B), B);
  ok(T.pass >= 120, 'the PC-6: ' + T.pass + ' / ' + T.n + ' key measurements and line checks inside tolerance (floor 120)');
  const FO = C.folds(B);
  ok(FO.len <= 0.04, 'the PC-6\'s skin has no fold (' + FO.len + ' m)');
  const IN = C.insideShows(B), shows = Object.keys(IN).filter(v => IN[v].m2 > 0.01);
  ok(!shows.length, 'the PC-6\'s inside never shows' + (shows.length ? ': ' + shows.map(v => v + ' ' + IN[v].m2 + ' m2').join(', ') : ''));
  const row = id => T.rows.find(r => r.id === id);
  for (const id of ['span', 'wing.le', 'tailpost', 'cowl.back', 'body.front', 'wheel.a', 'track', 'stab.span', 'prop.dia',
                    'fin.top', 'stab.top', 'line.fin.le.fin LE.slope', 'line.dorsal.dorsal.slope'])
    
    ok(row(id) && row(id).ok, 'the PC-6 ' + id + ': ' + (row(id) && row(id).diff != null ? (row(id).diff >= 0 ? '+' : '') + row(id).diff.toFixed(3) : '-'));
  // THE A-PILLAR AT 45 DEG (the user, round 5: "the run of the windshield is longer, so the A pillar is about 45 degrees
  // in side view" - over the drawing's 37 deg windscreen line): the windscreen's lowest point to its highest, side view
  {
    let lo = null, hi = null;
    for (let t = 0; t < B.parts.length; t++) if (C.PARTS[B.parts[t]] === 'screen') for (let e = 0; e < 3; e++) {
      const a = B.tris[t * 9 + e * 3], h = B.tris[t * 9 + e * 3 + 1];
      if (!lo || h < lo[1]) lo = [a, h];
      if (!hi || h > hi[1] + 0.005 || (h > hi[1] - 0.005 && a > hi[0])) hi = [a, h];
    }
    const ang = lo && hi ? Math.atan2(hi[1] - lo[1], hi[0] - lo[0]) * 180 / Math.PI : NaN;
    ok(Math.abs(ang - 45) <= 3, 'the PC-6\'s A-pillar stands at 45 deg in side view (' + ang.toFixed(1) + ')');
  }
  const cs = row('line.side.top.nose.cowl aft.slope');
  ok(cs && Math.abs(cs.diff) <= 2, 'the PC-6 cowl\'s top falls to the nose as drawn (slope within 2 deg: ' + (cs ? cs.diff.toFixed(2) : '-') + ')');
}
{
  let worst = 0;
  for (const rot of [0, 90, 180, 270]) for (const flip of [false, true]) {
    const V = { ox: 120, oy: 340, k: 80, rot, flip };
    for (const [x, y] of [[0, 0], [3.2, 1.1], [-2, 0.4], [7, -1.5]]) {
      const p = C.toPx(V, x, y), q = C.fromPx(V, p[0], p[1]);
      worst = Math.max(worst, Math.abs(q[0] - x), Math.abs(q[1] - y));
    }
  }
  ok(worst < 1e-9, 'the view mapping round-trips every turn and mirror (worst ' + worst.toExponential(1) + ')');
  // TWO SCALES (13 Nov, the Skymaster's stretched scan): ky != k round-trips every turn, and a turned view's metres
  // along the sheet's vertical take ky (the top view at rot 270: a station 1 m aft is ky pixels up the page)
  let worstK = 0;
  for (const rot of [0, 90, 180, 270]) for (const flip of [false, true]) {
    const V = { ox: 120, oy: 340, k: 100, ky: 97, rot, flip };
    for (const [x, y] of [[0, 0], [3.2, 1.1], [-2, 0.4], [7, -1.5]]) {
      const p = C.toPx(V, x, y), q = C.fromPx(V, p[0], p[1]);
      worstK = Math.max(worstK, Math.abs(q[0] - x), Math.abs(q[1] - y));
    }
  }
  const up = C.toPx({ ox: 0, oy: 0, k: 100, ky: 97, rot: 270 }, 1, 0)[1];
  ok(worstK < 1e-9 && Math.abs(up + 97) < 1e-9, 'two sheet scales round-trip every turn, the vertical one along the page (' + up.toFixed(1) + ' px)');
  // THE FREE TILT (15 Nov, FLAGSHIP's Cessna: the brochure's side view is drawn 4.8 deg off): any rot round-trips with
  // a mirror, two scales and each pivot form; X along the view runs at the angle on the sheet; setTilt about a mark
  // keeps that mark on its metres
  let worstT = 0;
  for (const rot of [4.8, -3, 94.8, 183, 271.5]) for (const flip of [false, true])
    for (const rotAt of [undefined, [400, 120], { mark: 'm', at: [-50, 610] }]) {
      const V = { ox: 120, oy: 340, k: 100, ky: 97, rot, flip, rotAt };
      for (const [x, y] of [[0, 0], [3.2, 1.1], [-2, 0.4], [7, -1.5]]) {
        const p = C.toPx(V, x, y), q = C.fromPx(V, p[0], p[1]);
        worstT = Math.max(worstT, Math.abs(q[0] - x), Math.abs(q[1] - y));
      }
    }
  const Vt = { ox: 0, oy: 0, k: 100, rot: 4.8 }, pa = C.toPx(Vt, 0, 0), pb = C.toPx(Vt, 8.2, 0);
  const angT = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180 / Math.PI;
  const rT = { views: { side: { ox: 26, oy: 238.5, k: 80.55, rot: 0 } }, marks: { wheel: { view: 'side', pts: [[300, 330]] } } };
  const mT = C.fromPx(rT.views.side, 300, 330); C.setTilt(rT, 'side', 4.8, 'wheel');
  const mT2 = C.fromPx(rT.views.side, 300, 330);
  ok(worstT < 1e-9 && Math.abs(angT - 4.8) < 1e-9 && Math.hypot(mT2[0] - mT[0], mT2[1] - mT[1]) < 1e-9,
    'a free tilt round-trips (every pivot, mirror, two scales; worst ' + worstT.toExponential(1) + '), runs at ' + angT.toFixed(2) + ' deg, and keeps its mark');
  // ...and THE PC-6 SHEET TURNED 4.8 deg about the side view's origin, every side mark and line turned with it, scores
  // what the level sheet scores (the measured geometry does not know the drawing was tilted)
  {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'candidates', 'pc6_drafting_2026-11-11.json'), 'utf8'));
    const B = DT.build(doc.spec, null, { level: 0 });
    const score = ref => C.compare(ref, C.measure(B, { stations: C.stations(ref), probes: C.probes(ref) }), C.windows(B), B);
    const T0 = score(doc.ref), r2 = JSON.parse(JSON.stringify(doc.ref)), Vs = r2.views.side, a = 4.8 * Math.PI / 180;
    const turn = p => { const dx = p[0] - Vs.ox, dy = p[1] - Vs.oy; return [Vs.ox + Math.cos(a) * dx - Math.sin(a) * dy, Vs.oy + Math.sin(a) * dx + Math.cos(a) * dy]; };
    for (const k of Object.keys(r2.marks || {})) if (r2.marks[k].view === 'side') r2.marks[k].pts = r2.marks[k].pts.map(turn);
    for (const L of r2.lines || []) if (L.view === 'side') L.pts = L.pts.map(turn);
    Vs.rot = 4.8;
    const T1 = score(r2), moved = T0.rows.filter((r, i) => r.diff != null && T1.rows[i] && Math.abs((T1.rows[i].diff || 0) - r.diff) > 0.01 * (r.tol || 1));
    ok(Math.abs(T1.pass - T0.pass) <= 1, 'the PC-6 on a sheet turned 4.8 deg: ' + T1.pass + ' / ' + T1.n + ' (level ' + T0.pass + ')' + (moved.length ? ', moved: ' + moved.slice(0, 6).map(r => r.id).join(' ') : ''));
  }
  // THE TRICYCLE READER (13 Nov): the mains are the gear off the centreline, the third wheel a nose or a tail wheel
  // by its station - the KM table carries both rows
  ok(['nosewheel.a', 'nosewheel.bottom', 'tailwheel.a', 'tailwheel.bottom'].every(id => C.KM.some(r => r[0] === id)), 'the key measurements carry the nose wheel and the tail wheel rows');
  // ANY ANGLE (13 Nov, the PC-6 floats: a sheet drawn 3 deg nose-up on its floats): a fractional turn round-trips, and it
  // TURNS (the old rounding snapped 3 deg back to 0 - a tilted sheet could not be registered)
  let worstF = 0;
  const V3 = { ox: 120, oy: 340, k: 80, rot: 3, flip: false };
  for (const [x, y] of [[0, 0], [3.2, 1.1], [-2, 0.4], [7, -1.5]]) {
    const p = C.toPx(V3, x, y), q = C.fromPx(V3, p[0], p[1]);
    worstF = Math.max(worstF, Math.abs(q[0] - x), Math.abs(q[1] - y));
  }
  const tilt = C.toPx(V3, 10, 0)[1] - V3.oy;          // 10 m aft at 3 deg clockwise: 10 * 80 * sin 3 deg = 41.9 px lower
  ok(worstF < 1e-9 && Math.abs(tilt - 800 * Math.sin(3 * Math.PI / 180)) < 0.01, 'a sheet turns by a fractional angle (3 deg: ' + tilt.toFixed(1) + ' px at 10 m, round trip ' + worstF.toExponential(1) + ')');
}
console.log('GATE DRAFTING: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
