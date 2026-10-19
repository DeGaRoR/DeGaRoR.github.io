#!/usr/bin/env node
// GATE DASH - THE ARCH DASH (G3340, DASH-REDESIGN 2026-10-18).
//
// The user: "the whole top and front parts are OK, the sides and bottom are
// not, and being able to fit fuel tanks without collisions in there feels
// imperative." `dashStyle 1` (the arch: _cage_gen.js's dash pass) keeps the
// glareshield, the roll, the lip and the flat plate, and rebuilds the sides
// and the bottom. This judges, on the validated saved builds (the Cub, the
// Jodel, the Cessna) built with the arch opted in:
//   load      a saved build without the row keeps the box (dashStyle 0), and
//             its sheet is the box's byte for byte against an explicit 0; a
//             new build (no file / a birth spec) gets the arch; a file that
//             carries the row keeps it
//   open      no dash face between the legs under the plate
//   edge      the cheeks' forward edge is ONE vertical line at zFront, from
//             the legs' foot to just under the glareshield
//   skin      no arch vertex further out through the skin than the box's
//             worst (or 2 mm)
//   tanks     the energy layer's own fit, the builds' REAL tanks: 0 points
//             through the arch's dash, and the box's count > 0 (the test is
//             not vacuous: the box's slanted bottom stood through them)
//   physics   the joined card flies the same mass and CG with either dash
// One child process per (build, style) for the energy layer: the layers keep
// module state across builds (GATE TANKMOUNT's measured trap).
//
//   node tools/_dash_check.js
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');
const T = __dirname;
const argv = process.argv.slice(2);
const BUILDS = ['cub_2026-09-20_corrected.json', 'jodel_2026-09-20_corrected.json', 'cessna172_2026-09-20_corrected.json']
  .map(f => path.join(T, '..', 'builds', f));

