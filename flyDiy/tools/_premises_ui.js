// _premises_ui.js — THE PREMISES EDITOR, THE MODULE (G353 / GPREM; the design:
// futureDesigns/PREMISES-EDITOR-2026-09-13.md). One editor, two hosts: the
// bench page today (tools/_premises.html), the game's WORLD rail entry at the
// port (src/viewer/premises_ui.js). It writes RECORDS ONLY — every visual is
// the renderer's rebuild from the record (tools/_premises_draw.js), every
// height the core's composition (tools/_premises_gen.js). No tool touches
// terrain, trees or meshes.
//
//   PREMISES_UI.mount(host, ctx) -> handle
//     host   the element the rail, the tool strip and the inspector are built in
//     ctx = { THREE, world, R (RENDER_PREMISES), camera(), ground(clientX, clientY) -> [x, y, z] | null,
//             ray(clientX, clientY) -> THREE.Ray, cameras { mode(), set(m), toggle() },
//             rows { slider, select, check, note, section, button }, els { chk, plaque, strip },
//             tick(fn), storage, rig { get, set } | null, fresh }
//     handle = { record(), load(rec), save(name), cmd(name, args), select(id), tool(name),
//                undo(), redo(), checks(), section(name), close() }
//
// v0 — TERRAIN (flatten / raise / ramp / grade, plus the surface and no-trees
// polygons that later move to their own sections), FILE, VIEW. The tool
// state machine, the ghost with its validity colour (red refuses), vertex and
// midpoint handles, the inspector's declared rows, undo/redo as a command
// stack over the record, autosave, the #chk panel mirroring GATE PREMISES.
(function () {
'use strict';
if (typeof window === 'undefined') return;
const PG = window.PREMISES_GEN;

const SECTIONS = [
  { k: 'terrain', label: 'TERRAIN', icon: '⛰', tools: ['select', 'flatten', 'raise', 'ramp', 'grade', 'surface', 'exclude', 'probe'] },
  { k: 'file',    label: 'FILE',    icon: '▤',  tools: [] },
  { k: 'view',    label: 'VIEW',    icon: '◎',  tools: [] },
];
const TOOL_LABEL = { select: 'select', flatten: 'flatten', raise: 'raise / lower', ramp: 'ramp', grade: 'grade (road)', surface: 'surface', exclude: 'no trees', probe: 'probe' };
const TOOL_HELP = {
  select: 'click a feature to select it; drag its discs; Del deletes',
  flatten: 'click the corners of the flat, Enter or double-click to close',
  raise: 'click the corners, close; then set the lift in the inspector',
  ramp: 'click the corners, close; then set the plane in the inspector',
  grade: 'click the road\'s points, Enter to end; a height per point in the inspector',
  surface: 'click the corners of the paved / gravel / sand patch, close',
  exclude: 'click the corners where no tree may grow, close',
  probe: 'click the ground to read its height and slope',
};
const POLY_TOOLS = { flatten: 'terrain', raise: 'terrain', ramp: 'terrain', surface: 'surface', exclude: 'exclude' };
const LS_WIP = 'flydiy.premises.wip', LS_VIEW = 'flydiy.prem.view';

function mount(host, ctx) {
  const { THREE, world, R, rows, els } = ctx;
  const $ = (t, a, kids) => { const e = document.createElement(t); if (a) for (const k in a) { if (k === 'text') e.textContent = a[k]; else if (k === 'style') e.style.cssText = a[k]; else if (k === 'class') e.className = a[k]; else e.setAttribute(k, a[k]); } if (kids) for (const c of kids) e.appendChild(c); return e; };

  // ---- the record and its store --------------------------------------------
  let rec = PG.normalise(PG.DEF());
  let recName = null;
  const storage = ctx.storage || null;
  const loadWip = () => { try { const t = storage && storage.getItem(LS_WIP); if (t) { const U = PG.unwrap(t); rec = U.rec; recName = U.name; return true; } } catch (e) { console.warn('premises wip:', e.message); } return false; };
  let saveT = 0;
  const autosave = () => { if (!storage) return; clearTimeout(saveT); saveT = setTimeout(() => { try { storage.setItem(LS_WIP, PG.envelope(recName, rec)); } catch (e) {} }, 1000); };

  // ---- undo / redo: commands over the record --------------------------------
  const undoS = [], redoS = [];
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  function applyEntry(layer, id, value) {
    const arr = rec.layers[layer];
    const i = arr.findIndex(e => e.id === id);
    if (value == null) { if (i >= 0) arr.splice(i, 1); }
    else if (i >= 0) arr[i] = value; else arr.push(value);
  }
  function bboxOf(entry) {
    if (!entry) return null;
    if (entry.poly) { const b = PG.polyBBox(entry.poly); const f = +entry.falloff || 0; return { x0: b.x0 - f, z0: b.z0 - f, x1: b.x1 + f, z1: b.z1 + f }; }
    if (entry.pts) { const b = PG.polyBBox(entry.pts); const f = (+entry.falloff || 0) + (+entry.width || 4); return { x0: b.x0 - f, z0: b.z0 - f, x1: b.x1 + f, z1: b.z1 + f }; }
    return null;
  }
  const union = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) });
  function run(cmd, isRedo) {
    applyEntry(cmd.layer, cmd.id, clone(cmd.after));
    undoS.push(cmd); if (!isRedo) redoS.length = 0;
    if (undoS.length > 200) undoS.shift();
    dirty(cmd.layer, union(bboxOf(cmd.before), bboxOf(cmd.after)));
    strip.status('' + cmd.label);
  }
  function undo() { const c = undoS.pop(); if (!c) return; applyEntry(c.layer, c.id, clone(c.before)); redoS.push(c); dirty(c.layer, union(bboxOf(c.before), bboxOf(c.after))); strip.status('undo: ' + c.label); }
  function redo() { const c = redoS.pop(); if (!c) return; run(c, true); }
  // an edit to the selected entry, coalesced per key while the slider moves
  let coalesce = null;
  function edit(id, layer, mutate, label, key) {
    const arr = rec.layers[layer], e = arr.find(x => x.id === id);
    if (!e) return;
    const before = clone(e);
    mutate(e);
    if (key && coalesce && coalesce.id === id && coalesce.key === key && Date.now() - coalesce.t < 600) {
      // fold into the last command: keep its `before`, take the new `after`
      const last = undoS[undoS.length - 1];
      last.after = clone(e); coalesce.t = Date.now();
      dirty(layer, union(bboxOf(before), bboxOf(e)));
      return;
    }
    const cmd = { layer, id, before, after: clone(e), label };
    applyEntry(layer, id, clone(e));   // already mutated in place; keep the arrays canonical
    undoS.push(cmd); redoS.length = 0;
    coalesce = key ? { id, key, t: Date.now() } : null;
    dirty(layer, union(bboxOf(before), bboxOf(e)));
  }

  // ---- the renderer, dirty, the checks, the plaque ---------------------------
  let chkT = 0;
  function dirty(layer, bbox) {
    R.setRecord(rec);
    // terrain moves the ground: rebuild its chunks; the others repaint only
    if (layer === 'terrain' || !layer) R.rebuild(bbox ? { layer, bbox, pad: 2 } : null);
    else R.rebuild({ layer, bbox: { x0: 0, z0: 0, x1: 0, z1: 0 } });   // no chunk touched, outlines + overlay repainted
    inspector.refresh();
    autosave();
    ctx.redraw && ctx.redraw();
    clearTimeout(chkT); chkT = setTimeout(checks, 500);
    plaque();
  }
  function checks() {
    const lines = PG.checks(rec, world);
    const iss = PG.issues(rec);
    if (els.chk) els.chk.innerHTML = lines.map(l => '<span class="' + (l.ok ? 'ok' : 'bad') + '">' + (l.ok ? '✓ ' : '✗ ') + l.label + '</span>').join('<br>') +
      (iss.length ? '<br><span class="warn">' + iss.length + ' issue' + (iss.length > 1 ? 's' : '') + ': ' + iss[0] + '</span>' : '');
    return lines;
  }
  function plaque() {
    if (!els.plaque) return;
    const s = R.stats;
    const n = PG.LAYERS.reduce((a, k) => a + rec.layers[k].length, 0);
    els.plaque.innerHTML = '<b>' + (s.tris || 0).toLocaleString() + '</b> ground tris · ' + (s.chunks || 0) + ' chunks · rebuild ' + (s.ms || 0).toFixed(0) + ' ms (' + (s.rebuilt || 0) + ')<br>' +
      n + ' feature' + (n === 1 ? '' : 's') + ' · undo ' + undoS.length + (ctx.frameText ? '<br>' + ctx.frameText() : '');
  }

  // ---- the layout: rail | (strip over the view) | inspector -------------------
  host.innerHTML = '';
  const rail = $('div', { class: 'pr-rail' });
  const insp = $('div', { class: 'pr-insp' });
  host.appendChild(rail); host.appendChild(insp);
  const strip = { el: els.strip, status(t) { if (statusEl) statusEl.textContent = t; }, help(t) { if (helpEl) helpEl.textContent = t; } };
  let statusEl = null, helpEl = null, toolBtns = {}, drawBtns = null;
  let section = 'terrain', tool = 'select';
  function buildRail() {
    rail.innerHTML = '';
    for (const s of SECTIONS) {
      const b = $('button', { class: 'pr-sec' + (s.k === section ? ' on' : ''), title: s.label }, [$('span', { class: 'ic', text: s.icon }), $('span', { class: 'lb', text: s.label })]);
      b.onclick = () => { setSection(s.k); b.blur(); };
      rail.appendChild(b);
    }
  }
  function buildStrip() {
    if (!els.strip) return;
    els.strip.innerHTML = ''; toolBtns = {};
    const S = SECTIONS.find(s => s.k === section);
    for (const t of S.tools) {
      const b = $('button', { class: 'pr-tool' + (t === tool ? ' on' : ''), text: TOOL_LABEL[t] || t, title: TOOL_HELP[t] || '' });
      b.onclick = () => { setTool(t); b.blur(); };   // keys go to the page, not the button (Enter would re-click it)
      els.strip.appendChild(b); toolBtns[t] = b;
    }
    helpEl = $('span', { class: 'pr-help', text: TOOL_HELP[tool] || '' });
    statusEl = $('span', { class: 'pr-status', text: '' });
    els.strip.appendChild(helpEl); els.strip.appendChild(statusEl);
    // while drawing: a close and a cancel button (a pane or a touch screen has no Enter / Esc)
    drawBtns = $('span', { class: 'pr-draw', style: 'display:none' });
    const ok = $('button', { class: 'pr-tool', text: '✓ close', title: 'close the polygon (Enter)' }); ok.onclick = () => { commitDrawing(); ok.blur(); };
    const no = $('button', { class: 'pr-tool', text: '✕ cancel', title: 'drop the points (Esc)' }); no.onclick = () => { cancelTool(); no.blur(); };
    drawBtns.appendChild(ok); drawBtns.appendChild(no); els.strip.appendChild(drawBtns);
  }
  function setSection(k) { section = k; cancelTool(); tool = 'select'; buildRail(); buildStrip(); inspector.refresh(); }
  function setTool(t) { cancelTool(); tool = t; for (const k in toolBtns) toolBtns[k].classList.toggle('on', k === t); strip.help(TOOL_HELP[t] || ''); if (t !== 'select') select(null); }

  // ---- the tool state machine ----------------------------------------------------
  const T = { state: 'armed', pts: [], kind: null };
  function cancelTool() { T.state = 'armed'; T.pts = []; R.ghost(null); if (drawBtns) drawBtns.style.display = 'none'; ctx.redraw && ctx.redraw(); }
  function ghostFeature() {
    if (!T.pts.length) return null;
    const f = tool === 'grade' ? { pts: T.pts.map(p => [p[0], p[1], 0]), width: 4 } : { poly: T.pts };
    return f;
  }
  function ghostOk() {
    if (tool === 'grade') return T.pts.length >= 2 ? true : 'warn';
    if (T.pts.length < 3) return 'warn';
    return PG.polySimple(T.pts) ? true : false;
  }
  function addPoint(lx, lz) {
    // a double-click's own two clicks land on the last point: ignore a repeat within half a metre
    const L = T.pts[T.pts.length - 1];
    if (L && Math.hypot(L[0] - lx, L[1] - lz) < 0.5) return;
    T.pts.push([lx, lz]);
    T.state = 'drawing';
    if (drawBtns) drawBtns.style.display = '';
    R.ghost(ghostFeature(), ghostOk());
    strip.status(T.pts.length + ' point' + (T.pts.length > 1 ? 's' : '') + (tool === 'grade' ? ' — Enter ends' : ' — Enter or double-click closes'));
    ctx.redraw && ctx.redraw();
  }
  function commitDrawing() {
    if (T.state !== 'drawing') return;
    // drop consecutive repeats and a closing repeat of the first point
    T.pts = T.pts.filter((p, i, A) => i === 0 || Math.hypot(p[0] - A[i - 1][0], p[1] - A[i - 1][1]) >= 0.5);
    if (T.pts.length > 2 && Math.hypot(T.pts[0][0] - T.pts[T.pts.length - 1][0], T.pts[0][1] - T.pts[T.pts.length - 1][1]) < 0.5) T.pts.pop();
    if (tool === 'grade') {
      if (T.pts.length < 2) { strip.status('a road needs two points'); return; }
      const O = R.overlay, F = O.frame;
      const pts = T.pts.map(p => { const w = F.toWorld(p[0], p[1]); return [p[0], p[1], +(world.terrainH(w[0], w[1]) - F.y0).toFixed(2)]; });
      const e = { id: PG.newId(rec, 'terrain'), kind: 'grade', pts, width: 4, crossfall: 0, falloff: 6 };
      run({ layer: 'terrain', id: e.id, before: null, after: e, label: 'grade ' + e.id });
      cancelTool(); select(e.id); return;
    }
    if (T.pts.length < 3) { strip.status('a polygon needs three points'); return; }
    if (!PG.polySimple(T.pts)) { strip.status('refused: the polygon crosses itself'); return; }
    const poly = PG.ensureCCW(T.pts);
    const layer = POLY_TOOLS[tool];
    let e;
    if (tool === 'flatten') {
      // the level a flat wants: the median ground under the polygon, relative to y0
      const F = R.overlay.frame, hs = [];
      const bb = PG.polyBBox(poly);
      for (let i = 0; i < 64; i++) { const lx = bb.x0 + (i % 8 + 0.5) / 8 * (bb.x1 - bb.x0), lz = bb.z0 + (Math.floor(i / 8) + 0.5) / 8 * (bb.z1 - bb.z0); if (PG.inPoly(poly, lx, lz)) { const w = F.toWorld(lx, lz); hs.push(world.terrainH(w[0], w[1]) - F.y0); } }
      hs.sort((a, b) => a - b);
      e = { id: PG.newId(rec, 'terrain'), kind: 'flatten', poly, level: +(hs.length ? hs[hs.length >> 1] : 0).toFixed(2), falloff: 10, abs: false, order: 0 };
    } else if (tool === 'raise') e = { id: PG.newId(rec, 'terrain'), kind: 'raise', poly, dh: 2, falloff: 10 };
    else if (tool === 'ramp') e = { id: PG.newId(rec, 'terrain'), kind: 'ramp', poly, plane: [0.02, 0, 0], falloff: 8 };
    else if (tool === 'surface') e = { id: PG.newId(rec, 'surface'), poly, surface: PG.SURFACE.GRAVEL };
    else if (tool === 'exclude') e = { id: PG.newId(rec, 'exclude'), poly, what: ['trees'] };
    run({ layer, id: e.id, before: null, after: e, label: (e.kind || layer) + ' ' + e.id });
    cancelTool(); select(e.id);
  }

  // ---- selection, handles, dragging -------------------------------------------------
  let selected = null, drag = null;
  function select(id) { selected = id; R.select(id); inspector.refresh(); ctx.redraw && ctx.redraw(); }
  function onDown(ev) {
    if (ev.button !== 0) return false;
    if (tool === 'select' && selected) {
      const h = R.pickHandle(ctx.ray(ev.clientX, ev.clientY));
      if (h) {
        const F = R.overlay.frame, found = PG.findById(rec, selected);
        if (!found) return false;
        const e = found.entry, before = clone(e);
        const arr = e.poly || e.pts;
        if (h.mid) {
          // a midpoint drag inserts a vertex after index i and drags it
          const a = arr[h.index], b = arr[(h.index + 1) % arr.length];
          const nv = e.pts ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] || 0) + (b[2] || 0)) / 2] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          arr.splice(h.index + 1, 0, nv);
          drag = { id: selected, layer: found.layer, index: h.index + 1, before, F };
        } else drag = { id: selected, layer: found.layer, index: h.index, before, F };
        return true;
      }
    }
    return false;
  }
  function onMove(ev) {
    if (!drag) return false;
    const g = ctx.ground(ev.clientX, ev.clientY);
    if (!g) return true;
    const found = PG.findById(rec, drag.id); if (!found) return true;
    const L = drag.F.toLocal(g[0], g[2]);
    const arr = found.entry.poly || found.entry.pts;
    arr[drag.index][0] = +L[0].toFixed(2); arr[drag.index][1] = +L[1].toFixed(2);
    R.setRecord(rec); R.rebuild({ layer: found.layer, bbox: { x0: 0, z0: 0, x1: 0, z1: 0 } });   // outlines follow; the ground on release
    ctx.redraw && ctx.redraw();
    return true;
  }
  function onUp() {
    if (!drag) return false;
    const found = PG.findById(rec, drag.id);
    if (found) {
      const cmd = { layer: found.layer, id: drag.id, before: drag.before, after: clone(found.entry), label: 'move point of ' + drag.id };
      undoS.push(cmd); redoS.length = 0;
      dirty(found.layer, union(bboxOf(drag.before), bboxOf(found.entry)));
    }
    drag = null;
    return true;
  }
  function onClick(ev) {
    const g = ctx.ground(ev.clientX, ev.clientY);
    if (!g) return;
    const F = R.overlay.frame, L = F.toLocal(g[0], g[2]);
    if (tool === 'select') { const h = R.hit(g[0], g[2]); select(h ? h.id : null); return; }
    if (tool === 'probe') {
      const h = R.heightAt(g[0], g[2]);
      const sx = (R.heightAt(g[0] + 1, g[2]) - R.heightAt(g[0] - 1, g[2])) / 2, sz = (R.heightAt(g[0], g[2] + 1) - R.heightAt(g[0], g[2] - 1)) / 2;
      const s = PG.SURFACE_NAMES[R.overlay.surfaceAt(g[0], g[2])] || 'base';
      strip.status('x ' + L[0].toFixed(1) + ' z ' + L[1].toFixed(1) + ' · ' + h.toFixed(2) + ' m (' + (h - F.y0).toFixed(2) + ' over the anchor) · slope ' + (Math.hypot(sx, sz) * 100).toFixed(1) + ' % · ' + s + (R.overlay.excludeAt(g[0], g[2], 'trees') ? ' · no trees' : ''));
      return;
    }
    addPoint(+L[0].toFixed(2), +L[1].toFixed(2));
  }
  function onDblClick() { if (T.state === 'drawing') commitDrawing(); }
  function onKey(ev) {
    if (ev.target && /input|select|textarea/i.test(ev.target.tagName)) return;
    if (ev.key === 'Escape') { if (T.state === 'drawing') cancelTool(); else if (tool !== 'select') setTool('select'); else select(null); ev.preventDefault(); }
    else if (ev.key === 'Enter') { if (T.state === 'drawing') commitDrawing(); }
    else if (ev.key === 'Backspace' && T.state === 'drawing') { T.pts.pop(); if (!T.pts.length) cancelTool(); else { R.ghost(ghostFeature(), ghostOk()); ctx.redraw && ctx.redraw(); } ev.preventDefault(); }
    else if (ev.key === 'Delete' && selected) { const f = PG.findById(rec, selected); if (f) { run({ layer: f.layer, id: selected, before: clone(f.entry), after: null, label: 'delete ' + selected }); select(null); } }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.shiftKey ? redo() : undo(); ev.preventDefault(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { redo(); ev.preventDefault(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { save(recName); ev.preventDefault(); }
    else if (ev.key === 'Tab') { ctx.cameras && ctx.cameras.toggle(); ev.preventDefault(); }
    else if (ev.key >= '1' && ev.key <= String(SECTIONS.length)) setSection(SECTIONS[+ev.key - 1].k);
    else if (ev.key === 'f' && tool === 'select' && ctx.cameras && ctx.cameras.frame) { const f = selected && PG.findById(rec, selected); if (f) ctx.cameras.frame(bboxOf(f.entry)); }
  }

  // ---- the inspector: declared rows for the selected feature ----------------------
  const inspector = { refresh() {
    insp.innerHTML = '';
    if (section === 'file') return fileRows();
    if (section === 'view') return viewRows();
    const f = selected && PG.findById(rec, selected);
    if (!f) {
      rows.section(insp, 'THE PREMISES');
      rows.note(insp, rec.name || '(unnamed)');
      rows.note(insp, PG.LAYERS.filter(k => rec.layers[k].length).map(k => k + ' ' + rec.layers[k].length).join(' · ') || 'nothing yet — pick a tool above and click the ground');
      const feats = [];
      for (const k of ['terrain', 'surface', 'exclude']) for (const e of rec.layers[k]) feats.push([e.id, (e.kind || k) + ' ' + e.id]);
      if (feats.length) rows.select(insp, 'features', feats, () => '', v => select(v));
      return;
    }
    const e = f.entry, id = e.id, layer = f.layer;
    const ed = (mut, label, key) => edit(id, layer, mut, label, key);
    rows.section(insp, (e.kind || layer).toUpperCase() + ' ' + id);
    if (e.kind === 'flatten') {
      rows.slider(insp, 'level (m)', -40, 80, 0.1, () => e.level, v => ed(x => { x.level = v; }, 'level of ' + id, 'level'), v => v.toFixed(1) + ' m');
      rows.check(insp, 'absolute height', () => !!e.abs, v => ed(x => { x.abs = v; }, 'absolute ' + id));
    } else if (e.kind === 'raise') rows.slider(insp, 'lift (m)', -30, 30, 0.1, () => e.dh, v => ed(x => { x.dh = v; }, 'lift of ' + id, 'dh'), v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' m');
    else if (e.kind === 'ramp') {
      rows.slider(insp, 'rise along x (‰)', -150, 150, 1, () => e.plane[0] * 1000, v => ed(x => { x.plane[0] = v / 1000; }, 'plane of ' + id, 'a'), v => v.toFixed(0) + ' ‰');
      rows.slider(insp, 'rise along z (‰)', -150, 150, 1, () => e.plane[1] * 1000, v => ed(x => { x.plane[1] = v / 1000; }, 'plane of ' + id, 'b'), v => v.toFixed(0) + ' ‰');
      rows.slider(insp, 'height at origin', -40, 80, 0.1, () => e.plane[2], v => ed(x => { x.plane[2] = v; }, 'plane of ' + id, 'c'), v => v.toFixed(1) + ' m');
    } else if (e.kind === 'grade') {
      rows.slider(insp, 'width (m)', 2, 30, 0.5, () => e.width, v => ed(x => { x.width = v; }, 'width of ' + id, 'width'), v => v.toFixed(1) + ' m');
      e.pts.forEach((p, i) => rows.slider(insp, 'point ' + (i + 1) + ' height', -40, 80, 0.1, () => p[2] || 0, v => ed(x => { x.pts[i][2] = v; }, 'height of ' + id, 'p' + i), v => v.toFixed(1) + ' m'));
    } else if (layer === 'surface') rows.select(insp, 'surface', PG.SURFACE_NAMES.map((n, i) => [String(i), n.toLowerCase()]), () => String(e.surface), v => ed(x => { x.surface = +v; }, 'surface of ' + id));
    else if (layer === 'exclude') rows.check(insp, 'no trees', () => e.what.indexOf('trees') >= 0, v => ed(x => { x.what = v ? ['trees'] : []; }, 'exclude of ' + id));
    if (layer === 'terrain') rows.slider(insp, 'falloff (m)', 1, 120, 1, () => e.falloff, v => ed(x => { x.falloff = v; }, 'falloff of ' + id, 'falloff'), v => v.toFixed(0) + ' m');
    rows.note(insp, (e.poly ? e.poly.length + ' corners' : e.pts.length + ' points') + ' — drag a disc to move it, a faint one to add a corner');
    rows.button(insp, 'delete ' + id, () => { run({ layer, id, before: clone(e), after: null, label: 'delete ' + id }); select(null); });
  } };
  function fileRows() {
    rows.section(insp, 'FILE');
    const nm = $('input', { type: 'text', placeholder: 'name', value: recName || '' }); nm.className = 'pr-name';
    nm.onchange = () => { recName = nm.value || null; rec.name = rec.name || recName || ''; autosave(); };
    insp.appendChild(nm);
    rows.button(insp, 'new', () => { rec = PG.normalise(PG.DEF()); recName = null; undoS.length = 0; redoS.length = 0; select(null); dirty(null); });
    rows.button(insp, 'save (Ctrl+S)', () => save(recName));
    rows.button(insp, 'export json', () => {
      const txt = PG.envelope(recName, rec);
      const a = document.createElement('a'); a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(txt); a.download = (recName || 'premises') + '.json'; a.click();
    });
    const ta = $('textarea', { placeholder: 'paste an envelope or a bare record here, then import', rows: '4' }); ta.className = 'pr-paste';
    insp.appendChild(ta);
    rows.button(insp, 'import', () => { try { load(ta.value); ta.value = ''; } catch (e) { strip.status('import refused: ' + e.message); } });
    if (storage) {
      const slots = [];
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith('flydiy.premises.slot.')) slots.push(k.slice(21)); }
      if (slots.length) rows.select(insp, 'load slot', slots.map(s => [s, s]), () => '', v => { try { load(storage.getItem('flydiy.premises.slot.' + v)); } catch (e) { strip.status(e.message); } });
    }
    rows.note(insp, 'autosaved to ' + LS_WIP + ' a second after every edit; a load replaces');
  }
  function viewRows() {
    rows.section(insp, 'VIEW');
    if (ctx.cameras) rows.select(insp, 'camera', [['orbit', 'orbit (right-drag)'], ['map', 'map (top-down)']], () => ctx.cameras.mode(), v => ctx.cameras.set(v));
    rows.check(insp, 'surface overlay', () => ctx.overlayOn ? ctx.overlayOn() : true, v => { R.overlayOn(v); ctx.overlayOn && ctx.overlayOn(v); ctx.redraw && ctx.redraw(); });
    if (ctx.rig) {
      rows.section(insp, 'LIGHT');
      rows.slider(insp, 'sun elev', 2, 90, 0.5, () => ctx.rig.get().elev, v => ctx.rig.set({ elev: v }), v => v.toFixed(1) + '°');
      rows.slider(insp, 'sun azimuth', -180, 180, 1, () => ctx.rig.get().azim, v => ctx.rig.set({ azim: v }), v => v.toFixed(0) + '°');
      rows.slider(insp, 'exposure', 0.3, 2.5, 0.02, () => ctx.rig.get().exposure, v => ctx.rig.set({ exposure: v }));
    }
    rows.note(insp, 'Tab toggles the camera; Esc cancels; Del deletes; Ctrl+Z / Ctrl+Y undo and redo; 1-3 pick a section');
  }

  // ---- save / load -----------------------------------------------------------------
  function save(name) {
    if (!storage) return;
    const n = name || recName || 'premises';
    recName = n; rec.name = rec.name || n;
    try { storage.setItem('flydiy.premises.slot.' + n, PG.envelope(n, rec)); storage.setItem(LS_WIP, PG.envelope(n, rec)); strip.status('saved as ' + n); } catch (e) { strip.status('save failed: ' + e.message); }
    if (section === 'file') inspector.refresh();
  }
  function load(txt) {
    const U = PG.unwrap(txt);
    rec = U.rec; recName = U.name; undoS.length = 0; redoS.length = 0;
    select(null); dirty(null);
    strip.status('loaded ' + (recName || '(unnamed)'));
  }

  // ---- wire up ---------------------------------------------------------------------
  const view = ctx.viewEl;
  let downAt = null;
  view.addEventListener('mousedown', ev => { if (ev.button === 0) { downAt = [ev.clientX, ev.clientY]; if (onDown(ev)) ev.stopPropagation(); } });
  addEventListener('mousemove', ev => { onMove(ev); });
  addEventListener('mouseup', ev => { if (onUp()) return; if (ev.button === 0 && downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) < 4 && ev.target === view.querySelector('canvas')) onClick(ev); downAt = null; });
  view.addEventListener('dblclick', ev => { if (ev.button === 0) onDblClick(ev); });
  addEventListener('keydown', onKey);

  if (!ctx.fresh && loadWip()) { /* the working record from last time */ }
  buildRail(); buildStrip();
  R.setRecord(rec); R.rebuild(null); inspector.refresh(); checks(); plaque();

  const handle = {
    record: () => rec, load, save, undo, redo, checks, select, setTool, setSection,
    get tool() { return tool; }, get section() { return section; }, get selected() { return selected; },
    cmd: (name, args) => {
      // scripted authoring: add a feature straight from a record fragment
      if (name === 'add') { const e = Object.assign({ id: PG.newId(rec, args.layer) }, args.entry); run({ layer: args.layer, id: e.id, before: null, after: e, label: 'add ' + e.id }); return e.id; }
      if (name === 'set') { edit(args.id, PG.findById(rec, args.id).layer, x => Object.assign(x, args.patch), 'set ' + args.id); return true; }
      if (name === 'delete') { const f = PG.findById(rec, args.id); if (f) run({ layer: f.layer, id: args.id, before: clone(f.entry), after: null, label: 'delete ' + args.id }); return !!f; }
      if (name === 'point') { addPoint(args.x, args.z); return T.pts.length; }
      if (name === 'commit') { commitDrawing(); return selected; }
      if (name === 'tool') { setTool(args.name); return tool; }
      throw new Error('premises: unknown cmd ' + name);
    },
    plaque, dirty: () => dirty(null),
    close() { R.dispose(); host.innerHTML = ''; },
  };
  return handle;
}

