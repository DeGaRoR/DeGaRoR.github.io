// ===========================================================================
// THE PILOTS YOU HIRE (G2290 PILOTS) — the roster, hiring, who flies, refusals
// by trait, a pilot's place, and skill growth from the logbook.
// futureDesigns/GAME-2026-10-06.md §9 (the spec), §R (binding: GQ13 four
// recruits on the existing bodies, no download; G-COST a one-time sign-on fee,
// no wages; GQ14 pilots are physical, the free boat home; GQ30 refusals by
// trait only, no morale); futureDesigns/game/NARRATIVE-PROMPT-PACK-2026-10-06.md
// Block 3 (the four pilots' FIXED knobs and traits: THIS FILE'S DATA, gated
// against the pack by GATE PILOTS).
// ===========================================================================
// A PILOT IS A PERSON WRAPPED AROUND A PROFILE (§9.1): the flying is PILOT-PERSONA's profile (43_pilot.js
// PILOT_PROFILES + PILOT_PROFILE_KNOBS, clamped through pilotProfile / pilotProfileSpec), one pilot, never a fork.
// The body is a Mixamo character already in the game (tools/chars_table.py; the crew's `pilotWho`): ch20 stays the
// TEST PILOT and ch02 is kept for the user's own purposes, so neither is a recruit. The words (name, tagline, bio,
// barks, "flies like", the pitch) are TEXT KEYS: draft until the user's external-AI run (GQ21) is imported
// (pilotsImportPack, Block 5's "pilots"). The portrait is null until that run too.
//
// THE CAREER BLOCK (74_career.js reserved `pilots: {}` and `roster: []` for this session; PLAYER_V / CAREER_V
// unchanged, the fields ride along):
//   career.roster: [id]              the hired pilots, in hiring order (the companion first)
//   career.pilots: { <id>: {         one row per pilot ever hired (a fired pilot keeps the row: the logbook stays)
//       hired: <clock s> | null,     null: not on the roster now (fired)
//       fee:   <the sign-on paid>,
//       aero:  <aerodrome id>,       where the pilot was left (the boat home: HOME; a flight flown: where it stopped)
//       plane: <slot> | null,        the aeroplane the pilot is WITH: their place follows it (the fleet ledger)
//       log:   [ { n, at, slot, from, to, landed, tw, t } ] } }   their logbook: every flight they flew
//   career.pilotPick: <id> | 'me'    who flies the next flight ('me' = by hand / the expert, "I fly")
//   career.pilotN: <count>           flights logged by hired pilots (the row number `n`)
//
// Pure: every operation works on a clone and returns { ok, doc, why, ... }; a refusal hands back the very document
// it was given, untouched (74_career.js's contract). No DOM, no storage, no clock, no random.
// ===========================================================================
const PILOTS_V = 1;
const PILOTS_ORDER = ['kit', 'rafe', 'remy', 'sky'];
const PILOTS_COMPANION = 'kit';                       // arrives with the player (§9.2, the pack's COMPANION)
const PILOTS_RESERVED = { ch20: 'the test pilot', ch02: 'kept for the user\'s own purposes' };   // GQ13: not recruits
const PILOTS_MARKET = { min: 2, max: 3 };             // recruitables shown at a time, refreshed with the market
const PILOTS_GROW = { fast: 30, steady: 60 };         // logged landings to reach the ceiling (§9.4)
const PILOTS_WEATHER = { windKt: 18 };                // a cautious pilot's limit: the surface wind at the decision
const PILOTS_SHORT_M = 300;                           // short-strip nerves: refuses strips under this (m)
const PILOTS_PAVED = ['concrete', 'asphalt'];         // paved-only: the surfaces it will use
// G-COST: the one-time sign-on fee. ECONOMY (G2260) owns the price book (econPrice('signon', id)); until it lands,
// this stub - the order is the pack's (remy the cheapest, sky the priciest; the companion comes with the opening).
const PILOTS_SIGNON_STUB = { kit: 0, remy: 1500, rafe: 4000, sky: 7000 };

