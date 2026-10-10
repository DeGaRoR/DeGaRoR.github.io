// ===========================================================================
// THE CONTRACTS (G2240 CONTRACT-MODEL) — the record, its kinds and criteria,
// what a validated design can physically do, the pay, the seeded job
// generator, the follow-up build contract, and a stage's acceptance from a
// flight's end. futureDesigns/GAME-2026-10-06.md §R, §6, §7.3, §11, §12.3.
// ===========================================================================
// THE RECORD (§7.3, exactly):
//   { id, provider, kind: 'contract'|'job'|'challenge'|'build'|'survey',
//     title, brief,                                    text KEYS (72_'s CONTRACT_TEXT)
//     stages: [ { subs: [ { do, from?, to?, at?, load?: {kg, pax, bulk?}, when?: (G2650 windows), crit?: [...],
//                           medals? } ] } ],           stages IN ORDER, a stage's subs in ANY order
//     pay: { base, perKm?, km?, total?, bonus?: [ {crit, by, pct} ] },
//     rep: { provider, gain },
//     unlock?: { stage: '<track>:<n>' },              §11: a construction stage
//     needs?: { rep?, after?: [id] },
//     repeat?: false | { every: <contracts done> },
//     followUp?: { prefer?: [k], add?: [crit], changed: [ {k, how, from, to} ], n } }   build contracts (GQ26)
//   `do`: carry (a load from -> to) | fly (from? -> to, a challenge's medals) | land (at `to`) |
//         survey (over `at`, departing `from`) | deliver (a build contract: the airframe lands at `to`, its
//         `crit` judged by ACCEPT's hook) | accept (the criteria alone, judged by the hook, anywhere).
//
// RULINGS THIS FILE HOLDS (GATE CONTRACTS proves each, --selftest breaks each):
//   G-COST  pay depends on the JOB, never on the aeroplane: contractPay reads the job and the fields, and
//           nothing else. No running costs anywhere.
//   az      no validated design does every job class — through PHYSICAL gates only (contractCanDo): the
//           gear against the surface, the loaded take-off distance against the strip, the cabin against
//           the load, the bulk against the cabin, the range against the leg.
//   GQ26    one build contract = one delivery; a happy client offers a FOLLOW-UP with ONE criterion
//           changed (contractFollowUp), paid +15 % (GQ31), never repeating a change.
//   (g1)    a build contract states performance, never a configuration (CONTRACT_CONFIG_WORDS).
//   GQ17    no wall-clock deadlines: a `when` is a condition of the flight ("before dusk"); amended (§R.3, G2650):
//           a time-of-day window on the sim clock ("after dusk", "arrive 06:00-08:00"), met by flying or waiting.
//
// Pure: no DOM, no THREE, no storage. Reads 72_'s tables, and (when present) 25_'s stripAllows /
// 70_-71_'s player helpers at call time.
// ===========================================================================

const CONTRACT_KINDS = ['contract', 'job', 'challenge', 'build', 'survey'];
const CONTRACT_DO = ['carry', 'fly', 'land', 'survey', 'deliver', 'accept'];
const CONTRACT_OPS = ['>=', '<=', '=='];

// ---- THE CRITERION KINDS (data: ACCEPT implements each kind, MAP labels each) -----------------------------
//   k        the key a criterion names            unit   the value's unit ('' for a word, 'strip' for a field id)
//   when     'static' (judged without flying: the phone may do it, GQ19) | 'flown' (a flight decides it)
//   how      'spec' | 'ledger' | 'cert' (the structural certificate) | 'bench' (a BENCH_TESTS run) |
//            'leg' (the flown acceptance leg) | 'strip' (flown at that strip: the delivery or a demonstration)
//   src      where today's number comes from (GAME §6.2)
//   op       the operators the kind takes; band the sane values [lo, hi] (a criterion outside is invalid)
//   at       the conditions the kind may carry: pax / kg (the load it is judged at), reserveMin, fuelMin, tasKmh
//   follow   the follow-up's change (GQ26): `mul` or `add` toward the harder side, `round` its step; null =
//            this kind is never the one changed (a strip, a powertrain: the follow-up ADDs those)
//   values   the words a word-valued kind takes
const CONTRACT_CRIT_KINDS = {
  seats:        { k: 'seats',        unit: 'seats', when: 'static', how: 'spec',   src: 'cabin.seats + the occupied stations',
                  op: ['>='], band: [1, 8], follow: { add: 1 } },
  emptyKg:      { k: 'emptyKg',      unit: 'kg',    when: 'static', how: 'ledger', src: 'genShakedown empty (nobody aboard, no fuel)',
                  op: ['<='], band: [150, 2500], follow: { mul: 0.9, round: 5 } },
  powertrain:   { k: 'powertrain',   unit: '',      when: 'static', how: 'spec',   src: 'the energy module (60c_gen_energy.js) energyKind',
                  op: ['=='], values: ['electric', 'fuel', 'diesel'], follow: null },
  tankL:        { k: 'tankL',        unit: 'L',     when: 'static', how: 'spec',   src: 'the vessel litres (genShakedown energyL)',
                  op: ['<='], band: [5, 400], follow: { mul: 0.8, round: 1 } },
  batteryKWh:   { k: 'batteryKWh',   unit: 'kWh',   when: 'static', how: 'spec',   src: 'the cells\' kWh (60c_gen_energy.js)',
                  op: ['<='], band: [2, 200], follow: { mul: 0.85, round: 1 } },
  spanM:        { k: 'spanM',        unit: 'm',     when: 'static', how: 'spec',   src: 'genShakedown span (and GAME-PREMISES\' door rule)',
                  op: ['<='], band: [5, 20], follow: { add: -0.5, round: 0.5 } },
  costMax:      { k: 'costMax',      unit: 'credits', when: 'static', how: 'ledger', src: 'genShakedown cost (the bill)',
                  op: ['<='], band: [5000, 300000], follow: { mul: 0.9, round: 500 } },
  ultimateG:    { k: 'ultimateG',    unit: 'g',     when: 'static', how: 'cert',   src: 'the structural certificate (66_gen_cert.js ultimate)',
                  op: ['>='], band: [3, 12], follow: { add: 0.5, round: 0.5 } },
  xwindKt:      { k: 'xwindKt',      unit: 'kt',    when: 'flown',  how: 'bench',  src: 'BENCH_TESTS xwind (genCrosswindLimit)',
                  op: ['>='], band: [5, 30], follow: { add: 3, round: 1 } },
  hydro:        { k: 'hydro',        unit: '',      when: 'flown',  how: 'bench',  src: 'BENCH_TESTS hydro + the delivery on water',
                  op: ['=='], values: [true], follow: null },
  tasKmh:       { k: 'tasKmh',       unit: 'km/h',  when: 'flown',  how: 'leg',    src: 'the acceptance leg: TAS in a stabilised cruise at the load (`at`)',
                  op: ['>='], band: [60, 450], at: ['pax', 'kg'], follow: { mul: 1.1, round: 5 } },
  enduranceMin: { k: 'enduranceMin', unit: 'min',   when: 'flown',  how: 'leg',    src: 'the acceptance leg: the measured flow x the tank, less the reserve',
                  op: ['>='], band: [10, 600], at: ['pax', 'kg', 'reserveMin', 'tasKmh'], follow: { add: 15, round: 5 } },
  rangeKm:      { k: 'rangeKm',      unit: 'km',    when: 'flown',  how: 'leg',    src: 'the acceptance leg: groundspeed x the measured endurance, calm air',
                  op: ['>='], band: [20, 3000], at: ['pax', 'kg', 'reserveMin'], follow: { mul: 1.2, round: 10 } },
  takeoffAt:    { k: 'takeoffAt',    unit: 'strip', when: 'flown',  how: 'strip',  src: 'flown at that strip: the logbook row\'s departure',
                  op: ['=='], at: ['pax', 'kg', 'fuelMin'], follow: null },
  landAt:       { k: 'landAt',       unit: 'strip', when: 'flown',  how: 'strip',  src: 'flown at that strip: the delivery\'s arrival',
                  op: ['=='], at: ['pax', 'kg', 'fuelMin'], follow: null },
};

// ---- (g1) A BUILD CRITERION NEVER NAMES A CONFIGURATION ---------------------------------------------------
// The words (whole words, any case) no build contract's criteria or text may hold: wing positions, gear
// layouts, engine and airframe makers and models, structures. "floats" / "water" are an OPERATION (hydro),
// not a configuration, and are allowed (GQ26 names "floats" as a follow-up change).
const CONTRACT_CONFIG_WORDS = ['high wing', 'high-wing', 'low wing', 'low-wing', 'mid wing', 'shoulder wing',
  'parasol', 'tricycle', 'nosewheel', 'nose wheel', 'nose-wheel', 'taildragger', 'tail dragger', 'tail-dragger',
  'tailwheel', 'tail wheel', 'conventional gear', 'biplane', 'monoplane', 'canard', 'pusher', 'tractor',
  'twin boom', 'twin-boom', 'twin engine', 'twin-engine', 'retractable', 'strut', 'struts', 'braced',
  'cantilever', 'tube-and-fabric', 'rotax', 'lycoming', 'continental', 'jabiru', 'cessna', 'piper', 'cub',
  'jodel', 'beaver', 'cherokee', 'citabria', 'super cub', 'two-stroke', 'four-stroke', 'flat four', 'flat-four'];

