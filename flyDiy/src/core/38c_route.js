// ============================================================
// THE DRAWN ROUTE (G2120 ROUTE-DRAW, 2026-10-07) — pure: no sim, no THREE, no
// DOM. The user: "regarding autopilot, can we now draw a trajectory (control
// points + altitude) for the autopilots?"
//
// THE RECORD is a plain object, JSON as it stands (the save, a named library,
// the career's map screen later - claude/map-menu-g2250 - can show one as is):
//   { v: 1, id, name, end, margin, pts: [{ x, z, alt, ref, V }] }
//     x, z   world metres (the game's frame: the same numbers as aerodromes)
//     alt    the altitude asked over the point, in its `ref`
//     ref    'msl' (over the datum) | 'agl' (over the ground under the point)
//     V      the indicated airspeed asked on the leg INTO the point (m/s), or
//            null: the aeroplane's cruise
//     end    what the pilot does past the last point: 'hold' (orbits it at its
//            altitude), 'home' (flies back to the field it left and lands off
//            its circuit), 'land' (the nearest strip this gear may use)
//     margin the terrain clearance the profile is judged against (m)
//
// THE PROFILE (routeProfile) is what the pilot will fly, vertically, and it is
// PILOT-PROFILE's planner's (G2125, 44_vprofile.js VPROFILE.plan, 'drawn' mode -
// A0's ruling: one altitude planner, ROUTE-DRAW uses it): the drawing's ramp
// point to point, raised to each leg's minimum en-route altitude (the tallest
// thing across a 600 m corridor along the leg and 1.5 km past its end + the
// route's margin), its climbs moved earlier, its descents held. routeVPerf is
// the one set of numbers the strip and the pilot hand it. The verdicts drawn on
// the strip: the DRAWING under the margin (red), a leg whose gradient asks a
// climb or a descent past the aeroplane's planned limits at its speed
// (routePerf: a share of the sheet's measured climb, of the descent TECS will
// ask), a point the plan flies higher than drawn - "a point it can't make is
// flagged at drawing time, not discovered in flight".
//
// 43_pilot.js ap.flyRoute flies it: the legs filleted at the turn radius (the
// fly-by), the plan read a few seconds ahead (the gradient as feed-forward),
// the TECS limits on top; 38_nav.js is the AP box's navigator and is untouched.
// ============================================================
const ROUTE_V = 1;
const ROUTE_MARGIN = 60;          // m: the clearance a drawn profile keeps over the ground (and the trees)
const ROUTE_AGL_DEFAULT = 150;    // m: a new point's height over the highest ground about it
const ROUTE_SAFE_R = 500;         // m: the ground looked at about a new point for that default
const ROUTE_MAX_PTS = 24;
const ROUTE_ENDS = ['hold', 'home', 'land'];
const ROUTE_CLIMB_K = 0.70;       // the share of the measured climb a drawn climb may ask (the cruise speed, the day, the wind)
const ROUTE_SINK_K = 0.80;        // the share of TECS's descent limit a drawn descent may ask

