// ===========================================================================
// FREIGHT-STRAP (G2400-G2404) — THE ACCEPTED LOAD, STRAPPED: POINT MASSES IN THE SIM, PROPS WITH STRAPS IN THE CABIN.
// futureDesigns/game/FREIGHT-2026-10-07.md §2 (the user, 7 Oct: "an automatic [placement] will be proposed, and the
// load will be strapped visually and physically once accepted"); RULED: no load failure (no shifting, no breaking
// free), no loading time or crew.
//
// FREIGHT-LOAD (77_) accepts a placement into `career.load` (or the sandbox's bare record); `freightAccepted` hands it
// over: every item's box and centre `c` in THE CARD'S FRAME - x m aft of the windscreen-base ring (the gen frame's x
// datum, def.nodes' x), z the lateral (the cage's x: def.nodes' z), y THE CAGE SHEET'S metres, whose datum is NOT
// def.nodes': the join's keel datum yD lies between them (_cage_join.js G389: cage y = gen y + yD, published as
// window.CAGE_DATUM). This file turns it into:
//
//   THE MASSES   freightStrapAdds(def, acc, { yD }) -> [[node, kg], ...] for the solver's door (30_ sim.setFreight):
//                - each item a POINT MASS at its box's centre, shared over the eight nodes of the two fuselage rings
//                  round it - by lever along x, between each ring's bottom and top pair in y, between its left and
//                  right node in z - so the eight shares' moment is the point's own (exact inside the box the rings
//                  span, clamped at its faces) and the inertia follows from where the nodes are, as the crew's and
//                  the fuel's do;
//                - A JOB'S PASSENGERS ARE THE OCCUPANTS: the seats the loading view seated (the pilot, seats 1..pax)
//                  against the seats the build fills (S.occupied, else the first S.occupants) - a seat the job fills
//                  and the build does not takes GEN_RULES.occupantKg at its station, a seat the build fills and the
//                  job does not gives it back, both billed by the frame's OWN rule for a seated occupant (61_'s
//                  straddle + billAt, copied below statement for statement: a passenger added here weighs exactly
//                  what the build would have billed for them);
//                - THE BAGGAGE ALLOWANCE OFF while items ride (FREIGHT-MODEL's note: the packer's base has none - the
//                  allowance IS the freight): the frame's own cargo-section billing of S.baggage, negated.
//                Nothing accepted -> null, and the solver is never asked: the sim is byte-identical (GATE FREIGHT).
//   THE DRAWING  freightStrapStacks / freightStrapBands / freightStrapMesh: the stacks (an item on the floor and
//                whatever stands on it), a ratchet strap over each stack lengthwise and one across, anchored to the
//                floor at both ends, a buckle on the cross strap's side, an anchor plate at each foot - plain arrays in
//                the card's frame (positions, normals, indices) that the page wraps (src/viewer/freight_strap.js) and
//                a node gate can check (outside every box, the feet on the floor, inside the hold's length).
//   THE STOP     freightStrapNext(doc, slot, card): after a stop the delivered stage's record is gone
//                (77_ freightLoadSettle); the next stage's items arrive PLACED BY THE PACKER'S PROPOSAL (accepted into
//                career.load) unless the player's own placement for that very sub and airframe is already there.
//
// Pure: no DOM, storage, clock or random. Reads 61_'s def.parts (ST, F), 76_ (FREIGHT_CARDS, freightRestY,
// freightKg), 77_ (freightAccepted, freightLoadJob, freightLoadNew, freightLoadAccept).
// ===========================================================================
const FREIGHT_STRAP_V = 1;

