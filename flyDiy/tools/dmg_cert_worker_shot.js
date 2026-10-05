#!/usr/bin/env node
// dmg_cert_worker_shot.js - DMG-D2a (G1831, G1832): THE CERTIFICATE AND THE TEST TO DESTRUCTION ON THE BENCH'S OWN
// THREAD, IN A REAL BROWSER. The page's side (app.js certKick, startLoadDestroy) hands the spec to bench_worker.js's
// Blob worker (importScripts of the worker file and the built core) and takes back the envelope (two Float64Arrays,
// transferred) or the broke-at. Node cannot run a Worker of that kind; headless Chromium can: this serves flyDiy/,
// opens a bare page that loads bench_worker.js only, runs both jobs for a validated build and checks what comes back
// against node's own answer (the same core). It is NOT the game's page (no WebGL, no world): the coordinator eyeballs
// that on the box. Prints one line a job and `WORKER: PASS|FAIL`.
//   node tools/build.js && node tools/dmg_cert_worker_shot.js [--build=cub]
//   (playwright: NODE_PATH=$(npm root -g); the browser: PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM=<path>)
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')));
}
const L = require('./_treecrash_lib.js'), C = L.core();
const key = (process.argv.find(a => a.startsWith('--build=')) || '--build=cub').slice(8);
const B = L.BUILDS[key];
let j = JSON.parse(fs.readFileSync(path.join(ROOT, B.build), 'utf8')); if (B.patch) j = B.patch(j);
const spec = C.genMigrateSpec ? C.genMigrateSpec(j.spec || j) : (j.spec || j);
const PAGE = '<!doctype html><meta charset="utf-8"><title>cert worker</title><script src="src/viewer/bench_worker.js"></script>';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/__certw.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); return; }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
(async () => {
  await new Promise(res => srv.listen(0, res));
  const port = srv.address().port;
  const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined);
  const br = await chromium.launch(exe ? { executablePath: exe } : {});
  const pg = await br.newPage();
  pg.on('console', m => { if (m.type() === 'error') console.log('  page:', m.text()); });
  await pg.goto('http://localhost:' + port + '/__certw.html');
  const run = (kind, extra) => pg.evaluate(([spec, kind, extra]) => new Promise(res => {
    const t0 = performance.now();
    const w = window.BENCH_WORKER.start(m => { if (!m || m.kind !== kind && !m.error) return; w.kill();
      res(m.error ? { error: m.error } : { ms: performance.now() - t0, nb: m.nb, ftLen: m.Ft ? m.Ft.length : null, ftType: m.Ft ? m.Ft.constructor.name : null,
        ftSum: m.Ft ? Array.from(m.Ft).reduce((a, b) => a + b, 0) : null, brokeAt: m.brokeAt, brokeKey: m.brokeKey, verdict: m.verdict, limit: m.limit, ult: m.ult }); },
      why => res({ error: 'worker: ' + why }));
    if (!w) { res({ error: 'no worker' }); return; }
    w.post(Object.assign({ kind, spec, seq: 1 }, extra || {}));
  }), [spec, kind, extra || null]);
  let ok = true;
  const node = C.genCertify(C.buildGen(spec), { world: (C.buildGen(spec).parts || {}).floats ? C.makeWorld() : null });
  const nodeSum = Array.from(node.Ft).reduce((a, b) => a + b, 0);
  const rc = await run('cert');
  const same = rc.ftLen === node.nb && Math.abs(rc.ftSum - nodeSum) <= 1e-6 * Math.abs(nodeSum);
  console.log('cert (' + key + '): ' + (rc.error || (rc.ms.toFixed(0) + ' ms in the worker, ' + rc.ftLen + ' members (' + rc.ftType + '), the envelope ' + (same ? 'equal to node\'s' : 'DIFFERENT from node\'s (' + rc.ftSum + ' / ' + nodeSum + ')'))));
  ok = ok && !rc.error && same;
  const rd = await run('destroy', { cfg: {}, cert: { nb: node.nb, Ft: node.Ft, Fc: node.Fc } });
  console.log('destroy (' + key + '): ' + (rd.error || (rd.ms.toFixed(0) + ' ms in the worker: ' + rd.verdict + ' - LIMIT ' + rd.limit + ' g / ULTIMATE ' + rd.ult + ' g / BROKE AT ' + (rd.brokeAt != null ? rd.brokeAt.toFixed(2) + ' g (' + rd.brokeKey + ')' : '-'))));
  ok = ok && !rd.error && rd.brokeAt != null;
  await br.close(); srv.close();
  console.log('WORKER: ' + (ok ? 'PASS' : 'FAIL'));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
