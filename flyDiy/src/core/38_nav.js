// ============================================================
// THE NAV (G202.1, 2026-09-06) — a GPS-style navigator, pure: no sim, no
// THREE, no DOM. The user: "did you develop unit functions that we could
// reuse? fpm, constant VS, GPS, heading, etc? ... Ultimately, we're gonna
// probably have a PFD/MFD recreation, so let's get the functions up and
// running."
//
// WHAT IT IS. A waypoint database (the aerodromes, plus anything added), a
// flight plan of legs, a direct-to, and the readouts a navigator shows:
//   DTK   desired track of the active leg          (deg)
//   TRK   the track actually flown                 (deg)
//   BRG   bearing to the active waypoint           (deg)
//   DIS   distance to the active waypoint          (m)
//   XTK   cross-track error, + = RIGHT of course   (m)
//   CDI   course deviation, -1..+1 of full scale   (+ = fly right, i.e. the
//         aeroplane is LEFT of course; the needle sits on the course side)
//   ETE   estimated time en route to the waypoint  (s), null when stopped
//   GS    ground speed                             (m/s)
// and VNAV's one number: the vertical speed that reaches a target altitude
// at the waypoint.
//
// SEQUENCING is by turn anticipation: a leg is passed R·tan(dTheta/2)
// before its corner (the pilots' own rule, 43_pilot.js navLeg), so the box
// rolls out on the next course instead of overshooting the fix. The last
// waypoint is held past its arrival (`arrived` flagged), never dropped.
//
// HEADINGS. This world has no compass; `navDeg` defines one: 0 deg = +x,
// increasing toward +z, 0..360 — the same angle the pilots steer by
// (atan2(uz, ux)), only in degrees. Every angle this file returns is in it.
// Units are SI; PILOT_UNITS (43_pilot.js) converts for a panel.
// ============================================================
const NAV_FULL_SCALE = 300;      // m, the CDI's full deflection en route

function navDeg(rad) { return ((rad * 180 / Math.PI) % 360 + 360) % 360; }
function navRad(deg) { return deg * Math.PI / 180; }
// the signed difference b - a in degrees, -180..180
function navDiff(aDeg, bDeg) { return ((bDeg - aDeg + 540) % 360) - 180; }

// the geometry of a leg A -> B seen from (x, z): unit vector, length, the
// along-track position s, the cross-track xt (+ = right of course), the
// distance still to run to B, and the desired track in degrees
function navLegGeom(A, B, x, z) {
  const dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz) || 1e-9;
  const ux = dx / len, uz = dz / len;
  const rx = x - A[0], rz = z - A[1];
  const s = rx * ux + rz * uz;
  const xt = -rx * uz + rz * ux;
  return { ux, uz, len, s, xt, rem: len - s, dtk: navDeg(Math.atan2(uz, ux)) };
}

function navMake(opts) {
  opts = opts || {};
  const N = {
    db: [], fpl: [], active: -1, origin: null, mode: 'OFF',
    fullScale: opts.fullScale || NAV_FULL_SCALE,
    last: null, arrived: false,
  };
  const asWp = w => (typeof w === 'string') ? N.find(w) : w;
  N.add = (wp) => { N.db.push({ id: wp.id, name: wp.name || wp.id, x: wp.x, z: wp.z, elev: wp.elev || 0 }); return N; };
  if (opts.waypoints) for (const w of opts.waypoints) N.add(w);
  N.find = id => N.db.find(w => w.id === id) || null;
  N.clear = () => { N.fpl = []; N.active = -1; N.origin = null; N.mode = 'OFF'; N.last = null; N.arrived = false; return N; };
  // a flight plan: waypoints (ids or {x, z}); the first leg starts at
  // `from` ({x, z}) when given, else at the first waypoint
  N.plan = (wps, from) => {
    N.clear();
    N.fpl = wps.map(asWp).filter(Boolean);
    if (!N.fpl.length) return N;
    if (from) { N.origin = { x: from.x, z: from.z }; N.active = 0; }
    else if (N.fpl.length >= 2) { N.origin = null; N.active = 1; }
    else { N.origin = null; N.active = 0; }
    N.mode = 'FPL';
    return N;
  };
  // direct to one waypoint from where the aeroplane is
  N.directTo = (wp, x, z) => {
    const w = asWp(wp);
    if (!w) return N;
    N.clear();
    N.fpl = [w]; N.origin = { x, z }; N.active = 0; N.mode = 'DTO';
    return N;
  };
  // the active leg as { A, B, to, next }, or null
  N.leg = () => {
    if (N.active < 0 || N.active >= N.fpl.length) return null;
    const to = N.fpl[N.active];
    const prev = N.active > 0 ? N.fpl[N.active - 1] : N.origin;
    if (!prev) return null;
    const next = N.fpl[N.active + 1] || null;
    return { A: [prev.x, prev.z], B: [to.x, to.z], to, next };
  };
  // one step of the navigator: sequence, then the readouts. `R` is the
  // aeroplane's turn radius for the anticipation (0 = sequence at the fix).
  N.update = (x, z, vx, vz, R) => {
    let L = N.leg();
    if (!L) { N.last = null; return null; }
    let g = navLegGeom(L.A, L.B, x, z);
    // sequencing: past the anticipation point of the corner into the next leg
    if (L.next) {
      const g2 = navLegGeom(L.B, [L.next.x, L.next.z], x, z);
      const dot = Math.max(-1, Math.min(1, g.ux * g2.ux + g.uz * g2.uz));
      const ant = (R || 0) * Math.tan(Math.min(Math.acos(dot), 2.6) / 2);
      if (g.rem <= ant) { N.active++; L = N.leg(); g = navLegGeom(L.A, L.B, x, z); }
    } else if (g.rem <= 0) N.arrived = true;
    const gs = Math.hypot(vx, vz);
    const bx = L.B[0] - x, bz = L.B[1] - z;
    const dis = Math.hypot(bx, bz);
    const trk = gs > 0.5 ? navDeg(Math.atan2(vz, vx)) : null;
    N.last = {
      to: L.to.id || null, next: L.next ? (L.next.id || null) : null,
      dtk: g.dtk, trk, brg: navDeg(Math.atan2(bz, bx)), dis, xtk: g.xt,
      cdi: Math.max(-1, Math.min(1, -g.xt / N.fullScale)),
      ete: gs > 1 ? dis / gs : null, gs, rem: g.rem, arrived: N.arrived,
      leg: { A: L.A, B: L.B },
    };
    return N.last;
  };
  // VNAV: the vertical speed that arrives at altTgt over the active
  // waypoint (null when there is no time to work with)
  N.vnav = (altNow, altTgt) => {
    const R = N.last;
    if (!R || R.ete == null || R.ete < 1) return null;
    return (altTgt - altNow) / R.ete;
  };
  return N;
}

if (typeof module !== 'undefined') {
  module.exports = { navMake, navLegGeom, navDeg, navRad, navDiff, NAV_FULL_SCALE };
}
