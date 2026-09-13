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
//   7  the plan, over twenty seeds: every pole ON the half circle at its
//      radius, on the back half, inside the patch, looking at the lawn's
//      centre within the scatter, standing on the level lawn; no two widths
//      within a metre; boulders clear of poles, path and the clearing's
//      middle; the house slot clear; the lawn level over its whole
//      footprint and the outside a gentle swell; the same seed twice
//   8  the plan on a plot (totemPlot): a synthetic village plot on a
//      sloping terrain - every pole, the footprint and the house slot inside
//      the plot's polygon, every pole at the lawn's level looking at the
//      centre in world, the park opening on the road, the level a height the
//      terrain has there; a water-side plot turns the park round
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
check(rows.length >= 6, 'table: fewer than six rows read from totem_table.py', String(rows.length));

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
    // on the half circle, at its radius, on the back half, inside the patch
    check(Math.abs(Math.hypot(p.x, p.z) - P.R) < 0.01, tag + p.key + ' is not on the circle', Math.hypot(p.x, p.z).toFixed(2) + ' vs ' + P.R);
    check(p.z <= 0.5, tag + p.key + ' stands in front of the horns', String(p.z));
    check(p.x - p.r >= P.patch.x0 && p.x + p.r <= P.patch.x1 && p.z - p.r >= P.patch.z0, tag + p.key + ' outside the patch');
    // looks at the lawn's centre within the scatter
    const face = G.TOTEM_KIT[p.key].face;
    const looks = wrap(p.ry / D2R + face), toCentre = wrap(Math.atan2(-p.x, -p.z) / D2R);
    check(Math.abs(wrap(looks - toCentre)) <= G.DEF.scatter + 1, tag + p.key + ' does not look at the centre', wrap(looks - toCentre).toFixed(0) + ' deg');
    check(Math.abs(p.y - P.ground(p.x, p.z)) < 1e-3, tag + p.key + ' not on the ground');
    check(P.flat ? Math.abs(p.y - P.level) < 1e-6 : true, tag + p.key + ' not on the flat lawn');
    if (P.house) {
      const h = P.house;
      check(Math.abs(p.x - h.x) > h.w / 2 + p.r + 1.0 || Math.abs(p.z - h.z) > h.d / 2 + p.r + 1.0, tag + p.key + ' stands in the house slot');
    }
  }
  for (let i = 0; i < P.poles.length; i++) for (let j = i + 1; j < P.poles.length; j++) {
    const a = P.poles[i], b = P.poles[j];
    // across the arc a pole takes its own width (all face the centre); a
    // beak or a wing reaches inward, not at the neighbour
    check(Math.hypot(a.x - b.x, a.z - b.z) >= a.rx + b.rx + 1.0, tag + a.key + ' and ' + b.key + ' crowd each other', Math.hypot(a.x - b.x, a.z - b.z).toFixed(2));
  }
  check(P.rocks.length >= 3, tag + 'fewer than three boulders', String(P.rocks.length));
  for (const r of P.rocks) {
    check(P.poles.every(p => Math.hypot(p.x - r.x, p.z - r.z) >= p.r + r.r + 1.0), tag + 'a boulder against a pole');
    check(r.z <= P.path.at(r.x) - P.path.width / 2 - r.r - 0.5, tag + 'a boulder on the path');
    check(P.inside(r.x, r.z) >= r.r, tag + 'a boulder outside the lawn');
    check(Math.hypot(r.x, r.z) >= 4, tag + 'a boulder in the middle of the clearing');
  }
  // the lawn is level over the whole footprint, the outside a gentle swell
  let flatOk = true, lo = 1e9, hi = -1e9;
  for (let x = P.patch.x0 - 6; x <= P.patch.x1 + 6; x += 1) for (let z = P.patch.z0 - 6; z <= P.patch.z1 + 6; z += 1) {
    const y = P.ground(x, z);
    if (P.inside(x, z) >= 0 && Math.abs(y - P.level) > 1e-9) flatOk = false;
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  check(flatOk, tag + 'the lawn is not level inside its footprint');
  check(lo > -0.8 && hi < 0.8, tag + 'the outside is not a gentle swell', lo.toFixed(2) + '..' + hi.toFixed(2));
  check(P.footprint.length >= 26, tag + 'the footprint polygon is short');
  const again = G.totemPlan({ seed });
  const strip = Q => JSON.stringify(Object.assign({}, Q, { ground: null, inside: null, path: Object.assign({}, Q.path, { at: null }) }));
  check(strip(P) === strip(again), tag + 'the same seed is not the same park');
}

