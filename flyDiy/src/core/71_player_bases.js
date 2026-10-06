// ===========================================================================
// THE GAME PREMISES — bases, hangars, and where every aeroplane stands.
// (G2095, futureDesigns/GAME-PREMISES-2026-10-06.md — the first slice: the
// data model and the rules, pure, node-tested by GATE GAMEPREM.)
// ===========================================================================
// THE WORDS. The player sees "premises" (the release's name). The code says
// `player*` / `hangar*` / `BASE_OFFERS`, because PREMISES_* is already the
// world editor's record (27_premises.js) and the two must never be confused:
// that one says where a field's buildings stand; this one says which of them
// the player HOLDS and what is parked inside.
//
// THE MODEL (all of it lives in the player document, 70_player.js v2):
//   a BASE      an aerodrome where the player holds at least one hangar —
//               DERIVED from the sheds' `base`, never stored twice.
//   a HANGAR    `doc.sheds[id]`: one of the three garage presets (SHELLS:
//               field / club / works) with its OWN dims, kits and dress — the
//               unique interior — plus `base`, `tenure` (own | rent). Its id
//               is the PLOT it stands on (BASE_OFFERS), so a plot is held at
//               most once by construction. HOME's starter is plot HOME.
//   the FLEET   `doc.fleet[slotName]` = { hangar, aero, foot? }: inside a
//               hangar (hangar set, aero = its base) or tied down outside at
//               an aerodrome (hangar null). A slot is one airframe — the
//               flydiy.build.* envelope stays the file cabinet.
//   MONEY       `doc.mode`: 'sandbox' records what things WOULD cost and
//               charges nothing (today's game, and every migrated profile);
//               'career' charges the wallet. The rules are the same in both.
//
// THE RULES THIS FILE HOLDS (GATE GAMEPREM proves each, and each refusal
// leaves the document exactly as it came — every operation works on a
// clone and returns { ok, doc, why }):
//   CAPACITY    an aeroplane is IN a hangar only if its span passes the
//               door and the whole set inside packs on the floor beside the
//               fit-out (hangarPark). Repacked from scratch every time — the
//               hangar crew shuffles; history never decides what fits.
//   STORING     wheel in / wheel out at the base the aeroplane stands at.
//   MOVING      only by flying it (playerArrive after a stop): into a hangar
//               of yours with room there, else tied down outside. A flight
//               that ends anywhere else (a crash, a field, the page closed)
//               moves nothing — the aeroplane is where it departed from
//               (playerRecover charges the trip home in career).
//   HOLDING     acquire a free plot (own: the price; rent: per flown hour),
//               release an EMPTY hangar (never the last one), upgrade shell
//               / dims / kits only while everything inside still fits.
//
// Pure: no THREE, no DOM, no storage. Reads SHELLS / HANGAR_KITS / hangarFit
// / hangarFootprint / hangarCaps (26_hangar_fit.js), GP_PARKED_DEFAULT
// (25_airfield.js) and the document helpers of 70_player.js.
// ===========================================================================

// ---- WHAT CAN BE HELD -----------------------------------------------------
// Per aerodrome id (Jolene's, the island the game plays; the analytic world
// has HOME only): its plots, keyed by the HANGAR ID a holder gets. The first
// plot of a field is the field's own id, so v1's `sheds.HOME` IS plot HOME.
//   shells   which of the three presets that plot takes (a hill strip has
//            no room for a works; a seaplane base's slipway takes a timber
//            shed or a club)
//   kits     what comes with it — a derelict shed with a bench in it
//            (HANGARS §6's fantasy) is a plot whose kits say so
//   pf       the price factor on the shell's price: remote is cheaper
//   dims     per shell, the size this plot's shed is offered at (inside the
//            shell's lims) — the unique interior starts here: Tamgas Hill's
//            field shed is wide enough for a Cub's 10.8 m (door 12 m), the
//            mine's derelict one is the bare 14 m shed that takes a Jodel
//            and nothing wider, the seaplane bases' are tall enough for floats
// w2 (02/20) is HOME's own field and gets no plot of its own; East Point
// Clearing (150 m) has tie-downs and nothing to build on. The plot's
// PLACE in the world (x, z, door heading) is the premises record's —
// session 3 (GAME-PREMISES §5); HOME's is the club hangar G434 stood.
const BASE_OFFERS = {
  HOME: {
    words: 'Jolene AFB · the WWII field',
    plots: {
      HOME: { shells: ['club', 'works', 'field'], kits: null, pf: 1, starter: true,
              dims: { field: { HW: 9, HD: 10, EAVE: 4.0 } } },
      'HOME.2': { shells: ['works', 'club', 'field'], kits: ['park'], pf: 1,
                  dims: { field: { HW: 9, HD: 10, EAVE: 4.0 } } },
    },
  },
  w3: {
    words: 'Tamgas Hill · a strip above the trees',
    plots: { w3: { shells: ['field'], kits: ['park', 'bench'], pf: 0.8,
                   dims: { field: { HW: 8.5, HD: 9, EAVE: 3.6 } } } },
  },
  tw_ski: {
    words: 'Skyline Altiport · snow, and a short slope',
    plots: { tw_ski: { shells: ['field', 'club'], kits: ['park'], pf: 0.9,
                       dims: { field: { HW: 9, HD: 10, EAVE: 4.0 } } } },
  },
  mn_strip: {
    words: 'Jumbo Mine · a derelict shed on the street',
    plots: { mn_strip: { shells: ['field'], kits: ['park', 'bench', 'curio'], pf: 0.5, derelict: true } },
  },
  SEA: {
    words: 'Annette Dock · a slipway',
    plots: { SEA: { shells: ['field', 'club'], kits: ['park', 'store'], pf: 1, water: true,
                    dims: { field: { HW: 9, HD: 10, EAVE: 4.4 } } } },
  },
  mk_sea: {
    words: 'Metlakatla · the seaplane float',
    plots: { mk_sea: { shells: ['field'], kits: ['park'], pf: 0.8, water: true,
                       dims: { field: { HW: 9, HD: 10, EAVE: 4.4 } } } },
  },
};

