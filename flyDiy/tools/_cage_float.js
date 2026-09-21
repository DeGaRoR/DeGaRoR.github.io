// CAGE FLOAT LAYER — the seaplane's floats, drawn on the live cage (H2, G389;
// THE WIPLINE FLOATS, G451, 2026-09-20).
//
// WATER-2026-09-13.md §1.5 and ruling (as): "the join MEASURES the drawn
// float — planing length, beam, deadrise, step station, and the buoyant
// volume". This layer draws the float from the SAME hull generator the water
// physics runs on (src/core/32_hydro.js, `HYDRO.makeFloat`, at drawing
// resolution through tools/_float_gen.js): the mesh the builder sees and the
// panels the water pushes on are one section family, so the join has
// nothing to reconstruct — it reads the hull's parameters and WHERE the
// float stands (the step station, the keel height, the track) off the drawn
// record, and the frame (61_gen_frame) builds the float's nodes and the
// solver's hull from exactly those numbers. One source of truth, twice
// drawn.
//
// G451 — THE WIPAIRE RANGE (the user: "we'll model our procedural floats
// according to the Wipaire range of floats. Like the engines, we'll have
// presets corresponding to the Wipline line"). The hull family is the
// 2350's, the catalogue is HYDRO.FLOAT_PRESETS (fifteen rows, 1450 to
// 13000, the four measured dimensions of each honoured by the family's
// fineness fit), and `fltPreset` is a STARTER on the engine-preset pattern:
// picking a row writes the hull rows ONCE, and every one of them stays the
// builder's to edit afterwards (the row's own label says "applies once";
// a load never re-fires it — PAGE.load, GATE STARTER). The details, the
// water rudder and the paddle are FLOAT_GEN's (see its header for the list
// and the parts-manual references), sized by the hull; the water rudder is
// its own part so the game can steer and retract it.
//
// Load order: after _cage_gear.js (it stands on the same airframe contract
// and roots its struts where the gear layer's legs would), before _cage_fin.
// Chains PAGE.post like every layer. Needs FLOAT_GEN (tools/_float_gen.js,
// loaded just before this file) to draw; without it the record is still
// published (the physics needs no drawing).
//
// UNITS: metres, in the cage frame (+x port, +y up, +z forward). The hull
// generator works in the MODEL frame (x aft, y up, z right): cage =
// (-mz, my, -mx) plus the float's placement. `planeScale` reaches the
// airframe through cageAirframe as the gear layer does; the float itself is
// hardware, metric, and never scales — a float is a ruler like a wheel is.
//
// THE PLACEMENT RULE: the step goes AFT of the CG, 12 deg off the vertical
// from the CG down to the keel (the seaplane's 10-15; G382 measured a float
// with its step at the wheels' station sitting on its tail at 18 deg). The
// row `fltZ` is an OFFSET from that rule (0 = the rule), so a builder can
// slide the floats without losing the datum they were placed by.
//
// THE RIGGING, as the 2350 parts manual lists it (section 9, "struts, wires,
// steps & spreader bars"): streamlined struts a side from the two deck
// fitting stations (the front spreader bar's, at the keel flat's forward
// end, and the aft spreader bar's, just aft of the step) up to the fuselage
// flank at the family's angle — the same fitting sites the gear legs use
// (AF.surf); two SPREADER BARS of airfoil section right across both decks,
// flush with them; drag wires fore and aft on each side; cross wires between
// the bars. Drawn as members with `strutMembers` on the unit, so the join
// rides each end on its own physics node (the G179.2 contract): the frame
// builds a beam for every one of them.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const GG = window.GEAR_GEN, GK = window.GEAR_KIT, CG2 = window.CAGE2;
if (!GG || !GK) { console.error('cage float layer: gear modules not loaded'); return; }
const D2R = Math.PI / 180;
const HYc = () => window.HYDRO_GEN || (typeof HYDRO !== 'undefined' ? HYDRO : null);