// ---- THE LOOK: which model an item wears (FREIGHT-ASSETS' props), else a box in its kind's colour ------------------
// freight_load.js's own table (G2346), held here so the loading view and the strapped load draw the same thing
const FREIGHT_LOOK = {
  goods: { 'goods.parts': 'crate_wood_a', 'goods.tools': 'toolchest_metal', 'goods.samples': 'load_crate_samples',
           'goods.water': 'box_cardboard', 'goods.supplies': 'load_bag_cement' },
  kind: { crate: 'crate_wood_a', box: 'box_cardboard', drum: 'drum_steel' },
  col: { crate: 0xa77a48, box: 0xc9a46b, bag: 0x9d8f6a, drum: 0x5d6f7d, long: 0x77787a, bulk: 0xb9ab8a, stretcher: 0xd8d8d0 },
};
// an item's goods word off its id: 'parts.2' -> goods.parts; a later leg's 'leg2.mail.1' -> goods.mail (G2430)
function freightLookGoods(it) {
  return 'goods.' + String((it && it.id) || '').replace(/^leg\d+\./, '').replace(/\.\d+$/, '');
}
function freightLookKey(it) {
  return FREIGHT_LOOK.goods[freightLookGoods(it)] || FREIGHT_LOOK.kind[it && it.kind] || null;
}

// ---- THE STRAP'S SIZES (metres): a 35 mm ratchet strap 3 mm thick standing 6 mm off the load, its feet 6 cm out ----
const FREIGHT_STRAP = { w: 0.035, t: 0.003, gap: 0.006, foot: 0.06, rise: 0.012,
                        buckle: [0.06, 0.11, 0.035], anchor: [0.07, 0.012, 0.05] };

const fsClamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---- THE FRAME: the card's y -> the gen frame's --------------------------------------------------------------------
// With the join's keel datum: y - yD, exactly (the same map the join builds the spec's stations with). Without one (a
// node rig that never joined): the box keeps its height over the hold's floor, set on the gen frame's own floor - the
// two rings' bottom longerons at that station (the floorboards' stand-off off: a few cm of CG height, nothing in x).
function fsGenFloorY(def, x) {
  const P = def.parts, ST = P.ST, F = P.F, N = def.nodes;
  const yb = r => 0.5 * (N[F[r].BL].p[1] + N[F[r].BR].p[1]);
  if (x <= ST[0].x) return yb(0);
  for (let i = 0; i + 1 < ST.length; i++)
    if (x <= ST[i + 1].x) { const w = (x - ST[i].x) / Math.max(1e-9, ST[i + 1].x - ST[i].x); return yb(i) + (yb(i + 1) - yb(i)) * w; }
  return yb(ST.length - 1);
}
function freightStrapGenY(def, card, x, y, yD) {
  if (typeof yD === 'number' && isFinite(yD)) return y - yD;
  const H = card && card.hold;
  if (!H) return y;
  const i = Math.max(0, Math.min(H.n, Math.round((x - H.x0) / H.dx)));
  return fsGenFloorY(def, x) + (y - (H.y0 + H.floor[i] / 100));
}

// ---- A POINT MASS ON THE RINGS (the items) -------------------------------------------------------------------------
// -> [[node, kg] x 8]: the two rings round x by lever, each ring's bottom / top pair by height, each pair's left / right
// node by the lateral - every weight from the nodes' own positions, so sum(share x node) = kg x the point inside them
function freightStrapShares(def, x, y, z, kg) {
  const P = def.parts, ST = P.ST, F = P.F, N = def.nodes, out = [];
  const last = ST.length - 1;
  let r0 = 0, r1 = 0, wa = 0;
  if (x <= ST[0].x) { r0 = r1 = 0; }
  else if (x >= ST[last].x) { r0 = r1 = last; }
  else {
    for (let i = 0; i < last; i++) if (ST[i].x <= x) r0 = i;
    r1 = r0 + 1;
    wa = (x - ST[r0].x) / Math.max(1e-9, ST[r1].x - ST[r0].x);
  }
  const ring = (r, w) => {
    if (!(w > 0)) return;
    const R = F[r];
    const yB = 0.5 * (N[R.BL].p[1] + N[R.BR].p[1]), yT = 0.5 * (N[R.TL].p[1] + N[R.TR].p[1]);
    const wy = fsClamp01((y - yB) / Math.max(1e-9, yT - yB));
    const pair = (L, Rn, wl) => {
      if (!(wl > 0)) return;
      const zl = N[L].p[2], zr = N[Rn].p[2];
      const wz = fsClamp01((z - zl) / ((zr - zl) || 1e-9));
      out.push([L, kg * w * wl * (1 - wz)], [Rn, kg * w * wl * wz]);
    };
    pair(R.BL, R.BR, 1 - wy);
    pair(R.TL, R.TR, wy);
  };
  if (r0 === r1) ring(r0, 1);
  else { ring(r0, 1 - wa); ring(r1, wa); }
  return out;
}

