// THE BIG BUILDINGS (G312, the user: "Go for the larger buildings now, with
// the hangar materials. Also think of commercial buildings, and I'll generate
// a few billboards for you") — a third generator beside the house and the
// shed: the warehouse, the cannery, the workshop, the store.
//
// WHY A THIRD GENERATOR. The house is a dwelling: storeys, windows every so
// far, a porch, a chimney, a yard. A warehouse is a BOX WITH A DOOR BIG ENOUGH
// FOR A TRUCK: one tall volume on a concrete plinth, corrugated sheet on a
// steel frame, roller doors, a loading dock, a canopy over it, a strip of
// windows up high, a stack, a sign. The pieces are not the house's pieces
// and the proportions are not the house's proportions, so the parameter model
// is its own. It BORROWS: the kit (walls with holes, plates, beams,
// cylinders, the bags with their ao/lit/win channels, the bake), the house's
// finish shader (dirt, noise, the ao channel, the sag field at zero), the
// ground skirt, and THE HANGAR'S MATERIALS (HANGAR_WALL_SETS: the factory
// wall, the rusty painted metal, the rusty sheet, the concretes, the planks)
// beside the house library's roofs and metals.
//
// THE FRAME. The building is centred on the origin, x along its length, z
// across, its FRONT at +z (the road side, as the house), the floor slab at
// `floorY` above the datum, the plinth going down into whatever the ground
// does (`P.ground(lx, lz)` when the village hands one in, a plane else).
//
// THE SIGN IS A SLOT. Every building publishes `stats.sign` - where, how big,
// which way it faces - and draws a board there with a texture the bench (or
// the world) hands in (`signTex`); with none, a painted board with the
// building's name. The user's billboards go in that slot.
'use strict';
(() => {
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, off,
        Bag, face, uvFrame, boxAB, beam, plate, cyl, wall } = K;
const D2R = Math.PI / 180;

// ---- the materials --------------------------------------------------------
// The hangar's sets (2 m tiles, the walls' and the concretes') and the house
// library's (roofs, metal) - both are image dictionaries; a role lists which
// keys it may wear and from which library.
const HANGAR_TILE = () => (typeof HANGAR_WALL_TILE_M !== 'undefined' ? HANGAR_WALL_TILE_M : 2);
const ROLE_SETS = {
  // planks09 (the ply-panel scan) is OFF the walls (G393.2, the user: "avoid the
  // plank09 finish for any walls ... kept for skirts maybe, like raw panels")
  wall:   [['hangar', 'rustysheet'], ['hangar', 'rustymetal'], ['hangar', 'factory'],
           ['hangar', 'rawplank'], ['hangar', 'sandstone'],
           ['hangar', 'slabwall'], ['house', 'corrworn'], ['house', 'paintwood']],
  plinth: [['hangar', 'concrete008'], ['hangar', 'concrete004'], ['hangar', 'slabwall'], ['hangar', 'planks09']],
  roof:   [['house', 'corrworn'], ['house', 'galv'], ['house', 'corrrust'], ['house', 'boxprof'],
           ['hangar', 'rustysheet'], ['house', 'shingle'], ['house', 'greywood'], ['house', 'wornwood']],
  door:   [['hangar', 'rustymetal'], ['hangar', 'rustysheet'], ['hangar', 'factory'], ['house', 'galv']],
  metal:  [['house', 'galv'], ['house', 'rust']],
  beam:   [['house', 'rough'], ['house', 'mossy'], ['house', 'veneerdark'], ['house', 'bark']],
};
const SET_IDX = (role, key) => Math.max(0, ROLE_SETS[role].findIndex(s => s[1] === key));
const setNames = role => ROLE_SETS[role].map(s => s[1]);
function libOf(lib) {
  if (lib === 'hangar') return (typeof HANGAR_WALL_SETS !== 'undefined' && HANGAR_WALL_SETS) || null;
  return HG.libSets();
}
const TEXC = new Map();
function texOf(lib, key, mapName) {
  const S = libOf(lib), set = S && S[key];
  if (!set) return null;
  const img = set[mapName === 'nor' && lib === 'hangar' ? 'nor' : mapName];
  if (!img) return null;
  const ck = lib + '|' + key + '|' + mapName;
  if (TEXC.has(ck)) return TEXC.get(ck);
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (mapName === 'diff' || mapName === 'paint') t.colorSpace = THREE.SRGBColorSpace;
  const tile = lib === 'hangar' ? HANGAR_TILE() : (set.tile || 2);
  t.repeat.set(1 / tile, 1 / tile);
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok();
  else if (img.addEventListener) img.addEventListener('load', ok);
  TEXC.set(ck, t);
  return t;
}
const std = (c, o) => new THREE.MeshStandardMaterial(
  Object.assign({ color: c, roughness: 0.92, metalness: 0 }, o || {}));
function makeMats() {
  return {
    wall:   std(0x8a7f74),
    plinth: std(0x8c8a84),
    roof:   std(0x6f7478, { roughness: 0.6, metalness: 0.3 }),
    door:   std(0x6a5a4c, { roughness: 0.7, metalness: 0.3 }),
    metal:  std(0xa9b1b6, { roughness: 0.45, metalness: 0.75 }),
    glass:  std(0x28343c, { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.62, side: THREE.DoubleSide, userData: { flat: true } }),
    sign:   std(0xffffff, { roughness: 0.8, userData: { flat: true } }),
    awning: std(0x5a1c1c, { roughness: 0.95, side: THREE.DoubleSide, userData: { flat: true } }),
    trim:   std(0xd8d3c8, { roughness: 0.9, userData: { flat: true } }),      // the mill's white window frames
    beam:   std(0x8a7358),                                                       // raw timber: the frames, the floors
  };
}
const BAGS = ['wall', 'plinth', 'roof', 'door', 'metal', 'glass', 'sign', 'awning', 'trim', 'beam', 'pane'];
const EXTRA = ['aoskirt'];
// THE HOUSE'S FINISH RIDES ALONG (G393, the user: "very little facade detail
// ... no habillage of the doors, windows ... why we can't just reuse the
// mechanics"): every door, window strip, shop window and roller opening is
// dressed by the house's own functions (casings that lap the cut, the sill,
// the pane with its lit and curtain channels, the door leaf, the lamp), so
// the glass, the trim and the leaf wear the house's materials and shaders -
// a house finish of this generator's own, dressed by HG.applyFinish from a
// house-shaped parameter table (`houseP`).
const makeFinish = () => { const HF = HG.makeFinish(); const M = makeMats(); M.glass = HF.MAT.glass; M.trim = HF.MAT.trim; M.pane = HF.MAT.pane; return { MAT: M, SHADE_U: HG.makeShadeU(), HF }; };
const DEFAULT_FINISH = makeFinish();
const MAT = DEFAULT_FINISH.MAT;
// the house-shaped table the dressing reads: its trim set and paint, the
// dirt, the lights, no curtains (an industrial window has none), no sash
// bars (the strips carry their own mullions), a small casing
function houseP(P) {
  return Object.assign({}, HG.DEF, {
    trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: P.trimCol === undefined ? 6 : P.trimCol, trimW: P.trimW || 0.07,
    dirt: P.dirt, dirtH: P.dirtH, noise: P.noise, clouds: P.clouds, weather: 0.4, paintPunch: 0.9,
    curtains: 0, muntin: 0, doorLight: P.doorLight ? 1 : 0, doorAjar: 0, hand: 0, bevel: 0.006,
    lights: P.lights ? 1 : 0, winLit: 0.55, winLink: 0, porchLamp: 1, lampKind: 1, lightSeed: P.seed || 1,
    floorY: P.floorY, slopeX: P.slopeX, slopeZ: P.slopeZ, ground: P.ground,
    glassWave: 0.2, glassRough: 0.4, glassFres: 2.6, ao: P.ao, aoRange: P.aoRange, aoDirect: P.aoDirect,
  });
}

function dress(m, role, idx, o) {
  const list = ROLE_SETS[role];
  const [lib, key] = list[clamp(Math.round(idx || 0), 0, list.length - 1)];
  const opt = o || {};
  // a tinted house set wears its PAINT map (the neutral boards the house
  // tints) rather than the natural scan, or a red comes out brown
  const S = libOf(lib), painted = !!(opt.tint && opt.tint !== 0xffffff && S && S[key] && S[key].paint);
  const d = texOf(lib, key, painted ? 'paint' : 'diff');
  if (!d) { m.color.setHex(opt.flat || 0xb0aaa2); return; }
  m.map = d;
  m.normalMap = texOf(lib, key, 'nor');
  m.roughnessMap = texOf(lib, key, 'rough');
  m.color.setHex(opt.tint || 0xffffff);
  m.metalness = opt.metal === undefined ? (role === 'metal' ? 0.85 : (role === 'roof' || role === 'door' ? 0.35 : 0)) : opt.metal;
  m.roughness = 1;
  if (m.normalScale) m.normalScale.set(1, 1);
  m.needsUpdate = true;
}

// THE SIGN'S DEFAULT BOARD: the name painted on weathered boards, drawn on a
// canvas here; a billboard handed in through `signTex` replaces it whole.
const SIGNC = new Map();
function signTexture(text, w, h) {
  const key = text + '|' + w.toFixed(1) + '|' + h.toFixed(1);
  if (SIGNC.has(key)) return SIGNC.get(key);
  if (typeof document === 'undefined') return null;
  const px = 96;
  const cv = document.createElement('canvas');
  cv.width = Math.max(64, Math.round(w * px)); cv.height = Math.max(32, Math.round(h * px));
  const g = cv.getContext('2d');
  g.fillStyle = '#d9d2c2'; g.fillRect(0, 0, cv.width, cv.height);
  // the boards
  for (let i = 0; i < cv.height; i += 22) { g.fillStyle = i % 44 ? '#cfc7b6' : '#d6cfbf'; g.fillRect(0, i, cv.width, 20); }
  g.strokeStyle = '#4a3f33'; g.lineWidth = 6; g.strokeRect(4, 4, cv.width - 8, cv.height - 8);
  g.fillStyle = '#3a2e26';
  let size = Math.floor(cv.height * 0.55);
  g.font = 'bold ' + size + 'px Impact, "Arial Black", sans-serif';
  while (g.measureText(text).width > cv.width * 0.86 && size > 10) { size -= 2; g.font = 'bold ' + size + 'px Impact, "Arial Black", sans-serif'; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, cv.width / 2, cv.height / 2 + size * 0.04);
  // the weather: a few pale streaks
  g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i++) g.fillRect((i * 97) % cv.width, 0, 3 + (i % 3) * 2, cv.height);
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  SIGNC.set(key, t);
  return t;
}