// ---- the catalogue, as the row sees it ----------------------------------------
const HY0 = HYc();
const PRESET_NAMES = HY0 ? HY0.FLOAT_PRESET_NAMES.slice() : ['Wipline 2350'];
const CUSTOM = 'custom';
PRESET_NAMES.push(CUSTOM);
const CUSTOM_IDX = PRESET_NAMES.length - 1;
const PRESET_LABELS = PRESET_NAMES.map(n => {
  if (n === CUSTOM) return 'custom (the dials as they are)';
  const R = HY0 && HY0.FLOAT_PRESETS[n];
  return R ? `${n} — ${R.L.toFixed(2)} m, ${R.disp} kg${R.est ? ' (est.)' : ''}` : n;
});

// ---- defaults ------------------------------------------------------------
// The hull rows are the family's (HYDRO.DEF) at the Wipline 1450's size —
// the smallest of the line, the one a fresh ultralight would wear; the
// preset row is a starter, so a builder who wants the 172's floats picks
// the 2350 and the rows follow. The frame's own sizing rule
// (HYDRO.floatParamsFor: a pair displaces 180 % of the gross) is what a
// spec with no drawn float still gets.
const rowsOfParams = Q => ({
  fltL: Q.L, fltStep: Q.xs / Q.L, fltB: Q.B, fltH: Q.H, fltBeta: Q.beta, fltBetaBow: Q.betaBow,
  fltBetaA: Q.betaA, fltHs: Q.hs, fltAft: Q.aftAngle, fltAftCurve: Q.aftCurve, fltFlat: Q.flatK,
  fltStem: Q.stemK, fltRake: Q.rake, fltNoseR: Q.noseR, fltPlan: Q.planK, fltStern: Q.bStern,
  fltFlare: Q.flare, fltMass: Q.mFloat,
  fltSpreadAft: +(0.28 * (Q.scale || 1)).toFixed(2),      // the aft spreader bar, just aft of the step
});
const DEF_ROWS = HY0 ? rowsOfParams(HY0.presetParams('Wipline 1450')) : {};
// (the preset row itself boots at `custom`: a build saved before G451 must
// not come back labelled as a catalogue row its dials never were)
Object.assign(PAGE.defaults = PAGE.defaults || {}, {
  fltPreset: CUSTOM_IDX, fltDetail: 1, fltPaddle: 1, fltRudder: 1,
  fltL: 4.60, fltStep: 0.553, fltB: 0.64, fltH: 0.50, fltBeta: 25, fltBetaBow: 48, fltBetaA: 20,
  fltHs: 0.058, fltAft: 6.9, fltAftCurve: 0.08, fltFlat: 0.29, fltStem: 0.34, fltRake: 12,
  fltNoseR: 0.17, fltPlan: 2.7, fltStern: 0.39, fltFlare: 4, fltMass: 27,
}, DEF_ROWS, {
  fltZ: 0, fltDrop: 0.55, fltInc: 0, fltTrack: 0.80, fltStrutR: 0.018, fltWires: 1,
  fltStrutAng: 55, fltSpread: 1, fltSpreadAft: 0.36,
});