// ---- THE FIT RULES (what a validated design can physically do; az through physical gates) ------------------
//   occKg    an occupant's mass (the envelope's station mass: 80 kg)
//   surf     the take-off distance's factor on each surface (a soft or rough strip lengthens the run)
//   bulkSeats a bulk load needs the rear seats out of a cabin of at least this many seats
//   rangeUse the share of the certified range a leg may use (the rest is the reserve)
// The loaded take-off distance is the certificate's toM scaled by (W / W0)^2 — the textbook first-order law
// (the run goes as W^2 / (rho S CLmax T)); it is the conservative side of genTORunAt's lift-only probe.
// BOTH ends are held to it: the aeroplane lands there loaded and must leave again.
const CONTRACT_FIT = {
  occKg: 80,
  surf: { concrete: 1.0, asphalt: 1.0, paved: 1.0, gravel: 1.1, dirt: 1.1, sand: 1.25, grass: 1.15, snow: 1.3, water: 1.0 },
  bulkSeats: 4,
  rangeUse: 0.75,
};

// ---- THE PAY (§12.3 as amended by G-COST: net, no running costs) -----------------------------------------
//   job pay = base(provider) + perKm x km x (1 + payload factor) + surface bonus + conditions
//   payload factor = kg / kgUnit + pax x paxF (+ bulkF for a bulk load)
//   surface bonus per distinct field the job touches: short (a strip <= shortM), water, snow, altiport
//   conditions: a `when` adds condPct of the rest
//   (G2430 CONTRACT-ROUTES) PER LEG: each stage pays its own km x (1 + its own load's factor), and a job with more
//   than one destination (contractDests) adds chainPct % of the legs' pay per destination beyond the first. A
//   one-leg job pays exactly what it did. The positioning flight to the first stop is the player's, never paid.
// Arcs and build contracts carry an authored base; a follow-up pays followPct more (GQ31).
// G2260 (ECONOMY owns these numbers: the calibration, 76_economy.js ECON_BANDS, GATE ECON):
//   baseF   the provider's job base (CONTRACT_PROVIDERS[p].base, its relative weight) x this
//   story   an authored contract / survey / challenge's base x this (a build contract's base is priced against
//           the airframe it asks for and is paid as written)
const CONTRACT_PAY = {
  perKm: 160, kgUnit: 150, paxF: 0.5, bulkF: 0.5,
  surf: { short: 1100, water: 800, snow: 950, altiport: 1350 }, shortM: 400,
  condPct: 15, round: 10,
  chainPct: 10,
  followPct: 15,
  baseF: 2.7, story: 2.6,
};
// an authored record's base as paid (the story factor on everything but a build contract)
const contractStoryBase = rec => ((rec.pay && rec.pay.base) || 0) * (rec.kind === 'build' ? 1 : CONTRACT_PAY.story);

// ---- THE GENERATOR (seeded: the career seed + the completed count) ---------------------------------------
//   refreshEvery  the offers refresh after this many completed contracts (the epoch = floor(done / it))
//   perProvider   jobs offered per provider per epoch
//   tries         a drawn job no validated design can do is shrunk (its load halved, a passenger dropped) or
//                 redrawn up to this many times
//   condP         the chance a job carries a condition (before dusk)
//   repLoad       the load drawn grows with the provider's reputation: lo + (hi-lo) x (repLoad[0] + repLoad[1] x rep/5)
const CONTRACT_GEN = { refreshEvery: 3, perProvider: 3, tries: 8, condP: 0.25, repLoad: [0.4, 0.6], repMax: 5 };
const CONTRACT_DUSK_H = 19.5;          // "before dusk": the world's local hour at the stop (stopRecord.hour)
const CONTRACT_DAWN_H = 5;             // (G2650) "before dawn" / the end of "after dusk": the same local hour
// ---- THE TIME-OF-DAY WINDOWS (G2650 SIM-CLOCK; GQ17 amended, §R.3: no wall-clock deadline, but a window on the
// sim clock, met by flying or by WAITING it out on the ground). A sub's `when` is one of:
//   { before: 'dusk' }      arrive while it is still day: the hour < dusk                     (as since G2240)
//   { after: 'dusk' }       arrive in the night: the hour >= dusk or < dawn (the night wraps midnight)
//   { before: 'dawn' }      arrive in the small hours: midnight <= the hour < dawn
//   { arrive: [h0, h1] }    arrive between two LOCAL hours, h0 <= hour < h1 (h0 > h1 wraps midnight: [22, 2])
// judged on stop.hour (the world's local hour at the stop) against dusk / dawn: the stop's own `duskH` / `dawnH`
// when it carries them (the almanac's, 07b_clock.js dayDuskDawnH - NIGHT-OPS' call to pass them), else the
// constants above. An unknown hour refuses nothing (the decision needs the fact).
const CONTRACT_WHEN_KINDS = ['before:dusk', 'after:dusk', 'before:dawn', 'arrive'];
const ctHours = v => typeof v === 'number' && isFinite(v) && v >= 0 && v <= 24;
// '' when the window is one of the vocabulary's, else why not
function contractWhenWhy(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return '`when` must be an object';
  const k = Object.keys(w);
  if (k.length !== 1) return '`when` takes one time of day, got ' + (k.join(', ') || 'none');
  if (w.before === 'dusk' || w.after === 'dusk' || w.before === 'dawn') return '';
  if ('arrive' in w) {
    const a = w.arrive;
    if (!Array.isArray(a) || a.length !== 2 || !a.every(ctHours) || a[0] === a[1]) return '`when.arrive` must be two different local hours [h0, h1] in 0-24';
    return '';
  }
  return '`when` must be {before: \'dusk\'}, {after: \'dusk\'}, {before: \'dawn\'} or {arrive: [h0, h1]} (a time of day, never a deadline: GQ17)';
}
const ctPad2 = n => String(n).padStart(2, '0');
const ctHhmm = h => { const m = Math.round(h * 60) % 1440; return ctPad2(Math.floor(m / 60)) + ':' + ctPad2(m % 60); };
// the window in words, for the paragraph and the route line: "before dusk", "arrive 06:00-08:00"
function contractWhenWords(w) {
  if (!w || contractWhenWhy(w)) return '';
  if (w.before === 'dusk') return 'before dusk';
  if (w.after === 'dusk') return 'after dusk';
  if (w.before === 'dawn') return 'before dawn';
  return 'arrive ' + ctHhmm(w.arrive[0]) + '-' + ctHhmm(w.arrive[1]);
}
// '' when the stop's hour is inside the window (or unknown), else why not ("after dusk (21.0 h)")
function contractWhenOk(w, stop) {
  const h = stop && stop.hour;
  if (!w || typeof h !== 'number' || !isFinite(h)) return '';
  const dusk = typeof stop.duskH === 'number' && isFinite(stop.duskH) ? stop.duskH : CONTRACT_DUSK_H;
  const dawn = typeof stop.dawnH === 'number' && isFinite(stop.dawnH) ? stop.dawnH : CONTRACT_DAWN_H;
  const at = ' (' + h.toFixed(1) + ' h)';
  if (w.before === 'dusk') return h >= dusk ? 'after dusk' + at : '';
  if (w.after === 'dusk') return (h >= dusk || h < dawn) ? '' : 'before dusk' + at;
  if (w.before === 'dawn') return h < dawn ? '' : 'after dawn' + at;
  if (Array.isArray(w.arrive)) {
    const a = w.arrive[0], b = w.arrive[1];
    const inside = a < b ? (h >= a && h < b) : (h >= a || h < b);
    return inside ? '' : 'outside ' + ctHhmm(a) + '-' + ctHhmm(b) + at;
  }
  return '';
}
const CONTRACT_FOLLOW_MAX = 3;         // a chain of follow-ups stops after this many (or when no change is left)

