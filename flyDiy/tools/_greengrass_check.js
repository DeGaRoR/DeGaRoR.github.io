#!/usr/bin/env node
// _greengrass_check.js - GATE GREENGRASS (LOOK-1, 15 Nov 2026): GRASS ON GREEN. The user: "everything green should get some
// grass ... Flight simulator would spawn grass on anything colored greenish ... Green ground without grass looks bad".
// The grass field (src/viewer/cover_ring.js, layer 'grass') grows on ground that DRAWS green even where its type's row grows
// none or little, and never where it must not. On the real ring and the real fade hook, over a fake WebGL2 (_fake_gl.js), a
// flat world of the gate's own:
//   1. greenOf on the ground library's means: lush and grass read green; dry, dirt, mud, grass-rock, the forest floor, rocks,
//      leaves, beach, snow do not
//   2. a type with NO row (a bare mix) on GREEN ground grows tufts with the dial on - and none with green 0 (today's field)
//   3. the same bare type on BROWN ground (the dry set's colour): none
//   4. a sparse row (dens 0.35, the forest floor's) on green ground: more tufts with the dial than without
//   5. never on: a runway's kill (coverAt kill 1), mud or snow (world.surface, SNOW-MUD's SURFACE names), the sea code
//   6. the tuft's length on a bare type is the meadow's (FIELD_TYPES.grassland h 0.30): the mean scale sits by it
//   7. the feather (16 Nov): off, the grass stops at a class edge; feather 1 runs it one node across, no further, never onto a kill
//   8. the instrument fieldAt(x, z): what the field plants at a point and why (wild / no row, not green / kill)
//   node tools/_greengrass_check.js   -> "GATE GREENGRASS: PASS|FAIL"
'use strict';
const path = require('path');
const { boot } = require('./_fake_gl.js');
let fails = 0;
const ok = (c, m, x) => { console.log((c ? '  ok   ' : '  FAIL ') + m + (x !== undefined ? '  (' + x + ')' : '')); if (!c) fails++; };
console.log('GATE GREENGRASS');

// the library's means (linear rgb): cover_ring.js MEANS, the importer's measure
const LIB = { beach: [0.2826, 0.2371, 0.196], rocksA: [0.2155, 0.1901, 0.107], rocksB: [0.1648, 0.1158, 0.046], mud: [0.0897, 0.0702, 0.0458],
  leaves: [0.2264, 0.1177, 0.0461], cliff: [0.3136, 0.1726, 0.11], rocksG: [0.2521, 0.2134, 0.1638], rockyA: [0.0807, 0.0773, 0.0122],
  rockyB: [0.0855, 0.053, 0.0176], grassRock: [0.169, 0.1211, 0.0241], forestAir: [0.1259, 0.083, 0.026], snowAir: [0.2491, 0.2483, 0.3039],
  lush: [0.0584, 0.1065, 0.0218], grass: [0.119, 0.1528, 0.0305], pebble: [0.2178, 0.2034, 0.1649], dry: [0.3005, 0.2486, 0.1239], dirt: [0.1326, 0.1085, 0.0826] };

