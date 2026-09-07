// ---------------------------------------------------------------------------
// THE CONTROLS PANEL (G200) — one mapping interface, opened from both screens
// ---------------------------------------------------------------------------
// The user's ruling: "a proper interface, triggered from both environments
// (the shed and the flight) for accurate mapping ... against different
// controllers; the keyboard, the joystick and the throttle (and later
// TrackIR, so really N devices)".
//
// WHY A THIRD HOST. The flight layer (#ui) and the workshop layer (#wsUI)
// each hide the other by a body-class rule (editor.css), so a panel inside
// either would exist on one screen only. #ctlPanel is a sibling of both in
// body.html, styled by its own sheet (controls.css) with its own copy of the
// palette, and this file builds its contents lazily on the first open. Each
// rail carries a `controls` entry that presses INPUT_PANEL.open(); neither
// screen holds any of its state — the model (input.js) does.
//
// WHAT IT SHOWS. The devices the browser can see (a gamepad appears only
// after a button is pressed on it, and the list says so), one row per
// action with a chip per device bound to it, a LISTEN flow (press a chip,
// then press the key / move the axis / press the button — the model infers
// sign and span from what you did), the tuning under an axis chip (invert,
// deadzone, expo, sensitivity, span), a live bar per action and a tiny meter per gamepad
// axis so a stick can be identified by wiggling it, and the profile as a
// document: defaults, export, import.
(() => {
  let inp = null, host = null, built = false, rafOn = false, opts = {};
  let tuneFor = null;             // { id, dev } whose tuning row is open
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const ACT_PROMPT = {
    pitch: 'pull the stick BACK (nose up)', roll: 'move the stick RIGHT',
    yaw: 'push the RIGHT pedal', throttle: 'push the lever to FULL',
    brake: 'press the button, or press the toe brake',
  };
  const promptFor = (a, want, slot) => {
    if (want === 'key') {
      const s = { pos: 'the key for ' + (a.id === 'pitch' ? 'nose UP' : a.id === 'roll' ? 'roll RIGHT' : a.id === 'yaw' ? 'nose RIGHT' : 'MORE'),
                  neg: 'the key for ' + (a.id === 'pitch' ? 'nose DOWN' : a.id === 'roll' ? 'roll LEFT' : a.id === 'yaw' ? 'nose LEFT' : 'LESS'),
                  max: 'the key for FULL', min: 'the key for IDLE' };
      return 'press ' + (a.kind === 'axis' ? (s[slot || 'pos']) : 'a key') + ' — Esc cancels';
    }
    if (a.kind === 'axis') return (ACT_PROMPT[a.id] || 'move the axis the positive way') + ' — Esc cancels';
    return 'press a button, or push the hat — Esc cancels';
  };

  // ---- build --------------------------------------------------------------
  function build() {
    host = $('ctlPanel');
    if (!host || built) return;
    built = true;
    const head = el('header', null); head.id = 'ctlHead';
    head.appendChild(el('h2', null, 'Controls'));
    const who = el('span', 'who'); who.id = 'ctlWho'; head.appendChild(who);
    const x = el('button', 'x', '×'); x.id = 'ctlClose'; x.type = 'button'; x.title = 'Close (Esc)';
    x.onclick = close; head.appendChild(x);
    host.appendChild(head);
    const devs = el('div', null); devs.id = 'ctlDevs'; host.appendChild(devs);
    const body = el('div', null); body.id = 'ctlBody'; host.appendChild(body);
    const foot = el('footer', null); foot.id = 'ctlFoot';
    const b1 = el('button', 'act', 'defaults'); b1.type = 'button';
    b1.onclick = () => { if (inp) { inp.resetDefaults(); tuneFor = null; renderRows(); } };
    const b2 = el('button', 'act', 'export'); b2.type = 'button';
    const b3 = el('button', 'act', 'import'); b3.type = 'button';
    const ta = el('textarea', null); ta.id = 'ctlJSON'; ta.hidden = true; ta.spellcheck = false;
    ta.placeholder = 'the profile, as a document — paste one here and press import';
    b2.onclick = () => { ta.hidden = false; ta.value = inp ? inp.exportJSON() : ''; ta.focus(); ta.select(); };
    b3.onclick = () => {
      if (ta.hidden) { ta.hidden = false; ta.value = ''; ta.focus(); return; }
      if (inp && inp.importJSON(ta.value)) { ta.hidden = true; tuneFor = null; renderRows(); note('profile imported'); }
      else note('that is not a profile');
    };
    const n = el('span', 'note'); n.id = 'ctlNote';
    foot.appendChild(b1); foot.appendChild(b2); foot.appendChild(b3); foot.appendChild(n);
    host.appendChild(foot);
    host.appendChild(ta);
    // Esc: cancel a listen first, else close — in the CAPTURE phase so the
    // flyouts' own Esc handlers do not also fire under this panel
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || host.hidden) return;
      if (inp && inp.listening()) inp.cancelListen();
      else close();
      e.stopImmediatePropagation(); e.preventDefault();
    }, true);
    if (typeof window !== 'undefined' && window.addEventListener)
      window.addEventListener('gamepadconnected', () => { if (!host.hidden) renderDevs(); });
  }
  let noteT = 0;
  function note(s) { const n = $('ctlNote'); if (n) { n.textContent = s; noteT = 90; } }

  // ---- devices ------------------------------------------------------------
  function renderDevs() {
    const d = $('ctlDevs');
    if (!d || !inp) return;
    while (d.firstChild) d.removeChild(d.firstChild);
    const list = inp.devices();
    for (const dv of list) {
      const c = el('div', 'dev' + (dv.kind === 'gamepad' ? ' pad' : ''));
      c.dataset.dev = dv.key;
      c.appendChild(el('b', null, dv.label));
      if (dv.kind === 'gamepad') {
        c.appendChild(el('i', null, dv.axes + ' axes · ' + dv.buttons + ' buttons'));
        const m = el('div', 'meter');
        for (let i = 0; i < dv.axes; i++) { const b = el('span', null); b.dataset.i = i; b.title = 'axis ' + i; m.appendChild(b); }
        c.appendChild(m);
      }
      d.appendChild(c);
    }
    const hint = el('div', 'hint', list.length > 1
      ? 'Wiggle a stick to see which is which.'
      : 'No controller yet — press any button on it and it appears here.');
    d.appendChild(hint);
  }

  // ---- rows ---------------------------------------------------------------
  const GROUPS = [['flying', 'Flying'], ['flight', 'The flight'], ['engines', 'Engines'], ['head', 'Head (a tracker as a gamepad)']];
  function renderRows() {
    const body = $('ctlBody');
    if (!body || !inp) return;
    while (body.firstChild) body.removeChild(body.firstChild);
    const L = inp.state().listening;
    for (const [g, title] of GROUPS) {
      const acts = inp.ACTIONS.filter(a => a.group === g);
      if (!acts.length) continue;
      body.appendChild(el('h3', null, title));
      for (const a of acts) body.appendChild(row(a, L));
    }
  }
  function chip(txt, title, onPick, onX) {
    const c = el('span', 'chip');
    const b = el('button', null, txt); b.type = 'button'; b.title = title || ''; b.onclick = onPick;
    c.appendChild(b);
    if (onX) { const x = el('button', 'x', '×'); x.type = 'button'; x.title = 'unbind'; x.onclick = onX; c.appendChild(x); }
    return c;
  }
  const devLabel = key => {
    const d = (inp.devices().find(x => x.key === key) || {});
    return d.label || key.replace(/\s*\(.*$/, '').slice(0, 18);
  };
  function row(a, L) {
    const r = el('div', 'ctlRow'); r.dataset.a = a.id;
    if (L && L.id === a.id) r.classList.add('listening');
    const k = el('div', 'k');
    k.appendChild(el('b', null, a.label));
    if (a.hint) k.appendChild(el('i', null, a.hint));
    r.appendChild(k);
    const chips = el('div', 'chips');
    const list = inp.bound(a.id);
    const kb = list.find(b => b.dev === 'keyboard');
    if (a.kind === 'axis') {
      // one chip per keyboard slot; a missing slot is an empty chip that listens
      const slots = a.shape === 'latch' ? [['pos', 'more'], ['neg', 'less'], ['max', 'full'], ['min', 'idle']]
                  : a.shape === 'pass' ? [] : [['pos', a.id === 'pitch' ? 'up' : a.id === 'yaw' ? 'right' : 'right'],
                                              ['neg', a.id === 'pitch' ? 'down' : a.id === 'yaw' ? 'left' : 'left']];
      for (const [slot, word] of slots) {
        const code = kb && kb[slot];
        const c = chip((code ? inp.keyLabel(code) : '+ key') + ' ', word, () => {
          inp.listen(a.id, { want: 'key', slot }, () => renderRows()); renderRows();
        }, code ? () => { const b = Object.assign({}, kb); delete b[slot];
                          if (!b.pos && !b.neg && !b.max && !b.min) inp.unbind(a.id, 'keyboard');
                          else inp.setBinding(a.id, b); renderRows(); } : null);
        c.classList.add('key');
        c.firstChild.appendChild(el('em', null, word));
        chips.appendChild(c);
      }
    } else {
      const c = chip(kb ? inp.keyLabel(kb.code) : '+ key', 'a key', () => {
        inp.listen(a.id, { want: 'key' }, () => renderRows()); renderRows();
      }, kb ? () => { inp.unbind(a.id, 'keyboard'); renderRows(); } : null);
      c.classList.add('key');
      chips.appendChild(c);
    }
    for (const b of list) {
      if (b.dev === 'keyboard') continue;
      const what = b.type === 'axis' ? 'axis ' + b.index + (b.invert ? ' ⇅' : '')
                 : b.type === 'button' ? 'btn ' + b.index
                 : 'hat ' + b.index + ' ' + (b.at > 0.9 ? '↑' : b.at < -0.9 ? '↓' : b.at.toFixed(2));
      const c = chip(devLabel(b.dev) + ' · ' + what, b.type === 'axis' ? 'tune' : 'rebind', () => {
        if (b.type === 'axis') { tuneFor = (tuneFor && tuneFor.id === a.id && tuneFor.dev === b.dev) ? null : { id: a.id, dev: b.dev }; renderRows(); }
        else { inp.listen(a.id, { want: 'gamepad' }, () => renderRows()); renderRows(); }
      }, () => { inp.unbind(a.id, b.dev); if (tuneFor && tuneFor.dev === b.dev) tuneFor = null; renderRows(); });
      c.classList.add('pad');
      chips.appendChild(c);
    }
    const add = chip('+ controller', 'listen for a controller', () => {
      inp.listen(a.id, { want: 'gamepad' }, () => renderRows()); renderRows();
    });
    add.classList.add('add');
    chips.appendChild(add);
    r.appendChild(chips);
    const bar = el('div', 'bar'); const fill = el('i', null); bar.appendChild(fill);
    if (a.kind === 'axis' && a.lo < 0) bar.classList.add('centred');
    r.appendChild(bar);
    if (L && L.id === a.id) r.appendChild(el('div', 'prompt', promptFor(a, L.want, L.slot)));
    // tuning, under the row it belongs to
    if (tuneFor && tuneFor.id === a.id) {
      const b = list.find(x => x.dev === tuneFor.dev);
      if (b && b.type === 'axis') r.appendChild(tuneRow(a, b));
    }
    return r;
  }
  function tuneRow(a, b) {
    const t = el('div', 'tune');
    const set = patch => { inp.setBinding(a.id, Object.assign({}, b, patch)); renderRows(); };
    const sw = (label, get, on) => {
      const w = el('label', null); const c = el('input', null); c.type = 'checkbox'; c.checked = !!get();
      c.onchange = () => on(c.checked); w.appendChild(c); w.appendChild(el('span', null, label)); return w;
    };
    const rng = (label, lo, hi, step, get, on, fmt) => {
      const w = el('label', null); w.appendChild(el('span', null, label));
      const i = el('input', null); i.type = 'range'; i.min = lo; i.max = hi; i.step = step; i.value = get();
      const v = el('b', null, fmt(get()));
      i.oninput = () => { v.textContent = fmt(+i.value); };
      i.onchange = () => on(+i.value);
      w.appendChild(i); w.appendChild(v); return w;
    };
    const sel = (label, get, on) => {
      const w = el('label', null); w.appendChild(el('span', null, label));
      const s = el('select', null);
      for (const [v, l] of [[-1, '−1'], [0, '0'], [1, '+1']]) { const o = el('option', null, l); o.value = v; s.appendChild(o); }
      s.value = get(); s.onchange = () => on(+s.value); w.appendChild(s); return w;
    };
    t.appendChild(sw('invert', () => b.invert, v => set({ invert: v })));
    t.appendChild(rng('deadzone', 0, 0.3, 0.01, () => b.dead, v => set({ dead: v }), v => (v * 100).toFixed(0) + ' %'));
    t.appendChild(rng('expo', 0, 1, 0.05, () => b.expo, v => set({ expo: v }), v => v.toFixed(2)));
    // G209: SENSITIVITY — full stick = this much of the control's travel. A
    // lever has no use for it (its travel IS the reading), so a latch skips it.
    if (a.shape !== 'latch')
      t.appendChild(rng('sensitivity', 0.1, 1.5, 0.05, () => (b.gain == null ? 1 : b.gain), v => set({ gain: v }), v => (v * 100).toFixed(0) + ' %'));
    t.appendChild(sel(a.shape === 'latch' ? 'idle reads' : 'span from', () => b.lo, v => set({ lo: v })));
    t.appendChild(sel(a.shape === 'latch' ? 'full reads' : 'to', () => b.hi, v => set({ hi: v })));
    return t;
  }

  // ---- live ---------------------------------------------------------------
  let lastL = null;
  function tick() {
    if (!rafOn) return;
    requestAnimationFrame(tick);
    if (!inp || !host || host.hidden) return;
    const st = inp.state();
    // a listen that ended (the model bound something) redraws the rows
    const Lid = st.listening ? st.listening.id : null;
    if (Lid !== lastL) { lastL = Lid; renderRows(); }
    for (const a of inp.ACTIONS) {
      const r = host.querySelector('.ctlRow[data-a="' + a.id + '"] .bar i');
      if (!r) continue;
      const v = st.actions[a.id] ? st.actions[a.id].value : 0;
      if (a.kind === 'axis' && a.lo < 0) {
        const u = v / (a.hi || 1);
        r.style.left = (u < 0 ? 50 + u * 50 : 50) + '%'; r.style.width = Math.abs(u) * 50 + '%';
      } else if (a.kind === 'axis') {
        r.style.left = '0'; r.style.width = ((v - a.lo) / (a.hi - a.lo) * 100) + '%';
      } else if (a.kind === 'button') {
        r.style.left = '0'; r.style.width = (v * 100) + '%';
      } else {
        r.style.left = '0'; r.style.width = st.actions[a.id] && st.actions[a.id].fired ? '100%' : '0';
      }
    }
    for (const dev in st.raw) {
      const m = host.querySelector('.dev[data-dev="' + dev.replace(/"/g, '\\"') + '"] .meter');
      if (!m) continue;
      const ax = st.raw[dev].axes || [];
      for (const s of m.children) {
        const i = +s.dataset.i, v = ax[i] || 0;
        s.style.setProperty('--v', (Math.abs(v) * 100).toFixed(0) + '%');
        s.classList.toggle('neg', v < -0.02);
        s.classList.toggle('on', Math.abs(v) > 0.5);
      }
    }
    if (noteT > 0 && --noteT === 0) { const n = $('ctlNote'); if (n) n.textContent = ''; }
    if (opts.who) { const w = $('ctlWho'); if (w) w.textContent = opts.who() || ''; }
  }

  // ---- doors --------------------------------------------------------------
  function open(model, o) {
    inp = model || inp || (typeof window !== 'undefined' && window.FLYDIY_INPUT) || null;
    opts = o || opts || {};
    build();
    if (!host || !inp) return false;
    host.hidden = false;
    tuneFor = null;
    renderDevs(); renderRows();
    inp.onChange(() => { if (!host.hidden) renderRows(); });
    if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
    return true;
  }
  function close() {
    if (!host) return;
    if (inp && inp.listening()) inp.cancelListen();
    host.hidden = true;
    rafOn = false;
  }
  const isOpen = () => !!(host && !host.hidden);
  const toggle = (model, o) => (isOpen() ? (close(), false) : open(model, o));

  const API = { open, close, toggle, isOpen };
  if (typeof window !== 'undefined') window.INPUT_PANEL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
