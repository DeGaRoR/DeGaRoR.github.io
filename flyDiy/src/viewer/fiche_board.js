// fiche_board.js - PLANE-RENDERS R3: THE FICHE IN THE GAME (the user, 4 Nov: "the full fiche could be generated and awarded on
// passed certification"; 7 Nov: "we just do it once at the beginning ... and let's rather have an UPDATE BUTTON. The user will
// choose when he wants to pay the wait"; the share: one composed board picture through the device's share sheet).
// plane_fiche.js draws and keeps the pictures; this file is the moment, the board and the share.
//
//   THE AWARD   bench.js calls FICHE_BOARD.certified() where it calls BENCH_CERTIFIED (the story's slot stays the story's):
//               the plane on the stand just took its airworthiness certificate. Nothing is drawn then: the fiche waits until
//               the certificate's own card is closed, the stand is the garage's and still, and the plane has a save's name
//               (an unsaved plane's fiche waits for its first Save - garage.js calls saved(name)). Then ONE draw, under a
//               corner line ("Drawing the fiche - hero, 1 of 6"), and a corner note that opens the board.
//               Never at a save, never on a load: a fiche is drawn at its certificate or by its Update button.
//   THE BOARD   #pfBoard: cream, the hero on top, the cutaway alone at the top right, a strip cycling side / front / top with
//               its dimension lines, the measured numbers (the plaque's call). Draggable (card_drag.js, by its header).
//               Out of date: "changed since its certificate" / "repainted since" - the fiche stays (the user: "a plane having
//               received one does not lose it"); Update redraws it when the plane on the stand holds its certificate now.
//   THE SHARE   one composed picture (2400 x 1600 PNG) through navigator.share (files); a browser without it saves the file.
//               Nothing is sent anywhere by the game.
//   THE ROUTE   the fleet's rows: a plane with a fiche carries a small "fiche" button (garage.js renderFleet -> rowButton).
//   THE OFFICIAL PLANES ship with their fiche (the user, 7 Nov: "a loading time that not everybody has, at the price of a few
//               pictures. That's acceptable"): media/fiches/index.json { fiches: { <list key>: { name, data, pics: { view:
//               file } } } } (tools/fiche_bake.js), read on the first ask; the All planes screen's official tiles carry the
//               door (new_plane.js -> tileDoor). A baked fiche has no Update: it is the game's.
//   COST        nothing until a certificate or a click: no timer runs without a pending award (a 1 s look while one is
//               pending) or an open board (the strip's 3 s cycle).
// GATE PLANEFICHE checks the wiring (tools/_plane_fiche_check.js).
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : null;
  if (!W) return;
  const F = () => W.PLANE_FICHE || null;
  const $ = (h, c) => { const e = document.createElement(h); if (c) e.className = c; return e; };
  const CSS = `
#pfNote { position:fixed; right:14px; bottom:14px; z-index:63; display:flex; gap:10px; align-items:center;
  font:500 12px/1.3 'IBM Plex Sans', sans-serif; color:var(--ed-ink,#e8e6e1); background:var(--ed-panel,#1d1f22);
  border:1px solid var(--ed-border,rgba(255,255,255,.14)); border-radius:8px; padding:9px 12px; box-shadow:0 6px 24px rgba(0,0,0,.35); }
#pfNote[hidden], #pfBoard[hidden] { display:none; }
#pfNote button, #pfBoard .pfHead button { font:500 10px/1 'IBM Plex Sans', sans-serif; letter-spacing:.08em; text-transform:uppercase;
  color:var(--ed-ink,#e8e6e1); background:var(--ed-btn-bg,rgba(255,255,255,.06)); border:1px solid var(--ed-btn-bd,rgba(255,255,255,.18));
  border-radius:999px; padding:6px 10px; cursor:pointer; }
#pfNote button:hover, #pfBoard .pfHead button:hover { border-color:rgba(255,255,255,.35); }
#pfNote button:disabled, #pfBoard .pfHead button:disabled { opacity:.45; cursor:default; }
#pfBoard { position:fixed; right:18px; top:64px; z-index:64; width:min(760px, calc(100vw - 36px)); max-height:calc(100vh - 84px);
  display:flex; flex-direction:column; background:var(--ed-panel,#1d1f22); border:1px solid var(--ed-border,rgba(255,255,255,.14));
  border-radius:10px; box-shadow:0 10px 40px rgba(0,0,0,.45); font:400 12px/1.35 'IBM Plex Sans', sans-serif; color:var(--ed-ink,#e8e6e1); }
#pfBoard .pfHead { display:flex; gap:8px; align-items:center; padding:9px 10px 9px 14px; border-bottom:1px solid var(--ed-hair,rgba(255,255,255,.08)); cursor:grab; }
#pfBoard .pfHead b { font-weight:600; font-size:13px; letter-spacing:.02em; }
#pfBoard .pfHead .pfReg { color:var(--ed-dim,#9a978f); }
#pfBoard .pfHead .pfStale { color:var(--ed-warn,#e0a040); font-size:11px; }
#pfBoard .pfHead .pfSp { flex:1; }
#pfBoard .pfSheet { position:relative; overflow:auto; margin:10px; border-radius:6px; background:#f3ede0; color:#2b2924; padding:14px 16px 16px; }
#pfBoard .pfTop { position:relative; min-height:220px; }
#pfBoard .pfHero { display:block; width:76%; height:auto; }
#pfBoard .pfCut { position:absolute; right:0; top:0; width:34%; height:auto; }
#pfBoard .pfLow { display:flex; gap:16px; align-items:flex-end; margin-top:10px; }
#pfBoard .pfStrip { position:relative; flex:1; min-height:120px; display:flex; align-items:center; justify-content:center; }
#pfBoard .pfStrip figure { position:relative; margin:0 26px 22px 0; }
#pfBoard .pfStrip img { display:block; max-width:100%; max-height:170px; }
#pfBoard .pfStrip svg { position:absolute; inset:0; overflow:visible; pointer-events:none; }
#pfBoard .pfStrip .pfDim { font:500 10px/1 'IBM Plex Sans', sans-serif; fill:#5a554b; }
#pfBoard .pfSpecs { width:220px; margin:0; display:grid; grid-template-columns:auto auto; gap:3px 12px; font-size:11.5px; }
#pfBoard .pfSpecs dt { color:#6d675b; } #pfBoard .pfSpecs dd { margin:0; text-align:right; font-weight:500; }
#pfBoard .pfName { font:600 15px/1.2 'IBM Plex Sans', sans-serif; letter-spacing:.02em; margin:0 0 4px; }
#pfBoard .pfMsg { padding:10px 14px; color:var(--ed-dim,#9a978f); }
.gfFiche { font:500 10px/1 'IBM Plex Sans', sans-serif; letter-spacing:.06em; text-transform:uppercase; }
.npFiche { position:absolute; right:6px; top:6px; font:500 9px/1 'IBM Plex Sans', sans-serif; letter-spacing:.08em; text-transform:uppercase;
  color:var(--ed-ink,#e8e6e1); background:rgba(0,0,0,.45); border:1px solid rgba(255,255,255,.25); border-radius:999px; padding:4px 7px; cursor:pointer; }
.npFiche:hover { border-color:rgba(255,255,255,.5); }`;
  let styled = false;
  const style = () => { if (styled) return; styled = true; const s = $('style'); s.textContent = CSS; document.head.appendChild(s); };
  // ---- the corner line: the waiting, then the result (the rule for a wait over a second) -------------------------------
  let noteEl = null;
  function note(text, btn, onBtn) {
    style();
    if (!noteEl) { noteEl = $('div'); noteEl.id = 'pfNote'; document.body.appendChild(noteEl); }
    noteEl.innerHTML = ''; const sp = $('span'); sp.textContent = text; noteEl.appendChild(sp);
    if (btn) { const b = $('button'); b.type = 'button'; b.textContent = btn; b.onclick = onBtn; noteEl.appendChild(b); }
    const x = $('button'); x.type = 'button'; x.textContent = '×'; x.title = 'close'; x.onclick = () => { noteEl.hidden = true; }; noteEl.appendChild(x);
    noteEl.hidden = false;
  }
  const noteOff = () => { if (noteEl) noteEl.hidden = true; };
  // ---- the award ------------------------------------------------------------------------------------------------------
  let pending = false, looking = null, drawing = false;
  // a career's slot carries its tag (app.js slotLabel's rule): the board says the design's name
  const label = n => { try { return typeof CAREER_SLOT_TAG !== 'undefined' && typeof n === 'string' ? n.replace(CAREER_SLOT_TAG, '') : n; } catch (e) { return n; } };
  const standName = () => { try { return W.GARAGE_SPEC && W.GARAGE_SPEC.name ? W.GARAGE_SPEC.name() || '' : ''; } catch (e) { return ''; } };
  const certNow = () => { try { const s = W.BENCH_STATE ? W.BENCH_STATE() : null; return !!(s && s.passed); } catch (e) { return false; } };
  // the stand is the garage's, the plane on it, nothing over it, the certificate's card closed
  function standFree() {
    try {
      const H = W.FLYDIY_HOLDS ? W.FLYDIY_HOLDS() : null;
      if (H && (!H.inGarage || H.craftAway || H.holdRender || H.rollHold)) return false;
      if (W.NEW_PLANE && W.NEW_PLANE.isOpen && W.NEW_PLANE.isOpen()) return false;
      const aw = document.getElementById('bAward'); if (aw && !aw.hidden) return false;
      const sc = W.CAGE_UI_SCENE; if (!sc || !sc.parent) return false;
      return !document.hidden;
    } catch (e) { return false; }
  }
  function look() {
    looking = null;
    if (!pending || drawing) return;
    if (!certNow()) { pending = false; return; }       // the certificate went (a change on the bench) before it could be drawn
    const n = standName();
    if (!n || !standFree()) { looking = setTimeout(look, 1000); return; }
    pending = false;
    drawFor(n, 'award');
  }
  function certified() { pending = true; if (!looking) looking = setTimeout(look, 1200); }
  // garage.js: a Save (an unsaved plane's fiche waits for its name)
  function saved() { if (pending && !looking) looking = setTimeout(look, 600); }
  async function drawFor(name, why) {
    const P = F(); if (!P || drawing) return null;
    drawing = true;
    const title = label(name);
    note('Drawing the fiche of ' + title + ' …');
    let out = null;
    try {
      const had = why === 'update' ? null : await P.get(name).catch(() => null);
      if (had && had.hash === P._hashOf(W.GARAGE_SPEC.get()) && had.fp === (W.BENCH_FP ? W.BENCH_FP() : null)) out = had;
      else out = await P.generate({ name, title, onStep: (v, i, n) => note('Drawing the fiche of ' + title + ' — ' + v + ', ' + (i + 1) + ' of ' + n) });
      has.add(name);
      try { W.dispatchEvent(new CustomEvent('plane-fiche', { detail: { name } })); } catch (e) {}
      if (board && !board.hidden && boardName === name) show(name);
      else note((why === 'update' ? 'The fiche of ' : 'Certified — the fiche of ') + title + ' is ready', 'open', () => { noteOff(); show(name); });
    } catch (e) {
      console.warn('flyDiy (fiche):', e && e.message);
      note('The fiche could not be drawn: ' + String(e && e.message || e).slice(0, 90));
    } finally { drawing = false; }
    return out;
  }
  // ---- the fleet's door ----------------------------------------------------------------------------------------------
  const has = new Set(); let hasRead = null;
  const known = () => hasRead || (hasRead = (F() && F().names ? F().names() : Promise.resolve([])).then(a => { for (const n of a) has.add(n); return has; }).catch(() => has));
  function rowButton(row, name) {
    if (!row || !F()) return;
    known().then(() => {
      if (!has.has(name) || row.querySelector('.gfFiche')) return;
      style();
      const b = $('button', 'gfHome gfFiche'); b.type = 'button'; b.textContent = 'fiche'; b.title = 'The fiche of this aeroplane';
      b.addEventListener('click', e => { e.stopPropagation(); show(name); });
      row.appendChild(b);
    });
  }
  function forget(name) { has.delete(name); try { if (F()) F().forget(name); } catch (e) {} }
  // the official planes' fiches, baked (the list's keys: design:cub, list:5, cand:<file>, stock:<name>)
  const BAKED = 'media/fiches/';
  let bakedP = null;
  const baked = () => bakedP || (bakedP = (typeof fetch === 'function' ? fetch(BAKED + 'index.json').then(r => (r.ok ? r.json() : null)) : Promise.resolve(null))
    .then(j => (j && j.fiches) || {}, () => ({})));
  const bakedRec = (key, B) => { const b = B[key]; if (!b) return null; const pics = {}; for (const v in b.pics || {}) pics[v] = BAKED + b.pics[v]; return { name: key, baked: true, data: b.data || { name: b.name }, pics }; };
  // the All planes screen's tile: a small door in its corner (a span: a button cannot hold a button); a click opens the board, not the plane
  function tileDoor(tile, key) {
    if (!tile || !key) return;
    baked().then(B => {
      if (!B[key] || tile.querySelector('.npFiche')) return;
      style();
      const d = $('span', 'npFiche'); d.textContent = 'fiche'; d.title = 'The fiche of this aeroplane'; d.setAttribute('role', 'button'); d.tabIndex = 0;
      const go = e => { e.stopPropagation(); e.preventDefault(); show(key); };
      d.addEventListener('click', go); d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(e); });
      if (tile.style && !tile.style.position) tile.style.position = 'relative';
      tile.appendChild(d);
    });
  }
  // ---- the board -----------------------------------------------------------------------------------------------------
  let board = null, boardName = '', cycle = null, urls = [];
  const freeUrls = () => { for (const u of urls) URL.revokeObjectURL(u); urls = []; };
  const urlOf = b => { if (!b) return ''; if (typeof b === 'string') return b; const u = URL.createObjectURL(b); urls.push(u); return u; };
  const kmh = v => (v != null && isFinite(v) ? Math.round(v * 3.6) + ' km/h' : '—');
  const num = (v, u, d) => (v != null && isFinite(v) ? (+v).toFixed(d || 0) + ' ' + u : '—');
  function specRows(d) {
    const s = d.specs || {}, D = d.dims || {};
    return [['span', num(D.span, 'm', 2)], ['length', num(D.length, 'm', 2)], ['height', num(D.height, 'm', 2)],
            ['empty', num(s.empty, 'kg')], ['all up', num(s.allUp, 'kg')], ['stall', kmh(s.Vs)], ['cruise', kmh(s.VCruise)],
            ['climb', num(s.climb, 'm/s', 1)], ['take-off run', num(s.TORun, 'm')],
            ['engine', s.engine || d.engine || '—'], ['propeller', s.propD ? (+s.propD).toFixed(2) + ' m' + (s.propBlades ? ', ' + s.propBlades + ' blades' : '') : '—'],
            ['seats', d.seats != null ? String(d.seats) : '—']];
  }
  // the strip's three views, each with its two dimension lines (the picture is cropped to the silhouette: its box is the size)
  const STRIP = [['side', 'length', 'height'], ['front', 'span', 'height'], ['plan', 'span', 'length']];
  function dimSvg(w, h, a, b) {
    const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h); s.setAttribute('preserveAspectRatio', 'none');
    const k = Math.max(w, h) / 300, ln = (x1, y1, x2, y2) => { const l = document.createElementNS(ns, 'line'); l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); l.setAttribute('stroke', '#7c766a'); l.setAttribute('stroke-width', k); s.appendChild(l); };
    const tx = (x, y, t, rot) => { const e = document.createElementNS(ns, 'text'); e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('class', 'pfDim'); e.setAttribute('text-anchor', 'middle'); e.setAttribute('font-size', 10 * k); if (rot) e.setAttribute('transform', 'rotate(-90 ' + x + ' ' + y + ')'); e.textContent = t; s.appendChild(e); };
    const yb = h + 9 * k, xr = w + 9 * k, t = 3 * k;
    ln(0, yb, w, yb); ln(0, yb - t, 0, yb + t); ln(w, yb - t, w, yb + t); tx(w / 2, yb + 13 * k, a);
    ln(xr, 0, xr, h); ln(xr - t, 0, xr + t, 0); ln(xr - t, h, xr + t, h); tx(xr + 13 * k, h / 2, b, true);
    return s;
  }
  function show(name, rec) {
    const P = F(); if (!P) return;
    style();
    if (!board) {
      board = $('div'); board.id = 'pfBoard'; board.hidden = true;
      board.innerHTML = '<div class="pfHead"><b></b><span class="pfReg"></span><span class="pfStale"></span><span class="pfSp"></span>' +
        '<button type="button" class="pfUpd">update</button><button type="button" class="pfShare">share</button><button type="button" class="pfClose">close</button></div>' +
        '<div class="pfBody"></div>';
      board.querySelector('.pfClose').onclick = close;
      document.body.appendChild(board);
    }
    boardName = name;
    const body = board.querySelector('.pfBody');
    const paint = r => {
      freeUrls(); if (cycle) { clearInterval(cycle); cycle = null; }
      body.innerHTML = '';
      if (!r) { const m = $('div', 'pfMsg'); m.textContent = 'No fiche yet: it is drawn when this aeroplane takes its airworthiness certificate.'; body.appendChild(m); return; }
      const d = r.data || {}, st = P.stale && standName() === name ? P.stale(r) : null;
      board.querySelector('.pfHead b').textContent = d.name || label(name);
      board.querySelector('.pfReg').textContent = d.reg || '';
      board.querySelector('.pfStale').textContent = st && st.cert ? 'changed since its certificate' : st && st.paint ? 'repainted since' : '';
      const upd = board.querySelector('.pfUpd'), can = !r.baked && standName() === name && certNow() && !drawing;
      upd.disabled = !can; upd.title = can ? 'Draw the fiche again (a few seconds)' : r.baked ? 'An official aeroplane\'s fiche comes with the game' : standName() !== name ? 'Put this aeroplane on the stand to update its fiche' : 'Its certificate first: the fiche is the certified aeroplane\'s';
      upd.onclick = () => { if (!upd.disabled) drawFor(name, 'update'); };
      board.querySelector('.pfShare').onclick = () => share(r);
      const sh = $('div', 'pfSheet'), top = $('div', 'pfTop'), low = $('div', 'pfLow');
      const hero = $('img', 'pfHero'); hero.alt = ''; hero.src = urlOf(r.pics.hero); top.appendChild(hero);
      if (r.pics.cutaway) { const c = $('img', 'pfCut'); c.alt = ''; c.src = urlOf(r.pics.cutaway); top.appendChild(c); }
      const strip = $('div', 'pfStrip'), views = STRIP.filter(v => r.pics[v[0]]);
      let iv = 0;
      const one = () => {
        if (!views.length) return;
        const [v, a, b] = views[iv++ % views.length], D = d.dims || {};
        const fig = $('figure'), im = $('img'); im.alt = ''; im.src = urlOf(r.pics[v]);
        im.onload = () => fig.appendChild(dimSvg(im.naturalWidth, im.naturalHeight, num(D[a], 'm', 2), num(D[b], 'm', 2)));
        fig.appendChild(im); strip.innerHTML = ''; strip.appendChild(fig);
      };
      one(); if (views.length > 1) cycle = setInterval(() => { if (!board || board.hidden) return; one(); }, 3000);
      const side = $('div'), nm = $('div', 'pfName'); nm.textContent = d.name || label(name); side.appendChild(nm);
      const dl = $('dl', 'pfSpecs'); for (const [k, v] of specRows(d)) { const dt = $('dt'), dd = $('dd'); dt.textContent = k; dd.textContent = v; dl.appendChild(dt); dl.appendChild(dd); }
      side.appendChild(dl);
      low.appendChild(strip); low.appendChild(side);
      sh.appendChild(top); sh.appendChild(low); body.appendChild(sh);
    };
    board.hidden = false;
    if (rec) paint(rec);
    else if (/^(design|list|cand|stock|arch):/.test(name)) baked().then(B => paint(bakedRec(name, B)), () => paint(null));
    else P.get(name).then(paint, () => paint(null));
  }
  function close() { if (board) board.hidden = true; if (cycle) { clearInterval(cycle); cycle = null; } freeUrls(); }
  // ---- the share: one composed picture ---------------------------------------------------------------------------------
  const bitmap = b => (typeof b === 'string' ? fetch(b).then(r => r.blob()) : Promise.resolve(b)).then(x => createImageBitmap(x));
  async function compose(r) {
    const Wd = 2400, Ht = 1600, c = document.createElement('canvas'); c.width = Wd; c.height = Ht;
    const g = c.getContext('2d'), d = r.data || {};
    g.fillStyle = '#f3ede0'; g.fillRect(0, 0, Wd, Ht);
    const fit = (im, x, y, w, h) => { const s = Math.min(w / im.width, h / im.height); const dw = im.width * s, dh = im.height * s; g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); };
    const P = r.pics;
    if (P.hero) fit(await bitmap(P.hero), 60, 60, 1500, 1000);
    if (P.cutaway) fit(await bitmap(P.cutaway), 1560, 60, 780, 620);
    const strip = ['side', 'front', 'plan'].filter(v => P[v]);
    for (let i = 0; i < strip.length; i++) fit(await bitmap(P[strip[i]]), 1000 + i * 460, 1130, 420, 400);
    g.fillStyle = '#2b2924'; g.font = '600 64px "IBM Plex Sans", sans-serif'; g.fillText(d.name || '', 70, 1180);
    g.fillStyle = '#6d675b'; g.font = '500 34px "IBM Plex Sans", sans-serif'; if (d.reg) g.fillText(d.reg, 70, 1232);
    g.font = '400 30px "IBM Plex Sans", sans-serif';
    const rows = specRows(d).filter(x => x[1] !== '—');
    rows.forEach(([k, v], i) => { const col = i % 2, rw = Math.floor(i / 2); g.fillStyle = '#6d675b'; g.fillText(k, 70 + col * 450, 1300 + rw * 44); g.fillStyle = '#2b2924'; g.fillText(v, 270 + col * 450, 1300 + rw * 44); });
    g.fillStyle = '#9a9283'; g.font = '400 24px "IBM Plex Sans", sans-serif'; g.fillText('flyDiy · certified airworthy', 2060, 1560);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
  async function share(r) {
    let blob = null; try { blob = await compose(r); } catch (e) { note('The picture could not be made: ' + String(e && e.message || e).slice(0, 80)); return; }
    if (!blob) return;
    const fname = String((r.data && r.data.name) || r.name || 'aeroplane').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '_fiche.png';
    const file = typeof File === 'function' ? new File([blob], fname, { type: 'image/png' }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { await navigator.share({ files: [file], title: (r.data && r.data.name) || 'aeroplane' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  W.FICHE_BOARD = { certified, saved, show, close, rowButton, tileDoor, forget, compose, drawFor, get pending() { return pending; }, get drawing() { return drawing; } };
})();
