// ============================================================
// THE HANGAR — the garage's room, ported from the design session's hangar.html
// (futureDesigns/transfer-glazing2/hangar.html). Everything is built from
// primitives and canvas-baked sheets: no external art, no network, and a seeded
// PRNG, so the shed is the same shed every time.
//
// WHAT CHANGED IN THE PORT. The session targets three 0.184 as an ES module off
// a CDN; this repo pins r128, vendored, offline. Three real differences, each
// marked at its site:
//   - texture colour space is an ENCODING in r128, not a `colorSpace`
//   - MeshPhysicalMaterial has no `thickness` before r132
//   - there is no `scene.environmentIntensity`; the moods scale each material's
//     own `envMapIntensity` instead, which is the r128 equivalent
// NOT copied: the session sets `PCFShadowMap` because PCFSoftShadowMap is
// deprecated in r184. That is not true in r128, where soft PCF is strictly
// better, so the viewer's own shadow settings are left alone.
//
// The room is a GROUP with its own lights. The viewer adds it to the scene and
// takes it out again; see `installEnv` in app.js.
// ============================================================

// Which THREE features the room needs. The headless smoke gate stubs THREE with
// only what the viewer used before this file existed, so the garage ASKS rather
// than assumes and falls back to the studio when the answer is no. A missing
// constructor is a fallback, not a crash.
const GEN_HANGAR_NEEDS = ['Group', 'Color', 'Fog', 'Mesh', 'BoxGeometry',
  'CylinderGeometry', 'PlaneGeometry', 'ConeGeometry', 'TorusGeometry',
  'ShapeGeometry', 'Shape', 'BufferGeometry', 'Float32BufferAttribute',
  'MeshStandardMaterial', 'MeshBasicMaterial', 'MeshPhysicalMaterial',
  'HemisphereLight', 'DirectionalLight', 'PointLight', 'SpotLight',
  'CanvasTexture',
  'Vector2', 'Vector3', 'Matrix4', 'Box3'];
function genHangarSupported(THREE) {
  return !!THREE && GEN_HANGAR_NEEDS.every(k => THREE[k] !== undefined);
}

// THE SHEET BAKERY IS BAKED ONCE PER PROCESS (G123). Every canvas sheet in
// this file is a pure function of a fixed seed, so the second shed to be built
// was redrawing byte-identical textures and handing the GPU a second copy of
// them: measured at 264 ms and 18.4 MB per exterior build, and the world scene
// builds one at boot now. The memo is keyed on the CALL INDEX plus the
// sheet's size, encoding and the length of its own draw source — the index
// alone would silently return the wrong texture if the sequence of calls ever
// diverged between variants, and the fingerprint is what makes that a miss
// (a rebake) instead of a mistake.
//
// Sharing is safe in the other direction too: three's Material.dispose() does
// NOT dispose an attached texture, and neither disposer here touches maps, so
// tearing down one shed cannot blind the other. Every `repeat.set` applied to
// these sheets is a constant, never a function of the dims, so two sheds of
// different sizes can wear the same tile.
const HANGAR_SHEETS = new Map();
const hangarSheetKey = (kind, w, h, extra, draw) => {
  let f = 2166136261;                                  // FNV-1a over the source
  const src = draw.toString();
  for (let i = 0; i < src.length; i++) {
    f ^= src.charCodeAt(i); f = (f * 16777619) >>> 0;
  }
  return kind + '|' + w + 'x' + h + '|' + extra + '|' + f.toString(36);
};