// THE BILLBOARDS (G313): the user's painted signs, baked by tools/sign_prep.js
// (SIGN_TEX_SETS in the page, SIGN_TEX_META headless). A sign's aspect sizes
// the board: the width is the dial, the height follows. The png keeps its
// alpha, so a shaped board (the arched store sign) is cut by alphaTest and
// the backing shows through its corners.
const SIGNT = new Map();
function signMeta(key) {
  const M = (typeof SIGN_TEX_META !== 'undefined' && SIGN_TEX_META) || null;
  return (M && key && M[key]) || null;
}
function billboardTexture(key) {
  const S = (typeof SIGN_TEX_SETS !== 'undefined' && SIGN_TEX_SETS) || null;
  const set = S && key && S[key];
  if (!set) return null;
  if (SIGNT.has(key)) return SIGNT.get(key);
  const t = new THREE.Texture(set.img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const ok = () => { t.needsUpdate = true; };
  if (set.img.complete && set.img.naturalWidth) ok();
  else if (set.img.addEventListener) set.img.addEventListener('load', ok);
  SIGNT.set(key, t);
  return t;
}
const signKeys = () => { const M = (typeof SIGN_TEX_META !== 'undefined' && SIGN_TEX_META) || {}; return Object.keys(M); };

// ---- the parameter model --------------------------------------------------
const DEF = {
  seed: 3,
  L: 24, w: 12, eaveH: 5.0, wallT: 0.12,
  floorY: 0.9, plinth: 1,
  slopeZ: 2, slopeX: 0,
  roofKind: 0,            // 0 gable, 1 monopitch (high at the front), 2 flat behind a parapet
  pitch: 12, parapetH: 1.2, eaveOver: 0.35, rakeOver: 0.3, roofT: 0.06,
  rollers: 2, rollerW: 3.6, rollerH: 3.8, rollerOpen: 0.5, rollersBack: 0,   // rollersBack: the same openings on the back wall too - a road runs through (G321)
  door: 1, doors: 1, doorW: 0.95, doorH: 2.1, doorPos: 0.12,
  winStrip: 1, winH: 0.9, winDrop: 0.8, winSpc: 1.2, winFront: 0,
  shopWin: 0, shopW: 3.2, shopH: 2.0, awning: 0,
  dock: 1, dockD: 2.4, dockLenF: 0.55, canopy: 1, canopyOut: 0.6, gantry: 1,
  stack: 1, stackR: 0.18, vents: 2, pipes: 1,
  sign: 1, signW: 5.0, signH: 1.1, signText: 'WAREHOUSE', signTex: null, signKey: '',
  // G393: the dressing - the casing's paint and width, the door's light,
  // corner boards, the frieze under the eave, the canopy's posts, the yard
  // of props and the two people, the lights
  trimCol: 6, trimW: 0.07, doorLight: 0, corners: 1, frieze: 1, pillars: 1,
  yard: 1, yardK: 0.6, yardSeed: 7, people: 1, lights: 0,
  wallSet: SET_IDX('wall', 'rustysheet'), plinthSet: SET_IDX('plinth', 'concrete008'),
  roofSet: SET_IDX('roof', 'corrworn'), doorSet: SET_IDX('door', 'rustymetal'), metalSet: SET_IDX('metal', 'galv'),
  wallTint: 0xffffff,
  dirt: 0.5, dirtH: 1.1, noise: 0.16, clouds: 0.5,
  ao: 0.85, aoRange: 0.7, aoDirect: 0.35, aoGround: 1,
  beamSet: SET_IDX('beam', 'rough'),
};
const ROOFS = ['gable', 'monopitch', 'flat + parapet'];
// the categories (G393): the working sheds are industrial, the hall-sized
// institutions official; the store, the cafe and the motel moved to the
// house generator's storefront row (their presets here stay as the
// industrial-built variants) - see HOUSE_GEN.CATEGORIES
const CATS = { 'terminal': 'airport m', 'technical services': 'airport m', 'fuel shed': 'airport s',
  'warehouse': 'industrial', 'cannery': 'industrial', 'workshop': 'industrial', 'fire hall': 'official',
  'swimming pool': 'official', 'athletic centre': 'official', 'store': 'commercial', 'cafe': 'commercial', 'motel': 'commercial',
  'tram shed': 'landmark', 'mine shop': 'landmark', 'boat shed': 'industrial' };
const catOf = name => CATS[name] || null;
const ROWS = [
  ['plan', [
    ['L', 'length', 6, 40, 0.5], ['w', 'width', 4, 20, 0.5],
    ['eaveH', 'eave height', 2.8, 9, 0.1], ['floorY', 'floor above datum', 0.2, 1.6, 0.05],
    ['plinth', 'concrete plinth', 0, 1, 1], ['wallT', 'wall thickness', 0.08, 0.3, 0.01],
    ['slopeZ', 'ground slope z', -8, 12, 0.5], ['slopeX', 'ground slope x', -6, 6, 0.5],
  ]],
  ['roof', [
    ['roofKind', 'kind', 0, 2, 1, ROOFS], ['pitch', 'pitch', 3, 30, 0.5, null, P => P.roofKind < 2],
    ['parapetH', 'parapet', 0.4, 2.5, 0.05, null, P => P.roofKind === 2],
    ['eaveOver', 'eave overhang', 0, 1.2, 0.05], ['rakeOver', 'rake overhang', 0, 1.0, 0.05],
  ]],
  ['doors', [
    ['rollers', 'roller doors', 0, 3, 1], ['rollerW', 'roller width', 2.4, 6, 0.1, null, P => P.rollers > 0],
    ['rollerH', 'roller height', 2.4, 6, 0.1, null, P => P.rollers > 0],
    ['rollerOpen', 'rolled up', 0, 1, 0.05, null, P => P.rollers > 0],
    ['rollersBack', 'through to the back', 0, 1, 1, null, P => P.rollers > 0],
    ['door', 'personnel door', 0, 1, 1], ['doors', 'how many', 1, 8, 1, null, P => !!P.door],
    ['doorPos', 'door position', 0.05, 0.95, 0.01, null, P => !!P.door && P.doors < 2],
    ['shopWin', 'shop window', 0, 1, 1], ['shopW', 'shop window width', 1.5, 6, 0.1, null, P => !!P.shopWin],
    ['shopH', 'shop window height', 1.2, 3, 0.1, null, P => !!P.shopWin],
    ['awning', 'awning', 0, 1, 1, null, P => !!P.shopWin],
  ]],
  ['windows', [
    ['winStrip', 'strip windows', 0, 1, 1], ['winH', 'height', 0.4, 1.8, 0.05, null, P => !!P.winStrip],
    ['winDrop', 'below the eave', 0.2, 2.5, 0.05, null, P => !!P.winStrip],
    ['winSpc', 'mullion spacing', 0.6, 3, 0.1, null, P => !!P.winStrip],
    ['winFront', 'on the front too', 0, 1, 1, null, P => !!P.winStrip],
  ]],
  ['dock', [
    ['dock', 'loading dock', 0, 1, 1], ['dockD', 'dock depth', 1.2, 4, 0.1, null, P => !!P.dock],
    ['dockLenF', 'dock length', 0.2, 1, 0.05, null, P => !!P.dock],
    ['canopy', 'canopy', 0, 1, 1], ['canopyOut', 'canopy past the dock', 0, 2, 0.1, null, P => !!P.canopy],
    ['gantry', 'gantry beam', 0, 1, 1, null, P => P.roofKind === 0],
  ]],
  ['details', [
    ['stack', 'stack', 0, 2, 1], ['stackR', 'stack radius', 0.08, 0.4, 0.01, null, P => P.stack > 0],
    ['vents', 'roof vents', 0, 4, 1], ['pipes', 'conduit', 0, 1, 1],
    ['corners', 'corner boards', 0, 1, 1], ['frieze', 'frieze under the eave', 0, 1, 1],
    ['pillars', 'posts under the canopy', 0, 1, 1, null, P => !!P.canopy],
    ['doorLight', 'a light in the door', 0, 1, 1, null, P => !!P.door],
  ]],
  ['the yard', [
    ['yard', 'props round it', 0, 1, 1], ['yardK', 'how many', 0, 1, 0.05, null, P => !!P.yard],
    ['yardSeed', 'seed', 1, 40, 1, null, P => !!P.yard], ['people', 'people', 0, 1, 1],
    ['lights', 'lights', 0, 1, 1],
  ]],
  ['sign', [
    ['sign', 'sign', 0, 1, 1], ['signW', 'width', 1, 12, 0.1, null, P => !!P.sign],
    ['signH', 'height', 0.4, 3, 0.05, null, P => !!P.sign && !P.signKey],
    // a string-valued select (the bench's mkRow reads the option by name):
    // '' is the painted name; the keys are the baked billboards
    ['signKey', 'billboard', 0, 0, 1, [''].concat(signKeys()), P => !!P.sign],
  ]],
  ['finish', [
    ['wallSet', 'wall', 0, ROLE_SETS.wall.length - 1, 1, setNames('wall')],
    ['plinthSet', 'plinth', 0, ROLE_SETS.plinth.length - 1, 1, setNames('plinth')],
    ['roofSet', 'roof', 0, ROLE_SETS.roof.length - 1, 1, setNames('roof')],
    ['doorSet', 'doors', 0, ROLE_SETS.door.length - 1, 1, setNames('door')],
    ['metalSet', 'steel', 0, ROLE_SETS.metal.length - 1, 1, setNames('metal')],
    ['beamSet', 'timber', 0, ROLE_SETS.beam.length - 1, 1, setNames('beam')],
    ['trimCol', 'casing paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES], ['trimW', 'casing width', 0.04, 0.14, 0.01],
    ['dirt', 'dirt', 0, 1, 0.05], ['dirtH', 'dirt height', 0.3, 2.5, 0.05], ['noise', 'repetition breaker', 0, 0.5, 0.01],
    ['clouds', 'weather clouds', 0, 1, 0.05],
    ['ao', 'baked occlusion', 0, 1, 0.05], ['aoRange', 'occlusion reach', 0.2, 1.5, 0.05],
    ['aoGround', 'ground skirt', 0, 1, 1],
  ]],
];

const PRESETS = {
  'warehouse': {},
  // THE MILL (G321, the user: "a special site, believable for Alaska.
  // Large and historical ... the Kennecott mine"): the concentrator that
  // steps up the mountain - fourteen storeys of red boards in tiers, each
  // tier's front wall rising out of the roof below it, rows of small white
  // windows, the head tower on top, the tramway coming down across the
  // front, the power house with its stacks at the foot.
  // THE CANNERY: the harbour's big one - thirty metres of factory wall,
  // one truck door and two men's doors, a strip of windows all round, a
  // dock the length of the front under its canopy, the tall stack
  'cannery': {
    L: 30, w: 14, eaveH: 6.2, floorY: 1.0, pitch: 14,
    rollers: 1, rollerW: 4.5, rollerH: 4.2, rollerOpen: 0.7, door: 1, doorPos: 0.08,
    winStrip: 1, winH: 1.1, winDrop: 1.0, winSpc: 1.5, winFront: 1,
    dock: 1, dockD: 3.0, dockLenF: 0.8, canopy: 1, canopyOut: 0.5, gantry: 1,
    stack: 2, stackR: 0.32, vents: 3, pipes: 1,
    sign: 1, signW: 7, signH: 1.3, signText: 'PACIFIC CANNERY',
    wallSet: SET_IDX('wall', 'factory'), plinthSet: SET_IDX('plinth', 'concrete004'),
    roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'rustysheet'),
    dirt: 0.6, dirtH: 1.3,
  },
  // THE WORKSHOP: a garage business under a monopitch - one roller door,
  // the sign over it, the stack, no dock
  'workshop': {
    L: 12, w: 9, eaveH: 3.8, floorY: 0.35, roofKind: 1, pitch: 9,
    rollers: 1, rollerW: 3.4, rollerH: 3.2, rollerOpen: 0.85, door: 1, doorPos: 0.85,
    winStrip: 1, winH: 0.8, winDrop: 0.6, winSpc: 1.2, winFront: 1,
    dock: 0, canopy: 0, gantry: 0, stack: 1, stackR: 0.14, vents: 1, pipes: 1,
    sign: 1, signW: 3.6, signH: 0.9, signText: 'AUTO REPAIR', signKey: 'sitka_lumber',
    wallSet: SET_IDX('wall', 'rustymetal'), plinthSet: SET_IDX('plinth', 'slabwall'),
    roofSet: SET_IDX('roof', 'corrrust'), doorSet: SET_IDX('door', 'rustymetal'),
    dirt: 0.55, dirtH: 0.9,
  },
  // THE FIRE HALL (G392, an institution): a red metal building, two bay
  // doors shut, the personnel door beside them, a strip of windows, the
  // siren mast on the roof (a stack), the FIRE BRIGADE board over the bays.
  'fire hall': {
    L: 15, w: 12, eaveH: 5.0, floorY: 0.3, roofKind: 0, pitch: 14, eaveOver: 0.4,
    rollers: 2, rollerW: 3.8, rollerH: 4.0, rollerOpen: 0, door: 1, doorPos: 0.9, doorW: 1.0, doorH: 2.15,
    winStrip: 1, winH: 0.8, winDrop: 0.7, winSpc: 1.2, winFront: 0,
    dock: 0, canopy: 0, gantry: 0, stack: 1, stackR: 0.06, vents: 1, pipes: 0,
    sign: 1, signW: 4.2, signText: 'FIRE BRIGADE', signKey: 'fire_brigade', role: 'fire hall',
    wallSet: SET_IDX('wall', 'paintwood'), wallTint: 0xb0302a, plinthSet: SET_IDX('plinth', 'concrete004'),
    roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'factory'),
    dirt: 0.35, dirtH: 0.8,
  },
  // THE SWIMMING POOL (G392): a long low hall in brick under a shallow
  // gable, a strip of windows high on both flanks, the entrance door and
  // the board over it, no bays, no dock, no stack - a village pool.
  'swimming pool': {
    L: 30, w: 16, eaveH: 5.5, floorY: 0.3, roofKind: 0, pitch: 12, eaveOver: 0.5, rakeOver: 0.4,
    rollers: 0, door: 1, doors: 2, doorPos: 0.5, doorW: 1.2, doorH: 2.2,
    winStrip: 1, winH: 1.4, winDrop: 0.6, winSpc: 1.5, winFront: 1,
    dock: 0, canopy: 1, canopyOut: 0.4, gantry: 0, stack: 0, vents: 3, pipes: 0,
    sign: 1, signW: 4.0, signH: 0.9, signText: 'SWIMMING POOL', role: 'pool',
    wallSet: SET_IDX('wall', 'sandstone'), plinthSet: SET_IDX('plinth', 'concrete004'),
    roofSet: SET_IDX('roof', 'boxprof'), doorSet: SET_IDX('door', 'factory'), metalSet: SET_IDX('metal', 'galv'),
    dirt: 0.3, dirtH: 0.7, clouds: 0.3,
  },
  // THE ATHLETIC CENTRE (G392): the bigger hall - a gym's height, brick
  // below and sheet above is one set here (the factory wall), a monopitch
  // roof, the double doors under a canopy, the strip windows up high.
  // THE AIRPORT'S BIG BUILDINGS (G405): the regional terminal (a parapet
  // hall, a strip of shop windows, the canopy on posts, the board), the
  // technical services (a workshop with a bay), the fuel shed (the pump
  // house of the fuel farm - the tanks are the theme's props)
  'terminal': {
    L: 28, w: 14, eaveH: 5.2, floorY: 0.3, roofKind: 2, parapetH: 1.3, eaveOver: 0.2, rakeOver: 0.2,
    rollers: 0, door: 1, doors: 3, doorPos: 0.5, doorW: 1.4, doorH: 2.3,
    shopWin: 1, shopW: 6.0, shopH: 2.4, awning: 0,
    winStrip: 1, winH: 1.6, winDrop: 0.7, winSpc: 1.6, winFront: 1,
    dock: 0, canopy: 1, canopyOut: 1.2, gantry: 0, stack: 0, vents: 3, pipes: 0,
    sign: 1, signW: 6.0, signH: 1.1, signText: 'TERMINAL', role: 'terminal',
    wallSet: SET_IDX('wall', 'sandstone'), plinthSet: SET_IDX('plinth', 'concrete008'),
    roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'factory'), metalSet: SET_IDX('metal', 'galv'),
    trimCol: 6, dirt: 0.3, dirtH: 0.8, clouds: 0.3, lights: 0,
  },
  'technical services': {
    L: 16, w: 10, eaveH: 4.5, floorY: 0.35, roofKind: 1, pitch: 8,
    rollers: 2, rollerW: 3.6, rollerH: 3.4, rollerOpen: 0.2, door: 1, doorPos: 0.9,
    winStrip: 1, winH: 0.9, winDrop: 0.6, winSpc: 1.2, winFront: 1,
    dock: 0, canopy: 0, gantry: 0, stack: 1, stackR: 0.12, vents: 2, pipes: 1,
    sign: 1, signW: 4.0, signH: 0.9, signText: 'TECHNICAL SERVICES', role: 'technical services',
    wallSet: SET_IDX('wall', 'factory'), plinthSet: SET_IDX('plinth', 'concrete004'),
    roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'rustymetal'),
    dirt: 0.45, dirtH: 0.9,
  },
  'fuel shed': {
    L: 6, w: 4.5, eaveH: 3.0, floorY: 0.3, roofKind: 1, pitch: 8,
    rollers: 0, door: 1, doorPos: 0.5, doorW: 1.0, doorH: 2.1,
    winStrip: 1, winH: 0.6, winDrop: 0.5, winSpc: 1.0, winFront: 0,
    dock: 0, canopy: 1, canopyOut: 1.8, gantry: 0, stack: 0, vents: 1, pipes: 1,
    sign: 1, signW: 3.0, signText: 'FUEL', signKey: 'harbor_fuel', role: 'fuel',
    wallSet: SET_IDX('wall', 'paintwood'), wallTint: 0xeac53d, trimCol: 6, plinthSet: SET_IDX('plinth', 'concrete004'),
    roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'factory'),
    dirt: 0.45, dirtH: 0.7, yard: 1, yardK: 0.5,
  },
  'athletic centre': {
    L: 36, w: 24, eaveH: 8.0, floorY: 0.3, roofKind: 1, pitch: 6, eaveOver: 0.5, rakeOver: 0.4,
    rollers: 1, rollerW: 3.0, rollerH: 3.0, rollerOpen: 0, door: 1, doors: 3, doorPos: 0.5, doorW: 1.2, doorH: 2.2,
    winStrip: 1, winH: 1.2, winDrop: 1.0, winSpc: 1.5, winFront: 1,
    dock: 0, canopy: 1, canopyOut: 0.6, gantry: 0, stack: 0, vents: 4, pipes: 0,
    sign: 1, signW: 5.0, signH: 1.0, signText: 'ATHLETIC CENTER', role: 'athletic centre',
    wallSet: SET_IDX('wall', 'factory'), plinthSet: SET_IDX('plinth', 'concrete008'),
    roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'factory'), metalSet: SET_IDX('metal', 'galv'),
    dirt: 0.3, dirtH: 0.9, clouds: 0.3,
  },
  // THE STORE: the commercial one - a false front over a flat roof, the
  // sign on the parapet, a shop window under its awning, the door beside
  // it, painted boards
  'store': {
    L: 11, w: 8, eaveH: 3.6, floorY: 0.45, roofKind: 2, parapetH: 1.4, eaveOver: 0.15, rakeOver: 0.15,
    rollers: 0, door: 1, doorPos: 0.22, doorW: 1.0, doorH: 2.15,
    shopWin: 1, shopW: 3.6, shopH: 2.0, awning: 1,
    winStrip: 1, winH: 0.7, winDrop: 0.7, winSpc: 1.0, winFront: 0,
    dock: 0, canopy: 0, gantry: 0, stack: 1, stackR: 0.12, vents: 1, pipes: 0,
    sign: 1, signW: 6.5, signH: 1.0, signText: 'GENERAL STORE', signKey: 'general_store',
    wallSet: SET_IDX('wall', 'paintwood'), wallTint: 0xeac53d, trimCol: 6, plinthSet: SET_IDX('plinth', 'slabwall'),
    roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'factory'),
    dirt: 0.4, dirtH: 0.7,
  },
  // THE CAFE: the store's frame, painted boards, the Tidal Cup on the parapet
  'cafe': {
    L: 9, w: 7, eaveH: 3.4, floorY: 0.4, roofKind: 2, parapetH: 1.3, eaveOver: 0.15, rakeOver: 0.15,
    rollers: 0, door: 1, doorPos: 0.8, doorW: 1.0, doorH: 2.15,
    shopWin: 1, shopW: 3.0, shopH: 1.8, awning: 1,
    winStrip: 1, winH: 0.8, winDrop: 0.8, winSpc: 1.0, winFront: 0,
    dock: 0, canopy: 0, gantry: 0, stack: 1, stackR: 0.12, vents: 1, pipes: 0,
    sign: 1, signW: 5.5, signText: 'CAFE', signKey: 'tidal_cup',
    wallSet: SET_IDX('wall', 'paintwood'), wallTint: 0x3f70b0, trimCol: 6, plinthSet: SET_IDX('plinth', 'concrete004'),
    roofSet: SET_IDX('roof', 'galv'), doorSet: SET_IDX('door', 'factory'),
    dirt: 0.35, dirtH: 0.7,
  },
  // THE MOTEL: one long storey under a shallow monopitch, a door and a
  // window per room along the front, the sign high on the tall end
  'motel': {
    L: 22, w: 7.5, eaveH: 3.1, floorY: 0.35, roofKind: 1, pitch: 6, eaveOver: 0.9, rakeOver: 0.3,
    rollers: 0, door: 1, doors: 6, doorW: 0.9, doorH: 2.05,
    shopWin: 0, awning: 0,
    winStrip: 1, winH: 1.0, winDrop: 1.15, winSpc: 1.3, winFront: 1,
    dock: 0, canopy: 1, canopyOut: 0.2, gantry: 0, stack: 1, stackR: 0.1, vents: 0, pipes: 1,
    sign: 1, signW: 5.0, signText: 'MOTEL', signKey: 'north_motel',
    wallSet: SET_IDX('wall', 'paintwood'), wallTint: 0xb8432f, trimCol: 6, plinthSet: SET_IDX('plinth', 'slabwall'),
    roofSet: SET_IDX('roof', 'corrworn'), doorSet: SET_IDX('door', 'factory'),
    dirt: 0.4, dirtH: 0.8,
  },
  // THE TRAM SHED (G321): the road goes through it - the ore was loaded
  // under cover, and the road to the mine ran in one end and out the other;
  // one wide opening front and back, no leaf, a strip of windows high
  'tram shed': {
    L: 16, w: 9, eaveH: 5.2, floorY: 0.15, plinth: 1, roofKind: 0, pitch: 22,
    rollers: 1, rollerW: 5.6, rollerH: 4.6, rollerOpen: 1.0, rollersBack: 1, door: 0,
    winStrip: 1, winH: 0.8, winDrop: 0.6, winSpc: 1.2, winFront: 1,
    dock: 0, canopy: 0, gantry: 0, stack: 0, vents: 1, pipes: 0, sign: 0,
    wallSet: SET_IDX('wall', 'paintwood'), wallTint: 0xd4452c, plinthSet: SET_IDX('plinth', 'concrete004'),
    roofSet: SET_IDX('roof', 'corrrust'), doorSet: SET_IDX('door', 'rustysheet'), metalSet: SET_IDX('metal', 'rust'),
    dirt: 0.7, dirtH: 1.6,
  },
  // THE MINE'S POWER HOUSE, standing alone: the workshop's frame in the
  // mine's red with its stack
  'mine shop': {
    L: 14, w: 9, eaveH: 4.2, floorY: 0.35, roofKind: 0, pitch: 22,
    rollers: 1, rollerW: 3.6, rollerH: 3.4, rollerOpen: 0.6, door: 1, doorPos: 0.85,
    winStrip: 1, winH: 1.0, winDrop: 0.8, winSpc: 1.5, winFront: 1,
    dock: 0, canopy: 0, gantry: 0, stack: 2, stackR: 0.22, vents: 1, pipes: 1, sign: 0,
    wallSet: SET_IDX('wall', 'paintwood'), wallTint: 0xd4452c, plinthSet: SET_IDX('plinth', 'concrete004'),
    roofSet: SET_IDX('roof', 'corrrust'), doorSet: SET_IDX('door', 'rustysheet'), metalSet: SET_IDX('metal', 'rust'),
    dirt: 0.75, dirtH: 1.6,
  },
  // THE BOAT SHED: a workshop for the harbour, wide door, rusted, low
  'boat shed': {
    L: 16, w: 10, eaveH: 4.6, floorY: 0.4, roofKind: 0, pitch: 18,
    rollers: 1, rollerW: 5.2, rollerH: 4.0, rollerOpen: 1.0, door: 1, doorPos: 0.9,
    winStrip: 1, winH: 0.7, winDrop: 0.7, winSpc: 1.2, winFront: 0,
    dock: 0, canopy: 0, gantry: 1, stack: 0, vents: 2, pipes: 1,
    sign: 1, signW: 4, signH: 0.8, signText: 'MARINE REPAIR', signKey: 'tongass_marine',
    wallSet: SET_IDX('wall', 'rustysheet'), plinthSet: SET_IDX('plinth', 'concrete008'),
    roofSet: SET_IDX('roof', 'corrrust'), doorSet: SET_IDX('door', 'rustysheet'),
    dirt: 0.65, dirtH: 1.2,
  },
};

