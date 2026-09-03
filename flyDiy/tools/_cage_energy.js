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
      try {
        // the bay's limits are axis metres; the profile is indexed by the
        // field's sL, so they go through the same table the placement uses
        let s0 = r.x0 / FS, s1 = r.x1 / FS;
        const zFw = VG() && VG().firewallZ ? VG().firewallZ(ctx.spec, CG2()) : null;
        if (zFw != null && VG().sLTable) {
          const T = VG().sLTable(ctx.mesh, FS, s0 - 0.35 / FS, s1 + 0.1 / FS, 18);
          const a = VG().sLOfZ(T, zFw - s0), b2 = VG().sLOfZ(T, zFw - s1);
          if (a != null && b2 != null) { s0 = Math.min(a, b2); s1 = Math.max(a, b2); }
        }
        const prof = BAY().bayProfile(ctx.mesh, s0, s1, 0.035 / FS, 12);
        const lv = r.lv || [0, 1];
        r.litresField = BAY().bayVolume(prof) * (lv[1] - lv[0]) * FS * FS * FS * 1000;
      } catch (e) { r.litresField = null; }
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
let BAY_CACHES = {};          // the swept bays of the CURRENT cage build

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
  // ONE SWEEP PER BAY PER BUILD, not per layout: a drag moves the tank and
  // nothing else, so the body it is fitted against is the one already
  // swept. Measured: 744 ms per slider tick with the sweep inside the
  // layout, a few ms with it hoisted. PAGE.post empties the map when the
  // cage rebuilds, which is the only time the body changes.
  const cacheOf = bay => {
    if (bay.on !== 'body') return null;
    if (!(bay.key in BAY_CACHES)) {
      const c = G.bayCache ? G.bayCache(ctx.mesh, FS, bay, 0.035, zFw, 0.7) : null;
      // THE BAY IS CLAMPED TO THE BODY THE FIELD DESCRIBES. The rule's front
      // limit is a measured deck length; where the field stops describing
      // the deck (the firewall face) the bay stops too, so a default and a
      // slider both start at a station a tank can actually be at.
      if (c && c.axisMin != null && c.axisMin > bay.x0) bay.x0 = c.axisMin + 0.01;
      if (c && c.axisMax != null && c.axisMax < bay.x1) bay.x1 = c.axisMax - 0.01;
      BAY_CACHES[bay.key] = c;
    }
    return BAY_CACHES[bay.key];
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
  BAY_CACHES = {};              // a new body: every bay is swept afresh
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
let commitT = null;
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
  if (commitT) clearTimeout(commitT);
  commitT = setTimeout(balanceReadout, 250);
}

// WHAT IT DOES TO THE AEROPLANE, in numbers — the core's own shakedown over
// the spec as just committed. This is the "CG with full or empty tank at
// conception" the user asked for, read live off the same ledger the flight
// weighs itself with, not a second estimate.
let balEl = null, fillEl = null, barEl = null, tableEl = null;
let LAST_SHAKE = null;
// the aeroplane at the slider's fill, weighed by the core; and the envelope's
// four corners as a loading table with the bar between them
let fillT = null;
function fillReadout() {
  if (!inGame() || !fillEl) return;
  if (fillT) clearTimeout(fillT);
  fillT = setTimeout(() => {
    fillT = null;
    try {
      if (typeof buildGen !== 'function' || typeof genShakedown !== 'function' ||
          typeof genSpecAtFuel !== 'function' || !window.GARAGE_SPEC) return;
      const S0 = window.GARAGE_SPEC.resolved && window.GARAGE_SPEC.resolved();
      if (!S0 || !S0.fuel) return;
      const full = S0.fuel.litres;
      const L = full * Math.min(1, Math.max(0, VIEW.fill));
      const sh = genShakedown(buildGen(genSpecAtFuel(S0, L)), { slim: true });
      const E = LAST_SHAKE && LAST_SHAKE.envelope;
      const f = (v, d) => (v == null || !isFinite(v)) ? '\u2014' : v.toFixed(d);
      let pct = null;
      if (E && E.fwd && E.aft && E.fwd.cgPct != null && E.fwd.cgX != null) {
        // the envelope's own % MAC scale: two points define it
        const k = (E.aft.cgPct - E.fwd.cgPct) / Math.max(1e-9, E.aft.cgX - E.fwd.cgX);
        pct = E.fwd.cgPct + (sh.cgX - E.fwd.cgX) * k;
      }
      fillEl.textContent = f(L, 0) + ' L aboard \u00b7 ' + f(sh.mass, 0) + ' kg \u00b7 CG ' +
        f(sh.cgX, 2) + ' m' + (pct != null ? ' (' + f(pct * 100, 0) + '% MAC)' : '') +
        ' \u00b7 static margin ' + f(sh.staticMargin, 2);
      fillEl.style.color = (sh.staticMargin != null && sh.staticMargin < 0.05) ? '#ff7b6b' : '';
      drawBar(E, sh.cgX);
    } catch (e) { fillEl.textContent = ''; }
  }, 150);
}
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
function balanceReadout() {
  if (!balEl || !inGame()) return;
  if (typeof buildGen !== 'function' || typeof genShakedown !== 'function' ||
      !window.GARAGE_SPEC) { balEl.textContent = ''; return; }
  try {
    const s = genShakedown(buildGen(window.GARAGE_SPEC.get()), {});
    LAST_SHAKE = s;
    loadingTable();
    fillReadout();
    const f = (v, d) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d);
    let t = 'all-up ' + f(s.mass, 0) + ' kg · CG ' + f(s.cgX, 2) + ' m · static margin ' +
      f(s.staticMargin, 2);
    if (s.reserve) t += ' · at reserves ' + f(s.reserve.staticMargin, 2) +
      ' (' + f(s.reserve.mass, 0) + ' kg)';
    const bad = (s.vessels || []).filter(v => !v.fits).length;
    if (bad) t += ' · ' + bad + ' vessel' + (bad > 1 ? 's' : '') + ' the ledger cannot fit';
    balEl.textContent = t;
    balEl.style.color = (s.staticMargin != null && s.staticMargin < 0.05) ? '#ff7b6b' : '';
  } catch (e) { balEl.textContent = ''; }
}

// ---------------------------------------------------------------------------
// THE PANEL
// ---------------------------------------------------------------------------
let panel = null, panelBody = null, selected = 0;
// VIEW STATE, not spec: how full the tanks are drawn and judged right now,
// and whether the selected bay's ghost is shown. Neither is a fact about the
// aeroplane, so neither is written to the build.
const VIEW = { fill: 1, showBay: 0 };
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
  tableEl = el('div', 'r');
  tableEl.style.cssText = 'display:block;font-size:11px;white-space:normal;line-height:1.35;opacity:.9';
  B.appendChild(tableEl);
  if (inGame()) {
    balEl = el('div', 'r');
    balEl.style.cssText = 'font-size:11px;white-space:normal;line-height:1.3';
    balEl.title = 'the core’s own shakedown over the spec as committed — the ' +
      'same ledger the flight weighs itself with';
    B.appendChild(balEl);
    if (commitT) clearTimeout(commitT);
    commitT = setTimeout(balanceReadout, 50);
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
  select: i => { selected = i; relayout(); },
};
})();
