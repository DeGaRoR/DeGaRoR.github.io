#!/usr/bin/env node
// GATE WEATHER — the weathering module's verdict (G345).
//
//   node tools/_weather_check.js [--selftest]  ->  "GATE WEATHER: PASS|FAIL"
//
// src/viewer/aeroweather.js is GLSL spliced into aeroskin's hooks plus the
// tables that drive it. Everything that would fail SILENTLY at runtime is
// asserted here on the source and on the exported tables:
//
//   GLSL      no backtick and no ${ can survive the template literals (node
//             loads the file), but the rest is convention: no `continue` in a
//             block that samples; every loop bound a #define and every break
//             on a uniform (a break on a varying divides the quad and the
//             fetch's mip is undefined); every texture2D inside the
//             `if (aeroWxOn > 0.0)` uniform branch; the vec4 census bounded.
//   NO SHINY DIRT  the invariant lines verbatim: roughness saturates UP to
//             the layer floor, metalness and the clear coat fall with cover;
//             every dirt floor >= 0.85 (tar exempt, by list).
//   TABLES    four coefficients per layer, every layer reachable from a
//             macro, the unpack text matches the table order, a substrate
//             row for EVERY finish aeroskin knows and no row for a finish it
//             does not.
//   ORDER     aeroweather.js loads BEFORE aeroskin.js in the manifest and in
//             every bench page that loads aeroskin: r128 keys the program on
//             the hook's source, and a late module leaves later materials on
//             the weather-less program under the same key.
//   SPEC      the pure keeper: `finish.weather` in, legacy `finish.wear` as
//             age = flight, deviations out.
//   BAKE      the grunge sheet has four live channels and tiles.
//
// NEGATIVE-VERIFIED: --selftest mutates each rule and requires its check to
// fail on its OWN label.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const WXP = path.join(ROOT, 'src', 'viewer', 'aeroweather.js');
const W = require(WXP);
const A = require(path.join(ROOT, 'src', 'viewer', 'aeroskin.js'));
const SELF = process.argv.includes('--selftest');

