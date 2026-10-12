// DESIGN FLOW — the tile RENDERER over tools/_cage_design.js, and the birth
// flow's viewport host. One component, two hosts (NEW-AIRCRAFT §8.1):
//
//   the PROPERTIES panel   editor.js's render() hands this file #edRows when
//                          `Design & construction` is selected in the SHAPE
//                          view — the same one-line dispatch the FINISH view
//                          rides, so the tiles cost no navigation axis
//   the viewport           openBirth() — a full overlay, used only when there
//                          is nothing on the stand to look at (first launch
//                          with no WIP) or when the fleet's "✚ new aeroplane"
//                          row asks for it
//
// THIS FILE RENDERS AND APPLIES; IT DECLARES NOTHING. Every row, option,
// write and reason is CAGE_DESIGN's (the SHAPE/FINISH argument: two views of
// one declaration, and GATE DESIGN holds the declaration honest).
//
// THE STARTER CONTRACT (§2), implemented here because it is a rendering
// concern: the apply is undoable as ONE step. There is no undo system
// anywhere in this project, so the undo is local and single-slot: the
// previous value of every key the starter touched, held until the next
// apply. That is the whole mechanism; a session history is somebody else's
// chantier.
// ONE CLICK APPLIES (G2760, the user's slider review: "all buttons should
// work the same, click and apply, at once"). The starter used to ARM on the
// first click ("will overwrite N tuned values — click the tile again") and
// apply on the second; the user read the first click as a button that did
// nothing. The warning is gone, the undo pill is what makes a click safe.
//
// TILES IN THE ROWS' SLOTS (G2760): a row declaring `twin` is drawn by the
// editor WHERE ITS ROW WAS (slotBlock), and the row is not drawn — one
// control per choice. `sync()` relights them when P moves under them (a
// load, an undo, a preset), cheaply: a signature per tile, rebuilt only
// when it changed.
//
// A STARTER APPLY NEVER GOES THROUGH applySpec/anchorSize — those mean "this
// is a new design" and would re-anchor the baseline and wipe the changed
// dots (the editor's own reset targets). The starter idiom is the page's:
// Object.assign(P, writes) + syncSliders + build. A BIRTH, by contrast, is
// exactly a new design, and goes through GARAGE_SPEC.set().
'use strict';
(function () {

const D = () => window.CAGE_DESIGN;
const CU = () => window.CAGE_UI;
const GS = () => window.GARAGE_SPEC;
const C2 = () => window.CAGE2;

const curSpec = () => {
  try { return GS() ? GS().get() : null; } catch (e) { return null; }
};

// ---------------------------------------------------------------------------
// svg — icons are {vb, paths:[{d, w?, fill?}]}; stroke styling is ours, so
// every tile reads as one family whatever mix of generated and drawn paths
// it carries
// ---------------------------------------------------------------------------
function svgFor(icon) {
  if (!icon) return '';
  const inner = icon.paths.map(p =>
    '<path d="' + p.d + '" ' +
    (p.fill ? 'fill="' + p.fill + '" stroke="none"'
            : 'fill="none" stroke="currentColor" stroke-width="' +
              (p.w || 1.5) + '" stroke-linejoin="round" stroke-linecap="round"') +
    '/>').join('');
  return '<svg viewBox="' + icon.vb + '" aria-hidden="true">' + inner + '</svg>';
}

// ---------------------------------------------------------------------------
// state: the one-slot undo
// ---------------------------------------------------------------------------
let lastUndo = null;       // { label, cage: {k: prev}, spec: patch-of-prev, rowKey }
// REVIEW 2026-10-04 (B17): the one-slot undo belongs to the build it was taken on; a LOAD
// (CAGE_UI.applySpec fires 'flydiy:specApplied' - a fleet load, a birth, the boot seed) replaces that build, and the
// panel still offered "undo <tile>" that wrote the previous aeroplane's rows into the new one
if (typeof window !== 'undefined') window.addEventListener('flydiy:specApplied', () => {
  if (!lastUndo) return;
  lastUndo = null;
  try { refresh(); } catch (e) {}
});
let hostEl = null;         // where the tiles currently live
let birthEl = null;
let inlineHost = null;     // { el, sel } — the tiles sprinkled into STRUCTURE
let regRefresh = null;     // the registration field's own refresh (B18): the live input's, re-pointed per render
if (typeof window !== 'undefined') {
  const regPoke = () => { if (regRefresh) try { regRefresh(); } catch (e) {} };
  window.addEventListener('flydiy:specApplied', regPoke);
  window.addEventListener('flydiy:specUpdated', regPoke);
}

// WHICH PART A MACRO ROW BELONGS TO (2026-09-04, the user: "sprinkle back the
// controls into the shape section ... I can't find the rod setting when
// clicking on the boom"). Part keys are tools/_cage_parts.js's; a row lists
// every part whose selection should show it. The livery rows are FINISH's
// and are listed nowhere. 'design' (the Design & construction part) shows
// every non-livery row, 'craft' (the root) the identity rows.
// G2760: 'wingPanel' merged into 'wings'; the engine model's list left the
// engine column (the engine row's own preset is that choice, and the list
// "does not work and is redundant" — the user); the two-station fairing
// starter left the gear columns (each station has its own fairing tiles in
// its row's slot now); the cowl presets head the cowl.
const DESIGN_PART = {
  reg: ['craft'], role: ['craft'], class: ['craft'],
  seatLayout: ['cabin', 'fit', 'seats', 'crew'],
  paxCount: ['cabin', 'pax'],
  canopy: ['cabin', 'windscreen', 'pilotWindow', 'skylight'],
  mirror: ['fuselage', 'aftDeck', 'aftCabin', 'cabin'],
  seatType: ['seats', 'fit', 'cockpit'],
  intCons: ['structure', 'fuselage'],
  boomStyle: ['boom', 'tailcone', 'taper', 'fuselage'],
  booms: ['boom', 'tailcone', 'taper', 'fuselage', 'tail'],
  covering: ['structure', 'fuselage'],
  section: ['fuselage', 'cabin', 'nose'],
  wgPos: ['wings', 'cabane'], wgBrace: ['wings', 'struts'],
  planes: ['wings', 'wingPanel2', 'wingPanel', 'interplane', 'wires', 'cabane'],
  wgTip: ['wings'], wgFlapType: ['wingCtl', 'wings'],
  engFamily: ['power', 'engine'],
  engMount: ['engine', 'power', 'cowl'], engCount: ['power', 'engine'],
  prop: ['prop', 'power'],
  empennage: ['tail', 'fin', 'stab'],
  finArch: ['tail', 'fin', 'stab'],
  gearLayout: ['gear', 'mains', 'third'], retract: ['gear'],
  suspension: ['mains', 'gear', 'third'],
  cowlPreset: ['cowl'],
};
// `skip`: the rows the editor has already drawn in their twins' slots in
// this column — a tile is drawn once
function rowsForPart(sel, skip) {
  const d = D(), P = CU() && CU().P;
  return d.DESIGN_ROWS.filter(r => {
    if (r.slot || (skip && skip.has(r.key))) return false;
    if (r.when && P) { try { if (!r.when(P)) return false; } catch (e) {} }
    if (sel === 'design') return r.group !== 'livery' && r.grid !== false;
    const pk = DESIGN_PART[r.key];
    return !!pk && pk.indexOf(sel) >= 0;
  });
}

// which tiles ARE a panel row (`twin`), by the row's key — built once, the
// table never changes at runtime
let twinMap = null;
function twinsOf(k) {
  if (!D()) return null;
  if (!twinMap) {
    twinMap = new Map();
    for (const r of D().DESIGN_ROWS)
      if (r.status === 'live')
        for (const t of (r.twin || [])) {
          if (!twinMap.has(t)) twinMap.set(t, []);
          twinMap.get(t).push(r);
        }
  }
  return twinMap.get(k) || null;
}

// previous values at a spec patch's own paths, for the undo — absent reads
// as null on purpose: GARAGE_SPEC.update round-trips through JSON and would
// drop an undefined, leaving the path un-restored
function prevOfPatch(patch, node) {
  const out = {};
  for (const k in patch) {
    const cur = node && typeof node === 'object' ? node[k] : undefined;
    if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]))
      out[k] = prevOfPatch(patch[k], cur);
    else out[k] = cur === undefined ? null : cur;
  }
  return out;
}

