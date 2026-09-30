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
//
//   ROLLANIM.play(opts) -> handle { cancel(), skip(), tick(dt), done, skipped, plan, phase, tCheck }
//                     (phase 'check' | 'roll' | 'done'; plan.check = { T, segs: [{ drive, t0, t1, amp }] },
//                     plan.Ttotal = plan.check.T + plan.T.T)
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
    // G1115 OPTION B (follow: false): the fixed eye eased to over the check's start, and the roll past the door
    bEase: 0.8, bOut: 7,
    // G1115 THE WORLD ROLL (playWorld): out of the world's own shed onto the stand
    wTmin: 5.0, wTmax: 7.5, wV: 5.5,   // the roll's length in seconds, and the speed it aims at (m/s)
    wHold0: 0.45, wHold1: 0.35,        // still in the doorway at the start (the dissolve), and at the stand
    noseIn: 1.2,                       // the nose this far inside the door plane at the start, metres
    wClear: 2.0,                       // the tail this far past the door plane before the aeroplane turns
    wHandle: 0.42,                     // the turn's handles, a fraction of the chord (a cubic from the door's line to the stand)
    wLag: 0.28,                        // the eye holds its establishing view this fraction of the roll, then dollies
    wMargin: 1.6,                      // the eye this far off the aeroplane's footprint, metres
  };
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
    // G1115: THE CHECK ALONE (o.roll false: the world roll follows it, playWorld) - no roll, no eye path, the shed's view held
    if (o.roll === false) {
      const check = checkPlan(o);
      return { skip: null, rig, wheels, room, box, cg, D, mode, ax, xDoor, Lmin, check, Ttotal: check.T, rollOn: false,
        L: 0, T: timing(0), side: sides[0], lag: 0, lagE: 0, bad: 0, cands: 0, az0, el0, d0, fresh, az1: az0, el1: el0, d1: d0,
        wtw: 0, waz: 0, wel: 0, wd: 0, look0, fov0, fov1: fov0, pivot: [0, 0], xThird: null, thirdSign: 1, sMain: null, sThird: null,
        end: { side: sides[0], az: wrap(az0 - hdg), el: el0, dist: d0 } };
    }
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
    // G1115 OPTION B (o.follow false: the world roll cannot play - the flight starts lined up, on another field, or the
    // world has no shed at the stand): THE EYE STAYS IN THE SHED. A fixed three-quarter view from behind and beside the
    // tail, eased to over the check's first S.bEase s, and held: the aeroplane rolls away from it, out through the door
    // and S.bOut m on - it is not followed, so the room is the picture and the door a bright opening at its end
    let fixed = null;
    if (o.follow === false) {
      const sd = sides[0], look = [cg[0] + (xDoor - cg[0]) * 0.45, cg[1] + 0.3, cg[2]];
      let best = null;
      for (const k of [[0.62, 0.13, 0.95], [0.5, 0.16, 0.8], [0.8, 0.12, 0.75], [0.4, 0.2, 0.65], [0.62, 0.1, 0.55]]) for (const s2 of [sd, -sd]) {
        const az = hdg + s2 * k[0], d = k[2] * D, e = [cg[0] + d * Math.cos(k[1]) * Math.cos(az), cg[1] + d * Math.sin(k[1]), cg[2] + d * Math.cos(k[1]) * Math.sin(az)];
        const p = { x: e[0], y: e[1], z: e[2] }; legalize(room, p);
        const bad = room && !eyeOk(room, p.x, p.y, p.z) ? 1 : 0;
        const inBox = box.clone().expandByScalar(0.8).containsPoint(new THREE.Vector3(p.x, p.y, p.z)) ? 1 : 0;
        const sc = bad * 10 + inBox * 10 + (s2 === sd ? 0 : 1);
        if (!best || sc < best.sc) best = { sc, eye: [p.x, p.y, p.z] };
      }
      fixed = { eye: best.eye, look };
    }
    // the wheel groups: the sill events (the main pair's heave, the third wheel's pitch)
    const xs = wheels.map(w => w.x), xMid = xs.reduce((a, b) => a + b, 0) / xs.length;
    let xMainSum = 0, nMain = 0, xThird = null;
    for (const w of wheels) if (Math.abs(w.z - cg[2]) > 0.2) { xMainSum += w.x; nMain++; }
    const xMain = nMain ? xMainSum / nMain : xMid;
    for (const w of wheels) if (Math.abs(w.z - cg[2]) <= 0.2) { xThird = w.x; break; }
    const floorY = room ? room.floorY : box.min.y;
    const check = checkPlan(o);
    const Lb = fixed ? Math.max(c.L, Lmin + S.bOut) : c.L, Tb = fixed ? timing(Lb) : c.T;
    return {
      skip: null, rig, wheels, room, box, cg, D, mode, ax, xDoor, Lmin, check, Ttotal: check.T + Tb.T, rollOn: true, fixed,
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
    return { T: Tr + S.hold0 + S.hold1, Tr, ta: S.ramp * Tr, v: L / (Tr * (1 - S.ramp)), h0: S.hold0 };
  }
  // G1115: the world roll's (its own length, speed and holds; the same profile)
  function worldTiming(L) {
    const Tr = clamp(L / S.wV / (1 - S.ramp), S.wTmin - S.wHold0 - S.wHold1, S.wTmax - S.wHold0 - S.wHold1);
    return { T: Tr + S.wHold0 + S.wHold1, Tr, ta: S.ramp * Tr, v: L / (Tr * (1 - S.ramp)), h0: S.wHold0 };
  }
  // the distance rolled at time t (the hold, the cosine ramp up, the cruise, the ramp down, the hold)
  function rollS(tm, L, t) {
    const tau = t - tm.h0, Tr = tm.Tr, ta = tm.ta, v = tm.v;
    if (tau <= 0) return 0;
    if (tau >= Tr) return L;
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
    const tau = t - T.h0, Tr = T.Tr, ta = T.ta, v = T.v, k = Math.PI / ta;
    let s = 0, acc = 0;
    if (tau >= Tr) s = P.L;
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
    const propRpm = P.rig.propRpm;
    const lookV = new THREE.Vector3(), eyeV = new THREE.Vector3();
    // G1064 THE CONTROL CHECK: its segments flat (typed arrays - the frame hands no double to a call), the controls
    // it drives and the linkage it snaps (the host's model.link: the drawn surfaces follow the profile exactly)
    const CK = P.check, ctl = CK.ctl, nSeg = CK.segs.length;
    const sT0 = new Float64Array(nSeg), sT1 = new Float64Array(nSeg), sA = new Float64Array(nSeg), sK = new Int8Array(nSeg);
    CK.segs.forEach((g, i) => { sT0[i] = g.t0; sT1[i] = g.t1; sA[i] = g.amp; sK[i] = g.code; });
    const link = ctl && o.model && o.model.link && typeof o.model.link.snap === 'function' ? o.model.link : null;
    const neutral = () => { if (!ctl) return; ctl.da = 0; ctl.de = 0; ctl.dr = 0; ctl.flap = 0; if (link) link.snap(ctl); };
    // THE SHOT'S CLOCK IN A TYPED ARRAY: a double held in a closure's variable is a fresh heap number at
    // every write (V8 boxes context slots) - 100+ bytes a frame measured, where these slots cost none.
    // (the slots: see advance)
    const st = new Float64Array(10); st[3] = st[4] = NaN;
    let raf = 0, lastT = 0, fin = false;
    // sill events: the time each group reached the sill (NaN: not yet)
    const h = {
      done: false, skipped: null, plan: P, spun: wSpun, hidden,
      get t() { return st[0]; }, get rolled() { return st[1]; },
      get tCheck() { return st[9]; }, get phase() { return h.done ? 'done' : st[9] < CK.T ? 'check' : 'roll'; },
      tick, cancel, skip, _cam: applyCam,
    };
    // G1115 OPTION B: the fixed eye, eased from the shed's view over S.bEase s of the shot's clock (check + roll)
    const eyeS = new THREE.Vector3(), lookS = new THREE.Vector3(), FX = P.fixed;
    let fxOn = false;                                    // (on once the start's view is taken)
    function fixedCam() {
      let u = (st[9] + st[0]) / S.bEase; u = u < 0 ? 0 : u > 1 ? 1 : u; u = u * u * u * (u * (u * 6 - 15) + 10);
      eyeV.set(eyeS.x + (FX.eye[0] - eyeS.x) * u, eyeS.y + (FX.eye[1] - eyeS.y) * u, eyeS.z + (FX.eye[2] - eyeS.z) * u);
      lookV.set(lookS.x + (FX.look[0] - lookS.x) * u, lookS.y + (FX.look[1] - lookS.y) * u, lookS.z + (FX.look[2] - lookS.z) * u);
    }
    function frameCam() {                                // the eye and the aim at the shot's time
      if (fxOn) { fixedCam(); return; }
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
      if (st[9] < CK.T) return checkTick(dt);
      if (!P.rollOn) { fin = true; Promise.resolve().then(finish); return true; }   // (G1115: the check alone, and none to do)
      // THE ROLL: the surfaces neutral and still (over the shed's sweep, which the host wrote earlier in the frame)
      if (ctl) { ctl.da = 0; ctl.de = 0; ctl.dr = 0; ctl.flap = 0; }
      advance(P, st, dt);
      const s = st[1], ds = st[5], th = st[7];
      // the wheels: distance over radius, the sense poseModel spins them by (forward, rotation.z grows)
      for (let i = 0; i < wObj.length; i++) { const a = ds / wR[i]; wObj[i].rotation.z += a; wSpun[i] += a; }
      // the propeller: idle, spooled up over the first half second (the host's: only while it spools - a
      // call a frame boxes its double)
      if (propRpm && st[8]) propRpm(st[2]);
      const w = st[2] * TWO_PI / 60 * (dt > 0 ? (dt < 1 / 15 ? dt : 1 / 15) : 0);
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
      const ur = t / 0.6 < 1 ? t / 0.6 : 1, rpm = S.idleRpm * ur * ur * ur * (ur * (ur * 6 - 15) + 10);
      st[8] = rpm !== st[2] ? 1 : 0; st[2] = rpm;
      if (propRpm && st[8]) propRpm(st[2]);
      const w = st[2] * TWO_PI / 60 * d;
      for (let i = 0; i < props.length; i++) {
        const p = props[i], sense = p.sense || 1;
        pAng[i] += sense * w;
        if (pAx[i]) p.obj.quaternion.setFromAxisAngle(pAx[i], pAng[i]); else p.obj.rotation.x += sense * w;
      }
      if (st[9] >= CK.T) neutral();                      // (every drive is exactly 0 by then: the settle)
      if (fxOn) fixedCam();
      applyCam();
      // G1115: the check alone (roll: false) ends here - the host cuts to the world roll (playWorld)
      if (!P.rollOn && st[9] >= CK.T) { fin = true; Promise.resolve().then(finish); }
      return true;
    }
    function putBack() {
      craft.position.copy(pos0); craft.quaternion.copy(quat0);
      craft.updateMatrixWorld(true);
      if (print) print.position.x = printX0;
      for (const k of hidden) k.visible = true;
      if (propRpm) propRpm(null);
      neutral();                                          // (a skip or a cancel mid-check leaves nothing deflected)
      stopInput();
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      raf = 0;
      if (active === h) active = null;
    }
    function finish() {
      if (h.done) return;
      putBack(); h.done = true;
      try { onDone(h); } catch (e) { if (typeof console !== 'undefined') console.error('ROLLANIM onDone:', e); }
    }
    function skip() {                                    // a click or a key: the end pose, then onDone at once
      if (h.done) return;
      h.skipped = 'skipped by the player';
      st[9] = CK.T; if (P.rollOn) { st[0] = P.T.T; st[1] = P.L; } frameCam(); applyCam();
      finish();
    }
    function cancel() { if (h.done) return; h.skipped = 'cancelled'; putBack(); h.done = true; }
    // THE SKIP: the first click or key, taken in the capture phase so it does nothing else
    const onInput = e => { if (h.done) return; if (e.type === 'keydown' && (e.repeat || /^(Shift|Control|Alt|Meta)/.test(e.key || ''))) return;
      try { e.preventDefault(); e.stopImmediatePropagation(); } catch (x) {} skip(); };
    const win = typeof window !== 'undefined' && window.addEventListener ? window : null;
    if (win) { win.addEventListener('pointerdown', onInput, true); win.addEventListener('keydown', onInput, true); }
    function stopInput() { if (win) { win.removeEventListener('pointerdown', onInput, true); win.removeEventListener('keydown', onInput, true); } }
    active = h;
    // the first frame's pose now (a host that renders before its next ROLLANIM.frame sees the shot's start)
    frameCam();
    if (FX) { eyeS.copy(eyeV); lookS.copy(lookV); fxOn = true; }
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
  // ---- G1115 THE WORLD ROLL (ROLLOUT-REAL) --------------------------------------------------------------
  // The user, 2026-09-30: "The plane rolling out is very cool, but the fact it rolls out to an environment which is not the
  // real one is super strange and confusing ... the best one is that it gets into the real environment directly". The
  // shed's check (play, roll: false) is followed by THE CUT INTO THE WORLD (app.js: the aeroplane already on its stand,
  // the flight held), and this plays there: the aeroplane in the doorway of the world's OWN shed (render_world's shell, the
  // same genHangarBuild as the room, stood open - hangar.js opts.open), rolled out onto the real apron and onto the stand,
  // and the eye from an establishing view outside the door dollied onto the flight's own first frame. IT ENDS ON THE
  // FLIGHT: the aeroplane's last pose is the stand's (the craft at identity - the sim was placed there before the shot),
  // the eye the host's reveal (opts.end: what flRevealStart + placeCamera draw on the flight's first frame), so there is
  // no second cut.
  //   ROLLANIM.playWorld(opts) -> handle (as play's: cancel, skip, tick, done, skipped, plan; world: true)
  //     opts.craft, opts.camera, opts.model, opts.def, opts.sim   the app's; the sim STANDS on the stand (world frame) and
  //                     is not stepped meanwhile; craft is moved as a rigid offset of that pose (identity at the end)
  //     opts.shed       render_world's shedFrame(): { node (the room's frame: door at local doorAxis x, slab at y 0),
  //                     dims { HW, HD, EAVE }, door { w, h }, doorAxis }
  //     opts.end        { eye: [x,y,z], look: [x,y,z], fov } the flight's first frame (app.js revealPose)
  //     opts.ground     fn(x, z) -> the ground's height (the world's terrainH); inside the shed its slab
  //     opts.contact    optional Object3D moved with the aeroplane (app.js's contact shadows, drawn at the stand's wheels)
  //     opts.onDone, opts.skip   as play's
  //   THE PATH: the main wheels' midpoint rolls straight out of the door along its axis until the tail is S.wClear past
  //   the door plane, then a cubic onto the stand (tangent to both: the heading follows the path), by arc length on
  //   play's own profile (hold, ramp, cruise, ramp, hold; S.wTmin-S.wTmax s at S.wV). THE EYE: an establishing point
  //   outside the door (candidates in the shed's frame; the one clear of the aeroplane's footprint all along, outside the
  //   building, the aeroplane in sight past its walls, then the nearest to the flight's eye) held for S.wLag of the roll,
  //   then eased onto opts.end.eye; the aim is the aeroplane's CG, which ends on opts.end.look.
  function drawnExtent(root, P1, nx, nz) {             // the drawn aeroplane about P1 along the nose (n) and the lateral
    root.updateMatrixWorld(true);
    const e = { fwd: 0, aft: 0, half: 0, top: 0 }, v = new THREE.Vector3();
    const lx = -nz, lz = nx;
    const walk = o => {
      if (!o.visible) return;
      const g = o.geometry;
      if ((o.isMesh || o.isLine || o.isPoints) && g && g.attributes && g.attributes.position) {
        if (!g.boundingBox) g.computeBoundingBox();
        const b = g.boundingBox;
        if (isFinite(b.min.x)) for (let i = 0; i < 8; i++) {
          v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld);
          const rx = v.x - P1[0], rz = v.z - P1[2], f = rx * nx + rz * nz, l = Math.abs(rx * lx + rz * lz);
          if (f > e.fwd) e.fwd = f;
          if (-f > e.aft) e.aft = -f;
          if (l > e.half) e.half = l;
          if (v.y - P1[1] > e.top) e.top = v.y - P1[1];
        }
      }
      for (const k of o.children) walk(k);
    };
    walk(root);
    return e;
  }
  function worldPlan(o) {
    const craft = o.craft, cam = o.camera, sim = o.sim, shed = o.shed, end = o.end;
    if (!craft || !cam || !sim || !sim.axes) return { skip: 'no craft, camera or sim' };
    if (!shed || !shed.node || !shed.dims) return { skip: 'no shed in the world' };
    if (!end || !end.eye || !end.look) return { skip: 'no flight frame to end on' };
    const rig = appRig(o.model, o.def, sim);
    const wheels = rig.wheels;
    if (!wheels.length) return { skip: 'no wheels to roll on (floats)' };
    const AX = sim.axes(), xA = AX[0], yU = AX[1];
    let nx = -xA[0], nz = -xA[2];
    const nl = Math.hypot(nx, nz);
    if (!(nl > 1e-6)) return { skip: 'no heading' };
    nx /= nl; nz /= nl;
    const lx = -nz, lz = nx;
    const vz = [xA[1] * yU[2] - xA[2] * yU[1], xA[2] * yU[0] - xA[0] * yU[2], xA[0] * yU[1] - xA[1] * yU[0]];   // poseModel's vZ
    const cg = rig.cg || [0, 0, 0];
    // THE STAND: the main wheels' contact midpoint (the pivot a taxiing aeroplane turns about) and the nose's heading
    let mx = 0, my = 0, mz = 0, nm = 0;
    for (const w of wheels) if (Math.abs((w.x - cg[0]) * lx + (w.z - cg[2]) * lz) > 0.2) { mx += w.x; my += w.y - w.R; mz += w.z; nm++; }
    if (!nm) for (const w of wheels) { mx += w.x; my += w.y - w.R; mz += w.z; nm++; }
    const P1 = [mx / nm, my / nm, mz / nm], psi1 = Math.atan2(nz, nx);
    let a3 = null;                                       // the third wheel, metres ahead (+) of the mains along the nose
    for (const w of wheels) if (Math.abs((w.x - cg[0]) * lx + (w.z - cg[2]) * lz) <= 0.2) { a3 = (w.x - P1[0]) * nx + (w.z - P1[2]) * nz; break; }
    const ext = drawnExtent(craft, P1, nx, nz);
    // THE SHED: its room frame in the world (door plane at local doorAxis * HD, the slab at local y 0)
    shed.node.updateMatrixWorld(true);
    const M = shed.node.matrixWorld.clone(), Mi = M.clone().invert();
    const dm = shed.dims, axis = shed.doorAxis || -1, dr = shed.door || {};
    const room = { x0: axis * dm.HD, x1: -axis * dm.HD, zc: 0, HW: dm.HW, EAVE: dm.EAVE, floorY: 0, axis,
      doorW: dr.w > 0 ? dr.w : Math.max(6, 2 * dm.HW - 5), doorH: dr.h > 0 ? dr.h : Math.min(6.4, dm.EAVE - 1.4) };
    const vO = new THREE.Vector3(axis, 0, 0).transformDirection(M);
    const ol = Math.hypot(vO.x, vO.z), ux = vO.x / ol, uz = vO.z / ol;           // the door's outward heading
    const D0 = new THREE.Vector3(axis * dm.HD, 0, 0).applyMatrix4(M);            // the door plane's centre, on the slab
    const slabY = D0.y;
    const out1 = (P1[0] - D0.x) * ux + (P1[2] - D0.z) * uz;
    const psi0 = Math.atan2(uz, ux);
    if (Math.abs(wrap(psi1 - psi0)) > 2.6) return { skip: 'the stand faces back into the shed' };
    // THE START: the nose S.noseIn inside the door plane, on the door's axis; THE STRAIGHT: until the tail is S.wClear out
    const out0 = -(S.noseIn + ext.fwd);
    const P0 = [D0.x + ux * out0, D0.z + uz * out0];
    const Ls = Math.max(0, ext.aft + S.wClear - out0);
    const Pa = [P0[0] + ux * Ls, P0[1] + uz * Ls];
    const cx = P1[0] - Pa[0], cz = P1[2] - Pa[1], chord = Math.hypot(cx, cz), along = cx * ux + cz * uz;
    if (!(along > 3)) return { skip: 'the stand is not out in front of the door (' + out1.toFixed(1) + ' m out)' };
    if (chord > 160) return { skip: 'the stand is ' + chord.toFixed(0) + ' m from the door' };
    // THE TABLE, by arc length: the start, then the cubic's samples from the straight's end (x, z, heading, the ground
    // under the mains less the stand's)
    const hh = S.wHandle * chord, NC = 96, N = NC + 2;
    const TX = new Float64Array(N), TZ = new Float64Array(N), TS = new Float64Array(N), TP = new Float64Array(N), TY = new Float64Array(N);
    const gAt = (x, z) => {
      const inside = (x - D0.x) * ux + (z - D0.z) * uz < 0;   // behind the door plane: the slab
      if (inside) return slabY;
      if (typeof o.ground !== 'function') return P1[1];
      const g = +o.ground(x, z); return Number.isFinite(g) ? g : P1[1];
    };
    TX[0] = P0[0]; TZ[0] = P0[1]; TS[0] = 0; TP[0] = psi0;
    const B = [Pa[0], Pa[1], Pa[0] + ux * hh, Pa[1] + uz * hh, P1[0] - nx * hh, P1[2] - nz * hh, P1[0], P1[2]];
    let prevPsi = psi0;
    for (let i = 0; i <= NC; i++) {
      const u = i / NC, a = (1 - u) * (1 - u) * (1 - u), b = 3 * (1 - u) * (1 - u) * u, c = 3 * (1 - u) * u * u, d = u * u * u;
      const x = a * B[0] + b * B[2] + c * B[4] + d * B[6], z = a * B[1] + b * B[3] + c * B[5] + d * B[7];
      // the tangent (the heading), unwrapped against the last sample
      const da = -3 * (1 - u) * (1 - u), db = 3 * (1 - u) * (1 - u) - 6 * (1 - u) * u, dc = 6 * (1 - u) * u - 3 * u * u, dd = 3 * u * u;
      const tx = da * B[0] + db * B[2] + dc * B[4] + dd * B[6], tz = da * B[1] + db * B[3] + dc * B[5] + dd * B[7];
      let ps = Math.hypot(tx, tz) > 1e-9 ? Math.atan2(tz, tx) : prevPsi;
      ps = prevPsi + wrap(ps - prevPsi); prevPsi = ps;
      const k = i + 1;
      TX[k] = x; TZ[k] = z; TP[k] = ps;
      TS[k] = i === 0 ? Ls : TS[k - 1] + Math.hypot(x - TX[k - 1], z - TZ[k - 1]);
    }
    TX[N - 1] = P1[0]; TZ[N - 1] = P1[2];
    TP[N - 1] = prevPsi + wrap(psi1 - prevPsi);          // the stand's own heading, exactly (on the unwrapped branch)
    const gRef = gAt(P1[0], P1[2]);
    for (let k = 0; k < N; k++) TY[k] = gAt(TX[k], TZ[k]) - gRef;
    TY[N - 1] = 0;
    const L = TS[N - 1], T = worldTiming(L);
    // the sill: the mains cross the door plane at s = -out0 (on the straight), a third wheel a3 ahead of them earlier
    const sMain = -out0, sThird = a3 == null ? null : Math.max(0, -out0 - a3);
    // (advance's fields: T, L, sMain, sThird, xThird, thirdSign, ax - its pitch about vz, tail up for +, as the shed's)
    const W = { skip: null, world: true, rig, wheels, P1, psi1: TP[N - 1], psi0, vz, cg, ext, room, M, Mi, D0: [D0.x, D0.y, D0.z], ux, uz,
      L, T, Ls, TX, TZ, TS, TP, TY, N, sMain, sThird, xThird: a3, thirdSign: a3 != null && a3 > 0 ? -1 : 1, ax: -1,
      end, out0, out1, check: { T: 0, segs: [], drives: [], ctl: null } };
    W.Ttotal = T.T;
    W.eye0 = worldEye(W, o);                            // THE ESTABLISHING EYE
    return W;
  }
  // the path at arc length s into out[0..3]: x, z, heading, ground; ix[0] the table's index (the roll only goes forward)
  function pathAt(W, s, ix, out) {
    const TS = W.TS, N = W.N;
    let i = ix[0];
    if (i > 0 && TS[i] > s) i = 0;
    while (i < N - 2 && TS[i + 1] < s) i++;
    ix[0] = i;
    const s0 = TS[i], s1 = TS[i + 1], f = s1 > s0 ? (s - s0) / (s1 - s0) : 0, g = f < 0 ? 0 : f > 1 ? 1 : f;
    out[0] = W.TX[i] + (W.TX[i + 1] - W.TX[i]) * g;
    out[1] = W.TZ[i] + (W.TZ[i + 1] - W.TZ[i]) * g;
    out[2] = W.TP[i] + (W.TP[i + 1] - W.TP[i]) * g;
    out[3] = W.TY[i] + (W.TY[i + 1] - W.TY[i]) * g;
    return out;
  }
  // the eye's blend weight at time t (held, then eased)
  function eyeW(W, t) { let u = (t / W.T.T - S.wLag) / (1 - S.wLag); u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * u * (u * (u * 6 - 15) + 10); }
  // THE ESTABLISHING EYE: candidates outside the door in the shed's frame, judged along the whole roll (40 steps): clear of
  // the aeroplane's footprint, outside the building, over the ground, the aeroplane's CG in sight past the walls; the
  // fewest faults, then the shortest dolly to the flight's eye and a view near 13 m out, 9 m aside
  function worldEye(W, o) {
    const e1 = W.end.eye, room = W.room, M = W.M, Mi = W.Mi, ext = W.ext, mg = S.wMargin;
    const v = new THREE.Vector3(), ix = new Int32Array(1), pa = [0, 0, 0, 0];
    const gnd = (x, z) => { const g = typeof o.ground === 'function' ? +o.ground(x, z) : NaN; return Number.isFinite(g) ? g : W.P1[1]; };
    v.set(e1[0], e1[1], e1[2]).applyMatrix4(Mi);
    const side1 = v.z < 0 ? -1 : 1;                      // the side of the door's axis the flight's eye is on
    const len = Math.abs(room.x1 - room.x0);
    let best = null;
    for (const u of [10, 13, 16, 20]) for (const lat of [6, 9, 12, 15]) for (const sd of [side1, -side1]) for (const hg of [1.7, 2.6]) {
      v.set(room.x0 + room.axis * u, 0, sd * lat).applyMatrix4(M);
      const E0 = [v.x, gnd(v.x, v.z) + hg, v.z];
      let bad = 0;
      const n = 40;
      for (let k = 0; k <= n && bad < 1000; k++) {
        const t = W.T.T * k / n, w = eyeW(W, t), s = rollS(W.T, W.L, t);
        const ex = E0[0] + (e1[0] - E0[0]) * w, ey = E0[1] + (e1[1] - E0[1]) * w, ez = E0[2] + (e1[2] - E0[2]) * w;
        pathAt(W, s, ix, pa);
        const px = pa[0], pz = pa[1], ps = pa[2], nx = Math.cos(ps), nz = Math.sin(ps);
        // the footprint (and over it: the aeroplane's height)
        const rx = ex - px, rz = ez - pz, f = rx * nx + rz * nz, l = Math.abs(-rx * nz + rz * nx);
        if (f < ext.fwd + mg && f > -ext.aft - mg && l < ext.half + mg && ey < W.P1[1] + pa[3] + ext.top + mg) bad++;
        if (ey < gnd(ex, ez) + 0.5) bad++;
        // the building: the eye outside it; the line to the CG through no wall (the last 3 m are the aeroplane's)
        v.set(ex, ey, ez).applyMatrix4(Mi);
        const qx = v.x, qy = v.y, qz = v.z, uIn = (qx - room.x0) * -room.axis;
        // (0.3 m: under the host's own keepOutOfShed margin, camera.near + 0.35 - the flight's eye it ends on is always legal)
        if (uIn > -0.3 && uIn < len + 0.3 && Math.abs(qz) < room.HW + 0.3 && qy < room.EAVE + 3) bad += 10;
        // the CG now: the stand's CG turned by the path's heading about the mains and carried to the path's point
        const a = ps - W.psi1, ca = Math.cos(a), sa = Math.sin(a), gx = W.cg[0] - W.P1[0], gz = W.cg[2] - W.P1[2];
        v.set(px + gx * ca - gz * sa, W.cg[1] + pa[3], pz + gx * sa + gz * ca).applyMatrix4(Mi);
        const dl = Math.hypot(v.x - qx, v.y - qy, v.z - qz), ns = Math.max(2, Math.ceil(dl / 0.5));
        for (let i = 1; i < ns; i++) {
          const fr = i / ns;
          if (dl * (1 - fr) < 3) break;
          if (inWall(room, qx + (v.x - qx) * fr, qy + (v.y - qy) * fr, qz + (v.z - qz) * fr)) { bad++; break; }
        }
      }
      const cost = bad * 1000 + Math.hypot(e1[0] - E0[0], e1[1] - E0[1], e1[2] - E0[2]) + (sd === side1 ? 0 : 4)
        + 0.4 * Math.abs(u - 13) + 0.4 * Math.abs(lat - 9);
      if (!best || cost < best.cost) best = { eye: E0, bad, cost, u, lat, side: sd, h: hg };
    }
    return best;
  }
  function playWorld(o) {
    o = o || {};
    const onDone = typeof o.onDone === 'function' ? o.onDone : () => {};
    if (active) active.cancel();
    const dead = (why) => { const h = { done: true, world: true, skipped: why, plan: null, cancel() {}, skip() {}, tick() { return false; } };
      try { onDone(h); } catch (e) { if (typeof console !== 'undefined') console.error('ROLLANIM onDone:', e); } return h; };
    if (o.skip === true) return dead('asked to skip');
    let W;
    try { W = worldPlan(o); } catch (e) { if (typeof console !== 'undefined') console.warn('ROLLANIM world plan:', e && e.message); return dead('no plan: ' + (e && e.message)); }
    if (W.skip) return dead(W.skip);
    const craft = o.craft, cam = o.camera, contact = o.contact || null;
    const P1 = W.P1, vz = W.vz, e0 = W.eye0.eye, e1 = W.end.eye, l1 = W.end.look, cg = W.cg;
    const Wh = W.wheels.filter(w => w.obj && w.obj.rotation);
    const wObj = Wh.map(w => w.obj), wR = Wh.map(w => Math.max(0.05, w.R)), wSpun = new Float64Array(Wh.length);
    const propRpm = W.rig.propRpm;
    const eyeV = new THREE.Vector3(), lookV = new THREE.Vector3();
    // the clock and the roll (advance's slots; [9] the spool's clock: the check spooled the prop already)
    const st = new Float64Array(10); st[3] = st[4] = NaN; st[9] = 10;
    const ix = new Int32Array(1), PA = new Float64Array(4), QQ = new Float64Array(4);
    let fin = false;
    if (W.end.fov > 0 && cam.fov !== W.end.fov) { cam.fov = W.end.fov; cam.updateProjectionMatrix(); }
    const h = {
      done: false, world: true, skipped: null, plan: W, spun: wSpun,
      get t() { return st[0]; }, get rolled() { return st[1]; }, get tCheck() { return 0; }, get phase() { return h.done ? 'done' : 'roll'; },
      tick, cancel, skip, _cam: applyCam,
    };
    // the aeroplane's pose at the roll's state: the stand's pose turned about its mains (the heading about y, then the
    // settle about the stand's lateral axis vz) and carried to the path's point - written out, no double handed to a call
    function place(ended) {
      if (ended) {
        craft.position.set(0, 0, 0); craft.quaternion.set(0, 0, 0, 1); QQ[0] = QQ[1] = QQ[2] = 0; QQ[3] = 1;
        if (contact) { contact.position.set(0, 0, 0); contact.quaternion.set(0, 0, 0, 1); }
        return;
      }
      pathAt(W, st[1], ix, PA);
      const a = W.psi1 - PA[2], th = st[7];
      const y1 = Math.sin(a / 2), w1 = Math.cos(a / 2), sh = Math.sin(th / 2), w2 = Math.cos(th / 2);
      const x2 = vz[0] * sh, y2 = vz[1] * sh, z2 = vz[2] * sh;
      const qx = w1 * x2 + y1 * z2, qy = w1 * y2 + y1 * w2, qz = w1 * z2 - y1 * x2, qw = w1 * w2 - y1 * y2;
      QQ[0] = qx; QQ[1] = qy; QQ[2] = qz; QQ[3] = qw;
      // q . P1 (v + 2w (q x v) + 2 q x (q x v))
      const vx = P1[0], vy = P1[1], vw = P1[2];
      const tx = 2 * (qy * vw - qz * vy), ty = 2 * (qz * vx - qx * vw), tz = 2 * (qx * vy - qy * vx);
      const rx = vx + qw * tx + (qy * tz - qz * ty), ry = vy + qw * ty + (qz * tx - qx * tz), rz = vw + qw * tz + (qx * ty - qy * tx);
      const px = PA[0] - rx, py = P1[1] + PA[3] + st[6] - ry, pz = PA[1] - rz;
      craft.quaternion.set(qx, qy, qz, qw); craft.position.set(px, py, pz);
      if (contact) { contact.quaternion.set(qx, qy, qz, qw); contact.position.set(px, py, pz); }
    }
    function frameCam(ended) {
      if (ended) { eyeV.set(e1[0], e1[1], e1[2]); lookV.set(l1[0], l1[1], l1[2]); return; }
      const w = eyeW(W, st[0]);
      eyeV.set(e0[0] + (e1[0] - e0[0]) * w, e0[1] + (e1[1] - e0[1]) * w, e0[2] + (e1[2] - e0[2]) * w);
      // the aim: the CG as the aeroplane carries it (q . cg + the offset)
      const qx = QQ[0], qy = QQ[1], qz = QQ[2], qw = QQ[3], vx = cg[0], vy = cg[1], vw = cg[2];
      const tx = 2 * (qy * vw - qz * vy), ty = 2 * (qz * vx - qx * vw), tz = 2 * (qx * vy - qy * vx);
      lookV.set(vx + qw * tx + (qy * tz - qz * ty) + craft.position.x, vy + qw * ty + (qz * tx - qx * tz) + craft.position.y,
        vw + qw * tz + (qx * ty - qy * tx) + craft.position.z);
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
      advance(W, st, dt);
      const ds = st[5], ended = st[0] >= W.T.T;
      for (let i = 0; i < wObj.length; i++) { const a = ds / wR[i]; wObj[i].rotation.z += a; wSpun[i] += a; }
      if (propRpm && st[8]) propRpm(st[2]);
      place(ended); frameCam(ended); applyCam();
      if (ended) { fin = true; Promise.resolve().then(finish); }
      return true;
    }
    function putBack() {
      place(true);
      craft.updateMatrixWorld(true);
      if (propRpm) propRpm(null);
      stopInput();
      if (active === h) active = null;
    }
    function finish() {
      if (h.done) return;
      putBack(); h.done = true;
      try { onDone(h); } catch (e) { if (typeof console !== 'undefined') console.error('ROLLANIM onDone:', e); }
    }
    function skip() {                                    // the end pose: the stand, the flight's eye
      if (h.done) return;
      h.skipped = 'skipped by the player';
      st[0] = W.T.T; st[1] = W.L; place(true); frameCam(true); applyCam();
      finish();
    }
    function cancel() { if (h.done) return; h.skipped = 'cancelled'; putBack(); h.done = true; }
    const onInput = e => { if (h.done) return; if (e.type === 'keydown' && (e.repeat || /^(Shift|Control|Alt|Meta)/.test(e.key || ''))) return;
      try { e.preventDefault(); e.stopImmediatePropagation(); } catch (x) {} skip(); };
    const win = typeof window !== 'undefined' && window.addEventListener ? window : null;
    if (win) { win.addEventListener('pointerdown', onInput, true); win.addEventListener('keydown', onInput, true); }
    function stopInput() { if (win) { win.removeEventListener('pointerdown', onInput, true); win.removeEventListener('keydown', onInput, true); } }
    active = h;
    place(false); frameCam(false);                      // the first frame's pose now: in the doorway, the establishing eye
    return h;
  }
  function worldPlanOnly(o) { return worldPlan(o || {}); }
  // THE HOST'S HOOKS (app.js frame loop): before the model is posed, and after the camera is placed
  function frame(dt) { return active ? active.tick(dt) : false; }
  function camera() {
    const h = active;
    return h && !h.done ? h._cam() : false;          // the same pose again, over the host's own placement
  }
  function plan(o) { return makePlan(o || {}); }
  const api = { S, play, playWorld, frame, camera, busy: () => !!(active && !active.done), cancel: () => { if (active) active.cancel(); }, standFraming, appRig, plan,
                world: () => !!(active && !active.done && active.world), worldPlan: worldPlanOnly, _pathAt: pathAt,
                _rollS: rollS, _timing: timing, _eyeOk: eyeOk, _inWall: inWall, _roomOf: roomOf };
  if (typeof window !== 'undefined') window.ROLLANIM = api;
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ROLLANIM;
