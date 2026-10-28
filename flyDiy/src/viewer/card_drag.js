// card_drag.js - EVERY CARD THE GAME SHOWS IS DRAGGABLE (G3526-G3529, GAME-MENUS; the user, 25 Oct: "super important;
// any card you show in game should be draggable, so they never cover anything important anymore. This has been a real
// pain.")
//
// ONE HELPER, window.FLYDIY_DRAG, for every card and panel the game shows over the view: the arrival / crash card, the
// bench's run card and award, the story's card and Tim's band, the menu, the freight panel, the boombox, the controls
// panel, the hardware notice. The flight's own HUD panels (the PFD, the minimap, the rail, the trace) keep app.js
// flPlace - placed in the flight layer, laid out by flLayout - and are not cards.
//
// - A REGISTRY BY SELECTOR (CARDS below, + register()): a 400 ms scan finds each card wherever and whenever its own
//   code makes it, so no card's code changes to become draggable, and a card made again (a re-render, a new element)
//   is found again. card(el, key, opts) binds an element in hand.
// - THE GESTURE is app.js flPlace's: pointer events (mouse, touch, pen), nothing captured until the pointer has moved
//   4 px (a press that does not travel is a click and is left alone), then the pointer is captured and the click that
//   ends the drag is eaten - one, in the capture phase. A drag never STARTS on a control (button, a, input, select,
//   textarea, label, anything inside [data-nodrag]): a card's buttons stay buttons and its sliders stay sliders. The
//   handle is the card itself unless the entry names one (a header).
// - THE PLACE: none until the player drags - the card stands where its own CSS puts it. The first drag fixes its width
//   (a card anchored left AND right would otherwise change size) and writes left / top with right / bottom auto,
//   transform none and margin 0, inline, in the frame of its containing block (the viewport for a fixed card). Kept
//   inside the viewport (all of it when it fits; its top-left corner when it does not), again on a resize.
// - REMEMBERED PER CARD TYPE (the key), in localStorage flydiy.cardPos (every access wrapped: a browser that keeps
//   nothing still drags, for the page's life). A card whose own code writes a position, or one made again, gets the
//   saved place back at the next scan.
// - A WAY BACK: a double-click on the handle puts that card back where its CSS puts it; resetAll() (the MENU's "Cards
//   back in place") puts them all back.
// - THE CLASSES: the card .cdCard, its handle .cdHandle (cursor: grab), body.cdDragging during a drag - a page guard
//   that holds the pointer (the story's tutor steps) lets a target inside .cdHandle through.
//
// GATE CARDDRAG (tools/_carddrag_check.js): the census (every card-like id in src/viewer registered here or allow-listed
// with its reason) and the gesture in a stub DOM. Pure half: require() gives { CARDS, clampPos, startsDrag }.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;

  // [selector, key, handle selector ('' = the card itself)]
  const CARDS = [
    ['#arrCard', 'arrival', ''],      // the end of a flight and its crash form; the career's line (body.html, app.js)
    ['#bRun', 'benchRun', ''],        // the bench's run card (bench.js)
    ['#bAward', 'benchAward', ''],    // the bench's award / certificate (bench.js)
    ['#stCard', 'story', ''],         // the story's beat card (app.js)
    ['#stTim', 'tim', ''],            // Tim's band (app.js; its data-tim buttons stay buttons)
    ['#gmPanel', 'menu', '.gmHead'],  // the menu (app.js G3520): by its header, the rows are all buttons
    ['#frLoad', 'freight', ''],       // the freight loading panel (freight_load.js)
    ['#bbPanel', 'boombox', ''],      // the boombox (boombox.js)
    ['#ctlPanel', 'controls', ''],    // the controls panel (input_panel.js)
    ['#hwNote', 'hwNote', ''],        // the graphics' hardware notice (gfx_settings.js)
  ];
  const STORE = 'flydiy.cardPos', MOVE_PX = 4, SCAN_MS = 400, KEEP = 40;
  const NO_DRAG = 'button, a, input, select, textarea, label, option, [contenteditable="true"], [data-nodrag]';

  // a position kept on screen: the whole card when it fits, else its top-left corner (pure)
  function clampPos(p, w, h, vw, vh) {
    const x = w <= vw ? Math.min(Math.max(0, p.x), vw - w) : Math.min(Math.max(0, p.x), Math.max(0, vw - KEEP));
    const y = h <= vh ? Math.min(Math.max(0, p.y), vh - h) : Math.min(Math.max(0, p.y), Math.max(0, vh - KEEP));
    return { x: Math.round(x), y: Math.round(y) };
  }
  // does a press on this target start a drag of its card? (not on a control; only inside the handle)
  function startsDrag(target, handle) {
    if (!target || !handle || typeof target.closest !== 'function') return false;
    if (target.closest(NO_DRAG)) return false;
    return target === handle || (typeof handle.contains === 'function' && handle.contains(target));
  }
  const CORE = { CARDS, clampPos, startsDrag, STORE, MOVE_PX };
  if (!W || !W.document) { if (typeof module !== 'undefined') module.exports = CORE; return; }
  const D = W.document;

  // ---- the store -------------------------------------------------------------------------------------------------
  let mem = null;
  function load() {
    if (mem) return mem;
    mem = {};
    try { const v = JSON.parse(W.localStorage.getItem(STORE) || '{}'); if (v && typeof v === 'object') for (const k of Object.keys(v)) { const p = v[k]; if (p && isFinite(p.x) && isFinite(p.y)) mem[k] = { x: +p.x, y: +p.y, w: isFinite(p.w) ? +p.w : 0 }; } }
    catch (e) {}
    return mem;
  }
  function save() { try { W.localStorage.setItem(STORE, JSON.stringify(load())); } catch (e) {} }

  // ---- placing ---------------------------------------------------------------------------------------------------
  const vw = () => W.innerWidth || (D.documentElement && D.documentElement.clientWidth) || 1280;
  const vh = () => W.innerHeight || (D.documentElement && D.documentElement.clientHeight) || 720;
  // the origin of the card's containing block, in viewport px (the viewport for a fixed card)
  function origin(el) {
    try {
      if (W.getComputedStyle(el).position === 'fixed') return [0, 0];
      const op = el.offsetParent; if (!op) return [0, 0];
      const r = op.getBoundingClientRect();
      return [r.left + (op.clientLeft || 0), r.top + (op.clientTop || 0)];
    } catch (e) { return [0, 0]; }
  }
  const px = v => Math.round(v) + 'px';
  function apply(el, p) {
    const r = el.getBoundingClientRect(), w = p.w || r.width, q = clampPos(p, w, r.height, vw(), vh()), o = origin(el), s = el.style;
    const want = { left: px(q.x - o[0]), top: px(q.y - o[1]), right: 'auto', bottom: 'auto', transform: 'none', margin: '0px' };
    if (p.w) want.width = px(p.w);
    for (const k of Object.keys(want)) if (s[k] !== want[k]) s[k] = want[k];
    el.__cdSet = true;
  }
  function unapply(el) {
    if (!el.__cdSet) return;
    for (const k of ['left', 'top', 'right', 'bottom', 'transform', 'margin', 'width']) el.style[k] = '';
    el.__cdSet = false;
  }

  // ---- the gesture (app.js flPlace's, on any card) ----------------------------------------------------------------
  const bound = new Map();   // key -> { el, sel }
  // the handle: the card, or its element matching the entry's selector - looked up at each press, since a card's own
  // code may write its insides again (the menu does on every open); mark() puts the classes back on whatever is there
  function handleOf(el, sel, t) {
    if (!sel) return el;
    const h = t && typeof t.closest === 'function' ? t.closest(sel) : null;
    return h && (h === el || el.contains(h)) ? h : null;
  }
  function mark(el, sel) {
    const hs = sel ? (el.querySelectorAll ? Array.from(el.querySelectorAll(sel)) : []) : [el];
    for (const h of hs) { if (h.classList && !h.classList.contains('cdHandle')) h.classList.add('cdHandle'); if (h.style && h.style.touchAction !== 'none') h.style.touchAction = 'none'; }
  }
  function card(el, key, opts) {
    if (!el || !key || el.__cdKey) return el;
    opts = opts || {};
    const sel = opts.handle || '';
    el.__cdKey = key;
    if (el.classList) el.classList.add('cdCard');
    mark(el, sel);
    bound.set(key, { el, sel });
    let armed = false, moving = false, sx = 0, sy = 0, ox = 0, oy = 0, eat = false, pid = null;
    el.addEventListener('pointerdown', e => {
      if (e.button || !startsDrag(e.target, handleOf(el, sel, e.target))) return;
      const r = el.getBoundingClientRect();
      armed = true; moving = false; sx = e.clientX; sy = e.clientY; ox = e.clientX - r.left; oy = e.clientY - r.top; pid = e.pointerId;
      e.stopPropagation();   // a press on a card is never a press on the world behind it
    });
    el.addEventListener('pointermove', e => {
      if (!armed) return;
      if (!moving) {
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < MOVE_PX) return;
        moving = true;
        // the capture only once it is a drag (flPlace's note: an early capture retargets the click onto the card)
        try { el.setPointerCapture(pid); } catch (err) {}
        if (D.body && D.body.classList) D.body.classList.add('cdDragging');
      }
      const P = load(), r = el.getBoundingClientRect(), p = P[key] || (P[key] = { x: 0, y: 0, w: 0 });
      if (!p.w) p.w = Math.round(r.width);
      p.x = e.clientX - ox; p.y = e.clientY - oy;
      apply(el, p);
      const q = clampPos(p, p.w, r.height, vw(), vh()); p.x = q.x; p.y = q.y;
      e.preventDefault();
    });
    const up = () => {
      if (!armed) return;
      armed = false;
      try { el.releasePointerCapture(pid); } catch (err) {}
      if (!moving) return;   // it never travelled: a click
      moving = false;
      if (D.body && D.body.classList) D.body.classList.remove('cdDragging');
      eat = true; W.setTimeout(() => { eat = false; }, 0);   // the click of this gesture, and only it
      save();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('click', e => { if (eat) { eat = false; e.stopPropagation(); e.preventDefault(); } }, true);
    el.addEventListener('dblclick', e => { if (!startsDrag(e.target, handleOf(el, sel, e.target))) return; reset(key); e.preventDefault(); });
    const p = load()[key]; if (p) apply(el, p);
    return el;
  }
  function reset(key) {
    const P = load(); delete P[key]; save();
    const b = bound.get(key); if (b) unapply(b.el);
  }
  function resetAll() { for (const k of Object.keys(load())) delete mem[k]; save(); for (const b of bound.values()) unapply(b.el); }

  // ---- the scan: new cards bound, re-made ones re-bound, a moved card put back where the player left it ------------
  const extra = [];
  function scan() {
    const P = load();
    for (const [sel, key, handle] of CARDS.concat(extra)) {
      let el = null; try { el = D.querySelector(sel); } catch (e) {}
      if (!el) continue;
      const b = bound.get(key);
      if (!b || b.el !== el) { if (b) bound.delete(key); card(el, key, { handle }); continue; }
      if (handle) mark(el, handle);
      if (P[key] && !el.hidden) apply(el, P[key]);
    }
  }
  function register(sel, key, opts) {
    if (typeof sel !== 'string' || !key || CARDS.concat(extra).some(c => c[1] === key)) return false;
    extra.push([sel, key, (opts && opts.handle) || '']); scan(); return true;
  }
  if (D.head && D.createElement) try {
    const st = D.createElement('style');
    st.textContent = '.cdHandle{cursor:grab}body.cdDragging,body.cdDragging .cdHandle{cursor:grabbing;-webkit-user-select:none;user-select:none}' +
      '.cdHandle :is(button,a,input,select,textarea,label,[data-nodrag]){cursor:auto}.cdHandle button,.cdHandle a{cursor:pointer}';
    D.head.appendChild(st);
  } catch (e) {}
  if (typeof W.setInterval === 'function') W.setInterval(() => { try { scan(); } catch (e) {} }, SCAN_MS);
  if (typeof W.addEventListener === 'function') W.addEventListener('resize', () => { try { const P = load(); for (const [k, b] of bound) if (P[k] && !b.el.hidden) apply(b.el, P[k]); } catch (e) {} });
  W.FLYDIY_DRAG = Object.assign({ card, register, reset, resetAll, scan, placed: key => !!load()[key], keys: () => Object.keys(load()) }, CORE);
})();
