// ============================================================
// GATE RAIN - the rain field (RAIN step 1, LOOK-1, 16 Nov 2026; the user: "a proper, very optimized job", never "a
// couple of particles"; flydiy-notes/studies/RAIN-STUDY-2026-11-16.md section 3.0)
//   src/core/08_cloud_field.js  (the weather map's A channel = the rain potential; rainAt)
//
// What is held:
//   1. A DRY DAY IS DRY: rain 0 (or missing) gives 0 at every point, sampling nothing; the map has no rain input, so its
//      bytes are the same whatever the day's rain (the march, the shadow and every reader of R/G/B see the same map).
//   2. WHO RAINS: fair-weather cumulus and altocumulus never; the stratiform decks (st, sc, as) under their whole sheet,
//      k x coverage exactly; the convective decks (cu, cb) only in the dense, tall columns (none where coverage x
//      height is low, full where it is high), a cumulonimbus readier than a cumulus.
//   3. IN [0, 1], DETERMINISTIC: the A channel never leaves [0, 1]; the same (seed, cover, type) gives the same A to the bit.
//   4. THE RATE SCALES WITH THE DAY: rainAt's mean over the map is d.rain x the mean potential (linear, 0.25 / 0.5 / 1).
//   6. THE DRAWN DECKS RAIN (clouds.js, static): CLOUDS.rainAt reads the same fitted maps and drifts as the march, returns
//      0 before sampling on a dry day, falls back to the day's rain with the cloud pass off; CLOUDS.rain is the eye's.
//   5. THE SHAFTS SLANT: below the base rainAt reads the map UP-WIND by wind x (base - h) / vFall; at the base no shift;
//      no wind no shift; above the deck's top 0.
//   7. THE STREAKS ROUND THE EYE (src/viewer/rain.js, app.js): the boxes' offsets wrapped at any clock, the counts per tier
//      and rain, the cockpit's density, no texture / sampler (MATLIB, GLSL3), the cabin and roof cuts, MADE LAZILY (a dry
//      day and ?rain=0 never make the program). The shader compiles on the page only: by hand, in a GPU slot.
//   8. THE WORLD EDITOR: the "rain" block carries every numeric LOOK key, kept in THE LOOK, applied, diffed, mounted.
//   9. THE SHAFTS AND THE VEIL (clouds.js march, static): a dry day (uRain.x 0), ?rain=0, the tier off, the dome and the sky
//      fit leave the march what it was; the shafts read only the weather map; the extinction is 07d's law; they slant
//      as rainAt does; 4 steps on the lean tier; their four dials in the world editor.
// Run: node tools/_rain_check.js   (contract: one final `GATE RAIN: ...`)
// ============================================================
'use strict';
const F = require('../src/core/08_cloud_field.js');
let fails = 0, checks = 0;
const ok = (c, what, detail) => { checks++; if (!c) fails++; console.log((c ? '  ok    ' : '  FAIL  ') + what + (detail != null ? '  (' + detail + ')' : '')); };
const N = 96;
const mapOf = (type, cover, seed) => F.weatherMap({ seed: seed || 11, cover, type, N });
const lay = (type, base) => ({ type, base: base || 1000, thick: F.TYPES[type].thick, top: (base || 1000) + F.TYPES[type].thick });
const at = (m, i, j) => [(i + 0.5) / N * m.span, (j + 0.5) / N * m.span];   // a texel centre: sample() reads it exactly

// 1 A DRY DAY IS DRY
{ let worst = 0;
  for (const t of F.TYPE_ORDER) { const m = mapOf(t, 0.7), L = lay(t);
    for (let k = 0; k < 400; k++) { const x = (k * 9973) % m.span, z = (k * 7919) % m.span;
      for (const o of [{ rain: 0 }, {}, null, { rain: -1 }, { rain: NaN }]) worst = Math.max(worst, F.rainAt(m, L, x, z, 300, o)); } }
  ok(worst === 0, '1a rain 0, missing, negative or NaN: 0 everywhere, every type', 'worst ' + worst);
  const a = mapOf('cb', 0.5), b = mapOf('cb', 0.5); let same = a.data.length === b.data.length;
  for (let k = 0; k < a.data.length && same; k++) if (a.data[k] !== b.data[k]) same = false;
  ok(same && F.weatherMap.length <= 1, '1b the map takes no rain: its bytes are a function of (seed, cover, type) alone'); }