// ---- THE FRAME'S OWN SEAT RULE (61_gen_frame.js section 'cabin', copied; GATE FREIGHT holds it to the build's) -----
function fsStraddle(ST, F, x) {
  let f = 0;
  for (let i = 0; i < ST.length; i++) if (ST[i].x < x - 0.05) f = i;
  let a = Math.min(F.length - 1, f + 1);
  for (let i = 0; i < ST.length; i++) if (ST[i].x > x + 0.05) { a = i; break; }
  return [f, Math.max(a, Math.min(f + 1, F.length - 1))];
}
function fsBillAt(def, x, m, out) {
  const ST = def.parts.ST, F = def.parts.F;
  const [f, a] = fsStraddle(ST, F, x);
  if (f === a || !F[a]) { out.push([F[f].BL, 0.5 * m], [F[f].BR, 0.5 * m]); return; }
  const x0 = ST[f].x, x1 = ST[a].x;
  const wa = Math.max(0, Math.min(1, (x - x0) / Math.max(1e-6, x1 - x0)));
  out.push([F[f].BL, 0.5 * m * (1 - wa)], [F[f].BR, 0.5 * m * (1 - wa)], [F[a].BL, 0.5 * m * wa], [F[a].BR, 0.5 * m * wa]);
}
const FS_SEAT_ROWS = { single: [1], tandem2: [1, 2], side2: [1, 1], side4: [1, 1, 2, 2], tandem4: [1, 1, 2, 2], drone: [] };
// one occupant of seat i (m = +occupantKg aboard, -occupantKg gone), as the frame bills them
function fsSeatBill(def, i, m, out) {
  const S = def.spec, F = def.parts.F;
  const seatsX = Array.isArray(S.cab && S.cab.seatsX) ? S.cab.seatsX : null;
  const sx = (seatsX && typeof seatsX[i] === 'number') ? seatsX[i] : null;
  if (sx != null) { fsBillAt(def, sx, m, out); return; }
  const seatRows = FS_SEAT_ROWS[S.seating] || [1, 1];
  const abreast = /^side|^tandem4/.test(S.seating || '') ? 2 : 1;
  const ri = seatRows[i] != null ? Math.min(seatRows[i], F.length - 1) : Math.min(1 + Math.floor(i / abreast), F.length - 1);
  const rg = F[ri] || F[1];
  out.push([rg.BL, m / 2], [rg.BR, m / 2]);
}
// the seats: who the build seats (61_'s rule: S.occupied, else the first S.occupants) and who the job seats (the pilot,
// then seats 1..pax - 77_'s rule: "a passenger sits in seat i" for i <= pax) -> [{ i, build, job }]
function freightStrapSeats(spec, pax) {
  const S = spec || {};
  const occ = Array.isArray(S.occupied) ? S.occupied : null;
  const aboard = S.occupants != null ? S.occupants : (S.crew != null ? S.crew : 1);
  const nSeats = occ ? occ.length : aboard;
  const n = Math.max(nSeats, (pax | 0) + 1);
  const out = [];
  for (let i = 0; i < n; i++)
    out.push({ i, build: i < nSeats && (occ ? !!occ[i] : i < aboard), job: i === 0 || i <= (pax | 0) });
  return out;
}

