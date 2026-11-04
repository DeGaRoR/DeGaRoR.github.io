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

// TANK-FIT: the file's own binding for Math (and the typed arrays). Under node's vm (every gate, every headless
// tool) a global name is looked up through the context's interceptor on each use, and the clearance's loops say
// Math.floor a million times a rebuild: ugly_bi's surface index read 160 ms there and 30 ms out of it. One lookup
// here; the same objects, so nothing else changes.
const GL_ = typeof globalThis !== 'undefined' ? globalThis : window;      // (GATE PARTS loads this under a stub window)
const Math = window.Math || GL_.Math, Float64Array = window.Float64Array || GL_.Float64Array,
      Int32Array = window.Int32Array || GL_.Int32Array, Uint16Array = window.Uint16Array || GL_.Uint16Array;
const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const HAS_DOM = typeof document !== 'undefined';
const inGame = () => !!window.CAGE_IN_GAME;
const VG = () => window.VESSEL_GEN;
const BAY = () => window.BAY_SITE;
const CG2 = () => window.CAGE2;
const msNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

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

// THE LIST THE PHYSICS FLIES (G1109). Most stock cards state their fuel as
// `fuel.litres` (+ `fuel.tank`) and carry an EMPTY vessel list; the core lifts
// that into vessels when it resolves the spec (genEnergyLift: the Caravan's
// 1257 L into its wing roots). This seeded its own default instead - one 45 L
// nose tank - and in the game WROTE IT BACK on the first layout, so the drawn
// tank was not the physics' tank and, once committed, the physics flew a nose
// tank the design never had. Handed the whole spec, an empty list takes the
// resolved spec's lifted list: the same rule, one keeper.
function liftedVessels(spec) {
  try {
    if (!spec || typeof resolveSpec !== 'function') return null;
    const S = resolveSpec(JSON.parse(JSON.stringify(spec))).spec;
    const v = S && S.energy && S.energy.vessels;
    return Array.isArray(v) && v.length ? v : null;
  } catch (e) { return null; }
}
function fromSpec(energy, spec) {
  let E = energy || {};
  if (spec && !(Array.isArray(E.vessels) && E.vessels.length)) {
    const L = liftedVessels(spec);
    if (L) E = Object.assign({}, E, { vessels: L });
  }
  EN.kind = E.kind === 'battery' ? 'battery' : 'fuel';
  EN.fuel = E.fuel || 'avgas100LL';
  EN.cell = E.cell || 'lifepo4';
  EN.vessel = E.vessel || null;
  EN.finish = E.finish || null;
  EN.hue = +E.hue || 0;
  EN.tint = E.tint || null;
  EN.vessels = Array.isArray(E.vessels) && E.vessels.length
    ? E.vessels.map(v => Object.assign({ bay: v.bay || 'nose', capacity: +v.capacity || 0,
        along: v.along == null ? null : +v.along,
        lv: v.lv == null ? null : +v.lv, rot: +v.rot || 0,
        // a round tank or a squared one — geometry, and the capacity follows
        // G1150: or the DECK form, which is its own drawn shape (dims + profile)
        form: v.form === 'cyl' ? 'cyl' : v.form === 'ogive' ? 'ogive' : (v.form === 'deck' && (Array.isArray(v.dims && v.dims.profile) && v.dims.profile.length >= 2)) ? 'deck' : 'box',
        // the player's own box, when they drew one (a deck's profile rides with it)
        dims: (v.dims && v.dims.L > 0) ? Object.assign({ L: +v.dims.L, W: +v.dims.W, H: +v.dims.H },
          (Array.isArray(v.dims && v.dims.profile) && v.dims.profile.length >= 2) ? { profile: v.dims.profile.map(Number) } : {}) : null,
        // ...AND ITS OWN LOOK (2026-09-05). null at any of the three means
        // the section's answer, which is what a build written before this
        // says about every tank it carries.
        finish: FINISH[v.finish] ? v.finish : null,
        hue: v.hue == null ? null : +v.hue || 0,
        tint: v.tint || null },
        // TANK-FIT Part 2: a nose tank fitted to the nose (and the gap under its deck, when the player set one)
        v.fit === 'auto' ? { fit: 'auto' } : {}, v.gap != null && isFinite(+v.gap) ? { gap: +v.gap } : {},
        v.room != null && isFinite(+v.room) ? { room: +v.room } : {}))
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
             // G1150: a deck's profile rides with its dims (without it the core makes it a box)
             dims: v.dims ? Object.assign({ L: v.dims.L, W: v.dims.W, H: v.dims.H }, Array.isArray(v.dims.profile) ? { profile: v.dims.profile.slice() } : {}) : null,
             finish: v.finish || null,
             hue: v.hue == null ? null : v.hue,
             tint: v.tint || null,
             ...(v.fit === 'auto' ? { fit: 'auto' } : {}), ...(v.gap != null ? { gap: v.gap } : {}), ...(v.room != null ? { room: v.room } : {}) })) };
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
const formOf = v => (v && v.form === 'cyl' ? 'cyl' : v && v.form === 'ogive' ? 'ogive'
  : v && v.form === 'deck' && v.dims && Array.isArray(v.dims.profile) ? 'deck' : 'box');
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
  // the datum, read once for every body bay (G2799: it was read per bay)
  let zFwM;
  const zFwOf = () => zFwM !== undefined ? zFwM
    : (zFwM = VG() && VG().firewallZ ? VG().firewallZ(ctx.spec, CG2()) : null);
  for (const k in C.BAYS) {
    const B = C.BAYS[k];
    if (B.on === 'wing' && !(S.wing && window.CAGE_WING)) continue;
    // G477: a strut bay only where the wing layer drew lift struts
    if (B.on === 'strut' && !(window.CAGE_WING && window.CAGE_WING.struts && window.CAGE_WING.struts.length)) continue;
    // G185: a bay on the second plane needs the second plane DRAWN
    if (B.on === 'wing' && B.plane && !(window.CAGE_WING.planes &&
                                        window.CAGE_WING.planes[B.plane])) continue;
    let r = null;
    try { r = C.bayResolve(S, k, null); } catch (e) { r = null; }
    if (!r) continue;
    if (r.on === 'body' && ctx.mesh && BAY()) {
      const zFw = zFwOf();
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
    // TANK-FIT case A: a bay the body ends in, continued by a pusher's cowl - its room is the cowl's (the slider's top)
    if (r.on === 'body' && ctx.mesh && VG() && !legacyFit() && !(r.roomL > 5)) {
      bayCacheOf(ctx, r, zFwOf());
      if (r.cowl) r.roomL = cowlLitres(ctx, r, zFwOf());
    }
    // G2799: a bay that holds a vessel is swept now rather than in the layout
    // (the same sweep, read back there), so the panel drawn before the layout
    // shows its fore/aft slider over the hand's range
    if (r.on === 'body' && ctx.mesh && VG() && EN.vessels.some(v => v.bay === k))
      bayCacheOf(ctx, r, zFwOf());
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

// TANK-FIT: THE SLICER IS KEPT WHILE THE WING IS THE SAME. A slicer walks every vertex of the wing group per station
// it is asked (and keeps its answers), and placeAll made a fresh one per layout: the twin's wing tank cost 150 ms of
// every relayout - every drag tick of any tank - re-slicing a wing that had not moved. Kept per plane, by the wing
// group itself (a wing row rebuilds it), its placement and the layer frame.
let SLICERS = { key: null, by: {} };
function slicerOf(ctx, inv, plane) {
  const W0 = window.CAGE_WING;
  const W = (plane && W0 && W0.planes && W0.planes[plane]) ? W0.planes[plane] : W0;
  if (!W || !W.group || legacyFit()) return wingSlicer(ctx, inv, plane || undefined);
  W.group.updateMatrixWorld(true);
  const key = (W0.group ? W0.group.id : 'x') + ':' + matSig(inv);
  if (SLICERS.key !== key) SLICERS = { key, by: {} };
  const k = (plane || 0) + ':' + W.group.id + ':' + matSig(W.group.matrixWorld);
  if (!(k in SLICERS.by)) SLICERS.by[k] = wingSlicer(ctx, inv, plane || undefined);
  return SLICERS.by[k];
}
// THE COWL, MEASURED (TANK-FIT case A). Its reach along the body (axis metres, the ledger's) off the cowl layer's own
// triangles in the clearance soup, and its inner section at a station by four rays from its axis (up, down, port,
// starboard) against the cowl's triangles alone - the engine inside it is the clearance's business, not the bay's.
function layerInv(ctx) {
  if (!ctx || !ctx.scene || !window.THREE) return null;
  ctx.scene.updateMatrixWorld(true);
  return new THREE.Matrix4().copy(ctx.scene.matrixWorld).invert();
}
function cowlReach(ctx, zFw) {
  if (zFw == null) return null;
  const inv = LAST.inv || layerInv(ctx);
  if (!inv) return null;
  const S = surfAll(ctx, ctx.scene, inv);
  if (S._cowl !== undefined && S._cowlZ === zFw) return S._cowl;
  const tc = TAG_IX.get('cowl'), b = S.buf, FS = fsOf(ctx);
  let z0 = Infinity, z1 = -Infinity, n = 0;
  if (tc != null) for (let i = S.nSheet || 0; i < S.n; i++) {
    if (S.tag[i] !== tc) continue;
    const o = i * 15;
    // the BODY's cowl only: a triangle off the centreline (a wing nacelle's cowl, a prop blade's tip) is not the
    // body going on (the validated twin floatplane's nacelles read as a cowl past its pod: every cabin bay broke)
    if (b[o + 9] > 0.25 || b[o + 12] < -0.25) continue;
    n++;
    if (b[o + 11] < z0) z0 = b[o + 11]; if (b[o + 14] > z1) z1 = b[o + 14];
  }
  // along = metres aft of the datum: zFw (cage units) x FS less the layer's z
  S._cowlZ = zFw;
  S._cowl = n ? { x0: zFw * FS - z1, x1: zFw * FS - z0, n } : null;
  return S._cowl;
}
function cowlSection(ctx, zL) {
  const inv = LAST.inv || layerInv(ctx);
  if (!inv) return null;
  const S = surfAll(ctx, ctx.scene, inv), O = obstIndex(S), tc = TAG_IX.get('cowl');
  if (tc == null || !O.n) return null;
  // the axis height at this station: the middle of the cowl's own triangles within 3 cm of it
  const b = S.buf;
  let y0 = Infinity, y1 = -Infinity;
  obstEach(O, [-2, -5, zL - 0.03], [2, 5, zL + 0.03], i => {
    if (S.tag[i] !== tc) return;
    const o = i * 15;
    if (b[o + 14] < zL - 0.03 || b[o + 11] > zL + 0.03) return;
    if (b[o + 10] < y0) y0 = b[o + 10]; if (b[o + 13] > y1) y1 = b[o + 13];
  });
  if (!(y1 > y0)) return null;
  const c = [0, 0.5 * (y0 + y1), zL], far = 2;
  const hit = (dx, dy) => { const h = obstSeg(O, c, [c[0] + dx * far, c[1] + dy * far, zL], tc); return h ? h.t * far : null; };
  const up = hit(0, 1), dn = hit(0, -1), lf = hit(-1, 0), rt = hit(1, 0);
  if (up == null || dn == null || lf == null || rt == null) return null;
  return { yLo: c[1] - dn, yHi: c[1] + up, xLo: -lf, xHi: rt };
}
// the litres the cowl's sections hold over the bay (an ellipse in each section's box, the band's share)
function cowlLitres(ctx, bay, zFw) {
  const FS = fsOf(ctx), a0 = Math.max(bay.x0, bay.cowl.x0), a1 = Math.min(bay.cowl.x1, Math.max(bay.x1, bay.hx1 || bay.x1));
  const lvB = bay.lv || [0, 1];
  let L = 0;
  for (let a = a0 + 0.025; a < a1; a += 0.05) {
    const sc = cowlSection(ctx, zFw * FS - a);
    if (sc) L += Math.PI / 4 * (sc.xHi - sc.xLo) * (sc.yHi - sc.yLo) * (lvB[1] - lvB[0]) * 0.05 * 1000;
  }
  return L;
}
// a body vessel in the cowl: bodyPlace's answer (centre, extents, turn), off the cowl's own section
function cowlPlace(ctx, bay, v, dims, zFw) {
  const FS = fsOf(ctx), along = v.along != null ? v.along : bay.x0 + dims.L / 2 + 0.02;
  const zL = zFw * FS - along;
  const sec = cowlSection(ctx, zL);
  const out = { on: 'body', ok: false, why: [], cowl: true };
  if (!sec) { out.why.push('no cowl section at ' + along.toFixed(2) + ' m'); return out; }
  const lvB = bay.lv || [0, 1], H = sec.yHi - sec.yLo;
  const bandLo = sec.yLo + lvB[0] * H, bandHi = sec.yLo + lvB[1] * H;
  const lv = v.lv != null ? v.lv : 0.5;
  const yc0 = bandLo + lv * (bandHi - bandLo);
  const yc = Math.max(bandLo + dims.H / 2, Math.min(bandHi - dims.H / 2, yc0)) || 0.5 * (bandLo + bandHi);
  const rot = (v.rot || 0) * Math.PI / 180;
  Object.assign(out, { ok: true, c: [0, yc, zL], e: [dims.W / 2, dims.H / 2, dims.L / 2], rot, along, lv,
    section: { yLo: sec.yLo, yHi: sec.yHi, xLo: sec.xLo, xHi: sec.xHi, band: [bandLo, bandHi] }, outsideHand: 0, inBand: true, fitsSkin: true });
  return out;
}
// A TANK WITH NO STATION TAKES THE USER'S RULE, and then it HAS one: nose bay
// against the firewall and high, every other bay on the floor against the aft
// bulkhead (VESSEL_GEN.defaultSpot). The spot is WRITTEN INTO THE VESSEL,
// because a null would leave the ledger billing the bay's midpoint while the
// picture showed the bulkhead: one tank, one place. A grid search that walked
// the bay for a crew-clear cell lived here for an afternoon; the user's call
// was that it was too picky, and that the player places the tank themselves.
// ONE SWEEP PER BAY PER BODY (placeAll's, hoisted for G2799: measureBays asks
// it first for every bay that holds a vessel, so the panel drawn before the
// layout already shows the clamped bay and the hand's range; the sweep is the
// same one, under the same key, so placeAll reads it back and sweeps nothing)
function bayCacheOf(ctx, bay, zFw) {
  const G = VG(), FS = fsOf(ctx);
  if (bay.on !== 'body') return null;
  // the key is the RULE's limits, taken once per bay object: the clamp
  // below rewrites x0/x1, and a second vessel in the same bay must not
  // read a different key off the clamped numbers and sweep again
  if (!bay._ck) bay._ck = bayKey(bay, zFw);
  // the clamps below start from the RULE's limits every call (TANK-FIT: a second call on the same bay object read its
  // own clamped limits back - the cowl's continuation, asked after a legacy pass, collapsed the bay)
  if (!bay._rx) bay._rx = [bay.x0, bay.x1];
  else { bay.x0 = bay._rx[0]; bay.x1 = bay._rx[1]; }
  if (!(bay._ck in BAY_CACHES))
    BAY_CACHES[bay._ck] = G.bayCache ? G.bayCache(ctx.mesh, FS, bay, 0.035, zFw, 0.7) : null;
  const c = BAY_CACHES[bay._ck];
  // THE BAY IS CLAMPED TO THE BODY THE FIELD DESCRIBES. The rule's front
  // limit is a measured deck length; where the field stops describing
  // the deck (the firewall face) the bay stops too, so a default and a
  // slider both start at a station a tank can actually be at. Every
  // call, not only the sweeping one: BAYS is measured afresh each build
  // and the clamp lives on the bay object, not in the cache.
  // TANK-FIT case A: ...EXCEPT WHERE THE BODY GOES ON AS A COWL. A cowled pusher's body ends at the bulkhead its
  // engine stands behind, and the cowl over the engine is the cowl layer's, not the sheet's: the field stops there,
  // and the twin's 'behind the cabin' bay (1.85-2.15 m) - wholly inside that cowl - was clamped to nothing (0 L,
  // every tank 'past the body') with the cowl's front half empty. The cowl's own reach aft (cowlReach) continues
  // the bay: placed there by the cowl's measured section (cowlPlace), judged by the drawn clearance like any tank.
  const cw = !legacyFit() && c && c.axisMax != null ? cowlReach(ctx, zFw) : null;
  bay.cowl = null;
  if (cw && cw.x1 > c.axisMax + 0.05 && bay.x1 > c.axisMax - 0.05) {
    bay.cowl = { x0: c.axisMax, x1: cw.x1 };
    if (bay.x0 > c.axisMax - 0.01 && !bay._ruleX) bay._ruleX = [bay.x0, bay.x1];
    bay.x1 = Math.min(bay.x1, cw.x1 - 0.01);
    if (bay.x0 >= bay.x1 - 0.05) bay.x0 = Math.max(c.axisMax - 0.3, bay.x1 - 0.3);
  } else if (c && c.axisMax != null && c.axisMax < bay.x1) bay.x1 = c.axisMax - 0.01;
  if (c && c.axisMin != null && c.axisMin > bay.x0) bay.x0 = c.axisMin + 0.01;
  // G2799: the HAND's range, wider than the rule's (VESSEL_GEN.handRange):
  // the fore/aft slider and the readout read it, the defaults never do
  const h = G.handRange ? G.handRange(bay, c) : null;
  if (h) { bay.hx0 = h[0]; bay.hx1 = h[1]; }
  if (bay.cowl) bay.hx1 = Math.max(bay.hx1 != null ? bay.hx1 : bay.x1, bay.cowl.x1 - 0.01);
  return c;
}
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
  const cacheOf = bay => bayCacheOf(ctx, bay, zFw);
  const FS = fsOf(ctx);
  const W = window.CAGE_WING;
  const semi = W ? (W.semi || (W.def && W.def.spec && W.def.spec.geom && W.def.spec.geom.semi) || 0) : 0;
  const slice = W ? slicerOf(ctx, inv, 0) : null;
  // G185: the second plane's own semispan and slice, for its bays
  const semiOf = k => (k && W && W.planes && W.planes[k] && W.planes[k].semi) || semi;
  const sliceCache = { 0: slice };
  const sliceOf = k => { if (!(k in sliceCache)) sliceCache[k] = W ? slicerOf(ctx, inv, k) : null; return sliceCache[k]; };
  // the datum the ledger bills against, read off this cage's own rings
  const zFw = G.firewallZ ? G.firewallZ(ctx.spec, CG2()) : null;
  // G1985 (JOIN-PARITY): A SHAPE IS NOT WRITTEN AGAINST A CREW STILL ON THE WIRE. A body tank without its own
  // box (or station, or level) is shaped and settled against the crew's points below and the answer is written into
  // the vessel - for good, the spec carries it from then on. While a crew character is still loading the crew layer
  // stands a stand-in, so the shape is computed and DRAWN but not kept; the character's rebuild shapes it for real.
  // (The user's Cub booted to a 29 L tank shaped against the waiting crew and loaded from the shelf to 27 L.)
  const crewPending = !FIT_ASKING && typeof window.CAGE_CREW_PENDING === 'function' && window.CAGE_CREW_PENDING();
  for (const v of EN.vessels) {
    if (v.bay === 'strut' && !BAYS.find(b => b.key === 'strut') && !legacyFit()) {
      const res0 = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel', v.capacity, vesselKey(), medium());
      results.push({ on: 'strut', ok: false, unmounted: true, pods: [], v, res: res0, needL: res0.installedL, roomL: 0,
        bay: { key: 'strut', name: 'On the lift struts', on: 'strut', span: [0.25, 0.8] },
        why: ['this aeroplane has no lift struts to hang it on: the pod is not fitted and carries no fuel (give the wing ' +
              'its struts back, or move the tank to another bay)'] });
      continue;
    }
    const bay = BAYS.find(b => b.key === v.bay) || BAYS.find(b => b.on === 'body');
    if (!bay) continue;
    const prov = crewPending && bay.on === 'body' && (!v.dims || v.along == null || v.lv == null)
      ? { keep: { dims: v.dims, capacity: v.capacity, lv: v.lv, along: v.along, rot: v.rot }, had: 'shaped' in v, shaped: v.shaped, wb: wroteBack }
      : null;
    // THE PLAYER'S BOX SETS THE CAPACITY. A vessel with its own dims has its
    // litres derived from them (installed volume, less the shell's rounding,
    // back through the same ullage factor genVesselResolve applies), so the
    // ledger bills what the drawn box holds and nothing else.
    if (v.dims) v.capacity = capacityFromDims(v.dims, formOf(v));
    const res = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel',
                                v.capacity, vesselKey(), medium());
    let dims = G.vesselDims(vesselKey(), res.installedL, v.dims, formOf(v));
    let pl, resOver = null, autoY = null;
    if (bay.on === 'strut') {
      // G477: A POD ON EACH FRONT LIFT STRUT — the vessel's litres shared by
      // the pair, an ogive on the strut's own axis at `along` of its length
      // (0 the foot on the body, 1 the wing). The FRONT strut of each side
      // is the forward-most pin; the pod must clear the wing at its top and
      // the body at its foot by a hand, and the litres are the pair's.
      v.form = 'ogive';
      if (v.dims) v.capacity = capacityFromDims(v.dims, 'ogive') * 2;
      const resH = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel',
                                   v.capacity / 2, vesselKey(), medium());
      dims = G.vesselDims(vesselKey(), resH.installedL, v.dims, 'ogive');
      const t0 = v.along != null ? v.along : 0.5 * (bay.span[0] + bay.span[1]);
      if (v.along == null) { v.along = t0; wroteBack = true; }
      const S2 = (W && W.struts) || [];
      const bySide = { L: null, R: null };
      for (const s of S2) {
        const k = s.tip[0] < 0 ? 'L' : 'R';
        if (!bySide[k] || s.pin[2] > bySide[k].pin[2]) bySide[k] = s;
      }
      const pods = [], why = [];
      for (const k of ['L', 'R']) {
        const s = bySide[k]; if (!s) continue;
        const ax = [s.tip[0] - s.pin[0], s.tip[1] - s.pin[1], s.tip[2] - s.pin[2]];
        const len = Math.hypot(ax[0], ax[1], ax[2]) || 1e-6;
        const u = ax.map(q => q / len);
        const c = [s.pin[0] + ax[0] * t0, s.pin[1] + ax[1] * t0, s.pin[2] + ax[2] * t0];
        // G2793 (the user's garage review, 18 Oct: "strut-mounted tanks: the
        // ogive's long axis along the line of flight, not along the strut"):
        // the pod is hung on the strut at `along`, its axis fore-aft (+z).
        // Its centre stays ON the strut, so the frame's billing on the
        // strut's end nodes (61_gen_frame.js, the `along` lever) is still
        // where the pod is drawn.
        // TANK-FIT (Part 3): THE POD HANGS UNDER THE STRUT, on a short pylon and a clamp round the strut - it was
        // drawn centred ON the strut's axis, the strut running through it. Its centre is a pylon's height below the
        // strut at `along` (the frame bills it on the strut's two end nodes by lever: 5-10 cm below them, a
        // centimetre of CG on a light aeroplane, said here)
        const hang = legacyFit() ? 0 : dims.W / 2 + PYLON_H;
        const cp = [c[0], c[1] - hang, c[2]];
        pods.push({ sign: k === 'L' ? -1 : 1, c: cp, onStrut: c, axis: [0, 0, 1], u, L: dims.L, D: dims.W, len, t: t0,
                    yFoot: s.pin[1], yTop: s.tip[1], hang });
      }
      if (!pods.length) why.push('no lift strut to hang it on');
      // the clearances, now across the pod's girth: its round body must clear
      // the body at the strut's foot and the wing at its top by a hand
      for (const pd of pods) {
        if (pd.c[1] - pd.D / 2 - pd.yFoot < 0.05) { why.push('into the body at the foot'); break; }
        if (pd.yTop - (pd.c[1] + pd.D / 2) < 0.05) { why.push('into the wing at the top'); break; }
      }
      pl = { on: 'strut', ok: !why.length, why, pods, along: t0 };
      // ...and against what is drawn there (the fuselage, its gear-legs' fairing in the sheet, the engine, the cowl)
      if (!legacyFit() && pods.length && ctx.scene) {
        const pc = podClear(ctx, ctx.scene, inv, pods);
        if (pc) { pl.ok = false; pl.why.push(pc.why); pl.clash = { at: pc.at, marks: [] }; }
      }
    } else if (bay.on === 'wing') {
      const kp = bay.plane | 0, sl = sliceOf(kp), sm = semiOf(kp);
      // G445.2: THE DRAWN SKIN, top and bottom, at any (span, chord) - the
      // wing layer's own ray probes, the ones the gear and engine layers
      // fit to - so the tank the generator ribs out sits inside the
      // aerofoil that is on the screen, whatever the section, taper,
      // dihedral or twist did to it. Null (no probe) keeps the box.
      const Wk = (kp && W && W.planes && W.planes[kp]) ? W.planes[kp] : W;
      const prof = (Wk && Wk.overAt && Wk.underAt)
        ? (x, z) => { const t = Wk.overAt(x, z), u = Wk.underAt(x, z);
                      return (t && u) ? { yTop: t.y, yBot: u.y } : null; }
        : null;
      // ...AND THE SLICE THE PROBES GIVE WHERE THE VERTEX SLICER FINDS NOTHING
      // (G445.2): wingSlicer wants six vertices within 12 cm of a station,
      // and a loft whose rows sit 37 cm apart (the 172's three panels) has
      // none between them - the root tank stopped after 6 cm, "runs out of
      // wing". Cast instead: the leading and trailing edges the wing layer
      // walks, the thickest of eleven chord samples between them. Cached per
      // station like the slicer's own answers; the slicer still answers first.
      const slPr = (sl && prof && Wk.leAt && Wk.teAt) ? (() => {
        const cache = new Map();
        return xAt => {
          const r0 = sl(xAt);
          if (r0) return r0;
          const key = Math.round(xAt * 200);
          if (cache.has(key)) return cache.get(key);
          let r = null;
          const le = Wk.leAt(xAt), te = Wk.teAt(xAt);
          if (le && te) {
            let y0 = 1e9, y1 = -1e9;
            for (let i = 0; i <= 10; i++) {
              const p = prof(xAt, te.z + (le.z - te.z) * i / 10);
              if (p) { y0 = Math.min(y0, p.yBot); y1 = Math.max(y1, p.yTop); }
            }
            if (y1 > y0) r = { y0, y1, zLE: le.z, zTE: te.z, n: 0, cast: true };
          }
          cache.set(key, r);
          return r;
        };
      })() : sl;
      pl = (sl && sm > 0)
        ? G.wingPlace(sm, bay, v, res.installedL, slPr, C.RULES || {}, bay.litres, prof)
        : { on: 'wing', ok: false, why: ['no wing to put it in'], sides: [] };
    } else {
      const cache = cacheOf(bay);
      // A STATION OUTSIDE ITS BAY IS NO STATION. A remembered `along` from
      // before a bay rule moved (the bench kept a nose tank at 1.08 m after
      // the nose bay became the cowl deck) would be reported as "past the
      // body" forever; it takes the rule again instead, like a new vessel.
      // (G2799: past the HAND's range, which holds the rule's, so a station
      // the player put out there is theirs)
      if (v.along != null && (v.along < Math.min(bay.x0, bay.hx0 != null ? bay.hx0 : bay.x0) - dims.L ||
                              v.along > Math.max(bay.x1, bay.hx1 != null ? bay.hx1 : bay.x1) + dims.L)) {
        v.along = null; v.lv = null;
      }
      // TANK-FIT Part 2: THE NOSE TANK FITTED TO THE NOSE (noseAuto): its shape, station and level, every layout
      // (the body moves, the tank follows), written into the vessel - the ledger bills what is drawn
      if (noseAutoWanted(v, bay) && !FIT_AUTO_SKIP) {
        const na = noseAuto(ctx, inv, bay, v, zFw, cache);
        if (na && na.pending) {
          // the shaping is on its way (sliced): nothing drawn, nothing written; the slice that finishes lays out again
          results.push({ on: 'body', ok: true, pending: true, why: [], v, bay, res, dims, needL: res.installedL, roomL: bay.roomL, crewHits: 0 });
          continue;
        }
        if (na && na.dims && !na.why) {
          const same = v.form === 'deck' && v.dims && JSON.stringify(v.dims) === JSON.stringify(na.dims) && v.along === na.along && v.lv === na.lv;
          if (!same) { v.form = 'deck'; v.dims = na.dims; v.along = na.along; v.lv = na.lv; v.rot = 0; v.fit = 'auto'; wroteBack = true; }
          v.capacity = capacityFromDims(v.dims, 'deck');
          v.shaped = 'auto';
          resOver = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel', v.capacity, vesselKey(), medium());
          dims = G.vesselDims(vesselKey(), resOver.installedL, v.dims, 'deck');
          delete v.autoWhy;
          autoY = na.yc;
        } else if (na && na.why) v.autoWhy = na.why;
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
            const P3 = CREW_PTS.buf;
            crewEach(CREW_PTS, [-half.x - 1e-6, -Infinity, zMid - half.z - 1e-6], [half.x + 1e-6, Infinity, zMid + half.z + 1e-6], i => {
              const x = P3[i * 3], y = P3[i * 3 + 1], z = P3[i * 3 + 2];
              if (Math.abs(x) <= half.x && Math.abs(z - zMid) <= half.z && y > crewTop) crewTop = y;
            });
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
      if ((v.along == null || v.lv == null) && bay.cowl && bay._ruleX && bay._ruleX[0] >= bay.cowl.x0 - 0.05) {
        // TANK-FIT case A: a bay wholly in a pusher's cowl - the tank stands against the bulkhead it is behind (the
        // body's aft face, the engine's firewall), mid-height: the rule's 'aft bulkhead' there is the engine
        const spot = G.defaultSpot(bay, dims);
        v.along = Math.round((bay.cowl.x0 + (spot.rot ? dims.W : dims.L) / 2 + 0.03) * 1000) / 1000;
        v.lv = 0.5; v.rot = spot.rot;
        wroteBack = true;
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
      if (autoY != null) { AUTO_ZFW = zFw * FS; pl = autoPlace(v, dims, autoY); }
      else pl = G.bodyPlace(ctx.mesh, FS, bay, v, dims, 0.035, zFw, cache, legacyFit() ? null : { noFit: true });
      if (!pl.c && bay.cowl && v.along != null && v.along >= bay.cowl.x0 - dims.L / 2) pl = cowlPlace(ctx, bay, v, dims, zFw);
      // TANK-FIT: the bay fit's corners at a 35 mm wall, the band and the hand's range are KEPT as readings
      // (pl.rule) and no longer decide: the drawn clearance does (judgeTank, after the placement). A tank the
      // placement could not put anywhere (no station: past the body) stays red with its reason.
      if (!legacyFit()) {
        pl.rule = { ok: pl.ok, why: pl.why.slice() };
        if (pl.c) { pl.ok = true; pl.why = []; }
      }
    }
    if (prov) {
      Object.assign(v, prov.keep);
      if (prov.had) v.shaped = prov.shaped; else delete v.shaped;
      wroteBack = prov.wb;
    }
    pl.v = v; pl.bay = bay; pl.res = resOver || res; pl.dims = dims;
    pl.needL = pl.res.installedL;
    if (v.autoWhy && noseAutoWanted(v, bay)) { pl.ok = false; pl.why.push(v.autoWhy); }
    pl.roomL = bay.roomL;
    pl.fitsRoom = pl.roomL > 0 && pl.needL <= pl.roomL;
    // (a body tank's room is what is drawn round it - TANK-FIT - the swept litres are the slider's top, not a verdict)
    if (!pl.fitsRoom && !(pl.on === 'body' && !legacyFit())) { pl.ok = false; pl.why.push('the bay holds ' + (pl.roomL || 0).toFixed(0) + ' L'); }
    pl.crewHits = 0;
    results.push(pl);
  }
  // the station a vessel found for itself is a fact about this aeroplane now
  if (wroteBack && !FIT_ASKING) { if (panelBody) renderPanel(); commitLater(); }
  return results;
}
let laterT = null;
function commitLater() {
  if (laterT) clearTimeout(laterT);
  laterT = setTimeout(() => { laterT = null; commit(); }, 120);
}
// G1302 (GARAGE-LAG-2): A RANGE ROW'S RELEASE COMMITS POST-IDLE. The release of the capacity (and of the size, the
// station, the level, the turn) committed inside the change event: GARAGE_SPEC.update puts the aeroplane back on the
// stand - the flown model, the sim, the room (~0.3 s on the box once the shakedown left it, G1302's other half) -
// while what the builder looks at, the tank in the editor, was already drawn by the drag's own relayout. The commit
// is the same one through the same door (savePrefs, the resolve, B9's nothing-new test, update, the readouts), run
// once the hand has let go and the page is idle (250 ms, then an idle slot, at most 1.5 s), and a second release
// before it folds into it. Nothing that needs the tanks in the spec waits on it: the join's export reads the layer
// (CAGE_ENERGY.toSpec), so a roll-out, a save or an export straight after the release carries them all the same.
let soonT = null, soonI = null;
function commitSoon() {
  if (soonT) clearTimeout(soonT);
  if (soonI && typeof cancelIdleCallback === 'function') cancelIdleCallback(soonI);
  soonI = null;
  soonT = setTimeout(() => {
    soonT = null;
    const go = () => { soonI = null; commit(); };
    if (typeof requestIdleCallback === 'function') soonI = requestIdleCallback(go, { timeout: 1500 });
    else go();
  }, 250);
}

// THE CREW IS IN THE WAY, OR IT IS NOT. Every vertex of everything the crew
// layer drew — seats, the occupants' posed bodies, the panel, the sticks — tested against each
// body vessel's box. A box is convex, so a vertex inside it is a certain
// intrusion; the memory of G83's false positives says not to use bounding
// boxes for this, and this is not one.
// the crew's vertices in this layer's frame, gathered ONCE per layout — the
// auto-fit asks the same question a hundred times
let CREW_PTS = null;
function crewPoints(scene, inv) {
  if (!scene || !window.THREE) return { buf: new Float64Array(0), n: 0 };
  let crew = null;
  for (const ch of scene.children)
    if ((ch.name || '') === 'cageLayer:crew') crew = ch;
  if (!crew) return { buf: new Float64Array(0), n: 0 };
  crew.updateMatrixWorld(true);
  // G1455 (RELEASE-FAST): the points in one Float64Array, x y z each (the same doubles the little arrays held)
  const V = new THREE.Vector3(), meshes = [];
  let n = 0;
  crew.traverse(o => {
    // a character's SKINNED mesh holds its bind pose (a T-pose, nowhere near
    // the seat): its posed body is the plain mesh under it (G3700,
    // _cage_char.js pickBody), and that is what the tank clears
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute('position');
    if (!pos) return;
    meshes.push(o); n += pos.count;
  });
  const buf = new Float64Array(n * 3);
  // TANK-FIT: what each point belongs to (the verdict names it: a crew member, a seat, the controls), by mesh
  const owner = new Uint16Array(n), words = [];
  let k = 0;
  for (const o of meshes) {
    const pos = o.geometry.getAttribute('position');
    let nm = (o.userData && o.userData.charPick) ? 'pick' : '';
    for (let q = o; q && !nm && q !== crew; q = q.parent) if (q.name) nm = q.name;
    const wi = words.length; words.push(crewWord(nm));
    // one matrix a mesh (inv x matrixWorld), applied by hand: the same numbers as the two applyMatrix4 calls to the
    // rounding, at a fraction of the cost (27 000 points a seat)
    const Mx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).elements;
    const A = pos.array, st = pos.isInterleavedBufferAttribute ? pos.data.stride : pos.itemSize, off = pos.offset || 0;
    const plain = !pos.normalized && A && st >= 3;
    for (let i = 0; i < pos.count; i++) {
      let x, y, z;
      if (plain) { const j = i * st + off; x = A[j]; y = A[j + 1]; z = A[j + 2]; }
      else { x = pos.getX(i); y = pos.getY(i); z = pos.getZ(i); }
      const w = 1 / (Mx[3] * x + Mx[7] * y + Mx[11] * z + Mx[15]);
      owner[k / 3] = wi;
      buf[k++] = (Mx[0] * x + Mx[4] * y + Mx[8] * z + Mx[12]) * w;
      buf[k++] = (Mx[1] * x + Mx[5] * y + Mx[9] * z + Mx[13]) * w;
      buf[k++] = (Mx[2] * x + Mx[6] * y + Mx[10] * z + Mx[14]) * w;
    }
  }
  return { buf, n, grid: crewGrid(buf, n), word: i => words[owner[i]] || 'the crew', sig: crewSig(crew, inv) };
}
// THE CREW IS GATHERED WHEN IT CHANGES (TANK-FIT): relayout dropped the points on every call (27 000 a seat, through
// two matrices, and their grid, every drag tick). The key: the crew layer's meshes themselves, their vertex counts,
// where they are, and a few of their vertices (a body re-posed in place moves them).
function crewSig(crew, inv) {
  let sg = inv ? String(matSig(inv)) : 'x';
  crew.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute('position'); if (!pos) return;
    let h = 0;
    for (const i of [0, pos.count >> 1, pos.count - 1]) h = (h * 31 + Math.round(pos.getX(i) * 1e4) * 7 + Math.round(pos.getY(i) * 1e4) * 13 + Math.round(pos.getZ(i) * 1e4)) | 0;
    sg += '|' + o.id + ':' + pos.count + ':' + matSig(o.matrixWorld) + ':' + h;
  });
  return sg;
}
function crewFresh(scene, inv) {
  if (!CREW_PTS || legacyFit()) return false;
  let crew = null;
  if (scene) for (const ch of scene.children) if ((ch.name || '') === 'cageLayer:crew') crew = ch;
  if (!crew) return CREW_PTS.n === 0;
  crew.updateMatrixWorld(true);
  return CREW_PTS.sig === crewSig(crew, inv);
}
// THE CREW'S POINTS BY CELL (GARAGE-LAG, 27 Oct). Since G3700 the crew is the
// racer's POSED body - some 27 000 vertices a seat, sitting right beside the
// cabin's tanks - and the fit's search (settleLv's clearOfCrew, fitOf) asks
// crewHits per candidate: every point against every box, a hundred times a
// drag tick. The points go into 5 cm cells once per layout (a CSR list), and
// a query walks only the cells a box's axis-aligned extent covers. Exact: a
// point inside the box is inside that extent, so it is in a walked cell, and
// each walked point still takes pointInBox - the counts are the same numbers.
const CREW_CELL = 0.05;
function crewGrid(buf, n) {
  if (!n) return null;
  let lx = Infinity, ly = Infinity, lz = Infinity, hx = -Infinity, hy = -Infinity, hz = -Infinity;
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    const x = buf[j], y = buf[j + 1], z = buf[j + 2];
    if (x < lx) lx = x; if (x > hx) hx = x; if (y < ly) ly = y; if (y > hy) hy = y; if (z < lz) lz = z; if (z > hz) hz = z;
  }
  if (!(isFinite(lx) && isFinite(hx) && isFinite(ly) && isFinite(hy) && isFinite(lz) && isFinite(hz))) return null;
  const lo = [lx, ly, lz], hi = [hx, hy, hz];
  const N = [0, 1, 2].map(a => Math.max(1, Math.floor((hi[a] - lo[a]) / CREW_CELL) + 1));
  if (N[0] * N[1] * N[2] > 4e6) return null;          // a crew strewn kilometres apart: walk them all
  // (flat loops, TANK-FIT: a closure a point with three-element arrays was 90 ms a crew of 80 000 points)
  const N0 = N[0], N1 = N[1], N2 = N[2], ic = 1 / CREW_CELL;
  const nc = N0 * N1 * N2, start = new Int32Array(nc + 1), cell = new Int32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    let cx = Math.floor((buf[j] - lx) * ic), cy = Math.floor((buf[j + 1] - ly) * ic), cz = Math.floor((buf[j + 2] - lz) * ic);
    if (cx > N0 - 1) cx = N0 - 1; if (cy > N1 - 1) cy = N1 - 1; if (cz > N2 - 1) cz = N2 - 1;
    const c = (cx * N1 + cy) * N2 + cz;
    cell[i] = c; start[c + 1]++;
  }
  for (let c = 0; c < nc; c++) start[c + 1] += start[c];
  const at = start.slice(0, nc), idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[at[cell[i]]++] = i;
  return { lo, N, start, idx };
}
// every crew point whose cell meets [qlo, qhi] (layer metres; a bound may be
// infinite), handed to fn(i) - and every point when there is no grid
function crewEach(P, qlo, qhi, fn) {
  const G = P.grid;
  if (!G) { for (let i = 0; i < P.n; i++) fn(i); return; }
  const r = [];
  for (let a = 0; a < 3; a++) {
    const c0 = Math.max(0, Math.floor((qlo[a] - G.lo[a]) / CREW_CELL));
    const c1 = Math.min(G.N[a] - 1, Math.floor((qhi[a] - G.lo[a]) / CREW_CELL));
    if (!(c0 <= c1)) return;
    r.push(c0, c1);
  }
  for (let x = r[0]; x <= r[1]; x++)
    for (let y = r[2]; y <= r[3]; y++) {
      // the z cells of one (x, y) row are contiguous in the list
      const row = (x * G.N[1] + y) * G.N[2];
      for (let k = G.start[row + r[4]], k1 = G.start[row + r[5] + 1]; k < k1; k++) fn(G.idx[k]);
    }
}
function crewHits(scene, inv, results) {
  const G = VG();
  if (!G) return;
  const bodies = results.filter(r => r.on === 'body' && r.c);
  if (!bodies.length) return;
  if (!CREW_PTS) CREW_PTS = crewPoints(scene, inv);
  const q = [0, 0, 0], B3 = CREW_PTS.buf;
  // per body, the cells its box (as pointInBox reads it, margin 0.01) covers
  for (const r of bodies) {
    const c = r.c, e = r.e, cs = Math.abs(Math.cos(r.rot)), sn = Math.abs(Math.sin(r.rot)), m = 0.01;
    const ex = [cs * (e[0] + m) + sn * (e[2] + m) + 1e-6, e[1] + m + 1e-6, sn * (e[0] + m) + cs * (e[2] + m) + 1e-6];
    crewEach(CREW_PTS, [c[0] - ex[0], c[1] - ex[1], c[2] - ex[2]], [c[0] + ex[0], c[1] + ex[1], c[2] + ex[2]], i => {
      q[0] = B3[i * 3]; q[1] = B3[i * 3 + 1]; q[2] = B3[i * 3 + 2];
      if (G.pointInBox(q, r, 0.01)) r.crewHits++;
    });
  }
  for (const r of bodies) if (r.crewHits) {
    r.ok = false;
    r.why.push('through the crew (' + r.crewHits + ' points)');
  }
}

