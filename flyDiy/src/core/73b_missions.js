// ===========================================================================
// THE MISSION PACKS (MISSIONS-P0) — the authored missions as a JSON pack, read
// INTO today's contract record: the pack's format, its normaliser and
// validator, the two-way conversion with 73_contracts.js's record, the
// install over CONTRACT_PROVIDERS, the rally's derived checkpoints and the
// tutorial's read-only listing. futureDesigns/MISSIONS-2026-10-25.md (the
// design, §7 the user's decisions, §8 the people addendum). GATE MISSIONS
// (tools/_missions_check.js) holds it; tools/mission_editor.html edits it.
// ===========================================================================
// NOT A PARALLEL SYSTEM: a pack's mission IS a contract record once read (missionToContract) - the legs are its
// `stages`, the steps its `subs` - judged by contractValidate (opts.mission), paid by contractPay, run by the career
// (74_career.js) when installed (missionPackInstall). The new fields ride along until their phase adds the runtime;
// contractRuntimeOk (73_) keeps a record the runtime cannot judge yet out of the career. The world construction
// "stages" (76_stages.js) keep their name: here a contract stage is a LEG and a sub a STEP.
//
// THE PACK (structure B, the user 25 Oct: "YES"):
//   { what: 'flydiy-missions', v: 1, id, title,
//     campaigns: [ { id, title, provider?, order, needs?, tutorial?, readonly?, phase?,
//                    chapters: [ { id, title, order, needs?, missions: [mission id] } ] } ],
//     missions:  [ mission ],                       a mission in no chapter is campaign-less
//     sites:     [ { id, asset, at: { x, z, hdg }, state, track? } ],     §3.5 (the construction project's hook)
//     text:      { key: { t, draft? } },             the pack's own words (a record names KEYS: 72_'s rule)
//     legacy?:   { retrofitted: [id], dropped: [ { id, why } ] } }        the built-in pack's account of 72_'s contracts
//   order      'seq' | 'any' | 'choose:N' on every container (campaign: its chapters, chapter: its missions, mission:
//              its legs, leg: its steps); needs { after: [ids], rep? } the cross-links (a mission's after names missions,
//              a container's names containers)
// THE MISSION: today's record's fields (id provider kind title brief pay rep unlock needs repeat followUp goods) and
//   client     the owner: a GAME_PEOPLE id (72_people.js; peopleClientOf(provider) by default) - the card's portrait
//   legs       [ { order?, steps: [ step ] } ]                           (today's stages)
//   order?     the legs' order (seq)
//   onDone?    { say: { who, text } }                 the completion line (72_'s ct.<id>.done)
//   rules?     { crash, injury, freight, damage, strike }   §3.4: 'fail' | 'reset' | 'assess' | 'ignore'; injury may be
//                                                     { fail: <band> } (34_occupant GEN_OCC.bands: the index or the word)
//                                                     strike: 'penalty' (+3 s on the laps running) | { penalty: s } | 'fail' | 'ignore'
//   timers?    [ { id, start, stop, target: s | { refKmh }, splits?, medals?: [ { medal, le } ] } ]          §3.3
//   startFrom? 'player' | <CONTRACT_DESIGNS id> | { build: 'path.json' }                                      §3.6
//   prefs?     [ { k, v, need: 'bonus' | 'mandatory', pct? } ]   a configuration the client would like (bonus: +pct)
//                                                     or insists on (mandatory: no delivery without it)        §7
//   delivery?  { sold, blueprint }   a build's airframe sold to the client (leaves the fleet), its blueprint saved;
//                                    the model's default for every build (§7) - written only to say otherwise
//   route?     a 38c_route.js record, EMBEDDED (its pts; never a localStorage id): the rally's hidden course
//   rally?     { refKmh, r }   the course's reference speed and checkpoint radius (missionRallyDerive)
//   tutorial?  '<beat>'        a TUTORIAL listing: { id: 'story.<beat>', tutorial } and nothing else (read-only)
// THE STEP (today's sub):
//   { id?, do, place?, from?, load?: { kg, pax: n | [person ids], bulk?, items? }, goods?, embark?, disembark?,
//     require?: { when, maxMin, depart, plane: [criterion] }, medals?, say?: { who, text }, onDone?, split?, auto? }
//   do         carry | fly | land | photo | pass | park | deliver | accept | wait | talk
//   place      { field } | { pt: [x, z], r, alt? } | { gate: [[x1, z1], [x2, z2]], alt?, prop?, dir? }
//              | { ring: [x, y, z], r, dir?, prop? } | { spot: '<field>:<spot id>' } | { site: '<site id>' }
//              (a field may be written as its id: 'w3'); alt { min?, max?, ref: 'agl' | 'msl' }
//   from       where a carry is picked up / a fly or a photo departs (a field)
//   photo over a FIELD is today's survey (the 450 m overflight); over a point it is phase 1's (the shutter + a line)
// Pure: no DOM, no storage, no clock, no random. Reads 72_people.js, 72_ / 73_ (and, when present, 79_story.js,
// 38c_route.js, 34_occupant.js, the GEN tables, the map / spot packs handed in) at call time.
// ===========================================================================

const MISSION_PACK_WHAT = 'flydiy-missions';
const MISSION_PACK_V = 1;
const MISSION_DO = ['carry', 'fly', 'land', 'photo', 'pass', 'park', 'deliver', 'accept', 'wait', 'talk'];
const MISSION_PLACE_KINDS = ['field', 'pt', 'gate', 'ring', 'spot', 'site'];
// the places each verb takes ('' = it may have none)
const MISSION_PLACES_OF = {
  carry: ['field', 'site'], fly: ['field', 'pt'], land: ['field'], photo: ['field', 'pt'], pass: ['gate', 'ring', 'pt'],
  park: ['spot'], deliver: ['field'], accept: [''], wait: ['', 'field', 'pt', 'spot', 'site'], talk: ['', 'field', 'spot', 'site'],
};
const MISSION_PLACE_R = { pt: 150, ring: 8 };                  // m: a point's / a ring's radius when none is written
const MISSION_PROPS = { gate: ['balloons', 'pylons'], ring: ['donut'] };
const MISSION_RULES = { crash: ['fail', 'reset'], injury: ['fail', 'ignore'], freight: ['fail', 'ignore'], damage: ['assess', 'fail', 'ignore'],
                        strike: ['penalty', 'fail', 'ignore'] };   // a gate post / a ring touched (73c missionStrikeTest); { penalty: s } too
// §3.4's rules for a NEW mission that states none (the built-in pack states none: today's crash resets, keeps it live)
const MISSION_RULES_NEW = { crash: 'fail', injury: 'fail', freight: 'fail', damage: 'assess', strike: 'penalty' };
const MISSION_SITE_STATES = ['planned', 'building', 'built'];
const MISSION_REQUIRE = ['when', 'maxMin', 'depart', 'plane', 'waitMin'];
// THE PREFERENCES (§3.6, §7): a configuration word set, each read off the spec in phase 2 (`of`). Values are the GEN
// vocabulary (60_gen_spec.js); a live table, when present, is the authority (missionPrefValues)
const MISSION_PREF_KINDS = {
  engines:    { of: 'spec.engines.length',   values: [1, 2, 3, 4] },
  thrust:     { of: 'spec.engines[].mount',  values: ['tractor', 'pusher'] },
  wing:       { of: 'spec.wing.position',    values: ['high', 'mid', 'low', 'parasol'] },
  tail:       { of: 'spec.tail.type',        values: ['conventional', 'v', 'twinBoom'] },
  gear:       { of: 'spec.gear.type',        values: ['taildragger', 'tricycle', 'floats'] },
  canopy:     { of: 'spec.cabin.canopy.style', values: ['screen', 'bubble'] },
  suspension: { of: 'spec.gear.suspension',  values: ['bungee'] },
};
const MISSION_NEED = ['bonus', 'mandatory'];
// the record's fields a mission adds (the legacy projection strips them: missionStrip)
const MISSION_RIDE = { rec: ['client', 'onDone', 'rules', 'timers', 'startFrom', 'prefs', 'delivery', 'route', 'rally', 'order', 'pack', 'campaign', 'chapter'],
                       stage: ['order'], sub: ['id', 'say', 'onDone', 'embark', 'disembark', 'require', 'split', 'auto', 'place'], load: ['who'] };
