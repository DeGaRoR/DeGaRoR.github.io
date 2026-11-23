#!/usr/bin/env node
// _derived_check.js - GATE DERIVED (PERF-SLIDERS, 23 Nov 2026): A DERIVED READ BUILDS THE SAME AEROPLANE.
// CAGE_CHAIN.derived (tools/_cage_chain.js) lets a layer record the VALUE of a function of P instead of the rows the
// function read - the dash's gear selector asks only whether the mains stand off the centreline (s1X > 0.01), and with
// the raw read every tick of the main gear's station re-ran the whole crew layer (the DC-3: 1.4 of a 2.0 s tick). The
// claim is exactness: nothing built differs. PERF-LEAD's condition for it going ON by default: for every aeroplane of
// the player's list, the same slider walk builds the SAME aeroplane with derived on and with it off - the scene's
// fingerprint and the resolved spec equal, not "looks the same".
// In the page in node (tools/_page_node.js), per aeroplane (the plane list's player classes; put on the stand through
// the garage's own door), per row a derived read stands on (CAGE_CHAIN.derivedKeys(): the rows the functions read on
// this aeroplane; --rows adds others) and per value (the row's low end - the gear station's crosses the selector's
// threshold there -, its middle, four fifths of its range), three walks: derived ON, OFF, OFF again. One walk:
//   every row put back as the aeroplane was loaded (a walk to a row's end can coerce other rows for good: the first
//   version of this gate compared a second walk with a first that had moved the aeroplane under it), the mode set
//   (CAGE_CHAIN.derivedOff), ONE PLAIN BUILD so every layer's reads are recorded in that mode (the mode decides what a
//   layer records when it runs, not what a recorded layer does), then the row dragged as the editor hears it
//   (pointerdown, three ticks, the slider's change, the pointer up, the release's build), the scene fingerprinted
//   (garage_lag_same.js's fingerprint: every object in order, its type / name / visibility / matrix, a mesh's geometry
//   counts and position / index sums, every material slot's look and uniforms) and the join's export hashed.
// An object that differs between ON and OFF is a FAIL - unless the two OFF walks differ there too (noise: the crew's
// idle pose, the beacon's turn, a floatplane's CG handshake), counted apart; the spec hash the same way. The crew
// layer's runs in the ticks are printed for each side: OFF must run it where ON does not, or the gate did not test the
// mode (a FAIL: `the modes did not differ`, when no value of an aeroplane showed it).
// An aeroplane with no derived read (a fixed gear) has no walk of that kind and says so.
// FIRST, PER AEROPLANE: one plain build ON with the calls of CAGE_CHAIN.derived and CAGE_CHAIN.over COUNTED (the gate wraps
// the two functions in the page). An aeroplane that calls neither is built by the same code in both modes: it is
// counted and not compared (a comparison there measures only whether the aeroplane repeats itself build after build -
// a floatplane's CG handshake may not, to 1e-5 m).
// THE ROWS LAID OVER P (CAGE_CHAIN.over, the same switch): a layer that handed a generator a COPY of P read every row and
// re-ran on every tick of any row; over() reads through. Two checks, on EVERY aeroplane:
//   the stand: the aeroplane as loaded, one plain build ON, OFF, OFF - the scene and the spec equal (a generator that
//   enumerated what it was handed would build another aeroplane from the overlay), and the layers that read every row
//   in each mode are printed;
//   where the two modes' lists differ (an overlay is in use on this aeroplane), the walk above on four rows that are
//   none of the overlay's (the wing's span, the tail's, the main gear's station, the seat's height) to four fifths of
//   their range - OFF re-ran the layer on every tick, ON did not, the aeroplane after the release must be the same.
// --mode afmemo is GATE AFMEMO (below, in the aeroplane's loop): CAGE_CHAIN.afMemo ON / OFF / OFF / ON on every aeroplane.
// Usage: node --max-old-space-size=6144 tools/_derived_check.js [--planes list:12,list:41 | --all] [--rows k1,k2] [--mode afmemo]
// GATES_CORE=1 (the runner's core tier): two aeroplanes (a retractable twin, a hull amphibian).
// Exit 1 on any difference. Ends with one line: GATE DERIVED: PASS|FAIL. No --help.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PLAYER = ['reproduction', 'story', 'original', 'wip'], CORE = [12, 41];
const LISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/lists/plane_lists.json'), 'utf8')).planes;
const has = p => p && p.file && fs.existsSync(path.join(ROOT, p.file));
const num = s => +String(s).replace(/^list:/, '');
const want = opt('planes', null) ? opt('planes').split(',').map(num) : (process.env.GATES_CORE === '1' && !argv.includes('--all') ? CORE : null);
const PLANES = want ? want.map(n => LISTS.find(p => p.n === n)).filter(has) : LISTS.filter(p => has(p) && !p.rides && (argv.includes('--all') || PLAYER.includes(p.list)));
const ROWS = opt('rows', '') ? opt('rows').split(',') : [];
const SETTLE = +opt('settle', 1500);
const OVER_ROWS = ['wgSpan', 'stSpan', 's1X', 'seatH'];
const MODE = opt('mode', 'derived');   // 'afmemo': the sheet's airframe built once, ON against OFF, every aeroplane (GATE AFMEMO, below)
const log = s => console.log('  ' + s);
const FP = fs.readFileSync(path.join(__dirname, 'perf', 'garage_lag_same.js'), 'utf8').match(/const FP = `([\s\S]*?)`;\n/)[1];