// ---- the finish -------------------------------------------------------------
function applyFinish(P, F) {
  const M = F ? F.MAT : MAT;
  const SU = F ? F.SHADE_U : DEFAULT_FINISH.SHADE_U;
  const HF = F ? F.HF : DEFAULT_FINISH.HF;
  if (HF) HG.applyFinish(houseP(P), HF);          // the glass, the trim, the leaf: the house's own dressing (G393)
  const HOUSE_OWNED = { glass: 1, trim: 1, pane: 1 };
  for (const k of BAGS) if (!HOUSE_OWNED[k] && !(M[k].userData && M[k].userData.flat)) HG.shadeHouse(M[k], SU);
  // THE WEATHER IN CLOUDS lives with the house now (G329): the same three
  // fields on the big buildings' walls, doors, roofs and beams
  for (const k of ['wall', 'door', 'roof', 'beam']) HG.cloudWeather(M[k], P.clouds === undefined ? 0.5 : P.clouds, k === 'roof' ? 1 : 0);
  HG.shadeSkirt(HG.MAT.aoskirt);
  dress(M.wall, 'wall', P.wallSet, { tint: P.wallTint });
  dress(M.plinth, 'plinth', P.plinthSet);
  dress(M.roof, 'roof', P.roofSet);
  dress(M.door, 'door', P.doorSet);
  dress(M.metal, 'metal', P.metalSet);
  dress(M.beam, 'beam', P.beamSet);
  const g = HG.groundFn(P);
  SU.uDirtTop.value = g(0, 0) + (P.dirtH || 1) * 0.6;
  SU.uDirtH.value = Math.max(0.05, P.dirtH || 1);
  SU.uDirtK.value = P.dirt === undefined ? 0.5 : P.dirt;
  SU.uNoiseK.value = P.noise === undefined ? 0.16 : P.noise;
  SU.uAOd.value = P.aoDirect === undefined ? 0.35 : P.aoDirect;
  SU.uSag.value = 0;
  for (const k of BAGS) {
    if (HOUSE_OWNED[k]) continue;
    const ud = M[k].userData && M[k].userData.dirt;
    if (!ud) continue;
    ud.uDirtGain.value = k === 'plinth' ? 1.6 : (k === 'door' ? 1.2 : (k === 'beam' ? 1.3 : 1.0));
    ud.uAgeDesat.value = k === 'beam' ? 0.6 : 0; ud.uAgeDark.value = k === 'beam' ? 0.35 : 0;
    ud.uDirtOwn.value.setHex(k === 'plinth' ? 0x453f36 : 0x6d6353);
    ud.uWander.value = 0;
  }
  // the sign: the billboard handed in, the billboard named, or the painted name
  const bb = P.signKey ? billboardTexture(P.signKey) : null;
  const meta = signMeta(P.signKey);
  const st = P.signTex || bb || signTexture(P.signText || 'STORE', P.signW || 5, meta ? (P.signW || 5) / meta.aspect : (P.signH || 1));
  M.sign.map = st; M.sign.alphaTest = bb ? 0.5 : 0; M.sign.needsUpdate = true;
}
function finishReport() {
  return BAGS.map(k => {
    const m = MAT[k], flat = !!(m.userData && m.userData.flat);
    // the glass and the door leaf are the house's, glass and paint by design (no maps: the house's own PBR rule 14 holds them)
    const glassy = flat || k === 'glass' || k === 'pane';
    return { slot: k, map: !!m.map, nor: !!m.normalMap, rough: !!m.roughnessMap, metal: m.metalness,
             roughness: m.roughness, nrmScale: m.normalScale ? m.normalScale.x : 1,
             full: glassy || (!!m.map && !!m.normalMap && !!m.roughnessMap), glassy };
  });
}

