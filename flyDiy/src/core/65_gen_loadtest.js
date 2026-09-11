// ============================================================
// GARAGE 5/5 — the LOAD TEST RIG. Static proof-of-structure, in the sim.
//
// The sandbag test an amateur-built aeroplane has to pass before it flies:
// bags over the wing to LIMIT load (no permanent set), then to ULTIMATE, which
// is 1.5x limit (no failure). FAR 23 normal category is +3.8 g and +5.7 g.
//
// ONE IMPLEMENTATION. This drives a sim step by step and holds all its state,
// so GATE LOAD runs it headless and the garage ticks the same object per frame
// and draws the result. There is no second place a load-test number lives.
//
// THE RIG, and why it is built this way — three versions of it were wrong
// first, and each looked right:
//   1. Load the wing and let the aeroplane's own INERTIA react it. A legitimate
//      pull-up on paper. But only the wing is loaded and nothing balances the
//      pitching moment, so it rotates under the measurement: the C172 read
//      1.25 % at 1 g and -0.95 % at 3.8 g.
//   2. React at the wing root stations, making it self-equilibrated in FORCE.
//      The net MOMENT still is not zero, so it rotates slowly instead of fast,
//      and at 5.7 g the body frame flipped mid-run: the trace jumped 5.10 -> 0.22.
//   3. BOLT THE FUSELAGE DOWN. Every non-wing node is pinned each step, which
//      is what trestles are. Nothing to balance, nothing to tumble.
//
// AND THE AEROPLANE GOES ON ITS BACK (G64). Version 3 loaded the wing UPWARD
// on an upright aeroplane, which is the right BENDING — FAR 23's +3.8 g and
// +5.7 g are flight loads and a flying wing bends up — and the wrong PICTURE:
// the viewer drew the sandbags resting on top of the wing and the wing then
// rose to meet them. The user's report was exactly that, "it was bending the
// wing the wrong way around". Flipping the load would have been worse than the
// drawing, because it would prove the wing against NEGATIVE g while printing
// positive-g numbers. So the aeroplane is turned over instead, which is how a
// homebuilt sandbag test is actually done and what this gate's own header has
// always said it was ("the real rig inverts the aeroplane and stands the
// fuselage on supports"): bags on the upward-facing lower surface, pressing
// DOWN with gravity, bending the wing the way flight does.
//
// Nothing measured changes by construction: `rise` resolves onto the BODY up
// axis, which `bodyAxes` builds geometrically out of upLo->upHi, so it turns
// over with the aeroplane. The jig datum is taken after the settle either way,
// so the wing's own 1 g — which now adds to the bags instead of opposing them —
// cancels out of every reported deflection.
//
// And the load is RAMPED, not stepped: DEFDAMP is a rate with tau = 2 s, so a
// step leaves the wing ringing past fifteen seconds and reading it at one
// instant samples the ring. `relax` bleeds the deformation velocity — only the
// part relative to the mass-weighted mean, so rigid motion is untouched — which
// converges to the same static answer quickly. Legitimate because only the
// settled state is wanted; nothing here claims to be a transient.
//
// The acceptance number is LINEARITY: 3.8 g of bags must give 3.8x the
// deflection. All three broken rigs failed it. See HANDOVER, GATE LOAD.
// ============================================================
const GEN_LOAD_LIMIT = 3.8;         // FAR 23 normal category
const GEN_LOAD_ULT = 5.7;           // 1.5 x limit
// How far the rig lifts the aeroplane before it bolts it down. NAMED and
// exported because the viewer has to know it: the camera tracks the CG, so it
// went up with the aeroplane, but the hangar stayed on the floor 200 m below
// and the test ran in an empty sky. The room now carries the same offset.
const GEN_LOAD_LIFT = 200;
const GEN_LOAD_WINGTAGS = ['WF', 'WR', 'WB', 'WB2'];
// THE SURFACES THE RIG CAN LOAD (TAIL CHANTIER 2 P4): the wing as always,
// and the stab and the fin on their own spar nodes (61_gen_frame's tail
// truss). `tags` are the nodes left FREE on the trestles and the flood's
// boundary; `strips` the strips the bags land on; `axis` the body axis the
// load presses along and the deflection is read on (1 = up: the wing and
// the stab, inverted on the trestles as the sandbag test is; 2 = the fin's
// side load, the aeroplane upright); `station` the coordinate the stations
// are ordered on; `ref` the share of the aeroplane's weight the bags carry
// at 1 g — the whole of it on the wing, and on a tail surface its own
// area's share (the tail loaded at the wing's own loading — a stated
// approximation of the certification down-load, not a sizing case).
const GEN_LOAD_SURFACES = {
  wing: { tags: GEN_LOAD_WINGTAGS, strips: ['wing'], axis: 1, station: 2, front: 'WF', rear: 'WR', ref: 1 },
  // the stab at the wing's own loading (a tailplane's down-load case is of
  // that order); the fin at HALF — the rudder-kick case sits near half the
  // wing's lift coefficient, a fin never flies at the wing's
  stab: { tags: ['HF', 'HR', 'HB', 'HT'], strips: ['stab'], axis: 1, station: 2, front: 'HF', rear: 'HR', ref: 1 },
  fin:  { tags: ['VF', 'VR', 'VX', 'FIN'], strips: ['fin'], axis: 2, station: 1, front: 'VF', rear: 'VR', ref: 0.5 },
};

