// VESSEL GEN (G99) — A TANK IS A SOLID, AND THIS FILE SAYS WHERE IT IS.
//
// The energy module's core half (60c_gen_energy.js) knows a vessel as a
// capacity in a named bay at a station: enough for the ledger to bill its mass
// onto the right ring, and for the plaque to say whether the litres fit the
// litres. It does not know the SHAPE. The user's spec for the arc was a
// physical thing — "a real solid dropped into a declared bay, nudged and
// rotated until it fits around the pilot" — and a solid has corners, and the
// corners are what hit the skin or the pilot.
//
// So this file is the geometry of a vessel, PURE: no THREE, no DOM, no scene.
// It takes a mesh with the surface field on it (the same one `_bay_site.js`
// sweeps) and a vessel declaration, and answers with the solid's placement and
// the points on it that a fit test needs. The layer (`_cage_energy.js`) draws
// what this returns; GATE ENERGY runs it headless off a cage built in node.
// One placement, two readers, and the picture cannot disagree with the gate.
//
// ---------------------------------------------------------------------------
// THE SHAPE IS THE VESSEL'S, NOT THE BAY'S. A bought tank has proportions —
// a welded box is longer than it is tall, a pack is a slab — and the user
// moves THAT around until it fits, which is a different thing from filling
// the bay with whatever shape the bay has. `wet` is the one exception and it
// is the honest one: a wet wing is the spar bay itself, sealed, so its "solid"
// IS the bay.
//
// UNITS, because the K2 trap (_cage_access.js) is real. The body mesh is in
// cage units and everything else in the project is metres; `FS` (CAGE_UNIT x
// planeScale) is the ratio. This file takes and returns SCENE METRES for
// positions and dimensions, and converts to mesh units only at the two places
// the field is asked — the section at a station, and the fit of the corners.
'use strict';

const B_ = (typeof window !== 'undefined' && window.BAY_SITE) ||
           (typeof require === 'function' ? require('./_bay_site.js') : null);

// ---------------------------------------------------------------------------
// THE CATALOGUE'S PROPORTIONS. `aspect` is [along, across, up] before scaling;
// `fill` is how much of the bounding box a rounded shell actually occupies,
// so the box is drawn a little larger than the litres it holds — a tank with
// radiused corners needs more room than its capacity says.
// ---------------------------------------------------------------------------
const SHAPES = {
  alu:      { aspect: [1.50, 1.00, 0.72], fill: 0.90, form: 'box'  },
  moulded:  { aspect: [1.40, 1.00, 0.80], fill: 0.86, form: 'box'  },
  bladder:  { aspect: [1.60, 1.00, 0.58], fill: 0.80, form: 'box'  },
  packCase: { aspect: [2.00, 1.40, 0.36], fill: 0.94, form: 'box'  },
  wet:      { aspect: [1, 1, 1],          fill: 1.00, form: 'bay'  },
};

// A ROUND TANK IN A SQUARE BOX HOLDS LESS (2026-09-04, the user: "you may
// allow for rounded cylinders as geometry, as an alternative to boxes"). The
// drawn form is the player's, and the ledger has to bill what the drawn thing
// actually holds — so the catalogue's `fill` is multiplied by the FORM's own
// occupancy of its bounding box.
//
// 0.78 is measured off the solid _vessel_mesh.js draws, not guessed. That
// cylinder is an elliptic barrel of semi-axes (ex, ey) and length 2*zc closed
// by two half-spheroids of depth a = 0.30*ez, so zc = 0.70*ez and
//     V / (8 ex ey ez) = pi (2 zc + 4a/3) / (8 (zc + a)) = pi * 1.8 / 8 = 0.707
// against the box row's declared 0.90: 0.707 / 0.90 = 0.785. The BOX factor is
// exactly 1, so nothing that existed before this row changed by a gram.
const FORM_FILL = { box: 1.00, cyl: 0.78 };
const formFill = (sh, form) => sh.fill * (FORM_FILL[form] || 1);

