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
  verdict(samplers.length === 4 && samplers.includes('uWDetail') && samplers.includes('uWSdf') && samplers.includes('uWInter') && samplers.includes('uWMirror'), `four samplers of its own: ${samplers.join(', ')}`);
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
  // THE OPTICS (G460.11): the colours come from the constituents (Morel-Prieur), never painted - pure water is
  // blue, CDOM browns it, chlorophyll greens it, sediment whitens it; the sea is dark (upwelling under 2 %), a
  // muskeg lake near-black, and the sea's blue is not above its green (a lagoon's is)
  { const o = k => W.bodyOptics(k);
    const clear = o({ cdom: 0.01, chl: 0.1, sed: 0.05 }), bog = o({ cdom: 3, chl: 2, sed: 0.3 }), bloom = o({ cdom: 0.1, chl: 10, sed: 0.5 }), silt = o({ cdom: 0.2, chl: 0.5, sed: 20 });
    verdict(clear.sct[2] > clear.sct[1] && clear.sct[1] > clear.sct[0], `clear water is blue (${clear.sct.map(v => f(v, 4)).join('/')})`);
    verdict(bog.sct[2] < clear.sct[2] * 0.1 && Math.max(...bog.sct) < 0.004, `a muskeg lake is near-black (${bog.sct.map(v => f(v, 4)).join('/')})`);
    verdict(bloom.sct[1] > bloom.sct[2] && bloom.sct[1] > bloom.sct[0], `a bloom is green (${bloom.sct.map(v => f(v, 4)).join('/')})`);
    verdict(Math.min(...silt.sct) > 0.05, `a silted river is milky (${silt.sct.map(v => f(v, 4)).join('/')})`);
    const sea = W.PRESETS.sea; verdict(sea.sct[1] >= sea.sct[2] * 0.95 && Math.max(...sea.sct) < 0.02, `the sea upwells under 2 %, green over blue - no lagoon (${sea.sct.map(v => f(v, 4)).join('/')})`);
    verdict(W.WATER_TYPES && ['sea', 'lake', 'river', 'premises'].every(k => W.WATER_TYPES[k] && ['cdom', 'chl', 'sed'].every(q => Number.isFinite(W.WATER_TYPES[k][q]))), 'every body is three constituents (cdom, chl, sed)'); }
  // THE MIRROR (G460.11): the shader reads the capture where the point projects, keeps the probe's sky where the
  // capture is empty; the pass hides the water's own material, reuses the shadow maps, restores the target
  { verdict(/uniform sampler2D uWMirror; uniform mat4 uWMirrorVP;/.test(W.GLSL.frag) && /vec3 mcol = mr\.rgb \/ max\(mr\.a, 0\.02\);/.test(src('src/viewer/water.js')) && /iblRadiance = mix\(iblRadiance, mcol, mmask \* edge\);/.test(src('src/viewer/water.js')), 'the mirror replaces the IBL only where the capture has something, its colour un-premultiplied (alphaToCoverage resolves to a partial alpha)');
  verdict(/samples: 2,/.test(src('src/viewer/water.js')) && /depthTexture: THREE\.DepthTexture \? new THREE\.DepthTexture\(w, h, THREE\.UnsignedInt248Type\)/.test(src('src/viewer/water.js')), "the capture is multisampled (its depth texture a resolve: the clouds' composite samples it while drawing into it)");
    const w = src('src/viewer/water.js'), mp = w.slice(w.indexOf('function mirrorRender('), w.indexOf('function mirrorOff('));
    verdict(/mat\.visible = false/.test(mp) && /renderer\.shadowMap\.autoUpdate = false/.test(mp) && /renderer\.setRenderTarget\(prevT\)/.test(mp) && /scene\.background = null/.test(mp), 'the capture hides the water, reuses the shadow maps, restores the target and the background');
    // THE SKY IS IN THE CAPTURE (G460.11.3): without it the clear sky was alpha 0 and the water took the PROBE's sky
    // there - the reflection changed source at every cloud's edge, a hard line across the water
    verdict(/if \(opts\.sky\) \{/.test(mp) && /MIR\.skyScene\.add\(sky\);/.test(mp) && /sky\.position\.copy\(mc\.position\);/.test(mp) && /skyPar\.add\(sky\);/.test(mp), 'the capture draws the sky dome at the mirrored eye first (and hands it back to its parent)');
    verdict(/sky: WF\.skyDome/.test(src('src/viewer/app.js')), "app.js hands the world's sky dome to the capture");
    // AND IT IS VISIBLE WHILE IT IS DRAWN (G460.11.8): the dome is in opts.hide (it must be out of the SCENE
    // draw, where it rides the main camera) and the hide loop runs FIRST - so for six landings the sky pass
    // rendered an invisible dome, the capture's clear sky stayed alpha 0 and the water read the probe there:
    // one sky in the cloudy parts of the reflection and another in the clear ones, which is what the user saw
    // ("the cloud reflections look really strange ... my brain does not reconcile it as being the mirrored sky")
    { const sk = mp.slice(mp.indexOf('if (opts.sky) {'), mp.indexOf('if (opts.clouds)'));
      verdict(/const skyVis = sky\.visible;\s*\n\s*sky\.visible = true;/.test(sk) && sk.indexOf('sky.visible = true;') < sk.indexOf('renderer.render(MIR.skyScene, mc);') && /sky\.visible = skyVis;/.test(sk),
        'the sky pass makes the dome VISIBLE for its own draw (opts.hide had already silenced it) and puts it back'); }
    // the mean Fresnel rides the MIRROR too: with the sky in the capture the mirror supplies the whole
    // reflection, and a dim that rode only the probe would leave the grazing sea a hard mirror again
    verdict(/float wMeanF = mix\(1\.0, clamp\(wFm \/ max\(wF5, 1\.0e-4\), 0\.0, 1\.0\), smoothstep\(0\.55, 0\.15, wC\)\);/.test(w) && w.indexOf('float wMeanF =') < w.indexOf('iblRadiance = mix(iblRadiance, mcol, mmask * edge);') && /iblRadiance \*= wMeanF; \}`\)/.test(w),
      "Bruneton's mean Fresnel is applied AFTER the mirror's mix (the probe and the capture dim alike)");
    verdict(typeof W.mirrorRender === 'function' && W.mirror && W.mirror.mode === 'periodic' && W.mirror.maxAgl > 10, `the mirror API, '${W.mirror.mode}' by default, under ${W.mirror.maxAgl} m over the water`);
    // THE CADENCE (G460.11.4): the clock is real seconds (a call-counted clock ran at a fifth of the wall clock under
    // the rig: a stale capture from 1500 m away, the reflection stretched), the eye's motion re-captures, a jump at once
    verdict(/MIR\.t = \(typeof performance !== 'undefined' \? performance\.now\(\) : Date\.now\(\)\) \/ 1000;/.test(mp), "the mirror's clock is real seconds (never a count of calls)");
    // the capture is projected from the STILL surface: through the displaced (faceted) position it creases along
    // every facet edge of the near patch's 3.75 m grid (G460.11.6)
    verdict(/vec4 mp = uWMirrorVP \* vec4\(vWP0 \+ mD, 1\.0\);/.test(w), 'the mirror is projected from the undisplaced position (never the faceted one)');
    // THE SLOPE MOVES THE POINT, NOT THE UV (G460.11.9): the walk is R = reflect(V, n) followed from the
    // MIRRORED EYE back to the water plane, Q = E' + R (h / R.y) - metres on the water, in the reflection's
    // own direction, so no frame is assumed (the old uv push added a WORLD vector to a CAPTURE uv whose x
    // axis is the negative of the world's). The four lines are asserted here and their arithmetic is proved
    // below, scalar-wise: Q IS the point itself when the surface is flat, the walk stays on the plane, and
    // the cap holds (a facet at grazing has R.y near zero and h / R.y near infinity).
    verdict(/vec3 mR = reflect\(normalize\(vWP0 - mEye\), wNw\);/.test(w) &&
            /float mH = mEye\.y - uWMirror4\.w, mL = max\(distance\(vWP0, mEye\), 1\.0e-3\);/.test(w) &&
            /float mT = mH \/ max\(mR\.y, min\(mH \/ mL, 0\.02\)\);/.test(w) &&
            /vec3 mD = vec3\(mEye\.x \+ mR\.x \* mT, vWP0\.y, mEye\.z \+ mR\.z \* mT\) - vWP0;/.test(w) &&
            /mD \*= min\(1\.0, mLim \/ max\(length\(mD\), 1\.0e-4\)\);/.test(w) &&
            !/muv = mp\.xy \/ mp\.w \* 0\.5 \+ 0\.5 \+ /.test(w),
      "the slope walks the POINT on the water (the mirrored eye's reflected ray back to the plane), never the capture's uv");
    verdict(/U\.uWMirror4\.value\.set\(1, MIR\.perturb, MIR\.lod, waterY\);/.test(w) && W.mirror.perturb > 0 && W.mirror.perturb <= 0.25,
      `the mirror's plane rides uWMirror4.w (the walk needs it) and the walk is capped at ${(W.mirror.perturb * 100).toFixed(0)} % of the view distance`);
    { // the shader's arithmetic, scalar-wise (the lines above are asserted verbatim, so the two cannot drift
      // silently): flat water must give back the point, the walk must stay on the plane, the cap must hold
      const K = W.mirror.perturb;
      const walk = (ex, ey, ez, px, pz, py, nx, ny, nz) => {
        const vx = px - ex, vy = py - ey, vz = pz - ez, vl = Math.hypot(vx, vy, vz);
        const ux = vx / vl, uy = vy / vl, uz = vz / vl;
        const nl = Math.hypot(nx, ny, nz), mx = nx / nl, my = ny / nl, mz = nz / nl;
        const d = ux * mx + uy * my + uz * mz;
        const rx = ux - 2 * d * mx, ry = uy - 2 * d * my, rz = uz - 2 * d * mz;
        const t = (ey - py) / Math.max(ry, Math.min((ey - py) / Math.max(vl, 1e-3), 0.02));
        let dx = ex + rx * t - px, dy = 0, dz = ez + rz * t - pz;
        const k = Math.min(1, K * vl / Math.max(Math.hypot(dx, dy, dz), 1e-4));
        return [dx * k, dy * k, dz * k, vl];
      };
      let flat = 0, cap = 0, plane = 0;
      let r = 12345; const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < 2000; i++) {
        const py = (rnd() - 0.5) * 80;                                  // the water's level, anywhere
        const ex = (rnd() - 0.5) * 2000, ez = (rnd() - 0.5) * 2000, ey = py + 0.2 + rnd() * 400;
        const px = ex + (rnd() - 0.5) * 4000, pz = ez + (rnd() - 0.5) * 4000;
        const f = walk(ex, ey, ez, px, pz, py, 0, 1, 0);
        if (Math.hypot(f[0], f[1], f[2]) > 1e-9) flat++;
        const n = walk(ex, ey, ez, px, pz, py, (rnd() - 0.5) * 1.2, 1, (rnd() - 0.5) * 1.2);
        if (Math.abs(n[1]) > 1e-12) plane++;
        if (Math.hypot(n[0], n[1], n[2]) > K * n[3] + 1e-6) cap++;
      }
      verdict(flat === 0 && plane === 0 && cap === 0,
        `the walk over 2000 eyes: flat water gives back the point (${flat} misses), it stays on the plane (${plane}), it never exceeds the cap (${cap})`); }
    verdict(W.mirror.moveM <= 4 && W.mirror.turnDeg <= 4 && W.mirror.jumpM > 0 && /due = jump \|\|/.test(mp), `the eye re-captures at ${W.mirror.moveM} m / ${W.mirror.turnDeg} deg, a jump (${W.mirror.jumpM} m / ${W.mirror.jumpDeg} deg) at once`);
    const gfx = src('src/viewer/gfx_settings.js'); verdict(/k: 'mirror'/.test(gfx) && /W\.WATER\.set\(\{ mirror: S\.mirror \}\)/.test(gfx), 'GRAPHICS has the reflections row and hands it to the water'); }
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
  verdict(typeof W.stamp === 'function' && typeof W.fieldStep === 'function' && typeof W.fieldOn === 'function' && W.field && W.FIELD_N === 384 && W.FIELD_M === 192, `the field's API (stamp / fieldStep / fieldOn), ${W.FIELD_N}^2 texels over ${W.FIELD_M} m`);
  // THE DISPERSIVE STEP (G460.10): the kernel's response to a plane wave is |k| in its band, never negative
  // (a negative response is an exponentially growing mode), sums to zero (no DC restoring force), and the
  // fine level's highest mode is far from the leapfrog's limit
  { const P = W.KERN_P, K = W.fieldKernel(P), gain = W.fieldKernelGain(K, P);
    let mn = 1e9, mx = 0; for (let k = 0.05; k <= 3.15; k += 0.05) { const r = W.kernelResponse(K, P, k) * gain; mn = Math.min(mn, r); mx = Math.max(mx, r); }
    let mnD = 1e9; for (let k = 0.1; k <= 3.15; k += 0.1) { let r = 0; for (let i = -P; i <= P; i++) for (let j = -P; j <= P; j++) r += K[Math.abs(i) * (P + 1) + Math.abs(j)] * Math.cos(k * (i + j) / Math.SQRT2); mnD = Math.min(mnD, r * gain); }
    verdict(mn >= 0 && mnD >= 0, `the kernel's response is never negative (min ${f(mn, 4)} on the axis, ${f(mnD, 4)} on the diagonal)`);
    verdict(Math.abs(W.kernelSum(K, P)) < 1e-6, `the kernel sums to zero (${W.kernelSum(K, P).toExponential(1)})`);
    const r02 = W.kernelResponse(K, P, 0.2) * gain / 0.2, r05 = W.kernelResponse(K, P, 0.5) * gain / 0.5, r10 = W.kernelResponse(K, P, 1.0) * gain / 1.0;
    verdict(Math.abs(r05 - 1) < 1e-6 && r10 > 0.85 && r10 < 1.2 && r02 > 0.4, `the response is |k| over the band: ${f(r02, 2)} |k| at lambda 31 texels, ${f(r05, 2)} at 12.6, ${f(r10, 2)} at 6.3`);
    const dx0 = W.FIELD_M / W.FIELD_LEVELS[0].N, wdt = Math.sqrt(9.81 / dx0 * mx) / 30;
    verdict(wdt < 0.5, `the fine level's highest mode: omega dt = ${f(wdt, 3)} at the 1/30 s clamp (< 0.5)`);
    verdict(W.FIELD_LEVELS.length === 2 && W.FIELD_LEVELS[1].N * 4 === W.FIELD_LEVELS[0].N && W.field.nu > 0, `two levels over ${W.FIELD_M} m (${W.FIELD_LEVELS.map(l => l.N).join(' / ')}: ${f(dx0, 2)} / ${f(W.FIELD_M / W.FIELD_LEVELS[1].N, 1)} m texels), viscosity ${W.field.nu}`);
    verdict(/vec2 sl = vec2\(hx, hz\) \/ \(2\.0 \* uDx\) \+ vec2\(hx1, hz1\) \/ \(2\.0 \* uDx1\);/.test(w), "the derive pass sums both levels' slopes"); }
  verdict(W.field.tau > 2 && W.field.tau < 30 && W.field.foamTau > 0.5 && W.field.foamTau < 10 && /Math\.exp\(-dtc \/ F\.tau\), Math\.exp\(-dtc \/ F\.foamTau\)/.test(w), `damping per SECOND: a wave's e-fold ${W.field.tau} s, the foam's ${W.field.foamTau} s (never per frame)`);
  // a stamp must displace h AND h_prev (a change of h alone is read by the leapfrog as a velocity: the crater deepens)
  verdict(/gl_FragColor = vec4\(hn \+ ds, h \+ ds, clamp\(fn, 0\.0, 1\.0\), 1\.0\);/.test(w), 'a stamp displaces h and h_prev together (never a velocity)');
  verdict(/float rim = smoothstep\(0\.0, uK\.w, e\);/.test(w) && W.field.rim >= 0.02, `the absorbing rim (${W.field.rim} of the box)`);
  verdict(/gl_FragColor = vec4\(clamp\(sl \/ 4\.0 \+ 0\.5, 0\.0, 1\.0\), foam, 1\.0\);/.test(w) && /\(t\.rg \* 2\.0 - 1\.0\) \* 2\.0/.test(W.GLSL.frag), 'the derive pass writes the slot\'s encode (slope over [-2, 2]) and the shader decodes the same');
  verdict(/renderer\.setClearColor\(0x000000, 0\)/.test(w), 'the state is cleared to 0 on first use (not the scene\'s sky colour)');
  verdict(/F\.out = mk\(FIELD_N, THREE\.HalfFloatType\);/.test(w), 'the slot is half float (a byte slot cannot hold a zero slope: 127.5 rounds to a tilt over the whole box)');
  // the caller's render target is read BEFORE the first-use clears and restored after the passes (read after
  // them, the first step handed app.js the state target and the canvas froze: h7l/h7m)
  { const fs = w.slice(w.indexOf('function fieldStep('), w.indexOf('function fieldOn('));
    const iP = fs.indexOf('const prevT = renderer.getRenderTarget()'), iC = fs.indexOf('if (!F.ready)'), iR = fs.indexOf('renderer.setRenderTarget(prevT)');
    verdict(iP > 0 && iC > iP && iR > iC, 'fieldStep reads the caller\'s target before its clears and restores it after its passes'); }
  // the emitters in app.js: the press under a wet hull, the ring on touchdown, the foam on the chine; the ribbons retired
  verdict(/WT\.stamp\([^\n]*'press'\)/.test(app) && /WT\.stamp\([^\n]*'ring'\)/.test(app) && /WT\.stamp\([^\n]*'foam'\)/.test(app), 'app.js stamps press / ring / foam from the hydro\'s own numbers');
  verdict(/const ribbons = \[\];/.test(app) && !/rb\.trail\.push/.test(app), 'the wake ribbons are retired (the field carries the wake)');
  verdict(/WATER\.fieldStep\(THREE, renderer, cgF\[0\], cgF\[2\], running \? 1 \/ 60 : 0, cv\[0\], cv\[2\]\)/.test(app) && /WATER\.fieldOn\(want\)/.test(app), 'app.js steps the field at the CG (with its velocity) every frame while a floatplane is over water');
  // THE THIRD WAY IN (2026-09-22, G498): a surfaced whale within 150 m of the eye sets
  // WATER.field.ask, so a LANDPLANE low over a pod gets the wake and the splash too (the user:
  // "at close range, the whales should trigger the water surface effects, just like the planes").
  // The rule this line has always held is UNCHANGED in substance - the field does not run for
  // nothing - so the ask is checked to EXPIRE: a flag nobody clears would be a field that never
  // stops. GATE ANIMALS rule 9 holds the other end (who sets it, and that the premises host is
  // the only thing that does).
  verdict(/WATER\.fieldStep && !inGarage && \(sim\.hydro \|\| WATER\.field\.force \|\| wAsk\)/.test(app),
    'without hydro the field runs only when the dev panel forces it, or something ASKS for it');
  verdict(/const wAsk = window\.WATER && WATER\.field && WATER\.field\.ask && performance\.now\(\) - WATER\.field\.ask < 500/.test(app),
    'the ask EXPIRES (half a second) and is read off window.WATER (a bare WATER throws where the layer is absent - GATE UISMOKE caught exactly that)');
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
  // THE CHINE SHEETS (G460.10): a parametric surface per chine off the spray-root stations, the droplets off its edge
  verdict(typeof SP.makeSheets === 'function' && /#include <logdepthbuf_vertex>/.test(SP.GLSL.sheetVert) && /#include <logdepthbuf_fragment>/.test(SP.GLSL.sheetFrag) && /#include <tonemapping_fragment>/.test(SP.GLSL.sheetFrag), 'spray.js makes the chine sheets (log-depth + tone-mapping chunks)');
  verdict(/SPRAY\.makeSheets\(THREE, nF \* 2, 8, 6\)/.test(app) && /F\._chineSta/.test(app) && /SH\.set\(si, roots, \[ox, 0, oz\], \[0, 1, 0\], uo, uu, strength\)/.test(app) && /D\.sheets\.commit\(waterFx\.t\)/.test(app), 'app.js builds two sheets per float off the wet chine stations and commits them each frame');
  verdict(/uu - 9\.81 \* t \+ 0\.3 \* Math\.random\(\)/.test(app), "the droplets peel off the sheet's far edge with its velocity");
  // THE FLOAT TRUSS REACHES THE GAME (G460.10, the user: "the cessna does not draw its float support structure")
  const join = src('tools/_cage_join.js');
  verdict(/pt\.kind === 'floatStrut';\s*\/\/ G460\.10/.test(join), "the join lists floatStrut among the truss kinds (its members exported for app.js's two-end follow)");
}

console.log('\nGATE WATER: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
