#!/usr/bin/env node
// _totem_check.js — GATE TOTEM: the totem poles said three times must agree
// (2026-09-13) - the declared table (tools/totem_table.py), the shipped pack
// (src/totems/totems_poles.js, cut by tools/totem_lod.js from the staged
// as-is bake), and the generator's headless mirror (TOTEM_KIT in
// tools/_totem_gen.js) - and the park plan must be a park.
//
//   1  the pack's full props are the table's rows, in the table's order
//   2  every base is a CUT: at the sheet's budget (within 1 %), well under
//      the scan it came from, and `srcNt` says what that was
//   3  a row with a declared height stands at it (dim.y within 1 %)
//   4  every pole carries exactly the sheet's levels; each level is the size
//      of its pole (same bb), placed alike, wears only its pole's maps, has
//      fewer triangles than the one before and stands in from farther
//   5  every media file the pack names is on disk (bins and maps), and the
//      stage's own as-is bins are NOT under media/ (the as-is bake does not
//      ship)
//   6  TOTEM_KIT mirrors the pack: the same keys, L/W/H the pack's metres
//      within 5 mm, srcNt the same number
//   7  the plan, over twenty seeds: every pole inside the patch with a
//      metre to spare, no two footprints within a metre of each other, every
//      pole turned to the lawn within the scatter, the great pole a step
//      back of the arc, boulders clear of poles and of the path, the house
//      slot clear of every pole, the ground within ±0.8 m, and the same seed
//      the same park twice
//
// Usage: node tools/_totem_check.js          (prints GATE TOTEM: PASS|FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;
const ROOT = path.join(TOOLS, '..');
const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' - ' + extra : ''));
  return ok;
};

// ---- the table, read out of the python source -------------------------------
const tab = fs.readFileSync(path.join(TOOLS, 'totem_table.py'), 'utf8');
const rows = [];
for (const m of tab.matchAll(/P\('([a-z_]+)',\s*'([a-z]+)',[^\n]*?'([a-z]+)'(?:,\s*height=([0-9.]+))?/g))
  rows.push({ key: m[1], group: m[2], src: m[3], height: m[4] ? +m[4] : null });
check(rows.length >= 7, 'table: fewer than seven rows read from totem_table.py', String(rows.length));

// ---- the pack ------------------------------------------------------------------
const C = require(path.join(ROOT, 'src', 'core', '51_prop_codec.js'));
const mf = path.join(ROOT, 'src', 'totems', 'totems_packs.json');
let reg = null;
if (check(fs.existsSync(mf), 'pack: no src/totems/totems_packs.json (run python tools/totem_prep.py)')) {
  const sb = { registerPropPack: C.registerPropPack, console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(mf, 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'totems', f), 'utf8'), sb, { filename: f });
  reg = C.PROP_REG;
}
const LT = require(path.join(TOOLS, 'totem_lod.js'));
const G = require(path.join(TOOLS, '_totem_gen.js'));

