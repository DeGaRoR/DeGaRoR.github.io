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
// THE PROFILE (routeProfile) is what the pilot will fly, vertically: a
// straight gradient from each point's altitude to the next (the first leg from
// where the route is joined), the ground under it sampled every ROUTE_DS, and
// two verdicts drawn on the strip - the clearance under the margin (red), and
// a leg whose gradient asks a climb or a descent past the aeroplane's planned
// limits at its speed (routePerf: a share of the sheet's measured climb, of
// the descent TECS will ask) - "a point it can't make is flagged at drawing
// time, not discovered in flight".
//
// 43_pilot.js ap.flyRoute flies it: the legs filleted at the turn radius (the
// fly-by), the altitude the profile's at the point a few seconds ahead (the
// gradient as feed-forward), the TECS limits on top; 38_nav.js is the AP box's
// navigator and is untouched.
// ============================================================
const ROUTE_V = 1;
const ROUTE_MARGIN = 60;          // m: the clearance a drawn profile keeps over the ground (and the trees)
const ROUTE_AGL_DEFAULT = 150;    // m: a new point's height over the highest ground about it
const ROUTE_SAFE_R = 500;         // m: the ground looked at about a new point for that default
const ROUTE_MAX_PTS = 24;
const ROUTE_DS = 50;              // m: the profile's sampling along the legs
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

// THE PROFILE: from `from` ({ x, z, h } - where the route is joined, MSL; null = the first point), along the
// straight legs. -> { pts: [{ x, z, h, g, d, V, grad, vs, ok, why }], samples: [{ d, g, h, clr }], len, minClr,
//   conflicts: [{ d0, d1, min }], unsafe, steep: [i], ok, warnings: [] }
// `pts[i].vs` is the vertical speed the leg into point i asks at its speed (m/s); `why` says what it cannot make
function routeProfile(route, world, opts) {
  opts = opts || {};
  const perf = opts.perf || routePerf(null, null);
  const margin = (route && route.margin) || ROUTE_MARGIN;
  const out = { pts: [], samples: [], len: 0, minClr: Infinity, conflicts: [], unsafe: false, steep: [], ok: true, warnings: [], margin };
  if (!route || !route.pts.length) return out;
  const node = [];
  if (opts.from) node.push({ x: opts.from.x, z: opts.from.z, h: opts.from.h, from: true });
  for (const p of route.pts) node.push({ x: p.x, z: p.z, h: routeAltMSL(p, world), p });
  let d = 0, conf = null;
  const ds = opts.ds || ROUTE_DS;
  // THE JOIN IS A CLIMB-OUT: on the leg from `from` (the field, the aeroplane) the ground is not judged until the
  // line first clears it by the margin - a take-off is not a terrain conflict; the gradient still is judged
  let joining = !!opts.from;
  const push = s => {
    if (joining && s.clr >= margin) joining = false;
    s.join = joining;
    out.samples.push(s);
    if (joining) return;
    if (s.clr < out.minClr) out.minClr = s.clr;
    if (s.clr < margin) { if (!conf) conf = { d0: s.d, d1: s.d, min: s.clr }; conf.d1 = s.d; conf.min = Math.min(conf.min, s.clr); }
    else if (conf) { out.conflicts.push(conf); conf = null; }
  };
  for (let k = 0; k < node.length; k++) {
    const n = node[k], prev = node[k - 1];
    const g = routeGroundAt(world, n.x, n.z, false);
    if (prev) {
      const L = Math.hypot(n.x - prev.x, n.z - prev.z), m = Math.max(1, Math.ceil(L / ds));
      for (let j = 1; j <= m; j++) {
        const f = j / m, x = prev.x + (n.x - prev.x) * f, z = prev.z + (n.z - prev.z) * f;
        const gg = routeGroundAt(world, x, z, true), h = prev.h + (n.h - prev.h) * f;
        push({ d: d + L * f, x, z, g: gg, h, clr: h - gg });
      }
      d += L;
      joining = false;
    } else push({ d: 0, x: n.x, z: n.z, g: routeGroundAt(world, n.x, n.z, true), h: n.h, clr: n.h - routeGroundAt(world, n.x, n.z, true) });
    if (!n.p) continue;
    const V = routeSpeedOf(n.p, perf);
    const L = prev ? Math.hypot(n.x - prev.x, n.z - prev.z) : 0;
    const grad = prev && L > 1 ? (n.h - prev.h) / L : 0;
    const vs = grad * V;
    const P = { x: n.x, z: n.z, h: n.h, g, d, V, grad, vs, ok: true, why: '' };
    if (vs > perf.climb + 1e-6) { P.ok = false; P.why = 'climbs ' + vs.toFixed(1) + ' m/s, plan limit +' + perf.climb.toFixed(1); }
    else if (vs < -perf.sink - 1e-6) { P.ok = false; P.why = 'descends ' + (-vs).toFixed(1) + ' m/s, plan limit -' + perf.sink.toFixed(1); }
    if (!P.ok) { out.steep.push(out.pts.length); out.ok = false; }
    out.pts.push(P);
  }
  if (conf) out.conflicts.push(conf);
  out.len = d;
  out.unsafe = out.conflicts.length > 0;
  if (out.unsafe) { out.ok = false; out.warnings.push('TERRAIN: the profile clears the ground by ' + Math.max(-999, Math.round(out.minClr)) + ' m (margin ' + margin + ')'); }
  for (const i of out.steep) out.warnings.push('WP' + (i + 1) + ' ' + out.pts[i].why);
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
