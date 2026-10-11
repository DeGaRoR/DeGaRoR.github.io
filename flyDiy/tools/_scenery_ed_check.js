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
// Exits non-zero on any red; prints GATE SCENERYED: PASS / FAIL.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const TOOLS = __dirname, ROOT = path.join(TOOLS, '..');
const PG = require(path.join(ROOT, 'src', 'core', '27_premises.js'));

const fail = [];
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
    const arr = e.poly || e.pts; if (!arr) return out;
    arr.forEach((q, i) => { out.push({ key: 'v' + i, p: [q[0], 0, q[1]] }); if (e.poly || i + 1 < arr.length) out.push({ key: 'm' + i, p: [q[0], 0, q[1]], mid: true }); });
    if (e.pts && e.curve === 'spline') PG.roadHandles(e.pts, e.tan).forEach((h, i) => out.push({ key: 'h' + i, p: [e.pts[i][0] + h[0], 0, e.pts[i][1] + h[1]] }));
    return out;
  };
  const R = {
    stats: {}, get overlay() { return O; },
    setRecord(r) { rec = PG.normalise(r); },
    rebuild() { O = PG.compose(rec, synth); return R.stats; },
    select(id) { if (id !== sel) corner = null; sel = id; },
    corner(i) { if (i !== undefined) corner = i; return corner; },
    ghost() {}, preview() {}, previewEnd() {}, pickHandle() { return null; },
    handles: handleKeys,
    hit(x, z) { const L = O.frame.toLocal(x, z); for (const k of ['material', 'surface', 'zones', 'terrain']) for (const e of rec.layers[k]) if (e.poly && PG.inPoly(e.poly, L[0], L[1])) return { id: e.id, layer: k, entry: e }; return null; },
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
check(notes.some(t => /^§SHAPE/.test(t)) && notes.some(t => /^\[subdivide/.test(t)), '1 the inspector shows the SHAPE section and its buttons');

// 2 THE ROUND PAD
ed.setSection('airfield'); ed.cmd('tool', { name: 'pad' });
ed.cmd('point', { x: 200, z: 100 }); ed.cmd('point', { x: 201, z: 100 });
check(!rec().layers.material.some(m => m.round), '2 a pad under 3 m is refused');
ed.cmd('tool', { name: 'pad' });
ed.cmd('point', { x: 200, z: 100 }); ed.cmd('point', { x: 215, z: 100 });
const pad = rec().layers.material.find(m => m.round);
check(pad && pad.look === 'concrete' && Math.abs(pad.round.r - 15) < 0.01 && pad.poly.length === 48, '2 the pad tool\'s two clicks stand a round concrete pad');
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

// 5 NAMES
check(/rows\.section\(insp, 'THE SCENERY'\)/.test(UI_SRC) && !/rows\.section\(insp, 'THE PREMISES'\)/.test(UI_SRC), '5 the editor names its record the scenery');
const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
check(/t\.textContent = 'scenery editor'/.test(APP) && /'open the scenery editor'/.test(APP) && /flRow\(body, 'the world editor \(F9\)'\)/.test(APP), '5 the game names the scenery editor and the world editor (F9)');

if (fail.length) { for (const f of fail) console.log('  ! ' + f); console.log('GATE SCENERYED: FAIL (' + fail.length + ')'); process.exit(1); }
console.log('  ' + checks + ' checks');
console.log('GATE SCENERYED: PASS');
