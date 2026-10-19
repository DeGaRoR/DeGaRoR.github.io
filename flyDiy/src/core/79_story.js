// ===========================================================================
// THE STORY (G2741 STORY-CORE) — the career's tutorial on rails, then open:
// the beats T0-T7 as data, the story's state in the career document, one
// pure step per event, and the story's places found by ROLE.
// futureDesigns/game/GAME-PLAN-2026-10-15.md §3 (the beats), §R (the user's
// rulings of 15 Oct), §10 Q1 (the job list held until the three occasions).
// ===========================================================================
// THE SHAPE: `career.story` rides the career block (74_career.js); careerNormalise leaves it as it finds it, so a
// career WITHOUT a story (every career made before this, the dev career) has no rails and nothing here applies to it.
//   story: { v: STORY_V, beat: 'T0'..'T7' | 'open', done: ['T0', ...], planes: { starter, client, gift }: fleet slots,
//            base: { client: <spec snapshot as it arrived> }, jobs: <tutorial jobs delivered>, open: false }
// THE STEP: storyStep(doc, ev, ctx) -> { ok, doc, advanced: [beat ids], effects: [...], why }. Pure, on a clone; a
// refusal hands back the very document it was given. EFFECTS are what the page must do to the world (a plane appears,
// a hangar is ours, a route is offered, the occasions are listed); the core only records that the beat moved on.
// The page answers a plane's arrival with a 'bind' event: { k: 'bind', role: 'client', slot }.
// ===========================================================================
const STORY_V = 1;

// ---- THE STORY'S PLACES, BY ROLE ------------------------------------------------------------------------------------
// The user names the cabin strip in the scenery editor (18 Oct): any aerodrome whose record says `role: 'cabin'` (or
// lists it in `roles`), else whose NAME matches, else the first of the fallback ids present on the island. A role that
// resolves to nothing returns null and the beat that needs it is refused with its reason (never a guess).
const STORY_ROLES = {
  // the user, 18 Oct: "the start of the game should really feel like you're in the middle of nowhere" - with no strip named
  // Cabin yet, the story starts at a REMOTE strip (East Point Clearing, 150 m gravel; Rufus B needs 62 m), else Tamgas
  // Hill; never HOME (the hub you fly to later)
  cabin:  { name: /\bcabin\b/i, ids: ['nv_strip', 'w3'], words: 'the cabin strip' },
  home:   { name: null, ids: ['HOME'], words: 'the WWII field' },
  client: { name: /\bowner\b/i, ids: ['w6', 'w7', 'w5'], words: "the owner's strip" },        // long and easy (§3 T3)
  water:  { name: null, kinds: ['water'], ids: ['SEA', 'mk_sea'], words: 'the seaplane base' },
};
function storySite(role, aeros) {
  const R = STORY_ROLES[role], L = Array.isArray(aeros) ? aeros.filter(a => a && typeof a.id === 'string') : [];
  if (!R) return null;
  const tagged = L.find(a => a.role === role || (Array.isArray(a.roles) && a.roles.includes(role)));
  if (tagged) return tagged.id;
  if (R.name) { const n = L.find(a => typeof a.name === 'string' && R.name.test(a.name)); if (n) return n.id; }
  for (const id of R.ids) if (L.some(a => a.id === id && (!R.kinds || R.kinds.includes(a.kind)))) return id;
  if (R.kinds) { const k = L.find(a => R.kinds.includes(a.kind)); if (k) return k.id; }
  return null;
}