// The money, declared in one place (calibration is P5a's; these are the
// defaults GAME-PREMISES §4 proposes, every one an open question there).
// A stock Cub's ledger is ~30 000 (genShakedown on GEN_DEFAULT).
const PREM_RATES = {
  clubPrice: 10000,      // SHELLS.club.price is 0 because it is the starter; a club bought elsewhere is not
  rentPerHour: 0.01,     // a rented hangar costs this share of its price per FLOWN hour (time runs in flight, ruling ax)
  resale: 0.5,           // an owned hangar released returns this share of what it cost
  rebuildCredit: 0.5,    // a shell swapped in place credits this share of the old shell's price
  recoverBase: 200,      // a recovery by road: a call-out...
  recoverKm: 25,         // ...and this per km home
  labourFit: 0.8,        // repairs / edits in a hangar that has every verb the aeroplane wants
  labourShort: 1.0,      // ...that lacks one
  labourAway: 1.25,      // ...with no hangar of yours (a field's mechanic)
  ledgerMax: 200,
};
// what a kit costs to fit (the starter's kits came with it); nothing refunds a kit
const KIT_PRICES = { park: 0, bench: 800, wood: 2500, metal: 3500, store: 300, handling: 600,
                     office: 1500, comfort: 900, curio: 0, wip: 0 };

// ---- THE ROOM, AS A FLOOR --------------------------------------------------
// A hangar's dims: the shell's defaults under the shed's own, per key (the
// page's setShell always writes them explicitly; the starter's absent dims
// are the club's, which is the site's declaration too — playerShedDims).
function hangarDims(shed) {
  const sh = (typeof SHELLS !== 'undefined' && SHELLS[shed && shed.shell]) || SHELLS.club;
  const d = (shed && shed.dims) || {};
  const pick = k => (typeof d[k] === 'number' && isFinite(d[k]) && d[k] > 0) ? d[k] : sh.dims[k];
  return { HW: pick('HW'), HD: pick('HD'), EAVE: pick('EAVE') };
}
// THE DOOR, hangar.js's own two lines (GATE GAMEPREM source-scans them so the
// two cannot drift): nearly the whole gable end; the portal's header takes
// 1.4 m under the eave (6.4 at most), the timber lintel 0.5.
function hangarDoor(shed) {
  const D = hangarDims(shed);
  const sh = (typeof SHELLS !== 'undefined' && SHELLS[shed && shed.shell]) || SHELLS.club;
  const timber = sh.frame === 'timber';
  return { w: Math.max(6, 2 * D.HW - 5), h: timber ? D.EAVE - 0.5 : Math.min(6.4, D.EAVE - 1.4) };
}
// What the fit-out stands on the floor: every prop and recipe hangarFit
// PLACED (an unplaced one stands nowhere), as a plan rectangle at its
// footprint — full height, conservatively: a high wing passing over a low
// bench is a later refinement (GAME-PREMISES Q9), and it can only add room.
function hangarObstacles(shed, reg) {
  if (typeof hangarFit !== 'function') return [];
  const kits = (shed && Array.isArray(shed.kits) && shed.kits.length) ? shed.kits : ['park'];
  const fit = hangarFit(hangarDims(shed), kits, { shell: (shed && shed.shell) || 'club', reg });
  const orient = (f, ry) => (Math.round((ry || 0) / (Math.PI / 2)) & 1) ? [f[1], f[0]] : [f[0], f[1]];
  const out = [];
  for (const p of fit.placed) {
    const f = orient(hangarFootprint(p.prop, reg), p.ry);
    out.push({ key: p.prop, x0: p.x - f[0], x1: p.x + f[0], z0: p.z - f[1], z1: p.z + f[1] });
  }
  for (const r of fit.recipes) {
    const K = HANGAR_KITS[r.kit], row = K && K.recipes.find(q => q.recipe === r.recipe);
    if (!row || !row.foot) continue;
    const f = orient(row.foot, r.ry);
    out.push({ key: r.recipe, x0: r.x - f[0], x1: r.x + f[0], z0: r.z - f[1], z1: r.z + f[1] });
  }
  return out;
}

