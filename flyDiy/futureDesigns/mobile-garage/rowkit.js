// rowkit.js - MOBILE-GARAGE (G1512) THROWAWAY PROTOTYPE: ONE ROW MODEL, TWO RENDERERS.
// Nothing in the game loads this. It shows that the garage's row tuple ([key, label, lo, hi, step, names?, opts?],
// tools/_cage_ui.js mkRow) plus a few extra fields can be rendered BOTH as today's desktop row (30 px, native range +
// typed value) AND as a finger-sized phone control (56 px: relative scrub, fine mode, steppers, tap-to-type), with the
// same two events the game already keys on: 'tick' (a drag preview: DRAG_TICK) and 'release' (dragSettle / build()).
//
//   ROWKIT.render(host, rows, { mode: 'desk' | 'touch', P, tier: 'basic'|'more'|'expert', onChange(key, v, phase) })
//   ROWKIT.history                  - one entry per gesture (a whole drag = one undo step), undo() / redo()
//
// Row descriptor (the proposed superset of today's tuple; every new field is optional and defaults from the old ones):
//   { key, label, lo, hi, step, names?, unit?, group, tier?: 'basic'|'more'|'expert', fine?, detents?: [{v, label}],
//     help?: 'one line, replaces the title= tooltip', cost?: 'preview'|'whole' }
'use strict';
(function () {
  const ROWKIT = {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const snap = (v, r) => { const s = r.step || 0.01; const d = Math.max(0, -Math.floor(Math.log10(s) + 1e-9));
    return +(Math.round((v - r.lo) / s) * s + r.lo).toFixed(Math.min(6, d + 1)); };
  const fmt = (v, r) => { const s = r.step || 0.01; const d = Math.max(0, Math.min(4, -Math.floor(Math.log10(s) + 1e-9)));
    return (+v).toFixed(d); };

  // the widget is INFERRED from the range, as tools/_cage_ui.js:2148-2175 does today - the revamp keeps that rule
  ROWKIT.infer = r => {
    if (r.names && r.names.length === 2) return 'check';
    if (r.lo === 0 && r.hi === 1 && r.step === 1) return 'check';
    if (r.names && r.names.length >= 3) return 'select';
    if (Number.isInteger(r.step) && (r.hi - r.lo) / r.step <= 8) return 'stepper';
    return 'slider';
  };

  // ---- the undo history: one entry per GESTURE (a drag's ticks fold into the press's entry) ----
  const H = ROWKIT.history = { past: [], future: [], open: null, listeners: [],
    begin(key, from) { this.open = { key, from, to: from }; },
    move(to) { if (this.open) this.open.to = to; },
    end() { const o = this.open; this.open = null; if (o && o.to !== o.from) { this.past.push(o); this.future.length = 0; this.emit(); } },
    one(key, from, to) { if (from === to) return; this.past.push({ key, from, to }); this.future.length = 0; this.emit(); },
    undo() { const e = this.past.pop(); if (!e) return null; this.future.push(e); this.emit(); return { key: e.key, v: e.from }; },
    redo() { const e = this.future.pop(); if (!e) return null; this.past.push(e); this.emit(); return { key: e.key, v: e.to }; },
    emit() { for (const f of this.listeners) f(this); } };

  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ---- DESKTOP: today's row (label 113 px, native range, typed value 64 px) ----
  function deskRow(r, P, emit) {
    const kind = ROWKIT.infer(r), row = el('div', 'rk-d rk-d-' + kind); row.dataset.k = r.key;
    const lab = el('label', 'rk-d-lab', r.label); lab.title = r.help || r.label; row.appendChild(lab);
    if (kind === 'check') { const c = el('input'); c.type = 'checkbox'; c.checked = !!P[r.key];
      c.onchange = () => { H.one(r.key, P[r.key], +c.checked); emit(r.key, +c.checked, 'release'); }; row.appendChild(c); return row; }
    if (kind === 'select') { const s = el('select'); r.names.forEach((n, i) => { const o = el('option', null, n); o.value = i; s.appendChild(o); });
      s.value = P[r.key]; s.onchange = () => { H.one(r.key, P[r.key], +s.value); emit(r.key, +s.value, 'release'); }; row.appendChild(s); return row; }
    const g = el('input', 'rk-d-rng'); g.type = 'range'; g.min = r.lo; g.max = r.hi; g.step = r.step; g.value = P[r.key];
    const t = el('input', 'rk-d-val'); t.value = fmt(P[r.key], r); t.inputMode = 'decimal';
    g.onpointerdown = () => H.begin(r.key, P[r.key]);
    g.oninput = () => { t.value = fmt(+g.value, r); H.move(+g.value); emit(r.key, +g.value, 'tick'); };
    g.onchange = () => { H.end(); emit(r.key, +g.value, 'release'); };
    t.onchange = () => { const v = snap(clamp(+t.value || 0, r.lo, r.hi), r); H.one(r.key, P[r.key], v); g.value = v; t.value = fmt(v, r); emit(r.key, v, 'release'); };
    row.append(g, t); return row;
  }

  // ---- TOUCH: the phone control ----
  // Rules (MOBILE-GARAGE-2026-10-04.md §2): a 56 px row, a 48 px hit band; a tap on the track does NOT jump the value
  // (a scroll that lands on a row must never edit); the drag is RELATIVE (it starts where the value is, the finger can
  // land anywhere on the band); a vertical start scrolls the list instead (touch-action: pan-y); press-and-hold 350 ms
  // before moving = FINE (x0.1); a live bubble above the finger (the finger hides the thumb); - / + steppers with repeat;
  // a tap on the value opens the decimal keypad; named detents (the archetype's value, the loaded design's) pull 2 %.
  function touchRow(r, P, emit) {
    const kind = ROWKIT.infer(r), row = el('div', 'rk-t rk-t-' + kind); row.dataset.k = r.key;
    const head = el('div', 'rk-t-head'), lab = el('div', 'rk-t-lab', r.label);
    head.appendChild(lab);
    if (r.help) { const i = el('button', 'rk-t-help', 'i'); i.setAttribute('aria-label', 'about ' + r.label);
      i.onclick = () => row.classList.toggle('rk-open'); head.appendChild(i); }
    row.appendChild(head);
    if (r.help) row.appendChild(el('div', 'rk-t-note', r.help));
    if (kind === 'check') { const b = el('button', 'rk-t-toggle' + (P[r.key] ? ' on' : ''), P[r.key] ? 'fitted' : 'off');
      b.onclick = () => { const v = P[r.key] ? 0 : 1; H.one(r.key, P[r.key], v); emit(r.key, v, 'release');
        b.classList.toggle('on', !!v); b.textContent = v ? 'fitted' : 'off'; };
      head.appendChild(b); return row; }
    if (kind === 'select' || kind === 'stepper') {
      const seg = el('div', 'rk-t-seg'); const n = kind === 'select' ? r.names.length : Math.round((r.hi - r.lo) / r.step) + 1;
      for (let i = 0; i < n; i++) { const v = kind === 'select' ? i : r.lo + i * r.step;
        const b = el('button', 'rk-t-chip' + (+P[r.key] === v ? ' on' : ''), kind === 'select' ? r.names[i] : String(v));
        b.onclick = () => { H.one(r.key, P[r.key], v); emit(r.key, v, 'release'); [...seg.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); };
        seg.appendChild(b); }
      row.appendChild(seg); return row; }
    const val = el('button', 'rk-t-val'); const unit = r.unit ? ' ' + r.unit : '';
    const paint = v => { val.textContent = fmt(v, r) + unit; fill.style.width = (100 * (v - r.lo) / (r.hi - r.lo)) + '%';
      knob.style.left = (100 * (v - r.lo) / (r.hi - r.lo)) + '%'; };
    head.appendChild(val);
    const line = el('div', 'rk-t-line');
    const minus = el('button', 'rk-t-step', '−'), plus = el('button', 'rk-t-step', '+');
    const band = el('div', 'rk-t-band'), track = el('div', 'rk-t-track'), fill = el('div', 'rk-t-fill'), knob = el('div', 'rk-t-knob');
    const bubble = el('div', 'rk-t-bubble'), badge = el('div', 'rk-t-fine', 'fine ×0.1');
    track.append(fill); band.append(track, knob, bubble, badge);
    for (const d of r.detents || []) { const m = el('div', 'rk-t-det'); m.style.left = (100 * (d.v - r.lo) / (r.hi - r.lo)) + '%'; m.title = d.label; band.appendChild(m); }
    line.append(minus, band, plus); row.appendChild(line);
    paint(P[r.key]);
    // steppers: one step a tap, repeat while held (400 ms, then every 80 ms) - ONE undo entry, ONE release
    const stepper = dir => { let tm = 0, from;
      return { down(e) { e.preventDefault(); from = P[r.key]; H.begin(r.key, from);
          const go = () => { const v = snap(clamp(P[r.key] + dir * r.step, r.lo, r.hi), r); H.move(v); emit(r.key, v, 'tick'); paint(v); };
          go(); tm = setTimeout(function rep() { go(); tm = setTimeout(rep, 80); }, 400); },
        up() { clearTimeout(tm); if (H.open) { const v = P[r.key]; H.end(); emit(r.key, v, 'release'); } } }; };
    for (const [b, d] of [[minus, -1], [plus, 1]]) { const s = stepper(d); b.onpointerdown = s.down; b.onpointerup = b.onpointerleave = b.onpointercancel = s.up; }
    // the relative scrub
    let g = null;
    band.addEventListener('pointerdown', e => {
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v0: P[r.key], w: track.getBoundingClientRect().width, mode: 'wait', fine: false, t0: performance.now() };
      g.hold = setTimeout(() => { if (g && g.mode === 'wait') { g.fine = true; band.classList.add('rk-fine'); } }, 350);
    });
    band.addEventListener('pointermove', e => {
      if (!g || e.pointerId !== g.id) return; const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (g.mode === 'wait') {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(g.hold); g = null; band.classList.remove('rk-fine'); return; }  // a scroll: let it go
        if (Math.abs(dx) < 8) return;
        g.mode = 'drag'; clearTimeout(g.hold); band.setPointerCapture(e.pointerId); band.classList.add('rk-drag'); H.begin(r.key, g.v0); g.x0 = e.clientX;
      }
      const gain = g.fine ? 0.1 : 1; let v = g.v0 + (e.clientX - g.x0) / g.w * (r.hi - r.lo) * gain;
      for (const d of r.detents || []) if (Math.abs(v - d.v) < 0.02 * (r.hi - r.lo) && !g.fine) v = d.v;   // a detent pulls
      v = snap(clamp(v, r.lo, r.hi), r);
      if (v !== P[r.key]) { H.move(v); emit(r.key, v, 'tick'); paint(v); }
      bubble.textContent = fmt(v, r) + unit;
    });
    const up = e => { if (!g || e.pointerId !== g.id) return; clearTimeout(g.hold);
      if (g.mode === 'drag') { H.end(); emit(r.key, P[r.key], 'release'); }
      band.classList.remove('rk-drag', 'rk-fine'); g = null; };
    band.addEventListener('pointerup', up); band.addEventListener('pointercancel', up);
    // tap the value: the decimal keypad, in place
    val.onclick = () => { const t = el('input', 'rk-t-type'); t.inputMode = 'decimal'; t.value = fmt(P[r.key], r);
      head.replaceChild(t, val); t.focus(); t.select();
      const done = ok => { if (ok) { const v = snap(clamp(+t.value || 0, r.lo, r.hi), r); H.one(r.key, P[r.key], v); emit(r.key, v, 'release'); paint(v); }
        if (t.parentNode) head.replaceChild(val, t); };
      t.onkeydown = e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); }; t.onblur = () => done(true); };
    row.repaint = () => paint(P[r.key]);
    return row;
  }

  ROWKIT.render = (host, rows, o) => {
    const P = o.P, tierOk = r => { const t = r.tier || 'basic'; return o.tier === 'expert' || t === 'basic' || (o.tier === 'more' && t === 'more'); };
    const emit = (k, v, phase) => { P[k] = v; if (o.onChange) o.onChange(k, v, phase); };
    host.innerHTML = ''; let grp = null, box = null, hidden = 0;
    for (const r of rows) {
      if (!tierOk(r)) { hidden++; continue; }
      if (r.group !== grp) { grp = r.group; box = el('section', 'rk-g'); box.appendChild(el('h4', 'rk-g-h', grp)); host.appendChild(box); }
      box.appendChild(o.mode === 'touch' ? touchRow(r, P, emit) : deskRow(r, P, emit));
    }
    if (hidden && o.more !== false) { const m = el('button', 'rk-more', hidden + ' more rows · show'); m.onclick = () => o.onMore && o.onMore(); host.appendChild(m); }
    return host;
  };
  ROWKIT.fmt = fmt;
  window.ROWKIT = ROWKIT;
})();
