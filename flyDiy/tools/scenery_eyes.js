// SCENERY EYES (G3015, SCENERY-SHIP): the places a perf census looks at the user's shipped edits from - FRAMECOST_EYES's
// list (tools/_framecost_check.js). Made ONCE from the shipped record and used unchanged on master and on the ship, so
// every count reads as a delta (on master the eye looks at the place before the edit).
//   node tools/scenery_eyes.js [--file tools/fixtures/island_jolene.json] [--base <master's island_jolene.json>]
//        [--harbour s4,s5,s6,s7,s8,s9,s10] [--strips w5,w6] [--road r1] [--out tools/perf/eyes_rev26.json]
// The eyes, in WORLD metres (the record's frame applied): the harbour (the centroid of the named sites), each named strip
// (its centre, along it), the road's arc-length middle (along it), and the densest 200 m cell of the user's own objects
// and sites (new or changed against --base; not within 400 m of another eye). Read only, no world loaded.
'use strict';
require('./_core_math_global.js');   // (T41b: CORE_MATH before a core file required alone - 00_registry's)
const fs = require('fs');
const path = require('path');
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = arg('--file', path.join(__dirname, 'fixtures', 'island_jolene.json')), BASE = arg('--base', null);
const HARBOUR = arg('--harbour', 's4,s5,s6,s7,s8,s9,s10').split(',').filter(Boolean);
const STRIPS = arg('--strips', 'w5,w6').split(',').filter(Boolean), ROAD = arg('--road', 'r1');
const OUT = arg('--out', path.join(__dirname, 'perf', 'eyes_rev26.json'));
const rec = PG.unwrap(fs.readFileSync(FILE, 'utf8')).rec;
const F = PG.frameOf(rec, { id: 'jolene' });
const W = (x, z) => F.toWorld(x, z).map(v => +v.toFixed(1)), H = h => +(h - F.yaw).toFixed(4);
const L = n => rec.layers[n] || [];
const eyes = [], miss = [];
// the harbour: the named sites' centroid (their `at`), facing nothing in particular (the stand finds the dry side)
{ const S = L('sites').filter(s => HARBOUR.includes(s.id) && s.at);
  if (S.length) { let x = 0, z = 0; for (const s of S) { x += +s.at.x; z += +s.at.z; } const p = W(x / S.length, z / S.length);
    eyes.push({ name: 'harbour', x: p[0], z: p[1], hdg: 0, why: S.length + ' sites: ' + S.map(s => s.id + ' ' + (s.name || '')).join(', ') }); }
  else miss.push('harbour (' + HARBOUR.join(',') + ')'); }
// the strips: the centre, along the strip
for (const id of STRIPS) { const r = L('runways').find(q => q.id === id);
  if (!r || !r.c) { miss.push(id); continue; }
  const p = W(+r.c[0], +r.c[1]); eyes.push({ name: id, x: p[0], z: p[1], hdg: H(+r.hdg || 0), why: (r.name || id) + ', ' + r.len + ' x ' + r.wid + ' m ' + (r.look || '') }); }
// the road: its drawn line's arc-length middle, along it
{ const r = L('roads').find(q => q.id === ROAD);
  if (!r || !r.pts || r.pts.length < 2) miss.push(ROAD);
  else { const P = PG.roadLine(r); let tot = 0; for (let i = 1; i < P.length; i++) tot += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    let s = 0, at = null; for (let i = 1; i < P.length && !at; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (s + d >= tot / 2) { const t = d ? (tot / 2 - s) / d : 0; at = [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t, Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0])]; } s += d; }
    const p = W(at[0], at[1]); eyes.push({ name: ROAD + '_mid', x: p[0], z: p[1], hdg: H(at[2]), why: ROAD + ' at ' + (tot / 2).toFixed(0) + ' of ' + tot.toFixed(0) + ' m' }); } }
// the user's own objects and sites (new or changed against the base): the densest 200 m cell, apart from the eyes above
{ const base = BASE ? PG.unwrap(fs.readFileSync(BASE, 'utf8')).rec : null;
  const old = n => new Map(((base && base.layers[n]) || []).map(e => [e.id, JSON.stringify(e)]));
  const mine = []; for (const [n, at] of [['objects', e => [+e.x, +e.z]], ['sites', e => e.at ? [+e.at.x, +e.at.z] : null]]) {
    const o = old(n); for (const e of L(n)) { if (base && o.get(e.id) === JSON.stringify(e)) continue; const p = at(e); if (p && isFinite(p[0]) && isFinite(p[1])) mine.push([p[0], p[1], n + ':' + e.id + (n === 'sites' ? ' (' + (e.items || []).length + ' items)' : '')]); } }
  const cells = new Map(); for (const m of mine) { const k = Math.floor(m[0] / 200) + ',' + Math.floor(m[1] / 200); (cells.get(k) || cells.set(k, []).get(k)).push(m); }
  const far = (x, z) => eyes.every(e => Math.hypot(e.x - x, e.z - z) > 400);
  let best = null; for (const M of cells.values()) { const x = M.reduce((a, m) => a + m[0], 0) / M.length, z = M.reduce((a, m) => a + m[1], 0) / M.length, p = W(x, z); if (far(p[0], p[1]) && (!best || M.length > best.M.length)) best = { M, p }; }
  if (best) eyes.push({ name: 'dense', x: best.p[0], z: best.p[1], hdg: 0, why: best.M.length + ' of the user\'s ' + mine.length + (base ? ' new or changed' : '') + ' objects/sites in one 200 m cell: ' + best.M.slice(0, 8).map(m => m[2]).join(', ') + (best.M.length > 8 ? ' ...' : '') });
  else miss.push('dense (' + mine.length + ' objects/sites' + (base ? ' new or changed' : '') + ')'); }
const doc = { what: 'FRAMECOST_EYES (tools/scenery_eyes.js): where the census looks at the user\'s edits - the same file on master and on the ship', file: path.relative(path.join(__dirname, '..'), FILE).replace(/\\/g, '/'), base: BASE ? path.basename(BASE) : null, eyes };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
for (const e of eyes) console.log('  eye ' + e.name.padEnd(10) + ' (' + e.x + ', ' + e.z + ') hdg ' + e.hdg + ' - ' + e.why);
if (miss.length) console.log('  MISSING: ' + miss.join('; '));
console.log('scenery_eyes: ' + eyes.length + ' eyes -> ' + path.relative(process.cwd(), OUT));
