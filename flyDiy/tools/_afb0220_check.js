#!/usr/bin/env node
// GATE AFB0220 - JOLENE 02/20, THE DERELICT CROSSWIND STRIP (AFB-0220, 13 Nov 2026; tools/jolene_parts/afb0220.py,
// spliced by tools/afb0220_splice.py). The user via A0: "an UNMAINTAINED, DEGRADED strip divided into several runways" -
// a narrow central band of the old concrete (the spot landing, the drag race), one side bumpy but landable (STOL), the
// other a crash playground "with REAL COLLISION and damage interaction (wingtip, gear, prop: the damage system reacts as
// it does to trees and poles)", the forest taking over; "be wary when choosing assets ... no new per-frame cost".
//
//   1 THE SPLICE: the shipped fixture and the ship manifest are the part, byte for byte (afb0220_splice.py --check)
//   2 THE RUNWAYS: w2 the 15 m band (the manifest's fieldPatch = the fixture's), the rough lane beside it - parallel,
//     its box 0.5 m+ clear of the band's (issues() refuses a stack), long enough, its bumps on; the band one straight
//     strip end to end with nothing of the part on it; issues() names neither
//   3 THE CLEARANCES: no object on the band or the lane; nothing over 0.5 m tall within 18 m of the centreline (a DC-3's
//     half span off the band's edge, 3.5 m to spare); nothing past the strip's ends but the turnaround's young trees,
//     28 m+ off the extended centreline and 5.5 m at most
//   4 THE ASSETS: every prop key is a baked prop (PROP_REG) and every heavy one (over 2 000 triangles) has its LODs;
//     every tree key is the tree pack's, of the kind its role says (a ground piece debris or rock, a snag dead, a young
//     tree a tree or a shrub); every species a vegetation names is a collection - the TREE SYSTEM only, no mesh tree
//   5 THE GROUND (the island composed in node): the lane's centreline on the band's (2 cm at its five profile points);
//     the band and the lane dry along their centrelines; every prop on dry ground; the beaver pond's lodge in the DEM's
//     own water
//   6 THE PROPS COLLIDE: every playground prop rasterised from its own triangles at 0.5 m (render_premises hitAdd's
//     shape) and registered in an OBSTACLES registry at its place: a point inside it at mid-height is pushed out, a
//     point 2 m clear of its box is not
//   7 THE GROUND PIECES COLLIDE: every fallen tree, stump, lodge and boulder as TREE_HITS.lying chains (the function the
//     game registers them with): its middle is hit, a point past its end or over its top is not
//   8 THE SOLVER MEETS THEM (the stock build, a flat world): taxied at a fallen trunk lying across its track and at a
//     boulder group (TREE_HITS, the trunk law), and at the crashed car (OBSTACLES): each contact stops it or damages it -
//     with nothing there it rolls on through
//   9 THE COST: the part's triangles at full detail and its batches (a repeated prop key is one instanced batch, G934; the
//     ground pieces one InstancedMesh per subject a 64 m cell), bounded; the planting's trees estimated; nothing that
//     ticks (every piece static: props, cells, the pavement's polygons) - the frame-time measure is FRAMECOST's, on a GPU
//
//   node tools/_afb0220_check.js        -> "GATE AFB0220: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
require('./_core_math_global.js');
const C = require(path.join(T, 'flight_core.js'));
const PG = require(path.join(ROOT, 'src', 'core', '27_premises.js'));
const { readGeo } = require('./_media_lib.js');
let bad = 0, n = 0;
const yes = (ok, what, detail) => { n++; if (!ok) bad++; console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : '')); return ok; };
const FIXTXT = fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8');
const FIX = JSON.parse(FIXTXT), L = FIX.layers;
const MAN = JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'scenery_ship_afb19.json'), 'utf8'));
const w2 = Object.assign({}, PG.RUNWAY_DEF, L.runways.find(r => r.id === 'w2')), lane = Object.assign({}, PG.RUNWAY_DEF, L.runways.find(r => r.id === 'xw_rough') || {});
const OBJ = L.objects.filter(o => /^xw_/.test(o.id)), AREAS = L.areas.filter(a => /^xw_/.test(a.id));
const E2 = PG.runwayEnds(w2), D = E2.d, N = E2.n;
const uv = (x, z) => { const dx = x - E2.end0[0], dz = z - E2.end0[1]; return [dx * D[0] + dz * D[1], dx * N[0] + dz * N[1]]; };

