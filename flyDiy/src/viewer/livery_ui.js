// LIVERY_UI - THE LIVERY PICKER on top of the garage's Finish tab (LIVERY-MANAGER, the user 13 Nov: "a plane should
// hold SEVERAL saved liveries and swap between them. In the garage's Finish section you first pick the overall livery,
// then work on the individual parameters as today"; the design page ULksoJtJ796Ge9bfFKigHP, approved with its defaults).
//
// One whole-plane block, shown above the Finish rows whatever part is selected (editor.js renderFinish appends
// LIVERY_UI.panel() first). The rows below edit the worn livery exactly as before; this block only says WHICH saved
// livery that is, and swaps it:
//   the cards     one a saved livery (its base, trim and body colours as a swatch, its name); a click wears it
//   Save          the worn livery takes what the rows say now          Save as…   a new livery, worn from now on
//   Rename        the worn one                                         Delete…    another one (never the worn, never the last)
//   Copy from…    a livery of another saved build, added to this plane's (not worn)
// Switching while the worn livery has unsaved edits asks IN PLACE (never a dialog): save then switch / save as new /
// discard / cancel. A swap is one undo step ("wearing X · undo").
// The data is the core's (src/core/66c_livery.js: liveryOf / liveryApply / LIVERY_OPS / liveryEnvelope); the store is
// the garage's envelope (GARAGE_SPEC.liveries). A swap goes the career repaint's way (app.js econRestoreNow): the paint
// by GARAGE_SPEC.update (its job never touched), the finish by CAGE_UI.finishFromSpec + build, then one commit. The
// certificate never moves (the plaque and genCertKey are blind to paint and finish; GATE LIVERYSET).
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const G = () => window.GARAGE_SPEC || null, E = () => window.CAGE_UI || null;
  const core = typeof liveryState === 'function' && typeof LIVERY_OPS === 'object';
  let el = null, ask = null, undo = null, busy = false;
  const hex = n => '#' + ((+n >>> 0) & 0xffffff).toString(16).padStart(6, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // the spec as it stands, its finish as the rows hold it (the join's export lags a slider by the commit's 400 ms)
  function cur() {
    const g = G(), e = E(); if (!g) return null;
    const s = g.get();
    if (e && typeof e.finishToSpec === 'function') { try { s.finish = e.finishToSpec() || null; } catch (x) {} }
    return s;
  }
  function state() {
    const s = cur(); if (!s) return null;
    const L = (G().liveries && G().liveries()) || {};
    return liveryState(s, L.liveries, L.livery);
  }
  const persist = st => { const g = G(); if (g && g.liveries) g.liveries(liveryEnvelope(st)); };
  // wear a spec's look: the paint (the job is the plane's, liveryApply kept it), then the finish, then one commit
  function wearSpec(s2) {
    const g = G(), e = E(); if (!g || !e) return false;
    busy = true;
    try {
      g.update({ paint: s2.paint });
      if (typeof e.finishFromSpec === 'function') e.finishFromSpec(s2.finish || {});
      if (typeof e.build === 'function') e.build();
      if (typeof g.commit === 'function') g.commit();
    } finally { busy = false; }
    return true;
  }
  function wear(st, id, keepUndo) {
    const before = cur(), L0 = G().liveries ? G().liveries() : null;
    const nx = LIVERY_OPS.wear(st, id);
    if (nx === st) return;
    if (!wearSpec(nx.spec)) return;
    persist(nx);
    const e = nx.list.find(x => x.id === id);
    undo = keepUndo === false ? null : { label: e ? e.name : '', paint: before.paint, finish: before.finish, livs: L0 };
    ask = null; draw();
  }
  function doUndo() {
    const u = undo; if (!u) return;
    undo = null;
    const s = cur(); s.paint = Object.assign({}, u.paint, { job: s.paint && s.paint.job }); s.finish = u.finish;
    wearSpec(s);
    if (G().liveries) G().liveries(u.livs || null);
    draw();
  }
  const swatch = e => {
    const p = e.paint || {}, b = e.finish && e.finish.sections && e.finish.sections.body && e.finish.sections.body.tint;
    return `<i style="background:${hex(b != null ? b : p.base)}"></i><i style="background:${hex(p.trim)}"></i><i style="background:${hex(p.base)}"></i>`;
  };
  function draw() {
    if (!el) return;
    const st = core ? state() : null;
    if (!st) { el.innerHTML = '<div class="lvNote">The livery picker needs the garage.</div>'; return; }
    const on = st.list.find(x => x.id === st.on), mod = liveryModified(st);
    let h = `<div class="lvHead"><span class="lvLbl">Livery</span><b class="lvName">${esc(on ? on.name : '')}</b>` +
            (mod ? '<span class="lvMod" title="The rows below differ from the saved livery">modified</span>' : '') + '</div>';
    h += '<div class="lvCards">' + st.list.map(e => `<button class="lvCard${e.id === st.on ? ' on' : ''}" data-lv="${esc(e.id)}" title="${e.id === st.on ? 'Worn' : 'Wear'} ${esc(e.name)}"><span class="lvSw">${swatch(e)}</span><span class="lvN">${esc(e.name)}</span></button>`).join('') + '</div>';
    h += '<div class="lvBtns">' +
         `<button class="lvB pri" data-op="save"${mod ? '' : ' disabled'}>Save</button>` +
         `<button class="lvB" data-op="saveAs"${st.list.length >= LIVERY_MAX ? ' disabled' : ''}>Save as…</button>` +
         '<button class="lvB" data-op="rename">Rename</button>' +
         `<button class="lvB q" data-op="del"${st.list.length > 1 ? '' : ' disabled'}>Delete…</button>` +
         '<button class="lvB q" data-op="copy">Copy from…</button></div>';
    if (ask) h += '<div class="lvAsk">' + askHtml(st) + '</div>';
    else if (undo) h += `<div class="lvNote">Wearing ${esc(undo.label)} · <button class="lvLink" data-op="undo">undo</button></div>`;
    el.innerHTML = h;
    const inp = el.querySelector('.lvAsk input'); if (inp) { inp.focus(); inp.select(); }
  }
  function askHtml(st) {
    const on = st.list.find(x => x.id === st.on);
    if (ask.k === 'name') return `<label>${ask.what === 'rename' ? 'Rename' : 'New livery'} <input maxlength="40" value="${esc(ask.what === 'rename' ? (on ? on.name : '') : 'Livery ' + (st.list.length + 1))}"></label>` +
      `<div class="lvBtns"><button class="lvB pri" data-op="nameOk">${ask.what === 'rename' ? 'Rename' : 'Save as new'}</button><button class="lvB q" data-op="cancel">Cancel</button></div>`;
    if (ask.k === 'switch') { const to = st.list.find(x => x.id === ask.id);
      return `${esc(on ? on.name : 'This livery')} has unsaved changes.<div class="lvBtns"><button class="lvB pri" data-op="swSave">Save, then wear ${esc(to ? to.name : '')}</button>` +
             '<button class="lvB" data-op="swSaveAs">Save as new</button><button class="lvB q" data-op="swDiscard">Discard</button><button class="lvB q" data-op="cancel">Cancel</button></div>'; }
    if (ask.k === 'del') {
      if (ask.id) { const d = st.list.find(x => x.id === ask.id);
        return `Delete ${esc(d ? d.name : '')}?<div class="lvBtns"><button class="lvB pri" data-op="delOk">Delete ${esc(d ? d.name : '')}</button><button class="lvB q" data-op="cancel">Cancel</button></div>`; }
      return 'Delete which livery? (not the one worn)<div class="lvBtns">' + st.list.filter(x => x.id !== st.on).map(x => `<button class="lvB" data-del="${esc(x.id)}">${esc(x.name)}</button>`).join('') + '<button class="lvB q" data-op="cancel">Cancel</button></div>';
    }
    if (ask.k === 'copy') {
      const g = G(), me = g.name ? g.name() : '', rows = [];
      for (const n of (g.list ? g.list() : [])) {
        if (n === me || !g.slotLiveries) continue;
        const L = g.slotLiveries(n); if (!L) continue;
        if (L.liveries) for (const e of liveriesClean(L.liveries) || []) rows.push({ slot: n, lv: e, name: e.name });
        else if (L.spec) { const w = liveryOf(L.spec); rows.push({ slot: n, lv: { paint: w.paint, finish: w.finish }, name: n }); }
      }
      ask.rows = rows;
      if (!rows.length) return 'No other saved build to copy from.<div class="lvBtns"><button class="lvB q" data-op="cancel">Close</button></div>';
      return 'Copy a livery in from another saved build (added, not worn):<div class="lvBtns lvList">' + rows.map((r, i) => `<button class="lvB" data-copy="${i}"><span class="lvSw">${swatch(r.lv)}</span>${esc(r.slot)}${r.name !== r.slot ? ' · ' + esc(r.name) : ''}</button>`).join('') + '<button class="lvB q" data-op="cancel">Close</button></div>';
    }
    return '';
  }
  function onClick(ev) {
    const b = ev.target.closest('button'); if (!b || !el.contains(b) || b.disabled) return;
    ev.preventDefault();
    let st = state(); if (!st) return;
    const op = b.dataset.op;
    if (b.dataset.lv) {
      const id = b.dataset.lv; if (id === st.on) return;
      if (liveryModified(st)) { ask = { k: 'switch', id }; draw(); return; }
      wear(st, id); return;
    }
    if (b.dataset.del) { ask = { k: 'del', id: b.dataset.del }; draw(); return; }
    if (b.dataset.copy != null) { const r = ask && ask.rows && ask.rows[+b.dataset.copy]; if (r) { persist(LIVERY_OPS.copyIn(st, r.lv, r.name)); ask = null; draw(); } return; }
    if (op === 'save') { persist(LIVERY_OPS.save(st)); draw(); return; }
    if (op === 'saveAs' || op === 'rename') { ask = { k: 'name', what: op }; draw(); return; }
    if (op === 'del') { ask = { k: 'del' }; draw(); return; }
    if (op === 'copy') { ask = { k: 'copy' }; draw(); return; }
    if (op === 'cancel') { ask = null; draw(); return; }
    if (op === 'undo') { doUndo(); return; }
    if (op === 'nameOk') {
      const v = (el.querySelector('.lvAsk input') || {}).value || '';
      if (ask.what === 'rename') persist(LIVERY_OPS.rename(st, st.on, v));
      else {
        st = LIVERY_OPS.saveAs(st, v); persist(st);
        if (ask.then) { const to = ask.then; ask = null; wear(st, to); return; }
      }
      ask = null; draw(); return;
    }
    if (op === 'delOk') { persist(LIVERY_OPS.remove(st, ask.id)); ask = null; draw(); return; }
    if (op === 'swSave') { const to = ask.id; st = LIVERY_OPS.save(st); persist(st); ask = null; wear(st, to); return; }
    if (op === 'swSaveAs') { ask = { k: 'name', what: 'saveAs', then: ask.id }; draw(); return; }
    if (op === 'swDiscard') { const to = ask.id; ask = null; wear(st, to); return; }
  }
  function onKey(ev) {
    if (ev.target.tagName !== 'INPUT' || !el.contains(ev.target)) return;
    if (ev.key === 'Enter') { ev.preventDefault(); const ok = el.querySelector('[data-op="nameOk"]'); if (ok) ok.click(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ask = null; draw(); }
    ev.stopPropagation();          // the editor's own keys stay out of a name being typed
  }
  function styles() {
    if (document.getElementById('lvPickCss')) return;
    const s = document.createElement('style'); s.id = 'lvPickCss';
    s.textContent = `
#lvPick{margin:0 0 10px;padding:9px 10px;border:1px solid var(--ed-border,rgba(255,248,236,.14));border-radius:10px;background:rgba(0,0,0,.18);color:var(--ed-ink,#f4efe6);font-size:12.5px}
#lvPick .lvHead{display:flex;align-items:center;gap:8px;margin-bottom:7px;min-width:0}
#lvPick .lvLbl{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--ed-faint,#97907f)}
#lvPick .lvName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lvPick .lvMod{font-size:11.5px;color:var(--ed-warn,#d8a07a)}#lvPick .lvMod::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:1px}
#lvPick .lvCards{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
#lvPick .lvCard{display:flex;flex-direction:column;gap:4px;padding:5px;border:1px solid var(--ed-btn-bd,rgba(255,255,255,.18));border-radius:8px;background:var(--ed-board,#1a1815);color:var(--ed-dim,#c0b8ac);font:inherit;font-size:11.5px;text-align:left;cursor:pointer;min-width:0}
#lvPick .lvCard.on{border-color:var(--ed-acc,#e6dbc9);box-shadow:0 0 0 1px var(--ed-acc,#e6dbc9);color:var(--ed-ink,#f4efe6)}
#lvPick .lvSw{display:flex;height:16px;border-radius:4px;overflow:hidden;flex:none}#lvPick .lvSw i{flex:1}
#lvPick .lvB .lvSw{display:inline-flex;width:28px;height:12px;vertical-align:-1px;margin-right:6px}
#lvPick .lvN{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lvPick .lvBtns{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
#lvPick .lvB{font:inherit;font-size:12px;padding:4px 9px;border-radius:7px;border:1px solid var(--ed-btn-bd,rgba(255,255,255,.18));background:var(--ed-btn-bg,rgba(255,255,255,.06));color:var(--ed-ink,#f4efe6);cursor:pointer}
#lvPick .lvB.pri{background:var(--ed-acc,#e6dbc9);color:var(--ed-acc-ink,#221f1b);border-color:var(--ed-acc,#e6dbc9);font-weight:600}
#lvPick .lvB.q{color:var(--ed-faint,#97907f)}#lvPick .lvB:disabled{opacity:.4;cursor:default}
#lvPick .lvAsk{margin-top:8px;padding:7px 9px;border:1px solid var(--ed-warn,#d8a07a);border-radius:8px;background:rgba(216,160,122,.08)}
#lvPick .lvAsk input{font:inherit;margin-left:6px;padding:3px 6px;border-radius:5px;border:1px solid var(--ed-btn-bd,rgba(255,255,255,.18));background:var(--ed-track,rgba(0,0,0,.3));color:var(--ed-ink,#f4efe6);width:min(180px,60%)}
#lvPick .lvList{max-height:180px;overflow:auto}
#lvPick .lvNote{margin-top:7px;color:var(--ed-faint,#97907f)}#lvPick .lvLink{font:inherit;background:none;border:0;padding:0;color:var(--ed-acc,#e6dbc9);text-decoration:underline;cursor:pointer}
html.phone #lvPick .lvCards{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}html.phone #lvPick .lvCard{flex:0 0 96px;scroll-snap-align:start}
html.phone #lvPick .lvB{min-height:34px}`;
    document.head.appendChild(s);
  }
  // THE BLOCK: one element, re-appended by renderFinish (the parking loop detaches it, never destroys it)
  function panel() {
    if (!el) {
      styles();
      el = document.createElement('div'); el.id = 'lvPick'; el.className = 'lvPick';
      el.addEventListener('click', onClick); el.addEventListener('keydown', onKey);
      const g = G(); if (g && g.onCommit) g.onCommit(() => { if (!busy && el && el.isConnected && !ask) draw(); });
      window.addEventListener('flydiy:specUpdated', () => { if (!busy && el && el.isConnected && !ask) draw(); });
    }
    if (!ask) draw();
    return el;
  }
  // a new aeroplane on the stand: no undo across planes, no half-asked question
  window.addEventListener('flydiy:specApplied', () => { if (!busy) { undo = null; ask = null; } });
  window.LIVERY_UI = { panel, draw, state: () => (core ? state() : null) };
})();
