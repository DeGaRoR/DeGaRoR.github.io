// ============================================================================
// THE MISSION MODEL, LOADED (MISSIONS-P0) for GATE MISSIONS and the retrofit:
// the core files the mission packs read, evaluated FRESH from src/core in a vm.
//   loadMissions({ core, mut })  -> the context's names (every top-level const /
//     let / function of the files) + __src
//   core: true   over tools/flight_core.js's globals (the gate: freight, the
//                players, the careers); false (default): the LEAN set alone -
//                exactly the files tools/mission_editor.html loads
//   mut: { '<file>': src => src }  the selftest's doctoring
// 72_people.js (GAME_PEOPLE) is part of both sets: every person id is checked against
// the table.
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const CORE_DIR = path.join(__dirname, '..', 'src', 'core');
// the editor's set, in its <script> order = build.js MANIFEST.core's
const LEAN = ['01_names.js', '26_hangar_fit.js', '34_occupant.js', '38c_route.js', '72_people_faces.js', '72_people.js', '72_accept.js',
              '72_contract_data.js', '73_contracts.js', '73b_missions.js', '73c_mission_run.js', '79_story.js'];
// over the core, the model's own files (and the people) fresh; the rest is the core's
const FRESH = ['72_people_faces.js', '72_people.js', '72_accept.js', '72_contract_data.js', '73_contracts.js', '73b_missions.js', '73c_mission_run.js',
               '74_career.js', '75_career_wire.js'];
const namesOf = s => [...s.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
const has = f => fs.existsSync(path.join(CORE_DIR, f));
function loadMissions(opts) {
  opts = opts || {};
  const files = opts.core ? FRESH : LEAN;
  for (const f of files) if (!has(f)) throw new Error('missions: src/core/' + f + ' is missing');
  const src = {};
  for (const f of files) { const s = fs.readFileSync(path.join(CORE_DIR, f), 'utf8'); src[f] = opts.mut && opts.mut[f] ? opts.mut[f](s) : s; }
  const names = [].concat(...files.map(f => namesOf(src[f]))).filter((n, i, a) => a.indexOf(n) === i);
  const base = { console };
  if (opts.core) { Object.assign(base, require('./flight_core.js')); for (const n of names) delete base[n]; }
  const ctx = vm.createContext(base);
  vm.runInContext(files.map(f => src[f]).join('\n;\n') + '\n;this.__M = { ' + names.join(', ') + ' };', ctx, { filename: 'missions' });
  // the core's other names (79_story's beats, the freight, ...) beside the fresh ones
  const out = opts.core ? Object.assign({}, base) : {};
  return Object.assign(out, ctx.__M, { __src: src, __files: files, __ctx: ctx });
}
module.exports = { loadMissions, LEAN, FRESH, CORE_DIR };