// ---- 1 ---------------------------------------------------------------------------------------------------------------
console.log('1. the splice');
{
  let r = null;
  for (const py of ['python3', 'python', 'py']) { const q = cp.spawnSync(py, [path.join(T, 'afb0220_splice.py'), '--check'], { encoding: 'utf8' }); if (!q.error) { r = q; break; } }
  yes(!!r && r.status === 0, 'the shipped fixture and scenery_ship_afb19.json are the part, byte for byte', r ? (r.stdout || r.stderr || '').trim().slice(0, 200) : 'no python');
}

// ---- 2 ---------------------------------------------------------------------------------------------------------------
console.log('2. the runways');
{
  const fp = (MAN.fieldPatches || {}).w2 || {};
  yes(w2.wid === 15 && fp.wid === 15 && w2.falloff === fp.falloff && w2.band === fp.band && JSON.stringify(w2.pav) === JSON.stringify(fp.pav),
    'w2 is the central band: ' + w2.wid + ' m wide, band ' + w2.band + ' m, falloff ' + w2.falloff + ' m - the manifest\'s fieldPatch is the fixture\'s');
  const lc = uv(lane.c[0], lane.c[1]), dh = Math.abs(((lane.hdg - w2.hdg) % Math.PI + Math.PI) % Math.PI);
  const gap = Math.abs(lc[1]) - lane.wid / 2 - w2.wid / 2;
  yes(lane.id === 'xw_rough' && Math.min(dh, Math.PI - dh) < 1e-6 && gap >= 0.5 && gap <= 2,
    'the rough lane runs beside it, parallel, ' + gap.toFixed(2) + ' m between their boxes, on the ' + (lc[1] < 0 ? 'east' : 'west') + ' (v ' + lc[1].toFixed(2) + ')');
  const u0 = lc[0] - lane.len / 2, u1 = lc[0] + lane.len / 2;
  yes(lane.len >= 600 && u0 > 50 && u1 < w2.len - 50, 'the lane is ' + lane.len + ' m (u ' + u0.toFixed(0) + '-' + u1.toFixed(0) + '), inside the band\'s length, its ends clear of 13/31 and the turnaround');
  yes(lane.micro && +lane.micro.chaos >= 0.4 && +lane.micro.chaos <= 0.7 && lane.surface === 6, 'its bumps are on: micro chaos ' + (lane.micro && lane.micro.chaos) + ' (w8 0.4 vetted, a rough bush strip 0.8), surface ' + lane.surface + ' (gravel\'s friction: dirt)');
  const rec = PG.expandAreas(PG.unwrap(FIXTXT).rec), I = PG.issues(rec);
  yes(!I.some(s => /\bw2\b|xw_/.test(s)), 'issues() names neither w2 nor any xw_ entry (' + I.length + ' issues on the record)', I.filter(s => /\bw2\b|xw_/.test(s)).slice(0, 3).join('; '));
  const onBand = AREAS.filter(a => a.props && a.props.terraform && a.poly.some(p => { const q = uv(p[0], p[1]); return q[0] > 0 && q[0] < w2.len && Math.abs(q[1]) < w2.wid / 2; }));
  yes(w2.len >= 1700 && !onBand.length, 'the band is one straight strip ' + w2.len + ' m long (the spot landing, the drag race): no terraform of the part on it', onBand.map(a => a.id).join(', '));
}

