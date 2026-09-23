// THE MARINE KIT (METLAKATLA, 2026-09-22) - the fifth generator beside the
// house, the shed, the big buildings and the sports grounds: everything a real
// harbour is made of and nothing in the repo could draw.
//
// WHAT WAS MISSING, and why none of it could be faked. The wooden `pier_*` props
// are a fixed, piled, 2.5 m kit that only ever appears as a slot on a house that
// sits in the tide (`pierPlan` in _house_gen.js), and `placeSite` explicitly turns
// that off for every hand-placed item (27_premises.js ~:803). So there was no way
// to stand a pier, a float, a mole or a wharf anywhere - and Metlakatla is a boat
// harbour behind a rubble breakwater, a seaplane float at the end of a trestle, a
// cannery on a pile deck, and a fish farm of net pens.
//
//   marine/trestle pier   a piled walkway out over the water, with a T or an L head
//   marine/float dock     a REAL float: pontoons at water level, finger floats at a
//                         slip pitch, a hinged gangway down to them, pile guides
//   marine/breakwater     a rubble mound: trapezoidal section, armour stone on it
//   marine/wharf deck     a planked platform on timber bents - the thing BIG_GEN
//                         cannot do (it has no stance and no water at all), so the
//                         cannery's warehouses can stand over the tide
//   marine/net pens       the fish farm: a grid of floating collars with nets under
//                         them, walkways, a feed shed on one float, mooring buoys
//
// THE FRAME is the house's, so a site item places the same way: the origin at the
// footprint's centre, x along the LENGTH (a pier runs +x out to sea), z across,
// +z the SHORE side, y up. The water is at `P.waterY` in that frame (the composer
// hands it over, 27_premises.js placeItem) and `P.ground(lx, lz)` is the seabed -
// which is why every pile is carried to where the bottom actually is instead of a
// fixed depth. Nothing here needs the ground cut: `ground.need` is 'none'.
//
// It builds HEADLESS: THREE is optional, the bags are plain arrays, and GATE
// PREMISES rule 3 builds every entry with no renderer at all.
'use strict';
(() => {
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, off, Bag, face, uvFrame, boxAB, beam, plate, cyl } = K;

// ---- the bags -----------------------------------------------------------
// deck: the planking and the float tops; pile: creosoted timber in the water;
// beam: the bents, the stringers, the collars; steel: gangway, rails, cleats,
// guides, the beacon's mast; body: a pontoon's sides (grey plastic or concrete);
// rock: the armour stone; net: the pens' netting, drawn as one translucent
// sheet; buoy: the mooring floats; glass: a lamp's lens.
const BAGS = ['deck', 'pile', 'beam', 'steel', 'body', 'rock', 'net', 'buoy', 'glass'];
const EXTRA = [];
const T = (typeof THREE !== 'undefined') ? THREE : null;
const std = (col, o) => T ? new T.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.92, metalness: 0.0 }, o || {})) : { color: col };

function makeMats() {
  return {
    deck: std(0x8b7f6b, { roughness: 0.94 }),
    pile: std(0x4a4038, { roughness: 0.96 }),
    beam: std(0x6b5f4e, { roughness: 0.95 }),
    steel: std(0xb9bfc4, { roughness: 0.5, metalness: 0.55 }),
    body: std(0x9aa2a6, { roughness: 0.75, metalness: 0.05 }),
    rock: std(0x7c7a76, { roughness: 1.0 }),
    net: std(0x2f3a33, { roughness: 0.95, transparent: true, opacity: 0.30, side: T ? T.DoubleSide : 2, depthWrite: false }),
    buoy: std(0xe2583a, { roughness: 0.7 }),
    glass: std(0xfff2cc, { roughness: 0.3, emissive: T ? 0xffcc66 : undefined, emissiveIntensity: T ? 0.6 : undefined }),
  };
}
const makeFinish = () => ({ MAT: makeMats(), SHADE_U: T && HG && HG.makeShadeU ? HG.makeShadeU() : null });
const DEFAULT_FINISH = makeFinish();
const MAT = DEFAULT_FINISH.MAT;

const KINDS = ['trestle pier', 'float dock', 'breakwater', 'wharf deck', 'net pens'];

const DEF = {
  kind: 0,
  // where the water is, and how far it moves. waterY is OVERWRITTEN by the
  // composer with the world's own (27_premises.js placeItem); the default is the
  // bench's, so the bench shows the same thing.
  waterY: -1.4, tide: 3.2,
  // the trestle and the wharf
  L: 60, w: 3.2, deck: 2.6, bay: 4.5, pileR: 0.17, pilesPerBent: 2, batter: 0.07,
  head: 1, headL: 12, headW: 6, rail: 1, railH: 1.05, lamps: 1, lampSpc: 18, ladder: 1,
  fenders: 1, bollards: 1,
  // the float dock
  floatL: 34, floatW: 2.6, freeboard: 0.42, fingers: 4, fingerL: 9, fingerW: 1.25, pitch: 7.5,
  gangway: 1, gangL: 12, gangW: 1.2, guides: 1, cleats: 1, bumper: 1, boats: 0,
  // the breakwater
  crest: 6.0, crestH: 3.6, slope: 1.6, stones: 1, stoneR: 0.95, beacon: 0,
  // the net pens
  rows: 2, cols: 4, pen: 12, collar: 0.85, netD: 9, feedShed: 1, buoys: 1,
  // the common ones
  floorY: 0, slopeX: 0, slopeZ: 0, seed: 1, weather: 0.6, aoGround: 0,
};

