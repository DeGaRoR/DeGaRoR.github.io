#!/usr/bin/env node
// story_home_look.js - STORY-HOME-LOOK (3 Nov 2026): A STORY CAREER'S TWO HANGARS, ON THE PAGE. An EVIDENCE tool, not a
// gate (never in run_gates.js). STORY-1 (the user, 29 Oct) made BOTH hangars the player's from a story's start: the
// cabin's Shed (where the story starts) and HOME, the WWII field's club hangar (79_story.js storyNewCareer; 70_player.js
// playerNormalise lifts an old save's sheds.HOME.locked = 'story'). This rig starts a story career the player's way and
// pictures it:
//   1 the welcome's New career (the real-host path: flydiy.test mapped to the server, a browser's user agent, webdriver
//     off - welcome_modes_shot.js's), the opening skipped with its own Skip button; asserted: no page error, the story at
//     T0, doc().here the cabin's shed (or HOME with the no-cabin note)
//   2 the cabin's shed with the UI: garages() lists HOME open (locked falsy, why ''), no "not yours yet" on the page
//   4 gotoGarage('HOME') -> { ok: true }: HOME's hangar inside, the map with both garages and the Go row, the roll-out
//   5 an old locked save: HOME.locked = 'story' through FLYDIY_PLAYER.set, then (b) written raw to the career's key;
//     each reloaded (Continue): HOME open, no "not yours yet"
//   3 (run last: a boot is ~15 min on SwiftShader, so 5b's reload carries ?storycard=1) the beat card, "The cabin", no
//     " of N", no "not yours yet"
// Steps 2 and 4 again on a phone (360 x 800, a phone's user agent, touch): the device gate's "try anyway", the menu.
// Each career start is a FRESH browser context (an empty profile). Playwright drives the image's Chromium on SwiftShader
// (plane_shot.js's flags). Never read a frame time off it.
//
//   node flyDiy/tools/story_home_look.js [--out reports/evidence/STORY-HOME] [--only desktop|phone] [--secs 7200 (per profile)]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), net = require('net');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/STORY-HOME'));
const ONLY = opt('only', null), SECS = +opt('secs', 7200);
// --tutor0: step 4 on a reload (Continue) with ?tutor=0 - the dev flag that keeps Tim's steps stepping but holds nothing
// (app.js storyTutorLock / STORY_TUTOR_OFF): at T0 the player's page holds every click outside Tim's band (storyTutorGuard),
// the CONTRACTS pill and Roll out among them. --skip 5[,3]: steps left out. --tag: the run's name on its files.
// --uamobile: the phone says it is one (CDP userAgentMetadata mobile: true - Playwright's userAgent alone leaves
// navigator.userAgentData.mobile false and the headless shell reports a fine pointer, so welcome.js's device gate never shows)
const UAMOBILE = argv.includes('--uamobile');
// --nogfx: no ?gfx=laptop on the URL - welcome.js decide() skips the device gate AND the graphics card when ?gfx= is there
// (welcome.js:174), so a phone meets its gate only without it; the preset is then the welcome's pick
const GFXQ = argv.includes('--nogfx') ? '' : 'gfx=laptop';
const TUTOR0 = argv.includes('--tutor0'), SKIP = (opt('skip', '') || '').split(',').filter(Boolean), TAG = opt('tag', TUTOR0 ? 'tutor0' : '');
const UA_DESK = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 800 }, userAgent: UA_DESK },
  phone: { viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_PHONE },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(0).padStart(5) + ' s]', ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