function routeGroundAt(world, x, z, trees) {
  if (!world || typeof world.terrainH !== 'function') return 0;
  let h = world.terrainH(x, z);
  if (typeof world.waterH === 'function') { const w = world.waterH(x, z); if (w > h) h = w; }
  if (trees && typeof world.canopyH === 'function') h += world.canopyH(x, z, 20) || 0;
  return h;
}
// a new point's default: ROUTE_AGL_DEFAULT over the highest ground within ROUTE_SAFE_R (two rings and the
// centre), rounded up to 10 m - MSL
function routeSafeAlt(world, x, z) {
  let top = routeGroundAt(world, x, z, true);
  for (const r of [ROUTE_SAFE_R / 2, ROUTE_SAFE_R])
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; top = Math.max(top, routeGroundAt(world, x + r * Math.cos(a), z + r * Math.sin(a), true)); }
  return Math.ceil((top + ROUTE_AGL_DEFAULT) / 10) * 10;
}
function routeAltMSL(pt, world) {
  if (!pt) return null;
  return pt.ref === 'agl' ? routeGroundAt(world, pt.x, pt.z, false) + pt.alt : pt.alt;
}
// the point's reference changed, its MSL altitude kept
function routeSetRef(pt, ref, world) {
  if (!pt || (ref !== 'msl' && ref !== 'agl') || pt.ref === ref) return pt;
  const h = routeAltMSL(pt, world);
  pt.ref = ref;
  pt.alt = Math.round(ref === 'agl' ? h - routeGroundAt(world, pt.x, pt.z, false) : h);
  return pt;
}
let routeSeq = 0;
function routeNew(name) {
  routeSeq++;
  return { v: ROUTE_V, id: 'r' + Date.now().toString(36) + routeSeq, name: name || 'Route', end: 'hold', margin: ROUTE_MARGIN, pts: [] };
}
// a point added at (x, z): its default altitude (MSL, or the same height over the ground when `ref` is agl)
function routeAddPt(route, world, x, z, at, ref) {
  if (!route || route.pts.length >= ROUTE_MAX_PTS) return null;
  ref = ref === 'agl' ? 'agl' : 'msl';
  const h = routeSafeAlt(world, x, z);
  const pt = { x: Math.round(x), z: Math.round(z), alt: ref === 'agl' ? Math.round(h - routeGroundAt(world, x, z, false)) : h, ref, V: null };
  const i = (at == null || at < 0 || at > route.pts.length) ? route.pts.length : at;
  route.pts.splice(i, 0, pt);
  return pt;
}
// a record from anywhere (the save, the library, a page message) made sound, or null
function routeNormalise(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.pts)) return null;
  const num = (v, a, b) => Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : null;
  const pts = [];
  for (const p of r.pts) {
    if (!p || !Number.isFinite(+p.x) || !Number.isFinite(+p.z) || !Number.isFinite(+p.alt)) continue;
    const V = p.V == null || p.V === '' ? null : num(p.V, 5, 150);
    pts.push({ x: +p.x, z: +p.z, alt: num(p.alt, -100, 6000), ref: p.ref === 'agl' ? 'agl' : 'msl', V: V > 0 ? V : null });
    if (pts.length >= ROUTE_MAX_PTS) break;
  }
  return { v: ROUTE_V, id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : routeNew().id,
           name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : 'Route',
           end: ROUTE_ENDS.includes(r.end) ? r.end : 'hold',
           margin: num(r.margin, 10, 500) || ROUTE_MARGIN, pts };
}

// THE AEROPLANE'S PLANNED LIMITS from its machine sheet (44_machine_sheet.js) and its genAP numbers (def.params.ap):
// what a drawn leg may ask. climb: ROUTE_CLIMB_K of the measured best climb; sink: ROUTE_SINK_K of the descent TECS is
// clamped to (43_pilot.js tecs: max(3, 1.5 x the best-glide sink)); vsUp / vsDn the law's own clamps (what the
// strip draws as "the limit"); V the cruise, Vmin / Vmax the speeds a point may ask; R the turn radius at the cruise
// on the pilot's bank (the fly-by's size, for the capture radius)
function routePerf(sheet, A, bankLim) {
  A = A || {};
  const S = sheet || {};
  const climbMax = Math.max(0.5, S.climbMax != null ? S.climbMax : (A.VClimb || 20) * 0.08);
  const sinkIdle = Math.max(0.8, S.sinkBg != null ? S.sinkBg : (A.VAppr || 20) * 0.09);
  const vsDn = -Math.max(3.0, 1.5 * sinkIdle);
  const V = A.VCruise || S.Vcruise || 30;
  const Vmin = Math.max(A.VAppr || 0, S.Vs0 ? 1.25 * S.Vs0 : 0, 0.6 * V);
  const b = bankLim || 0.30;
  return { climb: ROUTE_CLIMB_K * climbMax, sink: ROUTE_SINK_K * -vsDn, vsUp: climbMax, vsDn, V, Vmin, Vmax: 1.25 * V, bank: b,
           R: V * V / (9.81 * Math.tan(b)) };
}
const routeSpeedOf = (pt, perf) => (pt && pt.V != null) ? Math.max(perf.Vmin, Math.min(perf.Vmax, pt.V)) : perf.V;
// the capture radius of point i: the fly-by's own miss at that corner (R (1/cos(t/2) - 1), the turn of t rad at
// the turn radius at the point's speed) plus 80 m, at least 150 m; the last point (no corner) 150 m
function routeCaptureR(route, i, perf) {
  const P = route.pts, p = P[i], a = P[i - 1], b = P[i + 1];
  if (!p || !a || !b) return 150;
  const u1 = Math.atan2(p.z - a.z, p.x - a.x), u2 = Math.atan2(b.z - p.z, b.x - p.x);
  const t = Math.abs(Math.atan2(Math.sin(u2 - u1), Math.cos(u2 - u1)));
  const V = Math.min(routeSpeedOf(p, perf), routeSpeedOf(b, perf));
  const R = V * V / (9.81 * Math.tan(perf.bank || 0.30)) * 1.15;
  return Math.max(150, R * (1 / Math.cos(Math.min(t, 2.6) / 2) - 1) + 80);
}

