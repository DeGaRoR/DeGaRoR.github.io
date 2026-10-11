#!/usr/bin/env node
// map_infra_shot.js - THE MAP'S INFRASTRUCTURE, PICTURED AND PROBED (G2439, MAP-INFRA). The real page (index.html served by
// tools/_serve.js, ?career=1: a new dev career) in headless Chromium on SwiftShader; the map screen with the projection's
// `infra` drawn over the user's painting. One still per view, each with the page's own answers beside it in shots.json.
//
// EVERY STILL IS OF THE LOADED PAGE (the user's rule): the boot overlay gone (BOOT.state 'gone', #boot hidden) and 2 s more,
// checked BEFORE and AFTER each capture; a still taken while the page was loading is discarded and taken again.
//
//   desk_island        the whole island at the fit: the settlements (the village, Metlakatla) tinted, the main roads, the tramway
//   desk_village       Jolene AFB and the village at mid zoom (3x): every road, the tracks dashed, the village's houses, its label
//   desk_metlakatla    Metlakatla close (8x): the town's streets, its houses, the cannery, the piers and breakwaters, the labels
//   desk_tramway       the Skyline Tramway (5x): the cable with its ticks, the two stations, the access road, the altiport
//   phone_infra        the phone (390 x 844, touch): Metlakatla and the tram at mid zoom over the folded sheet
//
//   node tools/_serve.js 8125 <repo root> &   node tools/map_infra_shot.js [--out futureDesigns/game/evidence/MAP-INFRA] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('map_infra_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'futureDesigns/game/evidence/MAP-INFRA'));
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
  const boot = async pg => { const ok = await until(pg, () => window.BOOT && BOOT.state === 'gone' && (() => { const e = document.getElementById('boot'); return !e || e.hidden || getComputedStyle(e).display === 'none'; })(), 420000); await sleep(2000); return ok; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  // the page's answers: the infrastructure drawn (the layer's counts), the labels, and what takes a pointer
  const probe = pg => ev(pg, () => {
    const scr = document.getElementById('mapScreen'), MM = window.MAP_MENU, S = MM && MM.state ? MM.state() : null;
    const inf = scr ? scr.querySelector('.mmInfra') : null;
    return {
      open: !!scr, phone: S ? S.phone : null, view: MM && MM.view ? MM.view() : null, infra: S ? S.lastInfra : null, overlay: S ? S.lastOverlay : null,
      layer: inf ? { pe: getComputedStyle(inf).pointerEvents, kids: inf.querySelectorAll('*').length, autoPe: [...inf.querySelectorAll('*')].filter(e => getComputedStyle(e).pointerEvents !== 'none').length } : null,
      labels: scr ? [...scr.querySelectorAll('.mmLbl')].map(l => ({ t: l.textContent, pe: getComputedStyle(l).pointerEvents })) : [],
      pois: scr ? [...scr.querySelectorAll('.mmPoi')].map(l => l.textContent) : [],
      img: scr ? (i => ({ ok: i.complete && i.naturalWidth > 0, src: i.getAttribute('src') }))(scr.querySelector('.mmStage img')) : null,
    };
  });
  const shot = async (pg, size, name, note) => {
    const f = 'map_infra_' + size + '_' + name + '.jpg', p = path.join(OUT, f);
    for (let k = 0; k < 4; k++) {
      await sleep(600);
      const b0 = await loaded(pg);
      if (!b0.ok) { console.log('  (still loading before ' + f + ': ' + JSON.stringify(b0) + ' - waiting)'); await boot(pg); continue; }
      await pg.screenshot({ path: p, type: 'jpeg', quality: 86, timeout: 120000 });
      const b1 = await loaded(pg);
      if (!b1.ok) { console.log('  (loading after ' + f + ': discarded, taken again)'); fs.unlinkSync(p); await boot(pg); continue; }
      const st = await probe(pg);
      index.push(Object.assign({ size, name, file: f, note, url: pg.url(), boot: { before: b0, after: b1 } }, st));
      console.log('  ' + f + '  ' + JSON.stringify(st.infra || {}) + '  labels ' + st.labels.map(l => l.t).join(', ') + '  ' + note);
      return st;
    }
    check(false, f + ': never captured on a loaded page');
    return probe(pg);
  };
  const openScreen = async pg => {
    await ev(pg, () => { const b = document.getElementById('mapEntry'); if (b) b.click(); });
    return until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && MAP_MENU.model() && (() => { const i = document.querySelector('#mapScreen .mmStage img'); return i && i.complete && i.naturalWidth > 0; })(), 90000);
  };
  // a pixel of a drawn road on the screen (the first main road's finest band, its middle vertex), to press on
  const roadPt = pg => ev(pg, () => {
    const P = MAP_PACK, V = MAP_MENU.view(), r = MAP_PACK.infra.roads.find(q => q.id === 'r_village'), pts = r.p[2].split(' ').map(q => q.split(',').map(Number)), m = pts[pts.length >> 1];
    const box = document.querySelector('#mapScreen .mmMap').getBoundingClientRect();
    void P; return { x: box.left + V.tx + m[0] * V.s, y: box.top + V.ty + m[1] * V.s };
  });

  // ---- the desktop ---------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[desk] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), '?career=1 loaded (the boot overlay gone, + 2 s)');
    check(await until(pg, () => !!document.getElementById('mapEntry'), 60000), '?career=1: the MAP entry');
    check(await openScreen(pg), 'the press loads and opens the screen');
    let st = await shot(pg, 'desk', 'island', 'the whole island at the fit: the settlements tinted and hatched (the village by Annette Dock, Metlakatla), the main roads in ochre, the Skyline Tramway with its stations');
    const I = await ev(pg, () => ({ roads: MAP_PACK.infra.roads.length, main: MAP_PACK.infra.roads.filter(r => r.main).length, zones: MAP_PACK.infra.zones.length, houses: MAP_PACK.infra.houses.split(' ').length, sites: MAP_PACK.infra.sites.length }));
    check(st.infra && st.infra.zones === I.zones && st.infra.roads === I.main && st.infra.links === 1 && !st.infra.houses, 'at the fit: ' + I.zones + ' settlement zones, the ' + I.main + ' main roads, the tramway, no buildings (' + JSON.stringify(st.infra) + ')');
    check(st.layer && st.layer.pe === 'none' && st.layer.kids > 20 && st.layer.autoPe === 0, 'the infrastructure layer takes no pointer (' + JSON.stringify(st.layer) + ')');
    // a left-button drag that starts ON a road pans the map (nothing of the drawing is dragged or tapped)
    await ev(pg, () => MAP_MENU.zoomTo(300, -1500, 3));
    const rp = await roadPt(pg), v0 = await ev(pg, () => MAP_MENU.view());
    const hit = await ev(pg, p => { const e = document.elementFromPoint(p.x, p.y); return e ? (e.closest('.mmInfra') ? 'infra' : e.closest('.mmMap') ? 'map:' + e.className : e.tagName) : null; }, rp);
    await pg.mouse.move(rp.x, rp.y); await pg.mouse.down(); await pg.mouse.move(rp.x - 90, rp.y - 60, { steps: 8 }); await pg.mouse.up();
    const v1 = await ev(pg, () => MAP_MENU.view()), at1 = await ev(pg, () => MAP_MENU.state().at), sel = await ev(pg, () => String(getSelection()));
    check(hit !== 'infra' && Math.abs(v1.tx - v0.tx + 90) < 2 && Math.abs(v1.ty - v0.ty + 60) < 2 && at1 === null && !sel,
      'a left-button drag from a drawn road pans the map by the pointer\'s travel (' + (v1.tx - v0.tx).toFixed(0) + ', ' + (v1.ty - v0.ty).toFixed(0) + ' px; the road is not hit: ' + hit + '), no filter, no selection');
    await ev(pg, () => MAP_MENU.zoomTo(250, -1600, 3));
    st = await shot(pg, 'desk', 'village', 'Jolene AFB and the village at mid zoom (3x): every road (the airfield road and the village street in gravel, the tracks dashed), the village\'s houses and its label, the badges and runways over them');
    check(st.infra.roads === I.roads && st.infra.tracks > 0 && st.infra.houses === I.houses && st.labels.some(l => l.t === 'the village'), 'mid zoom: all ' + I.roads + ' roads, the tracks, the houses, "the village" (' + JSON.stringify(st.infra) + ')');
    await ev(pg, () => MAP_MENU.zoomTo(-3330, -8780, 8));
    st = await shot(pg, 'desk', 'metlakatla', 'Metlakatla close (8x): the town\'s grid of streets (cased: a light core over a dark edge), the arterials in ochre, every house a brick block, the cannery, the piers in plank, the breakwaters in stone, the harbour hatched blue; "Metlakatla" and "the cannery" named once');
    check(st.infra.band === 2 && st.infra.sites === I.sites && st.labels.some(l => l.t === 'Metlakatla') && st.labels.some(l => l.t === 'the cannery') && !st.pois.includes('Metlakatla') && !st.pois.includes('the cannery'),
      'close: the finest band, every footprint, the town and the cannery named once (' + st.labels.map(l => l.t).join(', ') + ')');
    check(st.labels.every(l => l.pe === 'none'), 'the labels take no pointer');
    await ev(pg, () => MAP_MENU.zoomTo(-650, -7850, 5));
    st = await shot(pg, 'desk', 'tramway', 'the Skyline Tramway (5x): the cable in ink with its ticks, the valley and summit stations, the access road, the altiport and the lodge');
    check(st.infra.links === 1 && st.infra.stations === 2 && st.labels.some(l => l.t === 'Skyline Tramway'), 'the tramway: its cable, its two stations, its label');
    await ctx.close();
  }
  // ---- the phone ------------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[phone] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1&profile=phone', { waitUntil: 'domcontentloaded' });
    check(await boot(pg), 'the phone page loaded (+ 2 s)');
    await until(pg, () => !!document.getElementById('mapEntry'), 60000);
    check(await openScreen(pg), 'the phone screen opens');
    await ev(pg, () => MAP_MENU.zoomTo(-2400, -8200, 3));
    const st = await shot(pg, 'phone', 'infra', 'the phone (390 x 844): Metlakatla, its houses and streets, the tramway, the labels at mid zoom, over the folded sheet');
    check(st.phone && st.infra && st.infra.houses > 0 && st.infra.links === 1 && st.layer.pe === 'none' && st.layer.autoPe === 0, 'the phone: the same drawing, no pointer taken (' + JSON.stringify(st.infra) + ')');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  check(index.length === 5 && index.every(s => s.boot.before.ok && s.boot.after.ok), 'every still kept is of the loaded page (BOOT gone, #boot hidden, before and after)');
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'MAP-INFRA stills (G2439): the island\'s infrastructure drawn over the user\'s painting', page: PAGE,
    renderer: 'SwiftShader (headless Chromium)', rule: 'every still is of the LOADED page: BOOT.state gone and #boot hidden + 2 s, checked before and after each capture; a loading capture is discarded and retaken', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'map_infra_shot: ' + fails.length + ' FAIL' : 'map_infra_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('map_infra_shot threw: ' + (e && e.stack || e)); process.exit(1); });
