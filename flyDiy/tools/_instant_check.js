#!/usr/bin/env node
// _instant_check.js - GATE INSTANT (G1445, GARAGE-INSTANT 2026-10-04): THE DRAG'S PREVIEWS END ON THE PLAIN BUILD'S
// AEROPLANE. In the page in node (tools/_page_node.js), on each validated build, each row of a fixed list is dragged the
// player's way - pointerdown, four input ticks at four values, the slider's change, the pointer up, the page's timers
// (the settle build) - and the editor's whole scene is fingerprinted (garage_lag_same.js's fingerprint: every object
// in order, its type / name / visibility / matrix, a mesh's geometry counts and position / index sums, every material
// slot's look and uniforms); then the SAME parameters are built the long way (CAGE_UI.sheetKeep = false, build())
// twice. Any object the short way leaves different from the long way is a FAIL (an object the long way itself does
// not repeat is noise - the crew's idle pose - and is counted apart). The resolved spec (the join's export) is
// compared too, and each row's ticks must have been PREVIEWS (G1442 kept sheet / G1443 deformed stand / G1444 detail
// row) - a row that silently fell back to whole builds is reported. Also the build's resolved-spec hash at boot.
// Usage: node --max-old-space-size=4096 tools/_instant_check.js [--builds cub,metal,jodel,cessna,floats] [--only k1,k2]
// Exit 1 on any difference. No --help.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json' };
const WANT = opt('builds', 'cub,metal').split(',');
// the rows: one or more of each preview kind (a kept sheet's layer rows, the cage's rows, the sheet's detail rows)
const ROWS = (opt('only', null) ? opt('only').split(',') : ['wgSpan', 'wgChord', 'stSpan', 's1X', 'seatH', 'paxLen', 'halfW', 'roofY', 'noseDroop', 'rimW', 'dashDepth', 'frCabTopW']);
const log = s => console.log('  ' + s);
// --settle: the page's ms after the release (the floats' CG handshake - the balance's answer, a rebuild when the CG
// moved 2 cm - closes over a few seconds of the page's clock; a drag compared before it closes compares two moments)
const SETTLE = +opt('settle', 1500);

const FP = fs.readFileSync(path.join(__dirname, 'perf', 'garage_lag_same.js'), 'utf8').match(/const FP = `([\s\S]*?)`;\n/)[1];

(async () => {
  const { openPage } = require('./_page_node.js');
  let bad = 0;
  for (const bk of WANT) {
    const P = await openPage({ quiet: true, storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[bk] || bk), 'utf8') } });
    const W = P.win, D = W.document, run = c => vm.runInContext(c, P.ctx);
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
    await P.until(() => !!W.CAGE_UI, 60000);
    await P.until(() => false, 6000);
    W.requestAnimationFrame = () => 0;
    const hash = () => { try { return crypto.createHash('sha1').update(JSON.stringify(W.CAGE_JOIN.export())).digest('hex').slice(0, 16); } catch (e) { return 'ERR ' + e.message; } };
    log('== ' + bk + '  boot spec ' + hash() + '  chain ' + (W.CAGE_CHAIN ? (W.CAGE_CHAIN.ok ? 'ok' : 'NOT OK: ' + W.CAGE_CHAIN.why) + ', ' + W.CAGE_CHAIN.layers.length + ' layers' : 'absent'));
    const U = W.CAGE_UI, Ev = W.Event, PE = W.PointerEvent || W.Event;
    for (const k of ROWS) {
      const el = D.getElementById('p_' + k);
      if (!el || el.type !== 'range' || el.offsetParent === null || el.disabled) { log(k.padEnd(12) + ' (no visible slider)'); continue; }
      const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001, dir = (hi - x0) > (x0 - lo) ? 1 : -1;
      const d = Math.max(st, (hi - lo) * 0.012);
      const pv0 = U.preview ? U.preview.n : 0, df0 = U.preview ? U.preview.deform : 0;
      el.dispatchEvent(new PE('pointerdown'));
      for (let i = 1; i <= 4; i++) { el.value = String(Math.min(hi, Math.max(lo, x0 + dir * d * i))); el.dispatchEvent(new Ev('input')); await P.until(() => false, 30); }
      el.dispatchEvent(new Ev('change')); W.dispatchEvent(new PE('pointerup'));
      await P.until(() => false, SETTLE);
      const previews = U.preview ? U.preview.n - pv0 : 0, deforms = U.preview ? U.preview.deform - df0 : 0;
      const hA = hash(), A = JSON.parse(run(FP));
      U.sheetKeep = false; U.build(); U.sheetKeep = true;
      if (SETTLE > 1500) await P.until(() => false, SETTLE);
      const hB = hash(), B = JSON.parse(run(FP));
      U.sheetKeep = false; U.build(); U.sheetKeep = true;
      if (SETTLE > 1500) await P.until(() => false, SETTLE);
      const C = JSON.parse(run(FP));
      const diffs = []; let noise = 0;
      for (let i = 0; i < Math.max(A.out.length, B.out.length); i++) {
        if (A.out[i] === B.out[i]) continue;
        if (A.out.length === B.out.length && B.out.length === C.out.length && (B.out[i] !== C.out[i] || A.out[i] === C.out[i])) { noise++; continue; }
        diffs.push(i);
      }
      const same = !diffs.length && hA === hB;
      if (!same) bad++;
      log(k.padEnd(12) + ' previews ' + previews + '/4 (deformed ' + deforms + ')  objects ' + A.out.length + '/' + B.out.length + '  ' + (same ? 'same' : 'DIFFER ' + diffs.length + (hA !== hB ? ' + spec ' + hA + ' vs ' + hB : '')) + (noise ? '  (noise ' + noise + ')' : '') + (previews < 4 ? '  [' + (U.preview && U.preview.deformWhy) + ']' : ''));
      for (const i of diffs.slice(0, 3)) { const a = A.out[i] || '(none)', b = B.out[i] || '(none)'; let c = 0; while (c < a.length && a[c] === b[c]) c++;
        log('   @' + i + ' short: ' + a.slice(0, 50) + ' ..@' + c + ': ' + a.slice(Math.max(0, c - 60), c + 120) + '\n     long:  ' + b.slice(0, 50) + ' ..@' + c + ': ' + b.slice(Math.max(0, c - 60), c + 120)); }
      // back to the build's value (a whole build)
      el.value = String(x0); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change'));
      await P.until(() => false, 1500);
    }
    P.close();
  }
  console.log(bad ? '  ' + bad + ' row(s) differ' : '  every drag ended on the plain build\'s aeroplane');
  console.log(bad ? 'GATE INSTANT: FAIL (' + bad + ' row(s) differ)' : 'GATE INSTANT: PASS');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('_instant_check: ' + (e && e.stack || e)); console.log('GATE INSTANT: FAIL (threw)'); process.exit(1); });