// ---- the registries --------------------------------------------------------------------------------------------------
const REG = { props: {}, order: [] };
{
  const sb = { registerPropPack: p => { for (const k of p.order || Object.keys(p.props)) { REG.props[k] = p.props[k]; REG.order.push(k); } }, console };
  vm.createContext(sb);
  for (const d of ['props', 'pier', 'scenery', 'camp', 'infra', 'cars', 'loads', 'totems', 'animals', 'cabin']) {
    const mf = path.join(ROOT, 'src', d, d + '_packs.json'); if (!fs.existsSync(mf)) continue;
    for (const f of JSON.parse(fs.readFileSync(mf, 'utf8'))) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', d, typeof f === 'string' ? f : f[0]), 'utf8'), sb, { filename: String(f) });
  }
}
const TP = (() => { const c = {}; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'trees_pack.js'), 'utf8') + ';this.P = TREE_PACK', c); return c.P; })();
const SUB = new Map(); for (const col of TP.collections) for (const s of col.subjects || []) SUB.set(col.name + '|' + s.name, { col, s });
const heightOf = o => o.kind === 'prop' ? (REG.props[o.key] ? REG.props[o.key].dim[1] : 99) : (SUB.has(o.key) ? SUB.get(o.key).s.h * (o.size || 1) : 99);
const groundKind = o => o.kind === 'tree' && SUB.has(o.key) && ['debris', 'rock'].includes(SUB.get(o.key).col.kind);

// ---- 3 ---------------------------------------------------------------------------------------------------------------
console.log('3. the clearances');
{
  const laneUV = uv(lane.c[0], lane.c[1]);
  const inBox = (q, cu, cv, len, wid, m) => Math.abs(q[0] - cu) < len / 2 + m && Math.abs(q[1] - cv) < wid / 2 + m;
  const onRwy = OBJ.filter(o => { const q = uv(o.x, o.z); return inBox(q, w2.len / 2, 0, w2.len, w2.wid, 1) || inBox(q, laneUV[0], laneUV[1], lane.len, lane.wid, 1); });
  yes(!onRwy.length, 'no object on the band or the lane (1 m margin): ' + OBJ.length + ' objects', onRwy.map(o => o.id).join(', '));
  const tall = OBJ.filter(o => { const q = uv(o.x, o.z); return q[0] >= 0 && q[0] <= w2.len && Math.abs(q[1]) < 18 && heightOf(o) > 0.5; });
  yes(!tall.length, 'nothing over 0.5 m tall within 18 m of the centreline (a DC-3\'s half span 14.5 m off the band\'s edge, 3.5 m to spare)', tall.map(o => o.id + ' ' + heightOf(o).toFixed(1) + ' m').join(', '));
  const past = OBJ.filter(o => { const q = uv(o.x, o.z); return q[0] < 0 || q[0] > w2.len; });
  const badPast = past.filter(o => { const q = uv(o.x, o.z); return !/^xw_t_pad/.test(o.id) || Math.abs(q[1]) < 28 || heightOf(o) > 5.5; });
  yes(!badPast.length, past.length + ' objects past the strip\'s ends, every one a young tree on the turnaround 28 m+ off the extended centreline, 5.5 m at most (' +
    Math.max(0, ...past.map(heightOf)).toFixed(1) + ' m the tallest)', badPast.map(o => o.id).join(', '));
}

// ---- 4 ---------------------------------------------------------------------------------------------------------------
console.log('4. the assets');
{
  const props = OBJ.filter(o => o.kind === 'prop'), trees = OBJ.filter(o => o.kind === 'tree');
  const missing = props.filter(o => !REG.props[o.key]);
  yes(!missing.length && props.length > 0, props.length + ' props, every key a baked prop (' + new Set(props.map(o => o.key)).size + ' keys)', missing.map(o => o.key).join(', '));
  const heavy = [...new Set(props.map(o => o.key))].filter(k => REG.props[k] && REG.props[k].nt > 2000 && !REG.props[k + '_l1']);
  yes(!heavy.length, 'every prop over 2 000 triangles has its LODs (the _l1.. rungs)', heavy.join(', '));
  const role = o => /_t_(blow\d|blow_stump|pond_lodge|pond_trunk|pond_fallen|pond_stump|slide_rock)/.test(o.id) ? ['debris', 'rock'] : /snag/.test(o.id) ? ['dead'] : ['tree', 'shrub'];
  const badT = trees.filter(o => !SUB.has(o.key) || !role(o).includes(SUB.get(o.key).col.kind));
  yes(!badT.length && trees.length > 0, trees.length + ' tree-system pieces, every key the tree pack\'s and of its role\'s kind (' + trees.filter(groundKind).length + ' ground pieces: fallen trees, stumps, the lodge, boulders)', badT.map(o => o.id + ':' + o.key).join(', '));
  const cols = new Set(TP.collections.map(c => c.name)), sp = [];
  for (const a of AREAS) { const v = a.props && a.props.cover && a.props.cover.veg; if (v && v.species) for (const k of Object.keys(v.species)) if (!cols.has(k)) sp.push(a.id + ':' + k); }
  yes(!sp.length, 'every species the vegetation areas plant is a tree-pack collection (' + AREAS.filter(a => a.props && a.props.cover).length + ' areas)', sp.join(', '));
  yes(!L.objects.some(o => /^xw_/.test(o.id) && o.kind === 'prop' && /(^|_)(tree|pine|spruce|fir|log|stump)(_|$)/i.test(o.key)), 'no tree is a prop: every tree, log and stump goes through the tree system');
}

