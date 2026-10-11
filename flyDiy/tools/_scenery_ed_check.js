#!/usr/bin/env node
// GATE SCENERYED — the scenery editor's HAND, headless (G2890 SCENERY-ED-1, contract v1.35).
//
//   node tools/_scenery_ed_check.js
//
// GATE PREMISES holds the record (the spline road, the round pad, the plots' ground, the trees' regions); this gate
// mounts the editor module itself (src/viewer/premises_ui.js) under a DOM stub and a renderer stub that composes with
// the real core (src/core/27_premises.js), and drives the user's unblockers through its own command surface - the
// entry the mouse's handlers call:
//   1  A POLYGON EDITED: drawn (four corners), a corner added by a click on its edge (the new corner picked), the
//      picked corner removed, the shape subdivided (a corner mid-way on every edge), undone; the record saved and
//      loaded back is the same record at every step.
//   2  THE ROUND PAD: the pad tool's two clicks (the centre, the rim) stand a paved polygon whose circle is the truth;
//      its rim disc dragged sets the radius and the polygon follows; a pad under 3 m is refused.
//   3  THE SMOOTH ROAD: a road traced is a spline (curve 'spline'); a point's handle dragged writes its `tan`; a corner
//      added on the road keeps every handle beside its point; 'corners' in the inspector takes the curve off.
//   4  THE PLOTS' GROUND: the plot pick's click switches one plot's ground off (the zone's noGround), again on.
//   5  NAMES: the module names itself the scenery editor where it names its record.
//   6  THE AREAS (G2910): a tool draws ONE area (the surface tool: gravel wheels AND gravel drawn), it composes as its v1
//      entries; a gravel area without a draw says it draws nothing; a property added / set / removed and undone; the
//      inspector's head and sections; a v1 file loads as areas and composes as the file did.
//   7  THE TABS ARE PALETTES: a tab changes the tools and the palette drawer; the inspector keeps the selection;
//      nothing selected, the inspector is the scenery's outline.
//   8  THE MODEL PLACER (G2914): the bank (a stub registry) by group and search, a drop, a turned and scaled level drop,
//      the scatter (n records, one undo), a drag, the save and the load.
// Exits non-zero on any red; prints GATE SCENERYED: PASS / FAIL.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const TOOLS = __dirname, ROOT = path.join(TOOLS, '..');
const PG = require(path.join(ROOT, 'src', 'core', '27_premises.js'));

const fail = [];
// the long roads' budgets (row 9, headless): the composition of two island roads, one drag's edit, 25 000 samples
const LONG_BUDGET = { compose: 3000, drag: 3000, samples: 1500 };
let checks = 0;
function check(ok, what, detail) { checks++; if (!ok) fail.push(what + (detail ? ' — ' + detail : '')); return ok; }

// ---- the DOM, as little of it as the module touches ------------------------------------------------------------------
function El(tag) {
  this.tagName = String(tag).toUpperCase(); this.children = []; this.style = { cssText: '', display: '' }; this.attrs = {}; this._text = '';
  const cls = new Set(); this.classList = { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); }, contains: c => cls.has(c) };
  this.listeners = {};
}
El.prototype.appendChild = function (c) { this.children.push(c); return c; };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
El.prototype.addEventListener = function (k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); };
El.prototype.querySelector = function () { return null; };
El.prototype.blur = function () {};
Object.defineProperty(El.prototype, 'innerHTML', { get() { return ''; }, set() { this.children = []; } });
Object.defineProperty(El.prototype, 'textContent', { get() { return this._text; }, set(v) { this._text = String(v); } });
const document = { createElement: t => new El(t), createElementNS: (ns, t) => new El(t), head: new El('head'), body: new El('body') };

