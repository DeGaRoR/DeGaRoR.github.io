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
//        [--settled [rows]] [--cgfree] [--float-release]
// Exit 1 on any difference. No --help.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'tools/fixtures/test_copies/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json',
  // PHONE-EDIT-PERF (2 Nov): the user's twin-boom pusher on floats (their S20 FE log's plane; the file's own name)
  twin: 'tools/fixtures/test_copies/Twin_busher_floats_2.json' };
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
  const T = [];   // G2228: the wall per build and per row (the summary names a slow one)
  for (const bk of WANT) {
    const tB = Date.now(), rowT = [];
    const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[bk] || bk), 'utf8') };
    if (FLEETQ) Object.assign(storage, require('./perf/fleet_b_set.js').storage());
    // --fleet: an empty store (every key unbaked: the garage's idle path captures), the GPU bake a stub
    const fhooks = FLEETQ ? { afterScript(name, Pg) { if (name === 'src/viewer/parked.js' && Pg.win.PARKED) { const Wp = Pg.win, m = new Map();
      Wp.PARKED.fleet.store = BAKED ? require('./_fleet_synth.js').fleetStore(Wp) : { get: k => Wp.Promise.resolve(m.has(k) ? m.get(k) : null), put: (k, v) => { m.set(k, v); return Wp.Promise.resolve(); } };
      Wp.PARKED.fleet.bake = async () => null; } } } : undefined;
    // (G2228: plain INSTANT pins the fleet OFF - ?fleet=0 - since FLYDIY_FLEET is on by default (G2226): only --fleet /
    // --fleet-baked stand it; a plain run never depends on the fleet's queue or decodes)
    const P = await openPage(Object.assign({ quiet: true, storage }, FLEETQ ? { query: 'fleet=1', hooks: fhooks } : { query: 'fleet=0' }));
    const W = P.win, D = W.document, run = c => vm.runInContext(c, P.ctx);
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
    await P.until(() => !!W.CAGE_UI, 60000);
    await P.until(() => false, 6000);
    W.requestAnimationFrame = () => 0;
    const hash = () => { try { return crypto.createHash('sha1').update(JSON.stringify(W.CAGE_JOIN.export())).digest('hex').slice(0, 16); } catch (e) { return 'ERR ' + e.message; } };
    log('== ' + bk + '  boot spec ' + hash() + '  chain ' + (W.CAGE_CHAIN ? (W.CAGE_CHAIN.ok ? 'ok' : 'NOT OK: ' + W.CAGE_CHAIN.why) + ', ' + W.CAGE_CHAIN.layers.length + ' layers' : 'absent'));
    // FLOAT-CG (GPS-STALL, 3 Nov): a floatplane's station after the load - GATE JOINPARITY's float row (gear.floats x/y),
    // the CG the step stood on (CAGE_FLOAT.cgM) and the one last published (FLYDIY_CG_MODEL)
    try { const g = (W.CAGE_JOIN.export() || {}).gear, f = g && g.type === 'floats' && g.floats, r5 = v => v == null ? '-' : (+v).toFixed(5);
      if (f) log('   float station x ' + r5(f.x) + ' y ' + r5(f.y) + '  step cgM ' + JSON.stringify(W.CAGE_FLOAT && W.CAGE_FLOAT.cgM || null) +
        ' (' + (W.CAGE_FLOAT && W.CAGE_FLOAT.cgFrom) + ')  FLYDIY_CG_MODEL ' + JSON.stringify(W.FLYDIY_CG_MODEL || null)); } catch (e) { log('   float station: ' + e.message); }
    // PHONE-EDIT-PERF (2 Nov): THE FLOATS' CG HANDSHAKE (G396). The float layer stands its step on the CG the balance
    // answered for the build before (FLYDIY_CG_MODEL) and the join's datum (CAGE_DATUM); the answer to the short way's
    // last build moves it once more by under 2 cm (no rebuild then, by design), so a long build right after read a newer
    // CG than the scene it is compared with - a difference on master's whole builds too. A trap notes the values the last
    // float build read (each read; kept when CAGE_FLOAT is set), and the long builds read those (--cgfree: the page's own)
    const CGT = { CAGE_DATUM: {}, FLYDIY_CG_MODEL: {} }; let cgUsed = null, cgPin = null;
    for (const key of Object.keys(CGT)) { const r = CGT[key]; r.v = W[key];
      Object.defineProperty(W, key, { configurable: true, set(x) { r.v = x; }, get() { const v = cgPin ? cgPin[key] : r.v; r.read = v; return v; } }); }
    { let fv = W.CAGE_FLOAT; Object.defineProperty(W, 'CAGE_FLOAT', { configurable: true, get() { return fv; },
      set(x) { fv = x; if (x) cgUsed = { CAGE_DATUM: CGT.CAGE_DATUM.read, FLYDIY_CG_MODEL: CGT.FLYDIY_CG_MODEL.read }; } }); }
    const CGFREE = argv.includes('--cgfree');
    const U = W.CAGE_UI, Ev = W.Event, PE = W.PointerEvent || W.Event;
    // --float-release (PHONE-1b diag): a floatplane's drag release takes the plan again (1a sends it whole); a differing
    // row then says who wrote the shared footwell (uFootA) on each way, and what the crew layer measured
    if (argv.includes('--float-release')) U.floatRelease = true;
    const FW = [];
    { const A = W.AEROSKIN; if (A && A.aeroSetFootwell) { const f0 = A.aeroSetFootwell;
      A.aeroSetFootwell = function (T, fw) {
        const st = String(new Error().stack || '').split('\n').slice(2, 5).map(s => s.trim().replace(/^at /, '').replace(/\(.*[\\/]/, '(')).join(' < ');
        FW.push((fw ? fw.yLip + '/' + fw.zTop + '/' + fw.zFloor : 'null') + '  ' + st); if (FW.length > 40) FW.shift();
        return f0.apply(this, arguments); }; } }
    const crewFw = () => JSON.stringify(W.CAGE_CREW && W.CAGE_CREW.footwell);
    const FL = FLEETQ ? W.PARKED.fleet : null, EVO = FLEETQ ? { bubbles: true } : undefined;
    if (FL) log('fleet: on ' + W.PARKED.fleetOn() + ', stood ' + (W.FLEET_STAND ? W.FLEET_STAND.state.holders.length : 0) + ', queued ' + FL.stats.queued + ', captures so far ' + FL.stats.captures + ', queue ' + FL.queue.join(' '));
    let dragCaps = 0;
    const tBoot = Date.now() - tB;
    for (const k of ROWS) {
      const tR = Date.now();
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
      FW.length = 0;
      el.dispatchEvent(new PE('pointerdown', EVO)); winToo('pointerdown');
      for (let i = 1; i <= 4; i++) { el.value = String(Math.min(hi, Math.max(lo, x0 + dir * d * i))); el.dispatchEvent(new Ev('input', EVO)); winToo('input'); await P.until(() => false, 30); }
      if (FL) await P.until(() => false, 4000);                   // --fleet: the slider HELD STILL past the queue's idle window
      const capD = FL ? FL.stats.captures - cap0 : 0;
      U.dragSettleMs = 350;
      el.dispatchEvent(new Ev('change', EVO)); winToo('change'); W.dispatchEvent(new PE('pointerup', EVO));
      if (U.releaseFlush) U.releaseFlush();   // (PHONE-EDIT-PERF P-2: the release builds after a paint - here, now)
      if (capD) { dragCaps += capD; bad++; log(k.padEnd(12) + ' FLEET: ' + capD + ' capture(s) started DURING the drag'); }
      const relN = U.release ? U.release.n - rl0 : 0, relW = U.release ? U.release.whole - rw0 : 0;
      const relTxt = !U.release ? '' : relN ? '  release: partial [' + ((U.release.last && U.release.last.why) || '') + '; floor ' + ((U.release.last && U.release.last.floor) || '') + ']'
        : relW ? '  release: whole (' + ((U.release.last && U.release.last.whole) || '') + ')' : '  release: none';
      await P.until(() => false, SETTLE);
      const previews = U.preview ? U.preview.n - pv0 : 0, deforms = U.preview ? U.preview.deform - df0 : 0;
      const hA = hash(), A = JSON.parse(run(FP));
      const fwA = FW.splice(0), crA = crewFw();
      // the long way: the sheet built, nothing kept (G1450-G1455's caches - the sheet's stages, the cavity bake, the
      // tank soup, the soles - off with it: RELEASE_FAST_OFF)
      const long = () => { U.sheetKeep = false; W.RELEASE_FAST_OFF = true; cgPin = CGFREE ? null : cgUsed;
        try { U.build(); } finally { U.sheetKeep = true; W.RELEASE_FAST_OFF = false; cgPin = null; } };
      long();
      if (SETTLE > 1500) await P.until(() => false, SETTLE);
      const hB = hash(), B = JSON.parse(run(FP));
      const fwB = FW.slice(), crB = crewFw();
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
      log(k.padEnd(12) + ' previews ' + previews + '/4 (deformed ' + deforms + ')  objects ' + A.out.length + '/' + B.out.length + '  ' + (same ? 'same' : 'DIFFER ' + diffs.length + (hA !== hB ? ' + spec ' + hA + ' vs ' + hB : '')) + (noise ? '  (noise ' + noise + ')' : '') + (previews < 4 ? '  [' + (U.preview && U.preview.deformWhy) + ']' : '') + relTxt + '  (' + ((Date.now() - tR) / 1000).toFixed(1) + ' s)');
      rowT.push([k, Date.now() - tR]);
      for (const i of diffs.slice(0, 3)) { const a = A.out[i] || '(none)', b = B.out[i] || '(none)'; let c = 0; while (c < a.length && a[c] === b[c]) c++;
        log('   @' + i + ' short: ' + a.slice(0, 50) + ' ..@' + c + ': ' + a.slice(Math.max(0, c - 60), c + 120) + '\n     long:  ' + b.slice(0, 50) + ' ..@' + c + ': ' + b.slice(Math.max(0, c - 60), c + 120)); }
      if (!same && (fwA.length || fwB.length))
        log('   footwell, crew: short ' + crA + '  long ' + crB + '\n   writes, short:\n     ' + fwA.slice(-5).join('\n     ') +
            '\n   writes, long:\n     ' + fwB.slice(-5).join('\n     '));
      // back to the build's value (a whole build)
      el.value = String(x0); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change'));
      await P.until(() => false, 1500);
    }
    // --settled [rows] (A0, 2 Nov): THE SETTLED AEROPLANE, UNPINNED. The pinned rows above compare one CG; this one proves
    // the aeroplane the player keeps. Each way is iterated to the handshake's FIXED POINT - built again while the CG the
    // balance answered (or the join's datum) is not bit for bit the one the last float build read - the game's 2 cm
    // deadband off on both (the page's own timer rebuild held; the short way rebuilds with buildCg, the release's CG build,
    // the long way with the long build), then the two aeroplanes are compared bit for bit
    if (argv.includes('--settled') && W.CAGE_FLOAT) {
      const SROWS = (opt('settled', null) || 'paxLen,rimW,wgSpan').split(',');
      let nBal = 0; (W.BALANCE_LISTENERS = W.BALANCE_LISTENERS || []).push(() => { nBal++; });
      const cgBuild0 = U.buildCg;
      const quiet = () => cgUsed && JSON.stringify(cgUsed.FLYDIY_CG_MODEL) === JSON.stringify(CGT.FLYDIY_CG_MODEL.v) && JSON.stringify(cgUsed.CAGE_DATUM) === JSON.stringify(CGT.CAGE_DATUM.v);
      const settle = async (rebuild) => {
        let it = 0;
        for (; it < 40; it++) {
          const n0 = nBal; await P.until(() => nBal > n0, 10000); await P.until(() => false, 300);
          if (quiet()) break;
          rebuild();
        }
        const a = CGT.FLYDIY_CG_MODEL.v, u = cgUsed && cgUsed.FLYDIY_CG_MODEL;
        return { it, quiet: quiet(), res: a && u ? Math.hypot(a[0] - u[0], a[1] - u[1]) : null };
      };
      for (const k of SROWS) {
        const tR = Date.now(), el = D.getElementById('p_' + k);
        if (!el || el.type !== 'range' || el.offsetParent === null || el.disabled) { log(('S:' + k).padEnd(12) + ' (no visible slider)'); continue; }
        const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001, dir = (hi - x0) > (x0 - lo) ? 1 : -1, d = Math.max(st, (hi - lo) * 0.012);
        U.buildCg = () => {};   // the page's timer rebuild held: each way drives its own
        try {
          U.dragSettleMs = 1e9;
          el.dispatchEvent(new PE('pointerdown'));
          for (let i = 1; i <= 4; i++) { el.value = String(Math.min(hi, Math.max(lo, x0 + dir * d * i))); el.dispatchEvent(new Ev('input')); await P.until(() => false, 30); }
          U.dragSettleMs = 350;
          el.dispatchEvent(new Ev('change')); W.dispatchEvent(new PE('pointerup'));
          if (U.releaseFlush) U.releaseFlush();
          const sA = await settle(() => cgBuild0());
          const hA = hash(), A = JSON.parse(run(FP));
          const longU = () => { U.sheetKeep = false; W.RELEASE_FAST_OFF = true; try { U.build(); } finally { U.sheetKeep = true; W.RELEASE_FAST_OFF = false; } };
          longU();
          const sB = await settle(longU);
          const hB = hash(), B = JSON.parse(run(FP));
          let nd = 0; const first = [];
          for (let i = 0; i < Math.max(A.out.length, B.out.length); i++) if (A.out[i] !== B.out[i]) { nd++; if (first.length < 2) first.push(i); }
          const same = !nd && hA === hB && sA.quiet && sB.quiet;
          if (!same) bad++;
          log(('S:' + k).padEnd(12) + ' settled short ' + sA.it + ' rebuild(s)' + (sA.quiet ? '' : ' NOT QUIET (' + sA.res + ' m)') + ', long ' + sB.it + (sB.quiet ? '' : ' NOT QUIET (' + sB.res + ' m)') +
            '  objects ' + A.out.length + '/' + B.out.length + '  ' + (same ? 'same' : 'DIFFER ' + nd + (hA !== hB ? ' + spec ' + hA + ' vs ' + hB : '')) + '  (' + ((Date.now() - tR) / 1000).toFixed(1) + ' s)');
          for (const i of first) { const a = A.out[i] || '(none)', b = B.out[i] || '(none)'; let c = 0; while (c < a.length && a[c] === b[c]) c++;
            log('   @' + i + ' short: ..' + a.slice(Math.max(0, c - 60), c + 100) + '\n     long:  ..' + b.slice(Math.max(0, c - 60), c + 100)); }
        } finally { U.buildCg = cgBuild0; }
        el.value = String(x0); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change'));
        await P.until(() => false, 1500);
      }
    }
    if (FL) {   // after the rows: no input - the queue's idle window opens and a capture runs
      const c1 = FL.stats.captures; FL.framed = true;
      await P.until(() => FL.stats.captures > c1 || (!FL.queue.length && !FL.busy), 60000);
      const ok = (BAKED ? FL.stats.captures === 0 : FL.stats.captures >= 1) && !dragCaps;
      if (!ok) bad++;
      log('fleet: ' + (ok ? 'ok' : 'RED') + ' - captures ' + FL.stats.captures + ' (during drags ' + dragCaps + '), input waits ' + FL.stats.inputWaits + ', not wanted ' + FL.stats.notWanted + ', queue left ' + FL.queue.length);
    }
    P.close();
    T.push([bk, Date.now() - tB, tBoot, rowT]);
    log('wall ' + bk + ': ' + ((Date.now() - tB) / 1000).toFixed(0) + ' s (boot ' + (tBoot / 1000).toFixed(0) + ' s; slowest rows ' + rowT.slice().sort((x, y) => y[1] - x[1]).slice(0, 3).map(r => r[0] + ' ' + (r[1] / 1000).toFixed(0) + ' s').join(', ') + ')');
  }
  console.log(bad ? '  ' + bad + ' row(s) differ' : '  every drag ended on the plain build\'s aeroplane');
  console.log(bad ? 'GATE INSTANT: FAIL (' + bad + ' row(s) differ)' : 'GATE INSTANT: PASS');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('_instant_check: ' + (e && e.stack || e)); console.log('GATE INSTANT: FAIL (threw)'); process.exit(1); });
