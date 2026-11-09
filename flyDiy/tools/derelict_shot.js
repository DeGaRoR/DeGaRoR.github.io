#!/usr/bin/env node
// derelict_shot.js - DERELICT-HANGAR: the stills of the derelict hangar, headless (Chromium + SwiftShader, no GPU), off the
// bench (tools/_derelict.html) of THIS tree, served by a small node server. Each still is rendered at `--ss` times its size
// and brought down with a Lanczos filter (python + Pillow, the bakers' own dependency; without them the big one is kept).
//
//   node tools/derelict_shot.js                              # the set: the three reference views + every stage
//   node tools/derelict_shot.js --only front,stage0 --w 1280 --h 720 --ss 1
//   node tools/derelict_shot.js --out /tmp/shots
//
// Writes <out>/<name>.jpg and <out>/shots.json (each still's stage, view, tris, draws, build ms, render calls).
// Default out: reports/evidence/DERELICT-HANGAR/.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const W = +opt('w', 1600), H = +opt('h', 900), SS = +opt('ss', 2);
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports', 'evidence', 'DERELICT-HANGAR')));
const ONLY = opt('only', null) ? opt('only').split(',') : null;
const VIG = +opt('vignette', 0.22);
// the darkroom: down to size with Lanczos, a soft vignette (a lens's falloff, `--vignette 0` for none)
const POST = (src, dst) => `from PIL import Image, ImageChops
im = Image.open(${JSON.stringify(src)}).convert('RGB').resize((${W}, ${H}), Image.LANCZOS)
v = ${VIG}
if v > 0:
    m = Image.radial_gradient('L').resize((${W}, ${H}), Image.BICUBIC)
    m = m.point(lambda p: int(255 * (1 - v * (p / 255.0) ** 2.2)))
    im = ImageChops.multiply(im, Image.merge('RGB', (m, m, m)))
im.save(${JSON.stringify(dst)}, quality=88)`;
const SET = [
  { name: 'ref1_front',    cam: 'front',    stage: 0 },
  { name: 'ref2_far',      cam: 'far',      stage: 0 },
  { name: 'ref3_inside',   cam: 'inside',   stage: 0 },
  { name: 'stage0',        cam: 'stage',    stage: 0 },
  { name: 'stage1',        cam: 'stage',    stage: 1 },
  { name: 'stage2',        cam: 'stage',    stage: 2 },
  { name: 'stage3',        cam: 'stage',    stage: 3 },
  { name: 'detail_flank',  cam: 'flank',    stage: 0 },
  { name: 'detail_roof',   cam: 'roof',     stage: 0 },
  { name: 'detail_graffiti', cam: 'graffiti', stage: 0 },
  { name: 'aerial0',       cam: 'aerial',   stage: 0 },
  { name: 'aerial2',       cam: 'aerial',   stage: 2 },
  { name: 'lod1',          cam: 'far',      stage: 0, lod: 1 },
  { name: 'lod2',          cam: 'far',      stage: 0, lod: 2 },
  { name: 'detail_barriers', cam: 'barriers', stage: 0 },
  { name: 'detail_line',   cam: 'line',     stage: 1 },
  { name: 'night1',        cam: 'night',    stage: 1 },
  { name: 'detail_puddle', cam: 'puddle',   stage: 0 },
].filter(s => !ONLY || ONLY.includes(s.name) || ONLY.includes(s.cam));
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.join(REPO, decodeURIComponent(q.url.split('?')[0]));
      if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}
(async () => {
  const { chromium } = require('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W * SS, height: H * SS } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/flyDiy/tools/_derelict.html?shot=1&w=${W * SS}&h=${H * SS}`, { timeout: 180000 });
  await page.waitForFunction(() => window.BENCH, null, { timeout: 120000 });
  const log = [];
  for (const s of SET) {
    const t0 = Date.now();
    const r = await page.evaluate(o => window.BENCH.shoot(o), Object.assign({ w: W * SS, h: H * SS }, s));
    const big = path.join(OUT, s.name + '_raw.jpg'), fin = path.join(OUT, s.name + '.jpg');
    fs.writeFileSync(big, Buffer.from(r.url.split(',')[1], 'base64'));
    if (SS > 1 || VIG > 0) {
      const py = cp.spawnSync('python3', ['-c', POST(big, fin)]);
      if (py.status === 0) fs.unlinkSync(big); else fs.renameSync(big, fin);
    }
    const st = r.stats;
    log.push({ name: s.name, cam: s.cam, stage: st.stage, stageName: st.stageName, lod: s.lod || 0, tris: st.tris, draws: st.draws, calls: r.calls, pendingMaps: r.pendingMaps, ms: Date.now() - t0 });
    console.log(s.name.padEnd(16), r.line.split('\n')[0], ' calls', r.calls, ' pending maps', r.pendingMaps, ' ', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ w: W, h: H, ss: SS, shots: log, errors: errs }, null, 1));
  if (errs.length) console.log('page errors:\n  ' + errs.slice(0, 12).join('\n  '));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
