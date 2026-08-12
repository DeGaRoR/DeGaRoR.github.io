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
const GEN_LOAD_WINGTAGS = ['WF', 'WR', 'WB', 'WB2'];

// spar stations on the +z wing, front node paired with its nearest rear node
function genLoadStations(def) {
  const wf = [], wr = [];
  def.nodes.forEach((n, i) => {
    if (n.p[2] <= 0) return;
    if (n.tag === 'WF') wf.push(i);
    if (n.tag === 'WR') wr.push(i);
  });
  wf.sort((a, b) => def.nodes[a].p[2] - def.nodes[b].p[2]);
  return wf.map(f => {
    const z = def.nodes[f].p[2];
    let r = -1, bd = Infinity;
    for (const q of wr) { const d = Math.abs(def.nodes[q].p[2] - z); if (d < bd) { bd = d; r = q; } }
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

  const st = genLoadStations(def);
  const ok = st.length >= 2;
  const root = ok ? st[0] : null, tip = ok ? st[st.length - 1] : null;
  const semi = ok ? def.nodes[tip.f].p[2] : 1;

  // total weight, and the bags: n*W split over the wing strips by area, then on
  // to nodes through each strip's own attachment weights — the same path the
  // solver uses for lift, so the bags sit where the lift does by construction.
  let W = 0;
  for (const nd of def.nodes) W += nd.m;
  W *= 9.81;
  const perG = new Map();
  {
    const wing = def.strips.filter(s => s.kind === 'wing');
    let area = 0;
    for (const s of wing) area += s.area;
    if (area > 0) for (const s of wing) {
      const share = W * (s.area / area);
      for (const wq of s.w) perG.set(wq[0], (perG.get(wq[0]) || 0) + share * wq[1]);
    }
  }
  const bags = [];
  perG.forEach((f, i) => bags.push([i, f]));

  // the trestles: everything that is not wing is pinned where it starts
  const wingTag = {};
  for (const t of GEN_LOAD_WINGTAGS) wingTag[t] = 1;
  const pin = [];

  const state = { phase: 'settle', n: 0, nTarget: ULT, tipPct: 0, tipM: 0,
                  defl: st.map(function () { return 0; }), z: st.map(s => s.z),
                  semi: semi, worstPct: null, worstCls: null,
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
      if (!MAT.lin[cls]) continue;
      const A = MAT.lin[cls] / MAT.phys.rho;
      const pct = 100 * peak[cls].F / (MAT.phys.sigY * A);
      if (!worst || pct > worst.pct) worst = { cls: cls, pct: pct };
    }
    return worst;
  }

  function begin() {
    // clear of the ground so contact never joins in, then bolt the rig down
    for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += 200;
    pin.length = 0;
    def.nodes.forEach(function (nd, i) {
      if (!wingTag[nd.tag]) pin.push([i, sim.p[i*3], sim.p[i*3+1], sim.p[i*3+2]]);
    });
  }
  begin();

  function step(dt) {
    if (state.done || !ok) return state;
    t += dt;
    if (state.phase === 'settle') {
      sim.step(dt); clamp(); relax();
      if (t >= SETTLE) {
        // the settled shape under the wing's OWN weight is the jig datum, which
        // is what the real test measures deflection from
        const ax = sim.axes();
        base = st.map(s => rise(s, ax[1]));
        state.phase = 'ramp'; t = 0;
      }
      return state;
    }
    // ramp to ultimate, recording the limit case on the way past
    const n = state.phase === 'hold' ? ULT : Math.min(ULT, ULT * (t / RAMP));
    state.n = n;
    for (let k = 0; k < bags.length; k++)
      sim.impulse(bags[k][0], 0, n * bags[k][1] * dt, 0);
    sim.step(dt); clamp(); relax();

    for (const bm of sim.beams) {
      const cls = bm.cls || (bm.gear ? 'gear' : 'chassis');
      const F = Math.abs(bm.k * bm.strain * bm.L0);
      const g = peak[cls] || (peak[cls] = { F: 0 });
      if (F > g.F) g.F = F;
    }
    const ax = sim.axes();
    state.defl = st.map((s, i) => 100 * (rise(s, ax[1]) - base[i]) / semi);
    state.tipPct = state.defl[state.defl.length - 1];
    state.tipM = state.tipPct / 100 * semi;
    const w = yieldPct();
    if (w) { state.worstPct = w.pct; state.worstCls = w.cls; }

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

  return { step: step, state: state, stations: st, semi: semi, W: W,
           limit: LIM, ult: ULT };
}
