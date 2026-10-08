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
// G1453 (RELEASE-FAST): the drag's RELEASE is the settle (the pause held off while the hand is down), and it may run
// only what the drag reached (G1451) - each row says which way its release went; the long way builds with every
// RELEASE-FAST cache off (the sheet's stages, the cavity bake, the tank soup, the soles: RELEASE_FAST_OFF). dashBack
// and shoulderT (G1452's interior + shoulder and shoulder-only stages) joined the rows.
// G2225 (FLEET-PROPS B) --fleet: THE FLEET'S BAKES NEVER SLOW A SLIDER. The six validated airframes saved and tied down
// outside at HOME (tools/perf/fleet_b_set.js), ?fleet=1, an empty fleet store: the boot's roll-out screen asks for six
// bakes the garage's idle path makes (the real capture through the editor; the GPU bake itself a stub - no GPU here).
// Each row's drag is dispatched as a browser does it (pointer and input events bubble, and the window hears each one -
// told to it as well: the node page's window listeners sit apart from the elements') and HELD STILL 4 s past its ticks (past the queue's 3 s idle window: a pointer down is still a drag). RED
// when a capture starts between a row's pointerdown and its pointerup, or when no capture ran in the idle time after
// the rows (the queue never drains); the rows' own same-scene verdict holds as without the flag.
// Usage: node --max-old-space-size=4096 tools/_instant_check.js [--builds cub,metal,jodel,cessna,floats] [--only k1,k2] [--fleet | --fleet-baked]
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
const ROWS = (opt('only', null) ? opt('only').split(',') : ['wgSpan', 'wgChord', 'stSpan', 's1X', 'seatH', 'paxLen', 'halfW', 'roofY', 'noseDroop', 'rimW', 'dashDepth', 'frCabTopW', 'dashBack', 'shoulderT']);
const log = s => console.log('  ' + s);
// --settle: the page's ms after the release (the floats' CG handshake - the balance's answer, a rebuild when the CG
// moved 2 cm - closes over a few seconds of the page's clock; a drag compared before it closes compares two moments)
const SETTLE = +opt('settle', 1500);
const BAKED = argv.includes('--fleet-baked');   // G2225: --fleet with every bake already made (tools/_fleet_synth.js): no capture runs - isolates the drag's own path
const FLEETQ = argv.includes('--fleet') || BAKED;   // G2225

const FP = fs.readFileSync(path.join(__dirname, 'perf', 'garage_lag_same.js'), 'utf8').match(/const FP = `([\s\S]*?)`;\n/)[1];