// ---- THE CLIENT'S CHECKLIST (T2: the friends turn the client's wishes into clear objectives) -------------------------
// Each item compares the delivered design with the plane as it ARRIVED (story.base.client), so "upgrade" means changed
// from the arrival, never an absolute spec - performance contracts keep their rule; these are §R's special requests.
const storyFitRank = S => { const f = S && S.systems && S.systems.fit; return f === 'minimal' ? 0 : f === 'basic' ? 1 : f === 'ifr' ? 2 : f === 'custom' ? 1.5 : 1; };
const storyBattery = S => { try { return genSystemsResolve(S).elec.battery !== 'none'; } catch (e) { return storyFitRank(S) >= 1; } };
const STORY_CHECKS = {
  engine: { words: 'a stronger engine', ok: (S, B) => !!(S.engines && S.engines[0] && B.engines && B.engines[0] && S.engines[0].type !== B.engines[0].type) },
  flaps:  { words: 'flaps fitted', ok: (S, B) => !!(S.controls && S.controls.flap && S.controls.flap.type && S.controls.flap.type !== 'none') &&
                                                  !(B.controls && B.controls.flap && B.controls.flap.type && B.controls.flap.type !== 'none') },
  tyres:  { words: 'fat tyres (a quarter bigger)', ok: (S, B) => !!(S.gear && B.gear && +S.gear.wheelR >= 1.25 * +B.gear.wheelR) },
  // the aeroplane's lights hang on its electrics (the game draws nav / landing lights where a battery feeds them):
  // "lights" = an electrical system where the plane arrived with none
  lights: { words: 'lights (an electrical system)', ok: (S, B) => storyBattery(S) && !storyBattery(B) },
  panel:  { words: 'a better panel', ok: (S, B) => storyFitRank(S) > storyFitRank(B) },
  paint:  { words: 'a fresh paint job', ok: (S, B) => { const p = S.paint || {}, q = B.paint || {};
                                                       return p.job !== 'bare' && (p.job !== q.job || p.base !== q.base || p.trim !== q.trim); } },
};
function storyChecklist(spec, base, items) {
  const S = spec || {}, B = base || {};
  return (items || []).map(k => { const C = STORY_CHECKS[k];
    let ok = false; try { ok = !!(C && C.ok(S, B)); } catch (e) { ok = false; }
    return { k, words: C ? C.words : k, ok }; });
}

// ---- THE BEATS (§3; the words are placeholders for the narrative pack, keyed by id) ---------------------------------
// goal: what moves the beat on. enter / done: the effects handed to the page on entering / completing it. mask: the
// tutorial mode of the tech mask (TECH-MASK G3230) while the beat stands - 'finish' = the finish only.
const STORY_BEATS = [
  { id: 'T0', title: 'The cabin', mask: 'finish',
    brief: 'Your ultralight waits in the shed. Make it yours - a colour, a name - then come and read the letter.',
    goal: { k: 'ack' } },
  { id: 'T1', title: 'The move', brief: 'The proposal was accepted: the old WWII field is ours. Fly the ultralight there.',
    goal: { k: 'stop', at: 'home', plane: 'starter' },
    done: [{ k: 'hangar', at: 'home', shell: 'club' }] },
  { id: 'T2', title: "The client's plane", mask: 'checklist',
    brief: 'A client brings an unfinished Cub. The checklist is on the bench; keep it on budget.',
    enter: [{ k: 'clientPlane', at: 'home' }],
    // costCap (G2742 STORY-PAGE, measured): the page's cost is dm11's edit bill (every ledger line the work rebuilt, at build
    // price) against the Cub as it arrived. G2741's 9000 could not be met by any finish (the cheapest complete one, on the
    // Rotax 582, bills 24 248); finished on the Jabiru 2200 35 114, the Rotax 912 38 089, the O-200 44 355, the O-320 48 745
    goal: { k: 'certified', plane: 'client', checklist: ['engine', 'flaps', 'tyres', 'lights', 'panel', 'paint'], costCap: 40000 } },
  { id: 'T3', title: 'The delivery', brief: "Certified. Fly it to its owner's strip.",
    goal: { k: 'stop', at: 'client', plane: 'client' } },
  { id: 'T4', title: 'The gift', brief: '"I can’t pay you. Keep it." The Cub is yours.',
    enter: [{ k: 'giftPlane', plane: 'client' }], goal: { k: 'ack' } },
  { id: 'T5', title: 'Cub work', brief: 'A pickup, a survey, a small load: quick, easy jobs.',
    goal: { k: 'jobs', n: 3 } },
  { id: 'T6', title: 'The water job', brief: 'A job you promised: fit floats to the Cub and land it at the seaplane base.',
    goal: { k: 'stop', at: 'water', plane: 'gift', gear: 'floats' },
    done: [{ k: 'routeOffer', plane: 'gift', a: 'water', b: 'home' }] },
  { id: 'T7', title: 'The three occasions', brief: 'Back to the ultralight alone - and three planes on offer, once only.',
    enter: [{ k: 'occasions', n: 3 }], goal: { k: 'ack' },
    done: [{ k: 'open' }] },
];
const STORY_IDS = STORY_BEATS.map(b => b.id);
const storyBeatOf = id => STORY_BEATS.find(b => b.id === id) || null;

