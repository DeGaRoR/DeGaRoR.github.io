// ===========================================================================
// THE SITE — the base aerodrome as a place, declared once.
// ===========================================================================
// THE RUNWAY IS NOT HERE. It is world.aerodromes[0] — the 'HOME' record in
// 20_world.js — and this file READS it. That record's own comment has said
// since it was written that "the h0 runway carve box / renderer decals are not
// yet driven from these records", and until now they were not: render_world.js
// restated -520 / 1100 / 30 by hand and hangar.js invented a third, unrelated
// strip off the garage door. Three copies of one runway, and the garage's copy
// pointed the wrong way.
//
// What IS here is the half the registry has no field for — where the buildings,
// the paving and the furniture stand — plus the ONE frame conversion between
// the world and the shed's own local frame. Both scenes read this file, so
// there is one place to change the aerodrome and no way for them to disagree.
//
// FRAMES. The world is x/z with the runway along x at z = 0. The shed is drawn
// in its own frame: long axis x, doors at -x, HD deep and HW wide (hangar.js).
// Standing it beside the strip near the +x threshold with its doors facing the
// runway is position (42, 62) and rotation.y = -PI/2, which gives
//
//     local -> world :  W = ( Hx - pz ,  py ,  Hz + px )
//     world -> local :  px = Wz - Hz ,   pz = Hx - Wx
//
// so local -x (out of the door) is world -z, straight at the strip, and the
// shed's 30 m frontage lies ALONG the runway. That is the whole reason the
// garage's outdoors now shows the strip crossing the view instead of pointing
// down it: the hangar was always meant to be beside the runway, not on it.
//
// EVERYTHING HERE MUST LIE INSIDE THE FLAT PAD — x in [-1180, 130], |z| < 90 —
// where 20_world.js's h0 multiplies terrain by exactly zero. Every y = 0 in
// both scenes depends on it, and GATE SITE asserts it, because an item nudged
// past |z| = 90 does not fail: it floats, slightly, forever.
// THE REGISTRY (HANGARS S5). One site per AUTHORED aerodrome, keyed by the
// registry id. HOME is the record this file always held, verbatim and
// unmoved; a meadow has no site — that is what a meadow is — and granting
// one later (P6) is a value landing in a slot, not a schema change. The
// generated A-strips never key a site: their ids are seed-dependent, and a
// site keyed on one would silently detach under a different seed (gated).
const AIRFIELD_SITES = {
  HOME: {

    // THE SHED. dims mirror hangar.js's own defaults (HW 15, HD 12.5, EAVE 7.0);
    // the exterior build is handed these so the world's building and the room you
    // stand in are the same size by construction, not by coincidence.
    hangar: { x: 42, z: 62, ry: -Math.PI / 2, HW: 15, HD: 12.5, EAVE: 7.0 },

    // THE APRON, re-declared. The old decal was 66 x 24 centred at (44, 48),
    // which was fine under a 15 x 10 box and wrong under the real shed: the shed
    // occupies z 49.5..74.5, so ten metres of that apron ran UNDER the building.
    // It now stops at the door line and reaches west far enough to feed the
    // taxiway. z1 laps 0.5 m into the doorway so there is no seam at the sill.
    apron: { x0: 8, x1: 66, z0: 30, z1: 50 },

    // THE TAXIWAY, which in the old layout did not touch the runway: it sat at
    // x 32.5..47.5, fifteen metres BEYOND the threshold at x = 30, joined to
    // nothing. It now runs from the apron's west end down to the strip and meets
    // it inside its own length, which is what a backtrack entry looks like.
    taxiway: { x0: 8, x1: 24, z0: 15, z1: 30 },

    // THE BOUNDARY, with the gate the taxiway needs — the old fence ran straight
    // across it. Two runs, posts every `step`, either side of the opening.
    fence: { z: 26, h: 1.1, step: 6, runs: [[-80, 4], [28, 60]] },

    windsock: { x: -30, z: 20, h: 6 },

    // the neighbours, still boxes: a clubhouse and a second shed. Both clear the
    // real hangar's footprint (x 27..57, z 49.5..74.5) and the apron.
    buildings: [
      { x: 16, z: 54, w: 6.5, d: 5.5, h: 2.8, ry: -0.09, trim: true },
      { x: 66, z: 70, w: 12,  d: 8.5, h: 3.9, ry: 0.16 },
    ],

    // the windbreak behind the sheds. Pulled in from z 88..91 to 84: the old line
    // sat ON the pad's 90 m edge, where the terrain is not quite zero any more.
    trees: { z: 84, x0: 4, x1: 96, step: 8.5, r: 1.5, h: 6.2 },

    clutter: {
      drums: [[28, 44.5], [28.8, 45.4], [29.6, 44.2]],
      drumDown: [30.6, 45.6],
      crates: [[60, 52, 0], [61.2, 52.4, 0.4]],
      crateTop: [60.2, 52.1, 0.2],
      // straw, off the west end. Also pulled inside |z| < 90.
      bales: [[-40, 82, 0.3], [-35, 85, 1.1], [-46, 86, 2.0], [-30, 80, 0.7]],
      // tie-downs, all three ON the apron. One of the old three was at (43, 52),
      // which is inside the real shed — a ring in the floor of the building.
      rings: [[34, 42], [50, 42], [42, 36]],
    },

    // WHERE AN AEROPLANE STANDS when it is wheeled out of the shed: on the apron,
    // nose out, quartered to the strip. DECLARED, DELIBERATELY NOT WIRED. Roll-out
    // places at HOME.spawn, which is the W10 spawn identity every flying gate
    // departs from; moving it would move every take-off measurement in the
    // battery. This is here so the reference camera and any later taxi work have
    // one answer to point at instead of inventing a second one.
    stand: { x: 42, z: 40, hdg: Math.PI - 0.62 },
  },
  M1: null,
  M2: null,
  M3: null,
};