// THE ENGINE AND THE COWL ARE IN THE WAY, OR THEY ARE NOT (G1108). The fit
// knows the skin (the bay's sections) and the crew (above); a tank beside a
// radial stood 131 mm into the engine layer's block with the fit reading
// "fits" (GATE TANKMOUNT, the Beaver-alike). The same box test as the crew's,
// over the engine's and the cowl's vertices - but as a VERDICT only, after
// the placement: the level search (settleLv's clearOfCrew) is not taught it,
// so no tank moves and no mass moves; a tank the engine runs through reads
// red in the editor and does not fly (drawResults, the join's edUnfit).
const HIT_LAYERS = ['cageLayer:eng', 'cageLayer:cowl'];
// ...and the sheet's own interior that the bay's sections leave out: the dash
// (a Jodel-alike's nose tank stood 125 mm through it reading "fits"). Its faces
// are sampled at their corners AND centres - a plate slicing a box can hold
// no corner inside it. The firewall is not here: a nose tank stands on it.
const HIT_SHEET = ['dash', 'dashFace'];
// IN THE SOLID, NOT THE BOX: the drawn tank is a rounded box (a corner
// radius up to 75 mm), and a box test read a Cessna-alike's dash TOUCHING the
// tank's corner as through it (38 points, the deepest 3.7 mm outside the
// drawn shell). A point counts when it lies INSIDE THE DRAWN SOLID by d
// (5 mm: touching is not intrusion): into the solid's own frame (the slot
// meshes' centre and yaw), then the section at its z, then the section's
// height at its x - VESSEL_MESH's own shape functions.
function inSolid(p, r, sol, d) {
  const VM = window.VESSEL_MESH;
  if (!sol || !sol.shape || !VM || !VM.heightAt) return false;
  const yaw = r.rot + (sol.yaw || 0), cs = Math.cos(yaw), sn = Math.sin(yaw);
  const dx = p[0] - r.c[0], dy = p[1] - r.c[1], dz = p[2] - r.c[2];
  // G1150: the shape's own test (the deck's flat floor and curved top are not
  // symmetric in y): inside by d means inside d above AND d below
  if (sol.shape.contains) {
    const X = Math.abs(dx * cs - dz * sn) + d, Z = Math.abs(dx * sn + dz * cs) + d;
    return sol.shape.contains(X, dy + d, Z) && sol.shape.contains(X, dy - d, Z);
  }
  const x = Math.abs(dx * cs - dz * sn) + d, y = Math.abs(dy) + d, z = Math.abs(dx * sn + dz * cs) + d;
  if (z > sol.e[2]) return false;
  const sec = sol.shape.atZ(z);
  if (!sec || !(sec.hx > 0) || x > sec.hx) return false;
  return y <= VM.heightAt(sec, x);
}
// the drawn solid's vertices in this layer's frame (the slot meshes' centre
// and yaw), and their box - optionally only a piece's (`pc`: its ranges)
function drawnPts(r, sol, slots, pc) {
  const yaw = r.rot + (sol.yaw || 0), cs = Math.cos(yaw), sn = Math.sin(yaw), c = r.c;
  const pts = [], bb = [c[0], c[1], c[2], c[0], c[1], c[2]];
  const SI = { hard: 0, seal: 1, mark: 2 };
  for (const slot of slots) {
    const P = sol[slot] && sol[slot].pos; if (!P) continue;
    let v0 = 0, v1 = P.length / 3;
    if (pc) { if (SI[slot] == null) continue; v0 = pc.start[SI[slot]][0]; v1 = pc.end[SI[slot]][0]; }
    for (let v = v0; v < v1; v++) {
      const q = [c[0] + cs * P[v * 3] + sn * P[v * 3 + 2], c[1] + P[v * 3 + 1], c[2] - sn * P[v * 3] + cs * P[v * 3 + 2]];
      pts.push(q);
      for (let k = 0; k < 3; k++) { if (q[k] < bb[k]) bb[k] = q[k]; if (q[k] > bb[k + 3]) bb[k + 3] = q[k]; }
    }
  }
  return { pts, bb };
}
// the surfaces a drawn tank must not cross, as triangles in this layer's
// frame: the sheet (cage units x FS: skin, glass, frame tubes, the dash) and
// the engine's and the cowl's meshes - only those whose box meets `bb`
// THE SOUP IS BUILT ONCE PER LAYOUT (relayout drops it): the sheet and the
// engine's and the cowl's meshes as flat triangles with their boxes; a query
// is then a box filter - fitOf asks it hundreds of times in a search
let SURF_ALL = null;
// G1455 (RELEASE-FAST): the soup is ONE Float64Array, 15 numbers a triangle (the same doubles, in the same order, that
// the per-triangle arrays held - a metal Cessna's 45 000 arrays were a quarter of a release's garbage), and the
// sheet's part is kept with the sheet (a WeakMap on the mesh object, by the scale it was built at: a release keeps the
// sheet, and its triangles are the same numbers)
const SHEET_SOUP = new WeakMap();
// what each triangle IS (TANK-FIT): the sheet's material name, or the layer it came from - the verdict names it
const TAG_NAMES = [], TAG_IX = new Map();
function tagOf(name) { let i = TAG_IX.get(name); if (i == null) { i = TAG_NAMES.length; TAG_NAMES.push(name); TAG_IX.set(name, i); } return i; }
function soupAdd(buf, n, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const o = n * 15;
  buf[o] = ax; buf[o + 1] = ay; buf[o + 2] = az;
  buf[o + 3] = bx - ax; buf[o + 4] = by - ay; buf[o + 5] = bz - az;
  buf[o + 6] = cx - ax; buf[o + 7] = cy - ay; buf[o + 8] = cz - az;
  buf[o + 9] = ax < bx ? (ax < cx ? ax : cx) : (bx < cx ? bx : cx);
  buf[o + 10] = ay < by ? (ay < cy ? ay : cy) : (by < cy ? by : cy);
  buf[o + 11] = az < bz ? (az < cz ? az : cz) : (bz < cz ? bz : cz);
  buf[o + 12] = ax > bx ? (ax > cx ? ax : cx) : (bx > cx ? bx : cx);
  buf[o + 13] = ay > by ? (ay > cy ? ay : cy) : (by > cy ? by : cy);
  buf[o + 14] = az > bz ? (az > cz ? az : cz) : (bz > cz ? bz : cz);
}
function sheetSoup(M, FS) {
  const k = window.RELEASE_FAST_OFF ? null : SHEET_SOUP.get(M);
  if (k && k.FS === FS) return k;
  let nT = 0;
  for (const f of M.F) { const v = f.v; if (v && v.length >= 3) nT += v.length - 2; }
  const buf = new Float64Array(nT * 15), tag = new Uint16Array(nT);
  let n = 0;
  for (const f of M.F) {
    const v = f.v; if (!v || v.length < 3) continue;
    const tg = tagOf(f.m || 'sheet');
    for (let i = 1; i + 1 < v.length; i++) {
      const A = M.V[v[0]], B = M.V[v[i]], C = M.V[v[i + 1]];
      tag[n] = tg;
      soupAdd(buf, n++, A[0] * FS, A[1] * FS, A[2] * FS, B[0] * FS, B[1] * FS, B[2] * FS, C[0] * FS, C[1] * FS, C[2] * FS);
    }
  }
  const out = { FS, buf, n, tag };
  SHEET_SOUP.set(M, out);
  return out;
}
// TANK-FIT (3 Nov): THE SOUP IS KEPT WHILE WHAT IT WAS BUILT OFF IS THE SAME. relayout dropped it on every call, and
// a tank drag is a relayout per tick: the engine and the cowl walked afresh (a sixth of ugly_bi's 84 ms tick) over
// meshes that had not moved. The key is the sheet object, the layer meshes themselves (each rebuild of a layer makes
// new ones) with their placement, and the layer frame (inv) by value.
const matSig = m => { let h = 0; const e = m.elements; for (let i = 0; i < 16; i++) h = (h * 31 + Math.round(e[i] * 1e5)) | 0; return h; };
function surfAll(ctx, scene, inv) {
  const M = ctx && ctx.mesh;
  // the engine's and the cowl's meshes, counted first
  const objs = [];
  let nL = 0, sig = inv ? String(matSig(inv)) : 'x';
  if (scene && inv && window.THREE) {
    for (const ch of scene.children) {
      if (!HIT_LAYERS.includes(ch.name || '') || ch.visible === false) continue;
      ch.traverse(o => {
        if (!o.isMesh || !o.geometry || o.visible === false) return;
        const pos = o.geometry.getAttribute('position'); if (!pos) return;
        const idx = o.geometry.index, nT = idx ? idx.count / 3 : pos.count / 3;
        objs.push(o); nL += Math.floor(nT) === nT ? nT : Math.ceil(nT);
        sig += '|' + o.id + ':' + pos.count + ':' + matSig(o.matrixWorld);
      });
    }
  }
  if (SURF_ALL && SURF_ALL.mesh === M && SURF_ALL.sig === sig) return SURF_ALL;
  const TS0 = msNow();
  const sh = (M && M.F && M.V) ? sheetSoup(M, (window.CAGE2 && window.CAGE2.CAGE_UNIT || 1) * ((ctx.P && ctx.P.planeScale) || 1)) : null;
  const nS = sh ? sh.n : 0;
  const buf = new Float64Array((nS + nL) * 15), tag = new Uint16Array(nS + nL);
  if (sh) { buf.set(sh.buf.subarray(0, nS * 15)); if (sh.tag) tag.set(sh.tag.subarray(0, nS)); }
  let n = nS;
  if (objs.length) {
    const Q = new Float64Array(9);
    for (const o of objs) {
      const pos = o.geometry.getAttribute('position');
      const idx = o.geometry.index, nT = idx ? idx.count / 3 : pos.count / 3;
      let top = o; while (top.parent && !HIT_LAYERS.includes(top.name || '')) top = top.parent;
      const tg = tagOf(top.name === 'cageLayer:eng' ? 'engine' : 'cowl');
      // one matrix a mesh (inv x matrixWorld), by hand (TANK-FIT: two applyMatrix4 a vertex were most of the soup)
      const Mx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).elements;
      const A = pos.array, st = pos.isInterleavedBufferAttribute ? pos.data.stride : pos.itemSize, off = pos.offset || 0;
      const plain = !pos.normalized && A && st >= 3, I = idx ? idx.array : null;
      for (let t = 0; t < nT; t++) {
        tag[n] = tg;
        for (let k = 0; k < 3; k++) {
          const vi = I ? I[t * 3 + k] : t * 3 + k;
          let x, y, z;
          if (plain) { const j = vi * st + off; x = A[j]; y = A[j + 1]; z = A[j + 2]; }
          else { x = pos.getX(vi); y = pos.getY(vi); z = pos.getZ(vi); }
          const w = 1 / (Mx[3] * x + Mx[7] * y + Mx[11] * z + Mx[15]);
          Q[k * 3] = (Mx[0] * x + Mx[4] * y + Mx[8] * z + Mx[12]) * w;
          Q[k * 3 + 1] = (Mx[1] * x + Mx[5] * y + Mx[9] * z + Mx[13]) * w;
          Q[k * 3 + 2] = (Mx[2] * x + Mx[6] * y + Mx[10] * z + Mx[14]) * w;
        }
        soupAdd(buf, n++, Q[0], Q[1], Q[2], Q[3], Q[4], Q[5], Q[6], Q[7], Q[8]);
      }
    }
  }
  SURF_ALL = { mesh: M, inv, sig, buf, n, tag, ms: msNow() - TS0, nSheet: nS };
  return SURF_ALL;
}
// the surfaces a drawn tank must not cross, as triangles in this layer's
// frame (the sheet: skin, glass, frame tubes, the dash; the engine; the
// cowl) - only those whose box meets `bb` (each a 15-number view on the soup)
function surfTris(ctx, scene, inv, bb) {
  const out = [];
  const S = surfAll(ctx, scene, inv), b = S.buf;
  for (let i = 0, o = 0; i < S.n; i++, o += 15)
    if (!(b[o + 12] < bb[0] || b[o + 9] > bb[3] || b[o + 13] < bb[1] || b[o + 10] > bb[4] || b[o + 14] < bb[2] || b[o + 11] > bb[5])) out.push(b.subarray(o, o + 15));
  return out;
}
// does the segment c -> q cross any of `tris` (Moller-Trumbore, t in (0, 1))?
function segCrosses(c, q, tris) {
  const dx = q[0] - c[0], dy = q[1] - c[1], dz = q[2] - c[2];
  for (const t of tris) {
    const px = dy * t[8] - dz * t[7], py = dz * t[6] - dx * t[8], pz = dx * t[7] - dy * t[6];
    const det = t[3] * px + t[4] * py + t[5] * pz;
    if (Math.abs(det) < 1e-12) continue;
    const iv = 1 / det, sx = c[0] - t[0], sy = c[1] - t[1], sz = c[2] - t[2];
    const u = (sx * px + sy * py + sz * pz) * iv; if (u < 0 || u > 1) continue;
    const qx = sy * t[5] - sz * t[4], qy = sz * t[3] - sx * t[5], qz = sx * t[4] - sy * t[3];
    const w = (dx * qx + dy * qy + dz * qz) * iv; if (w < 0 || u + w > 1) continue;
    const tt = (t[6] * qx + t[7] * qy + t[8] * qz) * iv;
    if (tt > 1e-6 && tt < 1) return true;
  }
  return false;
}
// the layer-frame box of a mesh (its geometry's box corners through matrixWorld then inv, as each vertex goes) against
// each body's box as pointInBox reads it (a box turned about y: its axis-aligned extent), both padded by a millimetre
// and a millionth of their size - far over the rounding of either path - so a false 'far' cannot be
function meshNearBodies(o, inv, bodies) {
  const g = o.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  if (!bb || !isFinite(bb.min.x) || !isFinite(bb.max.x)) return true;
  const V = new THREE.Vector3(), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 8; k++) {
    V.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
    const q = [V.x, V.y, V.z];
    for (let a = 0; a < 3; a++) { if (!isFinite(q[a])) return true; if (q[a] < lo[a]) lo[a] = q[a]; if (q[a] > hi[a]) hi[a] = q[a]; }
  }
  const pad = a => 1e-3 + 1e-6 * (Math.abs(lo[a]) + Math.abs(hi[a]));
  for (const r of bodies) {
    const c = r.c, e = r.e, cs = Math.abs(Math.cos(r.rot)), sn = Math.abs(Math.sin(r.rot));
    const ex = [cs * e[0] + sn * e[2], e[1], sn * e[0] + cs * e[2]];
    let hit = true;
    for (let a = 0; a < 3 && hit; a++) {
      const p = pad(a) + 1e-6 * Math.abs(c[a]) + 1e-6 * ex[a];
      if (lo[a] > c[a] + ex[a] + p || hi[a] < c[a] - ex[a] - p) hit = false;
    }
    if (hit) return true;
  }
  return false;
}
let LAYOUT_INV = null, LAYOUT_SCENE = null;     // drawResults' standoff test asks the same surfaces
function layerHits(scene, inv, results, ctx) {
  const G = VG();
  if (!G || !scene || !window.THREE) return;
  const bodies = results.filter(r => r.on === 'body' && r.c);
  if (!bodies.length) return;
  const sols = bodies.map(r => vesselSolid(r));
  const DEEP = 0.005;
  const V = new THREE.Vector3();
  for (const ch of scene.children) {
    if (!HIT_LAYERS.includes(ch.name || '') || ch.visible === false) continue;
    const hits = bodies.map(() => 0);
    ch.traverse(o => {
      if (!o.isMesh || !o.geometry || o.visible === false) return;
      const pos = o.geometry.getAttribute('position');
      if (!pos) return;
      // G1455 (RELEASE-FAST): a mesh whose box (its geometry's, through the same two matrices, padded) misses every
      // tank's box cannot put a vertex in one - pointInBox would refuse each; the count is the same without the walk
      if (!meshNearBodies(o, inv, bodies)) return;
      for (let i = 0; i < pos.count; i++) {
        V.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        const p = [V.x, V.y, V.z];
        for (let b = 0; b < bodies.length; b++) if (G.pointInBox(p, bodies[b], 0) && inSolid(p, bodies[b], sols[b], DEEP)) hits[b]++;
      }
    });
    bodies.forEach((r, b) => {
      if (!hits[b]) return;
      r.ok = false;
      r.layerHits = (r.layerHits || 0) + hits[b];
      r.why.push('through the ' + (ch.name === 'cageLayer:eng' ? 'engine' : 'cowl') + ' (' + hits[b] + ' points)');
    });
  }
  const M = ctx && ctx.mesh;
  if (M && M.F && M.V) {
    const FS = (window.CAGE2 && window.CAGE2.CAGE_UNIT || 1) * ((ctx.P && ctx.P.planeScale) || 1);
    const hits = bodies.map(() => 0);
    const ask = (x, y, z) => { const p = [x * FS, y * FS, z * FS]; for (let b = 0; b < bodies.length; b++) if (G.pointInBox(p, bodies[b], 0) && inSolid(p, bodies[b], sols[b], DEEP)) hits[b]++; };
    for (const f of M.F) {
      if (!HIT_SHEET.includes(f.m) || !f.v || f.v.length < 3) continue;
      let cx = 0, cy = 0, cz = 0;
      for (const vi of f.v) { const q = M.V[vi]; ask(q[0], q[1], q[2]); cx += q[0]; cy += q[1]; cz += q[2]; }
      const k = f.v.length; ask(cx / k, cy / k, cz / k);
    }
    bodies.forEach((r, b) => {
      if (!hits[b]) return;
      r.ok = false;
      r.layerHits = (r.layerHits || 0) + hits[b];
      r.why.push('through the dash (' + hits[b] + ' points)');
    });
  }
  // THE DRAWN TANK AGAINST THE DRAWN SURFACES (G1108). The bay fit asks 18
  // points of the BOX against the bay's sections at a 35 mm wall; GATE
  // TANKMOUNT found tanks it passed with their shell 54-59 mm through the
  // skin and the frame tubes (a curved flank between two samples, a tube the
  // sections leave out) and straps 7 mm out. So the verdict asks the gate's
  // own question of what is DRAWN: every vertex of the shell and of the flush
  // hardware (the standoff pieces answer for themselves, drawResults), joined
  // to the solid's centre - does that segment cross the sheet, the engine or
  // the cowl? Only the triangles whose box meets the tank's are tried (a few
  // hundred of ~30 000), a millisecond or two a tank.
  bodies.forEach((r, b) => {
    const sol0 = sols[b];
    if (!sol0 || !sol0.shell || !window.VESSEL_MESH) return;
    const sol = window.VESSEL_MESH.omit ? window.VESSEL_MESH.omit(sol0, STANDOFF) : sol0;
    const D = drawnPts(r, sol, ['shell', 'hard', 'seal', 'mark']);
    const tris = surfTris(ctx, scene, inv, D.bb);
    let n = 0;
    for (const q of D.pts) if (segCrosses(r.c, q, tris)) n++;
    if (!n) return;
    r.ok = false;
    r.layerHits = (r.layerHits || 0) + n;
    r.why.push('through the skin or the frame (' + n + ' drawn points)');
  });
}

