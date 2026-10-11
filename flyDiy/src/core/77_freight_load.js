// ===========================================================================
// FREIGHT-LOAD (G2345-G2349) — THE FITTING INTERFACE'S PURE HALF: THE PLAYER'S HAND ON THE PACKER'S PROPOSAL.
// futureDesigns/game/FREIGHT-2026-10-07.md §2 and §4 (RULED by the user, 7 Oct): no loading time, no crew, no load
// failure - but THE FITTING INTERFACE. The packer proposes (76_freight.js freightPack); the player may move an item,
// leave it on the ground, turn it, take an EMPTY seat out or put it back ("if the load fits, nobody cares whether a
// seat is there"), and ask for the packer's answer again. The report is freightReport's, live. Out of range (the
// CG, the MTOW, a floor) is REPORTED, NEVER REFUSED: the aeroplane flies what you loaded.
//
// WHAT IS REFUSED is only what is physically impossible (each refusal says why):
//   the door     an item no door of this aeroplane takes never goes aboard (freightDoorAny)
//   the hold     a box stands inside the hold's clear section at every station it spans (freightHoldFits), on the
//                highest thing under it: the floor, or WHOLLY on one stackable item (the packer's own rule - an
//                overhang or a bridge does not stand); nothing on a drum or a stretcher
//   the room     clear of the seats still in, the occupants and the other items
//   the stack    an item carrying another is not pulled from under it (move the top one first)
//   the seats    the pilot's seat and an occupied seat stay in; a seat goes back only where nothing stands
// THE SNAP: an item's fore end on the hold's stations and their middles (FREIGHT_PACK.step, the packer's grid built
// on card.hold.dx), across on FREIGHT_PACK.zStep; a drop near a wall slides off it to the clear section (the room at
// that height), a drop on a stackable item stays wholly on it.
//
// THE SESSION (a plain object, the view's state; nothing here mutates its inputs):
//   { v, card: id, pax, seatsOut: [i], items: [freightItem] (the whole load, bulk split), placed: [row] }
//   a row is freightPack's placed row: { id, kind, kg, dims, stack, at: {x0..z1}, on, door, how, space }
//   the items not placed are ON THE GROUND (freightLoadAshore)
// ACCEPT (freightLoadRecord / freightLoadAccept) writes THE PLACEMENT into the career document (`career.load`):
// the items aboard with their boxes, the seats out, the passengers, the contract / stage / sub it was loaded for and
// the airframe's slot and design. CAREER-WIRE's stop (careerStopRecord's `items`) reads it - the load is the items,
// not a typed number - and FREIGHT-STRAP (G2400) reads `freightAccepted(doc)`: every item's box and centre in the
// card's frame (the gen frame: x m aft of the windscreen-base ring, y up, z to the right - the frame def.nodes are
// built in) and its kilos, which become the point masses and the strapped props.
//
// Pure: no DOM, storage, clock or random (GATE FREIGHT scans for each). Reads 76_freight.js, 74_ / 75_.
// ===========================================================================

const FREIGHT_LOAD_V = 1;
const flR3 = v => Math.round(v * 1000) / 1000;
const flClone = o => JSON.parse(JSON.stringify(o));
const flNo = (why, extra) => Object.assign({ ok: false, why }, extra || {});
const flBox = r => ({ x0: r.at.x0, x1: r.at.x1, y0: r.at.y0, y1: r.at.y1, z0: r.at.z0, z1: r.at.z1 });
const flOverXZ = (p, q) => p.x0 < q.x1 - 1e-6 && q.x0 < p.x1 - 1e-6 && p.z0 < q.z1 - 1e-6 && q.z0 < p.z1 - 1e-6;
const flSameDims = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6;
// the seats the player may take out: empty ones (never the pilot's, never a passenger's)
function flSeatsOutOk(card, pax, out) {
  const ok = new Set(((card && card.seats) || []).filter(s => s.i > 0 && s.i > pax).map(s => s.i));
  return [...new Set((out || []).map(v => v | 0))].filter(i => ok.has(i)).sort((a, b) => a - b);
}

