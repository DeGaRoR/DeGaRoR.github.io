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
  let miniCanvas = null;              // W13 minimap underlay, baked with the outer ring
  let outerTexShared = null;          // W13.2: outer-ring texture, reused by strip patches
  let detailApply = null;             // W13.2: close-range grain hook for patch materials
  const socks = [];                   // every windsock: { pole:[x,y,z], mesh }
  let fillUpdate = () => {};          // W13 woodland fill streamer (set in the tree block)
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
  const NEAR_R = 450, FAR_WOOD = 5400, FAR_FILL = 4000, FAR_FADE = 500;
  const uNear = { value: NEAR_R };     // live: every tree material reads it
  // the two inner edges of the ladder, shared by every rung material the
  // same way uNear is - a dial can move them and every band follows
  const LOD_U = [{ value: 150 }, { value: 300 }], U0 = { value: 0 };
  const uILit = { value: 1.0 };        // the impostor tier's own gain (the bench's `imp lit`)
  // THE BAKE SWITCHES THE BANDS OFF. A rung's material collapses every
  // instance outside its band, and the impostor bake draws the same material
  // from thirty metres: an L2 whose band starts at 300 m baked an EMPTY sheet,
  // and the far band of the fill was black. Measured by reading the albedo
  // target back: 0 texels covered where the normal pass had 40 514.
  const uNoBand = { value: 0 };
  // the sky dome, held so the switchboard further down can reach it: it is
  // parented to the CAMERA, so it is not findable by walking the scene
  let worldSky = null;
  scene.fog = new THREE.Fog(C(HAZE), 600, 5200);
  scene.add(camera);

  // Sky shader, factored out because the W18 environment bake below renders the
  // very same dome into a cube map: ONE source of truth for the golden hour, so
  // a reflection can never drift from the sky it is supposed to be reflecting.
  //
  // `encode` exists for one hard-won reason. This shader writes gl_FragColor by
  // hand and includes none of three's chunks, so nothing ever converts its
  // output to the target's encoding — which is fine and deliberate on screen
  // (the palette was tuned against exactly that). But r128's PMREM target is
  // **RGBE**: alpha is an EXPONENT. Writing alpha = 1.0 into it means 2^(255-128),
  // the decoder returns ~1.7e38, the IBL term goes infinite, and infinity minus
  // infinity is NaN — so every MeshStandardMaterial in the scene renders PURE
  // BLACK, aircraft and water alike, while the Lambert world looks perfectly
  // fine. Symptom and cause could hardly be further apart; the bisect that
  // found it was swapping in a PMREM baked from a plain MeshBasicMaterial dome.
  const skyMat = (encode, extra) => new THREE.ShaderMaterial(Object.assign({
      uniforms: { uTop:{value:C(0x3f7fbe)}, uMid:{value:C(0x9dc4dd)},
                  uHaze:{value:C(HAZE)}, uSun:{value:SUN}, uSunCol:{value:C(SUNC)} },
      vertexShader: `varying vec3 vD;
        void main(){ vD = (modelMatrix * vec4(position,1.0)).xyz - cameraPosition;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uTop,uMid,uHaze,uSunCol,uSun; varying vec3 vD;
        void main(){
          vec3 d = normalize(vD);
          float h = d.y;
          vec3 col = mix(uHaze, uMid, smoothstep(-0.01, 0.20, h));
          col = mix(col, uTop, smoothstep(0.13, 0.80, h));
          col = mix(col, uHaze * 0.82, smoothstep(0.0, -0.30, h));
          float sd = max(dot(d, normalize(uSun)), 0.0);
          col += uSunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 14.0) * 0.42 + pow(sd, 3.0) * 0.13);
          gl_FragColor = vec4(col, 1.0);
          ` + (encode ? `
          // This palette is authored in DISPLAY space: the on-screen dome
          // writes gl_FragColor raw into an sRGB-encoded target and nothing
          // converts it, which is what the colours were tuned against. A
          // reflection probe, though, must hold scene-LINEAR radiance — hand
          // the same numbers to the PBR pipeline as linear and every surface
          // reflects a sky about 2.4x too bright, which reads as chrome: the
          // C172's white-and-teal livery vanished under a mirror of sky and
          // grass. Linearise here, in the bake variant only.
          gl_FragColor = sRGBToLinear(gl_FragColor);
          #include <encodings_fragment>` : '') + `
        }`,
      side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }, extra));

  { // sky dome — parented to the camera so it never runs out
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2, 32, 20), skyMat(false));
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
  let envMap = null;
  if (THREE.PMREMGenerator && renderer && renderer.setRenderTarget) {
    const es = new THREE.Scene();
    const domeG = new THREE.SphereGeometry(20, 32, 20);
    es.add(new THREE.Mesh(domeG, skyMat(true, { toneMapped: false, depthTest: true })));
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
    es.add(new THREE.Mesh(grndG, new THREE.MeshBasicMaterial({
      color: C(0x6d7a45).multiplyScalar(gb), side: THREE.BackSide,
      toneMapped: false, fog: false })));
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(es, 0.035, 1, 100).texture;   // slight blur: a sky, not a mirror
    scene.environment = envMap;
    pmrem.dispose();
    domeG.dispose(); grndG.dispose();
  }

  // THE WORLD'S RIG, DECLARED ONCE. It is read here and again by the tree
  // impostor bake ~550 lines down, which lights a white tree and freezes the
  // result into an atlas that is drawn as an UNLIT MeshBasicMaterial. That
  // atlas is therefore immune to every later lighting change: edit the rig
  // without editing the bake and the far forest stays lit for a world that no
  // longer exists — silently, and for ever, because nothing downstream can
  // tell you. Two literals that must agree are a bug waiting for its first
  // edit, so there is one.
  const RIG = { skyCol: 0xbcd8f0, gndCol: 0x6a5a3c, hemi: 0.50, sun: 2.75, shadowMin: 105 };
  const hemiLight = () => {
    const h = new THREE.HemisphereLight(C(RIG.skyCol), C(RIG.gndCol), RIG.hemi);
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
  const sun = new THREE.DirectionalLight(C(SUNC), RIG.sun);
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
    sun.intensity = RIG.sun;
    hemi.intensity = RIG.hemi;
    scene.environment = envMap;
    if (worldSky) worldSky.visible = true;
    worldSwitch.apply();
  }

  { // terrain (24 km domain, W6): two-ring mesh — 17.6 m polys over the
    // home ±4500 so river carves resolve, coarse ~100 m strips out to
    // ±12000 (fog caps visibility ~5 km: the far ring only needs
    // silhouette fidelity). Each ring bakes its own colour map from the
    // shared colorAt(); strips tuck 300 m under the inner rim, 2 m low,
    // so the seam never shows a crack.
    const SIZE = 24000, HALF = 12000, INNER = 4500;
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
      const h = world.terrainH(x, z), e = 16;
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
      _for = sc === world.SURFACE.FOREST_FLOOR ? 1 : 0;   // W17 far-canopy mask
      if (sc === world.SURFACE.FOREST_FLOOR) c.lerp(c2.setHex(0x51602f), 0.42);
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
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    }
    const tex = bakeGround(-INNER, -INNER, INNER, INNER, 512, { grain: true });
    const outerTex = bakeGround(-HALF, -HALF, HALF, HALF, 512, { mini: true, mask: true });
    outerTexShared = outerTex;

    const geo = new THREE.PlaneGeometry(2 * INNER, 2 * INNER, 512, 512);
    geo.rotateX(-Math.PI / 2);
    const posA = geo.attributes.position;
    for (let i = 0; i < posA.count; i++)
      posA.setY(i, world.terrainH(posA.getX(i), posA.getZ(i)));
    geo.computeVertexNormals();
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
      sh.uniforms.uFMask = { value: forestMask };
      sh.uniforms.uCanopy = { value: cnpTex };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying float vCD;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n' +
          'vWP = (modelMatrix * vec4(position, 1.0)).xyz;\nvCD = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uFMask;\n' +
          'uniform sampler2D uCanopy;\nvarying vec3 vWP;\nvarying float vCD;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n' +
          // same uv convention as the outer ring's own texture: v runs the other
          // way down z, and the mask canvas is built in that same pass
          'float fM = texture2D(uFMask, vec2((vWP.x + 12000.0) / 24000.0,\n' +
          '                                  1.0 - (vWP.z + 12000.0) / 24000.0)).r;\n' +
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
          'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * cC * 1.45, fFar);');
    };
    // shared close-range grain hook (W13.2): uvScale sets tiles/uv-unit so
    // materials with different uv extents get the same on-ground density
    detailApply = (mat, uvScale) => { mat.onBeforeCompile = sh => {
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
    const gMat = new THREE.MeshLambertMaterial({ map: tex });
    gMat.onBeforeCompile = sh => {
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

    { // outer ring: four coarse strips sharing one full-domain texture
      const oMat = new THREE.MeshLambertMaterial({ map: outerTex });
      oMat.onBeforeCompile = canopyHook;   // the far tier lives mostly out here
      const strip = (x0, z0, x1, z1, sx, sz) => {
        const g2 = new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz);
        g2.rotateX(-Math.PI / 2);
        g2.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
        const p = g2.attributes.position, uv = g2.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          p.setY(i, world.terrainH(x, z) - 2);
          uv.setXY(i, (x + HALF) / SIZE, 1 - (z + HALF) / SIZE);
        }
        g2.computeVertexNormals();
        const m = new THREE.Mesh(g2, oMat);
        m.receiveShadow = true;
        scene.add(m);
      };
      const OV = 4200;                  // tuck under the inner rim
      strip(-HALF, -HALF, HALF, -OV, 240, 78);
      strip(-HALF, OV, HALF, HALF, 240, 78);
      strip(-HALF, -OV, -OV, OV, 78, 84);
      strip(OV, -OV, HALF, OV, 78, 84);
    }

    const waterMat = new THREE.MeshStandardMaterial({
      color: C(0x3a7e96), roughness: 0.16, metalness: 0.0, side: THREE.DoubleSide });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.y = -0.4;
    scene.add(water);

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
    const IMP_G = 4, IMP_TILE = 128;
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
    function normalMatFor(src) {
      let m = NRM_CACHE.get(src);
      if (!m) {
        m = new THREE.ShaderMaterial({
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
      m.side = src.side;
      return m;
    }
    function bakeImpostorAtlas(src) {
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
      rt.texture.encoding = THREE.sRGBEncoding;
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
    function impostorMat(atlas, far) {
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
        alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
      (m.userData = m.userData || {}).atlas = atlas;
      if (!atlas.tex) return m;              // headless: no GL, no atlas, no shader
      const LEAF = (typeof TREE_LEAF !== 'undefined' && TREE_LEAF.uniforms) ? TREE_LEAF : null;
      m.onBeforeCompile = sh => {
        sh.uniforms.uCam = uCam;
        sh.uniforms.uNearB = uNear;
        sh.uniforms.uFarB = { value: far };
        sh.uniforms.uFadeB = { value: FAR_FADE };
        sh.uniforms.uCy = { value: atlas.cy };
        sh.uniforms.uDiam = { value: atlas.diam };
        sh.uniforms.uG = { value: IMP_G };
        sh.uniforms.uNrm = { value: atlas.nrm };
        sh.uniforms.uILit = uILit;
        sh.uniforms.uLeaf = { value: 1 };
        sh.uniforms.uWrap = LEAF ? LEAF.uniforms.uWrap : { value: 0.76 };
        sh.uniforms.uSSS = LEAF ? LEAF.uniforms.uSSS : { value: 0.72 };
        sh.uniforms.uSSSP = LEAF ? LEAF.uniforms.uSSSP : { value: 3 };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\n' +
            'uniform vec3 uCam;\nuniform float uNearB, uFarB, uFadeB, uCy, uDiam;\n' +
            'varying vec3 vImpDir;')
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
            'vec3 off = (rgt * position.x + upv * position.y) * (uDiam * fade);',
            'vec3 wp = ctr + vec3(off.x * sX, off.y * sY, off.z * sX);',
            'vec4 mvPosition = modelViewMatrix * vec4(wp, 1.0);',
            'gl_Position = projectionMatrix * mvPosition;',
            // inside the near band the 3D tier draws these trees for real
            'if (dCam < uNearB || fade <= 0.0) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);',
          ].join('\n'));
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\n' +
            'uniform float uG, uILit, uLeaf, uWrap, uSSS, uSSSP;\nuniform sampler2D uNrm;\nvarying vec3 vImpDir;\n' +
            // the decode, written out: <map_fragment> and its mapTexelToLinear
            // are replaced below, and the sheet was written sRGB
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
            'vec2 qv = vUv / uG;',
            'vec2 uvA = (g0 + cA) / uG + qv, uvB = (g0 + cB) / uG + qv, uvC = (g0 + cC) / uG + qv;',
            'vec4 texelColor = texture2D(map, uvA) * wB.x + texture2D(map, uvB) * wB.y + texture2D(map, uvC) * wB.z;',
            'texelColor.rgb = impSRGB(clamp(texelColor.rgb / max(texelColor.a, 1e-4), 0.0, 1.0));',   // premultiplied sheet
            'diffuseColor *= texelColor;',
            // the other half of the G-buffer, un-premultiplied by ITS alpha
            'vec4 n0 = texture2D(uNrm, uvA), n1 = texture2D(uNrm, uvB), n2 = texture2D(uNrm, uvC);',
            'float nW = dot(wB, vec3(n0.a, n1.a, n2.a));',
            'vec3 nBake = (n0.rgb * wB.x + n1.rgb * wB.y + n2.rgb * wB.z) / max(nW, 1e-4) * 2.0 - 1.0;',
            'if (dot(nBake, nBake) < 1e-4) nBake = dI;',
            'vec3 nImpV = normalize((viewMatrix * vec4(normalize(nBake), 0.0)).xyz);',
          ].join('\n'))
          // the substitution that buys the rig; both, because the environment
          // reads geometryNormal
          .replace('#include <normal_fragment_maps>',
            '#include <normal_fragment_maps>\nnormal = nImpV;\ngeometryNormal = nImpV;')
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
      get: () => [LOD_U[0].value, LOD_U[1].value, uNear.value],
      set: a => {
        const l0 = Math.max(10, +a[0] || LOD_U[0].value), l1 = Math.max(l0, +a[1] || LOD_U[1].value);
        const nr = Math.max(l1, +a[2] || uNear.value);
        LOD_U[0].value = LOD_R[0] = l0; LOD_U[1].value = LOD_R[1] = l1; uNear.value = LOD_R[2] = nr;
        lodAt = null;
        return treeLod.get();
      },
    };
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
    const LOD_TICK = 10, LOD_MOVE = 25;     // refresh every 10 frames or 25 m
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
      for (let i = 0; i < n; i++) {
        const dx = pos[i * 3] - cg[0], dy = pos[i * 3 + 1] - cg[1], dz = pos[i * 3 + 2] - cg[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const si = ser[i], R = spans[si];
        let b = -1;
        for (let j = 0; j < R.length; j++) if (d < R[j]) { b = j; break; }
        if (b < 0) continue;
        rec.buf[si][b].set(mats.subarray(i * 16, i * 16 + 16), k[si][b] * 16);
        k[si][b]++;
      }
      for (let si = 0; si < rec.rungs.length; si++)
        for (let b = 0; b < rec.rungs[si].length; b++) for (const m of rec.rungs[si][b]) {
          const c = k[si][b];
          if (c) m.instanceMatrix.array.set(rec.buf[si][b].subarray(0, c * 16));
          m.count = c; m.visible = c > 0;
          m.instanceMatrix.needsUpdate = true;
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
    const BAND_GLSL = (originExpr) => originExpr + '\n' +
      'if (uNoBand < 0.5 && (bandD < uNearB || bandD >= uFarB)) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);';
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
        sh.uniforms.uNearB = E.near;
        sh.uniforms.uFarB = E.far;
        sh.uniforms.uNoBand = uNoBand;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uNearB, uFarB, uNoBand;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n' +
            BAND_GLSL(BAND_ORIGIN_VIEW));
      };
      return m;
    };
    const bandDepth = (mat, r, n) => {
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
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uNearB, uFarB, uNoBand;\nuniform vec3 uCam;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n' +
            BAND_GLSL(BAND_ORIGIN_CAM));
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
    const treePick = re => { const all = treeList();
      return (all.find(e => re.test(e.key)) || all[0]).key; };
    const PICK_CONIF = /Fir01/, PICK_BROAD = /Christmas tree\|?$|Christmas tree$/;
    // AND THE MAPS MUST HAVE LANDED BEFORE ANYTHING BAKES. treeWarm resolves on
    // the bytes; the leaf textures load after, on their own timers, and an
    // impostor atlas baked in between renders every card solid - the round
    // black blobs on every far hillside (TREE-IMPORT.md §6 trap 2, again).
    // So: warm, BUILD the subjects (which is what requests the maps), wait for
    // the maps, and only then plant. Both layers go through this one promise.
    let treeSettled = null;
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
          for (const re of [PICK_CONIF, PICK_BROAD]) {
            const k = treePick(re), S = treeList().find(e => e.key === k).sub;
            const list = (S[ser] && S[ser].length) ? S[ser] : S.rungs;
            for (let r = 0; r < list.length; r++) treeBuild(THREE, k, r, ser);
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
          PROTO = { conif: withLadder(treePick(PICK_CONIF)),
                    broad: withLadder(treePick(PICK_BROAD)) };
        } catch (e) { PROTO = null; }
      }
      if (PROTO) {
        // the chunk sphere trick applies to a real tree exactly as to a cone —
        // and chunkBounds is also what stashes userData.shape, which the
        // impostor bake reads for its ortho extent
        for (const P of [PROTO.conif, PROTO.broad]) for (const S of P.series)
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
    for (const T of P) {
      const cx = Math.floor(T.x / CHW), cz = Math.floor(T.z / CHW);
      const k = cx * 4096 + cz;
      let a = cells.get(k);
      if (!a) cells.set(k, a = { cx, cz, list: [] });
      a.list.push(T);
    }
    const trunkMat = nearOnly(new THREE.MeshLambertMaterial({ color: C(0x584431) }));
    const canopyMat = nearOnly(new THREE.MeshLambertMaterial({ vertexColors: true }));
    // Impostors carry NO trunk: 1.9 m tall and 0.4 m wide is a fifth of a pixel
    // at 450 m, which is the same argument that already switched trunks off at
    // 900 m — and a brown trunk cannot ride a per-species tint anyway.
    const impQuadW = impQuad(CHW);
    // one atlas per SERIES per side: the far band of a dead tree is a dead tree
    const impMats = side => {
      const P = PROTO ? PROTO[side] : null;
      const srcs = P ? P.series.map(S => S.parts) : [side === 'conif' ? coneGeo : blobGeo];
      return srcs.map(src => {
        const at = bakeImpostorAtlas(src), m = impostorMat(at, FAR_WOOD);
        plantedKit.push(at.tex, at.nrm, m);
        return m;
      });
    };
    const impConeMatW = impMats('conif'), impBlobMatW = impMats('broad');
    plantedKit.push(trunkMat, canopyMat);
    for (const cell of cells.values()) {
      const ox = (cell.cx + 0.5) * CHW, oz = (cell.cz + 0.5) * CHW;
      const conif = cell.list.filter(t => t.sp < 2), broad = cell.list.filter(t => t.sp >= 2);
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
          m.customDepthMaterial = treeDepth;
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
          mi.userData.ser = si;
          imps.push(mi);
        });
        return { n, meshes, imps, rec, ser, cnt, scaleY: P.series.map(S => S.scaleY), sink: P.sink, size: P.size };
      };
      const C = side(conif, PROTO && PROTO.conif, impConeMatW, coneGeo);
      const B = side(broad, PROTO && PROTO.broad, impBlobMatW, blobGeo);

      const fill = (H, list) => {
        if (!H) return;
        const at = [0, 0, 0];                              // per-series write index
        list.forEach((T, i) => {
          const w = T.r, sp = T.sp;
          q.setFromAxisAngle(up, w * 6.283);
          if (PROTO) { const s = sizeOf(H.size, w); sv.set(s, s, s); }
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
      fill(C, conif); fill(B, broad);

      const all = [trunks];
      for (const H of [C, B]) if (H) all.push(...H.meshes, ...H.imps);
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
        for (const H of [C, B]) if (H && H.rec) ladderChunks.push(H.rec);
      } else {
        nearChunks.push({ m: [trunks].concat(C ? C.meshes : [], B ? B.meshes : []),
                          x: ox, z: oz, r: NEAR_R + hd, own: true });
      }
      impChunks.push({ m: (C ? C.imps : []).concat(B ? B.imps : []).filter(Boolean),
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
      // 160 (6.4 m, ~21 000/km² before dropout): MEASURED on the RTX 3080 at
      // 1920x1080 in the densest stand, the frame with the specimen L2 in the
      // fill runs 25 ms at 112, 31 at 160, 36 at 224, 54 at 320 - against 17-21
      // at the strip with no near tree at all. 160 is where dense reads as
      // dense and the frame is still the game's; the dial is there to push it.
      const FILL = { ng: 128 };         // 8 m; 160 (6.4 m) was 72 ms on the full ladder
      let NG = FILL.ng, SP2 = CH / NG;
      const bins = new Map();              // collidable trees in 128 m bins:
      world.trees.forEach((T, i) => {      // prefilter + species inheritance
        const k = Math.floor(T.x / 128) * 4096 + Math.floor(T.z / 128);
        const a = bins.get(k); a ? a.push(i) : bins.set(k, [i]);
      });
      const nearTree = (x, z) => {         // stands always hold a grid tree < 90 m
        const bx = Math.floor(x / 128), bz = Math.floor(z / 128);
        let best = -1, bd = 8100;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const a = bins.get((bx + dx) * 4096 + (bz + dz));
          if (a) for (const ti of a) {
            const T = world.trees[ti];
            const d = (T.x - x) * (T.x - x) + (T.z - z) * (T.z - z);
            if (d < bd) { bd = d; best = ti; }
          }
        }
        return best;
      };
      const ex = world.aerodromes.map(a => ({ x: a.x, z: a.z,
        r2: (a.len / 2 + 70) ** 2 }));
      const coneF = new THREE.ConeGeometry(1.55, 5.0, 5, 1, true);
      coneF.translate(0, 2.75, 0);
      const blobF = new THREE.IcosahedronGeometry(1.9, 0);
      blobF.scale(1, 1.05, 1); blobF.translate(0, 2.3, 0);
      // same trick as the woodland layer: instances are stored relative to the
      // chunk centre and the shared bounding sphere is inflated to a chunk, so
      // three CAN cull these after all (it never could while the matrices held
      // world coordinates against a 2 m shared sphere).
      [coneF, blobF].forEach(g => chunkBounds(g, CH));
      const matF = nearOnly(new THREE.MeshLambertMaterial({ vertexColors: true }));
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
      const SHAPE = { conif: null, broad: null, kit: [] };
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
              return { dead: (col.place && col.place.dead) || 0, white: true,
                       sink: (col.place && col.place.sink) || 0,
                       size: (col.place && col.place.size) || 1,
                       series: SERIES.map(ser => Object.assign(ladderFor(key, ser), { imp: null })) };
            };
            real = { conif: forKey(treePick(PICK_CONIF)), broad: forKey(treePick(PICK_BROAD)) };
          } catch (e) { real = null; }
        }
        for (const side of ['conif', 'broad']) {
          if (real) {
            const H = real[side];
            for (const S of H.series) {
              for (const R of S.ladder) for (const q of R.parts) { chunkBounds(q.geo, CH); SHAPE.kit.push(q.mat, q.depth); }
              const at = bakeImpostorAtlas(S.parts);
              S.imp = impostorMat(at, FAR_FILL);
              SHAPE.kit.push(S.imp, at.tex, at.nrm);
            }
            SHAPE[side] = H;
          } else {
            const sh = shapeFallback(side === 'conif' ? coneF : blobF);
            SHAPE[side] = sh;
            SHAPE.kit.push(sh.series[0].imp, sh.series[0].atlas.tex, sh.series[0].atlas.nrm);
          }
        }
        return !!real;
      }
      setShapes();
      function gen(cx, cz) {
        const recs = [[], []];             // conifer / broadleaf
        for (let gz = 0; gz < NG; gz++) for (let gx = 0; gx < NG; gx++) {
          const ix = cx * NG + gx, iz = cz * NG + gz;
          if (hsh(ix, iz + 31) < 0.1) continue;
          const x = cx * CH + (gx + 0.5) * SP2 + (hsh(ix + 7, iz) - 0.5) * SP2 * 1.6;
          const z = cz * CH + (gz + 0.5) * SP2 + (hsh(ix, iz + 7) - 0.5) * SP2 * 1.6;
          if (Math.abs(z) < 90 && x < 200 && x > -3400) continue;  // corridor
          const ti = nearTree(x, z);
          if (ti < 0) continue;            // no stand tree near: not forest
          let inEx = false;
          for (const e of ex)
            if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < e.r2) { inEx = true; break; }
          if (inEx) continue;
          const h = world.terrainH(x, z);
          if (h < 1.5) continue;
          if (world.waterH(x, z) > h) continue;
          if (world.surface(x, z) !== world.SURFACE.FOREST_FLOOR) continue;
          const sp = hsh(ix + 3, iz + 5) < 0.88 ? world.trees[ti].sp
                                                : (hsh(ix + 9, iz + 1) * 5) | 0;
          recs[sp < 2 ? 0 : 1].push(x, h, z, sp, hsh(ix + 2, iz + 8));
        }
        const meshes = [], near = [], imp = [], recsOut = [];
        const ox = (cx + 0.5) * CH, oz = (cz + 0.5) * CH;
        recs.forEach((r, broadish) => {
          const n = r.length / 5;
          if (!n) return;
          const SH = broadish ? SHAPE.broad : SHAPE.conif;
          // deal every instance its series first, so each series' meshes are
          // sized to what they will hold and nothing empty is submitted
          const ser = new Uint8Array(n), cnt = SH.series.map(() => 0);
          for (let i = 0; i < n; i++) {
            ser[i] = SH.series.length > 1 ? seriesOf(r[i * 5 + 4], SH.dead) : 0;
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
              // colour buffer at capacity BEFORE parking - see the woodland
              m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cnt[si] * 3).fill(1), 3);
              m.count = 0; m.visible = false; return m; })),
            mi: new THREE.InstancedMesh(impQuadF, S.imp, cnt[si]), at: 0 } : null);
          for (const P of perSer) if (P) P.ms = [].concat(...P.byRung);
          const nrOf = S => S.ladder ? S.ladder.length : 1;
          const rec = { n, mats: new Float32Array(n * 16), pos: new Float32Array(n * 3), ser,
                        buf: SH.series.map((S, si) => Array.from({ length: nrOf(S) }, () => new Float32Array(cnt[si] * 16))),
                        rungs: SH.series.map((S, si) => perSer[si] ? perSer[si].byRung : Array.from({ length: nrOf(S) }, () => [])), x: ox, z: oz };
          perSer.forEach((P, si) => { if (P) for (const mm of P.ms.concat([P.mi])) {
            mm.position.set(ox, 0, oz); mm.userData.ser = si; mm.userData.fill = true; } });
          for (let i = 0; i < n; i++) {
            const o = i * 5, sp = r[o + 3], w = r[o + 4];
            const si = ser[i], P = perSer[si], S = SH.series[si];
            q.setFromAxisAngle(up, w * 6.283);
            const s = SH.white ? sizeOf(SH.size, w)
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
        return { meshes, reg, recs: recsOut };
      }
      // when the payload lands: new shapes, and every live chunk regenerates
      // through the streamer's own eviction path rather than a second one
      const evictAll = () => {
        for (const [k, c2] of chunks) {
          if (c2.meshes) {
            for (const m of c2.meshes.meshes) { scene.remove(m); if (m.dispose) m.dispose(); }
            for (const r2 of c2.meshes.reg) {
              let i = nearChunks.indexOf(r2); if (i >= 0) nearChunks.splice(i, 1);
              i = impChunks.indexOf(r2); if (i >= 0) impChunks.splice(i, 1);
            }
            for (const rec of (c2.meshes.recs || [])) {
              const i = ladderChunks.indexOf(rec); if (i >= 0) ladderChunks.splice(i, 1);
            }
          }
          chunks.delete(k);
        }
        queue.length = 0;
      };
      if (typeof treeReady === 'function' && !treeReady())
        treeSettle().then(() => { if (setShapes()) evictAll(); }).catch(() => {});
      if (typeof window !== 'undefined')
        window.TREE_FILL = { get: () => FILL.ng,
          set: ng => { FILL.ng = NG = Math.max(16, Math.min(320, ng | 0)); SP2 = CH / NG; evictAll(); return NG; } };
      let tick = 0;
      fillUpdate = cg => {
        if (tick++ % 12) return;           // ~0.2 s cadence
        const R = Math.ceil(R_ACT / CH);
        const ccx = Math.floor(cg[0] / CH), ccz = Math.floor(cg[2] / CH);
        for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) {
          const cx = ccx + dx, cz = ccz + dz;
          const mx2 = (cx + 0.5) * CH - cg[0], mz2 = (cz + 0.5) * CH - cg[2];
          if (mx2 * mx2 + mz2 * mz2 > R_ACT * R_ACT) continue;
          if (Math.abs((cx + 0.5) * CH) > 12000 || Math.abs((cz + 0.5) * CH) > 12000) continue;
          const k = cx * 4096 + cz;
          if (!chunks.has(k)) { chunks.set(k, { cx, cz, meshes: null }); queue.push(k); }
        }
        if (queue.length) {                // nearest first; the fog hides the rest
          for (let i = queue.length - 1; i >= 0; i--) {
            const c2 = chunks.get(queue[i]);
            if (!c2 || c2.meshes) queue.splice(i, 1);   // evicted or already built
          }
          const d2 = k => { const c2 = chunks.get(k);
            const ax = (c2.cx + 0.5) * CH - cg[0], az = (c2.cz + 0.5) * CH - cg[2];
            return ax * ax + az * az; };
          queue.sort((a, b) => d2(a) - d2(b));
          // close chunks (fresh spawn / teleport) get a burst; cruise trickles.
          // Halved with the density bump: a chunk is ~6 ms of terrainH/surface
          // now, and six of those in one frame is a visible hitch. The cadence
          // doubled to compensate, so a fresh spawn still fills in ~2 s.
          let budget = queue.length && d2(queue[0]) < 1500 * 1500 ? 3 : 1;
          while (budget-- > 0 && queue.length) {
            const c2 = chunks.get(queue.shift());
            if (c2) c2.meshes = gen(c2.cx, c2.cz);
          }
        }
        for (const [k, c2] of chunks) {    // evict far chunks
          const ax = (c2.cx + 0.5) * CH - cg[0], az = (c2.cz + 0.5) * CH - cg[2];
          if (ax * ax + az * az < R_DROP * R_DROP) continue;
          if (c2.meshes) {
            for (const m of c2.meshes.meshes) { scene.remove(m); if (m.dispose) m.dispose(); }
            for (const r of c2.meshes.reg) {   // or lodUpdate keeps poking dead meshes
              let i = nearChunks.indexOf(r); if (i >= 0) nearChunks.splice(i, 1);
              i = impChunks.indexOf(r); if (i >= 0) impChunks.splice(i, 1);
            }
            for (const rec of (c2.meshes.recs || [])) {
              const i = ladderChunks.indexOf(rec); if (i >= 0) ladderChunks.splice(i, 1);
            }
          }
          chunks.delete(k);
        }
      };
    }
  }

  { // THE BASE AERODROME, from the ONE declaration (G123)
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
    const WANISO = renderer.capabilities.getMaxAnisotropy();
    const HOME = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
    const R = siteRunway(HOME);
    const decal = (w, h, color, y, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshLambertMaterial({ color: C(color), depthWrite: false,
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
      rtex.encoding = THREE.sRGBEncoding;
      rtex.anisotropy = renderer.capabilities.getMaxAnisotropy();
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
        : new THREE.MeshLambertMaterial({ color: C(0x6b7a36), depthWrite: false,
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
    const markMat = new THREE.MeshLambertMaterial({ color: C(0xe4dccb) });
    for (const P of siteMarkers(HOME)) {
      const m = new THREE.Mesh(markGeo, markMat);
      m.position.set(P.x, 0.35, P.z);
      m.castShadow = true; m.receiveShadow = true; scene.add(m);
    }

    const wall = C(0xcbb79a), roofc = C(0x9c5f43), trim = C(0x6d5744);
    const building = (x, z, w, d, hgt, ry, wc) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d),
        new THREE.MeshLambertMaterial({ color: wc || wall }));
      body.position.y = hgt / 2;
      const r = d * 0.60;
      const rg = new THREE.CylinderGeometry(r, r, w * 1.05, 3, 1);
      rg.rotateY(Math.PI / 2); rg.rotateZ(Math.PI / 2);
      const roof = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: roofc }));
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
      new THREE.MeshLambertMaterial({ color: C(0xd8d2c4) }));
    pole.position.set(SITE.windsock.x, SITE.windsock.h / 2, SITE.windsock.z);
    pole.castShadow = true; pole.receiveShadow = true; scene.add(pole);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 2.6, 10, 1, true),
      new THREE.MeshLambertMaterial({ color: C(0xe4622e), side: THREE.DoubleSide }));
    sock.castShadow = true; scene.add(sock);
    // W13: wind-driven, see setWindVis
    socks.push({ pole: [SITE.windsock.x, SITE.windsock.h - 0.5, SITE.windsock.z], mesh: sock });

    // THE BOUNDARY, in runs with a gate in it. The old fence was one line from
    // x 60 to -80 that walked straight through the taxiway.
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, SITE.fence.h),
      new THREE.MeshLambertMaterial({ color: C(0x8a7457) }));
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
    const steel = new THREE.MeshLambertMaterial({ color: C(0x8d9299) });
    const rust  = new THREE.MeshLambertMaterial({ color: C(0xb2653a) });
    const wood  = new THREE.MeshLambertMaterial({ color: C(0xa8834f) });
    const straw = new THREE.MeshLambertMaterial({ color: C(0xd7bf7c) });
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

    { // windbreak behind the hangars (well clear of the strip)
      const T = SITE.trees;
      const tg = new THREE.ConeGeometry(T.r, T.h, 7); tg.translate(0, T.h / 2, 0);
      const tm = new THREE.MeshLambertMaterial({ color: C(0x4a6129) });
      for (let x = T.x1; x >= T.x0; x -= T.step) {
        const t = prop(tg, tm, x + (x % 3) * 0.6, 0, T.z + (x % 5) * 0.7);
        t.scale.setScalar(0.85 + (x % 7) / 9);
      }
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
        new THREE.MeshLambertMaterial({ color: 0xffffff }), BL.length);
      const roofs = new THREE.InstancedMesh(roofGeo,
        new THREE.MeshLambertMaterial({ color: 0xffffff }), BL.length);
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
    const deckMat = new THREE.MeshLambertMaterial({ color: C(0x8a6a4a) });
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

  { // stage-4 aerodromes: strip decals + windsocks at every field/strip
    const mkTex = kind => {
      const cv2 = document.createElement('canvas'); cv2.width = 512; cv2.height = 64;
      const q = cv2.getContext('2d');
      if (kind === 'paved') {
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
      t.encoding = THREE.sRGBEncoding;
      return t;
    };
    const texes = {};
    const poleMat = new THREE.MeshLambertMaterial({ color: C(0xd8d2c4) });
    const sockMat = new THREE.MeshLambertMaterial({ color: C(0xe4622e), side: THREE.DoubleSide });
    const patchMat = new THREE.MeshLambertMaterial({ map: outerTexShared });
    // patch uvs span the full 24 km domain: 613 tiles ~= the inner ring's
    // on-ground grain density (230 tiles over 9 km)
    if (detailApply) detailApply(patchMat, 613);
    for (const a of world.aerodromes) {
      if (a.kind === 'meadow' || a.id === 'HOME') continue;
      const kind = a.surface === world.SURFACE.PAVED ? 'paved'
        : a.surface === world.SURFACE.GRAVEL ? 'gravel' : 'grass';
      if (!texes[kind]) texes[kind] = mkTex(kind);
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
          uv.setXY(i, (x + 12000) / 24000, 1 - (z + 12000) / 24000);
        }
        g2.computeVertexNormals();
        const pm = new THREE.Mesh(g2, patchMat);
        pm.receiveShadow = true;
        scene.add(pm);
      }
      // the strip decal is DRAPED (per-vertex terrainH), not a flat plane
      // at a.elev — wheels roll on terrainH, and the two now agree
      const geo = new THREE.PlaneGeometry(a.len, a.wid,
        Math.ceil(a.len / 12), Math.max(2, Math.ceil(a.wid / 8)));
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(-a.hdg);
      geo.translate(a.x, 0, a.z);
      const dp = geo.attributes.position;
      for (let i = 0; i < dp.count; i++)
        dp.setY(i, world.terrainH(dp.getX(i), dp.getZ(i)) + 0.07);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo,
        new THREE.MeshLambertMaterial({ map: texes[kind], depthWrite: false }));
      m.renderOrder = 2;
      m.receiveShadow = true;
      scene.add(m);
      // windsock off the strip edge
      const px2 = a.x - Math.sin(a.hdg) * (a.wid / 2 + 9);
      const pz2 = a.z + Math.cos(a.hdg) * (a.wid / 2 + 9);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6), poleMat);
      pole.position.set(px2, a.elev + 3, pz2); pole.castShadow = true; scene.add(pole);
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 2.6, 10, 1, true), sockMat);
      sock.castShadow = true; scene.add(sock);
      socks.push({ pole: [px2, a.elev + 5.5, pz2], mesh: sock });   // W13 wind-driven
    }
  }

  { // landing meadows: marker ring + beacon
    const beaconGeo = new THREE.CylinderGeometry(0.16, 0.22, 7);
    const flagGeo = new THREE.PlaneGeometry(2.4, 1.4);
    const ringGeo = new THREE.ConeGeometry(0.55, 1.7, 6);
    const ringMat = new THREE.MeshLambertMaterial({ color: C(0xe4622e) });
    for (const m of world.meadows) {
      const b = new THREE.Mesh(beaconGeo, new THREE.MeshLambertMaterial({ color: C(0xe9e2d3) }));
      b.position.set(m.x, m.h + 3.5, m.z); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      const fl = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({
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

  let clouds;
  { // cumulus: soft billboard puffs, warm tops, shaded undersides
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g2 = cv.getContext('2d');
    for (const [cx, cy, r, a] of [[64,64,60,1],[44,70,34,0.8],[86,72,30,0.8]]) {
      const gr = g2.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      gr.addColorStop(0.45, 'rgba(255,255,255,' + a * 0.55 + ')');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g2.fillStyle = gr; g2.beginPath(); g2.arc(cx, cy, r, 0, 6.283); g2.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    const pos = [], col = [], c = new THREE.Color();
    const TOP = C(0xfff1dd), BOT = C(0xa8a2b4);
    let seed = 91;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let k = 0; k < 64; k++) {
      const cx = (rnd() - 0.5) * 22000, cz = (rnd() - 0.5) * 22000;
      const cy = 480 + rnd() * 420, n = 7 + (rnd() * 7 | 0), sp = 90 + rnd() * 150;
      for (let i = 0; i < n; i++) {
        const dy = (rnd() - 0.45) * 70;
        pos.push(cx + (rnd() - 0.5) * sp * 2, cy + dy, cz + (rnd() - 0.5) * sp * 2);
        c.copy(BOT).lerp(TOP, Math.min(1, Math.max(0, dy / 45 + 0.55)));
        col.push(c.r, c.g, c.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    clouds = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size: 340,
      sizeAttenuation: true, transparent: true, opacity: 0.92, depthWrite: false,
      vertexColors: true, fog: false }));
    clouds.frustumCulled = false;
    scene.add(clouds);
  }

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
  function worldUpdate(cg) {
    // Tree LOD reads the CHASE CAMERA, not the CG: the impostor picks its baked
    // view from the direction to the eye, and 30 m of chase offset is 4 deg of
    // parallax at the near edge of the band. One frame stale (the viewer places
    // the camera after this call) and that is fine — 30 m of aircraft travel
    // shifts nothing at 450 m.
    uCam.value.copy(camera.position);
    uCG.value.set(cg[0], cg[1], cg[2]);
    fillUpdate(cg);
    lodUpdate(cg);
    const gy = world.terrainH(cg[0], cg[2]);
    const agl = Math.max(0, cg[1] - gy);
    const reach = Math.min(agl / SUN.y, 520);
    const tx = cg[0] - SUN.x * reach * 0.5, tz = cg[2] - SUN.z * reach * 0.5;
    sun.target.position.set(tx, gy, tz);
    sun.position.set(tx + SUN.x * 700, gy + SUN.y * 700, tz + SUN.z * 700);
    const half = Math.max(RIG.shadowMin, Math.min(540, 105 + reach * 0.55));
    if (Math.abs(half - shadowHalf) > shadowHalf * 0.12 + 4) {
      shadowHalf = half;
      const c = sun.shadow.camera;
      c.left = -half; c.right = half; c.top = half; c.bottom = -half;
      c.updateProjectionMatrix();
    }
    clouds.position.x += 0.05;
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
  const rigRows = {};
  const hexOf = (c, d) => (c && c.getHex) ? c.getHex() : d;   // the gate's stub has no Color
  const rigSnapshot = () => ({
    elev: Math.asin(SUN.y) * 180 / Math.PI, azim: Math.atan2(SUN.x, SUN.z) * 180 / Math.PI,
    sunI: RIG.sun, sunCol: hexOf(sun.color, SUNC), hemi: RIG.hemi,
    hemiSky: hexOf(hemi.color, RIG.skyCol), hemiGnd: RIG.gndCol,
    exposure: (renderer && renderer.toneMappingExposure) || 1,
    env: 'dome', shadowMin: RIG.shadowMin,
    shadowMap: (sun.shadow && sun.shadow.mapSize) ? sun.shadow.mapSize.x : 1024,
    dome: (worldSky && worldSky.material.uniforms) ? {
      top: hexOf(worldSky.material.uniforms.uTop.value, 0x3f7fbe),
      mid: hexOf(worldSky.material.uniforms.uMid.value, 0x9dc4dd),
      haze: hexOf(worldSky.material.uniforms.uHaze.value, HAZE),
      sunCol: hexOf(worldSky.material.uniforms.uSunCol.value, SUNC) } : null,
  });
  rigRows.sunset = rigSnapshot();
  rigRows.alps = Object.assign({}, rigRows.sunset, {
    elev: 33.4, azim: 28.7, sunI: 2.8, sunCol: 0xffdca8, hemi: 0.274, hemiSky: 0xc5d9ff,
    hemiGnd: 0x343422, exposure: 0.92, env: 'alps', shadowMin: 250, shadowMap: 2048,
    dome: { top: 0x3f7fbe, mid: 0xa9c8e0, haze: 0xcfd9e3, sunCol: 0xfff1dc },
  });
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
    SUN.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    sun.intensity = RIG.sun = R.sunI; if (sun.color && sun.color.setHex) sun.color.setHex(R.sunCol);
    hemi.intensity = RIG.hemi = R.hemi;
    if (hemi.color && hemi.color.setHex) { hemi.color.setHex(R.hemiSky); hemi.groundColor.setHex(R.hemiGnd).multiplyScalar(gb); }
    if (renderer) renderer.toneMappingExposure = R.exposure;
    RIG.shadowMin = R.shadowMin;
    if (sun.shadow && sun.shadow.mapSize && sun.shadow.mapSize.x !== R.shadowMap) {
      sun.shadow.mapSize.set(R.shadowMap, R.shadowMap);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (worldSky && R.dome && worldSky.material.uniforms) {
      const u = worldSky.material.uniforms;
      u.uTop.value.setHex(R.dome.top); u.uMid.value.setHex(R.dome.mid);
      u.uHaze.value.setHex(R.dome.haze); u.uSunCol.value.setHex(R.dome.sunCol);
      if (scene.fog) scene.fog.color.setHex(R.dome.haze);
    }
    if (R.env === 'alps') {
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
  return { worldUpdate, SUN, sun, hemi, minimap: miniCanvas, setWindVis, envMap, rig: worldRig,
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
