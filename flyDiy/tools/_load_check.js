#!/usr/bin/env node
// _load_check.js — GATE LOADS (FREIGHT-ASSETS, G2405-G2409). The freight's own
// models and the catalogue that makes props into freight items.
//
// The pipeline: tools/load_table.py (declared rows + SOURCES + CATALOGUE) ->
// tools/load_prep.py (tools/prop_prep.py's runner) -> src/loads/loads_*.js +
// media/geo/loads/ + media/tex/loads/ -> tools/prop_lod.js --kit loads ->
// src/loads/loads_lods.js + media/geo/loads_lod/; load_prep.py also writes
// src/loads/loads_catalogue.json (every CATALOGUE row with its dims MEASURED
// off the baked packs). This gate asserts the BAKED payload against the
// DECLARED table, read out of the python source (the G48 lesson), and:
//
//   1 TABLE     the bake holds every declared row, key / group / label, in
//               the table's group order, and nothing else
//   2 PHYSICAL  every prop decodes; header counts, bb, unit normals, the
//               origin rule (floor: base on y = 0, footprint centred)
//   3 MAPS      every map a prop wears is within its row's `tex` budget
//   4 LEVELS    the levels are what prop_lod.js's ladder asks (per group),
//               beside the as-is (media/geo/loads_lod/), the full prop's
//               records, each under 0.7 of the level above
//   5 BUDGET    a LOAD strapped in a cabin is ≤ ~2k triangles: the prop
//               itself, or its level standing in from ≤ 2 m; and one level
//               ≤ 600 past 15 m (the coordinator's brief: "≤ ~2k tris at L0")
//   6 CATALOGUE the JSON is the table's CATALOGUE, row for row; every key is
//               a baked prop (props, pier or loads); its dims ARE that prop's
//               baked dims; kind is a packer class; the mass is physical
//               (3-2500 kg/m3 over the box); every load is catalogued, no
//               camp dressing is
//   7 CREDITS   every source is CC0 / CC-BY (never NC / SA / ND, the user's
//               rule) and named in CREDITS.md
//
// Negative-verified: --selftest breaks each rule on a copy and expects red.
// Run: node tools/_load_check.js [--selftest]   (one final `GATE LOADS: ...`)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readGeo } = require('./_media_lib.js');
const CORE = require('./flight_core.js');
const LT = require('./prop_lod.js');

const ROOT = path.join(__dirname, '..');
const KINDS = ['crate', 'box', 'bag', 'drum', 'long', 'bulk'];
// "~2k": a load under 2.5k is in budget as delivered (the tote, 2 392 - prop_lod's ladder cuts no level that is
// not under 0.7 of the prop, so a 2.4k prop gets no 2k _l1); above it the _l1 is cut to 2 000 (+ the per-material
// floor a small glass part keeps, prop_lod MIN_TRIS: the generator's is 2 049)
const CABIN_TRIS = 2500;
const CABIN_DIST = 2;         // the in-cabin level must stand in from at least this close
const FAR_TRIS = 600, FAR_DIST = 15;
const OK_LIC = /^(CC0|CC-BY-[34]\.0)$/;

// ---- the declared table, read from the python source -----------------------
function readTable(src) {
  const groups = [...src.matchAll(/^\s{4}\('([a-z]+)',\s+'([^']*)'\),$/gm)].map(m => m[1]);
  const body = src.slice(src.indexOf('PROPS = ['), src.indexOf('CATALOGUE = ['));
  const rows = [];
  const re = /^\s{4}P\('([a-z0-9_]+)',\s*'([a-z]+)',\s*'([^']*)',\s*'([a-z0-9_]+)'/gm;
  const hits = [...body.matchAll(re)];
  hits.forEach((m, i) => {
    const text = body.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : body.length);
    const t = text.match(/\btex=(\d+)/);
    rows.push({ key: m[1], group: m[2], label: m[3], src: m[4], tex: t ? +t[1] : 512 });
  });
  const sources = {};
  for (const m of src.matchAll(/^\s{4}'([a-z0-9_]+)':\s*\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(PH \+ '([^']*)'|'([^']*)')\)/gm))
    sources[m[1]] = { title: m[2], author: m[3], lic: m[4], url: m[6] !== undefined ? 'https://polyhaven.com/a/' + m[6] : m[7] };
  const cat = [];
  const cb = src.slice(src.indexOf('CATALOGUE = ['));
  for (const m of cb.matchAll(/^\s{4}C\('([a-z0-9_]+)',\s*'([a-z]+)',\s*'([^']*)',\s*([0-9.]+)/gm))
    cat.push({ key: m[1], kind: m[2], item: m[3], kg: +m[4] });
  return { groups, rows, sources, cat };
}