// THE PEOPLE are 72_people.js's (GAME_PEOPLE, the one list - §8): a person in a pack is its id, never a free name; the
// provider's client is peopleClientOf's. '' when `id` names a person, else why not
function missionPersonWhy(id, as) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) return (as || 'a person') + ' must be a person id (72_people.js), got ' + JSON.stringify(id);
  if (!GAME_PEOPLE[id]) return (as || 'a person') + ' ' + id + ' is not in the people table';
  if (as === 'a passenger' && GAME_PEOPLE[id].voice) return id + ' is a voice, never aboard';
  return '';
}
// the mission model's own words (merged under the pack's text and over CONTRACT_TEXT: missionText)
const MT_ = t => ({ t, draft: true });
const MISSION_TEXT = {
  'crit.climbMs': MT_('climbs at {v} m/s or more {at}'), 'crit.stallKmh': MT_('stalls at {v} km/h or less {at}'),
  'crit.toDistM': MT_('takes off in {v} m or less {at}'), 'crit.ldgDistM': MT_('lands in {v} m or less {at}'),
  'crit.fuelLph': MT_('burns {v} L/h or less {at}'), 'crit.cargoL': MT_('a hold of {v} L or more'),
  'crit.pax': MT_('{v} passengers beside the pilot'),
  'crit.heightM': MT_('at most {v} m high'), 'crit.lengthM': MT_('at most {v} m long'),
  'crit.fitsShed': MT_('fits their {v}: through the door, parked inside'),
  'pref.engines': MT_('engines: {v}'), 'pref.thrust': MT_('a {v} propeller'), 'pref.wing': MT_('a {v} wing'),
  'pref.tail': MT_('a {v} tail'), 'pref.gear': MT_('{v} gear'), 'pref.canopy': MT_('a {v} canopy'),
  'pref.suspension': MT_('{v} suspension'),
  'pref.bonus': MT_('a bonus: {p}'), 'pref.mandatory': MT_('a must: {p}'),
  // the built-in pack's containers (missionPackFromContracts)
  'ms.chapter.arc': MT_('The arc'), 'ms.chapter.builds': MT_('Aircraft orders'), 'ms.chapter.night': MT_('Night work'),
  'ms.campaign.tutorial': MT_('Tutorial / phase 0'), 'ms.chapter.tutorial': MT_('The story (79_story.js, as it is)'),
};
const msClone = o => JSON.parse(JSON.stringify(o));
const msObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const msNum = v => typeof v === 'number' && isFinite(v);
// the text a pack reads: today's table, the model's words, the pack's own over both
const missionText = pack => Object.assign({}, typeof CONTRACT_TEXT !== 'undefined' ? CONTRACT_TEXT : {}, MISSION_TEXT, (pack && msObj(pack.text)) ? pack.text : {});
// a preference kind's values: the live GEN table when present (the suspensions), else the vocabulary's
function missionPrefValues(k) {
  const K = MISSION_PREF_KINDS[k];
  if (!K) return null;
  if (k === 'suspension' && typeof GEN_SUSPENSION !== 'undefined' && GEN_SUSPENSION) return Object.keys(GEN_SUSPENSION);
  if (k === 'gear' && typeof TECH_GEAR_TYPES !== 'undefined') return TECH_GEAR_TYPES.slice();
  if (k === 'canopy' && typeof TECH_CANOPY_STYLES !== 'undefined') return TECH_CANOPY_STYLES.slice();
  return K.values.slice();
}
// an order word -> { kind: 'seq' | 'any' | 'choose', n } or null
function missionOrder(o) {
  if (o === 'seq' || o === 'any') return { kind: o, n: 0 };
  const m = /^choose:(\d+)$/.exec(String(o || ''));
  return m && +m[1] >= 1 ? { kind: 'choose', n: +m[1] } : null;
}

// ---- THE PLACE ---------------------------------------------------------------------------------------------------
// a place's kind ('' none, null not a place)
function missionPlaceKind(p) {
  if (p == null) return '';
  if (typeof p === 'string') return 'field';
  if (!msObj(p)) return null;
  const ks = MISSION_PLACE_KINDS.filter(k => p[k] != null);
  return ks.length === 1 ? ks[0] : null;
}
// one spelling: a field id becomes { field }, a point / ring gets its radius
function missionPlaceNorm(p) {
  if (p == null) return null;
  if (typeof p === 'string') return { field: p };
  if (!msObj(p)) return p;
  const o = msClone(p), k = missionPlaceKind(o);
  if ((k === 'pt' || k === 'ring') && o.r == null) o.r = MISSION_PLACE_R[k];
  return o;
}
const msFieldOf = p => (typeof p === 'string' ? p : (msObj(p) && typeof p.field === 'string' && missionPlaceKind(p) === 'field' ? p.field : null));
function msAltWhy(a) {
  if (a == null) return '';
  if (!msObj(a)) return 'alt must be { min?, max?, ref }';
  if (a.ref != null && !['agl', 'msl'].includes(a.ref)) return 'alt.ref is agl | msl';
  if (a.min != null && !msNum(a.min)) return 'alt.min is not a number';
  if (a.max != null && !msNum(a.max)) return 'alt.max is not a number';
  if (msNum(a.min) && msNum(a.max) && a.min >= a.max) return 'alt.min must be below alt.max';
  if (a.min == null && a.max == null) return 'alt names neither min nor max';
  return '';
}
const msXZ = q => Array.isArray(q) && q.length === 2 && q.every(v => msNum(v) && Math.abs(v) < 60000);
// '' when the place is well formed (a known field, a site of the pack, a spot of the field), else why not.
// ctx: { fields, sites: { id: site }, spots: { field: [[x, z, ry, id]] } (src/viewer/fleet_spots_pack.js's `aero`) }
function missionPlaceWhy(p, ctx) {
  ctx = ctx || {};
  const F = ctx.fields || CONTRACT_FIELDS, k = missionPlaceKind(p);
  if (k === null) return 'a place is one of ' + MISSION_PLACE_KINDS.join(' | ') + ', got ' + JSON.stringify(p);
  if (k === '') return '';
  if (k === 'field') { const f = msFieldOf(p); return F[f] ? '' : 'no field ' + f; }
  if (k === 'pt') {
    if (!msXZ(p.pt)) return 'pt must be [x, z] in world metres';
    if (!(msNum(p.r) && p.r > 0 && p.r <= 5000)) return 'pt.r must be 0-5000 m';
    return msAltWhy(p.alt);
  }
  if (k === 'gate') {
    if (!Array.isArray(p.gate) || p.gate.length !== 2 || !p.gate.every(msXZ)) return 'gate must be two posts [[x1, z1], [x2, z2]]';
    const w = Math.hypot(p.gate[0][0] - p.gate[1][0], p.gate[0][1] - p.gate[1][1]);
    if (!(w >= 5 && w <= 2000)) return 'a gate is 5-2000 m wide, got ' + Math.round(w);
    if (p.prop != null && !MISSION_PROPS.gate.includes(p.prop)) return 'gate.prop is ' + MISSION_PROPS.gate.join(' | ');
    if (p.dir != null && !msNum(p.dir)) return 'gate.dir is a heading in degrees';
    return msAltWhy(p.alt);
  }
  if (k === 'ring') {
    if (!Array.isArray(p.ring) || p.ring.length !== 3 || !p.ring.every(msNum) || !msXZ([p.ring[0], p.ring[2]])) return 'ring must be [x, y, z] (y the altitude, m MSL)';
    if (!(msNum(p.r) && p.r >= 2 && p.r <= 100)) return 'ring.r must be 2-100 m';
    if (p.dir != null && !msNum(p.dir)) return 'ring.dir is a heading in degrees';
    if (p.prop != null && !MISSION_PROPS.ring.includes(p.prop)) return 'ring.prop is ' + MISSION_PROPS.ring.join(' | ');
    return '';
  }
  if (k === 'spot') {
    const m = /^([^:]+):(.+)$/.exec(String(p.spot));
    if (!m || !F[m[1]]) return 'spot must be <field>:<spot id> on a known field, got ' + p.spot;
    const S = ctx.spots && ctx.spots[m[1]];
    if (S && !S.some(s => s[3] === m[2])) return 'no spot ' + m[2] + ' at ' + m[1];
    return '';
  }
  if (k === 'site') return ctx.sites && ctx.sites[p.site] ? '' : 'no site ' + p.site + ' in the pack';
  return '';
}

