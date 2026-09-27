#!/usr/bin/env node
// GATE TOWNKIT - the town kit's verdict (G850, QUEUE-C C3a, ARCH-2026-09-27 §4.4 steps 1-2).
//
//   node tools/_townkit_check.js            -> "GATE TOWNKIT: PASS|FAIL"
//   node tools/_townkit_check.js --selftest -> negative verification (every rule doctored red)
//
// WHAT IT HOLDS (tools/town_kit.js makes it; nothing in the game reads it yet - C3b is the renderer):
//   A THE SET       20-40 house archetypes, every split of the sowing (land, water, storefront) represented, every
//                   archetype a house the sampler actually drew (a medoid, never an average), the outbuildings' three.
//   B GATE HOUSE    every archetype, as the kit builds it, passes GATE HOUSE's own battery (tools/_house_check.js
//                   battery(): the clean geometry, the wall under its roof, the stance on its site, the honest
//                   openings, lod 0 / lod 1 the same house - the ratio and the silhouette), and the pack's lod 0 is
//                   that battery's lod 0 triangle for triangle.
//   C THE CHANNELS  every vertex carries a role that is a bag (never the smoke or the ground skirt), the shell has its
//                   siding and its roof at every LOD; the stance weight is 1 on the ground, 0 from the floor
//                   structure up and the straight line between (the stretch C3b's vertex shader will do); the floor
//                   is rigid; a house on posts, piles or a cripple wall has something that stretches; the box is
//                   inside lod 0's extent.
//   D THE PACK      encode -> decode round-trips every channel inside its quantization step, the same kit encodes to
//                   the same bytes (content-hashed), and the pack is under its budget. A committed pack
//                   (src/core/townkit_pack.json) decodes and its bytes are its hash; one older than the generator
//                   is REPORTED, not failed (a re-bake is 5 MB of git history: the user's call, not a gate's).
//   E THE TABLE     every plot the zones sowed - Metlakatla's and the village's - and every outbuilding has exactly
//                   one instance, and it FITS: re-verified here from the decoded 32 B record alone - the archetype's
//                   whole plan inside the plot, water on the water, no slab on a slope, the stretch within +-10 %,
//                   the four ground offsets the terrain's own under the record's corners (2 cm), the plane on the
//                   high corner. The table round-trips.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const TOOLS = __dirname, ROOT = path.join(TOOLS, '..');
const SELFTEST = process.argv.includes('--selftest');
const TK = require('./town_kit.js');
const HC = require('./_house_check.js');

const fail = [];
const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };
const t0 = Date.now();

// ---------------------------------------------------------------------------
// the kit, made once
// ---------------------------------------------------------------------------
const R = TK.run({});
const G = TK.loadGens(), HG = G.HG, BAGS = HG.BAGS;
const houses = R.arch.filter(a => a.split !== 'out'), outs = R.arch.filter(a => a.split === 'out');
console.log('  sown ' + R.S.houses.length + ' plots + ' + R.S.outs.length + ' outbuildings; ' + R.arch.length + ' archetypes; pack ' +
  (R.pack.gz.length / 1048576).toFixed(2) + ' MB gz; table ' + R.inst.count + ' x ' + TK.INST + ' B  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');

// ---------------------------------------------------------------------------
// A THE SET
// ---------------------------------------------------------------------------
function ruleSet(arch, S) {
  const f = [];
  const H = arch.filter(a => a.split !== 'out');
  if (H.length < 20 || H.length > 40) f.push('A the house archetypes are ' + H.length + ', want 20-40 (ARCH §4.2)');
  const splits = new Set(S.houses.map(s => TK.splitOf(TK.feat(s.P))));
  for (const k of splits) if (!H.some(a => a.split === k)) f.push('A the split ' + k + ' has no archetype');
  for (const a of H) if (S.houses.indexOf(a.src) < 0) f.push('A archetype ' + a.id + ' is not a sampled house');
  for (const k of new Set(S.outs.map(o => o.kind))) if (!arch.some(a => a.split === 'out' && a.kind === k)) f.push('A the outbuilding ' + k + ' has no archetype');
  const served = H.reduce((n, a) => n + a.members.length, 0);
  if (served !== S.houses.length) f.push('A the clusters hold ' + served + ' of ' + S.houses.length + ' sampled houses');
  return f;
}
for (const m of ruleSet(R.arch, R.S)) check(false, m);

