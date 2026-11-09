#!/usr/bin/env node
// ============================================================================
// GATE DERELICT - the derelict WWII hangar (tools/_derelict_gen.js, DERELICT-HANGAR 9 Nov 2026), headless.
// ============================================================================
// What it holds (futureDesigns/DERELICT-HANGAR-2026-11-09.md):
//   1 THE ENVELOPE IS THE REAL HANGAR'S (the user's measurements off the map, 9 Nov via A0): a 44 m hall 60 m deep, a
//     one-storey office gallery outside its right wall (6 m: 50 m overall), the works' EAVE, ridge and door head; every
//     stage's geometry stands inside that footprint and under the ridge (a hanging sheet or a gutter may lean out a
//     little: 3 m round, 1.5 m over). Stage 3 (restored) is this generator's own - every sheet on, every pane glazed, the
//     door's leaves (NL front + 4 back); `legacy: 1` still builds the old works shell (the A/B, at the works' own size).
//   9 THE DC-3 PASSES THE DOOR (the user via A0: "The game is designed for everything from a Cub to a DC-3"): the CLEAR
//     width (the restored leaves open and stacked at the jambs; the bare opening when there are no leaves) and the head
//     take a DC-3 (span 28.96 m, fin 5.16 m tail-down) taxiing in on the door's centre line with 1 m a wingtip and 0.5 m
//     over the fin, read off the built leaves themselves, not the dims' arithmetic.
//   2 EVERY STAGE x LOD BUILDS, finite, with a positive count in every bag the stage names, and inside THE BUDGET
//     (lod 0 <= 135k tris / 16 draws, lod 1 <= 14.5k / 10, lod 2 <= 5k / 6; the apron off, as in game - the real
//     hangar is 1.9x the old 40 x 40 box's floor: 95k / 12k / 4.5k before).
//   3 DETERMINISM: two builds of the same dials are the same bytes (a hash over every bag).
//   4 PLACE-KEYED RANDOMNESS: a dressing dial (graffiti, litter, weeds, barriers) moves nothing in the steel or the
//     sheets; the stages are one building: stage 1 keeps every sheet stage 0 did not lose to the weather or the
//     loose-sheet clearance (gone(1) >= gone(0), the same slot count), no shards, no bent or hung sheets; stage 2 has
//     no puddles and a new roof; failed members come back in grey primer (replaced > 0).
//   5 THE TRUSS IS STAMPED: the prototype is appended onto every sound frame (frames >= 1, z listed).
//   6 THE LODS ARE CONSTRUCTIONS: lod 1 has no corrugation (a sheet is 2 tris), no shards, weeds or stains.
//   7 THE CATALOGUE ENTRY: one building, the house frame, its door hook at +z.
//   8 NO MATERIAL SITE in the generator (GATE ASSETS AS4a: MATLIB makes them).
// --selftest breaks 1, 2, 3, 4 and 9 in turn and requires each to go red.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const TOOLS = __dirname;
const SELF = process.argv.includes('--selftest');
const BUDGET = [{ tris: 135000, draws: 16 }, { tris: 14500, draws: 10 }, { tris: 5000, draws: 6 }];
// (the fin: the game's DC-3 AS BUILT - builds/candidates/dc3_2026-10.json, playerFootOfDef h 7.0 m - not the real 5.16 m tail-down:
// the door must take the aeroplane the game has)
const DC3 = { span: 28.96, fin: 7.0, tip: 1.0, over: 0.5 };

function load() {
  const src = fs.readFileSync(path.join(TOOLS, '_house_check.js'), 'utf8');
  const mk = src.slice(src.indexOf('function makeTHREE'), src.indexOf('const win = {};'));
  const makeTHREE = vm.runInNewContext('(' + mk.replace(/^function makeTHREE/, 'function') + ')', {});
  const win = {};
  const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_hangar_gen.js', '_derelict_gen.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
  return win;
}
const hashOf = (b, keys) => { const h = crypto.createHash('sha256'); for (const k of keys) { const d = b.bags[k] && b.bags[k].data(); if (!d) continue; h.update(k); h.update(Buffer.from(Float32Array.from(d.pos).buffer)); h.update(Buffer.from(Uint32Array.from(d.idx).buffer)); } return h.digest('hex').slice(0, 16); };

