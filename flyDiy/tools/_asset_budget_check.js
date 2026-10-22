#!/usr/bin/env node
// _asset_budget_check.js - GATE ASSETBUDGET (ASSETS-OCT G3140-G3149, 2026-10-13): the asset pipeline's BUDGET GATE
// (D:/Dev/flydiy-notes/ASSET-PIPELINE-PLAN-2026-10.md §3, step 9), held first on the spine's two first families:
//   camp   the user's tents (tools/camp_table.py -> tools/camp_kit.py, prop_prep's runner -> prop_lod.js --kit camp ->
//          ktx2_twins.js --family camp): src/camp/, media/geo/camp, media/tex/camp
//   infra  the high-voltage pylons (tools/infra_gen.js, procedural): src/infra/, media/geo/infra
// Every other prop family is REPORTED (row 8: its worst L0, the props without levels, the maps without a KTX2 twin) -
// the baseline the spine migrates, family by family, before its rows turn into fails.
//
//   1 TABLE     camp: the bake holds exactly the table's rows, in its order, group / label as declared; every row
//               CC BY 4.0 with an author and a source, src/camp/camp_credits.json the table's, each line in CREDITS.md
//   2 PHYSICAL  every prop and level decodes to its header's counts, unit normals, dim = its box; camp: 0.8-5 m tall,
//               1.2-12 m long (a centimetre export cannot slip through); infra: the lattice towers 38-56 m, the
//               H-frame 17-19.5 m, the tall tower 9 m (+-0.3) above the suspension tower
//   3 BUDGET    L0 within the category's budget (camp_table BUDGET.l0; infra_gen BUDGET per kind and level), each level
//               <= 0.7 of the one above, the levels the ladder asks (prop_lod 'camp'; infra_gen SHEET) at its distances,
//               the camp maps <= BUDGET.tex px, <= 5 materials a prop; and every BASE CUT holds (prop_lod.js BASE,
//               G2905: the pier's scanned people <= 8 k, boat_grady <= 30 k - a kit re-bake would bring the scans back)
//   4 KTX2      camp: every map a material reads has its twin in src/viewer/ktx2_twins.js for that slot kind; infra:
//               no map at all (flat records)
//   5 ATTACH    infra: the conductor / earth points a line tool strings - the count per kind, mirrored across the
//               line (x -> -x within 1 cm), inside the box (+-0.6 m), every phase >= 3 m out from the lattice cage and
//               >= 4 m above / below its neighbour on the same side, the earth points above every phase, the strain
//               sides (tension: back + ahead; terminal: ahead only), `line` {kv, maxAngle, span, dir}
//   6 FRESH     infra: tools/infra_gen.js rebuilt in memory = the committed pack, every bin on disk
//   7 WIRING    both kits lazy (build.js MANIFEST.lazy, not index.html's static list), asked for by world_boot.js and
//               the editor (app.js), repeated keys instanced (props.js PROP_INST_REPEAT), the media gate's kit lists,
//               prop_lod.js / ktx2_twins.js know the camp kit, run_gates.js runs this gate
//   8 REPORT    the other families (notes only)
// Run: node tools/_asset_budget_check.js [--selftest]        (one final `GATE ASSETBUDGET: ...`)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const rd = (rel, d) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return d; } };
const KIND = { map: 'color', emisMap: 'color', nor: 'normal', arm: 'data' };
// the attach points each pylon carries: [phases, earths]
const ATTACH = { pylon_suspension: [6, 1], pylon_tall: [6, 1], pylon_tension: [12, 2], pylon_terminal: [6, 1], pylon_hframe: [3, 2] };