// `after` (G2760): a door into a layer that writes the rest on the next
// build (the cowl presets size to the fitted engine) — so the undo cannot
// know the keys in advance and takes the WHOLE panel instead
function doApply(label, writes, rowKey, after) {
  const cu = CU();
  const prevCage = after ? Object.assign({}, cu.P) : {};
  for (const k in writes.cage) prevCage[k] = cu.P[k];
  const prevSpec = Object.keys(writes.spec || {}).length
    ? prevOfPatch(writes.spec, curSpec()) : null;
  Object.assign(cu.P, writes.cage);
  if (after) { try { after(); } catch (e) { console.error('tile after:', e); } }
  cu.syncSliders(); cu.build();
  if (prevSpec) { try { GS().update(writes.spec); } catch (e) {} }
  lastUndo = { label, cage: prevCage, spec: prevSpec, rowKey: rowKey || null };
}

function undo() {
  if (!lastUndo) return;
  const cu = CU();
  Object.assign(cu.P, lastUndo.cage);
  cu.syncSliders(); cu.build();
  if (lastUndo.spec) { try { GS().update(lastUndo.spec); } catch (e) {} }
  lastUndo = null;
  refresh();
}

function pick(row, opt) {
  if (opt.inactive) return;
  // G132: THE PANEL APPLIES THE LIVE WRITES ALONE (seeds:false) — a role or
  // class pick is its label, instantly and non-destructively; the one-shot
  // starting values ride the seed pill below, and the birth flow, which
  // compose with seeds:true.
  const { cage, spec } = D().designApply(CU().P, { [row.key]: opt.value },
                                         { seeds: false });
  const writes = { cage, spec };
  // G2760: ONE CLICK (see the head note) — the starter's arm, and the
  // `arm` discriminators' (the canopy's hood pair), are gone; the undo stays
  doApply(row.label + ': ' + opt.label, writes, row.key, opt.after);
  refresh();
}