// ---------------------------------------------------------------------------
// ---- the build ---------------------------------------------------------------
function rng(seed) {
  let st = ((seed | 0) * 2654435761 + 11) >>> 0;
  return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const Q = { lod: lod || 0 };
  const rnd = rng(P.seed);
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const Ph = houseP(P);                 // what the house's dressing reads
  const LIT = HG.litBegin();            // and where it writes its lights
  const L = P.L, w = P.w, t = P.wallT, hw = t / 2;
  const fy = P.floorY, eave = fy + P.eaveH;
  const kind = Math.round(P.roofKind);
  const tp = Math.tan(P.pitch * D2R);
  // the roof's underside at a point of the plan
  const yRoof = (x, z) => kind === 0 ? eave + (w / 2 - Math.abs(z)) * tp
                       : kind === 1 ? eave + (z + w / 2) * tp : eave;
  const ridgeY = kind === 0 ? eave + w / 2 * tp : (kind === 1 ? eave + w * tp : eave);

  // ---- THE PLINTH AND THE SLAB: concrete from below the lowest corner to the floor
  let gLo = 1e9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) gLo = Math.min(gLo, g(sx * L / 2, sz * w / 2));
  const pb = gLo - 0.35, pt = 0.25;               // plinth bottom, plinth thickness
  if (P.plinth) {
    const ring = [[-L / 2 - pt / 2, w / 2 + pt / 2], [L / 2 + pt / 2, w / 2 + pt / 2], [L / 2 + pt / 2, -w / 2 - pt / 2], [-L / 2 - pt / 2, -w / 2 - pt / 2]];
    for (let i = 0; i < 4; i++) {
      const A = ring[i], B = ring[(i + 1) % 4];
      wall(bags.plinth, { A, B, y0: pb, t: pt, topAt: () => fy, ext: [pt / 2, pt / 2], inner: false, endCap: [false, false], capBot: false, sub: 2.5 });
    }
  }
  // the slab: its top, seen through an open door
  face(bags.plinth, [[-L / 2, fy, -w / 2], [-L / 2, fy, w / 2], [L / 2, fy, w / 2], [L / 2, fy, -w / 2]], [0, 1, 0], uvFrame([-L / 2, fy, -w / 2], [1, 0, 0], [0, 0, 1]));

  // ---- THE OPENINGS, planned on the front (+z) wall: s runs -L/2 -> L/2
  const front = [];         // { s0, s1, y0, y1, kind }
  const nR = Math.round(P.rollers);
  const rW = Math.min(P.rollerW, L * 0.7), rH = Math.min(P.rollerH, P.eaveH - 0.5);
  const rollers = [];
  if (nR > 0) {
    const span = Math.min(L - 2.0, nR * rW + (nR - 1) * 1.6);
    const gap = nR > 1 ? (span - nR * rW) / (nR - 1) : 0;
    const s0 = L / 2 - span / 2 - (P.dock ? 0 : 0);
    for (let i = 0; i < nR; i++) {
      const a = s0 + i * (rW + gap);
      const open = clamp(P.rollerOpen + (i ? (rnd() - 0.5) * 0.5 : 0), 0, 1);
      rollers.push({ s0: a, s1: a + rW, y0: fy, y1: fy + rH, open });
      front.push({ s0: a, s1: a + rW, y0: fy, y1: fy + rH, kind: 'roller' });
    }
  }
  let pdoor = null;
  const pdoors = [];
  if (P.door) {
    const nD = Math.max(1, Math.round(P.doors || 1)), dw = P.doorW;
    for (let k = 0; k < nD; k++) {
      // one door where the dial says; a row of them evenly along the front
      let s = nD === 1 ? clamp(P.doorPos, 0.05, 0.95) * L : L * (k + 0.5) / nD - dw / 2;
      // not through a roller door: slide it clear
      for (const r of rollers) if (s + dw > r.s0 - 0.3 && s < r.s1 + 0.3) s = (s < (r.s0 + r.s1) / 2 ? r.s0 - 0.3 - dw : r.s1 + 0.3);
      s = clamp(s, 0.3, L - dw - 0.3);
      const d = { s0: s, s1: s + dw, y0: fy, y1: fy + P.doorH };
      if (pdoors.some(o => d.s0 < o.s1 + 0.3 && d.s1 > o.s0 - 0.3)) continue;
      pdoors.push(d);
      front.push(Object.assign({ kind: 'door' }, d));
    }
    pdoor = pdoors[0] || null;
  }
  let shop = null;
  if (P.shopWin) {
    const sw = Math.min(P.shopW, L * 0.5), sh = Math.min(P.shopH, P.eaveH - 1.0);
    // beside the door, on its wider side
    let s = pdoor ? (pdoor.s0 > L / 2 ? pdoor.s0 - 0.5 - sw : pdoor.s1 + 0.5) : L / 2 - sw / 2;
    s = clamp(s, 0.4, L - sw - 0.4);
    shop = { s0: s, s1: s + sw, y0: fy + 0.55, y1: fy + 0.55 + sh };
    front.push(Object.assign({ kind: 'shop' }, shop));
  }
  // THE CANOPY'S JUNCTION, decided before the strips are laid (G393.2, the
  // user: "the porch roof of the motel intersects the windows"): the front
  // band keeps 15 cm over it, or gives way
  const canopyY = P.canopy && (rollers.length || pdoors.length || P.dock)
    ? Math.min(eave - 0.25, (rollers.length ? rollers[0].y1 : (pdoors.length ? pdoors[0].y1 : fy + 2.6)) + (rollers.length ? 0.9 : 0.45)) : null;
  // the strip windows: a band `winDrop` under the eave, split every winSpc
  const strips = [];         // per wall index: [{ s0, s1, y0, y1 }] - the band in segments
  const stripFor = (i, len, top) => {
    if (!P.winStrip) return [];
    if (i === 0 && !P.winFront) return [];
    // `top` is this wall's lowest top; on a gable END the rake comes down
    // to it at the corners, so the band keeps half a metre under it (G393)
    const drop = kind === 0 && (i === 1 || i === 3) ? Math.max(P.winDrop, 0.5) : P.winDrop;
    const y1 = Math.min(top - 0.25, top - drop);
    let y0 = y1 - P.winH;
    if (i === 0 && canopyY !== null) { y0 = Math.max(y0, canopyY + 0.15); if (y1 - y0 < 0.4) return []; }
    if (y0 < fy + 0.9) return [];
    // the band, cut by every opening on the front that reaches it (a door
    // per room on a motel leaves a window between every pair)
    let segs = [[0.8, len - 0.8]];
    if (i === 0) for (const o of front) {
      if (o.y1 <= y0 - 0.3) continue;
      const next = [];
      for (const [a, b] of segs) {
        if (o.s1 + 0.35 <= a || o.s0 - 0.35 >= b) { next.push([a, b]); continue; }
        if (o.s0 - 0.35 > a) next.push([a, o.s0 - 0.35]);
        if (o.s1 + 0.35 < b) next.push([o.s1 + 0.35, b]);
      }
      segs = next;
    }
    return segs.filter(([a, b]) => b - a >= Math.min(P.winSpc, 0.9)).map(([a, b]) => ({ s0: a, s1: b, y0, y1 }));
  };

  // ---- THE WALLS
  const plan = [[-L / 2, w / 2], [L / 2, w / 2], [L / 2, -w / 2], [-L / 2, -w / 2]];
  const walls = [];
  for (let i = 0; i < 4; i++) {
    const A = plan[i], B = plan[(i + 1) % 4];
    const dx = B[0] - A[0], dz = B[1] - A[1], len_ = Math.hypot(dx, dz);
    const at = s => [A[0] + dx / len_ * s, A[1] + dz / len_ * s];
    const topAt = s => { const p = at(s); return kind === 2 ? eave + P.parapetH : yRoof(p[0], p[1]); };
    const holes = [];
    if (i === 0) for (const o of front) holes.push({ s0: o.s0, s1: o.s1, y0: o.y0, y1: o.y1, kind: o.kind });
    // THE ROAD THROUGH (G321): the roller openings again on the back wall,
    // mirrored (the back wall runs +x -> -x), no leaf - a truck drives in
    // one end and out the other
    if (i === 2 && P.rollersBack) for (const r of rollers) holes.push({ s0: L - r.s1, s1: L - r.s0, y0: r.y0, y1: r.y1, kind: 'roller' });
    // A WINDOW OPENS UNDER THE ROOF, NOT INTO THE PARAPET (G393, the user's
    // "roof in the middle of windows": the flat roof's band sat `winDrop`
    // under the parapet's top, above the deck, and you saw it from the roof)
    const lowTop = kind === 2 ? eave : Math.min(topAt(0), topAt(len_));
    strips[i] = stripFor(i, len_, lowTop);
    for (const strip of strips[i]) holes.push({ s0: strip.s0, s1: strip.s1, y0: strip.y0, y1: strip.y1, kind: 'strip' });
    // A GABLE END NEEDS ITS SPLIT AT THE RIDGE (G393.2, the user: "incomplete walls under gable roofs"): the panel
    // reads its top at each column's ends, so an unsplit end wall topped out at the eave and the gable was open
    const W = wall(bags.wall, { A, B, y0: fy, t, topAt, holes, ext: [hw, hw], inner: true, endCap: [false, false], capBot: false, sub: Q.lod === 0 ? 3.0 : 0,
                                splits: kind === 0 && (i === 1 || i === 3) ? [len_ / 2] : [] });
    walls.push({ W, A, B, len: len_, at, topAt, N: W.N, X: W.X });
  }

  // ---- THE ROOF
  const rT = P.roofT;
  if (kind === 0) {
    for (const side of [1, -1]) {
      const zE = side * (w / 2 + P.eaveOver), yE = yRoof(0, side * w / 2) - P.eaveOver * tp + rT;
      const ring = [[-L / 2 - P.rakeOver, ridgeY + rT, 0], [L / 2 + P.rakeOver, ridgeY + rT, 0],
                    [L / 2 + P.rakeOver, yE, zE], [-L / 2 - P.rakeOver, yE, zE]];
      const S = nrm([0, yE - ridgeY - rT, zE]);
      plate(bags.roof, ring, rT, [0, -1, 0], uvFrame(ring[0], [1, 0, 0], S));
    }
    // the ridge cap
    beam(bags.metal, [-L / 2 - P.rakeOver, ridgeY + rT + 0.03, 0], [L / 2 + P.rakeOver, ridgeY + rT + 0.03, 0], 0.16, 0.05, [0, 1, 0], 0);
  } else if (kind === 1) {
    const zF = w / 2 + P.eaveOver, zB = -w / 2 - P.eaveOver;
    const yF = yRoof(0, w / 2) + P.eaveOver * tp + rT, yB = yRoof(0, -w / 2) - P.eaveOver * tp + rT;
    const ring = [[-L / 2 - P.rakeOver, yF, zF], [L / 2 + P.rakeOver, yF, zF], [L / 2 + P.rakeOver, yB, zB], [-L / 2 - P.rakeOver, yB, zB]];
    plate(bags.roof, ring, rT, [0, -1, 0], uvFrame(ring[0], [1, 0, 0], nrm([0, yB - yF, zB - zF])));
  } else {
    // flat behind the parapet: a shallow fall to the back, a gutter's worth
    const ring = [[-L / 2, eave + 0.12, w / 2], [L / 2, eave + 0.12, w / 2], [L / 2, eave + 0.02, -w / 2], [-L / 2, eave + 0.02, -w / 2]];
    plate(bags.roof, ring, rT, [0, -1, 0], uvFrame(ring[0], [1, 0, 0], [0, 0, -1]));
    // the parapet's cap and the cornice on the front
    for (let i = 0; i < 4; i++) {
      const A = plan[i], B = plan[(i + 1) % 4];
      const ext = i === 0 ? 0.12 : 0.04;
      beam(bags.metal, [A[0], eave + P.parapetH + 0.03, A[1]], [B[0], eave + P.parapetH + 0.03, B[1]], t / 2 + 0.06, 0.06, [0, 1, 0], t / 2 + 0.06);
      if (i === 0) beam(bags.wall, [A[0] - t, eave + P.parapetH - 0.35, A[1] + hw + ext / 2], [B[0] + t, eave + P.parapetH - 0.35, B[1] + hw + ext / 2], ext / 2, 0.18, [0, 1, 0], 0);
    }
  }
  // the fascia along the eaves (gable, monopitch)
  if (kind < 2) for (const side of (kind === 0 ? [1, -1] : [1, -1])) {
    const zE = side * (w / 2 + P.eaveOver);
    const yE = kind === 0 ? yRoof(0, side * w / 2) - P.eaveOver * tp : yRoof(0, side * w / 2) + side * P.eaveOver * tp;
    beam(bags.metal, [-L / 2 - P.rakeOver, yE - 0.1, zE], [L / 2 + P.rakeOver, yE - 0.1, zE], 0.02, 0.1, [0, 1, 0], 0);
  }

  // ---- THE DOORS
  const zIn = w / 2 - hw - 0.04;              // the leaf's plane, just inside the wall
  for (const r of rollers) {
    const yBot = r.y0 + r.open * (r.y1 - r.y0);
    if (r.y1 - yBot > 0.05) {
      // the leaf, in slats
      const slat = 0.45, n = Q.lod === 0 ? Math.ceil((r.y1 - yBot) / slat) : 1;
      for (let i = 0; i < n; i++) {
        const y0 = Math.max(yBot, r.y1 - (i + 1) * (r.y1 - yBot) / n), y1 = r.y1 - i * (r.y1 - yBot) / n;
        const zz = zIn - (Q.lod === 0 && i % 2 ? 0.012 : 0);
        const q = [[r.s0 - L / 2, y0, zz], [r.s1 - L / 2, y0, zz], [r.s1 - L / 2, y1, zz], [r.s0 - L / 2, y1, zz]];
        face(bags.door, q, [0, 0, 1], uvFrame(q[0], [1, 0, 0], [0, 1, 0]));
        face(bags.door, q.slice().reverse(), [0, 0, -1], uvFrame(q[0], [1, 0, 0], [0, 1, 0]));
      }
    }
    // the drum over the opening, inside; the guide rails
    boxAB(bags.door, [r.s0 - L / 2 - 0.15, r.y1 + 0.05, zIn - 0.42], [r.s1 - L / 2 + 0.15, r.y1 + 0.45, zIn + 0.02]);
    if (Q.lod === 0) for (const s of [r.s0, r.s1])
      beam(bags.metal, [s - L / 2 + (s === r.s0 ? -0.04 : 0.04), r.y0, zIn - 0.02], [s - L / 2 + (s === r.s0 ? -0.04 : 0.04), r.y1 + 0.05, zIn - 0.02], 0.04, 0.05, [0, 0, 1], 0);
  }
  // THE PERSONNEL DOORS ARE THE HOUSE'S (G393): the leaf with its light and
  // handle, the casing that laps the cut, the lamp beside it - dressOpening
  // on this wall's own panel, in the house's frame of the opening
  for (const pd of pdoors) {
    HG.dressOpening(bags, Ph, Q, walls[0].W, { s0: pd.s0, s1: pd.s1, y0: pd.y0, y1: pd.y1, kind: 'door' }, pd.y1);
    if (Q.lod === 0) boxAB(bags.plinth, [pd.s0 - L / 2 - 0.2, g(pd.s0 - L / 2, w / 2 + 0.5), w / 2 + hw], [pd.s1 - L / 2 + 0.2, fy, w / 2 + hw + 0.55]);   // the step
  }
  // and every roller opening gets the casing too (the leaf is drawn above)
  for (const r of rollers) HG.dressOpening(bags, Ph, Q, walls[0].W, { s0: r.s0, s1: r.s1, y0: r.y0, y1: r.y1, kind: 'roller' }, r.y1);

  // ---- THE GLASS: the strips and the shop window
  // THE GLASS IS THE HOUSE'S PANE (G393): set near the outer face in its
  // casing with a sill, lit on the switch; the band's mullions stand over it
  const glaze = (i, o, sub, kind2) => {
    const Wl = walls[i];
    HG.dressOpening(bags, Ph, Q, Wl.W, { s0: o.s0, s1: o.s1, y0: o.y0, y1: o.y1, kind: kind2 }, o.y1);
    if (Q.lod !== 0) return;
    const n = Math.max(1, Math.round((o.s1 - o.s0) / sub));
    for (let k = 1; k < n; k++) { const s2 = o.s0 + (o.s1 - o.s0) * k / n; beam(bags.metal, Wl.W.P(s2, o.y0 + 0.02, 0.86), Wl.W.P(s2, o.y1 - 0.02, 0.86), 0.022, 0.018, Wl.N, 0); }
    if (o.y1 - o.y0 > 1.4) beam(bags.metal, Wl.W.P(o.s0 + 0.02, (o.y0 + o.y1) / 2, 0.86), Wl.W.P(o.s1 - 0.02, (o.y0 + o.y1) / 2, 0.86), 0.022, 0.018, Wl.N, 0);
  };
  for (let i = 0; i < 4; i++) for (const st of strips[i] || []) glaze(i, st, P.winSpc, 'strip');
  if (shop) glaze(0, shop, Math.max(0.9, (shop.s1 - shop.s0) / 3), 'shop');
  // THE CORNER BOARDS AND THE FRIEZE (G393): a board proud of each corner
  // the full height of the wall, and a board under the front eave (or the
  // cornice) - the finish that says the wall was built, not extruded
  if (P.corners) for (let i = 0; i < 4; i++) {
    const c = plan[i], top = Math.min(walls[i].topAt(0), walls[(i + 3) % 4].topAt(walls[(i + 3) % 4].len));
    const sx = Math.sign(c[0]), sz = Math.sign(c[1]);
    boxAB(bags.trim, [c[0] - hw - (sx > 0 ? 0 : 0.03) - 0.09 * (sx > 0 ? 0 : 1), fy - 0.02, c[1] - hw - (sz > 0 ? 0 : 0.03) - 0.09 * (sz > 0 ? 0 : 1)],
          [c[0] + hw + (sx > 0 ? 0.03 : 0) + 0.09 * (sx > 0 ? 1 : 0), top - 0.02, c[1] + hw + (sz > 0 ? 0.03 : 0) + 0.09 * (sz > 0 ? 1 : 0)]);
  }
  if (P.frieze && Q.lod === 0) {
    const yF = kind === 2 ? eave + P.parapetH - 0.62 : eave - 0.26;
    boxAB(bags.trim, [-L / 2 - hw - 0.02, yF, w / 2 + hw], [L / 2 + hw + 0.02, yF + 0.22, w / 2 + hw + 0.03]);
  }

  // ---- THE DOCK: a concrete platform along the front at floor level
  let dock = null;
  if (P.dock && (rollers.length || P.dockLenF > 0)) {
    const dl = Math.min(L, L * P.dockLenF);
    let cx = 0;
    if (rollers.length) { const r0 = rollers[0], r1 = rollers[rollers.length - 1]; cx = (r0.s0 + r1.s1) / 2 - L / 2; }
    const x0 = clamp(cx - dl / 2, -L / 2, L / 2 - dl), x1 = x0 + dl;
    const z0 = w / 2 + hw, z1 = z0 + P.dockD;
    const gb = Math.min(g(x0, z1), g(x1, z1), g(x0, z0), g(x1, z0)) - 0.3;
    boxAB(bags.plinth, [x0, gb, z0 - 0.02], [x1, fy - 0.02, z1], { ny: true, nz: true });
    // the steel nosing, the bumpers, the steps at the end
    beam(bags.metal, [x0, fy - 0.02, z1 - 0.03], [x1, fy - 0.02, z1 - 0.03], 0.03, 0.06, [0, 1, 0], 0);
    if (Q.lod === 0) {
      for (const r of rollers) for (const s of [r.s0 + 0.4, r.s1 - 0.4]) {
        const bx = s - L / 2; if (bx > x0 && bx < x1)
          boxAB(bags.door, [bx - 0.15, fy - 0.5, z1 - 0.02], [bx + 0.15, fy - 0.12, z1 + 0.12]);
      }
      const stepsAt = x1 + 0.02, nS = Math.max(2, Math.round((fy - g(x1, z1)) / 0.2));
      for (let i = 0; i < nS; i++) {
        const y1 = fy - 0.02 - i * (fy - 0.02 - g(x1 + 0.5, z1)) / nS;
        boxAB(bags.plinth, [stepsAt, g(x1 + 0.5, z1) - 0.2, z0 + i * (P.dockD / nS)], [stepsAt + 1.1, y1, z1]);
      }
    }
    dock = { x0, x1, z0, z1, top: fy - 0.02 };
  }

  // ---- THE CANOPY over the dock (or over the doors), on steel brackets
  let canopy = null;
  if (P.canopy && (dock || rollers.length || pdoors.length)) {
    // over the dock, else over the bays, else over the doors (G393)
    const x0 = dock ? dock.x0 - 0.3 : (rollers.length ? rollers[0].s0 - L / 2 - 0.6 : Math.min(...pdoors.map(d => d.s0)) - L / 2 - 1.2);
    const x1 = dock ? dock.x1 + 0.3 : (rollers.length ? rollers[rollers.length - 1].s1 - L / 2 + 0.6 : Math.max(...pdoors.map(d => d.s1)) - L / 2 + 1.2);
    const zOut = (dock ? dock.z1 : w / 2 + 1.6) + P.canopyOut;
    const yWall = Math.min(eave - 0.25, (rollers.length ? rollers[0].y1 : (pdoors.length ? pdoors[0].y1 : fy + 2.6)) + (rollers.length ? 0.9 : 0.45));
    const drop = (zOut - (w / 2 + hw)) * Math.tan(10 * D2R);
    const ring = [[x0, yWall, w / 2 + hw], [x1, yWall, w / 2 + hw], [x1, yWall - drop, zOut], [x0, yWall - drop, zOut]];
    plate(bags.roof, ring, rT, [0, -1, 0], uvFrame(ring[0], [1, 0, 0], nrm([0, -drop, zOut - w / 2])));
    beam(bags.metal, [x0, yWall - drop - 0.08, zOut], [x1, yWall - drop - 0.08, zOut], 0.02, 0.08, [0, 1, 0], 0);
    canopy = { x0, x1, zOut, yEdge: yWall - drop, posts: [] };
    if (P.pillars && !dock) {
      // ON POSTS (G393, the user: "no support pillars"): a timber post under
      // the canopy's front edge every 3.5 m, from the ground to the beam
      const n = Math.max(1, Math.round((x1 - x0) / 3.5));
      for (let k = 0; k <= n; k++) {
        const x = x0 + 0.25 + (x1 - x0 - 0.5) * k / n, z = zOut - 0.22;
        beam(bags.beam, [x, g(x, z) - 0.3, z], [x, yWall - drop - 0.08, z], 0.07, 0.07, [0, 0, 1], 0);
        canopy.posts.push([x, z]);
      }
      beam(bags.beam, [x0 + 0.25, yWall - drop - 0.14, zOut - 0.22], [x1 - 0.25, yWall - drop - 0.14, zOut - 0.22], 0.06, 0.06, [0, 1, 0], 0);   // the beam they carry
    } else if (Q.lod === 0) {
      const n = Math.max(2, Math.round((x1 - x0) / 3));
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n;
        beam(bags.metal, [x, yWall - drop - 0.12, zOut - 0.2], [x, yWall - 1.4, w / 2 + hw], 0.035, 0.06, [0, 1, 0], 0);
        beam(bags.metal, [x, yWall - 0.06, w / 2 + hw], [x, yWall - drop - 0.1, zOut - 0.1], 0.04, 0.08, [0, 1, 0], 0);
      }
    }
  }

  // ---- THE GANTRY: an I-beam out of the gable over the main door, a hook on it
  if (P.gantry && kind === 0 && rollers.length) {
    const r = rollers[0], x = (r.s0 + r.s1) / 2 - L / 2;
    const zOut = (dock ? dock.z1 : w / 2 + 1.2) + 0.5;
    const y = ridgeY - 0.9;
    beam(bags.metal, [x, y, -w / 4], [x, y, zOut], 0.06, 0.22, [0, 1, 0], 0);
    if (Q.lod === 0) {
      beam(bags.metal, [x - 0.4, y - 0.25, zOut - 0.15], [x + 0.4, y - 0.25, zOut - 0.15], 0.03, 0.06, [0, 0, 1], 0);
      cyl(bags.metal, [x, y - 0.7, zOut - 0.4], [0, 1, 0], 0.02, 0.45, 5, true);
      boxAB(bags.door, [x - 0.12, y - 0.95, zOut - 0.5], [x + 0.12, y - 0.7, zOut - 0.3]);
    }
  }

  // ---- THE STACK, THE VENTS, THE CONDUIT
  const stacks = [];
  for (let i = 0; i < Math.round(P.stack); i++) {
    const x = -L / 2 + 2.2 + i * 3.0, z = kind === 1 ? -w / 4 : -w / 4;
    const top = ridgeY + 2.4 + i * 0.6;
    const base = yRoof(x, z) - 0.2;
    cyl(bags.metal, [x, base, z], [0, 1, 0], P.stackR, top - base, Q.lod === 0 ? 12 : 6, true, { smooth: true });
    if (Q.lod === 0) {
      cyl(bags.metal, [x, top - 0.02, z], [0, 1, 0], P.stackR * 1.5, 0.06, 12, true);
      cyl(bags.metal, [x, top + 0.18, z], [0, 1, 0], P.stackR * 1.9, 0.05, 12, true);   // the rain cap
      for (let k = 0; k < 3; k++) { const a = k * 2.094; beam(bags.metal, [x + Math.cos(a) * P.stackR * 0.85, top, z + Math.sin(a) * P.stackR * 0.85], [x + Math.cos(a) * P.stackR * 0.85, top + 0.19, z + Math.sin(a) * P.stackR * 0.85], 0.012, 0.012, [1, 0, 0], 0); }   // its legs (G393.2)
      cyl(bags.metal, [x, yRoof(x, z) + rT, z], [0, 1, 0], P.stackR * 1.35, 0.35, 12, true); // the flashing
    }
    stacks.push({ x, z, top, r: P.stackR });
  }
  if (Q.lod === 0) for (let i = 0; i < Math.round(P.vents); i++) {
    const x = -L / 2 + L * (i + 1) / (Math.round(P.vents) + 1), z = kind === 0 ? 0.6 : 0;
    const y = yRoof(x, z) + rT;
    cyl(bags.metal, [x, y, z], [0, 1, 0], 0.16, 0.35, 10, true);
    cyl(bags.metal, [x, y + 0.33, z], [0, 1, 0], 0.26, 0.28, 10, true, { smooth: true });
  }
  if (P.pipes && Q.lod === 0) {
    // a conduit down the right end and along the back at head height
    const x = L / 2 + hw + 0.05;
    beam(bags.metal, [x, fy + 0.3, -w / 2 + 1.0], [x, eave - 0.6, -w / 2 + 1.0], 0.03, 0.03, [1, 0, 0], 0);
    beam(bags.metal, [x, eave - 0.6, -w / 2 + 1.0], [x, eave - 0.6, w / 2 - 0.6], 0.03, 0.03, [1, 0, 0], 0);
    boxAB(bags.door, [x - 0.02, fy + 1.2, -w / 2 + 0.7], [x + 0.14, fy + 1.7, -w / 2 + 1.3]);   // the box
  }

  // ---- THE SIGN (G393, the user: "lots of intersections in the billboards
  // ... squeezed billboards ... ill-placed"): THE ASPECT IS THE SIGN'S. A
  // board that will not fit a place at the asked width is NARROWED to fit
  // its height there, never squeezed; and a place is a band nothing else
  // occupies: under the cornice on a parapet (the cornice, the cap and the
  // frieze stay clear), the wall band between the openings and the eave (or
  // the strip), the fascia off a canopy's edge; when none of those gives
  // three quarters of the asked width, a ROOF SIGN stands on two posts over
  // the front eave (or the parapet cap), the store's own way.
  let sign = null;
  if (P.sign) {
    const meta = signMeta(P.signKey);
    const aspect = meta ? meta.aspect : (P.signW || 5) / (P.signH || 1);
    const want = Math.min(P.signW, L * 0.8);
    const fit = (band, wMax) => {           // the widest board of this aspect in a band `band` tall, at most wMax wide
      const wByH = band * aspect;
      return Math.max(0, Math.min(want, wMax, wByH));
    };
    let x = shop ? (shop.s0 + shop.s1) / 2 - L / 2 : 0, y = 0, z = w / 2 + hw + 0.05, sw = 0, sh = 0, at = '';
    let nx = 0, nz = 1;
    const place = (y0, y1, wMax, tag, zz) => { const sw2 = fit(y1 - y0, wMax); if (sw2 < want * 0.75) return false; sw = sw2; sh = sw / aspect; y = (y0 + y1) / 2; at = tag; if (zz !== undefined) z = zz; return true; };
    if (canopy && !dock) {
      // the fascia: hung off the canopy's front edge with headroom over the walk
      place(fy + 2.15, canopy.yEdge - 0.08, canopy.x1 - canopy.x0 - 0.5, 'fascia', canopy.zOut + 0.02) && (x = clamp(x, canopy.x0 + sw / 2, canopy.x1 - sw / 2));
    }
    if (!at && kind === 2) place(eave + 0.15, eave + P.parapetH - 0.66, L - 1.0, 'parapet');
    if (!at && kind !== 2) {
      const under = Math.max(rollers.length ? Math.max(...rollers.map(r => r.y1)) : 0, shop ? shop.y1 : 0, pdoor ? pdoor.y1 : 0, fy + 2.2, canopyY !== null ? canopyY : 0) + 0.25;   // and over the canopy's junction (G393.2)
      const top = (strips[0] && strips[0].length ? strips[0][0].y0 - 0.15 : (P.frieze ? eave - 0.3 : eave - 0.12));
      place(under, top, L - 1.0, 'wall');
    }
    if (!at) {
      // THE ROOF SIGN: on the front slope's eave (or the parapet cap), its
      // posts on the roof, the board's bottom half a metre up
      sw = want; sh = sw / aspect; at = 'roof';
      const yBase = kind === 2 ? eave + P.parapetH + 0.03 : yRoof(0, w / 2 - 0.45) + rT;
      z = kind === 2 ? w / 2 - 0.12 : w / 2 - 0.45; y = yBase + 0.45 + sh / 2;
      x = clamp(x, -L / 2 + sw / 2 + 0.3, L / 2 - sw / 2 - 0.3);
      for (const bx of [x - sw / 2 + 0.25, x + sw / 2 - 0.25]) {
        beam(bags.metal, [bx, yBase - 0.05, z - 0.06], [bx, y + sh / 2 + 0.06, z - 0.06], 0.035, 0.035, [0, 0, 1], 0);
        // the brace back, its foot ON the roof behind (the roof rises behind a gable's eave; a flat roof's deck lies under the cap)
        if (Q.lod === 0) beam(bags.metal, [bx, y + sh / 2, z - 0.06], [bx, kind === 2 ? eave + 0.12 + rT + 0.02 : yRoof(bx, z - 1.1) + rT + 0.03, z - 1.1], 0.02, 0.02, [0, 1, 0], 0);
      }
    }
    if (sh >= 0.3) {
      const U = [1, 0, 0];
      const c0 = [x - sw / 2, y - sh / 2, z];
      const q = [c0, add(c0, mul(U, sw)), add(add(c0, mul(U, sw)), [0, sh, 0]), add(c0, [0, sh, 0])];
      face(bags.sign, q, [nx, 0, nz], p => [dot(sub(p, c0), U) / sw, (p[1] - c0[1]) / sh]);   // 0..1 uv: the billboard fills it whole
      // the backing, a little behind the face - trim (a painted board), not the door's metal
      boxAB(bags.trim, [x - sw / 2, y - sh / 2, z - 0.05], [x + sw / 2, y + sh / 2, z - 0.005], { pz: true });
      if (Q.lod === 0 && at === 'wall') for (const bx of [x - sw / 2 + 0.3, x + sw / 2 - 0.3])
        beam(bags.metal, [bx, y - sh / 2 - 0.05, w / 2 + hw], [bx, y + sh / 2 + 0.05, w / 2 + hw], 0.03, 0.05, [0, 0, 1], 0.05);
      sign = { x, y, z, w: sw, h: sh, nx, nz, at, key: P.signKey || '' };
    }
  }

  // ---- THE AWNING over the shop window
  if (P.awning && shop) {
    const x0 = shop.s0 - L / 2 - 0.25, x1 = shop.s1 - L / 2 + 0.25;
    const yA = shop.y1 + 0.22, out = 1.3, drop = out * Math.tan(22 * D2R);
    const z0 = w / 2 + hw;
    const ring = [[x0, yA, z0], [x1, yA, z0], [x1, yA - drop, z0 + out], [x0, yA - drop, z0 + out]];
    face(bags.awning, ring, nrm([0, out, drop]), uvFrame(ring[0], [1, 0, 0], [0, 0, 1]));
    // the valance
    face(bags.awning, [[x0, yA - drop, z0 + out], [x1, yA - drop, z0 + out], [x1, yA - drop - 0.22, z0 + out], [x0, yA - drop - 0.22, z0 + out]], [0, 0, 1], uvFrame(ring[3], [1, 0, 0], [0, 1, 0]));
    if (Q.lod === 0) for (const x of [x0 + 0.1, x1 - 0.1])
      beam(bags.metal, [x, yA - drop - 0.02, z0 + out - 0.05], [x, yA - 0.9, z0], 0.02, 0.02, [0, 1, 0], 0);
  }

  // ---- THE YARD AND THE PEOPLE (G393, the user: "No props"): the house's
  // prop kit round a working building - drums, pallets, crates and bins
  // against the front wall in the gaps between its openings, pallets and a
  // cinder pallet out in the yard, a stack of tyres by the bay; two people,
  // one at the door and one by the bay. Published as the house publishes
  // them (`stats.yard`, `stats.people`); the viewer stands the props.
  const yard = [], people = [], keep = [];
  const blocked = (x, z, r) => keep.some(b => Math.hypot(b.x - x, b.z - z) < b.r + r);
  const zWall = w / 2 + hw;
  for (const o of front) keep.push({ x: (o.s0 + o.s1) / 2 - L / 2, z: zWall + 0.6, r: (o.s1 - o.s0) / 2 + 0.9 });
  if (canopy) for (const pp of canopy.posts || []) keep.push({ x: pp[0], z: pp[1], r: 0.4 });
  if (P.yard) {
    let ys = ((Math.round(P.yardSeed) || 7) * 2654435761 + 99) >>> 0;
    const yr = () => (ys = (ys * 1664525 + 1013904223) >>> 0) / 4294967296;
    const WALL_MENU = ['drum_steel', 'barrel_plastic', 'crate_wood_b', 'crate_wood_a', 'bin_metal', 'bottle_propane', 'jerrycan', 'box_cardboard', 'handtruck', 'bags_stack'];
    const YARD_MENU = ['pallets_stack', 'pallet_one', 'pallets_three', 'cinder_pallet', 'cement_bags', 'tyre', 'drum_steel', 'crate_wood_c'];
    const put = (key, x, z, ry, on) => {
      const KK = HG.YARD_KIT[key]; if (!KK) return null;
      const r = Math.hypot(KK.L, KK.W) / 2;
      if (blocked(x, z, r) || x < -L / 2 - 4 || x > L / 2 + 4) return null;
      keep.push({ x, z, r: r + 0.15 });
      const q = { key, x, z, y: g(x, z), ry, on: on || 'ground', r };
      yard.push(q); return q;
    };
    const nWall = Math.round(P.yardK * L / 2.2), nYard = Math.round(P.yardK * L / 3.5);
    for (let i = 0; i < nWall; i++) {
      const key = WALL_MENU[Math.floor(yr() * WALL_MENU.length)], KK = HG.YARD_KIT[key];
      const x = -L / 2 + 0.8 + yr() * (L - 1.6), z = zWall + (KK ? KK.W / 2 : 0.3) + 0.08;
      // ON THE DOCK where the dock is (G393.2, the user: "clipping of people"): the platform's top, not the ground under it
      const onDock = dock && x > dock.x0 && x < dock.x1 && z < dock.z1;
      const q = put(key, x, z, (yr() - 0.5) * 0.4, onDock ? 'dock' : 'ground');
      if (q && onDock) q.y = dock.top;
    }
    for (let i = 0; i < nYard; i++) {
      const key = YARD_MENU[Math.floor(yr() * YARD_MENU.length)];
      const x = -L / 2 - 2 + yr() * (L + 4), z = (dock ? dock.z1 : zWall) + 2.5 + yr() * 3.5;
      put(key, x, z, yr() * Math.PI * 2, 'ground');
    }
    // a stack of tyres by the first bay
    if (rollers.length) { const rx = rollers[0].s1 - L / 2 + 0.9; for (let k = 0; k < 3; k++) { const q = put('tyre', rx, zWall + 0.6, k * 0.7, 'ground'); if (q) { q.y += k * 0.165; keep.pop(); } } }
  }
  if (P.people) {
    if (pdoor) {
      const px = (pdoor.s0 + pdoor.s1) / 2 - L / 2 + 0.9, pz = zWall + 0.9;
      const onDock = dock && px > dock.x0 && px < dock.x1 && pz < dock.z1;
      people.push({ key: 'person_john', x: px, z: pz, y: onDock ? dock.top : g(px, pz), ry: Math.PI * 0.9, on: onDock ? 'dock' : 'ground' });
    }
    if (rollers.length) { const r = rollers[rollers.length - 1]; const px = (r.s0 + r.s1) / 2 - L / 2 - 1.2, pz = (dock ? dock.z1 : zWall) + 2.2; people.push({ key: 'person_luke', x: px, z: pz, y: g(px, pz), ry: -0.4 }); }
  }
  // THE LIGHTS OVER THE BAYS (the door's own lamp came with its dressing):
  // a bulkhead lantern over each roller, published by the house's lampAt
  if (P.lights && Q.lod === 0) for (const r of rollers) {
    const lx = (r.s0 + r.s1) / 2 - L / 2, ly = Math.min(r.y1 + 0.75, eave - 0.35);
    HG.lampAt(bags, Q, [lx, ly, zWall], [0, 0, 1], { k: 1.2, range: 12 });
  }

  // ---- THE GROUND SKIRT: the footprint, the dock, the steps, the props, the people
  const occ = [{ x: 0, z: 0, hx: L / 2 + pt, hz: w / 2 + pt, k: 0.75, soft: 2.2 }];
  if (dock) occ.push({ x: (dock.x0 + dock.x1) / 2, z: (dock.z0 + dock.z1) / 2, hx: (dock.x1 - dock.x0) / 2 + 0.6, hz: (dock.z1 - dock.z0) / 2, k: 0.6, soft: 1.2 });
  for (const q of yard) occ.push({ x: q.x, z: q.z, r: q.r, k: 0.5, soft: 0.5 });
  for (const q of people) occ.push({ x: q.x, z: q.z, r: 0.35, k: 0.45, soft: 0.4 });
  if (canopy) for (const pp of canopy.posts || []) occ.push({ x: pp[0], z: pp[1], r: 0.12, k: 0.5, soft: 0.35 });
  for (const o of occ) o.dry = true;
  if (P.aoGround) HG.buildGroundAO(bags.aoskirt, occ, g);

  // ---- THE BAKE
  const aoInfo = K.bakeAO(BAGS.map(k => bags[k]), { strength: P.ao === undefined ? 0.85 : P.ao, range: P.aoRange || 0.7, ground: g });

  let tris = 0, verts = 0; const per = {};
  for (const k of BAGS) { per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts; }
  const stats = {
    role: P.role || null,                       // an institution's role (G392): the fire hall
    tris, verts, per, footprint: L * w, eave, ridge: ridgeY, kind: ROOFS[kind],
    rollers: rollers.map(r => ({ x: (r.s0 + r.s1) / 2 - L / 2, w: r.s1 - r.s0, h: r.y1 - r.y0, open: r.open })),
    door: pdoor ? { x: (pdoor.s0 + pdoor.s1) / 2 - L / 2, w: P.doorW, h: P.doorH } : null,
    // where a path arrives (the village's planPath reads `front` as the
    // house's stoop): a step out from the men's door, else the main door
    front: { x: pdoor ? (pdoor.s0 + pdoor.s1) / 2 - L / 2 : (rollers.length ? (rollers[0].s0 + rollers[0].s1) / 2 - L / 2 : 0),
             z: w / 2 + (dock ? P.dockD : 0) + 1.0, side: 1, depth: 0 },
    shop, dock, sign, stacks, strips: strips.reduce((n, s) => n + (s ? s.length : 0), 0), doors: pdoors.length,
    bands: strips, canopy, canopyY, wallTops: walls.map(Wl => [Wl.topAt(0), Wl.topAt(Wl.len / 2), Wl.topAt(Wl.len)]),   // for GATE HOUSE rule 42 (G393.2)
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [],
    people, yard, pier: null, lit: LIT,
  };
  return { bags, stats, P, V: { L, w, wallT: t, floorY: fy, eaveH: P.eaveH }, R: null, MAT: F ? F.MAT : MAT };
}