// ---- PARKING ----------------------------------------------------------------
// An aeroplane's plan footprint is 25_airfield.js's: { half (the half-span),
// fwd (nose and prop ahead of the engine mount), aft (the tail behind it),
// h? (the height, when measured) }. A build nobody measured yet is the
// default single (GP_PARKED_DEFAULT: 12 m span) — wrong for a microlight, but
// wrong in the safe direction.
const PARK_CLR = 0.5;        // round every parked aeroplane: 1 m wingtip to wingtip, 0.5 m to a wall
const PARK_DOOR_CLR = 0.3;   // each side of the span, through the door
const PARK_STEP = 0.5;       // the packer's scan, metres
function parkFoot(f) {
  const d = (typeof GP_PARKED_DEFAULT !== 'undefined') ? GP_PARKED_DEFAULT : [6.0, 1.6, 6.6];
  const n = (v, def) => (typeof v === 'number' && isFinite(v) && v > 0) ? v : def;
  const o = { half: n(f && f.half, d[0]), fwd: n(f && f.fwd, d[1]), aft: n(f && f.aft, d[2]) };
  if (f && typeof f.h === 'number' && isFinite(f.h) && f.h > 0) o.h = f.h;
  return o;
}
// does it pass the door? -> '' or why not
function hangarDoorWhy(shed, foot) {
  const door = hangarDoor(shed), f = parkFoot(foot);
  const span = 2 * f.half;
  if (span + 2 * PARK_DOOR_CLR > door.w)
    return 'the span (' + span.toFixed(1) + ' m) does not pass the ' + door.w.toFixed(1) + ' m door';
  if (f.h && f.h > door.h - 0.1)
    return 'the height (' + f.h.toFixed(1) + ' m) does not pass the ' + door.h.toFixed(1) + ' m door';
  return '';
}
// THE PACKER. hangarPark(shed, planes[{ name, foot }], opts{ reg }) ->
//   { placed[{ name, x, z, rect }], unplaced[{ name, why }], door, dims, area, used, how }
// with placed.length + unplaced.length === planes.length, always (opts.bail,
// hangarRoomFor's own, stops at the first miss and does not hold that).
// In the room's frame (hangar.js): doors at -x, x across the depth (+-HD),
// z across the width (+-HW). Every aeroplane is parked NOSE TO THE DOOR.
// First fit, biggest first (keep-out area, then name — deterministic), each
// scanned from the BACK wall forward. Two orders across the width, the better
// kept (more placed; a tie keeps the first): from the CENTRE line outward —
// a lone aeroplane stands in the middle of the bay, as the garage shows it —
// and from the WALL across, which packs a bare shed two abreast. The scan is
// a 0.5 m grid plus every position flush against a wall, the fit-out or an
// aeroplane already parked (the corner points a hand would try first).
function hangarPark(shed, planes, opts) {
  const D = hangarDims(shed), door = hangarDoor(shed);
  const obs = hangarObstacles(shed, opts && opts.reg);
  const list = (planes || []).map(p => {
    const f = parkFoot(p.foot);
    return { name: p.name, f, lx: f.fwd + f.aft + 2 * PARK_CLR, lz: 2 * (f.half + PARK_CLR) };
  });
  list.sort((a, b) => (b.lx * b.lz - a.lx * a.lz) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const hit = (r, q) => r.x0 < q.x1 - 1e-9 && r.x1 > q.x0 + 1e-9 && r.z0 < q.z1 - 1e-9 && r.z1 > q.z0 + 1e-9;
  const run = how => {
    const placed = [], unplaced = [], rects = [];
    for (const p of list) {
      const why = hangarDoorWhy(shed, p.f);
      if (why) { unplaced.push({ name: p.name, why }); continue; }
      // the engine mount's range: the keep-out rectangle inside the walls
      const cxHi = D.HD - p.f.aft - PARK_CLR, cxLo = -D.HD + p.f.fwd + PARK_CLR;
      const czHi = D.HW - p.f.half - PARK_CLR, czLo = -czHi;
      let got = null;
      if (cxHi >= cxLo - 1e-9 && czHi >= -1e-9) {
        const near = obs.concat(rects);
        const xs = new Set(), zs = new Set();
        for (let x = cxHi; x >= cxLo - 1e-9; x -= PARK_STEP) xs.add(+x.toFixed(3));
        for (let k = 0; k * PARK_STEP <= czHi + 1e-9; k++) { zs.add(+(k * PARK_STEP).toFixed(3)); zs.add(+(-k * PARK_STEP).toFixed(3)); }
        xs.add(+cxLo.toFixed(3)); zs.add(+czHi.toFixed(3)); zs.add(+czLo.toFixed(3));
        for (const o of near) {
          xs.add(+(o.x0 - p.f.aft - PARK_CLR).toFixed(3)); xs.add(+(o.x1 + p.f.fwd + PARK_CLR).toFixed(3));
          zs.add(+(o.z0 - p.f.half - PARK_CLR).toFixed(3)); zs.add(+(o.z1 + p.f.half + PARK_CLR).toFixed(3));
        }
        const X = Array.from(xs).filter(x => x <= cxHi + 1e-9 && x >= cxLo - 1e-9).sort((a, b) => b - a);
        const Z = Array.from(zs).filter(z => z <= czHi + 1e-9 && z >= czLo - 1e-9)
          .sort(how === 'centre' ? ((a, b) => (Math.abs(a) - Math.abs(b)) || (b - a)) : ((a, b) => a - b));
        for (const cx of X) {
          const x0 = cx - p.f.fwd - PARK_CLR, x1 = cx + p.f.aft + PARK_CLR;
          const band = near.filter(o => x0 < o.x1 - 1e-9 && x1 > o.x0 + 1e-9);   // what this depth meets
          for (const cz of Z) {
            const r = { x0, x1, z0: cz - p.f.half - PARK_CLR, z1: cz + p.f.half + PARK_CLR };
            if (band.some(o => hit(r, o))) continue;
            got = { name: p.name, x: cx, z: cz, rect: r };
            break;
          }
          if (got) break;
        }
      }
      if (got) { placed.push(got); rects.push(got.rect); }
      else {
        unplaced.push({ name: p.name, why: 'no floor left' + (obs.length ? ' beside the fit-out' : '') });
        if (opts && opts.bail) break;     // hangarRoomFor's yes / no: the first miss answers it
      }
    }
    return { placed, unplaced, rects, how };
  };
  let best = run('centre');
  if (best.unplaced.length) {
    const w = run('wall');
    if (w.placed.length > best.placed.length) best = w;
  }
  const area = 4 * D.HW * D.HD;
  const used = best.rects.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  return { placed: best.placed, unplaced: best.unplaced, door, dims: D, area, used, how: best.how };
}
// how many of THIS aeroplane the hangar takes beside what is in it (the
// premises screen's "room for 2 more Cubs"): the largest n for which the
// residents and n copies all pack — a binary search, five packs not twenty
// (the packer is monotone in practice: one more copy never makes room).
// Capped at 24: it is a readout, not a census.
function hangarRoomFor(shed, foot, residents, opts) {
  if (hangarDoorWhy(shed, foot)) return 0;
  const base = (residents || []).slice();
  const fits = n => {
    const extra = [];
    for (let i = 0; i < n; i++) extra.push({ name: '\u0000room' + String(i).padStart(2, '0'), foot });
    return !hangarPark(shed, base.concat(extra), Object.assign({}, opts, { bail: true })).unplaced.length;
  };
  if (!fits(1)) return 0;
  let lo = 1, hi = 2;                       // doubling, then halving: a full shed answers in a few packs
  while (hi <= 24 && fits(hi)) { lo = hi; hi *= 2; }
  if (hi > 24) { if (fits(24)) return 24; hi = 24; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fits(m)) lo = m; else hi = m; }
  return lo;
}

