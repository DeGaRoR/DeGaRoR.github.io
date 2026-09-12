// CAGE ACCESS LAYER (G83) — THE FITTINGS, ON THE LIVE CAGE.
//
// The third piece of GEN_ACCESS and the one you can see. The table
// (60_gen_spec.js) says WHAT this aeroplane needs and what each thing serves;
// _fit_site.js says WHERE each one goes; _fit_gen.js draws the shapes. This
// puts them together and hangs the result on the aeroplane.
//
// Load order: _cage_gen -> _gear_kit -> _gear_gen -> _fit_site -> _fit_gen ->
// _cage_gear -> THIS -> _cage_ui. It CHAINS PAGE.post (the crew layer assigns
// it directly, everything after chains) and appends one group to the panel.
//
// ---------------------------------------------------------------------------
// UNITS, AND THIS IS THE TRAP IN THIS FILE.
//
// The surface field is in CAGE UNITS, not metres — it is built inside
// buildCage2 from the cage's own coordinates, and metres only happen at
// display, where everything is multiplied by FS = CAGE_UNIT x planeScale.
// CAGE_UNIT is 1.0 and planeScale defaults to 1, so the two coincide on the
// stock build and a units error here would be invisible until somebody scaled
// an aeroplane.
//
// GEN_ACCESS is in METRES, because a filler cap is 75 mm on every aeroplane
// ever built. So the target is divided by FS going IN, and the site that comes
// back is multiplied by FS coming OUT. After that everything is metric and the
// group is NOT scaled — exactly what the gear layer does, and for the same
// stated reason: "the hardware is metric and never scales; the crew layer's
// rule, and the reason a wheel can be a ruler".
//
// ---------------------------------------------------------------------------
// THE FRAME COMES FROM THE SITE, NOT FROM THE AIRFRAME CONTRACT, and this is a
// considered departure from the plan this arc was written against.
//
// `fitFrame(AF, z, ang)` was the intended mount and it is a good one — it is
// what the whole undercarriage hangs off. But AF is a 96 x 72 ray-cast TABLE
// and its normal is a finite difference across that grid, while the site's
// normal comes from the actual triangle the fitting lands on. On a flat flank
// they agree; on the turtledeck's curvature and around the boom's taper the
// triangle is simply more accurate, and a filler cap that leans is the most
// obvious way a bolted-on part looks wrong.
//
// The second reason is availability: the gear layer only publishes AF when the
// aeroplane HAS gear (it returns before that), so mounting on AF would mean a
// gearless design silently loses every fitting.
//
// AF is still used where it is genuinely better — the conforming surface for a
// large plate — and the two derivations are still cross-checked against each
// other, in _fit_check.js, which is where a drifting frame convention gets
// caught rather than in the picture.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const CG2 = window.CAGE2, GG = window.GEAR_GEN, K = window.GEAR_KIT;
const SITE = window.FIT_SITE, FG = window.FIT_GEN;
if (!SITE || !FG || !K) {
  console.error('cage access layer: fitting modules not loaded');
  return;
}

// ---- parameters -----------------------------------------------------------
// One switch for the layer and one per FAMILY, because "turn the aerials off"
// is a thing somebody wants and "turn the fuel drain off" is not — a fitting
// is either required or it is absent, and the table already decides that.
const accDef = {
  accOn: 1,
  accFluids: 1, accAccess: 1, accInstr: 1, accAerials: 1, accHandling: 1,
  accDetail: 1,
};
PAGE.defaults = Object.assign(accDef, PAGE.defaults || {});

// THE NUDGES, GENERATED FROM THE DECLARED TABLE (user, 2026-08-31: "There
// should be options for fine tuning the position of accessories").
//
// Nothing about a fitting's placement was adjustable — GEN_ACCESS is 19 rows
// each carrying an `at(R)`, and the panel offered the five family switches and
// one fastener-density slider and nothing else. Two rows per fitting is 38
// rows, which is the honest answer and the one `eng_*` already lives with; the
// alternative designs (a picker plus two sliders, a per-family offset) each
// trade a real capability for a shorter list.
//
// They are GENERATED from GEN_ACCESS's own keys rather than typed out, so a
// row added to the table gets its nudges for free and a row removed cannot
// leave an orphan behind. They are EXPERT-level and grouped by family, so the
// panel is unchanged until somebody goes looking.
//
// THE UNITS ARE THE TABLE'S OWN, which is the whole reason this is cheap:
// `sL` is metres aft of the firewall and `lv` is a RAIL INDEX (0 keel, 2
// waist, 4 ceiling, 5 roof), so `along` is a length and `around` is a rail
// offset. The nudge is added BEFORE `snap` runs, which is what makes a nudge
// on a ring-snapped fitting step ring by ring instead of sliding off its frame.
const accFitKeys = () => {
  const T = (typeof GEN_ACCESS !== 'undefined') ? GEN_ACCESS : window.GEN_ACCESS;
  return T ? Object.keys(T) : [];
};
const ACC_KEYS = accFitKeys();
for (const k of ACC_KEYS) { accDef['acc_' + k + '_sL'] = 0;
                            accDef['acc_' + k + '_lv'] = 0; }

