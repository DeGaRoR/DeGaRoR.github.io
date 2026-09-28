#!/usr/bin/env node
// _groundlib_check.js - GATE GROUNDLIB: THE ONE GROUND LIBRARY, AND THE SAME TEXELS (G912, AS2).
//
// src/viewer/ground_tex.js (tools/ground_tex_prep.js) is the ONE table the splat, the pavement, the lot and the site
// read; the texture-array layers are COOKED offline (tools/array_cook.js) and copied into the arrays by
// src/viewer/ground_lib.js - no canvas in the page. This gate holds:
//   1. THE STORE     every map and cooked file the table names is on disk; every cooked file gunzips to exactly two
//                    px x px RGBA planes and its name's hash is the hash of those raw bytes (GATE GEO's rule)
//   2. THE TEXELS    per library and key, what the page gets is what it got before the library was one:
//                    - splat / pavement: the SHA-256 of each cooked plane equals what the OLD code (pavement.js
//                      library(), splat_ground.js buildArrays) packed in Chrome from the old manifests -
//                      tools/perf/ground_layers_before.json, made by tools/ground_layers_chrome.js at b3bf0431;
//                    - lot / site (plain textures): each map file's SHA-256 equals the old manifest's file's;
//                    - every splat / pavement map file too (the previews, the plain-texture consumers)
//                    A DELIBERATE change of a set (a re-import, a tone) re-takes the fingerprints:
//                    `node tools/_groundlib_check.js --update` (says what moved; the Chrome proof stays in git)
//   3. THE KEYS      every library keeps every key it had, in its order; every key a recipe names (the pavement's
//                    class slots, the splat's codes) has a cooked layer
//   4. THE COOK      (python + Pillow present) every cooked file is re-cooked in memory from the maps the table names
//                    and equals the shipped bytes - a map edited without a re-bake is caught
//   5. NO CANVAS     pavement.js's library, splat_ground.js and ground_lib.js draw and read no canvas
// --selftest breaks each in turn.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const FP_FILE = path.join(ROOT, 'tools', 'perf', 'ground_layers_before.json');
const SELF = process.argv.includes('--selftest'), UPDATE = process.argv.includes('--update');
let fails = 0;
const out = [];
const verdict = (ok, line, detail) => { if (!ok) fails++; out.push((ok ? 'PASS ' : 'FAIL ') + line + (detail ? '  (' + detail + ')' : '')); return ok; };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const t0 = Date.now();

const { GROUND_TEX: T } = require('../src/viewer/ground_tex.js');
const G = require('../src/core/28b_ground_fields.js');
const P = require('../src/viewer/pavement.js');
const FP = JSON.parse(fs.readFileSync(FP_FILE, 'utf8'));
const px = T.px, S = px * px * 4;
const abs = rel => path.join(ROOT, ...rel.split('/'));

// ---- 1. the store ---------------------------------------------------------------------------------------------
function readCooked(rel) {
  const raw = zlib.gunzipSync(fs.readFileSync(abs(rel)));
  return raw;
}
function checkStore(T, quiet) {
  let ok = true; const missing = [], bad = [];
  const layers = {};
  for (const [k, s] of Object.entries(T.sets)) {
    for (const m of ['diff', 'nor', 'rough', 'height', 'layers']) if (s[m] && !fs.existsSync(abs(s[m]))) missing.push(s[m]);
    if (!s.layers || !fs.existsSync(abs(s.layers))) continue;
    let raw = null; try { raw = readCooked(s.layers); } catch (e) { bad.push(k + ': ' + e.message); continue; }
    const h8 = /\.([0-9a-f]{8})\.gz\.bin$/.exec(s.layers);
    if (raw.length !== 2 * S) bad.push(k + ': ' + raw.length + ' bytes, not 2 x ' + px + '^2 x 4');
    else if (!h8 || sha(raw).slice(0, 8) !== h8[1]) bad.push(k + ': the name\'s hash is not the raw bytes\' (' + (h8 && h8[1]) + ' vs ' + sha(raw).slice(0, 8) + ')');
    layers[k] = raw;
  }
  const nCooked = Object.values(T.sets).filter(s => s.layers).length;
  ok = verdict(!missing.length, `1 every file the table names is on disk (${Object.keys(T.sets).length} sets)`, missing.length ? 'missing ' + missing.slice(0, 3).join(', ') : '') && ok;
  ok = verdict(!bad.length && Object.keys(layers).length === nCooked, `1 every cooked file (${nCooked}) is one gzip stream of two ${px}^2 RGBA planes, named by the raw bytes' hash`, bad.slice(0, 3).join('; ')) && ok;
  return { ok, layers };
}