// ---- THE FRAME'S BAGGAGE BILLING (61_ section 'cargo', copied for S.baggage alone) -----------------------------------
function fsBaggageBill(def, kg, out) {
  const S = def.spec, P = def.parts, ST = P.ST, F = P.F, fu = S.fuse || {};
  if (!(kg !== 0)) return;
  if (fu.cargoLen > 1e-6) {
    for (const rg of [F[2], F[3]]) out.push([rg.BL, 0.25 * kg], [rg.BR, 0.25 * kg]);
    return;
  }
  const seatsX = Array.isArray(S.cab && S.cab.seatsX) ? S.cab.seatsX : null;
  const boxRear = fu.boxRear;
  const lastSeat = seatsX && seatsX.length ? Math.max(...seatsX.filter(v => typeof v === 'number')) : null;
  const boxX = ST.reduce((m, s) => (s.x <= boxRear + 1e-6 ? Math.max(m, s.x) : m), 0);
  if (lastSeat != null && isFinite(lastSeat) && lastSeat < boxX) fsBillAt(def, 0.5 * (lastSeat + boxX), kg, out);
  else {
    const bi = ST.findIndex(s => Math.abs(s.x - boxX) < 1e-6);
    const bag = F[bi >= 0 ? bi : Math.min(3, F.length - 1)];
    out.push([bag.BL, 0.5 * kg], [bag.BR, 0.5 * kg]);
  }
}

// the frame's rules as lists, for the gate (one occupant in seat i; the baggage allowance's kilos)
function freightStrapSeatBill(def, i, m) { const out = []; fsSeatBill(def, i, m, out); return out; }
function freightStrapBaggage(def, kg) { const out = []; fsBaggageBill(def, kg, out); return out; }

// ---- THE MASSES ---------------------------------------------------------------------------------------------------
// def: the build that flies (buildGen's); acc: freightAccepted's (or null); o: { yD (the join's keel datum), card }
// -> null (nothing aboard: the solver is not asked) or
//    { v, adds: [[node, kg]] by node, items: [{ id, kg, g: [x, y, z] gen }], seats: [{ i, build, job, kg }], baggageOff,
//      kg (the items'), dm (the adds' sum), mom: [x, y, z] (the adds' first moment about the gen origin) }
function freightStrapAdds(def, acc, o) {
  o = o || {};
  if (!def || !def.parts || !def.parts.F || !acc || !Array.isArray(acc.items)) return null;
  const card = o.card || (acc.design && typeof FREIGHT_CARDS !== 'undefined' ? FREIGHT_CARDS[acc.design] : null) || null;
  const raw = [], items = [];
  for (const p of acc.items) {
    if (!p || !(p.kg > 0)) continue;
    const c = p.c || (p.at ? [0.5 * (p.at.x0 + p.at.x1), 0.5 * (p.at.y0 + p.at.y1), 0.5 * (p.at.z0 + p.at.z1)] : null);
    if (!c) continue;
    const g = [c[0], freightStrapGenY(def, card, c[0], c[1], o.yD), c[2]];
    for (const s of freightStrapShares(def, g[0], g[1], g[2], p.kg)) raw.push(s);
    items.push({ id: p.id, kind: p.kind, kg: p.kg, g });
  }
  // the passengers: the job's seats against the build's
  const occKg = (typeof GEN_RULES !== 'undefined' && GEN_RULES.occupantKg) || 80;
  const seats = freightStrapSeats(def.spec, acc.pax | 0).map(s => {
    const d = (s.job ? 1 : 0) - (s.build ? 1 : 0);
    if (d) fsSeatBill(def, s.i, d * occKg, raw);
    return { i: s.i, build: s.build, job: s.job, kg: d * occKg };
  });
  // the baggage allowance comes off while items ride
  const bag = items.length && def.spec.baggage > 0 ? def.spec.baggage : 0;
  if (bag) fsBaggageBill(def, -bag, raw);
  if (!raw.length) return null;
  const by = new Map();
  for (const [i, kg] of raw) by.set(i, (by.get(i) || 0) + kg);
  const adds = [...by.entries()].filter(e => e[1] !== 0).sort((a, b) => a[0] - b[0]);
  let dm = 0;
  const mom = [0, 0, 0];
  for (const [i, kg] of adds) { dm += kg; const q = def.nodes[i].p; mom[0] += kg * q[0]; mom[1] += kg * q[1]; mom[2] += kg * q[2]; }
  return { v: FREIGHT_STRAP_V, adds, items, seats, baggageOff: bag, kg: items.reduce((a, it) => a + it.kg, 0), dm, mom };
}