// ---- the world and the renderer: the real composition, no THREE --------------------------------------------------------
const synth = { id: 'synth', terrainH: (x, z) => 2 * Math.sin(x / 50) + 1.5 * Math.cos(z / 40) + 0.01 * z, waterH: () => -6 };
function makeR() {
  let rec = PG.normalise(PG.DEF()), O = PG.compose(rec, synth), sel = null, corner = null;
  const handleKeys = id => {
    const f = PG.findById(rec, id); if (!f) return [];
    const e = f.entry, out = [];
    if (PG.roundOk(e.round)) return [{ key: 'rc', p: [e.round.c[0], 0, e.round.c[1]] }, { key: 'rr', p: [e.round.c[0] + e.round.r, 0, e.round.c[1]], mid: true }];
    if (isFinite(+e.x) && isFinite(+e.z) && !e.poly) return [{ key: 'v0', p: [+e.x, 0, +e.z] }];   // a point object (a model): one disc
    const arr = e.poly || e.pts; if (!arr) return out;
    arr.forEach((q, i) => { out.push({ key: 'v' + i, p: [q[0], 0, q[1]] }); if (e.poly || i + 1 < arr.length) out.push({ key: 'm' + i, p: [q[0], 0, q[1]], mid: true }); });
    if (e.pts && e.curve === 'spline') PG.roadHandles(e.pts, e.tan).forEach((h, i) => out.push({ key: 'h' + i, p: [e.pts[i][0] + h[0], 0, e.pts[i][1] + h[1]] }));
    return out;
  };
  const R = {
    stats: {}, get overlay() { return O; },
    setRecord(r) { rec = PG.normalise(r); },
    rebuild(d) { R.lastDirty = d === undefined ? null : d; O = PG.compose(rec, synth); return R.stats; },
    select(id) { if (id !== sel) corner = null; sel = id; },
    corner(i) { if (i !== undefined) corner = i; return corner; },
    ghost() {}, preview() {}, previewEnd() {}, pickHandle() { return null; },
    handles: handleKeys,
    hit(x, z) { const L = O.frame.toLocal(x, z); for (const k of ['areas', 'material', 'surface', 'zones', 'terrain']) for (const e of rec.layers[k]) if (e.poly && PG.inPoly(e.poly, L[0], L[1])) return { id: e.id, layer: k, entry: e }; return null; },
    ghostModel(sp) { R.ghostAt = sp; },
    heightAt: (x, z) => O.terrainAt ? O.terrainAt(x, z) : synth.terrainH(x, z),
    plots: () => O.records.plots, links: () => [], aerodromes: () => O.aerodromes || [], patternOf: () => null,
  };
  return R;
}

// ---- the module, in its own context -------------------------------------------------------------------------------------
const win = { PREMISES_GEN: PG, addEventListener() {}, console };
const ctxG = { window: win, document, console, Math, JSON, Object, Array, Set, Map, Number, String, isFinite, Date, Error, parseInt, parseFloat,
               setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {} };
ctxG.globalThis = ctxG;
vm.createContext(ctxG);
const UI_SRC = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'premises_ui.js'), 'utf8');
vm.runInContext(UI_SRC, ctxG, { filename: 'premises_ui.js' });
const UI = win.PREMISES_UI;
check(!!(UI && UI.mount), '0 the module mounts headless');
if (!UI || !UI.mount) { console.log('GATE SCENERYED: FAIL (no module)'); process.exit(1); }

const notes = [];
const noop = () => {};
const rows = { slider: noop, select: noop, check: noop, note: (h, t) => notes.push(String(t)), section: (h, t) => notes.push('§' + t), button: (h, t) => notes.push('[' + t + ']'), pills: noop };
const R = makeR();
const view = new El('div');
const ed = UI.mount(new El('div'), { THREE: null, world: synth, R, rows, els: { chk: null, plaque: null, strip: new El('div') }, viewEl: view, storage: null, fresh: true, camera: () => null, redraw: noop });
const rec = () => ed.record();
const roundTrip = () => JSON.stringify(PG.unwrap(PG.envelope('t', rec())).rec.layers) === JSON.stringify(PG.normalise(JSON.parse(JSON.stringify(rec()))).layers);
const find = id => PG.findById(rec(), id);

