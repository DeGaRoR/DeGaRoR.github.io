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
// G3350 (STORY-TIM, the user 19 Oct): TIM - "your friend and business partner" - speaks each beat in the band at the
// bottom of the screen (app.js #stTim), a line at a time. Draft English, keyed by beat: the narrative pack rewrites
// them. The corner card stays the OBJECTIVE; Tim is the voice.
const STORY_TIM = {
  name: 'Tim', role: 'your friend and business partner',
  T0: ['Morning! The ultralight has sat in this shed all winter. Let\u2019s dust it off.',
       'Give it a fresh coat and a registration of your own. The structure stays as it is for now: paint, liveries and colours only.',
       'Click the plane once, twice or three times to climb to the top of its tree. Up there you change the global colour, add liveries, or recolour any single piece.',
       'It\u2019s pre-certified, so no bench needed here (this shed has none anyway). When it looks right, tap OK on the card.'],
  T1: ['Good news: we got the old WWII airport. It\u2019s our base of operations now. Come and join me there.',
       'You can take the controls yourself whenever you like, but you never have to. The autopilot flies every normal mission just as well.'],
  T2: ['Here is what the client wants, and it has to stay on budget. Certify it at the bench here, then we fly it to them.'],
  T3: ['Certified? Then fly it over to its owner.'],
  T4: ['He can\u2019t pay us... so he\u2019s giving us the Cub. Not a bad trade.'],
  T5: ['A few quick jobs with the Cub. Nothing fancy, just get them done.'],
  T6: ['We promised this one: floats on the Cub, and land it at the seaplane base.'],
  T7: ['The Cub is flying a route now. But look: three planes for sale, once only.'],
};
// G3370 (TUTO-FLIGHT, GAME-PLAN §R2, the user 19 Oct: "a few cards covering the basics of the game, and the basics of
// building a plane"): THE LADDER on T1's flight - one card per stretch of the flight, in Tim's band (app.js #stTim) as text
// (and an image when `img` names one; none yet), keyed to the pilot's own phases (43_pilot PILOT_PHASES). Draft English,
// keyed for the narrative pack. `at`: the phases that call the card; `build`: no phase of its own - it follows the cruise
// card once the cruise has run STORY_LADDER_RULE.cruiseS of sim time or half the way to HOME is flown
const STORY_LADDER = [
  { id: 'roll', key: 'story.ladder.roll', title: 'Take-off', img: null, at: ['DEPART', 'TAXI', 'LINEUP', 'STOP', 'HOLD', 'ROLL', 'ABORT', 'LIFTOFF', 'PUTDOWN'],
    text: 'The autopilot flies the whole trip: the taxi, the line-up, the take-off roll and the climb. The phase bar names what it is doing. Sit back and watch.' },
  { id: 'climb', key: 'story.ladder.climb', title: 'The map and the route', img: null, at: ['CLIMB', 'CROSSWIND'],
    text: 'The map (on the left rail) shows where you are and the line the autopilot follows to the WWII field. Every job is a flight like this one: from A to B, stopped and whole at the end.' },
  { id: 'cruise', key: 'story.ladder.cruise', title: 'The work', img: null, at: ['ENROUTE', 'ROUTE', 'DOWNWIND', 'BOX', 'LOITER'],
    text: 'That is the game: clients post jobs on the map, you fly them, they pay. The money buys parts, aeroplanes and hangars, and hired pilots fly what you cannot. The jobs open once we have moved in.' },
  { id: 'build', key: 'story.ladder.build', title: 'Building a plane', img: null, at: [],
    text: 'In the hangar you change your aeroplanes. Click a part, then again to climb the tree to the whole plane. More wing lands slower and shorter, more power climbs faster, every kilo costs both. A changed plane passes the bench before it flies for money.' },
  { id: 'approach', key: 'story.ladder.approach', title: 'The approach', img: null, at: ['INBOUND', 'BASE', 'FINAL', 'GOAROUND', 'GLIDE'],
    text: 'The approach: the autopilot lines up with the runway, slows down and holds the glide. If it does not like it, it goes round and tries again. A slower plane needs a shorter strip.' },
  { id: 'landing', key: 'story.ladder.landing', title: 'The WWII field', img: null, at: ['FLARE', 'ROLLOUT', 'STOPPED'],
    text: 'The flare, the roll-out, and we are home. Stop it on the field and the hangar is ours: our first client is already on the way.' },
];
// hold: s of sim time each card stands before the next (one card at a time, never skipped); cruiseS / half: the build
// card's call (the cruise's time, or the share of the way to HOME still to fly)
const STORY_LADDER_RULE = { hold: 10, cruiseS: 25, half: 0.5 };
const storyLadderNew = () => ({ i: -1, at: 0, cruise: null, d0: null, off: false });
// one tick of the ladder (pure): L its state, o { phase (ap.phase), t (s of sim time), dHome (m to HOME, or null), manual }
// -> { L, card } (card: STORY_LADDER[L.i], or null - none yet, or off). MANUAL ENDS IT: once the player takes the
// controls, off for the rest of the flight (a hand-back does not bring it back)
function storyLadderStep(L, o) {
  L = Object.assign(storyLadderNew(), L || {}); o = o || {};
  if (L.off || o.manual) { L.off = true; return { L, card: null }; }
  const t = +o.t || 0, ids = STORY_LADDER.map(c => c.id), R = STORY_LADDER_RULE;
  let want = STORY_LADDER.findIndex(c => c.at.includes(o.phase));
  if (want === ids.indexOf('cruise')) {
    if (L.cruise == null) L.cruise = t;
    if (L.d0 == null && typeof o.dHome === 'number' && isFinite(o.dHome)) L.d0 = o.dHome;
    if (t - L.cruise >= R.cruiseS || (L.d0 > 0 && typeof o.dHome === 'number' && o.dHome <= R.half * L.d0)) want = ids.indexOf('build');
  }
  if (want > L.i && (L.i < 0 || t - L.at >= R.hold)) { L.i++; L.at = t; }
  return { L, card: L.i >= 0 ? STORY_LADDER[L.i] : null };
}
// ---- G3580 (STORY-TUTOR): TIM IS THE TUTORIAL (the user, playtest 24 Oct: "Each step checks that the action was done
// before moving on, tutorial-style. Tim replaces all cards. For now you've made Tim optional."). A beat's lines become
// STEPS: { id, say, wait?, allow?, pass?, free?, ack? } -
//   say    Tim's words (draft English, for the narrative pack)
//   wait   the page's predicate (app.js STORY_TUTOR_FACTS): the step stands until it is true - no Next, the band not
//          closable. No wait: just words, a Next (the last step's OK; `ack` sends the beat's { k: 'ack' } on it)
//   allow  the one control (or panel) the step needs (app.js STORY_TUTOR_ALLOW): while the step stands ONLY it works -
//          every other click, tap, drag and key is held at the window - and it is lit
//   pass   a second button that passes the step as it stands ('Keep N47RF'); free: the step waits but locks nothing (the
//          taxi after the landing is the player's hands)
// T1's flight is the LADDER's (STORY_LADDER: its own check is the pilot's phase; off when manual, G3370). A beat with no
// steps speaks its STORY_TIM lines as before.
const STORY_REG = 'N47RF';          // G3586: Rufus's own registration (fictional; the generator's meta.reg is F-PGAR)
const STORY_TUTOR = {
  T0: [
    { id: 'hello', say: 'Morning! The ultralight has sat in this shed all winter. Let’s dust it off.' },
    { id: 'paint', wait: 'painted', allow: 'finish',
      say: 'Click the plane once, twice or three times to climb to the top of its tree. Up there you change the global colour, add a livery, or recolour any single piece. Give it a fresh coat: change any colour.' },
    { id: 'reg', wait: 'registered', allow: 'reg', pass: 'Keep ' + STORY_REG,
      say: 'Now a registration of its own: type it in the registration box and press Enter. It came as ' + STORY_REG + '.' },
    { id: 'cert', ack: true,
      say: 'It’s pre-certified, so it flies as it is. No test bench in here, mind - certification happens at the WWII field’s hangar.' },
  ],
  T1: [
    { id: 'news', say: 'Good news: we got the old WWII airport. It’s our base of operations now. Come and join me there.' },
    { id: 'ap', say: 'You can take the controls yourself whenever you like, but you never have to. The autopilot flies every normal mission just as well.' },
    { id: 'roll', wait: 'flying', allow: 'rollout',
      say: 'Roll it out when you’re ready. Or skip the flight: you start on the final at the WWII field.' },
  ],
  // the WWII arrival (the user 24 Oct: "land at the WWII field with Rufus, then the taxi (skippable); we naturally see Rufus
  // in the new hangar. Then the new Tim ... tells us about the new contract, that the Cub is parked outside, and to swap it
  // with the ultralight. Only that control is allowed ... The ultralight should be put on a storage, visible place")
  T2: [
    { id: 'down', wait: 'inHangar', allow: 'shed', free: true,
      say: 'We’re down - welcome to the WWII field! Taxi over to the hangar if you like, or go straight in with The shed.' },
    { id: 'hangar', say: 'There it is, in our own hangar. Not bad for an old army field.' },
    { id: 'contract', say: 'And our first contract is here already: a client brought us an unfinished Cub. It’s parked outside.' },
    { id: 'store', wait: 'storeOpen', allow: 'store', say: 'Let’s swap it with the ultralight. Open Storage.' },
    { id: 'swap', wait: 'clientOnStand', allow: 'storeClient',
      say: 'Drag the Cub onto the floor, or tap its "work on". The ultralight steps off the stand to make room.' },
    { id: 'park', wait: 'starterInside', allow: 'storeStarter',
      say: 'Now put the ultralight where we can see it: drag it into an INSIDE slot. Storage keeps every plane you own - inside, on the apron, or long-term.' },
    { id: 'list', say: 'Here is what the client wants, and it has to stay on budget. Certify it at the bench here, then we fly it to them.' },
  ],
};
const storyTutorSteps = id => STORY_TUTOR[id] || null;
// one tick of the tutor (pure): T { beat, i }, the beat now, fact(name) -> bool (the page's predicates) -> { T, step }.
// A new beat starts at its first step; a step whose wait is already true is passed at once (a reload, a skip, an action
// done early); words wait for next(). step null: the beat's steps are done (or it has none).
function storyTutorTick(T, beat, fact) {
  T = (T && T.beat === beat) ? { beat, i: T.i | 0 } : { beat, i: 0 };
  const L = storyTutorSteps(beat) || [];
  while (T.i < L.length && L[T.i].wait && typeof fact === 'function' && fact(L[T.i].wait)) T.i++;
  return { T, step: L[T.i] || null };
}
// the step's Next / OK / pass: words move on; a waiting step moves only by its `pass`
function storyTutorNext(T, how) {
  const L = storyTutorSteps(T && T.beat) || [], s = L[T ? T.i : 0];
  if (!s || (s.wait && !(how === 'pass' && s.pass))) return T;
  return { beat: T.beat, i: T.i + 1 };
}
// G3584 "SKIP THE FLIGHT" ON THE FINAL (the user 24 Oct: "put the plane on its final, not landed"): the pose a skip starts
// from - on the runway's extended centreline `d` m before the aim point (60 m in from the threshold), on a `gs` slope
// over the field (never under `floor` m over the ground beneath), flying along the landing heading at V m/s and sinking
// on the slope. a: the aerodrome record (x, z, hdg: the take-off heading, len, elev; spawn: the take-off end), groundH(x,
// z) -> m or null -> { x, y, z, hdg, vx, vy, vz }: hdg in placeAtAerodrome's sense (the nose along (cos hdg, sin hdg))
function storyFinalPose(a, o) {
  o = o || {};
  const d = o.d || 1500, gs = o.gs || 0.06, V = o.V || 22, floor = o.floor || 60;
  const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
  const sp = a.spawn || [a.x || 0, a.z || 0], elev = +a.elev || 0;
  const ax = sp[0] + 60 * ux, az = sp[1] + 60 * uz;            // the aim point, 60 m in from the take-off end
  const x = ax - d * ux, z = az - d * uz;
  const g = typeof o.groundH === 'function' ? o.groundH(x, z) : null;
  const y = Math.max(elev + d * gs, (Number.isFinite(g) ? g : elev) + floor);
  const cg = Math.cos(Math.atan(gs));
  return { x, y, z, hdg: a.hdg, vx: V * cg * ux, vy: -V * Math.sin(Math.atan(gs)), vz: V * cg * uz };
}
// (G3260 ROUTES: at T7, with the story's route signed, Tim names it and its down payment first)
const storyTimLines = (id, doc) => { const L = (STORY_TIM[id] || []).slice(), r = id === 'T7' && doc ? storyRoute(doc) : null;
  if (r) L.unshift((typeof pilotsName === 'function' ? pilotsName(r.pilot) : r.pilot) + ' flies the Cub on ' + routeWords(r) + ' now. The client paid ' +
    routeMoney(r.down) + ' down, and every round trip pays ' + routeMoney(r.pay) + ' when you land or wait.');
  return L; };
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
    dims: Object.assign({}, S, STORY_CABIN_SHED.dims, (P && P.dims && P.dims.field) || {}), since: Math.round(clock || 0), story: 'cabin',
    ...(P && Array.isArray(P.omit) ? { omit: P.omit.slice() } : {}),   // G3353: the props the plot leaves out
    ...(P && P.workLamp && typeof P.workLamp === 'object' ? { workLamp: Object.assign({}, P.workLamp) } : {}),   // G3354
    ...(P && Array.isArray(P.lampXZ) ? { lampXZ: P.lampXZ.map(p => p.slice()) } : {}) } };   // G3354: the fittings off the wing line
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
//   routeOffer  G3260 (ROUTES): the route SIGNED - routeOffer + routeSign (78b_routes.js) with the gift Cub on the seaplane
//               base <-> HOME and the career's companion (else the first free hired pilot): the down payment paid, the Cub
//               and the pilot locked on the route; recorded on the story (`offers`: the route's id, the down payment).
//               o.design: the Cub's own numbers (the page's shakedown row), else the validated Cub's
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
    let D = r.ok ? r.doc : d;
    // G3585 (the WWII arrival, the user 24 Oct: "the Cub is parked outside"): tied down on HOME's apron, where the swap
    // finds it (Tim's storage steps); no apron there - it stays where the arrival put it
    const out = r.ok ? playerMove(D, slot, { kind: 'outside' }, { foots: o.foot ? { [slot]: o.foot } : null }) : null;
    if (out && out.ok) D = out.doc;
    D.career.airframes[slot] = { from: 'story', story: 'client', owner: 'client', factory: false, modified: false, paid: 0, at: clock };
    D.career.story = s;
    const outside = !!(out && out.ok);
    return { ok: true, doc: D, why: '', line: outside ? 'The client’s Cub is parked outside the hangar at HOME.' : 'The client’s Cub is in the hangar at HOME.',
             where: outside ? 'outside' : r.ok ? (r.hangar || r.kind) : null };
  } else if (e.k === 'giftPlane') {
    const slot = s.planes.gift || s.planes.client;
    if (!slot || !d.career.airframes[slot]) return stNo(doc, 'no client plane to give');
    delete d.career.airframes[slot].owner;
    d.career.airframes[slot].gift = true;
    playerLedger(d, 'gift', 0, slot);
    line = 'The Cub is yours.';
  } else if (e.k === 'routeOffer') {
    // G3260 (ROUTES): "the cub disappears and you're back with only the ultralight" (the user) - the route signed now
    const plane = s.planes.gift || s.planes.client || null, a = storySite(e.a, o.aeros) || e.a, b = storySite(e.b, o.aeros) || e.b;
    const pilot = storyRoutePilot(d);
    const O = routeOffer(d, a, b, plane, { design: o.design });
    const R = !O.ok ? O : !pilot ? { ok: false, why: 'no free hired pilot to fly it' } : routeSign(d, O.offer, plane, pilot, { now: o.now });
    const offer = { k: 'route', plane, a, b, at: clock, pilot: pilot || null, signed: !!R.ok };
    if (!R.ok) {
      // (never a guess: the offer is kept with its reason; the beat has moved on)
      offer.why = R.why;
      s.offers = (s.offers || []).filter(x => x.k !== 'route').concat([offer]);
      d.career.story = s;
      return { ok: true, doc: d, why: R.why, line: 'The route could not be signed: ' + R.why + '.' };
    }
    const D = R.doc;
    Object.assign(offer, { route: R.route.id, down: R.route.down, pay: R.route.pay, tripS: R.route.tripS });
    s.offers = (s.offers || []).filter(x => x.k !== 'route').concat([offer]);
    D.career.story = s;
    return { ok: true, doc: D, why: '', route: R.route, line: storyRouteLine(R.route, o.aeros) };
  } else if (e.k === 'occasions') {
    s.occasions = STORY_OCCASIONS.slice(0, e.n || STORY_OCCASIONS.length).map(L => L.id);
    line = 'Three aeroplanes on offer, once only: see the Market.';
  } else if (e.k === 'open') {
    line = 'The island is open: every contractor’s work is on the map.';
  } else return stNo(doc, 'an unknown effect ' + e.k);
  d.career.story = s;
  return { ok: true, doc: d, why: '', line };
}
// G3260 (ROUTES): T6's pilot - the career's companion while free on the roster, else the first free hired pilot (or null)
function storyRoutePilot(doc) {
  const free = (typeof pilotsHired === 'function' ? pilotsHired(doc) : []).filter(id => !routeOfPilot(doc, id));
  return free.includes(PILOTS_COMPANION) ? PILOTS_COMPANION : (free[0] || null);
}
// T6's words for the arrival card, the beat card and Tim: the route, its pilot, the down payment in the wallet
function storyRouteLine(r, aeros) {
  return 'Route signed: ' + r.plane + ' flies ' + routeWords(r, aeros) + ' with ' + (typeof pilotsName === 'function' ? pilotsName(r.pilot) : r.pilot) +
    '. The down payment, ' + routeMoney(r.down) + ', is in the wallet; then ' + routeMoney(r.pay) + ' a round trip, paid at your landings and waits.';
}
// the route the story signed (T6), as its record stands now, or null
function storyRoute(doc) {
  const s = storyOf(doc), o = s && (s.offers || []).find(x => x.k === 'route' && x.signed && x.route);
  return o ? (routesList(doc).find(r => r.id === o.route) || null) : null;
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