(async () => {
  const { openPage } = require('./_page_node.js');
  let bad = 0;
  for (const bk of WANT) {
    const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[bk] || bk), 'utf8') };
    if (FLEETQ) Object.assign(storage, require('./perf/fleet_b_set.js').storage());
    // --fleet: an empty store (every key unbaked: the garage's idle path captures), the GPU bake a stub
    const fhooks = FLEETQ ? { afterScript(name, Pg) { if (name === 'src/viewer/parked.js' && Pg.win.PARKED) { const Wp = Pg.win, m = new Map();
      Wp.PARKED.fleet.store = BAKED ? require('./_fleet_synth.js').fleetStore(Wp) : { get: k => Wp.Promise.resolve(m.has(k) ? m.get(k) : null), put: (k, v) => { m.set(k, v); return Wp.Promise.resolve(); } };
      Wp.PARKED.fleet.bake = async () => null; } } } : undefined;
    const P = await openPage(Object.assign({ quiet: true, storage }, FLEETQ ? { query: 'fleet=1', hooks: fhooks } : {}));
    const W = P.win, D = W.document, run = c => vm.runInContext(c, P.ctx);
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
    await P.until(() => !!W.CAGE_UI, 60000);
    await P.until(() => false, 6000);
    W.requestAnimationFrame = () => 0;
    const hash = () => { try { return crypto.createHash('sha1').update(JSON.stringify(W.CAGE_JOIN.export())).digest('hex').slice(0, 16); } catch (e) { return 'ERR ' + e.message; } };
    log('== ' + bk + '  boot spec ' + hash() + '  chain ' + (W.CAGE_CHAIN ? (W.CAGE_CHAIN.ok ? 'ok' : 'NOT OK: ' + W.CAGE_CHAIN.why) + ', ' + W.CAGE_CHAIN.layers.length + ' layers' : 'absent'));
    const U = W.CAGE_UI, Ev = W.Event, PE = W.PointerEvent || W.Event;
    const FL = FLEETQ ? W.PARKED.fleet : null, EVO = FLEETQ ? { bubbles: true } : undefined;
    if (FL) log('fleet: on ' + W.PARKED.fleetOn() + ', stood ' + (W.FLEET_STAND ? W.FLEET_STAND.state.holders.length : 0) + ', queued ' + FL.stats.queued + ', captures so far ' + FL.stats.captures + ', queue ' + FL.queue.join(' '));
    let dragCaps = 0;
    for (const k of ROWS) {
      const el = D.getElementById('p_' + k);
      if (!el || el.type !== 'range' || el.offsetParent === null || el.disabled) { log(k.padEnd(12) + ' (no visible slider)'); continue; }
      const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001, dir = (hi - x0) > (x0 - lo) ? 1 : -1;
      const d = Math.max(st, (hi - lo) * 0.012);
      const pv0 = U.preview ? U.preview.n : 0, df0 = U.preview ? U.preview.deform : 0;
      // G1453 (RELEASE-FAST): THE RELEASE IS THE SETTLE. The pause that settles a drag is held off while the hand is
      // down (the node page's clock moves ~10 us a call, so a build's own calls carried it past 350 ms inside the gap
      // between two ticks and the settle build ran mid-drag); the slider's change and the pointer up are the release.
      const rl0 = U.release ? U.release.n : 0, rw0 = U.release ? U.release.whole : 0;
      U.dragSettleMs = 1e9;
      if (FL) FL.framed = true;                                   // the browser drew frames between two rows
      const cap0 = FL ? FL.stats.captures : 0;
      // (--fleet: the node page keeps window's listeners apart from the elements' - _page_node.js WL - so a bubbling event
      // never reaches them; a browser's window sees every one of these in its capture phase: the drag is told to it too)
      const winToo = t => { if (FLEETQ) W.dispatchEvent(new PE(t)); };
      el.dispatchEvent(new PE('pointerdown', EVO)); winToo('pointerdown');
      for (let i = 1; i <= 4; i++) { el.value = String(Math.min(hi, Math.max(lo, x0 + dir * d * i))); el.dispatchEvent(new Ev('input', EVO)); winToo('input'); await P.until(() => false, 30); }
      if (FL) await P.until(() => false, 4000);                   // --fleet: the slider HELD STILL past the queue's idle window
      const capD = FL ? FL.stats.captures - cap0 : 0;
      U.dragSettleMs = 350;
      el.dispatchEvent(new Ev('change', EVO)); winToo('change'); W.dispatchEvent(new PE('pointerup', EVO));
      if (capD) { dragCaps += capD; bad++; log(k.padEnd(12) + ' FLEET: ' + capD + ' capture(s) started DURING the drag'); }
      const relN = U.release ? U.release.n - rl0 : 0, relW = U.release ? U.release.whole - rw0 : 0;
      const relTxt = !U.release ? '' : relN ? '  release: partial [' + ((U.release.last && U.release.last.why) || '') + '; floor ' + ((U.release.last && U.release.last.floor) || '') + ']'
        : relW ? '  release: whole (' + ((U.release.last && U.release.last.whole) || '') + ')' : '  release: none';
      await P.until(() => false, SETTLE);
      const previews = U.preview ? U.preview.n - pv0 : 0, deforms = U.preview ? U.preview.deform - df0 : 0;
      const hA = hash(), A = JSON.parse(run(FP));
      // the long way: the sheet built, nothing kept (G1450-G1455's caches - the sheet's stages, the cavity bake, the
      // tank soup, the soles - off with it: RELEASE_FAST_OFF)
      const long = () => { U.sheetKeep = false; W.RELEASE_FAST_OFF = true; try { U.build(); } finally { U.sheetKeep = true; W.RELEASE_FAST_OFF = false; } };
      long();
      if (SETTLE > 1500) await P.until(() => false, SETTLE);
      const hB = hash(), B = JSON.parse(run(FP));
      long();
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
      log(k.padEnd(12) + ' previews ' + previews + '/4 (deformed ' + deforms + ')  objects ' + A.out.length + '/' + B.out.length + '  ' + (same ? 'same' : 'DIFFER ' + diffs.length + (hA !== hB ? ' + spec ' + hA + ' vs ' + hB : '')) + (noise ? '  (noise ' + noise + ')' : '') + (previews < 4 ? '  [' + (U.preview && U.preview.deformWhy) + ']' : '') + relTxt);
      for (const i of diffs.slice(0, 3)) { const a = A.out[i] || '(none)', b = B.out[i] || '(none)'; let c = 0; while (c < a.length && a[c] === b[c]) c++;
        log('   @' + i + ' short: ' + a.slice(0, 50) + ' ..@' + c + ': ' + a.slice(Math.max(0, c - 60), c + 120) + '\n     long:  ' + b.slice(0, 50) + ' ..@' + c + ': ' + b.slice(Math.max(0, c - 60), c + 120)); }
      // back to the build's value (a whole build)
      el.value = String(x0); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change'));
      await P.until(() => false, 1500);
    }
    if (FL) {   // after the rows: no input - the queue's idle window opens and a capture runs
      const c1 = FL.stats.captures; FL.framed = true;
      await P.until(() => FL.stats.captures > c1 || (!FL.queue.length && !FL.busy), 60000);
      const ok = (BAKED ? FL.stats.captures === 0 : FL.stats.captures >= 1) && !dragCaps;
      if (!ok) bad++;
      log('fleet: ' + (ok ? 'ok' : 'RED') + ' - captures ' + FL.stats.captures + ' (during drags ' + dragCaps + '), input waits ' + FL.stats.inputWaits + ', not wanted ' + FL.stats.notWanted + ', queue left ' + FL.queue.length);
    }
    P.close();
  }
  console.log(bad ? '  ' + bad + ' row(s) differ' : '  every drag ended on the plain build\'s aeroplane');
  console.log(bad ? 'GATE INSTANT: FAIL (' + bad + ' row(s) differ)' : 'GATE INSTANT: PASS');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('_instant_check: ' + (e && e.stack || e)); console.log('GATE INSTANT: FAIL (threw)'); process.exit(1); });