// ---- THE LIMITS SAID, NEVER REFUSED ----------------------------------------------------------------------------------
// The user (FREIGHT §2): out of range is "shown red but allowed (the aeroplane flies what you loaded, and you find
// out)". So a load over the plaque's MTOW or with its CG outside the certified range is never flown SILENTLY: these
// flags go on the flight's brief before take-off and on the logbook row - and the masses go aboard all the same.
// acc: freightAccepted's (its record's mass and CG are freightReport's, the plaque's frame); card: its hold's card
// -> [{ k: 'mtow', kg, say } | { k: 'cg', side: 'aft' | 'fwd', pct, say }]
function freightStrapFlags(acc, card) {
  const K = card && card.mass;
  if (!acc || !K || !(K.mtow > 0)) return [];
  const out = [];
  if (acc.mass > K.mtow + 1e-6) { const kg = Math.ceil(acc.mass - K.mtow); out.push({ k: 'mtow', kg, say: 'over MTOW by ' + kg + ' kg' }); }
  const x = acc.cg && acc.cg.x, pct = v => (v - K.mac[0]) / K.mac[1] * 100;
  if (typeof x === 'number' && isFinite(x) && Array.isArray(K.cg)) {
    const side = x > K.cg[1] + 1e-6 ? 'aft' : x < K.cg[0] - 1e-6 ? 'fwd' : null;   // (freightReport's tolerances)
    if (side) out.push({ k: 'cg', side, pct: Math.round(pct(x) * 10) / 10,
                         say: 'CG ' + (side === 'aft' ? 'aft' : 'forward') + ' of the certified range (' + pct(x).toFixed(1) + ' % MAC, certified ' + pct(K.cg[0]).toFixed(1) + '-' + pct(K.cg[1]).toFixed(1) + ')' });
  }
  return out;
}

// ---- THE ACCEPTED LOAD FOR THIS AEROPLANE -------------------------------------------------------------------------
// the record that rides THIS airframe (77_ freightAccepted + the slot, as freightStopItems; + the design the hold was
// measured on, when the stand's is known) -> freightAccepted's object, or null
function freightStrapFor(docOrRec, slot, design) {
  const A = typeof freightAccepted === 'function' ? freightAccepted(docOrRec) : null;
  if (!A || !A.items.length && !(A.pax > 0)) return null;
  if (slot != null && A.slot != null && A.slot !== String(slot)) return null;
  if (design && A.design && A.design !== design) return null;
  return A;
}