// ---- THE SESSION ---------------------------------------------------------------------------------------------
// freightLoadNew(card, items, { pax, seatsOut }) -> the session, the packer's proposal placed
function freightLoadNew(card, items, opts) {
  const o = opts || {}, pax = Math.max(0, o.pax | 0);
  const its = freightSplit(items || []);
  const seatsOut = flSeatsOutOk(card, pax, o.seatsOut);
  const P = freightPack(card, its, { pax, seatsOut });
  return { v: FREIGHT_LOAD_V, card: (card && card.id) || null, pax, seatsOut, items: its, placed: P.placed };
}
// "Propose again": the packer's answer for the load, the passengers and the seats as they are now
function freightLoadPropose(card, st) {
  return freightLoadNew(card, st.items, { pax: st.pax, seatsOut: st.seatsOut });
}
// the items on the ground (not aboard), each with why the packer left it (no door / no room) when it did
function freightLoadAshore(card, st) {
  const on = new Set(st.placed.map(p => p.id));
  return st.items.filter(it => !on.has(it.id)).map(it => {
    const d = card && card.hold ? freightDoorAny(card, it) : { ok: false, why: 'this aeroplane has no hold' };
    return Object.assign({}, it, { door: !!d.ok, why: d.ok ? '' : (d.why || it.id + ' passes no door') });
  });
}
// THE REPORT: freightReport's own (the parity GATE FREIGHT holds), plus what stays on the ground
function freightLoadReport(card, st) {
  const R = freightReport(card, st.placed, { pax: st.pax, seatsOut: st.seatsOut });
  const ash = freightLoadAshore(card, st);
  return Object.assign(R, { ashore: ash.map(a => a.id), ashoreKg: freightKg(ash), aboard: st.placed.length, items: st.items.length });
}

