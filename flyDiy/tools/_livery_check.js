#!/usr/bin/env node
// GATE LIVERY (G775) — one aeroplane's finish never reaches the next one.
//
//   node tools/_livery_check.js [--verbose] [--selftest]
//      -> "GATE LIVERY: PASS|FAIL", non-zero on FAIL
//
// THE REPORT (the user): "at some point, tests were loading the cessna, then
// the default plane came back, but with the cessna livery, the metallic paint,
// but still the original plane's color." Reproduced in headless Chrome before
// anything was changed: load bugReports/cessnaMetal (1).json, drop the
// working build, reload — the default aeroplane booted in its OWN colour
// (the colour is `spec.paint`, which the finish does not carry) under the
// Cessna's metal flake on twelve sections and its two metallic markings, and
// the join then exported that state into the spec, so the next save kept it.
//
// THE CAUSE WAS STATE, NOT THE POOL. Every load writes its finish to the
// `flydiy.aeroSections` pref (finishFromSpec -> aeroSavePrefs); the editor
// read that pref back at script eval; and the game's boot seed skips
// applySpec for a spec with no cage — the default plane — so nothing ever
// replaced what the pref said. The pool (aeroskin.js AERO_POOL) was measured
// clean: a direct A -> B load in the page leaves B byte-identical to a fresh
// boot. It is proven here anyway, because it is the other half of the claim.
//
// WHAT RUNS. No harness boots `_cage_ui.js` whole (it is the page), so this
// runs the editor's OWN finish code — the per-section maps, the prefs keeper,
// the boot read, finishFromSpec / finishToSpec, the marking's DEC and its kit,
// secMat, cut out of the source by declaration — and app.js's OWN seedEditor,
// over a localStorage shared between "page loads" (one vm context each) and
// the real AEROSKIN factory under the vendor three.js. Only the DOM is a stub.
// An applySpec stand-in carries the one thing applySpec does to the finish,
// and the source check below holds applySpec to it.
//
//   1  THE SEQUENCE, BOTH WAYS. A (the Cessna) then B (the default plane, no
//      cage), B' (the default plane with a finish of its own) after A, and A
//      after B': the second aeroplane's finish, every section's material
//      (colour, metalness, roughness, clear coat, the flake, the detail map
//      and its tile, the field, the wear rate) and the marking block equal a
//      clean load of that aeroplane in an empty browser — and A really does
//      wear its metal when loaded first, so the fingerprint can see it.
//   2  THE BOOT. A game page holds the FACTORY finish before any spec reaches
//      it, whatever the pref says (what an early join export would write); a
//      bench page still gets its memory back.
//   3  THE POOL. The factory's key covers every dial: two looks differing by
//      one dial are two materials, a look built after its neighbour equals
//      the same look built in a fresh pool, and building B leaves A's pooled
//      objects exactly as they were — in either order.
//   4  THE SOURCE. applySpec applies the finish unconditionally; the module
//      boots through aeroBootPrefs and never reads the pref bare; the decal
//      panel's read is guarded the same way.
//
// NEGATIVE-VERIFIED (--selftest): the guard removed, the seed's finish
// removed, both removed (the shipped bug), metalK out of the pool key — each
// must turn this gate red.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const CORE = require(path.join(__dirname, 'flight_core.js'));
const VERBOSE = process.argv.includes('--verbose');

// ---- the sources ------------------------------------------------------------
const SRC0 = {
  ui: rd('tools/_cage_ui.js'),
  app: rd('src/viewer/app.js'),
  skin: rd('src/viewer/aeroskin.js'),
};

// One declaration, by name, balanced: a function to its closing brace, a
// const / let to its terminating semicolon. Strings, templates and comments
// are skipped, so a brace in a comment does not count.
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
    if (c === '"' || c === "'" || c === '`') {
      for (j++; j < src.length && src[j] !== c; j++) if (src[j] === '\\') j++;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') { depth++; if (c === '{') braced = true; }
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (isFn && depth === 0 && c === '}' && braced) return { at: i, text: src.slice(i, j + 1) };
    } else if (c === ';' && depth === 0 && !isFn) return { at: i, text: src.slice(i, j + 1) };
  }
  throw new Error('unbalanced declaration: ' + what);
}

