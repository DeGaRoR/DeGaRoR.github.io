// ============================================================
// THE FLIGHT'S "TO" (G1945 DEST-TO, 2026-10-05) — pure: no sim, no THREE, no
// DOM. The user: "I'm landing at an airport. I'd want the plane to take off
// from that very airport, to a new destination. I can't do that now, it will
// always reset the plane to the default starting location. It needs to start
// from where it is. Actually we could gradually drop the FROM-TO in favour of
// a simple 'To', which can be updated in flight or on the ground. The plane
// reacts like its autopilot's destination has been updated. Right now our
// original location is always the WWII hangar, so easy, but in the future
// we'll have a few bases out of which we will be able to spawn airplanes."
//
// THE MODEL. A flight has a STATE — where the aeroplane is: on a stand, on the
// apron or a taxiway, on a runway, on a water lane, in a field, in the air —
// and ONE destination, the TO (an aerodrome id; 'CIRCUIT' = the field it is
// at). The FROM is DERIVED (flightWhere: the aerodrome under the aeroplane),
// never a choice and never a reset. A new TO is the autopilot's destination
// changing (43_pilot.js ap.setDest): on the ground the next departure taxis
// out from where it stands; in the air the arrival is re-planned from here.
//
// THE BASE is where a flight BEGINS — the garage's roll-out spawns there: an
// airfield plus a hangar / stand set (its site, 25_airfield.js). Today there
// is one, HOME (the WWII hangar beside 13/31 on Jolene, the home strip of the
// analytic world); the registry is the slot the next one lands in, and the
// pickers show a base row only once there are two.
//
// THE OLD FROM-TO, MIGRATED (flightRouteMigrate): the pref `flydiy.route` was
// { from, dest } (G710); it is { v: 2, base, to } now. A v1 `from` that names
// a base is kept as the base; any other `from` (the old "spawn anywhere") falls
// back to the default base — the From picker is retired. A v2 `spawn` (an
// aerodrome id) is the developer's override the perf rigs set (rollout_perf
// --from, master_bench setFrom): not on any picker, read by the roll-out only.
// ============================================================
const FLIGHT_BASE_DEFAULT = 'HOME';
// one row per base: the aerodrome it stands on and the words a picker shows
const FLIGHT_BASES = {
  HOME: { id: 'HOME', aero: 'HOME', name: 'Home base', hangar: 'the WWII hangar' },
};
// THE BASES ARE DERIVED FROM THE HANGARS HELD (G2230 PREM-S2, GAME-PREMISES ruling gp1): handed the player's
// document, a base is every aerodrome where a hangar is held (70_player.js / 71_player_bases.js: `sheds[id].base`),
// in the order HOME first, then by id; each row carries its hangars. HOME's row is FLIGHT_BASES.HOME's words
// verbatim, so the sandbox (the starter club at HOME, nothing else held) reads exactly as before. Without a document
// (the gates, the rigs) the registry above answers, as it always did.
function flightBasesOf(doc) {
  const S = (doc && doc.sheds && typeof doc.sheds === 'object') ? doc.sheds : null;
  if (!S) return FLIGHT_BASES;
  const out = {};
  const ids = Object.keys(S).filter(id => S[id] && typeof S[id] === 'object' && typeof S[id].base === 'string')
    .sort((a, b) => (a === 'HOME' ? -1 : b === 'HOME' ? 1 : (a < b ? -1 : a > b ? 1 : 0)));
  for (const id of ids) {
    const aero = S[id].base;
    if (!out[aero]) {
      const B = FLIGHT_BASES[aero];
      const O = typeof BASE_OFFERS === 'object' ? BASE_OFFERS[aero] : null;
      const sh = typeof SHELLS === 'object' && SHELLS[S[id].shell];
      out[aero] = B ? Object.assign({}, B, { hangars: [] })
        : { id: aero, aero, name: S[id].name || (O && O.words ? O.words.split(' · ')[0] : aero),
            hangar: 'the ' + ((sh && sh.name) || S[id].shell || 'hangar').toLowerCase(), hangars: [] };
    }
    out[aero].hangars.push(id);
  }
  return Object.keys(out).length ? out : FLIGHT_BASES;
}
// the bases this world has: the aerodrome exists and is not a meadow (`doc`: the player's document - the held hangars)
function flightBases(world, doc) {
  const L = (world && world.aerodromes) || [];
  const R = doc ? flightBasesOf(doc) : FLIGHT_BASES;
  const out = [];
  for (const id of Object.keys(R)) {
    const B = R[id], a = L.find(x => x.id === B.aero);
    if (a && a.kind !== 'meadow') out.push(Object.assign({}, B, { a }));
  }
  return out;
}
// the base `id`, else the default, else the first — null in a world with none
function flightBase(world, id, doc) {
  const L = flightBases(world, doc);
  return L.find(b => b.id === id) || L.find(b => b.id === FLIGHT_BASE_DEFAULT) || L[0] || null;
}