// ---- THE ROADSIDE BILLBOARD (G313) ------------------------------------------
// A sign on two timber posts by the road - the air taxi, the bear tours,
// the motel up the road. Its own bags (the board in `sign`, the posts in
// `metal`'s slot worn as timber by the village's finish), its own finish per
// sign since the board's texture is the sign. `w` is the board's width in
// metres; the height follows the sign's aspect. Origin on the ground under
// the middle of the posts, facing +z.
function billboard(o) {
  const key = o.key, meta = signMeta(key) || { aspect: 3 };
  const w = o.w || 3.6, h = w / meta.aspect, top = o.top || 3.4;
  const bags = { sign: Bag('sign'), door: Bag('door'), metal: Bag('metal'), aoskirt: Bag('aoskirt') };
  const g = o.ground || ((x, z) => 0);
  const px = w / 2 - 0.35;
  for (const x of [-px, px]) {
    const gy = g(x, 0) - 0.3;
    beam(bags.metal, [x, gy, -0.06], [x, top + 0.12, -0.06], 0.08, 0.08, [0, 0, 1], 0);
  }
  const y0 = top - h, z = 0.02;
  const q = [[-w / 2, y0, z], [w / 2, y0, z], [w / 2, top, z], [-w / 2, top, z]];
  face(bags.sign, q, [0, 0, 1], p => [(p[0] + w / 2) / w, (p[1] - y0) / h]);
  boxAB(bags.door, [-w / 2, y0, z - 0.05], [w / 2, top, z - 0.004], { pz: true });
  // the rails behind the board
  for (const y of [y0 + 0.15, top - 0.15]) beam(bags.metal, [-w / 2, y, -0.09], [w / 2, y, -0.09], 0.03, 0.05, [0, 0, 1], 0);
  HG.buildGroundAO(bags.aoskirt, [{ x: -px, z: 0, r: 0.1, k: 0.5, soft: 0.4, dry: true }, { x: px, z: 0, r: 0.1, k: 0.5, soft: 0.4, dry: true }], g);
  return { bags, BAGS: ['sign', 'door', 'metal'], stats: { w, h, top, key, sign: { x: 0, y: top - h / 2, z, w, h, nx: 0, nz: 1 } } };
}
// the finish for one: the board's texture, timber posts, the backing's rust
function billboardFinish(key) {
  const F = makeFinish();
  const M = F.MAT;
  for (const k of ['door', 'metal']) HG.shadeHouse(M[k], F.SHADE_U);
  dress(M.door, 'door', SET_IDX('door', 'rustysheet'));
  dress(M.metal, 'metal', SET_IDX('metal', 'rust'));
  const bb = billboardTexture(key) || signTexture((signMeta(key) || { name: key }).name || key, 3.6, 1.2);
  M.sign.map = bb; M.sign.alphaTest = billboardTexture(key) ? 0.5 : 0; M.sign.needsUpdate = true;
  F.SHADE_U.uDirtTop.value = 0.5; F.SHADE_U.uSag.value = 0;
  return F;
}

