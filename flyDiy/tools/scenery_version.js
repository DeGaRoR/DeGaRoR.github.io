#!/usr/bin/env node
// scenery_version.js - SCENERY VERSIONS (ED-2, 24 Oct): a named scenery version into the repo. The WORLD panel's "save my edits as
// a version" downloads <id>.json (a premises envelope + its `scenery` stamp {id, name, date, base}); this files it under
// media/scenery/<island>/ and lists it in that folder's index.json - from then on every machine loads it with the Scenery picker
// or ?scenery=<id>. A user's save (the editor's FILE export, no stamp) takes --id / --name.
//   node tools/scenery_version.js add <file.json> [--island jolene] [--id <id>] [--name "<name>"] [--from "<what it came from>"]
//   node tools/scenery_version.js list [--island jolene]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const island = opt('island', 'jolene'), dir = path.join(ROOT, 'media', 'scenery', island), ixf = path.join(dir, 'index.json');
const readIx = () => (fs.existsSync(ixf) ? JSON.parse(fs.readFileSync(ixf, 'utf8')) : { versions: [] });
const writeIx = ix => fs.writeFileSync(ixf, JSON.stringify(ix, null, 1) + '\n');
if (argv[0] === 'list') { for (const v of readIx().versions) console.log(v.id + '  ' + v.name + '  ' + (v.date || '') + '  ' + v.file + (v.from ? '  (' + v.from + ')' : '')); process.exit(0); }
if (argv[0] !== 'add' || !argv[1]) { console.error('usage: scenery_version.js add <file.json> [--island i] [--id id] [--name n] [--from f] | list'); process.exit(2); }
const src = fs.readFileSync(argv[1], 'utf8'), o = JSON.parse(src);
const rec = o.premises || o;
if (!rec || !rec.layers) { console.error('not a premises record: ' + argv[1]); process.exit(3); }
const st = o.scenery || {};
const name = opt('name', st.name || path.basename(argv[1]).replace(/\.json$/i, ''));
const id = (opt('id', st.id || (island + '-' + name))).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const date = st.date || new Date().toISOString().slice(0, 10);
o.scenery = Object.assign({}, st, { id, name, date });
fs.mkdirSync(dir, { recursive: true });
const file = id + '.json';
fs.writeFileSync(path.join(dir, file), JSON.stringify(o));
const ix = readIx();
ix.versions = ix.versions.filter(v => v.id !== id).concat([{ id, name, file, date, from: opt('from', st.from || null), base: st.base || o.base || null, rev: rec.rev || null }]);
writeIx(ix);
console.log('version ' + id + ' ("' + name + '") -> media/scenery/' + island + '/' + file + '; index: ' + ix.versions.length + ' version(s)');