// the editor's finish code, in source order
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

// ---- the DOM, stubbed: a canvas whose 2D context answers everything ---------
const ctx2d = () => new Proxy({}, {
  get: (t, k) => {
    if (k in t) return t[k];
    if (k === 'createImageData' || k === 'getImageData')
      return (a, b, c, d) => { const w = ((c != null ? c : a) | 0) || 1, h = ((d != null ? d : b) | 0) || 1;
                               return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
    if (k === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
    if (/^create(Linear|Radial)Gradient$|^createPattern$/.test(k)) return () => ({ addColorStop() {} });
    return () => {};
  },
  set: (t, k, v) => { t[k] = v; return true; },
});
const canvas = () => { const g = ctx2d(); return { width: 1, height: 1, style: {}, getContext: () => g }; };

// ONE BROWSER: the store every page load of it shares
const browser = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
           removeItem: k => m.delete(k), keys: () => [...m.keys()] };
};

// THE FACTORY, ONCE PER SOURCE SET. Its texture bakes are procedural and cost
// seconds on the CPU, so every page load of a run shares one AEROSKIN module
// — which is STRICTER than a reload, not looser: the pool then persists from
// one "page" to the next, so a look pooled by the first aeroplane is there to
// be wrongly handed to the second. `aeroDispose` is the fresh pool.
const SKINS = new Map();
function skinOf(SRC) {
  if (SKINS.has(SRC.skin)) return SKINS.get(SRC.skin);
  const W = { THREE, console, Math, JSON, Object, Array, Map, Set, Number, String, Boolean,
              Float32Array, Uint8Array, Uint8ClampedArray, Uint16Array, Int8Array, Int16Array,
              Uint32Array, isFinite, Infinity, NaN, performance, setTimeout, clearTimeout,
              document: { createElement: k => (k === 'canvas' ? canvas() : { style: {} }) } };
  W.window = W; W.globalThis = W;
  vm.createContext(W);
  vm.runInContext(SRC.skin, W, { filename: 'aeroskin.js' });
  SKINS.set(SRC.skin, W.AEROSKIN);
  return W.AEROSKIN;
}

// ONE PAGE LOAD. `game` is the game's CAGE_IN_GAME flag. The editor bundle is
// ahead of aeroskin.js in the game (DEC takes its fallback literal), so the
// factory is handed over after the slice has run, and the order is kept.
function page(SRC, store, game, cons) {
  const W = { THREE, console, Math, JSON, Object, Array, Map, Set, Number, String, Boolean,
              isFinite, Infinity, NaN, localStorage: store };
  W.window = W; W.globalThis = W;
  if (game) W.CAGE_IN_GAME = 1;
  vm.createContext(W);
  const parts = UI_DECLS.map(([nm, re]) => grab(SRC.ui, re, '_cage_ui.js ' + nm)).sort((a, b) => a.at - b.at);
  const prelude = 'const P = { intCons: ' + JSON.stringify(cons) + ' };\nconst aeroOn = () => true;\n';
  const tail = '\nwindow.__ED = { aeroBootPrefs, finishFromSpec, finishToSpec, secMat, SEC_OVER };';
  vm.runInContext(prelude + parts.map(p => p.text).join('\n') + tail, W, { filename: '_cage_ui.js (slice)' });
  W.AEROSKIN = skinOf(SRC);
  const ED = W.__ED, A = W.AEROSKIN;
  ED.aeroBootPrefs();                        // what the module does at eval
  // app.js's own seed, over an applySpec that does to the finish exactly what
  // the real one does (held to it by the source check)
  const seedSrc = grab(SRC.app, /^ {2}function seedEditor\(\)/m, 'app.js seedEditor').text;
  const seed = spec => {
    W.CAGE_UI = { applySpec: s => ED.finishFromSpec(s && s.finish), finishFromSpec: ED.finishFromSpec,
                  build: () => {}, decalImagesFrom: () => {} };
    W.GARAGE_SPEC = { images: () => ({}) };
    W.__SPEC = JSON.parse(JSON.stringify(spec));
    vm.runInContext('(() => { let edSeeded = false; const genSpec = window.__SPEC;\n' + seedSrc +
                    '\nseedEditor(); })()', W, { filename: 'app.js seedEditor' });
  };
  return { W, ED, A, seed };
}