// ---- THE TRAITS: hooks, never prose (§9.3). Each names what it does; the pack's phrase is its label key. --------------
//   refuse     a refusal kind (pilotsRefusal): 'weather' | 'night' | 'short' | 'unpaved' | 'water' | 'snow'
//   keeps      the refusals this trait switches OFF ('*' every one)
//   labourK    x the repair LABOUR on an aeroplane the pilot is with, in the field (no hangar of yours around it)
//   billK      x the whole repair bill on an aeroplane the pilot is with
//   fixes      the knobs the trait holds (growth never moves them)
//   growOn     the landings that count for growth ('tw': tailwheel types only)
const PILOTS_TRAITS = {
  mechanic:             { labourK: 0.9 },
  cautious:             { refuse: 'weather' },
  'night-shy':          { refuse: 'night' },
  fearless:             { keeps: ['weather'] },
  'hard-on-airframes':  { billK: 1.1 },
  eager:                {},
  'short-field':        { fixes: ['field', 'slip'] },
  'loves-taildraggers': { growOn: 'tw' },
  'refuses-nothing':    { keeps: '*' },
  // the hooks no recruit carries today (a later pilot, or the user's text, may): GATE PILOTS fires each of them
  'short-strip-nerves': { refuse: 'short' },
  'paved-only':         { refuse: 'unpaved' },
  'no-water':           { refuse: 'water' },
  'no-snow':            { refuse: 'snow' },
};
const PILOTS_REFUSALS = ['weather', 'night', 'short', 'unpaved', 'water', 'snow'];

// ---- THE ROSTER: the pack's Block 3, verbatim in numbers (GATE PILOTS parses the pack and compares) ----------------
//   who       the chars_table key (the body; tools/chars_table.py)
//   profile   { base: a PILOT_PROFILES name, knobs: the pack's overrides } -> pilotsProfile clamps it
//   style     PILOT_STYLES name
//   traits    PILOTS_TRAITS ids (the pack's TRAITS column)
//   grow      { rate: PILOTS_GROW key, ceiling: a PILOT_PROFILES name } | null (the pack: "grows ... (ceiling: X)")
//   signOn    'stub' (the price book's, pilotsSignOn) - the companion's is 0
//   pack      what the pack left unsaid that this table decided (HANDOVER G2290 lists them)
const PILOTS_ROSTER = {
  kit:  { id: 'kit', who: 'ch01', companion: true,
          profile: { base: 'club', knobs: { reaction: 0.25, smooth: 0.8, bankK: 0.85, comfortG: 1.25 } },
          style: 'cautious', traits: ['mechanic', 'cautious', 'night-shy'], grow: { rate: 'steady', ceiling: 'bush' },
          portrait: null },
  rafe: { id: 'rafe', who: 'ch42',
          profile: { base: 'hamfist', knobs: { hamFist: 0.04, comfortG: 1.9, bankK: 1.25 } },
          style: 'normal', traits: ['fearless', 'hard-on-airframes'], grow: null,
          portrait: null, pack: { style: 'not given: normal', grow: 'not given: none (the rough hands stay)' } },
  remy: { id: 'remy', who: 'remy',
          profile: { base: 'student', knobs: { reaction: 0.40, overRotate: 0.03, flareK: 0.85 } },
          style: 'normal', traits: ['eager'], grow: { rate: 'fast', ceiling: 'expert' },
          portrait: null, pack: { style: 'not given: normal' } },
  sky:  { id: 'sky', who: 'ch22',
          profile: { base: 'bush', knobs: { reaction: 0.12, smooth: 1.0, slip: true, field: 'short', bankK: 1.2, comfortG: 1.7 } },
          style: 'normal', traits: ['short-field', 'loves-taildraggers', 'refuses-nothing'], grow: { rate: 'steady', ceiling: 'expert' },
          portrait: null, pack: { style: 'not given: normal', grow: 'not given: steady to the expert, on tailwheel types only (loves taildraggers)' } },
};

