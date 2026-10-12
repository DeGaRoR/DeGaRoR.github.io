#!/usr/bin/env node
// _scenery_check.js - GATE SCENERY (ASSETS-OCT, G2907). The October scenery kit:
// tools/scenery_table.py (rows, credits, prep recipes, the ALMA job) -> tools/scenery_prep.py /
// tools/observatory_prep.py (Blender: the cut, the atlas, the bake) -> tools/scenery_kit.py
// (prop_prep's runner) -> src/scenery/scenery_*.js + media/geo/scenery + media/tex/scenery ->
// tools/prop_lod.js --kit scenery -> src/scenery/scenery_lods.js + media/geo/scenery_lod.
// futureDesigns/SCENERY-OCT-2026-10-11.md holds the licence and spec tables.
//
//   1 TABLE     the bake holds every declared row (key / group / label), in the table's group
//               order, and nothing else
//   2 PHYSICAL  every prop decodes; header counts; unit normals; dims = bb; a declared standing
//               height within 3 %; nothing under 0.3 m or over 150 m
//   3 MAPS      every map within its row's `tex` budget, none over 2048
//   4 BUDGET    the cut rows at or under their prep target (+3 %); an as-is row no heavier than
//               its delivered primitives; a crowd figure <= 2 000
//   5 LEVELS    what prop_lod.js's ladder asks per group, each under 0.7 of the level above
//   6 CREDITS   every row CC BY 4.0 with an author and a sketchfab source, scenery_credits.json
//               = the table, every author named in CREDITS.md; the blocked VotV rip named nowhere
//   8 LAZY      the packs in build.js MANIFEST.lazy (never index.html's static list); world_boot and the editor ask
//   7 ASSEMBLY  src/scenery/scenery_assembly.json: every part a baked row, the fork's axis
//               vertical, the dish's horizontal, unit axes, each pivot inside its part's box,
//               at least one obstruction light and every light inside the assembly's box
//
// The table is read through python (the bakers' own dependency) as JSON, not by regex.
// Negative-verified: --selftest breaks each rule on a copy and expects red.
// Run: node tools/_scenery_check.js [--selftest]        (one final `GATE SCENERY: ...`)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const CORE = require('./flight_core.js');
const LT = require('./prop_lod.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'src', 'scenery');

function readTable() {
  const py = 'import importlib.util,json,sys;s=importlib.util.spec_from_file_location("t",sys.argv[1]);' +
    't=importlib.util.module_from_spec(s);s.loader.exec_module(t);' +
    'print(json.dumps(dict(groups=[g for g,_ in t.GROUPS],rows=t.PROPS,jobs=getattr(t,"JOBS",{}))))';
  for (const exe of ['python', 'py', 'python3']) {
    const r = spawnSync(exe, ['-c', py, path.join(__dirname, 'scenery_table.py')], { encoding: 'utf8' });
    if (r.status === 0) return JSON.parse(r.stdout);
  }
  throw new Error('python could not read tools/scenery_table.py');
}

function readPacks() {
  const mf = path.join(DIR, 'scenery_packs.json');
  if (!fs.existsSync(mf)) return [];
  const out = [];
  const sb = { registerPropPack: p => out.push(p), console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(mf, 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), sb, { filename: f });
  return out;
}
function registry(packs) {
  const R = { order: [], props: {}, texs: {} };
  for (const p of packs) {
    Object.assign(R.texs, p.texs);
    for (const k of p.order) { R.order.push(k); R.props[k] = p.props[k]; }
  }
  return R;
}
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
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const k = buf.toString('ascii', 12, 16);
    if (k === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
    if (k === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  }
  return null;
}

function check(D) {
  const fails = [], notes = [];
  const fail = m => fails.push(m);
  const { T, REG, bins, imgs, credJson, creditsMd, asm, srcTris } = D;
  const FULL = REG.order.filter(k => !REG.props[k].lodOf);
  const LODS = REG.order.filter(k => REG.props[k].lodOf);
  const row = Object.fromEntries(T.rows.map(r => [r.key, r]));

  // 1 TABLE
  const want = T.groups.flatMap(g => T.rows.filter(r => r.group === g).map(r => r.key));
  if (want.join(',') !== FULL.join(',')) fail(`1 table: the bake holds [${FULL.join(',')}], the table declares [${want.join(',')}]`);
  for (const r of T.rows) {
    const p = REG.props[r.key];
    if (p && (p.group !== r.group || p.label !== r.label)) fail(`1 table: ${r.key} baked as ${p.group}/"${p.label}", declared ${r.group}/"${r.label}"`);
  }

  // 2 PHYSICAL
  for (const key of REG.order) {
    const p = REG.props[key];
    const bin = bins[p.bin];
    if (!bin) { fail(`2 physical: ${key} names ${p.bin}, not on disk`); continue; }
    let dec;
    try { dec = CORE.decodeProp(p, bin); } catch (e) { fail(`2 physical: ${key} decode threw ${e.message}`); continue; }
    let nv = 0, nt = 0, worst = 0;
    for (const part of dec.parts) {
      nv += part.nv; nt += part.nt;
      if (!p.mats[part.mat]) fail(`2 physical: ${key}/${part.mat} has no material record`);
      for (let i = 0; i < part.nv; i++)
        worst = Math.max(worst, Math.abs(Math.hypot(part.nrm[i * 3], part.nrm[i * 3 + 1], part.nrm[i * 3 + 2]) - 1));
    }
    if (nv !== p.nv || nt !== p.nt) fail(`2 physical: ${key} decodes ${nv}v/${nt}t, header ${p.nv}v/${p.nt}t`);
    if (worst > 0.02) fail(`2 physical: ${key} normals off unit by ${worst.toFixed(3)}`);
    for (let k = 0; k < 3; k++) if (Math.abs(p.bb[k + 3] - p.bb[k] - p.dim[k]) > 1e-3) fail(`2 physical: ${key} dim[${k}] is not its bb extent`);
    const big = Math.max(...p.dim);
    if (big < 0.3 || big > 150) fail(`2 physical: ${key} is ${big.toFixed(2)} m - not a scenery model (a scale lost?)`);
    const r = row[key];
    if (r && r.height && Math.abs(p.dim[1] - r.height) > 0.03 * r.height)
      fail(`2 physical: ${key} stands ${p.dim[1].toFixed(2)} m, the table declares ${r.height} m`);
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
      if (typeof t !== 'string') continue;
      const sz = imgs[t];
      if (!sz) { fail(`3 maps: ${key} ${slot} ${t} unreadable / missing`); continue; }
      if (Math.max(...sz) > Math.min(r.tex, 2048)) fail(`3 maps: ${key} ${slot} is ${sz.join('x')}, over its ${r.tex} budget`);
    }
  }

  // 4 BUDGET
  for (const key of FULL) {
    const p = REG.props[key], r = row[key];
    if (!r) continue;
    const pr = r.prep || {};
    const job = pr.job ? (T.jobs[pr.job] || {}).prep : null;
    if (r.group === 'crowd') { if (p.nt > 2000) fail(`4 budget: ${key} ${p.nt} tris, over the crowd's 2 000`); continue; }
    if (pr.route === 'asis') {
      if (srcTris[key] !== undefined && p.nt > srcTris[key]) fail(`4 budget: ${key} ${p.nt} tris, heavier than its delivered ${srcTris[key]}`);
      continue;
    }
    if (job) continue;                         // a job's parts: their sum, below
    if (pr.target && p.nt > pr.target * 1.03) fail(`4 budget: ${key} ${p.nt} tris, over its prep target ${pr.target}`);
  }
  for (const [j, J] of Object.entries(T.jobs)) {
    const keys = T.rows.filter(r => r.prep && r.prep.job === j).map(r => r.key).filter(k => REG.props[k]);
    const sum = keys.reduce((a, k) => a + REG.props[k].nt, 0);
    if (keys.length && sum > J.prep.target * 1.06) fail(`4 budget: ${j}'s parts ${sum} tris, over the job's ${J.prep.target} (+ its glass / lamps)`);
  }

  // 5 LEVELS
  const by = new Map();
  for (const k of LODS) {
    const L = REG.props[k], P = REG.props[L.lodOf];
    if (!P || P.lodOf || !row[L.lodOf]) { fail(`5 levels: ${k} stands in for ${L.lodOf}, not a declared row`); continue; }
    if (!L.bin || L.bin.indexOf('media/geo/scenery_lod/') < 0) fail(`5 levels: ${k} bin ${L.bin} is not under media/geo/scenery_lod/`);
    (by.get(L.lodOf) || by.set(L.lodOf, []).get(L.lodOf)).push(k);
  }
  for (const key of FULL) {
    const P = REG.props[key], wantL = LT.levelsFor(P), have = by.get(key) || [];
    if (have.length !== wantL.length) { fail(`5 levels: ${key} has ${have.length} levels, the ${P.group} ladder asks ${wantL.length} (node tools/prop_lod.js --kit scenery)`); continue; }
    let prev = P.nt;
    have.forEach((k, i) => {
      const L = REG.props[k];
      if (L.lodDist !== wantL[i][1]) fail(`5 levels: ${k} past ${L.lodDist} m, the ladder says ${wantL[i][1]}`);
      if (!(L.nt < 0.7 * prev)) fail(`5 levels: ${k} ${L.nt} tris, not under 0.7 of ${prev}`);
      prev = L.nt;
    });
  }

  // 6 CREDITS
  for (const r of T.rows) {
    const c = r.credit || {};
    if (c.licence !== 'CC BY 4.0' || !c.author || !/^https:\/\/sketchfab\.com\/3d-models\//.test(c.source || ''))
      fail(`6 credits: ${r.key} has no CC BY 4.0 credit with an author and a sketchfab source`);
    else if (!creditsMd.includes(c.author)) fail(`6 credits: ${r.key}'s author "${c.author}" is not named in CREDITS.md`);
    if (!credJson[r.key] || credJson[r.key].line !== c.line) fail(`6 credits: src/scenery/scenery_credits.json is not the table's for ${r.key}`);
  }
  const blob = JSON.stringify(T) + JSON.stringify(credJson);
  if (/votv|voices of the void/i.test(blob)) fail('6 credits: the blocked VotV telescope (a game rip) is named in the kit');

  // 7 ASSEMBLY
  for (const [j, A] of Object.entries(asm)) {
    const parts = A.parts || [];
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const q of parts) {
      const p = REG.props[q.row];
      if (!p) { fail(`7 assembly: ${j}/${q.part} names row ${q.row}, not baked`); continue; }
      if (p.place !== 'mount') fail(`7 assembly: ${q.row} is place=${p.place}; an assembly's parts share one frame (mount)`);
      for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], p.bb[k]); box[k + 3] = Math.max(box[k + 3], p.bb[k + 3]); }
      if (q.axis) {
        const n = Math.hypot(...q.axis);
        if (Math.abs(n - 1) > 1e-3) fail(`7 assembly: ${q.row} axis not unit (${n.toFixed(4)})`);
        if (q.part === 'fork' && Math.abs(q.axis[1]) < 0.99) fail(`7 assembly: ${q.row} turns in azimuth, its axis is not vertical [${q.axis}]`);
        if (q.part === 'dish' && Math.abs(q.axis[1]) > 0.05) fail(`7 assembly: ${q.row} turns in elevation, its axis is not horizontal [${q.axis}]`);
      }
      if (q.pivot && p.bb) for (let k = 0; k < 3; k++)
        if (q.pivot[k] < p.bb[k] - 0.5 || q.pivot[k] > p.bb[k + 3] + 0.5) fail(`7 assembly: ${q.row} pivot [${q.pivot}] outside its box`);
    }
    const L = A.lights || [];
    if (!L.some(l => l.kind === 'obstruction')) fail(`7 assembly: ${j} has no obstruction light`);
    for (const l of L) {
      if (!['obstruction', 'service'].includes(l.kind)) fail(`7 assembly: ${j} light kind ${l.kind}`);
      for (let k = 0; k < 3; k++) if (l.at[k] < box[k] - 1 || l.at[k] > box[k + 3] + 1) fail(`7 assembly: ${j} ${l.kind} light at [${l.at}] outside the assembly`);
    }
  }
  for (const j of Object.keys(T.jobs)) if (!asm[j] && T.rows.some(r => r.prep && r.prep.job === j && REG.props[r.key]))
    fail(`7 assembly: ${j}'s parts are baked but src/scenery/scenery_assembly.json has no ${j}`);

  notes.push(`${FULL.length} rows, ${LODS.length} levels, ${FULL.reduce((a, k) => a + REG.props[k].nt, 0)} L0 tris`);
  return { fails, notes };
}

