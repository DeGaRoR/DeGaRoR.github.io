#!/usr/bin/env node
// _derived_check.js - GATE DERIVED (PERF-SLIDERS, 23 Nov 2026): A DERIVED READ BUILDS THE SAME AEROPLANE.
// CAGE_CHAIN.derived (tools/_cage_chain.js) lets a layer record the VALUE of a function of P instead of the rows the
// function read - the dash's gear selector asks only whether the mains stand off the centreline (s1X > 0.01), and with
// the raw read every tick of the main gear's station re-ran the whole crew layer (the DC-3: 1.4 of a 2.0 s tick). The
// claim is exactness: nothing built differs. PERF-LEAD's condition for it going ON by default: for every aeroplane of
// the player's list, the same slider walk builds the SAME aeroplane with derived on and with it off - the scene's
// fingerprint and the resolved spec equal, not "looks the same".
// In the page in node (tools/_page_node.js), per aeroplane (the plane list's player classes; put on the stand through
// the garage's own door), per row - every row a derived read stands on (CAGE_CHAIN.derivedKeys(): the rows the functions
// read on this aeroplane) and the fixed rows (--rows: a wing dimension, a fuselage dimension, a position) - and per value
// (the row's low end, its middle, its high end: the low end of the gear's station crosses the selector's threshold):
//   the row dragged there as the editor hears it (pointerdown, four ticks, the slider's change, the pointer up, the
//   release's build), the whole scene fingerprinted (garage_lag_same.js's fingerprint: every object in order, its
//   type / name / visibility / matrix, a mesh's geometry counts and position / index sums, every material slot's look
//   and uniforms) and the join's export hashed; then back by a plain whole build.
// Three walks of each: derived ON, derived OFF (CAGE_CHAIN.derivedOff: the raw reads, as before the change), OFF again.
// An object that differs between ON and OFF is a FAIL - unless the two OFF walks differ there too (noise: the crew's
// idle pose), counted apart. A differing spec hash is a FAIL. Also printed: the ticks' layers on each side (the crew
// layer's runs saved), so a derived read that no longer saves anything shows.
// Usage: node --max-old-space-size=6144 tools/_derived_check.js [--planes list:12,list:8 | --all] [--rows wgSpan,paxLen,s1X]
// GATES_CORE=1 (the runner's core tier): four aeroplanes (a retractable twin, a hull amphibian, a floatplane, the Cub).
// Exit 1 on any difference. Ends with one line: GATE DERIVED: PASS|FAIL. No --help.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PLAYER = ['reproduction', 'story', 'original', 'wip'], CORE = [12, 41, 6, 1];
const LISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/lists/plane_lists.json'), 'utf8')).planes;
const has = p => p && p.file && fs.existsSync(path.join(ROOT, p.file));
const num = s => +String(s).replace(/^list:/, '');
const want = opt('planes', null) ? opt('planes').split(',').map(num) : (process.env.GATES_CORE === '1' && !argv.includes('--all') ? CORE : null);
const PLANES = want ? want.map(n => LISTS.find(p => p.n === n)).filter(has) : LISTS.filter(p => has(p) && !p.rides && (argv.includes('--all') || PLAYER.includes(p.list)));
const ROWS = (opt('rows', 'wgSpan,paxLen,s1X')).split(',');
const SETTLE = +opt('settle', 1500);
const log = s => console.log('  ' + s);
const FP = fs.readFileSync(path.join(__dirname, 'perf', 'garage_lag_same.js'), 'utf8').match(/const FP = `([\s\S]*?)`;\n/)[1];

