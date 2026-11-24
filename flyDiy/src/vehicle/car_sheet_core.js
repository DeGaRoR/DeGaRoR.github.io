// ============================================================
// THE CAR SHEET'S CORE (CAR, 13 Nov; the user's must-land list: "put the car in the garage, roll out, pick a destination,
// drive there"): the measurement tools/car_sheet.js made in node, here for the PAGE too - the garage's drawing (the gear
// layer's four contacts and its airframe, the drawn meshes, the join's ledger) as the vehicle shell's sheet and its tune,
// and (page only) the drive rig made of the car's OWN meshes. node: require()'d by tools/car_sheet.js; the page: lazy
// (tools/build.js MANIFEST.lazy, with src/vehicle/), window.CAR_SHEET. Pure but for THREE and the page's globals.
// ============================================================
(function () {
'use strict';
// what a car does not carry of an aeroplane's ledger, and the car's own lumps the garage has no row for (GAPS)
const NOT_A_CAR = ['wings', 'bracing', 'tail'];
const CHASSIS = { kg: 120, note: 'GAP: a ladder frame, two beam axles, the steering box and the differential - ' +
                  'no garage row (a 1930s light car\'s, ~110-140 kg); placed at the wheelbase\'s middle, axle height' };
const DRIVELINE = { eta: 0.85, note: 'a manual gearbox and a live rear axle: ~85 % of the crank power at the wheels' };
// THE CAR'S OWN ROWS (CAR-3): what the drawing cannot say, carried by the build in spec.meta.car (absent = CAR-1's
// rear-drive light car): drive '4wd' (a transfer case: all four wheels driven, ~80 % at the wheels), chassisKg (a
// utility's ladder frame, two live axles and the transfer case weigh ~250-300 kg, not a 1930s roadster's 120)
const DRIVELINE_4WD = { eta: 0.80, note: 'a manual gearbox, a transfer case and two live axles: ~80 % of the crank power at the wheels' };
// (12 Nov: the garage's Car part - isCar, carDrive 0 rear / 1 all four, carChassisKg - over the older spec.meta.car)
const carRows = spec => {
  const r = Object.assign({ drive: 'rwd', chassisKg: CHASSIS.kg }, (spec && spec.meta && spec.meta.car) || {});
  const c = (spec && spec.cage) || {};
  if (c.carDrive != null) r.drive = +c.carDrive === 1 ? '4wd' : 'rwd';
  if (+c.carChassisKg > 0) r.chassisKg = +c.carChassisKg;
  return r;
};

function sheetFromBake(bj, C, opts) {
  opts = opts || {};
  const W = bj.W, G = W.CAGE_GEAR;
  if (!G || !G.contacts || G.contacts.length !== 4) throw new Error('car_sheet: the drawing has ' +
    (G && G.contacts ? G.contacts.length : 0) + ' wheel contacts, a car needs 4 (the mains + the third station as a pair: s2X > 0)');
  const spec = bj.spec, CR = carRows(spec), chKg = CR.chassisKg, awd = CR.drive === '4wd';
  // ---- THE WHEELS: front = the two most forward contacts ----
  const cs = G.contacts.slice().sort((a, b) => b.p[2] - a.p[2]);
  const front = cs.slice(0, 2), rear = cs.slice(2);
  const ground = Math.min(...cs.map(c => c.p[1] - c.R));
  const wheel = (c, steered) => ({ centre: [+c.p[2].toFixed(4), +(c.p[1] - ground).toFixed(4), +c.p[0].toFixed(4)],
                                    radius: +c.R.toFixed(4), width: +(0.32 * c.R).toFixed(4),
                                    side: c.p[0] > 0 ? 'right' : 'left', steered });
  const byX = a => a.slice().sort((p, q) => p.p[0] - q.p[0]);
  const [FL, FR] = byX(front), [RL, RR] = byX(rear);
  const wheels = { FL: wheel(FL, true), FR: wheel(FR, true), RL: wheel(RL, false), RR: wheel(RR, false) };
  const zRear = (RL.p[2] + RR.p[2]) / 2, zFront = (FL.p[2] + FR.p[2]) / 2;
  // ---- THE BODY: the airframe's stations and sections, and every drawn layer ----
  const AF = G.AF, THREE = W.THREE;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const grow = (x, y, z) => { lo[0] = Math.min(lo[0], z); hi[0] = Math.max(hi[0], z); lo[1] = Math.min(lo[1], y - ground);
    hi[1] = Math.max(hi[1], y - ground); lo[2] = Math.min(lo[2], x); hi[2] = Math.max(hi[2], x); };
  if (AF && AF.surf) for (let k = 0; k <= 40; k++) {
    const z = AF.z0 + (AF.z1 - AF.z0) * k / 40;
    for (let a = 0; a < 24; a++) { const q = AF.surf(z, a * Math.PI / 12); if (q && isFinite(q[0]) && isFinite(q[1])) { grow(q[0], q[1], z); grow(-q[0], q[1], z); } }
  }
  const box = new THREE.Box3();
  // (the page: bj.root, the craft root - the boxes in ITS frame, the contacts' and the airframe's; node: the bake's scene)
  const inv = bj.root ? (bj.root.updateMatrixWorld(true), new THREE.Matrix4().copy(bj.root.matrixWorld).invert()) : null;
  bj.scene.traverse(o => { if (!o.isMesh || !o.geometry) return;
    if (inv) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); }
    else box.setFromObject(o);
    if (!isFinite(box.min.x)) return;
    // the wheels and their legs are the wheels' (cylinders, not the body proxy): only what is inside the track
    if (Math.max(Math.abs(box.min.x), Math.abs(box.max.x)) > Math.abs(FR.p[0]) - 0.5 * FR.R * 0.32) return;
    grow(box.min.x, box.min.y, box.min.z); grow(box.max.x, box.max.y, box.max.z); });
  // ---- THE MASS: the ledger less the aeroplane, plus the chassis ----
  const def = C.buildGen(spec), L = def.parts.ledger || {};
  let m = 0, mx = 0;
  const items = [];
  for (const k in L) { if (NOT_A_CAR.includes(k) || !(L[k].mass > 0)) continue;
    m += L[k].mass; mx += L[k].mx || 0; items.push([k, +L[k].mass.toFixed(1)]); }
  const g = spec.gear || {};
  if (!(typeof g.x === 'number')) throw new Error('car_sheet: the join measured no mains station (gear.x)');
  // the ledger's datum on the drawing: the MAINS' station + gear.x (the join's mains aft of it) - CAR-4: the mains are
  // the first station drawn (s1), not always the rear axle (a UTV's mains are its FRONT pair, the boom wheels its rear;
  // the rear axle's station put the UTV's CG on its rear axle)
  const mains = G.contacts.filter(c => c.st && c.st === G.contacts[0].st);
  const zMains = mains.length === 2 ? (mains[0].p[2] + mains[1].p[2]) / 2 : zRear;
  const zFw = zMains + g.x;
  const xLedger = mx / m;                           // the ledger's CG, aft of the firewall
  const zCh = (zRear + zFront) / 2;
  const mTot = m + chKg;
  const zCg = ((zFw - xLedger) * m + zCh * chKg) / mTot;
  // the CG's height: the body's (no ledger row carries it) - 40 % of the drawn body's height over the ground, the
  // chassis at the axles' height; an ESTIMATE, as the conquer's is
  const rAx = (FL.p[1] + RL.p[1]) / 2 - ground;
  const yCg = (0.40 * hi[1] * m + rAx * chKg) / mTot;
  // a uniform box of the body's size (car_prep.py's rule)
  const Lx = hi[0] - lo[0], Ly = hi[1] - Math.max(0, lo[1]), Lz = hi[2] - lo[2];
  const I = [mTot * (Ly * Ly + Lz * Lz) / 12, mTot * (Lx * Lx + Lz * Lz) / 12, mTot * (Lx * Lx + Ly * Ly) / 12];
  // ---- THE ENGINE ----
  const E = (spec.engines && spec.engines[0]) || {};
  const PP = (C.POWERPLANTS || {})[E.type] || {};
  // a CUSTOM engine flies its own resolved facts (the join's engines[].custom, 60_gen_spec G134), a catalogue one its row
  const CU = E.custom && E.custom.powerW > 0 ? E.custom : null;
  const powerW = CU ? CU.powerW : (PP.engine && PP.engine.powerW) || 0;
  const engName = CU ? CU.name : PP.engine ? PP.engine.name : null;
  const sheet = {
    car: opts.key || 'garage', authored: 'MEASURED off the garage drawing by tools/car_sheet.js (CAR-1); the mass, the CG ' +
      'height and the inertia are ESTIMATES (the ledger less the wings and tail, plus a chassis; 40 % of the body height; a uniform box)',
    frame: '+x forward, y up, +z right; metres; x = the garage z, z = the garage x, y over the ground under the tyres',
    wheels, wheelbase: +(zFront - zRear).toFixed(4),
    track: { front: +(FR.p[0] - FL.p[0]).toFixed(4), rear: +(RR.p[0] - RL.p[0]).toFixed(4) },
    ground: 0,
    // the tow hitch (CAR-3): the drawn ball's centre (_cage_gear.js bumperBuild, window.CAGE_GEAR_HITCH), else none
    // (the vehicle shell then takes the rear bumper's centre)
    hitch: (W.CAGE_GEAR_HITCH ? [+W.CAGE_GEAR_HITCH[2].toFixed(4), +(W.CAGE_GEAR_HITCH[1] - ground).toFixed(4), +W.CAGE_GEAR_HITCH[0].toFixed(4)] : undefined),
    box: { lo: lo.map(v => +v.toFixed(3)), hi: hi.map(v => +v.toFixed(3)) },
    collision: { boxes: [{ name: 'body', lo: [lo[0], Math.max(lo[1], 0.12), lo[2]].map(v => +v.toFixed(3)),
                                         hi: hi.map(v => +v.toFixed(3)) }] },
    estimates: { mass_kg: +mTot.toFixed(1), cg: [+zCg.toFixed(4), +yCg.toFixed(4), 0], inertia_kgm2: I.map(v => +v.toFixed(1)),
                 ledger: items, chassis: Object.assign({}, CHASSIS, { kg: chKg }), firewall_z: +zFw.toFixed(4) },
    engine: { type: CU ? 'custom' : (E.type || null), name: engName, powerW, mass: CU ? CU.mass : (PP.engine && PP.engine.mass), driveline: awd ? DRIVELINE_4WD : DRIVELINE },
    drive: awd ? '4wd' : 'rwd',
  };
  return sheet;
}

