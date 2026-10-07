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

  // ---- G1864 (DMG-D4b): THE SNAPSHOT'S OWN VERTICES. The cage snapshot is unwelded - three vertices a triangle, each
  // place repeated by every triangle meeting there (about six on a smooth skin) - so the wreck's work a vertex (the
  // binding, the event, the riding) is done once a PLACE and copied: rep[v] the first vertex at v's place (v itself if
  // it is the first; always <= v). Exact equality: the copies are the same numbers through the same arithmetic
  function dupOf(pos, nv) {
    const rep = new Int32Array(nv), cap = 1 << Math.ceil(Math.log2(nv * 2 + 2)), tab = new Int32Array(cap).fill(-1), m = cap - 1;
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      let h = (Math.imul(Math.round(x * 1e5) | 0, 73856093) ^ Math.imul(Math.round(y * 1e5) | 0, 19349663) ^ Math.imul(Math.round(z * 1e5) | 0, 83492791)) & m;
      for (;;) {
        const u = tab[h];
        if (u < 0) { tab[h] = v; rep[v] = v; break; }
        if (pos[u * 3] === x && pos[u * 3 + 1] === y && pos[u * 3 + 2] === z) { rep[v] = u; break; }
        h = (h + 1) & m;
      }
    }
    return rep;
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
  function bindNearest(pos, nv, nodeRest, nNode, K, mask, into, rep) {
    K = K || NEAR_K;
    // (G1864: rep - each place bound once, its copies after: the masked vertices' first vertices are the ones solved)
    if (rep) { const m2 = new Uint8Array(nv); for (let v = 0; v < nv; v++) if (!mask || mask[v]) m2[rep[v]] = 1;
      const r = bindNearest(pos, nv, nodeRest, nNode, K, m2, into, null);
      for (let v = 0; v < nv; v++) { const u = rep[v]; if (u === v || (mask && !mask[v])) continue;
        for (let k = 0; k < K; k++) { r.wi[v * K + k] = r.wi[u * K + k]; r.ww[v * K + k] = r.ww[u * K + k]; } }
      return r; }
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
      g.rep = o.weld ? dupOf(o.pos, g.nv) : null;
      const near = bindNearest(o.pos, g.nv, o.rest, o.rest.length / 3, 1, null, null, g.rep).wi;
      g.wi = new Int32Array(g.nv * K); g.ww = new Float32Array(g.nv * K);
      for (let v = 0; v < g.nv; v++) { for (let k = 0; k < K; k++) g.wi[v * K + k] = near[v]; g.ww[v * K] = 1; }
      g.near = near; g.bound = new Uint8Array(g.nv); g.pos = o.pos; g.rest = o.rest;
    }
    return { g, nv: g.nv, K, wi: g.wi, ww: g.ww, idx: g.idx, idx0: null, nt: (g.idx.length / 3) | 0,
             vB: -1, vp: null, dom: null, w2: null, ride: null, dead: null, watch: null, sag: null, torn: 0, removed: 0,
             fabric: !!(o && o.fabric), cage: !!(o && o.cage), active: false,
             // G1864 (the page's wreck): rideAll - every vertex rides its nodes' frames once anything is broken (in the
             // world frame, exact under a rigid motion: a part bent without a member broken no longer keeps the cage's
             // rigid pose and stretches); its full binding made `budget` places a frame (pending: those still on their
             // nearest node, riding it meanwhile)
             rideAll: !!(o && o.rideAll), rep: g.rep || null, pending: null, BP: null, pc: null };
  }
  const slotOf = (wi, o, K, d) => { for (let k = 0; k < K; k++) if (wi[o + k] === d) return k; return 0; };
  // one vertex at an event (or once its binding came, G1864): its piece, its dominant node, its kept weights, whether it
  // rides - a copy (rep) takes its first vertex's
  let _pw = new Float64Array(8);
  function prepV(R, v, BP, pc) {
    const K = R.K, wi = R.wi, ww = R.ww, vp = R.vp, dom = R.dom, w2 = R.w2, ride = R.ride, o = v * K;
    const u = R.rep ? R.rep[v] : v;
    // (G1818: a copy's kept weights are never read - its place's are: it is posed, torn and sent as its first vertex)
    if (u !== v) { vp[v] = vp[u]; dom[v] = dom[u]; ride[v] = ride[u]; return; }
    // 1. the piece holding most of its weight
    let P = 0;
    if (pc) { let nP = 1; for (let k = 0; k < K; k++) { const q = pc[wi[o + k]] + 1; if (q > nP) nP = q; }
      if (_pw.length < nP) _pw = new Float64Array(nP * 2);
      for (let q = 0; q < nP; q++) _pw[q] = 0;
      for (let k = 0; k < K; k++) { const w = ww[o + k]; if (w !== 0) _pw[pc[wi[o + k]]] += w; }
      let best = -Infinity; for (let q = 0; q < nP; q++) if (_pw[q] > best) { best = _pw[q]; P = q; } }
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
    // does it ride its nodes' frames (the cage: a vertex on a detached piece, or at a broken member's end - or, rideAll,
    // every one; the rest keep the cage's own pose)
    let end = false; for (let k = 0; k < K && !end; k++) if (ww[o + k] !== 0 && BP.ends[wi[o + k]]) end = true;
    ride[v] = !R.cage || R.rideAll || P !== 0 || end ? 1 : 0;
  }
  // the full binding for these places (first vertices), and their copies (G1864)
  function bindSome(R, T, list) {
    if (!list.length) return;
    const nv = R.nv, mask = new Uint8Array(nv);
    for (const v of list) mask[v] = 1;
    bindNearest(R.g.pos, nv, R.g.rest, T.n, R.K, mask, R.g, null);
    for (const v of list) R.g.bound[v] = 1;
    if (R.rep) { const rp = R.rep, K = R.K; for (let v = 0; v < nv; v++) { const u = rp[v]; if (u !== v && mask[u]) {
      R.g.bound[v] = 1; for (let k = 0; k < K; k++) { R.wi[v * K + k] = R.wi[u * K + k]; R.ww[v * K + k] = R.ww[u * K + k]; } } } }
  }
  // MORE OF THE BINDING, between events (G1864): up to `budget` places from `pending`, then their prep at the last event's
  // pieces. Returns the places bound
  function bindMore(R, T, budget) {
    if (!R.pending || !(budget > 0) || !R.BP) return 0;
    const take = Math.min(budget, R.pending.length), now = R.pending.subarray(0, take);
    bindSome(R, T, now);
    if (R.nodeMask) { const K = R.K, wi = R.wi, M = R.nodeMask; for (const v of now) for (let k = 0; k < K; k++) M[wi[v * K + k]] = 1; }
    // (G1818: these places are stale on the GPU - listed, unless the whole record already is)
    if (R.pl && R.dv === R.dvUp) { const L = R.dirtyPl || (R.dirtyPl = []); for (const v of now) L.push(R.plOf[v]); }
    const nv = R.nv, rp = R.rep, done = new Uint8Array(nv); for (const v of now) done[v] = 1;
    if (rp) { const vp = R.vp, dom = R.dom, ride = R.ride;          // (G1818: once a place, its copies' bytes after)
      for (const v of now) prepV(R, v, R.BP, R.pc);
      for (let v = 0; v < nv; v++) { const u = rp[v]; if (u !== v && done[u]) { vp[v] = vp[u]; dom[v] = dom[u]; ride[v] = ride[u]; } } }
    else for (let v = 0; v < nv; v++) if (done[v]) prepV(R, v, R.BP, R.pc);
    R.pending = take < R.pending.length ? R.pending.slice(take) : null;
    return take;
  }
  // THE EVENT: the damage state moved (D.vB). Returns true when the index changed
  function event(R, T, D, rest, base, budget) {
    if (R.vB === D.vB) return false;
    // G1818: AN EVENT FAR FROM THE RECORD changes nothing in it. What the event makes of a record reads, of its own nodes
    // (every node a slot of its binding names, R.nodeMask): their pieces (D.pc), the broken pairs and broken members'
    // ends among them, and - for the binding's order - which of them lie at a break (an end of a broken member or one live
    // member from one). The broken list only grows within a crash: if no member broken since the record's last full event
    // has an end or a neighbour among its nodes, and none of its nodes changed piece, the event would rebuild the same
    // record - it is skipped (a crash breaks a few members at a time; a wreck's ~100 records each re-made at every one of
    // them was ~35-55 ms a break event on the box)
    // (and only while its binding is the one its last event read: a binding rewritten since - DMG-WALL's bindInherit /
    // wallSync bump R.dv - is re-made whole)
    const dvIn = R.dv | 0;
    if (R.active && R.evPc && R.nodeMask && D.br.length >= R.evBr && D.br.length && !R.fullNext && dvIn === R.evDv) {
      const M = R.nodeMask, pc = D.pc, n = M.length; let touched = false;
      for (let k = R.evBr; k < D.br.length && !touched; k++) { const b = T.beams[D.br[k]]; if (!b) continue;
        for (const i of [b.a, b.b]) { if (M[i]) { touched = true; break; }
          for (const bj of T.adj[i]) { const c = T.beams[bj]; if (M[c.a] || M[c.b]) { touched = true; break; } } if (touched) break; } }
      if (!touched) for (let i = 0; i < n; i++) if (M[i] && (pc ? pc[i] : 0) !== R.evPc[i]) { touched = true; break; }
      if (!touched) { R.vB = D.vB; R.evBr = D.br.length; R.lastBound = 0; R.skipped = (R.skipped | 0) + 1; return false; }
    }
    R.vB = D.vB;
    R.dv = (R.dv | 0) + 1; R.dirtyPl = null;         // (G1818: the GPU's copy of the record is stale, whole)
    const { nv, K, wi, ww } = R, idx = R.idx;
    if (!D.br.length) {                        // healed (a reset): the index as built, nothing held
      if (R.idx0) idx.set(R.idx0);
      R.active = false; R.vp = R.dom = R.w2 = R.ride = R.dead = R.watch = R.sag = null; R.torn = R.removed = R.cut = 0;
      R.evPc = R.nodeMask = null; R.evBr = 0;
      return !!R.idx0;
    }
    if (!R.idx0) R.idx0 = idx.slice();
    const BP = brokenPairs(T, D), pc = D.pc;
    // a cage record: the full binding for the vertices at the break (their nearest node an end of a broken member, or one
    // live member from one) or off the core, the ones not bound before
    // (G1818: walked once a place - a copy is bound with its place, and only places are bound or listed - and not at all
    // once every place is bound: R.boundAll)
    if (R.g.near && !R.boundAll) {
      const zone = new Uint8Array(T.n);
      for (const bi of D.br) { const b = T.beams[bi]; if (!b) continue;
        for (const i of [b.a, b.b]) { zone[i] = 1; for (const bj of T.adj[i]) { const c = T.beams[bj]; zone[c.a] = zone[c.b] = 1; } } }
      const near = R.g.near, bound = R.g.bound, rp = R.rep, pl = rp ? placesOf(R).pl : null, np = pl ? pl.length : nv;
      let any = false, open = 0;
      const first = [], rest2 = [];
      for (let j = 0; j < np; j++) { const v = pl ? pl[j] : j; if (bound[v]) continue; open++;
        const i = near[v];
        if (zone[i] || (pc && pc[i] !== 0)) { first.push(v); any = true; }
        // (G1864: a budget of places a frame - the break's zone first; the rest wait in `pending`, riding their nearest
        // node meanwhile; rideAll: every place is owed its binding)
        else if (R.rideAll) rest2.push(v); }
      if (any || R.rideAll) {
        const order = first.concat(rest2), take = budget == null ? order.length : Math.min(order.length, Math.max(0, budget));
        R.pending = take < order.length ? Int32Array.from(order.slice(take)) : null;
        const now = Int32Array.from(order.slice(0, take));
        bindSome(R, T, now); R.lastBound = take; R._evBound = now;
      }
      if (!open && R.rideAll) R.boundAll = true;
    }
    // G1818: THE LOCAL EVENT. After a full one, an event re-makes only what it can change: a place is re-prepared when a
    // node of its binding is TOUCHED - an end of a member broken since, a neighbour of one, or a node whose piece changed
    // - or the event has just bound it; a triangle is re-tested when one of its vertices was; a fabric place re-draped
    // likewise. Everything else would come out bit for bit as it stands (prepV, the triangle test and the drape read only
    // those nodes' pieces, broken pairs and broken ends), so it is left as it stands
    const loc = !!(R.vp && R.evPc && R.nodeMask && R.active && D.br.length >= R.evBr && !R.fullNext && dvIn === R.evDv);
    const vp = R.vp || (R.vp = new Int32Array(nv)), dom = R.dom || (R.dom = new Int32Array(nv));
    const w2 = R.w2 || (R.w2 = new Float32Array(nv * K)), ride = R.ride || (R.ride = new Uint8Array(nv));
    let chg = null;
    if (loc) {
      const n = T.n, Tm = new Uint8Array(n);
      for (let k = R.evBr; k < D.br.length; k++) { const b = T.beams[D.br[k]]; if (!b) continue;
        for (const i of [b.a, b.b]) { Tm[i] = 1; for (const bj of T.adj[i]) { const c = T.beams[bj]; Tm[c.a] = Tm[c.b] = 1; } } }
      for (let i = 0; i < n; i++) if ((pc ? pc[i] : 0) !== R.evPc[i]) Tm[i] = 1;
      chg = R._chg && R._chg.length === nv ? R._chg : (R._chg = new Uint8Array(nv));
      chg.fill(0);
      if (R._evBound) for (const v of R._evBound) chg[v] = 1;
      const list = R.rep ? placesOf(R).pl : null, np = list ? list.length : nv;
      for (let j = 0; j < np; j++) { const v = list ? list[j] : j, o = v * K;
        if (!chg[v]) for (let k = 0; k < K; k++) if (Tm[wi[o + k]]) { chg[v] = 1; break; } }
    }
    R._evBound = null;
    R.BP = BP; R.pc = pc;
    // (G1818: a welded record is prepared once a place, its copies given their place's piece, dominant node and ride -
    // the same bytes prepV's copy branch wrote, without a call a vertex: ~500k vertices, ~85k places on the user's Cub)
    if (R.rep) { placesOf(R); const pl = R.pl, rp = R.rep;
      for (let j = 0; j < pl.length; j++) if (!chg || chg[pl[j]]) prepV(R, pl[j], BP, pc);
      for (let v = 0; v < nv; v++) { const u = rp[v]; if (u !== v && (!chg || chg[u])) { vp[v] = vp[u]; dom[v] = dom[u]; ride[v] = ride[u]; if (chg) chg[v] = 1; } } }
    else for (let v = 0; v < nv; v++) if (!chg || chg[v]) prepV(R, v, BP, pc);
    // 3. the triangles: on one piece, and not across a broken member
    const i0 = R.idx0, nt = R.nt, dead = R.dead || (R.dead = new Uint8Array(nt));
    const watch = R._watchBuf && R._watchBuf.length === nt ? R._watchBuf : (R._watchBuf = new Int32Array(nt));
    let removed = 0, nw = 0;
    // (G1818: a pair is broken only between two ends of broken members - BP.ends, a byte - so the set is asked only then)
    const E = BP.ends, brk = (x, y) => E[x] === 1 && E[y] === 1 && BP.has(x, y);
    for (let t = 0; t < nt; t++) {
      const a = i0[t * 3], b = i0[t * 3 + 1], c = i0[t * 3 + 2];
      let gone = dead[t] >= 2;                   // torn by stretch earlier (or cut off the wall, G1858; gone with its covering, G1856): stays gone
      if (!gone && chg && !chg[a] && !chg[b] && !chg[c]) gone = dead[t] === 1;   // (G1818: untouched: as it stands)
      else if (!gone) {
        const da = dom[a], db = dom[b], dc = dom[c];
        gone = vp[a] !== vp[b] || vp[b] !== vp[c] || brk(da, db) || brk(db, dc) || brk(da, dc);
        dead[t] = gone ? 1 : 0;
      }
      if (gone) { idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = a; removed++; continue; }
      idx[t * 3] = a; idx[t * 3 + 1] = b; idx[t * 3 + 2] = c;
      // watched for the tear: a triangle with a vertex that rides its nodes (every one of the generated skin's; the
      // cage's off the core or at the break - the rest is rigid on the body)
      if (ride[a] || ride[b] || ride[c]) watch[nw++] = t;
    }
    R.watch = watch.slice(0, nw); R.removed = removed; R.active = true;
    // G1852: the drape - a fabric skin's vertices the broken members carried
    // (G1818: a local event re-drapes its changed places on the sag as it stood)
    const sag0 = R.sag;
    R.sag = null;
    if (R.fabric && rest && base) {
      const at = new Map();
      for (const bi of D.br) { const b = T.beams[bi]; if (!b) continue;
        for (const i of [b.a, b.b]) { const L = at.get(i); if (L) L.push(bi); else at.set(i, [bi]); } }
      const sag = chg && sag0 ? sag0 : new Float32Array(nv);
      let any = !!(chg && sag0);
      const rp = R.rep;
      for (let v = 0; v < nv; v++) {
        if (chg && !chg[v]) continue;
        if (rp && rp[v] !== v) { sag[v] = sag[rp[v]]; continue; }
        if (chg) sag[v] = 0;
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
    // (G1818: what the next event compares - this one's pieces and broken count, and the record's nodes)
    { const n = T.n, M = R.nodeMask && R.nodeMask.length === n ? R.nodeMask : (R.nodeMask = new Uint8Array(n));
      M.fill(0);
      if (R.rep) { const pl = placesOf(R).pl; for (let j = 0; j < pl.length; j++) { const o = pl[j] * K; for (let k = 0; k < K; k++) M[wi[o + k]] = 1; } }
      else for (let k = 0; k < wi.length; k++) M[wi[k]] = 1;
      const E = R.evPc && R.evPc.length === n ? R.evPc : (R.evPc = new Int32Array(n));
      for (let i = 0; i < n; i++) E[i] = pc ? pc[i] : 0;
      R.evBr = D.br.length; R.evDv = R.dv | 0; }
    return true;
  }

  // ---- THE NODES' FRAMES (per frame, shared by every group): node i's rotation from its rest neighbourhood to its live
  // one. NF: { vB, off, nb (the neighbourhoods, rebuilt at each event), R (9 a node), q (4 a node: the last turn) }
  // init (G1867.1, the page's world-frame riding): a node whose live set cannot say its turn (nodes in a line - a spar's) is
  // held to its last one, which starts at the identity: right in the body's frame (the gate's), wrong by the aeroplane's
  // whole attitude in the world's - the chord-wise skin swung about the spar line and tore (a 3 m/s taxi shredded both
  // wings on the box). With init every node's turn starts at the aeroplane's own: one Horn fit of all its nodes
  function nodeFrames(NF, T, D, rest, live, init) {
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
      if (!NF.R || NF.R.length !== n * 9) { NF.R = new Float64Array(n * 9); NF.q = new Float64Array(n * 4); for (let i = 0; i < n; i++) { NF.q[i * 4 + 3] = 1; NF.R[i * 9] = NF.R[i * 9 + 4] = NF.R[i * 9 + 8] = 1; }
        if (init) {
          let rx = 0, ry = 0, rz = 0, lx = 0, ly = 0, lz = 0;
          for (let i = 0; i < n; i++) { rx += rest[i * 3]; ry += rest[i * 3 + 1]; rz += rest[i * 3 + 2]; lx += live[i * 3]; ly += live[i * 3 + 1]; lz += live[i * 3 + 2]; }
          rx /= n; ry /= n; rz /= n; lx /= n; ly /= n; lz /= n;
          const G = new Float64Array(9);
          for (let i = 0; i < n; i++) { const px = live[i * 3] - lx, py = live[i * 3 + 1] - ly, pz = live[i * 3 + 2] - lz, qx = rest[i * 3] - rx, qy = rest[i * 3 + 1] - ry, qz = rest[i * 3 + 2] - rz;
            G[0] += px * qx; G[1] += px * qy; G[2] += px * qz; G[3] += py * qx; G[4] += py * qy; G[5] += py * qz; G[6] += pz * qx; G[7] += pz * qy; G[8] += pz * qz; }
          const q0 = new Float64Array([0, 0, 0, 1]), R0 = new Float64Array(9);
          polar(G, 0, q0, 0, R0, 0);
          for (let i = 0; i < n; i++) { NF.q.set(q0, i * 4); NF.R.set(R0, i * 9); }
        } }
      NF.A = new Float64Array(9);
    }
    const A = NF.A, Rn = NF.R;
    // (init: the prior a node is held to where its set cannot say is its PIECE's rigid turn this frame - the aeroplane's
    // own, or the part's that came off - not its last turn, which a tumbling wreck leaves behind)
    let PR = null;
    if (init) {
      const nP = pc ? Math.max(1, D.nPc || 1) : 1, S = new Float64Array(nP * 6), cnt = new Int32Array(nP);
      for (let i = 0; i < n; i++) { const k = pc ? pc[i] : 0; cnt[k]++; for (let j = 0; j < 3; j++) { S[k * 6 + j] += rest[i * 3 + j]; S[k * 6 + 3 + j] += live[i * 3 + j]; } }
      const G = new Float64Array(nP * 9);
      for (let i = 0; i < n; i++) { const k = pc ? pc[i] : 0, c = cnt[k], o = k * 6;
        const px = live[i * 3] - S[o + 3] / c, py = live[i * 3 + 1] - S[o + 4] / c, pz = live[i * 3 + 2] - S[o + 5] / c, qx = rest[i * 3] - S[o] / c, qy = rest[i * 3 + 1] - S[o + 1] / c, qz = rest[i * 3 + 2] - S[o + 2] / c, g = k * 9;
        G[g] += px * qx; G[g + 1] += px * qy; G[g + 2] += px * qz; G[g + 3] += py * qx; G[g + 4] += py * qy; G[g + 5] += py * qz; G[g + 6] += pz * qx; G[g + 7] += pz * qy; G[g + 8] += pz * qz; }
      PR = NF.PR && NF.PR.length === nP * 9 ? NF.PR : (NF.PR = new Float64Array(nP * 9)); const PQ = NF.PQ && NF.PQ.length === nP * 4 ? NF.PQ : (NF.PQ = new Float64Array(nP * 4));
      for (let k = 0; k < nP; k++) { if (cnt[k] >= 3) polar(G, k * 9, PQ, k * 4, PR, k * 9); else { PR.set(Rn.subarray(0, 9), k * 9); } }
    }
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
      const e = 1e-3 * spread, o9 = i * 9, Pr = PR, p9 = PR ? (pc ? pc[i] : 0) * 9 : 0;
      if (Pr) for (let k = 0; k < 9; k++) A[k] += e * Pr[p9 + k];
      else for (let k = 0; k < 9; k++) A[k] += e * Rn[o9 + k];
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
  const _o = [0, 0, 0], _q = [0, 0, 0, 1];   // (_q: the vertex's own blended turn, for its normal - G1864)
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
    _q[0] = qx; _q[1] = qy; _q[2] = qz; _q[3] = qw;
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
  // X (G1864, DMG-D4b - the page's): THE RIDING IN THE WORLD. The cage is drawn through the body's OBLIQUE basis
  // (xA, yU, xA x yU: 85.6 degrees apart on the user's Cub as built), and a wreck can turn it to anything - 165 degrees
  // measured on a broken-up Cub at a trunk, where the body's refs lie on different pieces: fitted in that frame, each
  // node's "rotation" was a shear and every riding triangle tore (110k of 167k removed). With X the nodes' frames are
  // the world's (rest: the frame's own coordinates, live: the sim's), base is the group's rest in the frame's
  // coordinates (R.baseD), and each vertex's world place goes to X.w (the tear reads true lengths there) and its drawn
  // place to Mi (world - cg) - o - off; X.n / X.nB (the normals, drawn and as built in the frame's coordinates): a riding
  // vertex's normal turns with it (a wing folded 90 degrees no longer shines like a mirror under its rest normals);
  // X.B the basis (columns xA, yU, zL) for the vertices that keep the cage's own pose. Without X: as before (the gate's)
  // a normal (frame coordinates) turned by q and drawn through the basis's transpose
  function turnN(q, nx, ny, nz, B, N, o3) {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const tx = 2 * (qy * nz - qz * ny), ty = 2 * (qz * nx - qx * nz), tz = 2 * (qx * ny - qy * nx);
    const ax = nx + qw * tx + (qy * tz - qz * ty), ay = ny + qw * ty + (qz * tx - qx * tz), az = nz + qw * tz + (qx * ty - qy * tx);
    const bx = B[0] * ax + B[3] * ay + B[6] * az, by = B[1] * ax + B[4] * ay + B[7] * az, bz = B[2] * ax + B[5] * ay + B[8] * az, bl = Math.hypot(bx, by, bz) || 1;
    N[o3] = bx / bl; N[o3 + 1] = by / bl; N[o3 + 2] = bz / bl;
  }
  let _qv = new Float64Array(0);                         // (each first vertex's turn, this pose: its copies' normals)
  function poseCage(R, rest, live, base, pos, NF, down, off, X) {
    const { nv } = R, ride = R.ride, sag = R.sag;
    const ox = off ? off[0] : 0, oy = off ? off[1] : 0, oz = off ? off[2] : 0;
    if (!X) {
      for (let v = 0; v < nv; v++) {
        const o3 = v * 3;
        if (ride[v]) {
          const q = onNodes(R, v, NF, rest, live, base[o3], base[o3 + 1], base[o3 + 2]);
          pos[o3] = q[0] - ox; pos[o3 + 1] = q[1] - oy; pos[o3 + 2] = q[2] - oz;
        }
        if (sag && sag[v]) { pos[o3] += sag[v] * down[0]; pos[o3 + 1] += sag[v] * down[1]; pos[o3 + 2] += sag[v] * down[2]; }
      }
      return;
    }
    const Mi = X.Mi, B = X.B, cg = X.cg, o = X.o, W = X.w, N = X.n, NB = X.nB, rp = R.rep;
    if (rp && N && NB && _qv.length < nv * 4) _qv = new Float64Array(nv * 4);
    const QV = rp && N && NB ? _qv : null;
    const px = o[0] + ox, py = o[1] + oy, pz = o[2] + oz;
    for (let v = 0; v < nv; v++) {
      const o3 = v * 3;
      if (rp && ride[v]) { const u = rp[v]; if (u !== v) { const u3 = u * 3;   // (a copy of a place already posed)
        pos[o3] = pos[u3]; pos[o3 + 1] = pos[u3 + 1]; pos[o3 + 2] = pos[u3 + 2]; W[o3] = W[u3]; W[o3 + 1] = W[u3 + 1]; W[o3 + 2] = W[u3 + 2];
        if (N && NB) { const a = NB[o3], b = NB[o3 + 1], c = NB[o3 + 2];
          if (a === NB[u3] && b === NB[u3 + 1] && c === NB[u3 + 2]) { N[o3] = N[u3]; N[o3 + 1] = N[u3 + 1]; N[o3 + 2] = N[u3 + 2]; }
          else if (QV) turnN(QV.subarray(u * 4, u * 4 + 4), a, b, c, B, N, o3); }
        continue; } }
      let wx, wy, wz;
      if (ride[v]) {
        const q = onNodes(R, v, NF, rest, live, base[o3], base[o3 + 1], base[o3 + 2]);
        wx = q[0]; wy = q[1]; wz = q[2];
        if (N && NB) {                                   // the normal turned by the vertex's own turn, drawn: B^T n
          turnN(_q, NB[o3], NB[o3 + 1], NB[o3 + 2], B, N, o3);
          if (QV) { QV[v * 4] = _q[0]; QV[v * 4 + 1] = _q[1]; QV[v * 4 + 2] = _q[2]; QV[v * 4 + 3] = _q[3]; }
        }
      } else {                                           // the cage's own pose, into the world
        const a = pos[o3] + px, b = pos[o3 + 1] + py, c = pos[o3 + 2] + pz;
        wx = cg[0] + B[0] * a + B[1] * b + B[2] * c; wy = cg[1] + B[3] * a + B[4] * b + B[5] * c; wz = cg[2] + B[6] * a + B[7] * b + B[8] * c;
      }
      if (sag && sag[v]) { wx += sag[v] * down[0]; wy += sag[v] * down[1]; wz += sag[v] * down[2]; }
      W[o3] = wx; W[o3 + 1] = wy; W[o3 + 2] = wz;
      if (ride[v] || (sag && sag[v])) {
        const dx = wx - cg[0], dy = wy - cg[1], dz = wz - cg[2];
        pos[o3] = Mi[0] * dx + Mi[1] * dy + Mi[2] * dz - px; pos[o3 + 1] = Mi[3] * dx + Mi[4] * dy + Mi[5] * dz - py; pos[o3 + 2] = Mi[6] * dx + Mi[7] * dy + Mi[8] * dz - pz;
      }
    }
  }
  // ---- THE TEAR: a watched triangle past TEAR over its rest edge is torn for good. Returns the triangles torn now ----
  function tear(R, base, pos) {
    if (!R.watch || (R.noTear && !R.tubeTear && !R.sheetTear)) return 0;                  // (G1859: a tube, a rigid part, sheet metal - never cut to confetti)
    const i0 = R.idx0, idx = R.idx, dead = R.dead, W = R.watch;
    let n = 0;
    for (let j = 0; j < W.length; j++) {
      const t = W[j]; if (dead[t]) continue;
      const a = i0[t * 3] * 3, b = i0[t * 3 + 1] * 3, c = i0[t * 3 + 2] * 3;
      if (over(pos, base, a, b, R) || over(pos, base, b, c, R) || over(pos, base, a, c, R)) {
        dead[t] = 2; idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = i0[t * 3]; n++;
      }
    }
    R.torn += n; R.removed += n;
    return n;
  }
  // ---- G1864 (DMG-D4b): THE CONFETTI. The tear leaves islands - a few triangles of covering riding a loose node, metres
  // from the wreck - that read as paper scraps on the box. A piece of live skin (triangles joined by their places, rep)
  // that TOUCHES the tear or the break (shares a place with a removed triangle) and has fewer than `min` triangles goes
  // with it (dead 2, for good); a small piece the wreck never touched (a fitting, a bolt head) is not asked. Returns the
  // triangles removed. Page-only (app.js brkCage, after a tear, at most every 0.25 s)
  function islands(R, min) {
    if (!R.dead || !R.idx0) return 0;
    const i0 = R.idx0, nt = R.nt, dead = R.dead, rp = R.rep, nv = R.nv, idx = R.idx;
    const P = new Int32Array(nv); for (let v = 0; v < nv; v++) P[v] = v;
    const f = x => { while (P[x] !== x) { P[x] = P[P[x]]; x = P[x]; } return x; };
    const at = v => rp ? rp[v] : v;
    const cut = new Uint8Array(nv);
    for (let t = 0; t < nt; t++) {
      const a = at(i0[t * 3]), b = at(i0[t * 3 + 1]), c = at(i0[t * 3 + 2]);
      if (dead[t]) { cut[a] = cut[b] = cut[c] = 1; continue; }
      let x = f(a), y = f(b); if (x !== y) P[x] = y;
      x = f(b); y = f(c); if (x !== y) P[x] = y;
    }
    const size = new Int32Array(nv), touched = new Uint8Array(nv);
    for (let t = 0; t < nt; t++) { if (dead[t]) continue; const a = at(i0[t * 3]), r = f(a); size[r]++;
      if (cut[a] || cut[at(i0[t * 3 + 1])] || cut[at(i0[t * 3 + 2])]) touched[r] = 1; }
    let n = 0;
    for (let t = 0; t < nt; t++) {
      if (dead[t]) continue;
      const r = f(at(i0[t * 3]));
      if (touched[r] && size[r] < min) { dead[t] = 2; idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = i0[t * 3]; n++; }
    }
    R.removed += n; R.torn += n;
    return n;
  }
  // ---- G1818 (DMG-SKINGPU): THE RIDING ON THE GPU - the data, the shader's mirror, the tear without the CPU riding ----
  // The page rides a broken aeroplane's cage on the GPU (skin_gpu.js: a transform feedback over the buffers the folds
  // draw). A vertex is drawn from its PLACE (the weld's first vertex, rep): packed at an event or a binding step, never
  // per frame, into five RGBA float texels a place - A: its offset off its kept nodes' blend in the frame's rest,
  // e = base - sum w' r, and its drape's sag; W0 / W1: its kept weights in GPU_K = 8 slots, the DOMINANT node's first
  // (onNodes' sign reference); I0 / I1: those slots' nodes. A binding wider than 8 (DMG-WALL's inherited ones may be)
  // keeps the dominant and the next 7 by weight, renormalised (with e made from those): exact at K <= 8, which the
  // page's bindings are (NEAR_K = 4). Per frame only the nodes go up (each its live place less the frame's origin, and
  // its turn NF.q). rideMirror is RIDE_VS (skin_gpu.js) line for line, in JS: what GATE DMGSKINGPU holds against
  // onNodes / poseCage, and what the box's readback holds the GPU's own against.
  const GPU_W = 2048;                                    // the place textures' width (WebGL2 guarantees 2048)
  const GPU_K = 8;                                       // the GPU's slots a place (the coordinator's cap, with DMG-WALL)
  // a record's places: pl (each place's first vertex), plOf (each vertex's place)
  function placesOf(R) {
    if (R.pl) return R;
    const nv = R.nv, rp = R.rep, plOf = new Int32Array(nv); let n = 0;
    for (let v = 0; v < nv; v++) { const u = rp ? rp[v] : v; plOf[v] = u === v ? n++ : plOf[u]; }
    const pl = new Int32Array(n); for (let v = 0; v < nv; v++) if (!rp || rp[v] === v) pl[plOf[v]] = v;
    R.pl = pl; R.plOf = plOf;
    return R;
  }
  // the place textures' CPU side for `rows` rows: { PA, PW0, PW1, PI0, PI1 } (4 floats a texel)
  const placeArrays = rows => { const n = rows * GPU_W * 4; return { PA: new Float32Array(n), PW0: new Float32Array(n), PW1: new Float32Array(n), PI0: new Float32Array(n), PI1: new Float32Array(n) }; };
  // places [from, to) of R into the arrays at p0 + j. base: the record's rest in the frame of `rest`. Returns the places
  // whose binding was wider than GPU_K (pruned)
  const _sl = new Int32Array(64), _sw = new Float64Array(64);
  function packPlaces(R, rest, base, TX, p0, from, to) {
    placesOf(R);
    const K = R.K, wi = R.wi, w2 = R.w2, pl = R.pl, sag = R.sag, PA = TX.PA, W0 = TX.PW0, W1 = TX.PW1, I0 = TX.PI0, I1 = TX.PI1;
    if (from == null) from = 0; if (to == null) to = pl.length;
    let pruned = 0;
    for (let j = from; j < to; j++) {
      const v = pl[j], o = v * K, t = (p0 + j) * 4;
      let d = -1, dw = -Infinity;                        // onNodes' dominant: the first strict maximum among the kept
      for (let k = 0; k < K; k++) { const w = w2[o + k]; if (w !== 0 && w > dw) { dw = w; d = k; } }
      if (d < 0) d = 0;
      // the slots: the dominant, then the others in their order - or, past GPU_K, the heaviest of them
      let m = 1; _sl[0] = d; _sw[0] = w2[o + d];
      for (let k = 0; k < K; k++) if (k !== d && w2[o + k] !== 0) { _sl[m] = k; _sw[m] = w2[o + k]; m++; }
      let s = 1;
      if (m > GPU_K) {
        pruned++;
        for (let a = 1; a < GPU_K; a++) { let b = a; for (let c = a + 1; c < m; c++) if (_sw[c] > _sw[b]) b = c;
          const tl = _sl[a]; _sl[a] = _sl[b]; _sl[b] = tl; const tw = _sw[a]; _sw[a] = _sw[b]; _sw[b] = tw; }
        let sk = 0; for (let a = 0; a < GPU_K; a++) sk += _sw[a];
        s = sk !== 0 ? 1 / sk : 1; m = GPU_K;
      }
      let ex = base[v * 3], ey = base[v * 3 + 1], ez = base[v * 3 + 2];
      for (let a = 0; a < m; a++) { const w = s === 1 ? _sw[a] : _sw[a] * s, i3 = wi[o + _sl[a]] * 3; _sw[a] = w;
        ex -= w * rest[i3]; ey -= w * rest[i3 + 1]; ez -= w * rest[i3 + 2]; }
      PA[t] = ex; PA[t + 1] = ey; PA[t + 2] = ez; PA[t + 3] = sag ? sag[v] : 0;
      const n0 = wi[o + d];
      for (let a = 0; a < GPU_K; a++) { const Wt = a < 4 ? W0 : W1, It = a < 4 ? I0 : I1, q = t + (a & 3);
        Wt[q] = a < m ? _sw[a] : 0; It[q] = a < m ? wi[o + _sl[a]] : n0; }
    }
    R.pruned = (R.pruned || 0) + pruned;
    return pruned;
  }
  // the nodes' texels: 2 a node - (live - origin, 0), (its turn); ND a Float32Array(n * 8)
  function packNodes(NF, live, n, cg, ND) {
    for (let i = 0; i < n; i++) { const o = i * 8;
      ND[o] = live[i * 3] - cg[0]; ND[o + 1] = live[i * 3 + 1] - cg[1]; ND[o + 2] = live[i * 3 + 2] - cg[2]; ND[o + 3] = 0;
      ND[o + 4] = NF.q[i * 4]; ND[o + 5] = NF.q[i * 4 + 1]; ND[o + 6] = NF.q[i * 4 + 2]; ND[o + 7] = NF.q[i * 4 + 3]; }
  }
  // RIDE_VS in JS. TX: the place arrays; p: the place's texel; n0: the vertex's rest normal (the frame's rest coordinates);
  // U: { Mi, B (both row-major, as app.js makes them), px, down, world (the places mode: P = the world position less the
  // origin, N untouched) }; out: P / N at o3. F: Math.fround to round as float32 does (or none)
  const ID = x => x;
  function rideMirror(TX, ND, p, n0x, n0y, n0z, U, P, N, o3, F) {
    F = F || ID;
    const t = p * 4, PA = TX.PA;
    const wt = a => (a < 4 ? TX.PW0 : TX.PW1)[t + (a & 3)], ix = a => (a < 4 ? TX.PI0 : TX.PI1)[t + (a & 3)] | 0;
    const i0 = ix(0) * 8, q0 = [ND[i0 + 4], ND[i0 + 5], ND[i0 + 6], ND[i0 + 7]];
    const q = [0, 0, 0, 0], l = [0, 0, 0];
    for (let a = 0; a < GPU_K; a++) {                   // the slots in order: q += (+-w) q_i on q_0's side, l += w l_i
      const i = ix(a) * 8, w = wt(a), qi = [ND[i + 4], ND[i + 5], ND[i + 6], ND[i + 7]];
      const dt = F(F(F(F(qi[0] * q0[0]) + F(qi[1] * q0[1])) + F(qi[2] * q0[2])) + F(qi[3] * q0[3]));
      const sw = dt < 0 ? -w : w;
      for (let k = 0; k < 4; k++) q[k] = F(q[k] + F(sw * qi[k]));
      for (let k = 0; k < 3; k++) l[k] = F(l[k] + F(w * ND[i + k]));
    }
    const L = F(Math.hypot(q[0], q[1], q[2], q[3]));
    if (L > 0) for (let k = 0; k < 4; k++) q[k] = F(q[k] / L);
    const rot = (x, y, z) => {                          // qrot: v + q.w t + q x t, t = 2 q x v
      const tx = F(2 * F(F(q[1] * z) - F(q[2] * y))), ty = F(2 * F(F(q[2] * x) - F(q[0] * z))), tz = F(2 * F(F(q[0] * y) - F(q[1] * x)));
      return [F(F(x + F(q[3] * tx)) + F(F(q[1] * tz) - F(q[2] * ty))), F(F(y + F(q[3] * ty)) + F(F(q[2] * tx) - F(q[0] * tz))), F(F(z + F(q[3] * tz)) + F(F(q[0] * ty) - F(q[1] * tx)))];
    };
    const e = rot(PA[t], PA[t + 1], PA[t + 2]), aw = PA[t + 3], D = U.down;
    const w = [F(F(l[0] + e[0]) + F(aw * D[0])), F(F(l[1] + e[1]) + F(aw * D[1])), F(F(l[2] + e[2]) + F(aw * D[2]))];
    if (U.world) { P[o3] = w[0]; P[o3 + 1] = w[1]; P[o3 + 2] = w[2]; return; }
    const M = U.Mi, B = U.B, px = U.px;
    P[o3] = F(F(F(F(M[0] * w[0]) + F(M[1] * w[1])) + F(M[2] * w[2])) - px[0]);
    P[o3 + 1] = F(F(F(F(M[3] * w[0]) + F(M[4] * w[1])) + F(M[5] * w[2])) - px[1]);
    P[o3 + 2] = F(F(F(F(M[6] * w[0]) + F(M[7] * w[1])) + F(M[8] * w[2])) - px[2]);
    const a = rot(n0x, n0y, n0z);                       // the normal: B^T (q n0), normalised
    const bx = F(F(F(B[0] * a[0]) + F(B[3] * a[1])) + F(B[6] * a[2])), by = F(F(F(B[1] * a[0]) + F(B[4] * a[1])) + F(B[7] * a[2])), bz = F(F(F(B[2] * a[0]) + F(B[5] * a[1])) + F(B[8] * a[2]));
    const bl = F(Math.hypot(bx, by, bz));
    if (bl > 0) { N[o3] = F(bx / bl); N[o3 + 1] = F(by / bl); N[o3 + 2] = F(bz / bl); } else { N[o3] = bx; N[o3 + 1] = by; N[o3 + 2] = bz; }
  }
  // THE TEAR WITHOUT THE CPU RIDING (the GPU draws the skin; the CPU never poses it): every watched triangle against its
  // rest (1.15 x + 1 cm, as tear()), on its places' world positions as the GPU made them (skin_gpu.js: the same shader in
  // its places mode, read back behind a fence - a frame old). Wp: the drawer's places (3 floats each, less a common
  // origin: only differences are read), p0 the record's first place there; base: the record's rest, read at each place's
  // first vertex (the copies are the same place)
  function tearPlaces(R, Wp, p0, base) {
    if (!R.watch || (R.noTear && !R.tubeTear && !R.sheetTear)) return 0;   // (tear()'s own rule: G1859)
    placesOf(R);
    // (G1859.3, DMG-WALL: a drawn tube tears past 1.2 x + 3 mm, sheet metal past 1.4 x + 2 cm, fabric at TEAR / TEAR_ABS - over())
    const k1 = R.tubeTear ? 1.2 : R.sheetTear ? 1.4 : 1 + TEAR, ab = R.tubeTear ? 0.003 : R.sheetTear ? 0.02 : TEAR_ABS;
    const pl = R.pl, plOf = R.plOf, i0 = R.idx0, idx = R.idx, dead = R.dead, Wt = R.watch;
    const ok = (a, b) => { const A = (p0 + a) * 3, B = (p0 + b) * 3, va = pl[a] * 3, vb = pl[b] * 3;
      const l = Math.hypot(Wp[A] - Wp[B], Wp[A + 1] - Wp[B + 1], Wp[A + 2] - Wp[B + 2]);
      const r = Math.hypot(base[va] - base[vb], base[va + 1] - base[vb + 1], base[va + 2] - base[vb + 2]);
      return l <= k1 * r + ab; };                        // (a NaN edge is torn too)
    let n = 0;
    for (let j = 0; j < Wt.length; j++) {
      const t = Wt[j]; if (dead[t]) continue;
      const a = plOf[i0[t * 3]], b = plOf[i0[t * 3 + 1]], c = plOf[i0[t * 3 + 2]];
      if (!(ok(a, b) && ok(b, c) && ok(a, c))) { dead[t] = 2; idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = i0[t * 3]; n++; }
    }
    R.torn += n; R.removed += n;
    return n;
  }
  function over(pos, base, a, b, R) {
    const l = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]);
    const r = Math.hypot(base[a] - base[b], base[a + 1] - base[b + 1], base[a + 2] - base[b + 2]);
    // (G1859.3: a drawn TUBE's own bound - a whole member ends at 15 % (the solver), so a tube triangle past 20 % + 3 mm
    // spans two bindings that parted at a joint: drawn torn, never stretched)
    if (R && R.tubeTear) return !(l <= 1.2 * r + 0.003);
    // (G1859.3: SHEET METAL tears only where it is torn for real - past 40 % + 2 cm: no confetti from a few frames of
    // elastic bay shear, but no sheet drawn stretched across a wreck either)
    if (R && R.sheetTear) return !(l <= 1.4 * r + 0.02);
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
  // ---- G1858 (DMG-WALL, the user's fallback: "if we struggle too much with the interior, we could simply get rid of it
  // for the crash"): THE INSIDE WALL CUT AT THE DAMAGE. The lining (aeroskin's liner / fire / sill / doorPad roles - not
  // the frame's tubes, not the furniture) is bound to other nodes than the covering over it and pokes through it where
  // the frame bends or breaks: grey and black on the yellow Cub. So once broken, a lining triangle with a vertex bound to
  // a node AT THE DAMAGE is removed as a torn one is (its indices collapsed; dead 3, kept until a heal): the nodes at the
  // ends of a broken member, the nodes off the core (a piece that came off), the ends of a member set past SET_HOT.
  // Away from the damage the cabin keeps its lining. Made at the events (a break, a new set), never per frame
  const SET_HOT = 0.01;       // a member's permanent set past 1 % puts its two ends at the damage
  function hotNodes(T, D) {
    const hot = new Uint8Array(T.n);
    for (const bi of D.br) { const b = T.beams[bi]; if (b) hot[b.a] = hot[b.b] = 1; }
    if (D.pc) for (let i = 0; i < T.n; i++) if (D.pc[i] !== 0) hot[i] = 1;
    if (D.set) for (let bi = 0; bi < T.nb; bi++) { const s = D.set[bi]; if (s > SET_HOT || s < -SET_HOT) { const b = T.beams[bi]; hot[b.a] = hot[b.b] = 1; } }
    return hot;
  }
  // returns the triangles cut now (R: an inside-wall record after its event; hot: hotNodes)
  function cutWall(R, hot) {
    if (!R.active || !R.dead) return 0;
    const K = R.K, wi = R.wi, w2 = R.w2, i0 = R.idx0, idx = R.idx, dead = R.dead, near = R.g.near;
    const nv = R.nv, vh = R._vh && R._vh.length === nv ? R._vh : (R._vh = new Uint8Array(nv));
    for (let v = 0; v < nv; v++) { let h = near && hot[near[v]] ? 1 : 0; const o = (R.rep ? R.rep[v] : v) * K;   // (G1818: a copy's kept weights are its place's)
      for (let k = 0; k < K && !h; k++) if (w2[o + k] !== 0 && hot[wi[o + k]]) h = 1;
      vh[v] = h; }
    let n = 0;
    for (let t = 0; t < R.nt; t++) {
      if (dead[t]) continue;
      const a = i0[t * 3], b = i0[t * 3 + 1], c = i0[t * 3 + 2];
      if (vh[a] || vh[b] || vh[c]) { dead[t] = 3; idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = a; n++; }
    }
    R.cut = (R.cut || 0) + n; R.removed += n;
    return n;
  }
  // ---- G1855-G1857 / G1859 (DMG-WALL): ONE WALL - THE BINDING INHERITED. The user (2026-10-05): the outer covering and the
  // inside lining "are 2 meshes, but they really are the same physical thing"; a gear vee and a wing drawn stretched
  // ("we need to retain something like area"); a cowl cut into diamonds; the skin lying metres off its frame. The solver
  // does not stretch (no unbroken member past 15 % on the user's Cub's crashes, measured by the coordinator): the drawing
  // did - every snapshot place bound to ITS OWN 4 nearest nodes, whatever layer or part it belonged to. BeamNG's flexbody
  // idea (§2.5; no code of theirs): every mesh of a body is bound to the SAME node set as the body. So the weights are
  // INHERITED, layer from layer, and the riding formula is unchanged (pos = sum w l + q (x - sum w r): the same cost a
  // frame, the same format for DMG-SKINGPU's shader - at most INH_K nodes a place, top INH_K by weight, renormalised):
  //   - 'tube' (the frame's own drawn tubes): its member's two end nodes, by the place's station t along it - exact along
  //     the beam (the bends show), its radius the offset the ends' turn carries;
  //   - 'cover' (the covering, the struct panels, the flying surfaces' skins): its point on the frame - the blend of the
  //     INH_M nearest frame members' points (each member's two ends by its station), weighted 1 / (d^2 + INH_EPS^2): over a
  //     member the place is laced to it, in a bay it is the bay's members' blend. The fabric never leaves its frame;
  //   - 'wall' (the lining, the window beads, the glazing and pane edges: what sits on the covering): the binding of its
  //     CLOSEST POINT ON THE COVERING at rest - the barycentric blend of that covering triangle's places' weights - so with
  //     the same weights and the same turn, wall = covering point + q x (its rest offset off it): it cannot come out
  //     through the covering unless the covering folds tighter than the wall's depth. Its triangles go when the covering
  //     triangle under them goes (wallFollow);
  //   - 'rigid' (a compact part: a cowl panel, a gear plate, a fitting, a light, a hinge; one object of the snapshot's
  //     layers under RIGID_D across): ONE binding for all its places - its centroid's 'cover' binding - so it moves as one
  //     rigid body with its mount and never stretches; a break gives all its places one piece (event's majority), so it
  //     goes whole with its dominant piece;
  //   - 'keep' (the cabin's furniture): as before.
  // Made once a record set at the first break (never before: nothing of it runs on an intact aeroplane), never per frame.
  // A record's class and its places' objects come from the page (app.js brkCage: the bucket's section role, the
  // snapshot's layer ranges). PURE, like the rest of this file.
  const INH_K = 8;            // the nodes a place may blend (DMG-SKINGPU's slots)
  const INH_M = 4;            // the frame members a covering place blends
  const INH_EPS = 0.03;       // m: the blend's softening (a place 3 cm off two members weighs them nearly alike)
  const TUBE_R = 0.08;        // m: a drawn tube farther than this from every member is bound as covering
  const WALL_BOUND = 0.15;    // m: a lining place with no covering this near is bound as covering (the frame's blend)
  const RIGID_D = 1.2;        // m: a part object wider than this is not compact (a door's long frame, a wing's hinge line)
  // the frame's members a covering may be laced to (not the gear, the engine mount, the tanks, the struts or the wires:
  // they pass near the skin without carrying it)
  const FRAME_SEC = new Set(['fuselage', 'wings', 'tail']);
  function frameSegs(T, rest, all) {
    const L = [];
    T.beams.forEach((b, bi) => { if (!all && (b.cls === 'wire' || (b.sec && !FRAME_SEC.has(b.sec)))) return;
      const ax = rest[b.a * 3], ay = rest[b.a * 3 + 1], az = rest[b.a * 3 + 2], ex = rest[b.b * 3] - ax, ey = rest[b.b * 3 + 1] - ay, ez = rest[b.b * 3 + 2] - az;
      const L2 = ex * ex + ey * ey + ez * ez; if (L2 > 1e-8) L.push({ bi, a: b.a, b: b.b, ax, ay, az, ex, ey, ez, L2 }); });
    return L;
  }
  // a point's members: the M nearest (distance to the segment), each with its station t
  const _md = new Float64Array(16), _mi = new Int32Array(16), _mt = new Float64Array(16);
  function nearSegs(S, x, y, z, M) {
    let m = 0;
    for (let s = 0; s < S.length; s++) { const g = S[s];
      let t = ((x - g.ax) * g.ex + (y - g.ay) * g.ey + (z - g.az) * g.ez) / g.L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = g.ax + t * g.ex - x, dy = g.ay + t * g.ey - y, dz = g.az + t * g.ez - z, d = dx * dx + dy * dy + dz * dz;
      if (m === M && d >= _md[M - 1]) continue;
      let j = m < M ? m++ : M - 1; while (j > 0 && _md[j - 1] > d) { _md[j] = _md[j - 1]; _mi[j] = _mi[j - 1]; _mt[j] = _mt[j - 1]; j--; }
      _md[j] = d; _mi[j] = s; _mt[j] = t; }
    return m;
  }
  // the tube pieces of a record: its tube places joined by its triangles (welded: the record's rep), each piece's member or
  // node -> Map(place -> { seg, node })
  const JOINT_D = 0.06;       // m: a tube piece no wider than this is a knuckle at a node
  const TUBE_SEG = 0.10;      // m: ...and a piece farther than this from every member along its length is no member's tube
  function tubePieces(E, Sall, st) {
    const R = E.R, cv = E.cv, P = R.g.pos, rp = R.rep, ix = R.idx0 || R.idx, nt = (ix.length / 3) | 0;
    if (cv.indexOf(INH.tube) < 0) return null;
    const par = new Int32Array(R.nv); for (let v = 0; v < R.nv; v++) par[v] = v;
    const f = v => { while (par[v] !== v) { par[v] = par[par[v]]; v = par[v]; } return v; };
    const pl = v => rp ? rp[v] : v;
    for (let t = 0; t < nt; t++) { const a = pl(ix[t * 3]), b = pl(ix[t * 3 + 1]), c = pl(ix[t * 3 + 2]);
      if (cv[a] !== INH.tube || cv[b] !== INH.tube || cv[c] !== INH.tube) continue;
      const ra = f(a), rb = f(b), rc = f(c); par[rb] = ra; par[f(rc)] = ra; }
    const pieces = new Map();
    for (let v = 0; v < R.nv; v++) { if (cv[v] !== INH.tube || (rp && rp[v] !== v)) continue; const r = f(v); let L = pieces.get(r); if (!L) pieces.set(r, L = []); L.push(v); }
    const out = new Map();
    for (const L of pieces.values()) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, cx = 0, cy = 0, cz = 0;
      for (const v of L) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; cx += x; cy += y; cz += z;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      cx /= L.length; cy /= L.length; cz /= L.length;
      if (Math.hypot(x1 - x0, y1 - y0, z1 - z0) <= JOINT_D) {             // a knuckle: its nearest node (a member's end)
        const m = nearSegs(Sall, cx, cy, cz, 1); if (!m) continue; const g = Sall[_mi[0]];
        const node = _mt[0] < 0.5 ? g.a : g.b; for (const v of L) out.set(v, { seg: -1, node }); st.tubeJoint = (st.tubeJoint || 0) + 1; continue; }
      // the member closest along the whole piece: candidates from the piece's centroid, each scored by its worst place
      const m = nearSegs(Sall, cx, cy, cz, 6); const cand = []; for (let j = 0; j < m; j++) cand.push(_mi[j]);
      let best = -1, bw = Infinity;
      for (const s2 of cand) { const g = Sall[s2]; let w = 0;
        for (const v of L) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
          let t = ((x - g.ax) * g.ex + (y - g.ay) * g.ey + (z - g.az) * g.ez) / g.L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(g.ax + t * g.ex - x, g.ay + t * g.ey - y, g.az + t * g.ez - z); if (d > w) w = d; if (w >= bw) break; }
        if (w < bw) { bw = w; best = s2; } }
      if (best < 0 || bw > TUBE_SEG) { st.tubeLoose = (st.tubeLoose || 0) + 1; continue; }   // (place by place, below)
      for (const v of L) out.set(v, { seg: best, node: -1 });
      st.tubePieces = (st.tubePieces || 0) + 1;
    }
    return out;
  }
  // a node-weight accumulator (a small map), cut to the top INH_K and renormalised into wi / ww at o
  function Acc() { this.n = 0; this.i = new Int32Array(64); this.w = new Float64Array(64); }
  Acc.prototype.clear = function () { this.n = 0; return this; };
  Acc.prototype.add = function (node, w) { if (!(w > 0)) return; for (let k = 0; k < this.n; k++) if (this.i[k] === node) { this.w[k] += w; return; }
    if (this.n < 64) { this.i[this.n] = node; this.w[this.n++] = w; } };
  Acc.prototype.put = function (wi, ww, o, K) {
    const n = this.n, I = this.i, W = this.w;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (W[b] > W[a]) { const tw = W[a]; W[a] = W[b]; W[b] = tw; const ti = I[a]; I[a] = I[b]; I[b] = ti; }
    const m = Math.min(n, K); let s = 0; for (let k = 0; k < m; k++) s += W[k];
    for (let k = 0; k < K; k++) { wi[o + k] = k < m ? I[k] : I[0]; ww[o + k] = k < m && s > 0 ? W[k] / s : 0; }
    return n > K;                                         // (truncated past K: counted)
  };
  const _acc = new Acc();
  function coverInto(acc, S, x, y, z) {
    const m = nearSegs(S, x, y, z, INH_M);
    for (let j = 0; j < m; j++) { const g = S[_mi[j]], t = _mt[j], a = 1 / (_md[j] + INH_EPS * INH_EPS);
      acc.add(g.a, a * (1 - t)); acc.add(g.b, a * t); }
    return m;
  }
  // L: [{ R (a cage record, K = INH_K), cv (Uint8Array a vertex: its class - INH.keep / tube / cover / wall / rigid; or
  // cls, one class for the record), obj (Int32Array a vertex: the rigid part's object) }], all records in one frame
  // (R.g.pos: their rest, `rest` the nodes'). Fills wi / ww for every place but the furniture's (the copies copied),
  // marks them bound (the furniture is left to the event's nearest-node binding, as before), returns the stats
  const INH = { keep: 0, tube: 1, cover: 2, wall: 3, rigid: 4 };
  // a place's class: by its bucket's section (sec, aeroskin's role of it) or, for a colour bucket, by its layer (the
  // snapshot's layer ranges). The page and GATE DMGWALL ask this one rule
  const INH_TUBE = new Set(['tube', 'woodFrame', 'boomTube']);
  const INH_RIGID_LAYER = new Set(['cowl', 'gear', 'access', 'light', 'hinge', 'energy', 'eng']);
  function inhClass(sec, role, layer) {
    if (sec) {
      if (INH_TUBE.has(sec)) return INH.tube;
      if (sec === 'reveal') return INH.wall;
      if (role === 'skin' || role === 'rail' || role === 'pillar' || role === 'struct') return INH.cover;
      if (role === 'liner' || role === 'fire' || role === 'sill' || role === 'doorPad' || role === 'glass' || role === 'bead' || role === 'seal' || role === 'edge') return INH.wall;
      return INH.keep;                                   // the dash's pad and facia
    }
    if (layer === 'crew') return INH.keep;
    if (INH_RIGID_LAYER.has(layer)) return INH.rigid;
    return INH.cover;                                    // the wing, the fin, the stab, a boom, a float; the sheet's own
  }
  function* inhSteps(L, T, rest, st, every) {
    Object.assign(st, { places: 0, tube: 0, tubeFar: 0, cover: 0, wall: 0, wallFar: 0, rigid: 0, parts: 0, bigParts: 0, keep: 0, over8: 0, done: false });
    const S = frameSegs(T, rest), Sall = frameSegs(T, rest, true); let _n = 0;
    for (const E of L) if (!E.cv) E.cv = new Uint8Array(E.R.nv).fill(INH[E.cls] || 0);
    // a welded place never spans two classes or two part objects (two panels touching at a seam are two places: each
    // goes with its own part) - the record's rep split there, before any event reads it
    for (const E of L) { const R = E.R, rp = R.rep; if (!rp) continue; const cv = E.cv, obj = E.obj, first = new Map();
      for (let v = 0; v < R.nv; v++) { const u = rp[v]; if (u === v || (cv[u] === cv[v] && (!obj || obj[u] === obj[v]))) continue;
        const key = u * 64 + cv[v] * 8 + 1 + (obj ? (obj[v] & 0xffff) * 1e9 : 0); const f = first.get(key);
        if (f == null) { first.set(key, v); rp[v] = v; } else rp[v] = f; } }
    const placesOf = (E, c) => { const R = E.R, out = []; for (let v = 0; v < R.nv; v++) if ((!R.rep || R.rep[v] === v) && E.cv[v] === c) out.push(v); return out; };
    // 1. the frame's tubes and the covering. A TUBE is bound as a UNIT (G1859.2, the coordinator: a tube bound place by
    // place to its nearest member put one ring's places on two members at a joint, and the ring was drawn 145-640 x its
    // rest once they parted): its drawn pieces (the places joined by its triangles) each take ONE member - the one whose
    // segment lies closest along the whole piece - every place its station t on it; a piece no wider than JOINT_D (a
    // joint's knuckle, a fitting) takes the nearest node alone; a piece no member runs along (worst place past TUBE_SEG)
    // is bound place by place as before
    for (const E of L) {
      const R = E.R, K = R.K, P = R.g.pos;
      const tubeOf = tubePieces(E, Sall, st);
      for (const c of [INH.tube, INH.cover]) for (const v of placesOf(E, c)) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
        if (++_n >= every) { _n = 0; yield st.places; } _acc.clear(); st.places++;
        if (c === INH.tube && tubeOf && tubeOf.has(v)) { const u = tubeOf.get(v);
          if (u.node >= 0) _acc.add(u.node, 1);
          else { const g = Sall[u.seg]; let t = ((x - g.ax) * g.ex + (y - g.ay) * g.ey + (z - g.az) * g.ez) / g.L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
            _acc.add(g.a, 1 - t); _acc.add(g.b, t); }
          st.tube++; }
        else if (c === INH.tube) { const m = nearSegs(Sall, x, y, z, 1);
          // (always its nearest member, however far: a drawn tube off the physics line - a lift strut drawn beside its member -
          // blended over the covering's frame was stretched metres when its piece went; counted past TUBE_R)
          if (m) { const g = Sall[_mi[0]]; _acc.add(g.a, 1 - _mt[0]); _acc.add(g.b, _mt[0]); if (_md[0] < TUBE_R * TUBE_R) st.tube++; else st.tubeFar++; } }
        else { coverInto(_acc, S, x, y, z); st.cover++; }
        if (_acc.n && _acc.put(R.wi, R.ww, v * K, K)) st.over8++;
      }
    }
    // 2. the compact parts: one binding an object (its centroid's covering binding)
    for (const E of L) {
      const R = E.R, K = R.K, P = R.g.pos, box = new Map(), list = placesOf(E, INH.rigid);
      if (!list.length) continue;
      const obj = E.obj;
      if (E.fixed) {                                     // (the page's own: a gear leg, half its root node, half its axle's)
        _acc.clear(); for (const [i, w] of E.fixed) _acc.add(i, w);
        const wi = new Int32Array(K), ww = new Float32Array(K); _acc.put(wi, ww, 0, K); st.parts++;
        for (const v of list) { for (let k = 0; k < K; k++) { R.wi[v * K + k] = wi[k]; R.ww[v * K + k] = ww[k]; } st.places++; st.rigid++; }
        continue;
      }
      for (const v of list) { const id = obj ? obj[v] : 0; let b = box.get(id);
        if (!b) box.set(id, b = { n: 0, x: 0, y: 0, z: 0, x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity, wi: null, ww: null });
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; b.n++; b.x += x; b.y += y; b.z += z;
        b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.z0 = Math.min(b.z0, z); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); b.z1 = Math.max(b.z1, z); }
      for (const b of box.values()) { b.wi = new Int32Array(K); b.ww = new Float32Array(K);
        b.big = Math.hypot(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) > RIGID_D;
        // (a part rides what carries it - every member, the engine mount and the gear's too: a nose bowl on the engine and
        // its mount, a side panel on the firewall's frame, a gear plate on its leg)
        if (!b.big) { _acc.clear(); coverInto(_acc, Sall, b.x / b.n, b.y / b.n, b.z / b.n); _acc.put(b.wi, b.ww, 0, K); st.parts++; } else st.bigParts++; }
      for (const v of list) { if (++_n >= every) { _n = 0; yield st.places; } const b = box.get(obj ? obj[v] : 0); st.places++;
        if (b.big) { _acc.clear(); coverInto(_acc, S, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); if (_acc.put(R.wi, R.ww, v * K, K)) st.over8++; st.cover++; }
        else { for (let k = 0; k < K; k++) { R.wi[v * K + k] = b.wi[k]; R.ww[v * K + k] = b.ww[k]; } st.rigid++; } }
    }
    // 3. what sits on the covering: its closest point on it at rest, that triangle's places' weights blended
    const walls = L.filter(E => E.cv.indexOf(INH.wall) >= 0);
    if (walls.length) {
      const G = coverGrid(L);
      for (const E of walls) {
        const R = E.R, K = R.K, P = R.g.pos, on = E.on = new Int32Array(R.nv * 2).fill(-1), ob = E.ob = new Float32Array(R.nv * 3);
        for (const v of placesOf(E, INH.wall)) {
          if (++_n >= every) { _n = 0; yield st.places; } const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; st.places++;
          const h = closestCover(G, L, x, y, z, WALL_BOUND);
          _acc.clear();
          if (h) { const C = L[h.r].R, Kc = C.K, ix = C.idx0 || C.idx;
            for (let q = 0; q < 3; q++) { const u = C.rep ? C.rep[ix[h.t * 3 + q]] : ix[h.t * 3 + q], bq = h.b[q];   // (a copy's weights come last: its place's)
              for (let k = 0; k < Kc; k++) _acc.add(C.wi[u * Kc + k], bq * C.ww[u * Kc + k]); }
            on[v * 2] = h.r; on[v * 2 + 1] = h.t; ob[v * 3] = h.b[0]; ob[v * 3 + 1] = h.b[1]; ob[v * 3 + 2] = h.b[2]; st.wall++; }
          else { coverInto(_acc, S, x, y, z); st.wallFar++; }
          if (_acc.n && _acc.put(R.wi, R.ww, v * K, K)) st.over8++;
        }
        if (R.rep) for (let v = 0; v < R.nv; v++) { const u = R.rep[v]; if (u !== v) { on[v * 2] = on[u * 2]; on[v * 2 + 1] = on[u * 2 + 1]; for (let j = 0; j < 3; j++) ob[v * 3 + j] = ob[u * 3 + j]; } }
      }
    }
    // the copies (welded places), bound
    for (const E of L) { const R = E.R, K = R.K, rp = R.rep, cv = E.cv;
      for (let v = 0; v < R.nv; v++) { const u = rp ? rp[v] : v;
        if (cv[u] === INH.keep) { st.keep++; continue; }
        if (u !== v) for (let k = 0; k < K; k++) { R.wi[v * K + k] = R.wi[u * K + k]; R.ww[v * K + k] = R.ww[u * K + k]; }
        R.g.bound[v] = 1; }
      if (R.pending) { const P2 = Array.from(R.pending).filter(v => !R.g.bound[v]); R.pending = P2.length ? Int32Array.from(P2) : null; }
      R.dv = (R.dv || 0) + 1; R.dirtyPl = null; }
    st.done = true;
    return st;
  }
  // the whole binding at once (GATE DMGWALL, node); the page runs inhSteps a budget a frame
  function bindInherit(L, T, rest) { const st = {}; for (const _ of inhSteps(L, T, rest, st, Infinity)) {} return st; }
  // the covering's triangles on a grid (4 cm), and the closest one to a point within `reach` (its barycentrics)
  function coverGrid(cov) {
    const h = 0.04, cells = new Map(), key = (i, j, k) => ((i + 4096) * 8192 + (j + 4096)) * 8192 + (k + 4096);
    cov.forEach((E, r) => { const R = E.R, P = R.g.pos, ix = R.idx0 || R.idx, cv = E.cv;
      if (cv.indexOf(INH.cover) < 0) return;
      for (let t = 0; t < R.nt; t++) { const a = ix[t * 3] * 3, b = ix[t * 3 + 1] * 3, c = ix[t * 3 + 2] * 3;
        if ((a === b && b === c) || cv[a / 3] !== INH.cover || cv[b / 3] !== INH.cover || cv[c / 3] !== INH.cover) continue;
        const x0 = Math.floor(Math.min(P[a], P[b], P[c]) / h), x1 = Math.floor(Math.max(P[a], P[b], P[c]) / h);
        const y0 = Math.floor(Math.min(P[a + 1], P[b + 1], P[c + 1]) / h), y1 = Math.floor(Math.max(P[a + 1], P[b + 1], P[c + 1]) / h);
        const z0 = Math.floor(Math.min(P[a + 2], P[b + 2], P[c + 2]) / h), z1 = Math.floor(Math.max(P[a + 2], P[b + 2], P[c + 2]) / h);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4096) continue;
        for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let k = z0; k <= z1; k++) { const q = key(i, j, k); let Lc = cells.get(q); if (!Lc) cells.set(q, Lc = []); Lc.push(r, t); } } });
    return { h, cells, key };
  }
  function closestCover(G, cov, x, y, z, reach) {
    const h = G.h, ci = Math.floor(x / h), cj = Math.floor(y / h), ck = Math.floor(z / h), rr = Math.ceil(reach / h);
    let best = null, bd = reach * reach;
    for (let r = 0; r <= rr; r++) {
      if (best && (r - 1) * h * (r - 1) * h > bd) break;
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj), Math.abs(k - ck)) !== r) continue;
        const Lc = G.cells.get(G.key(i, j, k)); if (!Lc) continue;
        for (let q = 0; q < Lc.length; q += 2) { const R = cov[Lc[q]].R, t = Lc[q + 1], P = R.g.pos, ix = R.idx0 || R.idx;
          const res = triClosest(P, ix[t * 3] * 3, ix[t * 3 + 1] * 3, ix[t * 3 + 2] * 3, x, y, z);
          if (res.d < bd) { bd = res.d; best = { r: Lc[q], t, b: [res.u, res.v, res.w], d0: res.d }; } }
      }
    }
    return best;
  }
  // the closest point of a triangle (Ericson, Real-Time Collision Detection 5.1.5): its squared distance and barycentrics
  const _tc = { d: 0, u: 0, v: 0, w: 0 };
  function triClosest(P, a, b, c, px, py, pz) {
    const abx = P[b] - P[a], aby = P[b + 1] - P[a + 1], abz = P[b + 2] - P[a + 2], acx = P[c] - P[a], acy = P[c + 1] - P[a + 1], acz = P[c + 2] - P[a + 2];
    const apx = px - P[a], apy = py - P[a + 1], apz = pz - P[a + 2];
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    let u, v, w;
    if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; }
    else { const bpx = px - P[b], bpy = py - P[b + 1], bpz = pz - P[b + 2], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
      if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; }
      else { const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { const s = d1 / (d1 - d3); u = 1 - s; v = s; w = 0; }
        else { const cpx = px - P[c], cpy = py - P[c + 1], cpz = pz - P[c + 2], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
          if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; }
          else { const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) { const s = d2 / (d2 - d6); u = 1 - s; v = 0; w = s; }
            else { const va = d3 * d6 - d5 * d4;
              if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const s = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 0; v = 1 - s; w = s; }
              else { const dn = 1 / (va + vb + vc); v = vb * dn; w = vc * dn; u = 1 - v - w; } } } } } }
    const qx = u * P[a] + v * P[b] + w * P[c] - px, qy = u * P[a + 1] + v * P[b + 1] + w * P[c + 1] - py, qz = u * P[a + 2] + v * P[b + 2] + w * P[c + 2] - pz;
    _tc.d = qx * qx + qy * qy + qz * qz; _tc.u = u; _tc.v = v; _tc.w = w;
    return _tc;
  }
  // THE WALL TAKES ITS COVERING'S EVENT (G1856): after every record's event, a wall place's kept weights, piece and
  // dominant node are its covering point's - the barycentric blend of that triangle's places' KEPT weights (w2) - not
  // its own reading of the pieces (a blend of three places' weights can lean to another piece than all three keep).
  // An event's work, never a frame's
  const _sy = new Acc();
  function wallSync(E, L) {
    const R = E.R, on = E.on, ob = E.ob; if (!R.active || !on || !R.w2) return;
    const K = R.K, wi = R.wi, w2 = R.w2, rp = R.rep;
    let sag = null;
    for (let v = 0; v < R.nv; v++) {
      const r = on[v * 2]; if (r < 0 || (rp && rp[v] !== v)) continue;
      const C = L[r].R, t = on[v * 2 + 1]; if (!C.w2) continue;
      const Kc = C.K, ix = C.idx0 || C.idx, crp = C.rep; _sy.clear();
      // (G1818 merge: the covering's kept weights are read at its PLACE - a welded copy's are never written, G1818's prep
      // once a place: read at a copy corner they were zeros, and a pane, a bead or the lining went weightless - the CPU
      // drew it at its rest coordinates in the world, ~500 m off, the GPU unrotated about the CG; the box, 20:45)
      for (let q = 0; q < 3; q++) { const u0 = ix[t * 3 + q], u = crp ? crp[u0] : u0, bq = ob[v * 3 + q]; for (let k = 0; k < Kc; k++) { const w = C.w2[u * Kc + k]; if (w !== 0) _sy.add(C.wi[u * Kc + k], bq * w); } }
      const o = v * K; let s = 0, d = wi[o], dw = -1;
      for (let k = 0; k < K; k++) { let w = 0; const i = wi[o + k];
        let firstSlot = true; for (let j = 0; j < k; j++) if (wi[o + j] === i) { firstSlot = false; break; }
        if (firstSlot) for (let j = 0; j < _sy.n; j++) if (_sy.i[j] === i) { w = _sy.w[j]; break; }
        w2[o + k] = w; s += w; if (w > dw) { dw = w; d = i; } }
      if (s > 0) for (let k = 0; k < K; k++) w2[o + k] /= s;
      else { w2[o] = 1; d = wi[o]; }                      // (none of its covering point's kept nodes among its own: rigid on its first - never weightless)
      R.vp[v] = C.vp[ix[t * 3]]; R.dom[v] = d;
      // ...and its drape (G1852's sag of a slack fabric panel: the lining hangs with the covering it is laced behind)
      if (C.sag) { const h = ob[v * 3] * C.sag[ix[t * 3]] + ob[v * 3 + 1] * C.sag[ix[t * 3 + 1]] + ob[v * 3 + 2] * C.sag[ix[t * 3 + 2]];
        if (h > 0) { if (!sag) sag = new Float32Array(R.nv); sag[v] = h; } }
    }
    R.sag = sag;
    if (sag && rp) for (let v = 0; v < R.nv; v++) { const u = rp[v]; if (u !== v) sag[v] = sag[u]; }
    if (rp) for (let v = 0; v < R.nv; v++) { const u = rp[v]; if (u === v || on[u * 2] < 0) continue; R.vp[v] = R.vp[u]; R.dom[v] = R.dom[u]; for (let k = 0; k < K; k++) w2[v * K + k] = w2[u * K + k]; }
    R.dv = (R.dv || 0) + 1; R.dirtyPl = null;          // (DMG-SKINGPU re-packs a record's places on it)
  }
  // THE WALL GOES WITH ITS COVERING (G1856): a wall triangle with a place on a covering triangle that is gone (removed at
  // an event, torn, cut) goes too (dead 4, kept until a heal). E: a 'wall' entry of bindInherit (E.on), cov its covering
  // entries. Returns the triangles removed now
  function wallFollow(E, cov) {
    const R = E.R, on = E.on; if (!R.active || !R.dead || !on) return 0;
    const i0 = R.idx0, idx = R.idx, dead = R.dead; let n = 0;
    for (let t = 0; t < R.nt; t++) { if (dead[t]) continue;
      for (let q = 0; q < 3; q++) { const v = i0[t * 3 + q], r = on[v * 2]; if (r < 0) continue; const C = cov[r].R;
        if (C.dead && C.dead[on[v * 2 + 1]]) { dead[t] = 4; idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = i0[t * 3]; n++; break; } } }
    R.removed += n; R.followed = (R.followed || 0) + n;
    return n;
  }
  const API = { TEAR, TEAR_ABS, DRAPE_K, WRINKLE_L, WRINKLE_A, NEAR_K, SET_HOT, INH_K, INH, inhClass, inhSteps, bindInherit, wallSync, wallFollow, frameSegs, coverGrid, closestCover, triClosest, topo, brokenPairs, bindNearest, dupOf, make, event, bindMore, nodeFrames, polar, poseGen, poseCage, tear, islands, worstStretch, hotNodes, cutWall,
                GPU_W, GPU_K, placesOf, placeArrays, packPlaces, packNodes, rideMirror, tearPlaces, onNodes };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SKIN_BREAK = API;
})();
