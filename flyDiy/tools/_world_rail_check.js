#!/usr/bin/env node
// _world_rail_check.js - GATE WORLDRAIL (WORLD-RAIL-VEG 16 Nov; the user: "every new world setting must be editable in the WORLD
// EDITOR" so they can hand-tune after the credits run out). The world rail (src/viewer/world_rail.js, F9) on a fake DOM over the
// REAL biomes (28c_biomes.js) and stand-in handles for the fill, the ring and the splat; holds:
//   - VEGETATION and TYPES build (no "this section failed to build");
//   - the forest edge's rows (VEGETATION) and the subalpine's (TYPES > subalpine, code 19) move the biomes' knobs through
//     TREE_FILL.knobs (one replant); a shaped species' rows (the alpine shrubs' cut, height, bend, lean, tilt, upright) move its pack
//     row and re-build its cards (the ring's reshape); the cliff / old-forest / dense-scrub split moves the splat AND the planters;
//   - THE LOOK: saved as a delta (bioKnobs, shrubCards), put back, reset by a full import; a biome set to none saves as null and
//     comes back (code 18 never did: the map loop stopped at 14); a look without code 19 leaves the subalpine alone;
//   - the export names where each part goes.
// A NEW ROW of a world setting adds its line here. node tools/_world_rail_check.js -> "GATE WORLDRAIL: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m, x) => { console.log((c ? '  ok   ' : '  FAIL ') + m + (x !== undefined ? '  (' + x + ')' : '')); if (!c) fails++; };
const els = [];
function El(tag) {
  const e = { tag, children: [], style: {}, dataset: {}, className: '', _text: '', value: '', attrs: {},
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { if (on === undefined) on = !this.s.has(c); if (on) this.s.add(c); else this.s.delete(c); return on; }, contains(c) { return this.s.has(c); } },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, get firstChild() { return this.children[0] || null; },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, removeEventListener() {}, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }, focus() {}, blur() {}, select() {}, click() {},
    getContext() { return new Proxy({}, { get: (t, k) => k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'createImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {} , set: () => true }); },
    set textContent(v) { this._text = v; if (v === '') this.children = []; }, get textContent() { return this._text; }, innerHTML: '' };
  els.push(e); return e;
}
const all = (e, out = []) => { out.push(e); for (const c of e.children) all(c, out); return out; };
const ui = El('div');
const store = {};
const ctx = { console, Math, JSON, Object, Array, Set, Map, Number, String, Date, RegExp, Error, Proxy, Float32Array, Uint8ClampedArray, Uint8Array, isFinite, parseFloat, parseInt,
  setTimeout: (f) => { ctx._t.push(f); return 1; }, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, _t: [],
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  location: { search: '' }, alert() {}, confirm: () => true, ImageData: function () { this.data = new Uint8ClampedArray(4); },
  document: { createElement: El, getElementById: id => (id === 'ui' ? ui : null), head: El('head'), body: El('body') },
  navigator: {}, URL: {}, Blob: function () {} };
ctx.window = ctx; ctx.addEventListener = () => {};
vm.createContext(ctx);
// THE WORLD: the real biomes, a fill handle that replants by count, a ring with one shaped species
const BIOMES = require(path.join(ROOT, 'src', 'core', '28c_biomes.js')); ctx.BIOMES = BIOMES;
const pack = { collections: [{ name: 'alp_x', kind: 'cover', maps: ['a.png'], place: { shape: 'carpet', size: 1.1, tilt: 70 }, tint: { alpha: 0.3 } }, { name: 'shrub_deciduous', kind: 'shrub', place: {} }],
  biomes: { map: { 2: 'heath', 7: 'scrub', 18: 'shore', 19: 'subalpine' }, mixes: { heath: { species: {}, forest: { count: 10 } }, scrub: { species: {} }, shore: { species: {} }, subalpine: { species: { alp_x: { density: 0.03 } }, forest: { count: 5 } } } } };
ctx.TREE_PACK = pack;
const BIO = BIOMES.make(pack); BIO.edgeField = BIO.edgeField;   // (real)
let replants = 0, reshaped = [];
const ringS = { reach: 200, near: 60, taper: 0.5, density: 1, shrubs: 1, rocks: 1, aglFull: 60, aglOff: 200 };
const ring = { get: () => Object.assign({}, ringS), set: o => Object.assign(ringS, o), stat: () => null, replant: () => {}, shapes: () => ['alp_x'], cardDef: () => ({ bend: 0.22, lean: 0.18, tilt: 60, upright: 0.85 }), reshape: n => { reshaped.push(n); return true; } };
const isl = { from: 0.5, full: 6, gain: 1.3, min: 0.45, max: 2.4, biomeGain: 3.5, biomeWobble: 10 };
const TF = { biomes: () => BIO, cover: () => ring, grass: () => null, island: () => Object.assign({}, isl), setIsland: o => Object.assign(isl, o), onIsland: () => true, get: () => 128, set() {}, thin: () => [2000, 5000],
  knobs: o => { if (o === undefined) return BIO.tuned(); replants++; return BIO.setKnobs(o); }, setBiome: (c, m) => BIO.set(c, m), setMix() {}, at: () => null, speciesSizes: () => ({}), speciesSize: () => 1 };
ctx.TREE_FILL = TF;
const spK = { cliffLo: 32, cliffHi: 42, oldLo: 14, oldHi: 20, denseLo: 1, denseHi: 2.5 };
const splat = { knobs: () => Object.assign({}, spK), knobsLive: () => spK, set: o => Object.assign(spK, o), code: () => null, on: () => true, filterDefaults: () => ({}), state: () => ({ knobs: spK }), library: () => [], norm: () => ({}), grade: () => ({}) };
BIO.ground = () => splat.knobsLive();
ctx.GROUND_FIELDS = { RECIPE: { knobs: { cliffLo: 32, cliffHi: 42, oldLo: 14, oldHi: 20, denseLo: 1, denseHi: 2.5 } } };
ctx.WORLD = { ground: { on: () => true, get: () => ({ light: 1, sat: 1 }), set() {}, stack: () => [], splat: () => splat, modes: () => [], blends: () => [] } };
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'world_rail.js'), 'utf8'), ctx, { filename: 'world_rail.js' });
const R = ctx.WORLD_RAIL;
// the boot: takes the defaults
for (let i = 0; i < 3 && ctx._t.length; i++) { const q = ctx._t.splice(0); for (const f of q) try { f(); } catch (e) { console.log('timer: ' + e.message); } }
const sliders = () => all(ui).filter(e => e.tag === 'input' && e.type === 'range');
const labelled = (lab) => { for (const e of all(ui)) if (e.tag === 'div' && e.children.length >= 2 && e.children[0] && e.children[0]._text === lab) { const i = e.children.find(c => c.tag === 'input'); if (i) return i; } return null; };
const text = () => all(ui).map(e => e._text).join(' | ');
// VEGETATION
R.open('veg');
const warn = all(ui).filter(e => (e.className || '').includes('wr-warn')).map(e => e._text);
ok(!warn.some(t => /failed to build/.test(t)), 'vegetation builds', warn.join(' / ').slice(0, 200));
const yt = labelled('young trees to'), cell = labelled('cell');
ok(!!yt && !!cell && !!labelled('weeds to (past the reach)') && !!labelled('size at the edge') && !!labelled('trees reach out to') && !!labelled('size at the reach') && !!labelled('ramp inside'), 'the forest edge rows are there (the outward band, the old inside ramp, the band)');
{ const rr = labelled('trees reach out to'); if (rr) { rr.value = '25'; rr.oninput(); } ok(BIO.knobs().edgeReach === 25, 'the outward band reach moves', 'edgeReach ' + BIO.knobs().edgeReach); BIO.setKnobs({ edgeReach: null }); }
if (yt) { yt.value = '10'; yt.oninput(); }
ok(BIO.knobs().edgeYoung === 10 && replants > 0, 'a forest edge slider moves the knob and replants', 'edgeYoung ' + BIO.knobs().edgeYoung + ', replants ' + replants);
// TYPES: the subalpine
ctx.localStorage.setItem('flydiy.worldrail.ui', JSON.stringify({ code: 19, tab: 'biome' }));
R.open('types');
const w2 = all(ui).filter(e => (e.className || '').includes('wr-warn')).map(e => e._text);
ok(!w2.some(t => /failed to build/.test(t)), 'types builds', w2.join(' / ').slice(0, 200));
const chip = all(ui).find(e => e.tag === 'button' && e.children.some(c => c._text === 'subalpine'));
if (chip) chip.onclick();
const h0 = labelled('from'), keep = labelled('summits keep');
ok(!!h0 && !!keep && !!labelled('ridge keeps'), 'the subalpine panel is on code 19', text().includes('derived from heath and scrub') ? 'its header' : 'no header');
if (h0) { h0.value = '400'; h0.oninput(); }
ok(BIO.knobs().subH0 === 400, 'the subalpine ramp moves', 'subH0 ' + BIO.knobs().subH0);
const card = labelled('cut (alpha)'), tilt = labelled('tilt (carpet)');
ok(!!card && !!tilt, 'the shaped species\' rows on its card');
if (card) { card.value = '0.2'; card.oninput(); }
ok(pack.collections[0].tint.alpha === 0.2 && reshaped.includes('alp_x'), 'the cut moves the pack row and re-builds the cards', 'alpha ' + pack.collections[0].tint.alpha + ', reshaped ' + reshaped.join());
// the split on code 12
const chip12 = all(ui).find(e => e.tag === 'button' && e.children.some(c => c._text === 'cliff'));
if (chip12) chip12.onclick();
const from12 = labelled('from'), r0 = replants;
if (from12) { from12.value = '20'; from12.oninput(); }
ok(spK.cliffLo === 20 && replants > r0 && BIO.codeOf(6, 25, 0, 0.1) === 12, 'the split moves the splat and the planters read it', 'cliffLo ' + spK.cliffLo + ', code at 25 deg, r 0.1: ' + BIO.codeOf(6, 25, 0, 0.1));
// THE LOOK: saved, reset, put back
for (const f of ctx._t.splice(0)) try { f(); } catch (e) {}
const saved = JSON.parse(store['flydiy.worldlook.v1'] || '{}');
ok(saved.bioKnobs && saved.bioKnobs.subH0 === 400 && saved.bioKnobs.edgeYoung === 10 && saved.shrubCards && saved.shrubCards.alp_x && saved.shrubCards.alp_x.alpha === 0.2, 'the look saves the knobs and the card rows', JSON.stringify(saved.bioKnobs) + ' ' + JSON.stringify(saved.shrubCards));
ok(saved.biomes === undefined || !saved.biomes.map, 'an untouched biome map is not saved');
BIO.setKnobs(null); pack.collections[0].tint.alpha = 0.3;
R.apply(saved, false);
ok(BIO.knobs().subH0 === 400 && BIO.knobs().edgeYoung === 10 && pack.collections[0].tint.alpha === 0.2, 'a saved look puts them back');
// map: none on 18 saved as null and put back; a map without 19 leaves 19
BIO.set(18, null); const L = R.look(); ok(L.biomes.map[18] === null, 'a code set to none saves as null', JSON.stringify(L.biomes.map));
BIO.set(18, 'shore'); R.apply({ biomes: { map: L.biomes.map } }, false); ok(!BIO.map[18], 'the null comes back as none (18 was never restored before)');
R.apply({ biomes: { map: { 2: 'heath' } } }, false); ok(BIO.map[19] === 'subalpine', 'a look without code 19 leaves the subalpine alone');
// full import of the defaults resets
R.importLook({ bioKnobs: {}, shrubCards: {} });
const SHIP = BIOMES.make({ biomes: { map: {}, mixes: {} } }).knobs();   // the shipped knobs, whatever they are
ok(BIO.knobs().subH0 === SHIP.subH0 && BIO.knobs().edgeYoung === SHIP.edgeYoung && pack.collections[0].tint.alpha === 0.3, 'a full import without them resets to the shipped', 'subH0 ' + BIO.knobs().subH0 + ', alpha ' + pack.collections[0].tint.alpha);
const ex = R.export(); ok(ex.where.bioKnobs && Array.isArray(ex.changes), 'the export names where they go', ex.changes.length + ' changes');
console.log('GATE WORLDRAIL: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
