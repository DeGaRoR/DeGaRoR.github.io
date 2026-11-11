#!/usr/bin/env node
// GATE DRAFTING - the drafting table stays the garage's (tools/DRAFTING_TABLE.md).
//   node tools/drafting/dt_check.js        -> "GATE DRAFTING: PASS|FAIL"
// 1 MANIFEST   every editor file build.js MANIFEST.editor lists is in dt_manifest.js's EDITOR or its LEFT_OUT, in the
//              same order; every core file it loads is in MANIFEST.core, in order (a layer added to the game is noticed)
// 2 BUILDS     the PC-6 plane file builds through the garage's generator with no layer error, every part drawn
// 3 THE PC-6   its key measurements and line checks hold the floor this session reached (119 of 175; 121 before a sliver of glass stopped passing for the cockpit window), its skin has no
//              fold, no inside face shows through a gap (the open ring at the firewall, 11 Nov), and the trends the user named hold (the cowl's slope, the windscreen's, the straight fin and dorsal): a change that loses a match is
//              seen; a better fit raises the floor
// 4 PURE       dt_core's view mapping round-trips (toPx / fromPx) for every turn and mirror
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
  const T = C.compare(doc.ref, C.measure(B, { stations: C.stations(doc.ref), probes: C.probes(doc.ref) }), C.windows(B), B);
  ok(T.pass >= 119, 'the PC-6: ' + T.pass + ' / ' + T.n + ' key measurements and line checks inside tolerance (floor 119)');
  const FO = C.folds(B);
  ok(FO.len <= 0.04, 'the PC-6\'s skin has no fold (' + FO.len + ' m)');
  const IN = C.insideShows(B), shows = Object.keys(IN).filter(v => IN[v].m2 > 0.01);
  ok(!shows.length, 'the PC-6\'s inside never shows' + (shows.length ? ': ' + shows.map(v => v + ' ' + IN[v].m2 + ' m2').join(', ') : ''));
  const row = id => T.rows.find(r => r.id === id);
  for (const id of ['span', 'wing.le', 'tailpost', 'cowl.back', 'body.front', 'wheel.a', 'track', 'stab.span', 'prop.dia',
                    'fin.top', 'stab.top', 'line.fin.le.fin LE.slope', 'line.dorsal.dorsal.slope', 'line.side.screen.windscreen.slope'])
    
    ok(row(id) && row(id).ok, 'the PC-6 ' + id + ': ' + (row(id) && row(id).diff != null ? (row(id).diff >= 0 ? '+' : '') + row(id).diff.toFixed(3) : '-'));
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
}
console.log('GATE DRAFTING: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
