#!/usr/bin/env node
// empty_stand_relook.js - EMPTY-STAND-RELOOK (4 Nov 2026): the empty stand again, after the user's ruling on the first look
// ("An empty garage should automatically open the interface allowing to choose a plane, either existing or new, not to be
// confusing. But no plane should be drawn yet.") and EMPTY-STAND's answer to it (app.js standEmptyAuto / standEmptyChoose /
// standEmptyRows, new_plane.js renderOffer, design_flow.js maybeAutoOpen's career guard). An EVIDENCE tool, not a gate (never
// in run_gates.js). Copied from empty_stand_look.js (claude/empty-stand-look) and adapted. Desktop 1280x800 only (phones have
// no career). Every step through the player's own controls, a fresh profile per career:
//   1 new career, the opening skipped: the chooser does NOT come up by itself (F2) - --careers N: step 1 alone in N more careers
//   2 the map -> HOME -> Go there: CHOOSE AN AEROPLANE opens by itself (tiles: yours in words, the client's last; Buy one;
//     the new-aeroplane doors), Tim's band and CONTRACTS not over it
//   3 its cancel: the empty room, the card, nothing drawn (F1), the view across the page (F3)
//   4 the card dragged; its New aeroplane: the same chooser; Escape: still empty
//   5 a reload, Continue: the chooser by itself; cancel: nothing drawn
//   6 the chooser (the card's New aeroplane), its Rufus tile: Rufus on the stand, the columns back
//   7 the map -> the now empty w1: the chooser by itself; 8 its Buy one: the map's Market; closed: the card, still empty;
//     7b the card's New aeroplane -> Design a new aeroplane -> skip to the summary -> generate: the new build drawn
// Playwright on the image's Chromium, SwiftShader (plane_shot.js's flags), host flydiy.test, webdriver off. Never read a
// frame time off it.
//
//   node flyDiy/tools/empty_stand_relook.js [--out reports/evidence/EMPTY-STAND-RELOOK] [--careers N] [--tag x] [--secs 7200]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), net = require('net');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/EMPTY-STAND-RELOOK'));
const ONLY = opt('only', null), SECS = +opt('secs', 7200);
// --careers N: step 1 alone, in N fresh careers (F2's count); --tag: a prefix for the stills and the results
const CAREERS = +opt('careers', 0), TAG = opt('tag', CAREERS ? 'f2' : ''), PLAIN = false;
const Q = 'gfx=laptop&tutor=0';
const UA_DESK = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 800 }, userAgent: UA_DESK },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(0).padStart(5) + ' s]', ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const RES = path.join(OUT, 'results' + (TAG ? '_' + TAG : '') + '.json');

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
    const runs = CAREERS ? Array.from({ length: CAREERS }, (_, i) => 'career' + (i + 2)) : ['desktop'];
    for (const prof of runs) {
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
  const ctx = await browser.newContext(PROFILES.desktop);
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
    const f = (TAG ? TAG + '_' + prof : 'desktop') + '_' + name + '.jpg';
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

  // the chooser as the player sees it: open, its title, its tiles (the offer's and the new-aeroplane doors), and what is
  // drawn over it (Tim's band, CONTRACTS, the story card, the empty card)
  const chooser = () => pg.evaluate(() => {
    const vis = el => !!(el && !el.hidden && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
    const e = document.getElementById('npWrap');
    const open = !!(e && !e.hidden && e.getClientRects().length);
    const tiles = open ? [...e.querySelectorAll('.npBody .npTile')].map(b => ({ offer: b.dataset.offer || null, name: ((b.querySelector('b') || {}).textContent || '').trim(), note: ((b.querySelector('small') || {}).textContent || '').trim() })) : [];
    const over = {}; for (const id of ['stTim', 'stSkip', 'stCard', 'mapEntry', 'gmMenu', 'gmPanel', 'gEmptyCard', 'frEntry']) over[id] = vis(document.getElementById(id));
    // what is on top at a few points of the panel (Tim's band or CONTRACTS over it would answer here)
    const top = []; if (open) { const r = e.getBoundingClientRect(); for (const [fx, fy] of [[0.5, 0.05], [0.95, 0.05], [0.5, 0.95], [0.05, 0.95], [0.95, 0.95]]) { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); top.push(t ? (e.contains(t) ? 'npWrap' : (t.id || t.className || t.tagName)) : null); } }
    return { open, title: open ? (e.querySelector('.npTitle') || {}).textContent : null, head: open ? ((e.querySelector('.npStepH') || {}).innerText || '').replace(/\s+/g, ' ') : null,
             secs: open ? [...e.querySelectorAll('.npSecH')].map(x => x.textContent) : [], tiles, over, top,
             npOffer: document.documentElement.classList.contains('npOffer') };
  });
  const view = () => pg.evaluate(() => { const c = window.FLYDIY_RENDERER && FLYDIY_RENDERER.domElement, r = c && c.getBoundingClientRect();
    return r ? { box: [r.left, r.top, r.width, r.height].map(Math.round), buffer: [c.width, c.height], page: [innerWidth, innerHeight] } : null; });
  const chooserUp = (cap = 30000) => until('the chooser', () => { const e = document.getElementById('npWrap'); return !!(e && !e.hidden && e.getClientRects().length); }, null, 1000, cap).then(() => true, () => false);
  const chooserChecks = async (k, label) => {
    const c = await chooser();
    step(k).prints[label || 'chooser'] = c;
    log(prof, k, 'chooser', JSON.stringify({ title: c.title, tiles: c.tiles.map(t => t.offer + ':' + t.name + ' / ' + t.note) }));
    check(k, c.open, '#npWrap open', c.open);
    check(k, c.title === 'CHOOSE AN AEROPLANE', 'titled CHOOSE AN AEROPLANE', c.title);
    const br = c.tiles.filter(t => t.offer === 'bring');
    const names = br.map(t => t.name);
    check(k, names.includes('Rufus') && names.includes('Client Cub'), 'tiles for Rufus and the Client Cub', names);
    const raw = br.filter(t => /\bw\d+\b|\bHOME\b|\bundefined\b|\bnull\b/.test(t.note));
    check(k, br.length > 0 && !raw.length, 'the tiles in words (no raw id: w1, HOME)', br.map(t => t.name + ': ' + t.note));
    const last = br[br.length - 1];
    check(k, !!last && last.name === 'Client Cub' && /client/i.test(last.note), 'the client\'s plane last and named so', last);
    check(k, c.tiles.some(t => t.offer === 'buy' && t.name === 'Buy one'), 'a Buy one tile', c.tiles.filter(t => t.offer === 'buy'));
    const doors = c.tiles.filter(t => !t.offer).map(t => t.name);
    check(k, doors.includes('Design a new aeroplane') && doors.includes('Surprise me'), 'the new-aeroplane doors (Design a new aeroplane, Surprise me)', doors.slice(0, 4));
    check(k, !c.over.stTim && !c.over.mapEntry && !c.over.stCard && !c.over.gEmptyCard && c.top.every(t => t === 'npWrap'), 'Tim\'s band and CONTRACTS not over it (and nothing else)', { over: c.over, top: c.top });
    return c;
  };
  const shotsAt = {};
  const F1 = 'NO AEROPLANE DRAWN (F1): the still, looked at';

  // ---- 1. New career, the opening skipped: the chooser does NOT come up by itself (F2) --------------------------------
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
  // the first look saw it come up a moment after the garage (a 400-ms timer after FLYDIY_READY): 15 s, then read
  await sleep(15000);
  if (!R.renderer) R.renderer = await pg.evaluate(() => { const g = window.FLYDIY_RENDERER && FLYDIY_RENDERER.getContext(); try { const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) { return null; } });
  const g1 = await garages();
  step('1').prints.garages = g1;
  step('1').prints.chooserAtStart = await pg.evaluate(() => { const e = document.getElementById('npWrap');
    let wip = null; try { wip = !!localStorage.getItem('flydiy.wip'); } catch (x) {}
    return { npWrap: !!e, open: !!(e && !e.hidden), starterFlag: window.FLYDIY_STORY_STARTER || null, mode: window.FLYDIY_MODE || null, wipKey: wip, webdriver: navigator.webdriver,
             opened: window.NEW_PLANE && NEW_PLANE.LOG ? NEW_PLANE.LOG.opened : null }; });
  const s1 = await record('1');
  const start = g1.find(g => g.here), empty = g1.find(g => !g.here && !g.locked && !(g.planes || []).length);
  step('1').prints.plan = { start: start && start.id, empty: empty && empty.id };
  const cs = step('1').prints.chooserAtStart;
  check('1', !cs.open, 'the chooser (#npWrap) did NOT come up by itself on a new career (F2)', cs);
  check('1', !!s1.onStand && s1.gEmpty === false && s1.card === false, 'the starter on the stand, no empty state', { onStand: s1.onStand, gEmpty: s1.gEmpty, card: s1.card });
  check('1', !!empty, 'an owned hangar elsewhere that holds no aeroplane', g1.map(g => g.id + ' planes=' + JSON.stringify(g.planes) + (g.here ? ' (here)' : '')));
  check('1', errsAt('1').length === 0 && errsAt('0').length === 0, 'no page error', P.pageErrors.slice());
  if (cs.open) await shot('1', '1a_chooser_at_start', 'FAIL F2: the chooser up by itself over the new career', { settle: 1500 });
  await shot('1', '1_new_career', 'a new career, the opening skipped: ' + (start && start.name) + ', ' + s1.onStand + ' on the stand, no chooser', { settle: 4000 });
  if (cs.open) { await pg.click('#npWrap .npCancel').catch(() => pg.keyboard.press('Escape')); await sleep(3000); }
  if (CAREERS && prof === 'career2' && empty) {
    // E (the main run's step 4: Escape left the chooser up): who takes Escape? the map's Go to the empty hangar, the
    // chooser by itself, Escape, and the menu's state read (app.js gmOpen's capture-phase key handler runs first)
    step('E');
    if (await goByMap('E', empty.id) && await chooserUp()) {
      await sleep(2000);
      const rd = () => pg.evaluate(() => { const e = document.getElementById('npWrap'), p = document.getElementById('gmPanel');
        return { chooserOpen: !!(e && !e.hidden), menuOpen: !!(window.FLYDIY_MENU && FLYDIY_MENU.isOpen()), gmPanelHidden: p ? p.hidden : null,
                 gmPanelDisplay: p ? getComputedStyle(p).display : null, npOffer: document.documentElement.classList.contains('npOffer'), active: document.activeElement && (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) }; });
      step('E').prints.before = await rd();
      await pg.keyboard.press('Escape'); await sleep(2500);
      step('E').prints.afterEscape1 = await rd();
      check('E', !step('E').prints.afterEscape1.chooserOpen, 'Escape closes the offer chooser', step('E').prints.afterEscape1);
      await shot('E', 'E1_after_escape', 'the probe: one Escape on the offer chooser', { settle: 1500 });
      await pg.keyboard.press('Escape'); await sleep(2500);
      step('E').prints.afterEscape2 = await rd();
      check('E', !step('E').prints.afterEscape2.chooserOpen, 'a second Escape closes it', step('E').prints.afterEscape2);
      if (step('E').prints.afterEscape2.chooserOpen) { await pg.click('#npWrap .npCancel').catch(() => {}); await sleep(2500); }
      step('E').prints.afterCancel = await rd();
      await record('E');
      await shot('E', 'E2_after_cancel', 'the probe: after the Escapes (and cancel if needed)', { settle: 4000 });
    }
  }
  if (CAREERS || !empty) { await ctx.close(); return; }

  // ---- 2. Map -> HOME -> Go there: the chooser by itself --------------------------------------------------------------
  step('2');
  log(prof, 'step 2: the map\'s Go to', empty.id);
  const ok2 = await goByMap('2', empty.id);
  if (!ok2) { step('2').prints.fallback = 'the map\'s Go failed: no further step'; await ctx.close(); return; }
  const up2 = await chooserUp();
  check('2', up2, 'the chooser opened by itself on arrival');
  await sleep(3000);
  await chooserChecks('2');
  await record('2');
  check('2', errsAt('2').length === 0, 'no page error', errsAt('2'));
  await shot('2', '2_chooser_by_itself', 'arrived in ' + empty.name + ': CHOOSE AN AEROPLANE open by itself', { settle: 3000 });

  // ---- 3. Cancel: the empty room, the card, nothing drawn, the view across the page ------------------------------------
  step('3');
  await pg.click('#npWrap .npCancel');
  await sleep(3000);
  const c3 = await chooser();
  step('3').prints.chooser = { open: c3.open };
  check('3', !c3.open, 'cancel closes the chooser', c3.open);
  const s3 = await emptyChecks('3');
  const v3 = await view(); step('3').prints.view = v3;
  check('3', !!v3 && v3.box[0] <= 1 && v3.box[2] >= 1278, 'the view across the full width of the page (F3)', v3);
  check('3', errsAt('3').length === 0, 'no page error', errsAt('3'));
  await shot('3', '3_empty_room', 'cancelled: ' + empty.name + ' empty, the card, the room across the page - ' + F1, { settle: 8000 });

  // ---- 4. drag the card, then its New aeroplane: the same chooser; Escape: still empty --------------------------------
  step('4');
  const b0 = (await state()).cardBox;
  const grab = await pg.evaluate(() => { const t = document.querySelector('#gEmptyCard .geTag'), r = t.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; });
  await pg.mouse.move(grab[0], grab[1]); await pg.mouse.down();
  for (let i = 1; i <= 12; i++) { await pg.mouse.move(grab[0] - 30 * i, grab[1] + 15 * i); await sleep(60); }
  await pg.mouse.up();
  await sleep(3000);
  const b1 = (await state()).cardBox;
  step('4').prints.boxes = { before: b0, afterDrag: b1 };
  check('4', !!b0 && !!b1 && (Math.abs(b1[0] - b0[0]) > 100 || Math.abs(b1[1] - b0[1]) > 50), 'the card moved with the drag', { before: b0, after: b1 });
  await shot('4', '4a_card_dragged', 'the card dragged down-left by its body; the room still empty', { settle: 3000 });
  await pg.click('#gEmptyCard button[data-ge="new"]');
  const up4 = await chooserUp();
  check('4', up4, 'the card\'s New aeroplane opens the chooser');
  await sleep(2000);
  await chooserChecks('4');
  await shot('4', '4b_new_aeroplane_chooser', 'the card\'s New aeroplane: the same CHOOSE AN AEROPLANE', { settle: 2000 });
  await pg.keyboard.press('Escape');
  await sleep(3000);
  const c4 = await chooser();
  check('4', !c4.open, 'Escape closes it', c4.open);
  const s4 = await emptyChecks('4', 'afterEscape');
  check('4', !!s4.cardBox && !!b1 && Math.abs(s4.cardBox[0] - b1[0]) <= 1 && Math.abs(s4.cardBox[1] - b1[1]) <= 1, 'the card where it was dropped', { dropped: b1, now: s4.cardBox });
  check('4', errsAt('4').length === 0, 'no page error', errsAt('4'));
  await shot('4', '4c_after_escape', 'Escape: still empty, the card where it was dropped - ' + F1, { settle: 4000 });

  // ---- 5. reload, Continue: the chooser by itself; Cancel: nothing drawn -----------------------------------------------
  step('5');
  log(prof, 'step 5: a reload (Continue) while empty');
  await pg.goto(URL0 + '?' + Q, { waitUntil: 'domcontentloaded', timeout: 180000 });
  step('5').prints.welcome = await welcome('continue');
  await garageUp();
  const up5 = await chooserUp(300000);
  check('5', up5, 'after the reload, the chooser opened by itself');
  await sleep(4000);
  await chooserChecks('5');
  await shot('5', '5a_reload_chooser', 'a reload (Continue) while empty: CHOOSE AN AEROPLANE by itself', { settle: 2000 });
  await pg.click('#npWrap .npCancel');
  await sleep(3000);
  const s5 = await emptyChecks('5', 'afterCancel');
  check('5', s5.here === empty.id, 'still in ' + empty.id, s5.here);
  const v5 = await view(); step('5').prints.view = v5;
  check('5', !!v5 && v5.box[0] <= 1 && v5.box[2] >= 1278, 'the view across the full width of the page (F3)', v5);
  check('5', errsAt('5').length === 0, 'no page error', errsAt('5'));
  await shot('5', '5b_reload_cancelled', 'after the reload, cancelled: the empty room - ' + F1, { settle: 8000 });

  // ---- 6. the chooser, its Rufus tile -------------------------------------------------------------------------------
  step('6');
  await pg.click('#gEmptyCard button[data-ge="new"]');
  const up6 = await chooserUp();
  check('6', up6, 'the chooser (the card\'s New aeroplane)');
  await sleep(2000);
  step('6').prints.chooser = await chooser();
  await pg.click('#npWrap .npTile[data-offer="bring"]:has(b:text-is("Rufus"))').catch(async e => { step('6').prints.clickErr = e.message; });
  const on6 = await until('Rufus on the stand', () => FLYDIY_STORE.onStand() === 'Rufus' && !document.body.classList.contains('gEmpty'), null, 1500, 600000).then(() => true, () => false);
  await sleep(6000);
  const c6 = await chooser();
  const s6 = await record('6');
  const v6 = await view(); step('6').prints.view = v6;
  step('6').prints.garages = await garages();
  check('6', !c6.open, 'the panel closed', c6.open);
  check('6', on6 && s6.onStand === 'Rufus', 'Rufus on the stand', s6.onStand);
  check('6', s6.gEmpty === false && s6.card === false, 'gEmpty off, the card gone', { gEmpty: s6.gEmpty, card: s6.card });
  check('6', s6.edWrap === true && s6.rollOut === true, 'the columns (#edWrap) and Roll out back', { edWrap: s6.edWrap, rollOut: s6.rollOut });
  check('6', !!v6 && v6.box[2] < 1100 && v6.box[0] > 0, 'the view back to its column', v6);
  check('6', errsAt('6').length === 0, 'no page error', errsAt('6'));
  await shot('6', '6_rufus_on_stand', 'the chooser\'s Rufus: Rufus on ' + empty.name + '\'s stand, the columns back', { settle: 6000 });

  // ---- 7. the now empty cabin shed: the chooser by itself; 8 Buy one; 7b Design a new aeroplane -> generate ------------
  step('7');
  log(prof, 'step 7: the map\'s Go to', start.id, '(empty since 6)');
  const ok7 = await goByMap('7', start.id);
  if (!ok7) { await ctx.close(); return; }
  const up7 = await chooserUp();
  check('7', up7, 'the chooser opened by itself on arrival in the empty ' + start.id);
  await sleep(3000);
  await chooserChecks('7');
  await record('7');
  await shot('7', '7a_chooser_by_itself', 'arrived in ' + start.name + ' (empty since 6): CHOOSE AN AEROPLANE by itself', { settle: 2000 });

  // 8 first (it needs the stand empty, and 7b fills it): the chooser's Buy one
  step('8');
  await pg.click('#npWrap .npTile[data-offer="buy"]');
  const mk = await until('the map\'s Market', () => !!(window.MAP_MENU && MAP_MENU.isOpen && MAP_MENU.isOpen()), null, 2000, 600000).then(() => true, () => false);
  await sleep(5000);
  step('8').prints.map = await pg.evaluate(() => { const st = window.MAP_MENU && MAP_MENU.state ? MAP_MENU.state() : null; return { open: !!(window.MAP_MENU && MAP_MENU.isOpen()), list: st ? st.list : null }; });
  const c8 = await chooser();
  check('8', !c8.open, 'the chooser closed', c8.open);
  check('8', mk && step('8').prints.map.list === 'market', 'Buy one opens the map on its Market list', step('8').prints.map);
  await shot('8', '8a_buy_one_market', 'the chooser\'s Buy one: the map on its Market', { settle: 3000 });
  await mapClose(); await sleep(4000);
  step('8').prints.mapClosed = await pg.evaluate(() => !(window.MAP_MENU && MAP_MENU.isOpen()));
  const s8 = await emptyChecks('8', 'afterMapClosed');
  check('8', step('8').prints.mapClosed && s8.here === start.id, 'the map closed, still in ' + start.id, { closed: step('8').prints.mapClosed, here: s8.here });
  check('8', errsAt('8').length === 0, 'no page error', errsAt('8'));
  await shot('8', '8b_map_closed_card', 'the map closed: the card, the stand still empty - ' + F1, { settle: 6000 });

  step('7');
  await pg.click('#gEmptyCard button[data-ge="new"]');
  check('7', await chooserUp(), 'the card\'s New aeroplane: the chooser again');
  await sleep(2000);
  await pg.click('#npWrap .npTile.npBig:has(b:text-is("Design a new aeroplane"))');
  await sleep(1500);
  const path7 = [];
  for (let i = 0; i < 40; i++) {
    const pgState = await pg.evaluate(() => { const e = document.getElementById('npWrap'), n = e.querySelector('.npNext'), sk = e.querySelector('.npSkip');
      return { next: n.textContent, skip: !sk.hidden, hint: e.querySelector('.npHint').textContent, head: ((e.querySelector('.npStepH') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 60) }; });
    path7.push(pgState.hint || pgState.next);
    if (pgState.next === 'generate') break;
    if (pgState.skip) await pg.click('#npWrap .npSkip'); else await pg.click('#npWrap .npNext');
    await sleep(700);
  }
  step('7').prints.designPath = path7;
  check('7', path7[path7.length - 1] === 'generate', 'the summary reached (skip through the steps)', path7.length);
  await shot('7', '7b_summary', 'Design a new aeroplane, every step skipped: the summary, before generate', { settle: 2000 });
  await pg.click('#npWrap .npNext.npGo');
  const gen = await until('the build on the stand', () => { const e = document.getElementById('npWrap'); return (!e || e.hidden) && !document.body.classList.contains('gEmpty'); }, null, 2000, 600000).then(() => true, () => false);
  await sleep(10000);
  const s7 = await record('7', 'afterGenerate');
  step('7').prints.newPlaneLog = await pg.evaluate(() => window.NEW_PLANE && NEW_PLANE.LOG ? { opened: NEW_PLANE.LOG.opened, generated: NEW_PLANE.LOG.generated } : null);
  const v7 = await view(); step('7').prints.view = v7;
  step('7').prints.garages = await garages();
  check('7', gen && s7.gEmpty === false && s7.card === false, 'generate: gEmpty off, the card gone', { gEmpty: s7.gEmpty, card: s7.card, onStand: s7.onStand });
  check('7', s7.edWrap === true, 'the editor\'s columns back', s7.edWrap);
  check('7', errsAt('7').length === 0, 'no page error', errsAt('7'));
  await shot('7', '7c_new_build_drawn', 'generated: the new build on ' + start.name + '\'s stand (looked at: drawn)', { settle: 8000 });
  await ctx.close();
}
