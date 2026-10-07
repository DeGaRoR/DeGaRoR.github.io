// ===========================================================================
// FREIGHT (G2340-G2344 FREIGHT-MODEL) — WEIGHT AND VOLUME, FITTED INSIDE THE AIRFRAME.
// futureDesigns/game/FREIGHT-2026-10-07.md §1, §2, §4 (RULED by the user, 7 Oct).
// ===========================================================================
// A LOAD IS ITEMS: { id, kind: crate|box|bag|drum|long|bulk|stretcher, kg, dims: [L, W, H] m, rigid, stack }.
// A contract's goods carry their dims (FREIGHT_GOODS), so "120 kg of crated parts" is two crates; a BULK load is
// split into bags (ruled). An item goes aboard only through a DOOR, in some orientation, and then packs into the
// HOLD beside the others and the occupants.
//
// THE AIRFRAME'S SIDE IS MEASURED, NOT RULED HERE. A FREIGHT CARD (FREIGHT_CARDS, below) is what
// tools/_freight_site.js reads off the airframe's own mesh with the fuel path's machinery: the hold is
// _bay_site.js's inset sections (GEN_BAY_WALL off along the edge normals) swept from the front row's seat pan to
// GEN_BAYS.aftCabin's end, the doors are _cage_gen.js cageDoorEdges' outlines, the seats the join's measured
// stations, the mass and the CERTIFIED CG RANGE the plaque's (designGross, the four corners). GATE FREIGHT
// re-measures every validated build's card from its build file each run and holds this table to it.
//
// THE RULES ARE HERE, AND THEY ARE STATED:
//   the door      an item passes a door if, held at some axis and roll, its slice in the door's plane fits one of
//                 the door's clear rectangles AND, once wholly inside, it fits the hold's section at the door
//                 (the swing-in: a long item goes in at a slant and is laid down inside; straight in is the case
//                 of an axis square to the door). The fuel tank never needed this; freight is all about it.
//   the hold      a placed item is a box that stands inside the inset section at every station it spans, on the
//                 highest floor under it, clear of the seats (an empty seat is geometry the packer works around,
//                 unless the player takes it out: ruled), the occupants and the other items.
//   the limits    FREIGHT_FLOOR kg/m2 under each item (and what is stacked on it), the baggage placard on the
//                 baggage bay, the MTOW and the CERTIFIED CG RANGE. The packer keeps to them when it can and SAYS
//                 when it cannot: a placement out of range is REPORTED, NEVER FORBIDDEN (the spine: the aeroplane
//                 flies what you loaded, and you find out).
//   the packer    first fit, biggest and heaviest first, low, then near the CG the range wants, then the middle.
//                 Deterministic: no clock, no random, a fixed candidate order; a tie goes to the first candidate.
//
// Pure: no DOM, storage, clock or random (GATE FREIGHT scans for each). Reads CONTRACT_DESIGNS / CONTRACT_FIT
// (72_), contractGearOk (73_) where the map's mark asks.
// ===========================================================================

const FREIGHT_V = 1;

// ---- THE ITEMS -----------------------------------------------------------------------------------------------
// what each kind is: rigid (a box keeps its shape), stack (things may go on top), upright (its H stays vertical:
// a full drum is not laid down), flat (its H stays vertical once placed: a stretcher with a patient), split (never
// placed itself: split into bags, the ruling), squeeze (a soft item gives: its dims times this through a door)
const FREIGHT_KINDS = {
  crate:     { rigid: true,  stack: true },
  box:       { rigid: true,  stack: true },
  bag:       { rigid: false, stack: true, squeeze: 0.85 },
  drum:      { rigid: true,  stack: false, upright: true },
  long:      { rigid: true,  stack: true },
  bulk:      { rigid: false, stack: true, split: true, squeeze: 0.85 },
  stretcher: { rigid: true,  stack: false, flat: true },
};
// THE BAG a bulk load is split into: a 25 kg sack (what one person carries from the strip)
const FREIGHT_BAG = { kg: 25, dims: [0.60, 0.40, 0.15] };
// THE GOODS GAIN DIMS (CONTRACT-MODEL's goods words -> what one unit is). `unit` is the most one item weighs; a
// load is split into ceil(kg / unit) items of equal mass. The parts row is the study's own example (120 kg of
// crated parts = 2 crates 0.8 x 0.6 x 0.5 m). The canoe is a FOLDING canoe in its two packs: a rigid canoe is an
// external load (BELLY-POD, later). Supplies are the bulk row: flour, sugar and feed, split into sacks.
const FREIGHT_GOODS = {
  'goods.mail':     { kind: 'bag',   unit: 20, dims: [0.65, 0.40, 0.30] },
  'goods.tools':    { kind: 'box',   unit: 25, dims: [0.60, 0.35, 0.30] },
  'goods.parts':    { kind: 'crate', unit: 60, dims: [0.80, 0.60, 0.50] },
  'goods.samples':  { kind: 'box',   unit: 20, dims: [0.40, 0.30, 0.25] },
  'goods.rods':     { kind: 'long',  unit: 30, dims: [1.50, 0.20, 0.20] },
  'goods.supplies': { kind: 'bulk',  unit: 90, dims: [0.60, 0.40, 0.45] },
  'goods.water':    { kind: 'box',   unit: 15, dims: [0.45, 0.30, 0.30] },
  'goods.gear':     { kind: 'bag',   unit: 15, dims: [0.80, 0.35, 0.30] },
  'goods.kit':      { kind: 'bag',   unit: 20, dims: [0.70, 0.35, 0.35] },
  'goods.canoe':    { kind: 'bag',   unit: 25, dims: [0.95, 0.40, 0.30] },
};
// a load with no goods word (an authored arc's "40 kg"): boxes
const FREIGHT_GENERIC = { kind: 'box', unit: 20, dims: [0.50, 0.40, 0.30] };
// THE MEDEVAC LOAD (§4b, listed, not built): a stretcher with the patient
const FREIGHT_STRETCHER = { id: 'stretcher', kind: 'stretcher', kg: 95, dims: [2.0, 0.6, 0.5] };

// ---- THE LIMITS (stated) ----------------------------------------------------------------------------------
//   floor     kg/m2 under an item (with what is stacked on it): the cabin's floorboards, the baggage bay's
//             lighter floor (the light-aircraft placards' order: ~100 lb/ft2 cabin, ~20 lb/ft2 baggage)
//   seat      an empty seat is its pan (`pan` deep, `panH` high) and its back (`backD` deep, `seatH` high); an
//             occupant is one envelope from the legs (`legs` ahead of the back) to `occH`, `occW` wider than the seat
const FREIGHT_FLOOR = { cabin: 300, baggage: 100 };
const FREIGHT_SEAT = { pan: 0.50, panH: 0.40, backD: 0.12, legs: 0.95, backT: 0.05, seatH: 1.00, occH: 1.30, occW: 0.06 };
const FREIGHT_PACK = { step: 0.05, zStep: 0.025, eps: 1e-6 };

