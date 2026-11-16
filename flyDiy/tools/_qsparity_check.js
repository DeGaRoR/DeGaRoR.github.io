#!/usr/bin/env node
// GATE QSPARITY - THE TABLE AND QUICKSHOT MEASURE ONE AEROPLANE (QUICKSHOT-ONE, 15 Nov 2026; A0: "the table's measured
// geometry matches what quickshot draws for the PC-6 reference ... within a tolerance").
//
//   node tools/_qsparity_check.js      -> "GATE QSPARITY: PASS|FAIL"   (~25 s, three quickshot children in parallel)
//
// The drafting table (tools/drafting/table.js: dt_node's context, dt_build, level 0) and quickshot.js (the headless
// garage context with the cabin and the livery, --measure: dt_build.collect on the scene it draws) build the PC-6
// candidate (builds/candidates/pc6_drafting_2026-11-11.json) against its reference (tools/drafting/refs/pc6.json, the
// same block the plane file carries). At the table's level:
//   frame     the spinner's tip and the thrust line agree to 1 mm
//   rows      every key measurement both read agrees to half its tolerance (3 mm at least); the three largest gaps
//             printed (15 Nov: strut.at 12 mm - the table's cut core and context (dt_manifest) against the garage's
//             whole one; the layers it leaves out (hinge, access, light) are not the cause, measured; every other row < 3 mm)
//   score     the same count inside tolerance
//   sheet     quickshot --sheet writes the stacked projection (dt_sheet.js: the one projector), on white paper
// WHERE THEY DIFFER, said and not failed: quickshot at the GARAGE's subdivision (level 2, what the player sees: the
// table fits the level-0 draft) and through the game's LOAD DOOR (the join's clamps, which the table never applies).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const T = __dirname, ROOT = path.resolve(T, '..');
const PLANE = path.join(ROOT, 'builds', 'candidates', 'pc6_drafting_2026-11-11.json');
const REF = path.join(T, 'drafting', 'refs', 'pc6.json');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
console.log('GATE QSPARITY - the drafting table and quickshot measure the same PC-6');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qsparity_'));
const run = (tag, extra) => new Promise(res => {
  const out = path.join(tmp, tag + '.json');
  const p = cp.spawn(process.execPath, [path.join(T, 'quickshot.js'), PLANE, path.join(tmp, tag), '--views', 'none', '--measure', out, '--ref', REF].concat(extra),
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; p.stdout.on('data', d => { log += d; }); p.stderr.on('data', d => { log += d; });
  p.on('close', code => { let j = null; try { j = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) {} res({ tag, code, j, log }); });
});
(async () => {
  const kids = Promise.all([run('l0', ['--level', '0', '--sheet']), run('l2', []), run('door', ['--level', '0', '--door', '--parts'])]);
  // the table, in this process (its own context)
  const DT = require(path.join(T, 'drafting', 'dt_node.js')), C = DT.CORE;
  const doc = JSON.parse(fs.readFileSync(PLANE, 'utf8')), ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
  const B = DT.build(doc.spec, null, { level: 0 });
  const TT = C.compare(ref, C.measure(B, { stations: C.stations(ref), probes: C.probes(ref) }), C.windows(B), B);
  const [L0, L2, DOOR] = await kids;
  for (const k of [L0, L2, DOOR]) if (!k.j) console.log('  (' + k.tag + ': exit ' + k.code + ' ' + k.log.split('\n').slice(-4).join(' | ') + ')');
  ok(!!L0.j, 'quickshot measured the PC-6 at the table\'s level (' + (L0.j ? L0.j.pass + ' / ' + L0.j.n : 'no record') + ')');
  if (L0.j) {
    const f = L0.j.frame;
    ok(Math.abs(f.tipZ - B.frame.tipZ) < 1e-3 && Math.abs(f.hubY - B.frame.hubY) < 1e-3,
      'the same frame: spinner tip z ' + f.tipZ.toFixed(4) + ' / ' + B.frame.tipZ.toFixed(4) + ', thrust line y ' + f.hubY.toFixed(4) + ' / ' + B.frame.hubY.toFixed(4));
    const byId = {}; for (const r of L0.j.rows) byId[r.id] = r;
    let n = 0; const bad = [], gaps = [];
    for (const r of TT.rows) {
      const q = byId[r.id]; if (!q || r.ours == null || q.ours == null) continue;
      n++; const d = Math.abs(q.ours - r.ours), lim = Math.max(0.003, 0.5 * (r.tol || 0));
      gaps.push([r.id, d]);
      if (d > lim) bad.push(r.id + ' ' + r.ours.toFixed(3) + ' / ' + q.ours.toFixed(3));
    }
    ok(n > 100 && !bad.length, n + ' key measurements read by both agree to half their tolerance (largest: ' + gaps.sort((a, b) => b[1] - a[1]).slice(0, 3).map(g => g[0] + ' ' + g[1].toFixed(4)).join(', ') + ')' + (bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''));
    ok(Math.abs(L0.j.pass - TT.pass) <= 0, 'the same score: quickshot ' + L0.j.pass + ' / ' + L0.j.n + ', the table ' + TT.pass + ' / ' + TT.n);
    const sp = path.join(tmp, 'l0_sheet.png');
    ok(fs.existsSync(sp) && fs.statSync(sp).size > 10000, 'quickshot --sheet wrote the stacked projection (' + (fs.existsSync(sp) ? (fs.statSync(sp).size / 1024).toFixed(0) + ' KB' : 'missing') + ')');
  }
  // where they differ (said, not failed)
  const moved = (J, what) => {
    if (!J) return;
    const byId = {}; for (const r of J.rows) byId[r.id] = r;
    const mv = TT.rows.filter(r => byId[r.id] && r.ours != null && byId[r.id].ours != null && Math.abs(byId[r.id].ours - r.ours) > 0.5 * (r.tol || 0.01))
      .map(r => r.id + ' ' + (byId[r.id].ours - r.ours >= 0 ? '+' : '') + (byId[r.id].ours - r.ours).toFixed(3));
    console.log('  info ' + what + ': ' + J.pass + ' / ' + J.n + ' (table ' + TT.pass + '); ' + mv.length + ' row(s) move by more than half their tolerance' + (mv.length ? ': ' + mv.slice(0, 8).join(', ') + (mv.length > 8 ? ' ...' : '') : ''));
  };
  moved(L2.j, 'quickshot at the garage\'s subdivision (level 2, what the player sees)');
  moved(DOOR.j, 'quickshot through the load door (the join\'s clamps, level 0)');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  console.log('GATE QSPARITY: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