// ---- THE DOCUMENT -----------------------------------------------------------
const pbClone = o => JSON.parse(JSON.stringify(o));
const pbNo = (doc, why) => ({ ok: false, doc, why });
// the hangars held at an aerodrome, sorted (the order a choice is made in)
function playerHangarsAt(doc, aero) {
  const S = (doc && doc.sheds) || {};
  return Object.keys(S).filter(id => S[id] && S[id].base === aero).sort();
}
// the bases: the aerodromes the player holds a hangar at, sorted
function playerBaseIds(doc) {
  const S = (doc && doc.sheds) || {}, out = new Set();
  for (const id of Object.keys(S)) if (S[id] && typeof S[id].base === 'string') out.add(S[id].base);
  return Array.from(out).sort();
}
function playerResidents(doc, hangarId) {
  const F = (doc && doc.fleet) || {};
  return Object.keys(F).filter(n => F[n] && F[n].hangar === hangarId).sort();
}
function playerFootOf(doc, name, foots) {
  return parkFoot((foots && foots[name]) || (doc && doc.fleet && doc.fleet[name] && doc.fleet[name].foot));
}
// where an aeroplane stands -> { kind: 'in' | 'out' (tied down at a base of
// yours) | 'away' (tied down where you hold nothing) | 'none', hangar, aero }
function playerWhere(doc, name) {
  const e = doc && doc.fleet && doc.fleet[name];
  if (!e) return { kind: 'none', hangar: null, aero: null };
  if (e.hangar && doc.sheds[e.hangar]) return { kind: 'in', hangar: e.hangar, aero: doc.sheds[e.hangar].base };
  const aero = e.aero || null;
  return { kind: aero && playerHangarsAt(doc, aero).length ? 'out' : 'away', hangar: null, aero };
}
// would this set stand in that hangar? (the residents + the newcomers)
function playerPack(doc, hangarId, names, foots, opts) {
  const shed = doc.sheds[hangarId];
  return hangarPark(shed, names.map(n => ({ name: n, foot: playerFootOf(doc, n, foots) })), opts);
}
// the money door: career charges, sandbox records what it would have cost
function playerCharge(doc, amt, k, ref) {
  amt = Math.round(amt || 0);
  if (!amt) return doc;
  const free = doc.mode !== 'career';
  if (!free) doc.wallet -= amt;
  doc.ledger.push({ k, amt, ref: ref || null, clock: Math.round(doc.clock || 0), free });
  if (doc.ledger.length > PREM_RATES.ledgerMax) doc.ledger.splice(0, doc.ledger.length - PREM_RATES.ledgerMax);
  return doc;
}
const pbAfford = (doc, cost) => doc.mode !== 'career' || doc.wallet >= cost;

