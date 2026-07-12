# RECYCLE — PWA build

Single-page MRF factory simulator, split from the standalone single-file build into a served PWA.

## Layout
```
index.html            app shell (DOM only)
css/app.css           styles
js/engine.js          simulation engine  (@ENGINE-START@/@ENGINE-END@ sentinels — test harnesses load this alone)
js/app.js             UI, rendering, input (asset registry points at assets/*.webp)
js/tests.js           QC suites (@TESTS-START@/@TESTS-END@) — dev only, NOT loaded by index.html
assets/*.webp         79 sprites/tiles (extracted from the old base64 block)
icons/                PWA icons
manifest.webmanifest  install metadata
sw.js                 service worker — precaches everything (full offline), cache-first
tools/                node test harnesses (see below)
CHANGELOG.md          full history (migrated from the in-code log at the split; new entries go here)
```

## Run locally
Any static server works; from this folder:
```
python3 -m http.server 8080
# → http://localhost:8080
```
(Service worker requires http(s); localhost is allowed. Opening index.html via file:// runs the game but skips the SW.)

## Deploy — GitHub Pages
1. Push this folder to a repo (as root, or as /docs).
2. Settings → Pages → deploy from branch → select branch + folder.
3. Done — everything is relative-pathed, works from a subpath.

## Releasing an update
Bump `VERSION` in `sw.js` (e.g. v1.0.1). Old caches are dropped on activate; clients get the new build on next load.

## Tests
```
node tools/qc.js .            # engine QC suites (engine+tests, DOM-free)
node tools/rendersmoke.js .   # boots the full app headless, renders, asserts
node tools/i18ncheck.js .     # every tr("…") literal has a French entry
node tools/legacy.js .        # balance/regression harness
```
All four accept the project folder, its index.html, or a legacy single-file HTML build.