// WHAT THE WING CARRIES (G179). A node is wing-carried when the fuselage
// cannot reach it without crossing a spar node: flood the beams from the
// firewall ring, never expanding through a wing tag, and whatever is neither
// reached nor wing hangs off the wing — a nacelle, its bearer foot. The
// trestles used to pin every non-spar node, which is a trestle under each
// wing-mounted engine: the bearer could never be loaded here, and this gate
// was blind to one that let its engine hang 0.3 m.
function genLoadCarried(def, tags) {
  const wing = {};
  for (const t of (tags || GEN_LOAD_WINGTAGS)) wing[t] = 1;
  const adj = def.nodes.map(function () { return []; });
  for (const b of def.beams) { adj[b.a].push(b.b); adj[b.b].push(b.a); }
  const seen = new Uint8Array(def.nodes.length);
  const q = ((def.refs && def.refs.noseFrame) || []).slice();
  for (const i of q) seen[i] = 1;
  while (q.length) {
    const i = q.pop();
    if (wing[def.nodes[i].tag]) continue;        // the wing is the boundary
    for (const j of adj[i]) if (!seen[j]) { seen[j] = 1; q.push(j); }
  }
  const out = [];
  def.nodes.forEach(function (n, i) { if (!seen[i] && !wing[n.tag]) out.push(i); });
  return out;
}

// spar stations on the +z wing (or, P4, on the +z stab / up the fin), front
// node paired with its nearest rear node; `z` is the station coordinate
function genLoadStations(def, plane, surface) {
  const SF = GEN_LOAD_SURFACES[surface || 'wing'] || GEN_LOAD_SURFACES.wing;
  const k = SF.station;
  const wf = [], wr = [];
  plane = plane || 0;
  def.nodes.forEach((n, i) => {
    if (k === 2 && n.p[2] <= 0) return;                      // one side
    if (SF === GEN_LOAD_SURFACES.wing && (n.plane || 0) !== plane) return;   // G185: one plane
    if (n.tag === SF.front) wf.push(i);
    if (n.tag === SF.rear) wr.push(i);
  });
  wf.sort((a, b) => def.nodes[a].p[k] - def.nodes[b].p[k]);
  return wf.map(f => {
    const z = def.nodes[f].p[k];
    let r = -1, bd = Infinity;
    for (const q of wr) { const d = Math.abs(def.nodes[q].p[k] - z); if (d < bd) { bd = d; r = q; } }
    return { f: f, r: r, z: z };
  });
}