// the box a vessel of `installedL` litres needs, in metres — or the box the
// PLAYER drew, when the vessel carries its own `dims`: the user's rule is
// "the player will edit themselves the exact placement and geometry and the
// capacity is calculated", so a drawn box wins and its litres follow it
function vesselDims(vesselKey, installedL, dims, form) {
  const sh = SHAPES[vesselKey] || SHAPES.alu;
  const fill = formFill(sh, form);
  if (dims && dims.L > 0 && dims.W > 0 && dims.H > 0)
    return { L: +dims.L, W: +dims.W, H: +dims.H, form: sh.form, fill, own: true };
  const m3 = Math.max(0, installedL || 0) / 1000;
  const a = sh.aspect;
  // aspect scaled so that (L W H) * fill = m3
  const k = Math.cbrt(m3 / Math.max(1e-9, a[0] * a[1] * a[2] * fill));
  return { L: a[0] * k, W: a[1] * k, H: a[2] * k, form: sh.form, fill };
}
// the INSTALLED litres a drawn box holds: its volume, less the shell's
// rounding. The caller turns installed litres into fuel litres (/1.06) or
// pack kWh (/1.18, then the chemistry's Wh per litre) — the same factors
// genVesselResolve applies the other way round, so the two agree
function installedFromDims(vesselKey, dims, form) {
  const sh = SHAPES[vesselKey] || SHAPES.alu;
  if (!dims || !(dims.L > 0 && dims.W > 0 && dims.H > 0)) return 0;
  return dims.L * dims.W * dims.H * formFill(sh, form) * 1000;
}

// WHERE A VESSEL GOES WHEN NOBODY HAS SAID. The user's rule, verbatim: "the
// fuel tank is either collated to the firewall, on the engine side, or it is
// at the bottom of the cabin, touching the aft bulkhead, on the cabin side.
// The important is the position against aft bulkhead, so it can sit in the
// cabin or the passenger bay, depending on the configuration."
//   nose bay      -> its front face on the firewall, and high (gravity feed)
//   any other bay -> on the floor, its back face on the bay's aft bulkhead
// No search, no cleverness: the player edits the exact placement from here,
// and the fit readout says what is in the way.
function defaultSpot(bay, dims) {
  const g = 0.02;
  if (bay.on !== 'body') return { along: bay.span ? bay.span[0] : 0, lv: null, rot: 0 };
  const len = bay.x1 - bay.x0;
  // A BOX LONGER THAN ITS BAY GOES ACROSS THE BODY. Measured on the Cub: the
  // deck bay the field describes is 0.45 m long and the catalogue's 45 L box
  // is 0.55 — and the real J-3 tank there is exactly that box turned, wide
  // and flat under the deck. Turned only when the width then fits the
  // length; otherwise the box stays straight and the readout says why.
  let rot = 0, L = dims.L;
  if (L > len - 2 * g && dims.W <= len - 2 * g) { rot = 90; L = dims.W; }
  if (bay.key === 'nose' || bay.feed === 'gravity')
    return { along: bay.x0 + Math.min(L / 2 + g, len / 2), lv: 1, rot };
  return { along: bay.x1 - Math.min(L / 2 + g, len / 2), lv: 0, rot };
}

