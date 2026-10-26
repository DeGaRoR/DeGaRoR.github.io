// THE HANGAR SHELLS (G405, the user: "generate the 3 hangars of the presets,
// with accurate geometry, but shut the door, have no interior assets, and
// give them all the necessary external polish; non-transparent, lightable
// windows, framing around windows and opening, water management, a chimney
// and some smoke, the works") — the garage's three shells (HANGARS.md S4:
// `field` the timber shed, `club` the steel portal, `works` the same portal
// bigger) as EXTERIOR assets for the world, built the way the house and the
// big buildings are (the kit's bags, the house's dressing, a finish of their
// own) so the premises stands them like any other item.
//
// THE GEOMETRY IS hangar.js's, restated: HW/HD are HALF extents (a club
// hangar is 30 x 25 m), the eave EAVE, the ridge EAVE + 2.6; the big door
// DOOR_W = max(6, 2HW - 5) x DOOR_H = min(6.4, EAVE - 1.4) (the timber shed:
// EAVE - 0.5), SIX leaves closed across it (three a side meeting in the
// middle, each a corrugated skin in a channel frame with its brace) - the
// timber shed's one leaf on a track; the BACK bi-parting pair BD_W = min(11,
// 2HW - 8) x BD_H = min(4.4, EAVE - 2.2); the brick STEM 1.1 m round the
// portal shells; the GLAZING BAND 3.2-5.2 m down both flanks (stepping down
// with a low eave), one small window per flank on the timber shed at 30 %
// of the depth toward the back; the personnel door on the back wall at
// z = min(13.5, HW - 1.5) with a high window; the ROOF LIGHTS at
// max(2, round(2HD / 6.25)) per slope between 30 and 62 % of the slope, half
// a width 1.8 - none on the timber shed.
//
// THE FRAME, the house's: the slab's centre at the origin, +z THE DOOR END
// (the road side), x across the width, z along the depth; the ridge runs
// along z. `P.ground(lx, lz)` when the world hands one in.
//
// THE SHELL IS hangar.js's OWN (G405.1, the user: "did you actually get the
// dimension, models and textures of the actual hangar presets ... You
// should really take everything you can from the existing hangar generator,
// especially geometry, dimensions and textures, then modify for outside
// assets"): in the browser the build calls `genHangarBuild(THREE, dims,
// { exterior: true, shell })` - the very exterior render_world stands by the
// strip, with hangar.js's baked sheets (its corrugation, its brick stem, its
// door skins, its steel and timber) - and BAKES that group into bags, one
// per hangar material (`h_wall`, `h_stem`, `h_door`, ...), so the shell is
// a dozen draw calls instead of 278 meshes and rides the item pipeline like
// any generator's build. The glass meshes bake into `h_pane`, OPAQUE (there
// is nothing inside) and lit on the switch. What this file adds is the
// OUTSIDE polish hangar.js never needed: the casings round the band, the
// windows and the doors (the house's dressOpening), the gutters and
// downpipes (the house's trough), the flue with its smoke (the house's
// buildSmoke), the bulkheads over the door, the sign. Headless (the gate,
// node) there is no canvas to bake sheets on, so the shell falls back to
// THE RESTATED ONE below (hangar.js's numbers drawn with the kit) - the
// same footprint, the same openings, the scan wardrobe for its faces.
'use strict';
(() => {
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, off, Bag, face, uvFrame, boxAB, beam, plate, cyl, wall } = K;
const D2R = Math.PI / 180;

// ---- the materials: the big buildings' wardrobe (the hangar's wall sets) plus the house's finish
const HANGAR_TILE = () => (typeof HANGAR_WALL_TILE_M !== 'undefined' ? HANGAR_WALL_TILE_M : 2);
const ROLE_SETS = {
  wall:   [['hangar', 'rustysheet'], ['hangar', 'rustymetal'], ['hangar', 'factory'], ['hangar', 'rawplank'], ['house', 'corrworn'], ['house', 'boxprof'], ['house', 'paintwood'], ['house', 'board']],
  stem:   [['hangar', 'sandstone'], ['hangar', 'concrete008'], ['hangar', 'concrete004']],
  roof:   [['house', 'corrworn'], ['house', 'galv'], ['house', 'corrrust'], ['house', 'boxprof'], ['hangar', 'rustysheet']],
  door:   [['hangar', 'rustymetal'], ['hangar', 'rustysheet'], ['hangar', 'factory'], ['house', 'galv'], ['house', 'board']],
  metal:  [['house', 'galv'], ['house', 'rust']],
  beam:   [['house', 'rough'], ['house', 'mossy'], ['house', 'veneerdark']],
};
const SET_IDX = (role, key) => Math.max(0, ROLE_SETS[role].findIndex(s => s[1] === key));
const setNames = role => ROLE_SETS[role].map(s => s[1]);
const libOf = lib => (lib === 'hangar' ? ((typeof HANGAR_WALL_SETS !== 'undefined' && HANGAR_WALL_SETS) || null) : HG.libSets());
const TEXC = new Map();
function texOf(lib, key, mapName) {
  const S = libOf(lib), set = S && S[key];
  if (!set) return null;
  const img = set[mapName === 'nor' && lib === 'hangar' ? 'nor' : mapName];
  if (!img) return null;
  // G903: a FLAT map ships as its constant [r, g, b] - the shared 1x1 (src/viewer/assets.js TEX_FLAT)
  if (Array.isArray(img)) return TEX_FLAT(img, (mapName === 'diff' || mapName === 'paint') ? THREE.SRGBColorSpace : '');
  const ck = lib + '|' + key + '|' + mapName;
  if (TEXC.has(ck)) return TEXC.get(ck);
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (mapName === 'diff' || mapName === 'paint') t.colorSpace = THREE.SRGBColorSpace;
  const tile = lib === 'hangar' ? HANGAR_TILE() : (set.tile || 2);
  t.repeat.set(1 / tile, 1 / tile);
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else if (img.addEventListener) img.addEventListener('load', ok);
  TEXC.set(ck, t);
  return t;
}
const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.92, metalness: 0 }, o || {}));
function makeMats() {
  return {
    wall: std(0x8a7f74), stem: std(0x8c8a84), roof: std(0x6f7478, { roughness: 0.6, metalness: 0.3 }),
    door: std(0x6a5a4c, { roughness: 0.7, metalness: 0.3 }), metal: std(0xa9b1b6, { roughness: 0.45, metalness: 0.75 }),
    beam: std(0x8a7358),
  };
}
const BAGS = ['wall', 'stem', 'roof', 'door', 'metal', 'beam', 'trim', 'pane', 'glass'];
const EXTRA = ['aoskirt', 'smoke'];
const makeFinish = () => { const HF = HG.makeFinish(); const M = makeMats(); M.trim = HF.MAT.trim; M.pane = HF.MAT.pane; M.glass = HF.MAT.glass; M.smoke = HF.MAT.smoke; M.aoskirt = HF.MAT.aoskirt; return { MAT: M, SHADE_U: HG.makeShadeU(), HF }; };
const DEFAULT_FINISH = makeFinish();
const MAT = DEFAULT_FINISH.MAT;
function houseP(P) {
  return Object.assign({}, HG.DEF, {
    trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: P.trimCol === undefined ? 6 : P.trimCol, trimW: P.trimW || 0.08,
    dirt: P.dirt, dirtH: P.dirtH, noise: P.noise, clouds: P.clouds, weather: 0.4, paintPunch: 0.9,
    curtains: 0, muntin: 0, doorLight: 0, doorAjar: 0, hand: 0, bevel: 0.006,
    lights: P.lights ? 1 : 0, winLit: 0.6, winLink: 1, porchLamp: 1, lampKind: 1, lightSeed: P.seed || 1,
    floorY: P.floorY, slopeX: P.slopeX, slopeZ: P.slopeZ, ground: P.ground,
    smoke: P.smoke, smokeK: P.smokeK, smokeLean: P.smokeLean,
    ao: P.ao, aoRange: P.aoRange, aoDirect: P.aoDirect,
  });
}
function dress(m, role, idx, o) {
  const list = ROLE_SETS[role];
  const [lib, key] = list[clamp(Math.round(idx || 0), 0, list.length - 1)];
  const opt = o || {};
  const S = libOf(lib), painted = !!(opt.tint && opt.tint !== 0xffffff && S && S[key] && S[key].paint);
  const d = texOf(lib, key, painted ? 'paint' : 'diff');
  if (!d) { m.color.setHex(opt.flat || 0xb0aaa2); return; }
  m.map = d; m.normalMap = texOf(lib, key, 'nor'); m.roughnessMap = texOf(lib, key, 'rough');
  m.color.setHex(opt.tint || 0xffffff);
  m.metalness = opt.metal === undefined ? (role === 'metal' ? 0.85 : (role === 'roof' || role === 'door' ? 0.35 : 0)) : opt.metal;
  m.roughness = 1; if (m.normalScale) m.normalScale.set(1, 1); m.needsUpdate = true;
}