// ---- THE FLEET LIFT (the first load of a v2 game, and every load after) ------
// Every saved slot is an airframe the player owns, so it must stand
// somewhere: a slot the ledger does not know is lifted to the `here` hangar's
// base — inside while the packer finds room, then any other hangar there,
// then the tie-downs outside. NOTHING IS REFUSED: an old save with forty
// builds keeps all forty at HOME, every one flyable from the stand as today.
// A ledger row whose slot is gone (deleted, in this tab or another) goes too.
// Idempotent: reconciling a reconciled document changes nothing.
function playerFleetReconcile(doc, slotNames, opts) {
  const d = pbClone(doc), names = Array.from(new Set(slotNames || [])).sort();
  const want = new Set(names), lifted = [], dropped = [];
  for (const n of Object.keys(d.fleet).sort())
    if (!want.has(n)) { delete d.fleet[n]; dropped.push(n); }
  const home = d.sheds[d.here] ? d.sheds[d.here].base : 'HOME';
  const order = [d.here].concat(playerHangarsAt(d, home).filter(id => id !== d.here));
  for (const n of names) {
    if (d.fleet[n]) continue;
    d.fleet[n] = { hangar: null, aero: home };
    const foots = opts && opts.foots;
    if (foots && foots[n]) d.fleet[n].foot = parkFoot(foots[n]);
    let at = null;
    for (const id of order) {
      if (!d.sheds[id]) continue;
      const P = playerPack(d, id, playerResidents(d, id).concat([n]), foots, opts);
      if (!P.unplaced.length) { at = id; break; }
    }
    d.fleet[n].hangar = at;
    lifted.push({ name: n, kind: at ? 'in' : 'out', hangar: at, aero: home });
  }
  return { ok: true, doc: d, lifted, dropped };
}

