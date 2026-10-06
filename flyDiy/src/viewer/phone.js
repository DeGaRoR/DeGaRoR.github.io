// phone.js - THE PHONE GARAGE'S TOUCH LAYER (MOBILE-GARAGE 1, G2101-G2102)
//
// Runs ONLY on the phone profile (profile.js, ui 'touch'); on the desktop its first line returns and nothing of it
// exists. It builds no editor of its own: the rows are _cage_ui.js's own elements, in editor.js's own columns, and
// phone.css re-lays those columns as ONE SHEET under the view (portrait) or beside it (landscape), with a tab bar in
// the thumb zone. What this file adds, all of it per futureDesigns/MOBILE-GARAGE-2026-10-04.md §2:
//
// THE SHEET'S TABS. Parts (the tree) / Edit (the properties column) / Plaque (the information panel) - one surface at a
//   time on a phone's width; picking a part in the tree or in the view opens Edit.
// THE FINGER KNOB (R4-R13, the user's ruling: "move sliders only by dragging the knob, NOT by touching the position on
//   the scale, otherwise it conflicts with simply scrolling through the slider list"):
//   - the native range takes no touch at all (phone.css: pointer-events none) - a finger anywhere on the scale scrolls
//     the sheet (pan-y), whatever its direction;
//   - a 48 px hit area over the thumb (touch-action none, pointer captured on down) moves the value RELATIVELY: the
//     finger's travel over the scale's width is the range, never a jump to where it pressed;
//   - press and hold it 0.35 s still, then drag: FINE, x0.1 (the knob turns amber, the bubble says so) - R9;
//   - a live bubble above the finger says the value (the finger hides the knob) - R11;
//   - - / + steppers (48 px) move one step; held, they repeat (400 ms, then every 80 ms) - R6;
//   - the value chip is _cage_ui's own typed field (inputmode decimal) - R7.
//   THE EVENTS ARE THE EDITOR'S (R12): the knob and the steppers press the range the way a mouse does - a pointerdown on
//   it (GARAGE-INSTANT's DRAG_ON), `input` ticks (the preview path), and the release (the window's pointerup, then
//   `change`) - so a finger's drag is the same tick -> release a mouse's is, byte for byte. At most one tick a frame
//   (R13): moves in between are coalesced, the last value kept, and the one still waiting when the finger lifts is
//   delivered by profile.js's early pointerup hook, before the editor's release build runs.
// THE RAIL keeps the profile's entries (profile.js 'rail'); the rest are a desktop's.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  if (!W || !W.PROFILE || !W.PROFILE.is || !W.PROFILE.is('ui', 'touch')) return;   // THE DESKTOP: nothing below runs
  const D = W.document, $ = id => D.getElementById(id);
  const KNOB = 26, HIT = 48, FINE_MS = 350, FINE_GAIN = 0.1, STILL_PX = 6, REP0 = 400, REP = 80;

  // ---- the page: no browser zoom (a pinch is the view's), no pull-to-refresh (phone.css) -------------------------
  try {
    const mv = D.querySelector('meta[name=viewport]');
    if (mv) mv.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  } catch (e) {}

  // ---- THE SHEET'S TABS ------------------------------------------------------------------------------------------
  const TABS = [['parts', 'Parts'], ['props', 'Edit'], ['info', 'Plaque']];
  const LS_TAB = 'flydiy.phTab';
  let tab = 'props';
  try { const t = W.sessionStorage.getItem(LS_TAB); if (TABS.some(x => x[0] === t)) tab = t; } catch (e) {}
  const setTab = k => {
    tab = k;
    const b = D.body; if (!b) return;
    for (const [t] of TABS) b.classList.toggle('ph-' + t, t === k);
    const nav = $('phTabs');
    if (nav) for (const btn of nav.children) btn.classList.toggle('on', btn.dataset.t === k);
    try { W.sessionStorage.setItem(LS_TAB, k); } catch (e) {}
    W.requestAnimationFrame(placeAll);
  };
  function buildTabs() {
    if ($('phTabs')) return;
    const host = $('wsUI') || D.body;
    const nav = D.createElement('nav'); nav.id = 'phTabs';
    for (const [k, label] of TABS) {
      const b = D.createElement('button'); b.type = 'button'; b.dataset.t = k; b.textContent = label;
      b.onclick = () => setTab(k);
      nav.appendChild(b);
    }
    host.appendChild(nav);
    setTab(tab);
  }
  // a part picked - in the tree, or by a tap on the aeroplane - opens its rows
  function hookSelection() {
    const tree = $('edTree');
    if (tree && !tree.__ph) {
      tree.__ph = true;
      tree.addEventListener('click', e => {
        const t = e.target;
        if (!t || !t.closest || t.closest('u.fold') || !t.closest('.edN')) return;
        setTimeout(() => setTab('props'), 0);
      });
    }
    const name = $('edPartName');
    if (name && !name.__ph && typeof MutationObserver === 'function') {
      name.__ph = true;
      let last = name.textContent;
      new MutationObserver(() => { const now = name.textContent; if (now !== last) { last = now; if (tab === 'parts') setTab('props'); } })
        .observe(name, { childList: true, characterData: true, subtree: true });
    }
  }

  // ---- THE RAIL: the profile's entries --------------------------------------------------------------------------
  function trimRail() {
    const keep = W.PROFILE.get('rail'), rail = $('edRail');
    if (!keep || !rail) return;
    for (const b of rail.children) if (b.dataset && b.dataset.f) b.hidden = keep.indexOf(b.dataset.f) < 0;
  }

  // ---- THE BUBBLE (R11) -------------------------------------------------------------------------------------------
  let bubble = null;
  const bubbleShow = (x, y, text, fine) => {
    if (!bubble) { bubble = D.createElement('div'); bubble.id = 'phBubble'; D.body.appendChild(bubble); }
    bubble.textContent = text + (fine ? '  · fine ×0.1' : '');
    bubble.classList.toggle('fine', !!fine);
    bubble.hidden = false;
    const w = bubble.offsetWidth || 80;
    bubble.style.left = Math.round(Math.max(6, Math.min(W.innerWidth - w - 6, x - w / 2))) + 'px';
    bubble.style.top = Math.round(Math.max(6, y - 74)) + 'px';
  };
  const bubbleHide = () => { if (bubble) bubble.hidden = true; };

  // ---- THE FINGER KNOB --------------------------------------------------------------------------------------------
  const ROWS = new Set();   // enhanced rows (each keeps its own parts on __ph)
  const num = (x, d) => { const v = parseFloat(x); return Number.isFinite(v) ? v : d; };
  const rangeOf = rng => {
    const lo = num(rng.min, 0), hi = num(rng.max, 100), st = num(rng.step, 1) || 1;
    return { lo, hi, st };
  };
  const snap = (rng, v) => {
    const { lo, hi, st } = rangeOf(rng);
    v = lo + Math.round((v - lo) / st) * st;
    v = Math.max(lo, Math.min(hi, v));
    // the step's own decimals (0.1 + 0.2 is not 0.3)
    const dec = (String(rng.step).split('.')[1] || '').length;
    return dec ? +v.toFixed(Math.min(10, dec + 1)) : v;
  };
  const valueText = row => {
    const ph = row.__ph, vf = ph.vf;
    const t = vf ? vf.value : ph.rng.value;
    const mu = ph.mu && ph.mu.textContent ? '  ' + ph.mu.textContent : '';
    return t + mu;
  };
  function place(row) {
    const ph = row.__ph; if (!ph) return;
    // (a row parked in the editor's nursery or in a folded section has no box: skipped before anything is measured)
    if (!row.isConnected || row.offsetParent === null || ph.rng.disabled) { if (!ph.knob.hidden) ph.knob.hidden = true; return; }
    const rng = ph.rng, w = rng.offsetWidth;
    if (!w) { ph.knob.hidden = true; return; }
    ph.knob.hidden = false;
    const { lo, hi } = rangeOf(rng);
    const f = hi > lo ? Math.max(0, Math.min(1, (num(rng.value, lo) - lo) / (hi - lo))) : 0;
    const x = rng.offsetLeft + KNOB / 2 + f * (w - KNOB);
    ph.knob.style.left = Math.round(x - HIT / 2) + 'px';
    ph.knob.style.top = Math.round(rng.offsetTop + rng.offsetHeight / 2 - HIT / 2) + 'px';
  }
  function placeAll() { for (const r of ROWS) if (r.isConnected) place(r); }

  // THE DRAG: one at a time
  let drag = null;
  function tick() {   // R13: the pending value, at most once a frame
    if (!drag) return;
    drag.raf = 0;
    const v = drag.pending; drag.pending = null;
    if (v == null || v === num(drag.rng.value, NaN)) return;
    drag.rng.value = String(v);
    drag.rng.dispatchEvent(new Event('input', { bubbles: true }));
    place(drag.row);
    bubbleShow(drag.x, drag.y, valueText(drag.row), drag.fine);
  }
  const flush = () => { if (drag && drag.pending != null) { if (drag.raf) W.cancelAnimationFrame(drag.raf); tick(); } };
  // the early release hook (profile.js): the last move reaches the slider as a tick, before the editor's release
  W.PROFILE.onUp = flush;
  // a press on the range itself, as a mouse's would be: GARAGE-INSTANT's DRAG_ON (and the stand's wake)
  const press = rng => { try { rng.dispatchEvent(new PointerEvent('pointerdown', { bubbles: false })); } catch (e) { rng.dispatchEvent(new Event('pointerdown')); } };
  const release = rng => rng.dispatchEvent(new Event('change', { bubbles: true }));

  function knobDown(row, e) {
    const ph = row.__ph, rng = ph.rng;
    if (rng.disabled || drag) return;
    e.preventDefault(); e.stopPropagation();
    try { ph.knob.setPointerCapture(e.pointerId); } catch (x) {}
    const { lo, hi } = rangeOf(rng);
    drag = { row, rng, id: e.pointerId, x0: e.clientX, v0: num(rng.value, lo), span: hi - lo, w: Math.max(40, rng.offsetWidth - KNOB),
             fine: false, moved: false, x: e.clientX, y: e.clientY, pending: null, raf: 0, hold: 0, t0: e.timeStamp, judged: false,
             xd: e.clientX, vd: num(rng.value, lo) };
    // R9: held still FINE_MS, the knob goes fine. Judged on the events' own clock (a move whose timestamp is FINE_MS past
    // the press with nothing moved before it), so a busy main thread - a phone mid-build - cannot turn a held press
    // coarse by running the timer late; the timer only shows it (the amber knob, the bubble) while the finger rests
    const goFine = () => { if (!drag || drag.moved || drag.fine) return;
      drag.fine = true; drag.x0 = drag.x; drag.v0 = num(rng.value, lo);
      ph.knob.classList.add('fine'); row.classList.add('phFine');
      bubbleShow(drag.x, drag.y, valueText(row), true); };
    drag.goFine = goFine;
    drag.hold = setTimeout(goFine, FINE_MS);
    row.classList.add('phDrag');
    press(rng);
    bubbleShow(e.clientX, e.clientY, valueText(row), false);
  }
  function knobMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    // THE FIRST REAL MOVE JUDGES (R9): a finger's jitter inside STILL_PX moves nothing and decides nothing; the first move
    // past it is fine when it came FINE_MS or more after the press, coarse otherwise - whatever the timer showed meanwhile
    // (a timer can fire late, or early between two moves a slow page has not dispatched yet)
    if (!drag.judged) {
      if (Math.abs(e.clientX - drag.xd) <= STILL_PX) { drag.y = e.clientY; return; }
      drag.judged = true;
      const held = e.timeStamp - drag.t0 >= FINE_MS;
      if (held && !drag.fine) drag.goFine();   // (x0 is still the press's: nothing moved)
      else if (!held && drag.fine) { drag.fine = false; drag.x0 = drag.xd; drag.v0 = drag.vd;
        drag.row.__ph.knob.classList.remove('fine'); drag.row.classList.remove('phFine'); }
    }
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.moved && Math.abs(e.clientX - drag.x0) > STILL_PX) drag.moved = true;
    const gain = drag.fine ? FINE_GAIN : 1;
    const v = snap(drag.rng, drag.v0 + (e.clientX - drag.x0) / drag.w * drag.span * gain);
    drag.pending = v;
    if (!drag.raf) drag.raf = W.requestAnimationFrame(tick);
    bubbleShow(drag.x, drag.y, valueText(drag.row), drag.fine);
  }
  function knobUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    flush();
    const d = drag; drag = null;
    clearTimeout(d.hold);
    d.row.classList.remove('phDrag', 'phFine'); d.row.__ph.knob.classList.remove('fine');
    release(d.rng);   // (the window's pointerup ran first: the editor's release build - this is the range's own `change`)
    bubbleHide();
    place(d.row);
  }

  // THE STEPPERS (R6): a tap is one step; held, they repeat - one press, ticks, one release, as a drag
  let rep = null;
  function stepDown(row, dir, e) {
    const ph = row.__ph, rng = ph.rng;
    if (rng.disabled || drag || rep) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
    const one = () => {
      const { st } = rangeOf(rng);
      const v = snap(rng, num(rng.value, 0) + dir * st);
      if (v === num(rng.value, NaN)) return;
      rng.value = String(v);
      rng.dispatchEvent(new Event('input', { bubbles: true }));
      place(row);
    };
    press(rng);
    one();
    rep = { row, rng, t: setTimeout(function again() { one(); rep.t = setTimeout(again, REP); }, REP0) };
  }
  function stepUp() {
    if (!rep) return;
    clearTimeout(rep.t);
    const r = rep; rep = null;
    release(r.rng);
  }

  function enhance(row) {
    if (!row || row.__ph || !row.classList || !row.classList.contains('r')) return;
    const rng = row.querySelector(':scope > input[type=range]');
    if (!rng) return;
    const knob = D.createElement('i'); knob.className = 'phKnob'; knob.setAttribute('aria-hidden', 'true');
    const minus = D.createElement('button'); minus.type = 'button'; minus.className = 'phStep phMinus'; minus.textContent = '−'; minus.setAttribute('aria-label', 'less');
    const plus = D.createElement('button'); plus.type = 'button'; plus.className = 'phStep phPlus'; plus.textContent = '+'; plus.setAttribute('aria-label', 'more');
    row.insertBefore(minus, rng);
    rng.insertAdjacentElement('afterend', plus);
    row.appendChild(knob);
    const vf = row.querySelector(':scope > input.v'), mu = [...row.children].find(c => c.tagName === 'SPAN' && !c.classList.contains('k') && !c.classList.contains('v') && c !== knob) || null;
    row.__ph = { rng, knob, vf, mu, minus, plus };
    row.classList.add('phSlider');
    knob.addEventListener('pointerdown', e => knobDown(row, e));
    knob.addEventListener('pointermove', knobMove);
    knob.addEventListener('pointerup', knobUp);
    knob.addEventListener('pointercancel', knobUp);
    knob.addEventListener('lostpointercapture', knobUp);
    for (const [b, dir] of [[minus, -1], [plus, 1]]) {
      b.addEventListener('pointerdown', e => stepDown(row, dir, e));
      b.addEventListener('pointerup', stepUp);
      b.addEventListener('pointercancel', stepUp);
      b.addEventListener('lostpointercapture', stepUp);
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    ROWS.add(row);
    place(row);
  }
  function enhanceIn(host) {
    if (!host) return;
    for (const r of host.querySelectorAll('.r')) enhance(r);
  }

  // ---- WIRING: the rows arrive with the editor (and move in and out of the column on every selection) -----------
  function watch(host) {
    if (!host || host.__phW) return;
    host.__phW = true;
    enhanceIn(host);
    if (typeof MutationObserver === 'function')
      new MutationObserver(() => { enhanceIn(host); W.requestAnimationFrame(placeAll); }).observe(host, { childList: true, subtree: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => placeAll()).observe(host);
    host.addEventListener('scroll', () => {}, { passive: true });
  }
  let up = false;
  function init() {
    if (!$('edRows') || !$('edTree')) return false;
    if (!up) {
      up = true;
      D.body.classList.add('ph');
      buildTabs();
      watch($('edRows'));
      watch($('edFlyBody'));
      // a value set by anything but a finger (a load, a reset, the typed chip, syncSliders) moves the knob too
      setInterval(() => { if (!drag && !D.hidden) placeAll(); }, 400);
      W.addEventListener('resize', () => W.requestAnimationFrame(placeAll));
      W.addEventListener('orientationchange', () => setTimeout(placeAll, 200));
    }
    hookSelection();
    trimRail();
    return true;
  }
  // the editor opens inside the boot (its 'editor' step); the rail and the tree fill after it
  const poll = setInterval(() => { if (init() && $('edRail') && $('edRail').children.length) { trimRail(); clearInterval(poll); } }, 250);
  W.PHONE_UI = { setTab, tab: () => tab, placeAll, enhance, rows: () => ROWS.size };
})();
