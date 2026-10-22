#!/usr/bin/env node
// G1893-G1897 (DMG-TUNE): the sanity table's runs, the stamp-vs-physics census and the group census, in child
// processes (one core each, 3 at once), JSON out; the pictures from the JSON (dmg_tune_plots.js).
//
//   node tools/dmg_tune_evidence.js --certs <dir>                      the envelopes, once per build (FLYDIY_CERT_DIR)
//   node tools/dmg_tune_evidence.js --sweep <out.json> [--modes cert,phys] [--builds cub,..] [--crashes taxi,..] [--rows]
//   node tools/dmg_tune_evidence.js --ratios <out.json>                every member's stamp over its physics
// FLYDIY_SPEC_DIR=<dir>: the specs from there (JOIN-PARITY's page-loaded Cessnas); FLYDIY_CERT_DIR: the envelopes.
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BUILDS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];

if (argv[0] === '--child') {
  const [, what, k, id, mode] = argv;
  process.env.FLYDIY_CERT = mode === 'cert' ? '1' : '0';
  const T = require('./_dmg_tune_lib.js');
  // (DMG_TUNE_SET='kappaM=0.5,kappaJ=0.1,rel=0.5': an experiment's knobs - GEN_CERT's and GEN_DMG_GROUP's fields)
  if (process.env.DMG_TUNE_SET) { const C = T.L.core(); for (const kv of process.env.DMG_TUNE_SET.split(',')) { const [a, b] = kv.split('='); if (a === 'rel') C.GEN_DMG_GROUP.rel = +b; else if (a === 'body' || a === 'seam' || a === 'sib') C.GEN_CERT_FLOOR[a] = +b; else C.GEN_CERT[a] = +b; } }
  let out;
  if (what === 'cert') {
    const t0 = Date.now(), c = T.L.certOf(k);
    fs.writeFileSync(path.join(id, k + '.json'), JSON.stringify({ nb: c.nb, Ft: Array.from(c.Ft), Fc: Array.from(c.Fc) }));
    out = { k, s: (Date.now() - t0) / 1000 };
  } else if (what === 'ratios') out = { k, rows: T.stampRatios(k) };
  else if (id === 'card') out = Object.assign(T.runCard(k), { k, id, mode });
  else {
    const t0 = Date.now(), r = T.runCrash(k, id, mode === 'cert' ? { cert: true } : { cert: false });
    if (!argv.includes('--rows')) r.rows = r.rows.slice(0, 400);
    out = Object.assign(r, { k, mode, s: (Date.now() - t0) / 1000 });
  }
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n', () => process.exit(0));   // (exit once flushed: a pipe truncates)
}

const { spawn } = require('child_process');
const child = args => new Promise(res => {
  const c = spawn(process.execPath, [__filename, '--child'].concat(args), { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
  c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { args, err: se.slice(-1500) }); });
});
async function pool(jobs, n) {
  const out = new Array(jobs.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const j = i++; out[j] = await child(jobs[j]); const r = out[j]; process.stderr.write((r.err ? 'ERR ' : '') + jobs[j].join(' ') + (r.s ? ' ' + r.s.toFixed(0) + ' s' : '') + '\n'); } }));
  return out;
}
(async () => {
  const jobsN = +opt('jobs', 3), builds = opt('builds', BUILDS.join(',')).split(',');
  if (argv[0] === '--certs') {
    const dir = argv[1]; fs.mkdirSync(dir, { recursive: true });
    const R = await pool(builds.map(k => ['cert', k, dir, 'cert']), jobsN);
    console.log(JSON.stringify(R));
  } else if (argv[0] === '--ratios') {
    const R = await pool(builds.map(k => ['ratios', k, '-', 'cert']), jobsN);
    fs.writeFileSync(argv[1], JSON.stringify(R));
  } else if (argv[0] === '--sweep') {
    const T = require('./_dmg_tune_lib.js');
    const modes = opt('modes', 'cert,phys').split(','), only = opt('crashes', null);
    const jobs = [];
    if (argv.includes('--card')) for (const k of builds) jobs.push(['run', k, 'card', 'cert']);
    for (const k of builds) for (const id of T.crashes(k)) if (!only || only.split(',').includes(id)) for (const m of modes) jobs.push(['run', k, id, m].concat(argv.includes('--rows') ? ['--rows'] : []));
    const t0 = Date.now(), R = await pool(jobs, jobsN);
    fs.writeFileSync(argv[1], JSON.stringify({ at: new Date().toISOString(), specDir: process.env.FLYDIY_SPEC_DIR || null, wall: (Date.now() - t0) / 1000, runs: R }));
    for (const r of R) if (!r.err && r.id === 'card') console.log(r.k.padEnd(10), 'CARD BROKE AT', r.brokeAt && r.brokeAt.toFixed(3), r.brokeKey, r.brokeSeam, 'first', JSON.stringify(r.fb));
      else if (r.err) console.log('ERR', JSON.stringify(r.args), r.err.slice(-400));
      else console.log(r.k.padEnd(10), r.id.padEnd(9), r.mode, 'broken', String(r.broken).padStart(3), 'work', (r.work / 1000).toFixed(2).padStart(6), 'kJ', JSON.stringify(r.bySec), 'off:', r.off.map(o => o.parts + ' ' + o.m).join('; '));
  }
})();