// ---- THE TEXT: draft keys until the user's AI run (GQ21); the same { t, draft } shape as CONTRACT_TEXT ------------
const PT_ = t => ({ t, draft: true });
const PILOTS_TEXT = {
  'pilot.kit.name': PT_('Kit'), 'pilot.rafe.name': PT_('Rafe'), 'pilot.remy.name': PT_('Remy'), 'pilot.sky.name': PT_('Sky'),
  'pilot.kit.tagline': PT_('Fixes engines, flies a little, came with you.'),
  'pilot.rafe.tagline': PT_('Loud, brave, rough on the stick.'),
  'pilot.remy.tagline': PT_('A brand-new licence and no hours.'),
  'pilot.sky.tagline': PT_('Grew up landing on gravel bars.'),
  'pilot.kit.bio': PT_('[draft] The one who came with you. The text comes from the narrative run.'),
  'pilot.rafe.bio': PT_('[draft] Ex-crop-duster and airshow ground crew turned pilot.'),
  'pilot.remy.bio': PT_('[draft] Just finished the commercial licence. Wants hours.'),
  'pilot.sky.bio': PT_('[draft] A bush pilot from the gravel bars.'),
  'pilot.kit.pitch': PT_('[draft] I believed in this before you did.'),
  'pilot.rafe.pitch': PT_('[draft] Weather? I fly in it.'),
  'pilot.remy.pitch': PT_('[draft] Give me the hours, I\'ll give you the landings.'),
  'pilot.sky.pitch': PT_('[draft] Show me the strip. Any strip.'),
  // the eight barks (Block 3), one draft line per moment, shared until the pack writes each pilot's own
  'pilot.bark.hired': PT_('{name} is on the roster.'),
  'pilot.bark.takeoff': PT_('{name}: rolling.'),
  'pilot.bark.goodLanding': PT_('{name}: nice and soft.'),
  'pilot.bark.badLanding': PT_('{name}: that one bounced.'),
  'pilot.bark.refuse': PT_('{name} won\'t fly this one.'),
  'pilot.bark.weather': PT_('{name}: look at that sky.'),
  'pilot.bark.idle': PT_('{name} is waiting by the aeroplane.'),
  'pilot.bark.longDay': PT_('{name}: long day.'),
  // THE REFUSALS (GQ30: by trait only), one line per kind; {name} {to} {len} {hour} {wind}
  'pilot.refuse.weather': PT_('{name} won\'t fly in this wind ({wind} kt).'),
  'pilot.refuse.night': PT_('{name} won\'t fly a leg that ends after dusk ({hour} h).'),
  'pilot.refuse.short': PT_('{name} won\'t land on a {len} m strip.'),
  'pilot.refuse.unpaved': PT_('{name} only flies from paved runways.'),
  'pilot.refuse.water': PT_('{name} won\'t land on water.'),
  'pilot.refuse.snow': PT_('{name} won\'t land on snow.'),
  'pilot.refuse.away': PT_('{name} is at {at}, not with the aeroplane.'),
  'pilot.refuse.boat': PT_('{name} is at {at}: take the boat home first.'),
  // the traits' chips
  'pilot.trait.mechanic': PT_('mechanic'), 'pilot.trait.cautious': PT_('cautious'), 'pilot.trait.night-shy': PT_('night-shy'),
  'pilot.trait.fearless': PT_('fearless'), 'pilot.trait.hard-on-airframes': PT_('hard on airframes'), 'pilot.trait.eager': PT_('eager'),
  'pilot.trait.short-field': PT_('short-field'), 'pilot.trait.loves-taildraggers': PT_('loves taildraggers'),
  'pilot.trait.refuses-nothing': PT_('refuses nothing'), 'pilot.trait.short-strip-nerves': PT_('short-strip nerves'),
  'pilot.trait.paved-only': PT_('paved runways only'), 'pilot.trait.no-water': PT_('no water'), 'pilot.trait.no-snow': PT_('no snow'),
  'pilot.trait.mechanic.how': PT_('field repairs: labour x0.9'), 'pilot.trait.hard-on-airframes.how': PT_('repair bills x1.1'),
  'pilot.trait.cautious.how': PT_('refuses strong wind'), 'pilot.trait.night-shy.how': PT_('refuses legs ending after dusk'),
  'pilot.trait.fearless.how': PT_('no weather refusals'), 'pilot.trait.eager.how': PT_('the cheapest sign-on, grows fast'),
  'pilot.trait.short-field.how': PT_('short-field technique, slips'), 'pilot.trait.loves-taildraggers.how': PT_('grows on tailwheel types'),
  'pilot.trait.refuses-nothing.how': PT_('flies anything'),
  'pilot.me': PT_('I fly'), 'pilot.me.how': PT_('by hand, or the expert autopilot'),
  'pilot.boat': PT_('takes the boat home'),
};
const pilotsText = (key, vars, text) => contractText(key, vars, Object.assign({}, PILOTS_TEXT, text || {}));
const pilotsName = id => pilotsText('pilot.' + id + '.name');

const plClone = o => JSON.parse(JSON.stringify(o));
const plNo = (doc, why, extra) => Object.assign({ ok: false, doc, why }, extra || {});
const plHome = doc => (doc && doc.sheds && doc.sheds[PREM_MAIN] && doc.sheds[PREM_MAIN].base) || PREM_MAIN;

// ---- THE PROFILE: base + the pack's knobs (+ growth), clamped -------------------------------------------------------
// The knob -> section map is PILOT_PROFILE_KNOBS' own when PILOT-PERSONA is in the core (train 40); before it, the
// same eleven names in PILOT-ONE's sections (43's pilotProfile reads both shapes).
const PILOTS_KNOB_SEC = { reaction: 'skill', smooth: 'skill', hamFist: 'skill', gain: 'skill', overRotate: 'quirks', flareK: 'quirks',
                          bankK: 'limits', comfortG: 'limits', field: 'technique', slip: 'technique', stepHold: 'technique' };
