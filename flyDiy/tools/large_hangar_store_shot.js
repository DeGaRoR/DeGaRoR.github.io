#!/usr/bin/env node
// large_hangar_store_shot.js - DERELICT-HANGAR: THE LARGE HANGAR'S STORED AEROPLANES on the real page (dev.html?career=1,
// the dev career), headless (Chromium + SwiftShader). A career whose main hangar is the large hangar (shell 'works'),
// a shelf of saved builds (three Cubs, a Jodel, a Cessna) stored INSIDE it (HANGAR-STORAGE's slots, the packer deciding
// what stands), and an aeroplane on the stand: the Cub, then the DC-3. Per stand:
//   store_<plane>_page.jpg   the WHOLE page (page.screenshot: the garage's rail, sliders and panels round the room)
//   store_<plane>_hall.jpg   the room from the back wall, high (the page's renderer and scene, a camera of this rig's)
// and store.json: the page's own answers (GARAGE_ENV.residents(): the plan, what did not stand and why; the shed).
//
//   node tools/large_hangar_store_shot.js [--scene store|full] [--out reports/evidence/DERELICT-HANGAR/store] [--w 1600 --h 900]
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports', 'evidence', 'DERELICT-HANGAR', 'store')));
const W = +opt('w', 1600), H = +opt('h', 900), EXPO = +opt('expo', 1.7);
const env = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', f), 'utf8'));
// --scene full: as many small aeroplanes as the floor takes round the Jodel on the stand - three Cubs and three Jodels
// stored, the shed's own `slots` (HANGAR-STORAGE's per-shed hook) raised to 8 inside so the PACKER, not the shell's 4,
// says how many stand (the rest are reported 'no floor left')
const SCENE = opt('scene', 'store'), FULL = SCENE === 'full';
const CUB = 'cub_2026-09-20_corrected.json', JOD = 'jodel_2026-09-20_corrected.json';
const SHELF = FULL
  ? { 'Jolene Cub': env(CUB), 'Spare Cub': env(CUB), 'Club Cub': env(CUB), 'Old Jodel': env(JOD), 'Red Jodel': env(JOD), 'Blue Jodel': env(JOD) }
  : { 'Jolene Cub': env(CUB), 'Spare Cub': env(CUB), 'Club Cub': env(CUB), 'Jodel D9': env(JOD), 'Metal Cessna': env('cessna172_2026-09-20_corrected.json') };