// ---- 5 ---------------------------------------------------------------------------------------------------------------
console.log('5. the ground (the island composed in node)');
const IN = require(path.join(T, 'island_node.js'));
const t0 = Date.now();
const W = IN.islandWorld('jolene', { premises: (() => { const J = JSON.parse(FIXTXT); delete J.layers.runways.find(r => r.id === 'xw_rough').micro; return JSON.stringify(J); })() });
const tCompose = Date.now() - t0;
const P = (u, v) => [E2.end0[0] + D[0] * u + N[0] * v, E2.end0[1] + D[1] * u + N[1] * v];
const H = (u, v) => W.terrainH(...P(u, v)), wet = (x, z) => W.waterH && W.waterH(x, z) > W.terrainH(x, z);
{
  const lc = uv(lane.c[0], lane.c[1]), u0 = lc[0] - lane.len / 2;
  const d = [0, 0.25, 0.5, 0.75, 1].map(t => { const u = Math.min(u0 + lane.len - 0.5, Math.max(u0 + 0.5, u0 + lane.len * t)); return H(u, lc[1]) - H(u, 0); });
  yes(d.every(x => Math.abs(x) < 0.02), 'the lane\'s centreline lies on the band\'s at its five profile points (' + d.map(x => (x * 1000).toFixed(0)).join(' / ') + ' mm)');
  let wetB = [], wetL = 0;
  for (let u = 5; u < w2.len - 5; u += 10) if (wet(...P(u, 0))) wetB.push(u);
  for (let u = u0 + 5; u < u0 + lane.len - 5; u += 10) if (wet(...P(u, lc[1]))) wetL++;
  // (rev 28's 02/20 north end lay under the pond at (241, 599): GATE LOOKS 2's declared exception, the user's "keep it this
  //  way" 14 Oct - read here, not hidden: the band's wet stations are printed and held to that end)
  yes(wetL === 0 && wetB.every(u => u > 1500), 'the lane is dry along its centreline; the band is dry but ' + wetB.length + ' station(s) at its north end (LOOKS 2\'s declared pond: u ' + (wetB.length ? wetB[0] + '-' + wetB[wetB.length - 1] : 'none') + ')');
  const props = OBJ.filter(o => o.kind === 'prop'), wetP = props.filter(o => wet(o.x, o.z));
  yes(!wetP.length, 'every prop stands on dry ground (' + props.length + ')', wetP.map(o => o.id).join(', '));
  const lodge = OBJ.find(o => o.id === 'xw_t_pond_lodge');
  yes(!!lodge && wet(lodge.x, lodge.z), 'the beaver lodge stands in the DEM\'s own pond, back beside the band now its grade stops 8 m out (u ' + (lodge ? uv(lodge.x, lodge.z)[0].toFixed(0) : '?') + ')');
}