// ---- STORING: in and out, at the base it stands at ----------------------------
function playerStore(doc, name, hangarId, foots, opts) {
  const e = doc.fleet[name], shed = doc.sheds[hangarId];
  if (!e) return pbNo(doc, name + ' is not in the fleet');
  if (!shed) return pbNo(doc, 'no hangar ' + hangarId);
  const W = playerWhere(doc, name);
  if (W.aero !== shed.base) return pbNo(doc, name + ' is at ' + W.aero + ': fly it to ' + shed.base + ' first');
  if (e.hangar === hangarId) return { ok: true, doc, why: 'already inside' };
  const why = hangarDoorWhy(shed, playerFootOf(doc, name, foots));
  if (why) return pbNo(doc, why);
  const P = playerPack(doc, hangarId, playerResidents(doc, hangarId).concat([name]), foots, opts);
  if (P.unplaced.length) return pbNo(doc, 'no room in ' + hangarId + ' (' + P.unplaced.map(u => u.name + ': ' + u.why).join('; ') + ')');
  const d = pbClone(doc);
  d.fleet[name].hangar = hangarId;
  d.fleet[name].aero = shed.base;
  return { ok: true, doc: d, why: '' };
}
function playerWheelOut(doc, name) {
  const e = doc.fleet[name];
  if (!e) return pbNo(doc, name + ' is not in the fleet');
  if (!e.hangar) return { ok: true, doc, why: 'already outside' };
  const d = pbClone(doc), W = playerWhere(doc, name);
  d.fleet[name].hangar = null;
  d.fleet[name].aero = W.aero;
  return { ok: true, doc: d, why: '' };
}

// ---- MOVING: only by flying it ---------------------------------------------------
// The flight STOPPED on aerodrome `aero` (flightWhere's aero id; the page
// calls this only for a named build that stopped on an aerodrome, whole).
// Back at the base it left, it goes back into the hangar it left (its room
// was never given away — nothing moves in the document while it flies).
// Anywhere else: the first hangar of yours there that takes it (opts.prefer
// first), else the tie-downs. -> { ok, doc, kind: 'in' | 'out' | 'away', hangar }
function playerArrive(doc, name, aero, opts) {
  opts = opts || {};
  const e = doc.fleet[name];
  if (!e) return pbNo(doc, name + ' is not in the fleet');
  if (!aero) return pbNo(doc, 'no aerodrome: an aeroplane stopped off-field is recovered, not arrived');
  const W = playerWhere(doc, name);
  if (W.aero === aero && W.kind === 'in') return { ok: true, doc, kind: 'in', hangar: W.hangar, why: 'back where it left' };
  const d = pbClone(doc);
  d.fleet[name].hangar = null;
  d.fleet[name].aero = aero;
  if (opts.foots && opts.foots[name]) d.fleet[name].foot = parkFoot(opts.foots[name]);
  const ids = playerHangarsAt(d, aero);
  const order = (opts.prefer && ids.includes(opts.prefer)) ? [opts.prefer].concat(ids.filter(i => i !== opts.prefer)) : ids;
  for (const id of order) {
    if (hangarDoorWhy(d.sheds[id], playerFootOf(d, name, opts.foots))) continue;
    const P = playerPack(d, id, playerResidents(d, id).concat([name]), opts.foots, opts);
    if (!P.unplaced.length) { d.fleet[name].hangar = id; return { ok: true, doc: d, kind: 'in', hangar: id, why: '' }; }
  }
  return { ok: true, doc: d, kind: ids.length ? 'out' : 'away', hangar: null,
           why: ids.length ? 'no room inside: tied down outside' : 'no hangar of yours here: tied down' };
}
// A flight that ended off an aerodrome, in a wreck, or was abandoned: the
// aeroplane never left the document's place for it, so recovery moves
// nothing — it charges the road home (career) from `opts.km` away.
function playerRecover(doc, name, opts) {
  if (!doc.fleet[name]) return pbNo(doc, name + ' is not in the fleet');
  const km = Math.max(0, (opts && +opts.km) || 0);
  const fee = PREM_RATES.recoverBase + PREM_RATES.recoverKm * km;
  const d = playerCharge(pbClone(doc), fee, 'recover', name);
  return { ok: true, doc: d, fee: Math.round(fee), why: '' };
}