// a field ring on a world of the caller's (cover gate's fieldRing, _cover_check.js 8): o = { col, mixAt, mixes, codeAt, coverAt,
// surface, SURFACE, set }
function field(o) {
  const B = boot(), { THREE, ctx } = B;
  B.load(path.join('src', 'viewer', 'trees.js'));
  const t = new THREE.Texture(); t.image = { width: 4, height: 4 };
  const g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  for (let c = 0; c < 12; c++) { const a = c / 12 * 2 * Math.PI, x = Math.cos(a) * 60, z = Math.sin(a) * 60, b = pos.length / 3, w = 8 + c;
    pos.push(x - w, 0, z, x + w, 0, z, x + w, 100, z, x - w, 100, z); uv.push(0, 1, 1, 1, 1, 0, 0, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('aoV', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0.6), 1));
  const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.3, side: THREE.DoubleSide });
  const cols = [{ name: 'grass_reed', kind: 'cover', place: { size: 0.01, lift: 0.29 } }];
  ctx.TREE_PACK = { collections: cols };
  const treeList = () => [{ key: 'reed1', col: cols[0], sub: { bb: [-70, 0, -70, 70, 100, 70], h: 100 } }];
  const treeBuild = () => ({ parts: [{ geo: g, mat }] });
  const MIX = Object.assign({ grassland: { species: { grass_reed: { proportion: 1, density: 0.48 } }, forest: { cover: 1 } },
    bare: { species: {}, forest: { cover: 0 } } }, o.mixes || {});
  const BIO = { mixAt: o.mixAt || (() => 'bare'), mixOf: k => MIX[k] || null, knobs: () => ({ edgeShrubIn: 1, edgeShrubOut: 3, edgeWeedOut: 6 }) };
  if (o.edgeOn === false) BIO.edgeOn = false;
  const world = { terrainH: () => 0, waterH: () => -10, island: null };
  if (o.surface) { world.surface = o.surface; world.SURFACE = o.SURFACE; }
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, 2, 0); camera.lookAt(40, 0, 10); camera.updateMatrixWorld();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const col = o.col || LIB.lush;
  const CR = ctx.COVER_RING.make(THREE, { scene: new THREE.Scene(), world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null, layer: 'grass',
    biomeAt: () => 'bare', codeAt: o.codeAt || (() => 2), okAt: () => true, coverAt: o.coverAt || (() => null), groundMeanAt: () => col.slice(), groundSetsAt: o.setsAt || null, edgeD: o.edgeD || null });
  CR.set(Object.assign({ on: true, budgetMs: 1e9, blockBudget: 1e9, grow: 0, tufts: 12, reach: 60, near: 10, blotch: 0, tier: 0 }, o.set || {}));
  for (let i = 0; i < 4; i++) CR.update();
  const c = CR.census(), pts = []; for (let i = 0; i < c.length; i += 3) pts.push([c[i + 1], c[i + 2]]);
  return { CR, pts, COVER_RING: ctx.COVER_RING, B };
}
const n = (o) => { try { return field(o).pts; } catch (e) { ok(false, 'the field plants: ' + (e && e.stack || e).toString().slice(0, 300)); return []; } };

// 1 greenOf on the library
{ const F = field({}), gO = F.COVER_RING.greenOf, S = F.CR.get(), g = k => +gO(LIB[k], S.greenLo, S.greenSpan).toFixed(3);
  const yes = ['lush', 'grass'], no = Object.keys(LIB).filter(k => !yes.includes(k));
  ok(typeof gO === 'function' && S.green === 1 && S.greenDens > 0, '1a greenOf exported, the dial on by default (green ' + S.green + ', greenDens ' + S.greenDens + ')');
  ok(yes.every(k => g(k) >= 0.5), '1b lush and grass read green', yes.map(k => k + ' ' + g(k)).join(', '));
  ok(no.every(k => g(k) === 0), '1c dry, dirt, mud, grass-rock, forest floor, rocks, leaves, beach, snow: not green', no.map(k => k + ' ' + g(k)).join(', ')); }

// 2 / 3 a bare type, green vs brown ground
const bareG = n({}), bareOff = n({ set: { green: 0 } }), bareB = n({ col: LIB.dry });
ok(bareG.length > 200, '2a a bare type on green ground grows tufts', bareG.length);
ok(bareOff.length === 0, "2b ...and none with green 0 (today's field)", bareOff.length);
ok(bareB.length === 0, '3 a bare type on brown (dry) ground: none', bareB.length);

// 4 a sparse row (the forest floor's dens 0.35) on green ground
{ const mixes = { conifer: { species: { grass_reed: { proportion: 0.4, density: 0.48 } }, forest: { cover: 1 } } };
  const on = n({ mixes, mixAt: () => 'conifer' }), off = n({ mixes, mixAt: () => 'conifer', set: { green: 0 } });
  ok(off.length > 0 && on.length > off.length * 1.6, '4 a sparse row on green ground: more tufts with the dial', off.length + ' -> ' + on.length); }

// 5 never on a runway's kill, mud, snow, or the water codes
{ const inBox = p => p[0] > 20 && p[0] < 44 && p[1] > -12 && p[1] < 12;
  const rw = n({ coverAt: (x, z) => (x > 18 && x < 46 && z > -14 && z < 14) ? { kill: 1, boost: 0, kind: null, cls: 'concrete', cut: 0, surf: 0 } : null });
  ok(rw.length > 100 && rw.filter(inBox).length === 0, '5a a runway (kill 1): bare, green round it', rw.length + ' tufts, ' + rw.filter(inBox).length + ' on the runway');
  const SURFACE = { GRASS: 0, MUD_FIRM: 11, MUD_SOFT: 12, SNOW_PACKED: 8, SNOW_POWDER: 9, SNOW_WET: 10 };
  for (const [nm, sf] of [['mud', 12], ['snow', 9]]) {
    const P = n({ surface: (x, z) => (x > 20 && x < 44 && z > -12 && z < 12) ? sf : 0, SURFACE });
    ok(P.length > 100 && P.filter(p => p[0] > 22 && p[0] < 42 && p[1] > -10 && p[1] < 10).length === 0, '5b ' + nm + ' (SURFACE ' + sf + '): bare whatever the colour', P.length + ' tufts'); }
  const W = n({ codeAt: (x) => (x > 20 && x < 44 ? 0 : 2) });   // (a lake's code 1 on DRY ground takes its land code - G2572 - so the sea's)
  ok(W.length > 100 && W.filter(p => p[0] > 22 && p[0] < 42).length === 0, '5c the sea code (0) on green-drawn ground: none', W.length + ' tufts'); }

