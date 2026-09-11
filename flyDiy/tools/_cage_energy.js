// CAGE ENERGY LAYER (G99) — THE TANKS AND THE PACKS, DRAWN, MOVED, AND READ.
//
// The user's own specification for this arc, verbatim: "a few predetermined
// places where tanks can go. First select liquid fuel or batteries. Liquid
// fuel can go in the typical places, including the wings. Geometry will be
// generated and capacity constrained to volume. Within the predetermined,
// typical locations, the tanks can be moved and rotated to fit. They impact
// the CG dynamically in flight and we can simulate the CG with full or empty
// tank at conception."
//
// The core half of that landed first (60c_gen_energy.js, 61_gen_frame.js):
// bays derived from the aeroplane, vessels as the capacity, mass billed where
// the vessel sits, burn draining it. This is the half you can SEE and TOUCH.
// It draws every vessel as a solid in its bay, offers the rows that move it,
// tests the fit against the skin and the crew, and hands the result back to
// the spec — which is the only owner of where a tank is.
//
// ONE PLACEMENT, TWO READERS. `_vessel_gen.js` decides where a solid is and
// whether it fits; this file draws what it returns and GATE ENERGY runs the
// same function headless. The picture and the gate cannot disagree.
//
// THE SPEC OWNS THE LIST, the same way it owns the registration (G160). The
// panel's rows are a VIEW of `spec.energy.vessels`: a drag moves the drawn
// solid and the readouts live, and the release commits through
// `GARAGE_SPEC.update`, which is what puts the aeroplane back on the stand
// with its tank where you left it. The join carries `energy` on every commit
// beside `finish` (the `_cage_join.js` seam), so a save cannot lose a tank.
// On the bench, which has no spec, the list lives in this file and survives
// a reload through localStorage — the same arrangement the decal panel has.
//
// Load after _cage_crew (the clearance), _cage_wing (the wing bays' loft),
// _bay_site and _vessel_gen, and before _cage_join and _cage_ui. Chains
// PAGE.post. Nothing here touches THREE, the DOM or storage at load time:
// GATE PARTS loads every layer under a stub with none of them.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const HAS_DOM = typeof document !== 'undefined';
const inGame = () => !!window.CAGE_IN_GAME;
const VG = () => window.VESSEL_GEN;
const BAY = () => window.BAY_SITE;
const CG2 = () => window.CAGE2;

// ---------------------------------------------------------------------------
// THE STATE — a view of spec.energy
// ---------------------------------------------------------------------------
// `finish`, `hue` and `tint` are the LOOK of the vessels, section-wide beside
// `vessel`: what the shell is made of, how far the painted set's hue is turned
// and what tints it. They weigh nothing and the ledger never reads them — the
// vessel's mass and price come from GEN_VESSELS, which this does not touch.
const EN = { kind: 'fuel', fuel: 'avgas100LL', cell: 'lifepo4', vessel: null,
             finish: null, hue: 0, tint: null, vessels: [] };
let seeded = false;
const cl = o => JSON.parse(JSON.stringify(o));

// what an aeroplane with nothing written carries: the core's own default,
// the Cub's twelve gallons behind the firewall
const defaultVessels = () => [{ bay: 'nose', capacity: 45, along: null,
                                lv: null, rot: 0, form: 'box', dims: null }];

function fromSpec(energy) {
  const E = energy || {};
  EN.kind = E.kind === 'battery' ? 'battery' : 'fuel';
  EN.fuel = E.fuel || 'avgas100LL';
  EN.cell = E.cell || 'lifepo4';
  EN.vessel = E.vessel || null;
  EN.finish = E.finish || null;
  EN.hue = +E.hue || 0;
  EN.tint = E.tint || null;
  EN.vessels = Array.isArray(E.vessels) && E.vessels.length
    ? E.vessels.map(v => ({ bay: v.bay || 'nose', capacity: +v.capacity || 0,
        along: v.along == null ? null : +v.along,
        lv: v.lv == null ? null : +v.lv, rot: +v.rot || 0,
        // a round tank or a squared one — geometry, and the capacity follows
        form: v.form === 'cyl' ? 'cyl' : 'box',
        // the player's own box, when they drew one
        dims: (v.dims && v.dims.L > 0) ? { L: +v.dims.L, W: +v.dims.W, H: +v.dims.H } : null,
        // ...AND ITS OWN LOOK (2026-09-05). null at any of the three means
        // the section's answer, which is what a build written before this
        // says about every tank it carries.
        finish: FINISH[v.finish] ? v.finish : null,
        hue: v.hue == null ? null : +v.hue || 0,
        tint: v.tint || null }))
    : defaultVessels();
  seeded = true;
  savePrefs();
  if (panelBody) renderPanel();
  // ...and the look rows, which in the game live in the finish view and are
  // not inside the panel this rebuilds
  if (lookBody) renderLook();
}
// the spec's shape and nothing else: capacity and kWh are READINGS the core
// derives from this list, so they are not written back
function toSpec() {
  return { kind: EN.kind, fuel: EN.fuel, cell: EN.cell, vessel: EN.vessel,
           finish: EN.finish, hue: EN.hue, tint: EN.tint,
           vessels: EN.vessels.map(v => ({ bay: v.bay, capacity: v.capacity,
             along: v.along, lv: v.lv, rot: v.rot, form: v.form || 'box',
             dims: v.dims ? { L: v.dims.L, W: v.dims.W, H: v.dims.H } : null,
             finish: v.finish || null,
             hue: v.hue == null ? null : v.hue,
             tint: v.tint || null })) };
}

// the bench remembers; the game's memory is the spec
const LSKEY = () => 'cageEnergy:' + (typeof location !== 'undefined' ? location.pathname : '');
function loadPrefs() {
  if (inGame() || typeof localStorage === 'undefined') return false;
  try {
    const j = JSON.parse(localStorage.getItem(LSKEY()) || 'null');
    if (j && Array.isArray(j.vessels)) { fromSpec(j); return true; }
  } catch (e) {}
  return false;
}
function savePrefs() {
  if (inGame() || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(LSKEY(), JSON.stringify(toSpec())); } catch (e) {}
}

// ---------------------------------------------------------------------------
// THE CORE, reached by name — the same tables the ledger bills from
// ---------------------------------------------------------------------------
const core = () => ({
  BAYS: typeof GEN_BAYS !== 'undefined' ? GEN_BAYS : null,
  bayResolve: typeof genBayResolve === 'function' ? genBayResolve : null,
  vesselResolve: typeof genVesselResolve === 'function' ? genVesselResolve : null,
  VESSELS: typeof GEN_VESSELS !== 'undefined' ? GEN_VESSELS : null,
  FUELS: typeof GEN_FUELS !== 'undefined' ? GEN_FUELS : null,
  CELLS: typeof GEN_CELLS !== 'undefined' ? GEN_CELLS : null,
  RULES: typeof GEN_RULES !== 'undefined' ? GEN_RULES : null,
  DEFAULT: typeof GEN_DEFAULT !== 'undefined' ? GEN_DEFAULT : null,
});
const vesselKey = () => EN.vessel || (EN.kind === 'battery' ? 'packCase' : 'alu');
// A ROUND TANK IN A SQUARE BOX HOLDS LESS, and the ledger has to know. `form`
// rides into the two capacity functions in _vessel_gen.js, which apply the
// catalogue's own fill and then the form's — the box case is 1.0, so every
// build that existed before this row weighs exactly what it weighed.
const formOf = v => (v && v.form === 'cyl' ? 'cyl' : 'box');
// installed litres of a drawn box -> the capacity unit the spec stores
function capacityFromDims(dims, form) {
  const G = VG(), C = core();
  if (!G || !G.installedFromDims) return 0;
  const inst = G.installedFromDims(vesselKey(), dims, form);
  if (EN.kind === 'battery') {
    const cell = (C.CELLS || {})[EN.cell] || { WhL: 250, packK: 0.7 };
    return Math.max(0, Math.round((inst / 1.18) * (cell.WhL * cell.packK) / 1000 * 10) / 10);
  }
  return Math.max(0, Math.round(inst / 1.06));
}
const medium = () => (EN.kind === 'battery' ? EN.cell : EN.fuel);
const unit = () => (EN.kind === 'battery' ? 'kWh' : 'L');

// THE RESOLVED SPEC the bay rule reads. The game has one; the bench
// reconstructs the four numbers the join measures, off the same rings.
function resolvedSpec(ctx) {
  if (inGame() && window.GARAGE_SPEC && window.GARAGE_SPEC.resolved) {
    try { const S = window.GARAGE_SPEC.resolved(); if (S && S.cab) return S; }
    catch (e) {}
  }
  const W = window.CAGE_WING;
  const wing = W && W.def && W.def.spec &&
    (W.def.spec.wing || (W.def.spec.wings || [])[0]) || null;
  const C = core();
  const fd = { cargoLen: C.DEFAULT && C.DEFAULT.cargo ? C.DEFAULT.cargo.len : 0.4 };
  return VG() ? VG().specFromCage(ctx.spec, CG2(), wing, fd) : null;
}

// THE BAYS OF THIS BUILD: station ranges from the core's rule, litres from the
// field — the finer instrument, and the one that is looking at the real skin
let BAYS = [];
function measureBays(S, ctx) {
  const C = core();
  const out = [];
  if (!C.BAYS || !C.bayResolve || !S) return out;
  const FS = fsOf(ctx);
  for (const k in C.BAYS) {
    const B = C.BAYS[k];
    if (B.on === 'wing' && !(S.wing && window.CAGE_WING)) continue;
    // G185: a bay on the second plane needs the second plane DRAWN
    if (B.on === 'wing' && B.plane && !(window.CAGE_WING.planes &&
                                        window.CAGE_WING.planes[B.plane])) continue;
    let r = null;
    try { r = C.bayResolve(S, k, null); } catch (e) { r = null; }
    if (!r) continue;
    if (r.on === 'body' && ctx.mesh && BAY()) {
      const zFw = VG() && VG().firewallZ ? VG().firewallZ(ctx.spec, CG2()) : null;
      const key = bayKey(r, zFw);
      if (key in FIELD_L) { r.litresField = FIELD_L[key]; }
      else try {
        // the bay's limits are axis metres; the profile is indexed by the
        // field's sL, so they go through the same table the placement uses
        let s0 = r.x0 / FS, s1 = r.x1 / FS;
        if (zFw != null && VG().sLTable) {
          const T = VG().sLTable(ctx.mesh, FS, s0 - 0.35 / FS, s1 + 0.1 / FS, 18);
          const a = VG().sLOfZ(T, zFw - s0), b2 = VG().sLOfZ(T, zFw - s1);
          if (a != null && b2 != null) { s0 = Math.min(a, b2); s1 = Math.max(a, b2); }
        }
        const prof = BAY().bayProfile(ctx.mesh, s0, s1, 0.035 / FS, 12);
        const lv = r.lv || [0, 1];
        r.litresField = BAY().bayVolume(prof) * (lv[1] - lv[0]) * FS * FS * FS * 1000;
      } catch (e) { r.litresField = null; }
      if (!(key in FIELD_L)) FIELD_L[key] = r.litresField;
    }
    r.roomL = r.litresField != null ? r.litresField : r.litres;
    out.push(r);
  }
  return out;
}
const fsOf = ctx => ((CG2() && CG2().CAGE_UNIT) || 1) * ((ctx && ctx.P && ctx.P.planeScale) || 1);

