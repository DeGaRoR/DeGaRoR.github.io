// CAGE FLOAT LAYER — the seaplane's floats, drawn on the live cage (H2, G389).
//
// WATER-2026-09-13.md §1.5 and ruling (as): "the join MEASURES the drawn
// float — planing length, beam, deadrise, step station, and the buoyant
// volume". This layer draws the float from the SAME hull generator the water
// physics runs on (src/core/32_hydro.js, `HYDRO.makeFloat`): the mesh the
// builder sees and the panels the water pushes on are one loft, so the join
// has nothing to reconstruct — it reads the hull's parameters and WHERE the
// float stands (the step station, the keel height, the track) off the drawn
// record, and the frame (61_gen_frame) builds the float's nodes and the
// solver's hull from exactly those numbers. One source of truth, twice
// drawn.
//
// Load order: after _cage_gear.js (it stands on the same airframe contract
// and roots its struts where the gear layer's legs would), before _cage_fin.
// Chains PAGE.post like every layer.
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
// STRUTS: four per float — fore and aft, inboard and outboard deck edge to
// the fuselage flank at the family's angle, the same fitting sites the gear
// legs use (AF.surf) — two spreader bars between the pair, and cross wires.
// Drawn as members with `strutMembers` on the unit, so the join rides each
// end on its own physics node (the G179.2 contract): the frame builds a beam
// for every one of them.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const GG = window.GEAR_GEN, GK = window.GEAR_KIT, CG2 = window.CAGE2;
if (!GG || !GK) { console.error('cage float layer: gear modules not loaded'); return; }
const D2R = Math.PI / 180;

// ---- defaults ------------------------------------------------------------
// The H0 float (an EDO-2000-class pontoon for half a Cub) at the size the
// user's ultralight took in G382 (0.935 of it); the frame's own sizing rule
// (HYDRO.floatParamsFor: a pair displaces 180 % of the gross) is what the
// SIZE tile applies when the builder asks for it.
Object.assign(PAGE.defaults = PAGE.defaults || {}, {
  fltL: 4.30, fltStep: 0.54, fltB: 0.67, fltBeta: 20, fltBetaA: 20,
  fltHs: 0.045, fltAft: 6.5, fltFlat: 0.30, fltBow: 0.36, fltBowB: 0.15,
  fltStern: 0.75, fltSide: 0.22,
  fltZ: 0, fltDrop: 0.55, fltTrack: 0.80, fltStrutR: 0.018, fltWires: 1,
  fltStrutAng: 55, fltSpread: 1,
});

const on = { when: P => +P.gearFloats };
const onM = { when: P => +P.gearFloats, dim: 'm' };
const GROUP = ['9b · floats', [
  // the switch itself, so a builder can reach the floats without the starter
  // (and GATE PARTS can see the feature is reachable); the wheel stations
  // are off while it is on (the join reads the flag before the contacts)
  ['gearFloats', 'floats (instead of wheels)', 0, 1, 1],
  ['fltL',     'length',                 2.5, 7.0, 0.05, onM],
  ['fltStep',  'step (fraction from bow)', 0.40, 0.65, 0.01, on],
  ['fltB',     'beam',                   0.40, 1.20, 0.01, onM],
  ['fltBeta',  'deadrise (fore) °',      0, 35, 0.5, on],
  ['fltBetaA', 'deadrise (aft) °',       0, 35, 0.5, on],
  ['fltHs',    'step depth',             0.0, 0.12, 0.005, onM],
  ['fltAft',   'afterbody keel °',       0, 12, 0.25, on],
  ['fltFlat',  'keel flat (fraction of forebody)', 0.0, 0.9, 0.01, on],
  ['fltBow',   'bow rise',               0.0, 0.8, 0.01, onM],
  ['fltBowB',  'bow half-beam ×',        0.05, 0.5, 0.01, on],
  ['fltStern', 'stern beam ×',           0.4, 1.0, 0.01, on],
  ['fltSide',  'side height',            0.10, 0.50, 0.01, onM],
  ['placement', [
    ['fltZ',     'step fore / aft (from the rule)', -1.5, 1.5, 0.01, onM],
    ['fltDrop',  'keel below the belly',  0.20, 1.50, 0.01, onM],
    ['fltTrack', 'half track',            0.40, 1.60, 0.01, onM],
  ], on],
  ['struts', [
    ['fltStrutR',  'strut radius',        0.008, 0.040, 0.001, onM],
    ['fltStrutAng','strut root angle °',  20, 85, 1, on],
    ['fltSpread',  'spreader bars',       0, 1, 1, on],
    ['fltWires',   'cross wires',         0, 1, 1, on],
  ], on],
]];
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// the hull's parameters as 32_hydro reads them, from the rows
function hullParams(P) {
  const L = +P.fltL, xs = +P.fltStep * L;
  return { L, xs, B: +P.fltB, beta: +P.fltBeta, betaA: +P.fltBetaA, hs: +P.fltHs,
           aftAngle: +P.fltAft, xFlat: +P.fltFlat * xs, yBow: +P.fltBow,
           bBow: +P.fltBowB * +P.fltB, bStern: +P.fltStern, hSide: +P.fltSide, nSta: 24 };
}

