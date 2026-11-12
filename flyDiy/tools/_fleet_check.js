#!/usr/bin/env node
// GATE FLEET - the full-screen Fleet (src/viewer/fleet_screen.js; the user 13 Nov: "load aircraft" full screen, a tile per
// aeroplane with its picture, Load and Fiche, ordered and filtered, the phone too).
//
// THE WIRING (source): the build carries the file beside new_plane.js; the page's render loop holds while it is open
// (app.js) and the fiche never draws under it (fiche_board.js standFree); garage.js keeps no popup (#gFleet) and hands
// the hangar over as data (GARAGE_SPEC.fleet / fleetDo); the screen asks no browser question (confirm / alert / prompt).
// THE FLOW (a DOM stub, garage and fiche doors stubbed - what the screen does with them):
//   - open holds the render, opens on Your hangar, reads the hangar once; closing releases the hold
//   - the tiles: the stand's plane says so (no Load), an aeroplane away is greyed, a broken one says it
//   - Load on an aeroplane away ASKS on the tile ("Fly from there?"); nothing loads before Yes; Yes loads it once behind
//     the spinner, then the screen closes and the hold is released
//   - Sell / Delete / Buy in ask on the tile; a refusal shows its reason on the tile; a done verb re-reads the hangar
//   - Fiche opens FICHE_BOARD with the plane's own key (a save's name; a list row's picture key or list:N); no fiche, the
//     button is disabled
//   - the filters and the search narrow the tiles and are remembered; All planes groups the list's classes in order,
//     the candidates last; a list tile loads through openListed, a candidate through openCandidate - nothing before Load
//   - Escape closes
//   node tools/_fleet_check.js [--selftest]   (--selftest: the flow on broken copies of the screen must go red)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SELF = process.argv.includes('--selftest');
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

// ---- the wiring ---------------------------------------------------------------------------------------------------
function sourceRows(S) {
  const bad = [];
  const need = (k, re, what) => { if (!re.test(S[k])) bad.push(k + ': ' + what); };
  need('build', /'new_plane\.js', 'fleet_screen\.js',/, 'the build carries fleet_screen.js beside new_plane.js');
  need('app', /window\.FLEET_SCREEN && window\.FLEET_SCREEN\.isOpen\(\)\)\) \{/, 'the render loop holds while the Fleet is open');
  need('fiche', /W\.FLEET_SCREEN && W\.FLEET_SCREEN\.isOpen && W\.FLEET_SCREEN\.isOpen\(\)\) return false/, 'the fiche never draws under the Fleet');
  need('garage', /fleet: fleetModel, fleetDo: fleetVerbs,/, 'GARAGE_SPEC hands the hangar over (fleet, fleetDo)');
  need('garage', /\$\('gLoad'\)\.addEventListener\('click', \(\) => openFleet\('mine'\)\)/, 'LOAD opens the Fleet on Your hangar');
  if (/gFleet|gfRow|renderFleet/.test(strip(S.garage))) bad.push('garage: the old popup (#gFleet) is back');
  if (/\b(confirm|alert|prompt)\s*\(/.test(strip(S.fleet))) bad.push('fleet: a browser pop-up (confirm / alert / prompt) - the tile asks');
  need('css', /#flWrap \{ position:fixed; inset:0; z-index:62;/, 'the screen is full-screen, the chooser\'s layer');
  need('css', /html\.phone #flWrap \.flGrid \{ grid-template-columns:repeat\(2, minmax\(0,1fr\)\)/, 'the phone shows two tiles across');
  return bad;
}

// ---- a DOM stub: enough for the screen's own calls (it draws by innerHTML; the gate reads that text) --------------
function makeDom() {
  const mkClass = () => { const s = new Set(); return { _s: s, add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), toggle: (c, on) => { if (on === undefined) on = !s.has(c); if (on) s.add(c); else s.delete(c); return on; } }; };
  const mk = tag => {
    const e = { tag, hidden: false, id: '', innerHTML: '', textContent: '', value: '', dataset: {}, classList: mkClass(), _q: {}, _qa: {}, on: {}, attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, f) { (this.on[k] = this.on[k] || []).push(f); },
      querySelector(sel) { return this._q[sel] || (this._q[sel] = mk('q:' + sel)); },
      querySelectorAll(sel) {
        if (sel === '.flSeg button') return this._qa[sel] || (this._qa[sel] = ['mine', 'all'].map(t => { const b = mk('button'); b.dataset.tab = t; return b; }));
        return [];
      } };
    return e;
  };
  const doc = { documentElement: { classList: mkClass() }, body: { children: [], appendChild(c) { this.children.push(c); return c; } }, createElement: mk };
  return doc;
}

