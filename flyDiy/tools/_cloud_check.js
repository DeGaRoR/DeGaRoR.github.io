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
//   6. THE SPLICE RULES (static): clouds.js has no hook of its own and exactly two chunk
//      writes (C2: the shadow in the two lights chunks), GLSL3 for the sampler3D, tone-mapped
//      by three's chunks in the composite (over the resolved frame, premultiplied), takes
//      ATMO's GLSL for the aerial perspective and the mist, reads the shadow tile from the AP
//      atlas (no new sampler), never reads Date; render_world no longer draws the billboard
//      puffs; the GRAPHICS menu has the `clouds` row in every preset; the resolve pass carries
//      a depth texture, an overlay and a post hook; the trees take the shadow.
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
  yes(!/onBeforeCompile/.test(cj), 'clouds.js has no hook of its own (the shadow rides ATMO.inject)');
  // C2: THE SHADOW SPLICE - exactly two chunk writes, both in install(): the declaration in lights_pars_begin,
  // the multiply in lights_fragment_begin; the tile is read from the aerial-perspective atlas (no new sampler:
  // the island's ground program stands at the 16-unit limit) through the scalars every fogged program carries
  const ccode = cj.replace(/\/\/[^\n]*/g, '');
  const cw = (ccode.match(/SC\.\w+\s*=/g) || []).map(x => x.replace(/\s*=.*/, ''));
  yes(cw.length === 2 && cw.includes('SC.lights_pars_begin') && cw.includes('SC.lights_fragment_begin'), 'the shadow is spliced into exactly the two lights chunks, in install(): ' + cw.join(' '));
  yes(/directLight\.color \*= cloudShadow\(\);/.test(cj) && /#ifdef CLOUD_SHADOW/.test(cj), 'the sun\'s colour is multiplied by the cloud transmittance under the CLOUD_SHADOW define');
  yes(/texture2D\(uApAtlas, \$\{TILE_UV\(\)\}\)/.test(cj) && !/uniform sampler2D uCloudT/.test(cj), 'the shadow tile is read from the aerial-perspective atlas - no sampler added to the world\'s programs');
  const at = src('viewer/atmo.js');
  yes(/AP_TILE = 512, AP_TILE_Y = AP_H \+ 2, AP_ATLAS_H = AP_TILE_Y \+ AP_TILE/.test(at) && /TILE: AP_TILE, TILE_Y: AP_TILE_Y, ATLAS_H: AP_ATLAS_H/.test(at), 'the atlas carries the tile above the AP rows and publishes its geometry');
  yes(/CLOUDS\.inject\(sh\)/.test(at) && /renderer\.setScissor\(0, 0, AP_N \* AP_W, AP_H\)/.test(at), 'ATMO.inject hands the shadow its scalars; the AP pass writes only its own rows');
  yes(/_C \*= cloudShadow\(\);/.test(src('viewer/trees.js')), 'the trees\' own leaf terms take the cloud shadow');
  yes(/setPre: f => \{ S\.pre = f \|\| null; \}/.test(aa) && /if \(S\.pre\) S\.pre\(renderer, camera, S\.rt\);/.test(aa), 'the resolve pass has the PRE hook (G436.7): the march runs before the scene, off the previous frame\'s depth');
  yes(/aa\.setPre\(\(r, cam, rt\) => \{ if \(!inGarage\) CLOUDS\.draw\(r, cam, rt\); \}\)/.test(src('viewer/app.js')) && /CLOUDS\.sunT\(camera\.position\.x/.test(src('viewer/app.js')), 'app.js marches before the scene and dims the flare by the column');
  yes(/gl_FragDepth = log2\(1\.0 \+ w\) \/ uLogFar;/.test(cj) && /depthTest: true, depthWrite: false, transparent: true, toneMapped: true/.test(cj) && /compMesh\.renderOrder = 1e6/.test(cj) && /scene\.add\(CLOUDS\.compositeMesh\(\)\)/.test(rw), 'the composite is a quad IN the world scene at the cloud\'s log depth, last, tested per MSAA sample (the 1-px line round the aeroplane)');
  yes(/s\.rgb \*= s\.a;/.test(cj) && /c\.rgb \/= max\(c\.a, 1e-4\);/.test(cj), 'the composite filters premultiplied (an empty texel must not darken its neighbour)');
  yes(/EXT_disjoint_timer_query_webgl2/.test(cj), 'the pass carries its own GPU timer');
  // C3: the probe and the shed see the layer (the dome march), the hemisphere rises under a cloud, the shed's key takes the column
  yes(/vec4 march\(vec3 o, vec3 d, float tScene, float jitterK\)/.test(cj) && /gl_FragColor = march\(o, d, tScene, uDials2\.x\);/.test(cj) && /vec4 m = march\(uEye, d, 1e9, 0\.0\);/.test(cj), 'one march text serves the fullscreen pass and the dome (the probe, the shed)');
  const rw3 = src('viewer/render_world.js');
  yes(/decorate: typeof CLOUDS !== 'undefined' && CLOUDS\.domeMesh \? es => \{ const m = CLOUDS\.domeMesh\(0, 20, 24\);/.test(rw3) && /dirty: typeof CLOUDS !== 'undefined' && CLOUDS\.probeDirty/.test(rw3), 'the world\'s probe bakes the layer and re-bakes as it drifts (the water reflects the clouds)');
  yes(/if \(o\.decorate\) o\.decorate\(es\);/.test(at) && /o\.dirty\(\)\) return probe\.bake\(day\);/.test(at), 'ATMO.makeProbe takes the decorator and the dirty test');
  yes(/hemiBoost: RIG\.hemi \/ 0\.274 \* \(typeof CLOUDS !== 'undefined' && CLOUDS\.hemiUnder \? CLOUDS\.hemiUnder\(cT\) : 1\)/.test(rw3) && /cloudT: cT/.test(rw3), 'the hemisphere rises under the cloud at the eye and whitens (sky_light cloudT)');
  yes(/if \(o\.keyGain != null && !isMoon\) I \*= o\.keyGain;/.test(src('viewer/sky_light.js')) && /keyGain: cloudT/.test(src('viewer/hangar.js')) && /CLOUDS\.domeMesh\(SHED_FRAME_YAW, 598, 24, \{ depthTest: true \}\)/.test(src('viewer/hangar.js')) && /depthTest: !!\(opts && opts\.depthTest\)/.test(cj), 'the shed sees the layer on its backdrop, depth-tested behind its walls (G436.2), and its key takes the column (the dome keeps its scale)');
  const idx = rw3.indexOf('CLOUDS.update(day, camera, world)'), gate = rw3.indexOf('if (day.version === dayVer && Math.abs(el - dayEl) < 0.02');
  yes(idx > 0 && gate > 0 && idx < gate, 'the clouds update every frame, before the sun-move gate (the drift, the eye, the shadow\'s scalars)');
  // C4: the veil, the in-cloud slab, the weather on the rails
  yes(/uniform vec4 uVeil; uniform vec3 uVeilSun, uVeilSky;/.test(at) && /L \+= veil\(d, uSun\);/.test(at), 'the dome carries the cirrus veil');
  yes((at.match(/uniform vec4 uMist\[4\];/g) || []).length === 2 && /slabLen\(y0, d\.y, D, uMist\[3\]\.y, uMist\[3\]\.z\)/.test(at), 'the mist takes the in-cloud slab (both copies of the mist GLSL)');
  yes(/c\.rho = rho; c\.base = inL\.base; c\.top = inL\.top;/.test(cj) && /A\.U\.veil\.value/.test(cj), 'clouds.js writes the veil and the slab from the day (the slab: the deck the eye is in)');
  yes(/\[\?&\]cloud=\(\[0-9\.\]\+\)\(\?:,\(\[a-z\]\{2\}\)\)\?/.test(src('viewer/day_clock.js')) && /o\.cloudUpper = c\[3\]/.test(src('viewer/day_clock.js')), '?cloud=<cover>[,<type>][;<cover>,<type>[,<base>]]* on the URL');
  // 2026-09-20: the low deck's cover and type moved from the brief's day slot to the clouds panel (one keeper); the day panel keeps a door to it
  yes(/H\.range\(host, 'cover', 0, 1, 0\.05, \(\) => day\(\)\.cloudCover/.test(src('viewer/clouds_ui.js')) && /cf\.TYPE_ORDER\.map\(t => \(\{ label: cf\.TYPES\[t\]\.label, value: t \}\)\)/.test(src('viewer/clouds_ui.js')), 'the clouds panel carries the low deck\'s cover and type');
  yes(!/flRange\(body, 'cloud cover'/.test(src('viewer/app.js')) && /ctx\.open\('clouds'\)/.test(src('viewer/day_ui.js')), 'the day slot no longer draws the cover itself; the day panel opens the clouds flyout');
  yes(/rows\.slider\(insp, 'cloud cover'/.test(src('viewer/premises_ui.js')) && /rows\.select\(insp, 'cloud type'/.test(src('viewer/premises_ui.js')), 'the WORLD editor carries the cover and the type');
  // (C4 held "the OVERCAST mood is a stratus deck" here - the mood select wrote the cover; G436.12 retired
  // that coupling: the OVERCAST row is what hangar.moodFor PICKS under nine tenths of cloud, held below)
  yes(/if \(day\.cloudCover > 0\.8 && MOODS\.length > 5\) return 5;/.test(src('viewer/hangar.js')), 'the OVERCAST mood follows the day\'s cover (moodFor), it does not set it');
  yes(/glslVersion: THREE\.GLSL3/.test(cj) && /sampler3D/.test(cj), 'the march is GLSL3 (a sampler3D needs it)');
  yes(/#include <tonemapping_fragment>/.test(cj) && /#include <colorspace_fragment>/.test(cj), 'the composite is tone-mapped and encoded by three\'s own chunks (the target is display-space)');
  yes(/ATMO\.GLSL\.AP/.test(cj) && /ATMO\.GLSL\.MIST/.test(cj) && /ATMO\.apUniforms/.test(cj), 'the march takes the aerial perspective and the mist from ATMO (one splice, shared)');
  yes(/apSample\(d, tm \* 0\.001\)/.test(cj) && /mistApply\(/.test(cj), 'and applies them at the cloud\'s own mean distance');
  yes(!/new Date|Date\.now/.test(cj) && !/new Date|Date\.now/.test(core), 'no wall clock: the drift is the day\'s seconds');
  yes(/CLOUD_FIELD\.weatherMap\(/.test(cj) && /CLOUD_FIELD\.layers\(/.test(cj), 'the pass samples the core\'s maps and layers (one field)');
  yes(/smoothstep\(0\.0, uProfA\[li\]\.x, h\) \* \(1\.0 - smoothstep\(uProfA\[li\]\.y \* hs, hs, h\)\)/.test(cj), 'the GLSL profile is the core\'s profile, verbatim (per deck)');
  yes(!/PointsMaterial\(\{ map: tex, size: 340/.test(rw) && /CLOUDS\.update\(day, camera, world\)/.test(rw), 'render_world retired the billboard puffs and hands the day to the clouds');
  yes(/k: 'clouds'/.test(gfx) && ['low', 'medium', 'high', 'ultra'].every(p => new RegExp(p + ':\\s*\\{[^}]*clouds: \'(off|half|full)\'').test(gfx)), 'the GRAPHICS menu has the clouds row in every preset');
  yes(/depthTexture: S\.needRT/.test(aa) && /S\.overlay\(renderer, camera, S\.rt\)/.test(aa) && /needRT, setOverlay/.test(aa), 'the resolve pass carries the depth texture and the overlay hook');
  const build = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  yes(/'08_cloud_field\.js'/.test(build) && /'clouds\.js'/.test(build), 'both files are in the build');
}

// ---- 7. SEVERAL DECKS + THE LOOK (A6, 2026-09-20) --------------------------------------------
console.log('7. several decks (A6): the field');
{
  const day = { cloudCover: 0.4, cloudType: 'cu', cloudBase: 1300, cloudUpper: [{ cover: 0.3, type: 'ac' }, { cover: 0.5, type: 'as', base: 100 }] };
  const L = F.layers(day);
  yes(L.length === 3 && L[0].type === 'cu' && L[1].type === 'ac' && L[2].type === 'as', 'layers(): the low deck first, the upper decks after, in order');
  yes(L[0].base === 1300 && L[0].cover === 0.4 && L[0].index === 0, 'the first deck is layer(day): the dewpoint base, the day\'s cover');
  yes(L[1].base === F.TYPES.ac.alt, 'an upper deck without a base takes its type\'s alt');
  yes(L[2].base >= L[1].top + F.LAYER_GAP && L[1].base >= L[0].top + F.LAYER_GAP, 'the decks never overlap: each base above the deck below plus the gap (a base of 100 m is lifted)');
  yes(F.layers({ cloudCover: 0.2, cloudType: 'cu', cloudUpper: [{}, {}, {}, {}] }).length === F.MAX_LAYERS, 'at most MAX_LAYERS decks');
  yes(F.layers({ cloudCover: 0.2, cloudType: 'cu' }).length === 1 && F.layers({ cloudCover: 0.2, cloudType: 'cu' })[0].base === F.layer({ cloudCover: 0.2, cloudType: 'cu' }).base, 'no cloudUpper: one deck, layer() itself');
  const cb = F.layers({ cloudCover: 0.3, cloudType: 'cb', cloudBase: 1000, cloudUpper: [{ cover: 0.3, type: 'ac' }] });
  yes(cb[1].base >= cb[0].top + F.LAYER_GAP && cb[1].base <= 12000, 'a deck over a cumulonimbus rides above its 4 km top, under 12 km');
  for (const t of F.TYPE_ORDER) yes(F.TYPES[t].erode >= 0 && F.TYPES[t].erode <= 1 && F.TYPES[t].period >= 1000 && F.TYPES[t].alt > 0, `type ${t} carries erode, period and alt`);
  yes(F.TYPES.st.erode < F.TYPES.sc.erode && F.TYPES.sc.erode < F.TYPES.cu.erode, 'the sheets erode less than the heaps (stratus < stratocumulus < cumulus)');
  yes(F.TYPE_ORDER.includes('ac') && F.TYPE_ORDER.includes('as'), 'altocumulus and altostratus are types (the upper decks\' own)');
  const u = F.upperWith([{ cover: 0.3, type: 'ac' }], 1, { cover: 0.5 });
  yes(u.length === 2 && u[0].cover === 0.3 && u[1].cover === 0.5 && u[1].type === 'ac', 'upperWith() births a missing deck and patches the named one');
  yes(F.upperWith(null, 0, { type: 'as' })[0].type === 'as', 'upperWith() on no decks');
  const D = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', '07_day.js'), 'utf8');
  yes(/get cloudUpper\(\)/.test(D) && /get cloudLayers\(\)/.test(D) && /slice\(0, 2\)/.test(D), 'the day publishes cloudUpper (sanitised, two at most) and cloudLayers');
}
console.log('7b. several decks + the look: the march (static)');
{
  const cj = src('viewer/clouds.js');
  yes(/uniform sampler2DArray uWeather;/.test(cj) && /new THREE\.DataArrayTexture\(u8, N_MAP, N_MAP, MAXL\)/.test(cj), 'the weather maps are one 2D array texture, a slice a deck');
  yes(/uniform vec4 uLayerA\[MAXL\];/.test(cj) && /uniform vec4 uProfA\[MAXL\];/.test(cj) && /uniform vec4 uDriftA\[MAXL\];/.test(cj), 'the per-deck numbers are arrays of MAXL');
  yes(/float density\(int li, vec3 p, vec4 w, bool cheap\)/.test(cj) && /vec4 weather\(int li, vec3 p\)/.test(cj), 'density and weather take the deck');
  yes(/float s0\[MAXL\], s1\[MAXL\]; int ord\[MAXL\]; int n = 0;/.test(cj) && /for \(; k > 0; k--\) \{ if \(s0\[k - 1\] <= t0\) break;/.test(cj), 'the march walks the decks\' segments in the order of their entry');
  yes(/float upperOD\(int li, vec3 p, vec3 L\)/.test(cj) && /upOD = upperOD\(li, p, L\) \* uDials2\.y/.test(cj), 'a deck stands in the softened shadow of the decks above it');
  yes(/vec2 xzj = xz \+ \(uSun\.y > 0\.05 \? uSun\.xz \* \(\(midj - mid0\) \/ uSun\.y\) : vec2\(0\.0\)\);/.test(cj), 'the shadow tile bakes every deck, an upper deck shifted along the sun to the first deck\'s middle');
  yes(/precision highp sampler2DArray;/.test(cj), 'the array sampler declares its precision (ESSL 3.00 has no default for it)');
  yes(/remap\(perlinFbm\(p, 4\.0\), 0\.366, 0\.579, 0\.0, 1\.0\)/.test(cj) && /remap\(remap\(pf, 0\.0, 1\.0, w4, 1\.0\), 0\.274, 1\.0, 0\.0, 1\.0\)/.test(cj), 'the noise bake is stretched to the byte by its measured percentiles (the slab\'s cause)');
  yes(/remap\(n\.r, lf \* uProfA\[li\]\.z, 1\.0, 0\.0, 1\.0\) \* prof/.test(cj), 'the worley fbm erodes by subtraction (the type\'s erode), never from lf - 1');
  yes(/function skyFraction\(r\)/.test(cj) && /readRenderTargetPixelsAsync\(skyRT/.test(cj) && /ask\(got => \{ me\.got = got; me\.it\+\+; \}\)/.test(cj) && /inflate\[fit\.i\] = 0\.5 \* \(fit\.lo \+ fit\.hi\); remapDeck\(fit\.i\)/.test(cj) && /calibrateCover\(r\); if \(needCal\) return;/.test(cj), 'the cover fit: the map inflated until the sky\'s share (four hemispheres from the ground) is the deck\'s cover - one step a frame, the read asynchronous');
  yes(/calDueAt = now\(\) \+ 300/.test(cj) && /if \(needCal && now\(\) >= calDueAt\) shadowDirty = true;/.test(cj), 'the fit waits 300 ms for a slider and runs even with the clock paused');
  yes(/PA\[o \+ 2\] = T\.erode \* S\.erodeK/.test(cj) && /LA\[o \+ 3\] = S\.period > 0 \? S\.period : T\.period/.test(cj), 'erode and period are the type\'s, scaled / overridden by the dials');
  yes(/0\.35 \+ 0\.65 \* exp\(-odS \* uDials2\.z\)/.test(cj), 'the ambient falls with the depth toward the sun (a core darker than a fringe)');
  yes(/od \+= CLOUD_FIELD\.columnOD\(maps\[i\]/.test(cj), 'sunT sums the column over the decks above the point');
  yes(/out\[k \+ 'P'\] = \[0\.05, 0\.25, 0\.5, 0\.75, 0\.95\]/.test(cj), 'the probe reports the noise\'s percentiles (the instrument that found the slab)');
  const A = src('viewer/app.js'), P = src('viewer/premises_ui.js'), DP = src('viewer/dev_panel.js');
  { const CU = src('viewer/clouds_ui.js');
    yes(/H\.range\(host, 'cover', 0, 1, 0\.05, \(\) => up\(\)\.cover/.test(CU) && /cf\.upperWith\(day\(\)\.cloudUpper, di, patch\)/.test(CU) && /H\.range\(host, 'base', 500, 9000, 100/.test(CU), 'the clouds panel carries the upper decks (cover, type, base)');
    yes(/k: 'clouds', label: 'clouds'/.test(A) && /window\.CLOUDS_UI\.mount\(body/.test(A) && /day: \(typeof DAY_CLOCK !== 'undefined'\) \? DAY_CLOCK : null/.test(A), 'the flight rail has the clouds item and mounts the panel with the day clock');
    yes(/head\('sky'\)/.test(CU) && /head\('cirrus veil'\)/.test(CU) && /head\('look'\)/.test(CU) && /head\('motion'\)/.test(CU) && /head\('render'\)/.test(CU) && /PRESETS = \[/.test(CU), 'the panel: presets, the decks, the veil, the look, the motion, the render');
    yes(/PREF = 'flydiy\.clouds'/.test(CU) && /API\.apply\(\);/.test(CU) && /cloudUpper: day\.cloudUpper && day\.cloudUpper\.length \? day\.cloudUpper : null/.test(src('viewer/day_clock.js')), 'the look is saved as flydiy.clouds and applied at load; the weather is saved with the day');
    yes(/'clouds_ui\.js'/.test(fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8')), 'clouds_ui.js is in the build'); }
  // 2026-09-20: ONE DAY PANEL on both rails (day_ui.js) - the flight's `day` slot and the shed's `night` flyout mount the same
  // module in their own rows; #selCond stays the keeper (pressed through its own change), DAY_CLOCK the one state (no #selTime)
  { const DU = src('viewer/day_ui.js'), E = src('viewer/editor.js'), B = src('viewer/body.html');
    yes(/head\('conditions'\)/.test(DU) && /head\('the hour'\)/.test(DU) && /sel\.dispatchEvent\(new Event\('change'\)\)/.test(DU) && /CK\.preset\(o\.value\)/.test(DU) && /CK\.set\(\{ localHours: v \}\)/.test(DU) && /CK\.set\(\{ date: i\.value \}\)/.test(DU) && /CK\.rate\(o\.value\)/.test(DU), 'the day panel: the conditions through #selCond, the presets, the hour, the date, the rate through the clock');
    yes(/window\.DAY_UI\.mount\(body, \{ row: flRow, range: flRange, pills: flPills, note: flNote, select: flSelect, field: flField \}/.test(A) && /refresh: flRefreshDay, open: flyOpenSet/.test(A), 'the flight rail\'s day slot mounts it, the plate refreshed, the clouds a flyout away');
    yes(/if \(t\.k === 'night'\) buildDay\(body\);/.test(E) && /window\.DAY_UI\.mount\(body, H, dayCtx\(\)\)/.test(E) && /rows: \['lights', 'world lights', 'ground bounce'\]/.test(E), 'the shed\'s night flyout mounts it over the borrowed light rows (the tree\'s mood select not borrowed)');
    yes(/window\.CLOUDS_UI\.mount\(body, railRows\(\), dayCtx\(\)\)/.test(E), 'the clouds and the day share the rail\'s row vocabulary (railRows)');
    yes(!/id="selTime"/.test(B) && !/flS\('Time'\)/.test(A), '#selTime is gone: the presets are pills, DAY_CLOCK the one state');
    yes(/k: 'time', state: 'DAY_CLOCK preset'/.test(E) && /CK\.preset\(P\[\(i \+ 1\) % P\.length\]\)/.test(E), 'the quick bar\'s time button presses the clock, not the mood');
    yes(/'day_ui\.js'/.test(fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8')), 'day_ui.js is in the build'); }
  // G436.12: the mood select's cloud coupling retired, the NIGHT on the flight rail, the lights rule in the cockpit
  { const E = src('viewer/editor.js'), CKS = src('viewer/cockpit.js'), PI = src('core/43_pilot.js'), CU = fs.readFileSync(path.join(__dirname, '_cage_ui.js'), 'utf8');
    yes(!/cloudCover: 0\.9, cloudType: 'st'/.test(A) && /MOOD_PRESET = \{ AFTERNOON: 'afternoon', GOLDEN: 'golden', SUNSET: 'sunset', DUSK: 'dusk', NIGHT: 'night' \}/.test(A), 'a mood picked by hand moves the hour only - the weather stays the day\'s (no OVERCAST preset)');
    yes(/\/\^OVERCAST\$\/i\.test\(String\(n\)\)\) \{ o\.disabled = true;/.test(CU), 'the tree\'s OVERCAST mood is offered greyed - it follows the clouds (hangar.moodFor)');
    yes(/k: 'night', label: 'night', title: 'The day, and the lights'/.test(A) && /    night\(body\) \{/.test(A) && /window\.DAY_UI\.mount\(body, H,/.test(A) && /K\.handSw\[o\.value\] = true; K\.glow\(0\);/.test(A) && /GE\.setWorldLight\(o\.value, !GE\.worldLightOn\(o\.value\)\)/.test(A), 'the flight rail has NIGHT: the day panel, the aeroplane\'s switches, the world\'s sources');
    yes(/CK\.lightsFor = \(day, ias, hAboveField\)/.test(CKS) && /land: night && low && !slow \? 1 : 0, taxi: night && low && slow \? 1 : 0/.test(CKS) && /instr: night \? 1 : 0/.test(CKS), 'the lights rule: nav, beacon and the panel at night, the landing light low and moving, the taxi light low and slow');
    yes(/if \(ctx\.day\) CK\.lightsRule\(ctx\.day, sim, cg\);/.test(CKS) && !/!ctx\.byHand/.test(CKS) && /if \(CK\.lightsNight !== null && CK\.lightsNight !== night\) CK\.handSw = \{\};/.test(CKS) && /CK\.handSw\[drv\] = true; did = true;/.test(CKS), 'the rule runs by hand too; a switch the hand set is the hand\'s until the next sunset or sunrise');
    yes(!/ap\.lights = \{/.test(PI) && !/ap\.lights\b/.test(CKS), 'the pilot no longer carries its own lights (one rule, the cockpit\'s)'); }
  // G440: the standing aeroplane's lights follow the hour in the shed - the light layer's drive over the design's levels
  { const CL = fs.readFileSync(path.join(__dirname, '_cage_light.js'), 'utf8');
    yes(/drive: levels => \{ driveLevels = levels \|\| null; applyDrive\(\); return driveLevels; \}/.test(CL) && /if \(driveLevels\) applyDrive\(\);/.test(CL), 'the light layer publishes drive(levels) and re-applies it after a rebuild');
    yes(/lampMats\.push\(\{ key, kind: 'lens', mat: lensM, lv \}\)/.test(CL) && /base: lv \* LENS_K, lv,/.test(CL) && /fm\.userData\.liBase == null\) fm\.userData\.liBase = fm\.emissiveIntensity/.test(CL), 'the drive restores the DESIGN\'s level (recorded from the rows, not from a cached material the night may have driven); the dial faces keep their base');
    yes(/shedCraftLights\(world\.day\);/.test(A) && /CK\.lightsFor\(day, 0, 1e4\)/.test(A) && /CL\.drive\(\{ nav: r\.nav, beacon: r\.beacon, instr: r\.instr \}\)/.test(A) && /if \(!night\) \{ CL\.drive\(null\); return; \}/.test(A), 'the shed applies the pilot\'s rule (nav, beacon, the panel - no beam from a stand) at night and takes it off at sunrise'); }
  // G443: the runway lights - geometry on every land strip, lit by the day, declared on the world's switchboard
  { const RW = src('viewer/render_world.js');
    yes(/function standRunwayLights\(a, keep\)/.test(RW) && /standRunwayLights\(a, keep\);/.test(RW) && /standRunwayLights\(HOME, o => o\);/.test(RW), 'every land strip stands its lights (standStrip) and the analytic HOME too');
    yes(/for \(let i = 0; i <= nE; i\+\+\) \{ const s = -half \+ \(a\.len \* i\) \/ nE; for \(const w of \[-\(hw \+ 1\.5\), hw \+ 1\.5\]\)/.test(RW) && /for \(const s of \[-half - 2, half \+ 2\]\) for \(let k = 0; k < 6; k\+\+\)/.test(RW) && /stand\(edge, 0xfff1cc\); stand\(thr, 0x37ff6a\);/.test(RW), 'white lenses down both edges every 60 m, six green ones across each threshold');
    yes(/\.declare\('runway', 'runway lights', 'emissive'/.test(RW) && /worldSwitch\.on\('runway'\)/.test(RW), 'the lights are declared on the world switchboard and honour its mute');
    yes(/const on = Math\.max\(0, Math\.min\(1, \(2 - day\.sunEl\) \/ 4\)\);/.test(RW) && /Math\.pow\(0\.92 \/ Math\.max\(0\.92, ex\), 0\.9\)/.test(RW) && /runwayLightsApply\(day, camera\.position\);/.test(RW), 'on from two degrees of sun down through the horizon, the level divided back through the exposure schedule, every frame before the sun-moved guard');
    yes(/Math\.max\(1, Math\.min\(150, d \* 0\.003 \/ 0\.09\)\)/.test(RW) && /im\.frustumCulled = false;/.test(RW) && /im\.userData\.grown = on > 0;/.test(RW), 'a lens holds ~3 mrad of the view at night (a point, not a sphere) and is its 9 cm again by day; never culled on its resting sphere');
    yes(/new THREE\.InstancedMesh\(new THREE\.SphereGeometry\(0\.09, 8, 6\), rwMat\(hex\), pts\.length\)/.test(RW) && /if \(o\.userData && o\.userData\.rwyLight\) \{ const k = RWY\.meshes\.indexOf\(o\); if \(k >= 0\) RWY\.meshes\.splice\(k, 1\); \}/.test(RW), 'instanced per colour per strip with its own geometry; a repainted strip takes its lights out of the drive'); }
  // G449: the premises LAMP POOL (G417's account, landed at last), the lit panes and the smoke by the day, the old emitters
  { const RP = src('viewer/render_premises.js'), RW = src('viewer/render_world.js'), PV = src('viewer/pattern_vis.js'), HGs = fs.readFileSync(path.join(__dirname, '_house_gen.js'), 'utf8');
    yes(/const LAMPS = \{ pool: \[\], pub: \[\], glass: new Map\(\), smoke: new Set\(\), gain: 2/.test(RP) && /for \(let i = 0; i < LAMPS\.N; i\+\+\) \{ const l = new THREE\.PointLight/.test(RP) && /N: 8, reach: 500/.test(RP), 'a CONSTANT pool of eight point lights on the premises root, assigned within 500 m');
    yes(/\(LAMPS\.frame\+\+ % 30\) === 0/.test(RP) && /\.filter\(q => q\[0\] < r2\)\.sort\(\(a, b\) => a\[0\] - b\[0\]\)\.slice\(0, LAMPS\.N\)/.test(RP) && /kLamp = 2\.2 \* 1\.1 \* LAMPS\.gain \/ Math\.max\(1, ex\)/.test(RP), 'the pool is re-assigned every 30 frames to the nearest published lamps; the level is the bench\'s night divided by the live exposure base');
    yes(/LAMPS\.pub\.push\(\{ grp, p: \[L\.x, L\.y, L\.z\], col: L\.col/.test(RP) && /LAMPS\.glass\.set\(F\.GLASS_U\.uLitK, F\.GLASS_U\.uLitK\.value\)/.test(RP) && /LAMPS\.smoke\.add\(F\.SMOKE_U\.uSmokeLit\)/.test(RP), 'every built thing publishes its lamps, its finish\'s lit panes and its smoke to the pool');
    yes(/\.declare\('lamps', 'the premises lamps', 'light'/.test(RW) && /premisesR\.lamps\.update\(camera\.position, Math\.max\(0, Math\.min\(1, \(2 - day\.sunEl\) \/ 4\)\), ex2\)/.test(RW) && /get premises\(\) \{ return premisesR; \}/.test(RW), 'declared on the world switchboard as lamps, driven each frame by the day (the runway lights\' fade), reachable for the F8 dial');
    yes(/uSmokeLit: \{ value: 1 \}/.test(HGs) && /\(0\.85 \+ 0\.25 \* n\) \* uSmokeLit/.test(HGs) && /kSmoke = Math\.pow\(0\.92 \/ Math\.max\(0\.92, ex\), 1\.35\)/.test(RP), 'the chimney smoke is a haze lit by the sky (an unlit column no more)');
    yes(/new THREE\.MeshStandardMaterial\(\{ color: dark, emissive: 0x000000, emissiveIntensity: 0/.test(PV) && !/new THREE\.MeshBasicMaterial\(\{ color: dark \}\)/.test(PV) && /U\.m\.emissiveIntensity = col \? lv : 0;/.test(PV) && /toneMapped: false \}\);/.test(PV), 'a PAPI unit is a light (its reading the emissive, dark from behind) and the overlays keep their own colour through the exposure');
    yes(/patVis\.papiUpdate\(cgP\[0\], cgP\[1\], cgP\[2\], 1\.2 \* Math\.pow\(0\.92 \/ Math\.max\(0\.92, exP\), 0\.9\)\)/.test(A), 'the PAPI\'s lenses take the runway lights\' level from the flight loop'); }
  yes(/rows\.slider\(insp, 'upper deck ' \+ \(di \+ 1\)/.test(P) && /rows\.slider\(insp, 'deck ' \+ \(di \+ 1\) \+ ' base'/.test(P), 'the WORLD editor carries the upper decks');
  yes(/slider\('upper deck ' \+ \(di \+ 1\)/.test(DP) && /slider\('erode'/.test(DP) && /select\('cover fit'/.test(DP), 'F8 carries the upper decks, erode and the cover fit');
  yes(fs.existsSync(path.join(__dirname, 'cloud_shot.js')), 'the rig that judges the sky (tools/cloud_shot.js) is there');
}

console.log(`${checks} checks, ${fails} failed`);
console.log(`GATE CLOUD: ${fails ? 'FAIL (' + fails + ' of ' + checks + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
