#!/usr/bin/env node
// ============================================================
// PILOT MATRIX (P0.2 of PILOT-ROADMAP-2026-09-14.md) — THE JUDGE.
//
// machines x runways x weather (x styles), each cell one pilot_trace.js
// flight in its own process, N at a time, judged against thresholds per
// metric, reported as a table and a JSON. This is what every later step of
// the pilot track is measured on — TECS, the paths, the datum, the person:
// "no change without the matrix" (PILOT-ROADMAP §6.3 rule 8).
//
//   node tools/pilot_matrix.js                 the QUICK set (~6 cells, minutes)
//   node tools/pilot_matrix.js --set core      the core set (the archetypes, calm + across)
//   node tools/pilot_matrix.js --set all       everything below (an hour+)
//   node tools/pilot_matrix.js --cells cub:HOME:calm,c172:HOME:x2   named cells
//   node tools/pilot_matrix.js --jobs 4 --out matrix.json --baseline matrix_prev.json
//   node tools/pilot_matrix.js --ratchet tools/pilot_baseline.json     GATE PILOTMATRIX: no cell worse
//
// A cell is { key, from, to, weather, fixture, style, drawnTail }; the weather
// names are in WEATHERS, the fixtures (a sloped strip) in FIXTURES. The verdict per cell is the worst of its metrics; a
// baseline file (a previous --out) prints the deltas so a change is read as
// "what moved", not "what is red".
// ============================================================
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const T = __dirname;

const WEATHERS = {
  calm:  {},
  x2:    { wind: [2, 2] },            // ~2 m/s across HOME (hdg PI), a touch of head
  x4:    { wind: [1, 4], gust: 0.6 }, // 4 m/s across with gusts
  head6: { wind: [-6, 0] },           // 6 m/s down the strip, into the landing
  tail3: { wind: [3, 0] },            // a tailwind on the landing direction the pilot picks against
  hot:   { oat: 35, qnh: 100800, wind: [-2.2, 2.6], gust: 0.7 },   // GATE HOTHIGH's day
};
// THE FIXTURES (pilot_trace --slope): HOME tilted along its axis, zero at the
// spawn, a hillside — `up4`: the landing runs UPHILL 4 % (the flat datum meets
// the rising ground 770 m before the aim: lands short, no flare); `dn4`: the
// landing runs DOWNHILL over the hill the approach must cross (the pilot goes
// around for terrain, and has to choose the other direction — P1)
const FIXTURES = { flat: {}, up4: { slope: -0.04 }, dn4: { slope: 0.04 }, up2: { slope: -0.02 }, dn2: { slope: 0.02 } };
const MACHINES_QUICK = ['cub', 'c172', 'stearman'];
const MACHINES_CORE = ['cub', 'pietenpol', 'tigermoth', 'stearman', 'jodel', 'c172', 'rv', 'savannah', 'ul1', 'pusherPod', 'motorglider', 'etrainer', 'vtail', 'twinBush', 'beaver'];
const MACHINES_ALL = MACHINES_CORE.concat(['pittsAlike', 'sesqui', 'caravan', 'radial', 'ttail', 'mw5', 'archaeopteryx', 'da62', 'skymaster', 'p38']);

function cellsOf(set) {
  const cells = [];
  const add = (key, from, to, weather, style, drawnTail, fixture) => cells.push({ key, from, to: to || from, weather, style: style || 'normal', drawnTail: !!drawnTail, fixture: fixture || 'flat' });
  if (set === 'quick') {
    for (const k of MACHINES_QUICK) add(k, 'HOME', null, 'calm');
    add('cub', 'HOME', null, 'x2'); add('stearman', 'HOME', null, 'x2'); add('c172', 'HOME', null, 'x2');
    add('cub', 'HOME', 'A3', 'calm');                       // a 480 m grass strip, 10 km out
    add('cub', 'HOME', null, 'calm', null, false, 'up4'); add('cub', 'HOME', null, 'calm', null, false, 'dn4');
  } else if (set === 'core') {
    for (const k of MACHINES_CORE) { add(k, 'HOME', null, 'calm'); add(k, 'HOME', null, 'x2'); }
    for (const k of ['cub', 'c172', 'savannah']) { add(k, 'HOME', 'A3', 'calm'); add(k, 'HOME', 'A5', 'calm'); }
    add('cub', 'HOME', null, 'hot'); add('c172', 'HOME', null, 'head6');
    for (const k of ['cub', 'c172', 'savannah']) for (const f of ['up4', 'dn4', 'up2']) add(k, 'HOME', null, 'calm', null, false, f);
  } else if (set === 'all') {
    for (const k of MACHINES_ALL) for (const w of ['calm', 'x2', 'x4', 'hot']) add(k, 'HOME', null, w);
    for (const k of MACHINES_ALL) { add(k, 'HOME', null, 'calm', null, true); }
    for (const k of MACHINES_CORE) for (const d of ['A3', 'A5', 'A0']) add(k, 'HOME', d, 'calm');
    for (const k of ['cub', 'c172', 'stearman']) for (const st of ['cautious', 'brisk']) add(k, 'HOME', null, 'x2', st);
  }
  return cells;
}
const cellId = c => [c.key, c.from + (c.to !== c.from ? '-' + c.to : ''), c.weather, c.fixture && c.fixture !== 'flat' ? c.fixture : '', c.style !== 'normal' ? c.style : '', c.drawnTail ? 'drawn' : ''].filter(Boolean).join(':');
function parseCell(s) {
  const p = s.split(':');
  const [from, to] = (p[1] || 'HOME').split('-');
  return { key: p[0], from, to: to || from, weather: p[2] || 'calm', style: p.includes('cautious') ? 'cautious' : p.includes('brisk') ? 'brisk' : 'normal', drawnTail: p.includes('drawn'),
           fixture: p.find(x => FIXTURES[x] && x !== 'flat') || 'flat' };
}

