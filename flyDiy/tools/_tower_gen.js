// _tower_gen.js — THE CONTROL TOWERS (G414, the user: "now let's have a
// little fun and do some control towers. The first one will be a derelict
// WWII tower, metal truss, open cabin, old, rusty and broken. The second one
// will be a tiny cute one, like the ones is small airfields. Partially
// attended at the club airfield. Then we'll have a regional airport one.
// Actually, do a few variations of the small cute ones, 5 of them. Get the
// firetruck in some of the control tower").
//
// A tower is ONE THING SAID IN THREE PARTS, and every part is a dial:
//
//   THE BASE   what holds the cab up - a battered STEEL LATTICE (four legs,
//              girts and X-bracing panel by panel, on concrete footings), four
//              TIMBER POSTS with their girts and knee braces, a MASONRY SHAFT
//              (the house's concrete, a door at its foot, a slit window), or a
//              HUT (a one-room building whose flat roof is the cab's walkway)
//   THE CAB    the glazed room: a sill wall in the house's cladding, the
//              GLAZING LEANING OUT (a tower's glass leans so the sky does not
//              reflect in it), mullions at the corners and up the faces, a
//              head rail, a roof - a pyramid, a low hip or a flat deck with a
//              fascia - and the mast on it with its beacon, its whips, the
//              windsock or the flag
//   THE WAY UP a LADDER, a STRAIGHT stair to the gallery, or a SWITCHBACK
//              stair up the front face with its landings on their own posts
//
// round the cab the GALLERY (a deck out past the walls with its rail) and at
// the foot the yard: the fire truck where the field keeps one (the user's two
// trucks, YARD_KIT `truck`). DERELICT is a dial too: no glass, some mullions
// gone, rails missing in stretches and leaning, a quarter of the bracing gone
// (one member left hanging from its top end), the roof half gone and the
// half that stays sagging, ladder rungs missing, and the rust sets. The panes
// are opaque and lit on the switch (the hangars' rule); the beacon glows and
// publishes itself as a `beacon` light (rule 29: the glass is the emitting
// geometry). Same API as the other generators (DEF/ROWS/PRESETS/BAGS/MAT/
// build/applyFinish/makeFinish/catOf/CATALOGUE); the house's finish, dressing,
// occlusion bake and ground skirt; headless for the gate.
(() => {
'use strict';
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, off, Bag, face, uvFrame, boxAB, beam, plate, cyl, wall } = K;
const D2R = Math.PI / 180;

// ---- the materials: the house's wardrobe by role, the house's finish over them
const ROLE = { siding: 'wall', roof: 'roof', steel: 'steel', post: 'post', deck: 'deck', stone: 'stone', metal: 'metal' };
const SETS = role => HG.ROLE_SETS[ROLE[role] || role];
const SET_IDX = (role, key) => Math.max(0, SETS(role).indexOf(key));
const setNames = role => SETS(role).slice();
const TEXC = new Map();
function texOf(key, mapName) {
  const S = HG.libSets(), set = S && S[key];
  if (!set) return null;
  const img = set[mapName];
  if (!img) return null;
  const ck = key + '|' + mapName;
  if (TEXC.has(ck)) return TEXC.get(ck);
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (mapName === 'diff' || mapName === 'paint') t.colorSpace = THREE.SRGBColorSpace;
  const tile = set.tile || 2;
  t.repeat.set(1 / tile, 1 / tile);
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else if (img.addEventListener) img.addEventListener('load', ok);
  TEXC.set(ck, t);
  return t;
}
const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.92, metalness: 0 }, o || {}));
function makeMats() {
  const M = {
    steel: std(0x6d6f70, { roughness: 0.55, metalness: 0.7 }), post: std(0x8a7358), siding: std(0xb9b2a6),
    roof: std(0x6f7478, { roughness: 0.6, metalness: 0.3 }), deck: std(0x7d7368), stone: std(0x8c8a84),
    metal: std(0xa9b1b6, { roughness: 0.45, metalness: 0.75 }),
    sock: std(0xe8641e, { roughness: 0.8 }),      // the windsock's orange: flat, no scan for a sock
  };
  M.sock.userData = Object.assign(M.sock.userData || {}, { flat: true });
  return M;
}
const BAGS = ['steel', 'post', 'siding', 'trim', 'roof', 'deck', 'stone', 'metal', 'pane', 'glass', 'sock'];
const EXTRA = ['aoskirt', 'smoke'];
const makeFinish = () => { const HF = HG.makeFinish(); const M = makeMats(); M.trim = HF.MAT.trim; M.pane = HF.MAT.pane; M.glass = HF.MAT.glass; M.smoke = HF.MAT.smoke; M.aoskirt = HF.MAT.aoskirt; return { MAT: M, SHADE_U: HG.makeShadeU(), HF }; };
const DEFAULT_FINISH = makeFinish();
const MAT = DEFAULT_FINISH.MAT;
function houseP(P) {
  return Object.assign({}, HG.DEF, {
    trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: P.trimCol === undefined ? 6 : P.trimCol, trimW: 0.07,
    dirt: P.dirt, dirtH: P.dirtH, noise: P.noise, clouds: P.clouds, weather: 0.4 + 0.5 * (P.derelict || 0), paintPunch: 0.9,
    curtains: 0, muntin: 0, doorLight: 0, doorAjar: P.derelict ? 1 : 0, hand: 0, bevel: 0.006,
    lights: P.lights ? 1 : 0, winLit: 0.6, winLink: 1, porchLamp: 1, lampKind: 1, lightSeed: P.seed || 1,
    floorY: 0, slopeX: P.slopeX, slopeZ: P.slopeZ, ground: P.ground,
    smoke: 0, ao: P.ao, aoRange: P.aoRange, aoDirect: P.aoDirect,
  });
}
function dress(m, role, idx, o) {
  const list = SETS(role);
  const key = list[clamp(Math.round(idx || 0), 0, list.length - 1)];
  const opt = o || {};
  const S = HG.libSets(), painted = !!(opt.tint && opt.tint !== 0xffffff && S && S[key] && S[key].paint);
  const d = texOf(key, painted ? 'paint' : 'diff');
  if (!d) { m.color.setHex(opt.flat || 0xb0aaa2); return; }
  m.map = d; m.normalMap = texOf(key, 'nor'); m.roughnessMap = texOf(key, 'rough');
  m.color.setHex(opt.tint || 0xffffff);
  m.metalness = opt.metal === undefined ? (role === 'metal' || role === 'steel' ? 0.85 : (role === 'roof' ? 0.35 : 0)) : opt.metal;
  m.roughness = 1; if (m.normalScale) m.normalScale.set(1, 1); m.needsUpdate = true;
}

