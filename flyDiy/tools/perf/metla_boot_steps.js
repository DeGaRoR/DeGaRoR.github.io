#!/usr/bin/env node
// metla_boot_steps.js - METLA-COOK (G2060): WHERE THE TOWN'S GARAGE SECONDS GO. Per load (navigation -> garage, each in its
// own Chrome on one profile - the one-Chrome parity trap), BOOT.log's steps with their durations (a step's start to the
// next record), the links, and per step the town-on minus town-off median.
// Usage: node tools/perf/metla_boot_steps.js --port 8657 --udd D:/mc1 [--order A,B,B,A] [--build cub] [--fallback <root>]
//        [--out file.json]       (GPU lock first, timed; no --help: an unknown flag runs it)
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null), ORDER = opt('order', 'A,B,B,A').split(','), BK = opt('build', 'cub');
if (!PORT || !UDD) { console.error('metla_boot_steps: --port and --udd are required'); process.exit(2); }
const SIDE = { A: 'town=0', B: 'town=1' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (await MB.serveRoot(PORT)) { console.error('metla_boot_steps: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);
  const BASE = 'http://localhost:' + PORT + '/flyDiy/index.html';
  const B0 = MB.BUILDS[BK], rows = [];
  for (const side of ORDER) {
    const b = await MB.browser(UDD);
    const l = await b.load(BASE + '?' + SIDE[side], MB.preScript(B0.build, null, B0.patch));
    await sleep(1500);
    const log = JSON.parse(await b.ev('JSON.stringify(window.BOOT ? BOOT.log : [])', 20000));
    const lk = await b.links(0, 1e12);
    const steps = {}; for (let i = 0; i < log.length; i++) if (log[i].k === 'step') { const nx = log.slice(i + 1).find(e => e.k === 'step' || e.k === 'landing' || e.k === 'ready' || e.k === 'gone' || e.k === 'waiting'); steps[log[i].id] = (steps[log[i].id] || 0) + ((nx ? nx.t : log[i].t) - log[i].t); }
    // G2063: when each step began and what landed (BOOT.log 'landed': props, crew, the world's pieces) - the shed's compile
    // step waits for props / crew to settle (app.js bootStep 'compile', 8 s at most)
    const at = {}; for (const e of log) if (e.k === 'step') at[e.id] = e.t;
    const landed = log.filter(e => e.k === 'landed').map(e => [e.t, e.key]);
    rows.push({ side, sec: l.sec, links: lk, steps, at, landed });
    const cs = at.compile; if (cs != null) console.log('   compile began ' + cs + ' ms; landed around it: ' + landed.filter(x => x[0] > cs - 3000).slice(0, 12).map(x => x[1] + '@' + (x[0] - cs)).join(' '));
    console.log(side + ' ' + l.sec + ' s, links ' + lk.n + ' worst ' + lk.worstS + ' s | ' + Object.entries(steps).filter(([, v]) => v > 300).map(([k, v]) => k + ' ' + (v / 1000).toFixed(1)).join(', '));
    await b.close();
  }
  const med = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
  const ids = [...new Set(rows.flatMap(r => Object.keys(r.steps)))];
  console.log('\nstep: off median -> on median (s), on - off');
  for (const id of ids) { const a = med(rows.filter(r => r.side === 'A').map(r => r.steps[id] || 0)), c = med(rows.filter(r => r.side === 'B').map(r => r.steps[id] || 0));
    if (Math.max(a, c) > 200) console.log('  ' + id.padEnd(14) + (a / 1000).toFixed(1).padStart(6) + ' -> ' + (c / 1000).toFixed(1).padStart(6) + '   ' + ((c - a) >= 0 ? '+' : '') + ((c - a) / 1000).toFixed(1)); }
  if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify(rows, null, 1));
  try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