// a registry with a default is a rename, not a migration (HANGARS §6)
function siteOf(id) { return AIRFIELD_SITES[id || 'HOME'] || null; }

// THE DEFAULT SITE, kept forever: this one line keeps every `|| ...hangar`
// fallback below byte-identical and any console muscle-memory working. New
// code says siteOf(id); GATE SITE asserts this identity cannot drift.
const AIRFIELD_SITE = AIRFIELD_SITES.HOME;

// THE FLAT PAD, quoted from 20_world.js's h0 so the gate can assert against the
// same numbers the terrain actually uses. Inside this box terrain is exactly 0.
const AIRFIELD_PAD = { x0: -1180, x1: 130, zAbs: 90 };

// ---- the frame conversion, both ways --------------------------------------
// One rotation, written out rather than composed, because a THREE.js matrix is
// not available to the core and a sign error here puts the runway behind the
// shed. Verified by round-trip in GATE SITE.
function siteToLocal(x, z, H) {
  const h = H || AIRFIELD_SITE.hangar;
  return { x: z - h.z, z: h.x - x };
}
function siteToWorld(px, pz, H) {
  const h = H || AIRFIELD_SITE.hangar;
  return { x: h.x - pz, z: h.z + px };
}

// ---- the runway, DERIVED from the registry record -------------------------
// Everything a scene needs to draw the strip and its markings, computed from
// {x, z, hdg, len, wid} so that no consumer restates them. `end0` is the end
// the take-off run STARTS from (hdg points down the run), which for HOME is the
// +x end — the one the hangar stands beside.
function siteRunway(home) {
  const dx = Math.cos(home.hdg), dz = Math.sin(home.hdg);
  const hl = home.len / 2, hw = home.wid / 2;
  // the threshold bars, and a quarter of the distance between them
  const R0x = home.x - dx * (hl - 5), R0z = home.z - dz * (hl - 5);
  const R1x = home.x + dx * (hl - 5), R1z = home.z + dz * (hl - 5);
  const aimIn = (home.len - 10) / 4;
  return {
    cx: home.x, cz: home.z, hdg: home.hdg, len: home.len, wid: home.wid,
    dx: dx, dz: dz,
    nx: -dz, nz: dx,                                  // across the strip
    end0: { x: home.x - dx * hl, z: home.z - dz * hl },
    end1: { x: home.x + dx * hl, z: home.z + dz * hl },
    // the painted threshold bars sit 5 m inside each end, as they were drawn
    thr0: { x: R0x, z: R0z },
    thr1: { x: R1x, z: R1z },
    // THE PAINTED AIMING POINTS AND THE REGISTRY'S tdz ARE TWO DIFFERENT
    // THINGS, and the old comment at render_world.js:1184-1188 said they were
    // one ("the registry's tdz is exactly this point"). They are not: the
    // paint sits a quarter of the THRESHOLD-TO-THRESHOLD distance in from each
    // bar — 1090 / 4 = 272.5, so 25 - 272.5 = -247.5 — while HOME.tdz is
    // [-450, 0], the autopilot's landing-frame origin (40_autopilot.js:58-65,
    // "origin places tdz at s = -450"), hand-tuned and not on the len/4 rule
    // at all. Deriving them from one number would move the aiming point 200 m
    // or move every fiche's tuned approach. So both are carried, named apart.
    aim0: { x: R0x + dx * aimIn, z: R0z + dz * aimIn },
    aim1: { x: R1x - dx * aimIn, z: R1z - dz * aimIn },
    tdz: { x: home.tdz ? home.tdz[0] : home.x, z: home.tdz ? home.tdz[1] : home.z },
    half: hw,
    markerOff: hw + 0.5,          // edge boards, just outside the mown edge
    markerStep: 70,
  };
}