function run(break_) {
  const W = load(), DG = W.DERELICT_GEN, HN = W.HANGAR_GEN;
  let checks = 0; const fails = [];
  const ok = (c, m) => { checks++; if (!c) fails.push(m); return !!c; };
  if (break_ === 'envelope') DG.DEF.HW = 18;
  const works = Object.assign({}, HN.DEF, HN.PRESETS['works hangar']);
  // 1 the envelope: the real hangar's (hall 40-45 m, 60 m deep, 50 m overall with its gallery), the works' heights
  const D0 = DG.DEF, real = { HW: D0.HW, HD: D0.HD, xO: D0.HW + D0.gallery };
  ok(2 * D0.HW >= 40 && 2 * D0.HW <= 45 && 2 * D0.HD === 60 && Math.abs(2 * D0.HW + D0.gallery - 50) <= 1 && D0.gallery >= 5 && D0.gallery <= 10 &&
     D0.EAVE === works.EAVE && D0.floorY === works.floorY, `1 DEF's envelope is the real hangar's (hall ${2 * D0.HW} x ${2 * D0.HD} m, gallery ${D0.gallery} m, ${2 * D0.HW + D0.gallery} m overall)`);
  const S = HN.shellOf(works), Dd = DG.dimsOf(DG.DEF);
  const HEAD = Math.min(7.6, D0.EAVE - 1.9);   // hangar.js's steel DOOR_H
  ok(Math.abs(Dd.DH - HEAD) < 1e-9, `1 the door head is hangar.js's steel DOOR_H (${Dd.DH} vs ${HEAD})`);
  ok(Math.abs(Dd.RIDGE - S.RIDGE) < 1e-9, `1 the ridge is the works' (${Dd.RIDGE} vs ${S.RIDGE})`);
  const B = {};
  for (let st = 0; st <= 3; st++) for (let lod = 0; lod <= 2; lod++) {
    const P = { stage: st };
    if (break_ === 'budget' && st === 0 && lod === 1) P.__noFold = 1;
    const b = DG.build(P, lod); B[st + '/' + lod] = b;
    const s = b.stats, bb = s.bbox;
    // 2 finite, budget
    let fin = true;
    for (const k of b.BAGS) { const d = b.bags[k] && b.bags[k].data(); if (!d) continue; for (const v of d.pos) if (!isFinite(v)) { fin = false; break; } }
    ok(fin, `2 stage ${st} lod ${lod}: every vertex finite`);
    {
      const bud = BUDGET[lod], tris = break_ === 'budget' && st === 0 && lod === 1 ? s.tris * 2 : s.tris;
      ok(tris <= bud.tris, `2 stage ${st} lod ${lod}: ${tris} tris <= ${bud.tris}`);
      ok(s.draws <= bud.draws, `2 stage ${st} lod ${lod}: ${s.draws} draws <= ${bud.draws}`);
      const g = 3, top = works.floorY + S.RIDGE + 1.5;
      ok(bb.x0 >= -real.HW - g && bb.x1 <= real.xO + g && bb.z0 >= -real.HD - g && bb.z1 <= real.HD + g, `1 stage ${st} lod ${lod}: inside the real footprint + ${g} m (x ${bb.x0.toFixed(2)}..${bb.x1.toFixed(2)}, z ${bb.z0.toFixed(2)}..${bb.z1.toFixed(2)})`);
      ok(bb.y1 <= top, `1 stage ${st} lod ${lod}: under the works' ridge + 1.5 m (${bb.y1.toFixed(2)} <= ${top.toFixed(2)})`);
      ok(s.stage === st && s.dims.HW === real.HW && Math.abs(s.door.h - HEAD) < 1e-9, `1 stage ${st} lod ${lod}: stats name the stage and the hangar's dims`);
    }
  }
  // 1 stage 3: the restored hangar, the derelict's own frame made whole
  const s3 = B['3/0'].stats;
  ok(s3.sheetsGone === 0 && s3.sheetsBent === 0 && s3.sheetsHung === 0 && s3.sheets > 0, `1 stage 3: every sheet on (${s3.sheets - s3.sheetsGone}/${s3.sheets}, bent ${s3.sheetsBent}, hung ${s3.sheetsHung})`);
  ok(s3.shards === 0 && s3.panes > 0 && s3.per.glass > 0 && !(s3.puddleArea > 0) && !(s3.per.water > 0), '1 stage 3: every pane glazed, no shards, no puddles');
  ok(s3.door.leaves === Dd.NL && s3.doors.length === Dd.NL + 4 && s3.door.shut, `1 stage 3: ${Dd.NL} front leaves and four back, shut by default (${s3.doors.length} leaves)`);
  const op = DG.build({ stage: 3, doorOpen: 1 }, 0);
  ok(hashOf(op, ['sheetPale']) !== hashOf(B['3/0'], ['sheetPale']) && hashOf(op, ['concWall', 'sheetNew']) === hashOf(B['3/0'], ['concWall', 'sheetNew']) && op.stats.door.open, '1 stage 3: doorOpen moves the leaves and nothing else of the building');
  for (let lod = 0; lod <= 2; lod++) {
    const a = DG.build({ stage: 3, legacy: 1, HW: works.HW, HD: works.HD }, lod), w = HN.build(works, lod);
    ok(a.stats.tris === w.stats.tris && hashOf(a, a.BAGS) === hashOf(w, w.BAGS), `1 stage 3 legacy lod ${lod} is still HANGAR_GEN 'works hangar' (the A/B)`);
  }
  // 9 THE DC-3 PASSES THE DOOR, off the built leaves: the stacks' inner edges (the front leaves, open), the head
  {
    const sp = DC3.span / 2 + DC3.tip;
    const pass = (b, what) => {
      const d = b.stats.door, front = b.stats.doors.filter(q => q.z > d.z - 2);
      let lo = d.x - d.opening / 2, hi = d.x + d.opening / 2;               // the piers' faces
      for (const q of front) { if (q.x < d.x) lo = Math.max(lo, q.x + q.w / 2); else hi = Math.min(hi, q.x - q.w / 2); }
      const clear = hi - lo;
      ok(d.x - sp >= lo - 1e-6 && d.x + sp <= hi + 1e-6, `9 ${what}: a DC-3's span (${DC3.span} m + ${DC3.tip} m a tip) passes between the stacked leaves (${clear.toFixed(2)} m clear, ${lo.toFixed(2)} .. ${hi.toFixed(2)})`);
      ok(Math.abs(clear - d.clear) < 0.05, `9 ${what}: the stats' clear width is the built one (${d.clear.toFixed(2)} vs ${clear.toFixed(2)})`);
      ok(d.h >= DC3.fin + DC3.over, `9 ${what}: the fin (${DC3.fin} m) passes under the head (${d.h.toFixed(2)} m) with ${DC3.over} m`);
      ok(d.clear >= 31, `9 ${what}: the clear width is at least 31 m (A0: "at least ~31-32 m") - ${d.clear.toFixed(2)}`);
    };
    pass(op, 'restored, open');
    pass(B['0/0'], 'derelict (no leaves)');
    if (break_ === 'door') pass(DG.build({ stage: 3, doorOpen: 1, leaves: 4 }, 0), 'restored, four leaves (the selftest\'s break)');
  }
  // 2 the bags each stage names
  const s0 = B['0/0'].stats, s1 = B['1/0'].stats, s2 = B['2/0'].stats;
  for (const k of ['steel', 'sheetPale', 'sheetDark', 'sheetWhite', 'concFloor', 'concWall', 'glass', 'water', 'decal', 'stain', 'weed', 'plastic']) ok(s0.per[k] > 0, `2 stage 0: bag ${k} has geometry`);
  ok(s1.per.steelNew > 0 && s2.per.sheetNew > 0 && s2.per.ply > 0, '2 stage 1 has grey primer, stage 2 a new roof and boards');
  // 3 determinism
  const h0 = hashOf(B['0/0'], B['0/0'].BAGS), h0b = hashOf(DG.build({ stage: 0, seed: break_ === 'determinism' ? 7 : DG.DEF.seed }, 0), B['0/0'].BAGS);
  ok(h0 === h0b, `3 two builds of stage 0 are the same bytes (${h0} vs ${h0b})`);
  // 4 place-keyed: the dressing moves nothing structural
  const core = ['steel', 'sheetPale', 'sheetDark', 'sheetWhite', 'concWall', 'glass'];
  const dressed = DG.build({ stage: 0, graffiti: 0, litter: 0, weeds: 0, barriers: 0, decay: break_ === 'place' ? 0.79 : DG.DEF.decay }, 0);
  ok(hashOf(dressed, core) === hashOf(B['0/0'], core), '4 graffiti / litter / weeds / barriers off: the steel, the sheets, the concrete and the glass are the same bytes');
  ok(s1.sheets === s0.sheets && s1.sheetsGone >= s0.sheetsGone, `4 stage 1 is stage 0 made safe: the same ${s0.sheets} sheet slots, gone ${s0.sheetsGone} -> ${s1.sheetsGone}`);
  ok(s1.shards === 0 && s1.sheetsBent === 0 && s1.sheetsHung === 0, '4 stage 1: no shards, no bent or hung sheets');
  ok(s0.shards > 0 && s0.sheetsBent > 0 && s0.sheetsHung > 0 && s0.panesMilky > 0, `4 stage 0: shards ${s0.shards}, bent ${s0.sheetsBent}, hung ${s0.sheetsHung}, milky ${s0.panesMilky}`);
  ok(s0.puddleArea > 0 && s2.puddleArea === 0 && !(s2.per.water > 0), `4 the puddles: stage 0 ${s0.puddleArea.toFixed(0)} m2, stage 2 none`);
  ok(s1.replaced > 0, `4 stage 1 replaced ${s1.replaced} failed members in grey primer`);
  ok(DG.build({ stage: 0, wet: 0 }, 0).stats.puddleArea === 0, '4 wet 0: no puddles');
  // 5 the stamped truss
  const T = s0.instances.truss;
  ok(T.frames >= 1 && T.z.length === T.frames && T.tris > 500, `5 the truss prototype (${T.tris} tris) stamped on ${T.frames} frames`);
  // 6 the lods
  const l1 = B['0/1'].stats;
  ok(!(l1.per.weed > 0) && !(l1.per.stain > 0) && !(l1.per.decal > 0) && l1.shards === 0, '6 lod 1: no weeds, stains, decals or shards');
  ok(B['0/2'].stats.tris < l1.tris && l1.tris < s0.tris, `6 the lods shrink (${s0.tris} > ${l1.tris} > ${B['0/2'].stats.tris})`);
  // 7 the catalogue
  const C = DG.CATALOGUE;
  ok(Array.isArray(C) && C.length === 1 && C[0].gen === 'DERELICT_GEN' && C[0].frame === 'house' && C[0].hooks(C[0].P)[0].p[2] > works.HD, '7 the catalogue: one building, house frame, the door hook at +z');
  // 8 no material site
  const src = fs.readFileSync(path.join(TOOLS, '_derelict_gen.js'), 'utf8');
  ok(!/new\s+THREE\.\w*Material\b/.test(src), '8 no `new THREE.*Material` in _derelict_gen.js (MATLIB makes them)');
  return { checks, fails, s0, l1, l2: B['0/2'].stats, s1, s2 };
}