// ---- the dials
const BASES = ['lattice', 'posts', 'shaft', 'hut'];
const ROOFS = ['flat', 'pyramid', 'low hip'];
const STAIRS = ['none', 'ladder', 'straight', 'switchback'];
const TRUCKS = ['none', 'small', 'big', 'both'];
const DEF = {
  seed: 3, base: 0, H: 6.0, baseW: 5.0, topW: 3.4, panelH: 2.0, slopeZ: 0, slopeX: 0,
  cabSides: 4, cabW: 3.4, cabH: 2.7, sillH: 0.9, tilt: 12, roofKind: 1, roofOver: 0.45,
  gallery: 1, galOut: 0.9, stairs: 3, mast: 1, mastH: 2.2, beacon: 1, whips: 2, windsock: 0, flag: 0,
  hutDoor: 1, derelict: 0, truck: 0, lights: 0,
  wallSet: SET_IDX('siding', 'paintwood'), wallCol: 6, roofSet: SET_IDX('roof', 'galv'), steelSet: SET_IDX('steel', 'steelgrey'),
  postSet: SET_IDX('post', 'rough'), deckSet: SET_IDX('deck', 'greywood'), stoneSet: SET_IDX('stone', 'concrete'),
  metalSet: SET_IDX('metal', 'galv'), trimCol: 6,
  dirt: 0.45, dirtH: 1.0, noise: 0.16, clouds: 0.5,
  ao: 0.85, aoRange: 0.6, aoDirect: 0.35, aoGround: 1,
};
const ROWS = [
  ['the base', [
    ['base', 'kind', 0, 3, 1, BASES], ['H', 'cab floor above ground', 2.5, 16, 0.1],
    ['baseW', 'width at the ground', 2.4, 9, 0.1], ['topW', 'width under the cab', 2.0, 6, 0.1, null, P => P.base < 2],
    ['panelH', 'panel height', 1.4, 3.2, 0.1, null, P => P.base < 2],
    ['slopeZ', 'ground slope z', -8, 8, 0.5], ['slopeX', 'ground slope x', -6, 6, 0.5],
  ]],
  ['the cab', [
    ['cabSides', 'sides', 4, 8, 2], ['cabW', 'across flats', 2.2, 7, 0.1], ['cabH', 'height', 2.2, 3.6, 0.05],
    ['sillH', 'sill wall', 0.5, 1.4, 0.05], ['tilt', 'glass lean out (deg)', 0, 20, 1],
    ['roofKind', 'roof', 0, 2, 1, ROOFS], ['roofOver', 'roof overhang', 0.1, 1.0, 0.05],
    ['gallery', 'gallery', 0, 1, 1], ['galOut', 'gallery out', 0.5, 1.6, 0.05, null, P => !!P.gallery],
  ]],
  ['the top', [
    ['mast', 'mast', 0, 1, 1], ['mastH', 'mast height', 0.8, 5, 0.1, null, P => !!P.mast], ['beacon', 'beacon', 0, 1, 1, null, P => !!P.mast],
    ['whips', 'antenna whips', 0, 4, 1], ['windsock', 'windsock', 0, 1, 1], ['flag', 'flag pole', 0, 1, 1],
  ]],
  ['the way up and the yard', [
    ['stairs', 'stairs', 0, 3, 1, STAIRS], ['hutDoor', 'door in the hut / shaft', 0, 1, 1, null, P => P.base >= 2],
    ['truck', 'fire truck', 0, 3, 1, TRUCKS], ['lights', 'lights', 0, 1, 1], ['derelict', 'derelict', 0, 1, 0.05],
  ]],
  ['finish', [
    ['wallSet', 'cab cladding', 0, SETS('siding').length - 1, 1, setNames('siding')], ['wallCol', 'cab paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['roofSet', 'roof', 0, SETS('roof').length - 1, 1, setNames('roof')], ['steelSet', 'steel', 0, SETS('steel').length - 1, 1, setNames('steel')],
    ['postSet', 'timber', 0, SETS('post').length - 1, 1, setNames('post')], ['deckSet', 'deck', 0, SETS('deck').length - 1, 1, setNames('deck')],
    ['stoneSet', 'concrete', 0, SETS('stone').length - 1, 1, setNames('stone')], ['metalSet', 'rails', 0, SETS('metal').length - 1, 1, setNames('metal')],
    ['trimCol', 'casing paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['dirt', 'dirt', 0, 1, 0.05], ['dirtH', 'dirt height', 0.3, 2.5, 0.05], ['clouds', 'weather clouds', 0, 1, 0.05],
    ['ao', 'baked occlusion', 0, 1, 0.05], ['aoGround', 'ground skirt', 0, 1, 1],
  ]],
];
// THE SEVEN: the derelict WWII tower, five small ones for the fields and the
// clubs, and the regional airport's
const PRESETS = {
  'WWII tower': {
    base: 0, H: 9.0, baseW: 5.6, topW: 3.6, panelH: 2.2, cabSides: 4, cabW: 3.6, cabH: 2.6, sillH: 1.0, tilt: 0, roofKind: 0, roofOver: 0.3,
    gallery: 1, galOut: 0.8, stairs: 1, mast: 1, mastH: 2.6, beacon: 0, whips: 1, windsock: 0, derelict: 1, truck: 0,
    wallSet: SET_IDX('siding', 'corrrust'), wallCol: 0, roofSet: SET_IDX('roof', 'rust'), steelSet: SET_IDX('steel', 'steelrust'),
    deckSet: SET_IDX('deck', 'wornwood'), metalSet: SET_IDX('metal', 'rust'), trimCol: 8, dirt: 0.8, dirtH: 1.6, clouds: 0.8,
  },
  'field cab': {
    base: 1, H: 4.2, baseW: 3.2, topW: 3.0, panelH: 2.1, cabSides: 4, cabW: 3.0, cabH: 2.4, sillH: 0.85, tilt: 8, roofKind: 2, roofOver: 0.5,
    gallery: 1, galOut: 0.8, stairs: 2, mast: 0, whips: 1, windsock: 1, flag: 0, truck: 0,
    wallSet: SET_IDX('siding', 'paintwood'), wallCol: 6, roofSet: SET_IDX('roof', 'corrworn'), postSet: SET_IDX('post', 'rough'), trimCol: 1,
  },
  'club tower': {
    base: 0, H: 6.5, baseW: 5.2, topW: 3.6, panelH: 2.0, cabSides: 8, cabW: 3.6, cabH: 2.7, sillH: 0.9, tilt: 12, roofKind: 1, roofOver: 0.45,
    gallery: 1, galOut: 0.9, stairs: 3, mast: 1, mastH: 2.4, beacon: 1, whips: 2, windsock: 0, truck: 1,
    wallSet: SET_IDX('siding', 'paintwood'), wallCol: 12, roofSet: SET_IDX('roof', 'galv'), steelSet: SET_IDX('steel', 'steelgrey'), trimCol: 6,
  },
  'hut tower': {
    base: 3, H: 3.4, baseW: 5.0, cabSides: 4, cabW: 3.2, cabH: 2.5, sillH: 0.9, tilt: 10, roofKind: 1, roofOver: 0.5,
    gallery: 1, galOut: 0.9, stairs: 2, mast: 1, mastH: 1.6, beacon: 1, whips: 1, windsock: 1, hutDoor: 1, truck: 1,
    wallSet: SET_IDX('siding', 'paintwood'), wallCol: 14, roofSet: SET_IDX('roof', 'boxprof'), trimCol: 6, deckSet: SET_IDX('deck', 'greywood'),
  },
  'block tower': {
    base: 2, H: 7.0, baseW: 3.0, cabSides: 4, cabW: 3.8, cabH: 2.7, sillH: 0.9, tilt: 14, roofKind: 0, roofOver: 0.35,
    gallery: 1, galOut: 1.0, stairs: 3, mast: 1, mastH: 2.2, beacon: 1, whips: 3, hutDoor: 1, truck: 1,
    wallSet: SET_IDX('siding', 'render'), wallCol: 6, roofSet: SET_IDX('roof', 'galv'), stoneSet: SET_IDX('stone', 'concrete'), trimCol: 13, dirt: 0.35,
  },
  'lookout cab': {
    base: 1, H: 6.8, baseW: 4.6, topW: 3.2, panelH: 2.2, cabSides: 6, cabW: 3.2, cabH: 2.5, sillH: 0.95, tilt: 6, roofKind: 1, roofOver: 0.55,
    gallery: 1, galOut: 0.85, stairs: 3, mast: 0, whips: 1, windsock: 0, flag: 1, truck: 0,
    wallSet: SET_IDX('siding', 'board'), wallCol: 0, roofSet: SET_IDX('roof', 'shingle'), postSet: SET_IDX('post', 'bark'), deckSet: SET_IDX('deck', 'roughwood'), trimCol: 6,
  },
  'regional tower': {
    base: 2, H: 12.0, baseW: 4.2, cabSides: 8, cabW: 5.4, cabH: 3.0, sillH: 1.0, tilt: 15, roofKind: 0, roofOver: 0.4,
    gallery: 1, galOut: 1.1, stairs: 3, mast: 1, mastH: 3.2, beacon: 1, whips: 4, windsock: 0, flag: 1, hutDoor: 1, truck: 3,
    wallSet: SET_IDX('siding', 'render'), wallCol: 6, roofSet: SET_IDX('roof', 'galv'), stoneSet: SET_IDX('stone', 'concrete'), trimCol: 8, dirt: 0.3,
  },
};
const CATS = { 'WWII tower': 'landmark', 'field cab': 'airport xs', 'club tower': 'airport s', 'hut tower': 'airport s', 'block tower': 'airport s', 'lookout cab': 'airport xs', 'regional tower': 'airport m' };
const catOf = name => CATS[name] || null;
function rng(seed) { let st = ((seed | 0) * 2654435761 + 11) >>> 0; return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- the kit of parts ---------------------------------------------------------
// a rail along a polyline of deck points: posts every `sp`, a top rail and a
// mid rail; `gaps` are [s0, s1] stretches of the length with no rail (a stair
// arriving, a derelict's missing run); `lean` tilts the odd post (derelict)
function railAlong(bag, pts, o) {
  const opt = o || {}, h = opt.h || 1.0, sp = opt.sp || 1.0, closed = !!opt.closed, rnd = opt.rnd || (() => 0.5), lean = opt.lean || 0;
  const gaps = opt.gaps || [];
  let s = 0; const segs = [];
  for (let i = 0; i + (closed ? 0 : 1) < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    segs.push({ a, b, s0: s, L: len(sub(b, a)) }); s += segs[segs.length - 1].L;
  }
  const inGap = q => gaps.some(g => q > g[0] && q < g[1]);
  let posts = 0;
  for (const sg of segs) {
    const d = nrm(sub(sg.b, sg.a)), nP = Math.max(1, Math.round(sg.L / sp));
    for (let k = 0; k <= nP; k++) {
      if (k === nP && !(closed || sg === segs[segs.length - 1])) continue;
      const q = sg.s0 + sg.L * k / nP;
      if (inGap(q)) continue;
      const p = add(sg.a, mul(d, sg.L * k / nP));
      const tip = lean && rnd() < lean ? [p[0] + (rnd() - 0.5) * 0.5, p[1] + h * 0.85, p[2] + (rnd() - 0.5) * 0.5] : [p[0], p[1] + h, p[2]];
      beam(bag, p, tip, 0.022, 0.022, d, 0); posts++;
    }
    // the rails, in runs between the gaps
    const cuts = [sg.s0, sg.s0 + sg.L];
    for (const g of gaps) { if (g[0] > sg.s0 && g[0] < sg.s0 + sg.L) cuts.push(g[0]); if (g[1] > sg.s0 && g[1] < sg.s0 + sg.L) cuts.push(g[1]); }
    cuts.sort((x, y) => x - y);
    for (let i = 0; i + 1 < cuts.length; i++) {
      if (inGap((cuts[i] + cuts[i + 1]) / 2) || cuts[i + 1] - cuts[i] < 0.05) continue;
      const a = add(sg.a, mul(d, cuts[i] - sg.s0)), b = add(sg.a, mul(d, cuts[i + 1] - sg.s0));
      beam(bag, [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.02, 0.018, [0, 1, 0], 0);
      beam(bag, [a[0], a[1] + h * 0.5, a[2]], [b[0], b[1] + h * 0.5, b[2]], 0.012, 0.012, [0, 1, 0], 0);
    }
  }
  return posts;
}
// a flight of stairs from a (the foot, on the ground or a landing) to b (the
// top, at the deck): two stringers, treads every riser, a rail on the side(s)
// asked for (`rail`: 1 the +side, -1 the -side, 2 both); the side is the
// cross of the run and up
function flight(bags, a, b, w, o) {
  const opt = o || {}, rail = opt.rail === undefined ? 2 : opt.rail;
  const run = sub(b, a), rise = run[1], horiz = Math.hypot(run[0], run[2]);
  if (rise < 0.2 || horiz < 0.2) return null;
  const dir = nrm([run[0], 0, run[2]]), side = nrm(crs([0, 1, 0], dir));
  const n = Math.max(2, Math.round(rise / 0.19)), riser = rise / n, tread = horiz / n;
  const sBag = opt.timber ? bags.post : bags.steel, tBag = opt.timber ? bags.deck : bags.steel;
  // the stringers, along the slope, just outside the treads
  for (const s of [-1, 1]) {
    const o1 = mul(side, s * (w / 2 + 0.03));
    beam(sBag, add(add(a, o1), [0, 0.12, 0]), add(add(b, o1), [0, 0.12, 0]), 0.03, 0.14, [0, 1, 0], 0.05);
  }
  for (let i = 1; i <= n; i++) {
    const c = add(a, [dir[0] * tread * (i - 0.5), riser * i, dir[2] * tread * (i - 0.5)]);
    beam(tBag, add(c, mul(side, -w / 2)), add(c, mul(side, w / 2)), tread * 0.5, 0.02, [0, 1, 0], 0);
  }
  const posts = [];
  for (const s of [-1, 1]) {
    if (!(rail === 2 || rail === s)) continue;
    const o1 = mul(side, s * (w / 2 + 0.05));
    const p0 = add(a, o1), p1 = add(b, o1);
    const nP = Math.max(1, Math.round(horiz / 1.1));
    for (let k = 0; k <= nP; k++) { const p = K.lerp3(p0, p1, k / nP); beam(bags.metal, p, [p[0], p[1] + 0.95, p[2]], 0.02, 0.02, dir, 0); posts.push(p); }
    beam(bags.metal, [p0[0], p0[1] + 0.95, p0[2]], [p1[0], p1[1] + 0.95, p1[2]], 0.02, 0.018, [0, 1, 0], 0.03);
  }
  return { n, riser, tread, dir, side, top: b, foot: a };
}
// a landing: a plate at p, `along` x `across`, on two posts down to the ground on its outer edge
function landing(bags, p, along, across, dir, side, g, o) {
  const opt = o || {};
  const c = [p[0], p[1], p[2]];
  const cr = [add(add(c, mul(dir, -along / 2)), mul(side, -across / 2)), add(add(c, mul(dir, along / 2)), mul(side, -across / 2)),
              add(add(c, mul(dir, along / 2)), mul(side, across / 2)), add(add(c, mul(dir, -along / 2)), mul(side, across / 2))];
  plate(opt.timber ? bags.deck : bags.steel, cr, 0.06, [0, -1, 0], q => [q[0], q[2]]);
  if (opt.posts !== false) for (const q of [cr[2], cr[3]]) {
    const f = [q[0] - side[0] * 0.05, g(q[0], q[2]) - 0.25, q[2] - side[2] * 0.05];
    beam(opt.timber ? bags.post : bags.steel, f, [f[0], q[1] - 0.03, f[2]], opt.timber ? 0.06 : 0.04, opt.timber ? 0.06 : 0.04, dir, 0);
  }
  return cr;
}
function ladder(bag, foot, top, w, o) {
  const opt = o || {}, rnd = opt.rnd || (() => 0.5), miss = opt.miss || 0;
  const d = nrm(sub(top, foot)), side = nrm(crs([0, 1, 0], d.length && Math.abs(d[1]) > 0.99 ? [0, 0, 1] : d));
  const sideH = nrm(crs([0, 1, 0], opt.face || [0, 0, 1]));
  for (const s of [-1, 1]) beam(bag, add(foot, mul(sideH, s * w / 2)), add(top, mul(sideH, s * w / 2)), 0.025, 0.04, opt.face || [0, 0, 1], 0);
  const L = len(sub(top, foot)), n = Math.floor((L - 0.5) / 0.3);
  let rungs = 0;
  for (let i = 1; i <= n; i++) {
    if (miss && rnd() < miss) continue;
    const p = add(foot, mul(d, i * 0.3));
    beam(bag, add(p, mul(sideH, -w / 2)), add(p, mul(sideH, w / 2)), 0.014, 0.014, opt.face || [0, 0, 1], 0); rungs++;
  }
  return rungs;
}

// ---- the build ---------------------------------------------------------------
function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const Q = { lod: lod | 0 };
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const Ph = houseP(P);
  const LIT = HG.litBegin();
  const rnd = rng(P.seed);
  const der = clamp(P.derelict || 0, 0, 1), broken = der > 0.05;
  const litOn = P.lights && !broken ? 1 : 0;
  const base = Math.round(P.base), n = Math.max(4, Math.round(P.cabSides / 2) * 2);
  const H = P.H;
  const rot = n === 4 ? Math.PI / 4 : Math.PI / n;             // a flat facing front (+z)
  const rFlat = P.cabW / 2, r = rFlat / Math.cos(Math.PI / n);
  const gal = P.gallery ? P.galOut : 0.12;
  const deckR = r + gal / Math.cos(Math.PI / n);
  const deckRFlat = rFlat + gal;
  const yDeck = H, deckT = 0.14;
  const bw = P.baseW, tw = base < 2 ? Math.min(P.topW, P.cabW + 0.4) : bw;
  const wAt = y => bw + (tw - bw) * clamp(y / H, 0, 1);      // the base's width at a height
  const occ = [];
  let members = 0, gone = 0;
  const steelW = base === 1 ? 0.10 : 0.06;

  // ==== THE BASE ====
  let hut = null;
  if (base === 0 || base === 1) {
    const timber = base === 1;
    const bagL = timber ? bags.post : bags.steel;
    const legHW = timber ? 0.10 : 0.06;
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    const legAt = (c, y) => [c[0] * wAt(y) / 2, y, c[1] * wAt(y) / 2];
    const yTop = yDeck - deckT - 0.02;
    for (const c of corners) {
      const f = legAt(c, 0), t = legAt(c, yTop);
      const gy = g(f[0], f[2]);
      // the footing: a concrete block from below the ground to a little over it
      boxAB(bags.stone, [f[0] - 0.32, gy - 0.4, f[2] - 0.32], [f[0] + 0.32, gy + 0.18, f[2] + 0.32]);
      beam(bagL, [f[0], gy + 0.15, f[2]], t, legHW, legHW, [0, 0, 1], 0, timber ? { bevel: 0.01 } : null); members++;
      occ.push({ x: f[0], z: f[2], r: 0.45, k: 0.5, soft: 0.5 });
    }
    // the panels: girts at every level, X-bracing on every face (the posts: knee braces at the top, X on the sides)
    const nP = Math.max(1, Math.round(H / P.panelH));
    for (let k = 1; k <= nP; k++) {
      const y = Math.min(yTop, k * H / nP), y0 = (k - 1) * H / nP;
      for (let i = 0; i < 4; i++) {
        const A = legAt(corners[i], y), B = legAt(corners[(i + 1) % 4], y);
        const face_ = i === 0 ? 'front' : (i === 2 ? 'back' : 'side');
        if (!timber || k === nP || k % 2 === 0) { beam(bagL, A, B, steelW * 0.5, steelW, [0, 1, 0], 0); members++; }
        // the diagonals of the panel below this girt
        const A0 = legAt(corners[i], y0), B0 = legAt(corners[(i + 1) % 4], y0);
        if (Q.lod !== 0 && k % 2 === 0) continue;
        const wantX = timber ? (face_ === 'side' || k === nP) : true;
        if (!wantX) continue;
        if (timber && k === nP && face_ !== 'side') {
          // knee braces under the top girt on the open faces
          for (const [P0, P1] of [[A0, A], [B0, B]]) {
            const m = K.lerp3(P0, P1, 0.55), tip = K.lerp3(A, B, P0 === A0 ? 0.3 : 0.7);
            beam(bags.post, m, tip, 0.045, 0.06, nrm(crs(sub(B, A), [0, 1, 0])), 0); members++;
          }
          continue;
        }
        for (const [P0, P1] of [[A0, B], [B0, A]]) {
          if (broken && rnd() < 0.28 * der) {
            gone++;
            if (rnd() < 0.5) { const hang = [P1[0], P1[1] - len(sub(P1, P0)) * 0.6, P1[2]]; beam(bagL, P1, hang, steelW * 0.4, steelW * 0.4, [0, 0, 1], 0); }   // left hanging from its top end
            continue;
          }
          beam(bagL, P0, P1, steelW * 0.4, timber ? 0.05 : steelW * 0.5, nrm(crs(sub(B, A), [0, 1, 0])), 0); members++;
        }
      }
    }
    // the frame under the deck
    const fr = corners.map(c => legAt(c, yTop));
    for (let i = 0; i < 4; i++) beam(bagL, fr[i], fr[(i + 1) % 4], steelW * 0.6, steelW * 1.2, [0, 1, 0], 0);
  } else {
    // THE SHAFT / THE HUT: four walls of the house's, a door on the front at the ground
    const half = bw / 2, t = base === 2 ? 0.25 : 0.14;
    const plan = [[-half, half], [half, half], [half, -half], [-half, -half]];
    let gLo = 1e9; for (const p of plan) gLo = Math.min(gLo, g(p[0], p[1]));
    const yW = base === 2 ? yDeck - deckT : yDeck - deckT;
    const wallBag = base === 2 ? bags.stone : bags.siding;
    const walls = [];
    for (let i = 0; i < 4; i++) {
      const A = plan[i], B = plan[(i + 1) % 4], L = bw;
      const holes = [];
      // the door: the hut's on the front, to the right of the stair; the shaft's on the +x side (the switchback runs up its front)
      const doorS = base === 3 ? Math.min(L - 0.9, L * 0.72) : L / 2;
      const doorWall = base === 3 ? 0 : 1;
      if (i === doorWall && P.hutDoor) holes.push({ s0: doorS - 0.5, s1: doorS + 0.5, y0: gLo + 0.05, y1: gLo + 2.1, kind: 'door' });
      if (base === 2 && i === 0 && H > 5) holes.push({ s0: L / 2 - 0.3, s1: L / 2 + 0.3, y0: gLo + 3.2, y1: gLo + 4.1, kind: 'window' });
      if (base === 3) {
        if (i === 1 || i === 3) holes.push({ s0: L / 2 - 0.55, s1: L / 2 + 0.55, y0: gLo + 1.05, y1: gLo + 2.15, kind: 'window' });
        if (i === 0) holes.push({ s0: L * 0.25 - 0.5, s1: L * 0.25 + 0.5, y0: gLo + 1.05, y1: gLo + 2.15, kind: 'window' });
      }
      const W = wall(wallBag, { A, B, y0: gLo - 0.35, t, topAt: () => yW, holes, ext: [t / 2, t / 2], inner: false, endCap: [false, false], capBot: false, capTop: true, sub: Q.lod === 0 ? 1.2 : 0 });
      walls.push({ W, holes });
      if (W && Q.lod === 0) for (const h of holes) { HG.dressOpening(bags, Ph, Q, W, h, h.y1); if (h.kind === 'door') { HG.buildDoor(bags, Ph, Q, W, h, h.y1); HG.buildLamp(bags, Ph, Q, W, h, 1); } }
    }
    if (base === 3) {
      // corner boards and a frieze under the deck: the hut is a little house
      if (Q.lod === 0) for (const p of plan) { const cx = p[0] + Math.sign(p[0]) * (t / 2 + 0.02), cz = p[1] + Math.sign(p[1]) * (t / 2 + 0.02); beam(bags.trim, [cx, gLo + 0.05, cz], [cx, yW - 0.02, cz], 0.05, 0.05, [1, 0, 0], 0); }
      hut = { half, top: yW };
    }
    occ.push({ x: 0, z: 0, hx: half + 0.2, hz: half + 0.2, k: 0.7, soft: 1.2 });
  }

  // ==== THE DECK AND THE GALLERY ====
  // the hut's whole roof is the walkway; on the others the deck is the cab's n-gon out past the walls
  let deckRing, deckEdge;
  if (hut) {
    const e = hut.half + 0.25;
    deckRing = [[-e, yDeck, -e], [e, yDeck, -e], [e, yDeck, e], [-e, yDeck, e]];
  } else deckRing = K.ringN(0, 0, deckR, n, rot, yDeck);
  const edgeZ = hut ? hut.half + 0.25 : deckRFlat;               // where the deck ends on the front (the stair's landing line)
  plate(bags.deck, deckRing, deckT, [0, -1, 0], p => [p[0], p[2]], { sub: Q.lod === 0 ? 0.6 : 0 });
  // a fascia band round the deck's edge
  if (Q.lod === 0) { const rim = deckRing.map(p => [p[0], p[1] + 0.02, p[2]]); K.prismRings(bags.trim, rim.map(p => [p[0] * 1.004, p[1] - deckT - 0.03, p[2] * 1.004]), rim.map(p => [p[0] * 1.004, p[1] + 0.04, p[2] * 1.004]), false, false); }
  deckEdge = deckRing.map(p => [p[0] * (1 - 0.07 / len([p[0], 0, p[2]])), yDeck + 0.02, p[2] * (1 - 0.07 / len([p[0], 0, p[2]]))]);
  let railPosts = 0;
  const stairs = Math.round(P.stairs);
  // ==== THE CAB ====
  const ySill = yDeck + P.sillH, yHead = yDeck + P.cabH;
  const tilt = P.tilt * D2R;
  const rTop = r + (yHead - ySill) * Math.tan(tilt), rTopFlat = rFlat + (yHead - ySill) * Math.tan(tilt);
  // the sill wall: n panels in the cladding, the outside on +N (the ring walked clockwise from above)
  const ringS = K.ringN(0, 0, r, n, rot, ySill).map(p => [p[0], p[2]]);
  const walkCW = ringS.slice().reverse();
  for (let i = 0; i < n; i++) {
    const A = walkCW[i], B = walkCW[(i + 1) % n];
    const t = 0.12, e = t / 2 * Math.tan(Math.PI / n);
    const W = wall(bags.siding, { A, B, y0: yDeck, t, topAt: () => ySill, holes: [], ext: [e, e], inner: false, endCap: [false, false], capBot: false, capTop: true, sub: Q.lod === 0 ? 0.6 : 0 });
    // the sill board on top
    if (W && Q.lod === 0) beam(bags.trim, [A[0], ySill + 0.03, A[1]], [B[0], ySill + 0.03, B[1]], 0.10, 0.03, [0, 1, 0], e);
  }
  // THE GLAZING (G414.1, the user: "give them the same windows as the other houses, with lights and
  // reflections ... better window finishing"): each face's panes are the HOUSE'S GLASS - the two-pass
  // reflective glass bag, its glow on the switch, its interior dressing (`setWin`: nothing hung, the lit
  // room behind) - with the cab's inside a hand behind them in the pane bag (a dark warm panel carrying
  // the glow, the shop window's answer), between the sill ring and the head ring, leaning out. The
  // finish is the house's casing: painted jambs at the corners and between the panes, a head board,
  // a sill board proud of the glass, all in the trim; the derelict keeps its bare rusty mullions.
  const ring0 = K.ringN(0, 0, r, n, rot, ySill + 0.06), ring1 = K.ringN(0, 0, rTop, n, rot, yHead);
  let panes = 0, mullions = 0;
  const glazed = !broken;
  const mid = n === 4 ? 2 : 1;                                   // panes per face
  const paneH = yHead - ySill - 0.06;
  for (let i = 0; i < n; i++) {
    const a0 = ring0[i], b0 = ring0[(i + 1) % n], a1 = ring1[i], b1 = ring1[(i + 1) % n];
    const c = K.lerp3(a0, b0, 0.5), outN = nrm([c[0], 0, c[2]]);
    const N = nrm(crs(sub(b0, a0), sub(a1, a0)));
    const Nf = dot(N, outN) < 0 ? mul(N, -1) : N;
    const faceL = len(sub(b0, a0)), paneW = faceL / mid - 0.06;
    const orient = q => (dot(nrm(crs(sub(q[1], q[0]), sub(q[3], q[0]))), Nf) > 0 ? q : q.slice().reverse());
    if (glazed) {
      for (let k = 0; k < mid; k++) {
        const q = [K.lerp3(a0, b0, k / mid), K.lerp3(a0, b0, (k + 1) / mid), K.lerp3(a1, b1, (k + 1) / mid), K.lerp3(a1, b1, k / mid)];
        const eu = nrm(sub(q[1], q[0])), vu = nrm(sub(q[3], q[0]));
        // the glass a hair inside the frame's face
        const qg = q.map(p => add(p, mul(Nf, -0.012)));
        bags.glass.setGlow(litOn); bags.glass.setWin(paneW, paneH, 0);
        face(bags.glass, orient(qg), Nf, uvFrame(qg[0], eu, vu));
        bags.glass.setWin(0); bags.glass.setGlow(0);
        // the inside, 45 cm behind the glass: the cab's dark room, lit with it
        const qb = q.map(p => add(p, mul(Nf, -0.45)));
        bags.pane.setGlow(litOn);
        face(bags.pane, orient(qb), Nf, uvFrame(qb[0], eu, vu));
        bags.pane.setGlow(0);
        panes++;
      }
    }
    if (glazed && Q.lod === 0) {
      // THE CASING, the house's: jambs (one at this face's first corner, one between every two
      // panes), the head board, the sill board proud - trim stock in the trim's paint, chamfered
      const tW = 0.09, tT = 0.022, o = mul(Nf, 0.024);
      const bev = { bevel: 0.006 };
      for (let k = 0; k < mid; k++) {
        const j0 = add(K.lerp3(a0, b0, k / mid), o), j1 = add(K.lerp3(a1, b1, k / mid), o);
        beam(bags.trim, [j0[0], j0[1] - 0.02, j0[2]], [j1[0], j1[1] + 0.03, j1[2]], tW / 2, tT, Nf, 0, bev); mullions++;
      }
      beam(bags.trim, add(add(a1, o), [0, 0.03, 0]), add(add(b1, o), [0, 0.03, 0]), tW / 2, tT, Nf, tW / 2, bev);                    // the head
      const so = mul(Nf, 0.045);
      beam(bags.trim, add(a0, so), add(b0, so), 0.05, 0.03, Nf, tW / 2, bev);                                                        // the sill, proud
    } else {
      // the bare frame: a corner mullion and the mid mullions in steel, a hair outside the glass line
      const keep = !broken || rnd() > 0.45 * der;
      if (keep) { beam(bags.steel, add(a0, mul(Nf, 0.03)), add(a1, mul(Nf, 0.03)), 0.04, 0.05, Nf, 0.02); mullions++; }
      if (Q.lod === 0) for (let k = 1; k < mid; k++) {
        if (broken && rnd() < 0.5 * der) continue;
        beam(bags.steel, add(K.lerp3(a0, b0, k / mid), mul(Nf, 0.03)), add(K.lerp3(a1, b1, k / mid), mul(Nf, 0.03)), 0.025, 0.04, Nf, 0); mullions++;
      }
      beam(bags.steel, add(a1, mul(Nf, 0.03)), add(b1, mul(Nf, 0.03)), 0.05, 0.06, Nf, 0.03);
      if (Q.lod === 0) beam(bags.steel, add(a0, mul(Nf, 0.03)), add(b0, mul(Nf, 0.03)), 0.04, 0.05, Nf, 0.03);
    }
  }
  LIT.panes = panes; LIT.windows = litOn ? panes : 0;
  // the roof: the eave ring out past the head, a soffit under it
  const roofKind = Math.round(P.roofKind);
  const eaveR = rTop + P.roofOver / Math.cos(Math.PI / n);
  const yE = yHead + 0.06;
  let roofTop = yE, roofRing = K.ringN(0, 0, eaveR, n, rot, yE);
  let roofHalf = false;
  if (broken && rnd() < 0.85) {
    // THE ROOF HALF GONE: the half that stays is the back one, sagging toward the front edge
    roofHalf = true;
    // the back half of the eave polygon, cut on the cab's middle line (z = 0): the corners behind
    // it and the two points where the eave crosses it, in order - a convex plate whatever n is
    const half = [];
    for (let k = 0; k < n; k++) {
      const a = roofRing[k], b = roofRing[(k + 1) % n];
      if (a[2] <= 0) half.push(a);
      if ((a[2] <= 0) !== (b[2] <= 0)) { const t = a[2] / (a[2] - b[2]); half.push(K.lerp3(a, b, t)); }
    }
    const sag = half.map(p => [p[0], p[1] - (Math.abs(p[2]) < 0.05 ? 0.55 : 0.0), p[2]]);   // the torn edge hangs
    // EVERY PART KEEPS ITS THICKNESS (G414.2, the user: "you need to keep thickness for all parts, in
    // particular the collapsed roof"): the half that stays is a 10 cm plate, and the sheet that came
    // down is a plate too, dropped along its own normal - never a bare quad
    plate(bags.roof, sag, 0.10, [0, -1, 0], p => [p[0], p[2]]);
    // a sheet that came down: leaning on the sill wall from the deck, on the front
    const sx = -rFlat * 0.3, sw = 1.1, sd = rFlat + 0.02;
    const sheet = [[sx, yDeck + 0.02, sd + 1.4], [sx + sw, yDeck + 0.02, sd + 1.4], [sx + sw, ySill + 0.3, sd], [sx, ySill + 0.3, sd]];
    const sN = nrm(crs(sub(sheet[1], sheet[0]), sub(sheet[3], sheet[0])));
    plate(bags.roof, sheet, 0.06, sN[1] > 0 ? mul(sN, -1) : sN, p => [p[0], p[1] + p[2]]);
    roofTop = yE + 0.10;
  } else if (roofKind === 0) {
    plate(bags.roof, roofRing, 0.10, [0, -1, 0], p => [p[0], p[2]], { sub: Q.lod === 0 ? 0.6 : 0 });
    if (Q.lod === 0) K.prismRings(bags.trim, K.ringN(0, 0, eaveR + 0.02, n, rot, yE - 0.12), K.ringN(0, 0, eaveR + 0.02, n, rot, yE + 0.16), false, false);
    roofTop = yE + 0.10;
  } else {
    const apexH = roofKind === 1 ? Math.max(0.55, rTopFlat * 0.55) : Math.max(0.25, rTopFlat * 0.22);
    const apex = [0, yE + apexH, 0];
    K.apexTo(bags.roof, roofRing, apex);
    plate(bags.trim, roofRing, 0.06, [0, -1, 0], p => [p[0], p[2]]);   // the soffit and the fascia
    roofTop = apex[1];
  }
  // ==== THE TOP ====
  let beaconLight = null, mastTop = roofTop;
  if (P.mast) {
    const mh = P.mastH, mx = roofHalf ? -eaveR * 0.35 : 0, mz = roofHalf ? -eaveR * 0.35 : 0;
    cyl(bags.steel, [mx, roofTop - 0.05, mz], [0, 1, 0], 0.05, mh, Q.lod === 0 ? 8 : 5, true);
    mastTop = roofTop + mh;
    if (Q.lod === 0) for (const s of [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) beam(bags.steel, [mx + s[0] * 1.5, roofTop, mz + s[1] * 1.5], [mx, roofTop + mh * 0.35, mz], 0.012, 0.012, [0, 1, 0], 0);   // the stays
    if (P.beacon && !broken) {
      const yb = mastTop - 0.55, rb = 0.16;
      K.prismRings(bags.steel, K.ringN(mx, mz, rb * 1.1, 8, 0, yb - 0.08), K.ringN(mx, mz, rb * 1.1, 8, 0, yb), false, true);
      bags.glass.setGlow(P.lights ? 1 : 0);
      K.prismRings(bags.glass, K.ringN(mx, mz, rb, 8, 0, yb), K.ringN(mx, mz, rb, 8, 0, yb + 0.36), false, false);
      bags.glass.setGlow(0);
      K.apexTo(bags.steel, K.ringN(mx, mz, rb * 1.1, 8, 0, yb + 0.36), [mx, yb + 0.5, mz]);
      if (P.lights) { beaconLight = { kind: 'beacon', x: mx, y: yb + 0.18, z: mz, nx: 0, nz: 0, col: [1.0, 1.0, 0.92], k: 3.0, range: 80.0, beacon: 1, alt: [0.2, 0.9, 0.2] }; LIT.lights.push(beaconLight); }
    }
  }
  if (Q.lod === 0) for (let k = 0; k < Math.round(P.whips); k++) {
    const a = rot + 2 * Math.PI * (k + 0.5) / Math.max(1, Math.round(P.whips)) + 0.4;
    const px = Math.cos(a) * eaveR * 0.55, pz = Math.sin(a) * eaveR * 0.55;
    const yb = roofHalf && pz > 0 ? yHead : roofTop;
    beam(bags.steel, [px, yb - 0.1, pz], [px, yb + 1.6 + k * 0.5, pz], 0.012, 0.012, [1, 0, 0], 0);
  }
  let sock = null;
  if (P.windsock) {
    // the windsock on the gallery's corner (or the roof's), its pole, the hoop and the sock blowing to -x
    const p = hut ? [hut.half + 0.15, yDeck, -hut.half - 0.1] : [deckRFlat * 0.85, yDeck, -deckRFlat * 0.85];
    const top = p[1] + 2.6;
    cyl(bags.steel, [p[0], p[1] - 0.02, p[2]], [0, 1, 0], 0.03, 2.6, 6, true);
    const ax = [-1, 0, 0], r0 = 0.24, r1 = 0.10, L = 1.6;
    const ringA = (rr, s) => { const out = []; for (let i = 0; i < 8; i++) { const a = 2 * Math.PI * i / 8; out.push([p[0] + ax[0] * s, top + Math.cos(a) * rr - 0.03 * s, p[2] + Math.sin(a) * rr]); } return out; };
    K.prismRings(bags.steel, ringA(r0 * 1.06, 0.02), ringA(r0 * 1.06, 0.06), false, false);
    for (let k = 0; k < 4; k++) K.prismRings(bags.sock, ringA(r0 + (r1 - r0) * k / 4, 0.06 + L * k / 4), ringA(r0 + (r1 - r0) * (k + 1) / 4, 0.06 + L * (k + 1) / 4), false, false);
    sock = { x: p[0], y: top, z: p[2] };
  }
  if (P.flag) {
    const p = hut ? [-hut.half - 0.15, yDeck, hut.half + 0.1] : [-deckRFlat * 0.8, yDeck, deckRFlat * 0.8];
    cyl(bags.steel, [p[0], p[1] - 0.02, p[2]], [0, 1, 0], 0.03, 3.2, 6, true);
    K.prismRings(bags.metal, K.ringN(p[0], p[2], 0.05, 6, 0, p[1] + 3.2), K.ringN(p[0], p[2], 0.05, 6, 0, p[1] + 3.28), false, true);
  }

  // ==== THE WAY UP ====
  let stair = null;
  const zFront = (base < 2 ? bw / 2 : bw / 2) + 0.15;
  if (stairs === 1) {
    // the ladder, just outside the gallery's front edge, from the ground to a handhold over the deck
    const zf = Math.max(edgeZ + 0.08, bw / 2 + 0.45), zt = edgeZ + 0.06, x = 0.6;
    const rungs = ladder(bags.steel, [x, g(x, zf) - 0.1, zf], [x, yDeck + 1.0, zt], 0.45, { rnd, miss: broken ? 0.25 * der : 0, face: [0, 0, 1] });
    stair = { kind: 'ladder', top: yDeck + 1.0, rungs };
  } else if (stairs === 2) {
    // one straight flight up the front to the gallery's edge (a tall tower gets two, with a landing)
    const w = 0.9, top = [0, yDeck, edgeZ - 0.35];
    const runTot = H / Math.tan(36 * D2R);
    const timber = base === 1 || base === 3;
    if (H <= 5.2) {
      const foot = [0, g(0, top[2] + runTot), top[2] + runTot];
      flight(bags, foot, top, w, { rail: 2, timber });
      // a pair of posts under the middle
      const m = K.lerp3(foot, top, 0.5);
      for (const s of [-1, 1]) beam(timber ? bags.post : bags.steel, [m[0] + s * (w / 2 + 0.03), g(m[0], m[2]) - 0.2, m[2]], [m[0] + s * (w / 2 + 0.03), m[1] + 0.05, m[2]], 0.05, 0.05, [0, 0, 1], 0);
      stair = { kind: 'straight', top: top[1], foot };
    } else {
      const yL = H / 2, run1 = yL / Math.tan(36 * D2R);
      const land = [0, yL, top[2] + run1 + 0.5];
      const cr = landing(bags, land, 1.0, w + 0.1, [0, 0, 1], [1, 0, 0], g, { timber });
      const foot = [0, g(0, land[2] + 0.5 + run1), land[2] + 0.5 + run1];
      flight(bags, foot, [0, yL, land[2] + 0.5], w, { rail: 2, timber });
      flight(bags, [0, yL, land[2] - 0.5], top, w, { rail: 2, timber });
      stair = { kind: 'straight', top: top[1], foot, landings: 1 };
    }
  } else if (stairs === 3) {
    // THE SWITCHBACK up the front face: flights along x, alternating, each on the batter's line
    // outside the legs at its own height, landings at the turns on their own posts, the last
    // flight arriving on the gallery
    const w = 0.85, timber = base === 1;
    const nF = Math.max(1, Math.ceil(H / P.panelH)), rise = H / nF, run = rise / Math.tan(36 * D2R);
    let dir = 1, foot = null, top = null;
    const zAt = y => wAt(y) / 2 + 0.55;
    for (let k = 0; k < nF; k++) {
      const y0 = k * rise, y1 = (k + 1) * rise;
      const x0 = -dir * run / 2, x1 = dir * run / 2;
      const z1 = k === nF - 1 ? edgeZ - 0.35 : zAt(y1), z0 = k === 0 ? zAt(0) : zAt(y0);
      foot = k === 0 ? [x0, g(x0, z0), z0] : [x0, y0, z0];
      top = [x1, y1, z1];
      flight(bags, foot, top, w, { rail: 2, timber });
      if (k < nF - 1) landing(bags, [x1 + dir * 0.55, y1, z1], 1.1, w + 0.2, [dir, 0, 0], [0, 0, 1], g, { timber });
      dir = -dir;
    }
    stair = { kind: 'switchback', top: top[1], flights: nF };
  }

  // ==== THE RAIL round the gallery, with the gap where the stair arrives ====
  if (P.gallery || hut) {
    // the polyline's s of the point nearest the stair's top
    let total = 0; const segS = [];
    for (let i = 0; i < deckEdge.length; i++) { segS.push(total); total += len(sub(deckEdge[(i + 1) % deckEdge.length], deckEdge[i])); }
    const gaps = [];
    if (stair && (stair.kind === 'straight' || stair.kind === 'switchback')) {
      const T = stair.top; let best = null;
      for (let i = 0; i < deckEdge.length; i++) {
        const a = deckEdge[i], b = deckEdge[(i + 1) % deckEdge.length], d = sub(b, a), L = len(d);
        const t = clamp(dot(sub([T[0], a[1], T[2]], a), d) / (L * L), 0, 1), q = add(a, mul(d, t));
        const dd = Math.hypot(q[0] - T[0], q[2] - T[2]);
        if (!best || dd < best.dd) best = { dd, s: segS[i] + t * L };
      }
      gaps.push([best.s - 0.6, best.s + 0.6]);
    }
    if (broken) { const gs = 1 + Math.floor(rnd() * 3); for (let k = 0; k < gs; k++) { const a = rnd() * total; gaps.push([a, a + 0.8 + rnd() * 2.0]); } }
    railPosts = railAlong(bags.metal, deckEdge, { h: 1.05, sp: 1.1, closed: true, gaps, rnd, lean: broken ? 0.35 * der : 0 });
  }

  // ==== THE YARD: the fire truck where the field keeps one ====
  const yard = [];
  const truck = Math.round(P.truck);
  const park = (key, x, z, ry) => { const KK = HG.YARD_KIT[key]; if (!KK) return; yard.push({ key, x, z, y: g(x, z), ry, on: 'ground', r: Math.hypot(KK.L, KK.W) / 2 }); occ.push({ x, z, hx: KK.W / 2 + 0.2, hz: KK.L / 2 + 0.2, ry, k: 0.55, soft: 0.8 }); };
  const side = bw / 2 + 1.2;
  if (truck === 1 || truck === 3) park('truck_fire_small', -(side + 2.3), 1.2, 0.18);
  if (truck === 2 || truck === 3) park('truck_fire', side + 2.9, 0.5, -0.12);

  // ==== THE LIGHT UNDER THE CAB: a flood on the deck's front edge, down to the apron ====
  if (P.lights && Q.lod === 0 && !broken && HG.floodAt) HG.floodAt(bags, Q, [deckRFlat * 0.4, yDeck - deckT - 0.05, deckRFlat * 0.55], [0, 0, 1], { k: 1.6, range: 30, down: true });

  // ==== THE GROUND SKIRT AND THE BAKE ====
  for (const o of occ) o.dry = true;
  if (P.aoGround) HG.buildGroundAO(bags.aoskirt, occ, g);
  const aoInfo = K.bakeAO(BAGS.map(k => bags[k]), { strength: P.ao === undefined ? 0.85 : P.ao, range: P.aoRange || 0.6, ground: g });
  let tris = 0, verts = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of BAGS) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) { const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2]; if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z; }
  }
  const stats = {
    tris, verts, per, bbox: bb, footprint: bw * bw, eaveY: yHead, ridgeY: mastTop, floorY: 0,
    role: 'tower', base: BASES[base], H, cab: { sides: n, w: P.cabW, floorY: yDeck, sillY: ySill, headY: yHead, glazed, panes, mullions, tilt: P.tilt },
    deck: { r: deckRFlat, y: yDeck, railPosts }, roof: { kind: roofHalf ? 'half' : ROOFS[roofKind], top: roofTop }, mast: P.mast ? { top: mastTop, beacon: !!beaconLight } : null,
    stair, members, gone, derelict: der, windsock: sock, yard, trucks: yard.map(q => q.key),
    front: { x: 0, z: (stair && stair.foot ? stair.foot[2] : zFront) + 1.2, side: 1, depth: 0 },
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, pier: null, lit: LIT, smoke: null, sign: null,
  };
  return { bags, stats, P, V: { L: bw, w: bw, wallT: 0.12, floorY: 0 }, R: null, MAT: F ? F.MAT : MAT };
}
function applyFinish(P, F) {
  const M = F ? F.MAT : MAT;
  const SU = F ? F.SHADE_U : DEFAULT_FINISH.SHADE_U;
  const HF = F ? F.HF : DEFAULT_FINISH.HF;
  if (HF) HG.applyFinish(houseP(P), HF);
  const HOUSE_OWNED = { trim: 1, pane: 1, glass: 1, smoke: 1, aoskirt: 1 };
  for (const k of BAGS) if (!HOUSE_OWNED[k] && !(M[k].userData && M[k].userData.flat)) HG.shadeHouse(M[k], SU);
  const der = clamp(P.derelict || 0, 0, 1);
  for (const k of ['siding', 'roof', 'deck', 'post']) HG.cloudWeather(M[k], Math.min(1, (P.clouds === undefined ? 0.5 : P.clouds) + 0.4 * der), k === 'roof' ? 1 : 0);   // never the concrete (the house's rule: a shaft clouded over reads as mud)
  dress(M.siding, 'siding', P.wallSet, { tint: HG.COLS[clamp(Math.round(P.wallCol || 0), 0, HG.COLS.length - 1)][1] });
  dress(M.roof, 'roof', P.roofSet);
  dress(M.steel, 'steel', der > 0.3 ? SET_IDX('steel', 'steelrust') : P.steelSet);
  dress(M.post, 'post', P.postSet);
  dress(M.deck, 'deck', P.deckSet);
  dress(M.stone, 'stone', P.stoneSet);
  dress(M.metal, 'metal', der > 0.3 ? SET_IDX('metal', 'rust') : P.metalSet);
  const g = HG.groundFn(P);
  SU.uDirtTop.value = g(0, 0) + (P.dirtH || 1) * 0.6; SU.uDirtH.value = Math.max(0.05, P.dirtH || 1);
  SU.uDirtK.value = P.dirt === undefined ? 0.45 : P.dirt; SU.uNoiseK.value = P.noise === undefined ? 0.16 : P.noise;
  SU.uAOd.value = P.aoDirect === undefined ? 0.35 : P.aoDirect; SU.uSag.value = 0;
  for (const k of BAGS) {
    if (HOUSE_OWNED[k]) continue;
    const ud = M[k].userData && M[k].userData.dirt; if (!ud) continue;
    ud.uDirtGain.value = (k === 'stone' ? 1.3 : 1.0) * (1 + der); ud.uAgeDesat.value = k === 'post' || k === 'deck' ? 0.6 : 0.3 * der; ud.uAgeDark.value = k === 'post' ? 0.35 : 0.2 * der;
    ud.uDirtOwn.value.setHex(k === 'stone' ? 0x453f36 : 0x5e5346); ud.uWander.value = 0;
  }
}
function finishReport() {
  return BAGS.map(k => { const m = MAT[k], flat = !!(m.userData && m.userData.flat) || k === 'glass' || k === 'pane'; return { slot: k, map: !!m.map, nor: !!m.normalMap, rough: !!m.roughnessMap, full: flat || (!!m.map && !!m.normalMap && !!m.roughnessMap), glassy: flat }; });
}
function randomTower(seed) {
  const r = rng(seed); const names = Object.keys(PRESETS);
  const P = Object.assign({}, DEF, PRESETS[names[Math.floor(r() * names.length)]]);
  P.H = +(P.H * (0.85 + r() * 0.3)).toFixed(1); P.cabW = +(P.cabW * (0.9 + r() * 0.2)).toFixed(1);
  P.wallCol = Math.floor(r() * HG.COLS.length); P.lights = r() < 0.3 ? 1 : 0; P.seed = seed | 0;
  return P;
}