// ---- THE STATE --------------------------------------------------------------------------------------------------------
function storyNew() {
  return { v: STORY_V, beat: 'T0', done: [], planes: { starter: null, client: null, gift: null }, base: {}, jobs: 0, open: false };
}
function storyNormalise(s) {
  const d = storyNew();
  if (!s || typeof s !== 'object') return d;
  const beat = (s.beat === 'open' || STORY_IDS.includes(s.beat)) ? s.beat : 'T0';
  const done = Array.isArray(s.done) ? STORY_IDS.filter(id => s.done.includes(id)) : [];
  const planes = {};
  for (const k of Object.keys(d.planes)) planes[k] = (s.planes && typeof s.planes[k] === 'string') ? s.planes[k] : null;
  const base = (s.base && typeof s.base === 'object' && !Array.isArray(s.base)) ? s.base : {};
  const jobs = (typeof s.jobs === 'number' && isFinite(s.jobs) && s.jobs > 0) ? Math.floor(s.jobs) : 0;
  const out = { v: STORY_V, beat, done, planes, base, jobs, open: beat === 'open' || !!s.open };
  // (G2742 STORY-PAGE) what the page recorded, carried when present: where the story began (`cabin`: the strip and the
  // shed, or null with `note` - no cabin on the island yet), the offers it recorded (`offers`: the route stub), the
  // occasions listed (`occasions`: the authored listings' ids) - absent on a story that has none
  if (s.cabin === null || (s.cabin && typeof s.cabin === 'object' && typeof s.cabin.aero === 'string')) out.cabin = s.cabin ? { aero: s.cabin.aero, hangar: typeof s.cabin.hangar === 'string' ? s.cabin.hangar : null } : null;
  if (typeof s.note === 'string' && s.note) out.note = s.note;
  if (Array.isArray(s.offers)) out.offers = s.offers.filter(o => o && typeof o === 'object').map(o => JSON.parse(JSON.stringify(o)));
  if (Array.isArray(s.occasions)) out.occasions = s.occasions.filter(id => typeof id === 'string');
  return out;
}
// the story of a career document, or null (the sandbox, a career without one)
const storyOf = doc => (doc && doc.mode === 'career' && doc.career && doc.career.story) ? storyNormalise(doc.career.story) : null;
// G2743 THE CABIN, GRANTED: the shed on the cabin's plot (BASE_OFFERS[aero].plots[plot]) is the player's, free - the
// story's gift, no ledger charge - and HOME's shed is LOCKED until T1 (71_ playerShedLocked: the start owns ONLY the
// cabin, the user 18 Oct). `here` is the cabin. A cabin with no plot on offer -> refused with the reason (the start
// stays at HOME's garage and the page says why; never a guess).
function storyGrantCabin(d, aero, plot) {
  const O = typeof BASE_OFFERS !== 'undefined' && BASE_OFFERS[aero], P = O && O.plots[plot || aero];
  if (!P) return 'no shed to hold at ' + aero + ' (BASE_OFFERS has no plot there)';
  const id = plot || aero, shell = P.shells[0];
  if (!d.sheds[id]) d.sheds[id] = { shell, kits: (P.kits || []).slice(), base: aero, tenure: 'own',
    dims: Object.assign({}, SHELLS[shell].dims, (P.dims && P.dims[shell]) || {}), price: 0, since: 0, story: true };
  if (d.sheds[PREM_MAIN] && id !== PREM_MAIN) d.sheds[PREM_MAIN].locked = 'story';
  d.here = id;
  return null;
}
// a new career WITH the story (STORY-PAGE calls this once, at New career): the starter plane's slot is bound by the page;
// o.cabin = { aero, plot } (storySite('cabin') and its base plot) grants the cabin and locks HOME until T1
function storyStart(doc, starterSlot, o) {
  if (!doc || doc.mode !== 'career' || !doc.career) return { ok: false, doc, why: 'not a career' };
  if (doc.career.story) return { ok: false, doc, why: 'the story has already started' };
  const d = JSON.parse(JSON.stringify(doc)), s = storyNew();
  if (typeof starterSlot === 'string') s.planes.starter = starterSlot;
  let note = null;
  if (o && o.cabin && o.cabin.aero) note = storyGrantCabin(d, o.cabin.aero, o.cabin.plot);
  d.career.story = s;
  return { ok: true, doc: d, effects: storyEnterEffects('T0'), why: note };
}
// Q1 (§10, accepted): the generated job list is held until the three occasions; the story's own jobs are offered
const storyJobsOpen = doc => { const s = storyOf(doc); return !s || s.open; };
const storyMask = doc => { const s = storyOf(doc); const B = s && !s.open ? storyBeatOf(s.beat) : null; return (B && B.mask) || null; };
function storyEnterEffects(id) { const B = storyBeatOf(id); return B && B.enter ? B.enter.map(e => Object.assign({ beat: id }, e)) : []; }

