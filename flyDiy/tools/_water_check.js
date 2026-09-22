#!/usr/bin/env node
// WATER CHECK — GATE WATER (H6, G460): the one water material, headless.
//
// What a headless node can hold about a shader:
//   1. PARITY — the felt band the GPU evaluates is world.waterH(x, z, t), the
//      function the floats are pushed by (ruling ap). water.js ships its
//      Gerstner GLSL in a scalar subset and TRANSPILES that exact string to
//      the JS the buoys and the bench read (gerstnerFromGLSL); this gate holds
//      that JS against waterH at 3000 random (x, z, t) to 1e-9, at t up to
//      1e5 s (the reduced phases), on the analytic world's own trains.
//   2. THE RULES — one hook in water.js, ATMO.inject its first line, nothing
//      per body interpolated into the GLSL (the cache key is the hook's
//      source); the uniform arrays hold 8 trains and seaFrom never makes more;
//      render_world.js no longer lifts the patch on the CPU, no longer sinks
//      the far plane 0.4 m, no longer keeps its own clock; build.js lists
//      water.js before render_world.js; the solver publishes t.
//   3. THE LAWS — the presets finite and a row per body; the slope variance
//      monotone in the footprint and in the wind, inside Cox-Munk's bounds;
//      the roughness inside [three's floor, 1].
//   4. THE TILE — periodic to the byte (the bake is a sum of integer waves),
//      a zero-mean slope, deterministic, no NaN.
//   6. THE SPRAY (H7.1) — spray.js loads, its kinds' laws are sane, the sprite
//      shader carries the log-depth / tone-mapping chunks, app.js draws through it.
//   5. THE FIELD (H7) — the interaction field's step is stable (CFL), damped,
//      rimmed; a stamp displaces h and h_prev together; the derive/decode pair
//      agree; app.js emits press/ring/foam from the hydro and steps the field.
//
// node tools/_water_check.js [--verbose]
'use strict';
const fs = require('fs');
const path = require('path');
const VERB = process.argv.includes('--verbose');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);
const src = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const W = require('../src/viewer/water.js');
const CORE = require('./flight_core.js');