// ---------------------------------------------------------------------------
// B GATE HOUSE's battery, on the archetype as the kit builds it (the library's numbers on its context too: the
// ridge cap is drawn only on a metal roof, and the kit builds with it)
// ---------------------------------------------------------------------------
{
  const had = HC.VMCTX.HOUSE_TEX_SETS;
  if (G.LIB) HC.VMCTX.HOUSE_TEX_SETS = G.LIB;
  const n0 = HC.fail.length;
  for (const a of R.arch) {
    const row = HC.battery('townkit #' + a.id + ' (' + a.name + ')', a.P);
    check(row.hi === a.tris[0], 'B archetype ' + a.id + ': the pack\'s lod 0 is not the battery\'s', a.tris[0] + ' vs ' + row.hi + ' tris');
    check(row.lo === a.tris[1], 'B archetype ' + a.id + ': the pack\'s lod 1 is not the battery\'s', a.tris[1] + ' vs ' + row.lo + ' tris');
  }
  for (const m of HC.fail.slice(n0)) check(false, 'B GATE HOUSE: ' + m);
  HC.fail.length = n0;
  if (had === undefined) delete HC.VMCTX.HOUSE_TEX_SETS; else HC.VMCTX.HOUSE_TEX_SETS = had;
}

// ---------------------------------------------------------------------------
// C THE CHANNELS
// ---------------------------------------------------------------------------
const need = ['siding', 'roof'].map(k => BAGS.indexOf(k));
const floorRole = BAGS.indexOf('floor');
function ruleChannels(a) {
  const f = [], yS = a.yS;
  let stretching = 0;
  a.lods.forEach((L, l) => {
    const n = L.role.length, roles = new Set();
    let badRole = 0, badS = 0, floorS = 0;
    for (let i = 0; i < n; i++) {
      const r = L.role[i]; roles.add(r);
      if (!(r >= 0 && r < BAGS.length)) badRole++;
      const y = L.pos[i * 3 + 1], s = L.stance[i];
      const want = l === 2 ? (y <= 0 ? 1 : 0) : (y < yS ? Math.min(1, Math.max(0, 1 - y / yS)) : 0);
      if (!(Math.abs(s - want) < 1e-6)) badS++;
      if (r === floorRole && s > 0) floorS++;
      if (s > 0) stretching++;
    }
    if (badRole) f.push('C archetype ' + a.id + ' lod ' + l + ': ' + badRole + ' vertices with no bag for a role');
    for (const k of need) if (!roles.has(k)) f.push('C archetype ' + a.id + ' lod ' + l + ': no ' + BAGS[k] + ' in the shell');
    if (badS) f.push('C archetype ' + a.id + ' lod ' + l + ': ' + badS + ' vertices off the stance line');
    if (floorS) f.push('C archetype ' + a.id + ' lod ' + l + ': the floor stretches (' + floorS + ' vertices)');
  });
  if (Math.round(a.P.stance) >= 1 && !stretching) f.push('C archetype ' + a.id + ': a ' + a.klass.stance + ' stance with nothing that stretches');
  const b0 = a.bbox, B = a.lods[2];
  for (let i = 0; i < B.role.length; i++) {
    const x = B.pos[i * 3], y = B.pos[i * 3 + 1], z = B.pos[i * 3 + 2];
    if (x < b0[0] - 0.35 || x > b0[3] + 0.35 || z < b0[2] - 0.35 || z > b0[5] + 0.35 || y > b0[4] + 1e-6) { f.push('C archetype ' + a.id + ': the box leaves lod 0\'s extent'); break; }
  }
  return f;
}
for (const a of R.arch) for (const m of ruleChannels(a)) check(false, m);

