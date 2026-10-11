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

// THE TABS ARE PALETTES (G2910 SCENERY-ED-2; the user: "the tabs control the displayed action buttons, the right zone being
// a generic inspector"): a tab lights its tools and its palette drawer under them (the catalogue, the pickers, the file,
// the view, the life); the right plate is the SELECTION's inspector whatever tab is lit. Every polygon a tool draws is ONE
// AREA (contract v1.36) with the tool's properties attached - the inspector adds and removes the rest.
const SECTIONS = [
  { k: 'terrain',    label: 'TERRAIN',    icon: '⛰', tools: ['select', 'area', 'flatten', 'raise', 'ramp', 'surface', 'material', 'probe'] },
  { k: 'areas',      label: 'AREAS',      icon: '▱',  tools: ['select', 'area', 'rect', 'concrete', 'parking', 'dock', 'hatch', 'probe'] },
  { k: 'airfield',   label: 'AIRFIELD',   icon: '✈',  tools: ['select', 'runway', 'apron', 'pad', 'stand', 'probe'] },
  { k: 'roads',      label: 'ROADS',      icon: '⌇',  tools: ['select', 'road', 'probe'] },
  { k: 'zones',      label: 'ZONES',      icon: '▦',  tools: ['select', 'zone', 'probe'] },
  { k: 'vegetation', label: 'TREES',      icon: '♣',  tools: ['select', 'forest', 'biome', 'clear', 'tree', 'probe'] },
  { k: 'sites',      label: 'SITES',      icon: '⌂',  tools: ['select', 'building', 'theme', 'cable', 'probe'] },
  { k: 'objects',    label: 'OBJECTS',    icon: '⚑',  tools: ['select', 'prop', 'billboard', 'aircraft', 'animal', 'probe'] },
  { k: 'assets',     label: 'ASSETS',     icon: '▣',  tools: ['select', 'place', 'scatter'] },   // G2914: the model placer
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
  areas: 'M3 6l5-3.5 7 2.5-1.5 9.5L5 15.5Z|M6.5 9.5h5|M6.5 12h3',
  assets: 'M2.5 5.5L9 2l6.5 3.5v7L9 16l-6.5-3.5Z|M2.5 5.5L9 9l6.5-3.5|M9 9v7',
  vegetation: 'M9 2l5 8h-3l3 5H4l3-5H4Z|M9 15v1.5',
  sites: 'M3 9l6-6 6 6|M5 8v7h8V8|M8 15v-4h2v4',
  objects: 'M5 16V2|M5 3h9l-2 3 2 3H5',
  file: 'M5 2h6l3 3v11H5Z|M11 2v3h3|M7 9h4|M7 12h4',
  view: 'M2 9s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5Z|M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  life: 'M7 5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z|M4.5 16l1.3-6.2L7 7.2l1.4 2.4L9.5 16|M4 10.5l3-3.3 3 3.3|M13 16V9.5|M11.5 9.5h3l.4-2.5h-3.8Z',
};
const iconSvg = k => { const d = ICONS[k]; if (!d) return null; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 18 18'); svg.setAttribute('aria-hidden', 'true'); for (const q of d.split('|')) { const pth = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pth.setAttribute('d', q); svg.appendChild(pth); } return svg; };
const TOOL_LABEL = { area: 'an area', rect: 'a rectangle', concrete: 'concrete', parking: 'parking', dock: 'a dock', hatch: 'keep clear', place: 'place a model', scatter: 'scatter', select: 'select', flatten: 'flatten', raise: 'raise / lower', ramp: 'slope', material: 'material', road: 'trace a road', surface: 'surface', zone: 'zone', forest: 'forest', biome: 'vegetation', clear: 'no trees', tree: 'a tree', runway: 'runway', apron: 'apron / taxiway', pad: 'round pad', stand: 'the stand', building: 'a building', theme: 'the mine (theme)', cable: 'a cable', prop: 'a prop', billboard: 'a billboard', aircraft: 'an aeroplane', animal: 'animals', probe: 'probe' };
const TOOL_HELP = {
  // G2890 (the user: "I don't know how to edit an existing polygon"): the shape's whole grammar, said where the tool is
  select: 'click a feature to select it. Its shape: drag an orange disc to move a corner, a faint one to add a corner there, click its edge to add one; click a corner (white) and Del removes it - Del with no corner picked deletes the feature. A smooth road: drag a cyan disc to bend it',
  flatten: 'click the corners of the flat, then ✓ close (or double-click)',
  area: 'click the corners, close: ONE area with nothing attached yet - the inspector adds what it does (the ground, the wheels, a drawn surface, marks, no trees, a cover)',
  rect: 'click one corner, then the opposite one: a rectangle area (its turn, size and rounded corners in the inspector)',
  concrete: 'click the corners, close: poured concrete, drawn without repetition (the pavement), the wheels on paved, no trees or plots inside',
  parking: 'click one corner of the lot, then the opposite one: concrete with weathered parking bays (bay, depth, aisle in the inspector)',
  dock: 'click the corners of the quay, close: concrete with its edge line and bollard spots along the side that meets the water',
  hatch: 'click the corners, close: concrete with keep-clear hatching',
  place: 'pick a model in the palette, then click the ground to drop it; R turns the ghost 15 degrees, Alt + wheel scales it; each drop is one record you can select, drag, turn and scale',
  scatter: 'pick a model, click the ground: n of it within the radius (the palette sets them), each its own record',
  raise: 'click the corners, close; then set the lift in the inspector',
  ramp: 'click the corners, close: a constant slope, the middle at the height you set, rising toward the heading you set',
  road: 'click the road\'s points, then ✓ close (or double-click) — it is graded and worn; zones grow plots off it',
  surface: 'click the corners of the paved / gravel / sand patch, close',
  zone: 'click the corners of the zone, close; its kind, density and seed are in the inspector — plots grow along the roads inside it',
  forest: 'click the corners of the wood, close; density and species in the inspector',
  biome: 'click the corners of the area, close; then its vegetation in the inspector: none, any biome, or a new one (species and density)',
  clear: 'click the corners where no tree may grow, close',
  tree: 'click the ground to plant one tree; its species and size in the inspector',
  probe: 'click the ground to read its height, slope and surface',
  runway: 'click one end of the strip, then the other — it is graded to its profile, its class reaches the wheels, the pattern is derived',
  apron: 'click the corners of the paved apron or taxiway, close',
  pad: 'click the centre of the pad, then a point on its rim: a round paved apron, its edge a smooth circle - drag its two discs to move or resize it',
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
const POLY_TOOLS = { area: 'areas', flatten: 'areas', raise: 'areas', ramp: 'areas', surface: 'areas', apron: 'areas', material: 'areas', concrete: 'areas', dock: 'areas', hatch: 'areas', zone: 'zones', forest: 'zones', clear: 'areas', biome: 'areas' };
// the PBR sets the page has (the lot's and the site's texture sets), read at call time - a name each
function materialSets() {
  const S = Object.assign({}, (typeof LOT_TEX_SETS !== 'undefined' && LOT_TEX_SETS) || {}, (typeof SITE_TEX_SETS !== 'undefined' && SITE_TEX_SETS) || {});
  return Object.keys(S).filter(k => S[k] && S[k].diff).map(k => [k, (S[k].name || k) + ' · ' + S[k].tile + ' m']);
}
const TWO_POINT_TOOLS = { runway: 'runways', pad: 'areas', rect: 'areas', parking: 'areas' };   // (G2890: the round pad - its centre, then its rim; G2910: a rectangle's two corners)
const LINE_TOOLS = { road: 'roads' };
const POINT_TOOLS = { tree: 'objects', building: 'sites', theme: 'sites', prop: 'objects', billboard: 'objects', aircraft: 'objects', animal: 'objects' };
const OBJ_PICK = { prop: null, billboard: null, aircraft: null, animal: null };   // what the prop, billboard, aircraft and animal tools stand
let PALETTE_KEY = null;   // the building the 'building' tool stands
let SITE_THEME = null;    // the site theme the 'theme' tool stands (VILLAGE_GEN.THEMES; G393.3)
let PALETTE_CAT = null;   // the category the palette shows (v9)
let ITEM_FOCUS = null;    // the site item whose rows are open in the inspector (G398.1: a list, one row per item)
const LS_WIP_DEFAULT = 'flydiy.premises.wip';

// THE BIOMES AND THE SPECIES a vegetation polygon may name (G1385): the live handle's (the world rail edits it), else
// the payload's; a premises polygon's own '@' mix is not offered (it is that polygon's)
function biomeMixes() {
  const B = (typeof window !== 'undefined' && window.TREE_FILL && window.TREE_FILL.biomes && window.TREE_FILL.biomes()) || null;
  const P = (typeof TREE_PACK !== 'undefined' && TREE_PACK) || (typeof window !== 'undefined' && (window.TREE_PACK || window.TREE_PACK_REG)) || null;
  return (B && B.mixes) || (P && P.biomes && P.biomes.mixes) || {};
}
const biomeNames = () => Object.keys(biomeMixes()).filter(k => k[0] !== '@');
const biomeMix = name => biomeMixes()[name] || null;
function speciesNames() {
  const P = (typeof TREE_PACK !== 'undefined' && TREE_PACK) || (typeof window !== 'undefined' && (window.TREE_PACK || window.TREE_PACK_REG)) || null;
  return P && P.collections ? P.collections.filter(c => ['tree', 'dead', 'shrub', 'cover'].indexOf(c.kind || 'tree') >= 0).map(c => [c.name, (c.kind || 'tree') + ' · ' + c.name.replace(/\.glb$/, '').replace(/_/g, ' ')]) : [];
}
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
  const autosave = () => { if (!storage) return; clearTimeout(saveT); saveT = setTimeout(() => { saveT = 0; try { storage.setItem(LS_WIP, PG.envelope(recName, rec)); } catch (e) {} snapshot(); }, 1000); };
  // THE ROLLING HISTORY (G2917; the user: "at least the paths I trace manually should be kept safe"): the autosave is one
  // slot, so a bad edit autosaved over the good one was gone. Every HIST_MS of editing the record is also kept as a slot
  // named 'autosave <date time>' (the FILE section's 'load slot' lists them; the host's storage puts back what the boot
  // cut, as for any slot), the last HIST_N kept, the oldest dropped first - and dropped too when the storage is full.
  const HIST_N = 5, HIST_MS = 120000, HIST_PRE = 'flydiy.premises.slot.autosave ';
  let histT = 0;
  function snapshot(force) {
    if (!storage) return null;
    const now = Date.now(); if (!force && now - histT < HIST_MS) return null;
    histT = now;
    const d = new Date(now), p2 = v => String(v).padStart(2, '0');
    const key = HIST_PRE + d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    const list = () => { const out = []; for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.indexOf(HIST_PRE) === 0) out.push(k); } return out.sort(); };
    const txt = PG.envelope(recName, rec);
    for (let tries = 0; tries <= HIST_N; tries++) {
      try { storage.setItem(key, txt); break; }
      catch (e) { const l = list(); if (!l.length) return null; storage.removeItem(l[0]); }   // full: the oldest goes, then try again
    }
    const l = list(); while (l.length > HIST_N) { try { storage.removeItem(l.shift()); } catch (e) { break; } }
    return key;
  }
  // G1535 (UPDATE-NOW): the "Update" pill reloads the page - an edit still inside the autosave's second is written first
  if (typeof window !== 'undefined' && window.UPDATE_NOW && window.UPDATE_NOW.onBeforeUpdate)
    window.UPDATE_NOW.onBeforeUpdate(() => { if (!saveT || !storage) return; clearTimeout(saveT); saveT = 0; try { storage.setItem(LS_WIP, PG.envelope(recName, rec)); } catch (e) {} });

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
    // (G2910: an area's reach is its terraform's falloff, and a drawn pavement's band past its edge)
    if (entry.poly) { const b = PG.polyBBox(entry.poly), AP = entry.props || {}; const f = (+entry.falloff || +(AP.terraform && AP.terraform.falloff) || 0) + (AP.draw ? 12 : 0) + 4; return { x0: b.x0 - f, z0: b.z0 - f, x1: b.x1 + f, z1: b.z1 + f }; }
    if (entry.pts) { const b = PG.polyBBox(entry.curve === 'spline' ? PG.roadLine(entry) : entry.pts);   /* (G2890: a spline bows off its points) */ const f = (+entry.falloff || 6) + (+entry.w || +entry.width || 4); return { x0: b.x0 - f, z0: b.z0 - f, x1: b.x1 + f, z1: b.z1 + f }; }
    if (entry.kind === 'tree') return { x0: entry.x - 4, z0: entry.z - 4, x1: entry.x + 4, z1: entry.z + 4 };
    if (entry.c && entry.len) { const b = PG.polyBBox(PG.runwayBox(Object.assign({}, PG.RUNWAY_DEF, entry), 40)); return b; }
    if (entry.at && entry.items) { const SF = PG.siteFrame(entry); let b = null; for (const it of entry.items) { const q = SF.toLocal(it.x || 0, it.z || 0); const bb = { x0: q[0] - 40, z0: q[1] - 40, x1: q[0] + 40, z1: q[1] + 40 }; b = b ? { x0: Math.min(b.x0, bb.x0), z0: Math.min(b.z0, bb.z0), x1: Math.max(b.x1, bb.x1), z1: Math.max(b.z1, bb.z1) } : bb; } return b || { x0: entry.at.x - 10, z0: entry.at.z - 10, x1: entry.at.x + 10, z1: entry.at.z + 10 }; }
    return null;
  }
  const union = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) });
  // WHAT AN EDIT MOVED (G2917; the user: "a road with 250 points ... constant browser stuck window" - and "this one goes all
  // around the island"): a long line whose points alone changed rebuilds the SPAN that moved - six points either side of
  // the changed run (a C2 spline's change has fallen under a millimetre there; a graded road's smoothing reaches 24 m), its
  // width, falloff and clearing round it - never the line's whole box, which for an island road is the island. Anything
  // else (a width, a class, a grade limit, a polygon) rebuilds the whole entry's box as before.
  function changeBox(a, b) {
    const pa = a && a.pts, pb = b && b.pts;
    if (!pa || !pb || pa.length < 24 || pb.length < 24 || +b.grade > 0 || +a.grade > 0) return union(bboxOf(a), bboxOf(b));
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) if (k !== 'pts' && k !== 'tan' && JSON.stringify(a[k]) !== JSON.stringify(b[k])) return union(bboxOf(a), bboxOf(b));
    const ta = a.tan || [], tb = b.tan || [];
    const same = (i, j) => pa[i][0] === pb[j][0] && pa[i][1] === pb[j][1] && (pa[i][2] === pb[j][2]) && JSON.stringify(ta[i] || null) === JSON.stringify(tb[j] || null);
    let s = 0; while (s < pa.length && s < pb.length && same(s, s)) s++;
    let ea = pa.length - 1, eb = pb.length - 1; while (ea >= s && eb >= s && same(ea, eb)) { ea--; eb--; }
    if (s > ea && s > eb && pa.length === pb.length) return { x0: pa[0][0] - 1, z0: pa[0][1] - 1, x1: pa[0][0] + 1, z1: pa[0][1] + 1 };   // nothing moved: a box of nothing
    const K = 6, sub = (p, i0, i1) => p.slice(Math.max(0, i0 - K), Math.min(p.length, Math.max(i0, i1) + K + 1));
    const bb = PG.polyBBox(sub(pa, s, ea).concat(sub(pb, s, eb))), f = (+b.falloff || 6) + (+b.w || 4) + (PG.roadClearOf ? (PG.roadClearOf(b) || 0) : 0) + 20;
    return { x0: bb.x0 - f, z0: bb.z0 - f, x1: bb.x1 + f, z1: bb.z1 + f };
  }
  // which layers move the GROUND (and so the chunks): terrain, and roads (graded)
  const groundLayer = layer => layer === 'terrain' || layer === 'roads' || layer === 'runways' || layer === 'material' || layer === 'areas';
  // (G2914: a command may carry MANY entries - the scatter's models - one undo step, one rebuild)
  const cmdBox = c => (c.many ? c.many.reduce((b, q) => union(b, union(bboxOf(q.before), bboxOf(q.after))), null) : changeBox(c.before, c.after));
  const cmdLayer = c => (c.many ? c.many[0].layer : c.layer);
  function run(cmd, isRedo) {
    if (cmd.many) for (const q of cmd.many) applyEntry(q.layer, q.id, clone(q.after));
    else applyEntry(cmd.layer, cmd.id, clone(cmd.after));
    undoS.push(cmd); if (!isRedo) redoS.length = 0;
    if (undoS.length > 200) undoS.shift();
    dirty(cmdLayer(cmd), cmdBox(cmd), cmd.many ? undefined : groundOf(cmd.layer, cmd.before, cmd.after));
    strip.status('' + cmd.label);
  }
  function undo() { const c = undoS.pop(); if (!c) return; if (c.many) for (const q of c.many.slice().reverse()) applyEntry(q.layer, q.id, clone(q.before)); else applyEntry(c.layer, c.id, clone(c.before)); redoS.push(c); dirty(cmdLayer(c), cmdBox(c), c.many ? undefined : groundOf(c.layer, c.before, c.after)); strip.status('undo: ' + c.label); }
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
      soonDirty(layer, changeBox(before, e), groundOf(layer, before, e));
      return;
    }
    const cmd = { layer, id, before, after: clone(e), label };
    applyEntry(layer, id, clone(e));
    undoS.push(cmd); redoS.length = 0;
    coalesce = key ? { id, key, t: Date.now() } : null;
    if (key) soonDirty(layer, changeBox(before, e), groundOf(layer, before, e)); else dirty(layer, changeBox(before, e), groundOf(layer, before, e));
  }
  // A SLIDER REBUILDS ONCE IT RESTS (G2917; the user's recorder log: one traffic slider's input events were 96 s, 79 s and
  // 72 s frames - every event of the drag a whole rebuild, the island road's 274 cars made again each time): a slider's
  // edit writes the record at once and its rebuild 200 ms after the hand stops; anything else that rebuilds takes the
  // waiting one with it (dirty below), so the record and the world never disagree past the pause
  let PEND = null;
  function soonDirty(layer, bbox, ground) {
    if (PEND) { clearTimeout(PEND.t); PEND = { layer: PEND.layer === layer ? layer : null, bbox: union(PEND.bbox, bbox), ground: PEND.ground === false && ground === false ? false : undefined }; }
    else PEND = { layer, bbox, ground };
    PEND.t = setTimeout(() => { const p = PEND; PEND = null; if (p) dirty(p.layer, p.bbox, p.ground); }, 200);
  }

  // ---- the renderer, dirty, the checks, the plaque ---------------------------
  let chkT = 0;
  // G1400 (EDITOR-LAG): A STRIP'S WAY OUT IS NOT ITS GROUND. A runways edit that changed only the stand, the taxi points
  // (taxiOut, taxiOut1) or the site (an authored pattern's holds) makes no terrain modifier - the strip's grade reads its
  // centre, length, heading, profile, never the way out - so its commit rebuilds as a non-ground layer: no ground patch,
  // no re-sample of the world's ground under the premises (5-9 s of a taxi point's commit, headless)
  const WAY_KEYS = { stand: 1, taxiOut: 1, taxiOut1: 1, site: 1 };
  // G2917 (the user: "changing the traffic amount freezes it for a while - maybe 3 minutes"): A ROAD'S TRAFFIC IS NOT ITS
  // GROUND either - its traffic, its guardrail, its power line, its life, its name make no modifier and move no cover: no
  // patch, no ground re-sample (the cars, the rails, the poles are rebuilt by the renderer's own sync)
  const ROAD_FREE = { traffic: 1, rail: 1, poles: 1, life: 1, name: 1 };
  const groundOf = (layer, a, b) => {
    if ((layer !== 'runways' && layer !== 'roads') || !a || !b) return undefined;
    const free = layer === 'runways' ? WAY_KEYS : ROAD_FREE;
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    for (const k of keys) if (!free[k] && JSON.stringify(a[k]) !== JSON.stringify(b[k])) return undefined;
    return false;
  };
  function dirty(layer, bbox, ground) {
    if (PEND) { clearTimeout(PEND.t); const p = PEND; PEND = null; if (layer !== p.layer) layer = null; bbox = union(bbox, p.bbox); if (!(ground === false && p.ground === false)) ground = undefined; }
    R.setRecord(rec);
    if (!layer) R.rebuild(null);
    else if (groundLayer(layer) && ground !== false) R.rebuild(bbox ? { layer, bbox, pad: 2 } : null);
    else R.rebuild({ layer, bbox: bbox || { x0: 0, z0: 0, x1: 0, z1: 0 }, ground: false });   // no chunk touched: outlines, plots, houses, trees
    inspector.refresh();
    autosave();
    ctx.onRebuilt && ctx.onRebuilt(layer || null, ground, layer ? bbox || null : null);   // the game re-samples its ground rings (G1400: told the layer and a ground left as it was; G2917: and the box it moved, in the premises frame)
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

  // ---- the layout: rail | (strip + its palette over the view) | inspector -------------------
  // (G2910: the host may stand the rail apart - els.rail, the game's left plate - so the right plate is the inspector alone)
  host.innerHTML = '';
  const rail = $('div', { class: 'pr-rail' });
  const insp = $('div', { class: 'pr-insp' });
  if (els.rail) { els.rail.innerHTML = ''; els.rail.appendChild(rail); } else host.appendChild(rail);
  host.appendChild(insp);
  // THE PALETTE DRAWER (G2910): what a tab offers besides its tools - the building catalogue, the objects' pickers, the
  // model bank, the file, the view, the life - under the tool strip, never in the inspector
  const pal = $('div', { class: 'pr-insp pr-pal' });
  if (!els.strip) host.appendChild(pal);
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
    els.strip.appendChild(pal);
  }
  // (G2910: a tab lights its tools and its palette; the inspector keeps the selection)
  function setSection(k) { section = k; cancelTool(); tool = 'select'; buildRail(); buildStrip(); palette.refresh(); inspector.refresh(); ctx.onSection && ctx.onSection(SECTIONS.find(s => s.k === k)); }
  function setTool(t) { cancelTool(); tool = t; for (const k in toolBtns) toolBtns[k].classList.toggle('on', k === t); strip.help(TOOL_HELP[t] || ''); if (t !== 'select') select(null); if (typeof armGhost === 'function') armGhost(); }

  // ---- the tool state machine ----------------------------------------------------
  const T = { state: 'armed', pts: [] };
  function cancelTool() { T.state = 'armed'; T.pts = []; T.pick = null; T.resume = null; T.line = false; T.plotPick = null; R.ghost(null); if (drawBtns) drawBtns.style.display = 'none'; ctx.redraw && ctx.redraw(); }
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
      edit(id, f.layer, x => { (x.poly || x.pts).splice(h.index, 1); tanSplice(x, h.index, 1, 0); }, 'corner of ' + id + ' removed'); strip.status('corner removed - ' + (e.poly || e.pts).length + ' left');
      return true;
    }
    const q = [+L[0].toFixed(2), +L[1].toFixed(2)];
    edit(id, f.layer, x => { const a = x.poly || x.pts; if (x.pts && a.length >= 2 && Math.hypot(a[0][0] - q[0], a[0][1] - q[1]) < Math.hypot(a[a.length - 1][0] - q[0], a[a.length - 1][1] - q[1])) { a.unshift(q); tanSplice(x, 0, 0, 1); } else { a.push(q); tanSplice(x, a.length - 1, 0, 1); } }, 'corner added to ' + id); strip.status('corner added - ' + (e.poly || e.pts).length + ' now; Ctrl+click adds another');
    return true;
  }
  // ---- THE SHAPE'S HAND (G2890 SCENERY-ED-1) --------------------------------------------------------------------------
  // a spline road's handles (`tan`, contract v1.35) run beside its points: every insert or removal moves them with it
  function tanSplice(x, i, del, ins) { if (!x || !Array.isArray(x.tan)) return; const add = []; for (let k = 0; k < ins; k++) add.push(null); x.tan.splice(i, del, ...add); }
  // the CORNER picked: an orange disc clicked (or dragged) turns white; Del removes that corner, not the feature
  let corner = null;
  const setCorner = i => { corner = (i === null || i === undefined || !isFinite(+i)) ? null : +i; if (R.corner) R.corner(corner); };
  const shapeOf = e => (e && !PG.roundOk(e.round) && !PG.rectOk(e.rect) ? (e.poly || e.pts || null) : null);   // (a round or a rectangle has no corners until freed)
  function removeCorner(id, i) {
    const f = PG.findById(rec, id); if (!f) return false;
    const arr = shapeOf(f.entry); if (!arr || !(i >= 0 && i < arr.length)) return false;
    if (arr.length <= (f.entry.poly ? 3 : 2)) { strip.status('a ' + (f.entry.poly ? 'polygon keeps three corners' : 'road keeps two points')); return true; }
    edit(id, f.layer, x => { (x.poly || x.pts).splice(i, 1); tanSplice(x, i, 1, 0); }, 'corner ' + (i + 1) + ' of ' + id + ' removed');
    setCorner(null); strip.status('corner removed - ' + (f.entry.poly || f.entry.pts).length + ' left');
    return true;
  }
  // a corner on the selected shape's edge where the click was: within a few screen pixels of the outline (a road: of its
  // drawn line, inside its width); the corner goes on the authored segment the click is nearest
  function edgeTol(g) {
    const cam = ctx.camera && ctx.camera(); if (!cam || !cam.position) return 1.5;
    const span = cam.isOrthographicCamera ? (cam.top - cam.bottom) / (cam.zoom || 1) : Math.hypot(cam.position.x - g[0], cam.position.y - g[1], cam.position.z - g[2]) * 1.2;
    return Math.max(0.5, Math.min(30, span * 0.012));
  }
  function edgeInsert(id, L, tol) {
    const f = PG.findById(rec, id); if (!f) return false;
    const e = f.entry, arr = shapeOf(e); if (!arr || arr.length < 2) return false;
    const closed = !!e.poly, nSeg = closed ? arr.length : arr.length - 1;
    let best = -1, bd = Infinity, bq = null, bt = 0;
    for (let i = 0; i < nSeg; i++) {
      const a = arr[i], b = arr[(i + 1) % arr.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((L[0] - a[0]) * dx + (L[1] - a[1]) * dz) / l2)), q = [a[0] + dx * t, a[1] + dz * t], d = Math.hypot(L[0] - q[0], L[1] - q[1]);
      if (d < bd && t > 0.02 && t < 0.98) { bd = d; best = i; bq = q; bt = t; }
    }
    if (best < 0) return false;
    // a road: the click is measured from its DRAWN line (a spline bows off its points), and its width counts
    let dEdge = bd;
    if (e.pts) { const ln = PG.roadLine(e); dEdge = Infinity; for (let i = 0; i + 1 < ln.length; i++) dEdge = Math.min(dEdge, PG.distPtSeg(L[0], L[1], ln[i], ln[i + 1])); dEdge -= (+e.w || 3.6) / 4; bq = [L[0], L[1]]; }   // (the inner half of the carriageway: a click on its verge still selects)
    if (dEdge > tol) return false;
    const q = [+bq[0].toFixed(2), +bq[1].toFixed(2)];
    { const A = arr[best], B = arr[(best + 1) % arr.length]; if (A.length > 2) q.push(+((A[2] || 0) + ((B[2] || 0) - (A[2] || 0)) * bt).toFixed(2)); }   // (a grade's point carries its height)
    edit(id, f.layer, x => { (x.poly || x.pts).splice(best + 1, 0, q); tanSplice(x, best + 1, 0, 1); }, 'corner added to ' + id);
    setCorner(best + 1);
    strip.status('corner ' + (best + 2) + ' added on the edge - ' + (e.poly || e.pts).length + ' now; drag it, or Del removes it');
    return true;
  }
  // every edge split at its middle (a polygon's closing edge too): the shape keeps its outline and doubles its corners
  function subdivide(id) {
    const f = PG.findById(rec, id); if (!f) return false;
    const e = f.entry, arr = shapeOf(e); if (!arr) return false;
    if (arr.length > 256) { strip.status('refused: ' + arr.length + ' corners is enough'); return true; }
    edit(id, f.layer, x => {
      const a = x.poly || x.pts, out = [], tn = Array.isArray(x.tan) ? [] : null;
      for (let i = 0; i < a.length; i++) {
        out.push(a[i]); if (tn) tn.push(x.tan[i] || null);
        if (i + 1 < a.length || x.poly) { const b = a[(i + 1) % a.length]; const m = [+((a[i][0] + b[0]) / 2).toFixed(2), +((a[i][1] + b[1]) / 2).toFixed(2)]; if (a[i].length > 2) m.push(+(((a[i][2] || 0) + (b[2] || 0)) / 2).toFixed(2)); out.push(m); if (tn) tn.push(null); }
      }
      if (x.poly) x.poly = out; else x.pts = out;
      if (tn) x.tan = tn;
    }, 'subdivide ' + id);
    setCorner(null);
    strip.status(id + ' subdivided: ' + (f.entry.poly || f.entry.pts).length + ' corners');
    return true;
  }
  // a plot's ground switched (the zone's `rules.noGround`, contract v1.35): the pick mode's click
  function togglePlotGround(zid, L) {
    const p = (R.plots ? R.plots() : []).find(q => q.zone === zid && q.poly && PG.inPoly(q.poly, L[0], L[1]));
    if (!p) { strip.status('no plot of ' + zid + ' there - click inside one of its plots (Esc ends)'); return true; }
    edit(zid, 'zones', x => { const r2 = Object.assign({}, x.rules); const l = Array.isArray(r2.noGround) ? r2.noGround.slice() : []; const k = l.indexOf(p.id); if (k >= 0) l.splice(k, 1); else l.push(p.id); if (l.length) r2.noGround = l; else delete r2.noGround; x.rules = r2; }, 'plot ground of ' + p.id);
    const off = ((PG.findById(rec, zid).entry.rules || {}).noGround || []).indexOf(p.id) >= 0;
    strip.status('plot ' + p.id + ': ground ' + (off ? 'off' : 'on') + ' - click another, Esc ends');
    return true;
  }
  function ghostFeature() {
    if (!T.pts.length) return null;
    if (tool === 'pad' && T.pts.length >= 2) return { poly: PG.roundPoly({ c: T.pts[0], r: Math.max(1, Math.hypot(T.pts[1][0] - T.pts[0][0], T.pts[1][1] - T.pts[0][1])) }) };
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
      edit(id, f.layer, x => { if (x.poly) { x.poly = pts; delete x.round; delete x.rect; } else { x.pts = pts; if (Array.isArray(x.tan)) delete x.tan; } }, 'corners of ' + id);
      cancelTool(); select(id); strip.status(id + ' validated with ' + pts.length + (f.entry.poly ? ' corners' : ' points'));
      return;
    }
    if (tool === 'pad') {
      // A ROUND PAD (v1.35, G2890): a paved polygon whose circle is the truth - concrete until the inspector says otherwise
      if (T.pts.length < 2) { strip.status('click a point on the rim'); return; }
      const c = [+T.pts[0][0].toFixed(2), +T.pts[0][1].toFixed(2)], r = +Math.hypot(T.pts[1][0] - c[0], T.pts[1][1] - c[1]).toFixed(2);
      if (r < 3) { strip.status('refused: a pad is at least 3 m across its radius (' + r.toFixed(1) + ')'); return; }
      const round = { c, r };
      // (G2910: an AREA - its circle, concrete drawn, the wheels on paved; the inspector changes either)
      const e = { id: PG.newId(rec, 'areas'), poly: PG.roundPoly(round), round, props: { wheels: { surface: PG.SURFACE.PAVED }, draw: { look: 'concrete', z: 0 } } };
      run({ layer: 'areas', id: e.id, before: null, after: e, label: 'round pad ' + e.id });
      cancelTool(); select(e.id); return;
    }
    if (tool === 'rect' || tool === 'parking') {
      // A RECTANGLE (G2910): two opposite corners, square to the premises frame (its turn in the inspector); a parking lot is
      // one drawn concrete with its bays - the bays along its long side
      if (T.pts.length < 2) { strip.status('click the opposite corner'); return; }
      const a = T.pts[0], b = T.pts[1], hw = Math.abs(b[0] - a[0]) / 2, hd = Math.abs(b[1] - a[1]) / 2;
      if (hw < 1.5 || hd < 1.5) { strip.status('refused: a rectangle is at least 3 m each way'); return; }
      const rect = { c: [+((a[0] + b[0]) / 2).toFixed(2), +((a[1] + b[1]) / 2).toFixed(2)], hw: +hw.toFixed(2), hd: +hd.toFixed(2), yaw: 0, radius: 0 };
      const e = { id: PG.newId(rec, 'areas'), poly: PG.rectPoly(rect), rect, props: tool === 'parking' ? areaPreset('parking', null, rect) : {} };
      run({ layer: 'areas', id: e.id, before: null, after: e, label: (tool === 'parking' ? 'parking lot ' : 'rectangle ') + e.id });
      cancelTool(); select(e.id); return;
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
      // (G2890: a new road is a SMOOTH CURVE through its points - contract v1.35; the inspector's 'curve' takes it back to corners)
      const e = { id: PG.newId(rec, 'roads'), pts: T.pts.map(p => [p[0], p[1]]), w: 3.6, cls: 'gravel', graded: true, falloff: 6, curve: 'spline', clear: 2 };   // (G2918: no tree or grass within 2 m of its edge)
      run({ layer: 'roads', id: e.id, before: null, after: e, label: 'road ' + e.id });
      cancelTool(); select(e.id); return;
    }
    if (T.pts.length > 2 && Math.hypot(T.pts[0][0] - T.pts[T.pts.length - 1][0], T.pts[0][1] - T.pts[T.pts.length - 1][1]) < 0.5) T.pts.pop();
    if (T.pts.length < 3) { strip.status('a polygon needs three points'); return; }
    if (!PG.polySimple(T.pts)) { strip.status('refused: the polygon crosses itself'); return; }
    const poly = PG.ensureCCW(T.pts);
    const layer = POLY_TOOLS[tool];
    let e;
    if (tool === 'zone') e = { id: PG.newId(rec, 'zones'), kind: 'residential', poly, density: 1, seed: null, palette: null, rules: {} };
    else if (tool === 'forest') e = { id: PG.newId(rec, 'zones'), kind: 'forest', poly, density: 1, seed: null, palette: null, rules: {} };
    // (G2910) every other polygon is ONE AREA, the tool's properties attached
    else e = { id: PG.newId(rec, 'areas'), poly, props: areaPreset(tool, poly) };
    run({ layer, id: e.id, before: null, after: e, label: (e.kind || (layer === 'areas' ? TOOL_LABEL[tool] || 'area' : layer)) + ' ' + e.id });
    cancelTool(); select(e.id);
  }
  // WHAT A TOOL ATTACHES TO ITS AREA (G2910): the old tools' records, as properties - a flatten's level and bank, a gravel
  // patch that now DRAWS its gravel (the user: "the polygons saying 'gravel' ... do not seem to draw anything"), an apron
  // in concrete, a texture, no trees, a vegetation; the concrete, parking, dock and keep-clear presets
  function areaPreset(t, poly, rect) {
    const P = {};
    if (t === 'flatten') { const lv = medianLevel(poly); P.terraform = { kind: 'flatten', level: lv, falloff: bankFor(poly, lv, 10), abs: false, order: 0 }; }
    else if (t === 'raise') P.terraform = { kind: 'raise', dh: 2, falloff: 10 };
    else if (t === 'ramp') { const lv = medianLevel(poly); P.terraform = { kind: 'ramp', level: lv, slope: 0.02, hdg: 0, falloff: bankFor(poly, lv, 8) }; }
    else if (t === 'surface') { P.wheels = { surface: PG.SURFACE.GRAVEL }; P.draw = { look: 'gravel', z: 0 }; }
    else if (t === 'apron') { P.wheels = { surface: PG.SURFACE.PAVED, apron: true }; P.draw = { look: 'concrete', z: 0 }; }
    else if (t === 'material') { const sets = materialSets(); P.draw = { set: sets.length ? sets[0][0] : 'cracked', tile: null, fade: 4, z: 0 }; }
    else if (t === 'clear') P.exclude = { what: ['trees'] };
    // G1385: a cover polygon that says only what grows (no terrain type stamped); the first biome until picked
    else if (t === 'biome') { const bs = biomeNames(); P.cover = { code: null, veg: bs.length ? { mode: 'biome', mix: bs[0] } : { mode: 'none' } }; }
    else if (t === 'concrete' || t === 'parking' || t === 'dock' || t === 'hatch') {
      P.wheels = { surface: PG.SURFACE.PAVED }; P.draw = { look: 'concrete', z: 0 };
      if (t !== 'concrete') P.marks = { kind: t };
      // the marks' frame: a lot's bays run along its long side, a quay's line along the water, the hatching square to the shape
      if (t === 'parking' && rect) P.draw.yaw = +((rect.yaw || 0) + (rect.hw >= rect.hd ? 0 : Math.PI / 2)).toFixed(4);
      else if (poly) { const ed = t === 'dock' ? waterEdge(poly) : longestEdge(poly); if (ed) P.draw.yaw = +Math.atan2(ed[1][1] - ed[0][1], ed[1][0] - ed[0][0]).toFixed(4); }
    }
    return P;
  }
  // how much of each edge's outside is water (3 points 4 m out, the water 20 cm over the ground); null with no water here
  function waterWet(poly) {
    const F = R.overlay && R.overlay.frame; if (!F || !world.waterH) return null;
    return poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
      let wet = 0;
      for (const t of [0.25, 0.5, 0.75]) { const mx = a[0] + (b[0] - a[0]) * t, mz = a[1] + (b[1] - a[1]) * t, sg = PG.inPoly(poly, mx + nx * 0.5, mz + nz * 0.5) ? -1 : 1, w = F.toWorld(mx + nx * 4 * sg, mz + nz * 4 * sg), wl = world.waterH(w[0], w[1]); if (isFinite(wl) && wl > world.terrainH(w[0], w[1]) + 0.2) wet++; }
      return wet / 3;
    });
  }
  const longestEdge = poly => { let best = null, bl = -1; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > bl) { bl = l; best = [a, b]; } } return best; };
  // the edge whose outside is water (the longest of them), else the longest: three points 4 m out, the water over the ground
  function waterEdge(poly) {
    const W = waterWet(poly); if (!W) return longestEdge(poly);
    let best = null, bs = -1;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], sc = Math.hypot(b[0] - a[0], b[1] - a[1]) * (W[i] >= 0.6 ? 10 : 1); if (sc > bs) { bs = sc; best = [a, b]; } }
    return best;
  }

  // ---- selection, handles, dragging -------------------------------------------------
  let selected = null, drag = null;
  function select(id) { if (id !== selected) { corner = null; if (T.plotPick && T.plotPick !== id) T.plotPick = null; } selected = id; R.select(id); inspector.refresh(); ctx.onSelect && ctx.onSelect(id); ctx.redraw && ctx.redraw(); }
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
        // G2890: a round pad's centre / rim, a spline road's handle (keys 'rc' / 'rr', 'h<i>')
        if (PG.roundOk(e.round) && (h.key === 'rc' || h.key === 'rr')) { drag = { id: selected, layer: found.layer, round: h.key, before, F }; return true; }
        if (PG.rectOk(e.rect) && (h.key === 'qc' || h.key === 'qs')) { drag = { id: selected, layer: found.layer, rect: h.key, before, F }; return true; }   // (G2910: a rectangle's centre, its corner)
        if (e.pts && /^h[0-9]+$/.test(h.key)) { drag = { id: selected, layer: found.layer, tan: +h.key.slice(1), before, F }; return true; }
        const arr = e.poly || e.pts;
        if (h.mid) {
          const a = arr[h.index], b = arr[(h.index + 1) % arr.length];
          arr.splice(h.index + 1, 0, a.length > 2 ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] || 0) + (b[2] || 0)) / 2] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
          tanSplice(e, h.index + 1, 0, 1);
          drag = { id: selected, layer: found.layer, index: h.index + 1, before, F };
        } else drag = { id: selected, layer: found.layer, index: h.index, before, F };
        setCorner(drag.index);   // (G2890: the corner in the hand is the one picked)
        return true;
      }
    }
    return false;
  }
  function onMove(ev) {
    // (G2914) the model placer's ghost follows the cursor on the ground
    if (!drag && (tool === 'place' || tool === 'scatter') && ASSET.key) { const g = ctx.ground(ev.clientX, ev.clientY); if (g) armGhost(g); return false; }
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
    // (G1400: `drag.runway &&` - a polygon's or a road's corner has no runway key, and its drag threw here on every move: no corner could be dragged)
    else if (drag.runway && (drag.runway === 'stand' || drag.runway === 'hangar' || drag.runway.indexOf('tx') === 0 || drag.runway.indexOf('ty') === 0)) {
      // the stand or a taxi point moves; the LAST taxi point stays on the centreline (it is the entry)
      const e = found.entry, E = PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, e));
      if (drag.runway === 'stand') { e.stand.x = +L[0].toFixed(2); e.stand.z = +L[1].toFixed(2); }
      else if (drag.runway === 'hangar') { e.hangar.x = +L[0].toFixed(2); e.hangar.z = +L[1].toFixed(2); }
      else {
        const i = +drag.runway.slice(2), T = drag.runway[1] === 'y' ? e.taxiOut1 : e.taxiOut;   // G772: 'ty' = taxiOut1
        if (i === T.length - 1) { const along = (L[0] - e.c[0]) * E.d[0] + (L[1] - e.c[1]) * E.d[1]; T[i] = [+(e.c[0] + E.d[0] * along).toFixed(2), +(e.c[1] + E.d[1] * along).toFixed(2)]; }
        else T[i] = [+L[0].toFixed(2), +L[1].toFixed(2)];
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
    else if (drag.round) {
      // a round pad: the centre carries it, the rim disc is its radius; the polygon is the circle's again
      const e = found.entry;
      if (drag.round === 'rc') e.round.c = [+L[0].toFixed(2), +L[1].toFixed(2)];
      else e.round.r = +Math.max(3, Math.hypot(L[0] - e.round.c[0], L[1] - e.round.c[1])).toFixed(2);
      e.poly = PG.roundPoly(e.round);
    }
    else if (drag.rect) {
      // a rectangle: the centre carries it, the corner disc sizes it in its own frame; the polygon is the rectangle's again
      const e = found.entry, Q = e.rect;
      if (drag.rect === 'qc') Q.c = [+L[0].toFixed(2), +L[1].toFixed(2)];
      else { const cs = Math.cos(+Q.yaw || 0), sn = Math.sin(+Q.yaw || 0), dx = L[0] - Q.c[0], dz = L[1] - Q.c[1]; Q.hw = +Math.max(1.5, Math.abs(dx * cs + dz * sn)).toFixed(2); Q.hd = +Math.max(1.5, Math.abs(-dx * sn + dz * cs)).toFixed(2); }
      e.poly = PG.rectPoly(Q);
    }
    else if (drag.tan !== undefined) {
      // a spline road's handle: where the disc is, relative to its point, is that point's outgoing handle
      const e = found.entry, P = e.pts[drag.tan];
      if (P) { if (!Array.isArray(e.tan)) e.tan = e.pts.map(() => null); e.tan[drag.tan] = [+(L[0] - P[0]).toFixed(2), +(L[1] - P[1]).toFixed(2)]; }
    }
    else { const arr = found.entry.poly || found.entry.pts; arr[drag.index][0] = +L[0].toFixed(2); arr[drag.index][1] = +L[1].toFixed(2); }
    // G1400 (EDITOR-LAG): the hand is followed by the renderer's preview - the outline, the handles, the built object
    // carried, a strip's taxi pattern - and nothing composes; the record's rebuild (the ground, the pavement, the
    // houses) is the release's (onUp's dirty), as it always was for the ground. A renderer without one rebuilds as before.
    if (R.preview) R.preview(found.entry, found.layer, drag.before);
    else { R.setRecord(rec); R.rebuild({ layer: found.layer, bbox: { x0: 0, z0: 0, x1: 0, z1: 0 }, ground: false }); }
    ctx.redraw && ctx.redraw();
    return true;
  }
  function onUp() {
    if (!drag) return false;
    const found = PG.findById(rec, drag.id);
    // (G2890: a disc clicked and not moved - the corner picked - is no command and no rebuild)
    if (found && JSON.stringify(drag.before) === JSON.stringify(found.entry)) { if (R.previewEnd) R.previewEnd(); drag = null; inspector.refresh(); ctx.redraw && ctx.redraw(); return true; }
    if (found) {
      const cmd = { layer: found.layer, id: drag.id, before: drag.before, after: clone(found.entry), label: 'move ' + drag.id };
      undoS.push(cmd); redoS.length = 0;
      dirty(found.layer, changeBox(drag.before, found.entry), groundOf(found.layer, drag.before, found.entry));
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
    if (T.plotPick) { if (PG.findById(rec, T.plotPick)) togglePlotGround(T.plotPick, L); else T.plotPick = null; return; }
    if (tool === 'select') {
      // (G2890) a click on the selected shape's edge adds a corner there; elsewhere it selects what is under it
      if (selected && edgeInsert(selected, L, edgeTol(g))) return;
      const h = R.hit(g[0], g[2]); select(h ? h.id : null); return;
    }
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
        // (G2910: ONE area - the yard's wheels, and a paved apron wears the cracked concrete, G405)
        const yid = PG.newId(rec, 'areas');
        run({ layer: 'areas', id: yid, before: null, after: { id: yid, name: 'the yard', poly, props: Object.assign({ wheels: { surface: TH.yardKind === 'paved' ? PG.SURFACE.PAVED : PG.SURFACE.GRAVEL, yard: sid } }, TH.yardKind === 'paved' ? { draw: { set: 'cracked', tile: null, fade: 4, z: 0 } } : {}) }, label: 'the yard' });
      }
      if (TH.yard && TH.tram) {
        const SF = PG.siteFrame(e), Y = TH.yard;
        const poly = [[Y.x0, Y.z0], [Y.x1, Y.z0], [Y.x1, Y.z1], [Y.x0, Y.z1]].map(q => SF.toLocal(q[0], q[1]).map(v => +v.toFixed(2)));
        { const yid = PG.newId(rec, 'areas'); run({ layer: 'areas', id: yid, before: null, after: { id: yid, name: 'the yard', poly, props: { wheels: { surface: PG.SURFACE.GRAVEL, yard: sid } } }, label: 'the yard' }); }
        // THE WORKS STAND ON A FLAT (the village pinned the mountain's foot behind the row, G340): the lower yard -
        // the row, the shop, the office, the sheds, the receiving shed - flattened to its median; the mill climbs the hill above it
        const fpoly = [[Y.x0, Y.z0], [Y.x1, Y.z0], [Y.x1, 30], [Y.x0, 30]].map(q => SF.toLocal(q[0], q[1]).map(v => +v.toFixed(2)));
        const fid = PG.newId(rec, 'areas');
        run({ layer: 'areas', id: fid, before: null, after: { id: fid, name: 'the works flat', poly: PG.ensureCCW(fpoly), props: { terraform: { kind: 'flatten', level: medianLevel(fpoly), falloff: bankFor(fpoly, medianLevel(fpoly), 14), abs: false, order: 0 } } }, label: 'the works flat' });
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
    if (tool === 'place') { const id = placeAsset(L); if (id) { strip.status('dropped ' + id + ' (' + ASSET.key + ') - click to drop another, Esc stops'); } return; }
    if (tool === 'scatter') { scatterAsset(L); return; }
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
    if (ev.key === 'Escape') { if (T.plotPick) { T.plotPick = null; strip.status('plot pick ended'); inspector.refresh(); } else if (T.state === 'drawing') cancelTool(); else if (corner !== null) { setCorner(null); inspector.refresh(); } else if (tool !== 'select') setTool('select'); else select(null); ev.preventDefault(); }
    else if (ev.key === 'Enter') { if (T.state === 'drawing') commitDrawing(); }
    else if (ev.key === 'Backspace' && T.state === 'drawing') { T.pts.pop(); if (!T.pts.length) cancelTool(); else { R.ghost(ghostFeature(), ghostOk()); ctx.redraw && ctx.redraw(); } ev.preventDefault(); }
    else if (ev.key === 'Delete' && selected) { if (corner !== null && !ev.shiftKey && removeCorner(selected, corner)) return; deleteSelected(); }   // (G2890: the corner picked first)
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.shiftKey ? redo() : undo(); ev.preventDefault(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { redo(); ev.preventDefault(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { save(recName); ev.preventDefault(); }
    else if (ev.key === 'Tab') { ctx.cameras && ctx.cameras.toggle(); ev.preventDefault(); }
    else if (ev.key >= '1' && ev.key <= String(Math.min(9, SECTIONS.length))) setSection(SECTIONS[+ev.key - 1].k);
    // R turns 15 degrees: the placer's ghost, a selected site or model / object
    else if (ev.key === 'r' && (tool === 'place' || tool === 'scatter')) { ASSET.yaw = (ASSET.yaw + (ev.shiftKey ? -1 : 1) * Math.PI / 12) % (Math.PI * 2); armGhost(); palette.refresh(); }
    else if (ev.key === 'r' && selected) { const f = PG.findById(rec, selected); if (f && f.entry.at) edit(selected, 'sites', x => { x.at.yaw = ((x.at.yaw || 0) + Math.PI / 12); }, 'turn ' + selected); else if (f && f.layer === 'objects' && isFinite(+f.entry.x)) edit(selected, 'objects', x => { x.yaw = +(((+x.yaw || 0) + (ev.shiftKey ? -1 : 1) * Math.PI / 12)).toFixed(4); }, 'turn ' + selected, 'yaw'); }
    else if (ev.key === 'f' && tool === 'select' && ctx.cameras && ctx.cameras.frame) { const f = selected && PG.findById(rec, selected); if (f) ctx.cameras.frame(bboxOf(f.entry)); }
  }
  function deleteSelected() {
    const f = PG.findById(rec, selected); if (!f) return;
    if (f.layer === 'sites') for (const L of rec.layers.links.slice()) if (L.from.site === selected || L.to.site === selected) run({ layer: 'links', id: L.id, before: clone(L), after: null, label: 'delete ' + L.id });
    run({ layer: f.layer, id: selected, before: clone(f.entry), after: null, label: 'delete ' + selected }); select(null);
  }

  // ---- the inspector: declared rows for the selected feature ----------------------
  const SURF_OPTS = PG.SURFACE_NAMES.map((n, i) => [String(i), n.toLowerCase()]);
  // ---- A COVER POLYGON'S VEGETATION (G1385 EDITOR-VEG, contract v1.31) ----------------------------------------
  // none, any biome of the payload (tools/_trees_tuning.json's mixes, as the world rail has them), or a new biome
  // defined in place - its species from the catalogue, each its share, and the stand's density. The terrain type it
  // stamps (or none) stays a row of its own.
  const STAMP_CODES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 16];
  function vegRows(e, id, ed) {
    const V = () => e.veg || null, mode = () => (V() && V().mode) || 'keep';
    const BN = (typeof BIOMES !== 'undefined' && BIOMES.NAMES) || {};
    rows.select(insp, 'terrain type', [['', '- none (the map\'s) -']].concat(STAMP_CODES.map(c => [String(c), c + ' ' + (BN[c] || '')])), () => (e.code === null || e.code === undefined || e.code === '') ? '' : String(e.code),
      v => ed(x => { x.code = v === '' ? null : +v; }, 'terrain type of ' + id));
    const bs = biomeNames();
    rows.pills(insp, 'vegetation', [['keep', 'its type\'s', 'the biome its terrain type names'], ['none', 'none', 'nothing of a biome grows here'], ['biome', 'a biome', 'any of the biomes'], ['new', 'a new biome', 'species and density of its own']], mode,
      v => ed(x => {
        if (v === 'keep') delete x.veg;
        else if (v === 'none') x.veg = { mode: 'none' };
        else if (v === 'biome') x.veg = { mode: 'biome', mix: (x.veg && x.veg.mix) || bs[0] || '' };
        else x.veg = Object.assign({ mode: 'new', species: {}, density: 150, under: 2, cover: 1 }, x.veg && x.veg.mode === 'new' ? x.veg : {});
      }, 'vegetation of ' + id));
    const m = mode();
    if (m === 'keep' && (e.code === null || e.code === undefined)) rows.note(insp, 'no terrain type and no vegetation: this polygon says nothing', 'bad');
    if (m === 'biome') rows.select(insp, 'biome', bs.map(b => [b, b]), () => V().mix || '', v => ed(x => { x.veg = { mode: 'biome', mix: v }; }, 'biome of ' + id));
    if (m === 'none') rows.note(insp, 'no tree, no bush, no grass of a biome inside; the premises\' own (a forest zone, a tree by hand, a plot\'s lawn) still stand');
    if (m !== 'new') return;
    const setV = (patch, label, key) => ed(x => { x.veg = Object.assign({}, x.veg, patch); }, label + ' of ' + id, key);
    rows.slider(insp, 'trees (/ha)', 0, 1500, 5, () => V().density === undefined ? 150 : V().density, v => setV({ density: v }, 'density', 'vegD'), v => v.toFixed(0) + ' /ha');
    rows.slider(insp, 'bushes (/1000 m²)', 0, 20, 0.5, () => V().under === undefined ? 2 : V().under, v => setV({ under: v }, 'bushes', 'vegU'), v => v.toFixed(1));
    rows.slider(insp, 'grass (x)', 0, 2, 0.05, () => V().cover === undefined ? 1 : V().cover, v => setV({ cover: v }, 'grass', 'vegC'), v => v.toFixed(2));
    const sp = () => V().species || {};
    for (const k of Object.keys(sp())) {
      rows.slider(insp, k.replace(/\.glb$/, '').replace(/_/g, ' ').slice(0, 28), 0, 4, 0.05, () => (sp()[k] && sp()[k].proportion !== undefined) ? sp()[k].proportion : 1,
        v => ed(x => { x.veg = Object.assign({}, x.veg, { species: Object.assign({}, x.veg.species, { [k]: Object.assign({}, x.veg.species[k], { proportion: v }) }) }); }, 'share of ' + k, 'vegS:' + k), v => 'share ' + v.toFixed(2));
      rows.button(insp, '✕ ' + k.replace(/\.glb$/, ''), () => ed(x => { const o = Object.assign({}, x.veg.species); delete o[k]; x.veg = Object.assign({}, x.veg, { species: o }); }, 'remove ' + k));
    }
    const have = new Set(Object.keys(sp()));
    const cat = speciesNames().filter(q => !have.has(q[0]));
    if (cat.length) rows.select(insp, '+ species', cat, () => '', v => { if (v) ed(x => { x.veg = Object.assign({}, x.veg, { species: Object.assign({}, x.veg.species, { [v]: { proportion: 1 } }) }); }, 'add ' + v); });
    if (bs.length) rows.select(insp, 'start from', bs.map(b => [b, b]), () => '', v => { const M = biomeMix(v); if (M) ed(x => { x.veg = Object.assign({}, x.veg, { species: JSON.parse(JSON.stringify(M.species || {})), density: Math.round(((M.forest && M.forest.count) || 0) / (Math.PI * Math.pow((M.forest && M.forest.radius) || 220, 2)) * 1e4), under: (M.forest && M.forest.under) || 0, cover: (M.forest && M.forest.cover !== undefined) ? M.forest.cover : 1 }); }, 'species of ' + id + ' from ' + v); });
    if (!have.size) rows.note(insp, 'a new biome needs at least one species (or start from an existing one)', 'bad');
    else rows.note(insp, 'the mix "@' + id + '": the trees share the density by their shares, the bushes the bushes\' count, the grass and flowers their own density x the grass factor - the same rules as every biome');
  }

  // ---- THE INSPECTOR (G2910 SCENERY-ED-2): the SELECTION's plate, whatever tab is lit -----------------------------
  // The user (11 Oct): "The content of the right panel does not follow the tab selection ... the tabs control the
  // displayed action buttons, the right zone being a generic inspector" · "provide more info on selection. Clicking on a
  // polygon leaves very little options". The plate's head says what is selected; nothing selected, it is the scenery's
  // outline (every feature by kind, a click selects and frames it). The tabs' own rows are the palette's (palette below).
  const KIND_WORD = { areas: 'area', terrain: 'terrain', surface: 'surface', material: 'material', exclude: 'exclude', roads: 'road', runways: 'runway', zones: 'zone', sites: 'site', links: 'link', objects: 'object', ttype: 'cover' };
  function selHead(kind, id, label) {
    const d = $('div', { class: 'pr-selhd' });
    d.appendChild($('span', { class: 'sk', text: id ? 'SELECTED' : 'NOTHING SELECTED' }));
    if (id) d.appendChild($('span', { class: 'sn', text: String(kind).toUpperCase() + ' ' + id + (label ? ' · ' + label : ''), title: id }));
    if (id) { const x = $('button', { class: 'pill', type: 'button', text: '✕', title: 'nothing selected (Esc)' }); x.onclick = () => { select(null); x.blur && x.blur(); }; d.appendChild(x); }
    insp.appendChild(d);
    return d;
  }
  // the scenery's outline: every feature by kind, each row selects and frames it
  function outlineRows() {
    selHead(null, null);
    rows.section(insp, 'THE SCENERY');   // (G2890: the scenery editor's record)
    rows.note(insp, rec.name || '(unnamed)');
    rows.note(insp, PG.LAYERS.filter(k => rec.layers[k].length).map(k => k + ' ' + rec.layers[k].length).join(' · ') || 'nothing yet — pick a tab, a tool, and click the ground');
    const groups = [['areas', 'AREAS', e => PG.areaLabel(e)], ['runways', 'RUNWAYS', e => e.name || ''], ['roads', 'ROADS', e => (e.cls || '') + ' ' + (+e.w || 3.6).toFixed(1) + ' m'], ['zones', 'ZONES', e => e.kind],
                    ['sites', 'SITES', e => e.name || ''], ['objects', 'OBJECTS', e => e.kind + ' ' + (e.key || '')], ['terrain', 'TERRAIN (lines and the rest)', e => e.kind], ['surface', 'SURFACES', e => ''], ['material', 'MATERIALS', e => e.look || e.set || ''],
                    ['exclude', 'EXCLUSIONS', e => (e.what || []).join(', ')], ['ttype', 'COVERS', e => ''], ['links', 'LINKS', e => e.kind]];
    for (const [k, title, lab] of groups) {
      const L = rec.layers[k] || []; if (!L.length) continue;
      const d = $('details', { class: 'pr-outline' }); d.appendChild($('summary', { text: title + ' · ' + L.length })); insp.appendChild(d);
      const fill = () => {
        if (d.children.length > 1) return;
        for (const e of L.slice(0, 400)) {
          const r = $('div', { class: 'r item', style: 'cursor:pointer' });
          r.appendChild($('span', { class: 'k', text: e.id + (lab(e) ? ' · ' + lab(e) : ''), title: e.id }));
          r.onclick = () => { select(e.id); if (ctx.cameras && ctx.cameras.frame) { const b = bboxOf(e); if (b) ctx.cameras.frame(b); } };
          d.appendChild(r);
        }
        if (L.length > 400) d.appendChild($('div', { class: 'note', text: (L.length - 400) + ' more: select them on the map' }));
      };
      d.addEventListener('toggle', fill);
      if (OUTLINE_OPEN === k) { d.setAttribute('open', ''); fill(); }
    }
    rows.note(insp, 'select a feature on the map (or above) to see everything about it here; the tabs on the left hold the tools and their palettes');
  }
  let OUTLINE_OPEN = null;
  const inspector = { refresh() {
    insp.innerHTML = '';
    const f = selected && PG.findById(rec, selected);
    if (!f) return outlineRows();
    const e = f.entry, id = e.id, layer = f.layer;
    const ed = (mut, label, key) => edit(id, layer, mut, label, key);
    if (layer === 'areas') {
      selHead('area', id, PG.areaLabel(e));
      areaRows(e, ed);
      shapeRows(e, id);
      rows.button(insp, 'delete ' + id, deleteSelected);
      return;
    }
    selHead(layer === 'objects' ? (e.kind || 'object') : (layer === 'zones' ? (e.kind || 'zone') + ' zone' : KIND_WORD[layer] || layer), id, layer === 'objects' ? (e.key || '') : (e.name || ''));
    // THE LIFE HERE (SCENERY LIFE, contract v1.22.1): the premises' own, people only (a ceremony ground: no mast, no
    // cars, no clutter), or none; a block written by hand (any other keys) shows as its own and is kept
    if (/^(zones|sites|runways|roads)$/.test(layer) && window.SCENERY_LIFE) {
      const Q = window.SCENERY_LIFE.QUIET, quiet = l => l && typeof l === 'object' && Object.keys(Q).every(k => l[k] === Q[k]) && Object.keys(l).length === Object.keys(Q).length;
      const now = () => (e.life === false ? 'off' : e.life === undefined || e.life === null ? '' : quiet(e.life) ? 'quiet' : 'custom');
      const opts = [['', 'as the premises', 'the LIFE section\'s settings'], ['quiet', 'people only', 'no mast, parked cars, traffic, clutter, rubbish or small structures here'], ['off', 'none', 'nothing of the life here']];
      if (now() === 'custom') opts.push(['custom', 'its own', JSON.stringify(e.life)]);
      rows.pills(insp, 'life here', opts, now, v => { if (v === 'custom') return; ed(x => { if (v === '') delete x.life; else x.life = v === 'off' ? false : Object.assign({}, Q); }, 'life of ' + id); });
    }
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
      // ITS CLEARING (v1.36, G2918; the user: "remove the trees and the grass from the road, maybe with a certain distance as a
      // parameter (can be zero)"): metres past the paved edge where no tree, bush or grass grows - 0 the road itself; off is
      // today's road (the pavement's own band and fade). The trees come back live where it shrinks.
      rows.slider(insp, 'clear trees & grass (m)', -0.5, 60, 0.5, () => (PG.roadClearOf(e) === null ? -0.5 : PG.roadClearOf(e)), v => ed(x => { if (v < 0) delete x.clear; else x.clear = v; }, 'clearing of ' + id, 'clear'),
        v => (v < 0 ? 'off (today)' : v === 0 ? 'the road itself' : v.toFixed(1) + ' m past the edge'));
      // THE GRADE LIMIT and THE RIBBON (G434): a taxiway is cut and filled to a gradient, and drawn by its own
      // material polygon (no ribbon) - a track follows the ground and wears its ribbon
      rows.slider(insp, 'steepest (%)', 0, 12, 0.5, () => (e.grade || 0) * 100, v => ed(x => { x.grade = v ? v / 100 : undefined; }, 'grade of ' + id, 'grade'), v => v ? v.toFixed(1) + ' %' : 'follows the ground');
      rows.check(insp, 'drawn (the pavement)', () => e.ribbon !== false, v => ed(x => { x.ribbon = v ? undefined : false; }, 'ribbon of ' + id));
      // THE CURVE (v1.35, G2890; the user: "smooth roads ... long curves"): through the points on a smooth curve (the C2
      // spline - its width, its grade, its pavement follow it), or straight between them with the corners rounded a little
      rows.pills(insp, 'curve', [['spline', 'smooth', 'a smooth curve through every point: long bends from a few clicks; drag a cyan disc to bend it there'], ['', 'corners', 'straight between the points, each corner rounded a little (the road\'s own radius)']],
        () => (e.curve === 'spline' ? 'spline' : ''), v => ed(x => { if (v) x.curve = 'spline'; else { delete x.curve; delete x.tan; } }, 'curve of ' + id));
      if (e.curve === 'spline') {
        const own = Array.isArray(e.tan) ? e.tan.filter(Boolean).length : 0;
        rows.note(insp, 'the road passes through every orange disc; each point\'s cyan disc is its handle - drag it to turn the road there and to reach the bend further or nearer' + (own ? ' (' + own + ' set by hand)' : ''));
        if (own) rows.button(insp, 'handles back to the curve\'s own', () => ed(x => { delete x.tan; }, 'handles of ' + id));
      }
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
        // THE PLOTS' GROUND (v1.35, G2890; the user: "an option to disable plot ground drawing for the houses"): the lot
        // patch (lawn, paths, the dry ground under the house) and the plot's lawn - for every plot, or plot by plot. By
        // default no lot ground is drawn under the water line, whatever this says.
        { const RU0 = e.rules || {}, offN = Array.isArray(RU0.noGround) ? RU0.noGround.length : 0;
          rows.pills(insp, 'plot ground', [['on', 'drawn', 'each plot\'s ground: the lawn, the paths, the dry ground under the house (never under the water line)'], ['off', 'none', 'no plot draws its ground or its lawn: the island\'s own ground runs to the houses']],
            () => (RU0.ground === false ? 'off' : 'on'), v => ed(x => { const r2 = Object.assign({}, x.rules); if (v === 'off') r2.ground = false; else delete r2.ground; x.rules = r2; }, 'plot ground of ' + id));
          if (RU0.ground !== false) {
            rows.button(insp, T.plotPick === id ? 'done picking plots (Esc)' : 'pick plots: a click switches one plot\'s ground', () => { T.plotPick = T.plotPick === id ? null : id; strip.status(T.plotPick ? 'click a plot of ' + id + ' to switch its ground off or on - Esc ends' : 'plot pick ended'); inspector.refresh(); });
            if (offN) { rows.note(insp, offN + ' plot' + (offN === 1 ? '' : 's') + ' with the ground off'); rows.button(insp, 'every plot\'s ground back', () => ed(x => { const r2 = Object.assign({}, x.rules); delete r2.noGround; x.rules = r2; }, 'plot ground of ' + id)); }
          } }
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
      // THE ALTIPORT (GTRAM): a mountain strip landed uphill and left downhill, the slope up to 20 %; switched on
      // with no approach named, it names the LOWER end (the profile's) - the one an altiport is landed over
      rows.check(insp, 'altiport: land uphill (up to 20 %)', () => !!e.altiport, v => ed(x => {
        x.altiport = v;
        if (v && x.approach !== 0 && x.approach !== 1) { const pr = PG.runwayProfile(Object.assign({}, PG.RUNWAY_DEF, x)); x.approach = pr.at(0) <= pr.at(x.len) ? 0 : 1; }
      }, 'altiport of ' + id));
      // THE TREES' CLEARANCE (G1385, the user: "I need to better control tree exclusion zones around runways"): the strip's
      // own - each side, beyond each end, the taper past the ends, the bushes too - or today's generic box (off). Drawn
      // round the selected strip in green.
      if (!PG.runwayIsWater(Object.assign({}, PG.RUNWAY_DEF, e))) {
        const CL = () => PG.runwayClearOf(e), setC = (patch, label, key) => ed(x => { x.clear = Object.assign({}, PG.RWY_CLEAR_DEF, x.clear || {}, patch); }, label + ' of ' + id, key);
        rows.check(insp, 'its own tree clearance', () => !!CL(), v => ed(x => { if (v) x.clear = Object.assign({}, PG.RWY_CLEAR_DEF); else delete x.clear; }, 'clearance of ' + id));
        if (CL()) {
          rows.slider(insp, 'clear each side (m)', 0, 300, 1, () => CL().side, v => setC({ side: v }, 'clearance', 'clrSide'), v => v.toFixed(0) + ' m');
          rows.slider(insp, 'clear past each end (m)', 0, 1500, 5, () => CL().beyond, v => setC({ beyond: v }, 'clearance', 'clrBeyond'), v => v.toFixed(0) + ' m');
          rows.slider(insp, 'taper past the ends', -0.5, 0.5, 0.01, () => CL().taper, v => setC({ taper: v }, 'clearance', 'clrTaper'), v => (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + ' m / 100 m');
          rows.check(insp, 'the bushes too', () => CL().bushes, v => setC({ bushes: v }, 'clearance'));
          rows.note(insp, 'no tree stands inside (the drawn and the collidable alike), in every trees variant; past the ends the half-width grows by the taper (an approach fan) or shrinks; "the bushes too" keeps the shrubs out as well');
        } else rows.note(insp, e.treeBox === false ? 'off: this strip keeps no generic box (treeBox false) - its box + 30 m and the authored excludes clear it' : 'off: today\'s box - ' + PG.RWY_CLEAR_DEF.side + ' m each side, ' + PG.RWY_CLEAR_DEF.beyond + ' m past each end (drawn faint)');
      }
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
        rows.button(insp, 'remove the stand', () => ed(x => { x.stand = null; x.taxiOut = null; x.taxiOut1 = null; }, 'stand of ' + id));
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
      for (const L of links) { const sol = solved.find(q => q.link.id === L.id); const d = $('div', { class: 'note ' + (sol && sol.ok ? 'ok' : 'bad') }); d.textContent = L.kind + ' ' + L.from.item + ' → ' + L.to.item + ': ' + (sol ? (sol.ok ? 'solved' : (sol.issues || ['?'])[0]) : 'not solved'); insp.appendChild(d);
        // GTRAM: THE CABINS' SPEED on the line (tram_run's cruise; an aerial tramway runs 8-12 m/s, the village's 6)
        if (L.kind === 'cable') rows.slider(insp, 'cabin speed (m/s)', 2, 12, 0.5, () => +L.speed || 6, v => edit(L.id, 'links', x => { x.speed = v; }, 'speed of ' + L.id, 'speed'), v => v.toFixed(1) + ' m/s'); }
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
        // (v1.35, G2890) the lot's ground under it: drawn (never under the water line), or the island's own
        rows.check(insp, 'its lot\'s ground drawn', () => !(it.P && it.P.plotGround === false), v => ed(x => { const q = x.items.find(o => o.id === it.id); q.P = Object.assign({}, q.P); if (v) delete q.P.plotGround; else q.P.plotGround = false; }, 'lot ground of ' + it.id));
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
        // (G2914) its size: the model scaled whole (the placer's Alt + wheel; 1 = as baked)
        rows.slider(insp, 'scale', 0.25, 4, 0.05, () => (+e.s > 0 ? +e.s : 1), v => ed(x => { if (Math.abs(v - 1) < 1e-3) delete x.s; else x.s = +v.toFixed(3); }, 'scale of ' + id, 's'), v => 'x' + (+v).toFixed(2));
        const PRk = propRegOf(), pk = PRk && PRk.props[e.key];
        if (pk) rows.note(insp, (pk.label || e.key) + (pk.dim ? ' · ' + pk.dim.map(v => (v * (+e.s || 1)).toFixed(1)).join(' x ') + ' m' : '') + (pk.nt ? ' · ' + pk.nt.toLocaleString() + ' triangles' : '') + (pk.group ? ' · ' + pk.group : ''));
        rows.note(insp, 'drag its disc to move it; R turns it 15 degrees (Shift+R back)');
      } else if (e.kind === 'billboard') rows.slider(insp, 'width (m)', 2, 6, 0.1, () => e.w || 3.6, v => ed(x => { x.w = v; }, 'width of ' + id, 'w'), v => v.toFixed(1));
    } else if (layer === 'ttype') vegRows(e, id, ed);
    else if (layer === 'objects' && e.kind === 'tree') {
      const pool = ctx.pool ? ctx.pool() : [];
      if (pool.length) rows.select(insp, 'species', pool.map(p => [p.key, p.key.replace(/\.glb\|/, ' · ').slice(0, 30)]), () => e.key, v => ed(x => { x.key = v; }, 'species of ' + id));
      rows.slider(insp, 'size', 0.4, 1.8, 0.02, () => e.size || 1, v => ed(x => { x.size = v; }, 'size of ' + id, 'size'));
      rows.slider(insp, 'turn (°)', 0, 360, 1, () => (e.yaw || 0) * 180 / Math.PI, v => ed(x => { x.yaw = v * Math.PI / 180; }, 'turn of ' + id, 'yaw'), v => v.toFixed(0) + '°');
    }
    shapeRows(e, id);
    rows.button(insp, 'delete ' + id, deleteSelected);
  } };
  // ---- THE SHAPE (G2890; the user: "I don't know how to edit an existing polygon ... add more sides, subdivide the shape,
  // move the points individually"): what the hand does, the corner picked, and the buttons that do it without the mouse's
  // art. G2910: an area's round or rectangle too
  function shapeRows(e, id) {
    const ed = (mut, label, key) => { const f = PG.findById(rec, id); if (f) edit(id, f.layer, mut, label, key); };
    if (PG.roundOk(e.round)) {
      rows.section(insp, 'SHAPE · ROUND');
      rows.slider(insp, 'radius (m)', 3, 200, 0.5, () => +e.round.r, v => ed(x => { x.round = Object.assign({}, x.round, { r: v }); x.poly = PG.roundPoly(x.round); }, 'radius of ' + id, 'padR'), v => v.toFixed(1) + ' m');
      rows.note(insp, 'the orange disc moves the pad, the cyan one on its rim sets its radius');
      rows.button(insp, 'free corners (a 12-sided polygon to shape by hand)', () => ed(x => { x.poly = PG.roundPoly({ c: x.round.c, r: x.round.r, n: 12 }); delete x.round; }, 'free corners of ' + id));
    } else if (PG.rectOk(e.rect)) {
      const Q = e.rect, setQ = (patch, label, key) => ed(x => { x.rect = Object.assign({}, x.rect, patch); x.poly = PG.rectPoly(x.rect); }, label + ' of ' + id, key);
      rows.section(insp, 'SHAPE · RECTANGLE');
      rows.slider(insp, 'length (m)', 3, 400, 0.5, () => 2 * Q.hw, v => setQ({ hw: v / 2 }, 'length', 'qw'), v => v.toFixed(1) + ' m');
      rows.slider(insp, 'width (m)', 3, 400, 0.5, () => 2 * Q.hd, v => setQ({ hd: v / 2 }, 'width', 'qd'), v => v.toFixed(1) + ' m');
      rows.slider(insp, 'turn (°)', -180, 180, 1, () => (+Q.yaw || 0) * 180 / Math.PI, v => setQ({ yaw: +(v * Math.PI / 180).toFixed(4) }, 'turn', 'qy'), v => v.toFixed(0) + '°');
      rows.slider(insp, 'rounded corners (m)', 0, 30, 0.5, () => +Q.radius || 0, v => setQ({ radius: v }, 'corners', 'qr'), v => v ? v.toFixed(1) + ' m' : 'square');
      rows.note(insp, 'the orange disc moves it, the cyan one on its corner sizes it');
      rows.button(insp, 'free corners (its outline to shape by hand)', () => ed(x => { delete x.rect; }, 'free corners of ' + id));
    } else if (e.poly || e.pts) {
      const arr = e.poly || e.pts, word = e.poly ? 'corner' : 'point';
      rows.section(insp, 'SHAPE · ' + arr.length + ' ' + word.toUpperCase() + 'S');
      rows.note(insp, 'drag an orange disc to move a ' + word + ' · drag a faint disc, or click the edge, to add one there · click a ' + word + ' (it turns white), then Del or the button below to remove it');
      if (corner !== null && arr[corner]) {
        rows.note(insp, word + ' ' + (corner + 1) + ' of ' + arr.length + ' picked: x ' + (+arr[corner][0]).toFixed(1) + ' · z ' + (+arr[corner][1]).toFixed(1));
        rows.button(insp, 'remove ' + word + ' ' + (corner + 1), () => removeCorner(id, corner));
      }
      rows.button(insp, 'subdivide: a ' + word + ' mid-way on every edge', () => subdivide(id));
      rows.button(insp, 'continue drawing from the last ' + word, () => resumeDrawing(id));
    }
  }

  // ---- AN AREA (G2910): the facts, what it does, what it overlaps, then a section per property ----------------------------
  const PROP_TITLE = { terraform: 'TERRAFORM', wheels: 'WHEELS', draw: 'DRAW', marks: 'MARKS', exclude: 'EXCLUDE', cover: 'COVER' };
  const PROP_WHY = { terraform: 'moves the ground: flat, raised or lowered, a slope', wheels: 'the class the wheels feel (a hard one keeps the trees and plots out)', draw: 'a surface drawn on the ground: a pavement (concrete, asphalt, gravel, dirt, sand, grass) or a texture',
                     marks: 'weathered paint on the pavement: parking bays, a dock\'s edge, keep-clear hatching', exclude: 'keeps the trees and / or the plots out', cover: 'what grows here and the terrain type it stamps' };
  const HARD = [PG.SURFACE.PAVED, PG.SURFACE.GRAVEL, PG.SURFACE.SAND];
  const lookCls = d => (d && d.look && PG.RUNWAY_LOOKS[d.look] && PG.RUNWAY_LOOKS[d.look].cls) || null;
  const m2 = A => (A >= 10000 ? (A / 10000).toFixed(2) + ' ha' : Math.round(A).toLocaleString() + ' m²');
  // a fresh property, the way the tools make it (the defaults follow the draw: a pavement proposes the wheels it implies)
  function propDefault(a, k) {
    const P = a.props || {}, poly = a.poly || [];
    if (k === 'terraform') { const lv = medianLevel(poly); return { kind: 'flatten', level: lv, falloff: bankFor(poly, lv, 10), abs: false, order: 0 }; }
    if (k === 'wheels') { const L = P.draw && P.draw.look && PG.RUNWAY_LOOKS[P.draw.look]; return { surface: L && L.surface !== null && L.surface !== undefined ? +L.surface : PG.SURFACE.GRAVEL }; }
    if (k === 'draw') return { look: 'concrete', z: 0 };
    if (k === 'marks') return { kind: 'parking' };
    if (k === 'exclude') return { what: ['trees'] };
    if (k === 'cover') { const bs = biomeNames(); return { code: null, veg: bs.length ? { mode: 'biome', mix: bs[0] } : { mode: 'none' } }; }
    return {};
  }
  function addProp(id, k) {
    const f = PG.findById(rec, id); if (!f || f.layer !== 'areas') return false;
    const a = f.entry;
    edit(id, 'areas', x => {
      x.props = Object.assign({}, x.props);
      x.props[k] = propDefault(x, k);
      // the defaults follow the draw: a pavement wheels its class, marks want a pavement (concrete) turned to the long side
      if (k === 'draw' && !x.props.wheels) x.props.wheels = { surface: PG.SURFACE.PAVED };
      if (k === 'marks') {
        if (!lookCls(x.props.draw)) { x.props.draw = Object.assign({ z: 0 }, x.props.draw || {}, { look: 'concrete' }); delete x.props.draw.set; if (!x.props.wheels) x.props.wheels = { surface: PG.SURFACE.PAVED }; }
        if (x.props.draw.yaw === undefined) { const ed0 = PG.rectOk(x.rect) ? null : longestEdge(x.poly); x.props.draw.yaw = PG.rectOk(x.rect) ? +((x.rect.yaw || 0) + (x.rect.hw >= x.rect.hd ? 0 : Math.PI / 2)).toFixed(4) : ed0 ? +Math.atan2(ed0[1][1] - ed0[0][1], ed0[1][0] - ed0[0][0]).toFixed(4) : 0; }
      }
    }, k + ' added to ' + id);
    return !!a;
  }
  function removeProp(id, k) {
    const f = PG.findById(rec, id); if (!f || f.layer !== 'areas' || !(f.entry.props || {})[k]) return false;
    edit(id, 'areas', x => { x.props = Object.assign({}, x.props); delete x.props[k]; if (k === 'draw') delete x.props.marks; }, k + ' removed from ' + id);
    return true;
  }
  // what overlaps an area: the other areas, the zones, the strips, the roads crossing it (each a chip that selects it)
  function overlapsOf(a) {
    const out = [], poly = a.poly; if (!poly || poly.length < 3) return out;
    const bb = PG.polyBBox(poly), hitBB = q => !(q.x1 < bb.x0 || q.x0 > bb.x1 || q.z1 < bb.z0 || q.z0 > bb.z1);
    for (const b of rec.layers.areas) if (b !== a && b.poly && b.poly.length >= 3 && hitBB(PG.polyBBox(b.poly)) && PG.polysOverlap(poly, b.poly)) out.push([b.id, PG.areaLabel(b)]);
    for (const z of rec.layers.zones) if (z.poly && z.poly.length >= 3 && hitBB(PG.polyBBox(z.poly)) && PG.polysOverlap(poly, z.poly)) out.push([z.id, z.kind + ' zone']);
    for (const r of rec.layers.runways) if (r.c && r.len > 0 && r.wid > 0) { const box = PG.runwayBox(Object.assign({}, PG.RUNWAY_DEF, r), 0); if (hitBB(PG.polyBBox(box)) && PG.polysOverlap(poly, box)) out.push([r.id, r.name || 'strip']); }
    for (const r of rec.layers.roads) if (r.pts && r.pts.length >= 2) {
      const ln = PG.roadLine(r); let hit = false;
      for (let i = 0; i + 1 < ln.length && !hit; i++) { const p = ln[i], q = ln[i + 1], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 4)); for (let k = 0; k <= n && !hit; k++) { const x = p[0] + (q[0] - p[0]) * k / n, z = p[1] + (q[1] - p[1]) * k / n; if (x >= bb.x0 && x <= bb.x1 && z >= bb.z0 && z <= bb.z1 && PG.inPoly(poly, x, z)) hit = true; } }
      if (hit) out.push([r.id, 'road']);
    }
    return out;
  }
  function areaRows(a, ed) {
    const id = a.id, P = a.props || {}, poly = a.poly || [];
    const nm = $('input', { type: 'text', value: a.name || '', placeholder: 'its name (optional)' }); nm.className = 'pr-name'; nm.onchange = () => ed(x => { if (nm.value) x.name = nm.value; else delete x.name; }, 'name of ' + id); insp.appendChild(nm);
    // THE FACTS: its size, its corners, its box; what the wheels feel at its middle (the composed answer, every layer said)
    if (poly.length >= 3) {
      let per = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; per += Math.hypot(q[0] - p[0], q[1] - p[1]); }
      const bb = PG.polyBBox(poly), c = PG.polyCentroid(poly);
      rows.note(insp, m2(Math.abs(PG.polyArea(poly))) + ' · ' + per.toFixed(0) + ' m round · ' + (PG.roundOk(a.round) ? 'a circle r ' + (+a.round.r).toFixed(1) + ' m' : PG.rectOk(a.rect) ? 'a rectangle' : poly.length + ' corners') + ' · ' + (bb.x1 - bb.x0).toFixed(0) + ' x ' + (bb.z1 - bb.z0).toFixed(0) + ' m');
      const O = R.overlay;
      if (O && O.frame) { const w = O.frame.toWorld(c[0], c[1]); const s = O.surfaceAt ? PG.SURFACE_NAMES[O.surfaceAt(w[0], w[1])] : null; const tx = O.excludeAt ? O.excludeAt(w[0], w[1], 'trees') : false;
        rows.note(insp, 'at its middle: ' + (s ? 'the wheels feel ' + s.toLowerCase() : 'the island\'s own ground') + (tx ? ' · no trees' : '') + ' · ' + (R.heightAt(w[0], w[1]) - O.frame.y0).toFixed(1) + ' m over the anchor'); }
    }
    // WHAT IT DOES, one line each - and what it does NOT (the surprise the user met: a gravel band that draws nothing)
    const does = [], keeps = new Set((P.exclude && P.exclude.what) || []);
    if (P.terraform) does.push('moves the ground: ' + (P.terraform.kind === 'flatten' ? 'flat at ' + (+P.terraform.level || 0).toFixed(1) + ' m' : P.terraform.kind === 'raise' ? ((+P.terraform.dh || 0) >= 0 ? 'raised ' : 'lowered ') + Math.abs(+P.terraform.dh || 0).toFixed(1) + ' m' : 'a ' + ((+P.terraform.slope || 0) * 100).toFixed(1) + ' % slope'));
    if (P.wheels) { does.push('the wheels feel ' + (PG.SURFACE_NAMES[+P.wheels.surface] || '?').toLowerCase() + (P.wheels.apron ? ' (an apron)' : '')); if (HARD.indexOf(+P.wheels.surface) >= 0) { keeps.add('trees'); keeps.add('plots'); } }
    if (P.draw) does.push('draws ' + (lookCls(P.draw) ? (PG.RUNWAY_LOOKS[P.draw.look].name || P.draw.look) + ' (the pavement: no repetition)' : 'the texture ' + P.draw.set));
    if (P.marks) does.push('paints ' + P.marks.kind + ' marks');
    if (keeps.size) does.push('keeps out: ' + Array.from(keeps).join(', '));
    if (P.cover) does.push(P.cover.code !== null && P.cover.code !== undefined && P.cover.code !== '' ? 'stamps terrain type ' + P.cover.code : 'grows ' + (P.cover.veg ? (P.cover.veg.mode === 'biome' ? 'the biome ' + P.cover.veg.mix : P.cover.veg.mode === 'none' ? 'nothing of a biome' : 'its own biome') : 'its type\'s biome'));
    rows.section(insp, 'WHAT IT DOES');
    if (!does.length) rows.note(insp, 'nothing yet: a sketch - add a property below', 'warn');
    for (const t of does) rows.note(insp, t, 'ok');
    if (P.wheels && !P.draw) rows.note(insp, 'it draws NOTHING: the wheels feel ' + (PG.SURFACE_NAMES[+P.wheels.surface] || '?').toLowerCase() + ' and the trees keep out, but the ground looks as it was - add a DRAW', 'warn');
    const ov = overlapsOf(a);
    if (ov.length) {
      const d = $('div', { class: 'r' }); d.appendChild($('span', { class: 'k', text: 'overlaps', title: 'the features that share its ground - a click selects one' }));
      const w = $('span', { class: 'pills' });
      for (const [oid, lab] of ov.slice(0, 16)) { const b = $('button', { class: 'pill', type: 'button', text: oid, title: lab }); b.onclick = () => { select(oid); const f2 = PG.findById(rec, oid); if (f2 && ctx.cameras && ctx.cameras.frame) ctx.cameras.frame(bboxOf(f2.entry)); }; w.appendChild(b); }
      d.appendChild(w); insp.appendChild(d);
    }
    // its issues (the record's, naming it or one of its entries)
    try { const iss = PG.issues({ layers: { areas: [a] } }).filter(t => t.indexOf(id) >= 0 && !/duplicate id/.test(t)); for (const t of iss.slice(0, 4)) rows.note(insp, '⚠ ' + t, 'bad'); } catch (err) {}
    // THE PROPERTIES, in the order they compose
    const sec = (k, summary) => { rows.section(insp, PROP_TITLE[k] + (summary ? ' · ' + summary : '')); };
    const rm = k => rows.button(insp, '✕ remove the ' + PROP_TITLE[k].toLowerCase(), () => removeProp(id, k));
    const edP = (k, mut, label, key) => ed(x => { x.props = x.props || {}; if (!x.props[k]) x.props[k] = {}; mut(x.props[k], x); }, label + ' of ' + id, key);
    if (P.terraform) {
      const t = P.terraform, edT = (mut, label, key) => edP('terraform', mut, label, key);
      sec('terraform', t.kind);
      rows.pills(insp, 'kind', [['flatten', 'flat', 'the ground inside at one level'], ['raise', 'raise / lower', 'the ground lifted or dropped by a height'], ['ramp', 'slope', 'a constant slope through a height at the middle']], () => t.kind,
        v => edT(q => { const lv = medianLevel(poly); if (v === 'flatten') { q.kind = 'flatten'; if (!isFinite(+q.level)) q.level = lv; delete q.dh; } else if (v === 'raise') { q.kind = 'raise'; if (!isFinite(+q.dh)) q.dh = 2; } else { q.kind = 'ramp'; if (!isFinite(+q.level)) q.level = lv; if (!isFinite(+q.slope)) q.slope = 0.02; if (!isFinite(+q.hdg)) q.hdg = 0; } }, 'terraform'));
      if (t.kind === 'flatten' || t.kind === 'ramp') {
        rows.slider(insp, t.kind === 'ramp' ? 'height at the middle (m)' : 'level (m)', -40, 80, 0.1, () => +t.level || 0, v => edT(q => { q.level = v; }, 'level', 'level'), v => v.toFixed(1) + ' m');
        rows.check(insp, 'absolute height', () => !!t.abs, v => edT(q => { q.abs = v; }, 'absolute'));
        rows.button(insp, 'level to the ground under it (its median)', () => edT(q => { q.level = medianLevel(poly); q.abs = false; }, 'level'));
      }
      if (t.kind === 'ramp') {
        rows.slider(insp, 'slope (%)', 0, 15, 0.1, () => (+t.slope || 0) * 100, v => edT(q => { q.slope = v / 100; }, 'slope', 'slope'), v => v.toFixed(1) + ' %');
        rows.slider(insp, 'rising toward (°)', 0, 360, 1, () => ((+t.hdg || 0) + 360) % 360, v => edT(q => { q.hdg = v; }, 'heading', 'hdg'), v => v.toFixed(0) + '°');
      }
      if (t.kind === 'raise') rows.slider(insp, 'lift (m)', -30, 30, 0.1, () => +t.dh || 0, v => edT(q => { q.dh = v; }, 'lift', 'dh'), v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' m');
      rows.slider(insp, 'falloff (m)', 1, 120, 1, () => +t.falloff || 10, v => edT(q => { q.falloff = v; }, 'falloff', 'falloff'), v => v.toFixed(0) + ' m');
      rm('terraform');
    }
    if (P.wheels) {
      const w = P.wheels, edW = (mut, label, key) => edP('wheels', mut, label, key);
      sec('wheels', (PG.SURFACE_NAMES[+w.surface] || '?').toLowerCase());
      rows.select(insp, 'the wheels feel', [['0', 'grass'], ['6', 'gravel'], ['5', 'paved'], ['7', 'sand'], ['1', 'rock'], ['2', 'scree'], ['3', 'forest floor']], () => String(+w.surface), v => edW(q => { q.surface = +v; }, 'wheels'));
      rows.check(insp, 'an apron (the pilot lists it)', () => !!w.apron, v => edW(q => { if (v) q.apron = true; else delete q.apron; }, 'apron'));
      rows.slider(insp, 'priority', -5, 5, 1, () => +w.z || 0, v => edW(q => { if (v) q.z = v; else delete q.z; }, 'priority', 'wz'), v => v.toFixed(0) + (v > 0 ? ' (over)' : v < 0 ? ' (under)' : ''));
      if (HARD.indexOf(+w.surface) >= 0) rows.note(insp, 'a hard surface: no tree grows and no plot is sown inside (always so - shown in WHAT IT DOES)');
      rm('wheels');
    }
    if (P.draw) {
      const d = P.draw, edD = (mut, label, key) => edP('draw', mut, label, key), pave = !!lookCls(d);
      sec('draw', pave ? (PG.RUNWAY_LOOKS[d.look].name || d.look) : 'texture ' + (d.set || '?'));
      rows.pills(insp, 'drawn as', [['pave', 'a pavement', 'concrete, asphalt, gravel, dirt, sand, grass - hex-tiled, never repeating, with its wear'], ['set', 'a texture', 'a PBR set projected on the ground, its edge faded']], () => (pave ? 'pave' : 'set'),
        v => edD(q => { if (v === 'pave') { q.look = q.look && PG.RUNWAY_LOOKS[q.look] && PG.RUNWAY_LOOKS[q.look].cls ? q.look : 'concrete'; } else { delete q.look; q.set = q.set || (materialSets()[0] || ['cracked'])[0]; if (q.fade === undefined) q.fade = 4; } }, 'draw'));
      if (pave) {
        rows.select(insp, 'surface', Object.keys(PG.RUNWAY_LOOKS).filter(k => PG.RUNWAY_LOOKS[k].cls).map(k => [k, PG.RUNWAY_LOOKS[k].name]), () => d.look,
          v => edD((q, x) => { q.look = v; const L = PG.RUNWAY_LOOKS[v]; if (!x.props.wheels && L && L.surface !== null && L.surface !== undefined) x.props.wheels = { surface: +L.surface }; }, 'surface'));
        rows.slider(insp, 'lanes turned (°)', -180, 180, 1, () => (+d.yaw || 0) * 180 / Math.PI, v => edD(q => { q.yaw = v * Math.PI / 180; }, 'yaw', 'yaw'), v => v.toFixed(0) + '°');
        rows.button(insp, 'turn the lanes along its longest side', () => { const e0 = longestEdge(poly); if (e0) edD(q => { q.yaw = +Math.atan2(e0[1][1] - e0[0][1], e0[1][0] - e0[0][0]).toFixed(4); }, 'yaw'); });
        // (the band, the wear and the paint's age - the pavement's rows, on this draw)
        pavRows(d, id, 'material', (mut, label, key) => ed(x => { mut(x.props.draw); }, label, key), PG.RUNWAY_LOOKS[d.look]);
      } else {
        const sets = materialSets();
        if (sets.length) rows.select(insp, 'set', sets, () => d.set || '', v => edD(q => { q.set = v; }, 'set')); else rows.note(insp, 'no texture sets on this page');
        rows.slider(insp, 'tile (m, 0 = the set\'s own)', 0, 16, 0.5, () => +d.tile || 0, v => edD(q => { q.tile = v > 0 ? v : null; }, 'tile', 'tile'), v => (v > 0 ? v.toFixed(1) + ' m' : 'the set\'s'));
        rows.slider(insp, 'fade (m)', 0, 40, 0.5, () => +d.fade || 0, v => edD(q => { q.fade = v; }, 'fade', 'fade'), v => v.toFixed(1) + ' m');
        rows.note(insp, 'a texture repeats at its tile; a pavement never does - prefer the pavement for concrete. A premises wears up to four sets (the map has four slots)');
      }
      rows.slider(insp, 'priority', -5, 5, 1, () => +d.z || 0, v => edD(q => { q.z = v; }, 'priority', 'dz'), v => v.toFixed(0) + (v > 0 ? ' (over)' : v < 0 ? ' (under)' : ''));
      rm('draw');
    }
    if (P.marks) {
      const mk = P.marks, D0 = PG.MARK_DEF[mk.kind] || {}, edM = (mut, label, key) => edP('marks', mut, label, key), V = k => (mk[k] !== undefined && mk[k] !== null ? +mk[k] : D0[k]);
      // the marks as the renderer paints them (in the area's frame; the count and what is wrong)
      const c = PG.polyBBox(poly), Wt = mk.kind === 'dock' ? waterWet(poly) : null, AM = PG.areaMarks(poly, mk, { cx: (c.x0 + c.x1) / 2, cz: (c.z0 + c.z1) / 2, yaw: +(P.draw && P.draw.yaw) || 0 }, Wt ? (i => Wt[i] || 0) : null);
      sec('marks', mk.kind + (AM.n ? ' · ' + AM.n + (mk.kind === 'parking' ? ' bays' : mk.kind === 'dock' ? ' (line + bollards)' : ' bars') : ''));
      rows.pills(insp, 'kind', [['parking', 'parking', 'rows of bays across an aisle'], ['dock', 'dock', 'the quay\'s edge line and the bollard spots, on the side that meets the water'], ['hatch', 'keep clear', 'hatching bars inside an outline']], () => mk.kind, v => edM(q => { for (const k of Object.keys(q)) delete q[k]; q.kind = v; }, 'marks'));
      rows.pills(insp, 'paint', [['white', 'white'], ['yellow', 'yellow']], () => mk.colour || D0.colour, v => edM(q => { q.colour = v; }, 'paint'));
      if (mk.kind === 'parking') {
        rows.slider(insp, 'bay width (m)', 2, 4, 0.1, () => V('bay'), v => edM(q => { q.bay = v; }, 'bay', 'mBay'), v => v.toFixed(1) + ' m');
        rows.slider(insp, 'bay depth (m)', 3, 8, 0.1, () => V('depth'), v => edM(q => { q.depth = v; }, 'depth', 'mDepth'), v => v.toFixed(1) + ' m');
        rows.slider(insp, 'aisle (m)', 0, 12, 0.5, () => V('aisle'), v => edM(q => { q.aisle = v; }, 'aisle', 'mAisle'), v => v.toFixed(1) + ' m');
        rows.slider(insp, 'rows (0 = as many as fit)', 0, 12, 1, () => V('rows'), v => edM(q => { q.rows = v; }, 'rows', 'mRows'), v => v ? String(v) : 'all');
      } else if (mk.kind === 'dock') {
        rows.slider(insp, 'bollards every (m)', 3, 30, 0.5, () => V('bollard'), v => edM(q => { q.bollard = v; }, 'bollards', 'mBol'), v => v.toFixed(1) + ' m');
        rows.slider(insp, 'line width (m)', 0.1, 0.5, 0.01, () => V('line'), v => edM(q => { q.line = v; }, 'line', 'mLine'), v => v.toFixed(2) + ' m');
        rows.select(insp, 'the quay', [['', 'the edge that meets the water']].concat(poly.map((q, i) => [String(i), 'edge ' + (i + 1)])), () => (mk.edge === null || mk.edge === undefined ? '' : String(mk.edge)), v => edM(q => { if (v === '') delete q.edge; else q.edge = +v; }, 'quay'));
        rows.button(insp, 'turn the pavement to the quay', () => { const w0 = waterEdge(poly), e0 = (mk.edge !== undefined && mk.edge !== null && poly[+mk.edge]) ? [poly[+mk.edge], poly[(+mk.edge + 1) % poly.length]] : w0; if (e0) ed(x => { x.props.draw.yaw = +Math.atan2(e0[1][1] - e0[0][1], e0[1][0] - e0[0][0]).toFixed(4); }, 'yaw of ' + id); });
      } else if (mk.kind === 'hatch') {
        rows.slider(insp, 'bars every (m)', 0.6, 4, 0.1, () => V('pitch'), v => edM(q => { q.pitch = v; }, 'pitch', 'mPitch'), v => v.toFixed(1) + ' m');
        rows.slider(insp, 'bar width (m)', 0.15, 1.5, 0.05, () => V('bar'), v => edM(q => { q.bar = v; }, 'bar', 'mBar'), v => v.toFixed(2) + ' m');
      }
      rows.slider(insp, 'kept inside by (m)', 0, 4, 0.1, () => V('inset'), v => edM(q => { q.inset = v; }, 'inset', 'mIns'), v => v.toFixed(1) + ' m');
      const age = (P.draw && P.draw.pav && P.draw.pav.paintAge !== undefined) ? +P.draw.pav.paintAge : null;
      rows.slider(insp, 'paint age', 0, 1, 0.05, () => (age === null ? (PAVM ? PAVM.RECIPE.paintAge : 0.5) : age), v => ed(x => { x.props.draw.pav = Object.assign({}, x.props.draw.pav, { paintAge: v }); }, 'paint age of ' + id, 'mAge'), v => (v < 0.25 ? 'fresh ' : v > 0.75 ? 'worn ' : '') + v.toFixed(2));
      for (const t of AM.issues) rows.note(insp, t, 'warn');
      rows.note(insp, 'the marks follow the pavement\'s lanes (DRAW > lanes turned); they wear its paint age - chipped, rubbed off where the wheels run');
      rm('marks');
    }
    if (P.exclude) {
      const x0 = P.exclude, what = Array.isArray(x0.what) ? x0.what : ['trees'];
      sec('exclude', what.join(', ') || 'nothing');
      const d = $('div', { class: 'r' }); d.appendChild($('span', { class: 'k', text: 'keeps out' }));
      const w = $('span', { class: 'pills' });
      for (const [k, lab, why] of [['trees', 'trees', 'no tree stands inside - drawn or collidable; they come back the moment this goes'], ['plots', 'plots', 'no zone sows a plot inside, no forest plants it']]) {
        const on = what.indexOf(k) >= 0, b = $('button', { class: 'pill' + (on ? ' on' : ''), type: 'button', text: lab, title: why });
        b.onclick = () => ed(x => { const q = Object.assign({}, x.props.exclude); delete q.zone; const l = (Array.isArray(q.what) ? q.what : ['trees']).slice(); const i = l.indexOf(k); if (i >= 0) l.splice(i, 1); else l.push(k); q.what = l; x.props.exclude = q; }, 'exclude of ' + id);
        w.appendChild(b);
      }
      d.appendChild(w); insp.appendChild(d);
      if (x0.zone) rows.note(insp, 'it came from a "no trees" zone: changing what it keeps out makes it an exclusion of its own');
      rm('exclude');
    }
    if (P.cover) {
      sec('cover', P.cover.code !== null && P.cover.code !== undefined && P.cover.code !== '' ? 'type ' + P.cover.code : 'vegetation');
      vegRows(P.cover, id, (mut, label, key) => ed(x => { mut(x.props.cover); }, label, key));
      rm('cover');
    }
    // + ADD A PROPERTY
    const missing = PG.AREA_PROPS.filter(k => !P[k]);
    if (missing.length) rows.select(insp, '+ add a property', missing.map(k => [k, PROP_TITLE[k].toLowerCase() + ' - ' + PROP_WHY[k]]), () => '', v => { if (v) addProp(id, v); });
  }

  // ---- THE PALETTE DRAWER (G2910): a tab's own rows, under its tools ------------------------------------------------------
  const PAL_NOTE = {
    terrain: 'every polygon here is an AREA: a flatten moves the ground, a surface is gravel the wheels feel and the eye sees, a material a texture; the inspector adds the rest (wheels, a drawn pavement, marks, no trees, a cover) to any of them',
    areas: 'ONE polygon, its properties attached: draw an area and add what it does in the inspector - or start from concrete, a parking lot, a dock, a keep-clear. Concrete is the pavement\'s (hex-tiled: it never repeats); the marks are weathered paint in its frame',
    airfield: 'a runway is a PROFILE: two clicks place it, the inspector sets its length, width, heading, surface and slope; the ground is graded to it, its class reaches the wheels, the pilot\'s pattern and the PAPI are derived. An apron and a round pad are areas (concrete, paved).',
    roads: 'a road is traced through its points (a smooth curve); its width, class, look, grade and the plots that front on it are in the inspector',
    zones: 'a zone sows plots along the ROADS inside it; the house generator stands a house on each. Trace a road first.',
    vegetation: 'a forest polygon plants the wood (its density and species in the inspector); a vegetation area says what the island grows inside it - none, any biome, or a new biome of its own; a no-trees area keeps the trees out; a tree by hand is one record.',
  };
  let palOpen = true;
  const palette = { refresh() {
    pal.innerHTML = '';
    const S = SECTIONS.find(q => q.k === section);
    const d = $('details', { class: 'pr-paldet' }); if (palOpen) d.setAttribute('open', '');
    d.appendChild($('summary', { text: (S ? S.label.toLowerCase() : section) + ' · palette' }));
    d.addEventListener('toggle', () => { palOpen = !!d.open; });
    pal.appendChild(d);
    if (section === 'file') fileRows(d);
    else if (section === 'view') viewRows(d);
    else if (section === 'life') lifeRows(d);
    else if (section === 'sites') sitesPalette(d);
    else if (section === 'objects') objectsPalette(d);
    else if (section === 'assets') assetsPalette(d);
    else if (PAL_NOTE[section]) rows.note(d, PAL_NOTE[section]);
    else pal.innerHTML = '';
  } };
  // THE BUILDINGS (v9): the theme's categories as pills, the entries of the one picked in the select (a preset's name and
  // its generator's word); 'all' lists the whole catalogue - and the site themes the theme tool stands
  function sitesPalette(P) {
    if (!ctx.catalogue) { rows.note(P, 'no catalogue - no generator loaded'); return; }
    const TH = PG.themeOf(rec), cats = TH.categories || PG.CATEGORIES;
    const keysOf = c => (c === 'all' ? ctx.catalogue.keys() : ctx.catalogue.byCat(c).map(q => q.key));
    const nOf = c => keysOf(c).length;
    if (!PALETTE_CAT || (PALETTE_CAT !== 'all' && !nOf(PALETTE_CAT))) PALETTE_CAT = cats.find(c => nOf(c)) || 'all';
    const label = k => { const i = k.indexOf('/'); return i < 0 ? k : k.slice(i + 1) + ' · ' + k.slice(0, i); };
    rows.pills(P, 'category', [['all', 'all', 'the whole catalogue']].concat(cats.map(c => [c, c, nOf(c) + ' in the catalogue'])), () => PALETTE_CAT, v => { PALETTE_CAT = v; const ks = keysOf(v); if (ks.indexOf(PALETTE_KEY) < 0) PALETTE_KEY = ks[0] || null; palette.refresh(); });
    const keys = keysOf(PALETTE_CAT);
    if (!PALETTE_KEY || keys.indexOf(PALETTE_KEY) < 0) PALETTE_KEY = keys[0] || null;
    if (keys.length) rows.select(P, 'building', keys.map(k => [k, label(k)]), () => PALETTE_KEY || '', v => { PALETTE_KEY = v; });
    else rows.note(P, 'nothing of that category in this catalogue');
    rows.note(P, ctx.catalogue.keys().length + ' entries in the catalogue under the ' + TH.name + ' theme; pick one, then click the ground with the building tool');
    const THS = window.VILLAGE_GEN && window.VILLAGE_GEN.THEMES;
    if (THS) { const tk = Object.keys(THS); if (!SITE_THEME || tk.indexOf(SITE_THEME) < 0) SITE_THEME = tk[0]; rows.select(P, 'site theme', tk.map(k => [k, THS[k].name]), () => SITE_THEME, v => { SITE_THEME = v; }); }
  }
  function objectsPalette(P) {
    for (const kind of ['prop', 'billboard', 'aircraft', 'animal']) {
      const keys = objectKeys(kind, rec);
      if (!keys.length) { rows.note(P, 'no ' + kind + 's registered here'); continue; }
      if (!OBJ_PICK[kind]) OBJ_PICK[kind] = keys[0][0];
      rows.select(P, kind, keys, () => OBJ_PICK[kind] || '', v => { OBJ_PICK[kind] = v; });
    }
    rows.note(P, 'a prop stands on the composed ground where you click, tilted to it; a billboard is a painted sign on its posts; an aeroplane is a build parked on its wheels, nose along its turn. Each is ONE record: drag its disc to move it. ASSETS has the models as pictures.');
    rows.note(P, 'an ANIMAL record is a HOTSPOT, not one animal: how many of the species live there and over what radius. They sow themselves inside it, seeded per individual, so changing the count never moves the ones already standing.');
  }

  // ---- THE MODEL PLACER (G2914; the user: "A generic asset visualizer allowing me to drop models from the available bank") --
  // The bank is the prop registry (PROP_REG: every baked pack registers there - the hangar's, the pier kit, the scenery
  // packs ASSETS-OCT G2900 prepares - so nothing here names a key, contract rule 13); its groups are the pills, a search
  // narrows it, each model a thumbnail rendered offscreen once (cached by its bin, which carries the pack's hash). A pick
  // arms the place tool: the GHOST follows the cursor on the ground (R turns it 15 degrees, Alt + wheel scales it, Shift
  // stands it level instead of tilted), a click drops ONE `objects[]` prop record { key, x, z, yaw, dy, on, s? }; the
  // scatter tool drops n of it within a radius, seeded, one record each. A dropped model is selected, dragged, turned
  // (R, the inspector) and scaled (the inspector) like any prop, and saved with the premises.
  const ASSET = { key: null, group: 'all', q: '', yaw: 0, s: 1, level: false, n: 8, r: 12, seed: 1, jitter: 0.15, thumbs: new Map(), queue: [], busy: false };
  const propRegOf = () => (typeof PROP_REG !== 'undefined' ? PROP_REG : ((typeof window !== 'undefined' && window.PROP_REG) || null));
  function assetKeys() {
    const PR = propRegOf(); if (!PR || !PR.props) return [];
    const q = ASSET.q.trim().toLowerCase();
    return (PR.order || Object.keys(PR.props)).filter(k => { const p = PR.props[k]; if (!p || p.lodOf) return false; if (ASSET.group !== 'all' && p.group !== ASSET.group) return false; return !q || (k + ' ' + (p.label || '') + ' ' + (p.group || '')).toLowerCase().indexOf(q) >= 0; });
  }
  // a thumbnail: the host's renderer draws the prop into a small target once its bytes are here (ctx.thumb), one a frame
  function thumbOf(key, img) {
    const PR = propRegOf(), p = PR && PR.props[key], ck = key + '|' + ((p && p.bin) || '');
    const have = ASSET.thumbs.get(ck);
    if (have) { img.src = have; return; }
    if (!ctx.thumb) return;
    ASSET.queue.push({ key, ck, img });
    if (ASSET.busy) return;
    ASSET.busy = true;
    const step = () => {
      const job = ASSET.queue.shift();
      if (!job) { ASSET.busy = false; return; }
      Promise.resolve(ctx.thumb(job.key)).then(url => { if (url) { ASSET.thumbs.set(job.ck, url); job.img.src = url; } }, () => {}).then(() => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(step) : setTimeout(step, 16)));
    };
    step();
  }
  function assetsPalette(P) {
    const PR = propRegOf();
    if (!PR || !PR.props || !(PR.order || []).length) { rows.note(P, 'no model bank on this page (the prop registry is empty)'); return; }
    const srch = $('input', { type: 'text', placeholder: 'search the bank', value: ASSET.q }); srch.className = 'pr-name';
    srch.oninput = () => { ASSET.q = srch.value; fillGrid(); };
    P.appendChild(srch);
    const groups = (PR.groups || []).filter(g => (PR.order || []).some(k => PR.props[k] && !PR.props[k].lodOf && PR.props[k].group === g[0]));
    rows.pills(P, 'group', [['all', 'all', 'every model of the bank']].concat(groups.map(g => [g[0], g[1] || g[0]])), () => ASSET.group, v => { ASSET.group = v; fillGrid(); });
    const grid = $('div', { class: 'pr-assets' }); P.appendChild(grid);
    const info = $('div', { class: 'note' }); P.appendChild(info);
    const fillGrid = () => {
      grid.innerHTML = '';
      const ks = assetKeys();
      for (const k of ks.slice(0, 240)) {
        const p = PR.props[k], b = $('button', { class: 'pr-asset' + (k === ASSET.key ? ' on' : ''), type: 'button', title: k + (p.dim ? ' · ' + p.dim.map(v => (+v).toFixed(1)).join(' x ') + ' m' : '') + (p.nt ? ' · ' + p.nt.toLocaleString() + ' tris' : '') });
        const img = $('img', { alt: '' }); b.appendChild(img); b.appendChild($('span', { text: p.label || k }));
        b.onclick = () => { ASSET.key = k; if (tool !== 'place' && tool !== 'scatter') setTool('place'); else armGhost(); fillGrid(); b.blur && b.blur(); };
        grid.appendChild(b);
        thumbOf(k, img);
      }
      info.textContent = ks.length + ' model' + (ks.length === 1 ? '' : 's') + (ks.length > 240 ? ' (the first 240 shown - search to narrow)' : '') + (ASSET.key ? ' · picked: ' + ASSET.key : ' · pick one, then click the ground');
    };
    fillGrid();
    rows.section(P, 'THE DROP');
    rows.slider(P, 'turn (°)', -180, 180, 15, () => ASSET.yaw * 180 / Math.PI, v => { ASSET.yaw = v * Math.PI / 180; armGhost(); }, v => v.toFixed(0) + '°');
    rows.slider(P, 'scale', 0.25, 4, 0.05, () => ASSET.s, v => { ASSET.s = v; armGhost(); }, v => 'x' + (+v).toFixed(2));
    rows.check(P, 'stand level (not tilted to the ground)', () => ASSET.level, v => { ASSET.level = !!v; armGhost(); });
    rows.section(P, 'SCATTER');
    rows.slider(P, 'how many', 2, 40, 1, () => ASSET.n, v => { ASSET.n = Math.round(v); }, v => String(v));
    rows.slider(P, 'within (m)', 2, 120, 1, () => ASSET.r, v => { ASSET.r = v; }, v => v.toFixed(0) + ' m');
    rows.slider(P, 'size spread', 0, 0.5, 0.05, () => ASSET.jitter, v => { ASSET.jitter = v; }, v => '±' + (v * 100).toFixed(0) + ' %');
    rows.slider(P, 'seed', 1, 99, 1, () => ASSET.seed, v => { ASSET.seed = v; }, v => String(v));
  }
  // the ghost: the picked model on the ground under the cursor
  let ghostAt = null;
  function armGhost(g) {
    if (g) ghostAt = g;
    if ((tool !== 'place' && tool !== 'scatter') || !ASSET.key || !ghostAt) { if (R.ghostModel) R.ghostModel(null); return; }
    if (R.ghostModel) R.ghostModel({ key: ASSET.key, x: ghostAt[0], z: ghostAt[2], yaw: ASSET.yaw + (R.overlay ? R.overlay.frame.yaw : 0), s: ASSET.s, level: ASSET.level, r: tool === 'scatter' ? ASSET.r : 0 });
    ctx.redraw && ctx.redraw();
  }
  // ONE drop: a prop record at a premises point (the place tool's click, a script's)
  function placeAsset(L, key, yaw, s, level, only) {
    const k = key || ASSET.key; if (!k) { strip.status('pick a model in the palette first'); return null; }
    const e = { id: PG.newId(rec, 'objects'), kind: 'prop', key: k, x: +L[0].toFixed(2), z: +L[1].toFixed(2), yaw: +(yaw === undefined ? ASSET.yaw : yaw).toFixed(4), dy: 0, on: (level === undefined ? ASSET.level : level) ? 'flat' : 'ground' };
    const sc = s === undefined ? ASSET.s : s; if (Math.abs(sc - 1) > 1e-3) e.s = +sc.toFixed(3);
    if (only) return e;
    run({ layer: 'objects', id: e.id, before: null, after: e, label: 'model ' + e.id + ' (' + k + ')' });
    return e.id;
  }
  // SCATTER: n of the picked model within the radius, seeded (the same seed, the same scatter), turned and sized at random,
  // each its own record (select one and Del takes it out alone); the scatter is one undo step
  function scatterAsset(L, o) {
    const k = (o && o.key) || ASSET.key; if (!k) { strip.status('pick a model in the palette first'); return []; }
    const n = (o && o.n) || ASSET.n, r = (o && o.r) || ASSET.r, rnd = PG.mulberry32(PG.hash32((o && o.seed) || ASSET.seed, PG.fnv(k + ':' + L[0].toFixed(1) + ':' + L[1].toFixed(1)))), jit = o && o.jitter !== undefined ? o.jitter : ASSET.jitter;
    const many = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = r * Math.sqrt(rnd());
      const e = placeAsset([L[0] + Math.cos(a) * d, L[1] + Math.sin(a) * d], k, rnd() * Math.PI * 2, ((o && o.s) || ASSET.s) * (1 + (rnd() * 2 - 1) * jit), undefined, true);
      rec.layers.objects.push(e);   // (placed before the next id is asked: newId sees it)
      many.push({ layer: 'objects', id: e.id, before: null, after: clone(e) });
    }
    rec.layers.objects.splice(rec.layers.objects.length - many.length, many.length);
    run({ many, label: n + ' x ' + k + ' scattered' });
    strip.status(n + ' x ' + k + ' scattered within ' + r.toFixed(0) + ' m');
    return many.map(c => c.id);
  }
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
  function fileRows(P) {
    rows.section(P, 'FILE');
    const nm = $('input', { type: 'text', placeholder: 'name', value: recName || '' }); nm.className = 'pr-name';
    nm.onchange = () => { recName = nm.value || null; rec.name = rec.name || recName || ''; autosave(); };
    P.appendChild(nm);
    rows.button(P, 'new', () => { rec = PG.normalise(PG.DEF()); recName = null; undoS.length = 0; redoS.length = 0; select(null); dirty(null); });
    rows.button(P, 'save (Ctrl+S)', () => save(recName));
    rows.button(P, 'export json', () => {
      const txt = PG.envelope(recName, rec);
      const a = document.createElement('a'); a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(txt); a.download = (recName || 'premises') + '.json'; a.click();
    });
    const ta = $('textarea', { placeholder: 'paste an envelope or a bare record here, then import', rows: '4' }); ta.className = 'pr-paste';
    P.appendChild(ta);
    rows.button(P, 'import', () => { try { load(ta.value); ta.value = ''; } catch (e) { strip.status('import refused: ' + e.message); } });
    if (storage) {
      const slots = [];
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith('flydiy.premises.slot.')) slots.push(k.slice(21)); }
      if (slots.length) rows.select(P, 'load slot', slots.map(s => [s, s]), () => '', v => { try { load(storage.getItem('flydiy.premises.slot.' + v)); } catch (e) { strip.status(e.message); } });
    }
    rows.slider(P, 'premises seed', 1, 99, 1, () => rec.seed, v => { rec.seed = v; dirty('zones'); }, v => String(v));
    // THE THEME (v9): one word on the record; the themes are the composer's table
    rows.pills(P, 'theme', Object.keys(PG.THEMES).map(k => [k, PG.THEMES[k].name, PG.THEMES[k].blurb || '']), () => rec.theme || PG.THEME_DEF, v => { rec.theme = v; dirty('zones'); });
    rows.note(P, PG.themeOf(rec).blurb || '');
    // THE PAVEMENT (v1.16): the premises' recipe - every knob of the bench's table, over the module's
    // defaults, under each strip's or road's own; a bench export pasted fills it whole
    if (PAVM) {
      const d = $('details'); d.appendChild($('summary', { text: 'pavement' + (rec.pavement && Object.keys(rec.pavement).length ? ' (' + Object.keys(rec.pavement).length + ' set)' : '') })); P.appendChild(d);
      const PV = rec.pavement || {};
      let sec = null;
      for (const row of PAVM.KNOBS) {
        if (row.length === 1) { sec = $('details'); sec.appendChild($('summary', { text: row[0].replace(/—/g, '').trim() })); d.appendChild(sec); continue; }
        const [k, lab, mn, mx, st] = row, own = PV[k] !== undefined && PV[k] !== null;
        rows.slider(sec || d, lab + (own ? '' : ' (default)'), mn, mx, st, () => own ? PV[k] : PAVM.RECIPE[k], v => { rec.pavement = Object.assign({}, rec.pavement, { [k]: v }); dirty('roads'); }, v => (+v).toFixed(2));
      }
      const ta2 = $('textarea', { placeholder: 'paste the pavement bench\'s export here', rows: '3' }); ta2.className = 'pr-paste'; d.appendChild(ta2);
      rows.button(d, 'take the bench\'s recipe', () => { try { const o = JSON.parse(ta2.value); const r = o.recipe || o; const out = {}; for (const k in r) if (k in PAVM.RECIPE && k !== 'grade') out[k] = r[k]; rec.pavement = out; ta2.value = ''; dirty('roads'); palette.refresh(); } catch (err) { strip.status('not a recipe: ' + err.message); } });
      rows.button(d, "back to the module's defaults", () => { rec.pavement = null; dirty('roads'); palette.refresh(); });
    }
    rows.note(P, 'autosaved to ' + LS_WIP + ' a second after every edit; a load replaces');
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
    // THE RUNWAY LOOK (G1394, RUNWAY-LOOK): this pavement's SURFACE TYPE's look - the premises' (rec.pavement), so every
    // strip, road and apron of the type follows: the surface's brightness and tint, its wear, the sides' colour, width
    // and blend. The same rows as the FILE section's pavement > runway look, here where the runway is
    if (PAVM.LOOK_KEYS && PAVM.groupOf) {
      const g = PAVM.groupOf(RS.cls), P = rec.pavement || {};
      const own = PAVM.LOOK_KEYS.some(k => k.slice(0, 2) === g && P[k] !== undefined && P[k] !== null);
      const d2 = $('details'); d2.appendChild($('summary', { text: 'look of every ' + PAVM.LOOK_GROUPS[g].join(' / ') + ' pavement' + (own ? ' (set)' : '') })); insp.appendChild(d2);
      for (const row of PAVM.KNOBS) {
        if (row.length < 2 || PAVM.LOOK_KEYS.indexOf(row[0]) < 0 || row[0].slice(0, 2) !== g) continue;
        const [k, lab, mn, mx, st] = row, mine = P[k] !== undefined && P[k] !== null;
        rows.slider(d2, lab + (mine ? '' : ' (default)'), mn, mx, st, () => mine ? P[k] : PAVM.RECIPE[k], v => { rec.pavement = Object.assign({}, rec.pavement, { [k]: v }); dirty('roads'); }, v => (+v).toFixed(2));
      }
      if (own) rows.button(d2, "back to the module's look", () => { const o = Object.assign({}, rec.pavement); for (const k of PAVM.LOOK_KEYS) if (k.slice(0, 2) === g) delete o[k]; rec.pavement = Object.keys(o).length ? o : null; dirty('roads'); inspector.refresh(); });
      rows.note(d2, 'the declared width is the drawn width whatever the surface; the side is drawn outside it (its width past the edge zone, from its alpha)');
    }
  }
  function viewRows(P) {
    rows.section(P, 'VIEW');
    if (ctx.cameras) rows.select(P, 'camera', [['orbit', 'orbit (right-drag)'], ['map', 'map (top-down)']].concat(ctx.cameras.flyOk && ctx.cameras.flyOk() ? [['fly', 'fly (WASD / ZQSD, R / F, right-drag looks)']] : []), () => ctx.cameras.mode(), v => { ctx.cameras.set(v); palette.refresh(); });
    // (G2915, the user: "the same controls as the world editor ... and camera speed": the world editor's free camera, its speed)
    if (ctx.cameras && ctx.cameras.flyOk && ctx.cameras.flyOk()) {
      rows.slider(P, 'camera speed', 1, 400, 1, () => ctx.cameras.speed(), v => ctx.cameras.speed(v), v => (+v).toFixed(0) + ' m/s');
      rows.note(P, 'FLY: the keys by their place (WASD, or ZQSD on a French keyboard), R / F up and down, Shift x5, right-drag to look, the wheel for the speed; Tab cycles orbit, map, fly. A click still edits.');
    }
    rows.check(P, 'surface overlay', () => ctx.overlayOn ? ctx.overlayOn() : true, v => { R.overlayOn(v); ctx.overlayOn && ctx.overlayOn(v); ctx.redraw && ctx.redraw(); });
    // THE TIME (SKY chantier): the clock's hand in the world editor - one clock for the shed and the world
    if (ctx.day && ctx.day.day && ctx.day.day()) {
      const CK = ctx.day;
      rows.section(P, 'TIME');
      rows.select(P, 'time of day', CK.PRESETS.map(p => [p, p]), () => CK.nearestPreset(), v => { CK.preset(v); if (ctx.redraw) ctx.redraw(); });
      rows.slider(P, 'local hour', 0, 24, 1 / 12, () => CK.localHours(), v => CK.set({ localHours: v }),
                  v => String(Math.floor(v)).padStart(2, '0') + ':' + String(Math.round((v % 1) * 60)).padStart(2, '0'));
      rows.select(P, 'rate', CK.RATES.map(r => [String(r), r === 0 ? 'frozen' : r === 1 ? 'real time' : r + 'x']), () => String(CK.day().rate), v => CK.rate(+v));
      // THE CLOUDS (C4): the day's cover and type
      rows.slider(P, 'cloud cover', 0, 1, 0.05, () => CK.day().cloudCover, v => CK.set({ cloudCover: v }), v => (v * 100).toFixed(0) + ' %');
      if (typeof CLOUD_FIELD !== 'undefined') rows.select(P, 'cloud type', CLOUD_FIELD.TYPE_ORDER.map(t => [t, CLOUD_FIELD.TYPES[t].label]), () => CK.day().cloudType, v => CK.set({ cloudType: v }));
      // THE UPPER DECKS (A6): the same two rows the flight rail carries, per deck
      if (typeof CLOUD_FIELD !== 'undefined') for (let di = 0; di < CLOUD_FIELD.MAX_LAYERS - 1; di++) {
        const up = () => CK.day().cloudUpper[di] || { cover: 0, type: 'ac' };
        const put = patch => { CK.set({ cloudUpper: CLOUD_FIELD.upperWith(CK.day().cloudUpper, di, patch) }); if (ctx.redraw) ctx.redraw(); };
        rows.slider(P, 'upper deck ' + (di + 1), 0, 1, 0.05, () => up().cover, v => put({ cover: v }), v => v > 0 ? (v * 100).toFixed(0) + ' %' : 'none');
        rows.select(P, 'deck ' + (di + 1) + ' type', CLOUD_FIELD.TYPE_ORDER.map(t => [t, CLOUD_FIELD.TYPES[t].label]), () => up().type, v => put({ type: v }));
        rows.slider(P, 'deck ' + (di + 1) + ' base', 500, 9000, 100, () => (up().base != null ? up().base : CLOUD_FIELD.TYPES[CLOUD_FIELD.typeOf(up().type)].alt), v => put({ base: v }), v => v + ' m');
      }
      rows.note(P, 'the sun, the sky and the lights follow the clock; drag a LIGHT slider below to take the sun by hand');
    }
    if (ctx.rig) {
      rows.section(P, 'LIGHT');
      // dragging either sun slider takes the rig MANUAL (the day drives it otherwise - SKY chantier)
      rows.slider(P, 'sun elev', 2, 90, 0.5, () => ctx.rig.get().elev, v => ctx.rig.set({ manual: true, elev: v }), v => v.toFixed(1) + '°');
      rows.slider(P, 'sun azimuth', -180, 180, 1, () => ctx.rig.get().azim, v => ctx.rig.set({ manual: true, azim: v }), v => v.toFixed(0) + '°');
      rows.slider(P, 'exposure', 0.3, 2.5, 0.02, () => ctx.rig.get().exposure, v => ctx.rig.set({ exposure: v }));
      if (ctx.rig.get().manual !== undefined) rows.check(P, 'the sun by hand', () => !!ctx.rig.get().manual, v => ctx.rig.set({ manual: !!v }));
    }
    rows.note(P, 'Tab cycles the camera (orbit, map, fly); Esc cancels; Del deletes; Ctrl+Z / Ctrl+Y undo and redo; 1-6 pick a section');
  }

  // THE LIFE (SCENERY LIFE, contract v1.22): the record's `life` block - the people, the wall clutter, the rubbish,
  // the parked cars, the small structures and the antennas the renderer stands round what is built, by laws
  // (src/viewer/scenery_life.js); a row writes the block and the life re-stands at once (no recompose); a key
  // left at its default is not written
  let lifeT = 0;
  function lifeRows(P) {
    const SL = window.SCENERY_LIFE, L = R.life;
    rows.section(P, 'LIFE');
    if (!SL || !L) { rows.note(P, 'this page has no scenery life (scenery_life.js did not load)'); return; }
    const cur = () => Object.assign({}, SL.DEF, rec.life || {});
    const note = rows.note(P, '');
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
    rows.pills(P, 'life', [['on', 'on', 'the life stands round what is built'], ['off', 'off', 'none of it: the premises as built']], () => (cur().on ? 'on' : 'off'), v => { setK('on', v === 'on'); show(); });
    rows.slider(P, 'draw distance', 0.25, 2, 0.05, () => cur().dist, v => setK('dist', +v), v => 'x' + (+v).toFixed(2));
    for (const [k, lab, mx, why] of SL.CATS) { const r = rows.slider(P, lab, 0, mx, 0.05, () => cur()[k], v => setK(k, +v), v => (+v === 0 ? 'none' : 'x' + (+v).toFixed(2))); r.title = why; }
    rows.slider(P, 'life seed', 1, 99, 1, () => cur().seed, v => setK('seed', +v), v => String(v));
    rows.button(P, 'back to the defaults', () => { rec.life = undefined; L.set(null); autosave(); palette.refresh(); });
    rows.note(P, 'every kind is drawn instanced and cut by distance (rubbish 45 m, clutter 110, people 220, cars 450, a mast 6 km) x the draw distance x the GRAPHICS tier');
    show();
  }

  // ---- save / load -----------------------------------------------------------------
  function save(name) {
    if (!storage) return;
    const n = name || recName || 'premises';
    recName = n; rec.name = rec.name || n;
    try { storage.setItem('flydiy.premises.slot.' + n, PG.envelope(n, rec)); storage.setItem(LS_WIP, PG.envelope(n, rec)); strip.status('saved as ' + n); } catch (e) { strip.status('save failed: ' + e.message); }
    if (section === 'file') palette.refresh();
  }
  // (G2910) the editor holds every polygon as an AREA: a record still carrying foldable v1 entries (a v1 file the migrator
  // already saw, a hand edit) has them folded on load - every layer keeps its order, so it composes the same
  const foldIn = r => { try { if (PG.AREA_LAYERS.some(k => (r.layers[k] || []).some(e => PG.areaFoldable(k, e)))) PG.foldAreas(r); } catch (e) { console.warn('premises fold:', e.message); } return r; };
  function load(txt) {
    const U = PG.unwrap(txt);
    rec = foldIn(U.rec); recName = U.name; undoS.length = 0; redoS.length = 0;
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
  if (ctx.record) { try { const U = PG.unwrap(ctx.record); rec = foldIn(U.rec); recName = U.name; } catch (e) { console.warn('premises record:', e.message); } }
  else if (!ctx.fresh && loadWip()) rec = foldIn(rec);
  buildRail(); buildStrip(); palette.refresh(); ctx.onSection && ctx.onSection(SECTIONS.find(s => s.k === section));
  R.setRecord(rec); R.rebuild(null); inspector.refresh(); checks(); plaque();
  // (G2914) Alt + wheel scales the placer's ghost - before the host's wheel zooms (capture, the same element)
  if (view.addEventListener) view.addEventListener('wheel', ev => { if (!active || !ev.altKey || (tool !== 'place' && tool !== 'scatter')) return; ASSET.s = Math.max(0.25, Math.min(4, ASSET.s * (ev.deltaY < 0 ? 1.06 : 1 / 1.06))); armGhost(); ev.preventDefault(); ev.stopImmediatePropagation(); }, { capture: true, passive: false });

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
      // G1400: the drag in its three beats, for a bench that times the hand's moves apart from its release
      // (tools/perf/editor_lag.js): the same startDrag / moveDrag / onUp the mouse runs, the ground point given
      if (name === 'dragStart') { if (!selected) throw new Error('premises: nothing selected'); const h = R.handles(selected).find(q => q.key === args.key); if (!h) return false; return startDrag({ id: selected, key: h.key, index: +(h.key.slice(1)) || 0, mid: h.key[0] === 'm' }); }
      if (name === 'dragMove') { if (!drag) return false; const w = R.overlay.frame.toWorld(args.x, args.z); return moveDrag([w[0], R.heightAt(w[0], w[1]), w[1]]); }
      if (name === 'dragEnd') return onUp();
      if (name === 'commit') { commitDrawing(); return selected; }
      if (name === 'resume') { return resumeDrawing(args.id || selected); }
      if (name === 'ctrl') { const hs = R.handles(selected); const h = args.key ? hs.find(q => q.key === args.key) : null; return ctrlEdit(selected, [args.x, args.z], h ? { key: h.key, index: +(h.key.slice(1)) || 0, mid: h.mid } : null); }
      // G2890: the shape's hand, scriptable (GATE PREMISES' editor rows): a click on the selection's edge, a corner picked /
      // removed, the subdivision, the plot pick's click
      if (name === 'edge') { return edgeInsert(args.id || selected, [args.x, args.z], args.tol || 1.5); }
      if (name === 'corner') { setCorner(args.i); return corner; }
      if (name === 'removeCorner') { return removeCorner(args.id || selected, args.i === undefined ? corner : args.i); }
      if (name === 'subdivide') { return subdivide(args.id || selected); }
      if (name === 'plotGround') { return togglePlotGround(args.zone, [args.x, args.z]); }
      // G2910-G2914: an area's properties, the placer, the fold - scriptable (GATE SCENERYED)
      if (name === 'addProp') { return addProp(args.id || selected, args.prop); }
      if (name === 'removeProp') { return removeProp(args.id || selected, args.prop); }
      if (name === 'setProp') { const id = args.id || selected; edit(id, 'areas', x => { x.props = Object.assign({}, x.props); x.props[args.prop] = Object.assign({}, x.props[args.prop] || {}, args.patch); }, args.prop + ' of ' + id); return true; }
      if (name === 'pick') { ASSET.key = args.key; if (args.yaw !== undefined) ASSET.yaw = args.yaw; if (args.s !== undefined) ASSET.s = args.s; if (args.level !== undefined) ASSET.level = !!args.level; return ASSET.key; }
      if (name === 'place') { return placeAsset([args.x, args.z], args.key, args.yaw, args.s, args.level); }
      if (name === 'scatter') { return scatterAsset([args.x, args.z], args); }
      if (name === 'assets') { const g0 = ASSET.group, q0 = ASSET.q; ASSET.group = args.group || 'all'; ASSET.q = args.q || ''; const ks = assetKeys(); ASSET.group = g0; ASSET.q = q0; return ks; }
      if (name === 'fold') { const n = PG.foldAreas(rec); dirty(null); return n; }
      if (name === 'paletteEl') { return pal; }
      if (name === 'snapshot') { return snapshot(true); }
      if (name === 'inspector') { return insp; }
      if (name === 'tool') { setTool(args.name); return tool; }
      if (name === 'section') { setSection(args.name); return section; }
      throw new Error('premises: unknown cmd ' + name);
    },
    dirty: () => dirty(null),
    close() { active = false; host.innerHTML = ''; if (els.rail) els.rail.innerHTML = ''; if (R.ghostModel) R.ghostModel(null); },   // the renderer is the host's to keep or dispose (G2914: the placer's ghost goes, the rail plate empties)
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
.pr-pal{flex:1 0 100%;max-height:50vh;overflow-y:auto;width:auto;border:0;padding:0 4px;pointer-events:auto;background:rgba(14,18,24,.92);border-radius:6px} .pr-pal:empty{display:none}
.pr-selhd{display:flex;align-items:center;gap:8px;padding:6px 0 8px;border-bottom:1px solid var(--grid,#242a33);margin-bottom:4px} .pr-selhd .sk{font-size:9px;letter-spacing:.18em;color:var(--acc,#5db3ff)} .pr-selhd .sn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pr-assets{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:6px;margin:6px 0} .pr-asset{display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px;background:#1a1f27;color:var(--fg,#dfe6ee);border:1px solid var(--grid,#242a33);border-radius:5px;font:inherit;font-size:10px;cursor:pointer;min-width:0} .pr-asset img{width:64px;height:64px;background:#0e1218} .pr-asset span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .pr-asset.on{border-color:var(--acc,#5db3ff)}
`;
if (typeof document !== 'undefined') { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

window.PREMISES_UI = { mount, SECTIONS, TOOL_LABEL, TOOL_HELP };
})();
