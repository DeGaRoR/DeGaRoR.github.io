// _winch_gen.js - THE GLIDER LAUNCH WINCH (2026-11-13, the user: "why wouldn't you plan for the winch, and why wouldn't
// we do a 3D model for that? ... a very specialized piece of equipment"). A procedural prop in the tower's grammar
// (tools/_tower_gen.js): DEF, ROWS, PRESETS, and one build(P) that returns a THREE.Group, every part a dial.
//
// WHAT A WINCH IS (the club twin-drum trailer winch - Skylaunch, Tost, ESCHA and the club-built ones all share it):
//
//   THE TRAILER   a tandem-axle chassis with an A-frame drawbar, its jockey wheel and the hitch eye; the deck is
//                 chequer plate. The winch is towed to the far end of the field and parked facing the launch point.
//   THE ENGINE    forward over the drawbar, in a louvred housing with the radiator grille at the front and the
//                 exhaust stack up the side (a big petrol V8 or a diesel; an electric winch keeps the box for its
//                 batteries and motor). A propshaft runs aft through a gearbox to the drum shaft.
//   THE DRUMS     one or two NARROW drums on a transverse shaft over the rear axle line, each with its disc brake:
//                 narrow and large so the cable winds in a deep stack (a typical narrow drum is ~800 mm across the
//                 core, rec.aviation.soaring). Each drum has a LEVELWIND carriage behind it that lays the cable.
//   THE FAIRLEADS at the rear edge, one per cable: a box of four rollers the cable runs through, with the
//                 GUILLOTINE on it (the red box) - the winch driver's emergency cut when a glider cannot release.
//   THE CAGE      the mesh guard over the drums and the cable run (a parting cable whips), with the driver's CAB
//                 between the engine and the drums looking AFT down the cable at the launch point through a
//                 grilled window, the amber beacon on its roof (lit while a launch is on) and the radio whip.
//   THE CABLE     out on the grass toward the launch point (shown as a stub of `cableLen` m): steel or synthetic,
//                 up to ~10 mm (the Italian AF's Skylaunch Evolution spec); at its glider end the DROGUE PARACHUTE
//                 that slows the falling cable after release, the STROP, the WEAK LINK (~1.33 x the glider's gross
//                 weight where the manual gives none, NZGA AC3-04) and the two RINGS that go on the glider's hook.
//
// FRAME (the house frame, as every placed prop): metres, y up, the trailer's LENGTH along z with the drawbar at +z
// (the end that points away from the launch point), the cable leaving at -z; the origin on the ground under the
// middle of the deck. Overall dimensions are estimates for a twin-drum trailer winch (no manufacturer sheet was
// reachable): deck 5.6 x 2.3 m at 1.0 m (over the van's 0.9 m wheels), 7.2 m with the drawbar, the cab roof at ~3.0 m,
// ~3.5 t.
//
// Browser: window.WINCH_GEN. Node: module.exports (needs a THREE: global.THREE or require('../vendor/three.min.js')).
'use strict';
(function (root) {
const THREE_ = () => root.THREE || (typeof THREE !== 'undefined' ? THREE : null);

// the dials: [key, label, min, max, step, options?] - the tower's ROWS shape
const DEF = {
  drums: 2,          // 1 | 2 cables
  cab: 1,            // the driver's cab (0: an open seat under the cage roof)
  cage: 1,           // the mesh guard over the drums
  beacon: 1,         // the amber beacon on the cab roof
  power: 0,          // 0 V8 (exhaust stack), 1 diesel (bigger stack, no bonnet scoop), 2 electric (no stack, cable reel)
  cableLen: 30,      // m of cable drawn out toward the launch point (0: wound in)
  chute: 1,          // the drogue parachute, strop, weak link and rings at the cable's end
  paint: 0,          // index into PAINTS
  wear: 0.2,         // 0 new .. 1 tired (darkens and dulls the paint)
};
const POWERS = ['V8 petrol', 'diesel', 'electric'];
const PAINTS = [
  { name: 'club yellow', body: 0xe8b51e, trim: 0x2b2b2b },
  { name: 'works green', body: 0x2f6b3a, trim: 0xd9d4c3 },
  { name: 'faded red', body: 0xa83a2c, trim: 0xe0dccd },
  { name: 'white', body: 0xe9e9e4, trim: 0x2f4f7f },
];
const ROWS = [
  ['drums', 'drums', 1, 2, 1], ['cab', 'cab', 0, 1, 1], ['cage', 'cage', 0, 1, 1], ['beacon', 'beacon', 0, 1, 1],
  ['power', 'power', 0, 2, 1, POWERS], ['cableLen', 'cable out (m)', 0, 60, 1], ['chute', 'parachute end', 0, 1, 1],
  ['paint', 'paint', 0, PAINTS.length - 1, 1, PAINTS.map(p => p.name)], ['wear', 'wear', 0, 1, 0.05],
];
const PRESETS = {
  'club twin-drum': {},
  'single-drum': { drums: 1, paint: 1, power: 1 },
  'electric': { power: 2, paint: 3, wear: 0 },
  'old club winch': { paint: 2, wear: 0.8, cab: 1 },
};

// THE DIMENSIONS (m) - one place, so a placer, a gate and the physics read the same numbers
// THE VAN'S WHEEL (the CAR session's Field Wagon, builds/vehicles/utility_2026-11.json spec.cage wh*): the slim carcass
// (TYRE 2) widened 1.4 x, the rim at half the wheel's diameter, a pressed disc with six bolts, the cap and the valve
const VAN_WHEEL = { whProfile: 2, whTread: 0, whRibs: 3, whRim: 4, whBolts: 6, whCap: 1, whValve: 1, whBrake: 0, whSlick: 0,
                    whBulge: 1, whWide: 1.4, whRimD: 0.5 };
const DIM = {
  deckY: 1.00, deckT: 0.05, deckW: 2.30, deckZ0: -2.90, deckZ1: 2.70, railX: 0.60,
  wheelR: 0.45, wheelW: 0.21, wheelX: 0.95, axleZ: [-0.80, 0.22],
  drawZ: 4.20, hitchY: 0.52,
  engZ0: 1.10, engZ1: 2.62, engW: 1.40, engH: 1.25,
  drumZ: -1.55, drumHub: 0.62, drumCoreR: 0.40, drumFlangeR: 0.58, drumW: 0.32, drumX2: 0.47,
  lwZ: -2.30, fairZ: -2.80,
  cabZ0: -0.70, cabZ1: 0.95, cabX0: -1.15, cabX1: 0.15, cabH: 1.95,
  cageZ0: -2.90, cageZ1: -0.70, cageH: 1.55,
  massKg: 3500,
};

function build(P0) {
  const T = THREE_();
  const P = Object.assign({}, DEF, P0 || {});
  const paint = PAINTS[Math.max(0, Math.min(PAINTS.length - 1, Math.round(P.paint)))];
  const wear = P.wx ? 0 : Math.max(0, Math.min(1, +P.wear || 0));   // the weathering (_winch_weather.js) ages it when on
  const dull = c => { const col = new T.Color(c); const g = (col.r + col.g + col.b) / 3; col.lerp(new T.Color(g, g, g), 0.25 * wear).multiplyScalar(1 - 0.22 * wear); return col; };
  // THE MATERIALS ARE THE GAME'S (A0, 13 Nov: "PBR materials, reusing the game's existing ones"): every one a PBR
  // MeshStandardMaterial made by MATLIB (src/viewer/matlib.js, the one place a material is made - GATE ASSETS), in the
  // `winch` scope so the weathering's hook (tools/_winch_weather.js) can never reach a building's or an aeroplane's
  // shared material; the surfaces are the house library's scans and the aeroplanes' weathering (the weather module)
  const ML = root.MATLIB || (typeof MATLIB !== 'undefined' ? MATLIB : null);
  if (!ML) throw new Error('_winch_gen: load src/viewer/matlib.js first (MATLIB makes the winch\'s materials)');
  const std = (c, o) => { const q = Object.assign({ color: new T.Color(c), roughness: 0.75, metalness: 0 }, o || {});
    return ML.shared(T, q.transparent ? 'glass' : 'std', q, 'winch'); };
  const MAT = {
    body: std(dull(paint.body), { roughness: 0.55 + 0.3 * wear }),
    trim: std(dull(paint.trim), { roughness: 0.6 }),
    steel: std(0x3a3d40, { roughness: 0.6, metalness: 0.5 }),
    bright: std(0xa9adb1, { roughness: 0.35, metalness: 0.8 }),
    deck: std(0x6e7275, { roughness: 0.5, metalness: 0.6 }),
    rubber: std(0x161616, { roughness: 0.9 }),
    rim: std(0xb8b8b0, { roughness: 0.4, metalness: 0.6 }),
    cable: std(0x2a2a2a, { roughness: 0.5, metalness: 0.4 }),
    red: std(0xc0201a, { roughness: 0.5 }),
    glass: std(0x6f8fa6, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45 }),
    grille: std(0x111111, { roughness: 0.8 }),
    amber: std(0xffa400, { emissive: 0xff8a00, emissiveIntensity: 0.6, roughness: 0.3 }),
    chute: std(0xff5a1f, { roughness: 0.85, side: T.DoubleSide }),
    lamp: std(0xd01010, { emissive: 0x400000, roughness: 0.3 }),
  };
  for (const k in MAT) MAT[k].userData.wxRole = k;   // the weathering's substrate, by the bag the part was made in
  MAT.mesh = MAT.trim;   // the cage's welded mesh: painted steel bars (PBR, weathered), never unlit lines (an alias, after the roles)
  const G = new T.Group(); G.name = 'winch';
  const parts = {};
  const part = n => parts[n] || (parts[n] = Object.assign(new T.Group(), { name: n }), G.add(parts[n]), parts[n]);
  const Y = DIM.deckY, D = DIM;

  // ---- primitives ----
  // aBox (the weathering's edge read): xyz the part's half extents in its own frame, w the kind (2 box, 3 cylinder along
  // its own y; an attribute a geometry does not carry reads (0,0,0,1): no edges)
  function tagBox(g, hx, hy, hz, kind) {
    const n = g.attributes.position.count, a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { a[i * 4] = hx; a[i * 4 + 1] = hy; a[i * 4 + 2] = hz; a[i * 4 + 3] = kind; }
    g.setAttribute('aBox', new T.BufferAttribute(a, 4)); return g;
  }
  function box(grp, mat, x0, y0, z0, x1, y1, z1) {
    const W = Math.abs(x1 - x0), H = Math.abs(y1 - y0), L = Math.abs(z1 - z0);
    const m = new T.Mesh(tagBox(new T.BoxGeometry(W, H, L), W / 2, H / 2, L / 2, 2), MAT[mat]);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); part(grp).add(m); return m;
  }
  function cyl(grp, mat, x, y, z, r, len, axis, seg, r2) {   // axis 'x' | 'y' | 'z'
    const m = new T.Mesh(tagBox(new T.CylinderGeometry(r2 == null ? r : r2, r, len, seg || 24), Math.max(r, r2 || 0), len / 2, Math.max(r, r2 || 0), r2 == null ? 3 : 1), MAT[mat]);
    if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z); part(grp).add(m); return m;
  }
  function tube(grp, mat, a, b, r, seg) {                    // a cylinder from point a to point b
    const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const m = new T.Mesh(tagBox(new T.CylinderGeometry(r, r, L, seg || 10), r, L / 2, r, 3), MAT[mat]);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); part(grp).add(m); return m;
  }
  function torus(grp, mat, x, y, z, R, r, rotX, rotY) {
    const m = new T.Mesh(new T.TorusGeometry(R, r, 10, 28), MAT[mat]);
    m.position.set(x, y, z); m.rotation.x = rotX || 0; m.rotation.y = rotY || 0; part(grp).add(m); return m;
  }
  // a welded mesh panel (corner + s*u + t*v): its wires as thin square bars, one merged geometry - PBR steel that takes
  // the light, the shadows and the weathering like every other part
  function meshPanel(grp, corner, u, v, du, dv) {
    const pts = [], add = (p, q) => pts.push([p, q]);
    const at = (s, t) => [corner[0] + u[0] * s + v[0] * t, corner[1] + u[1] * s + v[1] * t, corner[2] + u[2] * s + v[2] * t];
    const nu = Math.max(1, Math.round(1 / du)), nv = Math.max(1, Math.round(1 / dv));
    for (let i = 0; i <= nu; i++) add(at(i / nu, 0), at(i / nu, 1));
    for (let j = 0; j <= nv; j++) add(at(0, j / nv), at(1, j / nv));
    const pos = [], nor = [], idx = [], r = 0.003;
    for (const [a, b] of pts) {
      const d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      const e1 = new T.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize(), e2 = new T.Vector3().crossVectors(d, e1);
      for (const [n, m] of [[e1, e2], [e2, e1.clone().negate()], [e1.clone().negate(), e2.clone().negate()], [e2.clone().negate(), e1]]) {
        const o = pos.length / 3;   // one face of the bar: its outward normal n, its width along m
        for (const [P, s] of [[a, -1], [a, 1], [b, 1], [b, -1]]) { pos.push(P[0] + (n.x + m.x * s) * r, P[1] + (n.y + m.y * s) * r, P[2] + (n.z + m.z * s) * r); nor.push(n.x, n.y, n.z); }
        idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    const L = new T.Mesh(g, MAT.mesh); part(grp).add(L); return L;
  }

  // ---- THE TRAILER ----
  const hw = D.deckW / 2;
  const RX = D.railX;
  for (const s of [-1, 1]) box('chassis', 'steel', s * RX - 0.05, Y - 0.26, D.deckZ0 + 0.05, s * RX + 0.05, Y - D.deckT, D.deckZ1 - 0.05);
  for (let z = D.deckZ0 + 0.15; z < D.deckZ1; z += 0.8) box('chassis', 'steel', -hw + 0.05, Y - 0.12, z - 0.04, hw - 0.05, Y - D.deckT, z + 0.04);
  box('chassis', 'deck', -hw, Y - D.deckT, D.deckZ0, hw, Y, D.deckZ1);
  for (const s of [-1, 1]) box('chassis', 'trim', s * hw - 0.03, Y - 0.16, D.deckZ0, s * hw + 0.03, Y + 0.02, D.deckZ1);   // the side rails
  // the drawbar: an A-frame to the hitch eye, the jockey wheel, the safety chains' post
  for (const s of [-1, 1]) tube('chassis', 'steel', [s * RX, Y - 0.15, D.deckZ1 - 0.1], [0, D.hitchY + 0.04, D.drawZ - 0.25], 0.055);
  box('chassis', 'steel', -0.08, D.hitchY - 0.04, D.drawZ - 0.45, 0.08, D.hitchY + 0.1, D.drawZ - 0.12);
  torus('chassis', 'steel', 0, D.hitchY + 0.03, D.drawZ - 0.05, 0.075, 0.022, Math.PI / 2);
  cyl('chassis', 'steel', 0.18, 0.55, D.drawZ - 0.75, 0.04, 0.75, 'y');
  cyl('chassis', 'rubber', 0.18, 0.11, D.drawZ - 0.75, 0.1, 0.07, 'x');
  cyl('chassis', 'trim', 0.18, 0.86, D.drawZ - 0.75, 0.025, 0.12, 'x');
  // the tandem axles and their four wheels (the deck overhangs them, no mudguards). THE VAN'S WHEELS (the user, 13 Nov:
  // "take the wheels from the cars sessions, get the ones from the van"): the CAR session's Field Wagon
  // (builds/vehicles/utility_2026-11.json), drawn by the garage's own wheel builder (tools/_gear_gen.js GEAR_GEN.wheel)
  // with the van's saved rows - VAN_WHEEL below, at its 0.45 m radius. Without the gear kit on the page, plain discs.
  const GG = root.GEAR_GEN, GK = root.GEAR_KIT, VAN = P.vanWheels !== 0 && GG && GK && GG.wheel && GK.Bag;
  const WMAT = { tyre: 'rubber', dark: 'rubber', hub: 'rim', alloy: 'rim', chrome: 'bright', brake: 'steel', brakefix: 'steel', fair: 'body', bronze: 'steel', steel: 'steel' };
  for (const az of D.axleZ) {
    box('chassis', 'steel', -D.wheelX, D.wheelR - 0.04, az - 0.04, D.wheelX, D.wheelR + 0.04, az + 0.04);
    for (const s of [-1, 1]) {
      if (VAN) {
        const bags = {}; for (const k in WMAT) bags[k] = GK.Bag();
        GG.wheel(bags, [s * D.wheelX, D.wheelR, az], [s, 0, 0], D.wheelR, { P: VAN_WHEEL });
        for (const k in WMAT) bags[k].mesh(part('wheels'), MAT[WMAT[k]]);
      } else {
        cyl('wheels', 'rubber', s * D.wheelX, D.wheelR, az, D.wheelR, D.wheelW, 'x', 28);
        cyl('wheels', 'rim', s * (D.wheelX + D.wheelW / 2 + 0.002), D.wheelR, az, D.wheelR * 0.6, 0.012, 'x', 20);
      }
    }
  }
  for (const s of [-1, 1]) {   // the leaf springs along each rail, over both axles, hung on their shackles
    box('chassis', 'steel', s * RX - 0.04, D.wheelR + 0.06, D.axleZ[0] - 0.45, s * RX + 0.04, D.wheelR + 0.12, D.axleZ[1] + 0.45);
    for (const z of [D.axleZ[0] - 0.45, D.axleZ[1] + 0.45, (D.axleZ[0] + D.axleZ[1]) / 2]) box('chassis', 'steel', s * RX - 0.03, D.wheelR + 0.1, z - 0.03, s * RX + 0.03, Y - 0.24, z + 0.03);
  }
  // rear lamp bar, lamps and the number plate under the fairleads; the stabiliser legs dropped at the four corners
  box('chassis', 'steel', -hw + 0.1, Y - 0.32, D.deckZ0 - 0.04, hw - 0.1, Y - 0.22, D.deckZ0 + 0.02);
  for (const s of [-1, 1]) box('chassis', 'lamp', s * (hw - 0.32), Y - 0.33, D.deckZ0 - 0.07, s * (hw - 0.12), Y - 0.21, D.deckZ0 - 0.03);
  box('chassis', 'rim', -0.26, Y - 0.34, D.deckZ0 - 0.06, 0.26, Y - 0.22, D.deckZ0 - 0.045);
  for (const z of [D.deckZ0 + 0.25, D.deckZ1 - 0.25]) for (const s of [-1, 1]) {
    cyl('chassis', 'steel', s * (hw - 0.12), (Y - 0.2) / 2, z, 0.04, Y - 0.2, 'y', 10);
    box('chassis', 'steel', s * (hw - 0.12) - 0.1, 0, z - 0.1, s * (hw - 0.12) + 0.1, 0.03, z + 0.1);
  }

  // ---- THE ENGINE HOUSING ----
  const ex = D.engW / 2, eY1 = Y + D.engH;
  box('engine', 'body', -ex, Y, D.engZ0, ex, eY1, D.engZ1 - 0.1);
  box('engine', 'body', -ex - 0.02, eY1 - 0.04, D.engZ0 - 0.02, ex + 0.02, eY1 + 0.02, D.engZ1 - 0.08);   // the lid's lip
  box('engine', 'grille', -ex + 0.1, Y + 0.12, D.engZ1 - 0.1, ex - 0.1, eY1 - 0.12, D.engZ1 - 0.06);
  for (let y = Y + 0.18; y < eY1 - 0.14; y += 0.07) box('engine', 'trim', -ex + 0.1, y, D.engZ1 - 0.065, ex - 0.1, y + 0.018, D.engZ1 - 0.04);
  for (const s of [-1, 1]) for (let z = D.engZ0 + 0.3; z < D.engZ1 - 0.3; z += 0.09)                     // side louvres
    box('engine', 'grille', s * ex - 0.012, Y + 0.7, z, s * ex + 0.012, Y + 1.05, z + 0.035);
  if (P.power === 0) box('engine', 'body', -0.3, eY1, D.engZ0 + 0.55, 0.3, eY1 + 0.12, D.engZ0 + 1.05);   // the V8's scoop
  if (P.power !== 2) {                                                                   // the exhaust stack + rain cap
    const sx = ex + 0.08, sz = D.engZ0 + 0.35, sr = P.power === 1 ? 0.07 : 0.055;
    tube('engine', 'steel', [ex - 0.05, Y + 0.5, sz], [sx, Y + 0.6, sz], sr);
    cyl('engine', 'steel', sx, (Y + 0.6 + eY1 + 0.55) / 2, sz, sr, eY1 + 0.55 - Y - 0.6, 'y', 14);
    const cap = cyl('engine', 'steel', sx, eY1 + 0.6, sz - 0.03, sr * 1.25, 0.02, 'y', 14); cap.rotation.x = -0.5;
  } else {
    cyl('engine', 'red', ex + 0.06, Y + 0.6, D.engZ0 + 0.5, 0.12, 0.18, 'x', 18);      // the charge socket's reel
  }
  // the fuel tank and the battery box beside the cab, the propshaft and gearbox down the middle
  cyl('engine', 'steel', 0.72, Y + 0.32, -0.1, 0.27, 0.95, 'z', 20);
  box('engine', 'trim', 0.42, Y, 0.55, 1.05, Y + 0.38, 0.95);
  box('drive', 'steel', -0.25, Y + 0.08, D.engZ0 - 0.55, 0.25, Y + 0.55, D.engZ0);                         // the gearbox
  cyl('drive', 'bright', 0, Y + 0.32, (D.engZ0 - 0.55 + D.drumZ) / 2, 0.045, D.engZ0 - 0.55 - D.drumZ, 'z', 12);

  // ---- THE DRUMS, their shaft, brakes and the levelwinds ----
  const hubY = Y + D.drumHub;
  const drumXs = P.drums >= 2 ? [-D.drumX2, D.drumX2] : [0];
  cyl('drums', 'bright', 0, hubY, D.drumZ, 0.055, 2.05, 'x', 16);
  for (const x of [-1.0, 1.0, 0]) {                                                       // the bearing pedestals
    box('drums', 'steel', x - 0.07, Y, D.drumZ - 0.16, x + 0.07, hubY - 0.04, D.drumZ + 0.16);
    box('drums', 'steel', x - 0.09, hubY - 0.09, D.drumZ - 0.11, x + 0.09, hubY + 0.09, D.drumZ + 0.11);
  }
  for (const x of drumXs) {
    const w = D.drumW, cableR = D.drumCoreR + (P.cableLen > 0 ? 0.09 : 0.13);   // the wound stack: deeper when it is all in
    cyl('drums', 'steel', x, hubY, D.drumZ, D.drumCoreR, w, 'x', 32);
    cyl('drums', 'cable', x, hubY, D.drumZ, cableR, w - 0.02, 'x', 32);
    for (const s of [-1, 1]) {
      cyl('drums', 'body', x + s * (w / 2 + 0.012), hubY, D.drumZ, D.drumFlangeR, 0.024, 'x', 40);
      for (let k = 0; k < 6; k++) {                                                     // the flange's stiffening spokes
        const a = k * Math.PI / 3, r0 = 0.08, r1 = D.drumFlangeR - 0.03;
        tube('drums', 'trim', [x + s * (w / 2 + 0.03), hubY + r0 * Math.sin(a), D.drumZ + r0 * Math.cos(a)],
                              [x + s * (w / 2 + 0.03), hubY + r1 * Math.sin(a), D.drumZ + r1 * Math.cos(a)], 0.014, 6);
      }
    }
    const bx = x + (x <= 0 ? -1 : 1) * (w / 2 + 0.09);                                  // the disc brake + caliper
    cyl('drums', 'bright', bx, hubY, D.drumZ, 0.24, 0.02, 'x', 28);
    box('drums', 'red', bx - 0.04, hubY + 0.12, D.drumZ - 0.27, bx + 0.04, hubY + 0.28, D.drumZ - 0.15);
    // the levelwind: two guide bars across, the carriage with its vertical and horizontal rollers at the cable
    const ly = Y + 0.42;
    for (const dy of [-0.06, 0.06]) cyl('levelwind', 'bright', x, ly + dy, D.lwZ, 0.022, w + 0.35, 'x', 10);
    box('levelwind', 'steel', x - 0.11, ly - 0.14, D.lwZ - 0.09, x + 0.11, ly + 0.14, D.lwZ + 0.09);
    for (const s of [-1, 1]) cyl('levelwind', 'bright', x + s * 0.035, ly, D.lwZ - 0.1, 0.022, 0.26, 'y', 10);
    for (const s of [-1, 1]) cyl('levelwind', 'bright', x, ly + s * 0.035, D.lwZ - 0.1, 0.022, 0.12, 'x', 10);
    // the cable from the drum's top to the levelwind and on to the fairlead, low over the deck
    tube('levelwind', 'cable', [x, hubY - cableR + 0.02, D.drumZ - 0.1], [x, ly, D.lwZ], 0.006, 6);
    // ---- THE FAIRLEAD AND THE GUILLOTINE ----
    const fy = Y + 0.36, fz = D.fairZ;
    box('fairlead', 'steel', x - 0.16, Y, fz - 0.08, x + 0.16, Y + 0.08, fz + 0.12);
    for (const s of [-1, 1]) box('fairlead', 'steel', x + s * 0.13 - 0.025, Y + 0.08, fz - 0.06, x + s * 0.13 + 0.025, fy + 0.2, fz + 0.06);
    for (const dy of [-0.05, 0.05]) cyl('fairlead', 'bright', x, fy + dy, fz, 0.03, 0.22, 'x', 12);
    for (const dx of [-0.05, 0.05]) cyl('fairlead', 'bright', x + dx, fy, fz, 0.03, 0.16, 'y', 12);
    box('fairlead', 'red', x - 0.17, fy + 0.2, fz - 0.1, x + 0.17, fy + 0.42, fz + 0.1);                // the guillotine
    box('fairlead', 'trim', x - 0.02, fy + 0.42, fz - 0.02, x + 0.02, fy + 0.6, fz + 0.02);             // its striker
    tube('fairlead', 'cable', [x, ly, D.lwZ], [x, fy, fz], 0.006, 6);
    // ---- THE CABLE OUT, AND ITS GLIDER END ----
    if (P.cableLen > 0) {
      const L = +P.cableLen, endZ = fz - L, gy = 0.03;
      tube('cable', 'cable', [x, fy, fz - 0.05], [x * 1.4, gy, fz - 3.0], 0.006, 6);
      tube('cable', 'cable', [x * 1.4, gy, fz - 3.0], [x * 1.6, gy, endZ], 0.006, 6);
      if (P.chute) {
        const cx = x * 1.6;
        // the drogue chute: a collapsed canopy lying on the grass, its rigging lines gathered to the swivel
        const cone = cyl('cable', 'chute', cx, 0.16, endZ - 1.15, 0.03, 1.5, 'z', 18, 0.32);
        cone.scale.set(1, 1, 0.55); cone.rotation.x = -Math.PI / 2;
        torus('cable', 'chute', cx, 0.16, endZ - 1.9, 0.3, 0.03, 0, 0).scale.set(1, 0.55, 1);
        cyl('cable', 'bright', cx, 0.05, endZ - 0.15, 0.03, 0.12, 'z', 10);              // the swivel
        tube('cable', 'chute', [cx, 0.05, endZ - 0.2], [cx, 0.14, endZ - 0.45], 0.012, 6);
        // the strop, the weak link and the rings (the end that goes on the glider's release hook)
        const s0 = endZ - 2.0, s1 = s0 - 3.0;
        tube('cable', 'cable', [cx, 0.03, s0], [cx, 0.03, s1], 0.008, 6);
        box('cable', 'body', cx - 0.03, 0.01, s1 - 0.12, cx + 0.03, 0.05, s1);          // the weak-link carrier
        torus('cable', 'bright', cx, 0.03, s1 - 0.2, 0.05, 0.009, Math.PI / 2);
        torus('cable', 'bright', cx, 0.03, s1 - 0.27, 0.035, 0.008, Math.PI / 2, Math.PI / 2);
      }
    }
  }

  // ---- THE CAGE over the drums ----
  if (P.cage) {
    const z0 = D.cageZ0, z1 = D.cageZ1, top = Y + D.cageH + 0.55, x0 = -hw + 0.04, x1 = hw - 0.04, r = 0.03;
    const cabSide = P.cab ? D.cabX1 : x0;
    for (const x of [x0, x1]) for (const z of [z0, z1, (z0 + z1) / 2]) tube('cage', 'trim', [x, Y, z], [x, top, z], r, 8);
    for (const x of [x0, x1]) tube('cage', 'trim', [x, top, z0], [x, top, z1], r, 8);
    for (const z of [z0, z1]) tube('cage', 'trim', [x0, top, z], [x1, top, z], r, 8);
    tube('cage', 'trim', [0, top, z0], [0, top, z1], r * 0.8, 8);
    for (const s of [-1, 1]) meshPanel('cage', [s < 0 ? x0 : x1, Y + 0.15, z0], [0, top - Y - 0.15, 0], [0, 0, z1 - z0], 0.06, 0.035);
    meshPanel('cage', [x0, top, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], 0.03, 0.035);
    // the rear face is open below for the cables, meshed above them
    meshPanel('cage', [x0, Y + 0.95, z0], [x1 - x0, 0, 0], [0, top - Y - 0.95, 0], 0.03, 0.12);
    tube('cage', 'trim', [x0, Y + 0.95, z0], [x1, Y + 0.95, z0], r, 8);
    // and the front face toward the cab is meshed where the cab does not stand
    if (cabSide < x1) meshPanel('cage', [cabSide, Y + 0.15, z1], [x1 - cabSide, 0, 0], [0, top - Y - 0.15, 0], 0.08, 0.06);
  }

  // ---- THE CAB ----
  if (P.cab) {
    const x0 = D.cabX0, x1 = D.cabX1, z0 = D.cabZ0, z1 = D.cabZ1, y1 = Y + D.cabH, t = 0.04;
    box('cab', 'body', x0, Y, z0, x1, Y + 0.95, z1);                                     // the lower walls
    for (const [a, b] of [[x0, x0 + 0.06], [x1 - 0.06, x1]]) for (const z of [z0, z1]) box('cab', 'body', a, Y + 0.95, z - 0.03, b, y1, z + 0.03);
    box('cab', 'body', x0, y1 - 0.08, z0, x1, y1, z1);
    box('cab', 'trim', x0 - 0.06, y1, z0 - 0.08, x1 + 0.06, y1 + 0.07, z1 + 0.08);      // the roof
    // glazing all round above the waist: the big aft window looks down the cable at the launch point
    box('cab', 'glass', x0 + 0.06, Y + 0.95, z0 - t / 2, x1 - 0.06, y1 - 0.08, z0 + t / 2);
    box('cab', 'glass', x0 + 0.06, Y + 0.95, z1 - t / 2, x1 - 0.06, y1 - 0.08, z1 + t / 2);
    box('cab', 'glass', x0 - t / 2, Y + 0.95, z0 + 0.03, x0 + t / 2, y1 - 0.08, z1 - 0.03);
    box('cab', 'glass', x1 - t / 2, Y + 0.95, z0 + 0.03, x1 + t / 2, y1 - 0.08, z1 - 0.03);
    // the aft window's protective grille (a parting cable comes back at the driver)
    for (let x = x0 + 0.14; x < x1 - 0.1; x += 0.11) tube('cab', 'steel', [x, Y + 0.97, z0 - 0.05], [x, y1 - 0.1, z0 - 0.05], 0.009, 6);
    tube('cab', 'steel', [x0 + 0.06, (Y + y1) / 2 + 0.45, z0 - 0.05], [x1 - 0.06, (Y + y1) / 2 + 0.45, z0 - 0.05], 0.009, 6);
    // the door on the outer side, its handle, the step up to it
    box('cab', 'trim', x0 - 0.025, Y + 0.08, z0 + 0.35, x0 - 0.005, Y + 0.95, z0 + 1.15);
    box('cab', 'bright', x0 - 0.05, Y + 0.85, z0 + 1.0, x0 - 0.02, Y + 0.88, z0 + 1.1);
    box('cab', 'steel', x0 - 0.3, Y - 0.38, z0 + 0.45, x0, Y - 0.34, z0 + 1.05);
    // inside: the seat facing aft and the control console with its two levers per drum
    box('cab', 'grille', x0 + 0.35, Y, z0 + 0.95, x0 + 0.85, Y + 0.48, z0 + 1.4);
    box('cab', 'grille', x0 + 0.35, Y + 0.48, z0 + 1.32, x0 + 0.85, Y + 1.1, z0 + 1.42);
    box('cab', 'steel', x0 + 0.2, Y, z0 + 0.12, x1 - 0.2, Y + 0.85, z0 + 0.45);
    for (let k = 0; k < (P.drums >= 2 ? 4 : 2); k++) {
      const lx = x0 + 0.38 + k * 0.13;
      tube('cab', 'steel', [lx, Y + 0.85, z0 + 0.3], [lx, Y + 1.12, z0 + 0.42], 0.012, 6);
      cyl('cab', k % 2 ? 'red' : 'grille', lx, Y + 1.13, z0 + 0.43, 0.03, 0.05, 'y', 10);
    }
    if (P.beacon) {
      cyl('cab', 'steel', (x0 + x1) / 2 + 0.3, y1 + 0.1, (z0 + z1) / 2, 0.09, 0.06, 'y', 16);
      cyl('cab', 'amber', (x0 + x1) / 2 + 0.3, y1 + 0.2, (z0 + z1) / 2, 0.075, 0.15, 'y', 16);
    }
    tube('cab', 'steel', [x0 + 0.15, y1 + 0.07, z1 - 0.15], [x0 + 0.15, y1 + 1.3, z1 - 0.15], 0.006, 6);  // the radio whip
  } else {
    box('cab', 'grille', -0.6, Y, -0.6, -0.1, Y + 0.5, -0.1);
  }
  // WHERE THE WEATHER COMES FROM (prop space, metres): the exhaust's mouth, the four wheels (contact centre + R), the
  // grease points (the drum hubs and brakes, the gearbox, the levelwinds, the fairleads' rollers, the hitch and the
  // jockey wheel's screw), the deck and the ground
  const wx = { deckY: Y, exhaust: null, wheels: [], grease: [] };
  if (P.power !== 2) wx.exhaust = [ex + 0.08, eY1 + 0.6, D.engZ0 + 0.35 - 0.03];
  for (const az of D.axleZ) for (const s of [-1, 1]) wx.wheels.push([s * D.wheelX, D.wheelR, az, D.wheelR]);
  for (const x of drumXs) {
    wx.grease.push([x, hubY, D.drumZ, 0.30]);                                  // the drum's hub and bearing
    wx.grease.push([x, Y + 0.42, D.lwZ, 0.28]);                                // the levelwind carriage
    wx.grease.push([x, Y + 0.36, D.fairZ, 0.22]);                              // the fairlead's rollers
  }
  wx.grease.push([0, Y + 0.3, D.engZ0 - 0.3, 0.45]);                           // the gearbox
  wx.grease.push([0, D.hitchY, D.drawZ - 0.15, 0.25]);                         // the hitch
  wx.grease = wx.grease.slice(0, 8);
  G.userData = { dims: DIM, P, parts: Object.keys(parts), wx, winchProp: true, drums: drumXs.slice() };
  return G;
}

// the bounding numbers a placer reads (the YARD_KIT shape: L along z, W along x, H up), with the cable wound in
const KIT = { L: DIM.drawZ - DIM.deckZ0 + 0.1, W: DIM.deckW, H: DIM.deckY + DIM.cabH + 0.3 };

// THE FAIRLEAD a cable runs through, in the world: a built winch (placed anywhere, any heading) and its drum (0 the left,
// 1 the right of a twin; a single-drum winch has the one) - where winch_mode.js's line ends
function fairlead(group, drum) {
  const T = THREE_(), xs = (group.userData && group.userData.drums) || [0], x = xs[Math.max(0, Math.min(xs.length - 1, drum || 0))];
  group.updateMatrixWorld(true);
  return group.localToWorld(new T.Vector3(x, DIM.deckY + 0.36, DIM.fairZ));
}

const API = { DEF, ROWS, PRESETS, PAINTS, POWERS, DIM, KIT, VAN_WHEEL, build, fairlead };
root.WINCH_GEN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
