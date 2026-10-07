#!/usr/bin/env node
// welcome_modes_shot.js - THE MODE MENU, PICTURED AND PROBED (WELCOME-MODES, G2212). The real page (index.html, served by
// tools/_serve.js) in headless Chromium on SwiftShader, loaded the way a player loads it: under a hostname that is not
// localhost (Chromium's --host-resolver-rules maps flydiy.test to the server) and with a browser's own user agent and
// navigator.webdriver off, so welcome.js takes the real-host path with NO forcing flag. One still per state, and the page's
// own answers beside it (FLYDIY_MODE, whether FLYDIY_WELCOME held the load, the menu's rows and their sizes):
//   first_card    a first visit: the graphics card comes first ("Use <preset>")
//   first_menu    ...then the menu
//   menu          a second visit (the card remembered): the menu at once
//   settings      the menu's Settings: the card again, with "back"
//   sandbox_go    Sandbox pressed: the menu gone, the loading screen, FLYDIY_MODE 'sandbox'
//   mode_sandbox  ?mode=sandbox: no screen, the loading screen at once (the same path as today's returning visit)
//   mode_garage   ?mode=garage: not built yet -> the sandbox, said in the console
//   localhost     127.0.0.1 with the headless browser's own navigator (a rig): no screen, FLYDIY_MODE 'sandbox'
//   phone_menu    a phone (390 x 844, touch): the device gate's "try anyway", then the menu
//
//   node tools/_serve.js 8125 &   node tools/welcome_modes_shot.js [--out reports/evidence/WELCOME-MODES] [--port 8125]
//   (playwright: NODE_PATH=$(npm root -g); the browser: PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM=<path>)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('welcome_modes_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/WELCOME-MODES'));
const PORT = +opt('port', 8125), PAGE = opt('page', 'index.html');
const HOST = 'http://flydiy.test:' + PORT + '/flyDiy/' + PAGE, LOCAL = 'http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE;
const UA_DESK = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const DEV = { desktop: { viewport: { width: 1600, height: 900 }, userAgent: UA_DESK },
              phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_PHONE },
              rig: { viewport: { width: 1600, height: 900 } } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, ignoreDefaultArgs: ['--enable-automation'],
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP flydiy.test 127.0.0.1',
           '--disable-blink-features=AutomationControlled'] });
  const index = [], fails = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); };
  const state = pg => pg.evaluate(() => {
    const o = document.getElementById('welcome');
    const rows = [...document.querySelectorAll('#welcome .wmode')].map(b => { const r = b.getBoundingClientRect();
      return { mode: b.dataset.mode, disabled: b.disabled, text: b.textContent.replace(/\s+/g, ' ').trim(), w: Math.round(r.width), h: Math.round(r.height), title: b.getAttribute('title') }; });
    return { mode: window.FLYDIY_MODE === undefined ? 'undefined' : window.FLYDIY_MODE, held: !!window.FLYDIY_WELCOME, screen: o ? (o.querySelector('.wmenu') ? 'menu' : 'card') : 'none',
             h1: o && o.querySelector('h1') ? o.querySelector('h1').textContent : null, play: o && o.querySelector('.wplay') ? o.querySelector('.wplay').textContent : null,
             rows, boot: !!(document.getElementById('boot') && !document.getElementById('boot').hidden), webdriver: navigator.webdriver,
             why: window.WELCOME && WELCOME.mode ? WELCOME.mode.why : null, island: !!window.ISLAND_BOOT, promoted: !!window.GARAGE_SPEC };
  });
  const until = async (pg, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn)) return true; } catch (e) {} await sleep(250); } return false; };
  const shot = async (pg, size, name, note) => {
    const f = 'modes_' + size + '_' + name + '.jpg';
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 82, timeout: 120000 });
    const st = await state(pg);
    index.push(Object.assign({ size, name, file: f, note, url: pg.url() }, st));
    console.log('  ' + f + '  mode ' + st.mode + ' screen ' + st.screen + '  ' + note);
    return st;
  };
  const click = (pg, sel) => pg.evaluate(s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const warns = [];

  // ---- the desktop, a player's first visit and the next ones (one context: one localStorage) ---------------------
  {
    const ctx = await browser.newContext(DEV.desktop), pg = await ctx.newPage();
    pg.on('console', m => { if (m.type() === 'warning' && /mode=/.test(m.text())) warns.push(m.text()); });
    pg.on('pageerror', e => console.log('  [desktop] page error: ' + String(e.message || e).slice(0, 160)));
    await pg.goto(HOST + '?audio=0', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!document.getElementById('welcome'), 20000);
    let st = await shot(pg, 'desktop', 'first_card', 'a first visit on a real host: the graphics card first');
    check(st.webdriver === false && st.screen === 'card' && /^Use /.test(st.play || '') && st.mode === null && st.held, 'first visit: the card, "Use <preset>", the mode not chosen, the load held');
    check(!st.island && !st.promoted, 'first visit: nothing fetched or promoted behind the card');
    await click(pg, '#welcome .wplay');
    await until(pg, () => !!document.querySelector('#welcome .wmenu'), 5000);
    st = await shot(pg, 'desktop', 'first_menu', '...then the menu');
    const m = Object.fromEntries(st.rows.map(r => [r.mode, r]));
    check(st.screen === 'menu' && !m.continue && m.career && m.career.disabled && /coming/.test(m.career.text) && m.sandbox && !m.sandbox.disabled &&
          m.garage && m.garage.disabled && m.settings && !m.settings.disabled, 'the menu: no Continue, New career disabled "coming", Sandbox, Garage only disabled, Settings');
    check(st.rows.every(r => r.h >= 48 && r.w >= 48 && !r.title), 'every row a >= 48 px target with nothing in title= (' + st.rows.map(r => r.h).join('/') + ' px)');
    check(!st.island && !st.promoted && st.held, 'the menu: still nothing fetched, the load held');
    // a second visit: the card is remembered, the menu comes at once
    await pg.goto(HOST + '?audio=0', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!document.querySelector('#welcome .wmenu'), 20000);
    st = await shot(pg, 'desktop', 'menu', 'a second visit: the menu at once (the card remembered for this graphics card)');
    check(st.screen === 'menu' && st.mode === null, 'a second visit: the menu first');
    await click(pg, '#welcome .wmode[data-mode=settings]');
    await until(pg, () => !!document.querySelector('#welcome .wcard h1'), 5000);
    st = await shot(pg, 'desktop', 'settings', "the menu's Settings: the graphics card, with back");
    check(st.screen === 'card' && st.h1 === 'Settings', 'Settings opens the card');
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#welcome .wlink')].find(x => x.textContent === 'back'); if (b) b.click(); });
    await until(pg, () => !!document.querySelector('#welcome .wmenu'), 5000);
    check((await state(pg)).screen === 'menu', '...and back returns to the menu');
    await click(pg, '#welcome .wmode[data-mode=sandbox]');
    await until(pg, () => !document.getElementById('welcome') && window.FLYDIY_MODE === 'sandbox', 5000);
    const islandT = Date.now(); const gotIsland = await until(pg, () => !!window.ISLAND_BOOT || !!window.GARAGE_SPEC, 120000);
    st = await shot(pg, 'desktop', 'sandbox_go', 'Sandbox pressed: the menu gone, the island fetched, the loading screen');
    check(st.mode === 'sandbox' && st.screen === 'none' && st.boot && gotIsland, 'Sandbox: FLYDIY_MODE sandbox, the load goes on (the island in ' + ((Date.now() - islandT) / 1000).toFixed(1) + ' s)');
    // ?mode=sandbox: the menu skipped, the page as today's returning visit
    await pg.goto(HOST + '?audio=0&mode=sandbox', { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    st = await shot(pg, 'desktop', 'mode_sandbox', '?mode=sandbox: no screen, the loading screen at once');
    check(st.screen === 'none' && st.mode === 'sandbox' && !st.held && st.boot, '?mode=sandbox: no screen, nothing held (FLYDIY_WELCOME unset), FLYDIY_MODE sandbox');
    await pg.goto(HOST + '?audio=0&mode=garage', { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    st = await shot(pg, 'desktop', 'mode_garage', '?mode=garage: not built yet, so the sandbox (said in the console)');
    check(st.screen === 'none' && st.mode === 'sandbox' && warns.some(w => /mode=garage/.test(w)), '?mode=garage: the sandbox, and a console line says why');
    await ctx.close();
  }
  // ---- localhost, the rigs' own browser (webdriver, HeadlessChrome): today's skip -----------------------------------
  {
    const b2 = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const ctx = await b2.newContext(DEV.rig), pg = await ctx.newPage();
    await pg.goto(LOCAL + '?audio=0', { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    let st = await shot(pg, 'rig', 'localhost', 'localhost, the rig browser: no screen, implicitly the sandbox');
    check(st.screen === 'none' && st.mode === 'sandbox' && !st.held, 'localhost: no screen, nothing held, FLYDIY_MODE sandbox');
    await pg.goto(LOCAL + '?audio=0&welcome=1', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!document.getElementById('welcome'), 10000);
    st = await state(pg);
    check(st.screen === 'card' && st.held, '?welcome=1 still forces the screen on localhost (the card first)');
    await pg.goto(LOCAL + '?audio=0&welcome=1&mode=sandbox', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!document.getElementById('welcome'), 10000);
    st = await state(pg);
    check(st.screen === 'card' && /^Play on /.test(st.play || '') && st.mode === 'sandbox', '?welcome=1&mode=sandbox: the card alone, "Play on" as today');
    await click(pg, '#welcome .wplay');
    await until(pg, () => !document.getElementById('welcome'), 5000);
    st = await state(pg);
    check(st.screen === 'none' && st.mode === 'sandbox', '...and Play goes straight to the load (no menu)');
    await ctx.close(); await b2.close();
  }
  // ---- a phone: the device gate first, then the menu -------------------------------------------------------------
  {
    const ctx = await browser.newContext(DEV.phone), pg = await ctx.newPage();
    await pg.goto(HOST + '?audio=0', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!document.getElementById('welcome'), 20000);
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#welcome .wlink')].find(x => /try anyway/.test(x.textContent)); if (b) b.click(); });
    await until(pg, () => !!document.querySelector('#welcome .wmenu'), 5000);
    const st = await shot(pg, 'phone', 'menu', 'a phone: the device gate\'s "try anyway", then the menu');
    check(st.screen === 'menu' && st.rows.every(r => r.h >= 48), 'a phone: the gate, then the menu, every row >= 48 px');
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ page: PAGE, fails, shots: index }, null, 1) + '\n');
  console.log('welcome_modes_shot: ' + (fails.length ? fails.length + ' FAIL' : 'all ok'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