// 1 A POLYGON EDITED
ed.setSection('terrain'); ed.cmd('tool', { name: 'surface' });
for (const q of [[0, 0], [40, 0], [40, 30], [0, 30]]) ed.cmd('point', { x: q[0], z: q[1] });
const sid = ed.cmd('commit');
const poly = () => find(sid).entry.poly;
check(sid && poly().length === 4, '1 a surface polygon drawn with four corners');
ed.cmd('tool', { name: 'select' }); ed.select(sid);
check(ed.cmd('edge', { x: 20, z: -0.4, tol: 1.5 }) === true && poly().length === 5, '1 a click on an edge adds a corner there', poly().length + ' corners');
const picked = ed.cmd('corner', { i: 1 });
check(picked === 1 && Math.abs(poly()[1][0] - 20) < 0.01, '1 the new corner sits on the edge, picked');
check(roundTrip(), '1 the record round-trips after the insert');
check(ed.cmd('edge', { x: 20, z: 15, tol: 1.5 }) === false, '1 a click inside, off the edge, adds nothing');
check(ed.cmd('removeCorner', { i: 1 }) === true && poly().length === 4, '1 the picked corner removed');
check(roundTrip(), '1 the record round-trips after the removal');
ed.cmd('subdivide', {});
check(poly().length === 8 && PG.polySimple(poly()), '1 subdivide: a corner mid-way on every edge (the closing one too)', poly().length + ' corners');
ed.undo();
check(poly().length === 4, '1 undo takes the subdivision back');
for (let k = 0; k < 2; k++) ed.cmd('removeCorner', { i: 0 });
check(poly().length === 3, '1 a polygon keeps three corners (the last removal refused)', poly().length + ' corners');
// a terrain grade's points carry their height: a corner added on its edge takes the height between
const gid = ed.cmd('add', { layer: 'terrain', entry: { kind: 'grade', pts: [[0, 100, 2], [100, 100, 6]], width: 6, falloff: 8 } });
ed.select(gid);
check(ed.cmd('edge', { x: 25, z: 100.3, tol: 1.5 }) === true && find(gid).entry.pts.length === 3 && Math.abs(find(gid).entry.pts[1][2] - 3) < 0.01, '1 a grade\'s new corner takes the height between its neighbours', JSON.stringify(find(gid).entry.pts[1]));
ed.select(sid);
check(notes.some(t => /^§SHAPE/.test(t)) && notes.some(t => /^\[subdivide/.test(t)), '1 the inspector shows the SHAPE section and its buttons');

// 2 THE ROUND PAD
ed.setSection('airfield'); ed.cmd('tool', { name: 'pad' });
ed.cmd('point', { x: 200, z: 100 }); ed.cmd('point', { x: 201, z: 100 });
check(!rec().layers.areas.some(m => m.round), '2 a pad under 3 m is refused');
ed.cmd('tool', { name: 'pad' });
ed.cmd('point', { x: 200, z: 100 }); ed.cmd('point', { x: 215, z: 100 });
const pad = rec().layers.areas.find(m => m.round);   // (G2910: an AREA - its circle, concrete drawn, the wheels paved)
check(pad && pad.props.draw && pad.props.draw.look === 'concrete' && pad.props.wheels && pad.props.wheels.surface === PG.SURFACE.PAVED && Math.abs(pad.round.r - 15) < 0.01 && pad.poly.length === 48, '2 the pad tool\'s two clicks stand a round concrete pad');
ed.select(pad.id);
ed.cmd('drag', { key: 'rr', x: 225, z: 100 });
const pad2 = find(pad.id).entry;
check(Math.abs(pad2.round.r - 25) < 0.01 && pad2.poly.every(q => Math.abs(Math.hypot(q[0] - 200, q[1] - 100) - 25) < 0.01), '2 its rim disc sets the radius, the polygon follows', 'r ' + pad2.round.r);
ed.cmd('drag', { key: 'rc', x: 210, z: 90 });
check(find(pad.id).entry.round.c[0] === 210 && roundTrip(), '2 its centre disc moves it; the record round-trips');
const Op = PG.compose(rec(), synth), w = Op.frame.toWorld(210, 90);
check(Op.surfaceAt(w[0], w[1]) === PG.SURFACE.PAVED, '2 the wheels feel the pad');

// 3 THE SMOOTH ROAD
ed.setSection('roads'); ed.cmd('tool', { name: 'road' });
for (const q of [[-300, -200], [0, -200], [200, -60]]) ed.cmd('point', { x: q[0], z: q[1] });
const rid = ed.cmd('commit');
const road = () => find(rid).entry;
check(road().curve === 'spline', '3 a road traced is a smooth curve');
ed.cmd('tool', { name: 'select' }); ed.select(rid);
const h1 = R.handles(rid).find(q => q.key === 'h1');
check(!!h1, '3 a spline road shows a handle per point');
ed.cmd('drag', { key: 'h1', x: 60, z: -170 });
check(road().tan && road().tan.length === 3 && road().tan[1][0] === 60 && road().tan[1][1] === 30, '3 a handle dragged writes the point\'s tan', JSON.stringify(road().tan));
const onCurve = PG.roadLine(road())[3];
check(ed.cmd('edge', { x: onCurve[0], z: onCurve[1], tol: 1.5 }) === true && road().pts.length === 4 && road().tan.length === 4 && road().tan[2] && road().tan[2][0] === 60, '3 a point added on the road keeps the handles on their points', JSON.stringify(road().tan));
check(roundTrip(), '3 the road round-trips');
const lineBefore = PG.roadLine(road()).length;
check(lineBefore > road().pts.length * 3, '3 the road is drawn on its curve', lineBefore + ' samples');

// 4 THE PLOTS' GROUND
ed.setSection('roads'); ed.cmd('tool', { name: 'road' });
ed.cmd('point', { x: -150, z: 400 }); ed.cmd('point', { x: 150, z: 400 });
const r2 = ed.cmd('commit');
ed.cmd('set', { id: r2, patch: { curve: undefined } });
ed.setSection('zones'); ed.cmd('tool', { name: 'zone' });
for (const q of [[-140, 360], [140, 360], [140, 440], [-140, 440]]) ed.cmd('point', { x: q[0], z: q[1] });
const zid = ed.cmd('commit');
const plots = R.plots().filter(p => p.zone === zid);
check(plots.length >= 2, '4 the zone sows plots', plots.length + ' plots');
if (plots.length) {
  const c = PG.polyCentroid(plots[0].poly);
  ed.cmd('plotGround', { zone: zid, x: c[0], z: c[1] });
  const ng = () => ((find(zid).entry.rules || {}).noGround || []);
  check(ng().length === 1 && ng()[0] === plots[0].id && R.plots().find(p => p.id === plots[0].id).noGround, '4 the plot pick switches one plot\'s ground off');
  ed.cmd('plotGround', { zone: zid, x: c[0], z: c[1] });
  check(ng().length === 0, '4 ...and on again');
}

// 6 THE AREAS (G2910 SCENERY-ED-2): every polygon a tool draws is ONE area with the tool's properties; a v1 file loads as
//   areas (the migrator; GATE PREMISES holds "the same world"); a property added / removed / set through the inspector's
//   command; a gravel area that draws nothing SAYS so; the inspector's head names the selection
{
  ed.setSection('terrain'); ed.cmd('tool', { name: 'surface' });
  for (const q of [[300, 0], [360, 0], [360, 20], [300, 20]]) ed.cmd('point', { x: q[0], z: q[1] });
  const gid2 = ed.cmd('commit'), A = () => find(gid2).entry;
  check(find(gid2).layer === 'areas' && A().props.wheels.surface === PG.SURFACE.GRAVEL && A().props.draw && A().props.draw.look === 'gravel', '6 the surface tool stands ONE area: the wheels on gravel AND the gravel drawn', JSON.stringify(A().props));
  const Oa = PG.compose(rec(), synth), wc = Oa.frame.toWorld(330, 10);
  check(Oa.surfaceAt(wc[0], wc[1]) === PG.SURFACE.GRAVEL && Oa.excludeAt(wc[0], wc[1], 'trees') && (Oa.pavePolys || []).some(p => p.id === gid2 + '~d'), '6 it composes as its v1 entries: the wheels, the trees kept out, the pavement drawn');
  ed.cmd('removeProp', { id: gid2, prop: 'draw' });
  notes.length = 0; ed.select(null); ed.select(gid2);
  check(!A().props.draw && notes.some(t => /draws NOTHING/.test(t)), '6 a gravel area without a draw says it draws nothing (the user\'s gravel band)');
  check(ed.cmd('addProp', { id: gid2, prop: 'draw' }) && A().props.draw && A().props.draw.look === 'concrete' && A().props.wheels.surface === PG.SURFACE.GRAVEL, '6 + add a property: the draw (its wheels kept)');
  ed.cmd('addProp', { id: gid2, prop: 'marks' });
  check(A().props.marks && A().props.marks.kind === 'parking' && isFinite(A().props.draw.yaw), '6 + marks: parking, the pavement turned to its long side');
  ed.cmd('setProp', { id: gid2, prop: 'marks', patch: { kind: 'hatch' } });
  check(A().props.marks.kind === 'hatch', '6 a property set in place');
  notes.length = 0; ed.select(null); ed.select(gid2);
  const head = ed.cmd('inspector').children[0], hk = head && head.children[0] && head.children[0].textContent, hn = head && head.children[1] && head.children[1].textContent;
  check(hk === 'SELECTED' && /^AREA /.test(hn || '') && hn.indexOf(gid2) >= 0, '6 the inspector\'s head names the selection', hk + ' / ' + hn);
  check(['§WHAT IT DOES', '§TERRAFORM', '§WHEELS', '§DRAW', '§MARKS'].filter(t => notes.some(n => n.indexOf(t) === 0)).length === 4 && notes.some(t => /m²/.test(t)) && notes.some(t => /keeps out: trees, plots/.test(t)), '6 the inspector: its facts, what it does (trees and plots kept out by its wheels), a section per property');
  check(roundTrip(), '6 the area round-trips');
  ed.undo(); ed.undo(); ed.undo();
  check(!A().props.draw && !A().props.marks, '6 undo takes the properties back one by one');
  ed.undo();
  check(A().props.draw && A().props.draw.look === 'gravel', '6 ...to the gravel it drew');
  // a v1 file loads as areas, nothing foldable left; the record composes the same
  const fx = fs.readFileSync(path.join(TOOLS, 'fixtures', 'premises_v1_official.json'), 'utf8');
  const raw = JSON.parse(fx), raw1 = raw.premises || raw;
  ed.load(fx);
  check(rec().layers.areas.length > 0 && PG.AREA_LAYERS.every(k => !(rec().layers[k] || []).some(e => PG.areaFoldable(k, e))), '6 a v1 file loads as areas (' + rec().layers.areas.length + '), no v1 polygon left');
  const O1 = PG.compose(raw1, synth), O2 = PG.compose(rec(), synth);
  let same = true; const ex = O1.extent;
  for (let i = 0; i < 300 && same; i++) { const lx = ex.x0 + (ex.x1 - ex.x0) * ((i * 0.618) % 1), lz = ex.z0 + (ex.z1 - ex.z0) * ((i * 0.377) % 1), w = O1.frame.toWorld(lx, lz); same = Object.is(O1.terrainAt(w[0], w[1]), O2.terrainAt(w[0], w[1])) && O1.surfaceAt(w[0], w[1]) === O2.surfaceAt(w[0], w[1]); }
  check(same && O1.records.plots.length === O2.records.plots.length, '6 ...and the editor\'s record composes as the file did');
  const yArea = rec().layers.areas.find(a => a.props.wheels);
  if (yArea) { R.select && ed.select(yArea.id); check(ed.selected === yArea.id, '6 a migrated area is selectable by its old id (' + yArea.id + ')'); }
}

// 7 THE TABS ARE PALETTES: a tab changes the tools and the palette; the inspector keeps the selection
{
  const keep = ed.selected;
  ed.setSection('file');
  const insp0 = ed.cmd('inspector').children[0];
  check(ed.selected === keep && insp0 && insp0.children[0].textContent === 'SELECTED', '7 FILE lit: the inspector still shows the selection');
  notes.length = 0; ed.setSection('view'); ed.setSection('file');
  check(notes.some(t => t === '§FILE'), '7 the FILE rows are in the palette drawer');
  ed.select(null);
  check(ed.cmd('inspector').children[0].children[0].textContent === 'NOTHING SELECTED' && notes.some(t => t === '§THE SCENERY'), '7 nothing selected: the inspector is the scenery\'s outline');
  ed.setSection('areas');
  check(ed.selected === null && ed.cmd('paletteEl').children.length === 1, '7 AREAS lit: its palette drawer');
}

// 8 THE MODEL PLACER (G2914): the bank (a stub registry - the page's PROP_REG), a drop, a turned and scaled drop, the
//   scatter (n records, one undo), the save and the load
{
  win.PROP_REG = { groups: [['yard', 'yard kit'], ['dock', 'dock kit']], texs: {}, order: ['crate_a', 'crate_a_lod1', 'bollard', 'drum'],
    props: { crate_a: { key: 'crate_a', group: 'yard', label: 'a crate', dim: [1, 0.8, 1], nt: 240 }, crate_a_lod1: { key: 'crate_a_lod1', group: 'yard', lodOf: 'crate_a', lodDist: 30 },
             bollard: { key: 'bollard', group: 'dock', label: 'a bollard', dim: [0.4, 0.7, 0.4], nt: 300 }, drum: { key: 'drum', group: 'yard', label: 'a drum', dim: [0.6, 0.9, 0.6], nt: 400 } } };
  ed.setSection('assets');
  check(JSON.stringify(ed.cmd('assets', {})) === '["crate_a","bollard","drum"]' && JSON.stringify(ed.cmd('assets', { group: 'dock' })) === '["bollard"]' && JSON.stringify(ed.cmd('assets', { q: 'dru' })) === '["drum"]', '8 the bank: every model but its levels, by group, by search');
  ed.cmd('pick', { key: 'bollard', yaw: 0.5, s: 1 }); ed.cmd('tool', { name: 'place' });
  const n0 = rec().layers.objects.length;
  ed.cmd('click', { x: 40, z: 60 });
  const b1 = rec().layers.objects[rec().layers.objects.length - 1];
  check(rec().layers.objects.length === n0 + 1 && b1.kind === 'prop' && b1.key === 'bollard' && Math.abs(b1.x - 40) < 0.01 && b1.yaw === 0.5 && b1.on === 'ground' && b1.s === undefined, '8 a click drops ONE prop record (turned, on the ground, scale 1 unwritten)', JSON.stringify(b1));
  const b2id = ed.cmd('place', { x: 44, z: 60, key: 'drum', yaw: 1, s: 1.5, level: true });
  const b2 = find(b2id).entry;
  check(b2.s === 1.5 && b2.on === 'flat' && b2.yaw === 1, '8 a scaled, level drop keeps its scale and its stance');
  const ids = ed.cmd('scatter', { x: 0, z: 120, key: 'crate_a', n: 6, r: 10, seed: 3 });
  check(ids.length === 6 && ids.every(i => { const e = find(i); return e && Math.hypot(e.entry.x, e.entry.z - 120) <= 10.01; }) && new Set(ids).size === 6, '8 scatter: six records within the radius, six ids');
  ed.undo();
  check(ids.every(i => !find(i)), '8 the scatter is one undo step');
  ed.redo();
  check(ids.every(i => !!find(i)), '8 ...and one redo');
  ed.select(b2id); ed.cmd('drag', { key: 'v0', x: 50, z: 66 });
  const moved = find(b2id).entry;
  const props0 = JSON.stringify(rec().layers.objects.filter(o => o.kind === 'prop'));
  ed.load(PG.envelope('placer', rec()));
  check(JSON.stringify(rec().layers.objects.filter(o => o.kind === 'prop')) === props0 && JSON.parse(props0).length === 8 && JSON.stringify(find(b2id).entry) === JSON.stringify(moved) && find(b2id).entry.s === 1.5 && Math.abs(moved.x - 50) < 0.01, '8 saved and loaded: the drops, their place, turn and scale', JSON.stringify(find(b2id) && find(b2id).entry));
  check(roundTrip(), '8 the record round-trips');
}

// 9 LONG ROADS (G2917; the user: "a road with 250 points ... constant browser stuck window", "this one goes all around the
//   island, and there's a chance there will be more long roads"): two island-length spline roads of 250 points each. The
//   segment grid answers roadDist exactly as the walk (5 000 points); coverAt, surfaceAt and the trees' exclusion answer
//   the same with the grid and the walk; one point dragged rebuilds its SPAN (a box a few hundred metres across, not the
//   island's), and the times: the composition, 20 000 cover samples, the drag's edit to quiet (the editor's command, the
//   stub renderer composing as the game's does).
//   9b ITS CLEARING (G2918): a road's `clear` keeps the trees (excludeAt) and the grass (coverAt's kill) out to its edge +
//   clear, not past it; the band's regions are pieces of ~200 m keyed by their own line - a drag changes a few of them.
{
  const loop = (cx, cz, R, k, ph) => { const out = []; for (let i = 0; i < 250; i++) { const a = i / 250 * Math.PI * 2; const r = R * (1 + 0.18 * Math.sin(a * k + ph) + 0.05 * Math.sin(a * 23 + ph)); out.push([+(cx + Math.cos(a) * r).toFixed(2), +(cz + Math.sin(a) * r).toFixed(2)]); } return out; };
  const big = PG.normalise({ seed: 4, layers: { roads: [{ id: 'r_isl', pts: loop(0, 0, 7000, 5, 0.3), w: 5, cls: 'paved', graded: true, falloff: 6, curve: 'spline', clear: 3 },
                                                        { id: 'r_isl2', pts: loop(1500, -800, 5200, 7, 1.1), w: 4, cls: 'gravel', graded: true, falloff: 6, curve: 'spline' }] } });
  const lineN = big.layers.roads.map(r => PG.roadLine(r).length);
  const Tm = f => { const t = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t) / 1e6, r]; };
  const [tC, OB] = Tm(() => PG.compose(big, synth, { raster: false }));
  const rnd9 = PG.mulberry32(17), bb = PG.polyBBox(big.layers.roads[0].pts), qs = [];
  for (let i = 0; i < 20000; i++) { const lx = bb.x0 + rnd9() * (bb.x1 - bb.x0), lz = bb.z0 + rnd9() * (bb.z1 - bb.z0); qs.push(OB.frame.toWorld(lx, lz)); }
  // near the roads too (a sample on the line, off it by up to 30 m) - where the answers are not all "nothing"
  for (const r of OB.roads) for (let i = 0; i < 2500; i++) { const p = r.pts[Math.floor(rnd9() * r.pts.length)], w = OB.frame.toWorld(p[0] + (rnd9() - 0.5) * 60, p[1] + (rnd9() - 0.5) * 60); qs.push(w); }
  const ask = O => qs.map(w => JSON.stringify([O.coverAt(w[0], w[1]), O.surfaceAt(w[0], w[1]), O.excludeAt(w[0], w[1], 'trees')]));
  const [tG, aG] = Tm(() => ask(OB));
  // the walk: roadDist as it was (and the box filing), the same record
  PG.segIdx(false); const OW = PG.compose(big, synth, { raster: false }); const [tW, aW] = Tm(() => ask(OW)); PG.segIdx(true);
  let exact = true, why = '';
  for (const r of OB.roads) for (let i = 0; i < 2500 && exact; i++) { const x = bb.x0 - 500 + rnd9() * (bb.x1 - bb.x0 + 1000), z = bb.z0 - 500 + rnd9() * (bb.z1 - bb.z0 + 1000);
    let d = Infinity; for (let s = 1; s < r.pts.length; s++) { const e = PG.distPtSeg(x, z, r.pts[s - 1], r.pts[s]); if (e < d) d = e; }
    const g = PG.roadDist(r, x, z); if (!Object.is(g, d)) { exact = false; why = x.toFixed(1) + ',' + z.toFixed(1) + ' ' + g + ' vs ' + d; } }
  check(exact, '9 the segment grid answers roadDist bit for bit as the walk (5 000 points over two island roads)', why);
  check(aG.every((v, i) => v === aW[i]), '9 coverAt, surfaceAt and the trees\' exclusion answer the same with the grid and the walk (' + qs.length + ' points)', (aG.findIndex((v, i) => v !== aW[i])));
  // the editor: the big record loaded, a point of the island road dragged 4 m
  ed.load(PG.envelope('long', big));
  ed.select('r_isl');
  const p40 = rec().layers.roads[0].pts[40];
  const [tD] = Tm(() => ed.cmd('drag', { key: 'v40', x: p40[0] + 4, z: p40[1] }));
  const last = R.lastDirty;
  const span = last && last.bbox ? (last.bbox.x1 - last.bbox.x0) * (last.bbox.z1 - last.bbox.z0) : Infinity, isl = (bb.x1 - bb.x0) * (bb.z1 - bb.z0);
  check(span < isl * 0.03, '9 a point dragged rebuilds its span, not the island (' + (Math.sqrt(span) | 0) + ' m across of a ' + ((bb.x1 - bb.x0) / 1000).toFixed(1) + ' km road box)');
  console.log('     9 two island roads (' + lineN.join(' + ') + ' drawn points): compose ' + tC.toFixed(0) + ' ms; ' + qs.length + ' cover / surface / tree samples ' + tG.toFixed(0) + ' ms (the walk ' + tW.toFixed(0) + ' ms); the drag\'s edit ' + tD.toFixed(0) + ' ms');
  check(tW > tG * 4, '9 the grid is the walk\'s cost several times over cheaper (' + (tW / Math.max(1, tG)).toFixed(1) + 'x)');
  check(tC < LONG_BUDGET.compose && tD < LONG_BUDGET.drag && tG < LONG_BUDGET.samples, '9 the times hold their budgets: compose < ' + LONG_BUDGET.compose + ' ms, the drag < ' + LONG_BUDGET.drag + ' ms, the samples < ' + LONG_BUDGET.samples + ' ms', tC.toFixed(0) + ' / ' + tD.toFixed(0) + ' / ' + tG.toFixed(0));
  // 9b the clearing: r_isl clears 3 m past its 2.5 m half width; r_isl2 has none
  const O9 = PG.compose(rec(), synth, { raster: false }), r1 = O9.roads.find(r => r.id === 'r_isl'), r2 = O9.roads.find(r => r.id === 'r_isl2');
  const at = (r, i, off) => { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return O9.frame.toWorld(a[0] - dz / l * off, a[1] + dx / l * off); };
  const idx = (r, k) => Math.floor(k * (r.pts.length - 2) / 100);   // 100 places along the drawn line
  const tr = (r, off) => { let n = 0; for (let k = 0; k < 100; k++) { const w = at(r, idx(r, k), off); if (O9.excludeAt(w[0], w[1], 'trees')) n++; } return n; };
  const gr = (r, off) => { let n = 0; for (let k = 0; k < 100; k++) { const w = at(r, idx(r, k), off), q = O9.coverAt(w[0], w[1]); if (q && q.kill >= 1) n++; } return n; };
  check(tr(r1, 5.0) === 100 && tr(r1, 6.2) < 10 && tr(r2, 3.5) < 5, '9b a road\'s clearing keeps the trees out to its edge + clear (5.0 m from the line: 100 of 100), not past it; a road without one keeps none', tr(r1, 5.0) + ' / ' + tr(r1, 6.2) + ' / ' + tr(r2, 3.5));
  check(gr(r1, 5.0) === 100, '9b ...and the grass: nothing grows within it', String(gr(r1, 5.0)));
  const regs = O => O.treeExRegions().filter(q => q.k[0] === 'x').map(q => q.k);
  const k0 = regs(O9);
  ed.cmd('drag', { key: 'v120', x: rec().layers.roads[0].pts[120][0] + 5, z: rec().layers.roads[0].pts[120][1] });
  const k1 = regs(PG.compose(rec(), synth, { raster: false })), dk = k0.filter(k => k1.indexOf(k) < 0).length + k1.filter(k => k0.indexOf(k) < 0).length;
  check(k0.length > 100 && dk > 0 && dk <= Math.max(12, k0.length / 5), '9b the clearing is filed in pieces: a point dragged changes ' + dk + ' of its ' + k0.length + ' regions (the trees regrow there alone)');
}