// ---------------------------------------------------------------------------
// PLACEMENT — every vessel, through the one keeper
// ---------------------------------------------------------------------------
let LAST = { ctx: null, results: [], inv: null, group: null };
let BAY_CACHES = {};          // the swept bays of the CURRENT BODY, by bay rule
let FIELD_L = {};             // measureBays' swept litres, by bay rule
let BODY_SIG = null;          // the body both caches were swept off
// THE BODY IS SWEPT WHEN THE BODY CHANGES, NOT WHEN THE CAGE REBUILDS
// (2026-09-04). PAGE.post emptied BAY_CACHES on every build, and every slider
// tick is a build: measured on the stock garage build, 2.0 s of a 2.6 s cowl-
// gap tick was two bay sweeps and four sL tables over a fuselage that had not
// moved (the user: "changing any slider value is now very painful"). The
// field-hit walk (_fit_site.js fieldHits) skips every face with a bare
// vertex, so the fielded vertices — A[i] defined — ARE the skin the sweep
// reads, and their coordinates are the signature: a wing, tail, engine or
// gear row leaves it alone, a fuselage row changes it and sweeps afresh.
function bodySig(ctx) {
  const m = ctx && ctx.mesh;
  if (!m || !m.V || !m.A) return null;
  const V = m.V, A = m.A;
  let h1 = 0x811c9dc5 | 0, h2 = 0, n = 0;
  for (let i = 0; i < V.length; i++) {
    if (!A[i]) continue;
    const p = V[i]; n++;
    for (let k = 0; k < 3; k++) {
      const q = Math.round(p[k] * 1e4) | 0;
      h1 = Math.imul(h1 ^ q, 16777619);
      h2 = (h2 + Math.imul(q, i + 1)) | 0;
    }
  }
  return n + ':' + (h1 >>> 0).toString(16) + ':' + (h2 >>> 0).toString(16) + ':' + fsOf(ctx);
}
// a bay's RULE limits and datum, before the field clamps them: the key both
// caches are read under
const bayKey = (bay, zFw) => bay.key + '|' + (+bay.x0).toFixed(4) + '|' + (+bay.x1).toFixed(4) +
  '|' + ((bay.lv || [0, 1]).map(x => (+x).toFixed(3)).join(',')) +
  '|' + (zFw == null ? 'x' : (+zFw).toFixed(5));

// the wing asked about itself: thickness and chord at a span station, off
// the loft the wing layer built, in this layer's own frame (the lights' rule)
function wingSlicer(ctx, inv, plane) {
  // G185: the slicer measures ONE plane — the second's loft when asked
  const W0 = window.CAGE_WING;
  const W = (plane && W0 && W0.planes && W0.planes[plane]) ? W0.planes[plane] : W0;
  if (!W || !W.group || !window.THREE) return null;
  const V = new THREE.Vector3();
  const cache = new Map();
  W.group.updateMatrixWorld(true);
  const meshes = [];
  W.group.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    if ((o.name || '').lastIndexOf('edFit_', 0) === 0) return;    // struts, pitot
    meshes.push(o);
  });
  // THE WING GROUP IS NOT ONLY THE WING, and at the root it is MOSTLY not
  // the wing: measured at x = 0.6 on the stock build, the aerofoil put 151
  // vertices in the slice and the three lift-strut meshes 516, all of them
  // 1.3 m below it and none of them named `edFit_`. A min/max over the slice
  // read the wing as 1.3 m thick. So the slice keeps the cluster of vertices
  // nearest the height the wing is KNOWN to be at — the layer's own anchor,
  // raised by the dihedral — and lets everything else fall away.
  const spec = W.def && W.def.spec;
  const wing = spec && ((plane && spec.wings && spec.wings[plane]) || spec.wing || (spec.wings || [])[0]) || {};
  const yAnchor = plane ? (W.rootY != null ? W.rootY : null)
                : (W0.anchor && W0.anchor.yAnchor != null) ? W0.anchor.yAnchor : null;
  const dih = Math.tan(((wing.dihedral || 0) * Math.PI) / 180);
  return xAt => {
    const key = Math.round(xAt * 200);
    if (cache.has(key)) return cache.get(key);
    const tol = 0.12;
    const ys = [], zs = [];
    for (const o of meshes) {
      const pos = o.geometry.getAttribute('position');
      if (!pos) continue;
      for (let i = 0; i < pos.count; i++) {
        V.set(pos.getX(i), pos.getY(i), pos.getZ(i))
          .applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        if (Math.abs(V.x - xAt) > tol) continue;
        ys.push(V.y); zs.push(V.z);
      }
    }
    let r = null;
    if (ys.length >= 6) {
      // the expected height, and the densest 10 cm bin within 0.6 m of it
      const yExp = yAnchor != null ? yAnchor + Math.abs(xAt) * dih : null;
      const bins = new Map();
      for (const y of ys) {
        if (yExp != null && Math.abs(y - yExp) > 0.6) continue;
        const b = Math.round(y * 10);
        bins.set(b, (bins.get(b) || 0) + 1);
      }
      let best = null, bestN = 0;
      for (const [b, n] of bins) if (n > bestN) { bestN = n; best = b; }
      if (best != null) {
        const yc = best / 10;
        let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0;
        for (let i = 0; i < ys.length; i++) {
          if (Math.abs(ys[i] - yc) > 0.30) continue;
          n++;
          if (ys[i] < y0) y0 = ys[i]; if (ys[i] > y1) y1 = ys[i];
          if (zs[i] < z0) z0 = zs[i]; if (zs[i] > z1) z1 = zs[i];
        }
        if (n >= 6) r = { y0, y1, zLE: z1, zTE: z0, n };
      }
    }
    cache.set(key, r);
    return r;
  };
}

// A TANK WITH NO STATION TAKES THE USER'S RULE, and then it HAS one: nose bay
// against the firewall and high, every other bay on the floor against the aft
// bulkhead (VESSEL_GEN.defaultSpot). The spot is WRITTEN INTO THE VESSEL,
// because a null would leave the ledger billing the bay's midpoint while the
// picture showed the bulkhead: one tank, one place. A grid search that walked
// the bay for a crew-clear cell lived here for an afternoon; the user's call
// was that it was too picky, and that the player places the tank themselves.
function placeAll(ctx, inv) {
  const C = core(), G = VG();
  const results = [];
  if (!C.vesselResolve || !G) return results;
  let wroteBack = false;
  // ONE SWEEP PER BAY PER BODY, not per layout and not per build: a drag
  // moves the tank and nothing else, and a wing or engine row moves nothing
  // the sweep reads. Measured: 744 ms per slider tick with the sweep inside
  // the layout, a few ms with it hoisted — and then 1.3 s per tick again
  // once every build emptied the map. PAGE.post empties it when the BODY
  // SIGNATURE changes, which is the only time the body changes.
  const cacheOf = bay => {
    if (bay.on !== 'body') return null;
    // the key is the RULE's limits, taken once per bay object: the clamp
    // below rewrites x0/x1, and a second vessel in the same bay must not
    // read a different key off the clamped numbers and sweep again
    if (!bay._ck) bay._ck = bayKey(bay, zFw);
    if (!(bay._ck in BAY_CACHES))
      BAY_CACHES[bay._ck] = G.bayCache ? G.bayCache(ctx.mesh, FS, bay, 0.035, zFw, 0.7) : null;
    const c = BAY_CACHES[bay._ck];
    // THE BAY IS CLAMPED TO THE BODY THE FIELD DESCRIBES. The rule's front
    // limit is a measured deck length; where the field stops describing
    // the deck (the firewall face) the bay stops too, so a default and a
    // slider both start at a station a tank can actually be at. Every
    // call, not only the sweeping one: BAYS is measured afresh each build
    // and the clamp lives on the bay object, not in the cache.
    if (c && c.axisMin != null && c.axisMin > bay.x0) bay.x0 = c.axisMin + 0.01;
    if (c && c.axisMax != null && c.axisMax < bay.x1) bay.x1 = c.axisMax - 0.01;
    return c;
  };
  const FS = fsOf(ctx);
  const W = window.CAGE_WING;
  const semi = W ? (W.semi || (W.def && W.def.spec && W.def.spec.geom && W.def.spec.geom.semi) || 0) : 0;
  const slice = W ? wingSlicer(ctx, inv) : null;
  // G185: the second plane's own semispan and slice, for its bays
  const semiOf = k => (k && W && W.planes && W.planes[k] && W.planes[k].semi) || semi;
  const sliceCache = { 0: slice };
  const sliceOf = k => { if (!(k in sliceCache)) sliceCache[k] = W ? wingSlicer(ctx, inv, k) : null; return sliceCache[k]; };
  // the datum the ledger bills against, read off this cage's own rings
  const zFw = G.firewallZ ? G.firewallZ(ctx.spec, CG2()) : null;
  for (const v of EN.vessels) {
    const bay = BAYS.find(b => b.key === v.bay) || BAYS.find(b => b.on === 'body');
    if (!bay) continue;
    // THE PLAYER'S BOX SETS THE CAPACITY. A vessel with its own dims has its
    // litres derived from them (installed volume, less the shell's rounding,
    // back through the same ullage factor genVesselResolve applies), so the
    // ledger bills what the drawn box holds and nothing else.
    if (v.dims) v.capacity = capacityFromDims(v.dims, formOf(v));
    const res = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel',
                                v.capacity, vesselKey(), medium());
    let dims = G.vesselDims(vesselKey(), res.installedL, v.dims, formOf(v));
    let pl;
    if (bay.on === 'wing') {
      const kp = bay.plane | 0, sl = sliceOf(kp), sm = semiOf(kp);
      pl = (sl && sm > 0)
        ? G.wingPlace(sm, bay, v, res.installedL, sl, C.RULES || {}, bay.litres)
        : { on: 'wing', ok: false, why: ['no wing to put it in'], sides: [] };
    } else {
      const cache = cacheOf(bay);
      // A STATION OUTSIDE ITS BAY IS NO STATION. A remembered `along` from
      // before a bay rule moved (the bench kept a nose tank at 1.08 m after
      // the nose bay became the cowl deck) would be reported as "past the
      // body" forever; it takes the rule again instead, like a new vessel.
      if (v.along != null && (v.along < bay.x0 - dims.L || v.along > bay.x1 + dims.L)) {
        v.along = null; v.lv = null;
      }
      // THE CATALOGUE SHAPE CANNOT FIT THIS BAY EITHER WAY ROUND: give the
      // vessel a bay-shaped box instead, litres capped by what fits — the
      // user's "geometry generated, capacity constrained to volume". Decided
      // on the box against the bay, not on whether the tank has a station:
      // a remembered station with a shape that never fitted stayed red on
      // the bench for exactly that reason.
      {
        const g = 0.02, len = bay.x1 - bay.x0;
        if (!v.dims && dims.L > len - 2 * g && dims.W > len - 2 * g && G.bayFitDims && G.bayExtAt) {
          const mid = bay.key === 'nose' ? bay.x0 + len / 2 : bay.x1 - len / 2;
          const ext = G.bayExtAt(cache, FS, zFw, mid);
          if (ext) {
            const bf = G.bayFitDims(bay, ext, res.installedL, dims.fill);
            // ...AND THE VOLUME FREE OF THE CREW. Measured on the Cub: the
            // deck bay's lower half is the pilot's feet and the pedals, and
            // a box that used the whole band settled through them at 652
            // points. The crew's highest point under the box's footprint is
            // the floor the box may stand on; the height above it, less a
            // margin, caps the box, and the litres follow — which is what
            // "capacity constrained to volume" means when the volume is
            // shared with a person.
            if (!CREW_PTS) CREW_PTS = crewPoints(ctx.scene, inv);
            const half = { x: bf.W / 2 + 0.02, z: bf.L / 2 + 0.02 };
            const zMid = (zFw != null ? (zFw - mid / FS) * FS : 0);
            let crewTop = -Infinity;
            for (const p of CREW_PTS)
              if (Math.abs(p[0]) <= half.x && Math.abs(p[2] - zMid) <= half.z && p[1] > crewTop)
                crewTop = p[1];
            const lvB = bay.lv || [0, 1];
            const bandTop = ext.yLo + lvB[1] * (ext.yHi - ext.yLo);
            if (isFinite(crewTop)) {
              const free = bandTop - 0.02 - (crewTop + 0.02);
              if (free > 0.06 && free < bf.H) { bf.H = free; bf.capped = true; bf.crew = true; }
            }
            v.dims = { L: +bf.L.toFixed(3), W: +bf.W.toFixed(3), H: +bf.H.toFixed(3) };
            v.capacity = capacityFromDims(v.dims, formOf(v));
            v.shaped = bf.crew ? 'crew' : (bf.capped ? 'band' : true);
            const res2 = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel',
                                         v.capacity, vesselKey(), medium());
            dims = G.vesselDims(vesselKey(), res2.installedL, v.dims, formOf(v));
            // a new shape settles its own level; the station stays the player's
            v.lv = null;
            wroteBack = true;
          }
        }
      }
      if (v.along == null || v.lv == null) {
        const spot = G.defaultSpot(bay, dims);
        v.along = spot.along; v.rot = spot.rot;
        // the rule's level, settled to where the skin actually is
        const clearOfCrew = pl => { pl.crewHits = 0; crewHits(ctx.scene, inv, [pl]); return pl.ok; };
        const st = G.settleLv ? G.settleLv(ctx.mesh, FS, bay, v, dims, 0.035, zFw, cache,
                                           spot.lv >= 0.5 ? 'down' : 'up', clearOfCrew) : null;
        // nothing settled: keep the rule's level, so a tank that does not fit
        // is shown where the rule put it, not wherever the sweep gave up
        v.lv = (st && st.settled) ? st.lv : spot.lv;
        wroteBack = true;
      }
      pl = G.bodyPlace(ctx.mesh, FS, bay, v, dims, 0.035, zFw, cache);
    }
    pl.v = v; pl.bay = bay; pl.res = res; pl.dims = dims;
    pl.needL = res.installedL;
    pl.roomL = bay.roomL;
    pl.fitsRoom = pl.roomL > 0 && pl.needL <= pl.roomL;
    if (!pl.fitsRoom) pl.why.push('the bay holds ' + (pl.roomL || 0).toFixed(0) + ' L');
    pl.crewHits = 0;
    results.push(pl);
  }
  // the station a vessel found for itself is a fact about this aeroplane now
  if (wroteBack) { if (panelBody) renderPanel(); commitLater(); }
  return results;
}
let laterT = null;
function commitLater() {
  if (laterT) clearTimeout(laterT);
  laterT = setTimeout(() => { laterT = null; commit(); }, 120);
}

