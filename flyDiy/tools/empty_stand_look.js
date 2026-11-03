#!/usr/bin/env node
// empty_stand_look.js - EMPTY-STAND-LOOK (3 Nov 2026): THE EMPTY STAND, ON THE PAGE. An EVIDENCE tool, not a gate (never
// in run_gates.js). EMPTY-STAND (the user, 4 Nov: "Empty hangar") - in a career, going to a hangar of yours that holds no
// aeroplane (the map's Go, or the routes panel's base select) opens it with the STAND EMPTY: no aeroplane drawn, the
// editor's columns and Roll out hidden (body.gEmpty), FLYDIY_STORE.onStand() null, and the draggable #gEmptyCard offers
// New aeroplane / Buy one / Bring here. Any load onto the stand ends it; a reload keeps it (app.js standEmptySet,
// standEmptyCard, standEmptyAt, gotoGarage). This rig starts a story career (the cabin's shed with the starter on the
// stand, HOME's club hangar owned and empty) the player's way, with ?tutor=0 (Tim's T0 holds every click - the user's
// ruling), and pictures:
//   1 the career's opening hangar, its aeroplane on the stand (before)
//   2 the map's Go to the other (empty) hangar: the stand empty, the card shown, Roll out hidden
//   3 the card dragged by its body (it must move, and stay)
//   4 the card's Bring here: one of yours onto the stand, the empty state over
//   5 the map's Go back to the hangar left empty by 4 (the empty state again), then the card's New aeroplane: the chooser
//   6 (the chooser closed by Escape) the card's Buy one: the map's Market
//   7 a reload (Continue) while empty: still empty, the card back
// Steps 1-2 again on a phone (412 x 915, a phone's user agent, touch). Each career start is a FRESH browser context.
// Playwright drives the image's Chromium on SwiftShader (plane_shot.js's flags). Never read a frame time off it.
// Reused from story_home_look.js (claude/story-home-look): the server, the launch flags, the welcome, the waits.
//
//   node flyDiy/tools/empty_stand_look.js [--out reports/evidence/EMPTY-STAND] [--only desktop|phone] [--secs 7200]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), net = require('net');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/EMPTY-STAND'));
const ONLY = opt('only', null), SECS = +opt('secs', 7200);
const Q = 'gfx=laptop&tutor=0';
const UA_DESK = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 800 }, userAgent: UA_DESK },
  phone: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_PHONE },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(0).padStart(5) + ' s]', ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const RES = path.join(OUT, 'results' + (ONLY ? '_' + ONLY : '') + '.json');

