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
//             between the two snapshots that hold T - delay (frame(T), once
//             a rendered frame; G1100: a ring of the newest five, T on the
//             host's schedule - SIM_SNAP.DUE - and a delay that follows the
//             snapshots' lateness, 1-4 steps; it was the two newest at
//             T - 1 step on their publishing moment, ARCH §2.2's latency,
//             the prototype's 11-23 ms pose age). cgPos / axes / bodyOrigin are the solver's own formulas
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
//   BUFFERS   each snapshot's ArrayBuffer goes back to the host when it
//             leaves the ring ({cmd:'release'}, transferred).
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

// G1850 (DMG-D4a): THE DAMAGE STATE THE PAGE HOLDS - what sim_host.js simDmgHop sends on change (a break, a cluster
// cut; a set at most every 0.1 s), applied here. The same object inline (app.js runs the same hop on its own sim):
//   v        bumps on every payload; vB only when the broken list / the pieces moved (the skin's event)
//   br       the broken members, in order; broken[bi] 1 for each
//   pc       each node's piece (0 = the core: the piece the body's refs are on), null while one piece
//   set      each member's permanent set (dmg_overlay.js setOf), 0 where none
//   vS       G2001 (DMG-SCUFF): bumps when the plastic work or the slide work moved (the scuff's event)
//   wB       each member's plastic work (J); sW / sD / sN / sG each node's slide work (J), its direction and the side it
//            was pushed from (unit, body frame: aft, up, right) and its share on soft ground - skin_scuff.js reads them
function simViewDmgState(n, nb) {
  return { v: 0, vB: 0, n, nb, br: [], broken: new Uint8Array(nb), pc: null, nPc: 1, set: new Float32Array(nb), sB: '0:0', sS: '0:0',
           vS: 0, wB: new Float32Array(nb), sW: new Float32Array(n), sD: new Float32Array(n * 3), sN: new Float32Array(n * 3), sG: new Float32Array(n) };
}
function simViewDmgApply(D, P) {
  if (!P) return D;
  if (P.br) {
    D.br = P.br.slice(); D.broken.fill(0);
    for (const bi of D.br) if (bi >= 0 && bi < D.nb) D.broken[bi] = 1;
    D.pc = P.pc ? Int32Array.from(P.pc) : null;
    let k = 0; if (D.pc) for (let i = 0; i < D.pc.length; i++) if (D.pc[i] > k) k = D.pc[i];
    D.nPc = k + 1; D.vB++; D.sB = P.sB;
  }
  if (P.st) { D.set.fill(0); for (let j = 0; j + 1 < P.st.length; j += 2) if (P.st[j] < D.nb) D.set[P.st[j]] = P.st[j + 1]; }
  if (P.sS) D.sS = P.sS;
  // G2001: the scuff's inputs, whole each time they come (a payload of the base's kind carries neither key)
  if (P.wb || P.sc || (P.st && D.vS)) {
    D.wB.fill(0); D.sW.fill(0); D.sD.fill(0); D.sN.fill(0); D.sG.fill(0);
    if (P.wb) for (let j = 0; j + 1 < P.wb.length; j += 2) if (P.wb[j] < D.nb) D.wB[P.wb[j]] = P.wb[j + 1];
    if (P.sc) for (let j = 0; j + 8 < P.sc.length; j += 9) { const i = P.sc[j]; if (!(i < D.n)) continue;
      D.sW[i] = P.sc[j + 1]; for (let k = 0; k < 3; k++) { D.sD[i*3+k] = P.sc[j + 2 + k]; D.sN[i*3+k] = P.sc[j + 5 + k]; } D.sG[i] = P.sc[j + 8]; }
    D.vS++;
  }
  D.v++;
  return D;
}

