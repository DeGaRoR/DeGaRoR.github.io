// COLD-LINKS: summarise cessna_links outputs - per load and median / min-max per group (load index 0 = cold, 1 = warm)
// usage: node summ.js <label>=<file1,file2,...> ...
const fs = require('fs');
const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const rng = a => a.length ? Math.min(...a).toFixed(1) + '-' + Math.max(...a).toFixed(1) : '-';
for (const arg of process.argv.slice(2)) {
  const [label, list] = arg.split('=');
  const byIdx = {};
  for (const f of list.split(',')) {
    if (!fs.existsSync(f)) { console.log(label + ': missing ' + f); continue; }
    const R = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const l of R.loads) {
      const ms = (l.keys || []).map(k => +k.split(':')[1]).filter(x => x >= 0);
      const row = { garage: l.sec, roll: l.rollout, flight: l.rollout != null ? +(l.sec + l.rollout).toFixed(1) : null, links: l.links, worst: ms.length ? Math.max(...ms) / 1000 : 0,
        over5: l.over5s, over1: l.over1s, flown: l.flownLinks, state: l.state, exc: (l.exc || []).length };
      (byIdx[l.i] = byIdx[l.i] || []).push(row);
      console.log(label + ' L' + l.i + ' ' + f.split(/[\\/]/).pop() + ': garage ' + row.garage + ' s, roll-out ' + row.roll + ' s, first flight ' + row.flight + ' s, links ' + row.links + ', worst ' + row.worst.toFixed(1) + ' s, >5 s ' + row.over5 + ', >1 s ' + row.over1 + ', flown links ' + row.flown + ' (' + row.state + (row.exc ? ', EXC ' + row.exc : '') + ')');
      for (const s of (l.slow || []).filter(s => s.ms > 5000)) console.log('      ' + String(s.t0).padStart(6) + ' ms  ' + (s.ms / 1000).toFixed(1) + ' s  ' + s.k);
    }
  }
  for (const i in byIdx) { const L = byIdx[i], g = k => L.map(r => r[k]).filter(x => x != null);
    console.log('== ' + label + ' load ' + i + ' (' + (i === '0' ? 'cold' : 'warm') + ', n=' + L.length + '): garage ' + med(g('garage')).toFixed(1) + ' [' + rng(g('garage')) + '], first flight ' + med(g('flight')).toFixed(1) + ' [' + rng(g('flight')) + '], roll-out ' + med(g('roll')).toFixed(1) + ' [' + rng(g('roll')) + '], worst link ' + med(g('worst')).toFixed(1) + ' [' + rng(g('worst')) + '], >5 s ' + med(g('over5')) + ' [' + rng(g('over5')) + '], links ' + med(g('links')) + ' [' + rng(g('links')) + ']'); }
}
