// ============================================================
// GATE CLOUD — the cloud field (CLOUDS C1, 2026-09-15)
//   src/core/08_cloud_field.js  (the weather map, the profiles, the layer, the column)
//   src/viewer/clouds.js        (the march: static rules - the GPU half is the CDP proof)
//
// What is held:
//   1. THE COVER IS THE COVER: the map's covered fraction equals the day's cloudCover
//      within 5 % for every type over 0.1..0.9 (the threshold is a quantile, so this is
//      exact up to the texel count); 0 gives no cloud, 1 gives all cloud.
//   2. THE PROFILE: zero at the base and at the column's top, in [0, 1] everywhere, reaches
//      0.9 somewhere for every type at hs = 1, and a lower column (hs 0.5) is nowhere
//      taller than a full one.
//   3. THE LAYER: the day's base (clamped 120..5000 m) and the type's thickness; an
//      unknown type is cumulus; overrides are honoured.
//   4. THE COLUMN: monotone in coverage, zero where clear, tiling over the span.
//   5. DETERMINISM: the same (seed, cover, type) is the same map to the bit; a different
//      seed is a different map.
//   6. THE SPLICE RULES (static): clouds.js is a standalone program (no onBeforeCompile,
//      no chunk writes), GLSL3 for the sampler3D, tone-mapped by three's chunks in the
//      composite, takes ATMO's GLSL for the aerial perspective and the mist, never reads
//      Date; render_world no longer draws the billboard puffs; the GRAPHICS menu has the
//      `clouds` row in every preset; the resolve pass carries a depth texture and an overlay.
// Run: node tools/_cloud_check.js   (contract: one final `GATE CLOUD: ...`)
// ============================================================
const fs = require('fs'), path = require('path');
const F = require('../src/core/08_cloud_field.js');

let fails = 0, checks = 0;
const fail = m => { console.log('  FAIL ' + m); fails++; checks++; };
const ok = m => { console.log('  ok   ' + m); checks++; };
const yes = (c, m) => (c ? ok : fail)(m);
const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

console.log('1. the cover is the cover');
for (const type of F.TYPE_ORDER) {
  for (const cover of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const m = F.weatherMap({ seed: 11, cover, type });
    const cf = F.coverFraction(m);
    yes(Math.abs(cf - cover) < 0.05, `${type} cover ${cover}: covered fraction ${cf.toFixed(3)}`);
    let lo = 0, hi = 0; for (let k = 0; k < m.N * m.N; k++) { const c = m.data[k * 4]; if (c < 0 || c > 1) lo++; if (m.data[k * 4 + 1] < F.TYPES[type].hsMin - 1e-6 || m.data[k * 4 + 1] > 1 + 1e-6) hi++; }
    yes(lo === 0 && hi === 0, `${type} cover ${cover}: coverage in [0,1], height in [${F.TYPES[type].hsMin},1]`);
  }
}
yes(F.coverFraction(F.weatherMap({ seed: 11, cover: 0, type: 'cu' })) === 0, 'cover 0: no cloud anywhere');
yes(F.coverFraction(F.weatherMap({ seed: 11, cover: 1, type: 'cu' })) === 1, 'cover 1: cloud everywhere');
{ // the mean coverage rises with the cover
  let last = -1, mono = true;
  for (const cover of [0.1, 0.3, 0.5, 0.7, 0.9]) { const m = F.weatherMap({ seed: 5, cover, type: 'sc' }); let s = 0; for (let k = 0; k < m.N * m.N; k++) s += m.data[k * 4]; s /= m.N * m.N; if (s <= last) mono = false; last = s; }
  yes(mono, 'the mean coverage rises with the cover');
}

console.log('2. the profile');
for (const type of F.TYPE_ORDER) {
  let bad = 0, peak = 0, taller = 0;
  for (let i = 0; i <= 200; i++) {
    const h = i / 200, p = F.profile(type, h, 1), q = F.profile(type, h, 0.5);
    if (p < 0 || p > 1 || q < 0 || q > 1) bad++;
    if (p > peak) peak = p;
    if (q > p + 1e-9) taller++;
  }
  yes(bad === 0 && F.profile(type, 0, 1) === 0 && F.profile(type, 1, 1) === 0 && F.profile(type, 0.5, 0.5) === 0, `${type}: the profile is 0 at the base and the top, in [0,1] between`);
  yes(peak >= 0.9, `${type}: the profile fills the column somewhere (peak ${peak.toFixed(2)})`);
  yes(taller === 0, `${type}: a half-height column is nowhere fuller than a full one`);
  yes(F.FILL[type] > 0.4 && F.FILL[type] < 0.95, `${type}: the mean fill is a sane constant (${F.FILL[type].toFixed(3)})`);
}
yes(F.TYPES.st.thick < F.TYPES.sc.thick && F.TYPES.sc.thick < F.TYPES.cu.thick && F.TYPES.cu.thick < F.TYPES.cb.thick, 'the types thicken st < sc < cu < cb');

console.log('3. the layer');
{
  const L = F.layer({ cloudType: 'cu', cloudBase: 1250 });
  yes(L.base === 1250 && L.thick === F.TYPES.cu.thick && L.top === 1250 + F.TYPES.cu.thick && L.type === 'cu', 'the day\'s base, the type\'s thickness');
  yes(F.layer({ cloudType: 'st', cloudBase: 10 }).base === 120 && F.layer({ cloudType: 'st', cloudBase: 9000 }).base === 5000, 'the base is clamped to 120..5000 m');
  yes(F.layer({ cloudType: 'zz', cloudBase: 800 }).type === 'cu' && F.layer(null).type === 'cu', 'an unknown type (or no day) is cumulus');
  const O = F.layer({ cloudType: 'cu', cloudBase: 800 }, { base: 300, thick: 500 });
  yes(O.base === 300 && O.thick === 500 && O.top === 800, 'the overrides are honoured');
}