// ---------------------------------------------------------------------------
// THE BODY'S BAYS, MEASURED OFF THE CAGE (the bench has no gen spec).
// ---------------------------------------------------------------------------
// The core's bay rule reads `S.cab.noseGap`, `S.cab.len`, `S.fuse.cargoLen`
// and `S.fuse.tailArm` off the RESOLVED spec. In the game that spec exists
// (`GARAGE_SPEC.resolved()`); on the bench it does not, so this reconstructs
// exactly the four numbers the join measures — from the same named rings, by
// the same subtractions — so the core rule runs unchanged in both places and
// the bay a tank is offered on the bench is the bay it is billed to in flight.
//   noseGap = firewall -> cabin front pillar (pilCabB)
//   cab.len = front pillar -> aft cabin pillar (pilPaxA)
//   tailArm = firewall -> tail post
// "Firewall" is the windscreen-base ring (`wsFront`), which is the lattice's
// datum and the field's sL = 0 (G49); the cowl deck is forward of it.
function ringsOf(cageSpec, G) {
  if (!G || !G.cageResolve) return null;
  let R = null;
  try { R = G.cageResolve(cageSpec); } catch (e) { return null; }
  return name => {
    const r = R && R.rings && R.rings.find(x => x.name === name);
    return r && r.lv && r.lv.waist ? r.lv.waist.z : null;
  };
}
// THE DATUM, in cage units: the windscreen-base ring's waist. This is the
// join's `zFw`, the core's x = 0, and where the ledger's firewall ring sits.
function firewallZ(cageSpec, G) {
  const zOf = ringsOf(cageSpec, G);
  return zOf ? zOf('wsFront') : null;
}
function specFromCage(cageSpec, G, wing, fuseDefaults) {
  const zOf = ringsOf(cageSpec, G);
  if (!zOf) return null;
  const zFw = zOf('wsFront'), zCabF = zOf('pilCabB'), zCabA = zOf('pilPaxA'),
        zPost = zOf('tailPost');
  if (zFw == null) return null;
  const fd = fuseDefaults || {};
  const noseGap = zCabF != null && zFw > zCabF ? zFw - zCabF : 0.6;
  const len = zCabF != null && zCabA != null && zCabF > zCabA
    ? zCabF - zCabA : 1.2;
  const tailArm = zPost != null && zFw > zPost ? zFw - zPost : 4.5;
  return {
    cab: { noseGap, len },
    fuse: { cargoLen: fd.cargoLen != null ? fd.cargoLen : 0.4, tailArm },
    wing: wing || null,
    _zFw: zFw,
  };
}

