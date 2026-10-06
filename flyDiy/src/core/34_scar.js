// ============================================================
// THE GROUND'S SCAR (G2357, DMG-SCAR; the user, 2026-10-07, after the Jodel's 30 m/s wing-strike stills: "the ground
// should also be impacted. I think we should at minimum remove the grass at impact, and possibly put an impact decal on
// the ground").
//
// THE RECORD. During a crash - the damage layer on (30_solver DMG_ON), after the first break, the crash's verdict, or an
// event whose ground contacts did more than SCAR.eArm of work - the solver's own ground contacts are recorded: every
// node that is NOT a wheel (the mains and the tailwheel roll; everything else scrapes: 30_solver's ground pass) and the
// crushable nose against the ground (G2013 nosePass: slot n + k, at the nose's centre). Per contact, per substep, the solver
// hands over what its contact law already computed (scarHit: where, the normal impulse Fn dt, the work of the vertical approach Fn max(0, -vy) dt - the
// blow - and the work its friction dissipated, kf |v|^2 dt); per frame this file follows each contact's SLIDE (a path of
// points SCAR.step apart, its length, its work) and its BLOW (the approach's work over its first SCAR.impS). Nothing is
// written to the physics: the record reads the contact, never pushes it, so the solver's bits are the base's with the
// layer on or off. With the layer off the record does not exist (null: one compare a frame, one in the scrape branch).
//
// THE PRIMITIVES (sealed once per EVENT - the wreck at rest (DMG.over) or SCAR.quiet s without a contact - into
// DMG.scar = { v, prims }, at most SCAR.maxPrims a crash):
//   crater  { k: 'c', x, z, r, d, s, E }   a blow of E J dug a bowl: the soil's volume V = E / qB (the blow does the
//            work of pushing soil past its bearing), a shallow bowl of depth r_b / 3 (V = pi r_b^3 / 6), the torn turf
//            out to r = rim x r_b (the ejecta and the lifted sod), d = r_b / 3
//   gouge   { k: 'g', p: [x, z, ...], w, d, s, E }   a slide: its path; the furrow's section A = kP x the mean friction
//            force over the plough's specific draft qP, its depth d = A / (the contact's width), the strip torn w =
//            width + 2 x spoil x d (the spoil thrown each side); parallel slides closer than SCAR.merge are one strip (a
//            belly between its longerons)
//   sweep   { k: 's', p: [x, z, ...], ws: [w, ...], w }   the band the wreck itself swept: its CG's track while it touched
//            the ground (a point a metre), at each point its width - twice the reach of its LOW nodes (under SCAR.hSweep:
//            a shrub's height) across the track there, + 0.5 m; w the widest
//   a propeller's strike into the ground (DMG-DRIVE's graded strike, past a brush) is a gouge too: a slot across the
//            disc's plane, the chord its bite cuts long, the bite deep (ps: 1)
//   s: the ground under it (0 turf - grass or the forest floor; 1 bare - sand, gravel, scree; 2 hard - paved, rock:
//      a scuff, no bowl and no furrow). Over water nothing: a ripple is WATER-LOOK's. E (J) the work it took.
//
// THE NUMBERS (sources AS RECALLED, A0 to open; GAME where said):
//   qB 200 kPa - the soil's resistance to a blow: the ultimate bearing of a turfed topsoil / loam, 100-300 kPa
//                (Terzaghi's bearing capacity on a weak cohesive soil; Bowles' presumptive values: soft clay ~75,
//                medium clay / loose sand 100-200, stiff clay 200-400 kPa) - the middle
//   qP  60 kPa - the specific draft of a mouldboard plough: 30-50 (sandy loam), 50-80 (loam), 80-140 (clay) kN per m2
//                of furrow section (ASAE D497 / the tillage tables) - a loam
//   kP 0.5   GAME - the share of the sliding friction (the solver's mu 0.8) that ploughs: the rest is skin on grass
//   rim 1.4, spoil 1.0  GAME - the torn turf round a bowl, the spoil each side of a furrow (x its depth)
//   eArm 250 J, eCrater 300 J  GAME - a scrape with no break that did less than eArm is a brush (no scar); a blow under
//                eCrater the turf takes (a wingtip touching a landing does tens of J)
//   SCAR.W   GAME - the contact's width by the member's ledger section (bm.sec): the fuselage's belly stringers 0.2 m,
//            a wing's leading edge or bow 0.15, the cowl 0.3, a strut 0.06, the gear 0.08
//
// The page (sim_host.js simDmgHop -> sim_view.js dmgS.scar; inline, app.js dmgNow) culls the grass in the footprint
// (cover_ring.js scar), the shrubs and the debris in the footprint and the sweep, and lays the decal (ground_scar.js).
// scarIn / scarBox are the one footprint test both use, and the gate's.
// ============================================================
const SCAR = {
  qB: 200e3, qP: 60e3, kP: 0.5, rim: 1.4, spoil: 1.0,
  eArm: 250, eCrater: 300,
  impS: 0.15,                 // s: the blow is the approach's work over a contact's first 0.15 s
  gapS: 0.25,                 // s: a node off the ground longer than this starts a new slide (a bounce)
  quiet: 1.0,                 // s: an event whose contacts did no work this long is sealed
  eQuiet: 2,                  // J a frame GAME: under it the contacts are at rest (a wreck lying still does ~0)
  step: 0.4,                  // m: a slide's points
  minL: 0.3,                  // m: a shorter slide is no furrow
  merge: 0.4,                 // m GAME: two slides closer than their half-widths + this are one strip
  wMax: 2.5, dMin: 0.005, dMax: 0.3, rMin: 0.2, rMax: 2.0,
  hSweep: 1.2, sweepStep: 1.0,
  blade: 0.12,                // m GAME: a blade's width at its tip (the prop strike's slot)
  maxPts: 24, maxPrims: 64, maxCraters: 16, maxSweeps: 4,
  W: { fuselage: 0.2, wings: 0.15, bracing: 0.06, tail: 0.1, gear: 0.08, engines: 0.3, vessel: 0.2 }, W0: 0.12,
};
// the ground's class under a point: 0 turf, 1 bare, 2 hard, -1 water (world.SURFACE: GRASS 0, ROCK 1, SCREE 2,
// FOREST_FLOOR 3, WATER 4, PAVED 5, GRAVEL 6, SAND 7)
const SCAR_SURF = [0, 2, 1, 0, -1, 2, 1, 1];
function scarSurf(world, x, z) {
  if (!world) return 0;
  if (typeof world.waterH === 'function' && typeof world.terrainH === 'function') {
    const w = world.waterH(x, z); if (Number.isFinite(w) && w > world.terrainH(x, z) - 0.05) return -1;
  }
  const s = typeof world.surface === 'function' ? world.surface(x, z) : 0;
  const c = SCAR_SURF[s]; return c === undefined ? 0 : c;
}
// per node: the widest contact its members give (by their ledger section), nE nose slots after them
function scarMake(def, nE) {
  const n = def.nodes.length, ns = n + (nE || 0), w = new Float64Array(ns).fill(0);
  for (const b of def.beams) { const x = SCAR.W[b.sec] || SCAR.W0; if (x > w[b.a]) w[b.a] = x; if (x > w[b.b]) w[b.b] = x; }
  for (let i = 0; i < n; i++) if (!(w[i] > 0)) w[i] = SCAR.W0;
  for (let i = n; i < ns; i++) w[i] = SCAR.W.engines;
  return { n, ns, w, acc: new Float64Array(ns * 8), touched: new Int32Array(ns), nt: 0,
           trk: new Array(ns).fill(null), segs: [], strikes: [], ev: { open: false, armed: false, E: 0, t0: 0, tLast: 0, sw: [], ww: [] }, overSealed: false,
           out: { v: 0, prims: [] }, hits: 0, frames: 0, ms: 0, seals: 0 };
}
// the solver's contact, a substep: slot i (a node, or n + k the nose of engine k) at (x, z) - the normal force Fn, the
// vertical velocity vy, the friction's power over the substep's dt
// (x, z) where it touched: the frame's first touch and its last are kept (a node skipping over the ground at 30 m/s
// travels half a metre a frame: a touch of one frame is a slide of its own length, not a point)
function scarHit(R, i, x, z, Fn, vy, pf, dt) {
  if (!(Fn > 0)) return;
  const o = i * 8, A = R.acc;
  if (A[o] === 0) { R.touched[R.nt++] = i; A[o + 4] = x; A[o + 5] = z; }
  A[o] += Fn * dt; if (vy < 0) A[o + 1] -= Fn * vy * dt; A[o + 2] += pf * dt; if (Fn > A[o + 3]) A[o + 3] = Fn;
  A[o + 6] = x; A[o + 7] = z;
  R.hits++;
}
// a propeller's bite into the ground (30_solver driveFrame: DMG-DRIVE's own disc sample, a strike graded past a brush, the
// prop still turning): the disc chops a slot across its plane at its lowest point - the chord its bite b cuts out of a
// disc of radius Rp (2 sqrt(2 Rp b - b^2)) long, a blade's width and its throw wide, b deep. (ex, ez) the disc plane's
// horizontal; one slot per 0.3 m of travel, at most 4 an engine
function scarStrike(R, k, x, z, ex, ez, b, Rp, t) {
  const E = R.ev, c = 2 * Math.sqrt(Math.max(0, 2 * Rp * b - b * b));
  if (!(c >= 0.05)) return;
  let nk = 0;
  for (const s of R.strikes) if (s.k === k) { nk++; if (Math.hypot(s.x - x, s.z - z) < 0.3) { if (b > s.b) { s.b = b; s.c = c; } E.tLast = t; return; } }
  if (nk >= 4) return;
  R.strikes.push({ k, x, z, ex, ez, b, c });
  if (!E.open) { E.open = true; E.t0 = t; }
  E.tLast = t; E.armed = true;
}
function scarReset(R) {
  R.acc.fill(0); R.nt = 0; R.trk.fill(null); R.segs.length = 0; R.strikes.length = 0;
  const E = R.ev; E.open = false; E.armed = false; E.E = 0; E.sw.length = 0; E.ww.length = 0; R.overSealed = false;
  if (R.out.prims.length || R.out.v) { R.out.v++; R.out.prims = []; }   // a new version, empty: the page lets its scar go
}
// once a frame, on a frame with a contact or an event open (30_solver step, after dmgOver)
function scarFrame(R, p, m, world, t, D) {
  R.frames++;
  const A = R.acc, n = R.n, E = R.ev;
  let fw = 0;
  const add = (T, x, z) => { T.L += Math.hypot(x - T.lx, z - T.lz); T.lx = x; T.lz = z;
    const k = T.pts.length; if (Math.hypot(x - T.pts[k - 2], z - T.pts[k - 1]) >= SCAR.step) T.pts.push(x, z); };
  for (let q = 0; q < R.nt; q++) {
    const i = R.touched[q], o = i * 8, Wn = A[o + 1], Wf = A[o + 2], Fm = A[o + 3], x0 = A[o + 4], z0 = A[o + 5], x1 = A[o + 6], z1 = A[o + 7];
    A[o] = 0; A[o + 1] = 0; A[o + 2] = 0; A[o + 3] = 0;
    let T = R.trk[i];
    if (!T || t - T.t1 > SCAR.gapS) {
      T = { i, w: R.w[i], pts: [x0, z0], lx: x0, lz: z0, L: 0, Wf: 0, Fm: 0, t0: t, t1: t, imp: 0 };
      R.segs.push(T); R.trk[i] = T;
    } else add(T, x0, z0);
    add(T, x1, z1);
    T.Wf += Wf; T.t1 = t; if (Fm > T.Fm) T.Fm = Fm;
    if (t - T.t0 <= SCAR.impS) T.imp += Wn;
    fw += Wn + Wf;
  }
  R.nt = 0;
  // the event lives while its contacts WORK: a wreck at rest on its nose (a nose-over) still touches every frame and
  // does nothing - the event is sealed SCAR.quiet after the last frame that did more than SCAR.eQuiet
  if (fw > SCAR.eQuiet) { if (!E.open) { E.open = true; E.t0 = t; } E.tLast = t; }
  if (E.open) E.E += fw;
  if (!E.open) return;
  if (!E.armed && (D.breaks > 0 || D.crashed || E.E > SCAR.eArm)) E.armed = true;
  // the sweep: the CG's track while the wreck touches, a point a metre; the low nodes' reach across it
  if (t - E.tLast < 0.05) {
    let cx = 0, cz = 0, M = 0; for (let i = 0; i < n; i++) { cx += m[i] * p[i * 3]; cz += m[i] * p[i * 3 + 2]; M += m[i]; }
    cx /= M; cz /= M;
    const S = E.sw, k = S.length;
    if (!k || Math.hypot(cx - S[k - 2], cz - S[k - 1]) >= SCAR.sweepStep) {
      // its reach here: the farthest LOW node across the track (radially at the first point)
      let dx = k ? cx - S[k - 2] : 0, dz = k ? cz - S[k - 1] : 0; const dl = Math.hypot(dx, dz); if (dl > 0) { dx /= dl; dz /= dl; }
      const gH = world && typeof world.terrainH === 'function' ? world.terrainH : null;
      let hw = 0;
      for (let i = 0; i < n; i++) {
        const x = p[i * 3], z = p[i * 3 + 2];
        if (gH && p[i * 3 + 1] - gH(x, z) > SCAR.hSweep) continue;
        const a = dl > 0 ? Math.abs((x - cx) * dz - (z - cz) * dx) : Math.hypot(x - cx, z - cz); if (a > hw) hw = a;
      }
      S.push(cx, cz); E.ww.push(hw);
    }
  }
  if ((D.over && !R.overSealed) || t - E.tLast > SCAR.quiet) {
    if (D.over) R.overSealed = true;
    if (E.armed) scarSeal(R, world);
    R.trk.fill(null); R.segs.length = 0; R.strikes.length = 0; E.open = false; E.armed = false; E.E = 0; E.sw.length = 0; E.ww.length = 0;
  }
}
// ---- the event's primitives ----------------------------------------------------------------------------------------
const scarR2 = v => Math.round(v * 100) / 100;
// the distance from (x, z) to a polyline [x, z, ...]
function scarSegD(P, x, z) {
  let best = Infinity;
  if (P.length === 2) return Math.hypot(x - P[0], z - P[1]);
  for (let j = 0; j + 3 < P.length; j += 2) {
    const ax = P[j], az = P[j + 1], ex = P[j + 2] - ax, ez = P[j + 3] - az, e2 = ex * ex + ez * ez;
    let u = e2 > 1e-12 ? ((x - ax) * ex + (z - az) * ez) / e2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const d = Math.hypot(x - ax - u * ex, z - az - u * ez); if (d < best) best = d;
  }
  return best;
}
// Ramer-Douglas-Peucker to `tol`, then at most `max` points (evenly kept)
function scarSimplify(P, tol, max) {
  const N = P.length / 2; if (N <= 2) return P.slice();
  const keep = new Uint8Array(N); keep[0] = keep[N - 1] = 1;
  const st = [[0, N - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let dm = 0, im = -1;
    for (let j = a + 1; j < b; j++) { const d = scarSegD([P[a * 2], P[a * 2 + 1], P[b * 2], P[b * 2 + 1]], P[j * 2], P[j * 2 + 1]); if (d > dm) { dm = d; im = j; } }
    if (im >= 0 && dm > tol) { keep[im] = 1; st.push([a, im], [im, b]); }
  }
  let ids = []; for (let j = 0; j < N; j++) if (keep[j]) ids.push(j);
  if (ids.length > max) { const s = []; for (let q = 0; q < max; q++) s.push(ids[Math.round(q * (ids.length - 1) / (max - 1))]); ids = s; }
  const out = []; for (const j of ids) out.push(P[j * 2], P[j * 2 + 1]);
  return out;
}
// the points of a polyline on ground that scars (water dropped; a run broken by water is cut there - the longest kept)
function scarDry(world, P) {
  let best = [], cur = [];
  for (let j = 0; j < P.length; j += 2) {
    if (scarSurf(world, P[j], P[j + 1]) < 0) { if (cur.length > best.length) best = cur; cur = []; continue; }
    cur.push(P[j], P[j + 1]);
  }
  return cur.length > best.length ? cur : best;
}
function scarSeal(R, world) {
  const clk = typeof performance !== 'undefined' ? performance : Date, t0 = clk.now();
  try { scarSeal0(R, world); } finally { R.ms += clk.now() - t0; }   // the event's cost (GATE DMGSCAR reads it)
}
function scarSeal0(R, world) {
  const out = [];
  // the gouges: one per slide, the longest first; a shorter one alongside merges into it (the strip widened to cover it)
  const G = [];
  for (const T of R.segs) {
    if (T.L < SCAR.minL) continue;
    if (T.pts.length < 4) T.pts.push(T.lx, T.lz);   // a short slide: its first point and its last
    const Ff = T.Wf / Math.max(T.L, 1e-6), d = Math.min(SCAR.dMax, Math.max(SCAR.dMin, SCAR.kP * Ff / SCAR.qP / T.w));
    G.push({ p: T.pts.slice(), w: Math.min(SCAR.wMax, T.w + 2 * SCAR.spoil * d), d, E: T.Wf, L: T.L });
  }
  G.sort((a, b) => b.L - a.L);
  const acc = [];
  for (const g of G) {
    let into = null, far = 0;
    for (const h of acc) {
      const lim = (h.w + g.w) / 2 + SCAR.merge; let inside = 0, dmx = 0;
      for (let j = 0; j < g.p.length; j += 2) { const dd = scarSegD(h.p, g.p[j], g.p[j + 1]); if (dd <= lim) { inside++; if (dd > dmx) dmx = dd; } }
      if (inside >= 0.8 * g.p.length / 2) { into = h; far = dmx; break; }
    }
    if (into) { into.w = Math.min(SCAR.wMax, Math.max(into.w, 2 * far + g.w)); into.d = Math.max(into.d, g.d); into.E += g.E; }
    else acc.push(g);
  }
  for (const g of acc) {
    const P = scarSimplify(scarDry(world, g.p), 0.08, SCAR.maxPts); if (P.length < 4) continue;
    const s = scarSurf(world, P[0], P[1]);
    out.push({ k: 'g', p: P.map(scarR2), w: scarR2(g.w), d: s === 2 ? 0 : Math.round(g.d * 1000) / 1000, s, E: Math.round(g.E) });
  }
  // the craters: each slide's first blow over eCrater, at the point it struck; blows that overlap are one bowl
  const C = [];
  for (const T of R.segs) if (T.imp >= SCAR.eCrater) C.push({ x: T.pts[0], z: T.pts[1], E: T.imp });
  C.sort((a, b) => b.E - a.E);
  const rOf = E => { const rb = Math.cbrt(6 * E / (Math.PI * SCAR.qB)); return { rb, r: Math.min(SCAR.rMax, Math.max(SCAR.rMin, SCAR.rim * rb)) }; };
  const B = [];
  for (const c of C) {
    let into = null;
    for (const b of B) if (Math.hypot(c.x - b.x, c.z - b.z) < rOf(b.E).r + rOf(c.E).r) { into = b; break; }
    if (into) { const E = into.E + c.E; into.x = (into.x * into.E + c.x * c.E) / E; into.z = (into.z * into.E + c.z * c.E) / E; into.E = E; }
    else B.push(Object.assign({}, c));
  }
  for (const b of B.slice(0, SCAR.maxCraters)) {
    const s = scarSurf(world, b.x, b.z); if (s < 0) continue;
    const { rb, r } = rOf(b.E);
    out.push({ k: 'c', x: scarR2(b.x), z: scarR2(b.z), r: scarR2(s === 2 ? Math.min(r, 0.6) : r), d: s === 2 ? 0 : Math.round(rb / 3 * 1000) / 1000, s, E: Math.round(b.E) });
  }
  // the propellers' slots (scarStrike)
  for (const k of R.strikes) {
    const s = scarSurf(world, k.x, k.z); if (s < 0) continue;
    const d = Math.min(SCAR.dMax, k.b), h = k.c / 2;
    out.push({ k: 'g', p: [k.x - k.ex * h, k.z - k.ez * h, k.x + k.ex * h, k.z + k.ez * h].map(scarR2), w: scarR2(SCAR.blade + 2 * SCAR.spoil * d), d: s === 2 ? 0 : Math.round(d * 1000) / 1000, s, E: 0, ps: 1 });
  }
  // the sweep
  const E = R.ev;
  // the sweep: its points (water dropped), a width at each (2 x the low nodes' reach + 0.5 m, at most 30), at most maxPts -
  // a kept point takes the widest of those it stands for
  if (E.sw.length >= 4) {
    let P = [], W = [];
    for (let j = 0; j < E.sw.length; j += 2) if (scarSurf(world, E.sw[j], E.sw[j + 1]) >= 0) { P.push(E.sw[j], E.sw[j + 1]); W.push(Math.min(30, 2 * E.ww[j / 2] + 0.5)); }
    const N = P.length / 2;
    if (N > SCAR.maxPts) { const P2 = [], W2 = []; for (let q = 0; q < SCAR.maxPts; q++) { const a = Math.round(q * (N - 1) / (SCAR.maxPts - 1)), b = q + 1 < SCAR.maxPts ? Math.round((q + 1) * (N - 1) / (SCAR.maxPts - 1)) : N;
      let w = 0; for (let j = Math.max(0, a - 1); j < Math.min(N, b + 1); j++) w = Math.max(w, W[j]); P2.push(P[a * 2], P[a * 2 + 1]); W2.push(w); } P = P2; W = W2; }
    if (P.length >= 4) out.push({ k: 's', p: P.map(scarR2), w: scarR2(Math.max(...W)), ws: W.map(scarR2) });
  }
  // with the events before it, at most maxPrims: the sweeps, then the craters, then the gouges by their work
  if (!out.length) return;                       // nothing new (an event of a wreck settling): the page's scar stands
  const all = R.out.prims.concat(out), sw = all.filter(x => x.k === 's').slice(-SCAR.maxSweeps);
  const cr = all.filter(x => x.k === 'c').sort((a, b) => b.E - a.E).slice(0, SCAR.maxCraters);
  const go = all.filter(x => x.k === 'g').sort((a, b) => b.E - a.E).slice(0, Math.max(0, SCAR.maxPrims - sw.length - cr.length));
  R.out.prims = cr.concat(go, sw);
  R.out.v++; R.seals++;
}
// ---- THE FOOTPRINT (the page's cull and the gate's): inside a crater's disc or a gouge's strip; `sweep` adds the sweeps
function scarIn(prims, x, z, sweep) {
  for (let q = 0; q < prims.length; q++) {
    const c = prims[q];
    if (c.k === 'c') { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz <= c.r * c.r) return true; }
    else if (c.k === 'g') { if (scarSegD(c.p, x, z) <= c.w / 2) return true; }
    else if (sweep && c.k === 's') { if (scarSweepIn(c, x, z)) return true; }
  }
  return false;
}
// a sweep: each of its legs at the wider of its two ends' widths (ws; w all along without it)
function scarSweepIn(c, x, z) {
  const P = c.p;
  if (!c.ws) return scarSegD(P, x, z) <= c.w / 2;
  if (P.length === 2) return Math.hypot(x - P[0], z - P[1]) <= c.ws[0] / 2;
  for (let j = 0; j + 3 < P.length; j += 2) { const h = Math.max(c.ws[j / 2], c.ws[j / 2 + 1]) / 2;
    if (scarSegD([P[j], P[j + 1], P[j + 2], P[j + 3]], x, z) <= h) return true; }
  return false;
}
// the footprint's box [x0, z0, x1, z1] (the sweeps with `sweep`), null for none
function scarBox(prims, sweep) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const c of prims) {
    if (c.k === 'c') { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); z0 = Math.min(z0, c.z - c.r); z1 = Math.max(z1, c.z + c.r); continue; }
    if (c.k === 's' && !sweep) continue;
    for (let j = 0; j < c.p.length; j += 2) { const h = (c.ws ? c.ws[j / 2] : c.w) / 2; x0 = Math.min(x0, c.p[j] - h); x1 = Math.max(x1, c.p[j] + h); z0 = Math.min(z0, c.p[j + 1] - h); z1 = Math.max(z1, c.p[j + 1] + h); }
  }
  return x0 <= x1 ? [x0, z0, x1, z1] : null;
}
