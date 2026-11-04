#!/usr/bin/env node
// GATE CREWLOAD - A FAILED CHARACTER DOES NOT REBUILD THE AEROPLANE FOR EVER (CREW-LOAD-BACKOFF, GPS-STALL 2 Nov).
//
// The bug: _cage_crew.js's charAt loaded a character that was not ready; a FAILED load rebuilt the aeroplane (G1985's
// settle), the rebuild's charAt found the key still not ready and loaded it again - a key that keeps failing rebuilt the
// whole aeroplane every ~280 ms, in flight (a ~210 ms task each; 389 rebuilds in one rig roll-out, ch20 unreachable).
// The fix: the first failure rebuilds once, then the key retries on a clock (2, 4, 8 ... 60 s), loading alone, and
// rebuilds only when it lands.
//
// Under node, with the page's own layers (tools/_scene_headless.js, the crew and the characters in, the registry in
// scope as on the page), the user's Cub, and a CAGE_UI.build that rebuilds the scene and counts:
//   A  THE KEY THAT NEVER COMES: the asset door rejects every fetch - over 9 s, ONE rebuild (the settle), the fetch
//      tried at 0, +2 and +6 s (the clock) from the FIRST fetch, not on every build (measured from the first fetch, not
//      the process start: under the battery's --jobs 8 the first build lands late - FINISH-4 had it at 550 ms, the clock
//      on time behind it, +2.49 / +6.50 s; the next try is +14 s, so 9 s holds three and only three);
//   B  THE KEY THAT COMES LATE: the first fetch rejects, the retry serves the real bytes (media/geo/chars, gunzipped as
//      assets.js does) - the settle, then ONE rebuild when it lands, and the character ready;
//   SELF-TEST  the mutant without charAt's CHAR_FAIL guard (the old behaviour) turns A red.
// Each scenario runs in its own process (the layers keep module state, as the page does).
//
// Usage: node tools/_crewload_check.js            (the gate)
//        node tools/_crewload_check.js --scenario A|B [--mutant]   (one scenario, prints one JSON line)
'use strict';
const path = require('path');
const fs = require('fs');
const T = __dirname;

const GUARD = ' && !CHAR_FAIL[c.key]) {';
if (process.argv.includes('--scenario')) {
  const which = process.argv[process.argv.indexOf('--scenario') + 1];
  const vm = require('vm'), zlib = require('zlib');
  if (process.argv.includes('--mutant')) {            // the layer's source as the page loads it, the guard taken out
    const rf = fs.readFileSync;
    fs.readFileSync = function (p, ...a) {
      const s = rf.call(fs, p, ...a);
      return (typeof p === 'string' && /_cage_crew\.js$/.test(p) && typeof s === 'string') ? s.replace(GUARD, ') {') : s;
    };
  }
  const SH = require(path.join(T, '_scene_headless.js'));
  for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js', '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
  const CH = path.join(T, '..', 'src', 'chars');
  const W = SH.context({ before: ctx => { for (const f of fs.readdirSync(CH).filter(f => /_char\.js$/.test(f))) vm.runInContext(fs.readFileSync(path.join(CH, f), 'utf8'), ctx, { filename: f }); } }).ctx;
  SH.stubCanvas();
  const t0 = Date.now(), tries = [];
  let serve = false;
  const door = u => {
    tries.push(Date.now() - t0);
    if (!serve) { if (which === 'B') serve = true; return Promise.reject(new Error('test: ' + u + ' unreachable')); }
    const buf = zlib.gunzipSync(fs.readFileSync(path.join(T, '..', u)));
    return Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  };
  W.ASSET_FETCH = door; W.ASSET_FETCH_FRESH = door;
  const spec = require(path.join(T, '_load_build.js')).loadBuild(path.join(T, '..', 'builds', 'cub_2026-09-20_corrected.json')).spec;
  const run = () => SH.sceneBuild(JSON.parse(JSON.stringify(spec)), { garage: spec, inGame: true });
  const builds = [];
  W.CAGE_UI = Object.assign(W.CAGE_UI || {}, { build: () => { builds.push(Date.now() - t0); run(); } });
  const cw = console.warn, ce = console.error; console.warn = () => {}; console.error = () => {};
  run();
  setTimeout(() => {
    console.warn = cw; console.error = ce;
    const key = W.CAGE_CHAR && W.CAGE_CHAR.RACER;
    console.log(JSON.stringify({ which, key, builds, tries, ready: !!(W.CAGE_CHAR && W.CAGE_CHAR.ready(key)) }));
    process.exit(0);
  }, which === 'A' ? 9000 : 3500);
  return;
}

const { execFileSync } = require('child_process');
const scen = (w, mutant) => {
  const out = execFileSync(process.execPath, [__filename, '--scenario', w].concat(mutant ? ['--mutant'] : []), { encoding: 'utf8', timeout: 180000, maxBuffer: 16 << 20 });
  return JSON.parse(out.split('\n').filter(l => l.startsWith('{')).pop());
};
let fails = 0;
const check = (ok, what, detail) => { if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what + (detail ? '  (' + detail + ')' : '')); };
console.log('GATE CREWLOAD - a failed character retries on a clock, not on every build');
const src = fs.readFileSync(path.join(T, '_cage_crew.js'), 'utf8');
check(src.split(GUARD).length === 2, 'charAt skips a failed key until its retry (the CHAR_FAIL guard, once)');

const A = scen('A');
const sA = 'builds at ' + JSON.stringify(A.builds) + ' ms, fetches at ' + JSON.stringify(A.tries) + ' ms';
check(A.key === 'ch20' && A.tries.length >= 1, 'A: the pilot\'s character was asked for (the crew layer ran, the registry in scope)', 'key ' + A.key);
check(A.builds.length === 1, 'A: a key that never comes rebuilds ONCE over 9 s (G1985\'s settle), not on every build', sA);
const dA = A.tries.map(t => t - A.tries[0]);
check(A.tries.length === 3 && dA[1] >= 1800 && dA[1] <= 3000 && dA[2] >= 5600 && dA[2] <= 7500, 'A: it is retried on the clock (0, +2, +6 s from the first fetch)', sA);
check(!A.ready, 'A: and it stays an undressed seat');

const B = scen('B');
const sB = 'builds at ' + JSON.stringify(B.builds) + ' ms, fetches at ' + JSON.stringify(B.tries) + ' ms';
check(B.tries.length === 2 && B.builds.length === 2 && B.builds[1] >= B.tries[1], 'B: a key that lands on its retry: the settle, then ONE rebuild when it lands', sB);
check(B.ready, 'B: and the character is ready');

const M = scen('A', true);
check(M.builds.length > 5, 'SELF-TEST the mutant without the guard rebuilds on every build (the old loop) and turns A red', 'mutant builds ' + M.builds.length + ' in 9 s');
console.log('GATE CREWLOAD: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