function genHangarBuild(THREE, dims, opts) {

// THE SAME SHED, SEEN FROM OUTSIDE (G123, the user: "we'll replace the
// 'houses' with an exterior mesh of our hangar, door closed, no inside
// assets"). The flight world used to stand a 15 x 10 coloured box where this
// building is, so taxiing past the hangar and standing inside it were two
// different places. `opts.exterior` builds the SHELL out of this same file —
// not a copy of it, not a simplified twin maintained beside it — so the
// building in the world cannot drift from the room you build in.
//
// It is not "the shell minus the furniture". Roughly two thirds of the shell's
// mesh count is INTERIOR STRUCTURE — seven portal trusses, their purlins, and
// a 162-mesh glazing band — none of which anything outside a closed shed can
// see. `EXT` drops those, closes the doors, and returns before the fittings,
// the lights, the sky, the moods and the two shadow bakes ever run.
//
// Three of those matter beyond the mesh count, and each would be a real bug in
// the world scene rather than a cost: the key light is added to ROOT (a second
// shadow-casting sun), the ground and craft shadow bakes allocate four render
// targets at build time, and setMood calls the PROCESS-GLOBAL propSetEnv /
// aeroSetEnv — so two live hangars would fight over the environment scale for
// every prop and every aeroplane in the app. The early return is upstream of
// all three.
const EXT = !!(opts && opts.exterior);

// THE FRAME FAMILY (HANGARS S4). A shell is a BUILD, not a material: the
// club and the works are the same steel portal at two sizes, and `field` is
// a different building — timber post-and-beam, board cladding, one top-hung
// sliding leaf, no concrete stem, no glazing band, no roof lights. The
// branch is HERE, once, on what the structure IS; the floor, the anchors,
// the fit-out engine, the lamps, the moods, the part system and both shadow
// bakes are shared, which is the whole reason a second family is a chantier
// and not a rewrite.
const SHELL = (opts && opts.shell) || 'club';
const FRAME = SHELL === 'field' ? 'timber' : 'portal';

// ===========================================================================
// THE GARAGE. A working hangar, sized by its caller — 20 m deep, 28 m wide and
// 7.0 m to the eaves by default, which is a club hangar for one or two light
// aeroplanes rather than the DC-3 shed it was first drawn as. Long axis is x,
// doors at -x, which is the end the aeroplane's nose points at (model frame:
// x AFT).
//
// Everything here is built from primitives and canvas-baked sheets — no
// external art. The light is the point: north glazing down both flanks, four
// roof lights, a warm shop lamp over every bay, and the door open on a bright
// afternoon. What sells a big interior is the SOFT half of that, so the scene
// bakes its own environment map off itself (CubeCamera -> PMREM) and every
// material reads its ambient from the room it is standing in.
// ===========================================================================
// THE DIMENSIONS ARE A PARAMETER (G53, user: "I think the hangar is a tad too
// big ... could you get its dimension parametrized"). The whole room is this
// one function, so it always could be: the caller passes half-width,
// half-depth and eaves height, and asking again with different numbers builds
// a different shed. The ridge follows the eaves unless it is given, and the
// door follows the width — a shed you cannot get the aeroplane into is not a
// shed, and a door that no longer fits its own gable is not a door.
//
// HANGAR_DIMS is the DEFAULT, and it changed with this chantier: the shed was
// drawn for a DC-3's 29 m span, and this game's generator clamps a wing to
// 14 m. 36 m of width put the aeroplane in the middle of a field.
const D0 = dims || (typeof HANGAR_DIMS !== 'undefined' ? HANGAR_DIMS : null) || {};
// 30 x 25 x 7 (user, 2026-08-29). This table and the editor's sliders speak
// in HALF width and HALF depth, so a 30 m wide, 25 m deep shed is HW 15,
// HD 12.5.
const HW = D0.HW || 15, HD = D0.HD || 12.5, EAVE = D0.EAVE || 7.0;
const RIDGE = D0.RIDGE || (EAVE + 2.6);
// The opening is nearly the whole gable end. It leaves 2.5 m of wall each side
// for the leaves to park against, and it cannot be taller than the eaves.
// The timber shed's door runs nearly TO its eave instead — at a 3.6 m eave
// the portal's formula leaves a 2.2 m opening, which is a stable door, not a
// hangar door; a timber lintel is shallower than a steel header, so 0.5 m of
// beam is what the opening actually gives up.
const DOOR_W = Math.max(6, 2 * HW - 5);
const DOOR_H = FRAME === 'timber' ? EAVE - 0.5 : Math.min(6.4, EAVE - 1.4);
// THE BACK DOORS (G64, user: "I think we'd better add some doors over there and
// have the wing hang in front of it"). A bi-parting pair: two leaves on ONE
// track, each sliding to its own side, so unlike the six-leaf front they never
// have to pass each other and both hang in the SAME plane. That matters beyond
// the ironmongery — the wing's shadow lands on one flat surface instead of
// straddling two at different depths.
const BD_W = Math.min(11.0, 2 * HW - 8), BD_H = Math.min(4.4, EAVE - 2.2);
const BD_X = HD - 0.34;                    // the leaf plane, hung inside
// ...and the face you look at. The timber shed has no back doors at all —
// its back wall is boards — so the "face" the hung wing throws its shadow on
// is the wall's own inner skin.
const BD_FACE = FRAME === 'timber' ? HD - 0.18 : BD_X - 0.05;

// THE LAYOUT WAS COMPOSED against the authored shed — 26 m deep by 36 m wide,
// HD 13 and HW 18 — and every ABSOLUTE coordinate in the placement below is
// mapped through these. Anything written against a wall (HW - 1.05) is a real
// clearance and is left alone: the bench stands a metre off the wall in any
// shed. Only the positions ALONG the walls scale.
const FX = v => v * HD / 13, FZ = v => v * HW / 18;

// THE STOVE'S FIRE. Declared up here because stoveCorner() builds it halfway
// down the file and the mood code at the bottom has to be able to find it: a
// light nothing holds a reference to is a light nothing can turn off.
const STOVE = { light: null, cd0: 14 };

// THE GROUND, DECLARED. Every surface here is something the reflection probe
// sees BELOW itself, and what a probe sees below itself is the single largest
// uncontrolled source of light on the underside of an aeroplane — measured at
// NIGHT, the environment put 0 on the top of the wing and 7.4 on its belly.
//
// It is a list rather than a test on the mesh (y < 0, faces up, …) because a
// probe cannot be asked to guess: the apron and the grass sit OUTSIDE the
// shed and still fill the bottom of the cube, and the runway is 320 m of it.
// See LIGHT_RIG.groundBounce for what is done with them and why.
const GROUND = [];
const ground = m => { GROUND.push(m); return m; };

// AND WHICH OF THEM ARE OUTSIDE (G123). GROUND is "what the probe sees below
// itself" and the shed's own floor is in it; this is the smaller list of
// surfaces that are OUT OF THE BUILDING, and it exists because they must not be
// lit by a reflection probe baked inside it. app.js hands these the sky's own
// PMREM instead. Declared, not tested for, for the same reason GROUND is: a
// probe cannot be asked to guess where the wall is.
const OUTDOOR = [];
const outdoor = m => { OUTDOOR.push(m); return ground(m); };

// THE SEED IS RESETTABLE, and it has to be (G123). The canvas sheets below are
// MEMOISED across builds, so on the second build their draw callbacks do not
// run and do not draw from this stream — which would leave every later
// rand()-driven placement at a different position depending on whether the
// world's shed happened to be built first. The stream is therefore reset to a
// fixed GEOMETRY seed the moment the bakery is done, in both paths, so the room
// is identical however it was reached.
let RSEED = 20260811;
const rand = () => (RSEED = RSEED * 1664525 + 1013904223 >>> 0) / 4294967296;
const rr = (a, b) => a + (b - a) * rand();

// Asked for BEFORE the sheets, because the two heaviest of them exist only to
// be thrown away when it is present: the scanned slab (G37) is what the floor
// actually wears, and the hand-baked 2048 albedo, its 1024 roughness map and
// slabNrm are the fallback for a payload-less build alone.
const FLOOR_IMG = (typeof HANGAR_FLOOR_IMG !== 'undefined') ? HANGAR_FLOOR_IMG : null;

// ---- canvas sheets --------------------------------------------------------
let sheetIx = 0, sheetBaked = 0, sheetHit = 0;
const sheet = (w, h, draw, linear) => {
  const key = (sheetIx++) + ':' + hangarSheetKey('s', w, h, linear ? 1 : 0, draw);
  const memo = HANGAR_SHEETS.get(key);
  if (memo) { sheetHit++; return memo; }
  sheetBaked++;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  // r128 declares colour space per texture as an ENCODING; a data sheet
  // (normal, roughness) must stay linear or every value in it is bent.
  if (!linear) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = (typeof window !== "undefined" && window.FLYDIY_ANISO) || 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  HANGAR_SHEETS.set(key, t);
  return t;
};

// THE FLOOR. Power-trowelled concrete: cool grey, mottled, saw-cut on a 4 m
// grid, with a lifetime of oil in front of the benches and a yellow bay line.
// The roughness sheet is where the reflection lives — a polished slab is not
// uniformly polished, it is burnished where the machine went and dull where
// the traffic is, and that variation is the whole look.
const floorAlb = FLOOR_IMG ? null : sheet(2048, 2048, (g, W, H) => {
  g.fillStyle = '#615e58'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {          // aggregate mottle
    const x = rand() * W, y = rand() * H, r = rr(6, 90);
    g.globalAlpha = rr(0.02, 0.07);
    g.fillStyle = rand() < 0.5 ? '#8a877e' : '#565450';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 900; i++) {           // fine grit
    g.globalAlpha = rr(0.05, 0.16);
    g.fillStyle = rand() < 0.5 ? '#a5a299' : '#484641';
    g.fillRect(rand() * W, rand() * H, rr(1, 3), rr(1, 3));
  }
  g.globalAlpha = 1;
  // saw cuts, 4 m on a 40 m sheet
  g.strokeStyle = 'rgba(38,36,33,.62)'; g.lineWidth = 5;
  for (let i = 1; i < 10; i++) {
    const p = i / 10 * W;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke();
  }
  // oil, in the bays where work happens
  for (const [cx, cy, R] of [[0.30, 0.30, 190], [0.72, 0.22, 130], [0.24, 0.74, 150]]) {
    for (let i = 0; i < 200; i++) {
      const a = rand() * 7, d = Math.pow(rand(), 0.6) * R;
      g.globalAlpha = rr(0.02, 0.10);
      g.fillStyle = '#2c2620';
      g.beginPath();
      g.arc(cx * W + Math.cos(a) * d, cy * H + Math.sin(a) * d, rr(4, 26), 0, 7);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(214,176,60,.55)'; g.lineWidth = 9;
  g.beginPath(); g.moveTo(0.10 * W, 0); g.lineTo(0.10 * W, H); g.stroke();
  g.beginPath(); g.moveTo(0.90 * W, 0); g.lineTo(0.90 * W, H); g.stroke();
}, false);
const floorRgh = FLOOR_IMG ? null : sheet(1024, 1024, (g, W, H) => {
  g.fillStyle = '#333333'; g.fillRect(0, 0, W, H);          // 0.20 base
  for (let i = 0; i < 500; i++) {                            // burnished swirls
    g.globalAlpha = rr(0.05, 0.18);
    g.fillStyle = '#242424';
    const x = rand() * W, y = rand() * H;
    g.beginPath(); g.ellipse(x, y, rr(40, 220), rr(20, 90), rand() * 7, 0, 7); g.fill();
  }
  for (let i = 0; i < 260; i++) {                            // scuffed, duller
    g.globalAlpha = rr(0.06, 0.20);
    g.fillStyle = '#7d7d7d';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(20, 120), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
// metric-uv re-base (G41): same one-sheet-over-the-floor look
if (floorAlb) { floorAlb.repeat.set(1 / 26, 1 / 36); floorRgh.repeat.set(1 / 26, 1 / 36); }

// corrugated sheeting, as a normal map: a real profile, not a bump guess
const corrNrm = sheet(512, 64, (g, W, H) => {
  const d = g.createImageData(W, H);
  for (let x = 0; x < W; x++) {
    const ph = (x / W) * Math.PI * 2 * 16;                   // 16 ribs per tile
    const nx = Math.cos(ph) * 0.55;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
    for (let y = 0; y < H; y++) {
      const o = (y * W + x) * 4;
      d.data[o] = (nx * 0.5 + 0.5) * 255;
      d.data[o + 1] = 128;
      d.data[o + 2] = nz * 255;
      d.data[o + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
}, true);

const woodAlb = sheet(512, 512, (g, W, H) => {
  g.fillStyle = '#8a6b47'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) {
    g.globalAlpha = rr(0.05, 0.22);
    g.strokeStyle = rand() < 0.5 ? '#6a4f31' : '#a8875e';
    g.lineWidth = rr(1, 5);
    const y = rand() * H;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * rr(1, 6));
    g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 14; i++) {                             // knots
    const x = rand() * W, y = rand() * H, R = rr(5, 16);
    for (let k = 4; k > 0; k--) {
      g.globalAlpha = 0.3;
      g.strokeStyle = '#4f3a22'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, R * k / 4, R * k / 6, 0.4, 0, 7); g.stroke();
    }
  }
  g.globalAlpha = 1;
});
woodAlb.repeat.set(3, 1);

// ---- materials ------------------------------------------------------------
// PROFILED STEEL SHEETING, drawn rather than tinted: panel seams every sheet
// width, the fixing line down each purlin, streaks under the laps and rust
// creeping up from the bottom edge. A flat colour with a corrugation normal map
// reads as plastic — what makes sheeting look like sheeting is that no two bays
// have weathered the same.
const wallAlb = sheet(1024, 512, (g, W, H) => {
  g.fillStyle = '#8b8d82'; g.fillRect(0, 0, W, H);
  const SH = W / 8;                                  // eight sheets across
  for (let i = 0; i < 8; i++) {
    g.globalAlpha = rr(0.03, 0.10);                  // every sheet a shade off
    g.fillStyle = rand() < 0.5 ? '#a2a496' : '#6f7167';
    g.fillRect(i * SH, 0, SH, H);
  }
  g.globalAlpha = 1;
  for (let i = 0; i <= 8; i++) {                     // the lap at each joint
    g.fillStyle = 'rgba(48,50,45,.42)'; g.fillRect(i * SH - 2, 0, 4, H);
    g.fillStyle = 'rgba(206,208,198,.30)'; g.fillRect(i * SH + 2, 0, 2, H);
  }
  for (let k = 1; k < 6; k++) {                      // fixing lines on the rails
    const y = H * k / 6;
    g.fillStyle = 'rgba(60,58,52,.22)'; g.fillRect(0, y, W, 2);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(40,38,34,.55)';
      g.beginPath(); g.arc(i * SH + SH * 0.5, y + 1, 2.2, 0, 7); g.fill();
    }
  }
  for (let i = 0; i < 140; i++) {                    // rain streaks
    const x = rand() * W, w = rr(2, 9), y0 = rr(0, H * 0.5);
    g.globalAlpha = rr(0.03, 0.11);
    g.fillStyle = rand() < 0.6 ? '#5e6058' : '#b6b8ac';
    g.fillRect(x, y0, w, rr(H * 0.2, H * 0.6));
  }
  for (let i = 0; i < 260; i++) {                    // rust from the ground up
    const y = H - Math.pow(rand(), 2.2) * H * 0.42;
    g.globalAlpha = rr(0.03, 0.13);
    g.fillStyle = rand() < 0.5 ? '#7a4a2c' : '#5d4433';
    g.beginPath(); g.arc(rand() * W, y, rr(3, 22), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
// METRIC-LEGACY repeats (G40): the wall boxes now carry world-metre UVs,
// so the baked sheet's old "3 tiles per wall, 1 per height" becomes
// per-metre numbers sized to the long side wall it was authored against.
// The short bands squish a little — the baked wall is the LEGACY option
// in the wardrobe now, kept working, not kept perfect.
wallAlb.repeat.set(3 / 26, 1 / 8.4);
// the outside is the same sheeting, weathered harder and never in the sun here
const wallOutAlb = sheet(512, 256, (g, W, H) => {
  g.fillStyle = '#5f6259'; g.fillRect(0, 0, W, H);
  for (let i = 0; i <= 8; i++) g.fillRect(i * W / 8 - 1, 0, 2, H);
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = rr(0.04, 0.14);
    g.fillStyle = rand() < 0.5 ? '#4a4c45' : '#74776c';
    g.fillRect(rand() * W, rand() * H * 0.6, rr(2, 7), rr(30, 140));
  }
  g.globalAlpha = 1;
});
wallOutAlb.repeat.set(4, 1);
// rendered blockwork for the stem wall, courses and all
const blockAlb = sheet(512, 256, (g, W, H) => {
  g.fillStyle = '#6b675f'; g.fillRect(0, 0, W, H);
  const rows = 5, bw = W / 6;
  for (let r = 0; r < rows; r++) {
    const y = r * H / rows, off = (r % 2) * bw / 2;
    for (let c = -1; c < 7; c++) {
      g.globalAlpha = rr(0.05, 0.16);
      g.fillStyle = rand() < 0.5 ? '#7c786f' : '#5b5851';
      g.fillRect(c * bw + off + 2, y + 2, bw - 4, H / rows - 4);
    }
    g.globalAlpha = 0.5; g.fillStyle = '#494640';
    g.fillRect(0, y, W, 2.5);
    for (let c = -1; c < 7; c++) g.fillRect(c * bw + off, y, 2.5, H / rows);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 120; i++) {                    // scuffs where things hit it
    g.globalAlpha = rr(0.03, 0.12);
    g.fillStyle = rand() < 0.5 ? '#3f3c36' : '#8a867c';
    g.beginPath(); g.arc(rand() * W, H - Math.pow(rand(), 1.6) * H, rr(3, 16), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
// metric-uv re-base (G41): 6 courses per 26 m, one per 1.1 m stem
blockAlb.repeat.set(6 / 26, 1 / 1.1);
// the roof, inside: unlined sheeting, dustier and darker than the walls
const roofAlb = sheet(512, 256, (g, W, H) => {
  g.fillStyle = '#5a5b54'; g.fillRect(0, 0, W, H);
  for (let i = 0; i <= 10; i++) {
    g.fillStyle = 'rgba(36,37,33,.5)'; g.fillRect(i * W / 10 - 1.5, 0, 3, H);
    g.fillStyle = 'rgba(150,152,142,.16)'; g.fillRect(i * W / 10 + 1.5, 0, 1.5, H);
  }
  for (let i = 0; i < 120; i++) {
    g.globalAlpha = rr(0.03, 0.12);
    g.fillStyle = rand() < 0.5 ? '#43443e' : '#71736a';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(10, 60), rr(4, 20), 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});

// ---- WALL FINISHES ---------------------------------------------------------
// Same shed, four linings. Sheet steel is the honest industrial one; the other
// three are what a shed becomes once someone has spent winters in it. Each is a
// drawn albedo — the difference between them is what the surface has been
// through, not a tint.
const timberAlb = sheet(1024, 512, (g, W, H) => {
  g.fillStyle = '#9a7146'; g.fillRect(0, 0, W, H);
  const nb = 14, bh = H / nb;                     // horizontal boarding
  for (let r = 0; r < nb; r++) {
    const y = r * bh;
    g.globalAlpha = 1;
    const warm = rr(0.86, 1.12);
    g.fillStyle = 'rgb(' + Math.round(154 * warm) + ',' + Math.round(113 * warm) + ',' + Math.round(70 * warm) + ')';
    g.fillRect(0, y, W, bh - 1);
    for (let i = 0; i < 26; i++) {                // grain
      g.globalAlpha = rr(0.04, 0.13);
      g.fillStyle = rand() < 0.5 ? '#6b4a29' : '#c2a072';
      const yy = y + rand() * bh;
      g.beginPath(); g.moveTo(0, yy);
      for (let x = 0; x <= W; x += 64) g.lineTo(x, yy + Math.sin(x * 0.02 + r) * 1.6);
      g.lineWidth = rr(0.6, 2.4); g.strokeStyle = g.fillStyle; g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {                 // knots
      if (rand() > 0.5) continue;
      const kx = rand() * W, ky = y + bh * 0.5, kr = rr(3, 7);
      g.fillStyle = 'rgba(84,56,30,.65)';
      g.beginPath(); g.ellipse(kx, ky, kr, kr * 0.7, 0, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(58,40,22,.45)'; g.fillRect(0, y + bh - 2, W, 2);
    g.fillStyle = 'rgba(214,186,146,.16)'; g.fillRect(0, y, W, 1.5);
  }
  for (let i = 0; i < 26; i++) {                  // the odd nail
    g.fillStyle = 'rgba(50,42,34,.5)';
    g.beginPath(); g.arc(rand() * W, rand() * H, 1.8, 0, 7); g.fill();
  }
});
timberAlb.repeat.set(3, 1);

const brickAlb = sheet(1024, 512, (g, W, H) => {
  g.fillStyle = '#6d5b4c'; g.fillRect(0, 0, W, H);          // mortar
  const rows = 22, bw = W / 11, bh = H / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * bh, off = (r % 2) * bw / 2;
    for (let c = -1; c < 12; c++) {
      const t = rand();
      const base = t < 0.12 ? [122, 62, 48] : t < 0.3 ? [150, 84, 60] : t < 0.85 ? [136, 74, 54] : [112, 70, 58];
      const k = rr(0.88, 1.12);
      g.fillStyle = 'rgb(' + Math.round(base[0]*k) + ',' + Math.round(base[1]*k) + ',' + Math.round(base[2]*k) + ')';
      g.fillRect(c * bw + off + 1.5, y + 1.5, bw - 3, bh - 3);
      g.globalAlpha = rr(0.05, 0.16);              // face mottle
      g.fillStyle = rand() < 0.5 ? '#5a3428' : '#a3705a';
      g.fillRect(c * bw + off + 1.5, y + 1.5, bw - 3, bh - 3);
      g.globalAlpha = 1;
    }
  }
  for (let i = 0; i < 200; i++) {                  // soot and damp
    g.globalAlpha = rr(0.02, 0.09);
    g.fillStyle = rand() < 0.5 ? '#3a2a22' : '#8d7f70';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(6, 40), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
brickAlb.repeat.set(3, 1);

const limeAlb = sheet(1024, 512, (g, W, H) => {
  g.fillStyle = '#d9d2c2'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) {                  // brush and patch
    g.globalAlpha = rr(0.02, 0.09);
    g.fillStyle = rand() < 0.55 ? '#eee8da' : '#b8b0a0';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(14, 90), rr(6, 26), rand(), 0, 7); g.fill();
  }
  const rows = 16, bw = W / 9, bh = H / rows;      // the block still shows through
  g.globalAlpha = 0.12; g.fillStyle = '#8e8676';
  for (let r = 0; r < rows; r++) {
    const y = r * bh, off = (r % 2) * bw / 2;
    g.fillRect(0, y, W, 1.6);
    for (let c = -1; c < 10; c++) g.fillRect(c * bw + off, y, 1.6, bh);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 120; i++) {                  // scuffs, and damp at the foot
    const y = H - Math.pow(rand(), 2.0) * H * 0.35;
    g.globalAlpha = rr(0.03, 0.11);
    g.fillStyle = rand() < 0.5 ? '#9a9080' : '#7c6f5c';
    g.beginPath(); g.arc(rand() * W, y, rr(5, 26), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
limeAlb.repeat.set(3, 1);

// ---- height -> normal ------------------------------------------------------
// One converter, used by every surface that wants relief: draw a GREYSCALE
// height field and Sobel it. Cheaper to author than hand-drawn normals and it
// cannot disagree with the albedo, because both are drawn by the same code.
const normalFromHeight = (w, hgt, draw, strength) => {
  const key = (sheetIx++) + ':' + hangarSheetKey('n', w, hgt, strength, draw);
  const memo = HANGAR_SHEETS.get(key);
  if (memo) { sheetHit++; return memo; }
  sheetBaked++;
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, hgt);
  draw(g, w, hgt);
  const src = g.getImageData(0, 0, w, hgt).data;
  const out = g.createImageData(w, hgt);
  const S = strength == null ? 2.2 : strength;
  const at = (x, y) => src[((y + hgt) % hgt * w + (x + w) % w) * 4] / 255;
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * S;
    const dy = (at(x, y + 1) - at(x, y - 1)) * S;
    const L = Math.hypot(dx, dy, 1);
    const o = (y * w + x) * 4;
    out.data[o] = (-dx / L * 0.5 + 0.5) * 255;
    out.data[o + 1] = (-dy / L * 0.5 + 0.5) * 255;
    out.data[o + 2] = (1 / L * 0.5 + 0.5) * 255;
    out.data[o + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = (typeof window !== "undefined" && window.FLYDIY_ANISO) || 8;
  HANGAR_SHEETS.set(key, t);
  return t;
};

// ---- the doors -------------------------------------------------------------
// Vertical corrugation, not the wall's horizontal profile — a sliding leaf is
// sheeted up and down so the water runs off it, and getting that wrong is the
// first thing that reads as wrong on a hangar door.
const doorAlb = sheet(512, 512, (g, W, H) => {
  g.fillStyle = '#33503c'; g.fillRect(0, 0, W, H);
  const nR = 18, rw = W / nR;
  for (let i = 0; i < nR; i++) {                    // shaded corrugation
    const x = i * rw;
    const lg = g.createLinearGradient(x, 0, x + rw, 0);
    lg.addColorStop(0, 'rgba(0,0,0,.30)');
    lg.addColorStop(0.42, 'rgba(255,255,255,.10)');
    lg.addColorStop(0.62, 'rgba(255,255,255,.04)');
    lg.addColorStop(1, 'rgba(0,0,0,.26)');
    g.fillStyle = lg; g.fillRect(x, 0, rw, H);
  }
  for (let i = 0; i < 260; i++) {                   // weathering, chalked paint
    g.globalAlpha = rr(0.02, 0.10);
    g.fillStyle = rand() < 0.45 ? '#6d8a72' : rand() < 0.6 ? '#22301f' : '#7a5a34';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(4, 34), rr(10, 70), 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 40; i++) {                    // rust creeping up from the sill
    const y = H - Math.pow(rand(), 2.4) * H * 0.4;
    g.globalAlpha = rr(0.05, 0.22);
    g.fillStyle = '#7c4a24';
    g.beginPath(); g.ellipse(rand() * W, y, rr(3, 12), rr(8, 40), 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
// metric-uv re-base (G41): 2 tiles per 5.15 m leaf, one per door height
doorAlb.repeat.set(2 / 5.15, 1 / 6.4);
const doorNrm = normalFromHeight(512, 512, (g, W, H) => {
  const nR = 18, rw = W / nR;
  for (let i = 0; i < nR; i++) {
    const x = i * rw;
    const lg = g.createLinearGradient(x, 0, x + rw, 0);
    lg.addColorStop(0, '#3a3a3a'); lg.addColorStop(0.5, '#e0e0e0'); lg.addColorStop(1, '#3a3a3a');
    g.fillStyle = lg; g.fillRect(x, 0, rw, H);
  }
}, 2.6);
doorNrm.repeat.set(2, 1);
const doorRgh = sheet(256, 256, (g, W, H) => {
  g.fillStyle = '#6e6e6e'; g.fillRect(0, 0, W, H);   // chalky paint, fairly matte
  for (let i = 0; i < 200; i++) {
    g.globalAlpha = rr(0.05, 0.2);
    g.fillStyle = rand() < 0.5 ? '#8f8f8f' : '#4a4a4a';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(6, 40), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
doorRgh.repeat.set(2, 1);

// ---- wall relief, one per finish -------------------------------------------
const timberNrm = normalFromHeight(512, 256, (g, W, H) => {
  const nb = 14, bh = H / nb;
  for (let r = 0; r < nb; r++) {
    const y = r * bh;
    const lg = g.createLinearGradient(0, y, 0, y + bh);
    lg.addColorStop(0, '#c9c9c9'); lg.addColorStop(0.75, '#9a9a9a'); lg.addColorStop(1, '#3c3c3c');
    g.fillStyle = lg; g.fillRect(0, y, W, bh);
  }
}, 2.0);
timberNrm.repeat.set(3, 1);
const brickNrm = normalFromHeight(512, 256, (g, W, H) => {
  g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, W, H);          // mortar, recessed
  const rows = 22, bw = W / 11, bh = H / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * bh, off = (r % 2) * bw / 2;
    for (let c = -1; c < 12; c++) {
      g.fillStyle = '#c8c8c8';
      g.fillRect(c * bw + off + 1.5, y + 1.5, bw - 3, bh - 3);
    }
  }
}, 2.4);
brickNrm.repeat.set(3, 1);
const limeNrm = normalFromHeight(512, 256, (g, W, H) => {
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, W, H);
  const rows = 16, bw = W / 9, bh = H / rows;
  g.fillStyle = '#6a6a6a';
  for (let r = 0; r < rows; r++) {
    const y = r * bh, off = (r % 2) * bw / 2;
    g.fillRect(0, y, W, 2);
    for (let c = -1; c < 10; c++) g.fillRect(c * bw + off, y, 2, bh);
  }
  for (let i = 0; i < 200; i++) {                            // trowel texture
    g.globalAlpha = rr(0.05, 0.16);
    g.fillStyle = rand() < 0.5 ? '#a8a8a8' : '#707070';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(10, 50), rr(4, 16), rand(), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, 1.4);
limeNrm.repeat.set(3, 1);
// one grime sheet, shared: nothing is uniformly rough
const wallRgh = sheet(512, 256, (g, W, H) => {
  g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) {
    g.globalAlpha = rr(0.04, 0.16);
    g.fillStyle = rand() < 0.5 ? '#dcdcdc' : '#8a8a8a';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(12, 90), rr(8, 40), rand(), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
wallRgh.repeat.set(3, 1);

// THE FLOOR FINISHES ARE GONE (G123). Four hand-baked slab options —
// epoxy, worn concrete, boards — 3 x 1024 albedo and 3 x 512 roughness,
// ~14 MB of canvas, baked on every single build and APPLIED TO NOTHING. They
// were the pre-G41 floor wardrobe; the material library and the part system
// replaced them, and nothing has referenced them since. Measured by counting
// references: each name occurred exactly twice, its own `const` and the
// `repeat.set` loop that followed it.


// ---- floor relief ----------------------------------------------------------
// Slabs are not flat: there is a saw cut every four metres and the trowel
// leaves a swirl. Small amplitudes on purpose — a floor that reads bumpy reads
// as gravel.
const slabNrm = FLOOR_IMG ? null : normalFromHeight(512, 512, (g, W, H) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 240; i++) {                       // trowel swirl
    g.globalAlpha = 0.10;
    g.fillStyle = rand() < 0.5 ? '#8e8e8e' : '#727272';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(40, 200), rr(16, 70), rand(), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 5;           // the saw cuts
  for (let i = 1; i < 5; i++) {
    const p = i / 5 * W;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke();
  }
}, 1.6);
// gritNrm and boardNrm went with them (G123): two more normalFromHeight
// passes — a height field AND a central-difference over it — feeding nothing.

if (slabNrm) slabNrm.repeat.set(1, 1);

// ---- THE BAKERY ENDS HERE -------------------------------------------------
// and the geometry's random stream starts, from a seed of its own. Without
// this line the room would be laid out differently depending on whether the
// sheets were baked or fetched from the memo — i.e. on whether the world's
// shed happened to be built first — because a cached sheet draws nothing from
// the stream. Everything below (tuft scatter, clutter jitter, wall wear) is
// downstream of it.
RSEED = 0x5f1d7a3b;

// THE FLOOR WEARS A SCANNED SLAB when the payload is present (G37, user):
// concrete_floor_damaged_01 (Poly Haven CC0), one tile = 5 m of real
// floor, carried by src/viewer/hangar_floor.js as pre-decoding images.
// The baked canvas floor stays the fallback, so a payload-less build
// (and the smoke gate's stub) still stands. The material object joins M
// either way, so the moods' envMapIntensity scaling covers it unchanged.
const floorTex = (img, srgb) => {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = (typeof window !== "undefined" && window.FLYDIY_ANISO) || 8;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  // the floor plane carries METRIC uvs since G41 — one tile = tile metres
  const tile = (typeof HANGAR_FLOOR_TILE_M === 'number') ? HANGAR_FLOOR_TILE_M : 5;
  t.repeat.set(1 / tile, 1 / tile);
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else img.onload = ok;
  return t;
};

const M = {
  floor: FLOOR_IMG
    ? new THREE.MeshStandardMaterial({ map: floorTex(FLOOR_IMG.diff, true),
        roughnessMap: floorTex(FLOOR_IMG.rough),
        normalMap: floorTex(FLOOR_IMG.nor),
        normalScale: new THREE.Vector2(1, 1),
        roughness: 1, metalness: 0.06, envMapIntensity: 1.7 })
    : new THREE.MeshStandardMaterial({ map: floorAlb, roughnessMap: floorRgh,
        normalMap: slabNrm, normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 1, metalness: 0.12, envMapIntensity: 1.7 }),
  wall: new THREE.MeshStandardMaterial({ map: wallAlb, normalMap: corrNrm,
    normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: wallRgh,
    roughness: 0.70, metalness: 0.14, side: THREE.DoubleSide }),
  // roofAlb re-based (G41): the quad's old uvScale 6 became metric uv
  roofIn: new THREE.MeshStandardMaterial({ map: roofAlb, normalMap: corrNrm,
    normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.80, metalness: 0.10,
    side: THREE.FrontSide }),
  roofOut: new THREE.MeshStandardMaterial({ map: wallOutAlb, roughness: 0.86,
    metalness: 0.10, side: THREE.FrontSide }),
  wallOut: new THREE.MeshStandardMaterial({ map: wallOutAlb, roughness: 0.85,
    metalness: 0.10, side: THREE.BackSide }),
  stem: new THREE.MeshStandardMaterial({ map: blockAlb, roughness: 0.94 }),
  // the doors: corrugation running VERTICALLY, and a coat of paint that has
  // been in the weather since somebody's father hung them
  door: new THREE.MeshStandardMaterial({ map: doorAlb, normalMap: doorNrm,
    normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: doorRgh,
    roughness: 1, metalness: 0.20 }),
  doorTrim: new THREE.MeshStandardMaterial({ color: 0x2f4436, roughness: 0.62,
    metalness: 0.35 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x565c63, roughness: 0.44, metalness: 0.85 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x33383e, roughness: 0.55, metalness: 0.70 }),
  paintGreen: new THREE.MeshStandardMaterial({ color: 0x3c5a4a, roughness: 0.52, metalness: 0.18 }),
  paintRed: new THREE.MeshStandardMaterial({ color: 0x9a2f26, roughness: 0.42, metalness: 0.22 }),
  paintBlue: new THREE.MeshStandardMaterial({ color: 0x27455e, roughness: 0.48, metalness: 0.20 }),
  wood: new THREE.MeshStandardMaterial({ map: woodAlb, roughness: 0.74, metalness: 0 }),
  woodPale: new THREE.MeshStandardMaterial({ color: 0xc2a276, roughness: 0.80 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xdce8f0, roughness: 0.06, metalness: 0,
    // `thickness` is r132+ and this build is r128: transmission alone, with
    // the opacity carrying what the refraction slab would have.
    transmission: 0.90, transparent: true, opacity: 0.5,
    envMapIntensity: 1.4, side: THREE.DoubleSide }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.95 }),
  // the filament itself: emissive, unlit by anything else, and scaled with the
  // moods like every other material in here
  bulb: new THREE.MeshStandardMaterial({ color: 0x1a1206, roughness: 0.35,
    emissive: 0xffcc7a, emissiveIntensity: 2.2 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.32, metalness: 0.9 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xa8adb3, roughness: 0.30, metalness: 0.92 }),
  canvasM: new THREE.MeshStandardMaterial({ color: 0xa89a80, roughness: 0.95 }),
  lampWarm: new THREE.MeshStandardMaterial({ color: 0xffe6b8, emissive: 0xffcf87,
    emissiveIntensity: 3.2, roughness: 0.6 }),
  // THE ROOF PANE IS GLAZING, not a lit panel (G56, user: "I can't see the HDRI
  // through the roof windows, did you remove the mesh?"). The mesh was never
  // removed and the hole is genuinely cut — but this material was an OPAQUE
  // emissive, so the opening was filled by a glowing sheet and the sky behind
  // it was never in the picture. Transparent now, with the emissive kept as the
  // milky wash a diffusing rooflight really has over what you can see through
  // it; depthWrite off so the sky sphere sorts behind it rather than being
  // rejected by its own depth.
  skyPanel: new THREE.MeshStandardMaterial({ color: 0xdfeaf6, emissive: 0xcfe2f7,
    emissiveIntensity: 1.7, roughness: 0.9, side: THREE.DoubleSide,
    transparent: true, opacity: 0.30, depthWrite: false }),
  daylight: new THREE.MeshBasicMaterial({ color: 0xf2ecdc, side: THREE.FrontSide }),
};
// the slab is the biggest single thing the probe sees under itself
ground(M.floor);
// DEDICATED PART MATERIALS (G41, user: assign materials to parts of the
// hangar). Parts the library dresses independently need their OWN
// instances — M.wall was every interior wall, M.steel every piece of
// steel — split here so the part system below can dress one without
// dressing them all. Same authored numbers as their parents.
M.wallBack = M.wall.clone();
M.beamMain = M.steel.clone();
M.beamSec = M.steelDark.clone();
M.manDoor = M.paintGreen.clone();

// TIMBER CLADDING (HANGARS S4). The field shed is boards — ONE skin, both
// faces, which is what a single-skin barn wall is — so the wall family swaps
// here, after the part clones, and everything downstream (the part system,
// the moods, the probe) dresses planks without knowing the difference. The
// roof stays corrugated iron: sheet over timber is what these buildings
// actually wear. Board relief rides the metric-uv system like every wall
// map: one tile is 3.5 m, so a 14-board sheet is a 0.25 m board.
if (FRAME === 'timber') {
  const plankDraw = vertical => (g, W, H) => {
    const nb = 14;
    for (let r = 0; r < nb; r++) {
      const base = 0x76 + Math.floor(rr(-16, 12));
      g.fillStyle = 'rgb(' + base + ',' + Math.floor(base * 0.88) + ',' +
                    Math.floor(base * 0.70) + ')';
      if (vertical) g.fillRect(r * W / nb, 0, W / nb, H);
      else g.fillRect(0, r * H / nb, W, H / nb);
      // grain streaks along the board, a knot or two across the sheet
      g.globalAlpha = 0.18;
      for (let k = 0; k < 6; k++) {
        g.fillStyle = rand() < 0.5 ? '#5c4f3e' : '#9a8a6f';
        if (vertical)
          g.fillRect(r * W / nb + rr(1, W / nb - 3), 0, rr(0.5, 1.6), H);
        else
          g.fillRect(0, r * H / nb + rr(1, H / nb - 3), W, rr(0.5, 1.6));
      }
      g.globalAlpha = 1;
    }
    g.globalAlpha = 0.30; g.fillStyle = '#463c2e';
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      g.ellipse(rand() * W, rand() * H, rr(2, 5), rr(3, 7), rand(), 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  const plankAlb = sheet(512, 256, plankDraw(false), true);
  plankAlb.repeat.set(1 / 3.5, 1 / 3.5);
  const plankAlbV = sheet(256, 512, plankDraw(true), true);
  const plankNrm = normalFromHeight(512, 256, (g, W, H) => {
    const nb = 14, bh = H / nb;
    for (let r = 0; r < nb; r++) {
      const y = r * bh;
      const lg = g.createLinearGradient(0, y, 0, y + bh);
      lg.addColorStop(0, '#c9c9c9'); lg.addColorStop(0.8, '#9a9a9a');
      lg.addColorStop(1, '#3c3c3c');
      g.fillStyle = lg; g.fillRect(0, y, W, bh);
    }
  }, 1.6);
  plankNrm.repeat.set(1 / 3.5, 1 / 3.5);
  M.wall = new THREE.MeshStandardMaterial({ map: plankAlb,
    normalMap: plankNrm, normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: wallRgh, roughness: 0.88, metalness: 0,
    side: THREE.DoubleSide });
  M.wallBack = M.wall.clone();
  const out = M.wall.clone(); out.side = THREE.FrontSide;
  M.wallOut = out;                    // the coarse LOD's outer skin
  // the leaf is vertical boards with a painted frame — the trim family stays
  M.door = new THREE.MeshStandardMaterial({ map: plankAlbV,
    roughness: 0.85, metalness: 0 });
  // the beam families are TIMBER here, and they stay the part system's
  // 'beams' rows — a dressable post is a dressable truss
  M.beamMain = M.wood.clone();
  M.beamSec = M.wood.clone();
}

// ---- primitive helpers ----------------------------------------------------
const G = new THREE.Group();                 // everything static
const box = (w, h, d, mat, x, y, z, ry) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); if (ry) m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  return m;
};
// A WALL BOX CARRIES METRIC, WORLD-ALIGNED UVs (G40, user: "get the
// textures projected coherently — same size, no stretching"). BoxGeometry
// UVs run 0..1 per face, so a texture stretches with the face; here every
// vertex instead takes its WORLD coordinates (metres) along the face's
// two in-plane axes, so one texture.repeat = 1/tileM projects every wall
// piece at the same real size, and adjacent bands stay continuous (the
// world offset rides in the uv rather than restarting per box). Walls are
// axis-aligned translated boxes — no ry — which is what makes this exact.
// Only the WALL pieces use it: everything else keeps the 0..1 grammar its
// baked sheets were authored in.
const mbox = (w, h, d, mat, x, y, z) => {
  const m = box(w, h, d, mat, x, y, z);
  const g = m.geometry, pos = g.attributes.position,
        nrm = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const px = pos.getX(i) + x, py = pos.getY(i) + y, pz = pos.getZ(i) + z;
    if (nx > 0.5) uv.setXY(i, pz, py);          // side faces: (z, y)
    else if (ny > 0.5) uv.setXY(i, px, pz);     // top/bottom: (x, z)
    else uv.setXY(i, px, py);                   // front/back: (x, y)
  }
  uv.needsUpdate = true;
  return m;
};
const cyl = (r1, r2, h, mat, x, y, z, seg) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 18), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
};
const put = (...m) => { for (const x of m) G.add(x); return m[0]; };

// WHAT THE SHELL COSTS, counted rather than guessed. Nothing in this room was
// ever merged or instanced, so meshes ARE draw calls, and until G123 there was
// no census of them anywhere — texBudget() below counts fragment samplers,
// which is a different question. The exterior build reports through this
// because it is the one that has to live in someone else's scene.
const census = () => {
  let meshes = 0, tris = 0;
  G.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const g = o.geometry, idx = g.index;
    tris += (idx ? idx.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3;
  });
  return { meshes: meshes, tris: Math.round(tris) };
};
// FOUR CORNERS, in order. A sloping roof panel is a quadrilateral in space and
// the honest way to build one is to say where its corners are — chaining
// rotation.set() with rotateX() to tip a PlaneGeometry into the slope is what
// had the deck facing outward and the roof lights lying in a different plane
// from the roof they are supposed to be holes in.
const quad = (a, b, c, d, mat, uvScale) => {
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(
    [...a, ...b, ...c, ...a, ...c, ...d], 3));
  // uvScale: a number (square, the original grammar) or [uw, vh] —
  // the metric form the part system's surfaces use (G41)
  const us = uvScale || 1,
        uw = Array.isArray(us) ? us[0] : us,
        vh = Array.isArray(us) ? us[1] : us;
  g2.setAttribute('uv', new THREE.Float32BufferAttribute(
    [0, 0, uw, 0, uw, vh, 0, 0, uw, vh, 0, vh], 2));
  g2.computeVertexNormals();
  const m = new THREE.Mesh(g2, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
};
// a beam between two points, so a truss can be described by its geometry
const strut = (a, b, r, mat, seg) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg || 8), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
};

// ===========================================================================
// SHELL
// ===========================================================================
const roofY = z => EAVE + (RIDGE - EAVE) * (1 - Math.abs(z) / HW);

// floor, and an apron outside the door so the eye does not fall off the world
{
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2 * HD, 2 * HW), M.floor);
  { const uv = f.geometry.attributes.uv;      // metric uvs (G41)
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * 2 * HD, uv.getY(i) * 2 * HW);
    uv.needsUpdate = true; }
  f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
  put(f);
  // NO APRON HERE ANY MORE (G123). It used to be a 26 x 30 plane of flat
  // colour laid at y = -0.01, with no map at all — paint on the grass rather
  // than a slab. Every paved surface is the SITE's now, declared once in
  // 25_airfield.js and built with the rest of the outdoors further down, so
  // that the apron you taxi off in the world and the apron you see through
  // this door are one rectangle.
}

// side walls: concrete stem, corrugated above, glazing band between.
// THE BAND FOLLOWS THE EAVES DOWN (HANGARS S3): 3.2-5.2 m is right for a
// 7 m eave — high enough to light the floor and clear a wing — but a shed
// dragged to the 4.2 m floor was drawing the sheet above the head with a
// NEGATIVE height (EAVE - 5.2), which is an inside-out box you cannot see
// from inside. The sill and head keep their authored values wherever they
// fit and step down together where they do not.
const SILL = Math.min(3.2, EAVE - 2.4), HEAD = Math.min(5.2, EAVE - 1.0);
const GY = (SILL + HEAD) / 2, GH = HEAD - SILL;

// TIMBER SIDE WALLS (HANGARS S4): boards from slab to eave, no stem, no
// glazing band — and one small window toward the back of each flank,
// genuinely CUT (G52's rule: an opening is pieces of wall around a hole,
// never a pane laid on a solid face), because a shed lit only through its
// door is a cave with a bright end.
if (FRAME === 'timber') {
  const WW = 1.1, WH = 0.9, WSILL = 1.45;    // the window, and its sill
  const wxc = HD * 0.30;                     // toward the back, clear of door
  for (const s of [1, -1]) {
    const x0 = wxc - WW / 2, x1 = wxc + WW / 2;
    put(mbox(x0 + HD, EAVE, 0.14, M.wall, (x0 - HD) / 2, EAVE / 2, s * HW));
    put(mbox(HD - x1, EAVE, 0.14, M.wall, (x1 + HD) / 2, EAVE / 2, s * HW));
    put(mbox(WW, WSILL, 0.14, M.wall, wxc, WSILL / 2, s * HW));
    put(mbox(WW, EAVE - (WSILL + WH), 0.14, M.wall,
             wxc, WSILL + WH + (EAVE - (WSILL + WH)) / 2, s * HW));
    // the pane, a painted frame, one mullion
    const gl = box(WW - 0.10, WH - 0.10, 0.03, M.glass, wxc, WSILL + WH / 2, s * HW);
    gl.castShadow = false; put(gl);
    put(box(WW, 0.07, 0.10, M.doorTrim, wxc, WSILL + 0.02, s * HW),
        box(WW, 0.07, 0.10, M.doorTrim, wxc, WSILL + WH - 0.02, s * HW),
        box(0.07, WH, 0.10, M.doorTrim, x0 + 0.02, WSILL + WH / 2, s * HW),
        box(0.07, WH, 0.10, M.doorTrim, x1 - 0.02, WSILL + WH / 2, s * HW),
        box(0.05, WH - 0.1, 0.08, M.doorTrim, wxc, WSILL + WH / 2, s * HW));
  }
} else
for (const s of [1, -1]) {
  put(mbox(2 * HD, 1.1, 0.25, M.stem, 0, 0.55, s * HW));
  // lower sheeting, stem to the sill
  put(mbox(2 * HD, SILL - 1.1, 0.12, M.wall, 0, 1.1 + (SILL - 1.1) / 2, s * HW));
  // upper sheeting, head to eaves
  put(mbox(2 * HD, EAVE - HEAD, 0.12, M.wall, 0, HEAD + (EAVE - HEAD) / 2, s * HW));
  // THE OUTER SKIN IS CUT FOR THE GLAZING (user: "can we properly cut into the
  // hangar for the windows?"). It used to be one slab from the ground to the
  // eaves standing OUTSIDE the band, so every window in the room looked at
  // sheet steel with the sky nowhere in it. Now it is the same three bands the
  // inner skin already had, plus a strip on each mullion — the panes are the
  // only thing left open, and they see the sky sphere.
  // one glazing bay per ~2.8 m of wall (HANGARS S3): nine at the club's own
  // depth, and a deeper shed gets more bays at the same rhythm instead of
  // nine panes stretched wide
  const nBay = Math.max(4, Math.round(2 * HD / 2.8)), bayW = (2 * HD) / nBay;
  const zOut = s * (HW + 0.16);
  put(box(2 * HD + 0.4, SILL, 0.06, M.wallOut, 0, SILL / 2, zOut));
  put(box(2 * HD + 0.4, EAVE + 0.4 - HEAD, 0.06, M.wallOut, 0,
          HEAD + (EAVE + 0.4 - HEAD) / 2, zOut));
  for (let i = 0; i <= nBay; i++) {
    // the two ends carry the skin's 0.2 m overhang as well as the mullion
    const end = i === 0 ? -1 : i === nBay ? 1 : 0;
    put(box(0.25 + (end ? 0.2 : 0), HEAD - SILL, 0.06, M.wallOut,
            -HD + bayW * i + end * 0.1, (SILL + HEAD) / 2, zOut));
  }
  // THE GLAZING BAND. Industrial steel windows, 3.2 to 5.2 m: high enough to
  // light the whole floor and clear a wing, which is why real hangars glaze
  // exactly there.
  // AT EXTERIOR DETAIL THE BAND IS ONE PANE. Nine bays times nine meshes times
  // two sides is 162 draw calls of glazing bar, and the outer skin's own
  // mullions (just above) already give the band its vertical rhythm from
  // outside. What is lost is frame depth at arm's length, which is a distance
  // the world never renders this building from.
  if (EXT) {
    const gl = box(2 * HD - 0.25, GH, 0.03, M.glass, 0, GY, s * HW);
    gl.castShadow = false;
    put(gl);
  } else
  for (let i = 0; i < nBay; i++) {
    const cx = -HD + bayW * (i + 0.5);
    const gl = box(bayW - 0.25, GH, 0.03, M.glass, cx, GY, s * HW);
    gl.castShadow = false;
    put(gl);
    put(box(bayW - 0.25, 0.09, 0.16, M.steelDark, cx, SILL, s * HW),
        box(bayW - 0.25, 0.09, 0.16, M.steelDark, cx, HEAD, s * HW),
        box(0.10, GH, 0.16, M.steelDark, cx - (bayW - 0.25) / 2, GY, s * HW),
        box(0.10, GH, 0.16, M.steelDark, cx + (bayW - 0.25) / 2, GY, s * HW));
    for (let k = 1; k < 4; k++)                              // glazing bars
      put(box(0.05, GH, 0.13, M.steelDark,
              cx - (bayW - 0.25) / 2 + (bayW - 0.25) * k / 4, GY, s * HW));
    put(box(bayW - 0.25, 0.04, 0.13, M.steelDark, cx, GY, s * HW));
  }
}

// back wall (+x), with a personnel door and a high window
// TIMBER (HANGARS S4): solid boards, the person door by the corner, the
// gable above — and NO back doors. The hung wing wants a big flat plane
// behind it (G64's whole argument), and a board wall IS one; its shadow
// sheet lands on BD_FACE, which the timber branch points at the boards.
if (FRAME === 'timber') {
  const MDZ = Math.min(13.5, HW - 1.5);
  const z0 = MDZ - 0.55, z1 = MDZ + 0.55;      // the person-door opening
  put(mbox(0.14, EAVE, z0 + HW, M.wallBack, HD, EAVE / 2, (z0 - HW) / 2));
  put(mbox(0.14, EAVE, HW - z1, M.wallBack, HD, EAVE / 2, (z1 + HW) / 2));
  put(mbox(0.14, EAVE - 2.1, 1.1, M.wallBack, HD,
           2.1 + (EAVE - 2.1) / 2, MDZ));
  const gable = new THREE.Shape();
  gable.moveTo(-HW, EAVE); gable.lineTo(HW, EAVE); gable.lineTo(0, RIDGE);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.wallBack);
  gm.rotation.y = Math.PI / 2; gm.position.x = HD;
  gm.receiveShadow = true;
  put(gm);
  put(mbox(0.10, 2.1, 0.95, M.manDoor, HD - 0.08, 1.05, MDZ));
  put(cyl(0.03, 0.03, 0.16, M.brass, HD - 0.16, 1.0, MDZ - 0.35, 8));
} else {
  // CUT FOR THE GABLE WINDOW, in four pieces round the opening — the pane used
  // to be laid on the inside of a solid wall, which is a picture of a window.
  const gwY0 = EAVE - 2.1, gwY1 = EAVE - 0.5, gwZ = 2.1;
  put(mbox(0.14, gwY0, 2 * HW, M.wallBack, HD, gwY0 / 2, 0));
  put(mbox(0.14, EAVE - gwY1, 2 * HW, M.wallBack, HD, gwY1 + (EAVE - gwY1) / 2, 0));
  for (const sd of [-1, 1])
    put(mbox(0.14, gwY1 - gwY0, HW - gwZ, M.wallBack, HD,
             (gwY0 + gwY1) / 2, sd * (HW + gwZ) / 2));
  // THE STEM RUNS ROUND THE BACK TOO (G41, user: "I like the brick
  // bottom on the sides ... add that to the back") — same course, same
  // height, interrupted where the personnel door stands.
  // ...and interrupted again for the BACK DOORS (G64): a course of brick
  // running behind a closed door opening is the tell that the opening is
  // painted on.
  // The personnel door follows the wall in (HANGARS S3): its authored post at
  // z = 13.5 stood OUTSIDE any shed narrower than 15 m, and the stem course
  // that breaks around it was drawn 13-to-14 by literal — a NEGATIVE-length
  // box below HW 14. The door keeps its place wherever the wall reaches it.
  const MDZ = Math.min(13.5, HW - 1.5);
  put(mbox(0.25, 1.1, HW - BD_W / 2, M.stem, HD, 0.55, -(BD_W / 2 + HW) / 2));
  put(mbox(0.25, 1.1, (MDZ - 0.5) - BD_W / 2, M.stem, HD, 0.55,
           ((MDZ - 0.5) + BD_W / 2) / 2));
  put(mbox(0.25, 1.1, HW - (MDZ + 0.5), M.stem, HD, 0.55, ((MDZ + 0.5) + HW) / 2));
  const gable = new THREE.Shape();
  gable.moveTo(-HW, EAVE); gable.lineTo(HW, EAVE); gable.lineTo(0, RIDGE);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.wallBack);
  gm.rotation.y = Math.PI / 2; gm.position.x = HD;
  gm.receiveShadow = true;
  put(gm);
  // gable window: the one that throws a long shape across the floor
  put(box(0.05, 1.6, 4.2, M.glass, HD - 0.10, EAVE - 1.3, 0));
  for (let k = 0; k <= 4; k++)
    put(box(0.10, 1.7, 0.08, M.steelDark, HD - 0.10, EAVE - 1.3, -2.1 + k * 1.05));
  put(box(0.12, 0.10, 4.3, M.steelDark, HD - 0.10, EAVE - 2.15, 0),
      box(0.12, 0.10, 4.3, M.steelDark, HD - 0.10, EAVE - 0.45, 0));
  put(mbox(0.10, 2.1, 0.95, M.manDoor, HD - 0.08, 1.05, MDZ));
  put(cyl(0.03, 0.03, 0.16, M.brass, HD - 0.16, 1.0, MDZ - 0.35, 8));

  // THE BACK DOORS, CLOSED (G64). Same vocabulary as the front — header beam,
  // track, sill and head channels, stiles, intermediate rails, anti-rack
  // braces, hangers and rollers, guide shoes, one wicket — at two thirds the
  // size and shut, because the job here is a BACKDROP. A big flat painted
  // surface is what makes the pale wing hanging in front of it read; the
  // plank wall it used to hang on has the same value and the same grain as
  // the wing does.
  //
  // The leaves hang INSIDE the building, in front of the wall's own reveal.
  // That is not a shortcut round cutting the wall: it is what a top-hung
  // sliding door does, and it is what the front door already does at
  // -HD + 0.42.
  put(box(0.5, 0.55, BD_W + 1.2, M.steel, HD - 0.1, BD_H + 0.28, 0));
  put(box(0.22, 0.14, 2 * HW - 1, M.steelDark, BD_X - 0.08, BD_H + 0.62, 0));
  const BLW = BD_W / 2;                          // two leaves, butted at z = 0
  for (const s of [-1, 1]) {
    const leafZ = s * BLW / 2;
    const g = new THREE.Group(); g.position.set(BD_X, 0, leafZ);
    // IN = -1: at the back wall "further into the room" is -x, so every offset
    // the front door writes as +0.01 is written -0.01 here. One constant beats
    // a mirrored copy with the signs edited by hand.
    const IN = -1;
    g.add(mbox(0.10, BD_H, BLW, M.door, 0, BD_H / 2, 0));
    g.add(box(0.14, 0.18, BLW, M.doorTrim, IN * 0.01, 0.11, 0),
          box(0.14, 0.20, BLW, M.doorTrim, IN * 0.01, BD_H - 0.12, 0));
    for (const e of [-1, 1])
      g.add(box(0.14, BD_H, 0.20, M.doorTrim, IN * 0.01, BD_H / 2, e * (BLW / 2 - 0.10)));
    for (const k of [1, 2])
      g.add(box(0.13, 0.13, BLW - 0.4, M.doorTrim, IN * 0.01, k * BD_H / 3, 0));
    for (const [y0, y1] of [[0.3, BD_H / 3 - 0.1], [BD_H / 3 + 0.1, 2 * BD_H / 3 - 0.1]])
      put(strut([BD_X + IN * 0.02, y0, leafZ - BLW / 2 + 0.3],
                [BD_X + IN * 0.02, y1, leafZ + BLW / 2 - 0.3], 0.03, M.steelDark));
    for (const o of [-1, 1]) {
      g.add(box(0.10, 0.34, 0.12, M.steelDark, IN * 0.01, BD_H + 0.30, o * BLW * 0.3));
      const wl = cyl(0.09, 0.09, 0.05, M.steel, IN * 0.01, BD_H + 0.52, o * BLW * 0.3, 12);
      wl.rotation.x = Math.PI / 2; g.add(wl);
      g.add(box(0.16, 0.10, 0.14, M.steelDark, IN * 0.01, 0.05, o * BLW * 0.34));
    }
    if (s < 0) {                                  // the wicket everybody uses
      g.add(box(0.06, 2.05, 0.86, M.doorTrim, -IN * 0.06, 1.03, -0.9));
      g.add(box(0.05, 1.92, 0.76, M.door, -IN * 0.10, 1.02, -0.9));
      g.add(cyl(0.028, 0.028, 0.12, M.brass, -IN * 0.16, 1.02, -0.60, 10));
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    G.add(g);
  }
}

// door wall (-x): a big sliding opening, leaves parked open, daylight beyond
// TIMBER (HANGARS S4): ONE top-hung leaf, and the track that carries it
// runs PAST the building corner on outrigger posts — which is not a
// shortcut, it is what real grass-strip timber hangars do: a leaf wider
// than the wall beside its opening has nowhere else to go, so the track
// cantilevers out and a post props its end. Parked open (interior) the
// leaf stands clear of the whole opening; the exterior build shuts it.
if (FRAME === 'timber') {
  const side = (HW - DOOR_W / 2);
  for (const s of [1, -1])
    put(mbox(0.14, EAVE, side, M.wall, -HD, EAVE / 2,
             s * (DOOR_W / 2 + side / 2)));
  put(mbox(0.14, EAVE - DOOR_H, DOOR_W, M.wall, -HD,
           DOOR_H + (EAVE - DOOR_H) / 2, 0));
  // the lintel is a TIMBER beam, not a steel header
  put(box(0.30, 0.34, DOOR_W + 1.0, M.wood, -HD + 0.04, DOOR_H + 0.17, 0));
  const gable = new THREE.Shape();
  gable.moveTo(-HW, EAVE); gable.lineTo(HW, EAVE); gable.lineTo(0, RIDGE);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.wall);
  gm.rotation.y = -Math.PI / 2; gm.position.x = -HD;
  put(gm);
  // the leaf, its track, and the posts under the track's far end
  const LW = DOOR_W + 0.4;
  const parkZ = -(DOOR_W / 2 + LW / 2) + 1.0;   // clear, one metre on the jamb
  const leafZ = EXT ? 0 : parkZ;
  const tz0 = DOOR_W / 2 + 0.8, tz1 = parkZ - LW / 2 - 0.3;
  put(box(0.12, 0.14, tz0 - tz1, M.steelDark, -HD - 0.24, DOOR_H + 0.42,
          (tz0 + tz1) / 2));
  for (const pz of [tz1 + 0.15, (tz1 - HW) / 2])
    if (pz < -HW - 0.2)
      put(box(0.14, DOOR_H + 0.38, 0.14, M.wood, -HD - 0.24,
              (DOOR_H + 0.38) / 2, pz));
  {
    const g = new THREE.Group(); g.position.set(-HD - 0.15, 0, leafZ);
    g.add(mbox(0.08, DOOR_H + 0.12, LW, M.door, 0, (DOOR_H + 0.12) / 2, 0));
    // painted frame: sill and head channels, two stiles, and the Z-brace
    // every ledged leaf carries against racking
    g.add(box(0.10, 0.16, LW, M.doorTrim, -0.03, 0.10, 0),
          box(0.10, 0.18, LW, M.doorTrim, -0.03, DOOR_H - 0.02, 0));
    for (const e of [-1, 1])
      g.add(box(0.10, DOOR_H + 0.08, 0.18, M.doorTrim, -0.03,
                (DOOR_H + 0.08) / 2, e * (LW / 2 - 0.09)));
    const bl = Math.hypot(DOOR_H - 0.6, LW - 0.8);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.07, bl, 0.16),
                                 M.doorTrim);
    brace.position.set(-0.03, DOOR_H / 2, 0);
    brace.rotation.x = Math.atan2(LW - 0.8, DOOR_H - 0.6);
    brace.castShadow = brace.receiveShadow = true;
    g.add(brace);
    for (const o of [-0.35, 0, 0.35]) {               // hangers and rollers
      g.add(box(0.09, 0.30, 0.11, M.steelDark, -0.03, DOOR_H + 0.20, o * LW));
      const wl = cyl(0.08, 0.08, 0.05, M.steel, -0.03, DOOR_H + 0.38,
                     o * LW, 12);
      wl.rotation.x = Math.PI / 2; g.add(wl);
    }
    if (!EXT) {                                        // the wicket
      const wz = LW / 2 - 1.0;
      g.add(box(0.05, 2.05, 0.86, M.doorTrim, -0.07, 1.03, wz));
      g.add(box(0.04, 1.92, 0.76, M.door, -0.10, 1.02, wz));
      g.add(cyl(0.028, 0.028, 0.12, M.brass, -0.14, 1.02, wz - 0.30, 10));
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true;
                                      o.receiveShadow = true; } });
    G.add(g);
  }
  if (!EXT) {
    const day = new THREE.Mesh(
      new THREE.PlaneGeometry(DOOR_W + 1, DOOR_H + 0.6), M.daylight);
    day.rotation.y = Math.PI / 2;
    day.position.set(-HD - 3.0, DOOR_H / 2, 0);
    put(day);
    M.dayCardMesh = day;    // the caller hides it once a real sky stands
  }
} else {
  const side = (HW - DOOR_W / 2);
  for (const s of [1, -1])
    put(mbox(0.14, EAVE, side, M.wall, -HD, EAVE / 2, s * (DOOR_W / 2 + side / 2)));
  put(mbox(0.14, EAVE - DOOR_H, DOOR_W, M.wall, -HD, DOOR_H + (EAVE - DOOR_H) / 2, 0));
  // THE BRICK COURSE RUNS ROUND THE FRONT TOO (G66, user: "continue the
  // little brick part at the bottom of the wall on the front side of the
  // hangar too, it is missing"). It always has on the two side walls and,
  // since G41, on the back; the door wall was the one elevation that had
  // sheeting straight down to the slab. Only the two returns each side of the
  // opening get it — 2.5 m apiece here — because the rest of this wall is a
  // hole 25 m wide, and a stem across a doorway is a threshold, not a wall.
  for (const s2 of [1, -1])
    put(mbox(0.25, 1.1, side, M.stem, -HD, 0.55, s2 * (DOOR_W / 2 + side / 2)));
  const gable = new THREE.Shape();
  gable.moveTo(-HW, EAVE); gable.lineTo(HW, EAVE); gable.lineTo(0, RIDGE);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.wall);
  gm.rotation.y = -Math.PI / 2; gm.position.x = -HD;
  put(gm);
  // header beam and the track the leaves hang from
  put(box(0.5, 0.55, DOOR_W + 1.2, M.steel, -HD + 0.1, DOOR_H + 0.28, 0));
  put(box(0.22, 0.14, 2 * HW - 1, M.steelDark, -HD + 0.45, DOOR_H + 0.62, 0));
  // THE LEAVES. Three a side, and three TRACKS a side, because that is the only
  // way a door this wide opens: each leaf needs its own rail to pass in front of
  // its neighbour, so they nest at the jamb three deep. The x offsets below ARE
  // those rails — 0.24 m apart, which is what the rollers and the hangers take.
  // Parked open, so the outermost leaf of each stack is the one you see.
  for (let t = 0; t < 3; t++)
    put(box(0.22, 0.14, 2 * HW - 1, M.steelDark, -HD + 0.34 + t * 0.24, DOOR_H + 0.62, 0));
  // LEAF WIDTH IS A CONSEQUENCE, not a constant, once the doors have to shut.
  // 5.15 was chosen for the parked pose, where the leaves nest at the jamb and
  // their total width never has to add up to anything; six of them closed span
  // 30.9 m against a 25 m opening, so the outer pair would hang three metres
  // past the reveal. Closed, the width IS the opening over six.
  const LW = EXT ? DOOR_W / 6 : 5.15;
  for (const s of [1, -1]) for (let t = 0; t < 3; t++) {
    const x = -HD + 0.42 + (EXT ? 0 : t * 0.24);
    // PARKED, i.e. NESTED at the jamb: three leaves standing one behind another
    // in their own tracks, not spread across the opening. Each is 0.30 m further
    // in than the last, which is the stagger the hangers give.
    // CLOSED (EXT), they butt across the opening instead — the arithmetic the
    // back doors have used since G64, three leaves a side meeting at z = 0.
    const leafZ = EXT ? s * LW * (t + 0.5)
                      : s * (DOOR_W / 2 - LW / 2 - t * 0.30);
    const g = new THREE.Group(); g.position.set(x, 0, leafZ);
    // the skin, on its own material so the corrugation runs vertically like a
    // real door and not horizontally like the wall behind it
    g.add(mbox(0.10, DOOR_H, LW, M.door, 0, DOOR_H / 2, 0));
    // frame: sill channel, head channel, two stiles, and the diagonal brace
    // every sliding leaf carries against racking
    g.add(box(0.14, 0.18, LW, M.doorTrim, 0.01, 0.11, 0),
          box(0.14, 0.20, LW, M.doorTrim, 0.01, DOOR_H - 0.12, 0));
    for (const e of [-1, 1])
      g.add(box(0.14, DOOR_H, 0.20, M.doorTrim, 0.01, DOOR_H / 2, e * (LW / 2 - 0.10)));
    for (const k of [1, 2])                          // two intermediate rails
      g.add(box(0.13, 0.13, LW - 0.4, M.doorTrim, 0.01, k * DOOR_H / 3, 0));
    for (const [y0, y1] of [[0.3, DOOR_H / 3 - 0.1], [DOOR_H / 3 + 0.1, 2 * DOOR_H / 3 - 0.1]])
      put(strut([x + 0.02, y0, leafZ - LW / 2 + 0.3], [x + 0.02, y1, leafZ + LW / 2 - 0.3],
                0.03, M.steelDark));
    // hangers and rollers up top, guide shoe at the foot. Six meshes a leaf,
    // thirty-six across the door, all of them centimetres across: kept for the
    // room, where you stand next to them, dropped for the exterior.
    for (const o of EXT ? [] : [-1, 1]) {
      g.add(box(0.10, 0.34, 0.12, M.steelDark, 0.01, DOOR_H + 0.30, o * LW * 0.3));
      const w = cyl(0.09, 0.09, 0.05, M.steel, 0.01, DOOR_H + 0.52, o * LW * 0.3, 12);
      w.rotation.x = Math.PI / 2; g.add(w);
      g.add(box(0.16, 0.10, 0.14, M.steelDark, 0.01, 0.05, o * LW * 0.34));
    }
    // one leaf a side gets the wicket door everybody actually uses
    if (t === 0 && !EXT) {
      g.add(box(0.06, 2.05, 0.86, M.doorTrim, -0.06, 1.03, s * 0.9));
      g.add(box(0.05, 1.92, 0.76, M.door, -0.10, 1.02, s * 0.9));
      const knob = cyl(0.028, 0.028, 0.12, M.brass, -0.16, 1.02, s * 0.9 - s * 0.30, 10);
      g.add(knob);
    }
    G.add(g);
  }
  // the daylight itself: a bright card in the opening, which is what the
  // environment bake reads as a big soft source from that end
  // faces INTO the shed only: from outside it was a white card hanging in the
  // air beside the building
  if (!EXT) {
    const day = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W + 1, DOOR_H + 0.6), M.daylight);
    day.rotation.y = Math.PI / 2;
    day.position.set(-HD - 3.0, DOOR_H / 2, 0);
    put(day);
    M.dayCardMesh = day;    // the caller hides it once a real sky stands
  }
}

// the quarter turn the single alps sky was hung at, and the fallback for a row
// that carries no yaw of its own
const SKY_YAW0 = Math.PI / 2;

// THE SKY (G41, user: "we need a proper HDRI ... something to look at
// outside"; a SET of them at G62). A tone-mapped equirect on a backdrop
// sphere round the shed — visible through the door, the glazing band and
// the gable window. Unlit and unfogged (the room fog would eat it). The
// daylight CARD stays for the environment bake (it is the big soft source
// that bake reads); the caller hides it after baking so the eye gets the
// mountains instead — see app.js.
//
// ONE SPHERE, FIVE SKIES (G62). The picture is not built here any more: it
// belongs to the mood, and `setSky` swaps it. The rows come from
// hangar_sky.js, they decode one at a time (a 4k equirect is 33 MB of
// bitmap), and the outgoing texture is disposed — a mood cycled round the
// clock a dozen times must not leave a dozen of them on the GPU.
// THE GRADED SET IS THE ONLY SET (G62.6, user: "go, retire the kloppenheim
// set"). It arrived at G62.1 as a test area beside five delivered panoramas
// and it won on every count that was measured: one 8k picture plus a gain map
// serves every hour for 5.98 MB against 6.1 MB for six baked 4k ones, the GPU
// grade renders within noise of a plain texture fetch, and a new hour is a row
// of uniforms instead of another asset.
const SKY_ROWS = (typeof HANGAR_SKIES !== 'undefined' && HANGAR_SKIES &&
                  HANGAR_SKIES.length) ? HANGAR_SKIES : null;

// ---- THE RUNTIME GRADE (G62.2, user: "do the runtime shader version") -----
// The lab payload can arrive in either of two shapes and this room takes both.
// A row with `src` carries its own baked equirect; a row with `u` carries only
// UNIFORMS, and the picture is made on the GPU out of ONE base panorama plus a
// gain map that puts back the range its JPEG clipped. Six hours cost 2.2 MB
// that way against 6.1 MB of baked pictures, and a seventh costs one row.
//
// The GLSL is tools/sky_grade.py's own, carried in the payload: the offline
// grade and this one are a line-for-line pair, and the light rig every row
// quotes was MEASURED off the offline half. If the two ever drift the room is
// lit for a sky it is not showing, so they ship together out of one file.
const SKY_GRADE = (typeof HANGAR_SKY_GRADE !== 'undefined') ? HANGAR_SKY_GRADE : null;
let gradeScene = null, gradeMat = null, gradeCam = null, gradeReady = false;
let skyDirty = false;

// The sphere becomes a ShaderMaterial when the grade is live: the grade IS the
// texture lookup, so there is no intermediate picture to bake at full size.
// `tonemapping_fragment` and `encodings_fragment` are the two chunks
// MeshBasicMaterial would have run, included by hand because a raw
// ShaderMaterial gets neither and the backdrop would come out unmapped.
function makeGradeMaterial(forTarget) {
  const V3 = () => new THREE.Vector3(1, 1, 1);
  const u = {
    uBase: { value: null }, uGain: { value: null },
    uK: { value: 1 }, uGMax: { value: 1 }, uOutK: { value: 1 }, uPeak: { value: 1 },
    uSunU: { value: 0 }, uHB: { value: 0.026 }, uEcurve: { value: 1 },
    uSat: { value: 1 }, uExposure: { value: 1 },
    uSunG: { value: 1 }, uZenG: { value: 1 }, uHorG: { value: 1 },
    uGndG: { value: 1 }, uStarWarm: { value: 0 },
    uSunT: { value: V3() }, uZenT: { value: V3() }, uHorT: { value: V3() },
    uGndT: { value: V3() }, uSkyWT: { value: V3() }, uGndWT: { value: V3() },
    uGlowT: { value: new THREE.Vector3(0, 0, 0) },
    uSkyW: { value: new THREE.Vector2(1, 1) },
    uGndW: { value: new THREE.Vector2(1, 1) },
    uGlow: { value: new THREE.Vector4(0, 0, 1, 1) },
    uStar: { value: new THREE.Vector3(0, 0, 1) },
  };
  const NLc = String.fromCharCode(10);
  const tail = forTarget
    // the probe target holds bytes, so encode exactly as the baked JPEGs did
    ? 'gl_FragColor = vec4(fdL2S(c), 1.0);'
    // the backdrop hands display-linear to the renderer's own tone map
    : 'gl_FragColor = vec4(c, 1.0);' + NLc +
      '#include <tonemapping_fragment>' + NLc + '#include <encodings_fragment>';
  const vert = 'varying vec2 vUv;' + NLc + 'void main() {' + NLc + '  vUv = uv;' + NLc +
    (forTarget
      ? '  gl_Position = vec4(position.xy, 0.0, 1.0);'
      : '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);') +
    NLc + '}';
  const frag = 'varying vec2 vUv;' + NLc + SKY_GRADE.glsl + NLc +
    'void main() {' + NLc + '  vec3 c = fdSkyGrade(vUv, gl_FragCoord.xy);' + NLc +
    '  ' + tail + NLc + '}';
  return new THREE.ShaderMaterial({
    uniforms: u, side: forTarget ? THREE.FrontSide : THREE.BackSide,
    fog: false, depthWrite: !forTarget,
    vertexShader: vert, fragmentShader: frag,
  });
}

function gradeUniforms(mat, uu) {
  const U = mat.uniforms;
  const set3 = (k, v) => U[k].value.set(v[0], v[1], v[2]);
  U.uK.value = uu.k; U.uOutK.value = uu.outK; U.uPeak.value = uu.peak;
  U.uGMax.value = SKY_GRADE.gmax;
  U.uSunU.value = uu.sunU; U.uHB.value = uu.hb; U.uEcurve.value = uu.ecurve;
  U.uSat.value = uu.sat; U.uExposure.value = uu.exposure;
  U.uSunG.value = uu.sunG; U.uZenG.value = uu.zenG;
  U.uHorG.value = uu.horG; U.uGndG.value = uu.gndG;
  U.uStarWarm.value = uu.starWarm;
  set3('uSunT', uu.sunT); set3('uZenT', uu.zenT); set3('uHorT', uu.horT);
  set3('uGndT', uu.gndT); set3('uSkyWT', uu.skyWT); set3('uGndWT', uu.gndWT);
  set3('uGlowT', uu.glowT); set3('uStar', uu.star);
  U.uSkyW.value.set(uu.skyW[0], uu.skyW[1]);
  U.uGndW.value.set(uu.gndW[0], uu.gndW[1]);
  U.uGlow.value.set(uu.glow[0], uu.glow[1], uu.glow[2], uu.glow[3]);
}

// The two source pictures, decoded once and kept. Unlike the baked set there
// is only ever ONE panorama in memory, however many hours the game offers.
function gradeTextures() {
  if (gradeReady) return true;
  if (!SKY_GRADE || typeof Image === 'undefined' || !THREE.ShaderMaterial) return false;
  const mk = src => {
    const i = new Image();
    const t = new THREE.Texture(i);
    t.wrapS = THREE.RepeatWrapping;
    // BOTH are read RAW: the shader does its own sRGB decode on the base, and
    // the gain map is data rather than colour. Letting three decode either
    // would apply the transform twice.
    t.encoding = THREE.LinearEncoding;
    i.onload = () => { t.needsUpdate = true; skyDirty = true; if (skyOnReady) skyOnReady(); };
    i.src = src;
    return t;
  };
  gradeMat = { sphere: makeGradeMaterial(false), target: makeGradeMaterial(true) };
  const base = mk(SKY_GRADE.base), gain = mk(SKY_GRADE.gain);
  for (const m of [gradeMat.sphere, gradeMat.target]) {
    m.uniforms.uBase.value = base;
    m.uniforms.uGain.value = gain;
  }
  gradeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  gradeScene = new THREE.Scene();
  gradeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gradeMat.target));
  gradeReady = true;
  return true;
}

// The reflection probe needs the graded sky as a TEXTURE, because that is what
// PMREM reads. So the same shader is run once into a small target — small on
// purpose, since PMREM resamples to 256 and a full-size copy would cost 33 MB
// to gain nothing. What the EYE sees is not this: it is the sphere, graded per
// fragment at the base picture's own resolution.
let skyRT = null;
function renderSky(renderer) {
  if (!gradeReady || !renderer || !renderer.setRenderTarget) return null;
  if (!skyRT && THREE.WebGLRenderTarget) {
    skyRT = new THREE.WebGLRenderTarget(1024, 512, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping, generateMipmaps: false,
    });
    skyRT.texture.encoding = THREE.sRGBEncoding;   // the shader writes sRGB bytes
  }
  if (!skyRT) return null;
  const was = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
  renderer.setRenderTarget(skyRT);
  renderer.render(gradeScene, gradeCam);
  renderer.setRenderTarget(was);
  skyDirty = false;
  return skyRT.texture;
}

// WHICH WAY THE SKY IS MADE (G62.3, user: "can we have the GPU version as an
// option, and the precomputed as the other option?"). 'gpu' grades the one
// base panorama per fragment; 'baked' hangs the picture the offline grade
// already wrote. A row in the lab payload carries both, so this is a live
// switch and the two can be compared on the same frame - which is the only
// way to judge either the performance or the look.
let skyMode = 'gpu';
let skyMatBaked = null, skyMat = null, skyMesh = null, skyOnReady = null;
if (!EXT && SKY_ROWS && THREE.MeshBasicMaterial && THREE.SphereGeometry) {
  skyMatBaked = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
  skyMat = gradeTextures() ? gradeMat.sphere : skyMatBaked;
  // radius 600 (G44): far enough that the field and strip below never
  // poke through; the 4k equirect carries the extra screen coverage
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), skyMat);
  skyMesh.scale.x = -1;           // equirect reads right-way-round inside
  skyMesh.rotation.y = SKY_YAW0;  // per row; see setSky
  put(skyMesh);
}
function setSky(row) {
  if (!skyMat || !row) return;
  // pick the path this row can actually serve, then hang the right material
  const useGpu = skyMode === 'gpu' && row.u && gradeReady;
  skyMat = useGpu ? gradeMat.sphere : skyMatBaked;
  if (skyMesh) skyMesh.material = skyMat;
  // WHICH WAY THE PANORAMA FACES is the row's, not the room's (G62). It used
  // to be a fixed quarter turn chosen to frame the alps' mountains out of the
  // door; each sky now carries the yaw that puts ITS sun where the row asked
  // for it (tools/sky_prep.py solves it from the measured sun and a wanted
  // offset off the door axis), and the alps' number is exactly the quarter
  // turn it always had.
  if (skyMesh) skyMesh.rotation.y = (row.yaw !== undefined) ? row.yaw : SKY_YAW0;
  // THE GRADED PATH: nothing to swap, just a new set of uniforms. The
  // reflection target stays stale until someone hands us a renderer - see
  // `renderSky`, which app.js calls straight after a mood changes.
  if (useGpu) {
    gradeUniforms(gradeMat.sphere, row.u);
    gradeUniforms(gradeMat.target, row.u);
    skyDirty = true;
    return;
  }
  if (typeof row.img !== 'function') return;
  const img = row.img();
  if (!img) return;
  const st = new THREE.Texture(img);
  st.encoding = THREE.sRGBEncoding;
  // the data URI decodes asynchronously; whoever baked an environment off
  // the old picture is told when the new one has actually landed
  const ok = () => { st.needsUpdate = true; if (skyOnReady) skyOnReady(); };
  if (img.complete && img.naturalWidth) ok();
  else img.addEventListener('load', ok);
  const was = skyMat.map;
  skyMat.map = st;
  skyMat.needsUpdate = true;      // a material that gains a map recompiles
  if (was && was.dispose) was.dispose();
}

// ===========================================================================
// THE OUTDOORS — the SITE, seen from the door (G123)
// ===========================================================================
// What stood here was the G44 "quick runway": a 500 m plane of one 512 canvas
// tile at 9 m pitch, a 26 x 30 slab of flat colour with no map at all, and a
// 320 x 24 strip pointing straight OUT of the door on the same axis. Its own
// header named the destination and parked it — "the honest destination is the
// GAME's own scenery seen from the hangar (the P11 consistency goal)".
//
// This is that. Every surface below is placed from src/core/25_airfield.js,
// through siteToLocal, so the apron you taxi off in the world and the apron
// you are looking at through this door are one rectangle. The runway is the
// registry's HOME record, which puts it ACROSS the view at fifty metres with
// its threshold nearly abeam the shed — because the hangar was always meant to
// stand beside the strip, near one end, not on the end of it.
//
// The user, 2026-08-31: "The runway is usually perpendicular to the hangar.
// The hangar is put on the side of the runway, usually at an extremity."
if (!EXT) {
  // the HOME record is handed in rather than looked up: hangar.js has no world
  // and building one to read four numbers would be absurd. No record, no
  // strip — the same ask-don't-assume the prop library and the sky payload use.
  const HOME = (opts && opts.home) || null;
  const SITE = (typeof siteOf === 'function') ? siteOf('HOME') : null;
  const R = (HOME && typeof siteRunway === 'function') ? siteRunway(HOME) : null;
  const HGR = SITE ? SITE.hangar : null;

  // ---- world rect -> the shed's own frame ---------------------------------
  const L = r => {
    const a = siteToLocal(r.x0, r.z0, HGR), b = siteToLocal(r.x1, r.z1, HGR);
    return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x),
             z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
  };
  const LP = (x, z) => siteToLocal(x, z, HGR);

  // ---- THE LIBRARY MATERIALS ---------------------------------------------
  // The ground wears scanned sets now (assets/airfield -> site_tex.js), and
  // wears them through the SAME LIB/PARTS wardrobe the walls use, so any of
  // these four surfaces can be re-dressed from the editor. What is built here
  // is each surface's DEFAULT; the canvas sheets stay as the fallback for a
  // payload-less build, exactly as the floor slab does.
  const ANISO = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
  // ENV INTENSITY IS AUTHORED LOW OUT HERE, and the number is not cosmetic.
  // The room's environment is a cube probe baked INSIDE the shed — warm sheet
  // steel, warm lamps, a warm floor — and setMood then scales every material's
  // envMapIntensity by env/0.55, which is 2.2x on the afternoon row. A neutral
  // concrete slab standing in daylight was picking up 2.2x of a warm interior
  // and rendering brown: measured at RGB(90,73,53) against an albedo whose own
  // mean is (104,94,83). Authoring 0.45 lands these near 1.0 after the mood
  // scaling, so the sun leads and the room only tints.
  //
  // This is the near half of ROADMAP F4's open item — "the procedural grass and
  // strip outside the door are lit by the room's lights rather than by the
  // sky's own ground". It is not closed here; it is stopped from being loud.
  const ENV_OUT = 0.45;
  const gmat = (key, tile, fallback, extra) => {
    const o = Object.assign({ roughness: 1, metalness: 0, fog: false,
                              envMapIntensity: ENV_OUT }, extra || {});
    const maps = siteGroundMaps(THREE, key, tile, ANISO);
    if (maps) Object.assign(o, maps);
    else if (fallback) { o.map = fallback; }
    return outdoor(new THREE.MeshStandardMaterial(o));
  };

  // canvas fallbacks, kept from G44 so a payload-less build still stands
  const grassAlb = sheet(512, 512, (g, W2, H2) => {
    g.fillStyle = '#6d7c4e'; g.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 2600; i++) {
      g.globalAlpha = rr(0.04, 0.14);
      g.fillStyle = rand() < 0.5 ? '#5c6b40' : '#87925c';
      g.beginPath(); g.arc(rand() * W2, rand() * H2, rr(2, 14), 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }, false);
  grassAlb.repeat.set(1 / 9, 1 / 9);
  const concAlb = sheet(512, 512, (g, W2, H2) => {
    g.fillStyle = '#9a958a'; g.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 1400; i++) {
      g.globalAlpha = rr(0.03, 0.10);
      g.fillStyle = rand() < 0.5 ? '#b3ada0' : '#7d786f';
      g.beginPath(); g.arc(rand() * W2, rand() * H2, rr(3, 26), 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }, false);
  concAlb.repeat.set(1 / 4, 1 / 4);

  M.grass = gmat('grass005', 2, grassAlb, { roughness: 0.96 });
  M.strip = gmat('grass004', 2, grassAlb, { roughness: 0.95 });
  M.apron = gmat('brushed', 2, concAlb, { roughness: 0.92, metalness: 0.02 });
  M.taxi  = gmat('cracked', 4, concAlb, { roughness: 0.94, metalness: 0.02 });

  // ---- THE MACRO BREAK-UP -------------------------------------------------
  // A 2 m grass tile across a 700 m field repeats 350 times, and no amount of
  // scan quality hides that: the eye reads the PERIOD, not the pixels. A second
  // sampler at 180 m multiplies the albedo, so the field gets dry patches and
  // mowing drift at a scale the tile cannot carry.
  //
  // It has to be an onBeforeCompile injection because r128 has ONE uv transform
  // per material, taken from .map — every map on a material shares one repeat,
  // so a second scale is unreachable any other way. vUv arrives already
  // transformed, so the macro coordinate is carried from the raw `uv` attribute
  // on its own varying. Same technique as aeroskin.js's structure sampler.
  const macroTex = sheet(256, 256, (g, W2, H2) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 260; i++) {
      g.globalAlpha = rr(0.05, 0.20);
      g.fillStyle = rand() < 0.5 ? '#5a5a5a' : '#b4b4b4';
      g.beginPath(); g.arc(rand() * W2, rand() * H2, rr(10, 70), 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }, true);
  const NL = String.fromCharCode(10);
  const macroise = (mat, metres, amount) => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uMacro = { value: macroTex };
      sh.uniforms.uMacroK = { value: 1 / metres };
      sh.uniforms.uMacroA = { value: amount };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>',
                 '#include <common>' + NL + 'varying vec2 vMacroUv;')
        .replace('#include <uv_vertex>',
                 '#include <uv_vertex>' + NL + '  vMacroUv = uv;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>',
                 '#include <common>' + NL + 'varying vec2 vMacroUv;' + NL +
                 'uniform sampler2D uMacro;' + NL +
                 'uniform float uMacroK;' + NL + 'uniform float uMacroA;')
        .replace('#include <map_fragment>',
                 '#include <map_fragment>' + NL +
                 '  { float m = texture2D(uMacro, vMacroUv * uMacroK).r;' + NL +
                 '    diffuseColor.rgb *= mix(1.0, m * 2.0, uMacroA); }');
    };
    // r128 caches programs on the hook SOURCE, so two materials with the same
    // injection share a program — but only if the key says so.
    mat.customProgramCacheKey = () => 'site-macro-' + metres + '-' + amount;
  };
  macroise(M.grass, 180, 0.55);
  macroise(M.strip, 90, 0.30);

  // ---- helpers ------------------------------------------------------------
  // metric uvs, like the floor: one texture tile is `tile` metres of ground,
  // and the tile size becomes a live control in the editor on top of it.
  const metricUV = (geo, w, d) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
    uv.needsUpdate = true;
    return geo;
  };
  // a flat rect in the local frame, wound to face up
  const pad = (r, y, mat) => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const g = metricUV(new THREE.PlaneGeometry(w, d), w, d);
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
    m.receiveShadow = true;
    put(m);
    return m;
  };
  // THE SLAB HAS A THICKNESS. The old apron was a plane at y = -0.01 with the
  // grass 4 cm under it, which reads as paint rather than concrete: there is no
  // edge to catch the light and nothing to cast the little shadow that tells
  // you a slab is a slab. Four kerb quads is the whole difference.
  const kerb = (r, top, drop, mat) => {
    const q = (a, b, c, d2) => put(quad(a, b, c, d2, mat, 2));
    const y0 = top, y1 = top - drop;
    q([r.x0, y0, r.z0], [r.x0, y0, r.z1], [r.x0, y1, r.z1], [r.x0, y1, r.z0]);
    q([r.x1, y0, r.z1], [r.x1, y0, r.z0], [r.x1, y1, r.z0], [r.x1, y1, r.z1]);
    q([r.x1, y0, r.z0], [r.x0, y0, r.z0], [r.x0, y1, r.z0], [r.x1, y1, r.z0]);
    q([r.x0, y0, r.z1], [r.x1, y0, r.z1], [r.x1, y1, r.z1], [r.x0, y1, r.z1]);
  };
  // paint: a coplanar decal, lifted and depth-write-free. The renderer runs a
  // LOGARITHMIC depth buffer (app.js), under which coplanar surfaces z-fight
  // whatever the offset — the world's own airfield block learned this and its
  // fix is the one copied here.
  let paintOrder = 40;
  const paint = (x0, z0, x1, z1, col, y, op) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)),
      new THREE.MeshBasicMaterial({ color: col, transparent: op !== undefined,
        opacity: op === undefined ? 1 : op, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.renderOrder = paintOrder++;
    put(m);
    return m;
  };

  // ---- heights ------------------------------------------------------------
  // Everything outside is stacked below the shed floor at y = 0, far enough
  // apart that nothing z-fights and close enough that the door sill is a step
  // rather than a kerb: apron -0.02, taxiway -0.04, strip -0.085, field -0.10.
  const Y_APRON = -0.02, Y_TAXI = -0.04, Y_STRIP = -0.085, Y_FIELD = -0.10;
  const SLAB = 0.22;

  // ---- THE HORIZON ROLL-OFF (G44.2, kept) ---------------------------------
  // The ground curves down past r0 = 160 m so its edge rolls under the sky
  // sphere's horizon and there is no seam to see from the door. Everything
  // outdoors carries fog:false: the room fog is tinted to the mood's dark
  // INTERIOR colour and would eat the field.
  const R0 = 160, KDROP = 3.5e-4;
  const rollOff = (geo, posX, posZ) => {
    const p2 = geo.attributes.position;
    for (let i = 0; i < p2.count; i++) {
      const wx = p2.getX(i) + posX, wz = -p2.getY(i) + posZ;
      const r = Math.hypot(wx, wz);
      if (r > R0) p2.setZ(i, p2.getZ(i) - KDROP * (r - R0) * (r - R0));
    }
    p2.needsUpdate = true;
    geo.computeVertexNormals();
  };

  // ---- THE FIELD ----------------------------------------------------------
  // 700 m, centred so it carries the strip out to where the roll-off hides it.
  const FCX = -150, FCZ = 60, FS = 700;
  const fgeo = metricUV(new THREE.PlaneGeometry(FS, FS, 40, 40), FS, FS);
  rollOff(fgeo, FCX, FCZ);
  const field = new THREE.Mesh(fgeo, M.grass);
  field.rotation.x = -Math.PI / 2;
  field.position.set(FCX, Y_FIELD, FCZ);
  field.receiveShadow = true;
  put(field);

  // ---- THE STRIP ----------------------------------------------------------
  if (R && SITE) {
    // only the part of it the door can see: past ~330 m the roll-off has taken
    // it under the horizon anyway, and 1100 m of geometry to show 300 is waste.
    // only the part of it the door can see: past ~340 m the roll-off has taken
    // it under the horizon anyway, and 1100 m of geometry to show 340 is waste.
    const SEEN = 340;
    const a = LP(R.end0.x, R.cz - R.half), b = LP(R.end0.x, R.cz + R.half);
    const sx0 = Math.min(a.x, b.x), sx1 = Math.max(a.x, b.x);
    const sz0 = Math.min(a.z, b.z);
    const SW = sx1 - sx0, SCX = (sx0 + sx1) / 2, SCZ = sz0 + SEEN / 2;

    // THE STRIP IS MOWN GRASS WITH PAINT ON IT, in two layers, and that is not
    // a detail. One layer — a canvas of green with the markings drawn into it —
    // is a PICTURE of a runway: it cannot carry the scanned grass the rest of
    // the field wears, so the strip reads as a flat painted band laid on a
    // textured meadow, which is exactly how the first cut of this looked.
    const sBase = new THREE.PlaneGeometry(SW, SEEN);
    sBase.rotateX(-Math.PI / 2);
    metricUV(sBase, SW, SEEN);
    const strip = new THREE.Mesh(sBase, M.strip);
    strip.position.set(SCX, Y_STRIP, SCZ);
    strip.receiveShadow = true;
    put(strip);

    // THE MARKINGS, on their own plane, with UVS COMPUTED PER VERTEX rather
    // than by a texture transform. The first cut turned the canvas with
    // `rotation = PI/2` plus a repeat and an offset, and the markings vanished:
    // three composes that transform as translate(offset)·translate(centre)·
    // rotate·scale(repeat)·translate(-centre), so the rotation and the window
    // do not commute the way writing them one after another suggests. Reading
    // each vertex back into the runway's own frame has no such ambiguity, and
    // it works for any heading the record might carry.
    const sMark = new THREE.PlaneGeometry(SW, SEEN);
    sMark.rotateX(-Math.PI / 2);
    { const uv = sMark.attributes.uv, po = sMark.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const Wp = siteToWorld(SCX + po.getX(i), SCZ + po.getZ(i), HGR);
        const t = (Wp.x - R.end1.x) * -R.dx + (Wp.z - R.end1.z) * -R.dz;
        const ac = (Wp.x - R.cx) * R.nx + (Wp.z - R.cz) * R.nz;
        uv.setXY(i, t / R.len, (ac + R.wid / 2) / R.wid);
      }
      uv.needsUpdate = true; }
    const RWc = 2048, RHc = 128;
    const cv = document.createElement('canvas'); cv.width = RWc; cv.height = RHc;
    sitePaintStrip(cv.getContext('2d'), R, RWc, RHc, true);   // marks only
    const stex = new THREE.CanvasTexture(cv);
    stex.encoding = THREE.sRGBEncoding;
    stex.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
    stex.wrapS = stex.wrapT = THREE.ClampToEdgeWrapping;
    const marks = new THREE.Mesh(sMark, new THREE.MeshBasicMaterial({
      map: stex, transparent: true, depthWrite: false, fog: false }));
    marks.position.set(SCX, Y_STRIP + 0.01, SCZ);
    marks.renderOrder = 30;
    put(marks);

    // ---- THE APRON ------------------------------------------------------
    const ap = L(SITE.apron);
    pad(ap, Y_APRON, M.apron);
    kerb(ap, Y_APRON, SLAB, M.apron);
    // SAW-CUT JOINTS on a 5 m grid, the way a slab that size is actually
    // poured and cut. They are what makes the eye read SIZE off the concrete.
    for (let x = ap.x0 + 5; x < ap.x1 - 0.5; x += 5)
      paint(x - 0.02, ap.z0, x + 0.02, ap.z1, 0x2b2823, Y_APRON + 0.004, 0.55);
    for (let z = ap.z0 + 5; z < ap.z1 - 0.5; z += 5)
      paint(ap.x0, z - 0.02, ap.x1, z + 0.02, 0x2b2823, Y_APRON + 0.004, 0.55);
    // the slot drain across the door line, and the lead-in the aeroplane
    // follows out to the taxiway
    paint(ap.x1 - 1.4, -DOOR_W / 2, ap.x1 - 1.1, DOOR_W / 2, 0x1d1b18, Y_APRON + 0.005, 0.85);
    const tx = L(SITE.taxiway);
    const lead = (tx.z0 + tx.z1) / 2;
    paint(ap.x0, -0.09, ap.x1, 0.09, 0xd8bd4a, Y_APRON + 0.006, 0.9);
    paint(ap.x0 - 0.02, Math.min(0, lead), ap.x0 + 0.16, Math.max(0, lead),
          0xd8bd4a, Y_APRON + 0.006, 0.9);
    // tie-down rings, from the declaration
    const ringGeo = new THREE.TorusGeometry(0.22, 0.05, 6, 10);
    for (const rg of SITE.clutter.rings) {
      const q2 = LP(rg[0], rg[1]);
      const m = new THREE.Mesh(ringGeo, M.steel);
      m.position.set(q2.x, Y_APRON + 0.02, q2.z);
      m.rotation.x = Math.PI / 2;
      m.castShadow = true;
      put(m);
    }

    // ---- THE TAXIWAY, which now actually reaches the strip ---------------
    pad(tx, Y_TAXI, M.taxi);
    kerb(tx, Y_TAXI, SLAB - 0.04, M.taxi);
    for (let z = tx.z0 + 3; z < tx.z1 - 1; z += 6)
      paint((tx.x0 + tx.x1) / 2 - 0.09, z, (tx.x0 + tx.x1) / 2 + 0.09, z + 3,
            0xd8bd4a, Y_TAXI + 0.006, 0.85);
  }

  // ---- THE FURNITURE ------------------------------------------------------
  // All of it from the declaration, so the middle distance out of this door is
  // the middle distance you taxi through.
  if (SITE) {
    const lam = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85,
      metalness: 0, fog: false });
    const wallM = lam(0xcbb79a), roofM = lam(0x9c5f43), trimM = lam(0x6d5744);
    for (const b of SITE.buildings) {
      const c = LP(b.x, b.z);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(b.d, b.h, b.w),
        b.trim ? trimM : wallM);
      body.position.y = b.h / 2;
      const rr2 = b.d * 0.60;
      const rg = new THREE.CylinderGeometry(rr2, rr2, b.w * 1.05, 3, 1);
      rg.rotateY(Math.PI / 2);
      const roof = new THREE.Mesh(rg, roofM);
      roof.position.y = b.h + rr2 * 0.5 - 0.02;
      g.add(body); g.add(roof);
      g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
      g.position.set(c.x, Y_FIELD, c.z);
      g.rotation.y = -b.ry;
      put(g);
    }
    // the windsock: the one thing on an airfield that tells you it is working
    const wc = LP(SITE.windsock.x, SITE.windsock.z);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, SITE.windsock.h), lam(0xd8d2c4));
    pole.position.set(wc.x, Y_FIELD + SITE.windsock.h / 2, wc.z);
    pole.castShadow = true;
    put(pole);
    const sockM = lam(0xe4622e); sockM.side = THREE.DoubleSide;
    const sock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.35, 2.6, 10, 1, true), sockM);
    sock.position.set(wc.x - 1.3, Y_FIELD + SITE.windsock.h - 0.5, wc.z);
    sock.rotation.z = Math.PI / 2;
    sock.castShadow = true;
    put(sock);
    // the boundary, in runs, with the taxiway's gate left open
    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, SITE.fence.h);
    const postM = lam(0x8a7457);
    for (const run of SITE.fence.runs)
      for (let x = Math.max(run[0], run[1]); x >= Math.min(run[0], run[1]);
           x -= SITE.fence.step) {
        const c = LP(x, SITE.fence.z);
        if (Math.abs(c.z) > 200) continue;         // past the roll-off
        const m = new THREE.Mesh(postGeo, postM);
        m.position.set(c.x, Y_FIELD + SITE.fence.h / 2, c.z);
        m.castShadow = true;
        put(m);
      }
    // the windbreak behind the shed, seen through the back doors and the gable
    const T = SITE.trees;
    const tg = new THREE.ConeGeometry(T.r, T.h, 7); tg.translate(0, T.h / 2, 0);
    const tm = lam(0x4a6129);
    for (let x = T.x1; x >= T.x0; x -= T.step) {
      const c = LP(x + (x % 3) * 0.6, T.z + (x % 5) * 0.7);
      const t = new THREE.Mesh(tg, tm);
      t.position.set(c.x, Y_FIELD, c.z);
      t.scale.setScalar(0.85 + (x % 7) / 9);
      t.castShadow = true;
      put(t);
    }
    // the runway's edge boards, near enough to be read
    if (R) {
      const mg = new THREE.BoxGeometry(1.6, 0.7, 0.5);
      const mm = lam(0xe4dccb);
      for (const P of siteMarkers(HOME)) {
        const c = LP(P.x, P.z);
        if (c.z > 340 || c.z < -40) continue;
        const m = new THREE.Mesh(mg, mm);
        m.position.set(c.x, Y_FIELD + 0.35, c.z);
        m.castShadow = true;
        put(m);
      }
    }
  }

  // ---- THE TUFTS ----------------------------------------------------------
  // "there are no grass sprites, so it looks like a big green model" (the user).
  // A ground texture, however good, is a picture of grass on a flat plane, and
  // at the grazing angle you see a field from a doorway it reads as exactly
  // that. What breaks it is PARALLAX: things standing up, occluding each other.
  //
  // The blade atlas, the crossed-quad geometry, the scatter and the instancing
  // all live in site_ground.js now, because the WORLD grows the same grass
  // round the same apron — see render_world.js. What is decided here is only
  // what belongs to this room: where a tuft may not stand, and how it is lit.
  if (THREE.InstancedMesh && SITE) {
    const tuftMat = outdoor(new THREE.MeshStandardMaterial({
      map: siteBladeTexture(THREE, rand, ANISO),
      alphaTest: 0.42, side: THREE.FrontSide,
      roughness: 0.92, metalness: 0, fog: false, envMapIntensity: ENV_OUT }));

    // where a tuft may NOT stand: the paving, the strip, and the shed itself
    const blocks = [L(SITE.apron), L(SITE.taxiway),
                    { x0: -HD - 0.5, x1: HD + 0.5, z0: -HW - 0.5, z1: HW + 0.5 }];
    if (R) {
      const a = LP(R.end0.x, R.cz - R.half), b = LP(R.end1.x, R.cz + R.half);
      blocks.push({ x0: Math.min(a.x, b.x) - 1, x1: Math.max(a.x, b.x) + 1,
                    z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) });
    }
    // measured from the door mouth, which is where the eye is
    const rows = siteScatter(rand, {
      count: 9000, radius: 62, near: 30, blocks: blocks,
      cx: -HD, cz: 0, x0: -95, x1: 26, z0: -62, z1: 78,
    });
    put(siteTufts(THREE, rows, tuftMat, Y_FIELD - 0.02));
  }
}