const frR3 = v => Math.round(v * 1000) / 1000;
const frClone = o => JSON.parse(JSON.stringify(o));

// one item, normalised: kind known, kg >= 0, three positive dims, the kind's rigid / stack
function freightItem(it) {
  const K = FREIGHT_KINDS[it && it.kind] ? it.kind : 'box';
  const T = FREIGHT_KINDS[K];
  const d = (Array.isArray(it && it.dims) ? it.dims : []).slice(0, 3).map(v => Math.max(0.01, +v || 0.01));
  while (d.length < 3) d.push(0.3);
  return { id: String((it && it.id) || K), kind: K, kg: Math.max(0, frR3(+(it && it.kg) || 0)), dims: d.map(frR3),
           rigid: it && it.rigid != null ? !!it.rigid : T.rigid, stack: it && it.stack != null ? !!it.stack : T.stack };
}
// a load's kg split into n equal items (kg to 0.5, the rest on the last: the sum is the load exactly)
function frSplitKg(kg, unit) {
  const n = Math.max(1, Math.ceil(kg / Math.max(1e-9, unit) - 1e-9));
  const each = Math.floor(kg / n * 2) / 2, out = [];
  for (let k = 0; k < n; k++) out.push(k < n - 1 ? each : frR3(kg - each * (n - 1)));
  return out;
}
// BULK SPLITS INTO BAGS (ruled): a bulk item -> 25 kg sacks
function freightSplit(items) {
  const out = [];
  for (const raw of items || []) {
    const it = freightItem(raw);
    if (!FREIGHT_KINDS[it.kind].split) { out.push(it); continue; }
    frSplitKg(it.kg, FREIGHT_BAG.kg).forEach((kg, k) =>
      out.push(freightItem({ id: it.id + '.' + (k + 1), kind: 'bag', kg, dims: FREIGHT_BAG.dims })));
  }
  return out;
}
// A LOAD -> ITEMS: { kg, pax, bulk? } and the goods word (the job's `goods`) -> [item]. Deterministic: a load is
// always the same items. Passengers are seats, not items (they board, they don't fit).
function freightItems(load, goods) {
  const kg = Math.max(0, +(load && load.kg) || 0);
  if (!(kg > 0)) return [];
  const G = FREIGHT_GOODS[goods] || FREIGHT_GENERIC;
  const tag = (goods && FREIGHT_GOODS[goods] ? goods.replace(/^goods\./, '') : 'load');
  if (G.kind === 'bulk') return freightSplit([{ id: tag, kind: 'bulk', kg, dims: G.dims }]);
  return frSplitKg(kg, G.unit).map((m, k) => freightItem({ id: tag + '.' + (k + 1), kind: G.kind, kg: m, dims: G.dims }));
}
const freightKg = items => frR3((items || []).reduce((s, it) => s + (+it.kg || 0), 0));