const on = { when: P => +P.gearFloats };
const onM = { when: P => +P.gearFloats, dim: 'm' };
const GROUP = ['9b · floats', [
  // the switch itself, so a builder can reach the floats without the starter
  // (and GATE PARTS can see the feature is reachable); the wheel stations
  // are off while it is on (the join reads the flag before the contacts)
  ['gearFloats', 'floats (instead of wheels)', 0, 1, 1],
  // THE CATALOGUE (G451): a Wipline row writes the hull rows once
  ['fltPreset', 'Wipline preset (applies once)', 0, Math.max(1, PRESET_NAMES.length - 1), 1, PRESET_NAMES,
   { when: P => +P.gearFloats, optLabels: PRESET_LABELS }],
  ['fltDetail', 'details (covers, hatch, cleats, straps, bumper)', 0, 1, 1, on],
  ['fltRudder', 'water rudders', 0, 1, 1, on],
  ['fltPaddle', 'paddle', 0, 2, 1, ['none', 'on the left float', 'on both floats'], on],
  ['hull', [
    ['fltL',      'length',                        2.5, 11.0, 0.01, onM],
    ['fltStep',   'step (fraction from bow)',       0.45, 0.65, 0.005, on],
    ['fltB',      'hull width (deck)',              0.40, 1.50, 0.01, onM],
    ['fltH',      'hull height (step keel to deck)', 0.30, 1.30, 0.01, onM],
    ['fltBeta',   'deadrise at the step °',         8, 40, 0.5, on],
    ['fltBetaBow','deadrise at the bow °',          20, 65, 0.5, on],
    ['fltBetaA',  'deadrise (afterbody) °',         8, 35, 0.5, on],
    ['fltHs',     'step depth',                     0.02, 0.15, 0.002, onM],
    ['fltAft',    'afterbody keel °',               3, 12, 0.1, on],
    ['fltAftCurve','afterbody keel curve',          0, 0.25, 0.005, on],
    ['fltFlat',   'keel flat (fraction of forebody)', 0.10, 0.60, 0.01, on],
    ['fltStem',   'stem height (fraction of H)',    0.10, 0.60, 0.01, on],
    ['fltRake',   'stem rake °',                    0, 30, 0.5, on],
    ['fltNoseR',  'nose round (fraction of H)',     0.05, 0.40, 0.01, on],
    ['fltPlan',   'plan fullness',                  1.2, 4.0, 0.05, on],
    ['fltStern',  'stern beam ×',                   0.20, 0.80, 0.01, on],
    ['fltFlare',  'side flare °',                   0, 12, 0.5, on],
    ['fltMass',   'hull mass (each)',               10, 400, 1, { when: P => +P.gearFloats, dim: 'kg' }],
  ], on],
  ['placement', [
    ['fltZ',     'step fore / aft (from the rule)', -1.5, 1.5, 0.01, onM],
    ['fltDrop',  'keel below the belly',  0.20, 1.50, 0.01, onM],
    ['fltInc',   'keel incidence °',     -5, 10, 0.5, onM],
    ['fltTrack', 'half track',            0.40, 1.60, 0.01, onM],
  ], on],
  ['struts', [
    ['fltStrutR',  'strut thickness',      0.008, 0.040, 0.001, onM],
    ['fltStrutAng','strut root angle °',  20, 85, 1, on],
    ['fltSpread',  'spreader bars',       0, 1, 1, on],
    ['fltSpreadAft','aft spreader (aft of the step)', 0.10, 1.20, 0.01, onM],
    ['fltWires',   'cross wires',         0, 1, 1, on],
  ], on],
]];
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// the hull's parameters as 32_hydro reads them, from the rows: the family
// scaled to the row's length (the details, the radii, the water rudder
// follow the size), the rows over it
function hullParams(P) {
  const HY = HYc();
  const L = +P.fltL, k = L / HY.DEF.L;
  const Q = HY.scaleParams(HY.DEF, k, {
    L, xs: +P.fltStep * L, B: +P.fltB, H: +P.fltH, beta: +P.fltBeta, betaBow: +P.fltBetaBow, betaA: +P.fltBetaA,
    hs: +P.fltHs, aftAngle: +P.fltAft, aftCurve: +P.fltAftCurve, flatK: +P.fltFlat, stemK: +P.fltStem,
    rake: +P.fltRake, noseR: +P.fltNoseR, planK: +P.fltPlan, bStern: +P.fltStern, flare: +P.fltFlare,
    mFloat: +P.fltMass, inc: +P.fltInc, xAft: +P.fltSpreadAft,
  });
  Q.scale = k;
  const name = PRESET_NAMES[Math.round(P.fltPreset)];
  if (name && name !== CUSTOM) Q.preset = name;
  return Q;
}