// ---- roof: portal trusses, purlins, deck, roof lights ---------------------
// where the roof lights ended up, published for the dust shafts below the
// exterior return — which used to keep their own copy of the positions and
// drifted the moment the count became a parameter (HANGARS S3)
let ROOFLIGHTS = { n: 0, x: () => 0 };
{
  // THE PORTAL FRAME IS INTERIOR STRUCTURE. Seven trusses at fourteen meshes
  // each, plus fourteen purlins, is 112 draw calls standing entirely behind a
  // solid deck and a shut door.
  //
  // THE COUNT FOLLOWS THE DEPTH (HANGARS S3). It was a fixed seven — only the
  // SPACING stretched, so the works shed at twice the depth would have stood
  // its trusses eight metres apart, which is not a bigger building, it is the
  // same building pulled like taffy. One bay per ~4.2 m reproduces the seven
  // the club was drawn with and gives the works its eleven.
  // TIMBER (HANGARS S4): no portal, no trusses. Posts up the walls, a tie
  // across at each station, a rafter pair to the ridge and a knee brace
  // into each corner — post-and-beam, closer-spaced than steel because a
  // 150 mm post is not a portal stanchion. Interior structure, like the
  // trusses: the exterior build sees boards and a roof.
  if (FRAME === 'timber' && !EXT) {
    const NR = Math.max(4, 1 + Math.round(2 * HD / 2.25));
    for (let i = 0; i < NR; i++) {
      const x = -HD + 0.5 + (2 * HD - 1.0) * i / (NR - 1);
      put(strut([x, EAVE, -HW], [x, RIDGE - 0.04, 0], 0.07, M.beamMain, 6),
          strut([x, EAVE, HW], [x, RIDGE - 0.04, 0], 0.07, M.beamMain, 6),
          strut([x, EAVE - 0.06, -HW], [x, EAVE - 0.06, HW], 0.06,
                M.beamMain, 6));
      for (const s of [1, -1]) {
        put(box(0.15, EAVE, 0.15, M.beamMain, x, EAVE / 2, s * (HW - 0.10)));
        put(strut([x, EAVE - 1.0, s * (HW - 0.14)],
                  [x, EAVE - 0.08, s * (HW - 1.15)], 0.05, M.beamMain, 6));
      }
    }
    // the top plate the rafters bear on, along each eave
    for (const s of [1, -1])
      put(box(2 * HD, 0.14, 0.14, M.beamMain, 0, EAVE - 0.02, s * (HW - 0.10)));
  }
  const NT = (EXT || FRAME === 'timber')
    ? 0 : Math.max(4, 1 + Math.round(2 * HD / 4.2));
  for (let i = 0; i < NT; i++) {
    const x = -HD + 0.6 + (2 * HD - 1.2) * i / (NT - 1);
    // top chords to the ridge, bottom tie, king post, web diagonals —
    // the MAIN BEAMS of the part system (G41), on their own material
    put(strut([x, EAVE, -HW], [x, RIDGE, 0], 0.10, M.beamMain, 6),
        strut([x, EAVE, HW], [x, RIDGE, 0], 0.10, M.beamMain, 6),
        strut([x, EAVE - 0.05, -HW], [x, EAVE - 0.05, HW], 0.085, M.beamMain, 6),
        strut([x, EAVE, 0], [x, RIDGE - 0.1, 0], 0.06, M.beamMain, 6));
    for (const s of [1, -1]) for (const f of [0.34, 0.67]) {
      const zt = s * HW * f, yt = EAVE + (RIDGE - EAVE) * (1 - f);
      put(strut([x, EAVE, zt], [x, yt, zt], 0.045, M.beamMain, 6));
      put(strut([x, EAVE, s * HW * (f - 0.33)], [x, yt, zt], 0.04, M.beamMain, 6));
    }
    // stanchion down the wall, so the frame reads as a portal
    for (const s of [1, -1]) put(box(0.34, EAVE, 0.30, M.beamMain, x, EAVE / 2, s * (HW - 0.3)));
  }
  // THE SLOPE, as one function. Every roof surface, opening, pane and glazing
  // bar is placed through it, so none of them can drift out of the plane.
  const slopeP = (s, x, t) =>
    [x, RIDGE + (EAVE - RIDGE) * t, s * (HW + 0.5) * t];
  // roof lights at the club's own rhythm too (HANGARS S3): four per slope at
  // HD 12.5, one more per ~3 m of extra depth
  const LT0 = 0.30, LT1 = 0.62, LHW = 1.8;
  // ...and the timber shed has NONE: with zero openings the deck below
  // emits its three bands as one unbroken slope, and the rooflight loop
  // never runs. Its daylight is the door and the two flank windows — a
  // field shed IS dimmer than a glazed club hangar, and that is character,
  // not a defect.
  const NLIGHT = FRAME === 'timber' ? 0
    : Math.max(2, Math.round(2 * HD / 6.25));
  const lightX = k => -HD + 3.4 + k * (2 * HD - 6.8) / (NLIGHT - 1);
  ROOFLIGHTS = { n: NLIGHT, x: lightX };
  // purlins and the deck underside — the SECONDARY BEAMS (G41)
  for (const s of [1, -1]) {
    for (let k = 0; k <= 6 && !EXT; k++) {
      const f = k / 6, z = s * HW * f, y = EAVE + (RIDGE - EAVE) * (1 - f) - 0.14;
      put(box(2 * HD - 1, 0.14, 0.10, M.beamSec, 0, y, z));
    }
    // ridge to eave, running the full depth. Wound so the normal faces DOWN
    // into the shed, which is the side anything in here can see.
    // THE DECK IS CUT FOR THE ROOF LIGHTS (G55, user: "the top windows could
    // also be properly cut plus a semi transparent surface and an
    // outline/chassis"). It used to be ONE quad per slope with four glowing
    // panels laid on top of it — a picture of a roof light, not a hole, and
    // the same mistake the side glazing had before G52. Now the slope is
    // emitted as a grid with the four openings missing from it, so what is
    // behind a roof light is the sky.
    //
    // t runs 0 at the ridge to 1 at the eave, and EVERYTHING on this slope —
    // deck, opening, glazing, frame — is placed through the same slopeP, so a
    // roof light cannot end up in a different plane from the hole it is in.
    const SLOPE = Math.hypot(RIDGE - EAVE, HW + 0.5), RW = 2 * HD + 0.6;
    const SX0 = -HD - 0.3, SX1 = HD + 0.3;
    const deck = (x0, x1, t0, t1) => {
      const a = slopeP(s, x0, t0), b = slopeP(s, x1, t0),
            c = slopeP(s, x1, t1), d = slopeP(s, x0, t1);
      const uv = [(x1 - x0) / RW * RW, (t1 - t0) * SLOPE];
      put(s > 0 ? quad(a, b, c, d, M.roofIn, uv) : quad(b, a, d, c, M.roofIn, uv));
      put(s > 0 ? quad(d, c, b, a, M.roofOut, 6) : quad(c, d, a, b, M.roofOut, 6));
    };
    deck(SX0, SX1, 0, LT0);                       // above the openings
    deck(SX0, SX1, LT1, 1);                       // below them
    let xc = SX0;                                 // and the piers between them
    for (let k = 0; k < NLIGHT; k++) {
      deck(xc, lightX(k) - LHW, LT0, LT1);
      xc = lightX(k) + LHW;
    }
    deck(xc, SX1, LT0, LT1);
  }
  put(box(2 * HD, 0.3, 0.7, M.beamSec, 0, RIDGE + 0.05, 0));
  // ROOF LIGHTS. Four openings down each slope — the reason the middle of a
  // hangar is not a cave, and the softest light in the scene. Each is a hole in
  // the deck (above), a semi-transparent pane sitting in it, a kerb round its
  // edge and two bars across: the frame is what makes a rooflight read as a
  // fitting rather than as a rectangle of brighter roof.
  for (const s of [1, -1]) for (let k = 0; k < NLIGHT; k++) {
    const x = lightX(k);
    const P = (dx, t) => slopeP(s, x + dx, t);
    // the pane, a hair below the deck plane so it never z-fights the kerb
    const drop = v => [v[0], v[1] - 0.02, v[2]];
    const a = drop(P(-LHW, LT0)), b = drop(P(LHW, LT0)),
          c = drop(P(LHW, LT1)), d = drop(P(-LHW, LT1));
    // FROM OUTSIDE A ROOF LIGHT IS GLASS, NOT A HOLE. M.skyPanel is an
    // emissive card - the right thing seen from the floor of a dim shed, and
    // from above in daylight it reads as a square cut out of the roof. The
    // exterior build glazes them instead.
    if (EXT && !M.skyPanelExt)
      M.skyPanelExt = new THREE.MeshStandardMaterial({
        color: 0x9fb4c2, roughness: 0.16, metalness: 0.0,
        transparent: true, opacity: 0.72 });
    const PM = EXT ? M.skyPanelExt : M.skyPanel;
    const p = s > 0 ? quad(a, b, c, d, PM) : quad(b, a, d, c, PM);
    p.castShadow = false;
    put(p);
    // THE KERB: a flat band inside the opening's edge, all four sides. Drawn as
    // quads in the slope's own plane rather than as boxes, because a box on a
    // sloping plane needs a rotation to be got wrong.
    const KX = 0.16, KT = 0.022, up = v => [v[0], v[1] + 0.015, v[2]];
    const band = (x0, x1, t0, t1) => {
      const q = [up(P(x0, t0)), up(P(x1, t0)), up(P(x1, t1)), up(P(x0, t1))];
      put(s > 0 ? quad(q[0], q[1], q[2], q[3], M.steelDark, 2)
                : quad(q[1], q[0], q[3], q[2], M.steelDark, 2));
    };
    band(-LHW, LHW, LT0, LT0 + KT);               // head
    band(-LHW, LHW, LT1 - KT, LT1);               // sill
    band(-LHW, -LHW + KX, LT0, LT1);              // jambs
    band(LHW - KX, LHW, LT0, LT1);
    for (let j = 1; j < 3 && !EXT; j++)           // glazing bars across
      band(-LHW + 2 * LHW * j / 3 - 0.05, -LHW + 2 * LHW * j / 3 + 0.05, LT0, LT1);
  }
}

