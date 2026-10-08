#!/usr/bin/env node
// _built_check.js — GATE BUILT (RELEASE-CHECKS G1591, review B27): the committed outputs are a build of the sources.
// Nothing verified that index.html / dev.html / sw.js / tools/flight_core.js / version.json are what tools/build.js
// makes of src/ - source commits land between the trains' "(built)" commits, and a "(built)" commit made from the
// wrong tree (a CRLF worktree, a forgotten merge, the build run before the last source commit) shipped silently.
//
// The gate rebuilds into a temp dir (build({ out }): the inputs are this tree's) and compares the five files (+ G2685's
// career_core.<h8>.js, B.OUTPUTS after the build; a superseded career_core.*.js left in the tree is red too) with
//   (1) the WORKING TREE's copies - a mismatch means the outputs on disk are not this source's build (run the build);
//   (2) HEAD's COMMITTED copies (git show) - version.json by its build id, the date is not compared.
// (2) is judged against the history: L is the last commit that touched an output.
//   - no build input changed in L..HEAD nor in the working tree: L's outputs are stale against its OWN sources -
//     a stale "(built)" commit: FAIL, naming the files.
//   - inputs moved since L (a source commit after the last build - a worker branch is source only by convention):
//     PASS with the lagging files named, the train's (built) commit closes it. BUILT_STRICT=1 (or --strict) makes
//     this a FAIL too: A0's landing runs it strict on the (built) commit before the push (HANDOVER G1590 recipe).
// No git (a tarball): (1) only. Verdict contract: one final `GATE BUILT: PASS|FAIL`, exit code to match. ~3 s.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const strict = process.env.BUILT_STRICT === '1' || process.argv.includes('--strict');
const B = require('./build.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy-built-'));
const why = [];
const fail = w => { why.push(w); };
try {
  const r = B.build({ out: tmp, quiet: true });
  console.log(`  fresh build ${r.build} (${r.inputs.length} named inputs) in ${tmp}`);
  const idOf = t => { try { return JSON.parse(t).build || null; } catch (e) { return null; } };
  const same = (f, a, b) => (a == null || b == null) ? false
    : f === 'version.json' ? idOf(a.toString('utf8')) === idOf(b.toString('utf8')) && idOf(a.toString('utf8')) != null
    : Buffer.compare(a, b) === 0;
  const fresh = {};
  for (const f of B.OUTPUTS) fresh[f] = fs.readFileSync(path.join(tmp, f));

  // (1) the working tree
  const offWork = B.OUTPUTS.filter(f => { let w = null; try { w = fs.readFileSync(path.join(ROOT, f)); } catch (e) {} return !same(f, fresh[f], w); });
  if (offWork.length) {
    console.log(`  the working tree's outputs are NOT this source's build: ${offWork.join(', ')} (run node tools/build.js)`);
    fail('working tree: ' + offWork.join(', '));
  } else console.log('  the working tree\'s outputs = the fresh build (' + B.OUTPUTS.length + ' files)');
  // G2685 (CAREER-LAZY): the career core is named by its hash - one career_core.<h8>.js in the tree, this build's (a
  // superseded one left beside it would be served to nobody and committed by mistake)
  const strays = B.careerCoreNames(ROOT).filter(f => !B.OUTPUTS.includes(f));
  if (strays.length) { console.log('  a superseded career core in the working tree: ' + strays.join(', ') + ' (run node tools/build.js: it sweeps them)'); fail('stray ' + strays.join(', ')); }

  // (2) HEAD
  const git = (args, buf) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'], encoding: buf ? null : 'utf8' });
  let prefix = null;
  try { prefix = git(['rev-parse', '--show-prefix']).trim(); } catch (e) {}
  if (prefix == null) console.log('  no git here: the committed copies are not compared');
  else {
    const head = git(['rev-parse', '--short=10', 'HEAD']).trim();
    const offHead = B.OUTPUTS.filter(f => { let c = null; try { c = git(['show', `HEAD:${prefix}${f}`], true); } catch (e) {} return !same(f, fresh[f], c); });
    if (!offHead.length) console.log(`  HEAD ${head}'s committed outputs = the fresh build`);
    else {
      // the build's inputs as pathspecs: all of src/ and vendor/, the geometry store (sw.js lists it), build.js, and
      // every tools/ file the shipped code names (the editor, the generators, the fixtures)
      // (minus what is made FROM a build: the parked cook's manifest)
      const spec = [...new Set(['src', 'vendor', 'media/geo', 'tools/build.js'].concat(r.inputs.map(i => i.rel).filter(p => p.startsWith('tools/'))))]
        .concat([...B.GENERATED].filter(p => p.startsWith('src/')).map(p => ':(exclude)' + p));
      const L = git(['log', '-1', '--format=%h', 'HEAD', '--', ...B.OUTPUTS]).trim();
      const Ls = L ? git(['log', '-1', '--format=%s', L]).trim() : '';
      const moved = L ? git(['diff', '--name-only', L, 'HEAD', '--', ...spec]).split('\n').filter(Boolean) : ['(no commit carries the outputs)'];
      const dirty = git(['diff', '--name-only', 'HEAD', '--', ...spec]).split('\n').filter(Boolean);
      console.log(`  HEAD ${head}'s committed ${offHead.join(', ')} differ from the fresh build`);
      console.log(`  the outputs were last committed in ${L || '-'} "${Ls.slice(0, 100)}"`);
      if (!moved.length && !dirty.length) {
        console.log(`  no build input changed since ${L}: that commit's outputs are stale against its own sources (a stale "(built)" commit)`);
        try { if (fs.readFileSync(path.join(ROOT, 'src', 'core', '00_registry.js'), 'utf8').includes('\r')) console.log('  NOTE: this worktree is CRLF - the landing build is LF (build from a clean LF worktree)'); } catch (e) {}
        fail('stale (built) commit ' + L + ': ' + offHead.join(', '));
      } else {
        console.log(`  build inputs moved since ${L}: ${moved.length} committed${dirty.length ? `, ${dirty.length} uncommitted` : ''} (${moved.concat(dirty).slice(0, 4).join(', ')}${moved.length + dirty.length > 4 ? ', ...' : ''})`);
        if (strict) fail('strict: the committed outputs lag the sources: ' + offHead.join(', '));
        else console.log('  a source commit: the outputs lag until the train\'s (built) commit (BUILT_STRICT=1 makes this red)');
      }
    }
  }
} catch (e) {
  console.log('  ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n  '));
  fail('the check threw');
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
}
console.log(`GATE BUILT: ${why.length ? 'FAIL (' + why.join('; ') + ')' : 'PASS'}`);
process.exit(why.length ? 1 : 0);
