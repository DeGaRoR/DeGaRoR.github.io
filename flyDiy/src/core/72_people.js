// ===========================================================================
// THE PEOPLE (G3614 PEOPLE, the user 25 Oct) — one list of everyone in the game, the only one: each person a name, a
// portrait, a 3D body (a tools/chars_table.py key) and ONE role at a time. Every other table (76_pilots.js's roster, the
// contracts' clients, the crowd's passengers, Tim's band) reads its people from here.
//   "Let's build a generic list of people internally, that we can use either as clients or pilots."
//   "The new official persona replace your made-up ones" - Kit / Rafe / Sky and the companion are gone ("We were always
//   flying solo, or with passengers, but no co-pilot").
// THE ROLES:
//   reserved   the story's own: Stig (the test pilot), Sophie ("your girlfriend") and Tim ("always just a voice on the
//              phone, we never see him": a portrait, never a body). Never a client, a pilot for hire or a passenger.
//   client     the face of one contract provider (72_contract_data.js's five), shown beside its contracts on the map
//   pilot      hirable (76_pilots.js); `fly` is the pilot's person - THE SAME SHAPE AS 76_'s roster rows: { profile:
//              { base, knobs }, style, traits, grow, pack? } - and `from` the narrative pack's pilot it wears (GATE
//              PILOTS holds the numbers to the pack's Block 3: each of the four tuned persons stays on the body it
//              always had, only the name and the face became official)
//   passenger  the random pool (the crowd's queue, G2970 / G3619) - a client still rides its own provider's jobs
// THE BODIES: Brian = Ch01 (the user 25 Oct: "He's ch01. Bald, with a white polo"), Bryce = Ch42, Sophie = ch02 (the FBX
// filed as brian_Ch02 is hers), Megan = Ch22; ch08 / ch17 / ch21 / ch37 (Adam, Pete, Kate, Jody) are baked by G3617 -
// until then the crowd skips a person whose body it does not hold (window.CROWD.castKeys).
// THE PORTRAITS (G3615): media/people/<id>_<px>.webp, px in PEOPLE_FACE_PX, cut from the user's originals
// (assets/chars/people, never written) by tools/portrait_prep.py: premultiplied resizes and a clean edge (no red
// specks round the hair - the user, 25 Oct: "unacceptable"). Fetched only when shown: never at boot, never precached.
// Pure data + pure helpers: no DOM, no storage, no clock, no random (the pool takes a seed).
// ===========================================================================
const PEOPLE_V = 1;
const PEOPLE_ROLES = ['reserved', 'client', 'pilot', 'passenger'];
const PEOPLE_FACE_PX = [128, 256, 512];
const PEOPLE_FACE_DIR = 'media/people/';
const GAME_PEOPLE = {
  // ---- reserved: the story's own ----
  stig:      { id: 'stig',      name: 'Stig',      file: 'Stig',      char: 'ch20', role: 'reserved', why: 'the test pilot' },
  sophie:    { id: 'sophie',    name: 'Sophie',    file: 'Sofie',     char: 'ch02', role: 'reserved', why: 'your girlfriend' },
  tim:       { id: 'tim',       name: 'Tim',       file: 'Tim',       char: null,   role: 'reserved', why: 'your friend and business partner: a voice on the phone', voice: true },
  // ---- clients: one face per provider (72_contract_data.js CONTRACT_PROVIDERS) ----
  leonard:   { id: 'leonard',   name: 'Leonard',   file: 'Leonard',   char: 'ch31', role: 'client', org: 'field' },
  pete:      { id: 'pete',      name: 'Pete',      file: 'Pete',      char: 'ch17', role: 'client', org: 'minedock' },
  martha:    { id: 'martha',    name: 'Martha',    file: 'Martha',    char: 'ch27', role: 'client', org: 'resort' },
  kate:      { id: 'kate',      name: 'Kate',      file: 'Kate',      char: 'ch21', role: 'client', org: 'survey' },
  adam:      { id: 'adam',      name: 'Adam',      file: 'adam',      char: 'ch08', role: 'client', org: 'clients' },
  // ---- pilots for hire: the pack's four tuned persons, on the bodies they always wore ----
  brian:     { id: 'brian',     name: 'Brian',     file: 'Brian',     char: 'ch01', role: 'pilot', from: 'kit',
               fly: { profile: { base: 'club', knobs: { reaction: 0.25, smooth: 0.8, bankK: 0.85, comfortG: 1.25 } },
                      style: 'cautious', traits: ['mechanic', 'cautious', 'night-shy'], grow: { rate: 'steady', ceiling: 'bush' } } },
  bryce:     { id: 'bryce',     name: 'Bryce',     file: 'Bryce',     char: 'ch42', role: 'pilot', from: 'rafe',
               fly: { profile: { base: 'hamfist', knobs: { hamFist: 0.04, comfortG: 1.9, bankK: 1.25 } },
                      style: 'normal', traits: ['fearless', 'hard-on-airframes'], grow: null,
                      pack: { style: 'not given: normal', grow: 'not given: none (the rough hands stay)' } } },
  remy:      { id: 'remy',      name: 'Remy',      file: 'Remy',      char: 'remy', role: 'pilot', from: 'remy',
               fly: { profile: { base: 'student', knobs: { reaction: 0.40, overRotate: 0.03, flareK: 0.85 } },
                      style: 'normal', traits: ['eager'], grow: { rate: 'fast', ceiling: 'expert' },
                      pack: { style: 'not given: normal' } } },
  megan:     { id: 'megan',     name: 'Megan',     file: 'Megan',     char: 'ch22', role: 'pilot', from: 'sky',
               fly: { profile: { base: 'bush', knobs: { reaction: 0.12, smooth: 1.0, slip: true, field: 'short', bankK: 1.2, comfortG: 1.7 } },
                      style: 'normal', traits: ['short-field', 'loves-taildraggers', 'refuses-nothing'], grow: { rate: 'steady', ceiling: 'expert' },
                      pack: { style: 'not given: normal', grow: 'not given: steady to the expert, on tailwheel types only (loves taildraggers)' } } },
  // ---- passengers: the random pool ----
  david:     { id: 'david',     name: 'David',     file: 'David',     char: 'ch28', role: 'passenger' },
  elizabeth: { id: 'elizabeth', name: 'Elizabeth', file: 'Elizabeth', char: 'ch26', role: 'passenger' },
  james:     { id: 'james',     name: 'James',     file: 'James',     char: 'ch06', role: 'passenger' },
  jody:      { id: 'jody',      name: 'Jody',      file: 'Jody',      char: 'ch37', role: 'passenger' },
};
const PEOPLE_IDS = Object.keys(GAME_PEOPLE);
// the narrative pack's pilot ids -> the person wearing each (an older save's roster, the pack's import)
const PEOPLE_FROM_PACK = PEOPLE_IDS.filter(id => GAME_PEOPLE[id].from).reduce((o, id) => (o[GAME_PEOPLE[id].from] = id, o), {});

