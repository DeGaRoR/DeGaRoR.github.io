// RETRACT-ROBUST: the matrix's results as a markdown table (one row a case) + the reds classified
'use strict';
const fs = require('fs'), path = require('path');
const D = process.argv[2];
const cls = w => /meet/.test(w) ? 'units-clash' : /floor/.test(w) ? 'no-room(floor)' : /spar/.test(w) ? 'structure(spar)' : /trunnion|mount/.test(w) ? 'structure(mount)'
  : /brace|actuator|stroke/.test(w) ? 'mechanism' : /door/.test(w) ? 'door-clash' : /strut|flap|plane|engine|nacelle|bay/.test(w) ? 'clash(' + (w.match(/strut|flap|plane|engine|nacelle|bay/) || [''])[0] + ')'
  : /not inside|outside|out of|through|proud|recess|centred/.test(w) ? 'no-room(skin)' : 'other';
const rows = ['| case | rows over | fits | reds (first, +n) | classes | body cuts | wing cuts | side | nacelle | doors (leg/well; well shut down) |', '|---|---|---|---|---|---|---|---|---|---|'];
const files = fs.readdirSync(D).filter(f => f.endsWith('.json')).sort();
const agg = {};
for (const f of files) { let r; try { r = JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); } catch (e) { rows.push('| ' + f + ' | - | CRASH | ' + fs.readFileSync(path.join(D, f.replace('.json', '.log')), 'utf8').slice(0, 120).replace(/\n|\|/g, ' ') + ' |'); continue; }
  const n = f.replace('.json', ''); const o = Object.assign({}, r.over); delete o.gearRetract;
  const why = r.fit ? r.fit.why : []; const C = [...new Set(why.map(cls))];
  for (const c of C) agg[c] = (agg[c] || 0) + 1;
  const dl = r.doors.filter(d => d.kind === 'leg').length, dw = r.doors.filter(d => d.kind !== 'leg'), dws = dw.filter(d => d.closedDown).length;
  const cs = a => a.length ? a.map(c => c.units.join('+') + ':' + c.mode + '(' + c.pts + ')').join(' ') : '-';
  rows.push('| ' + n + ' | `' + JSON.stringify(o) + '` | ' + (!r.retractable ? 'not retractable' : r.fit && r.fit.ok ? 'yes' : 'RED') + ' | ' + (why.length ? why[0].replace(/\|/g, '/') + (why.length > 1 ? ' (+' + (why.length - 1) + ')' : '') : '-') + ' | ' + C.join(', ') + ' | ' + cs(r.cuts) + ' | ' + cs(r.cutsWing) + ' | ' + cs(r.cutsSide) + ' | ' + cs(r.cutsNac) + ' | ' + dl + '/' + dw.length + '; ' + dws + ' |' + (r.layerErrors.length ? ' ERR ' + r.layerErrors[0].slice(0, 80) : ''));
}
console.log(rows.join('\n'));
console.log('\nclasses (cases with at least one): ' + JSON.stringify(agg));
