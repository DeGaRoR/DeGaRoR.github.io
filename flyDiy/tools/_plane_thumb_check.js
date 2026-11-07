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
//   THE LIVE DRAW is OFF (A0 4 Nov, L31c: the first draw froze the page 6.1 s on L31b): as shipped, saved() schedules
//                nothing and 'mine:' reads null even with a picture stored; forget() and the bake still work. THE CACHE's
//                rows run on the source with its one line flipped on, so the flag still turns back on a working draw.
//   node tools/_plane_thumb_check.js [--selftest]  -> "GATE PLANETHUMB: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SELF = process.argv.includes('--selftest');
const LIVE_OFF = 'const LIVE_DRAW = false;';
async function run(src, files) {
  const fails = []; let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); };
  // THE FOG (PLANE-RENDERS R1): fog is a program define; the draw pushes it out of reach and never sets it null (a null
  // recompiled every material in the scene, the reading of L31b's 6.1 s first draw)
  ok(!/S\.fog = null/.test(src) && /fog\.near = 1e8; fog\.far = 1e9/.test(src) && /fog\.near = fogR\[0\]; fog\.far = fogR\[1\]/.test(src), 'draw: the fog out of reach and put back, never null');
  // ---- THE WIRING
  const B = files.build, G = files.garage, A = files.app, U = files.storage;
  // THE SCREEN VARIANT (PLANE-RENDERS R1, 7 Nov): the garage's programs are keyed for the anti-aliasing target, the thumb
  // draws to the screen - a second program per material, 4.2-5.5 s inside a fresh profile's first draw. The probe compiles
  // for the screen (null target) through the sliced compile, and saved() warms before it draws
  ok(/compileScreen: \(sc, lit\) => compileSliced\(sc, null, lit\)/.test(A), 'app.js FLIGHT_PROBE.compileScreen: compileSliced to the screen (a null target)');
  ok(/warm\(\)\.then\(\(\) => whenStill\(\(\) => \{/.test(src) && /P\.compileScreen\(root, S\)/.test(src), 'plane_thumb.js saved(): warm() (P.compileScreen) before the draw');
  const order = ['garage.js', 'plane_thumb.js', 'storage_ui.js'].map(f => B.indexOf("'" + f + "'"));
  ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2] && order[1] < B.indexOf("'app.js'"), 'build.js: plane_thumb.js between garage.js and storage_ui.js, before app.js');
  const save = G.slice(G.indexOf('const saveAs = name =>'), G.indexOf('const saveAs = name =>') + 6000);
  ok(/fleetQueue\(name\)[\s\S]{0,400}PLANE_THUMB\.saved\(name\)/.test(save), 'garage.js saveAs: PLANE_THUMB.saved(name) after the parked queue');
  const load = G.slice(G.indexOf('const loadSlot = n =>'), G.indexOf('const loadSlot = n =>') + 1400);
  ok(/loadSpec\([\s\S]{0,800}PLANE_THUMB\.saved\(n\)/.test(load), 'garage.js loadSlot: PLANE_THUMB.saved(n) after the load');
  ok(/lsDel\(SLOT \+ n\);[\s\S]{0,200}PLANE_THUMB\.forget\(n\)/.test(G), 'garage.js delete: PLANE_THUMB.forget(n)');
  const card = A.slice(A.indexOf('function storeCard(name)'), A.indexOf('function storeCard(name)') + 1200);
  ok(/PLANE_THUMB\.get\('mine:' \+ name\)/.test(card) && card.indexOf('PLANE_THUMB.get') < card.indexOf('PARKED.fleetThumb'), "app.js storeCard: PLANE_THUMB.get('mine:' + name) first");
  ok(/addEventListener\('plane-thumb'/.test(U), "storage_ui.js: redraws on 'plane-thumb'");
  // ---- THE LIVE DRAW OFF: the source as shipped, in its own stub window
  ok(src.includes(LIVE_OFF), 'plane_thumb.js: ' + LIVE_OFF);
  {
    const st = new Map(), id = [], w = { localStorage: { getItem: k => st.has(k) ? st.get(k) : null, setItem: (k, v) => st.set(k, String(v)), removeItem: k => st.delete(k) },
      requestIdleCallback: fn => { id.push(fn); return 1; }, dispatchEvent: () => {}, GARAGE_SPEC: { get: () => ({ cage: { a: 1 } }) } };
    w.window = w;
    const c = vm.createContext({ window: w, performance: { now: () => 0 }, setTimeout: fn => { id.push(fn); return 1; }, JSON, Map, Set, Math, Promise, document: {} });
    c.requestIdleCallback = w.requestIdleCallback; c.GARAGE_SPEC = w.GARAGE_SPEC;
    vm.runInContext(src, c, { filename: 'plane_thumb.js' });
    const T0 = w.PLANE_THUMB;
    if (T0) {
      T0.saved('A');
      ok(id.length === 0, 'live draw off: saved() schedules nothing');
      st.set('flydiy.thumb.mine:A', JSON.stringify({ h: 'x', url: 'data:image/webp;base64,AAA' }));
      ok(T0.get('mine:A') === null, "live draw off: get('mine:A') is null with a picture stored (the glyph)");
      T0.forget('A');
      ok(!st.has('flydiy.thumb.mine:A'), 'live draw off: forget() still drops a stored picture');
      T0.baked = { 'stock:piper cub': 'stock_piper-cub.webp' };
      ok(T0.get('stock:piper cub') === 'media/thumbs/stock_piper-cub.webp', 'live draw off: the baked pictures stay');
    }
  }
  // ---- THE MODULE, in a stub window, its one line flipped on
  src = src.replace(LIVE_OFF, 'const LIVE_DRAW = true;');
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
    ['live draw left on', s => s.replace(LIVE_OFF, 'const LIVE_DRAW = true;'), f => f],
    ['off: saved() still draws', s => s.replace('if (!LIVE_DRAW || !name) return;', 'if (!name) return;'), f => f],
    ["off: 'mine:' reads the stored picture", s => s.replace('if (!LIVE_DRAW) return null;', ''), f => f],
    ['no save hook', s => s, f => Object.assign({}, f, { garage: f.garage.replace('window.PLANE_THUMB.saved(name)', 'window.PLANE_THUMB.x(name)') })],
    ['no load hook', s => s, f => Object.assign({}, f, { garage: f.garage.replace('window.PLANE_THUMB.saved(n)', 'window.PLANE_THUMB.x(n)') })],
    ['card asks PARKED first', s => s, f => Object.assign({}, f, { app: f.app.replace("try { if (window.PLANE_THUMB) thumb = window.PLANE_THUMB.get('mine:' + name) || null; } catch (e) {}\n", '') })],
    ['no hash check', s => s.replace('if (old && old.h === h && old.url)', 'if (false)'), f => f],
    ['stand not re-checked', s => s.split('if (standHash() !== q.h) return;').join(''), f => f],
    ['draw not warmed', s => s.replace('warm().then(() => whenStill(() => {', 'Promise.resolve().then(() => whenStill(() => {'), f => f],
    ['probe keyed for the AA target', s => s, f => Object.assign({}, f, { app: f.app.replace('compileSliced(sc, null, lit)', 'compileSliced(sc, aa.target(), lit)') })],
    ['forget keeps it', s => s.replace('L && L.removeItem(PREF + \'mine:\' + name)', '0'), f => f],
    ['fog off by null', s => s.replace('S.background = studioBg(THREE); R.shadowMap', 'S.background = studioBg(THREE); S.fog = null; R.shadowMap'), f => f],
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