// THE CREW IS IN THE WAY, OR IT IS NOT. Every vertex of everything the crew
// layer drew — seats, dummies, the panel, the sticks — tested against each
// body vessel's box. A box is convex, so a vertex inside it is a certain
// intrusion; the memory of G83's false positives says not to use bounding
// boxes for this, and this is not one.
// the crew's vertices in this layer's frame, gathered ONCE per layout — the
// auto-fit asks the same question a hundred times
let CREW_PTS = null;
function crewPoints(scene, inv) {
  if (!scene || !window.THREE) return [];
  let crew = null;
  for (const ch of scene.children)
    if ((ch.name || '') === 'cageLayer:crew') crew = ch;
  if (!crew) return [];
  crew.updateMatrixWorld(true);
  const V = new THREE.Vector3(), out = [];
  crew.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute('position');
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      V.set(pos.getX(i), pos.getY(i), pos.getZ(i))
        .applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      out.push([V.x, V.y, V.z]);
    }
  });
  return out;
}
function crewHits(scene, inv, results) {
  const G = VG();
  if (!G) return;
  const bodies = results.filter(r => r.on === 'body' && r.c);
  if (!bodies.length) return;
  if (!CREW_PTS) CREW_PTS = crewPoints(scene, inv);
  for (const p of CREW_PTS)
    for (const r of bodies) if (G.pointInBox(p, r, 0.01)) r.crewHits++;
  for (const r of bodies) if (r.crewHits) {
    r.ok = false;
    r.why.push('through the crew (' + r.crewHits + ' points)');
  }
}

// ---------------------------------------------------------------------------
// DRAWING — THE LOOKS
// ---------------------------------------------------------------------------
// A tank is not skin: it takes no livery, wears no wear, and the materials
// panel's `aeroskin` flag keeps it from being handed the G38 grey understudy.
// What it DOES take is a real surface, because in the editor it is an object
// an arm's length from the camera. tools/vessel_tex_prep.js bakes four scanned
// sets — painted metal, bare alloy, moulded plastic and steel — into the
// hangar props' own three-map recipe (diff sRGB, arm linear R ao / G roughness
// / B metalness, nor a GL tangent normal), and VESSEL_MESH lays its uv out in
// METRES, so `tile` from that table is the grain's real size on any tank.
//
// THE HUE ROW IS A MEASUREMENT, not a taste knob. green_metal_rust puts 94% of
// its pixels in one fifteen-degree hue bin at a saturation of 0.325 ± 0.02
// (tools/vessel_tex_import.py measures and prints it) — there is no second hue
// in the sheet to protect — so rotating the whole map's hue turns the paint
// and cannot turn anything else the wrong colour. That is why the row exists
// for the painted set and for no other.
const VTEX = () => (typeof VESSEL_TEX_SETS !== 'undefined' ? VESSEL_TEX_SETS : null);

const FINISH = {
  paint:   { name: 'painted metal',   set: 'paint',   col: 0xffffff, hue: 1 },
  alu:     { name: 'bare alloy',      set: 'alu',     col: 0xeef1f3 },
  plastic: { name: 'moulded plastic', set: 'plastic', col: 0xdedac9 },
  rubber:  { name: 'rubber',          set: 'plastic', col: 0x33333a },
  steel:   { name: 'steel',           set: 'steel',   col: 0xffffff },
};
// what a catalogue vessel is made of when the player has not said. A rubber
// bladder is rubber, a moulded tank is polythene, a welded one is bare alloy,
// and a pack case is painted — which is also the one the hue row recolours, so
// an electric build is where a player first meets it.
const FINISH_OF = { alu: 'alu', moulded: 'plastic', bladder: 'rubber',
                    packCase: 'paint', wet: null };
// THE SECTION'S ANSWER, and what a tank falls back to.
const finishKey = () => (FINISH[EN.finish] ? EN.finish : null) ||
                        FINISH_OF[vesselKey()] || 'alu';
// ...AND THE TANK'S OWN (2026-09-05, the user: "per tank colour please").
// Three fields on the vessel, each null meaning "the section's", so a build
// written before this — and a tank the player has never painted — is unchanged
// and two tanks in one aeroplane can be told apart at a glance. The hardware,
// the strap pads and the filler cap are NOT in here: they are steel, rubber
// and the one spot of colour wherever they are, and they are not the
// builder's.
const finishOf = v => (v && FINISH[v.finish] ? v.finish : null) || finishKey();
const hueOf = v => (v && v.hue != null ? +v.hue : (EN.hue || 0));
const tintOf = v => (v && v.tint) || EN.tint || null;
// what a row writes: the RESOLVED look, all three, onto the tank itself. A
// half-inherited tank ("its tint is its own, its hue is the section's") is a
// state nobody can read off the panel, and the section-wide values stay
// exactly what they are — the seed a tank starts from and an untouched tank
// keeps.
function lookWrite(v, k, val) {
  if (!v) return;
  if (v.finish == null) v.finish = finishOf(v);
  if (v.hue == null) v.hue = hueOf(v);
  if (v.tint == null) v.tint = tintOf(v) ||
    '#' + ('000000' + FINISH[finishOf(v)].col.toString(16)).slice(-6);
  v[k] = val;
}
// the slots VESSEL_MESH fills, and what each is made of. Only the shell is the
// player's: hardware is steel wherever it is, a strap pad is rubber, and the
// filler cap and the positive terminal boot are the one spot of colour.
const SLOT_FIN = { shell: null, hard: 'steel', seal: 'rubber', mark: 'plastic' };
const SLOT_COL = { hard: 0xffffff, seal: 0x2e2e33, mark: 0xb8402f };

const vTexCache = new Map();
function vTex(setKey, map, srgb) {
  const id = setKey + '|' + map;
  if (vTexCache.has(id)) return vTexCache.get(id);
  const S = (VTEX() || {})[setKey];
  const img = S && S[map];
  if (!img) { vTexCache.set(id, null); return null; }
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  // the payload starts decoding at script eval; a material built before the
  // bytes land simply repaints when they arrive
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else img.addEventListener('load', ok);
  vTexCache.set(id, t);
  return t;
}
// the metres-per-repeat a finish wants, which VESSEL_MESH needs BEFORE any
// material exists — the uv is baked into the geometry, not set on the texture
function tileOf(fin) {
  const F = FINISH[fin] || FINISH.alu, S = (VTEX() || {})[F.set];
  return (S && S.tile) || 0.4;
}

// HUE IN GAMMA SPACE, and the two pow()s are the point. `#include
// <map_fragment>` has already decoded the texel to linear, and the luma
// weights the classic hue matrix is built on (0.299 / 0.587 / 0.114) are
// gamma-space weights — rotating a linear colour with them swings the
// brightness as well as the hue, which on a dark green reads as the paint
// going chalky rather than changing colour.
const HUE_FN = [
  'uniform float uHue;',
  'vec3 vesselHue(vec3 c, float a) {',
  '  if (abs(a) < 0.0005) return c;',
  '  vec3 g = pow(max(c, vec3(0.0)), vec3(0.45454545));',
  '  float C = cos(a), S = sin(a);',
  '  vec3 o = vec3(',
  '    dot(g, vec3(0.299+0.701*C+0.168*S, 0.587-0.587*C+0.330*S, 0.114-0.114*C-0.497*S)),',
  '    dot(g, vec3(0.299-0.299*C-0.328*S, 0.587+0.413*C+0.035*S, 0.114-0.114*C+0.292*S)),',
  '    dot(g, vec3(0.299-0.300*C+1.250*S, 0.587-0.588*C-1.050*S, 0.114+0.886*C-0.203*S)));',
  '  return pow(clamp(o, vec3(0.0), vec3(1.0)), vec3(2.2));',
  '}',
].join('\n');