// THE PLANNER'S NUMBERS for a route (G2125 PILOT-PROFILE owns the one altitude planner, 44_vprofile.js; A0's ruling:
// ROUTE-DRAW uses it, no second planner). The strip (routeProfile) and the pilot (43_pilot.js routeStart) hand
// VPROFILE.plan the SAME numbers, so what the strip shows is what is flown: the route's margin over what stands under
// the corridor, the climb and the descent at the plan limits' gradients at the cruise
function routeVPerf(route, perf, h0) {
  const g = (vs, V) => Math.max(0.01, vs / Math.max(10, V));
  return { h0, margin: (route && route.margin) || ROUTE_MARGIN, gClimb: g(perf.climb, perf.V), gDesc: g(perf.sink, perf.V), gDescMax: g(perf.sink, perf.V) };
}
// the route as VPROFILE.plan's legs: from `from` ({ x, z, h }) to WP1 (none: the route begins AT WP1), then point to
// point, each carrying the drawn altitude at its end (hB, MSL) - the planner's 'drawn' mode
function routeVLegs(route, world, from) {
  const out = [];
  if (!route || !route.pts.length) return out;
  const P = route.pts;
  if (from) out.push({ name: 'WP1', A: [from.x, from.z], B: [P[0].x, P[0].z], hA: from.h, hB: routeAltMSL(P[0], world), i: 0 });
  for (let k = 1; k < P.length; k++) out.push({ name: 'WP' + (k + 1), A: [P[k - 1].x, P[k - 1].z], B: [P[k].x, P[k].z], hB: routeAltMSL(P[k], world), i: k });
  if (!from) { if (out.length) out[0].hA = routeAltMSL(P[0], world); else out.push({ name: 'WP1', A: [P[0].x, P[0].z], B: [P[0].x + 1, P[0].z], hA: routeAltMSL(P[0], world), hB: routeAltMSL(P[0], world), i: 0 }); }
  return out;
}

