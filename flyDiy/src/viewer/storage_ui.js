// storage_ui.js - G2690 HANGAR-STORAGE: WHERE YOUR AEROPLANES ARE KEPT (futureDesigns/game/HANGAR-STORAGE-2026-10-10.md,
// the user's OK of 10 Oct with one correction: NO in-world click - clicking a plane in the world does nothing; rolling
// out and flying a stored plane happens ONLY here, in the garage).
//
// The garage's own look (editor.css: the --ed-* tokens declared once on its roots, #hsStore among them; IBM Plex Sans
// upright; the fleet popup's scrim, box, pills and cards). The garage of `here` (the building the garage is open in):
//   THE FLOOR      the stand - drop a card here = "Work on" (the slot loaded onto the stand; the aeroplane there before
//                  takes the newcomer's place: a swap)
//   INSIDE n/N     the building's inside slots (the residents beside the stand), numbered
//   OUTSIDE m/M    the aerodrome's apron slots (the fleet's tie-down spots), numbered
//   LONG-TERM      kept, never drawn, unlimited; no Fly (load it first)
// Drag and drop between the columns (onto a numbered slot, or anywhere in a column: its first free one); a phone - and
// any pointer - taps a card, then a column or a slot. Every move is the core's ONE move (71_player_bases.js playerMove,
// through app.js window.FLYDIY_STORE.move): free and instant in sandbox and career; a refusal says why, here.
// FLY: each shown card (floor / inside / outside) - a small confirmation in the garage's look, then the existing roll-out
// (FLYDIY_STORE.fly: inside -> lined up on the runway by the wind, outside -> the apron's stand, the floor -> today's).
// Nothing here touches the world, its input path or a bake: the drawn residents / apron props follow the document.
(function () {
  'use strict';
  const W = window;
  const ST = { el: null, sel: null, msg: '', confirm: null, drag: null, renders: 0 };
  const API = () => W.FLYDIY_STORE || null;
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const WORDS = {
    floor: 'on the floor', inside: 'inside', outside: 'outside', long: 'long-term',
    start: { door: 'rolls out of the hangar door, then taxis out', lineup: 'starts lined up on the runway, into the wind',
             stand: 'starts on the apron stand, then taxis out' },
  };
  const CSS = `
#hsStore { position:fixed; inset:0; z-index:61; background:rgba(12,11,10,.78); display:flex; align-items:center;
  justify-content:center; font:400 12px/1.35 'IBM Plex Sans'; font-style:normal; color:var(--ed-ink); }
#hsStore[hidden] { display:none; }
#hsStore * { font-style:normal; box-sizing:border-box; }
#hsStore .hsBox { width:min(980px, 96vw); max-height:88vh; overflow:auto; background:var(--ed-panel);
  border:1px solid var(--ed-hair); border-radius:10px; padding:18px 20px 16px; position:relative; }
#hsStore .hsH { display:flex; align-items:center; justify-content:space-between; gap:10px; }
#hsStore .hsH > span { font:500 13px/1 'IBM Plex Sans'; letter-spacing:.14em; color:var(--ed-ink); }
#hsStore .hsSub { font:400 11px/1.4 'IBM Plex Sans'; color:var(--ed-dim); margin:6px 0 10px; }
#hsStore .hsMsg { font:500 11px/1.4 'IBM Plex Sans'; color:var(--ed-warn); min-height:16px; margin:0 0 8px; }
#hsStore .hsMsg.ok { color:var(--ed-acc); }
#hsStore .hsFloor { border:1px dashed var(--ed-border); border-radius:8px; padding:8px 10px; margin-bottom:12px;
  background:var(--ed-board); display:flex; align-items:center; gap:12px; min-height:64px; }
#hsStore .hsFloor .hsColH { margin:0; border:0; padding:0; flex:0 0 auto; }
#hsStore .hsCols { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
#hsStore .hsCol { background:var(--ed-board); border:1px solid var(--ed-hair); border-radius:8px; padding:8px;
  display:flex; flex-direction:column; gap:6px; min-height:120px; }
#hsStore .hsColH { font:500 10px/1 'IBM Plex Sans'; letter-spacing:.12em; text-transform:uppercase; color:var(--ed-dim);
  padding-bottom:6px; border-bottom:1px solid var(--ed-hair); margin-bottom:2px; display:flex; justify-content:space-between; }
#hsStore .hsColH b { font-weight:600; color:var(--ed-ink); letter-spacing:.06em; }
#hsStore .hsSlot { border:1px dashed var(--ed-hair); border-radius:8px; min-height:58px; display:flex; align-items:stretch; }
#hsStore .hsSlot.empty { align-items:center; justify-content:center; color:var(--ed-faint); font:400 10.5px/1 'IBM Plex Sans'; }
#hsStore .hsDrop { outline:2px solid var(--ed-acc); outline-offset:-2px; background:var(--ed-acc-soft); }
#hsStore .hsTarget .hsSlot.empty, #hsStore .hsTarget.hsFloor { border-color:var(--ed-acc); cursor:pointer; }
#hsStore .hsTarget .hsColH { color:var(--ed-acc); cursor:pointer; }
#hsStore .hsCard { flex:1; min-width:0; display:flex; align-items:center; gap:9px; padding:6px 8px; background:var(--ed-btn-bg);
  border:1px solid var(--ed-btn-bd); border-radius:8px; cursor:grab; user-select:none; touch-action:manipulation; }
#hsStore .hsCard.sel { border-color:var(--ed-acc); background:var(--ed-acc-soft); }
#hsStore .hsCard.stand { border-color:var(--ed-acc); }
#hsStore .hsThumb { flex:0 0 auto; width:56px; height:38px; border-radius:5px; background:var(--ed-track);
  border:1px solid var(--ed-hair); display:block; object-fit:cover; }
#hsStore .hsTxt { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
#hsStore .hsName { font:600 12px/1.2 'IBM Plex Sans'; color:var(--ed-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#hsStore .hsMeta { font:400 10.5px/1.3 'IBM Plex Sans'; color:var(--ed-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#hsStore .hsTag { font:500 9.5px/1.3 'IBM Plex Sans'; letter-spacing:.04em; color:var(--ed-acc); border:1px solid var(--ed-acc);
  border-radius:6px; padding:0 5px; margin-left:4px; }
#hsStore .hsBtns { display:flex; gap:4px; flex:0 0 auto; }
#hsStore .dfPill, #hsStore .hsPill { font:500 10px/1 'IBM Plex Sans'; letter-spacing:.08em; color:var(--ed-ink);
  background:var(--ed-btn-bg); border:1px solid var(--ed-btn-bd); border-radius:999px; padding:6px 10px; cursor:pointer; }
#hsStore .hsPill:hover, #hsStore .dfPill:hover { border-color:rgba(255,255,255,.3); }
#hsStore .hsPill.go { background:var(--ed-acc); color:var(--ed-acc-ink); border-color:var(--ed-acc); }
#hsStore .hsPill[disabled] { opacity:.4; cursor:default; }
#hsStore .hsLong { display:flex; flex-direction:column; gap:6px; }
#hsStore .hsEmpty { color:var(--ed-faint); font:400 10.5px/1.4 'IBM Plex Sans'; padding:6px 2px; }
#hsStore .hsAsk { position:absolute; inset:0; background:rgba(12,11,10,.72); display:flex; align-items:center; justify-content:center; border-radius:10px; }
#hsStore .hsAsk[hidden] { display:none; }
#hsStore .hsAskBox { width:min(380px, 90%); background:var(--ed-panel); border:1px solid var(--ed-border); border-radius:10px; padding:16px; }
#hsStore .hsAskBox p { margin:0 0 6px; font:400 12px/1.45 'IBM Plex Sans'; color:var(--ed-dim); }
#hsStore .hsAskBox p b { color:var(--ed-ink); font-weight:600; }
#hsStore .hsAskBtns { display:flex; justify-content:flex-end; gap:6px; margin-top:12px; }
@media (max-width: 760px), (pointer: coarse) {
  #hsStore .hsBox { width:100vw; max-height:100vh; height:100%; border-radius:0; padding:14px 12px; }
  #hsStore .hsCols { grid-template-columns:1fr; }
  #hsStore .hsSlot { min-height:56px; }
  #hsStore .hsCard { min-height:52px; }
  #hsStore .hsPill, #hsStore .dfPill { min-height:48px; min-width:48px; padding:0 14px; }
  #hsStore .hsColH { min-height:48px; align-items:center; }
}`;
  function style() {
    if (document.getElementById('hsStoreCss')) return;
    const s = mk('style'); s.id = 'hsStoreCss'; s.textContent = CSS; document.head.appendChild(s);
  }
  // the card's picture: the fleet bake's thumbnail when one exists (none yet: PARKED.fleetThumb is the door), else a
  // plan-view glyph drawn by gear (a float pair, skis, a wheel track)
  function thumb(c) {
    if (c.thumb && (c.thumb.tagName === 'IMG' || c.thumb.tagName === 'CANVAS')) { c.thumb.className = 'hsThumb'; return c.thumb; }
    if (typeof c.thumb === 'string') { const im = mk('img', 'hsThumb'); im.alt = ''; im.src = c.thumb; return im; }
    const cv = mk('canvas', 'hsThumb'); cv.width = 112; cv.height = 76;
    try {
      const g = cv.getContext('2d');
      if (g) {
        const st = getComputedStyle(ST.el || document.body), ink = (st.getPropertyValue('--ed-dim') || '#c0b8ac').trim();
        g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(12, 30); g.lineTo(100, 30); g.stroke();            // the wing
        g.beginPath(); g.moveTo(56, 14); g.lineTo(56, 66); g.stroke();             // the fuselage
        g.beginPath(); g.moveTo(42, 64); g.lineTo(70, 64); g.stroke();             // the tail
        if (c.gear === 'floats' || c.gear === 'amphibian') { g.lineWidth = 3; g.strokeRect(36, 18, 8, 34); g.strokeRect(68, 18, 8, 34); }
        else if (c.gear === 'skis') { g.lineWidth = 3; g.beginPath(); g.moveTo(40, 22); g.lineTo(40, 44); g.moveTo(72, 22); g.lineTo(72, 44); g.stroke(); }
        else { g.beginPath(); g.arc(42, 34, 4, 0, 7); g.arc(70, 34, 4, 0, 7); g.fill(); }
      }
    } catch (e) {}
    return cv;
  }
  function card(name, kind) {
    const A = API(); if (!A) return mk('div');
    const c = A.card(name) || { name, gear: 'wheels', seats: 0 };
    const el = mk('div', 'hsCard' + (ST.sel === name ? ' sel' : '') + (c.onStand ? ' stand' : ''));
    el.dataset.name = name; el.dataset.kind = kind;
    el.setAttribute('draggable', 'true');
    el.setAttribute('role', 'button'); el.tabIndex = 0;
    el.title = name + ' - drag it to another column (or onto the floor to work on it); or tap it, then a column';
    el.appendChild(thumb(c));
    const t = mk('div', 'hsTxt');
    const nm = mk('div', 'hsName', name);
    if (c.onStand) nm.appendChild(mk('span', 'hsTag', 'on the stand'));
    t.appendChild(nm);
    const bits = [c.gear || 'wheels', (c.seats || 0) + (c.seats === 1 ? ' seat' : ' seats')];
    if (c.wear >= 0.05) bits.push('weathered ' + Math.round(c.wear * 100) + ' %');
    t.appendChild(mk('div', 'hsMeta', bits.join(' · ')));
    el.appendChild(t);
    const b = mk('div', 'hsBtns');
    if (kind !== 'floor') {
      const wo = mk('button', 'hsPill hsWork', 'work on'); wo.type = 'button';
      wo.title = 'Onto the stand (the floor): the aeroplane there takes its place';
      wo.addEventListener('click', ev => { ev.stopPropagation(); move(name, { kind: 'floor' }); });
      b.appendChild(wo);
    }
    if (kind !== 'long') {
      const fl = mk('button', 'hsPill go hsFly', 'fly'); fl.type = 'button';
      const can = A.canFly ? A.canFly() : true;
      fl.disabled = !can;
      fl.title = can ? 'Fly it from where it stands' : 'the garage on its own has no world to fly in';
      fl.addEventListener('click', ev => { ev.stopPropagation(); ask(name); });
      b.appendChild(fl);
    }
    el.appendChild(b);
    el.addEventListener('click', () => { ST.sel = ST.sel === name ? null : name; ST.msg = ST.sel ? 'now tap a column or a slot for ' + name : ''; render(); });
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); } });
    el.addEventListener('dragstart', ev => {
      ST.drag = name;
      try { ev.dataTransfer.setData('text/plain', name); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
    });
    el.addEventListener('dragend', () => { ST.drag = null; clearDrop(); });
    return el;
  }
  function clearDrop() { if (ST.el) for (const d of ST.el.querySelectorAll('.hsDrop')) d.classList.remove('hsDrop'); }
  // a drop target: { kind, slot? } - drag over / drop, and the tap after a selection
  function target(el, to) {
    el.dataset.to = JSON.stringify(to);
    el.addEventListener('dragover', ev => { ev.preventDefault(); try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {} clearDrop(); el.classList.add('hsDrop'); });
    el.addEventListener('dragleave', () => el.classList.remove('hsDrop'));
    el.addEventListener('drop', ev => {
      ev.preventDefault(); ev.stopPropagation(); clearDrop();
      let n = ST.drag; try { n = ev.dataTransfer.getData('text/plain') || n; } catch (e) {}
      ST.drag = null;
      if (n) move(n, to);
    });
    el.addEventListener('click', ev => {
      if (!ST.sel) return;
      if (ev.target.closest && ev.target.closest('.hsCard') && ev.target.closest('.hsCard').dataset.name === ST.sel) return;
      ev.stopPropagation();
      const n = ST.sel; ST.sel = null;
      move(n, to);
    });
  }
  function move(name, to) {
    const A = API(); if (!A) return null;
    // "Work on" over an unsaved build on the stand replaces it: asked first (garage.js's own honesty)
    if (to.kind === 'floor' && A.onStand && !A.onStand() && typeof confirm === 'function' && W.GARAGE_SPEC && W.GARAGE_SPEC.name && !W.GARAGE_SPEC.name()
        && !confirm('The build on the stand has not been saved, and loading “' + name + '” replaces it. Work on it anyway?')) return null;
    const r = A.move(name, to);
    ST.sel = null;
    if (!r || !r.ok) ST.msg = (r && r.why) || 'that move was refused';
    else if (r.why === 'already there') ST.msg = name + ' is there already';
    else {
      const where = r.where ? WORDS[r.where.kind] + (r.where.slot != null ? ' ' + (r.where.slot + 1) : '') : to.kind;
      ST.msg = '✓ ' + name + ' ' + where + (r.swapped ? ' · ' + r.swapped.name + ' ' + WORDS[r.swapped.where.kind] + (r.swapped.where.slot != null ? ' ' + (r.swapped.where.slot + 1) : '') : '');
    }
    ST.last = { name, to, r };
    render();
    return r;
  }
  // THE FLY CONFIRMATION (the garage's look): where it starts, said plainly; Fly rolls it out through the garage's own path
  function ask(name) {
    const A = API(); if (!A) return;
    const S = A.flyStart ? A.flyStart(name) : null;
    if (!S || !S.ok) { ST.msg = (S && S.why) || 'it cannot fly from there'; render(); return; }
    ST.confirm = { name, start: S.start, kind: S.kind };
    render();
  }
  function fly() {
    const A = API(), c = ST.confirm; if (!A || !c) return;
    ST.confirm = null;
    const r = A.fly(c.name);
    if (!r || !r.ok) { ST.msg = (r && r.why) || 'it could not roll out'; render(); return; }
    close();
  }
  function render() {
    const A = API(), el = ST.el;
    if (!el || el.hidden) return;
    ST.renders++;
    const box = el.querySelector('.hsBox');
    box.innerHTML = '';
    const V = A && A.view ? A.view() : null;
    const head = mk('div', 'hsH');
    head.appendChild(mk('span', null, 'STORAGE' + (V ? ' · ' + V.hangar + (V.aero !== V.hangar ? ' at ' + V.aero : '') : '')));
    const x = mk('button', 'dfPill hsClose', 'close'); x.type = 'button'; x.addEventListener('click', close);
    head.appendChild(x);
    box.appendChild(head);
    box.appendChild(mk('div', 'hsSub', 'Drag a card to another column, or onto the floor to work on it · on a phone: tap a card, then a column. Free and instant.'));
    const msg = mk('div', 'hsMsg' + (/^✓/.test(ST.msg) ? ' ok' : ''), ST.msg || '');
    msg.setAttribute('role', 'status');
    box.appendChild(msg);
    if (!V) { box.appendChild(mk('div', 'hsEmpty', 'no hangar here')); return; }
    const tgt = ST.sel ? ' hsTarget' : '';
    // THE FLOOR
    const fl = mk('div', 'hsFloor' + tgt);
    const fh = mk('div', 'hsColH'); fh.appendChild(mk('span', null, 'the floor · the stand')); fl.appendChild(fh);
    if (V.floor) { const s = mk('div', 'hsSlot'); s.appendChild(card(V.floor, 'floor')); s.style.flex = '1'; fl.appendChild(s); }
    else fl.appendChild(mk('div', 'hsEmpty', 'drop a card here to work on it'));
    target(fl, { kind: 'floor' });
    box.appendChild(fl);
    const cols = mk('div', 'hsCols');
    const col = (key, title, n, N, slots, kind) => {
      const c = mk('div', 'hsCol' + tgt); c.dataset.col = key;
      const h = mk('div', 'hsColH'); h.appendChild(mk('span', null, title)); if (N != null) h.appendChild(mk('b', null, n + '/' + N)); else h.appendChild(mk('b', null, String(n)));
      c.appendChild(h);
      target(c, { kind });
      if (slots) {
        if (!slots.length) c.appendChild(mk('div', 'hsEmpty', kind === 'inside' ? 'this building has no inside slot' : 'no tie-down spot here'));
        slots.forEach((nm, i) => {
          const s = mk('div', 'hsSlot' + (nm ? '' : ' empty')); s.dataset.slot = String(i);
          if (nm) s.appendChild(card(nm, kind)); else s.textContent = (kind === 'inside' ? 'inside ' : 'apron ') + (i + 1);
          target(s, { kind, slot: i });
          c.appendChild(s);
        });
      }
      return c;
    };
    const nIn = V.inside.slots.filter(Boolean).length, nOut = V.outside.slots.filter(Boolean).length;
    cols.appendChild(col('inside', 'inside', nIn, V.inside.N, V.inside.slots, 'inside'));
    cols.appendChild(col('outside', 'outside', nOut, V.outside.M, V.outside.slots, 'outside'));
    const lc = col('long', 'long-term', V.long.length, null, null, 'long');
    const ll = mk('div', 'hsLong');
    if (!V.long.length) ll.appendChild(mk('div', 'hsEmpty', 'nothing kept long-term · kept here, never drawn'));
    for (const nm of V.long) { const s = mk('div', 'hsSlot'); s.appendChild(card(nm, 'long')); ll.appendChild(s); }
    lc.appendChild(ll);
    cols.appendChild(lc);
    box.appendChild(cols);
    if (V.others && V.others.length) box.appendChild(mk('div', 'hsSub', 'in another building here: ' + V.others.join(', ')));
    // the confirmation
    const ak = mk('div', 'hsAsk'); ak.hidden = !ST.confirm;
    if (ST.confirm) {
      const c = ST.confirm, b = mk('div', 'hsAskBox');
      const p1 = mk('p'); p1.appendChild(document.createTextNode('Fly ')); p1.appendChild(mk('b', null, c.name)); p1.appendChild(document.createTextNode(' from ' + WORDS[c.kind] + '?'));
      b.appendChild(p1);
      b.appendChild(mk('p', null, 'It ' + (WORDS.start[c.start] || 'rolls out') + '.'));
      const bt = mk('div', 'hsAskBtns');
      const no = mk('button', 'hsPill hsNo', 'cancel'); no.type = 'button'; no.addEventListener('click', () => { ST.confirm = null; render(); });
      const go = mk('button', 'hsPill go hsGo', 'fly'); go.type = 'button'; go.addEventListener('click', fly);
      bt.appendChild(no); bt.appendChild(go); b.appendChild(bt); ak.appendChild(b);
    }
    box.appendChild(ak);
  }
  function build() {
    if (ST.el) return ST.el;
    style();
    const el = ST.el = mk('div'); el.id = 'hsStore'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'storage');
    el.appendChild(mk('div', 'hsBox'));
    el.addEventListener('click', ev => { if (ev.target === el) close(); });
    el.addEventListener('keydown', ev => { if (ev.key === 'Escape') { if (ST.confirm) { ST.confirm = null; render(); } else close(); } });
    document.body.appendChild(el);
    return el;
  }
  function open() {
    build(); ST.el.hidden = false; ST.sel = null; ST.msg = ''; ST.confirm = null; render();
    try { const sh = document.getElementById('edShelf'); if (sh) sh.hidden = true; } catch (e) {}
    return ST.el;
  }
  function close() { if (ST.el) ST.el.hidden = true; ST.sel = null; ST.confirm = null; }
  function wire() {
    const b = document.getElementById('gStore');
    if (b && !b.dataset.hsWired) { b.dataset.hsWired = '1'; b.addEventListener('click', open); }
    if (W.FLYDIY_STORE) W.FLYDIY_STORE.onChange = () => render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  // app.js may publish FLYDIY_STORE after this file ran: the redraw hook is set again on open
  const open0 = open;
  W.STORAGE_UI = { open: () => { wire(); return open0(); }, close, render, move, ask, fly, state: ST };
})();
