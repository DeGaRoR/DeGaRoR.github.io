// ===========================================================================
// 26c_wild.js - THE WILD DEBRIS (AFB-0220, 13 Nov 2026): the fallen trees, the logs, the stumps and the boulders an
// abandoned strip collects, as PLACED objects you can hit. Pure, no THREE, no state.
// ===========================================================================
// The user (13 Nov): Jolene AFB's crosswind runway 02/20 "unmaintained, degraded ... the other side full of mud, rocks
// and fallen trees, with proper interaction and collision (crash into them in many different ways: wingtip, gear,
// prop)"; "trees: only the game's real tree system ... never plant a mesh tree"; "fallen trees: if the tree system has a
// fallen / dead variant use it". It has: the tree pack (src/core/trees_pack.json) carries a DEAD family (dead_conifer,
// dead_deciduous - bark only) and a DEBRIS family (dead_tree_trunk_02 "a 4 m fallen trunk", log.glb, tree_stump_01) and
// the island's ROCK scans (coast_land_rocks_*, coast_rocks_05, sand_rocks_small_01). The cover ring scatters the debris
// and the rocks as pictures (cover_ring.js: nothing registered, nothing to hit). THIS is the same models PLACED, one
// record each, and SOLID.
//
// THE RECORD: a premises object (layers.objects, the world editor's OBJECTS layer, like a prop):
//     { id, kind: 'debris', key: <a KINDS key>, x, z, yaw, s? }      (premises frame; s the scale, 1 = the kind's own)
// THE DRAWING: render_premises.js stands the tree pack's own geometry (treeBuild, the 'rungs' series, the full rung)
// in instanced batches - the same pictures the forest's floor is made of, so a placed trunk and a scattered one match.
// THE COLLISION: TREE_HITS (29_obstacles.js) - the trunk registry the solver already meets with EVERY damage path it has
// for a tree: the beams' collapse load (trunkPass: a wingtip, a strut, a gear leg bends or breaks on it), the PROPELLER
// STRIKE graded by DMG-DRIVE (propTrunk), the nose's crush (nosePass). A trunk record is a vertical cylinder
// [x, z, y0, r, y1]; a lying trunk is a CHAIN of short ones along its axis, a boulder a DOME of them on a grid (each
// cylinder's top the dome's height at its centre). 20_world.js setPremises registers the set 'wild' from the composed
// premises - in the page's world, the physics worker's (which composes the same record) and every node gate's - so the
// hit is the same everywhere, cooked or not. Discrepancy with the drawn mesh: under 0.5 m at the cylinders' rims (the
// G433 rule is 1 m); the chains and domes are measured off each subject's own bounding box in the pack.
//
// THE KINDS (sizes measured off trees_pack.json's bb at the collection's own `size`):
//   fallen_spruce   dead_conifer subject 0 LAID DOWN (16.2 m tall in the pack, x0.8 = 13 m): a windthrown dead spruce,
//                   its trunk on the stubs of its branches 0.35 m up; the chain along its length, 0.45 m radius at the
//                   butt to 0.2 m at the top, 1.3 m high at the butt
//   fallen_snag     dead_conifer subject 1 laid down (9.8 m x0.8 = 7.8 m): a smaller one
//   trunk           dead_tree_trunk_02 (a 4.0 x 1.0 x 1.0 m scan, Poly Haven): a chain of 0.5 m along x
//   log             log.glb (6.0 m at 0.0085): a chain of 0.4 m along z
//   stump           tree_stump_01 (1.4 m across, 0.57 m high): one cylinder
//   rocks_slide     coast_land_rocks_03 (9.0 x 5.6 x 1.5 m, 27 % buried): a dome
//   rocks_bank      coast_land_rocks_02 (4.9 x 10.4 x 1.35 m, 19 % buried): a dome
//   rocks_pile      coast_rocks_05 (4.0 x 3.7 x 1.3 m, 24 % buried): a dome
//   rocks_low       sand_rocks_small_01 (4.6 x 3.9 x 0.53 m, 26 % buried): a dome
'use strict';
const WILD_DEBRIS = (() => {
  // col: the pack's collection; sub: the subject's index in it; size: model units -> metres (the collection's place.size
  // unless said); bb: the subject's [x0, y0, z0, x1, y1, z1] in model units (trees_pack.json, copied - GATE AFB0220 holds
  // them to the pack); bury: the fraction of the height under the ground (the rocks' own place.bury); lay: the model's
  // +y laid along +x (a standing tree felled toward +x, its butt at the origin); shape: the hit's form
  const KINDS = {
    fallen_spruce: { label: 'fallen dead spruce (13 m)', col: 'dead_conifer', sub: 0, size: 0.8, bb: [-3.9633, 0, -4.0815, 3.9633, 16.1846, 4.0815], lay: 1, lift: 0.35,
                     shape: { kind: 'chain', axis: 'x', from: 0.3, to: 0.92, r0: 0.45, r1: 0.2, h0: 1.3, h1: 0.6 } },
    fallen_snag:   { label: 'fallen dead spruce (8 m)', col: 'dead_conifer', sub: 1, size: 0.8, bb: [-2.0812, 0, -1.4979, 2.0812, 9.7734, 1.4979], lay: 1, lift: 0.25,
                     shape: { kind: 'chain', axis: 'x', from: 0.2, to: 0.9, r0: 0.35, r1: 0.18, h0: 0.9, h1: 0.45 } },
    trunk:         { label: 'fallen trunk (4 m)', col: 'dead_tree_trunk_02.glb', sub: 0, size: 1, bb: [-2.0221, 0, -0.5145, 2.0221, 1.0438, 0.5145],
                     shape: { kind: 'chain', axis: 'x', from: 0.03, to: 0.97, r0: 0.5, r1: 0.45, h0: 1.0, h1: 0.9 } },
    log:           { label: 'log (6 m)', col: 'log.glb', sub: 0, size: 0.0085, bb: [-45.7973, 0, -351.6594, 45.7973, 96.102, 351.6594],
                     shape: { kind: 'chain', axis: 'z', from: 0.03, to: 0.97, r0: 0.42, r1: 0.38, h0: 0.82, h1: 0.78 } },
    stump:         { label: 'stump', col: 'tree_stump_01.glb', sub: 0, size: 1, bb: [-0.7145, 0, -0.7955, 0.7145, 0.5677, 0.7955],
                     shape: { kind: 'disc', r: 0.7, h: 0.57 } },
    rocks_slide:   { label: 'boulders from a slide (9 x 6 m)', col: 'coast_land_rocks_03', sub: 0, size: 1, bury: 0.267, bb: [-4.483, 0, -2.8113, 4.483, 1.5012, 2.8113], shape: { kind: 'dome' } },
    rocks_bank:    { label: 'boulder bank (5 x 10 m)', col: 'coast_land_rocks_02', sub: 0, size: 1, bury: 0.187, bb: [-2.4379, 0, -5.2128, 2.4379, 1.348, 5.2128], shape: { kind: 'dome' } },
    rocks_pile:    { label: 'boulder pile (4 m)', col: 'coast_rocks_05', sub: 0, size: 1, bury: 0.242, bb: [-2.0046, 0, -1.8737, 2.0046, 1.3221, 1.8737], shape: { kind: 'dome' } },
    rocks_low:     { label: 'low rocks (4.6 m)', col: 'sand_rocks_small_01', sub: 0, size: 1, bury: 0.264, bb: [-2.3168, 0, -1.9436, 2.3168, 0.5273, 1.9436], shape: { kind: 'dome' } },
  };
  const ORDER = Object.keys(KINDS);
  // A POLE IS A TRUNK TOO (AFB-0220): a placed prop is solid by its drawn mesh in the page (render_premises hitAdd 'prop':
  // the OBSTACLES column grid, met by the airframe's NODES) - a 0.3 m pole stands between a wing's nodes and a wing passes
  // through it (measured: the Cub's wing 4.5 m out at 5 m/s, no contact). A pole prop whose record says `trunk: true` is
  // also a trunk cylinder here (met by the BEAMS, as a tree is: the wing bends or breaks on it). Measured off PROP_REG's
  // dims (src/pier/pier_yard.js: 6.13 m; the pole's own section, not the crossarm's 1.2 m)
  const POLES = { pole_a: { r: 0.16, h: 6.13 }, pole_b: { r: 0.16, h: 6.13 }, pole_c: { r: 0.16, h: 6.13 } };
  const STRIDE = 5;
  // the record's scale (1 = the kind's own), held to the editor's slider range
  const scaleOf = ob => { const s = +(ob && ob.s); return s > 0 ? Math.max(0.25, Math.min(4, s)) : 1; };
  // THE PLACED FRAME of a record: metres per model unit (m), the model's height in metres (H), the sink under the ground
  // (bury x H; a laid tree's lift above it, negative), and the model -> local map (local: x along the yaw's +x, z across)
  function frameOf(K, s) {
    const m = K.size * s, b = K.bb, H = (b[4] - b[1]) * m;
    return { m, H, sink: K.lay ? -(K.lift || 0) * s : (K.bury || 0) * H };
  }
  // a model point -> the record's local (x, y, z) before the yaw (a laid tree: its +y along +x, its +x up)
  function modelToLocal(K, F, px, py, pz) {
    if (K.lay) return [py * F.m, -px * F.m, pz * F.m];   // a turn of -90 deg about z (a rotation, not a mirror)
    return [px * F.m, py * F.m, pz * F.m];
  }
  // THE HIT CYLINDERS in the record's local frame: [lx, lz, h0 (foot above the record's ground), r, h1 (top above it)]
  function localHits(key, s) {
    if (POLES[key]) return [[0, 0, -0.3, POLES[key].r, POLES[key].h * s]];
    const K = KINDS[key]; if (!K) return [];
    const F = frameOf(K, s), b = K.bb, S = K.shape, out = [];
    if (S.kind === 'disc') { out.push([0, 0, -0.1, S.r * s, S.h * s]); return out; }
    if (S.kind === 'chain') {
      // the axis in the record's local frame: a laid tree along +x from its butt; a lying model along its own x or z
      let a0, a1;
      if (K.lay) { a0 = S.from * (b[4] - b[1]) * F.m; a1 = S.to * (b[4] - b[1]) * F.m; }
      else { const lo = S.axis === 'x' ? b[0] : b[2], hi = S.axis === 'x' ? b[3] : b[5]; a0 = (lo + S.from * (hi - lo)) * F.m; a1 = (lo + S.to * (hi - lo)) * F.m; }
      // the step along the axis is the local radius (two neighbours' circles overlap: the waist between them 1.7 r wide)
      const len = a1 - a0, rOf = t => (S.r0 + (S.r1 - S.r0) * t) * s, hOf = t => (S.h0 + (S.h1 - S.h0) * t) * s;
      const put = t => { const a = a0 + t * len; out.push(S.axis === 'z' && !K.lay ? [0, a, -0.1, rOf(t), hOf(t)] : [a, 0, -0.1, rOf(t), hOf(t)]); };
      let t = 0; put(0);
      while (t < 1) { t = Math.min(1, t + rOf(t) / len); put(t); }
      return out;
    }
    // a DOME: the bounding ellipse's footprint on a grid of cylinders, each as tall as the dome over its centre
    // (an ellipsoid cap of the subject's height, less what is buried); the cell from the smaller half-axis
    const ax = (b[3] - b[0]) / 2 * F.m, az = (b[5] - b[2]) / 2 * F.m, H = F.H - F.sink;
    const cell = Math.max(0.6, Math.min(1.6, Math.min(ax, az) / 2)), r = cell * 0.75;
    for (let gz = -az + cell / 2; gz < az; gz += cell) for (let gx = -ax + cell / 2; gx < ax; gx += cell) {
      const q = 1 - (gx / ax) * (gx / ax) - (gz / az) * (gz / az);
      if (q <= 0.05) continue;
      out.push([gx, gz, -0.1, r, H * Math.sqrt(q)]);
    }
    return out;
  }
  // THE WORLD'S CYLINDERS for a list of records (world frame: x, z, yaw, s; ground(x, z) the composed ground) -> a plain
  // array, stride 5 (TREE_HITS' [x, z, y0, r, y1]); each cylinder stands on the ground UNDER IT (a log across a ditch
  // follows it), the foot 0.1 m into it
  function hitsOf(recs, ground) {
    const out = [];
    for (const R of recs) {
      const s = scaleOf(R), c = Math.cos(R.yaw || 0), sn = Math.sin(R.yaw || 0);
      for (const h of localHits(R.key, s)) {
        // local x along the yaw (the house frame: a yaw turns +x toward -z), z across
        const wx = R.x + h[0] * c + h[1] * sn, wz = R.z - h[0] * sn + h[1] * c, g = ground(wx, wz);
        out.push(wx, wz, g + h[2], h[3], g + h[4]);
      }
    }
    return out;
  }
  // the records of a composed premises' objects layer (kind 'debris', a known key), in the WORLD frame
  function records(rec, frame) {
    const out = [], L = rec && rec.layers && rec.layers.objects;
    if (!Array.isArray(L)) return out;
    for (const ob of L) {
      if (!ob || !isFinite(+ob.x) || !isFinite(+ob.z)) continue;
      if (!(ob.kind === 'debris' && KINDS[ob.key]) && !(ob.kind === 'prop' && ob.trunk && POLES[ob.key])) continue;
      const w = frame ? frame.toWorld(+ob.x, +ob.z) : [+ob.x, +ob.z];
      out.push({ id: ob.id, key: ob.key, x: w[0], z: w[1], yaw: (+ob.yaw || 0) + (frame ? frame.yaw || 0 : 0), s: scaleOf(ob) });
    }
    return out;
  }
  // the drawn model's matrix pieces for a record: the model's metres-per-unit, the laid rotation, the sink
  function drawOf(key, s) {
    const K = KINDS[key]; if (!K) return null;
    const F = frameOf(K, s);
    return { col: K.col, sub: K.sub, m: F.m, lay: !!K.lay, sink: F.sink, H: F.H };
  }
  // the issues of one record (27_premises issues())
  function issue(ob) {
    if (!ob.key) return 'debris ' + ob.id + ': no key';
    if (!KINDS[ob.key]) return 'debris ' + ob.id + ': unknown kind ' + ob.key + ' (' + ORDER.join(', ') + ')';
    return null;
  }
  return { KINDS, ORDER, POLES, STRIDE, scaleOf, localHits, hitsOf, records, drawOf, issue, modelToLocal, frameOf };
})();
