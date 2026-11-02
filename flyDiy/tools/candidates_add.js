#!/usr/bin/env node
// candidates_add.js - CANDIDATE OFFICIAL (the user, 2 Nov): file aeroplanes into the staging pool, builds/candidates/.
// A TOOL, not a gate (GATE CANDIDATES holds the pool).
//
//   node tools/candidates_add.js <file.json> [more...] [--from="the user"] [--only=<slot>,<slot>] [--review] [--force] [--dry]
//
// <file.json> is either ONE build (a garage export: an envelope with a spec) - filed under ITS OWN file name - or the
// garage's EXPORT ALL file (what 'flydiy-fleet', every saved build of a browser) - each build filed under its slot's
// name (a career's ' @<career>' tag dropped), `--only` picking some. Every filed build loses its plaque (a candidate
// claims no certificate) and keeps the rest as saved; index.json gains a row (name = the build's own name). An existing
// file is never overwritten without --force (an identical one is skipped). --review files them into review/ instead (not
// offered, not in the index; a row to write in review/REVIEW.md) - the user promotes them. Then: node tools/_candidates_check.js.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'builds', 'candidates'), IDX = path.join(DIR, 'index.json');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const flag = k => argv.includes('--' + k);
const inputs = argv.filter(a => !a.startsWith('--'));
if (!inputs.length) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 12).join('\n')); process.exit(2); }
const FROM = opt('from', 'the user'), ONLY = opt('only', null), FORCE = flag('force'), DRY = flag('dry'), REVIEW = flag('review');

const idx = JSON.parse(fs.readFileSync(IDX, 'utf8'));
const fileOf = n => String(n).replace(/ @[^@]*$/, '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') + '.json';
const todo = [];
for (const inp of inputs) {
  const o = JSON.parse(fs.readFileSync(inp, 'utf8'));
  if (o && o.what === 'flydiy-fleet' && Array.isArray(o.builds)) {
    const pick = ONLY ? new Set(ONLY.split(',')) : null;
    for (const b of o.builds) {
      const slot = b.slot || b.name;
      if (pick && !pick.has(slot)) continue;
      const env = Object.assign({}, b); delete env.slot;
      todo.push({ file: fileOf(slot), env, name: (b.spec && b.spec.meta && b.spec.meta.name) || b.name || slot });
    }
  } else if (o && o.spec && typeof o.spec === 'object') {
    todo.push({ file: path.basename(inp), env: o, name: (o.spec.meta && o.spec.meta.name) || o.name || path.basename(inp, '.json') });
  } else throw new Error(inp + ' is neither a build nor an export-all file');
}
let n = 0;
for (const t of todo) {
  if (!/^[\w .()-]+\.json$/.test(t.file) || t.file === 'index.json') { console.log('skip ' + t.file + ': not a plain file name'); continue; }
  const env = Object.assign({}, t.env); delete env.plaque;
  const txt = JSON.stringify(env);
  const dst = path.join(DIR, REVIEW ? 'review' : '', t.file);
  if (fs.existsSync(dst)) {
    if (fs.readFileSync(dst, 'utf8') === txt) { console.log('same ' + t.file); continue; }
    if (!FORCE) { console.log('EXISTS ' + t.file + ' (differs) - not overwritten (--force)'); continue; }
  }
  if (!DRY) fs.writeFileSync(dst, txt);
  if (REVIEW) console.log('  add its row to review/REVIEW.md');
  else if (!idx.planes.some(p => p.file === t.file)) idx.planes.push({ file: t.file, name: t.name, note: '', from: FROM });
  console.log((DRY ? 'would file ' : 'filed ') + t.file + ' (' + t.name + ')'); n++;
}
if (!DRY && n && !REVIEW) fs.writeFileSync(IDX, JSON.stringify(idx, null, 2).replace(/\{\n\s+("file"[^}]*?)\n\s+\}/g, (m, b) => '{ ' + b.replace(/\n\s+/g, ' ') + ' }') + '\n');
console.log(n + ' filed; next: node tools/_candidates_check.js');
