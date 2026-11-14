#!/usr/bin/env node
// _liverystickers_check.js - GATE LIVERYSTICKERS (LIVERY-STICKERS, 9 Nov 2026): the twelve Alaska marks as livery
// stickers. Node only, ~10 s; the pictures are tools/stickers_shot.js's (SwiftShader, the garage).
//   1 THE ART     assets-src/stickers/svg/ is cutter-ready: one filled path a mark (fill-rule evenodd), no stroke, mask,
//                 clip, group or transform; twelve of them, numbered 01-12
//   2 THE MARKS   src/viewer/livery_marks.js is fresh (tools/livery_marks_prep.js --check); twelve marks, each decodes
//                 to closed finite rings inside its own frame; its ids, names and ink boxes are aeroskin's
//                 AERO_VINYL_MARKS; and every mark LOADS AS THE CUTTER'S ART: the game's rings and the svg/ path,
//                 rasterised even-odd at 256 px, cover the same pixels (<= 0.6 % of the ink box moved) - so the
//                 sticker on the aeroplane is the sticker the cutter cuts
//   3 DEFAULTS    every vn<1-4><field> row is in AERO_DEC_DEF at AERO_VINYL_LDEF's value, every slot off; a spec with
//                 no rows (and the merge of any spec without them) resolves to no sticker; the editor's own finish code
//                 (sliced out of _cage_ui.js as GATE LIVERY does) folds the rows into DEC_DEF, exports none of them for
//                 an untouched build, and round-trips the ones it was given, exactly
//   4 OFFICIAL    every build in builds/ (and builds/candidates/) and every stock row in _cage_page5.js: no vn row in
//                 its finish, no sticker resolved, its decal block (aeroDecalsFor + aeroSetDecals on the vendor three)
//                 everything it wore kept (nothing dropped by the budget) and no slot on page 15; and saving it
//                 through the editor (finishFromSpec -> finishToSpec) gives back its own finish, byte for byte
//   5 PLACEMENT   the rows -> the decal: Side 0/1/2 -> uDecE.z 0/+R/-R (R = AERO_VINYL_RIGHT), Mir -> uDecC.w
//                 (noMirror), Tgt / Mode the livery layer's tables, the ink's height = the size row exactly (the cell's
//                 margin grown out), the width = the size x the mark's aspect, the rect = the slot's own cell of page
//                 15 (four disjoint cells, none outside the page, none on pages 0-14), the order kit < stickers <
//                 registration, and the worst case (5 kit + 4 stickers + both registrations + strip + master = 13)
//                 kept whole inside AERO_MAXD = 15, and with LIVERY-TEXT's six pieces on (the user's cap: a shared budget - the
//                 fixed markings and the text always, the kit
//                 then the stickers give way from the last, `dropped` counted); uDecE.x 2 for a sticker (a float takes it); parked.js's usedPages reads the cells back as page 15 (a parked aeroplane's
//                 atlas copy holds the pages its stickers read)
//   6 THE DRAW    aeroVinylDraw on a recording canvas: the mark's every ring traced inside its slot's ink box and
//                 touching all four sides of it (fitted, aspect kept), filled even-odd in the picked colour (the trim
//                 when unset), mirrored by the flip, redrawn only when the mark / colour / flip changes; with no
//                 geometry the cell is cleared and the lazy file is asked for, once
//   7 SOURCE      the shader's one-side test takes the sign (-1 the other flank) and both AERO_MAXDs are 13;
//                 livery_marks.js is a lazy file (build.js MANIFEST.lazy, in FLYDIY_LAZY_SRC, its rings not inlined in
//                 index.html); the panel builds AERO_VINYL_N sticker blocks (data-dec 'vny') and editor.js heads them; a slot
//                 switched on goes to the middle of the fuselage (the editor's decVinylFirstPlace, run on a measured box)
// Run: node tools/_liverystickers_check.js [--verbose] [--selftest]      (one final `GATE LIVERYSTICKERS: ...`)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const CORE = require(path.join(__dirname, 'flight_core.js'));
const VERBOSE = process.argv.includes('--verbose');

const SRC0 = {
  ui: rd('tools/_cage_ui.js'), skin: rd('src/viewer/aeroskin.js'), marks: rd('src/viewer/livery_marks.js'),
  build: rd('tools/build.js'), editor: rd('src/viewer/editor.js'), page5: rd('tools/_cage_page5.js'),
  parked: rd('src/viewer/parked.js'), flown: rd('src/viewer/flown_bake.js'),
};

