// GATE ATMO — the atmosphere's model, headless (SKY S3, 2026-09-14).
//
//   src/viewer/atmo.js (the JS half of Hillaire 2020)  vs  tools/atmo_ref.json (numpy, atmo_lut.py)
//   src/viewer/sky_light.js  the calibration: the alps row comes out of the model unchanged
//   src/viewer/light_rig.js  the exposure schedule: monotone, through its anchors
//
// 1. the transmittance table against numpy at 13 cells and 8 sun elevations (2 %)
// 2. single scatter along 16 rays against numpy with the multi-scatter term off (3 %)
// 3. physical sanity: zenith bluer than red, a 2 deg sun path red/blue > 3,
//    the horizon brighter than the zenith at noon, the sky irradiance a tenth
//    of the sun's and falling 9 stops by civil dusk, everything finite
// 4. the calibration products (sun x exposure) at 33.4 and 10.6 deg
// 5. the sources: the dome is tone-mapped with the scene; the passes are
//    standalone programs; no chunk splice yet (that is S4's, one, in atmo.js)
//
// Run: node tools/_atmo_check.js   (contract: one final `GATE ATMO: ...`)
const fs = require('fs'), path = require('path');
global.LIGHT_RIG = require('../src/viewer/light_rig.js');
const ATMO = global.ATMO = require('../src/viewer/atmo.js');       // the bundle's globals, as the page has them
const SKY_LIGHT = require('../src/viewer/sky_light.js');
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'atmo_ref.json'), 'utf8'));

let fails = 0, checks = 0;
const fail = m => { console.log('  FAIL ' + m); fails++; checks++; };
const ok = m => { console.log('  ok   ' + m); checks++; };
const yes = (c, m) => (c ? ok : fail)(m);
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const D2R = Math.PI / 180;
const f3 = a => a.map(x => (x < 0.01 ? x.toExponential(2) : x.toFixed(4))).join(' ');

console.log('1. transmittance against numpy');
ATMO.bakeT();
for (const c of REF.T_uv) {
  const [r, mu] = ATMO.tFromUV((c.i + 0.5) / 256, (c.j + 0.5) / 64);
  const T = ATMO.transmittance(r, mu, 40);
  const e = Math.max(rel(T[0], c.T[0]), rel(T[1], c.T[1]), rel(T[2], c.T[2]));
  yes(e < 0.02 && Math.abs(r - c.r) < 1e-6 && Math.abs(mu - c.mu) < 1e-9, `cell (${c.i},${c.j}) r ${r.toFixed(3)} mu ${mu.toFixed(4)}: ${f3(T)} vs ${f3(c.T)} (${(e * 100).toFixed(3)} %)`);
}
for (const c of REF.T_el) {
  const T = ATMO.sunTransmittance(0.01, Math.sin(c.el * D2R), [0, 0, 0]);
  const e = Math.max(rel(T[0], c.T[0]), rel(T[1], c.T[1]), rel(T[2], c.T[2]));
  yes(e < (c.el <= 0.5 ? 0.05 : 0.02), `sun at ${c.el} deg: ${f3(T)} vs numpy ${f3(c.T)} (${(e * 100).toFixed(2)} %, through the LUT${c.el <= 0.5 ? ', 5 % on the horizon row' : ''})`);
}

console.log('2. single scatter along rays (multi-scatter off)');
ATMO.P.msK = 0; ATMO.bakeMS();
{
  let worst = 0;
  for (const c of REF.S1) {
    const sun = [0, Math.sin(c.sunEl * D2R), Math.cos(c.sunEl * D2R)];
    const L = ATMO.skyRadiance(6360.01, c.d, sun, 1, 32, [0, 0, 0]);
    const e = Math.max(rel(L[0], c.L[0]), rel(L[1], c.L[1]), rel(L[2], c.L[2]));
    worst = Math.max(worst, e);
    if (e >= 0.03) fail(`sun ${c.sunEl} d ${c.d}: ${f3(L)} vs ${f3(c.L)} (${(e * 100).toFixed(2)} %)`);
  }
  yes(worst < 0.03, `${REF.S1.length} rays within 3 % of numpy (worst ${(worst * 100).toFixed(3)} %)`);
}
ATMO.P.msK = 1; ATMO.bakeMS();

