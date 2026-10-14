#!/usr/bin/env node
// map_group_shot.js - THE CONTRACTS GROUPED, ORDERED, FILTERED, PICTURED AND PROBED (G2714, MAP-GROUP; the user, 11 Oct:
// "the missions should be grouped either by type of mission, or contractor, and generate a ordered list with sections
// according to the ordering type, and filtering on the key parameters of the missions"). The real page (index.html served
// by tools/_serve.js, ?career=1: a new dev career) in headless Chromium on SwiftShader; one still per state, each with the
// page's own answers beside it in shots.json - the sections and rows the DOM draws against the pure core's view
// (MAP_MENU.contractView), the filters' "n hidden" captions, the computed font of every piece of text (Plex, upright),
// every visible target's size, the map's dimmed badges.
//
// EVERY STILL IS OF THE LOADED PAGE (the user's rule): the boot overlay gone (BOOT.state 'gone', #boot hidden) plus 2 s,
// checked BEFORE and AFTER each capture; a still taken while the page was loading is discarded and taken again.
//
//   desk_type        grouped by Type (the default), ordered by pay: the four sections, their dots and counts
//   desk_contractor  grouped by Contractor, ordered by Distance: the five sections (CONTRACT_PROVIDERS' order), each
//                    row's km under its title, the types' legend in the head
//   desk_filters     a contract tracked (a water job), then the filters' panel open with Surface: land, Km <= 15 and
//                    Pay >= 4 000 set: each filter's "n hidden", the summary and Clear, the tracked row kept "outside the
//                    filters"; the map's badges of the places no shown contract involves dimmed
//   desk_folded      a section folded (its header only), the choice remembered across a reload (the grouping, the order,
//                    the fold - never the filters)
//   phone_sheet      the phone (?profile=phone, 390 x 844, touch): the folded sheet - the switch, Type · Contractor, the
//                    order, Filters
//   phone_filters    ...the sheet open on the filters' panel with a filter set (the hidden counts at touch size)
//
//   node tools/_serve.js 8125 <repo root> &   node tools/map_group_shot.js [--out futureDesigns/game/evidence/MAP-GROUP] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('map_group_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'futureDesigns/game/evidence/MAP-GROUP'));
const PORT = +opt('port', 8125), PAGE = opt('page', 'index.html');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/\.(jpg|png)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const index = [], fails = [], errs = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const until = async (pg, fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn, arg)) return true; } catch (e) { /* navigating */ } await sleep(400); } return false; };
  const loaded = pg => pg.evaluate(() => {
    const B = window.BOOT, el = document.getElementById('boot');
    const hid = !el || el.hidden || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden' || +getComputedStyle(el).opacity === 0;
    return { state: B ? B.state : null, hidden: hid, ok: !!B && B.state === 'gone' && hid };
  });
  const boot = pg => until(pg, () => window.BOOT && BOOT.state === 'gone' && (() => { const e = document.getElementById('boot'); return !e || e.hidden || getComputedStyle(e).display === 'none'; })(), 420000);
  // THE PAGE'S OWN ANSWERS: the sections / rows drawn against the core's view of the same state; the hidden captions;
  // the text's faces; the targets; the dimmed badges
  const probe = pg => pg.evaluate(() => {
    const scr = document.getElementById('mapScreen'), MM = window.MAP_MENU, S = MM && MM.state ? MM.state() : null;
    if (!scr) return { open: false };
    const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
    const texts = [];
    for (const el of scr.querySelectorAll('*')) {
      if (!vis(el)) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
      if (!own) continue;
      const cs = getComputedStyle(el);
      texts.push({ cls: (el.getAttribute('class') || el.tagName.toLowerCase()).split(' ')[0], t: own.slice(0, 24), family: cs.fontFamily, style: cs.fontStyle });
    }
    const bad = texts.filter(x => !/^"?IBM Plex Sans"?/.test(x.family) || x.style !== 'normal');
    // the list's own targets (the map's badges are 48 px tap targets drawn smaller, MAP-SIMPLE's; the sheet's list is what is new)
    const small = [...scr.querySelectorAll('.mmSide button,.mmSide select,.mmSide input')].filter(vis).map(b => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(b => b.w < 48 || b.h < 48);
    const V = MM.contractView(MM.model(), S);
    const secs = [...scr.querySelectorAll('.mmList .mmGs')].map(s => ({ key: s.dataset.g, label: (s.querySelector('.mmGl') || {}).textContent, n: +((s.querySelector('.mmGn') || {}).textContent), hidden: ((s.querySelector('.mmGrp .mmHid') || {}).textContent) || '', rows: [...s.querySelectorAll('.mmRow')].map(r => r.dataset.id) }));
    const caps = [...scr.querySelectorAll('.mmFlt .mmCap')].map(c => c.textContent);
    return { open: true, list: S && S.list, group: S && S.group, sort: S && S.sort, flt: S && S.flt, fold: S && S.fold, fltOpen: S && S.fltOpen, sheet: S && S.sheet, phone: S && S.phone, overlay: S && S.lastOverlay,
      view: { groups: V.groups.filter(g => g.rows.length).map(g => ({ key: g.key, label: g.label, n: g.rows.length, hidden: g.hidden, rows: g.rows.map(c => c.id) })), shown: V.shown, base: V.base, hidden: V.hidden, hiddenAll: V.hiddenAll, pinned: V.pinned, order: V.order },
      secs, caps, sum: ((scr.querySelector('.mmSum span') || {}).textContent) || '', tracked: MM.model().career.tracked,
      dim: scr.querySelectorAll('.mmPl.dim').length, badges: scr.querySelectorAll('.mmPl').length, pinTag: !!scr.querySelector('.mmTag.pin'),
      texts: texts.length, bad: bad.slice(0, 12), small, titles: scr.querySelectorAll('[title]').length, pref: (() => { try { return localStorage.getItem('flydiy.map.group.v1'); } catch (e) { return null; } })() };
  });
  const shot = async (pg, size, name, note) => {
    const f = 'map_group_' + size + '_' + name + '.jpg', p = path.join(OUT, f);
    for (let k = 0; k < 4; k++) {
      await sleep(2000);   // the page loaded, plus 2 s
      const b0 = await loaded(pg);
      if (!b0.ok) { console.log('  (still loading before ' + f + ' - waiting)'); await boot(pg); continue; }
      await pg.screenshot({ path: p, type: 'jpeg', quality: 88, timeout: 120000 });
      const b1 = await loaded(pg);
      if (!b1.ok) { console.log('  (loading after ' + f + ': discarded, taken again)'); fs.unlinkSync(p); await boot(pg); continue; }
      const st = await probe(pg);
      index.push(Object.assign({ size, name, file: f, note, url: pg.url(), boot: { before: b0, after: b1 } }, st));
      console.log('  ' + f + '  sections ' + st.secs.map(s => s.label + ' ' + s.n).join(', ') + '  ' + note.slice(0, 80));
      return st;
    }
    check(false, f + ': never captured on a loaded page');
    return probe(pg);
  };
  // the DOM draws exactly the core's view (the folded sections' rows left out); Plex upright; targets; no title=
  const same = (st, f) => {
    const folded = st.fold || {};
    const want = st.view.groups.map(g => ({ key: g.key, n: g.n, rows: folded[g.key] ? [] : g.rows, hidden: g.hidden ? g.hidden + ' hidden' : '' }));
    const got = st.secs.map(s => ({ key: s.key, n: s.n, rows: s.rows, hidden: s.hidden }));
    check(JSON.stringify(got) === JSON.stringify(want), f + ': the sections drawn are the core\'s view (' + got.map(s => s.key + ' ' + s.n + (s.hidden ? ' / ' + s.hidden : '')).join(', ') + ')');
    check(st.bad && !st.bad.length && st.texts > 10, f + ': every piece of text (' + st.texts + ') IBM Plex Sans, upright' + (st.bad && st.bad.length ? ' - ' + JSON.stringify(st.bad).slice(0, 200) : ''));
    check(!st.small.length && !st.titles, f + ': every visible target of the list >= 48 px, no title= (' + JSON.stringify(st.small).slice(0, 160) + ')');
  };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const tap = (pg, sel) => ev(pg, s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const choose = (pg, sel, v) => ev(pg, ([s, val]) => { const e = document.querySelector(s); if (!e) return false; e.value = val; e.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [sel, v]);
  const openScreen = async pg => {
    await tap(pg, '#mapEntry');
    return until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && MAP_MENU.model() && (() => { const i = document.querySelector('#mapScreen .mmStage img'); return i && i.complete && i.naturalWidth > 0; })(), 90000);
  };

  // ---- the desktop, the real record (?career=1) ------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[desk] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), '?career=1 loaded (the boot overlay gone)');
    check(await until(pg, () => !!document.getElementById('mapEntry'), 60000), 'the MAP entry');
    await tap(pg, '.dfClose');
    check(await openScreen(pg), 'the press loads and opens the map screen');
    let st = await shot(pg, 'desk', 'type', 'grouped by Type (the default), ordered by pay, high first: Cargo, Passengers, Survey (the legend\'s order), each header the type\'s dot and the count');
    same(st, 'type');
    check(st.group === 'type' && st.sort === 'pay' && st.secs.map(s => s.key).every(k => /^t:/.test(k)) && st.secs.reduce((t, s) => t + s.n, 0) === st.view.base, 'by type: the sections sum to the ' + st.view.base + ' contracts');
    await tap(pg, '#mapScreen .mmSegB[data-by="prov"]');
    await choose(pg, '#mapScreen .mmSort', 'km');
    st = await shot(pg, 'desk', 'contractor', 'grouped by Contractor (CONTRACT_PROVIDERS\' order), ordered by Distance (short first): each row\'s km under its title; the types\' legend in the head');
    same(st, 'contractor');
    check(st.group === 'prov' && st.sort === 'km' && st.secs.length === 5 && st.secs.reduce((t, s) => t + s.n, 0) === st.view.base && /distance, short first/.test(st.sum), 'by contractor: five sections summing to ' + st.view.base + ', "' + st.sum + '"');
    // a water job tracked, then filters that hide it: it stays, first in its section, "outside the filters"
    const wet = await ev(pg, () => { const M = MAP_MENU.model(); const c = M.contracts.find(x => MAP_MENU.surfOf(M, x) !== 'land'); return c && c.id; });
    await tap(pg, '#mapScreen .mmRow[data-id="' + wet + '"]');
    await tap(pg, '#mapScreen .mmTrack[data-id="' + wet + '"]');
    await tap(pg, '#mapScreen .mmRow[data-id="' + wet + '"]');
    await tap(pg, '#mapScreen .mmSegB[data-by="type"]');
    await choose(pg, '#mapScreen .mmSort', 'pay');
    await tap(pg, '#mapScreen .mmFltB');
    await choose(pg, '#mapScreen .mmFsel[data-f="surf"]', 'land');
    await choose(pg, '#mapScreen .mmFnum[data-f="kmMax"]', '15');
    await choose(pg, '#mapScreen .mmFnum[data-f="payMin"]', '4000');
    st = await shot(pg, 'desk', 'filters', 'the filters\' panel: Surface land, Km <= 15, Pay >= 4 000 - each caption says how many rows it hides alone, the summary "n of N · hidden" and Clear; the tracked water job kept first in its section, "outside the filters"; on the map the places no shown contract involves dimmed');
    same(st, 'filters');
    check(st.tracked === wet && st.view.pinned === wet && st.pinTag, 'the tracked row (' + wet + ') kept against the filters, marked "outside the filters"');
    const capsOk = ['surf', 'kmMax', 'payMin'].every(f => !st.view.hidden[f] || st.caps.some(c => c.includes(st.view.hidden[f] + ' hidden')));
    check(capsOk && st.view.hiddenAll > 0 && st.sum.includes(st.view.shown + ' of ' + st.view.base) && st.sum.includes(st.view.hiddenAll + ' hidden'), 'each filter states what it hides (' + st.caps.join(' | ') + '); the summary "' + st.sum + '"');
    check(st.dim > 0 && st.overlay && st.overlay.dim === st.dim, 'the map follows the list: ' + st.dim + ' of ' + st.badges + ' badges dimmed');
    await tap(pg, '#mapScreen .mmClr');
    st = await probe(pg);
    check(st.view.hiddenAll === 0 && st.view.shown === st.view.base && st.dim === 0, 'Clear: every contract back (' + st.view.shown + '), no badge dimmed');
    await tap(pg, '#mapScreen .mmFltB');
    await tap(pg, '#mapScreen .mmGrp[data-g="t:cargo"]');
    st = await shot(pg, 'desk', 'folded', 'the Cargo section folded (its header and count only); the others open');
    same(st, 'folded');
    check(st.fold && st.fold['t:cargo'] === true && st.secs.find(s => s.key === 't:cargo').rows.length === 0, 'the Cargo section folded');
    // remembered per viewer: a reload keeps the grouping, the order and the fold - never the filters
    await choose(pg, '#mapScreen .mmSort', 'load');
    await tap(pg, '#mapScreen .mmFltB');
    await tap(pg, '#mapScreen .mmChip[data-f="fits"]');
    await pg.reload({ waitUntil: 'domcontentloaded' });
    check(await boot(pg), 'reloaded');
    await until(pg, () => !!document.getElementById('mapEntry'), 60000);
    await tap(pg, '.dfClose');
    check(await openScreen(pg), 'the map screen reopened after the reload');
    st = await probe(pg);
    check(st.group === 'type' && st.sort === 'load' && st.fold && st.fold['t:cargo'] === true && st.fltOpen === true && st.view.hiddenAll === 0, 'remembered per viewer: the order (load), the fold, the panel open; the filters not (' + st.pref + ')');
    await ctx.close();
  }
  // ---- the phone ----------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[phone] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1&profile=phone', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), 'the phone page loaded');
    await until(pg, () => !!document.getElementById('mapEntry'), 60000);
    check(await openScreen(pg), 'the phone screen opens');
    let st = await shot(pg, 'phone', 'sheet', 'the phone: the folded sheet - the switch, Type · Contractor, the order, Filters (every target >= 48 px), the first section under them');
    same(st, 'phone sheet');
    check(st.phone && st.sheet === 'peek' && st.secs.length >= 1, 'the phone: the sheet folded, the sections under the controls');
    await tap(pg, '#mapScreen .mmHandle');
    await tap(pg, '#mapScreen .mmFltB');
    await tap(pg, '#mapScreen .mmChip[data-f="type"][data-v="pax"]');
    await tap(pg, '#mapScreen .mmChip[data-f="fits"]');
    st = await shot(pg, 'phone', 'filters', 'the phone: the sheet open on the filters\' panel - Passengers and "✓ only" set, each caption\'s hidden count, the summary and Clear, at touch size');
    same(st, 'phone filters');
    check(st.sheet === 'open' && st.fltOpen && st.view.hiddenAll > 0 && st.caps.some(c => /hidden/.test(c)), 'the phone: the filters\' panel with its hidden counts (' + st.caps.join(' | ') + ')');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  check(index.every(s => s.boot.before.ok && s.boot.after.ok), 'every still kept is of the loaded page (BOOT gone, #boot hidden, before and after)');
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'MAP-GROUP stills (G2714): the contracts grouped by type or contractor, ordered, filtered on their key parameters (the user, 11 Oct)', page: PAGE,
    renderer: 'SwiftShader (headless Chromium)', rule: 'every still is of the LOADED page: BOOT.state gone and #boot hidden, plus 2 s, checked before and after each capture; a loading capture is discarded and retaken', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'map_group_shot: ' + fails.length + ' FAIL' : 'map_group_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('map_group_shot threw: ' + (e && e.stack || e)); process.exit(1); });