const ROWS = [
  ['the water', [
    ['kind', 'kind', 0, 4, 1, KINDS],
    ['waterY', 'water level', -6, 3, 0.05],
    ['tide', 'tide range', 0, 8, 0.1],
  ]],
  ['the deck', [
    ['L', 'length', 6, 200, 0.5, null, P => P.kind !== 1 && P.kind !== 4],
    ['w', 'width', 1.2, 30, 0.1, null, P => P.kind !== 1 && P.kind !== 4],
    ['deck', 'deck over the water', 0.6, 8, 0.05, null, P => P.kind === 0 || P.kind === 3],
    ['bay', 'bent spacing', 2, 12, 0.25, null, P => P.kind === 0 || P.kind === 3],
    ['pileR', 'pile radius', 0.08, 0.6, 0.01, null, P => P.kind === 0 || P.kind === 3],
    ['pilesPerBent', 'piles a bent', 2, 8, 1, null, P => P.kind === 0 || P.kind === 3],
    ['batter', 'pile batter', 0, 0.3, 0.01, null, P => P.kind === 0 || P.kind === 3],
    ['head', 'head', 0, 2, 1, ['none', 'T', 'L'], P => P.kind === 0],
    ['headL', 'head length', 3, 40, 0.5, null, P => P.kind === 0 && P.head > 0],
    ['headW', 'head width', 2, 30, 0.5, null, P => P.kind === 0 && P.head > 0],
    ['rail', 'handrail', 0, 1, 1, null, P => P.kind !== 2],
    ['railH', 'rail height', 0.6, 1.4, 0.05, null, P => P.rail],
    ['lamps', 'lamps', 0, 1, 1, null, P => P.kind !== 2],
    ['lampSpc', 'lamp spacing', 6, 60, 1, null, P => P.lamps],
    ['ladder', 'ladder down', 0, 1, 1, null, P => P.kind === 0 || P.kind === 3],
    ['fenders', 'fender piles', 0, 1, 1, null, P => P.kind === 3],
    ['bollards', 'bollards', 0, 1, 1, null, P => P.kind === 3],
  ]],
  ['the float', [
    ['floatL', 'main float', 6, 120, 0.5, null, P => P.kind === 1],
    ['floatW', 'float width', 1.2, 6, 0.1, null, P => P.kind === 1],
    ['freeboard', 'freeboard', 0.2, 1.0, 0.02, null, P => P.kind === 1],
    ['fingers', 'finger floats', 0, 16, 1, null, P => P.kind === 1],
    ['fingerL', 'finger length', 3, 24, 0.5, null, P => P.kind === 1],
    ['fingerW', 'finger width', 0.8, 3, 0.05, null, P => P.kind === 1],
    ['pitch', 'slip pitch', 3, 20, 0.25, null, P => P.kind === 1],
    ['gangway', 'gangway', 0, 1, 1, null, P => P.kind === 1],
    ['gangL', 'gangway length', 4, 40, 0.5, null, P => P.kind === 1 && P.gangway],
    ['gangW', 'gangway width', 0.8, 3, 0.05, null, P => P.kind === 1 && P.gangway],
    ['guides', 'pile guides', 0, 1, 1, null, P => P.kind === 1],
    ['cleats', 'cleats', 0, 1, 1, null, P => P.kind === 1],
    ['bumper', 'bumper rail', 0, 1, 1, null, P => P.kind === 1],
  ]],
  ['the mound', [
    ['crest', 'crest width', 2, 20, 0.5, null, P => P.kind === 2],
    ['crestH', 'crest over the water', 0.5, 10, 0.1, null, P => P.kind === 2],
    ['slope', 'side slope (h:1)', 1, 4, 0.1, null, P => P.kind === 2],
    ['stones', 'armour stone', 0, 1, 1, null, P => P.kind === 2],
    ['stoneR', 'stone size', 0.3, 3, 0.05, null, P => P.kind === 2 && P.stones],
    ['beacon', 'head beacon', 0, 1, 1, null, P => P.kind === 2],
  ]],
  ['the pens', [
    ['rows', 'rows', 1, 6, 1, null, P => P.kind === 4],
    ['cols', 'columns', 1, 10, 1, null, P => P.kind === 4],
    ['pen', 'pen side', 5, 30, 0.5, null, P => P.kind === 4],
    ['collar', 'collar width', 0.4, 2.5, 0.05, null, P => P.kind === 4],
    ['netD', 'net depth', 2, 25, 0.5, null, P => P.kind === 4],
    ['feedShed', 'feed shed', 0, 1, 1, null, P => P.kind === 4],
    ['buoys', 'mooring buoys', 0, 1, 1, null, P => P.kind === 4],
  ]],
  ['the finish', [
    ['seed', 'seed', 0, 9999, 1],
    ['weather', 'weathering', 0, 1, 0.05],
  ]],
];

