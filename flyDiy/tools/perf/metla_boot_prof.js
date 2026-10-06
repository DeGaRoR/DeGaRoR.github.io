#!/usr/bin/env node
// metla_boot_prof.js - METLA-COOK (G2060): the garage load's CPU, town on against off. Per load (its own Chrome, one
// profile): a CDP CPU profile from navigation to the garage, self and inclusive time per function; then on - off, sorted.
// Usage: node tools/perf/metla_boot_prof.js --port 8657 --udd D:/mc1 [--order B,A] [--fallback <root>] [--out f.json]
//        (GPU lock first; no --help: an unknown flag runs it)
'use strict';
const fs = require('fs');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null), ORDER = opt('order', 'B,A').split(',');
if (!PORT || !UDD) { console.error('metla_boot_prof: --port and --udd are required'); process.exit(2); }
const SIDE = { A: 'town=0', B: 'town=1' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function agg(p) {
  const byId = new Map(p.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const name = n => (n.callFrame.functionName || '(anon)') + '@' + (n.callFrame.url || '').split('/').pop().split('?')[0] + ':' + (n.callFrame.lineNumber + 1);
  const self = new Map(), incl = new Map();
  for (let i = 0; i < p.samples.length; i++) { const n = byId.get(p.samples[i]); if (!n) continue; const dt = (p.timeDeltas[i + 1] || 1000) / 1000;
    const k = name(n); self.set(k, (self.get(k) || 0) + dt);
    const seen = new Set(); for (let id = n.id; id != null; id = parent.get(id)) { const kk = name(byId.get(id)); if (seen.has(kk)) continue; seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + dt); } }
  return { self: Object.fromEntries(self), incl: Object.fromEntries(incl) };
}
(async () => {
  if (await MB.serveRoot(PORT)) { console.error('metla_boot_prof: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);
  const BASE = 'http://localhost:' + PORT + '/flyDiy/index.html', B0 = MB.BUILDS.cub, R = {};
  for (const side of ORDER) {
    const b = await MB.browser(UDD);
    await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 1000 }); await b.cmd('Profiler.start');
    const l = await b.load(BASE + '?' + SIDE[side], MB.preScript(B0.build, null, B0.patch));
    const p = (await b.cmd('Profiler.stop')).result.profile;
    const A = agg(p); R[side] = A;
    const busy = Object.entries(A.self).filter(([k]) => !/^\((idle|program)\)/.test(k)).reduce((a, [, v]) => a + v, 0);
    console.log(side + ' ' + l.sec + ' s, main-thread busy ' + (busy / 1000).toFixed(1) + ' s');
    await b.close();
  }
  const d = which => { const a = R.A[which], c = R.B[which]; return [...new Set([...Object.keys(a), ...Object.keys(c)])].map(k => [k, Math.round((c[k] || 0) - (a[k] || 0))]).sort((x, y) => y[1] - x[1]); };
  console.log('\nSELF ms, on - off:'); for (const [k, v] of d('self').slice(0, 30)) console.log('  ' + String(v).padStart(6) + '  ' + k);
  console.log('\nINCLUSIVE ms, on - off:'); for (const [k, v] of d('incl').slice(0, 45)) console.log('  ' + String(v).padStart(6) + '  ' + k);
  if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify(R));
  try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
