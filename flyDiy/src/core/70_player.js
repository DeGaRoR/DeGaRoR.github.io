// ===========================================================================
// THE PLAYER — the player's property as ONE document, one key, one version.
// ===========================================================================
// HANGARS.md §7: the shed's state lived in browser prefs, which is exactly
// the defect G105 fixed for the aeroplane — a pref cannot be saved, shared or
// reasoned about, and the moment there is more than one hangar a pref cannot
// hold them at all. This document holds what the player OWNS: today the sheds
// and the wallet, and nothing else needs to yet.
//
// ITS VERSION IS ITS OWN. G105's ruling, applied in reverse: state that is
// not the aeroplane costs no spec version, so GEN_SPEC_V does not know this
// file exists. PLAYER_V has its own migrator table, its own walk (the byte
// shape of genMigrateSpec's), and its own vintage shelf — GATE PLAYER loads
// tools/fixtures/player_*.json forever, because ruling 4 holds for property
// the way it holds for builds.
//
// v2 (G2095, GAME-PREMISES-2026-10-06.md): THE SHEDS STAND AT BASES. A shed
// is a hangar the player holds at an aerodrome: its key is a HANGAR id (the
// first hangar at a base keeps the base's own id, so HOME is still HOME), and
// `base` says which aerodrome it stands on — in v1 the key WAS the aerodrome,
// which is the one change of HOME this version exists for (PLAYER_MIGRATORS[1]).
// Beside it: `tenure` (own | rent), and at the top level `mode` (sandbox |
// career: who pays), `here` (the hangar the garage opens in), `clock` (flown
// seconds — time advances in flight, GAME-LAYER ruling ax), `fleet` and
// `ledger`. Nothing in a v1 shed moves.
//
// THE FLEET MOVED IN AT v2 as the LEDGER OF WHERE: `fleet[slotName]` says
// which hangar (or which aerodrome's tie-downs) each saved build stands at.
// The flydiy.build.* slots stay the file cabinet (per-item envelopes,
// individually shareable); this document is the ledger of ownership, not the
// filing. The lift from the slots is NOT a migrator — a migrator sees only
// this document and the slot names live in the browser's storage — it is
// playerFleetReconcile (71_player_bases.js), pure, handed the slot names by
// the page. `logs` stay in the envelopes (garage.js) for now.
//
// The name is `player`, not `estate` — ROADMAP G77.1 already spends "free
// estate" on screen real-estate, and this is property, not pixels.
const PLAYER_V = 2;

// { fromVersion: doc => doc } — each entry lifts a document one version. May
// mutate and return its argument. Runs BEFORE normalisation, on the raw
// shape the old game actually saved. EMPTY until a field changes UNITS, SIGN
// or HOME; the mechanism exists before its first real entry so that entry
// lands in an exercised, gated machine (GATE PLAYER injects a throwaway
// migrator, runs the walk, and removes it — G106's idiom).
// 1 -> 2 (G2095): the shed's KEY stops being its aerodrome — `base` takes
// that job, so a second hangar at one field is a second key, not a clash.
// Defensive: a v0 or junk document walked through here has no sheds at all.
const PLAYER_MIGRATORS = {
  1: doc => {
    if (doc && doc.sheds && typeof doc.sheds === 'object')
      for (const id of Object.keys(doc.sheds)) {
        const s = doc.sheds[id];
        if (s && typeof s === 'object' && typeof s.base !== 'string') s.base = id;
      }
    return doc;
  },
};

function playerMigrate(r) {
  if (!r || typeof r !== 'object') return r;
  const v = r.v;
  if (typeof v !== 'number' || !isFinite(v)) return r;
  if (v >= PLAYER_V) return r;              // current, or from the future
  for (let i = Math.floor(v); i < PLAYER_V; i++)
    if (PLAYER_MIGRATORS[i]) r = PLAYER_MIGRATORS[i](r) || r;
  r.v = PLAYER_V;
  return r;
}

// A FACTORY, not a shared const: the viewer mutates the live document, and a
// shared default object would be mutated with it. The default shed is the
// club at its own dims with the full fit-out — which is exactly the room the
// game has always shown. `dims`, `parts` and `name` are OPTIONAL and absent:
// absent means DERIVED (the shell's defaults), the same null-means-derived
// ruling the spec lives by.
// v2: the default player holds ONE hangar, the club at HOME, owned, in
// sandbox (nothing is charged until the career exists — GAME-PREMISES §4),
// with an empty fleet: the page's reconcile lifts the saved builds into it.
function playerDefault() {
  return {
    what: 'flydiy-player', v: PLAYER_V,
    wallet: 0,
    mode: 'sandbox',
    here: 'HOME',
    clock: 0,
    sheds: {
      HOME: {
        shell: 'club',
        kits: (typeof HANGAR_KITS_DEFAULT !== 'undefined'
               ? HANGAR_KITS_DEFAULT.slice()
               : ['park', 'bench', 'wood', 'metal', 'store', 'handling',
                  'office', 'comfort', 'curio', 'wip']),
        base: 'HOME', tenure: 'own',
      },
    },
    fleet: {},
    ledger: [],
  };
}