// 2 WHO RAINS
{ for (const t of ['cuh', 'ac']) { const m = mapOf(t, 0.8); let mx = 0; for (let k = 0; k < N * N; k++) mx = Math.max(mx, m.data[k * 4 + 3]); ok(mx === 0, '2a ' + t + ' (' + F.TYPES[t].label + ') never rains', 'max A ' + mx); }
  for (const t of ['st', 'sc', 'as']) { const m = mapOf(t, 0.6), K = F.RAIN_OF[t].k; let err = 0, wet = 0;
    for (let k = 0; k < N * N; k++) { err = Math.max(err, Math.abs(m.data[k * 4 + 3] - K * m.data[k * 4])); if (m.data[k * 4 + 3] > 0) wet++; }
    ok(err < 1e-6 && wet > N * N * 0.5, '2b ' + t + ' rains under its whole sheet: A = ' + K + ' x coverage', 'err ' + err.toExponential(1) + ', ' + Math.round(100 * wet / N / N) + ' % of the map wet'); }
  for (const t of ['cu', 'cb']) { const m = mapOf(t, 0.6), R = F.RAIN_OF[t]; let low = 0, high = 0, nh = 0;
    for (let k = 0; k < N * N; k++) { const ch = m.data[k * 4] * m.data[k * 4 + 1], A = m.data[k * 4 + 3];
      if (ch <= R.lo) low = Math.max(low, A); if (ch >= R.hi) { nh++; high = Math.max(high, 1 - A); } }
    ok(low === 0 && high < 1e-6 && nh > 0, '2c ' + t + ' rains only in the dense, tall columns: none at coverage x height <= ' + R.lo + ', full at >= ' + R.hi, nh + ' full texels'); }
  const fr = t => { const m = mapOf(t, 0.5); let n = 0; for (let k = 0; k < N * N; k++) if (m.data[k * 4 + 3] > 0) n++; return n / N / N; };
  ok(fr('cb') > fr('cu'), '2d a cumulonimbus rains over more of the map than a cumulus at the same cover', (100 * fr('cb')).toFixed(0) + ' % vs ' + (100 * fr('cu')).toFixed(0) + ' %'); }

// 3 IN [0, 1], DETERMINISTIC
{ let out = 0; for (const t of F.TYPE_ORDER) for (const c of [0, 0.3, 1]) { const m = mapOf(t, c); for (let k = 0; k < N * N; k++) { const A = m.data[k * 4 + 3]; if (!(A >= 0 && A <= 1)) out++; } }
  ok(out === 0, '3a the A channel stays in [0, 1] for every type, cover 0 / 0.3 / 1', out + ' outside');
  const z = mapOf('sc', 0); let any = 0; for (let k = 0; k < N * N; k++) any += z.data[k * 4 + 3];
  ok(any === 0, '3b no cloud, no rain (cover 0)'); }

// 4 THE RATE SCALES WITH THE DAY
{ const m = mapOf('sc', 0.6), L = lay('sc'); let pot = 0; for (let k = 0; k < N * N; k++) pot += m.data[k * 4 + 3]; pot /= N * N;
  const mean = r => { let s = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const p = at(m, i, j); s += F.rainAt(m, L, p[0], p[1], 500, { rain: r }); } return s / N / N; };
  const r = [0.25, 0.5, 1].map(mean);
  ok(Math.abs(r[0] - 0.25 * pot) < 1e-6 && Math.abs(r[1] - 0.5 * pot) < 1e-6 && Math.abs(r[2] - pot) < 1e-6, '4 the mean rate is d.rain x the mean potential (rain 0.25 / 0.5 / 1)', r.map(v => v.toFixed(4)).join(' / ') + ' of ' + pot.toFixed(4)); }