(async () => {
  const { openPage } = require('./_page_node.js');
  let bad = 0, walks = 0, saved = 0, withReads = 0, stands = 0, overs = 0, sameCode = 0, P = null, W = null, D = null, U = null, CH = null, run = null;
  const boot = async file => {
    if (P) { try { P.close(); } catch (e) {} }
    P = await openPage({ quiet: true, storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, file), 'utf8') }, query: 'fleet=0' });
    W = P.win; D = W.document; run = c => vm.runInContext(c, P.ctx);
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
    await P.until(() => !!W.CAGE_UI, 60000);
    await P.until(() => false, 6000);
    W.requestAnimationFrame = () => 0;
    U = W.CAGE_UI; CH = W.CAGE_CHAIN;
    // THE CALLS, COUNTED (the gate's own wrap; the call sites read window.CAGE_CHAIN.over / .derived when they call):
    // an aeroplane on which neither is called builds by the same code in both modes - nothing to compare there
    run('(() => { const C = window.CAGE_CHAIN, N = window.__DCN = { over: 0, derived: 0 }; if (C && C.over && !C.over.__n) { const o0 = C.over, d0 = C.derived; C.over = function (P, o) { N.over++; return o0(P, o); }; C.over.__n = 1; C.derived = function (P, n, f) { N.derived++; return d0(P, n, f); }; } return 1; })()');
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
  // the aeroplane as it was loaded: every row of P (in the page's own realm), put back before each walk
  const snap = () => run('(() => { window.__DCP = JSON.stringify(CAGE_UI.P); return 1; })()');
  const restore = () => run('(() => { const P = CAGE_UI.P, S = JSON.parse(window.__DCP); for (const k of Object.keys(P)) if (!(k in S)) delete P[k]; Object.assign(P, S); CAGE_UI.syncSliders(); return 1; })()');
  // one walk (the header's): put back, the mode, a plain build, the drag to v, the release; the scene and the spec
  const walk = async (k, v, off) => {
    const Ev = W.Event, PE = W.PointerEvent || W.Event;
    restore();
    CH.derivedOff = !!off;
    U.build();
    await P.until(() => false, SETTLE);
    const el = D.getElementById('p_' + k), st = +el.step || 0.001, lo = +el.min, x0 = +el.value;
    let crew = 0, ticks = 0;
    U.dragSettleMs = 1e9;
    el.dispatchEvent(new PE('pointerdown'));
    for (let i = 1; i <= 3; i++) {
      const L0 = CH.last;
      el.value = String(lo + Math.round((x0 + (v - x0) * i / 3 - lo) / st) * st); el.dispatchEvent(new Ev('input'));
      if (CH.last !== L0 && CH.last) { ticks++; if (Array.from(CH.last).some(l => l.name === 'crew' && l.ran)) crew++; }
      await P.until(() => false, 30);
    }
    U.dragSettleMs = 350;
    el.dispatchEvent(new Ev('change')); W.dispatchEvent(new PE('pointerup'));
    if (U.releaseFlush) U.releaseFlush();
    await P.until(() => false, SETTLE);
    // (the beacon's rotor turns on the page's clock, and the clock moves with the work done: at rest for the picture)
    run('(() => { const S = window.CAGE_SCENE; if (S) S.traverse(o => { if (/^liRotor/.test(o.name || "")) { o.rotation.set(0, 0, 0); o.updateMatrix(); o.updateMatrixWorld(true); } }); return 1; })()');
    const out = { h: hash(), fp: JSON.parse(run(FP)), crew, ticks, x: +el.value, rel: U.release && U.release.last ? (U.release.last.whole ? 'whole (' + U.release.last.whole + ')' : 'planned') : '?' };
    CH.derivedOff = false;
    return out;
  };
  // the stand (the header's): the aeroplane as loaded, a plain build in the mode; the scene, the spec, the layers that read every row
  const ROTOR = '(() => { const S = window.CAGE_SCENE; if (S) S.traverse(o => { if (/^liRotor/.test(o.name || "")) { o.rotation.set(0, 0, 0); o.updateMatrix(); o.updateMatrixWorld(true); } }); return 1; })()';
  const stand = async off => {
    restore(); if (MODE === 'afmemo') CH.afMemo.on = !off; else CH.derivedOff = !!off; U.build();
    await P.until(() => false, SETTLE);
    run(ROTOR);
    const out = { h: hash(), fp: JSON.parse(run(FP)), all: Array.from(CH.layers).filter(l => l.all).map(l => l.name).join(' ') };
    CH.derivedOff = false; if (CH.afMemo) CH.afMemo.on = true;
    return out;
  };
  const cmp = (A, B, C) => { const diffs = []; let noise = 0;
    for (let i = 0; i < Math.max(A.fp.out.length, B.fp.out.length); i++) {
      if (A.fp.out[i] === B.fp.out[i]) continue;
      if (A.fp.out.length === B.fp.out.length && B.fp.out.length === C.fp.out.length && (B.fp.out[i] !== C.fp.out[i] || A.fp.out[i] === C.fp.out[i])) { noise++; continue; }
      diffs.push(i);
    }
    const specNoise = A.h !== B.h && B.h !== C.h, specBad = A.h !== B.h && !specNoise;
    return { diffs, noise, specNoise, specBad, same: !diffs.length && !specBad }; };
  const show = (A, B, diffs) => { for (const i of diffs.slice(0, 3)) { const a = A.fp.out[i] || '(none)', b = B.fp.out[i] || '(none)'; let c = 0; while (c < a.length && a[c] === b[c]) c++;
    log('     @' + i + ' on:  ' + a.slice(0, 50) + ' ..@' + c + ': ' + a.slice(Math.max(0, c - 60), c + 120) + '\n       off: ' + b.slice(0, 50) + ' ..@' + c + ': ' + b.slice(Math.max(0, c - 60), c + 120)); } };
  log('GATE DERIVED: ' + PLANES.length + ' aeroplanes, the derived reads\' own rows' + (ROWS.length ? ' + ' + ROWS.join(' ') : ''));
  let first = true;
  for (const p of PLANES) {
    const tP = Date.now();
    try {
      let how = 'boot';
      if (first) { await boot(p.file); first = false; }
      else { how = await load(p); if (how !== 'ok') { log('list:' + p.n + ' not loaded in the page (' + how + '): a fresh boot'); await boot(p.file); how = 'boot'; } }
      if (!CH || typeof CH.derived !== 'function' || typeof CH.derivedKeys !== 'function') { log('NO CAGE_CHAIN.derived / derivedKeys on this page'); bad++; break; }
      if (typeof CH.over !== 'function') { log('NO CAGE_CHAIN.over on this page'); bad++; break; }
      const dk = Array.from(CH.derivedKeys());
      log('== list:' + p.n + ' ' + p.name + '  (' + how + ')  derived reads on: ' + (dk.join(' ') || 'none'));
      snap();
      // --mode afmemo (GATE AFMEMO): THE SHEET'S AIRFRAME BUILT ONCE IS THE AIRFRAME BUILT EVERY TIME, ON EVERY AEROPLANE.
      // From a settled aeroplane four plain builds - the memo ON, OFF, OFF, ON - and an object (or the resolved spec) is
      // the memo's doing only where the two ON agree, the two OFF agree, and ON is not OFF; anything else that moves is
      // the aeroplane not repeating itself (a floatplane's CG handshake) and is counted as drift. The ON builds must
      // have used the memo (its hits), or nothing was tested.
      if (MODE === 'afmemo') {
        if (!CH.afMemo) { log('NO CAGE_CHAIN.afMemo on this page'); bad++; break; }
        { let w0 = await stand(false), n = 1, eq = false; for (; n < 4 && !eq; n++) { const w1 = await stand(false); eq = w1.h === w0.h && w1.fp.out.length === w0.fp.out.length && w1.fp.out.every((o, j) => o === w0.fp.out[j]); w0 = w1; } }
        const h0 = CH.afMemo.hits;
        const A = await stand(false), hits = CH.afMemo.hits - h0, B = await stand(true), C = await stand(true), D = await stand(false);
        const diffs = []; let drift = 0; const N = Math.max(A.fp.out.length, B.fp.out.length, C.fp.out.length, D.fp.out.length);
        for (let i = 0; i < N; i++) { const a = A.fp.out[i], b = B.fp.out[i], c = C.fp.out[i], d = D.fp.out[i]; if (a === b && b === c && c === d) continue; if (a === d && b === c && a !== b) diffs.push(i); else drift++; }
        const specBad = A.h === D.h && B.h === C.h && A.h !== B.h, same = !diffs.length && !specBad && hits > 0;
        stands++; if (!same) bad++;
        log('   the stand, the memo ON / OFF / OFF / ON   objects ' + A.fp.out.length + '  ' + (!hits ? 'THE MEMO WAS NOT USED (0 hits)' : same ? 'same' : 'DIFFER ' + diffs.length + (specBad ? ' + spec ' + A.h + ' vs ' + B.h : '')) + '  (hits in the ON build ' + hits + (drift ? ', drift ' + drift : '') + ')  (' + Math.round((Date.now() - tP) / 1000) + ' s)');
        show(A, B, diffs);
        continue;
      }
      // WHAT THIS AEROPLANE CALLS: one plain build ON with the counters at zero. Neither called = the two modes are the
      // same code on it (the PC-6 on Wiplines, 23 Nov: no derived read, no overlay, and an aeroplane that does not
      // repeat itself build after build - its floats' CG handshake drifts 1e-5 m a build - read as 16 to 458 objects
      // 'off' between two identical modes)
      run('window.__DCN.over = 0; window.__DCN.derived = 0; 1');
      await stand(false);
      const used = JSON.parse(run('JSON.stringify(window.__DCN)'));
      if (!used.over && !used.derived && !ROWS.length) { stands++; sameCode++; log('   neither a derived read nor an overlay is CALLED on this aeroplane (one plain build, counted): the two modes are the same code - nothing to compare  (' + Math.round((Date.now() - tP) / 1000) + ' s)'); continue; }
      log('   called in one plain build: derived ' + used.derived + ', over ' + used.over);
      // (23 Nov, the PC-6 on Wiplines: a floatplane's CG handshake closes over a few builds - it stood 0.01 mm lower build
      // after build, and ON, the first of the three, read as 458 objects off OFF on an aeroplane with no derived read and
      // no overlay at all. The three are compared from a SETTLED aeroplane: plain builds until two in a row are the same
      // scene and spec, six at most)
      { let w0 = await stand(false), n = 1, eq = false;
        for (; n < 6 && !eq; n++) { const w1 = await stand(false); eq = w1.h === w0.h && w1.fp.out.length === w0.fp.out.length && w1.fp.out.every((o, j) => o === w0.fp.out[j]); w0 = w1; }
        if (n > 2 || !eq) log('   (settled: ' + (eq ? 'two builds the same after ' + n : 'NOT the same after ' + n) + ' builds)'); }
      const SA = await stand(false), SB = await stand(true), SC = await stand(true), sc = cmp(SA, SB, SC);
      stands++; if (!sc.same) bad++;
      const overOn = SA.all !== SB.all;
      if (overOn) overs++;
      log('   the stand   objects ' + SA.fp.out.length + '/' + SB.fp.out.length + '  ' + (sc.same ? 'same' : 'DIFFER ' + sc.diffs.length + (sc.specBad ? ' + spec ' + SA.h + ' vs ' + SB.h : '')) + (sc.noise ? '  (noise ' + sc.noise + ')' : '') + (sc.specNoise ? '  (spec noise)' : '') +
        '  layers that read every row: on [' + SA.all + '], off [' + SB.all + ']');
      show(SA, SB, sc.diffs);
      const rows = [...new Set([...dk, ...ROWS, ...(overOn ? OVER_ROWS : [])])];
      if (!rows.length) { log('   no derived read and no overlay in use on this aeroplane: no walk  (' + Math.round((Date.now() - tP) / 1000) + ' s)'); continue; }
      let moded = 0, dwalks = 0;
      for (const k of rows) {
        const el = D.getElementById('p_' + k);
        if (!el || el.type !== 'range' || el.disabled) { log('   ' + k.padEnd(10) + ' (no slider)'); continue; }
        const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001;
        for (const v of (dk.includes(k) || ROWS.includes(k) ? [lo, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.8] : [lo + (hi - lo) * 0.8])) {
          if (Math.abs(v - x0) < st * 1.5) continue;
          const A = await walk(k, v, false), B = await walk(k, v, true), C = await walk(k, v, true);
          const diffs = []; let noise = 0;
          for (let i = 0; i < Math.max(A.fp.out.length, B.fp.out.length); i++) {
            if (A.fp.out[i] === B.fp.out[i]) continue;
            if (A.fp.out.length === B.fp.out.length && B.fp.out.length === C.fp.out.length && (B.fp.out[i] !== C.fp.out[i] || A.fp.out[i] === C.fp.out[i])) { noise++; continue; }
            diffs.push(i);
          }
          const specNoise = A.h !== B.h && B.h !== C.h, specBad = A.h !== B.h && !specNoise;
          const same = !diffs.length && !specBad;
          if (!same) bad++;
          walks++; if (dk.includes(k)) { dwalks++; if (B.crew > A.crew) { moded++; saved += B.crew - A.crew; } }
          log('   ' + k.padEnd(10) + ' -> ' + String(+A.x.toFixed(4)).padEnd(8) + ' objects ' + A.fp.out.length + '/' + B.fp.out.length + '  ' + (same ? 'same' : 'DIFFER ' + diffs.length + (specBad ? ' + spec ' + A.h + ' vs ' + B.h : '')) +
            (noise ? '  (noise ' + noise + ')' : '') + (specNoise ? '  (spec noise)' : '') + '  crew runs in the ticks: on ' + A.crew + '/' + A.ticks + ', off ' + B.crew + '/' + B.ticks + '  release: on ' + A.rel + ', off ' + B.rel);
          for (const i of diffs.slice(0, 3)) { const a = A.fp.out[i] || '(none)', b = B.fp.out[i] || '(none)'; let c = 0; while (c < a.length && a[c] === b[c]) c++;
            log('     @' + i + ' on:  ' + a.slice(0, 50) + ' ..@' + c + ': ' + a.slice(Math.max(0, c - 60), c + 120) + '\n       off: ' + b.slice(0, 50) + ' ..@' + c + ': ' + b.slice(Math.max(0, c - 60), c + 120)); }
        }
      }
      restore(); U.build(); await P.until(() => false, SETTLE);
      if (dk.length) { withReads++; if (dwalks && !moded) { bad++; log('   THE MODES DID NOT DIFFER on this aeroplane (OFF never ran the crew layer where ON did not): the gate did not test the read'); } }
    } catch (e) { bad++; first = true; log('list:' + p.n + ' ' + p.name + ' THREW ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    log('   (' + Math.round((Date.now() - tP) / 1000) + ' s)');
  }
  try { if (P) P.close(); } catch (e) {}
  log(stands + ' aeroplanes looked at: ' + sameCode + ' call neither (the same code in both modes), ' + (stands - sameCode) + ' compared on the stand (' + overs + ' where the every-row layers of the two modes differ), ' + walks + ' walks compared (' + withReads + ' aeroplanes with a derived read), ' + bad + ' failures; crew runs saved in the ticks: ' + saved);
  if (!stands) { bad++; log('nothing was compared'); }
  console.log('GATE ' + (MODE === 'afmemo' ? 'AFMEMO' : 'DERIVED') + ': ' + (bad ? 'FAIL' : 'PASS'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('_derived_check: ' + (e && e.stack || e)); console.log('GATE DERIVED: FAIL'); process.exit(1); });
