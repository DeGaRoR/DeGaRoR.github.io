// the READY note's gate block, from the battery's own tables (verdicts.js): this tree's (gatelogs5, d77583540), then
// the earlier battery's (gatelogs3, 791c23ea7) for the gates not re-run, then the master comparison (master_reds*.log)
const fs = require('fs'), S = __dirname, V = require(S + '/verdicts.js');
const g5 = V(S + '/gatelogs5'), g3 = V(S + '/gatelogs3');
const ids = fs.readFileSync(S + '/ids5.txt', 'utf8').trim().split(',');
const since = new Set(fs.readFileSync(S + '/since_ids.txt', 'utf8').trim().split(','));
const mred = new Map();
for (const f of ['master_reds.log', 'master_reds2.log', 'master_reds3.log']) {
  if (!fs.existsSync(S + '/' + f)) continue;
  const t = fs.readFileSync(S + '/' + f, 'utf8');
  for (const m of t.matchAll(/^([A-Z0-9_-]+)\s+(PASS|FAIL|SKIP)\b/mg)) {
    const lines = [...t.matchAll(new RegExp('^GATE ' + m[1] + ': (.*)$', 'mg'))].map(x => x[1]);
    mred.set(m[1], m[2] === 'PASS' ? 'PASS' : (lines.find(l => !/^PASS/.test(l)) || 'FAIL'));
  }
}
const out = [], reds = [], notrun = [];
for (const id of ids) {
  if (g5.has(id)) { const o = g5.get(id); out.push('    ' + o.line); if (o.v === 'FAIL') reds.push(id); }
  else if (g3.has(id)) { const o = g3.get(id);
    out.push('    ' + o.line + (since.has(id) ? '   [791c23ea7 ONLY - reads a file changed since; not re-run in time]' : '   [791c23ea7]'));
    if (o.v === 'FAIL') reds.push(id); }
  else notrun.push(id);
}
console.log(out.join('\n'));
console.log('REDS ' + reds.map(r => r + ' [master d7e181f4e: ' + (mred.get(r) || 'not run') + ']').join('; '));
console.log('NOTRUN ' + notrun.join(','));