// ---- THE NORMALISER (fills what is missing, carries what is present: unknown fields ride along) --------------------
function missionStepNorm(s) {
  const o = msObj(s) ? msClone(s) : {};
  if (o.place != null) o.place = missionPlaceNorm(o.place);
  if (typeof o.from === 'string') o.from = { field: o.from };
  return o;
}
function missionNormalise(m) {
  const o = msObj(m) ? msClone(m) : {};
  if (typeof o.id !== 'string') o.id = '';
  if (o.tutorial != null) return o;                             // a tutorial listing is read-only: as it is
  if (typeof o.provider !== 'string') o.provider = '';
  if (typeof o.kind !== 'string') o.kind = 'contract';
  for (const k of ['title', 'brief']) if (typeof o[k] !== 'string') o[k] = '';
  if (o.client == null && o.provider) { const c = peopleClientOf(o.provider); if (c) o.client = c; }
  if (!Array.isArray(o.legs)) o.legs = [];
  o.legs = o.legs.map(L => { const l = msObj(L) ? L : {}; l.steps = Array.isArray(l.steps) ? l.steps.map(missionStepNorm) : []; return l; });
  if (!msObj(o.pay)) o.pay = { base: 0 };
  if (!msObj(o.rep)) o.rep = { provider: o.provider, gain: 0 };
  return o;
}
function missionPackNormalise(p) {
  const o = msObj(p) ? msClone(p) : {};
  o.what = MISSION_PACK_WHAT;
  if (!msNum(o.v)) o.v = MISSION_PACK_V;
  if (typeof o.id !== 'string') o.id = '';
  if (typeof o.title !== 'string') o.title = '';
  for (const k of ['campaigns', 'missions', 'sites']) if (!Array.isArray(o[k])) o[k] = [];
  if (!msObj(o.text)) o.text = {};
  o.campaigns = o.campaigns.map(c => {
    const C = msObj(c) ? c : {};
    if (C.order == null) C.order = 'any';
    C.chapters = Array.isArray(C.chapters) ? C.chapters.map(h => { const H = msObj(h) ? h : {}; if (H.order == null) H.order = 'seq';
      H.missions = Array.isArray(H.missions) ? H.missions : []; return H; }) : [];
    return C;
  });
  o.missions = o.missions.map(missionNormalise);
  return o;
}

