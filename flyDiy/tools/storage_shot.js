#!/usr/bin/env node
// storage_shot.js - THE STORAGE PANEL ON THE REAL PAGE (G2690-G2699, HANGAR-STORAGE-1). index.html served by
// tools/_serve.js in headless Chromium on SwiftShader. STILLS OF A LOADED PAGE ONLY: every still is taken after
// BOOT.state 'gone', #boot hidden and 2 s more (never a loading screen). The page's own answers go to shots.json.
// A sandbox shelf of six saved aeroplanes (the validated Cub, Jodel and C172 envelopes under six names) placed at HOME:
// two inside, two on the apron, two long-term; the garage's stand as the boot left it.
//   desk_open       the panel opened from the shelf's `storage` (the floor, INSIDE 2/2, OUTSIDE 2/6, LONG-TERM 2)
//   desk_selected   a card tapped (the columns light as targets)
//   desk_moved      ...then the LONG-TERM column tapped: the move written, its line in the panel
//   desk_dropped    a long-term card DRAGGED (the pointer's own drag and drop) onto apron slot 3
//   desk_refused    a card dropped on an inside slot that is taken: refused, the reason shown
//   desk_fly_ask    Fly on an inside card: the confirmation (lined up on the runway, into the wind)
//   phone_open / phone_selected / phone_moved   ?profile=phone, 390 x 844: the columns stacked, tap a card then a column
//
//   node tools/_serve.js 8125 &   node tools/storage_shot.js [--out reports/evidence/HANGAR-STORAGE-1] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('storage_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/HANGAR-STORAGE-1'));
const PORT = +opt('port', 8125), ONLY = opt('only', 'desk,phone').split(',');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/index.html?audio=0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const env = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', f), 'utf8'));
const SHELF = { 'Jolene Cub': env('cub_2026-09-20_corrected.json'), 'Spare Cub': env('cub_2026-09-20_corrected.json'),
                'Club Cub': env('cub_2026-09-20_corrected.json'), 'Jodel D9': env('jodel_2026-09-20_corrected.json'),
                'Old Jodel': env('jodel_2026-09-20_corrected.json'), 'Metal Cessna': env('cessna172_2026-09-20_corrected.json') };
