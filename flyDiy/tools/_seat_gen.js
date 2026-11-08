// SEAT GEN — the seat library (SEATS, 2026-11-02, the user: "a dedicated session modeling proper seats, based on
// references on Cessna, Beechcrafts, Aeroprakt, old and modern, luxurious new ones like the ICON A5 ... professional
// quality and game ready").
//
// The crew layer (_cage_crew.js) keeps seatType 0 / 1 / 2 (tube frame, composite shell, airliner) exactly as they were,
// line for line: every saved build draws the seat it drew. A seatType this table knows (3 and up) is handed here by
// buildSeat, and comes back with the SAME interface the three old builders return (panY, floor, szc, hw, backH, rake),
// so the controls and the occupant lace to it unchanged.
//
// THE SEATING REFERENCE (one for every preset, so the occupant sits right in all of them): the crew seats a body with
// its hip at panY + 0.115 + hipDrop, zBack + 0.115 (seatOccupant). Every preset puts its OCCUPIED surfaces on the same
// two lines - the squab's top 0.06-0.07 over panY at the hinge, rising by the squab tilt to the front, and the back's
// face through (panY + 0.02, zBack + 0.06) leaning by the recline - whatever the cushion, shell or sling under them.
//
// CALIBRATED, NOT SLID (the user: "I might accept lower control over the seat geometry (width, height) as these come
// calibrated. I still need height of the stand, recline, etc"): each preset carries its real width and back height
// (SEAT_PRESETS, docs/SEATS-REFERENCES.md). The stand height (seatH), the recline (seatRake), the squab tilt
// (seatTilt), the fore/aft station (seatZ) and the layout/spacing still drive it. One honest exception: a cabin
// narrower than the seat scales the seat's width down to the room there is (and a low roof shortens the back), so
// no preset ever draws through a fuselage side - `fit` on the result says when it did.
//
// GEOMETRY: everything upholstered or moulded is ONE primitive, `slab` - a rounded box (a lattice projected onto its
// edge radius, so the edges are real radii and the normals are smooth) carried along a SIDE-PROFILE SPINE (pan, hinge,
// back, headrest in one curve), with fields laid over it: a crown, side wings (a bucket's walls, a cushion's bolsters),
// pleat grooves, a front roll. Its rim gives the piping and the stitch lines. Frames are filleted swept tubes
// (GEAR_KIT), belts are ribbons. One bag per material per seat: a seat is a handful of draws.
//
// MATERIALS: the finish system's own (AEROSKIN.aeroMaterial: leather, cabin cloth, webbing, composite, gelcoat,
// alloy, chrome...), each preset with its own calibrated tints. With no AEROSKIN (a bare bench, node) a plain
// MeshStandardMaterial off the same finish row.
//
// Bench: tools/_seats.html (the studio, every preset side by side). Rig: tools/seat_shot.js.
'use strict';
(() => {
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// THE LEVELS OF DETAIL (the user, 2 Nov: "simply the same generation process, with less detail ... cleaner, more
// controllable, and more suited to proper LOD construction"): no decimation. The same generator runs at a LEVEL - 0 the
// hero (the close-up master), 1 mid, 2 phone - and every primitive reads it: lattice rows, tube sides, edge segments,
// revolve segments scale by k, and the small features step off by level (fine(l): drawn only below level l):
//   level 1 drops: stitching, rail holes, rivets, bolts, lacing, buttons; pleats at 60 %; domed tube ends -> flat
//   level 2 drops: piping, lugs, the bindings, every groove; the wicker's cane strands become one woven sheet
// The silhouette, the radii and the materials are the same at every level; only the resolution and the trim go.
const LOD = { lvl: 0 };
const LVL = [{ k: 1, nE: 3, gr: 1, fil: 5 }, { k: 0.45, nE: 2, gr: 0.6, fil: 3 }, { k: 0.14, nE: 1, gr: 0, fil: 2 }];
const det = () => LVL[LOD.lvl] || LVL[0];
const nRes = (n, min) => Math.max(min || 1, Math.round(n * det().k));
const fine = l => LOD.lvl < l;
// GEAR_KIT at the level: revolves and round sections take fewer segments, bolts go at 1, lugs at 2
const KIT = () => {
  const K = window.GEAR_KIT;
  if (!K || LOD.lvl === 0) return K;
  return Object.assign({}, K, {
    // a turned part under 16 mm radius (a roller, a knob, a bushing, a button) is gone at the phone level
    revolve: (bag, ctr, axis, prof, segs, cap) => (fine(2) || Math.max(...prof.map(q => q[0])) >= 0.016)
      ? K.revolve(bag, ctr, axis, prof, nRes(segs || 30, 5), cap) : null,
    secRound: (r, sides) => K.secRound(r, nRes(sides || 14, 4)),
    bolt: (...a) => (fine(1) ? K.bolt(...a) : null),
    lug: (...a) => (fine(2) ? K.lug(...a) : null),
  });
};

// ---- the presets ---------------------------------------------------------------------------------------------------
// seatType -> preset. THE NAMES ARE THE SEAT'S SPIRIT, NOT AN AEROPLANE'S (the user, 2 Nov: "find names avoiding naming
// planes, get down to the spirit"); what each was modelled on is in docs/SEATS-REFERENCES.md. `key` is the GEN_SEATS row
// the build bills (kg: ONE seat as fitted - frame, cushions, its share of the rails); `build` the builder below; hw the
// seat's outer half-width, back the back's height above the hinge (headrest included), m; rake / tilt the preset's own
// stance (deg), seeded when it is picked - the rows still move them. `pax`: this preset IS a cabin seat; `paxType`:
// the type a cabin takes when the passengers' own row says "as the pilots'".
// 0, 1, 2 REPLACED today's tube frame, composite shell and airliner (the user, 2 Nov: "replace both ... also replace
// the airliner existing seat with the dc3 passenger"): every saved build on them draws these. The tube seat bills
// 3.0 kg, the `sling` row every saved build already bills, so its mass and CG do not move.
const SEAT_PRESETS = {
  0:  { key: 'sling',       build: 'cub',     name: 'Tube & sling',      kg: 3.0,  hw: 0.230, back: 0.50, rake: 12, tilt: 4,
        note: 'a welded tube frame, a laced canvas sling, a loose piped cushion, a canvas back with a pad' },
  1:  { key: 'carbon',      build: 'carbon2', name: 'Carbon bucket',     kg: 4.5,  hw: 0.235, back: 0.80, rake: 22, tilt: 6,
        note: 'a moulded carbon bucket, integrated headrest, two pads, on two rails' },
  2:  { key: 'airliner',    build: 'dc3',     name: 'Vintage airliner',  kg: 18.0, hw: 0.260, back: 0.84, rake: 14, tilt: 4, pax: true,
        note: 'the deep reclining day seat: buttoned mohair, a linen antimacassar, leather arms, a polished tube frame' },
  3:  { key: 'touring',     build: 'c172',    name: 'Touring',           kg: 14.0, hw: 0.245, back: 0.70, rake: 13, tilt: 4,
        note: 'a tube and pan frame on rails, cloth inserts in vinyl bolsters, recline lever, a moulded back shell' },
  4:  { key: 'sculpted',    build: 'icon',    name: 'Sculpted sport',    kg: 9.0,  hw: 0.265, back: 0.84, rake: 18, tilt: 5,
        note: 'a sculpted gloss shell, leather bolsters, a quilted centre, contrast stitching, integrated headrest' },
  5:  { key: 'executive',   build: 'bonanza', name: 'Executive leather', kg: 18.0, hw: 0.270, back: 0.80, rake: 15, tilt: 4,
        note: 'rolled-pleat leather, a high back, a headrest on posts, an armrest' },
  6:  { key: 'ultralight',  build: 'ul',      name: 'Ultralight sling',  kg: 3.5,  hw: 0.230, back: 0.56, rake: 16, tilt: 6,
        note: 'a bent alloy tube frame and a laced canvas sling with a pad, no brace behind' },
  7:  { key: 'aerobatic',   build: 'extra',   name: 'Aerobatic recline', kg: 6.0,  hw: 0.225, back: 0.70, rake: 38, tilt: 10,
        note: 'a carbon shell for a pilot lying back, a back-pack parachute in it' },
  8:  { key: 'vintageCrew', build: 'dc3',     name: 'Vintage crew',      kg: 20.0, hw: 0.260, back: 0.68, rake: 14, tilt: 4, paxType: 2,
        note: 'a riveted alloy bucket, leather cushions, padded arms, on a column; its cabin takes the vintage airliner seat' },
  9:  { key: 'work',        build: 'ag',      name: 'Heavy-duty work',   kg: 16.0, hw: 0.275, back: 0.88, rake: 11, tilt: 5,
        note: 'a crash-rated steel bucket, thick cushions under a sheepskin, height tracks, crush tubes' },
  10: { key: 'cane',        build: 'wicker',  name: 'Woven cane',        kg: 3.0,  hw: 0.230, back: 0.46, rake: 9,  tilt: 3,
        note: 'a rattan tub woven on stakes, a wrapped rim, a leather cushion, on ash bearers' },
  11: { key: 'reclined',    build: 'glider',  name: 'Reclined tub',      kg: 3.0,  hw: 0.290, back: 0.66, rake: 40, tilt: 16,
        note: 'a moulded glass-fibre pan, a padded backrest board on struts and quadrants, four anchor tubes' },
  12: { key: 'folding',     build: 'jump',    name: 'Folding canvas',    kg: 2.5,  hw: 0.230, back: 0.50, rake: 10, tilt: 3,
        note: 'a light frame on floor hinges with quick-release pins, a canvas seat and strap back' },
  13: { key: 'parachute',   build: 'warbird', name: 'Parachute bucket',  kg: 8.0,  hw: 0.245, back: 0.60, rake: 13, tilt: 6,
        note: 'a deep moulded resin bucket for a seat-pack parachute, on a height-adjust frame' },
  14: { key: 'utility',     build: 'beaver',  name: 'Bush utility',      kg: 12.0, hw: 0.250, back: 0.66, rake: 12, tilt: 4,
        note: 'a painted tube frame, a pressed back panel with lightening holes, channel-pleated cushions' },
};
const PRESET_OF = t => SEAT_PRESETS[Math.round(t)] || null;

// ---- materials -----------------------------------------------------------------------------------------------------
// THE FINISH IS THE BUILDER'S (the user, 2 Nov: "can we keep their finish configurable through the existing finish
// interface?"): a material may name a LIVERY SECTION (o.sec) - 'seatTrim' the main upholstery (the section the default
// seat's cushion has always worn), 'seatFrame' the frame or shell, 'seatAccent' the inserts and secondary trim. It is
// then asked of the editor's own resolver (window.CAGE_SECMAT) with the preset's finish as the bottom-out `fin` and its
// tint as `tint0`: with nothing picked the seat wears its calibrated look, and a finish or tint picked on the section
// wins, exactly as on every other part. A section the finish table does not carry yet (seatFrame / seatAccent until the
// wiring lands) answers null and the preset's own material is used.
const MAT_POOL = new Map();
// ONE MATERIAL PER ROLE IN THE GAME (SEATS-COST, the user 3 Nov: "garage + world performance should remain
// unaffected"): at the levels the game builds (mid, phone) a seat wears at most FOUR materials - its first base, accent,
// seam and frame - and every other material it asks for folds into its role's (a second seam colour into the first;
// the untagged hardware - cast brackets, chrome, rubber, the rails - into the frame's). The hero (the seat studio's close
// stills) keeps every material. ROLE is reset per seat build (build() below).
// The hardware is asked for in no particular order (a preset may name its brackets before its frame), so an untagged
// material is a TOKEN until the seat is flushed: it then wears the preset's own frame material (the first tagged
// FRAME), or, on a preset with none, the first hardware asked for - and merges into that one bucket.
let ROLE = null;
const HARDWARE = { roleToken: 'seatFrame' };
function mat(finish, tint, o) {
  if (ROLE) {
    if (!(o && o.sec)) { if (!ROLE._hw) ROLE._hw = [finish, tint]; return HARDWARE; }
    if (!ROLE[o.sec]) ROLE[o.sec] = matOwn(finish, tint, o);
    return ROLE[o.sec];
  }
  return matOwn(finish, tint, o);
}
const roleFrame = () => ROLE.seatFrame || (ROLE.seatFrame = matOwn(ROLE._hw[0], ROLE._hw[1], FRAME));
function matOwn(finish, tint, o) {
  if (o && o.sec && typeof window !== 'undefined' && window.CAGE_SECMAT) {
    try {
      const m = window.CAGE_SECMAT(o.sec, { surf: 0, fieldM: 1, side: THREE.FrontSide, tint0: tint, fin: finish });
      if (m) return m;
    } catch (e) { /* the preset's own, below */ }
  }
  const o2 = o && o.sec ? Object.assign({}, o, { sec: undefined }) : o;
  const key = finish + '|' + tint + '|' + JSON.stringify(o2 || {});
  const A = (typeof window !== 'undefined' && window.AEROSKIN) || null;
  const on = A && A.aeroMaterial && (!A.aeroHardOn || A.aeroHardOn());
  const pk = (on ? 'A|' : 'F|') + key;
  if (MAT_POOL.has(pk)) return MAT_POOL.get(pk);
  let m = null;
  if (on) {
    try {
      m = A.aeroMaterial(THREE, Object.assign({ finish, tint, surf: 0, fieldM: 1, side: THREE.FrontSide,
                                               inside: (o2 && o2.inside != null) ? o2.inside : 1, decals: 0 }));
    } catch (e) { m = null; }
  }
  if (!m) {
    const row = (A && A.AERO_FINISH && A.AERO_FINISH[finish]) || {};
    m = (typeof MATLIB !== 'undefined' ? MATLIB : require('../src/viewer/matlib.js')).make(THREE, 'std', { color: tint, roughness: row.rough != null ? row.rough : 0.6,
                                         metalness: row.metal != null ? row.metal : 0 });
  }
  MAT_POOL.set(pk, m);
  return m;
}
const TRIM = { sec: 'seatTrim' }, FRAME = { sec: 'seatFrame' }, ACCENT = { sec: 'seatAccent' }, SEAM = { sec: 'seatSeam' };

// ---- the bag: one indexed buffer per material ----------------------------------------------------------------------
// THE PARTS (the bake, STEP 3): a seat is drawn as rigid parts the live rows move once it is baked - 'floor' (rails,
// rollers: they stay on the floor), 'stand' (legs: stretched by the stand height), 'pan' (the squab and what rides with
// it), 'back' (the back: turned about the hinge by the recline). A builder names the part it is drawing (B.part, or
// B.of(m, part)); a preset that names none is all 'pan'. Drawn live, the parts of one material merge back into one
// mesh (the draw count does not move); SEAT_GEN.splitParts (the baker) keeps them apart.
function Bags() {
  const bags = new Map();                  // material -> Map(part -> { pos, idx })
  const B = {
    part: 'pan',
    of(m, part) {
      const pk = part || B.part;
      let pm = bags.get(m); if (!pm) { pm = new Map(); bags.set(m, pm); }
      let b = pm.get(pk); if (!b) { b = { pos: [], idx: [] }; pm.set(pk, b); }
      return {
        v: p => { b.pos.push(p[0], p[1], p[2]); return b.pos.length / 3 - 1; },
        quad: (a, c, d, e) => { b.idx.push(a, c, d, a, d, e); },
        tri: (a, c, d) => { b.idx.push(a, c, d); },
      };
    },
    flush(parent) {
      let tris = 0, draws = 0;
      // the hardware token (one material per role, above): into the frame material's own bucket
      if (bags.has(HARDWARE) && ROLE) {
        const fm = roleFrame(), src = bags.get(HARDWARE);
        let dst = bags.get(fm); if (!dst) { dst = new Map(); bags.set(fm, dst); }
        for (const [pk, b] of src) {
          let d = dst.get(pk); if (!d) { d = { pos: [], idx: [] }; dst.set(pk, d); }
          const o = d.pos.length / 3; for (const v of b.pos) d.pos.push(v); for (const i of b.idx) d.idx.push(i + o);
        }
        bags.delete(HARDWARE);
      }
      const emit = (m, b, part) => {
        if (!b.idx.length) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
        g.setIndex(b.idx);
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, m);
        mesh.name = 'edSeatMesh';
        if (part) mesh.userData.seatPart = part;
        parent.add(mesh);
        tris += b.idx.length / 3; draws++;
      };
      for (const [m, pm] of bags) {
        if (API.splitParts) { for (const [pk, b] of pm) emit(m, b, pk); continue; }
        const all = { pos: [], idx: [] };
        for (const b of pm.values()) { const o = all.pos.length / 3; for (const v of b.pos) all.pos.push(v); for (const i of b.idx) all.idx.push(i + o); }
        emit(m, all, null);
      }
      return { tris, draws };
    },
  };
  return B;
}
// a path at the level: points closer than the level's step to the last kept one are dropped, unless the path turns
// there by more than ~25 degrees (a corner keeps its shape)
const STEP = [0, 0.015, 0.035];
const thin = (pts, closed) => {
  const st = STEP[LOD.lvl] || 0;
  if (!st || pts.length < 4) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const cs = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / ((Math.hypot(...u) * Math.hypot(...w)) || 1);
    if (d >= st || cs < 0.9) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return closed && out.length < 4 ? pts : out;
};
// GEAR_KIT draws into a bag with v(p) / quad / tri: ours speaks the same tongue
const kitTube = (bag, pts, r, sides, ends) => {
  const K = KIT(); if (!K || pts.length < 2) return;
  const path = thin(K.fillet(pts, r, det().fil));
  const P = [];
  sides = nRes(sides || 12, fine(2) ? 5 : 4);
  if (ends !== 'open' && !fine(1)) {     // flat-capped from level 1
    K.sweep(bag, path, () => K.secRound(r, sides), true);
    return;
  }
  if (ends !== 'open') {                 // domed ends, the crew's tubeRun idiom
    const t0 = K.nrm(K.sub(path[1], path[0])), t1 = K.nrm(K.sub(path[path.length - 1], path[path.length - 2]));
    for (const th of [0, 35, 65]) P.push({ p: K.off(path[0], t0, -r * Math.cos(th * D2R)), s: Math.max(0.02, Math.sin(th * D2R)) });
    for (const p of path) P.push({ p, s: 1 });
    for (const th of [65, 35, 0]) P.push({ p: K.off(path[path.length - 1], t1, r * Math.cos(th * D2R)), s: Math.max(0.02, Math.sin(th * D2R)) });
  } else for (const p of path) P.push({ p, s: 1 });
  K.sweep(bag, P.map(q => q.p), (t, i) => K.secRound(r * P[i].s, sides || 12), false);
};
// a closed loop of points swept round (piping, stitch lines, a rim bead)
const kitLoop = (bag, pts, r, sides) => {
  const K = KIT(); if (!K || pts.length < 3) return;
  pts = thin(pts, true);
  K.sweep(bag, pts.concat([pts[0], pts[1]]), () => K.secRound(r, nRes(sides || 6, 4)), false);
};
const kitLine = (bag, pts, r, sides) => {
  const K = KIT(); if (!K || pts.length < 2) return;
  K.sweep(bag, thin(pts), () => K.secRound(r, nRes(sides || 5, 3)), true);
};

// ---- the spine: a side profile (y, z) as an arc-length curve -------------------------------------------------------
// pts run from the seat's front edge, aft along the pan, round the hinge and up the back. n is the normal TOWARD THE
// OCCUPANT (t = (ty, tz) -> n = (-tz, ty): up on the pan, forward on the back).
function spine(pts, r) {
  const K = KIT();
  const p3 = pts.map(q => [0, q[0], q[1]]);
  const f = K.resample(r > 0 ? K.fillet(p3, r, 8) : p3, 96);
  const P = f.map(q => [q[1], q[2]]);
  const S = [0];
  for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = S[S.length - 1];
  const at = s => {
    s = clamp(s, 0, L);
    let i = 0; while (i < P.length - 2 && S[i + 1] < s) i++;
    const u = (s - S[i]) / Math.max(1e-9, S[i + 1] - S[i]);
    const p = [P[i][0] + (P[i + 1][0] - P[i][0]) * u, P[i][1] + (P[i + 1][1] - P[i][1]) * u];
    // the tangent, smoothed across the sample so the normal does not step
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 2)];
    let ty = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(ty, tz) || 1; ty /= l; tz /= l;
    return { p, t: [ty, tz], n: [-tz, ty] };
  };
  // the arc length at the sample nearest a profile point (to place things on the curve)
  const sOf = q => { let best = 0, bd = 1e9; for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - q[0], P[i][1] - q[1]); if (d < bd) { bd = d; best = S[i]; } } return best; };
  return { L, at, sOf };
}