// ===========================================================================
// THE CLEARANCE, DRAWN AGAINST DRAWN (TANK-FIT, 2026-11-03)
// ===========================================================================
// The user, 2 Nov: "the tank collision detection. It is unreliable. I can clearly see that tanks touch nothing and
// they're still red. There are empty spaces which cannot be accessed." Measured (tools/tank_fit_probe.js, the cases
// in reports/evidence/TANK-FIT/STATUS.md), the verdict above was four instruments, three of which looked at
// something other than what is drawn:
//   - the BAY FIT (bodyPlace): 18-30 corners of the BOX against the bay's sections INSET BY A 35 MM WALL - ugly_bi's
//     rear tank read "through the skin by 6 mm" with its drawn shell 29 mm clear of the nearest surface;
//   - the BAND (bodyPlace's inBand) and the HAND'S RANGE (outsideHand): rules, not geometry - nothing drawn there;
//   - the CREW against the BOX plus 1 cm (crewHits), not the drawn rounded solid;
//   - the engine and the cowl by vertex-in-box (layerHits), and the drawn shell by segment against the sheet - the
//     one honest test, and the slowest (60 ms a layout on the 172, redone every drag tick).
// THIS replaces all of them for a body tank, with one question asked of what is drawn: the tank's own shell, straps,
// pads and the standoff pieces that stay, against every drawn surface (the sheet: skin, frame, glazing, dash,
// firewall, bulkheads; the engine; the cowl) and the crew's seated bodies. Red is, and only is:
//   - a surface THROUGH the tank: a segment from the tank's centre to one of its drawn points crosses a surface
//     (the depth is how far the point stands past it);
//   - a surface INSIDE the tank: a surface vertex in the drawn solid;
//   - NO ROOM: a drawn point closer than CLEAR_GAP to a surface (a tank needs its pads);
//   - THE CREW: a crew point within CREW_GAP of the drawn solid.
// Each is reported with its distance and WHAT it meets ("3 mm into the frame (woodFrame), left"), and the contact
// point rides on the result (r.clash) for the editor's marker. THE SURFACES are indexed once per airframe (a grid of
// 5 cm cells over the soup, built when the soup is), so a tank asks only the cells it is in: ~1-3 ms a tank, which
// is what lets a drag be judged every frame.
// `window.TANK_FIT_LEGACY = true` puts the old four back (the A/B the false-red table was measured with).
const CLEAR_GAP = 0.005;          // m: a drawn tank closer than this to a drawn surface has no room for its pads
const CREW_GAP = 0.010;           // m: ...and to a person
const GRID_CELL = 0.05;           // m
const NEAR_R = 0.03;              // m: clearances reported up to this; past it the tank is simply clear
const SAMPLE_STEP = 0.008;        // m: the surfaces round a tank are sampled this fine (under 2 x CLEAR_GAP)
const legacyFit = () => !!window.TANK_FIT_LEGACY;
// the words the verdict says for what a tank met (the sheet's material names are the cage's own)
const TAG_WORDS = { body: 'skin', plywood: 'skin', skin: 'skin', ceilingLoop: 'roof frame', floorLoop: 'floor frame',
  waistband: 'waist frame', woodFrame: 'frame', joint: 'frame', tube: 'frame', pillarTail: 'pillar', pillarPassenger: 'pillar',
  pillarCabin: 'pillar', pillarWindow: 'pillar', pillarFront: 'pillar', windshield: 'windscreen', pilotWindow: 'window',
  pasengerWindow: 'window', skyWindows: 'window', drawnPane: 'window', paneEdge: 'window frame', doorSeal: 'door seal',
  bulkhead: 'bulkhead', dash: 'dash', dashFace: 'dash', fireProof: 'firewall', firewall: 'firewall', fireSeal: 'firewall',
  shoulder: 'shoulder', floorBoard: 'floor', seat: 'seat', engine: 'engine', cowl: 'cowl' };
