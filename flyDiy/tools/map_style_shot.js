#!/usr/bin/env node
// map_style_shot.js - ONE LOOK, THE GARAGE'S, PICTURED AND PROBED (G2449, MAP-STYLE; GAME-2026-10-06.md §R.3: "does the UI
// of the map take the same styling as the sliders in the garage? They should"). The real page (index.html served by
// tools/_serve.js, ?career=1: a new dev career) in headless Chromium on SwiftShader; one still per state, each with the
// page's own answers beside it in shots.json - the computed font of every piece of text on the screen (family, style),
// the --ed-* tokens as #mapScreen resolves them against the workshop's, the verbs' / switch's / zoom's computed dress.
//
// EVERY STILL IS OF THE LOADED PAGE (the user's rule): the boot overlay gone (BOOT.state 'gone', #boot hidden) plus 2 s,
// checked BEFORE and AFTER each capture; a still taken while the page was loading is discarded and taken again.
//
//   desk_garage        the garage as the page boots into it (the editor's panels): the look the map now takes
//   desk_contracts     the map screen, the contracts list with a paragraph open (Track, the accent), the map at the fit
//   desk_market        the Market (the switch: the garage's segmented control), a model opened (its gear select, Buy)
//   desk_fit           the whole island at the fit: the badges, the zoom + / − / fit, the scale bar, the compass
//   desk_close         Metlakatla close (8x): MAP-INFRA's labels (the town, the cannery, the tram), the place names
//   desk_mid           the middle zoom over Jolene AFB: the place names with their runway facts, the hotspots' names
//   one_look           ONE STILL, side by side: the garage's editor panel | the map screen's list (the user sees one look)
//   phone_sheet        the phone (?profile=phone, 390 x 844, touch): the map, the folded sheet, the zoom
//   phone_open         ...the sheet open on a contract's paragraph (Track)
//
//   node tools/_serve.js 8125 <repo root> &   node tools/map_style_shot.js [--out futureDesigns/game/evidence/MAP-STYLE] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('map_style_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'futureDesigns/game/evidence/MAP-STYLE'));
const PORT = +opt('port', 8125), PAGE = opt('page', 'index.html');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TOK = ['panel', 'board', 'plate', 'ink', 'dim', 'faint', 'acc', 'acc-ink', 'acc-soft', 'hair', 'border', 'btn-bg', 'btn-bd', 'track', 'bad'];

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
  // THE LOOK, as the page computes it: every visible piece of text on the screen (its family and style), the tokens
  // #mapScreen resolves against the workshop root's, the controls' dress
  const probe = (pg, tok) => pg.evaluate(TOK => {
    const scr = document.getElementById('mapScreen'), MM = window.MAP_MENU, S = MM && MM.state ? MM.state() : null;
    if (!scr) return { open: false };
    const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
    const texts = [];
    for (const el of scr.querySelectorAll('*')) {
      if (!vis(el)) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
      if (!own) continue;
      const cs = getComputedStyle(el);
      texts.push({ cls: (el.getAttribute('class') || el.tagName.toLowerCase()).split(' ')[0], t: own.slice(0, 24), family: cs.fontFamily, style: cs.fontStyle, weight: cs.fontWeight, size: cs.fontSize });
    }
    const bad = texts.filter(x => !/^"?IBM Plex Sans"?/.test(x.family) || x.style !== 'normal');
    const ws = document.getElementById('wsUI') || document.getElementById('edView');
    const tokens = {}; for (const t of TOK) { const a = getComputedStyle(scr).getPropertyValue('--ed-' + t).trim(), b = ws ? getComputedStyle(ws).getPropertyValue('--ed-' + t).trim() : null; tokens[t] = { map: a, garage: b, same: !!a && a === b }; }
    const dress = sel => { const e = scr.querySelector(sel); if (!e || !vis(e)) return null; const cs = getComputedStyle(e); return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, font: cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily.split(',')[0], tt: cs.textTransform, h: Math.round(e.getBoundingClientRect().height) }; };
    const small = [...scr.querySelectorAll('button,select')].filter(vis).map(b => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(b => b.w < 48 || b.h < 48);
    const byCls = {}; for (const x of texts) if (!byCls[x.cls]) byCls[x.cls] = x.weight + ' ' + x.size + ' ' + x.style + ' ' + x.family.split(',')[0];
    return { open: true, list: S && S.list, item: S && S.item, opened: S && S.open, sheet: S && S.sheet, phone: S && S.phone, overlay: S && S.lastOverlay,
      texts: texts.length, bad: bad.slice(0, 12), byCls, tokens, plexLoaded: document.fonts.check("500 13px 'IBM Plex Sans'"),
      dress: { primary: dress('.mmBody .mmTrack:not(.on)') || dress('.mmBody .mmAct:not(.sec)'), select: dress('.mmCust') || dress('.mmOptSel'), switchOn: dress('.mmSwB.on'), switchOff: dress('.mmSwB:not(.on)'), zoom: dress('.mmCtl button'), scale: dress('.mmScale') },
      labels: { lbl: scr.querySelectorAll('.mmLbl').length, names: scr.querySelectorAll('.mmNm').length, hotN: scr.querySelectorAll('.mmHotN').length, poi: scr.querySelectorAll('.mmPoi').length },
      small, titles: scr.querySelectorAll('[title]').length };
  }, TOK);
  const shot = async (pg, size, name, note, clip) => {
    const f = 'map_style_' + size + '_' + name + '.jpg', p = path.join(OUT, f);
    for (let k = 0; k < 4; k++) {
      await sleep(2000);   // the page loaded, plus 2 s
      const b0 = await loaded(pg);
      if (!b0.ok) { console.log('  (still loading before ' + f + ' - waiting)'); await boot(pg); continue; }
      await pg.screenshot({ path: p, type: 'jpeg', quality: 88, timeout: 120000, clip });
      const b1 = await loaded(pg);
      if (!b1.ok) { console.log('  (loading after ' + f + ': discarded, taken again)'); fs.unlinkSync(p); await boot(pg); continue; }
      const st = await probe(pg);
      index.push(Object.assign({ size, name, file: f, note, url: pg.url(), boot: { before: b0, after: b1 } }, st));
      console.log('  ' + f + '  texts ' + st.texts + ' (not Plex upright: ' + (st.bad ? st.bad.length : '-') + ')  ' + JSON.stringify(st.labels || {}) + '  ' + note.slice(0, 80));
      return { st, p };
    }
    check(false, f + ': never captured on a loaded page');
    return { st: await probe(pg), p };
  };
  const lookOk = (st, f) => {
    check(st.bad && !st.bad.length && st.texts > 10, f + ': every piece of text (' + st.texts + ') IBM Plex Sans, upright' + (st.bad && st.bad.length ? ' - ' + JSON.stringify(st.bad).slice(0, 200) : ''));
    const diff = Object.entries(st.tokens || {}).filter(([, v]) => !v.same).map(([k]) => k);
    check(!diff.length, f + ': #mapScreen resolves the workshop\'s --ed-* tokens to the garage\'s values' + (diff.length ? ' - differs: ' + diff.join(', ') : ''));
    check(!st.small.length && !st.titles, f + ': every visible target >= 48 px, no title= (' + JSON.stringify(st.small).slice(0, 160) + ')');
  };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const tap = (pg, sel) => ev(pg, s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const openScreen = async pg => {
    await tap(pg, '#mapEntry');
    return until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && MAP_MENU.model() && (() => { const i = document.querySelector('#mapScreen .mmStage img'); return i && i.complete && i.naturalWidth > 0; })(), 90000);
  };
  let garageJpg = null, listJpg = null;

  // ---- the desktop, the real record (?career=1) ------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[desk] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), '?career=1 loaded (the boot overlay gone)');
    check(await until(pg, () => !!document.getElementById('mapEntry') && !!document.getElementById('edWrap') && getComputedStyle(document.getElementById('edWrap')).display !== 'none', 60000), 'the garage is up (the editor\'s panels) and the MAP entry');
    // the design flow's welcome sheet sits over the garage on a fresh page: keep the current build (its own button)
    await tap(pg, '.dfClose');
    await until(pg, () => !document.querySelector('.dfClose') || !document.querySelector('.dfClose').offsetParent, 10000);
    let { st, p } = await shot(pg, 'desk', 'garage', 'the garage as the page boots into it: the editor\'s panels - the look the map screen now takes');
    garageJpg = p;
    const edRect = await ev(pg, () => { const r = document.getElementById('edWrap').getBoundingClientRect(); return { x: Math.round(r.left), y: 0, w: Math.round(r.width), h: Math.round(r.height) }; });
    check(await openScreen(pg), 'the press loads and opens the map screen');
    await tap(pg, '#mapScreen .mmRow[data-id="job:minedock:0:1"]');
    ({ st, p } = await shot(pg, 'desk', 'contracts', 'the contracts list, "Mail off the water" opened: the paragraph in Plex, the ✗ in the garage\'s alert colour, Track the primary verb (the accent); the customer select the rows\' select; the switch the segmented control'));
    listJpg = p; lookOk(st, 'contracts');
    check(st.dress.primary && st.dress.primary.tt === 'uppercase' && st.dress.primary.bg === 'rgb(230, 219, 201)' && st.dress.primary.color === 'rgb(34, 31, 27)', 'Track is the garage\'s primary verb (.verb.pri: --ed-acc on --ed-acc-ink, uppercase) ' + JSON.stringify(st.dress.primary));
    check(st.dress.select && st.dress.select.bg === 'rgba(255, 255, 255, 0.06)' && st.dress.select.border === 'rgba(255, 255, 255, 0.18)' && st.dress.select.h >= 48, 'the customer select is the rows\' select (--ed-btn-bg / --ed-btn-bd), ' + st.dress.select.h + ' px');
    check(st.dress.switchOn && st.dress.switchOn.bg === 'rgb(230, 219, 201)' && st.dress.switchOff.color === 'rgb(151, 144, 127)', 'the switch is the segmented control (on: the accent; off: --ed-faint) ' + JSON.stringify([st.dress.switchOn, st.dress.switchOff]));
    await tap(pg, '#mapScreen .mmSwB[data-list="market"]');
    await tap(pg, '#mapScreen .mmRow[data-id="m:scout"]');
    ({ st } = await shot(pg, 'desk', 'market', 'the Market (the switch on Market): the makers\' models, the used aeroplanes; the Bramble Scout opened - its gear select and Buy, the garage\'s'));
    lookOk(st, 'market');
    check(st.list === 'market' && st.dress.primary && st.dress.primary.bg === 'rgb(230, 219, 201)', 'the Market: Buy is the primary verb');
    await tap(pg, '#mapScreen .mmSwB[data-list="contracts"]');
    await ev(pg, () => MAP_MENU.fit());
    ({ st } = await shot(pg, 'desk', 'fit', 'the whole island at the fit: the badges (the bone face of the garage\'s accent, the icons and type rings unchanged), the zoom + / − / fit and the scale bar on the garage\'s plate, the compass lettered in Plex'));
    lookOk(st, 'fit');
    check(st.dress.zoom && st.dress.zoom.bg === 'rgba(32, 29, 26, 0.94)' && st.dress.scale && st.dress.scale.bg === 'rgba(32, 29, 26, 0.94)', 'the zoom and the scale bar sit on --ed-plate');
    await ev(pg, () => MAP_MENU.zoomTo(-3330, -8780, 8));
    ({ st } = await shot(pg, 'desk', 'close', 'Metlakatla close (8x): MAP-INFRA\'s labels in Plex upright over the painting - METLAKATLA the town (700, 16 px, spaced capitals), the cannery and the tram (500, 12.5 px), the halo in the garage\'s inks; the place names on the plate'));
    lookOk(st, 'close');
    check(st.labels.lbl >= 2, 'close: MAP-INFRA\'s labels drawn (' + st.labels.lbl + ')');
    await ev(pg, () => MAP_MENU.zoomTo(-200, -3600, 3));
    ({ st } = await shot(pg, 'desk', 'mid', 'the middle zoom over Jolene AFB, Tamgas Hill and Annette Dock: the place names with their runway facts, the places of interest, the hotspots\' names - all Plex upright'));
    lookOk(st, 'mid');
    check(st.labels.names >= 3 && st.labels.hotN >= 3, 'mid: the place names and the hotspots\' names drawn (' + JSON.stringify(st.labels) + ')');
    // ONE STILL, side by side: the garage's editor panel | the map's list with its paragraph open
    const b64 = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
    const comp = await ctx.newPage();
    await comp.setViewportSize({ width: edRect.w + 760 + 24, height: 900 });
    await comp.setContent('<body style="margin:0;background:#111;display:flex;gap:24px">' +
      '<div style="width:' + edRect.w + 'px;height:900px;overflow:hidden;position:relative"><img src="' + b64(garageJpg) + '" style="position:absolute;left:' + (-edRect.x) + 'px;top:0"></div>' +
      '<div style="width:760px;height:900px;overflow:hidden;position:relative"><img src="' + b64(listJpg) + '" style="position:absolute;left:0;top:0"></div></body>');
    await sleep(500);
    await comp.screenshot({ path: path.join(OUT, 'map_style_one_look.jpg'), type: 'jpeg', quality: 88 });
    index.push({ size: 'desk', name: 'one_look', file: 'map_style_one_look.jpg', note: 'ONE STILL, side by side: the garage\'s editor panel (left, cropped from map_style_desk_garage.jpg at #edWrap\'s box ' + JSON.stringify(edRect) + ') | the map screen\'s list and the start of the map (right, cropped from map_style_desk_contracts.jpg): one palette, one face, one set of controls', from: [path.basename(garageJpg), path.basename(listJpg)] });
    console.log('  map_style_one_look.jpg  (composed from the two loaded-page stills)');
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
    let { st } = await shot(pg, 'phone', 'sheet', 'the phone: the map full screen, the zoom and the close on the plate, the list a folded bottom sheet (the switch, the select) - every target >= 48 px');
    lookOk(st, 'phone sheet');
    check(st.phone && st.sheet === 'peek', 'the phone: the sheet folded');
    await tap(pg, '#mapScreen .mmHandle');
    await tap(pg, '#mapScreen .mmRow[data-id="job:resort:0:0"]');
    await ev(pg, () => { const b = document.querySelector('#mapScreen .mmBody .mmTrack'); if (b) b.scrollIntoView({ block: 'end' }); });   // the paragraph and Track in the sheet's view
    ({ st } = await shot(pg, 'phone', 'open', 'the phone: the sheet open on "Guests for the lodge" - the paragraph and Track, the garage\'s, at touch size'));
    lookOk(st, 'phone open');
    check(st.sheet === 'open' && st.dress.primary && st.dress.primary.h >= 48, 'the phone: Track in the open sheet, ' + (st.dress.primary && st.dress.primary.h) + ' px');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  check(index.filter(s => s.boot).every(s => s.boot.before.ok && s.boot.after.ok), 'every still kept is of the loaded page (BOOT gone, #boot hidden, before and after)');
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'MAP-STYLE stills (G2449): the map screen in the garage\'s look (GAME-2026-10-06.md §R.3) - the --ed-* tokens, IBM Plex Sans upright, the garage\'s controls', page: PAGE,
    renderer: 'SwiftShader (headless Chromium)', rule: 'every still is of the LOADED page: BOOT.state gone and #boot hidden, plus 2 s, checked before and after each capture; a loading capture is discarded and retaken; one_look is composed from two such stills', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'map_style_shot: ' + fails.length + ' FAIL' : 'map_style_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('map_style_shot threw: ' + (e && e.stack || e)); process.exit(1); });
