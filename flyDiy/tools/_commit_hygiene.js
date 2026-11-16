#!/usr/bin/env node
// COMMIT HYGIENE (A0, 15 Nov 2026; the user: "We also need a procedure for committing, avoiding the build files and
// preserving the end of files ... procedures need to exist and be enforced"). The procedure: tools/workbench/COMMIT-PROCEDURE.md.
// Checks the commits of a branch against its base (default origin/master, else master) and fails on:
//   1. a BUILT file inside a source commit (a commit whose subject does not say "(built)", merges excluded);
//   2. flyDiy/HANDOVER.md with fewer CRs than the base (a merge or an editor normalised its CRLF);
//   3. a file whose line endings flipped (CRLF <-> LF on most of its lines) against the base;
//   4. a file whose final newline appeared or disappeared against the base;
//   5. index.html naming a career_core / route_draw chunk the tree does not have;
//   6. a name dropped from src/core/90_node_exports.js (merges are a UNION). A deliberate drop is named in a commit
//      message of the range as "exports-dropped: NAME1,NAME2".
// Usage: node tools/_commit_hygiene.js [--base <ref>] [--head <ref>] [--root <repo dir>] [--verbose]
// As GATE COMMITHYGIENE it runs on the tree's HEAD against origin/master: a train's merge is judged commit by commit.
'use strict';
const cp = require('child_process'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const VERBOSE = argv.includes('--verbose');
const ROOT = opt('root', path.resolve(__dirname, '..', '..'));
const git = (args, buf) => cp.execFileSync('git', args, { cwd: ROOT, encoding: buf ? 'buffer' : 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const tryGit = (args, buf) => { try { return git(args, buf); } catch (e) { return null; } };

const BUILT = /^flyDiy\/(tools\/flight_core\.js|index\.html|dev\.html|sw\.js|version\.json|career_core\.[0-9a-f]+\.js|route_draw\.[0-9a-f]+\.js)$/;
const SKIP_EOL = /\.(png|jpe?g|webp|gif|bin|gz|glb|ktx2|mp3|ogg|wav|woff2?|ico|pdf|zip)$|^flyDiy\/media\/|_packs?\.json$|(^|\/)map_pack\.js$|fleet_spots_pack\.js$/;

// a git archive copy (no .git) has no commits to judge: say so and pass; the train and the hook run it in a real tree
if (tryGit(['rev-parse', '--is-inside-work-tree']) == null) { console.log('  note: not a git tree (an archive copy?): no commits to judge'); console.log('GATE COMMITHYGIENE: PASS'); process.exit(0); }
const head = opt('head', 'HEAD');
let base = opt('base', null);
if (!base) base = ['origin/master', 'master'].find(r => tryGit(['rev-parse', '-q', '--verify', r]) != null);
const bad = [], notes = [];
if (!base) { console.log('  FAIL no base ref (origin/master or master) to judge against'); console.log('GATE COMMITHYGIENE: FAIL'); process.exit(1); }
const mb = tryGit(['merge-base', base, head]);
if (!mb) { console.log('  FAIL no merge-base between ' + base + ' and ' + head); console.log('GATE COMMITHYGIENE: FAIL'); process.exit(1); }
const B = mb.trim();
const commits = git(['rev-list', '--no-merges', B + '..' + head]).split('\n').filter(Boolean);
notes.push(commits.length + ' commit(s) since ' + base + ' (merge-base ' + B.slice(0, 9) + ')');

// 1. built files inside source commits
for (const c of commits) {
  const subj = git(['log', '-1', '--format=%s', c]).trim();
  if (/\(built\)|\(cook\)|\(bake\)/i.test(subj)) continue;
  const files = git(['diff-tree', '--no-commit-id', '-r', '--name-only', c]).split('\n').filter(Boolean);
  const hit = files.filter(f => BUILT.test(f));
  if (hit.length) bad.push('built file(s) in source commit ' + c.slice(0, 9) + ' "' + subj.slice(0, 70) + '": ' + hit.join(', ') + '  -> move them to a separate "(built)" commit');
}

const blob = (ref, f) => tryGit(['show', ref + ':' + f], true);
const crCount = b => { let n = 0; for (let i = 0; i < b.length; i++) if (b[i] === 13) n++; return n; };
const lfCount = b => { let n = 0; for (let i = 0; i < b.length; i++) if (b[i] === 10) n++; return n; };

// 2. HANDOVER CRs
{
  const hb = blob(B, 'flyDiy/HANDOVER.md'), hh = blob(head, 'flyDiy/HANDOVER.md');
  if (hb && hh) {
    const cb = crCount(hb), ch = crCount(hh);
    if (ch < cb) bad.push('flyDiy/HANDOVER.md has ' + ch + ' CRs, the base ' + cb + ': its CRLF was normalised  -> rewrite your block as bytes on the base file (never an editor)');
    else if (VERBOSE) notes.push('HANDOVER CRs ' + cb + ' -> ' + ch);
  }
}

// 3 + 4. line-ending flips and final newlines, on every file changed base..head
const changed = git(['diff', '--name-only', '--diff-filter=M', B, head]).split('\n').filter(Boolean);
for (const f of changed) {
  if (BUILT.test(f) || SKIP_EOL.test(f) || f === 'flyDiy/HANDOVER.md') continue;
  const a = blob(B, f), b = blob(head, f);
  if (!a || !b || a.length === 0 || b.length === 0) continue;
  if (a.indexOf(0) >= 0 || b.indexOf(0) >= 0) continue;   // binary
  const la = lfCount(a), lb = lfCount(b);
  if (la >= 20 && lb >= 20) {
    const ra = crCount(a) / la, rb = crCount(b) / lb;
    if ((ra > 0.9 && rb < 0.1) || (ra < 0.1 && rb > 0.9)) bad.push(f + ': line endings flipped (' + (ra > 0.9 ? 'CRLF -> LF' : 'LF -> CRLF') + ')  -> write it back with its own endings (Python: newline=\'\' or binary)');
  }
  const ea = a[a.length - 1] === 10, eb = b[b.length - 1] === 10;
  if (ea !== eb) bad.push(f + ': the final newline was ' + (ea ? 'removed' : 'added') + '  -> keep the file\'s own end');
}

// 5. index.html's chunks exist
{
  const ih = blob(head, 'flyDiy/index.html');
  if (ih) {
    const names = [...new Set((ih.toString('utf8').match(/(career_core|route_draw)\.[0-9a-f]+\.js/g) || []))];
    const tree = new Set(git(['ls-tree', '--name-only', head, 'flyDiy/']).split('\n').map(s => s.replace(/^flyDiy\//, '')));
    for (const n of names) if (!tree.has(n)) bad.push('flyDiy/index.html names ' + n + ', which the tree does not have  -> git add -A -- \'flyDiy/career_core.*.js\' \'flyDiy/route_draw.*.js\' in the (built) commit');
  }
}

// 6. exports union
{
  const names = b => { if (!b) return null; const m = b.toString('utf8').match(/module\.exports\s*=\s*\{([^}]*)\}/); return m ? new Set(m[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean)) : null; };
  const nb = names(blob(B, 'flyDiy/src/core/90_node_exports.js')), nh = names(blob(head, 'flyDiy/src/core/90_node_exports.js'));
  if (nb && nh) {
    const msgs = git(['log', '--format=%B', B + '..' + head]);
    const allowed = new Set(); for (const m of msgs.matchAll(/exports-dropped:\s*([\w$, ]+)/gi)) m[1].split(',').forEach(s => allowed.add(s.trim()));
    const dropped = [...nb].filter(n => !nh.has(n) && !allowed.has(n));
    if (dropped.length) bad.push('90_node_exports.js dropped ' + dropped.length + ' name(s): ' + dropped.slice(0, 12).join(', ') + (dropped.length > 12 ? ' ...' : '') + '  -> a merge keeps the UNION; a deliberate drop says "exports-dropped: NAME" in its commit message');
  }
}

for (const n of notes) console.log('  note: ' + n);
for (const b of bad) console.log('  FAIL ' + b);
console.log('  ' + bad.length + ' finding(s)');
console.log('GATE COMMITHYGIENE: ' + (bad.length ? 'FAIL' : 'PASS'));
process.exit(bad.length ? 1 : 0);