// ---------------------------------------------------------------------------
// A BODY VESSEL, PLACED.
// ---------------------------------------------------------------------------
// `bay`  the resolved bay ({x0, x1, lv:[lo,hi]}), metres aft of the firewall
// `v`    the vessel {along, lv, rot} — nulls mean the bay's own defaults
// `dims` from vesselDims
// `mesh` the cage with its field; `FS` its unit in metres; `wall` in metres
//
// Returns scene-metre placement (centre, half-extents, rotation about y), the
// fit against the skin, and whether it stays inside its bay. The corners are
// the samples, plus the midpoints of the long edges: a box that pokes through
// a curved flank between two corners is caught by the midpoint, and a longer
// tank gets more of them.
// THE SOLID SITS AT AXIS METRES, NOT AT THE FIELD'S sL. The ledger bills a
// vessel's mass at `along` metres aft of the firewall along the BODY AXIS
// (the ring table's x), and the drawn solid has to sit where the mass is.
// The field's sL is "metres along the body" only away from the nose: the
// windscreen rings slope, and measured on the bench cage sL = 0 sits 0.21
// cage units aft of the firewall waist, with the mapping compressed until
// sL ~ 1.0 (0.20 of sL moved the section 0.164 in z). So `zFw` (the datum
// the join and the core share) places the centre, and each sample's z is
// turned back into the sL the skin profile is indexed by through a table
// measured off this very mesh. The fit still speaks the field; the position
// speaks the ledger.
function sLTable(mesh, FS, sL0, sL1, n) {
  let T = [];
  const N = Math.max(4, n || 14);
  for (let i = 0; i < N; i++) {
    const sL = sL0 + (sL1 - sL0) * i / (N - 1);
    const s = B_.baySection(mesh, sL);
    if (s) T.push([sL, s.z]);
  }
  // ONLY THE MONOTONIC PART IS A TABLE. Measured at the nose: for the last
  // 0.3 of sL forward of the deck, z does not move at all — the field is
  // running DOWN THE FIREWALL FACE, not along the body — and a z looked up in
  // that stretch has no single sL. The head of the table is trimmed to where
  // z genuinely falls with sL; the face is not a station a tank can be at.
  let k = 0;
  while (k + 1 < T.length && !(T[k + 1][1] < T[k][1] - 1e-6)) k++;
  T = T.slice(k);
  return T;                                    // z falls as sL rises
}
// NO EXTRAPOLATION: a z beyond either end of the table is a place the field
// does not describe, and the honest answer is null — a corner there has run
// out of the body, which is what the fit then reports
function sLOfZ(T, z) {
  if (!T.length) return null;
  if (z > T[0][1] + 1e-9) return null;
  const last = T[T.length - 1];
  if (z < last[1] - 1e-9) return null;
  for (let i = 0; i + 1 < T.length; i++) {
    const a = T[i], b = T[i + 1];
    if (z <= a[1] && z >= b[1]) {
      const t = (a[1] - z) / Math.max(1e-9, a[1] - b[1]);
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return last[0];
}
// THE BAY, SWEPT ONCE. A placement used to sweep the field afresh — an
// sL table and a profile of its own — and a 144-cell auto-fit took 23 s.
// Every candidate in a bay reads the same body, so the table, the profile
// and each station's extents are measured here once and handed to every
// bodyPlace that follows; a placement then costs one interpolation and one
// fit against stations that already exist. The gate still calls bodyPlace
// without a cache and gets the same answers from the same functions.
function bayCache(mesh, FS, bay, wall, zFw, reach) {
  if (!B_ || !mesh || !bay) return null;
  const wallU = (wall == null ? 0.035 : wall) / FS;
  const r = (reach == null ? 0.7 : reach) / FS;      // how far past the limits
  const T = sLTable(mesh, FS, bay.x0 / FS - r - 0.35 / FS, bay.x1 / FS + r, 28);
  if (!T.length) return null;
  // what the field actually covers, in axis metres: the layer clamps the bay
  // to it, so a slider cannot offer a station the body does not have
  const axisMin = zFw != null ? (zFw - T[0][1]) * FS : null;
  const axisMax = zFw != null ? (zFw - T[T.length - 1][1]) * FS : null;
  let s0, s1;
  if (zFw != null) {
    // the reach may run off the table at either end; the table's own ends
    // are then the bounds (Math.min(null, x) is 0, silently — the first
    // version swept every profile over the wrong stations because of it)
    const a0 = sLOfZ(T, zFw - (bay.x0 - r * FS) / FS), b0 = sLOfZ(T, zFw - (bay.x1 + r * FS) / FS);
    const a = a0 != null ? a0 : T[0][0], b = b0 != null ? b0 : T[T.length - 1][0];
    s0 = Math.min(a, b); s1 = Math.max(a, b);
  } else { s0 = bay.x0 / FS - r; s1 = bay.x1 / FS + r; }
  const n = Math.max(6, Math.ceil((s1 - s0) / (0.05 / FS)) + 1);   // a station every 5 cm
  const prof = B_.bayProfile(mesh, s0, s1, wallU, n);
  // each station's inner extents, for the centre lookup
  const ext = [];
  for (const st of prof) {
    if (!st || st.closed || !st.poly.length) { ext.push(null); continue; }
    let yLo = Infinity, yHi = -Infinity, xLo = Infinity, xHi = -Infinity;
    for (const p of st.poly) {
      if (p[1] < yLo) yLo = p[1]; if (p[1] > yHi) yHi = p[1];
      if (p[0] < xLo) xLo = p[0]; if (p[0] > xHi) xHi = p[0];
    }
    ext.push({ sL: st.sL, z: st.z, yLo, yHi, xLo, xHi });
  }
  return { T, prof, ext, wallU, s0, s1, axisMin, axisMax };
}
// the inner extents at an axis station, for callers that think in metres
function bayExtAt(cache, FS, zFw, along) {
  if (!cache) return null;
  const sL = sLOfZ(cache.T, zFw - along / FS);
  const e = sL != null ? extAt(cache, sL) : null;
  return e ? { xLo: e.xLo * FS, xHi: e.xHi * FS, yLo: e.yLo * FS, yHi: e.yHi * FS } : null;
}
// the inner extents at a station, interpolated between the swept ones
function extAt(cache, sL) {
  const E = cache.ext.filter(Boolean);
  if (!E.length) return null;
  if (sL <= E[0].sL) return E[0];
  if (sL >= E[E.length - 1].sL) return E[E.length - 1];
  for (let i = 0; i + 1 < E.length; i++) {
    const a = E[i], b = E[i + 1];
    if (sL >= a.sL && sL <= b.sL) {
      const t = (sL - a.sL) / Math.max(1e-9, b.sL - a.sL);
      const L = (p, q) => p + (q - p) * t;
      return { sL, z: L(a.z, b.z), yLo: L(a.yLo, b.yLo), yHi: L(a.yHi, b.yHi),
               xLo: L(a.xLo, b.xLo), xHi: L(a.xHi, b.xHi) };
    }
  }
  return E[E.length - 1];
}

function bodyPlace(mesh, FS, bay, v, dims, wall, zFw, cache) {
  const out = { on: 'body', ok: false, why: [] };
  if (!B_ || !mesh || !bay) { out.why.push('no bay'); return out; }
  const wallU = (wall == null ? 0.035 : wall) / FS;

  const lvBand = bay.lv || [0, 1];
  const along = v.along != null ? v.along : 0.5 * (bay.x0 + bay.x1);
  const lv = v.lv != null ? v.lv : 0.5 * (lvBand[0] + lvBand[1]);
  const rot = (v.rot || 0) * Math.PI / 180;

  const halfL = (dims.L / 2 + 0.05) / FS;
  // the sL <-> z table: the bay's, if it was swept, else this placement's own.
  // It reaches FORWARD of sL 0 on purpose: the firewall waist is at negative
  // sL (the windscreen rings slope), so a tank at along = 0 is looked up
  // there rather than extrapolated
  const T = cache ? cache.T
    : sLTable(mesh, FS, bay.x0 / FS - halfL - 0.35 / FS, bay.x1 / FS + halfL, 18);
  // the centre: axis metres aft of the datum, or the field's own sL when no
  // datum was handed over (the profile is then read as if the body were straight)
  let zc, sLc;
  if (zFw != null) { zc = zFw - along / FS; sLc = sLOfZ(T, zc); }
  else { sLc = along / FS; }
  if (sLc == null) { out.why.push('past the body at ' + along.toFixed(2) + ' m'); return out; }

  // the section at the centre station: where the keel and crown are
  let yLo, yHi, xLo, xHi;
  if (cache) {
    const ex = sLc != null ? extAt(cache, sLc) : null;
    if (!ex) { out.why.push('no section at ' + along.toFixed(2) + ' m'); return out; }
    if (zFw == null) zc = ex.z;
    yLo = ex.yLo; yHi = ex.yHi; xLo = ex.xLo; xHi = ex.xHi;
  } else {
    const sec = sLc != null ? B_.baySection(mesh, sLc) : null;
    if (!sec) { out.why.push('no section at ' + along.toFixed(2) + ' m'); return out; }
    if (zFw == null) zc = sec.z;
    const inner = B_.bayInset(sec.poly, wallU);
    const poly = (inner && inner.length >= 3 && !B_.insetCollapsed(sec.poly, inner))
      ? inner : sec.poly;
    yLo = Infinity; yHi = -Infinity; xLo = Infinity; xHi = -Infinity;
    for (const p of poly) {
      if (p[1] < yLo) yLo = p[1]; if (p[1] > yHi) yHi = p[1];
      if (p[0] < xLo) xLo = p[0]; if (p[0] > xHi) xHi = p[0];
    }
  }
  // the bay's vertical band, as a slice of this station's inner section
  const bandLo = yLo + lvBand[0] * (yHi - yLo);
  const bandHi = yLo + lvBand[1] * (yHi - yLo);
  // lv places the vessel's CENTRE within the band, held clear of its edges by
  // half the vessel's own height where the band can afford it
  const hU = dims.H / FS;
  const yc0 = bandLo + lv * (bandHi - bandLo);
  const yc = Math.max(bandLo + hU / 2, Math.min(bandHi - hU / 2, yc0)) ||
             (bandLo + bandHi) / 2;
  // the solid, in scene metres, centred on the body's centreline
  const c = [0, yc * FS, zc * FS];
  const e = [dims.W / 2, dims.H / 2, dims.L / 2];   // half extents x, y, z
  const cs = Math.cos(rot), sn = Math.sin(rot);
  // local -> scene: rotate about y (z forward, x lateral)
  const X = [cs, 0, -sn], Y = [0, 1, 0], Z = [sn, 0, cs];
  const at = (sx, sy, sz) => [
    c[0] + X[0] * e[0] * sx + Z[0] * e[2] * sz,
    c[1] + e[1] * sy,
    c[2] + X[2] * e[0] * sx + Z[2] * e[2] * sz,
  ];
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let i = 0; i <= 4; i++) pts.push(at(sx, sy, -1 + i / 2));   // the long edges
  }
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push(at(0, sy, sz));

  // the station range the solid covers, and the fit of every sample against
  // the sections that bracket it
  let s0 = Infinity, s1 = -Infinity;
  let offTable = 0;
  const samples = pts.map(p => {
    const z = p[2] / FS;
    // z forward -> sL aft, through the measured table when there is a datum;
    // a corner the table cannot place is put far outside the profile, so the
    // fit counts it as run out of the body
    let sL = zFw != null ? sLOfZ(T, z) : sLc - (z - zc);
    if (sL == null) { offTable++; sL = z > zc ? -1e6 : 1e6; }
    else { if (sL < s0) s0 = sL; if (sL > s1) s1 = sL; }
    return [p[0] / FS, p[1] / FS, sL];
  });
  if (!isFinite(s0)) { s0 = sLc; s1 = sLc; }
  const pad = 0.02 / FS;
  const prof = cache ? cache.prof
    : B_.bayProfile(mesh, s0 - pad, s1 + pad, wallU,
                    Math.max(4, Math.ceil((s1 - s0) / (0.08 / FS)) + 2));
  const fit = B_.baySolidFits(prof, samples);

  // inside its BAY: every sample's station within [x0, x1], and its height
  // within the band (the band is where the bay is, the skin is where the body is)
  // the bay's limits are AXIS metres, like the ledger's
  let outBay = 0;
  for (const p of pts) {
    const sm = zFw != null ? (zFw - p[2] / FS) * FS : null;
    const sf = sm != null ? sm : null;
    const s = sf != null ? sf : (sLc - (p[2] / FS - zc)) * FS;
    if (s < bay.x0 - 1e-6 || s > bay.x1 + 1e-6) outBay++;
  }
  const yTop = c[1] + e[1], yBot = c[1] - e[1];
  const bandOK = yBot >= bandLo * FS - 1e-6 && yTop <= bandHi * FS + 1e-6;

  out.c = c; out.e = e; out.rot = rot; out.along = along; out.lv = lv;
  out.sL = [s0 * FS, s1 * FS];
  out.pts = pts; out.samples = samples;
  out.section = { yLo: yLo * FS, yHi: yHi * FS, xLo: xLo * FS, xHi: xHi * FS,
                  band: [bandLo * FS, bandHi * FS] };
  out.clear = fit.worst === Infinity ? null : fit.worst * FS;   // metres
  out.clearAt = fit.at ? [fit.at[0] * FS, fit.at[1] * FS, fit.at[2] * FS] : null;
  out.outsideSkin = fit.outside;
  out.outsideBay = outBay;
  out.inBand = bandOK;
  out.fitsSkin = fit.fits;
  out.ok = fit.fits && outBay === 0 && bandOK;
  if (!fit.fits) out.why.push(fit.outside ? 'runs out of the body' :
    'through the skin by ' + (-fit.worst * FS * 1000).toFixed(0) + ' mm');
  if (outBay) out.why.push(outBay + ' corner' + (outBay > 1 ? 's' : '') + ' past the bay');
  if (!bandOK) out.why.push('outside the bay’s band');
  return out;
}

