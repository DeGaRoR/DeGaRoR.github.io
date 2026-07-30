# Running vivarioops

The app is a set of ES modules. **It cannot be opened, only served** — a `file://`
page is an opaque origin, so the browser refuses every `import` and the screen
renders black with the fault only in the console.

```
npm install        # dev dependencies
npm run vendor     # writes vendor/ from the pinned packages — COMMIT the result
npm run serve      # http://localhost:8080/
```

`vendor/` is not in this archive: it is ~4.2 MB of third-party bytes that
`tools/vendor.js` reproduces deterministically. `vendor/VENDOR.json` records what
should be there, and gate assertion **V2** fails if the import map, the vendored
files and the `package.json` pins ever disagree.

## Deploying

`vendor/` **must be committed**. `node_modules/` must stay ignored. The import map
in `index.html` points at `./vendor/`, and that is the only thing that resolves a
bare specifier in a browser — GitHub Pages has no bundler and no `node_modules`.

## Gate

```
npm run gate       # all 8 suites — the only thing entitled to say GATE GREEN
npm run build      # runs the full gate FIRST, aborts before writing any version
```

The developer panel runs 3 of 8 suites and now labels itself `PARTIAL`, naming
what it skipped. Only `npm run gate` and `npm run build` can report GREEN.

## Mutation testing

```
node tools/_mut_c2.mjs     # 26 mutants against gate/duel.js  — 21 caught, 5 escapes
node tools/_mut_h.mjs      # Tier 0 hardening — 7/7
node tools/_mut_h9.mjs     # H9 joint-angle frame — 3/4, one KNOWN escape
```

The shared harness is `tools/_mutate.mjs`. It refuses to run against a red
baseline, checks that every anchor is unique, restores in a `finally`, handles
SIGINT/SIGTERM, and writes a recovery sentinel to `.mutation-in-flight.json`
before touching a source file — so even a SIGKILL leaves a tree the next run
repairs and reports.