// THE TUNE: the powertrain from the engine row, the rest a 1930s light car's (drums, beam axles on leaf springs,
// cross-ply tyres), scaled to the mass - authored, as the conquer's is (vehicle.js VEH_TUNES)
function tuneFor(sheet) {
  const m = sheet.estimates.mass_kg, gW = m * 9.81, P = sheet.engine.powerW * sheet.engine.driveline.eta;
  return {
    drive: { wheels: sheet.drive === '4wd' ? ['FL', 'FR', 'RL', 'RR'] : ['RL', 'RR'], P: Math.round(P), F0: Math.round(0.75 * gW), Frev: Math.round(0.45 * gW), vRev: 6.0,
             engBrake: Math.round(0.03 * gW), tc: 0.85 },
    brake: { F: Math.round(0.80 * gW), front: 0.60, abs: 0.80, hand: ['RL', 'RR'], handF: Math.round(0.25 * gW) },
    steer: { wheels: ['FL', 'FR'], innerDeg: 36, ackermann: 1.0, rate: 0.9 },
    susp: { bump: 0.07, droop: 0.09, hz: [1.6, 1.8], zeta: 0.35, kStop: 150e3 },
    tyre: { Ca: 9.0, u0: 1.5 },
    // open wheels, an open cockpit and a boat tail: Cd ~0.6 on ~1.3 m2
    aero: { CdA: 0.8 },
  };
}