function readTable(file) {
  const py = 'import importlib.util,json,sys;s=importlib.util.spec_from_file_location("t",sys.argv[1]);' +
    't=importlib.util.module_from_spec(s);s.loader.exec_module(t);' +
    'print(json.dumps(dict(groups=[g for g,_ in t.GROUPS],rows=t.PROPS,budget=getattr(t,"BUDGET",{}))))';
  for (const exe of ['python', 'py', 'python3']) {
    const r = spawnSync(exe, ['-c', py, path.join(__dirname, file)], { encoding: 'utf8' });
    if (r.status === 0) return JSON.parse(r.stdout);
  }
  throw new Error('python could not read tools/' + file);
}
function readPacks(dir, manifest) {
  const mf = path.join(ROOT, 'src', dir, manifest);
  const R = { order: [], props: {}, texs: {} };
  if (!fs.existsSync(mf)) return R;
  const sb = { registerPropPack: p => { Object.assign(R.texs, p.texs); for (const k of p.order) { R.order.push(k); R.props[k] = p.props[k]; } }, console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(mf, 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', dir, f), 'utf8'), sb, { filename: f });
  return R;
}
function readBins(REG) {
  const bins = {};
  for (const k of REG.order) {
    const b = REG.props[k].bin;
    if (b && !bins[b] && fs.existsSync(path.join(ROOT, b))) {
      let buf = fs.readFileSync(path.join(ROOT, b));
      try { buf = zlib.gunzipSync(buf); } catch (e) { /* stored plain */ }
      bins[b] = buf;
    }
  }
  return bins;
}
function imgSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1], len = buf.readUInt16BE(o + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(o + 7), buf.readUInt16BE(o + 5)];
      o += 2 + len;
    }
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const k = buf.toString('ascii', 12, 16);
    if (k === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
    if (k === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  }
  return null;
}
function readTwins() {
  const src = rd('src/viewer/ktx2_twins.js', '');
  if (!src) return {};
  const sb = { window: {}, console };
  vm.createContext(sb);
  vm.runInContext(src + '\n;this.__T = (typeof KTX2_TWINS_TABLE !== "undefined") ? KTX2_TWINS_TABLE : {};', sb);
  return sb.__T || {};
}