// ---- THE SLAB ------------------------------------------------------------------------------------------------------
// o: { sx, sp (spine), s0, s1 (the stretch of the spine it covers), hw (half-width, or hwAt(v)), th (half-thickness),
//      r (edge radius), face: true when the spine is the OCCUPIED face (the slab hangs behind it), lift (offset along
//      n), crown, crownAt(u, v), wing(u, v) -> [dt, dx] (toward the occupant, inward), groove(u, v) -> depth,
//      nx, ns, nt (lattice), ends (round the ends along s too: default true) }
// returns { map(x, s, t) -> world point, o } so the caller lays piping and stitching on the same surface
function edgeCoords(h, r, nIn, nE) {
  const out = [];
  const E = nE || 3;
  r = Math.min(r, h * 0.999);
  for (let k = 0; k < E; k++) out.push(-(h - r) - r * Math.cos((k / E) * Math.PI / 2));
  for (let k = 0; k <= nIn; k++) out.push(-(h - r) + 2 * (h - r) * k / Math.max(1, nIn));
  for (let k = E - 1; k >= 0; k--) out.push((h - r) + r * Math.cos((k / E) * Math.PI / 2));
  // dedupe near-equal (an h == r axis collapses the interior)
  const o2 = [];
  for (const v of out) if (!o2.length || v - o2[o2.length - 1] > 1e-6) o2.push(v);
  return o2;
}
function slab(bag, o) {
  const hs = (o.s1 - o.s0) / 2, sc = (o.s0 + o.s1) / 2;
  const onS = o.on ? sc - o.on.sc : 0;                   // s0 / s1 are in the base's own arc length
  const hw0 = o.hw, th = o.th, r = Math.min(o.r, th * 0.999);
  const rs = o.ends === false ? 1e-4 : Math.min(o.rs != null ? o.rs : r, hs * 0.5);
  const nE = Math.min(o.nE || 3, det().nE);
  const mn = fine(2) ? 2 : 1;
  const xs = edgeCoords(hw0, Math.min(o.rx != null ? o.rx : r, hw0 * 0.5), nRes(o.nx || 14, mn), nE);
  const ss = edgeCoords(hs, rs, nRes(o.ns || 24, mn), nE);
  const ts = edgeCoords(th, r, fine(1) ? (o.nt || 1) : 1, nE);
  const grK = det().gr;
  const hwAt = o.hwAt || (() => 1);
  const map = (x, s, t) => {
    const u = clamp(x / hw0, -1.2, 1.2), v = clamp(s / hs, -1.2, 1.2), tn = clamp(t / th, -1, 1);
    const top = (tn + 1) / 2;
    let dt = 0, dx = 0;
    if (o.crown) dt += o.crown * Math.pow(Math.max(0, 1 - u * u), 1.2) * Math.pow(Math.max(0, 1 - v * v), 0.8) * top;
    if (o.crownAt) dt += o.crownAt(u, v) * top;
    if (o.groove && grK) dt -= grK * o.groove(u, v) * smooth(0.2, 0.9, tn);
    if (o.wing) { const w = o.wing(u, v); dt += w[0]; dx += w[1] || 0; }
    const xw = x * hwAt(v) - Math.sign(x) * dx;
    // ON ANOTHER SLAB (o.on): a pad laid in a shell is built in the SHELL'S own surface coordinates - its underside is
    // the shell's occupied face (gap above it), so it rides the shell's walls, wings and curves and can never cut them
    // ...and its TOP STAYS FLAT (the user, 2 Nov: "keep the top face flat, or almost, and bend the bottom face, the one
    // in contact with the seat, otherwise it looks cheap"): the underside rides the shell; the top is a level across
    // the seat at the pad's thickness over the shell's centre line, never thinner than 60 % of it where a wall rises
    if (o.on) {
      const g0 = (o.gap != null ? o.gap : 0.0008) + (o.lift || 0), b0 = o.on.th + g0, sO = s + onS, xO = xw + (o.onX || 0);
      const Bt = o.on.map(xO, sO, b0), C0 = o.on.map(o.onX || 0, sO, b0), C1 = o.on.map(o.onX || 0, sO, b0 + 0.01);
      let nx = C1[0] - C0[0], ny = C1[1] - C0[1], nz = C1[2] - C0[2]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const hb = (Bt[0] - C0[0]) * nx + (Bt[1] - C0[1]) * ny + (Bt[2] - C0[2]) * nz;
      const ht = Math.max(2 * th, hb + 1.2 * th);
      const k = (t + th) / (2 * th) * (ht - hb) + dt;
      return [Bt[0] + nx * k, Bt[1] + ny * k, Bt[2] + nz * k];
    }
    const q = o.sp.at(sc + s);
    const tt = t + dt + (o.face ? -th : 0) + (o.lift || 0);
    return [o.sx + xw, q.p[0] + q.n[0] * tt, q.p[1] + q.n[1] * tt];
  };
  // the rounded box: every lattice point on the box's surface, projected onto its radius
  const NX = xs.length, NS = ss.length, NT = ts.length;
  const id = new Map();
  const rx = Math.min(o.rx != null ? o.rx : r, hw0 * 0.5);
  // the box's point onto its radii (per-axis radii: projected in the space where every radius is 1); `out` pushes it
  // that far beyond the surface along the rounding's own normal (a welt laid ON the edge)
  const round = (p, out) => {
    p = p.slice();
    const h = [hw0, hs, th], rr = [rx, rs, r], q = [], d = [];
    for (let c = 0; c < 3; c++) { const lim = h[c] - rr[c]; q.push(clamp(p[c], -lim, lim)); d.push((p[c] - q[c]) / Math.max(1e-9, rr[c])); }
    const dl = Math.hypot(d[0], d[1], d[2]);
    if (dl > 1e-9) for (let c = 0; c < 3; c++) p[c] = q[c] + rr[c] * d[c] / dl * (1 + (out || 0) / Math.max(1e-9, Math.min(rx, rs, r)));
    return p;
  };
  const vtx = (i, j, k) => {
    const key = (i * NS + j) * NT + k;
    let v = id.get(key);
    if (v != null) return v;
    const p = round([xs[i], ss[j], ts[k]], 0);
    v = bag.v(map(p[0], p[1], p[2]));
    id.set(key, v);
    return v;
  };
  const N = [NX, NS, NT];
  const face = (a, side) => {
    // the two in-plane axes, ordered so (b x c) points along side * a
    let b = (a + 1) % 3, c = (a + 2) % 3;
    if (side < 0) { const t = b; b = c; c = t; }
    const ia = side > 0 ? N[a] - 1 : 0;
    for (let i = 0; i < N[b] - 1; i++) for (let j = 0; j < N[c] - 1; j++) {
      const ix = (ib, jc) => { const g = [0, 0, 0]; g[a] = ia; g[b] = ib; g[c] = jc; return vtx(g[0], g[1], g[2]); };
      bag.quad(ix(i, j), ix(i + 1, j), ix(i + 1, j + 1), ix(i, j + 1));
    }
  };
  for (let a = 0; a < 3; a++) { face(a, 1); face(a, -1); }
  return { map, round, hw: hw0, hs, th, r, rx, rs, sc };
}
// a rounded rectangle in (x, s), as a loop: ex, es the half extents, rc the corner radius
function rrect(ex, es, rc, n) {
  const out = [], N = n || 5;
  rc = Math.min(rc, ex * 0.95, es * 0.95);
  const c = [[ex - rc, es - rc, 0], [-(ex - rc), es - rc, 90], [-(ex - rc), -(es - rc), 180], [ex - rc, -(es - rc), 270]];
  for (const [cx, cs, a0] of c) for (let k = 0; k <= N; k++) {
    const a = (a0 + 90 * k / N) * D2R;
    out.push([cx + rc * Math.cos(a), cs + rc * Math.sin(a)]);
  }
  return out;
}
// densify a loop so a swept bead follows a curved surface
function dens(loop, step) {
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
// the piping: a welt round the slab's occupied face where the face turns into the side (the 45-degree line)
function piping(bag, S, R, side) {
  if (!fine(2)) return;
  // THE WELT IS ON THE EDGE (the user, 2 Nov: "seams need to match better"): the occupied face's boundary rectangle,
  // taken through the slab's OWN rounding (the 3D box edge lands on the 45-degree line of the radius, the corner on the
  // octant's centre) and mapped through its own fields - so the piping follows the cushion exactly, corners included.
  // side -1 lays it on the back face's edge instead.
  const t = (side || 1) * S.th, rc = Math.max(S.rx, S.rs) * 1.3;
  const P = [];
  const run = (a, b) => {
    const L2 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let u = 0;
    while (u < L2) {
      P.push([a[0] + (b[0] - a[0]) * u / L2, a[1] + (b[1] - a[1]) * u / L2]);
      const x = a[0] + (b[0] - a[0]) * u / L2, s2 = a[1] + (b[1] - a[1]) * u / L2;
      const nearC = (S.hw - Math.abs(x) < rc) && (S.hs - Math.abs(s2) < rc);
      u += (nearC ? 0.0035 : 0.02) / det().k;
    }
  };
  const ex = S.hw, es = S.hs;
  run([ex, -es], [ex, es]); run([ex, es], [-ex, es]); run([-ex, es], [-ex, -es]); run([-ex, -es], [ex, -es]);
  const loop = P.map(q => { const p = S.round([q[0], q[1], t], R * 0.35); return S.map(p[0], p[1], p[2]); });
  kitLoop(bag, loop, R, 7);
}
// the rolled rim of a moulded shell: a bead along all four edges of the slab (sides AND ends, following the surface -
// a chord across the end would float in front of a curved shell)
function rimBead(bag, S, R) {
  if (!fine(2)) return;                    // the phone level: the shell's own edge
  const loop = [], NS = nRes(70, 12), NX = nRes(16, 4), ex = S.hw * 0.999, es = S.hs * 0.999;
  for (let k = 0; k < NS; k++) loop.push([ex, -es + 2 * es * k / NS]);
  for (let k = 0; k < NX; k++) loop.push([ex - 2 * ex * k / NX, es]);
  for (let k = 0; k < NS; k++) loop.push([-ex, es - 2 * es * k / NS]);
  for (let k = 0; k < NX; k++) loop.push([-ex + 2 * ex * k / NX, -es]);
  kitLoop(bag, loop.map(q => S.map(q[0], q[1], 0)), R, 8);
}
// THE SKIN: an insert laid ON a slab's occupied face (a cloth panel in a vinyl cushion, a quilted centre in a leather
// bolster, a pad sewn on a sling) - a single sheet that follows the base's own surface (crown, wings, pleats and all)
// d above it, its border tucked tuck under it the way a sewn panel turns into its seam, its corners rounded
// (a superellipse). o: { u0, u1, v0, v1 (the region, normalised -1..1 on the base), d, tuck, nx, ns, n (corner
// squareness), groove(a, b) (the skin's own quilting, a / b -1..1 across its region, < d) }
function skin(bag, S, o) {
  const NX = nRes(o.nx || 14, 3), NS = nRes(o.ns || 16, 3), n = o.n || 6, d = o.d != null ? o.d : 0.003, tuck = o.tuck != null ? o.tuck : 0.004;
  const grK = det().gr;
  const at = (a, b, dd) => {
    const ma = Math.max(Math.abs(a), Math.abs(b));
    const k = ma > 1e-9 ? ma / Math.pow(Math.pow(Math.abs(a), n) + Math.pow(Math.abs(b), n), 1 / n) : 1;
    const a2 = a * k, b2 = b * k;
    const u = o.u0 + (a2 + 1) / 2 * (o.u1 - o.u0), v = o.v0 + (b2 + 1) / 2 * (o.v1 - o.v0);
    return S.map(u * S.hw, v * S.hs, S.th + dd);
  };
  const id = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NS; j++) {
      const a = -1 + 2 * i / NX, b = -1 + 2 * j / NS;
      const e = Math.min(i, NX - i, j, NS - j);
      // the phone level: the base's few facets cut between the exact surface's points, so the skin lifts clear of
      // them and its border stops short of tucking under (a raised panel at that distance, not a patchwork)
      const dd = !fine(2) ? (e === 0 ? d * 1.6 : d * 1.6 + 0.007)
               : !fine(1) ? (e === 0 ? -tuck * 0.3 : (e === 1 ? d + 0.002 : d + 0.003 - (o.groove && grK ? grK * o.groove(a, b) : 0)))
               : e === 0 ? -tuck : (e === 1 ? d * 0.7 : d - (o.groove && grK ? grK * o.groove(a, b) : 0));
      row.push(bag.v(at(a, b, dd)));
    }
    id.push(row);
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NS; j++) bag.quad(id[i][j], id[i + 1][j], id[i + 1][j + 1], id[i][j + 1]);
  return { at, NX, NS, d };
}
// THE BINDING round a skin's edge (a sheepskin's leather tape): a welt laid along the skin's OWN second ring - the
// very grid points its edge turns down from - so it sits on the edge and nowhere else
function skinBind(bag, K, R) {
  if (!fine(2)) return;
  const ring = [];
  const NX = K.NX, NS = K.NS, a1 = 1 - 2 / NX, b1 = 1 - 2 / NS;
  const step = 0.25;
  for (let i = 1; i <= NX - 1; i += step) ring.push([-1 + 2 * i / NX, -b1]);
  for (let j = 1; j <= NS - 1; j += step) ring.push([a1, -1 + 2 * j / NS]);
  for (let i = NX - 1; i >= 1; i -= step) ring.push([-1 + 2 * i / NX, b1]);
  for (let j = NS - 1; j >= 1; j -= step) ring.push([-a1, -1 + 2 * j / NS]);
  kitLoop(bag, ring.map(q => K.at(q[0], q[1], K.d * 0.55)), R, 8);
}
// the stitch round a skin, a few millimetres inside its seam
function skinStitch(bag, K, inset, R) {
  if (!fine(1)) return;
  const pts = [];
  const N = 60;
  const e = 1 - inset;
  for (let k = 0; k < N; k++) { const t = 2 * Math.PI * k / N; const c = Math.cos(t), s2 = Math.sin(t);
    const m = Math.pow(Math.pow(Math.abs(c), 6) + Math.pow(Math.abs(s2), 6), 1 / 6);
    pts.push(K.at(e * c / m, e * s2 / m, 0.0042)); }
  kitLoop(bag, pts, R || 0.0011, 4);
}
// THE SEAM CHANNEL an insert tucks into: a narrow groove in the base along the insert's (superellipse) border - the
// region in the base's normalised (u, v), w its width in normalised border units, depth in metres
const seamRing = (u0, u1, v0, v1, w, depth, n) => (u, v) => {
  const a = (2 * (u - u0) / (u1 - u0)) - 1, b = (2 * (v - v0) / (v1 - v0)) - 1, N = n || 6;
  const m = Math.pow(Math.pow(Math.abs(a), N) + Math.pow(Math.abs(b), N), 1 / N);
  return depth * Math.exp(-(((m - 1) / w) ** 2));
};
// a mask: 1 inside a normalised region of a slab, 0 outside, soft over w
const region = (u0, u1, v0, v1, w) => (u, v) => smooth(u0 - w, u0 + w, u) * (1 - smooth(u1 - w, u1 + w, u)) *
                                                smooth(v0 - w, v0 + w, v) * (1 - smooth(v1 - w, v1 + w, v));