// ---- 2. the texels --------------------------------------------------------------------------------------------
function checkTexels(T, layers, FP) {
  let ok = true;
  const lib = L => T.libs[L];
  for (const L of ['splat', 'pavement']) {
    const want = FP[L] || {}, diff = [], seen = [];
    for (const a of lib(L)) {
      const raw = layers[a.set]; if (!raw || !want[a.key]) { diff.push(a.key + ' (no ' + (raw ? 'fingerprint' : 'layer') + ')'); continue; }
      const hA = sha(raw.subarray(0, S)), hN = sha(raw.subarray(S, 2 * S));
      if (hA !== want[a.key].A || hN !== want[a.key].N) diff.push(a.key + (hA !== want[a.key].A ? ' A' : '') + (hN !== want[a.key].N ? ' N' : ''));
      seen.push(a.key);
    }
    ok = verdict(!diff.length && seen.length === Object.keys(want).length,
      `2 ${L}: every key's two cooked planes are the texels the old code packed in Chrome (${seen.length} keys x 2 planes, ${FP.base} ${FP.chrome || ''})`.replace(' )', ')'), diff.slice(0, 6).join(', ')) && ok;
  }
  const mapsOf = (L, maps) => { const d = []; let n = 0;
    for (const a of lib(L)) { const s = T.sets[a.set], w = (maps || {})[a.key]; if (!w) { d.push(a.key + ' (no fingerprint)'); continue; }
      for (const m of Object.keys(w)) { n++; if (!s[m] || sha(fs.readFileSync(abs(s[m]))) !== w[m]) d.push(a.key + '.' + m); } }
    return { d, n }; };
  for (const [L, maps, what] of [['lot', FP.lot, 'bound as plain textures'], ['site', FP.site, 'bound as plain textures'],
                                 ['splat', FP.maps && FP.maps.splat, 'the previews'], ['pavement', FP.maps && FP.maps.pavement, 'the bench']]) {
    const { d, n } = mapsOf(L, maps);
    ok = verdict(!d.length && n > 0, `2 ${L}: every map file is byte for byte the old manifest's (${n} maps; ${what})`, d.slice(0, 6).join(', ')) && ok;
  }
  return ok;
}

// ---- 3. the keys ------------------------------------------------------------------------------------------------
function checkKeys(T, FP) {
  let ok = true;
  for (const L of ['splat', 'pavement', 'lot', 'site']) {
    const had = Object.keys(FP[L] || {}), now = T.libs[L].map(a => a.key);
    ok = verdict(had.length > 0 && had.length === now.length && had.every((k, i) => now[i] === k), `3 ${L}: the same ${had.length} keys, in the same order`, had.filter(k => !now.includes(k)).join(', ')) && ok;
  }
  const lib = G.RECIPE.library.map(x => x[0]);
  ok = verdict(T.libs.splat.every((a, i) => a.key === lib[i]), '3 the splat\'s rows are RECIPE.library\'s order (a row\'s index is its layer)') && ok;
  const need = new Set(); for (const c of Object.values(G.RECIPE.codes)) for (const k of (c.tex || []).concat(c.far || [])) if (k) need.add(k);
  const sp = new Map(T.libs.splat.map(a => [a.key, a]));
  const noL = [...need].filter(k => !sp.has(k) || !T.sets[sp.get(k).set].layers);
  ok = verdict(!noL.length, `3 every set the splat's codes name has a cooked layer (${need.size})`, noL.join(', ')) && ok;
  const pv = new Map(T.libs.pavement.map(a => [a.key, a])), pk = P.keysFor(P.CLASSES);
  const noP = pk.filter(k => !pv.has(k) || !T.sets[pv.get(k).set].layers);
  ok = verdict(!noP.length, `3 every set the pavement's classes name has a cooked layer (${pk.length})`, noP.join(', ')) && ok;
  return ok;
}