// ---- the checks: pure over what gather() read ------------------------------------------------------------------------
function check(D) {
  const fails = [], notes = [];
  const fail = m => fails.push(m);
  const { CORE, LT, IG, camp, infra, twins, wiring, fresh } = D;

  // ---- 1 TABLE (camp)
  const T = camp.T, B = T.budget || {};
  const campFull = camp.REG.order.filter(k => !camp.REG.props[k].lodOf);
  const want = T.groups.flatMap(g => T.rows.filter(r => r.group === g).map(r => r.key));
  if (want.join(',') !== campFull.join(',')) fail(`1 table: the camp bake holds [${campFull.join(',')}], the table declares [${want.join(',')}] (python tools/camp_kit.py)`);
  for (const r of T.rows) {
    const p = camp.REG.props[r.key];
    if (p && (p.group !== r.group || p.label !== r.label)) fail(`1 table: ${r.key} baked as ${p.group}/"${p.label}", declared ${r.group}/"${r.label}"`);
    const c = r.credit || {};
    if (c.licence !== 'CC BY 4.0' || !c.author || !/^https:\/\//.test(c.source || '')) fail(`1 table: ${r.key}'s credit is not CC BY 4.0 with an author and a source`);
    if (!camp.credJson[r.key] || camp.credJson[r.key].line !== c.line) fail(`1 table: src/camp/camp_credits.json is not the table's for ${r.key}`);
    if (c.line && camp.creditsMd.indexOf(c.author) < 0) fail(`1 table: CREDITS.md does not credit ${c.author} (${r.key})`);
  }

  // ---- 2 PHYSICAL + 3 BUDGET, both kits
  const decodeAll = (fam, REG, bins) => {
    for (const key of REG.order) {
      const p = REG.props[key];
      const bin = bins[p.bin];
      if (!bin) { fail(`2 physical: ${fam} ${key} names ${p.bin}, not on disk`); continue; }
      let dec;
      try { dec = CORE.decodeProp(p, bin); } catch (e) { fail(`2 physical: ${fam} ${key} decode threw ${e.message}`); continue; }
      let nv = 0, nt = 0, worst = 0;
      for (const part of dec.parts) {
        nv += part.nv; nt += part.nt;
        if (!p.mats[part.mat]) fail(`2 physical: ${fam} ${key}/${part.mat} has no material record`);
        for (let i = 0; i < part.nv; i++) worst = Math.max(worst, Math.abs(Math.hypot(part.nrm[i * 3], part.nrm[i * 3 + 1], part.nrm[i * 3 + 2]) - 1));
      }
      if (nv !== p.nv || nt !== p.nt) fail(`2 physical: ${fam} ${key} decodes ${nv}v/${nt}t, header ${p.nv}v/${p.nt}t`);
      if (worst > 0.02) fail(`2 physical: ${fam} ${key} normals off unit by ${worst.toFixed(3)}`);
      for (let k = 0; k < 3; k++) if (Math.abs(p.bb[k + 3] - p.bb[k] - p.dim[k]) > 1e-3) fail(`2 physical: ${fam} ${key} dim[${k}] is not its bb extent`);
      if (Object.keys(p.mats || {}).length > 5) fail(`3 budget: ${fam} ${key} has ${Object.keys(p.mats).length} materials (<= 5)`);
    }
  };
  decodeAll('camp', camp.REG, camp.bins);
  decodeAll('infra', infra.REG, infra.bins);
  const levelsOf = (REG, key) => REG.order.filter(k => REG.props[k].lodOf === key).map(k => REG.props[k]).sort((a, b) => a.lodDist - b.lodDist);
  for (const key of campFull) {
    const p = camp.REG.props[key], [h0, h1] = B.height || [0.8, 5], [l0, l1] = B.length || [1.2, 12];
    const L = Math.max(p.dim[0], p.dim[2]);
    if (p.dim[1] < h0 || p.dim[1] > h1) fail(`2 physical: ${key} stands ${p.dim[1].toFixed(2)} m (a tent is ${h0}-${h1} m: a scale lost?)`);
    if (L < l0 || L > l1) fail(`2 physical: ${key} is ${L.toFixed(2)} m long (${l0}-${l1} m: a scale lost?)`);
    if (p.nt > (B.l0 || 10000)) fail(`3 budget: ${key} L0 ${p.nt} tris over the category's ${B.l0}`);
    const have = levelsOf(camp.REG, key), wantL = LT.levelsFor(p, 'camp');
    if (have.length !== wantL.length) fail(`3 budget: ${key} has ${have.length} levels, the camp ladder asks ${wantL.length} (node tools/prop_lod.js --kit camp)`);
    else have.forEach((q, i) => {
      if (q.lodDist !== wantL[i][1]) fail(`3 budget: ${q.key} stands in past ${q.lodDist} m, the ladder says ${wantL[i][1]}`);
      const up = i ? have[i - 1].nt : p.nt;
      if (q.nt > 0.7 * up) fail(`3 budget: ${q.key} ${q.nt} tris is not under 0.7 of the level above (${up})`);
    });
    for (const m of Object.values(p.mats)) for (const slot of Object.keys(KIND)) {
      const id = m[slot]; if (typeof id !== 'string') continue;
      const rel = camp.REG.texs[id];
      if (typeof rel !== 'string') continue;
      const sz = camp.imgs[rel];
      if (!sz) fail(`3 budget: ${key}'s ${slot} map ${rel} is not on disk (or not an image)`);
      else if (Math.max(sz[0], sz[1]) > (B.tex || 1024)) fail(`3 budget: ${key}'s ${slot} map is ${sz[0]}x${sz[1]}, over ${B.tex} px`);
      // ---- 4 KTX2
      if (!twins[rel + '|' + KIND[slot]]) fail(`4 ktx2: ${key}'s ${slot} map ${rel} has no ${KIND[slot]} twin (node tools/ktx2_twins.js --family camp)`);
    }
  }
  if (Object.keys(infra.REG.texs).length) fail(`4 ktx2: the infra pack carries maps (${Object.keys(infra.REG.texs).length}) - its records are flat`);
  for (const row of IG.SHEET) {
    const p = infra.REG.props[row.key];
    if (!p) { fail(`3 budget: the infra pack lacks ${row.key} (node tools/infra_gen.js)`); continue; }
    if (p.group !== 'infra') fail(`3 budget: ${row.key} is in group ${p.group}, not infra`);
    const bud = IG.BUDGET[row.key === 'pylon_hframe' ? 'hframe' : 'lattice'];
    const have = levelsOf(infra.REG, row.key);
    if (p.nt > bud[0]) fail(`3 budget: ${row.key} L0 ${p.nt} tris over ${bud[0]}`);
    if (have.length !== row.levels.length) { fail(`3 budget: ${row.key} has ${have.length} levels, the sheet asks ${row.levels.length}`); continue; }
    have.forEach((q, i) => {
      if (q.lodDist !== row.levels[i]) fail(`3 budget: ${q.key} stands in past ${q.lodDist} m, the sheet says ${row.levels[i]}`);
      if (q.nt > bud[i + 1]) fail(`3 budget: ${q.key} ${q.nt} tris over ${bud[i + 1]}`);
      const up = i ? have[i - 1].nt : p.nt;
      if (q.nt > 0.7 * up) fail(`3 budget: ${q.key} ${q.nt} tris is not under 0.7 of the level above (${up})`);
    });
    const H = p.bb[4];   // the top above the ground (the footings reach below 0)
    if (row.key === 'pylon_hframe') { if (H < 17 || H > 19.5) fail(`2 physical: pylon_hframe tops out at ${H.toFixed(2)} m (17-19.5)`); }
    else if (H < 38 || H > 56) fail(`2 physical: ${row.key} tops out at ${H.toFixed(2)} m (38-56)`);
  }
  {
    const s = infra.REG.props.pylon_suspension, t = infra.REG.props.pylon_tall;
    if (s && t && Math.abs((t.bb[4] - s.bb[4]) - 9) > 0.3) fail(`2 physical: the tall tower is ${(t.bb[4] - s.bb[4]).toFixed(2)} m over the suspension tower, not 9`);
  }

  // ---- 5 ATTACH (infra)
  for (const [key, [nPh, nE]] of Object.entries(ATTACH)) {
    const p = infra.REG.props[key];
    if (!p) continue;
    const A = p.attach || [], ph = A.filter(a => a.kind === 'phase'), ea = A.filter(a => a.kind === 'earth');
    if (ph.length !== nPh || ea.length !== nE) { fail(`5 attach: ${key} carries ${ph.length} phase / ${ea.length} earth points, wants ${nPh} / ${nE}`); continue; }
    const L = p.line || {};
    if (!(L.kv > 0) || !(L.maxAngle >= 0) || !Array.isArray(L.span) || L.dir !== '+z') fail(`5 attach: ${key}'s line record is incomplete (kv, maxAngle, span, dir)`);
    for (const a of A) {
      if (!Array.isArray(a.p) || a.p.length !== 3 || !a.p.every(Number.isFinite)) { fail(`5 attach: ${key} ${a.id} has no finite point`); continue; }
      for (let k = 0; k < 3; k++) if (a.p[k] < p.bb[k] - 0.6 || a.p[k] > p.bb[k + 3] + 0.6) fail(`5 attach: ${key} ${a.id} is outside its box on axis ${k}`);
      const m = A.find(b => b.kind === a.kind && b.side === a.side && Array.isArray(b.p) &&
        Math.abs(b.p[0] + a.p[0]) < 0.01 && Math.abs(b.p[1] - a.p[1]) < 0.01 && Math.abs(b.p[2] - a.p[2]) < 0.01);
      if (!m) fail(`5 attach: ${key} ${a.id} has no mirror across the line`);
    }
    const lowE = Math.min(...ea.map(a => a.p[1])), highP = Math.max(...ph.map(a => a.p[1]));
    if (!(lowE > highP)) fail(`5 attach: ${key}'s earth points (${lowE}) are not above every phase (${highP})`);
    if (key !== 'pylon_hframe') {
      const P = IG.LATTICE[key.replace('pylon_', '')];
      for (const a of ph) if (Math.abs(a.p[0]) < P.bw + 3) fail(`5 attach: ${key} ${a.id} is ${Math.abs(a.p[0]).toFixed(2)} m out, inside the cage's 3 m clearance`);
      for (const side of [1, -1]) {
        const ys = [...new Set(ph.filter(a => Math.sign(a.p[0]) === side).map(a => +a.p[1].toFixed(2)))].sort((x, y) => x - y);
        for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < 4) fail(`5 attach: ${key}'s phases ${ys[i - 1]} / ${ys[i]} m are under 4 m apart`);
      }
      const sides = new Set(ph.map(a => a.side));
      const wantSides = P.mode === 'suspension' ? ['both'] : P.sides === 'ahead' ? ['ahead'] : ['ahead', 'back'];
      if ([...sides].sort().join() !== wantSides.slice().sort().join()) fail(`5 attach: ${key}'s strain sides are [${[...sides]}], want [${wantSides}]`);
    } else if (new Set(ph.map(a => a.p[1])).size !== 1) fail('5 attach: the H-frame\'s three phases are not level');
  }

  // ---- 6 FRESH
  if (!fresh.ok) fail(`6 fresh: ${fresh.why} (node tools/infra_gen.js)`);

  // ---- 7 WIRING
  const W = wiring;
  const at = W.build.indexOf('lazy: [');
  for (const [dir, mf] of [['camp', 'camp_packs.json'], ['infra', 'infra_packs.json']]) {
    const tag = `'${dir}', '${mf}'`;
    if (at < 0 || W.build.slice(at, at + 6000).indexOf(tag) < 0) fail(`7 wiring: build.js MANIFEST.lazy does not list the ${dir} packs`);
    if (at >= 0 && W.build.slice(0, at).indexOf(tag) >= 0) fail(`7 wiring: the ${dir} packs are in index.html's static list`);
    if (W.boot.indexOf(`/^${dir}_/`) < 0) fail(`7 wiring: world_boot.js does not ask for the ${dir} packs`);
    if (W.app.indexOf(`/^${dir}_/`) < 0) fail(`7 wiring: the editor (app.js) does not ask for the ${dir} packs`);
    if (W.media.indexOf(`kitPacks('${dir}', '${mf}')`) < 0) fail(`7 wiring: tools/_media_check.js does not list the ${dir} packs`);
  }
  const rep = /const PROP_INST_REPEAT = (\/.*\/);/.exec(W.props);
  let RE = null; try { RE = rep && vm.runInNewContext(rep[1]); } catch (e) { RE = null; }
  if (!RE) fail('7 wiring: props.js PROP_INST_REPEAT not found');
  else for (const k of campFull.concat(IG.SHEET.map(r => r.key))) if (!RE.test(k)) fail(`7 wiring: ${k} is not instanced when repeated (props.js PROP_INST_REPEAT)`);
  if (!/\bcamp:\s*\{/.test(W.lod)) fail('7 wiring: prop_lod.js has no camp kit');
  if (!/\bcamp:\s*\{/.test(W.ktx2)) fail('7 wiring: ktx2_twins.js has no camp family');
  if (W.gates.indexOf("'_asset_budget_check.js'") < 0) fail('7 wiring: run_gates.js does not run GATE ASSETBUDGET');

  // ---- 3 the base cuts (G2905)
  for (const b of D.baseCaps || []) {
    if (b.nt === undefined) fail(`3 budget: the base-cut prop ${b.key} is not in the ${b.kit} packs`);
    else if (b.nt > b.cap * 1.02) fail(`3 budget: ${b.key} L0 ${b.nt} tris over its base cap ${b.cap} (node tools/prop_lod.js --kit ${b.kit} --base: a re-bake brought the scan back?)`);
  }

  // ---- 3 the traffic cars' windows glazed (G2906: tools/auto_glass.py --check; a pier re-bake brings the white back)
  if (D.glass && !D.glass.ok) fail(`3 budget: the traffic cars' windows are not glazed - ${D.glass.why} (python tools/auto_glass.py)`);

  // ---- 8 REPORT
  for (const r of D.report) notes.push(`8 report ${r}`);
  return { fails, notes };
}

// ---- gather ----------------------------------------------------------------------------------------------------------
function gather() {
  const CORE = require('./flight_core.js');
  const LT = require('./prop_lod.js');
  const IG = require('./infra_gen.js');
  const camp = { T: readTable('camp_table.py'), REG: readPacks('camp', 'camp_packs.json') };
  camp.bins = readBins(camp.REG);
  camp.imgs = {};
  for (const t of Object.values(camp.REG.texs)) if (typeof t === 'string' && fs.existsSync(path.join(ROOT, t))) camp.imgs[t] = imgSize(fs.readFileSync(path.join(ROOT, t)));
  try { camp.credJson = JSON.parse(rd('src/camp/camp_credits.json', '{}')); } catch (e) { camp.credJson = {}; }
  camp.creditsMd = rd('CREDITS.md', '');
  const infra = { REG: readPacks('infra', 'infra_packs.json') };
  infra.bins = readBins(infra.REG);
  // 6 FRESH: the generator's pack text, rebuilt in memory, against the committed one
  const fresh = { ok: true, why: '' };
  try {
    const log = console.log; console.log = () => {};
    let code;
    try { code = spawnSync(process.execPath, [path.join(__dirname, 'infra_gen.js'), '--check'], { encoding: 'utf8' }).status; }
    finally { console.log = log; }
    if (code !== 0) { fresh.ok = false; fresh.why = 'src/infra/infra_pylon.js or a bin is stale'; }
  } catch (e) { fresh.ok = false; fresh.why = 'infra_gen.js threw ' + e.message; }
  const wiring = {
    build: rd('tools/build.js', ''), boot: rd('src/viewer/world_boot.js', ''), app: rd('src/viewer/app.js', ''),
    media: rd('tools/_media_check.js', ''), props: rd('src/viewer/props.js', ''), lod: rd('tools/prop_lod.js', ''),
    ktx2: rd('tools/ktx2_twins.js', ''), gates: rd('tools/run_gates.js', ''),
  };
  // 8 REPORT: the families the spine has not migrated yet
  const twins = readTwins();
  const report = [];
  for (const [dir, mf] of [['scenery', 'scenery_packs.json'], ['cars', 'cars_packs.json'], ['pier', 'pier_packs.json'], ['props', 'props_packs.json'], ['totems', 'totems_packs.json'], ['loads', 'loads_packs.json']]) {
    const R = readPacks(dir, mf);
    const full = R.order.filter(k => !R.props[k].lodOf);
    if (!full.length) continue;
    const lv = new Set(R.order.filter(k => R.props[k].lodOf).map(k => R.props[k].lodOf));
    const worst = full.reduce((a, k) => (R.props[k].nt > (a ? R.props[a].nt : -1) ? k : a), null);
    const maps = new Set(), bare = new Set();
    for (const k of R.order) for (const m of Object.values(R.props[k].mats || {})) for (const slot of Object.keys(KIND)) {
      const id = m[slot]; const rel = typeof id === 'string' ? R.texs[id] : null;
      if (typeof rel !== 'string') continue;
      maps.add(rel + '|' + KIND[slot]); if (!twins[rel + '|' + KIND[slot]]) bare.add(rel + '|' + KIND[slot]);
    }
    report.push(`${dir}: ${full.length} props, worst L0 ${worst} ${R.props[worst].nt} tris, ${full.filter(k => !lv.has(k)).length} without levels, ${bare.size} / ${maps.size} map slots without a KTX2 twin`);
  }
  // the base cuts prop_lod.js declares (G2905), read from their kits' packs
  const baseCaps = [];
  for (const [kit, caps] of Object.entries(LT.BASE || {})) {
    const K = LT.KITS[kit], R = readPacks(K.dir, K.manifest);
    for (const [key, cap] of Object.entries(caps)) baseCaps.push({ kit, key, cap, nt: R.props[key] ? R.props[key].nt : undefined });
  }
  // the traffic cars' windows (G2906)
  const glass = { ok: false, why: 'python could not run tools/auto_glass.py --check' };
  for (const exe of ['python', 'py', 'python3']) {
    const r = spawnSync(exe, [path.join(__dirname, 'auto_glass.py'), '--check'], { encoding: 'utf8' });
    if (r.status === 0) { glass.ok = true; glass.why = ''; break; }
    if (r.status === 1) { glass.why = (r.stdout.trim().split(/\r?\n/).pop() || 'stale'); break; }
  }
  return { CORE, LT, IG, camp, infra, twins, wiring, fresh, report, baseCaps, glass };
}

function main() {
  const D = gather();
  const R = check(D);
  if (process.argv.includes('--selftest')) {
    const reds = [];
    const brk = (name, f) => {
      const C = Object.assign({}, D, {
        camp: Object.assign({}, D.camp, JSON.parse(JSON.stringify({ T: D.camp.T, REG: D.camp.REG, credJson: D.camp.credJson }))),
        infra: Object.assign({}, D.infra, { REG: JSON.parse(JSON.stringify(D.infra.REG)) }),
        twins: Object.assign({}, D.twins), wiring: Object.assign({}, D.wiring), fresh: Object.assign({}, D.fresh),
      });
      f(C);
      const r = check(C), base = new Set(R.fails);
      reds.push([name, r.fails.some(x => !base.has(x))]);
    };
    const c0 = D.camp.REG.order.find(k => !D.camp.REG.props[k].lodOf);
    const cl = D.camp.REG.order.find(k => D.camp.REG.props[k].lodOf);
    brk('1 a row the bake lacks', C => C.camp.T.rows.push(Object.assign({}, C.camp.T.rows[0], { key: 'ghost' })));
    brk('1 a licence', C => { C.camp.T.rows[0].credit.licence = 'CC BY-NC 4.0'; });
    brk('2 a header count', C => { C.infra.REG.props.pylon_suspension.nt += 1; });
    brk('2 a centimetre tent', C => { if (c0) { const p = C.camp.REG.props[c0]; p.dim = p.dim.map(v => v * 100); for (let k = 0; k < 3; k++) p.bb[k + 3] = p.bb[k] + p.dim[k]; } });
    brk('3 a camp L0 budget', C => { C.camp.T.budget.l0 = 10; });
    brk('3 a level distance', C => { if (cl) C.camp.REG.props[cl].lodDist += 1; });
    brk('3 an infra level', C => { C.infra.REG.props.pylon_tension_l2.nt = 5000; });
    brk('4 a missing twin', C => { const k = Object.keys(C.twins).find(t => Object.values(C.camp.REG.texs).some(r => t.startsWith(r + '|'))); if (k) delete C.twins[k]; });
    brk('5 an attach point dropped', C => { C.infra.REG.props.pylon_tension.attach.pop(); });
    brk('5 a mirror broken', C => { C.infra.REG.props.pylon_suspension.attach[0].p[1] += 0.5; });
    brk('5 a phase in the cage', C => { const a = C.infra.REG.props.pylon_tall.attach.filter(x => x.kind === 'phase'); a[0].p[0] = 1.5; a[1].p[0] = -1.5; });
    brk('6 a stale pack', C => { C.fresh = { ok: false, why: 'selftest' }; });
    brk('7 the lazy list', C => { C.wiring.build = C.wiring.build.replace("'infra', 'infra_packs.json'", "'x', 'x'"); });
    brk('3 white car windows', C => { C.glass = { ok: false, why: 'selftest' }; });
    brk('3 a base cap', C => { C.baseCaps = C.baseCaps.map(b => Object.assign({}, b, { cap: 10 })); });
    brk('7 not instanced', C => { C.wiring.props = C.wiring.props.replace('pylon_', 'pyIon_'); });
    for (const [n, red] of reds) if (!red) R.fails.push(`selftest: breaking "${n}" did not turn the gate red`);
    R.notes.push(`selftest: ${reds.filter(x => x[1]).length}/${reds.length} breaks caught`);
  }
  const campN = D.camp.REG.order.length, infraN = D.infra.REG.order.length;
  console.log(`  camp ${campN} props + levels, infra ${infraN} props + levels`);
  for (const n of R.notes) console.log('  ' + n);
  for (const f of R.fails) console.log('  FAIL ' + f);
  console.log('GATE ASSETBUDGET: ' + (R.fails.length ? 'FAIL (' + R.fails.length + ')' : 'PASS'));
  process.exit(R.fails.length ? 1 : 0);
}
if (require.main === module) main();
module.exports = { check, gather };
