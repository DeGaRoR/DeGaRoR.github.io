#!/usr/bin/env node
// map_menu_shot.js - THE MAP SCREEN, PICTURED AND PROBED (G2256, MAP-MENU). The real page (index.html served by
// tools/_serve.js) in headless Chromium on SwiftShader, one still per state, each with the page's own answers beside it
// in shots.json (what was loaded before the press, the targets' sizes, any title=, the rows, the card's facts):
//   sandbox_no_entry   the page without ?map=1: no MAP entry, nothing of the map loaded (the sandbox is today's game)
//   entry              ?map=1: the MAP entry, and still nothing of the screen loaded before it is pressed
//   desk_tab_<id>      the desktop, every tab: All, the five providers, Fleet, Pilots ("coming"), Market ("coming")
//   desk_selected      a contract selected: its markers highlighted, its route drawn, the card (both ends, payload, pay,
//                      the fleet against it)
//   desk_marker        a marker tapped: its row selected (the cross-highlight is a tap)
//   desk_build         a build contract's card: the criteria against every design
//   desk_fleet_layer   the fleet layer and the plots: every airframe where it stands, one selected
//   desk_empty         no contracts on offer (an empty source): the empty states
//   phone_collapsed    the phone (?profile=phone, 390 x 844, touch): the map with the sheet folded (tabs as chips)
//   phone_open         ...a contract tapped: the sheet open on its card (accept, track, look; no flight)
//   phone_list         ...the sheet open on the list
//
//   node tools/_serve.js 8125 &   node tools/map_menu_shot.js [--out reports/evidence/MAP-MENU] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('map_menu_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/MAP-MENU'));
const PORT = +opt('port', 8125), PAGE = opt('page', 'index.html');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/\.(jpg|png)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const index = [], fails = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); };
  const until = async (pg, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn)) return true; } catch (e) {} await sleep(250); } return false; };
  // the page's answers: what is loaded, the screen's targets (any under 48 px), title= anywhere in it, the rows, the card
  // what the page asked for, from the browser's side (the page's own resource-timing buffer is full long before: the game's ~500 files)
  const REQ = new WeakMap();
  const watch = pg => { const L = []; REQ.set(pg, L); pg.on('request', r => L.push(r.url())); return pg; };
  const probe = async pg => { const L = REQ.get(pg) || []; const o = await probe0(pg);
    o.loaded.picture = L.some(u => /media\/map\/jolene_map\./.test(u)); o.loaded.fixture = L.some(u => /contracts_sample/.test(u));
    o.loaded.menuReq = L.some(u => /map_menu\.js/.test(u)); o.loaded.packReq = L.some(u => /map_pack\.js/.test(u)); return o; };
  const probe0 = pg => pg.evaluate(() => {
    const scr = document.getElementById('mapScreen'), S = window.MAP_MENU && window.MAP_MENU.state ? window.MAP_MENU.state() : null;
    const res = performance.getEntriesByType('resource').map(r => r.name);
    const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const small = scr ? [...scr.querySelectorAll('button')].filter(vis).map(b => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(b => b.w < 48 || b.h < 48) : [];
    const card = scr ? scr.querySelector(window.MAP_MENU.state().phone ? '.mmSheetBody' : '.mmRight') : null;
    return {
      entry: !!document.getElementById('mapEntry'), open: !!scr, phone: S ? S.phone : null, tab: S ? S.tab : null, sel: S ? S.sel : null, sheet: S ? S.sheet : null,
      loaded: { menu: !!(window.FLYDIY_LAZY && FLYDIY_LAZY.has('map_menu')), pack: !!window.MAP_PACK, resources: res.length },
      rows: scr ? [...scr.querySelectorAll('.mmList .mmRow, .mmSheetBody .mmRow')].filter(vis).length : 0, markers: scr ? scr.querySelectorAll('.mmMk').length : 0,
      onMarkers: scr ? scr.querySelectorAll('.mmMk.on').length : 0, routes: scr ? scr.querySelectorAll('.mmSvg line').length / 2 : 0,
      titles: scr ? scr.querySelectorAll('[title]').length : 0, small,
      card: card ? card.innerText.replace(/\s+/g, ' ').trim().slice(0, 4000) : '',
      img: scr ? (() => { const i = scr.querySelector('.mmPlane img'); return i ? { ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight } : null; })() : null,
    };
  });
  const shot = async (pg, size, name, note) => {
    await sleep(350);
    const f = 'map_' + size + '_' + name + '.jpg';
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 84, timeout: 120000 });
    const st = await probe(pg);
    index.push(Object.assign({ size, name, file: f, note, url: pg.url() }, st, { card: st.card.slice(0, 900) }));
    console.log('  ' + f + '  rows ' + st.rows + ' markers ' + st.markers + ' routes ' + st.routes + '  ' + note);
    return st;
  };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const tapSel = (pg, sel) => ev(pg, s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const errs = [];

  // ---- the sandbox: no entry, nothing loaded ------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = watch(await ctx.newPage());
    pg.on('pageerror', e => errs.push('[sandbox] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!window.FLYDIY_LAZY, 180000);
    await sleep(1500);
    const st = await shot(pg, 'desk', 'sandbox_no_entry', 'the sandbox (no ?map=1): no MAP entry, nothing of the map loaded');
    check(!st.entry && !st.loaded.menu && !st.loaded.pack && !st.loaded.picture && !st.loaded.fixture && !st.loaded.menuReq && !st.loaded.packReq, 'the sandbox: no MAP entry and nothing of the map loaded');
    await ctx.close();
  }
  // ---- the desktop ---------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = watch(await ctx.newPage());
    pg.on('pageerror', e => errs.push('[desk] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&map=1', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!document.getElementById('mapEntry'), 180000);
    await sleep(800);
    let st = await shot(pg, 'desk', 'entry', '?map=1: the MAP entry (top centre); nothing of the screen loaded yet');
    check(st.entry && !st.loaded.menu && !st.loaded.pack && !st.loaded.picture && !st.loaded.fixture && !st.loaded.menuReq && !st.loaded.packReq, '?map=1: the entry, and nothing of the screen, its picture or its contracts before the press');
    await tapSel(pg, '#mapEntry');
    const opened = await until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU.model() && document.querySelector('#mapScreen .mmPlane img').complete, 60000);
    check(opened, 'the press loads and opens the screen');
    const tabs = ['all', 'trust', 'minedock', 'resort', 'survey', 'clients', 'fleet', 'pilots', 'market'];
    for (const t of tabs) {
      await tapSel(pg, '#mapScreen .mmTab[data-tab="' + t + '"]');
      st = await shot(pg, 'desk', 'tab_' + t, 'the ' + t + ' tab' + (t === 'pilots' || t === 'market' ? ' (a placeholder: coming)' : ''));
      if (t === 'all') check(st.loaded.menu && st.loaded.pack && st.loaded.picture && st.loaded.fixture && st.img && st.img.ok, 'open: the screen, the pack, the picture (' + (st.img && st.img.w) + ' x ' + (st.img && st.img.h) + ') and the contracts loaded ' + JSON.stringify(st.loaded));
      if (t === 'all') check(st.rows === 11, 'All lists the 11 contracts (' + st.rows + ')');
      if (t === 'pilots' || t === 'market') check(st.rows === 0 && /coming/.test(await ev(pg, () => document.querySelector('#mapScreen .mmList').innerText)), t + ': a placeholder saying "coming"');
      check(!st.small.length && !st.titles, t + ': every visible target >= 48 px, no title= (' + JSON.stringify(st.small).slice(0, 120) + ')');
    }
    await tapSel(pg, '#mapScreen .mmTab[data-tab="all"]');
    await tapSel(pg, '#mapScreen .mmRow[data-sel="c:minedock.j.parts"]');
    st = await shot(pg, 'desk', 'selected', 'Parts to the dock selected: its markers on, its route drawn, the card (both ends, payload, pay, the fleet against it)');
    check(st.sel === 'c:minedock.j.parts' && st.onMarkers >= 2 && st.routes >= 1, 'a row selected: its markers highlighted (' + st.onMarkers + ') and its route drawn (' + st.routes + ')');
    check(/Jumbo Mine Street/.test(st.card) && /Annette Dock/.test(st.card) && /250 m gravel/.test(st.card) && /water lane/.test(st.card) && /120 kg/.test(st.card) && /net/.test(st.card), 'the card: where the load is, where it goes, both strips, the payload, the pay');
    check(/Your fleet against this job/i.test(st.card) && /certified take-off run/.test(st.card) && /✗/.test(st.card) && /✓/.test(st.card), 'the card: the fleet against it, as facts (✓ and ✗), the take-off run against the strip');
    check(await ev(pg, () => [...document.querySelectorAll('#mapScreen .mmRight .mmBtn')].filter(b => /Accept|Track/.test(b.textContent)).every(b => !b.disabled)), 'never forbidding: Accept and Track stay pressable whatever the facts say');
    // track one, accept many
    await tapSel(pg, '#mapScreen .mmRight [data-act="track"]');
    const tr = await ev(pg, () => { const C = window.MAP_MENU.model().career; return { tracked: C.tracked, accepted: C.accepted.slice() }; });
    check(tr.tracked === 'minedock.j.parts' && tr.accepted.includes('minedock.reopen') && tr.accepted.includes('minedock.j.parts'), 'track one, accept many: tracking it accepts it and keeps the others accepted');
    // a marker tapped selects its row
    await ev(pg, () => window.MAP_MENU.set({ sel: null }));
    await tapSel(pg, '#mapScreen .mmMk[data-mk="c:resort.j.guests"]');
    st = await shot(pg, 'desk', 'marker', 'the guests\' marker tapped (Home): its row selected in the list');
    check(st.sel === 'c:resort.j.guests' && await ev(pg, () => !!document.querySelector('#mapScreen .mmRow.on[data-sel="c:resort.j.guests"]')), 'a marker tapped selects its row');
    await tapSel(pg, '#mapScreen .mmRow[data-sel="c:clients.b.fast4"]');
    st = await shot(pg, 'desk', 'build', 'a build contract: the criteria against every design (✓ spec / ledger, ◌ needs a flight)');
    check(/The criteria, against your designs/i.test(st.card) && /needs a flight/.test(st.card) && /Voyager/.test(st.card) && /seats/.test(st.card), 'the build card: each criterion against each design');
    await tapSel(pg, '#mapScreen .mmTab[data-tab="fleet"]');
    await ev(pg, () => window.MAP_MENU.set({ layers: { contracts: false, fleet: true, fields: true, plots: true } }));
    await tapSel(pg, '#mapScreen .mmRow[data-sel="f:Jodel"]');
    st = await shot(pg, 'desk', 'fleet_layer', 'the fleet layer (and the plots): every airframe where it stands, the Jodel selected');
    check(st.markers === 4 && st.sel === 'f:Jodel' && /Tamgas Hill/.test(st.card), 'the fleet layer: 4 airframes where they stand; the Jodel\'s card');
    await ctx.close();
    // the empty source
    const ctx2 = await browser.newContext({ viewport: { width: 1600, height: 900 } }), p2 = watch(await ctx2.newPage());
    p2.on('pageerror', e => errs.push('[empty] ' + String(e.message || e).slice(0, 160)));
    await p2.goto(URL0 + '?audio=0&map=1', { waitUntil: 'domcontentloaded' });
    await until(p2, () => !!document.getElementById('mapEntry'), 180000);
    await ev(p2, () => window.FLYDIY_LAZY(['map_pack', 'map_menu']).then(() => window.MAP_MENU.open({ source: 'empty' })));
    await until(p2, () => !!document.getElementById('mapScreen'), 30000);
    st = await shot(p2, 'desk', 'empty', 'no contracts on offer (an empty source): the list\'s and the card\'s empty states');
    check(st.rows === 0 && /Pick a contract/.test(st.card) && /No work on offer/.test(await ev(p2, () => document.querySelector('#mapScreen .mmList').innerText)), 'the empty states');
    await ctx2.close();
  }
  // ---- the phone ----------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), pg = watch(await ctx.newPage());
    pg.on('pageerror', e => errs.push('[phone] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&map=1&profile=phone', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!document.getElementById('mapEntry'), 180000);
    await tapSel(pg, '#mapEntry');
    await until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU.model() && document.querySelector('#mapScreen .mmPlane img').complete, 60000);
    let st = await shot(pg, 'phone', 'collapsed', 'the phone: the map, the sheet folded (the tabs as chips, the first rows)');
    check(st.phone && st.sheet === 'peek' && !st.small.length && !st.titles, 'the phone: the sheet folded, every visible target >= 48 px, no title= (' + JSON.stringify(st.small).slice(0, 160) + ')');
    const ta = await ev(pg, () => { const g = s => getComputedStyle(document.querySelector('#mapScreen ' + s)).touchAction; return { map: g('.mmMap'), body: g('.mmSheetBody'), handle: g('.mmHandle') }; });
    check(ta.map === 'none' && /pan-y/.test(ta.body) && ta.handle === 'none', 'R20: the map (touch-action ' + ta.map + ') and the sheet (' + ta.body + ') never share a gesture');
    await tapSel(pg, '#mapScreen .mmMk[data-mk="c:minedock.j.parts"]');
    st = await shot(pg, 'phone', 'open', 'a marker tapped: the sheet opens on its card (accept, track, look; no flight)');
    check(st.sheet === 'open' && st.sel === 'c:minedock.j.parts' && /Jumbo Mine Street/.test(st.card) && !/Fly it/.test(st.card) && /Track/.test(st.card), 'the phone: the card in the sheet, Accept and Track, no Fly');
    check(!st.small.length, 'the phone, the sheet open: every visible target >= 48 px (' + JSON.stringify(st.small).slice(0, 160) + ')');
    await tapSel(pg, '#mapScreen .mmBack');
    st = await shot(pg, 'phone', 'list', 'the sheet open on the list (back from the card)');
    check(st.rows >= 4, 'the phone list: ' + st.rows + ' rows in the open sheet');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'MAP-MENU stills (G2256)', page: PAGE, renderer: 'SwiftShader (headless Chromium)', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'map_menu_shot: ' + fails.length + ' FAIL' : 'map_menu_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('map_menu_shot threw: ' + (e && e.stack || e)); process.exit(1); });
