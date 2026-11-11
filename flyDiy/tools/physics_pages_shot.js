#!/usr/bin/env node
// physics_pages_shot.js - PHYSICS-PAGES: the official planes' physics pages as PICTURES (devlog / Steam / print), drawn by
// the game's own module (src/viewer/fiche_physics.js) in a headless browser, from the baked data
// (media/fiches/<key>/physics.json, tools/fiche_physics_bake.js) and the baked fiche pictures. No graphics card: SVG only.
//   node tools/physics_pages_shot.js [--theme screen|sheet] [--only <key,key>] [--pages load,drag,xray,model] [--out <dir>]
// Writes <out>/<key>_<page>_<theme>.png at 2400 x 1600 (default out: screenshots/physics_pages/).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const FLY = path.join(__dirname, '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const theme = opt('theme', 'screen'), pages = opt('pages', 'load,drag,xray,model').split(','), out = path.resolve(opt('out', path.join(FLY, 'screenshots', 'physics_pages')));
const IX = JSON.parse(fs.readFileSync(path.join(FLY, 'media', 'fiches', 'index.json'), 'utf8')).fiches;
const only = opt('only', '') ? opt('only').split(',') : null;
const keys = Object.keys(IX).filter(k => (!only || only.includes(k)) && fs.existsSync(path.join(FLY, 'media', 'fiches', path.dirname(IX[k].pics.side || 'x/x'), 'physics.json')));
let pw = null; try { pw = require('playwright'); } catch (e) { console.error('physics_pages_shot: needs Playwright (npm i -D playwright)'); process.exit(1); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/_shot.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"><body style="margin:0"><div id="el" style="width:1200px"></div><script src="/src/viewer/fiche_physics.js"></script>'); return; }
  const f = path.join(FLY, u); if (!f.startsWith(FLY) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
srv.listen(0, '127.0.0.1', async () => {
  const port = srv.address().port; fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  await p.goto(`http://127.0.0.1:${port}/_shot.html`); await p.waitForTimeout(600);
  let n = 0;
  for (const k of keys) for (const pg of pages) {
    const ok = await p.evaluate(async ([k, pg, th, rec]) => FICHE_PHYSICS.mount(document.getElementById('el'), rec, pg, { theme: th, title: rec.title }),
      [k, pg, theme, { name: k, baked: true, title: IX[k].name, data: IX[k].data, pics: Object.fromEntries(Object.entries(IX[k].pics).map(([v, f]) => [v, '/media/fiches/' + f])) }]);
    if (!ok) { console.log('no data:', k); continue; }
    const f = path.join(out, k.replace(/[^\w.-]+/g, '_') + '_' + pg + '_' + theme + '.png');
    await (await p.$('#el svg')).screenshot({ path: f }); n++;
  }
  await b.close(); srv.close();
  console.log(`physics_pages_shot: ${n} pictures -> ${path.relative(FLY, out)}`);
});