// ---- THE STACKS AND THE STRAPS (the card's frame) -----------------------------------------------------------------
// the stacks: every item on the floor (on: null, or on what is not aboard) with whatever stands on it, transitively ->
// [{ base, ids, box: { x0..z1 } (the union), floorY (the base's underside) }], in the items' order
function freightStrapStacks(items) {
  const L = (items || []).filter(p => p && p.at);
  const ids = new Set(L.map(p => p.id));
  const out = [];
  for (const b of L) {
    if (b.on && ids.has(b.on)) continue;
    const S = { base: b.id, ids: [b.id], box: Object.assign({}, b.at), floorY: b.at.y0 };
    for (let k = 0; k < S.ids.length; k++)
      for (const q of L) if (q.on === S.ids[k] && S.ids.indexOf(q.id) < 0) {
        S.ids.push(q.id);
        const a = q.at, B = S.box;
        B.x0 = Math.min(B.x0, a.x0); B.x1 = Math.max(B.x1, a.x1); B.y0 = Math.min(B.y0, a.y0);
        B.y1 = Math.max(B.y1, a.y1); B.z0 = Math.min(B.z0, a.z0); B.z1 = Math.max(B.z1, a.z1);
      }
    out.push(S);
  }
  return out;
}
// one stack's two straps: polylines in a plane (lengthwise at the box's middle z, across at its middle x), each from a
// foot on the floor up to the near top edge, over the top, down to the far foot -> [{ along, at, pts: [[u, y]] }]
// (u = x for 'x', z for 'z'), the buckle (a box: centre, half sizes, the strap's own axes) and the four anchor plates
function freightStrapBands(stack, card) {
  const C = FREIGHT_STRAP, b = stack.box, g = C.gap;
  const floorAt = (x0, x1) => {
    const y = card && card.hold && typeof freightRestY === 'function' ? freightRestY(card, x0, x1) : null;
    return y == null ? stack.floorY : y;
  };
  const xm = 0.5 * (b.x0 + b.x1), zm = 0.5 * (b.z0 + b.z1);
  // the lengthwise feet stay on the hold's measured floor (a stack at the hold's end ties down nearer its face)
  const H = card && card.hold, hx0 = H ? H.x0 : -Infinity, hx1 = H ? H.x0 + H.n * H.dx : Infinity;
  const ax0 = Math.min(b.x0 - g, Math.max(hx0, b.x0 - C.foot)), ax1 = Math.max(b.x1 + g, Math.min(hx1, b.x1 + C.foot));
  const fx0 = floorAt(ax0 - 0.01, ax0 + 0.01), fx1 = floorAt(ax1 - 0.01, ax1 + 0.01);
  const fz = floorAt(xm - 0.01, xm + 0.01);
  const topX = b.y1 + g, topZ = b.y1 + g + C.t + 0.001;     // the cross strap rides over the lengthwise one
  const X = { along: 'x', at: zm, pts: [[ax0, fx0 + C.rise], [b.x0 - g, topX], [b.x1 + g, topX], [ax1, fx1 + C.rise]] };
  const Z = { along: 'z', at: xm, pts: [[b.z0 - C.foot, fz + C.rise], [b.z0 - g, topZ], [b.z1 + g, topZ], [b.z1 + C.foot, fz + C.rise]] };
  // the buckle: on the cross strap's +z side, halfway down, standing off it by its own depth
  const p2 = Z.pts[2], p3 = Z.pts[3];
  const bk = { c: [xm, 0.5 * (p2[1] + p3[1]), 0.5 * (p2[0] + p3[0]) + C.t + C.buckle[2] / 2], h: [C.buckle[0] / 2, C.buckle[1] / 2, C.buckle[2] / 2] };
  // an anchor plate on the floor OUTWARD of its foot (its inner edge at the foot: never under the load), the long side
  // along the strap
  const ha = C.anchor[0] / 2, hb = C.anchor[2] / 2, hy = C.anchor[1] / 2;
  const anchors = [{ c: [ax0 - ha, fx0 + hy, zm], h: [ha, hy, hb] }, { c: [ax1 + ha, fx1 + hy, zm], h: [ha, hy, hb] },
                   { c: [xm, fz + hy, Z.pts[0][0] - ha], h: [hb, hy, ha] }, { c: [xm, fz + hy, Z.pts[3][0] + ha], h: [hb, hy, ha] }];
  return { bands: [X, Z], buckle: bk, anchors };
}

