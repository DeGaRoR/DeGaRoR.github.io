// _mission_gen.js - THE MISSION PROPS (MISSIONS-PROPS, 2026-10-27, the user: "list the new meshes, and do some
// professional models for them, ideally reusing materials we already have. Take inspiration from the real thing ...
// Think that floating gates will be hit, how do we want to handle that?").
//
// What a mission puts in the world (73c_mission_run.js missionMarkers' kinds), one generator, one kind per build:
//
//   pylon     A GATE POST, prop 'pylons': the air-race pylon. The Red Bull Air Race "Air Gate" - a 25 m cone of
//             spinnaker nylon held up by a blower at its foot, built in sections that tear apart when a wing touches
//             it (the race's rule: a pylon hit is +3 s; a crew re-erects it in minutes). ~5 m across at the foot,
//             ~0.75 m at the top; each section bulges a little between its seams (it is a pressurised bag, not a
//             spire); the top section chequered. `torn` 0..1: the hit one, its upper part folded over and hanging.
//   balloons  A GATE POST, prop 'balloons': a column of marker balls on a tether, held up by a small aerostat. The
//             balls are the power-line marker spheres pilots know (orange / white, ~0.9 m - here 1.8 m, they are
//             meant to be seen); the lifter is a kite balloon with three fins, a red light under it (an aerostat is
//             lit). Its tether runs to a concrete anchor block. `torn`: the balls round `hitY` burst (shreds).
//   donut     A RING, prop 'donut': a helium torus of ripstop in twelve banded sections, four tethers down to anchor
//             blocks when it is low enough (`tether`: the centre's height above the ground; 0 = none), four amber
//             beads on its face for the night. The HOLE is the place's r (the pass), the tube round it `tube` m.
//             Through it is -z (north) at yaw 0: the page turns it by rotation.y = -dir (73c: dir 0 = north = -z).
//             `torn`: one quadrant deflated and sagging.
//   flag      A POINT (fly-to): a 12 m mast flying a chequered orange-and-white flag (ICAO Annex 14's vehicle flag,
//             scaled up), and on the ground under it an aerial-survey target (`mark` 1: the panel cross photogram-
//             metry lays out; 2: a bullseye). `mast` 0 leaves the ground target alone: the photo point's preset.
//   tiedown   A SPOT (park): the tie-down box marked out (yellow corner brackets at the spot's half / fwd / aft:
//             25_ FLEET_SPOT_FOOT's frame, +x the nose), three ground anchors with their ropes coiled (both wings and
//             the tail), a pair of chocks with their rope at the main wheels.
//   site      A SITE (73b sites[], career.sites[id].state): `state` 'planned' (survey stakes with flagging tape and
//             a string line), 'building' (the pad poured, the mast's lower section up, a pallet under a blue tarp, a
//             cable drum), 'built' (the station itself). `site` 'awos': an automated weather station as the FAA
//             sites them - a 10 m tilt-down mast, the wind sensors on a cross-arm at the top (cup anemometer, vane),
//             the red obstruction light and a lightning rod, the temperature screen at 2 m, a solar panel facing
//             south, the equipment cabinet, the visibility sensor on its own post, a ceilometer, a rain gauge and a
//             fenced compound.
//
// MATERIALS - NONE NEW. The control towers' finish (TOWER_GEN: the house library's galvanised metal, grey steel,
// concrete, rough posts) and the house's cloths, re-used as fabric: the windsock's orange (`sock`), the storefront
// canvas (`awning`, its colour a dial: white by default - the stripes), the flag's blue and the star's gold (`flag`,
// `star`). A scheme dial picks the pair a post wears: orange / white (the obstacle marking pilots read as "keep
// clear"), blue / white, blue / gold.
//
// THE HIT. Every one of these is fabric or a light frame: it NEVER damages the aeroplane and never stops it (no
// collider in the flight model). A contact is a mission event, judged by the core (73c missionStrikeTest, the same
// dimensions: MISSION_PROP_DIMS; stats.strike says what was built): the pylon / the post / the ring is TORN (this
// generator's `torn` variant, swapped in for `rearm` s), and the mission's rule decides (rules.strike: 'penalty' -
// +3 s on the running lap, the default - 'fail', or 'ignore').
//
// Same API as the other generators (DEF/ROWS/PRESETS/BAGS/EXTRA/MAT/build/applyFinish/makeFinish/finishReport/catOf);
// headless for the gate (tools/_mission_props_check.js). No CATALOGUE: these are not premises, the page places them
// per mission (the markers) - a built site may become a premises entry later (the composer's GENERATORS, 27_).
(() => {
'use strict';
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const TW = window.TOWER_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, Bag, face, uvFrame, boxAB, beam, cyl } = K;
const D2R = Math.PI / 180;

// THE DIMENSIONS THE CORE JUDGES A HIT BY (73c MISSION_PROP_DIMS; GATE MISSIONPROPS holds the two equal)
const DIMS_OWN = { pylons: { h: 25, r0: 2.5, r1: 0.375 }, balloons: { h: 60, r: 0.9 }, donut: { tube: 1.2 }, reach: 5, pen: 3, rearm: 30 };
const DIMS = (typeof MISSION_PROP_DIMS !== 'undefined') ? MISSION_PROP_DIMS : DIMS_OWN;

// ---- the materials: the towers' finish, the house's cloths beside it
const CLOTH = ['awning', 'flag', 'star'];
const BAGS = TW.BAGS.concat(CLOTH);
const EXTRA = TW.EXTRA;
const makeFinish = () => { const F = TW.makeFinish(); for (const k of CLOTH) F.MAT[k] = F.HF.MAT[k]; return F; };
const DEFAULT_FINISH = makeFinish();
const MAT = DEFAULT_FINISH.MAT;
const SETS = role => HG.ROLE_SETS[({ siding: 'wall', roof: 'roof', steel: 'steel', post: 'post', deck: 'deck', stone: 'stone', metal: 'metal' })[role] || role];
const SET_IDX = (role, key) => Math.max(0, SETS(role).indexOf(key));
const setNames = role => SETS(role).slice();
const WHITE = Math.max(0, HG.COL_NAMES.indexOf('white'));
// the two cloths of each scheme: [A (the body / the cap), B (the stripe)]
const SCHEMES = [['sock', 'awning'], ['flag', 'awning'], ['flag', 'star']];
const SCHEME_NAMES = ['orange / white', 'blue / white', 'blue / gold'];
const KINDS = ['pylon', 'balloons', 'donut', 'flag', 'tiedown', 'site'];
const STATES = ['planned', 'building', 'built'];

const DEF = {
  kind: 'pylon', seed: 5, scheme: 0, torn: 0, lights: 0,
  // the pylon
  pyH: DIMS.pylons.h, pyR0: DIMS.pylons.r0, pyR1: DIMS.pylons.r1, pySecs: 9, bulge: 0.035, blower: 1,
  // the balloon column
  blH: DIMS.balloons.h, blR: DIMS.balloons.r, blPitch: 5.5, lean: 0, hitY: 30,
  // the ring
  rgR: 8, tube: DIMS.donut.tube, bands: 12, tether: 0,
  // the marker flag / the photo target
  mast: 1, fgH: 12, fgW: 4.2, fgCheck: 6, mark: 1, markL: 9,
  // the tie-down spot (25_ FLEET_SPOT_FOOT's box: half-width, ahead of the mount, behind it)
  half: 6.5, fwd: 3.0, aft: 6.5,
  // the site
  site: 'awos', state: 'built', padW: 3.2, mastH: 10, fence: 1,
  // the finish (TOWER_GEN's dials)
  canvasCol: WHITE,
  steelSet: SET_IDX('steel', 'steelgrey'), metalSet: SET_IDX('metal', 'galv'), roofSet: SET_IDX('roof', 'galv'),
  wallSet: SET_IDX('siding', 'boxprof'), wallCol: WHITE, stoneSet: SET_IDX('stone', 'concrete'), postSet: SET_IDX('post', 'rough'),
  deckSet: SET_IDX('deck', 'greywood'), trimCol: WHITE,
  dirt: 0.2, dirtH: 0.6, noise: 0.12, clouds: 0.25, ao: 0.7, aoRange: 0.5, aoDirect: 0.3, aoGround: 1, slopeX: 0, slopeZ: 0,
};
const is = k => P => P.kind === k;
const ROWS = [
  ['what', [
    ['kind', 'prop', 0, KINDS.length - 1, 1, KINDS], ['scheme', 'colours', 0, SCHEMES.length - 1, 1, SCHEME_NAMES, P => P.kind !== 'site' && P.kind !== 'tiedown'],
    ['torn', 'hit (torn)', 0, 1, 0.05, null, P => ['pylon', 'balloons', 'donut'].includes(P.kind)],
    ['lights', 'night lights', 0, 1, 1],
  ]],
  ['the pylon', [
    ['pyH', 'height (m)', 10, 35, 0.5, null, is('pylon')], ['pyR0', 'radius at the foot (m)', 1, 4, 0.05, null, is('pylon')],
    ['pyR1', 'radius at the top (m)', 0.2, 1.5, 0.05, null, is('pylon')], ['pySecs', 'sections', 4, 14, 1, null, is('pylon')],
    ['bulge', 'bulge between seams', 0, 0.1, 0.005, null, is('pylon')], ['blower', 'blower at the foot', 0, 1, 1, null, is('pylon')],
  ]],
  ['the balloon column', [
    ['blH', 'top (m above ground)', 15, 150, 1, null, is('balloons')], ['blR', 'ball radius (m)', 0.4, 2, 0.05, null, is('balloons')],
    ['blPitch', 'ball spacing (m)', 3, 12, 0.25, null, is('balloons')], ['lean', 'lean downwind (deg)', 0, 15, 0.5, null, is('balloons')],
    ['hitY', 'hit at (m)', 5, 150, 1, null, P => P.kind === 'balloons' && P.torn > 0],
  ]],
  ['the ring', [
    ['rgR', 'hole radius (m)', 4, 30, 0.5, null, is('donut')], ['tube', 'tube radius (m)', 0.5, 3, 0.05, null, is('donut')],
    ['bands', 'sections', 4, 24, 2, null, is('donut')], ['tether', 'tethers: centre above ground (m, 0 none)', 0, 120, 1, null, is('donut')],
  ]],
  ['the marker', [
    ['mast', 'flag mast', 0, 1, 1, null, is('flag')], ['fgH', 'mast height (m)', 5, 20, 0.5, null, P => P.kind === 'flag' && !!P.mast],
    ['fgW', 'flag length (m)', 1.5, 6, 0.1, null, P => P.kind === 'flag' && !!P.mast], ['fgCheck', 'checks along it', 2, 10, 1, null, P => P.kind === 'flag' && !!P.mast],
    ['mark', 'ground target', 0, 2, 1, ['none', 'survey cross', 'bullseye'], is('flag')], ['markL', 'target size (m)', 3, 30, 0.5, null, P => P.kind === 'flag' && P.mark > 0],
  ]],
  ['the tie-down', [
    ['half', 'half width (m)', 3, 12, 0.1, null, is('tiedown')], ['fwd', 'ahead of the mount (m)', 1, 8, 0.1, null, is('tiedown')],
    ['aft', 'behind the mount (m)', 2, 12, 0.1, null, is('tiedown')],
  ]],
  ['the site', [
    ['state', 'state', 0, STATES.length - 1, 1, STATES, is('site')], ['padW', 'pad (m)', 2, 6, 0.1, null, is('site')],
    ['mastH', 'mast height (m)', 6, 15, 0.5, null, is('site')], ['fence', 'fenced compound', 0, 1, 1, null, is('site')],
  ]],
  ['finish', [
    ['canvasCol', 'canvas', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['metalSet', 'galvanised', 0, SETS('metal').length - 1, 1, setNames('metal')], ['steelSet', 'steel', 0, SETS('steel').length - 1, 1, setNames('steel')],
    ['stoneSet', 'concrete', 0, SETS('stone').length - 1, 1, setNames('stone')], ['postSet', 'timber', 0, SETS('post').length - 1, 1, setNames('post')],
    ['dirt', 'dirt', 0, 1, 0.05], ['ao', 'baked occlusion', 0, 1, 0.05], ['aoGround', 'ground skirt', 0, 1, 1],
  ]],
];
// the ROWS' list dials carry an index; `kind`, `state` and the site are words in P (an index is read too)
const word = (v, list) => (typeof v === 'number' ? list[clamp(Math.round(v), 0, list.length - 1)] : v);
const PRESETS = {
  'air-race pylon': { kind: 'pylon' },
  'air-race pylon, hit': { kind: 'pylon', torn: 1 },
  'air-race pylon, blue': { kind: 'pylon', scheme: 1 },
  'balloon column': { kind: 'balloons' },
  'balloon column, hit': { kind: 'balloons', torn: 1, hitY: 28 },
  'ring': { kind: 'donut', aoGround: 0 },
  'ring, tethered': { kind: 'donut', tether: 40, aoGround: 0 },
  'ring, hit': { kind: 'donut', torn: 1, aoGround: 0 },
  'marker flag': { kind: 'flag', mark: 2, markL: 10 },
  'photo target': { kind: 'flag', mast: 0, mark: 1, markL: 14 },
  'tie-down spot': { kind: 'tiedown' },
  'site, planned': { kind: 'site', state: 'planned' },
  'site, building': { kind: 'site', state: 'building' },
  'weather station (built)': { kind: 'site', state: 'built', lights: 1 },
};
const CATS = {};
const catOf = name => CATS[name] || 'mission';

// ---- SURFACES: smooth-shaded grids (a balloon, a cone of fabric, a torus) --------------------------------------------------
// fn(i, j) -> { p, n } on an (nI + 1) x (nJ + 1) grid; bagOf(i, j) the bag of the quad i..i+1, j..j+1 (null: none).
// The true normal rides each vertex (face's nf), so a bag of fabric reads as one curved piece, not a faceted one.
function surf(bagOf, fn, nI, nJ, both) {
  const G = [];
  for (let i = 0; i <= nI; i++) { const row = []; for (let j = 0; j <= nJ; j++) row.push(fn(i, j)); G.push(row); }
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
    const bag = bagOf(i, j);
    if (!bag) continue;
    const q = [G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]];
    const NM = new Map(), pts = q.map(v => { const p = v.p.slice(); NM.set(p, v.n); return p; });
    const wn = nrm(q.reduce((s, v) => add(s, v.n), [0, 0, 0]));
    const u0 = len(sub(q[1].p, q[0].p)), v0 = len(sub(q[3].p, q[0].p));
    const uvf = p => [dot(sub(p, q[0].p), nrm(sub(q[1].p, q[0].p))) + i * u0, dot(sub(p, q[0].p), nrm(sub(q[3].p, q[0].p))) + j * v0];
    face(bag, pts, wn, uvf, p => NM.get(p));
    if (both) { const NB = new Map(), pb = q.map(v => { const p = v.p.slice(); NB.set(p, mul(v.n, -1)); return p; }); face(bag, pb, mul(wn, -1), uvf, p => NB.get(p)); }
  }
}
// ONE SHEET OF CLOTH, BOTH SIDES: the windsock's orange is single-sided (a sock is a tube), so a fin, a flag or a
// shred of it is emitted twice, back to back
function sheet(bag, pts, n) { face(bag, pts, n); face(bag, pts.slice().reverse(), mul(n, -1)); }
// a lathe about a vertical axis at (cx, cz): prof [[r, y], ...] bottom to top; bagOf(k, j): k the profile span, j the
// segment round
function lathe(bagOf, cx, cz, prof, segs) {
  const nP = prof.length - 1;
  const tang = k => { const a = prof[Math.max(0, k - 1)], b = prof[Math.min(nP, k + 1)]; return [b[0] - a[0], b[1] - a[1]]; };
  surf((k, j) => bagOf(k, j), (k, j) => {
    const a = 2 * Math.PI * j / segs, c = Math.cos(a), s = Math.sin(a), [r, y] = prof[k], t = tang(k);
    const nr = t[1], ny = -t[0], l = Math.hypot(nr, ny) || 1;
    return { p: [cx + c * r, y, cz + s * r], n: [c * nr / l, ny / l, s * nr / l] };
  }, nP, segs);
}
// an ellipsoid: centre c, radii [rx, ry, rz]; bagOf(i, j) by latitude i (0 = bottom) and longitude j
function ellipsoid(bagOf, c, R, nLat, nLon) {
  surf(bagOf, (i, j) => {
    const th = -Math.PI / 2 + Math.PI * i / nLat, ph = 2 * Math.PI * j / nLon;
    const u = [Math.cos(th) * Math.cos(ph), Math.sin(th), Math.cos(th) * Math.sin(ph)];
    return { p: [c[0] + R[0] * u[0], c[1] + R[1] * u[1], c[2] + R[2] * u[2]], n: nrm([u[0] / R[0], u[1] / R[1], u[2] / R[2]]) };
  }, nLat, nLon);
}
// a tube swept along a path of points with a radius per point and a flattening (sq: the W axis = tangent x U, which
// for a path in the x-y plane is the plane's own: a bag lying on the ground or hanging against a wall flattens there)
function sweep(bagOf, path, rad, segs, sq) {
  const n = path.length - 1, fr = [];
  for (let i = 0; i <= n; i++) {
    const T = nrm(sub(path[Math.min(n, i + 1)], path[Math.max(0, i - 1)]));
    let U = Math.abs(T[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    U = nrm(sub(U, mul(T, dot(U, T))));
    fr.push([T, U, nrm(crs(T, U))]);
  }
  surf(bagOf, (i, j) => {
    const a = 2 * Math.PI * j / segs, [, U, W] = fr[i], k = (sq && sq[i]) || 1;
    const d = add(mul(U, Math.cos(a) * rad[i]), mul(W, Math.sin(a) * rad[i] * k));
    return { p: add(path[i], d), n: nrm(add(mul(U, Math.cos(a) * k), mul(W, Math.sin(a)))) };
  }, n, segs);
}
// a deterministic hash in [0, 1)
const hash = (a, b) => { let h = (Math.imul((a | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2d) >>> 0; return (h ^ (h >>> 15)) / 4294967296; };
// a red obstruction light: the glass glows (palette 2), published as a `beacon` (the night lamp pool)
function redLight(bags, LIT, x, y, z, r) {
  bags.glass.setGlow(2);
  K.prismRings(bags.glass, K.ringN(x, z, r, 8, 0, y), K.ringN(x, z, r, 8, 0, y + r * 1.6), true, true);
  bags.glass.setGlow(0);
  LIT.lights.push({ kind: 'beacon', x, y: y + r * 0.8, z, nx: 0, nz: 0, col: [1.0, 0.12, 0.06], k: 1.6, range: 50.0, beacon: 1, alt: [1.0, 0.12, 0.06] });
}
// a ground anchor: a concrete block, a steel eye on top
function anchorBlock(bags, x, y, z, s, lod) {
  boxAB(bags.stone, [x - s, y - s * 0.6, z - s], [x + s, y + s * 0.5, z + s], { ny: 1 });
  if (lod === 0) cyl(bags.steel, [x, y + s * 0.5, z], [0, 1, 0], 0.05, 0.12, 6, true);
  return [x, y + s * 0.5 + 0.1, z];
}

// ==== THE AIR-RACE PYLON ====================================================================================================
function buildPylon(P, Q, bags, LIT, occ, g) {
  const H = P.pyH, r0 = P.pyR0, r1 = P.pyR1, secs = Math.max(3, Math.round(P.pySecs)), seg = Q.lod === 0 ? 28 : 14;
  const y0 = g(0, 0), torn = clamp(P.torn, 0, 1);
  const [A, B] = SCHEMES[clamp(Math.round(P.scheme), 0, SCHEMES.length - 1)].map(k => bags[k]);
  const rAt = h => r0 + (r1 - r0) * clamp(h / H, 0, 1);
  // the sections: the top one a little taller, the cap; each bulges between its seams
  const hSec = k => H * (k / secs);
  const hStand = torn > 0 ? Math.max(hSec(2), H * (1 - 0.72 * torn)) : H;
  const prof = [], bandOf = [];
  const sub3 = Q.lod === 0 ? 3 : 1;
  for (let k = 0; k < secs; k++) {
    for (let m = 0; m < sub3; m++) {
      const h = hSec(k) + (hSec(k + 1) - hSec(k)) * m / sub3;
      if (h > hStand) break;
      const t = m / sub3, b = Math.sin(Math.PI * t) * P.bulge;
      prof.push([rAt(h) * (1 + b), y0 + 0.4 + h * (H - 0.4) / H]); bandOf.push(k);
    }
  }
  // the top: the standing height (or the tear), closed with a soft dome when whole
  const hTop = Math.min(H, hStand);
  prof.push([rAt(hTop) * (torn ? 0.88 : 1), y0 + 0.4 + hTop * (H - 0.4) / H]); bandOf.push(Math.min(secs - 1, Math.floor(hTop / H * secs)));
  if (!torn) for (const f of [0.75, 0.4, 0]) { prof.push([rAt(H) * f, prof[prof.length - 1][1] + rAt(H) * (1 - f) * 0.7 + 0.02]); bandOf.push(secs - 1); }
  const checks = Math.max(4, Math.round(seg / 4));
  lathe((k, j) => {
    const b = bandOf[k];
    if (b === secs - 1) return ((Math.floor(j / (seg / checks)) + Math.floor((k - bandOf.indexOf(b)) / Math.max(1, sub3))) % 2) ? B : A;   // the chequered cap
    return b % 2 ? B : A;
  }, 0, 0, prof, seg);
  // THE TEAR: the fabric above it, empty now, folds over the rim, hangs down the +x side and lies on the ground -
  // flattened, narrowing, wrinkled (a deflated bag, not a tube)
  if (torn > 0) {
    const yT = y0 + 0.4 + hStand * (H - 0.4) / H, rT = rAt(hStand), Lr = (H - hStand) * 0.95, N = Q.lod === 0 ? 26 : 12;
    const rA = rT * 0.9, arc = Math.PI * rA, drop = Math.max(0.5, yT - y0 - rT * 0.35), path = [], rad = [], sq = [];
    for (let i = 0; i <= N; i++) {
      const s = Lr * i / N, w = 1 + 0.09 * Math.sin(i * 2.7) * (i > 0 ? 1 : 0);
      let p, k;
      if (s <= arc) { const a = s / rA; p = [rA - rA * Math.cos(a), yT + rA * Math.sin(a) * 0.45, 0]; k = 0.75 - 0.3 * (s / arc); }
      else if (s <= arc + drop) { const d = s - arc; p = [2 * rA + d * 0.12, yT - d, 0]; k = 0.42; }
      else { const d = s - arc - drop; p = [2 * rA + drop * 0.12 + d, y0 + rT * 0.12, 0]; k = 0.16; }
      path.push(p); rad.push(rT * (1 - 0.35 * i / N) * w); sq.push(k);
    }
    sweep((i, j) => (Math.floor((hStand + (H - hStand) * i / N) / H * secs) % 2 ? B : A), path, rad, Q.lod === 0 ? 16 : 8, sq);
  }
  // THE FOOT: a galvanised collar, the blower and its duct, eight straps to stakes
  cyl(bags.metal, [0, y0, 0], [0, 1, 0], r0 + 0.12, 0.42, Q.lod === 0 ? 28 : 14, true);
  if (P.blower) {
    const bx = r0 + 1.05;
    boxAB(bags.metal, [bx - 0.45, y0, -0.35], [bx + 0.45, y0 + 0.62, 0.35], { ny: 1 });
    boxAB(bags.stone, [bx - 0.6, y0 - 0.1, -0.5], [bx + 0.6, y0 + 0.02, 0.5], { ny: 1 });
    cyl(bags.steel, [bx - 0.45, y0 + 0.31, 0], [-1, 0, 0], 0.16, 0.5, Q.lod === 0 ? 10 : 6, false);
    if (Q.lod === 0) cyl(bags.steel, [bx, y0 + 0.62, 0], [0, 1, 0], 0.22, 0.04, 10, true);       // the fan guard
  }
  if (Q.lod === 0) for (let k = 0; k < 8; k++) {
    const a = 2 * Math.PI * (k + 0.5) / 8, c = Math.cos(a), s = Math.sin(a), rr = r0 + 0.12;
    const st = [c * (rr + 1.1), g(c * (rr + 1.1), s * (rr + 1.1)), s * (rr + 1.1)];
    beam(bags.sock, [c * rr, y0 + 0.4, s * rr], st, 0.025, 0.004, [0, 1, 0], 0);
    cyl(bags.steel, add(st, [0, -0.25, 0]), [0, 1, 0], 0.02, 0.33, 4, true);
  }
  if (P.lights && !torn) redLight(bags, LIT, 0, prof[prof.length - 1][1], 0, 0.09);
  occ.push({ x: 0, z: 0, r: r0 + 0.6, k: 0.35 });
  return { top: prof[prof.length - 1][1], strike: { kind: 'cone', h: H, r0, r1 }, torn: torn > 0 ? { hStand } : null };
}

// ==== THE BALLOON COLUMN ====================================================================================================
function buildBalloons(P, Q, bags, LIT, occ, g) {
  const H = P.blH, r = P.blR, lean = Math.tan(clamp(P.lean, 0, 30) * D2R), y0 = g(0, 0), torn = clamp(P.torn, 0, 1);
  const [A, B] = SCHEMES[clamp(Math.round(P.scheme), 0, SCHEMES.length - 1)].map(k => bags[k]);
  const at = h => [h * lean, y0 + h, 0];
  // the lifter: an aerostat, nose into the wind (-x), three fins at the tail (+x), its belly at H
  const LL = Math.max(6.5, r * 7.5), LR = Math.max(1.4, r * 1.6), c = add(at(H), [0, LR * 0.95, 0]);
  const nLat = Q.lod === 0 ? 14 : 8, nLon = Q.lod === 0 ? 22 : 12;
  ellipsoid(() => bags.awning, c, [LL / 2, LR, LR], nLat, nLon);
  const hull = x => LR * Math.sqrt(Math.max(0, 1 - (x / (LL / 2)) ** 2));          // the hull's radius at x along it
  for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) {
    const u = [0, Math.sin(a), Math.cos(a)], P4 = (x, rr) => add(c, add([x, 0, 0], mul(u, rr)));
    const x0 = LL * 0.14, x1 = LL * 0.47, span = LR * 1.25;
    sheet(A, [P4(x0, hull(x0) * 0.98), P4(x1, hull(x1) * 0.9), P4(x1 + LL * 0.06, hull(x1) + span), P4(x0 + LL * 0.2, hull(x0 + LL * 0.2) + span * 0.9)], crs([1, 0, 0], u));
  }
  // its light, under the envelope; the bridle down to the tether's head
  if (P.lights) redLight(bags, LIT, c[0], c[1] - LR - 0.18, c[2], 0.08);
  for (const dx of [-LL * 0.22, LL * 0.18]) beam(bags.steel, add(c, [dx, -LR * 0.85, 0]), at(H), 0.008, 0.008, [0, 0, 1], 0);
  // the tether, the anchor block
  const top = anchorBlock(bags, 0, y0, 0, 0.45, Q.lod);
  beam(bags.steel, top, at(H), 0.012, 0.012, [0, 0, 1], 0);
  // the balls on it, alternate colours; a hit bursts the ones round hitY (their shreds left on the line)
  const n = Math.max(1, Math.floor((H - 4) / P.blPitch)), sL = Q.lod === 0 ? 8 : 5, sO = Q.lod === 0 ? 14 : 8;
  let burst = 0;
  for (let k = 1; k <= n; k++) {
    const h = k * P.blPitch, bag = k % 2 ? A : B;
    if (torn > 0 && Math.abs(h - P.hitY) < 1.5 + 4.5 * torn) {
      burst++;
      for (let s = 0; s < 3; s++) {          // a few torn shreds hanging off the line
        const a = 2 * Math.PI * (s / 3 + hash(k, s) * 0.2), q = at(h), d = [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12];
        sheet(bag, [add(q, d), add(q, add(d, [Math.cos(a) * 0.25, -0.05, Math.sin(a) * 0.25])), add(q, [Math.cos(a) * 0.3, -0.75 - hash(s, k) * 0.4, Math.sin(a) * 0.3]), add(q, [d[0], -0.6, d[2]])], [-Math.sin(a), 0, Math.cos(a)]);
      }
      continue;
    }
    ellipsoid(() => bag, at(h), [r, r, r], sL, sO);
  }
  occ.push({ x: 0, z: 0, r: 0.8, k: 0.3 });
  return { top: c[1] + LR, strike: { kind: 'column', h: H, r }, balls: n - burst, burst, lifter: { L: LL, R: LR } };
}

// ==== THE RING ==============================================================================================================
// local frame: the centre at the origin, the ring in the x-y plane, through it along -z
function buildDonut(P, Q, bags, LIT, occ, g) {
  const t0 = P.tube, Rc = P.rgR + t0, nB = Math.max(4, Math.round(P.bands / 2) * 2), torn = clamp(P.torn, 0, 1);
  const nT = Q.lod === 0 ? 4 * nB : 2 * nB, nP = Q.lod === 0 ? 14 : 8;
  const [A, B] = SCHEMES[clamp(Math.round(P.scheme), 0, SCHEMES.length - 1)].map(k => bags[k]);
  // the deflated quadrant (centred low on the +x side), its tube shrunk, the ring sagging there
  const hitA = -Math.PI / 4, win = a => { const d = Math.atan2(Math.sin(a - hitA), Math.cos(a - hitA)); return Math.abs(d) < 1 ? 0.5 * (1 + Math.cos(Math.PI * d)) : 0; };
  const tubeAt = a => t0 * (1 - 0.78 * torn * win(a) * (1 + 0.12 * Math.sin(a * 23))) * (0.965 + 0.035 * Math.sin(a * nB / 2) ** 2);   // pinched at each seam
  const sag = a => -torn * 3.2 * t0 * win(a);
  surf((i, j) => (Math.floor(i * nB / nT) % 2 ? B : A), (i, j) => {
    const a = 2 * Math.PI * i / nT, f = 2 * Math.PI * j / nP, t = tubeAt(a);
    const e = [Math.cos(a), Math.sin(a), 0], n = [Math.cos(f) * e[0], Math.cos(f) * e[1], Math.sin(f)];
    return { p: [e[0] * (Rc + t * Math.cos(f)), e[1] * (Rc + t * Math.cos(f)) + sag(a), t * Math.sin(f)], n };
  }, nT, nP);
  // the valves at the seams (outer rim), the amber beads on the face (-z) at 12, 3, 6, 9 o'clock
  if (Q.lod === 0) for (let k = 0; k < nB; k += 2) {
    const a = 2 * Math.PI * k / nB, t = tubeAt(a), e = [Math.cos(a), Math.sin(a), 0];
    cyl(bags.metal, add(mul(e, Rc + t * 0.98), [0, sag(a), 0]), e, 0.07, 0.08, 6, true);
  }
  if (P.lights) {
    bags.glass.setGlow(5);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 2 * k, t = tubeAt(a), e = [Math.cos(a), Math.sin(a), 0], q = add(mul(e, Rc), [0, sag(a), -t * 0.99]);
      K.prismRings(bags.glass, K.ringN(q[0], q[2], 0.07, 6, 0, q[1] - 0.05), K.ringN(q[0], q[2], 0.07, 6, 0, q[1] + 0.05), true, true);
      LIT.lights.push({ kind: 'beacon', x: q[0], y: q[1], z: q[2], nx: 0, nz: -1, col: [1.0, 0.62, 0.12], k: 1.0, range: 40.0 }); }
    bags.glass.setGlow(0);
  }
  // the tethers: from four points low on the ring down and out to anchor blocks (the ground at y = -tether)
  let tethers = 0;
  if (P.tether > Rc + 2) {
    const yG = -P.tether, spread = P.tether * 0.35;
    for (const [a, sz] of [[Math.PI * 1.25, -1], [Math.PI * 1.25, 1], [Math.PI * 1.75, -1], [Math.PI * 1.75, 1]]) {
      const e = [Math.cos(a), Math.sin(a), 0], q = add(mul(e, Rc), [0, sag(a), sz * tubeAt(a) * 0.7]);
      const ax = Math.sign(e[0]) * (Rc * 0.8 + spread * 0.5), az = sz * spread;
      const top = anchorBlock(bags, ax, yG, az, 0.4, Q.lod);
      beam(bags.steel, q, top, 0.01, 0.01, [0, 0, 1], 0);
      if (Q.lod === 0) sheet(bags.sock, [add(q, [-0.12, 0, 0]), add(q, [0.12, 0, 0]), add(q, [0.12, -0.35, 0]), add(q, [-0.12, -0.35, 0])], [0, 0, sz]);   // the tie-off patch
      tethers++;
    }
  }
  return { top: Rc + t0, strike: { kind: 'torus', r: P.rgR, tube: t0 }, ring: { Rc, hole: P.rgR, bands: nB }, tethers, floating: true };
}

// ==== THE MARKER: THE FLAG MAST AND THE GROUND TARGET ======================================================================
function buildFlag(P, Q, bags, LIT, occ, g) {
  const y0 = g(0, 0), [A, B] = SCHEMES[clamp(Math.round(P.scheme), 0, SCHEMES.length - 1)].map(k => bags[k]);
  let top = y0 + 0.05, flag = null;
  if (P.mast) {
    const H = P.fgH;
    boxAB(bags.stone, [-0.4, y0 - 0.5, -0.4], [0.4, y0 + 0.25, 0.4], { ny: 1 });
    lathe(() => bags.metal, 0, 0, [[0.075, y0 + 0.25], [0.065, y0 + H * 0.5], [0.045, y0 + H]], Q.lod === 0 ? 10 : 6);
    ellipsoid(() => bags.metal, [0, y0 + H + 0.08, 0], [0.09, 0.09, 0.09], 6, 8);              // the finial
    if (Q.lod === 0) cyl(bags.steel, [0.08, y0 + 1.2, 0], [0, 1, 0], 0.02, 0.16, 5, true);      // the halyard cleat
    // the flag, flown along +x off the top, waving in z, chequered W x H (H = W * 0.66)
    const W = P.fgW, Hf = W * 0.66, nu = Math.round(P.fgCheck), nv = Math.max(2, Math.round(nu * 0.66)), yT = y0 + H - 0.15;
    const su = Q.lod === 0 ? 4 : 2, wave = (u) => 0.22 * W * (u / W) * Math.sin(2 * Math.PI * u / (W * 0.62));
    const dw = u => (wave(u + 0.01) - wave(u - 0.01)) / 0.02;
    surf((i, j) => ((Math.floor(i / su) + Math.floor(j / su)) % 2 ? B : A), (i, j) => {
      const u = 0.06 + W * i / (nu * su), v = Hf * j / (nv * su), droop = 0.05 * (u / W) ** 2 * Hf;
      return { p: [u, yT - Hf + v - droop, wave(u)], n: nrm([-dw(u), 0, 1]) };
    }, nu * su, nv * su, true);
    beam(bags.steel, [0.06, yT - Hf, 0], [0.06, yT, 0], 0.012, 0.012, [1, 0, 0], 0);            // the hoist
    top = y0 + H + 0.17; flag = { W, H: Hf, checks: [nu, nv] };
    if (P.lights) redLight(bags, LIT, 0, y0 + H + 0.17, 0, 0.07);
    occ.push({ x: 0, z: 0, r: 0.6, k: 0.3 });
  }
  // THE GROUND TARGET, 2 cm proud: a survey cross (two panel strips, an orange square at the crossing) or a bullseye
  const L = P.markL, yM = y0 + 0.02, w = Math.max(0.8, L / 9);
  if (P.mark === 1) {
    for (const [ax, az] of [[1, 0], [0, 1]]) for (const s of [-1, 1]) {
      const a0 = w * 0.75, a1 = L / 2;
      const p = (u, v) => [ax * u * s + az * v, yM, az * u * s + ax * v];
      face(bags.awning, [p(a0, -w / 2), p(a1, -w / 2), p(a1, w / 2), p(a0, w / 2)], [0, 1, 0], q => [q[0], q[2]]);
    }
    face(bags.sock, [[-w * 0.7, yM, -w * 0.7], [w * 0.7, yM, -w * 0.7], [w * 0.7, yM, w * 0.7], [-w * 0.7, yM, w * 0.7]], [0, 1, 0], q => [q[0], q[2]]);
  } else if (P.mark === 2) {
    const n = Q.lod === 0 ? 40 : 20;
    const ring = (r0, r1, bag) => { for (let k = 0; k < n; k++) { const a0 = 2 * Math.PI * k / n, a1 = 2 * Math.PI * (k + 1) / n, p = (r, a) => [Math.cos(a) * r, yM, Math.sin(a) * r];
      face(bag, r0 > 0 ? [p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1)] : [[0, yM, 0], p(r1, a0), p(r1, a1)], [0, 1, 0], q => [q[0], q[2]]); } };
    ring(L / 2 - w, L / 2, bags.awning); ring(L / 2 - 2.6 * w, L / 2 - 1.6 * w, bags.awning); ring(0, w * 0.9, bags.sock);
  }
  return { top, flag, mark: ['none', 'cross', 'bullseye'][P.mark | 0] || 'none', strike: null };
}

// ==== THE TIE-DOWN SPOT =====================================================================================================
// the spot's frame (25_ fleetSpotDist): +x the nose, z across (right), the box x in [-aft, fwd], z in [-half, half]
function buildTiedown(P, Q, bags, LIT, occ, g) {
  const y = (x, z) => g(x, z) + 0.015, hw = 0.12, arm = Math.min(1.6, P.half * 0.3);
  // the corner brackets (yellow paint: the star's gold)
  for (const [cx, sx] of [[P.fwd, -1], [-P.aft, 1]]) for (const [cz, sz] of [[-P.half, 1], [P.half, -1]]) {
    const strip = (x0, z0, x1, z1) => face(bags.star, [[x0, y(x0, z0), z0], [x1, y(x1, z0), z0], [x1, y(x1, z1), z1], [x0, y(x0, z1), z1]], [0, 1, 0], q => [q[0], q[2]]);
    strip(Math.min(cx, cx + sx * arm), Math.min(cz, cz + sz * hw), Math.max(cx, cx + sx * arm), Math.max(cz, cz + sz * hw));
    strip(Math.min(cx, cx + sx * hw), Math.min(cz, cz + sz * arm), Math.max(cx, cx + sx * hw), Math.max(cz, cz + sz * arm));
  }
  // the nose line: a short yellow bar across the centreline at the mount
  face(bags.star, [[-0.06, y(0, -0.6), -0.6], [0.06, y(0, -0.6), -0.6], [0.06, y(0, 0.6), 0.6], [-0.06, y(0, 0.6), 0.6]], [0, 1, 0], q => [q[0], q[2]]);
  // the anchors: both wings and the tail - a steel eye in a concrete plug, the rope coiled beside it
  const anchors = [[-0.6, -(P.half - 1.4)], [-0.6, P.half - 1.4], [-P.aft + 1.2, 0]];
  const nC = Q.lod === 0 ? 12 : 6;
  for (const [x, z] of anchors) {
    const y0 = g(x, z);
    cyl(bags.stone, [x, y0 - 0.1, z], [0, 1, 0], 0.18, 0.12, nC, true);
    if (Q.lod === 0) { for (const s of [-1, 1]) beam(bags.steel, [x - 0.06, y0 + 0.02, z], [x + 0.06 * s, y0 + 0.1, z], 0.012, 0.012, [0, 0, 1], 0); }
    // the coil: three flat loops of rope (the windsock's orange: the polypropylene rope's colour)
    for (let k = 0; k < (Q.lod === 0 ? 2 : 1); k++) {
      const cx = x + 0.45, cz = z + 0.1, r = 0.22 - k * 0.025, ring = [];
      for (let i = 0; i <= nC; i++) { const a = 2 * Math.PI * i / nC; ring.push([cx + Math.cos(a) * r, y0 + 0.03 + k * 0.025, cz + Math.sin(a) * r]); }
      for (let i = 0; i < nC; i++) beam(bags.sock, ring[i], ring[i + 1], 0.012, 0.012, [0, 1, 0], 0);
    }
    beam(bags.sock, [x, y0 + 0.05, z], [x + 0.25, y0 + 0.03, z + 0.1], 0.012, 0.012, [0, 1, 0], 0);
  }
  // the chocks at the main wheels: two timber wedges each side and the rope between
  for (const s of [-1, 1]) {
    const z = s * 1.1, y0 = g(0.3, z);
    for (const dx of [-0.22, 0.38]) {
      const x0 = 0.08 + dx, a = [x0 - 0.12, y0, z - 0.17], b = [x0 + 0.12, y0, z - 0.17], hgt = 0.14, sgn = dx < 0 ? 1 : -1;
      const top = [x0 + sgn * 0.12 * -1, y0 + hgt, z - 0.17];
      const tri = [a, b, top], tri2 = tri.map(p => [p[0], p[1], p[2] + 0.34]);
      face(bags.post, tri, [0, 0, -1]); face(bags.post, tri2, [0, 0, 1]);
      for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; face(bags.post, [tri[i], tri[j], tri2[j], tri2[i]], nrm(add(sub(tri[i], [x0, y0 + 0.05, z - 0.17]), sub(tri[j], [x0, y0 + 0.05, z - 0.17])))); }
    }
    beam(bags.sock, [-0.14, y0 + 0.05, z], [0.46, y0 + 0.05, z], 0.01, 0.01, [0, 1, 0], 0);
  }
  return { top: 0.2, strike: null, spot: { half: P.half, fwd: P.fwd, aft: P.aft }, anchors: anchors.length };
}

