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
//   --reports  run the three readers on the saved log (program_report, freeze_ledger, load_timeline) into <dir>
// A GPU RUN: A0's slot and the GPU lock first (RIG-PROCEDURE 1); a node run: through D:/Dev/flydiy-notes/cpu_token.sh.
// Writes <dir>/flightlog-<tag>.json and <dir>/capture-<tag>.json. Exit 0 = flying and the log saved; 1 = not; 3 = the cap.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), { execSync, spawnSync } = require('child_process');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; }, flag = k => argv.includes('--' + k);
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
    rig = await require('../page_rig.js').start({ name: 'log_capture', cap: CAP, q: Q, page: cap.page, size: cap.size, headed: flag('headed') });
    cap.gpu = rig.gpu; cap.garageWallS = +((Date.now() - t0) / 1000).toFixed(1);
    cap.build = await rig.ev('window.FLYDIY_BUILD || null');
    cap.garage = await rig.J('({ bootMs: Math.round(performance.now()), programs: (window.FLYDIY_RENDERER || (window.WORLD && WORLD.renderer) || { info: { programs: [] } }).info.programs.length, registry: window.PROGRAMS ? PROGRAMS.summary() : null })');
    const t1 = Date.now();
    await rig.fly({ tries: 16 });
    cap.flyingWallS = +((Date.now() - t1) / 1000).toFixed(1); cap.toFlyingWallS = +((Date.now() - t0) / 1000).toFixed(1);
    rig.log('flying after ' + cap.toFlyingWallS + ' s; flying ' + FLIGHT + ' s more');
    await sleep(FLIGHT * 1000);
    cap.end = await rig.J('({ pageMs: Math.round(performance.now()), programs: (window.FLYDIY_RENDERER || (window.WORLD && WORLD.renderer)).info.programs.length, registry: window.PROGRAMS ? PROGRAMS.summary() : null, recOff: !!(window.FLIGHT_REC && FLIGHT_REC.off),' +
      ' boot: BOOT.log.filter(e => e.k === "step").map(e => [e.id, e.t, e.ms]) })');
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
    code = 0;
  } catch (e) { cap.failed = String(e && e.message || e).slice(0, 600); console.error('log_capture: ' + cap.failed); if (rig) { try { cap.why = await rig.why(); } catch (x) {} } }
  finally {
    live = false; cap.temp.end = await pkg(); cap.temp.max = tmax; cap.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'capture-' + TAG + '.json'), JSON.stringify(cap, null, 1));
    console.log('log_capture ' + TAG + ': ' + (cap.failed ? 'FAILED' : 'garage ' + cap.garageWallS + ' s, flying ' + cap.toFlyingWallS + ' s, ' + (cap.end ? cap.end.programs : '?') + ' programs') + '; package ' + cap.temp.start + ' -> ' + cap.temp.end + ' C, peak ' + cap.temp.max);
    if (rig) { try { await rig.close(); } catch (e) {} }
  }
  if (code === 0 && cap.log && flag('reports')) {
    const log = path.join(OUT, cap.log), run = (tool, args) => { const r = spawnSync(process.execPath, [path.join(__dirname, '..', tool), log].concat(args), { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) console.error(tool + ': ' + (r.stderr || '').slice(0, 400)); };
    const b = path.join(OUT, TAG);
    run('program_report.js', ['--out', b + '.programs.json', '--md', b + '.programs.md']); run('freeze_ledger.js', ['--out', b + '.freezes.json', '--md', b + '.freezes.md']);
    run('load_timeline.js', ['--out', b + '.trace.json', '--summary', b + '.load.json']); run('decision_table.js', ['--out', b + '.decision.json', '--md', b + '.decision.md']);
    console.log('log_capture: the reports are in ' + OUT + ' (' + TAG + '.programs.md, .freezes.md, .trace.json, .load.json, .decision.md)');
  }
  process.exit(code);
})();
