#!/usr/bin/env node
// story_feas.js - THE STORY PACK'S FEASIBILITY TABLE, KEPT ROW BY ROW (STORY-REVAMP, 22 Nov 2026). The user (13 Nov):
// "reasonably tested so that when I start playing I have fun and I'm not just fixing bugs"; the brief: "every mission's
// feasibility flown on node".
// tools/mission_feas.js flies a mission the game's way at about the game's own speed: the whole pack is tens of hours of
// one core. So the table is KEPT: one row a mission, written the moment its flights end, keyed by the mission's own record
// - a mission that changes is stale until it is flown again, the others keep their row.
//   node tools/story_feas.js --fly [--workers=3] [--max=N] [--only=a,b [--again]]   fly the missions that have no current row, one
//                             a process (mission_feas.js --only=<id> --rerun), the new project and club missions first;
//                             a mission no validated design can fly is flown with the WIDER pool (--official)
//   node tools/story_feas.js --table     the rows -> reports/STORY-REVAMP/feasibility.json + .md (structure: verdicts, the
//                             plane, the time flown, the legs' ends - no words of the missions)
//   node tools/story_feas.js --check     every mission of the pack: a current row and feasible, or one of the named
//                             classes (an aircraft order; a delivery no official plane can fly); prints what is missing.
//                             Exit 1 while a mission is not flown, stale, broken or infeasible outside those classes
//   options: --rows=<dir> (default reports/STORY-REVAMP/feasibility)  --quiet
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = k => argv.includes('--' + k);
const ROWS = path.resolve(ROOT, opt('rows', 'reports/STORY-REVAMP/feasibility'));
const PACK = path.join(ROOT, 'src', 'missions', 'story.json');

// THE ORDER: what a new career meets first and what is new in the pack, one of each kind of flight first
const FIRST = ['home.01', 'hangar.01', 'community.01', 'club.stol', 'club.pylons', 'home.03', 'home.08', 'mine.04', 'club.spot', 'obs.01', 'club.regular', 'lumber.01',
  'club.breakfast', 'community.02', 'hangar.05', 'obs.05', 'club.tour', 'field.hike', 'field.ridge', 'home.05', 'home.09', 'skyline.03', 'booze.02', 'obs.03',
  'heritage.01', 'community.06', 'mine.03', 'lumber.04', 'home.12', 'field.round', 'field.cannery', 'hangar.02', 'resort.guests', 'mine.tour', 'community.08'];

function load() {
  const C = require(path.join(T, 'flight_core.js'));
  const SP = JSON.parse(fs.readFileSync(PACK, 'utf8'));
  const use = C.missionPackUse(SP);
  if (!use.ok) throw new Error('the story pack is refused: ' + use.why);
  const A = C.contractAuthored(), N = C.missionPackNormalise(SP);
  const step = {}; for (const q of N.projects) q.steps.forEach((s, k) => { for (const m of s.missions) step[m] = q.id + ':' + (k + 1); });
  const list = N.missions.filter(m => m.tutorial == null).map(m => {
    const rec = A[m.id], subs = C.contractSubsOf(rec).filter(s => s.do !== 'deliver' && s.do !== 'accept');
    const key = crypto.createHash('sha256').update(JSON.stringify(rec)).digest('hex').slice(0, 12);
    return { id: m.id, key, kind: rec.kind, where: step[m.id] || 'contract', order: rec.kind === 'build', validated: rec.kind !== 'build' && C.contractDoers(subs).length > 0 };
  });
  return { C, SP, list };
}
const rowFile = id => path.join(ROWS, id + '.json');
const rowOf = id => { try { return JSON.parse(fs.readFileSync(rowFile(id), 'utf8')); } catch (e) { return null; } };
const current = m => { const r = rowOf(m.id); return r && r.key === m.key ? r : null; };