const tagWord = (ti, p) => {
  const raw = TAG_NAMES[ti] || 'surface', w = TAG_WORDS[raw] || raw;
  // the cage's convention (the strut pods: tip x < 0 is L)
  const side = p && Math.abs(p[0]) > 0.06 ? (p[0] < 0 ? ', left' : ', right') : '';
  return w + (w !== raw ? ' (' + raw + ')' : '') + side;
};

// ---- the grid over the soup, TWO LEVELS AND LAZY ------------------------------------------------------------------
// A full 5 cm grid over an aeroplane's 80-95 000 triangles was 130-175 ms a rebuild (measured, ugly_bi), most of it
// over cells no tank will ever ask about (the tail, the cowl's front, the engine's far side). So the triangles are
// dealt into BLOCKS of BLK x BLK x BLK cells (40 cm) once - about one entry a triangle - and a block's own 5 cm cells
// are built the first time a query reaches it, from its own triangles only. A tank asks a few blocks.
const BLK = 8;
let OBST = null;
let JST = new Float64Array(9 * 256);      // judgeTank's subdivision stack, kept between calls
function obstIndex(S) {
  if (OBST && OBST.S === S) return OBST;
  const T0 = msNow();
  const b = S.buf, n = S.n;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0, o = 0; i < n; i++, o += 15) for (let a = 0; a < 3; a++) {
    if (b[o + 9 + a] < lo[a]) lo[a] = b[o + 9 + a];
    if (b[o + 12 + a] > hi[a]) hi[a] = b[o + 12 + a];
  }
  if (!n || ![0, 1, 2].every(a => isFinite(lo[a]) && isFinite(hi[a]))) { OBST = { S, n: 0 }; return OBST; }
  const cell = GRID_CELL;
  const N = [0, 1, 2].map(a => Math.max(1, Math.floor((hi[a] - lo[a]) / cell) + 1));
  const NB = N.map(x => Math.ceil(x / BLK)), nb = NB[0] * NB[1] * NB[2];
  const l0 = lo[0], l1 = lo[1], l2 = lo[2], ib = 1 / (cell * BLK);
  const cl = (v, M) => v < 0 ? 0 : v >= M ? M - 1 : v;
  const bstart = new Int32Array(nb + 1);
  const rg = new Int32Array(n * 6);
  for (let i = 0, o = 0; i < n; i++, o += 15) {
    const k = i * 6;
    rg[k] = cl(Math.floor((b[o + 9] - l0) * ib), NB[0]); rg[k + 1] = cl(Math.floor((b[o + 12] - l0) * ib), NB[0]);
    rg[k + 2] = cl(Math.floor((b[o + 10] - l1) * ib), NB[1]); rg[k + 3] = cl(Math.floor((b[o + 13] - l1) * ib), NB[1]);
    rg[k + 4] = cl(Math.floor((b[o + 11] - l2) * ib), NB[2]); rg[k + 5] = cl(Math.floor((b[o + 14] - l2) * ib), NB[2]);
    for (let x = rg[k]; x <= rg[k + 1]; x++) for (let y = rg[k + 2]; y <= rg[k + 3]; y++)
      for (let z = rg[k + 4]; z <= rg[k + 5]; z++) bstart[(x * NB[1] + y) * NB[2] + z + 1]++;
  }
  for (let c = 0; c < nb; c++) bstart[c + 1] += bstart[c];
  const bat = bstart.slice(0, nb), bidx = new Int32Array(bstart[nb]);
  for (let i = 0; i < n; i++) {
    const k = i * 6;
    for (let x = rg[k]; x <= rg[k + 1]; x++) for (let y = rg[k + 2]; y <= rg[k + 3]; y++)
      for (let z = rg[k + 4]; z <= rg[k + 5]; z++) bidx[bat[(x * NB[1] + y) * NB[2] + z]++] = i;
  }
  OBST = { S, n, lo, cell, N, NB, bstart, bidx, blocks: new Array(nb), built: 0, mark: new Int32Array(n), gen: 0,
           entries: bidx.length, ms: msNow() - T0 };
  return OBST;
}
// a block's own cells (CSR over its BLK^3 cells, local), built on the first ask
function obstBlock(O, bx, by, bz) {
  const bi = (bx * O.NB[1] + by) * O.NB[2] + bz;
  let B = O.blocks[bi];
  if (B) return B;
  const b = O.S.buf, ic = 1 / O.cell, x0 = bx * BLK, y0 = by * BLK, z0 = bz * BLK, nC = BLK * BLK * BLK;
  const start = new Int32Array(nC + 1);
  const cl = v => v < 0 ? 0 : v >= BLK ? BLK - 1 : v;
  const k0 = O.bstart[bi], k1 = O.bstart[bi + 1];
  const rng = new Int32Array((k1 - k0) * 6);
  for (let k = k0, j = 0; k < k1; k++, j += 6) {
    const o = O.bidx[k] * 15;
    rng[j] = cl(Math.floor((b[o + 9] - O.lo[0]) * ic) - x0); rng[j + 1] = cl(Math.floor((b[o + 12] - O.lo[0]) * ic) - x0);
    rng[j + 2] = cl(Math.floor((b[o + 10] - O.lo[1]) * ic) - y0); rng[j + 3] = cl(Math.floor((b[o + 13] - O.lo[1]) * ic) - y0);
    rng[j + 4] = cl(Math.floor((b[o + 11] - O.lo[2]) * ic) - z0); rng[j + 5] = cl(Math.floor((b[o + 14] - O.lo[2]) * ic) - z0);
    for (let x = rng[j]; x <= rng[j + 1]; x++) for (let y = rng[j + 2]; y <= rng[j + 3]; y++)
      for (let z = rng[j + 4]; z <= rng[j + 5]; z++) start[(x * BLK + y) * BLK + z + 1]++;
  }
  for (let c = 0; c < nC; c++) start[c + 1] += start[c];
  const at = start.slice(0, nC), idx = new Int32Array(start[nC]);
  for (let k = k0, j = 0; k < k1; k++, j += 6) {
    const t = O.bidx[k];
    for (let x = rng[j]; x <= rng[j + 1]; x++) for (let y = rng[j + 2]; y <= rng[j + 3]; y++)
      for (let z = rng[j + 4]; z <= rng[j + 5]; z++) idx[at[(x * BLK + y) * BLK + z]++] = t;
  }
  O.built++;
  return (O.blocks[bi] = { start, idx });
}
// the triangles of one cell (global cell coordinates), handed to fn(i) - each once per query generation g
function obstCell(O, cx, cy, cz, g, fn) {
  const B = obstBlock(O, (cx / BLK) | 0, (cy / BLK) | 0, (cz / BLK) | 0);
  const lc = ((cx % BLK) * BLK + (cy % BLK)) * BLK + (cz % BLK);
  for (let k = B.start[lc], k1 = B.start[lc + 1]; k < k1; k++) {
    const i = B.idx[k];
    if (O.mark[i] === g) continue;
    O.mark[i] = g; fn(i);
  }
}
// every triangle whose cell meets the box [qlo, qhi], once each, handed to fn(i)
function obstEach(O, qlo, qhi, fn) {
  if (!O.n) return;
  const g = ++O.gen, r = [];
  for (let a = 0; a < 3; a++) {
    const c0 = Math.max(0, Math.floor((qlo[a] - O.lo[a]) / O.cell)), c1 = Math.min(O.N[a] - 1, Math.floor((qhi[a] - O.lo[a]) / O.cell));
    if (c0 > c1) return;
    r.push(c0, c1);
  }
  for (let x = r[0]; x <= r[1]; x++) for (let y = r[2]; y <= r[3]; y++) for (let z = r[4]; z <= r[5]; z++) obstCell(O, x, y, z, g, fn);
}
// THE FIRST SURFACE ON THE SEGMENT c -> q (the cells it passes, walked in order - Amanatides & Woo), as the fraction
// along it, or null. Moller-Trumbore on the soup's own (a, b - a, c - a).
function obstSeg(O, c, q, only) {
  if (!O.n) return null;
  const b = O.S.buf, g = ++O.gen, tg = O.S.tag;
  const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
  let best = null;
  const tri = i => {
    if (only != null && tg[i] !== only) return;
    const o = i * 15;
    const px = d[1] * b[o + 8] - d[2] * b[o + 7], py = d[2] * b[o + 6] - d[0] * b[o + 8], pz = d[0] * b[o + 7] - d[1] * b[o + 6];
    const det = b[o + 3] * px + b[o + 4] * py + b[o + 5] * pz;
    if (Math.abs(det) < 1e-14) return;
    const iv = 1 / det, sx = c[0] - b[o], sy = c[1] - b[o + 1], sz = c[2] - b[o + 2];
    const u = (sx * px + sy * py + sz * pz) * iv; if (u < 0 || u > 1) return;
    const qx = sy * b[o + 5] - sz * b[o + 4], qy = sz * b[o + 3] - sx * b[o + 5], qz = sx * b[o + 4] - sy * b[o + 3];
    const w = (d[0] * qx + d[1] * qy + d[2] * qz) * iv; if (w < 0 || u + w > 1) return;
    const t = (b[o + 6] * qx + b[o + 7] * qy + b[o + 8] * qz) * iv;
    if (t > 1e-9 && t < 1 && (!best || t < best.t)) best = { t, i };
  };
  // the walk
  const cell = [0, 1, 2].map(a => Math.floor((c[a] - O.lo[a]) / O.cell));
  const end = [0, 1, 2].map(a => Math.floor((q[a] - O.lo[a]) / O.cell));
  const step = [0, 1, 2].map(a => d[a] > 0 ? 1 : d[a] < 0 ? -1 : 0);
  const tMax = [0, 1, 2].map(a => step[a] === 0 ? Infinity : ((O.lo[a] + (cell[a] + (step[a] > 0 ? 1 : 0)) * O.cell) - c[a]) / d[a]);
  const tDel = [0, 1, 2].map(a => step[a] === 0 ? Infinity : O.cell / Math.abs(d[a]));
  for (let guard = 0; guard < 4096; guard++) {
    if (cell[0] >= 0 && cell[0] < O.N[0] && cell[1] >= 0 && cell[1] < O.N[1] && cell[2] >= 0 && cell[2] < O.N[2])
      obstCell(O, cell[0], cell[1], cell[2], g, tri);
    if (cell[0] === end[0] && cell[1] === end[1] && cell[2] === end[2]) break;
    const a = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
    if (tMax[a] > 1 + 1e-9) break;
    // the hit found so far lies before this boundary: nothing further on can be nearer
    if (best && best.t <= tMax[a]) break;
    cell[a] += step[a]; tMax[a] += tDel[a];
  }
  return best;
}
// the squared distance from p to soup triangle i (Ericson 5.1.5), and the closest point into `out`
function triD2(b, i, px, py, pz, out) {
  const o = i * 15;
  const ax = b[o], ay = b[o + 1], az = b[o + 2];
  const abx = b[o + 3], aby = b[o + 4], abz = b[o + 5], acx = b[o + 6], acy = b[o + 7], acz = b[o + 8];
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let cx, cy, cz;
  const set = (x, y, z) => { cx = x; cy = y; cz = z; };
  if (d1 <= 0 && d2 <= 0) set(ax, ay, az);
  else {
    const bpx = apx - abx, bpy = apy - aby, bpz = apz - abz;
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) set(ax + abx, ay + aby, az + abz);
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); set(ax + v * abx, ay + v * aby, az + v * abz); }
      else {
        const cpx = apx - acx, cpy = apy - acy, cpz = apz - acz;
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) set(ax + acx, ay + acy, az + acz);
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); set(ax + w * acx, ay + w * acy, az + w * acz); }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
              const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
              set(ax + abx + w * (acx - abx), ay + aby + w * (acy - aby), az + abz + w * (acz - abz));
            } else {
              const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
              set(ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w);
            }
          }
        }
      }
    }
  }
  if (out) { out[0] = cx; out[1] = cy; out[2] = cz; }
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) + (pz - cz) * (pz - cz);
}
// the nearest surface to p within R: { d, i } or null
function obstNear(O, p, R) {
  if (!O.n) return null;
  const b = O.S.buf;
  let best = null, R2 = R * R;
  obstEach(O, [p[0] - R, p[1] - R, p[2] - R], [p[0] + R, p[1] + R, p[2] + R], i => {
    const o = i * 15;
    if (b[o + 9] > p[0] + R || b[o + 12] < p[0] - R || b[o + 10] > p[1] + R || b[o + 13] < p[1] - R || b[o + 11] > p[2] + R || b[o + 14] < p[2] - R) return;
    const d2 = triD2(b, i, p[0], p[1], p[2]);
    if (d2 < R2) { R2 = d2; best = { d2, i }; }
  });
  if (best) best.d = Math.sqrt(best.d2);
  return best;
}
// IN THE DRAWN SOLID BY d (d > 0: that deep inside; d < 0: within -d outside, a box-like swell - the crew's margin)
function inSolidBy(p, r, sol, d) {
  if (d >= 0) return inSolid(p, r, sol, d);
  const VM = window.VESSEL_MESH;
  if (!sol || !sol.shape || !VM) return false;
  const yaw = r.rot + (sol.yaw || 0), cs = Math.cos(yaw), sn = Math.sin(yaw);
  const dx = p[0] - r.c[0], dy = p[1] - r.c[1], dz = p[2] - r.c[2], m = -d;
  const X = Math.max(0, Math.abs(dx * cs - dz * sn) - m), Z = Math.max(0, Math.abs(dx * sn + dz * cs) - m);
  const yy = [dy, dy > 0 ? Math.max(0, dy - m) : Math.min(0, dy + m)];
  for (const Y of yy) {
    if (sol.shape.contains) { if (sol.shape.contains(X, Y, Z)) return true; continue; }
    if (Z > sol.e[2]) continue;
    const sec = sol.shape.atZ(Z);
    if (sec && sec.hx > 0 && X <= sec.hx && Math.abs(Y) <= VM.heightAt(sec, X)) return true;
  }
  return false;
}
// how deep inside (m), bisected to a millimetre (0 when not inside)
function depthIn(p, r, sol, hi) {
  if (!inSolid(p, r, sol, 0)) return 0;
  let a = 0, b = hi || 0.3;
  for (let k = 0; k < 9; k++) { const m = 0.5 * (a + b); if (inSolid(p, r, sol, m)) a = m; else b = m; }
  return a;
}
// the crew points' names (seat, the occupant's body...) by mesh, gathered with the points
const crewWord = n => /pick/i.test(n) ? 'a crew member' : /seat/i.test(n) ? 'a seat' : /stick|yoke|wheel/i.test(n) ? 'the controls'
  : /pedal|rudder/i.test(n) ? 'the pedals' : /panel|dash/i.test(n) ? 'the panel' : 'the crew';

