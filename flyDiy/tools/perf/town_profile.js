#!/usr/bin/env node
// town_profile.js - WHERE THE TOWN STEP'S MAIN-THREAD TIME GOES (HW-COVERAGE G1999, A0: "make the retro town step CHEAPER").
// Reads a Chrome .cpuprofile (rollout_perf --profile-boot writes <label>_boot.cpuprofile: the garage boot from the navigation to
// 'ready') and keeps only the samples whose stack passes through the town step (by default render_premises' prewarm / prewarmW
// and app.js's premisesPrewarm - the 'town' step's slices; --root '<regex>' for another step), then prints:
//   - the step's total sampled ms and its share of the boot's
//   - SELF time per function inside it (where the CPU actually is), top --top (40)
//   - INCLUSIVE time per function inside it (what each call chain costs), top --top
//   - the direct callees of the root(s) with their inclusive ms (the step's parts: placement, merges, obstacles, the walks)
//   node tools/perf/town_profile.js <file.cpuprofile> [--root 'prewarmW?$'] [--top 40] [--json out.json]
// A profile under --cpu-throttle N is N x slower everywhere: compare SHARES across runs, not ms.
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const file = argv.find(a => !a.startsWith('--') && /\.cpuprofile$/.test(a));
if (!file) { console.error('town_profile: give a .cpuprofile'); process.exit(2); }
const ROOT = new RegExp(opt('root', '^(prewarmW?|premisesPrewarm)$'));
const TOP = +opt('top', 40);
const P = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(P.nodes.map(n => [n.id, n]));
const parent = new Map(); for (const n of P.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
const key = n => (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url || '').split('/').pop().split('?')[0] + ':' + (n.callFrame.lineNumber + 1);
const dt = new Map();
for (let i = 0; i < P.samples.length; i++) dt.set(P.samples[i], (dt.get(P.samples[i]) || 0) + (P.timeDeltas[i] || 0) / 1000);
let total = 0, inStep = 0;
const self = new Map(), incl = new Map(), parts = new Map();
for (const [id, ms] of dt) {
  total += ms;
  // the stack, leaf to root
  const stack = []; for (let x = id; x != null; x = parent.get(x)) stack.push(byId.get(x));
  const ri = stack.findIndex(n => ROOT.test(n.callFrame.functionName || ''));
  if (ri < 0) continue;
  inStep += ms;
  const leaf = key(stack[0]); self.set(leaf, (self.get(leaf) || 0) + ms);
  const seen = new Set();
  for (let i = 0; i <= ri; i++) { const k = key(stack[i]); if (seen.has(k)) continue; seen.add(k); incl.set(k, (incl.get(k) || 0) + ms); }
  // the root's direct callee on this stack (the step's part)
  const part = ri > 0 ? key(stack[ri - 1]) : '(the root itself)'; parts.set(part, (parts.get(part) || 0) + ms);
}
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
const fmt = (ms, of) => (ms / 1000).toFixed(2).padStart(7) + ' s ' + (100 * ms / of).toFixed(1).padStart(5) + ' %';
console.log('town_profile ' + file);
console.log('  the step (' + ROOT + '): ' + (inStep / 1000).toFixed(2) + ' s sampled of the profile\'s ' + (total / 1000).toFixed(2) + ' s (' + (100 * inStep / total).toFixed(1) + ' %)');
console.log('  THE PARTS (the root\'s direct callees, inclusive):'); for (const [k, v] of top(parts, 20)) console.log('   ' + fmt(v, inStep) + '  ' + k);
console.log('  SELF (top ' + TOP + '):'); for (const [k, v] of top(self, TOP)) console.log('   ' + fmt(v, inStep) + '  ' + k);
console.log('  INCLUSIVE (top ' + TOP + '):'); for (const [k, v] of top(incl, TOP)) console.log('   ' + fmt(v, inStep) + '  ' + k);
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify({ file, root: String(ROOT), totalMs: total, stepMs: inStep, parts: top(parts, 50), self: top(self, 200), incl: top(incl, 200) }, null, 1));