window.TOWER_GEN = { DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, BASES, ROOFS, STAIRS, TRUCKS, SET_IDX, CATS, catOf, build, applyFinish, makeFinish, finishReport, randomTower };
// THE CATALOGUE: a building; its way in is the stair's foot on the +z side
window.TOWER_GEN.CATALOGUE_V = 1;
window.TOWER_GEN.CATALOGUE_ALIASES = {};
window.TOWER_GEN.CATALOGUE = Object.keys(PRESETS).map(name => {
  const Pd = Object.assign({}, DEF, PRESETS[name]);
  const ext = P => { const p = P || Pd; const t = Math.round(p.truck || 0); const bw = p.baseW || Pd.baseW; return { hx: bw / 2 + (t ? 6 : 1) + 1, hz: bw / 2 + (p.stairs >= 2 ? p.H / Math.tan(36 * D2R) * 0.6 : 1) + 1 }; };
  return { key: 'tower/' + name, kind: 'building', gen: 'TOWER_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
    foot: P => { const e = ext(P); return [[-e.hx, -e.hz], [e.hx, -e.hz], [e.hx, e.hz], [-e.hx, e.hz]]; }, keepOut: 3,
    ground: { need: 'level', level: 'high', falloff: 6, standing: 'slab' },
    size: P => { const e = ext(P); return { L: 2 * e.hx, w: 2 * e.hz }; },
    hooks: P => [{ name: 'door', kind: 'path', p: [0, 0, ext(P).hz + 1], dir: [0, 0, 1] }], hooksOf: () => [],
    lod: { dist: [0, 200, 600, 1500] }, slots: { lights: 'stats.lit.lights', ao: 'stats.groundAO' },
    tags: ['airport', 'tower', BASES[Math.round(Pd.base)]], role: 'tower', cat: catOf(name), headless: true, gate: 'HOUSE' };
});
})();