// 5 THE SHAFTS SLANT
{ const m = mapOf('cb', 0.6), L = lay('cb', 1200), wind = [8, -3], v = F.VFALL;
  let i = 0, j = 0; for (let k = 0; k < N * N; k++) if (m.data[k * 4 + 3] > 0.5) { i = k % N; j = (k / N) | 0; break; }
  const P = at(m, i, j), h = 400, t = (L.base - h) / v, Q = [P[0] + wind[0] * t, P[1] + wind[1] * t];   // the point whose rain left the base above P
  const a = F.rainAt(m, L, Q[0], Q[1], h, { rain: 1, wind }), b = F.sample(m, P[0], P[1])[3];
  ok(Math.abs(a - b) < 1e-6, '5a below the base the rain is read up-wind by wind x (base - h) / vFall', 'at ' + h + ' m: ' + a.toFixed(4) + ' = the base column ' + b.toFixed(4) + ', ' + (Math.hypot(wind[0], wind[1]) * t).toFixed(0) + ' m of slant');
  ok(Math.abs(F.rainAt(m, L, P[0], P[1], L.base, { rain: 1, wind }) - b) < 1e-6 && Math.abs(F.rainAt(m, L, P[0], P[1], 0, { rain: 1 }) - b) < 1e-6, '5b at the base, or with no wind: no shift');
  ok(F.rainAt(m, L, P[0], P[1], L.top + 1, { rain: 1, wind }) === 0 && F.rainAt(m, L, P[0], P[1], (L.base + L.top) / 2, { rain: 1 }) === b, '5c above the deck none; inside it the potential');
  const D = [1234, -567]; ok(Math.abs(F.rainAt(m, L, P[0] - D[0], P[1] - D[1], 900, { rain: 1, drift: D }) - b) < 1e-6, "5d the deck's drift moves the rain with the cloud"); }

// 6 THE DRAWN DECKS RAIN (static; plain text searches, no regex escapes)
{ const fsx = require('fs'), px = require('path'), C = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'clouds.js'), 'utf8');
  const head = 'function rainAt(x, z, h) {', a = C.indexOf(head), fn = a < 0 ? '' : C.slice(a, C.indexOf('return best;', a) + 12);
  const dry = fn.indexOf('if (!r) return 0;'), read = fn.indexOf('CLOUD_FIELD.rainAt(maps[i], l, x, z, h, { rain: r, drift: drifts[i], wind: _rw })');
  ok(dry > 0 && read > dry, '6a CLOUDS.rainAt: a dry day returns 0 before any map is read');
  const off = fn.indexOf("S.mode === 'off'");
  ok(read > 0 && off > 0 && fn.indexOf('return r;', off) > off && fn.indexOf('return r;', off) < read, "6b it reads the drawn decks (the fitted maps, their drifts); the cloud pass off: the day's rain, uniform");
  ok(C.indexOf('rainEye = rainAt(camera.position.x, camera.position.z, camera.position.y)') > 0 && C.indexOf('get rain() { return rainEye; }') > 0 && C.indexOf('S, init, rainAt,') > 0,
     "6c CLOUDS.rain is the eye's local rain, updated each frame; CLOUDS.rainAt is public"); }