// Fills what is missing, carries what is present VERBATIM. Unknown shed ids
// are preserved (a newer game's meadow shed must survive a round trip through
// this one), unknown fields ride along untouched for the same reason.
function playerNormalise(r) {
  const def = playerDefault();
  if (!r || typeof r !== 'object') return def;
  r.what = 'flydiy-player';
  if (typeof r.v !== 'number' || !isFinite(r.v)) r.v = PLAYER_V;
  if (typeof r.wallet !== 'number' || !isFinite(r.wallet)) r.wallet = 0;
  if (!r.sheds || typeof r.sheds !== 'object') r.sheds = def.sheds;
  if (!r.sheds.HOME || typeof r.sheds.HOME !== 'object')
    r.sheds.HOME = def.sheds.HOME;
  const h = r.sheds.HOME;
  if (typeof h.shell !== 'string') h.shell = 'club';
  if (!Array.isArray(h.kits)) h.kits = def.sheds.HOME.kits;
  // v2: every shed stands somewhere and is held somehow. A shed with no
  // `base` stands on the aerodrome its key names (v1's meaning, so a
  // document that skipped the walk still lands right); unknown shed ids ride
  // along exactly as before, only gaining these two words.
  for (const id of Object.keys(r.sheds)) {
    const s = r.sheds[id];
    if (!s || typeof s !== 'object') continue;
    if (typeof s.base !== 'string' || !s.base) s.base = id;
    if (s.tenure !== 'own' && s.tenure !== 'rent') s.tenure = 'own';
  }
  // GQ4 (G2230, GAME-2026-10-06.md §R): the main hangar (HOME) and at most
  // two side hangars. An older document holding more keeps EVERY one - the
  // extra ones (the newest: `since`, then the id) are marked `legacy`: still
  // usable, counted by the cap, never offered again. Refuse nothing, and no
  // PLAYER_V step: the v2 shape holds (a v2 game reads `legacy` as one more
  // field riding along).
  {
    const max = typeof PREM_SIDE_MAX === 'number' ? PREM_SIDE_MAX : 2;
    const sides = Object.keys(r.sheds).filter(id => id !== 'HOME' && r.sheds[id] && typeof r.sheds[id] === 'object')
      .sort((a, b) => ((+r.sheds[a].since || 0) - (+r.sheds[b].since || 0)) || (a < b ? -1 : a > b ? 1 : 0));
    for (const id of sides.slice(max)) r.sheds[id].legacy = true;
  }
  if (r.mode !== 'sandbox' && r.mode !== 'career') r.mode = 'sandbox';
  if (typeof r.here !== 'string' || !r.sheds[r.here] || typeof r.sheds[r.here] !== 'object')
    r.here = 'HOME';
  if (typeof r.clock !== 'number' || !isFinite(r.clock) || r.clock < 0) r.clock = 0;
  if (!r.fleet || typeof r.fleet !== 'object' || Array.isArray(r.fleet)) r.fleet = {};
  if (!Array.isArray(r.ledger)) r.ledger = [];
  return r;
}

// THE ONE-TIME LIFT: the two old pref values (already parsed, or null) into
// a fresh v1 document. Pure, so the gate proves it without a browser. Dims
// carry only their three finite keys; parts carry verbatim — clamping stays
// a write-time concern (setDims), the same division of labour as the prefs
// had. flydiy.hangarMobile and flydiy.hangarEnvSrc are NOT lifted: view
// state never flies, and view state is not property (G106).
function playerLift(dims, parts) {
  const doc = playerDefault();
  if (dims && typeof dims === 'object') {
    const d = {};
    for (const k of ['HW', 'HD', 'EAVE'])
      if (typeof dims[k] === 'number' && isFinite(dims[k])) d[k] = dims[k];
    if (Object.keys(d).length) doc.sheds.HOME.dims = d;
  }
  if (parts && typeof parts === 'object' && Object.keys(parts).length)
    doc.sheds.HOME.parts = JSON.parse(JSON.stringify(parts));
  return doc;
}

// THE COMPOSITION RULE. The SITE keeps position and class-default dims (the
// declaration both scenes are gated against); the PLAYER's shed record owns
// the player's own dims; the renderer composes, per key, so the building you
// taxi past and the room you stand in are the same size by construction —
// which 25_airfield.js's header always claimed and the pref split silently
// broke: dragging the sliders resized the room and left the world's shed at
// the declaration.
function playerShedDims(doc, id, site) {
  const s = doc && doc.sheds && doc.sheds[id];
  const d = (s && s.dims) || {};
  const h = (site && site.hangar) || {};
  return { HW: d.HW || h.HW, HD: d.HD || h.HD, EAVE: d.EAVE || h.EAVE };
}