// a stitch line on the occupied face, inset from the rim (contrast stitching reads at a metre as a fine line)
function stitchLoop(bag, S, inset, R) {
  if (!fine(1)) return;
  const loop = dens(rrect(S.hw - S.rx - inset, S.hs - S.rs - inset, 0.03, 4), 0.015)
    .map(q => S.map(q[0], q[1], S.th + 0.0012));
  kitLoop(bag, loop, R || 0.0011, 4);
}
// a stitch line along s at a fixed x (a bolster's seam), or along x at a fixed s
function stitchRun(bag, S, x0, x1, s0, s1, R, lift) {
  if (!fine(1)) return;
  const pts = [];
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, s1 - s0) / 0.015));
  for (let k = 0; k <= n; k++) pts.push(S.map(x0 + (x1 - x0) * k / n, s0 + (s1 - s0) * k / n, S.th + (lift || 0.0012)));
  kitLine(bag, pts, R || 0.0011, 4);
}
// a groove field: Gaussian channels at the given normalised stations along v (pleats) or u (flutes)
const grooves = (at, w, depth, axis, uMask) => (u, v) => {
  const q = axis === 'u' ? u : v;
  let g = 0;
  for (const a of at) { const d = (q - a) / w; g += Math.exp(-d * d); }
  const m = uMask ? (1 - smooth(uMask, uMask + 0.12, Math.abs(axis === 'u' ? v : u))) : 1;
  return depth * Math.min(1, g) * m;
};

// ---- the shared stance -----------------------------------------------------------------------------------------------
// the occupied lines (see THE SEATING REFERENCE) and the cabin fit
function stance(A, P, g, pre, sbs) {
  const capW = sbs ? A.halfW * 0.47 : A.halfW * 0.66;
  const kx = Math.min(1, capW / pre.hw);
  const H = [g.panY + 0.065, g.zBack + 0.06];               // the hinge on the occupied faces (y, z)
  const panL = 0.43;
  const F = [H[0] + panL * Math.sin(g.tilt), H[1] + panL * Math.cos(g.tilt)];
  const bc = Math.cos(g.rake), bs = Math.sin(g.rake);
  const room = Math.max(0.40, (A.roofY - 0.03) - H[0]);
  const backL = Math.min(pre.back, room / Math.max(0.5, bc));
  const B = [H[0] + backL * bc, H[1] - backL * bs];
  const up = [bc, -bs];                                       // along the back, upward (y, z)
  const fwd = [bs, bc];                                       // the back's normal toward the occupant
  return { kx, H, F, B, panL, backL, bc, bs, up, fwd, hw: pre.hw * kx, sx: g.sx, floor: g.floor,
           fit: kx < 0.999 || backL < pre.back - 1e-3 ? { kx, backL } : null };
}
const yz = (y, z) => [y, z];
const ptB = (S, k, off) => [S.H[0] + S.up[0] * k + S.fwd[0] * (off || 0), S.H[1] + S.up[1] * k + S.fwd[1] * (off || 0)];
const ptP = (S, k, g, off) => [S.H[0] + Math.sin(g.tilt) * k + (off || 0), S.H[1] + Math.cos(g.tilt) * k];

// the floor rails every adjustable seat runs on: a top-hat alloy extrusion with its row of adjust holes
function seatRails(B, mRail, mHole, A, x, z0, z1, gauge) {
  const K = KIT();
  for (const sd of [-1, 1]) {
    const xr = x + sd * gauge;
    const bag = B.of(mRail);
    const path = [];
    for (let k = 0; k <= 8; k++) { const z = z0 + (z1 - z0) * k / 8; path.push([xr, A.floorAt(z) + 0.001, z]); }
    // the section: a flanged hat 34 mm wide, 14 mm tall (u = up, v = across)
    const sec = fine(2) ? [[0, -0.017], [0.003, -0.017], [0.003, -0.009], [0.014, -0.008], [0.016, -0.006], [0.016, 0.006],
                 [0.014, 0.008], [0.003, 0.009], [0.003, 0.017], [0, 0.017]]
                        : [[0, -0.017], [0.016, -0.008], [0.016, 0.008], [0, 0.017]];
    K.sweep(bag, fine(1) ? path : [path[0], path[path.length - 1]], () => sec, true, [0, 1, 0]);
    if (!fine(1)) continue;
    const hb = B.of(mHole);
    const n = Math.floor((z1 - z0 - 0.04) / 0.026);
    for (let k = 0; k <= n; k++) {
      const z = z0 + 0.02 + k * 0.026;
      K.revolve(hb, [xr, A.floorAt(z) + 0.0172, z], [0, 1, 0], [[0.0042, 0], [0.0042, 0.0006], [0, 0.0006]], 8, false);
    }
  }
}

// ---- 3. CARBON BUCKET (the reworked composite seat) ---------------------------------------------------------------
// The old shell (seatType 1) is a profile swept across x with a parabola for a bolster: a trough. This is a moulded
// bucket: one shell with real side walls that rise into thigh and shoulder bolsters, an integrated headrest with
// a radiused rim bead all round, a two-piece Alcantara-style pad set into it, and two machined
// brackets onto alloy rails.
function seatCarbon(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mShell = mat('composite', 0x2a2d31, FRAME), mPad = mat('liner', 0x2c2e33, TRIM), mSt = mat('plasticScr', 0xb8322a, SEAM),
        mAlu = mat('bareAlu', 0xb6bcc3), mCast = mat('castAlu', 0x8e949a), mDark = mat('rubber', 0x18191c);
  // the shell's occupied face sits 30 mm under the reference (the pad is 30 mm)
  const pad = 0.030;
  const sp = spine([ptP(S, S.panL + 0.035, g, -0.035), ptP(S, S.panL, g), S.H, ptB(S, S.backL), ptB(S, S.backL + 0.02, -0.03)], 0.09);
  const sH = sp.sOf(S.H), L = sp.L;
  const sHead = sp.sOf(ptB(S, S.backL - 0.20));
  const wing = (u, v) => {
    const s = (v + 1) / 2 * L;                                       // 0 front lip .. L top
    const onPan = 1 - smooth(sH - 0.05, sH + 0.10, s);
    const onHead = smooth(sHead - 0.04, sHead + 0.06, s);
    const hgt = onPan * 0.075 + (1 - onPan) * (0.115 - 0.075 * onHead);
    const front = smooth(0, 0.18, s);                                // the thigh bolster fades into the lip
    const a = Math.abs(u);
    return [hgt * front * smooth(0.52, 1.0, a), 0.05 * pre.hw * smooth(0.6, 1.0, a) * front];
  };
  const hwAt = v => { const s = (v + 1) / 2 * L; return 1 - 0.30 * smooth(sHead - 0.10, sHead + 0.02, s) * S.kx / S.kx; };
  const sh = slab(B.of(mShell), { sx: S.sx, sp, s0: 0, s1: L, hw: S.hw, hwAt, th: 0.0045, r: 0.0044, rs: 0.0044,
                                  face: true, lift: -pad, wing, nx: 22, ns: 54, nt: 1, nE: 3 });
  // the rim bead: the shell's cut edge is rolled, not sawn
  rimBead(B.of(mShell), sh, 0.0065);
  // the pads: a squab and a back, set inside the walls; the back's centre is fluted
  const padHW = S.hw * 0.66;
  const sq = slab(B.of(mPad), { on: sh, sx: S.sx, sp, s0: 0.03, s1: sH - 0.035, hw: padHW, th: pad / 2 + 0.002, r: 0.012,
                                face: true, crown: 0.006, nx: 12, ns: 10, nt: 2,
                                groove: grooves([-0.3, 0.3], 0.07, 0.004, 'u') });
  const bk = slab(B.of(mPad), { on: sh, sx: S.sx, sp, s0: sH + 0.04, s1: sHead - 0.02, hw: padHW * 0.92, th: pad / 2 + 0.002,
                                r: 0.012, face: true, crown: 0.005, nx: 12, ns: 14, nt: 2,
                                groove: grooves([-0.35, 0.35], 0.06, 0.004, 'u') });
  const hd = slab(B.of(mPad), { on: sh, sx: S.sx, sp, s0: sHead + 0.03, s1: L - 0.05, hw: padHW * 0.58, th: pad / 2, r: 0.011,
                                face: true, crown: 0.006, nx: 8, ns: 6, nt: 2 });
  for (const P2 of [sq, bk]) stitchLoop(B.of(mSt), P2, 0.012, 0.0010);
  // the mounts: a side-mount pair of machined alloy L-brackets under the shell's belly - a short web bolted through the
  // shell's floor, a tube leg fore and aft down to a clamp block on each rail
  const zf = S.F[1] - 0.05, za = S.H[1] - 0.04;
  {
    const K = KIT(), cb = B.of(mCast), ab = B.of(mAlu);
    const belly = (x, z) => { const s = sp.sOf([S.H[0], z]); return sh.map(x - S.sx, s - L / 2, -sh.th); };
    for (const sd of [-1, 1]) {
      const x = S.sx + sd * S.hw * 0.42;
      const pf = belly(x, zf), pa = belly(x, za);
      // the web: a flat bar along the belly, 40 mm deep
      kitTube(ab, [[x, pf[1] - 0.012, pf[2]], [x, pa[1] - 0.012, pa[2]]], 0.010, 10);
      for (const p of [pf, pa]) {
        const ft = [x, A.floorAt(p[2]) + 0.03, p[2]];
        kitTube(ab, [[x, p[1] - 0.012, p[2]], ft], 0.011, 12);
        K.boxIn(cb, [x, A.floorAt(p[2]) + 0.022, p[2]], [0.013, 0.008, 0.024], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
        K.bolt(B.of(mAlu), [x + sd * 0.014, A.floorAt(p[2]) + 0.022, p[2]], [sd, 0, 0], 0.005, 0.004);
        K.bolt(B.of(mAlu), [x, p[1] - 0.004, p[2]], [0, 1, 0], 0.006, 0.004);
      }
    }
  }
  seatRails(B, mAlu, mDark, A, S.sx, za - 0.14, zf + 0.12, S.hw * 0.42);
  return S;
}

// ---- 4. CESSNA 172 ----------------------------------------------------------------------------------------------------
// The 172's front seat: a pressed pan and tube frame on four rollers in two floor rails (the fore/aft pin and its bar
// handle under the front), a back hinged at the pan with a recline lever, upholstered as the factory did - a cloth
// insert in a vinyl surround, horizontal pleats in the back, a squab with a front roll, piping on every edge, a moulded
// back shell with a map pocket, and the late-model tall back with its headrest zone.
function seatC172(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mVinyl = mat('leatherDark', 0x6f6a62, TRIM), mCloth = mat('liner', 0x5d6470, ACCENT), mPipe = mat('leatherDark', 0x4a4640, SEAM),
        mShell = mat('plastic', 0xb9b2a3), mFrame = mat('trim', 0x40444a, FRAME), mAlu = mat('bareAlu', 0xb6bcc3),
        mChrome = mat('chrome', 0xdfe5ec), mKnob = mat('plasticScr', 0x1c1e22), mDark = mat('rubber', 0x1b1c20);
  B.part = 'pan';
  // the squab: a vinyl base cushion with a front roll, the cloth insert laid in it
  const spP = spine([ptP(S, S.panL + 0.02, g, -0.03), ptP(S, S.panL, g), S.H, ptB(S, 0.08)], 0.05);
  const sH = spP.sOf(S.H);
  const thP = 0.045;
  const inSq = region(-0.56, 0.56, -0.62, 0.72, 0.06);       // the pleats fade out well inside the insert
  const seamSq = seamRing(-0.70, 0.70, -0.80, 0.88, 0.035, 0.007);
  const sq = slab(B.of(mVinyl), { sx: S.sx, sp: spP, s0: 0.0, s1: sH - 0.005, hw: S.hw, th: thP, r: 0.028, rs: 0.04,
                                  face: true, nx: 18, ns: 20, nt: 4,
                                  crownAt: (u, v) => 0.012 * smooth(0.55, 0.95, Math.abs(u)) + 0.008 * smooth(0.5, 0.9, -v),
                                  crown: 0.006,
                                  groove: (u, v) => inSq(u, v) * grooves([-0.38, 0.05, 0.48], 0.07, 0.008, 'v')(u, v) + seamSq(u, v) });
  piping(B.of(mPipe), sq, 0.0045);
  const ins = skin(B.of(mCloth), sq, { u0: -0.70, u1: 0.70, v0: -0.80, v1: 0.88, d: 0.0025, tuck: 0.007, nx: 22, ns: 24 });
  skinStitch(B.of(mPipe), ins, 0.03, 0.0011);
  B.part = 'back';
  // the back: vinyl surround, cloth insert with horizontal pleats, the headrest zone above a seam
  const spB = spine([ptB(S, 0.02), ptB(S, S.backL * 0.55), ptB(S, S.backL)], 0);
  const thB = 0.042;
  const inBk = region(-0.54, 0.54, -0.78, 0.30, 0.06);
  const seamBk = seamRing(-0.68, 0.68, -0.92, 0.42, 0.03, 0.007);
  const bk = slab(B.of(mVinyl), { sx: S.sx, sp: spB, s0: 0, s1: spB.L, hw: S.hw * 0.97, th: thB, r: 0.03, rs: 0.05,
                                  face: true, nx: 18, ns: 26, nt: 4,
                                  hwAt: v => 1 - 0.10 * smooth(0.55, 1.0, v),
                                  crownAt: (u, v) => 0.014 * smooth(0.6, 0.95, Math.abs(u)) * (1 - smooth(0.4, 0.7, v)) + 0.010 * Math.exp(-(((v + 0.35) / 0.25) ** 2)) * (1 - u * u),
                                  groove: (u, v) => grooves([0.50], 0.035, 0.010, 'v')(u, v) +
                                    inBk(u, v) * grooves([-0.60, -0.36, -0.12, 0.12], 0.05, 0.008, 'v')(u, v) + seamBk(u, v) });
  piping(B.of(mPipe), bk, 0.0045);
  const bins = skin(B.of(mCloth), bk, { u0: -0.68, u1: 0.68, v0: -0.92, v1: 0.42, d: 0.0025, tuck: 0.007, nx: 22, ns: 30 });
  skinStitch(B.of(mPipe), bins, 0.025, 0.0011);
  // the moulded back shell behind it: it wraps the cushion's sides and top, with a map pocket
  slab(B.of(mShell), { sx: S.sx, sp: spB, s0: -0.01, s1: spB.L + 0.006, hw: S.hw * 0.97 + 0.014, th: 0.010, r: 0.0095, rx: 0.0095, rs: 0.0095,
                       face: true, lift: -2 * thB - 0.001, hwAt: v => 1 - 0.10 * smooth(0.55, 1.0, v),
                       nx: 16, ns: 22, nt: 1,
                       wing: (u, v) => [0.040 * smooth(0.945, 1.0, Math.abs(u)), 0],
                       crownAt: (u, v) => -0.012 * (1 - u * u) });
  slab(B.of(mShell), { sx: S.sx, sp: spB, s0: spB.L * 0.12, s1: spB.L * 0.42, hw: S.hw * 0.72, th: 0.006, r: 0.0055,
                       face: true, lift: -2 * thB - 0.02, nx: 10, ns: 8, nt: 1, crownAt: (u, v) => -0.006 * (1 - u * u) * smooth(-1, 0.2, v) });
  B.part = 'stand';
  // the frame: two side frames of 1-inch tube on rollers, the pan's cross tubes, the back's uprights to the hinge boss
  const K = KIT(), fb = B.of(mFrame);
  const gauge = S.hw * 0.66;
  const zA = S.H[1] - 0.02, zF = S.F[1] - 0.04;
  const yPan = (z) => S.H[0] - thP * 2 - 0.012 + (z - S.H[1]) * Math.tan(g.tilt);
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * gauge;
    // the runner on the rail, the front leg up to the pan, the rear leg up to the hinge
    const fy = z => A.floorAt(z) + 0.034;
    kitTube(B.of(mFrame, 'stand'), [[x, fy(zA - 0.02), zA - 0.02], [x, fy(zF), zF], [x, yPan(zF), zF - 0.01], [x, yPan(zA), zA], [x, fy(zA - 0.02), zA - 0.02]], 0.011, 12);
    kitTube(B.of(mFrame, 'stand'), [[x, fy(zA + 0.04), zA + 0.04], [x, yPan(zF - 0.08), zF - 0.08]], 0.008, 10);
    // the rollers: four in the rails
    for (const z of [zA - 0.02, zF]) {
      K.revolve(B.of(mDark, 'floor'), [x - 0.012, A.floorAt(z) + 0.022, z], [1, 0, 0], [[0, 0], [0.012, 0], [0.013, 0.003], [0.013, 0.021], [0.012, 0.024], [0, 0.024]], 14, false);
      K.bolt(B.of(mChrome, 'floor'), [x - sd * 0.016, A.floorAt(z) + 0.022, z], [sd, 0, 0], 0.005, 0.004);
    }
    // the hinge boss and the back's upright behind the shell
    const hb = [x * 1.0, S.H[0] - 0.05, S.H[1] - 0.045];
    K.revolve(B.of(mFrame, 'back'), [x - 0.014, hb[1], hb[2]], [1, 0, 0], [[0, 0], [0.018, 0], [0.020, 0.004], [0.020, 0.024], [0.018, 0.028], [0, 0.028]], 16, false);
    const top = ptB(S, S.backL * 0.92, -2 * thB - 0.006);
    kitTube(B.of(mFrame, 'back'), [[x, hb[1], hb[2]], [x, top[0], top[1]]], 0.009, 10);
  }
  for (const z of [zA, zF - 0.01]) kitTube(B.of(mFrame, 'pan'), [[S.sx - gauge - 0.01, yPan(z), z], [S.sx + gauge + 0.01, yPan(z), z]], 0.010, 10);
  {
    const top = ptB(S, S.backL * 0.92, -2 * thB - 0.006);
    kitTube(B.of(mFrame, 'back'), [[S.sx - gauge, top[0], top[1]], [S.sx + gauge, top[0], top[1]]], 0.009, 10);
  }
  B.part = 'pan';
  // the pan: a pressed sheet under the squab
  {
    const pb = B.of(mFrame);
    const y0 = yPan(zA) + 0.004, y1 = yPan(zF) + 0.004;
    K.boxIn(pb, [S.sx, (y0 + y1) / 2, (zA + zF) / 2], [S.hw * 0.86, 0.004, (zF - zA) / 2 + 0.01],
            [1, 0, 0], [0, Math.cos(g.tilt), -Math.sin(g.tilt)], [0, Math.sin(g.tilt), Math.cos(g.tilt)]);
  }
  // the fore/aft adjust: the bar handle under the front edge, and the recline lever on the outboard side
  {
    const z = S.F[1] - 0.005, y = yPan(zF) - 0.03;
    kitTube(B.of(mChrome), [[S.sx - 0.07, y + 0.02, z - 0.03], [S.sx - 0.07, y, z + 0.015], [S.sx + 0.07, y, z + 0.015], [S.sx + 0.07, y + 0.02, z - 0.03]], 0.0065, 10);
    const sd = S.sx >= 0 ? 1 : -1;                         // outboard: away from the centreline
    const x = S.sx + sd * (S.hw + 0.012);
    const p0 = [x, S.H[0] - 0.05, S.H[1] - 0.02];
    const p1 = [x, S.H[0] - 0.035, S.H[1] + 0.14];
    kitTube(B.of(mChrome), [p0, p1], 0.0055, 10);
    K.revolve(B.of(mKnob), p1, [0, 0.12, 1], [[0, 0], [0.011, 0.004], [0.012, 0.02], [0.010, 0.034], [0, 0.038]], 14, false);
  }
  B.part = 'floor';
  seatRails(B, mAlu, mDark, A, S.sx, zA - 0.30, zF + 0.30, gauge);
  return S;
}

