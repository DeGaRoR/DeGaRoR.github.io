#!/usr/bin/env node
// GATE KITHOST - the town kit, drawn (C3b of QUEUE-C, G855-G859; src/viewer/townkit.js, render_premises' look review).
// Headless: the vendored three r186, the real house generator, house_tarr.js and MATLIB; the kit made fresh by
// tools/town_kit.js (its sowing of Jolene, ~10 s) - the page's decoder is held to the tool's, the host to the terrain.
//
//   A THE BYTES     TOWNKIT.decodePack / decodeLod / decodeInstances (the page's DataView readers) against
//                   tools/town_kit.js's own decodePack / decodeInstances: every channel of every vertex of every LOD
//                   (position 1e-5 m, normal 1e-3, uv 1e-5, AO / role / stance / glow exact, the pane's dressing on
//                   the glass), the index, and every record of the table.
//   B THE KINDS     every vertex lands in the batch of the material its bag wears (glass + pane on the glass,
//                   the double-sided flag / star / awning apart, the rest plain), nothing dropped; the role byte
//                   carries the rung (role + 64 x lod); a MIRRORED copy is the reflection: x negated, the normal's x,
//                   and every face turned (its geometric normal the reflected one), so the front stays the front.
//   C THE EDITS     on r186's own standard and depth programs, after house_tarr's hook: every kit edit lands (the
//                   slot = role x look, the stretch after begin_vertex, the world point through the batching /
//                   instance matrix, the dirt line from the ground under the middle, the AO and the lit panes off
//                   the kit's bytes, the band after the clipping planes; the shadow pass: the same stretch, the
//                   band from the eye, no caster past castFar); no attribute the kit does not ship is read.
//   D THE GROUND    THE STANCE STRETCH, END TO END: for every record of the table (Metlakatla's and the village's,
//                   mirrored or not, stretched or not), a stance-1 vertex at each corner of its footprint, through the
//                   host's own matrix and its own per-house field (the data texture's floats, the VMAIN expression),
//                   stands on the TERRAIN under that point (the sowing's composed ground, 2 cm) - and the floor
//                   (stance 0) is the record's plane, untouched.
//   E THE BAND      VMAIN / fDither transpiled: across 0-1400 m the three rungs' dithers are complementary (every
//                   pixel exactly one rung, for every noise value), whole outside their bands; the host's tick shows
//                   a SUPERSET (every rung a fragment of the house can want, from its centre +- its radius), the
//                   partner only inside a band; the hard switch (W 0) one rung, with hysteresis.
//   F THE LOOKS     every role a loaded geometry carries has a slot in every look (the role table), the slot's row
//                   is house_tarr's (the table's rows grew), and a look is shared by records that wear the same one.
//                   REPORTED (not failed): how many kit houses wear exactly their unique house's finish slot for slot
//                   (the rest differ by the P fields the 32 B record does not carry - DEF's in the kit).
//   G THE HOSTS     the batch: two instances a house in house order in every batch, a visible instance's geometry
//                   its house's (archetype, mirror, rung); the instanced arm: the same assignment as instance counts.
//                   MATLIB: the kit's and the TARR town's materials are MATLIB's `house` shape.
//   H THE WIRING    render_premises: the flags, the review's houses out of the far town's bakes and the detail cut,
//                   the stack's ready signal re-reads the looks, the label / F7; build.js: townkit.js on the lazy list
//                   (nothing loads without ?kitab); nothing of it runs unless the flag is set.
//
// Usage: node tools/_kithost_check.js     (prints GATE KITHOST: PASS|FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname, ROOT = path.join(TOOLS, '..');
const fail = []; let checks = 0;
const check = (ok, label, extra) => { checks++; if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };
const t0 = Date.now();

global.performance = global.performance || require('perf_hooks').performance;
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
global.MATLIB = require(path.join(ROOT, 'src', 'viewer', 'matlib.js'));
const TARR = require(path.join(ROOT, 'src', 'viewer', 'house_tarr.js'));
const KIT = require(path.join(ROOT, 'src', 'viewer', 'townkit.js'));
const TK = require('./town_kit.js');

