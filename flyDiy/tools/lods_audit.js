#!/usr/bin/env node
// lods_audit.js - EVERY FAR RUNG OF JOLENE, MEASURED (LODS-2026-10; tools/_lods_lib.js says what and how).
//
//   node tools/lods_audit.js [--out reports/evidence/LODS] [--kit] [--meteo tools/_meteo_gen.js]
//     -> audit.json + audit.md: per building, the path it takes to the far town (item / plot / out / kit), each rung's
//        triangles, switch distance, leak (the share of the view that looks INTO the building), roof (the share of
//        the roofed plan still roofed seen from above), silhouette IoU and open-edge metres
//   --kit   also the town kit's archetypes (tools/town_kit.js run: ~40 s) - their lod 0 / lod 1 / box and the city's
//           far shell (tools/city_cook.js shellOf / shellFaces)
//
// Which path is whose (src/viewer/premises_build.js, render_premises.js):
//   item  a site's item - every named building on the island (the clinics, the churches, the stores, the cabins, the
//         hangars, the meteo station): genItem builds lod 0 ONLY, so its far town is detailOf's keep - the keep2 (3)
//         largest PLAIN bags of the near mesh, merged plain vertex-colour, switched hard at ~150 m; then a box at 1.2 km
//   plot  a sampled plot's house: lod 0 + lod 1 (banded): the far town is lod 1 on the town shader, its detail leaving
//         at a second band; the shells stay (no box)
//   out   an outbuilding: built at lod 1 only and never given userData.lod1 - so it is an ITEM of its own lod 1
//   kit   Metlakatla on the town kit: lod 0 < 150 m < lod 1 < 1.2 km < box; the city pack's far cells: the shell
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./_lods_lib.js');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'LODS')));
const G = L.loadGens({ meteo: opt('meteo', null) }), W = G.win;
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));
const CAT = PG.collect(W);

// THE WHOLE CATALOGUE (what the editor's site palette lists: premises_ui.js sitesPalette, PREMISES_GEN.collect), each with
// how many Jolene places; the meteo station's two presets from its branch
const J = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8'));
const placedN = {}, placedP = {};
for (const st of (J.layers.sites || [])) for (const it of (st.items || [])) { placedN[it.key] = (placedN[it.key] || 0) + 1; placedP[it.key] = it.P || {}; }
const placed = new Map();
for (const [key, e] of [...CAT.entries].sort((x, y) => (x[0] < y[0] ? -1 : 1))) if (W[e.gen] && W[e.gen].build) placed.set(key, { n: placedN[key] || 0, P: placedP[key] || {} });
if (W.METEO_GEN && !CAT.entries.has('meteo/meteo station')) for (const nm of Object.keys(W.METEO_GEN.PRESETS)) placed.set('meteo/' + nm, { n: nm === 'meteo station' ? 1 : 0, P: {}, gen: 'METEO_GEN', preset: nm });

const rows = [];
const run = (label, gen, P, pk, n) => {
  const GEN = W[gen]; if (!GEN) return;
  try { const a = L.audit(GEN, P, pk); rows.push(Object.assign({ label, gen, n }, a)); }
  catch (e) { rows.push({ label, gen, n, path: pk, err: String(e && e.message || e) }); }
};
for (const [key, q] of placed) {
  if (q.gen) { run(key, q.gen, Object.assign({}, W[q.gen].DEF, W[q.gen].PRESETS[q.preset]), 'item', q.n); continue; }
  const e = CAT.entries.get(key); if (!e) continue;
  // (a generator's CATALOGUE entry carries its whole P; a derived one its params())
  run(key, e.gen, e.params ? e.params(q.P) : Object.assign({}, W[e.gen].DEF, e.P, q.P), 'item', q.n);
}
// the same houses as a sampled plot would draw them (lod 1), and the outbuildings
for (const name of Object.keys(W.HOUSE_GEN.PRESETS))
  if (!W.HOUSE_GEN.PRESETS[name].mill && !W.HOUSE_GEN.PRESETS[name].station) run('house/' + name + ' [as a plot]', 'HOUSE_GEN', Object.assign({}, W.HOUSE_GEN.DEF, W.HOUSE_GEN.PRESETS[name]), 'plot', 0);
for (const name of ['storage shed', 'outhouse', 'garage', 'woodshed'])
  if (W.HOUSE_GEN.PRESETS[name]) run('house/' + name + ' [as an outbuilding]', 'HOUSE_GEN', Object.assign({}, W.HOUSE_GEN.DEF, W.HOUSE_GEN.PRESETS[name]), 'out', 0);