// 10 THE USER'S OWN SCENERY (Jolene rev 23, 11 Oct; tools/fixtures/scenery_user_jolene_rev23.json): its 24.9 km island road
//   r1 (244 points, traffic 11) half outside the extent the record carries - the composed extent covers all of it now
//   (the fine patch is drawn over it); its traffic changed is no ground edit; a point of r1 dragged rebuilds its span
{
  const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', 'scenery_user_jolene_rev23.json'), 'utf8');
  const Tm = f => { const t = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t) / 1e6, r]; };
  const [tL] = Tm(() => ed.load(txt));
  // THE TRACED ROADS ARE THE SOURCE OF TRUTH (the user: "at least the paths I trace manually should be kept safe"): their
  // points and handles come through the v2 migration, the load and a save + reload bit for bit
  const roadsRaw = JSON.stringify(PG.normalise(JSON.parse(txt).premises).layers.roads.map(r => [r.id, r.pts, r.tan || null]));
  const roadsOf = R0 => JSON.stringify(R0.layers.roads.map(r => [r.id, r.pts, r.tan || null]));
  check(roadsOf(rec()) === roadsRaw, '10 the traced roads of the user (points and handles) are bit for bit as in the file after the load (the v2 migration leaves roads alone)');
  check(roadsOf(PG.unwrap(PG.envelope('t', rec())).rec) === roadsRaw, '10 ...and after a save and a reload');
  // the rolling history: a snapshot is a slot holding the same record
  { const M = new Map(), S = { getItem: k => (M.has(k) ? M.get(k) : null), setItem: (k, v) => { M.set(k, String(v)); }, removeItem: k => { M.delete(k); }, key: i => Array.from(M.keys())[i] || null, get length() { return M.size; } };
    const ed2 = UI.mount(new El('div'), { THREE: null, world: synth, R: makeR(), rows, els: { chk: null, plaque: null, strip: new El('div') }, viewEl: new El('div'), storage: S, fresh: true, camera: () => null, redraw: noop });
    ed2.load(txt); const k = ed2.cmd('snapshot');
    check(k && /^flydiy\.premises\.slot\.autosave /.test(k) && roadsOf(PG.unwrap(S.getItem(k)).rec) === roadsRaw, '10 the rolling history keeps the record as a slot (' + String(k).slice(21) + '), its roads the same'); }
  const O10 = PG.compose(rec(), synth, { raster: false }), r1 = rec().layers.roads.find(r => r.id === 'r1'), E = O10.extent;
  check(r1 && r1.pts.every(q => q[0] >= E.x0 && q[0] <= E.x1 && q[1] >= E.z0 && q[1] <= E.z1), '10 the composed extent covers the island road (it ran 12.7 km past the authored one)', JSON.stringify(E));
  const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec, OJ = PG.compose(J, synth, { raster: false });
  check(JSON.stringify(OJ.extent) === JSON.stringify(J.frame.extent), '10 ...and the shipped Jolene record keeps its own extent exactly (every feature inside it)');
  ed.select('r1');
  const [tT] = Tm(() => ed.cmd('set', { id: 'r1', patch: { traffic: 12 } }));
  check(R.lastDirty && R.lastDirty.ground === false, '10 the traffic changed is no ground edit (no patch, no ground re-sample)', JSON.stringify(R.lastDirty));
  const q = rec().layers.roads.find(r => r.id === 'r1').pts[150];
  const [tD] = Tm(() => ed.cmd('drag', { key: 'v150', x: q[0] + 3, z: q[1] }));
  const b = R.lastDirty && R.lastDirty.bbox, sp = b ? Math.max(b.x1 - b.x0, b.z1 - b.z0) : Infinity;
  check(sp < 3000, '10 a point of r1 dragged rebuilds its span (' + (sp | 0) + ' m across), not the 25 km road');
  console.log('     10 the user scenery: load ' + tL.toFixed(0) + ' ms, traffic changed ' + tT.toFixed(0) + ' ms, a point dragged ' + tD.toFixed(0) + ' ms (headless: the record and its composition)');
}

// 5 NAMES
check(/rows\.section\(insp, 'THE SCENERY'\)/.test(UI_SRC) && !/rows\.section\(insp, 'THE PREMISES'\)/.test(UI_SRC), '5 the editor names its record the scenery');
const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
check(/t\.textContent = 'scenery editor'/.test(APP) && /'open the scenery editor'/.test(APP) && /flRow\(body, 'the world editor \(F9\)'\)/.test(APP), '5 the game names the scenery editor and the world editor (F9)');

if (fail.length) { for (const f of fail) console.log('  ! ' + f); console.log('GATE SCENERYED: FAIL (' + fail.length + ')'); process.exit(1); }
console.log('  ' + checks + ' checks');
console.log('GATE SCENERYED: PASS');