// ---- THE STEP ---------------------------------------------------------------------------------------------------------
// ev: { k: 'ack' } | { k: 'bind', role, slot, spec? } | { k: 'stop', stop (careerStopRecord), slot, gear? }
//     | { k: 'certified', slot, spec, cost } | { k: 'jobDone', id }
// ctx: { aeros: world.aerodromes } (the roles' places)
function storyStep(doc, ev, ctx) {
  const no = why => ({ ok: false, doc, advanced: [], effects: [], why });
  const s0 = storyOf(doc);
  if (!s0) return no('no story in this document');
  if (s0.open) return no('the story is open: nothing on rails');
  if (!ev || typeof ev.k !== 'string') return no('no event');
  const d = JSON.parse(JSON.stringify(doc)), s = storyNormalise(d.career.story);
  const B = storyBeatOf(s.beat), G = B.goal, aeros = (ctx && ctx.aeros) || [];
  // a plane the page put in the world for the story: its slot, and (the client's) the spec it arrived with
  if (ev.k === 'bind') {
    if (!(ev.role in s.planes) || typeof ev.slot !== 'string') return no('bind: an unknown role or no slot');
    s.planes[ev.role] = ev.slot;
    if (ev.role === 'client' && ev.spec && typeof ev.spec === 'object') s.base.client = JSON.parse(JSON.stringify(ev.spec));
    d.career.story = s;
    return { ok: true, doc: d, advanced: [], effects: [], why: null };
  }
  let met = false, why = null;
  if (G.k === 'ack') { met = ev.k === 'ack'; why = met ? null : 'this beat waits for the player to read it'; }
  else if (G.k === 'stop') {
    if (ev.k !== 'stop' || !ev.stop) why = 'this beat waits for a landing';
    else {
      const at = storySite(G.at, aeros), plane = G.plane === 'gift' ? s.planes.gift : s.planes[G.plane];
      if (!at) why = 'no aerodrome plays ' + STORY_ROLES[G.at].words + ' on this island yet';
      else if (ev.stop.wrecked || ev.stop.how !== 'stopped') why = 'the flight did not end stopped and whole';
      else if (ev.stop.aero !== at) why = 'not at ' + STORY_ROLES[G.at].words;
      else if (plane && ev.slot !== plane) why = 'not with the story’s plane';
      else if (G.gear && ev.gear !== G.gear && (ev.stop.gear || null) !== G.gear) why = 'not on ' + G.gear;
      else met = true;
    }
  }
  else if (G.k === 'certified') {
    if (ev.k !== 'certified') why = 'this beat waits for the certified build';
    else if (s.planes.client && ev.slot !== s.planes.client) why = 'not the client’s plane';
    else {
      const list = storyChecklist(ev.spec, s.base.client, G.checklist), miss = list.filter(r => !r.ok);
      if (miss.length) why = 'the checklist: ' + miss.map(r => r.words).join(', ');
      else if (typeof ev.cost === 'number' && ev.cost > G.costCap) why = 'over budget (' + Math.round(ev.cost) + ' > ' + G.costCap + ')';
      else met = true;
    }
  }
  else if (G.k === 'jobs') {
    if (ev.k !== 'jobDone') why = 'this beat waits for delivered jobs';
    else { s.jobs++; met = s.jobs >= G.n; if (!met) why = s.jobs + ' of ' + G.n + ' jobs'; }
  }
  if (!met) {
    // a counted job is progress even when the beat is not met yet
    if (G.k === 'jobs' && ev.k === 'jobDone') { d.career.story = s; return { ok: true, doc: d, advanced: [], effects: [], why }; }
    return no(why);
  }
  // the beat is done: its done-effects, the next beat and its enter-effects
  const effects = (B.done || []).map(e => Object.assign({ beat: B.id }, e));
  s.done.push(B.id);
  if (B.id === 'T4' && s.planes.client) s.planes.gift = s.planes.client;          // the gift: the client's Cub is ours
  // G2743: T1's reward - the WWII field's hangar is ours: HOME's lock (storyStart) is lifted
  if (B.id === 'T1' && d.sheds && d.sheds[PREM_MAIN] && d.sheds[PREM_MAIN].locked) delete d.sheds[PREM_MAIN].locked;
  const i = STORY_IDS.indexOf(B.id), next = STORY_IDS[i + 1] || null;
  if (effects.some(e => e.k === 'open') || !next) { s.beat = 'open'; s.open = true; }
  else { s.beat = next; for (const e of storyEnterEffects(next)) effects.push(e); }
  d.career.story = s;
  return { ok: true, doc: d, advanced: [B.id], effects, why: null };
}

