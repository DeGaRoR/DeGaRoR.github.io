#!/usr/bin/env node
// surface_shot.js - THE STRIP-SURFACE EVIDENCE (G1375): the garage's route pickers, before and after, headless
//
// Two pages served side by side from the repo root: master's committed index.html copied beside the built one as
// flyDiy/_ev_before.html (same folder, so every media fetch is the same file), and today's index.html. Each is loaded
// with a build in flydiy.wip and a saved route in flydiy.route, the garage left to come up, and the two pickers beside
// ROLL OUT (#edRoute) shot with their lists EXPANDED IN PLACE (select.size = N: a native drop-down does not paint in a
// headless screenshot). SwiftShader (software GL) - this is UI, nothing here depends on the GPU.
//
//   git show <base>:flyDiy/index.html > flyDiy/_ev_before.html
//   node tools/build.js && node tools/surface_shot.js --out=reports/evidence/G1375 [--port=8126]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const opt = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/G1375'));
const PORT = +opt('port', 8126);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BUILDS = {
  cub: fs.readFileSync(path.join(__dirname, 'perf', 'garage_lag_cub_wip.json'), 'utf8'),
  floats: JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'bugReports', 'cessnaFloatsWOrks.json'), 'utf8')).spec),
};
// [page, build, saved route, shot name]
const RUNS = (opt('runs', '') ? opt('runs', '').split(',') : ['before:cub', 'after:cub', 'before:floats', 'after:floats']).map(s => s.split(':'));
const PAGES = { before: '_ev_before.html', after: 'index.html' };
const ROUTE = { cub: { from: 'HOME', dest: 'SEA' }, floats: { from: 'HOME', dest: 'A3' } };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = cp.spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  await sleep(1000);
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  for (const [pg, bk] of RUNS) {
    const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    // THE SHOT'S PAUSE: the page draws its whole scene in software every frame and a screenshot waits behind it (30 s
    // timeouts, measured); while __evHold is set, frames are queued, and released after the shot (the loop resumes)
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window), Q = [];
      window.requestAnimationFrame = cb => { if (window.__evHold) { Q.push(cb); return 0; } return raf(cb); };
      window.__evRelease = () => { window.__evHold = false; Q.splice(0).forEach(cb => raf(cb)); return 1; };
    });
    await page.addInitScript(([wip, route]) => {
      try {
        if (sessionStorage.getItem('__ev')) return; sessionStorage.setItem('__ev', '1');
        localStorage.clear();
        localStorage.setItem('flydiy.wip', wip);
        localStorage.setItem('flydiy.route', route);
        localStorage.setItem('flydiy.flPanels', JSON.stringify({ map: true, big: true }));   // --fly: the map up, big (its labels)
      } catch (e) {}
    }, [BUILDS[bk], JSON.stringify(ROUTE[bk])]);
    // three tries, 60 s each: a software frame already under way when the hold is set can outlast one
    const held = async fn => { for (let k = 0; k < 3; k++) { await ev('window.__evHold = true', 0); await sleep(3000); let done = false;
      try { await fn(); done = true; } catch (e) { console.log('  shot (try ' + (k + 1) + '): ' + e.message.split('\n')[0]); }
      await ev('window.__evRelease && window.__evRelease()', 0); if (done) return true; await sleep(5000); } return false; };
    const ev = async (expr, d) => { try { return await page.evaluate(expr); } catch (e) { return d === undefined ? 'ERR ' + e.message.split('\n')[0] : d; } };
    await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/' + PAGES[pg], { waitUntil: 'load', timeout: 240000 });
    let ok = false;
    for (let i = 0; i < 240 && !ok; i++) {
      await sleep(2000);
      // the first boot's chooser, should it ask: keep the build the wip holds
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()", 0);
      ok = (await ev("(()=>{const h=document.getElementById('edRoute'); const s=h&&h.querySelectorAll('select'); return !!(s&&s.length===2&&s[0].options.length>1&&h.offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone');})()", false)) === true;
    }
    console.log(pg + ' ' + bk + ': garage ' + (ok ? 'up' : 'NOT up') + ' after ' + el() + (errs.length ? ' (' + errs.length + ' page errors: ' + errs[0] + ')' : ''));
    if (!ok) { await held(() => page.screenshot({ path: path.join(OUT, '_fail_' + pg + '_' + bk + '.jpg'), type: 'jpeg', quality: 60 })); await ctx.close(); continue; }
    await sleep(4000);
    // the pickers re-read the bench's gear before a pick (pointerenter; the before page has no listener), then open in place
    const info = await ev(`(()=>{
      const h = document.getElementById('edRoute'), S = [...h.querySelectorAll('select')];
      for (const s of S) s.dispatchEvent(new Event('pointerenter'));
      const read = S.map(s => ({ value: s.value, opts: [...s.options].map(o => (o.disabled ? '[x] ' : '') + o.textContent) }));
      for (const s of S) { s.size = Math.min(s.options.length, 16); s.style.maxWidth = 'none'; s.style.height = 'auto'; s.style.position = 'relative'; s.style.zIndex = 50; }
      h.style.alignItems = 'flex-start';
      const acts = document.getElementById('edActs'); if (acts) acts.style.zIndex = 9999;   // above the editor's pane, which the left list runs under
      // lift the bar above the scene so the expanded lists are not clipped by its own box
      let p = h; while (p && p !== document.body) { p.style.overflow = 'visible'; p = p.parentElement; }
      const r = h.getBoundingClientRect();
      return JSON.stringify({ read, box: [r.left, r.top, r.width, r.height] });
    })()`);
    await sleep(500);
    let I = null; try { I = JSON.parse(info); } catch (e) { console.log('  ' + info); }
    if (I) {
      for (const [i, s] of I.read.entries()) console.log('  ' + (i ? 'to  ' : 'from') + ' = ' + s.value + ' | ' + s.opts.join(' | '));
      const box = await ev(`(()=>{ const h = document.getElementById('edRoute'); const r = h.getBoundingClientRect(); let [l, t, rr, b] = [r.left, r.top, r.right, r.bottom];
        for (const s of h.querySelectorAll('select')) { const q = s.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); rr = Math.max(rr, q.right); b = Math.max(b, q.bottom); }
        return JSON.stringify([l, t, rr, b]); })()`);
      const [l, t, r, b] = JSON.parse(box);
      const clip = { x: Math.max(0, l - 12), y: Math.max(0, t - 12), width: Math.min(1600, r + 12) - Math.max(0, l - 12), height: Math.min(900, b + 12) - Math.max(0, t - 12) };
      await held(() => page.screenshot({ path: path.join(OUT, pg + '_' + bk + '_pickers.jpg'), type: 'jpeg', quality: 80, clip, timeout: 60000 }));
      fs.writeFileSync(path.join(OUT, pg + '_' + bk + '_pickers.txt'), I.read.map((s, i) => (i ? 'to  ' : 'from') + ' = ' + s.value + '\n  ' + s.opts.join('\n  ')).join('\n') + '\n');
    }
    // --fly: ROLL OUT - the roll-out screen's picker (#bootRoute), then the flight's map, big (labels on)
    if (process.argv.includes('--fly')) {
      await ev("(()=>{const b=document.getElementById('edRoll'); if(b) b.click(); return !!b;})()");
      let bootShot = false, mapShot = false;
      for (let i = 0; i < 300 && !mapShot; i++) {
        await sleep(2000);
        if (!bootShot && (await ev("(()=>{const h=document.getElementById('bootRoute'); return !!(h && !h.hidden && h.offsetParent && h.querySelectorAll('select').length===2);})()", false)) === true) {
          await sleep(1500);
          await ev(`(()=>{ const h = document.getElementById('bootRoute'); for (const s of h.querySelectorAll('select')) { s.size = Math.min(s.options.length, 16); s.style.maxWidth = 'none'; } return 1; })()`);
          await sleep(300);
          const bh = await page.$('#bootRoute');
          if (bh) { await held(() => bh.screenshot({ path: path.join(OUT, pg + '_' + bk + '_rollout.jpg'), type: 'jpeg', quality: 80, timeout: 60000 })); bootShot = true; console.log('  roll-out picker shot ' + el()); }
        }
        if ((await ev("(()=>{const m=document.getElementById('mmp'); return !!(m && !m.hidden && m.offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone');})()", false)) === true) {
          // the map paints on the HUD cadence; two clicks (big off, big on) each call drawMap() itself
          await sleep(8000);
          await ev("(()=>{const c=document.getElementById('mm'); c.click(); c.click(); return c.width;})()", 0);
          await sleep(1500);
          const m = await page.$('#mm');
          if (m) { await held(() => m.screenshot({ path: path.join(OUT, pg + '_' + bk + '_map.jpg'), type: 'jpeg', quality: 78, timeout: 60000 })); mapShot = true; console.log('  map shot ' + el()); }
        }
      }
      if (!mapShot) { console.log('  no flight map after ' + el()); await held(() => page.screenshot({ path: path.join(OUT, '_fail_fly_' + pg + '_' + bk + '.jpg'), type: 'jpeg', quality: 60 })); }
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
