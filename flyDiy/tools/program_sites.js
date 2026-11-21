#!/usr/bin/env node
// program_sites.js - EVERY PLACE THE GAME MAKES A MATERIAL, AND WHETHER IT SAYS WHOSE IT IS
// (PERF-TRACE, 22 Nov 2026: the user - "retro fit shader identity and force the new ones to explicitly declare
// themselves"; src/viewer/program_id.js is the declaration, GATE PROGRAMS part 7 runs this scan)
//
// A material is where a WebGL program comes from. This reads src/ for every site that makes one:
//     new THREE.<X>Material( ... )      (and the aliases T. / TH. / THREE_.)
//     MATLIB.make( ... ) / MATLIB.shared( ... )
// and holds each to ONE of the accepted declarations of its owner ('feature / system / variant'):
//   inline    `progOwner` inside the call's own arguments:  new THREE.MeshBasicMaterial({ userData: { progOwner: '...' }, ... })
//             or MATLIB.make / shared's owner argument (matlib.js writes userData.progOwner, outside the share signature)
//   wrapped   the call is the first argument of an own():   PROGRAMS.own(new THREE...(...), '...')
//   after     the variable it is assigned to is declared within the next 12 lines:
//             PROGRAMS.own(m, '...')   or   m.userData.progOwner = '...'
//   tagged    a comment on the site's line or the line above:  // progOwner: <who declares it and where>
//             (a factory whose CALLER declares, three's own depth twin, ...). Tagged sites are LISTED, never silent:
//             the census of the standard boots (tools/perf/program_owners.json) is what proves them owned.
// A site with none of these is UNDECLARED: GATE PROGRAMS fails on it, with its file and line.
//
//   node tools/program_sites.js            the table: sites by file, declared / tagged / UNDECLARED
//   node tools/program_sites.js --todo     the undeclared sites only, with their context (for the retrofit)
//   node tools/program_sites.js --owners   every owner string declared in src/, with its sites
// AS A MODULE: require('./program_sites.js').scan() -> { sites, files }
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const SITE = /\bnew\s+(?:THREE_?|TH|T)\.(\w*Material)\s*\(|\bMATLIB\.(make|shared)\s*\(/g;

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f), st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out); else if (f.endsWith('.js')) out.push(p); }
  return out;
}
// the index of the paren that closes the one at `open` (strings, templates and comments skipped)
function closeOf(s, open) {
  let d = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2); if (i < 0) return -1; i++; continue; }
    if (c === '(') d++; else if (c === ')') { d--; if (d === 0) return i; }
  }
  return -1;
}
// blank the comments and the strings' contents of a source (same length, same lines): a site named in prose is not a site
function codeOnly(s) {
  const out = s.split('');
  const blank = (a, b) => { for (let i = a; i < b; i++) if (out[i] !== '\n') out[i] = ' '; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { const e = s.indexOf('\n', i); const j = e < 0 ? s.length : e; blank(i, j); i = j; continue; }
    if (c === '/' && s[i + 1] === '*') { let e = s.indexOf('*/', i + 2); e = e < 0 ? s.length : e + 2; blank(i, e); i = e - 1; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < s.length && s[j] !== c && s[j] !== '\n') { if (s[j] === '\\') j++; j++; } blank(i + 1, j); i = j; continue; }
    if (c === '`') { let j = i + 1; while (j < s.length && s[j] !== '`') { if (s[j] === '\\') j++; j++; } blank(i + 1, j); i = j; continue; }
  }
  return out.join('');
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), code = codeOnly(src), lines = src.split('\n');
  const lineAt = []; { let n = 0; for (let i = 0; i < src.length; i++) { lineAt.push(n); if (src[i] === '\n') n++; } }
  const sites = []; let m; SITE.lastIndex = 0;
  while ((m = SITE.exec(code))) {
    const at = m.index, open = at + m[0].length - 1, close = closeOf(src, open), line = lineAt[at];
    const args = close > open ? src.slice(open + 1, close) : '';
    const kind = m[1] ? m[1] : 'MATLIB.' + m[2];
    let how = null, owner = null;
    const own = /progOwner\s*:\s*(['"`])((?:(?!\1).)*)\1/.exec(args) || /progOwner\s*:\s*([^,}\n]+)/.exec(args);
    if (own) { how = 'inline'; owner = own[2] !== undefined ? own[2] : '(' + own[1].trim() + ')'; }
    // MATLIB's owner argument: make(THREE, shape, params, owner) / shared(THREE, shape, params, scope, owner): a last string argument
    if (!how && m[2]) { const tail = /,\s*(['"`])((?:(?!\1).)*? \/ (?:(?!\1).)*)\1\s*$/.exec(args); if (tail) { how = 'inline'; owner = tail[2]; } }
    if (!how) {   // wrapped: ... own( <site> , 'owner' )
      const before = code.slice(Math.max(0, at - 40), at), after = src.slice(close + 1, close + 400);
      const w = /\bown\(\s*$/.exec(before), a = /^\s*,\s*(['"`])((?:(?!\1).)*)\1/.exec(after) || /^\s*,\s*([^)\n]+)\)/.exec(after);
      if (w && a) { how = 'wrapped'; owner = a[2] !== undefined ? a[2] : '(' + a[1].trim() + ')'; }
    }
    // the variable it lands in: `const m = new ...`, `m = new ...`, `this.x = new ...`, `{ key: new ... }` gives none
    let v = null; { const pre = code.slice(Math.max(0, at - 120), at), a = /([\w$.\[\]']+)\s*=\s*(?:\w+\(\s*)?$/.exec(pre); if (a) v = a[1]; }
    if (!how && v) {
      const endLine = close > 0 ? lineAt[close] : line, next = lines.slice(endLine, endLine + 13).join('\n'), q = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const a = new RegExp('\\bown\\(\\s*' + q + '\\s*,\\s*([\'"`])((?:(?!\\1).)*)\\1').exec(next) || new RegExp('\\bown\\(\\s*' + q + '\\s*,\\s*([^)\\n]+)\\)').exec(next)
        || new RegExp(q + '\\.userData\\.progOwner\\s*=\\s*([\'"`])((?:(?!\\1).)*)\\1').exec(next) || new RegExp(q + '\\.userData\\.progOwner\\s*=\\s*([^;\\n]+)').exec(next);
      if (a) { how = 'after'; owner = a[2] !== undefined ? a[2] : '(' + a[1].trim() + ')'; }
    }
    if (!how) { const tag = /\/\/\s*progOwner:\s*(.+)$/.exec(lines[line] || '') || /\/\/\s*progOwner:\s*(.+)$/.exec(lines[line - 1] || ''); if (tag) { how = 'tagged'; owner = tag[1].trim(); } }
    // the function it is made in (the nearest `function name(` / `name = (...) =>` / `name(...) {` above it)
    let fn = ''; for (let k = line; k >= Math.max(0, line - 200); k--) { const f = /function\s+([\w$]+)\s*\(/.exec(lines[k]) || /(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/.exec(lines[k]) || /^\s{2,6}([\w$]+)\s*\([^)]*\)\s*\{/.exec(lines[k]); if (f) { fn = f[1]; break; } }
    sites.push({ file: path.relative(SRC, file).replace(/\\/g, '/'), line: line + 1, kind, how, owner, v, fn, text: (lines[line] || '').trim().slice(0, 200) });
  }
  return sites;
}
function scan() {
  const files = walk(SRC, []).sort(), sites = [];
  for (const f of files) for (const s of scanFile(f)) sites.push(s);
  return { sites, files: files.length };
}
module.exports = { scan, scanFile, closeOf, codeOnly };

if (require.main === module) {
  const argv = process.argv.slice(2), R = scan(), S = R.sites;
  const by = new Map(); for (const s of S) { let g = by.get(s.file); if (!g) by.set(s.file, g = { n: 0, declared: 0, tagged: 0, un: 0 }); g.n++; if (!s.how) g.un++; else if (s.how === 'tagged') g.tagged++; else g.declared++; }
  if (argv.includes('--todo')) { for (const s of S.filter(x => !x.how)) console.log(s.file + ':' + s.line + '\t' + s.kind + '\t' + (s.v || '-') + '\t' + (s.fn || '-') + '\t' + s.text.slice(0, 150)); }
  else if (argv.includes('--owners')) { const o = new Map(); for (const s of S.filter(x => x.how)) { const k = s.owner; if (!o.has(k)) o.set(k, []); o.get(k).push(s.file + ':' + s.line + (s.how === 'tagged' ? ' (tagged)' : '')); }
    for (const [k, v] of [...o].sort()) console.log(String(v.length).padStart(4) + '  ' + k + '\n        ' + v.slice(0, 6).join('  ') + (v.length > 6 ? '  ...' : '')); }
  else for (const [f, g] of [...by].sort((a, b) => b[1].n - a[1].n)) console.log(String(g.n).padStart(4) + ' sites  ' + String(g.declared).padStart(4) + ' declared  ' + String(g.tagged).padStart(3) + ' tagged  ' + String(g.un).padStart(4) + ' UNDECLARED  ' + f);
  const un = S.filter(x => !x.how).length;
  console.log('program_sites: ' + S.length + ' material sites in ' + by.size + ' of ' + R.files + ' files: ' + S.filter(x => x.how && x.how !== 'tagged').length + ' declared, ' + S.filter(x => x.how === 'tagged').length + ' tagged, ' + un + ' UNDECLARED');
}