const PRESETS = {
  // the two long piles off Metlakatla's north point, and the seaplane float's walk out
  'trestle pier': { kind: 0, L: 70, w: 3.2, deck: 2.8, head: 1, headL: 12, headW: 6 },
  'trestle pier, long': { kind: 0, L: 130, w: 3.6, deck: 3.0, bay: 5.0, head: 1, headL: 16, headW: 8, lampSpc: 22 },
  'landing float': { kind: 1, floatL: 20, floatW: 2.6, fingers: 0, gangL: 14 },
  'seaplane float': { kind: 1, floatL: 26, floatW: 3.2, fingers: 2, fingerL: 12, fingerW: 1.6, pitch: 16, gangL: 14, cleats: 1 },
  'boat harbour floats': { kind: 1, floatL: 60, floatW: 2.6, fingers: 8, fingerL: 10, fingerW: 1.25, pitch: 7.5, gangL: 16 },
  'breakwater': { kind: 2, L: 120, crest: 6, crestH: 3.8, slope: 1.6 },
  'breakwater, light': { kind: 2, L: 70, crest: 4.5, crestH: 3.2, slope: 1.5, beacon: 1 },
  'wharf deck': { kind: 3, L: 46, w: 22, deck: 3.2, bay: 4.5, pilesPerBent: 6, rail: 0, fenders: 1, bollards: 1 },
  'wharf deck, small': { kind: 3, L: 24, w: 12, deck: 2.8, bay: 4.0, pilesPerBent: 4, rail: 0 },
  'net pens': { kind: 4, rows: 2, cols: 4, pen: 12, netD: 9 },
  'net pens, large': { kind: 4, rows: 3, cols: 5, pen: 14, netD: 12 },
};

const CATS = {
  'trestle pier': 'industrial', 'trestle pier, long': 'industrial',
  'landing float': 'industrial', 'seaplane float': 'airport s', 'boat harbour floats': 'industrial',
  'breakwater': 'landmark', 'breakwater, light': 'landmark',
  'wharf deck': 'industrial', 'wharf deck, small': 'industrial',
  'net pens': 'industrial', 'net pens, large': 'industrial',
};

// ---- the plan (headless, no geometry) -----------------------------------
function plan(P0) {
  const P = Object.assign({}, DEF, P0 || {});
  const kind = Math.round(P.kind);
  let L, w;
  if (kind === 1) {                                   // the float: the main plus its fingers
    L = Math.max(P.floatL, (Math.max(0, Math.round(P.fingers)) - 1) * P.pitch + P.fingerW) + (P.gangway ? P.gangL : 0);
    w = P.floatW + (P.fingers > 0 ? 2 * P.fingerL : 0);
  } else if (kind === 4) {                            // the pens
    L = Math.round(P.cols) * P.pen + P.collar;
    w = Math.round(P.rows) * P.pen + P.collar;
  } else if (kind === 2) {
    // A MOUND'S FOOT IS ITS TOES, not its crest: in 6 m of water a 6 m crest on a
    // 1.6:1 slope is 38 m across the bottom, and a foot that claimed 6 would let a
    // plot, a tree or another item stand inside the rubble.
    L = P.L;
    w = P.crest + 2 * P.slope * (P.crestH + 5.0);
  } else if (kind === 0 && Math.round(P.head) > 0) {
    L = P.L + (Math.round(P.head) === 1 ? 0 : P.headL);
    w = Math.max(P.w, P.headW);
  } else {
    L = P.L; w = P.w;
  }
  const foot = [[-L / 2, -w / 2], [L / 2, -w / 2], [L / 2, w / 2], [-L / 2, w / 2]];
  return { kind, L, w, foot, name: KINDS[kind] };
}

// a little deterministic stream, the village's
function rng(seed) {
  let st = ((seed | 0) * 2654435761 + 7) >>> 0;
  return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- the pieces ---------------------------------------------------------
// THE PILE IS CARRIED TO THE BOTTOM. `g(lx, lz)` is the seabed in the item's own
// frame; a pile that stopped at a fixed depth floated over the deeper end of every
// pier (the same bug buildPierPiles fixed for the wooden kit). A bent leans its
// outer piles out by the batter, as a real one does.
function bent(bags, x, topY, w, n, r, batter, g) {
  const N = Math.max(2, Math.round(n));
  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 0.5 : i / (N - 1);
    const z = (-w / 2 + 0.35) + t * (w - 0.7);
    // the outer piles lean out by the batter, as a real bent's do
    const lean = (t - 0.5) * 2 * batter;
    const bed = Math.min(g(x, z), topY - 0.5) - 0.6;
    cyl(bags.pile, [x, bed, z + lean * (topY - bed)], [lean * 0.999, 1, 0], r, (topY - bed), 9, true, {});
  }
  // the cap beam across the bent
  beam(bags.beam, [x, topY - 0.22, -w / 2 - 0.1], [x, topY - 0.22, w / 2 + 0.1], 0.14, 0.18, [0, 1, 0], 0, {});
}