// ---- the dials
const SHELLS = ['field', 'club', 'works'];
const DEF = {
  seed: 3, shell: 1, HW: 15, HD: 12.5, EAVE: 7.0, floorY: 0.25, wallT: 0.12,
  slopeZ: 0, slopeX: 0,
  rakeOver: 0.3, eaveOver: 0.5, roofT: 0.06,   // hangar.js's deck: x +-(HD + 0.3), z +-(HW + 0.5)
  glazing: 1, roofLights: 1, backDoor: 1, personDoor: 1,
  gutter: 1, flue: 1, smoke: 1, smokeK: 0.55, smokeLean: 0.35, lights: 0,
  sign: 0, signKey: '', signW: 4.0,
  signPlank: 0, signIn: 0, signInX: 0,   // G3540: the sign as a hung plank; a second one inside, on the back wall at house x
  signInWall: 0,   // G3540: the inside one's wall - 0 the back wall (at house x signInX), 1 / -1 the flank at house x = +-HW (at house z signInX)
  footAO: 0, footH: 1.0, pad: null,   // G3542: the ground's dark on the walls' foot (the dirt line taken dark); G3541/G3542: the shed's ground pad (groundDials)
  wallSet: SET_IDX('wall', 'rustysheet'), wallTint: 0xffffff, stemSet: SET_IDX('stem', 'sandstone'),
  roofSet: SET_IDX('roof', 'corrworn'), doorSet: SET_IDX('door', 'rustymetal'), metalSet: SET_IDX('metal', 'galv'),
  beamSet: SET_IDX('beam', 'rough'), trimCol: 6, trimW: 0.08,
  dirt: 0.5, dirtH: 1.1, noise: 0.16, clouds: 0.5,
  // G3538 (HANGARS-LOOK, the user 25 Oct: "use all the tricks and details of the house generation, and the weathering
  // techniques used for generating the old mine"): the mine's dials, on the shell too - `weather` (the house's: chroma out,
  // contrast flatter, the dirt up), the walls' cloud weathering and the roof's (`roofClouds`, a whisper), `age` (the
  // frame's greying: desaturated and darker, as the mine's bare timber), `rust` (the house's steel mix on the gutters, the
  // pipes and the fittings: rain on the up faces, streaks down), `bulkheads` (the lamp fittings over the door, unlit)
  weather: 0, roofClouds: 0.12, age: 0, rust: 0, bulkheads: 0,
  ao: 0.85, aoRange: 0.7, aoDirect: 0.35, aoGround: 1,
};
const ROWS = [
  ['the shell', [
    ['shell', 'family', 0, 2, 1, SHELLS],
    ['HW', 'half width', 4, 24, 0.5], ['HD', 'half depth', 4, 24, 0.5], ['EAVE', 'eave', 3, 12, 0.1],
    ['floorY', 'slab above datum', 0, 1.2, 0.05], ['slopeZ', 'ground slope z', -8, 8, 0.5], ['slopeX', 'ground slope x', -6, 6, 0.5],
  ]],
  ['the openings', [
    ['glazing', 'the glazing band / the flank windows', 0, 1, 1], ['roofLights', 'roof lights', 0, 1, 1],
    ['backDoor', 'the back doors', 0, 1, 1], ['personDoor', 'the personnel door', 0, 1, 1],
  ]],
  ['the works', [
    ['gutter', 'gutters + downpipes', 0, 1, 1], ['flue', 'the stove flue', 0, 1, 1], ['smoke', 'smoke', 0, 1, 1, null, P => !!P.flue],
    ['lights', 'lights', 0, 1, 1], ['sign', 'a sign over the door', 0, 1, 1],
    ['signKey', 'billboard', 0, 0, 1, [''].concat(Object.keys((typeof SIGN_TEX_META !== 'undefined' && SIGN_TEX_META) || {})), P => !!P.sign],
    ['signW', 'its width', 1, 8, 0.1, null, P => !!P.sign],
    ['signPlank', 'a hung plank', 0, 1, 1, null, P => !!P.sign],
    ['signIn', 'one inside too', 0, 1, 1, null, P => !!P.sign && !!P.signPlank],
    ['signInWall', 'on the back / a flank', -1, 1, 1, null, P => !!P.sign && !!P.signIn],
    ['footAO', 'the dark foot', 0, 0.9, 0.05], ['footH', 'its height', 0.2, 3, 0.05],
    ['signInX', 'inside, along the back', -20, 20, 0.1, null, P => !!P.signIn],
  ]],
  ['finish', [
    ['wallSet', 'wall', 0, ROLE_SETS.wall.length - 1, 1, setNames('wall')], ['stemSet', 'stem', 0, ROLE_SETS.stem.length - 1, 1, setNames('stem')],
    ['roofSet', 'roof', 0, ROLE_SETS.roof.length - 1, 1, setNames('roof')], ['doorSet', 'doors', 0, ROLE_SETS.door.length - 1, 1, setNames('door')],
    ['metalSet', 'steel', 0, ROLE_SETS.metal.length - 1, 1, setNames('metal')], ['beamSet', 'timber', 0, ROLE_SETS.beam.length - 1, 1, setNames('beam')],
    ['trimCol', 'casing paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['dirt', 'dirt', 0, 1, 0.05], ['dirtH', 'dirt height', 0.3, 2.5, 0.05], ['clouds', 'weather clouds', 0, 1, 0.05],
    ['ao', 'baked occlusion', 0, 1, 0.05], ['aoGround', 'ground skirt', 0, 1, 1],
  ]],
];
// THE THREE SHELLS OF THE GARAGE (HANGARS.md S4), and the airport rows they anchor
const PRESETS = {
  // (G3538: the timber sheds wear the old mine's weathering - the kennecott mill's dials, a little gentler)
  'field shed':   { shell: 0, HW: 7, HD: 9, EAVE: 3.6, wallSet: SET_IDX('wall', 'rawplank'), roofSet: SET_IDX('roof', 'corrrust'), doorSet: SET_IDX('door', 'board'), trimCol: 0, glazing: 1, roofLights: 0, backDoor: 0, personDoor: 1, dirt: 0.7, dirtH: 1.4,
                    weather: 0.8, clouds: 0.75, roofClouds: 0.15, age: 0.45, rust: 0.4, bulkheads: 1 },
  'field shed, small': { shell: 0, HW: 5.5, HD: 7, EAVE: 3.3, wallSet: SET_IDX('wall', 'rawplank'), roofSet: SET_IDX('roof', 'corrworn'), doorSet: SET_IDX('door', 'board'), trimCol: 0, glazing: 1, roofLights: 0, backDoor: 0, personDoor: 0, flue: 0, smoke: 0,
                    dirt: 0.7, dirtH: 1.4, weather: 0.8, clouds: 0.75, roofClouds: 0.15, age: 0.45, rust: 0.4 },
  'club hangar':  { shell: 1, HW: 15, HD: 12.5, EAVE: 7.0 },
  'club hangar, long': { shell: 1, HW: 12, HD: 16, EAVE: 6.5, wallSet: SET_IDX('wall', 'rustymetal'), roofSet: SET_IDX('roof', 'galv') },
  'works hangar': { shell: 2, HW: 20, HD: 20, EAVE: 9.5, wallSet: SET_IDX('wall', 'factory'), roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'factory'), stemSet: SET_IDX('stem', 'concrete008'), sign: 1, signW: 6 },
};
const CATS = { 'field shed': 'airport xs', 'field shed, small': 'airport xs', 'club hangar': 'airport s', 'club hangar, long': 'airport s', 'works hangar': 'airport m' };
const catOf = name => CATS[name] || null;