if (SELF) {
  let bad = 0;
  for (const br of ['envelope', 'budget', 'determinism', 'place', 'door']) {
    const r = run(br);
    console.log(`selftest ${br}: ${r.fails.length ? 'red (' + r.fails.length + ')' : 'GREEN - the break went unseen'}`);
    if (!r.fails.length) bad++;
  }
  console.log('DERELICT: selftest, ' + (5 - bad) + '/5 breaks seen');
  console.log('GATE DERELICT: ' + (bad ? 'FAIL' : 'PASS'));
  process.exit(bad ? 1 : 0);
}
const r = run(null);
console.log(`DERELICT: stage 0 lod 0 ${r.s0.tris} tris ${r.s0.draws} draws | lod 1 ${r.l1.tris} / ${r.l1.draws} | lod 2 ${r.l2.tris} / ${r.l2.draws} | stage 1 ${r.s1.tris} / ${r.s1.draws} | stage 2 ${r.s2.tris} / ${r.s2.draws}`);
console.log(`DERELICT: sheets ${r.s0.sheets - r.s0.sheetsGone}/${r.s0.sheets} (bent ${r.s0.sheetsBent}, hung ${r.s0.sheetsHung}), panes ${r.s0.panes} (milky ${r.s0.panesMilky}, shards ${r.s0.shards}), weeds ${r.s0.weeds}, puddles ${r.s0.puddleArea.toFixed(0)} m2, truss stamped on ${r.s0.instances.truss.frames} frames`);
for (const f of r.fails) console.log('  FAIL ' + f);
console.log(`DERELICT: ${r.checks - r.fails.length}/${r.checks} checks`);
console.log(`GATE DERELICT: ${r.fails.length ? 'FAIL' : 'PASS'}`);
process.exit(r.fails.length ? 1 : 0);