// ---- THE GEOMETRY (plain arrays, the card's frame) ----------------------------------------------------------------
// a box from its centre, three unit axes and half sizes: 24 vertices (flat faces), 36 indices
function fsBoxInto(G, c, ax, ay, az, hx, hy, hz) {
  const base = G.pos.length / 3;
  const F = [[ax, ay, az, hx, hy, hz], [ay, az, ax, hy, hz, hx], [az, ax, ay, hz, hx, hy]];
  for (const [n, u, v, hn, hu, hv] of F) for (const s of [1, -1]) {
    const k = G.pos.length / 3;
    const cn = [c[0] + n[0] * hn * s, c[1] + n[1] * hn * s, c[2] + n[2] * hn * s];
    // the quad's winding faces out: (u x v) = n for s = +1, swap u's sign for s = -1
    const us = s;
    for (const [a, bq] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      G.pos.push(cn[0] + u[0] * hu * a * us + v[0] * hv * bq, cn[1] + u[1] * hu * a * us + v[1] * hv * bq, cn[2] + u[2] * hu * a * us + v[2] * hv * bq);
      G.nrm.push(n[0] * s, n[1] * s, n[2] * s);
    }
    G.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  return G.pos.length / 3 - base;
}
const fsNorm = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
const fsCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a strap's straight run from P to Q (3-D), its width across `side` (a unit vector), standing out along +n
function fsBandInto(G, P, Q, side) {
  const C = FREIGHT_STRAP;
  const d = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], L = Math.hypot(d[0], d[1], d[2]);
  if (!(L > 1e-6)) return 0;
  const ax = fsNorm(d), nz = fsNorm(fsCross(side, ax));
  const c = [0.5 * (P[0] + Q[0]) + nz[0] * C.t / 2, 0.5 * (P[1] + Q[1]) + nz[1] * C.t / 2, 0.5 * (P[2] + Q[2]) + nz[2] * C.t / 2];
  return fsBoxInto(G, c, ax, nz, side, L / 2, C.t / 2, C.w / 2);
}
// the load's drawing: { boxes: { [kind]: G } (the items with no model, by kind's colour), straps: G, metal: G,
// count: { stacks, bands, buckles, anchors } }; G = { pos, nrm, idx } (number arrays, card frame). `withModel(it)`
// says which items wear a model (drawn by the page, not here).
function freightStrapMesh(items, card, withModel) {
  const mk = () => ({ pos: [], nrm: [], idx: [] });
  const out = { boxes: {}, straps: mk(), metal: mk(), count: { stacks: 0, bands: 0, buckles: 0, anchors: 0, boxes: 0 } };
  const L = (items || []).filter(p => p && p.at);
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  for (const p of L) {
    if (withModel && withModel(p)) continue;
    const a = p.at, G = out.boxes[p.kind] || (out.boxes[p.kind] = mk());
    fsBoxInto(G, [0.5 * (a.x0 + a.x1), 0.5 * (a.y0 + a.y1), 0.5 * (a.z0 + a.z1)], X, Y, Z, 0.5 * (a.x1 - a.x0), 0.5 * (a.y1 - a.y0), 0.5 * (a.z1 - a.z0));
    out.count.boxes++;
  }
  for (const S of freightStrapStacks(L)) {
    const B = freightStrapBands(S, card);
    out.count.stacks++;
    for (const band of B.bands) {
      const to3 = q => band.along === 'x' ? [q[0], q[1], band.at] : [band.at, q[1], q[0]];
      // (the run, its normal and the side right-handed, so the strap's thickness stands OUT of the load: +z for the
      // lengthwise strap, -x for the cross one)
      const side = band.along === 'x' ? Z : [-1, 0, 0];
      for (let k = 0; k + 1 < band.pts.length; k++) fsBandInto(out.straps, to3(band.pts[k]), to3(band.pts[k + 1]), side);
      out.count.bands++;
    }
    fsBoxInto(out.metal, B.buckle.c, X, Y, Z, B.buckle.h[0], B.buckle.h[1], B.buckle.h[2]);
    out.count.buckles++;
    for (const A of B.anchors) { fsBoxInto(out.metal, A.c, X, Y, Z, A.h[0], A.h[1], A.h[2]); out.count.anchors++; }
  }
  return out;
}

// ---- THE STOP: THE NEXT STAGE'S ITEMS ARRIVE PLACED ---------------------------------------------------------------
// after careerOnStop + freightLoadSettle: when the tracked contract's current load has items and no placement rides
// for it, the packer's proposal is accepted for it (the player re-fits it in the loading view if they want) -> { doc,
// rec, how: 'kept' | 'proposed' | 'none', why }
function freightStrapNext(doc, slot, card) {
  if (!doc || !doc.career || typeof freightLoadJob !== 'function') return { doc, rec: null, how: 'none', why: 'not a career' };
  const J = freightLoadJob(doc, slot);
  if (J.rec) return { doc, rec: J.rec, how: 'kept', why: '' };
  if (!J.items.length) return { doc, rec: null, how: 'none', why: J.why };
  if (!card) return { doc, rec: null, how: 'none', why: 'this aeroplane\'s hold is not measured' };
  if (slot == null) return { doc, rec: null, how: 'none', why: 'the aeroplane has no saved airframe' };
  const st = freightLoadNew(card, J.items, { pax: J.pax });
  const r = freightLoadAccept(doc, card, st, J.ctx);
  if (!r.ok) return { doc, rec: null, how: 'none', why: r.why };
  return { doc: r.doc, rec: r.rec, how: 'proposed', why: '' };
}