const CSS = `
.pr-rail{display:flex;flex-direction:column;gap:4px;padding:8px 6px;border-right:1px solid var(--grid,#242a33);width:64px;flex:none}
.pr-sec{background:transparent;color:var(--dim,#7d8996);border:1px solid transparent;border-radius:6px;padding:8px 2px;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px}
.pr-sec .ic{font-size:18px} .pr-sec .lb{font-size:9px;letter-spacing:.1em}
.pr-sec.on{color:var(--fg,#dfe6ee);border-color:var(--grid,#242a33);background:#1a1f27}
.pr-insp{overflow-y:auto;padding:10px;width:320px;flex:none;border-left:1px solid var(--grid,#242a33)}
.pr-tool{background:#1a1f27;color:var(--fg,#dfe6ee);border:1px solid var(--grid,#242a33);padding:4px 10px;border-radius:4px;font:inherit;cursor:pointer;margin-right:4px}
.pr-tool.on{border-color:var(--acc,#5db3ff);color:var(--acc,#5db3ff)}
.pr-help{color:var(--dim,#7d8996);margin-left:8px} .pr-status{color:var(--acc,#5db3ff);margin-left:12px}
.pr-name,.pr-paste{width:100%;background:#1a1f27;color:var(--fg,#dfe6ee);border:1px solid var(--grid,#242a33);border-radius:4px;font:inherit;padding:4px 6px;margin:4px 0;box-sizing:border-box}
`;
if (typeof document !== 'undefined') { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

window.PREMISES_UI = { mount, SECTIONS, TOOL_LABEL, TOOL_HELP };
})();
