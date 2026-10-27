#!/usr/bin/env node
// GATE LODS - every far rung is a CLOSED, ROOFED building (LODS-2026-10; the user, 27 Oct: "the LODs are not great,
// they don't even represent closed volumes ... Some houses show without roof and black").
//
//   node tools/_lods_check.js              -> "GATE LODS: PASS|FAIL" (the ratchet: a failure not in the ledger is red)
//   node tools/_lods_check.js --strict     -> every failure red, the ledger ignored (the fix's own verdict)
//   node tools/_lods_check.js --fix        -> the PROPOSED ladder (each item's own lod 1 and its shells), strict: what S2-S4 must pass
//   node tools/_lods_check.js --selftest   -> negative verification (a roof taken off, a wall opened, the gain dimmed)
//   node tools/_lods_check.js --write      -> rewrite the ledger to today's failures (ASK FIRST: it forgives them)
//
// THE ROWS, per far rung of every generated asset of the editor's catalogue (tools/_lods_lib.js: the rungs by the game's own rules -
// a site item's detailOf keep and its box, a plot's lod 1 and its shells past the detail band, an outbuilding's keep):
//   roof    seen from straight above, >= ROOF_MIN of the near mesh's roofed plan is still roofed at roof height
//   leak    <= LEAK_MAX of the covered view (25 views) looks INTO the building (a back face nearest: an unglazed
//           opening, an open wall top, a missing storey - what draws black or see-through behind the far material's
//           back-face culling)
//   hole    <= HOLE_MAX of the near mesh's covered view shows, in the rung, something more than max(1.5 m, R / 10)
//           BEHIND the near mesh's outside: the far wall's inner face through an opening, the floor of a roofless box,
//           the sky through a missing storey (a see-through hole shows front faces: `leak` alone cannot see it)
//   gain    the far town's plain colour is unity-calibrated: HLOD.gain (render_premises.js) and the city cook's farGain
//           (tools/city_cook.js LOD) >= GAIN_MIN. The sheet measured 0.2 at 0.15-0.5x the near mesh's light, 1.0 at
//           0.85-1.1x (reports/evidence/LODS/index.md)
// THE LEDGER (tools/_lods_known.json) holds the failures the game ships today, each with its number: the ratchet
// passes them and fails anything new or WORSE; a ledger row that now passes is reported (take it out: the fix holds).
// When the fix lands the ledger is empty and --strict is the gate.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./_lods_lib.js');

const argv = process.argv.slice(2);
const FIX = argv.includes('--fix'), STRICT = argv.includes('--strict') || FIX, SELF = argv.includes('--selftest'), WRITE = argv.includes('--write');
const ROOF_MIN = 0.90, LEAK_MAX = 0.03, HOLE_MAX = 0.03, GAIN_MIN = 0.5, RES = 80;
const KNOWN_F = path.join(__dirname, '_lods_known.json');

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
// one rung's rows: [id, value, ok]
function rowsOf(b, rungs, near) {
  const out = [];
  rungs.filter(r => (FIX ? r[3] === 'fix' || r[3] === 'both' : r[3] !== 'fix')).forEach(([name, bags], i) => {
    const m = L.measure(near, bags, { res: RES });
    const id = b.label + ' | ' + name.replace(/ \(.*$/, '');
    out.push([id + ' | roof', +m.roof.toFixed(3), m.roof >= ROOF_MIN, 'min']);
    out.push([id + ' | leak', +m.leak.toFixed(4), m.leak <= LEAK_MAX, 'max']);
    out.push([id + ' | hole', +m.hole.toFixed(4), m.hole <= HOLE_MAX, 'max']);
  });
  return out;
}
function gainRows() {
  const rp = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'render_premises.js'), 'utf8');
  const cc = fs.readFileSync(path.join(__dirname, 'city_cook.js'), 'utf8');
  const g = +(/const HLOD = \{[^}]*?\bgain: ([\d.]+)/.exec(rp) || [0, 0])[1], f = +(/farGain: ([\d.]+)/.exec(cc) || [0, 0])[1];
  return [['far town | HLOD.gain', g, g >= GAIN_MIN, 'min'], ['city pack | farGain', f, f >= GAIN_MIN, 'min']];
}
const open = [];
function runAll() {
  const rows = [];
  for (const b of buildings()) {
    let R;
    try { R = L.rungsOf(W[b.gen], b.P, b.path); } catch (e) { rows.push([b.label + ' | build', 0, false, 'min']); continue; }
    if (L.OPEN.has(b.gen)) { open.push(b.label); continue; }   // a pier, a breakwater, a pitch: not a closed volume
    rows.push(...rowsOf(b, R.rungs, R.near));
  }
  if (!FIX) rows.push(...gainRows());   // (the fix has no plain colour path: every far rung wears its finish)
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
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'render_premises.js'), 'utf8');
  if (!/const HLOD = \{[^}]*?\bgain: ([\d.]+)/.test(src)) fail.push('the gain row cannot read HLOD.gain');
  for (const f of fail) console.log('  ' + f);
  console.log('GATE LODS SELFTEST: ' + (fail.length ? 'FAIL' : 'PASS') + ' (roof ' + noRoof[1] + ', holed hole ' + open[1] + ', flipped leak ' + inside[1] + ')');
  process.exit(fail.length ? 1 : 0);
}

const rows = runAll();
const known = fs.existsSync(KNOWN_F) ? JSON.parse(fs.readFileSync(KNOWN_F, 'utf8')).known || {} : {};
if (WRITE) {
  const k = {}; for (const [id, v, ok] of rows) if (!ok) k[id] = v;
  fs.writeFileSync(KNOWN_F, JSON.stringify({ note: 'GATE LODS ledger (tools/_lods_check.js): the far-rung failures the game ships today, each at its number - the ratchet passes them, fails anything new or worse. LODS-2026-10 empties it.', known: k }, null, 1) + '\n');
  console.log('GATE LODS: ledger written, ' + Object.keys(k).length + ' rows');
  process.exit(0);
}
const bad = [], held = [], healed = [];
for (const [id, v, ok, dir] of rows) {
  if (ok) { if (id in known) healed.push(id); continue; }
  if (!STRICT && id in known && (dir === 'min' ? v >= known[id] - 0.01 : v <= known[id] + 0.005)) { held.push(id + ' = ' + v); continue; }
  bad.push(id + ' = ' + v + (id in known ? ' (ledger ' + known[id] + ')' : ''));
}
console.log('GATE LODS: ' + rows.length + ' rows over ' + new Set(rows.map(r => r[0].split(' | ')[0])).size + ' buildings; roof >= ' + ROOF_MIN + ', leak <= ' + LEAK_MAX + ', gain >= ' + GAIN_MIN);
if (open.length) console.log('  open structures, no closure rows: ' + open.length + ' (' + open.join(', ') + ')');
if (held.length) console.log('  ledger (shipped today, held at its number): ' + held.length + '\n    ' + held.join('\n    '));
if (healed.length) console.log('  ledger rows that pass now (take them out): ' + healed.join(', '));
for (const b of bad) console.log('  FAIL ' + b);
console.log('GATE LODS: ' + (bad.length ? 'FAIL (' + bad.length + (STRICT ? ' rows, strict' : ' new or worse') + ')' : 'PASS'));
process.exit(bad.length ? 1 : 0);