function planking(bags, x0, x1, z0, z1, y, board) {
  const b = board || 0.16;
  const n = Math.max(1, Math.round((z1 - z0) / b));
  for (let i = 0; i < n; i++) {
    const a = z0 + (z1 - z0) * i / n, c = z0 + (z1 - z0) * (i + 1) / n - 0.012;
    boxAB(bags.deck, [x0, y - 0.06, a], [x1, y, c], {});
  }
}

function railRun(bags, a, b, y, h) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const L = Math.hypot(dx, dz);
  if (L < 0.3) return;
  const n = Math.max(1, Math.round(L / 2.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + dx * t, z = a[1] + dz * t;
    cyl(bags.steel, [x, y, z], [0, 1, 0], 0.035, h, 6, true, {});
  }
  for (const f of [1.0, 0.55]) beam(bags.steel, [a[0], y + h * f, a[1]], [b[0], y + h * f, b[1]], 0.03, 0.03, [0, 1, 0], 0, {});
}

function cleat(bags, x, y, z) {
  boxAB(bags.steel, [x - 0.06, y, z - 0.16], [x + 0.06, y + 0.07, z + 0.16], {});
  cyl(bags.steel, [x, y + 0.03, z - 0.13], [0, 1, 0], 0.045, 0.16, 6, true, {});
  cyl(bags.steel, [x, y + 0.03, z + 0.13], [0, 1, 0], 0.045, 0.16, 6, true, {});
  beam(bags.steel, [x, y + 0.17, z - 0.22], [x, y + 0.17, z + 0.22], 0.045, 0.04, [0, 1, 0], 0, {});
}

// THE LAMPS ARE A LIST, and it matters: render_premises.js placeBuilt iterates
// `stats.lit.lights`, and a NUMBER there threw - inside the builder's own try, so
// every marine item silently built nothing at all and the whole harbour was
// missing from the game while the record said 26 items placed.
function lampPost(bags, lights, x, y, z, h) {
  cyl(bags.steel, [x, y, z], [0, 1, 0], 0.055, h, 7, true, {});
  boxAB(bags.glass, [x - 0.12, y + h, z - 0.12], [x + 0.12, y + h + 0.18, z + 0.12], {}, null);
  lights.push({ x: x, y: y + h + 0.09, z: z, col: [1, 0.88, 0.66], k: 1, range: 22, kind: 'lamp' });
}

// ---- the builds ---------------------------------------------------------
function buildTrestle(bags, P, PL, g, wy, rnd, lights) {
  const y = wy + P.deck;
  const L = P.L, w = P.w, x0 = -PL.L / 2, x1 = x0 + L;
  planking(bags, x0, x1, -w / 2, w / 2, y);
  for (const s of [-1, 1]) beam(bags.beam, [x0, y - 0.16, s * (w / 2 - 0.25)], [x1, y - 0.16, s * (w / 2 - 0.25)], 0.1, 0.16, [0, 1, 0], 0, {});
  const nB = Math.max(2, Math.round(L / P.bay));
  for (let i = 0; i <= nB; i++) bent(bags, x0 + L * i / nB, y, w, P.pilesPerBent, P.pileR, P.batter, g);
  const head = Math.round(P.head);
  let hx0 = x1, hx1 = x1, hz0 = -w / 2, hz1 = w / 2;
  if (head > 0) {
    if (head === 1) { hz0 = -P.headW / 2; hz1 = P.headW / 2; hx0 = x1 - P.headL; hx1 = x1; }
    else { hz0 = -w / 2; hz1 = P.headW; hx0 = x1 - P.headL; hx1 = x1; }
    planking(bags, hx0, hx1, hz0, hz1, y);
    const nH = Math.max(2, Math.round((hz1 - hz0) / P.bay));
    for (let i = 0; i <= nH; i++) {
      const z = hz0 + (hz1 - hz0) * i / nH;
      for (const x of [hx0 + 0.4, hx1 - 0.4]) {
        const bed = Math.min(g(x, z), y - 0.5) - 0.6;
        cyl(bags.pile, [x, bed, z], [0, 1, 0], P.pileR, y - bed, 9, true, {});
      }
    }
  }
  if (P.rail) {
    railRun(bags, [x0, -w / 2 + 0.06], [hx0, -w / 2 + 0.06], y, P.railH);
    railRun(bags, [x0, w / 2 - 0.06], [hx0, w / 2 - 0.06], y, P.railH);
    if (head > 0) {
      railRun(bags, [hx0, hz0 + 0.06], [hx1, hz0 + 0.06], y, P.railH);
      railRun(bags, [hx1, hz0 + 0.06], [hx1, hz1 - 0.06], y, P.railH);
      railRun(bags, [hx1, hz1 - 0.06], [hx0, hz1 - 0.06], y, P.railH);
    }
  }
  if (P.lamps) for (let x = x0 + P.lampSpc; x < hx1; x += P.lampSpc) lampPost(bags, lights, x, y, w / 2 - 0.25, 3.0);
  if (P.ladder) {
    const lx = hx1 - 0.6;
    for (const s of [-0.22, 0.22]) cyl(bags.steel, [lx, wy - P.tide - 0.4, (head ? hz1 : w / 2) + 0.12 + s * 0], [0, 1, 0], 0.03, y - (wy - P.tide - 0.4), 6, true, {});
    for (let ry = wy - P.tide; ry < y; ry += 0.32) beam(bags.steel, [lx, ry, (head ? hz1 : w / 2) - 0.1], [lx, ry, (head ? hz1 : w / 2) + 0.28], 0.025, 0.02, [0, 1, 0], 0, {});
  }
  return { deckY: y, head: head ? { x0: hx0, x1: hx1, z0: hz0, z1: hz1 } : null, root: [x0, y, 0], tip: [hx1, y, 0] };
}