// ---------------------------------------------------------------------------
// D THE PACK
// ---------------------------------------------------------------------------
const PACK_BUDGET_MB = 10;             // ARCH §1.3: ~7 MB gz for 30; this kit measured 4.5 for 33
function rulePack(arch, pack) {
  const f = [];
  let D;
  try { D = TK.decodePack(pack.gz); } catch (e) { return ['D the pack does not decode: ' + e.message]; }
  if (D.arch.length !== arch.length) f.push('D the pack holds ' + D.arch.length + ' of ' + arch.length + ' archetypes');
  if (JSON.stringify(D.header.bags) !== JSON.stringify(BAGS)) f.push('D the pack\'s role table is not HOUSE_GEN.BAGS');
  arch.forEach((a, ai) => {
    const d = D.arch[ai]; if (!d) return;
    if (d.id !== a.id) f.push('D archetype ' + a.id + ' decodes as ' + d.id);
    a.lods.forEach((L, l) => {
      const M = d.lods[l], meta = d.lods[l] && D.header.archetypes[ai].lods[l];
      if (!M || M.role.length !== L.role.length || M.idx.length !== L.idx.length) { f.push('D archetype ' + a.id + ' lod ' + l + ': the counts do not round-trip'); return; }
      const ps = [0, 1, 2].map(k => (meta.pos.max[k] - meta.pos.min[k]) / 65535 * 0.5 + 1e-4);
      const us = [0, 1].map(k => (meta.uv.max[k] - meta.uv.min[k]) / 65535 * 0.5 + 1e-4);
      let bad = { pos: 0, uv: 0, nrm: 0, ao: 0, role: 0, stance: 0, lit: 0, win: 0, idx: 0 };
      for (let i = 0; i < L.role.length; i++) {
        for (let k = 0; k < 3; k++) if (!(Math.abs(M.pos[i * 3 + k] - L.pos[i * 3 + k]) <= ps[k])) { bad.pos++; break; }
        for (let k = 0; k < 2; k++) if (!(Math.abs(M.uv[i * 2 + k] - L.uv[i * 2 + k]) <= us[k])) { bad.uv++; break; }
        const dot = M.nrm[i * 3] * L.nrm[i * 3] + M.nrm[i * 3 + 1] * L.nrm[i * 3 + 1] + M.nrm[i * 3 + 2] * L.nrm[i * 3 + 2];
        if (!(dot > 0.995)) bad.nrm++;
        if (!(Math.abs(M.ao[i] - L.ao[i]) <= 0.5 / 255 + 1e-6)) bad.ao++;
        if (M.role[i] !== L.role[i]) bad.role++;
        if (!(Math.abs(M.stance[i] - L.stance[i]) <= 0.5 / 255 + 1e-6)) bad.stance++;
        if (M.lit[i] !== L.lit[i]) bad.lit++;
        const wr = BAGS[L.role[i]] === 'glass' || BAGS[L.role[i]] === 'pane';
        if (wr) for (let k = 0; k < 2; k++) if (!(Math.abs(M.win[i * 3 + k] - Math.min(5.1, L.win[i * 3 + k])) <= 0.0101)) { bad.win++; break; }
      }
      for (let i = 0; i < L.idx.length; i++) if (M.idx[i] !== L.idx[i]) { bad.idx++; }
      for (const k in bad) if (bad[k]) f.push('D archetype ' + a.id + ' lod ' + l + ': ' + bad[k] + ' ' + k + ' off after the round trip');
    });
  });
  return f;
}
for (const m of rulePack(R.arch, R.pack)) check(false, m);
{
  const again = TK.encodePack(R.arch, R.finishSets, { sown: { houses: R.S.houses.length, outbuildings: R.S.outs.length }, k: 30 });
  check(again.hash === R.pack.hash, 'D the same kit does not encode to the same bytes', again.hash.slice(0, 12) + ' vs ' + R.pack.hash.slice(0, 12));
  check(R.pack.hash === crypto.createHash('sha256').update(R.pack.gz).digest('hex'), 'D the pack is not its hash');
  check(R.pack.gz.length <= PACK_BUDGET_MB * 1048576, 'D the pack is over its budget', (R.pack.gz.length / 1048576).toFixed(2) + ' MB gz, budget ' + PACK_BUDGET_MB);
  // the committed pack, when there is one (tools/town_kit.js --media)
  if (fs.existsSync(TK.MANIFEST)) {
    const M = JSON.parse(fs.readFileSync(TK.MANIFEST, 'utf8'));
    const f = path.join(ROOT, M.pack.src);
    if (check(fs.existsSync(f), 'D the manifest names a pack that is not on disk', M.pack.src)) {
      const b = fs.readFileSync(f);
      check(crypto.createHash('sha256').update(b).digest('hex') === M.pack.sha256, 'D the committed pack is not its manifest\'s hash');
      let ok = true; try { ok = TK.decodePack(b).arch.length === M.pack.archetypes; } catch (e) { ok = false; }
      check(ok, 'D the committed pack does not decode to its manifest\'s archetypes');
      if (M.pack.sha256 !== R.pack.hash) console.log('  NOTE the committed pack ' + M.pack.sha256.slice(0, 12) + ' is older than the generator (' + R.pack.hash.slice(0, 12) + '): re-bake with tools/town_kit.js --media when the kit is next shipped');
    }
  }
}