// ---------------------------------------------------------------------------
// A WING VESSEL, PLACED — one per side, mirrored, half the capacity each.
// ---------------------------------------------------------------------------
// The spar bay is the tank's box: between the front and rear spars in chord,
// the aerofoil's depth there, and as much span as the litres need, running
// OUTBOARD from `along`. `slice(x)` answers {y0, y1, zLE, zTE} at a span
// station in scene metres — the layer measures it off the built wing, the
// gate computes it from the wing's own law (analyticSlice below).
// HOW MUCH SPAN THE LITRES NEED comes from the CORE, not from a guess at the
// aerofoil: `bayLitres` is genWingBay's answer for this bay (both sides,
// usable), and it is spread along the span in proportion to chord squared —
// which is what a similar section at a different scale holds. A tank that
// fills the whole bay then holds exactly what the plaque says the bay holds,
// by construction, and the drawn box cannot disagree with the ledger. The
// measured slice still gives the box its depth and its chord.
function wingPlace(semi, bay, v, installedL, slice, rules, bayLitres) {
  const out = { on: 'wing', ok: false, why: [], sides: [] };
  const R = rules || {};
  const sparF = R.sparFront != null ? R.sparFront : 0.15;
  const sparR = R.sparRear != null ? R.sparRear : 0.65;
  const lo = bay.span ? bay.span[0] : 0.12, hi = bay.span ? bay.span[1] : 0.55;
  const f0 = v.along != null ? Math.max(lo, Math.min(hi, v.along)) : lo;
  const V = Math.max(0, installedL || 0) / 2;           // litres per side
  const xIn = f0 * semi;
  const chordAt = x => { const s = slice(x); return s ? (s.zLE - s.zTE) : 0; };
  // the bay's litres per metre of span, weighted by chord^2 over the bay
  let norm = 0;
  { const M = 40, x0 = lo * semi, x1 = hi * semi, dd = (x1 - x0) / M;
    for (let i = 0; i < M; i++) { const c = chordAt(x0 + dd * (i + 0.5)); norm += c * c * dd; } }
  const perSide = (bayLitres != null ? bayLitres : 0) / 2;
  const density = x => norm > 0 ? perSide * chordAt(x) * chordAt(x) / norm : 0;   // L per m
  // integrate outboard until the litres are met
  const N = 60, dx = (semi * (1 - f0)) / N;
  let x = xIn, acc = 0, xOut = xIn, thin = false, sec0 = null;
  for (let i = 0; i < N && acc < V; i++) {
    const s = slice(x + dx / 2);
    if (!s) break;
    const c = s.zLE - s.zTE, d = (s.y1 - s.y0) * 0.90;
    if (!sec0) sec0 = { c, d, y: (s.y0 + s.y1) / 2, zLE: s.zLE };
    if (d < 0.05) { thin = true; break; }
    const rho = density(x + dx / 2);
    if (!(rho > 0)) { out.why.push('the bay holds nothing here'); break; }
    // the LAST step is a fraction: the box ends where the litres are met
    const need = V - acc, full = rho * dx;
    const k = Math.min(1, need / full);
    acc += full * k; x += dx * k; xOut = x;
  }
  if (!sec0) { out.why.push('no wing section'); return out; }
  const sOut = slice(xOut) || slice(xIn);
  const ymid = (sec0.y + (sOut ? (sOut.y0 + sOut.y1) / 2 : sec0.y)) / 2;
  const cIn = sec0.c, cOut = sOut ? (sOut.zLE - sOut.zTE) : cIn;
  const zLEin = sec0.zLE, zLEout = sOut ? sOut.zLE : zLEin;
  const met = acc >= V - 1e-9;
  const fOut = xOut / Math.max(1e-9, semi);
  const inBay = fOut <= hi + 1e-6;
  for (const sg of [1, -1]) {
    out.sides.push({
      sign: sg,
      x0: sg * xIn, x1: sg * xOut,
      // a tapered box: the four chordwise corners follow the local chord
      zF0: zLEin - sparF * cIn, zR0: zLEin - sparR * cIn,
      zF1: zLEout - sparF * cOut, zR1: zLEout - sparR * cOut,
      y: ymid, d: sec0.d,
    });
  }
  out.along = f0; out.fOut = fOut; out.spanM = xOut - xIn; out.metL = acc * 2;
  out.ok = met && inBay && !thin;
  if (thin) out.why.push('the wing is too thin here');
  if (!met && !thin) out.why.push('runs out of wing');
  if (!inBay) out.why.push('runs past the bay by ' + ((fOut - hi) * semi).toFixed(2) + ' m');
  return out;
}

