#!/usr/bin/env node
// GATE LODS - every far rung is a CLOSED, ROOFED building (LODS-2026-10; the user, 27 Oct: "the LODs are not great,
// they don't even represent closed volumes ... Some houses show without roof and black").
//
//   node tools/_lods_check.js              -> "GATE LODS: PASS|FAIL"
//   node tools/_lods_check.js --selftest   -> negative verification (a roof taken off, a wall opened, a lod 1 inside out)
//
// THE ROWS, per far rung of every generated asset of the editor's catalogue (premises_ui.js sitesPalette:
// PREMISES_GEN.collect) as a site item, every house preset as a sampled plot, the outbuildings - the rungs the game draws
// since LODS-2026-10 (tools/_lods_lib.js rungsOf: R1 its own lod 1, R2 that less its generator's LOD_DETAIL roles):
//   roof    seen from straight above, >= ROOF_MIN of the near mesh's roofed plan is still roofed at roof height
//   leak    <= LEAK_MAX of the covered view (25 views) looks INTO the building (a back face nearest: an unglazed
//           opening, an open wall top, a slab's edge wound inward - what draws black or see-through behind the far
//           material's back-face culling). An open structure near (a lattice tower: its near leak) is held to its own
//           near's leak + LEAK_MAX / 3
//   hole    <= HOLE_MAX of the near mesh's covered view shows, in the rung, something more than max(1.5 m, R / 10)
//           BEHIND the near mesh's outside: the far wall's inner face through an opening, the floor of a roofless box,
//           the sky through a missing storey (a see-through hole shows front faces: `leak` alone cannot see it)
// and two of the page: the far town has no plain colour path (no gain, no map means, no box - the user: "consistently
// too dark"), and every closed-building generator declares its LOD_DETAIL roles. OPEN structures (marine, sports, the
// parks) get no closure rows. Before LODS-2026-10 it was a ratchet over 170 shipped failures (reports/evidence/LODS).
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./_lods_lib.js');

const argv = process.argv.slice(2);
const SELF = argv.includes('--selftest');
const ROOF_MIN = 0.90, LEAK_MAX = 0.03, HOLE_MAX = 0.03, GAIN_MIN = 0.5, RES = 80;

const G = L.loadGens(), W = G.win;
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));
const CAT = PG.collect(W);

// the buildings: every keyed building the island places (as a site item), the house generator's presets as plots,
// the outbuildings, and the meteo station when its generator is here (or on its branch)
function buildings() {
  // THE WHOLE CATALOGUE - what the editor's site palette lists (premises_ui.js sitesPalette: PREMISES_GEN.collect(window))
  const out = [];
  for (const [key, e] of [...CAT.entries].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const GEN = W[e.gen]; if (!GEN || !GEN.build) continue;
    out.push({ label: key, gen: e.gen, P: e.params ? e.params({}) : Object.assign({}, GEN.DEF, e.P), path: 'item' });
  }
  if (W.METEO_GEN && !CAT.entries.has('meteo/meteo station')) for (const n of Object.keys(W.METEO_GEN.PRESETS)) out.push({ label: 'meteo/' + n, gen: 'METEO_GEN', P: Object.assign({}, W.METEO_GEN.DEF, W.METEO_GEN.PRESETS[n]), path: 'item' });
  // a zone's pick may stand any house preset on a sampled plot (lod 1, banded); the outbuildings
  for (const n of Object.keys(W.HOUSE_GEN.PRESETS)) if (!W.HOUSE_GEN.PRESETS[n].mill && !W.HOUSE_GEN.PRESETS[n].station) out.push({ label: 'house/' + n + ' [plot]', gen: 'HOUSE_GEN', P: Object.assign({}, W.HOUSE_GEN.DEF, W.HOUSE_GEN.PRESETS[n]), path: 'plot' });
  for (const n of ['storage shed', 'outhouse', 'garage', 'woodshed'])
    if (W.HOUSE_GEN.PRESETS[n]) out.push({ label: 'house/' + n + ' [out]', gen: 'HOUSE_GEN', P: Object.assign({}, W.HOUSE_GEN.DEF, W.HOUSE_GEN.PRESETS[n]), path: 'out' });
  return out;
}
// one rung's rows: [id, value, ok]; nearLeak the near mesh's own (an open structure's allowance)
function rowsOf(b, rungs, near, nearLeak) {
  const out = [], leakMax = Math.max(LEAK_MAX, (nearLeak || 0) + LEAK_MAX / 3);
  rungs.forEach(([name, bags]) => {
    const m = L.measure(near, bags, { res: RES });
    const id = b.label + ' | ' + name.replace(/:.*$/, '');
    out.push([id + ' | roof', +m.roof.toFixed(3), m.roof >= ROOF_MIN]);
    out.push([id + ' | leak', +m.leak.toFixed(4), m.leak <= leakMax]);
    out.push([id + ' | hole', +m.hole.toFixed(4), m.hole <= HOLE_MAX]);
  });
  return out;
}
function pageRows() {
  const rp = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'render_premises.js'), 'utf8');
  const blk = rp.slice(rp.indexOf('  const HLOD = {'), rp.indexOf('  // THE NEAR TOWN, BAKED (G566'));
  const plain = /\bgain(Item)?: [\d.]+/.test(blk.slice(0, blk.indexOf('};'))) || /function (hlodMerge|hlodBoxes|meanOf|farGain)\(/.test(rp) || /houses:boxes/.test(rp);
  const gens = [...new Set([...CAT.entries.values()].map(e => e.gen))].filter(g => W[g] && W[g].build && !L.OPEN.has(g));
  const undeclared = gens.filter(g => !W[g].LOD_DETAIL);
  return [['page | the far town has no plain colour path (no gain, no map means, no box)', plain ? 0 : 1, !plain],
          ['page | every closed-building generator declares LOD_DETAIL', undeclared.join(',') || 'all', !undeclared.length]];
}
const open = [];
function runAll() {
  const rows = [];
  for (const b of buildings()) {
    let R;
    try { R = L.rungsOf(W[b.gen], b.P, b.path); } catch (e) { rows.push([b.label + ' | build', String(e && e.message || e).slice(0, 60), false]); continue; }
    if (L.OPEN.has(b.gen)) { open.push(b.label); continue; }   // a pier, a breakwater, a pitch: not a closed volume
    const nl = L.measure(R.near, R.near, { res: RES }).leak;
    rows.push(...rowsOf(b, R.rungs, R.near, nl));
  }
  rows.push(...pageRows());
  return rows;
}

