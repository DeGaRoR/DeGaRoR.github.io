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
    // nose out, quartered to the strip. **WIRED AT G151** — the roll-out places
    // here now. HOME.spawn is untouched and still means what it always meant:
    // it is the W10 spawn identity every flying gate departs from, and moving it
    // would move every take-off measurement in the battery. The taxi below ENDS
    // on the centreline, so the datum keeps its meaning.
    // hdg is the direction the aeroplane FACES, in the aerodrome convention
    // (nose = (cos hdg, sin hdg) — HOME's own pi gives the -x runway heading).
    // IT NOW FACES THE WAY OUT, and that is a fix, not a preference. The old
    // `Math.PI - 0.62` pointed the nose at (-0.81, +0.58) — up the apron
    // TOWARDS THE SHED at z 62 — so the first thing the aeroplane had to do
    // was turn 67 degrees from a standstill. Measured, it could not: the
    // rudder sat pinned at its -0.45 clamp for the whole taxi while the
    // aeroplane scrubbed round at 0.15 m/s, taking 228 s to cover 108 m and
    // arriving through the fence. A tyre being dragged sideways eats the whole
    // thrust margin, and turn rate needs the speed the scrub is preventing.
    // Aeroplanes are parked pointing the way they will leave; this one now is.
    // GATE SITE asserts this heading still points at taxiOut[0], so the two
    // cannot drift apart.
    stand: { x: 42, z: 40, hdg: -2.5361 },

    // THE WAY OUT, DECLARED — because it is a property of THIS PLACE and the
    // autopilot cannot see any of it. A straight line from the stand to the
    // centreline crosses the boundary fence: the fence stands at z 26 with runs
    // x -80..4 and x 28..60, so the ONLY way through is the gate between them,
    // which is what the taxiway (x 8..24) exists to use. Measured on the first
    // attempt, an invented straight line crossed z 26 at x = -7 — through the
    // wire, at every lead value that also gave LINEUP a shallow enough
    // intercept to work with.
    // So the points are stated, in order, from the stand to the centreline:
    // west along the apron and south through the gate, then a long shallow
    // entry that puts the aeroplane inside LINEUP's own 8 m gate when it
    // arrives (measured 4.9 m) with 990 m of strip left in front of it.
    // A site with no `taxiOut` falls back to the pilot's computed entry, which
    // is correct wherever there is nothing to drive around.
    taxiOut: [[16, 22], [-80, 0]],
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
    // THE TWO TOUCHDOWN TARGETS THE PILOT FLIES TO (G202): td0 is the
    // record's own tdz (landing along -hdg, over thr1); td1 mirrors it off
    // the other bar (landing along +hdg, over thr0). sitePattern's two
    // approaches read these, and the strip's paint marks THESE now — the
    // user: "there are markers on the runway, but they don't correspond to
    // the actual markers used by the autopilot". aim0/aim1 above stay as
    // the derived quarter-points GATE SITE checks; they are no longer painted.
    td0: { x: home.tdz ? home.tdz[0] : home.x, z: home.tdz ? home.tdz[1] : home.z },
    td1: (() => {
      const tx = home.tdz ? home.tdz[0] : home.x, tz = home.tdz ? home.tdz[1] : home.z;
      const D = Math.abs((tx - R1x) * dx + (tz - R1z) * dz);
      return { x: R0x + dx * D, z: R0z + dz * D };
    })(),
    holdIn: 110,                  // the hold-short line, in from each end (GP_HOLD_IN)
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
  // TOUCHDOWN MARKERS (G107, moved G202): the pilot's own two targets, one
  // per landing direction — td0/td1 above, the points 43_pilot.js lands on —
  // a pair of bold bars astride the centreline with a chevron pointing the
  // way that landing runs. The quarter-point aim0/aim1 are not painted any
  // more: a marker the pilot does not fly to is a lie on the ground.
  q.fillStyle = '#efe9da';
  for (const [A, sg] of [[R.td0, -1], [R.td1, 1]]) {
    for (const zz of [-6.5, 4]) q.fillRect(U(sOf(A) - 9), V(zz), UW(18), VW(2.5));
    // the chevron: two strokes meeting on the centreline, pointing the way
    // the landing runs (td0 is landed along -hdg, i.e. toward end0 = increasing t)
    const s0 = sOf(A), dir = sg < 0 ? 1 : -1;
    q.beginPath();
    q.moveTo(U(s0 + dir * 4), V(-6.5)); q.lineTo(U(s0 + dir * 12), V(0)); q.lineTo(U(s0 + dir * 4), V(6.5));
    q.lineWidth = Math.max(1, VW(1.2)); q.strokeStyle = '#efe9da'; q.stroke();
  }
  // THE HOLD-SHORT LINES (G202): one bar across the strip at each hold, the
  // point the pilot STOPS on lined up before the roll (25_airfield.js
  // GP_HOLD_IN, 110 m in from each end)
  q.fillStyle = '#e6c35c';
  for (const t of [R.holdIn, R.len - R.holdIn]) {
    q.fillRect(U(t - 0.5), V(-(R.half - 2.5)), UW(1.0), VW(2 * (R.half - 2.5)));
    for (let a = -(R.half - 2.5); a < R.half - 2.5; a += 3.0) q.fillRect(U(t + 1.5), V(a), UW(1.0), VW(1.5));
  }
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