// 7 THE STREAKS ROUND THE EYE (src/viewer/rain.js + app.js syncRainFx; the shader itself is compiled on the page, by hand in a GPU slot)
{ const fsx = require('fs'), px = require('path'), RF = require('../src/viewer/rain.js');
  const SRC = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'rain.js'), 'utf8'), APP = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'app.js'), 'utf8');
  // 7a the offsets: wrapped into [0, L) per box at any clock and any eye (a day's seconds x the fall is far past a float)
  let bad = 0; const o = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [[11], [27], [61]];
  for (const t of [0, 1.5, 86400 * 3.7, 1e7]) for (const cam of [[0, 0, 0], [-15432.7, 812.2, 20311.1]]) {
    RF.offsets(t, cam, [7.5, -3], RF.LOOK.vFall, B, o);
    for (let b = 0; b < 3; b++) for (let i = 0; i < 3; i++) if (!(o[b][i] >= 0 && o[b][i] < B[b][0])) bad++; }
  // the fall moves the field DOWN: one second later the y offset is vFall lower (mod L)
  RF.offsets(100, [0, 0, 0], [0, 0], 6.5, B, o); const y0 = o[0][1]; RF.offsets(101, [0, 0, 0], [0, 0], 6.5, B, o);
  const dy = ((y0 - o[0][1]) % 11 + 11) % 11;
  ok(bad === 0 && Math.abs(dy - 6.5) < 1e-6, '7a the boxes\' offsets stay in [0, L) at any clock and eye; the field falls vFall a second', bad + ' out, ' + dy.toFixed(3) + ' m/s');
  // 7b the counts: a dry eye draws none; the full tier at full rain 18 000 in three boxes, lean 4 000 in two; half rain half
  const f1 = RF.ranges('full', 1), l1 = RF.ranges('lean', 1), f5 = RF.ranges('full', 0.5), z = RF.ranges('full', 0), off = RF.ranges('off', 1);
  const drawn = r => r.R.reduce((a, x) => a + x[2], 0);
  ok(drawn(f1) === 18000 && f1.R.filter(x => x[2] > 0).length === 3 && drawn(l1) === 4000 && l1.R.filter(x => x[2] > 0).length === 2 && drawn(f5) === 9000 && z.count === 0 && off.count === 0,
     '7b the drops: full 18 000 / 3 boxes, lean 4 000 / 2, half rain half, a dry eye or the off tier none', [drawn(f1), drawn(l1), drawn(f5), z.count, off.count].join(' / '));
  ok(RF.density(0, {}) === 0 && RF.density(1, { cockpit: true, V: 80 }) === RF.LOOK.cockpitK && RF.density(1, { cockpit: true, V: 0 }) === 1 && RF.density(0.6, {}) === 0.6,
     '7c the density: the local rain; in the cockpit at speed down to cockpitK (the windscreen carries the rest), parked whole');
  // 7d the program: no texture, no sampler, MATLIB's shader only, GLSL3 (gl_InstanceID), the cabin and the roofs in the vertex shader
  const shader = RF.VERT + RF.FRAG;
  ok(!/sampler|texture/.test(shader) && !/new THREE\.[A-Za-z]*Material/.test(SRC) && SRC.indexOf("MATLIB.make(THREE, 'shader', {") > 0 && SRC.indexOf('glslVersion: THREE.GLSL3') > 0 && RF.VERT.indexOf('gl_InstanceID') > 0,
     '7d the program: no texture, no sampler; made by MATLIB (GLSL3, the drops from gl_InstanceID)');
  ok(RF.VERT.indexOf('uCabinInv') > 0 && RF.VERT.indexOf('uRoofA[') > 0 && RF.VERT.indexOf('uLen.y') > 0 && RF.VERT.indexOf('uLen.z') > 0 && RF.VERT.indexOf('uPx.z') > 0,
     '7e each streak: cut in the cabin box and under a roof, clamped in the world and on screen, at least minPx wide');
  // 7g the depth convention and the output (the soft run, 16 Nov eve: the program did not link, then no streak drew): three's
  //    logdepthbuf chunks in both stages (the renderer is logarithmic where reversed-z is missing), its own GLSL3 output declared
  ok(['#include <logdepthbuf_pars_vertex>', '#include <logdepthbuf_vertex>'].every(t => RF.VERT.indexOf(t) >= 0) && ['#include <logdepthbuf_pars_fragment>', '#include <logdepthbuf_fragment>'].every(t => RF.FRAG.indexOf(t) >= 0)
     && RF.VERT.indexOf('#include <logdepthbuf_vertex>') > RF.VERT.indexOf('gl_Position = projectionMatrix * vec4(vp, 1.0);') && RF.VERT.indexOf('gl_Position = projectionMatrix * vec4(vp, 1.0);') > 0 && RF.FRAG.indexOf('out highp vec4 rainC') >= 0 && RF.FRAG.indexOf('#define gl_FragColor rainC') >= 0,
     '7g the streaks take the log-depth chunks (after the final gl_Position) and declare their GLSL3 output');
  ok(SRC.indexOf('side: THREE.DoubleSide,') > 0, '7h the streak quads are drawn DOUBLE-SIDED: their winding follows the streak on screen (a falling drop winds clockwise - FrontSide culled every one, 17 Nov)');
  // 7f LAZY: the page makes it only when the eye's rain is above 0 and the tier is not off; ?rain=0 never makes it
  const sy = APP.slice(APP.indexOf('function syncRainFx(dt) {'), APP.indexOf("window.RAIN_LIVE ="));
  const guard = sy.indexOf("if (!(R > 0) || tier === 'off'"), make = sy.indexOf('RAIN_FX.make(THREE)');
  ok(guard > 0 && make > guard && sy.indexOf("RAIN_Q === 0 ? 'off'") > 0 && APP.indexOf('if (!inGarage) syncRainFx(running ? fdt : 0);') > 0,
     '7f the program is made the first time it rains near the eye, never on a dry day or under ?rain=0; synced each frame out of the shed'); }