async function fly() {
  const { list } = load();
  const only = opt('only', null) ? opt('only').split(',') : null, max = +opt('max', 1e9), workers = Math.max(1, +opt('workers', 3));
  // --again (with --only): fly the named missions even when their row is current - a row is keyed by the mission's record,
  // and a change of the HARNESS (how a kind of mission is flown) leaves the key as it was
  let todo = list.filter(m => (!current(m) || (only && has('again'))) && (!only || only.includes(m.id)));
  todo.sort((a, b) => { const ia = FIRST.indexOf(a.id), ib = FIRST.indexOf(b.id); return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib); });
  todo = todo.slice(0, max);
  console.log('story_feas: ' + todo.length + ' mission(s) to fly of ' + list.length + ' (' + (list.length - list.filter(m => !current(m)).length) + ' rows current), ' + workers + ' at a time');
  const packs = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy-storyfeas-packs-'));
  fs.copyFileSync(PACK, path.join(packs, 'story.json'));
  fs.mkdirSync(ROWS, { recursive: true });
  let next = 0, done = 0;
  const one = () => new Promise(res => {
    const m = todo[next++];
    if (!m) return res(false);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy-storyfeas-out-')), t0 = Date.now();
    const args = [path.join(T, 'mission_feas.js'), '--only=' + m.id, '--rerun', '--packs=' + packs, '--out=' + out, '--quiet', '--tries=' + opt('tries', '2')];
    if (!m.validated && !m.order) args.push('--official');
    const ch = cp.spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = ''; ch.stderr.on('data', d => { err += d; }); ch.stdout.on('data', () => {});
    ch.on('close', code => {
      let R = null;
      try { R = JSON.parse(fs.readFileSync(path.join(out, 'reruns', 'rerun_' + m.id + '.json'), 'utf8')).rows.find(x => x.id === m.id); } catch (e) { R = null; }
      const row = R ? slim(R) : { id: m.id, verdict: 'broken', why: 'the rig ended with no row (exit ' + code + '): ' + err.slice(-300) };
      Object.assign(row, { key: m.key, where: m.where, pool: !m.validated && !m.order ? 'official' : 'validated', wallS: Math.round((Date.now() - t0) / 1000) });
      fs.writeFileSync(rowFile(m.id), JSON.stringify(row, null, 1) + '\n');
      done++;
      console.log('  ' + String(done).padStart(3) + '/' + todo.length + ' ' + row.verdict.toUpperCase().padEnd(10) + ' ' + m.id.padEnd(15) + ' ' + (row.plane || '-').padEnd(24) + ' ' + String(row.timeS || 0).padStart(5) + ' s flown, ' + row.wallS + ' s wall' + (row.verdict === 'feasible' ? '' : '  ' + (row.why || '').slice(0, 160)));
      res(true);
    });
  });
  const lane = async () => { while (await one()) { /* next */ } };
  await Promise.all(Array.from({ length: workers }, lane));
  console.log('story_feas: ' + done + ' flown this run');
}
// a row as kept: the verdict, the plane, the time, each flight's two ends and how it ended (no words of the mission)
function slim(R) {
  const best = (R.attempts || []).find(a => a.verdict === 'feasible') || (R.attempts || [])[(R.attempts || []).length - 1] || null;
  const legs = best ? (best.legs || []).map(L => ({ from: L.from || null, to: L.to || null, t: Math.round(L.t || 0), how: L.how || null, at: (L.stop && L.stop.at) || L.atAero || null,
    stop: L.stop ? (L.stop.events || []).slice() : [], kg: L.load ? L.load.kg : 0, pax: L.load ? L.load.pax : 0,
    faults: (L.faults || []).map(f => f.k), events: (L.events || []).map(e => e.k + ':' + e.key + (e.m != null ? '=' + e.m : '')) })) : [];
  return { id: R.id, kind: R.kind || null, verdict: R.verdict, plane: R.plane || null, timeS: Math.round(R.timeS || 0), why: R.verdict === 'feasible' ? '' : String(R.why || '').slice(0, 600),
    tried: (R.attempts || []).map(a => a.plane + ':' + a.verdict), legs, notes: [...new Set((R.notes || []).concat(...(R.attempts || []).map(x => x.notes || [])))].slice(0, 6), untested: !!R.untested };
}