console.log('3. physical sanity');
{
  const noon = [0, Math.sin(58.4 * D2R), Math.cos(58.4 * D2R)];
  const Tz = ATMO.sunTransmittance(0.01, 1, [0, 0, 0]);
  yes(Tz[0] > Tz[1] && Tz[1] > Tz[2] && Tz[0] > 0.9 && Tz[2] > 0.7, 'zenith transmittance is red > green > blue and high: ' + f3(Tz));
  const T2 = ATMO.sunTransmittance(0.01, Math.sin(2 * D2R), [0, 0, 0]);
  yes(T2[0] / T2[2] > 3 && T2[0] < 0.5, 'a 2 deg sun path is red (R/B ' + (T2[0] / T2[2]).toFixed(1) + ')');
  const Lz = ATMO.skyRadiance(6360.01, [0, 1, 0], noon, 1, 32, [0, 0, 0]);
  const Lh = ATMO.skyRadiance(6360.01, [1, 0.035, 0], noon, 1, 32, [0, 0, 0]);
  yes(Lz[2] > 2 * Lz[0], 'the noon zenith is blue: ' + f3(Lz));
  yes(lum(Lh) > lum(Lz) && Lh[0] / Lh[2] > Lz[0] / Lz[2], 'the noon horizon is brighter and whiter than the zenith: ' + f3(Lh));
  const E = ATMO.skyIrradiance(0.01, noon);
  const Tn = ATMO.sunTransmittance(0.01, noon[1], [0, 0, 0]);
  const ratio = lum(E) / (lum(Tn) * noon[1]);
  yes(ratio > 0.04 && ratio < 0.25, 'the sky irradiance at noon is a tenth-ish of the sun on the ground: ' + (ratio * 100).toFixed(1) + ' %');
  const Ed = ATMO.skyIrradiance(0.01, [0, Math.sin(-6 * D2R), Math.cos(-6 * D2R)]);
  const stops = Math.log2(lum(E) / lum(Ed));
  yes(stops > 7 && stops < 12, 'civil dusk is ' + stops.toFixed(1) + ' stops under noon (7..12)');
  const En = ATMO.skyIrradiance(0.01, [0, Math.sin(-18 * D2R), Math.cos(-18 * D2R)]);
  yes(lum(En) < 1e-6, 'astronomical night is dark: ' + lum(En).toExponential(2));
  const ms = ATMO.MS(6360.01, 0.5, [0, 0, 0]);
  yes(ms[2] > ms[0] && ms[0] > 0 && ms[2] < 0.2, 'multi-scatter is blue and bounded: ' + f3(ms));
  const lut = ATMO.lut();
  let finite = true; for (let i = 0; i < lut.T.length; i++) if (!isFinite(lut.T[i])) { finite = false; break; }
  for (let i = 0; i < lut.MS.length; i++) if (!isFinite(lut.MS[i])) { finite = false; break; }
  yes(finite, 'every LUT texel is finite');
  // the day's dials reach the model
  ATMO.setDay({ turbidity: 10, ozone: 300, groundAlbedo: 0.15, version: 1 }); ATMO.bakeT();
  const Thaze = ATMO.sunTransmittance(0.01, Math.sin(10.6 * D2R), [0, 0, 0]);
  ATMO.setDay({ turbidity: 2.5, ozone: 300, groundAlbedo: 0.15, version: 2 }); ATMO.bakeT();
  const Tclear = ATMO.sunTransmittance(0.01, Math.sin(10.6 * D2R), [0, 0, 0]);
  yes(lum(Thaze) < 0.6 * lum(Tclear), 'turbidity 10 dims a low sun against 2.5: ' + lum(Thaze).toFixed(3) + ' vs ' + lum(Tclear).toFixed(3));
}

