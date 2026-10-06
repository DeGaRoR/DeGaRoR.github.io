// ============================================================
// THE PLACEMENT (G1940, PILOT-ONE): putting an aeroplane on an aerodrome - the
// spawn identity, a stand, the true ground under the wheels, a line-up pose.
// Moved VERBATIM out of 40_autopilot.js when the classic pilot retired (the
// helpers never were a pilot's: ~30 gates, the page and the worker call them).
// ============================================================
// W10 spawn-at-aerodrome: after sim.reset(0), rotate the def geometry
// from its built-in -x nose heading onto the strip's takeoff heading
// (theta = pi - hdg) and translate to the record's spawn point at strip
// elevation. HOME (hdg pi, spawn [0,0], elev 0) is a BIT-EXACT no-op,
// so calling this unconditionally changes nothing for the home battery.
function placeAtAerodrome(sim, a) {
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  const th = Math.PI - a.hdg;
  const c = snap(Math.cos(th)), s = snap(Math.sin(th));
  const sp = a.spawn || [0, 0];
  for (let i = 0; i < sim.n; i++) {
    const x = sim.p[i * 3], z = sim.p[i * 3 + 2];
    sim.p[i * 3] = x * c + z * s + sp[0];
    sim.p[i * 3 + 2] = -x * s + z * c + sp[1];
    sim.p[i * 3 + 1] += (a.spawnElev !== undefined ? a.spawnElev : a.elev);   // G398.3: a premises strip's spawn may sit on its profile, not at the strip's elevation
  }
}

// G151: THE STAND. placeAtAerodrome puts the aeroplane on the strip's SPAWN
// IDENTITY — the W10 datum every flying gate departs from, which is exactly
// why it must never move: shifting it would move every take-off measurement
// in the battery at once. But a PLAYER rolling out of the shed has not been
// teleported onto the runway; the aeroplane was wheeled onto the apron, and
// landing it 75 m away facing the wrong way is the first thing every flight
// used to show (G123 named it and wired `site.stand` to nothing).
// This places it on that declared stand instead. The spawn identity is NOT
// touched — the taxi that follows ENDS on the centreline, so the datum keeps
// its meaning and the gates keep their numbers.
// It is deliberately a THIN wrapper rather than a second copy of the
// transform: placeAtAerodrome reads exactly hdg / spawn / elev, so a stand is
// just another pose to hand it. One transform, one place, as ever.
function placeAtStand(sim, a, st) {
  return placeAtAerodrome(sim, st
    ? { hdg: st.hdg, spawn: [st.x, st.z], elev: st.elev !== undefined ? st.elev : a.elev } : a);   // G398.3: the stand's own ground when the site names it
}

// G700: THE WHEELS ON THE GROUND UNDER THEM. placeAtStand lifts the airframe by ONE elevation, read at
// the stand's point, and stance() set the third wheel on the mains' ground line in the design frame, which
// is flat; the wheels stand metres away on a slope (Jolene's East Point clearing is a 15 % grade under the
// stand: the tailwheel 84 cm up, the airframe falling 19 cm onto it at 0.9 m/s; the Skyline altiport's
// lowest tyre 2.7 cm into the ground). seatOnGround pitches the airframe about the mains' centroid until
// the third wheel (refs.tw, the nose wheel of a tricycle) meets ITS ground as the mains meet theirs, then
// moves it vertically so the lowest contact (node minus radius, over the ground at its own x, z) is 1 cm
// clear - the clearance sim.reset() leaves on the design floor. The GAME's placement step (app.js
// applyRoute); the gates' spawn datums are untouched. Returns the vertical shift (m).
function seatOnGround(sim, groundH, refs) {
  if (typeof groundH !== 'function') return 0;
  const P = sim.p, R = sim.r;
  const clr = i => P[i * 3 + 1] - (R[i] || 0) - groundH(P[i * 3], P[i * 3 + 2]);
  const M = refs && refs.mains, tw = refs && refs.tw;
  if (M && M.length && tw != null && tw >= 0) {
    for (let it = 0; it < 3; it++) {           // the ground under the wheel moves as it swings: three passes
      let ax = 0, ay = 0, az = 0, cM = 0;
      for (const i of M) { ax += P[i * 3]; ay += P[i * 3 + 1]; az += P[i * 3 + 2]; cM += clr(i); }
      ax /= M.length; ay /= M.length; az /= M.length; cM /= M.length;
      let ux = P[tw * 3] - ax, uz = P[tw * 3 + 2] - az;
      const L = Math.hypot(ux, uz);
      if (L < 0.2) break;
      ux /= L; uz /= L;
      const hT = P[tw * 3 + 1] - ay, Rr = Math.hypot(L, hT), want = hT - (clr(tw) - cM);
      if (Math.abs(want) >= Rr) break;
      const th = Math.asin(want / Rr) - Math.atan2(hT, L);
      if (!(Math.abs(th) < 0.35) || Math.abs(th) < 1e-5) break;   // 20 deg: past that it is not a stand
      const cs = Math.cos(th), sn = Math.sin(th);
      for (let i = 0; i < sim.n; i++) {
        const s = (P[i * 3] - ax) * ux + (P[i * 3 + 2] - az) * uz, h = P[i * 3 + 1] - ay;
        const s2 = s * cs - h * sn, h2 = s * sn + h * cs;
        P[i * 3] += (s2 - s) * ux; P[i * 3 + 2] += (s2 - s) * uz; P[i * 3 + 1] = ay + h2;
      }
    }
  }
  let minC = Infinity;
  for (let i = 0; i < sim.n; i++) minC = Math.min(minC, clr(i));
  if (!Number.isFinite(minC)) return 0;
  const dy = 0.01 - minC;
  for (let i = 0; i < sim.n; i++) P[i * 3 + 1] += dy;
  return dy;
}

// G771: THE LINE-UP, WITHOUT THE TAXI (the user: "button to skip the taxi phase and straight to starting
// line"). The pose is the hold the pilot's own taxi would have ended on (43_pilot ap.lineupPose), and the
// aeroplane goes onto it the way it goes onto the stand - the one transform - then onto the strip's TRUE
// surface with G700's seatOnGround: the third wheel pitched onto its own ground, the lowest contact 1 cm over
// the solver's own ground (world.terrainH, what the tyres roll on). No record's elev, no premises' declared
// height: a sloped or crowned strip, a hold off the aerodrome's datum, all get the ground the tyres will meet.
// `refs` = def.refs (the wheels); without them the airframe is only lifted as one. Call after sim.reset (and
// stance), like placeAtStand.
function placeAtLineup(sim, a, pose, world, refs) {
  placeAtAerodrome(sim, { hdg: pose.hdg, spawn: [pose.x, pose.z], elev: (a && a.elev) || 0 });
  const gH = (world && typeof world.terrainH === 'function') ? world.terrainH : (() => (a && a.elev) || 0);
  return seatOnGround(sim, gH, refs);
}