// ---------------------------------------------------------------------------
// E THE TABLE, re-verified from the decoded records alone
// ---------------------------------------------------------------------------
function ruleTable(rows, instBuf, S, arch) {
  const f = [];
  const ok = rows.filter(r => r.a);
  let I;
  try { I = TK.decodeInstances(instBuf); } catch (e) { return ['E the table does not decode: ' + e.message]; }
  if (I.length !== ok.length) f.push('E the table decodes ' + I.length + ' of ' + ok.length + ' rows');
  // coverage: every plot one house, every outbuilding one
  const mains = new Map(), outsN = new Map();
  ok.forEach(r => { const m = (r.flags & 1) ? outsN : mains; m.set(r.s.plot.id, (m.get(r.s.plot.id) || 0) + 1); });
  for (const s of S.houses) {
    const n = mains.get(s.plot.id) || 0;
    if (n !== 1) f.push('E the ' + s.town + ' plot ' + s.plot.id + ' has ' + n + ' house instances');
  }
  for (const o of S.outs) if ((outsN.get(o.plot.id) || 0) !== 1) f.push('E the outbuilding on ' + o.plot.id + ' has ' + (outsN.get(o.plot.id) || 0) + ' instances');
  const PG = G.PG, byId = new Map(arch.map(a => [a.id, a]));
  ok.forEach((r, i) => {
    const d = I[i]; if (!d) return;
    const a = byId.get(d.arch), tag = (r.flags & 1 ? 'outbuilding on ' : 'plot ') + r.s.plot.id;
    if (!a) { f.push('E ' + tag + ': archetype ' + d.arch + ' is not in the kit'); return; }
    if (Math.abs(d.x - r.x) > 1e-3 || Math.abs(d.z - r.z) > 1e-3 || Math.abs(d.y - r.y) > 1e-3) f.push('E ' + tag + ': the position does not round-trip');
    if (!(Math.abs(d.scale - 1) <= 0.1 + 1e-9)) f.push('E ' + tag + ': stretched ' + d.scale.toFixed(3) + ', the kit holds +-10 %');
    // the whole plan inside the plot, from the record: yaw, mirror, stretch
    const cy = Math.cos(d.yaw), sy = Math.sin(d.yaw), sx = d.scale * (d.mirror ? -1 : 1), b = a.bbox;
    const toW = (lx, lz) => [d.x + lx * cy + lz * sy, d.z - lx * sy + lz * cy];
    let out = 0;
    for (const lx of [b[0] * sx, b[3] * sx]) for (const lz of [b[2], b[5]]) { const p = toW(lx, lz); if (!PG.inPoly(r.s.plot.poly, p[0], p[1])) out++; }
    if (out) f.push('E ' + tag + ': archetype ' + a.id + ' leaves its plot (' + out + ' of 4 corners of its plan)');
    if (!(r.flags & 1) && !!a.P.water !== (r.s.plot.side === 'water')) f.push('E ' + tag + ': ' + (a.P.water ? 'a water house on land' : 'a land house on the water'));
    if (!(r.flags & 1) && a.split !== TK.splitOf(TK.feat(r.s.P))) f.push('E ' + tag + ': a ' + a.split + ' archetype for a ' + TK.splitOf(TK.feat(r.s.P)) + ' house');
    // the ground: the terrain under the record's own corners (the archetype's frame: the mirror swaps its ends)
    const L = a.foot.L * d.scale, w = a.foot.w;
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => { const lx = q[0] * L / 2 * (d.mirror ? -1 : 1); return toW(lx, q[1] * w / 2); });
    const gy = cs.map(p => R.S.Tv.h(p[0], p[1]));
    let off = 0; for (let k = 0; k < 4; k++) if (!(Math.abs(gy[k] - (d.y + d.ground[k])) <= 0.02)) off++;
    if (off) f.push('E ' + tag + ': ' + off + ' of 4 ground offsets are not the terrain under the corner');
    const mx = Math.max(...d.ground);
    if (!(Math.abs(mx) <= 0.011)) f.push('E ' + tag + ': the plane is not on the high corner (' + mx.toFixed(3) + ' m)');
    const rise = mx - Math.min(...d.ground);
    if (!(r.flags & 1) && Math.round(a.P.stance) === 0 && rise > 0.55) f.push('E ' + tag + ': a slab on ' + rise.toFixed(2) + ' m of fall');
    if (!(d.finish < R.finishSets.length) || R.finishSets[d.finish].roofKind !== a.roofKind) f.push('E ' + tag + ': finish set ' + d.finish + ' does not suit the archetype\'s roof');
  });
  return f;
}
const instRaw = R.inst.raw, instHead = instRaw.readUInt32LE(0), instBody = instRaw.slice(8 + instHead + ((4 - ((8 + instHead) & 3)) & 3));
for (const m of ruleTable(R.rows, instBody, R.S, R.arch)) check(false, m);
{
  const town = t => R.rows.filter(r => r.a && !(r.flags & 1) && r.s.town === t).length;
  const mk = R.S.houses.filter(s => s.town === 'metlakatla').length;
  console.log('  Metlakatla ' + town('metlakatla') + ' of ' + mk + ' plots, the village ' + town('village') + ' of ' + (R.S.houses.length - mk) + ', outbuildings ' + R.rows.filter(r => r.a && (r.flags & 1)).length + ' of ' + R.S.outs.length +
    '; nudged ' + R.rows.filter(r => r.a && r.nudge && (r.nudge[0] || r.nudge[1])).length + ', mirrored ' + R.rows.filter(r => r.a && r.mirror).length);
}