// ==== THE SITE: STAKES, THE WORKS, THE WEATHER STATION =====================================================================
function buildSite(P, Q, bags, LIT, occ, g) {
  const state = word(P.state, STATES), y0 = g(0, 0), pw = P.padW / 2, H = P.mastH, lod0 = Q.lod === 0;
  const out = { state, site: P.site, parts: [] };
  // THE STAKES (planned, building): the pad's corners and a lath at its centre, flagging tape, a string line
  if (state !== 'built') {
    const C = [[-pw - 0.4, -pw - 0.4], [pw + 0.4, -pw - 0.4], [pw + 0.4, pw + 0.4], [-pw - 0.4, pw + 0.4]];
    const stake = (x, z, h, tape) => {
      const yb = g(x, z);
      boxAB(bags.post, [x - 0.025, yb - 0.3, z - 0.025], [x + 0.025, yb + h, z + 0.025], { ny: 1 });
      if (tape) { sheet(bags.sock, [[x + 0.026, yb + h - 0.06, z - 0.02], [x + 0.026, yb + h - 0.06, z + 0.02], [x + 0.09, yb + h - 0.45, z + 0.06], [x + 0.06, yb + h - 0.48, z - 0.02]], [1, 0, 0]);
                  sheet(bags.sock, [[x - 0.026, yb + h - 0.06, z + 0.02], [x - 0.026, yb + h - 0.06, z - 0.02], [x - 0.07, yb + h - 0.38, z - 0.07], [x - 0.04, yb + h - 0.4, z + 0.02]], [-1, 0, 0]); }
      return [x, yb + 0.3, z];
    };
    const tops = C.map(([x, z]) => stake(x, z, 0.9, true));
    if (state === 'planned') stake(0, 0, 1.8, true);
    if (lod0) for (let i = 0; i < 4; i++) beam(bags.awning, tops[i], tops[(i + 1) % 4], 0.004, 0.004, [0, 1, 0], 0);   // the string line
    out.parts.push('stakes');
  }
  // THE PAD (building, built)
  const yP = y0 + 0.25;
  if (state !== 'planned') { boxAB(bags.stone, [-pw, y0 - 0.3, -pw], [pw, yP, pw], { ny: 1 }); out.parts.push('pad'); occ.push({ x: 0, z: 0, hx: pw, hz: pw, k: 0.3 }); }
  // THE MAST: a hinged base, a tapering galvanised tube (half of it while building)
  const mast = (hTo) => {
    boxAB(bags.steel, [-0.28, yP, -0.28], [0.28, yP + 0.03, 0.28], { ny: 1 });
    if (lod0) { cyl(bags.steel, [-0.12, yP + 0.18, -0.14], [0, 0, 1], 0.05, 0.28, 8, true); for (const s of [-1, 1]) boxAB(bags.steel, [-0.2, yP + 0.03, s * 0.14 - 0.015], [0.0, yP + 0.25, s * 0.14 + 0.015], { ny: 1 }); }
    lathe(() => bags.metal, 0, 0, [[0.09, yP + 0.03], [0.075, yP + hTo * 0.55], [0.06, yP + hTo]], lod0 ? 12 : 6);
  };
  if (state === 'building') {
    mast(H * 0.45);
    // the pallet under a blue tarp (the flag's blue), roped down
    const px = pw + 1.6, pz = -0.8, yb = g(px, pz);
    for (const dz of [-0.5, 0, 0.5]) boxAB(bags.post, [px - 0.6, yb, pz + dz - 0.05], [px + 0.6, yb + 0.1, pz + dz + 0.05], { ny: 1 });
    boxAB(bags.post, [px - 0.6, yb + 0.1, pz - 0.55], [px + 0.6, yb + 0.13, pz + 0.55], { ny: 1 });
    const t = [[px - 0.62, yb + 0.13, pz - 0.57], [px + 0.62, yb + 0.13, pz - 0.57], [px + 0.62, yb + 0.13, pz + 0.57], [px - 0.62, yb + 0.13, pz + 0.57]];
    const tt = [[px - 0.5, yb + 0.95, pz - 0.45], [px + 0.5, yb + 0.95, pz - 0.45], [px + 0.5, yb + 0.95, pz + 0.45], [px - 0.5, yb + 0.95, pz + 0.45]];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; face(bags.flag, [t[i], t[j], tt[j], tt[i]], nrm(sub(add(t[i], t[j]), [2 * px, 2 * yb + 0.6, 2 * pz]))); }
    face(bags.flag, tt, [0, 1, 0], q => [q[0], q[2]]);
    if (lod0) for (const dx of [-0.25, 0.25]) beam(bags.sock, [px + dx, yb + 0.96, pz - 0.46], [px + dx, yb + 0.96, pz + 0.46], 0.01, 0.01, [0, 1, 0], 0);
    // the mast's upper section lying beside the pad, the cable drum
    cyl(bags.metal, [-pw - 0.6, g(-pw - 0.6, 0.8) + 0.08, 0.8], [0, 0, 1], 0.065, H * 0.55, lod0 ? 10 : 6, true, { uvSwap: true, smooth: true });
    const dx = pw + 1.5, dz = 1.4, yd = g(dx, dz);
    for (const s of [-1, 1]) cyl(bags.post, [dx, yd + 0.45, dz + s * 0.25], [0, 0, s], 0.45, 0.04, lod0 ? 16 : 8, true);
    cyl(bags.steel, [dx, yd + 0.45, dz - 0.25], [0, 0, 1], 0.22, 0.5, lod0 ? 12 : 6, false);
    out.parts.push('mast:lower', 'pallet', 'drum');
  }
  if (state === 'built') {
    mast(H);
    const yT = yP + H;
    // the cross-arm at the top: the anemometer at +x, the vane at -x; the light and the lightning rod on the top
    beam(bags.steel, [-0.85, yT - 0.12, 0], [0.85, yT - 0.12, 0], 0.03, 0.03, [0, 1, 0], 0);
    cyl(bags.steel, [0.85, yT - 0.15, 0], [0, 1, 0], 0.018, 0.32, 6, true);
    cyl(bags.metal, [0.85, yT + 0.17, 0], [0, 1, 0], 0.035, 0.06, 8, true);
    if (lod0) for (let k = 0; k < 3; k++) {
      const a = 2 * Math.PI * k / 3, c = Math.cos(a), s = Math.sin(a), tip = [0.85 + c * 0.13, yT + 0.2, s * 0.13];
      beam(bags.steel, [0.85, yT + 0.2, 0], tip, 0.006, 0.006, [0, 1, 0], 0);
      ellipsoid(() => bags.metal, tip, [0.045, 0.045, 0.045], 4, 8);
    }
    cyl(bags.steel, [-0.85, yT - 0.15, 0], [0, 1, 0], 0.018, 0.3, 6, true);
    beam(bags.steel, [-0.85 - 0.25, yT + 0.17, 0], [-0.85 + 0.35, yT + 0.17, 0], 0.01, 0.01, [0, 1, 0], 0);
    face(bags.metal, [[-0.85 - 0.25, yT + 0.08, 0], [-0.85 - 0.48, yT + 0.1, 0], [-0.85 - 0.48, yT + 0.3, 0], [-0.85 - 0.25, yT + 0.26, 0]], [0, 0, 1]);   // the vane's fin
    cyl(bags.steel, [-0.85 + 0.35, yT + 0.17, 0], [1, 0, 0], 0.03, 0.08, 6, true);                                                                     // its counterweight
    cyl(bags.steel, [0, yT, 0], [0, 1, 0], 0.012, 0.9, 4, true);
    redLight(bags, LIT, 0, yT + 0.02, 0.0, 0.07);
    // the temperature screen at 2 m on an arm (-z): a stack of white plates (the canvas white)
    const sx = 0, sz = -0.5, sy = yP + 2.0;
    beam(bags.steel, [0, sy + 0.2, -0.08], [sx, sy + 0.2, sz], 0.02, 0.02, [0, 1, 0], 0);
    const nS = lod0 ? 8 : 3;
    for (let k = 0; k < nS; k++) cyl(bags.awning, [sx, sy + k * (0.32 / nS), sz], [0, 1, 0], 0.11 - 0.01 * (k === nS - 1 ? 0 : 1), 0.018, lod0 ? 12 : 6, true);
    // the solar panel at 3.2 m facing south (+z), tilted 55 degrees
    const yS = yP + 3.2, tilt = 55 * D2R, pw2 = 0.5, ph = 0.75, n = [0, Math.cos(tilt), Math.sin(tilt)], up = [0, Math.sin(tilt), -Math.cos(tilt)];
    const cP = [0, yS, 0.32], cr = (u, v) => add(cP, add([u, 0, 0], mul(up, v)));
    boxAB(bags.steel, [-0.03, yS - 0.03, 0.06], [0.03, yS + 0.03, 0.3], { ny: 1 });
    face(bags.pane, [cr(-pw2, -ph / 2), cr(pw2, -ph / 2), cr(pw2, ph / 2), cr(-pw2, ph / 2)].map(p => add(p, mul(n, 0.02))), n, uvFrame(cr(-pw2, -ph / 2), [1, 0, 0], up));
    face(bags.metal, [cr(-pw2, -ph / 2), cr(pw2, -ph / 2), cr(pw2, ph / 2), cr(-pw2, ph / 2)], mul(n, -1));
    // the equipment cabinet at 1.2 m (+x side) and its conduit down into the pad
    boxAB(bags.metal, [0.1, yP + 0.95, -0.3], [0.38, yP + 1.65, 0.3], { ny: 1 });
    if (lod0) { cyl(bags.steel, [0.24, yP, 0.0], [0, 1, 0], 0.025, 0.95, 6, false); face(bags.trim, [[0.381, yP + 1.0, -0.25], [0.381, yP + 1.0, 0.25], [0.381, yP + 1.6, 0.25], [0.381, yP + 1.6, -0.25]], [1, 0, 0], uvFrame([0.381, yP + 1.0, -0.25], [0, 0, 1], [0, 1, 0])); }
    // the visibility sensor on its post (a T: two heads looking across), the ceilometer, the rain gauge
    const vx = -pw + 0.4, vz = pw - 0.4;
    boxAB(bags.steel, [vx - 0.04, yP, vz - 0.04], [vx + 0.04, yP + 2.3, vz + 0.04], { ny: 1 });
    beam(bags.steel, [vx - 0.55, yP + 2.3, vz], [vx + 0.55, yP + 2.3, vz], 0.025, 0.025, [0, 1, 0], 0);
    for (const s of [-1, 1]) boxAB(bags.metal, [vx + s * 0.55 - 0.08, yP + 2.1, vz - 0.08], [vx + s * 0.55 + 0.08, yP + 2.32, vz + 0.08], { ny: 1 });
    const qx = pw - 0.45, qz = pw - 0.45;
    boxAB(bags.siding, [qx - 0.25, yP, qz - 0.25], [qx + 0.25, yP + 1.0, qz + 0.25], { ny: 1 });
    face(bags.pane, [[qx - 0.18, yP + 1.005, qz - 0.18], [qx + 0.18, yP + 1.005, qz - 0.18], [qx + 0.18, yP + 1.005, qz + 0.18], [qx - 0.18, yP + 1.005, qz + 0.18]], [0, 1, 0], q => [q[0], q[2]]);
    const rx = pw - 0.45, rz = -pw + 0.45;
    cyl(bags.steel, [rx, yP, rz], [0, 1, 0], 0.03, 0.55, 5, false);
    cyl(bags.metal, [rx, yP + 0.55, rz], [0, 1, 0], 0.13, 0.45, lod0 ? 12 : 6, true);
    // the compound fence: posts every ~2 m, a top and a mid rail, its gate side (+z) open in the middle
    if (P.fence) {
      const F = pw + 1.6, fy = (x, z) => g(x, z), C = [[-F, -F], [F, -F], [F, F], [-F, F]];
      for (let e = 0; e < 4; e++) {
        const a = C[e], b = C[(e + 1) % 4], Ls = Math.hypot(b[0] - a[0], b[1] - a[1]), nP = Math.max(1, Math.round(Ls / 2));
        for (let k = 0; k < nP; k++) { const t = k / nP, px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
          cyl(bags.steel, [px, fy(px, pz) - 0.2, pz], [0, 1, 0], 0.03, 2.0, lod0 ? 6 : 4, true); }
        const gap = e === 2 ? 0.55 : 1;                                 // the gate: the +z side's middle left open
        for (const h of lod0 ? [1.78, 0.9] : [1.78]) {
          if (gap < 1) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], q0 = [a[0] + (m[0] - a[0]) * 0.75, a[1] + (m[1] - a[1]) * 0.75], q1 = [b[0] + (m[0] - b[0]) * 0.75, b[1] + (m[1] - b[1]) * 0.75];
            beam(bags.steel, [a[0], fy(a[0], a[1]) + h, a[1]], [q0[0], fy(q0[0], q0[1]) + h, q0[1]], 0.018, 0.018, [0, 1, 0], 0);
            beam(bags.steel, [q1[0], fy(q1[0], q1[1]) + h, q1[1]], [b[0], fy(b[0], b[1]) + h, b[1]], 0.018, 0.018, [0, 1, 0], 0);
          } else beam(bags.steel, [a[0], fy(a[0], a[1]) + h, a[1]], [b[0], fy(b[0], b[1]) + h, b[1]], 0.018, 0.018, [0, 1, 0], 0);
        }
      }
      out.parts.push('fence');
    }
    out.parts.push('mast', 'wind', 'light', 'screen', 'solar', 'cabinet', 'visibility', 'ceilometer', 'rain');
    out.mast = { h: H, top: yT };
  }
  out.top = state === 'built' ? yP + H + 0.9 : state === 'building' ? yP + H * 0.45 : y0 + 1.8;
  out.strike = null;
  return out;
}