// ---- THE CONVERSION: a mission <-> today's contract record ----------------------------------------------------------
// the pack's sites by id (a mission's site place resolves its position onto the step)
const msSites = pack => { const out = {}; for (const s of (pack && pack.sites) || []) if (msObj(s) && s.id) out[s.id] = s; return out; };
// (MISSIONS-P3) an onDone's site carries its world construction stage (the pack's site `track`), so the record alone
// reveals it when the site is built (74_ careerOnDone)
function msSiteTrack(od, sites) { if (od && od.site && sites && sites[od.site.id] && sites[od.site.id].track) od.site.track = sites[od.site.id].track; return od; }
// one step -> one sub
function missionStepToSub(st, sites) {
  const s = missionStepNorm(st), sub = { do: s.do }, P = s.place, kind = missionPlaceKind(P), f = msFieldOf(P);
  const from = msFieldOf(s.from);
  const put = () => { if (kind === 'site') { const S = sites && sites[P.site]; sub.place = Object.assign({}, P, S && S.at ? { at: { x: S.at.x, z: S.at.z } } : {}); } else sub.place = P; };
  // (MISSIONS-P3) a site served by a strip (`field`): the step is flown to that strip, the site rides along (the marker)
  const served = kind === 'site' && sites && sites[P.site] && sites[P.site].field ? sites[P.site].field : null;
  if (s.do === 'carry') { if (from) sub.from = from; if (f) sub.to = f; else if (P) { put(); if (served) sub.to = served; } }
  else if (s.do === 'fly') { if (from) sub.from = from; if (f) sub.to = f; else if (P) put(); }
  else if (s.do === 'land' || s.do === 'deliver') { if (f) sub.to = f; else if (P) put(); }
  else if (s.do === 'photo') {
    if (f) { sub.do = 'survey'; if (from) sub.from = from; sub.at = f; }   // today's survey: the overflight of a field
    else { if (from) sub.from = from; if (P) put(); }
  } else if (s.do !== 'accept') { if (f) sub.at = f; else if (P) { put(); if (served) sub.at = served; } }
  if (s.goods != null) sub.goods = s.goods;
  if (msObj(s.load)) {
    const L = msClone(s.load);
    if (Array.isArray(L.pax)) { L.who = L.pax.slice(); L.pax = L.pax.length; }
    sub.load = L;
  }
  const R = msObj(s.require) ? s.require : {};
  if (R.when != null) sub.when = msClone(R.when);
  if (R.plane != null) sub.crit = msClone(R.plane);
  const rest = {};
  for (const k of Object.keys(R)) if (k !== 'when' && k !== 'plane') rest[k] = msClone(R[k]);
  if (Object.keys(rest).length) sub.require = rest;
  for (const k of ['medals', 'id', 'say', 'onDone', 'embark', 'disembark', 'split', 'auto']) if (s[k] != null) sub[k] = msClone(s[k]);
  msSiteTrack(sub.onDone, sites);
  return sub;
}
// one mission -> a contract record (normalised: what the career runs). ctx: { pack }
function missionToContract(m, ctx) {
  const M = missionNormalise(m), sites = msSites(ctx && ctx.pack);
  const r = { id: M.id, provider: M.provider, kind: M.kind, title: M.title, brief: M.brief };
  if (M.goods != null) r.goods = M.goods;
  r.stages = M.legs.map(L => { const st = { subs: L.steps.map(s => missionStepToSub(s, sites)) }; if (L.order != null && L.order !== 'any') st.order = L.order; return st; });
  for (const k of ['pay', 'rep', 'unlock', 'needs', 'repeat', 'followUp']) if (M[k] != null) r[k] = msClone(M[k]);
  for (const k of MISSION_RIDE.rec) if (k !== 'order' && M[k] != null) r[k] = msClone(M[k]);
  msSiteTrack(r.onDone, sites);
  if (M.order != null && M.order !== 'seq') r.order = M.order;
  return contractNormalise(r);
}
// one sub -> one step (the retrofit: a contract record read into the model)
function missionSubToStep(u) {
  const s = { do: u.do };
  if (u.do === 'survey') { s.do = 'photo'; if (u.from) s.from = { field: u.from }; s.place = { field: u.at }; }
  else {
    if (u.from) s.from = { field: u.from };
    if (u.to) s.place = { field: u.to };
    else if (u.at) s.place = { field: u.at };
    else if (u.place) s.place = msClone(u.place);
  }
  if (u.goods != null) s.goods = u.goods;
  if (u.load) { const L = msClone(u.load); if (Array.isArray(L.who)) { L.pax = L.who; delete L.who; } s.load = L; }
  const R = {};
  if (u.when != null) R.when = msClone(u.when);
  if (u.crit != null) R.plane = msClone(u.crit);
  if (msObj(u.require)) Object.assign(R, msClone(u.require));
  if (Object.keys(R).length) s.require = R;
  for (const k of ['medals', 'id', 'say', 'onDone', 'embark', 'disembark', 'split', 'auto']) if (u[k] != null) s[k] = msClone(u[k]);
  return s;
}
const MS_REPEAT_DEFAULT = rec => (rec.kind === 'job' ? null : false);
function missionFromContract(rec) {
  const r = contractNormalise(rec);
  const m = { id: r.id, provider: r.provider, kind: r.kind, title: r.title, brief: r.brief };
  if (r.goods != null) m.goods = r.goods;
  m.legs = r.stages.map(st => { const L = { steps: st.subs.map(missionSubToStep) }; if (st.order != null) L.order = st.order; return L; });
  m.pay = msClone(r.pay); m.rep = msClone(r.rep);
  if (r.unlock != null) m.unlock = msClone(r.unlock);
  if (rec.needs != null) m.needs = msClone(rec.needs);
  if (rec.repeat != null && rec.repeat !== MS_REPEAT_DEFAULT(r)) m.repeat = msClone(rec.repeat);
  if (r.kind === 'build' && rec.followUp) { const f = {}; for (const k of ['prefer', 'add']) if (rec.followUp[k] && rec.followUp[k].length) f[k] = msClone(rec.followUp[k]); if (Object.keys(f).length) m.followUp = f; }
  for (const k of MISSION_RIDE.rec) if (r[k] != null) m[k] = msClone(r[k]);
  return m;
}
// THE LEGACY PROJECTION: a record with the mission's ride-along fields taken off - what today's code reads (the gate
// holds the built-in pack's records to 72_'s, through this, key order aside)
function missionStrip(rec) {
  const r = msClone(rec);
  for (const k of MISSION_RIDE.rec) delete r[k];
  for (const st of r.stages || []) {
    for (const k of MISSION_RIDE.stage) delete st[k];
    for (const s of st.subs || []) { for (const k of MISSION_RIDE.sub) delete s[k]; if (s.load) for (const k of MISSION_RIDE.load) delete s.load[k]; }
  }
  return r;
}
// a canonical JSON (sorted keys): two records are the same record whatever order their keys were written in
function missionCanon(o) {
  if (Array.isArray(o)) return '[' + o.map(missionCanon).join(',') + ']';
  if (msObj(o)) return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + missionCanon(o[k])).join(',') + '}';
  return JSON.stringify(o);
}