// the town kit (Metlakatla): its archetypes' three rungs and the city's far shell
if (argv.includes('--kit')) {
  const TK = require('./town_kit.js'), CC = require('./city_cook.js');
  const R = TK.run({ k: 30 }), BAGS = W.HOUSE_GEN.BAGS;
  const asBags = (Lx, mats) => { const by = new Map(); for (let i = 0; i < Lx.idx.length; i += 3) { const r = Lx.role[Lx.idx[i]]; let b = by.get(r); if (!b) by.set(r, b = { name: BAGS[r], mat: mats(BAGS[r]), pos: Lx.pos, idx: [] }); b.idx.push(Lx.idx[i], Lx.idx[i + 1], Lx.idx[i + 2]); } return [...by.values()]; };
  const F = W.HOUSE_GEN.makeFinish(), mats = k => F.MAT[k] || { side: 0 };
  for (const a of R.arch.slice(0, 33)) {
    const near = asBags(a.lods[0], mats), l1 = asBags(a.lods[1], mats).filter(b => b.mat.isMeshStandardMaterial && !b.mat.transparent), box = asBags(a.lods[2], () => ({ side: 0 }));
    // the city far shell: in the archetype's frame (no yaw, no mirror), the ground at 0
    const sh = CC.shellOf(a, a.lods[1], BAGS), polys = CC.shellFaces(sh).map(([b, out, pts]) => pts.map(p => [p[0], p[1] === null ? 0 : p[1], p[2]]));
    const shell = [L.polyBag('shell', polys)];
    const n0 = L.measure(near, near), out = { label: 'kit #' + rows.filter(r => r.path === 'kit').length + ' ' + a.name, gen: 'TOWNKIT', n: a.members ? a.members.length : 0, path: 'kit', nearTris: near.reduce((t, b) => t + b.idx.length / 3, 0), R: n0.R, nearLeak: n0.leak, nearRoof: n0.roof, rungs: [] };
    for (const [name, bags, dist] of [['kit lod 1', l1, 150], ['kit box', box, 1200], ['city far shell', shell, 1000]]) {
      const m = L.measure(near, bags), oe = L.openEdges(bags);
      out.rungs.push({ name, dist, tris: m.tris, leak: m.leak, hole: m.hole, worst: m.worst, roof: m.roof, iou: m.iou, open: oe.len, openPer: oe.per, bags: bags.map(b => b.name) });
    }
    rows.push(out);
  }
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify({ rule: Object.assign({}, L.RULE, { shell: String(L.RULE.shell), box: String(L.RULE.box) }), rows }, null, 1));
const pc = x => (x * 100).toFixed(x < 0.1 ? 1 : 0) + '%';
const md = ['# LODS audit - every far rung of every generated asset of the editor\'s catalogue (tools/lods_audit.js)', '', 'n = how many Jolene places. FIX rows = the proposed ladder (its own lod 1, then less its declared detail roles; all on the real finish). Open structures (marine, sports) are listed but not closed volumes.', '',
  'leak = share of the covered view whose nearest surface is a back face (the eye looks INTO the building: black); hole = share of the near view where the rung shows something > max(1.5 m, R/10) behind the near outside (see-through, a missing roof or storey); roof = share of the near roofed plan still roofed from above; iou = silhouette against the near mesh (25 views); open = welded edges used once (m).', '',
  '| building | n | path | near tris | rung | at m | tris | leak | hole | worst view | roof | iou | open m | bags |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) {
  if (r.err) { md.push('| ' + r.label + ' | ' + r.n + ' | ' + r.path + ' | ERR ' + r.err + ' |||||||||'); continue; }
  r.rungs.forEach((g, i) => md.push('| ' + (i ? '' : r.label) + ' | ' + (i ? '' : r.n) + ' | ' + (i ? '' : r.path) + ' | ' + (i ? '' : r.nearTris) + ' | ' + g.name + ' | ' + g.dist + ' | ' + g.tris + ' | ' + pc(g.leak) + ' | ' + pc(g.hole) + ' | ' + (g.worst ? g.worst[0] + '/' + g.worst[1] + ' ' + pc(g.worst[2]) : '') + ' | ' + pc(g.roof) + ' | ' + g.iou.toFixed(2) + ' | ' + g.open.toFixed(0) + ' | ' + g.bags.join(' ') + ' |'));
}
fs.writeFileSync(path.join(OUT, 'audit.md'), md.join('\n') + '\n');
console.log('LODS AUDIT: ' + rows.length + ' buildings -> ' + path.relative(process.cwd(), OUT) + '/audit.{json,md}');
