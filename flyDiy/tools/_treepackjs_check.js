// GATE TREEPACKJS - the page's tree pack (src/viewer/trees_pack.js, TREE_PACK) is the one the json says (src/core/trees_pack.json).
// MOUNTAIN-VEG 17 Nov 2026: two days of mix and species edits sat in the json - the gates and the bench saw them, the GAME did not
// (the page reads the baked js, which only tree_prep wrote). tools/tree_pack_js.py writes the js from the json with tree_prep's own
// writer; this gate fails when the two differ (fix: python tools/tree_pack_js.py).
'use strict';
const path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m, x) => { console.log((c ? '  ok   ' : '  FAIL ') + m + (x !== undefined ? '  (' + x + ')' : '')); if (!c) fails++; };
console.log('GATE TREEPACKJS - the page\'s tree pack is the json\'s');
const py = process.env.PYTHON || 'python';
const r = spawnSync(py, [path.join(ROOT, 'tools', 'tree_pack_js.py'), '--check'], { cwd: ROOT, encoding: 'utf8' });
ok(r.status === 0, 'src/viewer/trees_pack.js is what tools/tree_pack_js.py writes from src/core/trees_pack.json (fix: python tools/tree_pack_js.py)',
   ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-1)[0]);
console.log('GATE TREEPACKJS: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