// ---- THE VALIDATOR ------------------------------------------------------------------------------------------------
// a mission's new fields -> [why]. ctx: { pack, fields, sites, spots, text }
function missionWhy(m, ctx) {
  ctx = ctx || {};
  const why = [], id = (m && m.id) || '(no id)', T = ctx.text || missionText(ctx.pack), F = ctx.fields || CONTRACT_FIELDS;
  const sites = ctx.sites || msSites(ctx.pack);
  const say = (v, at) => {
    if (!msObj(v)) { why.push(at + ': say is { who, text }'); return; }
    const w = missionPersonWhy(v.who, 'a speaker'); if (w) why.push(at + ': ' + w);
    if (!contractTextOk(v.text, T)) why.push(at + ': say.text key ' + v.text + ' does not resolve');
  };
  const people = (L, at, as) => {
    if (typeof L === 'number') { if (!(L >= 0 && L === Math.round(L))) why.push(at + ': a count of people must be a whole number'); return; }
    if (!Array.isArray(L)) { why.push(at + ': a list of person ids or a count'); return; }
    for (const p of L) { const w = typeof p === 'number' ? (p >= 1 && p === Math.round(p) ? '' : 'a count must be >= 1') : missionPersonWhy(p, as); if (w) why.push(at + ': ' + w); }
  };
  if (m.client != null) { const w = missionPersonWhy(m.client, 'the client'); if (w) why.push(id + ': ' + w); }
  const O = missionOrder(m.order || 'seq');
  if (!O) why.push(id + ': order ' + m.order + ' is not seq | any | choose:N');
  else if (O.kind === 'choose' && O.n > (m.legs || []).length) why.push(id + ': choose:' + O.n + ' of ' + (m.legs || []).length + ' legs');
  const stepIds = {}, stepLeg = {}, stepPos = {};
  (m.legs || []).forEach((L, i) => {
    const lo = missionOrder(L.order || 'any');
    if (!lo) why.push(id + ' leg ' + i + ': order ' + L.order + ' is not seq | any | choose:N');
    else if (lo.kind === 'choose' && lo.n > (L.steps || []).length) why.push(id + ' leg ' + i + ': choose:' + lo.n + ' of ' + (L.steps || []).length + ' steps');
    (L.steps || []).forEach((s, j) => {
      const at = id + ' ' + i + '.' + j;
      if (!MISSION_DO.includes(s.do)) { why.push(at + ': do ' + s.do + ' is not one of ' + MISSION_DO.join(' ')); return; }
      if (s.id != null) { if (typeof s.id !== 'string' || !s.id) why.push(at + ': a step id is a string'); else if (stepIds[s.id]) why.push(at + ': step id ' + s.id + ' twice'); else { stepIds[s.id] = 1; stepLeg[s.id] = i; stepPos[s.id] = j; } }
      const k = missionPlaceKind(s.place), allow = MISSION_PLACES_OF[s.do];
      if (k === null || !allow.includes(k)) why.push(at + ': ' + s.do + ' takes ' + allow.map(x => x || 'no place').join(' | ') + ', got ' + (k === null ? JSON.stringify(s.place) : (k || 'no place')));
      else { const w = missionPlaceWhy(s.place, { fields: F, sites, spots: ctx.spots }); if (w) why.push(at + ': ' + w); }
      if (s.from != null) { const f = msFieldOf(s.from); if (!f || !F[f]) why.push(at + ': from must be a field, got ' + JSON.stringify(s.from)); }
      if (s.do === 'photo' && missionPlaceKind(s.place) === 'field' && s.from == null) why.push(at + ': a photo over a field departs from a field (`from`: today\'s survey)');
      // (MISSIONS-P1) an IN-FLIGHT step (a pass, a photo or a fly to a point / gate / ring) is judged off the flight's
      // evidence by its id, and a timer starts / stops on ids: it needs one
      if (['pass', 'photo', 'fly'].includes(s.do) && ['pt', 'gate', 'ring'].includes(missionPlaceKind(s.place)) && !s.id) why.push(at + ': an in-flight ' + s.do + ' needs an id (its evidence, its timers)');
      if (s.do === 'wait' && !(s.require && s.require.waitMin != null)) why.push(at + ': wait needs require.waitMin');
      if (s.load && Array.isArray(s.load.pax)) people(s.load.pax, at + ' load.pax', 'a passenger');
      for (const e of ['embark', 'disembark']) if (s[e] != null) people(s[e], at + ' ' + e, 'a passenger');
      if (s.require != null) {
        if (!msObj(s.require)) why.push(at + ': require is an object');
        else {
          for (const q of Object.keys(s.require)) if (!MISSION_REQUIRE.includes(q)) why.push(at + ': require.' + q + ' is not one of ' + MISSION_REQUIRE.join(' '));
          const R = s.require;
          if (R.maxMin != null && !(msNum(R.maxMin) && R.maxMin > 0 && R.maxMin <= 1440)) why.push(at + ': require.maxMin is 1-1440 minutes');
          if (R.waitMin != null && !(msNum(R.waitMin) && R.waitMin > 0 && R.waitMin <= 1440)) why.push(at + ': require.waitMin is 1-1440 minutes');
          if (R.waitMin != null && s.do !== 'wait') why.push(at + ': require.waitMin on a ' + s.do + ' (wait only)');
          if (R.depart != null) {
            const D = R.depart, h = v => msNum(v) && v >= 0 && v <= 24;
            const ok = msObj(D) && Object.keys(D).length === 1 && ((D.after != null && h(D.after)) || (D.before != null && h(D.before)) || (Array.isArray(D.at) && D.at.length === 2 && D.at.every(h) && D.at[0] !== D.at[1]));
            if (!ok) why.push(at + ': require.depart is { after: h } | { before: h } | { at: [h0, h1] } (local hours)');
          }
          if (R.plane != null && !Array.isArray(R.plane)) why.push(at + ': require.plane is a list of criteria');
        }
      }
      if (s.say != null) say(s.say, at + ' say');
      if (s.do === 'talk' && s.say == null) why.push(at + ': talk needs a say');
      if (s.onDone != null) {
        if (!msObj(s.onDone)) why.push(at + ': onDone is an object');
        else {
          if (s.onDone.say != null) say(s.onDone.say, at + ' onDone.say');
          if (s.onDone.site != null) { const S = s.onDone.site; if (!msObj(S) || !sites[S.id] || !MISSION_SITE_STATES.includes(S.state)) why.push(at + ': onDone.site is { id (a pack site), state: ' + MISSION_SITE_STATES.join(' | ') + ' }'); }
          if (s.onDone.pay != null && !(msNum(s.onDone.pay) && s.onDone.pay >= 0)) why.push(at + ': onDone.pay is credits >= 0');
        }
      }
      if (s.split != null && !(msNum(s.split) && s.split >= 0)) why.push(at + ': split is seconds >= 0 (from the first checkpoint)');
    });
  });
  if (m.onDone != null) {
    if (!msObj(m.onDone)) why.push(id + ': onDone is an object');
    else {
      if (m.onDone.say != null) say(m.onDone.say, id + ' onDone.say');
      if (m.onDone.site != null) { const S = m.onDone.site; if (!msObj(S) || !sites[S.id] || !MISSION_SITE_STATES.includes(S.state)) why.push(id + ': onDone.site is { id (a pack site), state: ' + MISSION_SITE_STATES.join(' | ') + ' }'); }
      if (m.onDone.pay != null && !(msNum(m.onDone.pay) && m.onDone.pay >= 0)) why.push(id + ': onDone.pay is credits >= 0');
    }
  }
  if (m.rules != null) {
    if (!msObj(m.rules)) why.push(id + ': rules is an object');
    else for (const k of Object.keys(m.rules)) {
      const v = m.rules[k];
      if (!MISSION_RULES[k]) { why.push(id + ': rules.' + k + ' is not one of ' + Object.keys(MISSION_RULES).join(' ')); continue; }
      if (k === 'injury' && msObj(v)) {
        const B = typeof GEN_OCC !== 'undefined' && GEN_OCC.bands ? GEN_OCC.bands : null;
        const b = v.fail, okB = (msNum(b) && b >= 1 && b <= 4 && b === Math.round(b)) || (typeof b === 'string' && (!B || B.indexOf(b) >= 1));
        if (!okB) why.push(id + ': rules.injury.fail is a band 1-4 or its word (34_occupant GEN_OCC.bands)');
      } else if (k === 'strike' && msObj(v)) {
        if (!(msNum(v.penalty) && v.penalty >= 0 && v.penalty <= 60)) why.push(id + ': rules.strike.penalty is seconds, 0-60');
      } else if (!MISSION_RULES[k].includes(v)) why.push(id + ': rules.' + k + ' is ' + MISSION_RULES[k].join(' | '));
    }
  }
  if (m.timers != null) {
    if (!Array.isArray(m.timers)) why.push(id + ': timers is a list');
    else {
      const seen = {};
      m.timers.forEach((t, i) => {
        const at = id + ' timer ' + ((t && t.id) || i);
        if (!msObj(t) || typeof t.id !== 'string' || !t.id) { why.push(at + ': a timer has an id'); return; }
        if (seen[t.id]) why.push(at + ': timer id twice'); seen[t.id] = 1;
        for (const e of ['start', 'stop']) if (!stepIds[t[e]]) why.push(at + ': ' + e + ' names no step of the mission (' + t[e] + ')');
        // (MISSIONS-P1) a lap is flown in one flight over one leg (the tracker arms one leg at a time): start and stop
        // in the same leg, the start first
        if (stepIds[t.start] && stepIds[t.stop] && (stepLeg[t.start] !== stepLeg[t.stop] || stepPos[t.start] > stepPos[t.stop])) why.push(at + ': starts and stops in one leg, the start first');
        if (t.start === t.stop) why.push(at + ': starts and stops on the same step');
        const tg = t.target;
        if (!((msNum(tg) && tg > 0) || (msObj(tg) && msNum(tg.refKmh) && tg.refKmh > 0))) why.push(at + ': target is seconds or { refKmh }');
        if (t.medals != null && (!Array.isArray(t.medals) || !t.medals.length || t.medals.some(x => !['gold', 'silver', 'bronze'].includes(x && x.medal) || !(x.le > 0))))
          why.push(at + ': a medal is { medal: gold|silver|bronze, le: seconds }');
      });
    }
  }
  if (m.startFrom != null) {
    const S = m.startFrom, DS = typeof CONTRACT_DESIGNS !== 'undefined' ? CONTRACT_DESIGNS : {};
    if (!(S === 'player' || (typeof S === 'string' && DS[S]) || (msObj(S) && typeof S.build === 'string' && /\.json$/.test(S.build))))
      why.push(id + ': startFrom is player | a validated design id | { build: <file>.json }');
    if (m.kind !== 'build') why.push(id + ': startFrom on a ' + m.kind + ' (an aircraft order starts from a plane)');
  }
  if (m.prefs != null) {
    if (!Array.isArray(m.prefs)) why.push(id + ': prefs is a list');
    else {
      if (m.kind !== 'build') why.push(id + ': prefs on a ' + m.kind + ' (aircraft orders only)');
      const seen = {};
      for (const p of m.prefs) {
        const V = p && missionPrefValues(p.k), at = id + ' pref ' + (p && p.k);
        if (!V) { why.push(at + ': not one of ' + Object.keys(MISSION_PREF_KINDS).join(' ')); continue; }
        if (seen[p.k]) why.push(at + ': named twice'); seen[p.k] = 1;
        if (!V.includes(p.v)) why.push(at + ': ' + p.v + ' is not one of ' + V.join(' '));
        if (!MISSION_NEED.includes(p.need)) why.push(at + ': need is bonus | mandatory (the user: each item marked by the author)');
        if (p.need === 'bonus' && !(msNum(p.pct) && p.pct > 0 && p.pct <= 100)) why.push(at + ': a bonus pays pct (1-100)');
        if (p.need === 'mandatory' && p.pct != null) why.push(at + ': a mandatory preference pays no bonus');
      }
    }
  }
  if (m.delivery != null) {
    if (m.kind !== 'build') why.push(id + ': delivery on a ' + m.kind + ' (aircraft orders only)');
    if (!msObj(m.delivery) || Object.keys(m.delivery).some(k => !['sold', 'blueprint'].includes(k) || typeof m.delivery[k] !== 'boolean')) why.push(id + ': delivery is { sold: bool, blueprint: bool }');
  }
  if (m.route != null) {
    const R = typeof routeNormalise === 'function' ? routeNormalise(m.route) : (msObj(m.route) && Array.isArray(m.route.pts) ? m.route : null);
    if (!R || R.pts.length < 2) why.push(id + ': route is a drawn route record (38c_route.js) with 2+ points');
    else if (R.pts.length !== m.route.pts.length) why.push(id + ': the route has points routeNormalise drops');
  }
  if (m.rally != null) {
    if (!msObj(m.rally) || !(msNum(m.rally.refKmh) && m.rally.refKmh > 20) || (m.rally.r != null && !(msNum(m.rally.r) && m.rally.r > 0))) why.push(id + ': rally is { refKmh > 20, r? }');
    if (m.route == null) why.push(id + ': a rally needs its embedded route');
  }
  return why;
}
// THE PACK -> [why] (empty = valid). opts: { fields, spots, ids (contract ids `needs.after` may name besides the pack's) }
function missionPackValidate(pack, opts) {
  opts = opts || {};
  const why = [], P = pack || {};
  if (P.what !== MISSION_PACK_WHAT) why.push('what must be ' + MISSION_PACK_WHAT);
  if (P.v !== MISSION_PACK_V) why.push('v must be ' + MISSION_PACK_V + ' (got ' + P.v + ')');
  for (const k of ['campaigns', 'missions']) if (!Array.isArray(P[k])) why.push(k + ' is not a list');
  if (why.length) return why;
  const T = missionText(P), F = opts.fields || CONTRACT_FIELDS;
  for (const k of Object.keys(P.text || {})) if (!msObj(P.text[k]) || typeof P.text[k].t !== 'string') why.push('text ' + k + ' is not { t }');
  // the sites
  const sites = {};
  for (const s of P.sites || []) {
    const at = 'site ' + (s && s.id);
    if (!msObj(s) || typeof s.id !== 'string' || !s.id) { why.push('a site has an id'); continue; }
    if (sites[s.id]) why.push(at + ': twice'); sites[s.id] = s;
    if (typeof s.asset !== 'string' || !s.asset) why.push(at + ': an asset (what stands there)');
    if (!msObj(s.at) || !msXZ([s.at.x, s.at.z]) || (s.at.hdg != null && !msNum(s.at.hdg))) why.push(at + ': at is { x, z, hdg? }');
    if (!MISSION_SITE_STATES.includes(s.state)) why.push(at + ': state is ' + MISSION_SITE_STATES.join(' | '));
    if (s.field != null && !(opts.fields || CONTRACT_FIELDS)[s.field]) why.push(at + ': field ' + s.field + ' is not a field (the strip that serves it)');
    if (s.track != null) { const m = /^(\w+):(\d+)$/.exec(s.track); if (!m || typeof CONTRACT_TRACKS === 'undefined' || !CONTRACT_TRACKS[m[1]] || +m[2] < 1 || +m[2] > CONTRACT_TRACKS[m[1]].max) why.push(at + ': track is <track>:<1..max> (76_stages)'); }
  }
  // the missions: ids once, each valid as a contract record and in its new fields
  const byId = {};
  for (const m of P.missions) {
    if (!msObj(m) || typeof m.id !== 'string' || !m.id) { why.push('a mission with no id'); continue; }
    if (byId[m.id]) why.push(m.id + ': mission id twice'); byId[m.id] = m;
  }
  const ids = Object.keys(byId).concat(opts.ids || []);
  const beats = typeof STORY_BEATS !== 'undefined' ? STORY_BEATS.map(b => b.id) : null;
  for (const m of P.missions) {
    if (!msObj(m) || !m.id) continue;
    if (m.tutorial != null) {
      const extra = Object.keys(m).filter(k => !['id', 'tutorial'].includes(k));
      if (extra.length) why.push(m.id + ': a tutorial listing is read-only (id, tutorial) - it carries ' + extra.join(', '));
      if (m.id !== 'story.' + m.tutorial) why.push(m.id + ': a tutorial listing is story.<beat>');
      if (beats && !beats.includes(m.tutorial)) why.push(m.id + ': no beat ' + m.tutorial + ' in 79_story.js');
      continue;
    }
    const n = missionNormalise(m);
    const rec = missionToContract(n, { pack: P });
    for (const w of contractValidate(rec, { mission: true, text: T, fields: F, ids })) why.push(w);
    for (const w of missionWhy(n, { pack: P, text: T, fields: F, sites, spots: opts.spots })) why.push(w);
  }
  // the tree: containers once, their orders, every mission in one chapter at most, the cross-links resolve
  const boxes = {}, placed = {};
  for (const c of P.campaigns) {
    const at = 'campaign ' + (c && c.id);
    if (!msObj(c) || typeof c.id !== 'string' || !c.id) { why.push('a campaign has an id'); continue; }
    if (boxes[c.id] || byId[c.id]) why.push(at + ': id twice'); boxes[c.id] = c;
    if (c.title && !contractTextOk(c.title, T)) why.push(at + ': title key ' + c.title + ' does not resolve');
    if (c.provider != null && (typeof CONTRACT_PROVIDERS === 'undefined' || !CONTRACT_PROVIDERS[c.provider])) why.push(at + ': no provider ' + c.provider);
    const O = missionOrder(c.order);
    if (!O) why.push(at + ': order ' + c.order + ' is not seq | any | choose:N');
    else if (O.kind === 'choose' && O.n > (c.chapters || []).length) why.push(at + ': choose:' + O.n + ' of ' + (c.chapters || []).length + ' chapters');
    for (const h of c.chapters || []) {
      const hat = 'chapter ' + (h && h.id);
      if (!msObj(h) || typeof h.id !== 'string' || !h.id) { why.push(at + ': a chapter has an id'); continue; }
      if (boxes[h.id] || byId[h.id]) why.push(hat + ': id twice'); boxes[h.id] = h;
      if (h.title && !contractTextOk(h.title, T)) why.push(hat + ': title key ' + h.title + ' does not resolve');
      const HO = missionOrder(h.order);
      if (!HO) why.push(hat + ': order ' + h.order + ' is not seq | any | choose:N');
      else if (HO.kind === 'choose' && HO.n > (h.missions || []).length) why.push(hat + ': choose:' + HO.n + ' of ' + (h.missions || []).length + ' missions');
      for (const id of h.missions || []) {
        if (!byId[id]) why.push(hat + ': no mission ' + id);
        else if (placed[id]) why.push(hat + ': ' + id + ' is already in chapter ' + placed[id]);
        else placed[id] = h.id;
        const m = byId[id];
        if (m && c.tutorial && m.tutorial == null) why.push(hat + ': ' + id + ' in the tutorial campaign is not a tutorial listing');
        if (m && !c.tutorial && m.tutorial != null) why.push(hat + ': tutorial listing ' + id + ' outside the tutorial campaign');
        if (m && c.provider && m.tutorial == null && m.provider !== c.provider && !c.mixed) why.push(hat + ': ' + id + ' is ' + m.provider + '\'s, the campaign ' + c.provider + '\'s (mixed: true to allow)');
      }
    }
    // THE TUTORIAL (§7: it stays exactly as it is): read-only, phase 0, every beat once and in the story's order
    if (c.tutorial) {
      if (c.readonly !== true) why.push(at + ': the tutorial campaign is readonly');
      const listed = [].concat(...(c.chapters || []).map(h => h.missions || [])).map(id => byId[id] && byId[id].tutorial);
      if (beats && listed.join() !== beats.join()) why.push(at + ': lists ' + listed.join(' ') + ', the story is ' + beats.join(' '));
    }
  }
  for (const c of P.campaigns) for (const B of [c].concat((c && c.chapters) || [])) if (B && B.needs != null) {
    if (!msObj(B.needs) || !Array.isArray(B.needs.after)) why.push(B.id + ': needs is { after: [container ids] }');
    else for (const a of B.needs.after) if (!boxes[a]) why.push(B.id + ': needs.after names ' + a + ', no campaign or chapter');
  }
  // the built-in pack's account of 72_'s contracts
  if (P.legacy != null) {
    const L = P.legacy;
    if (!msObj(L) || !Array.isArray(L.retrofitted) || !Array.isArray(L.dropped)) why.push('legacy is { retrofitted: [id], dropped: [{ id, why }] }');
    else {
      for (const id of L.retrofitted) if (!byId[id]) why.push('legacy: retrofitted ' + id + ' is not a mission of the pack');
      for (const d of L.dropped) if (!msObj(d) || typeof d.id !== 'string' || typeof d.why !== 'string' || !d.why) why.push('legacy: a drop is { id, why }');
        else if (byId[d.id]) why.push('legacy: ' + d.id + ' is dropped and still a mission');
    }
  }
  return why;
}