const GROUP = ['9 · fittings', [
  ['accOn', 'access layer', 0, 1, 1, ['off', 'on']],
  ['families', [
    ['accFluids',   'fuel & oil',    0, 1, 1, ['off', 'on']],
    ['accAccess',   'inspection',    0, 1, 1, ['off', 'on']],
    ['accInstr',    'instruments',   0, 1, 1, ['off', 'on']],
    ['accAerials',  'aerials & lights', 0, 1, 1, ['off', 'on']],
    ['accHandling', 'steps & handles',  0, 1, 1, ['off', 'on']],
  ], 'open', { when: P => +P.accOn }],
  ['detail', [
    ['accDetail', 'fastener density', 0.4, 2, 0.05, { when: P => +P.accOn }],
  ], { when: P => +P.accOn }],
], 'open'];
// one subgroup per family, filled after FAMILY is declared (below) so the two
// tables cannot disagree about which fitting belongs where
GROUP[1].push(['fine placement', [], { when: P => +P.accOn, level: 'expert' }]);
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// which family a row belongs to — declared here rather than in the table,
// because it is a fact about the PANEL (what a person wants to switch off
// together), not about the aeroplane
const FAMILY = {
  fuelCap: 'accFluids', fuelCapWing: 'accFluids', fuelDrain: 'accFluids',
  oilDoor: 'accFluids', staticDrain: 'accFluids',
  inspTail: 'accAccess', inspBelly: 'accAccess', inspAileron: 'accAccess',
  baggageDoor: 'accAccess',
  staticPort: 'accInstr', venturi: 'accInstr', oatProbe: 'accInstr',
  commAerial: 'accAerials', navAerial: 'accAerials', xpdrAerial: 'accAerials',
  beacon: 'accAerials',
  step: 'accHandling', grabHandle: 'accHandling', tieDownTail: 'accHandling',
};

// ---- and now the nudge rows, one pair per declared fitting ----------------
// Built here because FAMILY is what decides the grouping and it is declared
// just above; the group itself was pushed with the rest of the panel so its
// position in the tree is not an accident of load order.
{
  const bin = {};
  for (const k of ACC_KEYS) (bin[FAMILY[k] || 'accOn'] || (bin[FAMILY[k] || 'accOn'] = [])).push(k);
  const NAME = { accFluids: 'fuel & oil', accAccess: 'inspection',
                 accInstr: 'instruments', accAerials: 'aerials & lights',
                 accHandling: 'steps & handles', accOn: 'unfamilied' };
  const host = GROUP[1][GROUP[1].length - 1][1];
  const T = (typeof GEN_ACCESS !== 'undefined') ? GEN_ACCESS : window.GEN_ACCESS;
  for (const fam of Object.keys(bin)) {
    const rows = [];
    for (const k of bin[fam]) {
      const label = (T && T[k] && T[k].name) ? T[k].name : k;
      rows.push(['acc_' + k + '_sL', label + ' — along', -1.5, 1.5, 0.01,
                 { dim: 'm' }]);
      rows.push(['acc_' + k + '_lv', label + ' — around', -2, 2, 0.05]);
    }
    host.push([NAME[fam] || fam, rows,
               { when: P => +P.accOn && +(P[fam] === undefined ? 1 : P[fam]) }]);
  }
}

// the fastener pitch each construction actually uses, so a screwed panel on an
// alloy aeroplane carries alloy's own row rather than a chosen number. Read
// off GEN_BUILD_GRAMMAR when the core is present; the benches have no core.
function pitchFor(material) {
  const G = (typeof GEN_BUILD_GRAMMAR !== 'undefined') ? GEN_BUILD_GRAMMAR
          : (window.GEN_BUILD_GRAMMAR || null);
  const row = G && G[material];
  // a panel screw is not a skin rivet: it is a machine screw at 40-60 mm,
  // where a rivet row is at 24. Scaled off the row so the two stay related.
  if (row && row.fastener) return Math.max(0.030, row.fastener.pitch * 2.0);
  return 0.048;
}

