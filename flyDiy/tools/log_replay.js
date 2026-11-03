#!/usr/bin/env node
// log_replay.js - A USER'S FLIGHT LOG, AS A TEST CASE (G3322 FLIGHTREC-DETAIL).
//
// The user's log of 18 Oct (the pilot veering at lift-off, three take-offs in a row) said where the aeroplane went and
// not what it was, nor under what: the start conditions had to be guessed. The recorder's v2 (src/viewer/flight_recorder.js)
// writes them down - a 'flight' event at each flight's start (the route, the pilot, the day and its wind, damage, the
// build's name and spec hash) and the build's spec itself in the header. This turns a log back into those conditions
// and PRINTS the command lines that fly the same flight again - it runs none of them (every one is a heavy node job or
// a GPU run: the box is booked through its locks - bash tools/perf/boxlock.sh take cpu|gpu <who> "<what>").
//
//   node tools/log_replay.js <flydiy-flightlog-*.json[.gz]> [--flight N] [--out <dir>]
//
// It says:
//   - the WORLD (the header's; the 'flight' event's);
//   - the BUILD: its name and the hash of its spec as the page loaded it (FNV-1a 32 over JSON.stringify(spec), the
//     page's app.js flight() hash) - and the file in builds/ or bugReports/ whose spec hashes the same, or that no file
//     does (then the spec in the log's header is the build: --out writes it as an envelope, <dir>/build.json). A v1 log
//     (no hash) gets the files whose name matches the header's aircraft name, as candidates only;
//   - the FROM: the strip nearest the first HOLD / ROLL position (the aerodromes of the log's world - the same
//     W.aerodromes tools/_tour_lib.js tourWorld flies, read off island_node.islandWorld with the tour's premises
//     fixture, without the obstacles tourWorld registers), checked against the route the log declares; the TO (the
//     route's; a v1 log does not know it); the base;
//   - the DAY and its WIND (the 'flight' event's day spec; the 'wind' events), DAMAGE on / off and why, the PILOT (the
//     style, the profile, the persona; by hand or not);
//   - the take-offs as tools/analyze_log.js reads them (the heading drift, the controls), one line each;
//   - THE COMMAND LINES, printed: the node runs (tools/pilot_trace.js - the pilot alone over the island, with the
//     persona and the day's wind; tools/tour_real_node.js --game - the game's own flight, the worker's host, the day,
//     damage) and the page runs (tools/tour_real.js - the page on the GPU, the player's way; tools/rollout_perf.js - the
//     roll-out window, the route, ?damage and the day set before the page's first script). What each one cannot set
//     (pilot_trace has no damage switch; tour_real / tour_real_node fly the default pilot; tour_real keeps the page's
//     own day) is said beside it.
//   --flight N: the log's Nth flight (default: the one holding the first take-off; else the first)
//   --out <dir>: writes the files the commands name - build.json (the log's spec, when it carries one), day.json (the
//     day spec, for tour_real_node --day @), pre_day.js (the day as the page's pref, for rollout_perf --pre @). Without
//     it the commands name them under <dir> and nothing is written.
// Reads only: the log, builds/ and bugReports/, the world's files. node --check is its own gate (no GATE runs it).
'use strict';
const fs = require('fs'), path = require('path');
const AN = require('./analyze_log.js');
const T = __dirname, ROOT = path.join(T, '..');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const VAL = ['--flight', '--out'];
const FILE = argv.find((a, i) => !a.startsWith('--') && VAL.indexOf(argv[i - 1]) < 0);
if (!FILE) { console.error('usage: node tools/log_replay.js <flydiy-flightlog.json[.gz]> [--flight N] [--out <dir>]'); process.exit(2); }
const OUT = opt('out', null);