// ---- the build ------------------------------------------------------------
let group = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};
// model (x aft, y up, z right) -> cage (+x port, +y up, +z forward)
const toCage = (m, at) => [-m[2] + at[0], m[1] + at[1], -m[0] + at[2]];

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  window.CAGE_FLOAT = null;
  if (!+P.gearFloats) return;
  const HY = window.HYDRO_GEN || window.HYDRO;
  if (!HY || !HY.makeFloat) { if (stat) stat.textContent += '  ·  floats: 32_hydro not loaded'; return; }
  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const AF = GG.cageAirframe(mesh, FS);
  if (!AF) { if (stat) stat.textContent += '  ·  floats: no skin to hang on'; return; }

  const HP = hullParams(P);
  const F = HY.makeFloat(Object.assign({}, HP, { mFloat: 40, mLoad: 0, cgLoad: [0, 0, 0], loadI: [0, 0, 0] }));
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
  const strutM = () => (SM && SM('gearLeg', { surf: 0, fieldM: 1, tint0: 0x98a2ad }))
    || GG.gearMat('steel');
  const wireM = () => GG.gearMat('dark');

  const rec = { P: HP, zStep: zc, keelY, track, tetraC: {}, members: [], deck: {}, vol: F.volDeck, cgZ, cgY, cgFrom: (DAT && CGM) ? 'flown' : 'page' };
  const exG = Math.max(0, P.explodeD || 0) * FS;
  for (const sd of [-1, 1]) {                     // -1 starboard (cage -x), +1 port
    const at = [sd * track, keelY, zc];
    const bag = GG.Bag();
    const vid = F.V.map(v => bag.v(toCage(v, at)));
    for (const pn of F.panels) bag.tri(vid[pn.v[0]], vid[pn.v[1]], vid[pn.v[2]]);
    const ug = new THREE.Group();
    ug.name = 'edFloat' + (sd > 0 ? 'L' : 'R');
    const m = bag.mesh(ug, hullM());
    if (m && exG > 0) m.position.x += sd * exG;   // explode: outboard (display only)
    group.add(ug);
    // the tetra the physics rides (32_hydro tetraCtx): step keel, bow keel,
    // step deck edges — the frame's own four nodes, in cage metres
    const sK = F.sta[F.nF], sB = F.sta[0];
    const K = F.V[sK.K], KB = F.V[sB.K], DL = F.V[sK.Dm], DR = F.V[sK.Dp];
    rec.tetraC[sd > 0 ? 'L' : 'R'] = [K, KB, DL, DR].map(v => toCage(v, at));
    // the deck edges at the strut stations: the flat's end and the step
    const iF = Math.max(1, Math.round(F.nF * (1 - HP.xFlat / HP.xs)));   // the station where the flat begins
    const sFwd = F.sta[Math.min(F.nF - 1, iF)], sAft = F.sta[F.nF + Math.max(1, Math.round(F.nA * 0.35))];
    rec.deck[sd > 0 ? 'L' : 'R'] = {
      fwdIn: toCage(F.V[sd > 0 ? sFwd.Dp : sFwd.Dm], at), fwdOut: toCage(F.V[sd > 0 ? sFwd.Dm : sFwd.Dp], at),
      aftIn: toCage(F.V[sd > 0 ? sAft.Dp : sAft.Dm], at), aftOut: toCage(F.V[sd > 0 ? sAft.Dm : sAft.Dp], at),
    };
  }
  // the struts: deck edge -> the fuselage flank at the root angle, on the
  // float's side. Members published for the join; drawn as tubes.
  const ang = +P.fltStrutAng * D2R;
  const sg = GG.Bag(), wg = GG.Bag();
  const r = +P.fltStrutR;
  const root = (z, sd) => { const q = AF.surf(z, sd * ang); return [q[0], q[1], q[2]]; };
  const member = (pin, tip, bag, rr) => { GK.tube(bag, pin, tip, rr, 10); rec.members.push({ pin, tip }); };
  for (const sd of [-1, 1]) {
    const d = rec.deck[sd > 0 ? 'L' : 'R'];
    const rF = root(d.fwdIn[2], sd), rA = root(d.aftIn[2], sd);
    member(rF, d.fwdIn, sg, r); member(rF, d.fwdOut, sg, r);
    member(rA, d.aftIn, sg, r); member(rA, d.aftOut, sg, r);
  }
  if (+P.fltSpread) {
    const L = rec.deck.L, R = rec.deck.R;
    member(L.fwdIn, R.fwdIn, sg, r); member(L.aftIn, R.aftIn, sg, r);
    if (+P.fltWires) {
      GK.tube(wg, L.fwdIn, R.aftIn, 0.003, 6); GK.tube(wg, R.fwdIn, L.aftIn, 0.003, 6);
      rec.members.push({ pin: L.fwdIn, tip: R.aftIn }, { pin: R.fwdIn, tip: L.aftIn });
    }
  }
  const sgp = new THREE.Group(); sgp.name = 'edFloatStruts';
  sg.mesh(sgp, strutM()); wg.mesh(sgp, wireM());
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
  if (stat) stat.textContent += `  ·  floats: ${HP.L.toFixed(2)} x ${HP.B.toFixed(2)} m, step z ${zc.toFixed(2)}, keel ${keelY.toFixed(2)}, pair displaces ${(2 * F.volDeck * 1000).toFixed(0)} kg`;
};
})();