// ---- 5. ICON A5 --------------------------------------------------------------------------------------------------------
// A sculpted seat in the modern sports-car idiom: a gloss moulded shell, wide and low, whose sides sweep up into thigh
// and shoulder bolsters and on into an integrated headrest; leather bolsters with orange
// contrast stitching, a perforated quilted centre, a satin alloy pedestal.
function seatIcon(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mShell = mat('gelcoat', 0xe9e8e3, FRAME), mLea = mat('leatherDark', 0x2f3236, TRIM), mIns = mat('liner', 0x3a3d43, ACCENT),
        mSt = mat('plasticScr', 0xe0782f, SEAM), mAlu = mat('castAlu', 0xa9afb6), mDark = mat('rubber', 0x18191c);
  const pad = 0.040;
  const sp = spine([ptP(S, S.panL + 0.03, g, -0.045), ptP(S, S.panL, g), S.H, ptB(S, S.backL), ptB(S, S.backL + 0.03, -0.03)], 0.11);
  const L = sp.L, sH = sp.sOf(S.H), sHead = sp.sOf(ptB(S, S.backL - 0.22));
  const wingS = (u, v, k) => {
    const s = (v + 1) / 2 * L;
    const onPan = 1 - smooth(sH - 0.06, sH + 0.12, s);
    const onHead = smooth(sHead - 0.10, sHead + 0.05, s);
    const hgt = (onPan * 0.07 + (1 - onPan) * 0.10) * (1 - 0.75 * onHead) * k;
    const front = smooth(0, 0.20, s);
    const a = Math.abs(u);
    return [hgt * front * smooth(0.45, 1.0, a), 0.06 * pre.hw * smooth(0.55, 1, a)];
  };
  const hwAt = v => { const s = (v + 1) / 2 * L; return 1 - 0.32 * smooth(sHead - 0.18, sHead + 0.02, s) + 0.04 * Math.exp(-(((s - sH - 0.25) / 0.12) ** 2)); };
  const sh = slab(B.of(mShell), { sx: S.sx, sp, s0: 0, s1: L, hw: S.hw, hwAt, th: 0.006, r: 0.0058,
                                  face: true, lift: -pad, wing: (u, v) => wingS(u, v, 1), nx: 24, ns: 60, nt: 1 });
  // the rolled rim
  {
    rimBead(B.of(mShell), sh, 0.008);
  }
  // the upholstery: one leather skin following the shell's inside (its bolsters ride the shell's wings), a quilted
  // centre panel laid in it, the headrest pad
  const lw = S.hw * 0.86;
  const up = slab(B.of(mLea), { on: sh, sx: S.sx, sp, s0: 0.035, s1: sHead - 0.025, hw: lw, th: pad / 2, r: 0.016, rs: 0.02,
                                face: true, nx: 20, ns: 34, nt: 3,
                                groove: (u, v) => 0.006 * (Math.exp(-(((Math.abs(u) - 0.52) / 0.05) ** 2))) +
                                                  0.010 * Math.exp(-(((0.035 + (v + 1) / 2 * (sHead - 0.06) - sH) / 0.02) ** 2)) * (1 - smooth(0.5, 0.7, Math.abs(u))) });
  // the stitch lines: down each bolster seam, double, and across the hinge
  const usAt = s => (s - 0.035) - (sHead - 0.06) / 2;
  for (const sd of [-1, 1]) for (const dd of [-0.006, 0.006])
    stitchRun(B.of(mSt), up, sd * (0.52 * lw) + dd, sd * (0.52 * lw) + dd, usAt(0.07), usAt(sHead - 0.06), 0.0011, 0.0013);
  // the quilted centre panels (squab and back), laid on the leather as skins, a stitched diamond-free grid
  const vOf = s => ((s - 0.035) / (sHead - 0.06)) * 2 - 1;
  const quilt = (a, b) => 0.0020 * Math.max(grooves([-0.6, -0.2, 0.2, 0.6], 0.06, 1, 'v')(a, b), grooves([-0.5, 0, 0.5], 0.06, 1, 'u')(a, b)) * (1 - smooth(0.80, 0.92, Math.max(Math.abs(a), Math.abs(b))));
  for (const [s0, s1] of [[0.08, sH - 0.05], [sH + 0.06, sHead - 0.07]]) {
    const q = skin(B.of(mIns), up, { u0: -0.46, u1: 0.46, v0: vOf(s0), v1: vOf(s1), d: 0.0032, tuck: 0.005, nx: 26, ns: 32, groove: quilt });
    skinStitch(B.of(mSt), q, 0.035, 0.0010);
  }
  const hd = slab(B.of(mLea), { on: sh, sx: S.sx, sp, s0: sHead + 0.02, s1: L - 0.05, hw: S.hw * 0.40, th: 0.018, r: 0.014,
                                face: true, crown: 0.008, nx: 10, ns: 10, nt: 2 });
  stitchLoop(B.of(mSt), hd, 0.008, 0.0010);
  // the pedestal: a satin alloy tub under the pan on two short tracks
  const K = KIT();
  const zA = S.H[1] - 0.02, zF = S.F[1] - 0.06;
  {
    const yTop = z => { const s = sp.sOf([S.H[0], z]); return sh.map(0, s - L / 2, -sh.th)[1] - 0.004; };
    const pb = B.of(mAlu);
    const zs = [zA, (zA + zF) / 2, zF];
    for (const sd of [-1, 1]) {
      const x = S.sx + sd * S.hw * 0.50;
      kitTube(pb, zs.map(z => [x, yTop(z), z]).concat([[x, A.floorAt(zF) + 0.028, zF], [x, A.floorAt(zA) + 0.028, zA]]), 0.012, 12);
    }
    for (const z of [zA, zF]) kitTube(pb, [[S.sx - S.hw * 0.5, yTop(z), z], [S.sx + S.hw * 0.5, yTop(z), z]], 0.010, 10);
  }
  seatRails(B, mat('bareAlu', 0xb6bcc3), mDark, A, S.sx, zA - 0.12, zF + 0.12, S.hw * 0.5);
  return S;
}