// ---- fingerprints -------------------------------------------------------------
const f4 = x => (x == null ? '-' : (+x).toFixed(4));
function matFp(m) {
  if (!m) return 'none';
  const U = (m.userData && m.userData.aeroU) || {};
  const v = k => (U[k] ? U[k].value : null);
  return [m.type, m.userData.aeroFinish, m.color ? m.color.getHexString() : '-',
    'met' + f4(m.metalness), 'r' + f4(m.roughness), 'cc' + f4(m.clearcoat), 'ccr' + f4(m.clearcoatRoughness),
    'op' + f4(m.opacity), 'fl' + f4(v('uFlake')), 'tile' + f4(v('uTileM') && v('uTileM').x),
    'nrm' + f4(v('uDetail') && v('uDetail').x), 'wk' + f4(v('uWearK')),
    'fld' + (v('uField') ? v('uField').toArray().map(f4).join(',') : '-'),
    'det' + (v('tDetail') ? m.userData.aeroFinish : '-'),
    'map' + (m.map ? 1 : 0), 'MK' + (m.userData.aeroMetalK || 0)].join('|');
}
function decFp(A) {
  const U = A.aeroSharedU(THREE);
  const n = U.uDecN.value, arr = k => U[k].value.slice(0, n).map(q => q.toArray().map(f4).join(',')).join(';');
  return 'n' + n + ' ' + ['uDecA', 'uDecB', 'uDecC', 'uDecD', 'uDecE'].map(arr).join(' / ');
}
// the aeroplane as the page holds it: every declared section's material, the
// marking block (the editor's live state, through the flight side's own door),
// and the finish it would export
function state(pg, spec) {
  const fin = pg.ED.finishToSpec();
  const mats = {};
  for (const nm of Object.keys(pg.A.AERO_SEC)) mats[nm] = matFp(pg.ED.secMat(nm, {}));
  pg.A.aeroApplySpecDecals(THREE, { finish: fin, paint: spec.paint, meta: spec.meta });
  return { fin: JSON.stringify(fin), mats, dec: decFp(pg.A) };
}

// ---- the builds ---------------------------------------------------------------
const A_ENV = JSON.parse(rd('bugReports/cessnaMetal (1).json'));
const SPEC_A = CORE.genNormaliseSpec(A_ENV.spec);
const SPEC_B = CORE.genNormaliseSpec({});                          // the default plane: no cage
// ...with a finish of its own. Laid on the NORMALISED default: a bare
// `{ finish }` is sniffed as a pre-G3 flat spec by genNormaliseSpec, which
// keeps no finish — the working build a page holds is always sectioned.
const SPEC_B2 = Object.assign(CORE.genNormaliseSpec({}), { finish: {
  sections: { body: { tint: 0x2a6f97 }, spat: { rough: 1.4 } },
  decals: { regH: 0.34 } } });
// key-order-free JSON, for "the same finish"
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.keys(x).sort().reduce((o, q) => { o[q] = x[q]; return o; }, {}) : x));
const consOfSpec = s => (s.cage && s.cage.intCons != null ? s.cage.intCons : 2);