// ---- HOLDING: acquire, release, upgrade -----------------------------------------
function shellPrice(shell) {
  const S = (typeof SHELLS !== 'undefined') && SHELLS[shell];
  if (!S) return NaN;
  return S.price || (shell === 'club' ? PREM_RATES.clubPrice : 0);
}
function plotPrice(aero, plotId, shell) {
  const P = BASE_OFFERS[aero] && BASE_OFFERS[aero].plots[plotId];
  return P ? Math.round(shellPrice(shell) * (P.pf || 1)) : NaN;
}
// the offers this world has, each plot with its state: held | free
function playerOffers(doc, world) {
  const L = (world && world.aerodromes) || null;
  const out = [];
  for (const aero of Object.keys(BASE_OFFERS)) {
    const a = L ? L.find(x => x.id === aero && x.kind !== 'meadow') : null;
    if (L && !a) continue;
    const O = BASE_OFFERS[aero];
    for (const plot of Object.keys(O.plots)) {
      const P = O.plots[plot];
      out.push({ aero, plot, name: a ? (a.name || aero) : aero, words: O.words, held: !!(doc && doc.sheds[plot]),
                 shells: P.shells.map(s => ({ shell: s, price: plotPrice(aero, plot, s),
                                              rent: Math.round(plotPrice(aero, plot, s) * PREM_RATES.rentPerHour) })),
                 kits: P.kits ? P.kits.slice() : null, water: !!P.water, derelict: !!P.derelict });
    }
  }
  return out;
}
function playerAcquire(doc, aero, plotId, shell, tenure) {
  const O = BASE_OFFERS[aero], P = O && O.plots[plotId];
  if (!P) return pbNo(doc, 'nothing to hold at ' + aero + ' / ' + plotId);
  if (doc.sheds[plotId]) return pbNo(doc, plotId + ' is already yours');
  if (!P.shells.includes(shell) || !SHELLS[shell] || SHELLS[shell].status !== 'live')
    return pbNo(doc, 'a ' + shell + ' does not stand on ' + plotId);
  tenure = tenure === 'rent' ? 'rent' : 'own';
  const price = plotPrice(aero, plotId, shell);
  const cost = tenure === 'own' ? price : 0;
  if (!pbAfford(doc, cost)) return pbNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', the ' + shell + ' costs ' + cost);
  const d = pbClone(doc);
  d.sheds[plotId] = {
    shell, kits: (P.kits || HANGAR_KITS_DEFAULT).slice(), base: aero, tenure,
    dims: Object.assign({}, SHELLS[shell].dims, (P.dims && P.dims[shell]) || {}), price, since: Math.round(d.clock || 0),
  };
  playerCharge(d, cost, 'acquire', plotId);
  return { ok: true, doc: d, hangar: plotId, cost, why: '' };
}
function playerRelease(doc, hangarId) {
  const shed = doc.sheds[hangarId];
  if (!shed) return pbNo(doc, 'no hangar ' + hangarId);
  const inside = playerResidents(doc, hangarId);
  if (inside.length) return pbNo(doc, hangarId + ' is not empty: ' + inside.join(', '));
  const ids = Object.keys(doc.sheds).filter(id => doc.sheds[id] && typeof doc.sheds[id] === 'object');
  if (ids.length <= 1) return pbNo(doc, 'the last hangar cannot go: a player always has a door to open');
  const d = pbClone(doc);
  delete d.sheds[hangarId];
  if (d.here === hangarId) {
    const same = playerHangarsAt(d, shed.base);
    d.here = same.length ? same[0] : Object.keys(d.sheds).sort()[0];
  }
  const back = shed.tenure === 'own' ? (+shed.price || 0) * PREM_RATES.resale : 0;
  playerCharge(d, -back, 'release', hangarId);
  return { ok: true, doc: d, refund: Math.round(back), why: '' };
}
// what a change costs: { cost, lines[{ what, cost }] }
// change = { shell?, dims?: { HW?, HD?, EAVE? }, kits?: [...] }; `plotId` (the
// hangar's id) applies its plot's price factor to the building work — a shed
// extended at the mine costs what the mine's shed cost; kits are the same
// price everywhere
function playerUpgradeCost(shed, change, plotId) {
  const lines = [];
  const next = pbNextShed(shed, change);
  const O = BASE_OFFERS[shed.base], P = O && plotId && O.plots[plotId], pf = (P && P.pf) || 1;
  const price = sk => shellPrice(sk) * pf;
  if (change.shell && change.shell !== shed.shell) {
    const c = price(next.shell) - PREM_RATES.rebuildCredit * (+shed.price || price(shed.shell));
    lines.push({ what: 'rebuild as ' + SHELLS[next.shell].name, cost: Math.max(0, Math.round(c)) });
  } else {
    const a0 = hangarDims(shed), a1 = hangarDims(next), d0 = SHELLS[next.shell].dims;
    const grow = 4 * (a1.HW * a1.HD - a0.HW * a0.HD);
    if (grow > 1e-6) lines.push({ what: 'extend by ' + Math.round(grow) + ' m²',
                                  cost: Math.round(price(next.shell) * grow / (4 * d0.HW * d0.HD)) });
    if (a1.EAVE > a0.EAVE + 1e-6) lines.push({ what: 'raise the eave',
                                               cost: Math.round(price(next.shell) * 0.1 * (a1.EAVE - a0.EAVE) / d0.EAVE) });
  }
  const had = new Set(shed.kits || []);
  for (const k of next.kits) if (!had.has(k)) lines.push({ what: 'fit the ' + (HANGAR_KITS[k] ? HANGAR_KITS[k].name : k), cost: KIT_PRICES[k] || 0 });
  return { cost: lines.reduce((s, l) => s + l.cost, 0), lines: lines.filter(l => l.cost > 0) };
}
function pbNextShed(shed, change) {
  const n = pbClone(shed);
  if (change.shell && change.shell !== shed.shell) { n.shell = change.shell; n.dims = Object.assign({}, SHELLS[change.shell].dims); }
  if (change.dims) n.dims = Object.assign(hangarDims(n), change.dims);
  if (Array.isArray(change.kits)) n.kits = HANGAR_KITS_DEFAULT.filter(k => k === 'park' || change.kits.includes(k));
  return n;
}
function playerUpgrade(doc, hangarId, change, opts) {
  const shed = doc.sheds[hangarId];
  if (!shed) return pbNo(doc, 'no hangar ' + hangarId);
  change = change || {};
  if (change.shell && (!SHELLS[change.shell] || SHELLS[change.shell].status !== 'live')) return pbNo(doc, 'no shell ' + change.shell);
  const O = BASE_OFFERS[shed.base], P = O && O.plots[hangarId];
  if (change.shell && P && !P.shells.includes(change.shell)) return pbNo(doc, 'a ' + change.shell + ' does not stand on ' + hangarId);
  if (Array.isArray(change.kits) && change.kits.some(k => !HANGAR_KITS[k])) return pbNo(doc, 'no such kit');
  const next = pbNextShed(shed, change);
  const L = shellLims(next.shell), D = hangarDims(next);
  for (const k of ['HW', 'HD', 'EAVE'])
    if (D[k] < L[k][0] - 1e-9 || D[k] > L[k][1] + 1e-9) return pbNo(doc, k + ' ' + D[k] + ' is outside the ' + next.shell + "'s " + L[k][0] + '..' + L[k][1]);
  const inside = playerResidents(doc, hangarId);
  if (inside.length) {
    const R = hangarPark(next, inside.map(n => ({ name: n, foot: playerFootOf(doc, n, opts && opts.foots) })), opts);
    if (R.unplaced.length) return pbNo(doc, 'it would no longer hold ' + R.unplaced.map(u => u.name).join(', ') + ': wheel them out first');
  }
  const C = playerUpgradeCost(shed, change, hangarId);
  if (!pbAfford(doc, C.cost)) return pbNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', the work costs ' + C.cost);
  const d = pbClone(doc);
  if (change.shell && change.shell !== shed.shell) next.price = P ? plotPrice(shed.base, hangarId, change.shell) : shellPrice(change.shell);
  d.sheds[hangarId] = next;
  playerCharge(d, C.cost, 'upgrade', hangarId);
  return { ok: true, doc: d, cost: C.cost, lines: C.lines, why: '' };
}

