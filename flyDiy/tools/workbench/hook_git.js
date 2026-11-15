#!/usr/bin/env node
// The commit hook (A0, 15 Nov 2026; the user: "procedures need to exist and be enforced" ... "Decide on adding the
// hook, it's your business"). Wired in .claude/settings.json as a PreToolUse hook on Bash/PowerShell for every Claude
// session in this repo. It BLOCKS (exit 2, the reason on stderr) only clear errors:
//   git commit: built files staged in a commit whose command does not say "(built)" / "(cook)" / "(bake)";
//               flyDiy/HANDOVER.md staged with fewer CRs than HEAD's (its CRLF normalised).
//   git push:   the pushed commit fails tools/_commit_hygiene.js against origin/master (every FAIL line says the fix).
// It never blocks on its own trouble: any error, an unresolvable ref, a repo that is not flyDiy -> allow.
// Override, for a deliberate case only, with the reason in the command: `# hygiene-override: <why>`.
// The procedure: flyDiy/tools/workbench/COMMIT-PROCEDURE.md (skill workbench-commit).
'use strict';
const cp = require('child_process'), fs = require('fs'), path = require('path');
const allow = () => process.exit(0);
const block = msg => { process.stderr.write('BLOCKED by the flyDiy commit hook (flyDiy/tools/workbench/hook_git.js):\n' + msg + '\nThe procedure: flyDiy/tools/workbench/COMMIT-PROCEDURE.md. A deliberate exception: add "# hygiene-override: <why>" to the command.\n'); process.exit(2); };
let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => { try { main(JSON.parse(raw || '{}')); } catch (e) { allow(); } });
setTimeout(allow, 25000);   // never hold a session

const BUILT = /^flyDiy\/(tools\/flight_core\.js|index\.html|dev\.html|sw\.js|version\.json|career_core\.[0-9a-f]+\.js|route_draw\.[0-9a-f]+\.js)$/;

function main(inp) {
  if (!/^(Bash|PowerShell)$/.test(inp.tool_name || '')) return allow();
  const cmd = String((inp.tool_input && inp.tool_input.command) || '');
  if (!/\bgit\b/.test(cmd) || /hygiene-override:/.test(cmd)) return allow();
  // where the git runs: `git -C <dir>`, a leading `cd <dir> &&`, else the session's cwd
  let dir = inp.cwd || process.cwd();
  const mC = cmd.match(/\bgit\s+-C\s+("([^"]+)"|'([^']+)'|(\S+))/), mCd = cmd.match(/^\s*cd\s+("([^"]+)"|'([^']+)'|(\S+))\s*(&&|;)/);
  const pick = m => m && (m[2] || m[3] || m[4]);
  if (pick(mC)) dir = pick(mC); else if (pick(mCd)) dir = pick(mCd);
  dir = dir.replace(/^\/([a-zA-Z])\//, '$1:/');
  const git = (args, enc) => cp.execFileSync('git', args, { cwd: dir, encoding: enc || 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
  let root;
  try { root = git(['rev-parse', '--show-toplevel']).trim(); } catch (e) { return allow(); }
  const hyg = path.join(root, 'flyDiy', 'tools', '_commit_hygiene.js');
  if (!fs.existsSync(hyg)) return allow();
  const segs = cmd.split(/&&|\|\||;|\n/);
  for (const s of segs) {
    if (/\bgit\b(\s+-C\s+\S+)?[^|]*?\scommit\b/.test(s)) checkCommit(s, git);
    if (/\bgit\b(\s+-C\s+\S+)?[^|]*?\spush\b/.test(s)) checkPush(s, git, root, hyg);
  }
  allow();
}

function checkCommit(s, git) {
  if (/\s(-F|--file)\b/.test(s)) return;   // message from a file: not read here
  let staged;
  try { staged = git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean); } catch (e) { return; }
  const built = staged.filter(f => BUILT.test(f));
  if (built.length && !/\((built|cook|bake)\)/i.test(s))
    block('This commit stages built file(s): ' + built.join(', ') + '.\nA source commit holds no built files: unstage them (git restore --staged <file>), or make this the separate "<NAME> (built): ..." commit with every built file and the hashed chunks.');
  if (staged.includes('flyDiy/HANDOVER.md')) {
    try {
      const cr = b => { let n = 0; for (const x of b) if (x === 13) n++; return n; };
      const a = cr(git(['show', 'HEAD:flyDiy/HANDOVER.md'], 'buffer')), b = cr(git(['show', ':flyDiy/HANDOVER.md'], 'buffer'));
      if (b < a) block('flyDiy/HANDOVER.md is staged with ' + b + ' CRs; HEAD has ' + a + '. Its CRLF line endings were normalised.\nRestore it (git checkout HEAD -- flyDiy/HANDOVER.md) and append your block as bytes with \\r\\n lines.');
    } catch (e) { /* no HEAD copy: allow */ }
  }
}

function checkPush(s, git, root, hyg) {
  const words = s.trim().split(/\s+/).filter(w => !w.startsWith('-'));
  const i = words.indexOf('push');
  const specs = i >= 0 ? words.slice(i + 2) : [];   // after "push <remote>"
  let srcs = specs.length ? specs.map(x => x.replace(/^\+/, '').split(':')[0]) : ['HEAD'];
  srcs = srcs.filter(x => x && !x.includes('$') && !x.startsWith('refs/tags'));   // a delete (":dst") or a shell variable: not judged here
  for (const src of srcs) {
    try { git(['rev-parse', '-q', '--verify', src + '^{commit}']); } catch (e) { continue; }
    let out = '', code = 0;
    try { out = cp.execFileSync(process.execPath, [hyg, '--head', src, '--root', root], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }); }
    catch (e) { code = e.status || 1; out = String(e.stdout || ''); }
    if (code === 1 && /GATE COMMITHYGIENE: FAIL/.test(out))
      block('Pushing ' + src + ' would land these hygiene faults (tools/_commit_hygiene.js):\n' + out.split('\n').filter(l => /FAIL /.test(l)).join('\n'));
  }
}