// ---- THE PACK AS THE CAREER READS IT --------------------------------------------------------------------------------
// every (non-tutorial) mission as a contract record, by id
function missionPackContracts(pack) {
  const P = missionPackNormalise(pack), out = {};
  for (const m of P.missions) if (m.tutorial == null && m.id) out[m.id] = missionToContract(m, { pack: P });
  return out;
}
// THE INSTALL: a providers table (CONTRACT_PROVIDERS' shape) with each provider's authored lists filled from the pack's
// campaigns - a SEQ chapter of the provider's campaign is its `arc` (offered one at a time, in order: 74_ careerOfferIds),
// an ANY or a CHOOSE:N chapter's aircraft orders its `builds` and its other missions its `night` list (each offered once
// its needs are met: the night list's check - a validated design flies it - is the one a flying mission needs).
// (MISSIONS-P3) THE CONTAINERS ride on the records: a container is DONE when all its missions are (a choose:N chapter: N
// of them; a campaign: every chapter) -> `needs.of: [{ ids, n }]` on every mission behind it - a chapter's or a campaign's
// `needs.after`, the chapter before in a seq campaign; a choose:N chapter's missions carry `closed: { ids, n }` (offered
// only while fewer than n are done). 74_ careerNeedsOk reads both. HELD OUT, with the reason: a mission the runtime
// cannot run yet (contractRuntimeOk), a choose:N CAMPAIGN (N chapters of many: not expressible yet), a mission of
// another provider in a seq chapter (its arc is per provider).
// Pure: returns { providers, held: [{ id, why }], text }; the table handed in is not changed (its jobs, goods, fields
// kept). `text` is the pack's own words over the model's labels (MISSION_TEXT): the boot merges it into CONTRACT_TEXT
// with the providers, or the card reads a pack mission's keys as [keys].
function missionPackInstall(pack, providers) {
  const P = missionPackNormalise(pack), base = providers || CONTRACT_PROVIDERS, out = {}, held = [];
  const recs = missionPackContracts(P);
  for (const p of Object.keys(base)) out[p] = Object.assign({}, base[p], { arc: [], builds: [], night: [] });
  const boxes = {};
  for (const c of P.campaigns) { boxes[c.id] = c; for (const h of c.chapters) boxes[h.id] = h; }
  // a container's DONE as conditions [{ ids, n }] (null: not expressible - a choose:N campaign)
  const chDone = h => { const O = missionOrder(h.order); return [{ ids: h.missions.slice(), n: O && O.kind === 'choose' ? O.n : h.missions.length }]; };
  const doneOf = id => { const B = boxes[id]; if (!B) return []; if (!B.chapters) return chDone(B);
    const O = missionOrder(B.order); return O && O.kind === 'choose' ? null : [].concat(...B.chapters.map(chDone)); };
  const needsOf = N => { if (!N || !Array.isArray(N.after)) return []; const L = N.after.map(doneOf); return L.some(x => x == null) ? null : [].concat(...L); };
  for (const c of P.campaigns) {
    if (c.tutorial) continue;
    const all = [].concat(...c.chapters.map(h => h.missions)), CO = missionOrder(c.order);
    if (CO && CO.kind === 'choose') { for (const id of all) held.push({ id, why: 'campaign ' + c.id + ' is ' + c.order + ' (N chapters of many: no runtime yet)' }); continue; }
    const c0 = needsOf(c.needs);
    c.chapters.forEach((h, k) => {
      const O = missionOrder(h.order);
      const conds = c0 == null ? null : c0.concat(needsOf(h.needs) || [], CO && CO.kind === 'seq' && k > 0 ? chDone(c.chapters[k - 1]) : []);
      const closed = O && O.kind === 'choose' ? { ids: h.missions.slice(), n: O.n } : null;
      for (const id of h.missions) {
        let r = recs[id];
        if (!r) continue;
        if (conds == null || needsOf(h.needs) == null) { held.push({ id, why: 'its needs name a choose:N campaign (no runtime yet)' }); continue; }
        const rw = contractRuntimeOk(r);
        if (rw) { held.push({ id, why: rw }); continue; }
        const T = out[r.provider];
        if (!T) { held.push({ id, why: 'no provider ' + r.provider }); continue; }
        if (conds.length || closed) {
          r = msClone(r);
          if (conds.length) r.needs = Object.assign({}, r.needs || { after: [], rep: 0 }, { of: msClone(conds) });
          if (closed) r.closed = closed;
        }
        if (O.kind === 'seq') { if (c.provider && r.provider !== c.provider) { held.push({ id, why: 'a seq chapter of ' + c.provider + ' holds ' + r.provider + '\'s mission (its arc is per provider)' }); continue; } T.arc.push(r); }
        else (r.kind === 'build' ? T.builds : T.night).push(r);
      }
    });
  }
  return { providers: out, held, text: Object.assign({}, MISSION_TEXT, msClone(P.text || {})) };
}