// ---------------------------------------------------------------------------
// --selftest: every rule doctored red
// ---------------------------------------------------------------------------
if (SELFTEST) {
  const st = [];
  const red = (label, list) => st.push([label, list.length > 0]);
  const clone = L => ({ pos: L.pos.slice(), nrm: L.nrm.slice(), uv: L.uv.slice(), ao: L.ao.slice(), role: L.role.slice(), stance: L.stance.slice(), lit: L.lit.slice(), win: L.win.slice(), idx: L.idx.slice() });
  const a0 = R.arch[0];
  // A: a kit of five
  red('A a kit of five', ruleSet(R.arch.slice(0, 5), R.S));
  // C: a vertex with no bag; the floor on the stretch; a post that does not stretch
  { const a = Object.assign({}, a0, { lods: a0.lods.map(clone) }); a.lods[0].role[3] = 250; red('C a role that is no bag', ruleChannels(a)); }
  { const a = Object.assign({}, a0, { lods: a0.lods.map(clone) }); const i = a.lods[1].role.indexOf(floorRole); a.lods[1].stance[i] = 0.5; red('C the floor on the stretch', ruleChannels(a)); }
  { const a = Object.assign({}, a0, { lods: a0.lods.map(clone) }); const i = a.lods[0].stance.findIndex(s => s > 0.5); a.lods[0].stance[i] = 0; red('C a post that does not stretch', ruleChannels(a)); }
  // D: one vertex flipped in the pack
  {
    const raw = zlib.gunzipSync(R.pack.gz), hl = raw.readUInt32LE(8), base = 12 + hl + ((4 - ((12 + hl) & 3)) & 3);
    const H = JSON.parse(raw.slice(12, 12 + hl).toString('utf8')), vb = H.archetypes[0].lods[0].vb;
    raw[base + vb[0] + 16 * 7 + 1] ^= 0x40;                                  // vertex 7's x, high byte
    red('D a vertex moved in the pack', rulePack(R.arch, { gz: zlib.gzipSync(raw) }));
    const raw2 = Buffer.from(zlib.gunzipSync(R.pack.gz)); raw2[base + vb[0] + 16 * 9 + 13] = 1;   // vertex 9's role
    red('D a role changed in the pack', rulePack(R.arch, { gz: zlib.gzipSync(raw2) }));
  }
  // E: a plot with no house; a house moved off its plot; a slab onto a steep plot; a water house on land
  {
    const rows = R.rows.slice(1);
    red('E a plot with no house', ruleTable(rows, TK.encodeInstances(rows).buf, R.S, R.arch));
    const moved = R.rows.map((r, i) => (i === 3 ? Object.assign({}, r, { x: r.x + 12 }) : r));
    red('E a house off its plot', ruleTable(moved, TK.encodeInstances(moved).buf, R.S, R.arch));
    const slab = R.arch.find(a => Math.round(a.P.stance) === 0 && a.split !== 'out') || Object.assign({}, R.arch[0], { P: Object.assign({}, R.arch[0].P, { stance: 0 }) });
    const steepI = R.rows.findIndex(r => r.a && !(r.flags & 1) && r.s.plot.side === 'land' && Math.max(...r.ground) - Math.min(...r.ground) > 0.8);
    const archS = R.arch.map(a => (a === R.rows[steepI].a ? Object.assign({}, a, { P: Object.assign({}, a.P, { stance: 0 }) }) : a));
    red('E a slab on a slope', ruleTable(R.rows, instBody, R.S, archS));
    void slab;
    const landI = R.rows.findIndex(r => r.a && !(r.flags & 1) && r.s.plot.side === 'land');
    const wat = R.arch.find(a => a.P.water);
    const wrong = R.rows.map((r, i) => (i === landI ? Object.assign({}, r, { a: wat }) : r));
    red('E a water house on land', ruleTable(wrong, TK.encodeInstances(wrong).buf, R.S, R.arch));
    const sunk = R.rows.map((r, i) => (i === 5 ? Object.assign({}, r, { ground: r.ground.map(v => v - 0.5) }) : r));
    red('E a ground offset that is not the terrain', ruleTable(sunk, TK.encodeInstances(sunk).buf, R.S, R.arch));
  }
  // B: GATE HOUSE's own battery is negative-verified by GATE HOUSE --selftest; here, that its verdict reaches this one
  {
    const n0 = HC.fail.length;
    // rule 31: a closed skirt on a small one-storey house (SKIRT_OK)
    HC.battery('selftest: a cabin with its skirt closed', Object.assign({}, a0.P, { skirt: 2, storeys: 1, stance: 2 }));
    const n1 = HC.fail.length;
    // rule 33: a house with no chimney
    HC.battery('selftest: no chimney', Object.assign({}, a0.P, { chim: 0 }));
    st.push(['B GATE HOUSE\'s verdict reaches this gate (a closed skirt on a cabin)', n1 > n0]);
    st.push(['B GATE HOUSE\'s verdict reaches this gate (no chimney)', HC.fail.length > n1]);
    HC.fail.length = n0;
  }
  for (const [label, went] of st) { console.log('  selftest ' + (went ? 'red  ' : 'GREEN') + '  ' + label); check(went, 'selftest: ' + label + ' did not go red'); }
}

console.log('  ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
if (fail.length) {
  for (const f of fail.slice(0, 30)) console.log('  ! ' + f);
  if (fail.length > 30) console.log('  ... ' + (fail.length - 30) + ' more');
  console.log('GATE TOWNKIT: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('GATE TOWNKIT: PASS');