// G132: the seed pill — the explicit "apply the starting values" action a
// label row offers once its label is chosen. One click and the undo, as a
// tile (G2760).
function pickSeed(row, opt) {
  const writes = D().designSeed(CU().P, row.key, opt.value);
  doApply(row.label + ' starting values: ' + opt.label, writes, row.key);
  refresh();
}

// ---------------------------------------------------------------------------
// the pre-plaque strip (§8.4, as decided with the user 2026-08-31): a
// three-number readout INSIDE the component, never the plaque — THE PLAQUE
// IS EARNED (app.js) and stays bench-gated. Compute-only: the join is READ,
// nothing is committed ("the export is not a button" keeps its ruling).
// ---------------------------------------------------------------------------
function stripNumbers() {
  try {
    if (typeof buildGen !== 'function' || typeof genShakedown !== 'function')
      return null;
    let spec = curSpec();
    if (!spec) return null;
    if (window.CAGE_JOIN && window.CAGE_JOIN.export)
      spec = D().designMerge(spec, window.CAGE_JOIN.export());
    // the strip wants a mass and two speeds — not the four loading corners
    const sh = genShakedown(buildGen(spec), { ledger: true, corners: false });
    return { empty: sh.empty, Vs: sh.Vs, TORun: sh.TORun };
  } catch (e) { return null; }
}

function stripHtml() {
  const n = stripNumbers();
  if (!n) return '';
  const cell = (v, lab) => '<span><b>' + v + '</b> ' + lab + '</span>';
  const num = (v, f, lab) => Number.isFinite(+v) ? cell(f(+v), lab) : '';
  return num(n.empty, v => Math.round(v) + ' kg', 'empty') +
         num(n.Vs, v => Math.round(v * 3.6) + ' km/h', 'stall') +
         num(n.TORun, v => Math.round(v) + ' m', 'take-off');
}