function pilotsKnobs() {
  if (typeof PILOT_PROFILE_KNOBS !== 'undefined') return PILOT_PROFILE_KNOBS.map(K => ({ k: K.k, sec: K.sec, kind: K.kind, lo: K.lo, hi: K.hi, d: K.d }));
  return Object.keys(PILOTS_KNOB_SEC).map(k => ({ k, sec: PILOTS_KNOB_SEC[k], kind: k === 'field' ? 'pick' : (k === 'slip' || k === 'stepHold') ? 'bool' : 'range',
                                                  d: pilotProfile('expert')[k] }));
}
// the flat knobs (pilotProfile's shape) of the pilot as signed on: the base person, the pack's knobs over it
function pilotsBaseFlat(id) {
  const R = PILOTS_ROSTER[id];
  if (!R) return null;
  const F = Object.assign({}, pilotProfile(R.profile.base));
  for (const k of Object.keys(R.profile.knobs)) F[k] = R.profile.knobs[k];
  return F;
}
// flat -> what makePilot is handed: an OBJECT profile { name, active, skill, quirks, limits, technique }, clamped
// to the knobs by pilotProfile (PILOT-PERSONA) and written back as the knobs that differ from the expert's
// (pilotProfileSpec). Before PILOT-PERSONA: the same object unclamped (the roster is in range: GATE PILOTS proves it
// against PILOT-PERSONA's own clamp).
function pilotsProfile(flat, name) {
  const o = { name: name || 'custom', active: true };
  for (const K of pilotsKnobs()) {
    const v = flat[K.k];
    if (v === undefined) continue;
    if (v === K.d || (K.d == null && v == null) || (K.d === false && !v)) continue;
    (o[K.sec] || (o[K.sec] = {}))[K.k] = v;
  }
  if (typeof pilotProfileSpec === 'function') return Object.assign({ name: o.name, active: true }, pilotProfileSpec(pilotProfile(o)));
  return o;
}

// ---- SKILL GROWTH (§9.4, PILOT-PERSONALITY §4.9): deterministic from the logbook ------------------------------------
// Each logged landing (a flight that stopped on an aerodrome, whole) moves the knobs a step toward the CEILING (a
// PILOT_PROFILES name): f = min(1, landings / PILOTS_GROW[rate]). A numeric knob moves s -> s + (c - s) f, ONLY when
// the ceiling's value is nearer the expert's than the start (a pilot never grows away from the expert: the ceiling
// caps, it never drags back; one on the far side of the expert stops at the expert's); a pick / bool takes the ceiling's at f >= 1/2; a knob a trait fixes never moves; a
// null (comfort g off: no cap) ceiling is reached through the knob's top and becomes null at f = 1. No ceiling: no
// growth. Rounded to 1e-4 so a replay is the same bytes.
function pilotsLandings(rec, R) {
  const on = (R.traits || []).map(t => (PILOTS_TRAITS[t] || {}).growOn).find(Boolean);
  return ((rec && rec.log) || []).filter(r => r && r.landed && (!on || (on === 'tw' && r.tw))).length;
}
function pilotsGrowth(id, landings) {
  const R = PILOTS_ROSTER[id];
  const s = pilotsBaseFlat(id);
  if (!R || !R.grow || !(landings > 0)) return { flat: s, f: 0 };
  const c = pilotProfile(R.grow.ceiling), E = pilotProfile('expert');
  const f = Math.min(1, landings / (PILOTS_GROW[R.grow.rate] || PILOTS_GROW.steady));
  const fixed = new Set([].concat(...(R.traits || []).map(t => (PILOTS_TRAITS[t] || {}).fixes || [])));
  const out = Object.assign({}, s);
  for (const K of pilotsKnobs()) {
    const k = K.k;
    if (fixed.has(k) || !(k in s)) continue;
    if (K.kind === 'range') {
      const top = K.hi != null ? K.hi : (k === 'comfortG' ? 2 : null);
      const num = v => (v == null ? top : v);
      const sv = num(s[k]), ev = num(E[k]);
      let cv = num(c[k]);
      if (sv == null || cv == null || ev == null) continue;
      if ((sv - ev) * (cv - ev) < 0) cv = ev;                                  // a ceiling past the expert: the expert's
      if (!(Math.abs(cv - ev) < Math.abs(sv - ev) - 1e-9)) continue;          // the ceiling must be nearer the expert
      if (f >= 1 && c[k] == null) { out[k] = null; continue; }
      out[k] = Math.round((sv + (cv - sv) * f) * 1e4) / 1e4;
    } else if (f >= 0.5 && c[k] !== s[k]) out[k] = c[k];   // the ceiling's technique (the expert's: the strip decides)
  }
  return { flat: out, f };
}
// the pilot as they fly today (the career's logbook): what makePilot is handed
function pilotsFlatOf(doc, id) {
  const rec = doc && doc.career && doc.career.pilots && doc.career.pilots[id];
  return pilotsGrowth(id, pilotsLandings(rec, PILOTS_ROSTER[id])).flat;
}
function pilotsProfileOf(doc, id) {
  const F = pilotsFlatOf(doc, id);
  return F ? pilotsProfile(F, id) : null;
}

