// G1860-G1861 (DMG-D4b WRECK DRAWN): THE NON-MEMBER PARTS OF A WRECK - DEFORM-AND-BREAK §8.3 (drop it before it
// clips: debris) and §5.3 (the prop strike). The cowl panels, the spinner, the prop blades, the wheels (and the leg or
// spat that rides them), the glazing: drawn parts with no member of their own, which until now rode a frame that had
// gone from under them - a cowl hanging in the air where the engine was, a windscreen standing in a crushed cabin, a
// wheel stretched on its leg towards an axle node lying metres away.
//
// A CANDIDATE is a drawn part and its CARRYING NODE SET (carry(): the nodes it is bolted to - the engine's for a
// spinner or a blade, the firewall ring and the engine's for a cowl, the axle node for a wheel, the nearest cabin nodes
// for a pane). It LEAVES (watch) when:
//   - its carrying set is BROKEN OFF: most of its nodes on a piece that is not the core (DMG-D1b's pieces, the damage
//     state's pc), or LOOSE: nodes with every member broken (TREE-CRASH's debris nodes) - an engine unit leaves only so
//     (on a piece of its own it still rides its nodes, prop and all), a spinner only crushed;
//   - or CRUSHED past a bound: any two of its nodes CRUSH (6 cm) off their rest distance - a firewall ring folded under
//     a cowl, a cabin frame bent round a windscreen. Elastic flex never reads it: the bound is ~30x a hard landing's
//     (FAR 23.473 reads 0.13-0.21 of yield on the validated builds), and it is asked only once the damage state moves.
//     A COWL PANEL and the SPINNER read TORN (25 cm) instead: dented sheet stays on its fasteners and rides its nodes
//     dented (DMG-WALL's binding) - a 3 m/s taxi into a trunk dents the nose, it does not throw the cowl off and bare
//     an engine whose mount is whole (G1860.1, the coordinator's "the drawing follows the physics"); glazing breaks.
// A part that leaves is a DEBRIS BODY: a rigid body (no beams, no aero lift), its pose the rigid fit of its carrying
// set (Horn, skin_break.js polar) and its velocity the set's own (the mean, and the turn), plus a small seeded kick
// away from the frame (the latches letting go: the user's "the cowl opens and gets ejected") and tumble. Gravity,
// quadratic drag, the ground (terrainH) and the water (waterH: a body lighter than water floats, a heavier one sinks
// slowly - SUNK, out of sight, half a metre under); it comes to REST (asleep) and stays until the reset. Its contact is its box's eight corners in
// its own frame (the drawn part's extent), impulses with Coulomb friction, at a fixed 1/240 s whatever the frame rate.
// Nothing here runs while nothing is damaged; a few bodies after.
//
// THE PROP STRIKE (§5.3): when an engine seizes (TREE-CRASH's eng.seized, a ground or trunk strike), the strike's
// ENERGY (the prop's spin, 1/2 I w^2 at the rpm it had, plus the aeroplane's 1/2 M v^2 at the hub's speed) chooses,
// seeded by the strike itself: under E_BEND the blades CURL toward their tips (aft, the more the harder), over E_BREAK
// a blade BREAKS OFF as debris and the rest curl, and between the two a seeded draw on the straight line between them;
// the spinner is DENTED on the strike's side; the prop stops in the frame it seized (app.js).
//
// PURE: no THREE, no DOM; node-tested by GATE DMGWRECK (tools/_dmg_wreck_check.js). window.WRECK_DEBRIS in the page,
// module.exports in node.
(function () {
  'use strict';
  const SB = typeof SKIN_BREAK !== 'undefined' ? SKIN_BREAK
    : (typeof require === 'function' ? require('./skin_break.js') : null);
  const G = 9.81;
  const DT = 1 / 240;          // the bodies' own step (s): independent of the frame rate
  const SOLID_V = 1.0, SOLID_PUSH = 0.01;   // G1862.1: a cabin bay is solid to the debris when its nodes are under SOLID_V (m/s); a corner eased out SOLID_PUSH (m) a substep
  const CRUSH = 0.06;          // a carrying set crushed: two of its nodes this far (m) off their rest distance
  const TORN = 0.25;           // ...a cowl panel's or a spinner's (sheet dents on its fasteners): torn off only this far
  const KICK = 1.2;            // the release's kick away from the frame (m/s)
  const SPIN = 2.0;            // ...and its seeded tumble (rad/s, each axis up to)
  const W_CAP = 12, V_OVER = 6;    // the release's turn (rad/s) and its speed over its set's own (m/s), at most
  const MU = 0.6, BOUNCE = 0.2, SLOW = 0.6;     // the ground's friction, the impact's restitution (none under SLOW m/s)
  const CONTACT_DAMP = 4;                       // a body on the ground: its turn decays at this rate (1/s)
  const REST_V = 0.08, REST_W = 0.4, REST_T = 0.4, LIFE = 20;   // asleep: under these (low-passed) for REST_T s (forced at LIFE s)
  const RHO_AIR = 1.225, RHO_WATER = 1000, CD = 1.1, SUNK = 0.5;
  // THE PROP STRIKE's energy bounds (J): a 3 m/s taxi into a trunk at a fast idle spends ~25 kJ (the spin's ~19 kJ and
  // the aeroplane's ~2.5 kJ: GATE DMGWRECK prints them) and curls the blades; a 30 m/s impact ~250 kJ and breaks one.
  // A wooden blade on a trunk at taxi speed is a real break as often as a bend; the seeded draw between the bounds is
  // that spread, not a calibration.
  const E_BEND = 40e3, E_BREAK = 150e3;
  const CURL0 = 0.35, CURL1 = 0.55;             // the tips' curl (rad): CURL0 at no energy, + CURL1 at E_BREAK
  const CURL_S0 = 0.35;                         // the curl starts this far out along the blade (fraction of R)
  const DENT0 = 0.015, DENT1 = 0.045;           // the spinner's dent (m): DENT0 + DENT1 at E_BREAK

  // ---- the seeded draws (mulberry32) ----
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hash = (...xs) => { let h = 2166136261; for (const x of xs) { h ^= (Math.round(x * 1000) | 0); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ---- THE CARRYING SET of a drawn part: def (the frame), kind, at (its rest centre, the def's frame), unit (an engine) ----
  // cowl: the engine's nodes + the 4 frame nodes nearest the cowl (a nose engine's: the firewall ring)
  // spinner / blade: the engine's nodes;  wheel: the axle node (its leg's own);  pane: the 6 body nodes nearest
  function carry(def, kind, at, unit) {
    const R = def.refs || {}, N = def.nodes, P = (def.parts && def.parts.dmg && def.parts.dmg.part) || null;
    const E = R.engine || [], EO = R.engineOf || E.map(() => 0);
    const engOf = u => E.filter((i, j) => (EO[j] | 0) === (u | 0));
    const nearest = (k, ok) => {
      const c = [];
      for (let i = 0; i < N.length; i++) if (ok(i)) c.push([Math.hypot(N[i].p[0] - at[0], N[i].p[1] - at[1], N[i].p[2] - at[2]), i]);
      return c.sort((a, b) => a[0] - b[0]).slice(0, k).map(x => x[1]);
    };
    const axles = new Set([].concat(R.mains || [], R.tw != null && R.tw >= 0 ? [R.tw] : []));
    if (kind === 'spinner' || kind === 'blade') { const e = engOf(unit); return e.length ? e : E.slice(); }
    if (kind === 'cowl') { const e = engOf(unit), es = new Set(E);
      return e.concat(nearest(4, i => !es.has(i) && !axles.has(i) && (!P || !/^(gear|tw|float)/.test(P[i] || '')))); }
    if (kind === 'wheel') return nearest(1, i => axles.has(i));
    // a pane: the body's own nodes (the cabin's frame)
    return nearest(6, i => (!P || P[i] === 'body') && !axles.has(i));
  }

  // ---- THE PLAN: the candidates (each { id, kind, nodes, rest (its centre, the def's frame), half (its box, m), mass,
  // unit }) and the pairwise rest distances of each carrying set ----
  function plan(def, cands) {
    const N = def.nodes;
    return { def, n: N.length, parts: cands.map((c, id) => {
      const nodes = c.nodes || carry(def, c.kind, c.at, c.unit);
      const L0 = [];
      for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
        const p = N[nodes[a]].p, q = N[nodes[b]].p; L0.push(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
      return Object.assign({}, c, { id, nodes, L0, gone: false, why: null });
    }) };
  }

  // ---- THE WATCHER: the parts that leave now (ids), from the damage state D (sim_view.js simViewDmgState: br, broken,
  // pc, v, vB) and the live nodes (world, n x 3). W: { v, vB } the last state read. Asked only when D moved ----
  function watcher() { return { v: -1, vB: -1, bodies: [], acc: 0, t: 0, prev: null, prevT: null }; }
  function watch(W, P, D, live, adj) {
    if (!D || (D.v === W.v && D.vB === W.vB)) return [];
    W.v = D.v; W.vB = D.vB;
    if (!D.br.length && !anySet(D)) return [];
    const out = [];
    for (const c of P.parts) {
      if (c.gone || c.hold) continue;
      const why = leaves(c, D, live, adj);
      if (why) { c.why = why; out.push(c.id); }
    }
    return out;
  }
  const anySet = D => { if (!D.set) return false; for (let i = 0; i < D.set.length; i++) if (D.set[i]) return true; return false; };
  // why a part leaves (null: it stays): 'off' (its set's majority off the core), 'loose' (its set's majority debris nodes:
  // every member gone), 'crushed'. c.rule: 'piece' (the default: any of the three), 'loose' (an engine unit: a piece off the
  // core is still a body its nodes carry - it rides them, prop and all - but three loose points are not), 'crush' (the
  // spinner: it goes with its engine unless the engine's own nodes are crushed under it)
  function leaves(c, D, live, adj) {
    const ns = c.nodes, rule = c.rule || 'piece';
    if (rule === 'piece' && D.pc) { let off = 0; for (const i of ns) if (D.pc[i] !== 0) off++; if (off * 2 > ns.length || (off && ns.length <= 2)) return 'off'; }
    if (rule !== 'crush' && adj && D.broken) { let loose = 0; for (const i of ns) { const A = adj[i]; if (A && A.length && A.every(bi => D.broken[bi])) loose++; }
      if (loose * 2 > ns.length || (loose && ns.length <= 2)) return 'loose'; }
    if (rule === 'loose') return null;
    let k = 0, worst = 0;
    for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) {
      const i = ns[a] * 3, j = ns[b] * 3;
      const d = Math.abs(Math.hypot(live[i] - live[j], live[i + 1] - live[j + 1], live[i + 2] - live[j + 2]) - c.L0[k++]);
      if (d > worst) worst = d;
    }
    c.crush = worst;
    return worst > (c.crushAt || CRUSH) ? 'crushed' : null;
  }

  // ---- THE RIGID FIT of a carrying set: R (row-major 3x3) and the centroids, rest -> live ----
  function fit(nodes, rest, live) {
    const m = nodes.length, A = new Float64Array(9);
    let rx = 0, ry = 0, rz = 0, lx = 0, ly = 0, lz = 0;
    for (const i of nodes) { rx += rest[i * 3]; ry += rest[i * 3 + 1]; rz += rest[i * 3 + 2]; lx += live[i * 3]; ly += live[i * 3 + 1]; lz += live[i * 3 + 2]; }
    rx /= m; ry /= m; rz /= m; lx /= m; ly /= m; lz /= m;
    for (const i of nodes) { const px = live[i * 3] - lx, py = live[i * 3 + 1] - ly, pz = live[i * 3 + 2] - lz, qx = rest[i * 3] - rx, qy = rest[i * 3 + 1] - ry, qz = rest[i * 3 + 2] - rz;
      A[0] += px * qx; A[1] += px * qy; A[2] += px * qz; A[3] += py * qx; A[4] += py * qy; A[5] += py * qz; A[6] += pz * qx; A[7] += pz * qy; A[8] += pz * qz; }
    const Q = new Float64Array([0, 0, 0, 1]), Rm = new Float64Array(9);
    if (m >= 3) SB.polar(A, 0, Q, 0, Rm, 0); else { Rm[0] = Rm[4] = Rm[8] = 1; }
    return { R: Rm, q: Q, cr: [rx, ry, rz], cl: [lx, ly, lz] };
  }

  // ---- A DEBRIS BODY: made at the release. c: the candidate; pose { x (its origin, world), q (world from its own
  // frame) }, its box in its own frame (lo, hi: the drawn part's extent about x), its mass; vel: the carrying set's
  // velocities (n x 3, or null), the set's centroid now; seed ----
  function release(W, c, pose, box, mass, live, vel, floats) {
    const r = rng(hash(c.id, W.t, pose.x[0], pose.x[2]));
    const ns = c.nodes, m = ns.length;
    // the set's velocity: its mean, and its turn (least squares: sum r x (v - v~) = I w, I = sum (|r|^2 1 - r r^T))
    let vx = 0, vy = 0, vz = 0, cx = 0, cy = 0, cz = 0;
    for (const i of ns) { cx += live[i * 3]; cy += live[i * 3 + 1]; cz += live[i * 3 + 2]; if (vel) { vx += vel[i * 3]; vy += vel[i * 3 + 1]; vz += vel[i * 3 + 2]; } }
    cx /= m; cy /= m; cz /= m; vx /= m; vy /= m; vz /= m;
    const w = [0, 0, 0];
    if (vel && m >= 3) {
      const I = new Float64Array(9), L = [0, 0, 0];
      for (const i of ns) { const x = live[i * 3] - cx, y = live[i * 3 + 1] - cy, z = live[i * 3 + 2] - cz, ux = vel[i * 3] - vx, uy = vel[i * 3 + 1] - vy, uz = vel[i * 3 + 2] - vz;
        L[0] += y * uz - z * uy; L[1] += z * ux - x * uz; L[2] += x * uy - y * ux;
        const s = x * x + y * y + z * z; I[0] += s - x * x; I[4] += s - y * y; I[8] += s - z * z; I[1] -= x * y; I[2] -= x * z; I[5] -= y * z; }
      I[3] = I[1]; I[6] = I[2]; I[7] = I[5];
      const s = solve3(I, L); if (s) { w[0] = s[0]; w[1] = s[1]; w[2] = s[2]; }
      // (a set of loose nodes whips: TREE-CRASH's torn pieces reach tens of rad/s - a cowl or a spinner does not spin so)
      const wl = Math.hypot(w[0], w[1], w[2]); if (wl > W_CAP) { w[0] *= W_CAP / wl; w[1] *= W_CAP / wl; w[2] *= W_CAP / wl; }
    }
    // the part's own point's velocity on the set's motion (v + w x (x - c)), the kick away from the frame (from the set's
    // centroid to the part, else up) and the tumble
    const ox = pose.x[0] - cx, oy = pose.x[1] - cy, oz = pose.x[2] - cz;
    let kx = ox, ky = oy + 0.3, kz = oz; const kl = Math.hypot(kx, ky, kz) || 1; kx /= kl; ky /= kl; kz /= kl;
    const kick = KICK * (0.6 + 0.8 * r());
    const B = { id: c.id, kind: c.kind, x: pose.x.slice(), q: pose.q.slice(),
      v: capV([vx + w[1] * oz - w[2] * oy + kick * kx, vy + w[2] * ox - w[0] * oz + kick * ky, vz + w[0] * oy - w[1] * ox + kick * kz], Math.hypot(vx, vy, vz) + V_OVER),
      w: [w[0] + SPIN * (2 * r() - 1), w[1] + SPIN * (2 * r() - 1), w[2] + SPIN * (2 * r() - 1)],
      lo: box.lo.slice(), hi: box.hi.slice(), m: Math.max(0.2, mass), floats: !!floats,
      asleep: false, sunk: false, tRest: 0, age: 0, contact: false, wet: false, why: c.why, sv: 1, sw: 1 };
    const hx = Math.max(0.01, (box.hi[0] - box.lo[0]) / 2), hy = Math.max(0.01, (box.hi[1] - box.lo[1]) / 2), hz = Math.max(0.01, (box.hi[2] - box.lo[2]) / 2);
    B.Ib = [B.m * (hy * hy + hz * hz) / 3, B.m * (hx * hx + hz * hz) / 3, B.m * (hx * hx + hy * hy) / 3];
    B.A = 4 * Math.max(hx * hy, hy * hz, hx * hz) * 0.7;
    // G2045 (DMG-SETTLE): ITS CONTACT IS THE DRAWN PART'S OWN SHAPE - box.pts, its support points (support(): the drawn
    // vertex farthest out along each of 26 directions) when the release has its triangles; the box's eight corners only
    // without them (a part with no drawing: the gate's frame-sized candidates). On its box's corners a wheel and its leg
    // (an L) came to rest on an EMPTY corner of the box: the drawn wheel 30 cm up, held by nothing drawn (6 of 20 seeded
    // drops, tools/_dmg_settle_check.js)
    B.pts = [];
    if (box.pts && box.pts.length >= 4) for (const q of box.pts) B.pts.push([q[0], q[1], q[2]]);
    else for (const X of [box.lo[0], box.hi[0]]) for (const Y of [box.lo[1], box.hi[1]]) for (const Z of [box.lo[2], box.hi[2]]) B.pts.push([X, Y, Z]);
    c.gone = true; c.body = B;
    W.bodies.push(B);
    return B;
  }
  // G2045: THE SUPPORT POINTS of a drawn part: pos (x, y, z a vertex, the body's own frame), n vertices -> the vertex
  // farthest out along each of SUP_N directions (the 26 of a cube's faces, edges and corners and a 256-point Fibonacci
  // sphere), each once: its convex hull, sampled (the 26 alone kept 10 points of a wheel and its leg, and the tyre's
  // inner face sank 10 cm between them) - a part rests on what is drawn, a thin one on its few extremes
  const DIRS = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (a || b || c) { const l = Math.hypot(a, b, c); DIRS.push([a / l, b / l, c / l]); }
  for (let i = 0; i < 256; i++) { const y = 1 - (2 * i + 1) / 256, r = Math.sqrt(1 - y * y), t = i * Math.PI * (3 - Math.sqrt(5)); DIRS.push([r * Math.cos(t), y, r * Math.sin(t)]); }
  const SUP_N = DIRS.length;
  const DX = new Float64Array(DIRS.length * 3); DIRS.forEach((d, i) => { DX[i * 3] = d[0]; DX[i * 3 + 1] = d[1]; DX[i * 3 + 2] = d[2]; });
  function support(pos, n) {
    // (the places first, welded on a 5 mm grid: the snapshot repeats each place by every triangle meeting there - a 30k
    // vertex part was 61 ms over the directions, its ~5k places a few)
    const seen = new Map(), U = [];
    for (let v = 0; v < n; v++) { const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) continue;
      const key = (Math.round(x * 200) + 4096) * 67108864 + (Math.round(y * 200) + 4096) * 8192 + (Math.round(z * 200) + 4096);
      if (!seen.has(key)) { seen.set(key, U.length); U.push(x, y, z); } }
    const m = U.length / 3, nd = DIRS.length, best = new Float64Array(nd).fill(-Infinity), at = new Int32Array(nd).fill(-1);
    for (let v = 0; v < m; v++) { const x = U[v * 3], y = U[v * 3 + 1], z = U[v * 3 + 2];
      for (let d = 0, o = 0; d < nd; d++, o += 3) { const s = x * DX[o] + y * DX[o + 1] + z * DX[o + 2]; if (s > best[d]) { best[d] = s; at[d] = v; } } }
    const out = [], took = new Set();
    for (const v of at) if (v >= 0 && !took.has(v)) { took.add(v); out.push([U[v * 3], U[v * 3 + 1], U[v * 3 + 2]]); }
    return out;
  }
  // the ground's plane under a body (G0: height at its centre, d/dx, d/dz - over GP_D either side)
  const GP_D = 0.25, _gp = new Float64Array(3);
  function groundPlane(B, env) {
    const x = B.x[0], z = B.x[2], g = env.ground(x, z);
    _gp[0] = g; _gp[1] = (env.ground(x + GP_D, z) - g) / GP_D; _gp[2] = (env.ground(x, z + GP_D) - g) / GP_D;
    return _gp;
  }
  // G2045: IS A BODY HELD where it lies? Its centre (x, z) inside the hull of its points on the surface (within SUP_TOL),
  // grown by SUP_IN: a part on one point or a line of them is balanced on nothing - it tips, it does not sleep there
  const SUP_TOL = 0.01, SUP_IN = 0.01;
  const _hp = [];
  function held(B, R, env, hw) {
    _hp.length = 0;
    for (const pl of B.pts) {
      const rx = R[0] * pl[0] + R[1] * pl[1] + R[2] * pl[2], ry = R[3] * pl[0] + R[4] * pl[1] + R[5] * pl[2], rz = R[6] * pl[0] + R[7] * pl[1] + R[8] * pl[2];
      const px = B.x[0] + rx, pz = B.x[2] + rz;
      let gh = _gp[0] + _gp[1] * rx + _gp[2] * rz; if (B.floats && hw != null && Number.isFinite(hw) && hw > gh) gh = hw;
      if (B.x[1] + ry - gh < SUP_TOL) _hp.push([px, pz]);
    }
    return inHull2(_hp, B.x[0], B.x[2], SUP_IN);
  }
  // (x, z) within m of the convex hull of P (2-D, monotone chain)
  function inHull2(P, x, z, m) {
    if (!P.length) return false;
    const S = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const H = [];
    for (const q of S) { while (H.length >= 2 && cr(H[H.length - 2], H[H.length - 1], q) <= 0) H.pop(); H.push(q); }
    for (let i = S.length - 2, t = H.length + 1; i >= 0; i--) { const q = S[i]; while (H.length >= t && cr(H[H.length - 2], H[H.length - 1], q) <= 0) H.pop(); H.push(q); }
    if (H.length > 1) H.pop();
    // inside, or within m of an edge (a point or a segment: its distance)
    let inside = H.length >= 3;
    for (let i = 0; i < H.length && inside; i++) { const a = H[i], b = H[(i + 1) % H.length]; if (cr(a, b, [x, z]) < 0) inside = false; }
    if (inside) return true;
    let d = Infinity;
    for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez;
      const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)) : 0;
      d = Math.min(d, Math.hypot(x - a[0] - t * ex, z - a[1] - t * ez)); }
    return d <= m;
  }
  // the part's speed held to its set's own plus V_OVER (the turn's lever on a whipped set, not a launch)
  function capV(v, max) { const l = Math.hypot(v[0], v[1], v[2]); if (l > max) { v[0] *= max / l; v[1] *= max / l; v[2] *= max / l; } return v; }
  function solve3(A, b) {
    const a = A, det = a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
    if (!(Math.abs(det) > 1e-9)) return null;
    const inv = [(a[4] * a[8] - a[5] * a[7]) / det, (a[2] * a[7] - a[1] * a[8]) / det, (a[1] * a[5] - a[2] * a[4]) / det,
                 (a[5] * a[6] - a[3] * a[8]) / det, (a[0] * a[8] - a[2] * a[6]) / det, (a[2] * a[3] - a[0] * a[5]) / det,
                 (a[3] * a[7] - a[4] * a[6]) / det, (a[1] * a[6] - a[0] * a[7]) / det, (a[0] * a[4] - a[1] * a[3]) / det];
    return [inv[0] * b[0] + inv[1] * b[1] + inv[2] * b[2], inv[3] * b[0] + inv[4] * b[1] + inv[5] * b[2], inv[6] * b[0] + inv[7] * b[1] + inv[8] * b[2]];
  }
  // a quaternion (x, y, z, w) -> row-major 3x3
  function rotOf(q, R) {
    const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    R[0] = 1 - 2 * (yy + zz); R[1] = 2 * (xy - wz); R[2] = 2 * (xz + wy);
    R[3] = 2 * (xy + wz); R[4] = 1 - 2 * (xx + zz); R[5] = 2 * (yz - wx);
    R[6] = 2 * (xz - wy); R[7] = 2 * (yz + wx); R[8] = 1 - 2 * (xx + yy);
    return R;
  }

  // ---- THE STEP: every body awake, at DT a substep, for the frame's dt. env: { ground(x, z) -> m, water(x, z) -> m or
  // null (no water there) } ----
  const _R = new Float64Array(9);
  function step(W, dt, env) {
    if (!W.bodies.length) return 0;
    W.acc = Math.min(W.acc + Math.max(0, dt), 0.25);
    let n = 0;
    while (W.acc >= DT) { W.acc -= DT; W.t += DT; n++; for (const B of W.bodies) if (!B.asleep) sub(B, env); }
    for (const B of W.bodies) if (B.asleep && B.floats && B.wet && env.water) {   // a floating piece rides the surface
      const h = env.water(B.x[0], B.x[2]); if (h != null && Number.isFinite(h)) B.x[1] = h + B.draft;
    }
    return n;
  }
  function sub(B, env) {
    const R = rotOf(B.q, _R);
    // gravity, the medium's drag and (in water) its buoyancy: the body's centre below the surface
    const hw = env.water ? env.water(B.x[0], B.x[2]) : null;
    const wet = hw != null && Number.isFinite(hw) && B.x[1] < hw;
    B.wet = wet;
    const rho = wet ? RHO_WATER : RHO_AIR, sp = Math.hypot(B.v[0], B.v[1], B.v[2]);
    const kd = 0.5 * rho * CD * B.A * sp / B.m;
    let ay = -G;
    if (wet) ay += B.floats ? 2.2 * G : 0.85 * G;    // a light part floats up; a metal one sinks slowly (its weight, ~15 % past the water it displaces)
    // (the drag implicit: in water a fast part's rate is ~1000 / s, and the explicit step flipped its velocity each substep)
    const dk = 1 / (1 + kd * DT);
    B.v[0] *= dk; B.v[1] = (B.v[1] + ay * DT) * dk; B.v[2] *= dk;
    const wd = Math.exp(-DT * (wet ? 3 : 0.2));
    B.w[0] *= wd; B.w[1] *= wd; B.w[2] *= wd;
    B.x[0] += B.v[0] * DT; B.x[1] += B.v[1] * DT; B.x[2] += B.v[2] * DT;
    // q += 1/2 (w, 0) q
    const [qx, qy, qz, qw] = B.q, wx = B.w[0], wy = B.w[1], wz = B.w[2], h = 0.5 * DT;
    B.q[0] += h * (wx * qw + wy * qz - wz * qy); B.q[1] += h * (wy * qw + wz * qx - wx * qz);
    B.q[2] += h * (wz * qw + wx * qy - wy * qx); B.q[3] += h * (-wx * qx - wy * qy - wz * qz);
    const ql = Math.hypot(B.q[0], B.q[1], B.q[2], B.q[3]) || 1; B.q[0] /= ql; B.q[1] /= ql; B.q[2] /= ql; B.q[3] /= ql;
    // the contacts: the box's corners under the ground (or, for a floating part, the water's surface)
    rotOf(B.q, R);
    let pen = 0; B.contact = false;
    const Iw = invI(B, R);
    // (G2045: the ground under the body as a plane - its height at the centre and its slope, three samples a substep
    // whatever the points; on flat ground exactly the ground, as the eight corners read it)
    const G0 = groundPlane(B, env);
    for (const pl of B.pts) {
      const rx = R[0] * pl[0] + R[1] * pl[1] + R[2] * pl[2], ry = R[3] * pl[0] + R[4] * pl[1] + R[5] * pl[2], rz = R[6] * pl[0] + R[7] * pl[1] + R[8] * pl[2];
      const px = B.x[0] + rx, py = B.x[1] + ry, pz = B.x[2] + rz;
      let gh = G0[0] + G0[1] * rx + G0[2] * rz;
      if (B.floats && hw != null && Number.isFinite(hw) && hw > gh) gh = hw;
      const d = gh - py;
      if (!(d > 0)) continue;
      B.contact = true; if (d > pen) pen = d;
      // the point's velocity, v + w x r
      const ux = B.v[0] + B.w[1] * rz - B.w[2] * ry, uy = B.v[1] + B.w[2] * rx - B.w[0] * rz, uz = B.v[2] + B.w[0] * ry - B.w[1] * rx;
      if (uy >= 0) continue;
      // normal impulse along +y: k = 1/m + n . ((I^-1 (r x n)) x r)
      const cnx = -rz, cnz = rx;                       // r x (0, 1, 0)
      const ix = Iw[0] * cnx + Iw[2] * cnz, iy = Iw[3] * cnx + Iw[5] * cnz, iz = Iw[6] * cnx + Iw[8] * cnz;
      const kn = 1 / B.m + (iz * rx - ix * rz);
      // (a slow contact does not bounce: restitution on a resting corner keeps a body rocking for ever)
      const jn = -(1 + (uy < -SLOW ? BOUNCE : 0)) * uy / Math.max(1e-6, kn);
      applyImp(B, Iw, 0, jn, 0, rx, ry, rz);
      // friction: against the point's sliding, at most MU jn
      const tx = ux, tz = uz, tl = Math.hypot(tx, tz);
      if (tl > 1e-6) {
        const ex = tx / tl, ez = tz / tl;
        const ctx = ry * ez, cty = rz * ex - rx * ez, ctz = -ry * ex;        // r x t
        const jx = Iw[0] * ctx + Iw[1] * cty + Iw[2] * ctz, jy = Iw[3] * ctx + Iw[4] * cty + Iw[5] * ctz, jz = Iw[6] * ctx + Iw[7] * cty + Iw[8] * ctz;
        const kt = 1 / B.m + ((jy * rz - jz * ry) * ex + (jx * ry - jy * rx) * ez);
        const jt = Math.min(tl / Math.max(1e-6, kt), MU * jn);
        applyImp(B, Iw, -jt * ex, 0, -jt * ez, rx, ry, rz);
      }
    }
    if (pen > 0) B.x[1] += pen;
    // G1862.1 (the clip, GATE DMGWRECK: a Jodel's canopy pane fell into its own cabin): THE WRECK'S LIVE CABIN BAYS ARE
    // SOLID (env.solid, WRECK_DEBRIS.solidOf): a corner inside one is pushed out through the bay's nearest wall, its
    // velocity into that wall taken by an impulse (no bounce) and friction along it - as the ground does
    if (env.solid) {
      let px0 = 0, py0 = 0, pz0 = 0, pd = 0;
      for (const pl of B.pts) {
        const rx = R[0] * pl[0] + R[1] * pl[1] + R[2] * pl[2], ry = R[3] * pl[0] + R[4] * pl[1] + R[5] * pl[2], rz = R[6] * pl[0] + R[7] * pl[1] + R[8] * pl[2];
        const H = env.solid(B.x[0] + rx, B.x[1] + ry, B.x[2] + rz);
        if (!H) continue;
        B.contact = true;
        if (H.d > pd) { pd = H.d; px0 = H.nx; py0 = H.ny; pz0 = H.nz; }
        const nx = H.nx, ny = H.ny, nz = H.nz;
        const ux = B.v[0] + B.w[1] * rz - B.w[2] * ry, uy = B.v[1] + B.w[2] * rx - B.w[0] * rz, uz = B.v[2] + B.w[0] * ry - B.w[1] * rx;
        const un = ux * nx + uy * ny + uz * nz;
        if (un >= 0) continue;
        const cx = ry * nz - rz * ny, cy = rz * nx - rx * nz, cz = rx * ny - ry * nx;          // r x n
        const ix = Iw[0] * cx + Iw[1] * cy + Iw[2] * cz, iy = Iw[3] * cx + Iw[4] * cy + Iw[5] * cz, iz = Iw[6] * cx + Iw[7] * cy + Iw[8] * cz;
        const kn = 1 / B.m + ((iy * rz - iz * ry) * nx + (iz * rx - ix * rz) * ny + (ix * ry - iy * rx) * nz);
        const jn = -un / Math.max(1e-6, kn);
        applyImp(B, Iw, jn * nx, jn * ny, jn * nz, rx, ry, rz);
        const tx = ux - un * nx, ty = uy - un * ny, tz = uz - un * nz, tl = Math.hypot(tx, ty, tz);
        if (tl > 1e-6) { const jt = Math.min(tl * B.m, MU * jn); applyImp(B, Iw, -jt * tx / tl, -jt * ty / tl, -jt * tz / tl, rx, ry, rz); }
      }
      if (pd > 0) { const k = Math.min(pd, SOLID_PUSH); B.x[0] += px0 * k; B.x[1] += py0 * k; B.x[2] += pz0 * k; }   // (eased out: SOLID_PUSH a substep)
    }
    if (B.contact) {                                   // the ground's rolling and scuffing losses: a body on it settles
      const cd = Math.exp(-DT * CONTACT_DAMP); B.w[0] *= cd; B.w[1] *= cd; B.w[2] *= cd;
    }
    B.age += DT;
    // (the speeds low-passed over ~0.2 s: a resting box's corners trade impulses substep to substep, a jitter, not a motion)
    const lp = DT / 0.2;
    B.sv += (Math.hypot(B.v[0], B.v[1], B.v[2]) - B.sv) * lp; B.sw += (Math.hypot(B.w[0], B.w[1], B.w[2]) - B.sw) * lp;
    const slow = B.sv < REST_V && B.sw < REST_W;
    // (G2045: on the ground it rests only HELD - its centre over what it lies on; a part slowed by the contact's damping
    // while it tips over an edge slept there, standing on nothing)
    B.tRest = slow && ((B.floats && wet) || (B.contact && held(B, R, env, hw))) ? B.tRest + DT : 0;
    // a part heavier than water, its top half a metre under the surface: SUNK - out of sight, at rest (it would only reach
    // the bed unseen)
    if (wet && !B.floats && hw - B.x[1] > SUNK + Math.max(B.hi[0] - B.lo[0], B.hi[1] - B.lo[1], B.hi[2] - B.lo[2]) / 2) B.sunk = true;
    if (B.tRest > REST_T || B.age > LIFE || B.sunk) {
      B.asleep = true; B.v[0] = B.v[1] = B.v[2] = 0; B.w[0] = B.w[1] = B.w[2] = 0;
      B.draft = hw != null && Number.isFinite(hw) ? B.x[1] - hw : 0;
    }
  }
  // the world inverse inertia, R Ib^-1 R^T (row-major)
  const _I = new Float64Array(9);
  function invI(B, R) {
    const a = 1 / B.Ib[0], b = 1 / B.Ib[1], c = 1 / B.Ib[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      _I[i * 3 + j] = R[i * 3] * a * R[j * 3] + R[i * 3 + 1] * b * R[j * 3 + 1] + R[i * 3 + 2] * c * R[j * 3 + 2];
    return _I;
  }
  function applyImp(B, Iw, jx, jy, jz, rx, ry, rz) {
    B.v[0] += jx / B.m; B.v[1] += jy / B.m; B.v[2] += jz / B.m;
    const tx = ry * jz - rz * jy, ty = rz * jx - rx * jz, tz = rx * jy - ry * jx;
    B.w[0] += Iw[0] * tx + Iw[1] * ty + Iw[2] * tz; B.w[1] += Iw[3] * tx + Iw[4] * ty + Iw[5] * tz; B.w[2] += Iw[6] * tx + Iw[7] * ty + Iw[8] * tz;
  }
  // the lowest corner of a body over the ground (m; < 0 under it): the gate's rest check
  function clearance(B, env) {
    const R = rotOf(B.q, new Float64Array(9));
    let lo = Infinity;
    for (const pl of B.pts) {
      const px = B.x[0] + R[0] * pl[0] + R[1] * pl[1] + R[2] * pl[2], py = B.x[1] + R[3] * pl[0] + R[4] * pl[1] + R[5] * pl[2], pz = B.x[2] + R[6] * pl[0] + R[7] * pl[1] + R[8] * pl[2];
      lo = Math.min(lo, py - env.ground(px, pz));
    }
    return lo;
  }
  // a heal (a reset): every part back on, no body
  function heal(W, P) { W.bodies.length = 0; W.v = W.vB = -1; W.acc = 0; W.strikes = null; if (P) for (const c of P.parts) { c.gone = false; c.why = null; c.body = null; c.crush = 0; } }

  // ---- THE PROP STRIKE: what a seized engine's prop does. info { rpm (before the strike), V (the hub's speed, m/s),
  // M (the aeroplane's mass), D (the disc, m), nb (blades), what ('ground' | 'trunk'), eng (its index), t } ----
  // G1861.2 (the user: "broken wood props and bent metal props, that adds a lot"): THE BUILD'S PROP MATERIAL decides.
  // info.material (spec.prop.material): aluminium BENDS - every blade's tip curled aft and against the rotation, the more
  // the harder the strike, none breaks; wood (and carbon, the boutique woods) BREAKS - every blade snaps at a seeded 25-45 %
  // of its radius, the stub left at the hub, the outer piece thrown as debris. info.wet: a strike in the water - a metal
  // blade bends less (x WET_K), a wooden one breaks only past E_BREAK (a slow one in the water just stops)
  const WET_K = 0.4, CUT0 = 0.25, CUT1 = 0.2;
  const isMetal = m => /alu|steel|metal|titan/i.test(m || '');
  // G1861.5 (the coordinator: "one physics, one picture"): DMG-DRIVE's VERDICT DRAWN. When the solver grades the strike
  // (33_drive.js: sim.damage().drive[k] - strike null / 'brush' / 'bent' / 'stoppage' / 'separation', strikeAt { t, what,
  // surf, bite, biteR, tip, rpm }, bladeLost), the prop draws that grade instead of deciding its own (strike() below
  // stays for a solver without DRIVE):
  //   brush       the tips scuffed: a slight curl (CURL_B), nothing lost;
  //   bent        curled back, by the bite: k = (biteR - brush) / (the surface's stop - brush), CURL0 + CURL1 k a blade;
  //   stoppage    the prop stopped by the impact (its engine seized): a metal blade fully curled, a wooden one whole -
  //               its tips splintered (cut at 85-95 % of R) only where the tip reached the separation speed (DRIVE's);
  //   separation  ONE blade short by bladeLost (its piece a body), the rest as a stoppage.
  // The spinner's dent only at a stoppage or a separation. Seeded by the strike's own time: the same strike, the same
  // picture. `cut` 1 = the blade whole.
  const CURL_B = 0.06, DRV_BRUSH = 0.04, DRV_STOP = { soft: 0.15, water: 0.25, rigid: 0.04 }, DRV_SEP = { wood: 120, maple: 120, walnut: 120, carbon: 120, alu: 200 };
  const DRV_RANK = { brush: 1, bent: 2, stoppage: 3, separation: 4 };
  function fromDrive(dv, info) {
    const st = dv && dv.strike; if (!DRV_RANK[st]) return null;
    const at = dv.strikeAt || {}, nb = Math.max(1, info.nb | 0), metal = isMetal(info.material);
    const G0 = typeof GEN_DRIVE !== 'undefined' && GEN_DRIVE.strike ? GEN_DRIVE.strike : null;
    const stopR = ((G0 && G0.stop) || DRV_STOP)[at.surf || 'soft'] || DRV_STOP.soft, brushR = (G0 && G0.brush) || DRV_BRUSH;
    const sepTip = ((G0 && G0.sep) || DRV_SEP)[info.material] || (metal ? DRV_SEP.alu : DRV_SEP.wood);
    const k = st === 'bent' ? Math.max(0, Math.min(1, ((at.biteR || 0) - brushR) / Math.max(1e-3, stopR - brushR))) : st === 'brush' ? 0 : 1;
    const r = rng(hash(Math.round((at.t || 0) * 1000), info.eng | 0, nb, DRV_RANK[st]));
    const hard = st === 'stoppage' || st === 'separation', splinter = !metal && hard && (at.tip || 0) >= sepTip;
    const lostB = st === 'separation' ? Math.floor(r() * nb) % nb : -1;
    const curl = [], cut = [];
    for (let b = 0; b < nb; b++) {
      const j = 0.8 + 0.4 * r();
      curl.push(st === 'brush' ? CURL_B * j : st === 'bent' ? (CURL0 + CURL1 * k) * j : metal ? (CURL0 + CURL1) * j : 0);
      cut.push(b === lostB ? Math.max(0.05, 1 - (dv.bladeLost || 0.35)) : splinter ? 0.85 + 0.1 * r() : 1);
    }
    const breaks = cut.some(c => c < 1);
    return { drive: st, k, material: info.material || null, metal, wet: at.surf === 'water', breaks, lost: lostB, cut, curl,
             dent: hard ? DENT0 + DENT1 * k : 0, dentAz: r() * 2 * Math.PI, what: at.what || info.what, bite: at.bite, biteR: at.biteR, tip: at.tip, rpm: at.rpm };
  }
  function strike(info) {
    const R = info.D / 2, nb = Math.max(1, info.nb | 0), mB = 3.0 * Math.pow(info.D / 1.88, 2.5);   // ~3 kg a wooden blade of 1.88 m (genPropSynth's scale)
    const om = Math.max(0, info.rpm || 0) * 2 * Math.PI / 60, I = nb * mB * R * R / 3;
    const E = 0.5 * I * om * om + 0.5 * (info.M || 0) * (info.V || 0) * (info.V || 0);
    const r = rng(hash(E / 100, info.eng | 0, nb, info.what === 'trunk' ? 1 : 2));
    const metal = isMetal(info.material), wet = !!info.wet, k = Math.min(1, E / E_BREAK);
    const snaps = !metal && (!wet || E > E_BREAK);
    const curl = [], cut = [];
    for (let b = 0; b < nb; b++) {
      curl.push(metal ? (CURL0 + CURL1 * k) * (0.8 + 0.4 * r()) * (wet ? WET_K : 1) : 0);
      cut.push(snaps ? CUT0 + CUT1 * r() : 0);
    }
    return { E, Espin: 0.5 * I * om * om, Ehit: E - 0.5 * I * om * om, material: info.material || null, metal, wet,
             breaks: snaps, lost: snaps ? -2 : -1, cut, curl, dent: DENT0 + DENT1 * k, dentAz: r() * 2 * Math.PI, what: info.what };
  }
  // which blade a point of the prop is on: its azimuth about the shaft against the first blade's (az0); 'axis' unit
  // and 'u0' a unit vector across it (both in the prop's own frame, its hub the origin)
  function azOf(x, y, z, ax, u0) {
    const d = x * ax[0] + y * ax[1] + z * ax[2], px = x - d * ax[0], py = y - d * ax[1], pz = z - d * ax[2];
    const v0 = [ax[1] * u0[2] - ax[2] * u0[1], ax[2] * u0[0] - ax[0] * u0[2], ax[0] * u0[1] - ax[1] * u0[0]];
    return { az: Math.atan2(px * v0[0] + py * v0[1] + pz * v0[2], px * u0[0] + py * u0[1] + pz * u0[2]), r: Math.hypot(px, py, pz), d };
  }
  // the prop's own frame read off its blades (base: the prop part's vertices about the hub; axis its shaft): the radius,
  // the first blade's direction (the vertex farthest from the shaft) and the blade count (the azimuth histogram's peaks
  // among the outer third, at most 6)
  function bladeFrame(base, nv, axis) {
    let far = -1, rM = 0;
    for (let v = 0; v < nv; v++) { const x = base[v * 3], y = base[v * 3 + 1], z = base[v * 3 + 2], d = x * axis[0] + y * axis[1] + z * axis[2];
      const r = Math.hypot(x - d * axis[0], y - d * axis[1], z - d * axis[2]); if (r > rM) { rM = r; far = v; } }
    if (far < 0) return null;
    const x = base[far * 3], y = base[far * 3 + 1], z = base[far * 3 + 2], d = x * axis[0] + y * axis[1] + z * axis[2];
    const u0 = [(x - d * axis[0]) / rM, (y - d * axis[1]) / rM, (z - d * axis[2]) / rM];
    // the outer third's azimuths, 5-degree bins smoothed over 25 degrees (a blade's chord spreads its own over a few bins)
    const H0 = new Float64Array(72), H = new Float64Array(72), az0 = new Float64Array(72);
    for (let v = 0; v < nv; v++) { const a = azOf(base[v * 3], base[v * 3 + 1], base[v * 3 + 2], axis, u0); if (a.r < 0.66 * rM) continue;
      const b = ((Math.floor((a.az + Math.PI) / (2 * Math.PI) * 72) % 72) + 72) % 72; H0[b]++; az0[b] += a.az; }
    for (let i = 0; i < 72; i++) for (let k = -2; k <= 2; k++) H[i] += H0[(i + k + 72) % 72];
    let nb = 0; const top = Math.max(...H);
    for (let i = 0; i < 72; i++) { const l = H[(i + 71) % 72], c = H[i], r2 = H[(i + 1) % 72]; if (c > 0.25 * top && c >= l && c > r2) nb++; }
    // the first blade's own direction: the mean azimuth of the outer points near u0 (the farthest vertex sits on an edge)
    let sa = 0, sn = 0; for (let i = 0; i < 72; i++) if (H0[i]) { const a = az0[i] / H0[i]; if (Math.abs(a) < Math.PI / 6) { sa += az0[i]; sn += H0[i]; } }
    const a1 = sn ? sa / sn : 0, w0 = [axis[1] * u0[2] - axis[2] * u0[1], axis[2] * u0[0] - axis[0] * u0[2], axis[0] * u0[1] - axis[1] * u0[0]];
    const u1 = [u0[0] * Math.cos(a1) + w0[0] * Math.sin(a1), u0[1] * Math.cos(a1) + w0[1] * Math.sin(a1), u0[2] * Math.cos(a1) + w0[2] * Math.sin(a1)];
    return { R: rM, u0: u1, nb: Math.max(1, Math.min(6, nb || 2)) };
  }
  const bladeOf = (az, nb) => ((Math.round(az / (2 * Math.PI / nb)) % nb) + nb) % nb;
  // THE CURL: each blade bends past CURL_S0 of the radius, aft along the shaft (toward the engine: -axis), its curvature
  // growing toward the tip - the angle at a length u past the curl's start is curl[b] (u / L)^2 (L the curled length), so
  // the blade's centre line is the integral of (cos, sin) of it: a bent blade keeps its length, as a bent metal blade
  // does (a table of 64 steps a blade). A point keeps its offset off the blade's line (the chord, the thickness). base -> pos
  // (G1861.2: aft AND against the rotation - a blade struck while turning folds back from its spin; sense the engine's hand,
  // TWIST of the aft travel goes round the shaft)
  const TWIST = 0.6;
  function curlBlades(base, pos, nv, axis, BF, curl, hubR, sense) {
    const sg = -(sense || 1) * TWIST;
    const r0 = CURL_S0 * BF.R, L = BF.R - r0, NS = 64, tabs = curl.map(th => {
      const t = new Float64Array((NS + 1) * 2); let x = 0, y = 0;
      for (let i = 1; i <= NS; i++) { const u = (i - 0.5) / NS, a = th * u * u; x += Math.cos(a) * L / NS; y += Math.sin(a) * L / NS; t[i * 2] = x; t[i * 2 + 1] = y; }
      return t; });
    const U0 = BF.u0, V0 = [axis[1] * U0[2] - axis[2] * U0[1], axis[2] * U0[0] - axis[0] * U0[2], axis[0] * U0[1] - axis[1] * U0[0]];
    for (let v = 0; v < nv; v++) {
      const x = base[v * 3], y = base[v * 3 + 1], z = base[v * 3 + 2];
      const a = azOf(x, y, z, axis, BF.u0);
      const b = bladeOf(a.az, BF.nb), th = curl[b] || 0;
      // (G1861.6: the bend's frame is the BLADE'S - its centre line's direction db, at b x 2 pi / nb from u0 - not the
      // vertex's own radial: a point off the centre line (the chord) tilted it, and with the twist the bend's direction
      // then varied along the blade and its length drifted, 0.846 / 0.856 m for 0.850. A point's offset from the centre
      // line is carried rigidly, so every line along the blade keeps its length)
      const azb = b * 2 * Math.PI / BF.nb, ca = Math.cos(azb), sa = Math.sin(azb);
      const dbx = ca * U0[0] + sa * V0[0], dby = ca * U0[1] + sa * V0[1], dbz = ca * U0[2] + sa * V0[2];
      const rr = x * dbx + y * dby + z * dbz;                         // along the blade's centre line from the hub
      if (a.r <= hubR || rr <= r0 || !th) { pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; continue; }
      // along the blade (u past the start) and the bend there: the integrated centre line (lx, ly)
      const u = Math.min(1, (rr - r0) / L), f = u * NS, i0 = Math.min(NS - 1, Math.floor(f)), w = f - i0, T = tabs[b];
      const lx = T[i0 * 2] * (1 - w) + T[(i0 + 1) * 2] * w, ly = T[i0 * 2 + 1] * (1 - w) + T[(i0 + 1) * 2 + 1] * w;
      const over = Math.max(0, rr - BF.R), ang = th * u * u, c = Math.cos(ang), sn = Math.sin(ang);
      const along = r0 + lx + over * c, aft = ly + over * sn, dr = along - rr;
      // the bend's plane: the blade's direction and the unit (-axis + sg x the blade's turning direction) - orthonormal
      const tx = axis[1] * dbz - axis[2] * dby, ty = axis[2] * dbx - axis[0] * dbz, tz = axis[0] * dby - axis[1] * dbx, nn = Math.sqrt(1 + sg * sg);
      const bx = (-axis[0] + sg * tx) / nn, by = (-axis[1] + sg * ty) / nn, bz = (-axis[2] + sg * tz) / nn;
      pos[v * 3] = x + dr * dbx + aft * bx; pos[v * 3 + 1] = y + dr * dby + aft * by; pos[v * 3 + 2] = z + dr * dbz + aft * bz;
    }
  }
  // THE DENT: the spinner's points facing the strike (their radial direction within ~70 deg of dentAz) pushed in toward
  // the shaft, by depth x the facing x how far forward along the cone they are (the nose takes it). base -> pos
  function dentSpinner(base, pos, nv, axis, BF, depth, dentAz) {
    let dMin = Infinity, dMax = -Infinity;
    for (let v = 0; v < nv; v++) { const d = base[v * 3] * axis[0] + base[v * 3 + 1] * axis[1] + base[v * 3 + 2] * axis[2]; if (d < dMin) dMin = d; if (d > dMax) dMax = d; }
    const span = Math.max(1e-3, dMax - dMin);
    for (let v = 0; v < nv; v++) {
      const x = base[v * 3], y = base[v * 3 + 1], z = base[v * 3 + 2];
      const a = azOf(x, y, z, axis, BF.u0);
      const face = Math.cos(a.az - dentAz), k = face > 0.35 ? (face - 0.35) / 0.65 : 0;
      const along = (a.d - dMin) / span, push = depth * k * (0.35 + 0.65 * along) * Math.min(1, a.r / 0.02);
      if (!(push > 0) || a.r < 1e-4) { pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; continue; }
      const rx = (x - a.d * axis[0]) / a.r, ry = (y - a.d * axis[1]) / a.r, rz = (z - a.d * axis[2]) / a.r;
      const p2 = Math.min(push, 0.8 * a.r);
      pos[v * 3] = x - p2 * rx; pos[v * 3 + 1] = y - p2 * ry; pos[v * 3 + 2] = z - p2 * rz;
    }
  }

  // ---- G1863 THE COCKPIT CAMERA RULE: is the eye inside crushed structure? The fuselage's bays (rings i, i+1: the frame's
  // S<i><B|T><L|R> tags), the one the eye sits in at rest, and that bay live: the eye carried by the bay's rigid fit, and
  // read against the bay's live faces. CRUSHED when the eye stands within EYE_CLEAR of a wall, roof or floor (or outside
  // the bay), when the bay has lost a quarter of its volume, or when its nodes are on two pieces. The page then cuts to
  // the chase view (app.js): an eye pulled to "the nearest clear point" in a crushed cabin still looks at the inside of
  // the crush from a hand's breadth, and §8.5 asks for the outside view ----
  const EYE_CLEAR = 0.10, EYE_VOL = 0.75;
  function bays(def) {
    const T = {}; def.nodes.forEach((nd, i) => { const m = /^S(\d+)([BT])([LR])$/.exec(nd.tag || ''); if (m) T[m[1] + m[2] + m[3]] = i; });
    const out = []; for (let i = 0; T[(i + 1) + 'BL'] != null; i++) out.push({ i, n: [T[i + 'BL'], T[i + 'BR'], T[i + 'TR'], T[i + 'TL'], T[(i + 1) + 'BL'], T[(i + 1) + 'BR'], T[(i + 1) + 'TR'], T[(i + 1) + 'TL']] });
    return out;
  }
  const FACES = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  // how deep a point sits inside a bay's hexahedron (the least of its six faces' inward distances; < 0 outside) - the
  // pass-through probe's own measure (tools/_dmg_integrity_lib.js depth)
  // (walls: the side, roof and floor only - a bay's two ring faces are open onto its neighbours)
  function depth(p, B, x, y, z, walls) {
    let cx = 0, cy = 0, cz = 0; for (const i of B) { cx += p[i * 3]; cy += p[i * 3 + 1]; cz += p[i * 3 + 2]; } cx /= 8; cy /= 8; cz /= 8;
    let d = Infinity;
    for (let fi = walls ? 2 : 0; fi < 6; fi++) {
      const F = FACES[fi];
      const a = B[F[0]], b = B[F[1]], c = B[F[2]], e = B[F[3]];
      const fx = (p[a * 3] + p[b * 3] + p[c * 3] + p[e * 3]) / 4, fy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1] + p[e * 3 + 1]) / 4, fz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2] + p[e * 3 + 2]) / 4;
      const d1x = p[c * 3] - p[a * 3], d1y = p[c * 3 + 1] - p[a * 3 + 1], d1z = p[c * 3 + 2] - p[a * 3 + 2], d2x = p[e * 3] - p[b * 3], d2y = p[e * 3 + 1] - p[b * 3 + 1], d2z = p[e * 3 + 2] - p[b * 3 + 2];
      let nx = d1y * d2z - d1z * d2y, ny = d1z * d2x - d1x * d2z, nz = d1x * d2y - d1y * d2x; const ln = Math.hypot(nx, ny, nz) || 1e-9; nx /= ln; ny /= ln; nz /= ln;
      if ((cx - fx) * nx + (cy - fy) * ny + (cz - fz) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      d = Math.min(d, (x - fx) * nx + (y - fy) * ny + (z - fz) * nz);
    }
    return d;
  }
  // G1862.1: THE LIVE CABIN BAYS AS SOLIDS for the debris (env.solid): p the nodes' live places, bays the bays to hold
  // (the core's: every node on it). The faces' planes are made once a call (a frame); the returned test answers a point
  // inside a bay (inside all six faces) with its depth to the nearest WALL (the side, roof and floor - the two ring faces
  // are open onto the next bays) and that wall's outward normal; null outside every bay
  function solidOf(p, bays, v) {
    // (only a STILL cabin is solid: its nodes under SOLID_V - during the impact the bays sweep metres a frame, and a wall
    // refreshed once a frame made the rest depend on the frame rate; a pane settles into a cabin at rest, not mid-crash)
    if (v) { let vm = 0; for (const by of bays) for (const i of (by.n || by)) { const s = Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]); if (s > vm) vm = s; } if (vm > SOLID_V) return null; }
    const PL = [];
    for (const by of bays) {
      const B = by.n || by; let cx = 0, cy = 0, cz = 0;
      for (const i of B) { cx += p[i * 3]; cy += p[i * 3 + 1]; cz += p[i * 3 + 2]; } cx /= 8; cy /= 8; cz /= 8;
      const F6 = new Float64Array(36);
      for (let fi = 0; fi < 6; fi++) {
        const F = FACES[fi], a = B[F[0]], b = B[F[1]], c = B[F[2]], e = B[F[3]];
        const fx = (p[a * 3] + p[b * 3] + p[c * 3] + p[e * 3]) / 4, fy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1] + p[e * 3 + 1]) / 4, fz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2] + p[e * 3 + 2]) / 4;
        const d1x = p[c * 3] - p[a * 3], d1y = p[c * 3 + 1] - p[a * 3 + 1], d1z = p[c * 3 + 2] - p[a * 3 + 2], d2x = p[e * 3] - p[b * 3], d2y = p[e * 3 + 1] - p[b * 3 + 1], d2z = p[e * 3 + 2] - p[b * 3 + 2];
        let nx = d1y * d2z - d1z * d2y, ny = d1z * d2x - d1x * d2z, nz = d1x * d2y - d1y * d2x; const ln = Math.hypot(nx, ny, nz) || 1e-9; nx /= ln; ny /= ln; nz /= ln;
        if ((cx - fx) * nx + (cy - fy) * ny + (cz - fz) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }   // (inward)
        F6.set([fx, fy, fz, nx, ny, nz], fi * 6);
      }
      PL.push(F6);
    }
    const H = { d: 0, nx: 0, ny: 0, nz: 0 };
    return (x, y, z) => {
      let best = 0, hit = false;
      for (const F6 of PL) {
        let inMin = Infinity, wd = Infinity, wf = -1;
        for (let fi = 0; fi < 6; fi++) { const o = fi * 6, d = (x - F6[o]) * F6[o + 3] + (y - F6[o + 1]) * F6[o + 4] + (z - F6[o + 2]) * F6[o + 5];
          if (d < inMin) inMin = d; if (fi >= 2 && d < wd) { wd = d; wf = fi; } }
        if (!(inMin > 0) || wf < 0 || wd <= best) continue;
        best = wd; hit = true; const o = wf * 6; H.d = wd; H.nx = -F6[o + 3]; H.ny = -F6[o + 4]; H.nz = -F6[o + 5];
      }
      return hit ? H : null;
    };
  }
  // a hexahedron's volume (six tetrahedra about its first corner's diagonal)
  function vol(p, B) {
    const T6 = [[0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6], [0, 5, 1, 6]];
    let V = 0;
    for (const t of T6) { const a = B[t[0]] * 3, b = B[t[1]] * 3, c = B[t[2]] * 3, d = B[t[3]] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2], wx = p[d] - p[a], wy = p[d + 1] - p[a + 1], wz = p[d + 2] - p[a + 2];
      V += Math.abs(ux * (vy * wz - vz * wy) - uy * (vx * wz - vz * wx) + uz * (vx * wy - vy * wx)) / 6; }
    return V;
  }
  // the eye's cabin: eye the eye at rest in the def's frame (the crew's eye point); null if no bay holds it
  function cabin(def, eye) {
    const BY = bays(def), rest = new Float64Array(def.nodes.length * 3);
    def.nodes.forEach((nd, i) => { rest[i * 3] = nd.p[0]; rest[i * 3 + 1] = nd.p[1]; rest[i * 3 + 2] = nd.p[2]; });
    let best = null, bd = -Infinity;
    for (const B of BY) { const d = depth(rest, B.n, eye[0], eye[1], eye[2]); if (d > bd) { bd = d; best = B; } }
    if (!best || bd < 0) return null;
    return { bay: best.i, n: best.n, eye: eye.slice(), rest, d0: depth(rest, best.n, eye[0], eye[1], eye[2], true), v0: vol(rest, best.n) };
  }
  function crushed(C, live, pc) {
    if (!C) return { crushed: false, why: 'no cabin' };
    const f = fit(C.n, C.rest, live), R = f.R;
    const ex = C.eye[0] - f.cr[0], ey = C.eye[1] - f.cr[1], ez = C.eye[2] - f.cr[2];
    const x = f.cl[0] + R[0] * ex + R[1] * ey + R[2] * ez, y = f.cl[1] + R[3] * ex + R[4] * ey + R[5] * ez, z = f.cl[2] + R[6] * ex + R[7] * ey + R[8] * ez;
    const d = depth(live, C.n, x, y, z, true), vr = vol(live, C.n) / C.v0;
    const parted = !!pc && C.n.some(i => pc[i] !== pc[C.n[0]]);
    const why = parted ? 'the cabin parted' : d < EYE_CLEAR ? 'the eye ' + (d * 100).toFixed(0) + ' cm from the crushed cabin\'s wall' : vr < EYE_VOL ? 'the cabin at ' + (vr * 100).toFixed(0) + ' % of its volume' : null;
    return { crushed: !!why, why, depth: d, d0: C.d0, vol: vr, eye: [x, y, z] };
  }

  const API = { G, DT, CRUSH, TORN, KICK, SPIN, MU, BOUNCE, REST_V, REST_W, REST_T, LIFE, E_BEND, E_BREAK, CURL0, CURL1, CURL_S0, DENT0, DENT1, EYE_CLEAR, EYE_VOL,
    WET_K, CUT0, CUT1, TWIST, isMetal, CURL_B, DRV_RANK, fromDrive,
    rng, hash, carry, plan, watcher, watch, leaves, fit, release, step, rotOf, clearance, heal, solidOf, strike, support, held, inHull2, groundPlane, SUP_TOL, SUP_IN, SUP_N, azOf, bladeFrame, bladeOf, curlBlades, dentSpinner,
    bays, depth, vol, cabin, crushed };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.WRECK_DEBRIS = API;
})();