// ONE TANK, JUDGED. r: a body placement (c, e, rot, v) - sets r.ok, r.why, r.clash, r.clear, r.drawn, r.omitted
// JUDGE.drag: a drag frame's budget (fewer, coarser pieces once red - the release judges whole); JUDGE.fast: stop at
// the first contact (fitOf's fast search: only the verdict is wanted)
const JUDGE = { drag: false, fast: false };
function judgeTank(ctx, scene, inv, r) {
  const VM = window.VESSEL_MESH;
  // (a LIGHT solid - the shape alone, no mesh, no hardware: the auto-fit's search, which judges a new size every step
  //  and built a whole drawn tank for each, 20-60 ms apiece; the drawn tank is judged whole by the layout after)
  const sol0 = r.lightSolid || vesselSolid(r);
  if (!sol0 || !(sol0.shell || sol0.light) || !VM) return;
  const S = surfAll(ctx, scene, inv), O = obstIndex(S), tag = S.tag;
  const yaw = r.rot + (sol0.yaw || 0);
  const tj0 = msNow();
  // 1. THE STANDOFF PIECES (the filler neck, the vent, the outlet, the sump...) are drawn only where they clear:
  //    each is asked the same two questions (through a surface, or closer than the gap), and one that fails is left
  //    off the drawing (G1108's rule, now on the same instrument as the tank)
  //    A piece is a chain of vertices from the shell outward: each (4 mm apart) is asked whether a surface is within
  //    the gap of it, and whether one lies between the tank's centre and it
  const drop = [];
  if (sol0.pieces) for (const pc of sol0.pieces) {
    if (!STANDOFF.includes(pc.name)) continue;
    const D = drawnPts(r, sol0, ['hard', 'seal', 'mark'], pc);
    if (!D.pts.length) continue;
    const seen = new Set();
    let far = null, farD = -1, hit = false;
    for (const q of D.pts) {
      const d2 = (q[0] - r.c[0]) ** 2 + (q[1] - r.c[1]) ** 2 + (q[2] - r.c[2]) ** 2;
      if (d2 > farD) { farD = d2; far = q; }
      const k = Math.round(q[0] / 0.004) + ',' + Math.round(q[1] / 0.004) + ',' + Math.round(q[2] / 0.004);
      if (seen.has(k)) continue;
      seen.add(k);
      // (and a segment from the tank's centre to every one: a pipe crosses a skin between two of its rings with no
      // vertex near it - GATE TANKMOUNT's pusherPod vent, 34.7 mm out with every vertex over 5 mm from the sheet)
      if (obstNear(O, q, CLEAR_GAP) || obstSeg(O, r.c, q)) { hit = true; break; }
    }
    if (hit || (far && obstSeg(O, r.c, far))) drop.push(pc.name);
  }
  const sol = drop.length && VM.omit ? omitMemo(sol0, drop) : sol0;
  r.solid = sol0; r.drawn = sol; r.omitted = drop;
  const solAll = VM.omit ? omitMemo(sol0, STANDOFF) : sol0;
  const tj1 = msNow();
  // 2. THE SURFACES AROUND THE TANK, SAMPLED, AGAINST THE DRAWN SOLID. The shell's own vertices are too few to ask
  //    (a box's flat face is two triangles 0.4 m long: a frame tube can cross it between them - the legacy segment
  //    test was blind there), so the question is turned round: every drawn triangle whose box meets the tank's
  //    (swollen by NEAR_R) is sampled every SAMPLE_STEP, and each sample asked of the tank's EXACT solid (the shape
  //    VESSEL_MESH draws, its rounded corners included): inside it (a contact: how deep), within CLEAR_GAP of it
  //    (no room), or how near (the readout). Exact where it matters, and a few thousand analytic tests a tank.
  const b = S.buf, bb0 = solAll.light ? lightBox(r, solAll) : drawnPts(r, solAll, ['shell']).bb, R = NEAR_R;
  const bb = [bb0[0] - R, bb0[1] - R, bb0[2] - R, bb0[3] + R, bb0[4] + R, bb0[5] + R];
  let inside = null, nInside = 0, nThin = 0, near = [], coarse = Infinity, coarseTag = -1, coarseAt = null, leaves = 0;
  // the solid's own frame: the slot meshes' centre and turn (inSolid's), and its box (the solid lies inside it, so a
  // distance to the box is a LOWER bound of the distance to the solid - a piece of surface farther than CLEAR_GAP
  // from the box is clear, and is not refined)
  const yw = r.rot + (solAll.yaw || 0), ycs = Math.cos(yw), ysn = Math.sin(yw), c0 = r.c, E3 = solAll.e || r.e;
  const loc = (x, y, z, out, k) => { const dx = x - c0[0], dz = z - c0[2]; out[k] = dx * ycs - dz * ysn; out[k + 1] = y - c0[1]; out[k + 2] = dx * ysn + dz * ycs; };
  const Lq = new Float64Array(9), smp = [0, 0, 0], pv = [0, 0, 0], t = new Float64Array(9);
  // the pieces still to look at, flat (nine numbers each): no array a piece (the allocation was most of the cost)
  let ST = JST, sp = 0;
  const push = (a0, a1, a2, b0, b1, b2, c0, c1, c2) => {
    if ((sp + 1) * 9 > ST.length) { const g = new Float64Array(ST.length * 2); g.set(ST); ST = JST = g; }
    const k = sp++ * 9; ST[k] = a0; ST[k + 1] = a1; ST[k + 2] = a2; ST[k + 3] = b0; ST[k + 4] = b1; ST[k + 5] = b2; ST[k + 6] = c0; ST[k + 7] = c1; ST[k + 8] = c2;
  };
  const inV = k => { pv[0] = t[k]; pv[1] = t[k + 1]; pv[2] = t[k + 2]; return inSolid(pv, r, solAll, 0); };
  const LEVELS = [CLEAR_GAP, 0.010, 0.020, NEAR_R];
  const convex = !(solAll.shape && solAll.shape.form === 'deck');
  const deckTop = !convex && solAll.shape.atZ && solAll.shape.atZ(0) && solAll.shape.atZ(0).topAt ? solAll.shape.atZ(0).topAt : null;
  const BUDGET = JUDGE.drag ? 600 : 2000, RED_BUDGET = JUDGE.drag ? 120 : 400;
  let redAt = 0;
            // leaves a tank: past it the verdict is already red, and its depth is good enough
  try { obstEach(O, [bb[0], bb[1], bb[2]], [bb[3], bb[4], bb[5]], i => {
    const o = i * 15;
    if (b[o + 9] > bb[3] || b[o + 12] < bb[0] || b[o + 10] > bb[4] || b[o + 13] < bb[1] || b[o + 11] > bb[5] || b[o + 14] < bb[2]) return;
    let triIn = null, triLv = LEVELS.length, triAt = null;
    sp = 0;
    push(b[o], b[o + 1], b[o + 2], b[o] + b[o + 3], b[o + 1] + b[o + 4], b[o + 2] + b[o + 5], b[o] + b[o + 6], b[o + 1] + b[o + 7], b[o + 2] + b[o + 8]);
    while (sp) {
      sp--; for (let q = 0; q < 9; q++) t[q] = ST[sp * 9 + q];
      loc(t[0], t[1], t[2], Lq, 0); loc(t[3], t[4], t[5], Lq, 3); loc(t[6], t[7], t[8], Lq, 6);
      let gap = 0;
      for (let a = 0; a < 3; a++) {
        const lo = Math.min(Lq[a], Lq[a + 3], Lq[a + 6]), hi = Math.max(Lq[a], Lq[a + 3], Lq[a + 6]);
        gap = Math.max(gap, lo - E3[a], -E3[a] - hi);
      }
      // A DECK's top falls toward its flanks, under its box's lid: the deck skin over the shoulders is inside the box
      // and outside the tank, and the box's bound refined all of it to 8 mm leaves (the Cub's fitted tank: 100 ms a
      // judgement). Its top at the piece's nearest |x| is the highest the tank reaches there - the bound from above.
      if (deckTop && gap <= CLEAR_GAP) {
        const xl = Math.min(Lq[0], Lq[3], Lq[6]), xh = Math.max(Lq[0], Lq[3], Lq[6]);
        const ax = xl <= 0 && xh >= 0 ? 0 : Math.min(Math.abs(xl), Math.abs(xh));
        if (ax < E3[0]) gap = Math.max(gap, Math.min(Lq[1], Lq[4], Lq[7]) - deckTop(ax));
      }
      if (gap > R) continue;
      if (gap > CLEAR_GAP) { if (gap < coarse) { coarse = gap; coarseTag = tag[i]; coarseAt = [(t[0] + t[3] + t[6]) / 3, (t[1] + t[4] + t[7]) / 3, (t[2] + t[5] + t[8]) / 3]; } continue; }
      // ALL THREE CORNERS INSIDE: the piece is inside whole (a box and a cylinder are convex; a deck's top bends
      // in by its profile, and a triangle spanning it is refined as before) - a contact, not refined further
      if (convex && inV(0) && inV(3) && inV(6)) {
        nInside += 3;
        const cen = [(t[0] + t[3] + t[6]) / 3, (t[1] + t[4] + t[7]) / 3, (t[2] + t[5] + t[8]) / 3];
        if (!triIn || (inSolid(cen, r, solAll, 0.01) && !inSolid(triIn, r, solAll, 0.01))) triIn = cen;
        continue;
      }
      const e1 = Math.hypot(t[3] - t[0], t[4] - t[1], t[5] - t[2]), e2 = Math.hypot(t[6] - t[0], t[7] - t[1], t[8] - t[2]), e3 = Math.hypot(t[6] - t[3], t[7] - t[4], t[8] - t[5]);
      // a contact is looked for on the way down (the piece's centre), so a red tank switches to the coarse report
      // after the first one instead of refining the whole crossing at the fine step
      if (!nInside) {
        smp[0] = (t[0] + t[3] + t[6]) / 3; smp[1] = (t[1] + t[4] + t[7]) / 3; smp[2] = (t[2] + t[5] + t[8]) / 3;
        if (inSolid(smp, r, solAll, 0)) { nInside++; triIn = smp.slice(); redAt = leaves; }
      }
      // once the tank is known red by a contact, the rest is only its report: 3 cm pieces find the deepest well enough
      if (Math.max(e1, e2, e3) > (nInside ? 0.032 : SAMPLE_STEP) && leaves < BUDGET && (!nInside || leaves - redAt < RED_BUDGET)) {
        const ax = (t[0] + t[3]) / 2, ay = (t[1] + t[4]) / 2, az = (t[2] + t[5]) / 2;      // m01
        const bx = (t[3] + t[6]) / 2, by = (t[4] + t[7]) / 2, bz = (t[5] + t[8]) / 2;      // m12
        const cx = (t[0] + t[6]) / 2, cy = (t[1] + t[7]) / 2, cz = (t[2] + t[8]) / 2;      // m02
        push(t[0], t[1], t[2], ax, ay, az, cx, cy, cz);
        push(ax, ay, az, t[3], t[4], t[5], bx, by, bz);
        push(cx, cy, cz, bx, by, bz, t[6], t[7], t[8]);
        push(ax, ay, az, bx, by, bz, cx, cy, cz);
        continue;
      }
      leaves++;
      for (let k = 0; k < 4; k++) {
        if (k < 3) { smp[0] = t[k * 3]; smp[1] = t[k * 3 + 1]; smp[2] = t[k * 3 + 2]; }
        else { smp[0] = (t[0] + t[3] + t[6]) / 3; smp[1] = (t[1] + t[4] + t[7]) / 3; smp[2] = (t[2] + t[5] + t[8]) / 3; }
        if (inSolid(smp, r, solAll, 0)) {
          nInside++;
          if (!triIn || (inSolid(smp, r, solAll, 0.01) && !inSolid(triIn, r, solAll, 0.01))) triIn = smp.slice();
          continue;
        }
        if (triIn || nInside) continue;
        for (let q = 0; q < triLv; q++) if (inSolidBy(smp, r, solAll, -LEVELS[q])) { triLv = q; triAt = smp.slice(); break; }
      }
    }
    if (triIn) {
      // measured only when it could be the deepest yet (inside at the depth already found)
      if (!inside || inSolid(triIn, r, solAll, inside.depth + 0.001)) {
        const dep = depthIn(triIn, r, solAll, Math.max(r.e[0], r.e[1], r.e[2]));
        if (!inside || dep > inside.depth) inside = { depth: dep, tag: tag[i], at: triIn };
      }
    } else if (triAt) { if (triLv === 0) nThin++; near.push({ lv: triLv, at: triAt, tag: tag[i] }); }
    if (JUDGE.fast && inside) throw JUDGE;          // the verdict is known: red
  }); } catch (e) { if (e !== JUDGE) throw e; }
  // the nearest, to a millimetre: the candidates at the lowest level found, bisected (the swell's own measure)
  let minD = Infinity, minAt = null, minTag = -1;
  if (near.length) {
    const lv0 = Math.min(...near.map(q => q.lv));
    for (const q of near.filter(q => q.lv === lv0).slice(0, 12)) {
      let a = lv0 ? LEVELS[lv0 - 1] : 0, z = LEVELS[lv0];
      for (let k = 0; k < 7; k++) { const m = 0.5 * (a + z); if (inSolidBy(q.at, r, solAll, -m)) z = m; else a = m; }
      if (z < minD) { minD = z; minAt = q.at; minTag = q.tag; }
    }
  }
  // ...or the coarse bound, where nothing came within the gap (the box's distance: a lower bound, to the box's mm)
  if (coarse < minD) { minD = coarse; minAt = coarseAt; minTag = coarseTag; }
  const thin = minD < CLEAR_GAP ? { d: minD, tag: minTag, at: minAt } : null;
  const through = null, nThrough = 0;
  const D = { pts: [], bb: bb0 };
  const tj2 = msNow();
  const tj3 = msNow();
  // 4. THE CREW, their seated bodies as drawn (the posed body, G3700), against the drawn solid swollen by CREW_GAP
  let crew = null, nCrew = 0;
  if (scene) {
    if (!CREW_PTS) CREW_PTS = crewPoints(scene, inv);
    const P3 = CREW_PTS.buf, m = CREW_GAP, q = [0, 0, 0];
    crewEach(CREW_PTS, [bb0[0] - m, bb0[1] - m, bb0[2] - m], [bb0[3] + m, bb0[4] + m, bb0[5] + m], i => {
      q[0] = P3[i * 3]; q[1] = P3[i * 3 + 1]; q[2] = P3[i * 3 + 2];
      if (q[0] < bb0[0] - m || q[0] > bb0[3] + m || q[1] < bb0[1] - m || q[1] > bb0[4] + m || q[2] < bb0[2] - m || q[2] > bb0[5] + m) return;
      if (!inSolidBy(q, r, solAll, -m)) return;
      nCrew++;
      // the deepest, sampled (a foot through a tank is hundreds of points)
      if (nCrew <= 48 || nCrew % 16 === 0) {
        const dep = depthIn(q, r, solAll, Math.max(r.e[0], r.e[1], r.e[2]));
        if (!crew || dep > crew.depth) crew = { depth: dep, at: q.slice(), who: CREW_PTS.word ? CREW_PTS.word(i) : 'the crew' };
      }
    });
  }
  r.crewHits = nCrew;
  r.layerHits = nThrough + nInside;
  r.jms = { pieces: tj1 - tj0, surf: tj2 - tj1, hard: tj3 - tj2, crew: msNow() - tj3, nIn: nInside, nThin, leaves };
  const mm = x => Math.max(0, Math.round(x * 1000));
  const why = [], marks = [];
  if (through) { why.push(mm(through.depth) + ' mm through the ' + tagWord(through.tag, through.hit) + (nThrough > 1 ? ' (' + nThrough + ' drawn points past it)' : '')); marks.push(through.hit); }
  if (inside) { why.push(mm(inside.depth) + ' mm into the ' + tagWord(inside.tag, inside.at)); marks.push(inside.at); }
  if (!through && !inside && thin) { why.push('no room for the pads: ' + mm(thin.d) + ' mm to the ' + tagWord(thin.tag, thin.at) + ' (needs ' + mm(CLEAR_GAP) + ')'); marks.push(thin.at); }
  if (nCrew) { why.push((crew && crew.depth > 0 ? mm(crew.depth) + ' mm into ' : 'within ' + mm(CREW_GAP) + ' mm of ') + (crew ? crew.who : 'the crew')); if (crew) marks.push(crew.at); }
  r.clear = minD < Infinity ? minD : NEAR_R;
  r.clearTo = minTag >= 0 ? tagWord(minTag, minAt) : null;
  r.clash = why.length ? { at: marks[0], marks: marks.slice(1), through, inside, thin, crew: crew ? { depth: crew.depth, at: crew.at, n: nCrew } : null } : null;
  if (why.length) { r.ok = false; r.why.push(...why); }
}
// THE STRUT PODS' CLEARANCE (TANK-FIT, Part 3): the drawn spindle (r = R (1 - (2u-1)^2)^0.65 on its fore-aft axis)
// sampled at its lathe's own stations, each point asked for the nearest drawn surface (the sheet, the engine, the
// cowl - the clearance soup) and whether a surface lies between the pod's axis and it
const PYLON_H = 0.04;
function podClear(ctx, scene, inv, pods) {
  const S = surfAll(ctx, scene, inv), O = obstIndex(S);
  if (!O.n) return null;
  for (const pd of pods) {
    const NP = 12, NR = 16;
    for (let k = 0; k <= NP; k++) {
      const u = k / NP, s = 1 - (2 * u - 1) * (2 * u - 1);
      const rr = Math.max(0.002, 0.5 * pd.D * Math.pow(Math.max(0, s), 0.65)), z = pd.c[2] + (u - 0.5) * pd.L;
      const ax = [pd.c[0], pd.c[1], z];
      for (let j = 0; j < NR; j++) {
        const a = 2 * Math.PI * j / NR, q = [pd.c[0] + rr * Math.cos(a), pd.c[1] + rr * Math.sin(a), z];
        const h = obstSeg(O, ax, q);
        if (h) return { why: 'the pod runs into the ' + tagWord(S.tag[h.i], q), at: q };
        const nb = obstNear(O, q, CLEAR_GAP);
        if (nb) return { why: 'no room for the pod: ' + Math.round(nb.d * 1000) + ' mm to the ' + tagWord(S.tag[nb.i], q), at: q };
      }
    }
  }
  return null;
}
// THE LIGHT SOLID: VESSEL_MESH.build's own shape for these extents (its canonical turn, its corner radius), and its box
function lightSolid(r, form, profile) {
  const VM = window.VESSEL_MESH;
  if (!VM || !VM.mkShape) return null;
  const e0 = r.e.map(x => Math.max(0.02, x));
  const swap = form !== 'deck' && e0[0] > e0[2] * 1.15;
  const e = swap ? [e0[2], e0[1], e0[0]] : e0;
  const rBox = EN.kind === 'battery' ? Math.max(0.005, Math.min(0.030, 0.10 * Math.min(e[0], e[1], e[2])))
                                     : Math.max(0.008, Math.min(0.075, 0.34 * Math.min(e[0], e[1], e[2])));
  const fm = form === 'cyl' ? 'cyl' : (form === 'deck' && Array.isArray(profile)) ? 'deck' : 'box';
  return { light: true, shape: VM.mkShape(fm, e, { r: rBox, dome: 0.30, profile }), e, yaw: swap ? Math.PI / 2 : 0, form: fm };
}
function lightBox(r, sol) {
  const yaw = r.rot + (sol.yaw || 0), cs = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw)), e = sol.e, c = r.c;
  const ex = cs * e[0] + sn * e[2], ez = sn * e[0] + cs * e[2];
  return [c[0] - ex, c[1] - e[1], c[2] - ez, c[0] + ex, c[1] + e[1], c[2] + ez];
}
// ALL BODY TANKS (the layout's and fitOf's door)
function judgeAll(scene, inv, results, ctx) {
  for (const r of results) if (r.on === 'body' && r.c) judgeTank(ctx, scene, inv, r);
}