// the edge marker boards, as world positions — one pair every markerStep from
// end0 toward end1, sized off the record rather than counted out by hand.
function siteMarkers(home) {
  const R = siteRunway(home), out = [];
  for (let t = 5; t <= R.len - 5; t += R.markerStep)
    for (const s of [1, -1])
      out.push({ x: R.end0.x + R.dx * t + R.nx * s * R.markerOff,
                 z: R.end0.z + R.dz * t + R.nz * s * R.markerOff });
  return out;
}


// ---- the strip's markings, painted once for both scenes --------------------
// A 2D context and the runway record; no THREE, no DOM beyond the context's own
// methods, so this stays in core beside the numbers it is drawing.
//
// It lives here rather than in either renderer because the two scenes now show
// the SAME strip: the world lays this canvas over 1100 m of it, and the garage
// sees the first 300 m of it through a hangar door forty metres away. A second
// copy of the recipe would drift the moment either one was touched, which is
// the whole failure this file exists to end.
//
// The layout is in the RUNWAY's own frame — `t` along it from end1, `a` across
// it — so a strip of another length or heading paints itself correctly.
// `marks` paints ONLY the paint - transparent everywhere else - so the strip
// can be a scanned grass surface with its markings laid over it instead of a
// picture of grass with markings drawn into it. The mowing stripes go translucent
// in that mode: they are a difference in cut, not a difference in colour.
function sitePaintStrip(q, R, RW, RH, marks) {
  const U = t => t / R.len * RW, V = a => (a + R.wid / 2) / R.wid * RH;
  const UW = w => w / R.len * RW, VW = w => w / R.wid * RH;
  const sOf = P => (P.x - R.end1.x) * -R.dx + (P.z - R.end1.z) * -R.dz;
  if (marks) q.clearRect(0, 0, RW, RH);
  else { q.fillStyle = '#6b7a36'; q.fillRect(0, 0, RW, RH); }
  q.globalAlpha = marks ? 0.20 : 1;
  for (let i = 0; i < 7; i++) {                      // mowing stripes
    q.fillStyle = i % 2 ? '#77873b' : '#5f6f2c';
    q.fillRect(0, V(-10.5 + i * 3.5 - 1.7), RW, VW(3.4));
  }
  q.globalAlpha = 1;
  q.fillStyle = '#8e9a55';                           // edge lines
  for (const sg of [1, -1]) q.fillRect(0, V(sg * (R.half - 2.5) - 0.45), RW, VW(0.9));
  q.fillStyle = '#e9e4d6';                           // threshold bars
  for (const T of [R.thr0, R.thr1]) for (let k = 0; k < 5; k++)
    q.fillRect(U(sOf(T) - 4.5), V(-8 + k * 4 - 0.75), UW(9), VW(1.5));
  q.fillStyle = '#d9d3c0';                           // centre dashes
  for (let t = 25.5; t < R.len - 25; t += 29)
    q.fillRect(U(t - 5.5), V(-0.3), UW(11), VW(0.6));
  // TOUCHDOWN MARKERS (G107): the aiming point, a quarter of the way in from
  // each threshold — one per landing direction, the way a real runway wears
  // them. NOT the registry's tdz; see the note on aim0/aim1 above.
  q.fillStyle = '#efe9da';
  for (const A of [R.aim0, R.aim1]) for (const zz of [-6.5, 4])
    q.fillRect(U(sOf(A) - 9), V(zz), UW(18), VW(2.5));
}

// is (x, z) on the flat pad, where y = 0 is exact?
function siteOnPad(x, z) {
  return x >= AIRFIELD_PAD.x0 && x <= AIRFIELD_PAD.x1 &&
         Math.abs(z) <= AIRFIELD_PAD.zAbs;
}

// ---- the flat ground, PER AERODROME (HANGARS S5) --------------------------
// HOME sits on the h0 pad (the box above). A meadow is exactly its own
// height inside 0.45 of its radius — quoted from 20_world.js's blendM,
// `sstep(m.r * 0.45, m.r, d)`, the same way AIRFIELD_PAD quotes h0 — so a
// granted meadow site's buildings must stand inside that circle or they
// float, slightly, forever. The A-strips are graded by AERO with their own
// feather; a site never keys one (seed-dependent ids), so no branch for
// them is pretended here.
function siteOnFlat(aero, x, z) {
  if (!aero) return false;
  if (aero.kind === 'meadow')
    return Math.hypot(x - aero.x, z - aero.z) <= aero.r * 0.45;
  return siteOnPad(x, z);
}

// the shed's footprint in the world, from its own dims — used by the gate to
// prove nothing is paved under the building, and by the world scene to keep
// the neighbours clear of it.
function siteHangarBox(H) {
  const h = H || AIRFIELD_SITE.hangar;
  return { x0: h.x - h.HW, x1: h.x + h.HW, z0: h.z - h.HD, z1: h.z + h.HD };
}
