// _stock_row.js (G461) — A SAVED BUILD AS A STOCK DESIGN, printed in the
// shape tools/_cage_page5.js keeps them: the `presets` row (the cage with
// _base: 'template') and the `builds` row (every section but the cage,
// nulls kept). Paste each under the last row of its table.
//
//   node tools/_stock_row.js builds/x_corrected.json 'chinook' [--presets|--builds]
const fs = require('fs');
const [file, name, which] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const spec = raw.spec || raw;
const key = /^[a-zA-Z_$][\w$]*$/;
const q = k => key.test(k) ? k : JSON.stringify(k);
const val = v => v === null ? 'null' : typeof v === 'string' ? JSON.stringify(v) : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : null;
function wrapPairs(pairs, indent, width) {
  const lines = []; let cur = '';
  for (const p of pairs) { const piece = p + ', '; if ((cur + piece).length > width && cur) { lines.push(cur.trimEnd()); cur = ''; } cur += piece; }
  if (cur) lines.push(cur.trimEnd());
  return lines.map(l => ' '.repeat(indent) + l).join('\n');
}
function presetRow() {
  const c = Object.assign({ _base: 'template' }, spec.cage);
  const pairs = Object.entries(c).map(([k, v]) => q(k) + ': ' + val(v));
  return `    ${JSON.stringify(name)}: {\n${wrapPairs(pairs, 6, 76)}\n    },`;
}
function fmt(v, ind) {
  const pad = ' '.repeat(ind);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every(x => val(x) !== null)) return '[' + v.map(val).join(', ') + ']';
    return '[' + v.map(x => fmt(x, ind + 2)).join(', ') + ']';
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v); if (!ks.length) return '{}';
    return '{\n' + ks.map(k => pad + '  ' + q(k) + ': ' + fmt(v[k], ind + 2)).join(',\n') + ' }';
  }
  return val(v);
}
function buildRow() {
  const b = {}; for (const k of Object.keys(spec)) if (k !== 'cage' && k !== 'plaque' && k !== 'log' && k !== 'v') b[k] = spec[k];
  const body = Object.keys(b).map(k => '      ' + q(k) + ': ' + fmt(b[k], 6)).join(',\n');
  return `    ${JSON.stringify(name)}: {\n${body},\n    },`;
}
if (which !== '--builds') console.log(presetRow());
if (which !== '--presets') console.log(buildRow());