// ---- THE PATTERN (G193): the ground graph and the two approaches ---------
// The user, 2026-09-05: "notion of taxi pattern and approach pattern to the
// airport ... a glide slope, a touchdown target (warning, there should be 2
// touchdown for both directions), and a taxi pattern ... mostly 90° turns
// (smoothed out), and complete a graph dot-arc and try to follow that. We
// need the notion of stop point, where the plane lines up and completely
// stops before taking off. Ultimately, these should be part of the editor."
//
// DECLARED, NOT INVENTED IN THE PILOT — the same ruling `taxiOut` landed
// under at G151, widened: every obstacle on the ground belongs to the PLACE,
// and so does the way round it. `sitePattern` builds the graph from the
// datums this file already declares (stand, apron, taxiway, fence gate, the
// runway ends) for HOME, and a minimal one (spawn → hold → run) for every
// generated strip — same shape either way, so the editor that will one day
// write `site.pattern` by hand writes what this function returns. A site
// that carries an authored `pattern` is returned verbatim.
//
// THE SHAPE. Nodes are the dots (`kind`: stand | apron | gate | entry | taxi |
// hold; a corner may carry its own fillet `r`, a hold its lined-up `hdg`);
// arcs the drawn edges; `routes.out[T]` the way from the stand to the hold
// for take-off direction T (0 = along the record's hdg, from end0; 1 = the
// reverse, from end1), `routes.back[T]` the lane-and-U-turn from anywhere on
// the strip to the same hold. 39_ground_path.js samples a route into the
// path the pilots follow.
//
// TWO TOUCHDOWN TARGETS, one per landing direction k (0 = landing along
// -hdg, the record's own `tdz`, so every calm gate keeps its number to the
// bit; 1 = landing along +hdg, the mirror off the other threshold). `aimAP`
// is the point the autopilot actually flies to (70 m past the target, which
// is what A.xAim's -520 against the frame's -450 has always meant); the
// painted aim0/aim1 stay the different thing siteRunway says they are. `gs`
// null = the aircraft's own slope; a number is the editor's future
// declaration, flown if shallower than the aircraft's.
const GP_FILLET = 12, GP_HOLD_IN = 110, GP_LANE = 12, GP_UTURN_R = 12;
function sitePattern(aero, site) {
  if (site && site.pattern) return site.pattern;
  const R = siteRunway(aero);
  const d = [R.dx, R.dz], n = [R.nx, R.nz];
  const at = (px, pz, a, k) => [px + a[0] * k, pz + a[1] * k];
  const nodes = [], arcs = [], routes = { out: [null, null], back: [null, null] };
  const add = (id, p, kind, extra) => {
    nodes.push(Object.assign({ id, x: +p[0].toFixed(3), z: +p[1].toFixed(3), kind }, extra || {}));
    return id;
  };
  const link = (a, b) => arcs.push([a, b]);
  // the taxiway side, so the backtrack lane keeps AWAY from it
  let laneSg = 1;
  if (site && site.taxiway) {
    const tz = 0.5 * (site.taxiway.z0 + site.taxiway.z1), tx = 0.5 * (site.taxiway.x0 + site.taxiway.x1);
    const side = (tx - R.cx) * n[0] + (tz - R.cz) * n[1];
    laneSg = side > 0 ? -1 : 1;
  }
  const lane = Math.min(GP_LANE, R.half - 2.5);
  const ends = [R.end0, R.end1];
  const holds = [];
  for (const T of [0, 1]) {
    const dir = T === 0 ? d : [-d[0], -d[1]];
    const E = [ends[T].x, ends[T].z];
    const hdg = Math.atan2(dir[1], dir[0]);
    const hold = add('hold' + T, at(E[0], E[1], dir, GP_HOLD_IN), 'hold', { hdg });
    holds.push(hold);
    // the lane-and-U-turn back to this hold from anywhere on the strip
    const la = add('l' + T + 'a', at(...at(E[0], E[1], dir, 27), n, laneSg * lane), 'taxi', { r: GP_UTURN_R });
    const lb = add('l' + T + 'b', at(...at(E[0], E[1], dir, 27), n, -laneSg * lane), 'taxi', { r: GP_UTURN_R });
    const lc = add('l' + T + 'c', at(...at(E[0], E[1], dir, 51), n, -laneSg * lane), 'taxi', { r: GP_FILLET });
    const dg = add('d' + T, at(E[0], E[1], dir, 90), 'taxi', { r: GP_FILLET });
    link(la, lb); link(lb, lc); link(lc, dg); link(dg, hold);
    routes.back[T] = [la, lb, lc, dg, hold];
  }
  if (site && site.stand && site.taxiway && site.apron) {
    // HOME: stand -> the apron row's west end -> the gate -> the strip's
    // edge -> a corner onto the centreline -> the hold, for direction 0; the
    // lane corner and the generic U-turn for direction 1
    const tx = 0.5 * (site.taxiway.x0 + site.taxiway.x1);
    const st = add('stand', [site.stand.x, site.stand.z], 'stand', { hdg: site.stand.hdg });
    const ap = add('apronW', [tx, site.stand.z], 'apron', { r: GP_FILLET });
    const ga = add('gate', [tx, site.fence ? site.fence.z : Math.min(site.taxiway.z0, site.taxiway.z1)], 'gate');
    const ed = add('edge', [tx, R.cz + R.half * Math.sign(site.taxiway.z0 - R.cz || 1)], 'entry');
    const c0 = add('c0', [tx, R.cz], 'taxi', { r: GP_FILLET });
    link(st, ap); link(ap, ga); link(ga, ed); link(ed, c0); link(c0, holds[0]);
    routes.out[0] = [st, ap, ga, ed, c0, holds[0]];
    const c1 = add('c1', at(tx, R.cz, n, laneSg * lane), 'taxi', { r: GP_FILLET });
    link(ed, c1); link(c1, 'l1a');
    routes.out[1] = [st, ap, ga, ed, c1].concat(routes.back[1]);
  } else if (aero.spawn) {
    // a generated strip: the spawn identity is 35 m in from end0
    const sp = add('spawn', [aero.spawn[0], aero.spawn[1]], 'stand',
                   { hdg: Math.atan2(d[1], d[0]) });
    link(sp, holds[0]);
    routes.out[0] = [sp, holds[0]];
    routes.out[1] = routes.back[1];
  }
  // the two approaches — the targets are siteRunway's td0/td1 (G202: one
  // keeper, and the strip's paint reads the same two). aimAP is where the
  // pilots' slope meets the ground: 70 m SHORT of the target along the
  // landing direction (A.xAim -520 against the frame's -450), the flare
  // carrying the aeroplane the rest of the way; it read 70 m past before.
  const mk = (k, u, thr, td) => ({
    k, u: [u[0], u[1]], thr: [thr.x, thr.z], td: [td[0], td[1]],
    aimAP: [+(td[0] - u[0] * 70).toFixed(3), +(td[1] - u[1] * 70).toFixed(3)],
    gs: null, ga: { hdg: Math.atan2(u[1], u[0]) },
  });
  const approaches = [
    mk(0, [-d[0], -d[1]], R.thr1, [R.td0.x, R.td0.z]),
    mk(1, [d[0], d[1]], R.thr0, [R.td1.x, R.td1.z]),
  ];
  return { id: aero.id || 'HOME', elev: aero.elev || 0, fillet: GP_FILLET,
           nodes, arcs, routes, stops: holds,
           runway: { c0: { x: R.end0.x, z: R.end0.z }, c1: { x: R.end1.x, z: R.end1.z },
                     hdg: R.hdg, wid: R.wid, len: R.len },
           approaches };
}

