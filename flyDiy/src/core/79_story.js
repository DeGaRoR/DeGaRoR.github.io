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
  cabin:  { name: /\bcabin\b/i, ids: [], words: 'the cabin strip' },
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
    goal: { k: 'certified', plane: 'client', checklist: ['engine', 'flaps', 'tyres', 'lights', 'panel', 'paint'], costCap: 9000 } },
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
  return { v: STORY_V, beat, done, planes, base, jobs, open: beat === 'open' || !!s.open };
}
// the story of a career document, or null (the sandbox, a career without one)
const storyOf = doc => (doc && doc.mode === 'career' && doc.career && doc.career.story) ? storyNormalise(doc.career.story) : null;
// a new career WITH the story (STORY-PAGE calls this once, at New career): the starter plane's slot is bound by the page
function storyStart(doc, starterSlot) {
  if (!doc || doc.mode !== 'career' || !doc.career) return { ok: false, doc, why: 'not a career' };
  if (doc.career.story) return { ok: false, doc, why: 'the story has already started' };
  const d = JSON.parse(JSON.stringify(doc)), s = storyNew();
  if (typeof starterSlot === 'string') s.planes.starter = starterSlot;
  d.career.story = s;
  return { ok: true, doc: d, effects: storyEnterEffects('T0') };
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
  const i = STORY_IDS.indexOf(B.id), next = STORY_IDS[i + 1] || null;
  if (effects.some(e => e.k === 'open') || !next) { s.beat = 'open'; s.open = true; }
  else { s.beat = next; for (const e of storyEnterEffects(next)) effects.push(e); }
  d.career.story = s;
  return { ok: true, doc: d, advanced: [B.id], effects, why: null };
}