// 8 THE WORLD EDITOR (the user: every new world setting in F9): a "rain" block in air & map with every numeric LOOK key, kept in THE LOOK
{ const fsx = require('fs'), px = require('path'), RF = require('../src/viewer/rain.js'), WR = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'world_rail.js'), 'utf8');
  const a = WR.indexOf("const RAIN_KEYS = ["), keys = a < 0 ? [] : WR.slice(a + 19, WR.indexOf(']', a)).split(',').map(x => x.trim().replace(/'/g, ''));
  const num = Object.keys(RF.LOOK).filter(k => typeof RF.LOOK[k] === 'number');
  ok(num.every(k => keys.indexOf(k) >= 0) && keys.every(k => num.indexOf(k) >= 0), '8a the rain block carries every numeric LOOK key (' + num.length + ')', 'missing: ' + num.filter(k => keys.indexOf(k) < 0).join(',') + ' extra: ' + keys.filter(k => num.indexOf(k) < 0).join(','));
  ok(WR.indexOf("put('rain', deltaOf(N.rain, DEF.rain))") > 0 && WR.indexOf('if (W.RAIN_FX && o.rain) rainSet(o.rain);') > 0 && WR.indexOf("ch.push(...diff(DEF.rain, out.rain, 'rain'))") > 0 && WR.indexOf('    rainCard(body);') > 0,
     '8b it is saved in THE LOOK, applied on import / reset, listed in the changes, and mounted in air & map'); }

// 9 THE SHAFTS AND THE VEIL (clouds.js, static; the march compiles on the page): a dry day leaves the march what it was
{ const fsx = require('fs'), px = require('path'), C = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'clouds.js'), 'utf8');
  const P = fsx.readFileSync(px.join(__dirname, '..', 'src', 'core', '07d_weather_plan.js'), 'utf8');
  const seg = C.slice(C.indexOf('void rainSeg('), C.indexOf('vec4 march(vec3 o, vec3 d, float tScene, float jitterK) {'));
  const mar = C.slice(C.indexOf('vec4 march(vec3 o, vec3 d, float tScene, float jitterK) {'), C.indexOf('// the fullscreen march: the ray from the inverse projection'));
  ok(seg.length > 100 && mar.indexOf('if (uRain.x > 0.0 && gPix > 0.0) {') > 0 && mar.indexOf("if (n == 0 && !rainOn) return vec4(0.0);") > 0 && mar.split('rainSeg(').length === 3,
     '9a uRain.x 0 (a dry day, ?rain=0, the tier off) or the dome / the sky fit (gPix 0): no segment - the early return and the decks as before');
  ok(seg.indexOf('texture(') < 0 && seg.indexOf('weather(li, ps)') > 0 && seg.indexOf('textureLod') < 0, '9b the shafts read only the decks\' weather map (no new sampler, no noise)');
  ok(seg.indexOf('12.0 * pow(A * uRain.x, 1.5)') > 0 && seg.indexOf('0.00025 * pow(R, 0.63)') > 0 && P.indexOf('const R = 12 * CORE_MATH.pow(clamp(day.rain || 0, 0, 1), 1.5);') > 0 && P.indexOf('0.25 * CORE_MATH.pow(R, 0.63)') > 0,
     '9c the extinction is the game\'s own law (07d: R = 12 rain^1.5 mm/h, 0.25 R^0.63 per km)');
  ok(seg.indexOf('(uLayerA[li].x - p.y)') > 0 && seg.indexOf('uRainW.x') > 0 && C.indexOf('U.uRainW.value.set(winds[0][0] / 1.5 / vF, winds[0][1] / 1.5 / vF') > 0,
     '9d the shafts slant: read up-wind by the fall from each base, the wind at the base / vFall (the CPU rainAt\'s law)');
  ok(C.indexOf("const r = !q && tier !== 'off' && dayRef && +dayRef.rain > 0 ? Math.min(1, +dayRef.rain) : 0") > 0 && C.indexOf("tier === 'lean' ? Math.min(4, S.rainSteps) : S.rainSteps") > 0,
     '9e the uniform: the day\'s rain, 0 under ?rain=0 or the tier off; 4 steps on the lean tier');
  const WR = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'world_rail.js'), 'utf8');
  ok(['rainExt', 'rainLight', 'rainKm', 'rainSteps'].every(k => WR.indexOf("cs('" + k + "')") > 0 && WR.indexOf("'" + k + "'") > 0), '9f the shafts\' four dials are in the world editor\'s rain block and THE LOOK'); }