// ===========================================================================
// THE NOSE TANK, FITTED TO THE NOSE (TANK-FIT Part 2, 2026-11-03)
// ===========================================================================
// The user, 2 Nov: "I'm wondering if the nose section shouldn't be a shape auto fit like the wings, taking that
// space behind the dashboard (10 cm gap), shaped like the top of the nose with a gap, and stopped at the bottom of
// the dash? That would allow realistic fuel capacities there. Our [current one] always truncates."
// The wing tank is its spar bay's own section (G445.2); this is the nose bay's: a DECK tank (G1150's form - a flat
// floor, a top following a profile across the width, the same section along its length) measured off what is drawn,
// with the clearance's own grid of surfaces:
//   back    the dash and the instruments standing forward of it (the crew layer's panel), + NOSE_PANEL_ROOM: the
//           room the instruments are connected in (the user, 3 Nov: "space dash firewall ... could be 5"; the pitot /
//           static fittings and their hoses' turn, a harness plug: 4-5 cm behind a 3-1/8" case)
//   front   the firewall (the first surface ahead, low in the space), less NOSE_CLR
//   floor   just above the pilot's feet and legs, the pedals and the controls under the tank's footprint (+ CREW_GAP):
//           the user, 3 Nov: it "may [go below the dash], it should just not hit the pilot's feet or legs"; never
//           below the keel's inner skin (+ NOSE_CLR)
//   top     each column's ceiling - the deck's inner skin, the lowest over the tank's length - less the GAP (2 cm)
//   width   the narrowest inner width over the length, at the floor and up the walls, less NOSE_CLR a side
// then placed and JUDGED like any tank (judgeTank), and made smaller (height, then length) until it clears. The
// litres are its own (the deck form's capacity: the section's area, the shell's fill): no box, no truncation.
// It is the shape of a nose tank that says `fit: 'auto'` (a new nose tank, the panel's 'auto-fit' row) and of NONE
// other... and of a save's nose tank left to the bay rule (no station, no box: the validated Cub's and Jodel's) -
// the user's call, 3 Nov: "Yes" (`window.TANK_NOSE_AUTO_ALL = false` puts the old shaping back, the A/B).
const NOSE_AUTO_ON = true;  // the auto-fit itself (TANK-FIT commit 2; commit 1 lands with it off)
const NOSE_GAP = 0.02;            // m under the deck top (the pads and the straps; the panel's row can change it)
const NOSE_PANEL_ROOM = 0.05;     // m behind the instruments' cases: their connections (a row too)
const NOSE_CASE_DEPTH = 0.10;     // m: the instruments' cases behind the panel's face (drawn as faces only)
const NOSE_CLR = 0.02;            // m to the firewall and the walls (the pads, the straps)
const NOSE_AUTO = new Map();      // the fitted shape, by body, gap and the crew's points
function noseAutoWanted(v, bay) {
  if (!NOSE_AUTO_ON || !bay || bay.key !== 'nose' || legacyFit()) return false;
  if (v.fit === 'auto') return true;
  // the user, 3 Nov ("Yes"): the saves' nose tanks left to the bay rule (no station, no box of their own - the
  // validated Cub's and Jodel's) take the auto shape too; `window.TANK_NOSE_AUTO_ALL = false` is the old rule (the A/B)
  return window.TANK_NOSE_AUTO_ALL !== false && v.along == null && !v.dims;
}
// THE FIRST SHAPING IS SLICED (TANK-FIT, the user via A0 3 Nov: "move the auto-fit's first shaping off the main
// thread - the phone"). A first shaping is 0.3-1.1 s of rays and judgements (node; once per body change, then cached),
// which on the phone was a frozen garage. The shaping is a generator that yields after every floor it measures and
// every candidate it judges; on a page it runs in ~4 ms slices, one per frame (NOSE_JOB), the tank reads "fitting to
// the nose" meanwhile and is neither drawn nor written back, and the slice that finishes lays the tanks out again (the
// shape then comes from the cache, drawn and committed). Not a Worker: the shaping asks the layer's own surfaces, the
// crew's points and the drawn solid (VESSEL_MESH) - all on this thread - and a slice of the same code is the same
// answer, bit for bit. Under node (the gates, the tools, the load chain: navigator.userAgent 'node') and with
// window.TANK_AUTO_SYNC it runs to the end at once, as before.
let NOSE_KEY_LAST = null, NOSE_JOB = null;
const noseSliced = () => !window.TANK_AUTO_SYNC && typeof navigator !== 'undefined' && !!navigator.userAgent && navigator.userAgent !== 'node';
const noseSchedule = fn => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
function noseAuto(ctx, inv, bay, v, zFw, cache) {
  const g = noseAutoGen(ctx, inv, bay, v, zFw, cache);
  let r = g.next();
  if (r.done) return r.value;                               // cached, or nothing to shape
  if (!noseSliced()) { while (!r.done) r = g.next(); return r.value; }
  const key = NOSE_KEY_LAST;
  if (NOSE_JOB && NOSE_JOB.key === key) return { pending: true };   // (already on its way: this start is dropped)
  const job = NOSE_JOB = { key, g, r, t0: msNow() };
  const tick = () => {
    if (NOSE_JOB !== job) return;                            // a newer body's shaping took over
    const t0 = msNow();
    let st = job.r;
    try { while (!st.done && msNow() - t0 < 4) st = job.g.next(); }
    catch (e) { NOSE_JOB = null; console.error('energy: the nose shaping', e); return; }   // (a throw must not leave this job holding its key: every later start would read pending)
    job.r = st;
    if (!st.done) { noseSchedule(tick); return; }
    NOSE_JOB = null;
    LAST.noseMs = msNow() - job.t0;
    try { relayout(); } catch (e) { console.error('energy: the nose shaping', e); }
  };
  noseSchedule(tick);
  return { pending: true };
}
function* noseAutoGen(ctx, inv, bay, v, zFw, cache) {
  const FS = fsOf(ctx), M = ctx.mesh;
  if (!M || zFw == null || !cache) return null;
  const gap = v.gap != null ? Math.max(0.0, Math.min(0.3, +v.gap)) : NOSE_GAP;
  const S = surfAll(ctx, ctx.scene, inv), O = obstIndex(S);
  if (!CREW_PTS || !crewFresh(ctx.scene, inv)) CREW_PTS = crewPoints(ctx.scene, inv);
  const key = BODY_SIG + '|' + S.sig.length + ':' + S.n + '|' + (CREW_PTS.sig || '').length + ':' + CREW_PTS.n + '|' + gap.toFixed(3) + '|' + (v.room != null ? (+v.room).toFixed(3) : 'r') + '|' + EN.kind + '|' + vesselKey();
  if (NOSE_AUTO.has(key)) return NOSE_AUTO.get(key);
  NOSE_KEY_LAST = key;
  const zOfA = a => zFw * FS - a;
  // the bay's span along the body, and its section in the middle
  const aLo = Math.min(bay.x0, bay.hx0 != null ? bay.hx0 : bay.x0), aHi = Math.max(bay.x1, bay.hx1 != null ? bay.hx1 : bay.x1);
  const extMid = VG().bayExtAt(cache, FS, zFw, 0.5 * (bay.x0 + bay.x1));
  if (!extMid) return null;
  const lvB = bay.lv || [0, 1];
  const room = v.room != null ? Math.max(0, Math.min(0.3, +v.room)) : NOSE_PANEL_ROOM;
  const xh = 0.5 * (extMid.xHi - extMid.xLo), CP = CREW_PTS, P3 = CP.buf, word = i => (CP.word ? CP.word(i) : 'the crew');   // (CP: a sliced job outlives a crew change, which nulls CREW_PTS between its frames)
  // THE PANEL'S BACK: the dash's faces (the sheet's 'dash' / 'dashFace') and the crew layer's panel - its plate and
  // the instruments' cases standing forward of it - the forward-most of them, plus the room to connect them
  let back = -Infinity, dashLo = Infinity;
  for (const f of M.F) {
    if ((f.m !== 'dash' && f.m !== 'dashFace') || !f.v) continue;
    for (const k of f.v) {
      const q = M.V[k], x = q[0] * FS, y = q[1] * FS, z = q[2] * FS;
      if (z > zOfA(aLo) + 0.05 || z < zOfA(aHi) - 0.3) continue;
      if (Math.abs(x) < 0.25 && y < dashLo) dashLo = y;
      if (z > back) back = z;
    }
  }
  const dashBack = back;
  let caseBack = -Infinity;
  crewEach(CREW_PTS, [-xh, extMid.yLo - 0.1, zOfA(aHi) - 0.3], [xh, extMid.yHi + 0.1, zOfA(aLo) + 0.05], i => {
    if (word(i) !== 'the panel') return;
    const z = P3[i * 3 + 2];
    if (z < zOfA(aLo) && z > caseBack) caseBack = z;
  });
  // THE BACK, TRIED AT A FEW STATIONS (the user, 3 Nov: "space dash firewall ... could be 5 ... you need to connect
  // the dash instruments, how much do you need for that?"). The instruments are drawn as their faces on the panel
  // (dashFace); a 3-1/8" case is 8-17 cm deep behind it and wants ~5 cm more for its fittings and plugs, so the tank
  // stands at least NOSE_CASE_DEPTH + room ahead of the panel's face. Above that the dash's glare-shield runs forward
  // to the windscreen base (the Cub's: 28 cm ahead of the face): the tank may sit under it, its top then the
  // shield's - or start ahead of the shield's front edge + room, taller and shorter. The back that holds the most wins.
  let faceZ = -Infinity;
  for (const f of M.F) if (f.m === 'dashFace' && f.v) for (const k of f.v) { const z = M.V[k][2] * FS; if (z < zOfA(aLo) && z > zOfA(aHi) - 0.3 && z > faceZ) faceZ = z; }
  const shieldZ = Math.max(back, caseBack);
  const back0 = isFinite(faceZ) ? Math.max(faceZ + NOSE_CASE_DEPTH + room, isFinite(caseBack) ? caseBack + room : -Infinity)
                               : (isFinite(shieldZ) ? shieldZ + room : zOfA(bay.x1) + room);
  const back1 = isFinite(shieldZ) ? Math.max(back0, shieldZ + room) : back0;
  const backs = [];
  for (let k = 0; k <= 3; k++) { const z = back0 + (back1 - back0) * k / 3; if (!backs.some(q => Math.abs(q - z) < 0.01)) backs.push(z); }
  let front = 0, floor = 0, L0 = 0, zs = null, best = null, fail = null, keel = 0;
  back = back0;
  for (const bk of backs) {
    const e = yield* evalBack(bk);
    if (e.fail) { if (!fail) fail = e.fail; continue; }
    if (!best || e.best.vol * e.L0 > best.vol * L0 * 1.001) { best = e.best; back = bk; front = e.front; L0 = e.L0; zs = e.zs; keel = e.keel; }
  }
  if (!best) { const r = fail || { why: 'no room between the firewall and the panel' };
    r.measured = { panelFace: faceZ, shieldFront: dashBack, backs, keel: extMid.yLo, deck: extMid.yHi };
    LAST.nose = r; NOSE_AUTO.set(key, r); return r; }
  function* evalBack(back) {
    // THE FIREWALL: the first surface ahead of the back face, low in the space (a pod's windscreen slopes down over the
    // panel and meets a ray at panel height a few cm ahead - the tank's top is the ceilings' and the clearance's)
    const yProbe = [0.15, 0.3, 0.45].map(f => extMid.yLo + f * (extMid.yHi - extMid.yLo));
    let front = Infinity;
    for (const y of yProbe) for (const x of [-0.08, 0, 0.08]) {
      const h = obstSeg(O, [x, y, back], [x, y, back + 1.2]);
      if (h) front = Math.min(front, back + 1.2 * h.t);
    }
    if (!isFinite(front)) front = zOfA(aLo);
    front -= NOSE_CLR;
    // THE FLOOR: above the feet, the legs, the pedals and the controls under the footprint, never below the keel
    const keel = extMid.yLo + NOSE_CLR;
    const crewTop = (x0, x1) => {
      let top = -Infinity;
      crewEach(CP, [x0, extMid.yLo - 0.2, back - CREW_GAP], [x1, extMid.yHi + 0.1, front + CREW_GAP], i => {
        const w = word(i);
        if (w === 'the panel') return;                      // (the panel is the back's business)
        const z = P3[i * 3 + 2], x = P3[i * 3], y = P3[i * 3 + 1];
        if (z < back - CREW_GAP || z > front + CREW_GAP || x < x0 || x > x1) return;
        if (y > top) top = y;
      });
      return top;
    };
    let floor = keel;                 // (each candidate floor below rises over the feet its own width covers)
    // (the panel's plate itself, if the floor would stand under it, is the back's: nothing to do here)

    const L0 = front - back;
    if (!(L0 > 0.08)) { const r = { why: 'no room between the firewall and the panel (' + Math.round(Math.max(0, L0) * 1000) + ' mm)' }; return { fail: r }; }
    // THE WIDTH AND THE CEILINGS over the length: rays up from the floor and out from the centreline
    const NZ = Math.max(3, Math.ceil(L0 / 0.04) + 1), zs = [];
    for (let k = 0; k < NZ; k++) zs.push(back + 0.005 + (L0 - 0.01) * k / (NZ - 1));
    const widthAt = fl => {
      let hw = Infinity;
      for (const z of zs) for (const yf of [0.01, 0.3, 0.6]) {
        const y = fl + yf * Math.max(0.02, extMid.yHi - fl - gap);
        const out = Math.max(0.2, 0.5 * (extMid.xHi - extMid.xLo) + 0.15);
        for (const sg of [-1, 1]) { const h = obstSeg(O, [0, y, z], [sg * out, y, z]); if (h) hw = Math.min(hw, out * h.t); }
      }
      return (isFinite(hw) ? hw : 0.5 * (extMid.xHi - extMid.xLo)) - NOSE_CLR;
    };
    // ONE FLOOR, MEASURED: its width (the narrowest over the length, the floor again over that width - the feet
    // beside a narrower tank do not hold it up - and the width again there), then each column's ceiling
    const NX = 9;
    const shapeAt = fl0 => {
      let fl = fl0, hw = widthAt(fl);
      if (!(hw > 0.05)) return null;
      for (let it = 0; it < 2; it++) {
        const f2 = Math.max(fl0, crewTop(-hw - NOSE_CLR, hw + NOSE_CLR) + CREW_GAP + 0.005);
        const w2 = widthAt(f2);
        if (!(w2 > 0.05)) return null;
        fl = Math.max(f2, crewTop(-w2 - NOSE_CLR, w2 + NOSE_CLR) + CREW_GAP + 0.005);
        hw = Math.min(w2, widthAt(fl));
      }
      if (!(hw > 0.05)) return null;
      const cl = [];
      for (let k = 0; k < NX; k++) {
        const x = hw * k / (NX - 1) * 0.999;
        let c = Infinity;
        for (const z of zs) for (const sg of k ? [-1, 1] : [1]) {
          const up = Math.max(0.1, extMid.yHi + 0.15 - fl);
          const h = obstSeg(O, [sg * x, fl + 0.002, z], [sg * x, fl + 0.002 + up, z]);
          c = Math.min(c, h ? fl + 0.002 + up * h.t : extMid.yHi);
        }
        cl.push(c - gap);
      }
      const H = cl[0] - fl;
      if (!(H > 0.05)) return { floor: fl, halfW: hw, H, vol: 0 };
      const pr = cl.map(c => Math.max(0, Math.min(1, (c - fl) / H)));
      const fr = pr.reduce((a, q, i) => a + (i === 0 || i === pr.length - 1 ? 0.5 : 1) * q, 0) / (pr.length - 1);
      return { floor: fl, halfW: hw, H, profile: pr, vol: 2 * hw * H * fr };
    };
    // THE FLOOR THAT HOLDS THE MOST (the user, 3 Nov: the tank may go below the dash; it must not meet the feet): from
    // just above the feet (or the keel) upward, 2 cm a step - something low in the front of the bay (the cowl's lower
    // panel and the engine's accessories behind the firewall, ugly_bi's at 0.44 m below the datum) can make a higher
    // floor hold more than the lowest one
    let best = null;
    for (let fl = floor; fl < extMid.yHi - gap - 0.05; fl += 0.02) {
      const sh = shapeAt(fl);
      yield;                                                // (a slice: one floor measured)
      if (sh && sh.vol > 0 && (!best || sh.vol > best.vol * 1.001)) best = sh;
    }
    if (!best) return { fail: { why: 'no height under the deck above the feet (the floor ' + Math.round((floor - extMid.yLo) * 1000) + ' mm over the keel, the gap ' + Math.round(gap * 1000) + ' mm)' } };
    return { best, front, L0, zs, keel };
  }
  floor = best.floor;
  const halfW = best.halfW, H = best.H, profile = best.profile;
  // ...placed and judged: smaller until it clears (height first - the deck is what it meets - then the length)
  let dims = { L: L0, W: 2 * halfW, H, profile }, last = null;
  for (let it = 0; it < 14; it++) {
    const zc = 0.5 * (front + back), along = zFw * FS - zc, yc = floor + dims.H / 2;
    const ext = VG().bayExtAt(cache, FS, zFw, along) || extMid;
    const bLo = ext.yLo + lvB[0] * (ext.yHi - ext.yLo), bHi = ext.yLo + lvB[1] * (ext.yHi - ext.yLo);
    const lv = Math.max(0, Math.min(1, (yc - bLo) / Math.max(1e-6, bHi - bLo)));
    const cand = { bay: 'nose', capacity: 1, along: +along.toFixed(4), lv: +lv.toFixed(4), rot: 0, form: 'deck',
                   dims: { L: +dims.L.toFixed(3), W: +dims.W.toFixed(3), H: +dims.H.toFixed(3), profile: dims.profile.map(p => +p.toFixed(3)) } };
    const pl = noseJudge(ctx, inv, bay, cand, zFw, cache, yc);
    yield;                                                  // (a slice: one candidate judged)
    last = { cand, pl };
    if (pl && pl.ok) break;
    if (it % 3 === 2) { const d = Math.min(0.03, dims.L * 0.08); front -= d / 2; back += d / 2; dims.L -= d; }
    else dims.H *= 0.93;
    if (dims.L < 0.08 || dims.H < 0.04) break;
  }
  const out = last && last.pl && last.pl.ok
    ? { along: last.cand.along, lv: last.cand.lv, dims: last.cand.dims, litres: capacityFromDims(last.cand.dims, 'deck'), floor, gap, room, yc: last.pl.c[1],
        measured: { dashBack, caseBack, back, front, floor } }
    : { why: 'no auto shape clears here: ' + ((last && last.pl && last.pl.why) || []).join('; '), dims: last && last.cand.dims };
  out.measured = { panelFace: faceZ, shieldFront: dashBack, back, front, floor, keel, room, gap,
                   faceToFirewall: isFinite(faceZ) ? front + NOSE_CLR - faceZ : null,
                   shieldToFirewall: isFinite(dashBack) ? front + NOSE_CLR - dashBack : null };
  LAST.nose = out;                 // (the probe tools read the last measurement)
  if (NOSE_AUTO.size > 16) NOSE_AUTO.clear();
  NOSE_AUTO.set(key, out);
  return out;
}
// one candidate's placement and verdict, without the layout (fitOf's way, inside placeAll's own loop)
function noseJudge(ctx, inv, bay, cand, zFw, cache, yc) {
  const G = VG(), C = core(), FS = fsOf(ctx);
  AUTO_ZFW = zFw * FS;
  const res = C.vesselResolve(EN.kind === 'battery' ? 'battery' : 'fuel', capacityFromDims(cand.dims, 'deck'), vesselKey(), medium());
  const dims = G.vesselDims(vesselKey(), res.installedL, cand.dims, 'deck');
  const pl = autoPlace(cand, dims, yc);
  pl.v = Object.assign({}, cand); pl.dims = dims;
  pl.lightSolid = lightSolid(pl, 'deck', cand.dims.profile);
  // (the search wants the verdict only: stop at the first contact - the drawn tank is judged whole by the layout)
  JUDGE.fast = true;
  try { judgeTank(ctx, ctx.scene, inv, pl); } finally { JUDGE.fast = false; }
  return pl;
}
// THE AUTO TANK IS PLACED BY ITS OWN NUMBERS: its floor and its length were measured, so its centre is known - the
// bay rule's band (bodyPlace's lv) does not reach the firewall face on every body (the Cub's field stops 0.1 m short
// of it: 'past the body'), and it is not what decided the shape. The level written beside it (`lv`) is the core's
// reading of the same height, for the ledger's ring.
function autoPlace(cand, dims, yc) {
  const zc = AUTO_ZFW - cand.along;
  return { on: 'body', ok: true, why: [], c: [0, yc, zc], e: [dims.W / 2, dims.H / 2, dims.L / 2], rot: 0,
           along: cand.along, lv: cand.lv, auto: true, outsideHand: 0, inBand: true, fitsSkin: true };
}
let AUTO_ZFW = 0;

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
  // G903: a FLAT map ships as its constant [r, g, b] - the shared 1x1 (src/viewer/assets.js TEX_FLAT)
  if (Array.isArray(img)) { const f = TEX_FLAT(img, srgb ? THREE.SRGBColorSpace : ''); vTexCache.set(id, f); return f; }
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
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
// the contact marker's look: a bead, bright red, drawn over what is in front of it
let CLASH_GEO = null, CLASH_MAT = null;
function clashGeo() { return CLASH_GEO || (CLASH_GEO = new THREE.SphereGeometry(0.014, 12, 8)); }
function clashMat() {
  if (CLASH_MAT) return CLASH_MAT;
  CLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xff2a1a, depthTest: false, transparent: true, opacity: 0.95 });
  CLASH_MAT.userData.aeroskin = 1;
  return CLASH_MAT;
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
function slotMesh(group, buf, mat, name, c, rot, keep) {
  if (!buf || !buf.idx.length) return null;
  let g = keep && !legacyFit() ? GEOS.get(buf) : null;
  if (!g) {
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
    g.setIndex(buf.idx);
    if (keep && !legacyFit()) { g.userData.keep = 1; GEOS.set(buf, g); }
  }
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
// TANK-FIT: A SOLID WITHOUT SOME PIECES IS ALSO KEPT (VESSEL_MESH.omit copies three buffers each call - per drag tick
// for every tank), by the solid object and the names; and a buffer's GPU geometry is kept with the buffer, so a
// relayout that moved a tank builds no geometry at all (relayout disposes only what is not kept)
const OMITS = new WeakMap();
function omitMemo(sol, names) {
  if (!sol || !window.VESSEL_MESH || !window.VESSEL_MESH.omit) return sol;
  let m = OMITS.get(sol);
  if (!m) OMITS.set(sol, m = new Map());
  const k = names.slice().sort().join(',');
  if (!m.has(k)) m.set(k, window.VESSEL_MESH.omit(sol, names));
  return m.get(k);
}
const GEOS = new WeakMap();
const CONTENTS = new WeakMap();
function contentsMemo(sol, fill) {
  const VM = window.VESSEL_MESH;
  let m = CONTENTS.get(sol);
  if (!m) CONTENTS.set(sol, m = new Map());
  const k = fill.toFixed(3);
  if (!m.has(k)) { if (m.size > 8) m.clear(); m.set(k, VM.contents(sol, fill, 0.008)); }
  return m.get(k);
}
function vesselSolid(r) {
  const VM = window.VESSEL_MESH;
  if (!VM) return null;
  const fin = finishOf(r.v);
  const form = formOf(r.v);
  const prof = form === 'deck' && r.v && r.v.dims && r.v.dims.profile ? r.v.dims.profile : null;
  const key = r.e.map(x => x.toFixed(4)).join(',') + '|' + form + '|' + EN.kind + '|' + fin + (prof ? '|' + prof.map(x => (+x).toFixed(3)).join(',') : '');
  let s = solids.get(key);
  if (!s) {
    s = VM.build({ e: r.e, form, kind: EN.kind, profile: prof,
                   tile: { shell: tileOf(fin), hard: tileOf('steel'),
                           seal: tileOf('rubber') } });
    if (solids.size > 24) solids.clear();
    solids.set(key, s);
  }
  return s;
}

// THE MOUNT IS GONE (G1106, CUB-COCKPIT 2026-09-30). G189 hung two 6 mm legs
// under each strap from the tank to "the surface the bay stands on", and G317
// taught each foot the fuselage's height; the user, from the Cub's seat, saw
// two posts standing on the cowl top in front of the windscreen: "They're
// drawn far too recklessly, and they keep poking through everywhere, as they
// seem to expect a flat surface to anchor on, which they'll never find. If
// you can't do something clean, get rid of it." Measured (GATE TANKMOUNT
// over master's layer): a 20-30 L nose tank hangs with air above it, its
// feet asked the height of a deck that is not the drawn one - the airframe
// table (a 96 x 72 ray grid keeping the OUTERMOST hit, the windscreen and
// the pillars among them) or, where it gave none, a flat plane at the
// section's top on the centreline - and 167 of 352 leg vertices stood past
// the fuselage sheet, 37.5 mm out. So no leg, no foot plate, no cross tube:
// the tank hangs in its straps, as it is drawn. GATE ENERGY's 'mount:' row
// and GATE TANKMOUNT (every archetype, three tank sizes) hold it.

// THE PIECES THAT STAND OFF THE SHELL (G1108, CUB-COCKPIT 2026-09-30; A0's
// ruling under the user's "if you can't do something clean, get rid of it").
// Measured by GATE TANKMOUNT per named piece: the straps, pads and sender lie
// on the shell (a few mm) and leave the skin only where the shell does, but
// the filler neck, the vent (42 mm and an elbow), the outlet stub and the
// sump stand off it - 12 to 89 mm through the skin on tanks whose box the fit
// had cleared, because the fit tested the box and not what stands on it. So
// each standoff piece is asked the FIT'S OWN QUESTION: its vertices, placed
// as the slot meshes place them (the centre, the yaw about y), mapped to the
// fuselage's station by the line through the box's own samples (the fit's
// z -> sL), against the bay profile at a 4 mm wall (BAY_SITE.baySolidFits,
// the instrument the placement trusts). A piece that does not clear is not
// drawn (VESSEL_MESH.omit); nothing else about the tank changes.
const STANDOFF = ['filler', 'vent', 'outlet', 'sump', 'terminals', 'feet'];
const PIECE_WALL = 0.004;
const PIECE_PROF = new Map();          // the thin-wall profile, per body and station range
function standoffBlocked(ctx, r, sol, yaw) {
  const B = window.BAY_SITE;
  if (!B || !B.bayProfile || !sol || !sol.pieces || !ctx || !ctx.mesh || !r.c || !r.pts || !r.samples) return [];
  const FS = (window.CAGE2 && window.CAGE2.CAGE_UNIT || 1) * ((ctx.P && ctx.P.planeScale) || 1);
  // z -> sL, the fit's own, as a line through the box's samples
  let n = 0, mz = 0, ms = 0;
  const zs = [], ss = [];
  for (let k = 0; k < r.pts.length; k++) {
    const s = r.samples[k] && r.samples[k][2];
    if (!isFinite(s) || Math.abs(s) > 1e5) continue;
    zs.push(r.pts[k][2] / FS); ss.push(s); mz += r.pts[k][2] / FS; ms += s; n++;
  }
  if (n < 2) return [];
  mz /= n; ms /= n;
  let num = 0, den = 0;
  for (let k = 0; k < n; k++) { num += (zs[k] - mz) * (ss[k] - ms); den += (zs[k] - mz) * (zs[k] - mz); }
  const slope = den > 1e-12 ? num / den : -1;
  const sLOf = z => ms + slope * (z - mz);
  const cs = Math.cos(yaw), sn = Math.sin(yaw), c = r.c;
  const SI = { hard: 0, seal: 1, mark: 2 };
  const want = sol.pieces.filter(pc => STANDOFF.includes(pc.name));
  const ptsOf = {};
  let lo = Infinity, hi = -Infinity;
  for (const pc of want) {
    const pts = [];
    for (const slot of ['hard', 'seal', 'mark']) {
      const si = SI[slot], P = sol[slot].pos;
      for (let v = pc.start[si][0]; v < pc.end[si][0]; v++) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
        // the slot mesh: position c, rotation.y = yaw
        const X = c[0] + cs * x + sn * z, Y = c[1] + y, Z = c[2] - sn * x + cs * z;
        const s = sLOf(Z / FS);
        pts.push([X / FS, Y / FS, s]);
        if (s < lo) lo = s; if (s > hi) hi = s;
      }
    }
    ptsOf[pc.name] = pts;
  }
  if (!isFinite(lo)) return [];
  const pad = 0.02 / FS;
  const key = BODY_SIG + '|' + (lo * FS).toFixed(2) + '|' + (hi * FS).toFixed(2) + '|' + FS.toFixed(4);
  let prof = PIECE_PROF.get(key);
  if (!prof) {
    if (PIECE_PROF.size > 48) PIECE_PROF.clear();
    try { prof = B.bayProfile(ctx.mesh, lo - pad, hi + pad, PIECE_WALL / FS, Math.max(4, Math.ceil((hi - lo) / (0.04 / FS)) + 2)); }
    catch (e) { prof = null; }
    PIECE_PROF.set(key, prof);
  }
  // no profile to ask: a piece the fit cannot vouch for is not drawn
  if (!prof) return want.map(pc => pc.name);
  // ...and the drawn surfaces (the sheet's frame tubes and dash, the engine,
  // the cowl), which the bay's sections do not hold: a vent passed the
  // profile and stood 69 mm through a pusher's tube frame (GATE TANKMOUNT)
  return want.filter(pc => {
    if (!B.baySolidFits(prof, ptsOf[pc.name]).fits) return true;
    const D = drawnPts(r, sol, ['hard', 'seal', 'mark'], pc);
    const tris = surfTris(ctx, LAYOUT_SCENE, LAYOUT_INV, D.bb);
    return D.pts.some(q => segCrosses(r.c, q, tris));
  }).map(pc => pc.name);
}