// ---- the numbers hangar.js derives (restated once, here)
function shellOf(P) {
  const timber = Math.round(P.shell) === 0;
  const HW = P.HW, HD = P.HD, EAVE = P.EAVE, RIDGE = EAVE + 2.6;   // hangar.js: RIDGE = EAVE + 2.6, every shell
  const D0 = { door: P.doorW };   // G3537: a shed's own door (hangar.js's expression)
  const DOOR_W = (D0.door > 0) ? Math.min(D0.door, 2 * HW - 1) : Math.max(6, 2 * HW - 5), DOOR_H = timber ? EAVE - 0.5 : Math.min(6.4, EAVE - 1.4);
  const BD_W = Math.min(11.0, 2 * HW - 8), BD_H = Math.min(4.4, EAVE - 2.2);
  const SILL = Math.min(3.2, EAVE - 2.4), HEAD = Math.min(5.2, EAVE - 1.0);
  const MDZ = Math.min(13.5, HW - 1.5);                     // the personnel door, across from the middle (hangar.js's z)
  const NLIGHT = timber ? 0 : Math.max(2, Math.round(2 * HD / 6.25));
  return { timber, HW, HD, EAVE, RIDGE, DOOR_W, DOOR_H, BD_W, BD_H, SILL, HEAD, MDZ, NLIGHT, STEM: timber ? 0 : 1.1 };
}
function rng(seed) { let st = ((seed | 0) * 2654435761 + 11) >>> 0; return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- the build ---------------------------------------------------------------
// THE SIGN AS A PLANK (G3540): a board of the frame's own timber (bags.beam: its edges are wood) standing `z` off the
// wall's plane (its back there, its face toward +z), turned `rot` in its own plane, the painted face over it on the glass
// slot - the billboard alpha-cut at 0.5, so the painted board's own ragged edge is the silhouette; the body is held a
// little inside that edge so it never shows round it. Returns the face's place (the sign slot's reading).
function signPlank(bags, Q, o) {
  // G3540 v2 (the user 25 Oct: "a wooden plank with the wood texture, the image projected on top ... the thickness UV
  // mapped properly, end grain on the edges"): the plank is the whole board in the beam's wood - its face, its two long
  // edges along the grain, its two ends ACROSS it (u up the end, v through the thickness, packed tight: the rings of a
  // sawn end) - and the painted image lies on it, alpha-cut, so where the painting is clear the wood shows. `yaw` turns
  // the board about y (0: facing +z); `rot` tilts it in its own plane.
  const yw = o.yaw || 0, N = [Math.sin(yw), 0, Math.cos(yw)], Rr = [Math.cos(yw), 0, -Math.sin(yw)], Y = [0, 1, 0];
  const c = Math.cos(o.rot), s = Math.sin(o.rot), X = add(mul(Rr, c), mul(Y, s)), U = add(mul(Rr, -s), mul(Y, c)), t = 0.04;
  const at = (a, b, d) => add(add(add([o.x, o.y, o.z], mul(X, a)), mul(U, b)), mul(N, d));
  const hw2 = o.w / 2, hh = o.h / 2, d0 = 0.004, d1 = d0 + t;
  const loc = (p, d) => { const q = sub(p, at(0, 0, d)); return [dot(q, X), dot(q, U)]; };
  // the face, the long edges (the grain along), the ends (end grain); no back - it is on the wall
  face(bags.beam, [at(-hw2, -hh, d1), at(hw2, -hh, d1), at(hw2, hh, d1), at(-hw2, hh, d1)], N, p => { const l = loc(p, d1); return [l[0] + hw2, l[1] + hh]; });
  for (const sb of [-1, 1])
    face(bags.beam, [at(-hw2, sb * hh, d0), at(hw2, sb * hh, d0), at(hw2, sb * hh, d1), at(-hw2, sb * hh, d1)], mul(U, sb),
         p => { const q = sub(p, at(0, 0, 0)); return [dot(q, X) + hw2, dot(q, N) * 3]; });
  for (const sa of [-1, 1])
    face(bags.beam, [at(sa * hw2, -hh, d0), at(sa * hw2, hh, d0), at(sa * hw2, hh, d1), at(sa * hw2, -hh, d1)], mul(X, sa),
         p => { const q = sub(p, at(0, 0, 0)); return [(dot(q, U) + hh) * 0.35, dot(q, N) * 6]; });
  // the painting, 4 mm proud of the wood
  const df = d1 + 0.004;
  face(bags.glass, [at(-hw2, -hh, df), at(hw2, -hh, df), at(hw2, hh, df), at(-hw2, hh, df)], N, p => { const l = loc(p, df); return [l[0] / o.w + 0.5, l[1] / o.h + 0.5]; });
  // NO SHADOW IS CAST (the face is alpha-cut; the user: "fake it"): a soft dark rectangle on the wall behind the board, a
  // little low (the light is from above), its edge fading over 12 cm - the contact the board would leave - in the ground
  // skirt's bag (the house's multiply-dark, its alpha from the vertex: no new draw)
  const sk = bags.aoskirt;
  if (sk) {
    const dz = 0.002, k = 0.5, sp = 0.12, lo = 0.05;
    const P0 = (a, b, gl) => { sk.setGlow(gl); return sk.v(at(a, b - lo, dz), [0, 0]); };
    const inn = [P0(-hw2 - 0.01, -hh - 0.01, k), P0(hw2 + 0.01, -hh - 0.01, k), P0(hw2 + 0.01, hh + 0.01, k), P0(-hw2 - 0.01, hh + 0.01, k)];
    const out = [P0(-hw2 - sp, -hh - sp, 0), P0(hw2 + sp, -hh - sp, 0), P0(hw2 + sp, hh + sp * 0.6, 0), P0(-hw2 - sp, hh + sp * 0.6, 0)];
    sk.quad(inn[0], inn[1], inn[2], inn[3]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; sk.quad(out[i], out[j], inn[j], inn[i]); }
    sk.setGlow(0);
  }
  const F0 = at(0, 0, df);
  return { x: F0[0], y: F0[1], z: F0[2], w: o.w, h: o.h, nx: N[0], nz: N[2], rot: o.rot };
}
// a shed's own sign (a plot's dims.sign: { key, w, inside }) as the build's dials, for the world's shed and the room alike;
// `spot` (the room's, from its fit: hangarSignSpot) says where the inside one hangs: { wall: 0 the back, 1 / -1 a flank, at }
function signDials(sg, spot) {
  if (!sg || typeof sg.key !== 'string' || !sg.key) return { sign: 0, signKey: '' };
  const inside = typeof sg.inside === 'number' && isFinite(sg.inside);
  const sp = spot && typeof spot.at === 'number' && isFinite(spot.at) ? spot : null;
  return { sign: 1, signKey: sg.key, signW: sg.w > 0 ? sg.w : 2, signPlank: 1, signIn: inside ? 1 : 0,
           signInX: sp ? sp.at : (inside ? sg.inside : 0), signInWall: sp ? (sp.wall | 0) : 0 };
}
// G3541/G3542 (the user 25 Oct: "the pavement in front: concrete in the garage and dirt in the world - aligned and using
// the same materials"; "the building is not anchored"): a plot's dims.ground - { set, apron, side, ring, fade, ao, foot }
// - as the build's dials, for the world's shed and the room alike. The pad (padData) is ONE draped grid in the house frame:
// the apron `apron` m out of the door, `side` m past each flank, `ring` m round the back; the set's own texture at metric
// uv; its alpha fading over `ring` at the back and the flanks and over `fade` at the front; its colour the ground's
// occlusion - `ao` dark at the walls, gone `ring` m out ((1 - d)^2, the skirt's own curve). `foot`: the walls' dark foot.
function groundDials(gd) {
  if (!gd || typeof gd.set !== 'string' || !gd.set) return { pad: null, footAO: 0 };
  const n = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : d;
  const pad = { set: gd.set, apron: n(gd.apron, 12, 0, 60), side: n(gd.side, 1, 0.3, 20), ring: n(gd.ring, 1, 0.3, 4),
                fade: n(gd.fade, 2, 0.3, 10), ao: n(gd.ao, 0.55, 0, 0.9), tile: n(gd.tile, 2, 0.25, 20), cell: 1 };
  return { pad, footAO: n(gd.foot, 0.5, 0, 0.9), footH: n(gd.footH, 1.0, 0.2, 3), aoGround: 0 };
}
function padData(T, g, HW, HD) {
  const ring = T.ring, side = Math.max(ring, T.side), x0 = -HW - side, x1 = HW + side, z0 = -HD - ring, z1 = HD + Math.max(T.apron, ring);
  const nx = Math.max(2, Math.ceil((x1 - x0) / T.cell)), nz = Math.max(2, Math.ceil((z1 - z0) / T.cell));
  const sm = v => { const q = Math.max(0, Math.min(1, v)); return q * q * (3 - 2 * q); };
  const pos = [], uv = [], col = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const X = x0 + (x1 - x0) * i / nx, Z = z0 + (z1 - z0) * j / nz;
    const a = sm(Math.min(X - x0, x1 - X) / side) * sm((Z - z0) / ring) * sm((z1 - Z) / T.fade);
    const dx = Math.max(0, Math.abs(X) - HW), dz = Math.max(0, Math.abs(Z) - HD), d = Math.min(1, Math.hypot(dx, dz) / ring);
    const k = 1 - T.ao * (1 - d) * (1 - d);
    pos.push(X, g(X, Z) + 0.025, Z); uv.push(X, Z); col.push(k, k, k, a);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c2 = a + nx + 1, d2 = c2 + 1;
    idx.push(a, c2, b, b, c2, d2);
  }
  return { pos, uv, col, idx, set: T.set, tile: T.tile, rect: { x0, x1, z0, z1 } };
}
// the pad as a mesh (both callers): a draped grid, the set's maps at its tile, lit and shadowed, blended (never written to depth)
function padMesh(THREE, data, extra) {
  if (!data || !THREE || !THREE.BufferGeometry) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 4));
  geo.setIndex(data.idx); geo.computeVertexNormals();
  const o = Object.assign({ roughness: 1, metalness: 0, vertexColors: true, transparent: true, depthWrite: false,
                            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, extra || {});
  const maps = typeof siteGroundMaps === 'function' ? siteGroundMaps(THREE, data.set, data.tile, (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8) : null;
  if (maps) Object.assign(o, maps); else o.color = 0x8a7a62;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(o));
  m.name = 'shed:pad'; m.castShadow = false; m.receiveShadow = true; m.renderOrder = 4;
  return m;
}
// G3542 (the user: "a bottom-up gradient on the walls, dark at the ground to transparent - the ground's AO on the
// building"): the house's dirt line taken DARK - its ramp put on the ground (full at the foot, gone `footH` up) and its
// colour the shadow's, at `footAO` whatever the weather made of the dirt dial. Every material this finish shades, roofs out.
const FOOT_DARK = 0x221d17;
function footDirt(mats, SU, P, g0) {
  if (!(P.footAO > 0)) return 0;
  const H = Math.max(0.2, P.footH || 1);
  SU.uDirtTop.value = g0 + H; SU.uDirtH.value = H;
  const gain = P.footAO / Math.max(0.05, SU.uDirtK.value);
  let n = 0;
  for (const k in mats) {
    const m = mats[k], D = m && m.userData && m.userData.dirt;
    if (!D || /^(glass|pane|smoke|aoskirt)$/.test(k)) continue;
    const nm = (m.userData.hangarShell || k).split('/').pop();
    D.uDirtGain.value = /^roof/.test(nm) ? 0 : gain; D.uDirtOwn.value.setHex(FOOT_DARK); n++;
  }
  return n;
}
function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const Q = { lod: lod | 0 };
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const Ph = houseP(P);
  const LIT = HG.litBegin();
  const S = shellOf(P);
  const { timber, HW, HD, EAVE, RIDGE } = S;
  const fy = P.floorY, t = P.wallT, hw = t / 2;
  const eave = fy + EAVE, ridge = fy + RIDGE;
  const tp = (RIDGE - EAVE) / HW;                             // the slope, rise per metre across
  const yRoof = x => eave + (HW - Math.abs(x)) * tp;          // the roof's underside over a point of the plan
  const rT = P.roofT;
  const rnd = rng(P.seed);
  const litOn = P.lights ? 1 : 0;
  // THE SHELL FROM hangar.js, baked into bags (browser, near mesh only); null headless
  // G3534 (HANGARS-LOOK): `polishOnly` - the polish alone (the casings, the gutters and downpipes, the flue, the lamps, the
  // ground skirt, their bake), no shell of either kind: the garage ROOM stands it on its own walls (hangar.js), so the
  // building the roll-out shows is dressed as the world's is
  const ext = (!P.polishOnly && Q.lod === 0 && !P.restated && typeof document !== 'undefined' && typeof genHangarBuild === 'function') ? bakeShell(P, S, fy, bags, litOn, F) : null;
  const R = !ext && !P.polishOnly;                            // the restated shell draws only where hangar.js's does not

  if (R) {
    // ---- THE SLAB AND THE STEM: concrete from below the lowest corner to the floor, the brick course over it
    let gLo = 1e9;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gLo = Math.min(gLo, g(sx * HW, sz * HD));
    const pt = 0.25;
    const ring = [[-HW - pt / 2, HD + pt / 2], [HW + pt / 2, HD + pt / 2], [HW + pt / 2, -HD - pt / 2], [-HW - pt / 2, -HD - pt / 2]];
    for (let i = 0; i < 4; i++) {
      const A = ring[i], B = ring[(i + 1) % 4];
      wall(bags.stem, { A, B, y0: gLo - 0.35, t: pt, topAt: () => fy + (timber ? 0 : S.STEM), ext: [pt / 2, pt / 2], inner: false, endCap: [false, false], capBot: false, capTop: true, sub: 2.5 });
    }
    face(bags.stem, [[-HW, fy, -HD], [-HW, fy, HD], [HW, fy, HD], [HW, fy, -HD]], [0, 1, 0], uvFrame([-HW, fy, -HD], [1, 0, 0], [0, 0, 1]));
  
  }
  const pt = 0.25;
  // ---- THE OPENINGS, per wall: the front gable (the big door), the flanks (the band / the windows), the back (the doors)
  const yW = fy + (timber ? 0 : S.STEM);                      // the walls stand on the stem
  const plan = [[-HW, HD], [HW, HD], [HW, -HD], [-HW, -HD]];   // front (+z), right (+x), back (-z), left (-x) - the outside on +N
  const walls = [];
  const bigDoor = { s0: HW - S.DOOR_W / 2, s1: HW + S.DOOR_W / 2, y0: fy, y1: fy + S.DOOR_H, kind: 'roller' };
  const backDoor = P.backDoor && !timber ? { s0: HW - S.BD_W / 2, s1: HW + S.BD_W / 2, y0: fy, y1: fy + S.BD_H, kind: 'roller' } : null;
  // the personnel door on the back wall at hangar.js's MDZ, across from the middle (the back wall runs +x -> -x)
  const pdoor = P.personDoor ? { s0: HW - S.MDZ - 0.55, s1: HW - S.MDZ + 0.55, y0: fy, y1: fy + 2.1, kind: 'door' } : null;
  const hiWin = P.personDoor && !timber ? { s0: HW - S.MDZ - 0.6, s1: HW - S.MDZ + 0.6, y0: fy + 2.6, y1: fy + Math.min(EAVE - 0.6, 3.6), kind: 'strip' } : null;
  const bands = [];                                            // the flanks' glazing, [wall index] -> [{s0,s1,y0,y1}]
  const winsT = [];                                            // the timber shed's windows
  for (let i = 0; i < 4; i++) {
    const A = plan[i], B = plan[(i + 1) % 4];
    const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
    const at = s => [A[0] + dx / L * s, A[1] + dz / L * s];
    const gable = i === 0 || i === 2;
    const topAt = s => { const p = at(s); return gable ? yRoof(p[0]) : eave; };
    const holes = [];
    if (i === 0) holes.push(bigDoor);
    if (i === 2) { if (backDoor) holes.push(backDoor); if (pdoor) holes.push(pdoor); if (hiWin) holes.push(hiWin); }
    if ((i === 1 || i === 3) && P.glazing) {
      if (timber) {
        // one small window per flank at 30 % of the depth toward the back: the wall's s runs from the front on the right, from the back on the left
        const zc = -HD * 0.30, s = i === 1 ? HD - zc : HD + zc;
        const wnd = { s0: s - 0.55, s1: s + 0.55, y0: fy + 1.45, y1: fy + 1.45 + 0.9, kind: 'window' };
        holes.push(wnd); winsT.push({ i, h: wnd });
      } else {
        const band = { s0: 0.8, s1: L - 0.8, y0: fy + S.SILL, y1: fy + S.HEAD, kind: 'strip' };
        holes.push(band); bands.push({ i, h: band });
      }
    }
    const W = wall(R ? bags.wall : Bag('x'), { A, B, y0: yW, t, topAt, holes, ext: [hw, hw], inner: true, endCap: [false, false], capBot: false, capTop: true,
                                sub: Q.lod === 0 ? 3.0 : 0, splits: gable ? [L / 2] : [] });
    walls.push({ W, A, B, L, at, topAt, N: W.N, X: W.X, holes });
  }

  // ---- THE DRESSING: the casings and the OPAQUE panes (the house's), the door leaf and its lamp
  const paneAt = (Wl, h, lit) => {                             // an opaque pane near the outer face, in the house's pane bag
    const q = [Wl.W.P(h.s0 + 0.03, h.y0 + 0.03, 0.78), Wl.W.P(h.s1 - 0.03, h.y0 + 0.03, 0.78), Wl.W.P(h.s1 - 0.03, h.y1 - 0.03, 0.78), Wl.W.P(h.s0 + 0.03, h.y1 - 0.03, 0.78)];
    bags.pane.setGlow(lit);
    face(bags.pane, q, Wl.N, uvFrame(q[0], Wl.X, [0, 1, 0]));
    bags.pane.setGlow(0);
    LIT.panes++; if (lit) LIT.windows++;
  };
  const casing = (Wl, h) => { if (Q.lod === 0) HG.dressOpening(bags, Ph, Q, Wl.W, Object.assign({}, h, { kind: 'roller' }), h.y1); };
  for (const b of bands) {
    const Wl = walls[b.i], h = b.h;
    casing(Wl, h); if (R) paneAt(Wl, h, litOn);
    if (Q.lod === 0 && R) {                                    // the band's mullions (hangar.js's band carries its own)
      const n = Math.max(1, Math.round((h.s1 - h.s0) / 1.3));
      for (let k = 1; k < n; k++) { const s = h.s0 + (h.s1 - h.s0) * k / n; beam(bags.metal, Wl.W.P(s, h.y0 + 0.02, 0.86), Wl.W.P(s, h.y1 - 0.02, 0.86), 0.022, 0.018, Wl.N, 0); }
      beam(bags.metal, Wl.W.P(h.s0 + 0.02, (h.y0 + h.y1) / 2, 0.86), Wl.W.P(h.s1 - 0.02, (h.y0 + h.y1) / 2, 0.86), 0.022, 0.018, Wl.N, 0);
    }
  }
  for (const wT of winsT) { casing(walls[wT.i], wT.h); if (R) paneAt(walls[wT.i], wT.h, litOn); }
  if (hiWin) { casing(walls[2], hiWin); if (R) paneAt(walls[2], hiWin, litOn); }
  if (pdoor) { if (R) HG.dressOpening(bags, Ph, Q, walls[2].W, pdoor, pdoor.y1); else { casing(walls[2], pdoor); HG.buildLamp(bags, Ph, Q, walls[2].W, pdoor, 1); } }   // hangar.js's leaf stays; the casing and the lamp are the polish
  casing(walls[0], bigDoor);
  if (backDoor) casing(walls[2], backDoor);

  const zA = -HD - P.rakeOver, zB = HD + P.rakeOver;
  const roofLights = [];
  if (R) {
    // ---- THE BIG DOOR, SHUT: six leaves across the opening (three a side meeting in the middle), each a
    // corrugated skin in a channel frame with its diagonal brace, hung on three tracks over the head;
    // the timber shed's one leaf on its track
    const leafSkin = (Wl, s0, s1, y0, y1, depth) => {
      const q = [Wl.W.P(s0, y0, depth), Wl.W.P(s1, y0, depth), Wl.W.P(s1, y1, depth), Wl.W.P(s0, y1, depth)];
      face(bags.door, q, Wl.N, uvFrame(q[0], Wl.X, [0, 1, 0]));      // (the door sets' ribs run up the sheet as delivered)
      face(bags.door, q.slice().reverse(), mul(Wl.N, -1), uvFrame(q[0], Wl.X, [0, 1, 0]));
    };
    const leafFrame = (Wl, s0, s1, y0, y1, depth) => {
      if (Q.lod !== 0) return;
      const p = (s, y) => Wl.W.P(s, y, depth);
      const o = mul(Wl.N, 0.05);
      beam(bags.metal, add(p(s0, y0 + 0.09), o), add(p(s1, y0 + 0.09), o), 0.05, 0.09, [0, 1, 0], 0);   // the sill channel
      beam(bags.metal, add(p(s0, y1 - 0.09), o), add(p(s1, y1 - 0.09), o), 0.05, 0.09, [0, 1, 0], 0);   // the head channel
      for (const s of [s0 + 0.07, s1 - 0.07]) beam(bags.metal, add(p(s, y0), o), add(p(s, y1), o), 0.05, 0.07, Wl.N, 0);   // the stiles
      beam(bags.metal, add(p(s0 + 0.12, y0 + 0.2), o), add(p(s1 - 0.12, y1 - 0.2), o), 0.04, 0.05, Wl.N, 0);           // the brace
    };
    {
      const Wl = walls[0], d = bigDoor;
      if (timber) {
        leafSkin(Wl, d.s0 + 0.02, d.s1 - 0.02, d.y0 + 0.02, d.y1 - 0.02, -0.55);
        leafFrame(Wl, d.s0 + 0.02, d.s1 - 0.02, d.y0 + 0.02, d.y1 - 0.02, -0.55);
        // the track over the head, along the wall to its corners (a leaf wider than the wall beside it parks half open)
        const tr0 = Wl.W.P(Math.max(0.3, d.s0 - (d.s1 - d.s0)), d.y1 + 0.18, -0.35), tr1 = Wl.W.P(Math.min(2 * HW - 0.3, d.s1 + 0.1), d.y1 + 0.18, -0.35);
        beam(bags.metal, tr0, tr1, 0.05, 0.05, [0, 1, 0], 0);
      } else {
        const LW = S.DOOR_W / 6;
        for (let k = 0; k < 6; k++) {
          const s0 = d.s0 + k * LW + 0.01, s1 = d.s0 + (k + 1) * LW - 0.01;
          const depth = -0.45 - (k % 3) * 0.3;                   // three tracks: the leaves stand one behind the other
          leafSkin(Wl, s0, s1, d.y0 + 0.02, d.y1 - 0.02, depth);
          leafFrame(Wl, s0, s1, d.y0 + 0.02, d.y1 - 0.02, depth);
        }
        if (Q.lod === 0) for (let tk = 0; tk < 3; tk++) {
          const dp = -0.35 - tk * 0.3;
          beam(bags.metal, Wl.W.P(0.6, d.y1 + 0.3, dp), Wl.W.P(2 * HW - 0.6, d.y1 + 0.3, dp), 0.06, 0.08, [0, 1, 0], 0);
        }
      }
    }
    if (backDoor) {                                              // the bi-parting pair, shut, in one plane
      const Wl = walls[2], d = backDoor, mid = (d.s0 + d.s1) / 2;
      leafSkin(Wl, d.s0 + 0.02, mid - 0.01, d.y0 + 0.02, d.y1 - 0.02, -0.5); leafFrame(Wl, d.s0 + 0.02, mid - 0.01, d.y0 + 0.02, d.y1 - 0.02, -0.5);
      leafSkin(Wl, mid + 0.01, d.s1 - 0.02, d.y0 + 0.02, d.y1 - 0.02, -0.5); leafFrame(Wl, mid + 0.01, d.s1 - 0.02, d.y0 + 0.02, d.y1 - 0.02, -0.5);
      if (Q.lod === 0) beam(bags.metal, Wl.W.P(d.s0 - 0.5, d.y1 + 0.25, -0.35), Wl.W.P(d.s1 + 0.5, d.y1 + 0.25, -0.35), 0.06, 0.08, [0, 1, 0], 0);
    }
  
    // ---- THE ROOF: two slopes from the ridge along z down to the eaves at x = +-HW, past the gables by the rake
    // (zA, zB declared above)
    // (roofLights declared above)
    for (const side of [-1, 1]) {
      const xE = side * (HW + P.eaveOver), yE = eave - P.eaveOver * tp;
      const ring = [[0, ridge + rT, zA], [0, ridge + rT, zB], [xE, yE + rT, zB], [xE, yE + rT, zA]];
      const Sd = nrm([xE, yE - ridge, 0]);
      plate(bags.roof, ring, rT, [0, -1, 0], uvFrame(ring[0], [0, 0, 1], Sd));
      // THE ROOF LIGHTS: opaque panels on the slope between 30 and 62 % of the way down, kerbed (nothing to see inside)
      if (P.roofLights && S.NLIGHT) for (let k = 0; k < S.NLIGHT; k++) {
        const zc = -HD + 3.4 + k * (2 * HD - 6.8) / Math.max(1, S.NLIGHT - 1);
        const tOn = u => [side * HW * u, ridge + (eave - ridge) * u + rT, 0];      // a point down the slope at fraction u
        const p0 = tOn(0.30), p1 = tOn(0.62);
        const up = nrm([-side * (ridge - eave), HW, 0]);
        const q = [[p0[0], p0[1], zc - 1.8], [p1[0], p1[1], zc - 1.8], [p1[0], p1[1], zc + 1.8], [p0[0], p0[1], zc + 1.8]].map(p => add(p, mul(up, 0.09)));
        bags.pane.setGlow(litOn);
        face(bags.pane, q, up, uvFrame(q[0], nrm(sub(p1, p0)), [0, 0, 1]));
        bags.pane.setGlow(0);
        if (Q.lod === 0) {                                       // the kerb round it, in the roof's metal
          const rim = [q[0], q[1], q[2], q[3]].map(p => add(p, mul(up, -0.09)));
          for (let e = 0; e < 4; e++) beam(bags.metal, rim[e], rim[(e + 1) % 4], 0.04, 0.05, up, 0.04);
        }
        roofLights.push({ x: (p0[0] + p1[0]) / 2, z: zc });
        LIT.panes++;
      }
    }
    beam(bags.metal, [0, ridge + rT + 0.03, zA], [0, ridge + rT + 0.03, zB], 0.16, 0.05, [0, 1, 0], 0);   // the ridge cap
    // the fascia along both eaves and the barge boards up the gables
    for (const side of [-1, 1]) {
      const xE = side * (HW + P.eaveOver), yE = eave - P.eaveOver * tp;
      beam(bags.trim, [xE, yE - 0.09, zA], [xE, yE - 0.09, zB], 0.02, 0.11, [0, 1, 0], 0);
    }
    if (Q.lod === 0) for (const zg of [zA, zB]) for (const side of [-1, 1]) {
      const xE = side * (HW + P.eaveOver), yE = eave - P.eaveOver * tp;
      beam(bags.trim, [0, ridge + rT - 0.02, zg + (zg < 0 ? 0.02 : -0.02)], [xE, yE + rT - 0.02, zg + (zg < 0 ? 0.02 : -0.02)], 0.02, 0.11, [0, 1, 0], 0);
    }
  
  }
  // ---- THE WATER: a half-round gutter along each eave, a downpipe at each corner down to a shoe on the ground
  let gutterLen = 0, downpipes = 0;
  if (P.gutter) {
    const r = 0.075, tG = 0.004;
    for (const side of [-1, 1]) {
      const xE = side * (HW + P.eaveOver + r + 0.02), yE = eave - P.eaveOver * tp - rT - 0.05;
      const prof = K.troughSection ? K.troughSection(r, tG, Q.lod === 0 ? 9 : 4) : [[-r, 0], [-r, -r * 1.6], [r, -r * 1.6], [r, 0]];
      K.sweepProfile(bags.metal, [xE, yE, zA + 0.05], [xE, yE, zB - 0.05], prof, [0, 1, 0], 'shell');
      gutterLen += zB - zA - 0.1;
      for (const zc of [zA + 0.6, zB - 0.6]) {
        const xd = side * (HW + hw + 0.08);
        const gy = g(xd, zc);
        cyl(bags.metal, [xd, gy + 0.15, zc], [0, 1, 0], 0.045, yE - r * 1.6 - gy - 0.2, Q.lod === 0 ? 8 : 5, false);
        if (Q.lod === 0) { beam(bags.metal, [xd, yE - r * 1.6 - 0.05, zc], [xE, yE - r * 1.6 - 0.05, zc], 0.045, 0.045, [0, 1, 0], 0); cyl(bags.metal, [xd, gy + 0.15, zc], [side, 0, 0.3], 0.045, 0.35, 6, true); }
        downpipes++;
      }
    }
  }

  // ---- THE FLUE AND ITS SMOKE: a stove pipe through the back slope, its cap, the house's smoke off its top
  let flue = null, smoke = null;
  if (P.flue) {
    const fx = -HW * 0.55, fz = -HD * 0.45, base = yRoof(fx) - 0.3, top = ridge + 1.2;
    cyl(bags.metal, [fx, base, fz], [0, 1, 0], 0.14, top - base, Q.lod === 0 ? 12 : 6, true, { smooth: true });
    if (Q.lod === 0) {
      cyl(bags.metal, [fx, yRoof(fx) + rT, fz], [0, 1, 0], 0.22, 0.3, 12, true);              // the flashing
      cyl(bags.metal, [fx, top + 0.12, fz], [0, 1, 0], 0.26, 0.05, 12, true);                  // the rain cap
      for (let k = 0; k < 3; k++) { const a = k * 2.094; beam(bags.metal, [fx + Math.cos(a) * 0.12, top - 0.02, fz + Math.sin(a) * 0.12], [fx + Math.cos(a) * 0.12, top + 0.13, fz + Math.sin(a) * 0.12], 0.01, 0.01, [1, 0, 0], 0); }
    }
    flue = { x: fx, z: fz, top, r: 0.14 };
    smoke = HG.buildSmoke ? HG.buildSmoke(bags, Ph, Q, { x: fx, z: fz, top: top + 0.1 }) : null;
  }

  // ---- THE LIGHTS OVER THE DOOR: a bulkhead each side of the big opening
  if ((P.lights || P.bulkheads) && Q.lod === 0) for (const s of [bigDoor.s0 - 0.5, bigDoor.s1 + 0.5]) {   // (G3538: the fittings without the switch)
    const p = walls[0].W.P(s, bigDoor.y1 + 0.5, 1);
    HG.lampAt(bags, Q, p, [0, 0, 1], { k: 1.4, range: 14, dark: !P.lights });
  }

  // ---- THE SIGN over the door (the works): the aspect is the sign's, the board narrowed to the gable's band
  let sign = null;
  if (P.sign && P.signKey) {   // no board without a billboard to fill it (a blank one read as a black hole over the door)
    const meta = (typeof SIGN_TEX_META !== 'undefined' && SIGN_TEX_META && P.signKey) ? SIGN_TEX_META[P.signKey] : null;
    const aspect = meta ? meta.aspect : 4;
    const y0 = bigDoor.y1 + 0.85, y1 = yRoof(0) - 0.35;
    if (y1 - y0 > 0.4) {
      const sw = Math.min(P.signW, (y1 - y0) * aspect, S.DOOR_W - 1), sh = sw / aspect;
      const y = y0 + sh / 2, z = HD + hw + 0.05;
      if (!P.signPlank) {
        const c0 = [-sw / 2, y - sh / 2, z];
        face(bags.glass, [c0, [sw / 2, y - sh / 2, z], [sw / 2, y + sh / 2, z], [-sw / 2, y + sh / 2, z]], [0, 0, 1], p => [(p[0] + sw / 2) / sw, (p[1] - c0[1]) / sh]);
        boxAB(bags.trim, [-sw / 2, y - sh / 2, z - 0.05], [sw / 2, y + sh / 2, z - 0.005], { pz: true });
        sign = { x: 0, y, z, w: sw, h: sh, nx: 0, nz: 1, at: 'gable', key: P.signKey || '' };
      } else {
        // G3540 (the user 25 Oct: "a hand-painted sign on a wood plank ... on top of the door" and "on a visible wall
        // inside"): the board hung, not printed - its own jitter (a stream apart from the build's, so nothing after it moves)
        const jr = rng((P.seed | 0) * 7 + 3540);
        const wf = Math.max(hw, 0.07);                         // the wall's face: hangar.js's timber boards are 0.14 thick
        const out = signPlank(bags, Q, { x: (jr() - 0.5) * 0.16, y, z: HD + wf + 0.012, w: sw, h: sh, rot: (jr() - 0.5) * 0.05 });
        sign = Object.assign(out, { at: 'gable', key: P.signKey });
        if (P.signIn) {
          // inside, under the eave: the back wall's inside face (the house frame's -z; the garage stand looks at it past the
          // aeroplane) at house x = signInX, or a flank's (signInWall +-1: the wall at house x = +-HW) at house z = signInX -
          // the room picks the spot from its fit, clear of the hung wing and everything else standing at that wall
          const yi = eave - 0.25 - sh / 2, jx = (jr() - 0.5) * 0.16, jt = (jr() - 0.5) * 0.05, fl = P.signInWall | 0;
          const inn = fl
            ? signPlank(bags, Q, { x: fl * (HW - wf - 0.012), y: yi, z: P.signInX + jx, w: sw, h: sh, rot: jt, yaw: -fl * Math.PI / 2 })
            : signPlank(bags, Q, { x: P.signInX + jx, y: yi, z: -HD + wf + 0.012, w: sw, h: sh, rot: jt });
          sign.inside = Object.assign(inn, { at: fl ? (fl > 0 ? '+x' : '-x') + ' flank, inside' : 'back wall, inside' });
        }
      }
    }
  }

  if (ext) {
    // hangar.js's shell stands in its own bags: the restated walls, stem, roof, doors and panes give way to it
    for (const k of ['wall', 'stem', 'roof', 'door', 'pane']) bags[k] = Bag(k);
    LIT.panes = ext.panes; LIT.windows = litOn ? ext.panes : 0;
  }
  // ---- THE GROUND SKIRT AND THE BAKE
  const occ = [{ x: 0, z: 0, hx: HW + pt, hz: HD + pt, k: 0.75, soft: 2.2 }];
  for (const o of occ) o.dry = true;
  if (P.aoGround) HG.buildGroundAO(bags.aoskirt, occ, g);
  // G3541/G3542: the shed's ground pad (the apron and the dark ring round the footprint; the callers stand it: padMesh)
  const pad = P.pad && P.pad.set ? padData(P.pad, g, HW + pt / 2, HD + pt / 2) : null;
  const OUT = BAGS.concat(ext ? ext.keys : []);
  const aoInfo = K.bakeAO(OUT.map(k => bags[k]), { strength: P.ao === undefined ? 0.85 : P.ao, range: P.aoRange || 0.7, ground: g });
  let tris = 0, verts = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of OUT) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) { const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2]; if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z; }
  }
  const stats = {
    tris, verts, per, bbox: bb, footprint: 4 * HW * HD, eave, ridge, ridgeY: ridge, eaveY: eave, floorY: fy,
    shell: SHELLS[Math.round(P.shell)], dims: { HW, HD, EAVE }, role: 'hangar', source: ext ? 'hangar.js' : (P.polishOnly ? 'polish' : 'restated'),
    door: { x: 0, z: HD, w: S.DOOR_W, h: S.DOOR_H, leaves: timber ? 1 : 6, shut: true },
    backDoor: backDoor ? { w: S.BD_W, h: S.BD_H } : null, personDoor: !!pdoor,
    bands: bands.length, roofLights: roofLights.length, gutterLen, downpipes, flue, smoke, sign,
    // the way in: a step out from the big door (the composer's path reads `front`)
    front: { x: 0, z: HD + 1.5, side: 1, depth: 0 },
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, yard: null, pier: null, lit: LIT,
  };
  // the bags this build carries (the shell's own beside the polish) and the materials for them
  const MATX = Object.assign({}, F ? F.MAT : MAT, ext ? ext.mats : {});
  if (F && ext && P.ownShell) { Object.assign(F.MAT, ext.mats); stats.shellShaded = finishShell(ext.mats, F.SHADE_U, P); }   // G3531
  if (F && P.footAO > 0) stats.footDark = footDirt(MATX, F.SHADE_U, P, g(0, 0));   // G3542 (after the shell's own dirt)
  stats.pad = pad ? { tris: pad.idx.length / 3, rect: pad.rect, set: pad.set } : null;
  return { bags, stats, P, V: { L: 2 * HW, w: 2 * HD, wallT: t, floorY: fy }, R: null, MAT: MATX, BAGS: OUT, pad };
}
// THE BAKE (G405.1): hangar.js's exterior group, every mesh's geometry read
// through its world matrix, turned from the hangar's frame (the long axis x,
// the door at -x) into the house's (the door at +z: X = z, Z = -x), lifted
// to the slab, and pushed into a bag per material with the author's normals
// and uvs kept - the material object itself is the hangar's, so the baked
// sheets read exactly as they do by the strip. Glass bakes opaque.
let PANE_MAT = null;
// THE GLOBAL LIBRARY (the user: "these should be available as a global
// library"): hangar.js makes its materials afresh per build; the first bake
// of each shell keeps them here, by name, and every later bake of that shell
// wears the SAME objects (the fresh ones disposed) - one wall sheet, one
// stem, one door skin for every club hangar on the page. `window.HANGAR_LIB`
// is the same table for anything else that wants the hangar's finish.
const LIB = {};
function bakeShell(P, S, fy, bags, litOn, F) {
  let ext = null;
  try { ext = genHangarBuild(THREE, { HW: P.HW, HD: P.HD, EAVE: P.EAVE, door: P.doorW > 0 ? P.doorW : undefined, leaves: P.leaves === 2 ? 2 : undefined }, { exterior: true, shell: SHELLS[Math.round(P.shell)] }); }
  catch (e) { if (typeof console !== 'undefined') console.warn('hangar shell:', e && e.message); return null; }
  if (!ext || !ext.group) return null;
  ext.group.updateMatrixWorld(true);
  const M = ext.mats || {};
  const nameOf = new Map(); for (const k in M) nameOf.set(M[k], k);
  if (!PANE_MAT) PANE_MAT = new THREE.MeshStandardMaterial({ color: 0x2c3a42, roughness: 0.28, metalness: 0.10 });
  const paneMat = litOn ? new THREE.MeshStandardMaterial({ color: 0x3a2e1c, roughness: 0.4, emissive: 0xffc68a, emissiveIntensity: 0.9 }) : PANE_MAT;
  const shellName = SHELLS[Math.round(P.shell)];
  const lib = LIB[shellName] || (LIB[shellName] = {});
  const mats = {}, keys = [];
  let panes = 0;
  const v3 = new THREE.Vector3(), n3 = new THREE.Vector3(), nm = new THREE.Matrix3();
  ext.group.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const isGlass = o.material === M.glass;
    const key = 'h_' + (isGlass ? 'pane' : (nameOf.get(o.material) || 'misc'));
    if (!bags[key]) {
      bags[key] = Bag(key); keys.push(key);
      const name = nameOf.get(o.material) || 'misc';
      if (isGlass) mats[key] = paneMat;
      else {
        if (!lib[name]) lib[name] = o.material; else if (lib[name] !== o.material && o.material.dispose) o.material.dispose();
        // G3531 (HANGARS-LOOK): a PLAYER'S shed (P.ownShell: render_world polishedShell, a few nodes) wears a CLONE of the
        // library's material - the same textures, shared - so the house's finish (finishShell: the dirt line, the baked
        // occlusion, the mine's weathering) can ride it at THIS building's height. The scenery's hangars keep the library's
        // own, shared by every item (a clone each broke the town's batching: FRAMECOST 25 Oct, +235 draws at the taxi)
        mats[key] = F && P.ownShell ? shellClone(lib[name], shellName + '/' + name) : lib[name];
      }
    }
    const bag = bags[key];
    const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    nm.getNormalMatrix(o.matrixWorld);
    const base = [];
    if (isGlass) { bag.setGlow(litOn); panes++; }
    for (let i = 0; i < pa.count; i++) {
      v3.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
      const X = v3.z, Y = v3.y + fy, Z = -v3.x;                    // the hangar's frame into the house's
      let n = null;
      if (na) { n3.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); n = [n3.z, n3.y, -n3.x]; }
      base.push(bag.v([X, Y, Z], ua ? [ua.getX(i), ua.getY(i)] : [0, 0], n));
    }
    if (isGlass) bag.setGlow(0);
    if (g.index) { const ix = g.index; for (let i = 0; i + 2 < ix.count; i += 3) bag.tri(base[ix.getX(i)], base[ix.getX(i + 1)], base[ix.getX(i + 2)]); }
    else for (let i = 0; i + 2 < pa.count; i += 3) bag.tri(base[i], base[i + 1], base[i + 2]);
  });
  // the copied geometries are ours now; the materials stay the hangar's (shared by every shell on the page)
  ext.group.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  return { keys, mats, panes };
}
// G3531 (HANGARS-LOOK, the user 24 Oct: "rebuild it with the house generator's care ... the bottom gradient as AO/shadow,
// the blending"): the SHELL's own surfaces never took the house's shader (HANGAR_GEN.LIB is hangar.js's materials), so the
// occlusion baked into every shell vertex (aHouseAO, bakeAO below) and the dirt line the finish declares were drawn on
// the casings and the gutters and NOT on the walls. A clone per build (`userData.hangarShell` names it: the far town keeps
// its item gain, the town's texture arrays leave it alone - render_premises farGain, house_tarr classifyMat) takes
// HOUSE_GEN.shadeHouse with this build's SHADE_U: the ramp from the ground (the stem's dark tide line, the doors' splash,
// pale dust on the cladding), all of the bake on the indirect light and a third on the albedo. The glass stays the pane.
function shellClone(m, name) {
  const c = m.clone();
  c.userData = { hangarShell: name };
  return c;
}
const SHELL_DIRT = { stem: [1.6, 0x453f36], door: [1.2, 0x6d6353], manDoor: [1.2, 0x6d6353], wall: [1.0, 0x6d6353], wallOut: [1.0, 0x6d6353],
  wallBack: [1.0, 0x6d6353], doorTrim: [0.9, 0x6d6353], steel: [0.8, 0x5a5246], steelDark: [0.8, 0x5a5246], wood: [1.0, 0x5d5446], beamMain: [1.0, 0x5d5446] };
