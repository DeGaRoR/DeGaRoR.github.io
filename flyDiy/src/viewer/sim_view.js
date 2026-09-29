// ============================================================
// THE SIM, SEEN FROM THE PAGE (G810, 2026-09-27; ARCH-2026-09-27 §2.2, the
// main side of chantier 1 step 1). sim_host.js steps the solver on its own
// thread and publishes snapshots; this is the object the page reads INSTEAD of
// `sim` when it does - the same surface the viewer reads today (grep
// `sim\.[a-z]+` in src/viewer: p, ctl, cgPos, out, eng, setEngine, axes,
// hydro, fuel, cgVel, totalM, n, beams, t, reset, stance, wheelsOnGround,
// bodyOrigin, impulse, stats, starterOk), so poseModel, the flex skin, the
// cockpit, the director and the HUD keep their lines.
//
//   READS     computed from the snapshot. p is float64 and INTERPOLATED
//             between the two newest snapshots at T - 1 step (frame(T), once
//             a rendered frame): smooth at 30/45/60/144 Hz, one 60 Hz step
//             behind (ARCH §2.2's latency, the prototype's 11-23 ms pose
//             age). cgPos / axes / bodyOrigin are the solver's own formulas
//             (30_solver.js, the same sums in the same order, Math.hypot for
//             hyp3 - GATE HYPOT holds them equal) on the view's p, with the
//             fuel nodes' masses and totalM from the snapshot: at the newest
//             snapshot they are the solver's numbers to the bit (GATE
//             SIMWORKER). out / eng / fuel / hydro / ctl / ap are the
//             newest snapshot's plain copies.
//   WRITES    become COMMANDS, stamped with a step index (at(k); none = the
//             next boundary) and posted once a frame (flush()): sim.ctl's
//             six scalar levers are accessors that queue a `ctl` command,
//             ctl.eng is diffed at flush; setEngine carries the page's
//             starterOk (the bus) with it; reset, stance, impulse go as they
//             are. hand(h) is the manual hand, written by the host every step
//             (INP.write's door). step() does nothing and is COUNTED
//             (strays): a stray caller is a hidden sim writer ARCH §2.6
//             warned of.
//   BUFFERS   each snapshot's ArrayBuffer goes back to the host when a newer
//             pair no longer needs it ({cmd:'release'}, transferred).
//
// Transport-agnostic: `opts.post(msg, transfer)` reaches the host and the
// caller hands every message from it to take(msg). `opts.ready` is the host's
// ready message (the snapshot layout, the fuel nodes, the def's signature).
// ============================================================

const SIM_VIEW_LEVERS = ['thr', 'de', 'da', 'dr', 'brake', 'flap'];

function simViewDefSig(def) {
  const a = new Float64Array(def.nodes.length * 4);
  def.nodes.forEach((nd, i) => { a[i * 4] = nd.p[0]; a[i * 4 + 1] = nd.p[1]; a[i * 4 + 2] = nd.p[2]; a[i * 4 + 3] = nd.m; });
  const u = new Uint8Array(a.buffer);
  let h = 2166136261;
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0;
  return def.nodes.length + ':' + h.toString(16);
}