// "FLIES LIKE": the profile in plain words (the card's line; the pack's "fliesLike" replaces it when imported)
function pilotsFliesLike(F) {
  if (!F) return '';
  const w = [];
  w.push(F.reaction <= 0.15 ? 'quick' : F.reaction <= 0.3 ? 'a beat late' : 'slow to react');
  w.push(F.smooth >= 1.3 ? 'snatchy hands' : F.smooth <= 0.85 ? 'gentle hands' : 'steady hands');
  if (F.hamFist >= 0.02) w.push('never still on the stick');
  if (F.overRotate >= 0.02) w.push('over-rotates');
  if (F.flareK <= 0.9) w.push('flares late');
  const t = [];
  if (F.field === 'short') t.push('short fields');
  if (F.field === 'normal') t.push('a normal approach everywhere');
  if (F.slip) t.push('slips every final');
  const l = [];
  l.push(F.bankK >= 1.1 ? 'steep turns' : F.bankK <= 0.9 ? 'shallow turns' : 'normal turns');
  if (F.comfortG != null) l.push('pulls ' + F.comfortG.toFixed(2).replace(/0$/, '') + ' g at most');
  return [w.join(', '), t.join(', '), l.join(', ')].filter(Boolean).join('; ');
}

// ---- THE SIGN-ON (G-COST: one-time, no wages) --------------------------------------------------------------------
function pilotsSignOn(id) {
  if (PILOTS_ROSTER[id] && PILOTS_ROSTER[id].companion) return 0;
  if (typeof econPrice === 'function') { const p = econPrice('signon', id); if (typeof p === 'number' && isFinite(p)) return Math.max(0, Math.round(p)); }
  return PILOTS_SIGNON_STUB[id] || 0;
}

// ---- THE CAREER BLOCK ----------------------------------------------------------------------------------------------
function pilotsBlock(doc) {
  const c = doc.career;
  if (!c.pilots || typeof c.pilots !== 'object' || Array.isArray(c.pilots)) c.pilots = {};
  if (!Array.isArray(c.roster)) c.roster = [];
  c.roster = c.roster.filter((id, i, a) => PILOTS_ROSTER[id] && a.indexOf(id) === i);
  for (const id of Object.keys(c.pilots)) {
    const P = c.pilots[id];
    if (!PILOTS_ROSTER[id] || !P || typeof P !== 'object') { delete c.pilots[id]; continue; }
    if (!Array.isArray(P.log)) P.log = [];
    if (typeof P.aero !== 'string' || !P.aero) P.aero = plHome(doc);
    if (P.plane !== null && typeof P.plane !== 'string') P.plane = null;
  }
  for (const id of c.roster) if (!c.pilots[id]) c.pilots[id] = { hired: 0, fee: 0, aero: plHome(doc), plane: null, log: [] };
  for (const id of Object.keys(c.pilots)) if (!c.roster.includes(id)) c.pilots[id].hired = null;
  if (c.pilotPick !== 'me' && !c.roster.includes(c.pilotPick)) c.pilotPick = c.roster[0] || 'me';
  if (typeof c.pilotN !== 'number' || !isFinite(c.pilotN) || c.pilotN < 0) c.pilotN = 0;
  return doc;
}
// the companion arrives with a new career (careerNew calls this; §9.2 "the first pilot comes with the opening")
function pilotsCompanion(doc) {
  const c = doc.career;
  c.roster = [PILOTS_COMPANION];
  c.pilots = { [PILOTS_COMPANION]: { hired: Math.round(doc.clock || 0), fee: 0, aero: plHome(doc), plane: null, log: [] } };
  c.pilotPick = PILOTS_COMPANION;
  c.pilotN = 0;
  return doc;
}
const pilotsHired = doc => (doc && doc.career && Array.isArray(doc.career.roster)) ? doc.career.roster.filter(id => PILOTS_ROSTER[id]) : [];

