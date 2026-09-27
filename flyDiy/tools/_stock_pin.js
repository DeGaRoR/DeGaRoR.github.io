// THE OLD STOCK, PINNED (G770). Since G770 a player with no working build opens on the Cub archetype
// (app.js playerDefaultSpec), where every session before it opened on GEN_DEFAULT - 'Garage Special',
// the first test aircraft. The node gates never saw the change (they build GEN_DEFAULT by name:
// buildGen() / GEN_DEFAULT / pilot_trace's 'stock'), but a browser rig on a FRESH PROFILE flies whatever
// the page's first boot puts on the stand - so every rig whose numbers are compared against a baseline
// ("the stock build") would have moved silently onto the Cub.
//
// They are pinned here instead: the working-build slot (flydiy.wip) is written, before the page's first
// script, with the envelope garage.js itself writes, around GEN_DEFAULT. The page then takes exactly the
// pre-G770 road - garage.js restores GEN_DEFAULT onto the shelf (what api.defaults() returned), its
// `cage: null` means the boot adopts nothing and seeds nothing, the editor opens on the page's own cage
// and the boot's syncBuild joins it: the old first-boot aeroplane, to the byte. The one visible
// difference is that the first-launch chooser does not open (a WIP exists) - every rig already clicks
// it away ("keep the current build"), and tolerates it absent.
//
//   const SP = require('./_stock_pin.js');
//   cmd('Page.addScriptToEvaluateOnNewDocument', { source: SP.pinScript() })   // before Page.navigate
//
// Pinned (G770): rollout_perf, frame_perf, tree_perf, met_perf, boot_perf, program_census, sampler_census.
// `--build default` on rollout_perf measures the NEW first boot (the Cub) instead.
'use strict';
const path = require('path');

const STOCK_NAME = 'stock (GEN_DEFAULT, Garage Special) - pinned G770';

function stockWip() {
  const C = require(path.join(__dirname, 'flight_core.js'));
  return JSON.stringify({ what: 'flydiy-build', v: C.GEN_SPEC_V, name: null,
    spec: JSON.parse(JSON.stringify(C.GEN_DEFAULT)), plaque: null,
    log: { built: null, tests: [], flights: [] } });
}
// a page-side one-liner: the slot written before anything reads it (a thrown storage costs the pin, loudly)
function pinScript() {
  return 'try{localStorage.setItem("flydiy.wip",' + JSON.stringify(stockWip()) + ')}catch(e){console.error("stock pin:",e)}';
}

module.exports = { STOCK_NAME, stockWip, pinScript };