// ---- THE STARTER (the engine-preset pattern) ---------------------------------
// "has the preset ROW changed since I last looked?" — the first look records,
// a change fires, and a LOAD is not a row change (PAGE.load forgets).
// Published for GATE STARTER, which drives it without a scene.
let lastPreset = null;
function floatPresetStarter(P) {
  const psel = Math.round(P.fltPreset);
  if (lastPreset === null) { lastPreset = psel; return null; }
  if (psel === lastPreset) return null;
  lastPreset = psel;
  const name = PRESET_NAMES[psel];
  return name && name !== CUSTOM ? name : null;
}
// write a catalogue row's hull into the rows (the fineness-fitted family:
// what presetParams solved for the row's four numbers)
function applyFloatPreset(P, name) {
  const HY = HYc();
  const Q = HY && HY.presetParams(name);
  if (!Q) return false;
  Object.assign(P, rowsOfParams(Q));
  return true;
}
const prevLoad = PAGE.load;
PAGE.load = () => { if (prevLoad) prevLoad(); lastPreset = null; };
if (typeof window !== 'undefined') {
  window.CAGE_FLOAT_STARTER = floatPresetStarter;
  window.CAGE_FLOAT_APPLY_PRESET = applyFloatPreset;
  window.CAGE_FLOAT_PRESETS = PRESET_NAMES;
  window.CAGE_FLOAT_CUSTOM = CUSTOM_IDX;
}

// ---- the build ------------------------------------------------------------
let group = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};
// model (x aft, y up, z right) -> cage (+x port, +y up, +z forward)
// THE RIGGING (G396.3): the hull is rotated about its step keel by the
// keel incidence — positive is bow DOWN relative to the datum, the way a
// real float is rigged (2-5 deg keel to the wing chord), so that on the
// step, keel level with the water, the wing flies at a useful angle. The
// frame rotates its nodes by the same angle about the same point
// (61_gen_frame.js), so the drawn hull and the flown one agree.
let INC = 0;
const rotInc = m => { const c = Math.cos(INC), s = Math.sin(INC); return [m[0] * c - m[1] * s, m[0] * s + m[1] * c, m[2]]; };
const toCage = (m, at) => { const r = rotInc(m); return [-r[2] + at[0], r[1] + at[1], -r[0] + at[2]]; };
// a direction (no placement)
const dirCage = m => { const r = rotInc(m); return [-r[2], r[1], -r[0]]; };
// a FLOAT_GEN part -> a mesh in the cage frame (indexed, smooth normals);
// `mirror` flips the model's z (the port float is the starboard build
// mirrored, so its paddle and its pump-out cups land inboard and outboard)
function partMesh(part, at, mat, mirror, name) {
  if (!part || !part.idx.length) return null;
  const n = part.pos.length / 3, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const m = [part.pos[i * 3], part.pos[i * 3 + 1], mirror ? -part.pos[i * 3 + 2] : part.pos[i * 3 + 2]];
    const c = toCage(m, at);
    pos[i * 3] = c[0]; pos[i * 3 + 1] = c[1]; pos[i * 3 + 2] = c[2];
  }
  // the model->cage map (-mz, my, -mx) is a REFLECTION (det -1): it flips
  // the winding, and the mirror flips it back — so it is the unmirrored
  // starboard float whose triangles are swapped here
  const idx = !mirror ? part.idx.map((v, i) => (i % 3 === 1 ? part.idx[i + 1] : i % 3 === 2 ? part.idx[i - 1] : v)) : part.idx;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  if (name) mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
