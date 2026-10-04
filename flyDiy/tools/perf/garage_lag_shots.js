#!/usr/bin/env node
// garage_lag_shots.js - GARAGE-LAG-2 (G1303): what a drag looks like now. The garage loaded with a build, the camera
// left where the garage puts it, then: the settled aeroplane (before), a wing-span tick under a held pointer (the
// detail layers - lights, hinges, access fittings, tanks - wait, hidden), and the aeroplane once the hand stops (the
// one full build). Three small JPEGs in --dir. Usage: node tools/perf/garage_lag_shots.js --port 8878 --udd <fresh>
//   --dir reports/evidence/GARAGE-LAG-2 [--build cub|metal] [--row p_wgSpan]. No --help.
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null), DIR = path.resolve(opt('dir', 'reports/evidence/GARAGE-LAG-2'));
if (!PORT || !UDD) { console.error('garage_lag_shots: --port and --udd are required'); process.exit(2); }
const BK = opt('build', 'cub'), ROW = opt('row', 'p_wgSpan');
const BUILDS = { cub: { build: 'tools/perf/garage_lag_cub_wip.json' }, metal: MB.BUILDS.metal };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (await MB.serveRoot(PORT)) { console.error('port taken'); process.exit(4); }
  const srv = MB.serve(PORT); await sleep(800);
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  fs.mkdirSync(DIR, { recursive: true });
  const b = await MB.browser(UDD);
  const l = await b.load('http://localhost:' + PORT + '/' + opt('tree', 'flyDiy') + '/index.html', MB.preScript(BUILDS[BK].build, null, BUILDS[BK].patch));
  console.log('  loaded ' + l.state + ' in ' + l.sec + ' s'); await sleep(8000);
  const shot = async name => { const r = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    fs.writeFileSync(path.join(DIR, BK + '_' + name + '.jpg'), Buffer.from(r.result.data, 'base64')); console.log('  ' + BK + '_' + name + '.jpg'); };
  const frames = n => b.ev(`new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r(1)); requestAnimationFrame(f); })`, 240000);
  await frames(3); await shot('1_settled');
  const ms = await b.ev(`(() => { window.CAGE_UI.dragSettleMs = 600000; const el = document.getElementById(${JSON.stringify(ROW)}); el.dispatchEvent(new PointerEvent('pointerdown'));
    const lo = +el.min, hi = +el.max, x = +el.value; el.value = String(Math.min(hi, x + (hi - lo) * 0.08)); const t = performance.now(); el.dispatchEvent(new Event('input'));
    return +(performance.now() - t).toFixed(1); })()`);
  console.log('  drag tick ' + ms + ' ms');
  // the shot inside the drag (the pause held off for the shot: a SwiftShader frame outlasts 350 ms)
  await frames(1); await shot('2_dragging');
  await b.ev(`(() => { window.CAGE_UI.dragSettleMs = 0; window.dispatchEvent(new PointerEvent('pointerup')); return 1; })()`);
  await sleep(1500); await frames(3); await shot('3_released');
  await b.close(); process.exit(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
