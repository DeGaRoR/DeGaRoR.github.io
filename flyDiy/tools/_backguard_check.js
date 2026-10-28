#!/usr/bin/env node
// _backguard_check.js - GATE BACKGUARD: the browser's Back asks before it leaves the game (G3880-G3884, back_guard.js).
// The module runs in a vm against a stub window: a history with the page before the game, the game's entry and the
// pushes; a DOM just big enough for the box and the player's Pause (#bPause, which holds a stub flight); a clock.
//
//   node tools/_backguard_check.js   -> "GATE BACKGUARD: PASS|FAIL", exit 1 on FAIL
//
// 1. INSTALLED, ARMED AT THE FIRST INPUT: no push at boot (Chrome skips a pre-input entry on Back), one sentinel at the
//    first pointer down / key once the game is up; none before the game is up; a reload on the sentinel adds none
// 2. BACK -> THE BOX: Back pops the sentinel, the box shows (Stay focused), the flight is paused by the player's Pause,
//    the sentinel is back on top
// 3. STAY KEEPS THE STATE: the box hides, the flight resumes, the page's entry and the flight unchanged, nothing left;
//    Back again while open = Stay; Esc = Stay; every key stops at the box while it is open
// 4. LEAVE LEAVES: past the sentinel and the page's entry to the page before; a game that was the tab's first page
//    replaces itself with the referrer (or the site's root); after Leave nothing asks any more
// 5. THE PLAYER'S PAUSE IS THEIRS: a flight already paused stays paused through the box; the garage (Pause hidden) is
//    never clicked
// 6. TAB CLOSE / RELOAD: beforeunload asks with the game up and the guard armed; not within 3 s of an in-page click
//    (the page's own reloads); F5 / Ctrl+R are never an intent; not before the game is up
// 7. NEGATIVE - NEVER ON A RIG: WELCOME.RIG, navigator.webdriver (no welcome.js), ?nogate, ?backguard=0, a frame: no
//    guard, not one listener, no push even after input; ?backguard=1 forces it on a rig
// 8. THE PAGE: build.js loads back_guard.js before app.js; the box is a top-edge card (no centre card), the --ed-* tokens,
//    IBM Plex Sans upright (no serif, no italics), phone sizing under html.phone, draggable (FLYDIY_DRAG when there, its
//    title line otherwise); no device test in the module (GATE GFX's rule)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'back_guard.js'), 'utf8');

let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; };

function mkET() {
  const L = {};
  return {
    addEventListener(t, f) { (L[t] || (L[t] = [])).push(f); },
    removeEventListener(t, f) { const a = L[t]; if (a && a.indexOf(f) >= 0) a.splice(a.indexOf(f), 1); },
    _fire(t, e) {
      e = e || {}; e.type = t; let stop = false;
      e.stopImmediatePropagation = () => { stop = true; e.stopped = true; };
      e.preventDefault = () => { e.defaultPrevented = true; };
      for (const f of (L[t] || []).slice()) { f(e); if (stop) break; }
      return e;
    },
    _n: t => (t ? (L[t] || []).length : Object.values(L).reduce((s, a) => s + a.length, 0)),
  };
}
function mkEl(tag, doc) {
  const el = Object.assign(mkET(), {
    tagName: tag.toUpperCase(), children: [], parent: null, style: {}, attrs: {}, hidden: false, id: '', className: '', textContent: '', type: '',
    appendChild(c) { c.parent = el; el.children.push(c); return c; },
    setAttribute(k, v) { el.attrs[k] = String(v); }, getAttribute(k) { return el.attrs[k]; },
    focus() { doc.activeElement = el; }, click() { el._fire('click', { target: el }); },
    contains(n) { for (let x = n; x; x = x.parent) if (x === el) return true; return false; },
    getBoundingClientRect() { return { left: 100, top: 12, width: 420, height: 120 }; },
    setPointerCapture() {},
  });
  const s = new Set();
  el.classList = { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c),
    toggle: (c, v) => { if (v === undefined) v = !s.has(c); if (v) s.add(c); else s.delete(c); return v; } };
  return el;
}

