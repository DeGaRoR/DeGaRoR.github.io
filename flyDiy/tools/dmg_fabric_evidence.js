#!/usr/bin/env node
// G2040-G2043 (DMG-FABRIC): the standard crashes (DMG-TUNE's) on the validated builds, the cover ties OFF (before:
// GEN_COVER.on = false - the base's physics bit for bit) and ON (after), in child processes (one core each, 3 at once),
// JSON out; the pictures from the JSON (dmg_fabric_plots.js).
//
//   node tools/dmg_fabric_evidence.js --sweep <out.json> [--builds cub,..] [--crashes taxi,..] [--modes off,on] [--jobs 3]
//   (DMG_FABRIC_SET='tuN=9809,eu=0.2': the covering's knobs for a sensitivity row - GEN_COVER.fabric's fields)
// FLYDIY_SPEC_DIR / FLYDIY_CERT_DIR as DMG-TUNE's (the Cessnas' page-loaded spec; the envelopes precomputed).
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BUILDS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];

if (argv[0] === '--child') {
  const [, k, id, mode] = argv;
  process.env.FLYDIY_CERT = '1';
  const F = require('./_dmg_fabric_lib.js');
  const C = F.L.core();
  if (mode === 'off') C.GEN_COVER.on = false;
  if (process.env.DMG_FABRIC_SET) for (const kv of process.env.DMG_FABRIC_SET.split(',')) { const [a, b] = kv.split('='); C.GEN_COVER.fabric[a] = +b; }
  const t0 = Date.now(), r = F.runFabric(k, id, { secs: 7 });
  delete r.sim;
  process.stdout.write('RESULT ' + JSON.stringify(Object.assign(r, { mode, s: (Date.now() - t0) / 1000 })) + '\n', () => process.exit(0));
} else {
  const { spawn } = require('child_process');
  const child = args => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--child'].concat(args), { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { args, err: se.slice(-1500) }); });
  });
  (async () => {
    const T = require('./_dmg_tune_lib.js');
    const builds = opt('builds', BUILDS.join(',')).split(','), only = opt('crashes', null), modes = opt('modes', 'off,on').split(','), jobsN = +opt('jobs', 3);
    const jobs = [];
    for (const k of builds) for (const id of T.crashes(k)) if (!only || only.split(',').includes(id)) for (const m of modes) jobs.push([k, id, m]);
    const out = new Array(jobs.length); let i = 0; const t0 = Date.now();
    await Promise.all(Array.from({ length: jobsN }, async () => { while (i < jobs.length) { const j = i++; out[j] = await child(jobs[j]);
      const r = out[j]; process.stderr.write((r.err ? 'ERR ' + r.err.slice(-300) + ' ' : '') + jobs[j].join(' ') + (r.s ? ' ' + r.s.toFixed(0) + ' s' : '') + '\n'); } }));
    fs.writeFileSync(argv[1], JSON.stringify({ at: new Date().toISOString(), specDir: process.env.FLYDIY_SPEC_DIR || null, set: process.env.DMG_FABRIC_SET || null, wall: (Date.now() - t0) / 1000, runs: out }));
    for (const r of out) {
      if (r.err) { console.log('ERR', JSON.stringify(r.args)); continue; }
      const a = x => r.at[x] ? r.at[x].held + '/' + r.at[x].pieces + ' ' + r.at[x].shareH.toFixed(2) : '-';
      console.log(r.k.padEnd(10), r.id.padEnd(9), r.mode.padEnd(3), 'broken', String(r.broken).padStart(3), '| held/pieces share @0.5', a('0.5'), '@1', a('1'), '@2', a('2'), '@4', a('4'),
        '| ties', r.ties ? r.ties.made + ' torn ' + r.ties.torn + ' (born ' + r.ties.born + ')' : '-', '| far', r.end.farH, '/', r.end.far);
    }
  })();
}