// THE PROFILE, as VPROFILE.plan has it: from `from` ({ x, z, h } - the departure field before the start, the aeroplane
// in the air, the route's join while it is flown; none: from WP1). -> { pts: [{ x, z, h (drawn), hPlan (flown), g, d,
//   V, grad, vs, ok, why }], samples: [{ d, x, z, g (the tallest thing the planner sees across the corridor: terrain,
//   water, trees, houses), h (the DRAWN line), hPlan (the planned line - the drawing raised to each leg's minimum
//   en-route altitude, its climbs moved earlier, its descents held), clr (drawn - g), join }], len, minClr,
//   conflicts: [{ d0, d1, min }], unsafe, steep: [i], raised: [i], climbLimited, ok, warnings: [], plan }
// THE VERDICTS, drawn: the DRAWING under the margin (red - the planner flies it higher, said), a leg whose gradient
// asks a climb / descent past the plan limits at its speed (steep), a point the plan cannot fly at its drawn altitude
// (raised: more than 15 m over it), the start's climb short of the floor (climbLimited)
function routeProfile(route, world, opts) {
  opts = opts || {};
  const perf = opts.perf || routePerf(null, null);
  const margin = (route && route.margin) || ROUTE_MARGIN;
  const out = { pts: [], samples: [], len: 0, minClr: Infinity, conflicts: [], unsafe: false, steep: [], raised: [], climbLimited: null,
                ok: true, warnings: [], margin, plan: null };
  if (!route || !route.pts.length || typeof VPROFILE !== 'object') return out;
  const legs = routeVLegs(route, world, opts.from);
  const h0 = legs.length ? legs[0].hA : routeAltMSL(route.pts[0], world);
  const P = VPROFILE.plan(world, legs, routeVPerf(route, perf, h0), {});
  if (!P) return out;
  out.plan = P; out.len = P.L;
  // the samples: where along the legs, the drawn ramp, the plan
  let j = 0, conf = null;
  // THE JOIN IS A CLIMB-OUT: on the leg from `from` the ground is not judged until the drawn line first clears it by
  // the margin - a take-off is not a terrain conflict (its gradient is judged, and the plan's climbLimited)
  let joining = !!opts.from;
  for (let i = 0; i < P.n; i++) {
    const si = P.s[i];
    while (j < P.legs.length - 1 && si > P.legs[j].s1) j++;
    const Lg = legs[j], PL = P.legs[j], f = PL.len > 1e-6 ? Math.max(0, Math.min(1, (si - PL.s0) / PL.len)) : 1;
    const hd = Lg.hA != null && j === 0 ? Lg.hA + (Lg.hB - Lg.hA) * f : (j ? legs[j - 1].hB : Lg.hB) + (Lg.hB - (j ? legs[j - 1].hB : Lg.hB)) * f;
    const x = Lg.A[0] + (Lg.B[0] - Lg.A[0]) * f, z = Lg.A[1] + (Lg.B[1] - Lg.A[1]) * f;
    const sm = { d: si, x, z, g: P.top[i], h: hd, hPlan: P.h[i], clr: hd - P.top[i], join: false };
    if (joining && j > 0) joining = false;
    if (joining && sm.clr >= margin) joining = false;
    sm.join = joining;
    out.samples.push(sm);
    if (joining) continue;
    if (sm.clr < out.minClr) out.minClr = sm.clr;
    if (sm.clr < margin) { if (!conf) conf = { d0: si, d1: si, min: sm.clr }; conf.d1 = si; conf.min = Math.min(conf.min, sm.clr); }
    else if (conf) { out.conflicts.push(conf); conf = null; }
  }
  if (conf) out.conflicts.push(conf);
  // the points: the drawn altitude, the planned one there, the leg's gradient
  for (let k = 0; k < route.pts.length; k++) {
    const p = route.pts[k], h = routeAltMSL(p, world);
    const li = legs.findIndex(Lg => Lg.i === k), PL = li >= 0 ? P.legs[li] : null;
    const d = PL ? PL.s1 : 0;
    const prevH = li > 0 ? legs[li - 1].hB : (li === 0 && legs[0].hA != null && opts.from ? legs[0].hA : h);
    const L = PL ? PL.len : 0, V = routeSpeedOf(p, perf);
    const grad = L > 1 && (k > 0 || opts.from) ? (h - prevH) / L : 0, vs = grad * V;
    const hPlan = VPROFILE.at(P, d);
    const Q = { x: p.x, z: p.z, h, hPlan, g: routeGroundAt(world, p.x, p.z, false), d, V, grad, vs, ok: true, why: '' };
    if (vs > perf.climb + 1e-6) { Q.ok = false; Q.why = 'climbs ' + vs.toFixed(1) + ' m/s, plan limit +' + perf.climb.toFixed(1); out.steep.push(k); }
    else if (vs < -perf.sink - 1e-6) { Q.ok = false; Q.why = 'descends ' + (-vs).toFixed(1) + ' m/s, plan limit -' + perf.sink.toFixed(1); out.steep.push(k); }
    if (hPlan - h > 15) { Q.ok = false; Q.why = (Q.why ? Q.why + '; ' : '') + 'flown at ' + Math.round(hPlan) + ' m: the leg\'s minimum en-route altitude ' + (PL ? Math.round(P.legs[li].mea) : '?') + ' m'; out.raised.push(k); }
    out.pts.push(Q);
  }
  out.unsafe = out.conflicts.length > 0;
  out.climbLimited = P.climbLimited;
  if (out.unsafe) out.warnings.push('TERRAIN: the drawn profile clears what stands under it by ' + Math.max(-999, Math.round(out.minClr)) + ' m (margin ' + margin + ') - the pilot flies it higher');
  for (let k = 0; k < out.pts.length; k++) if (!out.pts[k].ok) out.warnings.push('WP' + (k + 1) + ' ' + out.pts[k].why);
  if (P.climbLimited && opts.from) out.warnings.push('the climb from the start cannot make the floor ' + P.climbLimited.need + ' m by ' + (P.climbLimited.s / 1000).toFixed(1) + ' km');
  out.ok = !out.unsafe && !out.steep.length && !out.raised.length;
  return out;
}

// THE LEGS the pilot flies: one into each point, named WP1..WPn, A = the previous point (null for the first: the
// pilot joins from where it is), the altitude asked at B (MSL), the ground under B, the speed (m/s, or null)
function routeLegs(route, world) {
  const out = [];
  if (!route) return out;
  route.pts.forEach((p, i) => {
    const prev = route.pts[i - 1];
    out.push({ name: 'WP' + (i + 1), i, A: prev ? [prev.x, prev.z] : null, B: [p.x, p.z], hB: routeAltMSL(p, world),
               gB: Math.round(routeGroundAt(world, p.x, p.z, false)), V: p.V != null ? p.V : null, drawn: true });
  });
  return out;
}
