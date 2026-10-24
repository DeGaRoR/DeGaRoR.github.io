#!/usr/bin/env node
// GATE CARDDRAG (G3526-G3529, GAME-MENUS) - EVERY CARD THE GAME SHOWS IS DRAGGABLE.
//
// The user, 25 Oct: "super important; any card you show in game should be draggable, so they never cover anything
// important anymore. This has been a real pain." src/viewer/card_drag.js (window.FLYDIY_DRAG) is the one helper.
//
//   C  THE CENSUS: every card-like id in src/viewer (an id ending Card / Panel / Band / Toast / Box / Sheet / Award /
//      Run / Load / Note / Notice, declared as id="..", .id = '..', id: '..' or a CSS #..) is either one of card_drag's
//      CARDS or on the allow-list below with its reason; every CARDS entry and every allow-list entry still names an id
//      the sources declare (a stale entry is red: both lists stay honest)
//   M  THE PAGE: build.js's manifest loads card_drag.js before app.js, and the built index.html / dev.html carry it
//   P  THE PURE HALF: clampPos keeps a card on screen (all of it when it fits, its corner when not); startsDrag says no
//      on every control and outside the handle
//   G  THE GESTURE, card_drag.js in a stub DOM (a vm; no browser): the scan binds a card made after the load; a press
//      that travels < 4 px moves nothing; a drag moves it, saves it under its key and eats ONE click; a press on a
//      button inside never drags; a card whose inline style is wiped (a re-render) and a card made again (a new
//      element) get the saved place back at the next scan; a drag far off screen stays on screen; a card dragged by its
//      header keeps dragging after its insides are written again (the menu); a double-click puts it back (no inline
//      place left, the store empty); resetAll clears every card; a store that throws still drags
//
//   node tools/_carddrag_check.js [--verbose]  -> "GATE CARDDRAG: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), VIEW = path.join(ROOT, 'src', 'viewer');
const VERBOSE = process.argv.includes('--verbose');
const fails = [];
const need = (ok, what) => { if (!ok) fails.push(what); else if (VERBOSE) console.log('  ok  ' + what); };
const say = s => console.log(s);