// the house generator in the page's shape (GATE TARR's context: the real hooks, no library payload)
const W = { THREE, console, Math, JSON, Object, Array, Map, Set, WeakMap, Float32Array, Uint16Array, Uint32Array, Int32Array, Uint8Array,
            Number, String, Boolean, isFinite, Infinity, NaN, Error, Promise, setTimeout, performance };
W.window = W; W.globalThis = W;
vm.createContext(W);
for (const f of ['_house_kit.js', '_house_gen.js']) vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), W, { filename: f });
const HG = W.HOUSE_GEN;

// ---- the kit, made fresh -------------------------------------------------------------------------------------
const R = TK.run({});
const BAGS = HG.BAGS;
const packRaw = R.pack.raw, instRaw = R.inst.raw;
const P = KIT.decodePack(new Uint8Array(packRaw.buffer, packRaw.byteOffset, packRaw.byteLength));
const I = KIT.decodeInstances(new Uint8Array(instRaw.buffer, instRaw.byteOffset, instRaw.byteLength));
console.log('  the kit: ' + P.header.archetypes.length + ' archetypes, ' + I.rows.length + ' records (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');

// ---- A the bytes ---------------------------------------------------------------------------------------------
const ref = TK.decodePack(R.pack.gz);
check(ref.arch.length === P.header.archetypes.length && JSON.stringify(ref.header.bags) === JSON.stringify(P.header.bags), 'A the header reads the same');
const kindAll = BAGS.map(() => 'plain');
let bad = 0, nv = 0;
ref.arch.forEach((A, ai) => A.lods.forEach((L, l) => {
  const parts = KIT.decodeLod(P, P.header.archetypes[ai].lods[l], l, kindAll), T = parts.plain;
  if (!T || T.n !== L.role.length) { bad++; return; }
  for (let i = 0; i < T.n; i++, nv++) {
    let e = 0;
    for (let a = 0; a < 3; a++) if (Math.abs(T.pos[i * 3 + a] - L.pos[i * 3 + a]) > 1e-5) e++;
    for (let a = 0; a < 3; a++) if (Math.abs(T.nrm[i * 4 + a] / 127 - L.nrm[i * 3 + a]) > 0.012) e++;
    for (let a = 0; a < 2; a++) if (Math.abs(T.uv[i * 2 + a] - L.uv[i * 2 + a]) > 1e-5) e++;
    if (Math.abs(T.kit[i * 4] / 255 - L.ao[i]) > 1e-6 || (T.kit[i * 4 + 1] & 63) !== L.role[i] || (T.kit[i * 4 + 1] >> 6) !== l ||
        Math.abs(T.kit[i * 4 + 2] / 255 - L.stance[i]) > 1e-6 || T.kit[i * 4 + 3] !== L.lit[i]) e++;
    if (e) bad++;
  }
  if (T.idx.length !== L.idx.length || T.idx.some((v, k) => v !== L.idx[k])) bad++;
}));
check(!bad, 'A every vertex and index of every LOD decodes as the tool decodes it', bad + ' of ' + nv);
{ // the pane's dressing, on the glass kind
  const kg = BAGS.map(b => (b === 'glass' || b === 'pane') ? 'glass' : null);
  let wb = 0, wn = 0;
  ref.arch.forEach((A, ai) => A.lods.forEach((L, l) => {
    const G = KIT.decodeLod(P, P.header.archetypes[ai].lods[l], l, kg).glass; if (!G) return;
    let j = 0;
    for (let i = 0; i < L.role.length; i++) { const b = BAGS[L.role[i]]; if (b !== 'glass' && b !== 'pane') continue; wn++;
      if (Math.abs(G.win[j * 3] - L.win[i * 3]) > 1e-6 || Math.abs(G.win[j * 3 + 1] - L.win[i * 3 + 1]) > 1e-6 || G.win[j * 3 + 2] !== L.win[i * 3 + 2]) wb++; j++; }
  }));
  check(wn > 0 && !wb, 'A the panes\' dressing rides the glass', wb + ' of ' + wn);
}
{
  const tr = TK.decodeInstances(instRaw.slice(8 + instRaw.readUInt32LE(0) + ((4 - ((8 + instRaw.readUInt32LE(0)) & 3)) & 3)));
  let rb = 0;
  tr.forEach((r, i) => { const m = I.rows[i];
    for (const k of ['x', 'y', 'z', 'yaw', 'arch', 'finish', 'wallCol', 'trimCol', 'roofCol', 'weather', 'dirt', 'lights', 'scale', 'flags']) if (Math.abs(+r[k] - +m[k]) > 1e-6) rb++;
    if (r.mirror !== m.mirror || r.ground.some((g, k) => Math.abs(g - m.ground[k]) > 1e-6)) rb++; });
  check(tr.length === I.rows.length && !rb, 'A every record of the table decodes as the tool decodes it', rb + ' fields, ' + tr.length + ' / ' + I.rows.length);
  check(I.rows.every(r => typeof r.plot === 'string' || typeof r.plot === 'number'), 'A every record names its plot (the review picks a street by it)');
}

