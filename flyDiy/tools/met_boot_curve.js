#!/usr/bin/env node
// ===========================================================================
// met_boot_curve — what a premises costs the BOOT, as a curve against its size.
// ===========================================================================
//
//   node tools/met_boot_curve.js [--dials 0.1,0.25,0.5,0.75,1] [--secs 70]
//                               [--url http://localhost:8497/flyDiy/dev.html]
//                               [--out tools/perf/met_boot_curve.json]
//
// WHY A CURVE AND NOT A THRESHOLD (the water session's design note, 2026-09-23,
// and it is the whole point of this tool). A pass/fail bisect — "does it boot at
// N plots" — gives a number that moves with whatever else is running on the box,
// so it is really a machine-load threshold wearing a plot count's clothes. Ten
// sessions and a headless Chrome share this machine; I spent a day reading this
// very stall as load and raising `--boot` until it went away. Measure the
// DURATION of the boot's steps against the plot count instead and the shape
// falls out, and the shape is what tells you which fix is the right one:
//
//     LINEAR in plots        a LADDER is enough: drain the build queue over
//                            frames and let the first light come early.
//     SUPERLINEAR            something is quadratic in the record; a worker
//                            will not save it either. Find that first.
//
// The threshold comes out of the curve for nothing, and the curve survives being
// run on a different machine, which a pass/fail number does not.
//
// WHAT IT IS MEASURING. `render_world.js`'s premises block says what it was
// written for, out loud: "The build queue drains here at the boot, WHOLE (36
// houses, 3 s on an RTX 3080 - a worker or a ladder is owed)". Metlakatla puts
// 452 plots through it — twelve and a half times — against a roll-out whose hard
// stop is 90 s. `MK_PLOTS` (tools/metlakatla_author.py) is the dial: under 1 it
// drops the catch-all zone and keeps a prefix of the quarters, because turning
// the density alone floors at 293 plots (the sower's gap chance caps at 0.95 and
// the catch-all refills what the quarters drop).
//
// Each step re-authors the record, rebuilds the pages, and runs the boot's own
// benchmark — `tools/boot_perf.js`, which already reads `window.BOOT.log`'s
// per-step milestones, the long tasks and a CDP sampling profile. `--cold` is
// used on purpose: a warm shader cache hides exactly the compile cost this is
// looking for.
//
// A MEASUREMENT, not a gate. Needs a static server and Chrome, and it boots the
// page once per dial — budget five minutes a step on a loaded box.
// ===========================================================================
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const DIALS = opt('dials', '0.1,0.25,0.5,0.75,1').split(',').map(Number).filter(v => v > 0);
const SECS = +opt('secs', 70);
const URL = opt('url', 'http://localhost:8497/flyDiy/dev.html');
const OUT = opt('out', 'tools/perf/met_boot_curve.json');

const run = (cmd, args, env) => execFileSync(cmd, args, {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26,
  env: Object.assign({}, process.env, env || {}),
});

// the plot count the record actually carries at this dial — the curve's x axis is
// the MEASURED count, not the dial, because the dial is not linear and need not be
function plotsNow() {
  const out = run('node', ['tools/met_measure.js']);
  const m = /^plots (\d+)/m.exec(out);
  return m ? +m[1] : -1;
}

const rows = [];
for (const k of DIALS) {
  process.stdout.write('MK_PLOTS=' + k + ' ... ');
  run('py', ['-3.11', 'tools/jolene_author.py'], { MK_PLOTS: String(k) });
  const plots = plotsNow();
  run('node', ['tools/build.js']);
  const tag = 'mk' + String(k).replace('.', 'p');
  const json = path.join('tools', 'perf', 'boot_' + tag + '.json');
  try {
    run('node', ['tools/boot_perf.js', '--url', URL, '--world', 'jolene',
                 '--cold', '--secs', String(SECS), '--tag', tag, '--out', json]);
  } catch (e) {
    console.log('plots ' + plots + '  BOOT FAILED (' + (e.message || '').split('\n')[0] + ')');
    rows.push({ dial: k, plots, failed: true });
    continue;
  }
  let J = null;
  try { J = JSON.parse(fs.readFileSync(path.join(ROOT, json), 'utf8')); } catch (e) {}
  // boot_perf's own milestones; the names are its, not ours, so keep the whole log
  const ms = J && (J.milestones || J.boot || J.log) || null;
  const total = J && (J.readyMs || J.totalMs || (ms && ms.ready)) || null;
  rows.push({ dial: k, plots, total, json });
  console.log('plots ' + plots + '  ready ' + (total === null ? '?' : Math.round(total) + ' ms'));
}

fs.mkdirSync(path.join(ROOT, 'tools', 'perf'), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify({ when: new Date().toISOString(), url: URL, rows }, null, 1));

console.log('\nplots      ready      ms/plot');
for (const r of rows) {
  if (r.failed) { console.log(String(r.plots).padStart(5) + '      FAILED'); continue; }
  const per = r.total && r.plots > 0 ? (r.total / r.plots).toFixed(1) : '?';
  console.log(String(r.plots).padStart(5) + '  ' + String(r.total === null ? '?' : Math.round(r.total)).padStart(8) + '  ' + String(per).padStart(9));
}
console.log('\nREAD THE SHAPE, not the threshold: a flat ms/plot column is LINEAR (a ladder');
console.log('is enough); a rising one is SUPERLINEAR (something is quadratic in the record');
console.log('and a worker will not save it). ' + OUT + ' has the rows.');
console.log('Restore the record when you are done:  py -3.11 tools/jolene_author.py');
