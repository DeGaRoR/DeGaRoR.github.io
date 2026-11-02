#!/usr/bin/env node
// GATE CANDIDATES - CANDIDATE OFFICIAL (the user, 2 Nov: "a staging area so I can see the plane designs constructed, yet
// not validated ... all my planes available in one place, not depending on the local storage of the machine").
//
//   node tools/_candidates_check.js              -> "GATE CANDIDATES: PASS|FAIL"
//   node tools/_candidates_check.js --static     the pool and the source rows only (no load chain, ~1 s)
//   node tools/_candidates_check.js --selftest   + a doctored pool and doctored sources, each must go red
//
// THE POOL (builds/candidates/index.json): it parses, names files that exist in the folder (the user's own file names,
// nothing invented: a plain name - letters, digits, space, . _ - ( ) - no path; the user's 'flydiy-build (3).json' kept), every .json in the folder is named by it (no orphan the game cannot reach),
// every file is a build (an envelope with a spec), and none claims a certificate (no plaque).
// THE REVIEW FOLDER (builds/candidates/review/, the user 2 Nov: "I need to review them first"): the planes found in the
// repo, NOT offered - none in the index (and the page's plain-name rule cannot reach a sub-folder) - each a build with no
// plaque and a row in review/REVIEW.md. The load chain runs on them too, reported, never red (a review plane that fails to
// load is named for READY, the user decides).
// EVERY CANDIDATE LOADS, BUILDS AND DRAWS: the page's own load door headless (tools/_load_build.js: the editor's layers
// draw it, the join measures it, the energy layer fits the tanks) with no join error, then buildGen on what it made: a
// finite positive mass, a wing, an engine or none asked for.
// THE PAGE (source rows): garage.js reads the pool from the repo folder (never localStorage), opens a candidate unnamed
// with no plaque, draws the rack's 'candidate official' group, and writes EXPORT ALL as one flydiy-fleet file; the ribbon
// carries the button; the design flow's new-aeroplane cards list the pool; nothing in the core (the career catalogue,
// the contracts, the story) names the pool.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const DIR = path.join(ROOT, 'builds', 'candidates');
const argv = process.argv.slice(2);
const STATIC = argv.includes('--static'), SELF = argv.includes('--selftest');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---- the pool, as files -----------------------------------------------------------------------------------------------
function poolRows(P) {
  const bad = [], ok = [];
  let idx = null;
  try { idx = JSON.parse(P.index); } catch (e) { bad.push('index.json does not parse: ' + e.message); return { bad, ok, list: [] }; }
  if (!idx || idx.what !== 'flydiy-candidates' || !Array.isArray(idx.planes) || !idx.planes.length)
    { bad.push('index.json is not a flydiy-candidates list with planes'); return { bad, ok, list: [] }; }
  const seen = new Set();
  for (const p of idx.planes) {
    const f = p && p.file;
    if (typeof f !== 'string' || !/^[\w .()-]+\.json$/.test(f) || f === 'index.json') { bad.push('a plane names no plain .json file: ' + JSON.stringify(p)); continue; }
    if (seen.has(f)) bad.push(f + ' is listed twice');
    seen.add(f);
    if (!p.name) bad.push(f + ' has no name for the rack');
    const txt = P.files[f];
    if (txt == null) { bad.push(f + ' is listed but not in builds/candidates/'); continue; }
    let o = null; try { o = JSON.parse(txt); } catch (e) { bad.push(f + ' does not parse'); continue; }
    if (!o || !o.spec || typeof o.spec !== 'object' || !(o.spec.cage || o.spec.wings)) { bad.push(f + ' is not a build (no spec)'); continue; }
    if (o.plaque) bad.push(f + ' carries a plaque - a candidate claims no certificate');
    ok.push(f);
  }
  for (const f of Object.keys(P.files)) if (!seen.has(f)) bad.push(f + ' is in builds/candidates/ but not in index.json (the game cannot reach it)');
  return { bad, ok, list: idx.planes };
}
function reviewRows(R, index) {
  const bad = [];
  let idx = null; try { idx = JSON.parse(index); } catch (e) { return bad; }
  const listed = new Set(((idx && idx.planes) || []).map(p => p && p.file));
  for (const f of Object.keys(R.files)) {
    if (listed.has(f) || listed.has('review/' + f)) bad.push('review/' + f + ' is in index.json - a review plane is not offered');
    let o = null; try { o = JSON.parse(R.files[f]); } catch (e) { bad.push('review/' + f + ' does not parse'); continue; }
    if (!o || !o.spec || typeof o.spec !== 'object') bad.push('review/' + f + ' is not a build (no spec)');
    else if (o.plaque) bad.push('review/' + f + ' carries a plaque');
    if (R.md.indexOf('| ' + f + ' |') < 0) bad.push('review/' + f + ' has no row in review/REVIEW.md');
  }
  for (const p of ((idx && idx.planes) || [])) if (p && typeof p.file === 'string' && /review/i.test(p.file)) bad.push('index.json names a review path: ' + p.file);
  return bad;
}
function reviewNow() {
  const RD = path.join(DIR, 'review'), files = {};
  if (!fs.existsSync(RD)) return { files, md: '' };
  for (const f of fs.readdirSync(RD)) if (/\.json$/.test(f)) files[f] = fs.readFileSync(path.join(RD, f), 'utf8');
  let md = ''; try { md = fs.readFileSync(path.join(RD, 'REVIEW.md'), 'utf8'); } catch (e) {}
  return { files, md };
}
function poolNow() {
  const files = {};
  for (const f of fs.readdirSync(DIR)) if (/\.json$/.test(f) && f !== 'index.json') files[f] = fs.readFileSync(path.join(DIR, f), 'utf8');
  return { index: fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'), files };
}

// ---- the page's source ------------------------------------------------------------------------------------------------
function sourceRows(S) {
  const bad = [];
  const need = (src, re, what) => { if (!re.test(S[src])) bad.push(src + ': ' + what); };
  need('garage', /const CAND_DIR = 'builds\/candidates\/'/, 'the pool is read from builds/candidates/');
  need('garage', /fetch\(CAND_DIR \+ 'index\.json'\)/, 'the index is fetched from the repo folder');
  need('garage', /const loadCandidate = c => fetch\(CAND_DIR \+ encodeURIComponent\(c\.file\)\)[\s\S]{0,200}?loadSpec\(g\.spec, ''\)/,
    'a candidate opens unnamed, with no plaque and an empty log (loadSpec(spec, ""))');
  need('garage', /gfGroupH gfCandH">candidate official/, "the rack's 'candidate official' group");
  need('garage', /candidates\(\)\.then\(list =>[\s\S]{0,600}?loadCandidate\(c\)/, "the rack's rows open the candidate");
  need('garage', /what: 'flydiy-fleet'/, 'EXPORT ALL writes one flydiy-fleet file');
  need('garage', /\$\('gExportAll'\)\.addEventListener\('click', exportAllFile\)/, 'the ribbon button is wired');
  need('garage', /candidates, openCandidate: loadCandidate, exportAll: exportAllFile/, 'GARAGE_SPEC carries the pool');
  need('body', /<button id="gExportAll"/, 'the ribbon carries "export all"');
  need('flow', /dfKindH dfCandH[\s\S]{0,900}?g\.openCandidate\(c\)/, "the new-aeroplane cards list the pool and open it");
  if (/localStorage[^\n]*candidates|candidates[^\n]*localStorage/.test(S.garage)) bad.push('garage: the pool must not live in localStorage');
  if (/builds\/candidates/.test(S.core)) bad.push('core: the career catalogue / contracts / story must not name the pool');
  return bad;
}
function sourcesNow() {
  const core = fs.readdirSync(path.join(ROOT, 'src', 'core')).filter(f => /\.js$/.test(f))
    .map(f => fs.readFileSync(path.join(ROOT, 'src', 'core', f), 'utf8')).join('\n');
  return { garage: read('src/viewer/garage.js'), flow: read('src/viewer/design_flow.js'), body: read('src/viewer/body.html'), core };
}

// ---- every candidate loads, builds and draws ----------------------------------------------------------------------
function chainRows(files, sub) {
  const bad = [];
  const LB = require('./_load_build.js'), C = require('./flight_core.js');
  for (const f of files) {
    const t0 = Date.now();
    let L = null;
    try { L = LB.loadBuild(path.join('builds', 'candidates', sub || '', f)); }
    catch (e) { bad.push(f + ': the page load chain failed - ' + String(e.message || e).slice(0, 300)); continue; }
    if (L.errors && L.errors.length) bad.push(f + ': join errors ' + JSON.stringify(L.errors).slice(0, 300));
    let def = null;
    try { def = C.buildGen(JSON.parse(JSON.stringify(L.spec))); }
    catch (e) { bad.push(f + ': buildGen threw - ' + String(e.message || e).slice(0, 200)); continue; }
    let m = 0; for (const n of (def.nodes || [])) m += n.m;
    const S = def.spec || {}, g = S.geom || {};
    const area = +(g.Sw || g.wingArea || g.S || 0);
    const eng = (L.spec.engines || []).length;
    if (!(isFinite(m) && m > 0)) bad.push(f + ': built mass ' + m);
    if (!(def.nodes && def.nodes.length)) bad.push(f + ': built no nodes');
    console.log('  ' + f + ': loaded (' + (L.cached ? 'cached' : 'chain') + ', join errors ' + (L.errors || []).length + '), built ' +
      (def.nodes || []).length + ' nodes, ' + m.toFixed(0) + ' kg' + (area ? ', wing ' + area.toFixed(1) + ' m2' : '') +
      ', ' + eng + ' engine(s) (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  }
  return bad;
}

// ---- run ---------------------------------------------------------------------------------------------------------------
const P = poolNow(), S = sourcesNow(), R = reviewNow();
const pr = poolRows(P);
const bad = pr.bad.concat(sourceRows(S), reviewRows(R, P.index));
console.log('GATE CANDIDATES - the pool: ' + pr.list.length + ' planes offered, ' + pr.ok.length + ' read as builds; review/: ' +
  Object.keys(R.files).length + ' planes (not offered)');
if (!STATIC && !pr.bad.length) {
  bad.push(...chainRows(pr.ok));
  console.log('  review/ (reported, never red):');
  for (const b of chainRows(Object.keys(R.files), 'review')) console.log('  REVIEW ' + b);
} else if (STATIC) console.log('  (--static: the load chain not run)');

if (SELF) {
  const red = (what, fn) => { const r = fn(); console.log('  selftest ' + what + ': ' + (r.length ? 'red (ok)' : 'GREEN - the check is inert')); if (!r.length) bad.push('selftest inert: ' + what); };
  const first = Object.keys(P.files)[0];
  red('a listed file missing', () => { const Q = { index: P.index, files: Object.assign({}, P.files) }; delete Q.files[first]; return poolRows(Q).bad; });
  red('an orphan file', () => poolRows({ index: P.index, files: Object.assign({ 'stray.json': P.files[first] }, P.files) }).bad);
  red('a plaque', () => { const o = JSON.parse(P.files[first]); o.plaque = { ok: true }; return poolRows({ index: P.index, files: Object.assign({}, P.files, { [first]: JSON.stringify(o) }) }).bad; });
  red('not a build', () => poolRows({ index: P.index, files: Object.assign({}, P.files, { [first]: '{"what":"x"}' }) }).bad);
  red('a path in the index', () => { const o = JSON.parse(P.index); o.planes[0].file = '../' + o.planes[0].file; return poolRows({ index: JSON.stringify(o), files: P.files }).bad; });
  red('the candidate opened with its plaque', () => sourceRows(Object.assign({}, S, { garage: S.garage.replace("loadSpec(g.spec, '')", 'loadSpec(g.spec, c.name, g.plaque, g.log)') })));
  red('the rack group gone', () => sourceRows(Object.assign({}, S, { garage: S.garage.replace('gfGroupH gfCandH">candidate official', 'gfGroupH">') })));
  red('the core names the pool', () => sourceRows(Object.assign({}, S, { core: S.core + "\nconst X = 'builds/candidates/a.json';" })));
  red('a review plane offered', () => { const o = JSON.parse(P.index); o.planes.push({ file: Object.keys(R.files)[0], name: 'x' }); return reviewRows(R, JSON.stringify(o)); });
  red('a review plane with no REVIEW.md row', () => reviewRows({ files: R.files, md: '' }, P.index));
  red('no export all button', () => sourceRows(Object.assign({}, S, { body: S.body.replace('<button id="gExportAll"', '<button id="gX"') })));
}

for (const b of bad) console.log('  FAIL ' + b);
console.log('GATE CANDIDATES: ' + (bad.length ? 'FAIL' : 'PASS'));
process.exit(bad.length ? 1 : 0);
