#!/usr/bin/env node
// rwylights_shots.js - G1415-G1419 (RUNWAY-LIGHTS): the before / after pictures of the runway lights, off the bench
// (tools/rwylights_bench.html: both versions' light code lifted out of render_world.js texts, side by side).
//
//   node tools/rwylights_shots.js <before render_world.js> [outDir] [--views a,b] [--port 8561] [--gpu]
//        [--after <render_world.js>] [--labels 'LEFT|RIGHT'] [--prefix p_]   (G1545: any two texts, e.g. two colours)
//
// Serves the repo (tools/_serve.js) unless something already answers on the port, opens the bench in Playwright's
// Chromium (SwiftShader unless --gpu), hands it the BEFORE text (e.g. `git show origin/master:flyDiy/src/viewer/
// render_world.js > /tmp/rw_master.js`) and the working tree's render_world.js as AFTER, and writes one JPEG a view
// (<= 250 KB, the quality stepped down until it fits) plus bench.json (the meshes, instances and triangles a side).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BEFORE = argv[0], OUT = path.resolve(argv[1] && !argv[1].startsWith('--') ? argv[1] : 'reports/evidence/RUNWAY-LIGHTS');
const PORT = +opt('port', 8561), ROOT = path.join(__dirname, '..', '..');
let PW;
try { PW = require('playwright'); } catch (e) { PW = require('/opt/node22/lib/node_modules/playwright'); }
const up = () => new Promise(r => http.get('http://127.0.0.1:' + PORT + '/flyDiy/tools/rwylights_bench.html', res => { res.resume(); r(res.statusCode === 200); }).on('error', () => r(false)));
(async () => {
  if (!BEFORE) { console.error('usage: rwylights_shots.js <before render_world.js> [outDir]'); process.exit(2); }
  let srv = null;
  if (!(await up())) { srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(PORT), ROOT], { stdio: 'ignore' }); for (let i = 0; i < 50 && !(await up()); i++) await new Promise(r => setTimeout(r, 200)); }
  fs.mkdirSync(OUT, { recursive: true });
  const b = await PW.chromium.launch({ args: argv.includes('--gpu') ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 540 } });
  p.on('pageerror', e => console.log('[page]', String(e)));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 400)); });
  await p.goto('http://127.0.0.1:' + PORT + '/flyDiy/tools/rwylights_bench.html');
  await p.waitForFunction(() => !!window.BENCH);
  const before = fs.readFileSync(BEFORE, 'utf8'), after = fs.readFileSync(opt('after', path.join(__dirname, '..', 'src', 'viewer', 'render_world.js')), 'utf8');
  const labs = opt('labels', null); if (labs) await p.evaluate(l => { const [x, y] = l.split('|'); document.getElementById('lb').textContent = x; document.getElementById('la').textContent = y; }, labs);
  const info = await p.evaluate(([a, c]) => BENCH.build(a, c), [before, after]);
  console.log('bench: before', JSON.stringify(info[0]), '| after', JSON.stringify(info[1]));
  const views = (opt('views', null) || '').split(',').filter(Boolean);
  const names = views.length ? views : await p.evaluate(() => Object.keys(BENCH.VIEWS));
  const out = { sides: info, shots: {} };
  for (const n of names) {
    await p.evaluate(v => BENCH.view(v), n);
    const f = path.join(OUT, opt('prefix', '') + n + '.jpg');
    let q = 85;
    for (;;) { await p.screenshot({ path: f, type: 'jpeg', quality: q }); if (fs.statSync(f).size <= 250 * 1024 || q <= 40) break; q -= 8; }
    out.shots[n] = { file: path.relative(path.join(__dirname, '..'), f), kb: Math.round(fs.statSync(f).size / 1024), q };
    console.log(n, '->', out.shots[n].file, out.shots[n].kb + ' KB', 'q' + q);
  }
  fs.writeFileSync(path.join(OUT, opt('prefix', '') + 'bench.json'), JSON.stringify(out, null, 1));
  await b.close(); if (srv) srv.kill();
})().catch(e => { console.error('rwylights_shots: ' + (e && e.stack || e)); process.exit(1); });