// makeLoadTest(sim, def, cfg) -> rig
//   rig.step(dt)  advance one frame; returns rig.state
//   rig.state     { phase, n, nTarget, tipPct, tipM, defl[], worstPct, worstCls,
//                   limitPct, ultPct, verdict, done }
// cfg: { limit, ult, rampS, holdS, material } — material is the GEN_MATERIALS
// key, and only supplies the yield allowable; omit it and the yield column is
// simply absent (the hand fiches have no material behind their k).
function makeLoadTest(sim, def, cfg) {
  cfg = cfg || {};
  const LIM = cfg.limit == null ? GEN_LOAD_LIMIT : cfg.limit;
  const ULT = cfg.ult == null ? GEN_LOAD_ULT : cfg.ult;
  const RAMP = (cfg.rampS == null ? 4.0 : cfg.rampS);
  const HOLD = (cfg.holdS == null ? 1.5 : cfg.holdS);
  const SETTLE = (cfg.settleS == null ? 2.0 : cfg.settleS);
  const MAT = (typeof GEN_MATERIALS !== 'undefined' && cfg.material)
    ? GEN_MATERIALS[cfg.material] : null;
  // THE ENGINE IS STOPPED ON THE RIG (the panel arc, session 1): a sandbag
  // test happens in a hangar, and since the burn drains every tank in every
  // sim, a running engine would lighten the aeroplane under the bags —
  // and the linearity check reads that as a bent rig.
  if (sim.setEngine && sim.eng)
    for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'off' });
  // THE WING IS JUDGED AS WHAT IT IS BUILT OF (G213). `cfg.wingMaterial` is a
  // GEN_SURF_MATERIALS key (or row): the wing class's allowable is that
  // row's section and yield, not the fuselage's. Measured before this: the
  // stock tube aeroplane's spruce-spar fabric wing read 131 % "of yield"
  // against STEEL's 0.62 kg/m section — a wooden spar judged as a tube.
  const WM = cfg.wingMaterial == null ? null
    : (typeof cfg.wingMaterial === 'string'
        ? ((typeof GEN_SURF_MATERIALS !== 'undefined' && GEN_SURF_MATERIALS[cfg.wingMaterial]) || null)
        : cfg.wingMaterial);

  // THE SURFACE (P4): the wing unless the case names the stab or the fin
  const SURF = GEN_LOAD_SURFACES[cfg.surface || 'wing'] || GEN_LOAD_SURFACES.wing;
  const AX = SURF.axis, SK = SURF.station;
  const st = genLoadStations(def, 0, cfg.surface);
  const ok = st.length >= 2;
  const root = ok ? st[0] : null, tip = ok ? st[st.length - 1] : null;
  const semi = ok ? def.nodes[tip.f].p[SK] - (SK === 1 ? def.nodes[root.f].p[SK] : 0) : 1;

  // total weight, and the bags: n*W split over the wing strips by area, then on
  // to nodes through each strip's own attachment weights — the same path the
  // solver uses for lift, so the bags sit where the lift does by construction.
  // A tail surface's bags carry its own area's share of W at the WING's
  // loading (see GEN_LOAD_SURFACES.ref).
  let W = 0;
  for (const nd of def.nodes) W += nd.m;
  W *= 9.81;
  const perG = new Map();
  {
    const wing = def.strips.filter(s => SURF.strips.indexOf(s.kind) >= 0);
    let area = 0, areaW = 0;
    for (const s of wing) area += s.area;
    for (const s of def.strips) if (s.kind === 'wing') areaW += s.area;
    const share0 = SURF === GEN_LOAD_SURFACES.wing ? 1 : (areaW > 0 ? area / areaW : 0.2) * (SURF.ref || 1);
    if (area > 0) for (const s of wing) {
      const share = W * share0 * (s.area / area);
      for (const wq of s.w) perG.set(wq[0], (perG.get(wq[0]) || 0) + share * wq[1]);
    }
  }
  const bags = [];
  perG.forEach((f, i) => bags.push([i, f]));

  // the trestles: everything that is not the surface is pinned where it starts
  const wingTag = {};
  for (const t of SURF.tags) wingTag[t] = 1;
  // G179: wing-carried nodes (a nacelle and its foot) go FREE, and at n g
  // their mass is the RELIEF a real sandbag test sees — the bags carry n*W,
  // the engine pulls n*m the other way, the spar takes the difference, as
  // in a pull-up. Their 1 g hang is in the datum like the wing's own.
  const carried = genLoadCarried(def, SURF.tags);
  const carriedTag = {};
  for (const i of carried) carriedTag[i] = 1;
  const pin = [];

  const state = { phase: 'settle', n: 0, nTarget: ULT, tipPct: 0, tipM: 0,
                  defl: st.map(function () { return 0; }), z: st.map(s => s.z),
                  semi: semi, worstPct: null, worstCls: null, worstBeam: -1,
                  limitPct: null, ultPct: null, limitYield: null, ultYield: null,
                  verdict: null, done: false, W: W, ok: ok };

  let t = 0, base = null, peak = {};

  function clamp() {
    for (let k = 0; k < pin.length; k++) {
      const p = pin[k], i = p[0] * 3;
      sim.p[i] = p[1]; sim.p[i+1] = p[2]; sim.p[i+2] = p[3];
      sim.v[i] = sim.v[i+1] = sim.v[i+2] = 0;
    }
  }
  function relax() {
    const vm = sim.cgVel();
    for (let i = 0; i < sim.n; i++) {
      const o = i * 3;
      sim.v[o]   = vm[0] + (sim.v[o]   - vm[0]) * 0.85;
      sim.v[o+1] = vm[1] + (sim.v[o+1] - vm[1]) * 0.85;
      sim.v[o+2] = vm[2] + (sim.v[o+2] - vm[2]) * 0.85;
    }
  }
  function rise(s, yB) {
    const dx = sim.p[s.f*3] - sim.p[root.f*3],
          dy = sim.p[s.f*3+1] - sim.p[root.f*3+1],
          dz = sim.p[s.f*3+2] - sim.p[root.f*3+2];
    return dx*yB[0] + dy*yB[1] + dz*yB[2];
  }
  function yieldPct() {
    if (!MAT || !MAT.phys) return null;
    let worst = null;
    for (const cls in peak) {
      const R = ((cls === 'wing' || cls === 'tail') && WM && WM.phys && WM.lin) ? WM : MAT;
      // the tail class (P4) is the wing row of its material at the tail's section
      const tSec = (typeof GEN_RULES !== 'undefined' && GEN_RULES.tailSection != null) ? GEN_RULES.tailSection : 0.5;
      const linC = R.lin[cls] != null ? R.lin[cls] : (cls === 'tail' ? tSec * R.lin.wing : null);
      if (!linC) continue;
      const A = linC / R.phys.rho;
      const pct = 100 * peak[cls].F / (R.phys.sigY * A);
      if (!worst || pct > worst.pct) worst = { cls: cls, pct: pct, bi: peak[cls].bi };
    }
    return worst;
  }

  // 180 degrees about the aeroplane's OWN x axis, through its centre of mass:
  // about a WORLD axis it would come to rest pitched by twice the body axis's
  // inclination (the boom sits ~3.7 deg nose-down to the frame axis, G54), and
  // a rig that pitches the aeroplane while claiming to invert it is one more
  // picture that disagrees with its numbers.
  function invert() {
    const a = sim.axes()[0];                       // body x, nose -> tail
    let cx = 0, cy = 0, cz = 0, M = 0;
    for (let i = 0; i < sim.n; i++) {
      const m = def.nodes[i].m; M += m;
      cx += m * sim.p[i*3]; cy += m * sim.p[i*3+1]; cz += m * sim.p[i*3+2];
    }
    if (!(M > 0)) return;
    cx /= M; cy /= M; cz /= M;
    for (let i = 0; i < sim.n; i++) {
      const o = i * 3;
      const dx = sim.p[o] - cx, dy = sim.p[o+1] - cy, dz = sim.p[o+2] - cz;
      const k = 2 * (a[0]*dx + a[1]*dy + a[2]*dz);   // Rodrigues at 180 deg:
      sim.p[o]   = cx + k*a[0] - dx;                 //   v' = 2(a.v)a - v
      sim.p[o+1] = cy + k*a[1] - dy;
      sim.p[o+2] = cz + k*a[2] - dz;
      sim.v[o] = sim.v[o+1] = sim.v[o+2] = 0;        // it is set down, not thrown
    }
  }

  function begin() {
    invert();                       // on its back, on the trestles
    // clear of the ground so contact never joins in, then bolt the rig down
    for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += GEN_LOAD_LIFT;
    pin.length = 0;
    def.nodes.forEach(function (nd, i) {
      if (!wingTag[nd.tag] && !carriedTag[i])
        pin.push([i, sim.p[i*3], sim.p[i*3+1], sim.p[i*3+2]]);
    });
  }
  begin();

  // THE TRESTLES HOLD EVERY SUBSTEP (G185). The clamp used to reset the
  // pinned nodes once per FRAME: for a whole frame's substeps a clamped node
  // moved freely under the stiff members hung on it, then snapped back —
  // an impulse at the frame rate that a stiff member from a pinned node to
  // a light free one turns into a divergence. G179 met it as "the rig's
  // per-frame trestle clamp resonating with a fuselage row that is already
  // stiff" and worked around it with the bearer's material; a parasol's
  // cabane and a biplane's box on a wood, alloy or carbon airframe (member
  // strains 0.11-0.20 at 1 g, tips -13 % to +35 %, tubeFabric alone sane)
  // made it a defect. A trestle does not let go between substeps: the
  // clamp now runs inside the frame, after every substep.
  const SUB = (def.params && def.params.substeps) || 24;
  function stepClamped(dt) {
    for (let k = 0; k < SUB; k++) { sim.step(dt / SUB, 1); clamp(); }
  }
  function step(dt) {
    if (state.done || !ok) return state;
    t += dt;
    if (state.phase === 'settle') {
      stepClamped(dt); relax();
      if (t >= SETTLE) {
        // the settled shape under the wing's OWN weight is the jig datum, which
        // is what the real test measures deflection from
        const ax = sim.axes();
        base = st.map(s => rise(s, ax[AX]));
        state.phase = 'ramp'; t = 0;
      }
      return state;
    }
    // ramp to ultimate, recording the limit case on the way past
    const n = state.phase === 'hold' ? ULT : Math.min(ULT, ULT * (t / RAMP));
    state.n = n;
    // the bags press DOWN, because they are bags. The aeroplane being inverted
    // is what makes that the flight-load direction through the spar. The
    // fin's case (P4) presses SIDEWAYS along the body's own right axis.
    if (AX === 1) {
      for (let k = 0; k < bags.length; k++)
        sim.impulse(bags[k][0], 0, -n * bags[k][1] * dt, 0);
      // ...and what the wing carries pulls the other way (G179, see `carried`)
      for (let k = 0; k < carried.length; k++)
        sim.impulse(carried[k], 0, n * def.nodes[carried[k]].m * 9.81 * dt, 0);
    } else {
      const zB = sim.axes()[2];
      for (let k = 0; k < bags.length; k++)
        sim.impulse(bags[k][0], -n * bags[k][1] * dt * zB[0], -n * bags[k][1] * dt * zB[1], -n * bags[k][1] * dt * zB[2]);
    }
    stepClamped(dt); relax();

    // WHICH member, not just which class. The allowable is per class, so the
    // percentage could always be worked out — but "78% of yield" does not tell
    // you where to put more tube. Recording the index costs one field and lets
    // the viewer put a marker on the member that is actually complaining.
    for (let bi = 0; bi < sim.beams.length; bi++) {
      const bm = sim.beams[bi];
      const cls = bm.cls || (bm.gear ? 'gear' : 'chassis');
      const F = Math.abs(bm.k * bm.strain * bm.L0);
      const g = peak[cls] || (peak[cls] = { F: 0, bi: -1 });
      if (F > g.F) { g.F = F; g.bi = bi; }
    }
    const ax = sim.axes();
    state.defl = st.map((s, i) => 100 * (rise(s, ax[AX]) - base[i]) / semi);
    state.tipPct = state.defl[state.defl.length - 1];
    state.tipM = state.tipPct / 100 * semi;
    const w = yieldPct();
    if (w) { state.worstPct = w.pct; state.worstCls = w.cls; state.worstBeam = w.bi; }

    if (state.limitPct === null && n >= LIM) {
      state.limitPct = state.tipPct;
      state.limitYield = state.worstPct;
    }
    if (state.phase === 'ramp' && n >= ULT) { state.phase = 'hold'; t = 0; }
    else if (state.phase === 'hold' && t >= HOLD) {
      state.ultPct = state.tipPct;
      state.ultYield = state.worstPct;
      state.phase = 'done'; state.done = true;
      // The structure held if it stayed finite. Permanent set is PROXIED by
      // peak force against sigY*A — the load at which a member takes a set, and
      // correct even on soft springs because failure is a force threshold. It
      // is reported rather than failed on: `A = lin/rho` is one area for the
      // whole wing class and the worst member is usually the LIFT STRUT, which
      // a real aeroplane sizes on its own. See HANDOVER, GATE LOAD.
      state.verdict = sim.stats().bad ? 'BROKE UP'
        : (state.ultYield !== null && state.ultYield >= 100 ? 'HELD — over yield'
                                                           : 'HELD');
    }
    if (sim.stats().bad) { state.verdict = 'BROKE UP'; state.done = true; }
    return state;
  }

  // `bags` and `lift` are out here for the VIEWER. The bags were never geometry
  // — they are impulses on nodes — so there was nothing on screen to see going
  // on, which is why a load test read as an aeroplane sitting still and then
  // occasionally exploding. Handing out the same list the physics uses means
  // the sandbags drawn are the sandbags applied, and cannot drift from them.
  return { step: step, state: state, stations: st, semi: semi, W: W,
           limit: LIM, ult: ULT, bags: bags, lift: GEN_LOAD_LIFT,
           carried: carried };
}