// THE RIG OF THE CAR'S OWN MESHES (page only): the garage's drawing re-framed into the sheet's (x forward = the garage z,
// y up from the ground under the tyres, z right) by a ROTATION (not car_sheet's axis swap, a mirror: the rig would draw
// inside out) - so a physics wheel at sheet z takes the mesh of the garage wheel at x = -z (a car is symmetric: the
// shell's left and right are the drawing's right and left, nothing it computes differs). The body: every visible mesh
// under the craft root that is not a wheel unit (edWheel*) nor the prop (edProp / edSpinner); each wheel its unit's
// meshes about its own hub (the contact's centre). Meshes are CLONES (their geometry and materials shared with the
// garage's drawing, which outlives the drive). Returns { g, wheels[4] in the def's order, lamps: {} } - drive_mode.js's.
function carRigFromGarage(THREE, root, sheet, def, ground, contacts) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const visible = o => { for (let a = o; a && a !== root; a = a.parent) if (!a.visible) return false; return true; };
  const unitOf = o => { for (let a = o; a && a !== root; a = a.parent) { const n = a.name || '';
    if (n.lastIndexOf('edWheel', 0) === 0) return { wheel: a }; if (n.lastIndexOf('edProp', 0) === 0 || n.lastIndexOf('edSpinner', 0) === 0) return { prop: a }; } return null; };
  const clone = (o, M) => { const m = new THREE.Mesh(o.geometry, o.material); m.matrixAutoUpdate = false; m.matrix.copy(M); m.castShadow = o.castShadow; m.receiveShadow = o.receiveShadow; return m; };
  const body = new THREE.Group(); body.rotation.y = Math.PI / 2; body.position.y = -ground; body.updateMatrix();
  const units = new Map();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || !visible(o)) return;
    const u = unitOf(o), M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (u && u.prop) return;
    if (u && u.wheel) { if (!units.has(u.wheel)) units.set(u.wheel, []); units.get(u.wheel).push([o, M]); return; }
    body.add(clone(o, M));
  });
  const g = new THREE.Group(); g.name = 'drive:garageCar'; g.matrixAutoUpdate = false; g.add(body);
  // the wheel units by their hub: the nearest contact (garage frame) to each unit's box centre
  const B = new THREE.Box3(), V = new THREE.Vector3(), hubs = [];
  for (const [u, list] of units) {
    B.makeEmpty(); for (const [o, M] of list) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); B.union(o.geometry.boundingBox.clone().applyMatrix4(M)); }
    B.getCenter(V);
    let best = null, bd = Infinity; for (const c of contacts) { const d = Math.hypot(c.p[0] - V.x, c.p[1] - V.y, c.p[2] - V.z); if (d < bd) { bd = d; best = c; } }
    if (best) hubs.push({ c: best, list });
  }
  const wheels = def.wheels.map(w => {
    // the physics wheel at sheet (x, z) shows the garage unit at (x_g, z_g) = (-z, x)
    let best = null, bd = Infinity;
    for (const h of hubs) { const d = Math.hypot(h.c.p[0] + w.at[2], h.c.p[2] - w.at[0]); if (d < bd) { bd = d; best = h; } }
    const o = new THREE.Group(); o.rotation.order = 'YXZ';
    if (best) { const inner = new THREE.Group(); inner.rotation.y = Math.PI / 2; inner.updateMatrix();
      const T = new THREE.Matrix4().makeTranslation(-best.c.p[0], -best.c.p[1], -best.c.p[2]);
      for (const [m0, M] of best.list) inner.add(clone(m0, new THREE.Matrix4().multiplyMatrices(T, M)));
      o.add(inner); }
    g.add(o); return o;
  });
  return { g, wheels, lamps: {}, M: new THREE.Matrix4(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };
}
// THE PAGE'S DOOR: the build on the garage's stand as a drive-mode vehicle - { name, sheet, tune, buildRig(THREE, def) }
// (drive_mode.js DM.vehicleSource). Throws, with the reason, when the drawing is not a car a shell can drive.
function carFromGarage(W) {
  W = W || window;
  const root = W.CAGE_JOIN && W.CAGE_JOIN.mount && W.CAGE_JOIN.mount();
  if (!root) throw new Error('no craft on the garage stand');
  const spec = W.GARAGE_SPEC && W.GARAGE_SPEC.get ? W.GARAGE_SPEC.get() : null;
  if (!spec) throw new Error('no build in the garage');
  const C = { buildGen: W.buildGen || (typeof buildGen === 'function' ? buildGen : null), POWERPLANTS: W.POWERPLANTS || (typeof POWERPLANTS !== 'undefined' ? POWERPLANTS : {}) };
  if (!C.buildGen) throw new Error('the join (buildGen) is not loaded');
  const sheet = sheetFromBake({ W, scene: root, spec, root }, C, { key: (spec.meta && spec.meta.name) || 'garage' });
  const tune = tuneFor(sheet);
  const G = W.CAGE_GEAR, ground = Math.min(...G.contacts.map(c => c.p[1] - c.R));
  return { name: (spec.meta && spec.meta.name) || 'the car', sheet, tune,
           buildRig: (THREE, def) => carRigFromGarage(THREE, root, sheet, def, ground, G.contacts) };
}
const CAR_SHEET_API = { sheetFromBake, tuneFor, carRows, carRigFromGarage, carFromGarage, NOT_A_CAR, CHASSIS, DRIVELINE, DRIVELINE_4WD };
if (typeof module !== 'undefined' && module.exports) module.exports = CAR_SHEET_API;
if (typeof window !== 'undefined') window.CAR_SHEET = CAR_SHEET_API;
})();
