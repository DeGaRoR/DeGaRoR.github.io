// node sweepdiff.js base.json new.json - what moved
const fs = require('fs');
const [A, B] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
let same = 0; const moved = [];
for (const f of Object.keys(A)) {
  const a = A[f], b = B[f];
  if (!b) { moved.push(f + '  (missing in new)'); continue; }
  if (a.err || b.err || a.skip) { if (a.err !== b.err) moved.push(f + '  err: ' + (a.err || '-') + ' -> ' + (b.err || '-')); continue; }
  if (a.hash === b.hash) { same++; continue; }
  moved.push(f.padEnd(62) + ' empty ' + a.empty.toFixed(1) + ' -> ' + b.empty.toFixed(1) + ' (' + (b.empty - a.empty >= 0 ? '+' : '') + (b.empty - a.empty).toFixed(1) + ')  cgX ' + a.cgX.toFixed(3) + ' -> ' + b.cgX.toFixed(3) +
             '  ' + a.mat + '/' + a.susp + ' seats ' + a.seats + ' drawn ' + a.seatsX + (a.n !== b.n || a.nb !== b.nb ? '  TOPOLOGY ' + a.n + '/' + a.nb + ' -> ' + b.n + '/' + b.nb : ''));
}
console.log('identical (bit for bit): ' + same);
console.log('moved: ' + moved.length); for (const m of moved) console.log('  ' + m);
