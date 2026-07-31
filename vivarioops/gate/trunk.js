// gate/trunk.js — 20 §3 non-negotiables that are checked STATICALLY.
// Node only: it reads the filesystem. The dev panel displays the result the
// build recorded (see tools/build.js -> gate-report.json).
//
// SELF-MATCHING: every forbidden token below is assembled from fragments, so
// this file does not trip its own greps and needs no exclusion. An excluded
// scanner is a scanner with a blind spot in exactly the wrong place.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENOME_V, BRIDGE_V, ECOLOGY_V } from '../contracts/versions.js';

// fileURLToPath, not `.pathname`: on Windows `new URL('..', import.meta.url).pathname`
// is `/D:/…` (leading slash, forward slashes) and join() then doubles the drive into
// `D:\D:\…`. fileURLToPath returns a native path on every platform.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);
const CODE_EXT = new Set(['.js', '.mjs', '.css', '.html', '.json']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (CODE_EXT.has(extname(name))) out.push(p);
  }
  return out;
}

function files(...roots) {
  const out = [];
  for (const r of roots) {
    const p = join(ROOT, r);
    if (!existsSync(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  // Forward slashes on every platform, so path comparisons like N5's
  // `f.path !== 'trunk/rng.js'` and the failure output are OS-independent.
  return out.map(p => ({ path: relative(ROOT, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));
}

/**
 * Comments are stripped before matching. A rule cannot be documented in the file
 * that enforces it otherwise: the first version of this gate failed N5, N8 and
 * N14 against its own explanatory prose. String literals are deliberately NOT
 * stripped, so a forbidden call hidden in a string still trips the check.
 * Quotes and template literals are tracked so a URL's `//` is not mistaken for
 * a comment.
 */
function stripComments(text, isHtml) {
  if (isHtml) return text.replace(/<!--[\s\S]*?-->/g, ' ');
  let out = '', i = 0, mode = 0;   // 0 code · 1 line · 2 block · 3 ' · 4 " · 5 `
  while (i < text.length) {
    const c = text[i], d = text[i + 1];
    if (mode === 0) {
      if (c === '/' && d === '/') { mode = 1; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 2; i += 2; continue; }
      if (c === "'") mode = 3; else if (c === '"') mode = 4; else if (c === '`') mode = 5;
      out += c; i++; continue;
    }
    if (mode === 1) { if (c === '\n') { mode = 0; out += c; } i++; continue; }
    if (mode === 2) { if (c === '*' && d === '/') { mode = 0; i += 2; } else { if (c === '\n') out += c; i++; } continue; }
    if (c === '\\') { out += c + (d ?? ''); i += 2; continue; }
    if ((mode === 3 && c === "'") || (mode === 4 && c === '"') || (mode === 5 && c === '`')) mode = 0;
    out += c; i++;
  }
  return out;
}

/** Every line matching `re`, as `path:line: text`. Comments excluded. */
function hits(fileList, re) {
  const found = [];
  for (const f of fileList) {
    const stripped = stripComments(f.text, extname(f.path) === '.html');
    stripped.split('\n').forEach((line, i) => {
      if (re.test(line)) found.push(`${f.path}:${i + 1}: ${line.trim().slice(0, 90)}`);
      re.lastIndex = 0;
    });
  }
  return found;
}

const APP_ROOTS = ['app.js', 'index.html', 'contracts', 'engine', 'gate', 'render', 'trunk', 'ui', 'workers', 'worlds', 'bench', 'tools'];

// Forbidden tokens, assembled so they do not appear literally in this file.
const R_RANDOM   = new RegExp('\\bMath\\s*\\.\\s*ran' + 'dom\\b');
const R_DATE     = new RegExp('\\bDa' + 'te\\b');
const R_PERF     = new RegExp('\\bperfor' + 'mance\\s*\\.');
const R_WINDOW   = new RegExp('\\bwin' + 'dow\\s*\\.');
const R_DOCUMENT = new RegExp('\\bdocu' + 'ment\\s*\\.');
const R_WEBSTORE = new RegExp('\\b(local|session)Sto' + 'rage\\b');
const R_DIALOG   = new RegExp('(^|[^.\\w])(con' + 'firm|al' + 'ert|pro' + 'mpt)\\s*\\(');
const R_PCG      = /636413622384679300[0-9]/;
// A hex colour is a VALUE: it ends a declaration or an argument. `#app` and
// `#tabbar` are id selectors and must not trip this.
// A hex colour is a VALUE: it ends a declaration, an argument, or a string.
// The quoted form matters -- a JS fallback like token('--c-bg', '#05080c')
// duplicates a token value in a component, which is precisely the drift N16
// exists to prevent, and the first version of this pattern missed it.
const R_HEX      = /#[0-9a-f]{3,8}\s*['"`;),]|#[0-9a-f]{3,8}\s*$/im;
const R_PX       = /(^|[^-\w])\d+(\.\d+)?px\b/;

/**
 * Documented exceptions. Each needs a reason; an exception without one is a
 * silent waiver, which is the thing 20 §3 exists to prevent.
 */
const EXCEPTIONS = {
  N16: [{
    match: /index\.html:\d+:.*theme-color/,
    reason: 'meta[name=theme-color] cannot take a CSS var; injected from tokens at Tier 3',
  }],
};

function applyExceptions(id, found) {
  const ex = EXCEPTIONS[id] || [];
  return found.filter(h => !ex.some(e => e.match.test(h)));
}

export function runStaticGate() {
  const results = [];
  const engine = files('engine');
  const app = files(...APP_ROOTS);
  const components = files('ui', 'render', 'index.html');

  const check = (id, title, found, extra = {}) => {
    const remaining = applyExceptions(id, found);
    results.push({
      id, title,
      status: remaining.length === 0 ? 'pass' : 'fail',
      checks: 1,
      failures: remaining.slice(0, 8),
      ...extra,
    });
  };

  // ── engine purity ─────────────────────────────────────────────────────────
  const engineNote = `${engine.length} file(s) in /engine/`;
  const T = { rnd: 'Math.ran' + 'dom()', dt: 'Da' + 'te', st: 'localSto' + 'rage', dlg: 'con' + 'firm()/al' + 'ert()/pro' + 'mpt()', st2: 'sessionSto' + 'rage' };
  check('N1', `No ${T.rnd} in /engine/`, hits(engine, R_RANDOM), { note: engineNote });
  check('N2', `No ${T.dt}, performance, window, document in /engine/`,
    [...hits(engine, R_DATE), ...hits(engine, R_PERF), ...hits(engine, R_WINDOW), ...hits(engine, R_DOCUMENT)],
    { note: engineNote });

  // N3 — import graph, not a text grep: a relative path can reach upward in
  // several spellings and only the resolved target matters.
  const upward = [];
  for (const f of engine) {
    for (const m of f.text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      const resolved = relative(ROOT, join(ROOT, f.path, '..', spec)).replace(/\\/g, '/');
      if (/^(render|ui|trunk)\//.test(resolved)) upward.push(`${f.path}: imports ${resolved}`);
    }
  }
  check('N3', '/engine/ imports nothing from /render/, /ui/, /trunk/', upward, { note: engineNote });

  // ── determinism ───────────────────────────────────────────────────────────
  const prngElsewhere = hits(app.filter(f => f.path !== 'trunk/rng.js'), R_PCG);
  check('N5', 'All randomness derives from seed(); no PRNG constructed outside trunk/rng.js',
    [...hits(app, R_RANDOM), ...prngElsewhere],
    { note: 'app-wide, stricter than N1' });

  // ── data integrity ────────────────────────────────────────────────────────
  check('N8', `No ${T.st} / ${T.st2} anywhere`, hits(app, R_WEBSTORE));

  // ── interaction ───────────────────────────────────────────────────────────
  check('N14', `No ${T.dlg}; destructive actions offer undo`, hits(app, R_DIALOG));
  check('N16', 'No hex colours or raw pixel values in components; tokens only',
    [...hits(components, R_HEX), ...hits(components, R_PX)],
    { note: `${components.length} component file(s); trunk/ui/tokens.css is the token source and is out of scope` });

  // ── boot resolution (H1) ──────────────────────────────────────────────────
  //
  // WHAT THIS IS FOR. A gate that is green while the application cannot BOOT is
  // the worst kind of green, and that was the state until H1: index.html mapped
  // `three` and nothing else, so `@dimforge/rapier3d-compat` was unresolvable in
  // any browser, and the one entry it did map pointed into ./node_modules/,
  // which .gitignore excludes and the deploy target therefore does not have.
  // Both failures are invisible to every other assertion here, because both are
  // about what SHIPS rather than about what the source says.
  //
  // /gate/ and /tools/ are excluded: they run under Node, which resolves bare
  // specifiers from node_modules and never reads the import map. /vendor/ is
  // third-party and is scanned by nothing — it is out of scope for the project's
  // own non-negotiables by construction, since APP_ROOTS does not list it.
  const BROWSER_ROOTS = ['app.js', 'contracts', 'engine', 'render', 'trunk', 'ui', 'worlds', 'workers'];
  const boot = [];
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const mapText = html.match(/<script[^>]+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];

  let imports = null;
  if (!mapText) boot.push('index.html has no <script type="importmap"> — no bare specifier can resolve in a browser');
  else {
    try { imports = JSON.parse(mapText).imports ?? {}; }
    catch (e) { boot.push(`index.html import map is not valid JSON: ${e.message}`); }
  }

  if (imports) {
    // Every bare specifier the BROWSER will actually meet.
    const needed = new Map();
    for (const f of files(...BROWSER_ROOTS)) {
      // Comments are stripped, exactly as hits() does. Without it the prose in
      // naming.js — a quotation introduced by the word "from" — reads as an
      // import of a bare specifier called "the single most extreme normalised
      // trait", which is a funny failure the first time and a waiver the second.
      const src = stripComments(f.text, extname(f.path) === '.html');
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'".][^'"]*)['"]/g)) {
        const spec = m[1];
        if (spec.startsWith('node:')) { boot.push(`${f.path}: imports ${spec}, which no browser provides`); continue; }
        if (!needed.has(spec)) needed.set(spec, f.path);
      }
    }
    for (const [spec, where] of needed) {
      if (!(spec in imports)) boot.push(`${where}: imports "${spec}", which the index.html import map does not declare`);
    }

    // A declared target that is absent, or that lives somewhere git does not
    // carry, fails at boot on the deploy target and nowhere else.
    for (const [spec, target] of Object.entries(imports)) {
      if (/(^|\/)node_modules\//.test(target)) {
        boot.push(`import map "${spec}" -> ${target}: node_modules is in .gitignore and does not ship — vendor it (npm run vendor)`);
        continue;
      }
      if (!existsSync(join(ROOT, target.replace(/^\.\//, '')))) {
        boot.push(`import map "${spec}" -> ${target}: file does not exist`);
      }
    }

    // The map and the vendored artefact must be the same statement about which
    // VERSION ships. Re-vendoring at a new pin rewrites vendor/ and would
    // otherwise leave index.html pointing at a directory that no longer exists.
    const vmPath = join(ROOT, 'vendor/VENDOR.json');
    if (!existsSync(vmPath)) boot.push('vendor/VENDOR.json is missing — run npm run vendor');
    else {
      const vm = JSON.parse(readFileSync(vmPath, 'utf8'));
      const deps = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).dependencies ?? {};
      for (const pkg of vm.packages) {
        // The one drift the checks below cannot see: bump the pin, npm install,
        // forget npm run vendor. Map, VENDOR.json and vendor/ all still agree
        // with each other — and all three disagree with what the project claims
        // to depend on. Pinned versions are load-bearing here (PROVENANCE.md).
        if (deps[pkg.pkg] !== pkg.version) {
          boot.push(`${pkg.pkg}: package.json pins ${deps[pkg.pkg] ?? 'nothing'} but vendor/ ships ${pkg.version} — run npm run vendor`);
        }
        if (imports[pkg.specifier] !== pkg.target) {
          boot.push(`import map "${pkg.specifier}" is ${imports[pkg.specifier] ?? 'absent'}, vendor/ wrote ${pkg.target}`);
        }
        for (const file of pkg.files) {
          if (!existsSync(join(ROOT, 'vendor', pkg.dir, file.file))) {
            boot.push(`vendor/${pkg.dir}/${file.file} is recorded in VENDOR.json but missing on disk`);
          }
        }
      }
    }
  }

  check('V2', 'Every browser bare specifier resolves through the import map to a file that ships', boot);

  // ── N24 · the tree is not mid-mutation ────────────────────────────────────
  //
  // tools/_mut*.mjs edit engine sources IN PLACE and restore them afterwards. A
  // runner killed between those two steps leaves a MUTANT in the tree, and a
  // mutant is indistinguishable from a real regression — the HANDOFF records one
  // masquerading as an L2-15 failure for two gate runs, and it recurred during
  // the density delivery when a backgrounded runner was SIGKILLed.
  //
  // try/finally CANNOT fix this: SIGKILL is not catchable, and a background job
  // is exactly what gets SIGKILLed. So the runners write a sentinel BEFORE
  // mutating and remove it after, and the gate refuses to be green while one
  // exists. A leftover mutant now announces itself in one line instead of
  // costing a session to diagnose.
  const mutant = [];
  const sentinel = join(ROOT, 'tools', '.mutant-active.json');
  if (existsSync(sentinel)) {
    let d = {};
    try { d = JSON.parse(readFileSync(sentinel, 'utf8')); } catch { /* unreadable is still a fail */ }
    mutant.push(
      `tools/.mutant-active.json exists: ${d.file ?? '?'} is MUTATED (${d.mutant ?? '?'}, started ${d.startedAt ?? '?'}).`
      + ' Restore that file and delete the sentinel. Nothing in this run is trustworthy until you do.');
  }
  check('N24', 'No mutation runner left the tree mid-edit', mutant);

  // ── version consistency (20 §8) ───────────────────────────────────────────
  const vc = [];
  const vjPath = join(ROOT, 'version.json');
  const tvPath = join(ROOT, 'trunk/version.js');
  if (!existsSync(vjPath)) vc.push('version.json missing — run tools/build.js');
  if (!existsSync(tvPath)) vc.push('trunk/version.js missing — run tools/build.js');
  if (vc.length === 0) {
    const vj = JSON.parse(readFileSync(vjPath, 'utf8'));
    const tv = readFileSync(tvPath, 'utf8');
    const inject = JSON.parse(tv.match(/VERSION\s*=\s*(\{[\s\S]*?\});/)?.[1] ?? 'null');
    if (!inject) vc.push('trunk/version.js does not contain a parseable VERSION object');
    else {
      for (const k of ['app', 'build', 'commit', 'genome', 'bridge', 'ecology']) {
        if (inject[k] !== vj[k]) vc.push(`${k}: version.json ${JSON.stringify(vj[k])} vs trunk/version.js ${JSON.stringify(inject[k])}`);
      }
    }
    // The schema versions are declared in contracts/versions.js (A0 decision) and
    // MIRRORED into version.json. If they drift, records validate against one
    // number and are stored under another.
    if (vj.genome !== GENOME_V) vc.push(`genome: version.json ${vj.genome} vs contracts/versions.js ${GENOME_V}`);
    if (vj.bridge !== BRIDGE_V) vc.push(`bridge: version.json ${vj.bridge} vs contracts/versions.js ${BRIDGE_V}`);
    if (vj.ecology !== ECOLOGY_V) vc.push(`ecology: version.json ${vj.ecology} vs contracts/versions.js ${ECOLOGY_V}`);
    if (!/^\d+\.\d+\.\d+$/.test(vj.app)) vc.push(`app is not major.minor.patch: ${vj.app}`);
  }
  check('V1', 'version.json, trunk/version.js and contracts/versions.js agree', vc);

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  return {
    name: 'trunk-static', results, passed, failed, pending: 0,
    checks: results.length,
    obligations: [
      'Tier 1: N15 (every user-visible string through t()) has no check yet — t() is in use from A1 but the DOM scan needs the dictionaries.',
      'Tier 3: N16 exception — index.html meta[name=theme-color] holds the only hex outside tokens.',
    ],
  };
}