// ---- THE GARAGE'S DOOR, THE CLOCK, THE LABOUR ------------------------------------
// which hangar the garage opens in (the premises screen's "go there"):
// instant — the pilot travels with the aeroplanes (GAME-PREMISES Q7)
function playerGoTo(doc, hangarId) {
  if (!doc.sheds[hangarId]) return pbNo(doc, 'no hangar ' + hangarId);
  const d = pbClone(doc);
  d.here = hangarId;
  return { ok: true, doc: d, why: '' };
}
// TIME RUNS IN FLIGHT (GAME-LAYER ruling ax): the page hands every flight's
// seconds here at its end; a rented hangar's dues accrue on them.
function playerClock(doc, seconds) {
  const s = Math.max(0, +seconds || 0);
  const d = pbClone(doc);
  d.clock = (d.clock || 0) + s;
  let dues = 0;
  for (const id of Object.keys(d.sheds)) {
    const h = d.sheds[id];
    if (h && h.tenure === 'rent') dues += (+h.price || 0) * PREM_RATES.rentPerHour * s / 3600;
  }
  playerCharge(d, dues, 'rent', null);
  return { ok: true, doc: d, dues: Math.round(dues), why: '' };
}
// what the hangar's fit-out does to a repair / an edit's labour (DMG-D5's
// bill multiplies its labour lines by this): every verb the aeroplane wants
// (hangarWants) present -> labourFit; one missing -> labourShort; no hangar
// of yours (an aeroplane away) -> labourAway
function playerLabourFactor(shed, wants) {
  if (!shed) return PREM_RATES.labourAway;
  const caps = new Set(typeof hangarCaps === 'function' ? hangarCaps(shed) : []);
  return (wants || []).every(w => caps.has(w)) ? PREM_RATES.labourFit : PREM_RATES.labourShort;
}
