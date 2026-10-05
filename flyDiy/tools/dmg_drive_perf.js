#!/usr/bin/env node
// G1827 (DMG-DRIVE): THE PERF A/B - the stock sim.step(1/60) in node with nothing touching (TREE-CRASH's perf child: the
// flat world, a far trunk set registered, 120 steps settled, 600 timed), the damage layer OFF and ON (ON on the
// certificate, read from FLYDIY_CERT_DIR when given), the base's core against this one in ALTERNATING child processes,
// `--rounds` pairs per row, pooled: the median of each side's per-process medians and the paired ratio's median.
//   node tools/dmg_drive_perf.js --base=<the base's flight_core.js> [--rounds=10] [--builds=cub,metal] [--out=<json>]
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

if (argv[0] === '--child') {
  const [, core, key, mode, dmg] = argv;
  const m = require(path.resolve(core)), kk = require.resolve('./flight_core.js');
  require.cache[kk] = { id: kk, filename: kk, loaded: true, exports: m };
  const L = require('./_treecrash_lib.js');
  const C = L.core(), def = L.defOf(key, dmg === 'on' ? (process.env.FLYDIY_CERT_DIR ? { cert: true } : {}) : { elastic: true }), { W, strip } = L.flatWorld(0);
  const TH = W.treeHits, A = []; for (let i = 0; i < 4000; i++) A.push(5000 + (i % 63) * 9, 5000 + Math.floor(i / 63) * 9, 0, 0.3, 10);
  TH.set('far', A);
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: mode === 'air' ? 300 : 0 }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), V = mode === 'air' ? 1.6 * def.params.gen.Vs : 0;
  if (V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+2] = V * fz; }
  sim.ctl.thr = mode === 'air' ? 0.75 : 0.3;
  for (let f = 0; f < 120; f++) sim.step(1 / 60);
  const ms = [];
  for (let f = 0; f < 600; f++) { const a = process.hrtime.bigint(); sim.step(1 / 60); ms.push(Number(process.hrtime.bigint() - a) / 1e6); }
  ms.sort((a, b) => a - b);
  const D = sim.damage ? sim.damage() : null;
  console.log('PERF ' + JSON.stringify({ med: ms[300], mean: ms.reduce((a, b) => a + b, 0) / ms.length, armed: D && D.armedN != null ? D.armedN : null, cert: !!(sim.cert && sim.cert()), drive: !!(D && D.drive) }));
  process.exit(0);
}

const { spawnSync } = require('child_process');
const base = path.resolve(opt('base', '')), mine = path.join(__dirname, 'flight_core.js');
const rounds = +opt('rounds', 10), builds = opt('builds', 'cub,metal').split(',');
const one = (core, k, mode, dmg) => { const r = spawnSync(process.execPath, [__filename, '--child', core, k, mode, dmg], { encoding: 'utf8', env: process.env });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('PERF ')); if (!l) process.stderr.write(r.stderr || ''); return l ? JSON.parse(l.slice(5)) : null; };
const med = a => { const v = a.slice().sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
const P = {};
for (const dmg of ['off', 'on']) for (const k of builds) for (const mode of ['ground', 'air']) {
  const b = [], m = [], ratio = [];
  for (let r = 0; r < rounds; r++) {
    // alternating: which side goes first flips each round
    const pair = r % 2 ? [['m', mine], ['b', base]] : [['b', base], ['m', mine]];
    const got = {};
    for (const [s, core] of pair) got[s] = one(core, k, mode, dmg);
    if (got.b && got.m) { b.push(got.b.med); m.push(got.m.med); ratio.push(got.m.med / got.b.med); }
  }
  const row = { base: med(b), mine: med(m), ratio: med(ratio), pct: (med(ratio) - 1) * 100, n: ratio.length };
  P[dmg + ':' + k + ':' + mode] = row;
  console.log('damage ' + dmg.padEnd(3) + ' ' + k.padEnd(6) + ' ' + mode.padEnd(6) + ' base ' + row.base.toFixed(3) + ' ms, now ' + row.mine.toFixed(3) + ' ms, paired ' + (row.pct >= 0 ? '+' : '') + row.pct.toFixed(2) + ' % (' + row.n + ' pairs)');
}
const all = {}; for (const dmg of ['off', 'on']) all[dmg] = med(Object.keys(P).filter(x => x.startsWith(dmg)).map(x => P[x].ratio));
console.log('pooled: damage OFF ' + ((all.off - 1) * 100).toFixed(2) + ' %, damage ON ' + ((all.on - 1) * 100).toFixed(2) + ' % (the median of the rows\' paired medians)');
if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify({ rows: P, pooled: all }, null, 1));
