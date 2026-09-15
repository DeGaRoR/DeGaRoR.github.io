// ================= world rendering (shared generator) =================
// Golden hour: low sun aft-right, warm haze, long shadows.
// Builds every static scene element from the shared `world` object and
// returns { worldUpdate(cg) } — per-frame sun-frustum follow + cloud drift.
// Airfield decals are scaled to the CURRENT 1100 m runway (centre x=-520,
// thresholds +20/-1060); the physics flat pad is x in [-1180, 130].
function buildWorldScene(scene, world, renderer, camera, shedDims) {
  const C = h => new THREE.Color(h).convertSRGBToLinear();
  const HAZE = 0xe8bd8d, SUNC = 0xffd39a;
  const SUN = new THREE.Vector3(0.80, 0.185, 0.57).normalize();
  // THE DAY'S SUN (SKY S2, 2026-09-14). `SUN` is what every SHADOW pass reads
  // (the follow, the far cascade, the impostor depth) and it is held 2 deg
  // above the horizon so agl / SUN.y never blows up at sunset; `SUN_SKY` is
  // the true direction, which is what the dome draws the disc at. Both are
  // written from world.day in dayApply() unless the rig is set to manual.
  const SUN_SKY = SUN.clone();
  let miniCanvas = null;              // W13 minimap underlay, baked with the outer ring
  let outerTexShared = null;          // W13.2: outer-ring texture, reused by strip patches
  let innerPatchShared = null;        // G386: the inner ring's material and uv law, for the premises' patch
  let outerMatShared = null;          // G398.3: the outer ring's material (its canopy tint), for a premises' patch beyond the inner ring
  let groundApi = { on: () => false, get: () => ({}), set: () => ({}), modes: () => [] };   // G400: the island's live ground stack (set in the terrain block)
  const groundGeos = [];              // G387: the ring geometries, so a live premises edit can re-sample them
  let repaintStrips = () => {};       // v8: the premises' strip decals stood again after a live edit
  let detailApply = null;             // W13.2: close-range grain hook for patch materials
  const socks = [];                   // every windsock: { pole:[x,y,z], mesh }
  let fillUpdate = () => {};          // W13 woodland fill streamer (set in the tree block)
  let fillApi = null;                 // S3: the ring's prewarm / ringReady / ringStat (set in the fill block)
  let treeSettleOf = null;            // S3: () => the payload's settle promise (set in the tree block)
  let lodUpdate = () => {};           // W17 tree LOD: chunk meshes on/off by tier (tree block)
  let setShedDims = () => {};         // HANGARS S1: re-stand the shed at new dims (airfield block)
  // W17 tree LOD uniforms, shared by every tree material and refreshed once a
  // frame in worldUpdate. uCam drives the impostor view direction (so it wants
  // the CHASE CAMERA, not the CG); uCG drives the shadow-pass cull, because the
  // sun's shadow camera follows the aircraft, not the eye.
  const uCam = { value: new THREE.Vector3() };
  const uCG = { value: new THREE.Vector3() };
  // The ladder's rungs, up here because the ground shader owns the far one and
  // the tree block owns the other two, and they have to agree at the seams.
  // FAR_FILL is where the streamed forest stops being geometry and becomes
  // texture on the terrain; the woodland stands (sparser, and the only trees
  // outside the FOREST_FLOOR mask the texture is keyed to) run to the fog wall.
  // FAR_FILL was first set at 2700 and that was too greedy: measured against the
  // pre-ladder build at the same viewpoint, the 2.7-5.2 km shore went from
  // forested to pasture, because a canopy TEXTURE cannot stand in for trees on
  // ground that is still only half hazed. At 4000 the fog is ~74% by the time
  // the last impostor shrinks away, so the far tier only has to carry the band
  // where nothing is legible anyway — and impostors are 2 triangles, so buying
  // that 1.3 km back cost almost nothing.
  // THE BANDS ARE THE BENCH'S (W0c.26): 60 / 132 / 270. Measured
  // (tools/tree_perf.js, NG x bands, Smooth tier, densest stand): with
  // geometry to 450 m the frame is 25 / 31 / 39 ms at NG 96 / 112 / 128;
  // with the bench's bands it is 24 / 24 / 23 - all but independent of
  // density, because the impostor is one quad and the near tier's
  // fragments are the whole cost. So the near tier ends at 270 m, as the
  // bench had it, and density is a look choice rather than a frame one.
  // ON AN ISLAND THE RING GOES TO THE EYE (G400, the user: "impostors for
  // everything that can be seen by the eye ... don't hide terrain geometry in
  // a flight game"): there is no fog wall to hide behind. 9 km first, measured;
  // the horizon is the next step once the far chunks are coarser.
  const NEAR_R = 270, FAR_WOOD = world.island ? 9000 : 5400, FAR_FILL = world.island ? 9000 : 4000, FAR_FADE = 500;
  const uNear = { value: NEAR_R };     // live: every tree material reads it
  // THE RING THINS WITH DISTANCE, IT DOES NOT POP (LOADING S3, G420). The
  // fill's far chunks used to be a different, quarter-density set and a
  // chunk crossing 3.5 km was evicted and regenerated at full density - a
  // 4x pop walking ahead of the aeroplane. Now every chunk's BASE is the
  // even sub-lattice of ONE grid (a quarter of the points, the same points
  // at every distance) and the COMPLEMENT (the other three quarters) is
  // added inside FILL_R; the complement's impostors carry uThin: an instance
  // whose own hash exceeds keep(d) collapses, keep going 1 -> 0 over
  // [uThin.x, uThin.y], each tree shrinking in over 5 % of the ramp. The
  // base wears U_NOTHIN (keep = 1 everywhere); one GLSL text, one program.
  // (a plain {x, y} where the headless stub has no Vector2 - GATE WORLDRENDER;
  // three uploads a vec2 uniform off .x/.y either way)
  const v2 = (x, y) => THREE.Vector2 ? new THREE.Vector2(x, y) : { x, y, set(a, b) { this.x = a; this.y = b; return this; } };
  const uThin = { value: v2(world.island ? 3000 : 2500, world.island ? 4200 : 3400) };
  const U_NOTHIN = { value: v2(1e9, 1e9 + 1) };
  // the two inner edges of the ladder, shared by every rung material the
  // same way uNear is - a dial can move them and every band follows
  // L2 IS NOT DRAWN BY DEFAULT (W0c.32, the user: "the trunk shows a lot
  // through with this empty foliage... L1 covering the band L1+L2 cover
  // today, then straight to billboard"): L1 (stick + full foliage) runs
  // from 60 m to the impostor at 270; the half-foliage rung stays in the
  // payload and the dial (L1 to < L2 to) brings it back.
  const LOD_U = [{ value: 60 }, { value: 270 }], U0 = { value: 0 };
  // THE TRANSITION WINDOW (W0c.13): over uFadeW metres about every edge BOTH
  // rungs are drawn, each through a screen-door dither with complementary
  // thresholds from the same noise, so every pixel is covered exactly once
  // and the mix slides from one rung to the next as the eye moves. This is
  // Unreal's "dithered LOD transition" and what SpeedTree ships; no blend,
  // no sort, no pop. The window is also what closes the GAP: a tree that
  // crossed an edge between two partition refreshes was collapsed by its
  // old rung's band before its new rung had it, and for a few frames it was
  // not drawn at all. The partition deals a tree to every rung whose window
  // holds it, and refreshes more often than the window is wide.
  const uFadeW = { value: 30 };
  // the shadow frustum's live half-width: the impostor caster collapses every
  // instance the map cannot see, or 170 000 quads pay the depth pass for
  // nothing (measured +4-7 ms on the MSAA tiers with the default bands, which
  // put every impostor outside the reach anyway)
  const uShadowR = { value: 105 };
  // the impostor tier's own gain (the bench's `imp lit`): 0.9 MEASURED, the
  // same stand drawn as geometry and as impostors from 40 m under the alps
  // row, mean luminance over the forest half of the frame 81.9 against 85.8
  // at 0.9 / 92.1 at 1.0 / 79.0 at 0.8 (scratch steps_ilit.js, W0c.18)
  const uILit = { value: 0.9 };
  // THE BAKE SWITCHES THE BANDS OFF. A rung's material collapses every
  // instance outside its band, and the impostor bake draws the same material
  // from thirty metres: an L2 whose band starts at 300 m baked an EMPTY sheet,
  // and the far band of the fill was black. Measured by reading the albedo
  // target back: 0 texels covered where the normal pass had 40 514.
  const uNoBand = { value: 0 };
  // the sky dome, held so the switchboard further down can reach it: it is
  // parented to the CAMERA, so it is not findable by walking the scene
  let worldSky = null;
  // THE WORLD'S LAMBERT STAYS OUT OF THE ENVIRONMENT (W0.5a). r186 hands
  // scene.environment to Lambert and Phong as diffuse IBL; r128 gave it to
  // Standard only, and the hemisphere further down is the world's ambient
  // BECAUSE of that (THE HEMISPHERE STAYS OUT HERE). Letting the IBL in would
  // count the sky a second time on every slope, tree and roof — the double
  // the shed paid at G62.5. A Lambert material that carries an envMap of its
  // own is left alone by the scene, and an equirect texture with no image
  // resolves to NO map at all (WebGLEnvironments: "image not yet ready"), so
  // this opt-out costs nothing per fragment and compiles no envmap code.
  // RULING OWED: the IBL is the better ambient; taking it means retiring the
  // hemisphere and re-judging the world by eye (RENDERER-DECISION §4g).
  const LAMBERT_NO_ENV = new THREE.Texture();
  LAMBERT_NO_ENV.mapping = THREE.EquirectangularReflectionMapping;
  const worldLambert = o => new THREE.MeshLambertMaterial(Object.assign({ envMap: LAMBERT_NO_ENV }, o));
  // THE RENDERER FLAG (W0.5b): the module picks a variant per material on it
  const TSL_ON = !!(renderer && renderer.isWebGPURenderer);
  // THE ATMOSPHERE (SKY S3): Hillaire's model in atmo.js draws the sky and
  // feeds the lights; absent (the headless gate) or refused (the TSL flag,
  // no WebGL target) the painted dome and the interim dimmer stand in.
  const ATMO_ON = (typeof ATMO !== 'undefined') && ATMO.init(renderer);
  // the card's anisotropy, asked of whichever renderer this is (the node
  // renderer answers on itself, after init)
  const MAX_ANISO = (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) ? renderer.capabilities.getMaxAnisotropy()
                  : (renderer && renderer.getMaxAnisotropy) ? renderer.getMaxAnisotropy() : 8;
  // the fog wall hid the analytic ring's edge at 5.2 km; an island's edge is the sea (the user: "remove the fog")
  // THE FOG (S4): under the atmosphere the world's distance is the aerial
  // perspective (atmo.js's one splice in every fogged material) and this
  // object is only what defines USE_FOG - a sentinel a light-year out. The
  // painted haze walls (600-5200 m; 20-90 km on an island) stand only when
  // the atmosphere is off (the TSL flag, the headless gate).
  scene.fog = ATMO_ON && ATMO.installed ? new THREE.Fog(C(HAZE), 1e9, 2e9)
            : world.island ? new THREE.Fog(C(HAZE), 20000, 90000) : new THREE.Fog(C(HAZE), 600, 5200);
  scene.add(camera);

  // Sky shader, factored out because the W18 environment bake below renders the
  // very same dome into a cube map: ONE source of truth for the golden hour, so
  // a reflection can never drift from the sky it is supposed to be reflecting.
  //
  // `encode` is the bake variant. This shader writes gl_FragColor by hand and
  // includes none of three's chunks, so on screen nothing converts its output
  // (the palette was tuned against exactly that). The PMREM target is a
  // half-float LINEAR one (r186; it was RGBE on r128, where a hand-written
  // alpha of 1.0 read as an exponent and turned every Standard material pure
  // black — W18's afternoon), so the bake variant has one job: linearise.
  // THE SAME DOME IN TSL (W0.5b, the first material of the port; tools/_tsl.html
  // is the bench that proved it to 1 code on both backends). One node material
  // serves both variants: the palette is DISPLAY values, so the node hands the
  // output stage the decoded value — on the canvas the stage encodes it back
  // to the authored bytes, in the PMREM target (no encode) it is the linear
  // radiance the bake variant wanted. `uniforms` keeps the GLSL shape (.value
  // on each) so the rig rows and the switchboard read and write it unchanged.
  const skyMatTSL = (encode, extra) => {
    const T = THREE.TSL;
    const U = { uTop: T.uniform(C(0x3f7fbe)), uMid: T.uniform(C(0x9dc4dd)),
                uHaze: T.uniform(C(HAZE)), uSun: T.uniform(SUN_SKY), uSunCol: T.uniform(C(SUNC)), uDim: T.uniform(1.0) };
    const dome = T.Fn(() => {
      const d = T.normalize(T.positionWorld.sub(T.cameraPosition));
      const h = d.y;
      let col = T.mix(U.uHaze, U.uMid, T.smoothstep(-0.01, 0.20, h));
      col = T.mix(col, U.uTop, T.smoothstep(0.13, 0.80, h));
      col = T.mix(col, U.uHaze.mul(0.82), T.smoothstep(0.0, -0.30, h));
      const sd = T.max(T.dot(d, T.normalize(U.uSun)), 0.0);
      const glow = T.pow(sd, 900.0).mul(3.0).add(T.pow(sd, 14.0).mul(0.42)).add(T.pow(sd, 3.0).mul(0.13));
      return T.colorSpaceToWorking(col.add(U.uSunCol.mul(glow)).mul(U.uDim), THREE.SRGBColorSpace);
    });
    const m = new THREE.MeshBasicNodeMaterial();
    m.colorNode = dome();
    m.side = THREE.BackSide; m.depthTest = false; m.depthWrite = false; m.fog = false;
    m.uniforms = U;
    if (extra) Object.assign(m, extra);
    return m;
  };
  const skyMat = (encode, extra) => (TSL_ON ? skyMatTSL : skyMatGLSL)(encode, extra);
  const skyMatGLSL = (encode, extra) => new THREE.ShaderMaterial(Object.assign({
      uniforms: { uTop:{value:C(0x3f7fbe)}, uMid:{value:C(0x9dc4dd)},
                  uHaze:{value:C(HAZE)}, uSun:{value:SUN_SKY}, uSunCol:{value:C(SUNC)}, uDim:{value:1.0} },
      vertexShader: `varying vec3 vD;
        void main(){ vD = (modelMatrix * vec4(position,1.0)).xyz - cameraPosition;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uTop,uMid,uHaze,uSunCol,uSun; uniform float uDim; varying vec3 vD;
        void main(){
          vec3 d = normalize(vD);
          float h = d.y;
          vec3 col = mix(uHaze, uMid, smoothstep(-0.01, 0.20, h));
          col = mix(col, uTop, smoothstep(0.13, 0.80, h));
          col = mix(col, uHaze * 0.82, smoothstep(0.0, -0.30, h));
          float sd = max(dot(d, normalize(uSun)), 0.0);
          col += uSunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 14.0) * 0.42 + pow(sd, 3.0) * 0.13);
          gl_FragColor = vec4(col * uDim, 1.0);   // INTERIM S2: the painted day fades through twilight (atmo.js replaces this dome)
          ` + (encode ? `
          // This palette is authored in DISPLAY space: the on-screen dome
          // writes gl_FragColor raw into an sRGB-encoded target and nothing
          // converts it, which is what the colours were tuned against. A
          // reflection probe, though, must hold scene-LINEAR radiance — hand
          // the same numbers to the PBR pipeline as linear and every surface
          // reflects a sky about 2.4x too bright, which reads as chrome: the
          // C172's white-and-teal livery vanished under a mirror of sky and
          // grass. Linearise here, in the bake variant only.
          gl_FragColor = vec4(mix(pow((gl_FragColor.rgb + 0.055) / 1.055, vec3(2.4)),
                                  gl_FragColor.rgb / 12.92, step(gl_FragColor.rgb, vec3(0.04045))), 1.0);` : '') + `
        }`,
      side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }, extra));

  { // sky dome — parented to the camera so it never runs out
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2, 32, 20), ATMO_ON ? ATMO.domeMat() : skyMat(false));
    sky.renderOrder = -1000; sky.frustumCulled = false;
    camera.add(sky);
    worldSky = sky;                 // the switchboard below needs a handle
  }

  // ---- W18: the reflection map -------------------------------------------
  // A PMREM cube baked ONCE at boot from a throwaway scene holding this world's
  // own sky dome plus a ground hemisphere. No HDRI file, no network, nothing to
  // ship — and the reflections are of THIS sky, at THIS hour, by construction.
  // Assigned to scene.environment, which in r128 reaches MeshStandardMaterial
  // and nothing else: the whole Lambert world (terrain, trees, buildings) is
  // untouched, and the two surfaces that were already Standard — the water and,
  // from W18, the aircraft skin — pick it up for free.
  // `toneMapped = false` on both bake materials for the same reason the impostor
  // atlas needs it: the cube is LINEAR data that gets tone mapped once, later,
  // when the reflection is drawn. Bake it tone mapped and every reflection is
  // ACES-flattened twice and reads chalky.
  // the occlusion factor every ambient-from-below in this project is scaled
  // by, hoisted here because BOTH the environment bake and the hemisphere
  // light below need it, and they must never disagree
  const gb = (typeof window !== 'undefined' && window.LIGHT_RIG)
    ? window.LIGHT_RIG.groundBounce() : 1;
  let envMap = null, probe = null;
  if (ATMO_ON && THREE.PMREMGenerator && renderer && renderer.setRenderTarget) {
    // THE PROBE FOLLOWS THE SUN (S5). The sky-view LUT for the boot hour and
    // the dome's scale (K_SUN x the world's light unit - LIGHT_UNIT below is
    // pi) BEFORE the first cube is shot; then dayApply re-bakes it whenever
    // the sun has moved 1.5 deg (six minutes at 1x, six seconds at 60x) or
    // the day's dials changed - the window fix, and the water's and the
    // skin's. The cap under it is lit by the day (atmo.js groundIrradiance).
    ATMO.update(renderer, world.day, 0);
    if (typeof SKY_LIGHT !== 'undefined' && SKY_LIGHT.calibrate()) ATMO.U.scale.value = SKY_LIGHT.K().K_SUN * Math.PI;
    probe = ATMO.makeProbe(renderer, { frameYaw: 0, capHex: 0x6d7a45, gb, onSwap: t => { envMap = t; scene.environment = t; },
      // CLOUDS C3: the layer over the dome in the probe's scene (the water and the skin reflect the clouds),
      // re-baked as the clouds drift past the eye
      decorate: typeof CLOUDS !== 'undefined' && CLOUDS.domeMesh ? es => { const m = CLOUDS.domeMesh(0, 20, 24); if (m) es.add(m); } : null,
      dirty: typeof CLOUDS !== 'undefined' && CLOUDS.probeDirty ? () => CLOUDS.probeDirty() : null,
      baked: typeof CLOUDS !== 'undefined' && CLOUDS.probeBaked ? () => CLOUDS.probeBaked() : null });
    if (probe) probe.bake(world.day);
  } else {
  if (THREE.PMREMGenerator && renderer && renderer.setRenderTarget) {
    const es = new THREE.Scene();
    const domeG = new THREE.SphereGeometry(20, 32, 20);
    if (ATMO_ON) {
      // the sky-view LUT for the boot hour, and the dome's scale (K_SUN x the
      // world's light unit - LIGHT_UNIT below is pi) BEFORE the cube is shot
      ATMO.update(renderer, world.day, 0);
      if (typeof SKY_LIGHT !== 'undefined' && SKY_LIGHT.calibrate()) ATMO.U.scale.value = SKY_LIGHT.K().K_SUN * Math.PI;
    }
    es.add(new THREE.Mesh(domeG, ATMO_ON ? ATMO.domeMat({ toneMapped: false, depthTest: true }) : skyMat(true, { toneMapped: false, depthTest: true })));
    // lower hemisphere: the sky shader fades to haze below the horizon, which is
    // right for a horizon and wrong for what an aircraft's underside actually
    // sees. One averaged upland green is honest for a static bake — the belly
    // should pick up ground bounce, not more sky.
    //
    // AND THE BOUNCE IS OCCLUDED, at the same measured fraction the shed uses
    // (LIGHT_RIG.groundBounce). Painted at full radiance this cap is a
    // half-dome of upland green pressed against the aeroplane's underside, and
    // it showed: measured on the wing in flight, the belly came back RGB
    // (14, 60, 34) — green, from a light source that is a solid colour and
    // never moves. A real belly sees ground it is itself shading, through air
    // that has already scattered most of it away.
    const grndG = new THREE.SphereGeometry(19.5, 24, 12, 0, 6.2832, Math.PI / 2, Math.PI / 2);
    // S3: under the physical sky the cap is LIT BY THE DAY - its level follows
    // the ground's irradiance (sun x T x cos + sky) relative to the alps
    // afternoon it was judged in, so a dusk bake does not carry a noon lawn
    // under the aeroplane (measured: a constant cap was 1000x the dusk sky and
    // lit every Standard material green from below)
    const capK = ATMO_ON ? (() => {
      const d = world.day, s = d.sun, T = [0, 0, 0], E = [0, 0, 0];
      const Eg = v => { ATMO.sunTransmittance(0, v[1], T); ATMO.skyIrradiance(0, v, E); return Math.max(0, v[1]) * (0.2126 * T[0] + 0.7152 * T[1] + 0.0722 * T[2]) + (0.2126 * E[0] + 0.7152 * E[1] + 0.0722 * E[2]); };
      const ref = Eg([0, Math.sin(33.4 * Math.PI / 180), Math.cos(33.4 * Math.PI / 180)]);
      return Math.min(1.5, Eg(s) / Math.max(1e-9, ref));
    })() : 1;
    es.add(new THREE.Mesh(grndG, new THREE.MeshBasicMaterial({
      color: C(0x6d7a45).multiplyScalar(gb).multiplyScalar(capK), side: THREE.BackSide,
      toneMapped: false, fog: false })));
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(es, 0.035, 1, 100).texture;   // slight blur: a sky, not a mirror
    scene.environment = envMap;
    pmrem.dispose();
    domeG.dispose(); grndG.dispose();
  }
  }

  // THE WORLD'S RIG, DECLARED ONCE. It is read here and again by the tree
  // impostor bake ~550 lines down, which lights a white tree and freezes the
  // result into an atlas that is drawn as an UNLIT MeshBasicMaterial. That
  // atlas is therefore immune to every later lighting change: edit the rig
  // without editing the bake and the far forest stays lit for a world that no
  // longer exists — silently, and for ever, because nothing downstream can
  // tell you. Two literals that must agree are a bug waiting for its first
  // edit, so there is one.
  // shadowMin 540 = the reach dial's maximum (W0c.31, the user: "I'd rather
  // drop density than shadow fidelity"): the sun map always covers ±540 m,
  // so nothing inside it pops from shadow to none as the aircraft climbs
  const RIG = { skyCol: 0xbcd8f0, gndCol: 0x6a5a3c, hemi: 0.50, sun: 2.75, shadowMin: 540 };
  // THE LIGHT UNIT (W0.5a). r128 drew the world under the LEGACY light model,
  // where a directional or hemisphere intensity meant PI times what the
  // physical model — r186's only one — means (lights_pars_begin's
  // `irradiance *= PI`). The rows keep the numbers they were tuned in (2.75 /
  // 0.50; alps 2.8 / 0.274 — the F8 panel shows and edits those); the
  // conversion happens where a row reaches a light, here, once. The shed
  // needs none: it ran the physical model already (light_rig.js).
  const LIGHT_UNIT = Math.PI;
  // THE FOREST FLOOR (W0c.17): the ground under a canopy gets a fraction of
  // the sky, and a terrain painted as if it stood in the open is what makes
  // a stand float on it. The far tier already darkens the ground it stands
  // in for; this is the same idea inside it - the domain forest mask,
  // bilinear at 47 m a texel, so a stand's edge carries a soft apron of
  // shade a few tens of metres wide. Not a shadow (the sun's shadow map does
  // that inside its reach): an occlusion, which is why it does not move.
  const uFloor = { value: 0.30 };          // 0.3 by the user's word (W0c.23)
  // THE BLUR (W0c.31, the user: "the forest floor is now too detailed...
  // blurred, extend further, with a smoother transition"): the canopy map
  // is read at one mip level - 3.5 was ~11 m texels and every crown drew
  // its own disc on the ground; 5.5 is ~62 m, a stand's shade and not its
  // trees' - and the coverage ramp's knee sets how far the apron reaches
  // past the last crown. Both dials on the rig (floorBlur, floorEdge).
  const uFloorLod = { value: 5.5 }, uFloorEdge = { value: 0.26 };
  // THE CANOPY MAP (W0c.23). The floor term above darkened wherever the
  // BIOME CLASSIFIER said forest floor - the domain mask, 47 m a texel - and
  // the planter then rejects trees on the airfield corridor, the exclusion
  // zones, near water and wherever no stand tree is near: fields classified
  // forest and never planted were darkened, and at 0.3 those blobs read as
  // the shadows of ghosts ("you compute stuff based on the untrimmed
  // distribution" - exactly). The occlusion must come from the trees that
  // ARE there. So: a straight-down pass of the real tree quads - the same
  // proxies as the far cascade, their depth material told to face UP, which
  // makes the octahedral fold pick the crown's top view - over ±1400 m about
  // the eye into a 2048² map, re-rendered on 20 m of movement or when a
  // chunk lands, and the terrain darkens by the blurred coverage. Nothing
  // classified, nothing guessed: a texel is dark because a crown is over it.
  const COVER = { on: { value: 0 }, map: { value: null }, vp: { value: new THREE.Matrix4() },
                  rt: null, cam: null, at: null, dirty: true, half: 1400, size: 2048 };
  const U_UP = { value: new THREE.Vector3(0, 1, 0) }, U_NONEAR = { value: -1e6 };
  // THE FAR CASCADE (W0c.19). The sun's shadow map reaches ±105-540 m around
  // the aircraft, and the impostor band starts at 450 m: whatever the
  // impostor's own depth material does, the map cannot see it, and the far
  // stand shaded nothing - the user's screenshot. A second cascade, cheap
  // because it is narrow: an orthographic depth pass of the impostor QUADS
  // alone (two triangles each, through their sun-facing depth material)
  // over ±1400 m about the eye, into a 2048² target (1.4 m a texel), every fourth frame or
  // when the eye has moved, and sampled by the TERRAIN alone - which is
  // where a shadow at 500 m is seen. Not a general cascade: trees do not
  // read it, and the near map keeps doing the near work.
  const FAR = { on: { value: 0 }, map: { value: null }, vp: { value: new THREE.Matrix4() },
    enabled: !(renderer && renderer.isWebGPURenderer),   // W0.5b: the far cascade + canopy map are packed-depth passes; off under the flag until ported

                rt: null, cam: null, scene: null, proxies: new Map(), tick: 0, at: null, half: 1400, size: 2048 };
  // TEXEL SNAPPING (W0c.22). A shadow camera that follows the aircraft
  // continuously slides its texel grid by a fraction of a texel every frame,
  // and every shadow edge re-quantises against the moving grid: the whole
  // pattern swims, worst in the canopy where every leaf is an edge - "the
  // shadows are recalculated each frame". They are; what must not change is
  // where the texels fall. The camera's target is moved only in whole-texel
  // steps in LIGHT space (the two axes of the map; depth does not matter),
  // exactly the basis three.js's lookAt builds, so a still tree lands on the
  // same texels frame after frame. Every cascade does this.
  const _sR = new THREE.Vector3(), _sU = new THREE.Vector3(), _sUp = new THREE.Vector3(0, 1, 0);
  const SNAP = { on: true };                     // an A/B switch: WORLD_RIG.set({ snap })
  const snapToTexels = (T, half, mapSize) => {
    if (!SNAP.on) return T;
    const texel = 2 * half / mapSize;
    _sUp.set(0, 1, 0); if (Math.abs(SUN.y) > 0.999) _sUp.set(0, 0, 1);
    _sR.crossVectors(_sUp, SUN).normalize();      // lookAt's x: up x forward(=L)
    _sU.crossVectors(SUN, _sR);                   // lookAt's y
    const a = T.dot(_sR), b = T.dot(_sU);
    const da = Math.round(a / texel) * texel - a, db = Math.round(b / texel) * texel - b;
    T.addScaledVector(_sR, da).addScaledVector(_sU, db);
    return T;
  };
  const _sT = new THREE.Vector3();
  const farRegister = (mi, depthMat) => {
    if (!depthMat || !THREE.WebGLRenderTarget) return;
    if (!FAR.scene) {
      FAR.scene = new THREE.Scene();
      FAR.cam = new THREE.OrthographicCamera(-FAR.half, FAR.half, FAR.half, -FAR.half, 1, 6000);
      FAR.rt = new THREE.WebGLRenderTarget(FAR.size, FAR.size, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
                                                          format: THREE.RGBAFormat, generateMipmaps: false });
      FAR.map.value = FAR.rt.texture;
    }
    // the proxy shares the impostor mesh's geometry AND its instance buffer;
    // only the material differs, and count / visibility are copied per pass
    const p = new THREE.InstancedMesh(mi.geometry, depthMat, mi.instanceMatrix.count);
    p.instanceMatrix = mi.instanceMatrix;
    p.position.copy(mi.position);
    p.frustumCulled = false;
    p.userData.src = mi;
    FAR.scene.add(p);
    FAR.proxies.set(mi, p);
    COVER.dirty = true;
  };
  // a registered mesh's chunk centre against a pass's reach (the sun's slant
  // adds a margin: a low sun throws a crown's shadow a few hundred metres)
  const proxyNear = (mi, eye, half) => { const r = half + 724 + 600, dx = mi.position.x - eye.x, dz = mi.position.z - eye.z; return dx * dx + dz * dz < r * r; };
  const coverRender = eye => {
    if (!FAR.scene || !renderer || !renderer.setRenderTarget) return;
    const moved = !COVER.at || Math.hypot(eye.x - COVER.at[0], eye.z - COVER.at[1]) > 20;
    if (!moved && !COVER.dirty) return;
    COVER.dirty = false;
    COVER.at = [eye.x, eye.z];
    if (!COVER.rt) {
      COVER.cam = new THREE.OrthographicCamera(-COVER.half, COVER.half, COVER.half, -COVER.half, 1, 6000);
      // a MASK, not a depth: white where a crown is, mipmapped, so the
      // terrain's blur is one tap at a coarser level rather than sixteen
      // taps of packed depth (which were +12 ms on the supersampled tier)
      COVER.rt = new THREE.WebGLRenderTarget(COVER.size, COVER.size, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
                                                                      format: THREE.RGBAFormat, generateMipmaps: true });
      COVER.map.value = COVER.rt.texture;
    }
    // the eye's ground point, snapped to the map's own grid (a vertical map
    // has the world's x/z for axes)
    const texel = 2 * COVER.half / COVER.size;
    const cx = Math.round(eye.x / texel) * texel, cz = Math.round(eye.z / texel) * texel;
    const gy = world.terrainH(cx, cz);
    COVER.cam.position.set(cx, gy + 3000, cz);
    COVER.cam.up.set(0, 0, 1);
    COVER.cam.lookAt(cx, gy, cz);
    COVER.cam.updateMatrixWorld(true);
    COVER.cam.updateProjectionMatrix();
    let dead = null;
    for (const [mi, p] of FAR.proxies) {
      if (!mi.parent) { (dead = dead || []).push(mi); continue; }
      p.position.copy(mi.position);
      // a chunk whose centre is beyond the map's half-extent plus a chunk's
      // half-diagonal cannot mark it: not submitted (S3 - the passes used to
      // run every resident chunk of the 9 km ring through their vertex shader)
      p.count = mi.count; p.visible = mi.visible && mi.count > 0 && proxyNear(mi, eye, COVER.half);
      p.userData.farMat = p.material;
      p.material = (p.material.userData && p.material.userData.cover) || p.material;
    }
    if (dead) for (const mi of dead) { FAR.scene.remove(FAR.proxies.get(mi)); FAR.proxies.delete(mi); }
    const pRT = renderer.getRenderTarget(), pAC = renderer.autoClear;
    const pCol = new THREE.Color(), pA = renderer.getClearAlpha();
    { const gc = renderer.getClearColor(pCol); if (gc && gc !== pCol) pCol.copy(gc); }
    renderer.setRenderTarget(COVER.rt);
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = true;
    renderer.render(FAR.scene, COVER.cam);
    renderer.setRenderTarget(pRT);
    renderer.setClearColor(pCol, pA);
    renderer.autoClear = pAC;
    for (const [, p] of FAR.proxies) if (p.userData.farMat) { p.material = p.userData.farMat; p.userData.farMat = null; }
    COVER.vp.value.multiplyMatrices(COVER.cam.projectionMatrix, COVER.cam.matrixWorldInverse);
    COVER.on.value = 1;
  };
  const farRender = eye => {
    if (!FAR.scene || !renderer || !renderer.setRenderTarget) return;
    if (FAR.enabled === false) { FAR.on.value = 0; return; }
    const moved = !FAR.at || Math.hypot(eye.x - FAR.at[0], eye.z - FAR.at[1]) > 20;
    if (FAR.tick++ % 4 && !moved) return;
    FAR.at = [eye.x, eye.z];
    for (const [mi, p] of FAR.proxies) {
      if (!mi.parent) { FAR.scene.remove(p); FAR.proxies.delete(mi); continue; }
      // THE POSITION IS COPIED PER PASS, NOT AT REGISTRATION (W0c.23): the
      // fill registers its impostor mesh before the chunk offset is set on
      // it, and a proxy that copied (0,0,0) put a copy of every fill chunk's
      // trees at the ORIGIN - a phantom forest over the airfield, its trees
      // at the heights of their real, hilly chunks, casting from 160 m up.
      p.position.copy(mi.position);
      p.count = mi.count; p.visible = mi.visible && mi.count > 0 && proxyNear(mi, eye, FAR.half);
    }
    const gy = world.terrainH(eye.x, eye.z);
    snapToTexels(_sT.set(eye.x, gy, eye.z), FAR.half, FAR.size);
    FAR.cam.position.set(_sT.x + SUN.x * 3000, _sT.y + SUN.y * 3000, _sT.z + SUN.z * 3000);
    FAR.cam.up.set(0, 1, 0);
    FAR.cam.lookAt(_sT.x, _sT.y, _sT.z);
    FAR.cam.updateMatrixWorld(true);
    FAR.cam.updateProjectionMatrix();
    // CLEARED TO WHITE: packed RGBA depth decodes (1,1,1,1) to ~1.0, the far
    // plane, i.e. "nothing here casts". The renderer's own clear is black at
    // alpha 0, which decodes to depth 0 - a caster in front of everything -
    // and the first cut shaded the whole terrain inside the frustum.
    const pRT = renderer.getRenderTarget(), pAC = renderer.autoClear;
    const pCol = new THREE.Color(), pA = renderer.getClearAlpha();
    { const gc = renderer.getClearColor(pCol); if (gc && gc !== pCol) pCol.copy(gc); }
    renderer.setRenderTarget(FAR.rt);
    renderer.setClearColor(0xffffff, 1);
    renderer.autoClear = true;
    renderer.render(FAR.scene, FAR.cam);
    renderer.setRenderTarget(pRT);
    renderer.setClearColor(pCol, pA);
    renderer.autoClear = pAC;
    FAR.vp.value.multiplyMatrices(FAR.cam.projectionMatrix, FAR.cam.matrixWorldInverse);
    FAR.on.value = 1;
    coverRender(eye);
  };
  const hemiLight = () => {
    const h = new THREE.HemisphereLight(C(RIG.skyCol), C(RIG.gndCol), RIG.hemi * LIGHT_UNIT);
    h.groundColor.multiplyScalar(gb);      // occluded, like every bounce here
    return h;
  };

  // THE HEMISPHERE STAYS OUT HERE, and that is not an oversight — the shed
  // deleted its own at G62.5 for reasons that genuinely do not carry across
  // the door. In the shed EVERYTHING is a MeshStandardMaterial, so
  // scene.environment reaches all of it and models the indirect light
  // properly, with occlusion. Out here the terrain, the trees and the
  // buildings are MeshLambertMaterial, and r128 routes scene.environment to
  // Standard materials ONLY. Delete this light and the whole world loses its
  // ambient at once: every slope facing away from the sun goes black, while
  // the aeroplane — the one Standard thing in the scene — would not change at
  // all. It is the only ambient the world has.
  //
  // WHAT WAS WRONG WITH IT is the ground half, which is the same fault the
  // shed's probe had: a full-strength upward light that nothing can occlude.
  // It is the SECOND uplight on the aeroplane's belly, stacked on the
  // environment's own ground cap above — the two were independent and neither
  // knew about the other. The sky half is untouched.
  const hemi = hemiLight();
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(C(SUNC), RIG.sun * LIGHT_UNIT);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.18;
  { const sc = sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
    sc.near = 20; sc.far = 1500; sc.updateProjectionMatrix(); }
  scene.add(sun); scene.add(sun.target);

  // ---- THE WORLD'S SWITCHBOARD -------------------------------------------
  // The shed has had one since G62.3 and the world has never had anything: no
  // way to ask which source is doing what, and no way to turn any of it off.
  // That is most of why the world's two uplights survived so long — nobody
  // could isolate either one, so nobody could see there were two.
  //
  // Same machinery as the shed's, from LIGHT_RIG, rather than a second copy
  // that drifts. Levels are re-asserted first and the mutes go over the top,
  // which is the ordering the shed learned the hard way: a mute must survive
  // whatever else touches the rig.
  const worldSwitch = (typeof window !== 'undefined' && window.LIGHT_RIG)
    ? window.LIGHT_RIG.board('world') : null;
  if (worldSwitch) {
    worldSwitch
      .declare('sun', 'sun', 'light', () => { sun.intensity = 0; })
      .declare('hemi', 'sky ambient', 'light', () => { hemi.intensity = 0; })
      .declare('env', 'environment (PMREM)', 'env', () => { scene.environment = null; })
      // the dome is a MeshBasicMaterial parented to the CAMERA: unlit, always
      // full brightness, and the last thing left on screen when everything
      // else is off
      .declare('sky', 'the sky dome', 'unlit', () => { if (worldSky) worldSky.visible = false; });
  }
  function applyWorldLights() {
    if (!worldSwitch) return;
    sun.intensity = RIG.sun * LIGHT_UNIT;
    hemi.intensity = RIG.hemi * LIGHT_UNIT;
    scene.environment = envMap;
    if (worldSky) worldSky.visible = true;
    worldSwitch.apply();
  }

  // ================= WHERE THE FOREST IS (W0c.25) =========================
  // ONE predicate, shared by everything that asks. The biome classifier's
  // FOREST_FLOOR is where a forest MAY be; the planter then keeps only the
  // points near a stand tree, off the airfield corridor, outside the
  // aerodromes' exclusion discs, on land above 1.5 m and not under water.
  // The terrain's colour bake and the far canopy mask had asked the
  // classifier alone, so every field classified forest and never planted
  // wore the forest floor's olive - the patches the user kept finding near
  // the strip, "where forest was originally distributed". Now they ask this.
  const treeBins = new Map();               // collidable trees in 128 m bins
  world.trees.forEach((T, i) => {
    const k = Math.floor(T.x / 128) * 4096 + Math.floor(T.z / 128);
    const a = treeBins.get(k); a ? a.push(i) : treeBins.set(k, [i]);
  });
  const nearTree = (x, z) => {              // stands always hold a grid tree < 90 m
    const bx = Math.floor(x / 128), bz = Math.floor(z / 128);
    let best = -1, bd = 8100;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const a = treeBins.get((bx + dx) * 4096 + (bz + dz));
      if (a) for (const ti of a) {
        const T = world.trees[ti];
        const d = (T.x - x) * (T.x - x) + (T.z - z) * (T.z - z);
        if (d < bd) { bd = d; best = ti; }
      }
    }
    return best;
  };
  const treeEx = world.aerodromes.map(a => ({ x: a.x, z: a.z, r2: (a.len / 2 + 70) ** 2 }));
  // ORDERED BY COST (W0c.30): the corridor and the aerodromes are a compare,
  // the woodland bins a few distances, the classifier 2.4 us - and it was
  // first, so the fill's walk paid it on every one of a chunk's 12 544 grid
  // points; most points are not within 90 m of a woodland tree and never
  // reach it now. Same conjunction, same answer.
  // `sc`: the caller's own classification of (x, z) when it has one (the
  // colour bake, LOADING S2) - the classifier is 2.7 us and was asked twice
  const forestHere = (x, z, sc) => {
    if (Math.abs(z) < 90 && x < 200 && x > -3400) return false;   // the corridor
    for (const e of treeEx) if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < e.r2) return false;
    // THE WOODLAND GATE IS THE ANALYTIC WORLD'S (G400): on an island the map
    // says where the forest is, and the sparse collidable woodland (52/km2)
    // would have left the fill as 90 m blobs round single trees - it did
    if (!world.island && nearTree(x, z) < 0) return false;
    if ((sc === undefined ? world.surface(x, z) : sc) !== world.SURFACE.FOREST_FLOOR) return false;
    const h = world.terrainH(x, z);
    return !(h < 1.5 || world.waterH(x, z) > h);
  };

  { // terrain (24 km domain, W6): two-ring mesh — 17.6 m polys over the
    // home ±4500 so river carves resolve, coarse ~100 m strips out to
    // ±12000 (fog caps visibility ~5 km: the far ring only needs
    // silhouette fidelity). Each ring bakes its own colour map from the
    // shared colorAt(); strips tuck 300 m under the inner rim, 2 m low,
    // so the seam never shows a crack.
    // THE DOMAIN IS THE WORLD'S (W2, 2026-09-14): the analytic world's
    // bounds are +-12000 around HOME and every number below is what it was;
    // an island's are its own square, not centred on the origin (HOME is
    // where its strip is cut, not the middle of the map).
    const BX0 = world.bounds.x0, BZ0 = world.bounds.z0;
    const SIZE = world.bounds.x1 - BX0, HALF = SIZE / 2, INNER = 4500;
    const BX1 = BX0 + SIZE, BZ1 = BZ0 + SIZE;
    const hsh = (ix, iz) => { let h = (ix * 374761393 + iz * 668265263 + 1013904223) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    // W8 colour pass: the old DRY band (sandy tan from 90 m up) made the
    // warped uplands read as desert. Uplands now run grass -> olive heath
    // -> dry alpine grass -> rock, with a two-scale vegetation-patch
    // noise breaking the pure altitude banding.
    const MEAD = 0x8d9a54, GRASS = 0x74853c, HEATH = 0x7d8443, ALP = 0x97934f,
          ROCK = 0x857a68, HIGH = 0x6f6a60, SNOW = 0xe9e2d3, SHORE = 0xc9b78c,
          VEGD = 0x5f7034, VEGW = 0xa09a58;
    const vn = (x, z, cell) => {
      const fx = x / cell, fz = z / cell;
      const ix = Math.floor(fx), iz = Math.floor(fz);
      const tx = fx - ix, tz = fz - iz;
      const a = hsh(ix, iz), b = hsh(ix + 1, iz), d = hsh(ix, iz + 1), e2 = hsh(ix + 1, iz + 1);
      return (a * (1 - tx) + b * tx) * (1 - tz) + (d * (1 - tx) + e2 * tx) * tz;
    };
    const c = new THREE.Color(), c2 = new THREE.Color();
    let _h = 0, _low = 0, _for = 0;
    const colorAt = (x, z) => {
      // THE SLOPE STENCIL IS THE CLASSIFIER'S (LOADING S2, G407): +-8 m, not
      // +-16, so the four taps are the same four the biome classifier takes
      // for the same texel and the height memo answers them (20_world.js):
      // nine height samples a texel became five. Measured: the colour bake
      // was 3.7 s of the boot, and the taps were the cost, not the height.
      // A finer stencil reads a hillside a shade rougher; the classifier,
      // the far canopy mask and the tree placement are untouched.
      const h = world.terrainH(x, z), e = 8;
      const slope = Math.min(1, Math.hypot(
        world.terrainH(x + e, z) - world.terrainH(x - e, z),
        world.terrainH(x, z + e) - world.terrainH(x, z - e)) / (2 * e) * 1.15);
      _h = h;
      _low = (1 - Math.min(1, Math.max(0, (h - 55) / 90))) * (1 - Math.min(1, slope * 3.2));
      const veg = vn(x + 31, z + 67, 720) * 0.62 + vn(x + 271, z + 113, 190) * 0.38;
      c.setHex(MEAD).lerp(c2.setHex(GRASS), Math.min(1, Math.max(0, (h - 10) / 90)));
      const vegF = 1 - Math.min(1, Math.max(0, (h - 140) / 120));   // patches fade out by ~260 m
      if (vegF > 0) c.lerp(c2.setHex(veg > 0.5 ? VEGW : VEGD), Math.abs(veg - 0.5) * 0.55 * vegF);
      if (h > 95) c.lerp(c2.setHex(HEATH), Math.min(1, (h - 95) / 140) * 0.85);
      if (h > 150) c.lerp(c2.setHex(ALP), Math.min(1, (h - 150) / 110) * (0.45 + veg * 0.35));
      if (h > 235) c.lerp(c2.setHex(ROCK), Math.min(1, (h - 235) / 140));
      if (h > 400) c.lerp(c2.setHex(HIGH), Math.min(1, (h - 400) / 160));
      // W12 strata banding: alternate 22 m beds darken in the rock zone —
      // matches the stage-5 terrace step, so treads/risers read as strata
      if (h > 190) c.lerp(c2.setHex(0x6b6257), (Math.floor(h / 22) % 2) ? 0.16 : 0.04);
      const snowLine = 470 + slope * 250;
      if (h > snowLine) c.lerp(c2.setHex(SNOW), Math.min(1, (h - snowLine) / 90));
      if (h < 6) c.lerp(c2.setHex(SHORE), Math.min(1, (6 - h) / 8) * 0.85);
      c.lerp(c2.setHex(ROCK), Math.max(0, slope - 0.40) * 1.25 * (h > 60 ? 1 : 0.3));
      // stage-2 biome tint + stage-3 road band (wider than the 3.5 m
      // GRAVEL truth so coarse texels catch it)
      const sc = world.surface(x, z);
      // the forest floor's own colour, and the far tier's mask, only where
      // a forest IS (forestHere): the classifier alone painted the corridor
      _for = (sc === world.SURFACE.FOREST_FLOOR && forestHere(x, z, sc)) ? 1 : 0;
      if (_for) c.lerp(c2.setHex(0x51602f), 0.42);
      else if (sc === world.SURFACE.SAND) c.lerp(c2.setHex(0xcfbe8a), 0.80);
      else if (sc === world.SURFACE.SCREE) c.lerp(c2.setHex(0x8f8570), 0.65);
      if (world.roadNet.roadNear(x, z) < 9) c.lerp(c2.setHex(0xa38b5c), 0.7);
    };
    let forestMask = null;                 // W17 far tier: 512^2 over the domain
    function bakeGround(x0, z0, x1, z1, N, opts) {
      const EXT = x1 - x0;
      const small = document.createElement('canvas'); small.width = small.height = N;
      const sctx = small.getContext('2d'), img = sctx.createImageData(N, N);
      const hG = new Float32Array(N * N), lowG = new Float32Array(N * N);
      const mimg = opts.mini ? sctx.createImageData(N, N) : null;
      const fimg = opts.mask ? sctx.createImageData(N, N) : null;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = x0 + (i + 0.5) / N * EXT, z = z0 + (j + 0.5) / N * EXT;
        colorAt(x, z);
        hG[j * N + i] = _h; lowG[j * N + i] = _low;
        const o = (j * N + i) * 4;
        img.data[o] = c.r * 255; img.data[o+1] = c.g * 255; img.data[o+2] = c.b * 255; img.data[o+3] = 255;
        if (fimg) {                        // W17 far tier: where the canopy goes
          const f = _for ? 255 : 0;
          fimg.data[o] = f; fimg.data[o+1] = f; fimg.data[o+2] = f; fimg.data[o+3] = 255;
        }
        if (mimg) {                        // W13 minimap: same bake, water made visible
          const wet = world.waterH(x, z) > _h - 0.2;
          mimg.data[o]   = wet ? 0x48 : img.data[o];
          mimg.data[o+1] = wet ? 0x89 : img.data[o+1];
          mimg.data[o+2] = wet ? 0x9e : img.data[o+2];
          mimg.data[o+3] = 255;
        }
      }
      sctx.putImageData(img, 0, 0);
      if (fimg) {                          // own canvas: the colour bake below
        const fc = document.createElement('canvas');   // resamples to 2048 and
        fc.width = fc.height = N;                      // paints fields over it
        fc.getContext('2d').putImageData(fimg, 0, 0);
        forestMask = new THREE.CanvasTexture(fc);
      }
      if (mimg) {                        // rivers/roads are sub-texel at ~62 m/px:
        const mc = document.createElement('canvas'); mc.width = mc.height = N;
        const mg = mc.getContext('2d');
        mg.putImageData(mimg, 0, 0);
        const mx = x => (x - x0) / EXT * N, mzz = z => (z - z0) / EXT * N;
        mg.lineCap = mg.lineJoin = 'round';
        mg.strokeStyle = '#4889a1';
        for (const r of world.hydro.rivers) {
          if (r.w < 10 || r.pts.length < 2) continue;
          mg.lineWidth = Math.max(0.7, r.w / EXT * N);
          mg.beginPath();
          r.pts.forEach((p, k) => k ? mg.lineTo(mx(p[0]), mzz(p[1])) : mg.moveTo(mx(p[0]), mzz(p[1])));
          mg.stroke();
        }
        mg.strokeStyle = '#ab8d5f'; mg.lineWidth = 0.7;
        for (const r of world.roadNet.roads) {
          if (r.pts.length < 2) continue;
          mg.beginPath();
          r.pts.forEach((p, k) => k ? mg.lineTo(mx(p[0]), mzz(p[1])) : mg.moveTo(mx(p[0]), mzz(p[1])));
          mg.stroke();
        }
        miniCanvas = mc;
      }
      const TW = 2048, cv = document.createElement('canvas');
      cv.width = cv.height = TW;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(small, 0, 0, TW, TW);
      const px = x => (x - x0) / EXT * TW, pz = z => (z - z0) / EXT * TW;
      const lowAt = (x, z) => {
        const i = Math.min(N-1, Math.max(0, Math.round((x - x0) / EXT * N - 0.5)));
        const j = Math.min(N-1, Math.max(0, Math.round((z - z0) / EXT * N - 0.5)));
        return lowG[j * N + i];
      };
      const FIELDS = ['#8a9a4e', '#c0aa61', '#b0a05e', '#96764f', '#6d8036',
                      '#9aa855', '#a8ab52', '#7e8f42'];
      const CS = 190;
      for (let fz = z0; fz < z1; fz += CS) for (let fx = x0; fx < x1; fx += CS) {
        const cx = fx + CS / 2, cz = fz + CS / 2;
        const low = lowAt(cx, cz);
        if (low < 0.25) continue;
        const strip = (Math.abs(cz) < 110 && cx < 130 && cx > -1180) ? 0 : 1;
        if (!strip) continue;
        // W13: fields only on genuinely flat ground — the altitude/slope
        // `low` gate still let ~20% grades through and hillsides grew odd
        // terraced patchwork. Corner-sample the patch: > 3.2 m of relief
        // across ~160 m kills it, anything close fades.
        const hC = world.terrainH(cx, cz);
        let rel = 0;
        for (const [ox, oz] of [[-80, -80], [80, -80], [-80, 80], [80, 80]])
          rel = Math.max(rel, Math.abs(world.terrainH(cx + ox, cz + oz) - hC));
        if (rel > 3.2) continue;
        const fA = low * (0.55 + 0.45 * (1 - rel / 3.2));
        const ix = Math.round(fx / CS), iz = Math.round(fz / CS);
        const r1 = hsh(ix, iz), r2 = hsh(ix + 91, iz - 13), r3 = hsh(ix - 7, iz + 51);
        const w = CS * (0.80 + r3 * 0.34), d = CS * (0.72 + r2 * 0.42);
        g.save();
        g.translate(px(cx + (r1 - 0.5) * 40), pz(cz + (r2 - 0.5) * 40));
        g.rotate((r3 - 0.5) * 0.5);
        g.globalAlpha = fA * (0.32 + r2 * 0.34);
        g.fillStyle = FIELDS[(r1 * FIELDS.length) | 0];
        const W2 = w / EXT * TW, D2 = d / EXT * TW;
        g.fillRect(-W2/2, -D2/2, W2, D2);
        if (r3 > 0.55) {                       // ploughed furrows
          g.globalAlpha = fA * 0.14;
          g.fillStyle = '#6f5a3e';
          for (let u = -W2/2; u < W2/2; u += 5) g.fillRect(u, -D2/2, 2, D2);
        }
        g.globalAlpha = fA * 0.30;             // hedgerow
        g.strokeStyle = '#55672f'; g.lineWidth = 1.3;
        g.strokeRect(-W2/2, -D2/2, W2, D2);
        g.restore();
      }
      g.globalAlpha = 1;
      if (opts.grain) { // fine speckle so the ground has texture down low
        let seed = 5;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
        for (let k = 0; k < 60000; k++) {
          const u = rnd() * TW, v = rnd() * TW;
          const i = Math.min(N-1, Math.round(u / TW * N)), j = Math.min(N-1, Math.round(v / TW * N));
          if (hG[j * N + i] > 320) continue;
          const t = rnd();
          g.fillStyle = t > 0.5 ? 'rgba(255,246,214,0.10)' : 'rgba(56,66,32,0.11)';
          g.fillRect(u, v, 1 + rnd() * 2.4, 1 + rnd() * 2.4);
        }
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = MAX_ANISO;
      return t;
    }
    // THE ISLAND'S OWN GROUND COLOUR (W2, 2026-09-14 evening): the bench's stack
    // baked by island_prep (unlit), one texture over the whole grid, mapped by
    // world position on both rings. The analytic bake still runs for the
    // forest mask and the minimap; its colours are not drawn on an island.
    const ISLA = world.island && world.island.albedo && world.island.grid ? world.island : null;
    let islandTex = null, islandUV = null;
    if (ISLA) {
      const G = ISLA.grid, n = G.w * G.h, rgba = new Uint8Array(n * 4), src = ISLA.albedo;
      for (let i = 0, j = 0; i < n; i++, j += 4) { rgba[j] = src[i * 3]; rgba[j + 1] = src[i * 3 + 1]; rgba[j + 2] = src[i * 3 + 2]; rgba[j + 3] = 255; }
      islandTex = new THREE.DataTexture(rgba, G.w, G.h, THREE.RGBAFormat, THREE.UnsignedByteType);
      islandTex.colorSpace = THREE.SRGBColorSpace; islandTex.magFilter = islandTex.minFilter = THREE.LinearFilter;
      islandTex.generateMipmaps = false; islandTex.anisotropy = MAX_ANISO; islandTex.flipY = false; islandTex.needsUpdate = true;
      // row 0 of the grid is its north edge (z0): v runs with z, no flip
      islandUV = (x, z) => [(x - G.x0) / (G.w * G.cell), (z - G.z0) / (G.h * G.cell)];
    }

    // ============ THE ISLAND'S GROUND, LIVE (G400, 2026-09-14) ============
    // The bench's stack IN the ground material, on knobs (F8 > environment >
    // ground): the Landsat tint, the radar as an overlay, the canopy
    // normalised as a darkness, the rocky shore off the signed coast, snow
    // above the line, then a lightness and a saturation - the user's "I need
    // to move both the terrain and the trees to see what's best". The baked
    // albedo stays the fallback (and the minimap's). Textures sampled by
    // world position; the tint is sRGB (decoded on sample under r152+).
    const GROUND = { on: false, overlay: 0.75, shade: 0.7, light: 1.0, sat: 1.0, snow: 890, shore: 1.0, mode: 0 };
    // THE STACK (G404, the user: "a way to edit the stack, like I did in the
    // bench - every layer, on/off, blend mode, alpha"): five albedo layers in
    // a fixed order, each with the bench's twelve blend modes and an opacity.
    // The defaults are the bench's (the user's, 2026-09-14): class normal 1 >
    // tint normal 1 > radar overlay 0.75 > canopy shade multiply 0.7 > snow.
    const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'soft light', 'hard light', 'darken', 'lighten', 'add', 'colour', 'luminosity', 'hue'];
    const STACK = [
      { src: 'class', on: 1, mode: 0, op: 1.0 },
      { src: 'tint',  on: 1, mode: 0, op: 1.0 },
      { src: 'radar', on: 1, mode: 3, op: 0.75 },
      { src: 'shade', on: 1, mode: 1, op: 0.7 },
      { src: 'snow',  on: 1, mode: 0, op: 1.0 },
    ];
    try { const sv = JSON.parse(localStorage.getItem('flydiy.ground.stack') || 'null'); if (sv && sv.length === 5) sv.forEach((l, i) => Object.assign(STACK[i], { on: l.on, mode: l.mode, op: l.op })); } catch (e) {}
    // the bench's paint modes, in the game: 0 the stack, then each map alone
    const GROUND_MODES = ['stack', 'tint', 'radar', 'canopy', 'class', 'ndvi', 'coast', 'height', 'snow', 'terrain type', 'lakes'];
    // the class smoothing (the bench's, G405): blur in metres over the weight fields, a smooth wobble of the sample point
    Object.assign(GROUND, { classBlur: 25, edgeWobble: 0, waterMap: (world.island && world.island.hydro === 'proc') ? 0 : 1 });   // ?hydro=proc: the bake's water alone, for a clean A/B
    const gU = {};
    let islandGroundHook = null;
    if (ISLA && ISLA.tint && ISLA.ori1) {
      const G = ISLA.grid, n = G.w * G.h;
      // THE LAYERS PACKED (G424): the six single-channel fields ride two RGBA textures - A = (ori, canopy,
      // coast, lake), B = (ndvi, terrain type, -, -) - so the ground program spends 5 texture units on the
      // island (tint, A, B, W1, W2), not 9. The premises' patch clones this material and adds its own five
      // (the material map + four sets): with nine it FAILED TO LINK on Jolene (17 > MAX_TEXTURE_IMAGE_UNITS
      // 16) and drew nothing; the outer ring's program (the canopy hook's four on top) stood at 16 exactly.
      // The type field was NearestFilter: it is read at the texel centre now (gTT), the same texel exactly.
      const pk4 = (r, g, b, a) => { const d = new Uint8Array(n * 4); for (let k = 0, j = 0; k < n; k++, j += 4) { d[j] = r ? r[k] : 0; d[j + 1] = g ? g[k] : 0; d[j + 2] = b ? b[k] : 255; d[j + 3] = a ? a[k] : 0; }
        const t = new THREE.DataTexture(d, G.w, G.h, THREE.RGBAFormat, THREE.UnsignedByteType);
        t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true; return t; };
      const rgba = new Uint8Array(n * 4);
      for (let i = 0, j = 0; i < n; i++, j += 4) { rgba[j] = ISLA.tint[i * 3]; rgba[j + 1] = ISLA.tint[i * 3 + 1]; rgba[j + 2] = ISLA.tint[i * 3 + 2]; rgba[j + 3] = 255; }
      const tintTex = new THREE.DataTexture(rgba, G.w, G.h, THREE.RGBAFormat, THREE.UnsignedByteType);
      tintTex.colorSpace = THREE.SRGBColorSpace; tintTex.magFilter = tintTex.minFilter = THREE.LinearFilter;
      tintTex.generateMipmaps = false; tintTex.flipY = false; tintTex.anisotropy = MAX_ANISO; tintTex.needsUpdate = true;
      Object.assign(gU, {
        uGTint: { value: tintTex },
        uGPackA: { value: pk4(ISLA.ori1, ISLA.canopy, ISLA.coast, ISLA.lake) },   // a missing coast is 255 (all land), the rest 0
        uGPackB: { value: pk4(ISLA.ndvi, ISLA.ttype, new Uint8Array(n), null) },
        uGGrid: { value: new THREE.Vector4(G.x0, G.z0, G.w * G.cell, G.h * G.cell) },
        uGOverlay: { value: GROUND.overlay }, uGShade: { value: GROUND.shade }, uGLight: { value: GROUND.light },
        uGSat: { value: GROUND.sat }, uGSnow: { value: GROUND.snow }, uGShore: { value: GROUND.shore },
        uGP90: { value: Math.max(4, (ISLA.canopyP90 || 15)) },
        uGMode: { value: 0 }, uGHMax: { value: Math.max(100, ISLA.hMax || 1100) },
        uGBlur: { value: GROUND.classBlur }, uGWobble: { value: GROUND.edgeWobble }, uGWaterMap: { value: GROUND.waterMap }, uGCell: { value: G.cell },
        // the eight class weight fields (the bench's): one-hot per group, LINEAR - a blur of weights is a smooth field
        uGW1: { value: (() => { const w1 = new Uint8Array(n * 4); if (ISLA.cover) { const slot = { 10: 0, 20: 1, 30: 2, 40: 3, 50: 3 }; for (let k = 0; k < n; k++) { const i = slot[ISLA.cover[k]]; if (i !== undefined) w1[k * 4 + i] = 255; } }
          const t = new THREE.DataTexture(w1, G.w, G.h, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true; return t; })() },
        uGW2: { value: (() => { const w2 = new Uint8Array(n * 4); if (ISLA.cover) { const slot = { 60: 0, 80: 1, 90: 2, 100: 3 }; for (let k = 0; k < n; k++) { const i = slot[ISLA.cover[k]]; if (i !== undefined) w2[k * 4 + i] = 255; } }
          const t = new THREE.DataTexture(w2, G.w, G.h, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true; return t; })() },
        uLOn: { value: STACK.map(l => l.on) }, uLMode: { value: STACK.map(l => l.mode) }, uLOp: { value: new Float32Array(STACK.map(l => l.op)) },
      });
      GROUND.on = true;
      islandGroundHook = sh => {
        if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
        Object.assign(sh.uniforms, gU);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWPi;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPi = (modelMatrix * vec4(position, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWPi;\n' +
            'uniform sampler2D uGTint, uGPackA, uGPackB, uGW1, uGW2; uniform vec4 uGGrid;\n' +
            'uniform float uGBlur, uGWobble, uGWaterMap, uGCell;\n' +
            // the packed fields: A = (ori, canopy, coast, lake), B = (ndvi, terrain type); the type at its texel's CENTRE (a nearest read off a linear texture)
            'float gLake(vec2 uv){ return texture2D(uGPackA, uv).a; }\n' +
            'float gTT(vec2 uv){ vec2 gn = uGGrid.zw / uGCell; return texture2D(uGPackB, (floor(uv * gn) + 0.5) / gn).g; }\n' +
            // the class colours, DISTINCT (G405): tree, shrub, grass, crop, built, bare, snow, water, wetland, moss
            'vec3 gClassRow(int i){ if (i == 0) return vec3(0.02,0.45,0.05); if (i == 1) return vec3(0.75,0.55,0.05); if (i == 2) return vec3(0.65,0.95,0.20);\n' +
            '  if (i == 3) return vec3(0.95,0.30,0.75); if (i == 4) return vec3(0.35,0.35,0.35); if (i == 5) return vec3(0.02,0.10,0.95);\n' +
            '  if (i == 6) return vec3(0.15,0.85,0.85); return vec3(0.55,0.15,0.55); }\n' +
            'float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
            'float gVnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n' +
            '  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
            // the class as smooth weight fields, blurred over a ring (the bench's classSmooth)
            'vec3 gClassSmooth(vec2 xz, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5, vec3 c6, vec3 c7){\n' +
            '  vec2 p = xz; if (uGWobble > 0.0) { vec2 q = xz / 45.0; p += (vec2(gVnoise(q), gVnoise(q + 31.0)) - 0.5) * 2.0 * uGWobble; }\n' +
            '  vec2 uv0 = (p - uGGrid.xy) / uGGrid.zw; vec4 A = texture2D(uGW1, uv0) * 2.0, B = texture2D(uGW2, uv0) * 2.0; float ws = 2.0;\n' +
            '  if (uGBlur > 0.5) { for (int k = 0; k < 8; k++) { float an = float(k) * 0.7854; vec2 d = vec2(cos(an), sin(an));\n' +
            '    for (int r = 1; r <= 3; r++) { float w = r == 1 ? 1.0 : (r == 2 ? 0.6 : 0.3); vec2 uv1 = (p + d * uGBlur * float(r) * 0.4 - uGGrid.xy) / uGGrid.zw;\n' +
            '      A += texture2D(uGW1, uv1) * w; B += texture2D(uGW2, uv1) * w; ws += w; } } }\n' +
            '  A /= ws; B /= ws; float tot = A.r + A.g + A.b + A.a + B.r + B.g + B.b + B.a;\n' +
            '  vec3 c = A.r * c0 + A.g * c1 + A.b * c2 + A.a * c3 + B.r * c4 + B.g * c5 + B.b * c6 + B.a * c7;\n' +
            '  return tot > 1e-3 ? c / tot : c0; }\n' +
            // the terrain type palette (G405): sea, lake, heath, muskeg, sand, scree, rock, scrub, forest, snow, built
            'vec3 gTTCol(float c){ int i = int(c + 0.5);\n' +
            '  if (i == 0) return vec3(0.02,0.05,0.30); if (i == 1) return vec3(0.05,0.35,0.95); if (i == 2) return vec3(0.75,0.85,0.25); if (i == 3) return vec3(0.35,0.55,0.15);\n' +
            '  if (i == 4) return vec3(0.95,0.85,0.55); if (i == 5) return vec3(0.55,0.50,0.45); if (i == 6) return vec3(0.30,0.28,0.28); if (i == 7) return vec3(0.60,0.65,0.05);\n' +
            '  if (i == 8) return vec3(0.02,0.35,0.05); if (i == 9) return vec3(0.98,0.98,1.0); return vec3(0.95,0.10,0.10); }\n' +
            'uniform float uGOverlay, uGShade, uGLight, uGSat, uGSnow, uGShore, uGP90, uGHMax; uniform int uGMode;\n' +
            'uniform int uLOn[5]; uniform int uLMode[5]; uniform float uLOp[5];\n' +
            'float gLuma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }\n' +
            'vec3 gBlend(vec3 b, vec3 s, int m){\n' +
            '  if (m == 1) return b * s; if (m == 2) return 1.0 - (1.0 - b) * (1.0 - s);\n' +
            '  if (m == 3) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));\n' +
            '  if (m == 4) return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (sqrt(b) - b), step(0.5, s));\n' +
            '  if (m == 5) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, s));\n' +
            '  if (m == 6) return min(b, s); if (m == 7) return max(b, s); if (m == 8) return b + s;\n' +
            '  if (m == 9) { float lb = gLuma(b), ls = max(gLuma(s), 1e-3); return s * (lb / ls); }\n' +
            '  if (m == 10) { float lb = max(gLuma(b), 1e-3), ls = gLuma(s); return b * (ls / lb); }\n' +
            '  if (m == 11) { float lb = gLuma(b), ls = max(gLuma(s), 1e-3); return mix(vec3(lb), s * (lb / ls), 0.7); }\n' +
            '  return s; }\n' +
            'vec3 gClassCol(float c){ if (abs(c-10.0)<0.5) return vec3(0.06,0.20,0.06); if (abs(c-20.0)<0.5) return vec3(0.28,0.31,0.10);\n' +
            '  if (abs(c-30.0)<0.5) return vec3(0.36,0.41,0.12); if (abs(c-50.0)<0.5) return vec3(0.35,0.20,0.20); if (abs(c-60.0)<0.5) return vec3(0.28,0.25,0.22);\n' +
            '  if (abs(c-80.0)<0.5) return vec3(0.02,0.06,0.20); if (abs(c-90.0)<0.5) return vec3(0.16,0.28,0.16); if (abs(c-100.0)<0.5) return vec3(0.38,0.36,0.15); return vec3(0.2); }')
          .replace('#include <map_fragment>', '#include <map_fragment>\n' +
            '{ vec2 guv = (vWPi.xz - uGGrid.xy) / uGGrid.zw;\n' +
            '  vec3 tint = texture2D(uGTint, guv).rgb;\n' +
            '  float lsd = (gLake(guv) * 255.0 - 128.0) * 4.0;\n' +
            // THE SHORE IS A MIXED PIXEL (G406): a 30 m Landsat texel over a 20 m pond is half
            // water, dark; within 45 m of a lake edge the tint is taken from 45 m further out
            // (the field's own gradient says which way out is)
            '  if (lsd > -45.0 && lsd <= 0.0) { vec2 e = vec2(10.0 / uGGrid.z, 10.0 / uGGrid.w);\n' +
            '    vec2 gr = vec2(gLake(guv + vec2(e.x, 0.0)) - gLake(guv - vec2(e.x, 0.0)), gLake(guv + vec2(0.0, e.y)) - gLake(guv - vec2(0.0, e.y)));\n' +
            '    if (dot(gr, gr) > 1e-10) { vec2 outw = -normalize(gr) * vec2(45.0 / uGGrid.z, 45.0 / uGGrid.w);\n' +
            '      tint = mix(tint, texture2D(uGTint, guv + outw).rgb, smoothstep(-45.0, 0.0, lsd)); } }\n' +
            '  vec4 gA = texture2D(uGPackA, guv);\n' +
            '  float r1 = gA.r;\n' +
            '  float can = gA.g * 255.0;\n' +
            // SNOW SHEDS OFF STEEP GROUND (G409, the user): full below 25 deg, none by 40
            // (`normal` is not yet defined at map_fragment: the slope comes from the world position's screen derivatives)
            '  vec3 gN = normalize(cross(dFdx(vWPi), dFdy(vWPi))); gN *= sign(gN.y);\n' +
            '  float gSlope = acos(clamp(gN.y, 0.0, 1.0));\n' +
            '  float snowA = smoothstep(uGSnow - 60.0, uGSnow + 60.0, vWPi.y) * (1.0 - smoothstep(0.436, 0.698, gSlope));\n' +
            '  vec3 t = vec3(0.5);\n' +
            '  for (int i = 0; i < 5; i++) {\n' +
            '    if (uLOn[i] == 0) continue;\n' +
            '    vec3 s; float a = 1.0;\n' +
            '    if (i == 0) s = gClassSmooth(vWPi.xz, vec3(0.06,0.20,0.06), vec3(0.28,0.31,0.10), vec3(0.36,0.41,0.12), vec3(0.35,0.20,0.20), vec3(0.28,0.25,0.22), vec3(0.02,0.06,0.20), vec3(0.16,0.28,0.16), vec3(0.38,0.36,0.15));\n' +
            '    else if (i == 1) s = tint;\n' +
            '    else if (i == 2) s = vec3(r1);\n' +
            '    else if (i == 3) s = vec3(1.0 - 0.45 * clamp(can / uGP90, 0.0, 1.2));\n' +
            '    else { s = vec3(0.85, 0.88, 0.95); a = snowA; }\n' +
            '    t = mix(t, gBlend(t, s, uLMode[i]), uLOp[i] * a);\n' +
            '  }\n' +
            '  float sd = (gA.b * 255.0 - 128.0) * 4.0;\n' +
            // (G413: the paint is the BED under the surface, inside the line only - a deep rim
            // outside the surface's edge was the "deep blue vs pale blue battle")
            '  if (uGWaterMap > 0.5 && lsd > -1.0) t = mix(t, vec3(0.05, 0.17, 0.24), smoothstep(-1.0, 3.0, lsd));\n' +
            '  vec3 rock = vec3(0.27, 0.25, 0.20) * (0.75 + 0.5 * r1);\n' +
            '  t = mix(t, rock, smoothstep(16.0, 0.0, sd) * 0.8 * uGShore);\n' +
            // below the waterline the ground IS water-coloured, so a polygon that
            // straddles the shore never shows a seabed above the water plane
            '  if (sd < 0.0) t = mix(vec3(0.07, 0.24, 0.27), vec3(0.044, 0.21, 0.31), smoothstep(0.0, 300.0, -sd));\n' +
            '  float gl = dot(t, vec3(0.299, 0.587, 0.114));\n' +
            '  t = mix(vec3(gl), t, uGSat) * uGLight;\n' +
            '  if (uGMode == 1) t = texture2D(uGTint, guv).rgb;\n' +
            '  else if (uGMode == 2) t = vec3(r1 * r1);\n' +
            // canopy: zero is dark grey, then a blue -> cyan -> green -> yellow -> red scale to the p90 x 1.5
            '  else if (uGMode == 3) { float u = clamp(can / (uGP90 * 1.5), 0.0, 1.0);\n' +
            '    vec3 sc = u < 0.25 ? mix(vec3(0.05,0.05,0.9), vec3(0.05,0.8,0.9), u * 4.0) : u < 0.5 ? mix(vec3(0.05,0.8,0.9), vec3(0.05,0.85,0.1), (u - 0.25) * 4.0)\n' +
            '      : u < 0.75 ? mix(vec3(0.05,0.85,0.1), vec3(0.95,0.9,0.05), (u - 0.5) * 4.0) : mix(vec3(0.95,0.9,0.05), vec3(0.95,0.05,0.05), (u - 0.75) * 4.0);\n' +
            '    t = can < 0.5 ? vec3(0.12) : sc; }\n' +
            '  else if (uGMode == 4) t = gClassSmooth(vWPi.xz, gClassRow(0), gClassRow(1), gClassRow(2), gClassRow(3), gClassRow(4), gClassRow(5), gClassRow(6), gClassRow(7));\n' +
            // NDVI: water/rock blue-grey below 0.2, brown 0.2-0.4, yellow-green 0.4-0.6, deep green above
            '  else if (uGMode == 5) { float nd = texture2D(uGPackB, guv).r * 2.0 - 1.0;\n' +
            '    t = nd < 0.2 ? vec3(0.35,0.40,0.55) : nd < 0.4 ? mix(vec3(0.55,0.35,0.15), vec3(0.85,0.75,0.25), (nd - 0.2) * 5.0) : nd < 0.6 ? mix(vec3(0.85,0.75,0.25), vec3(0.35,0.75,0.10), (nd - 0.4) * 5.0) : mix(vec3(0.35,0.75,0.10), vec3(0.02,0.35,0.02), clamp((nd - 0.6) * 3.0, 0.0, 1.0)); }\n' +
            '  else if (uGMode == 9) t = gTTCol(gTT(guv) * 255.0);\n' +
            '  else if (uGMode == 10) t = lsd > 0.0 ? mix(vec3(0.3,0.6,1.0), vec3(0.02,0.1,0.6), clamp(lsd / 200.0, 0.0, 1.0)) : vec3(0.85);\n' +
            '  else if (uGMode == 6) t = sd < 0.0 ? vec3(0.02, 0.05, 0.25) * clamp(-sd / 400.0, 0.1, 1.0) : mix(vec3(0.5, 0.45, 0.3), vec3(0.05, 0.2, 0.05), clamp(sd / 400.0, 0.0, 1.0));\n' +
            '  else if (uGMode == 7) { float hh = clamp(vWPi.y / uGHMax, 0.0, 1.0); t = mix(mix(vec3(0.02,0.15,0.03), vec3(0.45,0.40,0.18), min(1.0, hh*1.6)), vec3(0.9), max(0.0, hh-0.6)*2.5); }\n' +
            '  else if (uGMode == 8) t = mix(vec3(0.05), vec3(0.9), snowA);\n' +
            '  diffuseColor.rgb = t; }');
      };
    }
    groundApi = {
      on: () => GROUND.on,
      get: () => Object.assign({}, GROUND),
      modes: () => GROUND_MODES.slice(),
      blends: () => BLENDS.slice(),
      stack: () => STACK.map(l => Object.assign({}, l)),
      setLayer: (i, o) => { const l = STACK[i]; if (!l) return null; Object.assign(l, o);
        if (gU.uLOn) { gU.uLOn.value[i] = l.on ? 1 : 0; gU.uLMode.value[i] = l.mode | 0; gU.uLOp.value[i] = +l.op; }
        try { localStorage.setItem('flydiy.ground.stack', JSON.stringify(STACK)); } catch (e) {}
        return Object.assign({}, l); },
      set: o => { for (const k in o) if (k in GROUND && k !== 'on') { GROUND[k] = +o[k];
        const u = { overlay: 'uGOverlay', shade: 'uGShade', light: 'uGLight', sat: 'uGSat', snow: 'uGSnow', shore: 'uGShore', mode: 'uGMode',
                    classBlur: 'uGBlur', edgeWobble: 'uGWobble', waterMap: 'uGWaterMap' }[k];
        if (u && gU[u]) gU[u].value = GROUND[k]; } return groundApi.get(); },
    };
    const tex = islandTex || bakeGround(-INNER, -INNER, INNER, INNER, 512, { grain: true });
    const outerBake = bakeGround(BX0, BZ0, BX1, BZ1, 512, { mini: true, mask: true });
    const outerTex = islandTex || outerBake;
    outerTexShared = outerTex;

    const geo = new THREE.PlaneGeometry(2 * INNER, 2 * INNER, 512, 512);
    geo.rotateX(-Math.PI / 2);
    const posA = geo.attributes.position;
    for (let i = 0; i < posA.count; i++)
      posA.setY(i, world.terrainH(posA.getX(i), posA.getZ(i)));
    if (islandUV) { const uvA = geo.attributes.uv;
      for (let i = 0; i < posA.count; i++) { const t = islandUV(posA.getX(i), posA.getZ(i)); uvA.setXY(i, t[0], t[1]); } }
    geo.computeVertexNormals();
    groundGeos.push(geo);
    // close-range detail: fine tiling grain multiplied in, faded out with distance
    const dn = document.createElement('canvas'); dn.width = dn.height = 256;
    { const dg = dn.getContext('2d');
      let sd = 17;
      const rn = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
      dg.fillStyle = 'rgb(122,120,112)'; dg.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 2600; k++) {                 // clumps of grass tone
        const x = rn() * 256, y = rn() * 256, r = 2 + rn() * 11, t = rn();
        dg.fillStyle = t > 0.5
          ? 'rgba(196,186,150,' + (0.05 + rn() * 0.16) + ')'
          : 'rgba(52,58,34,' + (0.05 + rn() * 0.16) + ')';
        dg.beginPath(); dg.ellipse(x, y, r, r * (0.5 + rn()), rn() * 3.14, 0, 6.283); dg.fill();
        if (x < r || x > 256 - r) { dg.beginPath();
          dg.ellipse(x < r ? x + 256 : x - 256, y, r, r, 0, 0, 6.283); dg.fill(); }
        if (y < r || y > 256 - r) { dg.beginPath();
          dg.ellipse(x, y < r ? y + 256 : y - 256, r, r, 0, 0, 6.283); dg.fill(); }
      }
    }
    const dtex = new THREE.CanvasTexture(dn);
    dtex.wrapS = dtex.wrapT = THREE.RepeatWrapping;
    // ---- W17 far tier: the forest as texture, not geometry -----------------
    // Past the impostor band there is no tree geometry at all; the ground wears
    // a tiling crown pattern instead, masked to the stage-2 FOREST_FLOOR bake
    // and faded in exactly where the impostors fade out. It is a MULTIPLIER
    // with mean 0.5 (hence the x2): the W8 palette and the biome tint still own
    // the colour, this only supplies the broken-up crown texture that a flat
    // green hillside at 3 km was missing.
    const cnp = document.createElement('canvas'); cnp.width = cnp.height = 256;
    { const cg2 = cnp.getContext('2d');
      let sd = 91;
      const rn = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
      cg2.fillStyle = 'rgb(118,124,110)'; cg2.fillRect(0, 0, 256, 256);
      // ~7 m crowns at the 80 m tile below; drawn twice, dark bed then lit tops,
      // so the pattern reads as canopy relief rather than noise
      for (const [pass, n] of [[0, 260], [1, 220]])
        for (let k = 0; k < n; k++) {
          const x = rn() * 256, y = rn() * 256, r = (pass ? 5 : 9) + rn() * (pass ? 6 : 9);
          cg2.fillStyle = pass
            ? 'rgba(196,198,150,' + (0.06 + rn() * 0.20) + ')'
            : 'rgba(38,46,28,' + (0.06 + rn() * 0.22) + ')';
          for (const [wx, wy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
            if (wx && Math.min(x, 256 - x) > r) continue;      // wrap only at the seam
            if (wy && Math.min(y, 256 - y) > r) continue;
            cg2.beginPath();
            cg2.ellipse(x + wx, y + wy - (pass ? r * 0.35 : 0), r, r * (0.72 + rn() * 0.4),
                        rn() * 3.14, 0, 6.283);
            cg2.fill();
          }
        }
    }
    const cnpTex = new THREE.CanvasTexture(cnp);
    cnpTex.wrapS = cnpTex.wrapT = THREE.RepeatWrapping;
    // Both ground materials get it, and both look the mask up from WORLD
    // position rather than their own uv — the inner mesh and the outer ring
    // have completely different uv layouts, and the mask is one domain-wide bake.
    const canopyHook = sh => {
      if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
      sh.uniforms.uFMask = { value: forestMask };
      sh.uniforms.uCanopy = { value: cnpTex };
      sh.uniforms.uFloor = uFloor; sh.uniforms.uFloorLod = uFloorLod; sh.uniforms.uFloorEdge = uFloorEdge;
      sh.uniforms.uFarOn = FAR.on; sh.uniforms.uFarMap = FAR.map; sh.uniforms.uFarVP = FAR.vp;
      sh.uniforms.uCovOn = COVER.on; sh.uniforms.uCovMap = COVER.map; sh.uniforms.uCovVP = COVER.vp;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying float vCD;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n' +
          'vWP = (modelMatrix * vec4(position, 1.0)).xyz;\nvCD = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader
        // <packing> by hand: r186's Lambert no longer includes it, and the far
        // cascade below unpacks the depth it wrote (W0.5a)
        .replace('#include <common>', '#include <common>\n#include <packing>\nuniform sampler2D uFMask;\n' +
          'uniform sampler2D uCanopy;\nuniform float uFloor, uFloorLod, uFloorEdge;\nvarying vec3 vWP;\nvarying float vCD;\n' +
          'uniform float uFarOn;\nuniform sampler2D uFarMap;\nuniform mat4 uFarVP;\n' +
          'uniform float uCovOn;\nuniform sampler2D uCovMap;\nuniform mat4 uCovVP;')
        // the far cascade, on the direct term only: four taps of packed depth
        .replace('#include <lights_fragment_end>',
          '#include <lights_fragment_end>\n' +
          'if (uFarOn > 0.5) {\n' +
          '  vec4 fc = uFarVP * vec4(vWP, 1.0);\n' +
          '  vec3 fp = fc.xyz / fc.w * 0.5 + 0.5;\n' +
          '  if (fp.x > 0.0 && fp.x < 1.0 && fp.y > 0.0 && fp.y < 1.0 && fp.z < 1.0) {\n' +
          '    float tx = 1.0 / 2048.0, zb = fp.z - 0.0004, lit = 0.0;\n' +
          '    lit += step(zb, unpackRGBAToDepth(texture2D(uFarMap, fp.xy + vec2(-0.5, -0.5) * tx)));\n' +
          '    lit += step(zb, unpackRGBAToDepth(texture2D(uFarMap, fp.xy + vec2( 0.5, -0.5) * tx)));\n' +
          '    lit += step(zb, unpackRGBAToDepth(texture2D(uFarMap, fp.xy + vec2(-0.5,  0.5) * tx)));\n' +
          '    lit += step(zb, unpackRGBAToDepth(texture2D(uFarMap, fp.xy + vec2( 0.5,  0.5) * tx)));\n' +
          '    reflectedLight.directDiffuse *= 0.25 * lit;\n' +
          '  }\n' +
          '}')
        .replace('#include <map_fragment>', '#include <map_fragment>\n' +
          // same uv convention as the outer ring's own texture: v runs the other
          // way down z, and the mask canvas is built in that same pass
          'float fM = texture2D(uFMask, vec2((vWP.x - (' + BX0.toFixed(1) + ')) / ' + SIZE.toFixed(1) + ',\n' +
          '                                  1.0 - (vWP.z - (' + BZ0.toFixed(1) + ')) / ' + SIZE.toFixed(1) + ')).r;\n' +
          // Full strength by the time the last impostor has shrunk away, and
          // nothing before they start shrinking — otherwise the two tiers
          // darken the same hillside twice through the whole overlap.
          'float fFar = fM * smoothstep(' + (FAR_FILL - FAR_FADE).toFixed(1) + ', ' +
            FAR_FILL.toFixed(1) + ', vCD);\n' +
          'vec3 cC = texture2D(uCanopy, vWP.xz * 0.0125).rgb;\n' +
          // 1.45, not the 2.0 that would preserve the mean: a canopy is not
          // just texture on grass, it is DARKER than the grass it stands on,
          // and a mean-preserving multiply left the 3 km hills reading as
          // pasture next to the geometry they replaced.
          'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * cC * 1.45, fFar);\n' +
          // the floor under the near canopy, handing over to the far tier
          // the floor under the crowns that ARE there: the canopy map's
          // coverage, nine taps two texels apart, so the edge of a crown's
          // shade is a couple of metres wide. Nothing outside its range: a
          // classified-but-unplanted field must never darken again.
          'if (uCovOn > 0.5) {\n' +
          '  vec4 cc = uCovVP * vec4(vWP, 1.0);\n' +
          '  vec2 cp = cc.xy / cc.w * 0.5 + 0.5;\n' +
          '  if (cp.x > 0.0 && cp.x < 1.0 && cp.y > 0.0 && cp.y < 1.0) {\n' +
          // sixteen taps over ±6 m: the shade reaches half a crown past the
          // crown, which is what anchors a stand's edge and darkens a gap
          // one tap three and a half levels down (~11 m texels): the blur
          // that carries a stand's shade a crown past its edge, so the
          // floor reads as a floor from the air and not as a rim
          // shaped: the blurred coverage of a real stand is 0.4-0.8, and the
          // dial's darkening must reach ALL of it under any canopy - so a
          // cover of a third is already full shade, and the edge's ramp is
          // what remains of the blur
          '    float cov = smoothstep(0.03, uFloorEdge, texture2D(uCovMap, cp, uFloorLod).r);\n' +
          '    diffuseColor.rgb *= mix(1.0, uFloor, cov * (1.0 - fFar));\n' +
          '  }\n' +
          '}');
    };
    // shared close-range grain hook (W13.2): uvScale sets tiles/uv-unit so
    // materials with different uv extents get the same on-ground density
    detailApply = (mat, uvScale) => { mat.onBeforeCompile = sh => {
      if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
      sh.uniforms.uDetail = { value: dtex };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDUv;\nvarying float vDist;')
        .replace('#include <project_vertex>',
          '#include <project_vertex>\nvDUv = uv * ' + uvScale.toFixed(1) + ';\nvDist = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>',
          '#include <common>\nuniform sampler2D uDetail;\nvarying vec2 vDUv;\nvarying float vDist;')
        .replace('#include <map_fragment>',
          '#include <map_fragment>\nfloat dF = 1.0 - smoothstep(60.0, 500.0, vDist);\n' +
          'vec3 dC = texture2D(uDetail, vDUv).rgb;\n' +
          'diffuseColor.rgb *= mix(vec3(1.0), dC * 2.08, dF * 0.62);\n' +
          'float dF2 = 1.0 - smoothstep(15.0, 150.0, vDist);\n' +
          'vec3 dC2 = texture2D(uDetail, vDUv * 6.31).rgb;\n' +
          'diffuseColor.rgb *= mix(vec3(1.0), dC2 * 2.08, dF2 * 0.5);');
    }; };
    const gMat = worldLambert({ map: tex });
    innerPatchShared = { mat: gMat, half: INNER, uv: islandUV || ((x, z) => [(x + INNER) / (2 * INNER), 1 - (z + INNER) / (2 * INNER)]) };
    // the close grain is the analytic ground's; an island's ground is the live stack
    if (islandGroundHook) gMat.onBeforeCompile = islandGroundHook;
    else gMat.onBeforeCompile = sh => {
      if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
      sh.uniforms.uDetail = { value: dtex };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDUv;\nvarying float vDist;')
        .replace('#include <project_vertex>',
          '#include <project_vertex>\nvDUv = uv * 230.0;\nvDist = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>',
          '#include <common>\nuniform sampler2D uDetail;\nvarying vec2 vDUv;\nvarying float vDist;')
        .replace('#include <map_fragment>',
          '#include <map_fragment>\nfloat dF = 1.0 - smoothstep(60.0, 500.0, vDist);\n' +
          'vec3 dC = texture2D(uDetail, vDUv).rgb;\n' +
          'diffuseColor.rgb *= mix(vec3(1.0), dC * 2.08, dF * 0.62);\n' +
          // W13 second octave: same grain re-sampled ~6x finer, fading in
          // over the last ~150 m — flare-height ground stops looking flat
          'float dF2 = 1.0 - smoothstep(15.0, 150.0, vDist);\n' +
          'vec3 dC2 = texture2D(uDetail, vDUv * 6.31).rgb;\n' +
          'diffuseColor.rgb *= mix(vec3(1.0), dC2 * 2.08, dF2 * 0.5);');
      canopyHook(sh);                      // far tier, over the same includes
    };
    const ground = new THREE.Mesh(geo, gMat);
    ground.receiveShadow = true;
    scene.add(ground);

    if (world.island && world.island.farRoot) {
      // THE FAR TERRAIN IS THE ASSET (G400, the user: "don't hide terrain
      // geometry in a flight game ... some trees are not on the ground"): the
      // four 160 m strips cut every ridge the trees stood on. Every leaf of
      // the eps-4 quadtree outside the inner ring, merged into meshes by
      // quadrant (frustum-culled as sixteen), wearing the ground material;
      // under the inner ring's rim the leaves dip 1.5 m so the two never fight.
      const oMat = worldLambert({ map: outerTex });
      oMat.onBeforeCompile = islandGroundHook ? (sh => { canopyHook(sh); islandGroundHook(sh); }) : canopyHook;
      outerMatShared = oMat;
      const FH = world.island.farHeader, N = FH.patch + 1, Pn = FH.patch;
      const groups = new Map();
      const leafIdx = []; for (let j = 0; j < Pn; j++) for (let i = 0; i < Pn; i++) { const a = j * N + i; leafIdx.push(a, a + N, a + 1, a + 1, a + N, a + N + 1); }
      (function walkQ(n) {
        if (n.kids) { n.kids.forEach(walkQ); return; }
        const s = FH.side / (1 << n.d), step = s / Pn;
        const ox = FH.bounds.x0 + n.ix * s, oz = FH.bounds.z0 + n.iz * s;
        if (ox > -INNER + 250 && ox + s < INNER - 250 && oz > -INNER + 250 && oz + s < INNER - 250) return;   // fully under the inner ring
        const qs = FH.side / 4, key = Math.floor((ox + s / 2 - FH.bounds.x0) / qs) + ',' + Math.floor((oz + s / 2 - FH.bounds.z0) / qs);
        let g = groups.get(key); if (!g) groups.set(key, g = { pos: [], uv: [], idx: [], base: 0 });
        const seaFloor = world.island.seaFloor;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const x = ox + i * step, z = oz + j * step; let y = n.h[j * N + i];
          // the asset's sea is the DEM's 0, ABOVE the water plane: the far
          // mesh takes the island's shelf like the sampler does (G402 - the
          // painted floor had shown over the plane as "a different tile")
          if (seaFloor) { const sd = world.island.coastAt(x, z); if (sd < 0) y = Math.min(y, seaFloor(sd)); }
          const din = Math.max(Math.abs(x), Math.abs(z));
          if (din < INNER) y -= 1.5 * Math.min(1, (INNER - din) / 200);
          g.pos.push(x, y, z);
          const t = islandUV ? islandUV(x, z) : [(x - BX0) / SIZE, 1 - (z - BZ0) / SIZE]; g.uv.push(t[0], t[1]);
        }
        for (const k of leafIdx) g.idx.push(g.base + k);
        g.base += N * N;
      })(world.island.farRoot);
      let farTris = 0;
      for (const g of groups.values()) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
        geo.setIndex(g.idx); geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, oMat); m.receiveShadow = true; scene.add(m);
        farTris += g.idx.length / 3;
      }
      console.log('island far terrain: ' + groups.size + ' meshes, ' + (farTris / 1e6).toFixed(1) + ' M tris');
    } else { // outer ring: four coarse strips sharing one full-domain texture
      const oMat = worldLambert({ map: outerTex });
      oMat.onBeforeCompile = islandGroundHook ? (sh => { canopyHook(sh); islandGroundHook(sh); }) : canopyHook;   // the far tier lives mostly out here
      outerMatShared = oMat;
      const strip = (x0, z0, x1, z1, sx, sz) => {
        const g2 = new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz);
        g2.rotateX(-Math.PI / 2);
        g2.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
        const p = g2.attributes.position, uv = g2.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          p.setY(i, world.terrainH(x, z) - 2);
          if (islandUV) { const t = islandUV(x, z); uv.setXY(i, t[0], t[1]); }
          else uv.setXY(i, (x - BX0) / SIZE, 1 - (z - BZ0) / SIZE);
        }
        g2.computeVertexNormals();
        const m = new THREE.Mesh(g2, oMat);
        m.receiveShadow = true;
        scene.add(m);
      };
      const OV = 4200;                  // tuck under the inner rim
      strip(BX0, BZ0, BX1, -OV, 240, 78);
      strip(BX0, OV, BX1, BZ1, 240, 78);
      strip(BX0, -OV, -OV, OV, 78, 84);
      strip(OV, -OV, BX1, OV, 78, 84);
    }

    const waterMat = new THREE.MeshStandardMaterial({
      color: C(0x3a7e96), roughness: 0.16, metalness: 0.0, side: THREE.DoubleSide });
    // INFINITE WATER ON AN ISLAND (G402, the user): the plane ran to the domain's
    // edge and the dome's ground showed past it as another sea. 400 km is the
    // horizon from any height this game flies; the logarithmic depth buffer
    // does not mind the size
    const WSZ = world.island ? 400000 : SIZE;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(WSZ, WSZ), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.set((BX0 + BX1) / 2, -0.4, (BZ0 + BZ1) / 2);
    scene.add(water);
    // THE NEAR SEA MOVES (H4, G393; before the water shader, ruling at's
    // carve-out): a 360 m patch of the sea around the aeroplane, its
    // vertices displaced every frame by the world's OWN waterH(x, z, t) —
    // the function the floats are pushed by — so the hull sits in the
    // wave it is drawn in. Shown only with a sea state (the flat far sea
    // stays as it was, 0.4 m under the true level, on a calm day); the
    // patch is snapped to its own grid step so it does not swim.
    const SEAN = 96, SEAW = 360;
    const seaGeo = new THREE.PlaneGeometry(SEAW, SEAW, SEAN, SEAN);
    seaGeo.rotateX(-Math.PI / 2);
    const seaNear = new THREE.Mesh(seaGeo, waterMat);
    seaNear.frustumCulled = false; seaNear.visible = false;
    scene.add(seaNear);
    // THE SEA LANE IS MARKED (G396.2; the user: "we need to visualize the
    // limits and the touchdown points"). Buoys on the water: orange every
    // 100 m down both edges of every water aerodrome, a white pair across
    // the lane at each end, a green pair at the touchdown target. They
    // ride the waves (their y is the same waterH the floats read), so
    // they are also the calm day's water line — the one thing on a flat
    // sea that says where the surface is.
    const buoys = [];
    {
      const geoB = new THREE.SphereGeometry(0.9, 12, 8);
      const matOf = {};
      const mat = hex => matOf[hex] || (matOf[hex] = new THREE.MeshStandardMaterial({ color: C(hex), emissive: C(hex), emissiveIntensity: 0.25, roughness: 0.6 }));
      const put = (x, z, hex, r) => { const m = new THREE.Mesh(geoB, mat(hex)); if (r) m.scale.setScalar(r); m.position.set(x, 0, z); m.castShadow = false; scene.add(m); buoys.push(m); };
      for (const a of (world.aerodromes || [])) {
        if (a.kind !== 'water') continue;
        const ca = Math.cos(a.hdg), sa = Math.sin(a.hdg);        // along the lane: (ca, sa) in x,z
        const along = (s, w) => [a.x + s * ca - w * sa, a.z + s * sa + w * ca];
        const half = a.len / 2, hw = a.wid / 2;
        for (let s = -half; s <= half + 1e-6; s += 100) for (const w of [-hw, hw]) { const [x, z] = along(s, w); put(x, z, 0xff6a00); }
        for (const s of [-half, half]) for (const w of [-hw * 0.5, 0, hw * 0.5]) { const [x, z] = along(s, w); put(x, z, 0xf4f2ea, 1.6); }
        if (a.tdz) for (const w of [-hw, -hw * 0.5, hw * 0.5, hw]) { const dx = a.tdz[0] - a.x, dz = a.tdz[1] - a.z; const st = dx * ca + dz * sa; const [tx, tz] = along(st, w); put(tx, tz, 0x35c46a, 1.6); }
      }
    }
    let seaT = 0;
    function seaUpdate(cx, cz, dt) {
      const S = world.sea;
      seaT += dt;
      // the buoys ride the wave (and mark the level on a calm day)
      for (const b of buoys) { if (Math.abs(b.position.x - cx) > 900 || Math.abs(b.position.z - cz) > 900) continue; b.position.y = (S && S.A > 0 ? world.waterH(b.position.x, b.position.z, seaT) : 0) + 0.15; }
      // THE NEAR SEA IS AT THE TRUE LEVEL, WAVES OR NOT (G396.2; the user:
      // "it's important that we get the water line right"): the far flat
      // sea sits 0.4 m under it (the shore seam), so on a calm day the
      // floats read 0.4 m too high against the water they were drawn on.
      // The patch stays around the aeroplane, flat at 0 in calm, displaced
      // by the wave otherwise.
      if (world.waterH(cx, cz) !== 0) { seaNear.visible = false; return; }
      const step = SEAW / SEAN;
      const ox = Math.round(cx / step) * step, oz = Math.round(cz / step) * step;
      seaNear.position.set(ox, 0.0, oz);
      const pa = seaGeo.attributes.position;
      const waves = !!(S && S.A > 0);
      if (waves || seaNear.userData.wavy !== false) {
        for (let i = 0; i < pa.count; i++) pa.setY(i, waves ? world.waterH(pa.getX(i) + ox, pa.getZ(i) + oz, seaT) : 0);
        pa.needsUpdate = true;
        seaGeo.computeVertexNormals();
        seaNear.userData.wavy = waves;
      }
      seaNear.visible = true;
    }

    { // stage-1 water: river ribbons + per-cell lake quads at their baked
      // surface heights, one merged mesh, same material as the sea.
      // Edges are trimmed by terrain intersection — ribbons overshoot into
      // the banks (0.62w vs 0.5w wet width) and lake cells grow skirts on
      // their non-lake sides, so the visible waterline is the smooth
      // terrain/water intersection, not the 23 m cell outline.
      const pos = [], idx = [];
      const quad = (x0, z0, x1, z1, y) => {
        const b = pos.length / 3;
        pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
        idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      };
      // renderer-side corner smoothing (Chaikin, cut capped at 0.5w so the
      // ribbon never wanders out of the carved channel — the carve SDF
      // follows the RAW polyline, which stays the data truth)
      const smooth = (r) => {
        let pts = r.pts, ws = r.ws;
        const cap = r.w * 0.5;
        for (let round = 0; round < 2; round++) {
          const np = [pts[0]], nw = [ws[0]];
          for (let i = 0; i + 1 < pts.length; i++) {
            const a = pts[i], b = pts[i + 1];
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const t = Math.min(0.25, cap / L);
            np.push([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t],
                    [a[0] * t + b[0] * (1 - t), a[1] * t + b[1] * (1 - t)]);
            nw.push(ws[i] * (1 - t) + ws[i + 1] * t, ws[i] * t + ws[i + 1] * (1 - t));
          }
          np.push(pts[pts.length - 1]); nw.push(ws[ws.length - 1]);
          pts = np; ws = nw;
        }
        return [pts, ws];
      };
      // reaches are constant-width and lake-chopped into short stubs — a
      // raw render steps in width at every stub boundary. Match each
      // reach's head to the nearest upstream tail (lakes sit between, so
      // the match is loose) and taper the width along the reach.
      const RV = world.hydro.rivers;
      const wHead = new Map();
      for (const b of RV) {
        let bestW = b.w, bestD = 160;
        for (const a of RV) {
          if (a === b) continue;
          const ta = a.pts[a.pts.length - 1], hb = b.pts[0];
          const d = Math.hypot(ta[0] - hb[0], ta[1] - hb[1]);
          if (d < bestD) { bestD = d; bestW = a.w; }
        }
        wHead.set(b, bestW);
      }
      for (const r of RV) {
        // creeks under ~12 m stay carved-but-dry: below the terrain mesh
        // resolution they render as broken puddle chains, worse than dry
        if (r.w < 12 || r.pts.length < 2) continue;
        const [spts, sws] = smooth(r);
        const h0w = Math.min(wHead.get(r), r.w) * 0.62, h1w = r.w * 0.62;
        const base = pos.length / 3;
        for (let i = 0; i < spts.length; i++) {
          const p = spts[i];
          const pa = spts[Math.max(0, i - 1)], pb = spts[Math.min(spts.length - 1, i + 1)];
          let dxv = pb[0] - pa[0], dzv = pb[1] - pa[1];
          const L = Math.hypot(dxv, dzv) || 1; dxv /= L; dzv /= L;
          const half = h0w + (h1w - h0w) * (i / Math.max(1, spts.length - 1));
          const y = sws[i] - 0.3;
          pos.push(p[0] - dzv * half, y, p[1] + dxv * half,
                   p[0] + dzv * half, y, p[1] - dxv * half);
        }
        for (let i = 0; i + 1 < spts.length; i++) {
          // steep drops (lake lips, carve steps) render as vertical blue
          // walls — skip those segments; the terrain carve reads as rapids
          const segL = Math.hypot(spts[i + 1][0] - spts[i][0], spts[i + 1][1] - spts[i][1]) || 1;
          if ((sws[i] - sws[i + 1]) / segL > 0.3) continue;
          const a = base + i * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      // THE MAP'S LAKES (G405): a flat quad per class-80 cell of the cover, at the
      // DEM's own level (the lake is flat in the DEM), 0.15 m under it like the
      // bake's; the ground shader paints the water's smooth edge underneath
      if (world.island && world.island.lakes && world.island.hydro !== 'proc' && gU.uGPackA) {
        // ONE QUAD PER LAKE (G407, the user: "why even bother with polygons? you
        // have a good outline, just give it a material"): the DEM is flat under
        // each lake now (island_prep), so a single rectangle over its bounding
        // box at its level, in the sea's own material, discarding every
        // fragment the lake field puts outside the water - a smooth edge, a
        // real reflection, no per-cell geometry at all.
        // THE EDGE IS THE FIELD'S FADE (G413): the surface's alpha rises over 4 m of
        // the signed distance (-3 m on the bank to +1 m in), not a hard discard at
        // the line - one tone, one outline, the bank showing through the shallows
        const lakeMat = waterMat.clone(); lakeMat.transparent = true; lakeMat.depthWrite = true;
        lakeMat.onBeforeCompile = sh => {
          if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
          sh.uniforms.uGPackA = gU.uGPackA; sh.uniforms.uGGrid = gU.uGGrid;
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWL;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWL = (modelMatrix * vec4(position, 1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWL; uniform sampler2D uGPackA; uniform vec4 uGGrid;')
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' +
              'float lakeA = smoothstep(-3.0, 1.0, (texture2D(uGPackA, (vWL.xz - uGGrid.xy) / uGGrid.zw).a * 255.0 - 128.0) * 4.0); if (lakeA <= 0.0) discard;')   // G424: the lake field is the packed A's alpha
            .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= lakeA;');
        };
        let n = 0;
        for (const L of world.island.lakes) {
          if (L.level <= 0.2 || L.cells < 3) continue;
          const g = new THREE.PlaneGeometry(L.x1 - L.x0 + 8, L.z1 - L.z0 + 8); g.rotateX(-Math.PI / 2);
          const m = new THREE.Mesh(g, lakeMat); m.position.set((L.x0 + L.x1) / 2, L.level + 0.02, (L.z0 + L.z1) / 2);
          m.receiveShadow = true; scene.add(m); n++;
        }
        console.log('island lakes: ' + n + ' surfaces, one quad each, the field cuts the edge');
      }
      const hc = world.hydro.cellW / 2, skirt = world.hydro.cellW * 0.6;
      for (const [lx, lz, ws, mask] of world.hydro.lakeSurf) {
        const y = ws - 0.15;
        quad(lx - hc, lz - hc, lx + hc, lz + hc, y);
        if (!(mask & 1)) quad(lx + hc, lz - hc, lx + hc + skirt, lz + hc, y);
        if (!(mask & 2)) quad(lx - hc - skirt, lz - hc, lx - hc, lz + hc, y);
        if (!(mask & 4)) quad(lx - hc, lz + hc, lx + hc, lz + hc + skirt, y);
        if (!(mask & 8)) quad(lx - hc, lz - hc - skirt, lx + hc, lz - hc, y);
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      wg.setIndex(idx);
      wg.computeVertexNormals();
      const wm = new THREE.Mesh(wg, waterMat);
      wm.receiveShadow = true;
      scene.add(wm);
    }
  }

  { // woodland: every physics tree seeds a clump of non-colliding neighbours
    const hsh = (a, b) => { let h = (a * 374761393 + b * 668265263 + 1013904223) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const P = [];
    world.trees.forEach((T, i) => {
      P.push({ x: T.x, z: T.z, h: T.h, s: T.s, sp: T.sp, r: hsh(i, 7) });
      const n = 2 + (hsh(i, 3) * 3 | 0);
      for (let k = 0; k < n; k++) {
        const a = hsh(i, k * 13 + 1) * 6.283, d = 4 + hsh(i, k * 13 + 2) * 14;
        const x = T.x + Math.cos(a) * d, z = T.z + Math.sin(a) * d;
        if (Math.abs(z) < 90 && x < 200 && x > -3400) continue;  // corridor exclusion, matches world
        const h = world.terrainH(x, z);
        if (h < 1.5 || h > 200) continue;
        if (world.waterH(x, z) > h) continue;   // no clutter trees standing in rivers/lakes
        // neighbours mostly share the stand's species, with strays
        const sp = hsh(i, k * 13 + 5) < 0.85 ? T.sp : (hsh(i, k * 13 + 6) * 5) | 0;
        P.push({ x, z, h, s: T.s * (0.55 + hsh(i, k * 13 + 3) * 0.7), sp, r: hsh(i, k * 13 + 4) });
      }
    });

    // ================= TREES PLACED BY HAND (W0c.28) ========================
    // "Forests will be managed through maps, but individual trees could be
    // placed by hand, and still should use the full LOD ladder." A placed
    // tree is one more record in the woodland's own list - x, z in world
    // metres, a subject key (else the pool's weighted draw), a size
    // multiplier over the collection's own, a yaw - so it gets the whole
    // rig for free: the three rungs, the fade, the impostor, both shadow
    // cascades, the canopy map. The list is read at every replant, so the
    // first REAL plant (after the payload lands) already carries what the
    // airfield placed at build; TREE_PLACE.replant() takes later changes.
    // Not persisted: the map-and-hand editor that will own it is not this.
    const PLACED = [];
    const placedRecords = () => PLACED.map((t, i) => ({
      x: t.x, z: t.z, h: world.terrainH(t.x, t.z), s: 1, sp: 0,
      r: t.yaw !== undefined ? ((t.yaw / 6.283) % 1 + 1) % 1 : hsh(i * 31 + 7, 11),
      key: t.key || null, size: t.size || 1, placed: true }));
    if (typeof window !== 'undefined') window.TREE_PLACE = {
      add: t => { PLACED.push(Object.assign({}, t)); return PLACED.length - 1; },
      set: list => { PLACED.length = 0; for (const t of (list || [])) PLACED.push(Object.assign({}, t)); return PLACED.length; },
      clear: () => { PLACED.length = 0; },
      list: () => PLACED.map(t => Object.assign({}, t)),
      keys: () => (typeof treeList === 'function') ? treeList().map(e => e.key) : [],
      replant: () => { plantWoodland(); return PLACED.length; },
      // which subject the pool would deal a tree at (x, z) - the species map
      // as the planter sees it, for probes and the editor to come
      speciesAt: (x, z) => (PROTO && PROTO.length)
        ? PROTO[poolPick(PROTO, hsh(Math.round(x * 3.7), Math.round(z * 5.3)), x, z, world.terrainH(x, z))].key : null,
    };

    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1.9, 5);
    trunkGeo.translate(0, 0.95, 0);
    const coneGeo = new THREE.ConeGeometry(1.7, 5.4, 7);
    coneGeo.translate(0, 3.9, 0);
    const blobGeo = new THREE.IcosahedronGeometry(2.05, 0);
    blobGeo.scale(1, 1.12, 1); blobGeo.translate(0, 3.5, 0);

    // ---- chunking, so the frustum can throw most of the forest away ------
    // three culls an InstancedMesh on its GEOMETRY's bounding sphere, and the
    // geometry is shared between chunks — which is why per-chunk bounds look
    // impossible and the streamed layer below gave up and set
    // frustumCulled = false. The way through: keep instance matrices RELATIVE
    // to their chunk centre, park each chunk mesh AT that centre, and inflate
    // the shared sphere once to a chunk's half-diagonal. Culling is then
    // conservative but correct, per chunk, against the camera AND the sun's
    // shadow camera — which is where most of the saving comes from.
    // The sphere must clear a chunk's half-diagonal AND its vertical spread:
    // instances carry terrain height, so a tree on a 150 m ridge in a chunk
    // corner sits further from the centre than the horizontal diagonal alone.
    // Size it on the horizontal half-diagonal against VSPAN of relief; get this
    // wrong and corner chunks on high ground pop out of view and out of shadow
    // (GATE WORLDRENDER asserts every instance is inside its own sphere).
    const CHW = 2048, VSPAN = 320;
    const chunkBounds = (geo, half) => {
      geo.userData = geo.userData || {};
      // stash the SHAPE's real sphere before the chunk sphere buries it: the
      // impostor bake needs it, and by then this geometry's boundingSphere is a
      // 1.5 km chunk ball. (Recomputing it later would silently undo the
      // inflation and put the tree field back to being culled per-tree.)
      // ONCE, and the chunk sphere only ever GROWS: a rung's geometry is
      // shared by the woodland (2 km chunks) and the fill (1 km), and the
      // last caller's smaller ball would cull the other's chunk edges.
      const r = Math.hypot(half * Math.SQRT1_2, VSPAN) + 12;
      if (geo.userData.chunkTree) {
        geo.boundingSphere.radius = Math.max(geo.boundingSphere.radius, r);
        return;
      }
      geo.computeBoundingSphere();
      geo.userData.shape = { cy: geo.boundingSphere.center.y, r: geo.boundingSphere.radius };
      geo.boundingSphere.center.set(0, 4, 0);
      geo.boundingSphere.radius = r;
      geo.userData.chunkTree = true;        // marks what GATE WORLDRENDER checks
    };
    // ================= W0c: the real trees ==============================
    // The cone and the icosahedron above are the FALLBACK now, not the tree.
    // They stay because this file must build a world with no payload at all:
    // the node gates have no fetch, and a missing asset degrades here the way
    // every other asset degrades in this project — the thing is absent, the
    // page is not broken.
    //
    // The curated set is all conifer, so the broadleaf slot is filled by a
    // conifer too. That is a CONTENT gap, not a pipeline one: the moment a
    // broadleaf collection is curated it drops into the same slot.
    // AND THE PAYLOAD ARRIVES AFTER THE WORLD IS BUILT. buildWorldScene is
    // synchronous and app.js calls it during its own script evaluation, so
    // there is no moment at which a fetch could have landed first. Waiting for
    // one would mean making the whole boot async, which is a far larger change
    // than this earns. So the woodland is PLANTED TWICE: once from whatever is
    // to hand (the cone, at boot) and again when the bytes arrive — the shape
    // hangar.js already uses for its props, and the one every other asset in
    // this project degrades through. The second plant costs what the first did,
    // once, off the critical path.
    // THE IMPOSTOR MACHINERY IS SHARED with the streamed fill below, which
    // bakes and dresses its own atlases from it, so it lives outside the
    // replant too. None of it depends on which tree was picked.
    // ================= W17: the LOD ladder ==============================
    // near (< NEAR_R): the 3D canopy + trunk below, unchanged, shadow-casting.
    // mid  (NEAR_R..FAR): OCTAHEDRAL IMPOSTORS — 2 triangles per tree.
    // far  (> FAR): no geometry at all; the terrain wears a canopy texture
    //               (see the ground shader's canopyHook).
    // The atlas is rendered AT BOOT from the very geometry the near tier draws,
    // with the scene's own sun and hemisphere light: no external art, no second
    // art pipeline, and the silhouette matches across the switch by construction.
    // Plain camera-facing billboards are wrong here — from 160 m up they read as
    // lying down — so each shape is baked from a G x G grid of view directions
    // folded over the upper hemisphere, and the shader picks the three nearest
    // views and blends them barycentrically (a hard nearest-view pick makes the
    // whole forest flip at once when the aircraft turns).
    // 8 x 8 = 64 views, the bench's count: at 16 the three-tap blend crosses
    // 25 degrees between views and a turning aircraft reads it as a smear.
    // Affordable because the atlas is baked ONCE per subject and series and
    // shared by both layers (below); at 4 MB a sheet, two sheets, 18 atlases
    // it is ~150 MB of VRAM, baked at boot.
    const IMP_G = 8, IMP_TILE = 128;
    // THE ATLAS CACHE. The woodland and the fill bake the same subject's same
    // series from the same parts array (treeBuild hands the same one out),
    // and each disposed its own copy on replant. One bake per parts array,
    // kept for the life of the page; the cone's atlases key on their
    // geometry and are the only other entries.
    const ATLAS = new Map();
    // grid cell -> view direction: the exact inverse of the hemi-octahedral fold
    // the fragment shader does. These two must agree or every tile reads rotated.
    const impDir = (i, j) => {
      const a = i / (IMP_G - 1) * 2 - 1, b = j / (IMP_G - 1) * 2 - 1;
      const px = (a + b) / 2, py = (a - b) / 2;
      return new THREE.Vector3(px, 1 - Math.abs(px) - Math.abs(py), py).normalize();
    };
    // Headless gates run against a THREE stub with no GL: fall back to a
    // texture-less atlas so the whole tree field still builds and can be checked.
    const canBake = !!(THREE.WebGLRenderTarget && renderer && renderer.setRenderTarget);
    // `src` is a geometry (the cone path) or a built subject's parts (W0c).
    // A REAL TREE MUST BAKE THROUGH ITS OWN MATERIALS: its foliage is a cutout,
    // and a white opaque mesh would bake the convex blob the alpha test exists
    // to carve away. The species tint is then already in the texture, so the
    // instance colour is left white for these — bake it tinted AND tint it at
    // draw and every tree in the forest is the same green twice over.
    // ================= W0c.8: THE IMPOSTOR IS A G-BUFFER =================
    // Ported from the bench (tools/_trees.html, W0a.1): a sheet of final shaded
    // RGB is a photograph taken under one sun, and nothing can re-light a
    // photograph - the far band came out black into the sun while the near
    // tier glowed through. So the bake runs TWICE over the same 16 camera
    // bases: once for ALBEDO + coverage (the tree materials with their albedo
    // switch on, or a white unlit cone) and once for the tree's own WORLD
    // NORMAL, cut by the same mask. The draw is then an ordinary
    // MeshStandardMaterial whose `normal` comes off the second sheet, and the
    // sun, the hemisphere, the environment and the leaf terms reach the
    // billboard through the code path they reach the geometry through.
    //
    // THE SHEET IS WRITTEN IN THE TARGET'S ENCODING, not the renderer's -
    // r128 picks `target.texture.encoding` - so the albedo target declares
    // sRGB (eight bits of linear is the wrong container for foliage) and the
    // draw decodes it by hand, because <map_fragment> is replaced wholesale.
    // The normal target stays linear; its material writes gl_FragColor raw.
    const NRM_CACHE = new WeakMap();
    // THE SAME BAKE IN TSL (W0.5b): the world normal, flipped on a back face,
    // as bytes; the cutout through the map's alpha. `uniforms` keeps the
    // GLSL shape so the caller below fills it the same way.
    function normalMatTSL() {
      const T = THREE.TSL;
      const U = { map: { value: null }, uCut: T.uniform(0.5), uHasMap: T.uniform(0) };
      const m = new THREE.MeshBasicNodeMaterial();
      const n = T.select(T.frontFacing, T.normalWorld, T.normalWorld.negate());
      m.colorNode = n.mul(0.5).add(0.5);   // data into a linear target: no colour-space step
      m.uniforms = U;
      m.userData.nrmTSL = true;
      return m;
    }
    function normalMatFor(src) {
      let m = NRM_CACHE.get(src);
      if (!m) {
        m = TSL_ON ? normalMatTSL() : new THREE.ShaderMaterial({
          uniforms: { map: { value: null }, uCut: { value: 0.5 }, uHasMap: { value: 0 } },
          vertexShader: [
            'varying vec3 vWN;', 'varying vec2 vUvN;',
            'void main() {',
            '  vWN = normalize(mat3(modelMatrix) * normal);',
            '  vUvN = uv;',
            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'].join('\n'),
          fragmentShader: [
            'uniform sampler2D map;', 'uniform float uCut, uHasMap;',
            'varying vec3 vWN;', 'varying vec2 vUvN;',
            'void main() {',
            '  if (uHasMap > 0.5 && texture2D(map, vUvN).a < uCut) discard;',
            '  vec3 n = normalize(vWN);',
            '  if (!gl_FrontFacing) n = -n;',
            '  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);',
            '}'].join('\n'),
        });
        NRM_CACHE.set(src, m);
      }
      // the cutout is the material's own uCut (trees.js: the sharpen owns it
      // and alphaTest sits at a 0.01 floor), the plain alphaTest otherwise
      const cut = (src.userData && src.userData.uCut) ? src.userData.uCut.value : (src.alphaTest || 0);
      m.uniforms.map.value = src.map || null;
      m.uniforms.uCut.value = cut || 0.5;
      m.uniforms.uHasMap.value = (src.map && src.map.image && cut > 0) ? 1 : 0;
      if (m.userData && m.userData.nrmTSL) {   // the node variant cuts through the material's own map + alphaTest
        m.map = (src.map && src.map.image && cut > 0) ? src.map : null;
        m.alphaTest = m.map ? (cut || 0.5) : 0;
        m.needsUpdate = true;
      }
      m.side = src.side;
      return m;
    }
    function bakeImpostorAtlas(src) {
      const hit = ATLAS.get(src);
      if (hit) return hit;
      const atlas = bakeImpostorAtlasNow(src);
      if (atlas.tex) ATLAS.set(src, atlas);
      return atlas;
    }
    function bakeImpostorAtlasNow(src) {
      const parts = Array.isArray(src) ? src : null;
      const srcGeo = parts ? parts[0].geo : src;
      const bs = srcGeo.userData.shape;     // stashed by chunkBounds, see above
      // ortho half-extent carries a 12% gutter: mipmaps of a tile-packed atlas
      // bleed across tile borders, and the gutter is what keeps that off the tree
      const M = bs.r * 1.12, cy = bs.cy, atlas = { cy, diam: 2 * M, tex: null, nrm: null };
      if (!canBake) return atlas;
      const N = IMP_G * IMP_TILE;
      const mkRT = () => new THREE.WebGLRenderTarget(N, N, {
        minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, generateMipmaps: true });
      const rt = mkRT(), rtN = mkRT();
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      const sc = new THREE.Scene();
      const meshes = [];
      if (parts) {
        for (const q of parts) {
          // the tree's own material, albedo switch on (see trees.js U_BAKEALB)
          const m = q.mat.clone();
          m.onBeforeCompile = q.mat.onBeforeCompile;
          m.userData = q.mat.userData;
          m.toneMapped = false;
          meshes.push(new THREE.Mesh(q.geo, m));
        }
      } else {
        // the cone: unlit white, tinted per instance at draw as before
        meshes.push(new THREE.Mesh(srcGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })));
      }
      for (const mm of meshes) sc.add(mm);
      const cam = new THREE.OrthographicCamera(-M, M, M, -M, 0.1, bs.r * 8);
      const ctr = new THREE.Vector3(0, cy, 0);
      const pRT = renderer.getRenderTarget(), pAC = renderer.autoClear;
      const pCol = new THREE.Color(), pA = renderer.getClearAlpha();
      // THE VIEWPORT IS RENDERER STATE, NOT TARGET STATE (2026-09-11): the
      // tile viewport set below is what r128 re-applies to the CANVAS on the
      // next setRenderTarget(null) — the whole game then drew in a 128 px
      // square in the middle of the screen. Save it, put it back.
      const pVP = renderer.getViewport(new THREE.Vector4());
      const pSC = renderer.getScissor(new THREE.Vector4());
      { const gc = renderer.getClearColor(pCol); if (gc && gc !== pCol) pCol.copy(gc); }
      const pTM = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;   // once, at the real draw
      // ONE CAMERA BASIS, TWO SHEETS: albedo texel (x,y) and normal texel (x,y)
      // are the same point on the same tree, which is what lets the draw light
      // one with the other. Clear to transparent BLACK and unpremultiply at
      // sample time, so the mip chain is the correct one.
      const drawAll = target => {
        renderer.setRenderTarget(target);
        renderer.autoClear = false;
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, false);
        renderer.setScissorTest(true);
        for (let j = 0; j < IMP_G; j++) for (let i = 0; i < IMP_G; i++) {
          const d = impDir(i, j);
          cam.up.set(0, 1, 0);
          if (Math.abs(d.y) > 0.999) cam.up.set(0, 0, 1);   // pole: same rule as the shader
          cam.position.copy(ctr).addScaledVector(d, bs.r * 4);
          cam.lookAt(ctr);
          cam.updateProjectionMatrix();
          renderer.setViewport(i * IMP_TILE, j * IMP_TILE, IMP_TILE, IMP_TILE);
          renderer.setScissor(i * IMP_TILE, j * IMP_TILE, IMP_TILE, IMP_TILE);
          renderer.clearDepth();
          renderer.render(sc, cam);
        }
        renderer.setScissorTest(false);
      };
      const BAKE = (typeof TREE_LEAF !== 'undefined' && TREE_LEAF.bake) || { value: 0 };
      uNoBand.value = 1;                     // the bake sees every rung whole
      BAKE.value = 1;                        // pass 1: albedo + coverage
      drawAll(rt);
      BAKE.value = 0;
      const swap = [];                       // pass 2: the tree's own normals
      for (const mm of meshes) { swap.push([mm, mm.material]); mm.material = normalMatFor(mm.material); }
      drawAll(rtN);
      for (const [mm, m] of swap) mm.material = m;
      uNoBand.value = 0;
      renderer.toneMapping = pTM;
      renderer.setViewport(pVP);
      renderer.setScissor(pSC);
      renderer.setRenderTarget(pRT);
      renderer.autoClear = pAC;
      renderer.setClearColor(pCol, pA);
      atlas.tex = rt.texture;
      atlas.nrm = rtN.texture;
      atlas.rt = rt; atlas.rtN = rtN;        // readable by the inspector
      return atlas;
    }
    // One quad geometry per CHUNK SIZE (the cull sphere lives on the geometry —
    // see chunkBounds), one material per source shape.
    const impQuad = half => { const g = new THREE.PlaneGeometry(1, 1); chunkBounds(g, half); return g; };
    // THE ALPHA CURVE, the bench's (tools/_trees.html impostorMaterial): the
    // three taps' alpha is centred on a CUT and steepened by a GAIN, with
    // `solid` mixing toward the max of the three taps so a leaf texel only
    // one view carries is not drawn solid. The cut rides on the SERIES: a
    // snag's branch is one texel wide and arrives at 0.2-0.3, and a cut of
    // 0.40 shredded it into dots (the bench's W0a.3); the stand's crown is
    // sparser than the specimen's and wants a lower cut too. Then a 0.01
    // floor on the hard test and alpha-to-coverage, as on the leaves.
    const IMP_CUT = [0.40, 0.15, 0.10];      // rungs, stand, snag
    // the alpha gain rides on the COLLECTION now (`place.impa`, 6 or 6.5 in
    // the tuning); uIGainK is the panel's dial over all of them
    const uIGainK = { value: 1 }, uISolid = { value: 1 };
    const impaOf = key => { const e = (typeof treeList === 'function') && treeList().find(x => x.key === key);
                            return (e && e.col.place && e.col.place.impa) || 6; };
    // THE IMPOSTOR CASTS ITS OWN SILHOUETTE (W0c.18, the bench's W0a.4). The
    // stock depth pass would draw the eye-facing quad edge-on to the light
    // and sample the whole sheet - a solid slab per tree - which is why the
    // tier never cast. This depth material lays the quad out facing the SUN
    // instead and folds the sun's direction into the atlas, so the shadow is
    // the tree's real silhouette from the sun's side, with the same alpha
    // curve the draw uses. Only matters inside the shadow reach, i.e. when
    // the bands are pulled in; then the far stand has shade under it too.
    const IMP_FOLD_GLSL = [
      'vec3 dI = vImpDir;',
      'vec2 pp = vec2(dI.x, dI.z) / (abs(dI.x) + abs(dI.z) + max(dI.y, 0.0) + 1e-5);',
      'vec2 oc = clamp(vec2(pp.x + pp.y, pp.x - pp.y), -1.0, 1.0);',
      'vec2 gp = (oc * 0.5 + 0.5) * (uG - 1.0);',
      'vec2 g0 = min(floor(gp), uG - 2.0);',
      'vec2 gf = gp - g0;',
      'vec2 cB = vec2(1.0, 0.0), cC = vec2(0.0, 1.0), cA; vec3 wB;',
      'if (gf.x + gf.y < 1.0) { cA = vec2(0.0); wB = vec3(1.0 - gf.x - gf.y, gf.x, gf.y); }',
      'else { cA = vec2(1.0); wB = vec3(gf.x + gf.y - 1.0, 1.0 - gf.y, 1.0 - gf.x); }',
      'vec2 qv = (vUvI * (1.0 - 2.0 / uTile) + 1.0 / uTile) / uG;',
      'vec2 uvA = (g0 + cA) / uG + qv, uvB = (g0 + cB) / uG + qv, uvC = (g0 + cC) / uG + qv;',
      'vec4 t0 = texture2D(uAtlas, uvA), t1 = texture2D(uAtlas, uvB), t2 = texture2D(uAtlas, uvC);',
      'float aMix = dot(wB, vec3(t0.a, t1.a, t2.a)), aSol = max(max(t0.a, t1.a), t2.a);',
      'diffuseColor.a = clamp((mix(aMix, aSol, uISolid) - uICut) * uIGain * uIGainK + 0.5, 0.0, 1.0);',
    ].join('\n');
    const U_FARR = { value: 1e7 };            // the far pass: no reach limit
    function impostorDepth(atlas, si, farPass, gain) {
      if (TSL_ON) return null;   // W0.5b: MeshDepthMaterial is refused by the node renderer; its default depth casts until the port
      const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5, side: THREE.DoubleSide });
      if (!atlas.tex) return d;
      const cover = farPass === 'cover';
      // THREE VARIANTS, THREE PROGRAMS. r128 keys its program cache on
      // onBeforeCompile.toString() plus the material's parameters; the three
      // variants' hooks are the same text and differ only in a closure
      // variable, so the cover material was handed the far material's
      // program - packed depth where the canopy map wanted a white mask -
      // and the floor sampled noise. The key names the variant.
      d.customProgramCacheKey = () => 'impDepth:' + (cover ? 'cover' : (farPass ? 'far' : 'near'));
      d.onBeforeCompile = sh => {
        sh.uniforms.uCam = uCam; sh.uniforms.uSunDir = cover ? U_UP : { value: SUN };
        sh.uniforms.uNearB = cover ? U_NONEAR : uNear; sh.uniforms.uFadeW = uFadeW;
        sh.uniforms.uShadowR = farPass ? U_FARR : uShadowR;
        sh.uniforms.uCy = { value: atlas.cy }; sh.uniforms.uDiam = { value: atlas.diam };
        sh.uniforms.uG = { value: IMP_G }; sh.uniforms.uTile = { value: IMP_TILE };
        sh.uniforms.uAtlas = { value: atlas.tex };
        sh.uniforms.uIGain = { value: gain || 6 }; sh.uniforms.uIGainK = uIGainK; sh.uniforms.uISolid = uISolid;
        sh.uniforms.uICut = { value: IMP_CUT[si || 0] };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uCam, uSunDir;\n' +
            'uniform float uNearB, uFadeW, uCy, uDiam, uShadowR;\nvarying vec3 vImpDir;\nvarying vec2 vUvI;')
          .replace('#include <project_vertex>', [
            'vec3 iPos = instanceMatrix[3].xyz;',
            'float sX = length(instanceMatrix[0].xyz), sY = length(instanceMatrix[1].xyz);',
            'vec3 ctr = iPos + vec3(0.0, uCy * sY, 0.0);',
            // the eye's distance, for the same inner collapse as the draw
            'float dCam = length((uCam - modelMatrix[3].xyz) - ctr);',
            // the quad faces the SUN, and the fold reads the sun's view
            'vec3 L = normalize(uSunDir);',
            'vImpDir = normalize(vec3(L.x / sX, L.y / sY, L.z / sX));',
            'vec3 upRef = abs(vImpDir.y) > 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);',
            'vec3 rgt = normalize(cross(upRef, vImpDir));',
            'vec3 upv = cross(vImpDir, rgt);',
            'vec3 off = (rgt * position.x + upv * position.y) * uDiam;',
            'vec3 wp = ctr + vec3(off.x * sX, off.y * sY, off.z * sX);',
            'vUvI = uv;',
            'vec4 mvPosition = modelViewMatrix * vec4(wp, 1.0);',
            'gl_Position = projectionMatrix * mvPosition;',
            'if (dCam < uNearB || dCam > uShadowR * 1.6) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);',
          ].join('\n'));
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform sampler2D uAtlas;\n' +
            'uniform float uG, uTile, uIGain, uIGainK, uISolid, uICut;\nvarying vec3 vImpDir;\nvarying vec2 vUvI;')
          .replace('#include <map_fragment>', IMP_FOLD_GLSL);
        // the canopy map is a mask: white where the crown is, after the cut
        if (cover) sh.fragmentShader = sh.fragmentShader.replace('packDepthToRGBA( fragCoordZ )', 'vec4( 1.0 )');
      };
      return d;
    }
    // the tint uniforms of the series' own material: the leaf part's where
    // there is one, the bark's for the snag - shared by reference
    const tintUniformsOf = parts => {
      const leaf = parts.find(q => q.mat.userData && q.mat.userData.uLeaf && q.mat.userData.uLeaf.value > 0.5);
      const src = (leaf || parts[0] || {}).mat;
      const u = src && src.userData;
      return (u && u.uHue) ? { uHue: u.uHue, uSat: u.uSat, uLight: u.uLight } : null;
    };
    function impostorMat(atlas, far, si, tintU, gain, thinU) {
      // AN IMPOSTOR IS AN ORDINARY SURFACE WITH A BAKED NORMAL. Standard at
      // roughness 1, `normal` replaced from the second sheet: that single
      // substitution buys the whole rig - sun, hemisphere, environment, and the
      // leaf wrap and translucency through trees.js's own terms.
      // NO `vertexColors`. The per-instance tint rides on USE_INSTANCING_COLOR,
      // which r128 defines from the mesh's instanceColor alone; `vertexColors`
      // would ALSO define USE_COLOR, and multiply vColor by a `color`
      // attribute the quad does not carry - an unbound attribute reads
      // (0,0,0), and every impostor drew black under a healthy atlas. The old
      // photograph impostor was a ShaderMaterial and never met this.
      const m = new THREE.MeshStandardMaterial({ map: atlas.tex,
        alphaTest: 0.01, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
      (m.userData = m.userData || {}).atlas = atlas;
      if (!atlas.tex) return m;              // headless: no GL, no atlas, no shader
      const LEAF = (typeof TREE_LEAF !== 'undefined' && TREE_LEAF.uniforms) ? TREE_LEAF : null;
      m.onBeforeCompile = sh => {
        sh.uniforms.uCam = uCam;
        if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
        sh.uniforms.uNearB = uNear;
        sh.uniforms.uFarB = { value: far };
        sh.uniforms.uFadeB = { value: FAR_FADE };
        sh.uniforms.uFadeW = uFadeW;
        sh.uniforms.uThin = thinU || U_NOTHIN;
        sh.uniforms.uCy = { value: atlas.cy };
        sh.uniforms.uDiam = { value: atlas.diam };
        sh.uniforms.uG = { value: IMP_G };
        sh.uniforms.uNrm = { value: atlas.nrm };
        sh.uniforms.uILit = uILit;
        sh.uniforms.uIGain = { value: gain || 6 }; sh.uniforms.uIGainK = uIGainK; sh.uniforms.uISolid = uISolid;
        sh.uniforms.uICut = { value: IMP_CUT[si || 0] };
        sh.uniforms.uTile = { value: IMP_TILE };
        sh.uniforms.uLeaf = { value: 1 };
        sh.uniforms.uHue = tintU ? tintU.uHue : { value: 0 };
        sh.uniforms.uSat = tintU ? tintU.uSat : { value: 1 };
        sh.uniforms.uLight = tintU ? tintU.uLight : { value: 1 };
        sh.uniforms.uWrap = LEAF ? LEAF.uniforms.uWrap : { value: 0.76 };
        sh.uniforms.uSSS = LEAF ? LEAF.uniforms.uSSS : { value: 0.72 };
        sh.uniforms.uSSSP = LEAF ? LEAF.uniforms.uSSSP : { value: 3 };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\n' +
            'uniform vec3 uCam;\nuniform float uNearB, uFarB, uFadeB, uFadeW, uCy, uDiam;\nuniform vec2 uThin;\n' +
            'varying vec3 vImpDir;\nvarying float vImpD;')
          // The quad is built around the instance's own axes, NOT the screen's.
          // Instances carry a random yaw for the 3D tier; impostors ignore it
          // and read only position and scale out of the instance matrix. Scale
          // is non-uniform: the exact trick is to do everything in the
          // UNSCALED shape's space — pick the view with the direction divided
          // by the scale, lay the quad out there, then scale the offsets back.
          .replace('#include <project_vertex>', [
            'vec3 iPos = instanceMatrix[3].xyz;',
            'float sX = length(instanceMatrix[0].xyz), sY = length(instanceMatrix[1].xyz);',
            'vec3 ctr = iPos + vec3(0.0, uCy * sY, 0.0);',
            'vec3 camL = uCam - modelMatrix[3].xyz;',    // camera in chunk-local space
            'vec3 toCam = camL - ctr;',
            'float dCam = length(toCam);',
            'vImpDir = normalize(vec3(toCam.x / sX, toCam.y / sY, toCam.z / sX));',
            'vec3 upRef = abs(vImpDir.y) > 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);',
            'vec3 rgt = normalize(cross(upRef, vImpDir));',
            'vec3 upv = cross(vImpDir, rgt);',
            // Shrink to nothing over the last uFadeB metres instead of clipping
            // hard: at the far edge a tree is about two pixels tall, so
            // shrinking it away is indistinguishable from dissolving it
            'float fade = 1.0 - clamp((dCam - (uFarB - uFadeB)) / uFadeB, 0.0, 1.0);',
            // the thinning (S3): keep falls 1 -> 0 across [uThin.x, uThin.y]; an
            // instance's own hash (its world position, stable per tree) decides
            // whether it is one of the kept, and it shrinks in over 5 % of the ramp
            'float keep = 1.0 - clamp((dCam - uThin.x) / max(1.0, uThin.y - uThin.x), 0.0, 1.0);',
            'float hT = fract(sin(dot(floor((iPos.xz + modelMatrix[3].xz) * 4.0), vec2(12.9898, 78.233))) * 43758.5453);',
            'fade *= clamp((keep * 1.05 - hT) * 20.0, 0.0, 1.0);',
            'vec3 off = (rgt * position.x + upv * position.y) * (uDiam * fade);',
            'vec3 wp = ctr + vec3(off.x * sX, off.y * sY, off.z * sX);',
            'vec4 mvPosition = modelViewMatrix * vec4(wp, 1.0);',
            'gl_Position = projectionMatrix * mvPosition;',
            // inside the near band the 3D tier draws these trees for real;
            // the window before it is shared with the last rung (dithered)
            'vImpD = dCam;',
            'if (dCam < uNearB - uFadeW * 0.5 || fade <= 0.0) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);',
          ].join('\n'));
        sh.fragmentShader = ('#ifdef SHADOWMAP_TYPE_PCF_SOFT\n#undef SHADOWMAP_TYPE_PCF_SOFT\n#define SHADOWMAP_TYPE_PCF\n#endif\n' + sh.fragmentShader)
          .replace('#include <common>', '#include <common>\n' +
            'uniform float uG, uILit, uLeaf, uWrap, uSSS, uSSSP, uNearB, uFadeW, uIGain, uIGainK, uISolid, uICut, uTile;\n' +
            'uniform float uHue, uSat, uLight;\nuniform sampler2D uNrm;\nvarying vec3 vImpDir;\nvarying float vImpD;\n' +
            // (impSRGB is kept for the bench's dials; the sheet itself is decoded by
            // the sampler since r186 - see the map_fragment replacement)
            'vec3 impSRGB(vec3 c) { return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045))); }')
          .replace('#include <map_fragment>', [
            // hemi-octahedral fold: the upper hemisphere onto [-1,1]^2, so a
            // regular grid of tiles is a near-uniform spread of view directions
            // with the horizon ring on the square's edge (where a plane spends
            // most of its life) and straight-down at the centre.
            'vec3 dI = vImpDir;',
            'vec2 pp = vec2(dI.x, dI.z) / (abs(dI.x) + abs(dI.z) + max(dI.y, 0.0) + 1e-5);',
            'vec2 oc = clamp(vec2(pp.x + pp.y, pp.x - pp.y), -1.0, 1.0);',
            'vec2 gp = (oc * 0.5 + 0.5) * (uG - 1.0);',
            'vec2 g0 = min(floor(gp), uG - 2.0);',
            'vec2 gf = gp - g0;',
            // barycentric over the cell's two triangles: 3 taps, no seams
            'vec2 cB = vec2(1.0, 0.0), cC = vec2(0.0, 1.0), cA; vec3 wB;',
            'if (gf.x + gf.y < 1.0) { cA = vec2(0.0); wB = vec3(1.0 - gf.x - gf.y, gf.x, gf.y); }',
            'else { cA = vec2(1.0); wB = vec3(gf.x + gf.y - 1.0, 1.0 - gf.y, 1.0 - gf.x); }',
            // one texel in from the tile's border: the neighbouring tile's
            // edge bleeds through bilinear filtering otherwise
            'vec2 qv = (vMapUv * (1.0 - 2.0 / uTile) + 1.0 / uTile) / uG;',   // vMapUv: r186 has no vUv (W0.5a)
            'vec2 uvA = (g0 + cA) / uG + qv, uvB = (g0 + cB) / uG + qv, uvC = (g0 + cC) / uG + qv;',
            'vec4 t0 = texture2D(map, uvA), t1 = texture2D(map, uvB), t2 = texture2D(map, uvC);',
            'vec4 texelColor = t0 * wB.x + t1 * wB.y + t2 * wB.z;',
            // NO HAND DECODE ANY MORE (W0.5a): the sheet is an sRGB8 target on r186 and
            // the sampler decodes it in hardware; impSRGB on top of that darkened every
            // impostor (the user saw it in the first forest shot)
            'texelColor.rgb = clamp(texelColor.rgb / max(texelColor.a, 1e-4), 0.0, 1.0);',   // premultiplied sheet
            'float aSol = max(max(t0.a, t1.a), t2.a);',
            'texelColor.a = clamp((mix(texelColor.a, aSol, uISolid) - uICut) * uIGain * uIGainK + 0.5, 0.0, 1.0);',
            // the incoming half of the last rung's window: keep n >= 1 - t
            '{ float _n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
            '  float _fi = clamp((vImpD - (uNearB - uFadeW * 0.5)) / uFadeW, 0.0, 1.0);',
            '  if (_n < 1.0 - _fi) discard; }',
            'diffuseColor *= texelColor;',
            // the collection's tint, the same words as the leaf's, at the draw
            (LEAF && LEAF.tintGlsl) ? LEAF.tintGlsl : '',
            // the other half of the G-buffer, un-premultiplied by ITS alpha
            'vec4 n0 = texture2D(uNrm, uvA), n1 = texture2D(uNrm, uvB), n2 = texture2D(uNrm, uvC);',
            'float nW = dot(wB, vec3(n0.a, n1.a, n2.a));',
            'vec3 nBake = (n0.rgb * wB.x + n1.rgb * wB.y + n2.rgb * wB.z) / max(nW, 1e-4) * 2.0 - 1.0;',
            'if (dot(nBake, nBake) < 1e-4) nBake = dI;',
            'vec3 nImpV = normalize((viewMatrix * vec4(normalize(nBake), 0.0)).xyz);',
          ].join('\n'))
          // the substitution that buys the rig; both: r186 declares geometryNormal
          // from `normal` in lights_fragment_begin, and nonPerturbedNormal is what
          // the clearcoat and transmission terms read
          .replace('#include <normal_fragment_maps>',
            '#include <normal_fragment_maps>\nnormal = nImpV;\nnonPerturbedNormal = nImpV;')
          .replace('#include <lights_fragment_end>',
            '#include <lights_fragment_end>\n' + (LEAF ? LEAF.terms : '') + '\n' +
            // the tier gain, on all four terms - the multiscatter one rides on
            // the sky and not the albedo, and scaling the diffuse alone leaves
            // a floor that eats the dial (the bench's W0a.2)
            'reflectedLight.directDiffuse *= uILit;\nreflectedLight.indirectDiffuse *= uILit;\n' +
            'reflectedLight.directSpecular *= uILit;\nreflectedLight.indirectSpecular *= uILit;');
      };
      return m;
    }
    // ================= W0c.4: THE LADDER IN THE NEAR TIER ==================
    // Three rungs of the specimen series, each drawn in its own distance BAND:
    // L0 to LOD_R[0], L1 to LOD_R[1], L2 to NEAR_R, the impostor beyond. The
    // band is the same per-instance collapse `nearOnly` does, with a near edge
    // as well as a far one, so a tree is drawn by exactly one rung at any
    // distance. It is done in the shader rather than by moving instances
    // between meshes per frame because that is this file's idiom and it costs
    // nothing on the CPU; what it does cost is vertex work for the collapsed
    // instances, which the per-rung chunk RADIUS below keeps to the chunks
    // that can hold a live instance of that rung at all.
    //
    // AND THE SHADOW PASS GETS THE SAME BANDS. Two reasons, both measured
    // before: r128's shadow map builds its own depth material and copies
    // neither `map` nor `alphaTest` (so a real tree's leaf cards were casting
    // SOLID-CARD shadows), and without the band every rung would cast at once,
    // three trees deep. So each rung's parts get a depth material of their own,
    // wearing the part's map and cutoff and the rung's band - measured from the
    // CG, because the sun's shadow camera follows the aircraft, not the eye.
    const LOD_R = [LOD_U[0].value, LOD_U[1].value, NEAR_R];
    // THE BANDS ARE A DIAL: TREE_LOD.set([l0, l1, near]) moves the shader
    // edges, the partition's table and the impostor's inner edge together,
    // and forces a re-partition. [150, 150, 150] is "L0 then impostor".
    let lodAt = null;                       // the partition's last CG (see lodUpdate)
    const treeLod = {
      fade: v => { if (v !== undefined) { uFadeW.value = Math.max(0, +v); lodAt = null; } return uFadeW.value; },
      get: () => [LOD_U[0].value, LOD_U[1].value, uNear.value],
      set: a => {
        const l0 = Math.max(10, +a[0] || LOD_U[0].value), l1 = Math.max(l0, +a[1] || LOD_U[1].value);
        const nr = Math.max(l1, +a[2] || uNear.value);
        LOD_U[0].value = LOD_R[0] = l0; LOD_U[1].value = LOD_R[1] = l1; uNear.value = LOD_R[2] = nr;
        lodAt = null;
        return treeLod.get();
      },
    };
    treeLod.imp = o => { if (o) { if (o.gain !== undefined) uIGainK.value = +o.gain; if (o.solid !== undefined) uISolid.value = +o.solid; }
      return { gain: uIGainK.value, solid: uISolid.value }; };
    if (typeof window !== 'undefined') window.TREE_LOD = treeLod;
    // ================= W0c.5: THE MIX ======================================
    // Which SERIES a tree is drawn as. The bench's rule, ported: a fraction is
    // dead (the collection's own `place.dead`), and of the living, `furnished`
    // are the specimen tree and the rest the stand-shaped one. Set to 1.0 for
    // now on the user's ruling - only full-foliage trees show - and left as a
    // dial because the stand series is baked, planted and waiting.
    // AND THE SIZE. The world's `T.s` (0.65-1.75, a species factor times a
    // noise) and the cone-era multipliers on top of it - 0.86-1.14 for the
    // stand, 0.55-1.25 for the clump neighbours, 0.62-1.17 for the fill -
    // were how a 7 m cone stood in for trees of different heights. A REAL tree
    // carries its own height, and multiplying it by all of that made a stand
    // of 6 m saplings with a few 28 m giants in it where the bench, which
    // sizes every tree at the collection's `size` times a narrow spread, had
    // them all alike. So the size is the bench's rule now: `place.size` times
    // 1 + spread*(2w - 0.9), which at spread 0.2 is 0.82-1.22 - the bench's
    // committed spread - and nothing else. `T.s` stays the physics' number.
    const TREE_MIX = { furnished: 1.0, spread: 0.2 };
    const sizeOf = (base, w) => (base || 1) * (1 + TREE_MIX.spread * (2 * w - 0.9));
    if (typeof window !== 'undefined') window.TREE_MIX = TREE_MIX;
    const SERIES = ['rungs', 'stand', 'snag'];        // index = series id
    const seriesOf = (r, dead) => r < dead ? 2 : (r - dead) / Math.max(1e-6, 1 - dead) < TREE_MIX.furnished ? 0 : 1;
    // reachable from the console so the bands can be tuned and A/B'd live:
    // TREE_LOD_R[0] = 450 puts every near tree on L0, which is the "before"
    if (typeof window !== 'undefined') window.TREE_LOD_R = LOD_R;
    // THE PARTITION IS DONE ON THE CPU, and this is the whole of why the
    // ladder is affordable. The shader band alone was measured at 32 ms a
    // frame: a collapsed instance still runs the vertex shader, every rung
    // carried every instance, and a 2 km chunk is on for every rung at once -
    // some 175 million vertex invocations for 4 500 trees. So each rung mesh
    // carries ONLY the instances in its band, sorted in here on a cadence as
    // the aircraft moves, and `count` is set to what was written. The band in
    // the shader stays as the seam guard between refreshes.
    const LOD_TICK = 6, LOD_MOVE = 10;      // refresh every 6 frames or 10 m - inside the window's half-width
    // rec.rungs[si][r] holds the meshes of rung r of series si, rec.buf[si][r]
    // its scratch, and the rung TABLE - the far edge of each rung - is read
    // live from the ladder's edges, so the dial that moves the bands moves
    // the partition with them. A one-rung series (the snag) spans the whole
    // near tier and every instance inside it lands on that rung; under one
    // shared band table it was dealt to the empty lists of the bands its
    // rung did not own.
    const spanFor = n => n <= 1 ? [uNear.value] : LOD_U.slice(0, n - 1).map(u => u.value).concat([uNear.value]);
    function partitionChunk(rec, cg) {
      const n = rec.n, pos = rec.pos, mats = rec.mats, ser = rec.ser;
      const k = rec.rungs.map(L => L.map(() => 0));
      const spans = rec.rungs.map(L => spanFor(L.length));
      const hw = uFadeW.value * 0.5;
      for (let i = 0; i < n; i++) {
        const dx = pos[i * 3] - cg[0], dy = pos[i * 3 + 1] - cg[1], dz = pos[i * 3 + 2] - cg[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const si = ser[i], R = spans[si];
        // every rung whose window [near - hw, far + hw) holds the tree: at
        // most two, and each rung's buffer is sized for the whole series
        for (let j = 0; j < R.length; j++) {
          if (d >= R[j] + hw) continue;
          if (j && d < R[j - 1] - hw) break;
          rec.buf[si][j].set(mats.subarray(i * 16, i * 16 + 16), k[si][j] * 16);
          k[si][j]++;
        }
      }
      for (let si = 0; si < rec.rungs.length; si++)
        for (let b = 0; b < rec.rungs[si].length; b++) for (const m of rec.rungs[si][b]) {
          const c = k[si][b];
          if (c) m.instanceMatrix.array.set(rec.buf[si][b].subarray(0, c * 16));
          m.count = c; m.visible = c > 0;
          // only the instances written go up (addUpdateRange, r159+: the list
          // is consumed by the upload and cleared after it) - a rung's buffer
          // is sized for the whole series, and a band holds a fraction of it
          if (c) { m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, c * 16); m.instanceMatrix.needsUpdate = true; }
        }
    }
    const parkChunk = rec => {
      for (const S of rec.rungs) for (const b of S) for (const m of b) { m.count = 0; m.visible = false; }
    };
    // A TREE IS BANDED WHOLE, BY ITS INSTANCE ORIGIN. The first cut measured
    // every VERTEX's own distance, so a tree straddling a band edge had the
    // vertices on one side collapsed to the clip point and the rest drawn:
    // the tree was sliced down the middle, and every triangle that crossed
    // the cut stretched from the tree to the clip point at the centre of the
    // screen - the slivers the user saw "rendered in front of everything" as
    // the camera closed on a stand. The instance's origin is one number for
    // the whole tree, so a tree swaps as one mesh, at one moment, exactly
    // where the CPU partition put it.
    const BAND_ORIGIN_VIEW = [
      '#ifdef USE_INSTANCING',
      'float bandD = length((modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz);',
      '#else',
      'float bandD = length(mvPosition.xyz);',
      '#endif'].join('\n');
    const BAND_ORIGIN_CAM = [
      '#ifdef USE_INSTANCING',
      'float bandD = distance((modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz, uCam);',
      '#else',
      'float bandD = distance((modelMatrix * vec4(transformed, 1.0)).xyz, uCam);',
      '#endif'].join('\n');
    // ONE CASTER PER TREE, AT A HARD EDGE (W0c.24). The draw fades one rung
    // into the next across a window, dithered, and the shadow pass copied
    // that - so inside every window a tree cast from TWO rungs, each with a
    // stipple whose thresholds moved with the eye's distance, and its
    // impostor caster on top, whole. Move the camera a hair and every
    // shadow in a window was re-rolled: the "constantly redrawn" jitter
    // the user filmed. A shadow comes from exactly one representation now,
    // chosen at the band's edge with no window, and it does not know where
    // the eye is beyond that choice.
    const BAND_GLSL = (originExpr, hard) => hard ? originExpr + '\n' + [
      'vBandD = bandD;',
      'if (uNoBand < 0.5 && (bandD < uNearB || bandD >= uFarB)) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);',
    ].join('\n') : originExpr + '\n' + [
      'vBandD = bandD;',
      // world position, for the depth pass's dither (see DITHER_GLSL)
      '#ifdef USE_INSTANCING',
      'vBandW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;',
      '#else',
      'vBandW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      '#endif',
      'float _hw = uFadeW * 0.5;',
      'float _lo = uNearB > 0.5 ? uNearB - _hw : -1.0;',    // rung 0 has no near edge
      'if (uNoBand < 0.5 && (bandD < _lo || bandD >= uFarB + _hw)) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);',
    ].join('\n');
    // the fragment half: interleaved gradient noise against this rung's own
    // weight at each edge. Out at the far edge keeps n < 1 - t, in at the
    // near edge keeps n >= 1 - t: the same t, the same n, complementary.
    // The noise is screen-space for the DRAW (the standard: the stipple sits
    // still on the screen) and WORLD-space for the shadow pass: a shadow map
    // that steps by whole texels as the aircraft moves would re-roll a
    // pixel-space noise at every step, and the fade windows would crawl in
    // every shadow. Hashed on 25 cm world cells, a leaf's dither is a fact
    // about the leaf.
    const DITHER_GLSL = (world) => [
      'if (uNoBand < 0.5) {',
      world ? '  float _n = fract(52.9829189 * fract(dot(floor(vBandW.xz * 4.0) + floor(vBandW.y * 4.0), vec2(0.06711056, 0.00583715))));'
            : '  float _n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
      '  float _hw = uFadeW * 0.5;',
      '  float _fo = 1.0 - clamp((vBandD - (uFarB - _hw)) / uFadeW, 0.0, 1.0);',
      '  float _fi = uNearB > 0.5 ? clamp((vBandD - (uNearB - _hw)) / uFadeW, 0.0, 1.0) : 1.0;',
      '  if (_n >= _fo || _n < 1.0 - _fi) discard;',
      '}',
    ].join('\n');
    const BAND_DECL_V = '#include <common>\nuniform float uNearB, uFarB, uNoBand, uFadeW;\nvarying float vBandD;\nvarying vec3 vBandW;';
    const BAND_DECL_F = '#include <common>\nuniform float uNearB, uFarB, uNoBand, uFadeW;\nvarying float vBandD;\nvarying vec3 vBandW;';
    // the draw material: chained onto whatever the part already carries
    // (trees.js's AO hook), never overwriting it
    // A CLONE, NOT THE CACHED MATERIAL. treeBuild hands out ONE material per
    // rung, and dressing it in place gave that band to every mesh that
    // borrowed the rung: the fill drew the fir's L2 with the woodland's
    // 300-450 m band on it, and every fill fir vanished inside 300 m. The
    // clone shares userData by reference, which is where the tint and cutoff
    // uniforms live, so the dials keep reaching it.
    // (r, n): rung r of a ladder n rungs long; the edges are the shared
    // uniforms, so TREE_LOD.set moves every band at once
    const bandEdges = (r, n) => ({ near: r ? LOD_U[r - 1] : U0, far: (r === n - 1) ? uNear : LOD_U[r] });
    const bandMat = (mat, r, n) => {
      const m = mat.clone();
      m.userData = mat.userData;
      const prev = mat.onBeforeCompile, E = bandEdges(r, n);
      m.onBeforeCompile = sh => {
        if (prev) prev(sh);
        if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
        sh.uniforms.uNearB = E.near;
        sh.uniforms.uFarB = E.far;
        sh.uniforms.uNoBand = uNoBand;
        sh.uniforms.uFadeW = uFadeW;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', BAND_DECL_V)
          .replace('#include <project_vertex>', '#include <project_vertex>\n' +
            BAND_GLSL(BAND_ORIGIN_VIEW));
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', BAND_DECL_F)
          .replace('#include <alphatest_fragment>', DITHER_GLSL(false) + '\n#include <alphatest_fragment>');
      };
      return m;
    };
    const bandDepth = (mat, r, n) => {
      if (TSL_ON) return null;   // W0.5b: same (the band collapse is not in the shadow yet under the flag)
      const E = bandEdges(r, n);
      const d = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        // the cutout, which the derived depth material never had
        map: mat.map || null, side: mat.side,
        alphaTest: (mat.userData && mat.userData.uCut) ? mat.userData.uCut.value : (mat.alphaTest || 0),
      });
      d.onBeforeCompile = sh => {
        sh.uniforms.uNearB = E.near;
        sh.uniforms.uFarB = E.far;
        sh.uniforms.uCam = uCam;
        sh.uniforms.uNoBand = uNoBand;
        sh.uniforms.uFadeW = uFadeW;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', BAND_DECL_V + '\nuniform vec3 uCam;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n' +
            BAND_GLSL(BAND_ORIGIN_CAM, true));
        // no dither in the shadow pass: the hard band above is the whole rule
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', BAND_DECL_F);
      };
      return d;
    };

    // ONE LADDER PER SERIES, for whoever plants it: every rung the payload
    // has for the series (three since the ladder is generated for every
    // pack), each dressed with its band, and the L0 parts kept for the
    // series' own impostor bake - a snag seen from 500 m is a snag, not a
    // fir. The snag has one rung and it spans the whole near tier.
    const ladderFor = (key, ser) => {
      const S = treeList().find(e => e.key === key).sub;
      const list = (S[ser] && S[ser].length) ? S[ser] : S.rungs;
      const n = Math.min(list.length, LOD_R.length);
      const ladder = [];
      for (let r = 0; r < n; r++) {
        const B = treeBuild(THREE, key, r, ser);
        ladder.push({ r, n, parts: B.parts.map(q => ({
          geo: q.geo, mat: bandMat(q.mat, r, n), depth: bandDepth(q.mat, r, n) })) });
      }
      const B0 = treeBuild(THREE, key, 0, ser);
      return { name: ser, ladder, parts: B0.parts, scaleY: B0.scaleY || 1 };
    };
    // The streamed fill below dresses its own material with this too, so it
    // lives outside the replant, with the registers.
    const nearOnly = mat => {
      mat.onBeforeCompile = sh => {
        sh.uniforms.uNearB = uNear;
        if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uNearB;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n' +
            BAND_ORIGIN_VIEW + '\nif (bandD > uNearB) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
      };
      return mat;
    };

    // the scratch objects the streamed fill borrows as well
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0),
          pv = new THREE.Vector3(), sv = new THREE.Vector3(), c3 = new THREE.Color();
    // SHARED WITH THE STREAMED FILL BELOW, so they live outside the replant:
    // that layer pushes its own chunks into these same two registers and reads
    // the same ramp, and a replant that rebuilt them would orphan every chunk
    // the streamer had added.
    const nearChunks = [], impChunks = [];  // distance-culled: see lodUpdate
    // W0c.4: chunks whose rung meshes are PARTITIONED on the CPU - see
    // partitionChunk; cleared and refilled by each plant
    const ladderChunks = [];
    // per-species colour ramps (stage 2): spruce, pine, oak, birch, willow
    const SPC = [
      [C(0x2e4620), C(0x486327)],
      [C(0x4c6a2f), C(0x6f8038)],
      [C(0x5b7333), C(0x84813c)],
      [C(0x7c8f3f), C(0xa39f55)],
      [C(0x6d874d), C(0x8fa05e)],
    ];
    let PROTO = null;
    let planted = [];                 // meshes this layer put in the scene
    let plantedKit = [];              // and what it made for them: atlas, mats
    const protoParts = P => P.parts.map(q => q.geo);
    [trunkGeo, coneGeo, blobGeo].forEach(g => chunkBounds(g, CHW));

    // WHICH SUBJECT STANDS IN FOR WHICH SLOT, once, for both layers. The
    // curated set is all conifer, so the broadleaf slot is filled by a conifer
    // too - a CONTENT gap, not a pipeline one.
    // THE POOL (W0c.14): every subject of every collection in the payload,
    // weighted the bench's way - a collection's `proportion` is its share of
    // the wood, and its subjects split that share between them, so a pack
    // with two trees does not quietly become two thirds of the forest. The
    // game planted two subjects by regex before this (Fir01 and LOLIPOP's
    // big fir) and the larch, the spruce and the small fir sat in the
    // payload undrawn. A tree's prototype is a weighted draw on one hash of
    // its own position, the same for both layers.
    const treePool = () => {
      const pool = [];
      for (const e of treeList()) {
        const n = e.col.subjects.length || 1;
        const w = ((e.col.place && e.col.place.proportion !== undefined) ? e.col.place.proportion : 1) / n;
        if (w > 0) pool.push({ key: e.key, w });
      }
      return pool;
    };
    // ================= SPECIES BY PLACE (W0c.29) ===========================
    // "Slightly cluster by species... always have a little mix, but zones
    // denser in a given species; start with altitude and ground type." A
    // tree's draw from the pool is weighted three ways on top of the
    // collection's `proportion`: the ALTITUDE band the species is at home
    // in (full weight inside, fading to a quarter over 60 m outside), its
    // own PATCHES (a value noise per species at its own wavelength, squared
    // so a patch reads as a stand and not a tint), and the GROUND under it.
    // THE GROUND IS NOT THE SURFACE CLASS (W0c.30): a forest point is
    // FOREST_FLOOR by definition - the classifier returns SAND or SCREE
    // before it ever says forest - so the first cut's "sand" and "scree"
    // bonuses could never fire. What a forest point can be is WET (within
    // 60 m of water: `world.hydro.distW`, the riparian strip the woodland
    // planter also knows) or STEEP (a slope over 0.3 from two more terrain
    // samples), and those are the two grounds here. Nothing goes to zero,
    // so every stand keeps a little of everything. The bands are a first
    // guess at a temperate valley - cedar low and wet, the firs on the
    // slopes, spruce and larch up the hill - written as data so they can move.
    const SPECIES_PREF = {
      'cedar_tree.glb':                              { alt: [0, 90],   zone: 420, ground: 'wet' },
      'realistic_fir_trees_pack_lods_gameready.glb': { alt: [0, 160],  zone: 340 },
      'fir_tree_georgeous.glb':                      { alt: [30, 220], zone: 360 },
      'spruce_tree.glb':                             { alt: [70, 320], zone: 300 },
      'larch_tree.glb':                              { alt: [150, 460], zone: 480, ground: 'steep' },
    };
    // the ground under one point, once per draw: { wet, steep }
    const groundAt = (x, z, h) => {
      const dW = (world.hydro && world.hydro.distW) ? world.hydro.distW(x, z) : 1e9;
      const sl = Math.hypot(world.terrainH(x + 16, z) - h, world.terrainH(x, z + 16) - h) / 16;
      return { wet: dW < 60, steep: sl > 0.3 };
    };
    // value noise on the tree hash: bilinear over `cell`, seeded per species
    const vnoise = (x, z, cell, seed) => {
      const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
      const tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
      const n = (a, b) => hsh(a * 7 + seed * 131, b * 13 + seed * 17);
      return (n(ix, iz) * (1 - sx) + n(ix + 1, iz) * sx) * (1 - sz) + (n(ix, iz + 1) * (1 - sx) + n(ix + 1, iz + 1) * sx) * sz;
    };
    const prefOf = key => SPECIES_PREF[String(key).split('|')[0]] || null;
    const speciesWeight = (entry, i, x, z, h, g) => {
      const P = prefOf(entry.key);
      if (!P) return entry.w;
      let w = entry.w;
      const [lo, hi] = P.alt;
      const out = h < lo ? lo - h : h > hi ? h - hi : 0;
      w *= Math.max(0.25, 1 - out / 60 * 0.75);
      const n = vnoise(x, z, P.zone, i + 1);
      w *= 0.3 + 1.4 * n * n;
      if (P.ground && g && g[P.ground]) w *= 1.6;
      return w;
    };
    // the draw: r in [0,1) over the local weights at (x, z, h)
    // the weights are computed once per draw, not twice (W0c.30)
    const poolW = new Float64Array(16);
    const poolPick = (pool, r, x, z, h) => {
      const at = x !== undefined;
      const g = at ? groundAt(x, z, h) : null;
      let tot = 0;
      for (let i = 0; i < pool.length; i++) tot += poolW[i] = at ? speciesWeight(pool[i], i, x, z, h, g) : pool[i].w;
      let acc = r * tot;
      for (let i = 0; i < pool.length; i++) { acc -= poolW[i]; if (acc <= 0) return i; }
      return pool.length - 1;
    };
    // AND THE MAPS MUST HAVE LANDED BEFORE ANYTHING BAKES. treeWarm resolves on
    // the bytes; the leaf textures load after, on their own timers, and an
    // impostor atlas baked in between renders every card solid - the round
    // black blobs on every far hillside (TREE-IMPORT.md §6 trap 2, again).
    // So: warm, BUILD the subjects (which is what requests the maps), wait for
    // the maps, and only then plant. Both layers go through this one promise.
    let treeSettled = null;
    treeSettleOf = () => treeSettle();
    const treeSettle = () => {
      if (treeSettled) return treeSettled;
      if (typeof treeWarm !== 'function' || typeof treeMapsReady !== 'function')
        return (treeSettled = Promise.reject(new Error('no tree loader')));
      treeSettled = treeWarm().then(() => {
        // EVERY rung of every series, because a pack's coarse rung can wear a
        // map of its own (LOLIPOP's L3 is a card with its own texture), and a
        // map first requested after this promise is a map the bake never waits
        // for - measured as a normal sheet of solid cards over an empty albedo
        for (const ser of SERIES)
          for (const e of treeList()) {
            const S = e.sub, list = (S[ser] && S[ser].length) ? S[ser] : S.rungs;
            for (let r = 0; r < list.length; r++) treeBuild(THREE, e.key, r, ser);
          }
        return treeMapsReady();
      });
      return treeSettled;
    };

    function plantWoodland() {
      // Undo the previous plant. The InstancedMeshes and the impostor atlas are
      // OURS and go; the geometry and materials of a real tree are NOT — they
      // belong to trees.js's build cache and are shared with anything else that
      // asks for that subject.
      for (const m of planted) { scene.remove(m); if (m.dispose) m.dispose(); }
      for (const k of plantedKit) if (k && k.dispose) k.dispose();
      planted = []; plantedKit = [];
      // and the registers, OURS only - the streamer's entries stay
      for (const list of [nearChunks, impChunks])
        for (let i = list.length - 1; i >= 0; i--) if (list[i].own) list.splice(i, 1);
      // the fill's records live in the same register: leave them
      for (let i = ladderChunks.length - 1; i >= 0; i--) if (ladderChunks[i].own) ladderChunks.splice(i, 1);

      PROTO = null;
      if (typeof treeReady === 'function' && treeReady() && typeof treeBuild === 'function') {
        try {
          // `parts` is L0 (what the impostor bakes from); `ladder` is every
          // rung of the series, dressed with its band - see ladderFor
          const withLadder = key => {
            const col = treeList().find(e => e.key === key).col;
            const out = { series: SERIES.map(ser => ladderFor(key, ser)),
                          dead: (col.place && col.place.dead) || 0,
                          sink: (col.place && col.place.sink) || 0,
                          size: (col.place && col.place.size) || 1 };
            return Object.assign(out, { parts: out.series[0].parts });
          };
          const pool = treePool();
          PROTO = pool.length ? pool.map(p => Object.assign(withLadder(p.key), { w: p.w, key: p.key })) : null;
        } catch (e) { PROTO = null; }
      }
      if (PROTO) {
        // the chunk sphere trick applies to a real tree exactly as to a cone —
        // and chunkBounds is also what stashes userData.shape, which the
        // impostor bake reads for its ortho extent
        for (const P of PROTO) for (const S of P.series)
          for (const R of S.ladder) for (const q of R.parts) { chunkBounds(q.geo, CHW); plantedKit.push(q.depth, q.mat); }
      }

    // 3D tier: collapse every instance past NEAR_R. View-space length IS the
    // camera distance, so this costs one compare and needs no extra uniform.
    // The shadow pass renders through its OWN depth material, so the collapse
    // above never reaches it — that is why the near forest was measured being
    // submitted twice. Same radius, measured from the CG because the sun's
    // shadow camera follows the aircraft rather than the eye.
    const treeDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    treeDepth.onBeforeCompile = sh => {
      sh.uniforms.uNearB = uNear;
      sh.uniforms.uCam = uCam;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uNearB;\nuniform vec3 uCam;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n' +
          BAND_ORIGIN_CAM + '\nif (bandD > uNearB) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
    };

    const cells = new Map();
    for (const T of P.concat(placedRecords())) {
      const cx = Math.floor(T.x / CHW), cz = Math.floor(T.z / CHW);
      const k = cx * 4096 + cz;
      let a = cells.get(k);
      if (!a) cells.set(k, a = { cx, cz, list: [] });
      a.list.push(T);
    }
    const trunkMat = nearOnly(worldLambert({ color: C(0x584431) }));
    const canopyMat = nearOnly(worldLambert({ vertexColors: true }));
    // Impostors carry NO trunk: 1.9 m tall and 0.4 m wide is a fifth of a pixel
    // at 450 m, which is the same argument that already switched trunks off at
    // 900 m — and a brown trunk cannot ride a per-species tint anyway.
    const impQuadW = impQuad(CHW);
    // one atlas per SERIES per side: the far band of a dead tree is a dead tree
    const impMatsFor = (P, fallbackGeo) => {
      const srcs = P ? P.series.map(S => S.parts) : [fallbackGeo];
      return srcs.map((src, si) => {
        const gain = P ? impaOf(P.key) : 6;
        const at = bakeImpostorAtlas(src), m = impostorMat(at, FAR_WOOD, si, P ? tintUniformsOf(src) : null, gain);
        m.userData.depth = impostorDepth(at, si, false, gain);
        m.userData.farDepth = impostorDepth(at, si, true, gain);
        if (m.userData.farDepth)   // null under the W0.5b flag (no custom depth)
          (m.userData.farDepth.userData = m.userData.farDepth.userData || {}).cover = impostorDepth(at, si, 'cover', gain);
        plantedKit.push(m);                                            // the atlas is the cache's
        if (m.userData.depth) plantedKit.push(m.userData.depth);
        if (m.userData.farDepth) plantedKit.push(m.userData.farDepth);
        return m;
      });
    };
    // one group per prototype (the fallback keeps its two: cone and blob)
    const GROUPS = PROTO
      ? PROTO.map((P, gi) => ({ P, imp: impMatsFor(P, null), geo: null }))
      : [{ P: null, imp: impMatsFor(null, coneGeo), geo: coneGeo },
         { P: null, imp: impMatsFor(null, blobGeo), geo: blobGeo }];
    // a placed tree with a key goes to that subject's group; anything else
    // is the pool's weighted draw on its position
    const groupOf = T => PROTO
      ? ((T.key && PROTO.findIndex(Q => Q.key === T.key) >= 0) ? PROTO.findIndex(Q => Q.key === T.key)
                                                                : poolPick(PROTO, hsh(Math.round(T.x * 3.7), Math.round(T.z * 5.3)), T.x, T.z, T.h))
      : (T.sp < 2 ? 0 : 1);
    plantedKit.push(trunkMat, canopyMat);
    for (const cell of cells.values()) {
      const ox = (cell.cx + 0.5) * CHW, oz = (cell.cz + 0.5) * CHW;
      const lists = GROUPS.map(() => []);
      for (const T of cell.list) lists[groupOf(T)].push(T);
      const mk = (geo, mat, n, shadow) => {
        if (!n) return null;
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.position.set(ox, 0, oz);
        if (shadow) { m.castShadow = true; m.receiveShadow = true; }
        return m;
      };
      const hd = CHW * Math.SQRT1_2;        // chunk half-diagonal
      // a real tree carries its own trunk as a PART, so the shared trunk
      // cylinder is only built for the fallback
      const trunks = PROTO ? null : mk(trunkGeo, trunkMat, cell.list.length, false);

      // ONE SIDE OF THE CHUNK: conifer or broadleaf. Every series gets its own
      // rung meshes and its own impostor mesh, all at capacity n - which series
      // an instance is drawn as is decided once, by the mix, and the rung by the
      // partition as the aircraft moves. A series nobody was assigned to costs
      // one empty mesh per part and is never submitted.
      const side = (list, P, impM, fallbackGeo) => {
        const n = list.length;
        if (!n) return null;
        if (!P) {                                            // the cone
          const m = mk(fallbackGeo, canopyMat, n, true);
          m.customDepthMaterial = TSL_ON ? null : treeDepth;
          const mi = mk(impQuadW, impM[0], n, false);
          return { n, meshes: [m], imps: [mi], rec: null, ser: null };
        }
        const ser = new Uint8Array(n);
        const cnt = [0, 0, 0];
        list.forEach((T, i) => { ser[i] = seriesOf(T.r, P.dead); cnt[ser[i]]++; });
        const rec = { n, mats: new Float32Array(n * 16), pos: new Float32Array(n * 3), ser,
                      buf: [], rungs: [], x: ox, z: oz, own: true };
        const meshes = [], imps = [];
        P.series.forEach((S, si) => {
          rec.buf.push(S.ladder.map(() => new Float32Array(cnt[si] * 16)));
          rec.rungs.push(S.ladder.map(() => []));
          if (!cnt[si]) { imps.push(null); return; }
          S.ladder.forEach((R, ri) => { for (const q of R.parts) {
            const m = mk(q.geo, q.mat, cnt[si], true);
            m.customDepthMaterial = q.depth;
            // THE COLOUR BUFFER IS ALLOCATED AT CAPACITY, HERE, before the
            // count is parked at 0: r128's setColorAt sizes it from the live
            // count on first use, and a mesh parked first got an EMPTY buffer
            // - every colour write landed nowhere and the shader read zero.
            // The whole near tier was black through two rounds of shading
            // work aimed at the lights. (r128 has no setColorAt on capacity.)
            m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cnt[si] * 3).fill(1), 3);
            m.count = 0; m.visible = false;
            m.userData.ser = si;              // which series, for the probes
            rec.rungs[si][ri].push(m);
            meshes.push(m);
          } });
          const mi = mk(impQuadW, impM[si], cnt[si], false);
          if (impM[si].userData.depth) { mi.castShadow = true; mi.customDepthMaterial = impM[si].userData.depth; }
          if (impM[si].userData.farDepth) farRegister(mi, impM[si].userData.farDepth);
          mi.userData.ser = si;
          imps.push(mi);
        });
        return { n, meshes, imps, rec, ser, cnt, scaleY: P.series.map(S => S.scaleY), sink: P.sink, size: P.size };
      };
      const HS = GROUPS.map((G, gi) => side(lists[gi], G.P, G.imp, G.geo));

      const fill = (H, list) => {
        if (!H) return;
        const at = [0, 0, 0];                              // per-series write index
        list.forEach((T, i) => {
          const w = T.r, sp = T.sp;
          q.setFromAxisAngle(up, w * 6.283);
          if (PROTO) { const s = T.placed ? H.size * T.size : sizeOf(H.size, w); sv.set(s, s, s); }
          else sv.set(T.s * (0.86 + w * 0.28), T.s * (0.9 + w * 0.3), T.s * (0.86 + w * 0.28));
          // BURIED BY THE COLLECTION'S OWN `sink`: the packs model the root
          // flare, and a tree standing on its roots reads as fallen over. The
          // bench's dial, scaled with the instance as the bench scales it.
          pv.set(T.x - ox, T.h - 0.05 - (H.sink || 0) * sv.y, T.z - oz);   // chunk-local
          // the species shapes are the CONE's - a real tree has its own
          if (!PROTO) {
            if (sp === 1) { sv.x *= 0.78; sv.z *= 0.78; sv.y *= 1.15; }        // pine: tall, narrow
            else if (sp === 3) sv.multiplyScalar(0.82);                        // birch: slighter
            else if (sp === 4) { sv.y *= 0.72; sv.x *= 1.18; sv.z *= 1.18; }   // willow: low, wide
          }
          const si = H.ser ? H.ser[i] : 0;
          // the stand series is drawn stretched - the dial, not the bake
          if (H.scaleY) sv.y *= H.scaleY[si];
          m4.compose(pv, q, sv);
          if (trunks) trunks.setMatrixAt(i, m4);
          // a baked tree wears its own colour; tinting it again would paint one
          // green over the whole stand
          if (PROTO) c3.setRGB(1, 1, 1);
          else c3.copy(SPC[sp][0]).lerp(SPC[sp][1], w);
          if (H.rec) {
            // the partition record, indexed as the SERIES sees it
            m4.toArray(H.rec.mats, i * 16);
            H.rec.pos.set([T.x, T.h, T.z], i * 3);
            const j = at[si]++;
            const mi = H.imps[si];
            mi.setMatrixAt(j, m4); mi.setColorAt(j, c3);
            for (const band of H.rec.rungs[si]) for (const m of band) m.setColorAt(j, c3);
          } else {
            for (const m of H.meshes) { m.setMatrixAt(i, m4); m.setColorAt(i, c3); }
            H.imps[0].setMatrixAt(i, m4); H.imps[0].setColorAt(i, c3);
          }
        });
      };
      HS.forEach((H, gi) => fill(H, lists[gi]));

      const all = [trunks];
      for (const H of HS) if (H) all.push(...H.meshes, ...H.imps);
      for (const m of all) {
        if (!m) continue;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        scene.add(m);
        planted.push(m);
      }
      // the partitioned meshes are managed by the partition alone (visibility
      // included); the fallback and the impostors ride the chunk registers
      if (PROTO) {
        for (const H of HS) if (H && H.rec) ladderChunks.push(H.rec);
      } else {
        nearChunks.push({ m: [trunks].concat(...HS.map(H => H ? H.meshes : [])),
                          x: ox, z: oz, r: NEAR_R + hd, own: true });
      }
      impChunks.push({ m: [].concat(...HS.map(H => H ? H.imps : [])).filter(Boolean),
                       x: ox, z: oz, r: FAR_WOOD + hd, own: true });
    }
    }                                     // ---- end plantWoodland

    let lodTick = 0;
    lodUpdate = cg => {
      for (const list of [nearChunks, impChunks]) for (const t of list) {
        const dx = t.x - cg[0], dz = t.z - cg[2];
        const on = dx * dx + dz * dz < t.r * t.r;
        for (const m of t.m) if (m) m.visible = on;
      }
      // the ladder partition, on its cadence - and only for chunks that can
      // hold a live instance of any rung at all
      // FROM THE EYE, like the shader band. The partition measured from the
      // CG and the band from the camera; with the chase camera 30 m behind
      // the aircraft, a tree in between was dealt to one rung by the
      // partition and collapsed by that rung's band - a gap that moved with
      // the aeroplane, on top of the slicing.
      const eye = [uCam.value.x, uCam.value.y, uCam.value.z];
      const moved = !lodAt || Math.hypot(eye[0] - lodAt[0], eye[2] - lodAt[2]) > LOD_MOVE;
      if (lodTick++ % LOD_TICK === 0 || moved) {
        lodAt = eye;
        const reach = uNear.value + CHW * Math.SQRT1_2;
        for (const rec of ladderChunks) {
          const dx = rec.x - eye[0], dz = rec.z - eye[2];
          if (dx * dx + dz * dz > reach * reach) { parkChunk(rec); continue; }
          partitionChunk(rec, eye);
        }
      }
    };
    plantWoodland();
    // ONE CALL, AND IT WAS THE WHOLE OF W0c'S LAST MILE. Everything else was
    // written and gated: the payload, the codec, the loader, the switch above.
    // Nothing fetched the bytes, so treeReady() was false at every boot and the
    // world drew the 14-triangle cone it has drawn since W17. A rejection is
    // the asset-absent path and already handled — the cone stays.
    if (typeof treeReady === 'function' && !treeReady())
      treeSettle().then(() => { plantWoodland(); }).catch(() => {});

    // ---- W13 dense fill: the collidable set is a 64 m stage-2 grid, so
    // stands render sparse even with the clump layer. This plants
    // render-only canopies on a ~9 m jittered grid wherever the biome
    // classifier says FOREST_FLOOR, streamed in 1024 m chunks around the
    // aircraft. Canopies only — no trunks, no shadows, no physics: cheapest
    // possible trees, per the design call that collision only matters at the
    // strips, which keep their exclusion margins here.
    // W17: the grid went 13.1 -> 9.1 m (2.05x the trees) and the streamed ring
    // came in from 5.6 to 4.1 km — the ring edge is no longer hidden by the
    // 5.2 km fog wall but by the terrain's canopy texture taking over under
    // ~74% fog. That trade is the whole point of the ladder: a mid-band tree
    // costs 2 triangles now, so the budget buys density. Chunk size stayed at
    // 1024 m deliberately — the generator's cost is per grid POINT, so halving
    // the spacing at a constant chunk size would have quadrupled the per-chunk
    // hitch (~3 -> 12 ms); at 2x it lands near 6 ms, which the burst budget
    // below still hides.
    {
      // DENSITY IS A DIAL. NG is the fill grid per 1024 m chunk: 112 is the
      // W17 number (9.1 m spacing, ~11 000/km² before dropout), and a closed
      // conifer stand is 30-60 000/km². window.TREE_FILL.set(ng) re-grids
      // live - every chunk is evicted and regenerates - so the density the
      // machine can carry is measured, not guessed. The per-chunk cost is per
      // grid POINT, so the streamer's budget below is what hides a bigger NG.
      const CH = 1024, R_ACT = FAR_FILL + 100, R_DROP = FAR_FILL + 800;
      // ONE GRID, TWO PARTS (LOADING S3; G400's coarser far chunks, re-cut).
      // Every chunk walks the SAME NG grid: the BASE part is the even
      // sub-lattice (gx, gz both even - a quarter of the points, G400's far
      // density, everywhere out to R_ACT), the FILL part is the other three
      // quarters, added inside FILL_ACT and dropped past FILL_DROP. Nothing is
      // regenerated when a chunk comes near: its base stays, its complement
      // is added beside it, and the shader thins the complement with distance
      // (uThin) so the density never steps. The hash is keyed on the full
      // grid's index for both parts: the same point is the same tree.
      const FILL_ACT = uThin.value.y + CH * Math.SQRT1_2 + 100, FILL_DROP = FILL_ACT + 800;
      const BASE = 0, FILLP = 1;
      // 160 (6.4 m, ~21 000/km² before dropout): MEASURED on the RTX 3080 at
      // 1920x1080 in the densest stand, the frame with the specimen L2 in the
      // fill runs 25 ms at 112, 31 at 160, 36 at 224, 54 at 320 - against 17-21
      // at the strip with no near tree at all. 160 is where dense reads as
      // dense and the frame is still the game's; the dial is there to push it.
      const FILL = { ng: world.island ? 160 : 100,   // 10.2 m: "quite OK and balanced" by the user's eye (W0c.31; 112 at W0c.26); an island 6.4 m (G400: "MUCH too sparse")
        // the island's knobs (F8 > trees > from the map): coverage ramps from
        // `from` to `full` metres of canopy; a tree is canopy x gain over the
        // model's own height, clamped
        island: { from: 0.5, full: 6.0, gain: 1.0, min: 0.3, max: 2.2 } };
      const ISLC = world.island && world.island.canopyAt ? world.island : null;
      let NG = FILL.ng, SP2 = CH / NG;
      // nearTree / the exclusions / the corridor live in forestHere now,
      // shared with the terrain's colour bake and the far canopy mask
      const coneF = new THREE.ConeGeometry(1.55, 5.0, 5, 1, true);
      coneF.translate(0, 2.75, 0);
      const blobF = new THREE.IcosahedronGeometry(1.9, 0);
      blobF.scale(1, 1.05, 1); blobF.translate(0, 2.3, 0);
      // same trick as the woodland layer: instances are stored relative to the
      // chunk centre and the shared bounding sphere is inflated to a chunk, so
      // three CAN cull these after all (it never could while the matrices held
      // world coordinates against a 2 m shared sphere).
      [coneF, blobF].forEach(g => chunkBounds(g, CH));
      const matF = nearOnly(worldLambert({ vertexColors: true }));
      // the fill shapes are shorter than the woodland ones (no trunk under
      // them), so they get their own atlases rather than borrowing — the
      // impostor's size and centre height come straight off the source
      // geometry's bounding sphere, and a borrowed atlas would sit 1.2 m high
      const impQuadF = impQuad(CH), hdF = CH * Math.SQRT1_2;
      const chunks = new Map(), queue = [];

      // ================= W0c.2: the fill draws the STAND rung ============
      // This layer plants a tree every 9 m, and inside the near band that is
      // thousands of them: a real LOD0 here is millions of triangles and the
      // layer simply could not use the payload. What it CAN use is the stand
      // series' L2 — the tree inside a wood, top third of the crown on a
      // stick, ~400-1600 triangles against 7 784-12 969 — which tree_prep.py
      // now generates by the bench's own rules. Same replant-on-arrival shape
      // as the woodland: the shapes live in a holder `gen` reads, the cone is
      // what it holds at boot, and when the payload lands the holder is
      // rebuilt and every live chunk evicted so it regenerates with the tree.
      // W0c.5: one shape per SERIES per side, the same mix as the woodland -
      // the fill's near band draws the CHEAPEST rung of whichever series the
      // instance was dealt, and its far band that series' own atlas
      const SHAPE = { list: [], real: false, kit: [] };
      const shapeFallback = geo => { const at = bakeImpostorAtlas(geo); return {
        dead: 0, series: [{ parts: [{ geo, mat: matF }],
                            imp: impostorMat(at, FAR_FILL), scaleY: 1, atlas: at }],
        white: false,
      }; };
      function setShapes() {
        for (const k of SHAPE.kit) if (k && k.dispose) k.dispose();
        SHAPE.kit = [];
        let real = null;
        if (typeof treeReady === 'function' && treeReady() && typeof treeBuild === 'function') {
          try {
            // THE FILL CLIMBS THE SAME LADDER AS THE WOODLAND. It used to
            // draw one rung - the cheapest the series had - across the whole
            // 450 m near tier, and for a pack whose chain ended in a crossed
            // billboard that card was the fill, by the ten thousand, at any
            // distance. Three bands, the generated rungs, one rule.
            const forKey = key => {
              const col = treeList().find(e => e.key === key).col;
              const sub = treeList().find(e => e.key === key).sub;
              return { dead: (col.place && col.place.dead) || 0, white: true,
                       sink: (col.place && col.place.sink) || 0,
                       size: (col.place && col.place.size) || 1,
                       h: (sub && sub.h) || 15,                    // the model's height, metres (W2: the canopy sizes it)
                       series: SERIES.map(ser => Object.assign(ladderFor(key, ser), { imp: null })) };
            };
            const pool = treePool();
            real = pool.length ? pool.map(p => Object.assign(forKey(p.key), { w: p.w, key: p.key })) : null;
          } catch (e) { real = null; }
        }
        SHAPE.list = [];
        SHAPE.real = !!real;
        if (real) {
          for (const H of real) {
            H.series.forEach((S, si) => {
              for (const R of S.ladder) for (const q of R.parts) { chunkBounds(q.geo, CH); SHAPE.kit.push(q.mat, q.depth); }
              const at = bakeImpostorAtlas(S.parts);
              const gain = impaOf(H.key);
              S.imp = impostorMat(at, FAR_FILL, si, tintUniformsOf(S.parts), gain);
              S.imp.userData.depth = impostorDepth(at, si, false, gain);
              S.imp.userData.farDepth = impostorDepth(at, si, true, gain);
              if (S.imp.userData.farDepth)   // null under the W0.5b flag
                (S.imp.userData.farDepth.userData = S.imp.userData.farDepth.userData || {}).cover = impostorDepth(at, si, 'cover', gain);
              // the complement's impostor: the same programs, the thinning ramp for
              // its uniform; it casts with the base's depth materials (the shadow
              // passes only see 1.4 km, where keep is 1)
              S.impFill = impostorMat(at, FAR_FILL, si, tintUniformsOf(S.parts), gain, uThin);
              S.impFill.userData.depth = S.imp.userData.depth; S.impFill.userData.farDepth = S.imp.userData.farDepth;
              SHAPE.kit.push(S.imp, S.impFill, S.imp.userData.depth, S.imp.userData.farDepth);   // the atlas is the cache's (dispose tolerates null)
            });
            SHAPE.list.push(H);
          }
        } else {
          for (const geo of [coneF, blobF]) {
            const sh = shapeFallback(geo);
            SHAPE.list.push(sh);
            SHAPE.kit.push(sh.series[0].imp);
          }
        }
        return !!real;
      }
      setShapes();
      // THE STREAMER'S OWN CLOCK (W0c.30): what a chunk costs to generate,
      // split between the grid walk (classify, place, draw the species) and
      // the build (the matrices, the meshes) - TREE_FILL.stat() reads it
      const STAT = { gens: 0, walkMs: 0, buildMs: 0, lastMs: 0, maxMs: 0, frameMax: 0, trees: 0 };
      // THE WALK IS SLICED (W0c.30): `world.surface` is 2.4 us a call and a
      // chunk is 112 x 112 of them, so the walk alone is ~30 ms - the hitch.
      // It runs in rows, ROWS_PER_FRAME at a time, one frame after another,
      // and the build (the matrices, the meshes) follows in the frame the
      // walk finishes. The rule is unchanged: the same points, the same
      // order, the same draws; only the frame they land in differs.
      // ...AND BUDGETED (S3): the walk takes rows until FILL.budgetMs of the
      // frame is spent, and the build lands in the frame the walk finishes;
      // prewarm() runs the same step with a big budget under the roll-out
      // screen. At 60 m/s the ring needs ~8 ms of work a second; 4 ms a
      // frame is thirty times that.
      function walk(cx, cz, recs, g0, g1, part) {
        const ng = NG, spc = CH / ng;
        for (let gz = g0; gz < g1; gz++) for (let gx = 0; gx < ng; gx++) {
          // the base part is the even sub-lattice; the fill part the rest
          if (part === BASE ? ((gx | gz) & 1) : !((gx | gz) & 1)) continue;
          const ix = cx * ng + gx, iz = cz * ng + gz;
          if (hsh(ix, iz + 31) < 0.1) continue;
          const x = cx * CH + (gx + 0.5) * spc + (hsh(ix + 7, iz) - 0.5) * spc * 1.6;
          const z = cz * CH + (gz + 0.5) * spc + (hsh(ix, iz + 7) - 0.5) * spc * 1.6;
          if (!forestHere(x, z)) continue;  // ONE rule, the bake's too
          // THE MAP'S COVERAGE (W2, 2026-09-14): on an island the canopy height
          // says how much of the grid stands - nothing below `from`, everything
          // above `full`, a ramp between - and rides with the record to size it.
          let can = 0;
          if (ISLC) {
            can = ISLC.canopyAt(x, z);
            // THE RULE (G406, the user: "with the crazy amount of layers we have, we
            // should be able to be quite clever"): the TERRAIN TYPE says what kind of
            // stand can be here (forest full, scrub half, muskeg a stunted few, heath
            // almost none, rock/sand/water none); the CANOPY says how much of it stands
            // (the ramp) and how tall; NDVI is the vigour (a weak stand thins); a slope
            // over 35 deg thins to a third. Species stay the pool's (altitude, wet, steep).
            let kind = 1.0;
            if (ISLC.ttype) { const tt = ISLC.ttype[ISLC.cellAt ? ISLC.cellAt(x, z) : -1];
              kind = tt === 8 ? 1.0 : tt === 7 ? 0.5 : tt === 3 ? 0.12 : tt === 2 ? 0.04 : 0.0;
              if (tt === 3 || tt === 2) can = Math.min(can, 3.0);        // the bog's and the heath's are stunted
              if (kind <= 0.0) continue; }
            let p = (can - FILL.island.from) / Math.max(0.5, FILL.island.full - FILL.island.from);
            if (ISLC.ndvi) { const nd = ISLC.ndvi[ISLC.cellAt(x, z)] / 127 - 1; p *= Math.max(0.25, Math.min(1, (nd - 0.3) / 0.35)); }
            { const d = 8, gx2 = ISLC.terrainH ? 0 : 0; const s2 = Math.hypot(world.terrainH(x + d, z) - world.terrainH(x - d, z), world.terrainH(x, z + d) - world.terrainH(x, z - d)) / (2 * d);
              if (s2 > 0.7) p *= 0.33; }
            p *= kind;
            if (p < 1 && hsh(ix + 13, iz + 29) > p) continue;
          }
          const ti = nearTree(x, z);
          const h = world.terrainH(x, z);
          const sp = (ti >= 0 && hsh(ix + 3, iz + 5) < 0.88) ? world.trees[ti].sp
                                                             : (hsh(ix + 9, iz + 1) * 5) | 0;
          const gi = SHAPE.real ? poolPick(SHAPE.list, hsh(ix + 11, iz + 17), x, z, h) : (sp < 2 ? 0 : 1);
          recs[gi].push(x, h, z, sp, hsh(ix + 2, iz + 8), can);
        }
      }
      // one chunk, whole, in this frame - the teleport's path and the gate's
      function gen(cx, cz, part) {
        const recs = SHAPE.list.map(() => []);
        const t0 = performance.now();
        walk(cx, cz, recs, 0, NG, part);
        return build(cx, cz, recs, t0, performance.now(), part);
      }
      function build(cx, cz, recs, t0, t1, part) {
        const meshes = [], near = [], imp = [], recsOut = [];
        const ox = (cx + 0.5) * CH, oz = (cz + 0.5) * CH;
        recs.forEach((r, gi) => {
          const n = r.length / 6;
          if (!n) return;
          const SH = SHAPE.list[gi];
          // deal every instance its series first, so each series' meshes are
          // sized to what they will hold and nothing empty is submitted
          const ser = new Uint8Array(n), cnt = SH.series.map(() => 0);
          for (let i = 0; i < n; i++) {
            ser[i] = SH.series.length > 1 ? seriesOf(r[i * 6 + 4], SH.dead) : 0;
            cnt[ser[i]]++;
          }
          // one InstancedMesh per PART per series: a real tree is a bark part
          // and a leaf part with their own materials, where the cone was one.
          // THE NEAR MESHES ARE PARTITIONED ON THE CPU like the woodland's:
          // measured at 1 060 000 fill instances a collapsed instance still
          // costs its vertex shader, and that was 90 ms a frame. So the record
          // below holds every instance and the near mesh carries only the ones
          // inside NEAR_R, re-sorted on the cadence; the impostor mesh carries
          // them all, because it is the band beyond.
          // every rung of the ladder gets its meshes (the cone fallback is a
          // one-rung ladder); the partition deals each instance to ONE of them
          const rungsOf = S => S.ladder || [{ parts: S.parts }];
          const perSer = SH.series.map((S, si) => cnt[si] ? {
            byRung: rungsOf(S).map(R => R.parts.map(pq => {
              const m = new THREE.InstancedMesh(pq.geo, pq.mat, cnt[si]);
              // THE FILL CASTS (W0c.17). "Canopies only - no trunks, no
              // shadows" was the cone's rule, and the fill is the tree line
              // now: a stand that shades nothing floats. Its own banded
              // depth material, like the woodland's; the shadow frustum
              // bounds what it costs.
              if (pq.depth) { m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = pq.depth; }
              // colour buffer at capacity BEFORE parking - see the woodland
              m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cnt[si] * 3).fill(1), 3);
              m.count = 0; m.visible = false; return m; })),
            mi: (() => { const IM = (part === FILLP && S.impFill) ? S.impFill : S.imp;   // the complement thins with distance
                         const mi = new THREE.InstancedMesh(impQuadF, IM, cnt[si]);
                         if (S.imp.userData.depth) { mi.castShadow = true; mi.customDepthMaterial = S.imp.userData.depth; }
                         if (S.imp.userData.farDepth) farRegister(mi, S.imp.userData.farDepth);
                         return mi; })(), at: 0 } : null);
          for (const P of perSer) if (P) P.ms = [].concat(...P.byRung);
          const nrOf = S => S.ladder ? S.ladder.length : 1;
          const rec = { n, mats: new Float32Array(n * 16), pos: new Float32Array(n * 3), ser,
                        buf: SH.series.map((S, si) => Array.from({ length: nrOf(S) }, () => new Float32Array(cnt[si] * 16))),
                        rungs: SH.series.map((S, si) => perSer[si] ? perSer[si].byRung : Array.from({ length: nrOf(S) }, () => [])), x: ox, z: oz };
          perSer.forEach((P, si) => { if (P) for (const mm of P.ms.concat([P.mi])) {
            mm.position.set(ox, 0, oz); mm.userData.ser = si; mm.userData.fill = true; } });
          for (let i = 0; i < n; i++) {
            const o = i * 6, sp = r[o + 3], w = r[o + 4], can = r[o + 5];
            const si = ser[i], P = perSer[si], S = SH.series[si];
            q.setFromAxisAngle(up, w * 6.283);
            // THE MAP'S SIZE: on an island a tree is as tall as the canopy
            // map says (x gain), over the model's own height, with the mix's
            // spread as jitter; elsewhere the collection's size
            const s = (ISLC && can > 0 && SH.h)
              ? Math.max(FILL.island.min, Math.min(FILL.island.max, can * FILL.island.gain / SH.h)) * (1 + TREE_MIX.spread * (2 * w - 0.9))
              : SH.white ? sizeOf(SH.size, w)
                         : [1.15, 1.0, 1.1, 0.9, 0.85][sp] * (0.62 + w * 0.55);
            // the stand series is drawn stretched - the dial, not the bake
            sv.set(s, s * (SH.white ? 1 : 0.9 + w * 0.25) * S.scaleY, s);
            pv.set(r[o] - ox, r[o + 1] - 0.05 - (SH.sink || 0) * sv.y, r[o + 2] - oz);
            m4.compose(pv, q, sv);
            // a baked tree wears its own colour (see the woodland layer)
            if (SH.white) c3.setRGB(1, 1, 1);
            else c3.copy(SPC[sp][0]).lerp(SPC[sp][1], w * 0.85);
            const j = P.at++;
            m4.toArray(rec.mats, i * 16);
            rec.pos.set([r[o], r[o + 1], r[o + 2]], i * 3);
            // the matrix is written here too, although the partition will
            // overwrite it: the capacity slot then holds a real tree, which is
            // what GATE WORLDRENDER's cull-sphere check reads
            for (const mm of P.ms) { mm.setMatrixAt(j, m4); mm.setColorAt(j, c3); }
            P.mi.setMatrixAt(j, m4); P.mi.setColorAt(j, c3);
          }
          recsOut.push(rec);
          for (const P of perSer) if (P) {
            for (const mm of P.ms.concat([P.mi])) {
              mm.instanceMatrix.needsUpdate = true;
              if (mm.instanceColor) mm.instanceColor.needsUpdate = true;
              scene.add(mm); meshes.push(mm);
            }
            for (const mm of P.ms) near.push(mm);
            imp.push(P.mi);
          }
        });
        // both tiers are built once, per chunk, from the same records; which one
        // you see is the per-instance band in the shader, and which one is even
        // SUBMITTED is these two registrations (dropped again on eviction)
        // the near meshes are the partition's (visibility included); only
        // the impostors ride the chunk register
        const reg = [{ m: imp, x: ox, z: oz, r: FAR_FILL + hdF }];
        impChunks.push(reg[0]);
        for (const rec of recsOut) ladderChunks.push(rec);
        const t2 = performance.now();
        STAT.gens++; STAT.walkMs += t1 - t0; STAT.buildMs += t2 - t1;
        STAT.lastMs = t2 - t0; STAT.maxMs = Math.max(STAT.maxMs, t2 - t0);
        for (const rec of recsOut) STAT.trees += rec.n;
        return { meshes, reg, recs: recsOut };
      }
      // when the payload lands: new shapes, and every live chunk regenerates
      // through the streamer's own eviction path rather than a second one
      // the chunk under generation: its records, the next row, its clock
      let cur = null;
      // one built part of a chunk goes: its meshes off the scene, its
      // registrations out of the passes and the partition
      const dropPart = built => {
        if (!built) return;
        for (const m of built.meshes) { scene.remove(m); if (m.dispose) m.dispose(); }
        for (const r2 of built.reg) {
          let i = nearChunks.indexOf(r2); if (i >= 0) nearChunks.splice(i, 1);
          i = impChunks.indexOf(r2); if (i >= 0) impChunks.splice(i, 1);
        }
        for (const rec of (built.recs || [])) {
          const i = ladderChunks.indexOf(rec); if (i >= 0) ladderChunks.splice(i, 1);
        }
      };
      // the mix dials (furnished, spread) are dealt at plant time: applying
      // them is a replant of both layers (W0c.31 - "furnished does not seem
      // to work": the dial moved a number nothing re-read)
      TREE_MIX.apply = () => { plantWoodland(); evictAll(); };
      const evictAll = () => {
        cur = null;                        // whatever was being walked is gone with the rest
        for (const [k, c2] of chunks) { dropPart(c2.base); dropPart(c2.fill); chunks.delete(k); }
        queue.length = 0;
      };
      if (typeof treeReady === 'function' && !treeReady())
        treeSettle().then(() => { if (setShapes()) evictAll(); }).catch(() => {});
      FILL.budgetMs = 4;
      // THE TREE STATE (S3): the roll-out screen asks whether the payload is in
      // before it grows the ring, or it would grow cones and evict them
      const TREE_STATE = { v: (typeof treeReady === 'function' && treeReady()) ? 'ready' : 'pending' };
      treeSettle().then(() => { TREE_STATE.v = 'ready'; }).catch(() => { TREE_STATE.v = 'fallback'; });
      if (typeof window !== 'undefined')
        window.TREE_FILL = { get: () => FILL.ng,
          island: () => Object.assign({}, FILL.island),
          setIsland: o => { Object.assign(FILL.island, o || {}); evictAll(); return Object.assign({}, FILL.island); },
          onIsland: () => !!ISLC,
          stat: () => Object.assign({}, STAT, { queued: queue.length, live: chunks.size, busy: !!cur || queue.length > 0 }),
          set: ng => { FILL.ng = NG = Math.max(16, Math.min(400, ng | 0)); SP2 = CH / NG; evictAll(); return NG; },
          // the thinning ramp (metres): full density to d0, the base's quarter from d1
          thin: (d0, d1) => { if (d0 !== undefined) uThin.value.set(+d0, Math.max(+d0 + 1, +d1)); return [uThin.value.x, uThin.value.y]; },
          budget: ms => { if (ms !== undefined) FILL.budgetMs = Math.max(0.5, +ms); return FILL.budgetMs; },
          prewarm: (cg, o) => prewarm(cg, o), ringReady: cg => ringReady(cg), ringStat: () => ringStat(),
          treeState: () => TREE_STATE.v };
      let tick = 0;
      // the streamer's worst FRAME - a slice, or the build's - is the hitch
      // a player would see; STAT.frameMax keeps it
      fillUpdate = cg => { const t = performance.now(); fillStep(cg, FILL.budgetMs); STAT.frameMax = Math.max(STAT.frameMax || 0, performance.now() - t); };
      const keyOf = (cx, cz) => cx * 4096 + cz;
      const d2Of = (c2, cg) => { const ax = (c2.cx + 0.5) * CH - cg[0], az = (c2.cz + 0.5) * CH - cg[2]; return ax * ax + az * az; };
      // what the ring should hold around cg: every chunk inside R_ACT wants
      // its base, every chunk inside FILL_ACT wants its complement too
      const refreshQueue = cg => {
        const R = Math.ceil(R_ACT / CH);
        const ccx = Math.floor(cg[0] / CH), ccz = Math.floor(cg[2] / CH);
        for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) {
          const cx = ccx + dx, cz = ccz + dz;
          const mx2 = (cx + 0.5) * CH - cg[0], mz2 = (cz + 0.5) * CH - cg[2];
          const dd = mx2 * mx2 + mz2 * mz2;
          if (dd > R_ACT * R_ACT) continue;
          { const wx = (cx + 0.5) * CH, wz = (cz + 0.5) * CH;
            if (wx < world.bounds.x0 || wx > world.bounds.x1 || wz < world.bounds.z0 || wz > world.bounds.z1) continue; }
          const k = keyOf(cx, cz);
          let c2 = chunks.get(k);
          if (!c2) { c2 = { cx, cz, base: null, fill: null, qb: false, qf: false }; chunks.set(k, c2); }
          if (!c2.base && !c2.qb) { c2.qb = true; queue.push({ k, part: BASE }); }
          if (!c2.fill && !c2.qf && dd < FILL_ACT * FILL_ACT) { c2.qf = true; queue.push({ k, part: FILLP }); }
        }
        // nearest first, the base of a chunk before its complement
        for (let i = queue.length - 1; i >= 0; i--) {
          const c2 = chunks.get(queue[i].k);
          if (!c2 || (queue[i].part === BASE ? c2.base : c2.fill)) queue.splice(i, 1);
        }
        queue.sort((a, b) => (d2Of(chunks.get(a.k), cg) + a.part * 1e5) - (d2Of(chunks.get(b.k), cg) + b.part * 1e5));
      };
      // what the ring no longer holds: past R_DROP the chunk goes whole, past
      // FILL_DROP its complement goes and its base stays - never a regeneration
      const evictPass = cg => {
        for (const [k, c2] of chunks) {
          const dd = d2Of(c2, cg);
          if (dd >= R_DROP * R_DROP) {
            if (cur && cur.c2 === c2) cur = null;
            dropPart(c2.base); dropPart(c2.fill); chunks.delete(k);
          } else if (c2.fill && dd >= FILL_DROP * FILL_DROP) {
            if (cur && cur.c2 === c2 && cur.part === FILLP) cur = null;
            dropPart(c2.fill); c2.fill = null; c2.qf = false;
          }
        }
      };
      // one frame's (or one prewarm tick's) worth of streaming: walk rows of
      // the part under generation until the budget is spent; a finished walk
      // builds at once and, budget permitting, the next queued part starts
      const fillStep = (cg, budgetMs) => {
        const t0 = performance.now();
        const maint = !(tick++ % 12) || (!cur && queue.length);
        if (maint) refreshQueue(cg);
        let built = 0;
        for (;;) {
          if (!cur) {
            if (!queue.length) break;
            const q = queue.shift(), c2 = chunks.get(q.k);
            if (!c2 || (q.part === BASE ? c2.base : c2.fill)) continue;
            cur = { c2, part: q.part, recs: SHAPE.list.map(() => []), gz: 0, walkMs: 0 };
          }
          const t = performance.now();
          const g1 = Math.min(NG, cur.gz + 8);
          walk(cur.c2.cx, cur.c2.cz, cur.recs, cur.gz, g1, cur.part);
          cur.walkMs += performance.now() - t; cur.gz = g1;
          if (g1 >= NG) {
            const c2 = cur.c2, part = cur.part;
            // evicted while it was being walked: nothing to build
            if (chunks.get(keyOf(c2.cx, c2.cz)) === c2) {
              const b = build(c2.cx, c2.cz, cur.recs, performance.now() - cur.walkMs, performance.now(), part);
              if (part === BASE) { c2.base = b; c2.qb = false; } else { c2.fill = b; c2.qf = false; }
              built++;
            }
            cur = null;
            if (built >= 2) break;         // two builds a step at most: a build is the hitch
          }
          if (performance.now() - t0 >= budgetMs) break;
        }
        if (maint) evictPass(cg);
      };
      // THE ROLL-OUT SCREEN'S STEP (S3): a big budget, nobody watching. Returns
      // where the ring stands; done when every chunk inside R_ACT has its base
      // and every chunk inside FILL_ACT its complement. While the payload is
      // still pending it does no walking (the cones would be evicted when the
      // trees land); a failed payload is 'fallback' and the cones are the ring.
      const ringReady = cg => {
        const R = Math.ceil(R_ACT / CH);
        const ccx = Math.floor(cg[0] / CH), ccz = Math.floor(cg[2] / CH);
        for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) {
          const cx = ccx + dx, cz = ccz + dz;
          const mx2 = (cx + 0.5) * CH - cg[0], mz2 = (cz + 0.5) * CH - cg[2];
          const dd = mx2 * mx2 + mz2 * mz2;
          if (dd > R_ACT * R_ACT) continue;
          { const wx = (cx + 0.5) * CH, wz = (cz + 0.5) * CH;
            if (wx < world.bounds.x0 || wx > world.bounds.x1 || wz < world.bounds.z0 || wz > world.bounds.z1) continue; }
          const c2 = chunks.get(keyOf(cx, cz));
          if (!c2 || !c2.base) return false;
          if (dd < FILL_ACT * FILL_ACT && !c2.fill) return false;
        }
        return !cur;
      };
      const ringStat = () => { let base = 0, fill = 0; for (const [, c2] of chunks) { if (c2.base) base++; if (c2.fill) fill++; }
        return { live: chunks.size, base, fill, queued: queue.length, busy: !!cur || queue.length > 0, budgetMs: FILL.budgetMs, trees: STAT.trees, gens: STAT.gens }; };
      const prewarm = (cg, o) => {
        const budget = (o && o.budgetMs) || 60;
        if (TREE_STATE.v === 'pending') return Object.assign({ phase: 'trees', done: false, trees: 'pending' }, ringStat());
        tick = 0;                          // a maintenance pass every tick under the screen
        fillStep(cg, budget);
        const done = ringReady(cg);
        return Object.assign({ phase: done ? 'done' : 'ring', done, trees: TREE_STATE.v }, ringStat());
      };
      fillApi = { prewarm, ringReady, ringStat, treeState: () => TREE_STATE.v };   // after the consts: no dead zone
    }
  }

  // ...unless HOME is a premises runway with no declared site furniture (an
  // island's field, G404): the premises renderer draws its strip, apron and
  // buildings, and there is no analytic shed, fence or windsock to stand
  if (!(world.island && !(siteOf('HOME') && siteOf('HOME').hangar))) { // THE BASE AERODROME, from the ONE declaration (G123)
    // Every number in this block used to be a literal: a 1100 x 30 strip at
    // (-520, 0) restated by hand beside the 'HOME' record that already said
    // so, three coloured boxes for buildings, and decals for an apron that ran
    // under one of them and a taxiway that reached nothing. It now reads
    // src/core/25_airfield.js - the runway derived from the registry record,
    // the site (paving, buildings, furniture) declared once and shared with
    // the garage, so the field you taxi on and the field you see through the
    // hangar door cannot disagree.
    //
    // each layer gets its own height: coplanar decals + a log depth buffer z-fight
    // lit like the terrain, so the same sun shadows fall across them
    const SITE = siteOf('HOME');    // the registry's default (HANGARS S5)
    const WANISO = MAX_ANISO;
    const HOME = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
    const R = siteRunway(HOME);
    const decal = (w, h, color, y, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        worldLambert({ color: C(color), depthWrite: false,
          transparent: true }));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = Math.round(y * 100);
      m.receiveShadow = true;
      m.position.set(x, y, z); scene.add(m); return m;
    };
    // rectangles arrive as world-frame {x0,x1,z0,z1}; a decal wants centre+size
    const decalRect = (r, color, y) => decal(Math.abs(r.x1 - r.x0), Math.abs(r.z1 - r.z0),
      color, y, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
    { // strip + all markings baked into ONE texture on ONE plane at 2 cm:
      // the old per-marking decal stack (5..17 cm) was visibly floating and
      // buried the foam trainer (14 cm tall) under its own runway markings.
      //
      const RW = 4096, RH = 128;                       // ~3.7 px/m at 1100 x 30
      const cv2 = document.createElement('canvas'); cv2.width = RW; cv2.height = RH;
      const q = cv2.getContext('2d');
      // the markings are painted by the SITE, not here (G123) — the garage
      // door looks at this same strip, and one recipe is the point.
      // TWO LAYERS, as in the garage: scanned mown grass with the paint laid
      // over it. One canvas of green-with-markings is a picture of a runway,
      // and it cannot wear the grass the field beside it wears.
      sitePaintStrip(q, R, RW, RH, true);              // marks only
      const rtex = new THREE.CanvasTexture(cv2);
      rtex.colorSpace = THREE.SRGBColorSpace;
      rtex.anisotropy = MAX_ANISO;
      const yaw = Math.atan2(-R.dz, -R.dx);
      const mkGeo = (metric) => {
        const g = new THREE.PlaneGeometry(R.len, R.wid);
        if (metric) {
          const uv = g.attributes.uv;
          for (let i = 0; i < uv.count; i++)
            uv.setXY(i, uv.getX(i) * R.len, uv.getY(i) * R.wid);
          uv.needsUpdate = true;
        }
        g.rotateX(-Math.PI / 2);
        // the canvas runs end1 -> end0 along local +x; turn the whole geometry
        // so that axis IS the runway's, whatever heading the record carries
        g.rotateY(yaw);
        return g;
      };
      const gmaps = siteGroundMaps(THREE, 'grass004', 2, WANISO);
      const base = new THREE.Mesh(mkGeo(!!gmaps), gmaps
        ? new THREE.MeshStandardMaterial(Object.assign({
            roughness: 1, metalness: 0, depthWrite: false, transparent: true }, gmaps))
        : worldLambert({ color: C(0x6b7a36), depthWrite: false,
            transparent: true }));
      base.position.set(R.cx, 0.02, R.cz);
      base.renderOrder = 2;
      base.receiveShadow = true;
      scene.add(base);
      const strip = new THREE.Mesh(mkGeo(false),
        new THREE.MeshBasicMaterial({ map: rtex, transparent: true, depthWrite: false }));
      strip.position.set(R.cx, 0.025, R.cz);
      strip.renderOrder = 3;
      scene.add(strip);
    }

    const markGeo = new THREE.BoxGeometry(0.5, 0.7, 1.6);
    const markMat = worldLambert({ color: C(0xe4dccb) });
    for (const P of siteMarkers(HOME)) {
      const m = new THREE.Mesh(markGeo, markMat);
      m.position.set(P.x, 0.35, P.z);
      m.castShadow = true; m.receiveShadow = true; scene.add(m);
    }

    const wall = C(0xcbb79a), roofc = C(0x9c5f43), trim = C(0x6d5744);
    const building = (x, z, w, d, hgt, ry, wc) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d),
        worldLambert({ color: wc || wall }));
      body.position.y = hgt / 2;
      const r = d * 0.60;
      const rg = new THREE.CylinderGeometry(r, r, w * 1.05, 3, 1);
      rg.rotateY(Math.PI / 2); rg.rotateZ(Math.PI / 2);
      const roof = new THREE.Mesh(rg, worldLambert({ color: roofc }));
      roof.position.y = hgt + r * 0.5 - 0.02;
      g.add(body); g.add(roof);
      g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
      g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      return g;
    };
    for (const b of SITE.buildings)
      building(b.x, b.z, b.w, b.d, b.h, b.ry, b.trim ? trim : null);

    // THE HANGAR IS THE HANGAR (G123). Where a 15 x 10 box stood, the real
    // shell now stands - the same genHangarBuild the garage runs, asked for
    // its exterior: doors shut, no fittings, no interior frame, no lights of
    // its own. Its dims are HANDED IN now (HANGARS S1): app.js composes the
    // player's own record over the declaration — which GATE SITE still holds
    // against hangar.js's own defaults — so the building you taxi past is
    // the room you were just standing in, at whatever size the sliders made
    // it. `setShedDims` re-stands it live when they move.
    //
    // It ASKS whether the room can be built at all, the way app.js does: a
    // stubbed THREE is a missing building, not a crash, and the smoke gate
    // runs with one (which also leaves shedDims undefined there — the
    // declaration is the fallback, and SITE.hangar is a legal dims object).
    let shedNode = null;
    function standShed(dims) {
      if (!(typeof genHangarBuild === 'function' &&
            typeof genHangarSupported === 'function' &&
            genHangarSupported(THREE))) return;
      const H = SITE.hangar;
      if (shedNode) {
        // the old building comes down whole: nothing in the exterior is a
        // shared prop geometry, and material.dispose() leaves the memoised
        // sheet textures alone (a dispose never takes maps with it)
        scene.remove(shedNode);
        const mats = new Set();
        shedNode.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material])
            .forEach(m => mats.add(m));
        });
        mats.forEach(m => m.dispose());
        shedNode = null;
      }
      const shed = genHangarBuild(THREE,
        dims || { HW: H.HW, HD: H.HD, EAVE: H.EAVE },
        { exterior: true, shell: dims && dims.shell });
      shed.group.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });

      // AND IT HAS A DISTANCE, because it was measured. The shell is 278
      // meshes and this scene merges and instances nothing, so meshes ARE draw
      // calls: with the camera on the apron the frame went 834 -> 1113, and
      // from 520 m away it went 864 -> 1143. Identically, because the airfield
      // block has no LOD at all — you pay a third more draw calls for a shed
      // that is thirty pixels wide.
      //
      // The triangles were never the problem (+3 466 on 6.86 M, 0.05%). Past
      // 320 m the shell becomes a box and a roof prism wearing the shell's own
      // outer materials, which is all a thirty-pixel building can show anyway.
      // THREE.LOD switches itself inside the renderer's projectObject, so
      // nothing here has to be driven per frame.
      const coarse = new THREE.Group();
      {
        const D = shed.dims, MT = shed.mats;
        // THE COARSE SKIN IS FRONT-SIDED (2026-09-11, user: "the hangar
        // disappears far too quickly"). MT.wallOut is authored BackSide,
        // because the shell's wall pieces are 6 cm boxes and the far face of
        // a 6 cm box IS its outside. On a 25 m box the same material drew
        // the far INTERIOR faces with their normals flipped — the wall
        // facing the sun rendered as the dark inside of the wall facing
        // away. Measured at 342 m: the light-grey shed snapped to a dark
        // slab the colour of the treeline, and read as gone. A front-sided
        // clone keeps the building the same building across the switch;
        // the box's 0..1 uv is the same grammar the sheeting bands wear
        // (wallOutAlb repeats 4 x 1 per piece), so nothing else changes.
        const skin = MT.wallOut.clone(); skin.side = THREE.FrontSide;
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(2 * D.HD, D.EAVE, 2 * D.HW), skin);
        body.position.y = D.EAVE / 2;
        // THE GABLE, WRITTEN OUT. The obvious move is a three-sided
        // CylinderGeometry like the box buildings use, but a triangular prism
        // has ONE radius and this roof needs a width and a ridge height that
        // are not related by it — every way of squashing it afterwards depends
        // on which axis survived the two rotations, and the first attempt
        // produced a shed with no roof at all. Six vertices are unambiguous.
        const HWo = D.HW + 0.5;
        const rgeo = new THREE.BufferGeometry();
        rgeo.setAttribute('position', new THREE.Float32BufferAttribute([
          -D.HD, D.RIDGE, 0,   D.HD, D.RIDGE, 0,      // 0,1 ridge
          -D.HD, D.EAVE, -HWo, D.HD, D.EAVE, -HWo,    // 2,3 eave -z
          -D.HD, D.EAVE,  HWo, D.HD, D.EAVE,  HWo,    // 4,5 eave +z
        ], 3));
        // WOUND OUTWARD (2026-09-11). Every face of this prism was wound the
        // other way — (0,2,3) on the -z slope has its normal pointing down
        // and INTO the shed — and roofOut is FrontSide, so from anywhere
        // outside the whole roof was back-face culled: past 320 m the shed
        // had no roof at all, just a flat-topped box. Checked per face with
        // the cross product, ridge -> eave -> eave.
        rgeo.setIndex([
          0, 3, 2, 0, 1, 3,      // the -z slope
          0, 5, 1, 0, 4, 5,      // the +z slope
          0, 2, 4,               // the gable ends
          1, 5, 3,
        ]);
        // ...and it carries uv, which it did not: a mapped material on a
        // geometry with no uv attribute samples texel (0,0) everywhere. The
        // deck's own grammar is uvScale 6 (hangar.js quad), so the same here.
        rgeo.setAttribute('uv', new THREE.Float32BufferAttribute([
          0, 0, 6, 0, 0, 6, 6, 6, 0, 6, 6, 6], 2));
        rgeo.computeVertexNormals();
        const roof = new THREE.Mesh(rgeo, MT.roofOut);
        coarse.add(body, roof);
        coarse.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
      }
      let node = shed.group;
      if (THREE.LOD) {
        const lod = new THREE.LOD();
        lod.addLevel(shed.group, 0);
        lod.addLevel(coarse, 320);
        node = lod;
      }
      node.position.set(H.x, 0, H.z);
      node.rotation.y = H.ry;
      scene.add(node);
      shedNode = node;
    }
    standShed(shedDims);
    setShedDims = dims => standShed(dims);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, SITE.windsock.h),
      worldLambert({ color: C(0xd8d2c4) }));
    pole.position.set(SITE.windsock.x, SITE.windsock.h / 2, SITE.windsock.z);
    pole.castShadow = true; pole.receiveShadow = true; scene.add(pole);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 2.6, 10, 1, true),
      worldLambert({ color: C(0xe4622e), side: THREE.DoubleSide }));
    sock.castShadow = true; scene.add(sock);
    // W13: wind-driven, see setWindVis
    socks.push({ pole: [SITE.windsock.x, SITE.windsock.h - 0.5, SITE.windsock.z], mesh: sock });

    // THE BOUNDARY, in runs with a gate in it. The old fence was one line from
    // x 60 to -80 that walked straight through the taxiway.
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, SITE.fence.h),
      worldLambert({ color: C(0x8a7457) }));
    for (const run of SITE.fence.runs)
      for (let x = Math.max(run[0], run[1]); x >= Math.min(run[0], run[1]); x -= SITE.fence.step) {
        const fq = fp.clone(); fq.position.set(x, SITE.fence.h / 2, SITE.fence.z);
        fq.castShadow = true; fq.receiveShadow = true; scene.add(fq);
      }

    // THE PAVING WEARS WHAT THE GARAGE'S PAVING WEARS (G123). Geometry alone
    // is not "kept in sync": these were flat Lambert colour (0xa89a80) while
    // the same two rectangles seen through the hangar door were scanned
    // concrete, so taxiing out changed the ground under the wheels. They now
    // read the same site library, at the same tile, from the same declaration.
    //
    // Standard rather than Lambert, deliberately and unlike the terrain around
    // them: r128 routes scene.environment to Standard materials only, and these
    // are the surfaces close enough to the aeroplane for that to show.
    // depthWrite stays off and the renderOrder stack is kept - the log depth
    // buffer does not forgive coplanar decals whatever the material.
    const paved = (r, key, tile, y, fallback) => {
      const w = Math.abs(r.x1 - r.x0), d = Math.abs(r.z1 - r.z0);
      const maps = siteGroundMaps(THREE, key, tile, WANISO);
      if (!maps) return decalRect(r, fallback, y);     // payload-less build
      const g = new THREE.PlaneGeometry(w, d);
      const uv = g.attributes.uv;                      // metric, like the room
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
      uv.needsUpdate = true;
      g.rotateX(-Math.PI / 2);
      // TRANSPARENT, though nothing about it is see-through. The aerodrome's
      // grass patch below it has to fade at its edges, so it IS transparent —
      // and three draws every transparent object after every opaque one,
      // whatever its renderOrder. Opaque paving therefore disappeared under a
      // patch that is nominally beneath it. One sorted pass, ordered by
      // renderOrder, is the fix; these were already depthWrite:false decals.
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial(Object.assign({
        roughness: 1, metalness: 0.02, depthWrite: false, transparent: true }, maps)));
      m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
      m.renderOrder = Math.round(y * 100);
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    paved(SITE.apron, 'brushed', 2, 0.02, 0xa89a80);
    paved(SITE.taxiway, 'cracked', 4, 0.03, 0xa89a80);
    decal(Math.abs(SITE.apron.x1 - SITE.apron.x0), 0.5, 0x8c7f68, 0.04,
          (SITE.apron.x0 + SITE.apron.x1) / 2, Math.min(SITE.apron.z0, SITE.apron.z1) + 0.2);

    const prop = (geo, mat, x, y, z, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry; m.rotation.z = rz;
      m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    };
    const steel = worldLambert({ color: C(0x8d9299) });
    const rust  = worldLambert({ color: C(0xb2653a) });
    const wood  = worldLambert({ color: C(0xa8834f) });
    const straw = worldLambert({ color: C(0xd7bf7c) });
    const CL = SITE.clutter;

    const drum = new THREE.CylinderGeometry(0.31, 0.31, 0.9, 12);
    CL.drums.forEach((d2, i) => prop(drum, i === 1 ? rust : steel, d2[0], 0.45, d2[1]));
    prop(new THREE.CylinderGeometry(0.31, 0.31, 0.9, 12), rust,
         CL.drumDown[0], 0.31, CL.drumDown[1], 0, Math.PI / 2);

    const crate = new THREE.BoxGeometry(1.1, 0.8, 1.1);
    CL.crates.forEach(c2 => prop(crate, wood, c2[0], 0.4, c2[1], c2[2]));
    prop(new THREE.BoxGeometry(1.1, 0.7, 1.1), wood,
         CL.crateTop[0], 1.15, CL.crateTop[1], CL.crateTop[2]);

    const bale = new THREE.CylinderGeometry(0.85, 0.85, 1.3, 12);
    CL.bales.forEach(b2 => prop(bale, straw, b2[0], 0.85, b2[1], b2[2], Math.PI / 2));

    { // windbreak behind the hangars (well clear of the strip): the
      // declared row of the site (25_airfield.js), PLACED as real trees
      // through TREE_PLACE (W0c.28) - the Georgeous fir, at the row's own
      // spread of sizes, on the same jittered line the cones stood on.
      // The first real plant reads this list; no cone is drawn here now.
      const T = SITE.trees;
      const TP = (typeof window !== 'undefined') && window.TREE_PLACE;
      if (TP) for (let x = T.x1; x >= T.x0; x -= T.step)
        TP.add({ x: x + (x % 3) * 0.6, z: T.z + (x % 5) * 0.7,
                 key: 'fir_tree_georgeous.glb|Fir01_LOD0',
                 size: 0.7 * (0.85 + (x % 7) / 9), yaw: (x * 0.37) % 6.283 });
    }

    // a working windsock pole gets a guy-line stake; tie-downs on the apron
    const ring = new THREE.TorusGeometry(0.22, 0.05, 6, 10);
    for (const rr2 of CL.rings) prop(ring, steel, rr2[0], 0.1, rr2[1], 0, Math.PI / 2);

    // ---- THE AERODROME'S OWN GROUND (G123, the user: "give the same
    // materials to the outside game too") -------------------------------
    // The terrain here is a baked COLOUR map — one texel per ~17 m, painted
    // khaki by the biome pass — and the garage's field is scanned grass. So
    // rolling out of the hangar changed the ground under the wheels, which is
    // the same disagreement between the two scenes this whole arc exists to
    // end, one layer down.
    //
    // Retexturing the terrain is not the answer: it is a 24 km streamed mesh
    // with its own colour pipeline. What IS the answer is that the aerodrome
    // has its own ground, the way a real one does — mown, kept, and visibly
    // different from the country around it. So this is a bounded patch over
    // the flat pad, wearing the SAME set the garage's field wears, faded out
    // at its edges so it stops being there without an edge.
    const gpad = siteGroundMaps(THREE, 'grass005', 2, WANISO);
    if (gpad) {
      const box = siteHangarBox(SITE.hangar);
      const PX = (box.x0 + box.x1) / 2 - 20, PZ = 20, PW = 300, PD = 220;
      const pg = new THREE.PlaneGeometry(PW, PD);
      { const uv = pg.attributes.uv;                  // metric, like the room
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * PW, uv.getY(i) * PD);
        uv.needsUpdate = true; }
      pg.rotateX(-Math.PI / 2);
      const pm = new THREE.MeshStandardMaterial(Object.assign({
        roughness: 1, metalness: 0, depthWrite: false }, gpad));
      siteEdgeFade(THREE, pm, 0.42, PW, PD);
      const patch = new THREE.Mesh(pg, pm);
      patch.position.set(PX, 0.012, PZ);              // under every paving decal
      patch.renderOrder = 0;   // under every decal the airfield lays
      patch.receiveShadow = true;
      scene.add(patch);

      // and the same tufts, round the same apron. One draw call; the scatter,
      // the blade atlas and the crossed-quad geometry are the garage's, out of
      // site_ground.js, so the grass you taxi through is the grass you were
      // looking at through the door.
      if (THREE.InstancedMesh) {
        let seed = 20260831;
        const rnd = () => (seed = seed * 1664525 + 1013904223 >>> 0) / 4294967296;
        const rwy = { x0: Math.min(R.end0.x, R.end1.x), x1: Math.max(R.end0.x, R.end1.x),
                      z0: R.cz - R.half - 1, z1: R.cz + R.half + 1 };
        const rows = siteScatter(rnd, {
          count: 9000, radius: 78, near: 34,
          blocks: [SITE.apron, SITE.taxiway, rwy, box],
          cx: (SITE.apron.x0 + SITE.apron.x1) / 2, cz: SITE.apron.z0,
          x0: SITE.apron.x0 - 60, x1: SITE.apron.x1 + 60,
          z0: R.cz + R.half, z1: box.z1 + 20,
        });
        const tm2 = new THREE.MeshStandardMaterial({
          map: siteBladeTexture(THREE, rnd, WANISO),
          alphaTest: 0.42, side: THREE.FrontSide, roughness: 0.92, metalness: 0 });
        scene.add(siteTufts(THREE, rows, tm2, 0.0));
      }
    }
  }

  { // stage-3 settlements: instanced houses/barns + bridge decks
    const BL = world.roadNet.buildings;
    if (BL.length) {
      const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
      bodyGeo.translate(0, 0.5, 0);
      const roofGeo = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
      roofGeo.rotateY(Math.PI / 2); roofGeo.rotateZ(Math.PI / 2);   // prism, axis along x
      const bodies = new THREE.InstancedMesh(bodyGeo,
        worldLambert({ color: 0xffffff }), BL.length);
      const roofs = new THREE.InstancedMesh(roofGeo,
        worldLambert({ color: 0xffffff }), BL.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
            up = new THREE.Vector3(0, 1, 0), pv = new THREE.Vector3(),
            sv = new THREE.Vector3(), c3 = new THREE.Color();
      const WALLS = [C(0xcbb79a), C(0xd8cbb0), C(0xb9a284), C(0x8a6a4a)];
      const ROOFS = [C(0x9c5f43), C(0x7a5a43), C(0x6d5744)];
      BL.forEach((b, i) => {
        const gy = world.terrainH(b.x, b.z);
        const hsi = ((b.x * 7 + b.z * 13) & 1048575) | 0;
        q.setFromAxisAngle(up, -b.rot);
        pv.set(b.x, gy - 0.15, b.z);
        sv.set(b.w, b.hgt, b.l);
        m4.compose(pv, q, sv);
        bodies.setMatrixAt(i, m4);
        bodies.setColorAt(i, b.kind === 'barn' ? c3.copy(ROOFS[0]).multiplyScalar(1.05) : WALLS[hsi % 4]);
        const rr = b.l * 0.58;
        pv.set(b.x, gy - 0.15 + b.hgt + rr * 0.5 - 0.02, b.z);
        sv.set(b.w * 1.06, rr, rr);
        m4.compose(pv, q, sv);
        roofs.setMatrixAt(i, m4);
        roofs.setColorAt(i, ROOFS[hsi % 3]);
      });
      // Both meshes hold every building in WORLD coordinates while sitting at
      // the origin, so three would cull them against the unit box/prism's own
      // ~1 m sphere — i.e. the villages vanish whenever the world origin is
      // off-screen, which in flight is most of the time. Size the sphere to
      // the settlements' real extent: still culls when far away, but honestly.
      // (Found by GATE WORLDRENDER; the tree field had the same class of bug.)
      let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9, bhi = 0;
      for (const b of BL) {
        bx0 = Math.min(bx0, b.x); bx1 = Math.max(bx1, b.x);
        bz0 = Math.min(bz0, b.z); bz1 = Math.max(bz1, b.z);
        bhi = Math.max(bhi, world.terrainH(b.x, b.z) + b.hgt);
      }
      const bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2;
      const brad = Math.hypot(bx1 - bcx, bz1 - bcz, bhi) + 20;
      for (const g of [bodyGeo, roofGeo]) {
        g.computeBoundingSphere();
        g.boundingSphere.center.set(bcx, bhi / 2, bcz);
        g.boundingSphere.radius = brad;
      }
      for (const m of [bodies, roofs]) {
        m.castShadow = true; m.receiveShadow = true;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        scene.add(m);
      }
    }
    const deckMat = worldLambert({ color: C(0x8a6a4a) });
    for (const r of world.roadNet.roads) {
      if (r.cls !== 'bridge') continue;
      const [a, b] = r.pts;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const y = Math.max(world.terrainH(a[0], a[1]), world.terrainH(b[0], b[1])) + 0.55;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(L + 5, 0.7, 6.5), deckMat);
      deck.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
      deck.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      deck.castShadow = true; deck.receiveShadow = true;
      scene.add(deck);
    }
  }

  // THE PREMISES (G386): the world editor's record, drawn by the same module as the bench's
  // (render_premises.js, game mode): the houses, the sites, the parks, the objects, the lots and
  // the fences, a fine ground patch over the extent in the outer ring's texture, road ribbons.
  // The world composed the record at its make (20_world.js); the strips it registered are
  // painted with every other below. The build queue drains here at the boot, whole (36 houses,
  // 3 s on an RTX 3080 - a worker or a ladder is owed); after a live edit worldUpdate drains it.
  let premisesR = null;
  if (world.premises && world.premises.rec && window.RENDER_PREMISES) {
    try {
      // the patch wears the ring it lies in: the inner ring's material (its baked map, its detail grain)
      // and uv law inside ±INNER, the outer ring's texture beyond
      const ov = world.premises.overlay, F = ov.frame, e = ov.extent;
      const corners = [F.toWorld(e.x0, e.z0), F.toWorld(e.x1, e.z0), F.toWorld(e.x1, e.z1), F.toWorld(e.x0, e.z1)];
      const inner = innerPatchShared && corners.every(q => Math.abs(q[0]) < innerPatchShared.half - 60 && Math.abs(q[1]) < innerPatchShared.half - 60);
      premisesR = window.RENDER_PREMISES.make(THREE, scene, world, world.premises.rec, {
        game: true, pool: () => [], editing: () => !!(window.PREMISES_HOST_OPEN),
        // beyond the inner ring the patch wears the outer ring's MATERIAL (its canopy tint; G398.3 - a bare Lambert on the bake read as sand under the woods)
        patchMat: inner ? innerPatchShared.mat : (outerMatShared || (outerTexShared ? worldLambert({ map: outerTexShared }) : null)),
        patchUV: inner ? innerPatchShared.uv : (x, z) => [(x - world.bounds.x0) / (world.bounds.x1 - world.bounds.x0), 1 - (z - world.bounds.z0) / (world.bounds.x1 - world.bounds.x0)],
        site: { siteRunway, sitePattern, sitePatternIssues, patternPath },
      });
      premisesR.rebuild();
      while (premisesR.stats.queued) premisesR.step(4);
    } catch (e) { console.warn('premises: the record did not render', e); }
  }
  { // stage-4 aerodromes: strip decals + windsocks at every field/strip
    const mkTex = kind => {
      const cv2 = document.createElement('canvas'); cv2.width = 512; cv2.height = 64;
      const q = cv2.getContext('2d');
      if (kind === 'marks') {
        // THE MARKINGS ALONE (G398): the sheet is transparent - the strip's ground is whatever lies
        // under it (the bare terrain, a surface or material polygon, or a PBR set drawn by mkLook)
        q.clearRect(0, 0, 512, 64);
        q.fillStyle = '#e9e4d6';
        for (const u of [10, 496]) for (let k = 0; k < 4; k++) q.fillRect(u, 8 + k * 14, 6, 8);
        q.fillStyle = '#d9d3c0';
        for (let u = 40; u < 470; u += 32) q.fillRect(u, 30, 14, 3);
      } else if (kind === 'paved') {
        q.fillStyle = '#63636a'; q.fillRect(0, 0, 512, 64);
        q.fillStyle = '#e9e4d6';
        for (const u of [10, 496]) for (let k = 0; k < 4; k++) q.fillRect(u, 8 + k * 14, 6, 8);
        q.fillStyle = '#d9d3c0';
        for (let u = 40; u < 470; u += 32) q.fillRect(u, 30, 14, 3);
      } else if (kind === 'grass') {
        q.fillStyle = '#6b7a36'; q.fillRect(0, 0, 512, 64);
        for (let i = 0; i < 6; i++) { q.fillStyle = i % 2 ? '#77873b' : '#5f6f2c'; q.fillRect(0, i * 11, 512, 10); }
        q.fillStyle = '#e9e4d6';
        for (const u of [8, 498]) q.fillRect(u, 12, 5, 40);
      } else {
        q.fillStyle = '#96917e'; q.fillRect(0, 0, 512, 64);
        q.fillStyle = '#c9c2ae';
        for (let u = 16; u < 500; u += 60) { q.fillRect(u, 6, 8, 5); q.fillRect(u, 53, 8, 5); }
      }
      // TOUCHDOWN MARKERS (G107): the aiming point at 25% from each end —
      // the registry's own tdz rule (centre + len/4, approach side), which is
      // the SAME length-fraction on every strip, so one shared texture can
      // carry it. A pair of bold bars astride the centreline, per direction.
      q.fillStyle = '#efe9da';
      for (const um of [128, 384]) { q.fillRect(um - 5, 14, 10, 10); q.fillRect(um - 5, 40, 10, 10); }
      const t = new THREE.CanvasTexture(cv2);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const texes = {};
    // THE LOOK'S GROUND (G398): a PBR set of the site's or the lot's tiled along the strip at the set's
    // own period; the image shared, the texture per strip (its repeat is the strip's)
    const lookSets = () => Object.assign({}, (typeof LOT_TEX_SETS !== 'undefined' && LOT_TEX_SETS) || {}, (typeof SITE_TEX_SETS !== 'undefined' && SITE_TEX_SETS) || {});
    const mkLook = (setKey, len, wid) => {
      const S = lookSets()[setKey];
      if (!S || !S.diff) return null;
      const t = new THREE.Texture(S.diff);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, MAX_ANISO);
      const tile = S.tile || 4;
      t.repeat.set(Math.max(1, Math.round(len / tile)), Math.max(1, Math.round(wid / tile)));
      if (S.diff.complete && S.diff.naturalWidth) t.needsUpdate = true; else S.diff.addEventListener('load', () => { t.needsUpdate = true; }, { once: true });
      return t;
    };
    const poleMat = worldLambert({ color: C(0xd8d2c4) });
    const sockMat = worldLambert({ color: C(0xe4622e), side: THREE.DoubleSide });
    const patchMat = worldLambert({ map: outerTexShared });
    // patch uvs span the full 24 km domain: 613 tiles ~= the inner ring's
    // on-ground grain density (230 tiles over 9 km)
    if (detailApply) detailApply(patchMat, 613);
    // ONE STRIP'S FURNITURE, re-runnable (v8): the premises' strips are painted again after a live edit
    // (repaintStrips below); everything a strip stands is kept under its id so it can be taken away
    const stripStood = new Map();
    const standStrip = a => {
      const kind = a.surface === world.SURFACE.PAVED ? 'paved'
        : a.surface === world.SURFACE.GRAVEL ? 'gravel' : 'grass';
      if (!texes[kind]) texes[kind] = mkTex(kind);
      const stood = []; stripStood.set(a.id, stood);
      const keep = o => { stood.push(o); return o; };
      // W13.2 ground patch: every strip outside the inner ring sits on the
      // coarse outer mesh (~100 m polys, tucked 2 m LOW) — the graded
      // bench and its banks exist in terrainH but were unrenderable, so
      // strips read as floating planes and a rolling aircraft sank below
      // the drawn surface. A local fine mesh renders the true grading,
      // edge-blended 2.2 m down so its border tucks under the outer ring
      // exactly like the ring seams do.
      if (Math.abs(a.x) > 3900 || Math.abs(a.z) > 3900) {
        const MARG = 90, RES = 9;
        const LX = a.len + 2 * MARG, WZ = a.wid + 2 * MARG;
        const g2 = new THREE.PlaneGeometry(LX, WZ,
          Math.ceil(LX / RES), Math.ceil(WZ / RES));
        g2.rotateX(-Math.PI / 2);
        g2.rotateY(-a.hdg);
        g2.translate(a.x, 0, a.z);
        const p = g2.attributes.position, uv = g2.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          const u0 = uv.getX(i), v0 = uv.getY(i);
          const edge = Math.min(Math.min(u0, 1 - u0) * LX, Math.min(v0, 1 - v0) * WZ);
          const r = Math.min(1, edge / 60);            // 0 at border, 1 inside 60 m
          p.setY(i, world.terrainH(x, z) - 2.2 * (1 - r) * (1 - r));
          uv.setXY(i, (x - world.bounds.x0) / (world.bounds.x1 - world.bounds.x0), 1 - (z - world.bounds.z0) / (world.bounds.x1 - world.bounds.x0));
        }
        g2.computeVertexNormals();
        const pm = new THREE.Mesh(g2, patchMat);
        pm.receiveShadow = true;
        scene.add(keep(pm));
      }
      // the strip decal is DRAPED (per-vertex terrainH), not a flat plane
      // at a.elev — wheels roll on terrainH, and the two now agree; 6 m
      // along since a profile (v8) can hump within twelve
      const geo = new THREE.PlaneGeometry(a.len, a.wid,
        Math.ceil(a.len / 6), Math.max(2, Math.ceil(a.wid / 8)));
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(-a.hdg);
      geo.translate(a.x, 0, a.z);
      const dp = geo.attributes.position;
      for (let i = 0; i < dp.count; i++)
        dp.setY(i, world.terrainH(dp.getX(i), dp.getZ(i)) + 0.07);
      geo.computeVertexNormals();
      // THE LOOK (G398): 'none' stands the markings alone on the composed ground; a look with a set
      // stands the set's sheet under the same markings; 'grass' (and every strip without a look) the
      // painted strip of old
      const LK = (typeof PREMISES_GEN !== 'undefined' && PREMISES_GEN.RUNWAY_LOOKS && a.look) ? PREMISES_GEN.RUNWAY_LOOKS[a.look] : null;
      if (LK && (a.look === 'none' || LK.set)) {
        const lookTex = LK.set ? mkLook(LK.set, a.len, a.wid) : null;
        if (lookTex) {
          const gm = new THREE.Mesh(geo, worldLambert({ map: lookTex, depthWrite: false }));
          gm.renderOrder = 2; gm.receiveShadow = true; scene.add(keep(gm));
        }
        if (!texes.marks) texes.marks = mkTex('marks');
        const geo2 = geo.clone(); const p2 = geo2.attributes.position; for (let i = 0; i < p2.count; i++) p2.setY(i, p2.getY(i) + 0.02);
        const mm = new THREE.Mesh(geo2, worldLambert({ map: texes.marks, transparent: true, depthWrite: false }));
        mm.renderOrder = 3; mm.receiveShadow = true; scene.add(keep(mm));
        if (!lookTex) geo.dispose();
      } else {
        const m = new THREE.Mesh(geo,
          worldLambert({ map: texes[kind], depthWrite: false }));
        m.renderOrder = 2;
        m.receiveShadow = true;
        scene.add(keep(m));
      }
      // windsock off the strip edge
      const px2 = a.x - Math.sin(a.hdg) * (a.wid / 2 + 9);
      const pz2 = a.z + Math.cos(a.hdg) * (a.wid / 2 + 9);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6), poleMat);
      pole.position.set(px2, a.elev + 3, pz2); pole.castShadow = true; scene.add(keep(pole));
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 2.6, 10, 1, true), sockMat);
      sock.castShadow = true; scene.add(keep(sock));
      const sk = { pole: [px2, a.elev + 5.5, pz2], mesh: sock }; socks.push(sk); stood.push(sk);   // W13 wind-driven
    };
    for (const a of world.aerodromes) {
      if (a.kind === 'meadow' || a.id === 'HOME') continue;
      standStrip(a);
    }
    // THE PREMISES' STRIPS REPAINTED (v8): after a live edit the decal, the sock and the far patch of
    // every premises strip are taken away and stood again from the registry as it is now
    repaintStrips = () => {
      for (const [id, stood] of stripStood) {
        const a0 = world.aerodromes.find(q => q.id === id);
        if (a0 && !a0.premises) continue;
        for (const o of stood) { if (o.mesh && !o.isMesh) { const k = socks.indexOf(o); if (k >= 0) socks.splice(k, 1); continue; } scene.remove(o); if (o.geometry) o.geometry.dispose(); }
        stripStood.delete(id);
      }
      for (const a of world.aerodromes) if (a.premises && a.kind !== 'meadow') standStrip(a);
    };
  }

  { // landing meadows: marker ring + beacon
    const beaconGeo = new THREE.CylinderGeometry(0.16, 0.22, 7);
    const flagGeo = new THREE.PlaneGeometry(2.4, 1.4);
    const ringGeo = new THREE.ConeGeometry(0.55, 1.7, 6);
    const ringMat = worldLambert({ color: C(0xe4622e) });
    for (const m of world.meadows) {
      const b = new THREE.Mesh(beaconGeo, worldLambert({ color: C(0xe9e2d3) }));
      b.position.set(m.x, m.h + 3.5, m.z); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      const fl = new THREE.Mesh(flagGeo, worldLambert({
        color: C(0xe4622e), side: THREE.DoubleSide }));
      fl.position.set(m.x + 1.2, m.h + 6.2, m.z); scene.add(fl);
      for (let a = 0; a < 8; a++) {
        const px = m.x + Math.cos(a / 8 * 6.283) * m.r * 0.55;
        const pz = m.z + Math.sin(a / 8 * 6.283) * m.r * 0.55;
        const p = new THREE.Mesh(ringGeo, ringMat);
        p.position.set(px, world.terrainH(px, pz) + 0.85, pz);
        p.castShadow = true; p.receiveShadow = true; scene.add(p);
      }
    }
  }

  // THE CLOUDS (CLOUDS C1): the billboard puffs that stood here are retired - clouds.js marches a
  // volumetric layer over the resolved frame (aa.setOverlay); this file hands it the day every frame

  // W13: aim every windsock down the wind vector (mouth upwind), sagging
  // as the wind drops; calm socks hang. Called by the viewer on wind change.
  const _sd = new THREE.Vector3(), _su = new THREE.Vector3(0, 1, 0), _sm = new THREE.Vector3();
  function setWindVis(base) {
    const mag = base ? Math.hypot(base[0], base[2]) : 0;
    for (const s of socks) {
      if (mag < 0.3) _sd.set(0.30, -0.92, 0.18).normalize();
      else {
        const sag = 0.85 * Math.max(0, 1 - mag / 8);
        _sd.set(base[0] / mag, 0, base[2] / mag).multiplyScalar(Math.sqrt(1 - sag * sag));
        _sd.y = -sag;
      }
      s.mesh.quaternion.setFromUnitVectors(_su, _sm.set(-_sd.x, -_sd.y, -_sd.z));
      s.mesh.position.set(s.pole[0] + _sd.x * 1.3, s.pole[1] + _sd.y * 1.3, s.pole[2] + _sd.z * 1.3);
    }
  }
  setWindVis(null);

  // per-frame: keep the aircraft AND the spot its shadow falls on inside the
  // sun frustum (grown with hysteresis so the map isn't re-projected every frame)
  let shadowHalf = 0;
  // THE GROUND FOLLOWS A LIVE EDIT (G387): every ring vertex inside the box re-sampled from terrainH
  // (which reads the premises layer at call time), the normals redone - the premises' own patch
  // re-samples itself; this is the 17.6 m ring under and around it
  function refreshGround(bb) {
    for (const g of groundGeos) {
      const pa = g.attributes.position; let n = 0;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); if (x < bb.x0 - 40 || x > bb.x1 + 40 || z < bb.z0 - 40 || z > bb.z1 + 40) continue; pa.setY(i, world.terrainH(x, z)); n++; }
      if (n) { pa.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); }
    }
  }
  let premTramLast = 0;
  function worldUpdate(cg) {
    if (premisesR && premisesR.stats.queued) premisesR.step(1);   // a live edit's builds, one a frame
    // the premises' trams run on the wall clock (G398.3): the sim may be held, the cabins still move
    if (premisesR && premisesR.tick && premisesR.stats.trams) { const now = performance.now(); premisesR.tick(premTramLast ? Math.min(0.1, (now - premTramLast) / 1000) : 0); premTramLast = now; }
    if (cg) seaUpdate(cg[0], cg[2], 1 / 60);                       // H4: the near sea, in the aeroplane's wave
    // Tree LOD reads the CHASE CAMERA, not the CG: the impostor picks its baked
    // view from the direction to the eye, and 30 m of chase offset is 4 deg of
    // parallax at the near edge of the band. One frame stale (the viewer places
    // the camera after this call) and that is fine — 30 m of aircraft travel
    // shifts nothing at 450 m.
    uCam.value.copy(camera.position);
    uCG.value.set(cg[0], cg[1], cg[2]);
    dayApply();
    fillUpdate(cg);
    lodUpdate(cg);
    const gy = world.terrainH(cg[0], cg[2]);
    const agl = Math.max(0, cg[1] - gy);
    const reach = Math.min(agl / Math.max(SUN.y, SUN_MIN_Y), 520);
    const tx = cg[0] - SUN.x * reach * 0.5, tz = cg[2] - SUN.z * reach * 0.5;
    const half = Math.max(RIG.shadowMin, Math.min(540, 105 + reach * 0.55));
    // snapped to the map's texel grid at the half-width the map will have
    // this frame (the hysteresis below keeps that steady between resizes)
    const hs = (Math.abs(half - shadowHalf) > shadowHalf * 0.12 + 4) ? half : shadowHalf;
    snapToTexels(_sT.set(tx, gy, tz), hs, sun.shadow.mapSize.x);
    sun.target.position.copy(_sT);
    sun.position.set(_sT.x + SUN.x * 700, _sT.y + SUN.y * 700, _sT.z + SUN.z * 700);
    uShadowR.value = half;
    farRender(uCam.value);
    if (Math.abs(half - shadowHalf) > shadowHalf * 0.12 + 4) {
      shadowHalf = half;
      const c = sun.shadow.camera;
      c.left = -half; c.right = half; c.top = half; c.bottom = -half;
      c.updateProjectionMatrix();
    }
  }

  // ================= THE RIG AS DATA (W0c.11) ==============================
  // Every number the light is made of - the sun's direction, colour and
  // strength, the hemisphere, the exposure, the dome's palette, the
  // environment and the shadow's reach - in one row, with a setter, so a
  // developer can move any of them from a slider and A/B the forest under
  // the rig it was tuned in. Two rows: `sunset`, which is what this file has
  // always drawn (snapshotted at boot, so it stays exactly that), and `alps`,
  // the bench's afternoon row (hangar.js MOODS: keyI 2.8, ffdca8, hemi
  // 0.274, ex 0.92) with the alps panorama as an INVISIBLE environment -
  // rebuilt from the hangar's base + gain pair the way the bench does it,
  // at 2048 x 1024, and PMREM'd. The visible sky stays the dome.
  // ---- THE DAY DRIVES THE SUN (SKY S2, 2026-09-14) -----------------------
  // world.day (07_day.js) is the almanac; each frame its sun direction is
  // written into SUN (2 deg floor for the shadow maths) and SUN_SKY (true),
  // and the F8 readouts (rigCur.elev/azim) agree with it. The INTERIM DIMMER
  // fades the row's own sun/hemisphere/dome through the twilight and warms
  // the key below 12 deg — it is retired by atmo.js (S3), where the key's
  // colour is the transmittance along the sun's own path. Clouds sit at the
  // day's cloud base, by its cover.
  const SUN_MIN_Y = Math.sin(2 * Math.PI / 180);
  const WARM_SUN = C(0xffa652);
  let dayVer = -1, dayEl = NaN, dayAz = NaN;
  function dayApply() {
    const day = world.day;
    if (!day || rigCur.manual) return;
    if (ATMO_ON) { ATMO.update(renderer, day, camera.position.y); ATMO.setAP(true); }   // the sky-view and AP atlases follow the sun and the eye every frame; the world's frames take the splice
    // THE CLOUDS every frame (C1/C4): the drift, the eye (the probe's and the in-cloud slab's), the shadow's scalars - not gated on the sun's move below
    if (ATMO_ON && typeof CLOUDS !== 'undefined' && CLOUDS.ready) { CLOUDS.S.inShed = false; CLOUDS.update(day, camera, world); }
    if (probe && !rigCur.manual) probe.maybe(day, 1.5);                                   // S5: the reflection probe follows the sun (1.5 deg), the day's dials, the clouds' drift
    const el = day.sunEl, az = day.sunAzGrid;
    if (day.version === dayVer && Math.abs(el - dayEl) < 0.02 && Math.abs(az - dayAz) < 0.02) return;
    dayVer = day.version; dayEl = el; dayAz = az;
    const v = day.sun;
    SUN_SKY.set(v[0], v[1], v[2]);
    SUN.copy(SUN_SKY);
    if (SUN.y < SUN_MIN_Y) { const h = Math.hypot(SUN.x, SUN.z) || 1, k = Math.sqrt(1 - SUN_MIN_Y * SUN_MIN_Y) / h; SUN.set(SUN.x * k, SUN_MIN_Y, SUN.z * k); }
    rigCur.elev = el; rigCur.azim = day.rigAzim;
    const t = Math.min(1, Math.max(0, (el + 6) / 12)), k = t * t * (3 - 2 * t);
    if (ATMO_ON && typeof SKY_LIGHT !== 'undefined') {
      // THE PHYSICAL PATH (S3): the key, the hemisphere, the dome's scale and
      // the exposure from the atmosphere, through light_rig; the rows'
      // sunI / hemi / exposure are GAINS on the alps anchors they were judged against
      // CLOUDS C3: under a cloud the diffuse light rises as the sun is lost (the sun itself is shadowed per
      // pixel by the splice; the hemisphere is one light, so it takes the layer's transmittance at the eye)
      const cT = (typeof CLOUDS !== 'undefined' && CLOUDS.sunT) ? CLOUDS.sunT(camera.position.x, camera.position.y, camera.position.z) : 1;
      SKY_LIGHT.applyDay(day, { key: sun, hemi, scene, renderer, unit: LIGHT_UNIT,
        sunGain: RIG.sun / 2.8, hemiBoost: RIG.hemi / 0.274 * (typeof CLOUDS !== 'undefined' && CLOUDS.hemiUnder ? CLOUDS.hemiUnder(cT) : 1), exposureK: rigCur.exposure / 0.92,
        hemiGnd: rigCur.hemiGnd, gb, altM: camera.position.y, cloudT: cT });
    } else {
      // INTERIM S2 DIMMER — the fallback when the atmosphere is off (the TSL flag)
      sun.intensity = RIG.sun * LIGHT_UNIT * k;
      hemi.intensity = RIG.hemi * LIGHT_UNIT * Math.max(0.06, k);
      if (sun.color && sun.color.setHex && sun.color.lerp) { const w = Math.min(1, Math.max(0, 1 - el / 12)); sun.color.setHex(rigCur.sunCol).lerp(WARM_SUN, w * w); }
    }
    const dim = Math.max(0.03, k);
    if (worldSky && worldSky.material.uniforms && worldSky.material.uniforms.uDim) worldSky.material.uniforms.uDim.value = dim;
    if (!ATMO_ON && scene.fog && scene.fog.color && scene.fog.color.setHex && rigCur.dome) scene.fog.color.setHex(rigCur.dome.haze).multiplyScalar(dim);   // the painted haze, when the atmosphere is off
  }
  const rigRows = {};
  const hexOf = (c, d) => (c && c.getHex) ? c.getHex() : d;   // the gate's stub has no Color
  const rigSnapshot = () => ({
    elev: Math.asin(SUN.y) * 180 / Math.PI, azim: Math.atan2(SUN.x, SUN.z) * 180 / Math.PI,
    sunI: RIG.sun, sunCol: hexOf(sun.color, SUNC), hemi: RIG.hemi,
    hemiSky: hexOf(hemi.color, RIG.skyCol), hemiGnd: RIG.gndCol,
    exposure: (typeof window !== 'undefined' && window.GFX && window.GFX.exposureBase && window.GFX.exposureBase() != null)
      ? window.GFX.exposureBase() : ((renderer && renderer.toneMappingExposure) || 1),   // the BASE, never the menu's step over it
    env: 'dome', shadowMin: RIG.shadowMin, floor: uFloor.value, floorBlur: uFloorLod.value, floorEdge: uFloorEdge.value,
    farShadow: true, snap: true, manual: false,
    shadowMap: (sun.shadow && sun.shadow.mapSize) ? sun.shadow.mapSize.x : 1024,
    // the painted dome's palette; the physical dome (S3) has none, and the row keeps the legacy numbers for the fallback
    dome: (worldSky && worldSky.material.uniforms && worldSky.material.uniforms.uTop) ? {
      top: hexOf(worldSky.material.uniforms.uTop.value, 0x3f7fbe),
      mid: hexOf(worldSky.material.uniforms.uMid.value, 0x9dc4dd),
      haze: hexOf(worldSky.material.uniforms.uHaze.value, HAZE),
      sunCol: hexOf(worldSky.material.uniforms.uSunCol.value, SUNC) } : { top: 0x3f7fbe, mid: 0x9dc4dd, haze: HAZE, sunCol: SUNC },
  });
  rigRows.sunset = rigSnapshot();
  rigRows.alps = Object.assign({}, rigRows.sunset, {
    elev: 33.4, azim: 28.7, sunI: 2.8, sunCol: 0xffdca8, hemi: 0.274, hemiSky: 0xc5d9ff,
    hemiGnd: 0x343422, exposure: 0.92, env: 'alps', shadowMin: 540, shadowMap: 2048,
    dome: { top: 0x3f7fbe, mid: 0xa9c8e0, haze: 0xcfd9e3, sunCol: 0xfff1dc },
  });
  // THE ISLAND'S ROW (G400, the user: "the shaded part of the mountains is
  // almost pitch black ... whether we have sufficient ambient light"): the
  // alps afternoon with the hemisphere doubled - a clear sky is a fifth of
  // the sun, not a tenth - under a Landsat albedo that is dark to begin with
  rigRows.island = Object.assign({}, rigRows.alps, { hemi: 0.55, hemiSky: 0xcfe0ff, hemiGnd: 0x3a3f30 });
  const rigCur = Object.assign({}, rigRows.sunset);
  let alpsEnv = null, alpsState = null;
  // the alps radiance, once: sRGB base / k * exp2(gain * gmax), the identity
  // hangar_sky.js's grade shader uses, run on the CPU into a half-float
  // equirect (see tools/_trees.html alpsBuild for the argument)
  const buildAlpsEnv = done => {
    // a bundle-scope const (hangar_sky.js, later in the bundle): reachable by
    // name at call time, never as a window property
    const G = (typeof HANGAR_SKY_GRADE !== 'undefined') ? HANGAR_SKY_GRADE
            : ((typeof window !== 'undefined') && window.HANGAR_SKY_GRADE);
    if (!G || !THREE.DataUtils || !THREE.PMREMGenerator) { alpsState = 'failed'; return; }
    alpsState = 'loading';
    const W = 2048, H = 1024, imgs = { base: new Image(), gain: new Image() };
    let left = 2;
    const go = () => {
      if (--left) return;
      try {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g2 = c.getContext('2d', { willReadFrequently: true });
        g2.drawImage(imgs.base, 0, 0, W, H); const bd = g2.getImageData(0, 0, W, H).data;
        g2.clearRect(0, 0, W, H);
        g2.drawImage(imgs.gain, 0, 0, W, H); const gd = g2.getImageData(0, 0, W, H).data;
        const half = THREE.DataUtils.toHalfFloat, out = new Uint16Array(W * H * 4);
        const invK = 1 / G.k, gmax = G.gmax;
        const s2l = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
        for (let i = 0, n = W * H; i < n; i++) {
          for (let ch = 0; ch < 3; ch++)
            out[i * 4 + ch] = half(s2l(bd[i * 4 + ch] / 255) * invK * Math.pow(2, (gd[i * 4 + ch] / 255) * gmax));
          out[i * 4 + 3] = half(1);
        }
        const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
        const pm = new THREE.PMREMGenerator(renderer);
        alpsEnv = pm.fromEquirectangular(t).texture;
        pm.dispose(); t.dispose();
        alpsState = 'ready';
      } catch (e) { alpsState = 'failed'; }
      if (done) done();
    };
    imgs.base.onload = go; imgs.gain.onload = go;
    imgs.base.onerror = imgs.gain.onerror = () => { alpsState = 'failed'; };
    imgs.base.src = G.base; imgs.gain.src = G.gain;
  };
  const rigApply = () => {
    const R = rigCur, el = R.elev * Math.PI / 180, az = R.azim * Math.PI / 180;
    // the row's direction only when the rig is MANUAL (or the world has no day); otherwise the day's (dayApply)
    if (R.manual || !world.day) { SUN.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize(); SUN_SKY.copy(SUN); }
    dayVer = -1;                                   // a row write re-arms the day's pass on the next frame
    sun.intensity = (RIG.sun = R.sunI) * LIGHT_UNIT; if (sun.color && sun.color.setHex) sun.color.setHex(R.sunCol);
    hemi.intensity = (RIG.hemi = R.hemi) * LIGHT_UNIT;
    if (hemi.color && hemi.color.setHex) { hemi.color.setHex(R.hemiSky); hemi.groundColor.setHex(R.hemiGnd).multiplyScalar(gb); }
    if (renderer) { if (typeof window !== 'undefined' && window.GFX && window.GFX.setExposure) window.GFX.setExposure(renderer, R.exposure); else renderer.toneMappingExposure = R.exposure; }
    RIG.shadowMin = R.shadowMin;
    if (R.floor !== undefined) uFloor.value = R.floor;
    if (R.floorBlur !== undefined) uFloorLod.value = R.floorBlur;
    if (R.floorEdge !== undefined) uFloorEdge.value = R.floorEdge;
    if (R.farShadow !== undefined) FAR.enabled = !!R.farShadow;
    if (R.snap !== undefined) SNAP.on = !!R.snap;
    if (sun.shadow && sun.shadow.mapSize && sun.shadow.mapSize.x !== R.shadowMap) {
      sun.shadow.mapSize.set(R.shadowMap, R.shadowMap);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (worldSky && R.dome && worldSky.material.uniforms && worldSky.material.uniforms.uTop) {
      const u = worldSky.material.uniforms;
      u.uTop.value.setHex(R.dome.top); u.uMid.value.setHex(R.dome.mid);
      u.uHaze.value.setHex(R.dome.haze); u.uSunCol.value.setHex(R.dome.sunCol);
      if (scene.fog) scene.fog.color.setHex(R.dome.haze);
    }
    if (probe) scene.environment = envMap;          // S5: the physical probe is the environment, whatever the row's `env` says
    else if (R.env === 'alps') {
      if (alpsState === 'ready') scene.environment = alpsEnv;
      else if (alpsState === null) buildAlpsEnv(() => { if (rigCur.env === 'alps' && alpsEnv) scene.environment = alpsEnv; });
    } else scene.environment = envMap;
  };
  const worldRig = {
    rows: () => Object.keys(rigRows),
    get: () => Object.assign({}, rigCur, { dome: Object.assign({}, rigCur.dome) }),
    row: name => { if (rigRows[name]) { Object.assign(rigCur, rigRows[name], { dome: Object.assign({}, rigRows[name].dome) }); rigApply(); } return worldRig.get(); },
    set: o => { for (const k in o) if (k === 'dome') Object.assign(rigCur.dome, o.dome); else if (k in rigCur) rigCur[k] = o[k]; rigApply(); return worldRig.get(); },
    envState: () => alpsState,
  };
  if (typeof window !== 'undefined') window.WORLD_RIG = worldRig;

  // treeLod is exposed for tuning, not for the viewer: setting near to 0 makes
  // the whole forest impostors, which is how the mid tier's fidelity gets
  // compared against the geometry it stands in for (tools/make_probe.js).
  return { worldUpdate, SUN, SUN_SKY, sun, hemi, minimap: miniCanvas, setWindVis, get envMap() { return envMap; }, probe, rig: worldRig, ground: groundApi, scene, camera, far: FAR, cover: COVER, premises: premisesR, refreshGround, repaintStrips: () => repaintStrips(),
    // THE ROLL-OUT SCREEN'S HANDLES (LOADING S3): the ring grown under the
    // overlay, and the payload's settle to wait on (a rejected settle = cones)
    prewarm: (cg, o) => fillApi ? fillApi.prewarm(cg, o) : { phase: 'done', done: true, trees: 'fallback' },
    ringReady: cg => fillApi ? fillApi.ringReady(cg) : true,
    ringStat: () => fillApi ? fillApi.ringStat() : null,
    treeState: () => fillApi ? fillApi.treeState() : 'fallback',
    treeSettled: () => (treeSettleOf ? treeSettleOf() : Promise.resolve()).catch(() => null),
    // the editor opened over a world made without a premises: the renderer stood now, game mode, on an empty record
    premisesStart() { if (premisesR || !world.premises || !window.RENDER_PREMISES) return premisesR;
      const inner = innerPatchShared;
      premisesR = window.RENDER_PREMISES.make(THREE, scene, world, world.premises.rec || null, { game: true, pool: () => [], editing: () => !!(window.PREMISES_HOST_OPEN),
        patchMat: inner ? inner.mat : (outerMatShared || (outerTexShared ? worldLambert({ map: outerTexShared }) : null)), patchUV: inner ? inner.uv : (x, z) => [(x - world.bounds.x0) / (world.bounds.x1 - world.bounds.x0), 1 - (z - world.bounds.z0) / (world.bounds.x1 - world.bounds.x0)],
        site: { siteRunway, sitePattern, sitePatternIssues, patternPath } });
      return premisesR; },
           setShedDims: d => setShedDims(d),
           treeLod: { near: uNear, cam: uCam, lit: uILit }, renderer,
           // the world's own light panel — the same shape the shed exposes, so
           // one piece of UI can drive either room
           lightSwitches: worldSwitch ? worldSwitch.list() : [],
           lightOn: k => worldSwitch ? worldSwitch.on(k) : true,
           setLight: (k, v) => { if (!worldSwitch) return null;
             const r = worldSwitch.set(k, v); applyWorldLights(); return r; },
           setLights: pick => { if (!worldSwitch) return null;
             worldSwitch.list().forEach(l => worldSwitch.set(l.key, pick(l.key)));
             applyWorldLights();
             return worldSwitch.list().filter(l => worldSwitch.on(l.key)).map(l => l.key); },
           claimed: () => new Set([sun, hemi,
             worldSky && worldSky.material].filter(Boolean)) };
}
