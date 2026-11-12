#!/usr/bin/env node
// scene_shot.js - A SCENE FILE -> A PICTURE, HEADLESS (PHOTO-MODE-2 P5, 2026-11-12). The one rig instead of the copied
// staging code (tools/PHOTO.md §3): the page's own loader (window.SCENE.apply - the roll-out AWAITED, the pose, the camera,
// the world round the eye, the checks) and the page's own shot (SCENE.shoot - the picture slot's size, the high-quality
// steps, the scene inside the PNG). It writes <out>.png and <out>.report.json, and exits non-zero on any check unless
// --draft. How-to and pitfalls: tools/PHOTO.md.
//
//   node tools/scene_shot.js <a.scene.json> [<b.scene.json> ...] [--out <dir> | -o <file.png>]
//        [--gpu]                 the real GPU (a LOCAL session on A0's box: tools/perf/boxlock.sh take gpu <who>); default:
//                                SwiftShader (the cloud's software GL - the world draws dark and slowly; shed scenes are fine)
//        [--draft]               write the picture whatever the checks say
//        [--check]               also shoot the frame with the aeroplane hidden and require it to differ (the plane is IN it)
//        [--size 1600x900]       the browser window (the picture's own size is the scene's quality.output, else this)
//        [--profile phone]       the phone's garage page (shed scenes only; the fastest boot in the cloud)
//        [--page index.html]     or dev.html
//        [--gfx gamer]           the graphics preset of the page (default: the software rung decides; --gpu: gamer)
//        [--hq | --no-hq]        force the high-quality picture on / off (default: the scene's quality.hq)
//        [--timeout 1800]        seconds for the whole run, per scene
//   node tools/scene_shot.js --capture <out.scene.json> [--rollout] [--name "..."]   the page's scene AS IT BOOTS (the shed;
//        --rollout: after the roll-out, held) written to a file - the start of a scene you then edit
'use strict';
const fs = require('fs'), path = require('path'), net = require('net');
const { spawn } = require('child_process');
const FLY = path.join(__dirname, '..'), ROOT = path.join(FLY, '..');
const argv = process.argv.slice(2);
const flag = k => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const files = argv.filter((a, i) => !a.startsWith('-') && !(i > 0 && /^--?(out|o|size|profile|page|gfx|timeout|capture|name)$/.test(argv[i - 1])));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = require(path.join(__dirname, 'flight_core.js'));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
function chromium() {
  try { return require('playwright').chromium; } catch (e) {}
  try { const g = require('child_process').execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); return require(path.join(g, 'playwright')).chromium; } catch (e) {}
  throw new Error('playwright is not installed here (the cloud has it pre-installed; locally: npm i -g playwright)');
}

async function openPage(o) {
  const port = await freePort();
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), ROOT], { stdio: 'ignore' });
  await sleep(700);
  const args = ['--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];
  if (!o.gpu) args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  if (process.platform === 'linux') args.push('--no-sandbox', '--disable-dev-shm-usage');
  const b = await chromium().launch({ headless: !o.gpu, args });
  const [w, h] = (o.size || '1600x900').split('x').map(Number);
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, acceptDownloads: false });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e).slice(0, 300)));
  const q = ['intro=0', 'idle=0', 'welcome=0', 'mode=sandbox'];
  if (o.profile === 'phone') q.push('profile=phone');
  if (o.gfx) q.push('gfx=' + o.gfx); else if (o.gpu) q.push('gfx=gamer');
  const url = 'http://localhost:' + port + '/flyDiy/' + (o.page || 'index.html') + '?' + q.join('&');
  const t0 = Date.now();
  await page.goto(url, { timeout: 180000 });
  for (;;) {
    const st = await page.evaluate(() => (window.BOOT ? window.BOOT.state : null) + '|' + !!window.SCENE).catch(() => 'null|false');
    if (st === 'gone|true') break;
    if (Date.now() - t0 > (o.timeout || 1800) * 1000) throw new Error('the page never finished loading (' + st + ')');
    await sleep(3000);
  }
  await page.evaluate(() => window.SCENE.ready(600000));
  return { b, page, srv, errors, bootS: Math.round((Date.now() - t0) / 1000), close: async () => { try { await b.close(); } catch (e) {} try { srv.kill(); } catch (e) {} } };
}

// the page's frame with the aeroplane hidden must differ from the one with it: the share of pixels that moved
async function hiddenDiff(page) {
  return page.evaluate(async () => {
    // the build's roots: the flight's drawn craft and the shed's cage scene (plane_shot.js's assert 6) - whichever there are
    const FP = window.FLIGHT_PROBE, roots = [FP && FP.craft ? FP.craft() : null, window.CAGE_UI_SCENE || null].filter(Boolean);
    if (!roots.length) return null;
    const shot = async () => { const r = await window.SCENE.shoot({ output: null, hq: false }); const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + r.png)).blob());
      const c = document.createElement('canvas'); c.width = 320; c.height = Math.round(320 * im.height / im.width); const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); return x.getImageData(0, 0, c.width, c.height).data; };
    const a = await shot(); const v = roots.map(r => r.visible); roots.forEach(r => { r.visible = false; });
    let b; try { b = await shot(); } finally { roots.forEach((r, i) => { r.visible = v[i]; }); }
    let moved = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) moved++;
    return moved / (a.length / 4);
  });
}

