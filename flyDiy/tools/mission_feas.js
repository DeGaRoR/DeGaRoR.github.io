#!/usr/bin/env node
// mission_feas.js - MISSION-FEASIBILITY's runner: every mission of the packs (src/missions/*.json) judged and FLOWN the way
// the game flies it (tools/mission_feas_lib.js says how - the stand, the taxi, the take-off, the landing, the taxi in, the
// load, the career's stop), one row each: feasible / infeasible (why) / broken (why) / listing, the plane, the time flown.
//
//   node tools/mission_feas.js                       every mission, one process (hours: shard it)
//   node tools/mission_feas.js --shard=i/n           this shard's missions (round-robin over the sorted list) -> shards/
//   node tools/mission_feas.js --merge               the shards' JSON -> feasibility.json + feasibility.md (the page's JSON)
//   node tools/mission_feas.js --only=field.01,demo.photo   those missions only
//   node tools/mission_feas.js --static              the static read and the plane choice, nothing flown (~1 min)
//   node tools/mission_feas.js --only=<ids> --rerun  those missions again -> reruns/ (--merge puts them over the shards' rows)
//   options: --packs=<dir> (default src/missions)  --out=<dir> (default reports/MISSION-FEASIBILITY)  --tries=N (planes
//            tried per mission, default 2)  --tmax=<s> (a flight's limit, default 3600)  --quiet
// Deterministic: the same tree gives the same table; every mission gets a fresh world, career, sim and pilot, so a shard's
// rows do not depend on which missions it shares a process with.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(ROOT, opt('out', 'reports/MISSION-FEASIBILITY'));
const SHD = require('./_shard.js');

function rowsOf(F, packsDir) {
  const packs = F.readPacks(packsDir);
  const list = [];
  for (const P of packs) for (const m of P.pack.missions || []) list.push({ P, m });
  list.sort((a, b) => (a.P.file + '|' + a.m.id) < (b.P.file + '|' + b.m.id) ? -1 : 1);
  return list;
}

function merge() {
  const dir = path.join(OUT, 'shards');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^feas_.*\.json$/.test(f)).sort() : [];
  const rows = [], meta = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); rows.push(...j.rows); meta.push({ file: f, shard: j.shard, n: j.rows.length, wallS: j.wallS }); }
  // RE-RUNS (--only=... --rerun): a later run of some missions on the current harness replaces their shard rows
  const rr = path.join(OUT, 'reruns'), reruns = [];
  if (fs.existsSync(rr)) for (const f of fs.readdirSync(rr).filter(f => /\.json$/.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(rr, f), 'utf8'));
    for (const R of j.rows) { const i = rows.findIndex(x => x.pack === R.pack && x.id === R.id); if (i >= 0) rows[i] = R; else rows.push(R); reruns.push(R.id); }
  }
  rows.sort((a, b) => (a.pack + '|' + a.id) < (b.pack + '|' + b.id) ? -1 : 1);
  return write(rows, { shards: meta, reruns });
}
function summary(rows) {
  const by = {};
  for (const R of rows) by[R.verdict] = (by[R.verdict] || 0) + 1;
  return by;
}
// a mission no plane completed: every plane's own reason, in the order tried
function whyAll(R) {
  if (R.verdict === 'feasible' || !R.attempts || R.attempts.length < 2) return R;
  return Object.assign({}, R, { why: R.attempts.map(A => A.plane + ': ' + (A.verdict === R.verdict ? '' : A.verdict + ' - ') + (A.why || '')).join(' | ') });
}
function write(rows, extra) {
  const F = require('./mission_feas_lib.js');
  rows = rows.map(R => whyAll(F.finalize(R)));
  fs.mkdirSync(OUT, { recursive: true });
  const sum = summary(rows);
  const doc = Object.assign({ what: 'flydiy-mission-feasibility', v: 1, built: null, summary: sum, totalFlownS: Math.round(rows.reduce((a, R) => a + (R.timeS || 0), 0)), rows }, extra || {});
  fs.writeFileSync(path.join(OUT, 'feasibility.json'), JSON.stringify(doc, null, 1) + '\n');
  const md = ['# Mission feasibility', '', 'tools/mission_feas.js - every mission flown the way the game flies it (the stand, the taxi, the take-off, the landing, the taxi in, the load, the career stop).', '',
    'Summary: ' + Object.keys(sum).sort().map(k => k + ' ' + sum[k]).join(', ') + '; time flown ' + F.fmtT(doc.totalFlownS), '', F.mdTable(rows), ''];
  // the flights, per mission
  md.push('## The flights', '');
  for (const R of rows) {
    if (!R.attempts || !R.attempts.length) continue;
    md.push('### ' + R.id + ' (' + R.verdict + ')', '');
    for (const A of R.attempts) {
      md.push('- ' + A.plane + ': ' + A.verdict + (A.why ? ' - ' + A.why : '') + (A.placed ? ' (rolled out from the stand at ' + A.placed.stand.x + ', ' + A.placed.stand.z + ', ' + A.placed.mass + ' kg, ' + A.placed.fuel + ' L, day ' + A.placed.day.date + ')' : ''));
      for (const L of A.legs) md.push('  - `' + F.legLine(L) + '`');
    }
    md.push('');
  }
  fs.writeFileSync(path.join(OUT, 'feasibility.md'), md.join('\n'));
  console.log('wrote ' + path.relative(ROOT, path.join(OUT, 'feasibility.json')) + ' + .md: ' + rows.length + ' missions; ' + JSON.stringify(sum));
  return doc;
}

