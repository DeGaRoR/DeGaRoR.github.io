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
const EN = { kind: 'fuel', fuel: 'avgas100LL', cell: 'lifepo4', vessel: null,
             vessels: [] };
let seeded = false;
const cl = o => JSON.parse(JSON.stringify(o));

// what an aeroplane with nothing written carries: the core's own default,
// the Cub's twelve gallons behind the firewall
const defaultVessels = () => [{ bay: 'nose', capacity: 45, along: null,
                                lv: null, rot: 0, dims: null }];

function fromSpec(energy) {
  const E = energy || {};
  EN.kind = E.kind === 'battery' ? 'battery' : 'fuel';
  EN.fuel = E.fuel || 'avgas100LL';
  EN.cell = E.cell || 'lifepo4';
  EN.vessel = E.vessel || null;
  EN.vessels = Array.isArray(E.vessels) && E.vessels.length
    ? E.vessels.map(v => ({ bay: v.bay || 'nose', capacity: +v.capacity || 0,
        along: v.along == null ? null : +v.along,
        lv: v.lv == null ? null : +v.lv, rot: +v.rot || 0,
        // the player's own box, when they drew one
        dims: (v.dims && v.dims.L > 0) ? { L: +v.dims.L, W: +v.dims.W, H: +v.dims.H } : null }))
    : defaultVessels();
  seeded = true;
  savePrefs();
  if (panelBody) renderPanel();
}
// the spec's shape and nothing else: capacity and kWh are READINGS the core
// derives from this list, so they are not written back
function toSpec() {
  return { kind: EN.kind, fuel: EN.fuel, cell: EN.cell, vessel: EN.vessel,
           vessels: EN.vessels.map(v => ({ bay: v.bay, capacity: v.capacity,
             along: v.along, lv: v.lv, rot: v.rot,
             dims: v.dims ? { L: v.dims.L, W: v.dims.W, H: v.dims.H } : null })) };
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
// installed litres of a drawn box -> the capacity unit the spec stores
function capacityFromDims(dims) {
  const G = VG(), C = core();
  if (!G || !G.installedFromDims) return 0;
  const inst = G.installedFromDims(vesselKey(), dims);
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
function wingSlicer(ctx, inv) {
  const W = window.CAGE_WING;
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
  const wing = spec && (spec.wing || (spec.wings || [])[0]) || {};
  const yAnchor = (W.anchor && W.anchor.yAnchor != null) ? W.anchor.yAnchor : null;
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
  // the datum the ledger bills against, read off this cage's own rings
  const zFw = G.firewallZ ? G.firewallZ(ctx.spec, CG2()) : null;
  for (const v of EN.vessels) {
    const bay = BAYS.find(b => b.key === v.bay) || BAYS.find(b => b.on === 'body');
    if (!bay) continue;
    // THE PLAYER'S BOX SETS THE CAPACITY. A vessel with its own dims has its
    // litres derived from them (installed volume, less the shell's rounding,
    // back through the same ullage factor genVesselResolve applies), so the
    // ledger bills what the drawn box holds and nothing else.
    if (v.dims) v.capacity = capacityFromDims(v.dims);
    const res = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel',
                                v.capacity, vesselKey(), medium());
    let dims = G.vesselDims(vesselKey(), res.installedL, v.dims);
    let pl;
    if (bay.on === 'wing') {
      pl = (slice && semi > 0)
        ? G.wingPlace(semi, bay, v, res.installedL, slice, C.RULES || {}, bay.litres)
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
            v.capacity = capacityFromDims(v.dims);
            v.shaped = bf.crew ? 'crew' : (bf.capped ? 'band' : true);
            const res2 = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel',
                                         v.capacity, vesselKey(), medium());
            dims = G.vesselDims(vesselKey(), res2.installedL, v.dims);
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
// DRAWING
// ---------------------------------------------------------------------------
// The catalogue's own looks. Plain materials, like the light layer's lodge and
// seal: a tank is not skin and takes no livery, and the materials panel's
// `aeroskin` flag keeps it from being handed the grey understudy.
const LOOK = {
  alu:      { col: 0xb9c0c6, rough: 0.35, metal: 0.85 },
  moulded:  { col: 0xe9e4d4, rough: 0.55, metal: 0.00, opacity: 0.88 },
  bladder:  { col: 0x2b2b2e, rough: 0.90, metal: 0.00 },
  packCase: { col: 0x2f3338, rough: 0.55, metal: 0.30 },
  wet:      { col: 0x4a8fd6, rough: 0.30, metal: 0.10, opacity: 0.40 },
};
const mats = {};
function matFor(key, bad) {
  const id = key + (bad ? '!' : '');
  if (mats[id]) return mats[id];
  const L = LOOK[key] || LOOK.alu;
  const m = new THREE.MeshStandardMaterial({
    color: L.col, roughness: L.rough, metalness: L.metal,
    transparent: L.opacity != null, opacity: L.opacity != null ? L.opacity : 1,
    emissive: bad ? new THREE.Color(0xff2a1a) : new THREE.Color(0x000000),
    emissiveIntensity: bad ? 0.45 : 0,
    side: THREE.DoubleSide });
  m.userData.aeroskin = 1;
  return (mats[id] = m);
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

function drawResults(group, ctx, results) {
  const K = window.GEAR_KIT;
  if (!K) return;
  for (const r of results) {
    const bad = !r.ok;
    if (r.on === 'body' && r.c) {
      const bag = K.Bag();
      const cs = Math.cos(r.rot), sn = Math.sin(r.rot);
      K.boxIn(bag, r.c, r.e, [cs, 0, -sn], [0, 1, 0], [sn, 0, cs]);
      const m = bag.mesh(group, matFor(vesselKey(), bad));
      if (m) m.name = 'edVessel_' + EN.vessels.indexOf(r.v);
    } else if (r.on === 'wing' && r.sides) {
      for (const s of r.sides) {
        const bag = K.Bag();
        const y0 = s.y - s.d / 2, y1 = s.y + s.d / 2;
        const p = [
          bag.v([s.x0, y0, s.zR0]), bag.v([s.x0, y0, s.zF0]),
          bag.v([s.x0, y1, s.zF0]), bag.v([s.x0, y1, s.zR0]),
          bag.v([s.x1, y0, s.zR1]), bag.v([s.x1, y0, s.zF1]),
          bag.v([s.x1, y1, s.zF1]), bag.v([s.x1, y1, s.zR1]),
        ];
        const q = (a, b, c, d) => bag.quad(p[a], p[b], p[c], p[d]);
        q(0, 1, 2, 3); q(4, 7, 6, 5); q(0, 4, 5, 1);
        q(1, 5, 6, 2); q(2, 6, 7, 3); q(3, 7, 4, 0);
        const m = bag.mesh(group, matFor(vesselKey() === 'wet' ? 'wet' : vesselKey(), bad));
        if (m) m.name = 'edVessel_' + EN.vessels.indexOf(r.v) + (s.sign > 0 ? 'R' : 'L');
      }
    }
  }
  // THE FUEL INSIDE THE TANK, at the slider's fill: a second box inset in
  // each liquid vessel, its height the fill fraction of the vessel's — so the
  // slider is something you can SEE, and a pack, which does not drain, is
  // drawn full and unchanging. Wing tanks fill from their floor too.
  if (EN.kind !== 'battery' && VIEW.fill > 0.02) {
    const f = Math.min(1, VIEW.fill), inset = 0.008;
    for (const r of results) {
      if (r.on === 'body' && r.c) {
        const bag = K.Bag();
        const cs = Math.cos(r.rot), sn = Math.sin(r.rot);
        const h = Math.max(0.004, (r.e[1] - inset) * 2 * f);
        const c = [r.c[0], r.c[1] - r.e[1] + inset + h / 2, r.c[2]];
        K.boxIn(bag, c, [r.e[0] - inset, h / 2, r.e[2] - inset],
                [cs, 0, -sn], [0, 1, 0], [sn, 0, cs]);
        const m = bag.mesh(group, fuelMat());
        if (m) m.name = 'edFuel_' + EN.vessels.indexOf(r.v);
      } else if (r.on === 'wing' && r.sides) {
        for (const s of r.sides) {
          const bag = K.Bag();
          const y0 = s.y - s.d / 2 + inset, y1 = y0 + Math.max(0.004, (s.d - 2 * inset) * f);
          const x0 = s.x0 + (s.x1 > s.x0 ? inset : -inset), x1 = s.x1 - (s.x1 > s.x0 ? inset : -inset);
          const p = [
            bag.v([x0, y0, s.zR0 + inset]), bag.v([x0, y0, s.zF0 - inset]),
            bag.v([x0, y1, s.zF0 - inset]), bag.v([x0, y1, s.zR0 + inset]),
            bag.v([x1, y0, s.zR1 + inset]), bag.v([x1, y0, s.zF1 - inset]),
            bag.v([x1, y1, s.zF1 - inset]), bag.v([x1, y1, s.zR1 + inset]),
          ];
          const q = (a, b, c, d) => bag.quad(p[a], p[b], p[c], p[d]);
          q(0, 1, 2, 3); q(4, 7, 6, 5); q(0, 4, 5, 1);
          q(1, 5, 6, 2); q(2, 6, 7, 3); q(3, 7, 4, 0);
          const m = bag.mesh(group, fuelMat());
          if (m) m.name = 'edFuel_' + EN.vessels.indexOf(r.v) + (s.sign > 0 ? 'R' : 'L');
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
      'self.onmessage = e => { const job = e.data; try { const r = compute(job, CORE, BAL); r.seq = job.seq; postMessage(r); }' +
      ' catch (err) { postMessage({ seq: job.seq, error: String(err && err.stack || err) }); } };\n';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = e => {
      const r = e.data;
      if (!r || r.seq !== readSeq) return;        // an older aeroplane's answer
      if (r.error) {
        console.warn('energy readouts: the worker could not compute, reading on the page instead —', r.error);
        readWorkerDead = true; readWorker = null;
        try { w.terminate(); } catch (e2) {}
        readoutsNow();
        return;
      }
      applyReadouts(r);
    };
    w.onerror = err => {
      console.warn('energy readouts: the worker failed, reading on the page instead —', err && err.message);
      readWorkerDead = true; readWorker = null;
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

  // ---- each vessel --------------------------------------------------------
  EN.vessels.forEach((v, i) => {
    const bay = BAYS.find(b => b.key === v.bay) || BAYS[0];
    const det = document.createElement('details');
    det.open = true;
    det.style.marginLeft = '6px';
    const sum = document.createElement('summary');
    sum.textContent = (EN.kind === 'battery' ? 'pack ' : 'tank ') + (i + 1) +
      ' · ' + (bay ? bay.name.toLowerCase() : '?');
    sum.onclick = () => { selected = i; relayout(); };
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
      range(box, 'station', 'where the tank STARTS, as a fraction of the ' +
        'semispan; it runs outboard from here until it holds its litres',
        bay.span[0], bay.span[1], 0.01,
        v.along != null ? v.along : bay.span[0], fmtF,
        x => { v.along = x; relayout(); }, x => { v.along = x; commit(); });
    } else if (bay) {
      const dflt = 0.5 * (bay.x0 + bay.x1);
      range(box, 'station', 'metres aft of the firewall — the bay runs ' +
        bay.x0.toFixed(2) + ' to ' + bay.x1.toFixed(2) + ' m', bay.x0, bay.x1,
        0.01, v.along != null ? v.along : dflt, fmtM,
        x => { v.along = x; relayout(); }, x => { v.along = x; commit(); });
      const lvB = bay.lv || [0, 1];
      range(box, 'level', 'keel to crown, within the bay’s own band', lvB[0],
        lvB[1], 0.01, v.lv != null ? v.lv : 0.5 * (lvB[0] + lvB[1]), fmtF,
        x => { v.lv = x; relayout(); }, x => { v.lv = x; commit(); });
      range(box, 'turn', 'about the vertical — a long tank across a wide bay, ' +
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
        capacity: EN.kind === 'battery' ? 6 : 30, along: null, lv: null, rot: 0 });
      selected = EN.vessels.length - 1;
      renderPanel(); relayout(); commit();
    };
    r.appendChild(b);
  }
  {
    const d = row(B, 'show the bay', 'a translucent box of the selected bay\u2019s ' +
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
  EN, fromSpec, toSpec, relayout, commit,
  results: () => LAST.results, bays: () => BAYS,
  chart: () => LAST_CHART, view: VIEW,
  select: i => { selected = i; relayout(); },
};
})();