// ---- 6. BONANZA (the Beechcraft club seat) --------------------------------------------------------------------------
// Deep leather, rolled pleats running down the back and front-to-back in the squab, fat bolsters with piping, a tall
// back with a separate adjustable headrest on two chrome posts, a padded fold-up armrest on the aisle side, a dark
// skirted base on tracks.
function seatBonanza(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mLea = mat('leather', 0xc8a57e, TRIM), mPipe = mat('leather', 0x8a6440, SEAM), mBase = mat('plasticGrn', 0x2c2b29),
        mChrome = mat('chrome', 0xdfe5ec), mAlu = mat('bareAlu', 0xb6bcc3), mDark = mat('rubber', 0x1b1c20);
  const thP = 0.055;
  const spP = spine([ptP(S, S.panL + 0.03, g, -0.035), ptP(S, S.panL, g), S.H, ptB(S, 0.06)], 0.05);
  const sH = spP.sOf(S.H);
  const sq = slab(B.of(mLea), { sx: S.sx, sp: spP, s0: 0, s1: sH, hw: S.hw, th: thP, r: 0.035, rs: 0.045, face: true,
                                nx: 18, ns: 18, nt: 4,
                                crownAt: (u, v) => 0.016 * smooth(0.6, 0.92, Math.abs(u)) + 0.008 * smooth(0.55, 0.95, -v),
                                groove: (u, v) => 0.008 * Math.exp(-(((Math.abs(u) - 0.62) / 0.04) ** 2)) +
                                  grooves([-0.4, -0.13, 0.13, 0.4], 0.07, 0.006, 'u', 0.85)(u, v) });
  piping(B.of(mPipe), sq, 0.006);
  for (const sd of [-1, 1]) stitchRun(B.of(mPipe), sq, sd * 0.62 * S.hw, sd * 0.62 * S.hw, -sq.hs + 0.05, sq.hs - 0.05, 0.0011, -0.006);
  const thB = 0.060, bL = S.backL - 0.20;
  const spB = spine([ptB(S, 0.02), ptB(S, bL * 0.5), ptB(S, bL)], 0);
  const bk = slab(B.of(mLea), { sx: S.sx, sp: spB, s0: 0, s1: spB.L, hw: S.hw * 0.98, th: thB, r: 0.045, rs: 0.06,
                                face: true, nx: 18, ns: 22, nt: 4,
                                hwAt: v => 1 - 0.05 * smooth(0.4, 1, v),
                                crownAt: (u, v) => 0.020 * smooth(0.6, 0.92, Math.abs(u)) + 0.012 * Math.exp(-(((v + 0.45) / 0.3) ** 2)) * (1 - u * u),
                                groove: (u, v) => 0.009 * Math.exp(-(((Math.abs(u) - 0.62) / 0.04) ** 2)) * (1 - smooth(0.82, 0.95, Math.abs(v))) +
                                  grooves([-0.4, -0.13, 0.13, 0.4], 0.07, 0.007, 'u', 0.85)(u, v) });
  piping(B.of(mPipe), bk, 0.006);
  // the back's rear: leather over a flat panel
  slab(B.of(mLea), { sx: S.sx, sp: spB, s0: 0.0, s1: spB.L, hw: S.hw * 0.96, th: 0.012, r: 0.011, face: true,
                     lift: -2 * thB - 0.001, hwAt: v => 1 - 0.05 * smooth(0.4, 1, v), nx: 10, ns: 10, nt: 1 });
  // the headrest: its own pad on two chrome posts, raised a hand above the back
  const hrK = bL + 0.055;
  const spH = spine([ptB(S, hrK, -0.01), ptB(S, hrK + 0.17, -0.02)], 0);
  const hr = slab(B.of(mLea), { sx: S.sx, sp: spH, s0: 0, s1: spH.L, hw: S.hw * 0.62, th: 0.040, r: 0.034, rs: 0.04,
                                face: true, crown: 0.01, nx: 12, ns: 10, nt: 3,
                                groove: grooves([0], 0.06, 0.006, 'v', 0.75) });
  piping(B.of(mPipe), hr, 0.005);
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * S.hw * 0.30;
    const a = ptB(S, bL - 0.07, -thB), b = ptB(S, hrK + 0.03, -0.04);
    kitTube(B.of(mChrome), [[x, a[0], a[1]], [x, b[0], b[1]]], 0.006, 12);
  }
  // the armrest on the inboard (aisle) side: a padded roll on a bracket from the back
  {
    const sd = S.sx >= 0 ? -1 : 1;
    const x = S.sx + sd * (S.hw + 0.035);
    const yA = S.H[0] + 0.19, z0 = S.H[1] - 0.04, z1 = S.H[1] + 0.30;
    const spA = spine([[yA, z1], [yA + 0.01, z0]], 0);
    const ar = slab(B.of(mLea), { sx: x, sp: spA, s0: 0, s1: spA.L, hw: 0.032, th: 0.026, r: 0.022, rs: 0.024,
                                  face: false, crown: 0.004, nx: 6, ns: 10, nt: 3 });
    piping(B.of(mPipe), ar, 0.0045);
    const pv = ptB(S, 0.18, -thB);
    KIT().revolve(B.of(mChrome), [x - sd * 0.002, pv[0], pv[1]], [sd, 0, 0], [[0, 0], [0.02, 0], [0.022, 0.005], [0.022, 0.012], [0, 0.014]], 16, false);
    kitTube(B.of(mChrome), [[x, pv[0], pv[1]], [x, yA - 0.02, z0 + 0.02]], 0.007, 10);
  }
  // the base: a skirted box under the squab on tracks
  const K = KIT();
  const zA = S.H[1] - 0.03, zF = S.F[1] - 0.05;
  const yB = S.H[0] - 2 * thP - 0.004;
  {
    const fl = A.floorAt((zA + zF) / 2);
    const h = Math.max(0.03, yB - fl - 0.03);
    K.boxIn(B.of(mBase), [S.sx, fl + 0.03 + h / 2, (zA + zF) / 2], [S.hw * 0.86, h / 2, (zF - zA) / 2],
            [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    kitTube(B.of(mChrome), [[S.sx - S.hw * 0.86, fl + 0.03 + h - 0.006, zF + 0.004], [S.sx + S.hw * 0.86, fl + 0.03 + h - 0.006, zF + 0.004]], 0.004, 8);
  }
  seatRails(B, mAlu, mDark, A, S.sx, zA - 0.20, zF + 0.20, S.hw * 0.62);
  return S;
}

// ---- 7. ULTRALIGHT SLING (the A22-type seat) --------------------------------------------------------------------------
// A bent 6061 tube frame - one U for the pan, one for the back, hinged where they meet and pinned to floor tabs - and a
// heavy canvas sling laced to it, sagging between the tubes, a thin foam pad sewn in. No belts (the user, 2 Nov:
// "drop the seat belts for all") and no brace behind the back.
function seatUL(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mAlu = mat('bareAlu', 0xc2c7cd, FRAME), mSling = mat('webbing', 0x3d5a86, TRIM), mPad = mat('liner', 0x4a5568, ACCENT),
        mLace = mat('webbing', 0x111214, SEAM), mBuck = mat('chrome', 0xdfe5ec),
        mCast = mat('castAlu', 0x8e949a);
  const K = KIT();
  const tr = 0.0125;
  const w = S.hw - 0.01;
  // the sling first: it hangs between the side tubes with a real sag, from the front tube round the hinge to the top
  const sp = spine([ptP(S, S.panL - 0.01, g, -0.02), ptP(S, S.panL - 0.06, g, 0.0), S.H, ptB(S, S.backL * 0.6), ptB(S, S.backL - 0.02)], 0.07);
  const sag = (u) => -0.028 * (1 - u * u);
  const sl = slab(B.of(mSling), { sx: S.sx, sp, s0: 0, s1: sp.L, hw: w, th: 0.0025, r: 0.0024, rx: 0.0024, rs: 0.0024,
                                  face: true, lift: -0.016, nx: 16, ns: 40, nt: 1,
                                  wing: (u, v) => [sag(u), 0] });
  // the pad sewn into the sling's middle
  const padS = skin(B.of(mPad), sl, { u0: -0.72, u1: 0.72, v0: -0.86, v1: 0.88, d: 0.009, tuck: 0.002, nx: 14, ns: 34,
                                      groove: (a, b) => grooves([-0.55, -0.1, 0.35], 0.04, 0.005, 'v')(a, b) });
  skinStitch(B.of(mLace), padS, 0.02, 0.0010);
  // the frame: the side tubes follow the sling's edges (offset outboard), the front and top cross tubes close them
  const edge = (sd, s) => { const q = sp.at(s); const y = q.p[0] + q.n[0] * (-0.016 + 0.004), z = q.p[1] + q.n[1] * (-0.016 + 0.004); return [S.sx + sd * (w + tr + 0.004), y, z]; };
  const ss = []; for (let k = 0; k <= 16; k++) ss.push(sp.L * k / 16);
  const fb = B.of(mAlu);
  for (const sd of [-1, 1]) kitTube(fb, ss.map(s => edge(sd, s)), tr, 14);
  for (const s of [0, sp.L]) { const a = edge(-1, s), b = edge(1, s); kitTube(fb, [a, b], tr, 14); }
  // the lacing: cord zig-zags from the sling's edge round the tube
  if (fine(1)) {
    const lb = B.of(mLace);
    for (const sd of [-1, 1]) for (let k = 1; k < 15; k++) {
      const s = sp.L * (k + 0.5) / 16;
      const a = sl.map(sd * w * 0.97, s - sp.L / 2, 0.003), b = edge(sd, s);
      const c = [b[0] + sd * tr * 0.9, b[1] - 0.004, b[2]];
      kitLine(lb, [a, [b[0], b[1] + tr, b[2]], c], 0.0016, 4);
    }
  }
  // the legs: from the pan's front corners and the hinge down to floor tabs, pinned
  const sF = 0.0, sHn = sp.sOf(S.H);
  for (const sd of [-1, 1]) {
    for (const s of [sF + 0.03, sHn]) {
      const p = edge(sd, s);
      const fz = p[2] + (s === sHn ? -0.03 : 0.02);
      const ft = [p[0], A.floorAt(fz) + 0.012, fz];
      kitTube(fb, [p, ft], tr * 0.85, 12);
      K.lug(B.of(mCast), [ft[0], ft[1], ft[2]], [1, 0, 0], [0, 1, 0], 0.012, 0.006, 0.014);
      K.boxIn(B.of(mCast), [ft[0], A.floorAt(fz) + 0.002, fz], [0.016, 0.002, 0.022], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.bolt(B.of(mBuck), [ft[0] + sd * 0.012, ft[1], ft[2]], [sd, 0, 0], 0.005, 0.004);
    }
    // NO BRACE BEHIND (the user, 2 Nov: "drop the back support for ultra lights, they will be a pain to fit"): the back
    // stands on the side tube's own bend, triangulated inside the seat's footprint by a short chord across the bend
    kitTube(fb, [edge(sd, sHn - 0.10), edge(sd, sHn + 0.12)], tr * 0.7, 10);
  }
  return S;
}

// ---- 8. EXTRA 330 (aerobatic) ------------------------------------------------------------------------------------------
// A carbon shell for a pilot lying back: a low narrow pan with a high front lip under the thighs, a long back reclined
// far past an upright seat's, and IN it the pilot's back-pack parachute - the seat's back is the chute's shape - a
// thin squab pad, and the shell bolted to the fuselage tubes on lugs. (No harness: the user dropped the belts, 2 Nov.)
function seatExtra(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mShell = mat('composite', 0x26292d, FRAME), mPad = mat('leatherDark', 0x1c1d20, TRIM), mChute = mat('webbing', 0x3a5378, ACCENT),
        mChuteT = mat('webbing', 0x1a1d22, SEAM), mBuck = mat('chrome', 0xdfe5ec), mCast = mat('castAlu', 0x8e949a);
  const chute = 0.075;                                     // the pack's thickness on the back
  const sp = spine([ptP(S, S.panL + 0.02, g, 0.02), ptP(S, S.panL - 0.02, g), S.H, ptB(S, S.backL), ptB(S, S.backL + 0.02, -0.04)], 0.085);
  const L = sp.L, sH = sp.sOf(S.H);
  // the shell's own face is the chute's back on the back, the pad's under-side on the pan
  const lift = s => -(0.022 + (chute - 0.022) * smooth(sH - 0.02, sH + 0.12, s));
  const wing = (u, v) => {
    const s = (v + 1) / 2 * L;
    const onPan = 1 - smooth(sH - 0.06, sH + 0.10, s);
    const hgt = onPan * 0.07 + (1 - onPan) * 0.14;
    const a = Math.abs(u);
    return [hgt * smooth(0.5, 1.0, a) + lift(s), 0.04 * pre.hw * smooth(0.6, 1, a)];
  };
  const sh = slab(B.of(mShell), { sx: S.sx, sp, s0: 0, s1: L, hw: S.hw, th: 0.0045, r: 0.0044, face: true, wing,
                                  hwAt: v => 1 - 0.10 * smooth(0.6, 1, v), nx: 20, ns: 56, nt: 1 });
  {
    rimBead(B.of(mShell), sh, 0.006);
  }
  // the squab pad
  const pd = slab(B.of(mPad), { on: sh, sx: S.sx, sp, s0: 0.03, s1: sH + 0.02, hw: S.hw * 0.62, th: 0.011, r: 0.009, face: true,
                                lift: -0.0, crown: 0.004, nx: 10, ns: 10, nt: 2, groove: grooves([-0.3, 0.3], 0.06, 0.003, 'u') });
  void pd;
  // the parachute: a rounded pack in the back, its container flaps, a centre seam, the ripcord housing
  const pk = slab(B.of(mChute), { on: sh, sx: S.sx, sp, s0: sp.sOf(ptB(S, 0.06)), s1: sp.sOf(ptB(S, S.backL - 0.10)), hw: S.hw * 0.66, th: chute / 2, r: 0.03, rs: 0.04,
                                  face: true, crown: 0.012, nx: 14, ns: 16, nt: 4,
                                  groove: (u, v) => 0.006 * Math.exp(-((u / 0.05) ** 2)) * (1 - smooth(0.7, 0.9, Math.abs(v))) });
  piping(B.of(mChuteT), pk, 0.004);
  for (const sd of [-1, 1]) stitchRun(B.of(mChuteT), pk, sd * pk.hw * 0.45, sd * pk.hw * 0.45, -pk.hs * 0.8, pk.hs * 0.8, 0.0012, 0.002);
  {
    const a = pk.map(-pk.hw * 0.9, -pk.hs * 0.2, pk.th), b = pk.map(-pk.hw * 1.05, pk.hs * 0.6, pk.th * 0.3);
    kitTube(B.of(mChuteT), [a, b], 0.006, 8);
  }
  // the shell's mounts: four lugs from its belly
  const K = KIT();
  for (const sd of [-1, 1]) for (const s of [sH * 0.4, sH + 0.12]) {
    const p = sh.map(sd * S.hw * 0.55, s - L / 2, -sh.th);
    const fz = p[2];
    const ft = [p[0], Math.max(A.floorAt(fz) + 0.02, p[1] - 0.08), fz];
    kitTube(B.of(mCast), [p, ft], 0.009, 10);
    K.lug(B.of(mCast), ft, [1, 0, 0], [0, 1, 0], 0.011, 0.008, 0.016);
    K.bolt(B.of(mBuck), [ft[0] + 0.01, ft[1], ft[2]], [1, 0, 0], 0.004, 0.004);
  }
  return S;
}

// ---- 9. DC-3 (1936-46) -------------------------------------------------------------------------------------------------
// TWO seats under one preset: the cockpit's (section 0) is the pilots' - a riveted alloy bucket (deep enough for a
// seat-pack parachute) with a leather squab and back cushion, padded arms, on a column with tracks; every passenger
// bay's is the DST/DC-3 day seat - a deep upholstered reclining seat, a high rounded back with a linen antimacassar
// over the top, padded arms with chrome ends, on a polished tube frame.
function seatDC3(B, A, P, g, pre, sbs, SP) {
  if (pre.pax || (SP && SP.pax)) return seatDC3Pax(B, A, P, g, pre.pax ? pre : SEAT_PRESETS[2], sbs);
  const S = stance(A, P, g, pre, sbs);
  const mBkt = mat('panelMetal', 0x7d8478, FRAME), mLea = mat('leather', 0x4a3426, TRIM), mPipe = mat('leather', 0x2e2018, SEAM),
        mRiv = mat('bareAlu', 0xc6cbd0), mCast = mat('castAlu', 0x8e949a), mDark = mat('rubber', 0x1b1c20),
        mTrim = mat('trim', 0x3c403a);
  const K = KIT();
  // the bucket: a deep alloy tub whose occupied face is 60 mm under the cushions
  const cush = 0.050;
  const sp = spine([ptP(S, S.panL + 0.01, g, -0.02), ptP(S, S.panL, g), S.H, ptB(S, S.backL)], 0.05);
  const L = sp.L, sH = sp.sOf(S.H);
  const sh = slab(B.of(mBkt), { sx: S.sx, sp, s0: 0, s1: L, hw: S.hw, th: 0.004, r: 0.0039, face: true, lift: -cush - 0.02,
                                wing: (u, v) => { const s = (v + 1) / 2 * L; const h = 0.11 - 0.05 * smooth(sH, L, s); return [h * smooth(0.82, 1.0, Math.abs(u)), 0]; },
                                nx: 22, ns: 44, nt: 1, rx: 0.0039 });
  // the rim bead and a row of rivets round it
  {
    rimBead(B.of(mBkt), sh, 0.006);
    const rb = B.of(mRiv);
    if (fine(1)) for (const sd of [-1, 1]) for (let k = 2; k < 40; k += 2) {
      const s = -sh.hs + 2 * sh.hs * k / 40;
      const p = sh.map(sd * sh.hw * 0.93, s, sh.th + 0.0004);
      K.revolve(rb, p, [sd, 0, 0], [[0.0028, 0], [0.002, 0.0012], [0, 0.0016]], 6, false);
    }
  }
  // the cushions: squab and back, leather with piping, the back buttoned
  const sq = slab(B.of(mLea), { on: sh, sx: S.sx, sp, s0: 0.01, s1: sH - 0.02, hw: S.hw * 0.86, th: cush / 2 + 0.01, r: 0.02,
                                face: true, crown: 0.01, nx: 14, ns: 14, nt: 3, groove: grooves([-0.33, 0.33], 0.06, 0.006, 'u') });
  piping(B.of(mPipe), sq, 0.005);
  const bk = slab(B.of(mLea), { on: sh, sx: S.sx, sp, s0: sH + 0.04, s1: L - 0.05, hw: S.hw * 0.82, th: cush / 2 + 0.008, r: 0.02,
                                face: true, crown: 0.008, nx: 14, ns: 18, nt: 3, groove: grooves([-0.4, 0.15], 0.07, 0.007, 'v') });
  piping(B.of(mPipe), bk, 0.005);
  // the arms: padded rolls on alloy brackets, both sides
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * (S.hw + 0.042);
    const yA = S.H[0] + 0.17, z0 = S.H[1] - 0.02, z1 = S.H[1] + 0.27;
    const spA = spine([[yA, z1], [yA + 0.01, z0]], 0);
    const ar = slab(B.of(mLea), { sx: x, sp: spA, s0: 0, s1: spA.L, hw: 0.03, th: 0.022, r: 0.018, face: false, nx: 6, ns: 8, nt: 3 });
    piping(B.of(mPipe), ar, 0.004);
    const a = sh.map(sd * sh.hw, sp.sOf(ptB(S, 0.12)) - L / 2, 0), b = sh.map(sd * sh.hw, sp.sOf(ptP(S, 0.25, g)) - L / 2, 0);
    kitTube(B.of(mTrim), [a, [x, yA - 0.02, z0 + 0.02]], 0.008, 10);
    kitTube(B.of(mTrim), [b, [x, yA - 0.02, z1 - 0.03]], 0.008, 10);
  }
  // the column: a cast base on tracks, the tube up to the bucket's belly, the adjust handle
  const zA = S.H[1] - 0.02, zF = S.F[1] - 0.08, zc = (zA + zF) / 2;
  const belly = sh.map(0, sp.sOf([S.H[0], zc]) - L / 2, -sh.th);
  const fl = A.floorAt(zc);
  K.revolve(B.of(mTrim), [S.sx, fl, zc], [0, 1, 0], [[0, 0.012], [0.04, 0.012], [0.04, Math.max(0.05, belly[1] - fl - 0.02)], [0.06, Math.max(0.06, belly[1] - fl - 0.005)], [0, Math.max(0.06, belly[1] - fl - 0.005)]], 20, false);
  K.boxIn(B.of(mCast), [S.sx, fl + 0.008, zc], [S.hw * 0.62, 0.008, (zF - zA) / 2 + 0.02], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  seatRails(B, mRiv, mDark, A, S.sx, zA - 0.18, zF + 0.18, S.hw * 0.62);
  return S;
}
function seatDC3Pax(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  // roles (SEATS-COST): the linen is the accent, the polished frame the frame, the arms' leather rides with the piping
  const mFab = mat('liner', 0x5b6a5c, TRIM), mPipe = mat('leather', 0x3a2c22, SEAM), mLin = mat('liner', 0xebe5d6, ACCENT),
        mChrome = mat('chrome', 0xdfe5ec, FRAME), mLea = mat('leather', 0x5a3a28, SEAM), mDark = mat('rubber', 0x1b1c20);
  const K = KIT();
  const thP = 0.06;
  const spP = spine([ptP(S, S.panL + 0.02, g, -0.04), ptP(S, S.panL, g), S.H, ptB(S, 0.06)], 0.06);
  const sH = spP.sOf(S.H);
  const sq = slab(B.of(mFab), { sx: S.sx, sp: spP, s0: 0, s1: sH, hw: S.hw * 0.90, th: thP, r: 0.04, rs: 0.05, face: true,
                                nx: 16, ns: 18, nt: 4, crown: 0.012,
                                crownAt: (u, v) => 0.012 * smooth(0.5, 0.95, -v) });
  piping(B.of(mPipe), sq, 0.006);
  // the back: tall and rounded on top, buttoned in a grid
  const thB = 0.065;
  const spB = spine([ptB(S, 0.02), ptB(S, S.backL * 0.5), ptB(S, S.backL)], 0);
  const btn = (u, v) => {
    let g2 = 0;
    for (const a of [-0.45, 0, 0.45]) for (const b of [-0.5, -0.1, 0.3]) g2 += Math.exp(-(((u - a) / 0.07) ** 2 + ((v - b) / 0.06) ** 2));
    return 0.014 * Math.min(1, g2);
  };
  const bk = slab(B.of(mFab), { sx: S.sx, sp: spB, s0: 0, s1: spB.L, hw: S.hw * 0.92, th: thB, r: 0.05, rs: 0.07,
                                face: true, nx: 18, ns: 24, nt: 4, rx: 0.06,
                                hwAt: v => 1 - 0.14 * smooth(0.5, 1, v) ** 2,
                                crownAt: (u, v) => 0.016 * (1 - u * u) * Math.exp(-(((v + 0.4) / 0.35) ** 2)) + 0.012 * smooth(0.6, 0.95, Math.abs(u)),
                                groove: btn });
  piping(B.of(mPipe), bk, 0.006);
  // the buttons themselves
  if (fine(1)) {
    const bb = B.of(mPipe);
    for (const a of [-0.45, 0, 0.45]) for (const b of [-0.5, -0.1, 0.3]) {
      const p = bk.map(a * bk.hw, b * bk.hs, bk.th + 0.016 * (1 - a * a) * Math.exp(-(((b + 0.4) / 0.35) ** 2)) - 0.012);
      const q = spB.at(b * bk.hs + spB.L / 2);
      K.revolve(bb, p, [0, q.n[0], q.n[1]], [[0, 0], [0.007, 0], [0.008, 0.003], [0, 0.005]], 10, false);
    }
  }
  // the antimacassar: a linen cloth over the back's top, draped down both faces
  {
    const top = spB.L;
    const spL = spine([ptB(S, S.backL - 0.22, 0.012), ptB(S, S.backL + 0.012, 0.005), ptB(S, S.backL + 0.012, -2 * thB - 0.005), ptB(S, S.backL - 0.12, -2 * thB - 0.010)], 0.05);
    const lc = slab(B.of(mLin), { sx: S.sx, sp: spL, s0: 0, s1: spL.L, hw: S.hw * 0.55, lift: 0.010, th: 0.002, r: 0.0019, rx: 0.0019, rs: 0.0019,
                                  face: false, nx: 14, ns: 20, nt: 1,
                                  wing: (u, v) => [0.004 * Math.sin(u * 9) * (1 - Math.abs(v)), 0] });
    void lc; void top;
  }
  // the arms: padded leather rolls with chrome end caps, on the tube frame
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * (S.hw * 0.92 + 0.046);
    const yA = S.H[0] + 0.15, z0 = S.H[1] + 0.02, z1 = S.H[1] + 0.33;
    const spA = spine([[yA, z1], [yA + 0.008, z0]], 0);
    const ar = slab(B.of(mLea), { sx: x, sp: spA, s0: 0, s1: spA.L, hw: 0.035, th: 0.03, r: 0.026, rs: 0.028, face: false, nx: 6, ns: 10, nt: 3 });
    void ar;
    K.revolve(B.of(mChrome), [x, yA, z1 + 0.003], [0, 0, 1], [[0, 0], [0.03, 0], [0.034, 0.006], [0.03, 0.012], [0, 0.014]], 18, false);
  }
  // the frame: polished tube, a side frame each side - two legs, a seat rail, the arm's upright - and cross tubes
  const fb = B.of(mChrome);
  const zA = S.H[1] - 0.04, zF = S.F[1] - 0.03;
  const yS = S.H[0] - 2 * thP - 0.014;
  const gX = S.hw * 0.92 + 0.046;
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * gX;
    kitTube(fb, [[x, A.floorAt(zF) + 0.01, zF + 0.04], [x, yS, zF], [x, yS + 0.012, zA], [x, A.floorAt(zA - 0.05) + 0.01, zA - 0.08]], 0.011, 12);
    kitTube(fb, [[x, yS, zF - 0.02], [x, S.H[0] + 0.12, S.H[1] + 0.31]], 0.009, 10);
    kitTube(fb, [[x, yS + 0.012, zA], [x, S.H[0] + 0.12, S.H[1] - 0.03]], 0.009, 10);
    for (const z of [zF + 0.04, zA - 0.08]) K.revolve(B.of(mDark), [x, A.floorAt(z), z], [0, 1, 0], [[0, 0], [0.018, 0], [0.018, 0.012], [0, 0.012]], 12, false);
  }
  for (const z of [zF, zA]) kitTube(fb, [[S.sx - gX, yS + (z === zA ? 0.012 : 0), z], [S.sx + gX, yS + (z === zA ? 0.012 : 0), z]], 0.010, 10);
  // the back's rear: a fabric panel
  slab(B.of(mFab), { sx: S.sx, sp: spB, s0: 0.01, s1: spB.L - 0.02, hw: S.hw * 0.90, th: 0.010, r: 0.009, face: true,
                     lift: -2 * thB - 0.001, hwAt: v => 1 - 0.14 * smooth(0.5, 1, v) ** 2, nx: 10, ns: 12, nt: 1 });
  return S;
}