if (reg) {
  const full = reg.order.filter(k => !reg.props[k].lodOf);
  // 1
  check(JSON.stringify(full) === JSON.stringify(rows.map(r => r.key)),
        'pack: the full props are not the declared table',
        'pack ' + full.join(',') + ' / table ' + rows.map(r => r.key).join(','));
  // 2, 3
  for (const r of rows) {
    const p = reg.props[r.key];
    if (!check(!!p, 'pack: ' + r.key + ' is not baked')) continue;
    const base = LT.baseFor(p);
    check(typeof p.srcNt === 'number' && p.srcNt > p.nt * 2, 'cut: ' + r.key + ' is not a cut of a larger scan', 'srcNt ' + p.srcNt + ' nt ' + p.nt);
    check(Math.abs(p.nt - base) <= base * 0.01, 'cut: ' + r.key + ' is not at the sheet\'s base', p.nt + ' vs ' + base);
    check(p.place === 'floor', 'pack: ' + r.key + ' is not placed by its floor');
    check(Math.abs(p.bb[1]) < 1e-3, 'pack: ' + r.key + ' does not stand on y = 0', String(p.bb[1]));
    if (r.height !== null)
      check(Math.abs(p.dim[1] - r.height) <= r.height * 0.01, 'height: ' + r.key + ' does not stand at its declared height', p.dim[1] + ' vs ' + r.height);
    // 4
    const want = LT.levelsFor(p);
    const lv = reg.order.map(k => reg.props[k]).filter(q => q.lodOf === r.key).sort((a, b) => a.lodDist - b.lodDist);
    check(JSON.stringify(lv.map(q => q.lodDist)) === JSON.stringify(want.map(l => l[1])),
          'lod: ' + r.key + ' has levels ' + lv.map(q => q.lodDist).join('/') + ' m, the sheet says ' + want.map(l => l[1]).join('/') + ' m');
    let prev = p, d = 0;
    lv.forEach((q, i) => {
      check(JSON.stringify(q.bb) === JSON.stringify(p.bb), 'lod: ' + q.key + ' is not the size of ' + r.key);
      check(q.place === p.place, 'lod: ' + q.key + ' is placed unlike ' + r.key);
      check(Object.keys(q.mats).every(m => p.mats[m] && p.mats[m].map === q.mats[m].map), 'lod: ' + q.key + ' wears maps ' + r.key + ' does not');
      check(q.nt < prev.nt, 'lod: ' + q.key + ' has no fewer triangles than ' + prev.key, q.nt + ' vs ' + prev.nt);
      check(q.lodDist > d, 'lod: ' + q.key + ' does not stand in from farther than ' + prev.key);
      if (want[i]) check(Math.abs(q.nt - want[i][0]) <= want[i][0] * 0.02, 'lod: ' + q.key + ' is not at its target', q.nt + ' vs ' + want[i][0]);
      prev = q; d = q.lodDist;
    });
  }
  // 5
  for (const k of reg.order) {
    const p = reg.props[k];
    check(p.bin && p.bin.startsWith('media/geo/totems/') && fs.existsSync(path.join(ROOT, p.bin)), 'media: ' + k + ' bin missing or not under media/geo/totems', p.bin);
  }
  for (const id in reg.texs)
    check(reg.texs[id].startsWith('media/tex/totems/') && fs.existsSync(path.join(ROOT, reg.texs[id])), 'media: map missing or not under media/tex/totems', reg.texs[id]);
  const geoDir = path.join(ROOT, 'media', 'geo', 'totems');
  if (fs.existsSync(geoDir)) {
    const big = fs.readdirSync(geoDir).filter(f => fs.statSync(path.join(geoDir, f)).size > 1.5 * 1048576);
    check(big.length === 0, 'media: an as-is bin has crept into media/geo/totems', big.join(','));
  }
  // 6
  const K = G.TOTEM_KIT;
  check(JSON.stringify(Object.keys(K).sort()) === JSON.stringify(full.slice().sort()), 'mirror: TOTEM_KIT keys are not the pack\'s', Object.keys(K).join(',') + ' / ' + full.join(','));
  for (const k of full) {
    const p = reg.props[k], m = K[k];
    if (!m) continue;
    check(Math.abs(m.W - p.dim[0]) < 0.005 && Math.abs(m.H - p.dim[1]) < 0.005 && Math.abs(m.L - p.dim[2]) < 0.005,
          'mirror: ' + k + ' metres differ from the pack', 'kit ' + [m.W, m.H, m.L].join('x') + ' pack ' + p.dim.join('x'));
    check(m.srcNt === p.srcNt, 'mirror: ' + k + ' srcNt differs from the pack', m.srcNt + ' vs ' + p.srcNt);
    check(typeof m.face === 'number' && m.face > -180 && m.face <= 180, 'mirror: ' + k + ' face azimuth out of range');
  }
}