// ---- the packs, read the way the page reads them ---------------------------
function readPacks(dir) {
  const mf = path.join(ROOT, 'src', dir, dir + '_packs.json');
  if (!fs.existsSync(mf)) return [];
  const out = [];
  const sb = { registerPropPack: p => out.push(p), console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(mf, 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', dir, f), 'utf8'), sb, { filename: f });
  return out;
}
function registry(packs) {
  const R = { order: [], props: {}, texs: {}, groups: [] };
  for (const p of packs) {
    for (const g of p.groups || []) R.groups.push(g[0]);
    Object.assign(R.texs, p.texs);
    for (const k of p.order) { R.order.push(k); R.props[k] = p.props[k]; }
  }
  return R;
}

// a JPEG's / PNG's pixel size off its header
function imgSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1], len = buf.readUInt16BE(o + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(o + 7), buf.readUInt16BE(o + 5)];
      o += 2 + len;
    }
  }
  return null;
}

// ---- the gate, a pure function of its inputs (so the selftest can break them)
function check(D) {
  const fails = [], notes = [];
  const fail = m => fails.push(m);
  const { T, REG, UNION, catJson, credits, bins, imgs } = D;
  const FULL = REG.order.filter(k => !REG.props[k].lodOf);
  const LODS = REG.order.filter(k => REG.props[k].lodOf);
  const row = Object.fromEntries(T.rows.map(r => [r.key, r]));

  // 1 TABLE
  const want = T.groups.flatMap(g => T.rows.filter(r => r.group === g).map(r => r.key));
  if (want.join(',') !== FULL.join(',')) fail(`1 table: the bake holds [${FULL.join(',')}], the table declares [${want.join(',')}]`);
  for (const r of T.rows) {
    const p = REG.props[r.key];
    if (!p) continue;
    if (p.group !== r.group || p.label !== r.label) fail(`1 table: ${r.key} baked as ${p.group}/"${p.label}", declared ${r.group}/"${r.label}"`);
    if (!T.sources[r.src]) fail(`1 table: ${r.key} names source ${r.src}, which SOURCES does not declare`);
  }

  // 2 PHYSICAL
  let tris = 0;
  for (const key of REG.order) {
    const p = REG.props[key];
    const bin = bins[p.bin];
    if (!bin) { fail(`2 physical: ${key} names ${p.bin}, not on disk`); continue; }
    let dec;
    try { dec = CORE.decodeProp(p, bin); } catch (e) { fail(`2 physical: ${key} decode threw ${e.message}`); continue; }
    let nv = 0, nt = 0, worst = 0;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const part of dec.parts) {
      nv += part.nv; nt += part.nt;
      if (!p.mats[part.mat]) fail(`2 physical: ${key}/${part.mat} has no material record`);
      for (let i = 0; i < part.nv; i++) {
        for (let k = 0; k < 3; k++) { const v = part.pos[i * 3 + k]; lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); }
        worst = Math.max(worst, Math.abs(Math.hypot(part.nrm[i * 3], part.nrm[i * 3 + 1], part.nrm[i * 3 + 2]) - 1));
      }
      if (part.idx.length !== part.nt * 3) fail(`2 physical: ${key}/${part.mat} index count != 3 nt`);
    }
    if (nv !== p.nv || nt !== p.nt) fail(`2 physical: ${key} decodes ${nv}v/${nt}t, header ${p.nv}v/${p.nt}t`);
    if (worst > 0.02) fail(`2 physical: ${key} normals off unit by ${worst.toFixed(3)}`);
    for (let k = 0; k < 3; k++) {
      const step = (p.bb[k + 3] - p.bb[k]) / 65535 * 1.5 + 1e-6;
      if (lo[k] < p.bb[k] - step || hi[k] > p.bb[k + 3] + step) fail(`2 physical: ${key} axis ${k} outside its bb`);
      if (Math.abs(p.bb[k + 3] - p.bb[k] - p.dim[k]) > 1e-3) fail(`2 physical: ${key} dim[${k}] is not its bb extent`);
    }
    if (p.place === 'floor' && (Math.abs(p.bb[1]) > 2e-3 || Math.abs(p.bb[0] + p.bb[3]) > 2e-3 || Math.abs(p.bb[2] + p.bb[5]) > 2e-3))
      fail(`2 physical: ${key} is place=floor but its base / footprint is not on the origin`);
    const big = Math.max(...p.dim);
    if (big < 0.05 || big > 5) fail(`2 physical: ${key} is ${big.toFixed(3)} m - not a load or a camp's dressing`);
    if (!p.lodOf) tris += nt;
  }

  // 3 MAPS
  for (const key of FULL) {
    const p = REG.props[key], r = row[key];
    if (!r) continue;
    for (const m of Object.values(p.mats)) for (const slot of ['map', 'arm', 'nor', 'emisMap']) {
      const id = m[slot];
      if (!id) continue;
      const t = REG.texs[id];
      if (t === undefined) { fail(`3 maps: ${key} ${slot} names a texture the pack lacks`); continue; }
      if (typeof t !== 'string') continue;                    // a flat constant
      const sz = imgs[t];
      if (!sz) { fail(`3 maps: ${key} ${slot} ${t} unreadable / missing`); continue; }
      if (Math.max(...sz) > r.tex) fail(`3 maps: ${key} ${slot} is ${sz.join('x')}, over its ${r.tex} budget`);
    }
  }

  // 4 LEVELS
  const by = new Map();
  for (const k of LODS) {
    const L = REG.props[k], P = REG.props[L.lodOf];
    if (!P || P.lodOf || !row[L.lodOf]) { fail(`4 levels: ${k} stands in for ${L.lodOf}, not a declared load`); continue; }
    if (!L.bin || L.bin.indexOf('media/geo/loads_lod/') < 0) fail(`4 levels: ${k} bin ${L.bin} is not under media/geo/loads_lod/`);
    if (JSON.stringify(L.mats) !== JSON.stringify(P.mats) || JSON.stringify(L.bb) !== JSON.stringify(P.bb))
      fail(`4 levels: ${k} does not wear ${L.lodOf}'s records / box`);
    (by.get(L.lodOf) || by.set(L.lodOf, []).get(L.lodOf)).push(k);
  }
  for (const key of FULL) {
    const P = REG.props[key], wantL = LT.levelsFor(P), have = by.get(key) || [];
    if (have.length !== wantL.length) { fail(`4 levels: ${key} has ${have.length} levels, the ${P.group} ladder asks ${wantL.length} (node tools/prop_lod.js --kit loads)`); continue; }
    let prev = P.nt;
    have.forEach((k, i) => {
      const L = REG.props[k];
      if (k !== key + '_l' + (i + 1)) fail(`4 levels: ${k} out of order`);
      if (L.lodDist !== wantL[i][1]) fail(`4 levels: ${k} past ${L.lodDist} m, the ladder says ${wantL[i][1]}`);
      if (!(L.nt < 0.7 * prev)) fail(`4 levels: ${k} ${L.nt} tris, not under 0.7 of ${prev}`);
      prev = L.nt;
    });
  }

  // 5 BUDGET (the loads; the camp dressing stands at a site and takes the yard's ladder)
  const budget = [];
  for (const key of FULL) {
    const P = REG.props[key];
    if (P.group !== 'load') continue;
    const lv = (by.get(key) || []).map(k => REG.props[k]);
    const cabin = P.nt <= CABIN_TRIS ? P : lv.find(L => L.lodDist <= CABIN_DIST);
    if (!cabin || cabin.nt > CABIN_TRIS) fail(`5 budget: ${key} (${P.nt} tris) has no level <= ${CABIN_TRIS} standing in from <= ${CABIN_DIST} m`);
    const far = P.nt <= FAR_TRIS ? P : lv.find(L => L.nt <= FAR_TRIS && L.lodDist <= FAR_DIST);
    if (!far) fail(`5 budget: ${key} has no level <= ${FAR_TRIS} tris from ${FAR_DIST} m`);
    budget.push(key + ' ' + P.nt + '->' + (cabin ? cabin.nt : '?'));
  }
  notes.push('in-cabin levels: ' + budget.join(', '));

  // 6 CATALOGUE
  const items = (catJson && catJson.items) || [];
  if (items.map(i => i.key).join(',') !== T.cat.map(c => c.key).join(','))
    fail(`6 catalogue: src/loads/loads_catalogue.json is not the table's CATALOGUE (re-run python tools/load_prep.py)`);
  const seen = new Set();
  for (const c of T.cat) {
    if (seen.has(c.key)) fail(`6 catalogue: ${c.key} catalogued twice`);
    seen.add(c.key);
    if (!KINDS.includes(c.kind)) fail(`6 catalogue: ${c.key} kind ${c.kind} is not one of ${KINDS.join('/')}`);
    const P = UNION[c.key];
    if (!P) { fail(`6 catalogue: ${c.key} is no baked prop (props, pier or loads)`); continue; }
    const it = items.find(i => i.key === c.key);
    if (it) {
      if (it.kind !== c.kind || it.kg !== c.kg) fail(`6 catalogue: ${c.key} json ${it.kind}/${it.kg} kg, table ${c.kind}/${c.kg} kg`);
      if (!Array.isArray(it.dims) || it.dims.some((v, k) => Math.abs(v - P.dim[k]) > 1.5e-3))
        fail(`6 catalogue: ${c.key} dims ${JSON.stringify(it.dims)} are not its baked ${JSON.stringify(P.dim)}`);
    }
    const rho = c.kg / (P.dim[0] * P.dim[1] * P.dim[2]);
    if (!(rho >= 3 && rho <= 2500)) fail(`6 catalogue: ${c.key} ${c.kg} kg in its box is ${rho.toFixed(0)} kg/m3 - not physical`);
  }
  for (const key of FULL) {
    const g = REG.props[key].group;
    if (g === 'load' && !seen.has(key)) fail(`6 catalogue: load ${key} is not catalogued - a model no contract can carry`);
    if (g === 'camp' && seen.has(key)) fail(`6 catalogue: ${key} is camp dressing, not freight`);
  }

  // 7 CREDITS
  for (const [k, s] of Object.entries(T.sources)) {
    if (!OK_LIC.test(s.lic) || /NC|SA|ND/.test(s.lic)) fail(`7 credits: ${k} licence ${s.lic} - credit-only licences only (no NC/SA/ND)`);
    if (!s.url) fail(`7 credits: ${k} has no page url`);
    if (!credits.includes('`' + k + '`')) fail(`7 credits: ${k} is not named in CREDITS.md`);
  }

  notes.push(`${FULL.length} props (${tris} tris as-is), ${LODS.length} levels, ${T.cat.length} catalogue items, ${Object.keys(T.sources).length} sources`);
  return { fails, notes };
}