// ===========================================================================
// THE EXTERIOR BUILD STOPS HERE.
// ===========================================================================
// Everything above is the shell; everything below is the room. The return is
// placed at this line rather than at the top of each following block because
// the things it skips are not merely unnecessary outside — they are actively
// wrong in another scene, and a guard per block is a guard that can be
// forgotten. What is downstream: the fittings and the prop library, the work
// in progress, ROOT and the key light, the shop lamps, the dust shafts, the
// moods, the material part system, and the two shadow bakes.
//
// It returns G, the static group, and not ROOT — ROOT does not exist until
// line ~2115 and its only other members are the key light and the shafts.
if (EXT) {
  if (typeof console !== 'undefined') {
    const c = census();
    console.log('hangar exterior: ' + c.meshes + ' meshes, ' +
      c.tris.toLocaleString() + ' tris | sheets ' + sheetBaked + ' baked, ' +
      sheetHit + ' from the memo');
  }
  return {
    group: G,
    dims: { HW: HW, HD: HD, EAVE: EAVE, RIDGE: RIDGE },
    doorAxis: -1, floorY: 0,
    mats: M, census: census,
    // its own disposer: no props (so no sharedGeo to protect), no ground
    // shadow, no sky texture. app.js's disposeHangar is written against the
    // module-level garage instance and must not be pointed at this one.
    dispose: function () {
      const mats = new Set();
      G.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material])
          .forEach(function (m) { mats.add(m); });
      });
      mats.forEach(function (m) { m.dispose(); });
    },
  };
}