// ---------------------------------------------------------------------------
// the tiles
// ---------------------------------------------------------------------------
function tileGrid(row, cur) {
  const g = document.createElement('div');
  g.className = 'dfGrid';
  const P = CU() && CU().P;
  for (const opt of D().rowOptions(row)) {
    // an option that means nothing in this state stays off the grid, unless
    // it is what the aeroplane holds (a saved value is never hidden)
    if (opt.hide && opt.value !== cur && P) {
      try { if (opt.hide(P)) continue; } catch (e) {}
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dfTile';
    if (opt.value === cur) b.classList.add('on');
    if (opt.inactive) { b.disabled = true; b.title = opt.inactive; }
    else if (opt.note) b.title = opt.note;
    b.innerHTML = svgFor(opt.icon) + '<span>' + opt.label + '</span>';
    b.addEventListener('click', () => pick(row, opt));
    g.appendChild(b);
  }
  return g;
}

function rowBlock(row) {
  const wrap = document.createElement('div');
  wrap.className = 'dfRow';
  const cu = CU(), S = curSpec();
  let cur = null;
  try { if (row.read) cur = row.read(cu.P, S); } catch (e) {}
  // G132: an `once` row's read is LOSSY (its own declaration says so) —
  // lighting a tile off it would claim a current state the sliders can
  // contradict, so nothing lights and the header says what the tiles are
  if (row.once) cur = null;
  const h = document.createElement('div');
  h.className = 'dfRowH';
  h.innerHTML = '<span></span><em></em>';
  h.firstChild.textContent = row.label;
  h.lastChild.textContent = (row.help || '') +
    (row.once && !row.plain ? (row.help ? ' — ' : '') + 'applies once' : '');
  wrap.appendChild(h);

  if (row.kind === 'field') {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'dfField';
    inp.maxLength = row.maxLen || 12;
    // G334: the field reads the spec — when built, when the spec is applied
    // (the finish panel's registration commits there too), and on focus —
    // so the two registration inputs cannot disagree
    const readSpec = () => {
      let v = null;
      try { v = GS() ? GS().get() : S; for (const p of row.specPath) v = v && v[p]; } catch (e) { v = null; }
      return v == null ? '' : String(v);
    };
    inp.value = readSpec();
    const refresh = () => { if (document.activeElement !== inp) inp.value = readSpec(); };
    // REVIEW 2026-10-04 (B18): one pair of window listeners for the module, re-pointed at the live input - a pair was
    // added on every render of this row (every refresh, every tile render) and never removed
    regRefresh = refresh;
    inp.addEventListener('focus', refresh);
    inp.addEventListener('change', () => {
      const patch = {};
      let node = patch;
      for (let i = 0; i < row.specPath.length - 1; i++)
        node = node[row.specPath[i]] = {};
      node[row.specPath[row.specPath.length - 1]] = inp.value.trim();
      try { GS().update(patch); } catch (e) {}
    });
    wrap.appendChild(inp);
    return wrap;
  }

  if (row.plain) {
    // the list rendering (the engine models): a select, filtered by the
    // family row's own current value, so level 2 reads as seven names and
    // not eighteen
    const sel = document.createElement('select');
    sel.className = 'dfList';
    const famRow = D().rowByKey.engFamily;
    let fam = null;
    try { fam = famRow.read(cu.P, S); } catch (e) {}
    const opts = D().rowOptions(row)
      .filter(o => !fam || !o.family || o.family === fam);
    const o0 = document.createElement('option');
    o0.value = ''; o0.textContent = '— pick a model (applies once) —';
    sel.appendChild(o0);
    for (const o of opts) {
      const el = document.createElement('option');
      el.value = String(o.value); el.textContent = o.label;
      sel.appendChild(el);
    }
    if (!opts.length) {
      o0.textContent = '— no ' + (fam || '') + ' model yet — the bench ' +
        'builds one from bore & stroke —';
    }
    sel.addEventListener('change', () => {
      const o = D().optionOf(row.key, sel.value);
      if (o) pick(row, o);
      sel.value = '';
    });
    wrap.appendChild(sel);
    return wrap;
  }

  wrap.appendChild(tileGrid(row, cur));
  // G132: the seed pill — shown when the CURRENT label carries starting
  // values. The count is live, so "would change nothing" renders as
  // nothing to do and the pill stays away.
  const curOpt = cur != null
    ? D().rowOptions(row).find(o => o.value === cur) : null;
  if (curOpt && curOpt.seed) {
    // the pill SHOWS when the seed would change anything at all;
    // pickSeed then ARMS only over tuned values (the starter contract)
    let n = 0;
    try {
      const sw = D().designSeed(cu.P, row.key, curOpt.value);
      for (const k in sw.cage)
        if (Math.abs((+cu.P[k]) - (+sw.cage[k])) >
            Math.max(1e-9, Math.abs(+sw.cage[k]) * 1e-6)) n++;
      if (sw.spec && Object.keys(sw.spec).length) n++;
    } catch (e) {}
    if (n > 0) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dfPill dfSeed';
      b.textContent = 'apply the ' + curOpt.label.toLowerCase() +
        ' starting values';
      b.addEventListener('click', () => pickSeed(row, curOpt));
      wrap.appendChild(b);
    }
  }
  return wrap;
}