// ---- small pure helpers ------------------------------------------------------------------------------------
const ctClone = o => JSON.parse(JSON.stringify(o));
// FNV-1a 32 over a string, then mulberry32: the same string, the same numbers, on every machine
function contractHash(s) {
  let h = 0x811c9dc5;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
function contractRng(key) {
  let a = contractHash(key);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ctField = (id, fields) => (fields || CONTRACT_FIELDS)[id] || null;
function contractKm(a, b, fields) {
  const A = ctField(a, fields), B = ctField(b, fields);
  if (!A || !B) return NaN;
  return Math.hypot(A.x - B.x, A.z - B.z) / 1000;
}
const ctWet = f => !!f && f.surf === 'water';

// THE FIELDS OF A WORLD: the same rows off the world's aerodromes (a premises record's runways or
// world.aerodromes: `c` or x/z, len, the surface through 25_'s stripSurface). GATE CONTRACTS holds
// CONTRACT_FIELDS equal to this over Jolene's record.
function contractFieldsOf(aerodromes) {
  const out = {};
  for (const a of (aerodromes || [])) {
    if (!a || !a.id || a.kind === 'meadow') continue;
    const x = Array.isArray(a.c) ? a.c[0] : a.x, z = Array.isArray(a.c) ? a.c[1] : a.z;
    const S = typeof stripSurface === 'function' ? stripSurface(a) : null;
    const row = { id: a.id, name: a.name || a.id, x: Math.round(x), z: Math.round(z), len: Math.round(a.len || 0),
                  surf: S ? S.key : (+a.surface === 4 ? 'water' : 'grass') };
    if (a.altiport) row.alti = true;
    out[a.id] = row;
  }
  return out;
}

// ---- THE TEXT ----------------------------------------------------------------------------------------------
// a key's words with its {slots} filled; an unknown key reads as the key itself in brackets (visible, never a
// crash) and contractTextOk says so
function contractText(key, vars, text) {
  const T = text || CONTRACT_TEXT;
  const e = T[key];
  let s = e ? e.t : '[' + key + ']';
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}
const contractTextOk = (key, text) => typeof key === 'string' && !!(text || CONTRACT_TEXT)[key]
  && typeof (text || CONTRACT_TEXT)[key].t === 'string';
// the load as words: "40 kg of tools", "2 passengers", "drill rods (80 kg, the cabin cleared)"
function contractLoadWords(load, goodsWord, text) {
  const what = goodsWord ? contractText(goodsWord, null, text) : '';
  if (!load) return what;
  if (load.bulk) return contractText('load.bulk', { what, n: load.kg || 0 }, text);
  if (load.pax > 0 && !(load.kg > 0)) return load.pax === 1 ? contractText('load.pax1', null, text) : contractText('load.pax', { n: load.pax }, text);
  if (load.kg > 0) return contractText('load.kg', { n: load.kg, what }, text);
  return contractText('load.none', { what }, text);
}
// every key a record names (title, brief, a build's follow-up line, its criteria's labels, the goods word)
function contractKeys(rec) {
  const ks = [rec.title, rec.brief];
  if (rec.goods) ks.push(rec.goods);
  if (rec.shape && CONTRACT_THEN[rec.shape]) ks.push(CONTRACT_THEN[rec.shape]);
  for (const st of rec.stages || []) for (const s of st.subs || []) if (s.goods) ks.push(s.goods);
  if (rec.kind === 'build') ks.push(contractFollowKey(rec));
  const ch = rec.followUp && rec.followUp.changed && rec.followUp.changed[rec.followUp.changed.length - 1];
  if (ch) ks.push('follow.' + ch.how);
  for (const st of rec.stages || []) for (const s of st.subs || []) for (const c of s.crit || []) ks.push('crit.' + c.k);
  return ks;
}
const contractFollowKey = rec => 'ct.' + String(rec.base || rec.id).split('+')[0] + '.follow';
// a criterion as words (MAP's card): its label with the value (a strip by its name) and the load it is judged at
function contractCritWords(c, fields, text) {
  const F = fields || CONTRACT_FIELDS, K = CONTRACT_CRIT_KINDS[c.k] || {};
  const v = K.unit === 'strip' ? (F[c.v] ? F[c.v].name : c.v) : (c.v === true ? '' : c.v);
  let at = '';
  if (c.at && (c.at.pax || c.at.kg)) at = 'with ' + contractLoadWords({ kg: c.at.kg || 0, pax: c.at.pax || 0 }, 'goods.kit', text);
  return contractText('crit.' + c.k, { v, at }, text).replace(/\s+$/, '');
}
// a follow-up's change as words (GQ26): "and now: ...", or "<criterion>: more / less than before"
function contractFollowLine(rec, text) {
  const ch = rec && rec.followUp && rec.followUp.changed && rec.followUp.changed[rec.followUp.changed.length - 1];
  if (!ch) return '';
  const c = contractCrit(rec).find(x => x.k === ch.k);
  return contractText('follow.' + ch.how, { k: c ? contractCritWords(c, null, text) : ch.k }, text);
}

// ---- THE NORMALISER --------------------------------------------------------------------------------------
// Fills what is missing, carries what is present verbatim (unknown fields ride along: a newer game's field
// survives a round trip). Pure: returns a new object.
function contractNormalise(r) {
  const o = (r && typeof r === 'object') ? ctClone(r) : {};
  if (typeof o.id !== 'string') o.id = '';
  if (typeof o.provider !== 'string') o.provider = '';
  if (!CONTRACT_KINDS.includes(o.kind)) o.kind = 'contract';
  if (typeof o.title !== 'string') o.title = '';
  if (typeof o.brief !== 'string') o.brief = '';
  if (!Array.isArray(o.stages)) o.stages = [];
  o.stages = o.stages.map(st => {
    const S = (st && typeof st === 'object') ? st : {};
    S.subs = Array.isArray(S.subs) ? S.subs.map(s => {
      const u = (s && typeof s === 'object') ? s : {};
      if (u.load && typeof u.load === 'object') {
        u.load.kg = Math.max(0, +u.load.kg || 0);
        u.load.pax = Math.max(0, Math.round(+u.load.pax || 0));
        if (u.load.bulk == null) delete u.load.bulk;
        // (G2340 FREIGHT) a load's items ride along, each normalised (76_freight.js freightItem)
        if (u.load.items != null) {
          if (Array.isArray(u.load.items) && typeof freightItem === 'function') u.load.items = u.load.items.map(freightItem);
          else if (!Array.isArray(u.load.items)) delete u.load.items;
        }
      }
      if (u.crit != null && !Array.isArray(u.crit)) u.crit = [];
      return u;
    }) : [];
    return S;
  });
  if (!o.pay || typeof o.pay !== 'object') o.pay = { base: 0 };
  if (typeof o.pay.base !== 'number' || !isFinite(o.pay.base)) o.pay.base = 0;
  if (!o.rep || typeof o.rep !== 'object') o.rep = { provider: o.provider, gain: 0 };
  if (typeof o.rep.provider !== 'string') o.rep.provider = o.provider;
  if (typeof o.rep.gain !== 'number' || !isFinite(o.rep.gain)) o.rep.gain = 0;
  if (o.needs != null && typeof o.needs !== 'object') delete o.needs;
  if (o.needs) {
    if (!Array.isArray(o.needs.after)) o.needs.after = [];
    if (typeof o.needs.rep !== 'number' || !isFinite(o.needs.rep)) o.needs.rep = 0;
  }
  if (o.repeat == null) o.repeat = o.kind === 'job' ? { every: CONTRACT_GEN.refreshEvery } : false;
  if (o.kind === 'build') {
    if (!o.followUp || typeof o.followUp !== 'object') o.followUp = {};
    if (!Array.isArray(o.followUp.changed)) o.followUp.changed = [];
    if (!Array.isArray(o.followUp.prefer)) o.followUp.prefer = [];
    if (!Array.isArray(o.followUp.add)) o.followUp.add = [];
    if (typeof o.followUp.n !== 'number') o.followUp.n = o.followUp.changed.length;
  }
  return o;
}

// ---- THE VALIDATOR -----------------------------------------------------------------------------------------
// -> [ 'reason', ... ] (empty = valid). opts.text: the text table; opts.fields; opts.ids: the ids `after` may name
function contractCritWhy(c) {
  const K = c && CONTRACT_CRIT_KINDS[c.k];
  if (!K) return 'unknown criterion kind ' + (c && c.k);
  if (!K.op.includes(c.op)) return c.k + ': operator ' + c.op + ' not one of ' + K.op.join(' ');
  if (K.unit === 'strip') { if (!ctField(c.v)) return c.k + ': no field ' + c.v; }
  else if (K.values) { if (!K.values.includes(c.v)) return c.k + ': ' + c.v + ' not one of ' + K.values.join(' '); }
  else if (typeof c.v !== 'number' || !isFinite(c.v) || c.v < K.band[0] || c.v > K.band[1])
    return c.k + ': ' + c.v + ' outside ' + K.band[0] + '..' + K.band[1] + ' ' + K.unit;
  if (c.at != null) {
    if (typeof c.at !== 'object') return c.k + ': `at` is not an object';
    for (const a of Object.keys(c.at)) if (!(K.at || []).includes(a)) return c.k + ': `at.' + a + '` not a condition of this kind';
  }
  return '';
}
function contractConfigWord(s) {
  const t = ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ') + ' ';
  for (const w of CONTRACT_CONFIG_WORDS) if (t.includes(' ' + w + ' ')) return w;
  return '';
}
function contractValidate(rec, opts) {
  opts = opts || {};
  const T = opts.text || CONTRACT_TEXT, F = opts.fields || CONTRACT_FIELDS;
  const why = [];
  const r = rec || {};
  const id = r.id || '(no id)';
  if (typeof r.id !== 'string' || !r.id) why.push(id + ': no id');
  if (!CONTRACT_KINDS.includes(r.kind)) why.push(id + ': kind ' + r.kind + ' is not one of ' + CONTRACT_KINDS.join(' '));
  if (!CONTRACT_PROVIDERS[r.provider]) why.push(id + ': no provider ' + r.provider);
  for (const k of ['title', 'brief']) if (!contractTextOk(r[k], T)) why.push(id + ': ' + k + ' key ' + r[k] + ' does not resolve');
  if (!Array.isArray(r.stages) || !r.stages.length) why.push(id + ': no stages');
  (r.stages || []).forEach((st, i) => {
    if (!st || !Array.isArray(st.subs) || !st.subs.length) { why.push(id + ': stage ' + i + ' has no subs'); return; }
    st.subs.forEach((s, j) => {
      const at = id + ' ' + i + '.' + j;
      if (!CONTRACT_DO.includes(s.do)) { why.push(at + ': do ' + s.do + ' is not one of ' + CONTRACT_DO.join(' ')); return; }
      for (const f of ['from', 'to', 'at']) if (s[f] != null && !F[s[f]]) why.push(at + ': no field ' + s[f]);
      if ((s.do === 'carry' || s.do === 'fly') && (!s.to || (s.do === 'carry' && !s.from))) why.push(at + ': ' + s.do + ' needs from and to');
      if (s.goods != null && !contractTextOk(s.goods, T)) why.push(at + ': goods key ' + s.goods + ' does not resolve');
      if ((s.do === 'land' || s.do === 'deliver') && !s.to) why.push(at + ': ' + s.do + ' needs to');
      if (s.do === 'survey' && (!s.at || !s.from)) why.push(at + ': survey needs at and from');
      if (s.do === 'carry') {
        const L = s.load;
        if (!L || !(L.kg >= 0) || !(L.pax >= 0) || !(L.kg > 0 || L.pax > 0)) why.push(at + ': carry needs a load (kg or pax)');
        // (G2340 FREIGHT) items, when the load has them: known kinds, three dims, and they ARE the load's kilos
        if (L && L.items != null) {
          if (!Array.isArray(L.items)) why.push(at + ': load.items is not a list');
          else {
            if (L.items.some(it => !it || !(typeof FREIGHT_KINDS === 'undefined' || FREIGHT_KINDS[it.kind]) || !Array.isArray(it.dims) || it.dims.length !== 3 || !it.dims.every(v => v > 0)))
              why.push(at + ': an item with an unknown kind or no dims');
            const sum = L.items.reduce((a, it) => a + (+(it && it.kg) || 0), 0);
            if (Math.abs(sum - (L.kg || 0)) > 0.01) why.push(at + ': the items weigh ' + sum + ' kg, the load is ' + L.kg + ' kg');
          }
        }
      }
      if (s.crit != null) {
        if (r.kind !== 'build') why.push(at + ': criteria on a ' + r.kind + ' (build contracts only)');
        for (const c of s.crit) { const w = contractCritWhy(c); if (w) why.push(at + ': ' + w); }
      }
      if ((s.do === 'deliver' || s.do === 'accept') && r.kind !== 'build') why.push(at + ': ' + s.do + ' on a ' + r.kind);
      if (s.when != null) { const ww = contractWhenWhy(s.when); if (ww) why.push(at + ': ' + ww); }
      if (s.medals != null) {
        if (r.kind !== 'challenge' || s.do !== 'fly') why.push(at + ': medals on a non-challenge');
        else if (!s.medals.length || s.medals.some(m => !['gold', 'silver', 'bronze'].includes(m.medal) || !(m.le > 0)))
          why.push(at + ': a medal is {medal: gold|silver|bronze, le: seconds}');
      }
    });
  });
  if (r.kind === 'build') {
    const crit = contractCrit(r);
    if (!crit.length) why.push(id + ': a build contract with no criteria');
    if (!(r.stages || []).some(st => (st.subs || []).some(s => s.do === 'deliver'))) why.push(id + ': a build contract with no delivery');
    if (!r.followUp || !Array.isArray(r.followUp.changed)) why.push(id + ': a build contract with no followUp');
    if (!contractTextOk(contractFollowKey(r), T)) why.push(id + ': follow-up key ' + contractFollowKey(r) + ' does not resolve');
    const seen = {};
    for (const c of crit) { if (seen[c.k]) why.push(id + ': criterion ' + c.k + ' named twice'); seen[c.k] = 1; }
    // (g1) never a configuration: the criteria, and the words the client says
    for (const c of crit) { const w = contractConfigWord(JSON.stringify(c)); if (w) why.push(id + ': criterion ' + c.k + ' names a configuration (' + w + ')'); }
    for (const k of [r.title, r.brief, contractFollowKey(r)]) {
      const w = T[k] && contractConfigWord(T[k].t);
      if (w) why.push(id + ': ' + k + ' names a configuration (' + w + ')');
    }
    for (const c of crit) if (!contractTextOk('crit.' + c.k, T)) why.push(id + ': no label crit.' + c.k);
  }
  if (!r.pay || typeof r.pay.base !== 'number' || !isFinite(r.pay.base) || r.pay.base < 0) why.push(id + ': pay.base must be >= 0');
  for (const b of ((r.pay && r.pay.bonus) || [])) {
    if (b.crit === 'medal') { if (!['gold', 'silver', 'bronze'].includes(b.by)) why.push(id + ': a medal bonus by ' + b.by); }
    else if (!contractCrit(r).some(c => c.k === b.crit)) why.push(id + ': a bonus on ' + b.crit + ', which is not a criterion');
    if (!(b.pct > 0)) why.push(id + ': a bonus with no pct');
  }
  if (!r.rep || !CONTRACT_PROVIDERS[r.rep.provider] || !(r.rep.gain >= 0)) why.push(id + ': rep {provider, gain >= 0}');
  if (r.unlock != null) {
    const m = /^(\w+):(\d+)$/.exec((r.unlock && r.unlock.stage) || '');
    if (!m || !CONTRACT_TRACKS[m[1]] || +m[2] < 1 || +m[2] > CONTRACT_TRACKS[m[1]].max) why.push(id + ': unlock ' + JSON.stringify(r.unlock) + ' is not <track>:<1..max>');
  }
  if (r.needs != null) {
    if (r.needs.after != null && !Array.isArray(r.needs.after)) why.push(id + ': needs.after is not a list');
    for (const a of ((r.needs && r.needs.after) || [])) if (opts.ids && !opts.ids.includes(a)) why.push(id + ': needs.after names ' + a + ', which does not exist');
  }
  return why;
}

// every criterion of a record, in stage / sub order
function contractCrit(rec) {
  const out = [];
  for (const st of (rec && rec.stages) || []) for (const s of st.subs || []) for (const c of s.crit || []) out.push(c);
  return out;
}

// ---- WHAT THE CERTIFICATE CAN SAY (G2320, §R's follow-up to ACCEPT) ------------------------------------------
// The structural certificate is the NORMAL category only (65_gen_loadtest.js: +3.8 g limit, 5.7 g ultimate for every
// certified build): a criterion asking a stronger ultimate (the aerobatic box, "+6 g") is unwinnable until the
// certificate takes a category. Such a contract is HELD OUT: never offered (74_career.js careerOfferIds), so never
// accepted. It stays in the data, ready for the day the certificate can answer it.
const contractCertUlt = () => (typeof GEN_LOAD_ULT === 'number' ? GEN_LOAD_ULT : 5.7);
function contractCertifiable(rec) {
  const ult = contractCertUlt();
  return !contractCrit(rec).some(c => c.k === 'ultimateG' && typeof c.v === 'number' && c.v > ult + 1e-9);
}

// ---- THE AUTHORED CONTRACTS (the arcs and the standalone builds, normalised, by id) -------------------------
function contractAuthored() {
  const out = {};
  for (const p of Object.keys(CONTRACT_PROVIDERS)) {
    const P = CONTRACT_PROVIDERS[p];
    for (const r of P.arc.concat(P.builds || [])) out[r.id] = contractNormalise(r);
  }
  return out;
}

// ---- WHAT A VALIDATED DESIGN CAN DO (az: physical gates only) ------------------------------------------------
// the gear on a field: floats on water only, wheels anywhere but water (25_'s stripAllows; GATE CONTRACTS
// holds this to it on every field x gear)
function contractGearOk(gear, f) {
  if (!f) return false;
  if (gear === 'amphibian') return true;
  if (gear === 'floats') return ctWet(f);
  if (gear === 'skis') return f.surf === 'snow' || f.surf === 'grass';
  return !ctWet(f);
}
// the loaded take-off distance on a field (the certificate's toM, (W/W0)^2, the surface's factor)
function contractTakeoffM(design, loadKg, f) {
  const W0 = design.massKg, W = W0 + Math.max(0, loadKg || 0);
  return design.toM * (W / W0) * (W / W0) * ((f && CONTRACT_FIT.surf[f.surf]) || 1.2);
}
const ctCapKg = D => Math.max(0, D.seats - 1) * CONTRACT_FIT.occKg + (D.bagKg || 0);
// one sub, one design -> { ok, why }
function contractSubFit(D, s, fields) {
  const F = fields || CONTRACT_FIELDS;
  const no = why => ({ ok: false, why: D.label + ': ' + why });
  const ends = [];
  let kg = 0, km = 0;
  if (s.do === 'carry') {
    const L = s.load || {};
    kg = (L.kg || 0) + (L.pax || 0) * CONTRACT_FIT.occKg;
    if ((L.pax || 0) > D.seats - 1) return no((L.pax || 0) + ' passengers, ' + (D.seats - 1) + ' seats beside the pilot');
    if (kg > ctCapKg(D)) return no(kg + ' kg aboard, the cabin takes ' + ctCapKg(D) + ' kg');
    if (L.bulk && D.seats < CONTRACT_FIT.bulkSeats) return no('a bulk load needs a cabin of ' + CONTRACT_FIT.bulkSeats + ' seats cleared');
    // (G2340 FREIGHT) THE VOLUME: a load's items pass a door of this design and pack in its hold with the
    // passengers seated (the empty seats out if need be: the player's call) - the card measured off its mesh
    if (Array.isArray(L.items) && L.items.length && typeof freightFits === 'function') {
      const card = freightCardOf(D);
      if (card) { const v = freightFits(card, L.items, { pax: L.pax || 0 }); if (!v.ok) return no(v.why); }
    }
    ends.push(s.from, s.to); km = contractKm(s.from, s.to, F);
  } else if (s.do === 'fly') { if (s.from) ends.push(s.from); ends.push(s.to); km = s.from ? contractKm(s.from, s.to, F) : 0; }
  else if (s.do === 'land') { ends.push(s.to); }
  else if (s.do === 'survey') { ends.push(s.from); km = 2 * contractKm(s.from, s.at, F); }
  else return { ok: true, why: '' };   // deliver / accept: the delivered design is judged by ACCEPT, not here
  for (const e of ends) {
    const f = F[e];
    if (!f) return no('no field ' + e);
    if (!contractGearOk(D.gear, f)) return no(D.gear + ' cannot use ' + f.name + ' (' + f.surf + ')');
    const run = contractTakeoffM(D, kg, f);
    if (run > f.len) return no('take-off ' + Math.round(run) + ' m with ' + kg + ' kg, ' + f.name + ' is ' + f.len + ' m');
  }
  if (km > D.rangeKm * CONTRACT_FIT.rangeUse) return no(km.toFixed(1) + ' km, the range allows ' + Math.round(D.rangeKm * CONTRACT_FIT.rangeUse));
  return { ok: true, why: '' };
}
// a list of subs (a stage, or a whole job) by ONE design
function contractCanDo(D, subs, fields) {
  for (const s of subs) { const r = contractSubFit(D, s, fields); if (!r.ok) return r; }
  return { ok: true, why: '' };
}
// the validated designs that can fly these subs -> [id]
function contractDoers(subs, fields, designs) {
  const DS = designs || CONTRACT_DESIGNS;
  return Object.keys(DS).filter(k => contractCanDo(DS[k], subs, fields).ok);
}
const contractSubsOf = rec => [].concat(...((rec && rec.stages) || []).map(st => st.subs || []));
const ctFlying = s => s.do !== 'deliver' && s.do !== 'accept';

// ---- THE JOB CLASSES (az: every class has a doer, no design does every class) ---------------------------------
const CONTRACT_JOB_CLASSES = {
  water:    { test: (subs, F) => subs.some(s => ['from', 'to', 'at'].some(k => s[k] && ctWet(F[s[k]]) && !(k === 'at' && s.do === 'survey'))) },
  short:    { test: (subs, F) => subs.some(s => ['from', 'to'].some(k => s[k] && F[s[k]] && !ctWet(F[s[k]]) && F[s[k]].len <= 300)) },
  altiport: { test: (subs, F) => subs.some(s => ['from', 'to'].some(k => s[k] && F[s[k]] && F[s[k]].alti)) },
  group:    { test: subs => subs.some(s => s.load && s.load.pax >= 2) },
  heavy:    { test: subs => subs.some(s => s.load && (s.load.kg || 0) + (s.load.pax || 0) * CONTRACT_FIT.occKg >= 120) },
  bulk:     { test: subs => subs.some(s => s.load && s.load.bulk) },
  survey:   { test: subs => subs.some(s => s.do === 'survey') },
};
function contractClasses(rec, fields) {
  const F = fields || CONTRACT_FIELDS, subs = contractSubsOf(rec);
  return Object.keys(CONTRACT_JOB_CLASSES).filter(k => CONTRACT_JOB_CLASSES[k].test(subs, F));
}

// ---- THE PAY (G-COST: the job's, never the aeroplane's) ----------------------------------------------------
// -> { base, perKm, km, factor, surface, cond, total }. Reads the record and the fields. Nothing else.
function contractPay(rec, fields) {
  const F = fields || CONTRACT_FIELDS, P = CONTRACT_PAY;
  const prov = CONTRACT_PROVIDERS[rec.provider];
  let km = 0, factor = 0, legs = 0, cond = false;
  const touched = {};
  // (G2430) each stage is a leg: its km x (1 + its own load's factor)
  for (const st of rec.stages || []) {
    let skm = 0, kg = 0, pax = 0, bulk = false;
    for (const s of st.subs || []) {
      if (s.do === 'carry' || (s.do === 'fly' && s.from)) skm += contractKm(s.from, s.to, F);
      if (s.do === 'survey') skm += 2 * contractKm(s.from, s.at, F);
      for (const k of ['from', 'to']) if (s[k]) touched[s[k]] = 1;
      if (s.load) { kg = Math.max(kg, s.load.kg || 0); pax = Math.max(pax, s.load.pax || 0); bulk = bulk || !!s.load.bulk; }
      if (s.when) cond = true;
    }
    const f = kg / P.kgUnit + pax * P.paxF + (bulk ? P.bulkF : 0);
    km += skm; factor = Math.max(factor, f); legs += skm * (1 + f);
  }
  let surface = 0;
  for (const id of Object.keys(touched)) {
    const f = F[id];
    if (!f) continue;
    if (ctWet(f)) surface += P.surf.water;
    else if (f.len <= P.shortM) surface += P.surf.short;
    if (f.surf === 'snow') surface += P.surf.snow;
    if (f.alti) surface += P.surf.altiport;
  }
  const base = rec.kind === 'job' ? ((prov && prov.base) || 0) * P.baseF : contractStoryBase(rec);
  const perKm = rec.kind === 'job' ? P.perKm : 0;
  const legPay = perKm * legs;
  const chain = rec.kind === 'job' ? legPay * P.chainPct / 100 * Math.max(0, contractDests(rec) - 1) : 0;
  const rest = base + legPay + chain + (rec.kind === 'job' ? surface : 0);
  const condAdd = cond ? rest * P.condPct / 100 : 0;
  let total = Math.round((rest + condAdd) / P.round) * P.round;
  // G2260 (ECONOMY, GQ6): the Trust's loan job pays what it was offered at (76_ econLoanJob), not a job's rate
  if (rec.loan && rec.pay && typeof rec.pay.total === 'number' && isFinite(rec.pay.total)) total = rec.pay.total;
  return { base, perKm, km: +km.toFixed(2), factor: +factor.toFixed(3), surface: rec.kind === 'job' ? surface : 0,
           chain: Math.round(chain), cond: Math.round(condAdd), total };
}

// ---- THE ROUTES (G2430 CONTRACT-ROUTES, §R.3: two destinations or more, not everything from Jolene AFB) ----------
// THE ISLAND'S JOB FIELDS: every provider's `fields`, in provider order, each once - 72_'s one table to edit (a new
// site named there joins the jobs; one named in no provider's list joins none)
function contractSites(fields) {
  const F = fields || CONTRACT_FIELDS, out = [];
  for (const p of Object.keys(CONTRACT_PROVIDERS)) for (const f of CONTRACT_PROVIDERS[p].fields || []) if (F[f] && !out.includes(f)) out.push(f);
  return out;
}
// a template's pool -> [field id]: 'own' (the provider's fields), 'away' (the job fields not its own), 'all', [ids]
function ctPool(P, pool, F) {
  if (Array.isArray(pool)) return pool.filter(f => F[f]);
  const own = (P.fields || []).filter(f => F[f]);
  if (pool === 'own') return own;
  const sites = contractSites(F);
  return pool === 'away' ? sites.filter(f => !own.includes(f)) : sites;
}
// THE STOPS a record sends the aeroplane to, in order -> [{ at, what: pick|depart|drop|over|land, stage }]. A stage's
// pickups (its departure) come first, then its drops / overflights / landings as written (a stage's subs are in any
// order: this is one order that does them); the same field twice in a row is ONE stop (the chain's hinge: the load
// dropped at B and the next one taken on at B). The positioning flight to the first stop is not a stop: the job
// starts where its first load waits.
function contractStops(rec) {
  const out = [], rank = { pick: 0, depart: 0, land: 1, over: 2, drop: 2 };
  const put = (at, what, stage) => {
    if (!at) return;
    const last = out[out.length - 1];
    if (last && last.at === at) { if (rank[what] > rank[last.what]) last.what = what; return; }
    out.push({ at, what, stage });
  };
  ((rec && rec.stages) || []).forEach((st, i) => {
    const subs = st.subs || [], seen = [];
    for (const s of subs) {
      const f = (s.do === 'carry' || s.do === 'survey' || s.do === 'fly') ? s.from : null;
      if (f && !seen.includes(f)) { seen.push(f); put(f, s.do === 'carry' ? 'pick' : 'depart', i); }
    }
    for (const s of subs) {
      if (s.do === 'carry') put(s.to, 'drop', i);
      else if (s.do === 'survey') put(s.at, 'over', i);
      else if (s.do === 'fly' || s.do === 'land' || s.do === 'deliver') put(s.to, 'land', i);
    }
  });
  return out;
}
// THE DESTINATIONS: the stops after the first, a plain landing back where the job began not counted (a survey's
// "and back to the dock" is the way home; a backhaul's load delivered there IS a destination)
function contractDests(rec) {
  const S = contractStops(rec);
  return S.slice(1).filter(x => !(x.what === 'land' && x.at === S[0].at)).length;
}
const CONTRACT_SHAPES = { carry: ['p2p', 'back', 'onward', 'milk'], survey: ['loop', 'pair', 'transit'] };
// a shape's {then} text key (the brief's next leg; p2p has none)
const CONTRACT_THEN = { back: 'job.then.back', onward: 'job.then.onward', milk: 'job.then.milk',
                        loop: 'job.then.loop', pair: 'job.then.pair', transit: 'job.then.transit' };
// a route of a shape -> its stages' subs. A carry route is [A, B] (p2p), [A, B, A] (back) or [A, B, C]; L1 / L2 the
// two legs' loads (L2: the second leg's, null on a one-leg job); g2 the second leg's goods word when it differs
function ctCarryStages(shape, r, L1, L2, g2) {
  const leg = (from, to, load, goods) => Object.assign({ do: 'carry', from, to, load }, goods ? { goods } : {});
  if (shape === 'p2p') return [[leg(r[0], r[1], L1)]];
  return [[leg(r[0], r[1], L1)], [leg(r[1], r[2], L2, g2)]];
}
// a survey route: loop [A, X], pair [A, X, Y] (over both, back to A), transit [A, X, B] (over X, land at B)
function ctSurveyStages(shape, r) {
  if (shape === 'pair') return [[{ do: 'survey', from: r[0], at: r[1] }, { do: 'survey', from: r[0], at: r[2] }], [{ do: 'land', to: r[0] }]];
  return [[{ do: 'survey', from: r[0], at: r[1] }], [{ do: 'land', to: shape === 'transit' ? r[2] : r[0] }]];
}
const ctGoods = (P, id) => P.goods.find(g => g.id === id) || { kind: 'none' };
const ctFloor = G => ({ kg: G.kind === 'kg' || G.kind === 'bulk' ? G.kg[0] : 0, pax: G.kind === 'pax' ? G.pax[0] : 0 });
// THE ROUTES a template may draw in a shape: every route of the shape among its pools, no leg from a field to
// itself, no stop twice in a row, that ONE validated design flies end to end at the goods' floor (the ✗ rule: never
// a wheels / water mix no single aeroplane can do). In pool order (deterministic); memoised per fields table.
const ctRouteMemo = new WeakMap();
function ctRoutes(P, tpl, shape, F) {
  let m = ctRouteMemo.get(F);
  if (!m) ctRouteMemo.set(F, m = new Map());
  const key = P.id + '|' + tpl.id + '|' + shape;
  if (m.has(key)) return m.get(key);
  const raw = [];
  let subsOf;
  if (tpl.survey) {
    const S = tpl.survey, A = ctPool(P, S.from || 'own', F), X = ctPool(P, S.at || 'all', F), B = ctPool(P, S.to || 'own', F);
    for (const a of A) X.forEach((x, xi) => {
      if (x === a) return;
      if (shape === 'loop') raw.push([a, x]);
      else if (shape === 'pair') { for (const y of X.slice(xi + 1)) if (y !== a) raw.push([a, x, y]); }
      else if (shape === 'transit') { for (const b of B) if (b !== a && b !== x) raw.push([a, x, b]); }
    });
    subsOf = r => [].concat(...ctSurveyStages(shape, r));
  } else {
    const A = ctPool(P, tpl.from || 'own', F), B = ctPool(P, tpl.to || 'all', F), C = ctPool(P, tpl.on || 'all', F);
    for (const a of A) for (const b of B) {
      if (a === b) continue;
      if (shape === 'p2p') raw.push([a, b]);
      else if (shape === 'back') raw.push([a, b, a]);
      else for (const c of C) if (c !== a && c !== b) raw.push([a, b, c]);
    }
    const G = ctGoods(P, tpl.goods), G2 = tpl.back ? ctGoods(P, tpl.back) : G;
    subsOf = r => [].concat(...ctCarryStages(shape, r, ctFloor(G), ctFloor(shape === 'milk' ? G : G2)));
  }
  const out = raw.filter(r => contractDoers(subsOf(r), F).length > 0);
  m.set(key, out);
  return out;
}
// a load drawn from goods G (the reputation's share of its range); its items (FREIGHT: the goods gain dims). `tag`
// prefixes the item ids of a second, separate load (a backhaul of the same goods is other crates, not the same ones)
function ctLoadOf(rng, G, frac) {
  const L = { kg: 0, pax: 0 };
  if (G.kind === 'pax') L.pax = ctDraw(rng, G.pax[0], G.pax[1], frac, 1);
  else if (G.kind === 'kg' || G.kind === 'bulk') L.kg = ctDraw(rng, G.kg[0], G.kg[1], frac, 5);
  if (G.kind === 'bulk') L.bulk = G.id;
  return L;
}
function ctItemsOf(L, G, tag) {
  if (L.kg > 0 && typeof freightItems === 'function') {
    L.items = freightItems(L, G.word);
    if (tag) L.items = L.items.map(it => Object.assign(it, { id: tag + it.id }));
  } else delete L.items;
  return L;
}
// a load shrunk one step toward the goods' floor (a passenger dropped, else the kilos halved); false at the floor
function ctShrink(L, G) {
  if (L.pax > (G.pax ? G.pax[0] : 0)) { L.pax--; return true; }
  const lo = G.kg ? G.kg[0] : 0;
  if (L.kg > lo) { L.kg = Math.max(lo, Math.round(L.kg / 2 / 5) * 5); return true; }
  return false;
}
// THE MILK RUN'S SECOND LEG: part of the first leg's load goes on (the later half of its items, or all but one of its
// passengers); null when the load does not split (one item, one passenger)
function ctMilkPart(L1) {
  if (L1.pax >= 2) return { kg: 0, pax: L1.pax - 1 };
  if (Array.isArray(L1.items) && L1.items.length >= 2) {
    const items = ctClone(L1.items.slice(Math.ceil(L1.items.length / 2)));
    const L = { kg: freightKg(items), pax: 0, items };
    if (L1.bulk) L.bulk = L1.bulk;
    return L;
  }
  return null;
}

// ---- THE JOB GENERATOR (seeded, deterministic, order-independent) ------------------------------------------
// A job is f(seed, provider, epoch, index) and NOTHING else (the provider's reputation scales its load: a
// value of the career that changes only when the completed count does). Its id says so: job:<prov>:<epoch>:<i>,
// so a job is regenerated from its id (contractJobById) — no job is stored until it is accepted.
// (G2430) A draw: the template (its weight), the condition, the SHAPE (its weight, among the shapes the template
// has a flyable route in), the ROUTE (uniform among ctRoutes), then the loads, leg by leg; shrunk until one
// validated design flies the whole chain, else redrawn. The record says its shape (`shape`); a second leg of other
// goods names them (`sub.goods`).
function contractEpoch(done) { return Math.floor(Math.max(0, done || 0) / CONTRACT_GEN.refreshEvery); }
function ctPick(rng, list, w) {
  if (!w) return list[Math.floor(rng() * list.length) % list.length];
  const tot = list.reduce((a, x) => a + (w(x) || 0), 0);
  let r = rng() * tot;
  for (const x of list) { r -= (w(x) || 0); if (r < 0) return x; }
  return list[list.length - 1];
}
function ctDraw(rng, lo, hi, frac, round) {
  const top = lo + (hi - lo) * Math.min(1, frac);
  const v = lo + (top - lo) * rng();
  return Math.max(lo, Math.round(v / round) * round);
}
function contractJob(seed, providerId, epoch, i, opts) {
  opts = opts || {};
  const P = CONTRACT_PROVIDERS[providerId];
  if (!P || !P.jobs || !P.jobs.length) return null;
  const F = opts.fields || CONTRACT_FIELDS;
  const rep = Math.max(0, Math.min(CONTRACT_GEN.repMax, +opts.rep || 0));
  const frac = CONTRACT_GEN.repLoad[0] + CONTRACT_GEN.repLoad[1] * rep / CONTRACT_GEN.repMax;
  const id = 'job:' + providerId + ':' + epoch + ':' + i;
  for (let t = 0; t < CONTRACT_GEN.tries; t++) {
    const rng = contractRng(seed + '|' + id + '|' + t);
    const tpl = ctPick(rng, P.jobs, x => x.w || 1);
    const G = ctGoods(P, tpl.goods);
    const cond = rng() < CONTRACT_GEN.condP;
    const W = tpl.shapes || { p2p: 1 };
    const shapes = Object.keys(W).filter(k => W[k] > 0 && ctRoutes(P, tpl, k, F).length);
    if (!shapes.length) continue;
    let shape = ctPick(rng, shapes, k => W[k]);
    const route = ctPick(rng, ctRoutes(P, tpl, shape, F));
    let subs, g2 = null;
    if (tpl.survey) subs = ctSurveyStages(shape, route);
    else {
      const G2 = shape === 'milk' ? G : (tpl.back ? ctGoods(P, tpl.back) : G);
      if (G2 !== G) g2 = G2.word;
      const L1 = ctItemsOf(ctLoadOf(rng, G, frac), G);
      const L2 = shape === 'back' || shape === 'onward' ? ctItemsOf(ctLoadOf(rng, G2, frac), G2, 'leg2.') : null;
      // (G2340 FREIGHT) THE GOODS GAIN DIMS: each leg's load is its items, re-made at every shrink
      const build = () => {
        let second = L2;
        if (shape === 'milk' || (shape === 'onward' && !L2)) {
          second = ctMilkPart(L1);
          // a load that does not split rides on as a fresh one of the same goods, picked up at B
          if (!second) { shape = 'onward'; second = ctItemsOf(ctFloor(G), G, 'leg2.'); }
          else shape = 'milk';
        }
        return ctCarryStages(shape, route, L1, second, g2);
      };
      subs = build();
      // shrink until a validated design can fly the chain: a passenger dropped, the kilos halved (never below the
      // goods' floor) - the job keeps its route and its kind
      for (let k = 0; k < 6 && !contractDoers([].concat(...subs), F).length; k++) {
        const a = ctShrink(L1, G), b = L2 ? ctShrink(L2, G2) : false;
        if (!a && !b) break;
        ctItemsOf(L1, G);
        if (L2) ctItemsOf(L2, G2, 'leg2.');
        subs = build();
      }
    }
    if (cond) subs[subs.length - 1][0].when = { before: 'dusk' };
    if (!contractDoers([].concat(...subs), F).length) continue;
    const rec = contractNormalise({
      id, provider: providerId, kind: 'job', title: tpl.title, brief: tpl.brief, goods: G.word, tpl: tpl.id, shape,
      stages: subs.map(s => ({ subs: s })),
      pay: { base: 0 }, rep: { provider: providerId, gain: 0.1 }, repeat: { every: CONTRACT_GEN.refreshEvery },
      seed: String(seed), epoch, i,
    });
    rec.pay = contractPay(rec, F);
    return rec;
  }
  return null;
}
// the jobs a provider offers at a completed count -> [record]
function contractJobs(seed, providerId, done, opts) {
  const e = contractEpoch(done), out = [];
  for (let i = 0; i < CONTRACT_GEN.perProvider; i++) {
    const j = contractJob(seed, providerId, e, i, opts);
    if (j) out.push(j);
  }
  return out;
}
function contractJobById(seed, id, opts) {
  const m = /^job:(\w+):(\d+):(\d+)$/.exec(id || '');
  return m ? contractJob(seed, m[1], +m[2], +m[3], opts) : null;
}
// the vars a record's text fills: {from} {to} {at} {load} of its first leg, and (G2430) {then}: the next leg as words
// (job.then.<shape> with THAT leg's {from} {to} {load} {at}; empty on a one-leg job or an authored record)
function contractVars(rec, fields, text) {
  const F = fields || CONTRACT_FIELDS, subs = contractSubsOf(rec);
  const s = subs.find(x => x.do === 'carry') || subs.find(x => x.do === 'survey') || subs[0] || {};
  const nm = id => (F[id] ? F[id].name : id);
  const words = u => contractLoadWords(u.load, u.goods || rec.goods, text);
  const v = { from: nm(s.from), to: nm(s.to), at: nm(s.at), load: words(s), then: '' };
  const key = rec && rec.shape && CONTRACT_THEN[rec.shape];
  if (key) {
    const st = rec.stages || [];
    let n = null;
    if (rec.shape === 'pair') { const u = (st[0] && st[0].subs[1]) || {}; n = { from: nm(u.from), to: '', at: nm(u.at), load: '' }; }
    else if (rec.shape === 'loop' || rec.shape === 'transit') { const u = (st[1] && st[1].subs[0]) || {}; n = { from: nm(s.from), to: nm(u.to), at: nm(s.at), load: '' }; }
    else { const u = (st[1] && st[1].subs[0]) || null; if (u) n = { from: nm(u.from), to: nm(u.to), at: '', load: words(u) }; }
    if (n) v.then = contractText(key, n, text);
  }
  return v;
}

// ---- THE FOLLOW-UP BUILD CONTRACT (GQ26, GQ31) --------------------------------------------------------------
// The same story with ONE criterion changed: the first of `followUp.prefer`, then the kind order, whose kind
// has a `follow` rule and has not been changed before in this chain; else the first `followUp.add` not yet
// present. Paid +followPct % on the delivered contract's base. Never repeats a change (the chain's `changed`
// list rides on every follow-up). null when nothing is left to change or the chain is CONTRACT_FOLLOW_MAX long.
function contractFollowUp(rec) {
  const r = contractNormalise(rec);
  if (r.kind !== 'build') return null;
  const fu = r.followUp;
  if (fu.changed.length >= CONTRACT_FOLLOW_MAX) return null;
  const done = new Set(fu.changed.map(c => c.k));
  const crit = contractCrit(r);
  const order = fu.prefer.concat(Object.keys(CONTRACT_CRIT_KINDS)).filter((k, i, a) => a.indexOf(k) === i);
  let pick = null;
  for (const k of order) {
    const c = crit.find(x => x.k === k), K = CONTRACT_CRIT_KINDS[k];
    if (!c || !K || !K.follow || done.has(k)) continue;
    let v = K.follow.mul ? c.v * K.follow.mul : c.v + K.follow.add;
    const st = K.follow.round || 1;
    v = Math.round(v / st) * st;
    if (v === c.v) v = c.v + (K.follow.mul ? (K.follow.mul > 1 ? st : -st) : Math.sign(K.follow.add) * st);
    if (v < K.band[0] || v > K.band[1]) continue;
    pick = { k, how: (K.follow.mul ? K.follow.mul > 1 : K.follow.add > 0) ? 'more' : 'less', from: c.v, to: v };
    break;
  }
  let add = null;
  if (!pick) {
    add = fu.add.find(a => a && CONTRACT_CRIT_KINDS[a.k] && !crit.some(c => c.k === a.k) && !done.has(a.k)) || null;
    if (!add) return null;
    pick = { k: add.k, how: 'add', from: null, to: add.v };
  }
  const n = ctClone(r);
  const base = String(r.base || r.id).split('+')[0];
  n.base = base;
  n.id = base + '+' + (fu.changed.length + 1);
  n.follows = r.id;
  n.followUp = Object.assign({}, fu, { changed: fu.changed.concat([pick]), n: fu.changed.length + 1 });
  // the change, in the one sub that holds it (a new criterion joins the delivery)
  if (add) {
    const dv = n.stages.map(st => st.subs.find(s => s.do === 'deliver')).find(Boolean);
    dv.crit = (dv.crit || []).concat([ctClone(add)]);
  } else {
    for (const st of n.stages) for (const s of st.subs) for (const c of s.crit || []) if (c.k === pick.k) c.v = pick.to;
  }
  n.pay = Object.assign({}, r.pay, { base: Math.round(r.pay.base * (1 + CONTRACT_PAY.followPct / 100) / CONTRACT_PAY.round) * CONTRACT_PAY.round });
  delete n.unlock;                               // the stage was the first delivery's
  n.needs = { rep: 0, after: [r.id] };
  return n;
}
// a follow-up by id ('<build>+<n>'), regenerated down its chain from the authored contract
function contractFollowById(id, authored) {
  const m = /^(.+)\+(\d+)$/.exec(id || '');
  if (!m) return null;
  let r = (authored || contractAuthored())[m[1]];
  for (let i = 0; r && i < +m[2]; i++) r = contractFollowUp(r);
  return r && r.id === id ? r : null;
}
// the one difference between a contract and its follow-up -> [ {k, from, to} ] (the gate's row: exactly one)
function contractCritDiff(a, b) {
  const A = {}, B = {}, out = [];
  for (const c of contractCrit(a)) A[c.k] = JSON.stringify(c);
  for (const c of contractCrit(b)) B[c.k] = JSON.stringify(c);
  for (const k of Object.keys(Object.assign({}, A, B))) if (A[k] !== B[k]) out.push({ k, from: A[k] || null, to: B[k] || null });
  return out;
}

// ---- A STAGE'S ACCEPTANCE FROM A FLIGHT'S END ------------------------------------------------------------------
// THE STOP RECORD (what the page hands over at DEST-TO's STOPPED; app.js playerFlightEnd is where it is made):
//   { how: 'stopped', aero: '<aerodrome id>' | null (flightWhere's id when flightCanDepart),
//     wrecked?: bool, slot?: '<fleet slot>', gear?: 'wheels'|'floats',
//     load: { kg, pax, bulk?, items? }    what is aboard at the stop (cargo kg beside the pilot, passengers; the
//                                         loaded items when there are any - G2340 FREIGHT: then they are the load)
//     row: { from, to, t, ... }           the logbook row (logFlight): `from` the leg's departure, `t` seconds
//     overflew?: [aerodrome id]           the sites the flight passed over (a survey's evidence)
//     hour?: number                       the world's local hour at the stop (a `when` is judged on it)
//     duskH?, dawnH?: number              (G2650) the day's dusk / dawn as local hours (else the constants)
//     accept?: { ... }                    ACCEPT's recording, passed through to the hook untouched }
// THE HOOK (supplied by ACCEPT, G2270): hooks.acceptVerdict(contract, sub, stopRecord, career) ->
//   { ok: true, got?: {k: value} } | { ok: false, why } | { ok: null, why } (pending). A missing hook = pending.
//
// One sub against one stop -> { st: 'done'|'picked'|'no', why, got?, medal? }
function contractSubOnStop(rec, sub, prog, stop, hooks, career) {
  const at = stop.aero, row = stop.row || {}, aboard = stop.load || {};
  const F = CONTRACT_FIELDS;
  const nm = id => (F[id] ? F[id].name : id || 'nowhere');
  // (G2340 FREIGHT) THE LOAD ABOARD IS THE LOADED ITEMS when the stop carries them: every item of the job's load
  // (by id) is aboard; with no items loaded, the typed kilos stand in (the fallback, as before)
  const itemsMissing = L => (Array.isArray(L.items) && L.items.length && Array.isArray(aboard.items))
    ? L.items.filter(it => !aboard.items.some(a => a && a.id === it.id)).map(it => it.id) : null;
  const loadOk = L => {
    const miss = itemsMissing(L);
    if (miss) return !miss.length && (aboard.pax || 0) >= (L.pax || 0);
    return (aboard.kg || 0) >= (L.kg || 0) && (aboard.pax || 0) >= (L.pax || 0) && (!L.bulk || aboard.bulk === L.bulk);
  };
  const loadWhy = L => { const miss = itemsMissing(L); return miss && miss.length ? 'not aboard: ' + miss.join(', ') + ' (' + aboard.items.length + ' items loaded)'
    : 'aboard ' + (aboard.kg || 0) + ' kg / ' + (aboard.pax || 0) + ' pax' + (aboard.bulk ? ' / ' + aboard.bulk : '')
    + ', the job is ' + (L.kg || 0) + ' kg / ' + (L.pax || 0) + ' pax' + (L.bulk ? ' / ' + L.bulk : ''); };
  const whenWhy = () => (sub.when ? contractWhenOk(sub.when, stop) : '');
  if (sub.do === 'carry') {
    if (at === sub.to) {
      if (!(prog.picked || row.from === sub.from)) return { st: 'no', why: 'the load was not taken on at ' + nm(sub.from) };
      if (!loadOk(sub.load)) return { st: 'no', why: loadWhy(sub.load) };
      const w = whenWhy(); if (w) return { st: 'no', why: w };
      return { st: 'done', why: '' };
    }
    if (at === sub.from) {
      if (prog.picked) return { st: 'no', why: 'already loaded' };
      if (!loadOk(sub.load)) return { st: 'no', why: loadWhy(sub.load) };
      return { st: 'picked', why: 'loaded at ' + nm(at) };
    }
    return { st: 'no', why: 'stopped at ' + nm(at) + ': the job runs ' + nm(sub.from) + ' to ' + nm(sub.to) };
  }
  if (sub.do === 'land') {
    if (at !== sub.to) return { st: 'no', why: 'stopped at ' + nm(at) + ', not ' + nm(sub.to) };
    const w = whenWhy(); if (w) return { st: 'no', why: w };
    return { st: 'done', why: '' };
  }
  if (sub.do === 'fly') {
    if (at !== sub.to) return { st: 'no', why: 'stopped at ' + nm(at) + ', not ' + nm(sub.to) };
    if (sub.from && row.from !== sub.from) return { st: 'no', why: 'the leg left ' + nm(row.from) + ', not ' + nm(sub.from) };
    const w = whenWhy(); if (w) return { st: 'no', why: w };
    if (sub.medals) {
      const t = +row.t;
      if (!isFinite(t)) return { st: 'no', why: 'no time in the logbook row' };
      const m = sub.medals.slice().sort((a, b) => a.le - b.le).find(x => t <= x.le);
      if (!m) return { st: 'no', why: t + ' s: ' + Math.max(...sub.medals.map(x => x.le)) + ' s or less for a medal' };
      return { st: 'done', why: '', medal: m.medal };
    }
    return { st: 'done', why: '' };
  }
  if (sub.do === 'survey') {
    if (at === sub.at || (Array.isArray(stop.overflew) && stop.overflew.includes(sub.at))) return { st: 'done', why: '' };
    return { st: 'no', why: nm(sub.at) + ' was not overflown' };
  }
  if (sub.do === 'deliver' || sub.do === 'accept') {
    if (sub.do === 'deliver' && at !== sub.to) return { st: 'no', why: 'delivered at ' + nm(sub.to) + ', stopped at ' + nm(at) };
    const H = hooks && typeof hooks.acceptVerdict === 'function' ? hooks.acceptVerdict : null;
    if (!H) return { st: 'no', pending: true, why: 'acceptance pending: no verdict yet' };
    let v;
    try { v = H(rec, sub, stop, career); } catch (e) { v = { ok: null, why: 'the verdict failed: ' + (e && e.message) }; }
    if (!v || v.ok == null) return { st: 'no', pending: true, why: (v && v.why) || 'acceptance pending' };
    if (v.ok === false) return { st: 'no', why: 'refused: ' + (v.why || 'a criterion is not met') };
    return { st: 'done', why: '', got: v.got || {} };
  }
  return { st: 'no', why: 'unknown do ' + sub.do };
}

// the pay a completed contract earns: the total (a job) or the base, plus the bonuses its margins and medal earn
function contractPayTotal(rec, got, medal) {
  const P = rec.pay || {};
  let total = (typeof P.total === 'number' && isFinite(P.total)) ? P.total : Math.round(contractStoryBase(rec));
  const crit = contractCrit(rec);
  let pct = 0;
  for (const b of P.bonus || []) {
    if (b.crit === 'medal') { if (medal === b.by) pct += b.pct; continue; }
    const c = crit.find(x => x.k === b.crit), g = got && got[b.crit];
    if (!c || typeof g !== 'number' || typeof c.v !== 'number') continue;
    const beat = c.op === '>=' ? g >= c.v * (1 + b.by) : c.op === '<=' ? g <= c.v * (1 - b.by) : false;
    if (beat) pct += b.pct;
  }
  return Math.round(total * (1 + pct / 100) / CONTRACT_PAY.round) * CONTRACT_PAY.round;
}

// ---- THE NARRATIVE PACK'S IMPORT (Block 5's JSON shape; a bonus) -------------------------------------------
// -> { ok, text: a new text table (the old keys kept, the pack's words over them, draft: false), why: [] }.
// Every airfield id must exist, every contract / build id must be ours, no build text names a configuration,
// and a job title's slots are {from} {to} {load} {at} {then} only. Pure: the table handed in is not changed.
function contractImportPack(pack, text) {
  const T = ctClone(text || CONTRACT_TEXT), why = [];
  const ids = contractAuthored();
  const put = (k, s, check) => {
    if (typeof s !== 'string' || !s) return;
    if (check) { const w = contractConfigWord(s); if (w) { why.push(k + ' names a configuration (' + w + ')'); return; } }
    T[k] = { t: s, draft: false };
  };
  const P = (pack && typeof pack === 'object') ? pack : {};
  for (const p of P.providers || []) {
    if (!CONTRACT_PROVIDERS[p.id]) { why.push('no provider ' + p.id); continue; }
    put('prov.' + p.id + '.name', p.name); put('prov.' + p.id + '.desc', p.desc);
  }
  for (const c of P.contracts || []) {
    if (!ids[c.id]) { why.push('no contract ' + c.id); continue; }
    for (const st of c.stages || []) for (const f of ['from', 'to']) if (st[f] && !CONTRACT_FIELDS[st[f]]) why.push(c.id + ': no airfield ' + st[f]);
    const b = ids[c.id].kind === 'build';
    put('ct.' + c.id + '.title', c.title, b); put('ct.' + c.id + '.brief', c.brief, b); put('ct.' + c.id + '.done', c.done, b);
  }
  for (const b of P.builds || []) {
    if (!ids[b.id] || ids[b.id].kind !== 'build') { why.push('no build contract ' + b.id); continue; }
    for (const s of b.criteria || []) { const w = contractConfigWord(s); if (w) why.push(b.id + ': a criterion names a configuration (' + w + ')'); }
    put('ct.' + b.id + '.brief', b.brief, true);
    if (b.followUp) put('ct.' + b.id + '.follow', b.followUp.brief, true);
  }
  const seen = {};
  for (const j of P.jobs || []) {
    const Pr = CONTRACT_PROVIDERS[j.provider];
    if (!Pr) { why.push('no provider ' + j.provider + ' for a job'); continue; }
    const slots = (String(j.title || '') + ' ' + String(j.brief || '')).match(/\{(\w+)\}/g) || [];
    const bad = slots.filter(s => !['{from}', '{to}', '{load}', '{at}', '{then}'].includes(s));
    if (bad.length) { why.push(j.provider + ' job: unknown slot ' + bad.join(' ')); continue; }
    // the pack's jobs are matched to the provider's templates in order, by the load's word where it names one
    const n = seen[j.provider] = (seen[j.provider] || 0);
    const tpl = Pr.jobs.find(t => t.goods === j.load) || Pr.jobs[n % Pr.jobs.length];
    seen[j.provider]++;
    put(tpl.title, j.title); put(tpl.brief, j.brief);
  }
  return { ok: !why.length, text: T, why };
}
