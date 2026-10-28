// ===========================================================================
// THE NAMES (G3240 NAMES, 2026-10-22; GAME-PLAN-2026-10-15 §R and §13). The user, 15 Oct: "Everything should have a
// fictional name, I don't want to get in hot waters with some Indian community thing." Every PERSON, ORGANISATION and
// PLACE the game SHOWS is fictional, real geographic names included; the island's terrain shape stays.
//
// THIS IS THE ONE TABLE: a name the game shows is written here once, so renaming a place is a one-line edit. The words
// below are read where the text is made (72_contract_data's fields and briefs, 71_player_bases' plot words, 38_nav's
// beacon, the boot's cards, the map bake's labels) and where the island's runways become aerodromes (27_premises
// runwayAerodrome and 73_ contractFieldsOf through fieldName), so the user's own saved scenery, whose record may still
// carry an older name, shows these too. A field that is not in GAME_NAMES.fields shows its record's own name (the strips
// the user names in the scenery editor: the Cabin Strip, strips 9-13).
//
// INTERNAL IDS NEVER CHANGE (HOME, w1-w8, SEA, mk_sea, mn_strip, nv_strip, tw_ski ...): a save, a contract or a route
// names ids, never these words, so an edit here breaks nothing. GATE NAMES (tools/_names_check.js) holds that no real
// name it lists is shown: the source's text, this table, the island record and the built page's text.
//
// `var`, not const: the loading screen's cards (src/viewer/boot_cards.js) read it before the core runs, so build.js
// puts this file in the BOOT block too and the core's own copy re-declares the same table (a const would throw).
// Pure data and one lookup: no DOM, no THREE, no storage.
// ===========================================================================
var GAME_NAMES = {
  // ---- the island and its places (shown in the briefs, the plot words, the cards, the map) ----
  island:   'Jolene',                         // the island (was Annette)
  town:     'Cedar Harbour',                  // the town on the west shore (was Metlakatla)
  hill:     'Ridgeback',                      // the hill of the w3 strip (was Tamgas Hill)
  mountain: 'Mount Ardent',                   // the island's summit, 1 096 m (was Mount Tamgas)
  mine:     'Copperhead Mine',                // the mine up the mountain (was Jumbo Mine)
  vor:      'Jolene VOR/DME',                 // the radio beacon by the field (was Annette Island VOR/DME)
  // ---- the organisations ----
  mineCo:   'Copperhead Mine & Dock Co.',     // the mine-and-dock provider (was Jumbo Mine & Dock Co.)
  // ---- the fields, by internal id (the contracts, the map, the arrival card, the plot list) ----
  fields: {
    HOME:     'Jolene AFB 13/31',
    w2:       'Jolene AFB 02/20',
    w3:       'Ridgeback Strip',              // (was Tamgas Hill Strip)
    SEA:      'Greywater Dock',               // (was Annette Dock)
    mk_sea:   'Cedar Harbour Seaplane Base',  // (was Metlakatla Seaplane Base)
    mn_strip: 'Copperhead Mine Street',       // (was Jumbo Mine Street)
    nv_strip: 'East Point Clearing',
    tw_ski:   'Skyline Altiport',
    cb_sea:   'Cabin Lake',                   // (CABIN-LAKE 26 Oct: the seaplane lane in front of the Cabin Strip, by the user's piers)
  },
};

// the name a field shows: the table's, else the record's own, else its id
function fieldName(id, recName) {
  const F = GAME_NAMES.fields;
  return (id && Object.prototype.hasOwnProperty.call(F, id)) ? F[id] : (recName || id);
}