// the wing's own law, for a headless caller: chord tapers linearly, thickness
// is the NACA figure at 30% chord (near the maximum, where a tank sits)
function analyticSlice(wing, rules) {
  const semi = (wing.span || 0) / 2, root = wing.chord || 1;
  const taper = wing.taper === undefined ? 1 : wing.taper;
  const naca = wing.naca || 2412;
  const tt = (naca % 100) / 100;            // thickness fraction
  const zLE = 0;
  return x => {
    const f = Math.max(0, Math.min(1, x / Math.max(1e-9, semi)));
    const c = root * (1 + (taper - 1) * f);
    const t = tt * c;
    return { y0: -t / 2, y1: t / 2, zLE, zTE: zLE - c };
  };
}

// "AS HIGH AS THE ROOF ALLOWS", or as low as the keel does. The rule puts a
// nose tank at the top of its band, and measured on the stock build the top
// of the band at the tank's CENTRE is half a metre above the cowl deck at its
// FRONT — the roof falls toward the windscreen base. So the level settles:
// from the top down (a nose tank) or the floor up (a cabin tank) until the
// skin clears along the whole box. One dimension, a dozen steps, and the
// crew is not consulted — where the pilot sits is the player's call.
// `accept(pl)`, when given, is the caller's extra say — the layer uses it to
// keep the level clear of the crew as well as the skin, which is still one
// dimension and still the rule ("as high as it goes"), not a search. If no
// level satisfies it, the first SKIN-clear level is returned (settled: true,
// clear: false), so a tank that must sit through the pilot at least sits
// where the rule put it and the readout says who is in the way.
function settleLv(mesh, FS, bay, v, dims, wall, zFw, cache, dir, accept) {
  const lvB = bay.lv || [0, 1];
  const down = dir !== 'up';
  const N = 14;
  let last = down ? lvB[1] : lvB[0], skinOnly = null;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const lv = down ? lvB[1] - (lvB[1] - lvB[0]) * t : lvB[0] + (lvB[1] - lvB[0]) * t;
    const pl = bodyPlace(mesh, FS, bay, { along: v.along, lv, rot: v.rot || 0 }, dims, wall, zFw, cache);
    last = lv;
    if (!(pl.fitsSkin && pl.inBand && pl.outsideBay === 0)) continue;
    if (!accept || accept(pl)) return { lv, settled: true, clear: true, place: pl };
    if (!skinOnly) skinOnly = { lv, settled: true, clear: false, place: pl };
  }
  return skinOnly || { lv: last, settled: false, clear: false, place: null };
}