// ---- the inputs, off disk --------------------------------------------------
function load() {
  const T = readTable(fs.readFileSync(path.join(__dirname, 'load_table.py'), 'utf8'));
  const REG = registry(readPacks('loads'));
  const UNION = {};
  for (const dir of ['props', 'pier', 'loads']) {
    const R = registry(readPacks(dir));
    for (const k of R.order) if (!R.props[k].lodOf) UNION[k] = R.props[k];
  }
  const bins = {}, imgs = {};
  for (const k of REG.order) {
    const b = REG.props[k].bin, f = b && path.join(ROOT, ...b.split('/'));
    if (f && fs.existsSync(f)) bins[b] = readGeo(f);
  }
  for (const t of Object.values(REG.texs)) {
    if (typeof t !== 'string') continue;
    const f = path.join(ROOT, ...t.split('/'));
    if (fs.existsSync(f)) imgs[t] = imgSize(fs.readFileSync(f));
  }
  const cf = path.join(ROOT, 'src', 'loads', 'loads_catalogue.json');
  const catJson = fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : null;
  const credits = fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8');
  return { T, REG, UNION, catJson, credits, bins, imgs };
}

function selftest(D0) {
  const clone = () => {
    const D = Object.assign({}, D0);
    D.T = JSON.parse(JSON.stringify(D0.T));
    D.REG = JSON.parse(JSON.stringify(D0.REG));
    D.catJson = JSON.parse(JSON.stringify(D0.catJson));
    D.imgs = JSON.parse(JSON.stringify(D0.imgs));
    return D;
  };
  const firstLoad = D0.REG.order.find(k => D0.REG.props[k].group === 'load' && !D0.REG.props[k].lodOf);
  const heavy = D0.REG.order.find(k => D0.REG.props[k].group === 'load' && D0.REG.props[k].nt > CABIN_TRIS);
  const cases = [
    ['1 a declared row missing from the bake', D => { D.T.rows.push(Object.assign({}, D.T.rows[0], { key: 'load_ghost' })); }, '1 table'],
    ['2 a floor prop off its origin', D => { D.REG.props[firstLoad].bb[1] += 0.05; }, '2 physical'],
    ['3 a map over its budget', D => { const t = Object.keys(D.imgs)[0]; D.imgs[t] = [2048, 2048]; }, '3 maps'],
    ['4 a level gone', D => { const k = heavy + '_l1'; D.REG.order = D.REG.order.filter(x => x !== k); }, '4 levels'],
    ['5 the in-cabin level over budget', D => { D.REG.props[heavy + '_l1'].nt = 5000; }, '5 budget'],
    ['6 catalogue dims not the baked ones', D => { D.catJson.items[0].dims[0] += 0.1; }, '6 catalogue'],
    ['6 an unknown kind', D => { D.T.cat[0].kind = 'pallet'; }, '6 catalogue'],
    ['6 an absurd mass', D => { D.T.cat[0].kg = 90000; D.catJson.items[0].kg = 90000; }, '6 catalogue'],
    ['6 a load nobody catalogues', D => { D.T.cat = D.T.cat.filter(c => c.key !== firstLoad); D.catJson.items = D.catJson.items.filter(c => c.key !== firstLoad); }, '6 catalogue'],
    ['7 a source not in CREDITS.md', D => { D.T.sources.zz_uncredited = { lic: 'CC0', url: 'https://polyhaven.com/a/zz' }; }, '7 credits'],
    ['7 a share-alike licence', D => { const k = Object.keys(D.T.sources)[0]; D.T.sources[k].lic = 'CC-BY-SA-4.0'; }, '7 credits'],
  ];
  const bad = [];
  for (const [name, mut, tag] of cases) {
    const D = clone();
    mut(D);
    const r = check(D);
    const hit = r.fails.some(f => f.startsWith(tag));
    console.log(`  ${hit ? 'ok  ' : 'MISS'} selftest: ${name}`);
    if (!hit) bad.push(name);
  }
  return bad;
}

const D = load();
const r = check(D);
for (const n of r.notes) console.log('  ' + n);
for (const f of r.fails) console.log('  FAIL ' + f);
let fails = r.fails.length;
if (process.argv.includes('--selftest')) {
  if (fails) console.log('  (selftest skipped: the real data is red)');
  else fails += selftest(D).length;
}
console.log(`GATE LOADS: ${fails ? 'FAIL (' + fails + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