async function flow(fleetSrc) {
  const bad = [], t = (ok, what) => { if (!ok) bad.push(what); };
  const doc = makeDom(), store = new Map(), winOn = {};
  const calls = { hold: [], fleet: 0, load: [], sell: [], del: [], home: [], buy: [], listed: [], cand: [], show: [] };
  let sellAnswer = { ok: false, why: 'not today: the market is shut' };
  const MODEL = () => ({ stand: 'Cub', storage: true, bring: [{ slot: 'Sandy', name: 'Sandy', price: 5000, text: '5 000 $', thumb: 'mine:Sandy' }],
    rows: [
      { slot: 'Cub', name: 'Cub', reg: 'F-BCUB', cur: true, meta: 'on the stand', place: { text: 'in HOME', kind: 'in', aero: 'HOME', wear: 0 }, away: false, broken: false, cert: 'certified', flights: 3, hours: 1.2, flown: '2026-11-10', sale: null, home: false, thumb: 'mine:Cub', liveries: 0 },
      { slot: 'Jodel', name: 'Jodel', reg: 'F-PJDL', cur: false, meta: 'tested', place: { text: 'out at w3', kind: 'out', aero: 'w3', wear: 0 }, away: true, broken: false, cert: 'changed', flights: 1, hours: 0.4, flown: '2026-11-12', sale: { value: 30000, text: '30 000 $', why: '', cap: false, ok: true }, home: true, thumb: 'mine:Jodel', liveries: 3 },
      { slot: 'Twin', name: 'Twin', reg: 'F-FORE', cur: false, meta: '', place: null, away: false, broken: true, cert: 'grounded', flights: 0, hours: 0, flown: '', sale: null, home: false, thumb: 'mine:Twin', liveries: 0 },
    ] });
  const LISTS = [{ n: 6, list: 'original', name: 'Twin busher floats 4b', reg: 'F-FORE', file: 'builds/candidates/Twin_busher_floats_4b.json', thumb: 'cand:Twin_busher_floats_4b.json' },
                 { n: 1, list: 'reproduction', name: 'Piper Cub', reg: 'F-BCUB', file: 'builds/cub.json', thumb: 'design:cub' },
                 { n: 7, list: 'story', name: 'Rufus', reg: 'N47RF', file: 'builds/rufus.json' }];
  const CANDS = [{ file: 'c.json', name: 'Cand C', note: 'a note', tip: 't' }];
  const FICHES = { 'design:cub': { name: 'Piper Cub', data: { seats: 2, gear: 'taildragger', dims: { span: 10.7 }, specs: { engine: 'Continental A-65', empty: 354.8, TORun: 157 } } }, 'list:7': { name: 'Rufus', data: {} } };
  const W = {
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    matchMedia: () => ({ matches: false }),
    addEventListener: (k, f) => { (winOn[k] = winOn[k] || []).push(f); },
    FLYDIY_UI_HOLD: on => calls.hold.push(on),
    PLANE_THUMB: { get: k => (k === 'design:cub' || k === 'mine:Cub' ? 'media/thumbs/' + k.replace(':', '_') + '.webp' : null), hero: k => (k === 'design:cub' ? 'media/heroes/design_cub.webp' : null) },
    PLANE_FICHE: { names: () => Promise.resolve(['Cub']) },
    FICHE_BOARD: { show: k => calls.show.push(k) },
    GARAGE_SPEC: {
      fleet: () => { calls.fleet++; return MODEL(); },
      fleetDo: { load: n => calls.load.push(n), sell: n => { calls.sell.push(n); return sellAnswer; }, del: n => { calls.del.push(n); return { ok: true }; },
                 home: n => calls.home.push(n), buyIn: n => { calls.buy.push(n); return { ok: true }; }, candidate: c => calls.cand.push(c.file) },
      planeLists: () => Promise.resolve(LISTS), candidates: () => Promise.resolve(CANDS),
      openListed: p => calls.listed.push(p.n), openCandidate: c => calls.cand.push(c.file),
    },
  };
  const ctx = { window: W, document: doc, console, setTimeout, clearTimeout, Promise, JSON, Math, String, Set, Map, Object, Array,
    fetch: u => Promise.resolve({ ok: true, json: () => Promise.resolve(/fiches\/index\.json$/.test(u) ? { fiches: FICHES } : {}) }) };
  vm.createContext(ctx);
  vm.runInContext(fleetSrc, ctx, { filename: 'fleet_screen.js' });
  const F = W.FLEET_SCREEN;
  if (!F) return ['fleet: window.FLEET_SCREEN not published'];
  const tick = () => new Promise(r => setTimeout(r, 0));
  const settle = async () => { for (let i = 0; i < 100 && F._state().busy; i++) await new Promise(r => setTimeout(r, 5)); await tick(); };
  const names = () => F._tiles().map(x => x.name).join(',');
  const tile = (k) => { const h = F._html(), i = h.indexOf('data-k="' + k + '"'); if (i < 0) return ''; const s = h.lastIndexOf('<div class="flTile', i), j = h.indexOf('<div class="flTile', i); return h.slice(s, j < 0 ? h.length : j); };

  // ---- open: Your hangar ----
  t(F.open() === true && F.isOpen() && calls.hold[calls.hold.length - 1] === true, 'open: full screen, the render loop held');
  await tick(); await tick();
  t(F._state().tab === 'mine' && calls.fleet === 1, 'open: Your hangar first, the hangar read once (' + calls.fleet + ')');
  t(names() === 'Jodel,Cub,Twin,Sandy', 'Your hangar sorted by last flown, the bought-in shelf last: ' + names());
  t(/On the stand<\/button>/.test(tile('mine:Cub')) && /data-a="load" disabled/.test(tile('mine:Cub')), "the stand's plane says so and offers no Load");
  t(/flAway/.test(tile('mine:Jodel')) && /out at w3/.test(tile('mine:Jodel')) && /Changed since cert/.test(tile('mine:Jodel')), 'an aeroplane away: greyed, its place and its certificate on the tile');
  t(/3 liveries/.test(tile('mine:Jodel')), 'a plane with several liveries says how many (LIVERY MANAGER)');
  t(/flBroken/.test(tile('mine:Twin')) && /Broken, grounded/.test(tile('mine:Twin')), 'a broken aeroplane says it');
  t(/data-a="fiche"[^>]*disabled/.test(tile('mine:Jodel')) && !/data-a="fiche"[^>]*disabled/.test(tile('mine:Cub')), 'Fiche: live on a plane with one, disabled without');
  t(/media\/thumbs\/mine_Cub\.webp/.test(tile('mine:Cub')) && /flGlyph/.test(tile('mine:Twin')), 'the picture when there is one, the glyph when not');
  // fly from there?
  F._act('mine:Jodel', 'load');
  t(F._state().ask && /Fly from there\?/.test(F._state().ask.text) && !calls.load.length, 'Load on an aeroplane away asks on the tile ("Fly from there?"), nothing loads yet');
  t(/flAsk/.test(tile('mine:Jodel')) && /Fly from there<\/button>/.test(tile('mine:Jodel')), 'the question is drawn on the tile, Cancel or Yes');
  F._act('mine:Jodel', 'no');
  t(!F._state().ask && !calls.load.length, 'Cancel: nothing loaded');
  F._act('mine:Jodel', 'load'); F._act('mine:Jodel', 'yes');
  t(F._state().busy && !calls.load.length, 'Yes: the spinner first (painted before the load)');
  await settle();
  t(calls.load.join() === 'Jodel' && !F.isOpen() && calls.hold[calls.hold.length - 1] === false, 'then the load, once; the screen closed, the hold released');
  // Sell (refused), Delete, Buy in, Bring home
  F.open({ tab: 'mine' }); await tick();
  const reads = calls.fleet;
  F._act('mine:Jodel', 'more');
  t(/Sell · 30 000 \$/.test(tile('mine:Jodel')) && /data-a="home"/.test(tile('mine:Jodel')) && /data-a="del"/.test(tile('mine:Jodel')), 'the ⋯ menu: Bring home, Sell at its price, Delete');
  F._act('mine:Jodel', 'sell');
  t(F._state().ask && /Sell “Jodel” on the used market for 30 000 \$/.test(F._state().ask.text) && !calls.sell.length, 'Sell asks on the tile first');
  F._act('mine:Jodel', 'yes');
  t(calls.sell.join() === 'Jodel' && F._state().ask && /market is shut/.test(F._state().ask.text), 'a refused sale shows its reason on the tile');
  F._act('mine:Jodel', 'no');
  sellAnswer = { ok: true, value: 30000 };
  F._act('mine:Cub', 'del'); t(F._state().ask && /Delete the saved build “Cub”/.test(F._state().ask.text) && !calls.del.length, 'Delete asks first');
  F._act('mine:Cub', 'yes');
  t(calls.del.join() === 'Cub' && calls.fleet > reads, 'Delete: done, the hangar read again');
  F._act('bring:Sandy', 'buy'); F._act('bring:Sandy', 'yes');
  t(calls.buy.join() === 'Sandy', 'Buy in: asked, then bought');
  F._act('mine:Jodel', 'home');
  t(calls.home.join() === 'Jodel', 'Bring home');
  F._act('mine:Cub', 'fiche');
  await tick();
  t(calls.show.join() === 'Cub', "Fiche opens FICHE_BOARD with the save's name");
  // the filters and the search
  F._facet('grounded');
  t(!/Twin/.test(names()) && /"off":\["grounded"\]/.test(store.get('flydiy.fleet.ui') || ''), 'a certificate filter hides the grounded plane and is remembered');
  F._facet('grounded');
  F._query('jod');
  t(names() === 'Jodel', 'the search narrows to the name: ' + names());
  F._query('');
  // ---- All planes ----
  F._tab('all'); await tick(); await tick();
  t(names() === 'Piper Cub,Rufus,Twin busher floats 4b,Cand C', "All planes in the list's class order, the candidates last: " + names());
  const H = F._html();
  t(H.indexOf('>Reproductions<') >= 0 && H.indexOf('>Reproductions<') < H.indexOf('>Story<') && H.indexOf('>Originals<') < H.indexOf('Candidates: built here, not yet certified'), 'the class headings, in order');
  t(/#1</.test(tile('list:1')) && /F-BCUB/.test(tile('list:1')) && /media\/thumbs\/design_cub\.webp/.test(tile('list:1')), 'a list tile: its number, its registration, its picture');
  t(!calls.listed.length && !calls.cand.length, 'nothing loaded before Load');
  F._act('list:1', 'fiche'); F._act('list:7', 'fiche');
  t(calls.show.slice(-2).join() === 'design:cub,list:7', "Fiche opens FICHE_BOARD with the list's key (the picture key, else list:N): " + calls.show.slice(-2).join());
  t(/data-a="fiche"[^>]*disabled/.test(tile('cand:c.json')), 'no baked fiche: the button is disabled');
  F._act('list:1', null);
  t(/Continental A-65/.test(F._peek()) && /media\/heroes\/design_cub\.webp/.test(F._peek()) && /157 m/.test(F._peek()), "the peek: the hero and the numbers of the plane's fiche");
  F._facet('cand');
  t(!/Cand C/.test(names()), 'the class filter hides the candidates');
  F._facet('cand');
  F._act('list:6', 'load'); await settle();
  t(calls.listed.join() === '6' && !F.isOpen(), 'a list tile loads through openListed, once, and the screen closes');
  F.open({ tab: 'all' }); await tick();
  F._act('cand:c.json', 'load'); await settle();
  t(calls.cand.join() === 'c.json', 'a candidate loads through openCandidate');
  // Escape
  F.open(); await tick();
  for (const f of winOn.keydown || []) f({ key: 'Escape', stopPropagation() {}, preventDefault() {} });
  t(!F.isOpen() && calls.hold[calls.hold.length - 1] === false, 'Escape closes, the hold released');
  return bad;
}

(async () => {
  const S = { fleet: read('src/viewer/fleet_screen.js'), garage: read('src/viewer/garage.js'), app: read('src/viewer/app.js'), fiche: read('src/viewer/fiche_board.js'),
    css: read('src/viewer/editor.css'), build: read('tools/build.js') };
  const bad = sourceRows(S).concat(await flow(S.fleet));
  for (const b of bad) console.log('  FAIL ' + b);
  if (SELF) {
    const red = async (what, src, fn) => { const r = src ? await flow(src) : fn(); console.log('  selftest ' + what + ': ' + (r.length ? 'red (ok)' : 'GREEN')); if (!r.length) bad.push('selftest inert: ' + what); };
    await red('the render not held', S.fleet.replace('    hold(true);\n', '\n'));
    await red('Load away without asking', S.fleet.replace('if (t.r.away) return askOn(', 'if (false) return askOn('));
    await red('Sell without asking', S.fleet.replace("else if (a === 'sell') askOn(t,", "else if (a === 'sell') (() => result(t, GS().fleetDo.sell(t.r.slot)))(t,"));
    await red('no spinner before the load', S.fleet.replace('    if (typeof requestAnimationFrame === \'function\') requestAnimationFrame(() => requestAnimationFrame(go)); else go();', '    fn(); busy = false; sp.hidden = true; close();'));
    await red('the candidates first', S.fleet.replace("['wip', 'Work in progress'],\n    ['cand', 'Candidates'],", "['wip', 'Work in progress'],\n    ['cand0', 'Candidates'],"));
    await red('a confirm() back', null, () => sourceRows(Object.assign({}, S, { fleet: S.fleet + '\nconfirm("x");' })));
    await red('the old popup back', null, () => sourceRows(Object.assign({}, S, { garage: S.garage + "\nconst gFleet = 1;" })));
  }
  console.log('GATE FLEET: ' + (bad.length ? 'FAIL (' + bad.length + ')' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})();
