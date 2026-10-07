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
//   a propeller's strike into the ground (DMG-DRIVE's graded strike: a stoppage or a separation) is a gouge too: a slot across the
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
// G2378-G2382 (DMG-SCAR2; the box stills of 7 Oct: the Jodel's wing strike drawn as a trail of identical round craters,
// the wreck still standing in tall grass, the runway's nose-over with no scuff to see):
//   THE JOIN (G2378). A part that slid or bounced along the ground is ONE furrow: the slides are chained in the order they
//            began - a slide continues a chain one of whose slides ended at most joinT before it began: the same node on
//            that time gap alone (a bounce: its hop is its own flight), another node only from a contact still moving
//            (> vHand), ahead of it, landing within joinD + joinK x the hop of where that contact's speed would have
//            carried it (a hop is ballistic: its ground speed hardly changes in the air); any join on the line it left
//            (across the heading at most the two contacts' half-widths + merge + joinL x the way along). A chain is one gouge: its path the slides' paths end to end (the hops
//            bridged), its width the contacting part's (SCAR.W, the widest of its nodes), its depth from the friction
//            work the slides recorded over the length they slid. A CRATER is kept only for a BLOW of eBlow or more that
//            STOPPED there (its contact went on less than stopK x the bowl's radius): a blow on the way is the furrow's
//            (its work counted in the gouge's E). eBlow is the blow that digs past the sod: a bowl d = r_b / 3 deeper
//            than the turf's root mat (sod 0.07 m) - E = pi qB (3 sod)^3 / 6 = 970 J.
//   THE DIRECTION (G2379). A crater carries the heading its contact had when it struck (u): the decal throws its spoil
//            down-range (the footprint's r includes it: rim x r_b x (1 + throw)).
//   THE RESTING WRECK (G2380). Each seal adds the HULLS { k: 'h', p: [x, z, ...] (convex, anticlockwise), m }: every
//            piece of the wreck as it lies (the nodes joined by members still whole: the airframe and every piece that
//            came off), the convex hull of its nodes lower than hSweep over the ground, m the margin round it (mRest,
//            and what a simplification to hullPts points cut off). The grass and the shrubs go under them (the cover
//            ring's cull - scarIn tests them as the footprint); no decal (a cleared site, not a scar). A later seal
//            replaces them (the wreck where it finally lies).
//   HARD GROUND (G2381). A scuff, never a bowl or a furrow: d 0, at least wScuff wide (rubber and metal streaks, the
//            decal's); a blow on paved or rock is a scuff patch along its heading.
// The page (sim_host.js simDmgHop -> sim_view.js dmgS.scar; inline, app.js dmgNow) culls the grass in the footprint
// (cover_ring.js scar), the shrubs and the debris in the footprint and the sweep, and lays the decal (ground_scar.js).
// scarIn / scarBox are the one footprint test both use, and the gate's.
// ============================================================
const SCAR = {
  qB: 200e3, qP: 60e3, kP: 0.5, rim: 1.4, spoil: 1.0,
  eArm: 250,
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
  // G2378 (DMG-SCAR2): the join (above). join false: every slide its own (the old record - GATE DMGSCAR's selftest)
  join: true,
  joinT: 0.5,                 // s GAME: a bounce's time in the air - a rebound of up to 2.5 m/s (2 vy / g)
  joinD: 1.0,                 // m GAME: where a hop lands, round where its speed carried it ...
  joinK: 0.3,                 //   ... + this share of the hop (the part turns in the air: its lowest point moves)
  joinL: 0.2,                 // GAME: a join lands across the heading within the half-widths + merge + this x the way along
  vHand: 1.0,                 // m/s GAME: a contact slower than this hands its furrow to no other node (a wreck settling)
  sod: 0.07,                  // m AS RECALLED: a turf's root zone, 5-10 cm (eBlow below: the blow that digs past it)
  stopK: 2,                   // GAME: a blow STOPPED when its contact went on less than stopK x its bowl's radius
  throw: 0.3,                 // GAME: a crater's spoil thrown down-range, x its radius
  // G2380: the resting wreck's hulls
  mRest: 0.75,                // m GAME: the margin round a piece's hull (a tuft's lean and the eye's angle over it)
  maxHulls: 24, hullPts: 16,
  vRest: 0.5,                 // m/s GAME: the wreck is AT REST when no node moves faster (a loose wheel rolling on: not yet;
                              //   a dangling member's jitter, 0.2-0.3 m/s, is rest)
  restDt: 0.5, restMax: 10,   // s: after a seal, that read every restDt until the wreck rests (at most restMax): the hulls
                              //    sealed again once, where the pieces finally lie
  // G2381: a scuff on hard ground at least this wide (rubber and metal, streaks the decal draws)
  wScuff: 0.4,                // m GAME
};
SCAR.eBlow = Math.round(Math.PI * SCAR.qB * Math.pow(3 * SCAR.sod, 3) / 6);   // 970 J: a bowl deeper than the sod
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
  // (G2380: the members' ends and the nodes' radii - the wreck's pieces at a seal)
  const nb = def.beams.length, ba = new Int32Array(nb), bb = new Int32Array(nb), nr = new Float64Array(n);
  for (let b = 0; b < nb; b++) { ba[b] = def.beams[b].a; bb[b] = def.beams[b].b; }
  for (let i = 0; i < n; i++) nr[i] = def.nodes[i].r || 0;
  return { n, ns, w, ba, bb, nr, tPrev: -1, last: null, rest: null, acc: new Float64Array(ns * 8), touched: new Int32Array(ns), nt: 0,
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
// a propeller's bite into the ground (30_solver driveFrame: DMG-DRIVE's own disc sample, a strike graded a stoppage or a
// separation, the prop still turning at the sample): the disc chops a slot across its plane at its lowest point - the chord its bite b cuts out of a
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
  const E = R.ev; E.open = false; E.armed = false; E.E = 0; E.sw.length = 0; E.ww.length = 0; R.overSealed = false; R.rest = null; R.carry = null; R.carrySegs = null;
  if (R.out.prims.length || R.out.v) { R.out.v++; R.out.prims = []; }   // a new version, empty: the page lets its scar go
}
// once a frame, on a frame with a contact or an event open, or a sealed scar waiting for the wreck's rest (30_solver step,
// after dmgOver)
function scarFrame(R, p, m, world, t, D, v) {
  if (R.nt === 0 && !R.ev.open) { if (R.rest !== null) scarRest(R, p, v, world, t, D); return; }
  R.frames++;
  const A = R.acc, n = R.n, E = R.ev;
  let fw = 0;
  const add = (T, x, z) => { T.L += Math.hypot(x - T.lx, z - T.lz); T.lx = x; T.lz = z;
    const k = T.pts.length; if (Math.hypot(x - T.pts[k - 2], z - T.pts[k - 1]) >= SCAR.step) T.pts.push(x, z); };
  const dtF = R.tPrev >= 0 && t - R.tPrev > 0 && t - R.tPrev < 0.1 ? t - R.tPrev : 1 / 60; R.tPrev = t;
  for (let q = 0; q < R.nt; q++) {
    const i = R.touched[q], o = i * 8, Wn = A[o + 1], Wf = A[o + 2], Fm = A[o + 3], x0 = A[o + 4], z0 = A[o + 5], x1 = A[o + 6], z1 = A[o + 7];
    A[o] = 0; A[o + 1] = 0; A[o + 2] = 0; A[o + 3] = 0;
    let T = R.trk[i];
    const fresh = !T || t - T.t1 > SCAR.gapS;
    // (G2378) the contact's speed over the ground and its heading: from its last point (a frame or a skip before) to
    // this frame's last touch - a fresh slide's from its first touch this frame (an underestimate: the join's tolerance)
    const px = fresh ? x0 : T.lx, pz = fresh ? z0 : T.lz, dtt = fresh ? dtF : Math.max(dtF, t - T.t1);
    if (fresh) {
      T = { i, w: R.w[i], pts: [x0, z0], lx: x0, lz: z0, L: 0, Wf: 0, Fm: 0, t0: t, t1: t, imp: 0, v: 0, ux: 0, uz: 0, u0: null };
      R.segs.push(T); R.trk[i] = T;
    } else add(T, x0, z0);
    add(T, x1, z1);
    { const ux = x1 - px, uz = z1 - pz, ul = Math.hypot(ux, uz);
      if (ul > 1e-3) { T.v = ul / dtt; T.ux = ux / ul; T.uz = uz / ul; if (!T.u0) T.u0 = [T.ux, T.uz]; } }
    T.Wf += Wf; T.t1 = t; if (Fm > T.Fm) T.Fm = Fm;
    if (t - T.t0 <= SCAR.impS) T.imp += Wn;
    fw += Wn + Wf;
  }
  R.nt = 0;
  // the event lives while its contacts WORK: a wreck at rest on its nose (a nose-over) still touches every frame and
  // does nothing - the event is sealed SCAR.quiet after the last frame that did more than SCAR.eQuiet
  if (fw > SCAR.eQuiet) { if (!E.open) { E.open = true; E.t0 = t; } E.tLast = t; }
  if (E.open) E.E += fw;
  if (!E.open) { if (R.rest !== null) scarRest(R, p, v, world, t, D); return; }   // (a wreck at rest still touches)
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
    if (E.armed) { scarSeal(R, world, p, D, t); R.rest = { t0: t, tc: t }; }
    // (G2378: a chain still moving at the seal - the D.over seal comes 4 s after the crash, a part may still slide - is
    // CARRIED into the next event, its slides kept: the next seal replaces its prims with the whole chain's)
    const keep = R.carrySegs || []; R.carrySegs = null;
    R.trk.fill(null); R.segs.length = 0;
    for (const T of keep) { R.segs.push(T); if (t - T.t1 <= SCAR.gapS) R.trk[T.i] = T; }
    R.strikes.length = 0; E.open = false; E.armed = false; E.E = 0; E.sw.length = 0; E.ww.length = 0;
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
function scarSeal(R, world, p, D, t) {
  const clk = typeof performance !== 'undefined' ? performance : Date, t0 = clk.now();
  try { scarSeal0(R, world, p, D, t); } finally { R.ms += clk.now() - t0; }   // the event's cost (GATE DMGSCAR reads it)
}
// G2378: the bowl a blow of E J digs (the soil's volume E / qB, a bowl of depth r_b / 3) and the turf it tears (r)
const scarBowl = E => { const rb = Math.cbrt(6 * E / (Math.PI * SCAR.qB)); return { rb, r: Math.min(SCAR.rMax, Math.max(SCAR.rMin, SCAR.rim * rb)) }; };
// G2378: THE JOIN - the slides chained (a slide continues the chain it follows: above); each chain { s: [slides], last }
function scarChains(segs) {
  const S = segs.slice().sort((a, b) => a.t0 - b.t0 || a.i - b.i), CH = [];
  for (const T of S) {
    let best = null, bd = Infinity;
    // (any slide of a chain that ended within joinT is a tip it may continue from - not only its last: a chain handed to
    // a neighbour still takes its own node back, landing a hop on; the same node's tip first, at equal fit)
    if (SCAR.join) for (const ch of CH) for (let q = ch.s.length - 1; q >= 0; q--) {
      const A = ch.s[q], gap = T.t0 - A.t1;
      if (gap > SCAR.joinT + 1e-6) { if (T.t0 - ch.last.t1 > SCAR.joinT + 1e-6) break; continue; }   // (inclusive: a frame's times)
      if (gap < 0) continue;
      if (A.i !== T.i && !(A.v >= SCAR.vHand)) continue;                 // a settling contact hands over to no other node
      const hop = (A.v || 0) * gap, qx = A.lx + A.ux * hop, qz = A.lz + A.uz * hop;
      const e = A.i === T.i ? -1 : Math.hypot(T.pts[0] - qx, T.pts[1] - qz);   // (its own furrow first, always)
      if (A.i !== T.i && (T.pts[0] - A.lx) * A.ux + (T.pts[1] - A.lz) * A.uz < -SCAR.joinD) continue;   // another node: ahead of it
      // (any join: it lands on the line it left - across the heading no more than the two contacts' half-widths + merge +
      // joinL x the way along (the heading's error and the part's turn in the air: ~11 deg); a part that comes down beside
      // its track starts a furrow of its own, never a strip drawn across to a parallel one)
      // (the line: the slide's own if it slid 0.5 m, else the chain's from its start to that slide's end - a touch of a frame
      // has no heading to trust; none shorter)
      { let lx = A.lx - A.pts[0], lz = A.lz - A.pts[1], ll = Math.hypot(lx, lz);
        if (ll < 0.5) { lx = A.lx - ch.s[0].pts[0]; lz = A.lz - ch.s[0].pts[1]; ll = Math.hypot(lx, lz); }
        if (ll >= 0.5) { lx /= ll; lz /= ll; const dx = T.pts[0] - A.lx, dz = T.pts[1] - A.lz;
          if (Math.abs(dx * lz - dz * lx) > (A.w + T.w) / 2 + SCAR.merge + SCAR.joinL * Math.abs(dx * lx + dz * lz)) continue; } }
      // the same node: the time gap alone (its hop is its own flight - a contact braked by the ground leaves at a speed
      // its slide does not show); another node: where the hop lands, round where its speed carried it
      if ((A.i === T.i || e <= SCAR.joinD + SCAR.joinK * hop) && e < bd) { bd = e; best = ch; }
    }
    if (best) { best.s.push(T); if (T.t1 >= best.last.t1) best.last = T; } else CH.push({ s: [T], last: T });
  }
  return CH;
}
function scarSeal0(R, world, p, D, t) {
  const out = [], CH = scarChains(R.segs), hardW = w => Math.max(w, SCAR.wScuff), carry = new Set(), carrySegs = [];
  // (the carry by MERGE GROUP: a chain merged - its strip or its bowl - with a live one is carried with it, or the next
  // seal, replacing the merged prim, would lose the finished chain's part)
  const up = CH.map((_, q) => q), grp = q => { while (up[q] !== q) { up[q] = up[up[q]]; q = up[q]; } return q; }, join = (a, b) => { a = grp(a); b = grp(b); if (a !== b) up[a] = b; };
  const st = { slides: R.segs.length, chains: CH.length, joined: 0, blows: 0, stopped: 0, onWay: 0, gouges: 0 };
  // each chain: its path (the slides end to end, the hops bridged), the length it SLID (the hops not counted), its work,
  // its width (the widest contacting node's); a blow of eBlow or more that stopped is a crater, any other the furrow's
  const G = [], C = [], owner = [];   // (owner: [prim, its chain] - the carry decided after the merges)
  CH.forEach((ch, ci) => {
    const s = ch.s, P = [];
    ch.live = t != null && t - ch.last.t1 <= SCAR.joinT;
    let L = 0, Wf = 0, w = 0, Eon = 0, after = 0;
    for (const T of s) { L += T.L; Wf += T.Wf; if (T.w > w) w = T.w; }
    if (s.length > 1) st.joined += s.length;
    // the length the chain went on after each slide began (the hops counted: the part went on)
    const rest = new Float64Array(s.length);
    for (let q = s.length - 1; q >= 0; q--) { rest[q] = after + s[q].L; after = rest[q] + (q ? Math.hypot(s[q].pts[0] - s[q - 1].lx, s[q].pts[1] - s[q - 1].lz) : 0); }
    for (let q = 0; q < s.length; q++) {
      const T = s[q];
      for (let j = 0; j < T.pts.length; j += 2) P.push(T.pts[j], T.pts[j + 1]);
      if (Math.hypot(T.lx - P[P.length - 2], T.lz - P[P.length - 1]) > 0.01) P.push(T.lx, T.lz);
      if (T.imp >= SCAR.eBlow) {
        st.blows++;
        if (rest[q] <= SCAR.stopK * scarBowl(T.imp).r) { st.stopped++; C.push({ x: T.pts[0], z: T.pts[1], E: T.imp, u: T.u0, ci }); continue; }
        st.onWay++;
      }
      Eon += T.imp;
    }
    if (L < SCAR.minL) return;
    if (P.length < 4) return;
    const d = Math.min(SCAR.dMax, Math.max(SCAR.dMin, SCAR.kP * Wf / L / SCAR.qP / w));
    // (the path dried and simplified HERE, before the merge: a joined chain's raw path is hundreds of points, and the merge
    // tests every point of one against every leg of another)
    const Q = scarSimplify(scarDry(world, P), 0.08, SCAR.maxPts); if (Q.length < 4) return;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let j = 0; j < Q.length; j += 2) { if (Q[j] < x0) x0 = Q[j]; if (Q[j] > x1) x1 = Q[j]; if (Q[j + 1] < z0) z0 = Q[j + 1]; if (Q[j + 1] > z1) z1 = Q[j + 1]; }
    G.push({ p: Q, w: Math.min(SCAR.wMax, w + 2 * SCAR.spoil * d), d, E: Wf + Eon, L, n: s.length, ci, b: [x0, z0, x1, z1] });
  });
  // parallel chains closer than their half-widths + merge are one strip (a belly between its longerons) - never a strip
  // wider than it is long (G2378: two short scrapes side by side stay two, not a 2.5 m blot)
  G.sort((a, b) => b.L - a.L);
  const acc = [];
  for (const g of G) {
    let into = null, far = 0;
    for (const h of acc) {
      const lim = (h.w + g.w) / 2 + SCAR.merge; let inside = 0, dmx = 0;
      if (g.b[0] > h.b[2] + lim || g.b[2] < h.b[0] - lim || g.b[1] > h.b[3] + lim || g.b[3] < h.b[1] - lim) continue;   // (apart)
      for (let j = 0; j < g.p.length; j += 2) { const dd = scarSegD(h.p, g.p[j], g.p[j + 1]); if (dd <= lim) { inside++; if (dd > dmx) dmx = dd; } }
      if (inside >= 0.8 * g.p.length / 2 && 2 * dmx + g.w <= Math.max(h.w, h.L)) { into = h; far = dmx; break; }
    }
    if (into) { into.w = Math.min(SCAR.wMax, Math.max(into.w, 2 * far + g.w)); into.d = Math.max(into.d, g.d); into.E += g.E; into.n += g.n; join(g.ci, into.ci); }
    else acc.push(g);
  }
  for (const g of acc) {
    const P = g.p;
    const s = scarSurf(world, P[0], P[1]);
    // (hard ground: no spoil - the part's own width, at least wScuff)
    out.push({ k: 'g', p: P.map(scarR2), w: scarR2(s === 2 ? hardW(g.w - 2 * SCAR.spoil * g.d) : g.w), d: s === 2 ? 0 : Math.round(g.d * 1000) / 1000, s, E: Math.round(g.E), n: g.n });
    owner.push([out[out.length - 1], g.ci]);
    st.gouges++;
  }
  // the craters: the blows that stopped; blows that overlap are one bowl (the heading the strongest's)
  C.sort((a, b) => b.E - a.E);
  const B = [];
  for (const c of C) {
    let into = null;
    for (const b of B) if (Math.hypot(c.x - b.x, c.z - b.z) < scarBowl(b.E).r + scarBowl(c.E).r) { into = b; break; }
    if (into) { const E = into.E + c.E; into.x = (into.x * into.E + c.x * c.E) / E; into.z = (into.z * into.E + c.z * c.E) / E; into.E = E; join(c.ci, into.ci); }
    else B.push(Object.assign({}, c));
  }
  for (const b of B.slice(0, SCAR.maxCraters)) {
    const s = scarSurf(world, b.x, b.z); if (s < 0) continue;
    const { rb, r } = scarBowl(b.E), th = b.u ? 1 + SCAR.throw : 1;
    const c = { k: 'c', x: scarR2(b.x), z: scarR2(b.z), r: scarR2(s === 2 ? Math.min(r, 0.6) : Math.min(SCAR.rMax, r * th)), d: s === 2 ? 0 : Math.round(rb / 3 * 1000) / 1000, s, E: Math.round(b.E) };
    if (b.u) c.u = [Math.round(b.u[0] * 1000) / 1000, Math.round(b.u[1] * 1000) / 1000];
    out.push(c); owner.push([c, b.ci]);
  }
  // the propellers' slots (scarStrike)
  for (const k of R.strikes) {
    const s = scarSurf(world, k.x, k.z); if (s < 0) continue;
    const d = Math.min(SCAR.dMax, k.b), h = k.c / 2, w = SCAR.blade + 2 * SCAR.spoil * d;
    out.push({ k: 'g', p: [k.x - k.ex * h, k.z - k.ez * h, k.x + k.ex * h, k.z + k.ez * h].map(scarR2), w: scarR2(s === 2 ? hardW(SCAR.blade) : w), d: s === 2 ? 0 : Math.round(d * 1000) / 1000, s, E: 0, ps: 1 });
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
  // G2380: the resting wreck - every piece's hull as it lies
  const H = p && D ? scarHulls(R, p, world, D) : [];
  R.last = st; st.hulls = H.length;
  // with the events before it, at most maxPrims: the sweeps, the hulls (this seal's replace the last's), then the craters,
  // then the gouges by their work. A seal with nothing new but hulls the old ones cover (a wreck settling) changes nothing
  // the carry: every chain of a merge group with a live chain in it - its slides kept, its prims replaced at the next seal
  const gLive = new Set(); CH.forEach((ch, q) => { if (ch.live) gLive.add(grp(q)); });
  CH.forEach((ch, q) => { if (gLive.has(grp(q))) for (const T of ch.s) carrySegs.push(T); });
  for (const [prim, q] of owner) if (gLive.has(grp(q))) carry.add(prim);
  // (the prims of the chains the last seal carried go: this seal's chains hold them whole)
  const C0 = R.carry; R.carry = carry; R.carrySegs = carrySegs;
  const old = C0 ? R.out.prims.filter(x => !C0.has(x)) : R.out.prims, oldH = old.filter(x => x.k === 'h');
  if (!out.length && (!H.length || (oldH.length && H.every(h => { for (let j = 0; j < h.p.length; j += 2) if (!scarIn(oldH, h.p[j], h.p[j + 1], false)) return false; return true; })))) return;
  const all = old.filter(x => x.k !== 'h' || !H.length).concat(out, H), sw = all.filter(x => x.k === 's').slice(-SCAR.maxSweeps);
  const hu = all.filter(x => x.k === 'h');
  const cr = all.filter(x => x.k === 'c').sort((a, b) => b.E - a.E).slice(0, SCAR.maxCraters);
  const go = all.filter(x => x.k === 'g').sort((a, b) => b.E - a.E).slice(0, Math.max(0, SCAR.maxPrims - sw.length - hu.length - cr.length));
  R.out.prims = cr.concat(go, sw, hu);
  R.out.v++; R.seals++;
}
// G2380: THE WRECK'S REST - after a seal, every restDt: when no node moves faster than vRest (or restMax went by), the
// hulls sealed again where the pieces lie (a wheel that came off and rolled on, a wing that slid after the contacts went
// quiet), once - a new version only if the old hulls do not already cover them. A crashed wreck's few seconds: the
// physics' thread, n speeds twice a second; nothing on an intact flight (rest stays null) or with the layer off
function scarRest(R, p, v, world, t, D) {
  const Q = R.rest;
  if (t - Q.tc < SCAR.restDt) return;
  Q.tc = t;
  let vm = 0; if (v) for (let i = 0; i < R.n; i++) { const s = v[i * 3] * v[i * 3] + v[i * 3 + 1] * v[i * 3 + 1] + v[i * 3 + 2] * v[i * 3 + 2]; if (s > vm) vm = s; }
  if (Math.sqrt(vm) > SCAR.vRest && t - Q.t0 < SCAR.restMax) return;
  R.rest = null;
  const H = scarHulls(R, p, world, D), old = R.out.prims, oldH = old.filter(x => x.k === 'h');
  if (!H.length || (oldH.length && H.every(h => { for (let j = 0; j < h.p.length; j += 2) if (!scarIn(oldH, h.p[j], h.p[j + 1], false)) return false; return true; }))) return;
  R.out.prims = old.filter(x => x.k !== 'h').concat(H);
  R.out.v++; R.seals++; R.rests = (R.rests || 0) + 1;
}
// G2380: THE PIECES AS THEY LIE - the nodes joined by members still whole (union-find over the unbroken beams), each
// piece's nodes lower than hSweep over the ground (dry), their convex hull (Andrew's monotone chain), simplified to at
// most hullPts points - a point dropped widens the margin by its distance from the chord that replaced it, so the hull
// with its margin still covers every node; the margin mRest + that (+ 1 cm for the rounding). The biggest pieces first.
// The nodes are rounded to the cm BEFORE the hull (rounding a hull's corners after can fold a short edge inside out).
function scarHulls(R, p, world, D) {
  const n = R.n, par = new Int32Array(n);
  for (let i = 0; i < n; i++) par[i] = i;
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const brk = new Uint8Array(R.ba.length); if (D.broken) for (const bi of D.broken) brk[bi] = 1;
  for (let b = 0; b < R.ba.length; b++) if (!brk[b]) { const a = find(R.ba[b]), c = find(R.bb[b]); if (a !== c) par[a] = c; }
  const gH = world && typeof world.terrainH === 'function' ? world.terrainH : null, by = new Map();
  for (let i = 0; i < n; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (gH && y - R.nr[i] - gH(x, z) > SCAR.hSweep) continue;
    if (scarSurf(world, x, z) < 0) continue;
    const r = find(i); let L = by.get(r); if (!L) by.set(r, L = []); L.push(scarR2(x), scarR2(z));   // (to the cm first: the hull is built on what is sent)
  }
  const pieces = [...by.values()].sort((a, b) => b.length - a.length).slice(0, SCAR.maxHulls), out = [];
  for (const L of pieces) {
    const { P, m } = scarHull(L);
    out.push({ k: 'h', p: P, m: scarR2(SCAR.mRest + m + 0.01) });
  }
  return out;
}
// the convex hull of [x, z, ...] anticlockwise (x right, z the second axis), at most hullPts points: { P, m } - m the
// farthest a dropped point lay outside what was kept
function scarHull(L) {
  const N = L.length / 2, id = [];
  for (let j = 0; j < N; j++) id.push(j);
  id.sort((a, b) => L[a * 2] - L[b * 2] || L[a * 2 + 1] - L[b * 2 + 1]);
  const cr = (o, a, b) => (L[a * 2] - L[o * 2]) * (L[b * 2 + 1] - L[o * 2 + 1]) - (L[a * 2 + 1] - L[o * 2 + 1]) * (L[b * 2] - L[o * 2]);
  const lo = [], up = [];
  for (const j of id) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], j) <= 1e-9) lo.pop(); lo.push(j); }
  for (let q = id.length - 1; q >= 0; q--) { const j = id[q]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], j) <= 1e-9) up.pop(); up.push(j); }
  let h = N > 1 ? lo.slice(0, -1).concat(up.slice(0, -1)) : id.slice();
  if (!h.length) h = [id[0]];
  let P = []; for (const j of h) P.push(L[j * 2], L[j * 2 + 1]);
  let m = 0;
  while (P.length / 2 > SCAR.hullPts) {
    const K = P.length / 2; let bi = -1, bd = Infinity;
    for (let q = 0; q < K; q++) { const a = (q + K - 1) % K, b = (q + 1) % K;
      const d = scarSegD([P[a * 2], P[a * 2 + 1], P[b * 2], P[b * 2 + 1]], P[q * 2], P[q * 2 + 1]); if (d < bd) { bd = d; bi = q; } }
    P.splice(bi * 2, 2); if (bd > m) m = bd;
  }
  return { P, m };
}
// a hull with its margin: inside the polygon (anticlockwise: left of every edge) or within m of its edges
function scarHullIn(c, x, z) {
  const P = c.p, K = P.length / 2;
  let inside = K >= 3, best = Infinity;
  for (let q = 0; q < K; q++) {
    const ax = P[q * 2], az = P[q * 2 + 1], b = (q + 1) % K, ex = P[b * 2] - ax, ez = P[b * 2 + 1] - az;
    if (ex * (z - az) - ez * (x - ax) < -1e-9) inside = false;
    const e2 = ex * ex + ez * ez; let u = e2 > 1e-12 ? ((x - ax) * ex + (z - az) * ez) / e2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const d = Math.hypot(x - ax - u * ex, z - az - u * ez); if (d < best) best = d;
  }
  return inside || best <= c.m;
}
// ---- THE FOOTPRINT (the page's cull and the gate's): inside a crater's disc, a gouge's strip or a piece's hull (G2380);
// `sweep` adds the sweeps
// (G2382: `B` - scarBoxes(prims), each primitive's own box, tested first: the page's cull tests thousands of instances)
function scarIn(prims, x, z, sweep, B) {
  for (let q = 0; q < prims.length; q++) {
    if (B && (x < B[q * 4] || z < B[q * 4 + 1] || x > B[q * 4 + 2] || z > B[q * 4 + 3])) continue;
    const c = prims[q];
    if (c.k === 'c') { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz <= c.r * c.r) return true; }
    else if (c.k === 'g') { if (scarSegD(c.p, x, z) <= c.w / 2) return true; }
    else if (c.k === 'h') { if (scarHullIn(c, x, z)) return true; }        // G2380: the resting wreck's pieces
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
    const ax = P[j], az = P[j + 1], ex = P[j + 2] - ax, ez = P[j + 3] - az, e2 = ex * ex + ez * ez;   // (no array a leg)
    let u = e2 > 1e-12 ? ((x - ax) * ex + (z - az) * ez) / e2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    if (Math.hypot(x - ax - u * ex, z - az - u * ez) <= h) return true; }
  return false;
}
// each primitive's own box [x0, z0, x1, z1, ...] (scarIn's B): a crater's disc, a strip's or a sweep's points +- its half
// width, a hull's + its margin
function scarBoxes(prims) {
  const B = new Float64Array(prims.length * 4);
  prims.forEach((c, q) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    if (c.k === 'c') { x0 = c.x - c.r; x1 = c.x + c.r; z0 = c.z - c.r; z1 = c.z + c.r; }
    else for (let j = 0; j < c.p.length; j += 2) { const h = c.k === 'h' ? c.m : (c.ws ? c.ws[j / 2] : c.w) / 2;
      x0 = Math.min(x0, c.p[j] - h); x1 = Math.max(x1, c.p[j] + h); z0 = Math.min(z0, c.p[j + 1] - h); z1 = Math.max(z1, c.p[j + 1] + h); }
    if (c.k === 's' && c.ws) { let w = 0; for (const v of c.ws) w = Math.max(w, v / 2); x0 -= w; x1 += w; z0 -= w; z1 += w; }   // (a leg takes its wider end)
    B[q * 4] = x0; B[q * 4 + 1] = z0; B[q * 4 + 2] = x1; B[q * 4 + 3] = z1;
  });
  return B;
}
// the footprint's box [x0, z0, x1, z1] (the sweeps with `sweep`), null for none
function scarBox(prims, sweep) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const c of prims) {
    if (c.k === 'c') { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); z0 = Math.min(z0, c.z - c.r); z1 = Math.max(z1, c.z + c.r); continue; }
    if (c.k === 's' && !sweep) continue;
    for (let j = 0; j < c.p.length; j += 2) { const h = c.k === 'h' ? c.m : (c.ws ? c.ws[j / 2] : c.w) / 2; x0 = Math.min(x0, c.p[j] - h); x1 = Math.max(x1, c.p[j] + h); z0 = Math.min(z0, c.p[j + 1] - h); z1 = Math.max(z1, c.p[j + 1] + h); }
  }
  return x0 <= x1 ? [x0, z0, x1, z1] : null;
}
