#!/usr/bin/env node
// map_menu_shot.js - THE MAP SCREEN, PICTURED AND PROBED (G2256 MAP-MENU; rewritten for G2329 MAP-SIMPLE, the screen
// rebuilt to the approved mock, GAME-2026-10-06.md §R.2; G2444 MAP-MERGE: + the switch's three other lists). The real page (index.html served by tools/_serve.js) in
// headless Chromium on SwiftShader, one still per state, each with the page's own answers beside it in shots.json.
//
// EVERY STILL IS OF THE LOADED PAGE (the user's rule): the boot overlay gone (BOOT.state 'gone', #boot hidden) plus 2 s,
// checked BEFORE and AFTER each capture; a still taken while the page was loading is discarded and taken again, never kept.
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
//   (G2444 MAP-MERGE, the switch at the top of the list - each list the contracts' way, its markers on the map)
//   desk_market        Market: the makers' models and the used listings (their markers where they stand); the voucher's
//                      Scout opened (seats, payload, gear, range, the price; ONE button) - then Buy (the voucher pays) and
//                      a used one bought where it stands: the wallet spends its price (ECONOMY's rules)
//   desk_fleet         Fleet: your aeroplanes, a marker each at its base; one opened
//   desk_pilots        Pilots: Kit hired, the ones looking for work; Kit's marker at HOME; Rafe opened (Hire · fee) - then
//                      hired: the wallet spends the sign-on
//   phone_market       the phone: the sheet open on the Market list
//
//   node tools/_serve.js 8125 <repo root> &   node tools/map_menu_shot.js [--out futureDesigns/game/evidence/MAP-MERGE] [--port 8125]
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
const OUT = path.resolve(ROOT, opt('out', 'futureDesigns/game/evidence/MAP-MERGE'));
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
      list: S ? S.list : null, item: S ? S.item : null, msg: S ? S.msg || '' : '', lm: scr ? scr.querySelectorAll('.mmLm').length : 0,
      keys: scr ? [...scr.querySelectorAll('.mmList .mmItem[data-key]')].map(e => e.dataset.key) : [],
      buttons: scr && scr.querySelector('.mmBody') ? scr.querySelectorAll('.mmBody button').length : 0,
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
      await sleep(2000);   // the page loaded, plus 2 s
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
    // ---- G2444 (MAP-MERGE): THE SWITCH - Market, Fleet, Pilots; each the contracts' way, its markers on the map ----
    await ev(pg, () => MAP_MENU.fit());
    const wallet = () => ev(pg, () => window.FLYDIY_PLAYER.doc().wallet);
    await tap(pg, '#mapScreen .mmSwB[data-list="market"]');
    await tap(pg, '#mapScreen .mmRow[data-id="m:scout"]');
    st = await shot(pg, 'desk', 'market', 'the Market (the switch at the top of the list): the makers\' models, then the used aeroplanes (⚑ on the map where they stand); the Bramble Scout opened - seats, payload, gear, range, the voucher pays; ONE button');
    check(st.list === 'market' && st.keys.filter(k => k.startsWith('m:')).length === 4 && st.keys.some(k => k.startsWith('u:')) && st.lm >= 1 && !st.rightPanel, 'the Market list: 4 models, the used listings, their markers (' + st.lm + '), no right panel');
    check(/2 seats/.test(st.para) && /kg payload/.test(st.para) && /on wheels/.test(st.para) && /km range/.test(st.para) && /voucher pays/.test(st.para) && st.buttons === 1, 'the Scout\'s paragraph: ' + st.para.slice(0, 200));
    check(!st.small.length && !st.titles, 'the Market: every visible target >= 48 px (' + JSON.stringify(st.small).slice(0, 160) + ')');
    const w0 = await wallet();
    await tap(pg, '#mapScreen .mmAct[data-act="buy"][data-id="m:scout"]');
    check(await until(pg, () => /is yours/.test(MAP_MENU.state().msg || ''), 60000), 'Buy: the voucher\'s Scout bought (' + (await probe(pg)).msg + ')');
    const w1 = await wallet();
    check(w1 === w0 && /the voucher paid/.test((await probe(pg)).msg), 'the voucher paid: the wallet unchanged (' + w0 + ' -> ' + w1 + ') and said so');
    const used = await ev(pg, () => { const K = MAP_MENU.model().market; const L = K.used.slice().sort((a, b) => a.price - b.price)[0]; return L ? { id: L.id, price: L.price } : null; });
    if (used && w1 >= used.price) {
      await tap(pg, '#mapScreen .mmRow[data-id="u:' + used.id + '"]');
      await tap(pg, '#mapScreen .mmAct[data-act="buy"][data-id="u:' + used.id + '"]');
      check(await until(pg, () => /is yours/.test(MAP_MENU.state().msg || ''), 60000), 'Buy where it stands: ' + used.id + ' (' + (await probe(pg)).msg + ')');
      const w2 = await wallet();
      const um = (await probe(pg)).msg, fmtN = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      check(w2 === w1 - used.price && um.includes('paid ' + fmtN(used.price)), 'the career\'s Buy spends the wallet: ' + w1 + ' - ' + used.price + ' = ' + w2 + ' ("' + um + '")');
    } else check(false, 'no used listing the wallet can pay (' + w1 + ', ' + JSON.stringify(used) + ')');
    await tap(pg, '#mapScreen .mmSwB[data-list="fleet"]');
    const fk = (await probe(pg)).keys;
    await tap(pg, '#mapScreen .mmRow[data-id="' + fk[fk.length - 1] + '"]');
    st = await shot(pg, 'desk', 'fleet', 'the Fleet: the aeroplanes just bought, a ✈ marker each at its base (the used one where it stood); the last opened - where it stands, seats, payload, gear, range');
    check(st.list === 'fleet' && st.keys.length >= 2 && st.lm >= 2 && /kg payload/.test(st.para) && st.buttons === 0 && !st.rightPanel, 'the Fleet list: ' + st.keys.join(', ') + '; ' + st.lm + ' markers; "' + st.para.slice(0, 160) + '"');
    // a list's marker tapped filters the list to its place (no zoom)
    const vm0 = await ev(pg, () => MAP_MENU.view());
    const mkk = await ev(pg, () => { const b = document.querySelector('#mapScreen .mmLm'); b.click(); return b.dataset.key; });
    const pm = await probe(pg), vm1 = await ev(pg, () => MAP_MENU.view());
    check(pm.at && /^At /.test(pm.at_row) && pm.item === mkk && pm.keys.includes(mkk) && vm0.s === vm1.s && vm0.tx === vm1.tx, 'a Fleet marker tapped: "' + pm.at_row + '", its row opened, the view unmoved');
    await tap(pg, '#mapScreen .mmAtX');
    await tap(pg, '#mapScreen .mmSwB[data-list="pilots"]');
    const pwant = await ev(pg, () => (MAP_MENU.model().pilots.find(p => !p.hired) || {}).id);
    await tap(pg, '#mapScreen .mmRow[data-id="p:' + pwant + '"]');
    st = await shot(pg, 'desk', 'pilots', 'the Pilots: Kit hired (Kit\'s marker at Jolene AFB), the ones looking for work; ' + pwant + ' opened - the line, how they fly, the traits, Hire · the sign-on');
    check(st.list === 'pilots' && st.keys.includes('p:kit') && st.lm >= 1 && /Flies like/.test(st.para) && /Hire · [\d ]+/.test(st.para) && st.buttons === 1, 'the Pilots list: ' + st.keys.join(', ') + '; "' + st.para.slice(0, 160) + '"');
    const w3 = await wallet(), fee = await ev(pg, id => MAP_MENU.model().pilots.find(p => p.id === id).signOn, pwant);
    await tap(pg, '#mapScreen .mmAct[data-act="pilot"][data-pa="hire"]');
    const hired = await ev(pg, id => (MAP_MENU.model().pilots.find(p => p.id === id) || {}).hired, pwant), w4 = await wallet();
    check(hired && w4 === w3 - fee, 'Hire: ' + pwant + ' hired, the sign-on paid (' + w3 + ' - ' + fee + ' = ' + w4 + ')');
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
    // (G2444) the sandbox's Market takes free (PROCURE's rule)
    await tap(pg, '#mapScreen .mmSwB[data-list="market"]');
    await tap(pg, '#mapScreen .mmRow[data-id="m:pinson"]');
    const sw0 = await ev(pg, () => window.FLYDIY_PLAYER.doc().wallet);
    check(/Take it · free in the sandbox/.test((await probe(pg)).para), 'the sandbox: Take it, free');
    await tap(pg, '#mapScreen .mmAct[data-act="buy"][data-id="m:pinson"]');
    check(await until(pg, () => /is yours/.test(MAP_MENU.state().msg || ''), 60000), 'the sandbox: taken (' + (await probe(pg)).msg + ')');
    const sw1 = await ev(pg, () => window.FLYDIY_PLAYER.doc().wallet);
    check(sw1 === sw0, 'the sandbox: the wallet untouched (' + sw0 + ' -> ' + sw1 + ')');
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
    // (G2444) the switch on the phone: the Market in the open sheet
    await tap(pg, '#mapScreen .mmSwB[data-list="market"]');
    await tap(pg, '#mapScreen .mmRow[data-id="u:' + (await ev(pg, () => MAP_MENU.model().market.used[0].id)) + '"]');
    st = await shot(pg, 'phone', 'market', 'the phone: the switch in the sheet, the Market list, a used aeroplane opened (where it stands, the facts, Buy where it stands)');
    check(st.list === 'market' && st.sheet === 'open' && /Stands at/.test(st.para) && st.buttons === 1 && !st.small.length, 'the phone Market: "' + st.para.slice(0, 140) + '", every target >= 48 px (' + JSON.stringify(st.small).slice(0, 200) + ')');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  check(index.every(s => s.boot.before.ok && s.boot.after.ok), 'every still kept is of the loaded page (BOOT gone, #boot hidden, before and after)');
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'MAP-MERGE stills (G2444): MAP-SIMPLE\'s map screen (GAME-2026-10-06.md §R.2) + the switch\'s Fleet / Pilots / Market', page: PAGE,
    renderer: 'SwiftShader (headless Chromium)', rule: 'every still is of the LOADED page: BOOT.state gone and #boot hidden, plus 2 s, checked before and after each capture; a loading capture is discarded and retaken', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'map_menu_shot: ' + fails.length + ' FAIL' : 'map_menu_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('map_menu_shot threw: ' + (e && e.stack || e)); process.exit(1); });
