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
    if (e.at && Array.isArray(e.items)) { const SF = PG.siteFrame(e); return [{ key: 'at', p: [e.at.x, 0, e.at.z] }].concat(e.items.map(it => { const q = SF.toLocal(it.x || 0, it.z || 0); return { key: 'i:' + it.id, p: [q[0], 0, q[1]] }; })); }   // (G3005) a site: its anchor, its items
    const arr = e.poly || e.pts; if (!arr) return out;
    arr.forEach((q, i) => { out.push({ key: 'v' + i, p: [q[0], 0, q[1]] }); if (e.poly || i + 1 < arr.length) out.push({ key: 'm' + i, p: [q[0], 0, q[1]], mid: true }); });
    if (e.pts && e.curve === 'spline') PG.roadHandles(e.pts, e.tan).forEach((h, i) => out.push({ key: 'h' + i, p: [e.pts[i][0] + h[0], 0, e.pts[i][1] + h[1]] }));
    return out;
  };
  const R = {
    stats: {}, get overlay() { return O; },
    setRecord(r) { rec = PG.normalise(r); },
    rebuild(d) { R.lastDirty = d === undefined ? null : d; R.rebuilds = (R.rebuilds || 0) + 1; O = PG.compose(rec, synth); return R.stats; },
    // (G3001) the renderer's object edit: counted, and refusable (R.fastOn = false - a renderer that cannot)
    objectEdit(list) { if (R.fastOn === false) return false; R.fastCalls = (R.fastCalls || 0) + 1; R.lastObjs = list; return true; },
    select(id) { if (id !== sel) corner = null; sel = id; },
    corner(i) { if (i !== undefined) corner = i; return corner; },
    ghost() {}, preview() {}, previewEnd() {}, pickHandle() { return null; },
    handles: handleKeys,
    hit(x, z) { const L = O.frame.toLocal(x, z); for (const k of ['areas', 'material', 'surface', 'zones', 'terrain']) for (const e of rec.layers[k]) if (e.poly && PG.inPoly(e.poly, L[0], L[1])) return { id: e.id, layer: k, entry: e }; return null; },
    // (G3006) everything under a point in the renderer's order: the models, the roads, the polygons last (the smallest first)
    hitAll(x, z) { const L = O.frame.toLocal(x, z), out = [];
      for (const ob of rec.layers.objects) if (isFinite(+ob.x) && Math.hypot(ob.x - L[0], ob.z - L[1]) < (PG.objectPickR ? PG.objectPickR(ob) : 2.5)) out.push([0, Math.hypot(ob.x - L[0], ob.z - L[1]), { id: ob.id, layer: 'objects', entry: ob, kind: 'object' }]);
      for (const r of rec.layers.roads) if (r.pts && r.pts.length > 1) { let d = Infinity; for (let i = 0; i + 1 < r.pts.length; i++) d = Math.min(d, PG.distPtSeg(L[0], L[1], r.pts[i], r.pts[i + 1]) - (+r.w || 3.6) / 2); if (d < 1.5) out.push([2, d, { id: r.id, layer: 'roads', entry: r, kind: 'road' }]); }
      for (const k of ['areas', 'material', 'surface', 'zones', 'terrain']) for (const e of rec.layers[k]) if (e.poly && PG.inPoly(e.poly, L[0], L[1])) out.push([4, Math.abs(PG.polyArea(e.poly)), { id: e.id, layer: k, entry: e, kind: 'polygon' }]);
      return out.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1])).map(q => q[2]); },
    ghostModel(sp) { R.ghostAt = sp; },
    grabAt(x, z) { const L = O.frame.toLocal(x, z); return PG.runwayGrab ? PG.runwayGrab(rec, L[0], L[1]) : null; },   // (G2891 c1: the renderer's own rule)
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
const rows = { slider: noop, select: noop, check: noop, note: (h, t) => notes.push(String(t)), section: (h, t) => notes.push('§' + t), button: (h, t) => notes.push('[' + t + ']'), pills: (h, t) => notes.push('(' + t + ')') };
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

// 7b THE LIFE SECTION IS REACHED (A0, 12 Oct: GATE LIFE's scan read the pre-palette signature): its tab opens the palette
//    drawer on the LIFE rows (headless: no scenery_life.js, so the drawer says so - under the LIFE heading)
{
  notes.length = 0; ed.setSection('life');
  check(notes.indexOf('§LIFE') >= 0, '7b the LIFE tab opens the LIFE section in the palette drawer', notes.slice(0, 4).join(' | '));
  ed.setSection('roads');
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
  // (G2956 / G3014: the shipped record carries the user's features that lie PAST the extent it authors - the island road r1
  //  (7.7 km past), and since rev 26 strip 11 w6 and its roads - the extent grows to cover them, and only for them: without
  //  every entry that has a point outside the authored extent it is the authored one exactly)
  const AE = J.frame.extent, outside = q => q[0] < AE.x0 || q[0] > AE.x1 || q[1] < AE.z0 || q[1] > AE.z1;
  const ptsOf = (L, e) => L === 'runways' ? PG.runwayBox(Object.assign({}, PG.RUNWAY_DEF, e), 0) : (e.pts || e.poly || (e.at ? [[+e.at.x, +e.at.z]] : (isFinite(+e.x) && isFinite(+e.z) ? [[+e.x, +e.z]] : [])));
  const far = []; for (const L of Object.keys(J.layers)) for (const e of J.layers[L] || []) if (e && e.id && ptsOf(L, e).some(outside)) far.push([L, e]);
  const J0 = JSON.parse(JSON.stringify(J)); for (const [L, e] of far) J0.layers[L] = J0.layers[L].filter(q => !q || q.id !== e.id);
  const EJ = OJ.extent, inEJ = q => q[0] >= EJ.x0 && q[0] <= EJ.x1 && q[1] >= EJ.z0 && q[1] <= EJ.z1;
  check(far.some(([L, e]) => e.id === 'r1') && JSON.stringify(PG.compose(J0, synth, { raster: false }).extent) === JSON.stringify(AE), '10 ...and the shipped Jolene record without the ' + far.length + ' features past its extent (' + far.map(([L, e]) => e.id).slice(0, 12).join(' ') + ') keeps its own extent exactly');
  // (the composer grows the extent over what it LAYS - roads, strips, zones, areas; a site or a placed object past it stands on the
  //  world's ground as it did in the user's editor, so it is listed, not held: rev 26's s26 / s28 at r1's far end, object a5)
  const LAID = ['roads', 'runways', 'zones', 'areas', 'terrain', 'surface', 'material', 'exclude', 'ttype'];
  check(EJ.x0 <= AE.x0 && EJ.z0 <= AE.z0 && EJ.x1 >= AE.x1 && EJ.z1 >= AE.z1 && far.filter(([L]) => LAID.includes(L)).every(([L, e]) => L === 'runways' ? inEJ(e.c) : ptsOf(L, e).every(inEJ)), '10 ...with them, its composed extent grows over what they lay (' + JSON.stringify(EJ) + ')');
  { const past = far.filter(([L, e]) => !LAID.includes(L) && !ptsOf(L, e).every(inEJ)).map(([L, e]) => L + ':' + e.id); if (past.length) console.log('     10 placed past the composed extent (they stand on the world ground, as in the editor): ' + past.join(' ')); }
  ed.select('r1');
  const [tT] = Tm(() => ed.cmd('set', { id: 'r1', patch: { traffic: 12 } }));
  check(R.lastDirty && R.lastDirty.ground === false, '10 the traffic changed is no ground edit (no patch, no ground re-sample)', JSON.stringify(R.lastDirty));
  const q = rec().layers.roads.find(r => r.id === 'r1').pts[150];
  const [tD] = Tm(() => ed.cmd('drag', { key: 'v150', x: q[0] + 3, z: q[1] }));
  const b = R.lastDirty && R.lastDirty.bbox, sp = b ? Math.max(b.x1 - b.x0, b.z1 - b.z0) : Infinity;
  check(sp < 3000, '10 a point of r1 dragged rebuilds its span (' + (sp | 0) + ' m across), not the 25 km road');
  console.log('     10 the user scenery: load ' + tL.toFixed(0) + ' ms, traffic changed ' + tT.toFixed(0) + ' ms, a point dragged ' + tD.toFixed(0) + ' ms (headless: the record and its composition)');
}

