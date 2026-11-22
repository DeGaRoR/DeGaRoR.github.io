#!/usr/bin/env node
// log_capture.js - ONE COLD LOAD, ITS FLIGHT LOG SAVED (PERF-TRACE, 22 Nov 2026). On the shared harness (tools/page_rig.js:
// RIG-PROCEDURE.md sections 2-4 - a fresh Chrome profile = an empty shader cache, the real-GPU check, the boot wait, Go until
// flying, the hard cap, its own Chrome killed by PID tree). It adds only: fly `--flight` seconds, then save the flight
// recorder's log (FLIGHT_REC.rec.logParts(), as master_bench.js does) and a small capture.json beside it - the build, the
// GPU, the query, the wall times and THE CPU PACKAGE TEMPERATURE at the start, the end and its peak (LibreHardwareMonitor,
// localhost:8085: a load on a throttling box is not a load on a cool one - PERF-LEAD, 22 Nov).
//
//   node tools/perf/log_capture.js --out <dir> [--tag cold1] [--q "world=jolene"] [--page dev.html] [--flight 120]
//        [--cap 900] [--size 1600x900] [--headed] [--reports]
//   --q        the query, as a player's URL has it. `progid=0` = the program registry off, `rec=0` = the whole recorder off
//              (no log to save then: the capture.json alone - the overhead A/B's other half)
//   --reports  run the readers on the saved log (program_report, freeze_ledger, load_timeline, decision_table) into <dir>
//   --repo <tree>   serve another checkout (page_rig's `repo`): the SAME capture on a build without this branch - e.g.
//              perf-codex itself, for the proof below
//   node tools/perf/log_capture.js --compare <capture-a.json> <capture-b.json>
//              THE PROOF NOTHING CHANGED: both boots' programs by cache key (capture.json keeps the hash of every key at
//              the end of the flight): the counts, and the keys only one of them has. Owner labels are in no key, so a
//              build with them and one without must list the same set.
// A GPU RUN: A0's slot and the GPU lock first (RIG-PROCEDURE 1); a node run: through D:/Dev/flydiy-notes/cpu_token.sh.
// Writes <dir>/flightlog-<tag>.json and <dir>/capture-<tag>.json. Exit 0 = flying and the log saved; 1 = not; 3 = the cap.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), { execSync, spawnSync } = require('child_process');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; }, flag = k => argv.includes('--' + k);
if (flag('compare')) {
  const i = argv.indexOf('--compare'), A = JSON.parse(fs.readFileSync(argv[i + 1], 'utf8')), B = JSON.parse(fs.readFileSync(argv[i + 2], 'utf8'));
  const ka = (A.end && A.end.keys) || [], kb = (B.end && B.end.keys) || [], sa = new Set(ka), sb = new Set(kb);
  const onlyA = [...sa].filter(k => !sb.has(k)), onlyB = [...sb].filter(k => !sa.has(k));
  console.log('A ' + A.tag + ' (' + (A.sha || '').slice(0, 9) + ', q "' + A.q + '"): ' + ka.length + ' programs, ' + sa.size + ' distinct keys; B ' + B.tag + ' (' + (B.sha || '').slice(0, 9) + ', q "' + B.q + '"): ' + kb.length + ' programs, ' + sb.size + ' distinct keys');
  console.log('keys only in A: ' + onlyA.length + (onlyA.length ? '  ' + onlyA.slice(0, 12).join(' ') : '') + '; only in B: ' + onlyB.length + (onlyB.length ? '  ' + onlyB.slice(0, 12).join(' ') : ''));
  console.log(!ka.length || !kb.length ? 'NO VERDICT: a capture has no key list' : (onlyA.length || onlyB.length || ka.length !== kb.length) ? 'DIFFERENT' : 'IDENTICAL: the same programs by cache key');
  process.exit(!ka.length || !kb.length ? 2 : (onlyA.length || onlyB.length || ka.length !== kb.length) ? 1 : 0);
}
const OUT = opt('out', null), TAG = opt('tag', 'cold'), Q = opt('q', ''), FLIGHT = +opt('flight', 120), CAP = +opt('cap', 900);
if (!OUT) { console.error('usage: node tools/perf/log_capture.js --out <dir> [--tag cold1] [--q "k=v&..."] [--page dev.html] [--flight 120] [--cap 900] [--size 1600x900] [--headed] [--reports]'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
// the CPU package, deg C (null when the monitor does not answer)
const pkg = () => new Promise(res => { const rq = http.get({ host: 'localhost', port: 8085, path: '/data.json', timeout: 3000 }, r => { let b = ''; r.on('data', d => b += d);
  r.on('end', () => { const m = /"Text":"CPU Package","Min":"[^"]*","Value":"([0-9.]+)/g; let x, last = null; while ((x = m.exec(b))) last = +x[1]; res(last); }); });
  rq.on('error', () => res(null)); rq.on('timeout', () => { rq.destroy(); res(null); }); });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cap = { kind: 'flydiy-log-capture', v: 1, tag: TAG, q: Q, page: opt('page', 'dev.html'), size: opt('size', '1600x900'), flightS: FLIGHT, started: new Date().toISOString(), temp: { start: await pkg(), end: null, max: null, samples: 0 } };
  try { cap.sha = execSync('git rev-parse HEAD', { cwd: path.join(__dirname, '..', '..') }).toString().trim(); cap.branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: path.join(__dirname, '..', '..') }).toString().trim(); } catch (e) {}
  let tmax = cap.temp.start, live = true;
  (async () => { while (live) { const t = await pkg(); if (t != null) { cap.temp.samples++; if (tmax == null || t > tmax) tmax = t; } await sleep(5000); } })();
  let rig = null, code = 1;
  try {
    const t0 = Date.now();
    const so = { name: 'log_capture', cap: CAP, q: Q, page: cap.page, size: cap.size, headed: flag('headed') };
    if (opt('repo', null)) { so.repo = opt('repo'); cap.repo = so.repo; try { cap.repoSha = execSync('git rev-parse HEAD', { cwd: so.repo }).toString().trim(); } catch (e) {} }
    rig = await require('../page_rig.js').start(so);
    cap.gpu = rig.gpu; cap.garageWallS = +((Date.now() - t0) / 1000).toFixed(1);
    cap.build = await rig.ev('window.FLYDIY_BUILD || null');
    cap.garage = await rig.J('({ bootMs: Math.round(performance.now()), programs: (window.FLYDIY_RENDERER || (window.WORLD && WORLD.renderer) || { info: { programs: [] } }).info.programs.length, registry: window.PROGRAMS ? PROGRAMS.summary() : null })');
    const t1 = Date.now();
    // (a load that never reaches the flight is still a load: its log is saved all the same, and the run exits 1)
    let flew = true; try { await rig.fly({ tries: 16 }); } catch (e) { flew = false; cap.flyFailed = String(e && e.message || e).slice(0, 400); rig.log('NOT FLYING: ' + cap.flyFailed); }
    cap.flyingWallS = +((Date.now() - t1) / 1000).toFixed(1); cap.toFlyingWallS = flew ? +((Date.now() - t0) / 1000).toFixed(1) : null;
    if (flew) { rig.log('flying after ' + cap.toFlyingWallS + ' s; flying ' + FLIGHT + ' s more'); await sleep(FLIGHT * 1000); }
    cap.end = await rig.J('(() => { const R = window.FLYDIY_RENDERER || (window.WORLD && WORLD.renderer) || { info: { programs: [] } }; return { pageMs: Math.round(performance.now()), programs: R.info.programs.length, registry: window.PROGRAMS ? PROGRAMS.summary() : null, recOff: !!(window.FLIGHT_REC && FLIGHT_REC.off),' +
      ' boot: BOOT.log.filter(e => e.k === "step").map(e => [e.id, e.t, e.ms]),' +
      // every program's cache key, hashed (FNV-1a): the set --compare reads; the registry is not needed for it
      ' keys: R.info.programs.map(p => { const s = String(p.cacheKey); let a = 0x811c9dc5; for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619); } return (a >>> 0).toString(16); }).sort() }; })()');
    const has = await rig.ev('!!(window.FLIGHT_REC && !FLIGHT_REC.off && FLIGHT_REC.rec && FLIGHT_REC.rec.logParts)');
    if (has) {
      // (in pieces: one CDP answer of tens of MB is slow to build and to parse)
      const n = await rig.ev('(window.__LOGTXT = FLIGHT_REC.rec.logParts().join("")).length');
      const file = path.join(OUT, 'flightlog-' + TAG + '.json'), fd = fs.openSync(file, 'w'); const STEP = 4000000;
      for (let a = 0; a < n; a += STEP) fs.writeSync(fd, await rig.ev('window.__LOGTXT.slice(' + a + ', ' + (a + STEP) + ')'));
      fs.closeSync(fd); await rig.ev('(window.__LOGTXT = null, 1)');
      cap.log = path.basename(file); cap.logMB = +(n / 1048576).toFixed(1); rig.log('the flight log: ' + file + ' (' + cap.logMB + ' MB)');
    } else rig.log('no flight log on this page (the recorder is off: ?rec=0)');
    cap.errors = rig.errors.slice(0, 40);
    code = flew ? 0 : 1;
  } catch (e) { cap.failed = String(e && e.message || e).slice(0, 600); console.error('log_capture: ' + cap.failed); if (rig) { try { cap.why = await rig.why(); } catch (x) {} } }
  finally {
    live = false; cap.temp.end = await pkg(); cap.temp.max = tmax; cap.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'capture-' + TAG + '.json'), JSON.stringify(cap, null, 1));
    console.log('log_capture ' + TAG + ': ' + (cap.failed ? 'FAILED' : 'garage ' + cap.garageWallS + ' s, flying ' + (cap.toFlyingWallS == null ? 'NEVER' : cap.toFlyingWallS + ' s') + ', ' + (cap.end ? cap.end.programs : '?') + ' programs') + '; package ' + cap.temp.start + ' -> ' + cap.temp.end + ' C, peak ' + cap.temp.max);
    if (rig) { try { await rig.close(); } catch (e) {} }
  }
  if (cap.log && flag('reports')) {
    const log = path.join(OUT, cap.log), run = (tool, args) => { const r = spawnSync(process.execPath, [path.join(__dirname, '..', tool), log].concat(args), { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) console.error(tool + ': ' + (r.stderr || '').slice(0, 400)); };
    const b = path.join(OUT, TAG);
    run('program_report.js', ['--out', b + '.programs.json', '--md', b + '.programs.md']); run('freeze_ledger.js', ['--out', b + '.freezes.json', '--md', b + '.freezes.md']);
    run('load_timeline.js', ['--out', b + '.trace.json', '--summary', b + '.load.json']); run('decision_table.js', ['--out', b + '.decision.json', '--md', b + '.decision.md']);
    console.log('log_capture: the reports are in ' + OUT + ' (' + TAG + '.programs.md, .freezes.md, .trace.json, .load.json, .decision.md)');
  }
  process.exit(code);
})();