// G3538: and the old mine's weathering over it - the walls' cloud weathering (P.clouds), the roof's whisper (P.roofClouds),
// the timber's age (desaturated, darker: the frame and the cladding of a shed nobody painted)
const SHELL_AGED = { wall: 1, wallBack: 1, wallOut: 1, door: 0.8, wood: 1.2, beamMain: 1.2, beamSec: 1.2, manDoor: 0.8 };
// the painted leaves and the steel take half the walls' clouds (25 Oct stills: the full dose read as soot blotches on the doors)
const SHELL_CLOUD = { door: 0.5, manDoor: 0.5, doorTrim: 0.5, steel: 0.5, steelDark: 0.5 };
function finishShell(mats, SU, P) {
  let n = 0;
  const age = Math.max(0, Math.min(1, (P && P.age) || 0));
  for (const key in mats) {
    const m = mats[key], ud = m && m.userData;
    if (!ud || !ud.hangarShell || ud.houseShaded || !m.isMeshStandardMaterial) continue;
    const name = ud.hangarShell.split('/')[1];
    HG.shadeHouse(m, SU);
    const d = SHELL_DIRT[name] || (/^roof/.test(name) ? [0, 0x6d6353] : [1.0, 0x6d6353]);
    const D = m.userData.dirt;
    D.uDirtGain.value = d[0]; D.uDirtOwn.value.setHex(d[1]); D.uWander.value = 0;
    const ag = (SHELL_AGED[name] || 0) * age;
    D.uAgeDesat.value = Math.min(1, ag * 0.7); D.uAgeDark.value = Math.min(0.6, ag * 0.32);
    const roof = /^roof/.test(name);
    const ck = roof ? (P && P.roofClouds !== undefined ? P.roofClouds : 0.12) : (P && P.clouds !== undefined ? P.clouds : 0.5) * (SHELL_CLOUD[name] || 1);
    if (P && HG.cloudWeather && ck > 0 && !/^(glass|bulb|lamp)/.test(name)) HG.cloudWeather(m, ck, roof ? 1 : 0);
    n++;
  }
  return n;
}
function applyFinish(P, F) {
  const M = F ? F.MAT : MAT;
  const SU = F ? F.SHADE_U : DEFAULT_FINISH.SHADE_U;
  const HF = F ? F.HF : DEFAULT_FINISH.HF;
  if (HF) HG.applyFinish(houseP(P), HF);
  const HOUSE_OWNED = { trim: 1, pane: 1, glass: 1, smoke: 1, aoskirt: 1 };
  for (const k of BAGS) if (!HOUSE_OWNED[k] && !(M[k].userData && M[k].userData.flat)) HG.shadeHouse(M[k], SU);
  for (const k of ['wall', 'door', 'roof', 'beam', 'stem']) HG.cloudWeather(M[k], P.clouds === undefined ? 0.5 : P.clouds, k === 'roof' ? 1 : 0);
  dress(M.wall, 'wall', P.wallSet, { tint: P.wallTint });
  dress(M.stem, 'stem', P.stemSet);
  dress(M.roof, 'roof', P.roofSet);
  dress(M.door, 'door', P.doorSet);
  dress(M.metal, 'metal', P.metalSet);
  dress(M.beam, 'beam', P.beamSet);
  const g = HG.groundFn(P);
  SU.uDirtTop.value = g(0, 0) + (P.dirtH || 1) * 0.6; SU.uDirtH.value = Math.max(0.05, P.dirtH || 1);
  SU.uDirtK.value = P.dirt === undefined ? 0.5 : P.dirt; SU.uNoiseK.value = P.noise === undefined ? 0.16 : P.noise;
  SU.uAOd.value = P.aoDirect === undefined ? 0.35 : P.aoDirect; SU.uSag.value = 0;
  // G3538: THE WEATHER DIAL, the house's own law (HOUSE_GEN applyFinish): chroma out, the contrast flatter, the dirt up
  const wthr = Math.max(0, Math.min(1, P.weather || 0));
  SU.uSat.value = Math.max(0.35, 1 - wthr * 0.45); SU.uCon.value = Math.max(0.80, 1 - wthr * 0.14);
  if (wthr > 0) SU.uDirtK.value = (P.dirt === undefined ? 0.5 : P.dirt) * (0.35 + wthr * 1.1);
  // and the steel mix on the galvanising (the tram's / the mill's rust: the up faces, the streaks, the patches)
  if (P.rust > 0 && HG.steelMix && M.metal) HG.steelMix(M.metal, 'rust', Math.min(1, P.rust));
  for (const k of BAGS) {
    if (HOUSE_OWNED[k]) continue;
    const ud = M[k].userData && M[k].userData.dirt; if (!ud) continue;
    ud.uDirtGain.value = k === 'stem' ? 1.6 : (k === 'door' ? 1.2 : 1.0); ud.uAgeDesat.value = k === 'beam' ? 0.6 : 0; ud.uAgeDark.value = k === 'beam' ? 0.35 : 0;
    ud.uDirtOwn.value.setHex(k === 'stem' ? 0x453f36 : 0x6d6353); ud.uWander.value = 0;
  }
  // the sign's face, on the glass slot's material of this finish (a billboard fills it whole)
  if (P.sign && P.signKey && typeof SIGN_TEX_SETS !== 'undefined' && SIGN_TEX_SETS && SIGN_TEX_SETS[P.signKey]) {
    const set = SIGN_TEX_SETS[P.signKey];
    const tx = new THREE.Texture(set.img); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping;
    const ok = () => { tx.needsUpdate = true; }; if (set.img.complete && set.img.naturalWidth) ok(); else if (set.img.addEventListener) set.img.addEventListener('load', ok);
    M.glass = std(0xffffff, { map: tx, roughness: 0.75, alphaTest: 0.5 });   // (G3540: cut, never blended; the file's one material site - GATE ASSETS AS4a)
    // G3540 v2 (the user: "slightly darkened sign edges"): the painting darker toward its rim, a band of 7 % of its height
    // all round (the width's uv scaled by the aspect so the band is one width), the board's own edge in shade
    if (P.signPlank) {
      const asp = (typeof SIGN_TEX_META !== 'undefined' && SIGN_TEX_META && SIGN_TEX_META[P.signKey] && SIGN_TEX_META[P.signKey].aspect) || 3;
      const hook = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' +
        '  { vec2 se = min(vMapUv, 1.0 - vMapUv); diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 0.07, min(se.x * ' + asp.toFixed(3) + ', se.y))); }'); };
      M.glass.onBeforeCompile = hook;
      M.glass.customProgramCacheKey = () => 'signedge' + asp.toFixed(3);
    }
  }
}
function finishReport() {
  return BAGS.map(k => { const m = MAT[k], flat = !!(m.userData && m.userData.flat) || k === 'glass' || k === 'pane'; return { slot: k, map: !!m.map, nor: !!m.normalMap, rough: !!m.roughnessMap, full: flat || (!!m.map && !!m.normalMap && !!m.roughnessMap), glassy: flat }; });
}
function randomHangar(seed) {
  const r = rng(seed); const names = Object.keys(PRESETS);
  const P = Object.assign({}, DEF, PRESETS[names[Math.floor(r() * names.length)]]);
  P.HW = +(P.HW * (0.85 + r() * 0.3)).toFixed(1); P.HD = +(P.HD * (0.85 + r() * 0.3)).toFixed(1);
  P.wallSet = Math.floor(r() * ROLE_SETS.wall.length); P.roofSet = Math.floor(r() * ROLE_SETS.roof.length);
  P.lights = r() < 0.3 ? 1 : 0; P.seed = seed | 0;
  return P;
}

