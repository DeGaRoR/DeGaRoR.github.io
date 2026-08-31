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
// RESERVED FOR P6: `fleet` and `logs`. The fleet is rows of named aeroplanes
// with plaques, logbooks, hours and wear — the same sentence as the sheds —
// and when it moves in, the lift from the flydiy.build.* slots is
// PLAYER_MIGRATORS' first real entry beside a frozen v1 fixture, NOT a second
// container. (The slot store itself may well stay underneath as the file
// cabinet — per-item envelopes, individually shareable; this document is the
// ledger of ownership, not the filing.)
//
// The name is `player`, not `estate` — ROADMAP G77.1 already spends "free
// estate" on screen real-estate, and this is property, not pixels.
const PLAYER_V = 1;

// { fromVersion: doc => doc } — each entry lifts a document one version. May
// mutate and return its argument. Runs BEFORE normalisation, on the raw
// shape the old game actually saved. EMPTY until a field changes UNITS, SIGN
// or HOME; the mechanism exists before its first real entry so that entry
// lands in an exercised, gated machine (GATE PLAYER injects a throwaway
// migrator, runs the walk, and removes it — G106's idiom).
const PLAYER_MIGRATORS = {};

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
function playerDefault() {
  return {
    what: 'flydiy-player', v: PLAYER_V,
    wallet: 0,
    sheds: {
      HOME: {
        shell: 'club',
        kits: (typeof HANGAR_KITS_DEFAULT !== 'undefined'
               ? HANGAR_KITS_DEFAULT.slice()
               : ['park', 'bench', 'wood', 'metal', 'store', 'handling',
                  'office', 'comfort', 'curio', 'wip']),
      },
    },
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
