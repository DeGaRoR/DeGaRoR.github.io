#!/usr/bin/env node
// _car_check.js - GATE CARS (ASSETS-OCT, G2908). The driveable cars: tools/car_table.py -> tools/car_prep.py
// (prop_prep's runner + the data sheet) -> src/cars/cars_car.js + car_<car>.json + media/geo|tex/cars ->
// tools/prop_lod.js --kit cars.
//
//   1 TABLE    the bake holds every declared row (key / label), in order, and nothing else
//   2 PHYSICAL every prop decodes, header counts, unit normals; a 'centre' part is centred and carries `at`
//   3 MAPS     every map within its row's `tex`
//   4 SHEET    four wheels, each a `centre` part's `at` within 1 cm; wheelbase = front - rear axle; the
//              track = the pair's spacing; a wheel 0.25-0.6 m in radius; the car level (tyre bottoms within
//              5 mm); the steering wheel's `at` = the sheet's centre, its axis unit and toward the driver;
//              the collision boxes inside the body's box; the estimates block present and NAMED estimates
//   5 LEVELS   what prop_lod.js's ladder asks, each under 0.7 of the level above
//   6 CREDITS  every car CC-BY-4.0, the author named in CREDITS.md, the sheet's credit line
// Run: node tools/_car_check.js [--selftest]        (one final `GATE CARS: ...`)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const CORE = require('./flight_core.js');
const LT = require('./prop_lod.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'src', 'cars');

function readTable() {
  const py = 'import importlib.util,json,sys;s=importlib.util.spec_from_file_location("t",sys.argv[1]);' +
    't=importlib.util.module_from_spec(s);s.loader.exec_module(t);' +
    'print(json.dumps(dict(rows=[{k:v for k,v in r.items()} for r in t.PROPS],sources=t.SOURCES,cars=list(t.FILE))))';
  for (const exe of ['python', 'py', 'python3']) {
    const r = spawnSync(exe, ['-c', py, path.join(__dirname, 'car_table.py')], { encoding: 'utf8' });
    if (r.status === 0) return JSON.parse(r.stdout);
  }
  throw new Error('python could not read tools/car_table.py');
}
function readPacks() {
  const mf = path.join(DIR, 'cars_packs.json');
  if (!fs.existsSync(mf)) return [];
  const out = [];
  const sb = { registerPropPack: p => out.push(p), console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(mf, 'utf8'))) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), sb, { filename: f });
  const R = { order: [], props: {}, texs: {} };
  for (const p of out) { Object.assign(R.texs, p.texs); for (const k of p.order) { R.order.push(k); R.props[k] = p.props[k]; } }
  return R;
}
const imgMax = buf => {
  if (buf[0] === 0x89) return Math.max(buf.readUInt32BE(16), buf.readUInt32BE(20));
  if (buf[0] === 0xff && buf[1] === 0xd8) { let o = 2; while (o < buf.length) { if (buf[o] !== 0xff) { o++; continue; } const m = buf[o + 1], l = buf.readUInt16BE(o + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return Math.max(buf.readUInt16BE(o + 5), buf.readUInt16BE(o + 7)); o += 2 + l; } }
  if (buf.toString('ascii', 8, 12) === 'WEBP') { const k = buf.toString('ascii', 12, 16);
    if (k === 'VP8 ') return Math.max(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
    if (k === 'VP8L') { const b = buf.readUInt32LE(21); return Math.max((b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1); }
    if (k === 'VP8X') return Math.max(1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)); }
  return null;
};

function check(D) {
  const fails = [], fail = m => fails.push(m);
  const { T, REG, bins, imgs, sheets, creditsMd } = D;
  const FULL = REG.order.filter(k => !REG.props[k].lodOf), LODS = REG.order.filter(k => REG.props[k].lodOf);
  const row = Object.fromEntries(T.rows.map(r => [r.key, r]));
  // 1
  if (T.rows.map(r => r.key).join(',') !== FULL.join(',')) fail(`1 table: baked [${FULL}] declared [${T.rows.map(r => r.key)}]`);
  for (const r of T.rows) { const p = REG.props[r.key]; if (p && p.label !== r.label) fail(`1 table: ${r.key} label "${p.label}"`); }
  // 2
  for (const k of REG.order) {
    const p = REG.props[k], bin = bins[p.bin];
    if (!bin) { fail(`2 physical: ${k} bin ${p.bin} missing`); continue; }
    let dec; try { dec = CORE.decodeProp(p, bin); } catch (e) { fail(`2 physical: ${k} decode threw ${e.message}`); continue; }
    let nv = 0, nt = 0, worst = 0;
    for (const q of dec.parts) { nv += q.nv; nt += q.nt; for (let i = 0; i < q.nv; i++) worst = Math.max(worst, Math.abs(Math.hypot(q.nrm[i * 3], q.nrm[i * 3 + 1], q.nrm[i * 3 + 2]) - 1)); }
    if (nv !== p.nv || nt !== p.nt) fail(`2 physical: ${k} decodes ${nv}v/${nt}t, header ${p.nv}/${p.nt}`);
    if (worst > 0.02) fail(`2 physical: ${k} normals off unit by ${worst.toFixed(3)}`);
    if (p.place === 'centre' && !p.lodOf) {
      if (!p.at) fail(`2 physical: ${k} is place=centre with no 'at'`);
      for (let a = 0; a < 3; a++) if (Math.abs(p.bb[a] + p.bb[a + 3]) > 2e-3) fail(`2 physical: ${k} is place=centre but not centred on axis ${a}`);
    }
  }
  // 3
  for (const k of FULL) { const p = REG.props[k], r = row[k]; if (!r) continue;
    for (const m of Object.values(p.mats)) for (const s of ['map', 'arm', 'nor', 'emisMap']) { const t = REG.texs[m[s]];
      if (typeof t !== 'string') continue; const sz = imgs[t];
      if (!sz) fail(`3 maps: ${k} ${s} ${t} missing`); else if (sz > r.tex) fail(`3 maps: ${k} ${s} ${sz}px over ${r.tex}`); } }
  // 4
  for (const car of T.cars) {
    const S = sheets[car];
    if (!S) { fail(`4 sheet: src/cars/car_${car}.json missing`); continue; }
    const W = S.wheels || {};
    if (Object.keys(W).sort().join() !== 'FL,FR,RL,RR') { fail(`4 sheet: ${car} wheels [${Object.keys(W)}]`); continue; }
    for (const [n, w] of Object.entries(W)) {
      if (!(w.radius > 0.25 && w.radius < 0.6)) fail(`4 sheet: ${car} ${n} radius ${w.radius}`);
      const P = REG.props[w.prop];
      if (!P) { fail(`4 sheet: ${car} ${n} names ${w.prop}, not baked`); continue; }
      if ((n === 'FL' || n === 'FR') && Math.hypot(...P.at.map((v, i) => v - w.centre[i])) > 0.01) fail(`4 sheet: ${car} ${n} centre [${w.centre}] vs the part's at [${P.at}]`);
      if (Math.abs(P.dim[1] / 2 - w.radius) > 0.01) fail(`4 sheet: ${car} ${n} radius ${w.radius} vs the part's ${P.dim[1] / 2}`);
    }
    const fx = (W.FL.centre[0] + W.FR.centre[0]) / 2, rx = (W.RL.centre[0] + W.RR.centre[0]) / 2;
    if (Math.abs(S.wheelbase - (fx - rx)) > 1e-3 || S.wheelbase < 1.8 || S.wheelbase > 4.5) fail(`4 sheet: ${car} wheelbase ${S.wheelbase}`);
    if (Math.abs(S.track.front - (W.FR.centre[2] - W.FL.centre[2])) > 1e-3) fail(`4 sheet: ${car} front track ${S.track.front}`);
    if (!(S.level_check && S.level_check.spread < 0.005)) fail(`4 sheet: ${car} not level (tyre bottoms spread ${S.level_check && S.level_check.spread} m)`);
    const st = S.steer || {}, SP = REG.props[st.prop];
    if (!SP || Math.hypot(...SP.at.map((v, i) => v - st.centre[i])) > 0.02) fail(`4 sheet: ${car} steering wheel's centre is not its part's at`);
    if (!st.axis || Math.abs(Math.hypot(...st.axis) - 1) > 1e-3 || !(st.axis[0] < 0)) fail(`4 sheet: ${car} steering axis [${st.axis}] not unit / not toward the driver`);
    for (const b of (S.collision || {}).boxes || []) for (let a = 0; a < 3; a++)
      if (b.lo[a] < S.box.lo[a] - 0.01 || b.hi[a] > S.box.hi[a] + 0.01 || b.lo[a] >= b.hi[a]) fail(`4 sheet: ${car} collision box ${b.name} outside the body / empty on axis ${a}`);
    const E = S.estimates || {};
    if (!(E.mass_kg > 500 && E.mass_kg < 5000) || !/ESTIMATE/.test(E.note || '') || !E.cg || !E.cameras || !E.cameras.driver_eye) fail(`4 sheet: ${car} estimates missing or not named estimates`);
  }
  // 5
  const by = new Map();
  for (const k of LODS) { const L = REG.props[k]; if (!row[L.lodOf]) fail(`5 levels: ${k} stands in for ${L.lodOf}`); (by.get(L.lodOf) || by.set(L.lodOf, []).get(L.lodOf)).push(k); }
  for (const k of FULL) { const P = REG.props[k], want = LT.levelsFor(P), have = by.get(k) || [];
    if (have.length !== want.length) { fail(`5 levels: ${k} has ${have.length}, the ladder asks ${want.length} (node tools/prop_lod.js --kit cars)`); continue; }
    let prev = P.nt; have.forEach((h, i) => { const L = REG.props[h]; if (L.lodDist !== want[i][1]) fail(`5 levels: ${h} past ${L.lodDist}`); if (!(L.nt < 0.7 * prev)) fail(`5 levels: ${h} not under 0.7`); prev = L.nt; }); }
  // 6
  for (const [car, s] of Object.entries(T.sources)) {
    if (s[2] !== 'CC-BY-4.0' && s[2] !== 'CC0') fail(`6 credits: ${car} licence ${s[2]}`);
    if (!creditsMd.includes(s[1])) fail(`6 credits: ${car}'s author ${s[1]} not in CREDITS.md`);
    if (sheets[car] && !String(sheets[car].credit).includes(s[1])) fail(`6 credits: ${car}'s sheet has no credit line`);
  }
  return fails;
}

function gather() {
  const T = readTable(), REG = readPacks(), bins = {}, imgs = {}, sheets = {};
  for (const k of REG.order) { const b = REG.props[k].bin; if (b && !bins[b] && fs.existsSync(path.join(ROOT, b))) {
    let buf = fs.readFileSync(path.join(ROOT, b)); try { buf = zlib.gunzipSync(buf); } catch (e) { /* plain */ } bins[b] = buf; } }
  for (const t of Object.values(REG.texs)) if (typeof t === 'string' && fs.existsSync(path.join(ROOT, t))) imgs[t] = imgMax(fs.readFileSync(path.join(ROOT, t)));
  for (const car of T.cars) { const f = path.join(DIR, `car_${car}.json`); if (fs.existsSync(f)) sheets[car] = JSON.parse(fs.readFileSync(f, 'utf8')); }
  return { T, REG, bins, imgs, sheets, creditsMd: fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8') };
}

const D = gather();
if (!D.REG.order.length) { console.log('GATE CARS: FAIL - no car packs (python tools/car_prep.py)'); process.exit(1); }
const F = check(D);
if (process.argv.includes('--selftest')) {
  const base = new Set(F), car = D.T.cars[0];
  const brk = (n, f) => { const C = Object.assign({}, D, JSON.parse(JSON.stringify({ T: D.T, REG: D.REG, sheets: D.sheets, imgs: D.imgs }))); C.bins = D.bins; C.creditsMd = D.creditsMd; f(C);
    if (!check(C).some(x => !base.has(x))) F.push(`selftest: breaking "${n}" did not turn the gate red`); };
  brk('a row', C => C.T.rows.push(Object.assign({}, C.T.rows[0], { key: 'ghost' })));
  brk('a header', C => { C.REG.props[C.REG.order[0]].nt++; });
  brk('a map budget', C => { C.T.rows[0].tex = 16; });
  brk('a wheel centre', C => { C.sheets[car].wheels.FL.centre[0] += 0.05; });
  brk('the wheelbase', C => { C.sheets[car].wheelbase += 0.1; });
  brk('the level', C => { C.sheets[car].level_check.spread = 0.011; });
  brk('the steering axis', C => { C.sheets[car].steer.axis = [1, 0, 0]; });
  brk('a collision box', C => { C.sheets[car].collision.boxes[0].hi[1] += 5; });
  brk('the estimates', C => { C.sheets[car].estimates.note = 'measured'; });
  brk('a licence', C => { C.T.sources[car][2] = 'CC-BY-NC-4.0'; });
  console.log('  selftest: 10 breaks tried');
}
for (const f of F) console.log('  FAIL ' + f);
console.log(`  ${D.REG.order.length} props (${D.REG.order.filter(k => D.REG.props[k].lodOf).length} levels), ${D.T.cars.length} car(s)`);
console.log('GATE CARS: ' + (F.length ? 'FAIL (' + F.length + ')' : 'PASS'));
process.exit(F.length ? 1 : 0);