// ---- 1. PARITY --------------------------------------------------------------
console.log('1. PARITY - the shipped GLSL against world.waterH');
{
  const world = CORE.makeWorld(0);
  verdict(typeof world.setSea === 'function' && world.sea, 'the world exports sea / setSea');
  world.setSea({ A: 0.4, L: 12, dir: 0.7 });
  const S = world.sea;
  verdict(S.W.length >= 2 && S.W.length <= W.NTR, `setSea made ${S.W.length} trains (the uniform array holds ${W.NTR})`);
  // waterH answers 0 (the still level) without t on the sea: the gate needs a sea point
  // the SEA lane (20_world.js: x 0, z 2000, 1.5 km of open sea) first, a seeded search after it - never Math.random (a red once in four runs)
  let sea = world.waterH(0, 2000) === 0 ? [0, 2000] : null;
  let seed0 = 777; const rnd0 = () => { seed0 = (seed0 * 1664525 + 1013904223) >>> 0; return seed0 / 4294967296; };
  for (let i = 0; i < 4000 && !sea; i++) { const x = (rnd0() - 0.5) * 6000, z = (rnd0() - 0.5) * 6000; if (world.waterH(x, z) === 0) sea = [x, z]; }
  verdict(!!sea, 'a sea point found on the analytic world');
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let dmax = 0, n = 0, dmaxT = 0;
  for (let i = 0; i < 3000 && sea; i++) {
    const x = sea[0] + (rnd() - 0.5) * 400, z = sea[1] + (rnd() - 0.5) * 400, t = rnd() * 1e5;
    if (world.waterH(x, z) !== 0) continue;
    const a = world.waterH(x, z, t), b = W.gerstnerJS(x, z, t, S.W);
    const d = Math.abs(a - b); if (d > dmax) { dmax = d; dmaxT = t; } n++;
  }
  verdict(n > 2000 && dmax < 1e-9, `${n} samples, t up to 1e5 s: max |waterH - gerstnerJS| = ${dmax.toExponential(2)} m (at t ${f(dmaxT, 0)})`);
  // the mirror is the transpiled shader text, not a hand copy
  let fromGLSL = null; try { fromGLSL = W.gerstnerFromGLSL(W.GLSL.gerstner); } catch (e) { fromGLSL = null; }
  verdict(typeof fromGLSL === 'function', 'the Gerstner GLSL stays inside the transpiler\'s subset');
  verdict(/float wGerstnerH\(float x, float z\)/.test(W.GLSL.gerstner) && /uWTrA\[i\]\.z/.test(W.GLSL.gerstner), 'the GLSL is the reduced-phase form (cos(k d - phase), phase = mod(om t - ph, 2 pi))');
  // the same string is what the hook splices (no second copy of the felt band)
  const hookSrc = W.hook.toString();
  verdict(/GLSL_GERSTNER/.test(hookSrc) && (src('src/viewer/water.js').match(/float wGerstnerH\(/g) || []).length === 1, 'one wGerstnerH in water.js, spliced into both stages from the one string');
  // the sim clock
  // the sim clock (the solver is built by app.js; the getter is held by its source)
  verdict(/get t\(\) \{ return simT; \}/.test(src('src/core/30_solver.js')), '30_solver.js publishes its clock (get t)');
  verdict(/WATER\.setTime\(sim\.t\)/.test(src('src/viewer/app.js')), 'app.js hands sim.t to WATER.setTime after the step');
  // 0 wind: no trains, the JS mirror answers 0
  verdict(W.gerstnerJS(10, 20, 5, []) === 0, 'no trains: 0');
  // THE FELT BAND (G460.6): the floats feel the trains of L >= 0.45 L, the short wind sea is a slope only
  { const nf = S.W.filter(w => w.felt).length, ns = S.W.filter(w => !w.felt).length;
    verdict(nf === 8 && ns === 24 && S.W.every(w => w.felt === (2 * Math.PI / w.k >= 0.75 * S.L - 1e-9)), `the felt band: ${nf} trains felt (the swell band, L >= 0.75 L), ${ns} drawn as slope only`);
    const t = 3.3, x = sea[0] + 7, z = sea[1] - 4; let all = 0; for (const w of S.W) all += w.A * Math.cos(w.k * (w.dx * x + w.dz * z) - w.om * t + w.ph);
    verdict(Math.abs(all - world.waterH(x, z, t)) > 1e-4, 'waterH is the felt band, not the sum of all 32 (the two differ)');
    world.setSea({ A: 0.4, L: 12, dir: 0.7, n: 2 }); verdict(world.sea.W.every(w => w.felt), 'the two-train sea is felt whole'); world.setSea({ A: 0.4, L: 12, dir: 0.7 }); }
}

// ---- 2. THE RULES -----------------------------------------------------------
console.log('\n2. THE RULES');
{
  const w = src('src/viewer/water.js'), rw = src('src/viewer/render_world.js');
  const hooks = (w.match(/onBeforeCompile\s*=/g) || []).length;
  verdict(hooks === 1, `one onBeforeCompile assignment in water.js (${hooks})`);
  const body = W.hook.toString();
  verdict(/^\s*function hook\(sh\) \{\s*if \(typeof ATMO !== 'undefined'\) ATMO\.inject\(sh\);/.test(body), 'ATMO.inject(sh) is the hook\'s first statement');
  verdict(!/\$\{/.test(body), 'nothing interpolated into the hook\'s GLSL (the cache key is the hook\'s source)');
  verdict(/uniform vec4 uWTrA\[32\]/.test(W.GLSL.frag) && W.NTR === 32, 'the uniform arrays hold 32 trains');
  // seaFrom at a gale never exceeds the array
  const world = CORE.makeWorld(0); world.setWind({ base: [30, 0, 0] });
  verdict(world.sea.W.length <= W.NTR, `seaFrom at 30 m/s: ${world.sea.W.length} trains <= ${W.NTR}`);
  verdict(!/pa\.setY\(i, waves \? world\.waterH[^\n]*\n(?![^\n]*else)/.test(rw) || /if \(WSH\) WSH\.setNear/.test(rw), 'render_world.js lifts the patch on the GPU (the CPU loop is the no-shader path only)');
  verdict(/WSH \? 0\.0 : -0\.4/.test(rw), 'the far plane is at the level with the shader (-0.4 only without it)');
  verdict(/const seaTime = \(\) => WSH \? WSH\.time\(\) : seaT/.test(rw), 'the buoys and the patch read the shader\'s clock (the solver\'s)');
  verdict(/WSH\.make\(THREE\)/.test(rw) && /wtag\(farGeo, 0, false\)/.test(rw) && /wtag\(seaGeo, 0, true\)/.test(rw) && /wtag\(g, 1, false\)/.test(rw), 'the sea, the patch and the lakes take the one material with their body attribute');
  verdict(/WATER\.setSDF\(gU\.uGPackA\.value, gU\.uGGrid\.value\)/.test(rw), 'the coast and lake fields reach the water');
  verdict(/WATER\.setWind\(mag/.test(rw), 'the wind reaches the water (setWindVis)');
  const b = src('tools/build.js'); const iw = b.indexOf("'water.js'"), ir = b.indexOf("'render_world.js'");
  verdict(iw > 0 && ir > iw, 'build.js lists water.js before render_world.js');
  const dev = fs.existsSync(path.join(__dirname, '..', 'dev.html')) ? src('dev.html') : '';
  verdict(!dev || /water\.js/.test(dev), 'dev.html carries water.js');
  // the samplers the hook declares: the detail tile, the fields, the interaction slot - no more
  const samplers = (W.GLSL.frag.match(/sampler2D\s+\w+/g) || []).map(s => s.split(/\s+/)[1]);
  verdict(samplers.length === 3 && samplers.includes('uWDetail') && samplers.includes('uWSdf') && samplers.includes('uWInter'), `three samplers of its own: ${samplers.join(', ')}`);
  verdict(typeof W.setInteraction === 'function' && /uWInterBox/.test(W.GLSL.frag), 'the interaction slot (setInteraction) exists and the shader reads it');
}

// ---- 3. THE LAWS ------------------------------------------------------------
console.log('\n3. THE LAWS');
{
  for (const k of W.BODIES) {
    const p = W.PRESETS[k];
    const ok = p && [p.abs[0], p.abs[1], p.abs[2], p.opa, p.sct[0], p.sct[1], p.sct[2], p.wave, p.detail, p.foam, p.depth].every(v => Number.isFinite(v)) && p.abs.every(v => v > 0) && p.opa > 0;
    verdict(ok, `preset ${k}: abs ${p.abs.map(v => f(v, 2)).join('/')} opa ${f(p.opa, 2)} sct ${p.sct.map(v => f(v, 3)).join('/')} wave ${p.wave} detail ${p.detail} depth ${p.depth} m`);
  }
  let mono = true, bounded = true, prev = -1;
  for (const U10 of [0, 2, 5, 10, 20, 30]) {
    prev = -1;
    for (const fp of [0.001, 0.01, 0.05, 0.2, 1, 5, 20, 100, 1000]) {
      const s2 = W.sigma2JS(fp, U10, 12);
      if (s2 < prev - 1e-12) mono = false; prev = s2;
      if (s2 < 0 || s2 > 0.003 + 0.00512 * U10 + 1e-12) bounded = false;
      const r = W.roughJS(s2); if (r < 0.05 || r > 1) bounded = false;
    }
  }
  verdict(mono, 'sigma^2 grows with the footprint');
  let monoU = true; for (const fp of [0.01, 1, 100]) { let p = -1; for (const U of [0, 5, 10, 20]) { const s = W.sigma2JS(fp, U, 12); if (s < p - 1e-12) monoU = false; p = s; } }
  verdict(monoU, 'sigma^2 grows with the wind');
  verdict(bounded, 'sigma^2 inside Cox-Munk\'s total, roughness inside [0.05, 1]');
  const far = W.sigma2JS(1000, 7, 12), near = W.sigma2JS(0.002, 7, 12);
  verdict(far > 0.9 * (0.003 + 0.00512 * 7) && near < 0.1 * (0.003 + 0.00512 * 7), `at 7 m/s: the horizon's sigma^2 ${f(far, 4)} (roughness ${f(W.roughJS(far), 2)}), the dock's ${f(near, 5)} (roughness ${f(W.roughJS(near), 2)})`);
}

// ---- 4. THE TILE ------------------------------------------------------------
console.log('\n4. THE TILE');
{
  const a = W.bakeTile(64, 12345), b = W.bakeTile(64, 12345);
  const N = a.N; let same = true, nan = false;
  for (let i = 0; i < a.data.length; i++) { if (a.data[i] !== b.data[i]) same = false; if (Number.isNaN(a.data[i])) nan = true; }
  verdict(same && !nan, `deterministic (${N}x${N}, two bakes byte-equal), no NaN`);
  // periodic: the bake is a sum of integer waves, so the analytic slope at u = 0 and u = 1 is the same
  // sample - the texel grid never reaches u = 1 (texel N would be texel 0). Check the wrap by re-baking
  // the first row's analytic form against the last row's continuation: the row-to-row step at the seam
  // must be no larger than the typical step inside.
  let inner = 0, seam = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 1; j < N; j++) inner += Math.abs(a.data[(j * N + i) * 4] - a.data[((j - 1) * N + i) * 4]);
    seam += Math.abs(a.data[i * 4] - a.data[((N - 1) * N + i) * 4]);
  }
  inner /= N * (N - 1); seam /= N;
  verdict(seam < 2.5 * inner + 1, `periodic across the seam: mean step ${f(seam, 2)} at the wrap vs ${f(inner, 2)} inside`);
  let mx = 0, mz = 0; for (let p = 0; p < N * N; p++) { mx += a.data[p * 4] / 255 * 2 - 1; mz += a.data[p * 4 + 1] / 255 * 2 - 1; }
  mx /= N * N; mz /= N * N;
  verdict(Math.abs(mx) < 0.02 && Math.abs(mz) < 0.02, `zero-mean slope (${f(mx, 3)}, ${f(mz, 3)})`);
}

// ---- 5. THE FIELD (H7, G460.8) ----------------------------------------------
console.log('\n5. THE FIELD');
{
  const w = src('src/viewer/water.js'), app = src('src/viewer/app.js');
  verdict(typeof W.stamp === 'function' && typeof W.fieldStep === 'function' && typeof W.fieldOn === 'function' && W.field && W.FIELD_N === 256 && W.FIELD_M === 128, `the field's API (stamp / fieldStep / fieldOn), ${W.FIELD_N}^2 texels over ${W.FIELD_M} m`);
  const dx = W.FIELD_M / W.FIELD_N, cfl = W.field.c / 60 / dx;
  verdict(cfl < 0.5 && /Math\.min\(0\.45, F\.c \* Math\.max\(dt, 1e-3\) \/ dx\)/.test(w), `the step is stable: c dt/dx = ${f(cfl, 3)} at 60 Hz (< 0.5), clamped at 0.45 for a long frame`);
  verdict(W.field.damp > 0.98 && W.field.damp < 1 && W.field.foamDecay > 0.9 && W.field.foamDecay < 1, `damping per frame ${W.field.damp} (a ripple's e-fold ${f(-1 / Math.log(W.field.damp) / 60, 1)} s), foam ${W.field.foamDecay}`);
  // a stamp must displace h AND h_prev (a change of h alone is read by the leapfrog as a velocity: the crater deepens)
  verdict(/gl_FragColor = vec4\(hn \+ ds, h \+ ds, clamp\(fn, 0\.0, 1\.0\), 1\.0\);/.test(w), 'a stamp displaces h and h_prev together (never a velocity)');
  verdict(/float rim = smoothstep\(0\.0, uK\.w, e\);/.test(w) && W.field.rim >= 8, `the absorbing rim (${W.field.rim} texels)`);
  verdict(/gl_FragColor = vec4\(clamp\(sl \/ 4\.0 \+ 0\.5, 0\.0, 1\.0\), foam, 1\.0\);/.test(w) && /\(t\.rg \* 2\.0 - 1\.0\) \* 2\.0/.test(W.GLSL.frag), 'the derive pass writes the slot\'s encode (slope over [-2, 2]) and the shader decodes the same');
  verdict(/renderer\.setClearColor\(0x000000, 0\)/.test(w), 'the state is cleared to 0 on first use (not the scene\'s sky colour)');
  // the caller's render target is read BEFORE the first-use clears and restored after the passes (read after
  // them, the first step handed app.js the state target and the canvas froze: h7l/h7m)
  { const fs = w.slice(w.indexOf('function fieldStep('), w.indexOf('function fieldOn('));
    const iP = fs.indexOf('const prevT = renderer.getRenderTarget()'), iC = fs.indexOf('if (!F.ready)'), iR = fs.indexOf('renderer.setRenderTarget(prevT)');
    verdict(iP > 0 && iC > iP && iR > iC, 'fieldStep reads the caller\'s target before its clears and restores it after its passes'); }
  // the emitters in app.js: the press under a wet hull, the ring on touchdown, the foam on the chine; the ribbons retired
  verdict(/WT\.stamp\([^\n]*'press'\)/.test(app) && /WT\.stamp\([^\n]*'ring'\)/.test(app) && /WT\.stamp\([^\n]*'foam'\)/.test(app), 'app.js stamps press / ring / foam from the hydro\'s own numbers');
  verdict(/const ribbons = \[\];/.test(app) && !/rb\.trail\.push/.test(app), 'the wake ribbons are retired (the field carries the wake)');
  verdict(/WATER\.fieldStep\(THREE, renderer, cgF\[0\], cgF\[2\]/.test(app) && /WATER\.fieldOn\(want\)/.test(app), 'app.js steps the field at the CG every frame while a floatplane is over water');
  verdict(/WATER\.fieldStep && !inGarage && \(sim\.hydro \|\| WATER\.field\.force\)/.test(app), 'without hydro the field runs only when the dev panel forces it');
}

// ---- 6. THE SPRAY (H7.1, G460.9) ---------------------------------------------
console.log('\n6. THE SPRAY');
{
  const SP = require('../src/viewer/spray.js'); const app = src('src/viewer/app.js'), b = src('tools/build.js');
  verdict(typeof SP.make === 'function' && SP.KIND && SP.KIND.droplet && SP.KIND.puff, 'spray.js loads headless: make + the two kinds');
  for (const k of ['droplet', 'puff']) { const K = SP.KIND[k];
    verdict(K.life[0] > 0 && K.life[1] >= K.life[0] && K.size[0] > 0 && K.size[1] >= K.size[0] && K.grow >= 1 && K.drag >= 0 && K.gravity >= 0 && K.gravity <= 1, `${k}: life ${K.life.join('-')} s, size ${K.size.join('-')} m, grow ${K.grow}, drag ${K.drag}, gravity ${K.gravity}`); }
  // the log-depth chunks: the renderer runs a logarithmic depth buffer and a ShaderMaterial without them fails every depth test (h7t: nothing drew)
  verdict(/#include <logdepthbuf_pars_vertex>/.test(SP.GLSL.vert) && /#include <logdepthbuf_vertex>/.test(SP.GLSL.vert) && /#include <logdepthbuf_pars_fragment>/.test(SP.GLSL.frag) && /#include <logdepthbuf_fragment>/.test(SP.GLSL.frag), 'the sprite shader splices the log-depth chunks (both stages)');
  verdict(/#include <tonemapping_fragment>/.test(SP.GLSL.frag) && /#include <colorspace_fragment>/.test(SP.GLSL.frag), 'the sprite shader ends in three\'s tone-mapping and colour-space chunks');
  verdict(/attribute vec3 iVel/.test(SP.GLSL.vert) && /uStretch/.test(SP.GLSL.vert), 'the sprite is stretched along its velocity');
  verdict(/uSunV/.test(SP.GLSL.frag) && /uSkyCol/.test(SP.GLSL.frag) && !/AdditiveBlending/.test(src('src/viewer/spray.js')), 'the sprite is lit by the sun and the sky, alpha-blended (never additive)');
  verdict(/SPRAY\.make\(THREE, NP\)/.test(app) && /sprayEmit\(D, 1,/.test(app) && /sprayEmit\(D, 0,/.test(app) && /S\.light\(/.test(app), 'app.js draws the spray through spray.js (both kinds emitted, lit each frame)');
  verdict(/'water\.js', 'spray\.js'/.test(b), 'build.js lists spray.js beside water.js');
  verdict(/F\.sta\[0\]\.K/.test(app) && /'press'\); \}/.test(app), 'the bow wave: a press ahead of the stem while under way');
}

console.log('\nGATE WATER: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