// ---- the child: one build, one style, the energy layer's verdict
if (argv[0] === '--tank') {
  const SH = require(path.join(T, '_scene_headless.js'));
  for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                   '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
  const BJ = require(path.join(T, '_bake_joined.js'));
  const { C } = BJ.loadPanel();
  const W = SH.context().ctx;
  SH.stubCanvas();
  console.error = () => {};
  const spec = JSON.parse(JSON.stringify(SH.loadFixture(argv[1]).spec));
  spec.cage = Object.assign({}, spec.cage, { dashStyle: +argv[2] });
  const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
  W.CAGE_ENERGY.fromSpec(spec.energy, spec);
  SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
  const rows = (W.CAGE_ENERGY.results() || []).map(r => ({ bay: r.v && r.v.bay, L: r.v && +r.v.capacity,
    dash: +(((r.why || []).join(' ').match(/through the dash \((\d+)/) || [])[1] || 0) }));
  process.stdout.write(JSON.stringify(rows));
  process.exit(0);
}

const fail = [];
let checks = 0;
const check = (ok, what, info) => { checks++; if (!ok) fail.push(what + (info != null ? ' (' + info + ')' : '')); return ok; };

const SH = require(path.join(T, '_scene_headless.js'));
const BJ = require(path.join(T, '_bake_joined.js'));
const { C } = BJ.loadPanel();
const CG2 = SH.context().ctx.CAGE2;
const hashOf = M => { const h = crypto.createHash('md5');
  for (const f of M.F) h.update(f.m + ':' + f.v.map(v => M.V[v].map(x => x.toFixed(7)).join(',')).join(';') + '|');
  return h.digest('hex'); };
const withStyle = (spec, st) => Object.assign(JSON.parse(JSON.stringify(spec)), { cage: Object.assign({}, spec.cage, { dashStyle: st }) });

// the tank children run while the geometry is judged here
const kids = [];
for (const b of BUILDS.slice(0, 2)) for (const st of [0, 1]) kids.push(new Promise(res => {
  const ch = spawn(process.execPath, [__filename, '--tank', b, String(st)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  ch.stdout.on('data', d => { out += d; }); ch.stderr.on('data', d => { err += d; });
  ch.on('close', code => { let j = null; try { j = JSON.parse(out); } catch (e) {} res({ b: path.basename(b), st, code, j, err }); });
}));

// ---- load: the migration at the one door
check(CG2.cageFromSpec(null).dashStyle === 1, 'load: a new build (no file) gets the arch');
for (const b of BUILDS) {
  const { spec } = SH.loadFixture(b);
  check(spec.cage.dashStyle == null && CG2.cageFromSpec(spec).dashStyle === 0, 'load: ' + path.basename(b) + ' (saved before the row) keeps the box');
  check(CG2.cageFromSpec(withStyle(spec, 1)).dashStyle === 1, 'load: a file carrying dashStyle 1 keeps the arch');
}
{
  const birth = BJ.loadPanel().D.designBake(BJ.loadPanel().D.ARCHETYPES[0].sel, BJ.loadPanel().D.ARCHETYPES[0].over);
  check(birth.cage && birth.cage.dashStyle === 1, 'load: a birth spec (the new-aircraft flow) states the arch', birth.cage && birth.cage.dashStyle);
}

// ---- the geometry, per build
const SKINX = f => !/^(dash|dashFace|tube|joint|woodFrame|beam|fire|bulkhead|shoulder)/.test(f.m) && !/window|windshield|glass|pane/i.test(f.m);
function skinOut(M, FS) {                       // dash vertices past the outer skin: [count > 1 mm, worst mm]
  const dv = new Set(); for (const f of M.F) if (f.m === 'dash' || f.m === 'dashFace') for (const v of f.v) dv.add(v);
  const pts = [...dv].map(v => M.V[v]); let zl = 1e9, zh = -1e9; for (const p of pts) { zl = Math.min(zl, p[2]); zh = Math.max(zh, p[2]); }
  const tris = [];
  for (const f of M.F) { if (!SKINX(f)) continue; const v = f.v; for (let i = 1; i + 1 < v.length; i++) { const Q = [M.V[v[0]], M.V[v[i]], M.V[v[i + 1]]];
    if (Math.max(Q[0][2], Q[1][2], Q[2][2]) < zl - 0.05 || Math.min(Q[0][2], Q[1][2], Q[2][2]) > zh + 0.05) continue; tris.push(Q); } }
  let n = 0, worst = 0;
  for (const p of pts) {
    const s = Math.sign(p[0]) || 1; let xb = -Infinity;
    for (const Q of tris) { const seg = [];
      for (let e = 0; e < 3; e++) { const a = Q[e], b = Q[(e + 1) % 3]; if ((a[2] - p[2]) * (b[2] - p[2]) < 0) { const t = (p[2] - a[2]) / (b[2] - a[2]); seg.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); } }
      if (seg.length !== 2 || (seg[0][1] - p[1]) * (seg[1][1] - p[1]) > 0 || seg[0][1] === seg[1][1]) continue;
      const t = (p[1] - seg[0][1]) / (seg[1][1] - seg[0][1]), x = s * (seg[0][0] + t * (seg[1][0] - seg[0][0])); if (x > xb) xb = x; }
    if (!(xb > 0.25 * Math.abs(p[0]))) continue;   // no skin of its own side there (a window, an opening)
    const out = (s * p[0] - xb) * FS; if (out > 0.001) { n++; worst = Math.max(worst, out); }
  }
  return [n, +(worst * 1000).toFixed(1)];
}
// (the three saved builds all have a door whose opening runs ahead of the
// panel, so their legs end at the plate; the Chinook-alike's birth spec has
// none, and its legs go down to its rail - the arch's lower half judged too)
const GEO = BUILDS.map(b => ({ nm: path.basename(b).split('_')[0], spec: SH.loadFixture(b).spec, saved: true }));
{
  const D = BJ.loadPanel().D, a = D.ARCHETYPES.find(x => x.key === 'chinook');
  if (check(!!a, 'the chinook card exists')) GEO.push({ nm: 'chinook (birth)', spec: D.designBake(a.sel, a.over), legs: true });
}
for (const g of GEO) {
  const nm = g.nm, spec = g.spec;
  const r0 = SH.sceneBuild(spec, {}), rB = SH.sceneBuild(withStyle(spec, 0), {}), rA = SH.sceneBuild(withStyle(spec, 1), {});
  if (g.saved) check(hashOf(r0.built.sheet) === hashOf(rB.built.sheet), nm + ': the saved build\'s sheet is the box\'s, byte for byte');
  if (g.legs) check(rA.built.sheet.dashArch && rA.built.sheet.dashArch.yFoot < rA.built.sheet.dashArch.yPlate - 0.02,
    nm + ': no door - the legs run below the plate to a rail');
  const M = rA.built.sheet, FS = rA.FS, DA = M.dashArch;
  if (!check(!!DA && !(rB.built.sheet.dashArch), nm + ': the arch is published (and the box publishes none)')) continue;
  const dv = []; for (const f of M.F) if (f.m === 'dash' || f.m === 'dashFace') for (const v of f.v) dv.push(M.V[v]);
  const xW = Math.max(...dv.map(p => Math.abs(p[0])));
  // open: nothing between the legs under the plate (the legs' own lips are 1.5 lips in)
  const lipU = +(rA.P.dashLip != null ? rA.P.dashLip : 0.035);
  // (the leg's own width at a height: where the wall turns in, the leg
  // follows it, and between the legs is inboard of THAT)
  const legW = y => Math.max(...dv.filter(q => Math.abs(q[1] - y) < 0.012).map(q => Math.abs(q[0])));
  const under = dv.filter(p => p[1] < DA.yPlate - 1e-4 && Math.abs(p[0]) < legW(p[1]) - 2.5 * lipU);
  check(under.length === 0, nm + ': open under the plate - no dash between the legs', under.length + ' vertices');
  // edge: the cheeks' forward-most points are at zFront at every height
  // (the cheeks: outboard, from the feet up to the forward edge's own top -
  // above it the glareshield's base line may bow ahead, as it always did)
  const cheek = dv.filter(p => Math.abs(p[0]) > xW - 0.6 * lipU && p[1] <= DA.yEdge + 1e-6 && p[1] >= DA.yFoot - 1e-6);
  const zMax = Math.max(...cheek.map(p => p[2]));
  check(Math.abs(zMax - DA.zFront) < 0.001 / FS, nm + ': nothing on the cheeks stands ahead of the forward edge', ((zMax - DA.zFront) * FS * 1000).toFixed(1) + ' mm');
  // ...and the points ON it run from the foot to above the plate's middle
  // height, both sides (zFront, to the millimetre: one vertical line)
  const yNeed = DA.yPlate + 0.9 * (DA.yEdge - DA.yPlate);
  for (const sd of [-1, 1]) {
    const on = dv.filter(p => p[0] * sd > 0 && Math.abs(p[2] - DA.zFront) < 0.001 / FS).map(p => p[1]);
    check(on.length && Math.min(...on) <= DA.yFoot + 0.001 / FS && Math.max(...on) >= yNeed,
      nm + ': the forward edge is one vertical line from the foot up (' + (sd > 0 ? 'left' : 'right') + ')',
      on.length ? (Math.min(...on) * FS).toFixed(3) + '..' + (Math.max(...on) * FS).toFixed(3) + ' m' : 'none');
  }
  // the plate: flat, unfolded (its projected area signed one way only), and
  // the face the user called OK
  const plateA = sh => { let a = 0, sg = 0; for (const f of sh.F) { if (f.m !== 'dashFace') continue; const v = f.v.map(i => sh.V[i]);
    for (let i = 1; i + 1 < v.length; i++) { const c = ((v[i][0] - v[0][0]) * (v[i + 1][1] - v[0][1]) - (v[i + 1][0] - v[0][0]) * (v[i][1] - v[0][1])) / 2; a += Math.abs(c); sg += c; } }
    return [a * FS * FS, Math.abs(sg) * FS * FS]; };
  const [aA, sA] = plateA(M), [aB] = plateA(rB.built.sheet);
  // (the arch's plate runs down to the box's bottom line: the box's black
  // border under it is gone, so it is never smaller and at most a lip taller)
  check(sA > 0.995 * aA && aA >= 0.995 * aB && aA <= aB + 1.05 * 2 * xW * lipU * FS * FS, nm + ': the plate is the box\'s or a lip more, unfolded', 'arch ' + aA.toFixed(4) + ' (signed ' + sA.toFixed(4) + ') vs box ' + aB.toFixed(4) + ' m2');
  // skin
  const [nB, wB] = skinOut(rB.built.sheet, rB.FS), [nA, wA] = skinOut(M, FS);
  check(wA <= Math.max(wB, 2), nm + ': the arch stands no further through the skin than the box did', 'arch ' + nA + ' @ ' + wA + ' mm, box ' + nB + ' @ ' + wB + ' mm');
  console.log('  ' + nm + ': plate bottom ' + (DA.yPlate * FS).toFixed(3) + ' m, feet ' + (DA.yFoot * FS).toFixed(3) + ' m, forward edge ' + (DA.zFront * FS).toFixed(3) +
              ' m; skin: box ' + nB + ' @ ' + wB + ' mm, arch ' + nA + ' @ ' + wA + ' mm');
}

// ---- physics: the joined card, either dash
for (const key of ['cub', 'c172']) {
  const D = BJ.loadPanel().D, a = D.ARCHETYPES.find(x => x.key === key);
  if (!check(!!a, 'physics: the ' + key + ' card exists')) continue;
  const mc = st => { const s0 = D.designBake(a.sel, a.over); s0.cage.dashStyle = st; const j = BJ.bakeJoined(s0);
    const g = C.buildGen(JSON.parse(JSON.stringify(j.spec))); let m = 0; const c = [0, 0, 0];
    for (const n of g.nodes) { m += n.m || 0; for (let k = 0; k < 3; k++) c[k] += (n.m || 0) * n.p[k]; }
    return [m, c.map(v => v / m)]; };
  // (a warm-up bake first: the first joined bake in a process reads 41 g
  // off every later one, whatever the dash - the layers' module state, the
  // carry-over GATE TANKMOUNT measured; not this gate's to fix)
  mc(1);
  const [m0, c0] = mc(0), [m1, c1] = mc(1);
  check(Math.abs(m0 - m1) < 1e-9 && c0.every((v, k) => Math.abs(v - c1[k]) < 1e-9), 'physics: ' + key + ' flies the same mass and CG with either dash',
    m0.toFixed(4) + ' vs ' + m1.toFixed(4) + ' kg');
}

Promise.all(kids).then(res => {
  const by = {};
  for (const r of res) { if (!check(!!r.j, 'tanks: ' + r.b + ' style ' + r.st + ' reported', r.err.split('\n').slice(-2).join(' | '))) continue; by[r.b + r.st] = r.j; }
  for (const b of BUILDS.slice(0, 2)) {
    const nm = path.basename(b), box = by[nm + 0], arch = by[nm + 1];
    if (!box || !arch) continue;
    check(arch.length > 0 && arch.every(t => t.dash === 0), 'tanks: ' + nm + ' - the real tanks stand clear of the arch', JSON.stringify(arch));
    check(box.some(t => t.dash > 0), 'tanks: ' + nm + ' - the box stood through them (the test is not vacuous)', JSON.stringify(box));
    console.log('  ' + nm.split('_')[0] + ' tanks: box ' + box.map(t => t.bay + ' ' + t.L + ' L ' + t.dash + ' pts').join(', ') +
                ' / arch ' + arch.map(t => t.bay + ' ' + t.L + ' L ' + t.dash + ' pts').join(', '));
  }
  for (const f of fail) console.log('  FAIL ' + f);
  console.log(checks + ' checks');
  console.log('GATE DASH: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
});