// A TANK THAT DOES NOT FIT DOES NOT FLY (G1108, A0's ruling 2a). The layer's
// own fit (`r.ok`) says whether the box clears the skin in its bay; every
// stock design's default nose tank read ok: false and was drawn through the
// skin anyway (the Cub's 45 L box 82 of 396 sampled shell vertices out, the
// floatplane's 149 mm, the Jodel's into the dash). The editor keeps drawing
// it - red, so the builder sees it and moves or resizes it - but every mesh
// of that vessel is stamped `edUnfit` and the join does not take it: the
// flown, parked and stock aeroplanes carry no drawn tank that pokes through.
// Its fuel, mass and CG stay in the ledger (the spec's energy section, not
// these meshes), so the physics does not move - GATE TANKMOUNT holds both.
function drawResults(group, ctx, results) {
  const VM = window.VESSEL_MESH, K = window.GEAR_KIT;
  const wet = vesselKey() === 'wet';
  for (const r of results) {
    const bad = !r.ok;
    const i = EN.vessels.indexOf(r.v);
    if (r.on === 'body' && r.c && VM) {
      const sol0 = vesselSolid(r);
      if (!sol0) continue;
      r.solid = sol0;
      // `sol.yaw` is the solid's own canonical turn (VESSEL_MESH builds along
      // the longer horizontal axis), not a placement decision — it rides on
      // top of the vessel's own `rot` and moves nothing the ledger reads.
      const yaw = r.rot + (sol0.yaw || 0);
      let drop = [];
      // TANK-FIT: the drawn clearance already decided which standoff pieces stay (judgeTank, the same instrument)
      if (r.omitted && r.drawn && !legacyFit()) drop = r.omitted;
      else try { drop = standoffBlocked(ctx, r, sol0, yaw); } catch (e) { drop = []; }
      const sol = drop.length && VM.omit ? omitMemo(sol0, drop) : sol0;
      r.drawn = sol; r.omitted = drop;
      // THE RED SITS WHERE THE CONTACT IS (TANK-FIT): a marker on each contact the verdict names - the deepest
      // point past a surface, the surface inside, the thinnest gap, the crew - a red bead the builder can see
      // through which corner to move. A marker, not the aeroplane: the join skips it (edMarker).
      if (bad && r.clash && window.THREE) {
        const pts = [r.clash.at].concat(r.clash.marks || []).filter(Boolean);
        pts.forEach((p, k) => {
          const m = new THREE.Mesh(clashGeo(), clashMat());
          m.position.set(p[0], p[1], p[2]);
          m.name = 'edTankClash_' + i + '_' + k;
          m.userData.edMarker = 1; m.userData.edUnfit = 1;
          m.renderOrder = 10;
          group.add(m);
        });
      }
      // THE RED IS THE SHELL'S ALONE. It is four fifths of what you can see,
      // so a tank that does not fit is unmissable either way — and putting the
      // emissive on the straps, the filler and the sump as well turned the
      // whole thing into a red blob with no shape left to read, at exactly the
      // moment the builder needs to see WHICH corner is through the skin.
      for (const slot of ['shell', 'hard', 'seal', 'mark']) {
        const m = slotMesh(group, sol[slot], slotMat(slot, slot === 'shell' && bad, i, r.v),
                           'edVessel_' + i + '_' + slot, r.c, yaw, true);
        if (m && bad) m.userData.edUnfit = 1;
      }
      // THE FUEL INSIDE, at the slider's fill. It is the shell's own section
      // inset by the wall and cut flat at the level — so in a round tank the
      // fuel has a round bottom and a flat top, and the level itself is placed
      // by VOLUME, not by height (VESSEL_MESH.contents). A pack does not
      // drain, so nothing is drawn inside one.
      if (EN.kind !== 'battery' && VIEW.fill > 0.02) {
        const mf = slotMesh(group, legacyFit() ? VM.contents(sol, VIEW.fill, 0.008) : contentsMemo(sol, VIEW.fill), fuelMat(),
                            'edFuel_' + i, r.c, yaw, true);
        if (mf && bad) mf.userData.edUnfit = 1;
      }
    } else if (r.on === 'strut' && r.pods && window.THREE) {
      // G477: the ogive pod, a lathe on its axis (fore-aft since G2793) — r = R (1 - (2u-1)^2)^0.65
      const T3 = window.THREE;
      for (const pd of r.pods) {
        const NP = 18, pts = [];
        for (let k = 0; k <= NP; k++) {
          const u = k / NP, s = 1 - (2 * u - 1) * (2 * u - 1);
          pts.push(new T3.Vector2(Math.max(0.002, 0.5 * pd.D * Math.pow(Math.max(0, s), 0.65)), (u - 0.5) * pd.L));
        }
        const geo = new T3.LatheGeometry(pts, 28);
        const m = new T3.Mesh(geo, wet ? matWet(bad) : slotMat('shell', bad, i, r.v));
        m.name = 'edVessel_' + i + (pd.sign > 0 ? 'R' : 'L');
        m.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), new T3.Vector3(pd.axis[0], pd.axis[1], pd.axis[2]));
        m.position.set(pd.c[0], pd.c[1], pd.c[2]);
        if (bad) m.userData.edUnfit = 1;
        group.add(m);
        // THE MOUNT (TANK-FIT, Part 3): a pylon from the pod's back up to the strut, and a clamp band round the
        // strut where it meets it - the hardware's steel, part of the tank (it flies with it)
        if (pd.hang > 0 && pd.onStrut) {
          const hm = slotMat('hard', false, i, r.v);
          const ch = Math.max(0.01, pd.hang - pd.D / 2 + 0.01), pw = Math.min(0.5 * pd.L, 0.18);
          const py = new T3.Mesh(new T3.BoxGeometry(0.018, ch, pw), hm);
          py.position.set(pd.c[0], pd.c[1] + pd.D / 2 + ch / 2 - 0.01, pd.c[2]);
          py.name = 'edVessel_' + i + (pd.sign > 0 ? 'R' : 'L') + '_pylon';
          if (bad) py.userData.edUnfit = 1;
          group.add(py);
          const cl = new T3.Mesh(new T3.CylinderGeometry(0.03, 0.03, Math.min(0.12, pw * 0.8), 14, 1, true), hm);
          cl.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), new T3.Vector3(pd.u[0], pd.u[1], pd.u[2]));
          cl.position.set(pd.onStrut[0], pd.onStrut[1], pd.onStrut[2]);
          cl.name = 'edVessel_' + i + (pd.sign > 0 ? 'R' : 'L') + '_clamp';
          if (bad) cl.userData.edUnfit = 1;
          group.add(cl);
        }
      }
    } else if (r.on === 'wing' && r.sides && VM) {
      // THE WING TANK IS THE SIMPLE ONE, by the user's own ruling: a box in
      // the panel just outboard of the centre section, and that is all. It is
      // buried between the spars where nothing can see it, so it gets real
      // outward normals and metre-true uv and no hardware.
      for (const s of r.sides) {
        // G445.2: THE SPAR BAY'S OWN SECTION where the wing could be measured
        // (VESSEL_GEN.wingRibs off the wing layer's probes): the loft, and
        // the fuel inside it cut flat at the slider's level. The box below
        // is what a wing with no probe still gets.
        if (s.ribs && s.ribs.length >= 2 && VM.wingLoft) {
          const mat = wet ? matWet(bad) : slotMat('shell', bad, i, r.v);
          if (!wet)
            slotMesh(group, VM.wingLoft(s.ribs, tileOf(finishOf(r.v))), mat,
                     'edVessel_' + i + (s.sign > 0 ? 'R' : 'L'), [0, 0, 0], 0);
          if (EN.kind !== 'battery' && VIEW.fill > 0.02)
            slotMesh(group, VM.wingLoft(s.ribs, 0.4, { fill: Math.min(1, VIEW.fill), inset: wet ? 0.0 : 0.008 }),
                     wet ? matWet(bad) : fuelMat(),
                     'edFuel_' + i + (s.sign > 0 ? 'R' : 'L'), [0, 0, 0], 0);
          continue;
        }
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

// THE FIT OF A VESSEL THAT IS NOT (YET) THE AEROPLANE'S (G1109). The layer's
// whole verdict - the placement against the bay, the crew, the engine, the
// cowl, the dash, the drawn skin and frame - for one candidate vessel, on the
// last layout's body, with nothing drawn and nothing written back: the stock
// designs' tanks were refitted by asking this (tools/tank_refit.js). The
// candidate is a copy; the result carries its placement and why.
let FIT_ASKING = false;
let FIT_AUTO_SKIP = false;        // (a drag of the auto nose tank's own rows ends its auto fit: the shape is the player's)
// opts.fast: stop at the first stage that fails (the placement, then the
// crew, then the surfaces) - a search asks hundreds of candidates and most
// fail the placement; the verdict is the same, its reasons may be fewer
function fitOf(cand, opts) {
  const fast = !!(opts && opts.fast);
  const ctx = LAST.ctx, inv = LAST.inv;
  if (!ctx || !inv) return null;
  const keep = EN.vessels;
  const v = JSON.parse(JSON.stringify(cand));
  FIT_ASKING = true;
  try {
    EN.vessels = [v];
    const results = placeAll(ctx, inv);
    if (legacyFit()) {
      if (!(fast && results[0] && !results[0].ok)) crewHits(ctx.scene, inv, results);
      if (!(fast && results[0] && !results[0].ok)) layerHits(ctx.scene, inv, results, ctx);
    } else if (!(fast && results[0] && !results[0].ok)) {
      if (!crewFresh(ctx.scene, inv)) CREW_PTS = null;
      JUDGE.fast = fast;
      try { judgeAll(ctx.scene, inv, results, ctx); } finally { JUDGE.fast = false; }
    }
    const r = results[0];
    return r ? { ok: !!r.ok, why: r.why.slice(), c: r.c, e: r.e, rot: r.rot, on: r.on, v, along: r.along, samples: r.samples, pts: r.pts,
                 section: r.section, crewHits: r.crewHits || 0, layerHits: r.layerHits || 0, clash: r.clash || null, clear: r.clear, clearTo: r.clearTo,
                 rule: r.rule || null, pods: r.pods || null, jms: r.jms || null } : null;
  } finally { EN.vessels = keep; FIT_ASKING = false; }
}
function relayout() {
  const ctx = LAST.ctx;
  if (!ctx || !window.THREE) return;
  const { scene } = ctx;
  if (group) {
    group.traverse(c => { if (c.geometry && c.geometry !== CLASH_GEO && !(c.geometry.userData && c.geometry.userData.keep)) c.geometry.dispose(); });
    scene.remove(group);
    group = null;
  }
  group = new THREE.Group();
  group.name = 'cageLayer:energy';
  scene.add(group);
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const t0 = msNow();
  const legacy = legacyFit();
  // the crew may have moved since the last layout, and every layer was perhaps drawn afresh: the legacy path
  // gathered both again every time; the drawn clearance keeps them while they are the same (crewFresh, surfAll's key)
  if (legacy || !crewFresh(scene, inv)) CREW_PTS = null;
  if (legacy) SURF_ALL = null;
  const results = placeAll(ctx, inv);
  const t1 = msNow();
  if (legacy) crewHits(scene, inv, results);
  const t2 = msNow();
  if (legacy) layerHits(scene, inv, results, ctx);
  else judgeAll(scene, inv, results, ctx);
  const t3 = msNow();
  LAYOUT_INV = inv; LAYOUT_SCENE = scene;
  drawResults(group, ctx, results);
  const t4 = msNow();
  LAST.results = results; LAST.inv = inv; LAST.group = group;
  LAST.ms = { place: t1 - t0, crew: t2 - t1, surf: t3 - t2, draw: t4 - t3, total: t4 - t0 };
  if (panelBody) syncReadouts();
  if (ctx.stat) {
    const bad = results.filter(r => !r.ok).length, off = results.filter(r => r.unmounted).length;
    ctx.stat.textContent += '  ·  energy: ' + results.length + ' vessel' +
      (results.length === 1 ? '' : 's') + (bad ? ', ' + bad + ' not fitting' : '') +
      (off ? ', ' + off + ' on lift struts this wing does not have (not fitted, no fuel)' : '');
  }
}

// THE DRAG (TANK-FIT, 2026-11-03). A slider's input ran relayout - every tank placed, every tank's crew and
// surfaces asked, every mesh rebuilt - per input event: ugly_bi 84 ms a tick (292 ms once the crew and the engine
// were really found), the twin 153 ms (its wing tank sliced afresh). Now an input asks for ONE frame (coalesced:
// requestAnimationFrame), and that frame places, judges and redraws only the tank in the hand; the others keep
// their meshes and their verdicts, which nothing the hand did can change. The release runs the whole relayout
// (every tank, the readouts, the commit) - the full verdict.
const DRAG = { raf: 0, i: -1 };
function dragLayout(now, vi) {
  if (vi != null) DRAG.i = vi;
  if (!now) {
    if (DRAG.raf) return;
    const go = () => { DRAG.raf = 0; dragLayout(true); };
    DRAG.raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(go) : setTimeout(go, 16);
    return;
  }
  const ctx = LAST.ctx, i = DRAG.i;
  if (legacyFit() || !ctx || !group || !LAST.inv || !(i >= 0) || !EN.vessels[i] || LAST.results.length !== EN.vessels.length) { relayout(); return; }
  const t0 = msNow();
  const keep = EN.vessels, inv = LAST.inv;
  let r = null;
  FIT_ASKING = true;
  try { EN.vessels = [keep[i]]; r = placeAll(ctx, inv)[0] || null; }
  finally { EN.vessels = keep; FIT_ASKING = false; }
  if (!r) { relayout(); return; }
  if (!crewFresh(ctx.scene, inv)) CREW_PTS = null;
  JUDGE.drag = true;
  try { judgeAll(ctx.scene, inv, [r], ctx); } finally { JUDGE.drag = false; }
  const t1 = msNow();
  // the tank's own meshes out, its new ones in
  const mine = new RegExp('^(ed(Vessel|Fuel)_' + i + '(_|L|R|$)|edTankClash_' + i + '_)');
  for (const c of group.children.slice()) if (mine.test(c.name || '')) {
    group.remove(c);
    if (c.geometry && c.geometry !== CLASH_GEO && !(c.geometry.userData && c.geometry.userData.keep)) c.geometry.dispose();
  }
  const sel = selected; selected = -1;              // (the bay's ghost stays where the release drew it)
  try { drawResults(group, ctx, [r]); } finally { selected = sel; }
  LAST.results[i] = r;
  if (panelBody) syncReadouts();
  LAST.dragMs = { place: t1 - t0, draw: msNow() - t1, total: msNow() - t0 };
}
// THE FORE / AFT HAND KEEPS THE TANK'S HEIGHT (TANK-FIT). `lv` places a tank as a fraction of the band AT ITS OWN
// STATION, and the band's top is the section's: at the windscreen base the nose section opens into the cabin, and
// 3 cm of fore/aft lifted ugly_bi's nose tank 8 cm into the cowl top (-0.114 -> -0.032 m), red, then 4 cm more
// through the dash - "super twitchy". The slider now writes the level that keeps the tank where it is (as far as the
// band at the new station allows); a saved tank, which carries its own lv, is placed exactly as before.
function lvKeepingHeight(i, along) {
  const v = EN.vessels[i], r = LAST.results[i], ctx = LAST.ctx, G = VG();
  if (!v || !r || !r.c || r.on !== 'body' || !ctx || !G || !G.bayExtAt) return v ? v.lv : null;
  const bay = r.bay, c = bay && bay._ck ? BAY_CACHES[bay._ck] : null;
  const zFw = G.firewallZ ? G.firewallZ(ctx.spec, CG2()) : null;
  if (!c || zFw == null) return v.lv;
  const ext = G.bayExtAt(c, fsOf(ctx), zFw, along);
  if (!ext) return v.lv;
  const lvB = bay.lv || [0, 1], H = ext.yHi - ext.yLo;
  const lo = ext.yLo + lvB[0] * H, hi = ext.yLo + lvB[1] * H;
  if (!(hi - lo > 1e-6)) return v.lv;
  const lv = (r.c[1] - lo) / (hi - lo);
  return Math.round(Math.max(lvB[0], Math.min(lvB[1], lv)) * 1000) / 1000;
}
// a row's shown value, written without rebuilding the panel (the drag's hand is on another row)
function syncRow(i, label, value, fmt) {
  if (!panelBody) return;
  const det = panelBody.querySelector('details[data-ves="' + i + '"]');
  if (!det) return;
  for (const r of det.querySelectorAll('.r')) {
    const k = r.querySelector('.k');
    if (!k || k.textContent.trim() !== label) continue;
    const inp = r.querySelector('input'), val = r.querySelector('.v');
    if (inp) inp.value = value;
    if (val) val.textContent = fmt(+value);
  }
}

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  // G1303: a drag tick - the tanks are laid out when the hand stops (a seeded layer only: the first build is whole)
  if (ctx.defer && seeded) { if (group) group.visible = false; return; }
  // the game seeds through applySpec; a bench reload seeds from its memory;
  // a first build with neither carries the default
  if (!seeded) {
    if (inGame() && window.GARAGE_SPEC) {
      try { const S0 = window.GARAGE_SPEC.get(); fromSpec(S0.energy, S0); } catch (e) {}
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
  // TANK-FIT (Part 3): ...except a pod on the lift struts. Sent to the nose, it was SHAPED there and the shape
  // written back (the Chinook-alike's 38 L pod became a 3 L nose box: GATE TANKMOUNT's KNOWN line) - the builder's
  // fuel dropped without a word, and on a build whose struts the wing layer had not drawn yet, for good. It keeps its
  // bay: drawn nowhere, red in the panel with the reason, carrying nothing (the core: `unmounted`), and back on its
  // struts the moment the aeroplane has them.
  for (const v of EN.vessels)
    if (!BAYS.find(b => b.key === v.bay) && !(v.bay === 'strut' && !legacyFit())) v.bay = (BAYS[0] || {}).key || 'nose';
  if (HAS_DOM) { mountPanel(); renderPanel(); }
  relayout();
};
// a preset or a reset on the bench is a new aeroplane: it gets the default tank
const prevLoad = PAGE.load;
PAGE.load = spec => {
  if (prevLoad) try { prevLoad(spec); } catch (e) {}
  if (!inGame()) fromSpec(spec && spec.energy, spec);
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
    // B9 (G1021): NOTHING NEW, NOTHING REBUILT. `update` rebuilds the whole aeroplane (the model, the sim, the room);
    // this write-back runs after EVERY build of the editor, and after a build that changed no tank (the boot's seed,
    // the parked aeroplanes' batch putting the player's build back) it re-committed the same numbers and rebuilt the
    // flying aeroplane for nothing - under the loading screen, and in the shed after it. The same numbers: no update.
    const had = G.get ? G.get() : null;
    const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x);
    const same = had && canon(had.energy) === canon(patch.energy)
      && (!patch.fuel || (had.fuel && canon({ litres: had.fuel.litres, tank: had.fuel.tank }) === canon(patch.fuel)));
    if (!same) G.update(patch);
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
  // THE MODEL-FRAME CG TOO (G396): the mass-weighted node CG in the def's
  // own frame — byte for byte what app.js publishes as FLYDIY_CG_MODEL at
  // roll-out — so the float layer places the step off THIS aeroplane's CG,
  // not the last one rolled out (a freshly baked card read the previous
  // aeroplane's CG, stood its step 0.6 m aft, and nosed over into the sea)
  let cx = 0, cy = 0, mm = 0;
  for (const n of def.nodes) { cx += n.p[0] * n.m; cy += n.p[1] * n.m; mm += n.m; }
  return { kind: 'balance', cgX: sh.cgX, npX: sh.npX, staticMargin: sh.staticMargin,
           cBar: sh.cBar, xLEmac: sh.xLEmac, mass: sh.mass, gearX, ms: Date.now() - t0,
           cgMX: mm > 0 ? cx / mm : null, cgMY: mm > 0 ? cy / mm : null };
}
// ONE JOB IN FLIGHT (2026-09-11): a job is ~1 s in the worker and boot
// commits three or four times, so posting every request queued seconds of
// stale answers behind the one that mattered. A request while one is out
// only marks `balPending`; the answer's arrival posts the newest spec.
let balSeq = 0, balSeen = 0, balErr = null, balBusy = false, balPending = false, LAST_BAL = null;
function balanceApply(r) {
  if (!r || r.gearX == null) return;
  LAST_BAL = r;
  // G396: THE CG HANDSHAKE, LIVE. Publish the model-frame CG for the float
  // layer; when the floats are on and the CG has moved more than 2 cm from
  // what the step was placed off, build once more — the step follows the
  // CG, the CG follows the step (15 % of the mass), and the loop closes in
  // one pass at this threshold
  if (r.cgMX != null && isFinite(r.cgMX) && isFinite(r.cgMY)) {
    // FLOAT-CG (2 Nov): measured from the CG the step WAS stood on (the float layer's record), not the last one
    // published - after a load, GARAGE_SPEC.update's rebuild has app.js publish the CG of the aeroplane the answer is
    // about before the answer arrives, so the answer always read "not moved" and the page kept the second round's
    // station: the twin floatplane's step 7 cm aft of node's (GATE JOINPARITY). node's load path (3c) measures the same
    const F = window.CAGE_FLOAT;
    const prev = (F && F.cgM) || window.FLYDIY_CG_MODEL;
    window.FLYDIY_CG_MODEL = [r.cgMX, r.cgMY];
    const moved = !prev || Math.hypot(prev[0] - r.cgMX, prev[1] - r.cgMY) > 0.02;
    const UI = window.CAGE_UI, P = UI && UI.P;
    // (a load holds the floats where the file saved them until an edit: no
    // rebuild for the CG then, G3700 - _cage_float.js CAGE_FLOAT_HELD)
    const held = typeof window.CAGE_FLOAT_HELD === 'function' && window.CAGE_FLOAT_HELD();
    if (moved && !held && P && +P.gearFloats > 0 && typeof UI.build === 'function') {
      clearTimeout(balanceApply._t);
      // PHONE-EDIT-PERF: never under a held slider (the drag's own release follows), and as a release's build (buildCg)
      const go = () => {
        if (typeof UI.dragging === 'function' && UI.dragging()) { balanceApply._t = setTimeout(go, 250); return; }
        try { UI.buildWhy = 'cg'; (UI.buildCg || UI.build)(); } catch (e) {}
      };
      balanceApply._t = setTimeout(go, 60);
    }
  }
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
    balEl.classList.toggle('bad', s.staticMargin != null && s.staticMargin < 0.05);
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
      fillEl.classList.toggle('bad', sh.staticMargin != null && sh.staticMargin < 0.05);
    } else fillEl.textContent = '';
  }
  drawBar(E, sh ? sh.cgX : null);
  if (r.chart && chartEl && window.BALANCE) {
    try { window.BALANCE.draw(chartEl, r.chart, chartStyle()); LAST_CHART = r.chart; }
    catch (e) { console.error('balance chart:', e); }
  }
}
// G3734: THE CHART IN THE COLUMN'S PALETTE. balance.js draws in its own cold
// defaults; here the chrome (text, grid, the corners, the type) and the two
// limit lines are read off the --ed-* tokens the canvas inherits, so the
// chart is the garage's. The blue burn line and the yellow dot stay: the
// tooltip above names them. No token (the bench) keeps balance.js's own.
function chartStyle() {
  const cs = chartEl && window.getComputedStyle ? getComputedStyle(chartEl) : null;
  const t = k => cs ? cs.getPropertyValue(k).trim() : '';
  if (!t('--ed-ink')) return undefined;
  return { fg: t('--ed-ink'), dim: t('--ed-faint'), grid: t('--ed-hair'), corner: t('--ed-dim'),
           np: t('--ed-bad'), caution: t('--ed-warn'), font: "10px 'IBM Plex Sans', sans-serif" };
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
  // G3733: the look is the sheet's (.cgBar > i, .cgBar > i.cg); only WHERE a
  // mark stands is computed here, so only `left` is written inline
  const mark = (x, cls, t) => {
    const m = document.createElement('i');
    if (cls) m.className = cls;
    m.style.left = at(x).toFixed(1) + '%';
    m.title = t; barEl.appendChild(m);
  };
  mark(lo, '', 'forward corner \u00b7 ' + E.fwd.label);
  mark(hi, '', 'aft corner \u00b7 ' + E.aft.label);
  if (cgX != null) mark(cgX, 'cg', 'the CG at the fuel aboard');
}
function loadingTable() {
  if (!tableEl) return;
  const E = LAST_SHAKE && LAST_SHAKE.envelope;
  if (!E || !E.corners) { tableEl.textContent = ''; return; }
  const f = (v, d) => (v == null || !isFinite(v)) ? '\u2014' : v.toFixed(d);
  tableEl.innerHTML = '<div class="noteH">loading table \u00b7 % MAC \u00b7 static margin</div>' +
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
      d.classList.toggle('on', on);
      if (on) { d.open = true; if (d.scrollIntoView) d.scrollIntoView({ block: 'nearest' }); }
    }
  // ...AND IN THE FINISH COLUMN, which is a different element in a different
  // column and holds the same list (2026-09-05). Clicking the second tank on
  // the aeroplane while the finish tab is open must open the second tank's
  // colours, not leave you painting the first.
  if (lookBody)
    for (const d of lookBody.querySelectorAll('details[data-veslook]')) {
      const on = +d.dataset.veslook === i;
      d.classList.toggle('on', on);
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
  const s = document.createElement('select');
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
  // TANK-FIT (Part 3): the struts' bay is offered only where the wing has struts (measureBays); a tank still on
  // them where there are none sees its bay named, and not offered to anything else
  if (!BAYS.find(b => b.key === 'strut') && EN.vessels.some(v => v.bay === 'strut'))
    out.push(['strut', 'On the lift struts · this wing has none', true]);
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
    if (i === selected) det.classList.add('on');
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
    // the entry a viewport click lands on (see `selectVessel`): the list is
    // rebuilt on every render, so the index rides on the element rather than
    // being remembered as a node
    det.dataset.ves = i;
    if (i === selected) det.classList.add('on');
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
        // TANK-FIT Part 2: a tank moved to the nose is fitted to it (the shape row can make it free again)
        if (nb === 'nose' && NOSE_AUTO_ON && !legacyFit()) { v.fit = 'auto'; v.dims = null; v.form = 'box'; } else delete v.fit;
        selected = i; renderPanel(); relayout(); commit();
      });

    // ROUND OR SQUARED, and the litres follow. A wing tank is neither: it is
    // the box between the spars and the row is not offered there.
    if (bay && bay.on !== 'wing' && bay.on !== 'strut') {
      // TANK-FIT Part 2: the nose bay's 'auto-fit' - the tank fills the space behind the panel (noseAuto)
      const autoOK = NOSE_AUTO_ON && bay.key === 'nose' && !legacyFit();
      const isAuto = autoOK && noseAutoWanted(v, bay);
      select(box, 'shape', 'a squared shell with radiused corners, or a ' +
        'cylinder with domed ends. The drawn box is the same either way; a ' +
        'cylinder simply holds less of it, and the capacity says so' +
        (autoOK ? '. AUTO-FIT (the nose): the tank takes the space behind the panel - its floor the bottom of the ' +
          'dash, its top the deck less a gap, the firewall ahead - and holds what that space holds' : ''),
        (autoOK ? [['auto', 'auto-fit (behind the panel)']] : []).concat([['box', 'squared'], ['cyl', 'cylindrical']]),
        isAuto ? 'auto' : (formOf(v) === 'deck' ? 'box' : formOf(v)), nf => {
          if (nf === 'auto') { v.fit = 'auto'; }
          else {
            delete v.fit;
            // an auto shape left for a free one keeps its size as a squared box of the same footprint
            v.form = nf === 'cyl' ? 'cyl' : 'box';
            if (v.dims) { v.dims = { L: v.dims.L, W: v.dims.W, H: v.dims.H }; v.capacity = capacityFromDims(v.dims, formOf(v)); }
          }
          selected = i; renderPanel(); relayout(); commit();
        });
      if (isAuto)
        range(box, 'gap under the deck', 'the room left between the auto tank\'s top and the deck\'s inner skin', 0, 0.2, 0.005,
          v.gap != null ? v.gap : NOSE_GAP, fmtM,
          x => { v.gap = x; }, x => { v.gap = x; relayout(); syncCap(); commitSoon(); });
      if (isAuto)
        range(box, 'room behind the panel', 'the space left between the panel (its instruments\' backs) and the auto ' +
          'tank: where the instruments are connected - the pitot and static fittings, the hoses\' turn, the harness plugs',
          0, 0.2, 0.005, v.room != null ? v.room : NOSE_PANEL_ROOM, fmtM,
          x => { v.room = x; }, x => { v.room = x; relayout(); syncCap(); commitSoon(); });
    }

    // capacity: as much as the bay can take, less the vessel's own ullage
    const room = bay ? (bay.roomL || 0) : 0;
    let capMax;
    if (EN.kind === 'battery') {
      const cell = (C.CELLS || {})[EN.cell] || { WhL: 250, packK: 0.7 };
      capMax = Math.max(1, Math.floor(room / 1.18 * (cell.WhL * cell.packK) / 1000));
    } else capMax = Math.max(1, Math.floor(room / 1.06));
    if (!(bay && bay.key === 'nose' && noseAutoWanted(v, bay))) range(box, 'capacity', 'what it holds. The top of the slider is what the ' +
      'bay can take; the readout says whether the SHAPE fits. Moving this ' +
      'gives the vessel its catalogue shape again', 1,
      Math.max(capMax, 1), 1, Math.min(v.capacity, Math.max(capMax, 1)), fmtL,
      x => { v.capacity = x; v.dims = null; dragLayout(false, i); },
      x => { v.capacity = x; v.dims = null; relayout(); commitSoon(); });
    // THE GEOMETRY IS THE PLAYER'S, AND THE CAPACITY FOLLOWS IT. Three rows
    // for the box; the first touch copies the catalogue shape so the sliders
    // start from what is drawn, and from then on the litres are calculated.
    if (bay && bay.on === 'strut') {
      // G477: the pod's own length and diameter; the litres (the pair's) follow
      const cur = () => v.dims || (LAST.results[i] && LAST.results[i].dims) || { L: 0.8, W: 0.2, H: 0.2 };
      const podRow = (label, key, lo, hi, title) => range(box, label, title, lo, hi, 0.01, cur()[key], fmtM,
        x => { const d = cur(); v.dims = { L: d.L, W: d.W, H: d.W }; v.dims[key] = x; if (key === 'W') v.dims.H = x; dragLayout(false, i); syncCap(); },
        x => { const d = cur(); v.dims = { L: d.L, W: d.W, H: d.W }; v.dims[key] = x; if (key === 'W') v.dims.H = x; relayout(); commitSoon(); });
      podRow('length', 'L', 0.3, 2.0, 'along the line of flight');
      podRow('diameter', 'W', 0.1, 0.6, 'the pod: its girth');
      range(box, 'up the strut', 'where the pod sits, as a fraction of the strut from its foot on the body (0) to the wing (1)',
        bay.span[0], bay.span[1], 0.01, v.along != null ? v.along : 0.5 * (bay.span[0] + bay.span[1]), fmtF,
        x => { v.along = x; dragLayout(false, i); }, x => { v.along = x; relayout(); commitSoon(); });
    }
    if (bay && bay.on !== 'wing' && bay.on !== 'strut') {
      const cur = () => v.dims || (LAST.results[i] && LAST.results[i].dims) ||
        { L: 0.5, W: 0.35, H: 0.25 };
      // (TANK-FIT Part 2: a size row makes an auto nose tank the player's: free, a squared box from then on)
      const freeIt = () => { if (v.fit === 'auto') { delete v.fit; if (v.form === 'deck') v.form = 'box'; } };
      const sizeRow = (label, key, hi, title) => range(box, label, title, 0.08, hi, 0.01,
        cur()[key], fmtM,
        x => { freeIt(); const d = cur(); v.dims = { L: d.L, W: d.W, H: d.H }; v.dims[key] = x;
               dragLayout(false, i); syncCap(); },
        x => { freeIt(); const d = cur(); v.dims = { L: d.L, W: d.W, H: d.H }; v.dims[key] = x;
               relayout(); renderPanel(); syncCap(); commitSoon(); });
      const secW = LAST.results[i] && LAST.results[i].section
        ? Math.max(0.3, LAST.results[i].section.xHi - LAST.results[i].section.xLo) : 1.2;
      sizeRow('length', 'L', Math.max(0.4, (bay.hx1 != null ? bay.hx1 : bay.x1) - (bay.hx0 != null ? bay.hx0 : bay.x0)), 'along the body');
      sizeRow('width', 'W', secW, 'across the body');
      sizeRow('height', 'H', 1.0, 'up');
    }

    if (bay && bay.on === 'strut') {
      // (the pod's rows are above)
    } else if (bay && bay.on === 'wing') {
      // LABELS ARE THE TRUNK'S WORDS (G191, HANDOVER "LABEL CONVENTIONS"):
      // a row that is a fore/aft or an up/down says so, the domain word in
      // brackets where the plain word would be ambiguous
      range(box, 'in / out (span)', 'where the tank STARTS, as a fraction of the ' +
        'semispan; it runs outboard from here until it holds its litres',
        bay.span[0], bay.span[1], 0.01,
        v.along != null ? v.along : bay.span[0], fmtF,
        x => { v.along = x; dragLayout(false, i); }, x => { v.along = x; relayout(); commitSoon(); });
    } else if (bay) {
      const dflt = 0.5 * (bay.x0 + bay.x1);
      // G2799: the slider spans the HAND's range (the rule's, plus a reach
      // the swept field still measures); a new tank still starts in the bay
      const hx0 = bay.hx0 != null ? bay.hx0 : bay.x0, hx1 = bay.hx1 != null ? bay.hx1 : bay.x1;
      // TANK-FIT: the hand moves the tank fore and aft at ITS HEIGHT (lvKeepingHeight), a frame at a time
      // (dragLayout), and the release lays every tank out and judges it whole
      // (moving an auto nose tank makes its place the player's: the shape stays, the fit is no longer re-run)
      const unAuto = () => { if (v.fit === 'auto') delete v.fit; };
      const foreAft = x => { unAuto(); if (legacyFit()) { v.along = x; return; } const lv = lvKeepingHeight(i, x); v.along = x; if (lv != null) v.lv = lv; };
      range(box, 'fore / aft', 'metres aft of the firewall — the bay runs ' +
        bay.x0.toFixed(2) + ' to ' + bay.x1.toFixed(2) + ' m, the tank can go ' +
        hx0.toFixed(2) + ' to ' + hx1.toFixed(2) + ' m', hx0, hx1,
        0.01, v.along != null ? v.along : dflt, fmtM,
        x => { foreAft(x); dragLayout(false, i); },
        x => { foreAft(x); relayout(); if (v.lv != null) syncRow(i, 'up / down', v.lv, fmtF); commitSoon(); });
      const lvB = bay.lv || [0, 1];
      range(box, 'up / down', 'keel to crown, within the bay’s own band', lvB[0],
        lvB[1], 0.01, v.lv != null ? v.lv : 0.5 * (lvB[0] + lvB[1]), fmtF,
        x => { unAuto(); v.lv = x; dragLayout(false, i); }, x => { unAuto(); v.lv = x; relayout(); commitSoon(); });
      range(box, 'turn (yaw)', 'about the vertical: a long tank across a wide bay, ' +
        'or along a narrow one', -90, 90, 1, v.rot || 0, fmtD,
        x => { unAuto(); v.rot = x; dragLayout(false, i); }, x => { unAuto(); v.rot = x; relayout(); commitSoon(); });
    }
    const rd = el('div', 'r note');
    box.appendChild(rd);
    READ[i] = rd;

    if (EN.vessels.length > 1) {
      const rm = row(box, '', '');
      const b = document.createElement('button');
      b.textContent = 'remove this ' + (EN.kind === 'battery' ? 'pack' : 'tank');
      b.className = 'wide';
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
    b.className = 'wide';
    b.title = 'two tanks bracketing the CG barely move it as they burn — ' +
      'which is why real aeroplanes carry two';
    b.onclick = () => {
      // the first bay with room that is not already taken, else the nose
      const used = new Set(EN.vessels.map(x => x.bay));
      const free = BAYS.find(x => !used.has(x.key) && x.roomL > 20) || BAYS[0];
      const nk = free ? free.key : 'nose';
      EN.vessels.push(Object.assign({ bay: nk,
        capacity: EN.kind === 'battery' ? 6 : 30, along: null, lv: null, rot: 0,
        form: 'box' }, nk === 'nose' && NOSE_AUTO_ON && !legacyFit() ? { fit: 'auto' } : {}));
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
  totalEl = el('div', 'r note');
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
  fillEl = el('div', 'r note');
  B.appendChild(fillEl);
  barEl = el('div', 'cgBar');
  barEl.title = 'the CG envelope: forward corner to aft corner, in % MAC; the ' +
    'marker is the CG at the fuel aboard';
  B.appendChild(barEl);
  // ---- G101: THE BALANCE CHART, with the loading as what-ifs ---------------
  // Occupants and baggage here are VIEW state: the loading you want to SEE
  // the aeroplane at, not the loading the build carries (that is the crew
  // layer's occupants and the spec's own baggage). Every point on the chart is
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
    chartEl.className = 'cgChart';
    chartEl.title = 'weight and balance: CG across (% of the mean chord), mass up. ' +
      'The blue line is the CG walking as the fuel burns at this loading, full ' +
      'to dry, the hollow point at reserves; the yellow dot is the fuel aboard; ' +
      'the circles are the four loading corners; NEUTRAL is where the static ' +
      'margin reaches zero and CAUTION 5% of the chord ahead of it. No forward ' +
      'limit is drawn: the model has no elevator-authority rule to place one.';
    B.appendChild(chartEl);
  }
  tableEl = el('div', 'r note');
  B.appendChild(tableEl);
  if (inGame()) {
    balEl = el('div', 'r note');
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
    // a pod with no strut is not aboard (the core's `unmounted`): not in the totals
    if (!r.unmounted) { totCap += r.v.capacity; totKg += r.res.contentsKg; totVes += r.res.vesselKg; price += r.res.price; }
    if (!d) return;
    const bits = [];
    bits.push('needs ' + r.needL.toFixed(0) + ' of ' + (r.roomL || 0).toFixed(0) + ' L');
    if (r.on === 'body' && r.clear != null && isFinite(r.clear))
      bits.push(r.clearTo || legacyFit() ? (r.clear * 1000).toFixed(0) + ' mm to the ' + (r.clearTo || 'skin')
                                         : 'over ' + (NEAR_R * 1000).toFixed(0) + ' mm clear all round');
    if (r.on === 'wing' && r.spanM != null)
      bits.push(r.spanM.toFixed(2) + ' m of span each side');
    if (r.on === 'strut' && r.pods && r.pods.length)
      bits.push('a ' + r.pods[0].L.toFixed(2) + ' x ' + r.pods[0].D.toFixed(2) + ' m pod each side');
    if (r.unmounted) { d.textContent = '✗ NOT FITTED, CARRIES NO FUEL — ' + r.why.join('; '); d.classList.add('bad'); return; }
    if (r.pending) { d.textContent = '… fitting the tank to the nose'; d.classList.remove('bad'); return; }
    bits.push(r.res.vesselKg.toFixed(1) + ' kg ' + (EN.kind === 'battery' ? 'case + cells' : 'tank') +
      (EN.kind === 'battery' ? '' : ' + ' + r.res.contentsKg.toFixed(1) + ' kg fuel'));
    if (r.on === 'body' && !r.crewHits) bits.push('clears the crew');
    if (r.v.shaped === 'auto' && r.v.fit === 'auto') bits.push('fitted to the nose (' + ((r.v.gap != null ? r.v.gap : NOSE_GAP) * 100).toFixed(0) + ' cm under the deck)');
    else if (r.v.shaped) bits.push('shaped to the bay' +
      (r.v.shaped === 'crew' ? ', height capped above the crew'
       : r.v.shaped === 'band' ? ', height capped by the bay' : ''));
    d.textContent = (r.ok ? '✓ fits · ' : '✗ ') + bits.join(' · ') +
      (r.ok ? '' : ' — ' + r.why.join('; ') + ' · it flies, but the bench will not certify it');
    d.classList.toggle('bad', !r.ok);
  });
  if (totalEl)
    totalEl.textContent = 'total ' + totCap.toFixed(0) + ' ' + unit() + ' · ' +
      (EN.kind === 'battery'
        ? (totKg + totVes).toFixed(0) + ' kg of pack, empty weight'
        : totKg.toFixed(0) + ' kg of fuel + ' + totVes.toFixed(1) + ' kg of tank') +
      ' · ' + price.toFixed(0) + ' cr';
}