function gather() {
  const T = readTable();
  const REG = registry(readPacks());
  const bins = {}, imgs = {};
  for (const k of REG.order) {
    const b = REG.props[k].bin;
    if (b && !bins[b] && fs.existsSync(path.join(ROOT, b))) {
      let buf = fs.readFileSync(path.join(ROOT, b));
      try { buf = require('zlib').gunzipSync(buf); } catch (e) { /* stored plain */ }
      bins[b] = buf;
    }
  }
  for (const t of Object.values(REG.texs)) if (typeof t === 'string' && fs.existsSync(path.join(ROOT, t))) imgs[t] = imgSize(fs.readFileSync(path.join(ROOT, t)));
  const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return d; } };
  // the delivered primitives' triangle counts for the as-is rows (their files are not in a worktree: skipped there)
  const srcTris = {};
  for (const r of T.rows) {
    if (!r.prep || r.prep.route !== 'asis') continue;
    const f = ['assets', 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'].map(b => path.join(path.isAbsolute(b) ? b : path.join(ROOT, b), r.dir, r.file)).find(fs.existsSync);
    if (!f) continue;
    const d = fs.readFileSync(f), j = JSON.parse(d.subarray(20, 20 + d.readUInt32LE(12)));
    let n = 0;
    for (const m of j.meshes) for (const p of m.primitives)
      if (!r.mats || r.mats.includes((j.materials[p.material] || {}).name)) n += j.accessors[p.indices].count / 3;
    srcTris[r.key] = n;
  }
  return { T, REG, bins, imgs, credJson: rd('scenery_credits.json', {}), asm: rd('scenery_assembly.json', {}),
           creditsMd: fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8'), srcTris };
}

function main() {
  const D = gather();
  if (!D.REG.order.length) { console.log('GATE SCENERY: FAIL - no scenery packs (python tools/scenery_kit.py)'); process.exit(1); }
  const R = check(D);
  // 8 LAZY (G2904): the packs are fetched on demand (build.js MANIFEST.lazy), never index.html's static list; world_boot
  // asks for them when the record holds props, the editor's placer when it opens
  {
    const B = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8'), at = B.indexOf('lazy: [');
    if (B.slice(0, at).indexOf("'scenery', 'scenery_packs.json'") >= 0) R.fails.push('8 lazy: the scenery packs are in the static list of index.html');
    if (B.slice(at, at + 4000).indexOf("'scenery', 'scenery_packs.json'") < 0) R.fails.push('8 lazy: the scenery packs are not in MANIFEST.lazy');
    const WB = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'world_boot.js'), 'utf8'), AP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    if (!/\^scenery_\//.test(WB) && WB.indexOf('/^scenery_/') < 0) R.fails.push('8 lazy: world_boot.js does not ask for the scenery packs');
    if (AP.indexOf('/^scenery_/') < 0) R.fails.push('8 lazy: the editor (app.js) does not ask for the scenery packs');
  }
  if (process.argv.includes('--selftest')) {
    const clone = () => JSON.parse(JSON.stringify(Object.assign({}, D, { bins: {} })));
    const reds = [];
    const brk = (name, f) => {
      const C = clone(); C.bins = D.bins; C.imgs = D.imgs; f(C);
      const r = check(C);
      const base = new Set(R.fails);
      reds.push([name, r.fails.some(f => !base.has(f))]);   // a NEW red, not the same count
    };
    const k0 = D.REG.order.find(k => !D.REG.props[k].lodOf);
    brk('1 a row the bake lacks', C => C.T.rows.push(Object.assign({}, C.T.rows[0], { key: 'ghost' })));
    brk('2 a header count', C => { C.REG.props[k0].nt += 1; });
    brk('2 a declared height', C => { const r = C.T.rows.find(r => r.height); r.height *= 1.2; });
    brk('3 a map budget', C => { C.T.rows.find(r => r.key === k0).tex = 16; });
    brk('4 a prep target', C => { const r = C.T.rows.find(r => r.prep && r.prep.target && !r.prep.job && C.REG.props[r.key]); if (r) r.prep.target = 10; });
    brk('5 a level distance', C => { const k = C.REG.order.find(k => C.REG.props[k].lodOf); if (k) C.REG.props[k].lodDist += 1; });
    brk('6 a licence', C => { const r = C.T.rows.find(r => C.REG.props[r.key]); r.credit.licence = 'CC BY-NC 4.0'; });
    brk('6 the VotV rip', C => { C.T.rows[0].note += ' satellite radio telescope from VotV'; });
    brk('7 an elevation axis', C => { const a = Object.values(C.asm)[0]; if (a) a.parts.find(q => q.part === 'dish').axis = [0, 1, 0]; });
    brk('7 no obstruction light', C => { const a = Object.values(C.asm)[0]; if (a) a.lights = a.lights.filter(l => l.kind !== 'obstruction'); });
    for (const [n, red] of reds) if (!red) R.fails.push(`selftest: breaking "${n}" did not turn the gate red`);
    R.notes.push(`selftest: ${reds.filter(x => x[1]).length}/${reds.length} breaks caught`);
  }
  for (const n of R.notes) console.log('  ' + n);
  for (const f of R.fails) console.log('  FAIL ' + f);
  console.log('GATE SCENERY: ' + (R.fails.length ? 'FAIL (' + R.fails.length + ')' : 'PASS'));
  process.exit(R.fails.length ? 1 : 0);
}
if (require.main === module) main();
module.exports = { check, gather };