const R = { renderer: null, args: argv, url: Q, profiles: {} };
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
    fs.writeFileSync(RES, JSON.stringify(R, null, 1));
    log('results ->', path.relative(process.cwd(), RES));
  }
  process.exit(0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

async function runProfile(browser, prof, URL0) {
  const P = R.profiles[prof] = { steps: {}, shots: [], pageErrors: [], consoleErrors: [], warnings: [] };
  const phone = prof === 'phone';
  const ctx = await browser.newContext(PROFILES[prof]);
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(180000);
  const ev0 = pg.evaluate.bind(pg);
  pg.evaluate = (fn, arg, ms = 240000) => Promise.race([ev0(fn, arg), sleep(ms).then(() => { throw new Error('evaluate timed out after ' + ms + ' ms'); })]);
  const save = () => { try { fs.writeFileSync(RES, JSON.stringify(R, null, 1)); } catch (e) {} };
  let curStep = '0';
  pg.on('pageerror', e => { const m = String(e && (e.stack || e.message) || e).split('\n').slice(0, 3).join(' | '); P.pageErrors.push({ step: curStep, error: m }); log(prof, 'PAGE ERROR', m); });
  pg.on('console', m => { const t = m.text(); if (m.type() === 'error') P.consoleErrors.push({ step: curStep, text: t.slice(0, 400) }); else if (m.type() === 'warning' && /flyDiy/.test(t)) P.warnings.push({ step: curStep, text: t.slice(0, 400) }); });
  pg.on('dialog', d => { P.warnings.push({ step: curStep, text: 'dialog ' + d.type() + ': ' + d.message() }); d.accept().catch(() => {}); });
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
  const step = k => (curStep = k, steps[k] = steps[k] || { asserts: [], prints: {} });
  const check = (k, ok, what, got) => { step(k).asserts.push({ ok: !!ok, what, got: got === undefined ? undefined : got }); save(); log(prof, k, ok ? 'PASS' : 'FAIL', what, got === undefined ? '' : JSON.stringify(got)); };
  const errsAt = k => P.pageErrors.filter(e => e.step === k).map(e => e.error);
  const shot = async (k, name, what, o = {}) => {
    const f = prof + '_' + name + '.jpg';
    await sleep(o.settle || 3000);
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 85, timeout: 240000 });
    P.shots.push({ step: k, file: f, what });
    log(prof, k, 'still', f);
    return f;
  };
  const garageUp = () => until('the garage', () => !!(window.BOOT && BOOT.state === 'gone' && BOOT.stepI >= (BOOT.steps || []).length && !BOOT.current && window.FLYDIY_PLAYER && window.FLYDIY_STORE), null, 2000);
  const garages = () => pg.evaluate(() => window.FLYDIY_PLAYER.garages().map(g => ({ id: g.id, name: g.name, aero: g.aero, here: g.here, locked: g.locked, planes: g.planes, stand: g.stand })));
  // the state the brief asks for at every step: FLYDIY_STORE.onStand(), body.gEmpty, the card, Roll out, the draw counter
  const state = () => pg.evaluate(() => {
    const vis = el => !!(el && !el.hidden && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
    const c = document.getElementById('gEmptyCard'), r = c && c.getBoundingClientRect(), roll = document.getElementById('edRoll'), wrap = document.getElementById('edWrap');
    let info = null; try { const i = window.FLYDIY_RENDERER && FLYDIY_RENDERER.info; info = i ? { calls: i.render.calls, triangles: i.render.triangles } : null; } catch (e) {}
    let pref = null; try { pref = localStorage.getItem('flydiy.standEmpty'); } catch (e) {}
    const d = FLYDIY_PLAYER.doc();
    return { onStand: FLYDIY_STORE.onStand(), gEmpty: document.body.classList.contains('gEmpty'), here: d.here, card: vis(c), cardBox: r ? [r.left, r.top, r.width, r.height].map(Math.round) : null,
             cardText: vis(c) ? c.innerText : null, rollOut: vis(roll), edWrap: vis(wrap), modeWs: document.body.classList.contains('mode-ws'), pref, render: info,
             fleet: Object.keys(d.fleet || {}), holds: window.FLYDIY_HOLDS ? (() => { try { return JSON.parse(JSON.stringify(FLYDIY_HOLDS())); } catch (e) { return null; } })() : null };
  });
  const record = async (k, label) => { const s = await state(); step(k).prints[label || 'state'] = s; save(); log(prof, k, 'state', JSON.stringify({ onStand: s.onStand, gEmpty: s.gEmpty, here: s.here, card: s.card, rollOut: s.rollOut, render: s.render })); return s; };
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
      if (s.tryAnyway && !s.play) { await pg.click('#welcome .wlink'); }
      else if (s.tryAnyway && /phone/i.test(s.h1)) { await pg.click('#welcome .wlink'); }
      else if (s.play) { await pg.click('#welcome .wplay'); }
      await sleep(800);
    }
    throw new Error('the welcome never showed its menu');
  };
  // the map's Go: the map (the CONTRACTS pill or the menu's Map), the hangar's icon, its Go row's "Go there"
  const mapOpen = async (k) => {
    const door = await pg.evaluate(() => { const b = document.getElementById('mapEntry'); if (b && b.getClientRects().length) { b.click(); return '#mapEntry'; }
      if (window.FLYDIY_LAZY) { window.FLYDIY_LAZY(['map_pack', 'map_menu']).then(() => window.MAP_MENU && MAP_MENU.open({})); return 'FLYDIY_LAZY map'; } return null; });
    step(k).prints.mapDoor = door;
    return until('the map', () => !!(window.MAP_MENU && MAP_MENU.isOpen && MAP_MENU.isOpen() && document.querySelector('#mapScreen .mmGar')), null, 2000, 600000).then(() => true, () => false);
  };
  const mapClose = () => pg.evaluate(() => { const x = document.querySelector('#mapScreen [data-act="gox"]'); if (x && x.getClientRects().length) x.click(); if (window.MAP_MENU && MAP_MENU.isOpen()) MAP_MENU.close(); });
  const goByMap = async (k, id) => {
    const up = await mapOpen(k);
    check(k, up, 'the map opens with its garage icons (' + step(k).prints.mapDoor + ')');
    if (!up) return null;
    await sleep(2500);
    await pg.evaluate(() => { const b = document.querySelector('#mapScreen [data-act="fit"]'); if (b) b.click(); });
    await sleep(1500);
    await pg.click('#mapScreen .mmGar[data-gid="' + id + '"]').catch(async () => { await pg.evaluate(i => document.querySelector('#mapScreen .mmGar[data-gid="' + i + '"]').click(), id); });
    await sleep(1500);
    const go = await pg.evaluate(() => { const g = document.querySelector('#mapScreen .mmGo'); return g ? { hidden: g.hidden, text: g.innerText } : null; });
    step(k).prints.goRow = go;
    check(k, !!go && !go.hidden && /Go there/.test(go.text), 'the map\'s Go row offers "Go there" for ' + id, go);
    await shot(k, k + 'x_map_go_row', 'the map\'s Go row for ' + id + ' (before Go there)', { settle: 1500 });
    const clicked = await pg.evaluate(() => { const b = document.querySelector('#mapScreen [data-act="goyes"]'); if (b && !b.disabled) { b.click(); return true; } return false; });
    check(k, clicked, '"Go there" pressed');
    const there = await until('here = ' + id, i => FLYDIY_PLAYER.doc().here === i && document.body.classList.contains('mode-ws'), id, 1500, 600000).then(() => true, () => false);
    check(k, there, 'doc().here is ' + id + ' after Go there', await pg.evaluate(() => FLYDIY_PLAYER.doc().here));
    await sleep(4000);
    await mapClose(); await sleep(2500);
    step(k).prints.mapStillOpen = await pg.evaluate(() => !!(window.MAP_MENU && MAP_MENU.isOpen()));
    return there;
  };
  const emptyChecks = async (k, label) => {
    const s = await record(k, label);
    check(k, s.onStand === null, 'FLYDIY_STORE.onStand() is null', s.onStand);
    check(k, s.gEmpty === true, 'body.gEmpty is set', s.gEmpty);
    check(k, s.card === true, '#gEmptyCard is shown', s.cardBox);
    check(k, s.rollOut === false && s.edWrap === false, 'Roll out (#edRoll) and the editor columns (#edWrap) hidden', { rollOut: s.rollOut, edWrap: s.edWrap });
    return s;
  };

  // ---- 1. New career, the opening skipped: the first hangar with its aeroplane on the stand ---------------------------
  step('1');
  log(prof, 'step 1: New career', URL0 + '?' + Q);
  await pg.goto(URL0 + '?' + Q, { waitUntil: 'domcontentloaded', timeout: 180000 });
  step('1').prints.welcome = await welcome('career');
  let intro = null;
  for (;;) {
    const s = await pg.evaluate(() => { const el = document.getElementById('stIntro'), sk = el && el.querySelector('.siSkip');
      const up = !!(window.BOOT && BOOT.state === 'gone');
      return { skip: !!(sk && sk.getClientRects().length && getComputedStyle(sk).display !== 'none'), up, garage: !!(window.FLYDIY_STORY && up && !el) }; }).catch(() => ({}));
    if (s.skip && s.up) { await pg.click('#stIntro .siSkip').catch(async () => { await pg.keyboard.press('Escape'); }); intro = 'skipped (its Skip button)'; break; }
    if (s.garage) { intro = 'no opening'; break; }
    if (Date.now() > stop) throw new Error('timed out waiting for the opening or the garage');
    await sleep(1500);
  }
  step('1').prints.opening = intro;
  await garageUp();
  await until('the opening gone', () => !document.getElementById('stIntro') || !document.getElementById('stIntro').getClientRects().length, null, 1000);
  await sleep(6000);
  if (!R.renderer) R.renderer = await pg.evaluate(() => { const g = window.FLYDIY_RENDERER && FLYDIY_RENDERER.getContext(); try { const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) { return null; } });
  const g1 = await garages();
  step('1').prints.garages = g1;
  step('1').prints.story = await pg.evaluate(() => { const s = window.FLYDIY_STORY && FLYDIY_STORY.story(); return s ? { beat: s.beat, cabin: s.cabin } : null; });
  const s1 = await record('1');
  const start = g1.find(g => g.here), empty = g1.find(g => !g.here && !g.locked && !(g.planes || []).length);
  step('1').prints.plan = { start: start && start.id, empty: empty && empty.id };
  check('1', !!s1.onStand, 'an aeroplane on the stand (FLYDIY_STORE.onStand())', s1.onStand);
  check('1', s1.gEmpty === false && s1.card === false, 'no empty state (body.gEmpty off, no #gEmptyCard)', { gEmpty: s1.gEmpty, card: s1.card });
  check('1', !!empty, 'a second owned hangar elsewhere that holds no aeroplane', g1.map(g => g.id + ' ' + g.aero + ' planes=' + JSON.stringify(g.planes) + (g.here ? ' (here)' : '')));
  check('1', errsAt('1').length === 0 && errsAt('0').length === 0, 'no page error', P.pageErrors.slice());
  await shot('1', '1_before', 'before: the career\'s first hangar (' + (start && start.name) + '), its aeroplane ' + s1.onStand + ' on the stand', { settle: 5000 });
  if (!empty) { await ctx.close(); return; }

  // ---- 2. Go to the empty hangar ------------------------------------------------------------------------------------
  step('2');
  log(prof, 'step 2: the map\'s Go to', empty.id);
  const ok2 = await goByMap('2', empty.id);
  if (!ok2) {   // the API's door, so the empty state is still pictured (said in the results)
    step('2').prints.fallback = await pg.evaluate(i => Promise.resolve(FLYDIY_PLAYER.gotoGarage(i)).then(r => JSON.parse(JSON.stringify(r))), empty.id);
    await sleep(6000);
  }
  await sleep(4000);
  await emptyChecks('2');
  step('2').prints.garages = await garages();
  check('2', errsAt('2').length === 0, 'no page error', errsAt('2'));
  await shot('2', '2_empty_stand', 'the map\'s Go to ' + empty.name + ': the stand empty, #gEmptyCard, no Roll out', { settle: 6000 });
  if (phone) { await ctx.close(); return; }

  // ---- 3. drag the card -----------------------------------------------------------------------------------------------
  step('3');
  const b0 = (await state()).cardBox;
  const grab = await pg.evaluate(() => { const t = document.querySelector('#gEmptyCard .geTag'), r = t.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; });
  await pg.mouse.move(grab[0], grab[1]); await pg.mouse.down();
  for (let i = 1; i <= 12; i++) { await pg.mouse.move(grab[0] - 30 * i, grab[1] + 15 * i); await sleep(60); }
  await pg.mouse.up();
  await sleep(1500);
  const b1 = (await state()).cardBox;
  await sleep(5000);
  const s3 = await record('3');
  const b2 = s3.cardBox;
  step('3').prints.boxes = { before: b0, afterDrag: b1, fiveSecondsLater: b2, cardPos: await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('flydiy.cardPos') || 'null'); } catch (e) { return null; } }) };
  check('3', !!b0 && !!b1 && (Math.abs(b1[0] - b0[0]) > 100 || Math.abs(b1[1] - b0[1]) > 50), 'the card moved with the drag (~ -360, +180)', { before: b0, after: b1 });
  check('3', !!b1 && !!b2 && Math.abs(b2[0] - b1[0]) <= 1 && Math.abs(b2[1] - b1[1]) <= 1, 'the card stays where it was dropped (5 s later)', { after: b1, later: b2 });
  check('3', s3.gEmpty && s3.onStand === null, 'still empty after the drag', { gEmpty: s3.gEmpty, onStand: s3.onStand });
  check('3', errsAt('3').length === 0, 'no page error', errsAt('3'));
  await shot('3', '3_card_dragged', 'the card dragged down-left by its body (it moved and stays)');

  // ---- 4. Bring here ---------------------------------------------------------------------------------------------------
  step('4');
  const bring = await pg.evaluate(() => [...document.querySelectorAll('#gEmptyCard button[data-ge="bring"]')].map(b => b.dataset.n));
  step('4').prints.bringButtons = bring;
  check('4', bring.length >= 1, 'the card lists a plane of yours with Bring here', bring);
  if (!bring.length) { await ctx.close(); return; }
  const who = bring[0];
  await pg.click('#gEmptyCard button[data-ge="bring"][data-n="' + who + '"]');
  const brought = await until('the plane on the stand', n => FLYDIY_STORE.onStand() === n && !document.body.classList.contains('gEmpty'), who, 1500, 600000).then(() => true, () => false);
  await sleep(6000);
  const s4 = await record('4');
  step('4').prints.garages = await garages();
  step('4').prints.cardWhy = await pg.evaluate(() => { const w = document.querySelector('#gEmptyCard .geWhy'); return w ? w.textContent : null; });
  check('4', brought && s4.onStand === who, 'Bring here: ' + who + ' on the stand (FLYDIY_STORE.onStand())', s4.onStand);
  check('4', s4.gEmpty === false && s4.card === false, 'the empty state ended (body.gEmpty off, card hidden)', { gEmpty: s4.gEmpty, card: s4.card });
  check('4', s4.rollOut === true, 'Roll out back', s4.rollOut);
  check('4', errsAt('4').length === 0, 'no page error', errsAt('4'));
  await shot('4', '4_brought_here', 'Bring here: ' + who + ' on ' + empty.name + '\'s stand, the empty state over', { settle: 6000 });

  // ---- 5. back to the empty state, then New aeroplane ----------------------------------------------------------------
  step('5');
  log(prof, 'step 5: the map\'s Go back to', start.id, '(left without its plane by 4)');
  const ok5 = await goByMap('5', start.id);
  if (!ok5) { step('5').prints.fallback = await pg.evaluate(i => Promise.resolve(FLYDIY_PLAYER.gotoGarage(i)).then(r => JSON.parse(JSON.stringify(r))), start.id); await sleep(6000); }
  await sleep(4000);
  await emptyChecks('5', 'stateEmptyAgain');
  check('5', errsAt('5').length === 0, 'no page error (the trip)', errsAt('5'));
  await shot('5', '5a_empty_again', 'back to ' + start.name + ' (its plane now at ' + empty.name + '): the stand empty again', { settle: 5000 });
  const cardAt5 = (await state()).cardBox;
  step('5').prints.cardBoxAfterTrip = cardAt5;
  await pg.click('#gEmptyCard button[data-ge="new"]');
  const np = await until('the chooser', () => { const e = document.getElementById('npWrap'); return !!(e && !e.hidden && e.getClientRects().length); }, null, 1000, 120000).then(() => true, () => false);
  step('5').prints.chooser = await pg.evaluate(() => { const e = document.getElementById('npWrap'); return e ? { hidden: e.hidden, text: (e.innerText || '').slice(0, 300), npOpen: document.documentElement.classList.contains('npOpen') } : null; });
  check('5', np, 'New aeroplane opens the chooser (#npWrap)', step('5').prints.chooser);
  check('5', errsAt('5').length === 0, 'no page error', errsAt('5'));
  await shot('5', '5b_new_aeroplane_chooser', 'the card\'s New aeroplane: the full-screen chooser', { settle: 3000 });
  await pg.keyboard.press('Escape');
  await sleep(3000);
  const s5c = await record('5', 'afterChooserEscape');
  step('5').prints.chooserClosed = await pg.evaluate(() => { const e = document.getElementById('npWrap'); return !e || e.hidden; });
  check('5', step('5').prints.chooserClosed && s5c.gEmpty && s5c.card && s5c.onStand === null, 'Escape closes the chooser, the stand still empty, the card back', { closed: step('5').prints.chooserClosed, gEmpty: s5c.gEmpty, card: s5c.card, onStand: s5c.onStand });

  // ---- 6. Buy one -> the map's Market ---------------------------------------------------------------------------------
  step('6');
  await pg.click('#gEmptyCard button[data-ge="buy"]').catch(e => { step('6').prints.clickErr = e.message; });
  const mk = await until('the map\'s Market', () => !!(window.MAP_MENU && MAP_MENU.isOpen && MAP_MENU.isOpen()), null, 2000, 600000).then(() => true, () => false);
  await sleep(4000);
  step('6').prints.map = await pg.evaluate(() => { const st = window.MAP_MENU && MAP_MENU.state ? MAP_MENU.state() : null; const tabs = [...document.querySelectorAll('#mapScreen [aria-selected="true"], #mapScreen .on, #mapScreen .sel')].map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 6);
    return { open: !!(window.MAP_MENU && MAP_MENU.isOpen()), list: st ? st.list : null, title: (document.querySelector('#mapScreen .mmTitle h1') || {}).textContent || null, selected: tabs }; });
  check('6', mk && step('6').prints.map.list === 'market', 'Buy one opens the map on its Market list', step('6').prints.map);
  await record('6');
  check('6', errsAt('6').length === 0, 'no page error', errsAt('6'));
  await shot('6', '6_buy_one_market', 'the card\'s Buy one: the map\'s Market', { settle: 3000 });
  await mapClose(); await sleep(3000);
  const s6 = await record('6', 'afterMapClosed');
  check('6', s6.gEmpty && s6.card && s6.onStand === null, 'the map closed: the stand still empty, the card back', { gEmpty: s6.gEmpty, card: s6.card, onStand: s6.onStand });

  // ---- 7. reload while empty ------------------------------------------------------------------------------------------
  step('7');
  log(prof, 'step 7: a reload (Continue) while empty');
  await pg.goto(URL0 + '?' + Q, { waitUntil: 'domcontentloaded', timeout: 180000 });
  step('7').prints.welcome = await welcome('continue');
  await garageUp();
  const back = await until('the empty state back', () => document.body.classList.contains('gEmpty') && !!document.getElementById('gEmptyCard') && !document.getElementById('gEmptyCard').hidden, null, 2000, 300000).then(() => true, () => false);
  await sleep(6000);
  const s7 = await emptyChecks('7');
  check('7', back && s7.here === start.id, 'after the reload: still empty in ' + start.id, { here: s7.here, pref: s7.pref });
  step('7').prints.cardBoxBeforeReload = cardAt5;
  check('7', errsAt('7').length === 0, 'no page error', errsAt('7'));
  await shot('7', '7_reload_still_empty', 'a reload (Continue) while empty: still empty, the card back', { settle: 6000 });
  await ctx.close();
}