// ===========================================================================
// FITTINGS — the things that make it a place where aeroplanes get built
// ===========================================================================





// ---- THE PROP LIBRARY (G51) ------------------------------------------------
// The shed's furniture is no longer drawn. Every fitting that had a real prop
// in the library is placed from it instead — the drawn bench(), pegboard(),
// shelving(), toolChest(), drum(), tyreStack(), bottleRack(), stepladder(),
// partsTrolley() and the old stove corner are gone, and their calls below name
// a prop key instead. What is still drawn is what has no prop: the engine
// stand, the wing jig, the leaning propeller, the drawing board, the work
// platforms, the stock rack and the jack stands.
//
// Every prop was baked with its origin where it meets the world (see
// tools/props_table.py `place`), so a placement site gives x, z, a heading and
// — only for the wall and ceiling props — the height of the thing it hangs on.
// ASK, DO NOT ASSUME, exactly as the room does with THREE: a build without the
// prop packs still stands, it is just an emptier shed.
const PROPS_OK = typeof propPlace === 'function' &&
                 typeof PROP_REG !== 'undefined' && PROP_REG.order.length > 0;
// Everything that should print a ground shadow. prop() and the workshop feed
// it; the drawn fittings are pushed at their call sites. The BUILDING is not
// in it — a floor that occludes itself is a black floor.
const FURN = [];
// ===== EMITTERS ============================================================
// A LIGHT SOURCE IS NOT ALWAYS A `Light` (G65, user: "when I turn everything
// off, I still have the bottom light ... I don't have options for turning all
// of them on or off"). The mute system only ever knew about THREE.Light
// objects. Every self-lit MATERIAL in the room was outside it, so with all
// five switches thrown the shed still had, measured on the built page:
//
//   lamp_desk    emissive fffaa5 @ 1.0, one mesh at y 1.49  <- "the bottom light"
//   lamp_pendant emissive ffffff @ 1.0, five meshes at y 5.83
//   skyPanel     emissive cfe2f7 @ 0.43, eight roof panels at y 8.39
//
// This is the same bug as the G62.3 stove, and finding it by eye a second time
// is the part worth fixing. So emitters are REGISTERED rather than hunted: a
// material either gets claimed by a source as it is built, or the sweep at the
// end of the room catches it and files it under `glow` — which then shows up
// as a switch. Nothing self-lit can be added to this room again without a way
// to turn it off.
const EMIT = [];                      // { mat, e0, key }
const emitSeen = new Set();
const claimMat = (m, k) => {
  if (!m || emitSeen.has(m)) return;
  emitSeen.add(m);
  if (!m.emissive || m.emissive.getHex() === 0 || !(m.emissiveIntensity > 0)) return;
  EMIT.push({ mat: m, e0: m.emissiveIntensity, key: k });
};
const claim = (obj, k) => {
  if (!obj || !obj.traverse) return obj;
  obj.traverse(o => {
    if (!o.isMesh || !o.material) return;
    for (const m of [].concat(o.material)) claimMat(m, k);
  });
  return obj;
};

function prop(key, x, z, ry, y, parent) {
  if (!PROPS_OK) return null;
  if (!PROP_REG.props[key]) { console.warn('hangar: no prop ' + key); return null; }
  const g = propPlace(THREE, key, x, z, ry, y);
  (parent || G).add(g);
  FURN.push(g);
  return g;
}

// ---- THE MOBILE KIT --------------------------------------------------------
// Everything else in this room is nailed to a wall, because that is what makes
// the middle of the floor read as the aeroplane's. These four are the
// exception the user asked for: the kit you actually walk over to the
// aeroplane with. The caller hands in the aeroplane's FOOTPRINT in the room's
// own frame (x aft, z spanwise, nose at -x) and they are placed on a clearance
// ring outside it — never inside the box, never further than a step from it,
// and re-placed whenever the aeroplane changes, so a DC-3 pushes them out and
// a drone lets them back in.
const MOBILE = new THREE.Group();
G.add(MOBILE);
function placeMobile(bb) {
  for (let i = MOBILE.children.length - 1; i >= 0; i--)
    MOBILE.remove(MOBILE.children[i]);
  if (!PROPS_OK || !bb || !isFinite(bb.x0)) return 0;
  // The ring's arithmetic lives in core now (hangarFitRing, 26_hangar_fit.js)
  // — same CLR, same clamps, and the magnitude-clamp lesson keeps its shape
  // there: lim takes a MAGNITUDE, because handing it -(HW - 2.2) once put the
  // ladder, the sack truck and the jerrycan against the far wall on the wrong
  // side. Which rows appear follows the chosen KITS: the cart is the handling
  // kit's, the toolbox the bench's, the jerrycan the stores' — a park-only
  // shed walks nothing over to the aeroplane.
  const rows = (typeof hangarFitRing === 'function')
    ? hangarFitRing({ HW: HW, HD: HD, EAVE: EAVE }, KITS, bb) : [];
  for (const r of rows) prop(r.prop, r.x, r.z, r.ry, r.y, MOBILE);
  // THE KIT IS BUILT AFTER THE ROOM IS (G65). It needs the aeroplane's own
  // bounding box, so it arrives long after the emitter sweep has run and would
  // otherwise be the one way a self-lit material could still get in unswitched.
  // Claiming is idempotent — prop materials are shared per key, so anything
  // already registered is skipped.
  claim(MOBILE, 'glow');
  return mobileList();
}
// Where the kit ended up, and whether it is shown at all. The editor offers
// both: the kit is the room's only clutter that stands IN the open floor, and
// when the question is about the shape it is in the way.
function mobileList() {
  return MOBILE.children.map(o => ({
    key: o.name.replace('prop:', ''),
    x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2),
  }));
}
function mobileShow(on) { MOBILE.visible = on !== false; return MOBILE.visible; }

