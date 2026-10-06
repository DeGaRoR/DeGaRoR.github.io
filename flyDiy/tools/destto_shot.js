#!/usr/bin/env node
// destto_shot.js - THE DEST-TO EVIDENCE (G1945): the route UI before and after, headless (surface_shot.js's rig, G1375)
//
// Two pages served side by side from the repo root: master's committed index.html copied beside the built one as
// flyDiy/_ev_before.html, and today's index.html. Each boots with the user's Cub in flydiy.wip and the SAME saved v1
// route ({ from: 'HOME', dest: 'w3' } - the pref the new page migrates), and is shot at three places:
//   garage   the pickers beside ROLL OUT (#edRoute), their lists expanded in place (select.size = N)
//   rollout  the roll-out screen's picker (#bootRoute)
//   flight   the flight plate's `route` flyout (#flFly) and the plate's trip line (text), the flight running
// SwiftShader (software GL) - this is UI; --nogl hides the scene's canvases for the DOM shots (a software readback
// stalls a screenshot past 60 s).
//
//   git show origin/master:flyDiy/index.html > flyDiy/_ev_before.html
//   node tools/build.js && node tools/destto_shot.js --out=reports/evidence/DEST-TO [--runs=before,after] [--nogl]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const opt = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/DEST-TO'));
const PORT = +opt('port', 8127);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WIP = fs.readFileSync(path.join(__dirname, 'perf', 'garage_lag_cub_wip.json'), 'utf8');
const RUNS = opt('runs', 'before,after').split(',');
const PAGES = { before: '_ev_before.html', after: 'index.html' };
const ROUTE = JSON.stringify({ from: 'HOME', dest: 'w3' });
const NOGL = process.argv.includes('--nogl');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = cp.spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  await sleep(1000);
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  const notes = [];
  for (const pg of RUNS) {
    const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
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
        localStorage.setItem('flydiy.flManual', '0');
      } catch (e) {}
    }, [WIP, ROUTE]);
    const ev = async (expr, d) => { try { return await page.evaluate(expr); } catch (e) { return d === undefined ? 'ERR ' + e.message.split('\n')[0] : d; } };
    const held = async fn => { for (let k = 0; k < 3; k++) { await ev('window.__evHold = true', 0); await sleep(3000); let done = false;
      try { await fn(); done = true; } catch (e) { console.log('  shot (try ' + (k + 1) + '): ' + e.message.split('\n')[0]); }
      await ev('window.__evRelease && window.__evRelease()', 0); if (done) return true; await sleep(5000); } return false; };
    const nogl = async on => { if (NOGL) await ev("(()=>{ for (const c of document.querySelectorAll('canvas')) c.style.visibility = " + (on ? "'hidden'" : "''") + "; document.body.style.background = " + (on ? "'#2a2622'" : "''") + "; return 1; })()", 0); };
    // the pickers' words, as a list (the shot's text twin)
    const read = sel => ev(`(()=>{ const h = document.querySelector(${JSON.stringify(sel)}); if (!h) return null;
      return JSON.stringify([...h.querySelectorAll('label, .fr')].map(l => { const s = l.querySelector('select'), k = l.querySelector('span');
        return (k ? k.textContent : '') + ': ' + (s ? s.value + ' | ' + [...s.options].map(o => (o.disabled ? '[x] ' : '') + o.textContent).join(' | ') : l.textContent.slice(k ? k.textContent.length : 0).replace(/\\s+/g, ' ').trim()); })); })()`, null);
    await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/' + PAGES[pg], { waitUntil: 'load', timeout: 240000 });
    let ok = false;
    for (let i = 0; i < 300 && !ok; i++) {
      await sleep(2000);
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()", 0);
      ok = (await ev("(()=>{const h=document.getElementById('edRoute'); const s=h&&h.querySelectorAll('select'); return !!(s&&s.length>=1&&s[s.length-1].options.length>1&&h.offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone');})()", false)) === true;
    }
    console.log(pg + ': garage ' + (ok ? 'up' : 'NOT up') + ' after ' + el() + (errs.length ? ' (' + errs.length + ' page errors: ' + errs[0] + ')' : ''));
    if (!ok) { await ctx.close(); continue; }
    await sleep(3000);
    // GARAGE: the pickers, expanded in place
    const gw = await read('#edRoute');
    await ev(`(()=>{ const h = document.getElementById('edRoute');
      for (const s of h.querySelectorAll('select')) { s.size = Math.min(s.options.length, 16); s.style.maxWidth = 'none'; s.style.height = 'auto'; s.style.position = 'relative'; s.style.zIndex = 50; }
      h.style.alignItems = 'flex-start'; const acts = document.getElementById('edActs'); if (acts) acts.style.zIndex = 9999;
      let p = h; while (p && p !== document.body) { p.style.overflow = 'visible'; p = p.parentElement; } return 1; })()`);
    await sleep(500);
    const box = JSON.parse(await ev(`(()=>{ const h = document.getElementById('edRoute'); const r = h.getBoundingClientRect(); let [l, t, rr, b] = [r.left, r.top, r.right, r.bottom];
      for (const s of h.querySelectorAll('select, b')) { const q = s.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); rr = Math.max(rr, q.right); b = Math.max(b, q.bottom); }
      return JSON.stringify([l, t, rr, b]); })()`));
    const clip = { x: Math.max(0, box[0] - 12), y: Math.max(0, box[1] - 12), width: Math.min(1600, box[2] + 12) - Math.max(0, box[0] - 12), height: Math.min(900, box[3] + 12) - Math.max(0, box[1] - 12) };
    await nogl(true);
    await held(() => page.screenshot({ path: path.join(OUT, pg + '_garage.jpg'), type: 'jpeg', quality: 82, clip, timeout: 60000 }));
    await nogl(false);
    await ev(`(()=>{ for (const s of document.querySelectorAll('#edRoute select')) { s.size = 0; s.style.height = ''; } return 1; })()`);
    notes.push(pg + ' garage #edRoute: ' + (gw || 'null'));
    // ROLL OUT: the roll-out screen's picker, then the flight
    await ev("(()=>{const b=document.getElementById('edRoll'); if(b) b.click(); return !!b;})()");
    let bootShot = false, flying = false;
    for (let i = 0; i < 400 && !flying; i++) {
      await sleep(2000);
      if (!bootShot && (await ev("(()=>{const h=document.getElementById('bootRoute'); return !!(h && !h.hidden && h.offsetParent && h.querySelectorAll('select').length>=1);})()", false)) === true) {
        await sleep(1500);
        const bw = await read('#bootRoute');
        notes.push(pg + ' roll-out #bootRoute: ' + (bw || 'null'));
        const bh = await page.$('#bootRoute');
        if (bh) { await held(() => bh.screenshot({ path: path.join(OUT, pg + '_rollout.jpg'), type: 'jpeg', quality: 82, timeout: 60000 })); bootShot = true; console.log('  roll-out picker shot ' + el()); }
      }
      flying = (await ev("(()=>!!(document.getElementById('flPlate') && document.getElementById('flPlate').offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'))()", false)) === true;
    }
    if (!flying) { console.log('  no flight screen after ' + el()); await ctx.close(); continue; }
    // the flight going: Fly the circuit, a few seconds, then the plate's route flyout
    await sleep(4000);
    await ev("(()=>{ const g = document.getElementById('bGo'); if (g && g.offsetParent && !/roll out/i.test(g.textContent)) g.click(); return 1; })()");
    await sleep(15000);
    await ev(`(()=>{ const b = document.querySelector('#flSlots .flSlot[data-s="route"]'); if (b) b.click(); return !!b; })()`);
    await sleep(2500);
    const fw = await read('#flFly');
    const trip = await ev("(()=>{ const r = document.getElementById('flRouteV'); return r ? r.textContent : null; })()", null);
    const st = await ev("JSON.stringify({ route: window.FLYDIY_ROUTE ? FLYDIY_ROUTE.get() : null, phase: window.FLIGHT_PROBE && FLIGHT_PROBE.ap() ? FLIGHT_PROBE.ap().phase : null, pref: localStorage.getItem('flydiy.route') })", null);
    notes.push(pg + ' flight #flFly: ' + (fw || 'null'));
    notes.push(pg + ' flight trip line: ' + trip);
    notes.push(pg + ' state: ' + st);
    await nogl(true);
    const fly = await page.$('#flFly');
    if (fly) await held(() => fly.screenshot({ path: path.join(OUT, pg + '_flight_route.jpg'), type: 'jpeg', quality: 82, timeout: 60000 }));
    await nogl(false);
    console.log('  flight shots ' + el() + (errs.length ? ' (' + errs.length + ' page errors: ' + errs.slice(0, 3).join(' / ') + ')' : ''));
    if (errs.length) notes.push(pg + ' page errors: ' + errs.join(' / '));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'ui_before_after.txt'), notes.join('\n') + '\n');
  console.log(notes.join('\n'));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