// 10 THE DROPS ON THE GLASS (RAIN step 2 prototype, aeroweather.js + aeroskin.js + app.js, static; the look is the user's call)
{ const fsx = require('fs'), px = require('path'), AW = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'aeroweather.js'), 'utf8'),
    AS = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'aeroskin.js'), 'utf8'), APP = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'app.js'), 'utf8');
  const b0 = AW.indexOf('    if (uRainG.x > 0.0) {'), blk = b0 < 0 ? '' : AW.slice(b0, AW.indexOf('roughnessFactor = mix(roughnessFactor, 0.02, aeroRainD);', b0));
  ok(b0 > 0 && blk.indexOf('texture') < 0 && AW.indexOf('uRainG: { value: new THREE.Vector4(0, 0, 0, 1) },') > 0, '10a the drops are cells in the glass program, gated by the wetness (0 = dry: skipped), no texture, no sampler');
  ok(blk.indexOf('vec3(0.0, 1.0, 0.0) * (rAir * 3.0) + uRainF.xyz * (1.0 - rAir)') > 0 && blk.indexOf('rF - rN * dot(rF, rN)') > 0, '10b the flow: the airflow (craft +y, aft) blended with gravity by airspeed, projected on the pane');
  ok(AS.indexOf('if (aeroRainD > 0.0) {') > 0 && APP.indexOf('glassRainFrame(dt, R, RAIN_Q === 0);') > 0 && APP.indexOf('AEROWX.aeroWxSetRain(THREE, glassWet, V, RAIN_ST.t, g);') > 0,
     '10c the glass shades them; the page sets the wetness (rises in rain, dries after), the airspeed and gravity each frame; ?rain=0 keeps the glass dry'); }