// the mounting frame at a site lives in _fit_site.js, so the gate builds the
// same one the aeroplane does — see THE MOUNTING FRAME AT A SITE there.
const frameAt = SITE.frameAt;

// ---------------------------------------------------------------------------
// THE OTHER TWO SURFACES (G84)
// ---------------------------------------------------------------------------
// An aeroplane has three skins and they are three different kinds of thing.
// The fuselage cage is a mesh with a surface field, in CAGE UNITS. The wing is
// a mesh with the SAME FIELD MEANING SOMETHING ELSE, already in metres. The
// cowl is not a mesh at all — it is an analytic surface with a closed form.
// Pretending they were one would have meant giving two of them a coordinate
// they do not have.

// THE WING. Its meshes are built by _cage_wing.js with an `aStruct` attribute
// (its line 293) and added to the scene UNSCALED, so they are already in
// metres — unlike the cage, whose field is in cage units and whose targets
// must be divided by FS. Reading them out of the live group rather than off a
// published handle keeps this working while that layer is being reworked, and
// bakes each mesh's own placement in through `xf`.
function wingField(mount, plane) {
  // G185: the second plane's field is its own group's, named 'wing2'
  const W0 = window.CAGE_WING;
  const W = (plane && W0 && W0.planes && W0.planes[plane]) ? W0.planes[plane] : W0;
  const NAME = plane ? 'wing' + (plane + 1) : 'wing';
  if (!W || !W.group || !SITE.geoMesh) return null;
  const recs = [];
  W.group.updateMatrixWorld(true);
  const inv = mount ? new THREE.Matrix4().copy(mount.matrixWorld).invert()
                    : null;
  const tmp = new THREE.Matrix4(), v = new THREE.Vector3();
  W.group.traverse(o => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (!o.geometry.attributes || !o.geometry.attributes.aStruct) return;
    tmp.copy(o.matrixWorld);
    if (inv) tmp.premultiply(inv);
    recs.push({ geo: o.geometry, name: NAME,
                xf: q => { v.set(q[0], q[1], q[2]).applyMatrix4(tmp);
                           return [v.x, v.y, v.z]; } });
  });
  return recs.length ? SITE.geoMesh(recs) : null;
}

