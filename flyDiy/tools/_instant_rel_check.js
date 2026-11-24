#!/usr/bin/env node
// _instant_rel_check.js - GATE INSTANTREL (PERF-SLIDERS, 23 Nov 2026): A DRAG'S RELEASE ENDS ON THE PLAIN BUILD'S AEROPLANE
// WHERE GATE INSTANT'S OWN ROWS DO NOT LOOK. GATE INSTANT's check (_instant_check.js: the drag the player's way, the
// release, the whole scene and the resolved spec against the same parameters built the long way twice) on a twin with
// its engines and its retracting gear on the wing (the DC-3-alike), a hull with its engine on a pylon (the Super
// Petrel) and the Cub, six rows each: the wing's span and chord, the tail's span, the main gear's track AND ITS STATION
// ALONG THE FUSELAGE (s1Z: a row that turns the sit), the seat's height.
// WHY, two defects of master found 23 Nov (GATE INSTANT's check on master's own files):
//  1. the DC-3's wing span ended 587 objects and the resolved spec away from the plain build - the wing ran in the
//     previews, so the release's plan did not run it and its own edge to the engine layer (REL_FEEDS wing > eng) never
//     fired: the nacelle engines stood one build behind, their weathering sources 14.5 cm off. The rule: a wing that
//     moved in the drag under its engines sends the release whole (_cage_ui.js);
//  2. the Cub's s1Z ended with its fuel tank drawn (five meshes) where the plain build draws none, and its limbs a
//     hair off (the DC-3: the elbows 0.3 mm) - the crew's limbs are aimed along the WORLD's axes (_cage_crew.js
//     solveGripJob), so the crew, and the tank's clearance of it, belong to the sit they were built under. The rule: a
//     sit that TURNED in the drag under a kept crew sends the release whole.
// GATE INSTANT's two aeroplanes carry one engine on the nose and its rows turn no sit: it could see neither.
// Usage: node --max-old-space-size=8192 tools/_instant_rel_check.js      (about 25 min alone; exit 1 on any difference)
'use strict';
process.argv.push('--gate', 'INSTANTREL', '--builds', 'dc3,petrel,cub', '--only', 'wgSpan,wgChord,stSpan,s1X,s1Z,seatH');
require('./_instant_check.js');
