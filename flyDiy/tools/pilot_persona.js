#!/usr/bin/env node
// ============================================================
// PILOT PERSONA (G2085) - EVERY PERSON ON EVERY VALIDATED AEROPLANE, MEASURED.
//
// futureDesigns/PILOT-PERSONALITY-2026-10-05.md §6: a personality is judged with the instruments the expert is. One
// pilot_trace.js flight per (aeroplane x profile), N at a time, each its own process on a SNAPSHOT of the core (the
// matrix's rule: an hour-long sweep must not read a flight_core.js that changed under it). The aeroplanes are the
// user's validated four: the Cub, the Jodel, the C172 (builds/*_2026-09-20_corrected.json) and the C172 on floats
// (the Wipline 2350 fixture, off the SEA lane). The table, per flight:
//
//   take-off   the run (m), the lift-off speed, the LIFT-OFFS (1 = clean; more are hops), the rotation's peak pitch
//              rate (deg/s) and the peak attitude in the air (deg)
//   circuit    the cross-track rms on the straight legs (m, the fillets excluded) and the worst leg overshoot (m)
//   approach   the slope's rms (m) and the speed's rms about Vref (m/s) on the captured final
//   landing    the touchdown sink (m/s), V/Vs, metres past the aim, the BOUNCES (off the surface >= 0.15 s after the
//              first touch), the go-arounds, the outcome
//   stab       (G2460) the stabilised approach (43 PILOT_STAB): the go-arounds it called; '+U' an unstable final landed
//              after the two go-arounds (committed) - named in the output
//   hands      control reversals per minute (GATE PILOTACT's counter, aileron | rudder) - the worst phase group and the
//              final's
//
// THE BANDS (the design's §6): a person flies within an envelope, and a validated aeroplane on a normal day is never
// crashed - an outcome that is not 'completed' (or 'diverted' to a strip that is), a sink over 2.5 m/s, more than two
// go-arounds or a sim that diverged is a FINDING, printed as such (and the exit code says it): a person's quirk is a
// band, not a crash. PERSONA_BANDS below are each profile's own: what the person is EXPECTED to do (the student's
// sink, the bush pilot's aim) - a flight outside its profile's band is flagged '~'.
//
//   node tools/pilot_persona.js                         the 4 aeroplanes x 5 profiles, calm (~8 min on 4 jobs)
//   node tools/pilot_persona.js --only cub,c172 --profiles expert,student --weather x2 --jobs 4
//   node tools/pilot_persona.js --csv DIR               + every flight's 10 Hz trace (DIR/<build>_<profile>.csv)
//   node tools/pilot_persona.js --seeds 1,2,3           every person but the expert on three other days (the hand's seed)
//   node tools/pilot_persona.js --profiles '{"skill":{"reaction":0.3}}'   a custom person (43 pilotProfile's shape)
//   node tools/pilot_persona.js --out table.json --md table.md
// ============================================================
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const T = __dirname;
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

const BUILDS = {
  cub:   { file: '../builds/cub_2026-09-20_corrected.json', label: 'Cub' },
  jodel: { file: '../builds/jodel_2026-09-20_corrected.json', label: 'Jodel' },
  c172:  { file: '../builds/cessna172_2026-09-20_corrected.json', label: 'C172' },
  // the user's Cessna on floats: the C172 on Wipline 2350s (G1937's validated water take-off - one lift-off at 27.7 m/s);
  // the corrected C172 with its wheels swapped for floats cannot get off the water at all (G1937: 'stuck on the hump',
  // T/W 0.20 on undersized floats - every profile, the expert's too, rejected: a build, not a person)
  c172f: { file: 'fixtures/build_v10_c172_wipline2350_2026-09-20.json', label: 'C172 floats', from: 'SEA' },
};
const PROFILES = ['expert', 'club', 'student', 'bush', 'hamfist'];
const WEATHER = { calm: [], x2: ['--wind', '2,2'], x4: ['--wind', '1,4', '--gust', '0.6'], breeze: ['--day-wind', '8,250,0.15,1'] };

