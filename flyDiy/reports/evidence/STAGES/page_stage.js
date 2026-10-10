// headless Chromium: the page composes the staged record at load (world_boot.js) - the sandbox and the dev career
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const ROOT = '/home/user/DeGaRoR.github.io';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.ktx2': 'application/octet-stream', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
srv.listen(0, async () => {
  const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const q of ['?world=jolene', '?world=jolene&career=1&stages=field:1,minedock:3,resort:1']) {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://localhost:' + port + '/flyDiy/index.html' + q, { waitUntil: 'load', timeout: 120000 });
    let got = null;
    for (let i = 0; i < 120 && !got; i++) { got = await page.evaluate(() => { const S = window.FLYDIY_STAGE, W = window.FLYDIY_STAGES; if (!S || !W) return null; return { key: S.key, n: S.view && S.view.n, staged: !!(S.view && S.view.staged), kits: S.view ? Object.keys(S.view.kits || {}) : [], host: W.host() ? { composed: W.host().composed, pending: W.host().pending } : null, objs: S.view ? S.view.rec.layers.objects.filter(o => /^sg_/.test(o.id)).length : 0 }; }); if (!got) await page.waitForTimeout(1000); }
    console.log(q, JSON.stringify(got), 'errors:', errs.slice(0, 3));
    await page.close();
  }
  await browser.close(); srv.close();
});