// THE COSY CORNER. The stove is a prop now; the flue is not, and cannot be —
// scandinavian_masonry_heater is a DOMESTIC heater with a 2.4 m stub, and this
// shed is 8.4 m to the eaves, so the pipe has to be drawn on up through the
// roof or it ends in mid-air. The glow, the log basket and the rug's chair
// come with it.
function stoveCorner(x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  g.add(box(1.7, 0.06, 1.7, M.stem, 0, 0.03, 0));          // the hearth slab
  if (!prop('stove_masonry', x, z, ry)) {                   // fallback: a drum
    g.add(cyl(0.30, 0.34, 0.78, M.steelDark, 0, 0.42, 0, 16));
    g.add(cyl(0.36, 0.36, 0.05, M.steelDark, 0, 0.83, 0, 16));
  }
  // the flue, from the heater's own stub up through the roof
  {
    const y0 = 2.36, top = EAVE + 0.6;
    g.add(cyl(0.09, 0.09, top - y0, M.steelDark, 0, y0 + (top - y0) / 2, 0, 12));
    g.add(cyl(0.16, 0.16, 0.10, M.steelDark, 0, top - 0.9, 0, 12));   // roof collar
  }
  // THE FIRE IS A LIGHT AND IT WAS NOT IN THE ROOM'S BOOKS (G62.7, user:
  // "All lamps turned off (I can still see the stove one), but still something
  // is lighting up the airplane"). It was constructed here, at 14 candela, and
  // then never touched again: no mood scaled it and no switch could reach it.
  // Every other source in the shed dims with the hour, so at NIGHT — where the
  // sun is 0.076 and the lamps are off — this one burned on at 14 and became
  // most of the light in the building. Measured on a night view with the lamps
  // muted: removing it took the frame from 7.71 to 3.72, i.e. it was 52% of
  // what was lighting the aeroplane, and it is 0.6 m off the floor, which is
  // why what it lit was lit FROM UNDERNEATH.
  //
  // It is registered now (STOVE below): the mood scales it with the lamps, and
  // the light panel can switch it off like anything else.
  const glow = new THREE.PointLight(0xff7a2a, STOVE.cd0, 7, 2);
  glow.position.set(0, 0.6, 0.75); g.add(glow);
  STOVE.light = glow;
  // log basket + logs, still drawn: nothing in the library is a log
  g.add(cyl(0.30, 0.26, 0.34, M.wood, 1.15, 0.17, 0.35, 14));
  for (let k = 0; k < 5; k++) {
    const l = cyl(0.055, 0.055, rr(0.28, 0.38), M.wood, 1.15 + rr(-0.1, 0.1),
                  0.36 + k * 0.05, 0.35 + rr(-0.1, 0.1), 8);
    l.rotation.set(rand() * 3, rand() * 3, Math.PI / 2 + rr(-0.4, 0.4));
    g.add(l);
  }
  G.add(g);
  return g;
}



// a drawing board with plans, under a lamp
function planTable(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  const TILT = 0.22;
  const top = box(1.5, 0.05, 1.0, M.woodPale, 0, 0.95, 0);
  top.rotation.x = -TILT; g.add(top);
  // EACH LEG IS AS LONG AS THE BOARD IS HIGH ABOVE IT. The top is tilted, so
  // one height for all four left the raised side standing 18 cm clear of the
  // board it is supposed to be holding up.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const h = 0.95 + sz * 0.42 * Math.sin(TILT) - 0.026;
    g.add(box(0.07, h, 0.07, M.wood, sx * 0.65, h / 2, sz * 0.42));
  }
  const paper = box(1.2, 0.006, 0.82,
    new THREE.MeshStandardMaterial({ color: 0xe8e3d6, roughness: 0.95 }), 0, 1.0, 0.02);
  paper.rotation.x = -0.22; g.add(paper);
  for (let k = 0; k < 3; k++) {
    const r = cyl(0.035, 0.035, 0.9, new THREE.MeshStandardMaterial({ color: 0xded7c6, roughness: 0.95 }),
                  0.4 + k * 0.09, 1.06, -0.3, 10);
    r.rotation.z = Math.PI / 2; r.rotation.y = 0.1; g.add(r);
  }
  G.add(g); return g;
}

// a rolling work platform — the thing you actually stand on to reach a wing
function workPlatform(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  const H = 1.55, W2 = 0.95, D = 2.0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cyl(0.035, 0.035, H, M.paintBlue, sx * (W2 / 2 - 0.05), H / 2, sz * (D / 2 - 0.05), 8));
    const w = cyl(0.08, 0.08, 0.05, M.rubber, sx * (W2 / 2 - 0.05), 0.08, sz * (D / 2 - 0.05), 10);
    w.rotation.x = Math.PI / 2; g.add(w);
  }
  for (const sz of [-1, 1]) for (const y of [0.55, 1.05])
    g.add(box(W2, 0.035, 0.035, M.paintBlue, 0, y, sz * (D / 2 - 0.05)));
  for (const sx of [-1, 1])
    g.add(box(0.035, 0.035, D, M.paintBlue, sx * (W2 / 2 - 0.05), 1.05, 0));
  g.add(box(W2 - 0.06, 0.05, D - 0.06, M.woodPale, 0, H + 0.03, 0));
  // handrail on three sides, and the ladder up the fourth
  for (const [px, pz] of [[-W2 / 2 + 0.05, 0], [W2 / 2 - 0.05, 0]]) {
    g.add(cyl(0.025, 0.025, 1.0, M.paintBlue, px, H + 0.5, pz - D / 2 + 0.05, 8));
    g.add(cyl(0.025, 0.025, 1.0, M.paintBlue, px, H + 0.5, pz + D / 2 - 0.05, 8));
    g.add(box(0.03, 0.03, D, M.paintBlue, px, H + 1.0, 0));
  }
  g.add(box(W2, 0.03, 0.03, M.paintBlue, 0, H + 1.0, -D / 2 + 0.05));
  for (let k = 0; k < 4; k++)
    g.add(box(W2 - 0.14, 0.03, 0.05, M.paintBlue, 0, 0.30 + k * 0.42, D / 2 - 0.04));
  G.add(g); return g;
}
// stock rack: tube, spruce and sheet, which is what an aeroplane starts as
function stockRack(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  for (const cz of [-2.4, 0, 2.4]) {
    g.add(box(0.10, 2.6, 0.10, M.steelDark, 0, 1.3, cz));
    for (let k = 0; k < 4; k++)
      g.add(box(0.75, 0.06, 0.06, M.steelDark, 0.30, 0.5 + k * 0.65, cz));
  }
  for (let k = 0; k < 4; k++) {
    const y = 0.57 + k * 0.65, n = 3 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      if (k < 2) {
        const t = cyl(rr(0.012, 0.030), rr(0.012, 0.030), rr(3.2, 5.4), M.steel,
                      rr(0.05, 0.55), y + rr(0, 0.05), rr(-2.5, 2.5), 8);
        t.rotation.x = Math.PI / 2; g.add(t);
      } else {
        g.add(box(rr(0.06, 0.22), rr(0.02, 0.05), rr(3.0, 5.2), M.woodPale,
                  rr(0.05, 0.55), y + 0.03, rr(-2.4, 2.4)));
      }
    }
  }
  G.add(g); return g;
}

// ---- placement ------------------------------------------------------------
// EVERYTHING STANDS AGAINST A WALL. A working shed keeps the middle of the
// floor clear — that is where the aeroplane goes, and it is the only way it
// reads as the subject rather than as one more object in a cluttered room.
// The shed is x in [-HD, HD] (door at -HD) and z in [-HW, HW]; the two long
// runs are the z = +-HW walls and the back wall is x = +HD.
//
// MEASURED SURFACES, not guessed ones. A prop that something else stands on
// was measured off its own decoded geometry (upward-facing triangle area,
// binned by height) rather than eyeballed, because a mug 3 cm above a bench
// top is the one mistake that makes a whole room look wrong. The heights
// ride inline on the kit site rows now (`y` in 26_hangar_fit.js — bench
// 0.96, desk 0.78, table 0.68, cart_storage 1.28, crate 0.41); the rack's
// shelves stay here because only loadedRack draws onto them:
const SHELVES = [0.44, 0.92, 1.42, 1.90];       // rack_steel, measured

// A LOADED RACK. Bare shelving reads as a showroom; what makes a rack look
// used is that the shelves are full and not tidy. Only props that fit the
// 0.48 m gap and the 0.60 m depth go on one, and the seeded PRNG picks, so
// the same shed comes back every time.
// Only what FITS: the shelf is 0.92 x 0.60 with a 0.48 m gap above it, so
// toolbox_open (0.77 m wide) was tried and dropped out — on the rack it hung
// off both ends and read as a landslide.
const SHELF_STOCK = ['box_cardboard', 'crate_wood_a', 'jerrycan',
                     'instrument_panel'];   // boxes_cardboard was dismissed
function loadedRack(x, z, ry) {
  prop('rack_steel', x, z, ry);
  const c = Math.cos(ry), sn = Math.sin(ry);
  for (const y of SHELVES) {
    if (y > 1.5 && rand() < 0.45) continue;     // the top shelf is half empty
    let u = -0.24;                              // along the rack, local x
    while (u < 0.26) {
      const k = SHELF_STOCK[Math.floor(rand() * SHELF_STOCK.length)];
      const v = rr(-0.05, 0.05);                // in and out, local z
      prop(k, x + u * c + v * sn, z - u * sn + v * c, rand() * 3, y);
      u += rr(0.26, 0.36);
    }
  }
}

// ===== THE FIT-OUT (HANGARS S2) =============================================
// The 72 hand-placed prop lines that lived here are DATA now: kit site rows
// in src/core/26_hangar_fit.js, converted through the identity that FX/FZ
// always were (along = (a+13)/26 says FX(a) at every dims). The engine
// resolves anchors off HW/HD/EAVE, packs the walls, keeps the aircraft bay,
// and reports what a small shell cannot take — so this file's whole job is
// standing meshes at the answers, and a kit that is absent is simply never
// asked for. What stays drawn here are the RECIPES — the loaded rack, the
// tyre stack, the stove corner, the work in progress — because nothing in
// the library is a fire or a half-built wing; the engine places them by
// their declared footprints and DRAW below does the drawing.
//
// A TYRE IS ONE PROP AND A STACK IS A STACK: 0.165 m of tread per lift, and
// a turn on each, so no two read as the same casting.
const tyreStack = (x, z, n) => {
  for (let k = 0; k < n; k++)
    prop('tyre', x + rr(-0.03, 0.03), z + rr(-0.03, 0.03), rand() * 3, k * 0.165);
};

// ---- the work in progress, drawn ------------------------------------------
// These come out of the game's own generator rather than the prop library
// (see src/viewer/workshop.js), so when the generator learns a new tip shape
// or a better truss, the aeroplanes half-built on this floor learn it too.
// The stands are a PROP (user: "your stands are still really shaky"), so the
// height the pieces rest at is the trestle's own top, measured off the baked
// payload rather than agreed between two files — and so is its FOOTPRINT,
// because wsOnStands stops a trestle at the lowest surface anywhere under
// its beam, and it can only do that if it knows how big the beam is.
const wsTrestleTop = (PROPS_OK && PROP_REG.props.work_trestle)
  ? PROP_REG.props.work_trestle.bb[4] : 0.82;
const wsTrestleBB = (PROPS_OK && PROP_REG.props.work_trestle)
  ? PROP_REG.props.work_trestle.bb : null;
const wsMats = { wood: M.woodPale, steel: M.steel, trestleTop: wsTrestleTop,
                 standFoot: wsTrestleBB
                   ? [Math.max(wsTrestleBB[3], -wsTrestleBB[0]),
                      Math.max(wsTrestleBB[5], -wsTrestleBB[2])]
                   : [0.26, 0.43],
                 stand: (x, z, ry) => prop('work_trestle', x, z, ry) };
const wipGen = (kind, x, z, ry) => {
  const g = (typeof wsPiece === 'function') ? wsPiece(THREE, kind, wsMats) : null;
  if (!g) return null;
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  G.add(g);
  FURN.push(g);
  return g;
};

// THE JODEL FUSELAGE. A prop like everything else in here: baked by
// tools/jodel_prep.py into the same pack format the furniture uses, so it
// prints a floor shadow and scales with the moods without knowing anything
// about either. ON TRESTLES, LIKE THE WING (G63): `wsOnStands` rays the
// piece DOWNWARD at each stand's own station and stretches that trestle to
// whatever surface it finds there — a fuselage keel is curved, so three
// equal trestles would leave two of them short. The rotation goes on the
// WRAPPER, not on the prop, so the trestles turn with what they carry
// instead of being laid out across it. (The heading the kit row carries is
// 180 degrees AND A BIT MORE — nose-for-tail against the finished aeroplane
// and off its axis by twelve degrees: two parked parallel read as a
// diagram, two at an angle read as a shed.)
function wipBody(x, z, ry) {
  const b = prop('airframe_jodel_body', 0, 0, 0);
  if (!b) return;
  G.remove(b);
  const i = FURN.indexOf(b); if (i >= 0) FURN.splice(i, 1);
  const stood = (typeof wsOnStands === 'function')
    ? wsOnStands(THREE, b, wsMats, 3) : null;
  const g = stood || b;
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  G.add(g); FURN.push(g);
}

// THE JODEL WING, HUNG CHORD-UP IN FRONT OF THE BACK WALL (user: "you may
// also have it hang chord up from the ceiling, I've seen that done"). On
// edge it costs a metre and a half of wall instead of nine metres of floor.
// `prop()` only offers a heading, because every other prop in the shed
// stands on something. This one is turned onto its edge as well, so it is
// placed and then rolled: a quarter turn about Z takes the CHORD from x into
// y, leaving the span along z and the thickness across. The piece was baked
// 'ceiling' — origin at its top — so after the roll the top is at +halfChord
// and the hang height is that much below the strap.
function wipWingHang(wx, wz) {
  // 1.20 m LOWER (G64 dropped it 70 cm, G64.1 another 50 — user: "The wing
  // sits too high"). It hangs across the MIDDLE of the doors now instead of
  // riding along their head rail, which reads as stored rather than stowed.
  // ...and never lower than a wing can hang (HANGARS S4): at the timber
  // shed's 3.6 m eave the proportional drop put the chord's bottom edge
  // THROUGH the slab. 1.9 m keeps the half-chord off the floor with head
  // room under it, and changes nothing at any eave above 4.3.
  const top = Math.max(EAVE * 0.72 - 1.20, 1.9);
  const w = prop('airframe_jodel_wing', wx, wz, 0);
  if (!w) return;
  const half = 0.84;                       // half the 1.68 m chord
  w.rotation.z = Math.PI / 2;
  w.position.set(wx, top - half, wz);
  // two straps to the roof, because a wing floating on nothing reads as a
  // bug. Same trick as the lamps' drop rods: the LIGHT is not a model, but
  // the thing holding it up is.
  for (const cz of [wz - 2.6, wz + 2.6]) {
    const roof = roofY(cz), len = roof - (top + 0.02);
    if (len > 0.05)
      put(cyl(0.010, 0.010, len, M.steelDark, wx, top + 0.02 + len / 2, cz, 6));
  }

  // ITS SHADOW ON THE WALL BEHIND IT (G63, user: "The wing can be quite
  // invisible depending on the texture chosen for the back wall").
  //
  // PRECALCULATED rather than rendered, because this wing never moves.
  // A render target would recompute the same image every bake for the same
  // answer, cost a texture unit, and need a camera pointed at a wall. The
  // silhouette is a soft tapered slab, drawn straight into an alpha map:
  // wide plateau across the span, narrower toward the tips as the wing
  // tapers, soft everywhere because a shadow from a big diffuse source is.
  const bb = new THREE.Box3().setFromObject(w);
  const spanZ = bb.max.z - bb.min.z, chordY = bb.max.y - bb.min.y;
  // 90% ACROSS, 80% DOWN, AND PROPERLY BLURRED (G64, user: "The shadow is
  // too rough. Shrink it to 80% vertical and 90% horizontal, then blur it
  // significantly"). The first version faded its edges with a pair of
  // smoothsteps, which is a ramp, not a blur: it kept the silhouette's
  // corners and read as a smudge with a shape. This one draws the crisp
  // mask small in the middle of the sheet and then actually BLURS it —
  // two passes of a separable box filter, which is a close enough
  // Gaussian for something this soft and costs nothing at bake time.
  //
  // 14 px of blur on a 256 x 64 sheet across a 9 m quad is about 0.45 m of
  // penumbra, which is what a 4 m ceiling of diffuse light gives a wing
  // hanging a metre off the doors.
  const shW = (spanZ + 1.1) * 0.90, shH = (chordY + 0.9) * 0.80;
  const shTex = sheet(256, 64, (g2, W2, H2) => {
    const N = W2 * H2, a = new Float32Array(N), b = new Float32Array(N);
    for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
      // the mask itself occupies the middle 70%, leaving the blur room to
      // run out inside the sheet instead of clipping at its edge
      const u = ((i + 0.5) / W2 - 0.5) / 0.70 + 0.5,
            v = ((j + 0.5) / H2 - 0.5) / 0.70 + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const e = Math.abs(2 * u - 1);            // 0 at root, 1 at a tip
      const hv = 0.5 * (1 - 0.30 * e * e);      // the wing's taper
      a[j * W2 + i] = (Math.abs(v - 0.5) <= hv) ? 1 : 0;
    }
    const blur = (src, dst, rx, ry) => {
      for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
        let t = 0, n = 0;
        for (let k = -rx; k <= rx; k++) {
          const x = i + k; if (x < 0 || x >= W2) continue;
          t += src[j * W2 + x]; n++;
        }
        dst[j * W2 + i] = t / n;
      }
      for (let i = 0; i < W2; i++) for (let j = 0; j < H2; j++) {
        let t = 0, n = 0;
        for (let k = -ry; k <= ry; k++) {
          const y = j + k; if (y < 0 || y >= H2) continue;
          t += dst[y * W2 + i]; n++;
        }
        src[j * W2 + i] = t / n;
      }
    };
    blur(a, b, 14, 7); blur(a, b, 14, 7);
    const img = g2.createImageData(W2, H2), d = img.data;
    for (let p = 0; p < N; p++) {
      d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = 255;
      d[p * 4 + 3] = Math.round(255 * Math.min(1, a[p]));
    }
    g2.putImageData(img, 0, 0);
  }, true);
  // the plane is drawn in x-y and turned to face the room, so its width
  // runs along z (the span) and its height along y (the chord). It sits on
  // the DOOR now, not the wall behind it, and a little low because every
  // fitting in here is above it.
  const q = new THREE.Mesh(
    new THREE.PlaneGeometry(shW, shH),
    new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shTex,
      transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
  q.rotation.y = -Math.PI / 2;
  q.position.set(BD_FACE - 0.02, (bb.min.y + bb.max.y) / 2 - 0.14, wz);
  q.renderOrder = 1;
  put(q);
}

// ---- the placement itself -------------------------------------------------
// DRAW maps a declared recipe name to its drawing; everything else the
// engine returns is a bare prop() call. The desk lamp's `light` field routes
// through claim() so its emitter stays on the switchboard (G62.7's lesson:
// a light nothing holds a reference to is a light nothing can turn off).
const DRAW = {
  loadedRack: r => loadedRack(r.x, r.z, r.ry),
  tyreStack: r => tyreStack(r.x, r.z, r.n),
  stoveCorner: r => FURN.push(stoveCorner(r.x, r.z, r.ry)),
  planTable: r => FURN.push(planTable(r.x, r.z, r.ry)),
  workPlatform: r => FURN.push(workPlatform(r.x, r.z, r.ry)),
  stockRack: r => FURN.push(stockRack(r.x, r.z, r.ry)),
  wipBody: r => wipBody(r.x, r.z, r.ry),
  wipWingHang: r => wipWingHang(r.x, r.z),
  wsWing: r => wipGen('wing', r.x, r.z, r.ry),
  wsEngine: r => wipGen('engine', r.x, r.z, r.ry),
};

const KITS = (opts && opts.kits && opts.kits.length)
  ? opts.kits.slice()
  : ((typeof HANGAR_KITS_DEFAULT !== 'undefined')
     ? HANGAR_KITS_DEFAULT.slice() : []);
let FIT = { placed: [], recipes: [], unplaced: [], dims: { HW, HD, EAVE } };
if (typeof hangarFit === 'function' && PROPS_OK) {
  FIT = hangarFit({ HW: HW, HD: HD, EAVE: EAVE }, KITS,
                  { reg: (typeof PROP_REG !== 'undefined') ? PROP_REG : null,
                    shell: SHELL });
  for (const p of FIT.placed) {
    const g = prop(p.prop, p.x, p.z, p.ry, p.y);
    if (g && p.light) claim(g, p.light);
  }
  for (const r of FIT.recipes) {
    if (DRAW[r.recipe]) DRAW[r.recipe](r);
    else console.warn('hangar: no recipe ' + r.recipe);
  }
  // NEVER SILENTLY (HANGARS §4.3): a kit that does not fit this shell says
  // so. The editor shows the same report through fitReport on the return.
  for (const u of FIT.unplaced)
    console.info('hangar: not placed — ' + u.kit + '/' + u.key +
                 ' (' + u.reason + ')');
}

// NO PENDANTS OVER THE BENCHES. Four of them used to hang here at eaves
// height with nothing above them — a lamp needs a rod to hang from, and the
// six that have one are placed with the shop lamps further down.

// ---- lighting -------------------------------------------------------------
// The room is a GROUP, not a scene: the viewer owns the scene, and the garage
// swaps this whole thing in and out of it. Lights live in the group too, so one
// add/remove carries the room and its lighting together and neither can be left
// behind — which is what happens the first time they are tracked separately.
const ROOT = new THREE.Group();
const BG = new THREE.Color(0x14120f);
const FOG = new THREE.Fog(0x1a1712, 40, 120);
ROOT.add(G);

// THE ROOM HAS TWO LIGHTS AND AN ENVIRONMENT (G62.5, user: "why don't we
// simply cut the shafts and the windows from the hangar mesh, like we've done.
// Then we really need only 2 lights; the sun and the ceiling lamps ... I have
// the feeling we multiplied unphysical light sources, and now we struggle with
// the management of them. I suggest simplification").
//
// He was right, and the reason it works NOW is that the openings are genuinely
// cut (G52/G55) and the key light casts: the sun comes in through the glazing
// and the skylights BY ITSELF, at the correct angle. The three fills existed
// because the shell used to be solid. Every one of them was a second sun with
// no occlusion, and every one was DOUBLE-COUNTED, because the environment
// probe is baked with them switched on.
//
// GONE, all three:
//   hemi  - a HemisphereLight, which by construction lights everything from
//           everywhere and can never be occluded by anything.
//   top   - a second sun from straight above, duplicating what the real one
//           already does through the skylights now that it casts.
//   win   - two more, standing TWELVE METRES OUTSIDE the flanks and lighting
//           the far wall straight through the near one. Measured, this was the
//           second-largest source in the shed and most of what the walls
//           looked like; it is what put a specular sheen on the sheeting that
//           answered to nothing in the room.
//
// WHAT IS LEFT is what a shed has: the SUN, the LAMPS, and the INDIRECT light,
// which `scene.environment` already models properly from a cube pass of this
// room that sees the real sky through the real openings.
//
// MEASURED on a wall camera before committing: six sources gave mean 64.4 with
// 14.5% of the frame crushed to black; sun+lamps+env alone gave 50.2 and 35.2%
// (too dark, as the user predicted); sun+lamps+env with the environment
// carrying its proper weight gave 75.2 and 3.8%. Brighter AND better shaded
// than what it replaces, at three fewer lights. Night is unchanged either way,
// because the lamps carry it.
//
// Deleting them rather than zeroing them is deliberate: three.js compiles the
// light COUNT into every material's shader, so a zero-intensity light is still
// paid for on every fragment.

