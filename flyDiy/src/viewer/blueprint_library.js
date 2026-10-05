// blueprint_library.js — THE BLUEPRINT LIBRARY (G573.2, the user: "Start a blueprint
// library, like we have one for 3d planes, add this one and we'll delete it
// before release, but it will help refining the chinook").
//
// The reference plane's 3D models are a declared table (refplane.js
// REF_PRESETS) over baked payloads; this is the same idea for its second
// source. An entry is a SHEET (an image under media/blueprints/, content-hashed
// like everything the media cache serves) and the DESK STATE that lines it up:
// the scale, the cuts, each view's orientation, extent and ground line —
// exactly what BLUEPRINT.state() holds after a person has worked the sheet at
// the desk, so picking an entry is the end of the five steps, not the start.
// Display state only, under the same ONE ROOT rule as blueprint.js.
//
// `release: false` MARKS AN ENTRY THAT MUST NOT SHIP: a sheet whose licence
// nobody has established, kept because it helps a chantier. GATE BLUEPRINT
// lists every such entry on each run. Before a release: delete the row AND its
// image, and the CREDITS.md line.
//
// HOW TO ADD ONE: work the sheet at the desk (or through BLUEPRINT.api), copy
// JSON.stringify(BLUEPRINT.state()) — scale, views, rig.attitude — into a row,
// put the image in media/blueprints/<key>.<first 8 hex of its sha256>.<ext>.
(function () {
'use strict';
var BLUEPRINT_LIBRARY = [
  // THE BIRDMAN CHINOOK 2S (G573.1): a three-view of unknown source, supplied
  // by the user to refine the shed's Chinook. No scale bar: scaled on the top
  // view's span at 37 ft (its span / length is the 2S's, not the 32 ft Plus 2's).
  // Top view lassoed and plumbed on its leading edge (-49.5 deg), its extent
  // pulled onto the nose past the drawn centreline; the front view is cropped
  // through its left tip on the sheet, so its extent is mirrored about its
  // centreline to -63 px, outside the image; ground 6.9 deg nose-up off the
  // faint drawn line. Lays out 5.33 m long, 11.36 m span.
  { key: 'chinook2s', name: 'Birdman Chinook 2S', release: false,
    image: 'media/blueprints/chinook2s.cec14f3e.png', w: 1075, h: 585,
    credit: 'source unknown, supplied by the user for the Chinook chantier — DELETE BEFORE RELEASE',
    state: {
      scale: {"a":[414.7,528.3],"b":[1030,24.9],"len":37,"unit":"ft"},
      rig: { attitude: 'ground' },
      views: [
      {"rot":0,"flipH":false,"flipV":false,"on":true,"alpha":1,"paper":"clear","cut":0.12,"ink":"cyan","dx":0,"dy":0,"dz":0,"spin":0,"size":1,"faces":"side","id":1,"kind":"front","label":"front","shape":"box","pts":[[24,6],[785,6],[785,180],[24,180]],"ext":[-63,8,746,173],"extAuto":false,"ground":{"a":[307.4,173.5],"b":[420,173.5]}},
      {"rot":0,"flipH":false,"flipV":false,"on":true,"alpha":1,"paper":"clear","cut":0.12,"ink":"cyan","dx":0,"dy":0,"dz":0,"spin":0,"size":1,"faces":"side","id":2,"kind":"side","label":"side","shape":"box","pts":[[62,258],[452,258],[452,430],[62,430]],"ext":[9,10,385,166],"extAuto":true,"ground":{"a":[166,421.3],"b":[420.5,390.6]}},
      {"rot":-49.496,"flipH":false,"flipV":false,"on":true,"alpha":1,"paper":"clear","cut":0.12,"ink":"cyan","dx":0,"dy":0,"dz":0,"spin":0,"size":1,"faces":"side","id":3,"kind":"top","label":"top","shape":"lasso","pts":[[626.166,174.459],[1013.438,-0.98],[1069.429,8.352],[1074.095,81.14],[966.779,417.087],[971.445,510.405],[826.801,543.066],[481.523,589.726],[406.868,547.732],[425.532,491.741]],"ext":[308.2,48,685,849],"extAuto":false,"ground":null}
      ] } },
];
if (typeof module !== 'undefined' && module.exports) module.exports = { BLUEPRINT_LIBRARY: BLUEPRINT_LIBRARY };
else window.BLUEPRINT_LIBRARY = BLUEPRINT_LIBRARY;
})();