// ===========================================================================
// THE PAGE'S HALF, PURE (G2742-G2749 STORY-PAGE): what app.js does to the document for the story - the new career at the
// cabin, the client's Cub as it arrives, each effect applied, the occasions listed, the beat card's words, the job list
// held. The page owns the fetches, the slots and the DOM; everything that decides lives here, so GATE STORY's page half
// asks it in node. Every function works on a clone and returns { ok, doc, why, ... }; a refusal hands the document back.
// ===========================================================================
// THE STORY'S PLANES' FILES (fetched by the page, relative to the game's folder). The starter is the user's Rufus (18 Oct):
// RUFUS-CERT (G3270) moves its certified file into builds/ - the page asks builds/ first, then the archived candidate.
const STORY_FILES = {
  starter: ['builds/rufus_2026-10-18_certified.json', 'builds/rufus_2026-10-18.json', 'builds/rufus_2026-10-18_corrected.json', 'builds/rufus.json',
            'futureDesigns/game/aircraft-candidates/rufus-starter_2026-10-18.json'],
  client: ['builds/cub_2026-09-20.json'],          // the validated Cub, unfinished by storyClientSpec
};
const STORY_SLOTS = { starter: 'Rufus', client: 'Client Cub' };
// THE CABIN'S SHED: the smallest shell (the field's), sized as HOME's own field option so the Rufus's 10.9 m passes its
// door; a plot the cabin's aerodrome offers (BASE_OFFERS) gives its own id, kits and dims instead
const STORY_CABIN_SHED = { shell: 'field', dims: { HW: 9, HD: 10, EAVE: 4.0 }, kits: ['park', 'bench'] };
const STORY_NO_CABIN = 'No strip on the island is the cabin yet (name one "Cabin…" in the scenery editor): the story starts at HOME.';
// T5 (Q1: the generated list is held, the story's own goals shown instead): the story's three quick jobs are the authored
// openers of three contractors - a pickup, a survey, a small load (72_contract_data.js; the narrative pack may re-author)
const STORY_JOBS = ['clients.01', 'survey.01', 'resort.01'];
// T7: THE THREE OCCASIONS - one-time listings in the used market, AUTHORED BY HAND (the user's rule: a missing plane is
// authored, never generated). PLACEHOLDERS until the user authors the two planes the story names (HANDOVER G2742): the
// fabric 4-seater stands as the validated metal Cessna (meridian), the Jodel-class one as the validated Jodel (pinson);
// the Cub is the story's own. `price` is the occasion's factor on the maker's catalogue (well under a used listing's).
const STORY_OCCASIONS = [
  { id: 'occ:fabric4', model: 'meridian', opts: { avionics: 'basic', finish: 'white', reg: 'N4OCC' }, hours: 2400, repair: 'skin',
    seller: 'used.seller.3', aero: 'HOME', price: 0.30, placeholder: 'the fabric 4-seater (stands as the metal Cessna until authored)' },
  { id: 'occ:jodel', model: 'pinson', opts: { engine: 'a65', finish: 'red', reg: 'N2OCC' }, hours: 1150, repair: 'none',
    seller: 'used.seller.0', aero: 'HOME', price: 0.35, placeholder: 'the Jodel-class one (stands as the validated Jodel until authored)' },
  { id: 'occ:cub', model: 'scout', opts: { engine: 'a65', avionics: 'minimal', finish: 'green', reg: 'N3OCC' }, hours: 1800, repair: 'gear',
    seller: 'used.seller.2', aero: 'HOME', price: 0.35, placeholder: null },
];
const stClone = o => JSON.parse(JSON.stringify(o));
const stNo = (doc, why) => ({ ok: false, doc, why });
// an aerodrome's name in words, its runway's numbers off ('Jolene AFB 13/31' -> 'Jolene AFB', as the map's cwBase)
const storyAeroName = (id, aeros) => { const a = (aeros || []).find(x => x && x.id === id);
  const n = (a && a.name) || (typeof CONTRACT_FIELDS !== 'undefined' && CONTRACT_FIELDS[id] && CONTRACT_FIELDS[id].name) || id;
  return String(n).replace(/\s+\d{2}[LRC]?\/\d{2}[LRC]?$/, ''); };