// 6 the length on a bare type: the meadow's
{ const F = field({}), T = F.COVER_RING.FIELD_TYPES.grassland; let s = 0, k = 0;
  F.CR.root.traverse(o => { if (!o.isInstancedMesh) return; const M = o.instanceMatrix.array; for (let i = 0; i < o.count; i++) { s += Math.hypot(M[i * 16 + 4], M[i * 16 + 5], M[i * 16 + 6]); k++; } });
  ok(k > 0 && T.h === 0.3, '6 a bare type grows the meadow row (h ' + T.h + '); ' + k + ' instances, mean scale ' + (k ? (s / k).toFixed(4) : '-')); }

// 7 THE FEATHER (16 Nov; the user: "grass covers more of the transition between zones"): a meadow (x < 30) beside a bare type on
//   brown ground (x >= 30). Off: the grass stops at the class edge. feather 1: it runs into the next node (x 30-34), thins out, never
//   past it (x > 36), and never onto a runway's kill
{ const o = { col: LIB.dry, codeAt: x => (x < 30 ? 2 : 3), mixAt: cd => (cd === 2 ? 'grassland' : 'bare') };
  const off = n(o), on = n(Object.assign({}, o, { set: { feather: 1 } }));
  const band = P => P.filter(p => p[0] >= 30.5 && p[0] < 34).length, past = P => P.filter(p => p[0] > 36).length, meadow = P => P.filter(p => p[0] > 10 && p[0] < 26).length;
  ok(band(off) === 0 && past(off) === 0, '7a feather 0 (today): the grass stops at the class edge', 'past the edge ' + band(off));
  ok(band(on) > 20 && past(on) === 0 && Math.abs(meadow(on) - meadow(off)) <= meadow(off) * 0.02, '7b feather 1: it runs into the next node and no further, the meadow itself unchanged',
     band(on) + ' tufts over 30.5-34 m, ' + past(on) + ' past 36 m, meadow ' + meadow(off) + ' -> ' + meadow(on));
  const rw = n(Object.assign({}, o, { set: { feather: 1 }, coverAt: (x) => (x >= 26 && x < 30 ? { kill: 1, boost: 0, kind: null, cls: 'gravel', cut: 0, surf: 0 } : null) }));
  ok(rw.filter(p => p[0] >= 26.5 && p[0] < 29.5).length === 0, '7c ...never onto a runway (kill 1) on the edge'); }

// 8 THE INSTRUMENT: fieldAt(x, z) says what the field plants and why - the meadow wild, the bare brown type nothing, a runway killed
{ const F = field({ col: LIB.dry, codeAt: x => (x < 30 ? 2 : 3), mixAt: cd => (cd === 2 ? 'grassland' : 'bare'),
    coverAt: (x, z) => (z > 30 && z < 40 ? { kill: 1, boost: 0, kind: null, cls: 'gravel', cut: 0, surf: 0 } : null) });
  const a = F.CR.fieldAt(10, 0), b = F.CR.fieldAt(50, 0), c = F.CR.fieldAt(10, 35);
  ok(a && a.why === 'wild' && a.perM2 > 10 && a.mix === 'grassland' && b && b.why === 'no row, not green' && b.perM2 === 0 && c && c.why === 'kill' && c.perM2 === 0,
     '8 fieldAt: meadow wild, bare brown nothing, runway killed', JSON.stringify([a && [a.why, a.perM2], b && [b.why, b.perM2], c && [c.why, c.perM2]])); }