function buildFloat(bags, P, PL, g, wy, rnd, lights) {
  // A FLOAT IS NOT A PIER ON SHORT LEGS. Its deck sits `freeboard` over the water
  // whatever the tide does, its body is a box in the water, and what holds it in
  // place is a pile GUIDE, not a bent: the collar rides up and down the pile.
  const y = wy + P.freeboard;
  const fl = P.floatL, fw = P.floatW;
  const x0 = -fl / 2, x1 = fl / 2;
  boxAB(bags.body, [x0, wy - 0.45, -fw / 2], [x1, y - 0.07, fw / 2], {});
  planking(bags, x0, x1, -fw / 2, fw / 2, y);
  const n = Math.max(0, Math.round(P.fingers));
  for (let i = 0; i < n; i++) {
    const x = x0 + P.pitch * 0.5 + i * P.pitch;
    if (x > x1 - 0.5) break;
    const s = (i % 2) ? -1 : 1;                 // alternating sides, as a real harbour's
    const z0 = s > 0 ? fw / 2 : -fw / 2 - P.fingerL, z1 = s > 0 ? fw / 2 + P.fingerL : -fw / 2;
    boxAB(bags.body, [x - P.fingerW / 2, wy - 0.35, z0], [x + P.fingerW / 2, y - 0.07, z1], {});
    planking(bags, x - P.fingerW / 2, x + P.fingerW / 2, z0, z1, y);
    // the cleats sit ALONG the finger, not off its end: `z0 + s * L` walked the
    // wrong way on the sides where s is -1 and threw them 11 m into the water
    if (P.cleats) {
      const za = Math.min(z0, z1) + 1.2, zb = Math.max(z0, z1) - 1.2;
      cleat(bags, x - P.fingerW / 2 - 0.02, y, za);
      cleat(bags, x + P.fingerW / 2 + 0.02, y, zb);
    }
  }
  if (P.bumper) for (const s of [-1, 1]) beam(bags.beam, [x0, y - 0.12, s * (fw / 2 + 0.05)], [x1, y - 0.12, s * (fw / 2 + 0.05)], 0.06, 0.1, [0, 1, 0], 0, {});
  if (P.guides) for (let i = 0; i <= 3; i++) {
    const x = x0 + (fl) * i / 3, z = fw / 2 + 0.35;
    const bed = Math.min(g(x, z), wy - 1.0) - 0.6;
    cyl(bags.pile, [x, bed, z], [0, 1, 0], 0.22, (wy + P.tide + 2.2) - bed, 9, true, {});
    boxAB(bags.steel, [x - 0.4, y - 0.05, z - 0.45], [x + 0.4, y + 0.5, z + 0.45], { py: true, ny: true });
  }
  if (P.gangway) {
    // hinged at the shore, resting on the float: it leans with the tide
    const gx0 = x0 - P.gangL, gx1 = x0;
    const sy = Math.max(wy + P.tide + 0.6, g(gx0, 0) + 0.4);
    const w2 = P.gangW / 2;
    for (const s of [-1, 1]) beam(bags.steel, [gx0, sy, s * w2], [gx1, y + 0.18, s * w2], 0.06, 0.12, [0, 1, 0], 0, {});
    const nS = Math.max(4, Math.round(P.gangL / 0.4));
    for (let i = 0; i < nS; i++) {
      const t = (i + 0.5) / nS, x = gx0 + (gx1 - gx0) * t, yy = sy + (y + 0.18 - sy) * t;
      boxAB(bags.deck, [x - 0.16, yy - 0.04, -w2], [x + 0.16, yy, w2], {});
    }
    railRun(bags, [gx0, -w2], [gx1, -w2], sy + 0.1, 1.0);
    railRun(bags, [gx0, w2], [gx1, w2], sy + 0.1, 1.0);
  }
  if (P.lamps) for (let i = 0; i <= 2; i++) lampPost(bags, lights, x0 + fl * i / 2, y, fw / 2 - 0.2, 2.6);
  return { deckY: y, x0, x1, fw, slips: n };
}