// ---- THE MARKET: 2-3 recruitables at a time, refreshed with the job market (contractEpoch) --------------------------
function pilotsOffers(doc) {
  const c = doc && doc.career;
  if (!c) return [];
  const hired = new Set(pilotsHired(doc));
  const pool = PILOTS_ORDER.filter(id => !hired.has(id));
  const epoch = contractEpoch(((c.contracts && c.contracts.done) || []).length);
  const rng = contractRng(String(c.seed) + ':pilots:' + epoch);
  const n = Math.min(pool.length, PILOTS_MARKET.min + Math.floor(rng() * (PILOTS_MARKET.max - PILOTS_MARKET.min + 1)));
  const left = pool.slice(), pick = [];
  while (pick.length < n) pick.push(left.splice(Math.floor(rng() * left.length) % left.length, 1)[0]);
  return PILOTS_ORDER.filter(id => pick.includes(id));
}

// ---- HIRE / FIRE --------------------------------------------------------------------------------------------------
function pilotsHire(doc, id) {
  if (!doc || !doc.career) return plNo(doc, 'not a career');
  if (!PILOTS_ROSTER[id]) return plNo(doc, 'no pilot ' + id);
  if (pilotsHired(doc).includes(id)) return plNo(doc, pilotsName(id) + ' is already on the roster');
  if (!pilotsOffers(doc).includes(id)) return plNo(doc, pilotsName(id) + ' is not looking for work right now');
  const fee = pilotsSignOn(id);
  if (doc.mode === 'career' && (doc.wallet || 0) < fee) return plNo(doc, 'the sign-on is ' + fee + ' credits; the wallet holds ' + Math.round(doc.wallet || 0));
  const d = pilotsBlock(plClone(doc)), c = d.career;
  c.roster.push(id);
  const old = c.pilots[id];
  c.pilots[id] = { hired: Math.round(d.clock || 0), fee, aero: plHome(d), plane: null, log: old ? old.log : [] };
  if (fee) playerCharge(d, fee, 'signon', id);
  return { ok: true, doc: d, fee, why: '' };
}
// firing is free (G-COST); the logbook stays with the row (a re-hire brings their hours back); the next flight's
// pick falls to the roster's first, else "I fly"
function pilotsFire(doc, id) {
  if (!doc || !doc.career) return plNo(doc, 'not a career');
  if (!pilotsHired(doc).includes(id)) return plNo(doc, (PILOTS_ROSTER[id] ? pilotsName(id) : id) + ' is not on the roster');
  const d = pilotsBlock(plClone(doc)), c = d.career;
  c.roster = c.roster.filter(x => x !== id);
  c.pilots[id].hired = null; c.pilots[id].plane = null;
  if (c.pilotPick === id) c.pilotPick = c.roster[0] || 'me';
  return { ok: true, doc: d, why: '' };
}
function pilotsPick(doc, id) {
  if (!doc || !doc.career) return plNo(doc, 'not a career');
  if (id !== 'me' && !pilotsHired(doc).includes(id)) return plNo(doc, id + ' is not on the roster');
  const d = plClone(doc);
  d.career.pilotPick = id;
  return { ok: true, doc: d, why: '' };
}
const pilotsPicked = doc => {
  const c = doc && doc.career;
  if (!c) return 'me';
  return c.pilotPick === 'me' ? 'me' : (pilotsHired(doc).includes(c.pilotPick) ? c.pilotPick : (pilotsHired(doc)[0] || 'me'));
};

// ---- PILOTS ARE PHYSICAL (GQ14) ------------------------------------------------------------------------------------
// A pilot is where their last aeroplane is: with `plane` set, the fleet ledger's place of that aeroplane (it follows
// it: "bring it home" brings them too); else where they were left (`aero`). -> aerodrome id
function pilotsPlace(doc, id) {
  const P = doc && doc.career && doc.career.pilots && doc.career.pilots[id];
  if (!P) return plHome(doc);
  if (P.plane && doc.fleet && doc.fleet[P.plane]) { const W = playerWhere(doc, P.plane); if (W.aero) return W.aero; }
  return P.aero || plHome(doc);
}
// "TAKES THE BOAT HOME": free, to HOME, between flights (never while flying: the page offers it on the ground only)
function pilotsBoatHome(doc, id) {
  if (!pilotsHired(doc).includes(id)) return plNo(doc, id + ' is not on the roster');
  const home = plHome(doc);
  if (pilotsPlace(doc, id) === home) return plNo(doc, pilotsName(id) + ' is already at ' + home);
  const d = plClone(doc), P = d.career.pilots[id];
  P.aero = home; P.plane = null;
  return { ok: true, doc: d, why: '' };
}