// ---- WHERE THE AEROPLANE IS (the derived From) ------------------------------------
// -> { kind, aero, id, d, along, cross }
//   kind  'airborne' | 'runway' | 'water' (on a water lane) | 'stand' | 'apron' (on the airfield, off
//         its strip: the apron, a taxiway, the grass beside) | 'out' (nowhere near an aerodrome)
//   aero  the aerodrome record that kind is about (the nearest for 'airborne' / 'out'), d its distance
// The strip is its record's rectangle (len x wid about x, z along hdg) with a margin; the airfield is
// FLIGHT_FIELD_R m round the strip (a site's stand and its taxi graph lie well inside it: HOME's stand
// is 150 m off 13/31, the far end of Jolene's club apron 280 m). opts.air: the aeroplane is flying.
const FLIGHT_FIELD_R = 450;
const FLIGHT_STAND_R = 25;
function flightStripGeom(a, x, z) {
  const ux = Math.cos(a.hdg || 0), uz = Math.sin(a.hdg || 0);
  const rx = x - a.x, rz = z - a.z;
  const along = rx * ux + rz * uz, cross = -rx * uz + rz * ux;
  const ea = Math.max(0, Math.abs(along) - (a.len || 0) / 2), ec = Math.max(0, Math.abs(cross) - (a.wid || 30) / 2);
  return { along, cross, d: Math.hypot(ea, ec) };   // d: 0 on the strip, the distance to its rectangle off it
}
function flightWhere(world, x, z, opts) {
  opts = opts || {};
  const L = ((world && world.aerodromes) || []).filter(a => a.kind !== 'meadow');
  let best = null;
  for (const a of L) {
    const g = flightStripGeom(a, x, z);
    // a strip under the aeroplane wins over the airfield of another (Jolene's 02/20 crosses 13/31)
    const k = g.d + (g.d > 0 ? 1e-3 : 0);
    if (!best || k < best.k) best = { a, g, k };
  }
  if (!best) return { kind: opts.air ? 'airborne' : 'out', aero: null, id: null, d: Infinity, along: 0, cross: 0 };
  const a = best.a, g = best.g;
  const out = { kind: 'out', aero: a, id: a.id, d: g.d, along: g.along, cross: g.cross };
  if (opts.air) { out.kind = 'airborne'; return out; }
  const wet = a.kind === 'water' || !!a.water || +a.surface === 4;
  if (g.d <= 5 && Math.abs(g.along) <= (a.len || 0) / 2 + 30) { out.kind = wet ? 'water' : 'runway'; return out; }
  if (wet) { out.kind = g.d <= FLIGHT_FIELD_R ? 'water' : 'out'; return out; }
  const st = typeof siteOf === 'function' ? siteOf(a.id) : null;
  if (st && st.stand && Math.hypot(x - st.stand.x, z - st.stand.z) <= FLIGHT_STAND_R) { out.kind = 'stand'; return out; }
  if (g.d <= FLIGHT_FIELD_R) out.kind = 'apron';
  return out;
}
// may a departure be planned from here? On an aerodrome (a strip, a lane, its stand or apron) - not out in
// a field and not in the air (an air change is a re-plan, not a departure)
function flightCanDepart(where) {
  return !!where && !!where.aero && ['runway', 'water', 'stand', 'apron'].includes(where.kind);
}