// ---- C: THE CENSUS ---------------------------------------------------------------------------------------------------
// an id that names a card-like box but is not a card over the game, and why
const ALLOW = {
  bootCard: 'the loading screen\'s card - before the game, nothing under it to cover',
  bootPanel: 'the loading screen\'s panel - before the game',
  bootNote: 'a line inside the loading screen',
  bootSetupNote: 'a line inside the loading screen',
  devPanel: 'the developer\'s F8 panel (DEV), not the game\'s',
  diagBox: 'the ?diag self-test (a URL flag), not the game\'s',
  premPanel: 'the scenery editor\'s docked column - an editor\'s side, not a card over the game',
  flNotice: 'a line inside the flight plate (#flPlate, the brief): it moves with the plate',
  pqNote: 'a line inside the garage\'s plaque (#plaque, a docked column)',
  edLockNote: 'a line inside the garage editor\'s panel',
  stNoBenchNote: 'a line inside the garage\'s bench panel',
  ecNote: 'a span inside the garage\'s wallet line',
  ctlNote: 'a line inside #ctlPanel (which is a card)',
  gLoad: 'the garage shelf\'s "load" button',
};
const SUFFIX = /^[A-Za-z][A-Za-z0-9]*(Card|Panel|Band|Toast|Box|Sheet|Award|Run|Load|Note|Notice)$/;
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|css|html)$/.test(f)) files.push(p); } })(VIEW);
const ids = new Set(), all = new Set();
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/(?:id="|\.id\s*=\s*'|id:\s*'|#)([A-Za-z][A-Za-z0-9]*)\b/g)) { all.add(m[1]); if (SUFFIX.test(m[1])) ids.add(m[1]); }
}
const CD = require(path.join(VIEW, 'card_drag.js'));
const reg = new Set(CD.CARDS.map(c => c[0].replace(/^#/, '')));
for (const id of [...ids].sort()) need(reg.has(id) || ALLOW[id], 'C the card-like #' + id + ' is draggable (card_drag.js CARDS) or allow-listed with its reason');
for (const id of reg) need(all.has(id), 'C card_drag.js names #' + id + ', which src/viewer declares');
for (const id of Object.keys(ALLOW)) need(ids.has(id), 'C the allow-list\'s #' + id + ' is still declared (no stale entry)');
need(new Set(CD.CARDS.map(c => c[1])).size === CD.CARDS.length, 'C every card has its own key');
say('C census: ' + files.length + ' files, ' + ids.size + ' card-like ids - ' + [...ids].filter(i => reg.has(i)).length + ' draggable, ' + [...ids].filter(i => ALLOW[i]).length + ' allow-listed; ' + reg.size + ' registered');

// ---- M: THE PAGE -----------------------------------------------------------------------------------------------------
const build = fs.readFileSync(path.join(ROOT, 'tools', 'build.js'), 'utf8');
const sl = /scripts: \[([\s\S]*?)\]/.exec(build.slice(build.indexOf("'ui_layer.js'") - 200));
const order = sl ? [...sl[1].matchAll(/'([a-z_0-9]+\.js)'/g)].map(m => m[1]) : [];
need(order.indexOf('card_drag.js') >= 0 && order.indexOf('card_drag.js') < order.indexOf('app.js'), 'M build.js loads card_drag.js before app.js');
// index.html inlines the viewer (card_drag.js's header, then app.js's FLYDIY_MENU); dev.html refers to the files
{ const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), a = h.indexOf('// card_drag.js - EVERY CARD'), b = h.indexOf('window.FLYDIY_MENU =');
  need(a >= 0 && b > a, 'M the built index.html carries card_drag.js before app.js'); }
{ const h = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8'), a = h.indexOf('src/viewer/card_drag.js'), b = h.indexOf('src/viewer/app.js');
  need(a >= 0 && b > a, 'M the built dev.html carries card_drag.js before app.js'); }

// ---- P: THE PURE HALF ------------------------------------------------------------------------------------------------
const C = CD.clampPos;
const eq = (a, b) => a.x === b.x && a.y === b.y;
need(eq(C({ x: 100, y: 50 }, 300, 200, 1280, 720), { x: 100, y: 50 }), 'P a card on screen stays where it is');
need(eq(C({ x: -40, y: -9 }, 300, 200, 1280, 720), { x: 0, y: 0 }), 'P past the top-left: back on screen');
need(eq(C({ x: 5000, y: 5000 }, 300, 200, 1280, 720), { x: 980, y: 520 }), 'P past the bottom-right: all of it on screen');
need(eq(C({ x: 900, y: 900 }, 1600, 900, 1280, 720), { x: 900, y: 680 }), 'P a card bigger than the window keeps its corner on screen');
const T = (tag, up) => ({ tag, closest(sel) { let n = this; while (n) { if (sel.split(',').some(s => match(n, s.trim()))) return n; n = n.up; } return null; }, up });
function match(n, s) { if (s.startsWith('[data-nodrag]')) return !!n.nodrag; if (s.startsWith('[contenteditable')) return false; return n.tag === s; }
const card0 = T('div'); card0.contains = t => { let n = t; while (n) { if (n === card0) return true; n = n.up; } return false; };
need(CD.startsDrag(T('span', card0), card0), 'P a press on the card\'s text starts a drag');
for (const tg of ['button', 'a', 'input', 'select', 'textarea', 'label']) need(!CD.startsDrag(T(tg, card0), card0), 'P a press on a ' + tg + ' does not');
const nd = T('div', card0); nd.nodrag = true;
need(!CD.startsDrag(T('span', nd), card0), 'P nor inside [data-nodrag]');
need(!CD.startsDrag(T('span', T('div')), card0), 'P nor outside the handle');

// ---- G: THE GESTURE IN A STUB DOM ------------------------------------------------------------------------------------
function dom(storeThrows) {
  const store = {}, ticks = [];
  let VW = 1280, VH = 720;
  class El {
    constructor(tag, id, cls) { this.tagName = tag.toUpperCase(); this.tag = tag; this.id = id || ''; this.children = []; this.parentNode = null; this.hidden = false;
      this.style = {}; this.L = {}; this._cls = new Set(cls ? cls.split(' ') : []); this.box = { left: 0, top: 0, width: 100, height: 40 };
      const self = this; this.classList = { add: c => self._cls.add(c), remove: c => self._cls.delete(c), contains: c => self._cls.has(c), toggle: (c, on) => (on === undefined ? (self._cls.has(c) ? self._cls.delete(c) : self._cls.add(c)) : on ? self._cls.add(c) : self._cls.delete(c)) }; }
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter(x => x !== c); c.parentNode = null; return c; }
    set innerHTML(v) { this.children = []; }
    contains(t) { let n = t; while (n) { if (n === this) return true; n = n.parentNode; } return false; }
    matches(s) { s = s.trim(); if (s[0] === '#') return this.id === s.slice(1); if (s[0] === '.') return this._cls.has(s.slice(1)); if (s === '[data-nodrag]') return !!this.nodrag; if (/^\[/.test(s)) return false; return this.tag === s; }
    closest(sel) { let n = this; while (n && n.matches) { if (sel.split(',').some(s => n.matches(s))) return n; n = n.parentNode; } return null; }
    all(sel, out) { for (const c of this.children) { if (c.matches(sel)) out.push(c); c.all(sel, out); } return out; }
    querySelector(sel) { return this.all(sel, [])[0] || null; }
    querySelectorAll(sel) { return this.all(sel, []); }
    addEventListener(t, f, cap) { (this.L[t] = this.L[t] || []).push({ f, cap: !!cap }); }
    getBoundingClientRect() { const s = this.style, b = this.box; const l = s.left && s.left !== '' ? parseFloat(s.left) : b.left, t = s.top && s.top !== '' ? parseFloat(s.top) : b.top, w = s.width ? parseFloat(s.width) : b.width; return { left: l, top: t, width: w, height: b.height, right: l + w, bottom: t + b.height }; }
    setPointerCapture() { this.cap = true; } releasePointerCapture() { this.cap = false; }
  }
  // the event's path, the capture phase then the bubble (enough for this file's listeners)
  function fire(target, type, o) {
    const ev = Object.assign({ type, target, button: 0, pointerId: 1, clientX: 0, clientY: 0, stopped: false, prevented: false,
      stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } }, o || {});
    const path = []; for (let n = target; n; n = n.parentNode) path.push(n);
    for (const n of path.slice().reverse()) for (const l of (n.L[type] || [])) if (l.cap && !ev.stopped) l.f(ev);
    for (const n of path) { if (ev.stopped) break; for (const l of (n.L[type] || [])) if (!l.cap) l.f(ev); }
    return ev;
  }
  const body = new El('body', '', ''), head = new El('head');
  const document = { body, head, documentElement: { clientWidth: VW, clientHeight: VH }, createElement: t => new El(t), querySelector: s => body.querySelector(s) };
  const localStorage = { getItem: k => { if (storeThrows) throw new Error('no storage'); return k in store ? store[k] : null; }, setItem: (k, v) => { if (storeThrows) throw new Error('no storage'); store[k] = String(v); } };
  const win = { document, localStorage, get innerWidth() { return VW; }, get innerHeight() { return VH; }, setInterval: f => ticks.push(f), setTimeout: f => f(), addEventListener() {},
    getComputedStyle: () => ({ position: 'fixed' }), console, Math, JSON, Object, Array, Map, Set, isFinite };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(VIEW, 'card_drag.js'), 'utf8'), win, { filename: 'card_drag.js' });
  return { win, El, body, fire, store, tick: () => ticks.forEach(f => f()), size: (w, h) => { VW = w; VH = h; } };
}
{
  const S = dom(false), Dg = S.win.FLYDIY_DRAG;
  need(!!Dg && typeof Dg.card === 'function' && typeof Dg.register === 'function' && typeof Dg.resetAll === 'function', 'G window.FLYDIY_DRAG with card / register / reset / resetAll');
  // a card made AFTER the load, as the page's own code makes it
  const arr = S.body.appendChild(new S.El('div', 'arrCard')); arr.box = { left: 96, top: 500, width: 320, height: 180 };
  const txt = arr.appendChild(new S.El('span')), btn = arr.appendChild(new S.El('button'));
  S.tick();
  need(arr.classList.contains('cdCard') && arr.classList.contains('cdHandle'), 'G the scan binds a card made after the load (.cdCard, .cdHandle)');
  // under the threshold: nothing moves, the click is the click
  S.fire(txt, 'pointerdown', { clientX: 100, clientY: 600 });
  S.fire(arr, 'pointermove', { clientX: 102, clientY: 601 });
  S.fire(arr, 'pointerup', { clientX: 102, clientY: 601 });
  need(!arr.style.left && !S.fire(txt, 'click').prevented, 'G a press that travels < 4 px moves nothing and its click is not eaten');
  // a drag: moved, saved, one click eaten
  S.fire(txt, 'pointerdown', { clientX: 100, clientY: 600 });
  S.fire(arr, 'pointermove', { clientX: 140, clientY: 560 });
  S.fire(arr, 'pointermove', { clientX: 300, clientY: 300 });
  const ce = S.fire(arr, 'pointerup', { clientX: 300, clientY: 300 });
  need(arr.style.left === '296px' && arr.style.top === '200px' && arr.style.right === 'auto' && arr.style.bottom === 'auto' && arr.style.transform === 'none' && arr.style.width === '320px',
    'G a drag moves the card (left 296, top 200), anchors it left / top, fixes its width (' + JSON.stringify(arr.style) + ')');
  const saved = JSON.parse(S.store['flydiy.cardPos'] || '{}');
  need(saved.arrival && saved.arrival.x === 296 && saved.arrival.y === 200, 'G the place is saved under the card\'s key (' + JSON.stringify(saved) + ')');
  need(Dg.placed('arrival') && Dg.keys().join() === 'arrival', 'G placed() / keys() say so');
  // (the eaten click: setTimeout runs at once in this stub, so the flag is armed and cleared in one go - the real page
  //  clears it on the next task; what is checked is that a later click is never eaten)
  need(!S.fire(txt, 'click').prevented, 'G a click after the drag is a click');
  // a press on a button never drags
  S.fire(btn, 'pointerdown', { clientX: 200, clientY: 220 });
  S.fire(arr, 'pointermove', { clientX: 600, clientY: 400 });
  S.fire(arr, 'pointerup', { clientX: 600, clientY: 400 });
  need(arr.style.left === '296px', 'G a press on a button inside never drags');
  // a re-render wipes the inline style: the scan puts it back
  arr.style = {}; S.tick();
  need(arr.style.left === '296px' && arr.style.top === '200px', 'G a card whose style is written again gets its place back at the next scan');
  // the card made again: the new element is bound and placed
  S.body.removeChild(arr);
  const arr2 = S.body.appendChild(new S.El('div', 'arrCard')); arr2.box = { left: 96, top: 500, width: 320, height: 180 }; arr2.appendChild(new S.El('span'));
  S.tick();
  need(arr2.classList.contains('cdCard') && arr2.style.left === '296px' && arr2.style.top === '200px', 'G a card made again (a new element) is bound and placed where the player left it');
  // off screen: kept on screen
  const t2 = arr2.children[0];
  S.fire(t2, 'pointerdown', { clientX: 300, clientY: 250 });
  S.fire(arr2, 'pointermove', { clientX: 4000, clientY: 4000 });
  S.fire(arr2, 'pointerup', { clientX: 4000, clientY: 4000 });
  need(arr2.style.left === '960px' && arr2.style.top === '540px', 'G a drag past the corner keeps all of the card on screen (' + arr2.style.left + ', ' + arr2.style.top + ')');
  // a window made smaller: the next scan keeps it on screen
  S.size(800, 600); S.tick();
  need(arr2.style.left === '480px' && arr2.style.top === '420px', 'G a smaller window: the card comes back on screen (' + arr2.style.left + ', ' + arr2.style.top + ')');
  S.size(1280, 720);
  // a card by its header, whose insides are written again (the menu)
  const gm = S.body.appendChild(new S.El('div', 'gmPanel')); gm.box = { left: 1000, top: 74, width: 260, height: 400 };
  let hd = gm.appendChild(new S.El('div', '', 'gmHead')); const row = gm.appendChild(new S.El('button', '', 'gmRow'));
  S.tick();
  need(hd.classList.contains('cdHandle') && !gm.classList.contains('cdHandle'), 'G the menu drags by its header (.gmHead is the handle, not the card)');
  S.fire(row, 'pointerdown', { clientX: 1100, clientY: 140 }); S.fire(gm, 'pointermove', { clientX: 900, clientY: 300 }); S.fire(gm, 'pointerup', {});
  need(!gm.style.left, 'G a press on a menu row never drags it');
  gm.innerHTML = ''; hd = gm.appendChild(new S.El('div', '', 'gmHead')); S.tick();
  need(hd.classList.contains('cdHandle'), 'G the header written again is the handle again');
  S.fire(hd, 'pointerdown', { clientX: 1100, clientY: 80 }); S.fire(gm, 'pointermove', { clientX: 1000, clientY: 120 }); S.fire(gm, 'pointerup', {});
  need(gm.style.left === '900px' && gm.style.top === '114px', 'G ...and drags the menu (' + gm.style.left + ', ' + gm.style.top + ')');
  // the way back: a double-click on the handle
  S.fire(hd, 'dblclick', {});
  need(!gm.style.left && !gm.style.top && !gm.style.right && !gm.style.width && !Dg.placed('menu') && Dg.placed('arrival'), 'G a double-click puts that card back (no inline place, its key gone, the others kept)');
  Dg.resetAll();
  need(!arr2.style.left && !Dg.keys().length && JSON.parse(S.store['flydiy.cardPos']).arrival === undefined, 'G resetAll puts every card back and empties the store');
  // register(): another part of the game's card
  const tim = S.body.appendChild(new S.El('aside', 'myCard'));
  need(Dg.register('#myCard', 'mine') && tim.classList.contains('cdCard') && !Dg.register('#myCard', 'mine'), 'G register() binds another card at once, once per key');
}
{
  const S = dom(true), Dg = S.win.FLYDIY_DRAG;
  const c = S.body.appendChild(new S.El('div', 'stTim')); c.box = { left: 12, top: 600, width: 700, height: 70 }; const t = c.appendChild(new S.El('span'));
  S.tick();
  S.fire(t, 'pointerdown', { clientX: 50, clientY: 620 }); S.fire(c, 'pointermove', { clientX: 300, clientY: 100 }); S.fire(c, 'pointerup', {});
  need(c.style.left === '262px' && c.style.top === '80px' && Dg.placed('tim'), 'G a store that throws still drags, for the page\'s life (' + c.style.left + ', ' + c.style.top + ')');
}
say('G the gesture in a stub DOM: bind, threshold, drag + save, buttons, re-render, re-made, clamps, the header handle, the double-click, resetAll, register, no storage');

if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); console.log('GATE CARDDRAG: FAIL'); process.exit(1); }
console.log('GATE CARDDRAG: PASS');