function run(SRC) {
  const fail = [];
  let checks = 0;
  const check = (ok, label, extra) => { checks++; if (!ok) fail.push(label + (extra ? ' — ' + extra : '')); return ok; };
  const log = (...a) => { if (VERBOSE) console.log(...a); };

  // a clean load of `spec` in an empty browser, as a game page
  const clean = spec => { const pg = page(SRC, browser(), 1, consOfSpec(spec)); pg.seed(spec); return state(pg, spec); };
  const cmp = (tag, got, want) => {
    check(got.fin === want.fin, tag + ': the finish it would export is its own', got.fin + ' vs ' + want.fin);
    const bad = Object.keys(want.mats).filter(k => got.mats[k] !== want.mats[k]);
    check(!bad.length, tag + ': every section wears its own material',
          bad.length + ' differ, e.g. ' + bad.slice(0, 2).map(k => k + ': ' + got.mats[k] + ' vs ' + want.mats[k]).join(' ; '));
    check(got.dec === want.dec, tag + ': the marking block is its own', got.dec.slice(0, 160) + ' vs ' + want.dec.slice(0, 160));
    log('  ' + tag + ': ' + Object.keys(want.mats).length + ' sections, ' + bad.length + ' differ from a clean load');
    return bad.length;
  };

  // 1 THE SEQUENCE, BOTH WAYS -------------------------------------------------
  const pairs = [['A (cessnaMetal) then B (default, no cage)', SPEC_A, SPEC_B],
                 ["A then B' (default with its own finish)", SPEC_A, SPEC_B2],
                 ["B' then A", SPEC_B2, SPEC_A],
                 ['B then A', SPEC_B, SPEC_A]];
  for (const [tag, S1, S2] of pairs) {
    const store = browser();
    const p1 = page(SRC, store, 1, consOfSpec(S1)); p1.seed(S1);
    const st1 = state(p1, S1);
    // the first aeroplane really wears its finish, or the comparison sees nothing
    if (S1 === SPEC_A) {
      const metal = Object.values(st1.mats).filter(s => /MK1/.test(s)).length;
      check(metal >= 10, tag + ': the Cessna wears its metal flake when loaded (the fingerprint can see it)', metal + ' sections');
      check(/n2 /.test(st1.dec), tag + ': ...and its two markings', st1.dec.slice(0, 40));
    }
    const p2 = page(SRC, store, 1, consOfSpec(S2)); p2.seed(S2);
    // ABSOLUTE, not only against a clean load (which runs the same seed and
    // would share its fault): the aeroplane's own finish arrived, whole
    check(canon(p2.ED.finishToSpec()) === canon(S2.finish || null),
          tag + ': the second aeroplane holds exactly the finish its spec carries',
          canon(p2.ED.finishToSpec()).slice(0, 140) + ' vs ' + canon(S2.finish || null).slice(0, 140));
    cmp(tag, state(p2, S2), clean(S2));
  }

  // 2 THE BOOT -------------------------------------------------------------------
  {
    const store = browser();
    const p1 = page(SRC, store, 1, consOfSpec(SPEC_A)); p1.seed(SPEC_A);
    check(!!store.getItem('flydiy.aeroSections'), 'the load wrote its finish to the pref (the premise of the leak)');
    const game = page(SRC, store, 1, 2);
    check(game.ED.finishToSpec() === null, 'a GAME page holds the factory finish before any spec reaches it',
          JSON.stringify(game.ED.finishToSpec()).slice(0, 160));
    const bench = page(SRC, store, 0, 2);
    const bf = bench.ED.finishToSpec();
    check(!!(bf && bf.sections && bf.sections.body && bf.sections.body.metal === 1),
          'a BENCH page still gets its memory back from the pref', JSON.stringify(bf).slice(0, 120));
  }

  // 3 THE POOL ---------------------------------------------------------------------
  {
    const base = { finish: 'alclad', tint: 0x9aa4ad, surf: 1, fieldM: 1 };
    const dials = { tint: 0xf2c437, metalK: 1, roughK: 0.6, ccK: 0.3, tileK: 1.7, nrmK: 0.5,
                    fieldK: 1.8, fieldLK: 0.6, wearM: 0.4, wearK: 2.5, opacity: 0.6 };
    const A = skinOf(SRC);
    const fresh = o => { A.aeroDispose(); return matFp(A.aeroMaterial(THREE, o)); };
    for (const k in dials) {
      const oA = Object.assign({}, base), oB = Object.assign({}, base, { [k]: dials[k] });
      for (const [first, second, tag] of [[oA, oB, 'A then B'], [oB, oA, 'B then A']]) {
        const want = fresh(second);
        A.aeroDispose();
        const m1 = A.aeroMaterial(THREE, first), fp1 = matFp(m1);
        const m2 = A.aeroMaterial(THREE, second);
        check(m1 !== m2, 'the pool key covers `' + k + '` (' + tag + ': two looks, two materials)');
        check(matFp(m2) === want, 'the pool: `' + k + '` ' + tag + ' — the second look equals a fresh pool\'s',
              matFp(m2) + ' vs ' + want);
        check(matFp(m1) === fp1, 'the pool: `' + k + '` ' + tag + ' — building the second left the first untouched');
        check(A.aeroMaterial(THREE, first) === m1, 'the pool: `' + k + '` ' + tag + ' — the first look is still pooled');
      }
    }
    A.aeroDispose();
  }

  // 4 THE SOURCE -------------------------------------------------------------------
  {
    const ap = grab(SRC.ui, /^function applySpec\(/m, 'applySpec').text;
    check(/\n {2}finishFromSpec\(spec && spec\.finish\);/.test(ap),
          'applySpec applies the finish unconditionally (the stand-in above relies on it)');
    check(/^aeroBootPrefs\(\);$/m.test(SRC.ui) && !/^aeroLoadPrefs\(\);$/m.test(SRC.ui),
          'the module boots through aeroBootPrefs and never reads the pref bare');
    const bd = grab(SRC.ui, /^function buildDecPanel\(/m, 'buildDecPanel').text;
    check(/if \(aeroPrefsOwn\(\)\) decLoadPrefs\(\);/.test(bd) && !/\n {2}decLoadPrefs\(\);/.test(bd),
          'the decal panel reads the marking pref only where the pref owns it');
  }
  return { fail, checks };
}

// ---- the verdict, and the proof it can fail ------------------------------------
if (process.argv.includes('--selftest')) {
  const probes = [
    ['the boot guard removed', S => Object.assign({}, S, { ui: S.ui.replace(
      'function aeroBootPrefs() { if (aeroPrefsOwn()) aeroLoadPrefs(); }',
      'function aeroBootPrefs() { aeroLoadPrefs(); }') })],
    ["the seed's finish removed", S => Object.assign({}, S, { app: S.app.replace(
      /if \(E\.finishFromSpec\)\n\s*try \{ E\.finishFromSpec\(genSpec\.finish \|\| null\); if \(E\.build\) E\.build\(\); \}\n\s*catch \(err\) \{ console\.error\('cage editor seed \(finish\):', err\); \}/,
      '') })],
    ['both removed (the shipped bug)', S => {
      const a = probes[0][1](S); return probes[1][1](a); }],
    ['metalK out of the pool key', S => Object.assign({}, S, { skin: S.skin.replace(
      "'Q' + (o.metalK != null ? o.metalK : 0),", '') })],
  ];
  let ok = true;
  for (const [nm, patch] of probes) {
    const S = patch(SRC0);
    const changed = S.ui !== SRC0.ui || S.app !== SRC0.app || S.skin !== SRC0.skin;
    let r;
    try { r = run(S); } catch (e) { r = { fail: ['threw: ' + e.message], checks: 0 }; }
    const red = changed && r.fail.length > 0;
    console.log('  selftest ' + (red ? 'RED  ' : 'GREEN') + ' ' + nm + (changed ? '' : ' (the patch did not apply)') +
                (r.fail.length ? ' — ' + r.fail[0].slice(0, 140) : ''));
    if (!red) ok = false;
  }
  console.log('GATE LIVERY selftest: ' + (ok ? 'PASS (every probe red)' : 'FAIL'));
  process.exit(ok ? 0 : 1);
}

const { fail, checks } = run(SRC0);
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE LIVERY: FAIL (' + fail.length + ' of ' + checks + ')');
  process.exit(1);
}
console.log('  ' + checks + ' checks: A -> B and back, the boot, the pool key (11 dials both ways), the source');
console.log('GATE LIVERY: PASS');