// THE BANDS (the design's §6): [lo, hi] per metric, per profile - the person's expected envelope (null: not judged).
// The expert's are the matrix's good thresholds; the others widen where the person is MEANT to differ. Set from the
// first sweep on this branch (HANDOVER G2085), so a change to the pilot that moves a person is seen as such.
const PERSONA_BANDS = {
  expert:  { sink: [0, 1.5], ga: [0, 1], lifts: [1, 1], bounces: [0, 0], xtRms: [0, 6], aboveRms: [0, 3], vRms: [0, 1.5] },
  club:    { sink: [0, 2.0], ga: [0, 1], lifts: [1, 1], bounces: [0, 1], xtRms: [0, 10], aboveRms: [0, 4], vRms: [0, 2.0] },
  student: { sink: [0, 2.2], ga: [0, 2], lifts: [1, 2], bounces: [0, 1], xtRms: [0, 20], aboveRms: [0, 6], vRms: [0, 2.5] },
  bush:    { sink: [0, 1.8], ga: [0, 2], lifts: [1, 1], bounces: [0, 1], xtRms: [0, 8], aboveRms: [0, 8], vRms: [0, 2.0] },
  hamfist: { sink: [0, 2.4], ga: [0, 2], lifts: [1, 2], bounces: [0, 2], xtRms: [0, 12], aboveRms: [0, 5], vRms: [0, 2.5] },
  custom:  { sink: [0, 2.5], ga: [0, 2] },
};
// SAFE ON A NORMAL DAY: what no person may do to a validated aeroplane (a finding, not a feature)
const SAFE = r => {
  const why = [];
  if (r.error) why.push('errored: ' + String(r.error).slice(0, 80));
  else {
    if (r.outcome === 'sim-diverged') why.push('the sim diverged');
    else if (r.outcome !== 'completed' && r.outcome !== 'diverted') why.push('outcome ' + r.outcome);
    if (r.landing && r.landing.sink > 2.5) why.push('sink ' + r.landing.sink + ' m/s');
    if ((r.goArounds || 0) > 2) why.push(r.goArounds + ' go-arounds');
  }
  return why;
};

const val = {
  sink: r => r.landing ? r.landing.sink : null, ga: r => r.goArounds || 0,
  lifts: r => r.takeoff ? r.takeoff.lifts : null, bounces: r => r.landing ? r.bounces : null,
  xtRms: r => r.track ? r.track.xtRms : null, aboveRms: r => r.final ? r.final.aboveRms : null, vRms: r => r.final ? r.final.vRms : null,
};
// ON THE WATER (the SEA lane) the expert's own touchdown is firmer and a hull skips once (the Wipline C172: 2.19 m/s,
// one skip): the bands widen by the water's own (+0.8 m/s sink, +1 bounce) - a person is judged against the water too
const WATER_WIDEN = { sink: 0.8, bounces: 1 };
function inBand(r, prof) {
  const B = PERSONA_BANDS[prof] || PERSONA_BANDS.custom, out = [];
  const wet = BUILDS[r.build] && BUILDS[r.build].from === 'SEA';
  for (let [k, [lo, hi]] of Object.entries(B)) {
    if (wet && WATER_WIDEN[k]) hi += WATER_WIDEN[k]; const v = val[k](r); if (v != null && (v < lo - 1e-9 || v > hi + 1e-9)) out.push(k + ' ' + v + ' (band ' + lo + '..' + hi + ')'); }
  return out;
}
const actWorst = r => {
  let w = null;
  for (const [g, a] of Object.entries(r.activity || {})) { const v = Math.max(a.da, a.dr); if (!w || v > w.v) w = { g, v, da: a.da, dr: a.dr }; }
  return w;
};