// THE DOOR. One shadow-casting key, angled the way a low afternoon sun comes
// through an open hangar door — long shapes down the floor, the aeroplane lit
// from the nose.
// THE SUN COMES OUT OF THE SKY IMAGE (G56, user: "the HDRI sun vector";
// measured off the HDR itself at G62). The equirect is the only thing in this
// room that knows where the light actually is; the key light used to point the
// way the shed was drawn, so the shadows on the floor disagreed with the
// daylight in the windows above them.
//
// The (u, v) is no longer scanned off the LDR picture at run time — it is
// integrated off the float HDR by tools/sky_prep.py, which is strictly better
// on two counts: a clipped LDR bloom has no centroid (every pixel of it reads
// 255, so the scan returned whichever corner it met first), and a small hard
// moon over a bright horizon is found for the same reason. What is left here
// is the conversion, and the sphere's own orientation (scale.x = -1, then a
// quarter turn about y) has to be applied to the direction to match how the
// backdrop is hung — the one part that is easy to get backwards, which is why
// it is still written out longhand.
function sunDir(uv, yaw) {
  if (!uv || uv.length !== 2) return null;
  // equirect: u wraps the horizon, v runs top (zenith) to bottom
  const phi = (uv[0] - 0.5) * 2 * Math.PI, theta = uv[1] * Math.PI;
  let x = Math.sin(theta) * Math.cos(phi), y = Math.cos(theta),
      z = Math.sin(theta) * Math.sin(phi);
  x = -x;                                        // scale.x = -1
  const a = (yaw !== undefined) ? yaw : SKY_YAW0;    // ...then rotation.y = a
  const c = Math.cos(a), sn = Math.sin(a), rx = x, rz = z;
  x = rx * c + rz * sn; z = -rx * sn + rz * c;
  const L = Math.hypot(x, y, z) || 1;
  return [x / L, Math.max(0.12, y / L), z / L];  // never below the horizon
}

const key = new THREE.DirectionalLight(0xffe0b0, 2.6);
key.position.set(-(HD + 17), EAVE * 0.6, FZ(7.5));
key.target.position.set(FX(6), 0.6, FZ(-3));
// AIM IS PER SKY, so it is a function and not a one-off: the sun moves when
// the mood does, and so must every shadow on the floor. Stand the light off at
// a distance that keeps the whole shed in its shadow frustum, aimed at the
// middle of the floor.
function aimKey(uv, yaw) {
  const sun = sunDir(uv, yaw);
  if (!sun) return;
  const R = 2 * HD + 22;
  key.target.position.set(0, 0.6, 0);
  key.position.set(sun[0] * R, Math.max(EAVE * 0.8, sun[1] * R), sun[2] * R);
  key.target.updateMatrixWorld();
}
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
// the shadow box is the SHED, not a remembered number: a frustum sized for a
// room twice this one spends its depth precision on empty air and the contact
// shadow under the wheels goes soft
key.shadow.camera.left = -(HW + 8); key.shadow.camera.right = HW + 8;
key.shadow.camera.top = HD + 3; key.shadow.camera.bottom = -(HD + 3);
key.shadow.camera.near = 1; key.shadow.camera.far = 2 * HD + 64;
key.shadow.bias = 0; key.shadow.normalBias = 0.02;
key.shadow.normalBias = 0.02;
ROOT.add(key, key.target);





// SHOP LAMPS. The shade is hanging_industrial_lamp now, not a drawn cone; what
// is still drawn is the LIGHT (a light is not a model) and the drop rod, since
// the prop's own chain is 1.36 m and the roof over the lamp rows is at 9.9 m.
// The prop hangs BELOW its origin, so the origin goes up at the rod's foot.
// THREE ROWS OF THREE (G62.9, user: "Add a full new row of 3 lamps in the
// middle"). It also answers the thing G62.8 left open honestly: the centre
// aisle went dark when the lamps stopped being aimed sideways at it, and the
// right way to light the stand is a fitting ABOVE the stand — one the player
// can look up and see — not a spotlight pointed at it from the flank.
// FIVE IN A CROSS (G63, user: "keep only 5 lamps; the 3 in the middle, and 2
// on each side, in the middle too, in a cross pattern"). Nine fittings in a
// 3x3 grid lit the shed evenly and read as a warehouse; five on the two
// centrelines light the aisle where the work is and leave the corners to fall
// off, which is what a shed with a modest electrical bill looks like.
//
// It also pays for itself twice over — see `casts` below.
const LAMP_XZ = [[-8, 0], [0, 0], [8, 0], [0, 9.5], [0, -9.5]];
const lamps = [];

// THE LAMP RIG IS THREE KNOBS NOW (G64, user: "for the lamps, give me an
// intensity and spread control please, as well as a light temperature
// control"). They live in the editor's existing hangar section — no new panel
// (G62.10, user: "remove your new panel, we can already access these options,
// and the panel masks the game's buttons").
//
// POWER is a GAIN, not a value, because the mood already owns the candela: a
// night shed and a noon shed do not run their lamps at the same output, and a
// knob that overwrote that would undo the whole measured rig. It multiplies.
//
// SPREAD is the SpotLight's own half-angle; the UI speaks in full cone degrees
// because that is what a fitting's datasheet says.
//
// TEMPERATURE replaces a hex that was picked by eye. The colour comes off the
// usual black-body approximation, and it goes into the Color the same way
// every other hex in this file does — straight in, unconverted, because r128
// has no colour management and treats what you hand it as working space. The
// default, 4000 K, is not a guess: it is the Kelvin whose curve lands nearest
// the 0xffd9a0 these lamps have always burned at (255,207,167 against
// 255,217,160, twelve counts out of 255 apart), so opening the slider does not
// move the room.
// SPREAD DEFAULT: 135 DEGREES OF FULL CONE (user, 2026-08-31). The stored
// number is the SpotLight's half-angle in radians, which is what three.js
// wants and what the datasheet does not: 135 deg full cone = 135*PI/360 =
// 1.178097 rad. It was 0.62 (71 deg full), a tighter pool of light that put
// the shed's floor in five discs with dark between them. Inside setLampRig's
// own [0.10, 1.30] clamp and inside the slider's 20..140 range, both checked.
const LAMP = { gain: 1, angle: 1.178097, kelvin: 4000,
               rgb: new THREE.Color(0xffd9a0) };
const kelvinRGB = (K, out) => {
  const t = Math.max(10, Math.min(400, K / 100));
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = v => Math.max(0, Math.min(1, v / 255));
  return out.setRGB(c(r), c(g), c(b));
};
kelvinRGB(LAMP.kelvin, LAMP.rgb);
for (const [ax, az] of LAMP_XZ) {
  const x = FX(ax), z = FZ(az), y = EAVE * 0.74;
  const g = new THREE.Group(); g.position.set(x, y, z);
  const hook = 1.30;                       // prop origin, above the group
  claim(prop('lamp_pendant', x, z, rr(-3, 3), y + hook), 'lamps');
  const roof = roofY(z), rodH = roof - (y + hook);   // NOT `top`: that is a light
  const drop = cyl(0.012, 0.012, rodH, M.steelDark, 0, hook + rodH / 2, 0, 6);
  g.add(drop);
  // A LIT LAMP NEEDS A LIT BULB. The prop's shade carries an emissive map but
  // nothing inside it glows, so the fitting read as a cold shell with light
  // arriving from an invisible point. This is that point, made visible.
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M.bulb);
  bulb.position.y = 0.12; bulb.castShadow = false;
  g.add(bulb);
  // THE CENTRE PAIR CASTS (G42, user: "the plane does not emit any cast
  // shadow"). The stand sits in the centre aisle, between the lamp rows,
  // where the only shadow-caster (the door sun) never reaches — so the
  // two lamps nearest the stand become SpotLights aimed at it, each with
  // its own shadow map. Same colour, same candela, same mood scaling;
  // the cost is two 1024 maps, and the aeroplane finally stands ON the
  // floor instead of hovering over it.
  // EVERY LAMP CASTS (G60, user: "fix the shadowless lamps"). Four of the six
  // were PointLights with no shadow map — their light went straight through
  // everything, which is why the floor bake had to carry the whole grounding
  // job alone. All six are now the same fitting the G42 centre pair proved out;
  // the cost is four more 1024 maps.
  //
  // AND EVERY LAMP NOW POINTS AT THE FLOOR UNDER ITSELF (G62.8, user: "I can
  // clearly see 6 lamps hanging, but I can see only 5 marks on the ground, 4
  // on the sides, and a big one on the plane ... there's no lamp straight on
  // top of the plane, innit?"). Correct on both counts, and the arithmetic was
  // right there in the aim: the two CENTRE lamps were pointed at z = +/-1.5 —
  // the centreline — from 7.9 m out on either flank. Both pools landed in the
  // same place and merged into one patch, on an aeroplane that has no lamp
  // above it. Four outer pools plus that merged one is exactly the five marks
  // he counted.
  //
  // THE AIM WAS G42'S, AND ITS REASON IS GONE. It existed because "the stand
  // sits in the centre aisle ... where the only shadow-caster never reaches",
  // i.e. to ground the aeroplane with a contact shadow. G58 then BAKED a floor
  // shadow and G59 added the craft's own print, which is that job done
  // properly and independently of where any lamp happens to point. The aim
  // outlived its purpose and all it did afterwards was put light on the floor
  // where no fitting hangs.
  //
  // A hung shade throws DOWN. Six lamps, six pools, each under its own lamp —
  // which is also the only version that survives a player looking up.
  // WHICH LAMPS CAST, AND WHY IT IS NOT ALL OF THEM (G62.10). Every shadow
  // map is a FRAGMENT TEXTURE UNIT, and this platform has sixteen. Measured
  // on the built page:
  //
  //     9 spot shadow maps + 1 directional + 7 material samplers = 17
  //
  // — one over, and the symptom is not a slow frame, it is
  // "FRAGMENT shader texture image units count exceeds
  // MAX_TEXTURE_IMAGE_UNITS(16)" and a material that never compiles. Adding
  // the third lamp row broke it by exactly one unit.
  //
  // So the budget has to be spent where it buys something. A real-time shadow
  // map is for things that MOVE, and the only thing that moves in this shed is
  // the aeroplane — which stands under the CENTRE row. Everything static is
  // grounded by the baked floor shadow (G58) and the craft's own print (G59),
  // which is that job done better and for free.
  //
  // Centre row casts, flanks do not: 3 + 1 + 7 = 11, five units of headroom
  // for the next material that wants a map.
  //
  // AND THE CROSS BUYS IT BACK (G63). That compromise was forced by the ninth
  // fitting and nothing else; at five lamps the sum is
  //
  //     5 spot shadow maps + 1 directional + 7 material samplers = 13
  //
  // — three units under the ceiling. So G60's rule stands again unqualified:
  // every lamp in this shed casts a shadow. Cutting four fittings did not cost
  // shadows, it restored them.
  const casts = true;
  const L = new THREE.SpotLight(LAMP.rgb.getHex(), 90, 26, LAMP.angle, 0.45, 2);
  L.castShadow = casts;
  if (casts) {
    L.shadow.mapSize.set(1024, 1024);
    L.shadow.camera.near = 1; L.shadow.camera.far = 30;
    L.shadow.normalBias = 0.03;
  }
  L.target.position.set(x, 0, z);
  G.add(L.target);
  L.position.y = 0.12;                     // inside the prop's shade
  g.add(L);
  lamps.push(L);
  G.add(g);
}

// ---- light shafts ---------------------------------------------------------
// Cheap, and worth every triangle: a pair of crossed cards per opening, fading
// out along their length. It is the dust in the air, which is the one thing a
// big daylit shed always has.
const shaftTex = sheet(4, 128, (g, W, H) => {
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.55, 'rgba(255,255,255,.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
}, true);
const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true,
  opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide, color: 0xffe9c8 });
const shafts = new THREE.Group();
// ONE card per shaft, turned about its own axis each frame to face the camera.
// Two crossed cards is the usual cheap trick and it is wrong here: additive
// quads that cross each other draw a bright lattice on whatever wall is behind,
// which read as stripes painted on the sheeting.
const shaftList = [];
const shaft = (from, dir, len, w) => {
  const d = new THREE.Vector3(...dir).normalize();
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), shaftMat);
  p.position.set(...from).addScaledVector(d, len / 2);
  p.renderOrder = 3;
  shafts.add(p);
  shaftList.push({ m: p, up: d.clone().negate() });
};
const _m4 = new THREE.Matrix4(), _r = new THREE.Vector3(), _n = new THREE.Vector3(),
      _v = new THREE.Vector3();
const faceShafts = cam => {
  for (const s of shaftList) {
    _v.copy(cam.position).sub(s.m.position);
    _r.crossVectors(s.up, _v);
    if (_r.lengthSq() < 1e-8) continue;
    _r.normalize();
    _n.crossVectors(_r, s.up).normalize();
    _m4.makeBasis(_r, s.up, _n);
    s.m.quaternion.setFromRotationMatrix(_m4);
  }
};

// THE SHAFT HAS TO REACH THE FLOOR, and how far that is depends on how high
// the roof is — which has been a parameter since G53 (user: "do the light
// cones respond to the lamp's height?"). It did not: the length was a flat
// 7.2 m from EAVE + 1.2, so it only landed correctly at the eaves height it
// was hand-set against. At the 4.2 m minimum it drove 1.7 m THROUGH the slab;
// at the 11 m maximum it stopped five metres short and hung in the air.
//
// (For the record, since the question was about lamps: the LAMP pools do
// respond, and always did — a spot cone is geometry, so a lower fitting makes
// a smaller, brighter pool with no code involved. These cones are the ROOF
// lights' dust, not the lamps'. Nothing volumetric is drawn under a lamp.)
//
// A normalised direction drops 1/|dir| per unit length, so the length that
// falls H metres is H * |dir|. 0.88 of the way down is where the alpha
// gradient has faded out anyway, and it is the proportion the hand-set 7.2
// happened to give at the eaves height it was written for.
// ONE shaft per roof light, AT the roof lights (HANGARS S3/S4): this loop
// used to keep its own copy of the four positions, which drifted the moment
// the count became a parameter of the depth — and a shed with no roof
// lights (the timber field shed) gets no roof dust at all, because a cone
// of lit dust under an unbroken deck is a picture of a leak.
for (const s of [1, -1]) for (let k = 0; k < ROOFLIGHTS.n; k++) {
  const x = ROOFLIGHTS.x(k);
  const dir = [0.14, -1, -s * 0.12];
  const len = (EAVE + 1.2) * 0.88 * Math.hypot(dir[0], dir[1], dir[2]);
  shaft([x, EAVE + 1.2, s * HW * 0.45], dir, len, 3.0);
}
// The door opening had a shaft of its own. It failed for a reason worth
// keeping: a roof light is a SMALL aperture, so a card standing in its beam is
// a fair stand-in for the cone of lit dust. A 31 m door is not an aperture, it
// is the missing half of a wall — the light through it does not form a beam at
// all, and one enormous additive quad across the shed read as a sheet of fog
// hanging in the doorway. Removed; the roof shafts stay.
ROOT.add(shafts);

// ---- moods ----------------------------------------------------------------
// A MOOD IS A SKY (G62, user: "HDRI of several day conditions ... the lighting
// conditions harmonized"). The four hand-authored rows this room shipped with
// were a light rig with no picture behind it: the sun outside stayed the alpine
// afternoon whichever one you picked, so GOLDEN lit the shed orange under a
// blue midday sky. Now each row IS a sky — the picture in the doorway and the
// rig are the same row, and the rig was measured off that picture's own HDR by
// tools/sky_prep.py (where the sun is, what colour it is, how directional it
// is; see that tool for what is measured and what is authored). Nothing in
// this file decides a lighting number any more; it applies one.
//
// The alps/AFTERNOON row is the anchor and comes back exactly as it was — the
// user asked to keep it — except that its key light now points where the sun
// in that picture actually is rather than at the brightest clipped pixel of
// its bloom.
//
// `env` was `scene.environmentIntensity`, which r128 does not have — so each
// material's own envMapIntensity is scaled from the value it was authored
// with. Authored values are captured once, here, because scaling a scaled
// value compounds every time the mood changes.
const ENV0 = new Map();
for (const k in M) if (M[k] && M[k].envMapIntensity !== undefined)
  ENV0.set(M[k], M[k].envMapIntensity);

// ---- THE LIGHT SWITCHES (G62.3, user: "I'll need turning off the hangar
// lights from the garage, so I can run tests and see what light source
// interacts correctly and not") ---------------------------------------------
//
// One switch per SOURCE, not per lamp: the point is to answer "which of these
// is doing that?", and the room has exactly six answers plus the environment.
// A mute is a multiplier of zero applied AFTER the mood has set its
// intensities, so it survives a mood change - flipping the sky must not
// silently switch the lights back on underneath a test.
//
// `env` is the odd one and the interesting one: it is not a light, it is
// scene.environment, and muting it is how you find out how much of the room is
// the PMREM rather than the lamps. It works by zeroing every material's own
// envMapIntensity, the same lever the moods use.
// THE SWEEP (G65). M.bulb and M.skyPanel are marked seen because they are
// driven by the mood and handled by name below; everything else self-lit that
// nobody claimed lands in `glow`, and `glow` only becomes a switch if the
// sweep actually found something. Today it finds nothing — which is the point:
// the switch list below is now provably the complete list of ways this room
// makes light.
emitSeen.add(M.bulb);
emitSeen.add(M.skyPanel);
claim(G, 'glow');
const strays = EMIT.filter(e => e.key === 'glow');
if (strays.length && typeof console !== 'undefined')
  console.warn('hangar: ' + strays.length + ' unclaimed emitter(s) filed under "glow"');


// THE TEXTURE-UNIT BUDGET, COUNTED OUT LOUD (G66). Twice now a shadow map too
// many has cost a whole afternoon, and both times the symptom was not a slow
// frame but "FRAGMENT shader texture image units count exceeds
// MAX_TEXTURE_IMAGE_UNITS(16)" and a material that silently never compiled.
// The budget is invisible in the source: it is the sum of one thing the
// lighting code decides and another the material library decides, and neither
// file mentions the other.
//
// So it is printed. Every shadow-casting light is one fragment sampler, and so
// is every map on the busiest material in the room; three.js adds the
// environment on top. This does not fix anything by itself — it turns a cliff
// into a number, in the file where the next person will add the sixth lamp.
const texBudget = () => {
  const MAPS = ['map', 'aoMap', 'alphaMap', 'bumpMap', 'displacementMap',
    'emissiveMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap',
    'specularMap', 'envMap'];
  let casters = 0, worst = 0, worstName = '';
  G.traverse(o => {
    if (o.isLight && o.castShadow) casters++;
    if (!o.isMesh || !o.material) return;
    for (const m of [].concat(o.material)) {
      if (!m) continue;
      const n = MAPS.reduce((a2, k) => a2 + (m[k] ? 1 : 0), 0);
      if (n > worst) { worst = n; worstName = m.name || m.type; }
    }
  });
  if (key.castShadow) casters++;                 // the sun lives outside G
  const need = casters + worst + 1;              // +1 for scene.environment
  const cap = 16;                                // the floor this game targets
  const msg = 'hangar sheets: ' + sheetBaked + ' baked, ' + sheetHit +
            ' from the memo | texture units: ' + casters + ' shadow + ' + worst
            + ' maps (' + worstName + ') + 1 env = ' + need + ' of ' + cap;
  if (typeof console !== 'undefined') {
    if (need > cap) console.error(msg + ' — OVER BUDGET, a material will not compile');
    else console.log(msg);
  }
  return { casters: casters, maps: worst, need: need, cap: cap };
};

const LIGHTS = [
  { key: 'key',    name: 'sun / key',            kind: 'light' },
  { key: 'lamps',  name: 'shop lamps',           kind: 'light' },
  { key: 'desk',   name: 'bench lamp',           kind: 'emissive' },
  { key: 'stove',  name: 'stove fire',           kind: 'light' },
  { key: 'panels', name: 'roof panels',          kind: 'emissive' },
  { key: 'env',    name: 'environment (PMREM)',  kind: 'env' },
  { key: 'shafts', name: 'dust shafts',          kind: 'unlit' },
  // THE THIRD KIND, and the one that has never had a switch. The backdrop is a
  // MeshBasicMaterial: it is lit by nothing, so it is at full brightness in a
  // room where every light is off, and no amount of muting can touch it.
  //
  // G65 ruled that the sky through the cut glazing is "the view out of the
  // window, not a light in the shed, and it should not have a switch". That
  // was right about what it IS and wrong about what the switchboard is FOR:
  // the user asked to start from nothing and add sources back one at a time,
  // and a panel that cannot reach black cannot answer that. It is also not
  // merely scenery — the environment probe is baked from this room, so the
  // backdrop lights the shed through the door and the rooflights.
  { key: 'sky',    name: 'the view outside',     kind: 'unlit' },
];
if (strays.length) LIGHTS.push({ key: 'glow', name: 'stray emitters' });
const muted = {};
const lit = k => !muted[k];
function applyMutes(m) {
  if (muted.key) key.intensity = 0;
  if (muted.stove && STOVE.light) STOVE.light.intensity = 0;
  if (muted.lamps) {
    for (const L of lamps) L.intensity = 0;
    M.bulb.emissiveIntensity = 0;
  }
  if (muted.panels) M.skyPanel.emissiveIntensity = 0;
  // ...and every registered emitter, whichever source owns it
  for (const e of EMIT) if (muted[e.key]) e.mat.emissiveIntensity = 0;
  if (muted.env) {
    for (const [mat] of ENV0) mat.envMapIntensity = 0;
    if (typeof propSetEnv === 'function') propSetEnv(0);
    if (typeof aeroSetEnv === 'function') aeroSetEnv(0);
  }
  shafts.visible = !muted.shafts && (m ? m.shaft > 0 : true);
  // VISIBILITY IS SET BOTH WAYS, unlike an intensity. setMood re-asserts every
  // intensity before the mutes run, so a muted light is restored for free when
  // it is switched back on — but nothing re-asserts `visible`, so an unlit
  // source that only ever gets hidden here can never come back.
  if (skyMesh) skyMesh.visible = !muted.sky;
}
// the three knobs. Anything the mood owns is re-applied through setMood, which
// also re-runs the mutes over the top — the same door setLight goes through,
// for the same reason: a slider must not be able to relight a muted source.
function setLampRig(p) {
  if (p) {
    if (typeof p.gain === 'number') LAMP.gain = Math.max(0, Math.min(4, p.gain));
    if (typeof p.angle === 'number') LAMP.angle = Math.max(0.10, Math.min(1.30, p.angle));
    if (typeof p.kelvin === 'number') {
      LAMP.kelvin = Math.max(1500, Math.min(8000, p.kelvin));
      kelvinRGB(LAMP.kelvin, LAMP.rgb);
    }
  }
  setMood(moodI);
  return lampRig();
}
const lampRig = () => ({ gain: LAMP.gain, angle: LAMP.angle, kelvin: LAMP.kelvin,
                         hex: LAMP.rgb.getHex() });
// THE RESTING VALUES, PUBLISHED. The editor's three lamp knobs are hand-built
// rows with no DEFAULTS table behind them, so "double-click to reset" has to
// read the default from the module that owns it rather than restate it.
const LAMP_0 = { gain: LAMP.gain, angle: LAMP.angle, kelvin: LAMP.kelvin };
const lampRigDefault = () => ({ gain: LAMP_0.gain, angle: LAMP_0.angle,
                                kelvin: LAMP_0.kelvin });

function setLight(k, on) {
  if (!LIGHTS.some(l => l.key === k)) return null;
  muted[k] = !on;
  setMood(moodI);            // re-apply the mood, then the mutes over it
  return !muted[k];
}
// THE MASTER (user: "we need to be able to add lights one by one from
// nothingness (all look black)"). Throwing seven switches by hand is not the
// same instrument: it takes seven re-bakes and seven chances to leave one in
// the wrong state, and the whole point of starting from black is that you know
// what state you are in. `only` is the loop the ablation actually runs.
function setLights(pick) {
  for (const l of LIGHTS) muted[l.key] = !pick(l.key);
  setMood(moodI);
  return LIGHTS.filter(l => !muted[l.key]).map(l => l.key);
}
// WITHOUT THE PAYLOAD there is still a room: the headless gate and any
// core-only build get the alps row's numbers with no picture to hang behind
// them, which is exactly what this shed was before G41.
const MOODS = SKY_ROWS || [
  { key: 'alps', name: 'AFTERNOON', keyI: 2.8, kc: 0xffdca8, hemi: 0.274,
    hemiSky: 0xc5d9ff, hemiGnd: 0x343422, top: 0.567, env: 0.55, lamp: 70,
    ex: 0.92, bg: 0x151511, card: 0xf2ecdc, panel: 2.6, shaft: 0.055 },
];
let moodI = -1;
const setMood = i => {
  const j = Math.max(0, Math.min(MOODS.length - 1, i | 0));
  const m = MOODS[j];
  // THE SKY AND THE SUN MOVE ONLY WHEN THE ROW DOES: a re-apply of the same
  // mood (applyEnv runs on every editor slider drag) must not re-decode a 4k
  // equirect or re-aim a light that is already aimed.
  if (j !== moodI) { moodI = j; setSky(m); aimKey(m.sunUV, m.yaw); }
  key.intensity = m.keyI; key.color.setHex(m.kc);
  // the mood sets the candela; the rig's three knobs ride on top of it
  for (const L of lamps) {
    L.intensity = m.lamp * LAMP.gain;
    L.angle = LAMP.angle;
    L.color.copy(LAMP.rgb);
  }
  // THE FIRE DOES NOT KNOW WHAT TIME IT IS, and tying it to the lamps was a
  // mistake worth recording: scaled that way it went 14 -> 38 cd at night,
  // which is the opposite of what a night wants. It is a constant, set once
  // and reasserted here only so a mood change cannot leave it muted-then-lit.
  if (STOVE.light) STOVE.light.intensity = STOVE.cd0;
  // the environment is baked in ONE sky, so it has to be scaled with
  // everything else or the room stays lit by a sun that has gone
  for (const [mat, e0] of ENV0) mat.envMapIntensity = e0 * (m.env / 0.55);
  // the props are materials too, and they were built after ENV0 was
  // captured — propSetEnv scales the ones already built AND the ones
  // the editor builds later, from the factory's own record
  if (typeof propSetEnv === 'function') propSetEnv(m.env / 0.55);
  // AND SO IS THE AEROPLANE (G67). It never was: app.js set envMapIntensity
  // once when the material was built and nothing touched it again, so under
  // GOLDEN or NIGHT the room dimmed around a machine still reflecting a
  // midday probe. Same shape as the props — the factory keeps each
  // material's own env0 and scales from it, so materials built later by the
  // editor arrive already correct.
  if (typeof aeroSetEnv === 'function') aeroSetEnv(m.env / 0.55);
  BG.setHex(m.bg); FOG.color.setHex(m.bg);
  M.daylight.color.setHex(m.card);
  M.skyPanel.emissiveIntensity = m.panel;
  // the registered emitters. The shop lamps' own shades follow the power knob,
  // because a shade that stays white-hot while its lamp is turned down is the
  // same lie the bulb used to tell.
  for (const e of EMIT)
    e.mat.emissiveIntensity = e.e0 * (e.key === 'lamps' ? LAMP.gain : 1);
  // the filaments follow the lamps they are in, or a night shed has cold bulbs
  // burning in it
  M.bulb.emissiveIntensity = (0.5 + m.lamp / 70) * LAMP.gain;
  M.bulb.emissive.copy(LAMP.rgb);       // a filament is the colour it burns at
  shaftMat.opacity = m.shaft;
  // LAST, so a mood change cannot turn a muted source back on
  applyMutes(m);
  return m;
};