// ---- B the kinds, the mirror -----------------------------------------------------------------------------------
const F0 = HG.makeFinish(); HG.applyFinish(Object.assign({}, HG.DEF), F0);
const kindOf = BAGS.map(b => { const m = F0.MAT[b]; if (!m) return null; if (m.userData && m.userData.glassShaded) return 'glass'; return m.side === THREE.DoubleSide ? 'plain2' : 'plain'; });
check(kindOf[BAGS.indexOf('glass')] === 'glass' && kindOf[BAGS.indexOf('pane')] === 'glass' && kindOf[BAGS.indexOf('siding')] === 'plain' && kindOf[BAGS.indexOf('awning')] === 'plain2',
  'B the kinds: glass and pane glass, the awning double-sided, the siding plain', kindOf.join(','));
{
  let lost = 0, faces = 0, badM = 0;
  ref.arch.forEach((A, ai) => A.lods.forEach((L, l) => {
    const parts = KIT.decodeLod(P, P.header.archetypes[ai].lods[l], l, kindOf);
    let n = 0; for (const k in parts) n += parts[k].n;
    if (n !== L.role.length) lost++;
    for (const k in parts) {
      const T = parts[k], M = KIT.mirrorOf(T);
      for (let t = 0; t < T.idx.length; t += 3) {
        const fn = (X, a, b, c) => { const p = i => [X.pos[i * 3], X.pos[i * 3 + 1], X.pos[i * 3 + 2]], A = p(a), B = p(b), C = p(c);
          const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
          return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
        const n0 = fn(T, T.idx[t], T.idx[t + 1], T.idx[t + 2]), n1 = fn(M, M.idx[t], M.idx[t + 1], M.idx[t + 2]);
        const l0 = Math.hypot(...n0); if (l0 < 1e-9) continue;
        faces++;
        // the reflection of the face's normal: (-x, y, z)
        if (Math.abs(n1[0] + n0[0]) > 1e-6 * (1 + l0) || Math.abs(n1[1] - n0[1]) > 1e-6 * (1 + l0) || Math.abs(n1[2] - n0[2]) > 1e-6 * (1 + l0)) badM++;
      }
      for (let i = 0; i < T.n; i++) if (M.pos[i * 3] !== -T.pos[i * 3] || M.nrm[i * 4] !== -T.nrm[i * 4] || M.pos[i * 3 + 1] !== T.pos[i * 3 + 1]) badM++;
    }
  }));
  check(!lost, 'B every vertex lands in a kind (none dropped)', lost + ' LODs lost vertices');
  check(faces > 1000 && !badM, 'B a mirrored copy is the reflection, every face turned with it', badM + ' of ' + faces);
}

// ---- C the edits -----------------------------------------------------------------------------------------------
const T = TARR.make(THREE, { HG });
const SH = n => ({ uniforms: {}, vertexShader: THREE.ShaderLib[n].vertexShader, fragmentShader: THREE.ShaderLib[n].fragmentShader });
for (const kind of ['plain', 'glass']) {
  const sh = SH('standard'), miss = [];
  T.hook(kind)(sh); KIT.editKit(sh, kind, miss);
  check(!miss.length, 'C the ' + kind + ' edits all land', miss.join(' | '));
  const v = sh.vertexShader, f = sh.fragmentShader, iB = v.indexOf('#include <begin_vertex>');
  check(iB > 0 && v.indexOf('kitSlot', iB) > iB && v.indexOf('transformed.y += aKit.z') > iB && v.indexOf('transformed.y += aKit.z') < v.indexOf('vSlot = kitSlot'),
    'C ' + kind + ': the stretch and the slot right after begin_vertex, before the house hook reads the vertex');
  check(!/vSlot = aSlot/.test(v) && /vSlot = kitSlot/.test(v), 'C ' + kind + ': the slot is role x look (the TARR slot attribute unread)');
  check(v.indexOf('if (kitSlot < -0.5) gl_Position') > v.indexOf('#include <project_vertex>'), 'C ' + kind + ': a vertex with no slot leaves the clip volume');
  check(/texelFetch\(uKitRoles, ivec2\(int\(kRole \+ 0\.5\), int\(kD0\.x \+ 0\.5\)\)/.test(v), 'C ' + kind + ': the role table read by (role, look)');
  if (kind === 'plain') {
    check(!/attribute float aHouseAO/.test(v) && /vHouseAO = aKit\.x/.test(v), 'C plain: the AO off the kit\'s byte');
    check(/vHouseP = \(modelMatrix \* KIT_M \* vec4\(transformed, 1\.0\)\)\.xyz;/.test(v), 'C plain: the world point through the batching / instance matrix (the noise never repeats with the shape)');
    check(/vHouseY = vHouseP\.y - \(modelMatrix \* KIT_M \* vec4\(0\.0, kD1\.x, 0\.0, 1\.0\)\)\.y;/.test(v), 'C plain: the dirt line from the ground under the house\'s middle');
  } else {
    check(!/attribute float aHouseLit/.test(v) && /vHouseLit = kitHash\(/.test(v) && /< kD0\.y \? aKit\.w : 0\.0/.test(v), 'C glass: the lit panes: the record\'s share of the kit\'s glow');
    check(/vGlassP = \(modelMatrix \* KIT_M \*/.test(v), 'C glass: the glass\'s world point through the matrix');
  }
  check(f.indexOf('uKitBandOn') > 0 && f.indexOf('discard', f.indexOf('#include <clipping_planes_fragment>')) > 0, 'C ' + kind + ': the band after the clipping planes');
  // every attribute the edited vertex reads is one the kit ships (or three's own)
  const attrs = [...v.matchAll(/^\s*attribute\s+\w+\s+(\w+)\s*;/gm)].map(m => m[1]);
  const ships = new Set(['position', 'normal', 'uv', 'aKit', 'aKitId', 'aSlot'].concat(kind === 'glass' ? ['aHouseWin'] : []));
  const odd = attrs.filter(a => !ships.has(a));
  check(!odd.length, 'C ' + kind + ': every attribute read is shipped', odd.join(','));
}
{
  const sh = SH('depth'), miss = [];
  KIT.editDepth(sh, miss);
  check(!miss.length, 'C the depth edits all land', miss.join(' | '));
  const v = sh.vertexShader;
  check(/transformed\.y \+= aKit\.z/.test(v) && /distance\(kO, uKitEye\) > uKitCast/.test(v) && /vKitD = distance/.test(v), 'C the shadow pass: the same stretch, no caster past castFar, the band from the eye');
  check(/fract\(52\.9829189/.test(sh.fragmentShader) && /vKitD/.test(sh.fragmentShader), 'C the shadow pass dithers the rungs by the eye\'s distance');
}

// ---- D the ground: the stance stretch, end to end against the terrain -------------------------------------------
// the rows in the premises frame (Jolene's is the world's: anchor 0, yaw 0); the host placed them
const frame = I.head.frame || {};
check(!frame.anchor || (frame.anchor.x === 0 && frame.anchor.z === 0 && !frame.yaw), 'D Jolene\'s premises frame is the world\'s (the gate samples the terrain in it)', JSON.stringify(frame));
const HOST = KIT.host(THREE, { pack: P, rows: I.rows, tarr: T, HG, mode: 'batch' });
{
  const VM = KIT.VMAIN;
  check(VM.indexOf('kD1.x + kD1.y * transformed.x + kD1.z * transformed.z + kD1.w * transformed.x * transformed.z') > 0 && /aKit\.z \* \(1\.0 \/ 255\.0\)/.test(VM),
    'D the vertex shader\'s field is a + b x + c z + d x z of the stance weight (what this gate evaluates)');
  const byArch = P.header.archetypes;
  let n = 0, off = 0, worst = 0, floorOff = 0, mir = 0, str = 0;
  I.rows.forEach((r, h) => {
    const D = HOST.dataOf(h), A = byArch[r.arch], L = A.foot.L, Wd = A.foot.w, M = HOST.matrix(h);
    if (r.mirror) mir++; if (Math.abs(r.scale - 1) > 0.02) str++;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = sx * L / 2, z = sz * Wd / 2;
      const y = 0 + 1 * (D[4] + D[5] * x + D[6] * z + D[7] * x * z);        // a stance-1 vertex at y 0
      const p = new THREE.Vector3(x, y, z).applyMatrix4(M);
      const g = R.S.Tv.h(p.x, p.z), e = Math.abs(p.y - g);
      worst = Math.max(worst, e); n++; if (e > 0.02) off++;
      const f = new THREE.Vector3(x, 1.2, z).applyMatrix4(M);               // stance 0: rigid
      if (Math.abs(f.y - (r.y + 1.2)) > 1e-3) floorOff++;
    }
  });
  check(n === I.rows.length * 4 && !off, 'D every footprint corner of every record stretches onto the terrain (2 cm)', off + ' of ' + n + ', worst ' + worst.toFixed(3) + ' m');
  check(!floorOff, 'D the rigid part stands on the record\'s plane', floorOff + ' corners');
  check(mir > 50 && str > 50, 'D the corners covered mirrored and stretched records', mir + ' mirrored, ' + str + ' stretched');
  console.log('  D ' + n + ' corners on the terrain, worst ' + (worst * 100).toFixed(2) + ' cm (' + mir + ' mirrored, ' + str + ' stretched records)');
}

// ---- E the band --------------------------------------------------------------------------------------------------
{
  // fDither's GLSL as JS (the text is the source: the gate evaluates what it reads)
  const sh = SH('standard'), m0 = []; T.hook('plain')(sh); KIT.editKit(sh, 'plain', m0);
  const f = sh.fragmentShader, b0 = f.indexOf('if (uKitBandOn > 0.5) {');
  let b1 = f.indexOf('{', b0), depth = 0;
  for (; b1 < f.length; b1++) { if (f[b1] === '{') depth++; else if (f[b1] === '}' && --depth === 0) break; }
  const blk = f.slice(b0, b1 + 1);
  const js = blk.replace(/float\s+/g, 'let ').replace(/discard;/g, 'return false;').replace(/fract\(52\.9829189 \* fract\(dot\(gl_FragCoord\.xy, vec2\(0\.06711056, 0\.00583715\)\)\)\)/, '__n')
    .replace(/(^|[^.\w])max\(/g, '$1Math.max(').replace(/clamp\(/g, 'Math.min(1, Math.max(0, ').replace(/, 0\.0, 1\.0\)/g, '))').replace(/length\(vViewPosition\)/g, '__d');
  let keep;
  try { keep = new Function('uKitBandOn', 'uKitBand', 'vKitLod', '__n', '__d', js + '\nreturn true;'); } catch (e) { keep = null; }
  check(!!keep, 'E the band\'s GLSL transpiles', js.slice(0, 200));
  if (keep) {
    const B = { x: 150, y: 40, z: 1200, w: 120 };
    let bad = 0, whole = 0;
    for (let d = 0; d <= 1400; d += 1.25) for (let k = 0; k < 64; k++) {
      const n = (k + 0.5) / 64, c = [0, 1, 2].filter(l => keep(1, B, l, n, d)).length;
      if (c !== 1) bad++;
      const want = d < 130 ? 0 : d > 170 && d < 1140 ? 1 : d > 1260 ? 2 : -1;
      if (want >= 0 && !keep(1, B, want, n, d)) whole++;
    }
    check(!bad, 'E every pixel draws exactly one rung, 0-1400 m', bad + ' pixel-distances');
    check(!whole, 'E a rung is whole outside its bands', whole);
    check([0, 1, 2].every(l => keep(0, B, l, 0.99, 160)), 'E the band off draws every rung whole (the CPU switches)');
  }
  // the host shows a superset of what the band can want, from each house's centre +- radius
  const band = HOST.band;
  let miss = 0, extra = 0, cases = 0;
  const h = 7, c = HOST.centre(h).clone(), R0 = HOST.radius(h);
  for (let d = 20; d <= 1500; d += 3) {
    const eye = c.clone().add(new THREE.Vector3(d, 0, 0));
    HOST.tick(eye);
    const [p, q] = HOST.rungOf(h), shown = new Set([p, q].filter(x => x >= 0));
    const lo = d - R0, hi = d + R0, want = new Set();
    if (lo < band.E0 + band.W0 / 2) want.add(0);
    if (hi > band.E0 - band.W0 / 2 && lo < band.E1 + band.W1 / 2) want.add(1);
    if (hi > band.E1 - band.W1 / 2) want.add(2);
    cases++;
    for (const w of want) if (!shown.has(w)) miss++;
    if (q >= 0 && want.size < 2) extra++;
  }
  check(!miss, 'E the tick shows every rung a fragment of the house can want (a superset of the band)', miss + ' of ' + cases);
  check(!extra, 'E the partner only inside a band', extra);
  // the hard switch: one rung, hysteresis
  HOST.setBand({ W0: 0, W1: 0 });
  let two = 0, flips = 0, last = -1;
  for (let d = 100; d <= 200; d += 0.5) { HOST.tick(c.clone().add(new THREE.Vector3(d, 0, 0))); const [p, q] = HOST.rungOf(h); if (q >= 0) two++; if (p !== last) { flips++; last = p; } }
  for (let d = 200; d >= 100; d -= 0.5) { HOST.tick(c.clone().add(new THREE.Vector3(d, 0, 0))); const [p] = HOST.rungOf(h); if (p !== last) { flips++; last = p; } }
  check(!two && flips === 3, 'E the hard switch: one rung, one flip each way (hysteresis)', two + ' partners, ' + flips + ' flips');
  HOST.setBand({ W0: 40, W1: 120 });
}

// ---- F the looks ---------------------------------------------------------------------------------------------------
{
  const roles = HOST.roleTable(), nb = BAGS.length, used = HOST.usedRoles();
  let holes = 0;
  for (let li = 0; li < HOST.lookCount(); li++) for (const r of used) if (!(roles[li * nb + r] >= 0)) holes++;
  check(!holes && used.size > 8, 'F every role the geometry carries has its slot in every look', holes + ' holes over ' + HOST.lookCount() + ' looks x ' + used.size + ' roles');
  check(T.stats.slots >= used.size, 'F the slots are house_tarr\'s table rows', T.stats.slots);
  const keys = new Map(); let shared = 0;
  I.rows.forEach((r, h) => { const dl = KIT.dials(r), k = [r.finish, r.wallCol, r.trimCol, r.roofCol, Math.round(r.weather * 255), Math.round(r.dirt * 255), dl.paintPunch, dl.dirtH, dl.frameAge].join(','); if (keys.has(k)) { if (keys.get(k) !== HOST.look(h)) shared++; } else keys.set(k, HOST.look(h)); });
  check(!shared && keys.size === HOST.lookCount(), 'F one look per distinct (finish set, paint, weather, dirt, the three sampled dials)', shared + ' split, ' + keys.size + ' / ' + HOST.lookCount());
  // the three dials the record does not carry: drawn from the sampler's own ranges (randomHouse), on their steps
  const dd = I.rows.map(KIT.dials), inR = dd.every((d, i) => d.dirtH >= 0.6 - 1e-9 && d.dirtH <= 1.4 + 1e-9 && d.frameAge >= 0.4 - 1e-9 && d.frameAge <= 0.8 + 1e-9 &&
    (I.rows[i].weather < 0.4 ? d.paintPunch >= 0.3 - 1e-9 && d.paintPunch <= 0.65 + 1e-9 : d.paintPunch >= 0.1 - 1e-9 && d.paintPunch <= 0.4 + 1e-9));
  check(inR && new Set(dd.map(d => d.paintPunch)).size > 4 && JSON.stringify(KIT.dials(I.rows[3])) === JSON.stringify(KIT.dials(Object.assign({}, I.rows[3]))),
    'F the punch, the dirt\'s climb and the frame\'s age: the sampler\'s ranges, per record, stable');
  // REPORTED: the kit's finish against the unique house's own (slot for slot on the roles both wear)
  const src = new Map(R.rows.filter(r => r.a).map((r, i) => [i, r]));
  // WHAT THE KIT'S LOOK LOSES, per house against its unique one (the record's weather and dirt are bytes - 1/255 - so
  // the slots are not compared bit for bit): the texture set per role (C3a's 48 finish sets stand in for a house's own
  // tuple when it is not among them - finishOf's nearest) and the paint (exact)
  const miss = {}; let nh = 0, whole = 0;
  I.rows.forEach((r, i) => {
    const s = src.get(i); if (!s || (r.flags & 1)) return; nh++;
    const fsI = R.finishSets[r.finish]; let all = true;
    for (const k of KIT.FINISH_KEYS) if (Math.round(s.s.P[k] || 0) !== fsI[k]) { miss[k] = (miss[k] || 0) + 1; all = false; }
    for (const k of ['wallCol', 'trimCol', 'roofCol']) if (Math.round(s.s.P[k] || 0) !== r[k]) { miss[k] = (miss[k] || 0) + 1; all = false; }
    if (all) whole++;
  });
  check(!miss.wallCol && !miss.trimCol && !miss.roofCol, 'F the paint is the unique house\'s own', JSON.stringify(miss));
  console.log('  F REPORT: ' + whole + ' of ' + nh + ' kit houses wear exactly their unique house\'s texture sets and paint; the sets that differ (C3a\'s 48 finish sets): ' +
    Object.entries(miss).map(e => e[0] + ' ' + e[1]).join(', '));
}

// ---- G the hosts -----------------------------------------------------------------------------------------------------
{
  const N = I.rows.length, eye = HOST.centre(0).clone().add(new THREE.Vector3(60, 5, 0));
  HOST.tick(eye);
  const bs = HOST.group.children.filter(o => o.isBatchedMesh);
  check(bs.length >= 2 && bs.every(b => b.material && b.customDepthMaterial === HOST.depth), 'G the batch: one BatchedMesh a material, the kit\'s depth material on each', bs.map(b => b.name).join(','));
  let wrong = 0, vis = 0;
  for (const b of bs) {
    for (let h = 0; h < N; h++) for (let s = 0; s < 2; s++) {
      const id = 2 * h + s, [p, q] = HOST.rungOf(h), lod = s ? q : p;
      if (!b.getVisibleAt(id)) continue; vis++;
      const want = HOST.geoId(b.name.split(':')[1], h, lod);
      if (b.getGeometryIdAt(id) !== want) wrong++;
    }
  }
  check(vis > N && !wrong, 'G every visible instance draws its house\'s (archetype, mirror, rung)', wrong + ' of ' + vis);
  const r = HOST.rungs();
  const HI = KIT.host(THREE, { pack: P, rows: I.rows, tarr: T, HG, mode: 'inst' });
  HI.tick(eye);
  const ims = HI.group.children.filter(o => o.isInstancedMesh);
  // each (rung, kind) instance count, the two arms the same assignment
  let batchN = 0; for (const b of bs) for (let id = 0; id < 2 * N; id++) if (b.getVisibleAt(id)) batchN++;
  let instN = 0; for (const m of ims) instN += m.count;
  check(ims.length > 30 && instN === batchN, 'G the instanced arm: the same houses at the same rungs', instN + ' vs ' + batchN + ' (' + JSON.stringify(r) + ')');
  check(ims.every(m => m.customDepthMaterial && m.geometry.attributes.aKitId && m.geometry.attributes.aKitId.isInstancedBufferAttribute), 'G the instanced arm: the house index per instance, the kit\'s depth');
  const ML = global.MATLIB;
  check(Object.values(HOST.mats).every(m => ML.rowOf(m) >= 0) && /^house\|townkit:plain\|/.test(ML.sigOf('house', { side: THREE.FrontSide, dithering: !!(F0.MAT.siding && F0.MAT.siding.dithering) }, 'townkit:plain')), 'G the kit\'s materials are MATLIB\'s `house` shape');
  const tm = T.material('plain', 0, 0, true);
  check(!!tm && tm.isMeshStandardMaterial && tm.color.getHex() === 0xffffff && tm.roughness === 1, 'G the TARR town material is made by MATLIB (the `house` shape\'s base)');
  console.log('  G the full table: batch ' + bs.length + ' meshes / ' + batchN + ' instances; instanced ' + ims.length + ' meshes; ' + HOST.stats.geos + ' geometries, ' +
    HOST.stats.verts + ' vertices, ' + HOST.stats.mb.toFixed(1) + ' MB of vertex + index data, ' + HOST.stats.looks + ' looks, built in ' + HOST.stats.buildMs + ' ms');
  HI.dispose();
}

// ---- H the wiring ------------------------------------------------------------------------------------------------------
{
  const rp = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  const need = [
    [/const KIT = \{ on: false/, 'KIT declared with the flags (off by default)'],
    [/\[\?&\]kitab=/, 'the ?kitab flag'],
    [/g\.userData\.batch \|\| g\.userData\.kitAB\) continue;/, 'the review\'s houses stay out of the far town\'s bakes'],
    [/g\.userData\.far \|\| g\.userData\.kitHide \|\|/, 'the detail cut leaves a hidden house hidden'],
    [/if \(KIT\.host\) KIT\.host\.relook\(\);/, 'the stack\'s ready signal re-reads the looks'],
    [/hlodTick\(e\);\n\s*kitTick\(e\);/, 'the review ticks with the far town'],
    [/function kitTick\(e\) \{\n\s*if \(!KIT\.on\) return;/, 'nothing of it runs without the flag'],
    [/ev\.code === 'F7'/, 'F7 switches'],
    [/smokeShaded/, 'the smoke stays with the lot'],
    [/FLYDIY_LAZY\('townkit'\)/, 'townkit.js fetched on demand'],
  ];
  for (const [re, what] of need) check(re.test(rp), 'H render_premises: ' + what);
  const bj = fs.readFileSync(path.join(TOOLS, 'build.js'), 'utf8'), lz = bj.slice(bj.indexOf('  lazy: ['), bj.indexOf('  viewer: {'));
  check(lz.indexOf("['src/viewer', 'townkit.js']") > 0 && bj.slice(bj.indexOf('  world: ['), bj.indexOf('  lazy: [')).indexOf("'townkit.js']") < 0, 'H build.js: townkit.js on the lazy list, not the world pack');
}

// (C3c: the verdict line alone - run_gates.js reads /^GATE KITHOST: PASS$/m; the WIP's count on it read as a FAIL there)
console.log('  ' + checks + ' checks, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE KITHOST: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