window.HANGAR_GEN = { DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, SHELLS, ROLE_SETS, SET_IDX, CATS, catOf, shellOf, build, applyFinish, makeFinish, finishReport, randomHangar, LIB, library: shell => LIB[shell] || null,
  finishShell, SHELL_DIRT, signDials, groundDials, padMesh };   // G3531; G3540; G3541/G3542
window.HANGAR_LIB = LIB;
// THE CATALOGUE: a building with its door hook toward the road side
window.HANGAR_GEN.CATALOGUE_V = 1;
window.HANGAR_GEN.CATALOGUE_ALIASES = {};
window.HANGAR_GEN.CATALOGUE = Object.keys(PRESETS).map(name => {
  const Pd = Object.assign({}, DEF, PRESETS[name]);
  const rect = (HW, HD) => [[-HW - 1, -HD - 1], [HW + 1, -HD - 1], [HW + 1, HD + 1], [-HW - 1, HD + 1]];
  return { key: 'hangar/' + name, kind: 'building', gen: 'HANGAR_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
    foot: P => rect((P && P.HW) || Pd.HW, (P && P.HD) || Pd.HD), keepOut: 4,
    ground: { need: 'level', level: 'high', falloff: 8, standing: 'slab' },
    size: P => ({ L: 2 * ((P && P.HW) || Pd.HW) + 2, w: 2 * ((P && P.HD) || Pd.HD) + 2 }),
    hooks: P => [{ name: 'door', kind: 'apron', p: [0, 0, ((P && P.HD) || Pd.HD) + 2], dir: [0, 0, 1] }], hooksOf: () => [],
    lod: { dist: [0, 200, 600, 1500] }, slots: { lights: 'stats.lit.lights', smoke: 'stats.smoke', ao: 'stats.groundAO', sign: 'stats.sign' },
    tags: ['airport', 'hangar', SHELLS[Math.round(Pd.shell)]], role: 'hangar', cat: catOf(name), headless: true, gate: 'HOUSE' };
});
})();