if (SELF) {
  // a check that cannot fail is not a check: three doctored rungs must each go red
  const fail = [];
  const b = { label: 'selftest', gen: 'HOUSE_GEN', P: Object.assign({}, W.HOUSE_GEN.DEF, W.HOUSE_GEN.PRESETS['shore cabin']), path: 'plot' };
  const R = L.rungsOf(W.HOUSE_GEN, b.P, 'plot'), l1 = R.rungs[0][1];
  const ok0 = rowsOf(b, [['clean', l1]], R.near).every(r => r[2]);
  const noRoof = rowsOf(b, [['no roof', l1.filter(x => x.name !== 'roof')]], R.near).find(r => /roof$/.test(r[0]));
  // a wall opened: the siding's triangles on the front (+z) half gone, both skins - the eye sees the back wall's inside
  const front = (x, t) => (x.pos[x.idx[t] * 3 + 2] + x.pos[x.idx[t + 1] * 3 + 2] + x.pos[x.idx[t + 2] * 3 + 2]) / 3 > 0.5;
  const holed = l1.map(x => (x.name === 'siding' ? Object.assign({}, x, { idx: x.idx.filter((v, i) => !front(x, i - (i % 3))) }) : x));
  const open = rowsOf(b, [['holed', holed]], R.near).find(r => /hole$/.test(r[0]));
  // inside out: every triangle of the shell wound backwards
  const flip = l1.map(x => Object.assign({}, x, { idx: x.idx.map((v, i, a) => a[i - (i % 3) + (2 - (i % 3))]) }));
  const inside = rowsOf(b, [['flipped', flip]], R.near).find(r => /leak$/.test(r[0]));
  if (!ok0) fail.push('the clean lod 1 of the shore cabin did not pass');
  if (noRoof[2]) fail.push('a lod 1 without its roof passed the roof row (' + noRoof[1] + ')');
  if (open[2]) fail.push('a lod 1 with a third of its wall gone passed the hole row (' + open[1] + ')');
  if (inside[2]) fail.push('a lod 1 wound inside out passed the leak row (' + inside[1] + ')');
  if (!pageRows().every(r => typeof r[2] === 'boolean')) fail.push('the page rows cannot read render_premises.js');
  for (const f of fail) console.log('  ' + f);
  console.log('GATE LODS SELFTEST: ' + (fail.length ? 'FAIL' : 'PASS') + ' (roof ' + noRoof[1] + ', holed hole ' + open[1] + ', flipped leak ' + inside[1] + ')');
  process.exit(fail.length ? 1 : 0);
}

const rows = runAll();
const bad = rows.filter(r => !r[2]);
console.log('GATE LODS: ' + rows.length + ' rows over ' + new Set(rows.map(r => r[0].split(' | ')[0])).size + ' buildings; roof >= ' + ROOF_MIN + ', leak <= ' + LEAK_MAX + ' (an open near: its own + ' + (LEAK_MAX / 3).toFixed(3) + '), hole <= ' + HOLE_MAX);
if (open.length) console.log('  open structures, no closure rows: ' + open.length + ' (' + open.join(', ') + ')');
for (const r of bad) console.log('  FAIL ' + r[0] + ' = ' + r[1]);
console.log('GATE LODS: ' + (bad.length ? 'FAIL (' + bad.length + ')' : 'PASS'));
process.exit(bad.length ? 1 : 0);