// ---- THE HAND: where an item would go, and why not ------------------------------------------------------------
// freightLoadTarget(card, st, id, want) -> { ok, row, why }
//   want: { x, z } the item's middle the pointer asks for (card frame, m), turn: true for a quarter turn about the
//   vertical from its present orientation (or the kind's first, from the ground)
function freightLoadTarget(card, st, id, want) {
  const H = card && card.hold;
  if (!H) return flNo('this aeroplane has no hold');
  const it = st.items.find(q => q.id === id);
  if (!it) return flNo('no item ' + id);
  const door = freightDoorAny(card, it);
  if (!door.ok) return flNo(it.id + ' (' + it.dims.join(' x ') + ' m) passes no door of this aeroplane', { door: false });
  const cur = st.placed.find(p => p.id === id);
  const atop = st.placed.filter(p => p.on === id);
  if (atop.length) return flNo(atop.map(p => p.id).join(', ') + ' is on it: move that first');
  let L = cur ? [flR3(cur.at.x1 - cur.at.x0), flR3(cur.at.y1 - cur.at.y0), flR3(cur.at.z1 - cur.at.z0)] : frOrients(it)[0];
  if (want && want.turn) L = [L[2], L[1], L[0]];
  if (!frOrients(it).some(o => flSameDims(o, L))) return flNo(it.id + ' does not lie that way');   // (a turn keeps the height: always one of the kind's)
  const [lx, ly, lz] = L, P = FREIGHT_PACK, xHi = H.x0 + H.n * H.dx;
  if (lx > xHi - H.x0 + 1e-9) return flNo(it.id + ' is longer than the hold');
  const wx = want && isFinite(want.x) ? +want.x : 0.5 * (H.x0 + xHi), wz = want && isFinite(want.z) ? +want.z : 0;
  // THE SNAP: the fore end on the packer's grid (the stations and their middles), inside the hold's length
  let x0 = H.x0 + Math.round((wx - lx / 2 - H.x0) / P.step) * P.step;
  x0 = flR3(Math.max(H.x0, Math.min(x0, H.x0 + Math.floor((xHi - lx - H.x0) / P.step + 1e-9) * P.step)));
  const x1 = flR3(x0 + lx);
  let z0 = flR3(Math.round((wz - lz / 2) / P.zStep) * P.zStep);
  const others = st.placed.filter(p => p.id !== id);
  // WHAT IT RESTS ON: the highest thing under its footprint - the floor, or the top of an item
  const floorY = freightRestY(card, x0, x1);
  if (floorY == null) return flNo('off the hold');
  const fp = { x0, x1, z0, z1: z0 + lz };
  const under = others.filter(p => flOverXZ(fp, p.at));
  let y0 = floorY, sup = null;
  const top = under.reduce((m, p) => Math.max(m, p.at.y1), -Infinity);
  if (top > floorY + 1e-6) {
    // on the item under its middle (the largest overlap): wholly on it, so the footprint slides onto it
    const ov = p => Math.max(0, Math.min(fp.x1, p.at.x1) - Math.max(fp.x0, p.at.x0)) * Math.max(0, Math.min(fp.z1, p.at.z1) - Math.max(fp.z0, p.at.z0));
    sup = under.filter(p => p.at.y1 > top - 1e-6).sort((a, b) => ov(b) - ov(a))[0];
    if (!sup.stack) return flNo('nothing goes on the ' + sup.id + ' (' + sup.kind + ')');
    if (lx > sup.at.x1 - sup.at.x0 + 1e-6 || lz > sup.at.z1 - sup.at.z0 + 1e-6) return flNo(it.id + ' is bigger than the ' + sup.id + ' under it: it would not stand');
    if (fp.x0 < sup.at.x0 - 1e-9 || fp.x1 > sup.at.x1 + 1e-9) return flNo(it.id + ' overhangs the ' + sup.id + ': it would not stand');
    z0 = flR3(Math.max(sup.at.z0, Math.min(z0, sup.at.z1 - lz)));
    y0 = sup.at.y1;
  }
  const y1 = flR3(y0 + ly);
  // THE HOLD'S WALLS at that height: off the wall to the clear section
  const zm = frZMax(card, x0, x1, y0, y1);
  if (zm < 0) return flNo('no room for ' + it.id + ' there: the hold closes above it');
  if (zm < lz / 2 - 1e-8) return flNo('no room for ' + it.id + ' there: ' + (zm < 0.05 ? 'the roof is too low' : 'the hold is ' + Math.round(200 * zm) + ' cm wide at that height'));
  z0 = flR3(Math.max(-zm, Math.min(z0, zm - lz)));
  if (sup && (z0 < sup.at.z0 - 1e-9 || z0 + lz > sup.at.z1 + 1e-9)) return flNo('the ' + sup.id + ' is against the wall there: ' + it.id + ' would not stand on it');
  const at = { x0, x1, y0: flR3(y0), y1, z0, z1: flR3(z0 + lz) };
  if (!freightHoldFits(card, at)) return flNo('no room for ' + it.id + ' there');
  // CLEAR OF THE SEATS STILL IN, THE OCCUPANTS AND THE OTHER ITEMS
  const ob = freightObstacles(card, freightSeats(card, st)).find(q => frOverlap(at, q));
  if (ob) return flNo(/^occupant/.test(ob.id) ? (ob.seat === 0 ? 'the pilot is there' : 'the passenger in seat ' + ob.seat + ' is there') : 'seat ' + ob.seat + ' is there (an empty seat can be taken out)');
  const hit = others.find(q => frOverlap(at, q.at));
  if (hit) return flNo('the ' + hit.id + ' is there');
  const spaces = freightSpaces(card);
  return { ok: true, why: '', row: { id: it.id, kind: it.kind, kg: it.kg, dims: it.dims, stack: it.stack && FREIGHT_KINDS[it.kind].stack,
                                     at, on: sup ? sup.id : null, door: door.door, how: door.how,
                                     space: frSpaceOf(spaces, 0.5 * (at.x0 + at.x1)) } };
}
// the move itself -> { ok, st, row, why } (the session unchanged on a refusal)
function freightLoadMove(card, st, id, want) {
  const t = freightLoadTarget(card, st, id, want);
  if (!t.ok) return Object.assign({ st }, t);
  const placed = st.placed.filter(p => p.id !== id).concat([t.row]);
  return { ok: true, why: '', row: t.row, st: Object.assign({}, st, { placed }) };
}
// LEFT ON THE GROUND: an item taken out of the aeroplane (refused only from under another)
function freightLoadUnload(card, st, id) {
  if (!st.placed.some(p => p.id === id)) return { ok: true, why: '', st };
  const atop = st.placed.filter(p => p.on === id);
  if (atop.length) return { ok: false, why: atop.map(p => p.id).join(', ') + ' is on it: move that first', st };
  return { ok: true, why: '', st: Object.assign({}, st, { placed: st.placed.filter(p => p.id !== id) }) };
}
// A SEAT OUT / IN (ruled: the player chooses; only an empty seat goes, and it goes back only where nothing stands)
function freightLoadSeat(card, st, i, out) {
  const s = ((card && card.seats) || []).find(q => q.i === (i | 0));
  if (!s) return { ok: false, why: 'no seat ' + i, st };
  const isOut = st.seatsOut.includes(s.i), want = out == null ? !isOut : !!out;
  if (want === isOut) return { ok: true, why: '', st };
  if (want) {
    if (s.i === 0) return { ok: false, why: 'the pilot\'s seat stays', st };
    if (s.i <= st.pax) return { ok: false, why: 'a passenger sits in seat ' + s.i, st };
    return { ok: true, why: '', st: Object.assign({}, st, { seatsOut: flSeatsOutOk(card, st.pax, st.seatsOut.concat([s.i])) }) };
  }
  const back = Object.assign({}, st, { seatsOut: st.seatsOut.filter(v => v !== s.i) });
  const ob = freightObstacles(card, freightSeats(card, back)).filter(q => q.seat === s.i);
  const hit = st.placed.find(p => ob.some(q => frOverlap(p.at, q)));
  if (hit) return { ok: false, why: 'the ' + hit.id + ' stands where seat ' + s.i + ' goes: move it first', st };
  return { ok: true, why: '', st: back };
}