function buildMound(bags, P, PL, g, wy, rnd, lights) {
  // THE MOUND: a trapezoid swept along x, its toes where the slope meets the bed.
  const top = wy + P.crestH, hw = P.crest / 2;
  const x0 = -P.L / 2, x1 = P.L / 2;
  const n = Math.max(2, Math.round(P.L / 6));
  const rings = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    const bed = Math.min(g(x, 0), top - 0.8);
    const toe = hw + (top - bed) * P.slope;
    rings.push({ x, bed, toe });
  }
  for (let i = 0; i < n; i++) {
    const a = rings[i], b = rings[i + 1];
    // the two flanks and the crest, as quads
    face(bags.rock, [[a.x, a.bed, -a.toe], [b.x, b.bed, -b.toe], [b.x, top, -hw], [a.x, top, -hw]], null, uvFrame([a.x, a.bed, -a.toe], [1, 0, 0], [0, 1, 0], null));
    face(bags.rock, [[a.x, top, hw], [b.x, top, hw], [b.x, b.bed, b.toe], [a.x, a.bed, a.toe]], null, uvFrame([a.x, top, hw], [1, 0, 0], [0, 0, 1], null));
    face(bags.rock, [[a.x, top, -hw], [b.x, top, -hw], [b.x, top, hw], [a.x, top, hw]], [0, 1, 0], uvFrame([a.x, top, -hw], [1, 0, 0], [0, 0, 1], null));
  }
  // the two ends, closed
  for (const e of [rings[0], rings[n]]) {
    face(bags.rock, [[e.x, e.bed, -e.toe], [e.x, top, -hw], [e.x, top, hw], [e.x, e.bed, e.toe]], null, uvFrame([e.x, e.bed, -e.toe], [0, 0, 1], [0, 1, 0], null));
  }
  if (P.stones) {
    // armour: rough blocks sitting on the flanks and the crest, thinning down the slope
    const N = Math.max(8, Math.round(P.L * 1.4));
    for (let i = 0; i < N; i++) {
      const t = rnd(), x = x0 + (x1 - x0) * t;
      const r0 = rings[Math.min(n, Math.max(0, Math.round(t * n)))];
      const u = rnd() * 2 - 1, s = Math.sign(u) || 1, a = Math.abs(u);
      const zf = hw + a * (r0.toe - hw), yy = top - a * (top - r0.bed);
      const r = P.stoneR * (0.55 + rnd() * 0.9);
      const cx = x, cz = s * zf, cy = yy + r * 0.35;
      boxAB(bags.rock, [cx - r, cy - r * 0.8, cz - r * 0.9], [cx + r * 0.95, cy + r * 0.7, cz + r], {});
    }
  }
  if (P.beacon) {
    cyl(bags.steel, [x1 - 1.4, top, 0], [0, 1, 0], 0.09, 4.2, 7, true, {});
    boxAB(bags.glass, [x1 - 1.62, top + 4.2, -0.22], [x1 - 1.18, top + 4.6, 0.22], {});
    lights.push({ x: x1 - 1.4, y: top + 4.4, z: 0, col: [0.4, 1, 0.5], k: 1, range: 40, kind: 'beacon' });
  }
  return { top, hw, x0, x1 };
}

function buildWharf(bags, P, PL, g, wy, rnd, lights) {
  const y = wy + P.deck, L = P.L, w = P.w;
  const x0 = -L / 2, x1 = L / 2;
  planking(bags, x0, x1, -w / 2, w / 2, y);
  const nB = Math.max(2, Math.round(L / P.bay));
  for (let i = 0; i <= nB; i++) bent(bags, x0 + L * i / nB, y, w, P.pilesPerBent, P.pileR, P.batter, g);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = s * (w / 2 - 0.3 - k * (w / 2 - 0.6) / 2.2);
    beam(bags.beam, [x0, y - 0.18, z], [x1, y - 0.18, z], 0.11, 0.2, [0, 1, 0], 0, {});
  }
  if (P.fenders) for (let x = x0 + 3; x < x1; x += 6) for (const s of [-1, 1]) {
    const z = s * (w / 2 + 0.22);
    const bed = Math.min(g(x, z), y - 0.5) - 0.6;
    cyl(bags.pile, [x, bed, z], [0, 1, 0], P.pileR * 0.9, (y + 0.5) - bed, 9, true, {});
  }
  if (P.bollards) for (let x = x0 + 5; x < x1; x += 10) for (const s of [-1, 1]) {
    const z = s * (w / 2 - 0.5);
    cyl(bags.steel, [x, y, z], [0, 1, 0], 0.16, 0.55, 8, true, {});
    cyl(bags.steel, [x, y + 0.55, z], [0, 1, 0], 0.22, 0.12, 8, true, {});
  }
  if (P.rail) { railRun(bags, [x0, -w / 2 + 0.08], [x1, -w / 2 + 0.08], y, P.railH); railRun(bags, [x0, w / 2 - 0.08], [x1, w / 2 - 0.08], y, P.railH); }
  if (P.lamps) for (let x = x0 + P.lampSpc; x < x1; x += P.lampSpc) for (const sd of [-1, 1]) lampPost(bags, lights, x, y, sd * (w / 2 - 0.4), 4.0);
  if (P.ladder) for (const s of [-1, 1]) {
    const z = s * (w / 2 + 0.1), lx = x0 + L * 0.25;
    for (let ry = wy - P.tide; ry < y; ry += 0.32) beam(bags.steel, [lx - 0.2, ry, z], [lx + 0.2, ry, z], 0.025, 0.02, [0, 1, 0], 0, {});
  }
  return { deckY: y, x0, x1, w };
}