// ONE FACTORY, TWO WORLDS (2026-09-04). The editor reaches it through
// `slotMat` below; the FLOWN aeroplane reaches it through
// `CAGE_ENERGY.material` — app.js's `matFor`, where a cage payload's material
// record says `ves`. That is the posture AEROSKIN has had since G67, and it is
// here for the reason it was there, reported the same way: the user's red tank
// flew WHITE. The join carries a colour and two scalars for any material it
// cannot name, and on a scanned surface a colour is not the look — the red was
// the SHEET, tinted and hue-rotated, and none of that crossed. What crosses now
// is what the material IS: the set, the tint and the hue, rebuilt here into the
// same material the editor drew.
//
//   set     a VESSEL_TEX_SETS key
//   col     the finish's own colour, when nothing tints it
//   tint    the player's multiplier over the sheet
//   hueRad  the paint rotation in RADIANS. EN.hue is DEGREES and slotMat
//           converts once; the payload carries what the shader wants.
//   hueOn   whether this sheet takes the row at all — true even at zero for
//           the editor, because a drag must not have to recompile
function vesselMat(o) {
  const O = o || {};
  const F = { set: (VTEX() && VTEX()[O.set]) ? O.set : (O.set || 'alu'),
              col: O.col == null ? 0xffffff : O.col };
  const bad = !!O.bad;
  const S = (VTEX() || {})[F.set];
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(O.tint == null ? F.col : O.tint),
    // with the maps bound the scalars are MULTIPLIERS and 1.0 means "what the
    // scan measured"; without them they are the scan's own means, so a page
    // with no payload still looks like roughly the right material
    roughness: S ? 1.0 : 0.55,
    metalness: S ? 1.0 : (F.set === 'alu' || F.set === 'steel' ? 0.9 : 0.0),
    emissive: new THREE.Color(bad ? 0xff2a1a : 0x000000),
    emissiveIntensity: bad ? 0.45 : 0,
  });
  if (S) {
    m.map = vTex(F.set, 'diff', true);
    const arm = vTex(F.set, 'arm', false);
    m.roughnessMap = arm; m.metalnessMap = arm;
    if (S.ao) { m.aoMap = arm; m.aoMapIntensity = 1; }
    m.normalMap = vTex(F.set, 'nor', false);
    m.normalScale = new THREE.Vector2(S.norScl, S.norScl);
  }
  m.userData.hue = +O.hueRad || 0;
  if (O.hueOn || m.userData.hue) m.onBeforeCompile = sh => {
    sh.uniforms.uHue = { value: m.userData.hue || 0 };
    sh.fragmentShader = HUE_FN + '\n' + sh.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n  diffuseColor.rgb = vesselHue(diffuseColor.rgb, uHue);');
    m.userData.hueU = sh.uniforms.uHue;
  };
  m.userData.aeroskin = 1;
  // WHAT THIS MATERIAL IS, for the join to read off it. The resolved colour is
  // already on `material.color` — AEROSKIN keeps its albedo there for exactly
  // this reason — so the SET and the live hue are all the snapshot has left to
  // carry, and `vesSet` is also what tells the merge that two look-alike whites
  // are a tank and not the aeroplane.
  m.userData.vesSet = F.set;
  if (O.hueOn) m.userData.vesHueOn = 1;
  // every material this factory has made follows the room, the game's included
  m.userData.env0 = 1;
  m.envMapIntensity = VES_ENV_F;
  vesAll.push(m);
  return m;
}
function buildMat(fin, bad) {
  const F = FINISH[fin] || FINISH.alu;
  return vesselMat({ set: F.set, col: F.col, hueOn: !!F.hue, bad });
}
// THE GAME'S DOOR IS POOLED AND THE EDITOR'S IS NOT, deliberately: slotMat
// MUTATES what it caches — the tint and the hue uniform are the two live rows,
// written on every layout — so one material shared with the flown aeroplane
// would be repainted under its feet by a slider nobody was pointing at it. A
// payload's record is fixed, so one material per record is all the game wants,
// and pooling is what stops a rebuilt aeroplane stacking up materials the
// room's mood still has to walk (AEROSKIN's own posture, AERO_POOL).
const vesPool = new Map();
function vesselMatFor(o) {
  const O = o || {};
  const k = [O.set, O.col, O.tint, +O.hueRad || 0,
             O.hueOn ? 1 : 0, O.bad ? 1 : 0].join('|');
  let m = vesPool.get(k);
  if (!m) vesPool.set(k, m = vesselMat(O));
  return m;
}
// THE ROOM'S MOOD SCALES THESE TOO (2026-09-04). props.js and aeroskin.js each
// keep their materials' own `env0` and let hangar.js's setMood multiply it;
// without the same posture a tank arrived at envMapIntensity 1.0 while every
// other material in the room sat at 2.2 (measured, in the garage), which on
// bare alloy is a dull grey box beside a bright aeroplane. The factor is
// REMEMBERED, for the reason aeroskin.js's own note gives: a material built
// between two mood changes would otherwise keep the default until the next.
const vmats = new Map();
// EVERY material the factory has made, not just the editor's cache: the flown
// aeroplane's tank is built from the same factory and stands in the same room.
const vesAll = [];
let VES_ENV_F = 1;
function vesselSetEnv(f) {
  VES_ENV_F = f;
  for (const m of vesAll) m.envMapIntensity = (m.userData.env0 || 1) * f;
  if (wetMat) wetMat.envMapIntensity = f;
}
// ONE SHELL MATERIAL PER TANK, keyed on the tank's INDEX and not on its
// colour. The tint and the hue are still written on every layout rather than
// baked into the key — a hue drag must not compile a new program for every
// degree — and that is only sound while no two tanks share the material they
// are being written on. The hardware, the seals and the markings are shared:
// they are the same steel and the same rubber on every tank aboard.
function slotMat(slot, bad, i, v) {
  const fin = slot === 'shell' ? finishOf(v) : SLOT_FIN[slot];
  const id = slot + '|' + fin + (bad ? '!' : '') +
             (slot === 'shell' ? '|' + (i || 0) : '');
  let m = vmats.get(id);
  if (!m) vmats.set(id, m = buildMat(fin, bad));
  const col = slot === 'shell' ? (tintOf(v) || FINISH[fin].col) : SLOT_COL[slot];
  m.color.set(col);
  const h = (slot === 'shell' && FINISH[fin].hue) ? hueOf(v) * Math.PI / 180 : 0;
  m.userData.hue = h;
  if (m.userData.hueU) m.userData.hueU.value = h;
  return m;
}
// A WET WING HAS NO SHELL: it is the spar bay itself, sealed, so what is drawn
// there is the fuel and not a tank. That one keeps the plain translucent look.
let wetMat = null;
function matWet(bad) {
  if (!wetMat) {
    wetMat = new THREE.MeshStandardMaterial({ color: 0x4a8fd6, roughness: 0.30,
      metalness: 0.10, transparent: true, opacity: 0.40, side: THREE.DoubleSide });
    wetMat.userData.aeroskin = 1;
    wetMat.userData.env0 = 1;
    wetMat.envMapIntensity = VES_ENV_F;
  }
  wetMat.emissive.set(bad ? 0xff2a1a : 0x000000);
  wetMat.emissiveIntensity = bad ? 0.45 : 0;
  return wetMat;
}
// the fuel's own look: avgas is dyed blue, mogas is straw
let fuelMats = {};
function fuelMat() {
  const key = EN.fuel || 'avgas100LL';
  if (fuelMats[key]) return fuelMats[key];
  const col = /avgas/i.test(key) ? 0x3a7fd8 : 0xd9b14a;
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.25,
    metalness: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
  m.userData.aeroskin = 1;
  return (fuelMats[key] = m);
}
let ghostMat = null;
function ghost() {
  if (ghostMat) return ghostMat;
  ghostMat = new THREE.MeshStandardMaterial({ color: 0x64a8ff, roughness: 0.8,
    metalness: 0, transparent: true, opacity: 0.10, depthWrite: false,
    side: THREE.DoubleSide });
  ghostMat.userData.aeroskin = 1;
  return ghostMat;
}