// ---- 4. the cook reproduces -----------------------------------------------------------------------------------
function checkCook(T, layers) {
  let AC; try { AC = require('./array_cook.js'); } catch (e) { out.push('  (4 skipped: ' + e.message + ')'); return true; }
  const entries = Object.entries(T.sets).filter(([, s]) => s.layers).map(([k, s]) => ({ key: k, stem: k, planes: [
    [{ img: abs(s.diff), ch: 0 }, { img: abs(s.diff), ch: 1 }, { img: abs(s.diff), ch: 2 }, { img: s.height ? abs(s.height) : null, ch: 0, or: 128 }],
    [{ img: abs(s.nor), ch: 0 }, { img: abs(s.nor), ch: 1 }, { img: abs(s.nor), ch: 2 }, { img: s.rough ? abs(s.rough) : null, ch: 0, or: 230 }]] }));
  let dec; try { dec = AC.decodeAll(entries, px); } catch (e) {
    if (/python|PIL|Pillow|No module|ENOENT|spawn/i.test(e.message)) { out.push('  (4 skipped: no python + Pillow here - the cook cannot be re-run)'); return true; }
    return verdict(false, '4 the maps decode', e.message.slice(0, 200)); }
  const diff = entries.filter(e => !layers[e.key] || !AC.packEntry(e, px, dec).equals(layers[e.key])).map(e => e.key);
  return verdict(!diff.length, `4 every cooked file is what the cook makes from the table's maps now (${entries.length} re-cooked in memory)`, diff.join(', '));
}