// THE THRESHOLDS — the numbers a good pilot flies to, on every machine. A
// metric is judged only when the flight produced it; a missing landing is
// judged by `outcome`. Each row: [label, get, ok(v) -> true | 'warn' | false, fmt]
const CHECKS = [
  ['outcome',   r => r.outcome,                       v => v === 'completed' ? true : false,                          v => v],
  ['go-arounds',r => r.goArounds,                     v => v === 0 ? true : v <= 1 ? 'warn' : false,                  v => v],
  ['overshoot', r => r.legs.length ? Math.max(...r.legs.map(l => l.overshoot)) : null, v => v <= 40 ? true : v <= 100 ? 'warn' : false, v => v + ' m'],
  ['roll rev', r => r.legs.length ? Math.max(...r.legs.map(l => l.rollRev || 0)) : null, v => v <= 8 ? true : v <= 20 ? 'warn' : false, v => v + '/min'],
  ['slope rms', r => r.final && r.final.aboveRms,     v => v <= 3 ? true : v <= 8 ? 'warn' : false,                   v => v + ' m'],
  ['speed rms', r => r.final && r.final.vRms,         v => v <= 1.5 ? true : v <= 3 ? 'warn' : false,                 v => v + ' m/s'],
  ['sink',      r => r.landing && r.landing.sink,     v => v <= 1.5 ? true : v <= 2.5 ? 'warn' : false,               v => v + ' m/s'],
  ['V/Vs',      r => r.landing && r.landing.VoverVs,  v => v >= 1.05 && v <= 1.35 ? true : v >= 1.0 && v <= 1.5 ? 'warn' : false, v => v],
  ['aim',       r => r.landing && r.landing.pastAim,  v => Math.abs(v) <= 100 ? true : Math.abs(v) <= 200 ? 'warn' : false, v => v + ' m'],
  ['off',       r => r.landing && Math.abs(r.landing.off), v => v <= 3 ? true : v <= 8 ? 'warn' : false,             v => v + ' m'],
  ['swing',     r => r.rollout && r.rollout.maxE,     v => v <= 6 ? true : v <= 15 ? 'warn' : false,                  v => v + ' deg'],
  ['reversals', r => r.rollout && r.rollout.zeroX,    v => v <= 3 ? true : v <= 10 ? 'warn' : false,                  v => v],
];
const judge = r => {
  if (r.error) return { verdict: false, cols: [] };
  let verdict = true; const cols = [];
  for (const [label, get, ok, fmt] of CHECKS) {
    const v = get(r);
    if (v == null) { cols.push({ label, s: '—', ok: null }); continue; }
    const o = ok(v);
    if (o === false) verdict = false; else if (o === 'warn' && verdict === true) verdict = 'warn';
    cols.push({ label, s: fmt(v), ok: o });
  }
  return { verdict, cols };
};