// ---- THE MATERIAL LIBRARY AND THE PART SYSTEM (G41, supersedes G40's
// wall-only wardrobe; user: "manage a material library and assign them
// to parts of the hangar"). The LIBRARY is every payload texture set
// (hangar_walls.js + the floor slab); every PART owns one material
// instance, registered below with its baked originals captured, so any
// part can wear any set — or its baked self — with an independent tile
// size, a roughness multiplier and a normal-influence multiplier.
// Materials stay the SAME OBJECTS in M throughout, so the moods'
// envMapIntensity scaling covers whatever a part wears. r128's one
// uv-transform-per-material (from .map) means tile size is one number
// per part and every map follows. The unused sets get deleted once
// choices settle.
const LIB = {};
if (typeof HANGAR_WALL_SETS !== 'undefined' && HANGAR_WALL_SETS)
  for (const k in HANGAR_WALL_SETS) LIB[k] = HANGAR_WALL_SETS[k];
// the airfield ground sets (G123): ten CC0 scans, and every part may wear any
// of them — the walls included. They carry their own natural tile size as data;
// the live control stays per part.
if (typeof SITE_TEX_SETS !== 'undefined' && SITE_TEX_SETS)
  for (const k in SITE_TEX_SETS) LIB[k] = SITE_TEX_SETS[k];
if (typeof HANGAR_FLOOR_IMG !== 'undefined' && HANGAR_FLOOR_IMG)
  LIB.slabfloor = { name: 'damaged concrete (floor)',
    diff: HANGAR_FLOOR_IMG.diff, nor: HANGAR_FLOOR_IMG.nor,
    rough: HANGAR_FLOOR_IMG.rough, tile: 5 };
// THE OUTDOORS JOINS THE WARDROBE (G123, the user: "add them to the material
// editor, so we can freely pick, like we do for the hangar already"). The four
// site surfaces are ordinary parts: each owns one material instance whose baked
// original is captured below, so any of them can wear any set in LIB — the
// scanned airfield ground, a wall texture, or its own baked self — at an
// independent tile size, roughness and normal influence.
const PARTS = {
  ground:    { name: 'ground',            mat: M.floor,    tile: 5 },
  apron:     { name: 'apron · slab',      mat: M.apron,    tile: 2 },
  taxiway:   { name: 'taxiway',           mat: M.taxi,     tile: 4 },
  grass:     { name: 'field · grass',     mat: M.grass,    tile: 2 },
  strip:     { name: 'runway · strip',    mat: M.strip,    tile: 2 },
  wallSides: { name: 'walls · sides',     mat: M.wall,     tile: 2 },
  wallBack:  { name: 'wall · back',       mat: M.wallBack, tile: 2 },
  stem:      { name: 'brick stem',        mat: M.stem,     tile: 2 },
  roof:      { name: 'roof',              mat: M.roofIn,   tile: 2 },
  beamsMain: { name: 'beams · main',      mat: M.beamMain, tile: 2 },
  beamsSec:  { name: 'beams · secondary', mat: M.beamSec,  tile: 2 },
  windows:   { name: 'windows',           mat: M.glass,    tile: 2 },
  doorMan:   { name: 'man door',          mat: M.manDoor,  tile: 2 },
  doorMain:  { name: 'hangar doors',      mat: M.door,     tile: 2 },
};
// a part whose material was never built (the outdoors, in a payload-less or
// exterior build) is dropped rather than offered: setPart would write into
// undefined and the editor would list a row that does nothing.
for (const k in PARTS) if (!PARTS[k].mat) delete PARTS[k];
// the timber shed has no brick stem to dress — a part row for a surface
// the building does not have is a control wired to nothing (HANGARS S4)
if (FRAME === 'timber') delete PARTS.stem;
for (const k in PARTS) {
  const p = PARTS[k], m = p.mat;
  p.baked = { map: m.map || null, nor: m.normalMap || null,
    rough: m.roughnessMap || null, rough0: m.roughness,
    ns: m.normalScale ? m.normalScale.clone() : null };
  p.state = { set: 'baked', tile: p.tile, rough: 1, nrm: 1 };
  p.cache = {};
}
const partTex = (img, srgb) => {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = (typeof window !== "undefined" && window.FLYDIY_ANISO) || 8;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else img.onload = ok;
  return t;
};
const setPart = (key, st) => {
  const p = PARTS[key];
  if (!p) return null;
  const s = p.state;
  if (st) {
    if (st.set && (st.set === 'baked' || LIB[st.set])) s.set = st.set;
    if (+st.tile > 0) s.tile = Math.max(0.25, Math.min(12, +st.tile));
    if (+st.rough >= 0) s.rough = Math.max(0, Math.min(2, +st.rough));
    if (+st.nrm >= 0) s.nrm = Math.max(0, Math.min(2, +st.nrm));
  }
  const m = p.mat;
  if (s.set === 'baked') {
    m.map = p.baked.map; m.normalMap = p.baked.nor;
    m.roughnessMap = p.baked.rough;
    // ceiling 2, not 1 (G42): a rough map is a MULTIPLICAND, so a
    // multiplier above 1 is the only way to be DULLER than the map
    m.roughness = Math.min(2, p.baked.rough0 * s.rough);
    if (m.normalScale && p.baked.ns)
      m.normalScale.copy(p.baked.ns).multiplyScalar(s.nrm);
  } else {
    let c = p.cache[s.set];
    if (!c) {
      const L = LIB[s.set];
      c = p.cache[s.set] = { map: partTex(L.diff, true),
        nor: partTex(L.nor), rough: partTex(L.rough) };
    }
    m.map = c.map; m.normalMap = c.nor; m.roughnessMap = c.rough;
    m.roughness = Math.min(2, s.rough);
    if (m.normalScale) m.normalScale.set(s.nrm, s.nrm);
    c.map.repeat.set(1 / s.tile, 1 / s.tile);
    c.nor.repeat.copy(c.map.repeat); c.rough.repeat.copy(c.map.repeat);
  }
  m.needsUpdate = true;
  return Object.assign({}, s);
};

// ---- THE GROUND SHADOW BAKE (G58) ------------------------------------------
// The user's diagnosis was right: the car and the drawing table floated,
// because four of the six lamps are PointLights with no shadow map — their
// light goes straight through everything — and SSAO's 0.2 m radius cannot see
// an occluder the size of a car. The floor itself was never the problem (it
// has receiveShadow and shows the window patches); what was missing is the
// AMBIENT shadow, the one a big object prints on the ground under any light.
//
// This is the user's projection idea, generalised: ONE orthographic camera
// UNDER the floor looking up renders every piece of furniture with a depth
// material, so each texel records the height of the LOWEST surface above it —
// which is exactly what a contact shadow depends on. That height becomes an
// intensity (near the floor = dark, 2.6 m up = nothing, above that clipped by
// the camera's own far plane, so the pendant lamps and the roof never print),
// a separable blur gives it a penumbra, and the result is one darkening quad
// laid on the slab. Four draws at 1024^2, once per room build and once per
// mobile-kit move — not per frame.
//
// FROM BELOW, not above: from above the camera sees a table's TOP and a tall
// object would print by its lid; from below it sees the underside — legs
// print hard little feet, the tabletop prints a soft pool, and a car cover
// whose skirt nearly touches the ground prints near-black. That is the
// "truncated to the bottom" in the user's ask, done by the depth test itself.
const GS = { on: true };
const CS = { on: true };   // the aeroplane's own print, below
{
  const SIZE = 1024, CUT = 2.6, LAYER = 3;
  const mk = () => new THREE.WebGLRenderTarget(SIZE, SIZE, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat });
  GS.rtA = mk(); GS.rtB = mk();
  GS.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
  GS.depthMat.side = THREE.DoubleSide;      // undersides face the camera
  GS.cam = new THREE.OrthographicCamera(-HD, HD, HW, -HW, 0.02, CUT);
  GS.cam.up.set(0, 0, 1);
  GS.cam.layers.set(LAYER);
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  // BasicDepthPacking writes 1 - fragCoordZ, and an ortho camera's depth is
  // LINEAR — so the sample IS (1 - height/CUT), and the shaping curve turns it
  // into an intensity. pow on the first pass only; the second just blurs.
  GS.blur = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2(1 / SIZE, 1 / SIZE) },
                uDir: { value: new THREE.Vector2(1, 0) }, uPow: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: [
      'precision highp float; varying vec2 vUv;',
      'uniform sampler2D tSrc; uniform vec2 uTexel, uDir; uniform float uPow;',
      'void main() {',
      '  float w[5]; w[0]=0.227; w[1]=0.194; w[2]=0.121; w[3]=0.054; w[4]=0.016;',
      '  float s = pow(texture2D(tSrc, vUv).r, uPow) * w[0];',
      '  for (int i = 1; i < 5; i++) {',
      '    vec2 o = uDir * uTexel * float(i) * 2.6;',
      '    s += pow(texture2D(tSrc, vUv + o).r, uPow) * w[i];',
      '    s += pow(texture2D(tSrc, vUv - o).r, uPow) * w[i];',
      '  }',
      '  gl_FragColor = vec4(vec3(s), 1.0);',
      '}'].join('\n'),
  });
  GS.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), GS.blur);
  GS.fsScene = new THREE.Scene(); GS.fsScene.add(GS.fsQuad);
  GS.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // THE OVERLAY: a black quad whose alpha is the baked occlusion. alphaMap
  // reads the GREEN channel; the bake writes all three the same. fog off, or
  // the room fog tints the darkening grey.
  const geo = new THREE.PlaneGeometry(2 * HD, 2 * HW);
  {  // the framebuffer's v runs +z -> -z once the plane lies flat; flip to match
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  }
  GS.quad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x000000, alphaMap: GS.rtA.texture, transparent: true,
    opacity: 0.9, depthWrite: false, fog: false }));
  GS.quad.rotation.x = -Math.PI / 2;
  GS.quad.position.y = 0.012;               // above the slab AND the rug
  GS.quad.renderOrder = 1;
  GS.quad.visible = false;                  // nothing to show until a bake ran
  G.add(GS.quad);

  GS.bake = function (renderer, scene) {
    if (!renderer || !scene || !renderer.setRenderTarget) return false;
    try {
      for (const f of FURN)
        if (f) f.traverse(o => { if (o.isMesh) o.layers.enable(LAYER); });
      const gy = ROOT.position.y;
      GS.cam.position.set(0, gy - 0.01, 0);
      GS.cam.lookAt(0, gy + 1, 0);
      const prevT = renderer.getRenderTarget();
      const prevC = renderer.getClearColor(new THREE.Color());
      const prevA = renderer.getClearAlpha();
      const prevO = scene.overrideMaterial;
      renderer.setClearColor(0x000000, 1);
      scene.overrideMaterial = GS.depthMat;
      renderer.setRenderTarget(GS.rtA);
      renderer.clear();
      renderer.render(scene, GS.cam);
      scene.overrideMaterial = prevO;
      GS.blur.uniforms.tSrc.value = GS.rtA.texture;   // shape + blur across
      GS.blur.uniforms.uDir.value.set(1, 0);
      GS.blur.uniforms.uPow.value = 1.6;
      renderer.setRenderTarget(GS.rtB);
      renderer.render(GS.fsScene, GS.fsCam);
      GS.blur.uniforms.tSrc.value = GS.rtB.texture;   // blur down
      GS.blur.uniforms.uDir.value.set(0, 1);
      GS.blur.uniforms.uPow.value = 1.0;
      renderer.setRenderTarget(GS.rtA);
      renderer.render(GS.fsScene, GS.fsCam);
      // A SECOND PASS-PAIR. One gaussian leaves the fringe around a car-sized
      // occluder ~20 cm wide, which vanishes under the object's own sides; a
      // contact shadow reads by the ring that PEEKS OUT, so the ring has to be
      // wide enough to peek. Two iterations ~= 40 cm of penumbra.
      GS.blur.uniforms.tSrc.value = GS.rtA.texture;
      GS.blur.uniforms.uDir.value.set(1, 0);
      renderer.setRenderTarget(GS.rtB);
      renderer.render(GS.fsScene, GS.fsCam);
      GS.blur.uniforms.tSrc.value = GS.rtB.texture;
      GS.blur.uniforms.uDir.value.set(0, 1);
      renderer.setRenderTarget(GS.rtA);
      renderer.render(GS.fsScene, GS.fsCam);
      renderer.setRenderTarget(prevT);
      renderer.setClearColor(prevC, prevA);
      GS.quad.visible = GS.on;
      return true;
    } catch (e) {
      if (window.console) console.warn('ground shadow bake:', e.message);
      return false;
    }
  };
  GS.dispose = function () {
    GS.rtA.dispose(); GS.rtB.dispose();
    CS.rtA.dispose(); CS.rtB.dispose();
    if (CS.quad.geometry) CS.quad.geometry.dispose();
    GS.blur.dispose(); GS.depthMat.dispose(); GS.fsQuad.geometry.dispose();
  };

  // ---- THE AEROPLANE'S OWN PRINT (G59) -------------------------------------
  // The furniture bake deliberately leaves the aeroplane out: it changes with
  // every slider, and re-baking the whole room per drag is the wrong trade.
  // This is the user's counter-proposal — a SMALL sprite just for the plane,
  // dynamic. Same recipe end to end (under-floor ortho, lowest surface,
  // pow + blur), but the camera and the quad are sized to the CRAFT's own
  // footprint and the target is 256^2, so a bake is four small draws and the
  // sliders never feel it. Layer 4, so the room bake (layer 3) never sees the
  // plane and this one never sees the room.
  {
    const SIZE = 256, CUT = 2.6, LAYER = 4, PAD = 0.9;
    const mk = () => new THREE.WebGLRenderTarget(SIZE, SIZE, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat });
    CS.rtA = mk(); CS.rtB = mk();
    CS.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.02, CUT);
    CS.cam.up.set(0, 0, 1);
    CS.cam.layers.set(LAYER);
    const geo = new THREE.PlaneGeometry(1, 1);
    { const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }
    CS.quad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x000000, alphaMap: CS.rtA.texture, transparent: true,
      opacity: 0.9, depthWrite: false, fog: false }));
    CS.quad.rotation.x = -Math.PI / 2;
    // a hair above the furniture quad, so the two never z-fight where the
    // mobile kit's print runs under a wing
    CS.quad.position.y = 0.016;
    CS.quad.renderOrder = 1;
    CS.quad.visible = false;
    G.add(CS.quad);

    CS.bake = function (renderer, scene, craft) {
      if (!renderer || !scene || !craft || !renderer.setRenderTarget) return false;
      try {
        const bb = new THREE.Box3().setFromObject(craft);
        if (!isFinite(bb.min.x) || bb.max.x <= bb.min.x) {
          CS.quad.visible = false;
          return false;
        }
        craft.traverse(o => { if (o.isMesh) o.layers.enable(LAYER); });
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        const hw = (bb.max.x - bb.min.x) / 2 + PAD, hh = (bb.max.z - bb.min.z) / 2 + PAD;
        const gy = ROOT.position.y;
        CS.cam.left = -hw; CS.cam.right = hw; CS.cam.top = hh; CS.cam.bottom = -hh;
        CS.cam.updateProjectionMatrix();
        CS.cam.position.set(cx, gy - 0.01, cz);
        CS.cam.lookAt(cx, gy + 1, cz);
        const prevT = renderer.getRenderTarget();
        const prevC = renderer.getClearColor(new THREE.Color());
        const prevA = renderer.getClearAlpha();
        const prevO = scene.overrideMaterial;
        renderer.setClearColor(0x000000, 1);
        scene.overrideMaterial = GS.depthMat;
        renderer.setRenderTarget(CS.rtA);
        renderer.clear();
        renderer.render(scene, CS.cam);
        scene.overrideMaterial = prevO;
        // the shared blur, retuned to this target's texel and put back after
        GS.blur.uniforms.uTexel.value.set(1 / SIZE, 1 / SIZE);
        const pass = (src, dst, dir, pw) => {
          GS.blur.uniforms.tSrc.value = src.texture;
          GS.blur.uniforms.uDir.value.set(dir[0], dir[1]);
          GS.blur.uniforms.uPow.value = pw;
          renderer.setRenderTarget(dst);
          renderer.render(GS.fsScene, GS.fsCam);
        };
        pass(CS.rtA, CS.rtB, [1, 0], 1.6);
        pass(CS.rtB, CS.rtA, [0, 1], 1.0);
        GS.blur.uniforms.uTexel.value.set(1 / 1024, 1 / 1024);
        renderer.setRenderTarget(prevT);
        renderer.setClearColor(prevC, prevA);
        // the quad wears the print exactly where the camera looked
        CS.quad.scale.set(2 * hw, 2 * hh, 1);
        CS.quad.position.x = cx; CS.quad.position.z = cz;
        CS.quad.visible = CS.on;
        return true;
      } catch (e) {
        if (window.console) console.warn('craft shadow bake:', e.message);
        return false;
      }
    };
  }
}

// A ROOM IS NEVER SKYLESS. The sky belongs to the mood now, so a caller that
// forgets to set one would get a backdrop sphere with no picture on it — this
// is the room's own default, and any caller's own setMood immediately replaces
// it. (`moodI` starts at -1 so the first call always installs.)
setMood(0);
texBudget();          // print the fragment-sampler count, once, per G66

return {
  group: ROOT, background: BG, fog: FOG,
  library: [{ key: 'baked', name: '(part’s own)' }].concat(
    Object.keys(LIB).map(k => ({ key: k, name: LIB[k].name || k }))),
  parts: Object.keys(PARTS).map(k => ({ key: k, name: PARTS[k].name })),
  setPart, partState: k => (PARTS[k] ? Object.assign({}, PARTS[k].state) : null),
  dayCard: M.dayCardMesh || null, hasSky: !!skyMat,
  // the aeroplane stands on the floor at y = 0 in the room's own frame, nose
  // toward the door at -x. The caller lines the room up with the aeroplane
  // rather than moving the aeroplane, so the sim keeps its own coordinates.
  doorAxis: -1, floorY: 0,
  dims: { HW: HW, HD: HD, EAVE: EAVE, RIDGE: RIDGE },
  shell: SHELL,
  // the fit-out this room was built with, and what would not fit (HANGARS
  // S2): the editor paints the report, the gate asserts nothing is dropped
  // silently
  kits: KITS.slice(), fitReport: FIT,
  lights: { key: key, lamps: lamps },
  lampRig: lampRig, setLampRig: setLampRig, lampRigDefault: lampRigDefault,
  texBudget: texBudget,        // dev: what the room costs in fragment samplers
  census: census,              // dev: meshes and triangles, which ARE draw calls here
  mats: M, shafts: shafts, faceShafts: faceShafts,
  // the kit that follows the aeroplane, and the equirect the caller may bake
  // an environment from instead of the room's own cube pass
  placeMobile: placeMobile, mobile: mobileList, mobileShow: mobileShow,
  // the baked floor shadow: re-run after anything on the floor moves
  bakeGroundShadow: GS.bake, disposeGroundShadow: GS.dispose,
  bakeCraftShadow: CS.bake,
  _gs: GS,                           // dev handle: the bake's own targets
  groundShadow: v => {
    if (v !== undefined) {
      GS.on = CS.on = v > 0;
      GS.quad.material.opacity = CS.quad.material.opacity = Math.max(0, Math.min(1, v));
      GS.quad.visible = GS.on && GS.quad.material.alphaMap === GS.rtA.texture;
      if (!CS.on) CS.quad.visible = false;
    }
    return GS.on ? GS.quad.material.opacity : 0;
  },
  // THE SKY IS LIVE NOW (G62): it changes with the mood, so the caller that
  // PMREMs it has to be able to ask for the current one rather than being
  // handed one at build time — and to be told when a swapped-in equirect has
  // finished decoding, since a bake against a blank texture is a black room.
  // A GRADED ROOM HAS NO MAP to hand over - the picture only exists as the
  // sphere's own shader - so it answers with the small target instead, which
  // is the same pixels at probe resolution. `renderSky` is idempotent: it
  // returns the existing target unless a mood (or a decode) dirtied it.
  skyTexture: () => (skyMat && skyMat.map ? skyMat.map
    : (skyRT && !skyDirty ? skyRT.texture : null)),
  // the GPU/baked switch. `null` from setSkyMode means this payload has only
  // one of the two, which is the case for the shipping set.
  skyModes: () => {
    const r = MOODS[Math.max(0, moodI)] || {};
    const m = [];
    if (r.u && gradeReady) m.push(['gpu', 'GPU shader (one panorama)']);
    if (typeof r.img === 'function') m.push(['baked', 'precomputed pictures']);
    return m;
  },
  skyMode: () => skyMode,
  setSkyMode: m => {
    const want = m === 'baked' ? 'baked' : 'gpu';
    if (want === skyMode) return skyMode;
    skyMode = want;
    const row = MOODS[Math.max(0, moodI)];
    if (row) setSky(row);
    return skyMode;
  },
  renderSky: r => (gradeReady ? (skyDirty || !skyRT ? renderSky(r)
                                                    : skyRT.texture) : null),
  graded: !!(SKY_GRADE && gradeReady),
  _skyRT: () => skyRT,          // dev handle: the probe reads it back to
                                // check the shader against the offline grade

  onSkyReady: fn => { skyOnReady = fn; },
  moods: MOODS.map(m => m.name || m.n), setMood: setMood,
  mood: () => moodI,
  // THE LIGHT SWITCHES: one per source, so a test can ask which one is doing
  // it. NOT `lights` - that name is already the dev handle onto the light
  // OBJECTS four lines up, and an object literal carrying a name twice keeps
  // only the last one. That is the second time this file has been bitten by
  // exactly that (see `keyI`), and the first symptom is always a handle that
  // silently becomes something else.
  lightSwitches: LIGHTS.map(l => ({ key: l.key, name: l.name, kind: l.kind })),
  lightOn: k => lit(k),
  setLight: setLight,
  setLights: setLights,
  // the room's own census claim: every material and light a switch can reach.
  // LIGHT_RIG.census compares this against the scene graph, and anything
  // emitting that is not in here is a source with no switch — which is what
  // this bug has been, three times, in three different disguises.
  claimed: () => {
    const s = new Set();
    for (const e of EMIT) s.add(e.mat);
    s.add(M.bulb); s.add(M.skyPanel); s.add(M.daylight);
    if (skyMesh && skyMesh.material) s.add(skyMesh.material);
    if (shaftMat) s.add(shaftMat);
    s.add(key); if (STOVE.light) s.add(STOVE.light);
    for (const L of lamps) s.add(L);
    return s;
  },
  // the surfaces the reflection probe sees UNDER itself, for the bake to
  // occlude — see LIGHT_RIG.groundBounce
  groundMats: GROUND,
  // the subset that stands OUTSIDE the shed: app.js lights these off the sky
  // rather than off the room's own probe. See the declaration near the top.
  outdoorMats: OUTDOOR,
};
}