function main() {
  if (has('merge')) return merge();
  const F = require('./mission_feas_lib.js');
  const t0 = Date.now();
  const only = opt('only', null) ? opt('only').split(',') : null;
  let list = rowsOf(F, opt('packs', null) ? path.resolve(ROOT, opt('packs')) : null);
  if (only) list = list.filter(x => only.includes(x.m.id));
  const mine = SHD.shardOf(list);
  for (let i = 0; i < list.length; i++) SHD.take();   // the partition line (every shard counts the same K)
  const spots = F.spotsPack();
  const rows = [];
  const quiet = has('quiet');
  for (const { P, m } of mine) {
    const t1 = Date.now();
    const env = Object.assign(F.makeEnv(), { spots });
    let R;
    if (has('static')) {
      R = F.judgeMission(env, P, m, { tries: 0, staticOnly: true, fly: false, log: null, tmax: null, maxFlights: 0, dry: true });
    } else {
      R = F.judgeMission(env, P, m, { tries: +opt('tries', 2), tMax: +opt('tmax', 3600), log: quiet ? null : L => console.log('      ' + F.legLine(L)) });
    }
    R.wallS = Math.round((Date.now() - t1) / 1000);
    rows.push(R);
    console.log((R.verdict || '?').toUpperCase().padEnd(11) + ' ' + (P.file.replace(/^src\/missions\//, '') + ' ' + m.id).padEnd(32) + ' ' + (R.plane || '-').padEnd(26) + ' ' + F.fmtT(R.timeS).padStart(14) + '  ' + (R.why || '').slice(0, 300) + SHD.tag);
  }
  const tag = SHD.S ? SHD.S.i + 'of' + SHD.S.n : 'all';
  const res = { what: 'flydiy-mission-feasibility-shard', shard: SHD.S || null, only, wallS: Math.round((Date.now() - t0) / 1000), rows };
  if (!has('static') && !only) {
    fs.mkdirSync(path.join(OUT, 'shards'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'shards', 'feas_' + tag + '.json'), JSON.stringify(res, null, 1) + '\n');
    if (!SHD.S) write(rows);
  } else if (has('rerun') && only) {
    fs.mkdirSync(path.join(OUT, 'reruns'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'reruns', 'rerun_' + only.join('+') + '.json'), JSON.stringify(res, null, 1) + '\n');
  } else if (opt('json', null)) fs.writeFileSync(path.resolve(opt('json')), JSON.stringify(res, null, 1) + '\n');
  return res;
}
if (require.main === module) main();
module.exports = { main, merge, write };