// ---- ACCEPT: THE PLACEMENT INTO THE CAREER'S RECORD ------------------------------------------------------------
// freightLoadRecord(card, st, ctx) -> the accepted load: ctx { slot, contract, stage, sub } (the airframe and the
// job's open sub it was loaded for). The items aboard keep their boxes; the ones left on the ground are named.
function freightLoadRecord(card, st, ctx) {
  const c = ctx || {}, R = freightLoadReport(card, st);
  const ash = freightLoadAshore(card, st);
  return {
    v: FREIGHT_LOAD_V, slot: c.slot != null ? String(c.slot) : null, design: (card && card.id) || st.card || null,
    contract: c.contract || null, stage: c.stage != null ? c.stage | 0 : null, sub: c.sub != null ? c.sub | 0 : null,
    pax: st.pax, seatsOut: st.seatsOut.slice(),
    items: st.placed.map(p => ({ id: p.id, kind: p.kind, kg: p.kg, dims: p.dims.slice(), at: Object.assign({}, p.at), on: p.on || null, space: p.space || null })),
    ashore: ash.map(a => ({ id: a.id, kind: a.kind, kg: a.kg, dims: a.dims.slice() })),
    kg: R.cargoKg, mass: R.mass.kg, cg: { x: R.cg.x, pct: R.cg.pct }, ok: R.ok, why: R.why.slice(),
  };
}
// -> { ok, doc, rec, why }: the career document with `career.load` = the record (a copy; the input untouched)
function freightLoadAccept(doc, card, st, ctx) {
  if (!doc || !doc.career) return { ok: false, doc, rec: null, why: 'not a career' };
  const rec = freightLoadRecord(card, st, ctx);
  const d = flClone(doc);
  d.career.load = rec;
  return { ok: true, doc: d, rec, why: '' };
}
// THE ACCEPTED LOAD, AS FREIGHT-STRAP READS IT: a career document (or the record itself, the sandbox's) ->
// { slot, design, contract, stage, sub, pax, seatsOut, items: [{ id, kind, kg, dims, at, c: [x, y, z], on, space }],
//   ashore, kg, cg, ok } or null. `c` is the box's centre in the card's frame (the gen frame of def.nodes).
function freightAccepted(doc) {
  const r = doc && (doc.career ? doc.career.load : (Array.isArray(doc.items) && doc.v ? doc : null));
  if (!r || typeof r !== 'object' || !Array.isArray(r.items)) return null;
  const out = flClone(r);
  out.items = out.items.filter(p => p && p.at && isFinite(p.kg)).map(p =>
    Object.assign(p, { c: [flR3(0.5 * (p.at.x0 + p.at.x1)), flR3(0.5 * (p.at.y0 + p.at.y1)), flR3(0.5 * (p.at.z0 + p.at.z1))] }));
  out.kg = freightKg(out.items);
  if (!Array.isArray(out.ashore)) out.ashore = [];
  if (!Array.isArray(out.seatsOut)) out.seatsOut = [];
  return out;
}
// the session again from an accepted record (the view reopened on the same job): the items aboard where they were,
// the rest on the ground
function freightLoadFromRecord(card, rec) {
  const items = freightSplit((rec.items || []).concat(rec.ashore || []));
  const pax = Math.max(0, rec.pax | 0), spaces = freightSpaces(card);
  const placed = (rec.items || []).map(p => {
    const it = items.find(q => q.id === p.id) || freightItem(p);
    const d = freightDoorAny(card, it);
    return { id: it.id, kind: it.kind, kg: it.kg, dims: it.dims, stack: it.stack && FREIGHT_KINDS[it.kind].stack, at: Object.assign({}, p.at),
             on: p.on || null, door: d.door, how: d.how, space: frSpaceOf(spaces, 0.5 * (p.at.x0 + p.at.x1)) };
  });
  return { v: FREIGHT_LOAD_V, card: card.id, pax, seatsOut: flSeatsOutOk(card, pax, rec.seatsOut), items, placed };
}