// the cabin's shed: the plot its aerodrome offers a field shell on (its id, dims and kits), else the aerodrome's own id
function storyCabinShed(aero, clock) {
  const O = (typeof BASE_OFFERS !== 'undefined' && BASE_OFFERS[aero]) || null;
  const plot = O ? Object.keys(O.plots).find(k => O.plots[k].shells.includes('field')) : null;
  const P = plot ? O.plots[plot] : null;
  const S = (typeof SHELLS !== 'undefined' && SHELLS.field) ? SHELLS.field.dims : {};
  return { id: plot || aero, shed: { shell: 'field', kits: ((P && P.kits) || STORY_CABIN_SHED.kits).slice(), base: aero, tenure: 'own',
    dims: Object.assign({}, S, STORY_CABIN_SHED.dims, (P && P.dims && P.dims.field) || {}), since: Math.round(clock || 0), story: 'cabin' } };
}
// A NEW CAREER WITH THE STORY (the welcome's New career, the player's career 'main' only): storyStart with the starter's
// slot, then the cabin - the strip that plays the cabin (storySite, never a guess) gets the smallest shed, the garage opens
// in it, and the WWII field's hangar is held for the move (`locked`: T1's 'hangar' effect hands it over). No cabin on the
// island yet: the story starts at HOME, the reason recorded for the beat card. The starter's airframe row is written here;
// its slot (the envelope) is the page's, and the page's lift stands it in the cabin's shed once the slot exists.
// o: { aeros: world.aerodromes, starter? } -> { ok, doc, effects, cabin, why }
function storyNewCareer(doc, o) {
  o = o || {};
  const slot = o.starter || STORY_SLOTS.starter;
  const r = storyStart(doc, slot);
  if (!r.ok) return r;
  const d = r.doc, s = storyNormalise(d.career.story), cabin = storySite('cabin', o.aeros);
  if (cabin && cabin !== 'HOME') {
    const C = storyCabinShed(cabin, d.clock);
    d.sheds[C.id] = C.shed;
    d.here = C.id;
    if (d.sheds.HOME) d.sheds.HOME.locked = 'story';
    s.cabin = { aero: cabin, hangar: C.id };
  } else { s.cabin = null; s.note = STORY_NO_CABIN; }
  d.career.story = s;
  d.career.airframes[slot] = { from: 'story', story: 'starter', factory: false, modified: false, paid: 0, at: Math.round(d.clock || 0) };
  return { ok: true, doc: d, effects: r.effects, cabin: s.cabin, why: null };
}
// THE CLIENT'S CUB AS IT ARRIVES (T2): the validated Cub unfinished - its flaps off, the minimal panel (no battery, so no
// lights), bare metal - on the same engine. Every item of T2's checklist is open on it (GATE STORY holds that).
function storyClientSpec(cub) {
  const s = stClone(cub || {});
  s.controls = Object.assign({}, s.controls || {}, { flap: { type: 'none', span: 0, chord: 0 } });
  s.systems = { fit: 'minimal' };
  s.paint = Object.assign({}, s.paint || {}, { job: 'bare' });
  s.meta = Object.assign({}, s.meta || {}, { name: STORY_SLOTS.client });
  return s;
}
// EACH EFFECT, APPLIED (storyStep hands them; the page fetches what a plane needs first and passes it in o):
//   hangar      the WWII field's hangar is ours: the lock lifted, a ledger line at 0
//   clientPlane the client's Cub in the HOME hangar (o.slot: its slot, already written): stationed there, its airframe row
//               the client's; the page then binds it ({ k: 'bind', role: 'client', slot, spec })
//   giftPlane   the Cub is ours: the client's mark lifted, a ledger line at 0 (no money)
//   routeOffer  ROUTES (G3260) absent: the offer recorded as a stub on the story (o.route: ROUTES' own record when present)
//   occasions   the three authored listings on the used market (one-time: a sale removes it for good)
//   open        the rails end (nothing to the world)
// -> { ok, doc, why, line } (line: the words for the beat card / the arrival card, or null)
function storyApply(doc, e, o) {
  o = o || {};
  if (!storyOf(doc)) return stNo(doc, 'no story in this document');
  if (!e || typeof e.k !== 'string') return stNo(doc, 'no effect');
  const d = stClone(doc), s = storyNormalise(d.career.story), clock = Math.round(d.clock || 0);
  let line = null;
  if (e.k === 'hangar') {
    const id = PREM_MAIN;
    if (!d.sheds[id]) return stNo(doc, 'no hangar at HOME');
    delete d.sheds[id].locked;
    playerLedger(d, 'story', 0, id);
    line = 'The WWII field’s hangar is yours.';
  } else if (e.k === 'clientPlane') {
    const slot = o.slot || STORY_SLOTS.client;
    if (d.fleet[slot] && s.planes.client === slot) return { ok: true, doc, why: 'the client’s plane is here already', line: null };
    d.fleet[slot] = { hangar: null, aero: PREM_MAIN };
    if (o.foot) d.fleet[slot].foot = parkFoot(o.foot);
    const r = playerArrive(d, slot, PREM_MAIN, { prefer: PREM_MAIN, foots: o.foot ? { [slot]: o.foot } : null });
    const D = r.ok ? r.doc : d;
    D.career.airframes[slot] = { from: 'story', story: 'client', owner: 'client', factory: false, modified: false, paid: 0, at: clock };
    D.career.story = s;
    return { ok: true, doc: D, why: '', line: 'The client’s Cub is in the hangar at HOME.', where: r.ok ? (r.hangar || r.kind) : null };
  } else if (e.k === 'giftPlane') {
    const slot = s.planes.gift || s.planes.client;
    if (!slot || !d.career.airframes[slot]) return stNo(doc, 'no client plane to give');
    delete d.career.airframes[slot].owner;
    d.career.airframes[slot].gift = true;
    playerLedger(d, 'gift', 0, slot);
    line = 'The Cub is yours.';
  } else if (e.k === 'routeOffer') {
    const offer = Object.assign({ k: 'route', plane: s.planes.gift || null, a: storySite(e.a, o.aeros) || e.a, b: storySite(e.b, o.aeros) || e.b,
                                  at: clock, stub: !o.route }, o.route ? { route: stClone(o.route) } : {});
    s.offers = (s.offers || []).filter(x => x.k !== 'route').concat([offer]);
    line = o.route ? 'A route is offered, with a hired pilot.' : 'A route is offered (the routes come later: the offer is kept).';
  } else if (e.k === 'occasions') {
    s.occasions = STORY_OCCASIONS.slice(0, e.n || STORY_OCCASIONS.length).map(L => L.id);
    line = 'Three aeroplanes on offer, once only: see the Market.';
  } else if (e.k === 'open') {
    line = 'The island is open: every contractor’s work is on the map.';
  } else return stNo(doc, 'an unknown effect ' + e.k);
  d.career.story = s;
  return { ok: true, doc: d, why: '', line };
}
// THE OCCASIONS ON OFFER (procureMarketOf lists them before the generated ones): the authored listings the story listed,
// minus the sold, in the used market's shape (76_procure.js procureUsedListing's), priced at the occasion's factor
function storyOccasionListings(doc) {
  const s = storyOf(doc);
  if (!s || !s.occasions || !s.occasions.length || typeof procureDefaults !== 'function') return [];
  const sold = typeof procureSold === 'function' ? procureSold(doc) : [];
  const out = [];
  for (const A of STORY_OCCASIONS) {
    if (!s.occasions.includes(A.id) || sold.includes(A.id) || !PROCURE_MODELS[A.model]) continue;
    const o = Object.assign(procureDefaults(A.model), A.opts);
    const design = procureDesignOf(A.model, o);
    if (!procureValidated(design)) continue;
    const cat = procurePrice(A.model, o).total;
    out.push({ id: A.id, model: A.model, design, opts: o, hours: A.hours, repair: A.repair, older: false, kg: 0, seller: A.seller,
               condition: A.price, aero: A.aero, catalogue: cat, price: Math.round(cat * A.price / 100) * 100, occasion: true,
               placeholder: A.placeholder || null });
  }
  return out;
}
// Q1: THE JOB LIST HELD - the story's own jobs (T5's) are the only ones offered while the rails run
const storyJobIds = doc => { const s = storyOf(doc); return s && !s.open && s.beat === 'T5' ? STORY_JOBS.filter(id => !doc.career.contracts.done.some(x => x.id === id)) : []; };
const storyJobHeld = (doc, id) => !storyJobsOpen(doc) && !storyJobIds(doc).includes(id);
// THE BEAT CARD'S WORDS: the beat's title and brief, its goal's state, the button. o: { aeros, spec (the client plane's
// spec as it stands now, T2), cost (its edit bill), jobs: { id: title } } -> null (no story, or open) | { beat, title,
// brief, rows: [{ words, ok }], ack (an OK sends { k: 'ack' }), note }
function storyCard(doc, o) {
  o = o || {};
  const s = storyOf(doc);
  if (!s || s.open) return null;
  const B = storyBeatOf(s.beat), G = B.goal, rows = [];
  const plane = k => s.planes[k] || (k === 'gift' ? s.planes.client : null);
  if (G.k === 'stop') {
    const at = storySite(G.at, o.aeros), P = plane(G.plane);
    rows.push({ words: at ? 'Land at ' + storyAeroName(at, o.aeros) + (P ? ' with ' + P : '') + (G.gear ? ', on ' + G.gear : '') + ', stopped and whole'
                          : 'No aerodrome plays ' + STORY_ROLES[G.at].words + ' on this island yet', ok: false });
  } else if (G.k === 'certified') {
    for (const r of storyChecklist(o.spec || s.base.client, s.base.client, G.checklist)) rows.push({ words: r.words, ok: r.ok });
    rows.push({ words: 'on budget: ' + (typeof o.cost === 'number' ? Math.round(o.cost) + ' of ' : 'at most ') + G.costCap, ok: typeof o.cost === 'number' && o.cost <= G.costCap });
    rows.push({ words: 'certified in the garage (the bench)', ok: false });
  } else if (G.k === 'jobs') {
    rows.push({ words: s.jobs + ' of ' + G.n + ' jobs', ok: s.jobs >= G.n });
    const T = o.jobs || {};
    for (const id of STORY_JOBS) rows.push({ words: T[id] || id, ok: doc.career.contracts.done.some(x => x.id === id) });
  }
  const notes = [];
  if (s.note) notes.push(s.note);
  if (B.id === 'T0' && doc.sheds && doc.sheds.HOME && doc.sheds.HOME.locked) notes.push('The WWII field’s hangar is not yours yet.');
  return { beat: B.id, title: B.title, brief: B.brief, rows, ack: G.k === 'ack', note: notes.join(' ') || null,
           step: STORY_IDS.indexOf(B.id) + 1, of: STORY_IDS.length };
}