function buildPens(bags, P, PL, g, wy, rnd, lights) {
  const R = Math.max(1, Math.round(P.rows)), C = Math.max(1, Math.round(P.cols)), s = P.pen, c = P.collar;
  const X0 = -PL.L / 2, Z0 = -PL.w / 2;
  const y = wy + 0.28;
  // the collar grid: one walkway frame per pen, shared between neighbours
  for (let i = 0; i <= C; i++) {
    const x = X0 + c / 2 + i * s;
    boxAB(bags.body, [x - c / 2, wy - 0.22, Z0], [x + c / 2, y - 0.05, Z0 + R * s + c], {});
    planking(bags, x - c / 2, x + c / 2, Z0, Z0 + R * s + c, y);
  }
  for (let j = 0; j <= R; j++) {
    const z = Z0 + c / 2 + j * s;
    boxAB(bags.body, [X0, wy - 0.22, z - c / 2], [X0 + C * s + c, y - 0.05, z + c / 2], {});
    planking(bags, X0, X0 + C * s + c, z - c / 2, z + c / 2, y);
  }
  // the handrail round the outside
  const ex0 = X0, ex1 = X0 + C * s + c, ez0 = Z0, ez1 = Z0 + R * s + c;
  railRun(bags, [ex0, ez0], [ex1, ez0], y, 1.0);
  railRun(bags, [ex1, ez0], [ex1, ez1], y, 1.0);
  railRun(bags, [ex1, ez1], [ex0, ez1], y, 1.0);
  railRun(bags, [ex0, ez1], [ex0, ez0], y, 1.0);
  // the nets: a tapering box under each pen, drawn as four sheets and a bottom
  for (let i = 0; i < C; i++) for (let j = 0; j < R; j++) {
    const x0 = X0 + c + i * s, x1 = x0 + s - c, z0 = Z0 + c + j * s, z1 = z0 + s - c;
    const k = 0.18, b = wy - P.netD;
    const bx0 = x0 + (x1 - x0) * k / 2, bx1 = x1 - (x1 - x0) * k / 2, bz0 = z0 + (z1 - z0) * k / 2, bz1 = z1 - (z1 - z0) * k / 2;
    face(bags.net, [[x0, wy, z0], [x1, wy, z0], [bx1, b, bz0], [bx0, b, bz0]], null, uvFrame([x0, wy, z0], [1, 0, 0], [0, -1, 0], null));
    face(bags.net, [[x1, wy, z1], [x0, wy, z1], [bx0, b, bz1], [bx1, b, bz1]], null, uvFrame([x1, wy, z1], [-1, 0, 0], [0, -1, 0], null));
    face(bags.net, [[x0, wy, z1], [x0, wy, z0], [bx0, b, bz0], [bx0, b, bz1]], null, uvFrame([x0, wy, z1], [0, 0, -1], [0, -1, 0], null));
    face(bags.net, [[x1, wy, z0], [x1, wy, z1], [bx1, b, bz1], [bx1, b, bz0]], null, uvFrame([x1, wy, z0], [0, 0, 1], [0, -1, 0], null));
    face(bags.net, [[bx0, b, bz0], [bx1, b, bz0], [bx1, b, bz1], [bx0, b, bz1]], [0, -1, 0], uvFrame([bx0, b, bz0], [1, 0, 0], [0, 0, 1], null));
  }
  if (P.feedShed) {
    const fx = ex1 + 4.5, fz = (ez0 + ez1) / 2;
    boxAB(bags.body, [fx - 4, wy - 0.4, fz - 3], [fx + 4, y, fz + 3], {});
    boxAB(bags.deck, [fx - 3.2, y, fz - 2.4], [fx + 3.2, y + 2.6, fz + 2.4], {});
    boxAB(bags.steel, [fx - 3.4, y + 2.6, fz - 2.6], [fx + 3.4, y + 2.9, fz + 2.6], {});
    // the walkway over to it
    planking(bags, ex1, fx - 4, fz - 0.6, fz + 0.6, y);
    railRun(bags, [ex1, fz - 0.6], [fx - 4, fz - 0.6], y, 1.0);
    railRun(bags, [ex1, fz + 0.6], [fx - 4, fz + 0.6], y, 1.0);
  }
  if (P.buoys) for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * (i + 0.5) / 8;
    const x = (ex0 + ex1) / 2 + Math.cos(a) * (PL.L / 2 + 9), z = (ez0 + ez1) / 2 + Math.sin(a) * (PL.w / 2 + 9);
    cyl(bags.buoy, [x, wy - 0.35, z], [0, 1, 0], 0.55, 0.95, 8, true, {});
  }
  return { deckY: y, pens: R * C, ex0, ex1, ez0, ez1 };
}