console.log('4. the column');
{
  const lay = F.layer({ cloudType: 'cu', cloudBase: 800 });
  let last = -1, mono = true;
  for (const cover of [0.2, 0.4, 0.6, 0.8, 1]) {
    const m = F.weatherMap({ seed: 3, cover, type: 'cu' });
    let s = 0; for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) s += F.columnOD(m, i * 625, j * 625, lay);
    if (s <= last) mono = false; last = s;
  }
  yes(mono, 'the summed column optical depth rises with the cover');
  const m0 = F.weatherMap({ seed: 3, cover: 0, type: 'cu' });
  yes(F.columnOD(m0, 1234, 5678, lay) === 0, 'a clear map has no column');
  const m = F.weatherMap({ seed: 3, cover: 0.5, type: 'cu' });
  const a = F.sample(m, 1234.5, 5678.5), b = F.sample(m, 1234.5 + F.SPAN, 5678.5 - 2 * F.SPAN);
  yes(Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6, 'the map tiles over the span');
  const c = F.sample(m, 1234.5, 5678.5, [F.SPAN, 0]);
  yes(Math.abs(a[0] - c[0]) < 1e-6, 'a drift of one span is the same map');
  const full = F.weatherMap({ seed: 3, cover: 1, type: 'cu' });
  const od = F.columnOD(full, 0, 0, lay);
  yes(od > 0.5 * F.FILL.cu * lay.thick * F.SIGMA && od <= F.FILL.cu * lay.thick * F.SIGMA + 1e-9, `a full column's optical depth is the profile's fill x the height x sigma (${od.toFixed(1)})`);
}

console.log('5. determinism');
{
  const a = F.weatherMap({ seed: 21, cover: 0.4, type: 'sc' }), b = F.weatherMap({ seed: 21, cover: 0.4, type: 'sc' }), c = F.weatherMap({ seed: 22, cover: 0.4, type: 'sc' });
  let same = true, diff = 0;
  for (let k = 0; k < a.data.length; k++) { if (a.data[k] !== b.data[k]) same = false; if (a.data[k] !== c.data[k]) diff++; }
  yes(same, 'the same seed, cover and type is the same map to the bit');
  yes(diff > a.data.length / 4, 'a different seed is a different map');
}

console.log('6. the splice rules');
{
  const cj = src('viewer/clouds.js'), rw = src('viewer/render_world.js'), gfx = src('viewer/gfx_settings.js'), aa = src('viewer/aa_resolve.js'), core = src('core/08_cloud_field.js');
  yes(!/onBeforeCompile/.test(cj) && !/ShaderChunk\.\w+\s*=/.test(cj), 'clouds.js is a standalone program: no hook, no chunk write');
  yes(/glslVersion: THREE\.GLSL3/.test(cj) && /sampler3D/.test(cj), 'the march is GLSL3 (a sampler3D needs it)');
  yes(/#include <tonemapping_fragment>/.test(cj) && /#include <colorspace_fragment>/.test(cj), 'the composite is tone-mapped and encoded by three\'s own chunks (the target is display-space)');
  yes(/ATMO\.GLSL\.AP/.test(cj) && /ATMO\.GLSL\.MIST/.test(cj) && /ATMO\.apUniforms/.test(cj), 'the march takes the aerial perspective and the mist from ATMO (one splice, shared)');
  yes(/apSample\(d, tm \* 0\.001\)/.test(cj) && /mistApply\(/.test(cj), 'and applies them at the cloud\'s own mean distance');
  yes(!/new Date|Date\.now/.test(cj) && !/new Date|Date\.now/.test(core), 'no wall clock: the drift is the day\'s seconds');
  yes(/CLOUD_FIELD\.weatherMap\(/.test(cj) && /CLOUD_FIELD\.layer\(/.test(cj), 'the pass samples the core\'s map and layer (one field)');
  yes(/smoothstep\(0\.0, uProfile\.x, h\) \* \(1\.0 - smoothstep\(uProfile\.y \* hs, hs, h\)\)/.test(cj), 'the GLSL profile is the core\'s profile, verbatim');
  yes(!/PointsMaterial\(\{ map: tex, size: 340/.test(rw) && /CLOUDS\.update\(day, camera, world\)/.test(rw), 'render_world retired the billboard puffs and hands the day to the clouds');
  yes(/k: 'clouds'/.test(gfx) && ['low', 'medium', 'high', 'ultra'].every(p => new RegExp(p + ':\\s*\\{[^}]*clouds: \'(off|half|full)\'').test(gfx)), 'the GRAPHICS menu has the clouds row in every preset');
  yes(/depthTexture: S\.needRT/.test(aa) && /S\.overlay\(renderer, camera, S\.rt\)/.test(aa) && /needRT, setOverlay/.test(aa), 'the resolve pass carries the depth texture and the overlay hook');
  const build = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  yes(/'08_cloud_field\.js'/.test(build) && /'clouds\.js'/.test(build), 'both files are in the build');
}

console.log(`${checks} checks, ${fails} failed`);
console.log(`GATE CLOUD: ${fails ? 'FAIL (' + fails + ' of ' + checks + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
