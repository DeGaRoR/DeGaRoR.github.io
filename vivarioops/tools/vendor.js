// tools/vendor.js — copy the pinned browser dependencies into /vendor/ (H1).
//
// WHY THIS EXISTS. The browser resolves bare specifiers ONLY through the import
// map in index.html. Before this, that map pointed into ./node_modules/, which
// is in .gitignore and therefore does not exist on the deploy target — so the
// app could not boot from GitHub Pages even though it booted from a dev tree.
// A dependency that only resolves on the machine that ran `npm install` is not
// a dependency, it is a local accident.
//
// NO BUNDLER, DELIBERATELY. Both files are self-contained ES modules:
//   - three.module.js imports exactly one sibling, ./three.core.js, which is why
//     they are vendored into ONE DIRECTORY and keep their original names. Rename
//     either and the relative import breaks silently at boot.
//   - rapier.mjs carries its wasm base64-inlined (that is what `-compat` means),
//     so there is no second artefact and no fetch. Verified by importing a lone
//     copy from an empty directory and stepping a world.
// The version lives in the DIRECTORY name, so the pin is visible in index.html
// itself rather than only in package.json.
//
// V2 in the static gate asserts that what this writes and what index.html asks
// for are the same thing. Running the gate is what makes "the app boots" a
// checkable claim rather than a hope.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const p = (...a) => join(ROOT, ...a);

/**
 * The vendored set, declared rather than discovered.
 *
 * `specifier` is the bare name the application imports; `dir` is the versioned
 * directory it lands in; `entry` is what the import map points AT; `files` is
 * everything that has to travel with it. A file present in node_modules but
 * absent here is deliberately not shipped.
 */
export const VENDOR = [
  {
    specifier: 'three',
    pkg: 'three',
    from: 'node_modules/three/build',
    entry: 'three.module.js',
    files: ['three.module.js', 'three.core.js'],
  },
  {
    specifier: '@dimforge/rapier3d-compat',
    pkg: '@dimforge/rapier3d-compat',
    from: 'node_modules/@dimforge/rapier3d-compat',
    entry: 'rapier.mjs',
    files: ['rapier.mjs'],
  },
];

/** Directory name for a vendored package — the pin, made visible in the URL. */
export const vendorDir = (pkg, version) =>
  `${pkg.replace(/^@/, '').replace(/\//g, '-')}-${version}`;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

/** Relative specifiers a vendored file still needs, so a missing sibling is loud. */
function relativeImports(text) {
  const out = new Set();
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g)) out.add(m[1]);
  return [...out];
}

export function runVendor({ quiet = false } = {}) {
  const pkgJson = JSON.parse(readFileSync(p('package.json'), 'utf8'));
  const manifest = { generatedBy: 'tools/vendor.js', packages: [] };
  const problems = [];

  for (const v of VENDOR) {
    const pinned = pkgJson.dependencies?.[v.pkg];
    if (!pinned) { problems.push(`${v.pkg} is vendored but not in package.json dependencies`); continue; }

    const installedPath = p('node_modules', v.pkg, 'package.json');
    if (!existsSync(installedPath)) {
      problems.push(`${v.pkg} is not installed — run npm install before npm run vendor`);
      continue;
    }
    const installed = JSON.parse(readFileSync(installedPath, 'utf8')).version;

    // An exact pin is the project's convention (contracts/PROVENANCE.md). A range
    // would make the vendored bytes depend on when someone last installed.
    if (installed !== pinned) {
      problems.push(`${v.pkg}: package.json pins ${pinned} but node_modules has ${installed}`);
      continue;
    }

    const dir = vendorDir(v.pkg, installed);
    const dest = p('vendor', dir);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });

    const entries = [];
    const present = new Set(v.files);
    for (const f of v.files) {
      const src = p(v.from, f);
      if (!existsSync(src)) { problems.push(`${v.pkg}: ${v.from}/${f} is missing`); continue; }
      const buf = readFileSync(src);
      mkdirSync(dirname(join(dest, f)), { recursive: true });
      writeFileSync(join(dest, f), buf);
      entries.push({ file: f, bytes: buf.length, sha256: sha256(buf) });

      // A sibling this file needs but that was not vendored fails at BOOT, in a
      // browser, as a blank screen — which is exactly the class of failure this
      // whole script exists to remove. Catch it here instead.
      for (const rel of relativeImports(buf.toString('utf8'))) {
        const name = rel.replace(/^\.\//, '');
        if (!present.has(name)) problems.push(`${v.pkg}: ${f} imports ${rel}, which is not in the vendored file list`);
      }
    }

    manifest.packages.push({
      specifier: v.specifier, pkg: v.pkg, version: installed,
      dir, entry: v.entry, target: `./vendor/${dir}/${v.entry}`, files: entries,
    });
    if (!quiet) {
      const kb = entries.reduce((a, e) => a + e.bytes, 0) / 1024;
      console.log(`vendor/${dir}  ${entries.length} file(s), ${kb.toFixed(0)} KB`);
    }
  }

  if (problems.length) {
    for (const x of problems) console.error(`  >>> ${x}`);
    throw new Error(`vendor: ${problems.length} problem(s)`);
  }

  writeFileSync(p('vendor', 'VENDOR.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** The import map index.html must declare, derived from what was actually written. */
export function expectedImportMap(manifest) {
  const imports = {};
  for (const m of manifest.packages) imports[m.specifier] = m.target;
  return { imports };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = runVendor();
  console.log(`vendor/VENDOR.json  ${m.packages.length} package(s)`);
  console.log(JSON.stringify(expectedImportMap(m), null, 2));
}