// ---- build --------------------------------------------------------------
function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const PL = plan(P);
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const rnd = rng(P.seed);
  const lights = [];
  // a finite water level or nothing is drawn at all: the composer answers
  // -Infinity where no water body touches the item (27_premises.js waterAt
  // ring-samples for exactly this reason), and every vertex then went to NaN
  const wy = isFinite(P.waterY) ? P.waterY : DEF.waterY;
  // the seabed, in the item's own frame. Without one (the bench, the gate) a flat
  // bottom a few metres under the water, so a pile still has something to reach.
  const g = typeof P.ground === 'function' ? P.ground : ((lx, lz) => wy - 4.5);
  let out;
  if (PL.kind === 0) out = buildTrestle(bags, P, PL, g, wy, rnd, lights);
  else if (PL.kind === 1) out = buildFloat(bags, P, PL, g, wy, rnd, lights);
  else if (PL.kind === 2) out = buildMound(bags, P, PL, g, wy, rnd, lights);
  else if (PL.kind === 3) out = buildWharf(bags, P, PL, g, wy, rnd, lights);
  else out = buildPens(bags, P, PL, g, wy, rnd, lights);

  let tris = 0, verts = 0, nan = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of BAGS) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) {
      const x = d.pos[i], yy = d.pos[i + 1], z = d.pos[i + 2];
      if (!isFinite(x) || !isFinite(yy) || !isFinite(z)) { nan++; continue; }
      if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x;
      if (yy < bb.y0) bb.y0 = yy; if (yy > bb.y1) bb.y1 = yy;
      if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z;
    }
  }
  const deckY = out.deckY !== undefined ? out.deckY : (out.top || wy);
  const stats = Object.assign({
    lod: lod === undefined ? 0 : lod, tris, verts, per, bbox: bb, nan, degen: 0,
    kind: KINDS[PL.kind], role: 'marine', foot: PL.foot,
    // every generator publishes a height function: the DECK is what stands on this
    ground: () => deckY, floorY: deckY, waterY: wy, deckY,
    ridgeY: bb.y1, eaveY: deckY, footprint: PL.L * PL.w, area: PL.L * PL.w,
    lit: { windows: 0, panes: 0, bulbs: 0, lights: lights },
    groundAO: [],
  }, out);
  return { bags, stats, P, MAT: F ? F.MAT : MAT };
}

function applyFinish(P, F) {
  if (!T) return;
  const M = F ? F.MAT : DEFAULT_FINISH.MAT, SHADE_U = F ? F.SHADE_U : DEFAULT_FINISH.SHADE_U;
  if (!HG || !HG.shadeHouse) return;
  for (const k of ['deck', 'pile', 'beam', 'steel', 'body', 'rock', 'buoy']) HG.shadeHouse(M[k], SHADE_U);
  // salt and weed: the timber below the tide is darker and greener than the deck
  for (const k of ['deck', 'pile', 'beam', 'body', 'rock']) HG.cloudWeather(M[k], P.weather === undefined ? 0.6 : P.weather, 0);
  SHADE_U.uDirtTop.value = (P.waterY === undefined ? DEF.waterY : P.waterY) + (P.tide || 2.4);
  SHADE_U.uDirtH.value = Math.max(0.8, P.tide || 2.4);
  SHADE_U.uDirtK.value = 0.55; SHADE_U.uNoiseK.value = 0.3; SHADE_U.uAOd.value = 0.3; SHADE_U.uSag.value = 0;
  for (const k of ['deck', 'pile', 'beam', 'body', 'rock']) {
    const ud = M[k].userData && M[k].userData.dirt; if (!ud) continue;
    ud.uDirtGain.value = k === 'pile' ? 1.5 : 1.0;
    ud.uAgeDesat.value = 0.4; ud.uAgeDark.value = 0.35;
    ud.uDirtOwn.value.setHex(0x3c4a3a);     // weed, not dust: this is a tide mark
    ud.uWander.value = 0;
  }
}

function randomMarine(seed) {
  const rnd = rng(seed);
  const names = Object.keys(PRESETS);
  const P = Object.assign({}, DEF, PRESETS[names[Math.floor(rnd() * names.length)]]);
  P.seed = seed | 0;
  return P;
}

const catOf = name => CATS[name] || 'industrial';
window.MARINE_GEN = { DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, KINDS, build, plan, applyFinish, makeFinish, randomMarine, catOf };
// THE CATALOGUE (PREMISES-CONTRACT section 2). ground.need is 'none': everything
// here stands in the water on its own piles or floats on it, and cutting a shelf
// under a pier would flatten the seabed into a table.
window.MARINE_GEN.CATALOGUE_V = 1;
window.MARINE_GEN.CATALOGUE_ALIASES = {};
window.MARINE_GEN.CATALOGUE = Object.keys(PRESETS).map(name => {
  const Pd = Object.assign({}, DEF, PRESETS[name]);
  return {
    key: 'marine/' + name, kind: 'building', gen: 'MARINE_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
    params: ov => Object.assign({}, Pd, ov || {}),
    foot: P => plan(Object.assign({}, Pd, P || {})).foot,
    keepOut: 2,
    ground: { need: 'none', standing: 'none' },
    size: P => { const pl = plan(Object.assign({}, Pd, P || {})); return { L: pl.L, w: pl.w }; },
    hooks: () => [], hooksOf: () => [], lod: { dist: [0, 220, 700, 1800] },
    slots: {}, tags: ['marine', KINDS[Math.round(Pd.kind)]], role: 'marine',
    cat: catOf(name), headless: true, gate: 'HOUSE',
    // NO LOT (contract v1.22): a hand-placed site item is dressed like a plot -
    // lot ground, a drive, a car, a FENCE - and a fence round a pier is absurd.
    // Anything that stands in the water declares it wants none of that dressing.
    lot: false,
  };
});
})();