// ---- REFUSALS (GQ30: by trait only) ----------------------------------------------------------------------------------
// leg: { to: CONTRACT_FIELDS row (len, surf, alti) | id, from?: row | id, gear: stripGear's word, windKt?, endHour? }
// -> null (flies it) | { kind, trait, key, vars, why }. In the pilot's trait order; 'refuses-nothing' keeps every
// one; 'fearless' keeps the weather. An unknown wind or hour refuses nothing (the decision needs the fact).
function pilotsRefusal(id, leg) {
  const R = PILOTS_ROSTER[id];
  if (!R || !leg) return null;
  const T = R.traits.map(t => PILOTS_TRAITS[t] || {});
  if (T.some(t => t.keeps === '*')) return null;
  const kept = new Set([].concat(...T.map(t => Array.isArray(t.keeps) ? t.keeps : [])));
  const F = x => (typeof x === 'string' ? (CONTRACT_FIELDS[x] || null) : x) || null;
  const to = F(leg.to), from = F(leg.from), gear = leg.gear || 'wheels';
  const ends = [to, from].filter(Boolean);
  const name = pilotsName(id);
  const fires = {
    weather: () => typeof leg.windKt === 'number' && leg.windKt > PILOTS_WEATHER.windKt ? { wind: Math.round(leg.windKt) } : null,
    night: () => typeof leg.endHour === 'number' && leg.endHour >= CONTRACT_DUSK_H ? { hour: leg.endHour.toFixed(1) } : null,
    short: () => { const s = ends.find(e => e.surf !== 'water' && e.len > 0 && e.len < PILOTS_SHORT_M); return s ? { len: s.len, to: s.name } : null; },
    unpaved: () => { const s = ends.find(e => e.surf !== 'water' && !PILOTS_PAVED.includes(e.surf)); return s ? { to: s.name } : null; },
    water: () => (gear === 'floats' || gear === 'amphibian' || ends.some(e => e.surf === 'water')) ? {} : null,
    snow: () => (gear === 'skis' || ends.some(e => e.alti || e.surf === 'snow')) ? {} : null,
  };
  for (let i = 0; i < R.traits.length; i++) {
    const k = T[i].refuse;
    if (!k || kept.has(k)) continue;
    const v = fires[k]();
    if (v) {
      const vars = Object.assign({ name }, v);
      return { kind: k, trait: R.traits[i], key: 'pilot.refuse.' + k, vars, why: pilotsText('pilot.refuse.' + k, vars) };
    }
  }
  return null;
}
// can THIS pilot fly THIS aeroplane now? The refusals, then the place: the pilot must be where the aeroplane is
// (`at`: its aerodrome; the page passes playerRollFrom's). Away from it: refused, and when the aeroplane is at HOME
// the boat brings them (`boat: true`). "I fly" ('me') is never refused.
function pilotsCanFly(doc, id, at, leg) {
  if (id === 'me') return { ok: true, why: '' };
  if (!pilotsHired(doc).includes(id)) return { ok: false, kind: 'roster', why: id + ' is not on the roster' };
  const r = pilotsRefusal(id, leg);
  if (r) return { ok: false, kind: r.kind, trait: r.trait, key: r.key, vars: r.vars, why: r.why };
  const here = pilotsPlace(doc, id);
  if (at && here !== at) {
    const boat = at === plHome(doc);
    const F = CONTRACT_FIELDS[here];
    const vars = { name: pilotsName(id), at: F ? F.name : here };
    const key = boat ? 'pilot.refuse.boat' : 'pilot.refuse.away';
    return { ok: false, kind: 'away', key, vars, boat, why: pilotsText(key, vars) };
  }
  return { ok: true, why: '' };
}

// ---- THE FLIGHT'S END: the logbook, the place, growth ---------------------------------------------------------------
// f: { pilot: id | 'me', slot, from, to, landed (stopped on an aerodrome, whole), tw (a tailwheel type), t (s) }.
// Call it AFTER the fleet ledger moved the aeroplane (playerArrive): the flyer goes WITH the aeroplane (plane = slot,
// aero = where it now stands); anyone else who was with that aeroplane stays where it left from. An unsaved build
// (no slot): the flyer is left at the stop, or at the field it left from.
function pilotsOnFlightEnd(doc, f) {
  if (!doc || !doc.career || !f) return plNo(doc, 'not a career');
  const d = pilotsBlock(plClone(doc)), c = d.career;
  const who = f.pilot && f.pilot !== 'me' && c.roster.includes(f.pilot) ? f.pilot : null;
  const fromAero = f.from || null;
  if (f.slot) for (const id of c.roster) {
    const P = c.pilots[id];
    if (id !== who && P.plane === f.slot) { P.aero = fromAero || pilotsPlace(doc, id); P.plane = null; }
  }
  if (!who) return { ok: true, doc: d, why: '', logged: null };
  const P = c.pilots[who];
  const row = { n: ++c.pilotN, at: Math.round(d.clock || 0), slot: f.slot || null, from: f.from || null, to: f.to || null,
                landed: !!f.landed, tw: !!f.tw, t: Math.max(0, Math.round(+f.t || 0)) };
  P.log.push(row);
  if (f.slot && d.fleet && d.fleet[f.slot]) { P.plane = f.slot; P.aero = playerWhere(d, f.slot).aero || P.aero; }
  else { P.plane = null; P.aero = (f.landed && f.to) || f.from || P.aero; }
  return { ok: true, doc: d, why: '', logged: row };
}