// ---- THE CAREER'S SIDE --------------------------------------------------------------------------------------------
// the airframe's card: the career's airframe row (PROCURE's design), else a build envelope's factory row (a model
// taken in the sandbox), else null (a player's own build: its hold is not measured - FREIGHT-MODEL's open point)
function freightLoadCard(doc, slot, env) {
  const A = doc && doc.career && doc.career.airframes && slot != null ? doc.career.airframes[slot] : null;
  const id = (A && A.design) || (env && env.log && env.log.factory && env.log.factory.design) || null;
  return (id && typeof FREIGHT_CARDS !== 'undefined' && FREIGHT_CARDS[id]) || null;
}
// what the loading view opens on in the career: the tracked contract's current stage's load -> { items, pax, ctx,
// rec (the accepted placement for this very sub and airframe, to reopen on), why }
function freightLoadJob(doc, slot) {
  const L = typeof careerTrackedLoad === 'function' ? careerTrackedLoad(doc) : null;
  if (!L) return { items: [], pax: 0, ctx: null, rec: null, why: 'no tracked contract with a load: open the MAP' };
  const C = doc.career.contracts, live = C.live[C.tracked] || { stage: 0 };
  const ctx = { slot: slot != null ? String(slot) : null, contract: C.tracked, stage: live.stage | 0, sub: L.sub };
  const r = doc.career.load;
  const same = r && r.contract === ctx.contract && r.stage === ctx.stage && r.sub === ctx.sub && r.slot === ctx.slot;
  return { items: L.items || [], pax: L.pax || 0, kg: L.kg || 0, ctx, rec: same ? r : null,
           why: (L.items && L.items.length) ? '' : (L.pax ? 'passengers only: they board, they don\'t fit' : 'no items in this load') };
}
// the stop record's items: the accepted load when it rides THIS airframe (else null: the typed kilos, the fallback)
function freightStopItems(doc, slot) {
  const A = freightAccepted(doc);
  if (!A || (slot != null && A.slot != null && A.slot !== String(slot))) return null;
  return A.items.map(p => ({ id: p.id, kind: p.kind, kg: p.kg, dims: p.dims }));
}
// after a stop: the accepted load leaves the record once the sub it was loaded for is done (delivered), its contract
// is no longer accepted or its stage has moved on -> the document (a copy when it changes)
function freightLoadSettle(doc) {
  const r = doc && doc.career && doc.career.load;
  if (!r) return doc;
  const C = doc.career.contracts, L = C && C.live && C.live[r.contract];
  const open = C && C.accepted.includes(r.contract) && L && (L.stage | 0) === r.stage && !(L.subs && L.subs[r.sub]);
  if (open) return doc;
  const d = flClone(doc);
  delete d.career.load;
  return d;
}