// o: { rig, webdriver, noWelcome, search, frame, first, referrer, garage, paused, noGame, drag }
function page(o) {
  o = o || {};
  const w = mkET(), doc = mkET(), all = [];
  let T = 1000; const timers = [];
  doc.createElement = t => { const e = mkEl(t, doc); all.push(e); return e; };
  doc.getElementById = id => all.find(e => e.id === id) || null;
  doc.head = mkEl('head', doc); doc.body = mkEl('body', doc); doc.referrer = o.referrer || '';
  const flight = { running: !o.paused, t: 42.5, clicks: [] };
  const bp = mkEl('button', doc); bp.id = 'bPause'; all.push(bp); bp.hidden = !!o.garage;
  if (o.paused) bp.classList.add('on');
  bp.addEventListener('click', () => { flight.running = !flight.running; bp.classList.toggle('on', !flight.running); flight.clicks.push(flight.running ? 'resume' : 'pause'); });
  // the tab's history: [the page before the game]? [the game's own entry] + the pushes
  const H = { e: o.first ? [{ state: null }] : [{ prev: true }, { state: null }], i: o.first ? 0 : 1, pushes: 0, gos: [] };
  if (o.onSentinel) { H.e.push({ state: { flydiyBackGuard: 1 } }); H.i++; }
  const leftTo = []; const leave = to => { leftTo.push(to); w._fire('pagehide', {}); };
  w.history = {
    get state() { return H.e[H.i].state; },
    get length() { return H.e.length; },
    pushState(s) { H.e.length = H.i + 1; H.e.push({ state: JSON.parse(JSON.stringify(s)) }); H.i++; H.pushes++; },
    replaceState(s) { H.e[H.i].state = s; },
    go(n) { H.gos.push(n); const j = H.i + n; if (j < 0 || j >= H.e.length) return; if (H.e[j].prev) { H.i = j; leave('back'); return; }
      H.i = j; w._fire('popstate', { state: H.e[j].state }); },
  };
  // the player's Back (any of them): the browser's one move back
  const back = () => { const j = H.i - 1; if (j < 0) return 'nothing'; if (H.e[j].prev) { H.i = j; leave('back'); return 'left'; }
    H.i = j; w._fire('popstate', { state: H.e[j].state }); return 'popstate'; };
  w.document = doc;
  w.location = { search: o.search || '', replace(u) { leave(u); } };
  w.navigator = { webdriver: !!o.webdriver };
  if (!o.noWelcome) w.WELCOME = { RIG: !!o.rig };
  if (!o.noGame) w.FLIGHT_PROBE = {};
  if (o.drag) w.FLYDIY_DRAG = { bound: [], card(el, key, opts) { this.bound.push({ el, key, opts }); } };
  w.top = o.frame ? {} : w;
  w.performance = { now: () => T };
  w.setTimeout = (f, ms) => { timers.push({ f, at: T + ms }); return timers.length; };
  w.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].f = null; };
  const tick = ms => { T += ms; for (const t of timers) if (t.f && t.at <= T) { const f = t.f; t.f = null; f(); } };
  vm.runInNewContext(SRC, { window: w, Date, JSON, RegExp, Object, Math });
  const G = w.BACK_GUARD;
  const box = () => doc.getElementById('bgBox');
  const unload = () => w._fire('beforeunload', {});
  return { w, doc, G, H, flight, bp, back, box, tick, unload, leftTo, timers,
    input: (k) => k ? w._fire('keydown', { key: k.key || k, ctrlKey: !!k.ctrl, target: doc.body }) : (w._fire('pointerdown', { target: doc.body }), w._fire('pointerup', { target: doc.body }), w._fire('click', { target: doc.body })) };
}

console.log('GATE BACKGUARD');