// ---- 10. THE CUB SEAT (the base seat, reworked) ---------------------------------------------------------------------------
// The J-3 / PA-11 front seat, which is what the default seat always meant: a welded 4130 frame - a pan loop of 3/4-inch
// tube on four short legs bolted to tabs, two uprights for the back with a top bow - a canvas sling laced under the pan
// and another across the back, a loose box cushion with piping on the sling and a thin pad on the back. No rails: a
// Cub's seat is bolted to the fuselage, the station is the station. The cushion and the pad wear the seat-trim livery
// section (the base seat's section since G332), so a seat the user painted keeps its paint.
function seatCub(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  // the cushion keeps today's tube seat's look (G332's hide, its cream piping) as the sections' bottom-out
  // (SEATS-COST: the canvas rides the FRAME role, so in the game this seat wears THREE materials - cushion, piping,
  // frame - exactly the tube frame's it replaced; the hero still draws it as canvas)
  const mCush = mat('hide', 0x7a4f33, TRIM), mPipe = mat('leather', 0xd8cdb6, SEAM);
  const mFrame = mat('trim', 0x4a5056, FRAME), mCanvas = mat('webbing', 0x8a8068, FRAME), mLace = mat('webbing', 0x2a2722, SEAM),
        mCast = mat('castAlu', 0x8e949a), mBolt = mat('chrome', 0xdfe5ec);
  const K = KIT();
  const tr = 0.0095;                                      // 3/4-inch tube
  const w = S.hw;
  // the pan: the sling line 75 mm under the occupied line (the cushion is 70 mm)
  const cu = 0.070;
  const yPan = z => S.H[0] - cu - 0.004 - tr + (z - S.H[1]) * Math.tan(g.tilt);   // the rails' tops clear the cushion
  const zR = S.H[1] - 0.035, zF = S.F[1] - 0.005;
  const fb = B.of(mFrame);
  // the pan loop: the front bow round the front, the side rails aft, the rear cross tube
  kitTube(fb, [[S.sx - w, yPan(zR), zR], [S.sx - w, yPan(zF), zF], [S.sx + w, yPan(zF), zF], [S.sx + w, yPan(zR), zR]], tr, 14);
  kitTube(fb, [[S.sx - w - 0.004, yPan(zR), zR], [S.sx + w + 0.004, yPan(zR), zR]], tr, 14);
  // the sling: canvas laced between the side rails, sagging a little
  const spS = spine([[yPan(zF) + 0.002, zF - 0.02], [yPan(zR + 0.02) + 0.002, zR + 0.02]], 0);
  const sl = slab(B.of(mCanvas), { sx: S.sx, sp: spS, s0: 0, s1: spS.L, hw: w - tr - 0.012, th: 0.002, r: 0.0019, rx: 0.0019, rs: 0.0019,
                                   face: false, nx: 12, ns: 14, nt: 1, wing: (u, v) => [-0.012 * (1 - u * u) * (1 - v * v), 0] });
  // its lacing round the rails
  if (fine(1)) {
    const lb = B.of(mLace);
    for (const sd of [-1, 1]) for (let k = 1; k < 10; k++) {
      const z = zF - 0.03 - (zF - zR - 0.06) * k / 10;
      const a = [S.sx + sd * (w - tr - 0.014), yPan(z) + 0.001, z];
      kitLine(lb, [a, [S.sx + sd * w, yPan(z) + tr + 0.001, z], [S.sx + sd * (w + tr + 0.001), yPan(z) - 0.003, z]], 0.0014, 4);
    }
    void sl;
  }
  // the cushion: a loose box cushion, piping on both edges, two flutes, a front roll
  const spP = spine([ptP(S, S.panL + 0.01, g, -0.02), ptP(S, S.panL, g), S.H, ptB(S, 0.04)], 0.04);
  const sH = spP.sOf(S.H);
  const cs = slab(B.of(mCush), { sx: S.sx, sp: spP, s0: 0.0, s1: sH - 0.01, hw: w - 0.004, th: cu / 2, r: 0.022, rs: 0.03,
                                 face: true, nx: 16, ns: 16, nt: 4, crown: 0.010,
                                 crownAt: (u, v) => 0.006 * smooth(0.5, 0.95, -v),
                                 groove: grooves([-0.34, 0.34], 0.07, 0.007, 'u', 0.82) });
  piping(B.of(mPipe), cs, 0.0042);
  // the back: two uprights off the rear tube, a top bow, the canvas laced across, a thin pad over it
  const padT = 0.030;
  const bTop = S.backL;
  const up = (k, off) => ptB(S, k, off);
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * w;
    const b0 = [yPan(zR), zR], b1 = up(bTop - 0.02, -padT - 0.012);
    kitTube(fb, [[x, b0[0], b0[1]], [x, b1[0], b1[1]]], tr, 14);
    // the legs: short, down to a tab bolted to the floor - the front pair raked forward, the rear pair straight
    for (const [z, dz] of [[zF - 0.02, 0.03], [zR + 0.01, -0.02]]) {
      const p = [x, yPan(z) - 0.004, z], fz = z + dz, ft = [x, A.floorAt(fz) + 0.014, fz];
      kitTube(fb, [p, ft], tr * 0.9, 12);
      K.lug(B.of(mCast), ft, [1, 0, 0], [0, 1, 0], 0.011, 0.006, 0.014);
      K.boxIn(B.of(mCast), [x, A.floorAt(fz) + 0.002, fz], [0.015, 0.002, 0.022], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.bolt(B.of(mBolt), [x + sd * 0.011, ft[1], ft[2]], [sd, 0, 0], 0.0045, 0.004);
    }
    // the gusset across the back's root (the frame is welded, the back does not fold)
    const gA = [x, yPan(zR + 0.10), zR + 0.10], gB = up(0.12, -padT - 0.012);
    kitTube(fb, [gA, [x, gB[0], gB[1]]], tr * 0.7, 10);
  }
  // the cross tube between the front legs, low
  kitTube(fb, [[S.sx - w, A.floorAt(zF) + 0.05, zF + 0.01], [S.sx + w, A.floorAt(zF) + 0.05, zF + 0.01]], tr * 0.8, 12);
  // the top bow, rounded over
  {
    const t0 = up(bTop - 0.02, -padT - 0.012), t1 = up(bTop + 0.01, -padT - 0.012);
    kitTube(fb, [[S.sx - w, t0[0], t0[1]], [S.sx - w * 0.85, t1[0], t1[1]], [S.sx + w * 0.85, t1[0], t1[1]], [S.sx + w, t0[0], t0[1]]], tr, 14);
  }
  // the back's canvas and its pad
  const spB = spine([up(0.05), up(bTop - 0.04)], 0);
  slab(B.of(mCanvas), { sx: S.sx, sp: spB, s0: 0, s1: spB.L, hw: w - tr - 0.010, th: 0.002, r: 0.0019, rx: 0.0019, rs: 0.0019,
                        face: false, lift: -padT - 0.012, nx: 10, ns: 12, nt: 1 });
  if (fine(1)) {
    const lb = B.of(mLace);
    for (const sd of [-1, 1]) for (let k = 1; k < 9; k++) {
      const q = up(0.05 + (bTop - 0.10) * k / 9, -padT - 0.012);
      kitLine(lb, [[S.sx + sd * (w - tr - 0.012), q[0], q[1]], [S.sx + sd * w, q[0] + 0.004, q[1] + 0.012], [S.sx + sd * (w + tr + 0.001), q[0], q[1] - 0.004]], 0.0014, 4);
    }
  }
  const pd = slab(B.of(mCush), { sx: S.sx, sp: spB, s0: 0.02, s1: spB.L - 0.02, hw: w * 0.84, th: padT / 2, r: 0.013, rs: 0.02,
                                 face: true, crown: 0.006, nx: 12, ns: 12, nt: 3,
                                 groove: grooves([-0.3, 0.3], 0.08, 0.005, 'v', 0.85) });
  piping(B.of(mPipe), pd, 0.0038);
  return S;
}

// ---- 11. AGRICULTURAL (the modern ag plane's work seat: AT-802, Thrush) ---------------------------------------------------
// Built for ten-hour days and a 26 g crash in a roll cage: a deep pressed-steel bucket painted black with a high back
// and head wings, thick foam cushions in black cordura under the sheepskin cover every ag pilot fits, the seat riding on
// two vertical height-adjust tracks behind it (a carriage block on each, the lever on the right), and the pan standing
// on two energy-absorbing crush tubes.
function seatAg(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mBkt = mat('trim', 0x232528, FRAME), mCord = mat('liner', 0x2a2c2f, ACCENT), mWool = mat('liner', 0xd8ccb2, TRIM),
        mWoolE = mat('leather', 0x6a5440, SEAM), mSteel = mat('steelTube', 0x6f7780), mCast = mat('castAlu', 0x8e949a),
        mBolt = mat('chrome', 0xdfe5ec), mKnob = mat('plasticScr', 0xc0302a), mDark = mat('rubber', 0x18191c);
  const K = KIT();
  const cush = 0.065;
  const sp = spine([ptP(S, S.panL + 0.02, g, -0.03), ptP(S, S.panL, g), S.H, ptB(S, S.backL), ptB(S, S.backL + 0.02, -0.03)], 0.07);
  const L = sp.L, sH = sp.sOf(S.H), sHead = sp.sOf(ptB(S, S.backL - 0.22));
  const sh = slab(B.of(mBkt), { sx: S.sx, sp, s0: 0, s1: L, hw: S.hw, th: 0.0045, r: 0.0044, face: true, lift: -cush - 0.012,
                                wing: (u, v) => { const s2 = (v + 1) / 2 * L; const onPan = 1 - smooth(sH - 0.05, sH + 0.10, s2);
                                  const head = smooth(sHead - 0.06, sHead + 0.04, s2);
                                  const h = onPan * 0.10 + (1 - onPan) * (0.13 - 0.05 * head);
                                  return [h * smooth(0.62, 1.0, Math.abs(u)) * smooth(0, 0.12, s2), 0.03 * S.hw * smooth(0.7, 1, Math.abs(u))]; },
                                nx: 22, ns: 50, nt: 1 });
  rimBead(B.of(mBkt), sh, 0.007);
  // the cushions (cordura) and the sheepskin over them: a fleece reads as a soft lumpy cream - a field of small bumps
  const fleece = (a, b) => 0.0034 * (0.5 + 0.5 * Math.sin(a * 29.0 + Math.sin(b * 11.0) * 1.9) * Math.sin(b * 37.0 + a * 5.0)) * (1 - smooth(0.86, 0.95, Math.max(Math.abs(a), Math.abs(b))));
  const sq = slab(B.of(mCord), { on: sh, sx: S.sx, sp, s0: 0.01, s1: sH - 0.02, hw: S.hw * 0.80, th: cush / 2 + 0.006, r: 0.022, rs: 0.03,
                                 face: true, crown: 0.010, nx: 16, ns: 14, nt: 3,
                                 crownAt: (u, v) => 0.012 * smooth(0.6, 0.95, Math.abs(u)) + 0.008 * smooth(0.5, 0.9, -v) });
  const bk = slab(B.of(mCord), { on: sh, sx: S.sx, sp, s0: sH + 0.03, s1: L - 0.05, hw: S.hw * 0.78, th: cush / 2, r: 0.022, rs: 0.03,
                                 face: true, crown: 0.008, nx: 16, ns: 22, nt: 3,
                                 hwAt: v => 1 - 0.18 * smooth(0.35, 0.6, v),
                                 crownAt: (u, v) => 0.014 * smooth(0.6, 0.95, Math.abs(u)) * (1 - smooth(0.3, 0.5, v)) + 0.012 * Math.exp(-(((v + 0.4) / 0.3) ** 2)) * (1 - u * u) });
  const w1 = skin(B.of(mWool), sq, { u0: -0.94, u1: 0.94, v0: -0.96, v1: 0.92, d: 0.007, tuck: 0.008, nx: 30, ns: 28, n: 4, groove: fleece });
  const w2 = skin(B.of(mWool), bk, { u0: -0.94, u1: 0.94, v0: -0.92, v1: 0.96, d: 0.007, tuck: 0.008, nx: 30, ns: 40, n: 4, groove: fleece });
  skinBind(B.of(mWoolE), w1, 0.0042);
  skinBind(B.of(mWoolE), w2, 0.0042);
  // the height tracks: two vertical steel tubes behind the back, floor to above the shoulders, a carriage on each
  const zT = S.H[1] - 0.20 - S.bs * 0.25;
  const topY = ptB(S, S.backL * 0.75)[0];
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * S.hw * 0.55;
    kitTube(B.of(mSteel), [[x, A.floorAt(zT), zT], [x, topY, zT]], 0.016, 14);
    K.boxIn(B.of(mCast), [x, A.floorAt(zT) + 0.006, zT], [0.03, 0.006, 0.03], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    // the carriage: a block clamped round the track, its arm into the bucket's back
    const yc = S.H[0] + 0.12;
    K.revolve(B.of(mCast), [x, yc - 0.05, zT], [0, 1, 0], [[0, 0], [0.026, 0], [0.028, 0.006], [0.028, 0.094], [0.026, 0.1], [0, 0.1]], 16, false);
    const bp = sh.map(sd * S.hw * 0.55, sp.sOf(ptB(S, 0.12)) - L / 2, -sh.th);
    kitTube(B.of(mSteel), [[x, yc, zT], [x, bp[1], bp[2]]], 0.013, 12);
    const bp2 = sh.map(sd * S.hw * 0.55, sp.sOf(ptB(S, 0.40)) - L / 2, -sh.th);
    kitTube(B.of(mSteel), [[x, yc + 0.04, zT], [x, bp2[1], bp2[2]]], 0.010, 12);
  }
  kitTube(B.of(mSteel), [[S.sx - S.hw * 0.55, topY - 0.02, zT], [S.sx + S.hw * 0.55, topY - 0.02, zT]], 0.014, 12);
  // the crush tubes under the pan: two fat cans with a ribbed (convoluted) wall
  for (const sd of [-1, 1]) {
    const z = (S.H[1] + S.F[1]) / 2 - 0.02, x = S.sx + sd * S.hw * 0.42;
    const top = sh.map(sd * S.hw * 0.42, sp.sOf([S.H[0], z]) - L / 2, -sh.th)[1];
    const fl = A.floorAt(z), h = Math.max(0.04, top - fl);
    const prof = [[0, 0], [0.04, 0], [0.04, 0.012]];
    const nR = fine(1) ? 6 : 2;
    for (let k = 0; k < nR; k++) { const y0 = 0.012 + (h - 0.03) * k / nR; prof.push([0.034, y0 + (h - 0.03) / nR * 0.3], [0.036, y0 + (h - 0.03) / nR * 0.7]); }
    prof.push([0.036, h - 0.012], [0.042, h - 0.012], [0.042, h], [0, h]);
    K.revolve(B.of(mCast), [x, fl, z], [0, 1, 0], prof, 20, false);
  }
  // the height lever on the right (the pilot's right: -x), a red knob
  {
    const x = S.sx - S.hw - 0.02, p0 = [x, S.H[0] - 0.04, S.H[1] - 0.02], p1 = [x - 0.01, S.H[0] + 0.03, S.H[1] + 0.16];
    kitTube(B.of(mSteel), [p0, p1], 0.007, 10);
    K.revolve(B.of(mKnob), p1, [0, 0.4, 1], [[0, 0], [0.013, 0.004], [0.014, 0.022], [0.011, 0.036], [0, 0.04]], 14, false);
  }
  void mBolt; void mDark;
  return S;
}

