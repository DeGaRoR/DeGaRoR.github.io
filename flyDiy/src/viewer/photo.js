// photo.js - THE PHOTO BAR (PHOTO-MODE-2 P1, 2026-11-12; futureDesigns/PHOTO-MODE-2-2026-11-11.md §1, the user's review
// of 11 Nov: "all the options are on the top bar", "the shutter ... a bit like the Android shutter ... no frame around
// it, just a hovering button, half transparent").
//
// ONE bar for the garage and the flight, in the flight interface's own grammar (design_handoff_flight_interface): a
// plate at the LEFT of the top bar - PHOTO, its meta, one slot per question, each opening its flyout UNDER its own slot
// (openFly's rule) - and the verb Done at the RIGHT. Below it nothing but the picture and a round half-transparent
// shutter floating at the bottom centre. The rest of the chrome is off (body.shot, app.js shotSet).
//
// This file is the UI and nothing else. app.js owns what the bar drives (the camera, the pause, the clock, the shed's
// mood, the frame grab) and hands it over in PHOTO.init(api):
//   api.slots()  -> [{ k, label, value() -> 'free · 38°', build(body) }]   the slots for where we are (garage / flight)
//   api.take()                                                            the shutter (app.js photoTake: the next
//                                                                         presented frame, the sound, the download)
//   api.done()                                                            Done (app.js: shotSet(false) -> the bubble)
//   api.meta()   -> 'paused'                                               the plate's right-hand words
// app.js calls PHOTO.begin() / PHOTO.end() from shotSet's photoHook, PHOTO.refresh() when a pick rebuilt the state
// (flPageHook), PHOTO.flash() at the shutter. The flyout's rows are the flight rail's own (FL_BUILD's flRow / flPills /
// flRange): #photoBody is styled as #flFlyBody is (flight.css). GATE UISMOKE presses every button here.
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const W = window, D = document;
  let api = null, on = false, openK = null, el = null;

  const mk = (tag, id, cls) => { const e = D.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; if (tag === 'button') e.type = 'button'; return e; };
  const slots = () => { try { return (api && api.slots && api.slots()) || []; } catch (e) { console.warn('flyDiy (photo): the slots -', e && e.message); return []; } };
  const txt = (f, d) => { try { const v = typeof f === 'function' ? f() : f; return v == null ? d : String(v); } catch (e) { return d; } };

  function build() {
    if (el || !D.body || !D.body.appendChild) return el;
    const top = mk('div', 'photoTop'); top.hidden = true; top.setAttribute('role', 'toolbar'); top.setAttribute('aria-label', 'photo mode');
    const plate = mk('div', 'photoPlate');
    const head = mk('div', 'photoHead'); const hb = mk('b'); hb.textContent = 'Photo'; const hm = mk('span', 'photoMeta'); head.appendChild(hb); head.appendChild(hm);
    const row = mk('div', 'photoSlots');
    plate.appendChild(head); plate.appendChild(row);
    const done = mk('button', 'photoDone', 'phVerb'); done.textContent = 'Done'; done.title = 'Back to the game (Esc)';
    done.onclick = () => { if (api && api.done) api.done(); };
    top.appendChild(plate); top.appendChild(done);
    const fly = mk('div', 'photoFly'); fly.hidden = true; fly.setAttribute('role', 'dialog');
    const flyHead = mk('div', 'photoFlyHead'); const body = mk('div', 'photoBody');
    fly.appendChild(flyHead); fly.appendChild(body);
    const shut = mk('button', 'photoShutter'); shut.hidden = true;
    shut.setAttribute('aria-label', 'Take the picture'); shut.title = 'Take the picture';
    shut.onclick = () => { if (api && api.take) api.take(); };
    const flash = mk('div', 'photoFlash');
    D.body.appendChild(top); D.body.appendChild(fly); D.body.appendChild(shut); D.body.appendChild(flash);
    el = { top, plate, meta: hm, row, done, fly, flyHead, body, shut, flash };
    return el;
  }

  // the slots, as the plate shows them: a label over today's value; the open one marked
  function renderTop() {
    if (!el) return;
    el.meta.textContent = txt(api && api.meta, 'paused');
    const S = slots(), have = new Map();
    for (const b of Array.from(el.row.children)) have.set(b.dataset.k, b);
    const keep = new Set();
    for (const s of S) {
      let b = have.get(s.k);
      if (!b) {
        b = mk('button', null, 'phSlot'); b.dataset.k = s.k;
        b.appendChild(mk('i')); b.appendChild(mk('b'));
        b.onclick = () => openSlot(openK === s.k ? null : s.k);
      }
      b.children[0].textContent = s.label || s.k;
      b.children[1].textContent = txt(s.value, '');
      b.setAttribute('aria-expanded', openK === s.k ? 'true' : 'false');
      b.classList.toggle('open', openK === s.k);
      el.row.appendChild(b);   // (in the table's order)
      keep.add(s.k);
    }
    for (const [k, b] of have) if (!keep.has(k)) b.remove();
    if (openK && !keep.has(openK)) openSlot(null);
  }

  // the flyout under its own slot (openFly's rule: an answer that always appears in the same place does not say which
  // question it answers), clamped to the window
  function place() {
    if (!el || el.fly.hidden || !openK) return;
    const b = Array.from(el.row.children).find(x => x.dataset.k === openK);
    if (!b || !b.getBoundingClientRect || !el.top.getBoundingClientRect) return;
    const r = b.getBoundingClientRect(), t = el.top.getBoundingClientRect();
    const vw = W.innerWidth || 1280, vh = W.innerHeight || 720, w = Math.min(320, vw - 24);
    const top = Math.round(t.bottom + 8);
    el.fly.style.left = Math.round(Math.max(12, Math.min(vw - w - 12, r.left))) + 'px';
    el.fly.style.top = top + 'px';
    el.fly.style.width = w + 'px';
    el.fly.style.maxHeight = Math.max(160, vh - top - 120) + 'px';   // clear of the shutter
  }

  function fill() {
    if (!el || !openK) return;
    const s = slots().find(x => x.k === openK);
    if (!s) { openSlot(null); return; }
    const keep = el.body.scrollTop;
    while (el.body.firstChild) el.body.removeChild(el.body.firstChild);
    el.flyHead.textContent = s.title || s.label || s.k;
    try { if (s.build) s.build(el.body); } catch (e) { console.warn('flyDiy (photo): the ' + s.k + ' rows -', e && e.message); }
    el.body.scrollTop = keep;
  }

  function openSlot(k) {
    if (!el) return;
    openK = k || null;
    el.fly.hidden = !openK;
    if (openK) { el.body.scrollTop = 0; fill(); }
    renderTop(); place();
  }

  function begin() {
    if (!build()) return;
    on = true; openK = null;
    D.body.classList.add('photoOn');
    el.top.hidden = false; el.shut.hidden = false; el.fly.hidden = true;
    renderTop();
  }
  function end() {
    on = false; openK = null;
    if (D.body && D.body.classList) D.body.classList.remove('photoOn');
    if (!el) return;
    el.top.hidden = true; el.shut.hidden = true; el.fly.hidden = true;
  }
  // a pick changed the state: the plate's values and the open flyout's rows again
  function refresh() { if (!on || !el) return; renderTop(); if (openK) { fill(); place(); } }
  function flash() { if (!build()) return; const f = el.flash; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

  // Esc closes the open flyout first (before shotSet's own Esc, which leaves photo mode): one key, one step back
  W.addEventListener('keydown', e => {
    if (on && openK && e.key === 'Escape') { openSlot(null); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  W.addEventListener('resize', () => { if (on) place(); });
  // a click on the picture closes the flyout (the flight interface's rule), never the bar
  D.addEventListener('pointerdown', e => {
    if (!on || !openK || !el) return;
    const t = e.target;
    if (el.fly.contains(t) || el.top.contains(t) || el.shut.contains(t)) return;
    openSlot(null);
  }, true);

  W.PHOTO = {
    init(a) { api = a || null; build(); return W.PHOTO; },
    begin, end, refresh, flash,
    open: k => { if (on) openSlot(k); },
    on: () => on,
    openSlot: () => openK,
    slots: () => slots().map(s => s.k),
  };
})();