// ---- 8 the plan on a plot ------------------------------------------------------------
// a synthetic village plot the way planPlots writes one: frontage f0-f1
// along a road running east, the plot to its north (n = [0, -1] away from
// the road), 60 m wide, 50 m deep, on a terrain sloping 1 in 40
{
  const f0 = [100, 200], f1 = [160, 200], depth = 50;
  const n = [0, -1], tg = [1, 0];
  const plot = { id: 7, side: 'land', w: 60, depth, n, tg, front: [130, 200],
                 poly: [f0, f1, [f1[0] + n[0] * depth, f1[1] + n[1] * depth], [f0[0] + n[0] * depth, f0[1] + n[1] * depth]] };
  const T = { h: (x, z) => 12 + (x - 100) / 40 + Math.sin(z * 0.3) * 0.2 };
  const inPoly = (poly, x, z) => { let s = 0; for (let i = 0; i < 4; i++) { const a = poly[i], b = poly[(i + 1) % 4]; const c = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]); if (i === 0) s = Math.sign(c); else if (Math.sign(c) !== s && c !== 0) return false; } return true; };
  const W = G.totemPlot(plot, T, { seed: 3 });
  const tag = 'plot: ';
  check(W.frame === 'world' && W.poles.length === G.KEYS.length, tag + 'no world plan');
  check(W.R >= 8 && W.R <= 20, tag + 'R out of range', String(W.R));
  for (const p of W.poles) {
    check(inPoly(plot.poly, p.x, p.z), tag + p.key + ' is off the plot', p.x + ',' + p.z);
    check(p.y === W.level, tag + p.key + ' not at the lawn level');
    // it looks at the lawn's centre in WORLD too: the local look turned by yaw
    const face = G.TOTEM_KIT[p.key].face;
    const looks = wrap(p.ry / D2R + face), toC = wrap(Math.atan2(W.centre[0] - p.x, W.centre[1] - p.z) / D2R);
    check(Math.abs(wrap(looks - toC)) <= G.DEF.scatter + 1, tag + p.key + ' does not look at the centre in world', wrap(looks - toC).toFixed(0));
  }
  for (const q of W.footprint) check(inPoly(plot.poly, q[0], q[1]), tag + 'the footprint leaves the plot', q.join(','));
  // the park opens on the road: the path is nearer the frontage than the apex
  const apex = W.toWorld(0, -W.R);
  const dPath = Math.min(...W.path.pts.map(q => Math.abs(q[1] - 200))), dApex = Math.abs(apex[1] - 200);
  check(dPath < dApex, tag + 'the park does not open on the road', dPath.toFixed(1) + ' vs ' + dApex.toFixed(1));
  check(W.house && inPoly(plot.poly, W.house.x, W.house.z), tag + 'the house slot is off the plot');
  const hs = W.footprint.map(q => T.h(q[0], q[1]));
  check(W.level >= Math.min(...hs) && W.level <= Math.max(...hs), tag + 'the level is not a height of the terrain there');
  // a water plot (n toward the water, the road behind) turns the park round
  const plotW = Object.assign({}, plot, { side: 'water', n: [0, 1], poly: [f0, f1, [f1[0], f1[1] + depth], [f0[0], f0[1] + depth]] });
  const W2 = G.totemPlot(plotW, T, { seed: 3 });
  check(W2.poles.every(p => inPoly(plotW.poly, p.x, p.z)), tag + 'a water-side park leaves its plot');
  check(Math.abs(wrap((W2.yaw - W.yaw) / D2R)) > 170, tag + 'a water-side park is not turned round', String(W2.yaw - W.yaw));
}

if (fail.length) {
  for (const f of fail.slice(0, 30)) console.log('  ! ' + f);
  if (fail.length > 30) console.log('  ... ' + (fail.length - 30) + ' more');
  console.log('GATE TOTEM: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('GATE TOTEM: PASS');