// the undo line, shared by the grid and the inline tiles
function noteEl() {
  if (lastUndo) {
    const n = document.createElement('div');
    n.className = 'dfNote';
    n.innerHTML = '<span></span><button type="button" class="dfPill">undo</button>';
    n.firstChild.textContent = 'applied ' + lastUndo.label + ' ';
    n.lastChild.addEventListener('click', undo);
    return n;
  }
  return null;
}

function fillInline(wrap, rows) {
  wrap.innerHTML = '';
  const n = noteEl();
  if (n) wrap.appendChild(n);
  for (const r of rows) wrap.appendChild(rowBlock(r));
  wrap._dfSig = sigOf(rows);
}

// WHAT A TILE BLOCK SHOWS, as a string: the lit value of every row whose
// read is P's alone (a read that wants the spec waits for a pick — a spec
// fetch per drag tick is not a price worth a relight), each hidden option,
// and the undo line. Equal signatures, nothing to redraw.
// the options that can hide, per row, found ONCE: this runs on every drag
// tick, and a lazy row's options() draws its icons afresh on every call
const hideCache = new WeakMap();
const hidersOf = r => {
  if (!hideCache.has(r))
    hideCache.set(r, (D().rowOptions(r) || []).filter(o => o.hide));
  return hideCache.get(r);
};
function sigOf(rows) {
  const P = CU() && CU().P;
  if (!P) return '';
  let s = (lastUndo ? lastUndo.label : '') + '#';
  for (const r of rows) {
    if (typeof r.read === 'function' && r.read.length < 2 && !r.once) {
      try { s += r.key + '=' + r.read(P) + ';'; } catch (e) { s += r.key + '!;'; }
    }
    if (r.when) { try { s += r.when(P) ? '+' : '-'; } catch (e) {} }
    for (const o of hidersOf(r)) { try { s += o.hide(P) ? 'h' : 'v'; } catch (e) {} }
  }
  return s;
}

// A TILE IN ITS ROW'S SLOT (G2760). One stable element per tile per render
// of the column (editor.js keeps it as the row's stand-in for visibility and
// the changed dot); its content is redrawn in place. The undo line rides in
// the block it belongs to.
let slots = [];
function slotSig(row) {
  return sigOf([row]) + (lastUndo && lastUndo.rowKey === row.key ? 'u' : '');
}
function slotFill(el, row) {
  el.innerHTML = '';
  if (lastUndo && lastUndo.rowKey === row.key) {
    const n = noteEl();
    if (n) el.appendChild(n);
  }
  el.appendChild(rowBlock(row));
  el._dfSig = slotSig(row);
}
function slotBlock(row) {
  const el = document.createElement('div');
  el.className = 'dfWrap dfInline dfSlot';
  el.dataset.tile = row.key;
  slotFill(el, row);
  slots.push({ el, row });
  return el;
}
function slotReset() { slots = []; }
// called by the editor at the end of every visibility pass
function sync() {
  for (const s of slots)
    if (s.el.isConnected && slotSig(s.row) !== s.el._dfSig) slotFill(s.el, s.row);
  if (inlineHost && inlineHost.el.isConnected) {
    const rows = rowsForPart(inlineHost.sel, inlineHost.skip);
    if (sigOf(rows) !== inlineHost.el._dfSig) fillInline(inlineHost.el, rows);
  }
}

function buildInto(host, opts) {
  host.innerHTML = '';
  const top = document.createElement('div');
  top.className = 'dfTop';
  // the grid is the Custom-build window (2026-09-04): it says how to leave
  if (!(opts && opts.birth) && window.EDITOR_SET_VIEW) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dfPill dfBack';
    b.textContent = '‹ back to structure';
    b.addEventListener('click', () => window.EDITOR_SET_VIEW('shape'));
    top.appendChild(b);
  }
  const strip = stripHtml();
  if (strip) top.insertAdjacentHTML('beforeend', '<div class="dfStrip">' + strip + '</div>');
  const note = noteEl();
  if (note) top.appendChild(note);
  host.appendChild(top);
  for (const group of D().DESIGN_GROUPS) {
    // G2760: a part's slot tiles and the head-only tiles are not birth choices
    const rows = D().DESIGN_ROWS.filter(r => r.group === group &&
                                             !r.slot && r.grid !== false);
    if (!rows.length) continue;
    const gh = document.createElement('div');
    gh.className = 'dfGroupH';
    gh.textContent = group;
    host.appendChild(gh);
    for (const r of rows) host.appendChild(rowBlock(r));
  }
  if (opts && opts.birth) host.appendChild(birthFooter());
}

