#!/usr/bin/env node
// ============================================================================
// GATE NODUMMY — the racer is the only pilot (G3700). The user, 25 Oct: "retire
// everything related to the dummy, including its mesh and all references to
// it, all controls of it. Our test guy is the racer mixamo character [...] the
// outline should be theirs"; and, the same evening, the four things to confirm:
// the size sliders gone, the outline the character's own, no stand-in skeleton
// in the background, no reference in code to the old model or its generator.
// ============================================================================
// What is held (node, source and the cage's own load door; no page, no GPU):
//   1. THE SCAN      no identifier or word of the retired figure anywhere in
//                    src/ or tools/ code (js, mjs, py, html), built outputs and
//                    saved data aside, EXCEPT inside cageFromSpec's migration
//                    block (_cage_gen.js): the one door old files come through,
//                    which must name the keys it reads.
//   2. THE RACER     _cage_char.js names the racer (ch20, a chars_table row) and
//                    the crew layer seats them in the pilot's seat, with no spec
//                    key to choose another (the career's hired pilot aside).
//   3. THE BODY      the solver chain is the character's own joints by their
//                    Mixamo names (no stand-in bone table, no stature scale); a
//                    seat with no character has no body; the eye point is read
//                    off the character's head.
//   4. THE ROWS      no stature, eye-marker or pilot-pick row in the page or
//                    the parts table; the kept pilot rows are the pose rows.
//   5. THE OUTLINE   the editor's highlight draws a character's skinned mesh as
//                    a skinned copy and never outlines the pick body; the tank's
//                    crew clearance skips the bind pose.
//   6. THE ALIAS     an old file loads: every renamed row arrives under its new
//                    name with its saved value, the co-pilot pick renumbered,
//                    the retired rows carried unread in `fpLegacy`, and no old
//                    key survives a round trip through cageToSpec.
// Usage: node tools/_nodummy_check.js   -> "GATE NODUMMY: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, extra) => {
  if (c) console.log('  ok   ' + msg);
  else { fails++; console.log('  FAIL ' + msg + (extra ? '  [' + extra + ']' : '')); }
};
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---- 1. the scan -----------------------------------------------------------
const BANNED = new RegExp([
  '\\bdumm(?:y|ies)\\b', '\\bATD\\b', '\\bATD[-_]', 'edDum', 'flDum', 'makeDummy', 'bareDummy',
  'seatDummy', 'mannequin', '\\bdum2On\\b',
  '\\bdum(?:On|Size|Recline|Elbows|Knees|HandGrip|Fist|Idle|HandsApart|FistL|FistR|GripL|GripR|Markers|Model)\\b',
].join('|'), 'i');
const SKIP_DIR = new Set(['fixtures', 'node_modules', 'reports', 'evidence']);
const SKIP_FILE = new Set(['tools/flight_core.js',            // built from src/core
  'tools/_nodummy_check.js']);                                // this gate names what it looks for
const CODE = /\.(js|mjs|py|html)$/;
const files = [];
const walk = rel => {
  for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(r); }
    else if (CODE.test(e.name) && !SKIP_FILE.has(r)) files.push(r);
  }
};
walk('src'); walk('tools');
// the allowed block: cageFromSpec's migrations, from their header to the
// legacy lift that ends the function
const allowed = (f, text) => {
  if (f !== 'tools/_cage_gen.js') return null;
  const a = text.indexOf('  // G180 MIGRATIONS, at the one door a saved cage comes through.');
  const b = a < 0 ? -1 : text.indexOf('  if (cageHasLegacy(P)) return cageLiftLegacy(P);\n  return P;\n}', a);
  return a >= 0 && b > a ? [a, b] : null;
};
const hits = [];
let allowSeen = false;
for (const f of files) {
  const text = src(f);
  const span = allowed(f, text);
  if (span) allowSeen = true;
  const re = new RegExp(BANNED.source, 'gi');
  let m;
  while ((m = re.exec(text))) {
    if (span && m.index >= span[0] && m.index < span[1]) continue;
    const line = text.slice(0, m.index).split('\n').length;
    hits.push(f + ':' + line + ' ' + m[0]);
  }
}
ok(files.length > 200, 'the scan read the code tree (' + files.length + ' files)');
ok(allowSeen, 'the one allowed block (cageFromSpec\'s migrations) was found');
ok(hits.length === 0, 'no reference to the retired figure outside the load migration', hits.slice(0, 12).join(' | '));

