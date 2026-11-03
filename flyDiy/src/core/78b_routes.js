// ===========================================================================
// THE ROUTES (G3260-G3269 ROUTES) - a plane + a hired pilot + an A <-> B schedule, paid on the sim clock.
// futureDesigns/game/GAME-PLAN-2026-10-15.md §R (the user: "pay per trip or round trip, with a first down payment"),
// §3 T6 (the water job: "assign this plane to a route?" with a pilot and a big commitment fee; the Cub leaves for its
// route, "the cub disappears and you're back with only the ultralight"), §5.3 (the mechanism).
// ===========================================================================
// THE SHAPE: `career.routes: [route]` rides the career block (74_career.js careerNormalise calls routesBlock; CAREER_V
// unchanged: a field added, an older game carries it untouched). A route:
//   { id: 'rt<n>', plane: <fleet slot>, pilot: <hired id>, a, b: <aerodrome ids>, home: <the end the plane comes back
//     to>, signedAt: <career instant, s (dayAbs of careerDay)>, trips: <round trips paid>, settled: <instant last
//     settled, s>, km, cruiseKmh, tripS (one round trip, s), pay (per round trip), down (the down payment), earned,
//     ended: <instant> | absent }
// THE LOCK: signing moves the plane's fleet row to kind 'route' (71_player_bases.js: playerStoreWhere's sixth kind -
// no hangar, no slot, `a` / `b` / `route` on the row; playerMove, playerSendTo, bring-home, an arrival and a flight
// refuse it) and the pilot's row gets `route` (76_pilots.js: not picked, not fired, not boated, never unbound by a
// flight's end). The ROUTE only pays as the sim clock moves: routeSettle at the player's landings and waits counts the
// round trips completed since the signing (each 2 x the distance at the plane's cruise + a 30 min turnaround) and pays
// the ones not paid yet - no sim time, no pay. routeEnd frees both, free, no penalty: the plane back at the route's
// home field (inside when there is room, as any arrival), the pilot with it.
// Pure: every operation works on a clone and returns { ok, doc, why, ... }; a refusal hands back the very document it
// was given, untouched (74_career.js's contract). No DOM, no storage, no wall clock, no random.
// ===========================================================================
const ROUTES_V = 1;
// THE TERMS (a starting hypothesis for the economy simulation, §12): per round trip, the distance both ways at perKm,
// x (1 + the plane's payload / kgUnit) - a bigger plane earns more per trip, a faster one more trips a day: the route
// rewards the design. The down payment is downTrips round trips' pay, paid on signing. turnS: the turnaround at the
// ends, per round trip (§5.3 "plus a turnaround"). minKm: a route shorter than this pays as this.
// (G3359 ECON-APPLY, the user 23 Oct: "apply the economics table, keep demo time as it is for now"; ECON-SIM G3250 HANDOVER) perKm 100 -> 30, downTrips 8 -> 6,
// and a TIMETABLE: at most dayTrips round trips a sim day (a round trip takes at least 86400 / dayTrips, the plane waiting
// at its home end the rest) - waits no longer pay a fortune. The router's route share: 66 % -> 13 % (econ_sim, 20 seeds)
const ROUTES_PAY = { perKm: 30, kgUnit: 150, turnS: 1800, downTrips: 6, dayTrips: 6, minKm: 1, round: 10 };
const rtClone = o => JSON.parse(JSON.stringify(o));
const rtNo = (doc, why, extra) => Object.assign({ ok: false, doc, why }, extra || {});
const rtRound = v => Math.round(v / ROUTES_PAY.round) * ROUTES_PAY.round;
const routesList = doc => (doc && doc.career && Array.isArray(doc.career.routes)) ? doc.career.routes : [];
const routesActive = doc => routesList(doc).filter(r => r && !r.ended);
const routeOfPlane = (doc, slot) => routesActive(doc).find(r => r.plane === slot) || null;
const routeOfPilot = (doc, id) => routesActive(doc).find(r => r.pilot === id) || null;
// the career's instant in seconds: a number as given, a { date, utc } day, else the career's own day (74_ careerDay)
function routeNow(doc, now) {
  if (typeof now === 'number' && isFinite(now)) return now;
  if (now && typeof now === 'object' && typeof now.utc === 'number') return dayAbs(now);
  return dayAbs(careerDay(doc));
}
// the plane's numbers: the page's own (o.design: a CONTRACT_DESIGNS-shaped row, e.g. 75_ careerDesignOfShake of its
// shakedown), else a validated design by id (o.designId, else its airframe row's `design`, else the story's Cub for the
// story's client / gift plane) -> the row, or null (not known yet: open it in the garage)
function routeDesignOf(doc, plane, o) {
  o = o || {};
  const D = typeof CONTRACT_DESIGNS !== 'undefined' ? CONTRACT_DESIGNS : {};
  if (o.design && typeof o.design === 'object' && o.design.cruiseKmh > 0) return o.design;
  if (o.designId && D[o.designId]) return D[o.designId];
  const A = doc && doc.career && doc.career.airframes && doc.career.airframes[plane];
  if (A && A.design && D[A.design]) return D[A.design];
  if (A && A.from === 'story' && (A.story === 'client' || A.gift) && D.cub) return D.cub;
  return null;
}
// the terms of a route of `km` (one way) flown by design row D -> { km, cruiseKmh, seats, payloadKg, tripS, pay, down }
function routeTerms(km, D) {
  const P = ROUTES_PAY, seats = Math.max(1, D.seats | 0);
  const payloadKg = Math.max(0, seats - 1) * CONTRACT_FIT.occKg + (+D.bagKg || 0);
  // flyS: the round trip as flown (both legs + the turnarounds); tripS: as timetabled (G3359: at least a day / dayTrips)
  const flyS = Math.round(2 * km / D.cruiseKmh * 3600 + P.turnS);
  const tripS = P.dayTrips > 0 ? Math.max(flyS, Math.round(86400 / P.dayTrips)) : flyS;
  const pay = rtRound(2 * Math.max(P.minKm, km) * P.perKm * (1 + payloadKg / P.kgUnit));
  return { km: Math.round(km * 100) / 100, cruiseKmh: Math.round(D.cruiseKmh), seats, payloadKg, flyS, tripS, pay, down: pay * P.downTrips };
}
// the end the plane comes back to: the end where a hangar of yours stands (b first, the story's HOME), else b
function routeHomeOf(doc, a, b) {
  const held = id => typeof playerHangarsAt === 'function' && playerHangarsAt(doc, id).some(h => !doc.sheds[h].locked);
  return held(b) ? b : held(a) ? a : b;
}
// THE OFFER: the terms for `plane` on a <-> b (nothing changes in the document). o: { design | designId (the plane's
// numbers), gear (the plane's: stripGear's word - a water end refuses wheels, a land end floats), fields (a world's
// CONTRACT_FIELDS) } -> { ok, doc, offer, why }
function routeOffer(doc, a, b, plane, o) {
  o = o || {};
  if (!doc || doc.mode !== 'career' || !doc.career) return rtNo(doc, 'routes are a career\'s');
  if (!doc.fleet || !doc.fleet[plane]) return rtNo(doc, (plane || 'no plane') + ' is not in the fleet');
  if (routeOfPlane(doc, plane)) return rtNo(doc, plane + ' flies a route already');
  if (!a || !b || a === b) return rtNo(doc, 'a route joins two different aerodromes');
  const F = o.fields || CONTRACT_FIELDS;
  const km = contractKm(a, b, F);
  if (!isFinite(km)) return rtNo(doc, 'no route between ' + a + ' and ' + b + ' (an aerodrome unknown)');
  if (o.gear) {
    const wet = id => !!(F[id] && F[id].surf === 'water');
    for (const id of [a, b]) {
      if (wet(id) && (o.gear === 'wheels' || o.gear === 'skis')) return rtNo(doc, (F[id].name || id) + ' is water: ' + plane + ' is on ' + o.gear);
      if (!wet(id) && o.gear === 'floats') return rtNo(doc, (F[id].name || id) + ' is a land strip: ' + plane + ' is on floats');
    }
  }
  const D = routeDesignOf(doc, plane, o);
  if (!D) return rtNo(doc, plane + '\'s numbers are not read yet: open it in the garage (its certificate)');
  const T = routeTerms(km, D);
  const offer = Object.assign({ k: 'routeOffer', plane, a, b, home: routeHomeOf(doc, a, b), design: D.id || D.label || null }, T);
  return { ok: true, doc, offer, why: '' };
}
// THE SIGNATURE: the down payment paid (an income line in the ledger), the plane and the pilot LOCKED on the route.
// The plane must stand at one of its ends (its aerodrome: a flight brings it there); the pilot must be hired and free.
// o: { now (the career instant: a number or a day; default careerDay) } -> { ok, doc, route, why }
function routeSign(doc, offer, plane, pilot, o) {
  o = o || {};
  if (!doc || doc.mode !== 'career' || !doc.career) return rtNo(doc, 'routes are a career\'s');
  if (!offer || offer.k !== 'routeOffer' || !(offer.tripS > 0) || !(offer.pay >= 0)) return rtNo(doc, 'no route offer to sign');
  plane = plane || offer.plane;
  if (offer.plane && plane !== offer.plane) return rtNo(doc, 'the offer is for ' + offer.plane + ', not ' + plane);
  if (!doc.fleet || !doc.fleet[plane]) return rtNo(doc, (plane || 'no plane') + ' is not in the fleet');
  if (routeOfPlane(doc, plane)) return rtNo(doc, plane + ' flies a route already');
  const hired = typeof pilotsHired === 'function' ? pilotsHired(doc) : [];
  if (!hired.includes(pilot)) return rtNo(doc, (pilot || 'nobody') + ' is not on the roster: a route needs a hired pilot');
  if (routeOfPilot(doc, pilot)) return rtNo(doc, (typeof pilotsName === 'function' ? pilotsName(pilot) : pilot) + ' flies a route already');
  const W = playerStoreWhere(doc, plane);
  if (W.kind === 'none') return rtNo(doc, plane + ' stands nowhere yet');
  if (W.aero !== offer.a && W.aero !== offer.b) return rtNo(doc, plane + ' is at ' + W.aero + ': it starts the route from ' + offer.a + ' or ' + offer.b);
  const now = routeNow(doc, o.now), d = rtClone(doc), c = d.career;
  if (!Array.isArray(c.routes)) c.routes = [];
  c.routeN = (typeof c.routeN === 'number' && isFinite(c.routeN) ? c.routeN : c.routes.length) + 1;
  const route = { id: 'rt' + c.routeN, plane, pilot, a: offer.a, b: offer.b, home: offer.home || routeHomeOf(d, offer.a, offer.b),
                  signedAt: Math.round(now), trips: 0, settled: Math.round(now), km: offer.km, cruiseKmh: offer.cruiseKmh,
                  tripS: offer.tripS, flyS: offer.flyS > 0 ? offer.flyS : offer.tripS, pay: offer.pay, down: offer.down, earned: offer.down };
  c.routes.push(route);
  // the plane: on the route, standing nowhere of yours (its wear runs as outside: it flies)
  const e = d.fleet[plane];
  if (e.hangar || typeof e.outSince !== 'number') e.outSince = Math.round(d.clock || 0);
  if (e.hangar) e.left = e.hangar;
  e.hangar = null; e.aero = W.aero; e.kind = 'route'; e.route = route.id; e.a = route.a; e.b = route.b;
  delete e.slot;
  // the pilot: with the plane, on the route
  const P = c.pilots && c.pilots[pilot];
  if (P) { P.route = route.id; P.plane = plane; P.aero = W.aero; }
  playerCharge(d, -route.down, 'route', route.id);
  return { ok: true, doc: d, route: rtClone(route), why: '' };
}
// THE SETTLE (at the player's landings and waits): every route's round trips completed by `now` since its signing,
// the ones not paid yet paid now (a ledger line each route). Time only moves forward: an instant before the last
// settle pays nothing. -> { ok, doc, paid, trips, lines: [{ id, plane, a, b, trips, amt }], why }
function routeSettle(doc, now) {
  if (!doc || !doc.career) return rtNo(doc, 'not a career', { paid: 0, trips: 0, lines: [] });
  const live = routesActive(doc);
  if (!live.length) return { ok: true, doc, paid: 0, trips: 0, lines: [], why: '' };
  const t = routeNow(doc, now);
  const d = rtClone(doc), lines = [];
  let paid = 0, trips = 0;
  for (const r of d.career.routes) {
    if (!r || r.ended || !(r.tripS > 0)) continue;
    if (t <= r.settled) continue;
    const n = Math.max(0, Math.floor((t - r.signedAt) / r.tripS)), add = n - (r.trips | 0);
    r.settled = Math.round(t);
    if (add <= 0) continue;
    const amt = add * r.pay;
    r.trips = n; r.earned = (+r.earned || 0) + amt;
    playerCharge(d, -amt, 'routePay', r.id);
    paid += amt; trips += add;
    lines.push({ id: r.id, plane: r.plane, a: r.a, b: r.b, trips: add, amt });
  }
  return { ok: true, doc: d, paid, trips, lines, why: '' };
}
// THE END: the round trips flown so far paid (a settle), the plane back at the route's home field - free, instant,
// inside a hangar of yours there when one has room (71_ playerArrive), else its apron, else kept long-term - and the
// pilot freed with it. No penalty: only the income stops. o: { now } -> { ok, doc, route, where, why }
function routeEnd(doc, id, o) {
  o = o || {};
  const R = routesActive(doc).find(r => r.id === id);
  if (!R) return rtNo(doc, 'no route ' + id + ' running');
  const s = routeSettle(doc, o.now);
  const d = s.ok ? s.doc : rtClone(doc), now = routeNow(d, o.now);
  const r = d.career.routes.find(x => x.id === id);
  r.ended = Math.round(now);
  let D = d;
  const e = D.fleet[r.plane];
  if (e) {
    delete e.kind; delete e.route; delete e.a; delete e.b; delete e.slot;
    e.hangar = null; e.aero = r.home;
    const A = playerArrive(D, r.plane, r.home, {});
    if (A.ok) D = A.doc;
  }
  const P = D.career.pilots && D.career.pilots[r.pilot];
  if (P) { delete P.route; P.aero = r.home; P.plane = null; }
  playerLedger(D, 'routeEnd', 0, id);
  return { ok: true, doc: D, route: rtClone(r), where: e ? playerStoreWhere(D, r.plane) : null, paid: s.paid || 0, why: '' };
}
// THE NORMALISER (careerNormalise): the routes kept well-formed; a route whose plane left the fleet ended; the fleet's
// route rows and the pilots' marks made to agree with the running routes (an unlocked row is placed again by the
// settle). Mutates `doc` (careerNormalise's way) and returns it.
function routesBlock(doc) {
  const c = doc && doc.career;
  if (!c) return doc;
  // (a career that never signed one has no `routes`: nothing is added, so its save is byte for byte what it was)
  if ('routes' in c && !Array.isArray(c.routes)) delete c.routes;
  if (Array.isArray(c.routes)) c.routes = c.routes.filter(r => r && typeof r === 'object' && typeof r.id === 'string' && typeof r.plane === 'string' &&
    typeof r.a === 'string' && typeof r.b === 'string' && r.tripS > 0 && isFinite(r.signedAt));
  const L = c.routes || [];
  const F = doc.fleet || {};
  for (const r of L) {
    if (r.ended) continue;
    if (!F[r.plane]) { r.ended = Math.round(+r.settled || +r.signedAt || 0); continue; }
    if (typeof r.home !== 'string' || !r.home) r.home = r.b;
    if (!Number.isInteger(r.trips) || r.trips < 0) r.trips = 0;
    if (!isFinite(r.settled)) r.settled = r.signedAt;
    const e = F[r.plane];
    if (e.kind !== 'route' || e.route !== r.id) { e.hangar = null; e.kind = 'route'; e.route = r.id; e.a = r.a; e.b = r.b; delete e.slot;
      if (typeof e.aero !== 'string' || (e.aero !== r.a && e.aero !== r.b)) e.aero = r.a; }
  }
  const live = new Set(L.filter(r => !r.ended).map(r => r.id));
  let loose = false;
  for (const n of Object.keys(F)) {
    const e = F[n];
    if (e && e.kind === 'route' && !live.has(e.route)) { delete e.kind; delete e.route; delete e.a; delete e.b; loose = true; }
  }
  if (loose && typeof playerStoreSettle === 'function') playerStoreSettle(doc);
  for (const id of Object.keys(c.pilots || {})) {
    const P = c.pilots[id];
    if (P && P.route && !live.has(P.route)) delete P.route;
  }
  return doc;
}
// WHERE THE PLANE IS ON ITS ROUTE at `now`: the cycle a -> b, the turnaround at b, b -> a, the turnaround at a (each
// turnaround half of turnS) -> { leg: 'out' | 'atB' | 'back' | 'atA', f: 0..1 along a -> b }
function routePos(r, now) {
  // (G3359: the legs take the FLOWN time; a timetabled trip's rest is spent at the home end, atA)
  const turn = ROUTES_PAY.turnS / 2, fly = Math.max(1, (Math.min(r.tripS, r.flyS > 0 ? r.flyS : r.tripS) - ROUTES_PAY.turnS) / 2);
  const t = ((Math.max(0, (now == null ? r.settled : now) - r.signedAt) % r.tripS) + r.tripS) % r.tripS;
  if (t < fly) return { leg: 'out', f: t / fly };
  if (t < fly + turn) return { leg: 'atB', f: 1 };
  if (t < 2 * fly + turn) return { leg: 'back', f: 1 - (t - fly - turn) / fly };
  return { leg: 'atA', f: 0 };
}
// an aerodrome's name in words (its runway's numbers off, as the map's): the world's aerodromes, else CONTRACT_FIELDS
const routeAeroName = (id, aeros) => { const a = (aeros || []).find(x => x && x.id === id);
  const n = (a && a.name) || (typeof CONTRACT_FIELDS !== 'undefined' && CONTRACT_FIELDS[id] && CONTRACT_FIELDS[id].name) || id;
  return String(n).replace(/\s+\d{2}[LRC]?\/\d{2}[LRC]?$/, ''); };