function refresh() {
  if (hostEl && hostEl.isConnected) buildInto(hostEl, hostEl._dfOpts);
  if (inlineHost && inlineHost.el.isConnected)
    fillInline(inlineHost.el, rowsForPart(inlineHost.sel, inlineHost.skip));
  for (const s of slots) if (s.el.isConnected) slotFill(s.el, s.row);
  if (birthEl && birthEl.isConnected) renderBirth();
}

// HOST 1b — the STRUCTURE view, by part (2026-09-04): the macro rows this
// part owns, at the head of its column. Returns whether anything was drawn.
// `skip` (G2760): the rows already drawn in their twins' slots
function renderTilesFor(rowsEl, sel, skip) {
  if (!D() || !CU()) return false;
  const rows = rowsForPart(sel, skip);
  if (!rows.length) { inlineHost = null; return false; }
  const wrap = document.createElement('div');
  wrap.className = 'dfWrap dfInline';
  inlineHost = { el: wrap, sel, skip };
  fillInline(wrap, rows);
  rowsEl.appendChild(wrap);
  return true;
}

// ---------------------------------------------------------------------------
// HOST 1 — the properties panel. editor.js hands us #edRows; we build ONE
// wrapper element into it (parked and re-appended like any panel element).
// Returns true so the dispatch knows the selection is handled.
// ---------------------------------------------------------------------------
let panelWrap = null;
function renderTiles(rowsEl) {
  if (!D() || !CU()) return false;
  if (!panelWrap) {
    panelWrap = document.createElement('div');
    panelWrap.className = 'dfWrap';
  }
  hostEl = panelWrap;
  hostEl._dfOpts = null;
  buildInto(panelWrap, null);
  rowsEl.appendChild(panelWrap);
  return true;
}

// ---------------------------------------------------------------------------
// HOST 2 — the birth flow. A full overlay; the ONE allowed exception to "no
// new surface", because on a fresh boot there is nothing on the stand to
// look at (§3). It opens with the ARCHETYPES — the named canonical builds —
// plus Surprise me; picking one bakes a FRESH cage (the STOCK recipe:
// template + page defaults + the selection) and hands it to
// GARAGE_SPEC.set(), which is the one route a new design has ever entered by.
// ---------------------------------------------------------------------------
// the whole recipe lives in the DECLARATION (designBake) so this overlay and
// GATE ARCHETYPES compose the identical spec — one code path, per §7
function bakeBirth(sel, over) { return D().designBake(sel, over); }

function birthApply(arch) {
  try {
    const spec = bakeBirth(arch.sel, arch.over);
    // A BIRTH IS THE ONE LOAD THAT WANTS THE COWL FIT (2026-09-05): the cowl
    // starter is silent on a load, so the card asks once through the cowl
    // layer's door — answered only for a STYLED architecture (radial, turbine)
    if (window.CAGE_COWL_FIT_NEXT) window.CAGE_COWL_FIT_NEXT();
    GS().set(spec);
    closeBirth();
  } catch (e) {
    console.error('birth:', e);
  }
}

function surpriseSel() {
  const d = D();
  const sel = {};
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  // G292: the birth rows first — a surprise without a class is born at
  // the stock size whatever else it rolls
  for (const r of (d.BIRTH_ROWS || []).concat(d.DESIGN_ROWS)) {
    if (r.kind === 'field' || r.key === 'engModel' || r.slot || r.grid === false) continue;
    const live = d.rowOptions(r).filter(o => !o.inactive);
    if (live.length) sel[r.key] = rnd(live).value;
  }
  // the model follows the family it landed on, never fights it
  const models = d.designEngineModels()
    .filter(o => o.family === sel.engFamily);
  if (models.length) sel.engModel = rnd(models).value;
  return sel;
}