// ---- THE TO -------------------------------------------------------------------------
// The choices a picker offers for a gear (25_airfield.js stripAllows: wheels anywhere but water, floats on
// water only, ...): every aerodrome but the meadows, each with its surface word and, when this gear may not
// use it, why. 'CIRCUIT' first: the field the aeroplane is at.
function flightToChoices(world, gear) {
  const out = [{ id: 'CIRCUIT', name: 'Circuit', label: '⟳ Circuit here', ok: true, why: '' }];
  for (const a of ((world && world.aerodromes) || [])) {
    if (a.kind === 'meadow') continue;
    const S = typeof stripSurface === 'function' ? stripSurface(a) : null;
    const A = typeof stripAllows === 'function' ? stripAllows(gear || 'wheels', a) : { ok: true, why: '' };
    out.push({ id: a.id, name: a.name || a.id, surface: S ? S.word : '',
               label: (a.name || a.id) + (a.flyIn ? ' (fly-in)' : '') + (S ? ' · ' + S.word : '') + (A.ok ? '' : ' — ' + A.why),
               ok: A.ok, why: A.why });
  }
  return out;
}
// the TO as the pilot is handed it: 'CIRCUIT' (or nothing) is the field `here` is at; an id this world has
// and this gear may use is that aerodrome; anything else falls back to the circuit at `here`, `why` saying so
function flightToRecord(world, gear, toId, here) {
  const L = (world && world.aerodromes) || [];
  const at = here || null;
  if (!toId || toId === 'CIRCUIT') return { to: at, circuit: true, why: '' };
  const a = L.find(x => x.id === toId);
  if (!a || a.kind === 'meadow') return { to: at, circuit: true, why: 'no aerodrome ' + toId + ' here' };
  const A = typeof stripAllows === 'function' ? stripAllows(gear || 'wheels', a) : { ok: true, why: '' };
  if (!A.ok) return { to: at, circuit: true, why: (a.name || a.id) + ': ' + A.why };
  return { to: a, circuit: !!at && a === at, why: '' };
}

// THE NEXT LEG, as the page chains it (app.js nextLeg / setTo) and GATE DESTTO flies it: the From is the
// aerodrome under the aeroplane (flightWhere), the To the record for `toId` (flightToRecord). `legFrom` is the
// field the flying leg left (a circuit picked in the air goes back there). -> { from, to, where, depart, why }
// `depart`: a departure may be planned from here (flightCanDepart); in the air it is false - that is a re-plan
function flightLeg(world, gear, x, z, toId, opts) {
  opts = opts || {};
  const where = flightWhere(world, x, z, { air: !!opts.air });
  const from = (where.kind !== 'airborne' && where.aero) ? where.aero : (opts.legFrom || where.aero || null);
  const R = flightToRecord(world, gear, toId, from);
  return { from, to: R.to || from, where, depart: flightCanDepart(where), circuit: R.circuit, why: R.why };
}

// ---- THE PREF, MIGRATED --------------------------------------------------------------
// v1 (G710) { from, dest } -> v2 { v: 2, base, to }; a v2 is passed through (its spawn kept). `isBase(id)`
// says whether an id names a base (the world's, when it is known; FLIGHT_BASES otherwise)
function flightRouteMigrate(saved, isBase) {
  const base0 = FLIGHT_BASE_DEFAULT;
  const isB = typeof isBase === 'function' ? isBase : (id => !!FLIGHT_BASES[id]);
  const r = { v: 2, base: base0, to: 'CIRCUIT', spawn: null, migrated: false };
  if (!saved || typeof saved !== 'object') return r;
  if (saved.v === 2) {
    if (typeof saved.base === 'string' && isB(saved.base)) r.base = saved.base;
    if (typeof saved.to === 'string' && saved.to) r.to = saved.to;
    if (typeof saved.spawn === 'string' && saved.spawn) r.spawn = saved.spawn;
    return r;
  }
  r.migrated = true;
  if (typeof saved.from === 'string' && isB(saved.from)) r.base = saved.from;
  if (typeof saved.dest === 'string' && saved.dest) r.to = saved.dest;
  return r;
}
