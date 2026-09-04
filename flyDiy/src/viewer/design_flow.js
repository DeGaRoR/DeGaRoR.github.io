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
// concern: before a starter overwrites hand-tuned work it SAYS HOW MUCH
// ("will overwrite N tuned values — click again"), and the apply is undoable
// as ONE step. There is no undo system anywhere in this project, so the undo
// is local and single-slot: the previous value of every key the starter
// touched, held until the next apply. That is the whole mechanism; a session
// history is somebody else's chantier.
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

// the defaults a starter's overwrite count is measured against — the page's
// own base, the same base the per-part reset uses
function pageBase() {
  try {
    return Object.assign({}, C2().cageDefaults(),
                         (window.CAGE_PAGE && window.CAGE_PAGE.defaults) || {});
  } catch (e) { return {}; }
}

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
// state: the armed starter and the one-slot undo
// ---------------------------------------------------------------------------
let armed = null;          // { rowKey, value, count }
let lastUndo = null;       // { label, cage: {k: prev}, spec: patch-of-prev }
let hostEl = null;         // where the tiles currently live
let birthEl = null;
let inlineHost = null;     // { el, sel } — the tiles sprinkled into STRUCTURE

// WHICH PART A MACRO ROW BELONGS TO (2026-09-04, the user: "sprinkle back the
// controls into the shape section ... I can't find the rod setting when
// clicking on the boom"). Part keys are tools/_cage_parts.js's; a row lists
// every part whose selection should show it. The livery rows are FINISH's
// and are listed nowhere. 'design' (the Design & construction part) shows
// every non-livery row, 'craft' (the root) the identity rows.
const DESIGN_PART = {
  reg: ['craft'], role: ['craft'], class: ['craft'],
  seatLayout: ['cabin', 'fit', 'seats', 'crew'],
  paxCount: ['cabin', 'pax'],
  canopy: ['cabin', 'windscreen', 'pilotWindow', 'skylight'],
  mirror: ['fuselage', 'aftDeck', 'aftCabin', 'cabin'],
  seatType: ['seats', 'fit', 'cockpit'],
  intCons: ['structure', 'fuselage'],
  boomStyle: ['boom', 'tailcone', 'taper', 'fuselage'],
  covering: ['structure', 'fuselage'],
  section: ['fuselage', 'cabin', 'nose'],
  wgPos: ['wings', 'wingPanel'], wgBrace: ['wings', 'struts'],
  wgTip: ['wings', 'wingPanel'], wgFlapType: ['wingCtl', 'wings'],
  engFamily: ['power', 'engine'], engModel: ['engine', 'power'],
  engMount: ['engine', 'power', 'cowl'], engCount: ['power', 'engine'],
  prop: ['prop', 'power'],
  empennage: ['tail', 'fin', 'stab'],
  gearLayout: ['gear', 'mains', 'third'], retract: ['gear'],
  suspension: ['mains', 'gear', 'third'],
  s1Fair: ['wheels', 'mains', 'gear'],
};
function rowsForPart(sel) {
  const d = D();
  return d.DESIGN_ROWS.filter(r => {
    if (sel === 'design') return r.group !== 'livery';
    const pk = DESIGN_PART[r.key];
    return !!pk && pk.indexOf(sel) >= 0;
  });
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

function doApply(label, writes) {
  const cu = CU();
  const prevCage = {};
  for (const k in writes.cage) prevCage[k] = cu.P[k];
  const prevSpec = Object.keys(writes.spec || {}).length
    ? prevOfPatch(writes.spec, curSpec()) : null;
  Object.assign(cu.P, writes.cage);
  cu.syncSliders(); cu.build();
  if (prevSpec) { try { GS().update(writes.spec); } catch (e) {} }
  lastUndo = { label, cage: prevCage, spec: prevSpec };
  armed = null;
}

function undo() {
  if (!lastUndo) return;
  const cu = CU();
  Object.assign(cu.P, lastUndo.cage);
  cu.syncSliders(); cu.build();
  if (lastUndo.spec) { try { GS().update(lastUndo.spec); } catch (e) {} }
  lastUndo = null;
  armed = null;
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
  // the warn/undo contract follows the WRITE, not only the kind: a
  // discriminator whose options overwrite hand-tunable values (the
  // canopy's hood pair) declares `arm` and gets the same two-click gate
  if (row.kind === 'starter' || row.arm) {
    const n = D().designOverwriteCount(CU().P, cage, pageBase());
    if (n > 0 && !(armed && armed.rowKey === row.key &&
                   armed.value === opt.value)) {
      armed = { rowKey: row.key, value: opt.value, count: n };
      refresh();
      return;
    }
  }
  doApply(row.label + ': ' + opt.label, writes);
  refresh();
}

// G132: the seed pill — the explicit "apply the starting values" action a
// label row offers once its label is chosen. Same armed/undo flow as a
// starter, keyed apart so arming a seed never collides with arming a tile.
function pickSeed(row, opt) {
  const writes = D().designSeed(CU().P, row.key, opt.value);
  const n = D().designOverwriteCount(CU().P, writes.cage, pageBase());
  const armKey = row.key + '#seed';
  if (n > 0 && !(armed && armed.rowKey === armKey &&
                 armed.value === opt.value)) {
    armed = { rowKey: armKey, value: opt.value, count: n };
    refresh();
    return;
  }
  doApply(row.label + ' starting values: ' + opt.label, writes);
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
    return { empty: sh.empty, Vs: sh.Vs, TORun: sh.TORun,
             role: spec.meta && spec.meta.role,
             cls: spec.meta && spec.meta.class };
  } catch (e) { return null; }
}