// ---- THE REWARD (the editor's live line) ----------------------------------------------------------------------------
// -> { pay: contractPay's parts (what the map's card shows), paid: contractPayTotal with no bonus (what careerComplete
//      pays), best: every bonus earned (the gold medal, each criterion beaten by its margin), prefs: the bonus
//      preferences' pct (phase 2 pays them), why: contractRuntimeOk's ('' = the runtime runs it today) }
function missionReward(m, ctx) {
  const rec = missionToContract(m, ctx), pay = contractPay(rec, ctx && ctx.fields), crit = contractCrit(rec), got = {};
  for (const b of (rec.pay && rec.pay.bonus) || []) {
    const c = crit.find(x => x.k === b.crit);
    if (c && msNum(c.v) && msNum(b.by)) got[c.k] = c.op === '>=' ? c.v * (1 + b.by) + 1e-6 : c.v * (1 - b.by) - 1e-6;
  }
  const medals = contractSubsOf(rec).some(s => s.medals) || (rec.timers || []).some(t => t.medals);
  const prefs = (rec.prefs || []).filter(p => p.need === 'bonus').reduce((a, p) => a + (p.pct || 0), 0);
  return { pay, paid: contractPayTotal(rec, {}, null), best: contractPayTotal(rec, got, medals ? 'gold' : null), prefs, why: contractRuntimeOk(rec) };
}