// ---- the harness (GATE LIVERY's: one declaration by name, a stubbed DOM, the editor's finish code sliced) -------
function grab(src, re, what) {
  const m = re.exec(src);
  if (!m) throw new Error('the gate cannot find ' + what + ' in the source');
  const i = m.index;
  const isFn = /^\s*function\b/.test(src.slice(i, i + 64));
  let depth = 0, braced = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j], d = src[j + 1];
    if (c === '/' && d === '/') { j = src.indexOf('\n', j); if (j < 0) break; continue; }
    if (c === '/' && d === '*') { j = src.indexOf('*/', j + 2) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') { for (j++; j < src.length && src[j] !== c; j++) if (src[j] === '\\') j++; continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; if (c === '{') braced = true; }
    else if (c === '}' || c === ')' || c === ']') { depth--; if (isFn && depth === 0 && c === '}' && braced) return { at: i, text: src.slice(i, j + 1) }; }
    else if (c === ';' && depth === 0 && !isFn) return { at: i, text: src.slice(i, j + 1) };
  }
  throw new Error('unbalanced declaration: ' + what);
}
const UI_DECLS = [
  ['AK', /^const AK = /m], ['CONS_MAP', /^const CONS_MAP = /m], ['consOf', /^const consOf = /m],
  ['secTint', /^const secTint = /m], ['secFin', /^const secFin = /m],
  ['secTile', /^const secTile = /m], ['secCc', /^const secCc = /m],
  ['secMetal', /^const secMetal = /m], ['secFieldL', /^const secFieldL = /m],
  ['secWear', /^const secWear = /m], ['WEAR', /^const WEAR = /m], ['WEAR_KEYS', /^const WEAR_KEYS = /m],
  ['AERO_PREF', /^const AERO_PREF = /m], ['aeroLoadPrefs', /^function aeroLoadPrefs\(/m],
  ['aeroLoadGlass', /^function aeroLoadGlass\(/m], ['aeroSavePrefs', /^function aeroSavePrefs\(/m],
  ['aeroPrefsOwn', /^const aeroPrefsOwn = /m], ['aeroBootPrefs', /^function aeroBootPrefs\(/m],
  ['SEC_LIVE', /^const SEC_LIVE = /m], ['SEC_CTX', /^const SEC_CTX = /m],
  ['SEC_EPOCH', /^let SEC_EPOCH = /m], ['SEC_OVER', /^const SEC_OVER = /m], ['secMat', /^function secMat\(/m],
  ['DEC', /^const DEC = /m], ['DEC_DEF', /^const DEC_DEF = /m], ['decKitIn', /^let decKitIn = /m],
  ['decKitDefaults', /^function decKitDefaults\(/m], ['decLoadPrefs', /^function decLoadPrefs\(/m],
  ['decSavePrefs', /^function decSavePrefs\(/m], ['finishToSpec', /^function finishToSpec\(/m],
  ['finishFromSpec', /^function finishFromSpec\(/m], ['matPanelSig', /^let matPanel = /m],
  ['GLASS', /^const GLASS = /m], ['GLASS_DEFV', /^const GLASS_DEFV = /m],
];
// a 2D context that RECORDS the path calls and the fills (the draw's proof), and answers everything else
function recCtx() {
  const R = { ops: [], fills: [], strokes: [], clears: [] };
  const t = { __R: R };
  return new Proxy(t, {
    get: (o, k) => {
      if (k in o) return o[k];
      if (k === 'createImageData' || k === 'getImageData')
        return (a, b, c, d) => { const w = ((c != null ? c : a) | 0) || 1, h = ((d != null ? d : b) | 0) || 1;
                                 return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
      if (k === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (/^create(Linear|Radial)Gradient$|^createPattern$/.test(k)) return () => ({ addColorStop() {} });
      if (k === 'moveTo' || k === 'lineTo') return (x, y) => R.ops.push([k, x, y]);
      if (k === 'beginPath') return () => R.ops.push(['begin']);
      if (k === 'fill') return rule => R.fills.push({ rule, style: o.fillStyle, n: R.ops.length });
      if (k === 'stroke') return () => R.strokes.push({ style: o.strokeStyle, w: o.lineWidth });
      if (k === 'clearRect') return (x, y, w, h) => R.clears.push([x, y, w, h]);
      return () => {};
    },
    set: (o, k, v) => { o[k] = v; return true; },
  });
}
const CANVASES = [];
const canvas = () => { const g = recCtx(); const c = { width: 1, height: 1, style: {}, getContext: () => g, addEventListener() {} }; CANVASES.push(c); return c; };
const browser = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

// THE FACTORY in its own context (window.FLYDIY_LAZY stubbed to count the asks; LIVERY_MARKS given or not)
function skinOf(SRC, o) {
  o = o || {};
  const W = { THREE, console, Math, JSON, Object, Array, Map, Set, Number, String, Boolean, Promise,
              Float32Array, Float64Array, Int32Array, Uint8Array, Uint8ClampedArray, Uint16Array, Int8Array, Int16Array,
              Uint32Array, isFinite, Infinity, NaN, performance, setTimeout, clearTimeout,
              document: { createElement: k => (k === 'canvas' ? canvas() : { style: {} }) } };
  W.window = W; W.globalThis = W;
  // the atlas at 1024 px (the budget's door, G1523): every registration page's distance field is 16x cheaper, and every
  // placement below reads the atlas size off the atlas itself
  W.GFX = { budget: () => ({ aeroAtlas: 1024 }) };
  W.__lazy = [];
  W.FLYDIY_LAZY = n => { W.__lazy.push(n); return new Promise(() => {}); };
  vm.createContext(W);
  if (o.marks) vm.runInContext(SRC.marks, W, { filename: 'livery_marks.js' });
  vm.runInContext(SRC.skin, W, { filename: 'aeroskin.js' });
  return W;
}
function page(SRC, store, A) {
  const W = { THREE, console, Math, JSON, Object, Array, Map, Set, Number, String, Boolean, isFinite, Infinity, NaN, localStorage: store };
  W.window = W; W.globalThis = W; W.CAGE_IN_GAME = 1;
  vm.createContext(W);
  const parts = UI_DECLS.map(([nm, re]) => grab(SRC.ui, re, '_cage_ui.js ' + nm)).sort((a, b) => a.at - b.at);
  const prelude = 'const P = { intCons: 2 };\nconst aeroOn = () => true;\nconst SYNC = {}, DEC_RELOAD = [];\n';
  vm.runInContext(prelude + parts.map(p => p.text).join('\n') +
    '\nwindow.__ED = { aeroBootPrefs, finishFromSpec, finishToSpec, DEC, DEC_DEF };', W, { filename: '_cage_ui.js (slice)' });
  W.AEROSKIN = A;                            // the editor bundle is ahead of aeroskin.js: handed over after
  W.__ED.aeroBootPrefs();
  return W.__ED;
}

// ---- even-odd raster (the "same art" check) ------------------------------------------------------------------
function raster(rings, box, N) {
  const [x0, y0, x1, y1] = box, s = N / Math.max(x1 - x0, y1 - y0);
  const W = Math.ceil((x1 - x0) * s), H = Math.ceil((y1 - y0) * s), img = new Uint8Array(W * H);
  const edges = [];
  for (const r of rings) for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    edges.push([(a[0] - x0) * s, (a[1] - y0) * s, (b[0] - x0) * s, (b[1] - y0) * s]);
  }
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, xs = [];
    for (const [ax, ay, bx, by] of edges) if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) * (bx - ax) / (by - ay));
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x < Math.min(W, Math.ceil(xs[k + 1] - 0.5)); x++) img[y * W + x] = 1;
  }
  return { img, W, H };
}
const svgRings = d => (d.match(/M[^Z]*Z/g) || []).map(r => r.slice(1, -1).split(/[ L]+/).filter(Boolean).map(p => p.split(',').map(Number)));

// ---------------------------------------------------------------------------------------------------------------
function run(SRC) {
  const fails = [], notes = [];
  let n = 0;
  const check = (ok, what, more) => { n++; if (!ok) fails.push(what + (more ? ' - ' + more : '')); else if (VERBOSE) console.log('  ok ' + what); };
  const W0 = skinOf(SRC, { marks: true }), A = W0.AEROSKIN, G = W0.LIVERY_MARKS;

  // 1 THE ART ----------------------------------------------------------------------------------------------------
  const SVGDIR = path.join(ROOT, 'assets-src', 'stickers', 'svg');
  const svgs = fs.readdirSync(SVGDIR).filter(f => f.endsWith('.svg')).sort();
  check(svgs.length === 12 && svgs.every((f, i) => f.startsWith(String(i + 1).padStart(2, '0') + '_')), 'the art: twelve marks, 01-12', svgs.join(' '));
  const cutD = {};
  for (const f of svgs) {
    const s = fs.readFileSync(path.join(SVGDIR, f), 'utf8');
    const tags = (s.match(/<([a-zA-Z]+)/g) || []).map(t => t.slice(1)).filter(t => t !== 'svg' && t !== 'title');
    check(tags.length === 1 && tags[0] === 'path', f + ' is ONE filled path', tags.join(','));
    check(!/stroke|mask|clip-path|clipPath|transform|<g[ >]/.test(s), f + ' has no stroke, mask, clip, group or transform');
    check(/fill-rule="evenodd"/.test(s), f + ' fills even-odd (its holes are rings)');
    cutD[f.replace(/^\d+_|\.svg$/g, '')] = { d: (s.match(/ d="([^"]+)"/) || [])[1] || '', vb: (s.match(/viewBox="([^"]+)"/) || [])[1] };
  }

  // 2 THE MARKS --------------------------------------------------------------------------------------------------
  { const r = spawnSync(process.execPath, [path.join(__dirname, 'livery_marks_prep.js'), '--check'], { encoding: 'utf8' });
    check(SRC === SRC0 ? r.status === 0 : true, 'livery_marks.js is fresh (livery_marks_prep.js --check)', (r.stdout || '').trim()); }
  check(G && Array.isArray(G.marks) && G.marks.length === 12, 'livery_marks.js holds twelve marks');
  check(A.AERO_VINYL_MARKS.length === (G && G.marks.length), 'aeroskin names as many marks as the file holds');
  for (let k = 0; G && k < G.marks.length; k++) {
    const m = G.marks[k], I = A.AERO_VINYL_MARKS[k] || {};
    check(I.id === m.id && I.name === m.name && JSON.stringify(I.b) === JSON.stringify(m.b),
      'mark ' + (k + 1) + ' (' + m.id + '): aeroskin\'s id, name and ink box are the file\'s', JSON.stringify(I) + ' vs ' + JSON.stringify({ id: m.id, name: m.name, b: m.b }));
    const rings = A.aeroVinylRings(G, k) || [];
    const fin = rings.length > 0 && rings.every(r => r.length >= 3 && r.every(p => isFinite(p[0]) && isFinite(p[1])));
    check(fin, 'mark ' + (k + 1) + ' decodes to closed finite rings', rings.length + ' rings');
    const bx = [1e9, 1e9, -1e9, -1e9];
    for (const r of rings) for (const [x, y] of r) { bx[0] = Math.min(bx[0], x); bx[1] = Math.min(bx[1], y); bx[2] = Math.max(bx[2], x); bx[3] = Math.max(bx[3], y); }
    check(bx[0] >= -0.01 && bx[1] >= -0.01 && bx[2] <= m.w + 0.01 && bx[3] <= m.h + 0.01 && bx.every((v, i) => Math.abs(v - m.b[i]) < 0.051),
      'mark ' + (k + 1) + ': its rings are inside its frame and span its ink box', bx.map(v => v.toFixed(2)).join(','));
    // the same art as the cutter's: raster both even-odd over the ink box
    const C = cutD[m.id];
    if (!C) { check(false, 'mark ' + (k + 1) + ' has its svg/ file'); continue; }
    const a = raster(rings, m.b, 256), b = raster(svgRings(C.d), m.b, 256);
    let diff = 0, ink = 0;
    for (let i = 0; i < a.img.length; i++) { diff += a.img[i] !== b.img[i]; ink += b.img[i]; }
    const pct = 100 * diff / a.img.length;
    check(ink > a.img.length * 0.05 && pct <= 0.6, 'mark ' + (k + 1) + ' loads as the cutter\'s art (' + pct.toFixed(2) + '% of the box moved at 256 px)', 'ink ' + ink);
    notes.push(m.id + ' ' + pct.toFixed(2) + '%');
  }

  // 3 DEFAULTS ---------------------------------------------------------------------------------------------------
  const L = A.AERO_VINYL_LDEF, F = A.AERO_VINYL_FIELDS;
  check(A.AERO_VINYL_N === 4 && A.AERO_VINYL_PAGE === 15, 'four sticker slots on atlas page 15');
  let rowsOk = true;
  for (let i = 1; i <= A.AERO_VINYL_N; i++) for (const k of F) if (!(('vn' + i + k) in A.AERO_DEC_DEF) || A.AERO_DEC_DEF['vn' + i + k] !== L[k]) rowsOk = false;
  check(rowsOk && L.On === 0, 'every vn row is in AERO_DEC_DEF at its default, every slot off');
  check(A.aeroVinylLayers(A.aeroDecalMerge({}), 0).length === 0, 'a spec with no rows resolves to no sticker');
  // the editor's own finish code
  {
    const ED = page(SRC, browser(), A);
    ED.finishFromSpec(null);
    const fin0 = ED.finishToSpec();
    check(Object.keys(ED.DEC_DEF).filter(k => /^vn[1-4]/.test(k)).length === 4 * F.length, 'the editor folds the sticker rows into DEC_DEF');
    check(!fin0 || !fin0.decals || !Object.keys(fin0.decals).some(k => /^vn/.test(k)), 'an untouched build exports no sticker row', JSON.stringify(fin0));
    const given = { decals: { vn1On: 1, vn1Mk: 1, vn1Col: 0xc81e1e, vn1H: 0.42, vn1Side: 2, vn1Mir: 1, vn3On: 1, vn3Mk: 11, vn3Tgt: 6, vn3Mode: 1 } };
    ED.finishFromSpec(given);
    const back = ED.finishToSpec();
    check(back && JSON.stringify(back.decals) === JSON.stringify(given.decals), 'the editor round-trips the sticker rows it was given, exactly', JSON.stringify(back && back.decals));
    ED.finishFromSpec(null);
    const back0 = ED.finishToSpec();
    check(!back0 || !back0.decals || !Object.keys(back0.decals).some(k => /^vn/.test(k)), 'a load with none clears them (no sticker follows to the next aeroplane)');
  }

  // 4 OFFICIAL ---------------------------------------------------------------------------------------------------
  {
    const files = [];
    const walk = d => { for (const f of fs.readdirSync(path.join(ROOT, d))) { const p = path.join(d, f);
      if (fs.statSync(path.join(ROOT, p)).isDirectory()) { if (f !== 'lists') walk(p); } else if (f.endsWith('.json') && f !== 'index.json') files.push(p); } };
    walk('builds');
    const specs = [];
    for (const f of files) {
      let j; try { j = JSON.parse(rd(f)); } catch (e) { continue; }
      const s = j && (j.spec || j);
      if (s && typeof s === 'object' && (s.finish || s.cage || s.meta)) specs.push([f, s]);
    }
    // the stock rows: _cage_page5.js's finishes (G1912), by the decal blocks they carry
    const stockVn = /\bvn[1-4](On|Mk|Col|L|C|H|Rot|Tgt|Mode|Side|Mir)\b/.test(SRC.page5);
    check(!stockVn, 'no stock row (_cage_page5.js) carries a sticker row');
    const ED = page(SRC, browser(), A);
    let off = 0;
    for (const [f, s0] of specs) {
      const s = CORE.genNormaliseSpec(JSON.parse(JSON.stringify(s0)));
      const dec = (s.finish && s.finish.decals) || {};
      const vn = Object.keys(dec).filter(k => /^vn/.test(k));
      const D = A.aeroDecalMerge(s);
      const st = A.aeroVinylLayers(D, (s.paint || {}).trim);
      const r = A.aeroDecalsFor(THREE, D, { reg: (s.meta || {}).reg, trim: (s.paint || {}).trim });
      const p15 = r.list.filter(d => d.page === A.AERO_VINYL_PAGE).length;
      if (vn.length || st.length || r.dropped || p15) { off++; fails.push(f + ': ' + JSON.stringify({ vn, stickers: st.length, slots: r.list.length, dropped: r.dropped, p15 })); }
      // saved through the editor: the same finish back
      ED.finishFromSpec(s.finish || null);
      const back = ED.finishToSpec();
      const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, q) => { o[q] = x[q]; return o; }, {}) : x));
      const want = s.finish && s.finish.decals ? s.finish.decals : null, got = back && back.decals ? back.decals : null;
      const strip = d => { if (!d) return null; const o = {}; for (const k in d) if (k !== 'reg' && (k in ED.DEC_DEF) && d[k] != null && d[k] !== ED.DEC_DEF[k]) o[k] = d[k]; return Object.keys(o).length ? o : null; };
      if (canon(strip(want)) !== canon(got)) { off++; fails.push(f + ': saved through the editor, its decals moved: ' + canon(strip(want)).slice(0, 120) + ' -> ' + canon(got).slice(0, 120)); }
    }
    n++;
    if (!off && VERBOSE) console.log('  ok ' + specs.length + ' official / saved builds: no sticker, nothing dropped, the same decals back');
    notes.push(specs.length + ' builds held');
  }

  // 5 PLACEMENT --------------------------------------------------------------------------------------------------
  {
    const Rt = A.AERO_VINYL_RIGHT;
    check(Rt === 1 || Rt === -1, 'AERO_VINYL_RIGHT is a flank sign');
    const S = A.aeroAtlas(THREE).image.width, U = A.aeroSharedU(THREE);
    const mk = (i, o) => Object.assign({ ['vn' + i + 'On']: 1 }, Object.fromEntries(Object.entries(o).map(([k, v]) => ['vn' + i + k, v])));
    const D = A.aeroDecalMerge({ finish: { decals: Object.assign({},
      mk(1, { Mk: 1, Side: 0, Mir: 0, H: 0.4, L: 2.9, C: 0.12, Rot: 0.3, Tgt: 0, Mode: 0 }),
      mk(2, { Mk: 3, Side: 1, Mir: 1, H: 0.25, Tgt: 6, Mode: 1 }),
      mk(3, { Mk: 5, Side: 2, Mir: 0, H: 0.6, Tgt: 4, Mode: 2, Col: 0x123456 }),
      mk(4, { Mk: 10, Side: 2, Mir: 1, H: 0.3, Tgt: 3, Mode: 1 })) } });
    const Ls = A.aeroVinylLayers(D, 0xabcdef);
    check(Ls.length === 4 && Ls.map(l => l.slot).join() === '0,1,2,3', 'four stickers, one per slot');
    const one = Ls.map(l => l.place.one), nm = Ls.map(l => l.place.noMirror);
    const code = sg => (sg > 0 ? 1 : 2);   // a flank's sign -> LIVERY-TEXT's uDecE.z code
    check(one.join() === [0, code(Rt), code(-Rt), code(-Rt)].join() && one.join() === '0,2,1,1', 'sides: both 0, the right flank 2 (-x), the left 1 (+x)', one.join());
    check(nm.join() === '0,1,0,1', 'mirror -> noMirror', nm.join());
    // MEASURED (stickers_shot.js --probe, 9 Nov): +x is the left flank and reads a noMirror decal as drawn, so the right
    // is -1 and a mirrored sticker's cell is drawn flipped (the right flank as drawn, the left the mirror)
    check(Rt === -1, 'the right flank is -x (the probe\'s measurement)', String(Rt));
    check(Ls.map(l => l.flip).join() === '0,1,0,1', 'a mirrored sticker\'s cell is drawn flipped (the right flank reads as drawn)', Ls.map(l => l.flip).join());
    check(JSON.stringify(Ls[1].place.on) === JSON.stringify({ tail: 1, stab: 0 }) && Ls[1].place.mode === 'side' &&
          JSON.stringify(Ls[2].place.on) === JSON.stringify({ wing: 1 }) && Ls[2].place.mode === 'plan', 'goes on / projected as: the livery layer\'s tables');
    check(Ls[2].col === 0x123456 && Ls[0].col === 0xabcdef, 'the picked colour, and the trim when unset');
    const cells = [];
    for (const l of Ls) {
      const h0 = l.place.h, w0 = l.place.w, c = A.aeroVinylCell(l.slot, l.asp, S);
      const M = A.AERO_VINYL_MARKS[l.mk], asp = (M.b[2] - M.b[0]) / (M.b[3] - M.b[1]);
      check(Math.abs(w0 - h0 * asp) < 1e-9, 'sticker ' + (l.slot + 1) + ': width = size x the mark\'s aspect');
      A.aeroVinylRect(l, S);
      check(Math.abs(l.place.h * c.dh / (c.dh + 2 * c.M) - h0) < 1e-9 && Math.abs(l.place.w * c.dw / (c.dw + 2 * c.M) - w0) < 1e-9,
        'sticker ' + (l.slot + 1) + ': the ink is the size row exactly (the cell\'s margin grown out)');
      const r = l.place.rect, P = 1 / A.AERO_ATLAS_N, pr = A.aeroPageRect(A.AERO_VINYL_PAGE);
      const inPage = r[0] >= pr[0] - 1e-9 && r[1] >= pr[1] - 1e-9 && r[0] + r[2] <= pr[0] + P + 1e-9 && r[1] + r[3] <= pr[1] + P + 1e-9;
      const cx = pr[0] + (l.slot % 2) * P / 2, cyTop = pr[1] + P - Math.floor(l.slot / 2) * P / 2;   // the cell in uv (flipY)
      const inCell = r[0] >= cx - 1e-9 && r[0] + r[2] <= cx + P / 2 + 1e-9 && r[1] + r[3] <= cyTop + 1e-9 && r[1] >= cyTop - P / 2 - 1e-9;
      check(inPage && inCell, 'sticker ' + (l.slot + 1) + ': its rect is its own cell of page 15', JSON.stringify(r));
      cells.push(r);
    }
    let disjoint = true;
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      if (a[0] < b[0] + b[2] - 1e-9 && b[0] < a[0] + a[2] - 1e-9 && a[1] < b[1] + b[3] - 1e-9 && b[1] < a[1] + a[3] - 1e-9) disjoint = false;
    }
    check(disjoint, 'the four cells are disjoint');
    // the order and the worst case
    const worst = Object.assign({}, D);
    for (let i = 1; i <= 5; i++) worst['m' + i + 'On'] = 1;
    worst.wregOn = 1;
    W0.AERO_EXTRA_DECALS = () => [{ page: 6, sL: 1, sC: 0, w: 0.5, h: 0.1, one: 1 }, { page: 7, sL: 1, sC: 0, w: 0.25, h: 0.25 }];
    const r = A.aeroDecalsFor(THREE, worst, { reg: 'N1938J', trim: 0x111111 });
    W0.AERO_EXTRA_DECALS = null;
    const pages = r.list.map(d => d.page);
    check(r.list.length === 13 && r.dropped === 0 && A.AERO_MAXD === 15, 'the worst case today (5 kit + 4 stickers + 2 registrations + strip + master = 13) is kept whole inside the cap of 15', pages.join(','));
    const firstSt = pages.indexOf(15), lastSt = pages.lastIndexOf(15), lastKit = Math.max(...[3, 4, 5, 1, 2].map(p => pages.lastIndexOf(p))), reg = pages.indexOf(0);
    check(lastKit < firstSt && lastSt < reg, 'the paint order: the kit, then the stickers, then the registration', pages.join(','));
    A.aeroSetDecals(THREE, r.list);
    const ez = [], cw = [], bs = [];
    for (let i = 0; i < U.uDecN.value; i++) if (r.list[i].page === 15) { ez.push(U.uDecE.value[i].z); cw.push(U.uDecC.value[i].w); bs.push(U.uDecB.value[i].toArray().map(v => +v.toFixed(6)).join(',')); }
    check(ez.join() === '0,2,1,1' && cw.join() === '0,1,0,1', 'aeroSetDecals hands the sides (uDecE.z) and the mirror (uDecC.w)', ez.join() + ' / ' + cw.join());
    check(bs.join(';') === cells.map(c => c.map(v => +v.toFixed(6)).join(',')).join(';'), 'aeroSetDecals hands each sticker its cell\'s rect (uDecB)');
    // parked.js's usedPages (a parked aeroplane's atlas copy holds the pages its block reads): the sticker cells map to
    // page 15 and every whole page to itself
    {
      const fn = grab(SRC.parked, /^ {2}function usedPages\(/m, 'parked.js usedPages').text;
      const used = vm.runInNewContext('(' + fn.trim().replace(/^function usedPages/, 'function') + ')');
      const got = used({ AERO_ATLAS_N: A.AERO_ATLAS_N }, U).join(',');
      const want = [...new Set(r.list.map(d => d.page))].sort((a, b) => a - b).join(',');
      check(got === want, 'parked.js reads the block\'s pages back right, the sticker cells as page 15', got + ' vs ' + want);
    }
    // WITH LIVERY-TEXT'S SIX PIECES ON (the real worst case since L39): 4 fixed + 6 text = 10 kept, the other 5 slots to the
    // four stickers and the first kit layer - the kit gives way first, then the stickers; nothing over 15
    if (A.AERO_TXT_N) {
      const wt = Object.assign({}, worst);
      for (let i = 1; i <= A.AERO_TXT_N; i++) { wt['t' + i + 'On'] = 1; wt['t' + i + 'Txt'] = 'ALASKA ' + i; }
      W0.AERO_EXTRA_DECALS = () => [{ page: 6, sL: 1, sC: 0, w: 0.5, h: 0.1, one: 1 }, { page: 7, sL: 1, sC: 0, w: 0.25, h: 0.25 }];
      let t = null; try { t = A.aeroDecalsFor(THREE, wt, { reg: 'N1938J', trim: 0x111111 }); } catch (e) { t = { err: String(e) }; }
      W0.AERO_EXTRA_DECALS = null;
      const pg = t && t.list ? t.list.map(d => d.page) : [];
      const txtN = pg.filter(p => p >= 8 && p <= 13).length, stN = pg.filter(p => p === 15).length, kitN = pg.filter(p => [1, 2, 3, 4, 5].includes(p)).length;
      check(pg.length === 15 && txtN === 6 && stN === 4 && kitN === 1 && pg[0] === 3 && t.dropped === 4 &&
            pg.indexOf(15) > pg.indexOf(3) && pg.lastIndexOf(15) < pg.findIndex(p => p >= 8 && p <= 13),
        'with six text pieces on: 15 slots - the text and the fixed kept, the four stickers, the first kit layer; 4 dropped; paint order kit, stickers, text', t && t.err ? t.err : pg.join(',') + ' dropped ' + t.dropped);
    }
    // stickers are a distance field that is NOT lettering (uDecE.x 2: a float takes them); the registration's is (1)
    { const ex = r.list.map((d, i) => d.page === 15 ? U.uDecE.value[i].x : null).filter(v => v != null);
      const er = r.list.map((d, i) => d.page === 0 ? U.uDecE.value[i].x : null).filter(v => v != null);
      check(ex.length === 4 && ex.every(v => v === 2) && er.length === 2 && er.every(v => v === 1), 'uDecE.x: 2 for a sticker (floats take it), 1 for the registration (floats decline it)', ex.join() + ' / ' + er.join()); }
    // THE BUDGET (the user's cap of 15): more fixed markings than today forces the trim - the fixed ones are all kept, the
    // kit gives way first (its last layers), then the stickers (their last slots); `dropped` counts what found no slot
    for (const [nx, want] of [[6, { kit: [3, 4, 5], st: 4, drop: 2 }], [9, { kit: [], st: 4, drop: 5 }], [12, { kit: [], st: 1, drop: 8 }]]) {
      W0.AERO_EXTRA_DECALS = () => Array.from({ length: nx }, (_, i) => ({ page: 6, sL: i, sC: 0, w: 0.1, h: 0.1 }));
      const t = A.aeroDecalsFor(THREE, worst, { reg: 'N1938J', trim: 0x111111 });
      W0.AERO_EXTRA_DECALS = null;
      const pg = t.list.map(d => d.page);
      const kitP = pg.filter(p => [1, 2, 3, 4, 5].includes(p)), stN = pg.filter(p => p === 15).length, fixN = pg.filter(p => p === 0 || p === 6).length;
      const firstSt = t.list.find(d => d.page === 15);
      check(t.list.length <= A.AERO_MAXD && fixN === 2 + nx && kitP.join() === want.kit.join() && stN === want.st && t.dropped === want.drop &&
            (!firstSt || JSON.stringify(firstSt.rect) === JSON.stringify(cells[0])),
        'the budget with ' + nx + ' more fixed markings: every fixed one kept, the kit then the stickers give way from the last', pg.join(',') + ' dropped ' + t.dropped);
    }
    const rf = r.list.filter(d => d.page !== 15).map(d => d.rect).filter(Boolean);
    check(rf.length === 0, 'no other decal carries a rect (pages 0-14 are untouched)');
  }

  // 6 THE DRAW ---------------------------------------------------------------------------------------------------
  {
    const W = skinOf(SRC, { marks: true }), B = W.AEROSKIN;
    const atlas = B.aeroAtlas(THREE), cv = atlas.image, R = cv.getContext('2d').__R;
    const D = B.aeroDecalMerge({ finish: { decals: { vn2On: 1, vn2Mk: 8, vn2H: 0.5, vn2Col: 0x2a7f3e } } });
    const Ls = B.aeroVinylLayers(D, 0x101010), Lr = Ls[0];
    const k0 = R.ops.length, f0 = R.fills.length;
    check(B.aeroVinylDraw(THREE, Lr) === true, 'a sticker draws its cell');
    const ops = R.ops.slice(k0).filter(o => o[0] !== 'begin');
    const c = B.aeroVinylCell(Lr.slot, Lr.asp, cv.width);
    // the atlas pass's points (the first of the two traces: the atlas, then the field's scratch canvas)
    const nPts = B.aeroVinylRings(W.LIVERY_MARKS, 8).reduce((s, r) => s + r.length, 0);
    const pts = ops.slice(0, nPts);
    const bx = [1e9, 1e9, -1e9, -1e9];
    for (const [, x, y] of pts) { bx[0] = Math.min(bx[0], x); bx[1] = Math.min(bx[1], y); bx[2] = Math.max(bx[2], x); bx[3] = Math.max(bx[3], y); }
    check(pts.length === nPts && Math.abs(bx[0] - c.x) < 0.01 && Math.abs(bx[1] - c.y) < 0.01 && Math.abs(bx[2] - (c.x + c.dw)) < 0.01 && Math.abs(bx[3] - (c.y + c.dh)) < 0.01,
      'the mark is traced inside its slot\'s ink box and touches its four sides (fitted, aspect kept)', bx.map(v => v.toFixed(1)).join(',') + ' vs ' + [c.x, c.y, c.x + c.dw, c.y + c.dh].map(v => v.toFixed(1)).join(','));
    const fl = R.fills.slice(f0);
    check(fl.length >= 1 && fl[0].rule === 'evenodd' && /^#2a7f3e$/i.test(fl[0].style), 'filled even-odd in the picked colour', JSON.stringify(fl[0]));
    check(B.aeroVinylDraw(THREE, Lr) === false, 'drawn again only when the mark, colour or flip changes');
    // a colour change repaints the colour over the KEPT field: no scratch canvas, no distance transform (~130 ms at 4096)
    { const nc = CANVASES.length, f1 = R.fills.length;
      check(B.aeroVinylDraw(THREE, Object.assign({}, Lr, { col: 0x334455 })) === true && CANVASES.length === nc && /^#334455$/i.test((R.fills[f1] || {}).style),
        'a colour change repaints over the kept field (no new distance transform)', (CANVASES.length - nc) + ' canvases');
      B.aeroVinylDraw(THREE, Lr); }
    // the flip mirrors the trace about the box's middle
    const Lf = Object.assign({}, Lr, { flip: 1 });
    const k1 = R.ops.length;
    B.aeroVinylDraw(THREE, Lf);
    const pf = R.ops.slice(k1).filter(o => o[0] !== 'begin').slice(0, nPts);
    check(pf.length === nPts && pf.every((p, i) => Math.abs((p[1] - c.x) - (c.dw - (pts[i][1] - c.x))) < 1e-6 && Math.abs(p[2] - pts[i][2]) < 1e-6), 'the flip mirrors the mark in its box');
    // the trim when unset
    const Lt = B.aeroVinylLayers(B.aeroDecalMerge({ finish: { decals: { vn1On: 1 } } }), 0x101010)[0];
    const f2 = R.fills.length; B.aeroVinylDraw(THREE, Lt);
    check(R.fills[f2] && /^#101010$/i.test(R.fills[f2].style), 'an unset colour follows the trim');
    // no geometry: an empty cell, and the lazy file asked for once
    const W2 = skinOf(SRC, { marks: false }), C2 = W2.AEROSKIN, R2 = C2.aeroAtlas(THREE).image.getContext('2d').__R;
    const L2 = C2.aeroVinylLayers(C2.aeroDecalMerge({ finish: { decals: { vn1On: 1 } } }), 0)[0];
    C2.aeroVinylDraw(THREE, L2); C2.aeroVinylDraw(THREE, Object.assign({}, L2, { col: 1 }));
    const cc = C2.aeroVinylCell(0, L2.asp, C2.aeroAtlas(THREE).image.width);
    check(R2.fills.length === 0 && R2.clears.some(q => q[0] === cc.px && q[1] === cc.py), 'with no geometry the cell is cleared, nothing drawn');
    check(W2.__lazy.length === 1 && W2.__lazy[0] === 'livery_marks', 'the lazy file is asked for once', JSON.stringify(W2.__lazy));
  }

  // 7 SOURCE -----------------------------------------------------------------------------------------------------
  // (LIVERY-TEXT's convention, on master since L39: uDecE.z 1 = the +x side, 2 = the -x side - the stickers use it as is)
  check(/float aSg = \(aOne > 1\.5\) \? -1\.0 : 1\.0;/.test(SRC.skin) && /step\(-0\.02, aeroA\.x \* aSg\) \* step\(0\.0, vCraftNrm\.x \* aSg\)/.test(SRC.skin) &&
        /mix\(1\.0, aSide, step\(0\.5, aOne\)\)/.test(SRC.skin), 'the shader\'s one-side test: 1 the +x side, 2 the -x side');
  check(/d\.one === true \? 1 : Math\.max\(0, Math\.min\(2, Math\.round\(\+d\.one \|\| 0\)\)\)/.test(SRC.skin), 'aeroSetDecals hands the side code (0 / 1 / 2)');
  check(/const AERO_MAXD = 15;/.test(SRC.skin) && /#define AERO_MAXD 15\n/.test(SRC.skin), 'both AERO_MAXDs are 15 (the user\'s cap)');
  check(/float aLet = step\(0\.5, uDecE\[di\]\.x\) \* step\(uDecE\[di\]\.x, 1\.5\);/.test(SRC.skin) && /\(1\.0 - aLet \* step\(uDecOk, 0\.75\)\)/.test(SRC.skin) &&
        /float aSdf = step\(0\.5, uDecE\[di\]\.x\);/.test(SRC.skin), 'the shader: a float declines letters (uDecE.x 1) and takes a sticker (2); both thresholded as a field');
  check(/\['src\/viewer', 'livery_marks\.js'\]/.test(SRC.build) && /lazy: \[/.test(SRC.build), 'livery_marks.js is in build.js MANIFEST.lazy');
  check(/FLYDIY_LAZY\('livery_marks'\)/.test(SRC.skin), 'aeroskin asks the lazy loader for it');
  check(/await A\.aeroVinylWait\(spec\)/.test(SRC.flown), 'the flown bake waits for the marks before it draws (its cache is keyed by the build)');
  if (SRC === SRC0) {
    const idx = rd('index.html');
    check(/"livery_marks":"src\/viewer\/livery_marks\.js/.test(idx), 'index.html\'s loader knows livery_marks');
    check(!/LIVERY_MARKS = \{ v: 1/.test(idx) && idx.indexOf((G.marks[1].r[0] || '').slice(0, 40)) < 0, 'index.html inlines no mark geometry');
  }
  check(/DECG\.cur = 'vny';/.test(SRC.ui) && /for \(let li = 1; li <= A\.AERO_VINYL_N; li\+\+\)/.test(SRC.ui) && /det\.dataset\.dec = 'vny';/.test(SRC.ui),
    'the panel builds AERO_VINYL_N sticker blocks (data-dec vny)');
  // THE FIRST PLACE (the user: "in the middle of the fuselage"): the editor's own decVinylFirstPlace, run on a measured box
  {
    const fn = grab(SRC.ui, /^function decVinylFirstPlace\(/m, '_cage_ui.js decVinylFirstPlace').text;
    const run1 = (D, box) => { const W = { Math, Number, DEC: D, DEC_DEF: Object.assign({}, A.AERO_DEC_DEF), SYNC: {}, AK: () => A, decFitScan: () => box, out: null };
      vm.createContext(W); vm.runInContext(fn + '\nout = decVinylFirstPlace("vn2");', W); return W.out; };
    const box = [[[0.4, 5.2, -0.6, 0.9], [0, 0, 0, 0], [0, 0, 0, 0]]];
    const D1 = Object.assign({}, A.AERO_DEC_DEF, { vn2On: 1 });
    const ok1 = run1(D1, box);
    const wantC = -Math.round((A.AERO_DEC_DEF.vn2H / 2 + 0.03) * 100) / 100;
    check(ok1 === true && D1.vn2L === 2.8 && D1.vn2C === wantC && wantC < -0.1, 'a slot switched on goes to the middle of the fuselage (the field box\'s mid-length, its top just under the waist)', JSON.stringify({ L: D1.vn2L, C: D1.vn2C }));
    const D2 = Object.assign({}, A.AERO_DEC_DEF, { vn2On: 1, vn2L: 1.1 });
    check(run1(D2, box) === false && D2.vn2L === 1.1, 'a placement the player already moved is left alone');
    const D3 = Object.assign({}, A.AERO_DEC_DEF, { vn2On: 1 });
    check(run1(D3, null) === false && D3.vn2L === A.AERO_DEC_DEF.vn2L, 'no geometry: the defaults stand');
    check(/decVinylFirstPlace\(q\); \} redo\(\); \}, det\);/.test(SRC.ui) && /SYNC\[q \+ 'On'\]\(\); decVinylFirstPlace\(q\); \}/.test(SRC.ui),
      'the on tick and a mark button that switches a slot on both place it');
  }
  check(/by\.vny/.test(SRC.editor) && /emitEls\(p0, 'stickers', by\.vny/.test(SRC.editor), 'the finish view heads them "stickers"');
  return { fails, n, notes };
}

if (process.argv.includes('--selftest')) {
  // each probe breaks one thing the gate holds; each must turn it red
  const P = [
    ['the side code dropped from the shader', { skin: s => s.replace('float aSg = (aOne > 1.5) ? -1.0 : 1.0;', 'float aSg = 1.0;') }],
    ['a slot on by default', { skin: s => s.replace("  On: 0, Mk: 0, Col: null,", "  On: 1, Mk: 0, Col: null,") }],
    ['the left side mapped to the right', { skin: s => s.replace("one: side === 0 ? 0 : ((side === 1 ? AERO_VINYL_RIGHT : -AERO_VINYL_RIGHT) > 0 ? 1 : 2),", "one: side === 0 ? 0 : 2,") }],
    ['a mark\'s ink box moved', { skin: s => s.replace("{ id: 'orca', name: 'Orca', b: [4, 58.1, 236, 224] }", "{ id: 'orca', name: 'Orca', b: [4, 50, 236, 224] }") }],
    ['the margin not grown out', { skin: s => s.replace("L.place.w = L.place.w * c.grow[0]; L.place.h = L.place.h * c.grow[1];", "") }],
    ['the stickers under the kit', { skin: s => s.replace("const out = { list: kit.slice(0, keepK).concat(vinyl.slice(0, keepV), list), aspect,", "const out = { list: vinyl.slice(0, keepV).concat(kit.slice(0, keepK), list), aspect,") }],
    ['AERO_MAXD at 19 (the sum, not the cap)', { skin: s => s.replace('const AERO_MAXD = 15;', 'const AERO_MAXD = 19;').replace('#define AERO_MAXD 15', '#define AERO_MAXD 19') }],
    ['the stickers give way before the kit', { skin: s => s.replace('const keepV = Math.min(vinyl.length, room), keepK = Math.min(kit.length, room - keepV);', 'const keepK = Math.min(kit.length, room), keepV = Math.min(vinyl.length, room - keepK);') }],
    ['stickers as letters (floats decline them)', { skin: s => s.replace("rough: -0.06, sdf: 2, metal: 0,", "rough: -0.06, sdf: 1, metal: 0,") }],
    ['the first place off the middle', { ui: s => s.replace("DEC[q + 'L'] = +((f[0] + f[1]) / 2).toFixed(2);", "DEC[q + 'L'] = +f[1].toFixed(2);") }],
    ['the first place centred on the waist', { ui: s => s.replace("DEC[q + 'C'] = -Math.round(((+DEC[q + 'H'] || 0.35) / 2 + 0.03) * 100) / 100;", "DEC[q + 'C'] = 0;") }],
    ['the editor not folding the rows', { ui: s => s.replace("        if (!(key in DEC_DEF)) DEC_DEF[key] = A.AERO_VINYL_LDEF[k];", "") }],
    ['the lazy entry dropped', { build: s => s.replace("['src/viewer', 'livery_marks.js']", "['src/viewer', 'livery_marks_x.js']") }],
    ['parked.js back on the corner', { parked: s => s.replace("const px = Math.floor((r.x + r.z / 2) * N), py = N - 1 - Math.floor((r.y + r.w / 2) * N);", "const px = Math.round(r.x * N), py = N - 1 - Math.round(r.y * N);") }],
    ['the fill rule nonzero', { skin: s => s.replace("g.fillStyle = hex; g.fill('evenodd');", "g.fillStyle = hex; g.fill();") }],
  ];
  let ok = true;
  for (const [nm, patch] of P) {
    const S = Object.assign({}, SRC0);
    let changed = false;
    for (const k in patch) { const v = patch[k](S[k]); if (v !== S[k]) changed = true; S[k] = v; }
    let red;
    try { red = run(S).fails.length > 0; } catch (e) { red = true; }
    if (!red || !changed) ok = false;
    console.log('  selftest ' + (red ? 'RED  ' : 'GREEN') + ' ' + nm + (changed ? '' : ' (the patch did not apply)'));
  }
  console.log('GATE LIVERYSTICKERS selftest: ' + (ok ? 'PASS (every probe red)' : 'FAIL'));
  process.exit(ok ? 0 : 1);
}
const r = run(SRC0);
for (const f of r.fails) console.log('  FAIL ' + f);
console.log('  ' + r.notes.join('; '));
console.log('  ' + (r.n - r.fails.length) + ' / ' + r.n + ' checks');
console.log('GATE LIVERYSTICKERS: ' + (r.fails.length ? 'FAIL (' + r.fails.length + ' of ' + r.n + ')' : 'PASS'));
process.exit(r.fails.length ? 1 : 0);
