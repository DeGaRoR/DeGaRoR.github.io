// ============================================================
// THE CRAFT'S OWN SHADOW MAP (A6, 2026-09-20 - the playtest: "the shadows
// refresh every so many metres" on the aeroplane and the ground under it).
//
// The world's sun has ONE 1024^2 map whose half-width grows with height
// (render_world.js worldUpdate: 105..540 m -> 0.2..1 m texels, PCF hard,
// texel-snapped). A wing's shadow on the fuselage lives on a handful of
// those texels and re-quantises a whole texel at a time as the aeroplane
// moves - that step is the "refresh". The far map cannot be finer (it has to
// reach the ground shadow at 500 m AGL); the craft needs its own.
//
// A SECOND DirectionalLight, BLACK (it lights nothing), casts a 2048^2 map
// over a 60 m box round the CG (3 cm a texel), its camera on its own LAYER
// (NEAR_LAYER) so only what is tagged casts into it: the craft (app.js tags
// the craft group when the model joins it) and the field's near casters
// (the premises, the pier, the props - the far map keeps the trees). The
// shader rule, one patch of lights_fragment_begin for the sun (light 0):
//   a craft material (CRAFT_NEAR_ONLY, set on the craft's own materials):
//     the near map alone - never the far map's 0.5 m stepping on its skin;
//   everything else: inside the near box  min(near, far)  (the crisp craft
//     shadow on the apron AND the trees' from the far map), outside  far.
// The near light's own loop iteration is skipped (a black light adds a BRDF
// evaluation for nothing). uNearP.x says the near map is live (the shed's
// scene has no near light; the rule must not misread its lights).
//
// THE CRAFT AND THE FAR MAP: the far map's camera sees FAR_LAYER (2), which
// render_world puts on every caster but the craft (G601: as objects join the
// scene). The craft is never on FAR_LAYER while the near map is live (G650:
// the near box's depth follows the sun down to the craft's ground shadow at
// any height - see follow()); the far map's coarse, every-other-frame copy
// was the trailing ghost. With the near map off the craft casts into the far
// map, as it did before A6. Layer 0 is never touched: the main camera, the cockpit's pick and
// the flare's occlusion rays all live there (the first cut moved the craft
// off layer 0 and the flare shone through the roof - a Raycaster tests layer
// 0 by default). The instanced trees stay out of the near map: a stand of
// 20 k-triangle trees is no 2048^2 pass.
// ============================================================
var SHADOW_NEAR = (function () {
  'use strict';
  const NEAR_LAYER = 3, FAR_LAYER = 2;   // the near map's camera sees 3; the far map's sees 2 (everything but the craft, unless it is high)
  const S = { on: true, half: 30, size: 1024, bias: -0.0004, biasM: 0.05, normalBias: 0.02, normalBiasTx: 0.9, relief: 150, slantMax: 3000, penumbra: 0.0093, radiusMax: 2.5, self: true, slant: 0 };   // size: render_world sets it from the GRAPHICS tier (1024 full, 2048 ultra)
  const nearScalars = new Float32Array(4);           // x: the near map is live (1 / 0)
  const nearUniforms = { uNearP: { value: nearScalars } };
  let installed = false;
  // ---- THE SHADER RULE (installed before any program compiles, like ATMO / CLOUDS) --------
  const KEY = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  const RULE = `
		#if ( UNROLLED_LOOP_INDEX == 0 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )
		if ( uNearP.x > 0.5 ) {
			float sFar = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ 0 ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
			vec3 nc = vDirectionalShadowCoord[ 1 ].xyz / vDirectionalShadowCoord[ 1 ].w;
			bool inNear = nc.x > 0.01 && nc.x < 0.99 && nc.y > 0.01 && nc.y < 0.99 && nc.z > 0.0 && nc.z < 1.0;
			float sNear = ( inNear && receiveShadow ) ? getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowIntensity, directionalLightShadows[ 1 ].shadowBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] ) : 1.0;
			#ifdef CRAFT_NEAR_ONLY
			directLight.color *= sNear;
			#else
			directLight.color *= inNear ? min( sNear, sFar ) : sFar;
			#endif
		} else {
			${KEY}
		}
		#elif ( UNROLLED_LOOP_INDEX == 1 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )
		if ( uNearP.x < 0.5 ) {
			${KEY}
		}
		#else
		${KEY}
		#endif`;
  // ---- THE PCF LOOKUP FOR A REVERSED DEPTH BUFFER, AND A KERNEL THAT STANDS STILL (G650, A2-SHADOW-SKY) ------------
  // THE STRIPES (playtest 2026-09-26, screens 140339 / 145145): the depth buffer went REVERSED at 90a0eae5 (app.js), and
  // three r186 renders the shadow maps reversed too (1 at the light's near plane, a GREATER-EQUAL compare) - but its PCF
  // getShadow still does `shadowCoord.z += shadowBias` with no reversed case (only VSM and BASIC have one). A negative
  // bias, meant to pull a receiver TOWARD the light, pushed every receiver AWAY from it, behind its own depth: acne on
  // every lit surface, the chordwise hachures on the double-sided wing skin. Measured: ?depth=log (the old buffer) was
  // clean. The fix is three's own VSM rule in the PCF path: under the reversed buffer the bias is subtracted.
  // THE CRAWL: r186's PCF is five taps of a Vogel disc turned per pixel by interleaved-gradient noise - a kernel built
  // for a TAA that averages the noise away over frames. The game has none, so every shadow edge dithered and crawled as
  // the camera moved. Four hardware-compared (bilinear) taps half a texel off the point: a stable ~3-texel penumbra, no
  // noise. `?pcf=noise` keeps three's kernel for the A/B.
  const PCF_BIAS = 'shadowCoord.z += shadowBias;';   // its first occurrence is the PCF getShadow's (#if SHADOWMAP_TYPE_PCF comes first)
  const PCF_NOISE_A = 'float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;';
  // FOUR taps, not nine: each is a hardware-compared BILINEAR fetch, so four at (+-0.5, +-0.5) texel cover the 3x3 texels
  // round the point with a tent - the same footprint as a 3x3 grid of nearest compares, smoother. The first cut had nine
  // (written out: fxc inlines loops of fetches badly - G567), inlined three times in every lit program by the near rule:
  // the roll-out's compile step went 13.8 -> 36 s on every warm run (rollout_perf, G650). Four is fewer than three's five.
  const PCF_GRID = 'shadow = (\n' + [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]
    .map(([x, y]) => `texture( shadowMap, vec3( shadowCoord.xy + vec2( ${x.toFixed(1)}, ${y.toFixed(1)} ) * radius, shadowCoord.z ) )`).join(' +\n') + '\n) * 0.25;';
  const pcf = { bias: false, grid: false };
  function patchPCF(SC) {
    let f = SC.shadowmap_pars_fragment || '';
    const i = f.indexOf(PCF_BIAS), pv = f.indexOf('SHADOWMAP_TYPE_VSM');
    if (i >= 0 && (pv < 0 || i < pv)) {
      f = f.slice(0, i) + '\n#ifdef USE_REVERSED_DEPTH_BUFFER\nshadowCoord.z -= shadowBias;\n#else\nshadowCoord.z += shadowBias;\n#endif\n' + f.slice(i + PCF_BIAS.length);
      pcf.bias = true;
    }
    const noise = typeof location !== 'undefined' && /[?&]pcf=noise/.test(location.search || '');
    const a = f.indexOf(PCF_NOISE_A), b = a >= 0 ? f.indexOf(') * 0.2;', a) : -1;
    if (!noise && a >= 0 && b > a) { f = f.slice(0, a) + PCF_GRID + f.slice(b + ') * 0.2;'.length); pcf.grid = true; }
    SC.shadowmap_pars_fragment = f;
  }
  function install() {
    if (installed || typeof THREE === 'undefined' || !THREE.ShaderChunk) return false;
    const SC = THREE.ShaderChunk;
    if (!SC.lights_fragment_begin || SC.lights_fragment_begin.indexOf(KEY) < 0) return false;
    patchPCF(SC);
    SC.lights_fragment_begin = SC.lights_fragment_begin.replace(KEY, RULE);
    // the black light's own iteration: no BRDF for it when the near map is live
    const RE = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
    const dir0 = SC.lights_fragment_begin.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )');
    if (dir0 >= 0) {
      const head = SC.lights_fragment_begin.slice(0, dir0), tail = SC.lights_fragment_begin.slice(dir0);
      const k = tail.indexOf(RE);
      if (k >= 0) SC.lights_fragment_begin = head + tail.slice(0, k) + `#if !( ( UNROLLED_LOOP_INDEX == 1 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 ) )
		${RE}
		#else
		if ( uNearP.x < 0.5 ) ${RE}
		#endif` + tail.slice(k + RE.length);
    }
    SC.lights_pars_begin = (SC.lights_pars_begin || '') + '\n#if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )\nuniform vec4 uNearP;\n#endif\n';
    for (const kk of ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon']) {
      const lib = THREE.ShaderLib[kk]; if (lib && lib.uniforms) lib.uniforms.uNearP = nearUniforms.uNearP;
    }
    installed = true;
    return true;
  }
  // inject(shader): the scalar for a program built outside ShaderLib's copy (the prototype hook / ATMO.inject chain)
  function inject(sh) { if (sh && sh.uniforms && !sh.uniforms.uNearP) sh.uniforms.uNearP = nearUniforms.uNearP; }
  // ---- THE LIGHT --------------------------------------------------------------------------
  // make(scene, sunTarget): the black light with its 2048^2 map over the near box; its shadow camera sees NEAR_LAYER only
  function make(scene) {
    if (typeof THREE === 'undefined') return null;
    const L = new THREE.DirectionalLight(0x000000, 1);
    L.castShadow = true;
    L.shadow.mapSize.set(S.size, S.size);
    L.shadow.bias = S.bias; L.shadow.normalBias = S.normalBias;
    const c = L.shadow.camera;
    c.left = -S.half; c.right = S.half; c.top = S.half; c.bottom = -S.half; c.near = 1; c.far = 4 * S.half + 10; c.updateProjectionMatrix();
    c.layers.set(NEAR_LAYER);
    scene.add(L); scene.add(L.target);
    L.name = 'sunNear';
    return L;
  }
  // tag(o): a caster into the near map (the craft's group, a house, the pier)
  function tag(o) { if (o && o.traverse) o.traverse(m => { m.layers.enable(NEAR_LAYER); }); }
  // tagCraft(group): the craft - a near caster, its materials near-only (the far map's stepping never on its skin)
  let craftGroup = null, craftFar = null;
  function tagCraft(group) {
    craftGroup = group; craftFar = null;
    if (!group) return;
    group.traverse(m => {
      m.layers.enable(NEAR_LAYER); m.userData.craft = true;   // render_world's near tagging leaves the craft's meshes alone
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      // the craft RECEIVES its own shadow now (a wing on the fuselage, a strut on the wing): it never did - three's
      // default is off and the far map's half-metre texels would have been acne; the opaque casters only
      if (m.isMesh && m.castShadow && mats.length && !mats.some(x => x.transparent || x.opacity < 1)) m.receiveShadow = !!S.self;
      if (m.isMesh && mats.length && !mats.some(x => x.transparent || x.opacity < 1)) m.renderOrder = -1;   // an occluder before the ground (render_world.js ORDER_NOTE)
      for (const mat of mats) { if (!mat.defines) mat.defines = {}; if (!mat.defines.CRAFT_NEAR_ONLY) { mat.defines.CRAFT_NEAR_ONLY = 1; mat.needsUpdate = true; } }
    });
  }
  // follow(L, cg, sun, agl, snap, camera): the box round the CG each frame, snapped to its own texels (render_world's
  // snapToTexels), its DEPTH reaching the craft's ground shadow at any height (G650 below)
  //
  // G650 THE TRAILING GHOST (A2-SHADOW-SKY; playtest 2026-09-26: the aircraft's shadow "blurred, crawling, trailing").
  // The box's depth used to stop 70 m down-sun of the CG, so above ~40 m AGL the craft's ground shadow fell out of it
  // and the craft joined the FAR map - which redraws every 2nd frame (render_world SHADOW_RATE) at 0.2-1 m texels -
  // while the ground inside the box took min(near, far): a coarse, stale copy of the shadow, a frame behind, blinking
  // at 15 Hz under the 30 cap. But an orthographic light sees the craft and its ground shadow on the SAME ray: the
  // box never had to move sideways, only to see deeper. So the near camera's far plane now reaches the ground along
  // the sun (the height over the ground divided by the sun's elevation, plus a relief margin), the craft never joins
  // the far map while the near map is live, and there is no hand-over left to fade. The bias is held in METRES
  // (S.biasM) as the depth range grows, and the kernel widens a little with the slant - the sun's half-degree disc
  // blurs a shadow cast from high up (S.penumbra, capped at S.radiusMax texels; the grid kernel bands past that).
  const _t = (typeof THREE !== 'undefined' && THREE.Vector3) ? new THREE.Vector3() : null;
  function follow(L, cg, sun, agl, snap, camera) {
    if (!L) return;
    const live = S.on ? 1 : 0;
    nearScalars[0] = live; L.visible = !!live; L.castShadow = !!live;
    const far = !live;   // the craft is on the far map only while the near map is off
    if (craftGroup && far !== craftFar) { craftFar = far; craftGroup.traverse(m => { if (far) m.layers.enable(FAR_LAYER); else m.layers.disable(FAR_LAYER); }); }
    if (!live) return;
    _t.set(cg[0], cg[1], cg[2]);
    if (snap) snap(_t, S.half, S.size);
    L.target.position.copy(_t);
    L.position.set(_t.x + sun.x * 2 * S.half, _t.y + sun.y * 2 * S.half, _t.z + sun.z * 2 * S.half);
    if (camera && !camera.layers.isEnabled(NEAR_LAYER)) camera.layers.enable(NEAR_LAYER);
    // the depth: the box's own 2 x half above the target, down to the ground shadow (plus S.relief of terrain) below it
    const sy = Math.max(0.05, sun.y), slant = Math.min(S.slantMax, Math.max(0, agl) / sy);
    const c = L.shadow.camera, want = Math.max(4 * S.half + 10, 2 * S.half + slant + S.relief / sy);
    if (Math.abs(c.far - want) > 0.05 * want) { c.far = want; c.updateProjectionMatrix(); }
    L.shadow.bias = -S.biasM / (c.far - c.near);
    const texel = 2 * S.half / S.size;
    // the normal offset in TEXELS (0.02 m was a third of the 1024 map's 6 cm texel: a faint diamond acne on a wing lit at
    // a grazing sun, measured G650 - 0.9 of a texel clears it and moves a receiver 5 cm, invisible on an aeroplane)
    L.shadow.normalBias = S.normalBiasTx * texel;
    L.shadow.radius = Math.max(1, Math.min(S.radiusMax, (slant * S.penumbra / texel - 1) / 2));
    S.slant = slant;
  }
  const API = { S, pcf, NEAR_LAYER, FAR_LAYER, install, inject, make, tag, tagCraft, follow, get installed() { return installed; } };
  if (typeof window !== 'undefined') { window.SHADOW_NEAR = API; API.install(); }
  return API;
})();