// ---- THE RALLY (§3.3, §7: "checkpoints and split targets are worked out automatically from the hidden route, and the
// author can override them") -----------------------------------------------------------------------------------------
// -> a new mission: its rally leg's checkpoints rebuilt from the embedded route - one `pass` over each route point
// (a point place of the rally's radius, the drawn altitude as a band of +-alt), a split (s from the first checkpoint) at
// the reference speed along the route, and the `rally` timer from the first to the last. An AUTHORED checkpoint (auto
// absent or false, same id) keeps its place and split; an authored split on an auto checkpoint is kept too (`split`
// written with auto: 'place'). Other legs are untouched. opts: { refKmh, r, band (m), leg (the leg index) }
function missionRallyDerive(m, opts) {
  const M = missionNormalise(m), R = M.route && (typeof routeNormalise === 'function' ? routeNormalise(M.route) : M.route);
  if (!R || !Array.isArray(R.pts) || R.pts.length < 2) return M;
  const o = Object.assign({ refKmh: 150, r: 300, band: 150 }, M.rally || {}, opts || {});
  const v = o.refKmh / 3.6;
  let li = o.leg != null ? o.leg : M.legs.findIndex(L => L.rally);
  if (li < 0) { M.legs.push({ rally: true, order: 'seq', steps: [] }); li = M.legs.length - 1; }
  const L = M.legs[li], old = {};
  for (const s of L.steps || []) if (s.id) old[s.id] = s;
  let d = 0;
  L.rally = true; L.order = 'seq';
  L.steps = R.pts.map((p, i) => {
    if (i) d += Math.hypot(p.x - R.pts[i - 1].x, p.z - R.pts[i - 1].z);
    const id = 'cp' + (i + 1), was = old[id];
    if (was && !was.auto) return was;                           // authored: kept whole
    const s = { id, do: 'pass', place: { pt: [Math.round(p.x), Math.round(p.z)], r: o.r, alt: { min: Math.round(p.alt - o.band), max: Math.round(p.alt + o.band), ref: p.ref } },
                split: Math.round(d / v), auto: true };
    if (was && was.auto === 'place' && msNum(was.split)) { s.split = was.split; s.auto = 'place'; }
    return s;
  });
  const timers = (M.timers || []).filter(t => t.id !== 'rally');
  timers.push({ id: 'rally', start: 'cp1', stop: 'cp' + R.pts.length, target: L.steps[L.steps.length - 1].split || Math.round(d / v), splits: true });
  M.timers = timers;
  M.rally = { refKmh: o.refKmh, r: o.r };
  return M;
}

// ---- THE TUTORIAL (§7: the tutorial missions stay exactly as they are - listed, marked "tutorial / phase 0", read-only)
// -> [{ id, beat, title, brief, goal, tim, readonly: true, phase: 0 }] off 79_story.js's beats (empty without it)
function missionTutorial() {
  if (typeof STORY_BEATS === 'undefined') return [];
  return STORY_BEATS.map(b => ({ id: 'story.' + b.id, beat: b.id, title: b.title, brief: b.brief, goal: msClone(b.goal),
    tim: (typeof STORY_TIM !== 'undefined' && STORY_TIM[b.id]) ? STORY_TIM[b.id].slice() : [], readonly: true, phase: 0 }));
}

// ---- THE BUILT-IN PACK, FROM TODAY'S CONTRACTS (the retrofit; tools/_missions_retrofit.js writes it) ----------------
// One campaign per provider (its client the owner of every mission): the arc a SEQ chapter, the standalone aircraft
// orders and the night work ANY chapters; each mission read from its record (missionFromContract), its completion line
// (72_'s ct.<id>.done, when written) said by the client; the tutorial a read-only campaign. opts.dropped: [{ id, why }]
function missionPackFromContracts(opts) {
  opts = opts || {};
  const drop = {};
  for (const d of opts.dropped || []) drop[d.id] = d.why;
  const T = typeof CONTRACT_TEXT !== 'undefined' ? CONTRACT_TEXT : {};
  const pack = { what: MISSION_PACK_WHAT, v: MISSION_PACK_V, id: 'builtin', title: 'The built-in missions (72_contract_data.js, retrofitted)',
                 campaigns: [], missions: [], sites: [], text: {}, legacy: { retrofitted: [], dropped: (opts.dropped || []).map(msClone) } };
  for (const p of Object.keys(CONTRACT_PROVIDERS)) {
    const Pr = CONTRACT_PROVIDERS[p], client = peopleClientOf(p);
    const C = { id: 'prov.' + p, title: Pr.name, provider: p, order: 'any', chapters: [] };
    const lists = [['arc', 'seq'], ['builds', 'any'], ['night', 'any']];
    for (const [k, order] of lists) {
      const recs = (Pr[k] || []).filter(r => !(r.id in drop));
      if (!recs.length) continue;
      C.chapters.push({ id: p + '.' + k, title: 'ms.chapter.' + k, order, missions: recs.map(r => r.id) });
      for (const r of recs) {
        const m = missionFromContract(r);
        if (client) m.client = client;
        const done = 'ct.' + r.id + '.done';
        if (client && T[done]) m.onDone = { say: { who: client, text: done } };
        pack.missions.push(m);
        pack.legacy.retrofitted.push(r.id);
      }
    }
    pack.campaigns.push(C);
  }
  const tut = missionTutorial();
  if (tut.length) {
    pack.campaigns.push({ id: 'tutorial', title: 'ms.campaign.tutorial', tutorial: true, readonly: true, phase: 0, order: 'seq',
                          chapters: [{ id: 'tutorial.beats', title: 'ms.chapter.tutorial', order: 'seq', missions: tut.map(t => t.id) }] });
    for (const t of tut) pack.missions.push({ id: t.id, tutorial: t.beat });
  }
  return pack;
}