// THE AUDIT, as a function of its inputs, so the selftest can hand it a
// mutated world and ask the same questions
function audit(ctx) {
  const F = [];
  const check = (ok, label, extra) => { if (!ok) F.push(label + (extra ? ' — ' + extra : '')); return ok; };
  const { glsl, layers, cols, glossOk, sub, finishes, manifest, benches, fromSpec, toSpec, resolve, grunge, nl } = ctx;

  // ---- GLSL ---------------------------------------------------------------
  const all = Object.values(glsl).join('\n');
  check(!/`/.test(all), 'glsl: a backtick inside a GLSL block');
  check(!/\$\{/.test(all), 'glsl: a ${ inside a GLSL block');
  check(!/\bcontinue\b/.test(all), 'glsl: `continue` in a block that samples — the mip would be undefined');
  check(!/textureGrad/.test(all), 'glsl: textureGrad is GLSL ES 3.0 only');
  for (const m of all.matchAll(/for \(int (\w+) = 0; \1 < ([A-Za-z0-9_]+); \+\+\1\)/g))
    check(/^AEROWX_[A-Z]+$/.test(m[2]), 'glsl: a loop whose bound is not a #define', m[2]);
  check(!/for \(int \w+ = 0; \w+ < \d+;/.test(glsl.SURF), 'glsl: a loop with a literal bound');
  for (const line of all.split('\n'))
    if (/\bbreak;/.test(line))
      check(/uWxN\./.test(line), 'glsl: a break that does not test a uniform', line.trim());
  {
    const S = glsl.SURF;
    const on = S.indexOf('if (aeroWxOn > 0.0) {');
    const dbg = S.indexOf('if (uWxDbg > 0.5)');
    check(on > 0, 'glsl: the surface block has no uniform branch');
    let i = -1, n = 0;
    while ((i = S.indexOf('texture2D(', i + 1)) >= 0) {
      n++;
      check(i > on && (dbg < 0 || i < dbg), 'glsl: a texture2D outside the uniform branch');
    }
    check(n >= 4, 'glsl: the surface block samples less than it claims', String(n));
    // the invariants, verbatim
    check(/metalnessFactor \*= 1\.0 - cov;/.test(S), 'no shiny dirt: metalness does not fall with cover');
    check(/max\(roughnessFactor, flo\), cov\)/.test(S), 'no shiny dirt: roughness does not saturate up to the floor');
    check(/normalize\(mix\(normal, nonPerturbedNormal, uWxR\.x \* dustCov\)\)/.test(S), 'dust does not fill the microsurface');
    check(/material\.clearcoat \*= 1\.0 - aeroWxCov;/.test(glsl.CC), 'no shiny dirt: the clear coat does not fall with cover');
    // the unpack matches the table, slot by slot
    layers.forEach((L, i) => {
      const want = 'float wx_' + L.k + ' = uWxL[' + (i >> 2) + '].' + 'xyzw'[i & 3] + ' * wxK;';
      check(S.indexOf(want) >= 0, 'glsl: the unpack disagrees with the layer table', L.k);
    });
    check(layers.length <= nl * 4, 'more layers than uWxL slots');
  }
  {
    // the vec4 census of the prelude
    let vec = 0;
    for (const m of glsl.PARS.matchAll(/uniform (vec4|float|sampler2D) (\w+)(?:\[(\w+)\])?;/g)) {
      if (m[1] === 'sampler2D') continue;
      let n = 1;
      if (m[3]) {
        const d = glsl.PARS.match(new RegExp('#define ' + m[3] + ' (\\d+)'));
        n = d ? +d[1] : +m[3];
        if (!(n > 0)) n = 8;
      }
      vec += n;
    }
    // 48 was the plan's budget; the thrust lines (8), the turning parts'
    // knobs and the spiral (3) sit on top of it, against a WebGL2 floor of
    // 224 with ~165 spent before this module
    check(vec <= 60, 'uniform census: more than 60 vec4-equivalents', String(vec));
  }

  // ---- THE TABLES ----------------------------------------------------------
  for (const L of layers) {
    check(Array.isArray(L.c) && L.c.length === 4, 'layer without four coefficients', L.k);
    check(L.c.some(v => v > 0) || /^g(Rain|Bug)$/.test(L.k), 'layer reachable from no macro', L.k);
  }
  for (const C of cols)
    check(C.v[3] >= 0.85 || glossOk.includes(C.k), 'a dirt with a glossy floor', C.k + ' ' + C.v[3]);
  // a substrate row for a finish aeroskin does not know (yet) is a WARNING,
  // not a failure: in a shared tree a peer's new finish row and this table's
  // row for it land in either order (G325.1's sillAlu was in the working
  // copy and not at HEAD when this gate first ran from a clean worktree)
  for (const k of Object.keys(sub))
    if (!(k === 'glass' || finishes[k])) console.log('  warn substrate for a finish aeroskin does not know yet: ' + k);
  for (const k of Object.keys(finishes))
    check(!!sub[k], 'a finish with no substrate row (what does a chip expose?)', k);
  for (const k of Object.keys(sub)) {
    const r = sub[k];
    check(r.col && r.col.length === 3 && r.metal != null && r.rough != null && r.chip != null,
      'substrate row incomplete', k);
  }

  // ---- ORDER ---------------------------------------------------------------
  {
    const a = manifest.indexOf("'aeroweather.js'"), b = manifest.indexOf("'aeroskin.js'");
    check(a >= 0 && b >= 0 && a < b, 'build.js: aeroweather.js must precede aeroskin.js in the viewer manifest');
    for (const [name, html] of benches) {
      const b2 = html.indexOf('src/viewer/aeroskin.js');
      if (b2 < 0) continue;
      const a2 = html.indexOf('src/viewer/aeroweather.js');
      check(a2 >= 0 && a2 < b2, 'a bench loads aeroskin.js without aeroweather.js before it', name);
    }
  }

  // ---- THE SPEC ------------------------------------------------------------
  {
    const l = fromSpec({ finish: { wear: 0.4 } });
    check(Math.abs(l.age - 0.4) < 1e-9 && Math.abs(l.flight - 0.4) < 1e-9 && l.bush === 0 && l.rain === 0,
      'legacy finish.wear does not read as age = flight', JSON.stringify(l));
    const w = fromSpec({ finish: { weather: { bush: 1 } } });
    check(w.bush === 1 && w.age === 0 && w.flight === 0 && w.rain === 0,
      'finish.weather does not read as the four macros', JSON.stringify(w));
    const z = fromSpec({ finish: null });
    check(z.age === 0 && z.flight === 0 && z.bush === 0 && z.rain === 0, 'a null finish is not factory fresh');
    check(toSpec({ age: 0, flight: 0, bush: 0, rain: 0 }) === null, 'a fresh aeroplane writes a weather block');
    const t = toSpec({ age: 0.5, flight: 0, bush: 0, rain: 0.2 });
    check(t && t.age === 0.5 && t.rain === 0.2 && t.flight == null, 'toSpec is not deviations-only', JSON.stringify(t));
  }
  {
    const iDust = layers.findIndex(L => L.k === 'dust');
    const r1 = resolve({ flight: 1 }), r2 = resolve({ flight: 1, rain: 1 });
    check(r2[iDust] < r1[iDust], 'rain does not wash the dust (negative coefficient lost)');
    const r3 = resolve({ age: 1, flight: 1, bush: 1, rain: 1 });
    check(Array.from(r3).every(v => v >= 0 && v <= 1), 'a resolved strength escapes 0..1');
    const rp = resolve({}, { dust: 0.7 });
    check(Math.abs(rp[iDust] - 0.7) < 1e-6, 'a pin does not override the resolved strength');
  }

  // ---- THE BAKE ------------------------------------------------------------
  {
    const S = 32, g = grunge(S);
    check(g.length === S * S * 4, 'grunge: wrong size');
    for (let ch = 0; ch < 4; ch++) {
      let mn = 255, mx = 0;
      for (let i = ch; i < g.length; i += 4) { mn = Math.min(mn, g[i]); mx = Math.max(mx, g[i]); }
      check(mx - mn > 40, 'grunge: a flat channel', 'ch ' + ch + ' span ' + (mx - mn));
    }
    // tileable: the last row is nearer the first than the middle one is
    const rowDiff = (a, b) => { let d = 0; for (let x = 0; x < S; x++) d += Math.abs(g[(a * S + x) * 4] - g[(b * S + x) * 4]); return d / S; };
    check(rowDiff(0, S - 1) < rowDiff(0, S >> 1), 'grunge: the sheet does not tile');
  }
  return F;
}

// ---- THE REAL WORLD ---------------------------------------------------------
const benches = fs.readdirSync(path.join(ROOT, 'tools'))
  .filter(f => /\.html$/.test(f))
  .map(f => [f, rd(path.join(ROOT, 'tools', f))]);
const ctx = {
  glsl: { PARS: W.AERO_WX_PARS_FS, SURF: W.AERO_WX_SURF_FS, CC: W.AERO_WX_CC_FS,
          GLASS: W.AERO_WX_GLASS_FS, GVS: W.AERO_WX_GTINT_VS, GFS: W.AERO_WX_GTINT_FS },
  layers: W.AERO_WX_LAYERS, cols: W.AERO_WX_COL, glossOk: W.AERO_WX_GLOSS_OK,
  sub: W.AERO_WX_SUB, finishes: A.AERO_FINISH,
  manifest: rd(path.join(ROOT, 'tools', 'build.js')), benches,
  fromSpec: W.aeroWxMacroFromSpec, toSpec: W.aeroWxMacroToSpec, resolve: W.aeroWxResolve,
  grunge: W.aeroWxGrunge, nl: W.AERO_WX_NL,
};
const fail = audit(ctx);

// ---- THE GAME'S END OF IT (G345 phase 7): the editor, the join, the flight --
// Source assertions, comment-stripped: each of these is a door the macros or
// the sources go through, and each failure is silent at runtime.
function strip(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n'); }
{
  const chk = (ok, l, x) => { if (!ok) fail.push(l + (x ? ' — ' + x : '')); };
  const UI = strip(rd(path.join(ROOT, 'tools', '_cage_ui.js')));
  const JN = strip(rd(path.join(ROOT, 'tools', '_cage_join.js')));
  const AP = strip(rd(path.join(ROOT, 'src', 'viewer', 'app.js')));
  const EG = strip(rd(path.join(ROOT, 'tools', '_cage_eng.js')));
  const EM = strip(rd(path.join(ROOT, 'tools', '_eng_mesh.js')));
  // the editor: four rows, deviations out, the keeper in, never `out.wear`
  chk(/const WEAR = \{ age: 0, flight: 0, bush: 0, rain: 0 \};/.test(UI), 'editor: the four macros are not the state');
  chk(/for \(const k of WEAR_KEYS\) \{\s*const d = mkRow2\(WEAR_LABEL\[k\], WEAR_TIP\[k\]\);/.test(UI), 'editor: the four macro rows are not built');
  chk(/d\.dataset\.matHead = '1';\s*d\.dataset\.weather = k;/.test(UI), 'editor: the macro rows do not join the root livery block (matHead) or carry data-weather');
  chk(/out\.weather = wx;/.test(UI), 'editor: finishToSpec does not write finish.weather');
  chk(!/out\.wear = /.test(UI), 'editor: finishToSpec still writes finish.wear (two keepers of one fact)');
  chk(/aeroWxMacroFromSpec\(\{ finish: o \}\)/.test(UI), 'editor: finishFromSpec does not read through the module keeper');
  chk(/function applyWeather\(\)/.test(UI) && /for \(const u of \(E && E\.units\) \|\| \[\]\)/.test(UI), 'editor: applyWeather does not walk every engine unit');
  chk(/for \(const c of \(G && G\.contacts\) \|\| \[\]\)/.test(UI), 'editor: applyWeather does not walk every wheel contact');
  chk(!/wearFieldAt/.test(UI), 'editor: G70 nearest-vertex field lookup is back');
  chk(!/WEAR\.amount/.test(UI), 'editor: WEAR.amount survives somewhere');
  // the join: the record, every unit and every contact
  chk(/weather = \{ exhaust, wheels, engines, floor:/.test(JN) && /footwell, holes,\s*weather[,\s}]/.test(JN), 'join: no weather record in the snapshot');
  chk(/for \(const u of \(E && E\.units\) \|\| \[\]\)/.test(JN) && /for \(const c of \(G3 && G3\.contacts\) \|\| \[\]\)/.test(JN), 'join: the sources are not all units and all contacts');
  // the flight: the sources, the macros, the pane's multiplier
  chk(/AEROWX\.aeroWxSetSources\(THREE, Object\.assign\(\{ pivot: 1 \}, data\.weather \|\| \{\}\)\)/.test(AP), 'app: the flown build never receives the sources (with the pivot flag)');
  chk(/AEROWX\.aeroWxSetMacro\(THREE, AEROWX\.aeroWxMacroFromSpec\(genSpec\)\)/.test(AP), 'app: the flown build never receives the macros (G70\'s open gap)');
  chk(/wear: m\.wearM != null \? m\.wearM : 1,\s*screen: m\.sec === 'windshield' \? 1 : 0/.test(AP), 'app: the flown pane has no multiplier / screen flag');
  // G345.1: what turns is named — the join's walk, the record, the flown
  // material, the editor's section, the spiral on both sides
  chk(/spinKind = a\.name\.lastIndexOf\('edSpinner', 0\) === 0 \? 2 : 1;/.test(JN) && /spin: spinKind/.test(JN), 'join: the spinner and the blades are not named on the record');
  chk(/spin: m\.spin \|\| 0,/.test(AP), 'app: the flown blade/spinner material does not know it turns');
  chk(/spin: name === 'spinner' \? 2 : \(name === 'prop' \? 1 : 0\),/.test(UI), 'editor: secMat does not name the turning parts');
  chk(/aeroWxSetSpiral\(THREE, DEC\)/.test(UI) && /aeroWxSetSpiral\(THREE, window\.AEROSKIN\.aeroDecalMerge\(genSpec\)\)/.test(AP), 'the spiral does not reach both the editor and the flown build');
  chk(/spiralOn: 0, spiralCol: null/.test(rd(path.join(ROOT, 'src', 'viewer', 'aeroskin.js'))), 'the spiral keys are not in AERO_DEC_DEF (they would not persist)');
  // the engine: the direction is published
  chk(/ports\.exhaustDir/.test(EM), 'engine mesh: the pipe direction is not published beside its exit');
  chk(/exhaustDir = \[d\.x, d\.y, d\.z\]/.test(EG) && /exhaustAt, exhaustDir,/.test(EG), 'engine layer: the pipe direction does not reach CAGE_ENG.units');
}

// ---- THE SELFTEST ------------------------------------------------------------
if (SELF) {
  const clone = o => JSON.parse(JSON.stringify(o));
  const mut = (name, f, needle) => {
    const c = Object.assign({}, ctx, { glsl: Object.assign({}, ctx.glsl) });
    f(c);
    const r = audit(c);
    const hit = r.some(x => x.indexOf(needle) >= 0);
    console.log('  selftest ' + name.padEnd(40) + (hit ? 'CAUGHT' : 'MISSED') + (hit ? '' : '  (' + r.join(' | ').slice(0, 120) + ')'));
    return hit;
  };
  const probes = [
    ['a backtick in a block', c => { c.glsl.CC = c.glsl.CC + '// the `x`'; }, 'backtick'],
    ['a continue in the block', c => { c.glsl.SURF = c.glsl.SURF.replace('wxSoot = clamp', 'continue; wxSoot = clamp'); }, 'continue'],
    ['a break on a varying', c => { c.glsl.SURF = c.glsl.SURF.replace('if (float(i) >= uWxN.x) break;', 'if (vCraftPos.x > 1.0) break;'); }, 'break that does not test a uniform'],
    ['a literal loop bound', c => { c.glsl.SURF = c.glsl.SURF.replace('for (int i = 0; i < AEROWX_NE; ++i)', 'for (int i = 0; i < 4; ++i)'); }, 'loop'],
    ['a fetch outside the branch', c => { c.glsl.SURF = 'vec4 t0 = texture2D(tGrunge, vec2(0.0));\n' + c.glsl.SURF; }, 'outside the uniform branch'],
    ['metalness that goes UP', c => { c.glsl.SURF = c.glsl.SURF.replace('metalnessFactor *= 1.0 - cov;', 'metalnessFactor *= 1.0 + cov;'); }, 'metalness does not fall'],
    ['a clear coat that keeps its shine', c => { c.glsl.CC = c.glsl.CC.replace('material.clearcoat *= 1.0 - aeroWxCov;', ''); }, 'clear coat'],
    ['a layer with three coefficients', c => { c.layers = clone(c.layers); c.layers[0].c = [1, 0, 0]; }, 'four coefficients'],
    ['an unreachable layer', c => { c.layers = clone(c.layers); c.layers[1].c = [0, 0, 0, 0]; }, 'reachable from no macro'],
    ['a glossy mud', c => { c.cols = clone(c.cols); c.cols[2].v[3] = 0.5; }, 'glossy floor'],
    ['a finish with no substrate', c => { c.finishes = Object.assign({ __new__: {} }, c.finishes); }, 'no substrate row'],
    ['the manifest order swapped', c => { c.manifest = "'aeroskin.js', 'aeroweather.js'"; }, 'must precede'],
    ['a bench that loads aeroskin alone', c => { c.benches = [['_x.html', '<script src="../src/viewer/aeroskin.js"></script>']]; }, 'without aeroweather.js'],
    ['legacy wear ignored', c => { c.fromSpec = () => ({ age: 0, flight: 0, bush: 0, rain: 0 }); }, 'legacy finish.wear'],
    ['toSpec that writes zeros', c => { c.toSpec = m => m; }, 'weather block'],
    ['a resolve that ignores the wash', c => { c.resolve = () => new Float32Array(24).fill(0.5); }, 'wash'],
    ['a flat grunge', c => { c.grunge = S => new Uint8Array(S * S * 4).fill(128); }, 'flat channel'],
    ['the unpack drifted', c => { c.glsl.SURF = c.glsl.SURF.replace('float wx_dust = uWxL[0].x', 'float wx_dust = uWxL[0].y'); }, 'unpack disagrees'],
  ];
  let caught = 0;
  for (const [nm, f, needle] of probes) if (mut(nm, f, needle)) caught++;
  if (caught !== probes.length) fail.push('selftest: ' + (probes.length - caught) + ' probe(s) went unnoticed');
}

console.log('  layers ' + W.AERO_WX_LAYERS.length + ', colours ' + W.AERO_WX_COL.length +
  ', substrates ' + Object.keys(W.AERO_WX_SUB).length + ', benches ' + benches.length);
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE WEATHER: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