// 11 THE OVERCAST (17 Nov; the user: "the cloud coverage is not there"): a deck at cover >= 0.85 keeps a solid base and darkens under
//    its thickness; below 0.85 (every fair and broken sky) the factors are exactly 1 - the march is what it was
{ const fsx = require('fs'), px = require('path'), C = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'clouds.js'), 'utf8');
  ok(C.indexOf('float ovcOf(int li) { return smoothstep(0.85, 1.0, uDriftA[li].z) * uShape.z; }') > 0 && C.indexOf('DA[o + 2] = l.cover;') > 0 && C.indexOf('U.uShape.value.set(S.detail, S.curl, S.overcast, S.ovcRho);') > 0,
     '11a how overcast a deck is: 0 below cover 0.85, x the dial (S.overcast, 1); the deck\'s cover rides uDriftA.z');
  ok(C.indexOf('hf * uShape.x * (1.0 - 0.85 * ovcOf(li))') > 0 && C.indexOf('float tauA = uGlob.x * uShape.w * uLayerA[li].y * (1.0 - h);') > 0 && C.indexOf('/ (1.0 + 0.1125 * tauA)), ovG); }') > 0,
     '11b an overcast\'s base stays solid (the erosion fades) and it is lit by the light diffused down through the deck above (RAIN 13: 1 / (1 + 0.75 tau (1 - g)), g 0.85)');
  const WR = fsx.readFileSync(px.join(__dirname, '..', 'src', 'viewer', 'world_rail.js'), 'utf8');
  ok(WR.indexOf("cs('overcast')") > 0 && WR.indexOf("overcast: 'overcast'") > 0, '11c the dial is in the world editor\'s rain block and THE LOOK');
  { const tr = tau => 1 / (1 + 0.75 * tau * (1 - 0.85)), sg = 0.08, rho = 0.35;
    ok(C.indexOf('ambL = mix(ambL, vec3(ovcTop() / (1.0 + 0.1125 * tauA)), ovG); }') > 0 && C.indexOf('float ovcTop() { vec3 E = uSunCol * (max(uSun.y, 0.0) * 0.3183099) + uAmbTop;') > 0 && /ovcRho: 0\.35/.test(C) && Math.abs(tr(sg * rho * 300) - 0.513) < 0.01 && Math.abs(tr(sg * rho * 4000) - 0.0735) < 0.005,
       '11d the overcast\'s light is neutral and its law reads right: a 300 m stratus passes ' + tr(sg * rho * 300).toFixed(3) + ', a 4 km storm ' + tr(sg * rho * 4000).toFixed(3) + ' of the light on its top'); }
  ok(C.indexOf('c = c * ap.a + mix(ap.rgb, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))) * (1.0 - ap.a), ovA);') > 0 && C.indexOf('if (ovR > 0.0) Ls = mix(Ls, vec3(ovcTop() / (1.0 + 0.1125 * uGlob.x * uShape.w * thR)), ovR);') > 0,
     '11g under a full deck the air is lit by the deck: the haze before the cloud and the rain veil take its diffused neutral light, not the clear sky\'s blue (RAIN 13b)');
  ok(C.indexOf('if (n > 0) { ovA = ovcOf(ord[0]); if (ovA > 0.0) tm = mix(tm, s0[0], ovA); }') > C.indexOf('gTm = tm;') && C.indexOf('gTm = tm;') > 0 && C.indexOf('if (uAtmoAP.z > 0.5) { vec4 ap = apScaled(apSample(d, tm * 0.001));') > C.indexOf('if (ovA > 0.0) tm = mix(tm, s0[0], ovA); }'),
     '11e on a full deck the haze is taken at the deck\'s entry, not kilometres inside it (the opaque storm deck read blue, 18:05 shoot); a fair sky keeps the mean distance'); }

console.log('GATE RAIN: ' + (fails ? 'FAIL (' + fails + ' of ' + checks + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