// the page's hash (app.js FLIGHT_REC probe flight(): FNV-1a 32 over the UTF-16 code units of JSON.stringify(spec))
function specHash(spec) {
  const j = JSON.stringify(spec);
  let h = 0x811c9dc5;
  for (let i = 0; i < j.length; i++) h = Math.imul(h ^ j.charCodeAt(i), 16777619) >>> 0;
  return { hash: ('0000000' + h.toString(16)).slice(-8), chars: j.length };
}
const R2D = 180 / Math.PI;
const num = x => typeof x === 'number' && x === x;
const f1 = x => (num(x) ? x.toFixed(1) : '-');
const q = s => (/^[\w./:@=,+-]+$/.test(s) ? s : '"' + String(s).replace(/(["\\$`])/g, '\\$1') + '"');   // a shell word
const rel = p => path.relative(path.join(ROOT, '..'), p).split(path.sep).join('/');   // from the repo root (the rigs' --root)

const log = AN.load(FILE), H = log.header || {};
const A = AN.analyze(log, {});
const L = [];
const say = s => L.push(s);
say('LOG REPLAY ' + (H.sid || path.basename(FILE)) + ' - format v' + (H.v || 1) + ', the page\'s build ' + (H.build || '?') + ' (core ' + (H.core || '?') + '), saved ' + (H.saved || '?'));
if ((H.v || 1) < 2) say('  a v1 log: no flight record, no flight columns - the start conditions below are INFERRED where they can be and UNKNOWN where not');

// ---- the flight -----------------------------------------------------------------------------------------------------
const flights = (A.flight && A.flight.flights) || [];
const TO = A.takeoffs || [];
let fl = null;
if (opt('flight', null) != null) fl = flights[+opt('flight') - 1] || null;
else if (flights.length) fl = (TO.length ? flights.filter(f => f.at <= TO[0].t).pop() : null) || flights[0];
if (!fl && H.flight) fl = H.flight;
say('  flights in the log: ' + flights.length + (fl ? '; replaying flight ' + (fl.n || '?') + (fl.at != null ? ' (begun at ' + (fl.at / 1000).toFixed(1) + ' s page time)' : ' (the header\'s)') : ''));

// ---- the world --------------------------------------------------------------------------------------------------------
const worldId = (fl && fl.world) || H.world || null;
say('');
say('WORLD ' + (worldId || 'unknown (the analytic world?)'));
let W = null, worldErr = null;
try {
  if (worldId && worldId !== 'none') {
    const IN = require(path.join(T, 'island_node.js'));
    const fx = path.join(T, 'fixtures', 'island_' + worldId + '.json');
    W = IN.islandWorld(worldId, { premises: fs.existsSync(fx) ? fs.readFileSync(fx, 'utf8') : null });
    if (!W) worldErr = 'src/core/world_packs.json names no island "' + worldId + '"';
  } else { const C = require(path.join(T, 'flight_core.js')); W = C.makeWorld(0, {}); }
} catch (e) { worldErr = String((e && e.message) || e).slice(0, 300); }
if (worldErr) say('  the world could not be composed here: ' + worldErr + ' - the From is not inferred');

// the strip nearest a point: the distance off its runway's centreline segment (hdg: rad from +x toward +z)
function nearest(x, z) {
  if (!W || !W.aerodromes) return null;
  let best = null;
  for (const a of W.aerodromes) {
    const ux = Math.cos(a.hdg || 0), uz = Math.sin(a.hdg || 0), dx = x - a.x, dz = z - a.z;
    const al = dx * ux + dz * uz, half = (a.len || 0) / 2, ac = Math.max(-half, Math.min(half, al));
    const d = Math.hypot(dx - ac * ux, dz - ac * uz);
    if (!best || d < best.d) best = { a, d, along: al };
  }
  return best;
}
const rwyDeg = a => ((a.hdg || 0) * R2D + 90 + 360) % 360;   // the strip's grid bearing (one way; the other + 180)

// ---- the route -----------------------------------------------------------------------------------------------------------
const rows = A.rows || [];
const startRow = rows.find(r => r.ap === 'HOLD' || r.ap === 'ROLL') || null;
const firstPh = (rows.find(r => r.ap) || {}).ap || null;
const near = startRow && num(startRow.x) ? nearest(startRow.x, startRow.z) : null;
const R = (fl && fl.route) || {};
say('');
say('ROUTE');
if (near) say('  the first HOLD / ROLL at x ' + f1(startRow.x) + ' z ' + f1(startRow.z) + ' (' + (startRow.t / 1000).toFixed(1) + ' s): the nearest strip ' + near.a.id + (near.a.name ? ' (' + near.a.name + ')' : '') +
  ', ' + near.d.toFixed(0) + ' m off its centreline, ' + near.along.toFixed(0) + ' m from its middle; runway ' + rwyDeg(near.a).toFixed(0) + ' / ' + ((rwyDeg(near.a) + 180) % 360).toFixed(0) + ' (grid)');
else say('  no HOLD / ROLL in the log' + (worldErr ? ' (and no world)' : '') + ': the From is not inferred');
if (fl && fl.route) say('  the log declares: from ' + (R.from || '?') + ' to ' + (R.to || '?') + ', base ' + (R.base || '?') + (R.spawn ? ', spawn ' + R.spawn : '') + (R.ap ? '; the pilot\'s route ' + R.ap.from + ' > ' + R.ap.to : ''));
const FROM = R.from || (near ? near.a.id : null);
if (R.from && near && near.a.id !== R.from) say('  NOTE: the declared From (' + R.from + ') is not the strip under the first HOLD / ROLL (' + near.a.id + ') - a Fly-on leg? the replay takes the declared one');
const TOID = R.to || null;
say('  => FROM ' + (FROM || 'UNKNOWN') + ', TO ' + (TOID || 'UNKNOWN (a v1 log: ask the user, or fly the circuit)') + (firstPh ? '; the log\'s first phase ' + firstPh + (firstPh === 'DEPART' || firstPh === 'TAXI' ? ' (off the stand: a taxi out first)' : '') : ''));

// ---- the build --------------------------------------------------------------------------------------------------------------
const B = (fl && fl.build) || {};
const acName = B.name || (H.aircraft && (H.aircraft.name || H.aircraft['p.name'])) || null;
say('');
say('BUILD ' + (acName || '?') + (B.hash ? ' (spec hash ' + B.hash + ', ' + B.chars + ' chars' + (B.v != null ? ', v' + B.v : '') + ')' : ' (no spec hash: a v1 log)') +
  (H.aircraft ? ' - ' + (H.aircraft.nodes || '?') + ' nodes, ' + (H.aircraft.massKg || '?') + ' kg' : ''));
const files = [];
for (const dir of ['builds', 'bugReports']) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!/\.json$/i.test(f)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')), spec = raw && raw.spec && typeof raw.spec === 'object' ? raw.spec : raw;
      if (!spec || typeof spec !== 'object' || !(spec.wings || spec.fuselage || spec.cage)) continue;
      const h = specHash(spec);
      files.push({ file: path.join(d, f), name: raw.name || (spec.meta && spec.meta.name) || null, hash: h.hash, chars: h.chars });
    } catch (e) {}
  }
}
const match = B.hash ? files.filter(x => x.hash === B.hash) : [];
const byName = acName ? files.filter(x => x.name && x.name.toLowerCase() === String(acName).toLowerCase()) : [];
let BUILD = null, buildWhy = '';
if (match.length) { BUILD = match[0].file; buildWhy = 'the hash matches ' + match.map(x => rel(x.file)).join(', '); }
else {
  if (B.hash) say('  no file in builds/ or bugReports/ hashes ' + B.hash + ' (' + files.length + ' builds hashed)');
  if (byName.length) say('  same NAME, ' + (B.hash ? 'another spec' : 'unverified (no hash)') + ': ' + byName.map(x => rel(x.file) + ' (' + x.hash + ')').join(', '));
  if (H.buildSpec) {
    const h = specHash(H.buildSpec);
    BUILD = path.join(OUT || '<dir>', 'build.json');
    buildWhy = 'the log\'s own spec (header.buildSpec, hash ' + h.hash + (B.hash && h.hash !== B.hash ? ' - NOT the flight\'s ' + B.hash + ': the spec changed between the flight\'s start and the save' : '') + ')';
    if (OUT) {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(BUILD, JSON.stringify({ what: 'flydiy-build', v: H.buildSpec.v != null ? H.buildSpec.v : null, name: acName, spec: H.buildSpec, plaque: null, log: null, from: 'log_replay ' + (H.sid || '') }, null, 1));
    }
  } else if (byName.length) { BUILD = byName[0].file; buildWhy = 'a candidate by name only - UNVERIFIED'; }
}
say('  => ' + (BUILD ? (String(BUILD).startsWith('<') ? String(BUILD).split(path.sep).join('/') : rel(path.resolve(BUILD))) + ' (' + buildWhy + ')' + (H.buildSpec && !match.length && !OUT ? ' - --out <dir> writes it' : '') : 'NO BUILD FILE: the log carries no spec and no file matches - ask the user for theirs (the garage\'s export)'));
if (BUILD) say('  (the page flew the spec as loaded - pilot_trace / tour_real_node load a file through tools/_load_build.js gameSpec, the page\'s load door; FLYDIY_RAW_BUILDS=1 flies it as written)');

// ---- the day, damage, the pilot -----------------------------------------------------------------------------------------------
const day = fl && fl.day ? fl.day : null, wind = day ? day.wind || null : null;
const winds = (A.flight && A.flight.winds) || [];
say('');
say('DAY ' + (day ? (day.date || '?') + ' utc ' + (num(day.utc) ? (day.utc / 3600).toFixed(2) + ' h' : '?') + ', wind ' + (wind ? JSON.stringify(wind) : 'calm (none declared)') + (day.cloudType ? ', clouds ' + day.cloudType + ' ' + day.cloudCover : '') : 'UNKNOWN (no flight record) - the game\'s first day is 8 kt from 250, gust 0.15 (day_clock.js GAME_WIND), unless the player set another'));
if (winds.length) say('  the day\'s wind in the log: ' + winds.map(w => (w.at / 1000).toFixed(1) + ' s ' + (w.kts != null ? (+w.kts).toFixed(1) : '?') + ' kt from ' + w.dirDeg + (w.gust ? ' gust ' + w.gust : '')).join('; '));
if (!day) { const sk = (log.events || []).find(e => e[1] === 'sky' && e[3] && e[3].day); if (sk) say('  (the sky event saw the day\'s clouds ' + sk[3].day.cloudType + ' ' + sk[3].day.cloudCover + ' - not the game\'s first day: the player had set a day of their own)'); }
const D = (fl && fl.damage) || null;
let damageOn = D ? !!D.on : null, damageWhy = D ? (D.param != null ? 'the build\'s params.damage' : D.url != null ? 'the page\'s ?damage=' + (D.url ? 1 : 0) : 'GEN_DAMAGE_DEFAULT') : '';
if (!D) {
  const m = /[?&]damage=([01])/.exec(H.url || '');
  if (m) { damageOn = m[1] === '1'; damageWhy = 'the page\'s url ' + H.url; }
  else { try { const src = fs.readFileSync(path.join(ROOT, 'src', 'core', '60_gen_spec.js'), 'utf8'), d = /const GEN_DAMAGE_DEFAULT = (true|false)/.exec(src); if (d) { damageOn = d[1] === 'true'; damageWhy = 'GEN_DAMAGE_DEFAULT in THIS tree (the log\'s build ' + (H.build || '?') + ' may differ; a build\'s own params.damage would win)'; } } catch (e) {} }
}
say('DAMAGE ' + (damageOn == null ? 'unknown' : damageOn ? 'ON' : 'off') + (damageWhy ? ' (' + damageWhy + ')' : ''));
const P = (fl && fl.pilot) || null;
const pilotCodes = (H.codes && H.codes.pilot) || [];
const profile = P ? P.profile || 'expert' : (pilotCodes.filter(Boolean)[0] || null);
const style = P ? P.style || 'normal' : null;
say('PILOT ' + (P ? (style + ' / ' + profile + (P.persona && P.persona !== profile ? ' (persona ' + P.persona + ')' : '') + (P.career ? ', the career\'s crew' : '') + (P.manual ? ', BY HAND at the start' : '') + (P.custom ? ', custom ' + JSON.stringify(P.custom) : ''))
  : profile ? 'profile ' + profile + ' (the frames\' pilot code)' : 'UNKNOWN (a v1 log) - the expert unless the player picked another'));
const manualTO = TO.some(o => o.rows && o.rows.some(r => (r.flags | 0) & 8));
if (manualTO) say('  a take-off frame was flown BY HAND: a replay flies the pilot, not the hand');

// ---- the take-offs ----------------------------------------------------------------------------------------------------------
say('');
say('TAKE-OFFS ' + TO.length + ' (node tools/analyze_log.js ' + q(FILE) + ' --flight for the whole reading)');
TO.forEach((o, k) => {
  const n = num(o.x) ? nearest(o.x, o.z) : null, lo = o.liftoffPilot || o.wheelsOff, ra = o.roll, ai = o.air;
  say('  #' + (k + 1) + ' at ' + (o.t / 1000).toFixed(1) + ' s' + (n ? ' on ' + n.a.id : '') + ', heading ' + f1(o.ref) + ': ' + (lo ? 'lift-off at ' + f1(lo.T) + ' s, ' + f1(lo.spd) + ' m/s' : 'no lift-off') +
    ', the roll\'s heading most off ' + (ra.dh ? f1(ra.dh.v) : '-') + ' deg' + (ai && ai.dh ? ', after the lift-off ' + f1(ai.dh.v) + ' deg' : '') +
    (ai && ai.ctl && ai.ctl.rud ? ', rudder ' + ai.ctl.rud.min.toFixed(2) + '..' + ai.ctl.rud.max.toFixed(2) : '') + (o.end.backOn ? ', BACK ON THE RUNWAY' : '') + (o.end.after ? ', then ' + o.end.after : ''));
});

// ---- the commands -------------------------------------------------------------------------------------------------------------
const dir = OUT || '<dir>';
const placeholder = p => String(p).startsWith('<');
const buildArg = BUILD ? (placeholder(BUILD) ? String(BUILD) : path.resolve(BUILD)).split(path.sep).join('/') : '<the build.json>';
const fromA = FROM || '<FROM>', circuit = !TOID || TOID === 'CIRCUIT' || TOID === FROM;
const toA = circuit ? fromA : TOID;
const dayFile = path.join(dir, 'day.json'), preFile = path.join(dir, 'pre_day.js');
if (OUT && day) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(dayFile, JSON.stringify(day, null, 1));
  fs.writeFileSync(preFile, '// log_replay.js (G3322): the log\'s day as the page\'s own pref (day_clock.js flydiy.day.v3), before its first script\ntry { localStorage.setItem(\'flydiy.day.v3\', ' + JSON.stringify(JSON.stringify(day)) + '); } catch (e) {}\n');
}
const fwd = p => String(p).split(path.sep).join('/');
const stand = firstPh === 'DEPART' || firstPh === 'TAXI';
// the start of the first take-off since the reveal: how long a page run must record
const toT = TO.length && A.revealT != null ? Math.max(0, (TO[0].t - A.revealT) / 1000) : null;
const secs = toT != null ? Math.ceil(toT + 40) : 150;
const W2 = wind ? [wind.kts != null ? wind.kts : wind.mps != null ? +(wind.mps * 1.943844).toFixed(2) : 0, wind.dirDeg || 0, wind.gust || 0].concat(wind.breeze ? [wind.breeze] : []) : null;
say('');
say('THE COMMANDS (printed, not run: a heavy node job takes the CPU lock, a page run the GPU lock - bash tools/perf/boxlock.sh take cpu|gpu <who> "<what>")');
say('  # the pilot alone, over ' + (worldId || 'the world') + ' (tools/pilot_trace.js: --profile / --style / the day\'s wind; it has NO damage switch - GEN_DAMAGE_DEFAULT applies' + (damageOn ? ', the log flew damage ON: see tour_real_node' : '') + ')');
say('  node flyDiy/tools/pilot_trace.js ' + q(buildArg) + (worldId && worldId !== 'none' ? ' --world ' + worldId : '') + ' --from ' + fromA + (circuit ? '' : ' --to ' + toA) + (stand ? ' --stand' : '') +
  (style ? ' --style ' + style : '') + (P && P.custom ? ' --profile ' + q(JSON.stringify(Object.assign({ name: 'custom', active: true }, P.custom))) : profile ? ' --profile ' + profile : '') +
  (W2 ? ' --day-wind ' + W2.join(',') : '') + (day && day.date ? ' --date ' + day.date : '') + (day && num(day.utc) ? ' --utc ' + String(Math.floor(day.utc / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(day.utc / 60) % 60).padStart(2, '0') : '') +
  ' --csv ' + q(fwd(path.join(dir, 'pilot_trace.csv'))));
say('  # the game\'s own flight in node (tools/tour_real_node.js --game: the worker\'s host, its placement off the stand, the day ticked, damage; the DEFAULT pilot - no persona)');
say('  node flyDiy/tools/tour_real_node.js --game --build ' + q(buildArg) + ' --order ' + fromA + ',' + toA + ' --legs 1 --damage ' + (damageOn ? 1 : 0) +
  (day ? ' --day @' + fwd(dayFile) : ' --calm') + ' --out ' + q(fwd(path.join(dir, 'node_tour.json'))) + (worldId && worldId !== 'jolene' ? '   # NOTE: tour_real_node flies Jolene (the tour fixture), the log flew ' + worldId : ''));
say('  # the page on the GPU, the player\'s way (tools/tour_real.js: the WIP build, ?damage, the route pref; the page\'s own day and the default pilot)');
say('  node flyDiy/tools/tour_real.js --build ' + q(buildArg) + ' --order ' + fromA + ',' + toA + ' --legs 1 --damage ' + (damageOn ? 1 : 0) + ' --rate 1 --out ' + q(fwd(path.join(dir, 'tour_real'))));
say('  # the roll-out window on the GPU (tools/rollout_perf.js: the route pickers\' pref, ?damage, the day before the first script)');
say('  node flyDiy/tools/rollout_perf.js --build ' + q(buildArg) + (worldId ? ' --world ' + worldId : '') + ' --from ' + fromA + ' --dest ' + (circuit ? 'CIRCUIT' : toA) +
  ' --q ' + q('damage=' + (damageOn ? 1 : 0)) + (day ? ' --pre @' + fwd(preFile) : '') + ' --secs ' + secs + ' --label ' + q('replay_' + String(H.sid || 'log').replace(/\W+/g, '')) +
  (H.gfx ? ' --gfx ' + q(JSON.stringify(H.gfx)) : ''));   // (the player's graphics pref as the header has it, flydiy.gfx)
if (!OUT && (day || (H.buildSpec && !match.length))) say('  (' + [day ? 'day.json / pre_day.js' : null, H.buildSpec && !match.length ? 'build.json' : null].filter(Boolean).join(', ') + ': --out <dir> writes them)');
if (P && P.profile && P.profile !== 'expert') say('  NOTE: the log\'s pilot was ' + P.profile + ' - only pilot_trace flies a persona; the game runs (tour_real_node, tour_real, rollout_perf) fly the default unless the player document says otherwise');
console.log(L.join('\n'));