// THE COWL, evaluated rather than searched. `surfPoint(th, z)` is the shell's
// own closed form (_cowl_gen.js:311) and the cowl's origin is its firewall, so
// the whole placement is two evaluations and the group's offset. th is the
// section angle: 0 the starboard flank, pi/2 the crown, pi the port flank.
//
// The normal comes from two finite differences ON THE SURFACE ITSELF rather
// than from a mesh, which is the one case in this arc where the analytic
// answer is strictly better than the triangles.
function cowlSite(row, P) {
  const CW = window.COWL_GEN, CC = window.CAGE_COWL;
  if (!CW || !CC || !CC.face || !CW.surfPoint || !CW.zEnd) return null;
  const zEnd = CW.zEnd();
  if (!(zEnd > 1e-4)) return null;
  // ON A COWL the table speaks {frac, az} instead of {sL, lv} — a fraction
  // along the cowl and a section angle — so the same two nudges mean the same
  // two things in the units this surface uses: `along` shifts the fraction,
  // `around` the angle. 0.20 m and 20 deg per unit keeps the row's own range
  // sensible against a cowl that is under half a metre long.
  const dF = (+P['acc_' + row.key + '_sL'] || 0) / Math.max(0.05, zEnd);
  const dA = (+P['acc_' + row.key + '_lv'] || 0) * 20;
  const th = ((row.at.az == null ? 122 : row.at.az) + dA) * Math.PI / 180;
  const z = zEnd * Math.min(0.96, Math.max(0.04,
    (row.at.frac == null ? 0.45 : row.at.frac) + dF));
  const at3 = (t, zz) => {
    const q = CW.surfPoint(t, zz);
    return q && isFinite(q[0]) ? [q[0], q[1], zz] : null;
  };
  const c = at3(th, z);
  if (!c) return null;
  const dT = 0.06, dZ = Math.max(0.004, zEnd * 0.02);
  const a = at3(th + dT, z), b = at3(th, z + dZ);
  if (!a || !b) return null;
  const u = [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
  const w = [b[0] - c[0], b[1] - c[1], b[2] - c[2]];
  let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2],
           u[0] * w[1] - u[1] * w[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  n = [n[0] / l, n[1] / l, n[2] / l];
  // OUTWARD is away from the section's own centre, the same test the fuselage
  // uses — the cross product's sign depends on which way th and z were walked
  // and is not worth reasoning about.
  const s0 = CW.sectionAtZ ? CW.sectionAtZ(z) : null;
  const cy = s0 && isFinite(s0.cy) ? s0.cy : 0;
  if (n[0] * c[0] + n[1] * (c[1] - cy) < 0) n = [-n[0], -n[1], -n[2]];
  // the group's own offset: the cowl's origin is its firewall, and the layer
  // moves it onto the nose aperture (_cage_cowl.js:488)
  const off = [0, CC.face.yc, CC.face.z + (P.cowlGap || 0)];
  return { p: [c[0] + off[0], c[1] + off[1], c[2] + off[2]], n,
           sL: 0, sC: 0, st: 0, lv: 0, mat: 'cowl',
           side: c[0] < 0 ? 'port' : 'star' };
}

// THE ROD (G189, the user: "the fittings should be adapted to rod boom"). A
// bare tube from the aft bulkhead to the tail: nothing is let INTO it — what
// lives on it is CLAMPED to it, a split collar round the tube with the row's
// own form on top (a tie-down ring under, an aerial or the beacon on the
// crown). The rod is read off the cage's own resolve (rodSpan, cage units),
// the station off the row in the table's tape metres from the requirement
// record's `rod.from` (the bulkhead) — the same tape tailArm is measured in.
// The collar goes straight into the metal bag here: it is the SITE's own
// hardware, not the form's, the way the cowl's placement is the cowl's.
function rodSite(row, P, needs, atSL, atLV, bags) {
  if (!CG2 || !CG2.cageSpec || !CG2.cageResolve || !needs || !needs.rod) return null;
  let S, R;
  try { S = CG2.cageSpec(Object.assign({}, P)); R = CG2.cageResolve(S); }
  catch (e) { return null; }
  if (!S.rod || S.rod.twin || !R || !R.rodSpan) return null;
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const sp = R.rodSpan, r = S.rod.r, y0 = S.rod.y;
  // the station: tape metres past the bulkhead, along the tube (z runs fwd)
  const zRaw = sp.zRoot - (atSL - needs.rod.from) / FS;
  const z = Math.max(sp.zTip + 0.06 / FS, Math.min(sp.zRoot - 0.06 / FS, zRaw));
  const under = atLV === 'keel';
  const sgn = under ? -1 : 1;
  const p = [0, (y0 + sgn * r) * FS, z * FS];
  const n = [0, sgn, 0];
  if (bags && bags.metal && K && K.revolve) {
    const rm = r * FS, ctr = [0, y0 * FS, z * FS];
    // the split collar: a 24 mm wide band, 4 mm proud, and its two clamp
    // lugs standing off the flanks where the bolts go through
    K.revolve(bags.metal, [ctr[0], ctr[1], ctr[2] - 0.012], [0, 0, 1],
      [[rm + 0.0008, 0], [rm + 0.0045, 0.0015], [rm + 0.0045, 0.0225],
       [rm + 0.0008, 0.024]], 20, true);
    for (const s of [-1, 1])
      K.revolve(bags.metal, [s * (rm + 0.0030), ctr[1], ctr[2]], [s, 0, 0],
        [[0.0060, 0], [0.0060, 0.0090], [0.0035, 0.0110]], 10, true);
  }
  return { p, n, sL: atSL, sC: 0, st: 0, lv: 0, mat: 'boomTube', side: 'centre' };
}

// THE TWIN BOOMS (G278, the user: "I'd still like for the accessories to
// also get onto the booms (inspection traps, possible lights, etc.)"). The
// wing layer publishes the drawn tubes (CAGE_BOOMS, scene metres: the track,
// the root and tip stations, the axis line and the half-sizes along it), and
// a row on them names a station in metres from the ROOT and a place round
// the tube — crown, keel or the outboard flank. 'both' is one fitting a
// boom, 'star' / 'port' the one side. A rod-style twin boom takes the rod's
// split collar; a lofted one is a skin and the form sits on it.
function boomSites(row, P, needs, atSL, atLV, bags, want) {
  const TB = (typeof window !== 'undefined') && window.CAGE_BOOMS;
  if (!TB || !needs || !needs.booms) return [];
  const from = needs.booms.from || 0;
  const zRaw = TB.zRoot - (atSL - from);
  const z = Math.max(TB.zTip + 0.06, Math.min(TB.zRoot - 0.06, zRaw));
  const yA = TB.yAx(z), h = TB.hAt(z), r = TB.rAt(z);
  const sides = want === 'both' ? [1, -1] : want === 'port' ? [-1] : [1];
  const out = [];
  for (const s of sides) {
    let p, n;
    if (atLV === 'keel') { p = [s * TB.x, yA - h, z]; n = [0, -1, 0]; }
    else if (atLV === 'flank') { p = [s * (TB.x + r), yA, z]; n = [s, 0, 0]; }
    else { p = [s * TB.x, yA + h, z]; n = [0, 1, 0]; }
    if (!TB.lofted && bags && bags.metal && K && K.revolve) {
      const ctr = [s * TB.x, yA, z];
      K.revolve(bags.metal, [ctr[0], ctr[1], ctr[2] - 0.012], [0, 0, 1],
        [[r + 0.0008, 0], [r + 0.0045, 0.0015], [r + 0.0045, 0.0225],
         [r + 0.0008, 0.024]], 20, true);
      for (const q of [-1, 1])
        K.revolve(bags.metal, [ctr[0] + q * (r + 0.0030), ctr[1], ctr[2]], [q, 0, 0],
          [[0.0060, 0], [0.0060, 0.0090], [0.0035, 0.0110]], 10, true);
    }
    out.push({ p, n, sL: atSL, sC: 0, st: 0, lv: 0, mat: TB.lofted ? 'boomSkin' : 'boomTube',
               side: s > 0 ? 'star' : 'port' });
  }
  return out;
}

// ---- build ----------------------------------------------------------------
let group = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};

