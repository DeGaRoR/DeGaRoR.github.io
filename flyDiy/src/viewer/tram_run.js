// tram_run.js — THE TRAM MOVES (G351, the user: "IRL the cabin will remain
// hanging vertically ... and the 'wheeled' part follows the tangent of the
// cable ... we should represent them in opposite movement: one is up when
// the other is down, they move together in opposite direction ... write the
// movement script").
//
// The contract is futureDesigns/TRAM-MOTION-2026-09-13.md: the stations
// publish their hooks, the village solves the line (VILLAGE_GEN.tramLine ->
// vil.tram = { ropes, docks, slots }), and this module owes three things:
//
//   THE ROPE AS A CURVE  `ropeCurve(a, b, k, t0, t1)`: the chord from the
//   base saddle `a` to the top saddle `b`, with a parabolic sag of k times
//   the span hung BETWEEN THE TWO DOCKS (t0..t1) and none outside them - the
//   few metres from a saddle to its dock stay on the chord, so a cabin sits
//   in its dock exactly where the station built the dock, and the same
//   function draws the rope and carries the cabin, so the wheels never
//   leave it.
//
//   THE POSE  `pose(rope, t, yaw, cab)`: the carriage's contact line ON the
//   rope at t; the cabin's pivot (the pin through the hanger's head, from
//   cabin.js) `ropeUp` UNDER it along the rope's normal - the wheels ride on
//   top of the rope, the pin hangs beneath the carriage; the cabin
//   hanging PLUMB from the pivot with its yaw fixed (a jig-back cabin never
//   turns round); and the carriage PITCHED about the pivot to the rope's
//   tangent (rotation.x in the cabin's frame).
//
//   THE JIG-BACK  `make(tram, cabs, opts)`: two cabins on two lines tied by
//   one haul loop - cabin 0 climbs line 0 while cabin 1 comes down line 1,
//   one scalar s in [0, 1] drives both; a trapezoid of speed (accel, vmax)
//   over the run, a dwell at each end, the direction flipping at each dwell.
//   `tick(dt)` advances the clock; `setS(s)` puts the pair anywhere; `apply()`
//   writes the poses into the THREE objects handed to `attach`. Pure math but
//   for `apply`, so the node gate runs the same code on fake objects.
(() => {
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const CAB_DEF = { pivot: [0, 7.05, 0.07], ropeUp: 0.365 };     // cabin.js's PIVOT and ROPE_UP, for a runtime without the cabin

function ropeCurve(a, b, k, t0, t1) {
  const d = sub(b, a), span = len(d), S = (k || 0) * span;
  const lo = t0 === undefined ? 0 : t0, hi = t1 === undefined ? 1 : t1, w = Math.max(1e-6, hi - lo);
  const sag = t => { const u = (t - lo) / w; return (u <= 0 || u >= 1) ? 0 : 4 * S * u * (1 - u); };
  const dsag = t => { const u = (t - lo) / w; return (u <= 0 || u >= 1) ? 0 : 4 * S * (1 - 2 * u) / w; };
  return {
    a: a.slice(), b: b.slice(), span, k: k || 0, t0: lo, t1: hi, sagMax: S,
    at: t => [a[0] + d[0] * t, a[1] + d[1] * t - sag(t), a[2] + d[2] * t],
    tangent: t => nrm([d[0], d[1] - dsag(t), d[2]]),
    // arc length between two parameters, by sampling
    arc: (ta, tb) => { let s = 0, p = [a[0] + d[0] * ta, a[1] + d[1] * ta - sag(ta), a[2] + d[2] * ta]; const n = 24; for (let i = 1; i <= n; i++) { const t = ta + (tb - ta) * i / n, q = [a[0] + d[0] * t, a[1] + d[1] * t - sag(t), a[2] + d[2] * t]; s += len(sub(q, p)); p = q; } return s; },
  };
}
// the rope's upward normal in the vertical plane through its tangent
const upNormal = T => nrm(sub([0, 1, 0], mul(T, T[1])));
// the pivot's offset from the cabin's origin, in the world, for a yaw
const pivotOff = (cab, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [cab.pivot[0] * c + cab.pivot[2] * s, cab.pivot[1], -cab.pivot[0] * s + cab.pivot[2] * c]; };

function pose(rope, t, yaw, cab) {
  const C = cab || CAB_DEF;
  const p = rope.at(t), T = rope.tangent(t), n = upNormal(T);
  const pv = sub(p, mul(n, C.ropeUp));                     // the pivot under the contact line
  const origin = sub(pv, pivotOff(C, yaw));
  const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  // rotation.x taking the level carriage's rail on to the tangent - the rail
  // runs both ways, so a cabin facing down the line reads the tangent backwards
  let ty = T[1], tz = dot(T, fwd);
  if (tz < 0) { ty = -ty; tz = -tz; }
  const pitch = -Math.atan2(ty, tz);
  return { origin, yaw, pitch, pivot: pv, contact: p, tangent: T };
}
// the parameter at which the pivot stands over a dock's centre `dockP` (the
// cabin's floor level there), on the chord - a cabin facing either way docks
// with its PIVOT on the centre, its origin a hand along the slot
function dockT(rope, dockP, yaw, cab) {
  const C = cab || CAB_DEF;
  const pv = [dockP[0], dockP[1] + C.pivot[1], dockP[2]];
  const d = sub(rope.b, rope.a), T = nrm(d), n = upNormal(T);
  const pr = add(pv, mul(n, C.ropeUp));                    // the contact line over the pivot
  return dot(sub(pr, rope.a), d) / dot(d, d);
}

function make(tram, cabs, opts) {
  const o = Object.assign({ v: 6.0, accel: 0.6, dwell: 12, sag: 0.012 }, opts || {});
  const slots = tram.slots || { base: [tram.docks[0].p, tram.docks[0].p], top: [tram.docks[1].p, tram.docks[1].p] };
  const lines = [0, 1].map(i => {
    const rp = tram.ropes.find(r => r.kind === 'track' && r.line === i) || tram.ropes[i * 2], cab = (cabs && cabs[i]) || CAB_DEF, yaw = tram.docks[i].yaw;
    const chord = ropeCurve(rp.a, rp.b, 0);
    const tB = dockT(chord, slots.base[i], yaw, cab), tT = dockT(chord, slots.top[i], yaw, cab);
    const rope = ropeCurve(rp.a, rp.b, o.sag, Math.min(tB, tT), Math.max(tB, tT));
    return { i, rope, cab, yaw, tB, tT, run: rope.arc(Math.min(tB, tT), Math.max(tB, tT)) };
  });
  const D = Math.max(1, (lines[0].run + lines[1].run) / 2);
  const R = {
    lines, D, o, s: 0, dir: 1, phase: 'dwell', wait: o.dwell, r: 0, v: 0, objs: null, time: 0,
    // s in [0, 1]: 0 = cabin 0 in the base dock and cabin 1 in the top dock; 1 = the reverse
    poses() {
      const out = [];
      for (let i = 0; i < 2; i++) {
        const L = lines[i], si = i ? 1 - R.s : R.s, t = L.tB + si * (L.tT - L.tB);
        out.push(Object.assign(pose(L.rope, t, L.yaw, L.cab), { t, line: i }));
      }
      return out;
    },
    setS(s) { R.s = Math.max(0, Math.min(1, s)); R.r = R.dir > 0 ? R.s * D : (1 - R.s) * D; return R; },
    tick(dt) {
      R.time += dt;
      if (R.phase === 'dwell') { R.wait -= dt; R.v = 0; if (R.wait <= 0) { R.phase = 'move'; R.r = 0; } return R; }
      // a trapezoid on the run: accelerate, cruise, brake to a stop at D
      const a = o.accel, vUp = Math.sqrt(2 * a * (R.r + 0.05)), vDn = Math.sqrt(2 * a * Math.max(0, D - R.r) + 0.05);
      R.v = Math.min(o.v, vUp, vDn);
      R.r += R.v * dt;
      if (R.r >= D) { R.r = D; R.phase = 'dwell'; R.wait = o.dwell; R.s = R.dir > 0 ? 1 : 0; R.dir = -R.dir; R.v = 0; return R; }
      R.s = R.dir > 0 ? R.r / D : 1 - R.r / D;
      return R;
    },
    attach(objs) { R.objs = objs; R.apply(); return R; },
    apply() {
      if (!R.objs) return R;
      const ps = R.poses();
      for (let i = 0; i < 2; i++) {
        const ob = R.objs[i], p = ps[i];
        if (!ob) continue;
        ob.position.set(p.origin[0], p.origin[1], p.origin[2]);
        ob.rotation.set(0, p.yaw, 0);
        const car = ob.userData && ob.userData.carriage;
        if (car) car.rotation.x = p.pitch;
      }
      return R;
    },
  };
  return R.setS(0);
}

const API = { ropeCurve, pose, dockT, make, upNormal, CAB_DEF };
if (typeof window !== 'undefined') window.TRAM_RUN = API;
// the node gate (and POWERLINE's cable, which takes its sag from here) reads it as a module too
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