function stripHtml() {
  const n = stripNumbers();
  if (!n) return '';
  const cell = (v, lab) => '<span><b>' + v + '</b> ' + lab + '</span>';
  const num = (v, f, lab) => Number.isFinite(+v) ? cell(f(+v), lab) : '';
  return num(n.empty, v => Math.round(v) + ' kg', 'empty') +
         num(n.Vs, v => Math.round(v * 3.6) + ' km/h', 'stall') +
         num(n.TORun, v => Math.round(v) + ' m', 'take-off') +
         (n.cls ? cell(n.cls, n.role || '') : '');
}

// ---------------------------------------------------------------------------
// the tiles
// ---------------------------------------------------------------------------
function tileGrid(row, cur) {
  const g = document.createElement('div');
  g.className = 'dfGrid';
  for (const opt of D().rowOptions(row)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dfTile';
    if (opt.value === cur) b.classList.add('on');
    if (armed && armed.rowKey === row.key && armed.value === opt.value)
      b.classList.add('arm');
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
    let v = S;
    for (const p of row.specPath) v = v && v[p];
    inp.value = (v == null ? '' : String(v));
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
      const armKey = row.key + '#seed';
      b.textContent = (armed && armed.rowKey === armKey)
        ? 'click again to apply'
        : 'apply the ' + curOpt.label.toLowerCase() +
          ' starting values (once)';
      b.addEventListener('click', () => pickSeed(row, curOpt));
      wrap.appendChild(b);
    }
  }
  return wrap;
}

// the armed / undo line, shared by the grid and the inline tiles
function noteEl() {
  if (armed) {
    const n = document.createElement('div');
    n.className = 'dfNote';
    n.textContent = 'this starter will overwrite ' + armed.count +
      ' tuned value' + (armed.count > 1 ? 's' : '') +
      ' — click the tile again to apply';
    return n;
  }
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
  if (armed) {
    const n = document.createElement('div');
    n.className = 'dfNote';
    n.textContent = 'this starter will overwrite ' + armed.count +
      ' tuned value' + (armed.count > 1 ? 's' : '') +
      ' — click the tile again to apply';
    top.appendChild(n);
  } else if (lastUndo) {
    const n = document.createElement('div');
    n.className = 'dfNote';
    n.innerHTML = '<span></span><button type="button" class="dfPill">undo</button>';
    n.firstChild.textContent = 'applied ' + lastUndo.label + ' ';
    n.lastChild.addEventListener('click', undo);
    top.appendChild(n);
  }
  host.appendChild(top);
  for (const group of D().DESIGN_GROUPS) {
    const rows = D().DESIGN_ROWS.filter(r => r.group === group);
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
    fillInline(inlineHost.el, rowsForPart(inlineHost.sel));
  if (birthEl && birthEl.isConnected) renderBirth();
}

// HOST 1b — the STRUCTURE view, by part (2026-09-04): the macro rows this
// part owns, at the head of its column. Returns whether anything was drawn.
function renderTilesFor(rowsEl, sel) {
  if (!D() || !CU()) return false;
  const rows = rowsForPart(sel);
  if (!rows.length) { inlineHost = null; return false; }
  const wrap = document.createElement('div');
  wrap.className = 'dfWrap dfInline';
  inlineHost = { el: wrap, sel };
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
    // the cowl fits the chosen engine on the birth's first build
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
  for (const r of d.DESIGN_ROWS) {
    if (r.kind === 'field' || r.key === 'engModel') continue;
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
      if (window.CAGE_COWL_FIT_NEXT) window.CAGE_COWL_FIT_NEXT();
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
function maybeAutoOpen() {
  try {
    if (!window.localStorage.getItem('flydiy.wip')) setTimeout(openBirth, 400);
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') maybeAutoOpen();
  else window.addEventListener('load', maybeAutoOpen);
}

window.DESIGN_FLOW = { renderTiles, renderTilesFor, openBirth, closeBirth,
                       bakeBirth, surpriseSel };

})();
