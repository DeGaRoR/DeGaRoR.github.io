#!/usr/bin/env node
// update_shot.js - THE "UPDATE" PILL, PICTURED (UPDATE-NOW, G1539). The real page (index.html, served by
// tools/_serve.js) in headless Chromium, version.json answered by the rig with a NEWER build (route interception - the
// file on disk is not touched), ?update=1 (the pill stays off for a rig otherwise) and ?welcome=1 (the welcome screen
// even for a rig). One PNG per screen, at a desktop and a phone size: the welcome card (its footer's build stamp), the
// loading screen (the stamp under the brand), the garage, the flight. A software renderer (SwiftShader) draws the 3D:
// slow, and the look is not the point - where the pill sits over each screen is.
//
//   node tools/_serve.js 8125 &   node tools/update_shot.js [--out reports/evidence/UPDATE-NOW] [--port 8125]
//        [--sizes desktop,phone] [--screens welcome,loading,garage,flight,menu] [--wait 240000]
//   (playwright: NODE_PATH=$(npm root -g); the browser: PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM=<path>)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('update_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/UPDATE-NOW'));
const PORT = +opt('port', 8125), WAIT = +opt('wait', 240000);
const SIZES = opt('sizes', 'desktop,phone').split(','), SCREENS = opt('screens', 'welcome,loading,garage,flight,menu').split(',');
const NEWER = 'f00dcafe1535';
const DEV = { desktop: { viewport: { width: 1600, height: 900 } },
              phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
                       userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = process.env.CHROMIUM || undefined;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const index = [];
  for (const size of SIZES) {
    const ctx = await browser.newContext(DEV[size]);
    const pg = await ctx.newPage();
    pg.on('pageerror', e => console.log('  [' + size + '] page error: ' + String(e.message || e).slice(0, 160)));
    await pg.route('**/version.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ build: NEWER, date: '2026-10-05T09:00:00.000Z' }) }));
    const shot = async (name, note) => {
      const f = 'update_' + size + '_' + name + '.png';
      await pg.screenshot({ path: path.join(OUT, f), timeout: 180000 });
      const st = await pg.evaluate(() => { const p = document.getElementById('updNow'), b = p && p.getBoundingClientRect();
        return { pill: !!(p && !p.hidden), box: b ? [b.left, b.top, b.width, b.height].map(Math.round) : null,
                 stamp: (document.getElementById('bootBuild') || {}).textContent || null, url: location.href }; });
      index.push(Object.assign({ size, name, file: f, note }, st));
      console.log('  ' + f + '  pill ' + st.pill + ' ' + JSON.stringify(st.box) + '  ' + note);
    };
    const until = async (fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn, arg)) return true; } catch (e) {} await sleep(500); } return false; };
    const url = 'http://127.0.0.1:' + PORT + '/flyDiy/index.html?welcome=1&update=1&audio=0&gfx=potato';
    await pg.goto(url, { waitUntil: 'domcontentloaded' });
    await until(() => !!document.getElementById('updNow') && !!document.getElementById('welcome'), 20000);
    if (SCREENS.includes('welcome')) await shot('welcome', size === 'phone' ? 'the device gate (a phone), its footer stamped' : 'the welcome card, its footer stamped');
    // past the welcome: Play (or the gate's "try anyway")
    await pg.evaluate(() => { const b = document.querySelector('#welcome .wplay') || [...document.querySelectorAll('#welcome .wlink')].find(x => /try anyway/.test(x.textContent)); if (b) b.click(); });
    await until(() => { const b = document.getElementById('boot'); return b && !b.hidden && !document.getElementById('welcome'); }, 20000);
    await sleep(1500);
    if (SCREENS.includes('loading')) await shot('loading', 'the loading screen: the build under the brand');
    if (!SCREENS.includes('garage') && !SCREENS.includes('flight')) { await ctx.close(); continue; }
    const t0 = Date.now();
    const up = await until(() => { const b = document.getElementById('boot'); return !!(b && (b.hidden || b.classList.contains('gone'))) && !!window.GARAGE_SPEC; }, WAIT);
    console.log('  [' + size + '] garage ' + (up ? 'up' : 'NOT up') + ' after ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    // the first visit's "new aeroplane" chooser: keep the current build (rollout_shots.js's way)
    for (let i = 0; i < 6; i++) { const n = await pg.evaluate(() => { const l = [...document.querySelectorAll('button,a,div')].filter(b => /keep the current build/i.test(b.textContent || '') && b.children.length === 0 && b.offsetParent); l.forEach(x => x.click()); return l.length; }); await sleep(500); if (!n && i > 2) break; }
    await sleep(4000);
    if (up && SCREENS.includes('garage')) await shot('garage', 'the garage (the shed\'s panel stamps the build at its foot)');
    if (up && SCREENS.includes('flight')) {
      await pg.evaluate(() => { const g = document.getElementById('bGo'); const l = [...document.querySelectorAll('button')].filter(b => /roll out|fly/i.test(b.textContent) && b.offsetParent);
        const b = g && g.offsetParent ? g : l[0]; if (b) b.click(); });
      const t1 = Date.now();
      const fl = await until(() => { const p = document.getElementById('pfd'); const b = document.getElementById('boot');
        return !!(p && p.offsetParent && (!b || b.hidden || b.classList.contains('gone'))); }, WAIT);
      console.log('  [' + size + '] flight ' + (fl ? 'up' : 'NOT up') + ' after ' + ((Date.now() - t1) / 1000).toFixed(0) + ' s');
      await sleep(5000);
      if (!fl) await shot('flight_notup', 'the flight did not come up in time - the screen as it was');
      if (fl) await shot('flight', 'in flight: the pill in the right column above the verbs, clear of the instruments');
      if (fl && SCREENS.includes('menu')) {   // the GRAPHICS flyout: its storage row carries the build and its date
        await pg.evaluate(() => { const b = [...document.querySelectorAll('.flRailBtn')].find(x => /graphics/i.test(x.textContent)); if (b) b.click(); });
        await sleep(1500);
        await pg.evaluate(() => { const n = [...document.querySelectorAll('#flFly *')].find(x => /^build [0-9a-f]{8}/.test(x.textContent || '') && x.children.length === 0); if (n) n.scrollIntoView({ block: 'center' }); });
        await sleep(800);
        await shot('menu', 'the GRAPHICS menu: the storage row names the build and its date');
      }
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ newer: NEWER, shots: index }, null, 1) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
