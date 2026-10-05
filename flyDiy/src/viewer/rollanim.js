// ============================================================================
// rollanim.js — THE ROLL-OUT SHOT (B10, G1035-G1039)
//
// The user, 2026-09-28: "a roll out animation... have the plane roll out of the hangar and a camera
// movement, then cut and reinitialize on the aircraft in the world, like now" - and "the door is already
// open, so the aircraft just rolls out, and the camera tracks it". No door animation.
//
// WHAT IT IS. In the GARAGE scene only: the aeroplane rolls KINEMATICALLY (no solver) straight out of the
// open door (hangar.js: the door wall is at local -x, `doorAxis: -1`, the floor at the room group's y) along
// the floor, its wheels turning at distance / radius, its propeller at idle, a slight settle where the
// wheels cross the door's sill and a nod when it pulls up. The camera dollies from wherever the shed's
// orbit left it to THE STAND'S FIRST FRAME: the pose app.js flRevealStart() puts the eye in after the cut
// (az = the tail's direction + side x 0.45 for chase, + side x 1.0 for orbit, - PI/2 + side x 0.45 for
// wing; el 0.16; dist 1.7 x viewDist; aimed at the CG), so the cut reads as the same shot going on.
// 4-6 s; a click or a key skips it (onDone at once). It loads nothing, builds nothing and allocates next
// to nothing a frame (~16 bytes, GATE ROLLANIM G1037): the plan (the roll's length, the camera's path,
// checked against the shed's walls) is made once, at play().
// G1064 (POLISH-1, the user 2026-09-29: "a quick check of every surface followed by the rollout"): THE SHOT IS
// TWO PHASES. (1) THE CHECK, the aeroplane at rest where it stands, the camera held on the shed's view: each
// movable surface deflected and back in turn - ailerons (one way, the other, centre), elevator, rudder, then the
// flaps down and up - brisk (0.2 s still + 0.65 s a stick surface + 0.9 s the flaps + 0.25 s settled: 3.3 s with all
// four; S.check*), the prop spooling to idle meanwhile. The shot writes sim.ctl itself (over the shed's slow sweep, which the
// host writes earlier in the frame) and SNAPS the visual linkage onto it (model.link.snap) so the drawn surfaces
// follow the brisk profile exactly, not 0.3 s late at a third of the throw. Only the drives the model draws
// (model.moving / model.surfaces: a flapless build skips the flaps). (2) THE ROLL, as before, with the surfaces
// held NEUTRAL and still: the four drives written 0 every frame (the linkage already snapped to 0, so nothing is
// re-posed or re-uploaded while it rolls - GATE FRAMECOST). A skip in either phase goes to the end pose at once.
// G1715 (SND-ROLLOUT, the user 2026-10-05: "this one needs sound too, using the same methods as the real aircraft would"):
// THREE PHASES - (0) THE START before the check (S.start*, startPlan / engStep): every engine stopped at the first frame
// (setEngine key 'off'), the master and the key, a brief silence, then each engine in turn - the starter cranking the
// solver's own 1.5 s (setEngine start; burn's countdown) to the catch, a hand swing without a starter, an electric motor
// powered - and the check starts as the catch's flare settles. The SAME FIELDS a start in flight moves: sim.eng[i].key /
// crank / running, sim.out.rpm / rpmEng off the solver's shaft law (0 while it cranks), sim.ctl.thr - so audio_params and
// the voices hear a start, its catch and its idle exactly as in flight. The drawn prop turns at the rpm the engine's VOICE
// makes (the crank at crankRpm through each compression, the catch's surge, the settle), not at the solver's 0. Then the
// check at idle, and the roll with a little throttle to break away, back to idle as it rolls. Every field put back at the
// end (o.handover: the stand's idle left in sim.out - see engBack). o.audioPose: space.js's shotPose, written each frame.
//
//   ROLLANIM.play(opts) -> handle { cancel(), skip(), tick(dt), done, skipped, plan, phase, tCheck, tStart, thr }
//                     (phase 'start' | 'check' | 'roll' | 'done'; plan.check = { T, segs: [{ drive, t0, t1, amp }] },
//                     plan.start = { T, n, engines: [{ k, kind, method, tGo, tCatch, ... }] },
//                     plan.Ttotal = plan.start.T + plan.check.T + plan.T.T)
//     opts.start      false: no start (the engines left alone, as before G1715)
//     opts.handover   true: the world follows with its engines running (app.js's roll-out) - see engBack
//     opts.audioPose  a Float64Array(5) the space reads (AUDIO.space.shotPose): [on, dx, dy, dz, inside the shed]
//     opts.craft      the aeroplane's root Object3D (app.js `craft`); moved, then PUT BACK (identity)
//                     before onDone - the caller re-homes it in the world as it does today
//     opts.scene      the garage scene (hangarScene); only read
//     opts.camera     the PerspectiveCamera; left on the stand's first-frame pose (and fov) at the end
//     opts.renderer   optional: given, the shot runs its OWN requestAnimationFrame loop and renders
//                     scene + camera itself. Absent (the page), the HOST drives it: ROLLANIM.frame(dt)
//                     each frame before the model is posed, ROLLANIM.camera() after the host placed its
//                     camera (app.js's two marked lines in the frame loop)
//     opts.onDone     onDone(handle), called once: at the end (in a microtask after the last frame, so that frame still
//                     draws the end pose), or at once on a skip. Never after cancel()
//     opts.skip       true: no shot, onDone at once (synchronously)
//     opts.check      false: no control check (the roll alone); opts.ctl: the controls to drive (default sim.ctl)
//     opts.hangar     the room (app.js `hangar`): dims, the door (w, h), the floor y, the craft's print
//                     quad, the mobile kit and the day card (moved / hidden while they are in the way)
//     opts.model, opts.def, opts.sim   the app's model entry, sim def and sim: the wheels are
//                     model.wheelParts (obj, R) at their axle nodes' place (sim.p), the radius falling back
//                     to the node's own r; the props spin through the host's own pose (sim.out.rpm held at
//                     idle for the shot, put back after). No wheel anywhere (a floatplane) -> SKIPPED,
//                     cleanly: onDone at once, handle.skipped says why
//     opts.wheels     instead of model/def/sim: [{ obj?, R, x, z, y? }] (x, z: the axle in the craft frame)
//     opts.props      [{ obj, axis?, sense? }] spun by the shot itself (no host pose)
//     opts.propRpm    fn(rpm | null): the host spins them (null = put back)
//     opts.cg         [x, y, z] the point the stand's camera aims at (sim.cgPos()); default the box centre
//     opts.viewDist   def.params.viewDist (default max(9, 1.4 x span off the box))
//     opts.camMode    'chase' | 'orbit' | 'wing' (app.js cam.mode; cockpit / tower / free frame as chase)
//     opts.side       +1 | -1: which side of the tail the stand's eye stands (flRevealStart's `s`);
//                     default: the side the shed camera is already on (the shortest swing)
//     opts.fov        the flight's fov at the cut (cam.fov); default the camera's own
//   ROLLANIM.frame(dt) / ROLLANIM.camera()   the host's two hooks (no-ops when nothing plays)
//   ROLLANIM.busy()                          a shot is playing
//   ROLLANIM.cancel()                        the playing shot stopped and put back (no onDone)
//   ROLLANIM.standFraming(mode, viewDist, side) -> { az, el, dist }   (az off the tail's direction)
//   ROLLANIM.plan(opts)                      the plan alone, nothing moved (the gate reads it)
//   ROLLANIM.appRig(model, def, sim)         the wheels / props / cg / viewDist off the app's objects
// ============================================================================
const ROLLANIM = (() => {
  'use strict';
  // the shot's dials (live, like PROP_DISC.S)
  const S = {
    Tmin: 4.0, Tmax: 6.0,          // the whole shot, seconds
    hold0: 0.35, hold1: 0.30,      // still at the start (the prop spools) and at the end (the settle)
    ramp: 0.30,                    // the fraction of the roll spent speeding up, and again slowing down
    vCruise: 5.0,                  // m/s the roll aims at; a long roll (a big eye distance) goes faster
    clear: 1.5,                    // the tail this far past the door plane at the stop, metres
    idleRpm: 650,                  // the propeller at idle
    sillHeave: 0.018, sillPitch: 0.0045, sillHz: 1.7, sillTau: 0.28,   // the settle at the sill
    brakePitch: 0.0022,            // rad per m/s^2 of the roll's own acceleration (a nod as it stops)
    margin: 0.6,                   // the eye this far off a wall, metres (CAM_NEAR is 0.5)
    head: 0.35,                    // ...and under the door's head: it passes over the eye, not in front of it
    Lmax: 80,                      // the longest roll the plan considers, metres
    // G1064 THE CONTROL CHECK before the roll: a still lead-in, a segment per surface, a settle at neutral
    check: true, checkLead: 0.2, checkSeg: 0.65, checkFlap: 0.9, checkSettle: 0.25,
    checkAmp: 0.9,                 // the stick surfaces' throw (ctl units, +-), one way then the other
    checkFlapTo: 1.0,              // the flaps: down to this and back up
    // G1115 THE FIXED SHOT (o.follow false; the user, 2026-10-01: "the camera snaps to a fixed 3/4 view in the garage, the
    // aeroplane moves its surfaces, then rolls out with a slight acceleration; the camera does not track; fade onto the
    // exterior"): the roll until the tail is S.bOut m past the door plane, accelerating at S.bAcc all the way (no stop: the
    // host fades as it leaves), within S.bTmin..S.bTmax s; the snap's picture holds the whole aeroplane: inside S.bFit of the
    // frame's half-width and height, and under S.bTop (the garage's HUD bars cover the top of the picture)
    bOut: 0, bAcc: 1.2, bTmin: 3.0, bTmax: 5.5, bFit: 0.88, bTop: 0.5,
    bRays: 40, bHid: 40,           // the best candidates looked through for the room's kit in the way, and a hidden point's cost
    bNear: 0.6, bClut: 15,         // ...the foreground (this fraction of the way to the CG), and a cluttered ray's cost
    bLeave: 1.0, bLmin: 4,         // the front shot: the roll this far on once the aeroplane has left the picture, and at least
    bLat: 0.55,                    // the eye's bay: this fraction of the room's half-width either side of its centre line
    bKitMax: 12,                   // a piece of the room longer than this (m) on a side is its shell (floor, walls, roof), not kit
    // G1715 (SND-ROLLOUT) THE START before the check, the way the aeroplane starts in flight (30_solver.js setEngine + burn):
    // the shot opens with every engine stopped (key off), the master and the key at startKeyAt, a brief silence, then each
    // engine in turn: the starter cranks the solver's own crankS (setEngine's 1.5 s, counted down by burn's two lines) and
    // it catches; the next engine cranks catchNext s after a catch, the check starts catchCheck s after the last one (the
    // catch's flare peaks ~0.75 s in and is gone by 1.25 s: its tail under the check's still lead). A build without a starter
    // is SWUNG (setEngine swing: it catches at once, the cockpit's hand on the prop); an electric motor is POWERED (the
    // cockpit's pack key: swing) and spins up in spinS. No engine: no start
    start: true, startKeyAt: 0.2, startLead: 0.6, crankS: 1.5, catchNext: 1.0, catchCheck: 0.8, spinS: 0.6,
    // THE ROLL'S THROTTLE: a little to break away (rollThr: ~+350 rpm on the A-65), up over thrUp s from the roll's start,
    // held to thrHold of the roll, back to idle by thrDown of it (the solver's ctl.thr; the shaft law answers)
    rollThr: 0.14, thrUp: 0.3, thrHold: 0.35, thrDown: 0.85,
    // ...in thrStep steps, the linkage snapped on each: a control that moves re-poses and re-uploads the aeroplane every frame
    // (poseModel: any link key past 1e-4 - ctl.thr rides the linkage, the lever and the crew's hand), so the lever moves
    // ~14 times in the roll, not ~170 (a 2 % step of the lever is not seen; the voice smooths it: tau 30 ms on the load)
    thrStep: 0.02,
    doorBlend: 4,                  // m: the engines' "inside the shed" share (audioPose[4]) goes 1 -> 0 across the door plane
  };
  // G1715: the engine state's stride (per engine, a typed row: see engStep) and the patches the shot hands setEngine
  const ESW = 10;
  const P_OFF = { key: 'off' }, P_KEY = { key: 'both' }, P_START = { key: 'both', start: true }, P_SWING = { key: 'both', swing: true };
  // the check's order (the user's list) and the ctl keys it drives
  const CHECK_ORDER = ['da', 'de', 'dr', 'flap'];
  const TWO_PI = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = u => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };   // smootherstep
  const wrap = a => { while (a > Math.PI) a -= TWO_PI; while (a < -Math.PI) a += TWO_PI; return a; };

  // THE STAND'S FIRST FRAME, as flRevealStart writes it (app.js): az off the tail's direction
  function standFraming(mode, D, side) {
    const s = side < 0 ? -1 : 1, d = D > 0 ? D : 12;
    const az = mode === 'orbit' ? s * 1.0 : mode === 'wing' ? -Math.PI / 2 + s * 0.45 : s * 0.45;
    return { az, el: 0.16, dist: d * 1.7, side: s };
  }

  // THE APP'S OBJECTS -> a rig. The wheels are the drawn ones (model.wheelParts, their own R, the one
  // poseModel spins them by) at the axle nodes the sim stood them on; a wheel without a drawn part still
  // rolls (its node's r). The props are left to the host's pose: sim.out.rpm is what poseModel spins
  // them by (G442.1), so the shot holds it at idle and puts the old values back.
  function appRig(model, def, sim) {
    const rig = { wheels: [], propRpm: null, cg: null, viewDist: null };
    const nodes = def && def.nodes, P = sim && sim.p;
    if (def && def.params && def.params.viewDist > 0) rig.viewDist = def.params.viewDist;
    try { if (sim && sim.cgPos) { const c = sim.cgPos(); rig.cg = [c[0], c[1], c[2]]; } } catch (e) {}
    const seen = new Set();
    if (model && model.wheelParts) for (const w of model.wheelParts) {
      if (w.idx == null || !P) continue;
      const r = w.R > 0 ? w.R : (nodes && nodes[w.idx] && nodes[w.idx].r) || 0;
      if (!(r > 0)) continue;
      seen.add(w.idx);
      rig.wheels.push({ obj: w.obj || null, R: r, x: P[w.idx * 3], y: P[w.idx * 3 + 1], z: P[w.idx * 3 + 2] });
    }
    if (nodes && P) for (let i = 0; i < nodes.length; i++)
      if (nodes[i] && nodes[i].r > 0 && !seen.has(i))
        rig.wheels.push({ obj: null, R: nodes[i].r, x: P[i * 3], y: P[i * 3 + 1], z: P[i * 3 + 2] });
    const out = sim && sim.out;
    // G1715: the drawn props by engine, for the start's own rpm (engVis: each prop's spinRate - what poseModel spins it by -
    // set to the rpm the engine's VOICE turns at, from a typed row: no double handed to a call)
    if (model && model.props && model.props.length) {
      const uds = [], ei = [];
      for (const p of model.props) { const ud = p.userData || (p.userData = {}); uds.push(ud); ei.push(ud.engIdx || 0); }
      const E = Int32Array.from(ei), K = 2 * Math.PI / 60;
      rig.engVis = (ES, n) => { for (let i = 0; i < uds.length; i++) { const e = E[i]; if (e < n) uds[i].spinRate = ES[e * ESW + 8] * K; } };
    }
    if (out && model && model.props && model.props.length) {
      const eng = [];                                  // (an array: a Set's iterator is an allocation a frame)
      for (const p of model.props) { const e = (p.userData && p.userData.engIdx) || 0; if (eng.indexOf(e) < 0) eng.push(e); }
      let saved = null;
      rig.propRpm = rpm => {
        if (!out.rpm) out.rpm = [];
        if (rpm == null) {
          if (saved) { out.rpm.length = 0; for (let i = 0; i < saved.length; i++) out.rpm[i] = saved[i]; saved = null; }
          return;
        }
        if (!saved) saved = Array.prototype.slice.call(out.rpm);
        for (let k = 0; k < eng.length; k++) out.rpm[eng[k]] = rpm;
      };
    }
    return rig;
  }

  // THE ROOM, as the shot needs it: the door plane, the opening, the walls (in the scene's frame)
  function roomOf(h) {
    if (!h || !h.dims) return null;
    const d = h.dims, gp = h.group && h.group.position ? h.group.position : { x: 0, y: 0, z: 0 };
    const door = h.door || {};
    const HW = d.HW, HD = d.HD, EAVE = d.EAVE;
    return {
      x0: gp.x + (h.doorAxis || -1) * HD,          // the door plane
      x1: gp.x - (h.doorAxis || -1) * HD,          // the back wall
      zc: gp.z, HW, EAVE, floorY: gp.y + (h.floorY || 0),
      doorW: door.w > 0 ? door.w : Math.max(6, 2 * HW - 5),
      doorH: door.h > 0 ? door.h : Math.min(6.4, EAVE - 1.4),
      axis: h.doorAxis || -1,
    };
  }

  // the aeroplane's box off what is DRAWN: a hidden truss, proxy or cage part reached 1.2 m under the floor
  // (Chromium, the Cub) and would have measured the roll from nothing on screen
  function drawnBoxes(root, out) {
    root.updateMatrixWorld(true);
    const walk = o => {
      if (!o.visible) return;
      const g = o.geometry;
      if ((o.isMesh || o.isLine || o.isPoints) && g && g.attributes && g.attributes.position) {
        if (!g.boundingBox) g.computeBoundingBox();
        const b = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
        if (isFinite(b.min.x)) out.push(b);
      }
      for (const k of o.children) walk(k);
    };
    walk(root);
    return out;
  }
  function visibleBox(root) {
    const box = new THREE.Box3();
    for (const b of drawnBoxes(root, [])) box.union(b);
    return box;
  }
  // ---- G1064 THE CONTROL CHECK'S PLAN ------------------------------------------------------------------
  // the ctl drives the model DRAWS (a generated build's model.moving, an imported one's model.surfaces: drive and
  // drive2 - a V-tail's ruddervators answer de and dr, a flying wing's elevons da and de); null: unknown, all four
  function drivesOf(model) {
    if (!model) return null;
    const out = [];
    const add = c => { if (!c) return; for (const k of [c.drive, c.drive2]) if (k && CHECK_ORDER.indexOf(k) >= 0 && out.indexOf(k) < 0) out.push(k); };
    if (Array.isArray(model.moving)) for (const mv of model.moving) add(mv && mv.c);
    if (Array.isArray(model.surfaces)) for (const sf of model.surfaces) add(sf);
    return (Array.isArray(model.moving) && model.moving.length) || (Array.isArray(model.surfaces) && model.surfaces.length) ? out : null;
  }
  function checkPlan(o) {
    const ctl = o.ctl || (o.sim && o.sim.ctl) || null;
    if (!ctl || o.check === false || !S.check) return { T: 0, segs: [], drives: [], ctl: null };
    const have = drivesOf(o.model), segs = [];
    let t = S.checkLead;
    for (const k of CHECK_ORDER) {
      if (have && have.indexOf(k) < 0) continue;
      const d = k === 'flap' ? S.checkFlap : S.checkSeg;
      segs.push({ drive: k, code: CHECK_ORDER.indexOf(k), t0: t, t1: t + d, amp: k === 'flap' ? S.checkFlapTo : S.checkAmp });
      t += d;
    }
    return { T: segs.length ? t + S.checkSettle : 0, segs, drives: segs.map(g => g.drive), ctl };
  }
  // ---- G1715 THE START'S PLAN ---------------------------------------------------------------------------------
  // What the solver flies (def.params.engine || POWERPLANTS[powerplant].engine and .prop, 30_solver.js's own lookup) and how
  // each engine starts: 'starter' (the key's start: setEngine start, the solver's crank), 'swing' (no starter fitted -
  // genSystemsResolve(spec).starter false - the hand on the prop) or 'power' (an electric motor: the pack key, swing).
  // The SHAFT LAW at rest (00_registry.js genShaftRpm at V = 0, sea level): n^2 is linear in the throttle (n = nS sqrt(t),
  // t = idle + (1 - idle) thr), so two calls at play - idle and full - give it exactly for every frame (n^2 = nIdle^2 +
  // (nFull^2 - nIdle^2) thr) with no call a frame; a constant-speed row (a turboprop) answers nR at both. The VOICE'S
  // numbers (crankRpm, idleRpm, firingPerRev) are engine_config.js's (ENGINE_SOUND, in the bundle with or without
  // ?audio=0): the drawn prop turns at the rpm the voice makes (engStep), not at the solver's 0 while it cranks.
  function startPlan(o) {
    const none = { T: 0, n: 0, engines: [], why: '' };
    const sim = o.sim, def = o.def;
    if (o.start === false || !S.start) return Object.assign(none, { why: 'off' });
    if (!sim || !def || !def.params || !Array.isArray(sim.eng) || !sim.eng.length || !sim.out) return Object.assign(none, { why: 'no sim engines' });
    if (typeof genShaftRpm !== 'function') return Object.assign(none, { why: 'no shaft law' });
    const P_ = def.params, reg = typeof POWERPLANTS !== 'undefined' ? POWERPLANTS : {}, PP = reg[P_.powerplant] || {};
    const EN = P_.engine || PP.engine, PR = P_.prop || PP.prop;
    if (!EN || !(EN.rpm > 0) || !PR || P_.nEngines === 0) return Object.assign(none, { why: 'no engine' });
    const n = Math.min(4, sim.eng.length, P_.nEngines || sim.eng.length);
    const fam = EN.family || 'four', kind = fam === 'electric' ? 2 : fam === 'turbine' ? 1 : 0;
    let starter = true;
    try { if (typeof genSystemsResolve === 'function' && def.spec) { const f = genSystemsResolve(def.spec); if (f && f.starter === false) starter = false; } } catch (e) {}
    const method = kind === 2 ? 'power' : (starter || kind === 1) ? 'starter' : 'swing';
    const gear = EN.gear > 0 ? EN.gear : 1;
    const nIdle = genShaftRpm(EN, PR, 0, 0, 1, 1, true), nFull = genShaftRpm(EN, PR, 1, 0, 1, 1, true);
    const ESN = (typeof window !== 'undefined' && window.ENGINE_SOUND) || (typeof ENGINE_SOUND !== 'undefined' ? ENGINE_SOUND : null);
    const engines = [];
    let t = S.startLead;
    for (let k = 0; k < n; k++) {
      let cfg = null;
      try { cfg = ESN && def.spec ? ESN.engineSoundConfig(def.spec, k, reg) : null; } catch (e) { cfg = null; }
      const pist = !!(cfg && cfg.piston);
      const crank = method === 'starter' ? S.crankS : 0;
      const last = k === n - 1;
      engines.push({ k, kind: ['piston', 'turbine', 'electric'][kind], method, tGo: t, tCatch: t + crank,
        crankRpm: pist && cfg.crankRpm > 0 ? cfg.crankRpm : 250, idleEng: pist && cfg.idleRpm > 0 ? cfg.idleRpm : nIdle * gear,
        cpr: pist && cfg.firingPerRev > 0 ? cfg.firingPerRev : 2, gear, nIdle, nFull });
      t += crank + (kind === 2 ? S.spinS : last ? S.catchCheck : S.catchNext);
    }
    return { T: t, n, engines, EN, PR, kind, method, gear, nIdle, nFull, starter, why: '' };
  }
  // ---- THE PLAN (once, at play) -----------------------------------------------------------------------
  // The roll's length L is the SHORTEST that leaves the whole aeroplane S.clear past the door plane AND puts
  // the stand's eye somewhere legal - in the room clear of its walls, in the door's opening, or outside -
  // with the aeroplane in sight (no wall between) all the way. The eye's path is the framing (az, el, dist
  // round the moving CG) eased from the shed camera's to the stand's, straight or through a waypoint (see
  // the candidates below), on the start's own side or the other when the side was not asked for; the
  // cheapest legal candidate wins, and a plan with a wall left in it (none met in the club or works sheds;
  // the field shed's 3.1 m door can leave some) is clamped per frame. ~1.5 ms warm, ~25 ms cold (node).
  function makePlan(o) {
    const craft = o.craft, cam = o.camera;
    if (!craft || !cam) return { skip: 'no craft or camera' };
    const rig = (o.wheels || o.props || o.propRpm) ? { wheels: o.wheels || [], props: o.props || null, propRpm: o.propRpm || null }
      : appRig(o.model, o.def, o.sim);
    const wheels = rig.wheels || [];
    if (!wheels.length) return { skip: 'no wheels to roll on (floats)' };
    const room = roomOf(o.hangar);
    craft.updateMatrixWorld(true);
    const box = visibleBox(craft);
    if (!isFinite(box.min.x) || !isFinite(box.max.x)) return { skip: 'the aeroplane has no extent' };
    const ax = room ? room.axis : -1;                    // the roll's direction along x (-1: toward -x)
    const cg = o.cg || rig.cg || [(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2];
    const span = box.max.z - box.min.z;
    const D = o.viewDist || rig.viewDist || Math.max(9, 1.4 * span);
    // the door plane: the room's, or (no room) just ahead of the nose
    const xDoor = room ? room.x0 : (ax < 0 ? box.min.x - 0.5 : box.max.x + 0.5);
    const trail = ax < 0 ? box.max.x : box.min.x;        // the last of the aeroplane through the door
    const Lmin = Math.max(1, (trail - xDoor) * -ax + S.clear);
    // the tail's direction in the garage frame is -ax along x (the nose points at the door): hdg
    const hdg = ax < 0 ? 0 : Math.PI;
    // the start: the eye's framing round the CG. An eye INSIDE the aeroplane or on top of it (a fresh
    // profile's chooser leaves the camera at the origin, seen in Chromium) starts instead from the shed's
    // boot framing (app.js garageCamera: az -2.5, el 0.22, 14 m), pulled in until it stands legal - a cut at
    // the first frame, from a pose that was not a picture anyway
    const p0 = cam.position;
    let dx0 = p0.x - cg[0], dy0 = p0.y - cg[1], dz0 = p0.z - cg[2];
    let d0 = Math.hypot(dx0, dy0, dz0), az0, el0, look0, fresh = false;
    if (d0 < 2.5 || box.containsPoint(p0)) {
      fresh = true;
      az0 = hdg - 2.5 * -ax; el0 = 0.22; d0 = 14;
      while (d0 > 3 && room && !eyeOk(room, cg[0] + d0 * Math.cos(el0) * Math.cos(az0), cg[1] + d0 * Math.sin(el0), cg[2] + d0 * Math.cos(el0) * Math.sin(az0))) d0 *= 0.9;
      look0 = [cg[0], cg[1], cg[2]];
    } else {
      az0 = Math.atan2(dz0, dx0); el0 = Math.asin(clamp(dy0 / d0, -1, 1));
      const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
      look0 = [p0.x + dir.x * d0, p0.y + dir.y * d0, p0.z + dir.z * d0];
    }
    const mode = o.camMode === 'orbit' || o.camMode === 'wing' ? o.camMode : 'chase';
    const sides = o.side ? [o.side < 0 ? -1 : 1] : (() => { const s = Math.sin(az0 - hdg) < 0 ? -1 : 1; return [s, -s]; })();
    const fov0 = cam.fov, fov1 = o.fov > 0 ? o.fov : cam.fov;
    const cands = [];
    // THE CANDIDATE PATHS: the framing eased straight from the shed's to the stand's (the swing held back
    // by 0, 0.35 or 0.6 of the shot, el with it or not), then - for a start the straight ease cannot get out
    // of the door from (behind the aeroplane, against a flank, under the roof) - through a WAYPOINT: a low
    // chase framing close behind the tail that follows the aeroplane out through the opening, reached at
    // 35 or 50 % of the shot, then eased back to the stand's frame
    const Dw = [Math.min(0.62 * D, 8), 6];
    let bestCost = Infinity;
    for (const side of sides) {
      const F = standFraming(mode, D, side);
      const az1 = az0 + wrap(hdg + F.az - az0);           // the short way round
      const waz = az0 + wrap(hdg + side * 0.45 - az0);
      const kinds = LAGS.map(l => ({ lag: l[0], lagE: l[1], wtw: 0, waz: 0, wel: 0, wd: 0, az1 }));
      for (const tw of [0.35, 0.5]) for (const dw of Dw)
        kinds.push({ lag: 0, lagE: 0, wtw: tw, waz, wel: 0.12, wd: dw, az1: waz + wrap(hdg + F.az - waz) });
      for (const k of kinds) {
        // the roll's cost: its length, +3 m off the start's own side, +1 m through a waypoint - a legal
        // candidate only has to beat the best so far, so the search stops there
        const extra = (side === sides[0] ? 0 : 3) + (k.wtw > 0 ? 1 : 0);
        let best = null;
        for (let L = Lmin; L <= S.Lmax + 1e-9 && L + extra < bestCost; L += 1) {
          const c = { side, lag: k.lag, lagE: k.lagE, L, az0, el0, d0, az1: k.az1, el1: F.el, d1: F.dist,
                      wtw: k.wtw, waz: k.waz, wel: k.wel, wd: k.wd, T: timing(L), bad: 0, cost: L + extra };
          c.bad = judge(c, room, cg, ax);
          if (!best || c.bad < best.bad) best = c;
          if (c.bad === 0) { bestCost = c.cost; break; }
        }
        if (best) cands.push(best);
      }
    }
    // the fewest violations, then the cheapest roll
    cands.sort((a, b) => a.bad - b.bad || a.cost - b.cost);
    const c = cands[0];
    // the wheel groups: the sill events (the main pair's heave, the third wheel's pitch)
    const xs = wheels.map(w => w.x), xMid = xs.reduce((a, b) => a + b, 0) / xs.length;
    let xMainSum = 0, nMain = 0, xThird = null;
    for (const w of wheels) if (Math.abs(w.z - cg[2]) > 0.2) { xMainSum += w.x; nMain++; }
    const xMain = nMain ? xMainSum / nMain : xMid;
    for (const w of wheels) if (Math.abs(w.z - cg[2]) <= 0.2) { xThird = w.x; break; }
    const floorY = room ? room.floorY : box.min.y;
    const check = checkPlan(o), start = startPlan(o);
    // G1715: where the engines stand along the roll (the mean of the solver's engine nodes, else the nose): the
    // audioPose's "inside the shed" share is theirs
    let xEng = ax < 0 ? box.min.x : box.max.x;
    { const R = o.def && o.def.refs, Pp = o.sim && o.sim.p;
      if (R && Array.isArray(R.engine) && R.engine.length && Pp) { let sx = 0, nx = 0; for (const j of R.engine) if (j >= 0) { sx += Pp[j * 3]; nx++; } if (nx) xEng = sx / nx; } }
    // G1115 THE FIXED SHOT (o.follow false): THE EYE STAYS IN THE SHED. A three-quarter view from behind and beside the tail,
    // taken at once (the snap) and held: the aeroplane checks its surfaces, then rolls away from it out through the door and
    // S.bOut m on - not followed, so the room is the picture and the door a bright opening at its end
    let fixed = null;
    if (o.follow === false) {
      // the candidates: round the tail's side at three swings, three heights, five distances, the aim between the CG and
      // the door; scored legal in the room first, then the whole aeroplane in the picture (the drawn box's corners inside
      // S.bFit of the frame, with the host camera's aspect), then the host's own fov (a wider lens, up to +24 deg, only for
      // an aeroplane the room cannot frame whole: a big twin in the club shed), then the start's own side, then the nearest
      const sd = sides[0], pc = cam.clone(), V = new THREE.Vector3();
      const all = [];
      // G1115.1 THE GARAGE'S OWN FRAMING (o.front { az, el, dist }: the orbit the garage opens on - the user: "it should be
      // the default 3/4 camera, so looking at the plane 3/4 FRONT and not back"): that eye round the CG, held; tried as it
      // is, then farther (x1.15, x1.3) or nearer (x0.9) and with a lens up to +16 deg only if the aeroplane will not stand
      // whole in it or the roll would sweep through the eye. Without o.front: the search round the tail (G1115)
      const gens = [];
      if (o.front) { for (const fv of [cam.fov, cam.fov + 8, cam.fov + 16]) for (const k of [1, 1.15, 1.3, 0.9])
        gens.push({ fv, look: [cg[0], cg[1], cg[2]], az: o.front.az, el: o.front.el, d: o.front.dist * k, s2: sd, pen: Math.abs(k - 1) * 20, front: true }); }
      else for (const fv of [cam.fov, cam.fov + 8, cam.fov + 16, cam.fov + 24]) for (const lk of [0.3, 0.45]) {
        const look = [cg[0] + (xDoor - cg[0]) * lk, cg[1] + 0.3, cg[2]];
        for (const sw of [0.3, 0.42, 0.55, 0.7]) for (const el of [0.12, 0.2, 0.3, 0.4]) for (const dk of [0.7, 0.85, 1.0, 1.2, 1.45]) for (const s2 of [sd, -sd])
          gens.push({ fv, look, az: hdg + s2 * sw, el, d: dk * D, s2, pen: el * 10, front: false });
      }
      // (the roll's swept box: the aeroplane's at every distance up to the door's need, 0.6 m off - the eye outside it)
      const sweep = box.clone().expandByScalar(0.6), Lfull = Math.max(1, (trail - xDoor) * -ax + S.bOut);
      if (ax < 0) sweep.min.x -= Lfull; else sweep.max.x += Lfull;
      {
        for (const G of gens) {
          const fv = G.fv, look = G.look, az = G.az, el = G.el, d = G.d, s2 = G.s2;
          pc.fov = fv;
          const p = { x: cg[0] + d * Math.cos(el) * Math.cos(az), y: cg[1] + d * Math.sin(el), z: cg[2] + d * Math.cos(el) * Math.sin(az) };
          legalize(room, p);
          const bad = room && !eyeOk(room, p.x, p.y, p.z) ? 1 : 0;
          const inBox = box.clone().expandByScalar(0.8).containsPoint(V.set(p.x, p.y, p.z)) ? 1 : 0;
          // THE BAY: the room keeps its kit, its racks and its columns along the walls (merged into batches the box test
          // below cannot tell from the shell) - the eye stays in the aeroplane's own bay, within S.bLat of the half-width
          const bay = !G.front && room && Math.abs(p.z - room.zc) > S.bLat * room.HW ? 1 : 0;
          const swept = sweep.containsPoint(V.set(p.x, p.y, p.z)) ? 1 : 0;
          pc.position.set(p.x, p.y, p.z); pc.up.set(0, 1, 0); pc.lookAt(look[0], look[1], look[2]); pc.updateMatrixWorld(true); pc.updateProjectionMatrix();
          let out = 0, fill = 0;
          for (let i = 0; i < 8; i++) {
            V.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(pc);
            const m = Math.max(Math.abs(V.x), Math.abs(V.y));
            if (!(Math.abs(V.x) <= S.bFit && V.y >= -S.bFit && V.y <= S.bTop && V.z < 1)) out++; else fill = Math.max(fill, m);
          }
          // (the front shot IS the garage's own picture: its fit is reported, and moves the eye only past two corners out)
          const outC = G.front ? Math.max(0, out - 2) * 200 : out * 200;
          const sc = bad * 1000 + inBox * 1000 + swept * 1000 + outC + bay * 150 + (fv - cam.fov) * (G.front ? 20 : 1.5) + (s2 === sd ? 0 : 5) + (G.front ? 0 : (1 - fill) * 10) + G.pen;
          all.push({ sc, out, bay, ok: !bad && !inBox && !swept, eye: [p.x, p.y, p.z], look, fov: fv, hid: 0, front: G.front });
        }
      }
      // THE ROOM'S KIT IN THE WAY (a stack of timber, a post, the bench between the eye and the aeroplane): the best
      // S.bRays candidates looked through - rays from the eye to the aeroplane's box (its centre and its corners drawn a
      // quarter in), each one a prop of the room hits first is a hidden point (S.bHid each); and THE KIT IN FRONT: rays
      // through a grid of the picture (5 x 4), each that meets the room's kit nearer than S.bNear of the way to the CG is
      // clutter in the foreground (S.bClut each: an eye backed into a corner of timber reads the aeroplane small)
      all.sort((a, b) => a.sc - b.sc);
      const sceneR = o.scene && o.scene.children ? o.scene : null;
      if (sceneR && THREE.Ray) {
        // THE KIT AS BOXES (a mesh's raycast against the whole room cost 4-5 s in node at the click): every drawn piece of
        // the room, the aeroplane's apart, as its world box - an instanced piece a box an instance (64 at most) - and a box
        // longer than S.bKitMax on a side is the room's own shell (the floor, a wall, a roof truss, a column), not kit
        // (a piece overlapping the aeroplane's own box is the aeroplane's - the editor's fittings and seats live outside the
        // craft's node - or under it, and play() hides what the roll would sweep through)
        const kit = [], bb = new THREE.Box3(), im = new THREE.Matrix4(), mw = new THREE.Matrix4(), own = box.clone().expandByScalar(0.2);
        const drawn = x => { for (let q = x; q; q = q.parent) { if (q === craft || q.visible === false) return false; } return true; };
        let nm = '';
        const keep = b => { if (!isFinite(b.min.x)) return; const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
          if (sx <= S.bKitMax && sy <= S.bKitMax && sz <= S.bKitMax && b.max.y > (room ? room.floorY : -1e9) + 0.15 && !b.intersectsBox(own)) { const k = b.clone(); k.nm = nm; kit.push(k); } };
        sceneR.updateMatrixWorld(true);
        sceneR.traverse(m => {
          if (!m.isMesh || !m.geometry || !drawn(m)) return;
          nm = ''; for (let q = m, j = 0; q && j < 3; q = q.parent, j++) if (q.name) { nm = q.name; break; }
          const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
          if (m.isInstancedMesh) { const n = Math.min(m.count, 64); for (let i = 0; i < n; i++) { m.getMatrixAt(i, im); mw.multiplyMatrices(m.matrixWorld, im); keep(bb.copy(g.boundingBox).applyMatrix4(mw)); } }
          else keep(bb.copy(g.boundingBox).applyMatrix4(m.matrixWorld));
        });
        const ray = new THREE.Ray(), hit = new THREE.Vector3(), ctr = new THREE.Vector3(), dir = new THREE.Vector3(), E = new THREE.Vector3(), pts = [];
        let by = null;                                   // (the blockers' names, for the chosen eye's report)
        const first = far => { for (const k of kit) { if (k.containsPoint(ray.origin)) continue; if (ray.intersectBox(k, hit) && hit.distanceTo(ray.origin) < far) { if (by) by[k.nm || '?'] = (by[k.nm || '?'] || 0) + 1; return true; } } return false; };
        box.getCenter(ctr); pts.push(ctr.clone());
        for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).lerp(ctr, 0.25));
        const N3 = new THREE.Vector3(), dCg = new THREE.Vector3();
        for (const cnd of all.slice(0, S.bRays)) {
          E.set(cnd.eye[0], cnd.eye[1], cnd.eye[2]);
          pc.fov = cnd.fov; pc.position.copy(E); pc.up.set(0, 1, 0); pc.lookAt(cnd.look[0], cnd.look[1], cnd.look[2]); pc.updateMatrixWorld(true); pc.updateProjectionMatrix();
          const near = S.bNear * dCg.set(cg[0], cg[1], cg[2]).distanceTo(E);
          cnd.clut = 0; cnd.hid = 0; by = cnd.by = {};
          for (const nx of [-0.8, -0.4, 0, 0.4, 0.8]) for (const ny of [-0.8, -0.4, 0, 0.35]) {
            N3.set(nx, ny, 0.5).unproject(pc).sub(E).normalize(); ray.set(E, N3);
            if (first(near)) cnd.clut++;
          }
          for (const q of pts) {
            dir.subVectors(q, E); const far = dir.length() - 0.3; dir.normalize(); ray.set(E, dir);
            if (far > 0 && first(far)) cnd.hid++;
          }
          cnd.sc += cnd.clut * S.bClut + cnd.hid * S.bHid;
        }
      }
      const best = all.slice(0, S.bRays).sort((a, b) => a.sc - b.sc)[0] || all[0];
      fixed = { eye: best.eye, look: best.look, out: best.out, fov: best.fov, hid: best.hid || 0, clut: best.clut || 0, by: best.by || {},
        bayFit: all.some(c => c.ok && !c.bay && c.out === 0), front: !!best.front, L: 0 };   // (bayFit: an eye in the bay that frames it whole exists)
      if (best.front) {
        // THE FRONT SHOT'S ROLL ENDS AS THE AEROPLANE LEAVES THE PICTURE (it rolls toward the door, past the eye): the
        // first distance at which every corner of its box is behind the eye or past the same edge of the frame, + S.bLeave
        pc.fov = best.fov; pc.position.set(best.eye[0], best.eye[1], best.eye[2]); pc.up.set(0, 1, 0); pc.lookAt(best.look[0], best.look[1], best.look[2]);
        pc.updateMatrixWorld(true); pc.updateProjectionMatrix();
        const C = new THREE.Vector3();
        let Lx = Lfull;
        for (let sx = 1; sx <= Lfull; sx += 0.25) {
          let side = 0, gone = true;
          for (let i = 0; i < 8 && gone; i++) {
            C.set((i & 1 ? box.max.x : box.min.x) + ax * sx, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
            const zc = C.clone().applyMatrix4(pc.matrixWorldInverse).z;
            if (zc > -pc.near) continue;                       // behind the eye
            C.project(pc);
            const sd2 = C.x < -1 ? -1 : C.x > 1 ? 1 : 0;
            if (!sd2 || (side && sd2 !== side)) gone = false; else side = sd2;
          }
          if (gone) { Lx = Math.min(Lfull, sx + S.bLeave); break; }
        }
        fixed.L = Math.max(S.bLmin, Lx);
      }
    }
    const Lb = fixed ? (fixed.L > 0 ? fixed.L : Math.max(1, (trail - xDoor) * -ax + S.bOut)) : c.L, Tb = fixed ? goTiming(Lb) : c.T;
    return {
      skip: null, rig, wheels, room, box, cg, D, mode, ax, xDoor, Lmin, check, start, xEng, Ttotal: start.T + check.T + Tb.T, fixed,
      L: Lb, T: Tb, side: c.side, lag: c.lag, lagE: c.lagE, bad: c.bad, cands: cands.length,
      az0, el0, d0, fresh, az1: c.az1, el1: c.el1, d1: c.d1, wtw: c.wtw, waz: c.waz, wel: c.wel, wd: c.wd, look0, fov0, fov1,
      pivot: [xMain, floorY], xThird,
      thirdSign: xThird != null && (xThird - xMain) * ax > 0 ? -1 : 1,
      // the roll distance at which each group reaches the sill (null: it never does)
      sMain: room ? (xMain - xDoor) * -ax : null,
      sThird: room && xThird != null ? (xThird - xDoor) * -ax : null,
      // the stand's pose relative to the CG at the end - for the host's continuity check
      end: { side: c.side, az: wrap(c.az1 - hdg), el: c.el1, dist: c.d1 },
    };
  }
  // the shot's length for a roll of L metres, and the profile's cruise speed
  function timing(L) {
    const Tr = clamp(L / S.vCruise / (1 - S.ramp), S.Tmin - S.hold0 - S.hold1, S.Tmax - S.hold0 - S.hold1);
    return { T: Tr + S.hold0 + S.hold1, Tr, ta: S.ramp * Tr, v: L / (Tr * (1 - S.ramp)) };
  }
  // G1115 the fixed shot's: the start's hold, then a steady acceleration (S.bAcc, within S.bTmin..S.bTmax) to the end - no
  // ramp down, no end hold: the host fades while it still rolls
  function goTiming(L) {
    const Tr = clamp(Math.sqrt(2 * L / S.bAcc), S.bTmin, S.bTmax);
    return { T: S.hold0 + Tr, Tr, ta: Tr, v: 2 * L / Tr, go: true };
  }
  // the distance rolled at time t (the hold, the cosine ramp up, the cruise, the ramp down, the hold)
  function rollS(tm, L, t) {
    const tau = t - S.hold0, Tr = tm.Tr, ta = tm.ta, v = tm.v;
    if (tau <= 0) return 0;
    if (tau >= Tr) return L;
    if (tm.go) return L * (tau / Tr) * (tau / Tr);
    if (tau < ta) return rampS(v, ta, tau);
    if (tau <= Tr - ta) return v * ta / 2 + v * (tau - ta);
    return L - rampS(v, ta, Tr - tau);
  }
  // the distance covered x seconds into a cosine ramp up to v over ta (the plan's; advance() writes it out)
  function rampS(v, ta, x) { return v * (x / 2 - (ta / TWO_PI) * Math.sin(Math.PI * x / ta)); }

  // the straight paths' lags [az, el]: the swing may wait a part of the shot (the eye leaves by the door
  // first, then swings round); el may come down with the dolly (a tall aeroplane's eye under the door's
  // head) or wait with the swing
  const LAGS = [[0, 0], [0.35, 0], [0.35, 0.35], [0.6, 0], [0.6, 0.6]];

  // THE FRAMING at the time TT[0] (a typed array: this runs in the frame, and a double handed to a call
  // that is not inlined is boxed - G1037): az, el, dist round the CG into out[0..2]. Dist leads (a dolly
  // scales: its log is eased), az and el may wait their lag; with a waypoint (wtw > 0) the framing goes
  // shed -> waypoint over [0, wtw] and waypoint -> stand over [wtw, 1], each leg eased whole
  function framingInto(c, TT, out) {
    const u = TT[0] / c.T.T;
    let a0 = c.az0, e0 = c.el0, d0 = c.d0, a1 = c.az1, e1 = c.el1, d1 = c.d1, v = u, lag = c.lag, lagE = c.lagE;
    if (c.wtw > 0) {
      lag = 0; lagE = 0;
      if (u < c.wtw) { a1 = c.waz; e1 = c.wel; d1 = c.wd; v = u / c.wtw; }
      else { a0 = c.waz; e0 = c.wel; d0 = c.wd; v = (u - c.wtw) / (1 - c.wtw); }
    }
    let xa = lag > 0 ? (v - lag) / (1 - lag) : v, xe = lagE > 0 ? (v - lagE) / (1 - lagE) : v, xd = v;
    xa = xa < 0 ? 0 : xa > 1 ? 1 : xa; xe = xe < 0 ? 0 : xe > 1 ? 1 : xe; xd = xd < 0 ? 0 : xd > 1 ? 1 : xd;
    out[0] = a0 + (a1 - a0) * (xa * xa * xa * (xa * (xa * 6 - 15) + 10));
    out[1] = e0 + (e1 - e0) * (xe * xe * xe * (xe * (xe * 6 - 15) + 10));
    out[2] = d0 * Math.pow(d1 / d0, xd * xd * xd * (xd * (xd * 6 - 15) + 10));
  }
  const JT = new Float64Array(1), JF = new Float64Array(3);
  // the eye at time t (into out[0..3]: x, y, z and the CG's x at its roll) - the plan's, not the frame's
  function eyeAt(c, cg, ax, t, out) {
    const s = rollS(c.T, c.L, t);
    JT[0] = t; framingInto(c, JT, JF);
    const az = JF[0], el = JF[1], d = JF[2], cx = cg[0] + ax * s;
    out[0] = cx + d * Math.cos(el) * Math.cos(az);
    out[1] = cg[1] + d * Math.sin(el);
    out[2] = cg[2] + d * Math.cos(el) * Math.sin(az);
    out[3] = cx;
    return out;
  }
  // WHERE AN EYE MAY STAND: in the room clear of its walls, in the door's opening, or outside (the door's side)
  function eyeOk(room, x, y, z) {
    if (!room) return y > -1e9;
    const m = S.margin, ax = room.axis, zr = Math.abs(z - room.zc);
    const u = (x - room.x0) * -ax;                      // metres INTO the shed from the door plane
    if (y < room.floorY + 0.3) return false;
    if (u < -m) return true;                            // outside, in front of the door
    if (u <= m) return zr < room.doorW / 2 - m && y < room.floorY + room.doorH - S.head;   // in the opening
    return u < Math.abs(room.x1 - room.x0) - m && zr < room.HW - m && y < room.floorY + room.EAVE - 0.5;
  }
  // a point inside a wall's solid (the door wall round its opening, the flanks, the back, the roof)
  function inWall(room, x, y, z) {
    const ax = room.axis, u = (x - room.x0) * -ax, zr = Math.abs(z - room.zc), yy = y - room.floorY;
    const len = Math.abs(room.x1 - room.x0);
    if (u < -0.3 || u > len + 0.3 || zr > room.HW + 0.3 || yy < 0) return false;
    if (Math.abs(u) < 0.3) return zr > room.doorW / 2 || yy > room.doorH;
    if (Math.abs(zr - room.HW) < 0.3 || Math.abs(u - len) < 0.3) return yy < room.EAVE + 0.5;
    return yy > room.EAVE && yy < room.EAVE + 2.5;
  }
  const JE = [0, 0, 0, 0];
  function judge(c, room, cg, ax) {
    if (!room) return 0;
    // the stop first (cheap): an eye left in a wall at the cut rules the roll out before its path is walked
    eyeAt(c, cg, ax, c.T.T, JE);
    if (!eyeOk(room, JE[0], JE[1], JE[2])) return 1000;
    let bad = 0;
    const N = 48;
    for (let k = 0; k <= N; k++) {
      const t = c.T.T * k / N;
      eyeAt(c, cg, ax, t, JE);
      const ex = JE[0], ey = JE[1], ez = JE[2], cx = JE[3];
      if (!eyeOk(room, ex, ey, ez)) bad++;
      // the aeroplane in sight: nothing of a wall on the way to the CG (the last 3 m are the aeroplane's);
      // an eye and a CG both out in front of the door have the shed behind them
      if ((ex - room.x0) * -ax < -0.3 && (cx - room.x0) * -ax < -0.3) continue;
      const dl = Math.hypot(cx - ex, cg[1] - ey, cg[2] - ez), n = Math.max(2, Math.ceil(dl / 0.5));
      for (let i = 1; i < n; i++) {
        const f = i / n;
        if (dl * (1 - f) < 3) break;
        if (inWall(room, ex + (cx - ex) * f, ey + (cg[1] - ey) * f, ez + (cg[2] - ez) * f)) { bad++; break; }
      }
    }
    return bad;
  }
  // the last resort for a plan that could not avoid a wall: pull the eye into the nearest legal box
  function legalize(room, p) {
    if (!room) return;
    const m = S.margin, ax = room.axis, u = (p.x - room.x0) * -ax;
    if (p.y < room.floorY + 0.35) p.y = room.floorY + 0.35;
    if (u < -m) return;
    if (u <= m) {
      const zl = room.doorW / 2 - m - 0.01;
      p.z = room.zc + clamp(p.z - room.zc, -zl, zl);
      p.y = Math.min(p.y, room.floorY + room.doorH - S.head - 0.01);
      return;
    }
    const len = Math.abs(room.x1 - room.x0), zl = room.HW - m - 0.01;
    if (u > len - m) p.x = room.x0 - ax * (len - m - 0.01);
    p.z = room.zc + clamp(p.z - room.zc, -zl, zl);
    p.y = Math.min(p.y, room.floorY + room.EAVE - 0.51);
  }

  // THE SHOT'S KINEMATICS, a frame: the clock, the roll, the prop's rpm, the settle. Its state is a typed
  // array (a double held in a closure variable is a fresh heap number at every write - V8 boxes context
  // slots - and one handed to a call that is not inlined is boxed too: G1037 measured 100-300 bytes a
  // frame before). st: [0] t, [1] rolled, [2] rpm, [3] / [4] the time the main pair / the third wheel met
  // the sill (NaN: not yet), [5] rolled this frame, [6] heave, [7] pitch (+ nose down in the roll's sense
  // times -ax: a turn about z), [8] the rpm changed, [9] the control check's clock (G1064: its whole length once
  // the roll runs)
  function advance(P, st, dt) {
    // (the ramp's distance and acceleration, the bounce and the easing written out: no call here takes a double - see above)
    const T = P.T, d = dt > 0 ? (dt < 1 / 15 ? dt : 1 / 15) : 0;
    const t = st[0] = st[0] + d < T.T ? st[0] + d : T.T;
    const tau = t - S.hold0, Tr = T.Tr, ta = T.ta, v = T.v, k = Math.PI / ta;
    let s = 0, acc = 0;
    if (tau >= Tr) s = P.L;
    else if (T.go) { if (tau > 0) { const q = tau / Tr; s = P.L * q * q; acc = 2 * P.L / (Tr * Tr); } }
    else if (tau > 0 && tau < ta) { s = v * (tau / 2 - Math.sin(k * tau) / (2 * k)); acc = v * k / 2 * Math.sin(k * tau); }
    else if (tau > 0 && tau <= Tr - ta) s = v * ta / 2 + v * (tau - ta);
    else if (tau > 0) { const r = Tr - tau; s = P.L - v * (r / 2 - Math.sin(k * r) / (2 * k)); acc = -v * k / 2 * Math.sin(k * r); }
    st[5] = s - st[1]; st[1] = s;
    const tt = t + st[9], u = tt / 0.6 < 1 ? tt / 0.6 : 1, rpm = S.idleRpm * u * u * u * (u * (u * 6 - 15) + 10);   // (the prop spools from the check's start: st[9])
    st[8] = rpm !== st[2] ? 1 : 0; st[2] = rpm;
    // a heave where the main pair crosses the sill, a pitch where the third wheel does, and the roll's own
    // acceleration as a nod (speeding up lifts the nose, slowing dips it)
    if (P.sMain != null && isNaN(st[3]) && s >= P.sMain) st[3] = t;
    if (P.sThird != null && isNaN(st[4]) && s >= P.sThird) st[4] = t;
    const w = TWO_PI * S.sillHz;
    let heave = 0, third = 0;
    if (st[3] === st[3]) { const q = t - st[3]; heave = S.sillHeave * Math.exp(-q / S.sillTau) * Math.sin(w * q); }
    // the third wheel ahead of the mains (a nosewheel) lifts the nose, behind them (a tailwheel) the tail
    if (P.xThird != null && st[4] === st[4]) { const q = t - st[4]; third = P.thirdSign * S.sillPitch * Math.exp(-q / S.sillTau) * Math.sin(w * q); }
    st[6] = heave;
    st[7] = (third - S.brakePitch * acc) * -P.ax;
  }

  // ---- THE PLAYER -------------------------------------------------------------------------------------
  let active = null;
  const FR = new Float64Array(3);
  function play(o) {
    o = o || {};
    const onDone = typeof o.onDone === 'function' ? o.onDone : () => {};
    if (active) active.cancel();
    const dead = (why) => { const h = { done: true, skipped: why, plan: null, cancel() {}, skip() {}, tick() { return false; } };
      try { onDone(h); } catch (e) { if (typeof console !== 'undefined') console.error('ROLLANIM onDone:', e); } return h; };
    if (o.skip === true) return dead('asked to skip');
    let P;
    try { P = makePlan(o); } catch (e) { if (typeof console !== 'undefined') console.warn('ROLLANIM plan:', e && e.message); return dead('no plan: ' + (e && e.message)); }
    if (P.skip) return dead(P.skip);
    const craft = o.craft, cam = o.camera, room = P.room, cg = P.cg, ax = P.ax;
    // what is put back: the craft's transform, the print, the kit and the card we hid, the props' rpm
    const pos0 = craft.position.clone(), quat0 = craft.quaternion.clone();
    const print = o.hangar && typeof o.hangar.craftPrint === 'function' ? o.hangar.craftPrint() : null;
    const printX0 = print ? print.position.x : 0;
    const hidden = [];
    // THE KIT IN THE WAY: a mobile prop (the nose station's hand truck, a jerrycan) or the day card that
    // the aeroplane's own meshes would sweep through is hidden for the shot - tested mesh by mesh (a wing
    // passes over a jerrycan; the aeroplane's whole box would say it hits it)
    const obst = [];
    if (o.hangar && o.hangar.mobileGroup && o.hangar.mobileGroup.visible) for (const k of o.hangar.mobileGroup.children) obst.push(k);
    if (o.hangar && o.hangar.dayCard && o.hangar.dayCard.visible) obst.push(o.hangar.dayCard);
    if (o.obstacles) for (const k of o.obstacles) obst.push(k);
    if (obst.length) {
      const boxes = [];
      drawnBoxes(craft, boxes);
      for (const k of obst) {
        if (!k.visible) continue;
        const b = new THREE.Box3().setFromObject(k);
        if (!isFinite(b.min.x)) continue;
        const ahead = bb => ax < 0 ? b.min.x < bb.max.x && b.max.x > bb.min.x - P.L : b.max.x > bb.min.x && b.min.x < bb.max.x + P.L;
        for (const bb of boxes)
          if (ahead(bb) && b.min.z < bb.max.z && b.max.z > bb.min.z && b.min.y < bb.max.y && b.max.y > bb.min.y) { hidden.push(k); k.visible = false; break; }
      }
    }
    // the wheels and props, flat (no closure, no array made a frame)
    const W = P.wheels.filter(w => w.obj && w.obj.rotation);
    const wObj = W.map(w => w.obj), wR = W.map(w => Math.max(0.05, w.R));
    const wSpun = new Float64Array(W.length);           // radians turned by the shot (the gate reads it)
    const props = (P.rig.props || []).filter(p => p && p.obj);
    const pAx = props.map(p => p.axis ? new THREE.Vector3(p.axis[0], p.axis[1], p.axis[2]).normalize() : null);
    const pAng = new Float64Array(props.length);
    const propRpm = P.start.n ? null : P.rig.propRpm;   // (G1715: with engines to start, the shot writes sim.out itself - engStep)
    const lookV = new THREE.Vector3(), eyeV = new THREE.Vector3();
    // G1064 THE CONTROL CHECK: its segments flat (typed arrays - the frame hands no double to a call), the controls
    // it drives and the linkage it snaps (the host's model.link: the drawn surfaces follow the profile exactly)
    const CK = P.check, ctl = CK.ctl, nSeg = CK.segs.length;
    const sT0 = new Float64Array(nSeg), sT1 = new Float64Array(nSeg), sA = new Float64Array(nSeg), sK = new Int8Array(nSeg);
    CK.segs.forEach((g, i) => { sT0[i] = g.t0; sT1[i] = g.t1; sA[i] = g.amp; sK[i] = g.code; });
    const link = ctl && o.model && o.model.link && typeof o.model.link.snap === 'function' ? o.model.link : null;
    const neutral = () => { if (!ctl) return; ctl.da = 0; ctl.de = 0; ctl.dr = 0; ctl.flap = 0; if (link) link.snap(ctl); };
    // G1715 THE ENGINES (the START's plan, P.start): the fields a real start moves, saved here and put back at the end
    // (putBack), then every engine STOPPED for the shot's first frame - the solver's own writer, setEngine key 'off'
    const SP = P.start, NE = SP.n, sim = o.sim, simCtl = sim && sim.ctl;
    const Eng = NE ? sim.eng : null, out = NE ? sim.out : null;
    const engSaved = NE ? Eng.map(e => [e.running, e.key, e.crank]) : null;
    const hadRpm = NE && Array.isArray(out.rpm), hadRpmE = NE && Array.isArray(out.rpmEng);
    const rpmSaved = hadRpm ? out.rpm.slice() : null, rpmESaved = hadRpmE ? out.rpmEng.slice() : null;
    const thrSaved = simCtl ? simCtl.thr : 0;
    // the per-engine constants, flat; ES the state (stride ESW): [0] the voice's engine rpm, [1] the starter's envelope,
    // [2] the catch's clock, [3] catching, [4] running last frame, [5] / [6] the solver's prop / engine rpm, [7] the crank's
    // revolutions, [8] the DRAWN prop's rpm (the voice's / gear, through each compression while it cranks), [9] spare
    const eKind = new Int8Array(NE), eMeth = new Int8Array(NE), eGo = new Float64Array(NE), eI2 = new Float64Array(NE),
      eD2 = new Float64Array(NE), eGear = new Float64Array(NE), eCrank = new Float64Array(NE), eIdle = new Float64Array(NE),
      eCpr = new Float64Array(NE), eDone = new Int8Array(NE);
    for (let k = 0; k < NE; k++) {
      const g = SP.engines[k];
      eKind[k] = g.kind === 'turbine' ? 1 : g.kind === 'electric' ? 2 : 0; eMeth[k] = g.method === 'swing' ? 1 : g.method === 'power' ? 2 : 0;
      eGo[k] = g.tGo; eI2[k] = g.nIdle * g.nIdle; eD2[k] = g.nFull * g.nFull - g.nIdle * g.nIdle; eGear[k] = g.gear;
      eCrank[k] = g.crankRpm; eIdle[k] = g.idleEng; eCpr[k] = g.cpr;
    }
    const ES = new Float64Array(Math.max(1, NE) * ESW);
    const engVis = P.rig.engVis || null;
    let keyed = 0;
    // setEngine with the master ON: the starter turns if the build has one (the cockpit asks its bus; the shot's battery is
    // fresh) - sim.starterOk lent for the call and given back
    const okStart = () => SP.starter !== false;
    function engSet(k, patch) {
      const e = Eng[k];
      if (typeof sim.setEngine === 'function') {
        const own = Object.prototype.hasOwnProperty.call(sim, 'starterOk'), was = sim.starterOk;
        sim.starterOk = okStart;
        try { sim.setEngine(k, patch); } finally { if (own) sim.starterOk = was; else delete sim.starterOk; }
        return;
      }
      // (a sim without the writer: its rules, written out)
      if (patch.key !== undefined) { e.key = patch.key; if (e.key === 'off') { e.running = false; e.crank = 0; } }
      if (patch.swing) e.running = true;
      if (patch.start && !e.running) e.crank = S.crankS;
    }
    if (NE) {
      if (!hadRpm) out.rpm = [];
      if (!hadRpmE) out.rpmEng = [];
      for (let k = 0; k < NE; k++) { engSet(k, P_OFF); out.rpm[k] = 0; out.rpmEng[k] = 0; }
      if (ctl) neutral();                                // (the surfaces still through the start: snapped once, held at 0)
    }
    // THE ENGINES, a frame: the start's events at its clock tS (< 0: the start is over), the solver's crank countdown (burn's
    // two lines: crank -= dt, at 0 it runs), the solver's shaft law at the throttle thr x the engine's lever, written to
    // sim.out as the solver writes it; then the VOICE'S rpm (engine_worklet.js's law: the starter's envelope, the crank at
    // crankRpm, the catch's surge 0.45 idle over 0.25-1.25 s, the taus, the run-down's friction; the turbine's Np and the
    // motor's rpm their prop_worklet laws) for the drawn prop. thr and tS come in through st[11] / st[10]: no double handed
    // to a call (d: st[12])
    function engStep() {
      const tS = st[10], thr = st[11], d = st[12];
      {
        if (!keyed && tS >= S.startKeyAt) { keyed = 1; for (let k = 0; k < NE; k++) engSet(k, P_KEY); }
        for (let k = 0; k < NE; k++) if (!eDone[k] && tS >= eGo[k]) { eDone[k] = 1; engSet(k, eMeth[k] === 0 ? P_START : P_SWING); }
      }
      if (simCtl) simCtl.thr = thr;
      const L = simCtl && simCtl.eng;
      for (let k = 0; k < NE; k++) {
        const e = Eng[k], o9 = k * ESW;
        if (e.crank > 0) { e.crank -= d; if (e.crank <= 0) { e.crank = 0; e.running = true; } }
        const run = !!e.running, le = L && L[k];
        let te = run ? thr * (le ? (le.on ? +le.thr : 0) : 1) : 0;
        te = te < 0 ? 0 : te > 1 ? 1 : te;
        const n = run ? Math.sqrt(eI2[k] + eD2[k] * te) : 0, gear = eGear[k];
        ES[o9 + 5] = n; ES[o9 + 6] = n * gear;
        out.rpm[k] = n; out.rpmEng[k] = n * gear;
        let v = ES[o9], vis;
        const kd = eKind[k];
        if (kd === 0) {
          const crk = e.crank > 0 && !run, idle = eIdle[k];
          if (run && !(ES[o9 + 4] > 0)) { ES[o9 + 2] = 0; ES[o9 + 3] = v < 0.85 * idle ? 1 : 0; }
          ES[o9 + 4] = run ? 1 : 0;
          if (run) { ES[o9 + 2] += d; if (ES[o9 + 2] > 2) ES[o9 + 3] = 0; }
          let env = ES[o9 + 1];
          env += ((crk ? 1 : 0) - env) * (1 - Math.exp(-d / (crk ? 0.06 : 0.25)));
          if (env < 1e-6) env = 0;
          ES[o9 + 1] = env;
          const rIn = n * gear, cT = ES[o9 + 2], catching = ES[o9 + 3] > 0;
          let tgt = rIn, tau = 1.2;
          if (run) {
            tgt = rIn + (catching && cT > 0.25 && cT < 1.25 ? 0.45 * idle * Math.sin(Math.PI * (cT - 0.25)) : 0);
            tau = tgt > v ? (catching ? 0.16 : 0.3) : 0.45;
          } else if (env > 0.01) { tgt = rIn > eCrank[k] * env ? rIn : eCrank[k] * env; tau = 0.2; }
          v += (tgt - v) * (1 - Math.exp(-d / tau));
          if (!run && env <= 0.01 && v > tgt) { v -= 120 * d; if (v < tgt) v = tgt; }
          if (v < 1e-3) v = 0;
          let rev = ES[o9 + 7] + v / 60 * d; rev -= Math.floor(rev); ES[o9 + 7] = rev;
          const cm = run ? 0 : 0.32 * env;
          vis = v * (1 + cm * Math.sin(TWO_PI * rev * eCpr[k])) / gear;
        } else if (kd === 1) {
          v += (n - v) * (1 - Math.exp(-d / (run ? 2.0 : 6.0)));
          vis = v;
        } else {
          v += (n * gear - v) * (1 - Math.exp(-d / (run ? 0.25 : 2.5)));
          vis = v / gear;
        }
        ES[o9] = v; ES[o9 + 8] = vis;
      }
      if (engVis) engVis(ES, NE);
    }
    // THE ROLL'S THROTTLE at the roll's clock st[0] (into st[11]): up to S.rollThr over S.thrUp, held, back to 0 by S.thrDown
    // of the roll (the smootherstep written out), in S.thrStep steps; true when it stepped
    function rollThr() {
      const Tr = P.T.Tr, t = st[0];
      let a = t / S.thrUp; a = a < 0 ? 0 : a > 1 ? 1 : a;
      const t1 = S.hold0 + S.thrHold * Tr, t2 = S.hold0 + S.thrDown * Tr;
      let b = (t - t1) / (t2 - t1); b = b < 0 ? 0 : b > 1 ? 1 : b;
      const v = S.rollThr * a * a * a * (a * (a * 6 - 15) + 10) * (1 - b * b * b * (b * (b * 6 - 15) + 10));
      const q = Math.round(v / S.thrStep) * S.thrStep;
      if (q === st[11]) return false;
      st[11] = q; return true;
    }
    // the engines put back: every field the shot wrote, as it found them - except, when the HOST says the stand follows with
    // its engines running (o.handover: app.js's roll-out; the solver's reset() runs them, 30_solver.js resetPanel) and the shot
    // ended or was skipped, sim.out's rpm / rpmEng are left at the idle the stand's first step writes: the voice idles across
    // the cut (no dip, no second catch)
    function engBack(how) {
      if (!NE) return;
      for (let k = 0; k < NE; k++) { const e = Eng[k], s0 = engSaved[k]; e.running = s0[0]; e.key = s0[1]; e.crank = s0[2]; }
      if (simCtl) simCtl.thr = thrSaved;
      if (o.handover && how !== 'cancel') {
        for (let k = 0; k < NE; k++) { const g = SP.engines[k]; out.rpm[k] = g.nIdle; out.rpmEng[k] = g.nIdle * g.gear; }
        return;
      }
      if (hadRpm) { out.rpm.length = 0; for (let i = 0; i < rpmSaved.length; i++) out.rpm[i] = rpmSaved[i]; } else delete out.rpm;
      if (hadRpmE) { out.rpmEng.length = 0; for (let i = 0; i < rpmESaved.length; i++) out.rpmEng[i] = rpmESaved[i]; } else delete out.rpmEng;
    }
    // G1715 THE AUDIO POSE (o.audioPose: space.js's shotPose, a Float64Array): [0] on, [1..3] the aeroplane's offset from
    // where the solver stands it (the roll), [4] the engines' share inside the shed - the space hears the shot's aeroplane where
    // it is, through the shed's door
    const AP = o.audioPose && o.audioPose.length >= 5 ? o.audioPose : null;
    const xEngA = P.xEng, xDoorA = P.xDoor;
    // (at rest - the start and the check - it holds still: written once, here; the roll writes its own, in its tick)
    if (AP) {
      const u = room ? 0.5 + (xEngA - xDoorA) * -ax / S.doorBlend : 1;
      AP[0] = 1; AP[1] = 0; AP[2] = 0; AP[3] = 0; AP[4] = u < 0 ? 0 : u > 1 ? 1 : u;
    }
    // THE SHOT'S CLOCK IN A TYPED ARRAY: a double held in a closure's variable is a fresh heap number at
    // every write (V8 boxes context slots) - 100+ bytes a frame measured, where these slots cost none.
    // (the slots: see advance)
    // G1715: [10] the start's clock, [11] the throttle the engines see, [12] the frame's (clamped) seconds - engStep's
    const st = new Float64Array(13); st[3] = st[4] = NaN;
    let raf = 0, lastT = 0, fin = false;
    // sill events: the time each group reached the sill (NaN: not yet)
    const h = {
      done: false, skipped: null, plan: P, spun: wSpun, hidden,
      get t() { return st[0]; }, get rolled() { return st[1]; },
      get tCheck() { return st[9]; }, get tStart() { return st[10]; }, get thr() { return st[11]; },
      get phase() { return h.done ? 'done' : st[10] < SP.T ? 'start' : st[9] < CK.T ? 'check' : 'roll'; },
      tick, cancel, skip, _cam: applyCam,
    };
    const FX = P.fixed;                                  // (G1115 the fixed shot: the eye held where the plan put it)
    if (FX) { eyeV.set(FX.eye[0], FX.eye[1], FX.eye[2]); lookV.set(FX.look[0], FX.look[1], FX.look[2]);
      if (FX.fov !== cam.fov) { cam.fov = FX.fov; cam.updateProjectionMatrix(); } }
    function frameCam() {                                // the eye and the aim at the shot's time
      if (FX) return;                                    // (set once, below)
      // the framing through typed arrays, and eyeAt's last lines written out (G1037); the roll is the tick's
      const t = st[0], cx = cg[0] + ax * st[1];
      framingInto(P, st, FR);
      const az = FR[0], el = FR[1], d = FR[2], ce = Math.cos(el);
      eyeV.set(cx + d * ce * Math.cos(az), cg[1] + d * Math.sin(el), cg[2] + d * ce * Math.sin(az));
      if (P.bad) legalize(room, eyeV);
      // the aim leaves the shed camera's point for the CG over the first third
      let xl = t / (0.33 * P.T.T); xl = xl > 1 ? 1 : xl;
      const wl = xl * xl * xl * (xl * (xl * 6 - 15) + 10);
      lookV.set(P.look0[0] + (cx - P.look0[0]) * wl, P.look0[1] + (cg[1] - P.look0[1]) * wl, P.look0[2] + (cg[2] - P.look0[2]) * wl);
      if (P.fov1 !== P.fov0) { cam.fov = P.fov0 + (P.fov1 - P.fov0) * smooth(t / P.T.T); cam.updateProjectionMatrix(); }
    }
    function applyCam() {
      if (h.done) return false;
      cam.up.set(0, 1, 0);
      cam.position.copy(eyeV);
      cam.lookAt(lookV);
      return true;
    }
    function tick(dt) {
      if (h.done || fin) return false;
      if (st[10] < SP.T) return startTick(dt);
      if (st[9] < CK.T) return checkTick(dt);
      // THE ROLL: the surfaces neutral and still (over the shed's sweep, which the host wrote earlier in the frame)
      if (ctl) { ctl.da = 0; ctl.de = 0; ctl.dr = 0; ctl.flap = 0; }
      advance(P, st, dt);
      if (NE) {                                         // (G1715: the throttle to break away, back to idle; the lever snapped on a step)
        const stepped = rollThr();
        st[12] = dt > 0 ? (dt < 1 / 15 ? dt : 1 / 15) : 0; engStep();
        if (stepped && link) link.snap(ctl);
      }
      const s = st[1], ds = st[5], th = st[7];
      // the wheels: distance over radius, the sense poseModel spins them by (forward, rotation.z grows)
      for (let i = 0; i < wObj.length; i++) { const a = ds / wR[i]; wObj[i].rotation.z += a; wSpun[i] += a; }
      // the propeller: idle, spooled up over the first half second (the host's: only while it spools - a
      // call a frame boxes its double)
      if (propRpm && st[8]) propRpm(st[2]);
      const w = (NE ? ES[8] : st[2]) * TWO_PI / 60 * (dt > 0 ? (dt < 1 / 15 ? dt : 1 / 15) : 0);
      for (let i = 0; i < props.length; i++) {
        const p = props[i], sense = p.sense || 1;
        pAng[i] += sense * w;
        if (pAx[i]) p.obj.quaternion.setFromAxisAngle(pAx[i], pAng[i]); else p.obj.rotation.x += sense * w;
      }
      // the settle (advance's heave and pitch) about the main wheels' contact line
      const c = Math.cos(th), sn = Math.sin(th), px = P.pivot[0] - pos0.x, py = P.pivot[1] - pos0.y;
      // quat0 x a turn th about z, written out (rotateZ hands its angle to a call: G1037)
      const hs = Math.sin(th / 2), hc = Math.cos(th / 2);
      craft.quaternion.set(quat0.x * hc + quat0.y * hs, quat0.y * hc - quat0.x * hs, quat0.z * hc + quat0.w * hs, quat0.w * hc - quat0.z * hs);
      craft.position.set(pos0.x + ax * s + px - (px * c - py * sn), pos0.y + st[6] + py - (px * sn + py * c), pos0.z);
      if (print) print.position.x = printX0 + ax * s;
      if (AP) {                                         // (G1715 the audio pose, written out: a call here boxed 32 B a frame)
        AP[0] = 1; AP[1] = ax * s; AP[2] = st[6]; AP[3] = 0;
        const u = room ? 0.5 + (xEngA + ax * s - xDoorA) * -ax / S.doorBlend : 1;
        AP[4] = u < 0 ? 0 : u > 1 ? 1 : u;
      }
      frameCam();
      applyCam();
      if (st[0] >= P.T.T) { fin = true; Promise.resolve().then(finish); }
      return true;
    }
    // THE CHECK, a frame: the aeroplane at rest, the camera held on its start, each surface in its turn - a segment's
    // deflection on its own smootherstep clock u (it starts and ends at rest): a stick surface a whole sine (one way,
    // the other, back), the flaps half of one (down and up); written out, no double handed to a call - the linkage
    // snapped onto them, the prop spooling to idle
    function checkTick(dt) {
      const d = dt > 0 ? (dt < 1 / 15 ? dt : 1 / 15) : 0;
      const t = st[9] = st[9] + d < CK.T ? st[9] + d : CK.T;
      let da = 0, de = 0, dr = 0, fl = 0;
      for (let i = 0; i < nSeg; i++) {
        if (t <= sT0[i] || t >= sT1[i]) continue;
        let u = (t - sT0[i]) / (sT1[i] - sT0[i]); u = u * u * u * (u * (u * 6 - 15) + 10);
        const k = sK[i];
        if (k === 3) fl = sA[i] * Math.sin(Math.PI * u);
        else { const v = sA[i] * Math.sin(TWO_PI * u); if (k === 0) da = v; else if (k === 1) de = v; else dr = v; }
      }
      ctl.da = da; ctl.de = de; ctl.dr = dr; ctl.flap = fl;
      if (link) link.snap(ctl);
      if (NE) { st[11] = 0; st[12] = d; engStep(); }               // (G1715: at idle, the engines settling from their start)
      else {
        const ur = t / 0.6 < 1 ? t / 0.6 : 1, rpm = S.idleRpm * ur * ur * ur * (ur * (ur * 6 - 15) + 10);
        st[8] = rpm !== st[2] ? 1 : 0; st[2] = rpm;
        if (propRpm && st[8]) propRpm(st[2]);
      }
      const w = (NE ? ES[8] : st[2]) * TWO_PI / 60 * d;
      for (let i = 0; i < props.length; i++) {
        const p = props[i], sense = p.sense || 1;
        pAng[i] += sense * w;
        if (pAx[i]) p.obj.quaternion.setFromAxisAngle(pAx[i], pAng[i]); else p.obj.rotation.x += sense * w;
      }
      if (st[9] >= CK.T) neutral();                      // (every drive is exactly 0 by then: the settle)
      applyCam();
      return true;
    }
    // G1715 THE START, a frame: the aeroplane at rest, the camera held on its start (as the check holds it), the surfaces
    // neutral (over the shed's sweep, when the shot drives them), the engines through their start at idle throttle
    function startTick(dt) {
      const d = dt > 0 ? (dt < 1 / 15 ? dt : 1 / 15) : 0;
      st[10] = st[10] + d < SP.T ? st[10] + d : SP.T;
      if (ctl) { ctl.da = 0; ctl.de = 0; ctl.dr = 0; ctl.flap = 0; }
      st[11] = 0; st[12] = d; engStep();
      const w = ES[8] * TWO_PI / 60 * d;
      for (let i = 0; i < props.length; i++) {
        const p = props[i], sense = p.sense || 1;
        pAng[i] += sense * w;
        if (pAx[i]) p.obj.quaternion.setFromAxisAngle(pAx[i], pAng[i]); else p.obj.rotation.x += sense * w;
      }
      applyCam();
      return true;
    }
    function putBack(how) {
      if (FX && cam.fov !== P.fov0) { cam.fov = P.fov0; cam.updateProjectionMatrix(); }   // (the fixed shot's lens: the host's back)
      craft.position.copy(pos0); craft.quaternion.copy(quat0);
      craft.updateMatrixWorld(true);
      if (print) print.position.x = printX0;
      for (const k of hidden) k.visible = true;
      if (propRpm) propRpm(null);
      engBack(how);                                       // (G1715: the engines' fields; the stand's idle on a handover)
      if (AP) { AP[0] = 0; AP[1] = 0; AP[2] = 0; AP[3] = 0; AP[4] = 1; }
      neutral();                                          // (a skip or a cancel mid-check leaves nothing deflected)
      stopInput();
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      raf = 0;
      if (active === h) active = null;
    }
    function finish(how) {
      if (h.done) return;
      putBack(how === 'skip' ? 'skip' : 'done'); h.done = true;
      try { onDone(h); } catch (e) { if (typeof console !== 'undefined') console.error('ROLLANIM onDone:', e); }
    }
    function skip() {                                    // a click or a key: the end pose, then onDone at once
      if (h.done) return;
      h.skipped = 'skipped by the player';
      st[10] = SP.T; st[9] = CK.T; st[0] = P.T.T; st[1] = P.L; frameCam(); applyCam();
      finish('skip');
    }
    function cancel() { if (h.done) return; h.skipped = 'cancelled'; putBack('cancel'); h.done = true; }
    // THE SKIP: the first click or key, taken in the capture phase so it does nothing else
    const onInput = e => { if (h.done) return; if (e.type === 'keydown' && (e.repeat || /^(Shift|Control|Alt|Meta)/.test(e.key || ''))) return;
      try { e.preventDefault(); e.stopImmediatePropagation(); } catch (x) {} skip(); };
    const win = typeof window !== 'undefined' && window.addEventListener ? window : null;
    if (win) { win.addEventListener('pointerdown', onInput, true); win.addEventListener('keydown', onInput, true); }
    function stopInput() { if (win) { win.removeEventListener('pointerdown', onInput, true); win.removeEventListener('keydown', onInput, true); } }
    active = h;
    // the first frame's pose now (a host that renders before its next ROLLANIM.frame sees the shot's start)
    frameCam();
    if (o.renderer && typeof requestAnimationFrame === 'function') {
      const loop = now => {
        if (h.done) return;
        const dt = lastT ? (now - lastT) / 1000 : 1 / 60; lastT = now;
        tick(dt);
        o.renderer.render(o.scene, cam);
        if (!h.done && !fin) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return h;
  }
  // THE HOST'S HOOKS (app.js frame loop): before the model is posed, and after the camera is placed
  function frame(dt) { return active ? active.tick(dt) : false; }
  function camera() {
    const h = active;
    return h && !h.done ? h._cam() : false;          // the same pose again, over the host's own placement
  }
  function plan(o) { return makePlan(o || {}); }
  const api = { S, play, frame, camera, busy: () => !!(active && !active.done), cancel: () => { if (active) active.cancel(); }, standFraming, appRig, plan,
                _rollS: rollS, _timing: timing, _eyeOk: eyeOk, _inWall: inWall, _roomOf: roomOf };
  if (typeof window !== 'undefined') window.ROLLANIM = api;
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ROLLANIM;
