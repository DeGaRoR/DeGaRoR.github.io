const D = require('./diag.js'), fs = require('fs');
const k = process.argv[2], rec = JSON.parse(fs.readFileSync(__dirname + '/p_' + k + '.json'));
rec.label = process.argv[3] || k;
const t0 = Date.now(); const FM = JSON.parse(fs.readFileSync(__dirname + '/fiche_masks.json')); const A = D.analyse(rec, process.argv[4] === 'editor' ? null : FM[k] || null);
console.log(k, (Date.now() - t0) + 'ms', 'fit', ['side', 'plan', 'front'].map(v => A.V[v].fr.score + '/' + A.V[v].fr.n + '@' + A.V[v].fr.rot).join(' '));
for (const m of A.meas) console.log('  ', Math.abs(m.d) > 0.03 ? 'OFF' : 'ok ', m.label.padEnd(28), m.drawn.toFixed(2), m.flown.toFixed(2), (m.d * 100).toFixed(1) + '%');
fs.writeFileSync(__dirname + '/d_' + k + '.svg', D.draw(rec, A));