console.log('4. the calibration');
{
  ATMO.bakeMS();
  yes(SKY_LIGHT.calibrate(), 'sky_light calibrates');
  const K = SKY_LIGHT.K();
  const maxc = c => Math.max(c[0], c[1], c[2]);
  const T33 = ATMO.sunTransmittance(0, Math.sin(33.4 * D2R), [0, 0, 0]);
  const p33 = K.K_SUN * maxc(T33) * LIGHT_RIG.exposureFor(33.4);
  yes(rel(p33, 2.8 * 0.92) < 0.01, `alps 33.4 deg: sun x exposure = ${p33.toFixed(3)} vs the row's 2.8 x 0.92 = ${(2.8 * 0.92).toFixed(3)}`);
  const T106 = ATMO.sunTransmittance(0, Math.sin(10.6 * D2R), [0, 0, 0]);
  const p106 = K.K_SUN * maxc(T106) * LIGHT_RIG.exposureFor(10.6);
  yes(rel(p106, 2.75 * 1.12) < 0.12, `sunset 10.6 deg: sun x exposure = ${p106.toFixed(3)} vs the row's 2.75 x 1.12 = ${(2.75 * 1.12).toFixed(3)} (12 %)`);
  const n = T106.map(x => x / maxc(T106));
  yes(n[1] > 0.55 && n[1] < 0.8 && n[2] > 0.2 && n[2] < 0.5, 'the 10.6 deg key is the sunset row\'s orange: ' + f3(n) + ' (ffa652 = 1 0.65 0.32)');
  const E33 = ATMO.skyIrradiance(0, [0, Math.sin(33.4 * D2R), Math.cos(33.4 * D2R)]);
  yes(rel(K.K_HEMI * lum(E33), 0.274) < 0.01, 'the alps hemisphere 0.274 is reproduced');
  let mono = true, prev = Infinity;
  for (let el = -90; el <= 90; el += 0.5) { const s = LIGHT_RIG.exposureStops(el); if (s > prev + 1e-9) mono = false; prev = s; }
  yes(mono && LIGHT_RIG.exposureStops(33) === 0 && LIGHT_RIG.exposureStops(90) === 0, 'the exposure schedule is monotone in elevation and 0 stops at 33 deg and above');
  yes(LIGHT_RIG.exposureStops(-18) >= 12 && LIGHT_RIG.exposureStops(-18) <= 16, 'astronomical night opens 12..16 stops: ' + LIGHT_RIG.exposureStops(-18));
}

console.log('5. the sources');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'atmo.js'), 'utf8');
  yes(/#include <tonemapping_fragment>/.test(src) && /#include <colorspace_fragment>/.test(src), 'the dome is tone-mapped and encoded by three\'s own chunks');
  yes(!/ShaderChunk\.\w+\s*=/.test(src.replace(/\/\/[^\n]*/g, '')), 'no chunk is overridden yet (S4 installs the one aerial-perspective splice)');
  yes(!/onBeforeCompile/.test(src), 'no onBeforeCompile hook in the atmosphere: standalone programs only');
  const rw = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'render_world.js'), 'utf8');
  yes(/ATMO\.init\(renderer\)/.test(rw) && /SKY_LIGHT\.applyDay\(/.test(rw), 'render_world takes the atmosphere and applies the day through sky_light');
  const sl = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'sky_light.js'), 'utf8');
  yes(/LIGHT_RIG\.exposureFor/.test(sl) && /GFX\.setExposure/.test(sl), 'the exposure goes through light_rig\'s schedule and GFX.setExposure (a base, never read back)');
  yes(!/toneMappingExposure\s*=\s*.*\*/.test(sl), 'sky_light never compounds an exposure');
}

console.log(`${checks} checks, ${fails} failed`);
console.log(`GATE ATMO: ${fails ? 'FAIL (' + fails + ' of ' + checks + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
