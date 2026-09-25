// world_rail.js - THE WORLD RAIL: the right-hand rail of the world's art (2026-09-24)
//
// The user: "everything related to normal flight operations should be on the left rail, and everything
// related to world editing should be on the right rail ... There's art to be done now, and it needs proper
// tools." The left rail flies; this one paints. Its structure is the TERRAIN TYPE: the island's map says
// what kind of ground a point is (island_prep's ttype, 0-11, and the three the splat derives - cliff, old
// forest, dense scrub), and a type names two things -
//   a BIOME   (28c_biomes.js: a bench mix - trees, bushes, grass & flowers, stones, debris; each species
//             with its own numbers), planted by the fill, the stands and the cover ring;
//   a GROUND  (splat_ground.js: up to three DETAIL sets near, three AERIAL sets past the detail fade, a
//             cloud mask between them, then the imagery's stack as the macro), each set graded and
//             recoloured in the library.
// Sections, top to bottom on the rail:
//   COVERAGE   the global map: the stack as layers (eye, blend, opacity, solo), the terrain-type map, the
//              global colour
//   TYPES      one terrain type: its biome and its ground
//   MATERIALS  the library of ground sets, side by side at one scale, each set's grade and recolour
//   FILTERING  tiling, blending, distance, the texture filtering (mip bias, anisotropy, the normal's fade,
//              specular anti-alias, the detail's contrast)
//   VEGETATION the fill's rule and the cover ring
//   CLIFFS     the photoscanned cliff faces and the rocks at distance
//   SCENERY    the scenery editor (premises_ui.js, the old "world editor") and the maps
//   EXPORT     every setting in one JSON, the changes against the defaults, import, reset
//
// It owns no rendering state: every control is a getter/setter over a handle the world publishes
// (WORLD.ground, its splat and rock map, TREE_FILL, TREE_LEAF, WORLD.envAlbedo), exactly as F8 did.
// What those handles do not persist themselves (the ground's colour knobs, the biomes, the ring, the
// species sizes and tints, the cliffs) this file keeps as THE LOOK (localStorage flydiy.worldlook.v1) and
// puts back when the world is up. F9 shows or hides the rail; ?scenery=1 (app.js) opens it with the
// flight held. Alt+click on the ground picks the terrain type under the mouse.
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const W = window;
  const LOOK_KEY = 'flydiy.worldlook.v1', UI_KEY = 'flydiy.worldrail.ui';

  // ---- small things ---------------------------------------------------------------------------
  const $ = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const UI = Object.assign({ shown: false, sec: 'cover', wide: false, code: 2, tab: 'biome', folds: {}, lib: null, cmpM: 16, cmp: false }, lsGet(UI_KEY, {}));
  const saveUI = () => lsSet(UI_KEY, UI);
  const fmt = (v, d) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d === undefined ? 2 : d));

  // ---- the world's handles --------------------------------------------------------------------
  const WF = () => W.WORLD || null;
  const G = () => (WF() && WF().ground) || null;
  const SP = () => { const g = G(); return (g && g.splat && g.splat()) || null; };
  const TF = () => W.TREE_FILL || null;
  const BIO = () => { const t = TF(); return (t && t.biomes && t.biomes()) || null; };
  const ISL = () => { const fp = W.FLIGHT_PROBE, w = fp && fp.world && fp.world(); return (w && w.island) || null; };
  const PACK = () => W.TREE_PACK || W.TREE_PACK_REG || null;
  const RING = () => { const t = TF(); return (t && t.cover && t.cover()) || null; };
  const CLF = () => { const g = G(); return (g && g.cliffs && g.cliffs()) || null; };
  const RMAP = () => { const g = G(); return (g && g.rockMap && g.rockMap()) || null; };
  const ready = () => !!(WF() && G() && G().on && G().on());

  // ---- THE TERRAIN TYPES: names, colours (the ground's own palette, gTTCol) and the derivations ----
  const NAMES = { 0: 'sea', 1: 'lake', 2: 'heath', 3: 'muskeg', 4: 'sand', 5: 'scree', 6: 'rock', 7: 'scrub', 8: 'forest', 9: 'snow', 10: 'built', 11: 'shingle', 12: 'cliff', 13: 'forest old', 14: 'scrub dense' };
  const TTC = { 0: [5, 13, 77], 1: [13, 89, 242], 2: [191, 217, 64], 3: [89, 140, 38], 4: [242, 217, 140], 5: [140, 128, 115], 6: [77, 71, 71],
                7: [153, 166, 13], 8: [5, 89, 13], 9: [250, 250, 255], 10: [242, 26, 26], 11: [168, 156, 132], 12: [120, 104, 98], 13: [3, 61, 8], 14: [111, 122, 10] };
  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const DERIVED = { 12: { from: 6, lo: 'cliffLo', hi: 'cliffHi', unit: '°', what: 'rock steeper than', max: 70 },
                    13: { from: 8, lo: 'oldLo', hi: 'oldHi', unit: ' m', what: 'forest under a canopy taller than', max: 35 },
                    14: { from: 7, lo: 'denseLo', hi: 'denseHi', unit: ' m', what: 'scrub under a canopy taller than', max: 6 } };
  const PARENT_OF = { 12: 6, 13: 8, 14: 7 };
  const EDITABLE = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  // the catalogue's kinds, as the user's five categories (+ the cliffs, their own section)
  const CATS = [
    { k: 'trees', label: 'trees', kinds: ['tree', 'dead'] },
    { k: 'bushes', label: 'bushes', kinds: ['shrub'] },
    { k: 'grass', label: 'grass & flowers', kinds: ['cover'] },
    { k: 'stones', label: 'stones', kinds: ['rock'] },
    { k: 'debris', label: 'debris', kinds: ['debris'] },
  ];
  const kindOf = name => { const P = PACK(); const c = P && P.collections.find(q => q.name === name); return c ? (c.kind || 'tree') : '?'; };
  const pretty = name => name.replace(/\.glb$/, '').replace(/_trees_pack_lods_gameready|realistic_|_-_free_download/g, '').replace(/_/g, ' ');

  // ---- THE DEFAULTS, for the diff (taken at load, before any look is put back) ------------------
  const DEF = { biomes: null, ground: null, stack: null, island: null, ring: null, env: null, cliffs: null };
  const takeDefaults = () => {
    const P = PACK(); if (P && P.biomes && !DEF.biomes) DEF.biomes = clone({ map: P.biomes.map, mixes: P.biomes.mixes });
    const g = G(); if (g && !DEF.ground) { DEF.ground = clone(g.get()); DEF.stack = clone(g.stack()); }
    const t = TF(); if (t && t.island && !DEF.island) DEF.island = clone(t.island());
    const r = RING(); if (r && !DEF.ring) DEF.ring = clone(r.get());
    const c = CLF(); if (c && !DEF.cliffs) DEF.cliffs = clone(c.get());
    if (WF() && WF().envAlbedo && DEF.env === null) DEF.env = WF().envAlbedo();
  };

  // ---- THE LOOK: what the handles do not keep, kept here ----------------------------------------
  const GROUND_KEYS = ['light', 'sat', 'shore', 'classBlur', 'edgeWobble', 'snow', 'waterMap'];
  let saveT = 0;
  const lookNow = () => {
    const o = {};
    const g = G(); if (g) { const q = g.get(); o.ground = {}; for (const k of GROUND_KEYS) if (k in q) o.ground[k] = q[k]; }
    if (WF() && WF().envAlbedo) o.envAlbedo = WF().envAlbedo();
    const t = TF(); if (t) { if (t.island) o.island = t.island(); if (t.speciesSizes) o.speciesSize = t.speciesSizes(); if (t.get) o.fillDensity = t.get(); if (t.thin) o.thin = t.thin(); }
    const B = BIO(); if (B) o.biomes = { map: clone(B.map), mixes: clone(B.mixes) };
    const r = RING(); if (r) o.ring = r.get();
    const c = CLF(); if (c) o.cliffs = c.get();
    const L = W.TREE_LEAF; if (L && L.collections) { o.tints = {}; for (const col of L.collections()) if (col.tint && Object.keys(col.tint).length) o.tints[col.name] = clone(col.tint); if (L.master) o.leafMaster = clone(L.master()); }
    if (W.TREE_MIX) o.treeMix = { furnished: W.TREE_MIX.furnished, spread: W.TREE_MIX.spread };
    return o;
  };
  const saveLook = () => { clearTimeout(saveT); saveT = setTimeout(() => lsSet(LOOK_KEY, lookNow()), 250); };
  const applyLook = (o, full) => {
    if (!o) return;
    const g = G(); if (g && o.ground) g.set(o.ground);
    if (o.stack && g) o.stack.forEach((l, i) => g.setLayer(i, { on: l.on, mode: l.mode, op: l.op }));
    if (o.splat && SP()) SP().load(o.splat);
    if (o.envAlbedo !== undefined && WF() && WF().envAlbedo) WF().envAlbedo(o.envAlbedo);
    const t = TF();
    if (t) {
      if (o.island && t.setIsland) t.setIsland(o.island);
      if (o.speciesSize && t.speciesSize) { for (const k in t.speciesSizes()) if (!(k in o.speciesSize)) t.speciesSize(k, 1); for (const k in o.speciesSize) t.speciesSize(k, o.speciesSize[k]); }
      if (o.fillDensity && t.set) t.set(o.fillDensity);
      if (o.thin && t.thin) t.thin(o.thin[0], o.thin[1]);
    }
    const B = BIO();
    if (B && o.biomes && t) {
      if (o.biomes.mixes) for (const name in o.biomes.mixes) B.mixes[name] = clone(o.biomes.mixes[name]);
      if (full && o.biomes.mixes) for (const name of Object.keys(B.mixes)) if (!(name in o.biomes.mixes) && DEF.biomes && !(name in DEF.biomes.mixes)) delete B.mixes[name];
      const map = o.biomes.map || o.biomes.biomes;
      if (map) for (let c = 0; c <= 14; c++) t.setBiome(c, map[c] || null);
      const any = Object.keys(B.mixes)[0]; if (any) t.setMix(any, ['forest', 'count'], (B.mixOf(any).forest || {}).count || 0);   // replant once
    }
    const r = RING(); if (r && o.ring) r.set(o.ring);
    const c = CLF(); if (c && o.cliffs) c.set(o.cliffs);
    const L = W.TREE_LEAF;
    if (L && o.tints && L.tintOf) for (const n in o.tints) L.tintOf(n, o.tints[n]);
    if (L && o.leafMaster && L.tint) L.tint(o.leafMaster);
    if (W.TREE_MIX && o.treeMix) { Object.assign(W.TREE_MIX, o.treeMix); if (W.TREE_MIX.apply) W.TREE_MIX.apply(); }
  };

  // ---- THE EXPORT: everything, the changes against the defaults, and where each part goes -----------
  const flatten = (o, p, out) => { out = out || {}; if (o === null || typeof o !== 'object') { out[p] = o; return out; }
    if (Array.isArray(o)) { out[p] = JSON.stringify(o); return out; }
    for (const k of Object.keys(o)) flatten(o[k], p ? p + '.' + k : k, out); return out; };
  const diff = (a, b, prefix) => {
    const A = flatten(a || {}, ''), B = flatten(b || {}, ''), out = [];
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[k], y = B[k];
      if (x === y) continue;
      if (typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) < 1e-9) continue;
      out.push({ path: prefix + '.' + k, was: x === undefined ? '(none)' : x, now: y === undefined ? '(removed)' : y });
    }
    return out;
  };
  const exportAll = () => {
    const L = lookNow(), sp = SP(), g = G();
    const recipe = (typeof GROUND_FIELDS !== 'undefined') ? GROUND_FIELDS.RECIPE : null;
    const out = {
      flydiy_world_look: 1,
      date: new Date().toISOString(),
      world: (W.ISLAND_BOOT && W.ISLAND_BOOT.id) || W.FLYDIY_WORLD || null,
      where: {
        splat: 'src/core/28b_ground_fields.js RECIPE (codes, knobs, grade)',
        biomes: 'tools/_trees_tuning.json { biomes, mixes }, then python tools/tree_prep.py',
        stack: 'src/viewer/render_world.js STACK', ground: 'src/viewer/render_world.js GROUND',
        island: 'src/viewer/render_world.js FILL.island', ring: 'src/viewer/cover_ring.js defaults', cliffs: 'src/viewer/cliffs.js S',
        speciesSize: 'render_world.js SP_SIZE (new)', tints: 'tools/_trees_tuning.json per-collection tint',
      },
      splat: sp ? sp.state() : null,
      stack: g ? g.stack() : null,
    };
    Object.assign(out, L);
    const ch = [];
    if (recipe && out.splat) {
      // the grades compared through their defaults (a set touched once carries every key), macroExp left out (the game derives it)
      const GD = { gain: '#ffffff', sat: 1, gloss: 1, hue: 0, contrast: 1, selHue: 0, selWidth: 0, selShift: 0, selSat: 1, selLight: 1, selSoft: 0.5 };
      const keys = new Set([...Object.keys(recipe.grade || {}), ...Object.keys(out.splat.grade || {})]);
      const norm = gr => { const o = {}; for (const k of keys) o[k] = Object.assign({}, GD, (gr || {})[k] || {}); return o; };
      const kb = Object.assign({}, sp.filterDefaults(), recipe.knobs), kn = Object.assign({}, out.splat.knobs); delete kb.macroExp; delete kn.macroExp;
      ch.push(...diff({ codes: recipe.codes, knobs: kb, grade: norm(recipe.grade) }, { codes: out.splat.codes, knobs: kn, grade: norm(out.splat.grade) }, 'splat'));
    }
    if (DEF.stack && out.stack) ch.push(...diff(DEF.stack, out.stack, 'stack'));
    if (DEF.ground && out.ground) { const b = {}; for (const k of GROUND_KEYS) b[k] = DEF.ground[k]; ch.push(...diff(b, out.ground, 'ground')); }
    if (DEF.biomes && out.biomes) ch.push(...diff(DEF.biomes, out.biomes, 'biomes'));
    if (DEF.island && out.island) ch.push(...diff(DEF.island, out.island, 'island'));
    if (DEF.ring && out.ring) ch.push(...diff(DEF.ring, out.ring, 'ring'));
    if (DEF.cliffs && out.cliffs) ch.push(...diff(DEF.cliffs, out.cliffs, 'cliffs'));
    if (DEF.env !== null && out.envAlbedo !== undefined && Math.abs(DEF.env - out.envAlbedo) > 1e-9) ch.push({ path: 'envAlbedo', was: DEF.env, now: out.envAlbedo });
    if (out.speciesSize && Object.keys(out.speciesSize).length) for (const k in out.speciesSize) ch.push({ path: 'speciesSize.' + k, was: 1, now: out.speciesSize[k] });
    out.changes = ch;
    return out;
  };

  // ---- THE PREVIEWS -----------------------------------------------------------------------------
  // A GROUND SET, AS THE SHADER GRADES IT: the diff map through the grade (gain x the imagery's
  // normalisation x saturation), the recolour (splat_ground's sRecolour, line for line), shown at a
  // fixed mean so a dark set is still legible (the exposure is a scale: the hues are the shader's).
  const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const toSRGB = v => { v = clamp(v, 0, 1); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
  const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = toLin(i);
  const hexLin = h => { const n = parseInt(String(h || '#ffffff').slice(1), 16); return [toLin((n >> 16) & 255), toLin((n >> 8) & 255), toLin(n & 255)]; };
  const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const hueTurn = (r, g, b, a) => { if (!a) return [r, g, b]; const k = 0.57735027, ca = Math.cos(a), sa = Math.sin(a), d = k * (r + g + b) * (1 - ca);
    return [r * ca + k * (b - g) * sa + k * d, g * ca + k * (r - b) * sa + k * d, b * ca + k * (g - r) * sa + k * d]; };
  const hueOf = (r, g, b) => Math.atan2(1.7320508 * (g - b), 2 * r - g - b);
  const smooth = (a, b, x) => { const t = clamp((x - a) / Math.max(1e-6, b - a), 0, 1); return t * t * (3 - 2 * t); };
  const SRC = new Map();   // key -> { w, h, px: Uint8ClampedArray } (the diff map at 256)
  const srcOf = (key, cb) => {
    if (SRC.has(key)) return cb(SRC.get(key));
    const s = SP() && SP().images(key); if (!s) return;
    const img = s.diff;
    const go = () => { if (!img.naturalWidth) return; const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, N, N);
      const d = { w: N, h: N, px: x.getImageData(0, 0, N, N).data }; SRC.set(key, d); cb(d); };
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
  };
  // the graded texel (linear) - the preview's and the eyedropper's
  const gradeFn = key => {
    const sp = SP(); const g = sp.grade(key), kn = sp.knobs(), nm = sp.norm()[key] || [1, 1, 1], kA = kn.albedoNorm === undefined ? 1 : kn.albedoNorm;
    const gain = hexLin(g.gain).map((v, i) => v * (1 + (nm[i] - 1) * kA));
    const d2r = Math.PI / 180, sat = g.sat === undefined ? 1 : g.sat;
    const A = [(g.hue || 0) * d2r, (g.selHue || 0) * d2r, (g.selWidth || 0) * d2r, (g.selShift || 0) * d2r];
    const B = [g.selSat === undefined ? 1 : g.selSat, g.selLight === undefined ? 1 : g.selLight, g.contrast === undefined ? 1 : g.contrast, g.selSoft === undefined ? 0.5 : g.selSoft];
    const set = (typeof SPLAT_TEX_SETS !== 'undefined' && SPLAT_TEX_SETS ? SPLAT_TEX_SETS : []).find(s => s.key === key); const mn = set ? set.mean : [0.2, 0.2, 0.2];
    const mean = Math.max(1e-3, 0.2126 * mn[0] * gain[0] + 0.7152 * mn[1] * gain[1] + 0.0722 * mn[2] * gain[2]);
    return { gain, sat, A, B, mean, pre: (r, g2, b) => {   // grade only (what the selection's hue is measured on, before the recolour)
      r *= gain[0]; g2 *= gain[1]; b *= gain[2]; const l = luma(r, g2, b); r = l + (r - l) * sat; g2 = l + (g2 - l) * sat; b = l + (b - l) * sat;
      if (B[2] !== 1) { r = Math.max(0, mean + (r - mean) * B[2]); g2 = Math.max(0, mean + (g2 - mean) * B[2]); b = Math.max(0, mean + (b - mean) * B[2]); }
      return hueTurn(r, g2, b, A[0]); } };
  };
  const recolour = (F, r, g, b, showMask) => {
    let c = F.pre(r, g, b); const A = F.A, B = F.B;
    if (A[2] > 0) {
      const l = luma(c[0], c[1], c[2]), ch = Math.hypot(c[0] - l, c[1] - l, c[2] - l);
      const dh = Math.abs(((hueOf(c[0], c[1], c[2]) - A[1] + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
      const w = (1 - smooth(A[2] * (1 - B[3]), A[2], dh)) * smooth(0, 0.02 + 0.1 * B[3], ch / Math.max(l, 1e-3));
      if (showMask) return [c[0] + (1 - c[0]) * w, c[1] * (1 - w), c[2] + (1 - c[2]) * w, w];
      let t = hueTurn(c[0], c[1], c[2], A[3] * w); const lt = luma(t[0], t[1], t[2]), ks = 1 + (B[0] - 1) * w, kl = 1 + (B[1] - 1) * w;
      c = [Math.max(0, (lt + (t[0] - lt) * ks) * kl), Math.max(0, (lt + (t[1] - lt) * ks) * kl), Math.max(0, (lt + (t[2] - lt) * ks) * kl)];
    }
    return c;
  };
  const graded = new Map();   // key -> canvas (256, the recoloured set) - invalidated on any grade change
  const gradedOf = (key, cb, showMask) => srcOf(key, d => {
    const F = gradeFn(key), N = d.w, out = new ImageData(N, N), o = out.data, p = d.px;
    // the display exposure: the graded mean to 0.18 (a scale - the hue and the contrast are the shader's)
    const ex = 0.18 / F.mean;
    for (let i = 0; i < N * N * 4; i += 4) {
      const c = recolour(F, LUT[p[i]], LUT[p[i + 1]], LUT[p[i + 2]], showMask);
      o[i] = toSRGB(c[0] * ex); o[i + 1] = toSRGB(c[1] * ex); o[i + 2] = toSRGB(c[2] * ex); o[i + 3] = 255;
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = N; cv.getContext('2d').putImageData(out, 0, 0);
    if (!showMask) graded.set(key, cv);
    cb(cv);
  });
  const dropGraded = key => { if (key) graded.delete(key); else graded.clear(); };
  // draw a set into a canvas: `metres` across the canvas (the set tiled at its own repeat), or one repeat
  const drawSet = (canvas, key, metres, showMask) => {
    const paint = cv => {
      const x = canvas.getContext('2d'), N = canvas.width, rep = (SP().library().find(l => l.key === key) || { metres: 1 }).metres;
      x.clearRect(0, 0, N, canvas.height);
      const pat = x.createPattern(cv, 'repeat'), k = metres ? (N * rep / metres) / cv.width : N / cv.width;
      if (pat.setTransform) pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
      x.fillStyle = pat; x.fillRect(0, 0, N, canvas.height);
    };
    if (!showMask && graded.has(key)) paint(graded.get(key)); else gradedOf(key, paint, showMask);
  };

  // A SPECIES, RENDERED: the pack's own mesh (trees.js treeBuild, the lightest rung) through the game's
  // own renderer into a small target, read back once and kept. Anything that throws leaves the glyph.
  const THUMB = new Map(), TQ = [];
  let tBusy = false, tRT = null, tScene = null, tCam = null;
  const thumbOf = (name, canvas) => {
    if (THUMB.has(name)) { const s = THUMB.get(name); if (s) canvas.getContext('2d').drawImage(s, 0, 0, canvas.width, canvas.height); else glyph(canvas, name); return; }
    glyph(canvas, name); TQ.push([name, canvas]); if (!tBusy) setTimeout(thumbPump, 30);
  };
  const glyph = (canvas, name) => { const x = canvas.getContext('2d'), N = canvas.width; x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, 0, N, canvas.height);
    x.fillStyle = 'rgba(244,239,230,.55)'; x.font = '600 ' + Math.round(N / 4) + 'px IBM Plex Sans, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(({ tree: 'T', dead: 'D', shrub: 'B', cover: 'G', rock: 'S', debris: 'd', cliff: 'C' })[kindOf(name)] || '?', N / 2, canvas.height / 2); };
  function thumbPump() {
    const job = TQ.shift(); if (!job) { tBusy = false; return; }
    tBusy = true;
    const [name, canvas] = job;
    if (!THUMB.has(name)) THUMB.set(name, renderThumb(name));
    const s = THUMB.get(name); for (const [n, c] of [[name, canvas]].concat(TQ.filter(j => j[0] === name))) { if (s) c.getContext('2d').drawImage(s, 0, 0, c.width, c.height); }
    for (let i = TQ.length - 1; i >= 0; i--) if (TQ[i][0] === name) TQ.splice(i, 1);
    setTimeout(thumbPump, 16);
  }
  function renderThumb(name) {
    try {
      const THREE = W.THREE, R = W.FLIGHT_PROBE && W.FLIGHT_PROBE.renderer && W.FLIGHT_PROBE.renderer();
      if (!THREE || !R || !W.treeList || !W.treeBuild) return null;
      const e = W.treeList('all').find(q => q.col.name === name); if (!e) return null;
      const S = 128;
      if (!tRT) { tRT = new THREE.WebGLRenderTarget(S, S, { samples: 4 }); tScene = new THREE.Scene(); tCam = new THREE.PerspectiveCamera(28, 1, 0.05, 2000);
        tScene.add(new THREE.HemisphereLight(0xdfe9ff, 0x5a4a38, 1.6)); const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(3, 5, 4); tScene.add(sun); }
      const lods = e.sub.rungs ? e.sub.rungs.length : 1;
      const b = W.treeBuild(THREE, e.key, Math.min(1, lods - 1));
      const grp = new THREE.Group();
      for (const p of b.parts) { const m = new THREE.InstancedMesh(p.geo, p.mat, 1); m.setMatrixAt(0, new THREE.Matrix4()); m.frustumCulled = false; grp.add(m); }
      tScene.add(grp);
      const bb = b.bb || [-1, 0, -1, 1, 2, 1];
      const cx = (bb[0] + bb[3]) / 2, cy = (bb[1] + bb[4]) / 2, cz = (bb[2] + bb[5]) / 2;
      const rad = 0.5 * Math.hypot(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]);
      const dist = rad / Math.sin(14 * Math.PI / 180) * 1.02;
      tCam.position.set(cx + dist * 0.62, cy + dist * 0.38, cz + dist * 0.69); tCam.near = dist / 50; tCam.far = dist * 3; tCam.updateProjectionMatrix(); tCam.lookAt(cx, cy, cz);
      const prevT = R.getRenderTarget(), prevC = new THREE.Color(), prevA = R.getClearAlpha(); R.getClearColor(prevC);
      const prevAuto = R.autoClear, prevSh = R.shadowMap.autoUpdate;
      R.shadowMap.autoUpdate = false; R.autoClear = true;
      R.setRenderTarget(tRT); R.setClearColor(0x000000, 0); R.clear(); R.render(tScene, tCam);
      const buf = new Uint8Array(S * S * 4); R.readRenderTargetPixels(tRT, 0, 0, S, S, buf);
      R.setRenderTarget(prevT); R.setClearColor(prevC, prevA); R.autoClear = prevAuto; R.shadowMap.autoUpdate = prevSh;
      tScene.remove(grp); for (const m of grp.children) m.dispose && m.dispose();
      // the target holds linear light (the tone map and the sRGB encode are the screen's): encode here
      const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'), id = x.createImageData(S, S);
      const lin = (R.outputColorSpace !== 'srgb-linear');
      for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
        const s = ((S - 1 - y) * S + i) * 4, d = (y * S + i) * 4, a = buf[s + 3] / 255;
        const f = v => { const u = v / 255 / Math.max(a, 1e-3); const t = u / (1 + u * 0.35); return lin ? toSRGB(t) : 255 * clamp(t, 0, 1); };
        id.data[d] = f(buf[s]); id.data[d + 1] = f(buf[s + 1]); id.data[d + 2] = f(buf[s + 2]); id.data[d + 3] = buf[s + 3];
      }
      x.putImageData(id, 0, 0);
      return cv;
    } catch (err) { if (W.console) console.warn('world rail: no preview for ' + name + ': ' + (err && err.message)); return null; }
  }

  // THE MAPS: the island's rasters into small canvases (the layers' thumbnails, the terrain-type map)
  const WCPAL = { 10: [0, 100, 0], 20: [255, 187, 34], 30: [255, 255, 76], 40: [240, 150, 255], 50: [250, 0, 0], 60: [180, 180, 180], 70: [240, 240, 240], 80: [0, 100, 200], 90: [0, 150, 160], 95: [0, 207, 117], 100: [250, 230, 160] };
  const rasterCanvas = (N, fn) => {
    const I = ISL(); if (!I || !I.grid) return null;
    const gw = I.grid.w, gh = I.grid.h, M = Math.max(gw, gh), NW = Math.round(N * gw / M), NH = Math.round(N * gh / M);
    const cv = document.createElement('canvas'); cv.width = NW; cv.height = NH;
    const x = cv.getContext('2d'), id = x.createImageData(NW, NH);
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      const gi = Math.floor((i + 0.5) * gw / NW), gj = Math.floor((j + 0.5) * gh / NH), k = gj * gw + gi;
      const c = fn(k, gi, gj, I) || [0, 0, 0, 0]; const d = (j * NW + i) * 4;
      id.data[d] = c[0]; id.data[d + 1] = c[1]; id.data[d + 2] = c[2]; id.data[d + 3] = c[3] === undefined ? 255 : c[3];
    }
    x.putImageData(id, 0, 0); return cv;
  };
  const LAYER_PX = {
    class: (k, i, j, I) => { const c = I.coverU8 && I.coverU8[k]; return WCPAL[c] || [0, 60, 140]; },
    tint: (k, i, j, I) => { const a = I.albedo || I.tint; if (!a) return null; const n = I.grid.w * I.grid.h, s = a.length / n; return s >= 3 ? [a[k * s], a[k * s + 1], a[k * s + 2]] : [a[k], a[k], a[k]]; },
    radar: (k, i, j, I) => { const v = I.ori1 ? I.ori1[k] : 0; return [v, v, v]; },
    shade: (k, i, j, I) => { const v = I.canopyU8 ? 255 - clamp(I.canopyU8[k] * 8, 0, 200) : 255; return [v, v, v]; },
    snow: (k, i, j, I) => { const g = G(), wd = W.FLIGHT_PROBE && W.FLIGHT_PROBE.world(); const x = I.grid.x0 + (i + 0.5) * I.grid.cell, z = I.grid.z0 + (j + 0.5) * I.grid.cell; const h = (I.terrainH || wd.terrainH)(x, z); return h > (g ? g.get().snow : 900) ? [245, 245, 250] : [40, 44, 52]; },
    ttype: (k, i, j, I) => { const t = I.ttype ? I.ttype[k] : 0; return TTC[t] || [255, 0, 255]; },
  };
  const TMAP = new Map();
  const layerThumb = (src, N) => { const key = src + N; if (!TMAP.has(key) || src === 'snow') TMAP.set(key, rasterCanvas(N, LAYER_PX[src] || LAYER_PX.ttype)); return TMAP.get(key); };
  let SHARE = null;   // the terrain types' shares of the land
  const shares = () => { if (SHARE) return SHARE; const I = ISL(); SHARE = {}; if (!I || !I.ttype) return SHARE; let n = 0;
    for (let k = 0; k < I.ttype.length; k += 3) { const t = I.ttype[k]; if (t >= 2) { SHARE[t] = (SHARE[t] || 0) + 1; n++; } }
    for (const t in SHARE) SHARE[t] /= Math.max(1, n); return SHARE; };

  // ---- the rows (the flight screen's own grammar: .fr / .frng / .pill / .fsel / .fnote) ---------
  let binds = [], live = [];
  const refresh = () => { for (const b of binds) { try { b(); } catch (e) {} } };
  const changed = () => { saveLook(); refresh(); };
  const row = (p, label, ...kids) => { const r = $('div', 'wr-r'); const l = $('label', null, label); l.title = label; r.appendChild(l); for (const k of kids) if (k) r.appendChild(k); p.appendChild(r); return r; };
  const note = (p, t, cls) => { const n = $('div', 'wr-note' + (cls ? ' ' + cls : ''), t); p.appendChild(n); return n; };
  const liveNote = (p, fn) => { const n = note(p, ''); const f = () => { try { n.textContent = fn(); } catch (e) { n.textContent = '-'; } }; f(); live.push(f); return n; };
  const range = (p, label, lo, hi, step, get, set, f, def) => {
    const inp = $('input', 'frng'); inp.type = 'range'; inp.min = lo; inp.max = hi; inp.step = step;
    const out = $('output', 'wr-o'); out.title = 'click to type a value';
    const show = v => { out.textContent = f ? f(v) : fmt(v); };
    const put = v => { set(v); show(v); changed(); };
    inp.oninput = () => { const v = +inp.value; set(v); show(v); saveLook(); };
    inp.onchange = () => refresh();
    out.onclick = () => { const s = prompt(label, inp.value); if (s !== null && s !== '' && isFinite(+s)) { inp.value = +s; put(+s); } };
    const r = row(p, label, inp, out);
    if (def !== undefined) { r.firstChild.classList.add('wr-def'); r.firstChild.title = label + ' - double-click: back to ' + (f ? f(def) : def); r.firstChild.ondblclick = () => { inp.value = def; put(def); }; }
    const b = () => { let v; try { v = +get(); } catch (e) { v = NaN; } if (isFinite(v)) { inp.disabled = false; inp.value = v; show(v); } else { inp.disabled = true; out.textContent = '-'; } };
    b(); binds.push(b); return r;
  };
  const select = (p, label, opts, get, set) => {
    const s = $('select', 'fsel wr-sel'); for (const o of opts) { const e = $('option', null, o[1]); e.value = o[0]; s.appendChild(e); }
    s.onchange = () => { set(s.value); changed(); };
    const b = () => { try { s.value = String(get()); } catch (e) {} }; b(); binds.push(b);
    return row(p, label, s);
  };
  const pills = (p, list, isOn, pick, cls) => {
    const w = $('div', 'fpills wr-pills' + (cls ? ' ' + cls : ''));
    const bs = list.map(o => { const b = $('button', 'pill', o.label); b.type = 'button'; if (o.title) b.title = o.title; b.onclick = () => { pick(o); changed(); }; w.appendChild(b); return [b, o]; });
    const f = () => { for (const [b, o] of bs) b.classList.toggle('on', !!isOn(o)); }; f(); binds.push(f);
    p.appendChild(w); return w;
  };
  const toggle = (p, label, get, set) => pills(row(p, label), [{ label: 'on', v: 1 }, { label: 'off', v: 0 }], o => (!!get()) === !!o.v, o => set(o.v));
  const colour = (p, label, get, set) => { const i = $('input', 'wr-col'); i.type = 'color'; const o = $('output', 'wr-o');
    i.oninput = () => { set(i.value); o.textContent = i.value; saveLook(); }; i.onchange = () => refresh();
    const b = () => { try { i.value = get(); o.textContent = i.value; } catch (e) {} }; b(); binds.push(b); return row(p, label, i, o); };
  const button = (p, label, fn, cls) => { const b = $('button', 'pill' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.onclick = () => { fn(b); }; p.appendChild(b); return b; };
  // A SECTION: a card with a head that folds; the state is remembered per title
  const sec = (p, title, open, sub) => {
    const c = $('div', 'wr-card'), h = $('div', 'wr-ch'), b = $('div', 'wr-cb');
    const t = $('span', 'wr-ct', title); h.appendChild(t); if (sub) h.appendChild($('span', 'wr-cs', sub));
    const shut = UI.folds[title] === undefined ? !open : UI.folds[title];
    if (shut) c.classList.add('shut');
    h.onclick = () => { const s = c.classList.toggle('shut'); UI.folds[title] = s; saveUI(); };
    c.appendChild(h); c.appendChild(b); p.appendChild(c); return b;
  };

  // ---- THE SECTIONS -----------------------------------------------------------------------------
  const ICON = {
    cover: 'M3 5.5 9 3l6 2.5L9 8Z|M3 9l6 2.5L15 9|M3 12.5 9 15l6-2.5',
    types: 'M3 3h5v5H3Z|M10 3h5v5h-5Z|M3 10h5v5H3Z|M10 10h5v5h-5Z',
    library: 'M3 4h12v10H3Z|M3 8h12|M7 4v10|M11 4v10',
    filter: 'M3 14c3-8 9-8 12 0|M5 14l2-6|M13 14l-2-6|M9 14V6',
    veg: 'M9 15.4V8.2|M9 8.2C9 5.6 7 4.2 5 4.6c.4 2.6 2 4 4 3.6Z|M9 10.4c0-2.6 2-4 4-3.6-.4 2.6-2 4-4 3.6Z|M3.6 15.4h10.8',
    cliffs: 'M2 15l4-9 3 4 2-3 5 8Z|M6 6l1 3',
    scenery: 'M9 16.2s-5-4.6-5-8.3a5 5 0 0 1 10 0c0 3.7-5 8.3-5 8.3Z|M9 9.7a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z',
    file: 'M5 2.5h6l3 3v10H5Z|M11 2.5v3h3|M7.5 10.5 9.5 12.5 12 8.5',
  };
  const SECS = [
    { k: 'cover', label: 'coverage', title: 'The global map: the layers, the terrain types, the colour', build: buildCover },
    { k: 'types', label: 'types', title: 'One terrain type: its biome and its ground', build: buildTypes },
    { k: 'library', label: 'materials', title: 'The ground sets side by side, each set’s grade and recolour', build: buildLibrary },
    { k: 'filter', label: 'filtering', title: 'Tiling, blending, distance, texture filtering', build: buildFilter },
    { k: 'veg', label: 'vegetation', title: 'The fill’s rule, the cover ring, the trees’ colour', build: buildVeg },
    { k: 'cliffs', label: 'cliffs', title: 'The photoscanned cliffs and the rocks at distance', build: buildCliffs },
    { k: 'scenery', label: 'scenery', title: 'The scenery editor (roads, zones, strips, sites) and the maps', build: buildScenery },
    { k: 'file', label: 'export', title: 'Export, import, the changes against the defaults, reset', build: buildFile },
  ];

  // ---- COVERAGE ----
  function buildCover(body) {
    const g = G();
    if (!g || !g.on()) { note(body, 'No island under this world: the analytic ground has no layers or terrain types.'); return; }
    // THE VIEW: the composite, or one map alone (the bench's layer views)
    const V = sec(body, 'view', true, 'what the ground shows');
    const MODES = g.modes();
    pills(V, MODES.map((m, i) => ({ label: m, v: i })), o => g.get().mode === o.v, o => g.set({ mode: o.v }), 'wr-small');
    note(V, 'the composite, or one map alone on the ground itself - "terrain type" is the map everything else is organised by');
    // THE LAYERS, top first (the way Photoshop lists them): the ground sets over the stack
    const L = sec(body, 'layers', true, 'top first · eye · blend · opacity · solo');
    const list = $('div', 'wr-layers'); L.appendChild(list);
    const sp = SP();
    const soloOf = { class: 4, tint: 1, radar: 2, shade: 3, snow: 8 };
    const mkLayer = (o) => {
      const r = $('div', 'wr-layer');
      const eye = $('button', 'wr-eye'); eye.type = 'button'; eye.title = 'show / hide';
      eye.innerHTML = '<svg viewBox="0 0 18 18"><path d="M1.5 9s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5S1.5 9 1.5 9Z"/><circle cx="9" cy="9" r="2.2"/></svg>';
      eye.onclick = () => { o.setOn(!o.on()); changed(); };
      const th = $('div', 'wr-lthumb'); if (o.thumb) th.appendChild(o.thumb); else th.classList.add('wr-lthumb-none');
      const mid = $('div', 'wr-lmid'); const nm = $('div', 'wr-lname', o.name); mid.appendChild(nm);
      if (o.sub) mid.appendChild($('div', 'wr-lsub', o.sub));
      const ctl = $('div', 'wr-lctl'); mid.appendChild(ctl);
      if (o.blend) { const s = $('select', 'fsel wr-sel'); g.blends().forEach((b, i) => { const e = $('option', null, b); e.value = i; s.appendChild(e); }); s.onchange = () => { o.blend(+s.value); changed(); }; ctl.appendChild(s); binds.push(() => { s.value = String(o.mode()); }); }
      if (o.op) { const i = $('input', 'frng'); i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.01; const out = $('output', 'wr-o'); i.oninput = () => { o.op(+i.value); out.textContent = Math.round(+i.value * 100) + '%'; saveLook(); }; ctl.appendChild(i); ctl.appendChild(out);
        binds.push(() => { i.value = o.opv(); out.textContent = Math.round(o.opv() * 100) + '%'; }); }
      const solo = $('button', 'pill wr-solo', 'solo'); solo.type = 'button'; solo.title = 'show this map alone on the ground';
      if (o.solo === undefined) solo.style.visibility = 'hidden';
      solo.onclick = () => { g.set({ mode: g.get().mode === o.solo ? 0 : o.solo }); changed(); };
      r.appendChild(eye); r.appendChild(th); r.appendChild(mid); r.appendChild(solo);
      binds.push(() => { r.classList.toggle('off', !o.on()); solo.classList.toggle('on', o.solo !== undefined && g.get().mode === o.solo); });
      list.appendChild(r);
    };
    if (sp) mkLayer({ name: 'ground sets', sub: 'the detail and aerial sets by terrain type (the splat) - fades to the stack below with distance',
      thumb: (() => { const c = $('canvas'); c.width = c.height = 36; const first = (sp.code(2) || {}).tex; if (first && first[0]) setTimeout(() => drawSet(c, first[0], 0), 0); return c; })(),
      on: () => sp.on(), setOn: v => sp.set({ on: v ? 1 : 0 }) });
    const ST = g.stack();
    for (let i = ST.length - 1; i >= 0; i--) {
      const src = ST[i].src;
      const labels = { class: ['land cover', 'WorldCover classes, blurred and wobbled'], tint: ['imagery', 'Landsat true colour (the albedo)'], radar: ['radar relief', 'IFSAR, the relief’s light and dark'], shade: ['canopy shade', 'the canopy’s height, darkening the woods'], snow: ['snow', 'above the snowline, under 35°'] }[src] || [src, ''];
      mkLayer({ name: labels[0], sub: labels[1], thumb: layerThumb(src, 36), solo: soloOf[src],
        on: () => !!g.stack()[i].on, setOn: v => g.setLayer(i, { on: v ? 1 : 0 }),
        mode: () => g.stack()[i].mode, blend: v => g.setLayer(i, { mode: v }),
        opv: () => g.stack()[i].op, op: v => g.setLayer(i, { op: v }) });
    }
    note(L, 'the order is fixed (the shader composes it bottom up); the eye, the blend and the opacity are live and remembered. Solo paints that map alone on the ground.');
    // THE TERRAIN TYPES: the map, with its legend - a click on either opens the type
    const T = sec(body, 'terrain types', true, 'the map that organises the rest');
    mapWidget(T, 300);
    const lg = $('div', 'wr-legend'); T.appendChild(lg);
    const SH = shares();
    for (const c of EDITABLE) {
      const b = $('button', 'wr-leg'); b.type = 'button';
      const sw = $('span', 'wr-sw'); sw.style.background = css(TTC[c]); b.appendChild(sw);
      b.appendChild($('span', null, NAMES[c])); b.appendChild($('em', null, SH[c] ? (SH[c] * 100).toFixed(1) + '%' : (PARENT_OF[c] ? 'derived' : '-')));
      b.onclick = () => { UI.code = c; open('types'); };
      lg.appendChild(b);
    }
    toggle(row(T, ''), 'show on the ground', () => g.get().mode === 9, v => g.set({ mode: v ? 9 : 0 }));
    // THE GLOBAL COLOUR
    const C = sec(body, 'global colour', true, 'the stack’s grade and the environment');
    const gs = k => v => g.set({ [k]: v });
    range(C, 'lightness', 0.2, 2.5, 0.02, () => g.get().light, gs('light'), null, DEF.ground ? DEF.ground.light : undefined);
    range(C, 'saturation', 0, 2, 0.02, () => g.get().sat, gs('sat'), null, DEF.ground ? DEF.ground.sat : undefined);
    if (WF().envAlbedo) range(C, 'env. albedo', 0.2, 1.5, 0.02, () => WF().envAlbedo(), v => WF().envAlbedo(v), null, DEF.env === null ? undefined : DEF.env);
    note(C, 'env. albedo: one gain over the ground (after the sets) and the vegetation; the aeroplane, the buildings and the sky keep theirs');
    if (sp) {
      const kn = k => () => sp.knobs()[k], ss = k => v => sp.set({ [k]: v });
      range(C, 'to imagery', 0, 1, 0.05, kn('albedoNorm'), ss('albedoNorm'), null, 1);
      range(C, 'tint under', 0, 1, 0.05, kn('macroNear'), ss('macroNear'), null, 0.45);
      range(C, 'light kept', 0, 1, 0.05, kn('macroLum'), ss('macroLum'), null, 0.6);
      range(C, 'macro strength', 0, 1, 0.05, kn('macroMix'), ss('macroMix'), null, 0.85);
      note(C, 'to imagery: each set’s mean pulled onto the imagery’s colour where it stands (1 = the imagery is the level). Tint under: how much of the near ground’s colour is the imagery’s; light kept: how much of its light and dark. Macro strength: how far the imagery takes over in the distance.');
    }
    const Cs = sec(body, 'map edges and water', false);
    range(Cs, 'shore band', 0, 1, 0.05, () => g.get().shore, gs('shore'));
    range(Cs, 'class blur', 0, 200, 5, () => g.get().classBlur, gs('classBlur'), v => v + ' m');
    range(Cs, 'class wobble', 0, 60, 2, () => g.get().edgeWobble, gs('edgeWobble'), v => v + ' m');
    range(Cs, 'snowline', 300, 1200, 10, () => g.get().snow, v => { g.set({ snow: v }); TMAP.clear(); }, v => v + ' m');
    select(Cs, 'water', [['1', 'the map’s lakes'], ['0', 'off']], () => String(g.get().waterMap), v => g.set({ waterMap: +v }));
  }

  // the terrain-type map: the raster, the camera's mark, a hover readout, a click opens the type
  function mapWidget(p, N, sel) {
    const wrap = $('div', 'wr-map'); p.appendChild(wrap);
    const base = rasterCanvas(N, (k, i, j, I) => { const t = I.ttype ? I.ttype[k] : 0; const c = TTC[t] || [0, 0, 0]; if (sel !== undefined && t !== sel && !(PARENT_OF[sel] === t)) return [c[0] * 0.25 + 20, c[1] * 0.25 + 20, c[2] * 0.25 + 22]; return c; });
    if (!base) { note(p, 'no terrain-type raster'); return; }
    base.className = 'wr-mapc'; wrap.appendChild(base);
    const ov = $('canvas', 'wr-mapo'); ov.width = base.width; ov.height = base.height; wrap.appendChild(ov);
    const tip = $('div', 'wr-maptip'); wrap.appendChild(tip);
    const I = ISL(), gw = I.grid.w, gh = I.grid.h;
    const toCell = e => { const r = base.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height; return [Math.floor(u * gw), Math.floor(v * gh)]; };
    wrap.onmousemove = e => { const [i, j] = toCell(e); if (i < 0 || j < 0 || i >= gw || j >= gh) { tip.textContent = ''; return; }
      const t = I.ttype[j * gw + i]; const x = I.grid.x0 + (i + 0.5) * I.grid.cell, z = I.grid.z0 + (j + 0.5) * I.grid.cell;
      tip.textContent = NAMES[t] + ' · ' + x.toFixed(0) + ', ' + z.toFixed(0); };
    wrap.onmouseleave = () => { tip.textContent = ''; };
    wrap.onclick = e => { const [i, j] = toCell(e); if (i < 0 || j < 0 || i >= gw || j >= gh) return; const t = I.ttype[j * gw + i]; if (t >= 2) { UI.code = t; open('types'); } };
    wrap.ondblclick = e => { const [i, j] = toCell(e); const x = I.grid.x0 + (i + 0.5) * I.grid.cell, z = I.grid.z0 + (j + 0.5) * I.grid.cell; flyTo(x, z); };
    wrap.title = 'click: open that terrain type · double-click: take the free camera there';
    const mark = () => { const cam = camNow(); const x = ov.getContext('2d'); x.clearRect(0, 0, ov.width, ov.height); if (!cam) return;
      const u = (cam.position.x - I.grid.x0) / (gw * I.grid.cell) * ov.width, v = (cam.position.z - I.grid.z0) / (gh * I.grid.cell) * ov.height;
      const d = new W.THREE.Vector3(); cam.getWorldDirection(d); x.strokeStyle = '#fff'; x.fillStyle = '#ff5a36'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(u, v); x.lineTo(u + d.x * 14, v + d.z * 14); x.stroke(); x.beginPath(); x.arc(u, v, 3.5, 0, 7); x.fill(); x.stroke(); };
    mark(); live.push(mark);
  }
  const hAt = (x, z) => { const I = ISL(); if (I && I.terrainH) return I.terrainH(x, z); const w = W.FLIGHT_PROBE && W.FLIGHT_PROBE.world(); return w && w.terrainH ? w.terrainH(x, z) : 0; };
  const camNow = () => (WF() && WF().camera) || null;   // the world's camera (FLIGHT_PROBE.camera is the shed's)
  const flyTo = (x, z) => {
    const I = ISL(); if (!I) return;
    const S = W.SCENERY, D = W.DEV_CAM; if (!D) return;
    if (S && !S.on && S.enter) S.enter();
    setTimeout(() => { D.pos.set(x, hAt(x, z) + 80, z + 60); D.pitch = -0.6; D.yaw = Math.PI; }, S && !S.on ? 800 : 0);
  };

  // ---- TYPES ----
  function buildTypes(body) {
    const B = BIO(), sp = SP();
    if (!B && !sp) { note(body, 'No island under this world: no terrain types.'); return; }
    // the chips
    const chips = $('div', 'wr-chips'); body.appendChild(chips);
    for (const c of EDITABLE) {
      const b = $('button', 'wr-chip' + (UI.code === c ? ' on' : '')); b.type = 'button';
      const sw = $('span', 'wr-sw'); sw.style.background = css(TTC[c]); b.appendChild(sw); b.appendChild($('span', null, NAMES[c]));
      b.onclick = () => { UI.code = c; saveUI(); open('types', true); };
      chips.appendChild(b);
    }
    const code = UI.code;
    const hd = $('div', 'wr-thead'); body.appendChild(hd);
    const big = $('span', 'wr-sw wr-swbig'); big.style.background = css(TTC[code]); hd.appendChild(big);
    const hx = $('div'); hd.appendChild(hx);
    hx.appendChild($('div', 'wr-tname', NAMES[code]));
    const SH = shares();
    hx.appendChild($('div', 'wr-tsub', PARENT_OF[code] ? 'derived from ' + NAMES[PARENT_OF[code]] + ' in the shader and the planters' : ((SH[code] ? (SH[code] * 100).toFixed(1) + '% of the land' : 'not on this map') + ' · biome ' + ((B && B.mixAt(code)) || 'none'))));
    const pk = button(hd, 'under the eye', () => { const cam = camNow(); const t = TF(); if (!cam || !t || !t.at) return; const a = t.at(cam.position.x, cam.position.z); if (a && a.code >= 2) { UI.code = a.code; open('types', true); } });
    pk.title = 'the terrain type under the camera (or alt+click the ground)';
    if (DERIVED[code] && sp) {
      const D = DERIVED[code], K = sec(body, 'the split', true, D.what);
      range(K, 'from', 0, D.max, 0.5, () => sp.knobs()[D.lo], v => sp.set({ [D.lo]: v }), v => v + D.unit);
      range(K, 'full at', 0, D.max, 0.5, () => sp.knobs()[D.hi], v => sp.set({ [D.hi]: v }), v => v + D.unit);
      note(K, 'the ground blends across the split; the planters draw per point on the same curve');
    }
    // where it is
    const Mp = sec(body, 'where it is', false);
    mapWidget(Mp, 300, code);
    // the tabs
    const tabs = $('div', 'wr-tabs'); body.appendChild(tabs);
    for (const [k, l] of [['biome', 'biome'], ['ground', 'ground']]) { const b = $('button', 'wr-tab' + (UI.tab === k ? ' on' : ''), l); b.type = 'button'; b.onclick = () => { UI.tab = k; saveUI(); open('types', true); }; tabs.appendChild(b); }
    if (UI.tab === 'ground') groundTab(body, code); else biomeTab(body, code);
  }

  function biomeTab(body, code) {
    const B = BIO(), t = TF();
    if (!B || !t) { note(body, 'No biomes in this build.'); return; }
    if (code === 9 || code === 10) note(body, (code === 9 ? 'Snow' : 'Built ground') + ' plants nothing by default; pick a biome to change that.');
    const mixNames = Object.keys(B.mixes);
    const users = m => EDITABLE.filter(c => B.map[c] === m).map(c => NAMES[c]);
    const S = sec(body, 'the biome', true, 'the mix this type plants');
    select(S, 'biome', [['', '- none -']].concat(mixNames.map(m => [m, m + (users(m).length ? '  (' + users(m).join(', ') + ')' : '')])), () => B.map[code] || '', v => { t.setBiome(code, v || null); open('types', true); });
    const mix = B.mixAt(code);
    const act = $('div', 'wr-acts'); S.appendChild(act);
    button(act, mix ? 'own copy for ' + NAMES[code] : 'new biome', () => {
      let n = (mix ? mix : 'biome') + '_' + NAMES[code].replace(/\s+/g, '_'), k = 2; while (B.mixes[n]) n = n.replace(/_\d+$/, '') + '_' + k++;
      B.mixes[n] = mix ? clone(B.mixOf(mix)) : { species: {}, forest: { count: 0, radius: 220, under: 0, rocks: 0 } };
      t.setBiome(code, n); changed(); open('types', true);
    }).title = 'a copy of the biome that only this type uses (the others keep theirs)';
    if (!mix) { note(S, 'nothing is planted on ' + NAMES[code] + '.'); return; }
    const u = users(mix); if (u.length > 1) note(S, 'shared: ' + u.join(', ') + ' plant this biome - an edit here changes them all ("own copy" splits it off).', 'wr-warn');
    const M = () => B.mixOf(mix), F = () => (M().forest || (M().forest = {}));
    const fs = k => v => t.setMix(mix, ['forest', k], v);
    const St = sec(body, 'the stand', true, 'how much grows');
    range(St, 'trees', 0, 3000, 10, () => F().count || 0, fs('count'), v => v + ' · ' + (B.density(mix) * 10000).toFixed(0) + '/ha');
    range(St, 'shrubs', 0, 20, 0.5, () => F().under || 0, fs('under'), v => v + ' /1000 m²');
    range(St, 'stones', 0, 200, 1, () => F().rocks || 0, fs('rocks'), v => v + ' /1000 m²');
    range(St, 'debris', 0, 200, 1, () => F().debris || 0, fs('debris'), v => v + ' /1000 m²');
    range(St, 'blotch', 0, 1, 0.05, () => F().blotch || 0, fs('blotch'));
    range(St, 'blotch size', 4, 60, 1, () => F().blotchM || 18, fs('blotchM'), v => v + ' m');
    range(St, 'size spread', 0, 0.5, 0.01, () => F().coverSpread || 0, fs('coverSpread'));
    note(St, 'trees: the stand’s count in its 220 m disc (the density the fill plants, x the biome gain in VEGETATION); shrubs, stones, debris: the cover ring’s, near the eye; blotch: clearings and thickets on a noise of that size');
    // the five categories
    const P = PACK();
    for (const C of CATS) {
      const inMix = Object.keys(M().species || {}).filter(sp => C.kinds.includes(kindOf(sp)));
      const Cb = sec(body, C.label, true, inMix.length + ' species');
      const grid = $('div', 'wr-species'); Cb.appendChild(grid);
      for (const sp of inMix) speciesCard(grid, mix, sp);
      const avail = P ? P.collections.filter(c => C.kinds.includes(c.kind || 'tree') && !(M().species || {})[c.name]) : [];
      if (avail.length) {
        const s = $('select', 'fsel wr-sel wr-add'); const o0 = $('option', null, '+ add from the catalogue…'); o0.value = ''; s.appendChild(o0);
        for (const c of avail) { const o = $('option', null, pretty(c.name) + ' (' + c.kind + ')'); o.value = c.name; s.appendChild(o); }
        s.onchange = () => { if (!s.value) return; const name = s.value, kd = kindOf(name);
          const row0 = { proportion: 1 }; if (kd === 'cover') Object.assign(row0, { density: 0.5 }); if (kd === 'rock') Object.assign(row0, { size: 4 }); if (kd === 'debris') Object.assign(row0, { tilt: 1, bury: 0.2, tint: 0.3 });
          M().species = M().species || {}; M().species[name] = row0; t.setMix(mix, ['species', name, 'proportion'], 1); changed(); open('types', true); };
        Cb.appendChild(s);
      }
    }
  }
  // ONE SPECIES: its picture, its numbers (the planters' own keys, by kind), its removal
  const SPK = {
    tree: [['proportion', 0, 4, 0.05, 1], ['dead', 0, 0.5, 0.01, 0]],
    dead: [['proportion', 0, 4, 0.05, 1]],
    shrub: [['proportion', 0, 4, 0.05, 1], ['size', 0.2, 4, 0.05, 1]],
    cover: [['proportion', 0, 4, 0.05, 1], ['density', 0, 6, 0.05, 0, ' /m²'], ['size', 0.2, 4, 0.05, 1], ['patch', 0, 20, 0.5, 0, ' m'], ['patchShare', 0, 1, 0.05, 0.25]],
    rock: [['proportion', 0, 4, 0.05, 1], ['size', 0.5, 40, 0.5, 1], ['bury', 0, 0.8, 0.02, 0], ['tilt', 0, 1, 0.05, 0], ['tint', 0, 1, 0.05, 0], ['cluster', 0, 1, 1, 0], ['shore', 0, 1, 1, 0]],
    debris: [['proportion', 0, 4, 0.05, 1], ['size', 0.001, 3, 0.001, 1], ['tilt', 0, 1, 0.05, 0], ['bury', 0, 0.8, 0.02, 0], ['cluster', 0, 1, 1, 0], ['hollow', 0, 1, 0.05, 0], ['tint', 0, 1, 0.05, 0], ['dim', 0, 1.5, 0.02, 1]],
  };
  const SPK_NOTE = { patchShare: 'patch share', proportion: 'share' };
  function speciesCard(grid, mix, sp) {
    const B = BIO(), t = TF(), kd = kindOf(sp);
    const card = $('div', 'wr-spc'); grid.appendChild(card);
    const top = $('div', 'wr-spt'); card.appendChild(top);
    const cv = $('canvas', 'wr-spimg'); cv.width = cv.height = 72; top.appendChild(cv); thumbOf(sp, cv);
    const nm = $('div', 'wr-spn'); nm.appendChild($('b', null, pretty(sp))); nm.appendChild($('span', 'wr-kind', kd)); top.appendChild(nm);
    const P = PACK(), col = P && P.collections.find(c => c.name === sp);
    if (col && col.credit && col.credit.author) nm.appendChild($('div', 'wr-cred', col.credit.author.replace(/\s*\(.*\)$/, '')));
    const x = $('button', 'wr-x', '×'); x.type = 'button'; x.title = 'remove from this biome';
    x.onclick = () => { delete B.mixOf(mix).species[sp]; const F = B.mixOf(mix).forest || {}; t.setMix(mix, ['forest', 'count'], F.count || 0); changed(); open('types', true); };
    top.appendChild(x);
    const body = $('div', 'wr-spb'); card.appendChild(body);
    const rowOf = () => B.mixOf(mix).species[sp] || {};
    for (const [k, lo, hi, st, d, unit] of (SPK[kd] || SPK.tree))
      range(body, SPK_NOTE[k] || k, lo, hi, st, () => (rowOf()[k] === undefined ? d : rowOf()[k]), v => t.setMix(mix, ['species', sp, k], v), v => (st >= 1 ? v.toFixed(0) : fmt(v, st < 0.01 ? 3 : 2)) + (unit || ''), d);
    if (kd === 'tree' || kd === 'dead') {
      if (t.speciesSize) range(body, 'size', 0.3, 2.5, 0.05, () => t.speciesSize(sp), v => t.speciesSize(sp, v), v => 'x' + v.toFixed(2), 1);
      const L = W.TREE_LEAF, c = L && L.collections && L.collections().find(q => q.name === sp);
      if (c) {
        range(body, 'hue', -0.2, 0.2, 0.005, () => c.tint.hue || 0, v => L.tintOf(sp, { hue: v }), v => v.toFixed(3), 0);
        range(body, 'saturation', 0, 1.5, 0.02, () => (c.tint.sat === undefined ? 1 : c.tint.sat), v => L.tintOf(sp, { sat: v }), null, 1);
        range(body, 'lightness', 0.2, 2, 0.02, () => (c.tint.light === undefined ? 1 : c.tint.light), v => L.tintOf(sp, { light: v }), null, 1);
        range(body, 'bark', 0.2, 2, 0.02, () => (c.tint.bark === undefined ? 1 : c.tint.bark), v => L.tintOf(sp, { bark: v }), null, 1);
      }
      note(body, 'a tree’s height is the canopy map’s x the size gain (VEGETATION); size and colour here are the species’, in every biome');
    }
  }

  function groundTab(body, code) {
    const sp = SP();
    if (!sp) { note(body, 'The ground sets are off in this build (?splat=0, or no library).'); return; }
    const C = () => sp.code(code) || { tex: [null, null, null], scale: [1, 1, 1], far: [null, null, null], farScale: [0, 0, 0], mix: [30, 3, 0, 0], vary: [0, 0, 20] };
    const setArr = (key, j, v) => { const c = C(); const a = (c[key] || [null, null, null]).slice(); a[j] = v; sp.setCode(code, { [key]: a }); };
    const LIB = sp.library(), metres = k => { const l = LIB.find(x => x.key === k); return l ? l.metres : 1; };
    const kn = sp.knobs();
    note(body, 'the method: up to three DETAIL sets near the eye, mixed by a cloud mask and blended by their heights; between ' + kn.detailFrom + ' and ' + kn.detailTo + ' m they give way to up to three AERIAL sets (photographed from above, larger repeats); from ' + kn.macroFrom + ' m the imagery’s stack takes over (full by ' + kn.macroTo + ' m). An empty aerial slot keeps the detail set.');
    const slots = (title, key, skey, far) => {
      const S = sec(body, title, true, far ? kn.detailFrom + '-' + kn.detailTo + ' m and beyond' : 'near the eye');
      const g = $('div', 'wr-slots'); S.appendChild(g);
      ['A', 'B', 'C'].forEach((L, j) => {
        const cell = $('div', 'wr-slot'); g.appendChild(cell);
        const cv = $('canvas', 'wr-slotimg'); cv.width = cv.height = 96; cell.appendChild(cv);
        const k = (C()[key] || [])[j];
        const eff = k || (far ? C().tex[j] : null);
        if (eff) drawSet(cv, eff, 0); else { const x = cv.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(0, 0, 96, 96); }
        if (!k && far && eff) cell.classList.add('wr-inh');
        cell.appendChild($('div', 'wr-slotl', L + (L === 'A' ? ' (base)' : ''))) ;
        const s = $('select', 'fsel wr-sel'); const o0 = $('option', null, far ? '= the detail set' : '- none -'); o0.value = ''; s.appendChild(o0);
        for (const l of LIB) { const o = $('option', null, l.key + ' · ' + l.metres + ' m'); o.value = l.key; s.appendChild(o); }
        s.value = k || ''; s.onchange = () => { setArr(key, j, s.value || null); if (s.value) setArr(skey, j, metres(s.value)); changed(); open('types', true); };
        cell.appendChild(s);
        if (k) {
          const inp = $('input', 'frng'); inp.type = 'range'; inp.min = 0.5; inp.max = 120; inp.step = 0.5; inp.value = (C()[skey] || [1, 1, 1])[j] || metres(k);
          const out = $('output', 'wr-o', inp.value + ' m'); inp.oninput = () => { setArr(skey, j, +inp.value); out.textContent = inp.value + ' m'; saveLook(); };
          const rr = $('div', 'wr-slotr'); rr.appendChild(inp); rr.appendChild(out); cell.appendChild(rr);
          const ed = $('button', 'pill wr-small', 'recolour'); ed.type = 'button'; ed.onclick = () => { UI.lib = k; saveUI(); open('library'); }; cell.appendChild(ed);
        }
      });
    };
    slots('detail sets', 'tex', 'scale', false);
    slots('aerial sets', 'far', 'farScale', true);
    const M = sec(body, 'the mask', true, 'how the sets share the ground');
    range(M, 'cell', 2, 200, 1, () => C().mix[0], v => setArr('mix', 0, v), v => v + ' m');
    range(M, 'sharpness', 0.1, 6, 0.1, () => C().mix[1], v => setArr('mix', 1, v));
    range(M, 'A ← → B', -1, 1, 0.05, () => C().mix[2], v => setArr('mix', 2, v));
    range(M, 'C share', -1, 1, 0.05, () => C().mix[3], v => setArr('mix', 3, v));
    note(M, 'the cell is the mask’s blob size; a negative A↔B favours A. The height blend (FILTERING) decides the edge inside a blob: the taller texel wins.');
    const V = sec(body, 'variation', true, 'the colour swing over the ground');
    range(V, 'hue swing', 0, 40, 1, () => (C().vary || [0, 0, 20])[0], v => setArr('vary', 0, v), v => v + '°');
    range(V, 'value swing', 0, 0.6, 0.01, () => (C().vary || [0, 0, 20])[1], v => setArr('vary', 1, v));
    range(V, 'swing cell', 2, 120, 1, () => (C().vary || [0, 0, 20])[2], v => setArr('vary', 2, v), v => v + ' m');
    select(V, 'orient', [['', 'as is'], ['sea', 'face the sea (the beach)']], () => C().orient || '', v => sp.setCode(code, { orient: v || undefined }));
    // the sets this type draws, each one's recolour inline
    const used = [...new Set([].concat(C().tex, C().far || []).filter(Boolean))];
    if (used.length) {
      const R = sec(body, 'recolour the sets', false, 'shared with every type that uses them');
      for (const k of used) { const f = sec(R, k, false, (metres(k)) + ' m repeat'); setEditor(f, k); }
    }
  }

  // ---- MATERIALS ----
  function buildLibrary(body) {
    const sp = SP();
    if (!sp) { note(body, 'The ground sets are off in this build.'); return; }
    const LIB = sp.library();
    const usedBy = k => EDITABLE.filter(c => { const r = sp.code(c); return r && (r.tex.includes(k) || (r.far || []).includes(k)); });
    const V = sec(body, 'the library', true, LIB.length + ' sets');
    pills(V, [{ label: 'each at its repeat', v: 0 }, { label: '4 m', v: 4 }, { label: '16 m', v: 16 }, { label: '64 m', v: 64 }, { label: '200 m', v: 200 }],
      o => (UI.cmp ? UI.cmpM : 0) === o.v, o => { UI.cmp = o.v > 0; UI.cmpM = o.v || UI.cmpM; saveUI(); open('library', true); }, 'wr-small');
    note(V, UI.cmp ? 'every set drawn over the same ' + UI.cmpM + ' m of ground - its true grain against the others' : 'each tile is one repeat of its set');
    const grid = $('div', 'wr-lib' + (UI.wide ? ' wide' : '')); V.appendChild(grid);
    for (const l of LIB) {
      const c = $('div', 'wr-libc' + (UI.lib === l.key ? ' on' : '')); grid.appendChild(c);
      const cv = $('canvas'); cv.width = cv.height = 112; c.appendChild(cv); drawSet(cv, l.key, UI.cmp ? UI.cmpM : 0);
      const u = usedBy(l.key);
      c.appendChild($('div', 'wr-libn', l.key)); c.appendChild($('div', 'wr-libm', l.metres + ' m · ' + (u.length ? u.map(x => NAMES[x]).join(', ') : 'unused')));
      c.onclick = () => { UI.lib = UI.lib === l.key ? null : l.key; saveUI(); open('library', true); };
    }
    if (UI.lib) { const E = sec(body, UI.lib, true, 'grade and recolour'); setEditor(E, UI.lib); }
    else note(body, 'pick a set to grade and recolour it');
  }
  // ONE SET'S GRADE AND RECOLOUR: the preview (the shader's own grade, on the CPU), the eyedropper
  // picks the hue to select, the selection shown in magenta here and on the ground
  let maskKey = null;
  function setEditor(p, key) {
    const sp = SP();
    const wrap = $('div', 'wr-sedit'); p.appendChild(wrap);
    const pv = $('div', 'wr-prev'); wrap.appendChild(pv);
    const cv = $('canvas', 'wr-pimg'); cv.width = cv.height = 220; pv.appendChild(cv);
    const bar = $('canvas', 'wr-hbar'); bar.width = 220; bar.height = 14; pv.appendChild(bar);
    const pcap = $('div', 'wr-note', 'click the picture: select that colour’s hue'); pv.appendChild(pcap);
    let showSel = false, raw = false;
    const repaint = () => { dropGraded(key); if (raw) { srcOf(key, d => { const x = cv.getContext('2d'); const c = document.createElement('canvas'); c.width = c.height = d.w; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.px), d.w, d.w), 0, 0); x.drawImage(c, 0, 0, cv.width, cv.height); }); }
      else drawSet(cv, key, 0, showSel); paintBar(); };
    const paintBar = () => { const x = bar.getContext('2d'), gd = sp.grade(key); for (let i = 0; i < bar.width; i++) { const h = i / bar.width * 360; x.fillStyle = `hsl(${h},70%,45%)`; x.fillRect(i, 0, 1, bar.height); }
      if (gd.selWidth > 0) { const toX = h => ((h % 360) + 360) % 360 / 360 * bar.width, c = hueToHsl(gd.selHue), w = gd.selWidth / 360 * bar.width;
        x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(toX(c) - w, 1, 2 * w, bar.height - 2); x.strokeRect(toX(c) - w + bar.width, 1, 2 * w, bar.height - 2); x.strokeRect(toX(c) - w - bar.width, 1, 2 * w, bar.height - 2); } };
    // the shader's hue (0 red, 120 green, -120 blue, about the grey axis) against the HSL wheel's: the same order, near enough to draw the band
    const hueToHsl = h => h;
    const set = o => { sp.setGrade(key, o); repaint(); saveLook(); };
    cv.onclick = e => { const r = cv.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      srcOf(key, d => { const i = Math.floor(u * d.w), j = Math.floor(v * d.w), k = (j * d.w + i) * 4, F = gradeFn(key);
        const c = F.pre(LUT[d.px[k]], LUT[d.px[k + 1]], LUT[d.px[k + 2]]); let h = hueOf(c[0], c[1], c[2]) * 180 / Math.PI; if (h < 0) h += 360;
        const gd = sp.grade(key); set({ selHue: Math.round(h), selWidth: gd.selWidth > 0 ? gd.selWidth : 30 }); refresh(); }); };
    const ctl = $('div', 'wr-sctl'); wrap.appendChild(ctl);
    pills(ctl, [{ label: 'as graded', v: 0 }, { label: 'selection', v: 1 }, { label: 'as shipped', v: 2 }], o => (raw ? 2 : showSel ? 1 : 0) === o.v,
      o => { raw = o.v === 2; showSel = o.v === 1; repaint(); }, 'wr-small');
    const g = () => sp.grade(key);
    const S1 = $('div', 'wr-sub'); ctl.appendChild(S1); S1.appendChild($('div', 'wr-subh', 'the whole set'));
    colour(S1, 'gain', () => g().gain, v => set({ gain: v }));
    range(S1, 'saturation', 0, 2, 0.02, () => g().sat, v => set({ sat: v }), null, 1);
    range(S1, 'hue turn', -180, 180, 1, () => g().hue, v => set({ hue: v }), v => v + '°', 0);
    range(S1, 'contrast', 0, 2, 0.02, () => g().contrast, v => set({ contrast: v }), null, 1);
    range(S1, 'gloss', 0, 1, 0.05, () => g().gloss, v => set({ gloss: v }), null, 1);
    const S2 = $('div', 'wr-sub'); ctl.appendChild(S2); S2.appendChild($('div', 'wr-subh', 'one colour of it'));
    range(S2, 'pick hue', 0, 359, 1, () => ((g().selHue % 360) + 360) % 360, v => set({ selHue: v }), v => v + '°');
    range(S2, 'band', 0, 120, 1, () => g().selWidth, v => set({ selWidth: v }), v => v ? '±' + v + '°' : 'off', 0);
    range(S2, 'softness', 0, 1, 0.05, () => g().selSoft, v => set({ selSoft: v }), null, 0.5);
    range(S2, 'shift hue', -180, 180, 1, () => g().selShift, v => set({ selShift: v }), v => v + '°', 0);
    range(S2, 'saturation', 0, 2.5, 0.02, () => g().selSat, v => set({ selSat: v }), null, 1);
    range(S2, 'lightness', 0, 2.5, 0.02, () => g().selLight, v => set({ selLight: v }), null, 1);
    const mrow = row(S2, 'on the ground');
    pills(mrow, [{ label: 'magenta', v: 1 }, { label: 'off', v: 0 }], o => (maskKey === key) === !!o.v, o => { maskKey = o.v ? key : null; sp.showMask(maskKey); });
    note(S2, 'select the grass in a grass-and-rock set (pick its green, widen the band) and turn only it; the rock keeps its colour. Grey texels are never selected.');
    const acts = $('div', 'wr-acts'); ctl.appendChild(acts);
    button(acts, 'reset this set', () => { const R = (typeof GROUND_FIELDS !== 'undefined' && GROUND_FIELDS.RECIPE.grade[key]) || {};
      sp.setGrade(key, Object.assign({ gain: '#ffffff', sat: 1, gloss: 1, hue: 0, contrast: 1, selHue: 0, selWidth: 0, selShift: 0, selSat: 1, selLight: 1, selSoft: 0.5 }, R)); repaint(); changed(); });
    repaint();
  }

  // ---- FILTERING ----
  function buildFilter(body) {
    const sp = SP();
    if (!sp) { note(body, 'The ground sets are off in this build.'); return; }
    const kn = k => () => sp.knobs()[k], ss = k => v => sp.set({ [k]: v }), D = Object.assign({}, (typeof GROUND_FIELDS !== 'undefined' ? GROUND_FIELDS.RECIPE.knobs : {}), sp.filterDefaults());
    const F = sec(body, 'texture filtering', true, 'the noise and the shimmer');
    range(F, 'mip bias', -1, 3, 0.1, kn('lodBias'), ss('lodBias'), v => (v > 0 ? '+' : '') + v.toFixed(1), D.lodBias);
    pills(row(F, 'anisotropy'), [1, 2, 4, 8, 16].map(v => ({ label: v + 'x', v })), o => (sp.knobs().aniso | 0) === o.v, o => sp.set({ aniso: o.v }));
    note(F, 'mip bias: + blurs the sets (a coarser mip everywhere), - sharpens and shimmers. Anisotropy keeps them sharp at grazing angles; lower it for a softer far field (a re-upload: a short hitch).');
    range(F, 'detail contrast', 0, 1.5, 0.02, kn('conNear'), ss('conNear'), null, D.conNear);
    range(F, '... far', 0, 1.5, 0.02, kn('conFar'), ss('conFar'), null, D.conFar);
    range(F, '... from', 0, 1000, 10, kn('conFrom'), ss('conFrom'), v => v + ' m', D.conFrom);
    range(F, '... far by', 10, 3000, 10, kn('conTo'), ss('conTo'), v => v + ' m', D.conTo);
    note(F, 'the grain of the sets about their own mean: 1 as shipped, under 1 calmer. The far value is where a texel is under a pixel - its grain can only fizz there.');
    range(F, 'relief', 0, 3, 0.05, kn('nrmK'), ss('nrmK'), null, D.nrmK);
    range(F, 'relief fades', 0, 2000, 25, kn('nrmFadeFrom'), ss('nrmFadeFrom'), v => v + ' m', D.nrmFadeFrom);
    range(F, 'relief gone by', 0, 4000, 25, kn('nrmFadeTo'), ss('nrmFadeTo'), v => v ? v + ' m' : 'never', D.nrmFadeTo);
    range(F, 'specular AA', 0, 1.5, 0.05, kn('specAA'), ss('specAA'), v => v ? v.toFixed(2) : 'off', D.specAA);
    range(F, 'sheen', 0, 1, 0.05, kn('sheen'), ss('sheen'), null, D.sheen);
    note(F, 'the frame-to-frame sparkle is the sets’ relief and gloss under the sun at sub-pixel size: the relief fades out with distance, the specular AA roughens a glossy set by the pixel’s footprint, sheen 0 is matte everywhere. Nothing here is recomputed per frame: the noise fields are fixed in the world.');
    const T = sec(body, 'anti-tiling', true, 'the repeats broken up');
    toggle(T, 'hex tiling', () => sp.knobs().hexOn, v => sp.set({ hexOn: v }));
    range(T, 'hex cells', 0.5, 6, 0.5, kn('hexN'), ss('hexN'), v => v + ' /tile', D.hexN);
    range(T, 'hex rotation', 0, 180, 5, kn('hexRot'), ss('hexRot'), v => v + '°', D.hexRot);
    range(T, 'hex seam', 0.02, 1, 0.02, kn('hDepth'), ss('hDepth'), null, D.hDepth);
    range(T, 'triplanar', 0, 16, 1, kn('triK'), ss('triK'), v => v ? 'k ' + v : 'off', D.triK);
    note(T, 'every repeat is cut into hex cells, each turned at random and blended by height at the seams (hex seam: the height window; small = crisp stones, large = soft cross-fades). Triplanar keeps a steep slope from smearing.');
    const B = sec(body, 'between terrain types', false);
    range(B, 'blend radius', 0.5, 3, 0.1, kn('splatBlend'), ss('splatBlend'), v => v + ' cells', D.splatBlend);
    range(B, 'edge wobble', 0, 40, 1, kn('splatWobble'), ss('splatWobble'), v => v + ' m', D.splatWobble);
    range(B, 'seam depth', 0.02, 1, 0.02, kn('seamDepth'), ss('seamDepth'), null, D.seamDepth);
    const Ds = sec(body, 'distance', false, 'detail → aerial → imagery');
    range(Ds, 'detail fades', 0, 2000, 25, kn('detailFrom'), ss('detailFrom'), v => v + ' m', D.detailFrom);
    range(Ds, 'detail gone by', 50, 4000, 25, kn('detailTo'), ss('detailTo'), v => v + ' m', D.detailTo);
    range(Ds, 'imagery from', 0, 10000, 100, kn('macroFrom'), ss('macroFrom'), v => v + ' m', D.macroFrom);
    range(Ds, 'imagery full by', 100, 30000, 100, kn('macroTo'), ss('macroTo'), v => v + ' m', D.macroTo);
    liveNote(Ds, () => { const gf = W.GFX && W.GFX.S ? W.GFX.S.ground : null; return 'the GRAPHICS menu’s "ground blend" (' + (gf || '?') + ') may pull the detail fade in and cut the sets per type - "full" leaves these numbers alone'; });
    const Mi = sec(body, 'micro', false, 'pools, the water’s edge, the beach');
    range(Mi, 'pool wet', 0, 0.8, 0.01, kn('pudCover'), ss('pudCover'), null, D.pudCover);
    range(Mi, 'pool edge', 0.002, 0.05, 0.001, kn('pudEdge'), ss('pudEdge'), v => v.toFixed(3), D.pudEdge);
    range(Mi, 'pool scale', 0.5, 8, 0.5, kn('pudSlope'), ss('pudSlope'), v => 'x' + v, D.pudSlope);
    range(Mi, 'lake edge', 0.2, 8, 0.2, kn('lakeEdge'), ss('lakeEdge'), v => v + ' m', D.lakeEdge);
    range(Mi, 'beach angle', -180, 180, 5, kn('beachRot'), ss('beachRot'), v => v + '°', D.beachRot);
  }

  // ---- VEGETATION ----
  function buildVeg(body) {
    const t = TF();
    if (!t) { note(body, 'No vegetation handle yet.'); return; }
    if (t.onIsland && t.onIsland()) {
      const I = sec(body, 'the rule', true, 'the map says where and how tall');
      const isl = k => v => t.setIsland({ [k]: v }), D = DEF.island || {};
      range(I, 'cover from', 0, 10, 0.5, () => t.island().from, isl('from'), v => v + ' m', D.from);
      range(I, 'full cover', 2, 30, 1, () => t.island().full, isl('full'), v => v + ' m', D.full);
      range(I, 'size gain', 0.3, 2.5, 0.05, () => t.island().gain, isl('gain'), null, D.gain);
      range(I, 'size min', 0.1, 1, 0.05, () => t.island().min, isl('min'), null, D.min);
      range(I, 'size max', 1, 4, 0.1, () => t.island().max, isl('max'), null, D.max);
      range(I, 'biome gain', 0.5, 8, 0.1, () => t.island().biomeGain, isl('biomeGain'), null, D.biomeGain);
      range(I, 'biome wobble', 0, 30, 1, () => t.island().biomeWobble, isl('biomeWobble'), v => v + ' m', D.biomeWobble);
      note(I, 'the terrain type says the kind of stand, the canopy map how much of it stands and how tall (canopy x size gain over the model’s height), NDVI its vigour; biome gain scales every biome’s tree count; wobble reads the type a little off the point, so a biome’s edge is not the map’s cell edge');
    }
    const Fd = sec(body, 'the fill', false, 'the far forest');
    range(Fd, 'grid', 16, 400, 8, () => t.get(), v => t.set(v), v => v + ' (' + (1024 / v).toFixed(1) + ' m)');
    if (t.thin) { range(Fd, 'thin from', 500, 8000, 100, () => t.thin()[0], v => t.thin(v, t.thin()[1]), v => v + ' m'); range(Fd, 'thin to', 1000, 9000, 100, () => t.thin()[1], v => t.thin(t.thin()[0], v), v => v + ' m'); }
    const r = RING();
    if (r) {
      const R = sec(body, 'the cover ring', true, 'grass, flowers, bushes, stones, debris near the eye'), cs = k => v => r.set({ [k]: v }), D = DEF.ring || {};
      range(R, 'reach', 60, 400, 10, () => r.get().reach, cs('reach'), v => v + ' m', D.reach);
      range(R, 'full to', 10, 200, 5, () => r.get().near, cs('near'), v => v + ' m', D.near);
      range(R, 'taper', 0, 1, 0.05, () => r.get().taper, cs('taper'), null, D.taper);
      range(R, 'density', 0, 2, 0.05, () => r.get().density, cs('density'), null, D.density);
      range(R, 'shrubs', 0, 2, 0.05, () => r.get().shrubs, cs('shrubs'), null, D.shrubs);
      range(R, 'stones', 0, 2, 0.05, () => r.get().rocks, cs('rocks'), null, D.rocks);
      range(R, 'AGL full', 10, 200, 5, () => r.get().aglFull, cs('aglFull'), v => v + ' m', D.aglFull);
      range(R, 'AGL off', 30, 400, 5, () => r.get().aglOff, cs('aglOff'), v => v + ' m', D.aglOff);
      liveNote(R, () => { const st = r.stat(); return st ? 'under the eye: ' + (st.mixAt || 'no biome') + ' · ' + st.live + ' cells, ' + st.instances + ' instances · ' + st.lastMs.toFixed(1) + ' ms last build' : ''; });
    }
    const L = W.TREE_LEAF;
    if (L && L.master) {
      const C = sec(body, 'the trees’ colour', false, 'every species');
      range(C, 'hue', -0.2, 0.2, 0.005, () => L.master().hue, v => L.tint({ hue: v }), v => v.toFixed(3), 0);
      range(C, 'saturation', 0, 2, 0.02, () => L.master().sat, v => L.tint({ sat: v }), null, 1);
      range(C, 'lightness', 0.2, 2, 0.02, () => L.master().light, v => { L.tint({ light: v }); if (WF() && WF().treeLod) WF().treeLod.lit.value = v * 0.9; }, null, 1);
      if (W.TREE_MIX) { range(C, 'furnished', 0, 1, 0.05, () => W.TREE_MIX.furnished, v => { W.TREE_MIX.furnished = v; if (W.TREE_MIX.apply) W.TREE_MIX.apply(); });
        range(C, 'size spread', 0, 0.6, 0.02, () => W.TREE_MIX.spread, v => { W.TREE_MIX.spread = v; if (W.TREE_MIX.apply) W.TREE_MIX.apply(); }); }
      note(C, 'each species’ own colour and size are on its card (TYPES > biome); the LOD ladder and the leaf shading stay on F8 - they are the renderer’s, not the art’s');
    }
  }

  // ---- CLIFFS ----
  function buildCliffs(body) {
    const A = sec(body, 'where the coastal scans belong', true);
    note(A, 'the photoscanned SMALL coastal rocks (coast_land_rocks, coast_rocks, sand_rocks) are stones: they are species of the biomes (TYPES > biome > stones; the shingle biome plants them by the sea, "shore" keeps them there) and the rock map carries them into the distance. The CLIFF faces are not: they are placed by the ground’s own geometry - the steepest slopes, turned to the contour, sunk into the hill - not by a biome’s density, so they keep this section.');
    const P = PACK();
    if (P) {
      const scans = P.collections.filter(c => c.kind === 'cliff' || /coast|sand_rocks/.test(c.name));
      const grid = $('div', 'wr-species wr-mini'); A.appendChild(grid);
      const B = BIO();
      for (const c of scans) { const card = $('div', 'wr-spc'); const top = $('div', 'wr-spt'); card.appendChild(top);
        const cv = $('canvas', 'wr-spimg'); cv.width = cv.height = 72; top.appendChild(cv); thumbOf(c.name, cv);
        const nm = $('div', 'wr-spn'); nm.appendChild($('b', null, pretty(c.name))); nm.appendChild($('span', 'wr-kind', c.kind));
        const inMix = B ? Object.keys(B.mixes).filter(m => (B.mixes[m].species || {})[c.name]) : [];
        nm.appendChild($('div', 'wr-cred', c.kind === 'cliff' ? 'placed by slope (below)' : (inMix.length ? 'in ' + inMix.join(', ') : 'in no biome')));
        top.appendChild(nm); grid.appendChild(card); }
    }
    const c = CLF();
    if (c) {
      const S = sec(body, 'the cliff faces', true), cs = k => v => c.set({ [k]: v }), D = DEF.cliffs || {};
      toggle(S, 'cliffs', () => c.get().on, v => c.set({ on: !!v }));
      range(S, 'how many', 0, 400, 5, () => c.get().n, cs('n'), v => v.toFixed(0), D.n);
      range(S, 'min slope', 15, 60, 1, () => c.get().minSlope, cs('minSlope'), v => v + '°', D.minSlope);
      range(S, 'spacing', 20, 400, 5, () => c.get().spacing, cs('spacing'), v => v + ' m', D.spacing);
      range(S, 'by the sea', 0, 1, 0.05, () => c.get().coast, cs('coast'), null, D.coast);
      range(S, 'bury', 0, 1, 0.02, () => c.get().bury, cs('bury'), null, D.bury);
      range(S, 'fit', 0.5, 3, 0.05, () => c.get().fit, cs('fit'), null, D.fit);
      range(S, 'size min', 0.2, 2, 0.05, () => c.get().minK, cs('minK'), null, D.minK);
      range(S, 'size max', 0.5, 5, 0.05, () => c.get().maxK, cs('maxK'), null, D.maxK);
      range(S, 'tilt', 0, 1, 0.05, () => c.get().tilt, cs('tilt'), null, D.tilt);
      range(S, 'reach', 500, 10000, 100, () => c.get().reach, cs('reach'), v => v + ' m', D.reach);
      liveNote(S, () => { const s = c.stat(); return s.sites + ' sites, ' + s.placed + ' placed, ' + (s.tris / 1000).toFixed(0) + 'k tris, ' + s.ms.toFixed(0) + ' ms'; });
      note(S, 'every change re-places them (a short hitch). Off by default (the trial’s verdict); ?cliffs=1 or the switch here.');
    } else note(body, 'no cliffs module on this map');
    const RM = RMAP();
    if (RM) {
      const R = sec(body, 'stones at distance', false, 'the rock map');
      toggle(R, 'rock map', () => RM.get().on, v => RM.set({ on: !!v }));
      range(R, 'half width', 300, 2000, 50, () => RM.get().half, v => { RM.set({ half: v }); RM.replan(); }, v => v + ' m');
      range(R, 're-centre at', 100, 900, 25, () => RM.get().recentre, v => RM.set({ recentre: v }), v => v + ' m');
      note(R, 'the ring’s stones drawn top-down into a map the ground reads where the meshes have faded');
    }
  }

  // ---- SCENERY ----
  function buildScenery(body) {
    const S = sec(body, 'the scenery editor', true, 'roads, zones, strips, sites, objects');
    const PE = W.PREMISES_EDITOR;
    note(S, 'what was called the world editor: the premises composed into the world - airfields, roads, zones, sites and their objects. It opens over the scene with the sim held, on its own right-hand panel (this rail steps aside while it is open).');
    if (PE && W.PREMISES_UI) button(S, PE.open ? 'close the scenery editor' : 'open the scenery editor', () => { if (PE.open) PE.close(); else { PE.openEditor(); } refreshRail(); });
    else note(S, 'this build has no scenery editor (the world pack did not load)');
    const M = sec(body, 'the scenery mode', true, 'the world without the flight');
    const SC = W.SCENERY;
    note(M, 'the flight held, the aeroplane off the stage, the free camera (WASD/ZQSD, R/F up and down, Shift x5, the wheel for speed, drag to look). Start the game in it with ?scenery=1.');
    if (SC) button(M, SC.on ? 'back to the flight' : 'enter the scenery mode', () => { if (SC.on) SC.leave(); else SC.enter(); setTimeout(() => open('scenery', true), 900); });
    if (W.DEV_CAM) range(M, 'camera speed', 1, 400, 1, () => W.DEV_CAM.speed, v => { W.DEV_CAM.speed = v; }, v => v.toFixed(0) + ' m/s');
    airCard(body);
    if (Array.isArray(W.FLYDIY_WORLDS) && W.FLYDIY_WORLDS.length) {
      const Mp = sec(body, 'the map', false);
      const cur = W.FLYDIY_WORLD || 'none';
      pills(Mp, W.FLYDIY_WORLDS.map(w => ({ label: w.name, v: w.id })), o => o.v === cur, o => { if (o.v === cur) return; try { localStorage.setItem('flydiy.world', o.v); } catch (e) {} location.reload(); });
      note(Mp, 'picking a map reloads the page; each map keeps its own saved scenery');
    }
  }

  // THE AIR WHILE YOU WORK (the user, 2026-09-25: "check the fog/cloud settings too"): the mist and the clouds are
  // the day's (the left rail's WEATHER and CLOUDS own them for the flight), but a ground judged through a bank of
  // mist or from inside a deck is not judged at all. These are the same handles F8 moves (ATMO.MIST, CLOUDS.S,
  // DAY_CLOCK); "clear view" remembers what it changed and "the day's air" puts it back. Not part of the look.
  let AIR_SAVED = null;
  function airCard(body) {
    const A = sec(body, 'the air while you work', true, 'mist, clouds, haze, the hour');
    const M = () => (W.ATMO ? W.ATMO.MIST : null), CS = () => (W.CLOUDS ? W.CLOUDS.S : null), ck = () => W.DAY_CLOCK || null, dy = () => (ck() ? ck().day() : null);
    liveNote(A, () => { const m = M(), c = CS(), d = dy(), cam = camNow();
      const inMist = m && cam && m.rho0 > 0 && cam.position.y < m.top + m.H;
      const L = (W.CLOUDS && W.CLOUDS.layers) || [], deck = cam && L.find(q => cam.position.y > q.base && cam.position.y < q.top);
      return (m ? 'mist ' + (m.rho0 > 0 ? 'vis ' + (3 / m.rho0 / 1000).toFixed(1) + ' km to ' + m.top.toFixed(0) + ' m' : 'none (dry air)') : 'no mist module')
        + ' · clouds ' + (c ? c.mode : '-') + (d ? ' ' + Math.round(d.cloudCover * 100) + '% base ' + d.cloudBase.toFixed(0) + ' m' : '')
        + (d ? ' · haze ' + d.turbidity.toFixed(1) + ' (' + d.visibilityKm.toFixed(0) + ' km)' : '')
        + (inMist ? ' · THE EYE IS IN THE MIST' : '') + (deck ? ' · THE EYE IS IN A CLOUD DECK' : ''); });
    const acts = $('div', 'wr-acts'); A.appendChild(acts);
    button(acts, 'clear view', () => {
      const m = M(), c = CS(), d = dy();
      if (!AIR_SAVED) AIR_SAVED = { k: m ? m.k : null, inCloud: c ? c.inCloud : null, mode: c ? c.mode : null, turb: d ? d.turbidity : null };
      if (m) m.k = 0; if (c) { c.inCloud = 0; }
      if (ck() && d && d.turbidity > 2.2) ck().set({ turbidity: 2.2 });
      refresh();
    }).title = 'no mist, no cloud around the eye, clear air - what it changed is kept for "the day\'s air"';
    button(acts, 'the day\u2019s air', () => {
      const m = M(), c = CS(), S0 = AIR_SAVED; if (!S0) return;
      if (m && S0.k !== null) m.k = S0.k; if (c && S0.inCloud !== null) c.inCloud = S0.inCloud;
      if (ck() && S0.turb !== null) ck().set({ turbidity: S0.turb });
      AIR_SAVED = null; refresh();
    });
    range(A, 'mist density', 0, 6, 0.1, () => (M() ? M().k : NaN), v => { if (M()) M().k = v; }, v => v.toFixed(1) + 'x');
    range(A, 'mist top', -20, 600, 5, () => (M() ? M().top : NaN), v => { if (M()) M().top = v; }, v => v + ' m');
    range(A, 'haze', 1.5, 10, 0.1, () => (dy() ? dy().turbidity : NaN), v => { if (ck()) ck().set({ turbidity: v }); }, v => v.toFixed(1));
    range(A, 'cloud cover', 0, 1, 0.02, () => (dy() ? dy().cloudCover : NaN), v => { if (ck()) ck().set({ cloudCover: v }); }, v => Math.round(v * 100) + '%');
    if (CS()) {
      pills(row(A, 'clouds'), [['off', 'off'], ['half', 'half'], ['full', 'full']].map(q => ({ label: q[1], v: q[0] })), o => CS().mode === o.v,
        o => { CS().mode = o.v; if (W.FLYDIY_AA && W.FLYDIY_AA.needRT) W.FLYDIY_AA.needRT(o.v !== 'off'); });
      toggle(A, 'in-cloud mist', () => CS().inCloud, v => { CS().inCloud = v ? 1 : 0; });
    }
    if (ck()) pills(row(A, 'the hour'), ['morning', 'noon', 'afternoon', 'golden', 'sunset'].map(q => ({ label: q, v: q })), o => ck().nearestPreset() === o.v, o => ck().preset(o.v));
    note(A, 'the day\u2019s own weather (left rail: WEATHER, CLOUDS, NIGHT) is what the flight sees; this card is for looking at the ground. None of it goes into the export.');
  }

  // ---- EXPORT ----
  function buildFile(body) {
    const E = sec(body, 'export', true, 'every world setting in one file');
    note(E, 'the whole look - the ground sets and their recolours, the filtering, the layers, the global colour, the biomes and their species, the vegetation’s rule, the ring, the cliffs - with the list of what differs from the shipped defaults. Send it (or just its "changes") to make it the game’s new defaults.');
    const acts = $('div', 'wr-acts'); E.appendChild(acts);
    button(acts, 'copy to the clipboard', b => { const j = JSON.stringify(exportAll(), null, 1); try { navigator.clipboard.writeText(j).then(() => { b.textContent = 'copied'; setTimeout(() => { b.textContent = 'copy to the clipboard'; }, 1500); }); } catch (e) {} console.log('WORLD LOOK ' + j); });
    button(acts, 'download .json', () => { const j = JSON.stringify(exportAll(), null, 1); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'flydiy-world-look-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); });
    button(acts, 'copy the changes only', b => { const x = exportAll(); const j = JSON.stringify({ flydiy_world_look: 1, date: x.date, world: x.world, changes: x.changes }, null, 1); try { navigator.clipboard.writeText(j).then(() => { b.textContent = 'copied'; setTimeout(() => { b.textContent = 'copy the changes only'; }, 1500); }); } catch (e) {} });
    const C = sec(body, 'what changed', true);
    const ch = exportAll().changes;
    if (!ch.length) note(C, 'nothing: this is the shipped look');
    else { const tb = $('div', 'wr-diff'); C.appendChild(tb);
      for (const c of ch.slice(0, 400)) { const r = $('div', 'wr-dr'); r.appendChild($('span', 'wr-dp', c.path)); r.appendChild($('span', 'wr-dw', String(c.was))); r.appendChild($('span', 'wr-dn', String(c.now))); tb.appendChild(r); }
      if (ch.length > 400) note(C, '… and ' + (ch.length - 400) + ' more'); }
    const I = sec(body, 'import', false, 'a file or a paste');
    const ta = $('textarea', 'wr-ta'); ta.placeholder = 'paste an exported world look here'; I.appendChild(ta);
    const ia = $('div', 'wr-acts'); I.appendChild(ia);
    button(ia, 'apply the paste', () => { try { applyLook(JSON.parse(ta.value), true); saveLook(); ta.value = ''; open('file', true); } catch (e) { alert('not a world look: ' + e.message); } });
    const fi = $('input'); fi.type = 'file'; fi.accept = '.json,application/json'; fi.style.display = 'none'; I.appendChild(fi);
    fi.onchange = () => { const f = fi.files[0]; if (!f) return; f.text().then(s => { try { applyLook(JSON.parse(s), true); saveLook(); open('file', true); } catch (e) { alert('not a world look: ' + e.message); } }); };
    button(ia, 'open a file…', () => fi.click());
    const R = sec(body, 'reset', false, 'back to the shipped look');
    const ra = $('div', 'wr-acts'); R.appendChild(ra);
    button(ra, 'the ground sets', () => { if (confirm('Reset the ground sets, their recolours and the filtering?')) { SP() && SP().reset(); dropGraded(); open('file', true); } });
    button(ra, 'everything (reloads)', () => { if (!confirm('Reset the whole world look and reload?')) return;
      try { for (const k of [LOOK_KEY, 'flydiy.ground.splat.v1', 'flydiy.ground.stack']) localStorage.removeItem(k); } catch (e) {} location.reload(); });
    note(R, 'the biomes, the vegetation and the layers come back from the payload at the next boot; "everything" clears this browser’s look and reloads');
  }

  // ---- THE CHROME: the rail, the flyout ---------------------------------------------------------
  let rail = null, fly = null, flyHead = null, flyBody = null, tick = 0;
  function build() {
    const host = document.getElementById('ui') || document.body;
    const st = $('style'); st.textContent = CSS; document.head.appendChild(st);
    rail = $('div', 'flPlate'); rail.id = 'wrRail';
    const hd = $('div', 'wr-rhead', 'world'); rail.appendChild(hd);
    for (const S of SECS) {
      const b = $('button', 'flRailBtn wrBtn'); b.type = 'button'; b.dataset.k = S.k; b.title = S.title;
      b.innerHTML = '<svg viewBox="0 0 18 18">' + ICON[S.k].split('|').map(d => '<path d="' + d + '"/>').join('') + '</svg>';
      b.appendChild($('span', null, S.label));
      b.onclick = () => { if (fly && !fly.hidden && UI.sec === S.k) close(); else open(S.k); };
      rail.appendChild(b);
    }
    fly = $('div'); fly.id = 'wrFly'; fly.hidden = true;
    flyHead = $('div', 'wr-head'); flyBody = $('div', 'wr-body');
    fly.appendChild(flyHead); fly.appendChild(flyBody);
    host.appendChild(rail); host.appendChild(fly);
    // alt+click on the ground: the terrain type under the mouse
    const c = document.getElementById('c');
    if (c) c.addEventListener('pointerdown', e => { if (!e.altKey || !UI.shown || e.button !== 0) return; const p = pickGround(e); if (!p) return; const t = TF(); const a = t && t.at && t.at(p[0], p[2]);
      if (a && a.code >= 2) { UI.code = a.code; open('types'); } e.preventDefault(); e.stopImmediatePropagation(); }, true);
  }
  function pickGround(e) {
    const cam = camNow(), I = ISL(), THREE = W.THREE; if (!cam || !I || !THREE) return null;
    const r = e.target.getBoundingClientRect(); const v = new THREE.Vector3((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
    const p = cam.position.clone(); let prev = p.clone(), step = 2;
    for (let d = 0; d < 30000; d += step) { p.copy(cam.position).addScaledVector(v, d); if (p.y < hAt(p.x, p.z)) { for (let k = 0; k < 12; k++) { const m = prev.clone().lerp(p, 0.5); if (m.y < hAt(m.x, m.z)) p.copy(m); else prev.copy(m); } return [p.x, p.y, p.z]; } prev.copy(p); step = Math.max(2, d * 0.01); }
    return null;
  }
  function open(k, keepScroll) {
    if (!rail) build();
    if (!WF()) { setTimeout(() => open(k, keepScroll), 500); return; }   // the world first; each section says what this map lacks
    takeDefaults();
    UI.sec = k; UI.shown = true; saveUI();
    rail.style.display = '';
    const S = SECS.find(s => s.k === k) || SECS[0];
    const top = keepScroll ? flyBody.scrollTop : 0;
    binds = []; live = [];
    flyHead.textContent = '';
    const t = $('div', 'wr-ht'); t.appendChild($('b', null, S.label)); t.appendChild($('span', null, S.title)); flyHead.appendChild(t);
    const wb = $('button', 'wr-hb', UI.wide ? '→←' : '←→'); wb.type = 'button'; wb.title = 'wider / narrower'; wb.onclick = () => { UI.wide = !UI.wide; saveUI(); open(UI.sec, true); }; flyHead.appendChild(wb);
    const cb = $('button', 'wr-hb', '×'); cb.type = 'button'; cb.title = 'close (F9 hides the rail)'; cb.onclick = close; flyHead.appendChild(cb);
    flyBody.textContent = '';
    try { S.build(flyBody); } catch (err) { note(flyBody, 'this section failed to build: ' + (err && err.message), 'wr-warn'); console.error(err); }
    fly.hidden = false; fly.classList.toggle('wide', !!UI.wide);
    flyBody.scrollTop = top;
    for (const b of rail.querySelectorAll('.wrBtn')) b.classList.toggle('on', b.dataset.k === k);
    if (!tick) tick = setInterval(() => { if (fly && !fly.hidden) for (const f of live) { try { f(); } catch (e) {} } }, 500);
  }
  function close() { if (fly) fly.hidden = true; if (rail) for (const b of rail.querySelectorAll('.wrBtn')) b.classList.remove('on'); }
  function refreshRail() { if (fly && !fly.hidden) setTimeout(() => open(UI.sec, true), 50); }
  function show(on) {
    if (!rail) build();
    UI.shown = on; saveUI();
    rail.style.display = on ? '' : 'none';
    if (!on) close(); else if (!fly || fly.hidden) open(UI.sec || 'cover');
  }
  window.addEventListener('keydown', e => {
    if (e.code !== 'F9') return;
    e.preventDefault(); e.stopImmediatePropagation();
    show(!(rail && rail.style.display !== 'none' && UI.shown));
  }, true);

  // THE LOOK AT BOOT: once the world is up, the defaults are taken, then this browser's look put back
  let bootTries = 0;
  const boot = () => {
    if ((!ready() || !BIO()) && ++bootTries < 400) { setTimeout(boot, 700); return; }   // ~5 min, then whatever there is (the analytic world has no island)
    if (!WF()) return;
    takeDefaults();
    const L = lsGet(LOOK_KEY, null);
    if (L) { try { applyLook(L, false); } catch (e) { console.warn('world rail: the saved look did not apply: ' + (e && e.message)); } }
    if (UI.shown) { build(); rail.style.display = ''; }
  };
  setTimeout(boot, 1500);

  const CSS = `
#ui #wrRail { position:absolute; right:22px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:4px; padding:6px;
  max-height:calc(100% - 44px); overflow-y:auto; scrollbar-width:none; z-index:6; }
#ui #wrRail .wr-rhead { font:600 8px/1 'IBM Plex Sans'; letter-spacing:.14em; text-transform:uppercase; color:var(--ed-faint); text-align:center; padding:4px 0 6px; border-bottom:1px solid var(--ed-hair); margin-bottom:2px; }
body.premOpen #ui #wrRail, body.premOpen #ui #wrFly { display:none !important; }
#ui #wrFly { position:absolute; right:92px; top:18px; bottom:18px; width:400px; display:flex; flex-direction:column; z-index:20;
  background:var(--ed-plate); border:1px solid var(--ed-border); border-radius:9px; backdrop-filter:blur(16px) saturate(1.15); -webkit-backdrop-filter:blur(16px) saturate(1.15); }
#ui #wrFly.wide { width:600px; }
#ui #wrFly[hidden] { display:none; }
#ui #wrFly .wr-head { display:flex; align-items:center; gap:6px; padding:10px 12px 8px; border-bottom:1px solid var(--ed-hair); }
#ui #wrFly .wr-ht { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
#ui #wrFly .wr-ht b { font:600 11px/1.2 'IBM Plex Sans'; letter-spacing:.14em; text-transform:uppercase; }
#ui #wrFly .wr-ht span { font-size:10.5px; color:var(--ed-faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#ui #wrFly .wr-hb { background:var(--ed-btn-bg); border:1px solid var(--ed-btn-bd); color:var(--ed-dim); border-radius:5px; font:500 11px/1 'IBM Plex Sans'; padding:5px 7px; cursor:pointer; }
#ui #wrFly .wr-hb:hover { color:var(--ed-ink); }
#ui #wrFly .wr-body { flex:1; overflow-y:auto; padding:10px 12px 16px; scrollbar-width:thin; scrollbar-color:var(--ed-off) transparent; scrollbar-gutter:stable; font-size:11.5px; }
#ui #wrFly .wr-card { border:1px solid var(--ed-hair); border-radius:7px; margin:0 0 8px; background:rgba(0,0,0,.08); }
#ui #wrFly .wr-card .wr-card { background:rgba(255,255,255,.02); margin:6px 0; }
#ui #wrFly .wr-ch { display:flex; align-items:baseline; gap:8px; padding:7px 9px; cursor:pointer; user-select:none; }
#ui #wrFly .wr-ch::before { content:'\\25BE'; color:var(--ed-faint); font-size:9px; width:8px; }
#ui #wrFly .wr-card.shut > .wr-ch::before { content:'\\25B8'; }
#ui #wrFly .wr-ct { font:600 10px/1.2 'IBM Plex Sans'; letter-spacing:.1em; text-transform:uppercase; color:var(--ed-acc); }
#ui #wrFly .wr-cs { font-size:10px; color:var(--ed-faint); margin-left:auto; text-align:right; }
#ui #wrFly .wr-cb { padding:2px 9px 9px; }
#ui #wrFly .wr-card.shut > .wr-cb { display:none; }
#ui #wrFly .wr-r { display:grid; grid-template-columns:96px 1fr auto; align-items:center; gap:8px; min-height:22px; }
#ui #wrFly .wr-r > label { color:var(--ed-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#ui #wrFly .wr-r > label.wr-def { cursor:default; }
#ui #wrFly .wr-r > label.wr-def:hover { color:var(--ed-ink); }
#ui #wrFly .wr-r > .fpills { grid-column:2 / 4; }
#ui #wrFly .wr-r > .wr-sel { grid-column:2 / 4; }
#ui #wrFly .wr-o { min-width:52px; text-align:right; color:var(--ed-ink); font-size:10.5px; cursor:text; }
#ui #wrFly .wr-sel { width:100%; background:rgba(0,0,0,.25); color:var(--ed-ink); border:1px solid var(--ed-btn-bd); border-radius:5px; font:inherit; padding:3px 4px; }
#ui #wrFly .wr-sel option { background:#201d1a; }
#ui #wrFly .wr-col { width:40px; height:20px; border:1px solid var(--ed-btn-bd); background:none; padding:0; border-radius:4px; }
#ui #wrFly .wr-note { color:var(--ed-faint); font-size:10.5px; line-height:1.4; margin:5px 0 3px; }
#ui #wrFly .wr-note.wr-warn { color:var(--ed-warn); }
#ui #wrFly .wr-pills { display:flex; flex-wrap:wrap; gap:4px; margin:3px 0; }
#ui #wrFly .wr-small .pill, #ui #wrFly .pill.wr-small { font-size:9px; padding:4px 6px; }
#ui #wrFly .wr-acts { display:flex; flex-wrap:wrap; gap:5px; margin:6px 0 2px; }
/* the layers */
#ui #wrFly .wr-layers { display:flex; flex-direction:column; gap:3px; }
#ui #wrFly .wr-layer { display:grid; grid-template-columns:24px 40px 1fr auto; gap:7px; align-items:center; padding:5px; border-radius:6px; background:rgba(255,255,255,.035); border:1px solid transparent; }
#ui #wrFly .wr-layer.off { opacity:.5; }
#ui #wrFly .wr-layer.off .wr-eye svg { opacity:.3; }
#ui #wrFly .wr-eye { background:none; border:0; color:var(--ed-ink); cursor:pointer; padding:0; }
#ui #wrFly .wr-eye svg { width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.3; }
#ui #wrFly .wr-lthumb { width:38px; height:38px; border-radius:4px; overflow:hidden; border:1px solid var(--ed-border); background:#111; }
#ui #wrFly .wr-lthumb canvas { width:100%; height:100%; display:block; object-fit:cover; image-rendering:pixelated; }
#ui #wrFly .wr-lname { font-weight:600; font-size:11px; }
#ui #wrFly .wr-lsub { color:var(--ed-faint); font-size:9.5px; line-height:1.3; }
#ui #wrFly .wr-lctl { display:flex; gap:6px; align-items:center; margin-top:3px; }
#ui #wrFly .wr-lctl .wr-sel { width:92px; flex:none; padding:1px 2px; font-size:10px; }
#ui #wrFly .wr-lctl .frng { flex:1; }
#ui #wrFly .wr-solo { font-size:9px; padding:4px 6px; }
/* the map */
#ui #wrFly .wr-map { position:relative; margin:4px 0; cursor:crosshair; border-radius:6px; overflow:hidden; border:1px solid var(--ed-border); background:#0b0f18; }
#ui #wrFly .wr-mapc, #ui #wrFly .wr-mapo { display:block; width:100%; height:auto; image-rendering:pixelated; }
#ui #wrFly .wr-mapo { position:absolute; left:0; top:0; }
#ui #wrFly .wr-maptip { position:absolute; left:6px; bottom:5px; font-size:10px; color:#fff; pointer-events:none; }
#ui #wrFly .wr-legend { display:grid; grid-template-columns:repeat(auto-fill, minmax(112px, 1fr)); gap:3px; margin:4px 0 6px; }
#ui #wrFly .wr-leg, #ui #wrFly .wr-chip { display:flex; align-items:center; gap:6px; background:rgba(255,255,255,.04); border:1px solid var(--ed-hair); border-radius:5px; color:var(--ed-ink); font:inherit; font-size:10.5px; padding:4px 6px; cursor:pointer; text-align:left; }
#ui #wrFly .wr-leg:hover, #ui #wrFly .wr-chip:hover { border-color:var(--ed-btn-bd); }
#ui #wrFly .wr-leg em { margin-left:auto; font-style:normal; color:var(--ed-faint); font-size:9.5px; }
#ui #wrFly .wr-sw { width:11px; height:11px; border-radius:3px; flex:none; box-shadow:inset 0 0 0 1px rgba(255,255,255,.25); }
#ui #wrFly .wr-swbig { width:30px; height:30px; border-radius:6px; }
#ui #wrFly .wr-chips { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; }
#ui #wrFly .wr-chip.on { background:var(--ed-acc); color:var(--ed-acc-ink); text-shadow:none; }
#ui #wrFly .wr-thead { display:flex; align-items:center; gap:10px; margin:2px 0 8px; }
#ui #wrFly .wr-thead > div { flex:1; }
#ui #wrFly .wr-tname { font:600 15px/1.2 'IBM Plex Sans'; text-transform:capitalize; }
#ui #wrFly .wr-tsub { color:var(--ed-faint); font-size:10.5px; }
#ui #wrFly .wr-tabs { display:flex; gap:0; margin:4px 0 8px; border-bottom:1px solid var(--ed-hair); }
#ui #wrFly .wr-tab { flex:1; background:none; border:0; border-bottom:2px solid transparent; color:var(--ed-dim); font:600 10px/1 'IBM Plex Sans'; letter-spacing:.12em; text-transform:uppercase; padding:8px 0; cursor:pointer; }
#ui #wrFly .wr-tab.on { color:var(--ed-ink); border-bottom-color:var(--ed-acc); }
/* the species */
#ui #wrFly .wr-species { display:grid; grid-template-columns:1fr; gap:6px; }
#ui #wrFly.wide .wr-species { grid-template-columns:1fr 1fr; }
#ui #wrFly .wr-species.wr-mini { grid-template-columns:1fr 1fr; }
#ui #wrFly .wr-spc { border:1px solid var(--ed-hair); border-radius:6px; background:rgba(255,255,255,.03); padding:6px; }
#ui #wrFly .wr-spt { display:flex; gap:8px; align-items:flex-start; }
#ui #wrFly .wr-spimg { width:56px; height:56px; border-radius:5px; background:radial-gradient(circle at 50% 35%, #4a5361, #1c2027); flex:none; }
#ui #wrFly .wr-mini .wr-spimg { width:44px; height:44px; }
#ui #wrFly .wr-spn { flex:1; min-width:0; }
#ui #wrFly .wr-spn b { display:block; font-size:11px; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#ui #wrFly .wr-kind { display:inline-block; margin-top:2px; font-size:8.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--ed-acc-ink); background:var(--ed-acc); border-radius:3px; padding:1px 4px; text-shadow:none; }
#ui #wrFly .wr-cred { color:var(--ed-faint); font-size:9.5px; margin-top:2px; }
#ui #wrFly .wr-x { background:none; border:0; color:var(--ed-faint); font-size:16px; line-height:1; cursor:pointer; padding:0 2px; }
#ui #wrFly .wr-x:hover { color:var(--ed-bad); }
#ui #wrFly .wr-spb { margin-top:4px; }
#ui #wrFly .wr-spb .wr-r { grid-template-columns:76px 1fr auto; }
#ui #wrFly .wr-add { margin-top:6px; }
/* the ground slots */
#ui #wrFly .wr-slots { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; }
#ui #wrFly .wr-slot { display:flex; flex-direction:column; gap:4px; min-width:0; }
#ui #wrFly .wr-slotimg { width:100%; aspect-ratio:1; height:auto; border-radius:5px; border:1px solid var(--ed-border); }
#ui #wrFly .wr-slot.wr-inh .wr-slotimg { opacity:.45; border-style:dashed; }
#ui #wrFly .wr-slotl { font-size:9.5px; color:var(--ed-faint); letter-spacing:.08em; text-transform:uppercase; }
#ui #wrFly .wr-slotr { display:flex; align-items:center; gap:4px; }
#ui #wrFly .wr-slotr .wr-o { min-width:36px; }
/* the library */
#ui #wrFly .wr-lib { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; }
#ui #wrFly .wr-lib.wide { grid-template-columns:repeat(5, 1fr); }
#ui #wrFly .wr-libc { cursor:pointer; border:1px solid var(--ed-hair); border-radius:6px; padding:4px; background:rgba(255,255,255,.03); min-width:0; }
#ui #wrFly .wr-libc.on { border-color:var(--ed-acc); box-shadow:0 0 0 1px var(--ed-acc); }
#ui #wrFly .wr-libc canvas { width:100%; aspect-ratio:1; height:auto; display:block; border-radius:4px; }
#ui #wrFly .wr-libn { font-weight:600; font-size:10.5px; margin-top:3px; }
#ui #wrFly .wr-libm { color:var(--ed-faint); font-size:9px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
/* the set editor */
#ui #wrFly .wr-sedit { display:flex; flex-direction:column; gap:8px; }
#ui #wrFly.wide .wr-sedit { flex-direction:row; align-items:flex-start; }
#ui #wrFly .wr-prev { display:flex; flex-direction:column; gap:4px; flex:none; }
#ui #wrFly .wr-pimg { width:220px; height:220px; border-radius:6px; border:1px solid var(--ed-border); cursor:crosshair; align-self:center; }
#ui #wrFly .wr-hbar { width:220px; height:14px; border-radius:3px; align-self:center; }
#ui #wrFly .wr-sctl { flex:1; min-width:0; }
#ui #wrFly .wr-sub { margin-top:6px; }
#ui #wrFly .wr-subh { font:600 9.5px/1 'IBM Plex Sans'; letter-spacing:.12em; text-transform:uppercase; color:var(--ed-faint); margin:4px 0; }
/* the export */
#ui #wrFly .wr-diff { max-height:300px; overflow:auto; font:10px/1.4 ui-monospace, Consolas, monospace; }
#ui #wrFly .wr-dr { display:grid; grid-template-columns:1fr 70px 70px; gap:6px; border-bottom:1px solid var(--ed-hair); padding:2px 0; }
#ui #wrFly .wr-dp { word-break:break-all; color:var(--ed-dim); }
#ui #wrFly .wr-dw { color:var(--ed-faint); text-decoration:line-through; overflow:hidden; text-overflow:ellipsis; }
#ui #wrFly .wr-dn { color:var(--ed-acc); overflow:hidden; text-overflow:ellipsis; }
#ui #wrFly .wr-ta { width:100%; min-height:80px; box-sizing:border-box; background:rgba(0,0,0,.25); color:var(--ed-ink); border:1px solid var(--ed-btn-bd); border-radius:5px; font:10px ui-monospace, monospace; }
@media (max-width: 900px) { #ui #wrFly, #ui #wrFly.wide { width:auto; left:12px; right:84px; } #ui #wrRail { right:8px; } }
`;
  W.WORLD_RAIL = { open: k => { show(true); open(k || UI.sec || 'cover'); }, close, show, export: exportAll, apply: applyLook, look: lookNow };
})();