// one buffer -> one mesh, placed by the SAME transform the placement decided
// (centre, then the turn about the vertical). The solid is built in the
// vessel's own frame and moved here, so nothing has to bake a rotation into
// geometry that a slider will change again a frame later.
function slotMesh(group, buf, mat, name, c, rot) {
  if (!buf || !buf.idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
  g.setIndex(buf.idx);
  const m = new THREE.Mesh(g, mat);
  m.position.set(c[0], c[1], c[2]);
  m.rotation.y = rot || 0;
  m.name = name;
  group.add(m);
  return m;
}
// THE SOLID IS CACHED ON WHAT CHANGES IT, and a station drag changes none of
// it. relayout runs on every slider tick and a shell is a couple of thousand
// triangles; the key is the box, the form, the kind and the grain, so moving a
// tank along the body or up its bay rebuilds nothing at all.
const solids = new Map();
function vesselSolid(r) {
  const VM = window.VESSEL_MESH;
  if (!VM) return null;
  const fin = finishOf(r.v);
  const form = formOf(r.v);
  const key = r.e.map(x => x.toFixed(4)).join(',') + '|' + form + '|' + EN.kind + '|' + fin;
  let s = solids.get(key);
  if (!s) {
    s = VM.build({ e: r.e, form, kind: EN.kind,
                   tile: { shell: tileOf(fin), hard: tileOf('steel'),
                           seal: tileOf('rubber') } });
    if (solids.size > 24) solids.clear();
    solids.set(key, s);
  }
  return s;
}

// WHICH SURFACE THE TANK IS MOUNTED TO (G189): the section's deck when the
// tank sits in the upper half of its section (the nose bay's band tops out
// at the cowl deck, so a nose tank hangs), its keel otherwise. Returns the
// signed distance from the tank's centre to that surface, for VESSEL_MESH's
// own mount builder (which draws it in the tank's frame), or null.
function tankMountDy(r) {
  const c = r && r.c, sec = r && r.section;
  if (!c || !sec) return null;
  const hang = c[1] > 0.5 * (sec.yLo + sec.yHi);
  return (hang ? sec.yHi : sec.yLo) - c[1];
}

function drawResults(group, ctx, results) {
  const VM = window.VESSEL_MESH, K = window.GEAR_KIT;
  const wet = vesselKey() === 'wet';
  for (const r of results) {
    const bad = !r.ok;
    const i = EN.vessels.indexOf(r.v);
    if (r.on === 'body' && r.c && VM) {
      const sol = vesselSolid(r);
      if (!sol) continue;
      r.solid = sol;
      // `sol.yaw` is the solid's own canonical turn (VESSEL_MESH builds along
      // the longer horizontal axis), not a placement decision — it rides on
      // top of the vessel's own `rot` and moves nothing the ledger reads.
      const yaw = r.rot + (sol.yaw || 0);
      // THE RED IS THE SHELL'S ALONE. It is four fifths of what you can see,
      // so a tank that does not fit is unmissable either way — and putting the
      // emissive on the straps, the filler and the sump as well turned the
      // whole thing into a red blob with no shape left to read, at exactly the
      // moment the builder needs to see WHICH corner is through the skin.
      for (const slot of ['shell', 'hard', 'seal', 'mark'])
        slotMesh(group, sol[slot], slotMat(slot, slot === 'shell' && bad, i, r.v),
                 'edVessel_' + i + '_' + slot, r.c, yaw);
      // THE MOUNT (G189, the user: "a small mount for the fuel tank? Nothing
      // crazy, but a small structure that links it to the surface it's
      // attached to. Light, tubes."). Under each strap, two legs from the
      // strap's pad to the surface the bay stands on — the keel of the
      // section for a floor bay, the deck above for a tank HUNG in the nose
      // bay's band — a cross tube between the two feet, and a foot plate
      // where each leg lands. It is the strap's own station and the tank's
      // own turn, so it follows a drag, a resize and a re-yaw, and it takes
      // the hardware finish (the `hard` slot) like the straps it belongs to.
      if (r.section && sol.e && VM.mount) {
        try {
          const dy = tankMountDy(r);
          const mb = dy != null ? VM.mount(sol, dy) : null;
          if (mb) slotMesh(group, mb, slotMat('hard', false, i, r.v),
                           'edVessel_' + i + '_mount', r.c, yaw);
        } catch (e) {}
      }
      // THE FUEL INSIDE, at the slider's fill. It is the shell's own section
      // inset by the wall and cut flat at the level — so in a round tank the
      // fuel has a round bottom and a flat top, and the level itself is placed
      // by VOLUME, not by height (VESSEL_MESH.contents). A pack does not
      // drain, so nothing is drawn inside one.
      if (EN.kind !== 'battery' && VIEW.fill > 0.02)
        slotMesh(group, VM.contents(sol, VIEW.fill, 0.008), fuelMat(),
                 'edFuel_' + i, r.c, yaw);
    } else if (r.on === 'wing' && r.sides && VM) {
      // THE WING TANK IS THE SIMPLE ONE, by the user's own ruling: a box in
      // the panel just outboard of the centre section, and that is all. It is
      // buried between the spars where nothing can see it, so it gets real
      // outward normals and metre-true uv and no hardware.
      for (const s of r.sides) {
        const y0 = s.y - s.d / 2, y1 = s.y + s.d / 2;
        const p8 = [
          [s.x0, y0, s.zR0], [s.x0, y0, s.zF0], [s.x0, y1, s.zF0], [s.x0, y1, s.zR0],
          [s.x1, y0, s.zR1], [s.x1, y0, s.zF1], [s.x1, y1, s.zF1], [s.x1, y1, s.zR1],
        ];
        const mat = wet ? matWet(bad) : slotMat('shell', bad, i, r.v);
        if (!wet)
          slotMesh(group, VM.wingBox(p8, tileOf(finishOf(r.v))), mat,
                   'edVessel_' + i + (s.sign > 0 ? 'R' : 'L'), [0, 0, 0], 0);
        if (EN.kind !== 'battery' && VIEW.fill > 0.02) {
          const inset = wet ? 0.0 : 0.008, f = Math.min(1, VIEW.fill);
          const g0 = y0 + inset, g1 = g0 + Math.max(0.004, (s.d - 2 * inset) * f);
          const dx = s.x1 > s.x0 ? inset : -inset;
          const q8 = [
            [s.x0 + dx, g0, s.zR0 + inset], [s.x0 + dx, g0, s.zF0 - inset],
            [s.x0 + dx, g1, s.zF0 - inset], [s.x0 + dx, g1, s.zR0 + inset],
            [s.x1 - dx, g0, s.zR1 + inset], [s.x1 - dx, g0, s.zF1 - inset],
            [s.x1 - dx, g1, s.zF1 - inset], [s.x1 - dx, g1, s.zR1 + inset],
          ];
          slotMesh(group, VM.wingBox(q8, 0.4), wet ? matWet(bad) : fuelMat(),
                   'edFuel_' + i + (s.sign > 0 ? 'R' : 'L'), [0, 0, 0], 0);
        }
      }
    }
  }
  // THE BAY, AS A GHOST, for the vessel the panel has selected: the region
  // the rule allows, so a tank dragged to the edge can be seen reaching it.
  // OPT-IN (the user, seeing it on the nose tank: "a faint transparent box
  // ... subtle, almost transparent but not quite"): a guide nobody asked for
  // reads as a defect, so it is off until the panel switches it on.
  const sel = results[selected];
  if (VIEW.showBay && sel && sel.on === 'body' && sel.bay && ctx.mesh && BAY()) {
    try {
      const FS = fsOf(ctx), b = sel.bay;
      const sA = BAY().baySection(ctx.mesh, b.x0 / FS),
            sB = BAY().baySection(ctx.mesh, b.x1 / FS);
      if (sA && sB && sel.section) {
        const band = sel.section.band;
        const zA = sA.z * FS, zB = sB.z * FS;
        const xh = 0.5 * (sel.section.xHi - sel.section.xLo);
        const c = [0, 0.5 * (band[0] + band[1]), 0.5 * (zA + zB)];
        const e = [xh, 0.5 * (band[1] - band[0]), 0.5 * Math.abs(zA - zB)];
        const bag = K.Bag();
        K.boxIn(bag, c, e, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
        const m = bag.mesh(group, ghost());
        if (m) m.name = 'edBay_' + b.key;
      }
    } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// THE POST HOOK, and the light re-layout a drag uses
// ---------------------------------------------------------------------------
let group = null;

function relayout() {
  const ctx = LAST.ctx;
  if (!ctx || !window.THREE) return;
  const { scene } = ctx;
  if (group) {
    group.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    scene.remove(group);
    group = null;
  }
  group = new THREE.Group();
  group.name = 'cageLayer:energy';
  scene.add(group);
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  CREW_PTS = null;              // the crew may have moved since the last layout
  const results = placeAll(ctx, inv);
  crewHits(scene, inv, results);
  drawResults(group, ctx, results);
  LAST.results = results; LAST.inv = inv; LAST.group = group;
  if (panelBody) syncReadouts();
  if (ctx.stat) {
    const bad = results.filter(r => !r.ok).length;
    ctx.stat.textContent += '  ·  energy: ' + results.length + ' vessel' +
      (results.length === 1 ? '' : 's') + (bad ? ', ' + bad + ' not fitting' : '');
  }
}

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  // the game seeds through applySpec; a bench reload seeds from its memory;
  // a first build with neither carries the default
  if (!seeded) {
    if (inGame() && window.GARAGE_SPEC) {
      try { fromSpec(window.GARAGE_SPEC.get().energy); } catch (e) {}
    }
    if (!seeded && !loadPrefs()) fromSpec(null);
  }
  LAST.ctx = ctx;
  hookCommit();
  // a new body: every bay is swept afresh. The same body: nothing is.
  const sig = bodySig(ctx);
  if (sig == null || sig !== BODY_SIG) { BAY_CACHES = {}; FIELD_L = {}; BODY_SIG = sig; }
  const S = resolvedSpec(ctx);
  BAYS = measureBays(S, ctx);
  // a vessel in a bay this aeroplane does not have (no wing) goes to the nose
  for (const v of EN.vessels)
    if (!BAYS.find(b => b.key === v.bay)) v.bay = (BAYS[0] || {}).key || 'nose';
  if (HAS_DOM) { mountPanel(); renderPanel(); }
  relayout();
};
// a preset or a reset on the bench is a new aeroplane: it gets the default tank
const prevLoad = PAGE.load;
PAGE.load = spec => {
  if (prevLoad) try { prevLoad(spec); } catch (e) {}
  if (!inGame()) fromSpec(spec && spec.energy);
};

// ---------------------------------------------------------------------------
// COMMIT — the spec is the owner
// ---------------------------------------------------------------------------
function commit() {
  savePrefs();
  if (!inGame()) return;
  const G = window.GARAGE_SPEC;
  if (!G || !G.update) return;
  // one door, the same the registration uses: update merges `energy` and
  // REPLACES the vessel list, then puts the aeroplane back on the stand.
  // `fuel.litres` and `fuel.tank` are READINGS of this list, and the store
  // does not normalise on update — so they are derived here by the core's
  // own rule (genNormaliseSpec runs clampSpec) and written beside the list,
  // or the file would say 50 litres over a 60-litre tank.
  try {
    const patch = { energy: toSpec() };
    // resolveSpec, not genNormaliseSpec: normalise migrates and defaults,
    // and it is clampSpec — which only the resolve runs — that derives the
    // litres from the list
    if (typeof resolveSpec === 'function') {
      const cur = G.get();
      cur.energy = patch.energy;
      const R = resolveSpec(cur), N = R && R.spec;
      if (N && N.fuel) patch.fuel = { litres: N.fuel.litres, tank: N.fuel.tank };
      if (N && N.energy && N.energy.kWh != null) patch.energy.kWh = N.energy.kWh;
    }
    G.update(patch);
  } catch (e) { console.error('energy:', e); }
  scheduleReadouts(250);
  // `update` rebuilds the aeroplane rather than committing the join, so the
  // posts would fall back to the fresh sim's own CG — a second instrument
  // for the same line, ~7 mm off the worker's. One source: ask the job.
  balanceRequest();
}

// THE NUMBERS ARE READ WHEN THEY CAN BE SEEN (2026-09-04). balanceReadout is
// the core's FULL shakedown (the reserve sheet and the envelope's four
// corners ride inside it), fillReadout one more slim one, the chart seven:
// fourteen aero solves, ~1.1 s on the stock build — and renderPanel fired
// them 50 ms after EVERY cage build, so a cowl or wing slider paid, tick
// after tick, for a chart that was folded away or scrolled off the panel.
// A build now marks them STALE; they are requested once, 300 ms after the
// last build, and only while the panel is open and its readout block is on
// screen. Opening or scrolling to a stale panel requests them then. The rows
// that live in the panel (fill, occupants, baggage) still request on their
// own release, because a hand on them is a reader in front of them. And the
// request itself runs off the main thread — see readoutWorker below.
let readT = null, readStale = false, readSeen = true, readIO = null;
function readoutsVisible() { return !!(panel && panel.open && readSeen); }
function scheduleReadouts(ms) {
  readStale = true;
  if (!inGame() || !balEl) return;
  // a BUILD (no ms) only marks the readouts stale once the commit is hooked:
  // the commit re-schedules with 0 on the spec as merged. Explicit delays —
  // the panel's own commit, the fill row — still run as asked.
  if (ms == null && commitHooked) return;
  if (readT) clearTimeout(readT);
  readT = setTimeout(() => {
    readT = null;
    if (readStale && readoutsVisible()) { readStale = false; balanceReadout(); }
  }, ms == null ? 300 : ms);
}
function watchReadouts(elm) {
  if (typeof IntersectionObserver === 'undefined') { readSeen = true; return; }
  if (!readIO) readIO = new IntersectionObserver(es => {
    readSeen = es.some(e => e.isIntersecting);
    if (readSeen && readStale) scheduleReadouts(0);
  });
  readIO.disconnect();
  readIO.observe(elm);
}

// WHAT IT DOES TO THE AEROPLANE, in numbers — the core's own shakedown over
// the spec as just committed. This is the "CG with full or empty tank at
// conception" the user asked for, read live off the same ledger the flight
// weighs itself with, not a second estimate.
let balEl = null, fillEl = null, barEl = null, tableEl = null, chartEl = null;
let LAST_CHART = null;
let LAST_SHAKE = null;

// THE READOUTS RUN OFF THE MAIN THREAD (2026-09-04). Fourteen aero solves —
// the full shakedown with its reserve sheet and four corners inside it, the
// fill point, the chart's seven — are ~1.1 s on the stock build, and on the
// main thread that is a freeze after every slider release while the panel is
// on screen, which is exactly when a builder is placing tanks. So ONE job,
// all three readouts, goes to a Worker that loads the very core the gates
// require (tools/flight_core.js) and the chart's pure half (balance.js); the
// numbers come back about a second later and the picture never stops moving.
// Same functions, same spec, same door: the worker runs buildGen /
// genShakedown / genSpecAtFuel / BALANCE.compute verbatim (readoutCompute is
// the one body, serialised into the worker), and the reference chart taken
// before this change came back identical. An answer about an aeroplane that
// has changed since (the job's sequence number is not the latest) is
// dropped. No Worker — file://, a load error — and the same job runs here,
// synchronously, as it did before.
let readWorker = null, readWorkerDead = false, readSeq = 0;
function readoutJob() {
  const G = window.GARAGE_SPEC;
  if (!G || !G.get) return null;
  return { spec: G.get(), occupants: VIEW.occupants, baggage: VIEW.baggage, fill: VIEW.fill };
}
// the job, computed with whatever core is in scope: the worker's or the
// page's. Self-contained on purpose — it is stringified into the worker.
function readoutCompute(job, core, BAL) {
  const def = core.buildGen(job.spec);
  const shake = core.genShakedown(def, {});
  const S0 = def.spec;              // the RESOLVED spec: what GARAGE_SPEC.resolved() hands the page
  const out = { shake, fillSh: null, litres: null, chart: null };
  if (S0 && S0.fuel) {
    const L = S0.fuel.litres * Math.min(1, Math.max(0, job.fill == null ? 1 : job.fill));
    out.litres = L;
    out.fillSh = core.genShakedown(core.buildGen(core.genSpecAtFuel(S0, L)), { slim: true });
    if (BAL) out.chart = BAL.compute(S0, core,
      { occupants: job.occupants, baggage: job.baggage, fill: job.fill, envelope: shake.envelope });
  }
  return out;
}
// THE SLIM BALANCE JOB (2026-09-11): buildGen + ONE aero solve, on every
// commit of the join, panel or no panel — it feeds the CG and NP posts in
// the room (app.js refreshIndicators) and is what makes the amber line
// follow a slider. `gearX` is the mains' axle station in the design frame,
// the landmark the posts are placed from. Self-contained: it is stringified
// into the worker beside readoutCompute.
function balanceCompute(job, core) {
  const t0 = Date.now();
  const def = core.buildGen(job.spec);
  const sh = core.genShakedown(def, { slim: true });
  const P = def.parts || {};
  let gearX = null;
  if (P.GAL != null && P.GAR != null && def.nodes[P.GAL] && def.nodes[P.GAR])
    gearX = 0.5 * (def.nodes[P.GAL].p[0] + def.nodes[P.GAR].p[0]);
  return { kind: 'balance', cgX: sh.cgX, npX: sh.npX, staticMargin: sh.staticMargin,
           cBar: sh.cBar, xLEmac: sh.xLEmac, mass: sh.mass, gearX, ms: Date.now() - t0 };
}
// ONE JOB IN FLIGHT (2026-09-11): a job is ~1 s in the worker and boot
// commits three or four times, so posting every request queued seconds of
// stale answers behind the one that mattered. A request while one is out
// only marks `balPending`; the answer's arrival posts the newest spec.
let balSeq = 0, balSeen = 0, balErr = null, balBusy = false, balPending = false, LAST_BAL = null;
function balanceApply(r) {
  if (!r || r.gearX == null) return;
  LAST_BAL = r;
  for (const fn of (window.BALANCE_LISTENERS || [])) { try { fn(r); } catch (e) {} }
}
function balanceDone() {
  balBusy = false;
  if (balPending) { balPending = false; balanceRequest(); }
}
function balanceRequest() {
  if (!inGame() || !window.GARAGE_SPEC || !window.GARAGE_SPEC.get) return;
  if (balBusy) { balPending = true; return; }
  const job = { kind: 'balance', spec: window.GARAGE_SPEC.get(), seq: ++balSeq };
  const w = readoutWorker();
  if (w) { try { balBusy = true; w.postMessage(job); return; } catch (e) { balBusy = false; } }
  if (typeof buildGen !== 'function' || typeof genShakedown !== 'function') return;
  try { balanceApply(balanceCompute(job, { buildGen, genShakedown })); } catch (e) {}
}
// THE COMMIT IS THE TRIGGER (2026-09-11). Readouts used to fire 300 ms after
// a build off a shelf the join reaches 900 ms after the same build — one
// edit behind, always. `GARAGE_SPEC.onCommit` fires when the join's answer
// is merged; both jobs run on that, and a build only marks the readouts
// stale (see scheduleReadouts).
let commitHooked = false;
function hookCommit() {
  if (commitHooked || !inGame()) return;
  const G = window.GARAGE_SPEC;
  if (!G || typeof G.onCommit !== 'function') return;
  commitHooked = true;
  G.onCommit(() => { balanceRequest(); scheduleReadouts(0); });
  balanceRequest();   // a freshly loaded build gets its posts from the same source
}
function readoutWorker() {
  if (readWorker || readWorkerDead) return readWorker;
  try {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' ||
        !/^https?:$/.test(location.protocol)) throw new Error('no worker here');
    const base = new URL('.', location.href).href;   // dev.html and index.html both sit in flyDiy/
    const src = 'self.module = { exports: {} };\n' +
      'importScripts(' + JSON.stringify(base + 'src/viewer/balance.js') + ');\n' +
      'const BAL = self.module.exports; self.module = { exports: {} };\n' +
      'importScripts(' + JSON.stringify(base + 'tools/flight_core.js') + ');\n' +
      'const CORE = { buildGen, genShakedown, genSpecAtFuel };\n' +
      'const compute = ' + readoutCompute.toString() + ';\n' +
      'const computeBal = ' + balanceCompute.toString() + ';\n' +
      'self.onmessage = e => { const job = e.data; try { const r = job.kind === \'balance\' ? computeBal(job, CORE) : compute(job, CORE, BAL); r.seq = job.seq; postMessage(r); }' +
      ' catch (err) { postMessage({ kind: job.kind, seq: job.seq, error: String(err && err.stack || err) }); } };\n';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = e => {
      const r = e.data;
      if (r && r.kind === 'balance') {
        balSeen++;
        if (r.error) { balErr = r.error; console.warn('balance job: the worker could not compute —', r.error); }
        else if (r.seq === balSeq) balanceApply(r);
        balanceDone();
        return;
      }
      if (!r || r.seq !== readSeq) return;        // an older aeroplane's answer
      if (r.error) {
        console.warn('energy readouts: the worker could not compute, reading on the page instead —', r.error);
        readWorkerDead = true; readWorker = null; balBusy = false;
        try { w.terminate(); } catch (e2) {}
        readoutsNow();
        return;
      }
      applyReadouts(r);
    };
    w.onerror = err => {
      console.warn('energy readouts: the worker failed, reading on the page instead —', err && err.message);
      readWorkerDead = true; readWorker = null; balBusy = false;
      try { w.terminate(); } catch (e2) {}
      readoutsNow();
    };
    readWorker = w;
  } catch (e) { readWorkerDead = true; readWorker = null; }
  return readWorker;
}
// the job on the page, when there is no worker
function readoutsNow() {
  if (!balEl || !inGame()) return;
  if (typeof buildGen !== 'function' || typeof genShakedown !== 'function' ||
      typeof genSpecAtFuel !== 'function') { balEl.textContent = ''; return; }
  const job = readoutJob();
  if (!job) return;
  try { applyReadouts(readoutCompute(job, { buildGen, genShakedown, genSpecAtFuel }, window.BALANCE || null)); }
  catch (e) { balEl.textContent = ''; }
}
// every trigger — a build, a commit, the fill / occupants / baggage rows —
// asks for the whole set once: off the main thread the price of "all three"
// does not matter, and one job cannot race another
function readoutsRequest() {
  if (!balEl || !inGame()) return;
  const job = readoutJob();
  if (!job) return;
  const w = readoutWorker();
  if (!w) { readoutsNow(); return; }
  job.seq = ++readSeq;
  try { w.postMessage(job); }
  catch (e) { readWorkerDead = true; readWorker = null; readoutsNow(); }
}
function applyReadouts(r) {
  const s = r && r.shake;
  if (!s) return;
  LAST_SHAKE = s;
  loadingTable();
  const f = (v, d) => (v == null || !isFinite(v)) ? '\u2014' : v.toFixed(d);
  if (balEl) {
    let t = 'all-up ' + f(s.mass, 0) + ' kg \u00b7 CG ' + f(s.cgX, 2) + ' m \u00b7 static margin ' +
      f(s.staticMargin, 2);
    if (s.reserve) t += ' \u00b7 at reserves ' + f(s.reserve.staticMargin, 2) +
      ' (' + f(s.reserve.mass, 0) + ' kg)';
    const bad = (s.vessels || []).filter(v => !v.fits).length;
    if (bad) t += ' \u00b7 ' + bad + ' vessel' + (bad > 1 ? 's' : '') + ' the ledger cannot fit';
    balEl.textContent = t;
    balEl.style.color = (s.staticMargin != null && s.staticMargin < 0.05) ? '#ff7b6b' : '';
  }
  const E = s.envelope;
  const sh = r.fillSh;
  if (fillEl) {
    if (sh) {
      let pct = null;
      if (E && E.fwd && E.aft && E.fwd.cgPct != null && E.fwd.cgX != null) {
        // the envelope's own % MAC scale: two points define it
        const k = (E.aft.cgPct - E.fwd.cgPct) / Math.max(1e-9, E.aft.cgX - E.fwd.cgX);
        pct = E.fwd.cgPct + (sh.cgX - E.fwd.cgX) * k;
      }
      fillEl.textContent = f(r.litres, 0) + ' L aboard \u00b7 ' + f(sh.mass, 0) + ' kg \u00b7 CG ' +
        f(sh.cgX, 2) + ' m' + (pct != null ? ' (' + f(pct * 100, 0) + '% MAC)' : '') +
        ' \u00b7 static margin ' + f(sh.staticMargin, 2);
      fillEl.style.color = (sh.staticMargin != null && sh.staticMargin < 0.05) ? '#ff7b6b' : '';
    } else fillEl.textContent = '';
  }
  drawBar(E, sh ? sh.cgX : null);
  if (r.chart && chartEl && window.BALANCE) {
    try { window.BALANCE.draw(chartEl, r.chart); LAST_CHART = r.chart; }
    catch (e) { console.error('balance chart:', e); }
  }
}
// the rows in the panel and the build both ask the same way
function chartReadout() { readoutsRequest(); }
function fillReadout() { readoutsRequest(); }
function balanceReadout() { readoutsRequest(); }
function drawBar(E, cgX) {
  if (!barEl) return;
  barEl.innerHTML = '';
  if (!E || !E.fwd || !E.aft) { barEl.style.display = 'none'; return; }
  barEl.style.display = 'block';
  const lo = E.fwd.cgX, hi = E.aft.cgX, span = Math.max(1e-6, hi - lo);
  // the bar runs a little past both corners so a CG outside the envelope
  // still has somewhere to be drawn
  const pad = 0.15 * span, x0 = lo - pad, x1 = hi + pad;
  const at = x => Math.max(0, Math.min(100, (x - x0) / (x1 - x0) * 100));
  const mark = (x, col, w, t) => {
    const m = document.createElement('div');
    m.style.cssText = 'position:absolute;top:0;bottom:0;width:' + w + 'px;background:' + col +
      ';left:calc(' + at(x).toFixed(1) + '% - ' + (w / 2) + 'px)';
    m.title = t; barEl.appendChild(m);
  };
  mark(lo, '#dfe7f0', 2, 'forward corner \u00b7 ' + E.fwd.label);
  mark(hi, '#dfe7f0', 2, 'aft corner \u00b7 ' + E.aft.label);
  if (cgX != null) mark(cgX, '#ffd35a', 4, 'the CG at the fuel aboard');
}
function loadingTable() {
  if (!tableEl) return;
  const E = LAST_SHAKE && LAST_SHAKE.envelope;
  if (!E || !E.corners) { tableEl.textContent = ''; return; }
  const f = (v, d) => (v == null || !isFinite(v)) ? '\u2014' : v.toFixed(d);
  tableEl.innerHTML = '<div style="opacity:.7;margin-bottom:2px">loading table \u00b7 % MAC \u00b7 static margin</div>' +
    E.corners.map(c => '<div>' + c.label + ': ' + f(c.litres, 0) + ' L \u00b7 ' +
      f(c.mass, 0) + ' kg \u00b7 ' + (c.cgPct != null ? f(c.cgPct * 100, 0) + '%' : '\u2014') +
      ' \u00b7 ' + f(c.staticMargin, 2) + (c === E.worst ? ' \u2190 worst' : '') + '</div>').join('');
}

// ---------------------------------------------------------------------------
// THE PANEL
// ---------------------------------------------------------------------------
let panel = null, panelBody = null, selected = 0;
// VIEW STATE, not spec: how full the tanks are drawn and judged right now,
// and whether the selected bay's ghost is shown. Neither is a fact about the
// aeroplane, so neither is written to the build.
const VIEW = { fill: 1, showBay: 0, occupants: null, baggage: null };
const READ = [];              // per-vessel readout elements, rebuilt with the panel
let totalEl = null;

function mountPanel() {
  if (panel || !HAS_DOM) return;
  const ui = document.getElementById('cgUi') || document.getElementById('ui');
  if (!ui) return;
  panel = document.createElement('details');
  panel.dataset.g = 'energy';
  panel.open = true;
  panel.innerHTML = '<summary>fuel &amp; energy</summary>';
  panelBody = document.createElement('div');
  panel.appendChild(panelBody);
  const dec = ui.querySelector('details[data-g="decals"]');
  if (dec) ui.insertBefore(panel, dec); else ui.appendChild(panel);
}

// ---------------------------------------------------------------------------
// THE PART TREE'S DOOR (2026-09-05, the user: "I expect a fuel item in the
// tree, and the ability to select visually the reservoir")
// ---------------------------------------------------------------------------
// This panel has been mounted into `#cgUi` since G99 — the leftovers column,
// which the GAME hides (`opts-off`), so on the bench it was in plain sight and
// in the game it was in the DOM and nowhere on screen. The fix is not a second
// panel: `_cage_parts.js` declares a `Fuel & energy` part that names this
// global, and editor.js's column asks for the element and appends it, exactly
// as it does for the reference plane's root. One panel, two hosts, and the
// bench keeps the one it always had.
function panelElement() {
  if (!panel) mountPanel();
  if (panel && panelBody && !panelBody.firstChild) renderPanel();
  // ONE HEADING, NOT TWO. In `#cgUi` this panel's own summary IS its accordion
  // bar; in the inspector the column has already written the part's name above
  // it, with the fold, so the summary would be the same words again under
  // itself. Hidden here rather than by the editor because only this function
  // is ever called from there — the bench, which has no part tree, never asks
  // for the element and keeps the bar it has always had.
  if (panel) {
    const s = panel.querySelector(':scope > summary');
    if (s) { s.style.display = 'none'; panel.open = true; }
  }
  // INSIDE THE COLUMN'S OWN GRAMMAR (G191, the user: "revise the fuel
  // interface styling"). editor.css styles a panel-owned column through
  // `.edRoot` — the folds, their uppercase summaries, the row indent — and
  // this panel landed as a bare <details> the sheet never heard of: no box
  // round a tank, no indent, a summary in the wrong type. Handed over inside
  // an `.edRoot` it takes the reference plane's look; the panel's OWN outer
  // fold is flattened by the sheet (data-g="energy"), as the shed's is.
  if (panel && !panelWrap) {
    panelWrap = document.createElement('div');
    panelWrap.className = 'edRoot';
    panelWrap.dataset.panel = 'energy';
    panelWrap.appendChild(panel);
  }
  return panelWrap || panel;
}
let panelWrap = null;
// WHICH vessel, from a click on the solid itself. Returns whether it took —
// editor.js reads that to know the click MOVED within the part rather than
// landing on it a second time (which is its "step out to the parent" gesture,
// and stepping out of the tank you just clicked is not what you meant).
function selectVessel(i) {
  if (!(i >= 0 && i < EN.vessels.length)) return false;
  selected = i;
  relayout();                        // the bay ghost follows the selection
  if (panelBody) {
    for (const d of panelBody.querySelectorAll('details[data-ves]')) {
      const on = +d.dataset.ves === i;
      d.style.outline = on ? '1px solid rgba(255,211,90,.55)' : '';
      if (on) { d.open = true; if (d.scrollIntoView) d.scrollIntoView({ block: 'nearest' }); }
    }
  // ...AND IN THE FINISH COLUMN, which is a different element in a different
  // column and holds the same list (2026-09-05). Clicking the second tank on
  // the aeroplane while the finish tab is open must open the second tank's
  // colours, not leave you painting the first.
  if (lookBody)
    for (const d of lookBody.querySelectorAll('details[data-veslook]')) {
      const on = +d.dataset.veslook === i;
      d.style.outline = on ? '1px solid rgba(255,211,90,.55)' : '';
      if (on) { d.open = true; if (d.scrollIntoView) d.scrollIntoView({ block: 'nearest' }); }
    }
  }
  return true;
}

const el = (tag, cls, txt) => {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (txt != null) d.textContent = txt;
  return d;
};
function row(parent, label, title) {
  const d = el('div', 'r');
  const k = el('span', 'k', label); k.title = title || label;
  d.appendChild(k); parent.appendChild(d);
  return d;
}
function select(parent, label, title, options, value, onchange) {
  const d = row(parent, label, title);
  const s = document.createElement('select'); s.style.flex = '1';
  for (const [v, name, dis] of options) {
    const o = document.createElement('option');
    o.value = v; o.textContent = name; if (dis) o.disabled = true;
    if (v === String(value)) o.selected = true;
    s.appendChild(o);
  }
  s.onchange = () => onchange(s.value);
  d.appendChild(s);
  return s;
}
function range(parent, label, title, lo, hi, step, value, fmt, oninput, onchange) {
  const d = row(parent, label, title);
  const i = document.createElement('input');
  i.type = 'range'; i.min = lo; i.max = hi; i.step = step; i.value = value;
  i.style.flex = '1';
  const v = el('span', 'v', fmt(+value));
  i.oninput = () => { v.textContent = fmt(+i.value); oninput(+i.value); };
  i.onchange = () => { onchange(+i.value); };
  d.appendChild(i); d.appendChild(v);
  return { d, i, v };
}
const fmtL = x => x.toFixed(0) + ' ' + unit();
const fmtM = x => x.toFixed(2) + ' m';
const fmtF = x => (x * 100).toFixed(0) + ' %';
const fmtD = x => x.toFixed(0) + '°';

function bayOptions() {
  const out = [];
  for (const b of BAYS)
    out.push([b.key, b.name + ' · ' + (b.roomL || 0).toFixed(0) + ' L' +
      (b.feed === 'gravity' ? ' · gravity fed' : '')]);
  return out;
}

// ---------------------------------------------------------------------------
// THE LOOK, AND WHERE A LOOK BELONGS (2026-09-05, the user: "we need this
// wired into the livery UI. Click on tank -> finish -> choose the tank
// material and tint")
// ---------------------------------------------------------------------------
// Three rows that weigh nothing: the catalogue rows decide the mass and the
// price, these decide the surface. `finish` starts on whatever the vessel is
// actually made of, so a builder who never opens them still gets alloy on a
// welded tank and rubber on a bladder.
//
// They are SECTION-WIDE, like `vessel` beside them: one answer for every
// vessel the aeroplane carries, which is the shape `spec.energy` has had since
// G105 and what the heading in the finish view says out loud. A per-tank
// colour would be a new field on every list entry and a migration, and nobody
// has asked to paint two tanks differently.
//
// The tint well goes through `CAGE_RECENT.attach` — the same strip every
// livery well has (G156), opening on HOVER because a colour input opens the OS
// picker on the click. That is the whole reason these rows belong in the
// finish view rather than being copied into it: one well, one recent list.
let lookBody = null;
function lookRows(B, i, v) {
  const fk = finishOf(v);
  select(B, 'material', 'the surface this shell wears. It is a look and not a ' +
    'material: the vessel row (under structure) is what decides the weight ' +
    'and the price',
    Object.keys(FINISH).filter(k => k !== 'steel').map(k => [k, FINISH[k].name]),
    fk, x => { lookWrite(v, 'finish', x); renderLook(); relayout(); commit(); });
  if (FINISH[fk] && FINISH[fk].hue)
    range(B, 'paint hue', 'turns the painted sheet’s own colour right ' +
      'round. The scan is a single hue at one saturation, so this rotates ' +
      'the paint and nothing else', 0, 359, 1, hueOf(v),
      x => x.toFixed(0) + '°',
      x => { lookWrite(v, 'hue', x); relayout(); },
      x => { lookWrite(v, 'hue', x); commit(); });
  const d = row(B, 'tint', 'multiplies the sheet — white leaves it as ' +
    'scanned, and a colour darkens it towards that colour');
  const c = document.createElement('input');
  c.type = 'color';
  c.value = tintOf(v) ||
    '#' + ('000000' + (FINISH[fk] || FINISH.alu).col.toString(16)).slice(-6);
  c.style.flex = '1';
  c.oninput = () => { lookWrite(v, 'tint', c.value); relayout(); };
  c.onchange = () => { lookWrite(v, 'tint', c.value); commit(); };
  if (window.CAGE_RECENT && window.CAGE_RECENT.attach)
    window.CAGE_RECENT.attach(c);
  d.appendChild(c);
}
// ONE BLOCK PER TANK (2026-09-05, the user: "per tank colour please"). The
// same shape the structure column's list has — a fold per vessel, headed by
// what it is and where it sits — so the two columns are read the same way and
// a click on the solid opens the right one in whichever is on screen
// (`selectVessel`). The wrapper is there even for a single tank: adding a
// second one must not reshape the panel around the first.
function renderLook() {
  if (!lookBody) return;
  lookBody.innerHTML = '';
  EN.vessels.forEach((v, i) => {
    const bay = BAYS.find(b => b.key === v.bay);
    const det = document.createElement('details');
    det.open = true;
    det.dataset.veslook = i;
    if (i === selected) det.style.outline = '1px solid rgba(255,211,90,.55)';
    const sum = document.createElement('summary');
    sum.textContent = (EN.kind === 'battery' ? 'pack ' : 'tank ') + (i + 1) +
      (bay ? ' · ' + bay.name.toLowerCase() : '');
    sum.onclick = () => { selectVessel(i); };
    det.appendChild(sum);
    const box = document.createElement('div');
    det.appendChild(box);
    lookBody.appendChild(det);
    lookRows(box, i, v);
  });
}
// the finish view's door, the twin of `panelElement` above: editor.js's
// renderFinish asks the part's declared global for it and appends it under the
// part's own heading.
function lookElement() {
  if (!HAS_DOM) return null;
  if (!lookBody) {
    lookBody = document.createElement('div');
    // INSIDE THE COLUMN'S OWN GRAMMAR (G191): `.edRoot` is what editor.css
    // styles a panel-owned column with — the folds, their uppercase
    // summaries, the indent — so the tank folds read like every other part
    // instead of a bare <details> the sheet never heard of
    lookBody.className = 'edRoot';
    renderLook();
  }
  if (!lookBody.firstChild) renderLook();
  return lookBody;
}

function renderPanel() {
  if (!panelBody) return;
  const C = core();
  panelBody.innerHTML = '';
  READ.length = 0;
  const B = panelBody;

  // ---- what it runs on ----------------------------------------------------
  select(B, 'energy', 'liquid fuel burns off and moves the CG; a pack weighs ' +
    'the same full and flat', [['fuel', 'liquid fuel'], ['battery', 'battery']],
    EN.kind, v => {
      EN.kind = v === 'battery' ? 'battery' : 'fuel';
      EN.vessel = null;                 // the vessel follows the kind
      // a capacity in litres is not a capacity in kWh: start each vessel at a
      // sensible size for the new kind rather than carrying a number across
      for (const vs of EN.vessels) vs.capacity = EN.kind === 'battery' ? 8 : 45;
      renderPanel(); relayout(); commit();
    });
  const meds = EN.kind === 'battery'
    ? Object.keys(C.CELLS || {}).map(k => [k, (C.CELLS[k].name || k)])
    : Object.keys(C.FUELS || {}).map(k => [k, (C.FUELS[k].name || k)]);
  if (meds.length)
    select(B, EN.kind === 'battery' ? 'cells' : 'fuel', 'what the vessel holds',
      meds, medium(), v => {
        if (EN.kind === 'battery') EN.cell = v; else EN.fuel = v;
        relayout(); commit();
      });
  const want = EN.kind === 'battery' ? 'battery' : 'fuel';
  const ves = [['', 'the usual one']].concat(
    Object.keys(C.VESSELS || {}).filter(k => C.VESSELS[k].holds === want)
      .map(k => [k, C.VESSELS[k].name]));
  select(B, 'vessel', 'what the tank or the pack is made of — its shape, its ' +
    'weight per litre and its price', ves, EN.vessel || '', v => {
      EN.vessel = v || null; renderPanel(); relayout(); commit();
    });

  // ---- what it LOOKS like -------------------------------------------------
  // ONE BUILDER, TWO HOMES (2026-09-05). The look rows are built by
  // `renderLook` into their own element and borrowed from here ONLY on the
  // bench, which has no part tree and no finish tab: in the GAME they are the
  // finish view's, under the tank you clicked. Never both — an element has one
  // parent, and two colour wells for one fact is the drift G103 moved the
  // whole livery to avoid.
  if (!inGame()) B.appendChild(lookElement());

  // ---- each vessel --------------------------------------------------------
  EN.vessels.forEach((v, i) => {
    const bay = BAYS.find(b => b.key === v.bay) || BAYS[0];
    const det = document.createElement('details');
    det.open = true;
    det.style.marginLeft = '6px';
    // the entry a viewport click lands on (see `selectVessel`): the list is
    // rebuilt on every render, so the index rides on the element rather than
    // being remembered as a node
    det.dataset.ves = i;
    if (i === selected) det.style.outline = '1px solid rgba(255,211,90,.55)';
    const sum = document.createElement('summary');
    sum.textContent = (EN.kind === 'battery' ? 'pack ' : 'tank ') + (i + 1) +
      ' · ' + (bay ? bay.name.toLowerCase() : '?');
    sum.onclick = () => { selectVessel(i); };
    det.appendChild(sum);
    const box = document.createElement('div');
    det.appendChild(box);
    B.appendChild(det);

    select(box, 'bay', 'a predetermined place. The nose bay is the only one ' +
      'gravity can feed from; the wing bays relieve the spar', bayOptions(),
      v.bay, nb => {
        v.bay = nb; v.along = null; v.lv = null; v.rot = 0;
        selected = i; renderPanel(); relayout(); commit();
      });

    // ROUND OR SQUARED, and the litres follow. A wing tank is neither: it is
    // the box between the spars and the row is not offered there.
    if (bay && bay.on !== 'wing')
      select(box, 'shape', 'a squared shell with radiused corners, or a ' +
        'cylinder with domed ends. The drawn box is the same either way; a ' +
        'cylinder simply holds less of it, and the capacity says so',
        [['box', 'squared'], ['cyl', 'cylindrical']], formOf(v), nf => {
          v.form = nf === 'cyl' ? 'cyl' : 'box';
          if (v.dims) v.capacity = capacityFromDims(v.dims, formOf(v));
          selected = i; renderPanel(); relayout(); commit();
        });

    // capacity: as much as the bay can take, less the vessel's own ullage
    const room = bay ? (bay.roomL || 0) : 0;
    let capMax;
    if (EN.kind === 'battery') {
      const cell = (C.CELLS || {})[EN.cell] || { WhL: 250, packK: 0.7 };
      capMax = Math.max(1, Math.floor(room / 1.18 * (cell.WhL * cell.packK) / 1000));
    } else capMax = Math.max(1, Math.floor(room / 1.06));
    range(box, 'capacity', 'what it holds. The top of the slider is what the ' +
      'bay can take; the readout says whether the SHAPE fits. Moving this ' +
      'gives the vessel its catalogue shape again', 1,
      Math.max(capMax, 1), 1, Math.min(v.capacity, Math.max(capMax, 1)), fmtL,
      x => { v.capacity = x; v.dims = null; relayout(); },
      x => { v.capacity = x; v.dims = null; commit(); });
    // THE GEOMETRY IS THE PLAYER'S, AND THE CAPACITY FOLLOWS IT. Three rows
    // for the box; the first touch copies the catalogue shape so the sliders
    // start from what is drawn, and from then on the litres are calculated.
    if (bay && bay.on !== 'wing') {
      const cur = () => v.dims || (LAST.results[i] && LAST.results[i].dims) ||
        { L: 0.5, W: 0.35, H: 0.25 };
      const sizeRow = (label, key, hi, title) => range(box, label, title, 0.08, hi, 0.01,
        cur()[key], fmtM,
        x => { const d = cur(); v.dims = { L: d.L, W: d.W, H: d.H }; v.dims[key] = x;
               relayout(); syncCap(); },
        x => { const d = cur(); v.dims = { L: d.L, W: d.W, H: d.H }; v.dims[key] = x;
               commit(); });
      const secW = LAST.results[i] && LAST.results[i].section
        ? Math.max(0.3, LAST.results[i].section.xHi - LAST.results[i].section.xLo) : 1.2;
      sizeRow('length', 'L', Math.max(0.4, bay.x1 - bay.x0), 'along the body');
      sizeRow('width', 'W', secW, 'across the body');
      sizeRow('height', 'H', 1.0, 'up');
    }

    if (bay && bay.on === 'wing') {
      // LABELS ARE THE TRUNK'S WORDS (G191, HANDOVER "LABEL CONVENTIONS"):
      // a row that is a fore/aft or an up/down says so, the domain word in
      // brackets where the plain word would be ambiguous
      range(box, 'in / out (span)', 'where the tank STARTS, as a fraction of the ' +
        'semispan; it runs outboard from here until it holds its litres',
        bay.span[0], bay.span[1], 0.01,
        v.along != null ? v.along : bay.span[0], fmtF,
        x => { v.along = x; relayout(); }, x => { v.along = x; commit(); });
    } else if (bay) {
      const dflt = 0.5 * (bay.x0 + bay.x1);
      range(box, 'fore / aft', 'metres aft of the firewall — the bay runs ' +
        bay.x0.toFixed(2) + ' to ' + bay.x1.toFixed(2) + ' m', bay.x0, bay.x1,
        0.01, v.along != null ? v.along : dflt, fmtM,
        x => { v.along = x; relayout(); }, x => { v.along = x; commit(); });
      const lvB = bay.lv || [0, 1];
      range(box, 'up / down', 'keel to crown, within the bay’s own band', lvB[0],
        lvB[1], 0.01, v.lv != null ? v.lv : 0.5 * (lvB[0] + lvB[1]), fmtF,
        x => { v.lv = x; relayout(); }, x => { v.lv = x; commit(); });
      range(box, 'turn (yaw)', 'about the vertical: a long tank across a wide bay, ' +
        'or along a narrow one', -90, 90, 1, v.rot || 0, fmtD,
        x => { v.rot = x; relayout(); }, x => { v.rot = x; commit(); });
    }
    const rd = el('div', 'r');
    rd.style.cssText = 'font-size:11px;opacity:.9;white-space:normal;line-height:1.3';
    box.appendChild(rd);
    READ[i] = rd;

    if (EN.vessels.length > 1) {
      const rm = row(box, '', '');
      const b = document.createElement('button');
      b.textContent = 'remove this ' + (EN.kind === 'battery' ? 'pack' : 'tank');
      b.style.flex = '1';
      b.onclick = () => { EN.vessels.splice(i, 1); selected = 0;
        renderPanel(); relayout(); commit(); };
      rm.appendChild(b);
    }
  });

  // ---- add one --------------------------------------------------------------
  {
    const r = row(B, '', '');
    const b = document.createElement('button');
    b.textContent = '+ add a ' + (EN.kind === 'battery' ? 'pack' : 'tank');
    b.style.flex = '1';
    b.title = 'two tanks bracketing the CG barely move it as they burn — ' +
      'which is why real aeroplanes carry two';
    b.onclick = () => {
      // the first bay with room that is not already taken, else the nose
      const used = new Set(EN.vessels.map(x => x.bay));
      const free = BAYS.find(x => !used.has(x.key) && x.roomL > 20) || BAYS[0];
      EN.vessels.push({ bay: free ? free.key : 'nose',
        capacity: EN.kind === 'battery' ? 6 : 30, along: null, lv: null, rot: 0,
        form: 'box' });
      selected = EN.vessels.length - 1;
      renderPanel(); relayout(); commit();
    };
    r.appendChild(b);
  }
  {
    const d = row(B, 'show bay', 'a translucent box of the selected bay\u2019s ' +
      'extents \u2014 a guide for dragging a tank to its edge');
    const c = document.createElement('input');
    c.type = 'checkbox'; c.checked = !!VIEW.showBay;
    c.onchange = () => { VIEW.showBay = c.checked ? 1 : 0; relayout(); };
    d.appendChild(c);
  }
  totalEl = el('div', 'r');
  totalEl.style.cssText = 'font-size:11px;opacity:.85;white-space:normal;line-height:1.3';
  B.appendChild(totalEl);
  // ---- G100: THE CG AS A FUNCTION OF FILL --------------------------------
  // The user, at the start of the arc: "we need to see how the CG is
  // changing with the amount of fuel (through a slider)". The slider drains
  // every tank in proportion through the core's own genSpecAtFuel — the
  // reserve sheet's and the envelope's door — and the numbers are the
  // core's shakedown of that aeroplane, not a second estimate.
  if (EN.kind !== 'battery') {
    const fmtPct = x => (x * 100).toFixed(0) + ' %';
    range(B, 'fuel aboard', 'how full every tank is, drawn and weighed; the ' +
      'balance line below follows it', 0, 1, 0.01, VIEW.fill, fmtPct,
      x => { VIEW.fill = x; relayout(); },
      x => { VIEW.fill = x; relayout(); fillReadout(); });
  }
  fillEl = el('div', 'r');
  fillEl.style.cssText = 'font-size:11px;white-space:normal;line-height:1.3';
  B.appendChild(fillEl);
  barEl = el('div', 'r');
  barEl.style.cssText = 'display:block;height:14px;position:relative;margin:2px 0 4px 0;' +
    'background:linear-gradient(90deg,#2c4a6e,#3b6f4a);border-radius:3px;opacity:.95';
  barEl.title = 'the CG envelope: forward corner to aft corner, in % MAC; the ' +
    'marker is the CG at the fuel aboard';
  B.appendChild(barEl);
  // ---- G101: THE BALANCE CHART, with the loading as what-ifs ---------------
  // Occupants and baggage here are VIEW state: the loading you want to SEE
  // the aeroplane at, not the loading the build carries (that is the crew
  // layer's dummies and the spec's own baggage). Every point on the chart is
  // the core's shakedown over genSpecAtFuel — the same door as the reserve
  // sheet, the corners and the slider above.
  if (inGame() && window.BALANCE) {
    const S0 = (() => { try { return window.GARAGE_SPEC.resolved(); } catch (e) { return null; } })();
    const seats = Math.max(1, (S0 && S0.seats) | 0);
    if (VIEW.occupants == null) VIEW.occupants = Math.max(1, Math.min(seats, (S0 && S0.occupants) || 1));
    if (VIEW.baggage == null) VIEW.baggage = (S0 && S0.cabin && S0.cabin.baggage) || 0;
    const fmtN = x => x.toFixed(0);
    const fmtKg = x => x.toFixed(0) + ' kg';
    range(B, 'occupants', 'how many people the chart is drawn for (the pilot ' +
      'and the seats behind, front to back)', 1, seats, 1, VIEW.occupants, fmtN,
      x => { VIEW.occupants = x; }, x => { VIEW.occupants = x; chartReadout(); });
    range(B, 'baggage', 'kilograms in the baggage bay for the chart', 0, 60, 1,
      VIEW.baggage, fmtKg, x => { VIEW.baggage = x; }, x => { VIEW.baggage = x; chartReadout(); });
    chartEl = document.createElement('canvas');
    chartEl.style.cssText = 'display:block;width:100%;height:170px;margin:2px 0 4px 0;' +
      'background:rgba(0,0,0,.18);border-radius:3px';
    chartEl.title = 'weight and balance: CG across (% of the mean chord), mass up. ' +
      'The blue line is the CG walking as the fuel burns at this loading, full ' +
      'to dry, the hollow point at reserves; the yellow dot is the fuel aboard; ' +
      'the circles are the four loading corners; NEUTRAL is where the static ' +
      'margin reaches zero and CAUTION 5% of the chord ahead of it. No forward ' +
      'limit is drawn: the model has no elevator-authority rule to place one.';
    B.appendChild(chartEl);
  }
  tableEl = el('div', 'r');
  tableEl.style.cssText = 'display:block;font-size:11px;white-space:normal;line-height:1.35;opacity:.9';
  B.appendChild(tableEl);
  if (inGame()) {
    balEl = el('div', 'r');
    balEl.style.cssText = 'font-size:11px;white-space:normal;line-height:1.3';
    balEl.title = 'the core’s own shakedown over the spec as committed — the ' +
      'same ledger the flight weighs itself with';
    B.appendChild(balEl);
    watchReadouts(balEl);
    scheduleReadouts();
  }
  syncReadouts();
  // THE OTHER COLUMN HOLDS THE SAME LIST (2026-09-05). Every path that
  // rebuilds this panel has moved, added or removed a vessel, or changed what
  // the untouched ones inherit — and the look rows are one block per vessel,
  // headed by the bay it sits in. Rebuilt from here rather than from each of
  // the six handlers, which is six chances to forget the seventh.
  if (lookBody) renderLook();
}

// the capacity row follows a drawn box without a panel rebuild
function syncCap() {
  if (!panelBody) return;
  const rows = [...panelBody.querySelectorAll('.r')];
  let vi = -1;
  for (const r of rows) {
    const k = r.querySelector('.k');
    if (!k) continue;
    if (/^capacity$/.test(k.textContent.trim())) {
      vi++;
      const v = EN.vessels[vi], inp = r.querySelector('input'), val = r.querySelector('.v');
      if (v && inp && val) { inp.value = v.capacity; val.textContent = fmtL(v.capacity); }
    }
  }
}
function syncReadouts() {
  const rs = LAST.results || [];
  let totCap = 0, totKg = 0, totVes = 0, price = 0;
  rs.forEach((r, i) => {
    const d = READ[i];
    totCap += r.v.capacity; totKg += r.res.contentsKg; totVes += r.res.vesselKg;
    price += r.res.price;
    if (!d) return;
    const bits = [];
    bits.push('needs ' + r.needL.toFixed(0) + ' of ' + (r.roomL || 0).toFixed(0) + ' L');
    if (r.on === 'body' && r.clear != null && isFinite(r.clear))
      bits.push((r.clear * 1000).toFixed(0) + ' mm to the skin');
    if (r.on === 'wing' && r.spanM != null)
      bits.push(r.spanM.toFixed(2) + ' m of span each side');
    bits.push(r.res.vesselKg.toFixed(1) + ' kg ' + (EN.kind === 'battery' ? 'case + cells' : 'tank') +
      (EN.kind === 'battery' ? '' : ' + ' + r.res.contentsKg.toFixed(1) + ' kg fuel'));
    if (r.on === 'body' && !r.crewHits) bits.push('clears the crew');
    if (r.v.shaped) bits.push('shaped to the bay' +
      (r.v.shaped === 'crew' ? ', height capped above the crew'
       : r.v.shaped === 'band' ? ', height capped by the bay' : ''));
    d.textContent = (r.ok ? '✓ fits · ' : '✗ ') + bits.join(' · ') +
      (r.ok ? '' : ' — ' + r.why.join('; '));
    d.style.color = r.ok ? '' : '#ff7b6b';
  });
  if (totalEl)
    totalEl.textContent = 'total ' + totCap.toFixed(0) + ' ' + unit() + ' · ' +
      (EN.kind === 'battery'
        ? (totKg + totVes).toFixed(0) + ' kg of pack, empty weight'
        : totKg.toFixed(0) + ' kg of fuel + ' + totVes.toFixed(1) + ' kg of tank') +
      ' · ' + price.toFixed(0) + ' cr';
}

window.CAGE_ENERGY = {
  EN, fromSpec, toSpec, relayout, commit, setEnv: vesselSetEnv,
  // the flown aeroplane's door into the factory (app.js matFor, `m.ves`)
  material: vesselMatFor,
  // the two columns' doors: structure gets the whole panel, finish gets the
  // look rows (_cage_parts.js `panel` / `panelFinish`)
  panelFinish: lookElement,
  results: () => LAST.results, bays: () => BAYS,
  chart: () => LAST_CHART, view: VIEW,
  // the slim balance job's state, for the probe page and the gates
  balance: () => ({ last: LAST_BAL, seq: balSeq, seen: balSeen, err: balErr, hooked: commitHooked,
                    worker: !!readWorker, workerDead: readWorkerDead }),
  balanceRequest,
  // the part tree's two doors: the column asks for the panel, a viewport
  // click asks for one vessel of the list
  panel: panelElement,
  select: selectVessel,
};
})();