// the fallback palette, for the standalone benches and for the editor's
// material view switched off — the aeroHardMat contract's own three cases
const lam = (c, o) => new THREE.MeshLambertMaterial(
  Object.assign({ color: c }, o || {}));
let FALLBACK = null;
const fallbackMats = () => (FALLBACK || (FALLBACK = {
  paint: lam(0xc8ccd2), metal: lam(0xb9c2cc), lens: lam(0xd14b3a),
}));
const TINT = { paint: 0xc8ccd2, metal: 0xb9c2cc, lens: 0xd14b3a };

function matFor(name) {
  // the PAINT bag is the builder's (phase C): one livery section for the
  // whole fitting set — trim by default, borrowing the fuselage's colour —
  // which keeps the three-not-fifteen draw-call economy intact while giving
  // the group the one tunable material the user asked of it. metal and lens
  // stay hardware (the lens is the emitter; it must never dim).
  if (name === 'paint' && window.CAGE_SECMAT) {
    const ms = window.CAGE_SECMAT('accPaint',
      { surf: 0, fieldM: 1, tint0: TINT.paint });
    if (ms) return ms;
  }
  const A = window.AEROSKIN;
  if (A && A.aeroHardMat) {
    const m = A.aeroHardMat(THREE, 'access', name, TINT[name], {});
    if (m) return m;
  }
  return fallbackMats()[name];
}

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  if (!Math.round(P.accOn === undefined ? 1 : P.accOn)) return;
  if (!mesh || !mesh.A) return;

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);

  // THE FACTS THE CAGE HAS NO KNOB FOR — the tank, the instrument fit, the
  // covering — live in the game spec and reach the editor through
  // GARAGE_SPEC. Absent (a bench page) means the front door's own defaults,
  // which it counts, so a fitting never appears because nobody measured.
  let extra = {};
  try {
    const GS = window.GARAGE_SPEC && window.GARAGE_SPEC.get
      ? window.GARAGE_SPEC.get() : null;
    if (GS) extra = {
      tank: GS.fuel && GS.fuel.litres > 0 ? (GS.fuel.tank || 'nose') : null,
      fuelL: (GS.fuel && GS.fuel.litres),
      systems: GS.systems && GS.systems.fit,
      // the panel arc, session 2: the radios the fit carries (the aerials'
      // `need`s read these); resolved by the core's one reader
      avionics: (typeof genSystemsResolve === 'function')
        ? (r => ({ com: r.avionics.com !== 'none', nav: r.avionics.nav !== 'none',
                   xpdr: r.avionics.xpdr !== 'none' }))(genSystemsResolve(GS))
        : undefined,
      material: GS.fuselage && GS.fuselage.material,
      cargo: GS.cargo && GS.cargo.len,
    };
  } catch (e) {}

  // THE SILL ABOVE THE GROUND LINE, measured rather than assumed — it is what
  // decides whether this aeroplane needs a step at all.
  //
  // TWO THINGS HAD TO BE RIGHT AND THE FIRST CUT HAD NEITHER. The gear layer
  // reports `gy` in its own PITCHED frame (it tilts the ground rather than the
  // aeroplane, so the editor's fuselage stays where you put it), so the keel
  // has to be rotated into that frame before the two can be subtracted — on a
  // 9.6 degree deck angle the raw difference is not a height at all. And it is
  // the keel AT THE CABIN that matters, not the lowest point anywhere: the
  // global minimum is under the nose or the tail depending on the design, and
  // neither is the doorway somebody climbs through.
  try {
    const GB = window.CAGE_GEAR;
    if (GB && isFinite(GB.gy)) {
      const cs = Math.cos(GB.pitch || 0), sn = Math.sin(GB.pitch || 0);
      // the cabin's own station, in the field's metres aft of the firewall
      const sLc = ((P.pilotLen || 1.6) * 0.5) / FS;
      let keel = Infinity;
      for (let i = 0; i < mesh.V.length; i++) {
        const a = mesh.A[i];
        if (!a || a[0] < sLc - 0.5 || a[0] > sLc + 0.5) continue;
        const y = mesh.V[i][1] * FS, z = mesh.V[i][2] * FS;
        const yg = y * cs - z * sn;              // into the ground's frame
        if (yg < keel) keel = yg;
      }
      if (isFinite(keel)) extra.sillH = keel - GB.gy;
    }
  } catch (e) {}

  const needs = (typeof genAccessNeedsCage !== 'undefined')
    ? genAccessNeedsCage : window.genAccessNeedsCage;
  const list = (typeof genAccessList !== 'undefined')
    ? genAccessList : window.genAccessList;
  if (!needs || !list) {
    if (stat) stat.textContent += '  ·  fittings: no GEN_ACCESS';
    return;
  }
  const R = needs(P, extra);
  const rows = list(R);

  // AF is used only for the conforming surface under a large plate, so it is
  // optional by construction: no gear, no AF, and the plates lie on their own
  // tangent plane instead — which for anything under ~200 mm is the same
  // picture.
  let AF = null;
  try {
    const GB = window.CAGE_GEAR;
    AF = (GB && GB.AF) || (GG && GG.cageAirframe ? GG.cageAirframe(mesh, FS) : null);
  } catch (e) { AF = null; }

  const bags = { paint: K.Bag(), metal: K.Bag(), lens: K.Bag() };
  const pitch = pitchFor(R.material) / Math.max(0.4, +P.accDetail || 1);
  const placed = [], unplaced = [];
  let nFit = 0;

  // the wing's field, read once per build rather than once per fitting
  let wingF = null, wingTried = false;
  let wingF2 = null, wing2Tried = false;      // G185: the second plane's field

  for (const row of rows) {
    const fam = FAMILY[row.key];
    if (fam && !Math.round(P[fam] === undefined ? 1 : P[fam])) continue;
    // a surface with no placer is REPORTED, never dropped in silence — an
    // aeroplane quietly missing its wing filler cap is the acceptance test
    // failing quietly, and quietly is how this gap survived two chantiers
    if (!FG.FIT_SURFACES[row.on]) { unplaced.push(row); continue; }
    const form = FG.FORMS[row.form];
    if (!form) { unplaced.push(row); continue; }

    // ONLY THE CAGE IS IN CAGE UNITS. Its field and its vertices both scale by
    // FS; the wing's are already metres and the cowl is evaluated straight
    // into them. So the conversion is per SURFACE, and a single shared FS
    // would put every wing fitting on an aeroplane of the wrong size — which
    // on the default build, where planeScale is 1, looks exactly correct.
    const K2 = row.on === 'body' ? FS : 1;
    // THE USER'S OWN OFFSET, in the table's own units and applied BEFORE the
    // snap — so a nudge on a `ring`-snapped fitting steps ring by ring and a
    // nudge on a `rail`-snapped one steps rail by rail, instead of sliding it
    // off the structure the snap exists to put it on. Absent rows read 0.
    const dSL = +P['acc_' + row.key + '_sL'] || 0;
    const dLV = +P['acc_' + row.key + '_lv'] || 0;
    const atSL = row.at.sL + dSL;
    const atLV = (typeof row.at.lv === 'number') ? row.at.lv + dLV : row.at.lv;
    let sites;
    if (row.on === 'cowl') {
      const one = cowlSite(row, P);
      sites = one ? [one] : [];
    } else if (row.on === 'rod') {
      const one = rodSite(row, P, R, atSL, atLV, bags);
      sites = one ? [one] : [];
    } else if (row.on === 'boom') {
      const want = typeof row.side === 'function' ? row.side(R) : row.side;
      sites = boomSites(row, P, R, atSL, atLV, bags, want || 'both');
    } else if (row.on === 'wing') {
      if (!wingTried) { wingTried = true; wingF = wingField(scene); }
      sites = wingF ? SITE.accessSites(wingF, {
        sL: atSL, lv: atLV, sC: row.at.sC,
        snap: row.snap, side: row.side, allow: ['wing'],
      }) : [];
    } else if (row.on === 'wing2') {
      // G185: the second plane's fittings land on the second plane's field
      if (!wing2Tried) { wing2Tried = true; wingF2 = wingField(scene, 1); }
      sites = wingF2 ? SITE.accessSites(wingF2, {
        sL: atSL, lv: atLV, sC: row.at.sC,
        snap: row.snap, side: row.side, allow: ['wing2'],
      }) : [];
    } else {
      // `lv` is a RAIL INDEX and is not a length, so it is not scaled; sL is
      // metres and is. See UNITS at the top of this file.
      sites = SITE.accessSites(mesh, {
        sL: atSL / K2,
        lv: atLV,
        sC: row.at.sC != null ? row.at.sC / K2 : undefined,
        snap: row.snap, side: row.side,
      });
    }
    // G278: A CROWN FITTING LOOKS FOR THE TOP OF THE AEROPLANE (the user:
    // "these things should always look for the top of the airplane, by
    // default the cabin or passenger pillars, which are always there"). Its
    // own station had nothing to bolt to — a twin-boom pod's deck ends at
    // the bulkhead — so it takes the nearest crown RING aft of the
    // windscreen that is real skin and not already under another crown
    // fitting, the ask's own side of the cabin when there is one.
    // ...and NOT UNDER THE WING: on a high wing the roof between the root's
    // leading and trailing edges is inside the centre section, and an
    // aerial there is an aerial nobody can see (measured: the comm aerial
    // 0.38 m ahead of the trailing edge, under the carry-through)
    // (the wing's edges are read in the cage's own frame, as CAGE_BOOMS reads
    // them; a high or parasol wing is the one whose root sits over the roof)
    const blockedSet = r => { const b = new Set(SITE.NOT_SKIN); for (const m of (r.allow || [])) b.delete(m); return b; };
    const WG = (typeof window !== 'undefined') && window.CAGE_WING;
    const wingHigh = [0, 3].includes(Math.round(+P.wgPos || 0));
    // ...AND NOT INSIDE THE FIN (G297, the user: "a very longstanding issue
    // of the beacon not taking the dorsal fin into account ... positioned
    // inside it, major clipping"). The fin is a LAYER mesh the body placer
    // cannot see, and its dorsal runs forward along the spine over the very
    // stations the crown rows ask for. The centreline fin group's fore-aft
    // extent, in the cage's own frame, is a band no crown fitting may stand
    // in; a fin on a boom (off the centreline) blocks nothing.
    const finBand = (() => {
      if (!scene || !scene.children) return null;
      scene.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
      const v = new THREE.Vector3();
      let z0 = Infinity, z1 = -Infinity;
      for (const ch of scene.children) {
        if ((ch.name || '').indexOf('cageLayer:fin') !== 0) continue;
        if (Math.abs(ch.position.x) > 0.2) continue;              // a boom's fin
        ch.traverse(o => {
          if (!o.isMesh || !o.geometry) return;
          const pos = o.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
            if (Math.abs(v.x) > 0.25) continue;
            if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z;
          }
        });
      }
      return isFinite(z0) && z1 > z0 ? { z0, z1 } : null;
    })();
    const shadowed = pm => {
      if (!wingHigh || !WG || !WG.leAt || !WG.teAt) return false;
      const le = WG.leAt(0), te = WG.teAt(0);
      if (!le || !te) return false;
      return pm[2] > te.z && pm[2] < le.z;
    };
    if (row.on === 'body' && atLV === 'crown')
      sites = sites.filter(s => !shadowed([s.p[0] * K2, s.p[1] * K2, s.p[2] * K2]));
    if (!sites.length && row.on === 'body' && atLV === 'crown' && SITE.crownRings) {
      const rings = SITE.crownRings(mesh, 1)
        .filter(h => h.sL * K2 > 0.05)
        .filter(h => !shadowed([h.p[0] * K2, h.p[1] * K2, h.p[2] * K2]))
        .filter(h => !placed.some(q => q.on === 'body' && q.n && q.n[1] > 0.7 &&
                                       Math.abs(q.p[2] - h.p[2] * K2) < 0.25));
      if (rings.length) {
        const ask = atSL / K2;
        let best = rings[0];
        for (const h of rings) if (Math.abs(h.sL - ask) < Math.abs(best.sL - ask)) best = h;
        sites = [Object.assign({}, best, { side: 'centre' })];
      }
      // ...and when every ring is spoken for or in a shadow — the stock
      // build: the cabin under the wing, the dorsal from the cabin's aft
      // pillar to the post — the crown JUST AHEAD OF THE FIN, stepping
      // forward a hand at a time past a fitting already there
      if (!sites.length && finBand && SITE.crownAtZ) {
        for (let k = 0; k < 4 && !sites.length; k++) {
          const zM = finBand.z1 + 0.10 + 0.30 * k;
          const h = SITE.crownAtZ(mesh, zM / K2, 1);
          if (!h || blockedSet(row).has(h.mat) || h.n[1] < 0.3) continue;
          const pm = [h.p[0] * K2, h.p[1] * K2, h.p[2] * K2];
          if (shadowed(pm)) continue;
          if (placed.some(q => q.on === 'body' && q.n && q.n[1] > 0.7 && Math.abs(q.p[2] - pm[2]) < 0.25)) continue;
          sites = [Object.assign({}, h, { side: 'centre' })];
        }
      }
    }
    if (!sites.length) { unplaced.push(row); continue; }

    for (const s of sites) {
      const pm = [s.p[0] * K2, s.p[1] * K2, s.p[2] * K2];
      // G278: AN AERIAL STANDS VERTICAL (the user: "not even pointing straight
      // up"). A blade or a mast on a sloping deck follows the horizon, not
      // the skin — the base sits on the skin, the fitting points up (or down
      // under the keel); every other form keeps the surface's own normal.
      const upright = (atLV === 'crown' || atLV === 'keel') && /Aerial|Beacon/.test(String(row.form));
      const F = frameAt(pm, upright ? [0, atLV === 'keel' ? -1 : 1, 0] : s.n);
      // the conforming surface: ask the contract where the skin is a little
      // way off in each direction, so a big plate follows the section instead
      // of standing off at its corners
      let surf = null;
      // the airframe contract describes the FUSELAGE and nothing else, so a
      // wing or cowl plate lies on its own tangent plane instead
      if (row.on === 'body' && AF && AF.surf && AF.nrmAt) {
        const base = SITE.siteToAF(AF, { p: pm });
        surf = (u, v) => {
          const dz = -v;                       // fore is aft, and z runs fwd
          const r = Math.max(0.05, AF.halfWAt(base.z + dz));
          const q = AF.surf(base.z + dz, base.ang + u / r);
          return (q && isFinite(q[0])) ? q : FG.at(F, u, v, 0);
        };
        surf.n = (u, v) => {
          const dz = -v;
          const r = Math.max(0.05, AF.halfWAt(base.z + dz));
          const q = AF.nrmAt(base.z + dz, base.ang + u / r);
          return (q && isFinite(q[0])) ? q : F.n;
        };
      }
      // GATE CLIP reads each fitting's own triangles back out of the
      // merged bags, so the range every form wrote is recorded with the site
      const t0 = {}; for (const k of FG.FIT_BAGS) t0[k] = bags[k].tris;
      try { form(bags, F, row.size || {}, { surf, pitch }); }
      catch (e) { unplaced.push(row); continue; }
      nFit++;
      const tris = {}; for (const k of FG.FIT_BAGS) tris[k] = [t0[k], bags[k].tris];
      // THE NORMAL RIDES ALONG in the record. It is what a diagnostic has to
      // look down to see whether a fitting is there at all — the first pixel
      // pass without it fell back to "up" for everything and reported seven
      // perfectly good fittings as invisible.
      placed.push({ key: row.key, name: row.name, serves: row.serves,
                    on: row.on, side: s.side, p: pm, n: F.n,
                    st: s.st, lv: s.lv, mat: s.mat, tris });
    }
  }

  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a part
  // lives in, and G79's raycast resolves a hit to a part through that.
  group.name = 'cageLayer:access';
  // NOT SCALED. The fittings were built in metres; scaling here would apply
  // planeScale twice and grow a 75 mm filler cap with the aeroplane.
  for (const k of FG.FIT_BAGS) {
    const m = bags[k].mesh(group, matFor(k));
    if (m) m.userData.fitBag = k;              // which bag: GATE CLIP's key
  }
  scene.add(group);

  const tris = FG.FIT_BAGS.reduce((s, k) => s + bags[k].tris, 0);
  window.CAGE_ACCESS = { needs: R, rows, placed, unplaced, tris };
  if (stat)
    stat.textContent += '  ·  fittings: ' + nFit + ' (' + tris + ' t)' +
      (unplaced.length ? ' · ' + unplaced.length + ' unplaced' : '');
};
})();