const SLOTS = FULL ? 8 : null;
for (const n of Object.keys(SHELF)) { SHELF[n].name = n; if (SHELF[n].spec && SHELF[n].spec.meta) SHELF[n].spec.meta.name = n; }
const STAND = { cub: 'flyDiy/builds/' + CUB, dc3: 'flyDiy/builds/candidates/dc3_2026-10.json', jodel: 'flyDiy/builds/' + JOD };
const want = opt('planes', FULL ? 'jodel' : 'cub,dc3').split(',');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.css': 'text/css', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, r) => { const p = path.join(REPO, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await ctx.addInitScript(shelf => {
    window.FLYDIY_CLOCKSLICE = false;
    try { if (!sessionStorage.getItem('lhSeeded')) { for (const n of Object.keys(shelf)) localStorage.setItem('flydiy.build.' + n, JSON.stringify(shelf[n])); sessionStorage.setItem('lhSeeded', '1'); } } catch (e) {}
  }, SHELF);
  const t0 = Date.now(), log = s => console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(4) + ' s  ' + s);
  const URL0 = `http://127.0.0.1:${srv.address().port}/flyDiy/dev.html?career=1&audio=0`;
  const boot = async () => {
    await page.waitForFunction(() => window.GARAGE_ENV && window.GARAGE_SPEC && window.FLYDIY_PLAYER && window.GARAGE_ENV._debug &&
      window.BOOT && window.BOOT.state === 'gone', null, { timeout: 900000, polling: 2000 });
    await sleep(3000);
    await page.evaluate(() => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
  };
  await page.goto(URL0, { timeout: 600000 }); await boot(); log('booted (the dev career born)');
  // the main hangar becomes the large hangar, the shelf stored inside it (slot order), then a reload builds the room
  const set = await page.evaluate(({ names, slots }) => {
    const P = window.FLYDIY_PLAYER, d = P.doc();
    d.sheds.HOME = Object.assign({}, d.sheds.HOME, { shell: 'works', dims: Object.assign({}, SHELLS.works.dims) });
    if (slots) d.sheds.HOME.slots = { inside: slots };
    names.forEach((n, i) => { d.fleet[n] = Object.assign({}, d.fleet[n] || {}, { hangar: 'HOME', aero: 'HOME', kind: 'inside', slot: i }); });
    const r = P.set(d);
    return { shell: r.sheds.HOME.shell, fleet: Object.keys(r.fleet).map(n => n + ':' + r.fleet[n].kind + (r.fleet[n].hangar ? '@' + r.fleet[n].hangar : '')) };
  }, { names: Object.keys(SHELF), slots: SLOTS });
  log('set ' + JSON.stringify(set));
  await page.reload({ timeout: 600000 }); await boot(); log('reloaded: shell ' + await page.evaluate(() => window.GARAGE_ENV.shell()));
  const report = { set, stands: [], errors: errs };
  for (const k of want) {
    await page.evaluate(async url => { const r = await fetch('/' + url); const j = await r.json(); window.GARAGE_SPEC.set(j.spec || j); }, STAND[k]);
    log(k + ' on the stand');
    await sleep(10000);
    await page.evaluate(() => window.GARAGE_ENV.residentsSync && window.GARAGE_ENV.residentsSync());
    // every resident that stands decoded from its bake (the fleet's idle path bakes a build never baked)
    const t1 = Date.now();
    let R = null;
    while (Date.now() - t1 < 600000) {
      R = await page.evaluate(() => window.GARAGE_ENV.residents());
      if (R && R.plan.length && R.plan.every(p => p.filled)) break;
      await sleep(3000);
    }
    log('  residents ' + JSON.stringify(R && { how: R.how, plan: R.plan.map(p => p.name + (p.filled ? '' : '(unbaked)')), unplaced: R.unplaced }));
    await page.waitForFunction(() => { const D = window.GARAGE_ENV._debug(); return !!(D.scene && D.scene.environment); }, null, { timeout: 120000, polling: 1000 }).catch(() => log('  (no environment after 120 s)'));
    await sleep(4000);
    const fp = path.join(OUT, `${SCENE}_${k}_page.jpg`);
    await page.screenshot({ path: fp, type: 'jpeg', quality: 86, timeout: 180000 });
    log('  ' + path.basename(fp));
    const url = await page.evaluate(({ W, H, EXPO, k }) => {
      const D = window.GARAGE_ENV._debug(), Rr = D.renderer, S = D.scene, h = D.hangar;
      const g = h.group.position, P = p => new THREE.Vector3(p[0] + g.x, p[1] + g.y, p[2] + g.z);
      const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
      cam.position.copy(P([19, k === 'dc3' ? 10.5 : 8.2, -4])); cam.lookAt(P([-8, 0.6, -2])); cam.updateMatrixWorld();
      const ex0 = Rr.toneMappingExposure, sz = Rr.getSize(new THREE.Vector2()); Rr.toneMappingExposure = ex0 * EXPO;
      Rr.setSize(W, H, false); Rr.render(S, cam); const u = Rr.domElement.toDataURL('image/jpeg', 0.9);
      Rr.toneMappingExposure = ex0; Rr.setSize(sz.x, sz.y, false);
      return u;
    }, { W, H, EXPO, k });
    const fh = path.join(OUT, `${SCENE}_${k}_hall.jpg`);
    fs.writeFileSync(fh, Buffer.from(url.split(',')[1], 'base64'));
    log('  ' + path.basename(fh));
    const info = await page.evaluate(() => { const h = window.GARAGE_ENV._debug().hangar; return { shell: window.GARAGE_ENV.shell(), door: h.door, group: h.group.position.toArray().map(v => +v.toFixed(2)) }; });
    report.stands.push({ stand: k, residents: R, room: info, page: path.basename(fp), hall: path.basename(fh) });
  }
  fs.writeFileSync(path.join(OUT, SCENE + '.json'), JSON.stringify(report, null, 1));
  if (errs.length) console.log('page errors:\n  ' + errs.slice(0, 10).join('\n  '));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