// ---- THE HOLD ------------------------------------------------------------------------------------------------
const frHoldX1 = H => H.x0 + H.n * H.dx;
const frFloorAt = (H, i) => H.y0 + H.floor[i] / 100;
// the stations a box over [x0, x1] spans (the bracketing ones included: the conservative side)
function frStations(H, x0, x1) {
  const a = Math.floor((x0 - H.x0) / H.dx + 1e-9), b = Math.ceil((x1 - H.x0) / H.dx - 1e-9);
  if (a < 0 || b > H.n) return null;
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
// the floor a box over [x0, x1] rests on: the highest floor under it
function freightRestY(card, x0, x1) {
  const H = card && card.hold, st = H && frStations(H, x0, x1);
  if (!st) return null;
  return Math.max(...st.map(i => frFloorAt(H, i)));
}
// the clear half-width a box over [x0, x1] x [y0, y1] may reach at every station it spans (m), or -1 when it cannot
// stand there at all (off the hold's ends, below a floor, above the roof)
function frZMax(card, x0, x1, y0, y1) {
  const H = card && card.hold;
  if (!H) return -1;
  const a = Math.floor((x0 - H.x0) / H.dx + 1e-9), b = Math.ceil((x1 - H.x0) / H.dx - 1e-9);
  if (a < 0 || b > H.n) return -1;
  const j0 = Math.floor((y0 - H.y0) / H.dy + 1e-6), j1 = Math.ceil((y1 - H.y0) / H.dy - 1e-6) - 1;
  if (j0 < 0 || j1 >= H.ny) return -1;
  let m = Infinity;
  for (let i = a; i <= b; i++) {
    if (y0 < H.y0 + H.floor[i] / 100 - 1e-6) return -1;
    const row = H.half[i];
    for (let j = j0; j <= j1; j++) if (row[j] < m) m = row[j];
  }
  return m / 100;
}
// does a box { x0, x1, y0, y1, z0, z1 } stand inside the hold's clear section at every station it spans?
function freightHoldFits(card, b) {
  const zm = frZMax(card, b.x0, b.x1, b.y0, b.y1);
  return zm >= 0 && Math.max(Math.abs(b.z0), Math.abs(b.z1)) <= zm + 1e-8;
}
// the clear width of the hold at station i over a band of height h above its floor (m)
function frRoomW(H, i, h) {
  const row = H.half[i], f = frFloorAt(H, i);
  const j0 = Math.floor((f - H.y0) / H.dy + 1e-6), j1 = Math.ceil((f + h - H.y0) / H.dy - 1e-6) - 1;
  if (j0 < 0 || j1 >= H.ny) return 0;
  let m = Infinity;
  for (let j = j0; j <= j1; j++) m = Math.min(m, row[j]);
  return isFinite(m) ? 2 * m / 100 : 0;
}

// ---- THE DOOR --------------------------------------------------------------------------------------------------
// One door, one item -> { ok, how: 'straight' | 'swung', axis } . The door's plane is (x aft, y up), its normal z
// inward. The item is held with its long axis u (phi from the door's plane, psi round it) and a roll rho; its
// slice in the door's plane is the parallelogram of its two cross dims projected along u — that must fit one of the
// door's clear rectangles. Wholly inside, its depth across the hold and its height must fit the hold's section at
// the door (frRoomW): then it is laid down along the hold. A deterministic grid, coarse enough to be cheap and
// memoised by the item's dims (kg plays no part in a door).
const FREIGHT_DOOR_GRID = { phi: 3, psi: 10, rho: 15 };
const frDoorMemo = new Map();
function freightDoorPass(card, door, item) {
  const H = card && card.hold;
  if (!door || !H || !door.rects || !door.rects.length) return { ok: false, why: 'no door' };
  const it = freightItem(item), K = FREIGHT_KINDS[it.kind];
  // keyed by what decides it (the openings, the hold at the door, the dims): a pair of mirrored doors asks once
  const key = (card.id || '') + '|' + JSON.stringify(door.rects) + '|' + door.st + '|' + it.dims.join(',') + '|' + (K.upright ? 'u' : '') + (K.squeeze || '');
  if (frDoorMemo.has(key)) return frDoorMemo.get(key);
  const st = door.st == null ? 0 : door.st;
  const hMax = (() => { let h = 0; for (let k = 1; k <= H.ny; k++) if (frRoomW(H, st, k * H.dy) > 0) h = k * H.dy; return h; })();
  const rects = door.rects;
  const holeOk = (X, Y) => rects.some(r => X <= r[0] + 1e-9 && Y <= r[1] + 1e-9);
  const D = it.dims.map(v => v * (K.squeeze || 1)), G = FREIGHT_DOOR_GRID, rad = Math.PI / 180;
  let res = { ok: false, why: it.id + ' (' + D.join(' x ') + ' m) passes no opening of ' + door.id };
  // which dim runs along the axis (the other two are the cross section); an upright item keeps its H vertical and
  // goes in straight (a full drum is not tipped)
  const axes = K.upright ? [[0, 1, 2], [1, 0, 2]] : [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  search:
  for (const [ia, ib, ic] of axes) {
    const L = D[ia], w = D[ib], d = D[ic];
    if (K.upright) {
      // straight in, H vertical: the hole w x d(H), the depth L across the hold at d's height
      if (holeOk(w, d) && L <= frRoomW(H, st, d) + 1e-9 && d <= hMax + 1e-9) { res = { ok: true, how: 'straight', axis: ia }; break; }
      continue;
    }
    for (let phi = 90; phi >= G.phi; phi -= G.phi) {
      const sp = Math.sin(phi * rad), cp = Math.cos(phi * rad);
      for (let psi = 0; psi < 180; psi += (phi === 90 ? 180 : G.psi)) {
        const ss = Math.sin(psi * rad), cs = Math.cos(psi * rad);
        const u = [cp * cs, cp * ss, sp];
        const e1 = [-ss, cs, 0];
        const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
        for (let rho = 0; rho < 180; rho += G.rho) {
          const cr = Math.cos(rho * rad), sr = Math.sin(rho * rad);
          const a2x = cr * e1[0] + sr * e2[0], a2y = cr * e1[1] + sr * e2[1], a2z = cr * e1[2] + sr * e2[2];
          const a3x = -sr * e1[0] + cr * e2[0], a3y = -sr * e1[1] + cr * e2[1], a3z = -sr * e1[2] + cr * e2[2];
          // the slice in the door's plane: v = a - (a_z / u_z) u, its (x, y)
          const X = w * Math.abs(a2x - a2z / sp * u[0]) + d * Math.abs(a3x - a3z / sp * u[0]);
          const Y = w * Math.abs(a2y - a2z / sp * u[1]) + d * Math.abs(a3y - a3z / sp * u[1]);
          if (!holeOk(X, Y)) continue;
          // wholly inside at this attitude: its depth across the hold and its height
          const Zx = L * Math.abs(u[2]) + w * Math.abs(a2z) + d * Math.abs(a3z);
          const Yx = L * Math.abs(u[1]) + w * Math.abs(a2y) + d * Math.abs(a3y);
          if (Yx > hMax + 1e-9 || Zx > frRoomW(H, st, Yx) + 1e-9) continue;
          res = { ok: true, how: (phi === 90 && rho % 90 === 0) ? 'straight' : 'swung', axis: ia };
          break search;
        }
      }
    }
  }
  frDoorMemo.set(key, res);
  return res;
}
// an item against every door of a card -> { ok, door, how } (the first door that takes it, in the card's order)
function freightDoorAny(card, item) {
  for (const d of (card && card.doors) || []) { const r = freightDoorPass(card, d, item); if (r.ok) return Object.assign({ door: d.id }, r); }
  return { ok: false, door: null, why: freightItem(item).id + ' passes no door' };
}
// THE HARD NO-NO: the items of a load that pass no door of this card -> [id]
function freightNoDoor(card, items) {
  return freightSplit(items).filter(it => !freightDoorAny(card, it).ok).map(it => it.id);
}

// ---- THE SEATS, THE OCCUPANTS, THE SPACES --------------------------------------------------------------------
// who sits where: the pilot in seat 0, `pax` passengers in the next seats in order; `seatsOut` the seats the player
// took out (only an empty seat can go). -> [{ i, x, back, z, w, occ, out }]
function freightSeats(card, opts) {
  const o = opts || {}, pax = Math.max(0, o.pax | 0), out = new Set(o.seatsOut || []);
  return ((card && card.seats) || []).map(s => {
    const occ = s.i === 0 || (s.i <= pax);
    return Object.assign({}, s, { occ, out: !occ && out.has(s.i) });
  });
}
// the obstacles in the hold: each seat still in (its pan and its back), an occupant's envelope on an occupied one
function freightObstacles(card, seats) {
  const F = FREIGHT_SEAT, H = card.hold, ob = [];
  const box = (id, s, fore, aft, h, w) => {
    const x0 = Math.max(fore, H.x0), x1 = Math.min(aft, frHoldX1(H));
    if (!(x1 > x0)) return;
    const y = freightRestY(card, x0, x1), y0 = y == null ? H.y0 : y;
    ob.push({ id, seat: s.i, x0, x1, y0, y1: y0 + h, z0: s.z - w / 2, z1: s.z + w / 2 });
  };
  for (const s of seats) {
    if (s.out) continue;
    if (s.occ) { box('occupant ' + s.i, s, s.back - F.legs, s.back + F.backT, F.occH, s.w + F.occW); continue; }
    box('seat ' + s.i, s, s.back - F.pan, s.back + F.backT, F.panH, s.w);
    box('seat back ' + s.i, s, s.back - F.backD, s.back + F.backT, F.seatH, s.w);
  }
  return ob;
}
// the spaces: the cabin floor behind the crew (to the cabin's aft ring), the baggage bay aft of it — each with its
// floor limit and its station (where its floor's middle is: the CG lever of what sits in it)
function freightSpaces(card) {
  const H = card && card.hold;
  if (!H) return [];
  const xb = Math.min(Math.max(card.cabinX1, H.x0), frHoldX1(H));
  const sp = [{ id: 'cabin', x0: H.x0, x1: xb, kgM2: FREIGHT_FLOOR.cabin }];
  if (frHoldX1(H) - xb > 0.05) sp.push({ id: 'baggage', x0: xb, x1: frHoldX1(H), kgM2: FREIGHT_FLOOR.baggage, maxKg: card.mass && card.mass.bagKg });
  for (const s of sp) s.station = frR3(0.5 * (s.x0 + s.x1));
  return sp;
}
const frSpaceOf = (spaces, x) => (spaces.find(s => x >= s.x0 - 1e-9 && x < s.x1 - 1e-9) || spaces[spaces.length - 1] || { id: null }).id;

// ---- THE REPORT: a set of placed items -> the CG, the mass, the margins ----------------------------------------
// placed: [{ id, kg, at: {x0,x1,y0,y1,z0,z1}, on? }]. Everything said, nothing refused.
function freightReport(card, placed, opts) {
  const o = opts || {}, Mm = card.mass, occKg = (typeof CONTRACT_FIT !== 'undefined' && CONTRACT_FIT.occKg) || 80;
  const seats = freightSeats(card, o), spaces = freightSpaces(card);
  const pax = seats.filter(s => s.occ && s.i > 0);
  const paxWanted = Math.max(0, o.pax | 0);
  let kg = Mm.base.kg, mx = Mm.base.kg * Mm.base.x;
  for (const s of pax) { kg += occKg; mx += occKg * s.x; }
  for (const p of placed) { const xc = 0.5 * (p.at.x0 + p.at.x1); kg += p.kg; mx += p.kg * xc; }
  const x = mx / kg;
  const pct = v => (Mm.mac && Mm.mac[1]) ? frR3((v - Mm.mac[0]) / Mm.mac[1] * 100) : null;
  const [fwd, aft] = Mm.cg;
  const cgMargin = Math.min(x - fwd, aft - x);
  // the floor: each item resting on the floor carries itself and everything on it
  const load = {};
  for (const p of placed) {
    let b = p; const seen = new Set();
    while (b.on && !seen.has(b.on)) { seen.add(b.on); const s = placed.find(q => q.id === b.on); if (!s) break; b = s; }
    load[b.id] = (load[b.id] || 0) + p.kg;
  }
  const floor = [];
  for (const p of placed) {
    if (p.on) continue;
    const A = (p.at.x1 - p.at.x0) * (p.at.z1 - p.at.z0);
    const space = frSpaceOf(spaces, 0.5 * (p.at.x0 + p.at.x1)), S = spaces.find(s => s.id === space);
    const kgM2 = A > 0 ? (load[p.id] || 0) / A : Infinity;
    floor.push({ id: p.id, space, kgM2: frR3(kgM2), limit: S ? S.kgM2 : null, ok: !S || kgM2 <= S.kgM2 + 1e-9 });
  }
  const bagS = spaces.find(s => s.id === 'baggage');
  const bagKg = frR3(placed.filter(p => bagS && frSpaceOf(spaces, 0.5 * (p.at.x0 + p.at.x1)) === 'baggage').reduce((s, p) => s + p.kg, 0));
  const out = {
    mass: { kg: frR3(kg), mtow: Mm.mtow, margin: frR3(Mm.mtow - kg), ok: kg <= Mm.mtow + 1e-6 },
    cg: { x: frR3(x), pct: pct(x), range: [fwd, aft], pctRange: [pct(fwd), pct(aft)], margin: frR3(cgMargin), ok: cgMargin >= -1e-6,
          side: x < fwd ? 'forward' : x > aft ? 'aft' : null },
    floor, floorOk: floor.every(f => f.ok),
    baggage: { kg: bagKg, limit: bagS ? (bagS.maxKg || 0) : 0, ok: !bagS || bagKg <= (bagS.maxKg || 0) + 1e-9 },
    seats: { pax: pax.length, wanted: paxWanted, ok: pax.length >= paxWanted, out: seats.filter(s => s.out).map(s => s.i) },
    cargoKg: freightKg(placed),
  };
  out.ok = out.mass.ok && out.cg.ok && out.floorOk && out.baggage.ok && out.seats.ok;
  out.why = [];
  if (!out.seats.ok) out.why.push(paxWanted + ' passengers, ' + pax.length + ' seats beside the pilot');
  if (!out.mass.ok) out.why.push(frR3(kg - Mm.mtow) + ' kg over the MTOW (' + Mm.mtow + ' kg)');
  if (!out.cg.ok) out.why.push('the CG ' + out.cg.pct + ' % MAC is ' + out.cg.side + ' of the certified ' + out.cg.pctRange.join('-') + ' %');
  for (const f of floor) if (!f.ok) out.why.push(f.id + ': ' + Math.round(f.kgM2) + ' kg/m2 on the ' + f.space + ' floor (' + f.limit + ')');
  if (!out.baggage.ok) out.why.push(bagKg + ' kg in the baggage bay, the placard says ' + out.baggage.limit);
  return out;
}

// ---- THE PACKER -------------------------------------------------------------------------------------------------
// the orientations a kind allows -> [[lx, ly(height), lz]] (deduplicated, in a fixed order)
function frOrients(it) {
  const K = FREIGHT_KINDS[it.kind], [a, b, c] = it.dims;
  const all = (K.upright || K.flat) ? [[a, c, b], [b, c, a]] : [[a, c, b], [b, c, a], [a, b, c], [c, b, a], [b, a, c], [c, a, b]];
  return all.filter((o, i) => all.findIndex(q => q[0] === o[0] && q[1] === o[1] && q[2] === o[2]) === i);
}
const frOverlap = (p, q) => p.x0 < q.x1 - 1e-6 && q.x0 < p.x1 - 1e-6 && p.y0 < q.y1 - 1e-6 && q.y0 < p.y1 - 1e-6 && p.z0 < q.z1 - 1e-6 && q.z0 < p.z1 - 1e-6;
// freightPack(card, items, opts) -> { ok, placed, unplaced, report, how }
//   opts: { pax (passengers beside the pilot), seatsOut ([seat i] the player took out), limits: false (geometry only),
//           doors: false (the room alone, no door asked: a report's "would it fit inside") }
// ok = every item placed (the geometry); report.ok = and within every limit. An item no door takes, or no room
// holds, is `unplaced` with why; a limit not met is in report.why. Nothing is refused.
function freightPack(card, itemsIn, opts) {
  const o = opts || {}, P = FREIGHT_PACK;
  const items = freightSplit(itemsIn);
  const res = { ok: false, placed: [], unplaced: [], report: null };
  if (!card || !card.hold) {
    res.unplaced = items.map(it => ({ id: it.id, why: 'this aeroplane has no hold' }));
    res.report = card && card.mass ? freightReport(card, [], o) : null;
    return res;
  }
  const H = card.hold, spaces = freightSpaces(card);
  const seats = freightSeats(card, o), obst = freightObstacles(card, seats);
  const Mm = card.mass, occKg = (typeof CONTRACT_FIT !== 'undefined' && CONTRACT_FIT.occKg) || 80;
  // biggest, then heaviest, then by id: a fixed order
  const order = items.slice().sort((p, q) => (q.dims[0] * q.dims[1] * q.dims[2]) - (p.dims[0] * p.dims[1] * p.dims[2]) || q.kg - p.kg || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  // the running mass and moment (the base, the passengers), so "near the CG" is near where the range wants it
  let kg = Mm.base.kg, mx = Mm.base.kg * Mm.base.x;
  for (const s of seats) if (s.occ && s.i > 0) { kg += occKg; mx += occKg * s.x; }
  // NEAR THE CG: an item goes where it moves the CG least - at the CG itself while the CG is in the certified
  // range; when it is out, where it brings the CG back to the nearer limit
  const xHi = frHoldX1(H);
  const placed = [];
  // the strict pass's running sums: the load on each floor-standing item (itself and its stack), the baggage bay's
  const baseLoad = {}, baseOf = id => { let p = placed.find(q => q.id === id); while (p && p.on) p = placed.find(q => q.id === p.on); return p ? p.id : id; };
  const bagS = spaces.find(q => q.id === 'baggage');
  let bagKg = 0;
  for (const it of order) {
    // (opts.doors === false: the room alone - "would it fit if it could get in", a report's question)
    const door = o.doors === false ? { ok: true, door: null, how: null } : freightDoorAny(card, it);
    if (!door.ok) { res.unplaced.push({ id: it.id, why: door.why || 'passes no door' }); continue; }
    const cgNow = mx / kg, cgWant = Math.min(Mm.cg[1], Math.max(Mm.cg[0], cgNow));
    const xt = ((kg + it.kg) * cgWant - mx) / Math.max(1e-9, it.kg);
    let best = null;
    for (const strict of (o.limits === false ? [false] : [true, false])) {
      for (const [lx, ly, lz] of frOrients(it)) {
        // x candidates: the whole hold at the pack step, nearest the target first (ties: forward first)
        const xs = [];
        for (let x0 = H.x0; x0 + lx <= xHi + 1e-9; x0 += P.step) xs.push(frR3(x0));
        xs.sort((a, b) => Math.abs(a + lx / 2 - xt) - Math.abs(b + lx / 2 - xt) || a - b);
        // z candidates: the middle outward, at the z step
        const zs = [];
        for (let k = 0; k * P.zStep <= 1.2; k++) { zs.push(frR3(-lz / 2 + k * P.zStep)); if (k) zs.push(frR3(-lz / 2 - k * P.zStep)); }
        let floorHit = false, stackHit = false;
        for (const x0 of xs) {
          if (floorHit) break;                       // a farther x can only score worse
          const x1 = x0 + lx;
          // the floor first, then the top of each stackable item already placed under the whole footprint
          const ys = [];
          const rest = freightRestY(card, x0, x1);
          if (rest != null) ys.push({ y: rest, on: null, level: 0 });
          if (!stackHit) for (const p of placed) if (p.stack && p.at.x0 <= x0 + 1e-9 && p.at.x1 >= x1 - 1e-9) ys.push({ y: p.at.y1, on: p.id, sup: p, level: 1 });
          for (const { y, on, sup, level } of ys) {
            if (level && stackHit) continue;
            const zm = frZMax(card, x0, x1, y, y + ly);
            if (zm < lz / 2 - 1e-8) continue;          // not even the middle is wide enough here
            for (const z0 of zs) {
              const z1 = z0 + lz;
              if (Math.max(-z0, z1) > zm + 1e-8) continue;   // the hold's walls (freightHoldFits, at this x and y)
              if (sup && (z0 < sup.at.z0 - 1e-9 || z1 > sup.at.z1 + 1e-9)) continue;   // wholly on its support
              const b = { x0, x1: frR3(x1), y0: y, y1: y + ly, z0, z1: frR3(z1) };
              if (obst.some(q => frOverlap(b, q)) || placed.some(q => frOverlap(b, q.at))) continue;
              const cand = { id: it.id, kind: it.kind, kg: it.kg, dims: it.dims, stack: it.stack && FREIGHT_KINDS[it.kind].stack,
                             at: { x0: frR3(b.x0), x1: frR3(b.x1), y0: frR3(b.y0), y1: frR3(b.y1), z0: frR3(b.z0), z1: frR3(b.z1) },
                             on, door: door.door, how: door.how };
              if (strict) {
                // the floor under it (or under the item at the bottom of its stack) and the baggage placard, kept
                // incrementally: the same numbers freightReport states
                const baseId = on ? baseOf(on) : it.id;
                const bp = on ? placed.find(q => q.id === baseId) : cand;
                const A = (bp.at.x1 - bp.at.x0) * (bp.at.z1 - bp.at.z0);
                const S = spaces.find(q => q.id === frSpaceOf(spaces, 0.5 * (bp.at.x0 + bp.at.x1)));
                if (S && ((baseLoad[baseId] || 0) + it.kg) / A > S.kgM2 + 1e-9) continue;
                const inBag = frSpaceOf(spaces, 0.5 * (b.x0 + b.x1)) === 'baggage';
                if (inBag && bagS && bagKg + it.kg > (bagS.maxKg || 0) + 1e-9) continue;
              }
              // the score: on the floor before stacked, LOW (its middle's height, to the cell), near the target
              // station, near the middle - compared in that order, a tie keeping the first candidate
              const sc = [level, Math.round((0.5 * ly + b.y0 - H.y0) / H.dy), frR3(Math.abs(0.5 * (b.x0 + b.x1) - xt)), frR3(Math.abs(0.5 * (b.z0 + b.z1)))];
              let better = !best;
              for (let k = 0; !better && k < sc.length; k++) { if (sc[k] < best.sc[k] - 1e-9) better = true; else if (sc[k] > best.sc[k] + 1e-9) break; }
              if (better) best = { sc, cand };
              if (level) stackHit = true; else floorHit = true;
              break;    // the nearest z at this x and this level
            }
          }
        }
      }
      if (best) break;
    }
    if (!best) { res.unplaced.push({ id: it.id, why: it.id + ' (' + it.dims.join(' x ') + ' m) finds no room in the hold' }); continue; }
    best.cand.space = frSpaceOf(spaces, 0.5 * (best.cand.at.x0 + best.cand.at.x1));
    placed.push(best.cand);
    const bId = best.cand.on ? baseOf(best.cand.on) : it.id;
    baseLoad[bId] = (baseLoad[bId] || 0) + it.kg;
    if (best.cand.space === 'baggage') bagKg += it.kg;
    kg += it.kg; mx += it.kg * 0.5 * (best.cand.at.x0 + best.cand.at.x1);
  }
  res.placed = placed;
  res.ok = res.unplaced.length === 0;
  res.report = freightReport(card, placed, o);
  return res;
}

// ---- WHAT A DESIGN CAN CARRY (the contracts' physical gate gains the volume) --------------------------------------
// freightFits(card, items, {pax}) -> { ok, seatsOut, why, room }: the load has a LEGAL loading on this design -
// every item through a door, the whole load packed with the passengers seated, and the packer's proposal within
// every limit (the MTOW, the certified CG range, the floors, the baggage placard) - with the seats in, else with
// the empty seats taken out (the player's call, ruled). `room` says whether it fits at all (the geometry), so a
// caller can tell "no room" from "only out of limits". Memoised by the load and the passengers.
const frFitMemo = new Map();
function freightFits(card, items, opts) {
  const pax = Math.max(0, (opts && opts.pax) | 0);
  const its = freightSplit(items);
  if (!its.length) return { ok: true, seatsOut: [], why: '', room: true };
  if (!card || !card.hold) return { ok: false, seatsOut: [], why: 'no hold', room: false };
  const key = (card.id || JSON.stringify(card.mass)) + '|' + pax + '|' + its.map(i => i.id + ':' + i.kind + ':' + i.kg + ':' + i.dims.join(',')).sort().join(';');
  if (frFitMemo.has(key)) return frFitMemo.get(key);
  let r;
  const nd = its.filter(it => !freightDoorAny(card, it).ok);
  if (nd.length) r = { ok: false, seatsOut: [], why: nd.map(i => i.id).join(', ') + ' (' + nd[0].dims.join(' x ') + ' m) passes no door', room: false };
  else {
    const empty = (card.seats || []).filter(s => s.i > pax).map(s => s.i);
    const tries = empty.length ? [[], empty] : [[]];
    let room = false, why = '';
    for (const out of tries) {
      const a = freightPack(card, its, { pax, seatsOut: out });
      if (a.ok) room = true;
      if (a.ok && a.report.ok) { r = { ok: true, seatsOut: out, why: '', room: true }; break; }
      why = a.ok ? 'loaded only out of limits: ' + a.report.why.join('; ') : a.unplaced.map(u => u.why).join('; ');
    }
    if (!r) r = { ok: false, seatsOut: empty, why, room };
  }
  frFitMemo.set(key, r);
  return r;
}
// a design row (CONTRACT_DESIGNS) -> its card, or null (no card measured: the volume is not known)
const freightCardOf = D => (D && D.id && typeof FREIGHT_CARDS !== 'undefined' && FREIGHT_CARDS[D.id]) || null;
// the items a sub carries (a job's own list; an authored load's kilos as boxes)
function freightSubItems(sub, rec) {
  if (!sub || !sub.load) return [];
  if (Array.isArray(sub.load.items)) return freightSplit(sub.load.items);
  return freightItems(sub.load, rec && rec.goods);
}

// ---- THE MAP'S MARK (§R.2: ✓ / ✗ only for the hard no-no's; build contracts carry no mark) ------------------------
// rec (a contract record) + the fleet's designs ([{ slot, design: CONTRACT_DESIGNS row | null, card }]) ->
//   { ok: true | false | null, gear: {ok, why}, door: {ok, why, items} }
// gear: some airframe's gear uses both ends of every flying sub (water vs wheels, land vs floats-only);
// door: every item passes some door of one airframe that also takes the gear (THE HARD NO-NO: an item that passes
// no door of any of your planes). null when nothing about the fleet is known; a build contract -> null.
function freightMark(rec, fleet, fields) {
  if (!rec || rec.kind === 'build') return null;
  const F = fields || CONTRACT_FIELDS;
  const subs = [].concat(...((rec.stages || []).map(st => st.subs || [])));
  const ends = [];
  for (const s of subs) for (const k of ['from', 'to']) if (s[k] && F[s[k]] && (s.do === 'carry' || s.do === 'fly' || s.do === 'land' || (s.do === 'survey' && k === 'from'))) ends.push(F[s[k]]);
  const items = [].concat(...subs.map(s => freightSubItems(s, rec)));
  const known = (fleet || []).filter(f => f && f.design);
  if (!known.length) return { ok: null, gear: { ok: null, why: 'no airframe with a certificate' }, door: { ok: null, why: '', items: [] } };
  const gearOk = f => ends.every(e => contractGearOk(f.design.gear, e));
  const gearers = known.filter(gearOk);
  const gear = gearers.length ? { ok: true, why: '' }
    : { ok: false, why: 'no airframe of yours uses ' + ends.filter((e, i, a) => a.indexOf(e) === i).map(e => e.name + ' (' + e.surf + ')').join(', ') };
  let door = { ok: true, why: '', items: [] };
  if (items.length) {
    const pool = gearers.length ? gearers : known;
    const cards = pool.map(f => f.card || freightCardOf(f.design));
    if (cards.some(c => !c)) {
      door = cards.some(c => c && !freightNoDoor(c, items).length) ? { ok: true, why: '', items: [] } : { ok: null, why: 'a hold not measured yet', items: [] };
    } else {
      const bad = items.filter(it => cards.every(c => !freightDoorAny(c, it).ok)).map(it => it.id);
      // the same airframe must take every item through its doors
      const one = cards.some(c => !freightNoDoor(c, items).length);
      door = one ? { ok: true, why: '', items: [] }
        : { ok: false, items: bad.length ? bad : items.map(i => i.id),
            why: 'no door fits: ' + (bad.length ? bad.join(', ') : 'no one airframe of yours takes every item through its doors') };
    }
  }
  return { ok: gear.ok === false || door.ok === false ? false : (gear.ok && door.ok) ? true : null, gear, door };
}

// FREIGHT_CARDS-BEGIN (written by `node tools/_freight_site.js --write`; GATE FREIGHT re-measures each from its build)
const FREIGHT_CARDS = {
  cub: {"v":1,"id":"cub","label":"Cub","hold":{"x0":0.3,"dx":0.1,"n":24,"y0":-0.35,"dy":0.05,"ny":21,"floor":[5,5,4,4,4,3,3,3,3,4,5,6,7,7,8,9,10,11,12,12,13,14,15,15,16],"half":[[0,33,33,33,33,33,32,32,32,31,31,30,30,29,29,28,28,27,27,7,0],[33,33,33,33,33,33,33,32,32,31,31,30,30,29,29,28,28,27,27,7,0],[33,33,33,33,33,33,33,33,32,31,31,30,30,29,29,28,28,27,27,7,0],[33,33,33,33,33,33,33,33,32,32,31,31,30,29,29,28,28,27,27,7,0],[33,33,33,33,33,33,33,33,32,32,31,31,30,30,29,28,28,27,27,7,0],[34,34,34,33,33,33,33,33,33,32,32,31,30,30,29,29,28,27,27,7,0],[34,34,34,34,34,34,34,34,33,32,32,31,31,30,29,29,28,27,27,7,0],[34,34,34,34,34,34,34,34,34,33,32,32,31,30,30,29,28,27,27,7,0],[34,34,34,34,34,34,34,34,34,33,32,32,31,30,29,29,28,27,27,7,0],[34,34,34,34,34,34,34,34,34,33,32,31,31,30,29,29,28,27,26,7,0],[34,34,34,34,34,34,34,34,34,33,32,31,31,30,29,28,28,27,9,7,0],[0,34,34,34,34,34,34,34,34,33,32,31,31,30,29,28,28,27,7,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,30,29,28,27,26,7,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,29,29,28,27,0,0,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,29,28,28,27,7,0,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,29,28,27,26,0,0,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,29,28,27,0,0,0,0,0],[0,0,34,34,34,34,34,34,34,33,32,31,30,29,28,27,0,0,0,0,0],[0,0,34,34,34,34,34,34,34,33,32,31,30,28,27,23,7,0,0,0,0],[0,0,34,34,34,34,34,34,34,32,31,30,29,28,27,7,0,0,0,0,0],[0,0,34,34,34,34,34,34,34,32,31,30,29,28,27,7,0,0,0,0,0],[0,0,33,33,33,33,33,33,32,31,30,29,28,27,26,7,0,0,0,0,0],[0,0,32,32,32,32,32,32,31,30,29,28,27,26,25,7,0,0,0,0,0],[0,0,0,30,30,30,30,30,30,29,28,27,26,25,24,0,0,0,0,0,0],[0,0,0,29,29,29,29,29,29,28,27,26,25,24,23,6,0,0,0,0,0]]},"cabinX1":2.304,"seats":[{"i":0,"x":0.62,"back":0.82,"row":0,"z":0,"w":0.5},{"i":1,"x":2.003,"back":2.203,"row":1,"z":0,"w":0.5}],"doors":[{"id":"pilot:M","side":-1,"x0":0.031,"x1":0.989,"y0":-0.53,"y1":0.561,"rects":[[0.916,0.1],[0.916,0.22],[0.916,0.36],[0.916,0.48],[0.831,0.66],[0.737,0.78],[0.627,0.92],[0.534,1.04]],"st":2},{"id":"pilot:P","side":1,"x0":0.031,"x1":0.989,"y0":-0.53,"y1":0.561,"rects":[[0.916,0.1],[0.916,0.22],[0.916,0.36],[0.916,0.48],[0.831,0.66],[0.737,0.78],[0.627,0.92],[0.534,1.04]],"st":2}],"mass":{"mtow":556.195,"base":{"kg":466.195,"x":0.637},"cg":[0.637,0.921],"mac":[0.285,1.7],"bagKg":10,"seats":2}},
  jodel: {"v":1,"id":"jodel","label":"Jodel","hold":{"x0":0.2,"dx":0.1,"n":19,"y0":-0.35,"dy":0.05,"ny":19,"floor":[4,4,4,3,3,2,2,2,7,10,11,12,13,13,14,15,16,17,18,18],"half":[[49,49,49,49,48,48,48,48,47,44,40,37,34,31,28,24,21,0,0],[49,49,49,49,49,48,48,48,46,43,40,37,34,31,27,24,21,0,0],[49,49,49,49,49,48,48,48,46,43,40,37,34,31,27,24,21,0,0],[49,49,49,49,49,48,48,48,46,43,40,37,34,31,27,24,21,6,0],[49,49,49,49,49,49,48,48,46,43,40,37,34,30,27,24,21,6,0],[49,49,49,49,49,49,49,48,46,43,40,37,34,31,28,24,21,0,0],[50,50,50,50,50,49,49,49,46,43,40,37,34,31,28,25,22,6,0],[51,51,51,50,50,50,50,50,49,48,46,45,43,41,39,34,25,0,0],[0,50,50,50,50,50,50,50,49,48,46,45,43,41,38,34,24,6,0],[0,0,49,49,49,49,49,49,48,46,45,44,42,40,37,33,22,6,0],[0,0,47,47,47,47,47,47,46,45,44,42,41,38,36,31,18,6,0],[0,0,46,46,46,46,46,46,45,43,42,41,39,37,34,29,13,5,0],[0,0,44,44,44,44,44,44,43,42,41,39,38,36,33,27,8,5,0],[0,0,43,43,43,43,43,42,42,40,39,38,36,34,31,25,5,0,0],[0,0,41,41,41,41,41,41,40,39,38,36,35,33,30,23,5,0,0],[0,0,0,40,40,40,40,39,39,37,36,35,33,31,28,21,5,0,0],[0,0,0,38,38,38,38,38,37,36,35,34,32,30,27,19,5,0,0],[0,0,0,37,37,37,37,36,36,34,33,32,31,28,25,16,4,0,0],[0,0,0,35,35,35,35,35,34,33,32,31,29,27,24,12,4,0,0],[0,0,0,33,33,33,33,33,33,32,31,29,28,26,22,8,0,0,0]]},"cabinX1":1.457,"seats":[{"i":0,"x":0.466,"back":0.666,"row":0,"z":-0.241,"w":0.482},{"i":1,"x":0.466,"back":0.666,"row":0,"z":0.241,"w":0.482}],"doors":[{"id":"pilot:M","side":-1,"x0":0.035,"x1":0.851,"y0":-0.487,"y1":0.401,"rects":[[0.77,0.1],[0.77,0.28],[0.769,0.36],[0.765,0.46],[0.733,0.56],[0.65,0.66],[0.586,0.74],[0.512,0.84]],"st":2},{"id":"pilot:P","side":1,"x0":0.035,"x1":0.851,"y0":-0.487,"y1":0.401,"rects":[[0.77,0.1],[0.77,0.28],[0.769,0.36],[0.765,0.46],[0.733,0.56],[0.65,0.66],[0.586,0.74],[0.512,0.84]],"st":2}],"mass":{"mtow":542.955,"base":{"kg":452.955,"x":0.413},"cg":[0.413,0.479],"mac":[-0.012,1.672],"bagKg":10,"seats":2}},
  c172: {"v":1,"id":"c172","label":"metal Cessna","hold":{"x0":0.2,"dx":0.1,"n":29,"y0":-0.4,"dy":0.05,"ny":24,"floor":[6,5,5,4,4,3,2,1,1,1,1,1,1,1,1,1,1,1,2,2,3,3,4,4,5,5,5,5,6,6],"half":[[0,52,52,53,53,54,54,54,54,54,54,53,51,49,48,46,44,42,40,39,37,35,10,0],[0,52,53,53,54,54,54,54,54,54,54,53,51,50,48,46,44,42,40,39,37,35,10,0],[52,52,53,53,54,54,54,54,54,54,54,53,52,50,48,46,44,42,40,39,37,35,10,0],[52,52,53,53,54,54,54,54,55,55,54,54,52,50,48,46,44,42,41,39,37,35,10,0],[52,52,53,53,54,54,54,55,55,55,55,54,52,50,48,46,44,42,41,39,37,35,10,0],[52,52,53,54,54,54,55,55,55,55,55,54,52,50,48,46,44,43,41,39,37,35,10,0],[52,53,53,54,54,55,55,55,55,55,55,54,52,50,49,47,45,43,41,39,37,35,10,0],[52,53,54,54,55,55,55,55,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[52,53,54,54,54,55,55,55,56,56,55,55,54,54,53,53,52,51,51,49,45,0,0,0],[51,52,52,53,53,54,54,54,54,54,54,54,53,52,52,51,50,49,47,38,10,0,0,0],[50,50,51,51,52,52,53,53,53,53,53,52,52,51,50,50,48,45,0,0,0,0,0,0],[48,49,50,50,51,51,51,51,52,52,51,51,50,49,48,47,41,10,0,0,0,0,0,0],[47,48,48,49,49,50,50,50,50,51,50,49,49,47,45,9,0,0,0,0,0,0,0,0],[46,46,47,48,48,48,49,49,49,49,49,48,46,43,9,0,0,0,0,0,0,0,0,0],[45,45,46,46,47,47,47,48,48,48,47,45,32,0,0,0,0,0,0,0,0,0,0,0],[44,44,45,45,46,46,46,46,47,47,45,9,0,0,0,0,0,0,0,0,0,0,0,0],[43,43,44,45,45,45,46,46,46,46,44,9,0,0,0,0,0,0,0,0,0,0,0,0],[0,42,43,43,44,44,44,45,45,45,43,8,0,0,0,0,0,0,0,0,0,0,0,0],[0,41,42,42,43,43,43,43,44,44,41,8,0,0,0,0,0,0,0,0,0,0,0,0],[0,40,40,41,41,42,42,42,42,42,40,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,38,39,40,40,40,41,41,41,41,38,0,0,0,0,0,0,0,0,0,0,0,0,0]]},"cabinX1":1.848,"seats":[{"i":0,"x":0.499,"back":0.699,"row":0,"z":-0.272,"w":0.5},{"i":1,"x":0.499,"back":0.699,"row":0,"z":0.272,"w":0.5},{"i":2,"x":1.523,"back":1.723,"row":1,"z":-0.279,"w":0.5},{"i":3,"x":1.523,"back":1.723,"row":1,"z":0.279,"w":0.5}],"doors":[{"id":"pilot:M","side":-1,"x0":0.035,"x1":0.949,"y0":-0.507,"y1":0.591,"rects":[[0.869,0.1],[0.869,0.22],[0.869,0.34],[0.858,0.58],[0.781,0.68],[0.69,0.8],[0.598,0.92],[0.508,1.04]],"st":3},{"id":"pilot:P","side":1,"x0":0.035,"x1":0.949,"y0":-0.507,"y1":0.591,"rects":[[0.869,0.1],[0.869,0.22],[0.869,0.34],[0.858,0.58],[0.781,0.68],[0.69,0.8],[0.598,0.92],[0.508,1.04]],"st":3}],"mass":{"mtow":1043.41,"base":{"kg":763.41,"x":0.806},"cg":[0.806,0.944],"mac":[0.336,1.68],"bagKg":40,"seats":4}},
  c172f: {"v":1,"id":"c172f","label":"Cessna floats","hold":{"x0":0.2,"dx":0.1,"n":29,"y0":-0.4,"dy":0.05,"ny":24,"floor":[6,5,5,4,4,3,2,1,1,1,1,1,1,1,1,1,1,1,2,2,3,3,4,4,5,5,5,5,6,6],"half":[[0,52,52,53,53,54,54,54,54,54,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,52,53,53,54,54,54,54,54,54,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,52,53,53,54,54,54,54,54,54,54,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,52,53,53,54,54,54,54,55,55,54,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,52,53,53,54,54,54,55,55,55,55,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,52,53,54,54,54,55,55,55,55,55,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,53,53,54,54,55,55,55,55,55,55,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,53,54,54,55,55,55,55,56,56,56,56,0,0,0,0,0,0,0,0,0,0,0,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[52,53,54,54,54,55,55,55,56,56,55,55,55,54,54,53,53,52,51,49,45,0,0,0],[51,52,52,53,53,54,54,54,54,54,54,54,53,53,52,52,51,49,47,38,10,0,0,0],[50,50,51,51,52,52,53,53,53,53,53,52,52,51,51,50,48,45,0,0,0,0,0,0],[48,49,50,50,51,51,51,51,52,52,51,51,50,49,48,47,41,10,0,0,0,0,0,0],[47,48,48,49,49,50,50,50,50,51,50,49,49,47,45,9,0,0,0,0,0,0,0,0],[46,46,47,48,48,48,49,49,49,49,49,48,46,43,9,0,0,0,0,0,0,0,0,0],[45,45,46,46,47,47,47,48,48,48,47,45,32,0,0,0,0,0,0,0,0,0,0,0],[44,44,45,45,46,46,46,46,47,47,45,9,0,0,0,0,0,0,0,0,0,0,0,0],[43,43,44,45,45,45,46,46,46,46,44,9,0,0,0,0,0,0,0,0,0,0,0,0],[0,42,43,43,44,44,44,45,45,45,43,8,0,0,0,0,0,0,0,0,0,0,0,0],[0,41,42,42,43,43,43,43,44,44,41,8,0,0,0,0,0,0,0,0,0,0,0,0],[0,40,40,41,41,42,42,42,42,42,40,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,38,39,40,40,40,41,41,41,41,38,0,0,0,0,0,0,0,0,0,0,0,0,0]]},"cabinX1":1.848,"seats":[{"i":0,"x":0.499,"back":0.699,"row":0,"z":-0.272,"w":0.5},{"i":1,"x":0.499,"back":0.699,"row":0,"z":0.272,"w":0.5},{"i":2,"x":1.523,"back":1.723,"row":1,"z":-0.279,"w":0.5},{"i":3,"x":1.523,"back":1.723,"row":1,"z":0.279,"w":0.5}],"doors":[{"id":"pilot:M","side":-1,"x0":0.035,"x1":0.949,"y0":-0.507,"y1":0.591,"rects":[[0.869,0.1],[0.869,0.22],[0.869,0.34],[0.858,0.58],[0.781,0.68],[0.69,0.8],[0.598,0.92],[0.508,1.04]],"st":3},{"id":"pilot:P","side":1,"x0":0.035,"x1":0.949,"y0":-0.507,"y1":0.591,"rects":[[0.869,0.1],[0.869,0.22],[0.869,0.34],[0.858,0.58],[0.781,0.68],[0.69,0.8],[0.598,0.92],[0.508,1.04]],"st":3}],"mass":{"mtow":1178.699,"base":{"kg":898.186,"x":0.896},"cg":[0.896,0.997],"mac":[0.336,1.68],"bagKg":40,"seats":4}},
  twinf: {"v":1,"id":"twinf","label":"twin floatplane","hold":null,"cabinX1":1.546,"seats":[{"i":0,"x":0.491,"back":0.691,"row":0,"z":0,"w":0.5}],"doors":[],"mass":{"mtow":471.728,"base":{"kg":475.416,"x":0.946},"cg":[0.946,0.97],"mac":[0.483,1.5],"bagKg":0,"seats":1}},
};
// FREIGHT_CARDS-END