function renderBirth() {
  const d = D();
  const box = birthEl.querySelector('.dfBirthBox');
  const grid = box.querySelector('.dfArchGrid');
  grid.innerHTML = '';
  // CUSTOM BUILD, FIRST AND LIT (2026-09-04, the user): a fresh stock
  // aeroplane on the stand and the design grid beside it — the tiles in the
  // properties column, the aeroplane in the viewport, no overlay
  {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'dfArch dfCustom';
    const eab = d.optionOf('class', 'eab');
    c.innerHTML = svgFor(eab && eab.icon) + '<b></b><span></span>';
    c.querySelector('b').textContent = 'Custom build';
    c.querySelector('span').textContent =
      'choose every macro yourself — the design tiles, beside the aeroplane';
    c.addEventListener('click', () => {
      try { GS().set(bakeBirth({})); } catch (e) { console.error('custom:', e); }
      closeBirth();
      if (window.EDITOR_SET_VIEW) window.EDITOR_SET_VIEW('design');
    });
    grid.appendChild(c);
  }
  const kinds = [['recreation', 'recreations — after a real aeroplane'],
                 ['fiction', 'fictional — the shed\'s own']];
  for (const [kind, title] of kinds) {
    const list = d.ARCHETYPES.filter(a => (a.kind || 'fiction') === kind);
    if (!list.length) continue;
    const h = document.createElement('div');
    h.className = 'dfKindH';
    h.textContent = title;
    grid.appendChild(h);
  for (const a of list) {
    const reason = d.archInactive(a);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dfArch' + (kind === 'recreation' ? ' dfReal' : '');
    const clsOpt = d.optionOf('class', a.sel['class']);
    // the card wears ITS OWN aeroplane (2026-09-04, "the pusher does not push")
    const icon = a.icon || (d.archIcon ? d.archIcon(a) : null) ||
                 (clsOpt && clsOpt.icon);
    b.innerHTML = svgFor(icon) +
      '<b></b><span></span>';
    b.querySelector('b').textContent = a.name;
    b.querySelector('span').textContent = a.note || '';
    if (reason) { b.disabled = true; b.title = reason; }
    else b.addEventListener('click', () => birthApply(a));
    grid.appendChild(b);
  }
  }
}

function birthFooter() {
  const f = document.createElement('div');
  f.className = 'dfBirthFoot';
  return f;
}

function openBirth() {
  if (!D() || !GS() || !C2()) return;
  if (!birthEl) {
    birthEl = document.createElement('div');
    birthEl.id = 'dfBirth';
    birthEl.innerHTML =
      '<div class="dfBirthBox">' +
      '<div class="dfBirthH"><span>NEW AEROPLANE</span>' +
      '<button type="button" class="dfPill dfClose">keep the current build</button></div>' +
      '<div class="dfBirthSub">start from an archetype — every value stays ' +
      'yours to change; a greyed card names what the shed cannot build yet</div>' +
      '<div class="dfArchGrid"></div>' +
      '<div class="dfBirthRow">' +
      '<button type="button" class="dfPill dfLucky">surprise me</button>' +
      '<span class="dfWarn"></span></div>' +
      '</div>';
    birthEl.querySelector('.dfClose')
      .addEventListener('click', closeBirth);
    birthEl.querySelector('.dfLucky').addEventListener('click', () => {
      try { GS().set(bakeBirth(surpriseSel())); closeBirth(); }
      catch (e) { console.error('surprise:', e); }
    });
    document.body.appendChild(birthEl);
  }
  // starting over an UNSAVED build is the one destructive door in the flow,
  // and it says so before it is walked through — a named build is already on
  // its slot and loses nothing
  const w = birthEl.querySelector('.dfWarn');
  try {
    w.textContent = GS().name() ? ''
      : 'applying replaces the unsaved build on the stand';
  } catch (e) { w.textContent = ''; }
  birthEl.hidden = false;
  renderBirth();
}

function closeBirth() {
  if (birthEl) birthEl.hidden = true;
}

// FIRST LAUNCH with nothing on the stand (no WIP ever written): the flow IS
// the front door. Deliberately one narrow trigger — any saved session, named
// or not, boots into its own build exactly as before.
// ...and AFTER the loading screen has lifted (LOADING S1): the door opens
// onto a finished shed, never under or over the overlay (window.FLYDIY_READY
// is the boot's promise; a page without one - a bench - opens as before).
function maybeAutoOpen() {
  try {
    if (window.localStorage.getItem('flydiy.wip')) return;
    const ready = (window.FLYDIY_READY && typeof window.FLYDIY_READY.then === 'function') ? window.FLYDIY_READY : Promise.resolve();
    ready.then(() => setTimeout(openBirth, 400));
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') maybeAutoOpen();
  else window.addEventListener('load', maybeAutoOpen);
}

window.DESIGN_FLOW = { renderTiles, renderTilesFor, openBirth, closeBirth,
                       bakeBirth, surpriseSel,
                       twinsOf, slotBlock, slotReset, sync };

})();