(async () => {
  const { openPage } = require('./_page_node.js');
  let bad = 0, rowsDone = 0, saved = 0, P = null, W = null, D = null, U = null, CH = null, run = null;
  const boot = async file => {
    if (P) { try { P.close(); } catch (e) {} }
    P = await openPage({ quiet: true, storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, file), 'utf8') }, query: 'fleet=0' });
    W = P.win; D = W.document; run = c => vm.runInContext(c, P.ctx);
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
    await P.until(() => !!W.CAGE_UI, 60000);
    await P.until(() => false, 6000);
    W.requestAnimationFrame = () => 0;
    U = W.CAGE_UI; CH = W.CAGE_CHAIN;
  };
  const load = async p => {
    W.__DC = 'pending';
    const s0 = run('JSON.stringify(GARAGE_SPEC.get())');
    run('(() => { const p = ' + JSON.stringify({ file: p.file, n: p.n, name: p.name }) + '; try { Promise.resolve(GARAGE_SPEC.openListed(p)).then(() => { window.__DC = "ok"; }, e => { window.__DC = "err " + (e && e.message); }); } catch (e) { window.__DC = "threw " + e.message; } })()');
    await P.until(() => W.__DC !== 'pending', 600000);
    if (W.__DC !== 'ok') return W.__DC;
    await P.until(() => false, 4000);
    if (U.releaseFlush) U.releaseFlush();
    return run('JSON.stringify(GARAGE_SPEC.get())') !== s0 ? 'ok' : 'the spec on the stand did not change';
  };
  const hash = () => { try { return crypto.createHash('sha1').update(JSON.stringify(W.CAGE_JOIN.export())).digest('hex').slice(0, 16); } catch (e) { return 'ERR ' + e.message; } };
  // one walk: the row dragged to v (four ticks), released; the scene and the spec; back by a plain whole build
  const walk = async (el, x0, v, off) => {
    const Ev = W.Event, PE = W.PointerEvent || W.Event, st = +el.step || 0.001, lo = +el.min;
    CH.derivedOff = !!off;
    let crew = 0, ticks = 0;
    U.dragSettleMs = 1e9;
    el.dispatchEvent(new PE('pointerdown'));
    for (let i = 1; i <= 4; i++) {
      const L0 = CH.last;
      el.value = String(lo + Math.round((x0 + (v - x0) * i / 4 - lo) / st) * st); el.dispatchEvent(new Ev('input'));
      if (CH.last !== L0 && CH.last) { ticks++; if (Array.from(CH.last).some(l => l.name === 'crew' && l.ran)) crew++; }
      await P.until(() => false, 30);
    }
    U.dragSettleMs = 350;
    el.dispatchEvent(new Ev('change')); W.dispatchEvent(new PE('pointerup'));
    if (U.releaseFlush) U.releaseFlush();
    await P.until(() => false, SETTLE);
    const out = { h: hash(), fp: JSON.parse(run(FP)), crew, ticks, x: +el.value };
    CH.derivedOff = false;
    el.value = String(x0); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change'));
    await P.until(() => false, SETTLE);
    return out;
  };
  log('GATE DERIVED: ' + PLANES.length + ' aeroplanes, rows ' + ROWS.join(' ') + ' + the derived reads\' own');
  let first = true;
  for (const p of PLANES) {
    const tP = Date.now();
    try {
      let how = 'boot';
      if (first) { await boot(p.file); first = false; }
      else { how = await load(p); if (how !== 'ok') { log('list:' + p.n + ' not loaded in the page (' + how + '): a fresh boot'); await boot(p.file); how = 'boot'; } }
      if (!CH || typeof CH.derived !== 'function') { log('NO CAGE_CHAIN.derived on this page'); bad++; break; }
      const dk = CH.derivedKeys ? Array.from(CH.derivedKeys()) : [];
      const rows = [...new Set([...dk, ...ROWS])];
      log('== list:' + p.n + ' ' + p.name + '  (' + how + ')  derived reads on: ' + (dk.join(' ') || 'none'));
      for (const k of rows) {
        const el = D.getElementById('p_' + k);
        if (!el || el.type !== 'range' || el.disabled) { log('   ' + k.padEnd(10) + ' (no slider)'); continue; }
        const lo = +el.min, hi = +el.max, x0 = +el.value;
        for (const v of [lo, (lo + hi) / 2, hi]) {
          if (Math.abs(v - x0) < (+el.step || 0.001) / 2) continue;
          const A = await walk(el, x0, v, false), B = await walk(el, x0, v, true), C = await walk(el, x0, v, true);
          const diffs = []; let noise = 0;
          for (let i = 0; i < Math.max(A.fp.out.length, B.fp.out.length); i++) {
            if (A.fp.out[i] === B.fp.out[i]) continue;
            if (A.fp.out.length === B.fp.out.length && B.fp.out.length === C.fp.out.length && (B.fp.out[i] !== C.fp.out[i] || A.fp.out[i] === C.fp.out[i])) { noise++; continue; }
            diffs.push(i);
          }
          const same = !diffs.length && A.h === B.h;
          if (!same) bad++;
          rowsDone++; saved += Math.max(0, B.crew - A.crew);
          log('   ' + k.padEnd(10) + ' -> ' + String(+A.x.toFixed(4)).padEnd(8) + ' objects ' + A.fp.out.length + '/' + B.fp.out.length + '  ' + (same ? 'same' : 'DIFFER ' + diffs.length + (A.h !== B.h ? ' + spec ' + A.h + ' vs ' + B.h : '')) +
            (noise ? '  (noise ' + noise + ')' : '') + '  crew runs in the ticks: on ' + A.crew + '/' + A.ticks + ', off ' + B.crew + '/' + B.ticks);
          for (const i of diffs.slice(0, 3)) { const a = A.fp.out[i] || '(none)', b = B.fp.out[i] || '(none)'; let c = 0; while (c < a.length && a[c] === b[c]) c++;
            log('     @' + i + ' on:  ' + a.slice(0, 50) + ' ..@' + c + ': ' + a.slice(Math.max(0, c - 60), c + 120) + '\n       off: ' + b.slice(0, 50) + ' ..@' + c + ': ' + b.slice(Math.max(0, c - 60), c + 120)); }
        }
      }
    } catch (e) { bad++; first = true; log('list:' + p.n + ' ' + p.name + ' THREW ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    log('   (' + Math.round((Date.now() - tP) / 1000) + ' s)');
  }
  try { if (P) P.close(); } catch (e) {}
  log(rowsDone + ' walks compared, ' + bad + ' differ; crew runs saved in the ticks: ' + saved);
  if (!rowsDone) bad++;
  console.log('GATE DERIVED: ' + (bad ? 'FAIL' : 'PASS'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('_derived_check: ' + (e && e.stack || e)); console.log('GATE DERIVED: FAIL'); process.exit(1); });