// 1. installed, armed at the first input
{
  const p = page();
  ok(p.G && p.G.on === true && p.G.why === 'on', 'a player\'s browser: the guard is installed (' + (p.G && p.G.why) + ')');
  ok(p.H.pushes === 0 && !p.G.armed(), 'no push at boot (Chrome\'s intervention skips a pre-input entry on Back)');
  p.input();
  ok(p.H.pushes === 1 && p.G.armed() && p.w.history.state && p.w.history.state.flydiyBackGuard === 1, 'the first input pushes ONE sentinel on top of the game\'s entry');
  p.input(); p.input('a');
  ok(p.H.pushes === 1, 'later inputs push nothing more (' + p.H.pushes + ')');
  const q = page({ noGame: true }); q.input();
  ok(q.H.pushes === 0 && !q.G.armed(), 'before the game is up (no FLIGHT_PROBE: the welcome, the loading screen) nothing is armed');
  const r = page({ onSentinel: true }); r.input();
  ok(r.H.pushes === 0 && r.G.armed(), 'a reload that kept the page on its sentinel adds none');
}
// 2-3. back -> the box; stay keeps the state
{
  const p = page(); p.input(); p.tick(5000);
  const t0 = p.flight.t, i0 = p.H.i;
  const how = p.back();
  const b = p.box();
  ok(how === 'popstate' && b && b.hidden === false && p.G.isOpen(), 'Back pops the sentinel and the box shows (' + how + ')');
  ok(p.doc.activeElement && p.doc.activeElement.className === 'bgStay', 'Stay is the default (focused)');
  ok(p.flight.running === false && p.flight.clicks.join() === 'pause', 'the flight holds: the player\'s own Pause pressed (' + p.flight.clicks.join() + ')');
  ok(p.H.i === i0 && p.w.history.state && p.w.history.state.flydiyBackGuard === 1, 'the sentinel is back on top (Back once more lands here too)');
  const stay = b.children[2].children.find(c => c.className === 'bgStay');
  stay.click();
  ok(b.hidden === true && !p.G.isOpen(), 'Stay hides the box');
  ok(p.flight.running === true && p.flight.clicks.join() === 'pause,resume' && p.flight.t === t0, 'Stay keeps the state: the flight resumes where it was (' + p.flight.clicks.join() + ')');
  ok(p.leftTo.length === 0 && p.H.gos.length === 0 && p.H.i === i0, 'Stay leaves nothing: still on the game, no history move');
  // back again while open = stay
  p.back(); ok(p.G.isOpen(), 'Back again opens it again');
  const how2 = p.back();
  ok(how2 === 'popstate' && !p.G.isOpen() && p.leftTo.length === 0 && p.flight.running === true, 'Back once more while it is open = Stay (never a silent leave)');
  // esc = stay; keys stop at the box
  p.back(); ok(p.G.isOpen(), 'the box again');
  const k = p.input('w');
  ok(k.stopped === true, 'a key while it is open stops at the box (the flight never sees it)');
  const e = p.input('Escape');
  ok(e.defaultPrevented && !p.G.isOpen() && p.flight.running === true && p.leftTo.length === 0, 'Esc = Stay');
  const k2 = p.input('w');
  ok(!k2.stopped, 'keys reach the game again once it is closed');
}
// 4. leave leaves
{
  const p = page(); p.input(); p.back();
  const leave = p.box().children[2].children.find(c => c.className === 'bgLeave');
  leave.click();
  ok(p.H.gos.join() === '-2' && p.leftTo.join() === 'back', 'Leave goes back past the sentinel and the game\'s entry to the page before (' + p.H.gos.join() + ' -> ' + p.leftTo.join() + ')');
  p.tick(1000);
  ok(p.leftTo.length === 1, 'the first-page fallback does not fire once the page has gone');
  ok(!p.G.armed() && !p.unload().defaultPrevented, 'after Leave nothing asks any more (beforeunload passes)');
  const f = page({ first: true, referrer: 'https://degaror.github.io/' }); f.input(); f.back();
  ok(f.G.isOpen(), 'a game that was the tab\'s first page: Back still asks');
  f.G.leave(); f.tick(700);
  ok(f.leftTo.join() === 'https://degaror.github.io/', 'Leave on a first page replaces it with the referrer (' + f.leftTo.join() + ')');
  const g = page({ first: true }); g.input(); g.back(); g.G.leave(); g.tick(700);
  ok(g.leftTo.join() === '/', 'no referrer: the site\'s root (' + g.leftTo.join() + ')');
}
// 5. the player's pause is theirs
{
  const p = page({ paused: true }); p.input(); p.back();
  ok(p.G.isOpen() && p.flight.clicks.length === 0 && p.flight.running === false, 'a flight the player paused: the box presses nothing');
  p.G.stay();
  ok(p.flight.clicks.length === 0 && p.flight.running === false, '... and Stay leaves it paused');
  const g = page({ garage: true }); g.input(); g.back();
  ok(g.G.isOpen() && g.flight.clicks.length === 0, 'the garage (Pause hidden: nothing runs): the box asks, presses nothing');
}
// 6. tab close / reload
{
  const p = page(); p.input('a');
  p.tick(5000);
  ok(p.unload().defaultPrevented === true, 'armed, no in-page click lately: beforeunload asks (the browser\'s own prompt)');
  p.input(); p.tick(1000);
  ok(!p.unload().defaultPrevented, 'within 3 s of an in-page click (a settings reload, the update pill): it passes');
  p.tick(5000);
  ok(p.unload().defaultPrevented === true, '... and asks again after');
  p.input(); p.input({ key: 'r', ctrl: true });
  ok(p.unload().defaultPrevented === true, 'Ctrl+R is never an in-page intent');
  p.input(); p.input('F5');
  ok(p.unload().defaultPrevented === true, 'F5 is never an in-page intent');
  const q = page(); p.tick(0);
  ok(!q.unload().defaultPrevented, 'never before the player\'s first input (not armed)');
}
// 7. negative - never on a rig
{
  const cases = [['WELCOME.RIG', { rig: true }], ['navigator.webdriver without welcome.js', { noWelcome: true, webdriver: true }],
    ['?nogate', { search: '?nogate' }], ['?nogate=1', { search: '?x=2&nogate=1' }], ['?backguard=0', { search: '?backguard=0' }], ['a frame', { frame: true }]];
  for (const [name, o] of cases) {
    const p = page(o);
    const n = p.w._n();
    p.input(); p.input('a');
    const how = p.back();
    ok(p.G && p.G.on === false && n === 0 && p.H.pushes === 0 && !p.box() && how === 'left' && !p.unload().defaultPrevented,
      'NEGATIVE ' + name + ': no guard (' + (p.G && p.G.why) + '), ' + n + ' listeners, no push, Back leaves as before');
  }
  const f = page({ rig: true, search: '?backguard=1' }); f.input(); f.back();
  ok(f.G.on === true && f.G.isOpen(), '?backguard=1 forces it on a rig that wants to test it');
  const pl = page({ search: '?nogatex=1' });
  ok(pl.G.on === true, 'a look-alike flag (?nogatex) is not ?nogate');
}
// 8. the page
{
  const build = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  const m = /\n\s*scripts:\s*\[([\s\S]*?)\]/.exec(build.slice(build.indexOf('viewer: {')));
  const list = m ? (m[1].match(/'[a-z0-9_]+\.js'/g) || []).map(s => s.slice(1, -1)) : [];
  const bi = list.indexOf('back_guard.js'), ai = list.indexOf('app.js');
  ok(bi >= 0 && (ai < 0 || bi < ai), 'build.js: back_guard.js in the viewer scripts' + (ai >= 0 ? ', before app.js' : '') + ' (' + bi + ' / ' + ai + ')');
  const p = page(); p.input(); p.back();
  const css = (p.doc.getElementById('bgCss') || {}).textContent || '';
  const boxCss = (/#bgBox\{[^}]*\}/.exec(css) || [''])[0];
  ok(/position:fixed/.test(boxCss) && /top:calc\(env\(safe-area-inset-top/.test(boxCss) && !/top:\s*50%/.test(css) && !/translate\(-50%,\s*-50%\)/.test(css),
    'a top-edge card (fixed, under the safe area), never a centre card');
  ok(/var\(--ed-plate\)/.test(boxCss) && /--ed-ink:/.test(boxCss) && /var\(--ed-acc\)/.test(css), 'the garage\'s --ed-* tokens');
  ok(/'IBM Plex Sans'/.test(css) && /font-style:normal/.test(css) && !/italic|Georgia|Times/.test(css) && !/serif['";,\s]*[;}]/.test(css.replace(/sans-serif/g, '')),
    'IBM Plex Sans upright: no serif, no italics');
  ok(/html\.phone #bgBox button\{min-height:48px/.test(css) && /width:min\(420px, calc\(100vw - 32px\)\)/.test(boxCss), 'the phone layout: the width inside 16 px gutters, 48 px buttons under html.phone');
  const head = p.box().children[0];
  ok(head.className === 'bgHead' && head._n('pointerdown') === 1 && head._n('pointermove') === 1, 'draggable by its title line without card_drag.js');
  p.w._fire('pointerdown', {});
  head._fire('pointerdown', { pointerId: 7, clientX: 150, clientY: 30 }); head._fire('pointermove', { pointerId: 7, clientX: 250, clientY: 330 });
  ok(p.box().style.left === '200px' && p.box().style.top === '312px' && p.box().style.transform === 'none', 'a drag moves it (' + p.box().style.left + ', ' + p.box().style.top + ')');
  const d = page({ drag: true }); d.input(); d.back();
  const bd = d.w.FLYDIY_DRAG.bound[0];
  ok(bd && bd.el === d.box() && bd.key === 'backGuard' && bd.opts.handle === '.bgHead', 'with card_drag.js on the page: FLYDIY_DRAG.card(box, \'backGuard\', its title line)');
  const DEV = /navigator\.userAgent|userAgentData|location\.hostname|location\.host\b|pointer:\s*coarse|innerWidth\s*</g;
  ok(!(SRC.match(DEV) || []).length, 'no device test in the module (it asks WELCOME.RIG and html.phone - GATE GFX\'s rule)');
}

console.log(fails ? 'GATE BACKGUARD: FAIL' : 'GATE BACKGUARD: PASS');
process.exit(fails ? 1 : 0);
