// premises_ui.js — THE PREMISES EDITOR, THE MODULE (G353 / GPREM; the bench's tools/_premises_ui.js, ported whole at G387; the design:
// futureDesigns/PREMISES-EDITOR-2026-09-13.md). One editor, two hosts: the
// bench page today (tools/_premises.html), the game's WORLD rail entry at the
// port (src/viewer/premises_ui.js). It writes RECORDS ONLY — every visual is
// the renderer's rebuild from the record (tools/render_premises.js), every
// height the core's composition (src/core/27_premises.js). No tool touches
// terrain, trees or meshes.
//
//   PREMISES_UI.mount(host, ctx) -> handle
//     host   the element the rail and the inspector are built in
//     ctx = { THREE, world, R (RENDER_PREMISES), camera(), ground(clientX, clientY) -> [x, y, z] | null,
//             ray(clientX, clientY) -> THREE.Ray, cameras { mode(), set(m), toggle(), frame(bbox) },
//             rows { slider, select, check, note, section, button }, els { chk, plaque, strip },
//             viewEl, storage, rig { get, set } | null, redraw(), frameText(), pool() -> tree species, fresh }
//     handle = { record(), load(txt), save(name), cmd(name, args), select(id), setTool(name),
//                setSection(k), undo(), redo(), checks(), close() }
//
// v1 — TERRAIN (flatten / raise / ramp / surface / probe), ROADS (trace a road:
// graded, worn, a surface strip; the plots grow off it), ZONES (a polygon
// with a kind, a density, a seed; the sower fills it with plots and the
// house generator stands a house on each), VEGETATION (a forest polygon, a
// no-trees polygon, a tree by hand), FILE, VIEW. The tool state machine, the
// ghost with its validity colour (red refuses), vertex and midpoint handles,
// the inspector's declared rows, undo/redo as a command stack over the
// record, autosave, the #chk panel mirroring GATE PREMISES.
(function () {
'use strict';
if (typeof window === 'undefined') return;
const PG = window.PREMISES_GEN;

const SECTIONS = [
  { k: 'terrain',    label: 'TERRAIN',    icon: '⛰', tools: ['select', 'flatten', 'raise', 'ramp', 'surface', 'material', 'probe'] },
  { k: 'airfield',   label: 'AIRFIELD',   icon: '✈',  tools: ['select', 'runway', 'apron', 'stand', 'probe'] },
  { k: 'roads',      label: 'ROADS',      icon: '⌇',  tools: ['select', 'road', 'probe'] },
  { k: 'zones',      label: 'ZONES',      icon: '▦',  tools: ['select', 'zone', 'probe'] },
  { k: 'vegetation', label: 'TREES',      icon: '♣',  tools: ['select', 'forest', 'clear', 'tree', 'probe'] },
  { k: 'sites',      label: 'SITES',      icon: '⌂',  tools: ['select', 'building', 'theme', 'cable', 'probe'] },
  { k: 'objects',    label: 'OBJECTS',    icon: '⚑',  tools: ['select', 'prop', 'billboard', 'aircraft', 'animal', 'probe'] },
  { k: 'file',       label: 'FILE',       icon: '▤',  tools: [] },
  { k: 'view',       label: 'VIEW',       icon: '◎',  tools: [] },
  { k: 'life',       label: 'LIFE',       icon: '☺',  tools: [] },   // SCENERY LIFE: the record's life block (last: the 1-9 keys keep their sections)
];
// the sections' icons in the flight ribbon's own grammar (18 x 18, stroked paths, '|' between them)
const ICONS = {
  terrain: 'M2 14.5l4.5-7.5 3 4.5 2-3 4.5 6Z|M2 14.5h14',
  airfield: 'M4.5 16L8 2|M10 2l3.5 14|M9 6v1.5|M9 9.5V11|M9 13v1.5',
  roads: 'M3 15.5c3-5 9-3 12-8.5|M3 11.5c3-5 9-3 12-8.5|M7 12.5l.6-1|M10 8.5l.6-1',
  zones: 'M3 3h12v12H3Z|M3 9h12|M9 3v12',
  vegetation: 'M9 2l5 8h-3l3 5H4l3-5H4Z|M9 15v1.5',
  sites: 'M3 9l6-6 6 6|M5 8v7h8V8|M8 15v-4h2v4',
  objects: 'M5 16V2|M5 3h9l-2 3 2 3H5',
  file: 'M5 2h6l3 3v11H5Z|M11 2v3h3|M7 9h4|M7 12h4',
  view: 'M2 9s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5Z|M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  life: 'M7 5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z|M4.5 16l1.3-6.2L7 7.2l1.4 2.4L9.5 16|M4 10.5l3-3.3 3 3.3|M13 16V9.5|M11.5 9.5h3l.4-2.5h-3.8Z',
};
const iconSvg = k => { const d = ICONS[k]; if (!d) return null; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 18 18'); svg.setAttribute('aria-hidden', 'true'); for (const q of d.split('|')) { const pth = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pth.setAttribute('d', q); svg.appendChild(pth); } return svg; };
const TOOL_LABEL = { select: 'select', flatten: 'flatten', raise: 'raise / lower', ramp: 'slope', material: 'material', road: 'trace a road', surface: 'surface', zone: 'zone', forest: 'forest', clear: 'no trees', tree: 'a tree', runway: 'runway', apron: 'apron / taxiway', stand: 'the stand', building: 'a building', theme: 'the mine (theme)', cable: 'a cable', prop: 'a prop', billboard: 'a billboard', aircraft: 'an aeroplane', animal: 'animals', probe: 'probe' };
const TOOL_HELP = {
  select: 'click a feature to select it; drag its discs; Ctrl+click adds a corner after the last, Ctrl+click a disc removes it; Del deletes',
  flatten: 'click the corners of the flat, then ✓ close (or double-click)',
  raise: 'click the corners, close; then set the lift in the inspector',
  ramp: 'click the corners, close: a constant slope, the middle at the height you set, rising toward the heading you set',
  road: 'click the road\'s points, then ✓ close (or double-click) — it is graded and worn; zones grow plots off it',
  surface: 'click the corners of the paved / gravel / sand patch, close',
  zone: 'click the corners of the zone, close; its kind, density and seed are in the inspector — plots grow along the roads inside it',
  forest: 'click the corners of the wood, close; density and species in the inspector',
  clear: 'click the corners where no tree may grow, close',
  tree: 'click the ground to plant one tree; its species and size in the inspector',
  probe: 'click the ground to read its height, slope and surface',
  runway: 'click one end of the strip, then the other — it is graded to its profile, its class reaches the wheels, the pattern is derived',
  apron: 'click the corners of the paved apron or taxiway, close',
  material: 'click the corners, close: a PBR set projected on the ground inside, its contour fading over the metres you set; a higher priority paints over a lower',
  stand: 'click the ground beside a strip: the aeroplane stands there, its way out a straight taxi to the centreline; drag the discs, add taxi points in the inspector',
  building: 'pick a building in the inspector, click the ground to stand it there (its own site); drag its disc to move it',
  theme: 'click the ground: the Kennecott theme stands there as ONE site - the mill, the shop, the row, the receiving shed, the conveyor link and the gravel yard',
  cable: 'click a tram station, then the other: the line is solved between them (the village\'s tramLine, once its branch lands) and the ropes drawn',
  prop: 'pick a prop in the inspector, click the ground to stand it there (on the ground, tilted to it); drag its disc to move it',
  billboard: 'pick a painted sign in the inspector, click the verge to stand it on its posts; turn it in the inspector',
  aircraft: 'pick a build in the inspector (an archetype, a stock design, one of yours), click the apron to park it there, nose along its turn; captured through the workshop, so a moment to stand',
  animal: 'pick a species in the inspector and click the ground (or the water, for a whale): ONE record is a HOTSPOT - how many live there and over what radius. The land animals wander between idle bouts, a pod swims a circuit and dives, a flock circles. Drag the disc to move the lot.',
};
const POLY_TOOLS = { flatten: 'terrain', raise: 'terrain', ramp: 'terrain', surface: 'surface', apron: 'surface', material: 'material', zone: 'zones', forest: 'zones', clear: 'zones' };
// the PBR sets the page has (the lot's and the site's texture sets), read at call time - a name each
function materialSets() {
  const S = Object.assign({}, (typeof LOT_TEX_SETS !== 'undefined' && LOT_TEX_SETS) || {}, (typeof SITE_TEX_SETS !== 'undefined' && SITE_TEX_SETS) || {});
  return Object.keys(S).filter(k => S[k] && S[k].diff).map(k => [k, (S[k].name || k) + ' · ' + S[k].tile + ' m']);
}
const TWO_POINT_TOOLS = { runway: 'runways' };
const LINE_TOOLS = { road: 'roads' };
const POINT_TOOLS = { tree: 'objects', building: 'sites', theme: 'sites', prop: 'objects', billboard: 'objects', aircraft: 'objects', animal: 'objects' };
const OBJ_PICK = { prop: null, billboard: null, aircraft: null, animal: null };   // what the prop, billboard, aircraft and animal tools stand
let PALETTE_KEY = null;   // the building the 'building' tool stands
let SITE_THEME = null;    // the site theme the 'theme' tool stands (VILLAGE_GEN.THEMES; G393.3)
let PALETTE_CAT = null;   // the category the palette shows (v9)
let ITEM_FOCUS = null;    // the site item whose rows are open in the inspector (G398.1: a list, one row per item)
const LS_WIP_DEFAULT = 'flydiy.premises.wip';

// the keys a prop or billboard tool may stand: the prop registry's floor-standing props by group,
// the sign painter's roadside keys - read at call time, so a pack loaded later is offered
function objectKeys(kind, rec) {
  // G411: the parked aeroplanes - the archetypes, the stock designs, your own saved builds
  if (kind === 'aircraft') { const PK = (typeof window !== 'undefined' && window.PARKED) || null; return PK && PK.keys ? PK.keys() : []; }
  // THE ANIMALS (2026-09-22): the baked table's own order (the registry IS the
  // list - nothing here scans a directory), each row saying where it lives
  if (kind === 'animal') {
    const AN = (typeof window !== 'undefined' && window.ANIMALS) || null;
    if (!AN || !AN.list) return [];
    const K = { land: 'on the ground', sea: 'in the water', air: 'in the air' };
    return AN.list().map(a => [a.key, (K[a.kind] || a.kind) + ' \u00b7 ' + (a.label || a.key) + ' (' + a.length.toFixed(1) + ' m)']);
  }
  if (kind === 'prop') {
    const PR = typeof PROP_REG !== 'undefined' ? PROP_REG : ((typeof window !== 'undefined' && window.PROP_REG) || null);   // a script-scope const of flight_core.js
    if (!PR || !PR.props) return [];
    const groups = new Map((PR.groups || []).map(g => [g[0], g[1]]));
    return (PR.order || Object.keys(PR.props)).filter(k => PR.props[k] && !PR.props[k].lodOf).map(k => [k, (groups.get(PR.props[k].group) || PR.props[k].group || '') + ' · ' + (PR.props[k].label || k)]);
  }
  const BG = (typeof window !== 'undefined' && window.BIG_GEN) || null;
  if (!BG || !BG.signKeys) return [];
  const out = BG.signKeys().filter(k => (BG.signMeta(k) || {}).kind === 'roadside').map(k => [k, k]);
  // THE BALISAGE (2026-09-23): this record's own runways offer their designation
  // plates - black and red - so a field signs itself and nothing is enumerated
  // that the field does not have.
  if (rec && rec.layers && rec.layers.runways) for (const r of rec.layers.runways) {
    const m = /([0-9]{2}\/[0-9]{2})\s*$/.exec(String(r.name || ''));
    if (!m) continue;
    out.push(['rwy:' + m[1], 'runway plate · ' + m[1] + ' (black)']);
    out.push(['rwy:' + m[1] + ':r', 'runway plate · ' + m[1] + ' (red)']);
  }
  return out;
}
function mount(host, ctx) {
  const { THREE, world, R, rows, els } = ctx;
  const $ = (t, a, kids) => { const e = document.createElement(t); if (a) for (const k in a) { if (k === 'text') e.textContent = a[k]; else if (k === 'style') e.style.cssText = a[k]; else if (k === 'class') e.className = a[k]; else e.setAttribute(k, a[k]); } if (kids) for (const c of kids) e.appendChild(c); return e; };

  // ---- the record and its store --------------------------------------------
  let rec = PG.normalise(PG.DEF());
  let recName = null;
  const storage = ctx.storage || null;
  // where the record autosaves: the bench's wip slot, or the key the host names (the game's is the
  // one its boot composes, flydiy.premises.game - so a save IS the world at the next boot)
  const LS_WIP = ctx.wipKey || LS_WIP_DEFAULT;
  // the module's window listeners answer only while this mount is ACTIVE (the game closes and
  // reopens the editor; a closed one must not eat the flight's keys)
  let active = true;
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
    if (entry.poly) { const b = PG.polyBBox(entry.poly); const f = (+entry.falloff || 0) + 4; return { x0: b.x0 - f, z0: b.z0 - f, x1: b.x1 + f, z1: b.z1 + f }; }
    if (entry.pts) { const b = PG.polyBBox(entry.pts); const f = (+entry.falloff || 6) + (+entry.w || +entry.width || 4); return { x0: b.x0 - f, z0: b.z0 - f, x1: b.x1 + f, z1: b.z1 + f }; }
    if (entry.kind === 'tree') return { x0: entry.x - 4, z0: entry.z - 4, x1: entry.x + 4, z1: entry.z + 4 };
    if (entry.c && entry.len) { const b = PG.polyBBox(PG.runwayBox(Object.assign({}, PG.RUNWAY_DEF, entry), 40)); return b; }
    if (entry.at && entry.items) { const SF = PG.siteFrame(entry); let b = null; for (const it of entry.items) { const q = SF.toLocal(it.x || 0, it.z || 0); const bb = { x0: q[0] - 40, z0: q[1] - 40, x1: q[0] + 40, z1: q[1] + 40 }; b = b ? { x0: Math.min(b.x0, bb.x0), z0: Math.min(b.z0, bb.z0), x1: Math.max(b.x1, bb.x1), z1: Math.max(b.z1, bb.z1) } : bb; } return b || { x0: entry.at.x - 10, z0: entry.at.z - 10, x1: entry.at.x + 10, z1: entry.at.z + 10 }; }
    return null;
  }
  const union = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) });
  // which layers move the GROUND (and so the chunks): terrain, and roads (graded)
  const groundLayer = layer => layer === 'terrain' || layer === 'roads' || layer === 'runways' || layer === 'material';
  function run(cmd, isRedo) {
    applyEntry(cmd.layer, cmd.id, clone(cmd.after));
    undoS.push(cmd); if (!isRedo) redoS.length = 0;
    if (undoS.length > 200) undoS.shift();
    dirty(cmd.layer, union(bboxOf(cmd.before), bboxOf(cmd.after)));
    strip.status('' + cmd.label);
  }
  function undo() { const c = undoS.pop(); if (!c) return; applyEntry(c.layer, c.id, clone(c.before)); redoS.push(c); dirty(c.layer, union(bboxOf(c.before), bboxOf(c.after))); strip.status('undo: ' + c.label); }
  function redo() { const c = redoS.pop(); if (!c) return; run(c, true); }
  let coalesce = null;
  function edit(id, layer, mutate, label, key) {
    const arr = rec.layers[layer], e = arr.find(x => x.id === id);
    if (!e) return;
    const before = clone(e);
    mutate(e);
    if (key && coalesce && coalesce.id === id && coalesce.key === key && Date.now() - coalesce.t < 600) {
      const last = undoS[undoS.length - 1];
      last.after = clone(e); coalesce.t = Date.now();
      dirty(layer, union(bboxOf(before), bboxOf(e)));
      return;
    }
    const cmd = { layer, id, before, after: clone(e), label };
    applyEntry(layer, id, clone(e));
    undoS.push(cmd); redoS.length = 0;
    coalesce = key ? { id, key, t: Date.now() } : null;
    dirty(layer, union(bboxOf(before), bboxOf(e)));
  }

  // ---- the renderer, dirty, the checks, the plaque ---------------------------
  let chkT = 0;
  function dirty(layer, bbox) {
    R.setRecord(rec);
    if (!layer) R.rebuild(null);
    else if (groundLayer(layer)) R.rebuild(bbox ? { layer, bbox, pad: 2 } : null);
    else R.rebuild({ layer, bbox: bbox || { x0: 0, z0: 0, x1: 0, z1: 0 }, ground: false });   // no chunk touched: outlines, plots, houses, trees
    inspector.refresh();
    autosave();
    ctx.onRebuilt && ctx.onRebuilt();   // the game re-samples its ground rings
    ctx.redraw && ctx.redraw();
    clearTimeout(chkT); chkT = setTimeout(checks, 500);
    plaque();
  }
  function checks() {
    const lines = PG.checks(rec, world, { overlay: R.overlay, site: ctx.site || null });
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
      '<b>' + (s.houses || 0) + '</b> houses ' + (s.houseTris || 0).toLocaleString() + ' tris · <b>' + (s.lights || 0) + '</b> lights · <b>' + (s.objects || 0) + '</b> objects' + (s.queued ? ' · ' + s.queued + ' queued' : '') + ' · <b>' + (s.trees || 0) + '</b> trees ' + (s.treeTris || 0).toLocaleString() + ' tris<br>' +
      n + ' feature' + (n === 1 ? '' : 's') + ' · ' + (R.plots ? R.plots().length : 0) + ' plots · undo ' + undoS.length + (ctx.frameText ? '<br>' + ctx.frameText() : '');
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
      const ic = $('span', { class: 'ic' }); const svg = iconSvg(s.k); if (svg) ic.appendChild(svg); else ic.textContent = s.icon;
      const b = $('button', { class: 'pr-sec' + (s.k === section ? ' on' : ''), title: s.label, type: 'button' }, [ic, $('span', { class: 'lb', text: s.label })]);
      b.onclick = () => { setSection(s.k); b.blur(); };
      rail.appendChild(b);
    }
  }
  function buildStrip() {
    if (!els.strip) return;
    els.strip.innerHTML = ''; toolBtns = {};
    const S = SECTIONS.find(s => s.k === section);
    for (const t of S.tools) {
      const b = $('button', { class: 'pr-tool pill' + (t === tool ? ' on' : ''), text: TOOL_LABEL[t] || t, title: TOOL_HELP[t] || '', type: 'button' });
      b.onclick = () => { setTool(t); b.blur(); };
      els.strip.appendChild(b); toolBtns[t] = b;
    }
    helpEl = $('span', { class: 'pr-help', text: TOOL_HELP[tool] || '' });
    statusEl = $('span', { class: 'pr-status', text: '' });
    els.strip.appendChild(helpEl); els.strip.appendChild(statusEl);
    drawBtns = $('span', { class: 'pr-draw', style: 'display:none' });
    const ok = $('button', { class: 'pr-tool pill', text: '✓ close', title: 'close the polygon (Enter)', type: 'button' }); ok.onclick = () => { commitDrawing(); ok.blur(); };
    const no = $('button', { class: 'pr-tool pill', text: '✕ cancel', title: 'drop the points (Esc)', type: 'button' }); no.onclick = () => { cancelTool(); no.blur(); };
    drawBtns.appendChild(ok); drawBtns.appendChild(no); els.strip.appendChild(drawBtns);
  }
  function setSection(k) { section = k; cancelTool(); tool = 'select'; buildRail(); buildStrip(); inspector.refresh(); ctx.onSection && ctx.onSection(SECTIONS.find(s => s.k === k)); }
  function setTool(t) { cancelTool(); tool = t; for (const k in toolBtns) toolBtns[k].classList.toggle('on', k === t); strip.help(TOOL_HELP[t] || ''); if (t !== 'select') select(null); }

  // ---- the tool state machine ----------------------------------------------------
  const T = { state: 'armed', pts: [] };
  function cancelTool() { T.state = 'armed'; T.pts = []; T.pick = null; T.resume = null; T.line = false; R.ghost(null); if (drawBtns) drawBtns.style.display = 'none'; ctx.redraw && ctx.redraw(); }
  const isLine = () => !!LINE_TOOLS[tool] || !!T.line;
  // RESUME (G398.2, MSFS's way): the selected polygon or road re-opens as the drawing - its corners are
  // the points, a click (or Ctrl+click) adds one after the last, Backspace drops the last, Enter / the
  // ✓ pill validates back into the SAME entry, Esc leaves it as it was
  function resumeDrawing(id) {
    const f = PG.findById(rec, id); if (!f) return false;
    const arr = f.entry.poly || f.entry.pts; if (!arr) return false;
    cancelTool(); setTool('select'); select(id);
    T.state = 'drawing'; T.resume = id; T.line = !!f.entry.pts; T.pts = arr.map(q => [q[0], q[1]]);
    if (drawBtns) drawBtns.style.display = '';
    R.ghost(ghostFeature(), ghostOk());
    strip.status('resuming ' + id + ': click to add corners after the last, Enter validates, Esc leaves it');
    ctx.redraw && ctx.redraw();
    return true;
  }
  // Ctrl+click with the select tool (G398.2): a corner after the last (a road grows at the end nearer the
  // click); on a disc, that corner removed (a polygon keeps three, a road two)
  function ctrlEdit(id, L, h) {
    const f = PG.findById(rec, id); if (!f) return false;
    const e = f.entry, arr = e.poly || e.pts; if (!arr) return false;
    if (h && !h.mid && h.key && /^v[0-9]+$/.test(h.key)) {
      const min = e.poly ? 3 : 2;
      if (arr.length <= min) { strip.status('a ' + (e.poly ? 'polygon keeps three corners' : 'road keeps two points')); return true; }
      edit(id, f.layer, x => { (x.poly || x.pts).splice(h.index, 1); }, 'corner of ' + id + ' removed'); strip.status('corner removed - ' + (e.poly || e.pts).length + ' left');
      return true;
    }
    const q = [+L[0].toFixed(2), +L[1].toFixed(2)];
    edit(id, f.layer, x => { const a = x.poly || x.pts; if (x.pts && a.length >= 2 && Math.hypot(a[0][0] - q[0], a[0][1] - q[1]) < Math.hypot(a[a.length - 1][0] - q[0], a[a.length - 1][1] - q[1])) a.unshift(q); else a.push(q); }, 'corner added to ' + id); strip.status('corner added - ' + (e.poly || e.pts).length + ' now; Ctrl+click adds another');
    return true;
  }
  function ghostFeature() {
    if (!T.pts.length) return null;
    if (TWO_POINT_TOOLS[tool]) return T.pts.length >= 2 ? { pts: [T.pts[0], T.pts[1]], width: 24 } : { kind: 'tree', x: T.pts[0][0], z: T.pts[0][1] };
    return isLine() ? { pts: T.pts.map(p => [p[0], p[1]]), width: 3.6 } : { poly: T.pts };
  }
  function ghostOk() {
    if (isLine()) return T.pts.length >= 2 ? true : 'warn';
    if (T.pts.length < 3) return 'warn';
    return PG.polySimple(T.pts) ? true : false;
  }
  function addPoint(lx, lz) {
    const L = T.pts[T.pts.length - 1];
    if (L && Math.hypot(L[0] - lx, L[1] - lz) < 0.5) return;
    T.pts.push([lx, lz]);
    T.state = 'drawing';
    if (TWO_POINT_TOOLS[tool] && T.pts.length === 2) { commitDrawing(); return; }
    if (drawBtns) drawBtns.style.display = '';
    R.ghost(ghostFeature(), ghostOk());
    strip.status(T.pts.length + ' point' + (T.pts.length > 1 ? 's' : '') + ' — ✓ close or double-click');
    ctx.redraw && ctx.redraw();
  }
  // the level a flat wants: the median ground under the polygon, relative to y0
  function medianLevel(poly) {
    const O = R.overlay, F = O.frame, hs = [], bb = PG.polyBBox(poly);
    for (let i = 0; i < 64; i++) { const lx = bb.x0 + (i % 8 + 0.5) / 8 * (bb.x1 - bb.x0), lz = bb.z0 + (Math.floor(i / 8) + 0.5) / 8 * (bb.z1 - bb.z0); if (PG.inPoly(poly, lx, lz)) { const w = F.toWorld(lx, lz); hs.push(world.terrainH(w[0], w[1]) - F.y0); } }
    hs.sort((a, b) => a - b);
    return +(hs.length ? hs[hs.length >> 1] : 0).toFixed(2);
  }
  // the falloff a flatten needs so its bank never passes 3:1 (a smoothstep's steepest is 1.5 x drop / falloff):
  // the drop is the most the ground differs from the level round the polygon's corners; the least is the tool's own
  function bankFor(poly, level, least) {
    const F = R.overlay.frame;
    return PG.bankFalloff(poly, (lx, lz) => { const w = F.toWorld(lx, lz); return world.terrainH(w[0], w[1]) - F.y0; }, level, least);
  }
  function commitDrawing() {
    if (T.state !== 'drawing') return;
    if (T.resume) {
      const id = T.resume, f = PG.findById(rec, id);
      if (!f) { cancelTool(); return; }
      if (f.entry.poly && (T.pts.length < 3 || !PG.polySimple(T.pts))) { strip.status(T.pts.length < 3 ? 'a polygon needs three corners' : 'refused: the polygon crosses itself'); return; }
      if (f.entry.pts && T.pts.length < 2) { strip.status('a road needs two points'); return; }
      const pts = T.pts.map(q => [q[0], q[1]]);
      edit(id, f.layer, x => { if (x.poly) x.poly = pts; else x.pts = pts; }, 'corners of ' + id);
      cancelTool(); select(id); strip.status(id + ' validated with ' + pts.length + (f.entry.poly ? ' corners' : ' points'));
      return;
    }
    if (TWO_POINT_TOOLS[tool]) {
      if (T.pts.length < 2) { strip.status('click the other end'); return; }
      const a = T.pts[0], b = T.pts[1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 150) { strip.status('refused: a strip is at least 150 m (' + len.toFixed(0) + ')'); return; }
      const e = Object.assign({ id: PG.newId(rec, 'runways') }, JSON.parse(JSON.stringify(PG.RUNWAY_DEF)), { name: 'strip ' + (rec.layers.runways.length + 1), c: [+((a[0] + b[0]) / 2).toFixed(2), +((a[1] + b[1]) / 2).toFixed(2)], hdg: +Math.atan2(b[1] - a[1], b[0] - a[0]).toFixed(4), len: +len.toFixed(1), wid: 24 });
      run({ layer: 'runways', id: e.id, before: null, after: e, label: 'runway ' + e.id });
      cancelTool(); select(e.id); return;
    }
    T.pts = T.pts.filter((p, i, A) => i === 0 || Math.hypot(p[0] - A[i - 1][0], p[1] - A[i - 1][1]) >= 0.5);
    if (isLine()) {
      if (T.pts.length < 2) { strip.status('a road needs two points'); return; }
      const e = { id: PG.newId(rec, 'roads'), pts: T.pts.map(p => [p[0], p[1]]), w: 3.6, cls: 'gravel', graded: true, falloff: 6 };
      run({ layer: 'roads', id: e.id, before: null, after: e, label: 'road ' + e.id });
      cancelTool(); select(e.id); return;
    }
    if (T.pts.length > 2 && Math.hypot(T.pts[0][0] - T.pts[T.pts.length - 1][0], T.pts[0][1] - T.pts[T.pts.length - 1][1]) < 0.5) T.pts.pop();
    if (T.pts.length < 3) { strip.status('a polygon needs three points'); return; }
    if (!PG.polySimple(T.pts)) { strip.status('refused: the polygon crosses itself'); return; }
    const poly = PG.ensureCCW(T.pts);
    const layer = POLY_TOOLS[tool];
    let e;
    if (tool === 'flatten') { const lv = medianLevel(poly); e = { id: PG.newId(rec, 'terrain'), kind: 'flatten', poly, level: lv, falloff: bankFor(poly, lv, 10), abs: false, order: 0 }; }
    else if (tool === 'raise') e = { id: PG.newId(rec, 'terrain'), kind: 'raise', poly, dh: 2, falloff: 10 };
    else if (tool === 'material') { const sets = materialSets(); e = { id: PG.newId(rec, 'material'), poly, set: sets.length ? sets[0][0] : '', tile: null, fade: 4, z: 0 }; }
    else if (tool === 'ramp') { const lv = medianLevel(poly); e = { id: PG.newId(rec, 'terrain'), kind: 'ramp', poly, level: lv, slope: 0.02, hdg: 0, falloff: bankFor(poly, lv, 8) }; }
    else if (tool === 'surface') e = { id: PG.newId(rec, 'surface'), poly, surface: PG.SURFACE.GRAVEL };
    else if (tool === 'apron') e = { id: PG.newId(rec, 'surface'), poly, surface: PG.SURFACE.PAVED, apron: true };
    else if (tool === 'zone') e = { id: PG.newId(rec, 'zones'), kind: 'residential', poly, density: 1, seed: null, palette: null, rules: {} };
    else if (tool === 'forest') e = { id: PG.newId(rec, 'zones'), kind: 'forest', poly, density: 1, seed: null, palette: null, rules: {} };
    else if (tool === 'clear') e = { id: PG.newId(rec, 'zones'), kind: 'clear', poly, density: 1, seed: null, palette: null, rules: {} };
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
      if ((ev.ctrlKey || ev.metaKey) && T.state !== 'drawing') {
        const g = ctx.ground(ev.clientX, ev.clientY); if (!g) return false;
        const L = R.overlay.frame.toLocal(g[0], g[2]);
        if (ctrlEdit(selected, L, h)) { swallowClick = true; return true; }
        return false;
      }
      return startDrag(h);
    }
    return false;
  }
  // a drag begins on a handle of the selected feature (the mouse's, or a script's by key)
  function startDrag(h) {
    {
      if (h) {
        const F = R.overlay.frame, found = PG.findById(rec, selected);
        if (!found) return false;
        const e = found.entry, before = clone(e);
        if (e.kind === 'tree' || e.kind === 'prop' || e.kind === 'billboard' || e.kind === 'aircraft') { drag = { id: selected, layer: found.layer, point: true, before, F }; return true; }
        if (found.layer === 'runways') {
          if (h.key.indexOf('hold:') === 0) {
            // the pattern becomes AUTHORED the moment a hold is touched: the derived graph, saved verbatim, the hold moved along the centreline
            const pat = R.patternOf(selected);
            if (!pat) return false;
            drag = { id: selected, layer: 'runways', hold: h.key.slice(5), pat: JSON.parse(JSON.stringify(pat)), before, F };
            return true;
          }
          drag = { id: selected, layer: 'runways', runway: h.key, before, F };
          return true;
        }
        if (found.layer === 'sites') { drag = { id: selected, layer: 'sites', site: h.key, before, F }; if (h.key.indexOf('i:') === 0) ITEM_FOCUS = h.key.slice(2); return true; }
        const arr = e.poly || e.pts;
        if (h.mid) {
          const a = arr[h.index], b = arr[(h.index + 1) % arr.length];
          arr.splice(h.index + 1, 0, a.length > 2 ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] || 0) + (b[2] || 0)) / 2] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
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
    return moveDrag(g);
  }
  // the drag's hand: the WORLD ground point moves the handle's record
  function moveDrag(g) {
    const found = PG.findById(rec, drag.id); if (!found) return true;
    const L = drag.F.toLocal(g[0], g[2]);
    if (drag.hold) {
      const e = found.entry, A = (R.aerodromes() || []).find(a => a.id === e.id);
      if (A) {
        const dx = Math.cos(A.hdg), dz = Math.sin(A.hdg);
        const t = Math.max(-A.len / 2 + 5, Math.min(A.len / 2 - 5, (g[0] - A.x) * dx + (g[2] - A.z) * dz));
        const nd = drag.pat.nodes.find(n => n.id === drag.hold);
        if (nd) { nd.x = +(A.x + dx * t).toFixed(3); nd.z = +(A.z + dz * t).toFixed(3); }
        e.site = Object.assign({}, e.site || {}, { pattern: drag.pat });
      }
    }
    else if (drag.point) { found.entry.x = +L[0].toFixed(2); found.entry.z = +L[1].toFixed(2); }
    else if (drag.site) {
      const e = found.entry;
      if (drag.site === 'at') { e.at.x = +L[0].toFixed(2); e.at.z = +L[1].toFixed(2); }
      else {
        const it = (e.items || []).find(i => 'i:' + i.id === drag.site);
        if (it) { const a = e.at, c = Math.cos(a.yaw || 0), sn = Math.sin(a.yaw || 0), dx = L[0] - a.x, dz = L[1] - a.z; it.x = +(dx * c - dz * sn).toFixed(2); it.z = +(dx * sn + dz * c).toFixed(2); }
      }
    }
    else if (drag.runway === 'stand' || drag.runway === 'hangar' || drag.runway.indexOf('tx') === 0) {
      // the stand or a taxi point moves; the LAST taxi point stays on the centreline (it is the entry)
      const e = found.entry, E = PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, e));
      if (drag.runway === 'stand') { e.stand.x = +L[0].toFixed(2); e.stand.z = +L[1].toFixed(2); }
      else if (drag.runway === 'hangar') { e.hangar.x = +L[0].toFixed(2); e.hangar.z = +L[1].toFixed(2); }
      else {
        const i = +drag.runway.slice(2);
        if (i === e.taxiOut.length - 1) { const along = (L[0] - e.c[0]) * E.d[0] + (L[1] - e.c[1]) * E.d[1]; e.taxiOut[i] = [+(e.c[0] + E.d[0] * along).toFixed(2), +(e.c[1] + E.d[1] * along).toFixed(2)]; }
        else e.taxiOut[i] = [+L[0].toFixed(2), +L[1].toFixed(2)];
      }
    }
    else if (drag.runway) {
      // a strip moved or turned drops its authored pattern: the graph was in the world frame of the old strip
      if (found.entry.site && found.entry.site.pattern) { const st = Object.assign({}, found.entry.site); delete st.pattern; found.entry.site = Object.keys(st).length ? st : null; }
      const e = found.entry, E = PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, e));
      // the way out follows the strip: its entry point stays on the centreline
      if (drag.runway === 'c') { e.c = [+L[0].toFixed(2), +L[1].toFixed(2)]; }
      else {
        const fixed = drag.runway === 'e0' ? E.end1 : E.end0, mv = [L[0], L[1]];
        const a = drag.runway === 'e0' ? mv : fixed, b = drag.runway === 'e0' ? fixed : mv;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len >= 150) { e.c = [+((a[0] + b[0]) / 2).toFixed(2), +((a[1] + b[1]) / 2).toFixed(2)]; e.hdg = +Math.atan2(b[1] - a[1], b[0] - a[0]).toFixed(4); e.len = +len.toFixed(1); }
      }
    }
    else { const arr = found.entry.poly || found.entry.pts; arr[drag.index][0] = +L[0].toFixed(2); arr[drag.index][1] = +L[1].toFixed(2); }
    R.setRecord(rec); R.rebuild({ layer: found.layer, bbox: { x0: 0, z0: 0, x1: 0, z1: 0 }, ground: false });   // outlines follow; the ground on release
    ctx.redraw && ctx.redraw();
    return true;
  }
  function onUp() {
    if (!drag) return false;
    const found = PG.findById(rec, drag.id);
    if (found) {
      const cmd = { layer: found.layer, id: drag.id, before: drag.before, after: clone(found.entry), label: 'move ' + drag.id };
      undoS.push(cmd); redoS.length = 0;
      dirty(found.layer, union(bboxOf(drag.before), bboxOf(found.entry)));
    }
    drag = null;
    return true;
  }
  function onClick(ev) {
    const g = ctx.ground(ev.clientX, ev.clientY);
    if (!g) return;
    clickAt(g);
  }
  // a click at a WORLD ground point: the tools' one entry, from the mouse or from a script
  function clickAt(g) {
    const F = R.overlay.frame, L = F.toLocal(g[0], g[2]);
    if (T.state === 'drawing' && T.resume) { addPoint(+L[0].toFixed(2), +L[1].toFixed(2)); return; }
    if (tool === 'select') { const h = R.hit(g[0], g[2]); select(h ? h.id : null); return; }
    if (tool === 'probe') {
      const h = R.heightAt(g[0], g[2]);
      const sx = (R.heightAt(g[0] + 1, g[2]) - R.heightAt(g[0] - 1, g[2])) / 2, sz = (R.heightAt(g[0], g[2] + 1) - R.heightAt(g[0], g[2] - 1)) / 2;
      const s = PG.SURFACE_NAMES[R.overlay.surfaceAt(g[0], g[2])] || 'base';
      strip.status('x ' + L[0].toFixed(1) + ' z ' + L[1].toFixed(1) + ' · ' + h.toFixed(2) + ' m (' + (h - F.y0).toFixed(2) + ' over the anchor) · slope ' + (Math.hypot(sx, sz) * 100).toFixed(1) + ' % · ' + s + (R.overlay.excludeAt(g[0], g[2], 'trees') ? ' · no trees' : '') + ' · road ' + R.overlay.roadNear(g[0], g[2]).toFixed(0) + ' m');
      return;
    }
    if (tool === 'cable') {
      const h = R.hit(g[0], g[2]);
      if (!h || h.layer !== 'sites' || !h.item) { strip.status('click a station (a site item)'); return; }
      if (!T.pick) { T.pick = { site: h.id, item: h.item }; T.state = 'drawing'; strip.status('now the other station'); return; }
      const e = { id: PG.newId(rec, 'links'), kind: 'cable', from: { site: T.pick.site, item: T.pick.item, hook: 'track0' }, to: { site: h.id, item: h.item, hook: 'track0' }, P: {}, dynamic: true };
      T.pick = null; T.state = 'armed';
      run({ layer: 'links', id: e.id, before: null, after: e, label: 'cable ' + e.id });
      select(h.id); return;
    }
    if (tool === 'building' || tool === 'theme') {
      if (tool === 'building') {
        const key = PALETTE_KEY || (ctx.catalogue ? ctx.catalogue.keys()[0] : null);
        if (!key) { strip.status('no catalogue - no generator loaded'); return; }
        const e = { id: PG.newId(rec, 'sites'), name: key.split('/')[1], at: { x: +L[0].toFixed(2), z: +L[1].toFixed(2), yaw: 0 }, items: [{ id: 'i1', key, x: 0, z: 0, yaw: 0, P: {} }], yard: null };
        run({ layer: 'sites', id: e.id, before: null, after: e, label: 'site ' + e.id + ' (' + key + ')' });
        // (the base by category is the lot law's now - VILLAGE_GEN.planLot through render_premises' synthetic plot, G401)
        select(e.id); return;
      }
      const THS = window.VILLAGE_GEN && window.VILLAGE_GEN.THEMES;
      const TH = THS && (THS[SITE_THEME] || THS.kennecott);
      if (!TH) { strip.status('the village generator is not loaded'); return; }
      const sid = PG.newId(rec, 'sites');
      const items = TH.items.map((it, k) => ({ id: it.preset.replace(/[^a-z0-9]+/gi, '_') + (it.onRoad ? '_rcv' : '') + '_' + k, key: ({ big: 'big/', shed: 'shed/', sport: 'sport/', totem: 'totem/', hangar: 'hangar/', tower: 'tower/' }[it.gen] || 'house/') + it.preset, x: it.x, z: it.z, yaw: +(it.yaw || 0).toFixed(3), P: it.P || {}, onRoad: !!it.onRoad, bottomOnRoad: !!it.bottomOnRoad }));
      // the receiving shed the mill's conveyor runs to: the theme on master has none (its mill's own bottom house
      // straddles the road); the branch's has the tram shed astride the road - stand one when the theme lacks it
      // (the key is FOUND in the live catalogue, never written here - rule 13: the editor names no asset)
      if (TH.tram && !items.some(i => i.onRoad)) { const keys = ctx.catalogue ? ctx.catalogue.keys() : []; const rcvKey = (PALETTE_KEY && /shed/.test(PALETTE_KEY)) ? PALETTE_KEY : keys.find(k => k.indexOf('big') === 0 && /shed/.test(k)) || keys.find(k => /shed/.test(k)); if (rcvKey) items.push({ id: 'rcv', key: rcvKey, x: 0, z: -2, yaw: 0, P: {}, onRoad: true, bottomOnRoad: false }); }
      const e = { id: sid, name: TH.name, at: { x: +L[0].toFixed(2), z: +L[1].toFixed(2), yaw: 0 }, items, yard: TH.yard || null };
      // THE SITE'S FENCES (G393.3): the theme's segments carried into premises coordinates on the entry; render_premises draws them with the village's fence
      if (TH.fences) { const SF0 = PG.siteFrame(e); e.fences = TH.fences.map(f => ({ a: SF0.toLocal(f.a[0], f.a[1]).map(v => +v.toFixed(2)), b: SF0.toLocal(f.b[0], f.b[1]).map(v => +v.toFixed(2)), gap: f.gap || null, style: f.style || 'rail' })); }
      run({ layer: 'sites', id: sid, before: null, after: e, label: 'site ' + sid + ' (' + TH.name + ')' });
      const mill = items.find(i => /mill/.test(i.key)), rcv = items.find(i => i.onRoad);
      if (mill && rcv) run({ layer: 'links', id: PG.newId(rec, 'links'), before: null, after: { id: PG.newId(rec, 'links'), kind: 'conveyor', from: { site: sid, item: mill.id, hook: 'head' }, to: { site: sid, item: rcv.id, hook: 'roof' }, P: {}, dynamic: true }, label: 'conveyor' });
      if (TH.yard && !TH.tram) {
        // a theme without a mountain works: the yard is its gravel, no cut (G393.3)
        const SF = PG.siteFrame(e), Y = TH.yard;
        const poly = [[Y.x0, Y.z0], [Y.x1, Y.z0], [Y.x1, Y.z1], [Y.x0, Y.z1]].map(q => SF.toLocal(q[0], q[1]).map(v => +v.toFixed(2)));
        run({ layer: 'surface', id: PG.newId(rec, 'surface'), before: null, after: { id: PG.newId(rec, 'surface'), poly, surface: TH.yardKind === 'paved' ? PG.SURFACE.PAVED : PG.SURFACE.GRAVEL, yard: sid }, label: 'the yard' });
        // a paved apron wears the cracked concrete (G405)
        if (TH.yardKind === 'paved') { const mid = PG.newId(rec, 'material'); run({ layer: 'material', id: mid, before: null, after: { id: mid, poly, set: 'cracked', tile: null, fade: 4, z: 0 }, label: 'the apron' }); }
      }
      if (TH.yard && TH.tram) {
        const SF = PG.siteFrame(e), Y = TH.yard;
        const poly = [[Y.x0, Y.z0], [Y.x1, Y.z0], [Y.x1, Y.z1], [Y.x0, Y.z1]].map(q => SF.toLocal(q[0], q[1]).map(v => +v.toFixed(2)));
        run({ layer: 'surface', id: PG.newId(rec, 'surface'), before: null, after: { id: PG.newId(rec, 'surface'), poly, surface: PG.SURFACE.GRAVEL, yard: sid }, label: 'the yard' });
        // THE WORKS STAND ON A FLAT (the village pinned the mountain's foot behind the row, G340): the lower yard -
        // the row, the shop, the office, the sheds, the receiving shed - flattened to its median; the mill climbs the hill above it
        const fpoly = [[Y.x0, Y.z0], [Y.x1, Y.z0], [Y.x1, 30], [Y.x0, 30]].map(q => SF.toLocal(q[0], q[1]).map(v => +v.toFixed(2)));
        const fid = PG.newId(rec, 'terrain');
        run({ layer: 'terrain', id: fid, before: null, after: { id: fid, kind: 'flatten', poly: PG.ensureCCW(fpoly), level: medianLevel(fpoly), falloff: bankFor(fpoly, medianLevel(fpoly), 14), abs: false, order: 0 }, label: 'the works flat' });
      }
      select(sid); return;
    }
    if (tool === 'stand') {
      // the nearest strip takes the stand; the way out is one point: the stand projected onto the centreline
      let best = null;
      for (const r of R.overlay.runways) { const E = PG.runwayEnds(r); const d = PG.distPtSeg(L[0], L[1], E.end0, E.end1); if (!best || d < best.d) best = { r, d, E }; }
      if (!best || best.d > 400) { strip.status('no strip within 400 m'); return; }
      const E = best.E, c = best.r.c;
      const along = (L[0] - c[0]) * E.d[0] + (L[1] - c[1]) * E.d[1];
      const entry = [+(c[0] + E.d[0] * along).toFixed(2), +(c[1] + E.d[1] * along).toFixed(2)];
      edit(best.r.id, 'runways', x => { x.stand = { x: +L[0].toFixed(2), z: +L[1].toFixed(2), hdg: null }; x.taxiOut = [entry]; }, 'stand of ' + best.r.id);
      setTool('select'); select(best.r.id);
      return;
    }
    if (tool === 'prop' || tool === 'billboard' || tool === 'aircraft' || tool === 'animal') {
      const key = OBJ_PICK[tool] || (objectKeys(tool, rec)[0] || [null])[0];
      if (!key) { strip.status('no ' + tool + ' to place here'); return; }
      const AN0 = (typeof window !== 'undefined' && window.ANIMALS) || null;
      const kind0 = (AN0 && AN0.reg(key)) ? AN0.reg(key).kind : 'land';
      const e = tool === 'prop' ? { id: PG.newId(rec, 'objects'), kind: 'prop', key, x: +L[0].toFixed(2), z: +L[1].toFixed(2), yaw: 0, dy: 0, on: 'ground' }
              : tool === 'aircraft' ? { id: PG.newId(rec, 'objects'), kind: 'aircraft', key, x: +L[0].toFixed(2), z: +L[1].toFixed(2), yaw: 0 }
              // the defaults are the species' own: a bear alone on 60 m, a herd
              // of four on 120, a POD OF FIVE on 300 (orca travel in pods of
              // four or five, and one whale is one whale), a flock of six on 220
              : tool === 'animal' ? { id: PG.newId(rec, 'objects'), kind: 'animal', key, x: +L[0].toFixed(2), z: +L[1].toFixed(2), yaw: 0,
                                      n: kind0 === 'sea' ? (key === 'whale' ? 1 : 5) : kind0 === 'air' ? 6 : (key === 'bear' ? 1 : 4),
                                      r: kind0 === 'sea' ? 300 : kind0 === 'air' ? 220 : (key === 'bear' ? 60 : 120), dy: 0 }
                                : { id: PG.newId(rec, 'objects'), kind: 'billboard', key, x: +L[0].toFixed(2), z: +L[1].toFixed(2), yaw: 0, w: 3.6 };
      run({ layer: 'objects', id: e.id, before: null, after: e, label: tool + ' ' + e.id });
      select(e.id);
      return;
    }
    if (POINT_TOOLS[tool]) {
      const pool = ctx.pool ? ctx.pool() : [];
      const e = { id: PG.newId(rec, 'objects'), kind: 'tree', x: +L[0].toFixed(2), z: +L[1].toFixed(2), key: pool.length ? pool[0].key : 'stub|tree', size: 1, yaw: +(Math.random() * 6.28).toFixed(2) };
      run({ layer: 'objects', id: e.id, before: null, after: e, label: 'tree ' + e.id });
      select(e.id);
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
    else if (ev.key === 'Delete' && selected) deleteSelected();
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.shiftKey ? redo() : undo(); ev.preventDefault(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { redo(); ev.preventDefault(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { save(recName); ev.preventDefault(); }
    else if (ev.key === 'Tab') { ctx.cameras && ctx.cameras.toggle(); ev.preventDefault(); }
    else if (ev.key >= '1' && ev.key <= String(Math.min(9, SECTIONS.length))) setSection(SECTIONS[+ev.key - 1].k);
    else if (ev.key === 'r' && selected) { const f = PG.findById(rec, selected); if (f && f.entry.at) edit(selected, 'sites', x => { x.at.yaw = ((x.at.yaw || 0) + Math.PI / 12); }, 'turn ' + selected); }
    else if (ev.key === 'f' && tool === 'select' && ctx.cameras && ctx.cameras.frame) { const f = selected && PG.findById(rec, selected); if (f) ctx.cameras.frame(bboxOf(f.entry)); }
  }
  function deleteSelected() {
    const f = PG.findById(rec, selected); if (!f) return;
    if (f.layer === 'sites') for (const L of rec.layers.links.slice()) if (L.from.site === selected || L.to.site === selected) run({ layer: 'links', id: L.id, before: clone(L), after: null, label: 'delete ' + L.id });
    run({ layer: f.layer, id: selected, before: clone(f.entry), after: null, label: 'delete ' + selected }); select(null);
  }

  // ---- the inspector: declared rows for the selected feature ----------------------
  const SURF_OPTS = PG.SURFACE_NAMES.map((n, i) => [String(i), n.toLowerCase()]);
  const inspector = { refresh() {
    insp.innerHTML = '';
    if (section === 'file') return fileRows();
    if (section === 'view') return viewRows();
    if (section === 'life') return lifeRows();
    const f = selected && PG.findById(rec, selected);
    if (!f) {
      rows.section(insp, 'THE PREMISES');
      rows.note(insp, rec.name || '(unnamed)');
      rows.note(insp, PG.LAYERS.filter(k => rec.layers[k].length).map(k => k + ' ' + rec.layers[k].length).join(' · ') || 'nothing yet — pick a tool above and click the ground');
      const feats = [];
      for (const k of ['terrain', 'surface', 'material', 'exclude', 'roads', 'runways', 'zones', 'sites', 'objects']) for (const e of rec.layers[k]) feats.push([e.id, (e.kind || k.replace(/s$/, '')) + ' ' + e.id + (e.name ? ' ' + e.name : '')]);
      if (feats.length) rows.select(insp, 'features', feats, () => '', v => select(v));
      if (section === 'zones') rows.note(insp, 'a zone sows plots along the ROADS inside it; the house generator stands a house on each. Trace a road first.');
      if (section === 'sites' && ctx.catalogue) {
        // THE PALETTE BY CATEGORY (v9): the theme's seven words as pills, the entries of the one picked
        // in the select (a preset's name and its generator's word); 'all' lists the whole catalogue
        const TH = PG.themeOf(rec), cats = TH.categories || PG.CATEGORIES;
        const keysOf = c => (c === 'all' ? ctx.catalogue.keys() : ctx.catalogue.byCat(c).map(q => q.key));
        const nOf = c => keysOf(c).length;
        if (!PALETTE_CAT || (PALETTE_CAT !== 'all' && !nOf(PALETTE_CAT))) PALETTE_CAT = cats.find(c => nOf(c)) || 'all';
        const label = k => { const i = k.indexOf('/'); return i < 0 ? k : k.slice(i + 1) + ' · ' + k.slice(0, i); };
        rows.pills(insp, 'category', [['all', 'all', 'the whole catalogue']].concat(cats.map(c => [c, c, nOf(c) + ' in the catalogue'])), () => PALETTE_CAT, v => { PALETTE_CAT = v; const ks = keysOf(v); if (ks.indexOf(PALETTE_KEY) < 0) PALETTE_KEY = ks[0] || null; inspector.refresh(); });
        const keys = keysOf(PALETTE_CAT);
        if (!PALETTE_KEY || keys.indexOf(PALETTE_KEY) < 0) PALETTE_KEY = keys[0] || null;
        if (keys.length) rows.select(insp, 'building', keys.map(k => [k, label(k)]), () => PALETTE_KEY || '', v => { PALETTE_KEY = v; });
        else rows.note(insp, 'nothing of that category in this catalogue');
        rows.note(insp, ctx.catalogue.keys().length + ' entries in the catalogue under the ' + TH.name + ' theme; pick one, then click the ground with the building tool');
        // THE SITE THEMES (G393.3): a whole site - the mine, the sports ground - stood by the theme tool
        const THS = window.VILLAGE_GEN && window.VILLAGE_GEN.THEMES;
        if (THS) { const tk = Object.keys(THS); if (!SITE_THEME || tk.indexOf(SITE_THEME) < 0) SITE_THEME = tk[0]; rows.select(insp, 'site theme', tk.map(k => [k, THS[k].name]), () => SITE_THEME, v => { SITE_THEME = v; }); }
      }
      if (section === 'objects') {
        for (const kind of ['prop', 'billboard', 'aircraft', 'animal']) {
          const keys = objectKeys(kind, rec);
          if (!keys.length) { rows.note(insp, 'no ' + kind + 's registered here'); continue; }
          if (!OBJ_PICK[kind]) OBJ_PICK[kind] = keys[0][0];
          rows.select(insp, kind, keys, () => OBJ_PICK[kind] || '', v => { OBJ_PICK[kind] = v; });
        }
        rows.note(insp, 'a prop stands on the composed ground where you click, tilted to it; a billboard is a painted sign on its posts; an aeroplane is a build parked on its wheels, nose along its turn. Each is ONE record: drag its disc to move it.');
        rows.note(insp, 'an ANIMAL record is a HOTSPOT, not one animal: how many of the species live there and over what radius. They sow themselves inside it, seeded per individual, so changing the count never moves the ones already standing.');
      }
      if (section === 'airfield') rows.note(insp, 'a runway is a PROFILE: two clicks place it, the inspector sets its length, width, heading, surface and slope; the ground is graded to it, its class reaches the wheels, the pilot\'s pattern and the PAPI are derived. ?world=A stands it on the flight world.');
      if (section === 'vegetation') rows.note(insp, 'a forest polygon plants the wood (its density and species in the inspector); a no-trees polygon keeps it out; a tree by hand is one record.');
      return;
    }
    const e = f.entry, id = e.id, layer = f.layer;
    const ed = (mut, label, key) => edit(id, layer, mut, label, key);
    rows.section(insp, (e.kind || layer.replace(/s$/, '')).toUpperCase() + ' ' + id);
    if (layer === 'terrain') {
      if (e.kind === 'flatten') {
        rows.slider(insp, 'level (m)', -40, 80, 0.1, () => e.level, v => ed(x => { x.level = v; }, 'level of ' + id, 'level'), v => v.toFixed(1) + ' m');
        rows.check(insp, 'absolute height', () => !!e.abs, v => ed(x => { x.abs = v; }, 'absolute ' + id));
      } else if (e.kind === 'raise') rows.slider(insp, 'lift (m)', -30, 30, 0.1, () => e.dh, v => ed(x => { x.dh = v; }, 'lift of ' + id, 'dh'), v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' m');
      else if (e.kind === 'ramp') {
        if (e.slope === undefined || e.slope === null) { const c = PG.polyCentroid(e.poly), pl = e.plane || [0, 0, 0]; e.level = +(pl[0] * c[0] + pl[1] * c[1] + pl[2]).toFixed(2); e.slope = +Math.hypot(pl[0], pl[1]).toFixed(4); e.hdg = +(Math.atan2(pl[0], pl[1]) * 180 / Math.PI).toFixed(0); }
        rows.slider(insp, 'height at the middle (m)', -40, 80, 0.1, () => e.level, v => ed(x => { x.level = v; }, 'level of ' + id, 'level'), v => v.toFixed(1) + ' m');
        rows.slider(insp, 'slope (%)', 0, 15, 0.1, () => (e.slope || 0) * 100, v => ed(x => { x.slope = v / 100; }, 'slope of ' + id, 'slope'), v => v.toFixed(1) + ' %');
        rows.slider(insp, 'rising toward (°)', 0, 360, 1, () => ((e.hdg || 0) + 360) % 360, v => ed(x => { x.hdg = v; }, 'heading of ' + id, 'hdg'), v => v.toFixed(0) + '°');
        rows.check(insp, 'absolute height', () => !!e.abs, v => ed(x => { x.abs = v; }, 'absolute ' + id));
      } else if (e.kind === 'grade') {
        rows.slider(insp, 'width (m)', 2, 30, 0.5, () => e.width, v => ed(x => { x.width = v; }, 'width of ' + id, 'width'), v => v.toFixed(1) + ' m');
        e.pts.forEach((p, i) => rows.slider(insp, 'point ' + (i + 1) + ' height', -40, 80, 0.1, () => p[2] || 0, v => ed(x => { x.pts[i][2] = v; }, 'height of ' + id, 'p' + i), v => v.toFixed(1) + ' m'));
      }
      rows.slider(insp, 'falloff (m)', 1, 120, 1, () => e.falloff, v => ed(x => { x.falloff = v; }, 'falloff of ' + id, 'falloff'), v => v.toFixed(0) + ' m');
    } else if (layer === 'surface') {
      rows.select(insp, 'surface', SURF_OPTS, () => String(e.surface), v => ed(x => { x.surface = +v; }, 'surface of ' + id));
      rows.slider(insp, 'priority', -5, 5, 1, () => e.z || 0, v => ed(x => { x.z = v; }, 'priority of ' + id, 'z'), v => v.toFixed(0) + (v > 0 ? ' (over)' : v < 0 ? ' (under)' : ''));
    } else if (layer === 'material') {
      const sets = materialSets();
      // A PAVED POLYGON (v1.16): a look instead of a set - an apron, a turnaround, a pad drawn by the pavement
      rows.select(insp, 'paved as', [['', 'a texture (the set below)']].concat(Object.keys(PG.RUNWAY_LOOKS).filter(k => PG.RUNWAY_LOOKS[k].cls).map(k => [k, PG.RUNWAY_LOOKS[k].name])), () => e.look || '', v => ed(x => { x.look = v || undefined; if (v) x.set = x.set || 'cracked'; }, 'look of ' + id));
      if (e.look && PG.RUNWAY_LOOKS[e.look] && PG.RUNWAY_LOOKS[e.look].cls) {
        rows.slider(insp, 'lanes turned (°)', -180, 180, 1, () => (e.yaw || 0) * 180 / Math.PI, v => ed(x => { x.yaw = v * Math.PI / 180; }, 'yaw of ' + id, 'yaw'), v => v.toFixed(0) + '°');
        pavRows(e, id, 'material', ed, PG.RUNWAY_LOOKS[e.look]);
      } else if (sets.length) rows.select(insp, 'set', sets, () => e.set || '', v => ed(x => { x.set = v; }, 'set of ' + id)); else rows.note(insp, 'no texture sets on this page');
      rows.slider(insp, 'tile (m, 0 = the set\'s own)', 0, 16, 0.5, () => e.tile || 0, v => ed(x => { x.tile = v > 0 ? v : null; }, 'tile of ' + id, 'tile'), v => (v > 0 ? v.toFixed(1) + ' m' : 'the set\'s'));
      rows.slider(insp, 'fade (m)', 0, 40, 0.5, () => e.fade || 0, v => ed(x => { x.fade = v; }, 'fade of ' + id, 'fade'), v => v.toFixed(1) + ' m');
      rows.slider(insp, 'priority', -5, 5, 1, () => e.z || 0, v => ed(x => { x.z = v; }, 'priority of ' + id, 'z'), v => v.toFixed(0) + (v > 0 ? ' (over)' : v < 0 ? ' (under)' : ''));
      rows.note(insp, 'a premises wears up to four sets: the map has four slots');
    }
    else if (layer === 'exclude') rows.check(insp, 'no trees', () => e.what.indexOf('trees') >= 0, v => ed(x => { x.what = v ? ['trees'] : []; }, 'exclude of ' + id));
    else if (layer === 'roads') {
      rows.slider(insp, 'width (m)', 2, 30, 0.2, () => e.w, v => ed(x => { x.w = v; }, 'width of ' + id, 'w'), v => v.toFixed(1) + ' m');   // (G434: to 30 - a taxiway is a road)
      rows.select(insp, 'class', [['gravel', 'gravel'], ['paved', 'paved'], ['track', 'track (grass)']], () => e.cls || 'gravel', v => ed(x => { x.cls = v; }, 'class of ' + id));
      // THE LOOK (v1.16): the pavement drawn - derived from the class when not said
      rows.select(insp, 'look', [['', 'by class (' + PG.roadLook(e).key + ')']].concat(Object.keys(PG.RUNWAY_LOOKS).filter(k => PG.RUNWAY_LOOKS[k].cls).map(k => [k, PG.RUNWAY_LOOKS[k].name])), () => e.look || '', v => ed(x => { x.look = v || null; }, 'look of ' + id));
      pavRows(e, id, 'roads', ed, PG.roadLook(e).row);
      rows.check(insp, 'graded (flat across)', () => e.graded !== false, v => ed(x => { x.graded = v; }, 'grading of ' + id));
      rows.slider(insp, 'terraformed to (m)', 1, 30, 1, () => e.falloff || 6, v => ed(x => { x.falloff = v; }, 'shoulder of ' + id, 'falloff'), v => v.toFixed(0) + ' m');
      // THE GRADE LIMIT and THE RIBBON (G434): a taxiway is cut and filled to a gradient, and drawn by its own
      // material polygon (no ribbon) - a track follows the ground and wears its ribbon
      rows.slider(insp, 'steepest (%)', 0, 12, 0.5, () => (e.grade || 0) * 100, v => ed(x => { x.grade = v ? v / 100 : undefined; }, 'grade of ' + id, 'grade'), v => v ? v.toFixed(1) + ' %' : 'follows the ground');
      rows.check(insp, 'drawn (the pavement)', () => e.ribbon !== false, v => ed(x => { x.ribbon = v ? undefined : false; }, 'ribbon of ' + id));
      // THE GUARDRAIL (2026-09-22): 'auto' lets the module decide from the ground (the drop past the
      // shoulder, the bend's outside, clear of the plots and the junctions); 'always' rails the whole
      // road both sides, 'never' none of it. GRAPHICS > guardrails hides them all whatever this says.
      rows.select(insp, 'guardrail', [['auto', 'where the ground says'], ['on', 'the whole road'], ['off', 'none']], () => e.rail || 'auto', v => ed(x => { x.rail = v === 'auto' ? undefined : v; }, 'guardrail of ' + id));
      // THE POWER LINE (2026-09-22): poles every ~34 m along one verge with the cable between them and
      // a street lamp on every second one - on unless this says otherwise; the side is the module's
      // (whichever takes more poles, and never the verge a guardrail already has)
      rows.select(insp, 'power line', [['auto', 'poles and cable'], ['off', 'none']], () => e.poles || 'auto', v => ed(x => { x.poles = v === 'auto' ? undefined : v; }, 'power line of ' + id));
      // PROTO TRAFFIC (G432): vehicles per km running up and down this road
      rows.slider(insp, 'traffic (per km)', 0, 20, 1, () => e.traffic || 0, v => ed(x => { x.traffic = v || undefined; }, 'traffic of ' + id, 'traffic'), v => v ? v.toFixed(0) + ' / km' : 'none');
      const np = (R.plots ? R.plots() : []).filter(p => p.road === id).length;
      rows.note(insp, e.pts.length + ' points · ' + np + ' plot' + (np === 1 ? '' : 's') + ' front on it');
    } else if (layer === 'zones') {
      if (e.kind === 'forest') {
        rows.slider(insp, 'density', 0.1, 3, 0.05, () => e.density === undefined ? 1 : e.density, v => ed(x => { x.density = v; }, 'density of ' + id, 'density'), v => v.toFixed(2) + ' (' + (6 / Math.sqrt(v)).toFixed(1) + ' m)');
        const pool = ctx.pool ? ctx.pool() : [];
        if (pool.length) rows.select(insp, 'species', [['', 'the whole pool']].concat(pool.map(p => [p.key, p.key.replace(/\.glb\|/, ' · ').slice(0, 30)])), () => (e.palette && e.palette[0]) || '', v => ed(x => { x.palette = v ? [v] : null; }, 'species of ' + id));
        rows.check(insp, 'clearings', () => !(e.rules && e.rules.clearings === false), v => ed(x => { x.rules = Object.assign({}, x.rules, { clearings: v }); }, 'clearings of ' + id));
      } else if (e.kind !== 'clear') {
        rows.select(insp, 'kind', PG.ZONE_KINDS.filter(k => k !== 'forest' && k !== 'clear').map(k => [k, k]), () => e.kind, v => ed(x => { x.kind = v; }, 'kind of ' + id));
        // WHAT IT DRAWS FROM (v9): the theme's categories for this kind, or the zone's own - toggle the
        // pills; none lit = the theme's
        { const TH = PG.themeOf(rec), rule = (TH.plots || {})[e.kind] || {}, own = (e.rules && Array.isArray(e.rules.cats)) ? e.rules.cats : [];
          const d = $('div', { class: 'r' }); d.appendChild($('span', { class: 'k', text: 'draws from', title: 'the categories this zone\'s plots draw from' }));
          const w = $('span', { class: 'pills' });
          for (const c of TH.categories || PG.CATEGORIES) { const on = own.length ? own.indexOf(c) >= 0 : (rule.cats || []).indexOf(c) >= 0; const b = $('button', { class: 'pill' + (on ? ' on' : ''), text: c, type: 'button', title: own.length ? 'this zone\'s own list' : 'the ' + TH.name + ' theme\'s list for a ' + e.kind + ' zone' }); b.onclick = () => ed(x => { const cur = (x.rules && Array.isArray(x.rules.cats) && x.rules.cats.length) ? x.rules.cats.slice() : (rule.cats || []).slice(); const i = cur.indexOf(c); if (i >= 0) cur.splice(i, 1); else cur.push(c); x.rules = Object.assign({}, x.rules, { cats: cur }); }, 'categories of ' + id); w.appendChild(b); }
          d.appendChild(w); insp.appendChild(d);
          if (own.length) rows.button(insp, 'back to the theme\'s categories', () => ed(x => { const r2 = Object.assign({}, x.rules); delete r2.cats; x.rules = r2; }, 'categories of ' + id));
          else if (rule.tag) rows.note(insp, 'a ' + e.kind + ' zone stands what the theme tags ' + rule.tag + ' (' + (ctx.catalogue ? ctx.catalogue.byTag(rule.tag).length : 0) + ' in the catalogue)');
          else if (rule.sampler) rows.note(insp, Math.round(rule.sampler * 100) + ' % of the plots draw the house generator\'s own random house, the rest a named preset of those categories'); }
        rows.slider(insp, 'density', 0, 1, 0.05, () => e.density === undefined ? 1 : e.density, v => ed(x => { x.density = v; }, 'density of ' + id, 'density'), v => v.toFixed(2));
        // THE PLOTS' GRASS (v1.17): what the cover ring plants inside this zone's plots - a lawn (short,
        // dense), the meadow (the biome's own) or none; the kind's default until touched
        { const G = PG.zoneGrass(e), own = !!(e.rules && e.rules.grass);
          const setG = (patch, label, key) => ed(x => { x.rules = Object.assign({}, x.rules, { grass: Object.assign({}, (x.rules && x.rules.grass) || {}, patch) }); }, label + ' of ' + id, key);
          rows.pills(insp, 'plot grass', [['lawn', 'lawn', 'short, dense, mown to the road'], ['meadow', 'meadow', "the biome's own grass"], ['none', 'none', 'a yard: gravel, no grass']], () => G.kind, v => setG({ kind: v }, 'grass'));
          if (G.kind === 'lawn') {
            rows.slider(insp, 'lawn height (m)', 0.04, 0.4, 0.01, () => G.h || 0.12, v => setG({ kind: 'lawn', h: v }, 'lawn', 'lawnH'), v => (v * 100).toFixed(0) + ' cm');
            rows.slider(insp, 'lawn density (x)', 0.2, 2, 0.1, () => G.density || 1, v => setG({ kind: 'lawn', density: v }, 'lawn', 'lawnD'), v => v.toFixed(1));
          }
          if (own) rows.button(insp, "back to the kind's grass", () => ed(x => { const r2 = Object.assign({}, x.rules); delete r2.grass; x.rules = r2; }, 'grass of ' + id)); }
        const RU = Object.assign({}, PG.ZONE_RULES, e.rules || {});
        rows.slider(insp, 'plot min (m)', 12, 40, 1, () => RU.plotMin, v => ed(x => { x.rules = Object.assign({}, x.rules, { plotMin: v }); }, 'plots of ' + id, 'plotMin'), v => v.toFixed(0) + ' m');
        rows.slider(insp, 'plot max (m)', 16, 60, 1, () => RU.plotMax, v => ed(x => { x.rules = Object.assign({}, x.rules, { plotMax: v }); }, 'plots of ' + id, 'plotMax'), v => v.toFixed(0) + ' m');
        rows.slider(insp, 'plot depth (m)', 16, 60, 1, () => RU.plotDepth, v => ed(x => { x.rules = Object.assign({}, x.rules, { plotDepth: v }); }, 'plots of ' + id, 'plotDepth'), v => v.toFixed(0) + ' m');
        const np = (R.plots ? R.plots() : []).filter(p => p.zone === id).length;
        rows.note(insp, np + ' plot' + (np === 1 ? '' : 's') + ' sown' + (np ? '' : ' — trace a road through the zone'));
      } else rows.note(insp, 'no tree grows here');
      rows.slider(insp, 'seed', 1, 99, 1, () => (e.seed === null || e.seed === undefined) ? 0 : e.seed, v => ed(x => { x.seed = v; }, 'seed of ' + id, 'seed'), v => (v ? String(v) : 'auto'));
      rows.button(insp, 're-sow (new seed)', () => ed(x => { x.seed = 1 + Math.floor(Math.random() * 98); }, 're-sow ' + id));
    } else if (layer === 'runways') {
      const nm = $('input', { type: 'text', value: e.name || '' }); nm.className = 'pr-name'; nm.onchange = () => ed(x => { x.name = nm.value; }, 'name of ' + id); insp.appendChild(nm);
      rows.slider(insp, 'length (m)', 150, 3000, 5, () => e.len, v => ed(x => { x.len = v; }, 'length of ' + id, 'len'), v => v.toFixed(0) + ' m');
      rows.slider(insp, 'width (m)', 8, 45, 1, () => e.wid, v => ed(x => { x.wid = v; }, 'width of ' + id, 'wid'), v => v.toFixed(0) + ' m');
      rows.slider(insp, 'heading (°)', -180, 180, 1, () => e.hdg * 180 / Math.PI, v => ed(x => { x.hdg = v * Math.PI / 180; }, 'heading of ' + id, 'hdg'), v => v.toFixed(0) + '°');
      // THE LOOK (v9): what the strip is drawn as; picking one proposes the class the wheels feel, which
      // the surface row below may still overrule (a paved look on a grass class is a painted strip)
      rows.pills(insp, 'look', Object.keys(PG.RUNWAY_LOOKS).map(k => [k, PG.RUNWAY_LOOKS[k].name]), () => e.look || 'grass',
        v => ed(x => { x.look = v; const L = PG.RUNWAY_LOOKS[v]; if (L && L.surface !== null && L.surface !== undefined) x.surface = L.surface; }, 'look of ' + id));
      rows.select(insp, 'wheels feel', [['0', 'grass'], ['6', 'gravel'], ['5', 'paved'], ['7', 'sand']], () => String(e.surface === undefined ? 0 : e.surface), v => ed(x => { x.surface = +v; }, 'surface of ' + id));
      if (PG.RUNWAY_LOOKS[e.look || 'grass'] && PG.RUNWAY_LOOKS[e.look || 'grass'].cls) pavRows(e, id, 'runways', ed, PG.RUNWAY_LOOKS[e.look || 'grass']);
      // THE ONE-WAY STRIP (v9): which end the landing comes over in calm air; a ridge at one end wants the other
      rows.pills(insp, 'approach', [['', 'either end', 'the pilot picks the runway direction nearest its inbound track'], ['0', 'over end 0', 'land toward end 1, depart the other way'], ['1', 'over end 1', 'land toward end 0']], () => (e.approach === 0 || e.approach === 1) ? String(e.approach) : '',
        v => ed(x => { x.approach = v === '' ? null : +v; }, 'approach of ' + id));
      // THE PROFILE (v8): the centreline's height along the length, as control points on a graph - drag a
      // point, double-click the curve to add one, the ✕ removes the selected one; the ends stay at 0 and 1
      profileGraph(insp, e, ed);
      // THE SHOULDER (v9): the strip's radius of terraforming - the grade's falloff either side of the
      // box, the band the composed ground takes to come back to the terrain; outlined when selected
      rows.slider(insp, 'terraformed to (m)', 10, 200, 5, () => PG.runwayShoulder(e), v => ed(x => { x.falloff = v; }, 'shoulder of ' + id, 'falloff'), v => v.toFixed(0) + ' m');
      rows.note(insp, 'how far the ground is terraformed either side of the strip and past its ends: the box is graded to the profile, then the bank back to the terrain (a 3:1 bank at the steepest). The drawn band above is a different thing. Aprons and flats beside it are flatten polygons of their own.');
      // THE GLIDESLOPE LIGHTS (G434): a PAPI (four units), a two-bar VASI or none at each end; both are set
      // to the approach's own slope (the lights show the glideslope the pilot flies)
      for (const k of [0, 1]) rows.pills(insp, 'lights at end ' + k, [['papi', 'PAPI', 'four units abeam the aim, two white two red on the slope'], ['vasi', 'VASI', 'two bars 210 m apart: red over white on the slope'], ['none', 'none', 'no lights at this end']],
        () => { const v = (e.papi || [true, true])[k]; return v === 'vasi' ? 'vasi' : v ? 'papi' : 'none'; },
        v => ed(x => { const p = (x.papi || [true, true]).slice(); p[k] = v === 'vasi' ? 'vasi' : v === 'papi'; x.papi = p; }, 'lights of ' + id));
      const A = (R.aerodromes ? R.aerodromes() : []).find(a => a.id === id);
      if (A) {
        rows.note(insp, 'elev ' + A.elev.toFixed(1) + ' m · heading ' + ((A.hdg * 180 / Math.PI + 360) % 360).toFixed(0) + '° in the world · tdz ' + A.tdz.map(v => v.toFixed(0)).join(', '));
        if (ctx.site && ctx.site.sitePattern) {
          let iss = [];
          const siteC = ((R.overlay.runways || []).find(q => q.id === id) || {}).site || e.site || null;
          try { iss = ctx.site.sitePatternIssues(ctx.site.sitePattern(A, siteC), A, siteC, 0, ctx.site.patternPath || null); } catch (err) { iss = [err.message]; }
          rows.note(insp, iss.length ? iss.join(' · ') : 'the pattern is sound: two holds on the centreline, the two approaches on the strip', iss.length ? 'bad' : 'ok');
        }
      }
      rows.note(insp, 'drag an end disc to turn or stretch the strip (the other end stays); the faint disc moves it whole; the amber discs are the holds - drag one along the strip and the validator answers');
      if (e.stand && e.taxiOut) {
        rows.note(insp, 'THE STAND: the aeroplane starts here, parked toward its first taxi point; the way out runs through ' + e.taxiOut.length + ' point' + (e.taxiOut.length > 1 ? 's' : '') + ' to the centreline');
        rows.button(insp, 'add a taxi point', () => ed(x => { const t = x.taxiOut, n = t.length, a = n > 1 ? t[n - 2] : [x.stand.x, x.stand.z], b = t[n - 1]; t.splice(n - 1, 0, [+((a[0] + b[0]) / 2).toFixed(2), +((a[1] + b[1]) / 2).toFixed(2)]); }, 'taxi point of ' + id));
        if (e.taxiOut.length > 1) rows.button(insp, 'drop the last taxi point before the entry', () => ed(x => { x.taxiOut.splice(x.taxiOut.length - 2, 1); }, 'taxi point of ' + id));
        rows.button(insp, 'remove the stand', () => ed(x => { x.stand = null; x.taxiOut = null; }, 'stand of ' + id));
      } else rows.note(insp, 'no stand: the aeroplane starts 35 m in from end 0 (the stand tool puts one beside the strip)');
      // THE CLUB HANGAR (G434): the garage's own shell stood at the field - the building the aeroplane rolls
      // out of (the reveal shot keeps out of it); placed behind the stand facing it, then dragged by its disc
      // and turned here. Its size is the player's (the sliders in the shed), never the record's.
      if (e.hangar) {
        rows.note(insp, 'THE CLUB HANGAR: the garage\'s shell stands here, its door facing ' + ((+e.hangar.hdg || 0) * 180 / Math.PI).toFixed(0) + '°; drag its disc to move it');
        rows.slider(insp, 'door faces (°)', -180, 180, 1, () => (+e.hangar.hdg || 0) * 180 / Math.PI, v => ed(x => { x.hangar.hdg = v * Math.PI / 180; }, 'hangar of ' + id, 'hangarHdg'), v => v.toFixed(0) + '°');
        rows.button(insp, 'remove the club hangar', () => ed(x => { x.hangar = null; }, 'hangar of ' + id));
      } else if (e.stand) {
        rows.button(insp, 'stand the club hangar behind the stand', () => ed(x => {
          const h = x.stand.hdg !== null && x.stand.hdg !== undefined ? +x.stand.hdg : (x.taxiOut && x.taxiOut.length ? Math.atan2(x.taxiOut[0][1] - x.stand.z, x.taxiOut[0][0] - x.stand.x) : 0);
          x.hangar = { x: +(x.stand.x - 34 * Math.cos(h)).toFixed(2), z: +(x.stand.z - 34 * Math.sin(h)).toFixed(2), hdg: +h.toFixed(4) };
        }, 'hangar of ' + id));
      } else rows.note(insp, 'a club hangar (the garage\'s shell) can stand behind a stand: put the stand first');
      if (e.site && e.site.pattern) rows.button(insp, 'pattern: back to the derived one', () => ed(x => { const st = Object.assign({}, x.site); delete st.pattern; x.site = Object.keys(st).length ? st : null; }, 'derived pattern of ' + id));
      else rows.note(insp, 'the pattern is the DERIVED one (two holds 110 m in); touch a hold and it becomes yours');
    } else if (layer === 'sites') {
      const nm = $('input', { type: 'text', value: e.name || '' }); nm.className = 'pr-name'; nm.onchange = () => ed(x => { x.name = nm.value; }, 'name of ' + id); insp.appendChild(nm);
      rows.slider(insp, 'turn (°)', -180, 180, 1, () => (e.at.yaw || 0) * 180 / Math.PI, v => ed(x => { x.at.yaw = v * Math.PI / 180; }, 'turn of ' + id, 'yaw'), v => v.toFixed(0) + '°');
      const items = e.items || [];
      rows.note(insp, items.length + ' item' + (items.length === 1 ? '' : 's') + ' - the faint discs move each in the site\'s frame; the bright one moves the site whole');
      const links = rec.layers.links.filter(L => (L.from.site === id) || (L.to.site === id));
      const solved = (R.links ? R.links() : []);
      for (const L of links) { const sol = solved.find(q => q.link.id === L.id); const d = $('div', { class: 'note ' + (sol && sol.ok ? 'ok' : 'bad') }); d.textContent = L.kind + ' ' + L.from.item + ' → ' + L.to.item + ': ' + (sol ? (sol.ok ? 'solved' : (sol.issues || ['?'])[0]) : 'not solved'); insp.appendChild(d); }
      const iss = (R.overlay.records.issues || []).filter(t => t.indexOf(id) >= 0);
      if (iss.length) rows.note(insp, '⚠ ' + iss[0]);
      // THE ITEMS AS A LIST (G398.1): one row per item - what stands there and its turn - and the
      // focused one (clicked here, or its disc dragged) opens into its building, its turn, its removal
      rows.section(insp, items.length + ' ITEM' + (items.length === 1 ? '' : 'S'));
      const E = ctx.catalogue ? ctx.catalogue.entries : null;
      const labelOf = k => { const en = E && E.get(k), i = k.indexOf('/'); return (i < 0 ? k : k.slice(i + 1)) + (en && en.cat ? ' · ' + en.cat : ''); };
      if (ITEM_FOCUS && !items.some(q => q.id === ITEM_FOCUS)) ITEM_FOCUS = null;
      for (const it of items) {
        const open = ITEM_FOCUS === it.id;
        const d = $('div', { class: 'r item' + (open ? ' on' : ''), style: 'cursor:pointer' });
        d.appendChild($('span', { class: 'k', text: (open ? '▾ ' : '▸ ') + labelOf(it.key), title: it.id + ' - ' + it.key }));
        d.appendChild($('span', { class: 'v', text: ((it.yaw || 0) * 180 / Math.PI).toFixed(0) + '°' }));
        d.onclick = () => { ITEM_FOCUS = open ? null : it.id; inspector.refresh(); };
        insp.appendChild(d);
        if (!open) continue;
        if (ctx.catalogue) rows.select(insp, 'building', ctx.catalogue.keys().map(k => [k, labelOf(k)]), () => it.key, v => ed(x => { x.items.find(q => q.id === it.id).key = v; }, 'building of ' + it.id));
        rows.slider(insp, 'turn (°)', -180, 180, 1, () => (it.yaw || 0) * 180 / Math.PI, v => ed(x => { x.items.find(q => q.id === it.id).yaw = v * Math.PI / 180; }, 'turn of ' + it.id, 'yaw:' + it.id), v => v.toFixed(0) + '°');
        rows.button(insp, 'remove ' + labelOf(it.key).split(' · ')[0], () => { ITEM_FOCUS = null; ed(x => { x.items = x.items.filter(q => q.id !== it.id); }, 'remove ' + it.id); });
      }
    } else if (layer === 'objects' && e.kind === 'animal') {
      const AN = (typeof window !== 'undefined' && window.ANIMALS) || null;
      const a = AN && AN.reg ? AN.reg(e.key) : null;
      const keys = objectKeys('animal');
      if (keys.length) rows.select(insp, 'species', keys, () => e.key, v => ed(x => { x.key = v; }, 'species of ' + id));
      rows.slider(insp, 'how many', 1, 24, 1, () => e.n || 1, v => ed(x => { x.n = Math.round(v); }, 'how many of ' + id, 'n'), v => v.toFixed(0));
      rows.slider(insp, 'over (m)', 0, 800, 5, () => e.r || 0, v => ed(x => { x.r = v; }, 'range of ' + id, 'r'), v => v.toFixed(0));
      rows.slider(insp, 'turn (\u00b0)', -180, 180, 1, () => (e.yaw || 0) * 180 / Math.PI, v => ed(x => { x.yaw = v * Math.PI / 180; }, 'turn of ' + id, 'yaw'), v => v.toFixed(0) + '\u00b0');
      if (a && a.kind === 'air') rows.slider(insp, 'height (m)', 0, 400, 5, () => e.dy || 0, v => ed(x => { x.dy = v; }, 'height of ' + id, 'dy'), v => v.toFixed(0));
      if (a) rows.note(insp, a.label + ': ' + a.length.toFixed(1) + ' m, ' + a.nt.toLocaleString() + ' triangles, ' +
        a.clips.length + ' clip' + (a.clips.length === 1 ? '' : 's') + ' (' + [...new Set(a.clips.map(c => c.role))].join(', ') + ')');
      else rows.note(insp, 'the species "' + e.key + '" is not in the animal table of this build');
    } else if (layer === 'objects' && (e.kind === 'prop' || e.kind === 'billboard' || e.kind === 'aircraft')) {
      const keys = objectKeys(e.kind, rec);
      if (keys.length) rows.select(insp, e.kind, keys, () => e.key, v => ed(x => { x.key = v; }, e.kind + ' of ' + id));
      rows.slider(insp, 'turn (°)', -180, 180, 1, () => (e.yaw || 0) * 180 / Math.PI, v => ed(x => { x.yaw = v * Math.PI / 180; }, 'turn of ' + id, 'yaw'), v => v.toFixed(0) + '°');
      if (e.kind === 'prop') {
        rows.slider(insp, 'lift (m)', -1, 3, 0.05, () => e.dy || 0, v => ed(x => { x.dy = v; }, 'lift of ' + id, 'dy'), v => v.toFixed(2));
        rows.select(insp, 'stands', [['ground', 'on the ground, tilted to it'], ['flat', 'level']], () => e.on || 'ground', v => ed(x => { x.on = v; }, 'stance of ' + id));
      } else if (e.kind === 'billboard') rows.slider(insp, 'width (m)', 2, 6, 0.1, () => e.w || 3.6, v => ed(x => { x.w = v; }, 'width of ' + id, 'w'), v => v.toFixed(1));
    } else if (layer === 'objects' && e.kind === 'tree') {
      const pool = ctx.pool ? ctx.pool() : [];
      if (pool.length) rows.select(insp, 'species', pool.map(p => [p.key, p.key.replace(/\.glb\|/, ' · ').slice(0, 30)]), () => e.key, v => ed(x => { x.key = v; }, 'species of ' + id));
      rows.slider(insp, 'size', 0.4, 1.8, 0.02, () => e.size || 1, v => ed(x => { x.size = v; }, 'size of ' + id, 'size'));
      rows.slider(insp, 'turn (°)', 0, 360, 1, () => (e.yaw || 0) * 180 / Math.PI, v => ed(x => { x.yaw = v * Math.PI / 180; }, 'turn of ' + id, 'yaw'), v => v.toFixed(0) + '°');
    }
    if (e.poly || e.pts) {
      rows.note(insp, (e.poly ? e.poly.length + ' corners' : e.pts.length + ' points') + ' — drag a disc to move it, a faint one to add a corner between two; Ctrl+click the ground adds one after the last, Ctrl+click a disc removes it');
      rows.button(insp, 'resume drawing', () => resumeDrawing(id));
    }
    rows.button(insp, 'delete ' + id, deleteSelected);
  } };
  function profileGraph(host, e, ed) {
    const pts = () => (Array.isArray(e.profile) && e.profile.length >= 2) ? e.profile : [[0, -(e.slope || 0) * e.len / 2], [1, (e.slope || 0) * e.len / 2]];
    const wrap = $('div', { class: 'r', style: 'display:block' });
    wrap.appendChild($('span', { class: 'k', text: 'profile: height along the strip' }));
    const cv = $('canvas', { width: '300', height: '110', style: 'display:block;width:100%;max-width:300px;aspect-ratio:300/110;background:#0e1218;border:1px solid #242a33;border-radius:4px;cursor:crosshair' });
    wrap.appendChild(cv);
    const note = $('div', { class: 'note' });
    wrap.appendChild(note);
    host.appendChild(wrap);
    let sel = -1, dragging = false;
    const W = 300, H = 110, PADL = 34, PADR = 8, PADT = 10, PADB = 18;
    const range = () => { const P = pts(); let lo = Math.min(0, ...P.map(q => q[1])), hi = Math.max(0, ...P.map(q => q[1])); const span = Math.max(4, hi - lo); const mid = (lo + hi) / 2; return { lo: mid - span * 0.65, hi: mid + span * 0.65 }; };
    const X = t => PADL + t * (W - PADL - PADR), Y = dy => { const r = range(); return PADT + (1 - (dy - r.lo) / (r.hi - r.lo)) * (H - PADT - PADB); };
    const tOf = px => Math.max(0, Math.min(1, (px - PADL) / (W - PADL - PADR))), dyOf = py => { const r = range(); return r.lo + (1 - (py - PADT) / (H - PADT - PADB)) * (r.hi - r.lo); };
    const draw = () => {
      const g = cv.getContext('2d'), P = pts(), r = range();
      g.clearRect(0, 0, W, H);
      g.strokeStyle = '#242a33'; g.lineWidth = 1;
      for (const dy of [r.lo, 0, r.hi]) { const y = Y(dy); g.beginPath(); g.moveTo(PADL, y); g.lineTo(W - PADR, y); g.stroke(); g.fillStyle = '#7d8996'; g.font = '10px system-ui'; g.fillText((dy >= 0 ? '+' : '') + dy.toFixed(1) + ' m', 2, y + 3); }
      const pr = PG.runwayProfile(Object.assign({}, PG.RUNWAY_DEF, e, { profile: P }));
      g.strokeStyle = '#6fd08c'; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 120; i++) { const t = i / 120, y = Y(pr.at(t * e.len)); if (i) g.lineTo(X(t), y); else g.moveTo(X(t), y); }
      g.stroke();
      P.forEach((q, i) => { g.fillStyle = i === sel ? '#ffb03a' : '#dfe6ee'; g.beginPath(); g.arc(X(q[0]), Y(q[1]), i === 0 || i === P.length - 1 ? 4 : 5, 0, 6.283); g.fill(); });
      g.fillStyle = '#7d8996'; g.fillText('end 0', PADL, H - 5); g.fillText('end 1', W - PADR - 28, H - 5);
      const iss = PG.profileIssues(Object.assign({}, PG.RUNWAY_DEF, e, { profile: P }));
      note.textContent = iss.length ? iss.join(' · ') : 'a monotone spline through the points; drag one, double-click the curve to add, ✕ removes the selected';
      note.className = 'note' + (iss.length ? ' bad' : '');
    };
    const near = ev => { const rct = cv.getBoundingClientRect(), px = (ev.clientX - rct.left) * W / rct.width, py = (ev.clientY - rct.top) * H / rct.height; const P = pts(); let best = -1, bd = 9; P.forEach((q, i) => { const d = Math.hypot(X(q[0]) - px, Y(q[1]) - py); if (d < bd) { bd = d; best = i; } }); return { i: best, px, py }; };
    cv.addEventListener('mousedown', ev => { if (ev.button !== 0) return; const n = near(ev); sel = n.i; dragging = sel >= 0; draw(); ev.preventDefault(); ev.stopPropagation(); });
    addEventListener('mousemove', ev => { if (!dragging || sel < 0 || !active) return; const n = near(ev); const P = pts().map(q => q.slice()); const t = (sel === 0) ? 0 : (sel === P.length - 1) ? 1 : Math.max(P[sel - 1][0] + 0.01, Math.min(P[sel + 1][0] - 0.01, tOf(n.px))); P[sel] = [+t.toFixed(3), +dyOf(n.py).toFixed(2)]; e.profile = P; R.setRecord(rec); draw(); });
    addEventListener('mouseup', () => { if (!dragging) return; dragging = false; const P = pts(); ed(x => { x.profile = P.map(q => q.slice()); }, 'profile of ' + e.id); });
    cv.addEventListener('dblclick', ev => { const n = near(ev); if (n.i >= 0) return; const P = pts().map(q => q.slice()); const t = +tOf(n.px).toFixed(3); const pr = PG.runwayProfile(Object.assign({}, PG.RUNWAY_DEF, e, { profile: P })); P.push([t, +pr.at(t * e.len).toFixed(2)]); P.sort((a, b) => a[0] - b[0]); ed(x => { x.profile = P; }, 'profile point of ' + e.id); ev.stopPropagation(); });
    const btns = $('div', { style: 'display:flex;gap:6px;margin-top:4px' });
    const del = $('button', { class: 'btn pill', type: 'button', text: '✕ remove the selected point' }); del.onclick = () => { const P = pts(); if (sel <= 0 || sel >= P.length - 1) return; const Q = P.filter((q, i) => i !== sel); sel = -1; ed(x => { x.profile = Q; }, 'profile point of ' + e.id); };
    const flat = $('button', { class: 'btn pill', type: 'button', text: 'level' }); flat.onclick = () => ed(x => { x.profile = [[0, 0], [1, 0]]; x.slope = 0; }, 'profile of ' + e.id);
    btns.appendChild(del); btns.appendChild(flat); wrap.appendChild(btns);
    draw();
  }
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
    rows.slider(insp, 'premises seed', 1, 99, 1, () => rec.seed, v => { rec.seed = v; dirty('zones'); }, v => String(v));
    // THE THEME (v9): one word on the record; the themes are the composer's table
    rows.pills(insp, 'theme', Object.keys(PG.THEMES).map(k => [k, PG.THEMES[k].name, PG.THEMES[k].blurb || '']), () => rec.theme || PG.THEME_DEF, v => { rec.theme = v; dirty('zones'); });
    rows.note(insp, PG.themeOf(rec).blurb || '');
    // THE PAVEMENT (v1.16): the premises' recipe - every knob of the bench's table, over the module's
    // defaults, under each strip's or road's own; a bench export pasted fills it whole
    if (PAVM) {
      const d = $('details'); d.appendChild($('summary', { text: 'pavement' + (rec.pavement && Object.keys(rec.pavement).length ? ' (' + Object.keys(rec.pavement).length + ' set)' : '') })); insp.appendChild(d);
      const P = rec.pavement || {};
      let sec = null;
      for (const row of PAVM.KNOBS) {
        if (row.length === 1) { sec = $('details'); sec.appendChild($('summary', { text: row[0].replace(/—/g, '').trim() })); d.appendChild(sec); continue; }
        const [k, lab, mn, mx, st] = row, own = P[k] !== undefined && P[k] !== null;
        rows.slider(sec || d, lab + (own ? '' : ' (default)'), mn, mx, st, () => own ? P[k] : PAVM.RECIPE[k], v => { rec.pavement = Object.assign({}, rec.pavement, { [k]: v }); dirty('roads'); }, v => (+v).toFixed(2));
      }
      const ta2 = $('textarea', { placeholder: 'paste the pavement bench\'s export here', rows: '3' }); ta2.className = 'pr-paste'; d.appendChild(ta2);
      rows.button(d, 'take the bench\'s recipe', () => { try { const o = JSON.parse(ta2.value); const r = o.recipe || o; const out = {}; for (const k in r) if (k in PAVM.RECIPE && k !== 'grade') out[k] = r[k]; rec.pavement = out; ta2.value = ''; dirty('roads'); inspector.refresh(); } catch (err) { strip.status('not a recipe: ' + err.message); } });
      rows.button(d, "back to the module's defaults", () => { rec.pavement = null; dirty('roads'); inspector.refresh(); });
    }
    rows.note(insp, 'autosaved to ' + LS_WIP + ' a second after every edit; a load replaces');
  }
  // THE PAVEMENT ROWS (contract v1.16, 2026-09-22): a look (the pavement class + preset), a BAND (the
  // drawn band beside the pavement - never the terraforming, which is "terraformed to" below) and a
  // collapsed WEAR section: the entry's own knobs among PAVEMENT.ENTRY_KNOBS, each the premises'
  // until touched (the zones' `rules` idiom), a button back
  const PAVM = (typeof PAVEMENT !== 'undefined') ? PAVEMENT : null;
  function pavRows(e, id, layer, ed, lookRow) {
    if (!PAVM) return;
    const L = lookRow || null;
    rows.slider(insp, 'band (m)', 0, 60, 0.5, () => (e.band === null || e.band === undefined) ? -0.5 : e.band, v => ed(x => { x.band = v < 0 ? null : v; }, 'band of ' + id, 'band'),
      v => v < 0 ? "the look's" : v.toFixed(1) + ' m');
    rows.note(insp, 'the band is the ground drawn beside the pavement - the cleared earth beside a strip, the gravel beside a road - fading into the terrain past it');
    const RS = PAVM.resolve(e, rec, L);
    const label = { paintAge: 'paint age', crackK: 'cracks', rubberK: 'rubber (touchdown)', laneW: 'lane width (m)', wet: 'wet', mossK: 'moss', patchK: 'patches' };
    const K = {}; for (const row of PAVM.KNOBS) if (row.length > 1) K[row[0]] = row;
    const d = $('details'); const sm = $('summary', { text: 'wear' + (e.pav && Object.keys(e.pav).some(k => PAVM.ENTRY_KNOBS.indexOf(k) >= 0) ? ' (its own)' : '') }); d.appendChild(sm); insp.appendChild(d);
    for (const k of PAVM.ENTRY_KNOBS) {
      if (k === 'rubberK' && layer !== 'runways') continue;
      if (k === 'laneW' && RS.cls !== 'concrete') continue;
      const row = K[k]; if (!row) continue;
      const own = e.pav && e.pav[k] !== undefined && e.pav[k] !== null;
      rows.slider(d, (label[k] || k) + (own ? '' : ' (the premises\')'), row[2], row[3], row[4], () => RS.recipe[k], v => ed(x => { x.pav = Object.assign({}, x.pav, { [k]: v }); }, k + ' of ' + id, 'pav:' + k), v => (+v).toFixed(2));
    }
    if (layer === 'roads') rows.pills(d, 'marks', [['auto', 'by class'], ['none', 'none'], ['edges', 'edge lines'], ['centre', 'centre line']], () => (e.pav && e.pav.marks) || 'auto', v => ed(x => { x.pav = Object.assign({}, x.pav, { marks: v === 'auto' ? undefined : v }); }, 'marks of ' + id));
    if (e.pav) rows.button(d, "back to the premises' wear", () => ed(x => { x.pav = null; }, 'wear of ' + id));
  }
  function viewRows() {
    rows.section(insp, 'VIEW');
    if (ctx.cameras) rows.select(insp, 'camera', [['orbit', 'orbit (right-drag)'], ['map', 'map (top-down)']], () => ctx.cameras.mode(), v => ctx.cameras.set(v));
    rows.check(insp, 'surface overlay', () => ctx.overlayOn ? ctx.overlayOn() : true, v => { R.overlayOn(v); ctx.overlayOn && ctx.overlayOn(v); ctx.redraw && ctx.redraw(); });
    // THE TIME (SKY chantier): the clock's hand in the world editor - one clock for the shed and the world
    if (ctx.day && ctx.day.day && ctx.day.day()) {
      const CK = ctx.day;
      rows.section(insp, 'TIME');
      rows.select(insp, 'time of day', CK.PRESETS.map(p => [p, p]), () => CK.nearestPreset(), v => { CK.preset(v); if (ctx.redraw) ctx.redraw(); });
      rows.slider(insp, 'local hour', 0, 24, 1 / 12, () => CK.localHours(), v => CK.set({ localHours: v }),
                  v => String(Math.floor(v)).padStart(2, '0') + ':' + String(Math.round((v % 1) * 60)).padStart(2, '0'));
      rows.select(insp, 'rate', CK.RATES.map(r => [String(r), r === 0 ? 'frozen' : r === 1 ? 'real time' : r + 'x']), () => String(CK.day().rate), v => CK.rate(+v));
      // THE CLOUDS (C4): the day's cover and type
      rows.slider(insp, 'cloud cover', 0, 1, 0.05, () => CK.day().cloudCover, v => CK.set({ cloudCover: v }), v => (v * 100).toFixed(0) + ' %');
      if (typeof CLOUD_FIELD !== 'undefined') rows.select(insp, 'cloud type', CLOUD_FIELD.TYPE_ORDER.map(t => [t, CLOUD_FIELD.TYPES[t].label]), () => CK.day().cloudType, v => CK.set({ cloudType: v }));
      // THE UPPER DECKS (A6): the same two rows the flight rail carries, per deck
      if (typeof CLOUD_FIELD !== 'undefined') for (let di = 0; di < CLOUD_FIELD.MAX_LAYERS - 1; di++) {
        const up = () => CK.day().cloudUpper[di] || { cover: 0, type: 'ac' };
        const put = patch => { CK.set({ cloudUpper: CLOUD_FIELD.upperWith(CK.day().cloudUpper, di, patch) }); if (ctx.redraw) ctx.redraw(); };
        rows.slider(insp, 'upper deck ' + (di + 1), 0, 1, 0.05, () => up().cover, v => put({ cover: v }), v => v > 0 ? (v * 100).toFixed(0) + ' %' : 'none');
        rows.select(insp, 'deck ' + (di + 1) + ' type', CLOUD_FIELD.TYPE_ORDER.map(t => [t, CLOUD_FIELD.TYPES[t].label]), () => up().type, v => put({ type: v }));
        rows.slider(insp, 'deck ' + (di + 1) + ' base', 500, 9000, 100, () => (up().base != null ? up().base : CLOUD_FIELD.TYPES[CLOUD_FIELD.typeOf(up().type)].alt), v => put({ base: v }), v => v + ' m');
      }
      rows.note(insp, 'the sun, the sky and the lights follow the clock; drag a LIGHT slider below to take the sun by hand');
    }
    if (ctx.rig) {
      rows.section(insp, 'LIGHT');
      // dragging either sun slider takes the rig MANUAL (the day drives it otherwise - SKY chantier)
      rows.slider(insp, 'sun elev', 2, 90, 0.5, () => ctx.rig.get().elev, v => ctx.rig.set({ manual: true, elev: v }), v => v.toFixed(1) + '°');
      rows.slider(insp, 'sun azimuth', -180, 180, 1, () => ctx.rig.get().azim, v => ctx.rig.set({ manual: true, azim: v }), v => v.toFixed(0) + '°');
      rows.slider(insp, 'exposure', 0.3, 2.5, 0.02, () => ctx.rig.get().exposure, v => ctx.rig.set({ exposure: v }));
      if (ctx.rig.get().manual !== undefined) rows.check(insp, 'the sun by hand', () => !!ctx.rig.get().manual, v => ctx.rig.set({ manual: !!v }));
    }
    rows.note(insp, 'Tab toggles the camera; Esc cancels; Del deletes; Ctrl+Z / Ctrl+Y undo and redo; 1-6 pick a section');
  }

  // THE LIFE (SCENERY LIFE, contract v1.22): the record's `life` block - the people, the wall clutter, the rubbish,
  // the parked cars, the small structures and the antennas the renderer stands round what is built, by laws
  // (src/viewer/scenery_life.js); a row writes the block and the life re-stands at once (no recompose); a key
  // left at its default is not written
  let lifeT = 0;
  function lifeRows() {
    const SL = window.SCENERY_LIFE, L = R.life;
    rows.section(insp, 'LIFE');
    if (!SL || !L) { rows.note(insp, 'this page has no scenery life (scenery_life.js did not load)'); return; }
    const cur = () => Object.assign({}, SL.DEF, rec.life || {});
    const note = rows.note(insp, '');
    const show = () => { const S = L.stats, c = S.byCat || {};
      note.textContent = !cur().on ? 'off: the premises as built' : (S.items || 0).toLocaleString() + ' placed (' + SL.CATS.filter(q => c[q[0]]).map(q => c[q[0]] + ' ' + q[1]).join(', ') + ') in ' + (S.placeMs || 0).toFixed(0) +
        ' ms · ' + (S.visible || 0).toLocaleString() + ' drawn now in ' + (S.draws || 0) + ' draws · lists ' + (S.updMs || 0).toFixed(1) + ' ms'; };
    const setK = (k, v) => {
      const c = Object.assign({}, rec.life || {});
      if (v === SL.DEF[k]) delete c[k]; else c[k] = v;
      rec.life = Object.keys(c).length ? c : undefined;
      L.set(rec.life); autosave(); ctx.redraw && ctx.redraw();
      clearTimeout(lifeT); lifeT = setTimeout(show, 1200);
    };
    rows.pills(insp, 'life', [['on', 'on', 'the life stands round what is built'], ['off', 'off', 'none of it: the premises as built']], () => (cur().on ? 'on' : 'off'), v => { setK('on', v === 'on'); show(); });
    rows.slider(insp, 'draw distance', 0.25, 2, 0.05, () => cur().dist, v => setK('dist', +v), v => 'x' + (+v).toFixed(2));
    for (const [k, lab, mx, why] of SL.CATS) { const r = rows.slider(insp, lab, 0, mx, 0.05, () => cur()[k], v => setK(k, +v), v => (+v === 0 ? 'none' : 'x' + (+v).toFixed(2))); r.title = why; }
    rows.slider(insp, 'life seed', 1, 99, 1, () => cur().seed, v => setK('seed', +v), v => String(v));
    rows.button(insp, 'back to the defaults', () => { rec.life = undefined; L.set(null); autosave(); inspector.refresh(); });
    rows.note(insp, 'every kind is drawn instanced and cut by distance (rubbish 45 m, clutter 110, people 220, cars 450, a mast 6 km) x the draw distance x the GRAPHICS tier');
    show();
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
  let downAt = null, swallowClick = false;
  view.addEventListener('mousedown', ev => { if (!active) return; if (ev.button === 0) { downAt = [ev.clientX, ev.clientY]; if (onDown(ev)) ev.stopPropagation(); } });
  addEventListener('mousemove', ev => { if (active) onMove(ev); });
  addEventListener('mouseup', ev => { if (!active) return; if (swallowClick) { swallowClick = false; downAt = null; return; } if (onUp()) return; if (ev.button === 0 && downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) < 4 && (ev.target === view || ev.target === view.querySelector('canvas'))) onClick(ev); downAt = null; });   // the sheet itself, or the bench's canvas in it - never a plate or a pill over it (G398.1)
  view.addEventListener('dblclick', ev => { if (active && ev.button === 0) onDblClick(ev); });
  addEventListener('keydown', ev => { if (active) onKey(ev); });

  // the record the host hands in (the game's: the one its world composed at the boot) comes first; else the wip slot
  if (ctx.record) { try { const U = PG.unwrap(ctx.record); rec = U.rec; recName = U.name; } catch (e) { console.warn('premises record:', e.message); } }
  else if (!ctx.fresh) loadWip();
  buildRail(); buildStrip(); ctx.onSection && ctx.onSection(SECTIONS.find(s => s.k === section));
  R.setRecord(rec); R.rebuild(null); inspector.refresh(); checks(); plaque();

  const handle = {
    record: () => rec, load, save, undo, redo, checks, select, setTool, setSection, plaque,
    get tool() { return tool; }, get section() { return section; }, get selected() { return selected; },
    cmd: (name, args) => {
      if (name === 'siteTheme') { SITE_THEME = args.key; return SITE_THEME; }   // the theme tool's pick, scriptable (G393.3)
      if (name === 'palette') { PALETTE_KEY = args.key; PALETTE_CAT = 'all'; return PALETTE_KEY; }   // the building tool's pick, scriptable (G393.3)
      if (name === 'add') { const e = Object.assign({ id: PG.newId(rec, args.layer) }, args.entry); run({ layer: args.layer, id: e.id, before: null, after: e, label: 'add ' + e.id }); return e.id; }
      if (name === 'set') { edit(args.id, PG.findById(rec, args.id).layer, x => Object.assign(x, args.patch), 'set ' + args.id); return true; }
      if (name === 'delete') { const f = PG.findById(rec, args.id); if (f) run({ layer: f.layer, id: args.id, before: clone(f.entry), after: null, label: 'delete ' + args.id }); return !!f; }
      if (name === 'point') { addPoint(args.x, args.z); return T.pts.length; }
      if (name === 'click') { const w = R.overlay.frame.toWorld(args.x, args.z); clickAt([w[0], R.heightAt(w[0], w[1]), w[1]]); return selected; }
      if (name === 'drag') {
        // a scripted drag: the selected feature's handle by key ('v0', 'm1', 'e0', 'c', 'i:<item>', 'at', 'hold:<id>') to a premises point
        if (!selected) throw new Error('premises: nothing selected');
        const hs = R.handles(selected);
        const h = hs.find(q => q.key === args.key);
        if (!h) throw new Error('premises: no handle ' + args.key + ' on ' + selected + ' (' + hs.map(q => q.key).join(', ') + ')');
        setTool('select'); select(selected);
        const hh = { id: selected, key: h.key, index: +(h.key.slice(1)) || 0, mid: h.key[0] === 'm' };
        if (!startDrag(hh)) throw new Error('premises: the drag did not start');
        const w = R.overlay.frame.toWorld(args.x, args.z);
        moveDrag([w[0], R.heightAt(w[0], w[1]), w[1]]);
        onUp();
        return true;
      }
      if (name === 'commit') { commitDrawing(); return selected; }
      if (name === 'resume') { return resumeDrawing(args.id || selected); }
      if (name === 'ctrl') { const hs = R.handles(selected); const h = args.key ? hs.find(q => q.key === args.key) : null; return ctrlEdit(selected, [args.x, args.z], h ? { key: h.key, index: +(h.key.slice(1)) || 0, mid: h.mid } : null); }
      if (name === 'tool') { setTool(args.name); return tool; }
      if (name === 'section') { setSection(args.name); return section; }
      throw new Error('premises: unknown cmd ' + name);
    },
    dirty: () => dirty(null),
    close() { active = false; host.innerHTML = ''; },   // the renderer is the host's to keep or dispose
    get active() { return active; },
  };
  return handle;
}

const CSS = `
.pr-rail{display:flex;flex-direction:column;gap:4px;padding:8px 6px;border-right:1px solid var(--grid,#242a33);width:64px;flex:none}
.pr-sec{background:transparent;color:var(--dim,#7d8996);border:1px solid transparent;border-radius:6px;padding:8px 2px;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px}
.pr-sec .ic{font-size:18px;line-height:1} .pr-sec .ic svg{display:block;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round} .pr-sec .lb{font-size:9px;letter-spacing:.1em}
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