// A BAY-SHAPED BOX, when the catalogue's shape cannot fit the bay either way
// round. The user's original specification: "geometry will be generated and
// capacity constrained to volume". The box takes the bay's length, most of
// the section's width at its centre, and the height the litres need — capped
// by the bay's band, in which case the litres are what fits (`capped`), and
// the readout says so. The player then edits it like any drawn box.
//   ext   the inner section extents at the centre station (from bayCache)
//   fill  the vessel's shell rounding (SHAPES[key].fill)
function bayFitDims(bay, ext, installedL, fill) {
  const g = 0.02, f = fill || 0.9;
  const len = bay.x1 - bay.x0;
  const L = Math.max(0.08, len - 2 * g);
  const W = Math.max(0.10, 0.80 * (ext.xHi - ext.xLo));
  const lvB = bay.lv || [0, 1];
  const bandH = (ext.yHi - ext.yLo) * (lvB[1] - lvB[0]);
  const Hmax = Math.max(0.06, bandH - 2 * g);
  const V = Math.max(0, installedL || 0) / 1000;
  let H = V / Math.max(1e-9, L * W * f), capped = false;
  if (H > Hmax) { H = Hmax; capped = true; }
  return { L, W, H, capped, litres: L * W * H * f * 1000 };
}

// is a point inside a body vessel's placed box (scene metres)?
function pointInBox(p, place, margin) {
  const m = margin || 0;
  const c = place.c, e = place.e, r = place.rot;
  const cs = Math.cos(r), sn = Math.sin(r);
  const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
  // scene -> local (inverse rotation about y)
  const lx = cs * dx + sn * dz, lz = -sn * dx + cs * dz;
  return Math.abs(lx) <= e[0] + m && Math.abs(dy) <= e[1] + m && Math.abs(lz) <= e[2] + m;
}

const API = { SHAPES, vesselDims, installedFromDims, bayFitDims, bayExtAt, defaultSpot, settleLv, specFromCage,
              firewallZ, bodyPlace, wingPlace, bayCache, analyticSlice, pointInBox,
              sLTable, sLOfZ };
if (typeof window !== 'undefined') window.VESSEL_GEN = API;
if (typeof module !== 'undefined') module.exports = API;