// ---- a random one, for the dice --------------------------------------------
function randomBig(seed) {
  const rnd = rng(seed);
  const names = Object.keys(PRESETS);
  const name = names[Math.floor(rnd() * names.length)];
  const P = Object.assign({}, DEF, PRESETS[name], { seed });
  P.L = Math.round((P.L * (0.85 + rnd() * 0.3)) * 2) / 2;
  P.w = Math.round((P.w * (0.9 + rnd() * 0.2)) * 2) / 2;
  P.eaveH = Math.round((P.eaveH * (0.9 + rnd() * 0.2)) * 10) / 10;
  P.wallSet = Math.floor(rnd() * ROLE_SETS.wall.length);
  P.roofSet = Math.floor(rnd() * ROLE_SETS.roof.length);
  P.doorSet = Math.floor(rnd() * ROLE_SETS.door.length);
  P.rollerOpen = Math.round(rnd() * 20) / 20;
  P.dirt = 0.3 + rnd() * 0.5;
  P.preset = name;
  return P;
}

window.BIG_GEN = {
  DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, ROLE_SETS, SET_IDX, setNames,
  build, randomBig, applyFinish, makeFinish, finishReport, signTexture, CATS, catOf,
  billboard, billboardFinish, signMeta, signKeys, billboardTexture,
  libSets: HG.libSets, isBig: true,
};
})();