// ---- THE TRAITS' MONEY HOOKS: the repair bill (DMG-D5's labour lines x playerLabourFactor) --------------------------
// -> { labour, bill }: the factors for a repair on `slot`, from the pilot WITH it (pilots.plane). The mechanic's
// labour counts in the field only (no hangar of yours around the aeroplane: playerWhere kind 'out' / 'away').
function pilotsRepairK(doc, slot) {
  const out = { labour: 1, bill: 1, pilot: null };
  const c = doc && doc.career;
  if (!c || !slot) return out;
  const id = pilotsHired(doc).find(x => c.pilots[x] && c.pilots[x].plane === slot);
  if (!id) return out;
  out.pilot = id;
  const field = playerWhere(doc, slot).kind !== 'in';
  for (const t of PILOTS_ROSTER[id].traits) {
    const T = PILOTS_TRAITS[t] || {};
    if (T.labourK && field) out.labour *= T.labourK;
    if (T.billK) out.bill *= T.billK;
  }
  return out;
}

// ---- THE CARD (the Pilots tab's model; text resolved, nothing the DOM computes) ------------------------------------
function pilotsCard(doc, id, world) {
  const R = PILOTS_ROSTER[id];
  if (!R) return null;
  const hired = pilotsHired(doc).includes(id);
  const rec = doc && doc.career && doc.career.pilots && doc.career.pilots[id];
  const landings = pilotsLandings(rec, R);
  const G = pilotsGrowth(id, landings);
  const at = hired ? pilotsPlace(doc, id) : null;
  const L = (world && world.aerodromes) || [];
  const atRow = at ? (L.find(a => a.id === at) || CONTRACT_FIELDS[at] || null) : null;
  const name = pilotsName(id);
  const initials = name.split(/\s+/).map(s => s[0] || '').join('').slice(0, 2).toUpperCase();
  return {
    id, who: R.who, name, initials, portrait: R.portrait || null, companion: !!R.companion,
    tagline: pilotsText('pilot.' + id + '.tagline'), bio: pilotsText('pilot.' + id + '.bio'), pitch: pilotsText('pilot.' + id + '.pitch'),
    fliesLike: (PILOTS_TEXT['pilot.' + id + '.flies'] && !PILOTS_TEXT['pilot.' + id + '.flies'].draft) ? pilotsText('pilot.' + id + '.flies') : pilotsFliesLike(G.flat),
    style: R.style,
    traits: R.traits.map(t => ({ id: t, label: pilotsText('pilot.trait.' + t), how: PILOTS_TEXT['pilot.trait.' + t + '.how'] ? pilotsText('pilot.trait.' + t + '.how') : '' })),
    signOn: pilotsSignOn(id), hired, onOffer: !hired && pilotsOffers(doc).includes(id),
    at, atName: atRow ? (atRow.name || at) : null, atXZ: atRow ? [atRow.c ? atRow.c[0] : atRow.x, atRow.c ? atRow.c[1] : atRow.z] : null,
    plane: rec && hired ? rec.plane || null : null,
    flights: rec ? rec.log.length : 0, landings, grown: Math.round(G.f * 100), ceiling: R.grow ? R.grow.ceiling : null,
    picked: pilotsPicked(doc) === id,
  };
}

// ---- THE IMPORT (Block 5's "pilots"): the user's AI run over the draft keys; ids must be the roster's ---------------
function pilotsImportPack(pack, text) {
  const T = plClone(text || PILOTS_TEXT), why = [];
  const put = (k, s) => { if (typeof s === 'string' && s) T[k] = { t: s, draft: false }; };
  for (const p of ((pack && pack.pilots) || [])) {
    if (!p || !PILOTS_ROSTER[p.id]) { why.push('no pilot ' + (p && p.id)); continue; }
    const b = 'pilot.' + p.id + '.';
    put(b + 'name', p.name); put(b + 'tagline', p.tagline); put(b + 'bio', p.backstory); put(b + 'voice', p.voice);
    put(b + 'flies', p.fliesLike); put(b + 'pitch', p.pitch);
    for (const k of Object.keys(p.barks || {})) put(b + 'bark.' + k, p.barks[k]);
  }
  return { ok: !why.length, text: T, why };
}
