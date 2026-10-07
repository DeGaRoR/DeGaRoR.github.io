#!/usr/bin/env node
// map_menu_shot.js - THE MAP SCREEN, PICTURED AND PROBED (G2256 MAP-MENU; rewritten for G2329 MAP-SIMPLE, the screen
// rebuilt to the approved mock, GAME-2026-10-06.md §R.2). The real page (index.html served by tools/_serve.js) in
// headless Chromium on SwiftShader, one still per state, each with the page's own answers beside it in shots.json.
//
// EVERY STILL IS OF THE LOADED PAGE (the user's rule): the boot overlay gone (BOOT.state 'gone', #boot hidden), checked
// BEFORE and AFTER each capture; a still taken while the page was loading is discarded and taken again, never kept.
//
//   desk_sandbox       the page without ?map=1 / ?career=1: no MAP entry, nothing of the map loaded (today's game)
//   desk_fit           ?career=1 (the real record: a new dev career): the screen at the fit - the list, the AI map, a badge
//                      per place
//   desk_mid           mid zoom: the names, the places of interest, the wildlife hotspots with their rings and counts
//   desk_close         close up at Jolene AFB: both runways at true scale, the centreline, the threshold bars, 13/31, 02/20
//   desk_place         Annette Dock's badge tapped: "At Annette Dock ✕", the list filtered to the contracts involving it
//   desk_open          a contract opened (the paragraph, the runways condensed, the ✗'s reason, Track) - the view unmoved
//   desk_tracked       ...Track pressed: Tracking ★, the places ringed in its type colour, the route, the footer
//   desk_fixture       the fixture's fleet (wheels and floats): ✓ and ✗ on the surface no-no's, a build unmarked
//   phone_sheet        the phone (?profile=phone, 390 x 844, touch): the map, the list as a bottom sheet (peek)
//   phone_open         ...the sheet open on a contract's paragraph
//
//   node tools/_serve.js 8125 <repo root> &   node tools/map_menu_shot.js [--out reports/evidence/MAP-SIMPLE] [--port 8125]
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
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/MAP-SIMPLE'));
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
  const REQ = new WeakMap();
  const watch = pg => { const L = []; REQ.set(pg, L); pg.on('request', r => L.push(r.url())); return pg; };
  // the boot overlay is GONE: the state, and the element hidden (display none, hidden, or detached)
  const loaded = pg => pg.evaluate(() => {
    const B = window.BOOT, el = document.getElementById('boot');
    const hid = !el || el.hidden || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden' || +getComputedStyle(el).opacity === 0;
    return { state: B ? B.state : null, hidden: hid, ok: !!B && B.state === 'gone' && hid };
  });
  const boot = async pg => { const ok = await until(pg, () => window.BOOT && BOOT.state === 'gone' && (() => { const e = document.getElementById('boot'); return !e || e.hidden || getComputedStyle(e).display === 'none'; })(), 420000); return ok; };
  const probe = pg => pg.evaluate(() => {
    const scr = document.getElementById('mapScreen'), MM = window.MAP_MENU, S = MM && MM.state ? MM.state() : null;
    const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
    const small = scr ? [...scr.querySelectorAll('button,select')].filter(vis).map(b => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(b => b.w < 48 || b.h < 48) : [];
    const img = scr ? scr.querySelector('.mmStage img') : null;
    return {
      entry: !!document.getElementById('mapEntry'), open: !!scr, phone: S ? S.phone : null, cust: S ? S.cust : null, at: S ? S.at : null, opened: S ? S.open : null, sheet: S ? S.sheet : null,
      loadedMap: { menu: !!(window.FLYDIY_LAZY && FLYDIY_LAZY.has('map_menu')), pack: !!window.MAP_PACK },
      rows: scr ? scr.querySelectorAll('.mmList .mmRow').length : 0, marks: scr ? [...scr.querySelectorAll('.mmList .mmMark')].map(m => m.textContent).join('') : '',
      at_row: scr && scr.querySelector('.mmAt') ? scr.querySelector('.mmAt').innerText.trim() : '',
      para: scr && scr.querySelector('.mmBody') ? scr.querySelector('.mmBody').innerText.replace(/\s+/g, ' ').trim() : '',
      rightPanel: !!(scr && scr.querySelector('.mmRight,.mmCard,[data-tab]')),
      overlay: S ? S.lastOverlay : null, view: MM && MM.view ? MM.view() : null,
      footer: scr ? (scr.querySelector('.mmFoot') || {}).innerText || '' : '',
      titles: scr ? scr.querySelectorAll('[title]').length : 0, small,
      img: img ? { ok: img.complete && img.naturalWidth > 0, w: img.naturalWidth, h: img.naturalHeight, src: img.getAttribute('src') } : null,
      bg: scr ? getComputedStyle(scr.querySelector('.mmMap')).backgroundColor : null,
      desig: scr ? [...scr.querySelectorAll('.mmRwy text')].map(t => t.textContent) : [],
    };
  });
  // ONE STILL: the page loaded before, the capture, the page loaded after - else discarded and taken again
  const shot = async (pg, size, name, note) => {
    const f = 'map_' + size + '_' + name + '.jpg', p = path.join(OUT, f);
    for (let k = 0; k < 4; k++) {
      await sleep(500);
      const b0 = await loaded(pg);
      if (!b0.ok) { console.log('  (still loading before ' + f + ': ' + JSON.stringify(b0) + ' - waiting)'); await boot(pg); continue; }
      await pg.screenshot({ path: p, type: 'jpeg', quality: 86, timeout: 120000 });
      const b1 = await loaded(pg);
      if (!b1.ok) { console.log('  (loading after ' + f + ': discarded, taken again)'); fs.unlinkSync(p); await boot(pg); continue; }
      const st = await probe(pg);
      const L = REQ.get(pg) || [];
      st.req = { picture: L.some(u => /media\/map\/jolene_art\./.test(u)), bake: L.some(u => /media\/map\/jolene_map\./.test(u)), menu: L.some(u => /map_menu\.js/.test(u)), pack: L.some(u => /map_pack\.js/.test(u)) };
      index.push(Object.assign({ size, name, file: f, note, url: pg.url(), boot: { before: b0, after: b1 } }, st));
      console.log('  ' + f + '  rows ' + st.rows + ' marks ' + st.marks + '  ' + JSON.stringify(st.overlay || {}) + '  ' + note);
      return st;
    }
    check(false, f + ': never captured on a loaded page');
    return probe(pg);
  };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const tap = (pg, sel) => ev(pg, s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const openScreen = async pg => {
    await tap(pg, '#mapEntry');
    return until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && MAP_MENU.model() && (() => { const i = document.querySelector('#mapScreen .mmStage img'); return i && i.complete && i.naturalWidth > 0; })(), 90000);
  };

  // ---- the sandbox: no entry, nothing loaded --------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = watch(await ctx.newPage());
    pg.on('pageerror', e => errs.push('[sandbox] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), 'the sandbox page loaded (the boot overlay gone)');
    await sleep(1000);
    const st = await shot(pg, 'desk', 'sandbox', 'the sandbox (no ?map=1, no ?career=1): today\'s game - no MAP entry, nothing of the map loaded');
    check(!st.entry && !st.loadedMap.menu && !st.loadedMap.pack && !st.req.picture && !st.req.menu && !st.req.pack, 'the sandbox without the flags: no MAP entry, nothing of the screen, its pack or its picture fetched');
    await ctx.close();
  }
  // ---- the desktop, the real record (?career=1) ------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = watch(await ctx.newPage());
    pg.on('pageerror', e => errs.push('[desk] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), '?career=1 loaded (the boot overlay gone)');
    check(await until(pg, () => !!document.getElementById('mapEntry'), 60000), '?career=1: the MAP entry');
    const L0 = (REQ.get(pg) || []).slice();
    check(!L0.some(u => /map_menu\.js|map_pack\.js|media\/map\//.test(u)), 'nothing of the screen fetched before the press');
    check(await openScreen(pg), 'the press loads and opens the screen');
    let st = await shot(pg, 'desk', 'fit', 'the real record (a new dev career) at the fit: the list is the whole interface; the user\'s AI map on its sea; a badge per place');
    check(st.img && st.img.ok && /media\/map\/jolene_art\.[0-9a-f]{8}\.jpg$/.test(st.img.src) && st.img.w === 2167 && st.img.h === 2834, 'the picture is the user\'s AI map, content-hashed, ' + (st.img && st.img.w) + ' x ' + (st.img && st.img.h));
    check(!st.req.bake, 'the bake (jolene_map.png) is not fetched: the painting is the picture');
    check(st.bg === 'rgb(0, 66, 121)', 'the map sits on its edge\'s sea (#004279), no border (' + st.bg + ')');
    check(!st.rightPanel && st.rows === 20, 'no right panel; the list: the 20 offers of a new career (' + st.rows + ')');
    check(/^[✓✗]+$/.test(st.marks) && st.marks.includes('✗'), 'the marks: ✓ / ✗ only (' + st.marks + ')');
    check(st.overlay && st.overlay.badges === 7 && st.overlay.hot === 0, 'at the fit: a badge per place (' + JSON.stringify(st.overlay) + ')');
    check(!st.small.length && !st.titles, 'every visible target >= 48 px, no title= (' + JSON.stringify(st.small).slice(0, 160) + ')');
    // pan: a left-button drag anywhere (from a badge too) moves the map and is not a click
    const v0 = await ev(pg, () => MAP_MENU.view());
    const bb = await ev(pg, () => { const b = document.querySelector('#mapScreen .mmPl[data-place="tw_ski"]'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await pg.mouse.wheel(0, 0); await pg.mouse.move(bb.x, bb.y); await pg.mouse.down(); await pg.mouse.move(bb.x + 40, bb.y + 30, { steps: 6 }); await pg.mouse.up();
    const v1 = await ev(pg, () => MAP_MENU.view()), at1 = await ev(pg, () => MAP_MENU.state().at);
    // (the fit keeps the whole island in view, so a drag at the fit is held by the bounds: pan at a zoom)
    await ev(pg, () => MAP_MENU.zoomTo(2000, -8000, 4));
    const v2 = await ev(pg, () => MAP_MENU.view());
    await pg.mouse.move(800, 450); await pg.mouse.down(); await pg.mouse.move(700, 380, { steps: 8 }); await pg.mouse.up();
    const v3 = await ev(pg, () => MAP_MENU.view());
    check(at1 === null && Math.abs(v1.s - v0.s) < 1e-9, 'a drag that starts on a badge is a pan, not a tap (no filter set)');
    check(Math.abs(v3.tx - v2.tx + 100) < 2 && Math.abs(v3.ty - v2.ty + 70) < 2, 'a left-button drag pans the map (' + (v3.tx - v2.tx).toFixed(0) + ', ' + (v3.ty - v2.ty).toFixed(0) + ' px)');
    const sel = await ev(pg, () => String(getSelection()));
    check(!sel, 'no text selected by the drag');
    await pg.mouse.move(800, 450); await pg.mouse.wheel(0, -300); await sleep(200);
    const v4 = await ev(pg, () => MAP_MENU.view());
    check(v4.s > v3.s, 'the wheel zooms in (' + v3.s.toFixed(3) + ' -> ' + v4.s.toFixed(3) + ')');
    // mid zoom: the names, the places, the hotspots with their rings and counts
    await ev(pg, () => MAP_MENU.zoomTo(-200, -3600, 3));
    st = await shot(pg, 'desk', 'mid', 'mid zoom (3x the fit) over Jolene AFB, Tamgas Hill and Annette Dock: the names with their runway facts, the places of interest, the wildlife hotspots with their zones and counts');
    check(st.overlay.names >= 3 && st.overlay.hot >= 5 && st.overlay.rings >= 1 && st.overlay.counts >= 5 && st.overlay.pois >= 1, 'mid zoom: names, hotspots, rings, counts, places of interest (' + JSON.stringify(st.overlay) + ')');
    // close up at Jolene AFB: its two runways at true scale with their designators
    await ev(pg, () => MAP_MENU.zoomTo(140, 60, 9));
    st = await shot(pg, 'desk', 'close', 'close up at Jolene AFB: 13/31 and 02/20 at true scale - the cleared surround, the concrete, the centreline, the threshold bars, the designators at both ends');
    check(['13', '31', '02', '20'].every(d => st.desig.includes(d)), 'close up: Jolene AFB\'s designators 13 / 31 / 02 / 20 drawn (' + st.desig.join(' ') + ')');
    // a place tapped filters the list
    await ev(pg, () => MAP_MENU.fit());
    await tap(pg, '#mapScreen .mmPl[data-place="SEA"]');
    st = await shot(pg, 'desk', 'place', 'Annette Dock\'s badge tapped: "At Annette Dock ✕" on the list, which holds only the contracts involving it');
    const want = await ev(pg, () => { const M = MAP_MENU.model(); return MAP_MENU.rowsOf(M, { cust: 'all', at: 'SEA' }).length; });
    check(st.at === 'SEA' && /At Annette Dock/.test(st.at_row) && st.rows === want && st.rows > 0 && st.rows < 20, 'the place filter: "' + st.at_row + '", ' + st.rows + ' rows');
    await tap(pg, '#mapScreen .mmAtX');
    check((await probe(pg)).rows === 20, 'the filter row\'s ✕ shows every place again');
    // a contract opened: the paragraph, ONE button; the view does not move
    await ev(pg, () => MAP_MENU.zoomTo(-1500, -6500, 2.2));
    const vb = await ev(pg, () => MAP_MENU.view());
    await tap(pg, '#mapScreen .mmRow[data-id="job:minedock:0:1"]');
    st = await shot(pg, 'desk', 'open', '"Mail off the water" opened: who + what + the pay, the runways condensed, the ✗ (the voucher\'s Cub is on wheels), ONE button - and the map did not move');
    const va = await ev(pg, () => MAP_MENU.view());
    check(va.s === vb.s && va.tx === vb.tx && va.ty === vb.ty, 'no auto-zoom: opening a contract leaves the view as it was');
    check(/Pays [\d ]+\./.test(st.para) && /Annette Dock 1 500 m water lane → Metlakatla Seaplane Base 1 500 m water lane · [\d.]+ km/.test(st.para) && /cannot land on water/.test(st.para) && /Track/.test(st.para), 'the paragraph: ' + st.para.slice(0, 220));
    check(await ev(pg, () => document.querySelectorAll('#mapScreen .mmBody button').length === 1), 'ONE button under the paragraph');
    await tap(pg, '#mapScreen .mmTrack[data-id="job:minedock:0:1"]');
    st = await shot(pg, 'desk', 'tracked', 'Track pressed (accept + track in one gesture): Tracking ★, its places ringed in the cargo colour and joined, the footer');
    const C1 = await ev(pg, () => { const d = window.FLYDIY_CAREER.doc(); return { tracked: d.career.contracts.tracked, accepted: d.career.contracts.accepted }; });
    check(C1.tracked === 'job:minedock:0:1' && C1.accepted.includes('job:minedock:0:1') && /Tracking ★/.test(st.para) && /Mail off the water/.test(st.footer), 'Track wrote the career: accepted and tracked (' + JSON.stringify(C1) + ')');
    await tap(pg, '#mapScreen .mmTrack[data-id="job:minedock:0:1"]');
    const C2 = await ev(pg, () => window.FLYDIY_CAREER.doc().career.contracts.tracked);
    check(C2 === null, 'a second tap untracks (' + C2 + ')');
    await ctx.close();
  }
  // ---- the fixture's fleet: ✓ and ✗ -------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = watch(await ctx.newPage());
    pg.on('pageerror', e => errs.push('[fixture] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&map=1&mapsrc=fixture', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), '?map=1&mapsrc=fixture loaded');
    await until(pg, () => !!document.getElementById('mapEntry'), 60000);
    check(await openScreen(pg), 'the fixture screen opens');
    await tap(pg, '#mapScreen .mmRow[data-id="minedock.j.parts"]');
    const st = await shot(pg, 'desk', 'fixture', 'the fixture\'s fleet (Cub, Jodel, Voyager on wheels; a C172 on floats): ✓ and ✗ on surface vs gear only, the builds unmarked; "Parts to the dock" open (mine street to the dock: no one plane lands on both)');
    check(/✓/.test(st.marks) && /✗/.test(st.marks) && /No one plane of yours lands on both water and land/.test(st.para), 'the fixture: ✓ and ✗, and the reason (' + st.marks + ')');
    await ctx.close();
  }
  // ---- the phone ----------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), pg = watch(await ctx.newPage());
    pg.on('pageerror', e => errs.push('[phone] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1&profile=phone', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), 'the phone page loaded');
    await until(pg, () => !!document.getElementById('mapEntry'), 60000);
    check(await openScreen(pg), 'the phone screen opens');
    let st = await shot(pg, 'phone', 'sheet', 'the phone: the map full screen, the list a bottom sheet (folded), every target >= 48 px');
    check(st.phone && st.sheet === 'peek' && !st.small.length && !st.titles, 'the phone: the sheet folded, every visible target >= 48 px, no title= (' + JSON.stringify(st.small).slice(0, 200) + ')');
    const ta = await ev(pg, () => { const g = s => getComputedStyle(document.querySelector('#mapScreen ' + s)).touchAction; return { map: g('.mmMap'), list: g('.mmList'), handle: g('.mmHandle') }; });
    check(ta.map === 'none' && /pan-y/.test(ta.list) && ta.handle === 'none', 'R20: the map (touch-action ' + ta.map + ') and the sheet (' + ta.list + ', handle ' + ta.handle + ') never share a gesture');
    await tap(pg, '#mapScreen .mmHandle');
    await tap(pg, '#mapScreen .mmRow[data-id="job:resort:0:0"]');
    st = await shot(pg, 'phone', 'open', 'the phone: the sheet open on "Guests for the lodge" (the paragraph and Track)');
    check(st.sheet === 'open' && /Track/.test(st.para) && /Skyline Altiport/.test(st.para) && !st.small.length, 'the phone: the paragraph in the open sheet, every target >= 48 px (' + JSON.stringify(st.small).slice(0, 200) + ')');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  check(index.every(s => s.boot.before.ok && s.boot.after.ok), 'every still kept is of the loaded page (BOOT gone, #boot hidden, before and after)');
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'MAP-SIMPLE stills (G2329): the map screen rebuilt to the approved mock (GAME-2026-10-06.md §R.2)', page: PAGE,
    renderer: 'SwiftShader (headless Chromium)', rule: 'every still is of the LOADED page: BOOT.state gone and #boot hidden, checked before and after each capture; a loading capture is discarded and retaken', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'map_menu_shot: ' + fails.length + ' FAIL' : 'map_menu_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('map_menu_shot threw: ' + (e && e.stack || e)); process.exit(1); });