const BUILD = { pylon: buildPylon, balloons: buildBalloons, donut: buildDonut, flag: buildFlag, tiedown: buildTiedown, site: buildSite };
function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  P.kind = word(P.kind, KINDS); P.state = word(P.state, STATES);
  const Q = { lod: lod | 0 };
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const LIT = HG.litBegin();
  const occ = [];
  const f = BUILD[P.kind] || BUILD.pylon;
  const S = f(P, Q, bags, LIT, occ, g);
  // the ground skirt and the bake (a floating ring has no ground under it)
  for (const o of occ) o.dry = true;
  if (P.aoGround && occ.length) HG.buildGroundAO(bags.aoskirt, occ, g);
  const aoInfo = K.bakeAO(BAGS.map(k => bags[k]), { strength: P.ao === undefined ? 0.7 : P.ao, range: P.aoRange || 0.5, ground: S.floating ? null : g });
  let tris = 0, verts = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of BAGS) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) { const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2];
      if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z; }
  }
  const stats = Object.assign({ tris, verts, per, bbox: bb, kind: P.kind, role: 'mission', lights: LIT.lights.length,
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, pier: null, lit: LIT, smoke: null, sign: null, yard: [] }, S);
  return { bags, stats, P, V: { L: bb.x1 - bb.x0, w: bb.z1 - bb.z0, wallT: 0.1, floorY: 0 }, R: null, MAT: F ? F.MAT : MAT };
}