// THE VALIDATOR, and the future editor's too: every claim a pattern makes
// about the ground, as a list of complaints (empty = sound). `Rmin` is the
// tightest turn the aeroplane it is being checked for can taxi
// (groundRmin); `path` is 39_ground_path.js's sampler, passed in so this file
// stays free of it in node.
function sitePatternIssues(pat, aero, site, Rmin, patternPath) {
  const out = [];
  if (!pat || !pat.nodes || !pat.routes) return ['no pattern'];
  const R = siteRunway(aero);
  const byId = {}; for (const nd of pat.nodes) byId[nd.id] = nd;
  const box = site && site.hangar ? siteHangarBox(site.hangar) : null;
  const inBox = (x, z) => box && x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1;
  const onStrip = (x, z) => {
    const a = (x - R.end0.x) * R.dx + (z - R.end0.z) * R.dz;
    const c = Math.abs((x - R.cx) * R.nx + (z - R.cz) * R.nz);
    return a >= -0.01 && a <= R.len + 0.01 && c <= R.half + 0.01;
  };
  for (const h of pat.stops || []) {
    const nd = byId[h];
    if (!nd) { out.push('hold ' + h + ' is not a node'); continue; }
    const c = Math.abs((nd.x - R.cx) * R.nx + (nd.z - R.cz) * R.nz);
    if (c > 0.01) out.push('hold ' + h + ' is ' + c.toFixed(2) + ' m off the centreline');
    const ux = Math.cos(nd.hdg), uz = Math.sin(nd.hdg);
    if (Math.abs(Math.abs(ux * R.dx + uz * R.dz) - 1) > 1e-6)
      out.push('hold ' + h + ' is not lined up with the strip');
    const along = (nd.x - R.end0.x) * R.dx + (nd.z - R.end0.z) * R.dz;
    const ahead = (ux * R.dx + uz * R.dz) > 0 ? R.len - along : along;
    const want = Math.min(500, R.len - 150);
    if (ahead < want) out.push('hold ' + h + ' leaves ' + ahead.toFixed(0) + ' m of run, under ' + want);
  }
  const walk = (ids, what) => {
    if (!ids) return;
    let P;
    try { P = patternPath ? patternPath(pat, ids, 1.0) : null; } catch (e) { out.push(what + ': ' + e.message); return; }
    if (!P) return;
    if (P.pts.length < 2) out.push(what + ' samples to nothing');
    // a strip too narrow to turn this aeroplane round inside its own width
    // cannot be blamed for its U-turn: the lane is the strip's, the follower
    // slows for the bend it gets, and only a site's own corners are held to
    // the radius
    const wideEnough = R.half - 2.5 >= Rmin;
    if (Rmin > 0 && wideEnough && P.rMin < 1.05 * Rmin)
      out.push(what + ' has a ' + P.rMin.toFixed(1) + ' m corner, under the aeroplane’s ' + Rmin.toFixed(1) + ' m');
    for (const q of P.pts) {
      if (site && typeof siteOnFlat === 'function' && !siteOnFlat(aero, q.x, q.z)) {
        out.push(what + ' leaves the flat ground at (' + q.x.toFixed(0) + ', ' + q.z.toFixed(0) + ')'); break;
      }
      if (inBox(q.x, q.z)) { out.push(what + ' passes under the hangar'); break; }
    }
    // a crossing of the fence line only through the gate, 6 m clear of each run
    if (site && site.fence) {
      const F = site.fence;
      for (let i = 1; i < P.pts.length; i++) {
        const a = P.pts[i - 1], b = P.pts[i];
        if ((a.z - F.z) * (b.z - F.z) < 0) {
          const t = (F.z - a.z) / (b.z - a.z), xc = a.x + t * (b.x - a.x);
          for (const [r0, r1] of F.runs)
            if (xc > Math.min(r0, r1) - 6 && xc < Math.max(r0, r1) + 6)
              out.push(what + ' crosses the fence at x ' + xc.toFixed(1) + ', inside or within 6 m of the run ' + r0 + '..' + r1);
        }
      }
    }
  };
  for (const T of [0, 1]) { walk(pat.routes.out[T], 'route out[' + T + ']'); walk(pat.routes.back[T], 'route back[' + T + ']'); }
  const A = pat.approaches || [];
  if (A.length !== 2) out.push('a pattern has two approaches, one per direction');
  for (const ap of A) {
    if (!onStrip(ap.td[0], ap.td[1])) out.push('approach ' + ap.k + ' touchdown target is off the strip');
    if (!onStrip(ap.aimAP[0], ap.aimAP[1])) out.push('approach ' + ap.k + ' aim point is off the strip');
    if (ap.gs != null && !(ap.gs >= 0.035 && ap.gs <= 0.10)) out.push('approach ' + ap.k + ' slope ' + ap.gs + ' is outside 2..5.7 deg');
    if (ap.k === 0 && aero.tdz && (Math.abs(ap.td[0] - aero.tdz[0]) > 1e-6 || Math.abs(ap.td[1] - aero.tdz[1]) > 1e-6))
      out.push('approach 0 does not land on the record’s own tdz');
  }
  return out;
}