function runCell(c, extra) {
  return new Promise(resolve => {
    const w = WEATHERS[c.weather] || {};
    const args = [path.join(T, 'pilot_trace.js'), c.key, '--from', c.from, '--quiet', '--style', c.style];
    if (c.to && c.to !== c.from) args.push('--to', c.to);
    if (w.wind) args.push('--wind', w.wind.join(','));
    if (w.gust) args.push('--gust', String(w.gust));
    if (w.oat != null) args.push('--oat', String(w.oat));
    if (w.qnh != null) args.push('--qnh', String(w.qnh));
    if (c.drawnTail) args.push('--drawn-tail');
    const fx = FIXTURES[c.fixture] || {};
    if (fx.slope) args.push('--slope', String(fx.slope));
    for (const a of extra || []) args.push(a);
    const p = spawn(process.execPath, args, { cwd: T, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => {
      const lines = out.trim().split('\n');
      let r = null;
      try { r = JSON.parse(lines[lines.length - 1]); } catch (e) { r = { error: (err || out).slice(-400) || ('exit ' + code) }; }
      r.cell = cellId(c);
      resolve(r);
    });
  });
}

async function runMatrix(cells, jobs, extra, onDone) {
  const results = new Array(cells.length);
  let next = 0;
  const worker = async () => {
    while (next < cells.length) {
      const i = next++;
      const r = await runCell(cells[i], extra);
      results[i] = r;
      if (onDone) onDone(i, r);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, cells.length) }, worker));
  return results;
}

function report(results, baseline) {
  const B = baseline ? Object.fromEntries(baseline.map(r => [r.cell, r])) : null;
  const labels = CHECKS.map(c => c[0]);
  const W = 30;
  const head = 'cell'.padEnd(W) + labels.map(l => l.padStart(11)).join('') + '   t';
  const lines = [head];
  let nBad = 0, nWarn = 0;
  for (const r of results) {
    const j = judge(r);
    if (j.verdict === false) nBad++; else if (j.verdict === 'warn') nWarn++;
    const mark = r.error ? '!!' : j.verdict === true ? '  ' : j.verdict === 'warn' ? ' ~' : ' X';
    let line = (mark + r.cell).padEnd(W);
    if (r.error) line += '  ' + String(r.error).replace(/\s+/g, ' ').slice(0, 100);
    else {
      line += j.cols.map(c => ((c.ok === false ? '*' : c.ok === 'warn' ? '~' : '') + c.s).padStart(11)).join('');
      line += String(r.t).padStart(6);
      const b = B && B[r.cell];
      if (b && b.landing && r.landing) {
        const d = [];
        if (Math.abs(r.landing.sink - b.landing.sink) > 0.2) d.push('sink ' + b.landing.sink + '->' + r.landing.sink);
        if (Math.abs(r.landing.pastAim - b.landing.pastAim) > 30) d.push('aim ' + b.landing.pastAim + '->' + r.landing.pastAim);
        if (r.rollout && b.rollout && Math.abs(r.rollout.maxE - b.rollout.maxE) > 3) d.push('swing ' + b.rollout.maxE + '->' + r.rollout.maxE);
        if (r.outcome !== b.outcome) d.push(b.outcome + '->' + r.outcome);
        if (d.length) line += '   Δ ' + d.join(', ');
      } else if (B && !b) line += '   (new)';
    }
    lines.push(line);
  }
  lines.push('');
  lines.push(results.length + ' cells: ' + (results.length - nBad - nWarn) + ' good, ' + nWarn + ' warn, ' + nBad + ' bad' +
             (results.some(r => r.error) ? ' (' + results.filter(r => r.error).length + ' errored)' : ''));
  return { text: lines.join('\n'), nBad, nWarn };
}