function makeSimView(def, opts) {
  const R = opts.ready, S = R.slots, n = def.nodes.length, N3 = n * 3;
  const post = opts.post || (() => false);
  const now = opts.now || (() => performance.timeOrigin + performance.now());
  // G1100 (POSE-SMOOTH): THE RING AND ITS DELAY. The page drew T - 1 step between the TWO newest snapshots, T mapped to
  // sim time through the moment the newest was PUBLISHED. On the box (tools/eye_judder.js, the Cub at 60 fps) the drawn
  // aeroplane moved 28-56 mm a frame on frames of an even 16.7 ms parked, 160-523 mm in the climb (0.08-0.34 mm inline):
  // the publishing moment carries the step's cost and the timer's lateness, and a successor that had not come by the
  // frame froze the pose on the newest (then the next frame jumped). Now: the moment is the one the state was DUE on the
  // host's clock (SIM_SNAP.DUE), the page's T the frame's own timestamp (sim_link.js), the view keeps the RING newest
  // snapshots of the flight and draws the pair that holds T - delay; the delay (unless opts.delayS fixes it) follows the
  // windowed worst lateness of the newest snapshot (how far past its moment the frame came, a second of frames) and a
  // margin, between 1 and 4 steps, moved at most a tenth of the frame's time up and a fiftieth down - the drawn clock
  // never jumps, it runs a little slow or fast while the delay settles.
  const RING = opts.ring || 5, fixedDelay = opts.delayS != null;
  // G1166b (A5-CAP, the cockpit eye's spikes): A STARVED FRAME EXTRAPOLATES. A frame whose moment is past the newest
  // snapshot (its successor late) drew the newest - a jump ahead of the smooth path, and the next frame fell back: the
  // eye's horizontal judder read 165-245 mm at the taxi on those frames (rollout_perf --judder, master too, whenever the
  // delay dipped). Now it carries the two newest snapshots' motion on for the time missing, a step at most: the pose
  // where the aeroplane is going, not where it last was. opts.starveEx false (?starvex=0) is the old jump.
  const STARVE_EX = opts.starveEx !== false;
  // G1530 (POSE-BACK; the user at ~2 fps: "as soon as it took off ... it went a little backward over a frame"): THE DRAWN
  // CLOCK NEVER RUNS BACK. T maps to sim time through the newest snapshot's DUE, and that mapping JUMPS BACK whenever the
  // host lets wall time go: its clock held 250 ms past the page's last beat (G1365 - every frame of a 2 fps page) and
  // re-anchored on the next beat, or its catch-up cap dropping the excess. A starved frame meanwhile drew the newest + a
  // step (G1166b's bound); a frame coming soon after the re-anchor mapped to the new snapshot's time LESS the delay - up
  // to 3-4 steps behind what was drawn (GATE POSEBACK, 2 fps with a quick frame now and then: 1.21 m back at the
  // take-off). Now a LATER frame of the same flight draws no earlier sim time than the last one drew (MON): it holds there
  // until the mapping catches up. Still never more than a step past the newest snapshot (the bound above); a re-query of
  // an earlier T (a gate's probe) and frame(Infinity) are not frames of the clock. ?poseback=0 is the old mapping (an A/B)
  const MONO = opts.monotonic !== false;
  const MON = { T: -Infinity, t: -Infinity, ep: NaN, held: 0 };
  let delayS = fixedDelay ? opts.delayS : 1.5 * R.dt;
  const Q = [];                            // the ring, oldest first (B = its newest, A = the one before)
  const DS = { frames: 0, starved: 0, early: 0, lagMax: 0, lags: new Float64Array(60), li: 0, lastT: 0 };
  const dueOf = f => (f[S.DUE] > 0 ? f[S.DUE] : f[S.WALL]);
  function adapt(lag, T, running) {
    const dt = DS.lastT && T > DS.lastT ? Math.min(0.1, (T - DS.lastT) / 1000) : 0;
    DS.lastT = T;
    if (!running || !(lag < 0.25)) return;  // a pause, a stall: not the transport's lateness
    DS.lags[DS.li] = lag; DS.li = (DS.li + 1) % DS.lags.length;
    let mx = 0; for (let i = 0; i < DS.lags.length; i++) if (DS.lags[i] > mx) mx = DS.lags[i];
    DS.lagMax = mx;
    const want = Math.max(R.dt, Math.min(4 * R.dt, mx + 0.002));
    delayS += Math.max(-0.02 * dt, Math.min(0.1 * dt, want - delayS));
  }
  const mismatch = R.n !== n || (R.defSig && R.defSig !== simViewDefSig(def));
  const p = new Float64Array(N3), m = new Float64Array(n);
  for (let i = 0; i < n; i++) { const q = def.nodes[i].p; p[i * 3] = q[0]; p[i * 3 + 1] = q[1]; p[i * 3 + 2] = q[2]; m[i] = def.nodes[i].m; }
  const fuelIdx = R.fuelIdx || [];
  const oP = S.HEAD, oV = R.withV ? S.HEAD + N3 : -1, oM = S.HEAD + N3 * (R.withV ? 2 : 1);
  let A = null, B = null;                  // the ring's two newest snapshots: { f, buf }
  let stamp = null, pending = [], ctlPatch = null, engSent = 'null';
  let strays = 0, takes = 0, mCur = null;
  const cv = [0, 0, 0];
  const dmgS = simViewDmgState(n, def.beams.length);   // G1850

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
    dmgState: () => dmgS,                  // G1850: the damage state (broken, pieces, sets) - the host's, on change

    // ---- the frame: the pose at T less the delay, between the two snapshots that hold that moment (the ring)
    frame(T) {
      if (!B) return null;
      if (T == null) T = now();
      // G1365 (SIM-STALL): the page's heartbeat - a frame drawn on the real-time clock; the host's clock holds 250 ms past
      // the last one it heard (sim_host.js SIM_HOST_STALL_MS: a frozen page finds its aeroplane where it left it)
      if (T !== Infinity) post({ cmd: 'beat' });
      const fB = B.f, ep = fB[S.EPOCH];
      let X = B, Y = B, alpha = 1;
      // G1530: a frame after the last one, of the same flight - its drawn time no earlier than the last frame's
      const fwd = MONO && T !== Infinity && T > MON.T && MON.ep === ep;
      if (T !== Infinity && Q.length > 1) {
        // the sim time T maps to: B's, plus the wall time since B was DUE on the host's clock, at the host's rate - less
        // the delay (fixed, or the ring's own: adapt)
        const lag = (T - dueOf(fB)) / 1000 * (fB[S.RATE] || 1);
        if (!fixedDelay) adapt(lag, T, !!(fB[S.FLAGS] & S.F_RUNNING));
        let tau = fB[S.T] + lag - delayS;
        if (fwd && tau < MON.t) { tau = MON.t; MON.held++; }   // G1530: held where the last frame drew, not back
        if (tau < fB[S.T]) {
          let j = Q.length - 1;                   // the oldest of this flight's snapshots at or after tau
          while (j > 0 && Q[j - 1].f[S.EPOCH] === ep && Q[j - 1].f[S.T] >= tau) j--;
          if (j > 0 && Q[j - 1].f[S.EPOCH] === ep) { X = Q[j - 1]; Y = Q[j]; alpha = (tau - X.f[S.T]) / (Y.f[S.T] - X.f[S.T]); }
          else { X = Y = Q[j]; alpha = 0; DS.early++; }   // before the ring: its oldest
        } else if ((fB[S.FLAGS] & S.F_RUNNING) || (fwd && MON.t > fB[S.T])) {   // the snapshot for this moment has not come
          // (G1530: or a pause after a frame drawn past the newest - held there, not snapped back to it)
          if (fB[S.FLAGS] & S.F_RUNNING) DS.starved++; else tau = MON.t;
          // G1166b: on from the newest by the two newest's own motion (alpha past 1 extrapolates below), a step at most
          // (G1530: the newest of an EARLIER time - a pause's or a placement's snapshot repeats the newest state's)
          let P = null;
          for (let i = Q.length - 2; i >= 0 && !P; i--) if (Q[i].f[S.EPOCH] === ep && Q[i].f[S.T] < fB[S.T]) P = Q[i];
          if (STARVE_EX && P) {
            X = P; Y = B; alpha = 1 + Math.min(tau - fB[S.T], R.dt) / (fB[S.T] - P.f[S.T]);
          }
        }
      }
      const fX = X.f, fY = Y.f;
      if (X === Y) p.set(fY.subarray(oP, oP + N3));
      else for (let i = 0; i < N3; i++) p[i] = fX[oP + i] + (fY[oP + i] - fX[oP + i]) * alpha;
      for (let j = 0; j < 3; j++) cv[j] = X === Y ? fY[S.CGV + j] : fX[S.CGV + j] + (fY[S.CGV + j] - fX[S.CGV + j]) * alpha;
      if (view.v) view.v.set(fB.subarray(oV, oV + N3));
      massesOf(B);
      DS.frames++;
      // the pose's age: now, less the wall moment the host held the drawn state (between X's and Y's publishing)
      const wShown = X === Y ? fY[S.WALL] : fX[S.WALL] + (fY[S.WALL] - fX[S.WALL]) * alpha;
      // G1100: the drawn pose's own sim time (the sea is drawn at it: app.js WATER.setTime)
      const tShown = X === Y ? fY[S.T] : fX[S.T] + (fY[S.T] - fX[S.T]) * alpha;
      // G1530: the clock's memory - a frame's (forward, or the first of a flight), never a re-query's; frame(Infinity) is none
      if (T === Infinity) { MON.T = MON.t = -Infinity; MON.ep = NaN; }
      else if (fwd || MON.ep !== ep) { MON.T = T; MON.t = tShown; MON.ep = ep; }
      return { alpha, ageMs: T - wShown, t: tShown };
    },
    // G1100: the ring's reading - the delay (s), the frames drawn, those the newest snapshot had to stand for (starved:
    // its successor late) and those before the ring's oldest (early), the snapshots held
    // (G1530: monoHeld - the frames held at the last drawn time rather than drawn back)
    delay: () => ({ delayS, fixed: fixedDelay, frames: DS.frames, starved: DS.starved, early: DS.early, held: Q.length, lagMaxS: DS.lagMax, monoHeld: MON.held }),
    ring: () => Q.map(s => s.f),

    // ---- a message from the host; true when it was a snapshot
    take(msg) {
      if (!msg || msg.kind !== 'snap') return false;
      const s = { f: new Float64Array(msg.buf), buf: msg.buf };
      // G1100: THE RING - the newest RING snapshots of this flight (a new flight's first one lets the last flight's go)
      if (Q.length && Q[Q.length - 1].f[S.EPOCH] !== s.f[S.EPOCH]) { while (Q.length) release(Q.shift()); }
      Q.push(s);
      while (Q.length > RING) release(Q.shift());
      A = Q.length > 1 ? Q[Q.length - 2] : null; B = s; takes++;
      const M = msg.meta || {};
      if (M.ctl) view.snapCtl = M.ctl;       // G815: the host's ctl as published (sim_link.js mirrors it whole)
      if (M.out) { view.out = M.out; view.out.hydro = M.hydro || null; }
      if (M.eng) view.eng = M.eng;
      if ('dmg' in M) view.dmg = M.dmg;   // G1470: the crash's verdict (null until there is one)
      if (M.dmgB) simViewDmgApply(dmgS, M.dmgB);   // G1850: the broken list, on change
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

if (typeof window !== 'undefined') window.SIM_VIEW = { make: makeSimView, defSig: simViewDefSig, dmgState: simViewDmgState, dmgApply: simViewDmgApply };
if (typeof module !== 'undefined' && module.exports) module.exports = { makeSimView, simViewDefSig, SIM_VIEW_LEVERS, simViewDmgState, simViewDmgApply };