function makeSimView(def, opts) {
  const R = opts.ready, S = R.slots, n = def.nodes.length, N3 = n * 3;
  const post = opts.post || (() => false);
  const delayS = opts.delayS != null ? opts.delayS : R.dt;     // T - 1 step
  const now = opts.now || (() => performance.timeOrigin + performance.now());
  const mismatch = R.n !== n || (R.defSig && R.defSig !== simViewDefSig(def));
  const p = new Float64Array(N3), m = new Float64Array(n);
  for (let i = 0; i < n; i++) { const q = def.nodes[i].p; p[i * 3] = q[0]; p[i * 3 + 1] = q[1]; p[i * 3 + 2] = q[2]; m[i] = def.nodes[i].m; }
  const fuelIdx = R.fuelIdx || [];
  const oP = S.HEAD, oV = R.withV ? S.HEAD + N3 : -1, oM = S.HEAD + N3 * (R.withV ? 2 : 1);
  let A = null, B = null;                  // the two newest snapshots: { f, buf }
  let stamp = null, pending = [], ctlPatch = null, engSent = 'null';
  let strays = 0, takes = 0, mCur = null;
  const cv = [0, 0, 0];

  // the levers: reads show the host's (the pilot writes them), a write queues a command
  const lever = {};
  const ctl = {};
  for (const k of SIM_VIEW_LEVERS) {
    lever[k] = 0;
    Object.defineProperty(ctl, k, { enumerable: true, get: () => lever[k],
      set: v => { lever[k] = v; (ctlPatch = ctlPatch || {})[k] = v; } });
  }
  ctl.eng = null;

  const cmd = c => { if (stamp != null && c.k == null) c.k = stamp; pending.push(c); };
  const release = s => { if (s && s.buf) post({ cmd: 'release', buf: s.buf }, [s.buf]); };
  // the masses the solver's sums use: the def's, the fuel nodes' from the snapshot
  function massesOf(s) {
    if (mCur === s) return;
    mCur = s;
    for (let j = 0; j < fuelIdx.length; j++) m[fuelIdx[j]] = s.f[oM + j];
  }
  // 30_solver.js avgP / bodyAxes / cgPos, on the view's p
  const avgP = (ids, o) => { o[0] = o[1] = o[2] = 0;
    for (const i of ids) { o[0] += p[i * 3]; o[1] += p[i * 3 + 1]; o[2] += p[i * 3 + 2]; }
    const k = 1 / ids.length; o[0] *= k; o[1] *= k; o[2] *= k; return o; };
  const norm3 = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-9; a[0] /= L; a[1] /= L; a[2] /= L; return a; };

  const view = {
    n, p, ctl, def, mismatch,
    v: R.withV ? new Float64Array(N3) : null,
    beams: def.beams,                      // the topology (a, b); the strains stay the host's (stats().smax)
    out: {}, eng: [], fuel: {}, hydro: null, wheels: null, ap: {}, snapCtl: null,
    starterOk: null,                       // the cockpit's (the bus) - read when a key turns, sent with it
    get t() { return B ? B.f[S.T] : 0; },
    get totalM() { return B ? B.f[S.TOTALM] : def.nodes.reduce((a, nd) => a + nd.m, 0); },
    get stepIndex() { return B ? B.f[S.STEP] : 0; },
    snapshot: () => B && B.f,

    // ---- the frame: the pose at T - 1 step, from the two newest snapshots
    frame(T) {
      if (!B) return null;
      if (T == null) T = now();
      const fB = B.f;
      let alpha = 1;
      if (A && A.f[S.EPOCH] === fB[S.EPOCH] && fB[S.T] > A.f[S.T]) {
        // the sim time T maps to: B's, plus the wall time since B was published, at the host's rate
        const tau = fB[S.T] + (T - fB[S.WALL]) / 1000 * (fB[S.RATE] || 1) - delayS;
        alpha = (tau - A.f[S.T]) / (fB[S.T] - A.f[S.T]);
      }
      if (alpha >= 1) { alpha = 1; p.set(fB.subarray(oP, oP + N3)); }
      else if (alpha <= 0) { alpha = 0; p.set(A.f.subarray(oP, oP + N3)); }
      else { const fA = A.f; for (let i = 0; i < N3; i++) p[i] = fA[oP + i] + (fB[oP + i] - fA[oP + i]) * alpha; }
      for (let j = 0; j < 3; j++) cv[j] = alpha === 1 ? fB[S.CGV + j] : A.f[S.CGV + j] + (fB[S.CGV + j] - A.f[S.CGV + j]) * alpha;
      if (view.v) view.v.set(fB.subarray(oV, oV + N3));
      massesOf(B);
      // the pose's age: now, less the wall moment the host held the drawn state (between A's and B's publishing)
      const wShown = A && alpha < 1 ? A.f[S.WALL] + (fB[S.WALL] - A.f[S.WALL]) * alpha : fB[S.WALL];
      // G1100: the drawn pose's own sim time (the sea is drawn at it: app.js WATER.setTime)
      const tShown = A && alpha < 1 ? A.f[S.T] + (fB[S.T] - A.f[S.T]) * alpha : fB[S.T];
      return { alpha, ageMs: T - wShown, t: tShown };
    },

    // ---- a message from the host; true when it was a snapshot
    take(msg) {
      if (!msg || msg.kind !== 'snap') return false;
      const s = { f: new Float64Array(msg.buf), buf: msg.buf };
      if (A) release(A);
      A = B; B = s; takes++;
      const M = msg.meta || {};
      if (M.ctl) view.snapCtl = M.ctl;       // G815: the host's ctl as published (sim_link.js mirrors it whole)
      if (M.out) { view.out = M.out; view.out.hydro = M.hydro || null; }
      if (M.eng) view.eng = M.eng;
      if (M.fuel) view.fuel = M.fuel;
      view.hydro = M.hydro || null;
      view.wheels = M.wheels || null;
      if (M.apNew) view.ap = {};             // G820 (C1c): a new pilot (Fly on, the skip) - no field of the last one kept
      if (M.ap) for (const k of Object.keys(M.ap)) view.ap[k] = M.ap[k];
      if (M.ctl) {
        for (const k of SIM_VIEW_LEVERS) if (!(ctlPatch && k in ctlPatch) && M.ctl[k] !== undefined) lever[k] = M.ctl[k];
        if (!pending.some(c => c.cmd === 'ctl' && c.set && 'eng' in c.set)) {
          ctl.eng = M.ctl.eng ? M.ctl.eng.map(e => (e ? Object.assign({}, e) : e)) : null;
          engSent = JSON.stringify(ctl.eng);
        }
      }
      if (!A) view.frame(Infinity);          // the first snapshot: the pose at once
      return true;
    },

    // ---- the reads the solver answers (30_solver.js), on the view's p
    cgPos() {
      if (B) massesOf(B);
      let x = 0, y = 0, z = 0;
      for (let i = 0; i < n; i++) { x += p[i * 3] * m[i]; y += p[i * 3 + 1] * m[i]; z += p[i * 3 + 2] * m[i]; }
      const M = view.totalM;
      return [x / M, y / M, z / M];
    },
    cgVel() { return B ? cv.slice() : [0, 0, 0]; },
    axes() {
      const t1 = avgP(def.refs.noseFrame, [0, 0, 0]), t2 = avgP(def.refs.tailMid, [0, 0, 0]);
      const xAft = norm3([t2[0] - t1[0], t2[1] - t1[1], t2[2] - t1[2]]);
      avgP(def.refs.upLo, t1); avgP(def.refs.upHi, t2);
      const yUp = norm3([t2[0] - t1[0], t2[1] - t1[1], t2[2] - t1[2]]);
      const zRt = norm3([yUp[1] * xAft[2] - yUp[2] * xAft[1], yUp[2] * xAft[0] - yUp[0] * xAft[2], yUp[0] * xAft[1] - yUp[1] * xAft[0]]);
      return [xAft, yUp, zRt];
    },
    bodyOrigin() { return avgP(def.refs.origin || def.refs.noseFrame, [0, 0, 0]); },
    wheelsOnGround() { return B ? B.f[S.WHEELS] : 0; },
    wheelContacts() { return view.wheels; },
    stats() { return { smax: B ? B.f[S.SMAX] : 0, bad: B ? !!(B.f[S.FLAGS] & S.F_DIVERGED) : false }; },

    // ---- the writes, as commands
    at(k) { stamp = k == null ? null : k; return view; },
    send(c) { cmd(c); return view; },
    setEngine(i, patch) {
      const c = { cmd: 'setEngine', i, patch: Object.assign({}, patch) };
      if (patch && patch.start && typeof view.starterOk === 'function') c.starterOk = !!view.starterOk(i);
      cmd(c);
    },
    impulse(i, ix, iy, iz) { cmd({ cmd: 'impulse', i, ix, iy, iz }); },
    hand(h) { cmd({ cmd: 'hand', ctl: h ? Object.assign({}, h, h.eng ? { eng: h.eng.slice() } : {}) : null }); },
    reset() { cmd({ cmd: 'reset' }); },
    stance() { return 0; },                // the host's placement takes the stance (sim_host.js place)
    step() { strays++; },
    // the frame's commands, in one message
    flush() {
      const e = JSON.stringify(ctl.eng);
      if (e !== engSent) { (ctlPatch = ctlPatch || {}).eng = ctl.eng ? ctl.eng.map(x => (x ? Object.assign({}, x) : x)) : null; engSent = e; }
      if (ctlPatch) { cmd({ cmd: 'ctl', set: ctlPatch }); ctlPatch = null; }
      if (!pending.length) return 0;
      const list = pending; pending = [];
      post({ cmd: 'batch', list });
      return list.length;
    },
    state() {
      const f = B && B.f;
      return f ? { seq: f[S.SEQ], step: f[S.STEP], t: f[S.T], stepMs: f[S.STEPMS], dilation: f[S.DIL], worldV: f[S.WV],
                   late: f[S.LATE], droppedS: f[S.DROPPED], allocs: f[S.ALLOCS], rate: f[S.RATE], epoch: f[S.EPOCH],
                   running: !!(f[S.FLAGS] & S.F_RUNNING), manual: !!(f[S.FLAGS] & S.F_MANUAL), started: !!(f[S.FLAGS] & S.F_STARTED),
                   diverged: !!(f[S.FLAGS] & S.F_DIVERGED), takes, strays, mismatch } : { takes, strays, mismatch };
    },
  };
  return view;
}

if (typeof window !== 'undefined') window.SIM_VIEW = { make: makeSimView, defSig: simViewDefSig };
if (typeof module !== 'undefined' && module.exports) module.exports = { makeSimView, simViewDefSig, SIM_VIEW_LEVERS };
