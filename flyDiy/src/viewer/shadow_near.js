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
//
// G1005 THE CRAFT'S OWN CASCADE (A6-SHADOW, 2026-09-27; the user, a Cub parked on the pavement: "the current aircraft
// shadow is too low resolution. The pixelating of the straight wingspan is also moving with frames, this is so blurred
// that the tailwheel seems to have no shadow"). The 60 m box above is sized for the near casters (a hangar over a parked
// aeroplane), not for the aeroplane: 5.9 cm a texel at 1024, a ~3-texel penumbra, and a 10 cm tailwheel was a smudge.
// The near light's map is now an ATLAS of two viewports (three's multi-viewport shadow path - the one a point light
// uses - on a DirectionalLight: _frameExtents 2 x 1, getCamera(i) / getFrustum(i) per viewport), no new sampler (the
// island ground programs stand at 15 of 16):
//   viewport 1 (right): the 60 m box as before, the NEAR casters only (NEAR_LAYER) - the craft is no longer drawn into it;
//   viewport 0 (left): THE CRAFT'S CASCADE, fitted to the craft's bounding sphere round the CG (a Cub: ~8 m a side, 1.6 cm a
//     texel at 1024), the craft (CRAFT_LAYER) and the near casters inside it. The craft and every ground point its
//     shadow falls on lie on the same light rays, so the tight box holds the whole shadow at any sun and any height
//     (the depth reaches down to the ground as G650's does); it grows with the slant so the sun's penumbra never needs
//     more than radiusMax texels (at a few hundred metres AGL it is the 60 m box again).
// The lookup: a receiver inside the craft's box reads the craft's cascade (its coordinate from uNearM1 and the world
// position, with its own bias, radius and normal offset in uNearP.yzw - world units scaled by that cascade's texel),
// else the 60 m box through three's own varying. One getShadow either way.
// THE COST (measured: the second viewport cost +1.3 ms of render CPU at the taxi - three's shadow pass walks the WHOLE
// scene graph for every viewport, 67 000 objects at Jolene's stand): the craft's cascade is drawn FIRST, and while it
// draws, every top-level child of the scene but the craft's is hidden (getCamera(0) hides, getCamera(1) - the next
// viewport, three's own loop - restores; follow() restores too, should a pass ever throw). Unless a near caster stands
// in the craft's box (a hangar over a parked aeroplane: nearTag's spheres against the cascade's frustum) - then the
// cascade walks everything, as the 60 m box does.
// ============================================================
var SHADOW_NEAR = (function () {
  'use strict';
  const NEAR_LAYER = 3, FAR_LAYER = 2, CRAFT_LAYER = 5;   // the near map's viewport 0 sees 3, its viewport 1 (the craft's cascade) 3 + 5; the far map sees 2 (everything but the craft, unless it is high)
  const S = { on: true, half: 30, size: 1024, bias: -0.0004, biasM: 0.05, normalBias: 0.02, normalBiasTx: 0.9, relief: 150, slantMax: 3000, penumbra: 0.0093, radiusMax: 2.5, self: true, slant: 0,   // size: render_world sets it from the GRAPHICS tier (1024 full, 2048 ultra), per viewport
    craft: true, prune: true, fitMargin: 0.4, fitMin: 2.5, biasTx: 0.85, craftHalf: 0, craftR: 0 };   // G1005: the craft's cascade (craft: false = its box is the 60 m one); biasTx = G650's 5 cm at the 60 m box's 5.9 cm texel
  const nearScalars = new Float32Array(4);           // x: the near map is live (1 / 0); yzw: the craft cascade's bias (depth), PCF radius (texels), normal offset (m)
  const nearUniforms = { uNearP: { value: nearScalars }, uNearM1: { value: (typeof THREE !== 'undefined' && THREE.Matrix4) ? new THREE.Matrix4() : null } };
  let installed = false;
  // ---- THE SHADER RULE (installed before any program compiles, like ATMO / CLOUDS) --------
  const KEY = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  const RULE = `
		#if ( UNROLLED_LOOP_INDEX == 0 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )
		if ( uNearP.x > 0.5 ) {
			float sFar = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ 0 ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
			vec3 nc = vDirectionalShadowCoord[ 1 ].xyz / vDirectionalShadowCoord[ 1 ].w;
			bool in0 = nc.x > 0.505 && nc.x < 0.995 && nc.y > 0.01 && nc.y < 0.99 && nc.z > 0.0 && nc.z < 1.0;
			vec4 nc1 = uNearM1 * vec4( cameraPosition + ( vec4( geometryPosition + geometryNormal * uNearP.w, 0.0 ) * viewMatrix ).xyz, 1.0 );
			bool in1 = nc1.x > 0.005 && nc1.x < 0.495 && nc1.y > 0.01 && nc1.y < 0.99 && nc1.z > 0.0 && nc1.z < 1.0;
			bool inNear = in0 || in1;
			float sNear = ( inNear && receiveShadow ) ? getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize * vec2( 2.0, 1.0 ), directionalLightShadows[ 1 ].shadowIntensity, in1 ? uNearP.y : directionalLightShadows[ 1 ].shadowBias, in1 ? uNearP.z : directionalLightShadows[ 1 ].shadowRadius, in1 ? nc1 : vDirectionalShadowCoord[ 1 ] ) : 1.0;
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
    .map(([x, y]) => `texture( shadowMap, vec3( shadowCoord.xy + vec2( ${x.toFixed(1)}, ${y.toFixed(1)} ) * pcfR, shadowCoord.z ) )`).join(' +\n') + '\n) * 0.25;';
  // (pcfR: the radius in TEXELS on both axes - three's `radius` is in texelSize.x units, and the near map is a 2 x 1 atlas)
  const PCF_GRID_R = 'vec2 pcfR = radius * vec2( 1.0, texelSize.y / texelSize.x );\n';
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
    if (!noise && a >= 0 && b > a) { f = f.slice(0, a) + PCF_GRID_R + PCF_GRID + f.slice(b + ') * 0.2;'.length); pcf.grid = true; }
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
    SC.lights_pars_begin = (SC.lights_pars_begin || '') + '\n#if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )\nuniform vec4 uNearP;\nuniform mat4 uNearM1;\n#endif\n';
    for (const kk of ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon']) {
      const lib = THREE.ShaderLib[kk]; if (lib && lib.uniforms) { lib.uniforms.uNearP = nearUniforms.uNearP; lib.uniforms.uNearM1 = nearUniforms.uNearM1; }
    }
    installed = true;
    return true;
  }
  // inject(shader): the scalar for a program built outside ShaderLib's copy (the prototype hook / ATMO.inject chain)
  function inject(sh) { if (sh && sh.uniforms && !sh.uniforms.uNearP) { sh.uniforms.uNearP = nearUniforms.uNearP; sh.uniforms.uNearM1 = nearUniforms.uNearM1; } }
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
    atlas(L.shadow); C1.scene = scene;
    scene.add(L); scene.add(L.target);
    L.name = 'sunNear';
    return L;
  }
  // atlas(shadow): the 2 x 1 map - viewport 0 the 60 m box (three's own camera, matrix and frustum), viewport 1 the
  // craft's cascade (C1.cam, uNearM1). three's shadow pass calls updateMatrices once, then draws each viewport with
  // getCamera(i) and getFrustum(i); _updateMatrix(camera, matrix, frustum, viewport) folds the atlas offset in.
  const C1 = { cam: null, frustum: null, pos: null, tgt: null, H: 0, scene: null, hidden: [], pruned: 0, full: 0 };
  const _ns = (typeof THREE !== 'undefined' && THREE.Sphere) ? new THREE.Sphere() : null;
  let nearSpheres = null;   // render_world's nearTag: [x, y, z, r] of the casters on NEAR_LAYER now (setNear)
  function setNear(list) { nearSpheres = list; }
  // prune(): the craft's cascade walks the craft's subtree alone - unless a near caster reaches into its frustum
  function prune() {
    const sc = C1.scene; if (!sc || !craftGroup || C1.hidden.length) return;
    if (nearSpheres) for (const q of nearSpheres) { _ns.center.set(q[0], q[1], q[2]); _ns.radius = q[3]; if (C1.frustum.intersectsSphere(_ns)) { C1.full++; return; } }
    let top = craftGroup; while (top.parent && top.parent !== sc) top = top.parent;
    if (top.parent !== sc) return;
    for (const o of sc.children) if (o !== top && o.visible && !o.isLight) { o.visible = false; C1.hidden.push(o); }
    C1.pruned++;
  }
  function unprune() { const h = C1.hidden; for (let i = 0; i < h.length; i++) h[i].visible = true; h.length = 0; }
  function atlas(sh) {
    if (!sh || typeof sh._updateMatrix !== 'function' || !nearUniforms.uNearM1 || !THREE.Frustum) { S.on = false; return; }   // not this three: no near map rather than a wrong one
    sh._frameExtents.set(2, 1); sh._viewportCount = 2;
    sh._viewports = [new THREE.Vector4(0, 0, 1, 1), new THREE.Vector4(1, 0, 1, 1)];   // 0 (left): the craft's cascade, 1 (right): the 60 m box
    const cam1 = C1.cam = sh.camera.clone(); cam1.layers.set(NEAR_LAYER); cam1.layers.enable(CRAFT_LAYER);
    C1.frustum = new THREE.Frustum(); C1.pos = new THREE.Vector3(); C1.tgt = new THREE.Vector3();
    const t0 = new THREE.Vector3();
    // three's loop: getCamera(i) then getFrustum(i) then the walk, for i = 0, 1 - the bracket round the craft's pass
    sh.getCamera = function (i) { if (i === 0) { if (S.prune) prune(); return cam1; } unprune(); return this.camera; };
    sh.getFrustum = function (i) { return i ? this._frustum : C1.frustum; };
    sh.updateMatrices = function (light) {
      const c0 = this.camera;
      c0.position.setFromMatrixPosition(light.matrixWorld); t0.setFromMatrixPosition(light.target.matrixWorld);
      c0.lookAt(t0); c0.updateMatrixWorld();
      this._updateMatrix(c0, this.matrix, this._frustum, this._viewports[1]);
      if (cam1._reversedDepth !== c0._reversedDepth) { cam1._reversedDepth = c0._reversedDepth; cam1.updateProjectionMatrix(); }   // three flips its own camera; this one is ours
      cam1.position.copy(C1.pos); cam1.lookAt(C1.tgt); cam1.updateMatrixWorld();
      this._updateMatrix(cam1, nearUniforms.uNearM1.value, C1.frustum, this._viewports[0]);
    };
  }
  // tag(o): a caster into the near map (the craft's group, a house, the pier)
  function tag(o) { if (o && o.traverse) o.traverse(m => { m.layers.enable(NEAR_LAYER); }); }
  // tagCraft(group): the craft - a near caster, its materials near-only (the far map's stepping never on its skin)
  let craftGroup = null, craftFar = null, craftPose = null;
  const craftC = (typeof THREE !== 'undefined' && THREE.Vector3) ? new THREE.Vector3() : null;
  // tagCraft(group, pose): pose = the object that carries the aeroplane's pose (app.js model.grp); the craft's bounding
  // sphere is taken in its frame once, and carried by its matrixWorld every frame (fitCraft) - the cascade's fit
  function tagCraft(group, pose) {
    craftGroup = group; craftFar = null; craftPose = null; S.craftR = 0; C1.H = 0;
    if (!group) return;
    if (pose && pose.matrixWorld && THREE.Sphere && THREE.Matrix4) {
      pose.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(pose.matrixWorld).invert(), sp = new THREE.Sphere(), all = new THREE.Sphere(), m4 = new THREE.Matrix4();
      let n = 0;
      pose.traverse(m => {
        if (!m.isMesh || !m.castShadow || !m.geometry) return;
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        sp.copy(m.geometry.boundingSphere).applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
        if (n++) all.union(sp); else all.copy(sp);
      });
      if (n) { craftPose = pose; craftC.copy(all.center); S.craftR = all.radius; }
    }
    group.traverse(m => {
      m.layers.enable(CRAFT_LAYER); m.layers.disable(NEAR_LAYER); m.userData.craft = true;   // render_world's near tagging leaves the craft's meshes alone
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
    unprune();   // (a pass that threw between getCamera(0) and getCamera(1) must not leave the world hidden)
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
    if (camera && !camera.layers.isEnabled(CRAFT_LAYER)) camera.layers.enable(CRAFT_LAYER);
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
    if (C1.cam) fitCraft(cg, sun, slant, sy, snap);
  }
  // fitCraft: the craft's cascade (G1005) - its half-width the craft's sphere round the CG (the pose carried from the
  // frame before: the margin covers a frame's travel), grown so the sun's penumbra at this slant needs at most
  // radiusMax texels (tx >= slant x penumbra / (2 radiusMax + 1)); re-fitted only on a 20 % change (a new half re-snaps
  // the grid: a still aeroplane must keep its texels). The same up-sun reach and depth law as the 60 m box.
  const _c1 = (typeof THREE !== 'undefined' && THREE.Vector3) ? new THREE.Vector3() : null;
  function fitCraft(cg, sun, slant, sy, snap) {
    let H = S.half;
    if (S.craft && craftPose && S.craftR > 0) {
      _c1.copy(craftC).applyMatrix4(craftPose.matrixWorld);
      const off = Math.hypot(_c1.x - cg[0], _c1.y - cg[1], _c1.z - cg[2]);
      const fit = S.craftR + off + S.fitMargin, pen = slant * S.penumbra * S.size / (2 * (2 * S.radiusMax + 1));
      H = Math.min(S.half, Math.max(S.fitMin, fit, pen));
    }
    if (!(C1.H > 0) || H > C1.H || H < 0.8 * C1.H) C1.H = Math.min(S.half, H * 1.1);
    const Hh = C1.H, reach = 2 * S.half, cam = C1.cam;
    _c1.set(cg[0], cg[1], cg[2]);
    if (snap) snap(_c1, Hh, S.size);
    C1.tgt.copy(_c1); C1.pos.set(_c1.x + sun.x * reach, _c1.y + sun.y * reach, _c1.z + sun.z * reach);
    const far = Math.max(reach + 2 * Hh + 10, reach + slant + S.relief / sy);
    if (cam.right !== Hh || Math.abs(cam.far - far) > 0.05 * far) {
      cam.left = -Hh; cam.right = Hh; cam.top = Hh; cam.bottom = -Hh; cam.near = 1; cam.far = far; cam.updateProjectionMatrix();
    }
    const tx = 2 * Hh / S.size;
    nearScalars[1] = -S.biasTx * tx / (cam.far - cam.near);
    nearScalars[2] = Math.max(1, Math.min(S.radiusMax, (slant * S.penumbra / tx - 1) / 2));
    nearScalars[3] = S.normalBiasTx * tx;
    S.craftHalf = Hh;
  }
  const API = { S, pcf, C1, NEAR_LAYER, FAR_LAYER, CRAFT_LAYER, install, inject, make, tag, tagCraft, follow, setNear, unprune, get installed() { return installed; } };
  if (typeof window !== 'undefined') { window.SHADOW_NEAR = API; API.install(); }
  return API;
})();
