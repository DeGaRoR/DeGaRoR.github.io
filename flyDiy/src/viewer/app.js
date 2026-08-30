(() => {
  const world = makeWorld();
  // `gen` is the GARAGE: not a fiche but a generator, rebuilt from a live spec
  // (src/core/6x_gen_*.js). `window.GARAGE_SPEC` is the editor's handle on it —
  // and it is now actually ASSIGNED, in garage.js. This comment claimed it from
  // G3 while nothing ever set it, which is how a build ended up reachable only
  // from inside a closure and a user lost an aeroplane to a reload. See G7.
  let genSpec = null;
  const AIRCRAFT = { pa18: buildPA18, cub: buildCub, drone: buildDrone, dc3: buildDC3, jojo: buildJodel, c172: buildC172, chnk: buildChinook,
                     gen: () => buildGen(genSpec) };
  let def, sim, ap, nb, curKey;
  // `rigLift` lives up here with groundY because applyEnv() reads it, and that
  // runs long before the load-test block further down is reached.
  let groundY = 0, rigLift = 0;
  const $ = id => document.getElementById(id);

  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 7000);
  const target = new THREE.Vector3(2.2, 1, 0);
  // THE ORBIT IS SMOOTHED (G39, user: "very shaky ... slightly jumps
  // when moving", and the old garage always had it). Input writes the
  // TARGETS; the frame loop eases the actuals toward them. The judder
  // was never the math (measured: perfectly uniform steps under
  // synthetic input) — it is the input path: one mouse pixel is a fixed
  // 0.006 rad quantum, which at dist 14 is an ~8 cm jump at the
  // aeroplane, aliased against event/frame timing. The easing melts
  // both the quantum and the aliasing; ~50 ms to converge, so it reads
  // as weight, not lag.
  let az = -2.5, el = 0.22, dist = 14;
  let azT = az, elT = el, distT = dist;
  // THE CAMERA IS BOUND TO THE ROOM (G55, user: "we need camera bounding to
  // the hangar size"). Outside the garage nothing changes — a world camera has
  // a world to be in. INSIDE it, an orbit that walks through the wall shows
  // you the shed from a field, which is both wrong and the fastest way to lose
  // your bearings; so the eye is kept inside the shell, a hand's breadth off
  // the sheeting and under the eaves. It is a CLAMP, not a collision: the
  // orbit still goes all the way round, it just slides along the wall when the
  // radius would take it through.
  function placeCamera() {
    let x = target.x + dist * Math.cos(el) * Math.cos(az),
        y = Math.max(0.4, target.y + dist * Math.sin(el)),
        z = target.z + dist * Math.cos(el) * Math.sin(az);
    const room = inGarage && garageIsHangar() && hangar && hangar.dims;
    if (room) {
      // THE MARGIN IS THE NEAR PLANE, not a number (G62.5, user: "I often see
      // half-through a wall, and that looks bad"). It was 0.55 m measured to
      // the wall CENTRE, and the sheeting is 0.12 thick, so the eye sat 0.49 m
      // off the inner face — INSIDE a near plane of 0.5. The wall was being
      // clipped away and you saw the field through it. The clamp has to clear
      // the near plane by a visible margin or it is not a clamp at all, so it
      // is derived from it and follows it if it ever changes.
      const d = hangar.dims, gy = hangar.group.position.y;
      const m = camera.near + 0.25 + 0.06;      // near + clear air + half the sheet
      x = Math.max(-(d.HD - m), Math.min(d.HD - m, x));
      z = Math.max(-(d.HW - m), Math.min(d.HW - m, z));
      y = Math.max(gy + 0.5, Math.min(gy + d.EAVE - 0.5, y));
    }
    camera.position.set(x, y, z);
    camera.lookAt(target);
  }

  const WF = buildWorldScene(scene, world, renderer, camera);

  // ================= THE GARAGE'S OWN SCENE =================
  // The editor and the simulation are two different places, and this is what
  // makes them two. Everything that IS the aeroplane lives in one group, so
  // moving it between the world and the garage is a single reparent rather than
  // a dozen add/remove calls that have to be kept in step.
  //
  // Same renderer, same canvas, same camera: switching costs nothing and
  // reloads nothing. Only the scene changes.
  //
  // TWO ROOMS to build in, because they answer different questions. The HANGAR
  // is where the aeroplane lives and is the default — it gives it a floor, a
  // scale to be judged against and light with a direction. The STUDIO is a
  // neutral field with nothing in it, which is what you want when the question
  // is about the SHAPE and the room is in the way. Both are garage-only; the
  // world is a third thing and belongs to flying.
  const craft = new THREE.Group();
  scene.add(craft);
  // Renderer settings the world owns, kept so a room can borrow and return them.
  //
  // PHYSICALLY CORRECT LIGHTS is the one that matters, and it is the single
  // biggest trap in porting the hangar. In three 0.184 — what the design
  // session drew it in — lights are ALWAYS physical: a PointLight's intensity
  // is in candela and falls off with distance squared. In r128 that behaviour
  // is opt-in and OFF by default, so the room's authored `PointLight(…, 90, 26,
  // 2)` is not a shop lamp, it is a small sun, and the first render of the
  // hangar came out pure white in every pixel.
  //
  // So the room turns it on for itself and hands it back on the way out. The
  // world and the two mesh aircraft are calibrated under the legacy model and
  // must not inherit this.
  // WHAT THE CARD ALLOWS (G57, user: "harsh blurring of the wing texture on low
  // incidence angle"). At a grazing angle one pixel's footprint is long and
  // thin; mip selection takes the long axis and the texture goes to mush.
  // Anisotropic filtering is the answer and costs almost nothing, but three
  // defaults to 1 and this viewer asked for 4. Published so every other file —
  // props, workshop, the hangar — asks the same question once.
  // ASKED, not assumed: the headless smoke gate stubs THREE with what the
  // viewer needed before any of this existed, so `capabilities` is not there
  // and reaching through it throws at module eval — which is a dead viewer, not
  // a missing filter setting.
  if (typeof window !== 'undefined') {
    const cap = renderer.capabilities;
    window.FLYDIY_ANISO = (cap && typeof cap.getMaxAnisotropy === 'function')
      ? cap.getMaxAnisotropy() : 8;
  }

  const WORLD_EXPOSURE = renderer.toneMappingExposure;
  const WORLD_PHYSLIGHTS = !!renderer.physicallyCorrectLights;
  // WHAT THE AEROPLANE'S envMapIntensity SHOULD BE OUT THERE — and it is not
  // 1.0, because the world counts the sky TWICE for anything Standard.
  //
  // The world has a HemisphereLight AND a scene.environment baked from the
  // same sky dome. r128 routes scene.environment to MeshStandardMaterial and
  // nothing else, so the split is uneven in a way nothing declares:
  //   terrain, trees, buildings (Lambert)  -> hemisphere only        = one sky
  //   the AEROPLANE, the water  (Standard) -> hemisphere + probe     = two skies
  // The aeroplane is therefore the one object in the scene carrying twice the
  // ambient of everything around it — which is precisely the complaint. It
  // does not read as "too bright", because a second broad, pale source lifts
  // the dark channels far more than the bright one: it reads as FLAT. Measured
  // on the wing's upper surface, saturation (max-min)/max:
  //   the shed        0.474
  //   the world       0.350   <- the same paint, two skies
  //   env at 0.5      0.401
  //   env at 0        0.443   (and every metal goes black)
  //
  // Half, because two skies should sum to one. It is the smallest correction
  // that stops the double count, and it is applied to the ENVIRONMENT rather
  // than the hemisphere on purpose: the hemisphere is the only ambient the
  // Lambert world has, and halving that would darken the terrain to fix the
  // aeroplane. This touches exactly the materials that were counted twice.
  const WORLD_ENV = 0.5;


  // THE STUDIO IS GONE (user, 2026-08-30: "retire it").
  //
  // It was a white void with a full-strength HemisphereLight, a warm fill and
  // a PMREM dome whose floor was a bright #b9b3a5 — four sources, not one of
  // them switchable, in a project whose whole complaint was that the aeroplane
  // was lit from below by something nobody could turn off. Its selector was
  // retired at G78 and nothing asked for it on purpose; it survived only as
  // the silent fallback for a hangar that would not build.
  //
  // A silent fallback into an un-auditable light rig is the worst possible
  // answer to a failed build, because the symptom it produces is "the
  // lighting is wrong" in a room nobody knows they are in. A failed hangar is
  // an ERROR now: the garage stays empty and says so, loudly and once.

  // ---- THE HANGAR, built on demand ----------------------------------------
  // Deferred because it is a thousand lines of geometry and a dozen baked
  // sheets: a session that never opens the garage should not pay for a shed.
  // Built once, then kept — it does not depend on the aeroplane.
  //
  // `genHangarSupported` is asked rather than assumed. The headless smoke gate
  // stubs THREE with what the viewer needed before this room existed, and a
  // missing constructor should leave the room unbuilt, not throw on boot.
  const hangarScene = new THREE.Scene();
  let hangar = null, hangarTried = false;
  // WHERE THE REFLECTIONS COME FROM (user: "can we get lighting from HDRI? Try
  // that as a new option"). Two sources, one target:
  //   'room' — a cube camera on the floor sees the glazing, the roof lights and
  //            the open door, and a PMREM of THAT is what every glossy thing in
  //            here reflects. It is the difference between "lit" and "in a
  //            room", and it is the default because the room is the subject.
  //   'sky'  — the alps_field equirect straight into PMREM. Now that the
  //            windows are actually cut, the sky is what is really outside
  //            them, so this is the honest outdoor answer: cooler, more
  //            directional, and it does not know the shed is there.
  // Nothing else changes — the lamps, the door key and the moods are lights,
  // and lights are not an environment.
  // read at first build, not here: prefGet is declared further down and this
  // line runs at module eval, which is inside its temporal dead zone
  let envSource = 'room';
  let mobileOn = true;
  // THE SHED'S OWN SIZE (G53). A viewer preference like the mood, not part of
  // the aeroplane: half-width, half-depth and eaves height in metres. null
  // means "whatever genHangarBuild's own default is", which is what a fresh
  // profile gets. Read at first build — prefGet is declared further down.
  let hangarDims = null;
  const DIM_LIMS = { HW: [7, 24], HD: [6, 20], EAVE: [4.2, 11] };
  let envRT = null, envPM = null;
  // whether the aeroplane contributes to the room's own reflection probe. Off
  // is correct (see the bake) and is the default; the switch is for tests.
  // READ AT FIRST BUILD, not here: prefGet is declared further down and this
  // line runs at module eval, which is inside its temporal dead zone. The
  // file already carries that warning twice; this is the third time it bit.
  let craftInProbe = false;
  function bakeHangarEnv() {
    if (!hangar || !THREE.PMREMGenerator || !renderer.setRenderTarget) return;
    // the bake has to happen under the room's OWN lighting model, or the
    // environment it produces belongs to a different sun than the one that
    // will light the aeroplane standing in it
    const physWas = renderer.physicallyCorrectLights;
    renderer.physicallyCorrectLights = true;
    const pm = new THREE.PMREMGenerator(renderer);
    // ASKED FOR, not remembered (G62): the sky changes with the mood, so the
    // texture to bake is whichever one is hanging outside right now
    // A GRADED ROOM (G62.2) has no baked picture to hand over: its sky only
    // exists as the backdrop's own shader, so it renders one at probe size on
    // demand. `renderSky` is a no-op when nothing has changed since the last.
    if (hangar.renderSky) hangar.renderSky(renderer);
    const sky = hangar.skyTexture ? hangar.skyTexture() : null;
    const skyReady = envSource === 'sky' && sky && sky.image &&
                     sky.image.width && pm.fromEquirectangular;
    // PMREMGenerator.dispose() frees its own ping-pong target and shaders, NOT
    // the target it just handed back — that one is the caller's. It used to be
    // baked twice a session and nobody noticed; a mood is a sky now, so this
    // runs on every mood change, and the old one has to go or the day cycle
    // leaks a render target per click (measured: +2 textures a change).
    let rt = null;
    if (skyReady) {
      pm.compileEquirectangularShader();
      rt = pm.fromEquirectangular(sky);
    } else if (THREE.WebGLCubeRenderTarget) {
      if (!envRT) envRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
      const cam = new THREE.CubeCamera(0.5, 100, envRT);
      cam.position.set(0, 3.2, 0);
      // THE AEROPLANE WAS IN ITS OWN REFLECTION PROBE (G62.3, found chasing
      // the user's "global pink glow in the whole hangar"). This camera sits
      // at 3.2 m in the middle of the floor - a metre above a wing that spans
      // 8.4 m - so the craft filled a large part of the probe and its PAINT
      // came back as the ambient colour of the entire shed, through
      // scene.environment. Measured on the back wall with the aeroplane in
      // and out of the bake: mean RGB 54.4/47.5/43.0 vs 47.8/43.8/36.8, i.e.
      // +13% brightness and (R+B)/2G from 0.966 to 1.026. The shed was being
      // lit by whatever colour the wing was painted, and the aeroplane was
      // reflecting itself.
      //
      // Out by default, and a switch because it is exactly the kind of thing
      // a lighting test wants to toggle. Same treatment the dust already got,
      // and the shafts are RESTORED rather than forced on, or muting them
      // from the light panel would be undone by every bake.
      const shWas = hangar.shafts.visible;
      const crWas = craft.visible;
      hangar.shafts.visible = false;        // dust is not geometry to reflect
      // THE AEROPLANE IS IN ITS OWN REFLECTION PROBE — AGAIN, AND BY A SECOND
      // DOOR (user: "the plane is lit from the bottom, and I can also see that
      // in the generated wing in the hangar, the yellow one").
      //
      // G62.3 found this once and excluded `craft`. But in the garage the
      // aeroplane you are looking at is NOT `craft` — it is the EDITOR'S CAGE,
      // on its own mount, and no exclusion ever covered it. The cube camera
      // sits at (0, 3.2, 0) and the wing's upper surface is at 2.14, so a lit
      // 10 m wing fills most of the probe's lower hemisphere from one metre
      // away. Photographed from the probe's own position looking down, the
      // frame is almost entirely wing; the floor is a small dark patch at the
      // edge.
      //
      // So the wing was lighting its own underside, through the environment,
      // and it did it hardest exactly where the user saw it: at night, when
      // the lamps make the wing top the brightest thing in the building.
      // MEASURED at NIGHT, belly as a percentage of the wing's own top
      // surface: 287% with the cage in the probe, 3.4% with it out.
      //
      // THE LESSON, and it is the same one twice: an exclusion written against
      // one object is not a rule, it is a special case. What belongs in a
      // room's probe is THE ROOM — everything the player brought into it is a
      // subject, and a subject that lights itself is a mirror.
      const subjects = [craft, edSit, refSit];
      const subWas = subjects.map(o => o && o.visible);
      if (!craftInProbe) subjects.forEach(o => { if (o) o.visible = false; });
      // THE GROUND BOUNCE IS OCCLUDED (user: "the plane is lit from the
      // bottom"). This camera sits at 3.2 m in an empty middle of the floor,
      // so the whole lower half of the cube is lit concrete at full radiance —
      // and G62.5 then multiplied the environment by 2.2 to replace three
      // deleted OVERHEAD fills. Both were right on their own terms and the
      // product is a floor that shines upward. Measured before this line
      // existed: at NIGHT the environment alone put 0 on the top of the wing
      // and 7.4 on its underside.
      //
      // What is missing is occlusion. A wing 1.9 m over a slab shades the very
      // floor that would light it, and the gap between them is enclosed —
      // nothing like the free hemisphere the probe records. G62 had already
      // measured the same term for the hemisphere light it later deleted and
      // anchored it at x0.148; the probe never got it. This is that term,
      // applied to the surfaces the room declares as ground.
      //
      // Scaling the material COLOUR is what makes it a bounce rather than a
      // blackout: colour multiplies the albedo map, so the floor comes back
      // with its own texture and its own lamp pools, at the fraction of the
      // radiance a shaded underside can actually see.
      const gb = (window.LIGHT_RIG ? window.LIGHT_RIG.groundBounce() : 1);
      const gWas = [];
      if (gb < 1 && hangar.groundMats) for (const m of hangar.groundMats) {
        if (!m || !m.color) continue;
        gWas.push([m, m.color.clone()]);
        m.color.multiplyScalar(gb);
      }
      cam.update(renderer, hangarScene);
      for (const [m, c0] of gWas) m.color.copy(c0);
      hangar.shafts.visible = shWas;
      subjects.forEach((o, i) => { if (o) o.visible = subWas[i]; });
      craft.visible = crWas;
      rt = pm.fromCubemap(envRT.texture);
    }
    if (rt) {
      hangarScene.environment = rt.texture;
      if (envPM && envPM !== rt) envPM.dispose();
      envPM = rt;
    }
    pm.dispose();
    renderer.physicallyCorrectLights = physWas;
    // the equirect is a data-URI image and decode is asynchronous: a 'sky' bake
    // asked for before it lands falls back to the room and comes back here.
    // The room's own `onSkyReady` (wired in getHangar) covers the swap case;
    // this covers the very first bake, before that wiring is in place.
    if (envSource === 'sky' && !skyReady && sky && sky.image && !sky.image.__envHook) {
      sky.image.__envHook = 1;
      sky.image.addEventListener('load', () => { sky.needsUpdate = true; bakeHangarEnv(); });
    }
  }
  function setEnvSource(k) {
    envSource = k === 'sky' ? 'sky' : 'room';
    prefSet('flydiy.hangarEnvSrc', envSource);
    if (getHangar()) bakeHangarEnv();
  }
  function getHangar() {
    if (hangarTried) return hangar;
    hangarTried = true;
    if (typeof genHangarBuild !== 'function' ||
        !genHangarSupported(THREE)) return null;
    try {
      if (hangarDims === null) {
        try { hangarDims = JSON.parse(prefGet('flydiy.hangarDims', 'null')); }
        catch (e) { hangarDims = null; }
      }
      hangar = genHangarBuild(THREE, hangarDims || undefined);
      hangarScene.add(hangar.group);
      hangarScene.background = hangar.background;
      hangarScene.fog = hangar.fog;
      // The room lights itself: a cube camera on the floor sees the glazing,
      // the roof lights and the open door, and a PMREM of that is what every
      // glossy thing in here reflects. It is the difference between "lit" and
      // "in a room" — and the aeroplane is the glossiest thing in it.
      // the bake has to happen under the room's OWN lighting model, or the
      // environment it produces belongs to a different sun than the one that
      // will light the aeroplane standing in it
      envSource = prefGet('flydiy.hangarEnvSrc', 'room') === 'sky' ? 'sky' : 'room';
      craftInProbe = prefGet('flydiy.craftInProbe', '0') === '1';
      mobileOn = prefGet('flydiy.hangarMobile', '1') !== '0';
      const gsK = parseFloat(prefGet('flydiy.groundShadow', ''));
      if (isFinite(gsK) && hangar.groundShadow) hangar.groundShadow(gsK);
      if (hangar.mobileShow) hangar.mobileShow(mobileOn);
      // THE MOOD GOES FIRST (G62). It is the sky now, not just a set of light
      // intensities: it decides what stands outside the door, which way the
      // key points, and therefore both what the environment bake sees and
      // where the floor shadow falls. Baking before it ran meant baking the
      // wrong room.
      hangar.setMood(hangarMood);
      if (hangar.renderSky) hangar.renderSky(renderer);
      // a swapped-in equirect decodes asynchronously, and the room bake sees
      // it through the open door just as the sky bake reads it directly — so
      // either way, the environment is worth having again once it lands
      if (hangar.onSkyReady) hangar.onSkyReady(() => bakeHangarEnv());
      bakeHangarEnv();
      if (hangar.bakeGroundShadow) hangar.bakeGroundShadow(renderer, hangarScene);
      // the part system (G41): restore every part's saved dress with the
      // room. One JSON pref, whole-state.
      if (hangar.setPart) {
        let saved = {};
        try { saved = JSON.parse(prefGet('flydiy.hangarParts', '{}')) || {}; }
        catch (e) {}
        for (const k in saved) hangar.setPart(k, saved[k]);
      }
      // the daylight card fed the bake as the door's big soft source;
      // with a real sky standing outside, the EYE gets the mountains
      if (hangar.hasSky && hangar.dayCard) hangar.dayCard.visible = false;
    } catch (e) {
      // there is no other room to fall back to, so this is an error and not
      // a shrug — see garageScene()
      hangar = null;
      if (window.console) console.error('hangar unavailable, the garage will be empty:', e.message);
    }
    return hangar;
  }

  // A NEW SIZE IS A NEW ROOM. genHangarBuild builds a whole shed from nothing,
  // so changing a dimension means throwing the old one away and asking again —
  // there is no in-place resize and there should not be, because half the room
  // is derived from the numbers (the roof slope, the door leaves, the glazing
  // bays, where every fitting stands).
  //
  // THE ONE THING THAT MUST SURVIVE IT is the prop library: propBuild caches
  // one geometry and one material per prop and hands out Meshes over them, so
  // disposing a prop mesh's geometry would take out every future instance of
  // that prop as well. props.js marks them; everything else is the room's own
  // and is disposed here, or a few slider drags leak a shed each.
  function disposeHangar() {
    if (!hangar) return;
    if (hangar.disposeGroundShadow) hangar.disposeGroundShadow();
    hangarScene.remove(hangar.group);
    const mats = new Set();
    hangar.group.traverse(o => {
      if (!o.geometry || o.userData.sharedGeo) return;
      o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material])
        .forEach(m => mats.add(m));
    });
    for (const m of mats) m.dispose();
    // a material's dispose does NOT take its maps with it, and the backdrop's
    // is a 4k equirect — the one texture in this room big enough that leaking
    // one per slider drag would be felt
    if (hangar.skyTexture) {
      const t = hangar.skyTexture();
      if (t && t.dispose) t.dispose();
    }
    hangar = null; hangarTried = false;
  }
  function setDims(d) {
    const cur = (hangar && hangar.dims) ? hangar.dims : {};
    const next = { HW: cur.HW, HD: cur.HD, EAVE: cur.EAVE };
    for (const k in DIM_LIMS)
      if (d && typeof d[k] === 'number')
        next[k] = Math.max(DIM_LIMS[k][0], Math.min(DIM_LIMS[k][1], d[k]));
    hangarDims = next;
    prefSet('flydiy.hangarDims', JSON.stringify(next));
    disposeHangar();
    if (inGarage) applyEnv();
    return getHangar() ? hangar.dims : null;
  }

  // ---- which room, and its mood -------------------------------------------
  // A viewer preference, not part of the aeroplane: it does NOT go in the spec,
  // so it never lands in a saved build or a shared design.
  const PREF = (() => {
    try { return window.localStorage; } catch (e) { return null; }
  })();
  const prefGet = (k, d) => { try { const v = PREF && PREF.getItem(k); return v == null ? d : v; }
                              catch (e) { return d; } };
  const prefSet = (k, v) => { try { if (PREF) PREF.setItem(k, v); } catch (e) {} };
  // THE ROOM IS NO LONGER A CHOICE (G78, design option 9b) and no longer has
  // an alternative to fall back to either — see the studio's obituary above.
  // how many moods there could be before the room has been built and can say.
  // The saved pref is clamped against the room's own list the moment there is
  // one (setMood, applyEnv), so this is a sanity bound and nothing more.
  const MOOD_MAX = 16;
  let hangarMood = Math.max(0, Math.min(MOOD_MAX - 1,
                                        +prefGet('flydiy.garageMood', 0) | 0));
  // THE ROOM IS THE HANGAR. If it cannot be built the scene is EMPTY and the
  // console says why — an empty room is a bug you can see and report, and the
  // thing it replaced was a second uncontrolled light rig you could not.
  let hangarFailSaid = false;
  function garageScene() {
    const h = getHangar();
    if (!h && !hangarFailSaid) {
      hangarFailSaid = true;
      if (window.console) console.error(
        'garage: the hangar could not be built, so the room is empty. ' +
        'There is no fallback room by design — see app.js.');
    }
    return hangarScene;
  }
  function garageIsHangar() { garageScene(); return !!hangar; }
  // Put the aeroplane in the chosen room and give the renderer the settings
  // that room was lit for. Exposure is a RENDERER setting, not a scene one, so
  // it has to be handed back when we leave or the world inherits the hangar's.
  function applyEnv() {
    const s = garageScene();
    if (craft.parent !== s) s.add(craft);
    if (edSit.parent !== s) s.add(edSit);   // the editor's mount (G36)
    if (refSit.parent !== s) s.add(refSit); // the reference's (G89)
    // `rigLift` is the load test's own 200 m hop clear of the ground. The room
    // takes the same offset so the aeroplane stays standing in it: the camera
    // tracks the CG and went up with the aeroplane, but the hangar did not, and
    // the test ran against an empty sky. Nothing MOVES relative to anything —
    // that is the point — so the rig still reads exactly as before.
    if (hangar) hangar.group.position.y = groundY + rigLift;
    const inRoom = inGarage && garageIsHangar() && hangar;
    // THE MOBILE KIT stands next to whatever aeroplane is in the room, so it
    // is re-placed from the aeroplane's own footprint every time we come
    // through here — a DC-3 pushes it out, a drone lets it back in. The
    // aeroplane's box is measured, not assumed: `craft` holds the model when
    // there is one and the wireframe when there is not, and both span it.
    if (inRoom && hangar.placeMobile) {
      const bb = new THREE.Box3().setFromObject(craft);
      if (isFinite(bb.min.x) && bb.max.x > bb.min.x)
        hangar.placeMobile({ x0: bb.min.x, x1: bb.max.x,
                             z0: bb.min.z, z1: bb.max.z });
      // the kit moved, so its print on the floor moves with it
      if (hangar.bakeGroundShadow) hangar.bakeGroundShadow(renderer, hangarScene);
      // and the aeroplane's own print follows the aeroplane — every slider
      // comes back through here (apply -> enterGarage -> applyEnv), so this IS
      // the drag path, and it is four 256^2 draws
      if (hangar.bakeCraftShadow) hangar.bakeCraftShadow(renderer, hangarScene, craft);
    }
    // a pref saved against an older, shorter mood list is clamped here, once
    // the room is standing and can say how many skies it actually has
    if (hangar && hangar.moods) hangarMood = Math.min(hangarMood, hangar.moods.length - 1);
    renderer.toneMappingExposure = inRoom ? hangar.setMood(hangarMood).ex
                                          : WORLD_EXPOSURE;
    renderer.physicallyCorrectLights = inRoom ? true : WORLD_PHYSLIGHTS;
    syncEnvBtn();
  }
  function setMood(i) {
    // the room owns the list — it is a sky per row now (G62), and a build that
    // ships four of them and one that ships five must both clamp correctly
    const n = (hangar && hangar.moods) ? hangar.moods.length : MOOD_MAX;
    hangarMood = Math.max(0, Math.min(n - 1, i | 0));
    prefSet('flydiy.garageMood', hangarMood);
    if (inGarage) applyEnv();
    if (hangar && hangar.renderSky) hangar.renderSky(renderer);
    // A MOOD IS A NEW SKY, so the reflections belong to a different time of
    // day: re-bake. Deliberately NOT in applyEnv — that is on the editor's
    // slider drag path and a PMREM per frame would stall it.
    if (hangar) bakeHangarEnv();
  }
  // THE ENV HANDLE (G40, reworked G41): the editor panel's "hangar"
  // section drives the room through this — lighting mood, the material
  // library, per-part dress — instead of reaching into closures. The
  // whole part state persists as one JSON pref.
  const savePartsPref = () => {
    if (!hangar || !hangar.parts) return;
    const all = {};
    for (const p of hangar.parts) all[p.key] = hangar.partState(p.key);
    prefSet('flydiy.hangarParts', JSON.stringify(all));
  };
  window.GARAGE_ENV = {
    // dev-only: reach the room's internals from the console
    _debug: () => ({ hangar: hangar, renderer: renderer, scene: hangarScene,
                     world: scene }),
    // the baked floor shadow's strength; 0 turns it off
    groundShadow: v => {
      if (!getHangar() || !hangar.groundShadow) return null;
      const r = hangar.groundShadow(v);
      if (v !== undefined) prefSet('flydiy.groundShadow', String(v));
      return r;
    },
    // the shed's own size, in metres, and the envelope it may be dragged over
    dims: () => (getHangar() && hangar.dims) ? hangar.dims : null,
    dimLimits: () => DIM_LIMS,
    setDims: setDims,
    // the mobile kit: where it stands, and whether it stands at all
    mobile: () => (getHangar() && hangar.mobile) ? hangar.mobile() : [],
    mobileShown: () => mobileOn,
    setMobile: on => {
      mobileOn = on !== false;
      prefSet('flydiy.hangarMobile', mobileOn ? '1' : '0');
      if (getHangar() && hangar.mobileShow) hangar.mobileShow(mobileOn);
      return mobileOn;
    },
    envSources: () => (getHangar() && hangar.hasSky)
      ? [['room', 'the room itself'], ['sky', 'the sky (HDRI)']] : [],
    envSource: () => envSource,
    setEnvSource: setEnvSource,
    // THE LIGHT SWITCHES (G62.3): one per source, so a lighting test can ask
    // which of them is responsible for what it is looking at.
    lights: () => (getHangar() && hangar.lightSwitches) ? hangar.lightSwitches : [],
    // THE LAMP RIG (G64): power as a gain on whatever the mood asks for, the
    // spot half-angle, and the colour temperature the fittings burn at.
    lampRig: () => (getHangar() && hangar.lampRig) ? hangar.lampRig() : null,
    setLampRig: p => (getHangar() && hangar.setLampRig) ? hangar.setLampRig(p) : null,
    lightOn: k => (getHangar() && hangar.lightOn) ? hangar.lightOn(k) : true,
    // THE MASTER SWITCH (user: "we need to be able to add lights one by one
    // from nothingness (all look black)"). One re-bake, one known state — as
    // opposed to seven clicks, seven re-bakes and seven chances to leave a
    // source somewhere you did not mean.
    setLights: pick => {
      if (!getHangar() || !hangar.setLights) return null;
      const r = hangar.setLights(pick);
      if (inGarage) applyEnv();
      bakeHangarEnv();          // the probe is a photograph of the room: see setLight
      return r;
    },
    // the world's panel, offered through the same handle so one piece of UI
    // can drive either room. It is only live once the world has been built.
    worldLights: () => (WF && WF.lightSwitches) ? WF.lightSwitches : [],
    worldLightOn: k => (WF && WF.lightOn) ? WF.lightOn(k) : true,
    setWorldLight: (k, v) => (WF && WF.setLight) ? WF.setLight(k, v) : null,
    setWorldLights: pick => (WF && WF.setLights) ? WF.setLights(pick) : null,
    // THE GROUND BOUNCE, as a knob rather than a constant, because it is the
    // one number in this rig that is a judgement: how much of a lit floor an
    // aeroplane standing on it can actually see. Changing it re-bakes.
    groundBounce: () => window.LIGHT_RIG ? window.LIGHT_RIG.groundBounce() : 1,
    setGroundBounce: v => {
      if (!window.LIGHT_RIG) return null;
      const g = window.LIGHT_RIG.setGroundBounce(v);
      if (getHangar()) bakeHangarEnv();
      return g;
    },
    setLight: (k, on) => {
      if (!getHangar() || !hangar.setLight) return null;
      const r = hangar.setLight(k, on);
      // muting the environment changes what the probe would bake, and muting
      // a light changes what the floor shadow should look like
      if (inGarage) applyEnv();
      // AND THE PROBE HAS TO BE BAKED AGAIN, or the switch is a lie. The
      // environment is a photograph of the room taken under whatever lights
      // were on at the time; turning a lamp off afterwards leaves its light in
      // the picture, so the room keeps being lit by a lamp that is visibly
      // dark. It cost a false reading during this chantier's own ablation:
      // "lamps off" still measured the lamps, because the probe remembered
      // them. A switch is a user action, so the PMREM is affordable here —
      // unlike a slider drag, which is why applyEnv still does not do it.
      if (k !== 'env') bakeHangarEnv();
      return r;
    },
    // GPU grade vs precomputed pictures, live, on the same frame
    skyModes: () => (getHangar() && hangar.skyModes) ? hangar.skyModes() : [],
    skyMode: () => (getHangar() && hangar.skyMode) ? hangar.skyMode() : null,
    setSkyMode: m => {
      if (!getHangar() || !hangar.setSkyMode) return null;
      const r = hangar.setSkyMode(m);
      if (hangar.renderSky) hangar.renderSky(renderer);
      bakeHangarEnv();
      return r;
    },
    craftInProbe: () => craftInProbe,
    setCraftInProbe: on => {
      craftInProbe = !!on;
      prefSet('flydiy.craftInProbe', craftInProbe ? '1' : '0');
      if (getHangar()) bakeHangarEnv();
      return craftInProbe;
    },
    moods: () => (getHangar() ? hangar.moods : []),
    mood: () => hangarMood,
    setMood: i => setMood(i),
    library: () => (getHangar() && hangar.library) ? hangar.library : [],
    parts: () => (getHangar() && hangar.parts) ? hangar.parts : [],
    part: k => (getHangar() && hangar.partState) ? hangar.partState(k) : null,
    setPart: (k, st) => {
      if (!getHangar() || !hangar.setPart) return null;
      const r = hangar.setPart(k, st);
      savePartsPref();
      return r;
    },
  };
  // The two buttons are GARAGE-ONLY and hide themselves outside it: a room you
  // are not in is not a setting worth showing, and the rail is already full.
  // The mood button additionally hides when the room did not build: offering
  // "Golden hour" for an empty scene would be a lie.
  function syncEnvBtn() {
    const eb = $('bEnv'), mb = $('bMood');
    if (!eb || !mb) return;                       // core-only build
    const show = inGarage && curKey === 'gen';
    eb.style.display = show ? '' : 'none';
    // the editor door keeps the same company (G63): it is garage-only for
    // exactly the same reason the room buttons are
    const edb = $('bEdit');
    if (edb) edb.style.display = show ? '' : 'none';
    const h = show && garageIsHangar() && hangar;
    mb.style.display = h ? '' : 'none';
    // the label says WHERE YOU ARE, not what the click will do. A button that
    // names its own effect reads as a state and gets misread as one. There is
    // one room now, so the only other thing it can say is that there is none.
    eb.textContent = h ? 'Hangar' : 'No room';
    eb.classList.toggle('on', !!h);
    if (h) {
      const nm = hangar.moods[hangarMood] || '';
      mb.textContent = nm.charAt(0) + nm.slice(1).toLowerCase();
    }
  }

  // ================= aircraft (rebuilt on selection) =================
  let bGeo, bPos, bCol, lines, pGeo, pPos, pts, proxy;
  // G65: which aeroplane stands in the room — the cage build, or the generated
  // model. Declared up here with the meshes it switches, because applySkinVis
  // reads it and runs long before the garage does.
  let showCage = false;
  function buildShadowProxy() {
    // invisible skin stitched across wingtips/engines/tailplane so the
    // wireframe casts a real sun shadow. ENGL/ENGR exist only on the Cub and
    // DC-3; single-engine fiches fall back to their lone ENG node.
    if (proxy) { craft.remove(proxy.mesh); proxy.mesh.geometry.dispose(); proxy = null; }
    const idx = t => { const o = []; def.nodes.forEach((n, i) => { if (n.tag === t) o.push(i); }); return o; };
    const wf = idx('WF'), wr = idx('WR'), eng = idx('ENG');
    const engL = idx('ENGL')[0] ?? eng[0], engR = idx('ENGR')[0] ?? eng[0];
    const htl = idx('HTL')[0], htr = idx('HTR')[0];
    if (!wf.length || !wr.length || engL === undefined || htl === undefined || htr === undefined) return;
    const tip = (arr, sgn) => arr.reduce((best, i) =>
      sgn * def.nodes[i].p[2] > sgn * def.nodes[best].p[2] ? i : best, arr[0]);
    const ids = [tip(wf, -1), tip(wf, 1), tip(wr, 1), tip(wr, -1), engL, engR, htr, htl];
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(ids.length * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
    mesh.castShadow = true; mesh.frustumCulled = false;
    craft.add(mesh);
    proxy = { ids, pos, attr: geo.attributes.position, mesh };
  }

  // ================= 3d skin (baked OBJ, pa18 only for now) =================
  // Rigid mount in the body frame: model frame is (x aft, y up, z left), RH.
  // Offset calibrated so model main wheels sit on the sim's axle contact points.
  const MODELS3D = {};
  if (typeof MODEL_PA18 !== 'undefined') MODELS3D.pa18 = MODEL_PA18;
  if (typeof MODEL_C172 !== 'undefined') MODELS3D.c172 = MODEL_C172;
  // per-aircraft skin config: body-frame mount offset + binding thresholds (SKIN-PROC.md)
  // pa18 geometry is a byte-copy of the cub's, so the calibration is shared.
  // `rig` = groups that carry hinges and/or flex (default ['skin']); the c172's
  // steering nose gear spans four materials, so four extra groups are rigged.
  const SKIN_CFG = {
    pa18: { off: [1.690, -0.070, 0], tags: ['WF', 'WR'], zRoot: 1.30, xMax: 1.5 },
    c172: { off: [1.694, -1.420, 0], tags: ['WF', 'WR'], zRoot: 2.00, xMax: 1.5,
            rig: ['skin', 'metal', 'tyre', 'hub', 'gear'] },
    // The generated skin is built FROM the sim's own node positions, in the
    // sim's own body frame, so there is no mount to calibrate: the offset is
    // zero by construction, not by measurement (see 63_gen_skin.js).
    gen:  { off: [0, 0, 0] },
  };
  // W18 PBR fallback: roughness / metalness / envMapIntensity per PAYLOAD
  // MATERIAL NAME, used when the payload carries no PBR of its own (v3 and
  // earlier — the PA-18, whose OBJ+MTL source has no PBR to import).
  // A v4 payload's own `rough`/`metal` always win: those are the numbers the
  // model's author set, and a guess should never override a measurement.
  // Keyed off the names because they are already semantic (model_prep.py takes
  // them from the source MTL's usemtl groups, and tools/models/<key>.py names
  // them by what they are).
  // METALNESS IS NOT SHININESS: paint over aluminium is a dielectric, so the
  // fuselage stays at 0 no matter how glossy it looks. Only genuinely bare
  // metal — hubs, gear legs, fittings — goes high, or the paint turns grey and
  // takes its colour from the sky instead of the livery.
  const PBR = {
    _:         { r: 0.72, m: 0.0 },   // fallback: matte, no reflection to speak of
    skin:      { r: 0.42, m: 0.0 },   // doped fabric (cub) / painted alloy (c172)
    glass:     { r: 0.06, m: 0.0, e: 1.5 },   // glazing reflects harder than neutral
    frame:     { r: 0.45, m: 0.85 },  // GARAGE: bare welded tube, uncovered
    cowl:      { r: 0.30, m: 0.10 },  // painted metal panel, glossier than fabric
    engine:    { r: 0.55, m: 0.70 },  // cast alloy case, oily
    prop:      { r: 0.42, m: 0.20 },
    metal:     { r: 0.34, m: 0.85 },
    gearmetal: { r: 0.38, m: 0.80 },
    hub:       { r: 0.28, m: 0.90 },
    prophub:   { r: 0.30, m: 0.85 },
    blades:    { r: 0.40, m: 0.25 },  // painted, with polished tips: part way
    tyre:      { r: 0.96, m: 0.0 },
    covers:    { r: 0.90, m: 0.0 },
    seat:      { r: 0.85, m: 0.0 },
    cabin:     { r: 0.88, m: 0.0 },   // leather / fabric trim
    cabin2:    { r: 0.90, m: 0.0 },
    cockpit:   { r: 0.90, m: 0.0 },
    black:     { r: 0.85, m: 0.0 },
    panel:     { r: 0.62, m: 0.10 },  // instrument panel: satin, faintly metallic
    front:     { r: 0.55, m: 0.15 },
    pedal:     { r: 0.55, m: 0.35 },
    radio:     { r: 0.50, m: 0.20 },
    screen:    { r: 0.22, m: 0.0, e: 0.7 },
    // gauge faces sit behind glass; keep them near-matte or they flare
    dials:     { r: 0.60, m: 0.05 },
    gaugeA:    { r: 0.60, m: 0.05 }, gaugeB: { r: 0.60, m: 0.05 },
    gaugeC:    { r: 0.60, m: 0.05 },
    ai:        { r: 0.60, m: 0.05 }, asi: { r: 0.60, m: 0.05 },
    alt:       { r: 0.60, m: 0.05 }, turn: { r: 0.60, m: 0.05 },
    hdg:       { r: 0.60, m: 0.05 }, vsi: { r: 0.60, m: 0.05 },
  };
  const EMIS_GAIN = 0.45;         // see matFor: authored emissive is 1.0
  // envMapIntensity stays NEUTRAL at 1. Worth knowing: the scene also keeps a
  // HemisphereLight (the Lambert world needs one and cannot see an environment
  // map), so a PBR material does get sky ambient twice over. Measured, it does
  // not matter — a white rough probe lit by the env alone reads ~0.07 linear,
  // and the aircraft is verified good at full strength. If the shaded side ever
  // reads too blue, scaling dielectrics here is the knob; it was tried at 0.3
  // and reverted, because the problem it appeared to fix turned out to be a
  // texture-decode race in the measurement, not the lighting.
  const modelCache = {};
  // THE ONE DECODE (G89). The payload's base64 is DESTROYED on first decode
  // (see buildModel below — 6 MB of heap for the c172, correctly freed), so a
  // second, independent decodeModel() of the same payload returns nothing —
  // and whether it does depends on whether you have flown that aeroplane yet,
  // which is a bug that hides until someone plays in the other order. The
  // reference plane (refplane.js) wants the same geometry, so the rule
  // buildModel's own comment already states is made real here: EVERYTHING
  // THAT WANTS AN IMPORTED PAYLOAD'S GEOMETRY ASKS THIS, and it decodes at
  // most once per model for the life of the page.
  const decCache = {};
  window.MODEL_DECODE = key => {
    if (decCache[key]) return decCache[key];
    const d = MODELS3D[key];
    if (!d || !d.groups) return null;
    const out = decodeModel(d);
    for (const g in d.groups) d.groups[g].b64 = null;
    return (decCache[key] = out);
  };
  // and the payload itself, for the tables that ride with it (mats, texs, bb)
  window.MODEL_PAYLOAD = key => MODELS3D[key] || null;
  // skinMode: 0 = skin, flex x1 · 1 = skin, flex x4 (exaggerated) · 2 = frame,
  // flex x1 · 3 = OVERLAY, flex x1 (G51, user: "a view with the physical +
  // visual model enabled at the same time"): the skin poses as in mode 0 and
  // the strain-coloured line frame — the structure as the solver actually has
  // it — draws THROUGH it (depth test off), so you can see how the physics
  // lattice sits inside the aeroplane you built. The gain is x4 in mode 1 AND
  // NOWHERE ELSE — every other mode is the real deflection, and the button
  // says so.
  const SKIN_GAINS = [1, 4];
  const LINK_TAU = 0.15;   // s per pole, two poles; 0 -> raw ctl on the surfaces
  let model = null, skinMode = 0;
  // transparent-pass determinism (r128): gauge covers paint before cabin glass
  const RENDER_ORDER = { covers: 1, glass: 2 };
  let TYRE_TEX = null;            // the tyre sheet does not depend on the spec
  // curDef is only read on the GARAGE path: the generated payload is a function
  // of the very fiche the sim is running, so it must be that object and not a
  // second call to the builder.
  function buildModel(key, curDef) {
    // the generated model is never cached — the whole point is that a slider
    // rebuilds it. Everything else decodes once and is kept forever.
    if (key !== 'gen' && modelCache[key]) return modelCache[key];
    // THE CAGE VISUAL (G46, user: "that's still the old model flying").
    // When build & fly froze the editor's meshes (window.CAGE_VISUAL,
    // model frame, mount pre-calibrated wheels-to-axles), the gen
    // aircraft flies THAT — down the same path as the PA-18's imported
    // skin: rigid body-frame pose + makeSkinBinding wing flex.
    //
    // AND THERE IS NO LONGER ANYTHING ELSE FOR IT TO BE (G67.1). This used to
    // fall back to `genSkin(curDef)` when no snapshot existed — G46 declared
    // that ("absent a snapshot, the generated skin flies as before") and it is
    // what kept the old generated aeroplane flyable for a whole arc after the
    // cage had replaced it. The boot now commits the editor before the first
    // frame, so a snapshot always exists; if one does not, the honest answer
    // is NO MESH — the truss and the indicators, which is what the aeroplane
    // actually is at that moment — rather than a second, different aeroplane
    // that nobody built.
    const data = key === 'gen'
      ? ((window.CAGE_VISUAL && window.CAGE_VISUAL.cage)
          ? window.CAGE_VISUAL : null)
      : MODELS3D[key];
    if (!data) return null;
    // IMPORTED payloads go through window.MODEL_DECODE (G89), which owns the
    // one decode and the b64 drop; the cage and the generated skin are already
    // decoded groups and never had a b64 to lose.
    const dec = (data.cage || data.generated) ? data.groups
      : (window.MODEL_DECODE(key) || decodeModel(data));
    // the generated payload asks for a `paint` map; the viewer bakes it (canvas
    // is not available to core). Without garage.js it degrades to flat colour.
    if (data.generated) {
      if (typeof genPaintDataURI === 'function') {
        data.texs = { paint: genPaintDataURI(curDef.spec) };
        if (typeof genRegDataURI === 'function') data.texs.reg = genRegDataURI(curDef.spec);
        // the tyre sheet is spec-independent, so it is baked once and kept
        if (typeof genTyreDataURI === 'function')
          data.texs.tyre = TYRE_TEX || (TYRE_TEX = genTyreDataURI());
        // the cowl's is NOT: it carries the livery and the chosen intake
        if (typeof genCowlDataURI === 'function')
          data.texs.cowl = genCowlDataURI(curDef.spec);
        // THE TWO DATA SHEETS. Rib tapes, stitching and panel lines as a normal
        // map, and the same features as roughness/metalness — which is what
        // makes doped fabric read as fabric rather than as coloured plastic.
        // `linTex` in the payload names them so they are decoded LINEAR; putting
        // a data map through the sRGB curve bends every value in it.
        if (typeof genBumpDataURI === 'function')
          data.texs.bump = genBumpDataURI(curDef.spec);
        if (typeof genMrDataURI === 'function')
          data.texs.mr = genMrDataURI(curDef.spec);
        // the projected glazing cut-out, and the cabin interior sheet
        if (typeof genGlazeDataURI === 'function')
          data.texs.glaze = genGlazeDataURI(curDef.spec);
        if (typeof genCabinDataURI === 'function')
          data.texs.cabin = genCabinDataURI(curDef.spec);
      }
      // no garage.js: every baked sheet falls back to a flat colour
      else {
        data.mats.skin = { color: curDef.spec.paint.base };
        data.mats.tyre = { color: 0x24262b, rough: 0.95, metal: 0 };
        data.mats.cowl = { color: curDef.spec.paint.base, rough: 0.35 };
      }
    }
    // v3 payloads carry texs/mats tables + per-group mat; v2 shim implies them
    const texSrcs = data.texs || (data.tex ? { skin: data.tex } : {});
    const mats = data.mats || { skin: { tex: 'skin' }, glass: { opacity: 0.28, color: 0xaad4ea } };
    // generated groups are already named by material; imported ones carry a
    // mat field; the cage visual's groups ARE their material keys
    const grpMat = data.cage ? (name => name)
      : data.generated
      ? (name => (mats[name] ? name : 'skin'))
      : (name => (data.texs && data.groups[name].mat) ||
                 (name === 'glass' ? 'glass' : 'skin'));
    // Texture decode is ASYNC, and a PBR material whose base map has not landed
    // yet is a white dielectric under a reflection probe — i.e. a mirror. The
    // c172 carries 13 maps and takes a beat, so switching to it flashed a
    // chrome aeroplane. (Under Lambert the same gap just showed white, which is
    // why it never mattered before.) Count the loads and let applySkinVis hold
    // the wireframe until they are all in; onError counts too, so a missing
    // texture degrades to "shown, untextured" rather than "invisible forever".
    const texs = {};
    const entry = { pending: 0, ready: false };
    const landed = () => {
      if (--entry.pending > 0) return;
      entry.ready = true;
      applySkinVis();
    };
    for (const t in texSrcs) {
      entry.pending++;
      texs[t] = new THREE.TextureLoader().load(texSrcs[t], landed, undefined, landed);
      texs[t].anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 4;
      // The generated paint is authored in sRGB (canvas colours are), so it has
      // to be declared as such or the renderer treats it as linear and encodes
      // it a second time on output — every colour comes out washed pale. The
      // imported payloads are deliberately left alone: their look is calibrated
      // as-is and changing the decode would move it.
      //
      // EXCEPT the DATA maps. A normal map and a metal/rough map are not
      // pictures — their channels are numbers, and putting them through the sRGB
      // curve bends every one of them. The payload says which of its own sheets
      // are data (`linTex`), because the generator is what knows.
      if (data.generated && !(data.linTex || []).includes(t))
        texs[t].encoding = THREE.sRGBEncoding;
    }
    if (!entry.pending) entry.ready = true;
    const mkGeo = (g, ownPos) => {
      const geo = new THREE.BufferGeometry();
      // `ownPos` hands the geometry ITS OWN copy of the positions. The
      // default wraps the payload's array — which is what every rigged
      // group wants (poseSkinGen writes through it) — but anything the
      // build MUTATES (geo.translate on the prop) must not write into a
      // payload that could be built twice: the second translate doubles
      // the offset and the prop lands +hub AFT, i.e. mid-fuselage
      // (user: "the prop sometimes ends up in the middle"). G58.5.
      geo.setAttribute('position',
        new THREE.BufferAttribute(ownPos ? g.pos.slice() : g.pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
      // THE SURFACE FIELD (G66): [sL, sC, st, lv] — metres along the body,
      // metres around the section, station, rail. The cage has no UV
      // unwrap, and this is what stands in its place: one metric coordinate
      // so a tiled material is the same real size everywhere, plus the
      // station/rail pair the fasteners and seams are drawn from. Groups
      // without it (the rim beads, the interior liners, everything the
      // post-passes add) take the shader's triplanar branch instead.
      if (g.srf) geo.setAttribute('aStruct',
        new THREE.BufferAttribute(g.srf, 4));
      geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
      // the cage snapshot CARRIES its normals (G47): recomputing them
      // across the merged unwelded meshes flat-shaded the cowl
      if (g.nrm) geo.setAttribute('normal', new THREE.BufferAttribute(g.nrm, 3));
      else geo.computeVertexNormals();
      return geo;
    };
    const matCache = {};
    const matFor = name => {
      const mn = grpMat(name);
      if (matCache[mn]) return matCache[mn];
      const m = mats[mn], op = m.opacity !== undefined ? m.opacity : 1;
      // AEROSKIN (G67). A cage payload's material record says which FINISH it
      // is and which shader branch it takes, so the flown aeroplane is built
      // from the same factory the editor used — not re-approximated from a
      // colour. That is the whole answer to "the shaders used for the planes
      // should be as consistent as possible": there is one factory, and both
      // worlds call it.
      //
      // The payload's positions are already in metres (the snapshot bakes
      // them through the mount's world matrix, scale included) and so is its
      // surface field, so uFieldM is 1 here where the bench passes its own
      // CAGE_UNIT x planeScale.
      if (data.cage && typeof AEROSKIN !== 'undefined' && m.fin) {
        const A = AEROSKIN;
        return matCache[mn] = (m.fin === 'glass')
          ? A.aeroGlass(THREE, { tintLin: m.color, opacity: op, fieldM: 1 })
          : A.aeroMaterial(THREE, { finish: m.fin, tintLin: m.color,
              grm: m.grm || '', struct: m.grm ? 1 : 0,
              opacity: op, fieldM: 1, surf: m.surf ? 1 : 0,
              side: THREE.DoubleSide });
      }
      const s = PBR[mn] || PBR._;
      // W18: MeshStandard, not Lambert — which is what makes the aircraft see
      // scene.environment at all (r128 routes it to Standard materials only).
      // Transparency semantics are deliberately UNCHANGED: op < 1 is still the
      // only thing that turns a group transparent, so the gauge textures that
      // carry real cutout alpha keep behaving exactly as they did.
      const metal = m.metal !== undefined ? m.metal : s.m;
      // alphaTest, not blending: a decal is a cut-out, and cut-outs belong in
      // the OPAQUE pass where they write depth and never have to be sorted.
      // Transparency used to be inferred from `opacity` alone, so a material
      // whose texture carried the alpha (the registration sheet) rendered fully
      // opaque and its clear pixels came out BLACK.
      const common = { side: THREE.DoubleSide, transparent: op < 1, opacity: op,
        depthWrite: op >= 1,
        ...(m.alphaTest ? { alphaTest: m.alphaTest } : {}),
        roughness: m.rough !== undefined ? m.rough : s.r,
        metalness: metal,
        envMapIntensity: s.e !== undefined ? s.e : 1 };
      // v4 data maps, straight off the source glTF. metalRough is ONE texture
      // in glTF (G = roughness, B = metalness) and three reads exactly those
      // channels, so the same texture goes in both slots — that is correct,
      // not a copy-paste slip. Normal mapping needs no tangent attribute:
      // three derives the basis from screen-space derivatives.
      if (m.mr) { common.roughnessMap = texs[m.mr]; common.metalnessMap = texs[m.mr]; }
      if (m.nrm) {
        common.normalMap = texs[m.nrm];
        if (m.nrmScale) common.normalScale = new THREE.Vector2(m.nrmScale, m.nrmScale);
      }
      // Emissive instrument faces. The source sets emissiveTexture = the base
      // map at factor 1, i.e. dials that read in shadow; at full strength under
      // a sunset they read as lamps instead, so the authored factor is scaled
      // by EMIS_GAIN. That is the one art call in the import — everything else
      // is carried through as authored.
      if (m.emis && m.tex) {
        common.emissive = new THREE.Color(m.emis[0], m.emis[1], m.emis[2]);
        common.emissiveMap = texs[m.tex];
        common.emissiveIntensity = EMIS_GAIN;
      }
      // A NAMED SHEET THAT IS NOT THERE IS NOT A WHITE ONE. `map: undefined` with
      // the default tint renders the group flat WHITE, which is the worst of the
      // available wrong answers — it reads as a modelling error rather than as a
      // missing texture. That happens whenever the bakes are unavailable (no
      // garage.js: the smoke gate stubs the whole viewer block) or a payload
      // names a sheet the viewer did not bake. Fall back to the material's own
      // colour, and only tint white when there really is a map to tint.
      const tex = m.tex ? texs[m.tex] : null;
      return matCache[mn] = new THREE.MeshStandardMaterial(tex
        ? Object.assign({ map: tex,
            color: m.color !== undefined ? m.color : 0xffffff }, common)
        // flat-colour groups: opaque unless the payload asks for opacity < 1
        // (the c172 interior is all flat colour and must write depth)
        : Object.assign({ color: m.color !== undefined ? m.color : 0xaad4ea }, common));
    };
    const grp = new THREE.Group();
    grp.matrixAutoUpdate = false;
    const meshes = {}, props = [];
    for (const name in dec) {
      const isProp0 = name === 'prop' || name === 'proptip' || name === 'spinner';
      const geo = mkGeo(dec[name], isProp0);   // prop groups get their own copy
      // WHAT TURNS WITH THE PROPELLER, named rather than prefix-matched. This
      // used to be `name.startsWith('prop')`, which read as "every group named
      // prop*" and was wrong twice over: it caught `proptip` by luck, it missed
      // `spinner` entirely — a nose cone standing still in front of spinning
      // blades — and it would have quietly swept up any future group whose name
      // happened to begin with those four letters.
      const isProp = name === 'prop' || name === 'proptip' || name === 'spinner';
      if (isProp) geo.translate(-data.hub[0], -data.hub[1], -data.hub[2]);
      const mesh = new THREE.Mesh(geo, matFor(name));
      mesh.renderOrder = RENDER_ORDER[name] || 0;
      if (isProp) { mesh.position.set(data.hub[0], data.hub[1], data.hub[2]); props.push(mesh); }
      if (name === 'skin' || isProp ||
          (data.cage && !(mats[name] && mats[name].opacity < 1)))
        mesh.castShadow = true;             // the skin replaces the proxy's sun shadow
      meshes[name] = mesh;
      grp.add(mesh);
    }
    // G55 MOVING PARTS (cage visual): each wheel is its own group pivoted
    // at its AXLE and ridden on its axle NODE at pose time — suspension
    // travel is the physics showing through, not an animation. The prop
    // parts join `props` and spin with the existing throttle law.
    const wheelParts = [], stretchRigs = [], surfParts = [];
    let castorRig = null;
    if (data.cage && Array.isArray(data.parts)) {
      const twi = Array.isArray(curDef.refs.tw) ? curDef.refs.tw[0]
                : curDef.refs.tw;
      // BY SIGN, NOT BY TAG (G58.3): NM tags 'AXLEL' at z NEGATIVE, while
      // the snapshot's 'mainsL' is the wheel built at model z POSITIVE —
      // matching by name transplanted each wheel to the opposite side and
      // its outboard face pointed inboard (user: "mirrored wrong").
      const m0 = curDef.refs.mains && curDef.refs.mains[0],
            m1 = curDef.refs.mains && curDef.refs.mains[1];
      const zPos = m0 != null && curDef.nodes[m0].p[2] > 0;
      const nodeOf = { mainsL: zPos ? m0 : m1, mainsR: zPos ? m1 : m0,
                       tw: twi };
      let twWheel = null;
      const legNode = { legL: nodeOf.mainsL, legR: nodeOf.mainsR,
                        legT: nodeOf.tw };
      for (const pt of data.parts) {
        const pg = new THREE.Group();
        for (const name in pt.groups) {
          const mesh = new THREE.Mesh(mkGeo(pt.groups[name]), matFor(name));
          mesh.castShadow = !(mats[name] && mats[name].opacity < 1);
          pg.add(mesh);
        }
        if (pt.kind === 'prop') {
          // THE WANDERING PROPELLER (G58.6, user: "the prop sometimes
          // ends up in the middle"). The snapshot rebases every part's
          // vertices about its pivot so it can SPIN about the hub — so
          // the group MUST be put back at that pivot, exactly as the
          // wheels and the castor are. This line was missing, and the
          // prop therefore drew at the group origin: displaced by
          // −pivot, i.e. ~3.4 m AFT of the nose = the middle of the
          // fuselage. It only ever showed on a cage build (the
          // generated skin has its own correct prop path), which is
          // why it read as intermittent.
          if (pg.position && pg.position.set)
            pg.position.set(pt.pivot[0], pt.pivot[1], pt.pivot[2]);
          // G59.1: spin about the ENGINE'S OWN SHAFT, carried by the
          // snapshot — not the model x axis, which cones a disc that the
          // pitch calibration and the mount offsets have tilted
          if (pt.axis) pg.userData.spinAxis = pt.axis;
          grp.add(pg); props.push(pg);
        }
        else if (pt.stretch && legNode[pt.kind] != null) {
          // G58.3: a LEG deforms toward its axle — verts stay unrebased,
          // each weighted by nearness to the axle, so the attachment end
          // holds the airframe while the axle end rides the node: the
          // suspension visually compresses and stays lined up.
          grp.add(pg);
          pg.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            const pa = o.geometry.attributes.position;
            if (!pa || !pa.array) return;
            // ALIASING (G58.4): mkGeo wraps the snapshot's OWN array, and
            // the stretch pose mutates it in place — a garage transfer
            // rebuilds the model and would otherwise take LAST FRAME'S
            // deformed positions as the new rest. Pin a pristine copy on
            // the part data the first time, restore it on every rebuild.
            const src = pt.groups[Object.keys(pt.groups)
              .find(k => pt.groups[k].pos === pa.array)] || null;
            if (src) {
              if (!src.base0) src.base0 = pa.array.slice();
              else pa.array.set(src.base0);
            }
            const base = pa.array.slice();
            const W = new Float32Array(pa.count);
            // G58.7 TWO ANCHORS. The weight is the vertex's PROJECTION
            // along root → moving end: 0 at the airframe bolt (pinned,
            // "both the start and end anchor points remain in original
            // position") and 1 at the axle/swivel end, so the spring
            // elongates and shrinks between two fixed attachments. The
            // first cut weighted by distance-from-axle over the unit's
            // own extent, which let the fuselage end drift.
            if (pt.root) {
              const ax0 = pt.root, ax1 = pt.pivot;
              const ex = ax1[0] - ax0[0], ey = ax1[1] - ax0[1],
                    ez = ax1[2] - ax0[2];
              const L2 = Math.max(1e-6, ex * ex + ey * ey + ez * ez);
              for (let i = 0; i < pa.count; i++) {
                const t = ((base[i * 3] - ax0[0]) * ex +
                           (base[i * 3 + 1] - ax0[1]) * ey +
                           (base[i * 3 + 2] - ax0[2]) * ez) / L2;
                W[i] = Math.max(0, Math.min(1, t));
              }
            } else {
              let dmax = 1e-6;
              const ds = new Float32Array(pa.count);
              for (let i = 0; i < pa.count; i++) {
                const d = Math.hypot(base[i * 3] - pt.pivot[0],
                                     base[i * 3 + 1] - pt.pivot[1],
                                     base[i * 3 + 2] - pt.pivot[2]);
                ds[i] = d; if (d > dmax) dmax = d;
              }
              for (let i = 0; i < pa.count; i++)
                W[i] = Math.pow(Math.max(0, 1 - ds[i] / dmax), 1.2);
            }
            stretchRigs.push({ posAttr: pa, base, w: W,
                               idx: legNode[pt.kind], rest0: null });
          });
        }
        else if (pt.surf) {
          // G59.3 (user: "the control surfaces are not deformed the same
          // way as the wing... They should be anchored on the wing they
          // belong, and associated with the same nodes and beams as the
          // rest"). A rigid group that only rotates cannot ride the spar
          // flex, so a bending wing left its aileron straight. Same shape
          // as the generated skin: HINGE IN THE VERTICES first, then let
          // the SAME spar binding the wing skin uses add its deformation
          // on top (applySkinDeform's `hinged` path is additive, and the
          // codec says so: "runs BEFORE the flex pass").
          if (pg.position && pg.position.set)
            pg.position.set(pt.pivot[0], pt.pivot[1], pt.pivot[2]);
          grp.add(pg);
          pg.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            const pa = o.geometry.attributes.position;
            if (!pa || !pa.array) return;
            const base = pa.array.slice();
            // the binding is built on DESIGN positions (the group's own
            // translation added back), because that is the frame the
            // spar stations live in
            const dsg = new Float32Array(base.length);
            for (let i = 0; i < base.length; i += 3) {
              dsg[i] = base[i] + pt.pivot[0];
              dsg[i + 1] = base[i + 1] + pt.pivot[1];
              dsg[i + 2] = base[i + 2] + pt.pivot[2];
            }
            const nv2 = base.length / 3;
            // the binding itself is built in a SECOND PASS below: `def`
            // and `cfg` are declared after this block, and reaching them
            // from here is a temporal dead zone, not a value
            surfParts.push({ posAttr: pa, base, dsg, nv2, bind: null,
              hinged: new Uint8Array(nv2).fill(1),
              axis: pt.axis || [0, 0, 1],
              drive: pt.drive, sgn: pt.sgn || 1 });
          });
        }
        else if (pt.kind === 'castorT') {
          if (pg.position && pg.position.set)
            pg.position.set(pt.pivot[0], pt.pivot[1], pt.pivot[2]);
          grp.add(pg);
          castorRig = { obj: pg, idx: nodeOf.tw, pivot: pt.pivot,
                        axle: pt.axle, axis: pt.axis, rest0: null };
        }
        else if (nodeOf[pt.kind] != null) {
          if (pg.position && pg.position.set)
            pg.position.set(pt.pivot[0], pt.pivot[1], pt.pivot[2]);
          grp.add(pg);
          const w = { obj: pg, idx: nodeOf[pt.kind], R: pt.R, prev: null };
          wheelParts.push(w);
          if (pt.kind === 'tw') twWheel = w;
        }
      }
      // the tailwheel WHEEL lives INSIDE the castor: yaw carries it, and
      // its own spin stays about its axle in the castor's frame
      if (castorRig && twWheel && castorRig.obj.add && castorRig.axle) {
        castorRig.obj.add(twWheel.obj);
        if (twWheel.obj.position && twWheel.obj.position.set)
          twWheel.obj.position.set(
            castorRig.axle[0] - castorRig.pivot[0],
            castorRig.axle[1] - castorRig.pivot[1],
            castorRig.axle[2] - castorRig.pivot[2]);
        twWheel.child = true;              // the castor drives its position
      }
    }
    // G58.5 TRIPWIRE: the propeller belongs AHEAD of the nose. If it ever
    // lands aft of the skin's forward extreme, say so loudly with what a
    // repro needs, rather than silently drawing a blade through the cabin.
    if (props.length) {
      try {
        // the nose = the forward extreme of the AIRFRAME's own groups
        // (dec.skin exists only on the generated payload; a cage build's
        // groups are colour keys — which is why the first cut of this
        // check was dead exactly where the bug lived)
        let noseX = 1e9;
        for (const n in dec) {
          const sp = dec[n].pos;
          for (let i = 0; i < sp.length; i += 3) if (sp[i] < noseX) noseX = sp[i];
        }
        const pm = props[0];
        const pa2 = pm.geometry.attributes.position.array;
        let cx = 0;
        for (let i = 0; i < pa2.length; i += 3) cx += pa2[i];
        cx = cx / (pa2.length / 3) + (pm.position ? pm.position.x : 0);
        // half a metre of slack: a spinner tip is legitimately ahead of
        // the blades' own centre (the PA-18 reads 0.13 m and is correct)
        if (cx > noseX + 0.50)
          console.warn('FLYDIY: propeller at x', cx.toFixed(2),
            'is AFT of the nose', noseX.toFixed(2),
            '— key', key, 'cage', !!data.cage,
            '. Please report this line with your build export.');
      } catch (e) {}
    }
    grp.frustumCulled = false;
    grp.traverse(o => { o.frustumCulled = false; });
    // GARAGE: every group is rigged, because every vertex already carries its
    // node weights — there is no band to select and no threshold to tune.
    if (data.generated) {
      // Neither the PROP nor a CONTROL SURFACE is a flex body. Both are rigid
      // meshes with a pivot: deforming their vertices applies a correction in a
      // frame that is itself turning, which is what made the blades wobble and
      // what used to let an aileron drag the wing tip around with it.
      const mv = new Set((data.moving || []).map(m => m.group));
      const rigs = Object.keys(dec).filter(n => n.lastIndexOf('prop', 0) !== 0 && !mv.has(n)).map(name => {
        const posAttr = meshes[name].geometry.attributes.position;
        const g = dec[name];
        let anySid = false;
        for (let i = 0; i < g.nv; i++) if (g.sid[i]) { anySid = true; break; }
        return { g, posAttr, base: posAttr.array.slice(), meshName: name,
                 hb: anySid ? makeHingeBinding(g, data.surfaces) : null };
      });
      // EACH CONTROL SURFACE TURNS ABOUT ITS OWN HINGE, IN ITS VERTICES.
      //
      // It used to be a rigid child: geometry translated so the pivot was the
      // mesh origin, a quaternion for the deflection, and the pivot moved by the
      // weighted average of the surface's influence nodes. That rode the
      // structure but could not TWIST with it — one averaged translation carries
      // no rotation — so under rudder the tail wound up and the rudder hanging
      // off it stayed straight.
      //
      // The warning that put it there is real and still respected: deforming the
      // vertices of a mesh that ALSO carries a quaternion applies a body-frame
      // correction inside a frame that is itself turning, which is what made the
      // blades wobble and let an aileron drag the wing tip around. The way out
      // is not to add a deform on top of the rotation, it is to stop having a
      // rotating frame at all — geometry stays in the body frame, the mesh keeps
      // identity transform, and the hinge is applied per vertex about the pivot.
      // The structural displacement is then added in the same frame it was
      // measured in, which is exactly what the fixed skin already does.
      //
      // Cheap, because these are small: 24 vertices on the rudder, 32 on the
      // elevator, 50 on an aileron.
      const moving = (data.moving || []).filter(c => meshes[c.group]).map(c => {
        const posAttr = meshes[c.group].geometry.attributes.position;
        return { mesh: meshes[c.group], c, g: dec[c.group], posAttr,
                 base: posAttr.array.slice(),
                 // every vertex of the group belongs to the one surface, so the
                 // whole group is hinged — that is what tells poseSkinGen to ADD
                 // its displacement to the deflected position rather than
                 // overwrite it from rest
                 hinged: new Uint8Array(dec[c.group].nv).fill(1) };
      });
      const m = Object.assign(entry, { grp, props, rigs, gen: true, moving,
        meshes, dec, mats, rest: data.rest,
        // which groups are covering, straight from the generator — see
        // applySkinVis
        cover: data.cover || null,
        nodeBody: new Float32Array(curDef.nodes.length * 3),
        surfaces: data.surfaces, link: makeLinkage(LINK_TAU) });
      if (texs.paint) m.texImg = texs.paint.image;
      return m;
    }
    // Rigged groups: wing-band vertices follow the sim spar stations, and
    // sid-tagged vertices turn about their hinge lines. `skin` alone for the
    // pa18; the c172 also rigs the groups its nose gear is split across.
    // THE CAGE VISUAL (G46) rigs every group against the LIVE def (the
    // spec-built lattice buildModel was handed — never a second build),
    // with the mount the snapshot calibrated wheels-to-axles.
    const def = data.cage ? curDef : AIRCRAFT[key]();
    // G58.1: the cage visual's wing band is a CLOSED BOX, not a half-space.
    // The measured spec knows the wing exactly — xLE, chord, sweep, the root
    // spar's height — so the binding takes only verts inside it (small
    // margins absorb the G54.2 pitch rotation of the captured frame). The
    // old open selector also caught the cabin sidewall (it sits exactly at
    // |z| = zRoot), the strut roots and the gear leg, and pulled them aft
    // with the lifting wing.
    const cageCfg = () => {
      const W2 = curDef.spec && curDef.spec.wing;
      const zR = ((curDef.parts && curDef.parts.zRoot) || 0.5) + 0.06;
      const offC = [(data.off && data.off[0]) || 0,
                    (data.off && data.off[1]) || 0, 0];
      if (!W2 || W2.xLE == null)
        return { off: offC, tags: ['WF', 'WR'], zRoot: zR, xMax: 1.5 };
      // the binding tests SNAPSHOT-LOCAL coordinates — design minus
      // (cg0 + off) on x and y (which is why the old `x ≤ 1.5` was, in
      // design terms, "everything but the extreme tail"). The box is
      // authored in design coords and shifted here; margins absorb the
      // G54.2 pitch rotation.
      const cg0b = defCG(curDef);
      const dx0 = cg0b[0] + offC[0], dy0 = cg0b[1] + offC[1];
      const sw = Math.tan((W2.sweep || 0) * Math.PI / 180) * W2.span * 0.5;
      let yMin;
      try {
        const F = curDef.parts.wf.R.F;
        yMin = Math.min(curDef.nodes[F[0]].p[1],
                        curDef.nodes[F[F.length - 1]].p[1]) - 0.30 - dy0;
      } catch (e) { yMin = undefined; }
      return { off: offC, tags: ['WF', 'WR'], zRoot: zR,
               xMin: W2.xLE - 0.15 + Math.min(0, sw) - dx0,
               xMax: W2.xLE + W2.chord + 0.25 + Math.max(0, sw) - dx0,
               yMin };
    };
    const cfg = data.cage ? cageCfg() : SKIN_CFG[key];
    // G59.3 second pass: bind each control surface to the SAME spar
    // stations the wing skin uses, so it flexes with the wing it is
    // bolted to instead of only deflecting on its hinge.
    for (const s2 of surfParts) {
      try { s2.bind = makeSkinBinding(s2.dsg, s2.nv2, def, cfg); }
      catch (e) { s2.bind = null; }
      s2.dsg = null;
    }
    const rigNames = data.cage ? Object.keys(dec) : (SKIN_CFG[key].rig || ['skin']);
    const rigs = rigNames.filter(n => dec[n]).map(name => {
      const posAttr = meshes[name].geometry.attributes.position;
      return {
        posAttr, base: posAttr.array.slice(),
        bind: makeSkinBinding(posAttr.array, dec[name].nv, def, cfg),
        // control surface hinges (payload v2: per-vertex surface ids + hinge table)
        hb: (data.v >= 2 && dec[name].sid) ? makeHingeBinding(dec[name], data.surfaces) : null,
      };
    });
    // station structure is a property of the fiche, so one delta buffer serves all
    const nz = rigs[0].bind.zs.length;
    const deltas = { P: new Float32Array(nz * 3), N: new Float32Array(nz * 3) };
    const m = Object.assign(entry, { grp, props, rigs, deltas,
                        off: cfg.off,
                        wheelParts: wheelParts.length ? wheelParts : null,
                        stretchRigs: stretchRigs.length ? stretchRigs : null,
                        surfParts: surfParts.length ? surfParts : null,
                        castorRig,
                        surfaces: data.surfaces,
                        link: makeLinkage(LINK_TAU) });  // visual linkage lag (SKIN-PROC)
    if (key !== 'gen') modelCache[key] = m;   // gen is never cached
    return m;
  }
  const mBasis = new THREE.Matrix4(), vX = new THREE.Vector3(),
        vY = new THREE.Vector3(), vZ = new THREE.Vector3(),
        vSpin = new THREE.Vector3();          // G59.1 prop shaft axis
  function poseModel() {
    // a generated model keeps posing in Frame mode: mode 2 hides the covering
    // and shows the tube truss, which is still the same rigged mesh
    if (!model || (skinMode === 2 && !model.gen)) return;
    const [xA, yU] = sim.axes(), cg = sim.cgPos(),
          O = model.off || SKIN_CFG[curKey].off;
    vX.set(xA[0], xA[1], xA[2]); vY.set(yU[0], yU[1], yU[2]);
    vZ.crossVectors(vX, vY);                     // z left: keeps the basis proper (no mirror)
    mBasis.makeBasis(vX, vY, vZ);
    mBasis.setPosition(
      cg[0] + O[0]*xA[0] + O[1]*yU[0],
      cg[1] + O[0]*xA[1] + O[1]*yU[1],
      cg[2] + O[0]*xA[2] + O[1]*yU[2]);
    model.grp.matrix.copy(mBasis);
    if (running)                                 // a paused world holds its prop
      for (const p of model.props) {
        const d = (8 + 110 * sim.ctl.thr) * (1/60);                // visual only
        const ax2 = p.userData && p.userData.spinAxis;
        if (ax2 && p.quaternion && p.quaternion.setFromAxisAngle) {
          // G59.1: about the shaft, so the disc stays in its own plane
          p.userData.spinAng = (p.userData.spinAng || 0) + d;
          vSpin.set(ax2[0], ax2[1], ax2[2]);
          p.quaternion.setFromAxisAngle(vSpin, p.userData.spinAng);
        } else p.rotation.x += d;
      }
    const link = model.link.step(sim.ctl, 1/60);   // once per frame: it is stateful
    if (model.gen) {
      // ONLY mode 1 exaggerates. This used to read SKIN_GAINS[min(skinMode,1)],
      // which handed mode 2 a gain of 4 as well — so the GARAGE's Bare frame,
      // the one view whose whole job is to show you the structure you welded,
      // was drawing the truss at FOUR TIMES its real deflection, with no x1
      // reference on screen to compare it against (showSkin is true for gen in
      // every mode, so the line wireframe is hidden). The fleet's Frame mode
      // returns early above and was always honest; the two disagreed silently.
      // User report: "the x4 deformation is confusing, it's unclear what's
      // applied in the view structure". It was applied. See GATE FLEX.
      const gain = skinMode === 1 ? SKIN_GAINS[1] : SKIN_GAINS[0];
      genNodeBody(sim, model.nodeBody);
      // CONTROL SURFACES: one quaternion each. They also ride the deflection of
      // the spar they hang on, so a bending wing does not leave its aileron
      // behind — a rigid transform driven by node motion, not a vertex deform.
      // CONTROL SURFACES: hinge first, in the body frame, then let the same
      // node-weight deform the fixed skin gets carry the result. Two passes over
      // a few dozen vertices, and the surface now twists with whatever it is
      // bolted to instead of only sliding with it.
      for (const mv of model.moving || []) {
        const c = mv.c;
        const ang = c.sgn * (c.k || 1) * (link[c.drive] || 0)
          + (c.drive2 ? (c.sgn2 || 1) * (c.k2 || 1) * (link[c.drive2] || 0) : 0);
        const base = mv.base, pos = mv.posAttr.array, nv = mv.g.nv;
        const px = c.p[0], py = c.p[1], pz = c.p[2];
        const ax = c.ax[0], ay = c.ax[1], az = c.ax[2];
        // Rodrigues about the hinge, which is a unit axis through the pivot
        const ca = Math.cos(ang), sa = Math.sin(ang), C1 = 1 - ca;
        for (let v = 0; v < nv; v++) {
          const o = v * 3;
          const x = base[o] - px, y = base[o+1] - py, z = base[o+2] - pz;
          const d = ax * x + ay * y + az * z;
          pos[o]   = px + x * ca + (ay * z - az * y) * sa + ax * d * C1;
          pos[o+1] = py + y * ca + (az * x - ax * z) * sa + ay * d * C1;
          pos[o+2] = pz + z * ca + (ax * y - ay * x) * sa + az * d * C1;
        }
        poseSkinGen(mv.g, model.rest, model.nodeBody, base, pos, gain, mv.hinged);
        mv.posAttr.needsUpdate = true;
      }
      for (const r of model.rigs) {
        if (r.hb) applyHinges(r.hb, model.surfaces, r.base, r.posAttr.array, link);
        poseSkinGen(r.g, model.rest, model.nodeBody, r.base, r.posAttr.array,
                    gain, r.hb && r.hb.hinged);
        r.posAttr.needsUpdate = true;
      }
      return;
    }
    sparDeltas(model.rigs[0].bind, sim, model.deltas);
    for (const r of model.rigs) {
      if (r.hb) applyHinges(r.hb, model.surfaces, r.base, r.posAttr.array, link);
      applySkinDeform(r.bind, r.base, r.posAttr.array,
                      model.deltas.P, model.deltas.N,
                      skinMode === 1 ? SKIN_GAINS[1] : SKIN_GAINS[0],
                      r.hb && r.hb.hinged);
      r.posAttr.needsUpdate = true;   // normals kept from rest pose: flex < ~5 deg
    }
    // G55: each wheel rides its AXLE NODE — its position is the node's
    // live coordinates in the SAME basis the pose maps the group into
    // (minus the pose's own x/y offset), so suspension travel is exact by
    // construction: the leg compresses in the sim, the wheel follows.
    // Spin is rolling contact from the node's own motion along body-x
    // (which points AFT, hence the sign).
    const nodeLocal = idx => {
      const i3 = idx * 3;
      const dx = sim.p[i3] - cg[0], dy = sim.p[i3 + 1] - cg[1],
            dz = sim.p[i3 + 2] - cg[2];
      return [dx * xA[0] + dy * xA[1] + dz * xA[2] - O[0],
              dx * yU[0] + dy * yU[1] + dz * yU[2] - O[1],
              dx * vZ.x + dy * vZ.y + dz * vZ.z];
    };
    if (model.wheelParts) for (const w of model.wheelParts) {
      if (!w.obj.position || !w.obj.position.set) continue;    // smoke stub
      const i3 = w.idx * 3;
      if (!w.child) {                       // the castor drives its child
        const L = nodeLocal(w.idx);
        w.obj.position.set(L[0], L[1], L[2]);
      }
      if (w.prev && w.obj.rotation) {
        const mx = (sim.p[i3] - w.prev[0]) * xA[0] +
                   (sim.p[i3 + 1] - w.prev[1]) * xA[1] +
                   (sim.p[i3 + 2] - w.prev[2]) * xA[2];
        w.obj.rotation.z -= mx / Math.max(0.05, w.R);
      }
      w.prev = [sim.p[i3], sim.p[i3 + 1], sim.p[i3 + 2]];
    }
    // G58.3: the LEGS stretch toward their axle — each vertex moves by its
    // nearness-weight times the node's travel since rest, so the airframe
    // end holds and the axle end follows: the suspension compresses.
    if (model.stretchRigs) for (const s of model.stretchRigs) {
      if (!s.posAttr || !s.posAttr.array) continue;
      const L = nodeLocal(s.idx);
      if (!s.rest0) { s.rest0 = L; continue; }
      const ddx = L[0] - s.rest0[0], ddy = L[1] - s.rest0[1],
            ddz = L[2] - s.rest0[2];
      const p2 = s.posAttr.array, b = s.base, W = s.w;
      for (let i = 0; i < W.length; i++) {
        p2[i * 3] = b[i * 3] + W[i] * ddx;
        p2[i * 3 + 1] = b[i * 3 + 1] + W[i] * ddy;
        p2[i * 3 + 2] = b[i * 3 + 2] + W[i] * ddz;
      }
      s.posAttr.needsUpdate = true;
    }
    // G59: the CONTROL SURFACES deflect about their own hinges, driven by
    // the same linkage the generated skin uses (so they lag identically).
    // `link` carries da/de/dr/fl in radians of surface deflection.
    if (model.surfParts) for (const s of model.surfParts) {
      if (!s.posAttr || !s.posAttr.array) continue;
      const ang = s.sgn * (link[s.drive] || 0);
      const b = s.base, out = s.posAttr.array;
      const ax = s.axis, ca = Math.cos(ang), sa = Math.sin(ang), C1 = 1 - ca;
      // Rodrigues about the hinge, which passes through the group's own
      // origin because the snapshot rebased these verts about the pivot
      for (let i = 0; i < b.length; i += 3) {
        const x = b[i], y = b[i + 1], z = b[i + 2];
        const d = ax[0] * x + ax[1] * y + ax[2] * z;
        out[i]     = x * ca + (ax[1] * z - ax[2] * y) * sa + ax[0] * d * C1;
        out[i + 1] = y * ca + (ax[2] * x - ax[0] * z) * sa + ax[1] * d * C1;
        out[i + 2] = z * ca + (ax[0] * y - ax[1] * x) * sa + ax[2] * d * C1;
      }
      // ...then the wing's own flex, ADDED on top of the deflected verts
      if (s.bind && s.bind.bound.length)
        applySkinDeform(s.bind, s.base, out, model.deltas.P, model.deltas.N,
                        skinMode === 1 ? SKIN_GAINS[1] : SKIN_GAINS[0],
                        s.hinged);
      s.posAttr.needsUpdate = true;
    }
    // the CASTOR rides the tailwheel node (rigid offset axle→swivel) and
    // YAWS about its own raked axis with the rudder linkage — ground
    // manoeuvring, everything but the spring (user's spec). If it steers
    // the wrong way, the sign on `link.dr` below is the one-char fix.
    if (model.castorRig) {
      const c = model.castorRig;
      if (c.obj.position && c.obj.position.set && c.obj.quaternion) {
        const L = nodeLocal(c.idx);
        if (!c.rest0) c.rest0 = L;
        else c.obj.position.set(
          c.pivot[0] + L[0] - c.rest0[0],
          c.pivot[1] + L[1] - c.rest0[1],
          c.pivot[2] + L[2] - c.rest0[2]);
        if (c.axis && c.obj.quaternion.setFromAxisAngle) {
          vY.set(c.axis[0], c.axis[1], c.axis[2]);
          c.obj.quaternion.setFromAxisAngle(vY, -(link.dr || 0));
        }
      }
    }
  }
  function applySkinVis() {
    const b = $('bSkin'), has = !!model;
    // `ready` gates on texture decode: the wireframe holds the frame rather
    // than showing an untextured mirror for the beat before the maps land
    // BOOLEANS, not truthiness chains (G47): `has && model.gen` is
    // UNDEFINED when gen is absent, and r128 only skips rendering on
    // `visible === false` — so `grp.visible = undefined` RENDERED while
    // the label and the wireframe took the hidden path. The cage visual
    // (and the PA-18, all along) froze on screen in Frame mode.
    const gen = !!(has && model.gen);
    // GARAGE: Frame mode strips the COVERING off the generated aeroplane and
    // leaves the welded truss standing. That is the build sequence, not a
    // debug view, so it shows real tubes rather than the line wireframe.
    const showSkin = !!(has && model.ready && (skinMode !== 2 || gen));
    if (model) model.grp.visible = showSkin;
    // Covered: fabric and cowl on, the truss and the engine block hidden under
    // them. Bare frame: the reverse — the welded chassis with the engine hung
    // on its mount, which is the state you actually build in. Struts, gear legs
    // and wheels are OUTSIDE any covering and show in both.
    //
    // WHAT COUNTS AS COVERING IS THE PAYLOAD'S TO SAY (`cover`, 63_gen_skin.js).
    // It used to be a literal list here, and it fell behind the generator twice —
    // each time a covering group was added over there, it kept showing in Frame
    // mode and the glazing floated in mid-air over the bare truss. A list of
    // names maintained at a distance from the thing it describes will always
    // drift; asking the generator cannot. The fallback keeps an older payload
    // (or an imported one) behaving exactly as before.
    if (gen) {
      const cover = model.cover || ['skin', 'cowl'];
      for (const n in model.meshes)
        model.meshes[n].visible = (n === 'frame' || n === 'engine') ? skinMode === 2
                                : cover.includes(n) ? skinMode !== 2 : true;
    }
    // OVERLAY (mode 3): the line frame draws WITH the skin, x-rayed through
    // it — depth test off, rendered after the opaque pass — so the physics
    // lattice reads inside the covered aeroplane. Every other mode keeps the
    // lines depth-tested (mode 2 shows them alone, nothing to x-ray).
    const overlay = skinMode === 3;
    lines.visible = pts.visible = !showSkin || overlay;
    // guarded: the UI smoke's THREE stub builds lines/pts without materials
    if (lines.material) lines.material.depthTest = !overlay;
    if (pts.material) pts.material.depthTest = !overlay;
    lines.renderOrder = 998; pts.renderOrder = 999;
    if (proxy) proxy.mesh.visible = !showSkin;   // the visible skin casts the shadow instead
    // ...unless the CAGE BUILD is what is standing there (G65), in which case
    // none of the model's meshes are on screen at all. applyStand has the last
    // word, because the skin mode decides WHICH of the model's meshes show and
    // this decides WHETHER the model shows.
    applyStand();
    b.style.display = has ? '' : 'none';
    // The gain is IN THE LABEL. Two of these three modes show the aeroplane's
    // real deflection and one deliberately quadruples it, and the button used to
    // say only "Covered / Flex ×4 / Bare frame" — which reads as though the ×4
    // belonged to the middle mode's name rather than being a property the other
    // two also have (at ×1). Naming every mode's gain removes the question.
    b.textContent = gen ? ['Covered ×1', 'Flex ×4', 'Frame ×1', 'Overlay ×1'][skinMode]
                        : ['Skin ×1', 'Flex ×4', 'Frame ×1', 'Overlay ×1'][skinMode];
    b.classList.toggle('on', showSkin);
  }
  // ---- WIRE: the mesh as built. Materials are cached per material NAME, so
  // one pass over the cache flips the whole aeroplane rather than chasing the
  // group list, and it survives a rebuild because the cache is rebuilt with it.
  let wireOn = false;
  function applyWire() {
    if (!model) return;
    model.grp.traverse(o => { if (o.material) o.material.wireframe = wireOn; });
    $('bWire').classList.toggle('on', wireOn);
  }
  $('bWire').onclick = () => { wireOn = !wireOn; applyWire(); };
  if ($('bMood')) $('bMood').onclick = () =>
    setMood(hangar ? (hangarMood + 1) % hangar.moods.length : 0);

  // ---- UV: the parameterisation, drawn flat. Every group's triangles in
  // texture space over its own texture, so a decal that is about to come out
  // stretched or mirrored can be seen BEFORE it is on the aeroplane. That is
  // the whole reason it exists: the registration squeeze was invisible from
  // outside the mesh and obvious the moment its UVs were laid out.
  const UV_COLS = ['#ffb257', '#63d3cc', '#ff8b73', '#a6e05f', '#c9a0ff', '#f2e05f'];
  let uvOn = false;
  function drawUV() {
    const cv = $('uvc'); if (!cv || !cv.getContext) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    if (!model || !model.dec) { $('uvleg').textContent = 'no generated mesh'; return; }
    // the paint sheet underneath, so UV islands are read against what they sample
    const t = model.texImg;
    if (t) { g.globalAlpha = 0.55; try { g.drawImage(t, 0, 0, W, H); } catch (e) {} g.globalAlpha = 1; }
    // ONLY the groups that sample this sheet. Drawing all of them was right when
    // every textured group shared the paint; since G4.6 the tyre carries its own
    // sheet and the hub, the cord and the truss carry no texture at all, and
    // laying their islands over the paint made the one diagnostic that is
    // supposed to show where a group SAMPLES into a tangle of unrelated grids.
    const mats = model.mats || {};
    const names = Object.keys(model.dec)
      .filter(n => mats[n] && mats[n].tex === 'paint');
    names.forEach((nm, gi) => {
      const d = model.dec[nm];
      if (!d.uv || !d.idx) return;
      g.strokeStyle = UV_COLS[gi % UV_COLS.length];
      g.lineWidth = 0.5;
      g.beginPath();
      for (let i = 0; i < d.idx.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const a2 = d.idx[i + k], b2 = d.idx[i + (k + 1) % 3];
          // v is flipped: texture space is bottom-up, canvas is top-down
          g.moveTo(d.uv[a2*2] * W, (1 - d.uv[a2*2+1]) * H);
          g.lineTo(d.uv[b2*2] * W, (1 - d.uv[b2*2+1]) * H);
        }
      }
      g.stroke();
    });
    $('uvleg').textContent = 'paint sheet: ' + (names.length
      ? names.map(n => String.fromCharCode(9632) + ' ' + n).join('  ')
      : 'no group samples it');
    const leg = $('uvleg');
    if (leg && leg.style) leg.style.color = '';
  }
  $('bUV').onclick = () => {
    uvOn = !uvOn;
    $('uvp').classList.toggle('show', uvOn);
    $('bUV').classList.toggle('on', uvOn);
    if (uvOn) drawUV();
  };

  $('bSkin').onclick = () => {
    skinMode = (skinMode + 1) % 4; applySkinVis();
  };

  // ---- W10 route: spawn at any aerodrome (default the home base), fly
  // a circuit there or cross-country to any other strip ----
  let fromId = 'HOME', destId = 'CIRCUIT';
  const aeroById = id => world.aerodromes.find(a => a.id === id) || world.aerodromes[0];
  function applyRoute() {
    placeAtAerodrome(sim, aeroById(fromId));   // HOME is a bit-exact no-op
    const to = destId === 'CIRCUIT' ? aeroById(fromId) : aeroById(destId);
    ap.setRoute(aeroById(fromId), to);
  }
  function setAircraft(key) {
    def = AIRCRAFT[key]();
    sim = makeSim(def, world);
    sim.reset(0);
    ap = makeAutopilot(sim, def, world);
    applyRoute();
    nb = sim.beams.length;
    if (lines) { craft.remove(lines); lines.geometry.dispose(); }
    if (pts) { craft.remove(pts); pts.geometry.dispose(); }
    bGeo = new THREE.BufferGeometry();
    bPos = new Float32Array(nb * 6); bCol = new Float32Array(nb * 6);
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    lines = new THREE.LineSegments(bGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
    lines.frustumCulled = false;
    craft.add(lines);
    pGeo = new THREE.BufferGeometry();
    pPos = new Float32Array(sim.n * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xc8d8ea,
      size: key === 'drone' ? 0.018 : 0.06 }));
    pts.frustumCulled = false;
    craft.add(pts);
    buildShadowProxy();
    curKey = key;
    if (model) {
      craft.remove(model.grp);
      // the generated model is rebuilt per spec change and never cached, so it
      // owns its GPU buffers and must give them back
      if (model.gen) model.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    model = buildModel(key, def);
    if (model) craft.add(model.grp);
    applySkinVis();
    applyWire();
    if (uvOn) drawUV();
    dist = distT = def.params.viewDist;   // aircraft change SNAPS, no glide
    const PP = POWERPLANTS[def.params.powerplant];
    let half = 0;                          // wingspan from the wing strips, like the solver
    for (const st of def.strips) if (st.kind === 'wing')
      for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
        half = Math.max(half, Math.abs(def.nodes[i].p[2]));
    const mass = sim.totalM < 5 ? (sim.totalM*1000).toFixed(0) + ' g' : sim.totalM.toFixed(0) + ' kg';
    $('acName').textContent = def.params.name;
    $('acSpec').textContent = `${mass} · ${PP.engine.name} · ${(half*2).toFixed(1)} m · ${sim.n} nodes`;
    // the plaque belongs to the GARAGE BUILD alone, so every aircraft
    // change re-asks: switching to a fleet aeroplane left the previous
    // build's numbers hanging on screen, which is the one thing a plaque
    // must never do — it would be reading someone else's certificate.
    if (typeof drawPlaque === 'function') drawPlaque();
    // and a fleet aeroplane never stands behind a cage build (G65)
    if (curKey !== 'gen') showCage = false;
    applyStand();
  }

  const cN = [0.34, 0.49, 0.69], cT = [1, 0.6, 0.24], cC = [0.31, 0.85, 0.91];
  function sCol(s, o) {
    const t = Math.min(Math.abs(s) / 0.02, 1), c = s > 0 ? cT : cC;
    bCol[o] = cN[0]+(c[0]-cN[0])*t; bCol[o+1] = cN[1]+(c[1]-cN[1])*t; bCol[o+2] = cN[2]+(c[2]-cN[2])*t;
  }
  function sync() {
    for (let i = 0; i < sim.n; i++) {
      pPos[i*3] = sim.p[i*3]; pPos[i*3+1] = sim.p[i*3+1]; pPos[i*3+2] = sim.p[i*3+2];
    }
    for (let i = 0; i < nb; i++) {
      const b = sim.beams[i], a3 = b.a*3, b3 = b.b*3, o = i*6;
      bPos[o] = sim.p[a3]; bPos[o+1] = sim.p[a3+1]; bPos[o+2] = sim.p[a3+2];
      bPos[o+3] = sim.p[b3]; bPos[o+4] = sim.p[b3+1]; bPos[o+5] = sim.p[b3+2];
      sCol(b.strain, o); sCol(b.strain, o + 3);
    }
    pGeo.attributes.position.needsUpdate = bGeo.attributes.position.needsUpdate =
      bGeo.attributes.color.needsUpdate = true;
    if (proxy) {
      for (let k = 0; k < proxy.ids.length; k++) {
        const i3 = proxy.ids[k] * 3, o = k * 3;
        proxy.pos[o] = sim.p[i3]; proxy.pos[o+1] = sim.p[i3+1]; proxy.pos[o+2] = sim.p[i3+2];
      }
      proxy.attr.needsUpdate = true;
    }
  }

  // ================= interaction =================
  const touches = new Map();
  let px = 0, py = 0, pinch0 = 0, dist0 = 0;
  // EDITOR PAN (G41, user: "proper rotate, and pan in this editor"):
  // middle or right drag while the editor is open moves the orbit centre
  // in the camera's screen plane; dblclick refits to the build's centre.
  // Flight and the plain stand view keep left-drag orbit only.
  const edPan = new THREE.Vector3();
  let panD = null;
  canvas.addEventListener('pointerdown', e => {
    if (edSit.visible && (e.button === 1 || e.button === 2)) {
      panD = { x: e.clientX, y: e.clientY, base: edPan.clone() };
      e.preventDefault();
      return;
    }
    if (e.button === 0) downAt = { x: e.clientX, y: e.clientY, t: Date.now() };
    canvas.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) { px = e.clientX; py = e.clientY; }
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = dist;
    }
  });
  canvas.addEventListener('contextmenu', e => {
    if (edSit.visible) e.preventDefault();
  });
  canvas.addEventListener('dblclick', () => {
    if (edSit.visible) edPan.set(0, 0, 0);
  });
  // ---- G79: CLICKING THE AEROPLANE SELECTS ITS PART ---------------------
  // The raycast lives here because the camera, the canvas and the mount do —
  // and it reports a HIT, not a part: which mesh section was struck, which
  // named object, which layer. Turning that into a part is the part table's
  // business and src/viewer/editor.js's job, so app.js never learns the
  // assembly and editor.js never learns the scene graph.
  const pickRay = new THREE.Raycaster(), pickNDC = new THREE.Vector2();
  function pickAt(cx, cy) {
    if (!edSit.visible) return null;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    pickNDC.x = ((cx - r.left) / r.width) * 2 - 1;
    pickNDC.y = -((cy - r.top) / r.height) * 2 + 1;
    // outside the render is not a miss, it is not a question
    if (Math.abs(pickNDC.x) > 1 || Math.abs(pickNDC.y) > 1) return null;
    pickRay.setFromCamera(pickNDC, camera);
    let hits;
    try { hits = pickRay.intersectObject(edSitP, true); }
    catch (e) { return null; }
    for (const h of hits) {
      const o = h.object;
      // the highlight overlay is not a thing you can click ON
      if (!o.visible || (o.userData && o.userData.edHi)) continue;
      // THE CAGE MESH: one draw group per section, so the face that was hit
      // names the section directly. r128 stamps `materialIndex` on the face
      // for multi-material geometry; the group scan is the fallback for a
      // build where it does not.
      const names = o.userData && o.userData.matNames;
      if (names && h.face) {
        let mi = h.face.materialIndex;
        if (mi == null && o.geometry.groups && h.faceIndex != null) {
          const i0 = h.faceIndex * 3;
          for (const g of o.geometry.groups)
            if (i0 >= g.start && i0 < g.start + g.count) { mi = g.materialIndex; break; }
        }
        if (names[mi]) return { section: names[mi], name: '', layer: 'cage',
                                point: h.point.toArray() };
      }
      // A LAYER OBJECT: the nearest name on the way up is the part (the layers
      // name what they build — edWheelL, edProp, edSurf_ailR, edFit_pitot),
      // and the group at the top says which layer it belongs to.
      let p = o, name = '', layer = '';
      while (p && p !== edSitP) {
        const n = p.name || '';
        if (n.lastIndexOf('cageLayer:', 0) === 0) layer = n.slice(10);
        else if (!name && n) name = n;
        p = p.parent;
      }
      if (layer) return { section: null, name, layer, point: h.point.toArray() };
    }
    return null;
  }
  // A CLICK IS NOT A DRAG. The same button orbits the camera, so a pick only
  // happens when the pointer barely moved and did not linger — otherwise
  // every orbit would end by selecting whatever was under the cursor.
  let downAt = null;
  const HOVER_MS = 110;
  let hoverT = 0;
  const endTouch = e => { panD = null; touches.delete(e.pointerId); };
  canvas.addEventListener('pointerup', e => {
    if (downAt && edSit.visible && e.button === 0 &&
        Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 4 &&
        Date.now() - downAt.t < 500 &&
        typeof window.EDITOR_PICK === 'function')
      window.EDITOR_PICK(pickAt(e.clientX, e.clientY), false);
    downAt = null;
    endTouch(e);
  });
  canvas.addEventListener('pointercancel', e => { downAt = null; endTouch(e); });
  canvas.addEventListener('pointermove', e => {
    if (panD) {
      // world metres per screen pixel at the target distance
      const wpp = 2 * dist * Math.tan(camera.fov * Math.PI / 360)
        / Math.max(1, canvas.clientHeight || canvas.height);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      edPan.copy(panD.base)
        .addScaledVector(right, -(e.clientX - panD.x) * wpp)
        .addScaledVector(up, (e.clientY - panD.y) * wpp);
      return;
    }
    // HOVER, and only when nothing else is going on. A ray into the mount
    // walks a hundred thousand triangles, so it is thrown at most every
    // HOVER_MS and never while a button is down — an orbit must not pay for a
    // tint it is about to throw away.
    if (!touches.size && !panD && edSit.visible &&
        typeof window.EDITOR_PICK === 'function') {
      const now = Date.now();
      if (now - hoverT > HOVER_MS) {
        hoverT = now;
        window.EDITOR_PICK(pickAt(e.clientX, e.clientY), true);
      }
    }
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) {
      azT += (e.clientX - px) * 0.006; elT += (e.clientY - py) * 0.006;
      elT = Math.max(-0.05, Math.min(1.4, elT));
      px = e.clientX; py = e.clientY;
    } else if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) distT = Math.max(4, Math.min(200, dist0 * pinch0 / Math.max(20, d)));
    }
  });
  // leaving the render clears the hover: a tint that outlives the pointer
  // reads as a selection, and there is already one of those
  canvas.addEventListener('pointerleave', () => {
    if (edSit.visible && typeof window.EDITOR_PICK === 'function')
      window.EDITOR_PICK(null, true);
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    distT = Math.max(4, Math.min(120, distT * (1 + e.deltaY * 0.001)));
  }, { passive: false });

  // ================= phase rail =================
  const PHASES = [['DEPART','DEPART'],['TAXI','TAXI'],['LINEUP','LINE UP'],
    ['ROLL','TAKEOFF ROLL'],['LIFTOFF','LIFT-OFF'],['CLIMB','CLIMB'],
    ['CRUISE','CRUISE'],['ENROUTE','ENROUTE'],['TURNBACK','TURNBACK'],['INBOUND','INBOUND'],
    ['APPROACH','APPROACH'],['FLARE','FLARE'],['ROLLOUT','ROLLOUT'],['STOPPED','STOPPED']];
  const tickEls = {};
  { const track = $('track');
    for (const [k, l] of PHASES) {
      const d = document.createElement('i');
      d.title = l; track.appendChild(d); tickEls[k] = d;
    }
  }
  let railPhase = '';
  function setRail(active) {
    if (active === railPhase) return;
    railPhase = active;
    $('phName').textContent = active === null ? 'HOLDING'
      : (PHASES.find(p => p[0] === active) || [0, active])[1];
    // GARAGE is a state of the rail, not a caption written over it. Poking the
    // text directly left railPhase stale, so a later setRail(null) matched and
    // returned early — the rail kept saying GARAGE while the solver ran.
    let past = active !== null && active !== 'GARAGE';
    for (const [k] of PHASES) {
      const d = tickEls[k];
      if (k === active) { d.className = 'now'; past = false; }
      else d.className = past ? 'done' : '';
    }
  }

  // ================= autopilot + telemetry =================
  let running = true, started = false;

  // ================= THE GARAGE (G3.2) =================
  // A place, not a mode of the runway. While you are building, the solver does
  // NOT step: the aeroplane stands at its design geometry on the apron in front
  // of the hangars, so nothing sags, nothing settles, nothing diverges, and a
  // slider drag no longer throws away a flight. ROLL OUT commits it to the
  // strip and turns the physics on.
  //
  // Not stepping is the whole of it. With the solver idle the sim stays exactly
  // where reset() put it, which IS the rest lattice rigidly placed — so the
  // skin poses to its rest shape for free and needs no special path.
  const APRON = {                    // in front of the hangars at (42,62)/(16,54)
    hdg: Math.PI - 0.62,             // quartered to the strip: a build stand pose
    elev: 0, tdz: [0, 0], spawn: [26, 40],
  };
  let inGarage = false;
  const tel = { t: [], alt: [], V: [], marks: [] };
  let telAcc = 0, lastPhase = 'ROLL', telBase = 0;   // telBase: multi-hop leg offset

  const telWrap = $('telp');

  function record(dt) {
    telAcc += dt;
    if (telAcc < 0.1) return;
    telAcc = 0;
    tel.t.push(telBase + ap.t); tel.alt.push(ap.dbg.alt || 0); tel.V.push((ap.dbg.V || 0) * 3.6);
    if (ap.phase !== lastPhase) { tel.marks.push([telBase + ap.t, ap.phase]); lastPhase = ap.phase; }
  }
  function drawTel() {
    const cv = $('tel'), g = cv.getContext('2d'), S = 2, W = cv.width / S, H = cv.height / S;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.clearRect(0, 0, W, H);
    if (tel.t.length < 2) return;
    const t1 = Math.max(tel.t[tel.t.length - 1], 1e-3), PAD = 16;
    const aMax = Math.max(20, ...tel.alt) * 1.15, vMax = Math.max(60, ...tel.V) * 1.15;
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,234,206,.09)';
    for (let k = 0; k <= 4; k++) {
      const y = Math.round(H - k / 4 * (H - PAD)) - 0.5;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.font = '500 8px "IBM Plex Mono", monospace';
    let lastLabelX = -99;
    for (const [tm, ph] of tel.marks) {
      const x = Math.round(tm / t1 * W) + 0.5;
      g.strokeStyle = 'rgba(255,234,206,.16)';
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      if (x - lastLabelX < 11) continue;           // crowded transitions: tick only
      lastLabelX = x;
      g.fillStyle = 'rgba(251,244,234,.42)';
      g.save(); g.translate(x + 3.5, 3); g.rotate(Math.PI / 2); g.fillText(ph, 0, 0); g.restore();
    }
    const path = (arr, max) => {
      g.beginPath();
      for (let i = 0; i < tel.t.length; i++) {
        const x = tel.t[i] / t1 * W, y = H - arr[i] / max * (H - PAD);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
    };
    path(tel.alt, aMax);
    g.lineTo(W, H); g.lineTo(0, H); g.closePath();
    g.fillStyle = 'rgba(99,211,204,.13)'; g.fill();
    g.lineWidth = 1.6; g.lineJoin = 'round';
    path(tel.alt, aMax); g.strokeStyle = '#63d3cc'; g.stroke();
    path(tel.V, vMax); g.strokeStyle = '#ffb257'; g.stroke();
    g.font = '500 8.5px "IBM Plex Mono", monospace';
    g.fillStyle = 'rgba(99,211,204,.85)';
    g.fillText(aMax.toFixed(0) + ' m', 4, 10);
    g.fillStyle = 'rgba(255,178,87,.85)';
    g.fillText(vMax.toFixed(0) + ' km/h', 52, 10);
    g.fillStyle = 'rgba(251,244,234,.42)';
    g.fillText(t1.toFixed(0) + ' s', W - 26, H - 4);
  }

  function script(dt) {
    // parking brake while HOLDING (W13 wind: a free-rolling taildragger
    // drifts downwind while you pick a route). ROLL sets brake=0 on start.
    if (!started) { sim.ctl.brake = 0.6; setRail(null); return; }
    ap.update(dt);
    record(dt);
    setRail(ap.phase);
    // telemetry stays on demand — just keep the touchdown summary current
    // so it's there when the panel is opened
    if (ap.phase === 'STOPPED' && ap.tdInfo) {
      $('tsum').textContent =
        `touchdown ${ap.tdInfo.sink.toFixed(2)} m/s · ${(ap.tdInfo.V * 3.6).toFixed(0)} km/h · ` +
        `${Math.abs(ap.tdInfo.z).toFixed(1)} m off centreline`;
      logFlight();
    }
  }
  // THE LOGBOOK'S OTHER HALF (G65). The bench writes what a build was TESTED
  // for; this writes what it has actually done. A stub, deliberately — P6 grows
  // it into the fleet rack — but a flight that leaves no trace is why an
  // aeroplane never becomes yours. One row per arrival, not one per frame:
  // STOPPED persists for as long as you leave it sitting there.
  let flightLogged = false;
  function logFlight() {
    if (flightLogged || curKey !== 'gen') return;
    flightLogged = true;
    try {
      const G = window.GARAGE_SPEC;
      if (!G || !G.log) return;
      const t = ap.tdInfo;
      G.log().flights.push({
        from: fromId, to: destId,
        sink: +t.sink.toFixed(2), V: +(t.V * 3.6).toFixed(0),
        off: +Math.abs(t.z).toFixed(1),
      });
      if (G.note) G.note({ id: 'flight', verdict: 'arrived', ok: true });
    } catch (e) {}
  }

  // ---- build indicators: what you cannot see by looking at the aeroplane ----
  // CG and neutral point, and the three ground contacts. The GAP between the
  // two upright markers IS the static margin — the number that decides whether
  // it flies at all, and the one thing a picture of an aeroplane never shows.
  // Rebuilt on entering the garage and on every spec change; static after that,
  // because in the garage nothing moves.
  // genShakedown runs a trim solve in the wind tunnel — the expensive half of a
  // rebuild. The panel and the indicators both want it, so it is memoised on
  // the fiche: one solve per aeroplane, not one per reader.
  let shakeFor = null, shakeVal = null;
  const shakeOf = () => {
    if (curKey !== 'gen') return null;
    if (shakeFor !== def) { shakeFor = def; shakeVal = genShakedown(def); }
    return shakeVal;
  };

  // THE DENSITY-ALTITUDE SHEET (G72), memoised on `def` exactly like the
  // shakedown above it — it is a few thousand tunnel probes, so it runs when
  // its bench test asks and not on a plaque redraw. `densAltIfRun` is what the
  // plaque reads: it returns the sheet ONLY while it belongs to the aeroplane
  // on screen, so a rebuild takes the thin-air rows away with the rest of the
  // certificate instead of leaving someone else's numbers up (the G60 fault).
  let daFor = null, daVal = null;
  const densAltOf = () => {
    if (curKey !== 'gen') return null;
    if (daFor !== def) { daFor = def; daVal = genDensityAlt(def); }
    return daVal;
  };
  const densAltIfRun = () => (daFor === def ? daVal : null);

  // ---- THE PLAQUE (P3) -------------------------------------------------
  // The aeroplane's own measured numbers, posted where it was built.
  // genShakedown has computed every one of these since G4; it lost its
  // panel at G35, so a builder has had no way to learn that the thing
  // they welded will not climb until the runway tells them. The verdict
  // comes first because that is the question a plaque answers; the rows
  // under it are the WHY, and each carries the code's OWN threshold —
  // nothing here invents a limit that the generator does not already use.
  // THE PLAQUE IS EARNED (G64). It used to post itself the moment an aeroplane
  // came home, which made it a readout; the user asked for an engineering
  // bench instead — "once the tests are passed the data gets filled" — so it
  // is a certificate, and `plaqueLive` is the bench saying one was issued.
  // Every editor rebuild takes it away again (BENCH_DIRTY), which is the load
  // test's own "a changed spec loses its certificate" ruling generalised.
  let plaqueLive = false;
  function drawPlaque() {
    const box = $('plaque');
    if (!box) return;                              // core-only build
    const on = plaqueLive && curKey === 'gen' && inGarage;
    box.classList.toggle('on', on);
    if (!on) return;
    let s = null;
    try { s = shakeOf(); } catch (e) {}
    if (!s) { box.classList.remove('on'); return; }
    const n1 = (v, d) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d);
    $('pqName').textContent = (def.params && def.params.name) || '';
    // THE VERDICT is the generator's own flyableCircuit, and when it says
    // no it must say WHY — the two terms it is made of (climb and take-off
    // run) are exactly what the builder can act on.
    const v = $('pqVerdict');
    const why = [];
    if (!s.flyableCircuit) {
      if ((s.climbRate || 0) < 0.5) why.push('it will not climb (' +
        n1(s.climbRate, 2) + ' m/s)');
      if ((s.TORun || 0) > 1100) why.push('take-off run ' +
        n1(s.TORun, 0) + ' m');
      if (!why.length) why.push('marginal climb and field length');
    }
    v.className = s.flyableCircuit ? 'ok' : 'bad';
    v.textContent = s.flyableCircuit
      ? 'FLIES A CIRCUIT'
      : 'WILL NOT FLY A CIRCUIT — ' + why.join('; ');
    // rows: label, value, and a verdict class where the code has a rule
    const rows = [];
    const H = t => rows.push('<div class="h">' + t + '</div>');
    const R = (label, val, cls) => rows.push('<div class="r' +
      (cls ? ' ' + cls : '') + '"><span>' + label + '</span><b>' +
      val + '</b></div>');
    H('weights');
    R('empty', n1(s.empty, 0) + ' kg');
    R('payload', n1(s.payload, 0) + ' kg');
    R('all-up', n1(s.mass, 0) + ' kg');
    R('cost', n1(s.cost, 0));
    H('wing');
    R('area', n1(s.Sw, 1) + ' m²');
    R('loading', n1(s.wingLoad, 1) + ' kg/m²');
    R('aspect', n1(s.AR, 1));
    R('L/D', n1(s.LD, 1), (s.LD || 0) < 6 ? 'warn' : '');
    H('speeds & field');
    R('stall', n1(s.Vs * 3.6, 0) + ' km/h');
    R('cruise', n1(s.VCruise * 3.6, 0) + ' km/h');
    R('climb', n1(s.climbRate, 2) + ' m/s',
      (s.climbRate || 0) < 0.5 ? 'bad' : '');
    R('take-off run', n1(s.TORun, 0) + ' m',
      (s.TORun || 0) > 1100 ? 'bad' : ((s.TORun || 0) > 500 ? 'warn' : ''));
    // IN THIN AIR (G72) — only when its own bench test has been run on THIS
    // build, so the section is earned the same way the plaque is.
    const da = densAltIfRun();
    if (da) {
      const hot = da.cases.filter(c => c.id === 'hot')[0];
      H('in thin air');
      if (hot) {
        R('density altitude', n1(hot.densAlt, 0) + ' m');
        R('take-off there', n1(hot.TORun, 0) + ' m',
          (hot.TORun || 0) > 1100 ? 'bad' : ((hot.TORun || 0) > 500 ? 'warn' : ''));
        R('climb there', n1(hot.climbRate, 2) + ' m/s',
          (hot.climbRate || 0) < 0.3 ? 'bad' : '');
        R('power there', n1((hot.power || 1) * 100, 0) + '%',
          (hot.power || 1) < 0.75 ? 'warn' : '');
      }
      const cap = v => v == null ? '> ' + n1(da.ceilingCap, 0) + ' m' : n1(v, 0) + ' m';
      R('service ceiling', cap(da.serviceCeiling),
        (da.serviceCeiling != null && da.serviceCeiling < 500) ? 'warn' : '');
      R('absolute ceiling', cap(da.absCeiling));
    }
    H('balance');
    R('CG', n1(s.cgX, 2) + ' m');
    R('neutral pt', n1(s.npX, 2) + ' m');
    // the fleet's own band: the Cub measures 0.22, the stock build 0.20.
    // Under 0.05 is twitchy; negative is unflyable.
    R('static margin', n1(s.staticMargin, 2),
      (s.staticMargin || 0) < 0 ? 'bad'
        : (s.staticMargin || 0) < 0.05 ? 'warn' : '');
    H('on the ground');
    R('stands on', s.onWheels ? 'its wheels' : (s.restsOn || '—'),
      s.onWheels ? '' : 'bad');
    R('deck angle', n1(s.deckAngle, 1) + '°');
    R('prop clear', n1(s.propClear, 2) + ' m',
      (s.propClear || 0) < 0.05 ? 'bad'
        : (s.propClear || 0) < 0.12 ? 'warn' : '');
    R('nose-over', n1(s.noseOver, 0) + '°',
      (s.noseOver || 0) < 15 ? 'warn' : '');
    if (s.gearFolded) R('gear', 'FOLDED', 'bad');
    $('pqRows').innerHTML = rows.join('');
    $('pqNote').textContent = s.engineName + ' · ' + n1(s.hp, 0) + ' hp · ' +
      s.propName + ' · ' + s.gearType + ' · ' + s.bracing +
      ' — measured on this build, not estimated.';
  }

  let gInd = null, gLabels = [];
  // a word floated above each marker. Canvas -> sprite, because a line drawing
  // cannot say which post is which and the two are only 0.3 m apart on a stable
  // aeroplane. sizeAttenuation off keeps them legible at any zoom.
  function makeLabel(text, rgb) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    const hx = v => Math.round(255 * Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2));
    g.fillStyle = `rgba(${hx(rgb[0])},${hx(rgb[1])},${hx(rgb[2])},1)`;
    g.font = '600 40px "IBM Plex Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, sizeAttenuation: false }));
    sp.scale.set(0.055, 0.028, 1);
    sp.renderOrder = 999;
    return sp;
  }
  // THE INSTRUMENTS GO ON THE AEROPLANE YOU CAN SEE (G65.1). They are built
  // from `sim.p` — the physics lattice — and they used to be the only thing in
  // the room drawn in that frame, because the mesh beside them is posed onto
  // the same nodes. The CAGE BUILD is not: `placeEditor` grounds it and leaves
  // it at the cage's OWN datum, so the two aeroplanes stand about 2.7 m apart
  // along the room. Nothing had ever tied them, and nothing had noticed —
  // before G65 the indicators were hidden whenever the cage build was up, so
  // the two were never on screen together. They are now, so the instruments
  // move onto whichever aeroplane is standing. See `standOffset`.
  const gGrp = new THREE.Group();
  gGrp.frustumCulled = false;
  craft.add(gGrp);
  // MEASURED, NOT DERIVED. The gear layer publishes its legs' AXLES in the
  // editor mount's own frame and the frame names the same two nodes GAL/GAR,
  // so the gap between the two aeroplanes is read off the one landmark both
  // of them agree is a wheel. Measured on the stock build: mains 2.63 m,
  // tailwheel 2.68 m — the same translation at both ends, which is what says
  // it IS a translation and not a pose difference. (Track and stance already
  // agree: half-track 0.8 both sides, deck angle 9.65 deg both.)
  //
  // Returns null when it cannot be measured — a rod boom with no gear layer,
  // an imported aeroplane, a build mid-rebuild — and the caller then HIDES the
  // instruments rather than drawing them somewhere they do not belong. An
  // instrument in the wrong place is worse than no instrument.
  function standOffset() {
    if (!showCage) return [0, 0, 0];
    const G = window.CAGE_GEAR;
    const legs = G && G.units && G.units.legs;
    const P = def && def.parts;
    if (!legs || !P || P.GAL == null || P.GAR == null) return null;
    const mains = legs.filter(l => l.kind === 'L' || l.kind === 'R');
    if (mains.length < 2) return null;
    edSitP.updateMatrixWorld(true);
    const w = new THREE.Vector3();
    let cx = 0, cy = 0, cz = 0;
    for (const l of mains) {
      w.set(l.axle[0], l.axle[1], l.axle[2]);
      edSitP.localToWorld(w);
      cx += w.x / mains.length; cy += w.y / mains.length; cz += w.z / mains.length;
    }
    const a = P.GAL * 3, b = P.GAR * 3;
    const lx = 0.5 * (sim.p[a] + sim.p[b]),
          ly = 0.5 * (sim.p[a + 1] + sim.p[b + 1]),
          lz = 0.5 * (sim.p[a + 2] + sim.p[b + 2]);
    if (!isFinite(cx) || !isFinite(lx)) return null;
    return [cx - lx, cy - ly, cz - lz];
  }
  function placeIndicators() {
    const d = standOffset();
    gGrp.visible = !!d;
    if (d) gGrp.position.set(d[0], d[1], d[2]);
  }
  function buildIndicators() {
    if (gInd) { gGrp.remove(gInd); gInd.geometry.dispose(); gInd = null; }
    for (const l of gLabels) { gGrp.remove(l); l.material.map.dispose(); l.material.dispose(); }
    gLabels = [];
    if (!inGarage || curKey !== 'gen') return;
    const s = shakeOf(), P = def.parts;
    const [xA] = sim.axes(), cg = sim.cgPos();
    const V = [], C = [];
    const seg = (a, b, col) => {
      V.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      for (let i = 0; i < 2; i++) C.push(col[0], col[1], col[2]);
    };
    // the panel's own --amber and --cyan, converted sRGB -> LINEAR. Vertex
    // colours go straight into a linear pipeline with ACES tone mapping, so
    // feeding the CSS values raw lifts them to a washed-out near-white and the
    // two markers stop being tellable apart.
    const lin = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]
      .map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    const AMBER = lin(0xffb257), CYAN = lin(0x63d3cc), PALE = lin(0xd3c3ae);
    // an upright post from the ground to well above the aeroplane, so the two
    // are comparable at a glance from any angle
    const label = (px, py, pz, text, col) => {
      const sp = makeLabel(text, col);
      sp.position.set(px, py + 0.42, pz);
      gGrp.add(sp); gLabels.push(sp);
    };
    const post = (px, pz, col, h) => {
      seg([px, 0, pz], [px, h, pz], col);
      for (const [dx, dz] of [[0.45, 0], [0, 0.45]])
        seg([px - dx, h, pz - dz], [px + dx, h, pz + dz], col);
    };
    post(cg[0], cg[2], AMBER, 3.2);
    const d = s.npX - s.cgX;                       // body-x offset, aft positive
    const npx = cg[0] + d * xA[0], npz = cg[2] + d * xA[2];
    post(npx, npz, CYAN, 2.8);
    // NEUTRAL POINT, not centre of lift. It is where the pitching moment stops
    // changing with alpha — the aft limit the CG must stay ahead of — and the
    // gap between the two posts IS the static margin. The centre of lift is a
    // different thing and moves with alpha; labelling it that way would say
    // something false about what the gap means.
    label(npx, 2.8, npz, 'NP', CYAN);
    label(cg[0], 3.2, cg[2], 'CG', AMBER);
    // and the margin itself, as a bar on the ground between the two posts
    seg([cg[0], 0.05, cg[2]], [cg[0] + d * xA[0], 0.05, cg[2] + d * xA[2]], CYAN);
    // ground contacts: where it actually touches, wheel by wheel
    for (const k of ['GAL', 'GAR', 'TW']) {
      const i = P[k]; if (i == null) continue;
      const n = def.nodes[i], y = sim.p[i * 3 + 1] - n.r;
      const px = sim.p[i * 3], pz = sim.p[i * 3 + 2];
      for (const [dx, dz] of [[0.28, 0], [0, 0.28]])
        seg([px - dx, y, pz - dz], [px + dx, y, pz + dz], PALE);
      seg([px, y, pz], [px, y + n.r, pz], PALE);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3));
    gInd = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
    gInd.frustumCulled = false;
    gGrp.add(gInd);
    placeIndicators();
  }

  // The design lattice is drawn LEVEL — the deck angle is something the
  // aeroplane acquires by settling onto its third wheel under gravity. With the
  // solver stopped that never happens, so a taildragger would stand in the
  // garage with its tailwheel 0.9 m in the air. This rotates the whole lattice
  // rigidly about the main axle until the third wheel touches, which is the
  // attitude genShakedown already reports as `deckAngle`. Rigid, so the skin
  // still poses to its rest shape and nothing is faked: it is the same
  // aeroplane, put down on its wheels.
  function standOnWheels() {
    const P = def.parts, iM = P.GAL, iT = P.TW;
    if (iM == null || iT == null) return;
    const x0 = sim.p[iM * 3], y0 = sim.p[iM * 3 + 1];
    const rM = def.nodes[iM].r, rT = def.nodes[iT].r;
    const ux = sim.p[iT * 3] - x0, uy = sim.p[iT * 3 + 1] - y0;
    // rotate by `a` about the axle so the third contact meets the mains':
    //   ux sin a + uy cos a = rT - rM
    // TWO roots satisfy that, and the far one puts the aeroplane on its back
    // with all three contacts still perfectly coplanar — it flipped a tricycle
    // 170 degrees and the arithmetic never complained. Take the near root.
    const h = Math.hypot(ux, uy), R = rT - rM;
    if (h < 1e-6 || Math.abs(R) > h) return;
    const q = Math.asin(R / h), phi = Math.atan2(uy, ux);
    const wrap = v => Math.atan2(Math.sin(v), Math.cos(v));
    const r1 = wrap(q - phi), r2 = wrap(Math.PI - q - phi);
    const a = Math.abs(r1) <= Math.abs(r2) ? r1 : r2;
    const c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < sim.n; i++) {
      const dx = sim.p[i * 3] - x0, dy = sim.p[i * 3 + 1] - y0;
      sim.p[i * 3] = x0 + dx * c - dy * s;
      sim.p[i * 3 + 1] = y0 + dx * s + dy * c;
    }
  }

  // ---- THE LOAD TEST, in the garage. BUILD -> LOAD TEST -> FLY, which is the
  // order a real homebuilt goes in: you do not fly it until the wing has held
  // the bags. The rig itself is src/core/65_gen_loadtest.js, the same object
  // GATE LOAD ticks headlessly, so the verdict on screen and the verdict in the
  // battery are the same computation.
  //
  // It runs IN PLACE on the live sim: the rig lifts the aeroplane clear of the
  // ground, bolts every non-wing node down and hangs the bags on the wing, so
  // the covering bends because the truss under it does — the generated skin is
  // an affine blend of the same nodes and needs no help. Leaving the garage or
  // resetting rebuilds the aeroplane, which is what puts it back on its wheels.
  let rig = null, rigTested = false;

  // ---- THE RIG, ON SCREEN -------------------------------------------------
  // Every number this test produces was already correct and none of it could be
  // seen. Three things were missing, and only the second is really a drawing
  // problem:
  //   THE ROOM  — handled by `rigLift` in applyEnv() above.
  //   THE BAGS  — they were never geometry. `sim.impulse` on a node is not
  //               something you can look at, so the load went on invisibly.
  //   THE BEND  — it was there all along. Tip deflection is a few per cent of
  //               semispan, and a few per cent of anything is invisible in
  //               mid-air with nothing to judge it against. So the DATUM — the
  //               settled 0 g shape, frozen the instant the ramp starts — is
  //               drawn as a straight reference and the live spar bends away
  //               from it. That gap is the measurement the panel prints.
  // Both lines follow the +z wing only, which is the wing the rig instruments
  // (genLoadStations takes p[2] > 0) — so what is drawn is what is reported.
  let loadViz = null;
  function clearLoadViz() {
    if (!loadViz) return;
    craft.remove(loadViz.grp);
    loadViz.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    loadViz = null;
  }
  // a unit box stretched between two points, long axis on its local +z
  function spanBox(m, a, b, w) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz);
    if (!(L > 1e-5)) { m.visible = false; return; }
    m.position.set(0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1]), 0.5 * (a[2] + b[2]));
    m.scale.set(w, w, L);
    m.lookAt(b[0], b[1], b[2]);
    m.visible = true;
  }
  function buildLoadViz(rg) {
    clearLoadViz();
    const grp = new THREE.Group();
    grp.frustumCulled = false;
    // BAGS HAVE TO CLEAR THE WING. The spar nodes they hang off sit at MID
    // thickness, so the first version buried every one of them: a 2 cm offset
    // inside a 19 cm wing. Half the local thickness comes from the wing's own
    // planform function and its NACA digits — the same numbers the skin was
    // lofted from — so a thick root and a thin tip both come out right.
    const S = def.spec, P = def.parts;
    const tFrac = S && S.wing ? (S.wing.naca % 100) / 100 : 0.12;
    const chord = z => (P && P.chordAt) ? P.chordAt(Math.abs(z))
                                        : (S && S.wing ? S.wing.chord : 1.5);
    let maxF = 1e-9;
    for (const b of rg.bags) maxF = Math.max(maxF, b[1]);
    // Each bag is sized by the share of the load its node actually carries, so
    // the spanwise distribution is something you can look at, not just infer.
    // STANDARD, not Lambert. The room runs physicallyCorrectLights and bakes a
    // PMREM of itself for everything glossy in it, and a Lambert surface in it
    // saturates: measured on the bags, 0x7d6142 rendered 255,255,255 and even a
    // near-black 0x2a2016 came back 255,252,246, so the colour was doing
    // nothing at all. Standard is the family the hangar was lit for and reads
    // ~191,175,144 here, with real per-bag shading.
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4a, roughness: 0.95,
                                                    metalness: 0 });
    const bags = rg.bags.map(b => {
      const s = 0.11 + 0.20 * Math.sqrt(b[1] / maxF);
      const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.7, s * 0.55, s), bagMat);
      m.frustumCulled = false; m.name = 'loadbag';
      grp.add(m);
      return { node: b[0], mesh: m,
               clear: 0.5 * tFrac * chord(def.nodes[b[0]].p[2]) + s * 0.28 };
    });
    // THE STRAIGHTEDGE AND THE GAP. A polyline of the bent spar is the honest
    // picture and it is useless: one pixel wide, yellow on a yellow wing. What
    // reads at a glance is a straight DATUM laid along the wing at its settled
    // 0 g shape, and a bar measuring how far the tip has risen off it — which
    // is exactly the number the panel prints. Both are instruments rather than
    // parts of the aeroplane, so they draw OVER it (depthTest off) instead of
    // disappearing inside the covering.
    const bar = (col, order) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
      m.frustumCulled = false; m.renderOrder = order; m.visible = false;
      grp.add(m); return m;
    };
    // THE RED FLAG is a marker, not a recoloured member: the covering is
    // normally on during a test, and a red line under fabric is no flag at all.
    const flag = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2a1e, depthTest: false }));
    flag.frustumCulled = false; flag.visible = false; flag.renderOrder = 1000;
    grp.add(flag);
    craft.add(grp);
    // Dark navy, not white: the room is a pale shed and the wing is yellow, and
    // a near-white straightedge measured invisible against both.
    loadViz = { grp, bags, datumBar: bar(0x15294a, 998), deflBar: bar(0xff3b1f, 999),
                flag, stations: rg.stations, datumVec: null };
  }
  function updateLoadViz(rg) {
    if (!loadViz) return;
    const st = rg.state;
    // The bags GO ON. They grow with the load actually applied rather than
    // being there from the first frame, because watching them go on is what
    // makes a ramp legible as a ramp.
    const f = Math.max(0, Math.min(1, st.n / Math.max(1e-6, st.nTarget)));
    for (const b of loadViz.bags) {
      const i3 = b.node * 3;
      b.mesh.visible = f > 0.02;
      b.mesh.scale.set(1, Math.max(0.001, f), 1);
      b.mesh.position.set(sim.p[i3], sim.p[i3 + 1] + b.clear, sim.p[i3 + 2]);
    }
    const S = loadViz.stations, last = S.length - 1;
    const at = k => { const i3 = S[k].f * 3; return [sim.p[i3], sim.p[i3 + 1], sim.p[i3 + 2]]; };
    // DATUM: frozen the frame the settle ends, which is the instant the rig
    // itself takes its jig datum (65_gen_loadtest.js). Same moment, same shape
    // — so the picture cannot disagree with the percentage beside it.
    // THE STRAIGHTEDGE IS CLAMPED TO THE ROOT, not left hanging in space. The
    // root spar nodes carry WF/WR tags, so the rig does NOT pin them — the root
    // rises with the load too — and `rise()` measures every station RELATIVE to
    // it. A datum frozen in world coordinates therefore reads the root's own
    // motion into the tip: measured at +2.97 g, an 11.4 cm deflection drew a
    // 23.4 cm bar. Keeping the datum as a VECTOR from the root makes the bar
    // exactly the quantity the panel prints beside it.
    const root = at(0), tip = at(last);
    if (!loadViz.datumVec && st.phase !== 'settle')
      loadViz.datumVec = [tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]];
    const dv = loadViz.datumVec;
    if (dv) {
      const dTip = [root[0] + dv[0], root[1] + dv[1], root[2] + dv[2]];
      // and the BAR IS THE PROJECTION, for the same reason. `rise()` resolves
      // each station onto the body up-axis, so a raw 3D gap between straightedge
      // and tip also counts the tip drawing inboard as the wing bows: 18.0 cm
      // drawn against 15.3 cm printed. Taking the same component makes the bar's
      // length equal to `tipM` by construction rather than by coincidence.
      const up = sim.axes()[1];
      const h = (tip[0] - dTip[0]) * up[0] + (tip[1] - dTip[1]) * up[1]
              + (tip[2] - dTip[2]) * up[2];
      spanBox(loadViz.datumBar, root, dTip, 0.060);
      spanBox(loadViz.deflBar, dTip,
              [dTip[0] + up[0] * h, dTip[1] + up[1] * h, dTip[2] + up[2] * h], 0.110);
    }
    const bi = st.worstBeam;
    if (st.worstPct != null && st.worstPct >= 100 && bi >= 0 && bi < sim.beams.length) {
      const b = sim.beams[bi], a3 = b.a * 3, c3 = b.b * 3;
      loadViz.flag.position.set(0.5 * (sim.p[a3] + sim.p[c3]),
                                0.5 * (sim.p[a3 + 1] + sim.p[c3 + 1]),
                                0.5 * (sim.p[a3 + 2] + sim.p[c3 + 2]));
      loadViz.flag.visible = true;
    } else loadViz.flag.visible = false;
  }

  function startLoadTest() {
    if (!inGarage) return;
    rig = makeLoadTest(sim, def, { material: (genSpec && genSpec.fuselage &&
                                              genSpec.fuselage.material) || undefined });
    if (!rig.state.ok) { rig = null; return; }        // no spar stations to load
    rigLift = rig.lift; applyEnv();                   // take the room up with it
    buildLoadViz(rig);
    railPhase = ''; setRail('LOAD TEST');
  }
  function loadTestState() { return rig ? rig.state : null; }
  function endLoadTest() {
    rig = null;
    if (inGarage) enterGarage();                      // back on its wheels
  }
  function enterGarage() {
    inGarage = true; started = false; running = true;
    // THE MODE FOLLOWS THE GARAGE, not the editor's boot (G86). It hung off
    // openEditor at first, which returns early when the cage editor cannot
    // boot — so a garage without an editor stayed dressed as a cockpit, with
    // the PFD and the phase rail watching you not build anything. Entering the
    // garage IS the workshop; the panel is a thing IN it.
    setMode(true);
    // The room comes back DOWN here rather than in endLoadTest, because this is
    // the one door every way out of a test goes through — finishing it, editing
    // the aeroplane mid-test, or resetting. applyEnv() below picks it up.
    rigLift = 0; clearLoadViz();
    // every spec change comes back through here (GARAGE_SPEC.apply -> enterGarage),
    // so this is where a changed aeroplane loses its certificate: you tested the
    // one you had, not the one you now have.
    rig = null; rigTested = false;
    sim.reset(0);
    standOnWheels();
    // NO AERODROME. The garage is not a place on the map, and the apron
    // placement it used to inherit was the last thread tying the editor to the
    // world. Left at the origin the aeroplane sits in its OWN model frame — x
    // aft, z spanwise — which is the frame the hangar was drawn in, so the
    // room needs no alignment maths to line up with the aeroplane in it.
    // Rolling out re-places from scratch (fullReset -> applyRoute), so nothing
    // downstream depends on this.
    buildIndicators();
    // INTO THE ROOM. The aeroplane leaves the world entirely while it is being
    // built — not "the world with the physics paused", which is what this was,
    // and which meant every slider drag was still a change to a running
    // aircraft parked on an apron.
    garageScene().add(craft);
    // Stand the floor under the wheels. Placed once, here, because nothing in
    // the garage moves: the solver is stopped and the aeroplane is exactly
    // where standOnWheels put it. The contact plane is the main wheel's centre
    // less its radius, which is the same definition standOnWheels levelled on.
    const iM = def.parts.GAL;
    groundY = iM == null ? 0 : sim.p[iM * 3 + 1] - def.nodes[iM].r;
    applyEnv();
    railPhase = ''; setRail('GARAGE');
    // the cage build comes back up if the editor has ever booted (G65), and
    // the roll-out button re-reads the certificate
    showCage = !!window.CAGE_UI && curKey === 'gen';
    applyStand();
    syncGoLabel();
    // THE PLAQUE goes up whenever the aeroplane comes home — including
    // after build & fly, which reaches here through GARAGE_SPEC.apply, so
    // a rebuilt aeroplane always posts ITS OWN numbers and never the
    // previous build's (shakeOf caches per def, so this is one settle).
    drawPlaque();
  }
  function rollOut() {
    closeEditor();       // flying with the craft hidden is not a thing (G36)
    const pq = $('plaque'); if (pq) pq.classList.remove('on');
    rig = null;
    // Rolling out is the one way to leave a FINISHED test without passing
    // through enterGarage, so the sandbags have to be taken off here too — or
    // they fly to the strip bolted to the wing.
    rigLift = 0; clearLoadViz();
    inGarage = false;
    showCage = false; applyStand();    // the MESH flies, not the editor's cage
    scene.add(craft);                  // out of the room, onto the strip
    renderer.toneMappingExposure = WORLD_EXPOSURE;
    renderer.physicallyCorrectLights = WORLD_PHYSLIGHTS;
    // THE AEROPLANE FLEW OUT STILL REFLECTING THE SHED (user: "the planes look
    // really washed out when they get out of the garage and into the world").
    // Every mood scales the aeroplane's own envMapIntensity to suit the room's
    // probe — AFTERNOON runs it at x2.2 (hangar.js setMood, via aeroSetEnv) —
    // and NOTHING put it back. Measured on the wing after rolling out of an
    // AFTERNOON shed: envMapIntensity 2.20, against an authored 1.0, now
    // pointed at a completely different environment. The aeroplane was being
    // lit by the world and reflecting it at more than twice the strength it
    // was built for, which is exactly what "washed out" looks like.
    //
    // The world's probe is baked at its own level, so the aeroplane wants its
    // AUTHORED response out here: 1.0, the factory's own env0.
    if (typeof aeroSetEnv === 'function') aeroSetEnv(WORLD_ENV);
    syncEnvBtn();
    buildIndicators();                 // clears them
    $('bGo').textContent = 'Fly the circuit';
    fullReset();
  }

  $('bGo').onclick = () => {
    if (inGarage) {
      // ROLL OUT & FLY flies WHAT YOU DESIGNED (G47.1, user: "roll out
      // and fly still gives the old yellow plane"). Since G65 that is not a
      // second button's job: the export through the join is a STEP inside
      // rolling out, and it runs whether or not the panel happens to be open,
      // because the panel is a view and the design is not.
      if (window.CAGE_UI) syncBuild();
      rollOut();
    }
    started = true;
  };
  function fullReset() {
    if (inGarage) return enterGarage();   // Reset in the garage means back to the stand
    sim.reset(0); ap = makeAutopilot(sim, def, world); applyRoute(); started = false; running = true;
    $('bPause').textContent = 'Pause'; $('bPause').classList.remove('on');
    tel.t.length = tel.alt.length = tel.V.length = tel.marks.length = 0;
    lastPhase = 'ROLL'; telBase = 0; flightLogged = false;
    telWrap.classList.remove('show'); $('bTel').classList.remove('on');
    $('tsum').textContent = '';
    railPhase = ''; setRail(null);
  }
  $('bReset').onclick = fullReset;
  // selecting the Garage build puts you IN the garage; any other aeroplane is
  // finished and goes straight to the strip. Since G35 the garage's editor
  // is the CAGE EDITOR overlay — it opens with the garage, and closing it
  // leaves you at the stand (builds bar, env buttons, Roll out & fly).
  $('selAc').onchange = e => {
    setAircraft(e.target.value);
    if (curKey === 'gen') { enterGarage(); openEditor(); } else rollOut();
    hud();
  };
  // ---- THE EDITOR (G35, remounted G36): the cage bench, embedded. Boot
  // is LAZY — the bundle sets CAGE_UI_LAZY before the bench scripts, so
  // the editor pays its build cost on first open, not at game boot.
  // Since G36 the cage build renders IN THE GAME'S OWN GARAGE SCENE (one
  // renderer, one look — the cure for chasing pipeline parity): the
  // mount below receives the cage objects at boot, the game craft hides
  // while the editor is open, and the sit transform inverts the bench's
  // tilted-ground convention onto the room's level floor.
  // THE REFERENCE PLANE'S MOUNT (G89). A SIBLING of the editor's, never a
  // child: the reference is not part of the aeroplane, so it must not inherit
  // the gear layer's pitch, must not enter placeEditor's orbit-target box, and
  // must not be reachable by the part raycast (which targets edSitP alone, so
  // that last one is free). refplane.js owns everything inside it; app.js owns
  // only the group, the floor line and the build's box to measure against.
  const refSit = new THREE.Group();
  refSit.visible = false;
  window.REF_MOUNT = {
    group: refSit,
    // the floor the build stands on — the main wheel's centre less its radius
    groundY: () => groundY,
    // the build's own as-displayed box, in WORLD units, for the discrepancy
    // line. Null when there is no build standing (which is never, in the
    // editor, but the caller should not have to know that).
    // LOCAL CLIPPING is a RENDERER setting, not a material one, and it is off
    // by default. The reference's half-model view is the only thing in the
    // project that wants it, so it is turned on ONLY while that view is asked
    // for and off again after — nothing else in the scene carries a clipping
    // plane, so this can never reach another session's materials.
    setClipping: on => { renderer.localClippingEnabled = !!on; },
    // NOT Box3().setFromObject(edSitP), AND THAT COST A REAL BUG. In r128 that
    // walks every DESCENDANT CARRYING GEOMETRY and never consults `visible` —
    // and this mount holds an invisible 12 x 12 GridHelper (the bench's own
    // ground grid, off in the game). So "your build" measured 12.00 m long and
    // 12.00 m wide, every time, whatever you had actually built: two numbers
    // plausible enough to read straight past, on an aeroplane that looked
    // correct. The G58 lesson again — a screenshot would never have caught it
    // and the numbers gave it away on sight.
    //
    // So the walk is explicit. MESHES ONLY: a helper is a LineSegments, and a
    // wireframe grid is not a dimension. VISIBLE ONLY, and it stops at an
    // invisible BRANCH rather than at an invisible leaf — traverse() does not
    // prune, so an invisible group of visible children would measure the lot.
    // And the editor's own selection overlay is skipped, because it re-draws
    // geometry that is already being measured and can only agree or
    // double-count.
    buildBox: () => {
      if (!edSit.visible) return null;
      edSit.updateMatrixWorld(true);
      const b = new THREE.Box3(), v = new THREE.Vector3();
      const walk = o => {
        if (!o.visible || o.userData.edHi) return;
        if (o.isMesh && o.geometry) {
          const g = o.geometry;
          if (!g.boundingBox) g.computeBoundingBox();
          const bb = g.boundingBox;
          if (bb && isFinite(bb.min.x)) for (let i = 0; i < 8; i++) {
            v.set(i & 1 ? bb.max.x : bb.min.x,
                  i & 2 ? bb.max.y : bb.min.y,
                  i & 4 ? bb.max.z : bb.min.z);
            b.expandByPoint(o.localToWorld(v));
          }
        }
        for (const c of o.children) walk(c);
      };
      walk(edSitP);
      return isFinite(b.min.x) && b.min.x <= b.max.x ? b : null;
    },
  };
  const edSit = new THREE.Group(), edSitP = new THREE.Group();
  edSit.add(edSitP);
  // the cage builds z-FORWARD; the room's long axis is x with the door
  // at -x, the way the game craft noses — turn the build to face it
  edSit.rotation.y = -Math.PI / 2;
  edSit.visible = false;
  const edTarget = new THREE.Vector3(2.2, 1, 0);
  function placeEditor() {
    const G = window.CAGE_GEAR;
    if (!G) return;
    // the gear layer's ground plane is rot(-pitch) at gy along its own
    // normal; inverted here — pitch the AEROPLANE, lift it so the
    // rotated contact plane lands on the room floor (groundY)
    edSitP.rotation.x = +G.pitch || 0;
    edSit.position.set(0, groundY - (+G.gy || 0), 0);
    // ...and the ORBIT COMES TO THE BUILD (G39; G37 moved the build to
    // the orbit point, but the frame loop re-targets the camera every
    // frame, so the target is what must move): the camera orbits the
    // build's own bounding centre, recomputed with every rebuild.
    edSit.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(edSitP);
    if (isFinite(bb.min.x) && isFinite(bb.max.x))
      bb.getCenter(edTarget);
  }
  // Every editor rebuild re-places the build AND invalidates its certificate:
  // the numbers on the plaque were measured off an aeroplane that no longer
  // exists the instant a slider moves.
  // ---- WHAT STANDS IN THE ROOM (G65) -------------------------------------
  // The thing you look at while building is the CAGE BUILD; the generated
  // model hides behind it. Its MESH hides, not the whole `craft` group — the
  // CG and neutral-point posts are children of `craft` and they are exactly
  // what you want standing against the build, which is why they used to
  // vanish the moment the editor opened. `showCage` is declared with the
  // meshes, up by `lines`/`proxy`.
  function applyStand() {
    edSit.visible = showCage;
    craft.visible = true;                       // the indicators live in here
    const mesh = !showCage;
    if (model && model.grp) model.grp.visible = mesh;
    if (proxy && proxy.mesh) proxy.mesh.visible = mesh;
    if (lines) lines.visible = mesh;
    if (pts) pts.visible = mesh;
    // the instruments follow whichever aeroplane is standing
    if (typeof placeIndicators === 'function') placeIndicators();
  }

  // ---- THE EXPORT IS NOT A BUTTON (G65) ----------------------------------
  // `build & fly` is gone. Committing the editor to the spec is a STEP, and
  // it belongs inside the two things that need it: running a test, and rolling
  // out. Returns the list of measurements that could not be taken (G64), so a
  // caller can refuse rather than fly a build the join could not read.
  function syncBuild() {
    if (!window.CAGE_UI || !window.CAGE_JOIN || !window.GARAGE_SPEC) return null;
    try {
      const spec = window.CAGE_JOIN.export();
      // the visual freezes BEFORE the spec applies: setAircraft('gen')
      // rebuilds the model and must find it already standing
      if (window.CAGE_JOIN.snapshot)
        window.CAGE_VISUAL = window.CAGE_JOIN.snapshot(spec);
      (window.GARAGE_SPEC.update || window.GARAGE_SPEC.set)(spec);
      return (window.CAGE_JOIN.errors && window.CAGE_JOIN.errors()) || [];
    } catch (e) {
      console.error('build sync:', e);
      return ['export failed: ' + e.message];
    }
  }
  // garage.js calls this after seeding the editor from a loaded build, so a
  // load ends with the flying spec, the editor and the VISUAL all agreeing —
  // which is the declared G46 gap ("the visual is not in the save") closed
  // without putting a single mesh byte in localStorage.
  window.BUILD_SYNC = syncBuild;

  // ROLL OUT reads the certificate but is NEVER locked: it is your aeroplane,
  // and building it wrong and learning why is content, not error.
  function syncGoLabel() {
    const b = $('bGo');
    if (!b || !inGarage) return;
    const st = (typeof window.BENCH_STATE === 'function') ? window.BENCH_STATE()
                                                          : null;
    const untested = st && !st.passed;
    b.textContent = untested ? 'Roll out untested' : 'Roll out & fly';
    b.classList.toggle('warn', !!untested);
    // ...and the verb in the view says the same thing (G78). Two buttons, one
    // sentence: the bottom bar's is what the game has always had and is hidden
    // in the garage now, and the verb is what you actually press.
    const v = $('edRoll');
    if (v) {
      v.textContent = b.textContent;
      v.classList.toggle('warn', !!untested);
    }
  }
  window.BENCH_CHANGED = syncGoLabel;

  window.CAGE_ON_BUILD = () => {
    placeEditor();
    if (typeof window.BENCH_DIRTY === 'function') window.BENCH_DIRTY();
  };
  // THE EDITOR OPENS ON THE BUILD YOU LOADED (G63). It never did: the boot
  // ran off the page's own defaults and nothing afterwards ever put a spec
  // into it, so loading a saved aeroplane rebuilt the GAME's model and left
  // the editor showing the template — and the next export wrote that template
  // over the build you had just opened.
  //
  // Seeding happens ONCE, at boot, and every load after that is garage.js's
  // own `loadSpec` calling `applySpec` directly. Re-seeding on every open
  // would be worse than not seeding at all: `applySpec` re-anchors the scale
  // slider to x1.000 on the design it loads, so merely closing and reopening
  // the panel would move the reference the sliders are read against.
  // ...and only when there is a cage to seed FROM. `spec.cage: null` means
  // "the template" (60_gen_spec.js says so in as many words), and the template
  // is CAGE_PARAMS — not the page's own default aeroplane, which is what the
  // editor is built to open on. A fresh session's spec has no cage, so seeding
  // it would replace the jodel the editor opens with by the bare template.
  // Loading a FILE is different and stays unconditional (garage.js): a build
  // that records no cage is asking for the template, and leaving the previous
  // design in the editor would only export it back over the build just opened.
  let edSeeded = false;
  function seedEditor() {
    const E = window.CAGE_UI;
    if (edSeeded || !E || !E.applySpec || !genSpec) return;
    edSeeded = true;
    if (!genSpec.cage || !Object.keys(genSpec.cage).length) return;
    try { E.applySpec(genSpec); }
    catch (err) { console.error('cage editor seed:', err); }
  }
  function openEditor() {
    const w = $('edWrap');
    if (!w || typeof CAGE_UI_BOOT !== 'function') return;
    w.hidden = false;
    let booted = false;
    try {
      if (!window.CAGE_UI) {
        window.CAGE_UI_SCENE = edSitP;      // the mount, read at boot
        CAGE_UI_BOOT();
        if (typeof CAGE_PAGE_SETUP === 'function') CAGE_PAGE_SETUP();
        // ...and the panel takes the two rows that just appeared. The page's
        // DERIVED SELECTORS (nose configuration, seating starter) are injected
        // by the call above into the accordion groups the inspector has
        // already emptied, and they are not parameters, so nothing else would
        // ever collect them.
        if (typeof window.CAGE_ON_PAGE === 'function') window.CAGE_ON_PAGE();
        booted = true;
      }
    } catch (err) { console.error('cage editor boot:', err); }
    showCage = true;
    applyStand();
    applyEnv();                             // parents the mount into the room
    placeEditor();
    // after the mount is parented and the floor is under it, so the seed's
    // own rebuild lands in a room that already exists
    if (booted) { seedEditor(); placeEditor(); }
    syncGoLabel();
  }
  // THE PANEL IS 640 PX WIDE NOW (G77), and it is opaque. The game's own HUD
  // has to get out from under it: the bottom bar's right-hand end used to sit
  // beneath the editor, and the minimap and the telemetry are about FLYING and
  // have no business on screen while you are building. One class does both, so
  // there is one answer to "is the editor up" and not two.
  //
  // The BOTTOM BAR STAYS for now. The design retires it — the two verbs (roll
  // out & fly, run the bench) move into the view, bottom left — but they land
  // with the icon rail in G78, and hiding the bar before its replacement
  // exists would leave no way out of the garage at all.
  // The classes live on <body> because the CANVAS has to move too — see the
  // note on resize(). One holder, so there is one answer to "is the editor up
  // and how wide is it" and not two.
  // ---- TWO INTERFACES (G86) ----------------------------------------------
  // FLIGHT and WORKSHOP are separate chrome layers over one renderer, and
  // NEITHER BORROWS FROM THE OTHER. The user's own words: "I don't care about
  // telemetry and speed/alt stats in garage, and I don't care about part
  // selection in flight mode. Different interfaces entirely."
  //
  // This is ONE SWITCH and not a dozen rules each hiding one thing, which is
  // what the screen had grown and is exactly why the old aircraft card was
  // rendering underneath the new name chip: `#card` was never anybody's to
  // hide, so nobody did.
  //
  // The mode is a fact about the SCREEN and lives on <body>, where the canvas
  // can read it too (G77.1 — the render is the free estate, and how much
  // estate is free depends on which interface is up).
  function setMode(ws) {
    const b = document.body, w = $('edWrap'), v = $('edView'), u = $('wsUI');
    if (!b) return;
    b.classList.toggle('mode-ws', !!ws);
    b.classList.toggle('mode-fly', !ws);
    b.classList.toggle('ed-narrow',
      !!(ws && w && w.classList.contains('pcol-off')));
    if (u) u.hidden = !ws;
    if (v) v.hidden = !ws;
    if (!ws && typeof window.EDITOR_RELEASE === 'function')
      window.EDITOR_RELEASE();
    // A BACKSTOP FOR THE RENDER'S SIZE. The canvas's width transitions with
    // the panel (G77.1) and the drawing buffer follows its client box, so a
    // transition that does not finish leaves the buffer at whatever it had
    // reached. `transitionend` covers the ordinary case; this covers the ones
    // where the event never arrives — a tab backgrounded across the switch, a
    // second mode change interrupting the first. One timer, once per switch.
    setTimeout(resize, 220);
  }
  function closeEditor() {
    const w = $('edWrap');
    if (w) w.hidden = true;
    setMode(false);
    // ...AND THE AEROPLANE STAYS (G65). Closing the panel used to put the
    // GENERATED model back on the stand in place of the cage build, so hiding
    // the sliders swapped the aeroplane for a different-looking one — the
    // "stand" the flow had to pass through was that swap, and there is no
    // stand any more: this is the hangar, and you are looking at your build.
    applyStand();
  }
  if ($('edClose')) $('edClose').onclick = () => closeEditor();
  if ($('bEdit')) $('bEdit').onclick = () => openEditor();
  // DESIGN / BENCH (G64). Two panes over one 400 px column; #edBar stays on
  // screen in both because how you LOOK at the build is not one of the two
  // things you are choosing between.
  {
    const td = $('tabDesign'), tb = $('tabBench');
    const show = bench => {
      const ui = $('cgUi'), bn = $('edBench');
      if (!ui || !bn) return;
      ui.style.display = bench ? 'none' : '';
      bn.hidden = !bench;
      if (td) td.classList.toggle('on', !bench);
      if (tb) tb.classList.toggle('on', bench);
    };
    if (td) td.onclick = () => show(false);
    if (tb) tb.onclick = () => show(true);
  }
  { // departure + destination selects: spawn anywhere, fly circuit or leg
    const fill = (sel, first, firstLabel, skipId) => {
      sel.innerHTML = '';
      const opt = (v, label) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = label; sel.appendChild(o);
      };
      if (first) opt(first, firstLabel);
      for (const a of world.aerodromes) {
        if (a.kind === 'meadow' || a.id === skipId) continue;
        opt(a.id, `${a.name}${a.flyIn ? ' (fly-in)' : ''}`);
      }
    };
    fill($('selFrom'), null, null, null);
    fill($('selDest'), 'CIRCUIT', '⟳ Circuit', null);
    $('selFrom').onchange = e => { fromId = e.target.value; fullReset(); };
    // W14 multi-hop: picking a new destination AFTER LANDING chains the
    // next leg seamlessly — same sim, no reset, no teleport. The fresh AP
    // taxis back / turns around if the runway left is too short, then
    // departs (into the wind if any). Mid-flight changes still reset.
    $('selDest').onchange = e => {
      destId = e.target.value;
      if (started && ap.phase === 'STOPPED') nextLeg();
      else fullReset();
    };
    function nextLeg() {
      const cur = (ap.route && ap.route.to) || aeroById(fromId);
      if (cur.id) { fromId = cur.id; $('selFrom').value = fromId; }
      telBase += ap.t;                 // new AP restarts its clock at 0
      ap = makeAutopilot(sim, def, world);
      ap.departFrom(cur, destId === 'CIRCUIT' ? cur : aeroById(destId));
    }
  }
  // ---- W13 wind, G72 conditions: presets drive world.setWeather live — no
  // reset needed, the AP flies EAS and takes changes mid-flight. FRESH is
  // beyond the 3 m/s the wind gate validates: sporty on purpose. Direction is
  // fixed (quartering, headwind-ish on a +x landing at HOME).
  //
  // A DAY IS AIR AND WIND. The four standard-day rows carry the wind-only
  // selector's exact vectors and no air at all, so they are the same presets
  // they always were. The two new ones move the AIR: the hot afternoon is the
  // case this whole thing exists for (35 C and a low QNH puts a 420 m
  // backcountry strip at about 1100 m of density altitude), the winter morning
  // is its opposite and is there so the effect can be seen going both ways.
  // `refH: 10` is what makes these SURFACE winds: the number on the label is
  // the windsock's wind, 10 m up, and the air at circuit height is faster
  // (20_world.js). Without it a wind is a uniform column, which is what the
  // fleet's gate battery is still calibrated in.
  const W10 = (base, gust) => ({ base, gust, refH: 10 });
  const CONDITIONS = {
    calm:  { wind: null },
    light: { wind: W10([-1.7, 0, 1.9], 0) },
    mod:   { wind: W10([-2.6, 0, 3.0], 0.5) },
    fresh: { wind: W10([-3.9, 0, 4.6], 0.9) },
    hot:   { oatC: 35, qnhPa: 100800, wind: W10([-2.2, 0, 2.6], 0.7) },
    cold:  { oatC: 0,  qnhPa: 103000, wind: null },
  };
  let windBase = null;
  $('selCond').onchange = e => {
    const c = CONDITIONS[e.target.value] || null;
    world.setWeather(c);
    windBase = c && c.wind ? c.wind.base : null;
    if (WF.setWindVis) WF.setWindVis(windBase);
  };
  $('bPause').onclick = e => {
    running = !running;
    e.target.textContent = running ? 'Pause' : 'Run';
    e.target.classList.toggle('on', !running);
  };
  $('bTel').onclick = e => {
    const on = telWrap.classList.toggle('show');
    e.target.classList.toggle('on', on);
    drawTel();
  };

  const R = ['ias','alt','vs','aoa','bank','agl','thr','de','da','dr','str',
             'tas','oat','dalt','pwr']
    .reduce((o, k) => (o[k] = $('r-' + k), o), {});
  function hud() {
    const o = sim.out, cg = sim.cgPos(), c = sim.ctl, d = ap.dbg;
    // THE LABEL SAYS IAS, so the number is now an indicated one (G72). It read
    // o.V, which is TRUE airspeed — identical at sea level and a lie everywhere
    // else, on the one instrument a pilot would use to decide not to stall.
    R.ias.textContent = ((o.Veas ?? o.V) * 3.6).toFixed(0);
    R.alt.textContent = cg[1].toFixed(0);
    R.vs.textContent = (o.vs >= 0 ? '+' : '') + o.vs.toFixed(1);
    if (!telWrap.classList.contains('show')) return;
    R.aoa.textContent = (o.alpha * 57.3).toFixed(1) + '°';
    R.bank.textContent = ((d.ph || 0) * 57.3).toFixed(1) + '°';
    R.agl.textContent = (d.agl || 0).toFixed(1) + ' m';
    R.thr.textContent = (c.thr * 100).toFixed(0) + '%';
    R.de.textContent = (c.de * 57.3).toFixed(1) + '°';
    R.da.textContent = (c.da * 57.3).toFixed(1) + '°';
    R.dr.textContent = (c.dr * 57.3).toFixed(1) + '°';
    R.str.textContent = (sim.stats().smax * 100).toFixed(2) + '%';
    // the air, and what it costs (G72)
    R.tas.textContent = (o.V * 3.6).toFixed(0) + ' km/h';
    R.oat.textContent = (o.oatC ?? 15).toFixed(0) + ' °C';
    R.dalt.textContent = (o.densityAlt ?? 0).toFixed(0) + ' m';
    R.pwr.textContent = ((o.powerK ?? 1) * 100).toFixed(0) + '%';
  }

  // ---- W13 minimap: baked terrain underlay (from render_world) + live
  // route / aerodromes / aircraft / wind. Redrawn on the HUD cadence.
  // Click the map to toggle small/large; click the top-right chip to
  // switch north-up (whole domain) <-> nose-up (6 km, aircraft-centred).
  let mapBig = false, mapNoseUp = false;
  const NOSE_RANGE = 6000;
  function drawMap() {
    const base = WF.minimap, cv = $('mm');
    if (!base || !cv.getContext) return;
    const g = cv.getContext('2d'), W2 = cv.width, mk = W2 / 344;
    const cg2 = sim.cgPos(), xA = sim.axes()[0];       // nose = -x aft axis
    const hdg = Math.atan2(-xA[2], -xA[0]);
    // shared frame: screen = T(W2/2) . R(rot) . S(k) . T(-c) applied to world xz
    const rot = mapNoseUp ? -Math.PI / 2 - hdg : 0;
    const k = mapNoseUp ? W2 / NOSE_RANGE : W2 / 24000;
    const cx = mapNoseUp ? cg2[0] : 0, cz = mapNoseUp ? cg2[2] : 0;
    const co = Math.cos(rot), si = Math.sin(rot);
    const PX = (x, z) => W2 / 2 + k * ((x - cx) * co - (z - cz) * si);
    const PY = (x, z) => W2 / 2 + k * ((x - cx) * si + (z - cz) * co);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#48899e';                           // beyond-domain reads as sea
    g.fillRect(0, 0, W2, W2);
    g.save();
    g.translate(W2 / 2, W2 / 2); g.rotate(rot); g.scale(k, k); g.translate(-cx, -cz);
    g.drawImage(base, -12000, -12000, 24000, 24000);
    g.restore();
    const from = aeroById(fromId), to = destId === 'CIRCUIT' ? from : aeroById(destId);
    if (to !== from) {
      g.strokeStyle = 'rgba(255,178,87,.85)'; g.lineWidth = 2 * mk; g.setLineDash([5 * mk, 4 * mk]);
      g.beginPath(); g.moveTo(PX(from.x, from.z), PY(from.x, from.z));
      g.lineTo(PX(to.x, to.z), PY(to.x, to.z)); g.stroke();
      g.setLineDash([]);
    }
    g.font = `500 ${Math.round(11 * mk)}px "IBM Plex Sans", sans-serif`;
    for (const a of world.aerodromes) {
      const mead = a.kind === 'meadow';
      const active = a.id === from.id || a.id === to.id;
      const sx = PX(a.x, a.z), sy = PY(a.x, a.z);
      if (sx < -30 || sx > W2 + 30 || sy < -30 || sy > W2 + 30) continue;
      g.beginPath(); g.arc(sx, sy, (mead ? 2.2 : active ? 4.5 : 3.2) * mk, 0, 6.283);
      g.fillStyle = active ? '#ffb257' : mead ? 'rgba(251,244,234,.45)' : 'rgba(251,244,234,.85)';
      g.fill();
      if (active) {
        g.strokeStyle = 'rgba(255,178,87,.5)'; g.lineWidth = 1.5 * mk;
        g.beginPath(); g.arc(sx, sy, 7 * mk, 0, 6.283); g.stroke();
      }
      if (mapBig && !mead) {                           // labels once there's room
        g.fillStyle = 'rgba(20,14,8,.75)';
        g.fillText(a.name, sx + 8 * mk + 1, sy + 4 * mk + 1);
        g.fillStyle = active ? '#ffd9a3' : 'rgba(251,244,234,.9)';
        g.fillText(a.name, sx + 8 * mk, sy + 4 * mk);
      }
    }
    g.save();
    g.translate(PX(cg2[0], cg2[2]), PY(cg2[0], cg2[2]));
    g.rotate(hdg + rot);                               // nose-up: exactly -PI/2 (up)
    g.scale(mk, mk);
    g.fillStyle = '#63d3cc'; g.strokeStyle = 'rgba(20,14,8,.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-4.8, 4.5); g.lineTo(-2.2, 0); g.lineTo(-4.8, -4.5);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
    // wind chip (top-left) — arrow co-rotates with the map frame
    const chip = (x, w) => {
      g.fillStyle = 'rgba(32,24,18,.55)';
      if (g.roundRect) { g.beginPath(); g.roundRect(x, 6 * mk, w, 34 * mk, 8 * mk); g.fill(); }
      else g.fillRect(x, 6 * mk, w, 34 * mk);
    };
    chip(6 * mk, 114 * mk);
    g.font = `600 ${Math.round(17 * mk)}px "IBM Plex Mono", monospace`;
    if (windBase) {
      g.save(); g.translate(24 * mk, 23 * mk);
      g.rotate(Math.atan2(windBase[2], windBase[0]) + rot); g.scale(mk, mk);
      g.strokeStyle = '#ffb257'; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(7, 0); g.stroke();
      g.beginPath(); g.moveTo(2.5, -4.2); g.lineTo(8, 0); g.lineTo(2.5, 4.2); g.stroke();
      g.restore();
      g.fillStyle = '#fbf4ea';
      g.fillText(Math.hypot(windBase[0], windBase[2]).toFixed(1) + ' m/s', 42 * mk, 29 * mk);
    } else {
      g.strokeStyle = 'rgba(251,244,234,.5)'; g.lineWidth = 2 * mk;
      g.beginPath(); g.arc(24 * mk, 23 * mk, 4 * mk, 0, 6.283); g.stroke();
      g.fillStyle = 'rgba(251,244,234,.7)';
      g.fillText('CALM', 42 * mk, 29 * mk);
    }
    // orientation chip (top-right) — its rect is the mode-toggle hit zone
    chip(W2 - 84 * mk, 78 * mk);
    g.fillStyle = 'rgba(251,244,234,.85)';
    g.fillText(mapNoseUp ? 'NOSE↑' : 'N↑', W2 - 74 * mk, 29 * mk);
  }
  $('mm').onclick = e => {
    const cv = $('mm');
    const s = cv.clientWidth ? cv.width / cv.clientWidth : 1;
    const bx = (e.offsetX ?? 0) * s, by = (e.offsetY ?? 0) * s;
    const mk = cv.width / 344;
    if (bx > cv.width - 84 * mk && by < 40 * mk) mapNoseUp = !mapNoseUp;
    else {
      mapBig = !mapBig;
      cv.width = cv.height = mapBig ? 1024 : 344;
      $('mmp').classList.toggle('big', mapBig);
    }
    drawMap();
  };

  setAircraft('pa18');
  syncEnvBtn();               // garage-only buttons start hidden

  // ---- GARAGE bridge. src/viewer/garage.js owns the panel and the paint; this
  // is the only surface it touches. Guarded, so a core-only build still runs.
  if (typeof garageInit === 'function') garageInit({
    defaults: () => JSON.parse(JSON.stringify(GEN_DEFAULT)),
    // a changed spec is a DIFFERENT AEROPLANE, and editing one puts it back on
    // the stand: the solver stops, so a slider drag costs you nothing
    apply(spec) { genSpec = spec; $('selAc').value = 'gen'; setAircraft('gen'); enterGarage(); },
    resolved: () => (curKey === 'gen' ? def.spec : null),
    shake: () => shakeOf(),
    isGen: () => curKey === 'gen',
    inGarage: () => inGarage,
    rollOut: () => { rollOut(); started = true; },
    // BUILD -> LOAD TEST -> FLY. The panel drives the rig and polls it; the
    // rig is the same object GATE LOAD ticks, so the two cannot disagree.
    loadTest: () => startLoadTest(),
    loadTestState: () => loadTestState(),
    endLoadTest: () => endLoadTest(),
    tested: () => rigTested,
  });

  // ---- THE ENGINEERING BENCH bridge (G64). src/viewer/bench.js owns the
  // declared test list and the panel; these are the only handles it gets.
  // Guarded, so a core-only build still runs.
  if (typeof benchInit === 'function') benchInit({
    shake: () => shakeOf(),
    densAlt: () => densAltOf(),
    // the plaque is app.js's to draw (it needs `def`); the bench decides WHEN
    plaque: on => { plaqueLive = !!on; drawPlaque(); },
    // a LIVE test steps the physics model, so it has to be the thing on
    // screen: while the editor panel is open the visible aeroplane is the
    // cage build, and watching the wing bend IS the wing test. The join has
    // just run, so the model wears the build's own snapshot either way.
    // a LIVE test steps the physics model, so it has to be the thing on
    // screen: the aeroplane standing in the room is normally the cage build,
    // and watching the wing bend IS the wing test. Restoring is applyStand's
    // job, so there is one answer to "what is on the stand" and not two.
    showPhysical: on => {
      showCage = !on && !!window.CAGE_UI && inGarage;
      applyStand();
    },
    // the export the bench needs before it measures anything — the same one
    // rolling out uses, so a test and a flight can never read different builds
    sync: () => syncBuild(),
    loadTest: () => startLoadTest(),
    loadTestState: () => loadTestState(),
    endLoadTest: () => endLoadTest(),
    isGen: () => curKey === 'gen',
    inGarage: () => inGarage,
  });

  // ---- THE EDITOR PANEL bridge (G77). src/viewer/editor.js owns the part
  // tree and the inspector; it needs almost nothing from here, because the
  // rows it shows are _cage_ui.js's and the table it shows them by is
  // _cage_parts.js's. What it does need is to say how wide it has become, so
  // the HUD underneath can move over. Guarded, so a core-only build still runs.
  if (typeof editorInit === 'function') editorInit({
    // THE RIGHT PANEL REPORTS ITS WIDTH, and body carries it as the inset the
    // canvas and the floating chrome are laid out against. It is a NUMBER and
    // not a class because two independent folds make four widths, and four
    // classes is three chances to get the fourth wrong. (The LEFT panel has
    // two states, so it stays a class.)
    panelWidth: px => {
      const b = document.body;
      if (b) b.style.setProperty('--ws-right', (px | 0) + 'px');
    },
    // THE FRAMING PRESETS (G78). The rail drives the GAME's orbit camera —
    // the same az/el/dist the mouse drives — by writing its targets, so a
    // preset EASES into place exactly the way a drag does rather than
    // teleporting. The build faces -x (edSit turns the cage's +z-forward onto
    // the room's long axis, door end), so az = PI looks it in the nose and
    // az = 0 sits behind the tail.
    camera: k => {
      if (k === 'r') { edPan.set(0, 0, 0); distT = 14; azT = -2.5; elT = 0.22; return; }
      if (k === 'q') { azT = -2.5; elT = 0.25; distT = 12; edPan.set(0, 0, 0); }
      if (k === 's') { azT = -Math.PI / 2; elT = 0.06; distT = 13; edPan.set(0, 0, 0); }
      if (k === 't') { azT = -Math.PI / 2; elT = 1.35; distT = 15; edPan.set(0, 0, 0); }
      if (k === 'f') { azT = Math.PI; elT = 0.10; distT = 10; edPan.set(0, 0, 0); }
      // COCKPIT is an approximation and says so: the orbit camera cannot sit
      // at the eye point, so this is the closest it gets — in tight, low, and
      // looking forward over the cabin. A real eye-point view wants the crew
      // layer's own marker and a camera that is not an orbit.
      if (k === 'i') { azT = 0.12; elT = 0.16; distT = 4.4; edPan.set(0, 0, 0); }
    },
    isGen: () => curKey === 'gen',
    inGarage: () => inGarage,
  });

  // THE RENDER IS THE FREE ESTATE, NOT THE WHOLE FRAME (G77.1, user: "when
  // the selection bars are open, they should not be considered rendered on
  // top of the 3D content, they should render alongside... the center of
  // orbiting is calculated based on the space available").
  //
  // The editor panel is opaque and 640 px wide. Rendering the full window
  // under it puts the aeroplane's centre behind the properties column: you
  // orbit around a point you cannot see, and the build sits jammed against
  // the panel edge. So the CANVAS ITSELF shrinks — `body.mode-ws` insets it by
  // the panel's width — and everything else follows for free, because
  // `camera.lookAt(target)` centres the target in the CANVAS. Nothing about
  // the orbit, the pan or the room clamp had to learn about the panel.
  //
  // The buffer is sized from the canvas's own client box rather than from
  // `window.innerWidth`, which is what makes that true; and a ResizeObserver
  // drives it, so the render follows the panel's 160 ms fold instead of
  // snapping at the end of it.
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined')
    new ResizeObserver(resize).observe(canvas);
  // ...and once more when the fold finishes. The observer tracks the
  // intermediate widths, but only while frames are being produced: a tab that
  // is backgrounded mid-transition throttles both, and the buffer must not be
  // left at whatever size the animation had reached when the lights went out.
  canvas.addEventListener('transitionend', resize);
  resize();

  let frame = 0, wdFrame = 0;
  function loop() {
    requestAnimationFrame(loop);
    if (inGarage) {
      // CONTROL CHECK. The solver is stopped in the garage, so every control
      // sits at zero and the surfaces never move — which reads as "the surfaces
      // do not work" even when they do. Sweep them instead, the way you would
      // walk a control check before flight: four different periods so nothing
      // syncs up and each surface can be watched on its own. Physics is off, so
      // writing ctl here has no consequence, and roll-out zeroes it in reset().
      const tS = frame / 60;
      sim.ctl.de = 0.30 * Math.sin(tS * 0.90);
      sim.ctl.da = 0.35 * Math.sin(tS * 0.62 + 1.0);
      sim.ctl.dr = 0.35 * Math.sin(tS * 0.45 + 2.0);
      sim.ctl.flap = 0.5 - 0.5 * Math.cos(tS * 0.33);
    }
    // the garage does not step — EXCEPT on the load-test rig, which is the one
    // thing that moves while the aeroplane is still on the stand
    if (inGarage && rig && !rig.state.done) {
      rig.step(1 / 60);
      // the RIG decides the build has been tested, not the panel. The panel is a
      // view; if it were the thing that noticed, a headless run (or a collapsed
      // panel) would leave a tested aeroplane marked untested.
      if (rig.state.done) rigTested = true;
      updateLoadViz(rig);
    }
    // held at ultimate: the bags stay on and the wing stays bent, so the result
    // is still there to look at rather than snapping back the frame it finishes
    else if (inGarage && rig) updateLoadViz(rig);
    else if (running && !inGarage) {
      script(1 / 60);
      sim.step(1 / 60);              // substep rate is a per-aircraft property
      if (++wdFrame % 30 === 0 && !Number.isFinite(sim.p[1])) {
        running = false;
        $('phName').textContent = 'SIM DIVERGED — RESET';
      }
    }
    const cg = sim.cgPos();
    // The world does not exist while you are in the garage, so it is not
    // updated: no terrain paging, no sky, no weather, no LOD churn. That is
    // most of what the garage used to spend its frame on for scenery nobody
    // could see anyway.
    if (!inGarage) WF.worldUpdate(cg);
    else if (hangar && garageIsHangar()) hangar.faceShafts(camera);
    // the orbit centre: the EDITOR'S build when it is open (G39 — the
    // per-frame cg overwrite silently un-centred it), the craft otherwise;
    // the editor's pan offset rides on top (G41)
    if (edSit.visible) target.copy(edTarget).add(edPan);
    else target.set(cg[0], cg[1], cg[2]);
    // ease the orbit toward its targets (see the G39 note at the top);
    // snap the last hair so it settles instead of drizzling
    az += (azT - az) * 0.28; if (Math.abs(azT - az) < 1e-4) az = azT;
    el += (elT - el) * 0.28; if (Math.abs(elT - el) < 1e-4) el = elT;
    dist += (distT - dist) * 0.28;
    if (Math.abs(distT - dist) < 1e-3) dist = distT;
    placeCamera();
    // (The part callout used to be re-projected here every other frame. It is
    // gone — it sat on the one thing it was naming — and the frame loop got
    // its projection back.)
    sync();
    poseModel();
    if (++frame % 6 === 0) { hud(); drawMap(); if (telWrap.classList.contains('show')) drawTel(); }
    renderer.render(inGarage ? garageScene() : scene, camera);
    if (frame === 1) dismissBoot();     // first real frame is on screen
  }
  // Boot splash (body.html #boot): drop it once something is actually drawn.
  // Guarded so the headless UI-smoke harness, which has no such element, and
  // a second call from the loop are both no-ops.
  function dismissBoot() {
    const b = document.getElementById('boot');
    if (!b || b.classList.contains('gone')) return;
    b.classList.add('gone');
    setTimeout(() => b.parentNode && b.parentNode.removeChild(b), 600);
  }
  // ---- THE GAME OPENS ON YOUR OWN AEROPLANE (G67.1) ------------------------
  // It used to open on the PA-18, parked on an apron. That was right while the
  // imported meshes were the only aeroplanes with a skin on them; it stopped
  // being right at G45, when a design could be built and flown, and it became
  // actively misleading at G67, when the thing you build started wearing real
  // materials and the thing you booted into did not.
  //
  // So the first thing on screen is the aeroplane you are building, in the
  // room you build it in — and the PA-18 and the C172 take the role the
  // 2026-08-08 scope decision gave them: measuring sticks in the rack, one
  // selection away.
  //
  // IT RUNS LAST, after every bridge above has been wired, because opening the
  // editor is not a small thing: it boots the cage bundle, the four layers, the
  // hangar's own panel section and the part tree, and each of those expects the
  // room, the mount and the garage handle to exist. This is also the point that
  // pays the cost the LAZY boot was deferring — deliberately, because "later"
  // is now "at boot" and the loading screen is the honest place for it.
  //
  // AND IT FALLS BACK. If any of that throws, the game still opens — on the
  // PA-18, on the apron, exactly as it did — with the error in the console
  // rather than a black screen. A boot path is the one place where a partial
  // failure must not be fatal.
  try {
    const sel = $('selAc');
    if (sel) sel.value = 'gen';
    setAircraft('gen');
    enterGarage();
    openEditor();
    // ...AND THE AEROPLANE BEHIND THE CAGE IS THE CAGE. Until now the first
    // build of a session had no snapshot, so `buildModel('gen')` fell back to
    // genSkin (G46's declared "absent a snapshot ... the generated skin flies
    // as before") — invisible in the garage, where the editor's own meshes are
    // what you look at, and the reason a roll-out was the first moment the two
    // agreed. Committing at boot is the same step roll-out takes, taken once
    // more, and it is what lets the old generated skin stop being a thing the
    // game can fall back into.
    syncBuild();
  } catch (err) {
    console.error('cage boot:', err);
    try { const sel = $('selAc'); if (sel) sel.value = 'pa18';
          setAircraft('pa18'); } catch (e2) {}
  }
  hud();
  loop();
})();