// the finish: the towers' (its dials mapped; no derelict), then the canvas's colour
function applyFinish(P, F) {
  const Pf = Object.assign({}, TW.DEF, DEF, P || {}, { derelict: 0 });
  TW.applyFinish(Pf, F);
  const M = F ? F.MAT : MAT;
  if (M.awning) M.awning.color.setHex(HG.COLS[clamp(Math.round(Pf.canvasCol), 0, HG.COLS.length - 1)][1]);
}
function finishReport() {
  return BAGS.map(k => { const m = MAT[k], flat = !!(m.userData && m.userData.flat) || k === 'glass' || k === 'pane'; return { slot: k, map: !!m.map, nor: !!m.normalMap, rough: !!m.roughnessMap, full: flat || (!!m.map && !!m.normalMap && !!m.roughnessMap), glassy: flat }; });
}
// the preset a marker (73c missionMarkers) draws, and its dials from the marker's own numbers
function forMarker(m, o) {
  o = o || {};
  if (!m) return null;
  if (m.kind === 'gate') return m.prop === 'balloons'
    ? { kind: 'balloons', blH: (m.alt && m.alt.max) || DIMS.balloons.h, torn: o.torn ? 1 : 0, hitY: o.hitY || 30 }
    : { kind: 'pylon', torn: o.torn ? 1 : 0 };
  if (m.kind === 'ring') return { kind: 'donut', rgR: m.r || 8, tether: o.agl || 0, torn: o.torn ? 1 : 0, aoGround: 0 };
  if (m.kind === 'pt') return m.do === 'photo' ? { kind: 'flag', mast: 0, mark: 1, markL: 14 } : { kind: 'flag', mark: 2, markL: 10 };
  if (m.kind === 'spot') return { kind: 'tiedown' };
  if (m.kind === 'site') return { kind: 'site', state: o.state || 'planned' };
  return null;
}

window.MISSION_GEN = { DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, KINDS, STATES, SCHEMES, SCHEME_NAMES, DIMS, DIMS_OWN, SET_IDX, CATS, catOf,
  build, applyFinish, makeFinish, finishReport, forMarker };
})();