window.CAGE_ENERGY = {
  EN, fromSpec, toSpec, relayout, commit, setEnv: vesselSetEnv, fitOf, capacityFromDims,
  // the flown aeroplane's door into the factory (app.js matFor, `m.ves`)
  material: vesselMatFor,
  // the two columns' doors: structure gets the whole panel, finish gets the
  // look rows (_cage_parts.js `panel` / `panelFinish`)
  panelFinish: lookElement,
  results: () => LAST.results, bays: () => BAYS, last: () => LAST,
  // TANK-FIT: the drag's one-frame layout (dragLayout(true) runs it now), the fore/aft hand's level, the knobs
  dragLayout: (now, i) => dragLayout(now, i == null ? DRAG.i : i), lvKeepingHeight,
  clearance: { CLEAR_GAP, CREW_GAP, SAMPLE_STEP, NEAR_R },
  index: () => ({ soup: SURF_ALL && { n: SURF_ALL.n, sheet: SURF_ALL.nSheet, ms: SURF_ALL.ms }, grid: OBST && { n: OBST.n, cell: OBST.cell, N: OBST.N, blocks: OBST.blocks && OBST.blocks.length, built: OBST.built, entries: OBST.entries, ms: OBST.ms }, crew: CREW_PTS && { n: CREW_PTS.n } }),
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
