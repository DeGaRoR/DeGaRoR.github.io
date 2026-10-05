// G1851 / G1852 (DMG-D4a SKIN): THE SKIN OVER A BREAK - DEFORM-AND-BREAK §2.5 (BeamNG's breakMeshes: the skin follows
// the nodes, and deletes itself over a break), §5.1, §8.4 (no stretched skin). TREE-CRASH's G1474 left it owed: a part
// that came off was drawn stretched between the pieces like chewing gum.
//
// ONE RULE, TWO SKINS: the generated skin (63_gen_wing.js poseSkinGen) and the flown cage snapshot (app.js poseModel).
// At the first break each group is BOUND to its K nearest nodes at rest (bindNearest: weights that put their blend on
// the vertex; made then, so an intact aeroplane never pays for it). The cage snapshot carries no weights; the
// generator's own (genMesh, GEN_INFL) are not geometric - a leading-edge vertex 1.54 on the rear spar's node and -0.54
// on the front one: a small flex's interpolation, which tore clean wing tips once a wreck folded them 23 degrees
// (measured) - so after a break the generated skin rides the same binding. On a BREAK EVENT (the
// damage state's vB - sim_view.js simViewDmgState: the broken list and DMG-D1b's pieces, the same inline and under the
// worker), never per frame:
//   1. each vertex goes with the PIECE holding most of its weight (a vertex is a point: it sits on one side), its weights
//      on the other pieces dropped and the rest renormalised;
//   2. ...and on its own side of a BROKEN MEMBER: of its nodes, those joined to its dominant node only by broken members
//      are dropped (a lift strut snapped in the middle is two halves, each on its own end - §5.1);
//   3. a TRIANGLE whose vertices sit on two pieces, or whose vertices' dominant nodes are joined only by broken members
//      (it spans the break), is REMOVED: its three indices collapse onto one vertex (zero area; the index array is the
//      geometry's own, so every view on it loses it too). The torn edge is left open (§5.1: a cap is a later polish).
//      A part that came off whole keeps every triangle of its own.
// PER FRAME, only once something is broken:
//   - THE VERTEX RIDES ITS NODES' OWN FRAMES (RoR / BeamNG flexbodies, §2.5: a vertex stored in its nodes' local
//     frame): pos = sum w' l_i + q_v (base - sum w' r_i), w' its kept weights, q_v the weighted blend of its nodes'
//     turns - node i's from its rest to its live neighbourhood (the node and the other ends of its live members on its
//     piece, the second ring if that is under 4), fitted by Horn's closed-form quaternion and held to its last turn where
//     the set cannot say (nodes in a line). With every turn nil it is poseSkinGen's own blend; under a rigid motion it is
//     that motion, exactly. The plain blend of displacements turns no offset: a wing folded back round a trunk, metres
//     from its rest, dragged a vertex 0.06 off its neighbour's weights a third of a metre - a 65 % stretch with nothing
//     broken there (measured, the Cub's tip). Two that did worse, measured: one rotation per cell of vertices sharing
//     nodes (it tore at the cells' borders), and each node's rotation on the vertex's lever to that node (linear-blend
//     skinning: a few degrees between neighbours over a half-bay lever);
//   - the GENERATED skin rides its nodes' frames everywhere; the CAGE snapshot keeps its own pose (the rigid body
//     frame, the spar stations, the hinges) except where the break is: a vertex on a DETACHED piece (not the core: the
//     piece holding the body's refs) or bound to an end of a broken member rides its nodes' frames. (A detached piece is
//     no rigid body: one rigid fit per piece left the broken-up twin's rear fuselage 0.85 m off its own nodes, measured);
//   - THE TEAR: a live triangle near the break whose edge has stretched past TEAR over its rest is torn for good - the
//     skin's elongation at break: doped fabric 15-20 % (AC 43.13-1B Table 2-1; GEN_CRASH.fabric.etu = 0.15), 2024-T3
//     sheet 15 % (MIL-HDBK-5J 3.2.3.0(b)). One bound, the lower: an edge past 1.15 x its rest length + TEAR_ABS (5 mm:
//     the generator's sliver triangles - 2 mm edges at the leading edge - move a few tenths of a mm under its own
//     extrapolating weights, 17 % of nothing). Not in the exaggerated flex view (x4: its stretch is the drawing's);
//   - THE DRAPE (G1852): a FABRIC panel over a broken member goes slack: each vertex the member carried (its weight
//     shared between the member's two ends, 4 w_a w_b / (w_a + w_b): 1 on the member's line, 0 at a node or away from
//     it) hangs DRAPE_K x the member's length lower along gravity in the skin's frame, rippled along the member (a
//     wrinkle of WRINKLE_L, +-WRINKLE_A of the sag) so a slack panel does not read as a stretched one (§8.4). A fixed
//     field per vertex, made at the event; per frame one multiply-add along `down`. Metal and ply skins do not drape
//     (they would dent - D4b's to judge on the box).
// The core's skin is posed as it always was until a member breaks: nothing here runs, and not one bit of a skin moves,
// while nothing is broken. PURE: no THREE, no DOM; node-tested by GATE DMGSKIN (tools/_dmg_skin_check.js).
// window.SKIN_BREAK in the page; module.exports in node.
(function () {
  'use strict';
  const TEAR = 0.15;          // the skin's elongation at break (above)
  const TEAR_ABS = 0.01;      // ...and past 1 cm (below)
  const DRAPE_K = 0.06;       // a slack fabric panel's sag, over the span it lost (6 cm under a 1 m member)
  const WRINKLE_L = 0.12;     // the wrinkles' pitch along the broken member (m)
  const WRINKLE_A = 0.35;     // ...their depth, over the sag
  const NEAR_K = 4;           // the cage snapshot's binding: the 4 nearest nodes, inverse-square weighted

  // ---- the topology: the member pairs and each node's members, built once a def ----
  function topo(beams, n) {
    const pairs = new Map(), adj = Array.from({ length: n }, () => []);
    beams.forEach((b, bi) => {
      const a = Math.min(b.a, b.b), c = Math.max(b.a, b.b), k = a * n + c;
      const L = pairs.get(k); if (L) L.push(bi); else pairs.set(k, [bi]);
      adj[b.a].push(bi); adj[b.b].push(bi);
    });
    return { n, nb: beams.length, pairs, adj, beams };
  }
  // the pairs whose every member is broken, and the nodes at a broken member's ends, for a damage state
  function brokenPairs(T, D) {
    const P = new Set(), ends = new Uint8Array(T.n);
    for (const bi of D.br) {
      const b = T.beams[bi]; if (!b) continue;
      ends[b.a] = 1; ends[b.b] = 1;
      const a = Math.min(b.a, b.b), c = Math.max(b.a, b.b), k = a * T.n + c;
      if (T.pairs.get(k).every(j => D.broken[j])) P.add(k);
    }
    return { P, ends, n: T.n, has: (x, y) => x !== y && P.has(Math.min(x, y) * T.n + Math.max(x, y)) };
  }

  // ---- THE CONVEX-ISH BINDING, both skins' after a break: each vertex's K nearest nodes at rest (pos and nodeRest in
  // one frame), weighted so their blend lands ON the vertex as nearly as the nodes allow - min |sum w (r_k - x)|^2 +
  // mu |w - w_idw|^2 with sum w = 1 (w_idw: inverse-square; mu = BIND_MU x the nodes' mean square distance: a node set in
  // a plane cannot reach a vertex off it, and the rest of the way the weights stay near inverse-square). The vertex's
  // lever off its nodes' blend is then the skin's own offset off the frame (its thickness), which is what the nodes'
  // turn acts on (onNodes). Measured on the Cub's 30 m/s trunk: with inverse-square weights alone the lever reached a
  // third of a metre and the wing's skin tore where no member was hurt (an outer bay, rigid, swung 90 degrees)
  const BIND_MU = 0.05;
  // the node grid: about a node a cell (its side from the nodes' box), the search walks out a ring of cells at a time
  // (mask: only those vertices; into: { wi, ww } to fill instead of new arrays)
  function bindNearest(pos, nv, nodeRest, nNode, K, mask, into) {
    K = K || NEAR_K;
    const wi = into ? into.wi : new Int32Array(nv * K), ww = into ? into.ww : new Float32Array(nv * K);
    const bd = new Float64Array(K), bi = new Int32Array(K), M = new Float64Array(K * (K + 1)), w0 = new Float64Array(K), xa = new Float64Array(K), xb = new Float64Array(K);
    // the nodes on a grid
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < nNode; i++) { const p = nodeRest; x0 = Math.min(x0, p[i * 3]); y0 = Math.min(y0, p[i * 3 + 1]); z0 = Math.min(z0, p[i * 3 + 2]);
      x1 = Math.max(x1, p[i * 3]); y1 = Math.max(y1, p[i * 3 + 1]); z1 = Math.max(z1, p[i * 3 + 2]); }
    const h = Math.max(0.1, Math.cbrt(Math.max(1e-6, (x1 - x0) * (y1 - y0) * (z1 - z0)) / Math.max(1, nNode))), gx = Math.max(1, Math.ceil((x1 - x0) / h) + 1), gy = Math.max(1, Math.ceil((y1 - y0) / h) + 1), gz = Math.max(1, Math.ceil((z1 - z0) / h) + 1);
    const head = new Int32Array(gx * gy * gz).fill(-1), next = new Int32Array(nNode);
    for (let i = 0; i < nNode; i++) { const k = (Math.floor((nodeRest[i * 3] - x0) / h) * gy + Math.floor((nodeRest[i * 3 + 1] - y0) / h)) * gz + Math.floor((nodeRest[i * 3 + 2] - z0) / h); next[i] = head[k]; head[k] = i; }
    const gmax = Math.max(gx, gy, gz);
    const R0 = new Float64Array(K * 3);
    for (let v = 0; v < nv; v++) {
      if (mask && !mask[v]) continue;
      bd.fill(Infinity); bi.fill(-1);
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const cx = Math.floor((x - x0) / h), cy = Math.floor((y - y0) / h), cz = Math.floor((z - z0) / h);
      // ring r: the cells at Chebyshev distance r from the vertex's; done once the K-th nearest is closer than anything
      // outside the block searched (r h away at least)
      for (let r = 0; ; r++) {
        for (let ix = cx - r; ix <= cx + r; ix++) { if (ix < 0 || ix >= gx) continue; const ex = ix === cx - r || ix === cx + r;
          for (let iy = cy - r; iy <= cy + r; iy++) { if (iy < 0 || iy >= gy) continue; const ey = ex || iy === cy - r || iy === cy + r;
            for (let iz = cz - r; iz <= cz + r; iz += (ey || r === 0) ? 1 : 2 * r) { if (iz < 0 || iz >= gz) continue;
              for (let i = head[(ix * gy + iy) * gz + iz]; i >= 0; i = next[i]) {
                const dx = nodeRest[i * 3] - x, dy = nodeRest[i * 3 + 1] - y, dz = nodeRest[i * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
                if (d >= bd[K - 1]) continue;
                let j = K - 1; while (j > 0 && bd[j - 1] > d) { bd[j] = bd[j - 1]; bi[j] = bi[j - 1]; j--; }
                bd[j] = d; bi[j] = i;
              } } } }
        if ((bi[K - 1] >= 0 && bd[K - 1] <= (r * h) * (r * h)) || r > gmax + Math.abs(cx) + Math.abs(cy) + Math.abs(cz)) break;
      }
      let m = 0; while (m < K && bi[m] >= 0) m++;
      if (K === 1) { wi[v] = bi[0]; ww[v] = 1; continue; }
      let s = 0, d2 = 0; for (let j = 0; j < m; j++) { s += 1 / (bd[j] + 1e-4); d2 += bd[j]; }
      for (let j = 0; j < m; j++) { w0[j] = (1 / (bd[j] + 1e-4)) / s; const p3 = bi[j] * 3; R0[j * 3] = nodeRest[p3] - x; R0[j * 3 + 1] = nodeRest[p3 + 1] - y; R0[j * 3 + 2] = nodeRest[p3 + 2] - z; }
      // M = P'^T P' + mu I (P' the nodes off the vertex); w = M^-1 (mu w0 - nu 1), 1^T w = 1
      const mu = BIND_MU * (d2 / Math.max(1, m)) + 1e-9, S = K + 1;
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < m; j++) { for (let k = 0; k < m; k++)
            M[j * S + k] = R0[j * 3] * R0[k * 3] + R0[j * 3 + 1] * R0[k * 3 + 1] + R0[j * 3 + 2] * R0[k * 3 + 2] + (j === k ? mu : 0);
          M[j * S + m] = pass ? 1 : mu * w0[j]; }
        solve(M, m, S, pass ? xb : xa);
      }
      let sa = 0, sb = 0; for (let j = 0; j < m; j++) { sa += xa[j]; sb += xb[j]; }
      const nu = (sa - 1) / sb;
      // (a vertex far off its nodes would extrapolate them: past |w| 2 it keeps the inverse-square weights)
      let big = false; for (let j = 0; j < m; j++) if (Math.abs(xa[j] - nu * xb[j]) > 2) big = true;
      for (let j = 0; j < K; j++) { wi[v * K + j] = j < m ? bi[j] : bi[0]; ww[v * K + j] = j < m ? (big ? w0[j] : xa[j] - nu * xb[j]) : 0; }
    }
    return { wi, ww, K };
  }
  // Gaussian elimination with partial pivoting on an m x (m + 1) augmented matrix, row stride S, in place -> out
  function solve(A, m, S, out) {
    for (let c = 0; c < m; c++) {
      let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r * S + c]) > Math.abs(A[p * S + c])) p = r;
      if (p !== c) for (let k = 0; k <= m; k++) { const t = A[c * S + k]; A[c * S + k] = A[p * S + k]; A[p * S + k] = t; }
      const piv = A[c * S + c] || 1e-12;
      for (let r = c + 1; r < m; r++) { const f = A[r * S + c] / piv; for (let k = c; k <= m; k++) A[r * S + k] -= f * A[c * S + k]; }
    }
    for (let r = m - 1; r >= 0; r--) { let acc = A[r * S + m]; for (let k = r + 1; k < m; k++) acc -= A[r * S + k] * out[k]; out[r] = acc / (A[r * S + r] || 1e-12); }
  }

  // ---- a group's record: its binding, its index (kept whole in idx0), what the last event made of it ----
  // g: { nv, idx (the geometry's own index array), wi, ww }  K: the binding's width   o: { fabric, cage }
  // A CAGE record (o.cage, o.pos and o.rest given) starts on each vertex's NEAREST node alone - its piece and its dominant
  // node, all a vertex that does not ride its nodes needs (bindNearest K 1: ~0.5 us a vertex); the full binding is made at
  // each event for the vertices whose nearest node is at the break (an end of a broken member or a node one live member
  // from one) - the cost follows the damage, not the skin's size (a cage snapshot carries ~200k vertices)
  function make(g, K, o) {
    if (o && o.cage && o.pos && o.rest && !g.wi) {
      const near = bindNearest(o.pos, g.nv, o.rest, o.rest.length / 3, 1).wi;
      g.wi = new Int32Array(g.nv * K); g.ww = new Float32Array(g.nv * K);
      for (let v = 0; v < g.nv; v++) { for (let k = 0; k < K; k++) g.wi[v * K + k] = near[v]; g.ww[v * K] = 1; }
      g.near = near; g.bound = new Uint8Array(g.nv); g.pos = o.pos; g.rest = o.rest;
    }
    return { g, nv: g.nv, K, wi: g.wi, ww: g.ww, idx: g.idx, idx0: null, nt: (g.idx.length / 3) | 0,
             vB: -1, vp: null, dom: null, w2: null, ride: null, dead: null, watch: null, sag: null, torn: 0, removed: 0,
             fabric: !!(o && o.fabric), cage: !!(o && o.cage), active: false };
  }
  const slotOf = (wi, o, K, d) => { for (let k = 0; k < K; k++) if (wi[o + k] === d) return k; return 0; };
  // THE EVENT: the damage state moved (D.vB). Returns true when the index changed
  function event(R, T, D, rest, base) {
    if (R.vB === D.vB) return false;
    R.vB = D.vB;
    const { nv, K, wi, ww } = R, idx = R.idx;
    if (!D.br.length) {                        // healed (a reset): the index as built, nothing held
      if (R.idx0) idx.set(R.idx0);
      R.active = false; R.vp = R.dom = R.w2 = R.ride = R.dead = R.watch = R.sag = null; R.torn = R.removed = 0;
      return !!R.idx0;
    }
    if (!R.idx0) R.idx0 = idx.slice();
    const BP = brokenPairs(T, D), pc = D.pc;
    // a cage record: the full binding for the vertices at the break (their nearest node an end of a broken member, or one
    // live member from one) or off the core, the ones not bound before
    if (R.g.near) {
      const zone = new Uint8Array(T.n);
      for (const bi of D.br) { const b = T.beams[bi]; if (!b) continue;
        for (const i of [b.a, b.b]) { zone[i] = 1; for (const bj of T.adj[i]) { const c = T.beams[bj]; zone[c.a] = zone[c.b] = 1; } } }
      const mask = new Uint8Array(nv); let any = false;
      for (let v = 0; v < nv; v++) { const i = R.g.near[v]; if (!R.g.bound[v] && (zone[i] || (pc && pc[i] !== 0))) { mask[v] = 1; R.g.bound[v] = 1; any = true; } }
      if (any) bindNearest(R.g.pos, nv, R.g.rest, T.n, K, mask, R.g);
    }
    const vp = R.vp || (R.vp = new Int32Array(nv)), dom = R.dom || (R.dom = new Int32Array(nv));
    const w2 = R.w2 || (R.w2 = new Float32Array(nv * K)), ride = R.ride || (R.ride = new Uint8Array(nv));
    const pw = new Float64Array(Math.max(1, D.nPc));
    const onEnd = v => { const o = v * K; for (let k = 0; k < K; k++) if (ww[o + k] !== 0 && BP.ends[wi[o + k]]) return true; return false; };
    for (let v = 0; v < nv; v++) {
      const o = v * K;
      // 1. the piece holding most of its weight
      let P = 0;
      if (pc) { pw.fill(0); for (let k = 0; k < K; k++) { const w = ww[o + k]; if (w !== 0) pw[pc[wi[o + k]]] += w; }
        let best = -Infinity; for (let q = 0; q < pw.length; q++) if (pw[q] > best) { best = pw[q]; P = q; } }
      vp[v] = P;
      // its dominant node on that piece
      let d = wi[o], dw = -Infinity;
      for (let k = 0; k < K; k++) { const w = ww[o + k], i = wi[o + k]; if (w !== 0 && w > dw && (!pc || pc[i] === P)) { dw = w; d = i; } }
      dom[v] = d;
      // 2. kept: on its piece, not across a broken member from its dominant node
      let s = 0, drop = false;
      for (let k = 0; k < K; k++) {
        const w = ww[o + k], i = wi[o + k];
        const keep = w !== 0 && (!pc || pc[i] === P) && !BP.has(d, i);
        if (w !== 0 && !keep) drop = true;
        w2[o + k] = keep ? w : 0; s += keep ? w : 0;
      }
      if (drop) {
        if (s > 0.05) for (let k = 0; k < K; k++) w2[o + k] /= s;
        else { const j = slotOf(wi, o, K, d); for (let k = 0; k < K; k++) w2[o + k] = k === j ? 1 : 0; }
      }
      // does it ride its nodes' frames (the cage: a vertex on a detached piece, or at a broken member's end; the rest
      // keep the cage's own pose)
      ride[v] = !R.cage || P !== 0 || onEnd(v) ? 1 : 0;
    }
    // 3. the triangles: on one piece, and not across a broken member
    const i0 = R.idx0, nt = R.nt, dead = R.dead || (R.dead = new Uint8Array(nt));
    const watch = [];
    let removed = 0;
    for (let t = 0; t < nt; t++) {
      const a = i0[t * 3], b = i0[t * 3 + 1], c = i0[t * 3 + 2];
      let gone = dead[t] === 2;                   // torn by stretch earlier: stays torn
      if (!gone) {
        gone = vp[a] !== vp[b] || vp[b] !== vp[c] ||
               BP.has(dom[a], dom[b]) || BP.has(dom[b], dom[c]) || BP.has(dom[a], dom[c]);
        dead[t] = gone ? 1 : 0;
      }
      if (gone) { idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = a; removed++; continue; }
      idx[t * 3] = a; idx[t * 3 + 1] = b; idx[t * 3 + 2] = c;
      // watched for the tear: a triangle with a vertex that rides its nodes (every one of the generated skin's; the
      // cage's off the core or at the break - the rest is rigid on the body)
      if (ride[a] || ride[b] || ride[c]) watch.push(t);
    }
    R.watch = Int32Array.from(watch); R.removed = removed; R.active = true;
    // G1852: the drape - a fabric skin's vertices the broken members carried
    R.sag = null;
    if (R.fabric && rest && base) {
      const at = new Map();
      for (const bi of D.br) { const b = T.beams[bi]; if (!b) continue;
        for (const i of [b.a, b.b]) { const L = at.get(i); if (L) L.push(bi); else at.set(i, [bi]); } }
      const sag = new Float32Array(nv);
      let any = false;
      for (let v = 0; v < nv; v++) {
        const o = v * K;
        for (let k = 0; k < K; k++) {
          const A = wi[o + k], wa = ww[o + k];
          if (!(wa > 0) || !BP.ends[A]) continue;
          for (const bi of at.get(A)) {
            const b = T.beams[bi], B = b.a === A ? b.b : b.a;
            if (B < A) continue;                         // each member once, from its lower end
            let wb = 0; for (let q = 0; q < K; q++) if (wi[o + q] === B) wb += ww[o + q];
            if (!(wb > 0)) continue;
            const ax = rest[A * 3], ay = rest[A * 3 + 1], az = rest[A * 3 + 2];
            const ex = rest[B * 3] - ax, ey = rest[B * 3 + 1] - ay, ez = rest[B * 3 + 2] - az, Lm = Math.hypot(ex, ey, ez);
            if (!(Lm > 1e-6)) continue;
            const u = ((base[v * 3] - ax) * ex + (base[v * 3 + 1] - ay) * ey + (base[v * 3 + 2] - az) * ez) / Lm;
            const h = DRAPE_K * Lm * (4 * wa * wb / (wa + wb)) * (1 + WRINKLE_A * Math.sin(2 * Math.PI * u / WRINKLE_L));
            if (h > sag[v]) { sag[v] = h; any = true; }
          }
        }
      }
      if (any) R.sag = sag;
    }
    return true;
  }

  // ---- THE NODES' FRAMES (per frame, shared by every group): node i's rotation from its rest neighbourhood to its live
  // one. NF: { vB, off, nb (the neighbourhoods, rebuilt at each event), R (9 a node), q (4 a node: the last turn) }
  function nodeFrames(NF, T, D, rest, live) {
    const n = T.n, pc = D.pc;
    if (NF.vB !== D.vB) {
      NF.vB = D.vB;
      const off = [0], nb = [];
      for (let i = 0; i < n; i++) {
        const S = new Set([i]);
        const ring = from => { for (const x of from) for (const bi of T.adj[x]) { if (D.broken[bi]) continue; const b = T.beams[bi], j = b.a === x ? b.b : b.a;
          if (!pc || pc[j] === pc[i]) S.add(j); } };
        ring([i]); if (S.size < 4) ring([...S]);
        for (const j of S) nb.push(j);
        off.push(nb.length);
      }
      NF.off = Int32Array.from(off); NF.nb = Int32Array.from(nb);
      if (!NF.R || NF.R.length !== n * 9) { NF.R = new Float64Array(n * 9); NF.q = new Float64Array(n * 4); for (let i = 0; i < n; i++) { NF.q[i * 4 + 3] = 1; NF.R[i * 9] = NF.R[i * 9 + 4] = NF.R[i * 9 + 8] = 1; } }
      NF.A = new Float64Array(9);
    }
    const A = NF.A, Rn = NF.R;
    for (let i = 0; i < n; i++) {
      const a0 = NF.off[i], a1 = NF.off[i + 1], m = a1 - a0;
      if (m < 2) continue;                               // a node with no live member (debris): it keeps its last turn
      let rx = 0, ry = 0, rz = 0, lx = 0, ly = 0, lz = 0;
      for (let j = a0; j < a1; j++) { const i3 = NF.nb[j] * 3; rx += rest[i3]; ry += rest[i3 + 1]; rz += rest[i3 + 2]; lx += live[i3]; ly += live[i3 + 1]; lz += live[i3 + 2]; }
      rx /= m; ry /= m; rz /= m; lx /= m; ly /= m; lz /= m;
      A.fill(0); let spread = 0;
      for (let j = a0; j < a1; j++) { const i3 = NF.nb[j] * 3;
        const px = live[i3] - lx, py = live[i3 + 1] - ly, pz = live[i3 + 2] - lz, qx = rest[i3] - rx, qy = rest[i3 + 1] - ry, qz = rest[i3 + 2] - rz;
        A[0] += px * qx; A[1] += px * qy; A[2] += px * qz; A[3] += py * qx; A[4] += py * qy; A[5] += py * qz; A[6] += pz * qx; A[7] += pz * qy; A[8] += pz * qz;
        spread += qx * qx + qy * qy + qz * qz; }
      // held to its last turn where the set cannot say (a line of nodes: the turn about it is free): + eps x the last R
      const e = 1e-3 * spread, o9 = i * 9;
      for (let k = 0; k < 9; k++) A[k] += e * Rn[o9 + k];
      polar(A, 0, NF.q, i * 4, Rn, o9);
    }
    return NF;
  }
  // THE BEST ROTATION taking a node set's rest onto its live positions, from A = sum (l - l~)(r - r~)^T (row-major at oa):
  // Horn (1987), "Closed-form solution of absolute orientation using unit quaternions" - the unit quaternion is the
  // eigenvector of the largest eigenvalue of a symmetric 4x4 built from A, found here by cyclic Jacobi (exact in a few
  // sweeps for any set, planar ones included: the wing bays' nodes lie nearly in a plane, and an iterative polar
  // decomposition crawled there - 1e-3 off a 75 degree turn after 80 iterations). Q: the last quaternion (a degenerate
  // set - collinear nodes - keeps the sign it had); Rout at orr
  const _N = new Float64Array(16), _V = new Float64Array(16);
  function polar(A, oa, Q, oq, Rout, orr) {
    // Horn's S = sum r l^T = A^T
    const Sxx = A[oa], Syx = A[oa + 1], Szx = A[oa + 2], Sxy = A[oa + 3], Syy = A[oa + 4], Szy = A[oa + 5], Sxz = A[oa + 6], Syz = A[oa + 7], Szz = A[oa + 8];
    const N = _N, V = _V;
    N[0] = Sxx + Syy + Szz; N[1] = Syz - Szy;        N[2] = Szx - Sxz;         N[3] = Sxy - Syx;
    N[5] = Sxx - Syy - Szz; N[6] = Sxy + Syx;        N[7] = Szx + Sxz;
    N[10] = -Sxx + Syy - Szz; N[11] = Syz + Szy;
    N[15] = -Sxx - Syy + Szz;
    N[4] = N[1]; N[8] = N[2]; N[12] = N[3]; N[9] = N[6]; N[13] = N[7]; N[14] = N[11];
    V.fill(0); V[0] = V[5] = V[10] = V[15] = 1;
    for (let sweep = 0; sweep < 12; sweep++) {
      let off = 0; for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += N[p * 4 + q] * N[p * 4 + q];
      if (off < 1e-30) break;
      for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
        const apq = N[p * 4 + q]; if (Math.abs(apq) < 1e-300) continue;
        const th = (N[q * 4 + q] - N[p * 4 + p]) / (2 * apq);
        const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 4; k++) {               // N <- J^T N J (columns p, q, then rows p, q)
          const akp = N[k * 4 + p], akq = N[k * 4 + q];
          N[k * 4 + p] = c * akp - s * akq; N[k * 4 + q] = s * akp + c * akq;
        }
        for (let k = 0; k < 4; k++) {
          const apk = N[p * 4 + k], aqk = N[q * 4 + k];
          N[p * 4 + k] = c * apk - s * aqk; N[q * 4 + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 4; k++) {
          const vkp = V[k * 4 + p], vkq = V[k * 4 + q];
          V[k * 4 + p] = c * vkp - s * vkq; V[k * 4 + q] = s * vkp + c * vkq;
        }
      }
    }
    let j = 0; for (let k = 1; k < 4; k++) if (N[k * 5] > N[j * 5]) j = k;
    let w = V[j], x = V[4 + j], y = V[8 + j], z = V[12 + j];
    if (w * Q[oq + 3] + x * Q[oq] + y * Q[oq + 1] + z * Q[oq + 2] < 0) { w = -w; x = -x; y = -y; z = -z; }
    const L = Math.hypot(w, x, y, z) || 1; w /= L; x /= L; y /= L; z /= L;
    Q[oq] = x; Q[oq + 1] = y; Q[oq + 2] = z; Q[oq + 3] = w;
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    Rout[orr] = 1 - 2 * (yy + zz); Rout[orr + 1] = 2 * (xy - wz);     Rout[orr + 2] = 2 * (xz + wy);
    Rout[orr + 3] = 2 * (xy + wz);     Rout[orr + 4] = 1 - 2 * (xx + zz); Rout[orr + 5] = 2 * (yz - wx);
    Rout[orr + 6] = 2 * (xz - wy);     Rout[orr + 7] = 2 * (yz + wx);     Rout[orr + 8] = 1 - 2 * (xx + yy);
  }

  // one vertex on its nodes' frames: sum w' l_i + q_v (x - sum w' r_i), q_v the blend of its nodes' turns (their
  // quaternions weighted, on the dominant one's hemisphere, normalised), into a shared triple; x its rest (or hinged)
  // place. The turn acts on the vertex's offset from its nodes' blend (the skin's thickness off the frame), not on its
  // lever to each node: a blend of per-node rotations over a half-bay lever (linear-blend skinning) tore wherever two
  // neighbouring nodes' fits differed by a few degrees - more tears than the cells
  const _o = [0, 0, 0];
  function onNodes(R, v, NF, rest, live, x, y, z) {
    const K = R.K, wi = R.wi, w2 = R.w2, Q = NF.q, o = v * K;
    let lx = 0, ly = 0, lz = 0, rx = 0, ry = 0, rz = 0, qx = 0, qy = 0, qz = 0, qw = 0, d = -1, dw = -Infinity;
    for (let k = 0; k < K; k++) { const w = w2[o + k]; if (w !== 0 && w > dw) { dw = w; d = wi[o + k]; } }
    const dx0 = Q[d * 4], dy0 = Q[d * 4 + 1], dz0 = Q[d * 4 + 2], dw0 = Q[d * 4 + 3];
    for (let k = 0; k < K; k++) { const w = w2[o + k]; if (w === 0) continue; const i = wi[o + k], i3 = i * 3, i4 = i * 4;
      lx += w * live[i3]; ly += w * live[i3 + 1]; lz += w * live[i3 + 2]; rx += w * rest[i3]; ry += w * rest[i3 + 1]; rz += w * rest[i3 + 2];
      const sg = (Q[i4] * dx0 + Q[i4 + 1] * dy0 + Q[i4 + 2] * dz0 + Q[i4 + 3] * dw0) < 0 ? -w : w;
      qx += sg * Q[i4]; qy += sg * Q[i4 + 1]; qz += sg * Q[i4 + 2]; qw += sg * Q[i4 + 3]; }
    const L = Math.hypot(qx, qy, qz, qw) || 1; qx /= L; qy /= L; qz /= L; qw /= L;
    // v' = v + 2 qw (q x v) + 2 q x (q x v)
    const vx = x - rx, vy = y - ry, vz = z - rz;
    const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
    _o[0] = lx + vx + qw * tx + (qy * tz - qz * ty);
    _o[1] = ly + vy + qw * ty + (qz * tx - qx * tz);
    _o[2] = lz + vz + qw * tz + (qx * ty - qy * tx);
    return _o;
  }
  // ---- THE GENERATED SKIN'S POSE over a break (poseSkinGen hands it the group with an active record) ----
  // every vertex rides its nodes' frames (NF: nodeFrames, this frame's); `gain` scales its move off its rest (or its hinged place) as poseSkinGen's does;
  // `hinged` as poseSkinGen; down: gravity in the skin's frame (the drape)
  function poseGen(R, rest, live, base, pos, gain, hinged, NF, down) {
    const nv = R.nv, sag = R.sag;
    for (let v = 0; v < nv; v++) {
      const o3 = v * 3, h = hinged && hinged[v];
      const x = h ? pos[o3] : base[o3], y = h ? pos[o3 + 1] : base[o3 + 1], z = h ? pos[o3 + 2] : base[o3 + 2];
      const q = onNodes(R, v, NF, rest, live, x, y, z);
      let X = x + gain * (q[0] - x), Y = y + gain * (q[1] - y), Z = z + gain * (q[2] - z);
      if (sag && sag[v]) { X += sag[v] * down[0]; Y += sag[v] * down[1]; Z += sag[v] * down[2]; }
      pos[o3] = X; pos[o3 + 1] = Y; pos[o3 + 2] = Z;
    }
  }
  // ---- THE CAGE SNAPSHOT'S POSE over a break, AFTER its own (rigid body frame, spar stations, hinges): only what the
  // break moved - a vertex off the core or at a broken member's end (its nodes' frames), and the drape. base: the
  // group's rest in the model frame; pos: what the page posed this frame, at model - off (a group rebased about its
  // pivot - a control surface - is drawn at its pivot)
  function poseCage(R, rest, live, base, pos, NF, down, off) {
    const { nv } = R, ride = R.ride, sag = R.sag;
    const ox = off ? off[0] : 0, oy = off ? off[1] : 0, oz = off ? off[2] : 0;
    for (let v = 0; v < nv; v++) {
      const o3 = v * 3;
      if (ride[v]) {
        const q = onNodes(R, v, NF, rest, live, base[o3], base[o3 + 1], base[o3 + 2]);
        pos[o3] = q[0] - ox; pos[o3 + 1] = q[1] - oy; pos[o3 + 2] = q[2] - oz;
      }
      if (sag && sag[v]) { pos[o3] += sag[v] * down[0]; pos[o3 + 1] += sag[v] * down[1]; pos[o3 + 2] += sag[v] * down[2]; }
    }
  }
  // ---- THE TEAR: a watched triangle past TEAR over its rest edge is torn for good. Returns the triangles torn now ----
  function tear(R, base, pos) {
    if (!R.watch) return 0;
    const i0 = R.idx0, idx = R.idx, dead = R.dead, W = R.watch;
    let n = 0;
    for (let j = 0; j < W.length; j++) {
      const t = W[j]; if (dead[t]) continue;
      const a = i0[t * 3] * 3, b = i0[t * 3 + 1] * 3, c = i0[t * 3 + 2] * 3;
      if (over(pos, base, a, b) || over(pos, base, b, c) || over(pos, base, a, c)) {
        dead[t] = 2; idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = i0[t * 3]; n++;
      }
    }
    R.torn += n; R.removed += n;
    return n;
  }
  function over(pos, base, a, b) {
    const l = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]);
    const r = Math.hypot(base[a] - base[b], base[a + 1] - base[b + 1], base[a + 2] - base[b + 2]);
    return !(l <= (1 + TEAR) * r + TEAR_ABS);          // (a NaN edge is torn too)
  }
  // the gate's measure over every live triangle of a group: the worst edge past its bound (m: l - (1 + TEAR) r - TEAR_ABS,
  // <= 0 everywhere when the skin holds), and the worst stretch l / r among edges of 2 cm or more
  function worstStretch(R, base, pos) {
    const i0 = R.idx0 || R.idx, dead = R.dead; let ex = -Infinity, m = 0, at = -1;
    for (let t = 0; t < R.nt; t++) {
      if (dead && dead[t]) continue;
      for (let e = 0; e < 3; e++) {
        const a = i0[t * 3 + e] * 3, b = i0[t * 3 + (e + 1) % 3] * 3;
        const r = Math.hypot(base[a] - base[b], base[a + 1] - base[b + 1], base[a + 2] - base[b + 2]);
        const l = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]);
        if (l !== l) return { ex: Infinity, m: Infinity, t };
        const x = l - (1 + TEAR) * r - TEAR_ABS;
        if (x > ex) { ex = x; at = t; }
        if (r >= 0.02 && l / r > m) m = l / r;
      }
    }
    return { ex, m, t: at };
  }
  const API = { TEAR, TEAR_ABS, DRAPE_K, WRINKLE_L, WRINKLE_A, NEAR_K, topo, brokenPairs, bindNearest, make, event, nodeFrames, polar, poseGen, poseCage, tear, worstStretch };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SKIN_BREAK = API;
})();