// THE RATCHET (GATE PILOTMATRIX): against a committed baseline, a cell may
// not get WORSE — its verdict may not drop (good -> warn -> bad), a metric
// that was good may not turn bad, and a landing's sink / aim / swing may not
// grow past a tolerance. Cells the baseline does not know are reported, not
// judged. The baseline moves forward only by hand (a re-run with --out onto
// tools/pilot_baseline.json, said in the HANDOVER), never by the gate.
const rank = v => v === true ? 2 : v === 'warn' ? 1 : 0;
function ratchet(results, baseline) {
  const B = Object.fromEntries(baseline.map(r => [r.cell, r]));
  const bad = [];
  for (const r of results) {
    const b = B[r.cell]; if (!b) continue;
    if (r.error) { bad.push(r.cell + ': errored (' + String(r.error).slice(0, 60) + ')'); continue; }
    const jr = judge(r), jb = judge(b);
    if (rank(jr.verdict) < rank(jb.verdict)) bad.push(r.cell + ': verdict ' + String(jb.verdict) + ' -> ' + String(jr.verdict));
    for (let i = 0; i < jr.cols.length; i++) {
      const cr = jr.cols[i], cb = jb.cols[i];
      if (cb && cb.ok === true && cr.ok === false) bad.push(r.cell + ': ' + cr.label + ' ' + cb.s + ' -> ' + cr.s);
    }
    if (r.landing && b.landing) {
      if (r.landing.sink > b.landing.sink + 0.5) bad.push(r.cell + ': sink ' + b.landing.sink + ' -> ' + r.landing.sink);
      if (Math.abs(r.landing.pastAim) > Math.abs(b.landing.pastAim) + 60) bad.push(r.cell + ': aim ' + b.landing.pastAim + ' -> ' + r.landing.pastAim);
      if (r.rollout && b.rollout && r.rollout.maxE > b.rollout.maxE + 5) bad.push(r.cell + ': swing ' + b.rollout.maxE + ' -> ' + r.rollout.maxE);
    }
  }
  return bad;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const set = opt('--set', 'quick');
  const cells = opt('--cells') ? opt('--cells').split(',').map(parseCell) : cellsOf(set);
  const jobs = +opt('--jobs', Math.max(1, Math.min(4, require('os').cpus().length - 2)));
  const out = opt('--out', null), base = opt('--baseline', null), rat = opt('--ratchet', null);
  const loadRes = f => f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).results : null;
  const baseline = loadRes(base) || loadRes(rat);
  const extra = argv.includes('--csv') ? ['--csv'] : [];
  for (const f of ['--sheet', '--tecs', '--no-sheet', '--no-tecs', '--no-path']) if (argv.includes(f)) extra.push(f);   // the P0.4 / P0.5 / P0.6 flags, matrix-wide
  // the core under test is SNAPSHOTTED for the whole run (see pilot_trace.js)
  const runDir = path.join(T, '..', 'pilot_runs'); if (!fs.existsSync(runDir)) fs.mkdirSync(runDir);
  const coreSnap = path.join(runDir, 'core_' + Date.now() + '.js');
  fs.copyFileSync(opt('--core', path.join(T, 'flight_core.js')), coreSnap);
  extra.push('--core', coreSnap);
  console.log('PILOT MATRIX: ' + cells.length + ' cells, ' + jobs + ' at a time (' + set + ') on ' + path.basename(coreSnap));
  const t0 = Date.now();
  runMatrix(cells, jobs, extra, (i, r) => {
    const j = judge(r);
    console.log('  ' + (r.error ? '!! ' : j.verdict === true ? 'ok ' : j.verdict === 'warn' ? '~  ' : 'X  ') + r.cell.padEnd(28) +
                (r.error ? String(r.error).replace(/\s+/g, ' ').slice(0, 90) : (r.outcome + ' ' + r.t + ' s' + (r.landing ? ' · sink ' + r.landing.sink + ' · ' + r.landing.VoverVs + ' Vs · aim ' + r.landing.pastAim + ' · swing ' + (r.rollout ? r.rollout.maxE : '—') : ''))));
  }).then(results => {
    const rep = report(results, baseline);
    console.log('\n' + rep.text);
    console.log('wall ' + Math.round((Date.now() - t0) / 1000) + ' s');
    if (out) fs.writeFileSync(out, JSON.stringify({ set, when: new Date().toISOString(), results }, null, 1));
    try { fs.unlinkSync(coreSnap); } catch (e) {}
    if (rat) {
      const rb = loadRes(rat);
      const worse = rb ? ratchet(results, rb) : ['no baseline at ' + rat];
      for (const w of worse) console.log('  REGRESSED ' + w);
      // the runner's contract is the bare `GATE PILOTMATRIX: PASS` at the end of
      // its line (run_gates.js matches ^GATE <ID>: PASS$) - the note on the line
      // before it read as a red battery (G416)
      console.log('  ratchet: ' + (worse.length ? worse.length + ' regressed against ' : 'no cell worse than ') + path.basename(rat) + '; ' + rep.nBad + ' known bad, ' + rep.nWarn + ' warn');
      console.log('GATE PILOTMATRIX: ' + (worse.length ? 'FAIL (' + worse.length + ' regressed)' : 'PASS'));
      process.exit(worse.length ? 1 : 0);
    }
    console.log('PILOT MATRIX: ' + (rep.nBad ? 'FAIL (' + rep.nBad + ' bad)' : rep.nWarn ? 'PASS with ' + rep.nWarn + ' warnings' : 'PASS'));
    process.exit(rep.nBad ? 1 : 0);
  });
}
module.exports = { ratchet, WEATHERS, FIXTURES, cellsOf, parseCell, cellId, runCell, runMatrix, judge, report, CHECKS };