function runOne(cell, extra) {
  return new Promise(resolve => {
    const B = BUILDS[cell.build];
    const args = [path.join(T, 'pilot_trace.js'), path.join(T, B.file), '--quiet', '--profile', typeof cell.profile === 'string' ? cell.profile : JSON.stringify(cell.profile)];
    if (B.floats) args.push('--floats');
    if (B.from) args.push('--from', B.from);
    for (const a of WEATHER[cell.weather] || []) args.push(a);
    if (cell.csv) args.push('--csv', cell.csv);
    if (cell.seed != null) args.push('--seed', String(cell.seed));
    // G2460: a go-around is another circuit - the clock is the persona's, not the trace's one-circuit 420 s
    if (!extra.includes('--max')) args.push('--max', '1500');
    for (const a of extra) args.push(a);
    const p = spawn(process.execPath, args, { cwd: T, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => {
      const lines = out.trim().split('\n'); let r = null;
      try { r = JSON.parse(lines[lines.length - 1]); } catch (e) { r = { error: (err || out).slice(-300) || ('exit ' + code) }; }
      r.build = cell.build; r.prof = typeof cell.profile === 'string' ? cell.profile : 'custom'; r.wx = cell.weather; r.seedN = cell.seed;
      resolve(r);
    });
  });
}

const f = (v, n = 1) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : '-';
const COLS = [
  ['aeroplane', 12, r => BUILDS[r.build].label],
  ['person', 8, r => r.prof],
  ['seed', 4, r => r.seedN == null ? '' : r.seedN],
  ['run m', 6, r => r.takeoff ? r.takeoff.run : '-'],
  ['Vlof', 5, r => r.takeoff ? f(r.takeoff.Vlo) : '-'],
  ['lifts', 5, r => r.takeoff ? r.takeoff.lifts : '-'],
  ['q°/s', 5, r => r.takeoff ? f(r.takeoff.qMax) : '-'],
  ['θmax', 5, r => f(r.pitchMax)],
  ['xt rms', 6, r => r.track ? f(r.track.xtRms) : '-'],
  ['ovsh', 5, r => r.legs && r.legs.length ? Math.max(...r.legs.map(l => l.overshoot)) : '-'],
  ['slope', 5, r => r.final ? f(r.final.aboveRms) : '-'],
  ['V rms', 5, r => r.final ? f(r.final.vRms, 2) : '-'],
  ['sink', 5, r => r.landing ? f(r.landing.sink, 2) : '-'],
  ['V/Vs', 5, r => r.landing ? f(r.landing.VoverVs, 2) : '-'],
  ['aim m', 5, r => r.landing ? r.landing.pastAim : '-'],
  ['bnc', 3, r => r.landing ? r.bounces : '-'],
  ['GA', 3, r => r.goArounds || 0],
  // G2460: the stabilised approach - the go-arounds IT called, 'U' an unstable final landed once committed (named below)
  ['stab', 5, r => !r.stab ? '-' : (r.stab.ga ? 'GA' + r.stab.ga : 'ok') + (r.stab.committed ? '+U' : '')],
  ['rev/min', 13, r => { const w = actWorst(r); return w ? w.g + ' ' + w.v : '-'; }],
  ['fin da|dr', 9, r => r.activity && r.activity.final ? r.activity.final.da + '|' + r.activity.final.dr : '-'],
  ['outcome', 9, r => r.error ? 'ERROR' : r.outcome],
  ['t s', 5, r => r.t != null ? Math.round(r.t) : '-'],
];
function table(results) {
  const head = COLS.map(([h, w]) => String(h).padStart(w)).join(' ');
  const lines = ['  ' + head];
  for (const r of results) {
    const safe = SAFE(r), band = r.error ? [] : inBand(r, r.prof);
    const mark = safe.length ? 'X ' : band.length ? '~ ' : '  ';
    lines.push(mark + COLS.map(([h, w, g]) => String(g(r)).padStart(w)).join(' '));
  }
  return lines.join('\n');
}
function markdown(results) {
  const L = ['| ' + COLS.map(c => c[0]).join(' | ') + ' | verdict |', '|' + COLS.map(() => '---').join('|') + '|---|'];
  for (const r of results) {
    const safe = SAFE(r), band = r.error ? [] : inBand(r, r.prof);
    L.push('| ' + COLS.map(([h, w, g]) => String(g(r))).join(' | ') + ' | ' + (safe.length ? '**FINDING** ' + safe.join('; ') : band.length ? 'out of band: ' + band.join('; ') : 'ok') + ' |');
  }
  return L.join('\n');
}

if (require.main === module) {
  const only = opt('only', Object.keys(BUILDS).join(',')).split(',');
  const pa = opt('profiles', PROFILES.join(','));
  const profs = pa.trim().startsWith('{') ? [pa] : pa.split(',');   // a JSON profile (the custom person) is one
  const wx = opt('weather', 'calm');
  const jobs = +opt('jobs', Math.max(1, Math.min(4, require('os').cpus().length)));
  const csvDir = opt('csv', null);
  if (csvDir) fs.mkdirSync(csvDir, { recursive: true });
  const runDir = path.join(T, '..', 'pilot_runs'); if (!fs.existsSync(runDir)) fs.mkdirSync(runDir);
  const coreSnap = path.join(runDir, 'core_persona_' + Date.now() + '.js');
  fs.copyFileSync(opt('core', path.join(T, 'flight_core.js')), coreSnap);
  // --seeds a,b,c: every person flown again with the hand from other seeds (43 opts.seed) - the same person on other
  // days; the expert has no hand to seed (one flight)
  const seeds = opt('seeds', null) ? opt('seeds').split(',').map(Number) : [null];
  const cells = [];
  for (const b of only) for (const p of profs) for (const sd of (p === 'expert' ? [null] : seeds))
    cells.push({ build: b, profile: p.startsWith('{') ? JSON.parse(p) : p, weather: wx, seed: sd,
      csv: csvDir ? path.resolve(csvDir, b + '_' + (p.startsWith('{') ? 'custom' : p) + (wx !== 'calm' ? '_' + wx : '') + (sd != null ? '_s' + sd : '') + '.csv') : null });
  console.log('PILOT PERSONA: ' + cells.length + ' flights (' + only.join(' ') + ' x ' + profs.join(' ') + ', ' + wx + '), ' + jobs + ' at a time');
  const t0 = Date.now(), results = new Array(cells.length);
  let next = 0;
  const worker = async () => { while (next < cells.length) { const i = next++; results[i] = await runOne(cells[i], ['--core', coreSnap]);
    const r = results[i]; console.log('  done ' + (r.build + ' ' + r.prof).padEnd(18) + (r.error ? 'ERROR ' + String(r.error).slice(0, 100) : r.outcome + ' ' + r.t + ' s')); } };
  Promise.all(Array.from({ length: Math.min(jobs, cells.length) }, worker)).then(() => {
    try { fs.unlinkSync(coreSnap); } catch (e) {}
    console.log('\n' + table(results));
    const findings = [], off = [];
    for (const r of results) { const s = SAFE(r); if (s.length) findings.push(BUILDS[r.build].label + ' / ' + r.prof + ': ' + s.join('; '));
                               const b = r.error ? [] : inBand(r, r.prof); if (b.length) off.push(BUILDS[r.build].label + ' / ' + r.prof + ': ' + b.join('; ')); }
    for (const x of off) console.log('  ~ out of band  ' + x);
    for (const x of findings) console.log('  X FINDING      ' + x);
    // G2460: EVERY UNSTABLE FINAL GOES ROUND OR IS NAMED - the finals landed unstabilised (committed after two go-arounds)
    for (const r of results) if (r.stab && r.stab.committed) console.log('  U UNSTABLE LANDED  ' + BUILDS[r.build].label + ' / ' + r.prof + (r.seedN != null ? ' s' + r.seedN : '') + ': ' + r.stab.committed);
    console.log('wall ' + Math.round((Date.now() - t0) / 1000) + ' s');
    if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify({ when: new Date().toISOString(), weather: wx, results }, null, 1));
    if (opt('md', null)) fs.writeFileSync(opt('md'), markdown(results) + '\n');
    console.log('PILOT PERSONA: ' + (findings.length ? 'FINDINGS (' + findings.length + ')' : 'SAFE') + (off.length ? ', ' + off.length + ' out of band' : ''));
    process.exit(findings.length ? 1 : 0);
  });
}
module.exports = { BUILDS, PROFILES, PERSONA_BANDS, SAFE, inBand, runOne, table, markdown };