// ---- 5. no canvas ---------------------------------------------------------------------------------------------
function checkNoCanvas(plant) {
  const src = f => fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8');
  const pv = src('pavement.js'), a = pv.indexOf('  function library('), b = pv.indexOf('  // THE SHARED LIBRARY');
  const texts = { 'pavement.js library()': a >= 0 && b > a ? pv.slice(a, b) : null, 'splat_ground.js': src('splat_ground.js'), 'ground_lib.js': src('ground_lib.js') };
  if (plant) texts['ground_lib.js'] += plant;
  const code = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');   // the code, not the comments that say what it no longer does
  const hit = Object.entries(texts).filter(([, t]) => t === null || /getImageData|drawImage|getContext\(\s*['"]2d/.test(code(t))).map(([k]) => k);
  return verdict(!hit.length, '5 no canvas in the ground\'s array path (pavement.js library, splat_ground.js, ground_lib.js)', hit.join(', '));
}

// ---- main -----------------------------------------------------------------------------------------------------
if (UPDATE) {
  const st = checkStore(T, true);
  const nf = { base: 'accepted by node tools/_groundlib_check.js --update (' + new Date().toISOString().slice(0, 10) + '); the Chrome proof of the migration: git log ' + path.relative(ROOT, FP_FILE),
    chrome: '', made: 'tools/_groundlib_check.js --update', layer: FP.layer, splat: {}, pavement: {}, lot: {}, site: {}, maps: { splat: {}, pavement: {} } };
  const moved = [];
  for (const L of ['splat', 'pavement']) for (const a of T.libs[L]) { const raw = st.layers[a.set]; if (!raw) continue;
    nf[L][a.key] = { A: sha(raw.subarray(0, S)), N: sha(raw.subarray(S)) };
    if (!FP[L][a.key] || FP[L][a.key].A !== nf[L][a.key].A || FP[L][a.key].N !== nf[L][a.key].N) moved.push(L + '.' + a.key); }
  const mapsOf = (L, list) => { const o = {}; for (const a of T.libs[L]) { o[a.key] = {}; for (const m of list) { const s = T.sets[a.set]; if (s[m]) o[a.key][m] = sha(fs.readFileSync(abs(s[m]))); } } return o; };
  nf.lot = mapsOf('lot', ['diff', 'nor', 'rough']); nf.site = mapsOf('site', ['diff', 'nor', 'rough']);
  nf.maps.splat = mapsOf('splat', ['diff', 'nor', 'rough', 'height']); nf.maps.pavement = mapsOf('pavement', ['diff', 'nor', 'rough', 'height']);
  fs.writeFileSync(FP_FILE, JSON.stringify(nf, null, 1) + '\n');
  console.log('fingerprints re-taken -> ' + path.relative(ROOT, FP_FILE) + (moved.length ? '; layers that moved: ' + moved.join(', ') : '; no layer moved'));
  process.exit(0);
}
if (SELF) {
  console.log('  --selftest: breaking each rule in turn');
  const st = checkStore(T, true); out.length = 0; fails = 0;
  const T2 = JSON.parse(JSON.stringify(T));
  const k0 = T.libs.splat[0].set, p0 = T.libs.pavement[0].set;
  const L2 = Object.assign({}, st.layers); L2[k0] = Buffer.from(st.layers[k0]); L2[k0][12345] ^= 1;
  const r = [];
  r.push(['a splat layer one bit off', !checkTexels(T, L2, FP)]);
  const L3 = Object.assign({}, st.layers); L3[p0] = Buffer.from(st.layers[p0]); L3[p0][S + 7] ^= 1;
  r.push(['a pavement normal plane one bit off', !checkTexels(T, L3, FP)]);
  const T4 = JSON.parse(JSON.stringify(T)); T4.sets[k0].layers = T4.sets[k0].layers.replace(/\.[0-9a-f]{8}\.gz\.bin$/, '.deadbeef.gz.bin');
  r.push(['a cooked file missing from the store', !checkStore(T4, true).ok]);
  const T5 = JSON.parse(JSON.stringify(T)); const lotA = T5.libs.lot.find(a => a.key === 'dirt'); lotA.set = 'siteDirt';
  r.push(['the lot\'s dirt pointed at the site\'s dirt (another texel set)', !checkTexels(T5, st.layers, FP)]);
  const T6 = JSON.parse(JSON.stringify(T)); T6.libs.pavement.pop();
  r.push(['a pavement key dropped', !checkKeys(T6, FP)]);
  const T7 = JSON.parse(JSON.stringify(T)); const sw = T7.libs.splat[1]; T7.libs.splat[1] = T7.libs.splat[2]; T7.libs.splat[2] = sw;
  r.push(['two splat rows swapped (their layer indices)', !checkKeys(T7, FP)]);
  r.push(['a canvas read back in the array path', !checkNoCanvas('\n  const d = ctx.getImageData(0, 0, 512, 512).data;')]);
  out.length = 0; fails = 0;
  for (const [what, caught] of r) verdict(caught, 'SELF-TEST ' + what + ' is caught');
  verdict(checkStore(T, true).ok && checkTexels(T, st.layers, FP) && checkKeys(T, FP), 'SELF-TEST the tree as it stands passes');
  for (const l of out.filter(l => /SELF-TEST/.test(l))) console.log(l);
  const f = out.filter(l => /^FAIL.*SELF-TEST/.test(l)).length;
  console.log(`GATE GROUNDLIB (selftest): ${f ? 'FAIL' : 'PASS'}`); process.exit(f ? 1 : 0);
}
console.log('GATE GROUNDLIB - the one ground library (src/viewer/ground_tex.js) and the same texels');
const st = checkStore(T, false);
checkTexels(T, st.layers, FP);
checkKeys(T, FP);
checkCook(T, st.layers);
checkNoCanvas();
for (const l of out) console.log(l);
const nL = Object.values(T.sets).filter(s => s.layers).length;
console.log(`  ${Object.keys(T.sets).length} sets (${nL} cooked), aliases: splat ${T.libs.splat.length}, pavement ${T.libs.pavement.length}, lot ${T.libs.lot.length}, site ${T.libs.site.length}; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`GATE GROUNDLIB: ${fails ? 'FAIL (' + fails + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