const routeWords = (r, aeros) => routeAeroName(r.a, aeros) + ' – ' + routeAeroName(r.b, aeros);
const routeMoney = n => Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ');
// THE ARRIVAL CARD'S LINES of a settle -> [{ k: 'route', ok, text }]
function routeSettleLines(res, aeros) {
  return ((res && res.lines) || []).map(l => ({ k: 'route', ok: true,
    text: 'Route ' + routeWords(l, aeros) + ' (' + l.plane + '): ' + l.trips + ' round trip' + (l.trips === 1 ? '' : 's') + ', +' + routeMoney(l.amt) }));
}
// THE MAP'S ROWS: every running route, the plane where it is on it now -> [{ id, plane, pilot, pilotName, a, b, home,
// leg, f, trips, pay, tripS, down, words }]
function routesMapOf(doc, now, aeros) {
  const t = routeNow(doc, now);
  return routesActive(doc).map(r => Object.assign({ id: r.id, plane: r.plane, pilot: r.pilot,
    pilotName: typeof pilotsName === 'function' ? pilotsName(r.pilot) : r.pilot, a: r.a, b: r.b, home: r.home,
    trips: r.trips, pay: r.pay, tripS: r.tripS, down: r.down, words: routeWords(r, aeros) }, routePos(r, t)));
}
// THE WORDS OF AN OFFER (the page's confirmation, the story's line)
function routeOfferWords(offer, aeros, pilot) {
  const h = Math.floor(offer.tripS / 3600), m = Math.round((offer.tripS % 3600) / 60);
  return routeAeroName(offer.a, aeros) + ' – ' + routeAeroName(offer.b, aeros) + ' (' + offer.km.toFixed(1) + ' km)' +
    (pilot ? ', flown by ' + (typeof pilotsName === 'function' ? pilotsName(pilot) : pilot) : '') +
    ': a down payment of ' + routeMoney(offer.down) + ' on signing, then ' + routeMoney(offer.pay) + ' a round trip (' +
    (h ? h + ' h ' : '') + m + ' min each, the turnaround included), paid at your landings and waits';
}