async function capture() {
  const out = opt('capture');
  const P = await openPage({ gpu: flag('gpu'), size: opt('size'), profile: opt('profile'), page: opt('page'), gfx: opt('gfx'), timeout: +opt('timeout', 1800) });
  try {
    if (flag('rollout')) await P.page.evaluate(async () => { const b = document.getElementById('bGo'); if (b) b.click();
      const t0 = performance.now(); for (;;) { const T = window.FLYDIY_TRIPS, t = T && T[T.length - 1]; if (t && t.kind === 'rollout' && t.done && window.BOOT.state === 'gone') break; if (performance.now() - t0 > 900000) throw new Error('no roll-out'); await new Promise(r => setTimeout(r, 1000)); }
      document.getElementById('bPause').click(); await window.SCENE.ready(); });
    const sc = await P.page.evaluate(n => window.SCENE.get(n), opt('name', path.basename(out).replace(/\.scene\.json$|\.json$/, '')));
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(sc, null, 2) + '\n');
    console.log(out + ': a ' + sc.site + ' scene (' + (Buffer.byteLength(JSON.stringify(sc)) / 1024).toFixed(1) + ' KB), booted in ' + P.bootS + ' s');
  } finally { await P.close(); }
}

async function shootOne(file, outPng) {
  const text = fs.readFileSync(file, 'utf8'), N = C.sceneNormalise(text);
  if (!N.ok) { console.log(file + ': REFUSED - ' + N.errors.join('; ')); return 1; }
  const S = N.scene, t0 = Date.now();
  const P = await openPage({ gpu: flag('gpu'), size: opt('size'), profile: opt('profile') || (S.site === 'garage' && !flag('gpu') ? 'phone' : null), page: opt('page'), gfx: opt('gfx'), timeout: +opt('timeout', 1800) });
  const R = { scene: S.name || path.basename(file), file, gpu: flag('gpu'), bootS: P.bootS };
  let bad = 0;
  try {
    R.apply = await P.page.evaluate(sc => window.SCENE.apply(sc), S);
    const hq = flag('hq') ? true : flag('no-hq') ? false : !!(S.quality && S.quality.hq);
    const r = await P.page.evaluate(o => window.SCENE.shoot(o), { output: (S.quality && S.quality.output) || null, hq, name: S.name });
    fs.mkdirSync(path.dirname(path.resolve(outPng)), { recursive: true });
    fs.writeFileSync(outPng, Buffer.from(r.png, 'base64'));
    Object.assign(R, { png: outPng, w: r.w, h: r.h, shotMs: r.ms, notes: r.notes, warnings: (R.apply.warnings || []).concat(r.warnings || []) });
    if (flag('check')) { R.hiddenDiff = await hiddenDiff(P.page); if (R.hiddenDiff != null && R.hiddenDiff < 0.002) R.warnings.push('the aeroplane is not in the picture (' + (R.hiddenDiff * 100).toFixed(2) + ' % of the pixels change without it)'); }
    // the picture keeps its scene (scene.js get)
    const back = C.scenePngGet(new Uint8Array(fs.readFileSync(outPng)));
    if (!back) R.warnings.push('the picture does not carry its scene');
  } catch (e) { R.error = String(e && e.message || e); bad++; }
  R.pageErrors = P.errors.slice(0, 10);
  R.totalS = Math.round((Date.now() - t0) / 1000);
  await P.close();
  const real = (R.warnings || []).filter(w => !/control surfaces and the prop/.test(w));
  if (real.length && !flag('draft')) bad++;
  fs.writeFileSync(outPng.replace(/\.png$/i, '') + '.report.json', JSON.stringify(R, null, 2) + '\n');
  console.log((bad ? 'FAIL ' : 'ok   ') + file + ' -> ' + (R.png || '(no picture)') + (R.w ? ' ' + R.w + 'x' + R.h : '') + ', ' + R.totalS + ' s' + (R.error ? ' - ' + R.error : '') + (real.length ? ' - ' + real.join('; ') : ''));
  return bad;
}

async function main() {
  if (opt('capture')) return capture();
  if (!files.length) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 24).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(2); }
  const single = opt('o', null), dir = opt('out', path.join(FLY, 'screenshots', 'scenes'));
  let bad = 0;
  for (const f of files) bad += await shootOne(f, single && files.length === 1 ? single : path.join(dir, path.basename(f).replace(/\.scene\.json$|\.json$/, '') + '.png'));
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error('scene_shot.js: ' + (e && e.stack || e)); process.exit(2); });