// a streamlined member: an airfoil-ish section, its chord along the cage's
// forward axis (the flight direction), thickness `t`, chord 2.6 t
function streamlined(bag, a, b, t, chordK) {
  const c = (chordK || 2.6) * t;
  const sect = [];
  for (let k = 0; k < 16; k++) {
    const ang = 2 * Math.PI * k / 16;
    const u = 0.5 * c * Math.cos(ang), v = 0.5 * t * Math.sin(ang) * (0.82 + 0.18 * Math.cos(ang));   // fatter forward
    sect.push([u, v]);
  }
  return GK.sweep(bag, [a, b], () => sect, true, [0, 0, 1]);
}

const prevPost = PAGE.post;
PAGE.post = ctx => {
  const { scene, mesh, P, stat } = ctx;
  // THE STARTER FIRES BEFORE THE CHAIN, like the engine's: the rows it
  // writes are read by this layer's own build below and by the join after
  if (+P.gearFloats) {
    const fire = floatPresetStarter(P);
    if (fire && applyFloatPreset(P, fire)) {
      const UI = window.CAGE_UI;
      if (UI && UI.syncSliders) UI.syncSliders();
    }
  }
  if (prevPost) prevPost(ctx);
  dispose(group); group = null;
  window.CAGE_FLOAT = null;
  if (!+P.gearFloats) return;
  const HY = HYc();
  if (!HY || !HY.makeFloat) { if (stat) stat.textContent += '  ·  floats: 32_hydro not loaded'; return; }
  const FG = window.FLOAT_GEN;
  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const AF = GG.cageAirframe(mesh, FS);
  if (!AF) { if (stat) stat.textContent += '  ·  floats: no skin to hang on'; return; }

  const HP = hullParams(P);
  INC = (+P.fltInc || 0) * D2R;
  const F = HY.makeFloat(Object.assign({}, HP, { mLoad: 0, cgLoad: [0, 0, 0], loadI: [0, 0, 0] }));
  // THE STEP STATION: 12 deg aft of the CG at the keel's depth below it,
  // plus the builder's offset. THE CG IS THE FLOWN AEROPLANE'S (app.js
  // publishes it, the join's datums bring it into the cage frame); the gear
  // page's hand-set cgZ is the fallback before the first build, and it was
  // 0.5 m off on the user's ultralight
  const DAT = window.CAGE_DATUM, CGM = window.FLYDIY_CG_MODEL;
  const cgZ = (DAT && DAT.fwOk && CGM) ? DAT.zFw - CGM[0] : +P.cgZ;
  const cgY = (DAT && CGM) ? CGM[1] + DAT.yD : +P.cgY;
  const keelY0 = AF.keelAt(cgZ) - +P.fltDrop;
  const zStep = cgZ - Math.tan(12 * D2R) * Math.max(0.2, cgY - keelY0) + +P.fltZ;
  const zc = Math.max(AF.z0 + 0.3, Math.min(AF.z1 - 0.3, zStep));
  const keelY = AF.keelAt(zc) - +P.fltDrop;
  const track = +P.fltTrack;

  group = new THREE.Group();
  group.name = 'cageLayer:float';
  scene.add(group);
  const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
  const hullM = () => (SM && SM('float', { surf: 0, fieldM: 1, tint0: 0xd8d2c2 }))
    || new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.55, metalness: 0.05 });
  const deckM = () => (SM && SM('floatDeck', { surf: 0, fieldM: 1, tint0: 0x2e3135 }))
    || new THREE.MeshStandardMaterial({ color: 0x2e3135, roughness: 0.95, metalness: 0.0 });
  const strutM = () => (SM && SM('gearLeg', { surf: 0, fieldM: 1, tint0: 0x98a2ad }))
    || GG.gearMat('steel');
  const wireM = () => GG.gearMat('steel');
  const hardM = () => GG.gearMat('alloy');
  const rubberM = () => GG.gearMat('dark');

  const sc = HP.scale;
  const rec = { P: HP, zStep: zc, keelY, track, tetraC: {}, members: [], deck: {}, rud: {}, vol: F.volDeck, cgZ, cgY,
                cgFrom: (DAT && CGM) ? 'flown' : 'page', preset: HP.preset || null };
  const exG = Math.max(0, P.explodeD || 0) * FS;
  const paddleK = Math.round(P.fltPaddle || 0);
  const fits = {};                                 // per side: the deck fitting points (cage)
  for (const sd of [-1, 1]) {                     // -1 starboard (cage -x), +1 port
    const at = [sd * track, keelY, zc];
    const mirror = sd > 0;                          // the port float is the starboard build mirrored
    const tag = sd > 0 ? 'L' : 'R';
    const ug = new THREE.Group();
    ug.name = 'edFloat' + tag;
    group.add(ug);
    if (exG > 0) ug.position.x += sd * exG;         // explode: outboard (display only)
    // the paddle: "on the left float" = the port float (sd +1); both = both;
    // -1 in the model frame is the float's own port side, which the mirror
    // turns inboard on the port float and which IS inboard on the starboard
    const paddle = paddleK === 2 || (paddleK === 1 && sd > 0) ? -1 : 0;
    let out = null;
    if (FG) {
      out = FG.build(HP, { HY, detail: +P.fltDetail ? 1 : 0, rudder: +P.fltRudder ? 1 : 0, paddle, xAft: HP.xAft });
      const add = (part, mat, nm) => { const m = partMesh(part, at, mat, mirror, nm); if (m) ug.add(m); return m; };
      add(out.hull, hullM(), 'edFloatHull' + tag);
      if (out.protrusions) add(out.protrusions, hullM());
      if (out.bumper) add(out.bumper, rubberM());
      if (out.deck) add(out.deck, deckM());
      if (out.hard) add(out.hard, hardM());
      if (out.paddle) { add(out.paddle.shaft, hardM()); add(out.paddle.blade, rubberM()); }
      if (out.rudder) {
        add(out.rudder.hard, hardM());
        // THE BLADE IS ITS OWN PART: the game steers it about the post and
        // retracts it about the arms' pivot (app.js reads `rud`)
        const rg = new THREE.Group();
        rg.name = 'edFloatRud' + tag;
        const bm = partMesh(out.rudder.blade, at, hullM(), mirror, 'edFloatRudBlade' + tag);
        if (bm) rg.add(bm);
        group.add(rg);
        const mz = v => [v[0], v[1], mirror ? -v[2] : v[2]];
        rec.rud[tag] = { post: toCage(mz(out.rudder.post), at), axis: dirCage(mz(out.rudder.axis)),
                         pivot: toCage(mz(out.rudder.pivot), at), hinge: dirCage(mz(out.rudder.hinge)) };
      }
    } else {
      // no generator (a headless page without it): the physics loft, bare
      const bag = GK.Bag();
      const vidBy = {};
      const vid = (kind, i) => { const m = vidBy[kind] || (vidBy[kind] = new Map()); if (!m.has(i)) m.set(i, bag.v(toCage(F.V[i], at))); return m.get(i); };
      for (const pn of F.panels) bag.tri(vid(pn.kind, pn.v[0]), vid(pn.kind, pn.v[1]), vid(pn.kind, pn.v[2]));
      bag.mesh(ug, hullM());
    }
    // the tetra the physics rides (32_hydro tetraCtx): step keel, bow keel,
    // step deck edges — the frame's own four nodes, in cage metres
    const sK = F.sta[F.nF], sB = F.sta[0];
    const K = F.V[sK.K], KB = F.V[sB.K], DL = F.V[sK.Dm], DR = F.V[sK.Dp];
    rec.tetraC[tag] = [K, KB, DL, DR].map(v => toCage(v, at));
    // the deck fitting points at the two rigging stations (the same
    // stations FLOAT_GEN put its fitting plates on): inboard and outboard
    const rig = out ? out.rig : { fwd: -HP.flatK * HP.xs, aft: HP.xAft };
    const fit = (x, inb) => {
      const s = HY.sectionOf(HP, x === 0 ? -1e-9 : x);
      const zOut = s.bd - 0.05 * sc;
      // inboard is the model's -z for the starboard float (toward the
      // centreline at cage +x), which the mirror handles for the port one
      const zm = (inb ? -1 : 1) * zOut * (mirror ? -1 : 1);
      return toCage([x + 0.12 * sc, s.yd, zm], at);
    };
    rec.deck[tag] = { fwdIn: fit(rig.fwd, true), fwdOut: fit(rig.fwd, false), aftIn: fit(rig.aft, true), aftOut: fit(rig.aft, false) };
    fits[tag] = rec.deck[tag];
  }
  // THE RIGGING: struts, spreader bars, wires — members published for the
  // join; drawn as streamlined tubes / airfoil bars / cables
  const ang = +P.fltStrutAng * D2R;
  const sg = GK.Bag(), wg = GK.Bag(), hg = GK.Bag();
  const t = +P.fltStrutR;
  const root = (z, sd) => { const q = AF.surf(z, sd * ang); return [q[0], q[1], q[2]]; };
  const member = (pin, tip, bag, tt) => { streamlined(bag, pin, tip, tt); rec.members.push({ pin, tip }); };
  const wire = (a, b) => {
    GK.tube(wg, a, b, 0.0025, 6);
    // a turnbuckle a third of the way from the deck end
    const m = [a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3, a[2] + (b[2] - a[2]) * 0.3];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1;
    const e = [m[0] + d[0] / L * 0.045, m[1] + d[1] / L * 0.045, m[2] + d[2] / L * 0.045];
    GK.tube(hg, m, e, 0.007, 8);
    rec.members.push({ pin: a, tip: b });
  };
  // THE WIPLINE TRUSS (G451, the 2350 parts manual section 9 and the
  // installation profile on its p. 97): a side carries THREE struts, all
  // rooted on the spreader bars' inboard deck fittings — the FRONT strut
  // (front bar up to the forward fuselage fitting), the CENTRE strut (aft
  // bar forward-and-up to the same forward fitting) and the REAR strut (aft
  // bar up to the main fitting) — and the fore-aft DRAG WIRE that opposes
  // the centre strut (front bar to the main fitting). Between the floats,
  // at each bar, the "wire pulls" cross: each float's fitting to the
  // fuselage fitting on the OTHER side. The frame flies its own truss
  // (61_gen_frame); this is the drawing, every member two-ended on nodes.
  const roots = {};
  for (const sd of [-1, 1]) {
    const tag = sd > 0 ? 'L' : 'R', d = rec.deck[tag];
    const rF = root(d.fwdIn[2], sd), rA = root(d.aftIn[2], sd);
    roots[tag] = { rF, rA };
    member(rF, d.fwdIn, sg, t);            // front
    member(rF, d.aftIn, sg, t);            // centre
    member(rA, d.aftIn, sg, t);            // rear
    // the fuselage fittings: a lug pair at each root
    for (const r of [rF, rA]) GK.boxIn(hg, r, [0.03, 0.012, 0.03], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    if (+P.fltWires) wire(d.fwdIn, rA);    // the drag wire
  }
  if (+P.fltWires) {
    // the wire pulls: crossed in the transverse plane at each bar
    const L = rec.deck.L, R = rec.deck.R;
    wire(L.fwdIn, roots.R.rF); wire(R.fwdIn, roots.L.rF);
    wire(L.aftIn, roots.R.rA); wire(R.aftIn, roots.L.rA);
  }
  if (+P.fltSpread) {
    // THE SPREADER BARS: airfoil section, right across both decks, flush
    // with them (their tops level with the deck), ends on the outboard
    // fittings; the members the frame reads run inboard edge to inboard edge
    const L = rec.deck.L, R = rec.deck.R;
    const tb = 0.055 * sc, cb = 0.16 * sc;
    const lower = p => [p[0], p[1] - 0.5 * tb + 0.002, p[2]];
    for (const [a, b] of [[L.fwdOut, R.fwdOut], [L.aftOut, R.aftOut]]) {
      const sect = [];
      for (let k = 0; k < 18; k++) { const q = 2 * Math.PI * k / 18; sect.push([0.5 * cb * Math.cos(q), 0.5 * tb * Math.sin(q) * (0.85 + 0.15 * Math.cos(q))]); }
      GK.sweep(sg, [lower(a), lower(b)], () => sect, true, [0, 0, 1]);
    }
    rec.members.push({ pin: L.fwdIn, tip: R.fwdIn }, { pin: L.aftIn, tip: R.aftIn });
  }
  const sgp = new THREE.Group(); sgp.name = 'edFloatStruts';
  sg.mesh(sgp, strutM()); wg.mesh(sgp, wireM()); hg.mesh(sgp, hardM());
  sgp.userData.strutMembers = rec.members.map(m => ({ pin: m.pin.slice(), tip: m.tip.slice() }));
  group.add(sgp);

  // THE STAND (the user, live: "the plane renders mostly below the
  // ground. It assumed 3 wheels"). The gear layer found no contacts, so it
  // published pitch 0 and gy 0 and the garage stood the cage with its
  // datum on the floor — the floats and half the fuselage under it. A
  // seaplane on a hard stand sits LEVEL ON ITS KEELS (the flat from the
  // flat's end to the step is the lowest line): the ground is the hulls'
  // lowest point, published on the gear layer's own record so placeEditor
  // (app.js) and the gear's grid read one stand. Gear-layer post ran first
  // (load order), so the record exists; its grid is moved onto the keels.
  let gLow = Infinity;
  for (const sd of ['L', 'R']) for (const q of rec.tetraC[sd]) gLow = Math.min(gLow, q[1]);
  for (const v of F.V) gLow = Math.min(gLow, v[1] + keelY);
  if (isFinite(gLow) && window.CAGE_GEAR && !(window.CAGE_GEAR.contacts && window.CAGE_GEAR.contacts.length)) {
    window.CAGE_GEAR.pitch = 0; window.CAGE_GEAR.gy = gLow;
    scene.traverse(o => { if (o.parent && o.parent.name === 'cageLayer:gear' && o.type === 'GridHelper') { o.rotation.x = 0; o.position.set(0, gLow, 0); } });
    if (+P.gearSit && !scene.children.some(o => o.name === 'cageLayer:gear' && o.children.some(c => c.type === 'GridHelper'))) {
      const grid = new THREE.GridHelper(12, 48, 0x39424e, 0x232a33);
      grid.position.set(0, gLow, 0);
      group.add(grid);
    }
  }
  rec.gy = gLow;
  window.CAGE_FLOAT = rec;
  if (stat) {
    const R = HP.preset && HY.FLOAT_PRESETS[HP.preset];
    stat.textContent += `  ·  floats: ${HP.preset || 'custom'} ${HP.L.toFixed(2)} x ${HP.B.toFixed(2)} x ${HP.H.toFixed(2)} m, step z ${zc.toFixed(2)}, keel ${keelY.toFixed(2)}, ` +
      `the pair displaces ${(2 * F.volDeck * 1000).toFixed(0)} kg to the deck${R ? ` (catalogue ${2 * R.flot} max, ${2 * R.disp} rated)` : ''}, ${(2 * HP.mFloat).toFixed(0)} kg of hull`;
    // S1 (G451.1): THE SIZING ADVISOR — the flown aeroplane's all-up mass
    // (app.js publishes it with the CG) against the pair that is fitted
    const M = window.FLYDIY_MASS_MODEL;
    if (M > 0 && HY.floatAdvice) stat.textContent += `  ·  ADVISOR ${HY.floatAdvice(M, HP).line}`;
  }
};
})();