// 9 GRASS BY THE TEXTURE DRAWN (16 Nov; the user: "several ground layers might use the same texture ... rocks+grass"): a bare type on
//   brown ground, drawn as rocks+grass (x < 30), dirt (30-60) and a 50/50 blend (x >= 60). texGrass 0 (today): none; texGrass 1:
//   grass on rocks+grass, none on dirt, the blend about half
{ // (stripes 8 m wide across z, repeating every 24 m - each kind at the same distances from the eye, inside the field's reach)
  const zm = z => ((Math.round(z / 4) * 4) % 24 + 24) % 24, setsAt = (x, z) => (zm(z) < 8 ? [['grassRock', 1]] : zm(z) < 16 ? [['dirt', 1]] : [['grassRock', 0.5], ['dirt', 0.5]]);
  const o = { col: LIB.dry, setsAt }, off = n(o), on = n(Object.assign({}, o, { set: { texGrass: 1 } }));
  const inside = (p, lo) => { const m = ((p[1] % 24) + 24) % 24; return p[0] > 8 && p[0] < 45 && m > lo + 1 && m < lo + 5; };
  const A = P => P.filter(p => inside(p, 0)).length, D = P => P.filter(p => inside(p, 8)).length, H = P => P.filter(p => inside(p, 16)).length;
  ok(off.length === 0, '9a texGrass 0 (today): a bare type on brown ground grows none, whatever is drawn', off.length);
  ok(A(on) > 100 && D(on) === 0 && H(on) > A(on) * 0.25 && H(on) < A(on) * 0.75, '9b texGrass 1: grass on rocks+grass, none on dirt, a half blend about half', A(on) + ' / ' + D(on) + ' / ' + H(on)); }

// 10 THE WEEDS BAND (16 Nov, FOREST-EDGE with MOUNTAIN-VEG; the user's 25 Oct spec: weeds 6-3 m OUTSIDE a forest's edge): a meadow,
//   the forest's edge at x 40 (edgeD = x - 40, + inside). In the band (x 34-37) the wild grass is ~1.3 x denser and ~1.8 x taller;
//   away from it (x < 32) nothing moves; no edgeD, weeds 0 or BIOMES.edgeOn false (?forestedge=0): today's field exactly
{ const o = { col: LIB.lush, mixAt: () => 'grassland', edgeD: (x) => x - 40 };
  const tufts = F => { const r = []; F.CR.root.traverse(m => { if (!m.isInstancedMesh) return; const M = m.instanceMatrix.array; for (let i = 0; i < m.count; i++) r.push([M[i * 16 + 12], M[i * 16 + 14], Math.hypot(M[i * 16 + 4], M[i * 16 + 5], M[i * 16 + 6])]); }); return r; };
  const T = set => { try { return tufts(field(Object.assign({}, o, set))); } catch (e) { ok(false, '10 the field plants: ' + String(e && e.stack || e).slice(0, 300)); return []; } };
  const on = T({}), off = T({ set: { weeds: 0 } }), noEd = T({ edgeD: null }), offB = T({ edgeOn: false });
  const inB = P => P.filter(p => p[0] > 34.3 && p[0] < 36.7 && Math.abs(p[1]) < 40), away = P => P.filter(p => p[0] > 8 && p[0] < 31 && Math.abs(p[1]) < 40);
  const mh = P => P.reduce((a, p) => a + p[2], 0) / Math.max(1, P.length), key = P => P.map(p => p.map(v => v.toFixed(4)).join(',')).sort().join(';');
  const rD = inB(on).length / Math.max(1, inB(off).length), rH = mh(inB(on)) / Math.max(1e-9, mh(inB(off)));
  ok(inB(off).length > 50 && rD > 1.15 && rD < 1.45 && rH > 1.55 && rH < 2.05, '10a the weeds band: denser and taller (x weedsD 1.3, weedsH 1.8)',
     inB(off).length + ' -> ' + inB(on).length + ' tufts (x' + rD.toFixed(2) + '), mean scale x' + rH.toFixed(2));
  ok(key(away(on)) === key(away(off)), '10b away from the edge nothing moves', away(off).length + ' / ' + away(on).length);
  ok(key(noEd) === key(off) && key(offB) === key(off), "10c no edgeD, or ?forestedge=0: today's field exactly", off.length + ' / ' + noEd.length + ' / ' + offB.length);
  const F = field(o), w = F.CR.fieldAt(35.5, 0), x = F.CR.fieldAt(20, 0);
  ok(w && w.weed > 0.9 && x && x.weed === 0 && w.perM2 > x.perM2 * 1.2, '10d fieldAt reports the band (weed 1 at 4.5 m out, 0 at 20 m)', JSON.stringify([w && [w.weed, w.perM2, w.h], x && [x.weed, x.perM2, x.h]])); }

console.log(fails ? `GATE GREENGRASS: FAIL (${fails})` : 'GATE GREENGRASS: PASS');
process.exit(fails ? 1 : 0);