// ---- 2. the racer ----------------------------------------------------------
const CHAR = src('tools/_cage_char.js'), CREW = src('tools/_cage_crew.js');
const racer = (/const RACER = '([a-z0-9]+)';/.exec(CHAR) || [])[1];
ok(racer === 'ch20', 'the racer is ch20 (CAGE_CHAR.RACER)', racer);
ok(/dict\(key='ch20'/.test(src('tools/chars_table.py')), 'ch20 is a declared character (chars_table.py)');
ok(/window\.CAGE_CHAR = \{[^}]*\bRACER\b/.test(CHAR), 'CAGE_CHAR publishes RACER');
ok(/const pilotIdx = crewIdx >= 0 \? crewIdx : keyIdx\(window\.CAGE_CHAR && window\.CAGE_CHAR\.RACER\);/.test(CREW) &&
   /if \(role === 'pilot'\) return pilotIdx >= 0 \? charAt\(pilotIdx\) : null;/.test(CREW),
   'the pilot seat wears the racer (or the career\'s hired pilot), nothing else');
ok(!/\bP\.pilotWho\b|\bP\.copWho\b/.test(CREW), 'the crew reads no pilot pick and the old co-pilot pick');

// ---- 3. the body -----------------------------------------------------------
ok(/const CHAIN_PARENT = \{\s*Hips: null,/.test(CHAR) && !/\bMAP\b/.test(CHAR),
   'the solver chain is the Mixamo joints by name (no translation table)');
ok(!/REF_BONES|STATURES|BASE_STATURE/.test(CREW), 'no stand-in bone table and no stature scale in the crew layer');
ok(/function bareRig\(parent, rig\) \{\s*if \(!rig\) return null;/.test(CREW), 'no character, no body');
ok(/if \(!CH\) return null;\s*const s = 1;/.test(CREW), 'every character at its own height (scale 1)');
ok(/eye: hl > 0\.05 \?/.test(CHAR) && /HeadTop_End/.test(CHAR) && /pilotOcc\.rig\.eye/.test(CREW),
   'the eye point is read off the character\'s own head');
ok(/pickBody/.test(CHAR) && /window\.CAGE_CHAR\.pickBody\(occ\.char\)/.test(CREW), 'each dressed occupant gets its posed body');

// ---- 4. the rows -----------------------------------------------------------
const PAGE = src('tools/_cage_page5.js'), PARTS = src('tools/_cage_parts.js');
for (const [nm, t] of [['_cage_page5.js', PAGE], ['_cage_parts.js', PARTS]]) {
  ok(!/'(pilSize|paxSize|pilotWho|pilMarkers)'/.test(t), nm + ': no stature, pilot-pick or eye-marker row');
}
for (const k of ['pilOn', 'cabWho', 'pilElbows', 'pilKnees', 'pilRecline', 'pilHandGrip', 'pilFist', 'pilIdle',
                 'pilHandsApart', 'pilFistL', 'pilFistR', 'pilGripL', 'pilGripR'])
  ok(new RegExp("\\['" + k + "',").test(PAGE) && new RegExp("'" + k + "'").test(PARTS), 'the kept row ' + k + ' is in the page and the parts table');
ok(!/sections: \[[^\]]*\]/.test((/key: 'crew', name: 'Crew'[\s\S]*?\] \},/.exec(PARTS) || [''])[0]),
   'the Crew part claims no livery section');

// ---- 5. the outline --------------------------------------------------------
const ED = src('src/viewer/editor.js'), EN = src('tools/_cage_energy.js');
ok(/const mk = o\.isSkinnedMesh \? hiSkinMk\(o\) : null;/.test(ED) && /new THREE\.SkinnedMesh\(g, m\);\s*sm\.bind\(o\.skeleton, o\.bindMatrix\);/.test(ED),
   'the highlight draws a character as a skinned copy on its own skeleton');
ok(/o\.userData\.charPick/.test(ED), 'the highlight never outlines the pick body');
ok(/#ifdef USE_SKINNING/.test(ED), 'the silhouette rim follows the skinned normal');
ok(/if \(!o\.isMesh \|\| o\.isSkinnedMesh \|\| !o\.geometry\) return;/.test(EN), 'the tank\'s crew clearance skips the bind pose');

// ---- 6. the alias ----------------------------------------------------------
const C2 = require('./_cage_gen.js');
const OLD = n => C2.CAGE_PILOT_OLD(n);
const saved = { cabOcc: 1, pilotWho: 0, copWho: 5 };
saved[OLD('On')] = 1; saved[OLD('HandGrip')] = 0.135; saved[OLD('Fist')] = 0.45;
saved[OLD('Recline')] = 7.5; saved[OLD('Size')] = 1; saved[OLD('Markers')] = 1;
const P = C2.cageFromSpec({ cage: saved });
ok(P.pilOn === 1 && P.pilHandGrip === 0.135 && P.pilFist === 0.45 && P.pilRecline === 7.5,
   'the renamed rows arrive with their saved values');
ok(P.cabWho === 4, 'the co-pilot pick is renumbered (5 -> 4)', String(P.cabWho));
ok(P.fpLegacy && P.fpLegacy.pilotWho === 0 && P.fpLegacy[OLD('Size')] === 1 && P.fpLegacy[OLD('Markers')] === 1,
   'the retired rows ride unread in fpLegacy', JSON.stringify(P.fpLegacy));
const out = C2.cageToSpec(P);
const left = Object.keys(out).filter(k => /^dum/.test(k) || k === 'pilotWho' || k === 'copWho' || k === 'paxSize');
ok(left.length === 0, 'no old key survives the round trip', left.join(','));
const P2 = C2.cageFromSpec({ cage: out });
ok(P2.pilHandGrip === 0.135 && P2.cabWho === 4 && JSON.stringify(P2.fpLegacy) === JSON.stringify(P.fpLegacy),
   'a re-saved file reloads the same (the alias does not apply twice)');
const fresh = C2.cageFromSpec({ cage: { pilHandGrip: 0.1 } });
ok(fresh.pilHandGrip === 0.1 && fresh.fpLegacy === undefined, 'a new file carries no fpLegacy');

console.log('GATE NODUMMY: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
