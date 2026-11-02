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
//
// G3900-G3904 PHONE-EDIT-LAYOUT (the user, 2 Nov, two planes built on an S20 FE: "split 50/50", "the controls too
// narrow", "touch-friendly AND denser", and they typed values when the sliders lagged - typing is first-class):
// - THE SPLIT: --ph-split (the view's share, phone.css) per orientation, .5 by default, remembered (flydiy.phSplit);
//   #phDiv on the line between view and controls moves it - a ghost line while the thumb moves, the view resized once
//   on release; a double tap puts it back to half.
// - THE ROW (phone.css): one control a row, ~44 px, the scale the row's width; the row's - / + moved into the editor.
// - THE VALUE'S EDITOR (#phEdit): a tap on a slider's value or label opens it - the number typed (inputmode decimal),
//   the unit, - / + (held: they repeat), Done / Enter / a tap outside sets it, Esc leaves it; it rides the keyboard's
//   top edge (visualViewport). A typed value goes through _cage_ui's own typed field (v_<k>'s change: clamp, then the
//   editor's oninput - one full build, no drag).
// - THE PRECISION DRAG: the farther the finger from the scale (vertically), the smaller the gain - 1 within 40 px, then
//   40 / distance (x0.5 at 80 px, x0.25 at 160, never under x0.05); the hold-still fine (x0.1) multiplies it. The value
//   is integrated move by move, so a gain change never jumps it. The bubble says the value big and the gain under it.
// THE EVENT CONTRACT (for a cheap preview on `input` and the full build on `change` - PHONE-EDIT-PERF): a drag and a
//   held - / + are pointerdown on the range, `input` at most once a frame while the finger moves, then the window's
//   pointerup and the range's `change` once on release; a typed value is v_<k>'s `change` alone (no pointerdown, no
//   `input` on the range). Nothing here builds the aeroplane: the editor's own handlers do.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  if (!W || !W.PROFILE || !W.PROFILE.is || !W.PROFILE.is('ui', 'touch')) return;   // THE DESKTOP: nothing below runs
  const D = W.document, $ = id => D.getElementById(id);
  const KNOB = 22, HIT = 48, FINE_MS = 350, FINE_GAIN = 0.1, STILL_PX = 6, REP0 = 400, REP = 80;
  const V_FREE = 40, V_MIN = 0.05;   // the precision drag: full gain within 40 px of the scale, then 40 / distance
  const ls = { get: k => { try { return W.localStorage.getItem(k); } catch (e) { return null; } },
               set: (k, v) => { try { W.localStorage.setItem(k, v); } catch (e) {} } };

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
  // the value big; under it the gain (1: the hint that moving away from the scale is finer)
  const gainText = g => g >= 0.999 ? 'slide away from the scale: finer' : 'fine ×' + (g >= 0.1 ? g.toFixed(2) : g.toFixed(3)).replace(/0+$/, '');
  const bubbleShow = (x, y, text, gain) => {
    if (!bubble) { bubble = D.createElement('div'); bubble.id = 'phBubble'; bubble.appendChild(D.createElement('b')); bubble.appendChild(D.createElement('small')); D.body.appendChild(bubble); }
    gain = gain == null ? 1 : gain;
    bubble.firstChild.textContent = text;
    bubble.lastChild.textContent = gainText(gain);
    bubble.classList.toggle('fine', gain < 0.999);
    bubble.hidden = false;
    const w = bubble.offsetWidth || 120, h = bubble.offsetHeight || 54;
    bubble.style.left = Math.round(Math.max(6, Math.min(W.innerWidth - w - 6, x - w / 2))) + 'px';
    bubble.style.top = Math.round(Math.max(6, y - h - 44)) + 'px';
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
  // G3903: the precision drag's gain from the finger's distance to the scale - and the hold-still fine on top
  const gainOf = d => (d.fine ? FINE_GAIN : 1) * Math.max(V_MIN, Math.min(1, V_FREE / Math.max(V_FREE, Math.abs(d.y - d.yTrack))));
  function tick() {   // R13: the pending value, at most once a frame
    if (!drag) return;
    drag.raf = 0;
    const v = drag.pending; drag.pending = null;
    if (v == null || v === num(drag.rng.value, NaN)) return;
    drag.rng.value = String(v);
    drag.rng.dispatchEvent(new Event('input', { bubbles: true }));
    place(drag.row);
    bubbleShow(drag.x, drag.y, valueText(drag.row), gainOf(drag));
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
    if (ed) edClose(false);
    try { ph.knob.setPointerCapture(e.pointerId); } catch (x) {}
    const { lo, hi } = rangeOf(rng);
    const kb = ph.knob.getBoundingClientRect();
    // THE VALUE IS INTEGRATED move by move (G3903): `acc` is the unsnapped value, `xl` the last x - so the gain (the
    // finger's height over the scale, the hold-still fine) can change mid-drag and the value never jumps
    drag = { row, rng, id: e.pointerId, span: hi - lo, w: Math.max(40, rng.offsetWidth - KNOB), acc: num(rng.value, lo), xl: e.clientX,
             yTrack: kb.top + kb.height / 2, fine: false, moved: false, x: e.clientX, y: e.clientY, pending: null, raf: 0, hold: 0,
             t0: e.timeStamp, judged: false, xd: e.clientX, vd: num(rng.value, lo) };
    // R9: held still FINE_MS, the knob goes fine. Judged on the events' own clock (a move whose timestamp is FINE_MS past
    // the press with nothing moved before it), so a busy main thread - a phone mid-build - cannot turn a held press
    // coarse by running the timer late; the timer only shows it (the amber knob, the bubble) while the finger rests
    const goFine = () => { if (!drag || drag.moved || drag.fine) return;
      drag.fine = true;
      ph.knob.classList.add('fine'); row.classList.add('phFine');
      bubbleShow(drag.x, drag.y, valueText(row), gainOf(drag)); };
    drag.goFine = goFine;
    drag.hold = setTimeout(goFine, FINE_MS);
    row.classList.add('phDrag');
    press(rng);
    bubbleShow(e.clientX, e.clientY, valueText(row), 1);
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
      if (held && !drag.fine) drag.goFine();
      else if (!held && drag.fine) { drag.fine = false;
        drag.row.__ph.knob.classList.remove('fine'); drag.row.classList.remove('phFine'); }
      drag.acc = drag.vd; drag.xl = drag.xd;
    }
    drag.y = e.clientY;
    if (!drag.moved && Math.abs(e.clientX - drag.xd) > STILL_PX) drag.moved = true;
    const g = gainOf(drag);
    const { lo, hi } = rangeOf(drag.rng);
    drag.acc = Math.max(lo, Math.min(hi, drag.acc + (e.clientX - drag.xl) / drag.w * drag.span * g));
    drag.xl = drag.x = e.clientX;
    drag.pending = snap(drag.rng, drag.acc);
    if (!drag.raf) drag.raf = W.requestAnimationFrame(tick);
    bubbleShow(drag.x, drag.y, valueText(drag.row), g);
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

  // THE STEPPERS (R6), in the value's editor since G3900: a tap is one step; held, they repeat - one press, ticks, one
  // release, as a drag
  let rep = null;
  function stepDown(row, dir, e) {
    const ph = row.__ph, rng = ph.rng;
    if (rng.disabled || drag || rep) return;
    e.preventDefault();   // (and the editor's input keeps the focus: the keyboard stays up)
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
    const one = () => {
      const { st } = rangeOf(rng);
      const v = snap(rng, num(rng.value, 0) + dir * st);
      if (v === num(rng.value, NaN)) return;
      rng.value = String(v);
      rng.dispatchEvent(new Event('input', { bubbles: true }));
      place(row);
      edShow();
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
    edShow();
  }

  // ---- THE VALUE'S EDITOR (G3901-G3902) --------------------------------------------------------------------------
  let ed = null;   // { row } while open
  const edEl = {};
  const fmtN = x => { const v = +x; return Number.isFinite(v) ? String(+v.toFixed(6)) : String(x); };
  function edBuild() {
    if (edEl.box) return edEl.box;
    const box = D.createElement('div'); box.id = 'phEdit'; box.hidden = true; box.setAttribute('role', 'dialog');
    const mk = (tag, cls, txt) => { const e = D.createElement(tag); e.className = cls; if (txt != null) e.textContent = txt; box.appendChild(e); return e; };
    edEl.k = mk('span', 'phEk'); edEl.r = mk('span', 'phEr');
    edEl.ok = mk('button', 'phEok', 'Done'); edEl.ok.type = 'button';
    edEl.minus = mk('button', 'phStep phMinus', '−'); edEl.minus.type = 'button'; edEl.minus.setAttribute('aria-label', 'less');
    edEl.inp = mk('input', 'phEin'); edEl.inp.type = 'text'; edEl.inp.inputMode = 'decimal'; edEl.inp.setAttribute('enterkeyhint', 'done');
    edEl.inp.setAttribute('autocomplete', 'off'); edEl.inp.spellcheck = false;
    edEl.u = mk('span', 'phEu');
    edEl.plus = mk('button', 'phStep phPlus', '+'); edEl.plus.type = 'button'; edEl.plus.setAttribute('aria-label', 'more');
    // the OK button and Enter set the typed number; - / + set it first (a typed 2.4 then + is 2.4 + a step), then step
    edEl.ok.addEventListener('pointerdown', e => e.preventDefault());
    edEl.ok.addEventListener('click', () => edClose(true));
    edEl.inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); edClose(true); } else if (e.key === 'Escape') { e.preventDefault(); edClose(false); } });
    for (const [b, dir] of [[edEl.minus, -1], [edEl.plus, 1]]) {
      b.addEventListener('pointerdown', e => { if (!ed) return; edCommit(); stepDown(ed.row, dir, e); });
      b.addEventListener('pointerup', stepUp);
      b.addEventListener('pointercancel', stepUp);
      b.addEventListener('lostpointercapture', stepUp);
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    // a tap anywhere else sets what was typed and leaves (as the row's own typed field did on blur); Esc leaves without
    D.addEventListener('pointerdown', e => { if (ed && !box.contains(e.target)) edClose(true); }, true);
    D.addEventListener('keydown', e => { if (ed && e.key === 'Escape') edClose(false); });
    // THE KEYBOARD: the bar stands on its top edge (Chrome resizes the visual viewport, not the layout one)
    const vv = W.visualViewport;
    if (vv) { const pin = () => { if (!ed) return; const kb = W.innerHeight - (vv.height + vv.offsetTop);
      box.style.bottom = kb > 60 ? Math.round(kb) + 'px' : ''; };
      vv.addEventListener('resize', pin); vv.addEventListener('scroll', pin); edEl.pin = pin; }
    D.body.appendChild(box);
    return (edEl.box = box);
  }
  const cur = row => { const ph = row.__ph; return ph.vf ? ph.vf.value : ph.rng.value; };
  function edShow() {
    if (!ed) return;
    const ph = ed.row.__ph;
    // the model's value, unless the thumb is typing (the field no longer shows what was last put in it)
    if (D.activeElement !== edEl.inp || edEl.inp.value === ed.synced) { edEl.inp.value = cur(ed.row); ed.synced = edEl.inp.value; }
    edEl.u.textContent = ph.mu && ph.mu.textContent ? ph.mu.textContent : '';
  }
  function edOpen(row) {
    const ph = row && row.__ph;
    if (!ph || ph.rng.disabled || drag) return;
    if (ed && ed.row !== row) edClose(false);
    edBuild();
    ed = { row, synced: null };
    row.classList.add('phOpen');
    const { lo, hi } = rangeOf(ph.rng);
    edEl.k.textContent = (ph.k && ph.k.textContent) || '';
    edEl.r.textContent = fmtN(lo) + ' – ' + fmtN(hi);
    edEl.inp.value = cur(row); ed.synced = edEl.inp.value;
    edShow();
    edEl.box.hidden = false;
    edEl.box.style.bottom = '';
    try { edEl.inp.focus({ preventScroll: true }); edEl.inp.select(); } catch (e) {}
    if (edEl.pin) setTimeout(edEl.pin, 300);
  }
  // the typed number, through the editor's own typed field (clamped, one build) - or, with none, the range's own path
  function edCommit() {
    if (!ed) return false;
    const ph = ed.row.__ph, t = String(edEl.inp.value).trim().replace(',', '.');
    if (t === ed.synced || t === String(cur(ed.row))) return false;
    const v = parseFloat(t);
    if (!Number.isFinite(v)) { edShow(); return false; }
    if (ph.vf) { ph.vf.value = String(v); ph.vf.dispatchEvent(new Event('change', { bubbles: true })); }
    else { press(ph.rng); ph.rng.value = String(snap(ph.rng, v)); ph.rng.dispatchEvent(new Event('input', { bubbles: true })); release(ph.rng); }
    place(ed.row);
    edEl.inp.value = cur(ed.row); ed.synced = edEl.inp.value; edShow();   // (the clamped, formatted value)
    return true;
  }
  function edClose(commit) {
    if (!ed) return;
    if (commit) edCommit();
    stepUp();
    ed.row.classList.remove('phOpen');
    ed = null;
    if (edEl.box) { edEl.box.hidden = true; edEl.box.style.bottom = ''; }
    try { if (D.activeElement === edEl.inp) edEl.inp.blur(); } catch (e) {}
  }

  function enhance(row) {
    if (!row || row.__ph || !row.classList || !row.classList.contains('r')) return;
    const rng = row.querySelector(':scope > input[type=range]');
    if (!rng) return;
    const knob = D.createElement('i'); knob.className = 'phKnob'; knob.setAttribute('aria-hidden', 'true');
    row.appendChild(knob);
    const k = row.querySelector(':scope > span.k');
    const vf = row.querySelector(':scope > input.v'), sv = row.querySelector(':scope > span.v');
    const mu = [...row.children].find(c => c.tagName === 'SPAN' && !c.classList.contains('k') && !c.classList.contains('v') && !c.classList.contains('rn') && c !== knob) || null;
    row.__ph = { rng, knob, vf, mu, k };
    row.classList.add('phSlider');
    knob.addEventListener('pointerdown', e => knobDown(row, e));
    knob.addEventListener('pointermove', knobMove);
    knob.addEventListener('pointerup', knobUp);
    knob.addEventListener('pointercancel', knobUp);
    knob.addEventListener('lostpointercapture', knobUp);
    // G3901: the value (and its label) open the editor - the row's own field never raises the keyboard
    if (vf) { vf.readOnly = true; vf.inputMode = 'none'; vf.tabIndex = -1; }
    for (const t of [vf || sv, k]) if (t) t.addEventListener('click', e => { e.preventDefault(); edOpen(row); });
    ROWS.add(row);
    place(row);
  }
  function enhanceIn(host) {
    if (!host) return;
    for (const r of host.querySelectorAll('.r')) enhance(r);
    if (ed && !ed.row.isConnected) edClose(false);   // the row left (another part picked): its editor goes with it
  }

  // ---- THE SPLIT (G3900) -----------------------------------------------------------------------------------------
  const LS_SPLIT = 'flydiy.phSplit', SPLIT0 = 0.5;
  const orient = () => (W.innerWidth > W.innerHeight ? 'l' : 'p');
  const LIM = { p: [0.28, 0.72], l: [0.35, 0.75] };
  let splits = { p: SPLIT0, l: SPLIT0 };
  try { const s = JSON.parse(ls.get(LS_SPLIT) || 'null'); if (s && typeof s === 'object') for (const o of ['p', 'l']) if (Number.isFinite(+s[o])) splits[o] = +s[o]; } catch (e) {}
  const clampSplit = (o, f) => Math.max(LIM[o][0], Math.min(LIM[o][1], f));
  function applySplit() {
    const o = orient();
    D.documentElement.style.setProperty('--ph-split', String(clampSplit(o, splits[o])));
    W.requestAnimationFrame(placeAll);
  }
  function setSplit(f, o) {
    o = o || orient();
    splits[o] = clampSplit(o, f);
    ls.set(LS_SPLIT, JSON.stringify(splits));
    applySplit();
    return splits[o];
  }
  function buildDivider() {
    if ($('phDiv')) return;
    const dv = D.createElement('div'); dv.id = 'phDiv'; dv.setAttribute('role', 'separator'); dv.setAttribute('aria-label', 'move the line between the view and the controls');
    const gh = D.createElement('div'); gh.id = 'phGhost'; gh.hidden = true;
    D.body.appendChild(dv); D.body.appendChild(gh);
    let mv = null, lastTap = 0;
    const at = e => { const o = orient(), size = o === 'l' ? W.innerWidth : W.innerHeight;
      return { o, f: clampSplit(o, (o === 'l' ? e.clientX : e.clientY) / size), size }; };
    dv.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (e.timeStamp - lastTap < 320) { lastTap = 0; setSplit(SPLIT0); return; }   // a double tap: back to half
      lastTap = e.timeStamp;
      try { dv.setPointerCapture(e.pointerId); } catch (x) {}
      mv = { id: e.pointerId, moved: false, x: e.clientX, y: e.clientY };
      dv.classList.add('on');
    });
    dv.addEventListener('pointermove', e => {
      if (!mv || e.pointerId !== mv.id) return;
      if (!mv.moved && Math.hypot(e.clientX - mv.x, e.clientY - mv.y) < 4) return;
      mv.moved = true;
      const a = at(e), px = Math.round(a.f * a.size) + 'px';
      gh.hidden = false;
      if (a.o === 'l') { gh.style.left = px; gh.style.top = '0px'; } else { gh.style.top = px; gh.style.left = '0px'; }
      mv.f = a.f;
    });
    const end = e => {
      if (!mv || (e && e.pointerId !== mv.id)) return;
      const m = mv; mv = null;
      dv.classList.remove('on'); gh.hidden = true;
      if (m.moved && m.f != null) { lastTap = 0; setSplit(m.f); }
    };
    dv.addEventListener('pointerup', end);
    dv.addEventListener('pointercancel', end);
    dv.addEventListener('lostpointercapture', end);
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
      buildDivider();
      watch($('edRows'));
      watch($('edFlyBody'));
      // a value set by anything but a finger (a load, a reset, the typed chip, syncSliders) moves the knob too
      // G3725 (PHONE-GARAGE): the rail's rows open in the MENU's pages (#gmPanel, app.js) and the top bar's card
      // (#edPopCard, editor.js) now - both made later than this, so they are watched once they exist
      setInterval(() => { if (!drag && !D.hidden) { watch($('gmPanel')); watch($('edPopCard')); placeAll(); } }, 400);
      // the split is the orientation's own (a turn of the phone takes the other one)
      W.addEventListener('resize', applySplit);
      W.addEventListener('orientationchange', () => setTimeout(applySplit, 200));
    }
    hookSelection();
    trimRail();
    return true;
  }
  // the split before the first layout: the view is its size from the boot on
  applySplit();
  // the editor opens inside the boot (its 'editor' step); the rail and the tree fill after it
  const poll = setInterval(() => { if (init() && $('edRail') && $('edRail').children.length) { trimRail(); clearInterval(poll); } }, 250);
  W.PHONE_UI = { setTab, tab: () => tab, placeAll, enhance, rows: () => ROWS.size,
    split: () => ({ o: orient(), f: clampSplit(orient(), splits[orient()]) }), setSplit,
    edit: k => { const r = D.querySelector('.r.phSlider[data-k="' + k + '"]'); if (r) edOpen(r); return !!ed; },
    editing: () => (ed ? ed.row.dataset.k || '?' : null), editClose: c => edClose(!!c) };
})();