// ---- 6 ---------------------------------------------------------------------------------------------------------------
console.log('6. the props collide (their own triangles, 0.5 m columns, an OBSTACLES registry)');
const OB = C.OBSTACLES, R = OB.make(), SHAPES = new Map(), REC = [];
{
  let missed = [], leaked = [], tris = 0;
  for (const o of OBJ.filter(q => q.kind === 'prop')) {
    const prop = REG.props[o.key]; if (!prop) continue;
    let S = SHAPES.get(o.key);
    if (!S) {
      const dec = C.decodeProp(prop, prop.bin ? readGeo(prop.bin) : null);
      let nv = 0, nt = 0; for (const p of dec.parts) { nv += p.nv; nt += p.nt; }
      const pos = new Float32Array(nv * 3), idx = new Uint32Array(nt * 3); let vo = 0, to = 0;
      for (const p of dec.parts) { pos.set(p.pos, vo * 3); for (let i = 0; i < p.idx.length; i++) idx[to + i] = p.idx[i] + vo; vo += p.nv; to += p.idx.length; }
      S = OB.rasterise(pos, idx, 0.5); SHAPES.set(o.key, S); tris += nt;
    }
    const y0 = W.terrainH(o.x, o.z) + (+o.dy || 0);
    const id = R.add({ x: o.x, z: o.z, yaw: o.yaw, y0, shape: S, tag: 'prop' }), rec = R.get(id);
    REC.push({ o, rec, y0 });
    // a point inside: the tallest occupied column's middle (its lattice centre, local), carried to the world
    let best = -1, bi = 0, bj = 0; for (let j = 0; j < S.nz; j++) for (let i = 0; i < S.nx; i++) { const k = j * S.nx + i; if (S.hi[k] - S.lo[k] > best) { best = S.hi[k] - S.lo[k]; bi = i; bj = j; } }
    const k = bj * S.nx + bi, lx = S.ox + (bi + 0.5) * 0.5, lz = S.oz + (bj + 0.5) * 0.5, ly = (S.lo[k] + S.hi[k]) / 2;
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw), wx = o.x + lx * c + lz * s, wz = o.z - lx * s + lz * c;
    if (!OB.penetration(rec, wx, y0 + ly, wz, [0, 0, 0])) missed.push(o.id);
    const bb = prop.bb, far = Math.max(bb[3], -bb[0], bb[5], -bb[2]) + 2;
    if (OB.penetration(rec, o.x + far * c, y0 + bb[4] / 2, o.z - far * s, [0, 0, 0])) leaked.push(o.id);
  }
  yes(REC.length > 0 && !missed.length, REC.length + ' props registered from ' + SHAPES.size + ' shapes: a point at mid-height inside each is pushed out', missed.join(', '));
  yes(!leaked.length, 'a point 2 m clear of each prop\'s box touches nothing', leaked.join(', '));
}

// ---- 7 ---------------------------------------------------------------------------------------------------------------
console.log('7. the ground pieces collide (TREE_HITS.lying, the game\'s own registration)');
const TH = C.TREE_HITS.make(), CHAINS = [];
{
  const arr = []; let misses = [], ghosts = [];
  for (const o of OBJ.filter(groundKind)) {
    const { col, s } = SUB.get(o.key), sticks = /sticks|branches/i.test(col.name), sz = o.size || 1;
    const foot = W.terrainH(o.x, o.z) - 0.05, ch = C.TREE_HITS.lying(s.bb, sz, sticks, o.x, o.z, foot, o.yaw);
    CHAINS.push({ o, ch, foot });
    for (const q of ch) arr.push(q[0], q[1], q[2], q[3], q[4]);
  }
  TH.set('prem', arr);
  for (const { o, ch, foot } of CHAINS) {
    const mid = ch[(ch.length - 1) >> 1], top = mid[4];
    if (TH.at(mid[0], foot + Math.min(0.25, (top - foot) / 2), mid[1]) < 1) misses.push(o.id);
    const a = ch[0], b = ch[ch.length - 1], ax = b[0] - a[0], az = b[1] - a[1], al = Math.hypot(ax, az) || 1, ext = a[3] + 1.0;
    const px = b[0] + ax / al * ext, pz = b[1] + az / al * ext;
    if (ch.length > 1 && TH.at(px, foot + 0.2, pz) > 0 && !CHAINS.some(q => q !== CHAINS.find(z => z.o === o) && q.ch.some(c => Math.hypot(c[0] - px, c[1] - pz) < c[3] + 0.01))) ghosts.push(o.id + ' end');
    if (TH.at(mid[0], top + 0.3, mid[1]) > 0 && !CHAINS.some(q => q.o !== o && q.ch.some(c => Math.hypot(c[0] - mid[0], c[1] - mid[1]) < c[3] && c[4] > top + 0.3))) ghosts.push(o.id + ' top');
  }
  const nCyl = arr.length / 5;
  yes(CHAINS.length > 0 && !misses.length, CHAINS.length + ' ground pieces as ' + nCyl + ' cylinders: each is hit at its middle', misses.join(', '));
  yes(!ghosts.length, 'a point 1 m past each piece\'s end, or 0.3 m over its top, is clear', ghosts.join(', '));
  const longest = CHAINS.reduce((m, q) => { const a = q.ch[0], b = q.ch[q.ch.length - 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) + 2 * a[3]; return l > m.l ? { l, id: q.o.id, n: q.ch.length } : m; }, { l: 0 });
  yes(longest.l > 8, 'a fallen tree lies along its length: ' + longest.id + ' ' + longest.l.toFixed(1) + ' m of chain in ' + longest.n + ' cylinders (a trunk\'s upright cylinder would be a post at its middle)');
}