for (const n of Object.keys(SHELF)) { SHELF[n].name = n; if (SHELF[n].spec && SHELF[n].spec.meta) SHELF[n].spec.meta.name = n; }
const FLEET = { 'Jolene Cub': { hangar: 'HOME', aero: 'HOME', kind: 'inside', slot: 0 }, 'Jodel D9': { hangar: 'HOME', aero: 'HOME', kind: 'inside', slot: 1 },
                'Spare Cub': { hangar: null, aero: 'HOME', kind: 'outside', slot: 0 }, 'Club Cub': { hangar: null, aero: 'HOME', kind: 'outside', slot: 1 },
                'Old Jodel': { hangar: 'HOME', aero: 'HOME', kind: 'long' }, 'Metal Cessna': { hangar: 'HOME', aero: 'HOME', kind: 'long' } };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const index = [], fails = [], errs = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const loaded = async pg => {
    const t0 = Date.now();
    while (Date.now() - t0 < 900000) {
      const s = await ev(pg, () => ({ st: window.BOOT && window.BOOT.state, hid: (() => { const b = document.getElementById('boot'); return !b || getComputedStyle(b).display === 'none' || b.classList.contains('gone'); })() })).catch(() => null);
      if (s && s.st === 'gone' && s.hid) break;
      if (((Date.now() - t0) / 1000 | 0) % 30 === 0) console.log('    ... booting (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, BOOT ' + (s && s.st) + ')');
      await sleep(1000);
    }
    await sleep(2000);
    await ev(pg, () => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
    await sleep(800);
    const ok = await ev(pg, () => window.BOOT && window.BOOT.state === 'gone');
    check(ok, 'the page is loaded (BOOT gone) - ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    return ok;
  };
  const probe = pg => ev(pg, () => {
    const S = window.FLYDIY_STORE, V = S && S.view(), el = document.getElementById('hsStore');
    return { boot: window.BOOT && window.BOOT.state, open: !!(el && !el.hidden), view: V,
             msg: el && el.querySelector('.hsMsg') ? el.querySelector('.hsMsg').textContent : null,
             heads: el ? [...el.querySelectorAll('.hsColH')].map(h => h.textContent.replace(/\s+/g, ' ').trim()) : [],
             sel: window.STORAGE_UI ? window.STORAGE_UI.state.sel : null,
             font: el && el.querySelector('.hsName') ? getComputedStyle(el.querySelector('.hsName')).fontFamily + ' / ' + getComputedStyle(el.querySelector('.hsName')).fontStyle : null };
  });
  const shot = async (pg, group, name, note) => {
    await sleep(900);
    const loadedNow = await ev(pg, () => window.BOOT && window.BOOT.state === 'gone');
    if (!check(loadedNow, name + ': still a loaded page')) return null;
    const f = 'storage_' + name + '.jpg';
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 86, timeout: 180000 });
    const st = await probe(pg);
    index.push(Object.assign({ group, name, file: f, note }, st));
    console.log('  ' + f + '  ' + note + (st.msg ? '  [' + st.msg + ']' : ''));
    return st;
  };
  const seed = ctx => ctx.addInitScript(shelf => {
    try { if (!sessionStorage.getItem('hsSeeded')) { for (const n of Object.keys(shelf)) localStorage.setItem('flydiy.build.' + n, JSON.stringify(shelf[n])); sessionStorage.setItem('hsSeeded', '1'); } } catch (e) {}
  }, SHELF);
  const place = pg => ev(pg, fleet => {
    const P = window.FLYDIY_PLAYER, d = P.doc();
    for (const n of Object.keys(fleet)) d.fleet[n] = Object.assign({}, d.fleet[n] || {}, fleet[n]);
    P.set(d);
    return window.FLYDIY_STORE.view();
  }, FLEET);
  const card = (n) => '#hsStore .hsCard[data-name="' + n + '"]';
  const col = k => '#hsStore .hsCol[data-col="' + k + '"] .hsColH';

  if (ONLY.includes('desk')) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('desk: ' + e.message));
    await seed(ctx);
    await pg.goto(URL0, { waitUntil: 'domcontentloaded' });
    if (await loaded(pg)) {
      const V = await place(pg);
      check(V && V.inside.slots.filter(Boolean).length === 2 && V.outside.slots.filter(Boolean).length === 2 && V.long.length === 2, 'the shelf placed: 2 inside, 2 outside, 2 long-term');
      await ev(pg, () => { document.getElementById('fbName').click(); });
      await sleep(300);
      await pg.click('#gStore');
      let st = await shot(pg, 'desk', 'desk_open', 'the panel from the shelf: the floor, INSIDE 2/2, OUTSIDE 2/6, LONG-TERM 2');
      check(st && st.open && /IBM Plex Sans/.test(st.font) && /normal/.test(st.font), 'open, IBM Plex Sans upright (' + (st && st.font) + ')');
      await pg.click(card('Spare Cub') + ' .hsName');
      st = await shot(pg, 'desk', 'desk_selected', 'a card tapped: the columns are targets');
      check(st && st.sel === 'Spare Cub', 'the tap selected the Spare Cub');
      await pg.click(col('long'));
      st = await shot(pg, 'desk', 'desk_moved', '...then LONG-TERM tapped: moved');
      check(st && st.view.long.includes('Spare Cub'), 'tap-then-column moved the Spare Cub long-term');
      await pg.dragAndDrop(card('Metal Cessna'), '#hsStore .hsCol[data-col="outside"] .hsSlot[data-slot="2"]');
      st = await shot(pg, 'desk', 'desk_dropped', 'the Metal Cessna dragged from LONG-TERM onto apron slot 3');
      check(st && st.view.outside.slots[2] === 'Metal Cessna', 'drag and drop put the Metal Cessna on apron slot 3');
      await pg.dragAndDrop(card('Old Jodel'), '#hsStore .hsCol[data-col="inside"] .hsSlot[data-slot="0"]');
      st = await shot(pg, 'desk', 'desk_refused', 'the Old Jodel dropped on a taken inside slot: refused, with the reason');
      check(st && /taken/.test(st.msg || '') && st.view.long.includes('Old Jodel'), 'refused with its reason (' + (st && st.msg) + ')');
      await pg.click(card('Jolene Cub') + ' .hsFly');
      st = await shot(pg, 'desk', 'desk_fly_ask', 'Fly on an inside card: the confirmation (lined up on the runway, into the wind)');
      const ask = await ev(pg, () => { const a = document.querySelector('#hsStore .hsAsk'); return a && !a.hidden ? a.innerText : null; });
      check(ask && /lined up on the runway/.test(ask), 'Fly asks first: ' + (ask || '').replace(/\s+/g, ' '));
      await pg.click('#hsStore .hsNo');
    }
    await ctx.close();
  }
  if (ONLY.includes('phone')) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('phone: ' + e.message));
    await seed(ctx);
    await pg.goto(URL0 + '&profile=phone', { waitUntil: 'domcontentloaded' });
    if (await loaded(pg)) {
      await place(pg);
      await ev(pg, () => window.STORAGE_UI.open());
      let st = await shot(pg, 'phone', 'phone_open', 'the phone: the columns stacked, Fly off (no world in the phone garage)');
      check(st && st.open, 'the panel opens on the phone');
      await pg.tap(card('Club Cub') + ' .hsName');
      st = await shot(pg, 'phone', 'phone_selected', 'a card tapped');
      await pg.tap(col('inside'));
      st = await shot(pg, 'phone', 'phone_moved', '...then INSIDE tapped');
      check(st && /full|room|taken/.test(st.msg || '') || (st && st.view.inside.slots.includes('Club Cub')), 'the phone tap reached the move (' + (st && st.msg) + ')');
      await pg.tap(card('Club Cub') + ' .hsName');
      await pg.tap(col('long'));
      st = await shot(pg, 'phone', 'phone_long', 'tapped again, then LONG-TERM');
      check(st && st.view.long.includes('Club Cub'), 'the phone moved the Club Cub long-term');
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ when: new Date().toISOString(), fails, errs, shots: index }, null, 1));
  for (const e of errs) console.log('  page error: ' + e);
  console.log('storage_shot: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS') + ', ' + index.length + ' stills, ' + errs.length + ' page errors -> ' + path.relative(ROOT, OUT));
  process.exit(fails.length ? 1 : 0);
})();
