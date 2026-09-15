#!/usr/bin/env node
// tsl_census.js — THE GLSL SURFACE, COUNTED (2026-09-14, the user: "we have
// not moved all materials to TSL, and then we can't have the WebGPU renderer
// ... is this work worth doing?").
//
// WHAT IT DOES. Reads the game page's own script list (dev.html — the same
// 170-odd files index.html is built from) and counts, per file, every site
// the node renderer cannot draw: `onBeforeCompile` hooks (silently ignored
// under WebGPURenderer, the material draws PLAIN), raw ShaderMaterials and
// custom MeshDepthMaterials (refused at DRAW time, "NodeBuilder: Material is
// not compatible") — against the sites already written as node materials
// (the TSL variants chosen on TSL_ON). Prints the table and the totals;
// `--since <git ref>` prints the same table for that ref's tree and the
// delta, so the debt is a number on the register rather than a feeling.
//
// WHY A TOOL AND NOT A GATE. RENDERER-DECISION §4k rules W0.5b (GLSL → TSL)
// a GATED chantier, not a background stream: peers write GLSL on the shipped
// path by design, and a count must never turn their work red. This tool is
// the instrument the §4k triggers read; it changes nothing.
//
//   node tools/tsl_census.js                 the tree as it stands
//   node tools/tsl_census.js --since 61c7bf87   ... and the delta since G400
//   node tools/tsl_census.js --all           every src/ and tools/ file, not
//                                            only the game page's list
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const sinceAt = args.indexOf('--since');
const SINCE = sinceAt >= 0 ? args[sinceAt + 1] : null;
const ALL = args.includes('--all');

// The kinds, and what each means under the node renderer.
const KINDS = [
  { key: 'hooks',  re: /onBeforeCompile\s*=/g,                  note: 'ignored (draws plain)' },
  { key: 'raw',    re: /new THREE\.(?:Raw)?ShaderMaterial\b/g,  note: 'refused at draw' },
  { key: 'depth',  re: /new THREE\.MeshDepthMaterial\b/g,       note: 'refused at draw' },
  { key: 'ported', re: /new THREE\.\w+NodeMaterial\b/g,         note: 'TSL variant exists' },
];

// The game path: every script dev.html loads (built pages carry the same list).
function gameFiles(readFile) {
  const html = readFile('dev.html');
  if (html == null) return [];
  const seen = new Set();
  const re = /src="((?:src|tools)\/[^"?]+\.js)(?:\?[^"]*)?"/g;   // the tags carry a ?v= cache-buster
  let m; while ((m = re.exec(html))) seen.add(m[1]);
  return [...seen];
}
function allFiles() {
  const out = [];
  const walk = d => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
    else if (e.name.endsWith('.js')) out.push(p);
  } };
  walk('src'); walk('tools');
  return out;
}

function census(readFile, files) {
  const rows = [];
  for (const f of files) {
    const txt = readFile(f);
    if (txt == null) continue;
    const row = { file: f };
    let any = false;
    for (const k of KINDS) { const n = (txt.match(k.re) || []).length; row[k.key] = n; any = any || n > 0; }
    if (any) rows.push(row);
  }
  rows.sort((a, b) => (b.hooks + b.raw + b.depth) - (a.hooks + a.raw + a.depth) || a.file.localeCompare(b.file));
  const tot = { file: 'TOTAL' };
  for (const k of KINDS) tot[k.key] = rows.reduce((s, r) => s + r[k.key], 0);
  return { rows, tot };
}

const readTree = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; } };
const readRef = ref => f => { try { return cp.execFileSync('git', ['show', `${ref}:flyDiy/${f}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } };

function print(title, c) {
  console.log(`\n${title}`);
  const w = Math.max(...c.rows.map(r => r.file.length), 5) + 2;
  console.log('  ' + 'file'.padEnd(w) + KINDS.map(k => k.key.padStart(8)).join(''));
  for (const r of [...c.rows, c.tot]) {
    if (r === c.tot) console.log('  ' + '-'.repeat(w + 8 * KINDS.length));
    console.log('  ' + r.file.padEnd(w) + KINDS.map(k => String(r[k.key]).padStart(8)).join(''));
  }
  const glsl = c.tot.hooks + c.tot.raw + c.tot.depth;
  console.log(`  GLSL sites the node renderer cannot draw: ${glsl}   (hooks ${KINDS[0].note}; raw/depth ${KINDS[1].note})`);
  console.log(`  TSL variants written: ${c.tot.ported}`);
}

const now = census(readTree, ALL ? allFiles() : gameFiles(readTree));
print(ALL ? 'THE TREE (every src/ and tools/ file)' : 'THE TREE (the game page\'s script list)', now);

if (SINCE) {
  const rd = readRef(SINCE);
  const then = census(rd, ALL ? allFiles() : gameFiles(rd));
  print(`AT ${SINCE}`, then);
  const d = k => now.tot[k] - then.tot[k];
  const sign = n => (n > 0 ? '+' : '') + n;
  console.log(`\nDELTA since ${SINCE}: hooks ${sign(d('hooks'))}, raw ${sign(d('raw'))}, depth ${sign(d('depth'))}, ported ${sign(d('ported'))}`
    + `  →  GLSL surface ${sign(d('hooks') + d('raw') + d('depth'))}, TSL ${sign(d('ported'))}`);
  const changed = new Map();
  for (const r of now.rows) changed.set(r.file, { now: r });
  for (const r of then.rows) (changed.get(r.file) || changed.set(r.file, {}).get(r.file)).then = r;
  // A file that was not on the page at the ref (a bench that joined the game,
  // as _house_gen.js did with the premises port) is a JOIN, not new GLSL —
  // both grow the surface the port must cover, but they are different facts.
  const thenPage = new Set(ALL ? [] : gameFiles(rd));
  const lines = [];
  for (const [f, v] of changed) {
    const a = v.then || {}, b = v.now || {};
    const parts = KINDS.map(k => (b[k.key] || 0) - (a[k.key] || 0)).map((n, i) => n ? `${KINDS[i].key} ${sign(n)}` : null).filter(Boolean);
    if (!parts.length) continue;
    let joined = '';
    if (!ALL && !thenPage.has(f) && v.now) {
      const t = rd(f);   // the file at the ref, off the page: its own counts say whether the sites are new
      const same = t != null && KINDS.every(k => (t.match(k.re) || []).length === v.now[k.key]);
      joined = same ? '  (joined the page; the sites already existed)' : '  (joined the page; the sites are new)';
    }
    lines.push(`  ${f}: ${parts.join(', ')}${joined}`);
  }
  if (lines.length) { console.log('  by file:'); lines.forEach(l => console.log(l)); }
}
