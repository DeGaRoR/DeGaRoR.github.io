#!/usr/bin/env node
// ============================================================================
// GATE PLANETHUMB - G3800 the plane cards' side profile (src/viewer/plane_thumb.js, window.PLANE_THUMB).
// ============================================================================
// The user, 2 Nov: "what we need now is mostly a VIGNETTE" - each plane card shows the aeroplane's side profile. Pure
// node (~1 s), no page, no GPU. What is held:
//   THE WIRING   build.js loads plane_thumb.js after garage.js and before storage_ui.js / app.js; garage.js asks for a
//                draw after a save (saveAs, after the parked queue) and after a slot's load, forgets on a delete;
//                app.js storeCard asks PLANE_THUMB.get('mine:' + name) first; storage_ui.js redraws on 'plane-thumb'.
//   THE CACHE    a player's picture is kept per save name with the build's hash: get() reads it back (prefs), a save of
//                the same build schedules nothing, an edited build schedules one draw, forget() drops it; a draw whose
//                stand changed under it (another build loaded) stores nothing.
//   THE BAKE     the stock / candidate pictures: get() of a non-'mine:' key is null until media/thumbs/index.json lands,
//                then 'media/thumbs/<file>' for a key it names (null for one it does not), and the cards hear
//                'plane-thumb' (key '*') once.
//   NEVER BREAKS draw() with no page (no THREE, no renderer, no aeroplane) returns null, never throws.
//   node tools/_plane_thumb_check.js [--selftest]  -> "GATE PLANETHUMB: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SELF = process.argv.includes('--selftest');
async function run(src, files) {
  const fails = []; let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); };
  // ---- THE WIRING
  const B = files.build, G = files.garage, A = files.app, U = files.storage;
  const order = ['garage.js', 'plane_thumb.js', 'storage_ui.js'].map(f => B.indexOf("'" + f + "'"));
  ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2] && order[1] < B.indexOf("'app.js'"), 'build.js: plane_thumb.js between garage.js and storage_ui.js, before app.js');
  const save = G.slice(G.indexOf('const saveAs = name =>'), G.indexOf('const saveAs = name =>') + 6000);
  ok(/fleetQueue\(name\)[\s\S]{0,400}PLANE_THUMB\.saved\(name\)/.test(save), 'garage.js saveAs: PLANE_THUMB.saved(name) after the parked queue');
  const load = G.slice(G.indexOf('const loadSlot = n =>'), G.indexOf('const loadSlot = n =>') + 900);
  ok(/loadSpec\([\s\S]{0,400}PLANE_THUMB\.saved\(n\)/.test(load), 'garage.js loadSlot: PLANE_THUMB.saved(n) after the load');
  ok(/lsDel\(SLOT \+ n\);[\s\S]{0,200}PLANE_THUMB\.forget\(n\)/.test(G), 'garage.js delete: PLANE_THUMB.forget(n)');
  const card = A.slice(A.indexOf('function storeCard(name)'), A.indexOf('function storeCard(name)') + 1200);
  ok(/PLANE_THUMB\.get\('mine:' \+ name\)/.test(card) && card.indexOf('PLANE_THUMB.get') < card.indexOf('PARKED.fleetThumb'), "app.js storeCard: PLANE_THUMB.get('mine:' + name) first");
  ok(/addEventListener\('plane-thumb'/.test(U), "storage_ui.js: redraws on 'plane-thumb'");
  // ---- THE MODULE, in a stub window
  const store = new Map(), events = [], idles = [];
  let fetched = 0, specNow = { cage: { a: 1 }, meta: { name: 'A' } };
  const win = {
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    requestIdleCallback: fn => { idles.push(fn); return idles.length; },
    dispatchEvent: e => events.push(e.detail && e.detail.key),
    GARAGE_SPEC: { get: () => specNow },
    fetch: () => { fetched++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ thumbs: { 'stock:piper cub': 'stock_piper-cub.webp' } }) }); },
  };
  win.window = win;
  const ctx = vm.createContext({ window: win, performance: { now: () => 0 }, setTimeout: (fn) => { idles.push(fn); return 1; },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }, JSON, Map, Set, Math, Promise, document: {} });
  ctx.requestIdleCallback = win.requestIdleCallback; ctx.fetch = win.fetch; ctx.GARAGE_SPEC = win.GARAGE_SPEC;
  vm.runInContext(src, ctx, { filename: 'plane_thumb.js' });
  const T = win.PLANE_THUMB;
  ok(T && typeof T.get === 'function' && typeof T.saved === 'function' && typeof T.forget === 'function', 'window.PLANE_THUMB with get / saved / forget');
  if (!T) return { fails, checks };
  // NEVER BREAKS
  let r; try { r = T.draw(); } catch (e) { r = 'threw ' + e.message; }
  ok(r === null, 'draw() with no page: null, no throw (' + r + ')');
  // THE CACHE
  const h = T.hashOf(specNow);
  ok(h && h === T.hashOf(JSON.parse(JSON.stringify(specNow))) && h !== T.hashOf({ cage: { a: 2 }, meta: { name: 'A' } }), 'hashOf: stable for the same build, different for an edit');
  store.set('flydiy.thumb.mine:A', JSON.stringify({ h, url: 'data:image/webp;base64,AAA' }));
  ok(T.get('mine:A') === 'data:image/webp;base64,AAA', "get('mine:A') reads the stored picture");
  ok(T.get('mine:B') === null, "get('mine:B') with nothing stored: null (the glyph)");
  idles.length = 0; T.saved('A');
  ok(idles.length === 0, 'saved() of the build already pictured: nothing scheduled');
  specNow = { cage: { a: 2 }, meta: { name: 'A' } };
  T.saved('A');
  ok(idles.length === 1, 'saved() of an edited build: one draw scheduled');
  // the stand changes under it (another build loaded before the page is still): nothing stored
  specNow = { cage: { a: 3 } };
  for (let i = 0; i < 40 && idles.length; i++) idles.shift()();
  ok(JSON.parse(store.get('flydiy.thumb.mine:A')).h === h, 'a draw whose stand changed under it stores nothing');
  // (draw() is null on this stub whatever the stand does, so the line above can't see the re-check: the source is read for it)
  ok(/if \(standHash\(\) !== q\.h\) return;/.test(src), 'saved(): the stand is re-checked before the draw');
  T.forget('A');
  ok(!store.has('flydiy.thumb.mine:A') && T.get('mine:A') === null, 'forget() drops the picture');
  // THE BAKE
  ok(T.get('stock:piper cub') === null && fetched === 1, 'a baked key before the index: null, the index fetched once');
  T.get('stock:jodel'); ok(fetched === 1, 'the index is fetched once, not per ask');
  await new Promise(res => setImmediate(res)); await new Promise(res => setImmediate(res));
  ok(events.filter(k => k === '*').length === 1, "the index landed: 'plane-thumb' '*' told once");
  ok(T.get('stock:piper cub') === 'media/thumbs/stock_piper-cub.webp', "get('stock:piper cub') -> media/thumbs/stock_piper-cub.webp");
  ok(T.get('stock:jodel') === null, 'a key the bake does not name: null');
  return { fails, checks };
}
(async () => {
  const src = rd('src/viewer/plane_thumb.js');
  const files = { build: rd('tools/build.js'), garage: rd('src/viewer/garage.js'), app: rd('src/viewer/app.js'), storage: rd('src/viewer/storage_ui.js') };
  const base = await run(src, files);
  if (!SELF) {
    for (const f of base.fails) console.log('  FAIL ' + f);
    console.log('  ' + base.checks + ' checks');
    console.log('GATE PLANETHUMB: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
    process.exit(base.fails.length ? 1 : 0);
  }
  // --selftest: each break must be caught
  const BREAKS = [
    ['no save hook', s => s, f => Object.assign({}, f, { garage: f.garage.replace('window.PLANE_THUMB.saved(name)', 'window.PLANE_THUMB.x(name)') })],
    ['no load hook', s => s, f => Object.assign({}, f, { garage: f.garage.replace('window.PLANE_THUMB.saved(n)', 'window.PLANE_THUMB.x(n)') })],
    ['card asks PARKED first', s => s, f => Object.assign({}, f, { app: f.app.replace("try { if (window.PLANE_THUMB) thumb = window.PLANE_THUMB.get('mine:' + name) || null; } catch (e) {}\n", '') })],
    ['no hash check', s => s.replace('if (old && old.h === h && old.url)', 'if (false)'), f => f],
    ['stand not re-checked', s => s.replace('if (standHash() !== q.h) return;', ''), f => f],
    ['forget keeps it', s => s.replace('L && L.removeItem(PREF + \'mine:\' + name)', '0'), f => f],
    ['index per ask', s => s.replace('if (bakedLoading || typeof fetch', 'if (typeof fetch'), f => f],
  ];
  let bad = 0;
  for (const [nm, bs, bf] of BREAKS) {
    const s2 = bs(src), f2 = bf(files);
    if (s2 === src && f2 === files) { console.log('  selftest ' + nm + ': the break did not apply'); bad++; continue; }
    const r = await run(s2, f2);
    if (!r.fails.length) { console.log('  selftest ' + nm + ': NOT caught'); bad++; }
  }
  console.log('GATE PLANETHUMB selftest: ' + (bad || base.fails.length ? 'FAIL' : 'PASS') + ' (' + (BREAKS.length - bad) + ' of ' + BREAKS.length + ' caught)');
  process.exit(bad || base.fails.length ? 1 : 0);
})();