// ---- 8 ---------------------------------------------------------------------------------------------------------------
console.log('8. the solver meets them (the stock build, a flat world at 28 m)');
{
  const W0 = C.makeWorld(0, {}), STRIP = W0.aerodromes.find(a => a.id === 'HOME') || W0.aerodromes[0], elev = 28;
  const fx = Math.cos(STRIP.hdg), fz = Math.sin(STRIP.hdg);
  // place(c0, track) -> { th, ob }: what stands D m on along the free run's track
  function run(place, o) {
    const TH2 = C.TREE_HITS.make(), OB2 = C.OBSTACLES.make();
    const Wf = Object.assign({}, W0, { terrainH: () => elev, obstacles: OB2, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; }, treeHits: TH2 });
    const def = C.buildGen(), sim = C.makeSim(def, Wf);
    sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, STRIP, { elev, spawnElev: elev }));
    for (let f = 0; f < 120; f++) sim.step(1 / 60);
    const c0 = sim.cgPos().slice();
    if (place) place(c0, o.at, TH2, OB2);
    sim.ctl.thr = 1;
    let reach = -Infinity, at = null, isBad = false, obst = 0;
    for (let f = 0; f < 14 * 60; f++) {
      sim.step(1 / 60); if (sim.stats().bad) { isBad = true; break; }
      obst += (sim.out && sim.out.obst) || 0;
      const c = sim.cgPos(), along = (c[0] - c0[0]) * fx + (c[2] - c0[2]) * fz;
      if (along > 6) sim.ctl.thr = 0.35;
      reach = Math.max(reach, along); if (at === null && along >= o.D) at = [c[0] - c0[0], c[2] - c0[2]];
    }
    const Dm = sim.damage ? sim.damage() : null;
    return { reach, at, isBad, hits: (sim.trunkHits ? sim.trunkHits() : 0) + obst, reason: Dm && Dm.reason, crashed: !!(Dm && Dm.crashed), broke: Dm ? Dm.broken.length : 0 };
  }
  const Dd = 40, free = run(null, { D: Dd });
  yes(!free.isBad && free.reach > Dd + 2, 'with nothing there the aeroplane rolls through the place (' + free.reach.toFixed(1) + ' m)');
  const piece = key => SUB.get(key), across = Math.atan2(fx, fz) + Math.PI / 2;   // the long axis (local x) across the track
  const lyingAt = (key, size) => (c0, at, TH2) => { const { col, s } = piece(key); TH2.set('prem', [].concat(...C.TREE_HITS.lying(s.bb, size, /sticks/.test(col.name), c0[0] + at[0], c0[2] + at[1], elev - 0.05, across))); };
  const verdict = (r, what) => yes(!r.isBad && r.hits > 0 && (r.reach < Dd + 3 || r.crashed || r.broke > 0),
    what + ': ' + r.hits + ' contacts (beam-trunk + node-obstacle), ' + (r.reach < Dd + 3 ? 'stopped (the CG to ' + r.reach.toFixed(1) + ' m of ' + Dd + ')' : 'past it') + (r.crashed || r.broke ? ', ' + r.broke + ' members broken' + (r.crashed ? ', a crash (' + r.reason + ')' : '') : ''));
  verdict(run(lyingAt('dead_tree_trunk_02.glb|dead_tree_trunk_02', 1.8), { D: Dd, at: free.at }), 'taxied at a fallen trunk lying across its track (TREE_HITS)');
  verdict(run(lyingAt('coast_rocks_05|coast_rocks_05', 1), { D: Dd, at: free.at }), 'taxied at the slide\'s boulder group (TREE_HITS)');
  const car = REC.find(q => q.o.key === 'car_crashed');
  const carAt = (c0, at, TH2, OB2) => { OB2.add({ x: c0[0] + at[0] + fx * 2, z: c0[2] + at[1] + fz * 2, yaw: across, y0: elev, shape: SHAPES.get('car_crashed'), tag: 'prop' }); };
  if (car) verdict(run(carAt, { D: Dd, at: free.at }), 'taxied at the trailer camp\'s crashed car (OBSTACLES, its own 0.5 m columns)');
  else yes(false, 'the crashed car is in the part');
}