// 11 THE ROAD GRAPH and THE ROAD BED (G2950-G2953, contract v1.37; the user: roads join ONLY at waypoints, a junction is one
//   shared node, the traced points are never rewritten; "the road is sunk in many places ... ensuring the paved surface is
//   always visible"). On the user's own scenery: a new road's first point clicked by r1's waypoint lands ON it and the two
//   share a junction (r1's points untouched, one undo takes both back); the graph has the junction, r1 split there and a
//   path across; the junction dragged carries r1's waypoint with it (one undo); Alt+drag takes the road out (the lone id
//   goes); a road's end dragged onto a CONNECTION POINT joins it (its name kept, the graph's node named); a roadside apron
//   is made at a waypoint (an area, `roadside` its junction, the graph's node carries it); the bed on r1: its points the
//   same, its surface over the ground across its width where off it is under it; off again, r1 is the file's to the bit.
{
  const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', 'scenery_user_jolene_rev23.json'), 'utf8');
  ed.load(txt);
  const r1File = JSON.stringify(PG.normalise(JSON.parse(txt).premises).layers.roads.find(r => r.id === 'r1'));
  const r1 = () => rec().layers.roads.find(r => r.id === 'r1'), P0 = JSON.stringify(r1().pts), T0 = JSON.stringify(r1().tan || null);
  const r1Same = () => JSON.stringify(r1().pts) === P0 && JSON.stringify(r1().tan || null) === T0;
  const K = 40, base = r1().pts[K].slice(0, 2), nb = r1().pts[K + 1], dl = Math.hypot(nb[0] - base[0], nb[1] - base[1]), n = [-(nb[1] - base[1]) / dl, (nb[0] - base[0]) / dl];
  const at = d => [+(base[0] + n[0] * d).toFixed(2), +(base[1] + n[1] * d).toFixed(2)];
  // 11a a new road's point by r1's waypoint: ON it, one junction, r1 untouched
  ed.setSection('roads'); ed.cmd('tool', { name: 'road' });
  ed.cmd('point', { x: base[0] + 0.8, z: base[1] - 0.6 }); ed.cmd('point', { x: at(60)[0], z: at(60)[1] }); ed.cmd('point', { x: at(120)[0], z: at(120)[1] });
  const rN = ed.cmd('commit'), road = () => find(rN).entry, jid = road().nodes && road().nodes[0];
  check(road().pts[0][0] === base[0] && road().pts[0][1] === base[1], '11a the new road\'s first point clicked by r1\'s waypoint lands exactly on it', JSON.stringify(road().pts[0]) + ' vs ' + JSON.stringify(base));
  check(!!jid && r1().nodes && r1().nodes[K] === jid && r1().nodes.filter(Boolean).length === 1, '11a the two share one junction id (r1\'s waypoint ' + (K + 1) + ')', String(jid));
  check(r1Same(), '11a r1\'s points and handles are bit for bit the file\'s');
  check(road().bed === true, '11a a new road stands on its bed');
  check(roundTrip(), '11a the record with its junction round-trips');
  ed.undo();
  check(!find(rN) && JSON.stringify(r1()) === r1File, '11a one undo takes the road AND r1\'s junction id back (r1 is the file\'s entry)');
  ed.redo();
  check(!!find(rN) && r1().nodes && r1().nodes[K] === jid, '11a ...and redo puts both back');
  // 11b the graph: the junction, r1 split there, a path across
  { const G = PG.compose(rec(), synth, { raster: false }).roadGraph(), J = G.node(jid);
    check(J && J.roads.indexOf('r1') >= 0 && J.roads.indexOf(rN) >= 0, '11b the graph has the junction, r1 and ' + rN + ' through it', J && JSON.stringify(J.roads));
    check(G.edges.filter(e => e.road === 'r1').length === 2, '11b r1 is two spans in the graph (split at the junction)', String(G.edges.filter(e => e.road === 'r1').length));
    const p = G.path(rN + ':1', 'r1:0');
    check(p && p.nodes.indexOf(jid) > 0 && p.len > 0, '11b a path from ' + rN + '\'s end to r1\'s start runs through it', p && (p.nodes.join('>') + ' ' + p.len.toFixed(0) + ' m')); }
  // 11c the junction dragged: r1's waypoint goes with it - one undo
  ed.cmd('tool', { name: 'select' }); ed.select(rN);
  const u0 = JSON.stringify(rec().layers.roads);
  ed.cmd('drag', { key: 'v0', x: at(5)[0], z: at(5)[1] });
  const p1 = JSON.parse(P0);
  check(road().pts[0][0] === at(5)[0] && r1().pts[K][0] === at(5)[0] && r1().pts[K][1] === at(5)[1], '11c the junction dragged carries r1\'s waypoint', JSON.stringify(r1().pts[K]));
  check(r1().pts.every((q, i) => i === K || JSON.stringify(q) === JSON.stringify(p1[i])), '11c ...and no other point of r1');
  ed.undo();
  check(JSON.stringify(rec().layers.roads) === u0 && r1Same(), '11c one undo takes the junction back (both roads)');
  // 11d Alt+drag: the road out of the junction; the lone id goes from r1
  ed.cmd('drag', { key: 'v0', x: at(8)[0], z: at(8)[1], alt: true });
  check(road().pts[0][0] === at(8)[0] && r1Same() && !road().nodes && JSON.stringify(r1()) === r1File, '11d Alt+drag takes ' + rN + ' out: r1 stays, and is the file\'s entry again (its lone junction id gone)');
  ed.undo();
  check(r1().nodes && r1().nodes[K] === jid && road().nodes && road().nodes[0] === jid && r1Same(), '11d undo joins them again');
  // 11e a connection point: a waypoint named, a road's end dragged onto it joins it, the graph's node named
  ed.cmd('tool', { name: 'road' }); ed.cmd('point', { x: at(200)[0], z: at(200)[1] }); ed.cmd('point', { x: at(260)[0], z: at(260)[1] });
  const rQ = ed.cmd('commit'); ed.cmd('tool', { name: 'select' });
  const jc = ed.cmd('connection', { id: rQ, i: 1 }); ed.cmd('junction', { jid: jc, patch: { name: 'the test gate' } });
  ed.cmd('tool', { name: 'road' }); ed.cmd('point', { x: at(300)[0], z: at(300)[1] }); ed.cmd('point', { x: at(330)[0], z: at(330)[1] });
  const rM = ed.cmd('commit'); ed.cmd('tool', { name: 'select' }); ed.select(rM);
  const qEnd = find(rQ).entry.pts[1], qBefore = JSON.stringify(find(rQ).entry.pts);
  ed.cmd('drag', { key: 'v1', x: qEnd[0] + 1, z: qEnd[1] - 0.7 });
  check(find(rM).entry.pts[1][0] === qEnd[0] && find(rM).entry.pts[1][1] === qEnd[1] && JSON.stringify(find(rQ).entry.pts) === qBefore, '11e a road\'s end dragged by a waypoint snaps onto it (the other road\'s points untouched)');
  check(find(rM).entry.nodes && find(rM).entry.nodes[1] === jc, '11e ...and joins the connection point ' + jc, JSON.stringify(find(rM).entry.nodes));
  { const G = PG.compose(rec(), synth, { raster: false }).roadGraph(), J = G.node(jc);
    check(J && J.name === 'the test gate' && J.conn && J.roads.length === 2, '11e the graph\'s node is the named connection point, two roads through it', J && JSON.stringify({ name: J.name, conn: J.conn, roads: J.roads })); }
  // 11f a roadside apron at rN's end: an area whose `roadside` is the waypoint's (new) junction; the graph's node carries it
  const aid = ed.cmd('apron', { id: rN, i: 2 }), A = aid && find(aid), jA = road().nodes && road().nodes[2];
  check(A && A.layer === 'areas' && A.entry.props.roadside && A.entry.props.roadside.node === jA && jA, '11f a roadside apron at a waypoint: an area, its roadside the waypoint\'s junction', aid + ' ' + jA);
  check(!PG.issues(rec()).some(s => /roadside|junction/.test(s)), '11f no issue', PG.issues(rec()).filter(s => /roadside|junction/.test(s)).join('; '));
  { const G = PG.compose(rec(), synth, { raster: false }).roadGraph(), N = G.node(jA);
    check(N && N.aprons.length === 1 && N.aprons[0].area === aid && N.aprons[0].r > 5 && N.aprons[0].use.indexOf('turn') >= 0, '11f the graph\'s node has the apron (room to turn ' + (N && N.aprons[0] ? N.aprons[0].r : '?') + ' m)'); }
  ed.undo();
  check(!find(aid) && !(road().nodes && road().nodes[2]), '11f one undo takes the apron and its junction id back');
  // 11g THE BED on r1: one click; its points the same; its surface over the ground across its width where off it is under it
  notes.length = 0; ed.select('r1');
  check(notes.indexOf('(road bed)') >= 0, '11g the road inspector shows the bed toggle');
  const hw = (+r1().w || 3.6) / 2, line = PG.roadLine(r1());
  const recNo = JSON.parse(JSON.stringify(rec())); recNo.layers.roads = recNo.layers.roads.filter(r => r.id !== 'r1');
  const Og = PG.compose(recNo, synth, { raster: false });
  const under = O => { let k = 0, m = 0; for (let i = 1; i + 1 < line.length; i += 4) { const a = line[i - 1], b = line[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; for (const s of [-hw, 0, hw]) { const lx = line[i][0] - dz / l * s, lz = line[i][1] + dx / l * s, w = O.frame.toWorld(lx, lz); m++; if (O.terrainAt(w[0], w[1]) < Og.terrainAt(w[0], w[1]) - 0.02) k++; } } return [k, m]; };
  const [kOff, m] = under(PG.compose(rec(), synth, { raster: false }));
  ed.cmd('set', { id: 'r1', patch: { bed: true } });
  check(r1Same(), '11g the bed on: r1\'s points and handles bit for bit');
  const [kOn] = under(PG.compose(rec(), synth, { raster: false }));
  check(kOn <= Math.ceil(m * 0.005), '11g the bed on: r1\'s surface over the ground across its width (' + kOn + ' of ' + m + ' samples under it; ' + kOff + ' without the bed)');
  ed.undo();
  check(r1Same() && !('bed' in r1()), '11g one undo: the bed off, r1 its own again');
  ed.select(rN); ed.undo(); ed.undo(); ed.undo(); ed.undo();
  check(r1Same(), '11 through every step of the graph and the bed, r1\'s traced points are the file\'s bit for bit');
}

// 12 THE USER'S OWN SAVED RECORD THROUGH THE v1.37 LOADER (A0, 12 Oct; tools/fixtures/scenery_user_jolene_rev23.json is the
//   user's backup D:/Dev/flydiy-notes/scenery-backups/Jolene_AFB_rev23_2026-10-11.json byte for byte, sha256 277abdfa...):
//   r1's points and handles bit for bit after the editor's load, after the composition and its road graph, after a save
//   round trip; and with Metlakatla's streets put back (the town switch on: restorePlaces, as the game does) its 129
//   junctions' level leaves r1's ground profile as it was without them, sample for sample
{
  const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', 'scenery_user_jolene_rev23.json'), 'utf8');
  check(require('crypto').createHash('sha256').update(txt).digest('hex').slice(0, 16) === '277abdfa66b254bd', '12 the fixture is the user\'s backup of rev 23 byte for byte');
  const raw = JSON.parse(txt), r1raw = (raw.premises || raw).layers.roads.find(r => r.id === 'r1'), P0 = JSON.stringify([r1raw.pts, r1raw.tan || null]);
  const r1of = R0 => { const r = R0.layers.roads.find(q => q.id === 'r1'); return JSON.stringify([r.pts, r.tan || null]); };
  ed.load(txt);
  check(r1of(rec()) === P0, '12 r1\'s ' + r1raw.pts.length + ' points and handles bit for bit after the load');
  const O12 = PG.compose(rec(), synth, { raster: false }), G12 = O12.roadGraph();
  check(r1of(rec()) === P0 && r1of(O12.rec) === P0 && G12.edges.some(e => e.road === 'r1'), '12 ...after the composition and its road graph (r1 ' + G12.edges.filter(e => e.road === 'r1').length + ' span(s) in it)');
  check(r1of(PG.unwrap(PG.envelope('t', rec())).rec) === P0, '12 ...and after a save round trip');
  const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec, cut = PG.dropPlaces(J, ['mk_']).cut;
  const withTown = PG.restorePlaces(PG.unwrap(txt).rec, cut);
  const noIds = JSON.parse(JSON.stringify(withTown)); for (const r of noIds.layers.roads) if (/^mk_/.test(r.id)) delete r.nodes; noIds.layers.junctions = (noIds.layers.junctions || []).filter(j => !/^mk_/.test(j.id));
  check(withTown.layers.roads.filter(r => /^mk_/.test(r.id) && r.nodes).length > 50 && r1of(withTown) === P0, '12 the town put back: its junctioned streets beside r1 untouched');
  const Ot = PG.compose(withTown, synth, { raster: false }), On = PG.compose(noIds, synth, { raster: false }), line = PG.roadLine(r1raw);
  let worst = 0, n = 0; for (let i = 0; i < line.length; i += 2) { const w = Ot.frame.toWorld(line[i][0], line[i][1]); worst = Math.max(worst, Math.abs(Ot.terrainAt(w[0], w[1]) - On.terrainAt(w[0], w[1]))); n++; }
  check(worst === 0, '12 Metlakatla\'s junction level leaves r1\'s ground profile as it was (' + n + ' samples along its 24.9 km, worst ' + worst.toFixed(4) + ' m)');
  console.log('     12 the user\'s rev 23 (sha256 277abdfa66b254bd): r1 ' + r1raw.pts.length + ' points + handles bit for bit through load, compose + road graph (' + G12.edges.filter(e => e.road === 'r1').length + ' span), save; town put back (' + withTown.layers.roads.filter(r => /^mk_/.test(r.id)).length + ' streets, ' + new Set([].concat(...withTown.layers.roads.map(r => r.nodes || [])).filter(Boolean)).size + ' junction ids): r1\'s ground over ' + n + ' samples differs by ' + worst + ' m from the town without junctions');
}

// 13 THE USER'S ROAD SHIPPED (G2956; the user, 11 Oct: "Please extract my long road to put in official"): r1 of their rev 26
//    save (tools/road_ship.py; the entry kept in tools/fixtures/scenery_user_r1_rev26.json with the save's sha256) is the
//    shipped fixture's r1 bit for bit - every field as saved, nothing else of the save shipped (no strip of theirs) -
//    and the shipped record loads, composes and saves it unchanged
{
  const K = JSON.parse(fs.readFileSync(path.join(TOOLS, 'fixtures', 'scenery_user_r1_rev26.json'), 'utf8'));
  const FX = JSON.parse(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')), FL = (FX.premises || FX).layers;
  const shipped = FL.roads.find(r => r.id === 'r1');
  check(shipped && JSON.stringify(shipped) === JSON.stringify(K.road), '13 the shipped r1 is the user\'s save\'s r1 bit for bit (' + (K.road.pts || []).length + ' points, save sha256 ' + String(K.sha256).slice(0, 16) + ')');
  check(!FL.runways.some(w => /^strip [89]$/.test(String(w.name || ''))) && FL.roads.filter(r => r.id === 'r1').length === 1, '13 ...and nothing else of the save: none of its strips');
  const PJ = PG.unwrap(JSON.stringify(FX)).rec, r1j = PJ.layers.roads.find(r => r.id === 'r1');
  const same = r => JSON.stringify([r.pts, r.tan || null]) === JSON.stringify([K.road.pts, K.road.tan || null]);
  check(r1j && same(r1j) && same(PG.unwrap(PG.envelope('t', PJ)).rec.layers.roads.find(r => r.id === 'r1')) && same(PG.compose(PJ, synth, { raster: false }).rec.layers.roads.find(r => r.id === 'r1')), '13 the shipped record loads, composes and saves r1 unchanged');
  const savePath = 'D:/Dev/flydiy-notes/scenery-backups/' + K.save;
  if (fs.existsSync(savePath)) check(require('crypto').createHash('sha256').update(fs.readFileSync(savePath)).digest('hex') === K.sha256, '13 (the save on this machine is the one it was taken from)');
}

// 14 PLACER-FAST (G3000-G3009; the user: "adding assets in the editor is a bit of a pain, really, really long to move,
//    update, rotate"). A placed object's commit - its drop, its drag's release, its turn, a number, its undo - hands the
//    renderer that object alone (R.objectEdit: no composition, no rebuild); anything else, or a renderer that cannot,
//    rebuilds as before. The roads' build keys (PG.roadBuildKeys): a road is drawn again only when ITS key changes or a
//    ground edit's box touches it - one row a way a road must be drawn again (its own change, what it keeps clear of near
//    it, a ground edit, a road taken away / added). The scale of a placed prop reaches its composed record.
{
  const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', 'scenery_user_jolene_rev23.json'), 'utf8');
  ed.load(txt); ed.cmd('tool', { name: 'select' });
  const r0 = () => [R.rebuilds || 0, R.fastCalls || 0];
  // 14a the drop, the release, a turn, a number, the undo: the object alone, no rebuild
  let [b0, f0] = r0();
  const pid = ed.cmd('place', { x: 120, z: -40, key: 'stub|box', yaw: 0.3, s: 1.5 });
  check(pid && R.rebuilds === b0 && R.fastCalls === f0 + 1 && R.lastObjs.length === 1 && R.lastObjs[0].before === null && R.lastObjs[0].after.id === pid, '14a a model dropped: the renderer makes it alone, no rebuild', JSON.stringify(r0()));
  ed.select(pid);
  [b0, f0] = r0();
  ed.cmd('drag', { key: 'v0', x: 131.5, z: -38 });
  check(R.rebuilds === b0 && R.fastCalls === f0 + 1 && R.lastObjs[0].before.x === 120 && R.lastObjs[0].after.x === 131.5, '14a its drag released: that object alone, its before and after', JSON.stringify(R.lastObjs && R.lastObjs[0] && [R.lastObjs[0].before.x, R.lastObjs[0].after.x]));
  [b0, f0] = r0();
  ed.cmd('set', { id: pid, patch: { yaw: 1.2, s: 2 } });
  check(R.rebuilds === b0 && R.fastCalls === f0 + 1 && R.lastObjs[0].after.yaw === 1.2 && R.lastObjs[0].after.s === 2, '14a a turn and a scale set: the object alone');
  [b0, f0] = r0();
  ed.undo();
  check(R.rebuilds === b0 && R.fastCalls === f0 + 1 && R.lastObjs[0].after.yaw === 0.3 && R.lastObjs[0].before.yaw === 1.2, '14a undone: the object alone, back as it was');
  // 14b what is NOT an object's alone: a renderer that cannot, a command with an area in it, an aeroplane (the strips clear it)
  R.fastOn = false; [b0, f0] = r0();
  ed.cmd('set', { id: pid, patch: { yaw: 0.9 } });
  check(R.rebuilds === b0 + 1 && R.fastCalls === f0, '14b a renderer that cannot: the rebuild as before');
  R.fastOn = true;
  [b0, f0] = r0();
  const aid = ed.cmd('place', { x: 300, z: 300, key: 'stub|box' }); ed.cmd('set', { id: aid, patch: { kind: 'aircraft', key: 'arch:cub' } });
  check(R.rebuilds === b0 + 1 && R.fastCalls === f0 + 1, '14b an aeroplane is not an object alone (the strips\' way out clears it): rebuilt', JSON.stringify(r0()) + ' from ' + JSON.stringify([b0, f0]));
  [b0, f0] = r0();
  ed.cmd('set', { id: 'r1', patch: { traffic: 3 } });
  check(R.rebuilds === b0 + 1 && R.fastCalls === f0, '14b a road\'s edit rebuilds as before (its traffic)');
  // 14c the scale reaches the composed record (it was dropped there: the built prop stood at x1 after the first rebuild)
  { const O14 = PG.compose(rec(), synth, { raster: false }), ob = (O14.records.objects || []).find(q => q.id === pid);
    check(ob && ob.s === 1.5 && !(O14.records.objects || []).some(q => q.id !== pid && 's' in q), '14c a placed prop\'s scale is on its composed record (and only a scaled one carries it)', JSON.stringify(ob)); }
  // 14d THE ROADS' BUILD KEYS: one row a way a road is drawn again
  const Ok = () => PG.compose(rec(), synth, { raster: false });
  const K0 = PG.roadBuildKeys(Ok()), ids = Array.from(K0.keys());
  const diff = (A, B) => ids.filter(id => A.get(id) !== B.get(id));
  check(K0.size >= 15 && JSON.stringify(Array.from(PG.roadBuildKeys(Ok()))) === JSON.stringify(Array.from(K0)), '14d every road has a key, the same for the same record (' + K0.size + ' roads)');
  ed.cmd('set', { id: 'r1', patch: { traffic: 4 } });
  { const K1 = PG.roadBuildKeys(Ok()), d1 = diff(K0, K1);
    check(d1.length === 1 && d1[0] === 'r1', '14d its own change (r1\'s traffic): r1 alone drawn again', d1.join()); }
  const K1 = PG.roadBuildKeys(Ok());
  { const near = rec().layers.roads.find(r => r.id === 'r_airport'), q = near.pts[1];
    ed.cmd('tool', { name: 'concrete' }); for (const d of [[-6, -6], [6, -6], [6, 6], [-6, 6]]) ed.cmd('point', { x: q[0] + d[0], z: q[1] + d[1] }); const cid = ed.cmd('commit'); ed.cmd('tool', { name: 'select' });
    const K2 = PG.roadBuildKeys(Ok()), d2 = diff(K1, K2);
    check(cid && d2.indexOf('r_airport') >= 0 && d2.length < ids.length / 2, '14d a pavement laid by it (what its poles and rails keep clear of): r_airport and its neighbours drawn again, not the island (' + d2.length + ' of ' + ids.length + ')', d2.join());
    ed.cmd('setProp', { id: cid, prop: 'marks', patch: { kind: 'hatch' } });
    const K3 = PG.roadBuildKeys(Ok()), d3 = diff(K2, K3);
    check(d3.length === 0, '14d its marks changed (paint, not its shape): no road drawn again - the pavement polygon is drawn again on its own', d3.join()); }
  { // (G2960) a strip moved: the roads near it drawn again, not the island's (a strip was in every road's key)
    const Ka = PG.roadBuildKeys(Ok()), w = rec().layers.runways.find(r => r.id === 'w3');
    ed.cmd('set', { id: 'w3', patch: { c: [w.c[0] + 10, w.c[1]] } });
    const Kb = PG.roadBuildKeys(Ok()), dw = Array.from(Ka.keys()).filter(id => Ka.get(id) !== Kb.get(id));
    check(dw.length < Ka.size / 3, '14d a strip moved (w3): ' + dw.length + ' of ' + Ka.size + ' roads drawn again - those near it, not the island', dw.join());
    ed.undo(); }
  { const rd = Ok().roads.find(r => r.id === 'r_airport'), far = Ok().roads.find(r => r.id === 'mn_main'), q = rd.pts[Math.floor(rd.pts.length / 2)];
    const box = { x0: q[0] - 5, z0: q[1] - 5, x1: q[0] + 5, z1: q[1] + 5 };
    check(PG.roadBoxTouch(rd, box, 30) && !PG.roadBoxTouch(far, box, 30), '14d a ground edit\'s box: the road under it drawn again, a road far from it not'); }
  { const before = PG.roadBuildKeys(Ok());
    const rid = ed.cmd('delete', { id: 'v_west' }) && 'v_west', K4 = PG.roadBuildKeys(Ok());
    check(!K4.has('v_west') && K4.size === before.size - 1, '14d a road taken away: its key gone (its part, line and rail given back)');
    ed.undo();
    const K5 = PG.roadBuildKeys(Ok());
    check(K5.has('v_west') && K5.get('v_west') === before.get('v_west'), '14d ...and put back: its key the same as before (drawn again, as it was)'); }
  // 14d' (G3008) THE GAME'S SIDE of an edit (render_world / app.js; the page only - source scans): a placed object's edit
  //      touches no strip; any other edit re-samples its own box and stands the strips again only when one changed or the
  //      box reaches one (every edit stood every strip of the island: their fine ground, pavement, lights, socks, rocks)
  { const AP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
    check(/if \(layer === 'objects'\) return;/.test(AP) && /repaintStrips\(null\)/.test(AP) && /refreshGround\(wb\); if \(window\.WORLD\.repaintStrips\) window\.WORLD\.repaintStrips\(wb\)/.test(AP), '14d\' the game: an object\'s edit no strip, another edit its box and its strips');
    check(/repaintStrips = \(box\) => \{/.test(RW) && /repaintStrips: \(box\) => repaintStrips\(box\)/.test(RW) && /if \(!need\) return false;/.test(RW), '14d\' render_world stands the strips again only when one changed or the box reaches one'); }
  // 14e THE TIMES, headless: an object's release through the editor (the renderer's part is the page's) against what the
  //     whole rebuild composed each time; the keys' own cost on the user's scenery with the town put back (the cache's price)
  { const Tm = f => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };
    ed.select(pid);
    const tFast = Tm(() => ed.cmd('drag', { key: 'v0', x: 140, z: -35 }));
    R.fastOn = false; const tFull = Tm(() => ed.cmd('drag', { key: 'v0', x: 145, z: -35 })); R.fastOn = true;
    const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec, OT = PG.compose(J, synth, { raster: false });
    const tKeys = Tm(() => PG.roadBuildKeys(OT));
    check(tFast < 50 && tKeys < 500, '14e an object released: ' + tFast.toFixed(1) + ' ms through the editor (' + tFull.toFixed(0) + ' ms with the whole rebuild\'s composition); the roads\' keys on the island (' + OT.roads.length + ' roads, the town and r1) ' + tKeys.toFixed(0) + ' ms');
    console.log('     14 PLACER-FAST: an object released ' + tFast.toFixed(1) + ' ms (editor) vs ' + tFull.toFixed(0) + ' ms (editor + the composition a rebuild runs); road keys ' + tKeys.toFixed(0) + ' ms for ' + OT.roads.length + ' roads'); }
}

// 15 THE USER'S SCENERY SHIPPED (G3010 SCENERY-SHIP; the user, 11 Oct 22:45: "I have done a lot of new roads and scenery
//    that should become default. Not the altiport ... until fixed though"): tools/fixtures/scenery_ship_rev26.json names
//    the save (kept byte for byte beside it), what is held back (the altiport's strips), the removals the user confirmed
//    and the record settings. The shipped fixture, migrated, the town cut as a save has it, IS the save entry by entry
//    (normalised) - but for a `stage`, which a save (the sandbox's view, every track at its max) never carries and the
//    shipped record keeps, and the entries only a stage stands (`sg_`) or a removal not yet confirmed keeps.
{
  const M = JSON.parse(fs.readFileSync(path.join(TOOLS, 'fixtures', 'scenery_ship_rev27.json'), 'utf8'));
  const stxt = fs.readFileSync(path.join(TOOLS, 'fixtures', M.save), 'utf8');
  check(require('crypto').createHash('sha256').update(stxt).digest('hex') === M.sha256, '15 the save beside the manifest is the user\'s, byte for byte (' + M.sha256.slice(0, 16) + ')');
  const A = PG.dropPlaces(PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec, ['mk_']).rec, B = PG.unwrap(stxt).rec;
  const EX = new Set(M.except), RM = new Set(M.remove);
  // (G3014) a road the user stopped at a strip: the save's road cut by the same function the ship used
  for (const [rid, wid] of Object.entries(M.trim || {})) { const r = B.layers.roads.find(q => q.id === rid), w = B.layers.runways.find(q => q.id === wid);
    const cut = r && w && PG.roadCutAtPoly(r, PG.runwayBox(Object.assign({}, PG.RUNWAY_DEF, w), 0));
    check(!!cut && cut.pts.length < r.pts.length, '15 ' + rid + ' stops at the edge of ' + wid + ' (' + (r ? r.pts.length : '?') + ' -> ' + (cut ? cut.pts.length : '?') + ' points)');
    if (cut) B.layers.roads[B.layers.roads.indexOf(r)] = cut; }
  const un = e => { const c = JSON.parse(JSON.stringify(e)); delete c.stage; delete c.src; if (Array.isArray(c.items)) for (const it of c.items) if (it) delete it.stage; return JSON.stringify(c); };
  const staged = e => !!(e && (e.stage || (Array.isArray(e.items) && e.items.some(it => it && it.stage)) || /^sg_/.test(String(e.id || ''))));
  // (G3014: the strips the manifest names in clearDefault ship WITHOUT their own `clear` - today's box, as every strip; the rest of
  //  the entry is the save's)
  // (G3014: and the plots the manifest moves - plotMoves {runway: {plot: [x, z]}}: the save's plot taken to where it ships)
  const PMv = M.plotMoves || {};
  const CD = new Set(M.clearDefault || []), unC = e => { const c = JSON.parse(un(e)); if (CD.has(c.id)) delete c.clear;
    if (PMv[c.id] && Array.isArray(c.plots)) for (const p of c.plots) if (p && PMv[c.id][p.id]) { p.x = PMv[c.id][p.id][0]; p.z = PMv[c.id][p.id][1]; }
    return JSON.stringify(c); };
  check([...CD].every(id => { const w = (A.layers.runways || []).find(q => q.id === id); return w && !('clear' in w); }), '15 the strips the manifest names ship with the clearance of today, not their own (' + [...CD].join(', ') + ')');
  const bad = [], pending = [];
  for (const L of PG.LAYERS) {
    const a = new Map((A.layers[L] || []).map(e => [e.id, e])), b = new Map((B.layers[L] || []).map(e => [e.id, e]));
    for (const [id, e] of b) { if (EX.has(id)) { if (a.has(id)) bad.push(L + ' ' + id + ' held back, but shipped'); continue; } if (!a.has(id)) bad.push(L + ' ' + id + ' not shipped'); else if (unC(a.get(id)) !== unC(e)) bad.push(L + ' ' + id + ' differs'); }
    for (const [id, e] of a) if (!b.has(id)) { if (RM.has(id)) bad.push(L + ' ' + id + ' removal confirmed, still shipped'); else if (!staged(e)) pending.push(id); }
  }
  check(!bad.length, '15 the shipped record is the save entry by entry (held back: ' + M.except.join(', ') + ')', bad.slice(0, 6).join('; '));
  const FX = JSON.parse(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')), FL = (FX.premises || FX).layers;
  let nSt = 0, nIt = 0; for (const L of Object.keys(FL)) for (const e of FL[L] || []) { if (e && e.stage) nSt++; if (e && Array.isArray(e.items)) for (const it of e.items) if (it && it.stage) nIt++; }
  check(nSt >= 17 && nIt >= 5, '15 every stage the shipped record had is still on it (' + nSt + ' entries, ' + nIt + ' site items) - a save never carries them');
  console.log('     15 the user\'s rev 25 shipped: ' + B.layers.roads.length + ' roads in the save; the removals the save makes and the user has not confirmed (kept): ' + (pending.join(', ') || 'none'));
}

// 16 THE LONE ROAD'S PATCH (G3013; the user's 66 km of graded road made the fine 2 m patch 7x what it was for every
//    player): on the shipped record as a player has it (the town off), the roads' chunks with the lone rule against the
//    margin everywhere - far fewer - and every chunk where a road MEETS something (a segment not lone) the same as
//    before: the patch shrinks only along the lone stretches. The ground is the composition's either way (the patch is
//    how finely it is drawn, not what it is)
{
  const J = PG.dropPlaces(PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec, ['mk_']).rec;
  const flat = { id: 'flat', terrainH: () => 0, waterH: () => -100 }, O16 = PG.compose(J, flat, { raster: false }), F = O16.frame, R = O16.rec, PCH = 64;
  const e = O16.extent, c = [F.toWorld(e.x0, e.z0), F.toWorld(e.x1, e.z0), F.toWorld(e.x1, e.z1), F.toWorld(e.x0, e.z1)];
  const bounds = { i0: Math.floor((Math.min(...c.map(q => q[0])) - 40) / PCH), i1: Math.floor((Math.max(...c.map(q => q[0])) + 40) / PCH), j0: Math.floor((Math.min(...c.map(q => q[1])) - 40) / PCH), j1: Math.floor((Math.max(...c.map(q => q[1])) + 40) / PCH) };
  const t0 = process.hrtime.bigint();
  const NEW = PG.roadPatchChunks(R, F, PCH, bounds, { runways: O16.runways }), ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const OLD = PG.roadPatchChunks(R, F, PCH, bounds, { runways: O16.runways, lone: false });
  const lone = PG.roadLoneSegs(R, O16.runways);
  let segs = 0, nLone = 0; for (const [, s] of lone) { segs += s.length; for (const v of s) nLone += v; }
  check(NEW.size < OLD.size * 0.7, '16 the lone stretches\' patch: ' + NEW.size + ' chunks of 64 m where the margin everywhere made ' + OLD.size + ' (' + nLone + ' of ' + segs + ' road segments lone; ' + ms.toFixed(0) + ' ms)');
  // every chunk the old rule marked and the lone rule does not is a lone stretch's alone: no segment that meets anything
  // marks it by the old rule (its box grown by its margin, its centre within margin + half a diagonal - activeChunks')
  const HALFD = PCH * 0.7072; let miss = 0, near = 0;
  const gone = Array.from(OLD).filter(k => !NEW.has(k)); near = gone.length;
  for (const k of gone) {
    const [ci, cj] = k.split(',').map(Number), cx = (ci + 0.5) * PCH, cz = (cj + 0.5) * PCH, lc = F.toLocal(cx, cz);
    let held = false;
    for (const r of R.layers.roads) { const ls = lone.get(r.id); if (!ls || held) continue; const m = (+r.w || 3.6) / 2 + (+r.falloff || 6) + 6;
      for (let q = 1; q < r.pts.length && !held; q++) { if (ls[q - 1]) continue; const a = r.pts[q - 1], b = r.pts[q];
        const cs = [[Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m], [Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m], [Math.min(a[0], b[0]) - m, Math.max(a[1], b[1]) + m], [Math.max(a[0], b[0]) + m, Math.min(a[1], b[1]) - m]].map(z => F.toWorld(z[0], z[1]));
        const inBox = ci >= Math.floor(Math.min(...cs.map(z => z[0])) / PCH) && ci <= Math.floor(Math.max(...cs.map(z => z[0])) / PCH) && cj >= Math.floor(Math.min(...cs.map(z => z[1])) / PCH) && cj <= Math.floor(Math.max(...cs.map(z => z[1])) / PCH);
        if (inBox && PG.distPtSeg(lc[0], lc[1], a, b) <= m + HALFD) held = true; } }
    if (held) miss++;
  }
  check(miss === 0 && near > 0, '16 where a road meets anything (its segment not lone), every chunk of the old margin is still drawn finely: the ' + near + ' chunks dropped are on lone stretches only', miss + ' dropped under a segment that meets something');
  // a lone stretch: every chunk whose centre is in its band is still drawn finely
  let bandMiss = 0;
  for (const r of R.layers.roads) { const ls = lone.get(r.id); if (!ls) continue; const m = (+r.w || 3.6) / 2 + (+r.falloff || 6) + 6;
    for (let s = 1; s < r.pts.length; s++) { if (!ls[s - 1]) continue; const a = r.pts[s - 1], b = r.pts[s], mid = F.toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), k = Math.floor(mid[0] / PCH) + ',' + Math.floor(mid[1] / PCH);
      const lc = F.toLocal((Math.floor(mid[0] / PCH) + 0.5) * PCH, (Math.floor(mid[1] / PCH) + 0.5) * PCH); if (PG.distPtSeg(lc[0], lc[1], a, b) <= m && !NEW.has(k)) bandMiss++; } }
  check(bandMiss === 0, '16 a lone stretch keeps the chunks its band covers', bandMiss + ' missing');
  const RP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  check(/PG\.roadPatchChunks\(rec, F, PCH, \{ i0, i1, j0, j1 \}/.test(RP), '16 the game marks its roads\' chunks with the same function');
  console.log('     16 the lone road\'s patch (the town off): ' + OLD.size + ' -> ' + NEW.size + ' chunks of 64 m (' + ((OLD.size - NEW.size) * 33 * 33 / 1e6).toFixed(2) + ' M fewer 2 m samples); ' + nLone + ' of ' + segs + ' segments lone');
}

// 17 A SITE'S ITEMS (G3005; the user: "anything related to placing assets from SITE is painfully slow. Rotate, place, edit,
//    delete, all of it"): each action ONE rebuild, the ground with it (every item stands on a shelf the composer cuts -
//    it was left undrawn: the site was rebuilt with the ground as it was) in a box of what changed - an item moved, its
//    before and after places; never the whole site for one shed; the site's name no ground; never the objects' path
{
  const box = d => (d && d.bbox ? Math.max(d.bbox.x1 - d.bbox.x0, d.bbox.z1 - d.bbox.z0) : Infinity);
  const n0 = () => [R.rebuilds || 0, R.fastCalls || 0];
  let [b0, f0] = n0();
  const sid = ed.cmd('add', { layer: 'sites', entry: { name: 'test harbour', at: { x: 400, z: 400, yaw: 0 }, items: [{ id: 'shed', key: 'stub|shed', x: 0, z: 0 }, { id: 'pier', key: 'stub|pier', x: 160, z: 0 }, { id: 'pens', key: 'stub|pens', x: 320, z: 0 }] } });
  const whole = box(R.lastDirty);
  check(sid && R.rebuilds === b0 + 1 && R.fastCalls === f0 && R.lastDirty && R.lastDirty.ground !== false && whole > 380, '17 a site placed: one rebuild, the ground with it (its shelves), its whole box', JSON.stringify(R.lastDirty && R.lastDirty.bbox));
  ed.cmd('tool', { name: 'select' }); ed.select(sid);
  [b0, f0] = n0();
  const pier = () => find(sid).entry.items.find(it => it.id === 'pier');
  const pw = PG.siteFrame(find(sid).entry).toLocal(pier().x, pier().z);
  ed.cmd('drag', { key: 'i:pier', x: pw[0] + 12, z: pw[1] + 5 });
  check(R.rebuilds === b0 + 1 && R.fastCalls === f0 && R.lastDirty.ground !== false && box(R.lastDirty) < 140, '17 an item moved: one rebuild, the ground under its before and after places only (' + box(R.lastDirty).toFixed(0) + ' m across, the site ' + whole.toFixed(0) + ')');
  [b0, f0] = n0();
  ed.cmd('set', { id: sid, patch: { items: find(sid).entry.items.map(it => (it.id === 'shed' ? Object.assign({}, it, { P: { L: 9 } }) : it)) } });
  check(R.rebuilds === b0 + 1 && R.lastDirty.ground !== false && box(R.lastDirty) < 100, '17 an item edited: one rebuild, its own box (' + box(R.lastDirty).toFixed(0) + ' m)');
  [b0, f0] = n0();
  ed.cmd('set', { id: sid, patch: { at: Object.assign({}, find(sid).entry.at, { yaw: 0.26 }) } });
  check(R.rebuilds === b0 + 1 && R.lastDirty.ground !== false && box(R.lastDirty) > 300, '17 the site turned: one rebuild, all of it (every item moves)');
  [b0, f0] = n0();
  ed.cmd('set', { id: sid, patch: { name: 'the harbour' } });
  check(R.rebuilds === b0 + 1 && R.lastDirty.ground === false, '17 its name: no ground');
  [b0, f0] = n0();
  ed.cmd('delete', { id: sid });
  check(!find(sid) && R.rebuilds === b0 + 1 && R.lastDirty.ground !== false, '17 the site deleted: one rebuild, its ground with it');
  [b0, f0] = n0();
  ed.undo();
  check(find(sid) && R.rebuilds === b0 + 1 && R.lastDirty.ground !== false && R.fastCalls === f0, '17 undone: back, one rebuild');
  const UIs = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'premises_ui.js'), 'utf8');
  check(/'turn ' \+ selected, 'yaw'\);\s+\/\* \(G3005/.test(UIs), '17 R turns a site in one rebuild after the presses stop (coalesced, as a model\'s)');
}

// 18 THE PICK CYCLE (G3006; the user: "issue with overlapping assets, since I can select only one ... cycle through possible
//    selectable assets by clicking a few times on them, and select the polygons last"): a model on a road inside an area -
//    three clicks at one spot pick the three, the polygon last; a fourth comes round again; a click elsewhere starts over;
//    a click again on the selected road never adds it a corner (north of the island's extent: nothing else there)
{
  ed.cmd('tool', { name: 'select' }); ed.select(null);
  const rid = ed.cmd('add', { layer: 'roads', entry: { pts: [[1840, 4000], [2160, 4000]], w: 6, cls: 'gravel', graded: true, falloff: 6 } });
  const aid = ed.cmd('add', { layer: 'areas', entry: { poly: [[1960, 3960], [2040, 3960], [2040, 4040], [1960, 4040]], props: {} } });
  const pid = ed.cmd('place', { x: 2000, z: 4000.6, key: 'stub|lamp', yaw: 0 });
  const nPts = find(rid).entry.pts.length, picks = [];
  for (let k = 0; k < 4; k++) picks.push(ed.cmd('click', { x: 2000, z: 4000 }));
  check(picks[0] === pid && picks[1] === rid && picks[2] === aid, '18 three clicks at one spot: the model, the road, the area - the polygon last', picks.join(' > '));
  check(picks[3] === pid, '18 a fourth click comes round to the first again');
  check(find(rid).entry.pts.length === nPts, '18 a click again on the selected road adds it no corner');
  check(ed.cmd('click', { x: 1980, z: 4030 }) === aid, '18 a click elsewhere starts over (only the area there)');
}

// 19 THE PLOTS' FENCES (G3007; the user: "we need an option to turn off the fencing around the plots too"): a zone's
//    rules.fences false flags every plot it sows noFence, rules.noFence [ids] those alone; none set - every plot record as
//    before, bit for bit (the shipped island's 470 plots); the village generator (GATE VILLAGE) finishes a noFence plot with
//    no fence; the renderer builds a plot again when its fence switches (its seed the same); the inspector's switch and pick
{
  const flat = { id: 'flat', terrainH: () => 0, waterH: () => -100 };
  const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec;
  const key = O => JSON.stringify(O.records.plots);
  const O0 = PG.compose(J, flat, { raster: false }), z = J.layers.zones.find(q => O0.records.plots.some(p => p.zone === q.id && p.kind !== 'park'));
  check(z && !O0.records.plots.some(p => 'noFence' in p), '19 no zone saying so: no plot carries noFence (' + O0.records.plots.length + ' plots)');
  const mine = O0.records.plots.filter(p => p.zone === z.id), one = mine[0];
  const J1 = JSON.parse(JSON.stringify(J)); J1.layers.zones.find(q => q.id === z.id).rules = Object.assign({}, z.rules, { noFence: [one.id] });
  const O1 = PG.compose(J1, flat, { raster: false });
  check(O1.records.plots.filter(p => p.noFence).map(p => p.id).join() === one.id, '19 a plot switched off: it alone carries noFence (' + one.id + ')');
  check(JSON.stringify(O1.records.plots.map(p => { const c = Object.assign({}, p); delete c.noFence; return c; })) === key(O0), '19 ...and every plot otherwise the same, its boundary and seed too');
  const J2 = JSON.parse(JSON.stringify(J)); J2.layers.zones.find(q => q.id === z.id).rules = Object.assign({}, z.rules, { fences: false });
  const O2 = PG.compose(J2, flat, { raster: false });
  check(O2.records.plots.filter(p => p.zone === z.id).every(p => p.noFence) && O2.records.plots.filter(p => p.zone !== z.id).every(p => !p.noFence), '19 the zone\'s fences off: its ' + mine.length + ' plots, and no other');
  const VGs = fs.readFileSync(path.join(TOOLS, '_village_gen.js'), 'utf8'), RPs = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  check(/plot\.noFence \? new Set\(\) : vil\.fenced/.test(VGs) && /if \(plot\.noFence\) plot\.fences = \[\];/.test(VGs), '19 the village generator keeps no fence for a noFence plot, and claims none of its sides');
  check(/!!p\.noFence !== !!\(h\.plot && h\.plot\.noFence\)/.test(RPs), '19 the renderer builds a plot again when its fence switches (its seed the same)');
  check(/'plot fences'/.test(UI_SRC) && /pick plots: a click switches one plot\\'s fence/.test(UI_SRC) && /name === 'plotFence'/.test(UI_SRC), '19 the zone\'s inspector: the fences switch and the plot pick');
}

// 21 ONE STRIP A DRAW (G3016; the user, 12 Oct: two strips added on top of each other - rev 24's w1 + w4, the altiport): the
//    runway tool hands back to SELECT once a strip is placed, so two more clicks add nothing; no two shipped strips stand
//    within 50 m of each other (Jolene's crossing 02/20 x 13/31 is 939 m centre to centre)
{
  ed.select(null); ed.cmd('tool', { name: 'runway' });
  const n0 = ed.record().layers.runways.length;
  ed.cmd('point', { x: 6000, z: 6500 }); ed.cmd('point', { x: 6300, z: 6500 });
  const n1 = ed.record().layers.runways.length;
  try { ed.cmd('point', { x: 6000, z: 6700 }); ed.cmd('point', { x: 6300, z: 6700 }); } catch (e) {}
  const n2 = ed.record().layers.runways.length;
  check(n1 === n0 + 1 && n2 === n1, '21 a strip drawn hands the tool back: two more clicks add no second strip (' + n0 + ' -> ' + n1 + ' -> ' + n2 + ')');
  const FXr = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec.layers.runways, near = [];
  for (let i = 0; i < FXr.length; i++) for (let j = i + 1; j < FXr.length; j++) if (Math.hypot(FXr[i].c[0] - FXr[j].c[0], FXr[i].c[1] - FXr[j].c[1]) < 50) near.push(FXr[i].id + '/' + FXr[j].id);
  check(!near.length, '21 no two shipped strips stand within 50 m of each other', near.join(' '));
  ed.cmd('tool', { name: 'select' });
}

// 23 A STRIP'S OWN THINGS TAKE A CLICK (G2891 SCENERY-ED-1 c1; the user, 12 Oct, at HOME: "there is a lot I can't displace"):
//    a press on the club hangar's footprint selects its strip and drags the hangar; on the stand (within 5 m) the stand; a
//    press on nothing of a strip grabs nothing; a parked aeroplane standing on the stand is picked as the object it is
{
  ed.cmd('tool', { name: 'select' }); ed.select(null);
  const rw = ed.cmd('add', { layer: 'runways', entry: Object.assign(JSON.parse(JSON.stringify(PG.RUNWAY_DEF)), { name: 'grab strip', c: [3000, 3000], hdg: 0, len: 500, wid: 20,
    stand: { x: 3000, z: 3060, hdg: null }, taxiOut: [[3000, 3000]], hangar: { x: 3040, z: 3062, hdg: 0 } }) });
  ed.select(null);
  check(ed.cmd('grab', { x: 3051, z: 3068 }) === true && ed.selected === rw, '23 a press on the club hangar\'s footprint selects its strip and grabs it');
  ed.cmd('dragMove', { x: 3090, z: 3100 }); ed.cmd('dragEnd', {});
  const hg = find(rw).entry.hangar;
  check(hg.x === 3090 && hg.z === 3100, '23 ...and the hangar follows the hand', JSON.stringify(hg));
  ed.select(null);
  check(ed.cmd('grab', { x: 3002, z: 3061 }) === true && ed.selected === rw, '23 a press on the stand grabs the stand');
  ed.cmd('dragMove', { x: 3010, z: 3075 }); ed.cmd('dragEnd', {});
  check(find(rw).entry.stand.x === 3010 && find(rw).entry.stand.z === 3075, '23 ...and the stand follows', JSON.stringify(find(rw).entry.stand));
  ed.select(null);
  check(ed.cmd('grab', { x: 3200, z: 3200 }) === false && ed.selected === null, '23 a press on nothing of a strip grabs nothing');
  const ac = ed.cmd('add', { layer: 'objects', entry: { kind: 'aircraft', key: 'arch:cub', x: 3010, z: 3075, yaw: 0 } });
  ed.select(null);
  check(ed.cmd('grab', { x: 3010.5, z: 3075.5 }) === false, '23 a parked aeroplane on the stand is not grabbed through');
  check(roundTrip(), '23 the record round-trips');
  ed.cmd('delete', { id: ac }); ed.cmd('delete', { id: rw });
}
// 24 A PARKED AEROPLANE BY ITS SIZE (G2891 c3): picked within 6 m x its scale (its drawn bounding radius x 0.85 when the
//    page has the group) - a wing's click picked nothing at the old 2.5 m; a prop keeps 2.5 m x its scale; the renderer's
//    hit() and hitAll() read the one rule
{
  check(PG.objectPickR({ kind: 'aircraft' }) === 6 && PG.objectPickR({ kind: 'aircraft' }, 10) === 8.5 && PG.objectPickR({ kind: 'prop' }) === 2.5 && PG.objectPickR({ kind: 'prop', s: 2 }) === 5,
    '24 objectPickR: an aeroplane 6 m (its built radius x 0.85 when known), a prop 2.5 m x its scale');
  const ac = ed.cmd('add', { layer: 'objects', entry: { kind: 'aircraft', key: 'arch:c172', x: 3500, z: 3500, yaw: 0 } });
  const top = R.hitAll(...(() => { const w = R.overlay.frame.toWorld(3504.5, 3500); return [w[0], w[1]]; })())[0];
  check(top && top.id === ac, '24 a click 4.5 m out on a parked aeroplane\'s wing picks it');
  const RPs = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  check((RPs.match(/d < pickR\(ob\)/g) || []).length === 2 && /PG\.objectPickR\(ob, g \? g\.userData\.pickR : undefined\)/.test(RPs) && /objectEdit, hitAll, grabAt,/.test(RPs), '24 the renderer\'s hit() and hitAll() pick by pickR; grabAt is published');
  ed.cmd('delete', { id: ac });
}
// 5 NAMES
check(/rows\.section\(insp, 'THE SCENERY'\)/.test(UI_SRC) && !/rows\.section\(insp, 'THE PREMISES'\)/.test(UI_SRC), '5 the editor names its record the scenery');
const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
check(/t\.textContent = 'scenery editor'/.test(APP) && /'open the scenery editor'/.test(APP) && /flRow\(body, 'the world editor \(F9\)'\)/.test(APP), '5 the game names the scenery editor and the world editor (F9)');

if (fail.length) { for (const f of fail) console.log('  ! ' + f); console.log('GATE SCENERYED: FAIL (' + fail.length + ')'); process.exit(1); }
console.log('  ' + checks + ' checks');
console.log('GATE SCENERYED: PASS');
