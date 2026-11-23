#!/usr/bin/env node
// _instant_rel_check.js - GATE INSTANTREL (PERF-SLIDERS, 23 Nov 2026): A DRAG'S RELEASE ENDS ON THE PLAIN BUILD'S AEROPLANE ON
// THE AEROPLANES THE CUB AND THE METAL CESSNA DO NOT STAND FOR. GATE INSTANT's own check (_instant_check.js: the drag the
// player's way, the release, the whole scene and the resolved spec against the same parameters built the long way
// twice) on a twin with its engines and its retracting gear on the wing (the DC-3-alike) and on a hull with its engine
// on a pylon (the Super Petrel), the rows whose release goes by the plan (the wing's, the tail's, the main gear's
// track) and one whose release goes whole (the seat's height).
// WHY: a drag of the DC-3's wing span ended 611 objects and the resolved spec away from the plain build - the wing ran
// in the previews, so the release's plan did not run it and its own edge to the engine layer (REL_FEEDS wing > eng)
// never fired: the engines' weathering sources stood 14.5 cm off. The gate's two aeroplanes have one engine on the
// nose and could not see it. Fixed in the plan (CAGE_CHAIN.plan's `since`); this is the check that it stays fixed.
// NOT A ROW HERE, KNOWN: the main gear's station along the fuselage (s1Z) and any row that moves the sit's PITCH with
// the crew kept - the editor aims the elbows and the knees along the WORLD's axes (_cage_crew.js solveGripJob: pole.y -=
// 0.22 s ...), so the crew's pose depends on the sit that stood when its layer last ran (the DC-3: an elbow 0.3 mm
// off after an s1Z drag); see HANDOVER, PERF-SLIDERS.
// Usage: node --max-old-space-size=8192 tools/_instant_rel_check.js      (about 10 min; exit 1 on any difference)
'use strict';
process.argv.push('--gate', 'INSTANTREL', '--builds', 'dc3,petrel', '--only', 'wgSpan,wgChord,stSpan,s1X,seatH');
require('./_instant_check.js');