// the classes a mission may be in without a feasible flight (named, counted, never hidden)
function classOf(m, r) {
  if (m.order) return 'order';
  if (r && r.verdict === 'feasible') return 'feasible';
  if (r && r.verdict === 'infeasible' && r.pool === 'official' && /no official plane can do it/.test(r.why || '')) return 'player-built';
  return null;
}
function table() {
  const { list } = load();
  const rows = list.map(m => { const r = current(m), stale = !r && !!rowOf(m.id); return Object.assign({ id: m.id, where: m.where, kind: m.kind }, r ? { verdict: r.verdict, plane: r.plane, timeS: r.timeS, why: r.why, legs: r.legs, pool: r.pool, cls: classOf(m, r) } : { verdict: stale ? 'stale' : 'not flown', cls: m.order ? 'order' : null }); });
  const by = {}; for (const r of rows) { const k = r.cls === 'order' ? 'an aircraft order (not a flight)' : r.cls === 'player-built' ? 'no official plane can fly it (the player builds one)' : r.verdict; by[k] = (by[k] || 0) + 1; }
  const doc = { what: 'flydiy-story-feasibility', v: 1, pack: 'story', missions: rows.length, summary: by, flownS: rows.reduce((a, r) => a + (r.timeS || 0), 0), rows };
  const out = path.join(ROOT, 'reports', 'STORY-REVAMP');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'feasibility.json'), JSON.stringify(doc, null, 1) + '\n');
  const fmt = s => (s ? Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s' : '-');
  const md = ['# The story pack, flown on node', '', 'tools/story_feas.js --table. Each mission flown the way the game flies it (tools/mission_feas.js: the stand, the taxi, the take-off, the landing, the taxi in, the load, the career\'s stop).',
    'A row is kept until its mission changes. Structure only: the verdict, the aeroplane, the time flown, where each flight ended.', '',
    'Summary (' + rows.length + ' missions): ' + Object.keys(by).sort().map(k => by[k] + ' ' + k).join('; ') + '. Time flown: ' + fmt(doc.flownS) + '.', '',
    '| mission | step of | verdict | aeroplane | flown | flights (from > to, s) | why not |', '|---|---|---|---|---|---|---|'];
  for (const r of rows) md.push('| ' + r.id + ' | ' + r.where + ' | ' + (r.cls === 'order' ? 'order' : r.verdict) + ' | ' + (r.plane || '-') + ' | ' + fmt(r.timeS) + ' | ' +
    ((r.legs || []).map(L => (L.from || '?') + ' > ' + (L.at || L.to || '?') + ' ' + L.t + (L.events && L.events.length ? ' [' + L.events.join(' ') + ']' : '')).join('; ') || '-') + ' | ' + (r.verdict === 'feasible' || r.cls === 'order' ? '' : String(r.why || '').replace(/\|/g, '/').slice(0, 220)) + ' |');
  fs.writeFileSync(path.join(out, 'feasibility.md'), md.join('\n') + '\n');
  console.log('wrote reports/STORY-REVAMP/feasibility.json + .md: ' + JSON.stringify(by));
  return doc;
}
function check() {
  const { list } = load();
  let bad = 0; const cnt = {};
  for (const m of list) {
    const r = current(m), c = classOf(m, r), state = c || (r ? r.verdict : rowOf(m.id) ? 'stale' : 'not flown');
    cnt[state] = (cnt[state] || 0) + 1;
    if (!c) { bad++; console.log('  FAIL ' + m.id.padEnd(15) + ' ' + state + (r && r.why ? ': ' + r.why.slice(0, 200) : '')); }
  }
  console.log(list.length + ' missions: ' + Object.keys(cnt).sort().map(k => cnt[k] + ' ' + k).join(', '));
  console.log('GATE STORYFEAS: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  process.exit(bad ? 1 : 0);
}
if (has('fly')) fly().catch(e => { console.error(e); process.exit(2); });
else if (has('table')) table();
else if (has('check')) check();
else console.log('story_feas.js --fly | --table | --check (see the header)');