const peopleOf = role => PEOPLE_IDS.filter(id => GAME_PEOPLE[id].role === role);
const peopleName = id => (GAME_PEOPLE[id] ? GAME_PEOPLE[id].name : String(id));
// the face of a provider's contracts (null: none set)
const peopleClientOf = org => PEOPLE_IDS.find(id => GAME_PEOPLE[id].role === 'client' && GAME_PEOPLE[id].org === org) || null;
// the portrait's path for a display of `px` CSS pixels: the smallest cut at least that big (the largest past it); null
// for no such person, or a cut tools/portrait_prep.py has not made
function peopleFace(id, px) {
  if (!GAME_PEOPLE[id]) return null;
  const want = Math.max(1, +px || PEOPLE_FACE_PX[0]);
  const cut = PEOPLE_FACE_PX.find(p => p >= want) || PEOPLE_FACE_PX[PEOPLE_FACE_PX.length - 1], k = id + '_' + cut;
  const F = typeof PEOPLE_FACES !== 'undefined' ? PEOPLE_FACES : {};   // 72_people_faces.js: the content-named cut
  return F[k] ? PEOPLE_FACE_DIR + F[k] : null;
}
// n people of a role, drawn without repeats by a seed (the same seed, the same people, in the same order); fewer when
// the role holds fewer. A string or number seed; the hash is FNV-1a, the draw a xorshift - no Math.random.
function peoplePool(role, n, seed) {
  const pool = peopleOf(role);
  let h = 2166136261 >>> 0;
  for (const ch of String(seed == null ? 0 : seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const next = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const out = [], k = Math.min(Math.max(0, n | 0), pool.length);
  while (out.length < k) out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
  return out;
}