const R = { renderer: null, tag: TAG || null, args: argv, profiles: {} };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  const serve = cp.spawn(process.execPath, [path.join(ROOT, 'tools', '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  await sleep(800);
  const URL0 = 'http://flydiy.test:' + port + '/flyDiy/index.html';
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--enable-automation'],
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP flydiy.test 127.0.0.1',
           '--disable-blink-features=AutomationControlled', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--no-sandbox'] });
  try {
    for (const prof of Object.keys(PROFILES)) {
      if (ONLY && ONLY !== prof) continue;
      try { await runProfile(browser, prof, URL0); } catch (e) { log(prof, 'RUN FAILED', e && e.stack || e); (R.profiles[prof] = R.profiles[prof] || {}).runError = String(e && e.message || e); }
    }
  } finally {
    await browser.close().catch(() => {});
    serve.kill();
    fs.writeFileSync(path.join(OUT, 'results' + (TAG ? '_' + TAG : '') + '.json'), JSON.stringify(R, null, 1));
    log('results ->', path.relative(process.cwd(), path.join(OUT, 'results' + (TAG ? '_' + TAG : '') + '.json')));
  }
  process.exit(0);   // (the evaluate timeouts' timers would hold node for minutes)
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

async function runProfile(browser, prof, URL0) {
  const P = R.profiles[prof] = { steps: {}, shots: [], pageErrors: [], consoleErrors: [], warnings: [] };
  const phone = prof === 'phone';
  const ctx = await browser.newContext(PROFILES[prof]);
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(180000);
  if (phone && UAMOBILE) {
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: UA_PHONE, platform: 'Linux armv8l',
      userAgentMetadata: { brands: [{ brand: 'Chromium', version: '141' }, { brand: 'Google Chrome', version: '141' }], fullVersion: '141.0.0.0', platform: 'Android', platformVersion: '14', architecture: '', model: 'Pixel 8', mobile: true } });
  }
  // a page.evaluate has no timeout of its own: a main thread held for minutes (a software frame) must not hang the rig
  const ev0 = pg.evaluate.bind(pg);
  pg.evaluate = (fn, arg, ms = 240000) => Promise.race([ev0(fn, arg), sleep(ms).then(() => { throw new Error('evaluate timed out after ' + ms + ' ms'); })]);
  const save = () => { try { fs.writeFileSync(path.join(OUT, 'results' + (TAG ? '_' + TAG : '') + '.json'), JSON.stringify(R, null, 1)); } catch (e) {} };
  pg.on('pageerror', e => { const m = String(e && (e.stack || e.message) || e).split('\n').slice(0, 3).join(' | '); P.pageErrors.push(m); log(prof, 'PAGE ERROR', m); });
  pg.on('console', m => { const t = m.text(); if (m.type() === 'error') P.consoleErrors.push(t.slice(0, 400)); else if (m.type() === 'warning' && /flyDiy/.test(t)) P.warnings.push(t.slice(0, 400)); });
  pg.on('dialog', d => { P.warnings.push('dialog ' + d.type() + ': ' + d.message()); d.accept().catch(() => {}); });
  const stop = Date.now() + SECS * 1000;
  const until = async (what, fn, arg, every = 1000, cap = 0) => {
    const t0 = Date.now();
    for (;;) {
      if (cap && Date.now() - t0 > cap) throw new Error('gave up waiting for ' + what);
      let v = null; try { v = await pg.evaluate(fn, arg); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() > stop) throw new Error('timed out waiting for ' + what);
      await sleep(every);
    }
  };
  const steps = P.steps;
  const step = k => (steps[k] = steps[k] || { asserts: [], prints: {} });
  const check = (k, ok, what, got) => { step(k).asserts.push({ ok: !!ok, what, got: got === undefined ? undefined : got }); save(); log(prof, k, ok ? 'PASS' : 'FAIL', what, got === undefined ? '' : JSON.stringify(got)); };
  const shot = async (k, name, what, o = {}) => {
    const f = (TAG ? TAG + '_' : '') + prof + '_' + name + '.jpg';
    await sleep(o.settle || 2500);
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 85, timeout: 240000 });
    P.shots.push({ step: k, file: f, what });
    log(prof, k, 'still', f);
    return f;
  };
  // the page's garage up: the boot gone, the garage chain whole
  const garageUp = () => until('the garage', () => !!(window.BOOT && BOOT.state === 'gone' && BOOT.stepI >= (BOOT.steps || []).length && !BOOT.current && window.FLYDIY_PLAYER && window.FLYDIY_STORY), null, 2000);
  const bodyHasLock = () => pg.evaluate(() => /not yours yet/i.test(document.body.innerText || ''));
  const garages = () => pg.evaluate(() => window.FLYDIY_PLAYER.garages().map(g => ({ id: g.id, name: g.name, aero: g.aero, here: g.here, locked: g.locked, why: g.why, planes: g.planes, stand: g.stand })));
  const homeOpen = gs => { const h = gs.find(g => g.id === 'HOME'); return { found: !!h, locked: h ? h.locked : null, why: h ? h.why : null, ok: !!h && !h.locked && h.why === '' }; };
  // the welcome as a player meets it: (phone) the device gate's "try anyway", the graphics card's play, the menu's row
  const welcome = async (row) => {
    const seen = [];
    for (let i = 0; i < 40; i++) {
      const s = await pg.evaluate(() => { const o = document.getElementById('welcome'); if (!o) return { none: true, mode: window.FLYDIY_MODE };
        return { menu: !!o.querySelector('.wmenu'), h1: (o.querySelector('h1') || {}).textContent || '', rows: [...o.querySelectorAll('.wmode')].map(b => b.dataset.mode + (b.disabled ? '(disabled)' : '')),
                 play: !!o.querySelector('.wplay'), tryAnyway: [...o.querySelectorAll('.wlink')].some(b => /try anyway/.test(b.textContent)) }; }).catch(() => ({ err: true }));
      if (s.none) { if (seen.length) return seen; await sleep(500); continue; }
      if (s.err) { await sleep(500); continue; }
      seen.push(s);
      if (s.menu) {
        if (!s.rows.includes(row)) throw new Error('the welcome menu has no live "' + row + '" row: ' + s.rows.join(', '));
        await pg.click('#welcome .wmode[data-mode="' + row + '"]');
        await sleep(500);
        return seen;
      }
      if (s.tryAnyway) step('1').prints.deviceGate = s.h1;
      if (s.tryAnyway && !s.play) { await pg.click('#welcome .wlink'); }
      else if (s.tryAnyway && /phone/i.test(s.h1)) { await pg.click('#welcome .wlink'); }   // the device gate: try anyway (the career wants the island)
      else if (s.play) { await pg.click('#welcome .wplay'); }
      await sleep(800);
    }
    throw new Error('the welcome never showed its menu');
  };

  // ---- 1. New career, the opening skipped -------------------------------------------------------------------------
  log(prof, 'step 1: New career', URL0);
  await pg.goto(URL0 + '?' + GFXQ + '', { waitUntil: 'domcontentloaded', timeout: 180000 });
  const w1 = await welcome('career');
  step('1').prints.welcome = w1;
  check('1', await pg.evaluate(() => window.FLYDIY_MODE === 'career'), 'FLYDIY_MODE is career', await pg.evaluate(() => window.FLYDIY_MODE));
  // the opening: its Skip button, once it is up (or no opening: the garage straight)
  let intro = null;
  for (;;) {
    const s = await pg.evaluate(() => { const el = document.getElementById('stIntro'), sk = el && el.querySelector('.siSkip');
      const up = !!(window.BOOT && BOOT.state === 'gone');
      return { curtain: !!el, skip: !!(sk && sk.getClientRects().length && getComputedStyle(sk).display !== 'none'), up, garage: !!(window.FLYDIY_STORY && up && !el) }; }).catch(() => ({}));
    if (s.skip && s.up) {
      // the warm views run under black (a frame each, slow here): the still once the black has lifted, else at 10 min
      const lit = await until('the opening lit', () => { const b = document.querySelector('#stIntro .siBlack'); return !b || +getComputedStyle(b).opacity < 0.3; }, null, 2000, 600000)
        .then(() => true, () => false);
      step('1').prints.openingLit = lit;
      await shot('1', '1_opening', 'the opening over the cabin strip, before Skip' + (lit ? '' : ' (still black: the warm views)'), { settle: 3000 });
      await pg.click('#stIntro .siSkip').catch(async () => { await pg.keyboard.press('Escape'); });
      intro = 'skipped (its Skip button)'; break;
    }
    if (s.garage) { intro = 'no opening (the garage straight)'; break; }
    if (Date.now() > stop) throw new Error('timed out waiting for the opening or the garage');
    await sleep(1500);
  }
  step('1').prints.opening = intro;
  await garageUp();
  await until('the opening gone', () => !document.getElementById('stIntro') || !document.getElementById('stIntro').getClientRects().length, null, 1000);
  await sleep(5000);
  if (!R.renderer) R.renderer = await pg.evaluate(() => { const g = window.FLYDIY_RENDERER && FLYDIY_RENDERER.getContext(); try { const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) { return null; } });
  const st1 = await pg.evaluate(() => { const s = FLYDIY_STORY.story(), d = FLYDIY_PLAYER.doc(); return { beat: s && s.beat, cabin: s && s.cabin, note: s && s.note, here: d.here, hereBase: d.sheds && d.sheds[d.here] && d.sheds[d.here].base, sheds: Object.keys(d.sheds || {}), mode: d.mode, careerId: window.FLYDIY_CAREER_ID }; });
  step('1').prints.state = st1;
  check('1', P.pageErrors.length === 0, 'no page error', P.pageErrors.slice());
  check('1', st1.beat === 'T0', "FLYDIY_STORY.story().beat === 'T0'", st1.beat);
  const cabinOk = st1.cabin ? (st1.here === st1.cabin.hangar && st1.hereBase === st1.cabin.aero) : (st1.here === 'HOME' && !!st1.note);
  check('1', cabinOk, st1.cabin ? "doc().here is the cabin's shed (story().cabin.hangar, based at story().cabin.aero)" : "doc().here is HOME with the no-cabin note",
    { here: st1.here, base: st1.hereBase, cabin: st1.cabin, note: st1.note || null });

  // ---- 2. T0: the cabin's shed with the UI --------------------------------------------------------------------------
  const g2 = await garages();
  step('2').prints.garages = g2;
  const h2 = homeOpen(g2);
  check('2', h2.ok, "garages() lists HOME with locked falsy and why ''", h2);
  check('2', !(await bodyHasLock()), 'body innerText has no "not yours yet"');
  check('2', P.pageErrors.length === 0, 'no page error', P.pageErrors.slice());
  await shot('2', '2_cabin_shed', 'T0: the cabin shed with the UI (the story starts here)');

  // ---- 4. gotoGarage('HOME') -------------------------------------------------------------------------------------
  if (SKIP.includes('4')) { await ctx.close(); return; }
  step('4').prints.tutorLockBefore = await pg.evaluate(() => ({ stTut: document.body.classList.contains('stTut'), tim: (document.querySelector('#stTim') || {}).innerText || null }));
  if (TUTOR0) {
    log(prof, 'step 4: a reload (Continue) with ?tutor=0');
    await pg.goto(URL0 + '?' + GFXQ + '&tutor=0', { waitUntil: 'domcontentloaded', timeout: 180000 });
    step('4').prints.welcome = await welcome('continue');
    await garageUp(); await sleep(5000);
    step('4').prints.tutorLockAfterReload = await pg.evaluate(() => ({ stTut: document.body.classList.contains('stTut'), beat: FLYDIY_STORY.story().beat, here: FLYDIY_PLAYER.doc().here }));
  }
  log(prof, 'step 4: gotoGarage HOME');
  const r4 = await pg.evaluate(() => Promise.resolve(window.FLYDIY_PLAYER.gotoGarage('HOME')).then(r => JSON.parse(JSON.stringify(r))));
  step('4').prints.gotoGarage = r4;
  check('4', !!r4 && r4.ok === true, "gotoGarage('HOME') returns {ok:true}", r4);
  await sleep(6000);
  const g4 = await garages();
  step('4').prints.garages = g4;
  const h4 = g4.find(g => g.id === 'HOME');
  check('4', !!h4 && h4.here, 'HOME is here after the trip', h4 && { here: h4.here, stand: h4.stand });
  check('4', g4.length >= 2 && homeOpen(g4).ok, 'garages() lists both hangars, HOME open', g4.map(g => g.id + (g.locked ? '(locked)' : '')));
  check('4', !(await bodyHasLock()), 'body innerText has no "not yours yet"');
  await shot('4', '4a_home_inside', "HOME's club hangar inside, after gotoGarage('HOME') (the stand)", { settle: 5000 });
  // the map (the CONTRACTS pill, #mapEntry): both garages, then the Go row of the other one
  const mapDoor = await pg.evaluate(() => { const b = document.getElementById('mapEntry'); if (b && b.getClientRects().length) { b.click(); return '#mapEntry'; }
    const m = document.getElementById('bMap'); if (m) { m.click(); return '#bMap'; } return null; });
  step('4').prints.mapDoor = mapDoor;
  const mapUp = await until('the map', () => !!(window.MAP_MENU && MAP_MENU.isOpen && MAP_MENU.isOpen() && document.querySelector('#mapScreen .mmGar')), null, 2000, 300000).catch(e => { log(prof, '4 map wait:', e.message); return false; });
  step('4').prints.mapState = await pg.evaluate(() => { const i = document.querySelector('#mapScreen .mmStage img');
    return { lazy: !!window.MAP_MENU, open: !!(window.MAP_MENU && MAP_MENU.isOpen && MAP_MENU.isOpen()), screen: !!document.getElementById('mapScreen'), img: i ? { src: (i.getAttribute('src') || '').slice(0, 80), complete: i.complete, nw: i.naturalWidth } : null,
             gar: document.querySelectorAll('#mapScreen .mmGar').length, title: (document.querySelector('#mapScreen .mmTitle h1') || {}).textContent || null }; }).catch(e => ({ err: e.message }));
  check('4', !!mapUp, 'the map opens (' + mapDoor + ') with its garage icons', step('4').prints.mapState);
  if (!mapUp) await shot('4', '4b_map_FAIL', 'the map did not show its garages within 5 min: what the page showed');
  if (mapUp) {
    await sleep(3000);
    const fit = await pg.evaluate(() => { const b = document.querySelector('#mapScreen [data-act="fit"]'); if (b) b.click(); return !!b; });
    await sleep(2000);
    const gm = await pg.evaluate(() => [...document.querySelectorAll('#mapScreen .mmGar')].map(b => ({ id: b.dataset.gid, label: b.getAttribute('aria-label'), cls: b.className, vis: !!b.getClientRects().length })));
    step('4').prints.mapGarages = gm;
    check('4', gm.length >= 2 && gm.some(g => g.id === 'HOME') && !gm.some(g => /locked/.test(g.cls)), 'the map draws both garages, none dim/locked', gm.map(g => g.id + ' ' + g.cls));
    check('4', !gm.some(g => /not yours yet/i.test(g.label || '')), 'no garage on the map says "not yours yet"', gm.map(g => g.label));
    await shot('4', '4b_map_garages', 'the map with both garages (the hangar icons beside their places; HOME ringed: here)');
    const other = gm.find(g => g.id !== 'HOME');
    if (other) {
      await pg.click('#mapScreen .mmGar[data-gid="' + other.id + '"]').catch(async () => { await pg.evaluate(id => document.querySelector('#mapScreen .mmGar[data-gid="' + id + '"]').click(), other.id); });
      await sleep(1500);
      const go = await pg.evaluate(() => { const g = document.querySelector('#mapScreen .mmGo'); return g ? { hidden: g.hidden, text: g.innerText } : null; });
      step('4').prints.goRow = go;
      check('4', !!go && !go.hidden && /Go there/.test(go.text) && !/not yours yet/i.test(go.text), 'the Go row offers the other hangar ("Go there")', go);
      await shot('4', '4c_map_go_row', 'the map\'s Go row for the cabin shed (tap on its hangar icon)');
      await pg.evaluate(() => { const x = document.querySelector('#mapScreen [data-act="gox"]'); if (x) x.click(); });
      await sleep(500);
    }
    // HOME's own Go row: "you are here"
    await pg.evaluate(() => { const b = document.querySelector('#mapScreen .mmGar[data-gid="HOME"]'); if (b) b.click(); });
    await sleep(1200);
    step('4').prints.goRowHome = await pg.evaluate(() => { const g = document.querySelector('#mapScreen .mmGo'); return g ? { hidden: g.hidden, text: g.innerText } : null; });
    await pg.evaluate(() => { const x = document.querySelector('#mapScreen [data-act="gox"]'); if (x) x.click(); if (window.MAP_MENU) MAP_MENU.close(); });
    await sleep(2000);
  }
  // the roll-out (the stand's verb, #edRoll): the aeroplane on HOME's stand outside
  const roll = await pg.evaluate(() => { const v = document.getElementById('edRoll'); if (v && v.getClientRects().length) { const t = v.textContent; v.click(); return '#edRoll "' + t + '"'; }
    const b = document.getElementById('bGo'); if (b) { const t = b.textContent; b.click(); return '#bGo "' + t + '"'; } return null; });
  step('4').prints.rollDoor = roll;
  check('4', !!roll, 'a Roll out button to press', roll);
  const out = await until('the roll-out (the garage left, the world up)', () => !document.body.classList.contains('mode-ws') && !(document.getElementById('boot') && !document.getElementById('boot').hidden), null, 2000, 1200000).catch(() => false);
  check('4', !!out, 'the roll-out reached the world (the shed left)');
  step('4').prints.rollState = await pg.evaluate(() => ({ bodyClass: document.body.className, here: FLYDIY_PLAYER.doc().here, rollFrom: FLYDIY_PLAYER.rollFrom && FLYDIY_PLAYER.rollFrom() }));
  check('4', P.pageErrors.length === 0, 'no page error', P.pageErrors.slice());
  await shot('4', '4d_rollout_outside', "the roll-out from HOME: the aeroplane outside on HOME's stand", { settle: 12000 });

  // ---- 3. ?storycard=1: the beat card (step 5b's reload carries the flag) -----------------------------------------------
  async function step3() {
    log(prof, 'step 3: ?storycard=1 (the page step 5b reloaded)');
    await until('the beat card', () => { const c = document.getElementById('stCard'); return !!(c && !c.hidden && c.getClientRects().length); }, null, 1500, 120000).catch(() => null);
    await sleep(4000);
    const k = await pg.evaluate(() => { const c = document.getElementById('stCard'); if (!c) return null; const r = c.getBoundingClientRect();
      return { hidden: c.hidden, text: c.innerText, title: (c.querySelector('.stTitle') || {}).textContent || null, box: [r.left, r.top, r.width, r.height].map(Math.round), beat: FLYDIY_STORY.story().beat, noCard: document.body.classList.contains('stNoCard') }; });
    step('3').prints.card = k;
    check('3', !!k && !k.hidden && !k.noCard, 'the beat card is shown (#stCard visible, no stNoCard)', k && { hidden: k.hidden, stNoCard: k.noCard });
    check('3', !!k && k.box[0] < 400 && k.box[1] < 300, 'the card is in the top-left', k && k.box);
    check('3', !!k && k.title === 'The cabin', 'the title is "The cabin"', k && k.title);
    check('3', !!k && !/ of \d+/.test(k.text), 'no " of N" counter', k && k.text);
    check('3', !!k && !/not yours yet/i.test(k.text) && !(await bodyHasLock()), 'no "not yours yet" (card and page)');
    check('3', P.pageErrors.length === 0, 'no page error', P.pageErrors.slice());
    await shot('3', '3_beat_card', 'the beat card (?storycard=1) in the top-left, at T0');
  }

  // ---- 5. an old locked save (desktop only) -------------------------------------------------------------------------
  if (!phone && !SKIP.includes('5')) {
    log(prof, 'step 5: an old locked save');
    // (a) the brief's door: FLYDIY_PLAYER.set with HOME locked, then a reload
    const a = await pg.evaluate(() => { const d = FLYDIY_PLAYER.doc(); d.sheds.HOME.locked = 'story'; const back = FLYDIY_PLAYER.set(d);
      return { lockedAfterSet: back.sheds && back.sheds.HOME ? back.sheds.HOME.locked || null : 'no HOME', key: 'flydiy.career.' + window.FLYDIY_CAREER_ID }; });
    step('5').prints.setDoor = a;
    await pg.goto(URL0 + '?' + GFXQ + '', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await welcome('continue');
    await garageUp(); await sleep(4000);
    const g5a = await garages();
    step('5').prints.garages_a = g5a;
    check('5', homeOpen(g5a).ok, '(a) set() then reload: HOME open (locked falsy, why \'\')', homeOpen(g5a));
    check('5', !(await bodyHasLock()), '(a) no "not yours yet" on the page');
    // (b) the save itself carries the lock (written raw to the career's key: what a pre-STORY-1 save holds), then a reload
    const b = await pg.evaluate(() => { const k = 'flydiy.career.' + window.FLYDIY_CAREER_ID, d = JSON.parse(localStorage.getItem(k)); d.sheds.HOME.locked = 'story';
      localStorage.setItem(k, JSON.stringify(d)); return { key: k, raw: JSON.parse(localStorage.getItem(k)).sheds.HOME.locked }; });
    step('5').prints.rawDoor = b;
    await pg.goto(URL0 + '?' + GFXQ + '&storycard=1', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await welcome('continue');
    await garageUp(); await sleep(4000);
    const g5b = await garages();
    step('5').prints.garages_b = g5b;
    step('5').prints.savedAfter = await pg.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); return { locked: d.sheds.HOME.locked || null, here: d.here }; }, b.key);
    check('5', homeOpen(g5b).ok, '(b) raw locked save then reload: HOME open (locked falsy, why \'\')', homeOpen(g5b));
    check('5', !(await bodyHasLock()), '(b) no "not yours yet" on the page');
    check('5', P.pageErrors.length === 0, 'no page error', P.pageErrors.slice());
    await shot('5', '5_old_save_reloaded', 'an old save with HOME locked, reloaded with ?storycard=1 (Continue): the garage, HOME open, the beat card');
    await step3();
  }
  await ctx.close();
}