// ---- 7 the plan ------------------------------------------------------------------
const D2R = Math.PI / 180;
const wrap = a => ((a + 180) % 360 + 360) % 360 - 180;
for (let seed = 1; seed <= 20; seed++) {
  const P = G.totemPlan({ seed });
  const tag = 'plan ' + seed + ': ';
  check(P.poles.length === G.KEYS.length, tag + 'not every pole placed', String(P.poles.length));
  check(new Set(P.poles.map(p => p.key)).size === P.poles.length, tag + 'a pole placed twice');
  for (const p of P.poles) {
    check(Math.abs(p.x) + p.r <= P.w / 2 - 1 && Math.abs(p.z) + p.r <= P.d / 2 - 1, tag + p.key + ' outside the patch', p.x + ',' + p.z);
    const face = G.TOTEM_KIT[p.key].face;
    const looks = wrap(p.ry / D2R + face);            // where the carving looks, world az from +z
    check(Math.abs(looks) <= G.DEF.scatter + 25, tag + p.key + ' does not look to the lawn', looks.toFixed(0) + ' deg');
    check(Math.abs(p.y - P.ground(p.x, p.z)) < 1e-3, tag + p.key + ' not on the ground');
    if (P.house) {
      const h = P.house;
      check(Math.abs(p.x - h.x) > h.w / 2 + p.r + 1.5 || Math.abs(p.z - h.z) > h.d / 2 + p.r + 1.5, tag + p.key + ' stands in the house slot');
    }
    if (p.key === 'totem_tall') {
      const arcZ = P.arc.zMid - P.arc.bow * Math.pow(p.x / P.arc.half, 2);
      check(p.z < arcZ - 1.5, tag + 'the great pole is not set back of the arc');
    }
  }
  for (let i = 0; i < P.poles.length; i++) for (let j = i + 1; j < P.poles.length; j++) {
    const a = P.poles[i], b = P.poles[j];
    // across the arc a pole takes its own width (all face the lawn); a beak
    // or a wing reaches toward the lawn, not the neighbour
    check(Math.hypot(a.x - b.x, a.z - b.z) >= a.rx + b.rx + 1.0, tag + a.key + ' and ' + b.key + ' crowd each other', Math.hypot(a.x - b.x, a.z - b.z).toFixed(2));
  }
  check(P.rocks.length >= 3, tag + 'fewer than three boulders', String(P.rocks.length));
  for (const r of P.rocks) {
    check(P.poles.every(p => Math.hypot(p.x - r.x, p.z - r.z) >= p.r + r.r + 1.0), tag + 'a boulder against a pole');
    check(Math.abs(r.z - P.path.at(r.x)) >= P.path.width / 2 + r.r + 0.5, tag + 'a boulder on the path');
    check(Math.abs(r.x) + r.r <= P.w / 2 && Math.abs(r.z) + r.r <= P.d / 2, tag + 'a boulder outside the patch');
  }
  let lo = 1e9, hi = -1e9;
  for (let x = -P.w / 2; x <= P.w / 2; x += 1) for (let z = -P.d / 2; z <= P.d / 2; z += 1) { const y = P.ground(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  check(lo > -0.8 && hi < 0.8, tag + 'the ground is not a gentle patch', lo.toFixed(2) + '..' + hi.toFixed(2));
  const again = G.totemPlan({ seed });
  const strip = Q => JSON.stringify(Object.assign({}, Q, { ground: null, path: Object.assign({}, Q.path, { at: null }) }));
  check(strip(P) === strip(again), tag + 'the same seed is not the same park');
}

if (fail.length) {
  for (const f of fail.slice(0, 30)) console.log('  ! ' + f);
  if (fail.length > 30) console.log('  ... ' + (fail.length - 30) + ' more');
  console.log('GATE TOTEM: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('GATE TOTEM: PASS');