// ---- 12. WWI WICKER (the Camel's seat) -------------------------------------------------------------------------------------
// The scout's seat of 1916-18 was woven rattan: light, springy and cheap. A round tub whose back wraps the pilot in plan,
// a thick rolled rim, the weave on both faces and the stakes (the vertical canes) showing outside, a leather cushion
// in the pan, the whole on two ash bearers that rest on the fuselage's longerons (here on short blocks off the floor).
function seatWicker(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mCane = mat('webbing', 0xcfae70, FRAME), mRim = mat('webbing', 0xb08a4e), mLea = mat('leather', 0x7a4526, TRIM),
        mPipe = mat('leather', 0x3a2414, SEAM), mAsh = mat('spruce', 0x8a6a40), mBolt = mat('steelTube', 0x5a6068);
  const K = KIT();
  const cush = 0.050;
  const sp = spine([ptP(S, S.panL, g, -0.02), ptP(S, S.panL - 0.04, g), S.H, ptB(S, S.backL)], 0.10);
  const L = sp.L, sH = sp.sOf(S.H);
  // THE TUB: the back is a half circle in plan (u = sin theta -> forward hw (1 - cos theta), in hw (u - sin..)), the pan's
  // sides rise into it; the surface is only a guide - what is drawn is the cane woven over it
  const wrap = (u, v) => {
    const s2 = (v + 1) / 2 * L, back = smooth(sH - 0.16, sH + 0.06, s2), a = Math.min(1, Math.abs(u));
    const circ = 0.55 * a * a + 0.45 * (1 - Math.sqrt(Math.max(0, 1 - a * a)));
    return [(0.07 * a * a * (1 - back) + 0.92 * S.hw * circ * back) * smooth(0, 0.12, s2), S.hw * 0.30 * back * circ];
  };
  const tub = { hw: S.hw, hs: L / 2, th: 0, r: 0, rx: 0, rs: 0, sc: L / 2 };
  tub.map = (x, s2, t) => {
    const u = x / S.hw, v = s2 / (L / 2), w = wrap(u, v);
    const q = sp.at(L / 2 + s2), tt = t + w[0] - cush - 0.006;
    return [S.sx + x - Math.sign(x) * w[1], q.p[0] + q.n[0] * tt, q.p[1] + q.n[1] * tt];
  };
  // the weavers: flat cane strips across the tub at a 13 mm pitch, over and under the stakes (45 mm apart), each row
  // offset half a stake from the last - the basket weave
  const STAKE = 0.045, PITCH = 0.0125 * (fine(1) ? 1 : 2), WID = 0.0118 * (fine(1) ? 1 : 2), TH = 0.0026;
  if (!fine(2)) {
    // the phone level: the weave as one sheet, both faces, over the tub's own surface
    const wb = B.of(mCane), NX = 8, NS = 14, F = [], Bk = [];
    for (let i = 0; i <= NX; i++) { const rf = [], rb = []; for (let j = 0; j <= NS; j++) {
      const x = -S.hw + 2 * S.hw * i / NX, s2 = -L / 2 + L * j / NS;
      rf.push(wb.v(tub.map(x, s2, TH / 2))); rb.push(wb.v(tub.map(x, s2, -TH / 2))); } F.push(rf); Bk.push(rb); }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NS; j++) {
      wb.quad(F[i][j], F[i + 1][j], F[i + 1][j + 1], F[i][j + 1]); wb.quad(Bk[i][j], Bk[i][j + 1], Bk[i + 1][j + 1], Bk[i + 1][j]); }
  } else {
    const wb = B.of(mCane);
    const nRow = Math.floor((L - 0.03) / PITCH);
    for (let r = 0; r < nRow; r++) {
      const s2 = -L / 2 + 0.015 + r * PITCH;
      const pts = [], ns = [], ds = [];
      const NX = Math.ceil(2 * S.hw / (0.0075 / det().k));
      for (let k = 0; k <= NX; k++) {
        const x = -S.hw * 0.995 + 1.99 * S.hw * k / NX;
        const ov = 0.0028 * Math.sin((x / STAKE) * Math.PI + r * Math.PI);
        const p = tub.map(x, s2, ov), pn = tub.map(x, s2, ov + 0.01), pd = tub.map(x, s2 + 0.005, ov);
        pts.push(p); ns.push(K.nrm(K.sub(pn, p))); ds.push(K.nrm(K.sub(pd, p)));
      }
      const ring = i => { const p = pts[i], n = ns[i], d = ds[i];
        return [K.add(K.off(p, d, -WID / 2), K.mul(n, TH / 2)), K.add(K.off(p, d, WID / 2), K.mul(n, TH / 2)),
                K.add(K.off(p, d, WID / 2), K.mul(n, -TH / 2)), K.add(K.off(p, d, -WID / 2), K.mul(n, -TH / 2))].map(v => wb.v(v)); };
      const R = pts.map((_, i) => ring(i));
      for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; wb.quad(R[i][k], R[i][k2], R[i + 1][k2], R[i + 1][k]); }
    }
  }
  // the stakes: the round canes the weave is woven on, every 45 mm, end to end
  if (fine(2)) {
    const cb = B.of(mRim);
    for (let x = -S.hw + STAKE / 2; x <= S.hw - STAKE / 2 + 1e-6; x += STAKE) {
      const pts = [];
      for (let k = 0; k <= 30; k++) pts.push(tub.map(x, -L / 2 + 0.01 + (L - 0.02) * k / 30, 0));
      kitLine(cb, pts, 0.0032, 6);
    }
  }
  // the rim: a thick wrapped roll round the whole edge, the binding showing as a spiral
  {
    const loop = [], NS = 70, NX = 22, ex = S.hw * 0.999, es = L / 2 * 0.999;
    for (let k = 0; k < NS; k++) loop.push([ex, -es + 2 * es * k / NS]);
    for (let k = 0; k < NX; k++) loop.push([ex - 2 * ex * k / NX, es]);
    for (let k = 0; k < NS; k++) loop.push([-ex, es - 2 * es * k / NS]);
    for (let k = 0; k < NX; k++) loop.push([-ex + 2 * ex * k / NX, -es]);
    const pts = loop.map(q => tub.map(q[0], q[1], 0));
    kitLoop(B.of(mRim), pts, 0.011, 10);
  }
  // the cushion: a round-fronted leather pad with piping
  const cs = slab(B.of(mLea), { on: tub, gap: 0.006, sx: S.sx, sp, s0: 0.02, s1: sH + 0.01, hw: S.hw * 0.80, th: cush / 2, r: 0.018, rs: 0.03,
                                face: true, crown: 0.010, nx: 14, ns: 12, nt: 3, groove: grooves([0], 0.08, 0.005, 'u', 0.8) });
  piping(B.of(mPipe), cs, 0.004);
  // the ash bearers: two across the fuselage under the tub, on blocks
  for (const z of [S.H[1] + 0.03, S.F[1] - 0.08]) {
    const y = sp.at(sp.sOf([S.H[0], z])).p[0] - cush - 0.03;
    const fl = A.floorAt(z);
    const yb = Math.max(fl + 0.03, y - 0.03);
    K.boxIn(B.of(mAsh), [S.sx, yb, z], [S.hw + 0.06, 0.016, 0.018], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    for (const sd of [-1, 1]) {
      K.boxIn(B.of(mAsh), [S.sx + sd * (S.hw + 0.03), (fl + yb - 0.016) / 2, z], [0.02, Math.max(0.004, (yb - 0.016 - fl) / 2), 0.02], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.bolt(B.of(mBolt), [S.sx + sd * S.hw * 0.5, yb + 0.017, z], [0, 1, 0], 0.005, 0.004);
    }
  }
  return S;
}

// ---- 13. GLIDER TUB (ASK-21 / Discus) -------------------------------------------------------------------------------------
// A sailplane's seat is the cockpit: the moulded glass-fibre pan, white gelcoat, a thin seat cushion in it, and the pilot
// lying back against a BACKREST - a padded board hinged at its foot, its angle set by two side struts onto notched
// quadrants on the tub's rear wall, a headrest pad on its top. The tub is anchored by four small tubes. The recline row moves the board; the pan stays the hull's.
function seatGlider(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mGel = mat('gelcoat', 0xeeeee9, FRAME), mPad = mat('liner', 0x3b4a5c, TRIM), mBoard = mat('ply', 0xb89464),
        mHead = mat('liner', 0x2d3542, ACCENT), mAlu = mat('bareAlu', 0xb6bcc3), mCast = mat('castAlu', 0x8e949a),
        mBolt = mat('chrome', 0xdfe5ec);
  const K = KIT();
  const cush = 0.025;
  // the pan: from under the knees, round the hinge, a little way up behind (the hull's own bulkhead foot)
  const sp = spine([ptP(S, S.panL + 0.06, g, -0.06), ptP(S, S.panL, g), S.H, ptB(S, 0.20, -0.06)], 0.10);
  const L = sp.L, sH = sp.sOf(S.H);
  const tub = slab(B.of(mGel), { sx: S.sx, sp, s0: 0, s1: L, hw: S.hw, th: 0.005, r: 0.0048, face: true, lift: -cush - 0.004,
                                 wing: (u, v) => [0.09 * smooth(0.5, 1.0, Math.abs(u)) * smooth(0, 0.15, (v + 1) / 2 * L), 0.04 * S.hw * smooth(0.6, 1, Math.abs(u))],
                                 nx: 22, ns: 30, nt: 1 });
  rimBead(B.of(mGel), tub, 0.006);
  const cs = slab(B.of(mPad), { on: tub, sx: S.sx, sp, s0: 0.03, s1: sH, hw: S.hw * 0.66, th: cush / 2, r: 0.010, rs: 0.02, face: true,
                                crown: 0.006, nx: 12, ns: 12, nt: 2, groove: grooves([-0.4, 0.2], 0.08, 0.004, 'v', 0.85) });
  stitchLoop(B.of(mHead), cs, 0.008, 0.0010);
  // the backrest: a ply board, a fabric pad on it, the headrest pad at its top, hinged at its foot
  const thPad = 0.030, bL = S.backL - 0.16;
  const spB = spine([ptB(S, 0.03), ptB(S, bL)], 0);
  slab(B.of(mBoard), { sx: S.sx, sp: spB, s0: 0, s1: spB.L, hw: S.hw * 0.70, th: 0.005, r: 0.0048, face: true, lift: -thPad,
                       nx: 8, ns: 8, nt: 1, hwAt: v => 1 - 0.12 * smooth(0.3, 1, v) });
  const bp = slab(B.of(mPad), { sx: S.sx, sp: spB, s0: 0.01, s1: spB.L - 0.01, hw: S.hw * 0.68, th: thPad / 2, r: 0.012, rs: 0.02,
                                face: true, crown: 0.006, nx: 12, ns: 16, nt: 2, hwAt: v => 1 - 0.12 * smooth(0.3, 1, v),
                                groove: grooves([-0.5, 0.0, 0.5], 0.06, 0.004, 'v', 0.85) });
  stitchLoop(B.of(mHead), bp, 0.008, 0.0010);
  const spH = spine([ptB(S, bL + 0.02, -0.004), ptB(S, S.backL, -0.008)], 0);
  slab(B.of(mHead), { sx: S.sx, sp: spH, s0: 0, s1: spH.L, hw: S.hw * 0.48, th: 0.028, r: 0.022, rs: 0.03, face: true,
                      crown: 0.008, nx: 10, ns: 8, nt: 2 });
  for (const sd of [-1, 1]) {
    const a = ptB(S, bL - 0.02, -thPad - 0.01), b = ptB(S, bL + 0.06, -0.03);
    kitTube(B.of(mAlu), [[S.sx + sd * S.hw * 0.22, a[0], a[1]], [S.sx + sd * S.hw * 0.22, b[0], b[1]]], 0.006, 10);
  }
  // the hinge knuckles at the board's foot, on the tub
  for (const sd of [-1, 1]) {
    const h = ptB(S, 0.03, -thPad - 0.006);
    K.revolve(B.of(mCast), [S.sx + sd * S.hw * 0.5 - 0.03, h[0], h[1]], [1, 0, 0], [[0, 0], [0.011, 0], [0.011, 0.06], [0, 0.06]], 12, false);
  }
  // THE TUB'S ANCHORS (the user, 2 Nov: "just anchor the tub with 4 small tubes"): four short alloy tubes from its belly
  // to tabs on the floor, a bolt through each foot
  for (const sd of [-1, 1]) for (const s2 of [0.10, sp.sOf(S.H) - 0.02]) {
    const p = tub.map(sd * S.hw * 0.45, s2 - L / 2, -tub.th);
    const ft = [p[0], A.floorAt(p[2]) + 0.012, p[2]];
    if (p[1] - ft[1] < 0.01) continue;
    kitTube(B.of(mAlu), [p, ft], 0.008, 12);
    K.revolve(B.of(mCast), [p[0], p[1] - 0.004, p[2]], [0, 1, 0], [[0, 0], [0.014, 0], [0.014, 0.004], [0, 0.004]], 14, false);
    K.boxIn(B.of(mCast), [ft[0], A.floorAt(ft[2]) + 0.002, ft[2]], [0.016, 0.002, 0.016], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    K.lug(B.of(mCast), ft, [1, 0, 0], [0, 1, 0], 0.009, 0.006, 0.012);
    K.bolt(B.of(mBolt), [ft[0] + 0.007, ft[1], ft[2]], [1, 0, 0], 0.0035, 0.004);
  }
  // THE BACKREST'S ADJUSTMENT: a strut each side from the board's back down onto a notched alloy quadrant bolted to the
  // tub's rear wall - the board leans on the struts, a pin through the quadrant's notches sets the angle
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * S.hw * 0.56;
    const wall = tub.map(sd * S.hw * 0.56, sp.sOf(ptB(S, 0.17, -0.06)) - L / 2, -tub.th - 0.004);
    const brd = ptB(S, bL * 0.55, -thPad - 0.010);
    kitTube(B.of(mAlu), [[x, brd[0], brd[1]], wall], 0.0065, 10);
    K.boxIn(B.of(mCast), wall, [0.004, 0.03, 0.022], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    for (let k = -2; k <= 2; k++) K.revolve(B.of(mBolt), [x + sd * 0.0045, wall[1] + k * 0.011, wall[2] - 0.012], [sd, 0, 0], [[0.0022, 0], [0.0022, 0.001], [0, 0.001]], 8, false);
    K.bolt(B.of(mBolt), [x + sd * 0.005, wall[1], wall[2]], [sd, 0, 0], 0.004, 0.004);
  }
  return S;
}

// ---- 14. BUSH JUMP SEAT (Beaver / Husky / Cub rear) -----------------------------------------------------------------------
// The seat a bush cabin folds out of the way for cargo: a light steel U-frame on two floor hinges at its back edge, a
// fold-out leg pair at the front, an olive canvas seat laced to it, and a back of canvas on two uprights with a webbing
// strap across; a quick-release pin at each hinge.
function seatJump(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mFrame = mat('trim', 0x50574a, FRAME), mCanvas = mat('webbing', 0x6b6a48, TRIM), mStrap = mat('webbing', 0x3d3b2c, ACCENT),
        mCast = mat('castAlu', 0x8e949a), mPin = mat('chrome', 0xdfe5ec), mRing = mat('plasticScr', 0xc0302a);
  const K = KIT();
  const tr = 0.0085, w = S.hw;
  const yPan = z => S.H[0] - 0.012 + (z - S.H[1]) * Math.tan(g.tilt);
  const zR = S.H[1] - 0.02, zF = S.F[1] - 0.01;
  const fb = B.of(mFrame);
  kitTube(fb, [[S.sx - w, yPan(zR), zR], [S.sx - w, yPan(zF), zF], [S.sx + w, yPan(zF), zF], [S.sx + w, yPan(zR), zR]], tr, 12);
  kitTube(fb, [[S.sx - w - 0.003, yPan(zR), zR], [S.sx + w + 0.003, yPan(zR), zR]], tr, 12);
  // the canvas seat: a sling with a deeper sag than a fixed seat (it is just canvas)
  const spS = spine([[yPan(zF) + 0.004, zF - 0.012], [yPan(zR) + 0.004, zR + 0.012]], 0);
  const sl = slab(B.of(mCanvas), { sx: S.sx, sp: spS, s0: 0, s1: spS.L, hw: w + tr * 0.6, th: 0.0022, r: 0.0021, rx: 0.0021, rs: 0.0021,
                                   face: false, nx: 14, ns: 14, nt: 1,
                                   wing: (u, v) => [-0.022 * (1 - u * u) * (1 - 0.6 * v * v) + 0.006 * smooth(0.9, 1, Math.abs(u)), 0] });
  // its hems round the side tubes: a rolled canvas sleeve
  for (const sd of [-1, 1]) kitTube(B.of(mCanvas), [[S.sx + sd * w, yPan(zF - 0.02), zF - 0.02], [S.sx + sd * w, yPan(zR + 0.02), zR + 0.02]], tr + 0.0035, 10, 'open');
  void sl;
  // the legs: the front pair folds (a hinge lug under the front tube), the back is hinged to the floor
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * w;
    const p = [x, yPan(zF - 0.03), zF - 0.03], ft = [x, A.floorAt(zF + 0.01) + 0.012, zF + 0.01];
    K.lug(B.of(mCast), [x, yPan(zF - 0.03) - 0.012, zF - 0.03], [1, 0, 0], [0, -1, 0], 0.010, 0.008, 0.012);
    kitTube(fb, [p, ft], tr * 0.9, 10);
    K.revolve(B.of(mCast), [x, A.floorAt(ft[2]), ft[2]], [0, 1, 0], [[0, 0], [0.014, 0], [0.014, 0.012], [0, 0.012]], 12, false);
    // the rear: a floor hinge (two lugs on a plate) with the quick-release pin and its red pull ring
    const fz = zR - 0.01, fy = A.floorAt(fz);
    const rr = [x, fy + 0.03, fz];
    kitTube(fb, [[x, yPan(zR), zR], rr], tr, 10);
    K.boxIn(B.of(mCast), [x, fy + 0.003, fz], [0.02, 0.003, 0.025], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    for (const dx of [-0.012, 0.012]) K.lug(B.of(mCast), [x + dx, fy + 0.03, fz], [1, 0, 0], [0, -1, 0], 0.011, 0.004, 0.026);
    K.revolve(B.of(mPin), [x - 0.02, fy + 0.03, fz], [1, 0, 0], [[0.0035, 0], [0.0035, 0.04], [0, 0.04]], 8, false);
    K.revolve(B.of(mRing), [x + sd * 0.028, fy + 0.03, fz], [0, 0, 1], [[0.009, -0.002], [0.012, 0], [0.009, 0.002], [0.006, 0]], 14, false);
  }
  // the back: two uprights off the rear tube, a top bar, canvas hung between them, one webbing strap across
  const bTop = S.backL;
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * (w - 0.01), b1 = ptB(S, bTop, -0.008);
    kitTube(fb, [[x, yPan(zR), zR], [x, b1[0], b1[1]]], tr, 12);
  }
  { const t = ptB(S, bTop, -0.008); kitTube(fb, [[S.sx - w + 0.01, t[0], t[1]], [S.sx + w - 0.01, t[0], t[1]]], tr, 12); }
  const spB = spine([ptB(S, bTop * 0.40), ptB(S, bTop - 0.015)], 0);
  slab(B.of(mCanvas), { sx: S.sx, sp: spB, s0: 0, s1: spB.L, hw: w - 0.01, th: 0.0022, r: 0.0021, rx: 0.0021, rs: 0.0021,
                        face: false, lift: -0.008, nx: 12, ns: 10, nt: 1, wing: (u, v) => [-0.018 * (1 - u * u) * (1 - v * v), 0] });
  const spT = spine([ptB(S, bTop * 0.24), ptB(S, bTop * 0.31)], 0);
  slab(B.of(mStrap), { sx: S.sx, sp: spT, s0: 0, s1: spT.L, hw: w + 0.004, th: 0.0024, r: 0.0023, rx: 0.0023, rs: 0.0023,
                       face: false, lift: -0.008, nx: 12, ns: 2, nt: 1, wing: (u, v) => [-0.012 * (1 - u * u), 0] });
  return S;
}

// ---- 15. WARBIRD BUCKET (Spitfire / T-6) ----------------------------------------------------------------------------------
// A fighter pilot sat on his parachute: the seat is a deep moulded bucket (the Spitfire's is resin-bonded fibre, the
// reddish-brown "bakelite" seat) with flared sides, vertical stiffening ribs pressed into its back, lightening holes in
// its sides, a padded back cushion at shoulder height, the seat-pack parachute in the pan, and the whole hung from a
// steel frame behind it by two side brackets, raised and lowered by a lever on the right.
function seatWarbird(B, A, P, g, pre, sbs) {
  const S = stance(A, P, g, pre, sbs);
  const mBkt = mat('plasticScr', 0x5e2b1a, FRAME), mPack = mat('webbing', 0x8a7f5a, ACCENT), mPackE = mat('webbing', 0x5d5539, SEAM),
        mLea = mat('leather', 0x3a2618, TRIM), mSteel = mat('trim', 0x5a6a50), mCast = mat('castAlu', 0x8e949a),
        mBolt = mat('chrome', 0xdfe5ec), mDark = mat('rubber', 0x18191c);
  const K = KIT();
  const pack = 0.085;                                        // the seat pack's thickness
  const sp = spine([ptP(S, S.panL + 0.01, g, -0.02), ptP(S, S.panL, g), S.H, ptB(S, S.backL)], 0.08);
  const L = sp.L, sH = sp.sOf(S.H);
  const lift = s2 => -(0.048 + (pack - 0.048) * (1 - smooth(sH - 0.05, sH + 0.08, s2)));   // the pack on the pan, the back cushion's depth up the back
  const ribs = (u, v) => { const s2 = (v + 1) / 2 * L; const onB = smooth(sH + 0.06, sH + 0.12, s2); return 0.004 * onB * grooves([-0.55, -0.18, 0.18, 0.55], 0.05, 1, 'u')(u, v); };
  const sh = slab(B.of(mBkt), { sx: S.sx, sp, s0: 0, s1: L, hw: S.hw, th: 0.0045, r: 0.0044, face: true,
                                wing: (u, v) => { const s2 = (v + 1) / 2 * L; const onPan = 1 - smooth(sH - 0.05, sH + 0.10, s2);
                                  return [(onPan * 0.15 + (1 - onPan) * 0.10) * smooth(0.55, 1.0, Math.abs(u)) * smooth(0, 0.1, s2) + lift(s2),
                                          -0.05 * S.hw * smooth(0.7, 1, Math.abs(u)) * onPan]; },
                                groove: ribs, nx: 24, ns: 50, nt: 1 });
  rimBead(B.of(mBkt), sh, 0.007);
  // the lightening holes in the flared sides: dark ovals set into the wall
  if (fine(2)) for (const sd of [-1, 1]) for (const f of [0.35, 0.62]) {
    const s2 = sH * f;
    const c = sh.map(sd * S.hw * 0.86, s2 - L / 2, sh.th + 0.0006);
    const n = K.nrm(K.sub(sh.map(sd * S.hw * 0.86, s2 - L / 2, sh.th + 0.01), c));
    K.revolve(B.of(mDark), c, n, [[0, 0], [0.024, 0], [0.024, 0.0008], [0, 0.0008]], 18, false);
  }
  // the seat-pack parachute in the pan: a fat canvas pack with a stitched rim and its harness ring
  const pk = slab(B.of(mPack), { on: sh, sx: S.sx, sp, s0: 0.03, s1: sH - 0.02, hw: S.hw * 0.74, th: pack / 2, r: 0.03, rs: 0.035,
                                 face: true, crown: 0.008, nx: 14, ns: 12, nt: 4,
                                 groove: (u, v) => 0.005 * Math.exp(-((v / 0.05) ** 2)) * (1 - smooth(0.7, 0.85, Math.abs(u))) });
  piping(B.of(mPackE), pk, 0.004);
  // the back cushion at the shoulders
  const bc = slab(B.of(mLea), { on: sh, sx: S.sx, sp, s0: sH + 0.20, s1: L - 0.06, hw: S.hw * 0.62, th: 0.022, r: 0.016, rs: 0.02,
                                face: true, crown: 0.008, nx: 12, ns: 10, nt: 2, groove: grooves([-0.3, 0.3], 0.07, 0.005, 'u') });
  piping(B.of(mLea), bc, 0.004);
  // the frame behind: two steel uprights, a cross tube, the side brackets into the bucket's flanks, the lever
  const zT = S.H[1] - 0.12 - S.bs * 0.2, topY = ptB(S, S.backL * 0.70)[0];
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * S.hw * 0.78;
    kitTube(B.of(mSteel), [[x, A.floorAt(zT), zT], [x, topY, zT]], 0.013, 12);
    K.boxIn(B.of(mCast), [x, A.floorAt(zT) + 0.005, zT], [0.025, 0.005, 0.025], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const p1 = sh.map(sd * S.hw * 0.78, sp.sOf(ptB(S, 0.15)) - L / 2, -sh.th), p2 = sh.map(sd * S.hw * 0.78, sp.sOf(ptB(S, 0.42)) - L / 2, -sh.th);
    for (const p of [p1, p2]) {
      kitTube(B.of(mSteel), [[x, p[1], zT], p], 0.009, 10);
      K.bolt(B.of(mBolt), p, K.nrm([0, p[1] - p[1], -1]), 0.005, 0.004);
    }
  }
  kitTube(B.of(mSteel), [[S.sx - S.hw * 0.78, topY - 0.02, zT], [S.sx + S.hw * 0.78, topY - 0.02, zT]], 0.012, 12);
  {
    const x = S.sx - S.hw - 0.03, p0 = [x, S.H[0] - 0.02, S.H[1] - 0.05], p1 = [x, S.H[0] + 0.10, S.H[1] + 0.10];
    kitTube(B.of(mSteel), [p0, p1], 0.007, 10);
    K.revolve(B.of(mDark), p1, [0, 0.6, 0.8], [[0, 0], [0.012, 0.004], [0.013, 0.03], [0, 0.034]], 14, false);
  }
  return S;
}

// ---- 16. DHC-2 BEAVER ------------------------------------------------------------------------------------------------------
// The Beaver's crew seat: a painted steel-tube frame whose side members run up into the back, a pressed alloy back panel
// with flanged lightening holes, channel-pleated leatherette cushions (the vertical rolls of the period), short fore/aft
// tracks. (Its folding rear bench was modelled and dropped, the user 2 Nov: a cabin takes any preset via paxSeatType.)
function seatBeaver(B, A, P, g, pre, sbs, SP) {
  const S = stance(A, P, g, pre, sbs);
  const mFrame = mat('trim', 0x5d6460, FRAME), mLea = mat('leatherDark', 0x6b5a45, TRIM), mPipe = mat('leatherDark', 0x3e3226, SEAM),
        mPanel = mat('panelMetal', 0x8a9087, ACCENT), mAlu = mat('bareAlu', 0xb6bcc3), mCast = mat('castAlu', 0x8e949a),
        mDark = mat('rubber', 0x1b1c20), mBolt = mat('chrome', 0xdfe5ec);
  const K = KIT();
  const tr = 0.011, w = S.hw;
  const thP = 0.045, thB = 0.035;
  const yPan = z => S.H[0] - 2 * thP - 0.018 + (z - S.H[1]) * Math.tan(g.tilt);
  const zR = S.H[1] - 0.03, zF = S.F[1] - 0.02;
  const fb = B.of(mFrame);
  // the side frames: from the front foot up to the pan, aft along it, round the hinge and up the back - one bent tube
  for (const sd of [-1, 1]) {
    const x = S.sx + sd * w;
    const top = ptB(S, S.backL - 0.02, -2 * thB - 0.02);
    kitTube(fb, [[x, A.floorAt(zF) + 0.03, zF + 0.02], [x, yPan(zF), zF], [x, yPan(zR), zR], [x, top[0], top[1]]], tr, 14);
    kitTube(fb, [[x, A.floorAt(zR) + 0.03, zR - 0.02], [x, yPan(zR + 0.05), zR + 0.05]], tr * 0.9, 12);
    for (const z of [zF + 0.02, zR - 0.02]) {
      K.revolve(B.of(mDark), [x - 0.012, A.floorAt(z) + 0.018, z], [1, 0, 0], [[0, 0], [0.011, 0], [0.012, 0.003], [0.012, 0.021], [0.011, 0.024], [0, 0.024]], 12, false);
      K.bolt(B.of(mBolt), [x - sd * 0.015, A.floorAt(z) + 0.018, z], [sd, 0, 0], 0.0045, 0.004);
    }
  }
  for (const z of [zF, zR]) kitTube(fb, [[S.sx - w - 0.005, yPan(z), z], [S.sx + w + 0.005, yPan(z), z]], tr * 0.9, 12);
  { const t = ptB(S, S.backL - 0.02, -2 * thB - 0.02); kitTube(fb, [[S.sx - w, t[0], t[1]], [S.sx + w, t[0], t[1]]], tr * 0.9, 12); }
  // the pan sheet
  K.boxIn(B.of(mPanel), [S.sx, (yPan(zF) + yPan(zR)) / 2 + tr + 0.003, (zF + zR) / 2], [w - 0.004, 0.003, (zF - zR) / 2 + 0.005],
          [1, 0, 0], [0, Math.cos(g.tilt), -Math.sin(g.tilt)], [0, Math.sin(g.tilt), Math.cos(g.tilt)]);
  // the pressed back panel with its lightening holes (flanged: a dark disc in a raised ring)
  const spB = spine([ptB(S, 0.04), ptB(S, S.backL - 0.01)], 0);
  const bp = slab(B.of(mPanel), { sx: S.sx, sp: spB, s0: 0, s1: spB.L, hw: w - 0.002, th: 0.003, r: 0.0029, rx: 0.0029, rs: 0.0029,
                                  face: true, lift: -2 * thB - 0.008, nx: 12, ns: 12, nt: 1,
                                  wing: (u, v) => [0.018 * smooth(0.85, 1, Math.abs(u)), 0] });
  for (const [a, b] of [[-0.45, 0.35], [0.45, 0.35], [-0.45, -0.25], [0.45, -0.25]]) {
    const c = bp.map(a * bp.hw, b * bp.hs, -bp.th - 0.0005), q = spB.at(b * bp.hs + spB.L / 2), n = [0, -q.n[0], -q.n[1]];
    K.revolve(B.of(mPanel), c, n, [[0.034, 0], [0.036, 0.003], [0.030, 0.006], [0.028, 0.006]], 22, false);
    K.revolve(B.of(mDark), K.off(c, n, 0.001), n, [[0, 0], [0.028, 0], [0.028, 0.0006], [0, 0.0006]], 22, false);
  }
  // the cushions: channel-pleated (vertical rolls), piped
  const spP = spine([ptP(S, S.panL + 0.01, g, -0.02), ptP(S, S.panL, g), S.H, ptB(S, 0.05)], 0.04);
  const sH = spP.sOf(S.H);
  const sq = slab(B.of(mLea), { sx: S.sx, sp: spP, s0: 0, s1: sH - 0.01, hw: w * 0.96, th: thP, r: 0.026, rs: 0.035, face: true,
                                nx: 20, ns: 16, nt: 4, crown: 0.006,
                                crownAt: (u, v) => 0.008 * smooth(0.5, 0.9, -v),
                                groove: grooves([-0.62, -0.31, 0, 0.31, 0.62], 0.05, 0.008, 'u', 0.86) });
  piping(B.of(mPipe), sq, 0.0045);
  const bk = slab(B.of(mLea), { sx: S.sx, sp: spB, s0: 0.03, s1: spB.L - 0.04, hw: w * 0.92, th: thB, r: 0.022, rs: 0.03, face: true,
                                nx: 20, ns: 18, nt: 4, crown: 0.006,
                                groove: grooves([-0.62, -0.31, 0, 0.31, 0.62], 0.05, 0.008, 'u', 0.86) });
  piping(B.of(mPipe), bk, 0.0045);
  seatRails(B, mAlu, mDark, A, S.sx, zR - 0.16, zF + 0.16, w);
  return S;
}

// ---- dispatch ------------------------------------------------------------------------------------------------------------
const BUILD = { beaver: seatBeaver, glider: seatGlider, jump: seatJump, warbird: seatWarbird, ag: seatAg, wicker: seatWicker, cub: seatCub, carbon2: seatCarbon, c172: seatC172, icon: seatIcon, bonanza: seatBonanza, ul: seatUL, extra: seatExtra, dc3: seatDC3 };
// the crew's interface: parent, the anchors A, the rows P, the seat's geometry g (seatGeom), this seat's SP, sbs
function build(parent, A, P, g, SP, sbs) {
  const pre = PRESET_OF(P.seatType);
  if (!pre || !BUILD[pre.build]) return null;
  // seatGeom carries the squab centre, not the back's station: zBack is szc - 0.20 there
  if (g.zBack == null) g = Object.assign({}, g, { zBack: g.szc - 0.20 });
  const lvl = levelFor(P);
  const B = Bags();
  LOD.lvl = lvl;
  ROLE = lvl >= 1 ? {} : null;
  let S;
  let st;
  try { S = BUILD[pre.build](B, A, P, g, pre, sbs, SP); st = B.flush(parent); } finally { LOD.lvl = 0; ROLE = null; }
  const kg = pre.kg;
  parent.userData.seatStats = { key: pre.key, tris: st.tris, draws: st.draws, kg, lod: lvl };
  return { panY: g.panY, floor: g.floor, szc: g.szc, hw: S.hw, backH: S.backL, rake: g.rake, fit: S.fit,
           preset: pre.key, kg, tris: st.tris, draws: st.draws, lod: lvl };
}
// WHICH LEVEL A SEAT IS BUILT AT: one level per build, not a THREE.LOD (the join flattens the crew layer's meshes, and
// a parked aeroplane already drops the whole interior past its first rung): the phone profile builds the phone level,
// everything else the hero; SEAT_GEN.force (the bench), ?seatlod=0|1|2 or P.seatLod override, in that order
function levelFor(P) {
  if (API.force != null) return API.force;
  if (typeof window !== 'undefined') {
    const m = /[?&]seatlod=([012])(&|$)/.exec((window.location && window.location.search) || '');
    if (m) return +m[1];
  }
  if (P && P.seatLod != null && +P.seatLod >= 0) return Math.min(2, Math.round(+P.seatLod));
  if (typeof window !== 'undefined' && window.PROFILE && window.PROFILE.name === 'phone') return 2;
  // SEATS-COST (3 Nov, A0's FRAMECOST review): the game builds the MID level - the same shapes at a fifth of the
  // triangles (the hero's stitching, rail holes and bolts are what goes) - so a garage boot uploads ~12 MB less; the hero
  // is the seat studio's (tools/_seats.html) and ?seatlod=0's
  return 1;
}

const API = { SEAT_PRESETS, PRESET_OF, build, slab, spine, mat, splitParts: false, force: null, levelFor };
if (typeof window !== 'undefined') window.SEAT_GEN = API;
if (typeof module !== 'undefined') module.exports = API;
})();