// ---- 9 ---------------------------------------------------------------------------------------------------------------
console.log('9. the cost (static: what the part draws; FRAMECOST measures the frame on a GPU)');
{
  const props = OBJ.filter(o => o.kind === 'prop'), trees = OBJ.filter(o => o.kind === 'tree');
  const triP = props.reduce((a, o) => a + (REG.props[o.key] ? REG.props[o.key].nt : 0), 0);
  const triT = trees.reduce((a, o) => a + (SUB.has(o.key) ? SUB.get(o.key).s.tris : 0), 0);
  const keys = new Set(props.map(o => o.key));
  const batchP = [...keys].reduce((a, k) => a + ((REG.props[k] && REG.props[k].parts) ? REG.props[k].parts.length : 1), 0);
  const cells = new Map(); for (const o of trees.filter(groundKind)) { const c = Math.floor(o.x / 64) + ',' + Math.floor(o.z / 64); if (!cells.has(c)) cells.set(c, new Set()); cells.get(c).add(o.key); }
  const batchG = [...cells.values()].reduce((a, s) => a + [...s].reduce((b, k) => b + SUB.get(k).s.rungs[0].parts.length, 0), 0);
  console.log('     props ' + props.length + ' (' + keys.size + ' keys, ' + triP + ' triangles at full detail, ' + batchP + ' instanced batches); tree-system pieces ' + trees.length + ' (' + triT + ' triangles; the ground pieces ' + cells.size + ' cells, ' + batchG + ' batches)');
  yes(triP + triT <= 260000, 'the part\'s full-detail triangles ' + (triP + triT) + ' <= 260 000 (the record\'s budget 400 000; every heavy prop drops to its LODs past its band)');
  yes(batchP + batchG <= 90 && keys.size <= 20, 'its batches ' + (batchP + batchG) + ' <= 90, its prop keys ' + keys.size + ' <= 20 (a few strong pieces, repeated: drums, tyres, fences, poles instanced)');
  // the planting: the vegetation areas' trees, estimated (density a hectare x the area)
  let ha = 0, est = 0; for (const a of AREAS) { const v = a.props && a.props.cover && a.props.cover.veg; if (!v) continue; let A = 0; for (let i = 0, p = a.poly; i < p.length; i++) { const q = p[(i + 1) % p.length]; A += p[i][0] * q[1] - q[0] * p[i][1]; } A = Math.abs(A) / 2e4; ha += A; est += A * (v.density || 100); }
  yes(est < 6000, 'the planting: ' + ha.toFixed(1) + ' ha of scrub and wood, ~' + Math.round(est) + ' trees by density - the forest fill\'s own instanced rungs and impostors, not a draw each');
  yes(tCompose < 60000, 'the island composes in ' + (tCompose / 1000).toFixed(1) + ' s in node with the part (the premises cook carries it in play)');
}

console.log('GATE AFB0220: ' + (bad ? 'FAIL (' + bad + ' of ' + n + ')' : 'PASS (' + n + ' checks)'));
process.exit(bad ? 1 : 0);
