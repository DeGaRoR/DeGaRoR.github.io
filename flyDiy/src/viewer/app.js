(() => {
  const world = makeWorld();
  // `gen` is the GARAGE: not a fiche but a generator, rebuilt from a live spec
  // (src/core/6x_gen_*.js). `window.GARAGE_SPEC` is the editor's handle on it —
  // and it is now actually ASSIGNED, in garage.js. This comment claimed it from
  // G3 while nothing ever set it, which is how a build ended up reachable only
  // from inside a closure and a user lost an aeroplane to a reload. See G7.
  let genSpec = null;
  // ONE AEROPLANE (2026-09-05). The hand-written fleet — pa18, cub, drone,
  // dc3, jojo, c172, chnk — retired with its fiches; every vessel is a garage
  // build. The map and the `key` plumbing stay because the aircraft change
  // door (setAircraft) is the one path a rebuilt spec comes through.
  const AIRCRAFT = { gen: () => buildGen(genSpec) };
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
  // THE RESOLVE PASS (G144) takes the main render off the default framebuffer
  // so it can have eight MSAA samples instead of the four `antialias: true`
  // hands out, a downsample filter that is ours rather than the compositor's,
  // and somewhere to put the dither the fuselage flank needs. It degrades to
  // `renderer.render` on anything that cannot carry it, and `antialias: true`
  // above stays exactly for that case. src/viewer/aa_resolve.js has the whole
  // argument and the measurements behind it.
  //
  // `setPixelRatio` STAYS WHERE IT IS. It is not the supersampling lever any
  // more — the pass is — but it still decides how big the drawing buffer is on
  // a high-dpr screen, and the pass sizes itself from THAT rather than from CSS
  // pixels, so the two multiply instead of fighting.
  const aa = (typeof AA_RESOLVE !== 'undefined' && AA_RESOLVE)
    ? AA_RESOLVE.make(THREE, renderer)
    : (typeof window !== 'undefined' && window.AA_RESOLVE)
      ? window.AA_RESOLVE.make(THREE, renderer) : null;
  if (typeof window !== 'undefined') window.FLYDIY_AA = aa;
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
  // ---- INSIDE THE AEROPLANE (G107) --------------------------------------
  // `edEye` is the pilot's own eye point, or null. When it is set the orbit
  // pivots about a point a short way in FRONT of the eyes rather than about
  // the whole build's bounding centre, so turning the mouse reads as looking
  // around from the seat — which is the closest an orbit camera gets to a
  // head, and app.js's own G78 comment said so and left it unbuilt.
  //
  // THREE CLAMPS COME OFF WITH IT, and each was right for the thing it was
  // written about and wrong here: the polar limit (an exterior subject is
  // never looked at from underneath), the 4 m minimum radius (an exterior
  // subject is never that close), and the ROOM clamp — which keeps the eye
  // off the shed's walls and would happily push a camera that is already
  // inside a fuselage out through one. The user asked to "let the mouse orbit
  // freely" and this is what was stopping it.
  //
  // THE NEAR PLANE MOVES TOO. It is 0.5 m for a hangar, which is further away
  // than the instrument panel.
  let edEye = null;
  // ...AND THE SAME EYE IN FLIGHT (the flight rebaseline). The `camera`
  // flyout's `cockpit` is not a second implementation: it is this one, pointed
  // at the aeroplane that is flying instead of the one on the stand. What
  // differs is only the FRAME the eye has to be expressed in — see flyEyeAt()
  // down with the flight interface, which walks the crew layer's published
  // world point through the same cage -> model mapping the snapshot uses.
  let flyEye = null;
  const CAM_NEAR = 0.5, EYE_NEAR = 0.035, EYE_PIVOT = 0.35;
  const edEyeOn = () => !!(edEye || flyEye);
  function setNear(n) {
    if (camera.near === n) return;
    camera.near = n;
    camera.updateProjectionMatrix();
  }
  // the pilot's own head, hidden while you are looking out of it. The crew
  // layer hands the bones over (window.CAGE_CREW_EYE) rather than this file
  // learning a skeleton, and the layer is rebuilt on every edit — so what is
  // remembered is the flag, and it is re-applied from the live list.
  let edHidHeads = [];
  function showHeads(on) {
    for (const h of edHidHeads) h.visible = on;
    if (on) edHidHeads = [];
  }
  // NO PILOT, NO INTERIOR VIEW. The crew layer is a switch on the aeroplane,
  // so the rail DISABLES the preset rather than this putting a camera at the
  // origin and calling it a cockpit — see buildCamera, which asks the same
  // published object.
  //
  // `aim` is the whole difference between entering and following. Entering
  // points the camera where the pilot is looking; following must NOT, because
  // the crew layer is rebuilt on every edit and re-aiming on every pixel of a
  // slider drag would rip the view out of your hands.
  function applyInterior(aim) {
    const E = window.CAGE_CREW_EYE;
    if (!E || !E.p) return false;
    const eye = new THREE.Vector3().fromArray(E.p);
    const fwd = new THREE.Vector3().fromArray(E.fwd || [0, 0, 1]);
    if (fwd.lengthSq() < 1e-9) fwd.set(0, 0, 1);
    fwd.normalize();
    // THE PIVOT IS IN FRONT OF THE EYES, not at them. An orbit of radius zero
    // has no direction to place a camera along and lookAt(self) is degenerate;
    // a pivot an arm's length ahead puts the camera AT the eye to begin with
    // and turns the aeroplane around you when you drag.
    edEye = eye.clone().addScaledVector(fwd, EYE_PIVOT);
    if (aim) {
      // the inverse of placeCamera, so the first frame IS the pilot's view
      // rather than a guess at it
      const back = fwd.clone().negate();
      elT = el = Math.asin(Math.max(-1, Math.min(1, back.y)));
      azT = az = Math.atan2(back.z, back.x);
      distT = dist = EYE_PIVOT;
      edPan.set(0, 0, 0);
    }
    setNear(EYE_NEAR);
    showHeads(true);                     // the previous build's, now stale
    edHidHeads = (E.heads || []).filter(h => h && h.visible);
    for (const h of edHidHeads) h.visible = false;
    return true;
  }
  function enterInterior() { applyInterior(true); }
  // the build changed under the camera: the eyes moved and the head that was
  // hidden was thrown away with the rest of the layer
  function refreshInterior() { if (edEye) applyInterior(false); }
  function exitInterior() {
    if (!edEye) return;
    edEye = null;
    showHeads(true);
    setNear(CAM_NEAR);
    distT = dist = 12; azT = az = -2.5; elT = el = 0.25;
  }
  function placeCamera() {
    let x = target.x + dist * Math.cos(el) * Math.cos(az),
        y = Math.max(0.4, target.y + dist * Math.sin(el)),
        z = target.z + dist * Math.cos(el) * Math.sin(az);
    if (edEye || flyEye) { camera.position.set(x, y, z); camera.lookAt(target); return; }
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

  // ---- prefs, and the player's own document --------------------------------
  // The guarded-LS trio lives ABOVE the world build so the player's document
  // can be read before anything is standing: the world's shed takes its size
  // from it. (This file has warned three times that prefGet used to live in a
  // temporal dead zone at eval; hoisting the trio here is the fix, not a
  // fourth warning.) A viewer preference is still not part of the aeroplane —
  // it does NOT go in the spec, so it never lands in a saved build.
  const PREF = (() => {
    try { return window.localStorage; } catch (e) { return null; }
  })();
  const prefGet = (k, d) => { try { const v = PREF && PREF.getItem(k); return v == null ? d : v; }
                              catch (e) { return d; } };
  const prefSet = (k, v) => { try { if (PREF) PREF.setItem(k, v); } catch (e) {} };

  // THE PLAYER (HANGARS S1): the player's property as ONE document under one
  // key — its own version and migrator walk beside the spec's (70_player.js).
  // flydiy.hangarDims / flydiy.hangarParts are LIFTED once into it and never
  // written again; the old keys stay in place (an older cached build may
  // still read them) but this build's write path is the document alone. View
  // state — hangarMobile, hangarEnvSrc, garageMood, groundShadow — stays a
  // pref: view state never flies, and view state is not property (G106).
  const PLAYER_KEY = 'flydiy.player';
  let player = null;
  function playerLoad() {
    if (player) return player;
    let doc = null;
    try { doc = JSON.parse(prefGet(PLAYER_KEY, 'null')); } catch (e) {}
    if (!doc) {                              // the one-time lift
      let dims = null, parts = null;
      try { dims = JSON.parse(prefGet('flydiy.hangarDims', 'null')); } catch (e) {}
      try { parts = JSON.parse(prefGet('flydiy.hangarParts', 'null')); } catch (e) {}
      doc = playerLift(dims, parts);
    }
    player = playerNormalise(playerMigrate(doc));
    // persist what the first load decided — a lift that is only re-run every
    // boot would keep reading prefs that may go stale under it, and a
    // migrated document should not need migrating twice
    playerSave();
    return player;
  }
  function playerSave() { if (player) prefSet(PLAYER_KEY, JSON.stringify(player)); }
  const shedHome = () => playerLoad().sheds.HOME;

  // THE WORLD'S SHED IS THE PLAYER'S SHED (HANGARS S1). The site declares
  // where it stands and what the class measures; the player's record carries
  // what the sliders made of it; the composition is handed in — the record
  // is passed rather than looked up, G123's own ruling — so the building you
  // taxi past and the room you stand in are the same size by construction.
  const WF = buildWorldScene(scene, world, renderer, camera,
    Object.assign({ shell: shedHome().shell },
      playerShedDims(playerLoad(), 'HOME',
        (typeof siteOf === 'function') ? siteOf('HOME') : null)));

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
  // THE SHED'S OWN SIZE (G53, rehomed by HANGARS S1). Half-width, half-depth
  // and eaves height in metres, and PROPERTY now, not a preference: it lives
  // on the player's shed record (playerLoad), absent meaning "whatever the
  // shell's own default is", which is what a fresh profile gets. The envelope
  // the sliders may drag over is the SHELL's (26_hangar_fit.js) — a timber
  // field shed's eave floor is below a steel shed's.
  const dimLims = () => (typeof shellLims === 'function')
    ? shellLims(shedHome().shell)
    : { HW: [7, 24], HD: [6, 20], EAVE: [4.2, 11] };
  let envRT = null, envPM = null;
  // whether the aeroplane contributes to the room's own reflection probe. Off
  // is correct (see the bake) and is the default; the switch is for tests.
  // READ AT FIRST BUILD, not here: prefGet is declared further down and this
  // line runs at module eval, which is inside its temporal dead zone. The
  // file already carries that warning twice; this is the third time it bit.
  let craftInProbe = false;
  // the sky's own PMREM, kept beside envPM and disposed on the same discipline:
  // PMREMGenerator.dispose() frees its ping-pong target, never the one it hands
  // back, and a mood change re-bakes.
  let skyPM = null;
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
    // ---- THE OUTDOORS IS LIT BY THE SKY, NOT BY THE SHED (G123) ----------
    // scene.environment is one texture for the whole room, and the room's is a
    // cube probe taken INSIDE it: warm sheet steel, warm lamps, a warm floor.
    // Every surface the garage added outside the door — apron, taxiway, strip,
    // field and the grass tufts — was picking that up, and a neutral concrete
    // slab standing in daylight rendered brown because of it.
    //
    // A per-material envMap overrides scene.environment, so the outdoor list
    // the room declares gets a PMREM of the SKY instead. When the room is
    // already using the sky as its environment there is nothing to do and the
    // same target is reused rather than baked twice.
    if (hangar.outdoorMats && hangar.outdoorMats.length) {
      let srt = skyReady ? rt : null;
      if (!srt && sky && sky.image && sky.image.width && THREE.PMREMGenerator) {
        const pm2 = new THREE.PMREMGenerator(renderer);
        pm2.compileEquirectangularShader();
        srt = pm2.fromEquirectangular(sky);
        pm2.dispose();
        if (skyPM && skyPM !== srt) skyPM.dispose();
        skyPM = srt;
      }
      for (const m of hangar.outdoorMats) {
        if (!m) continue;
        m.envMap = srt ? srt.texture : null;
        m.needsUpdate = true;
      }
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
      const shed = shedHome();
      // THE ROOM IS HANDED THE AERODROME (G123). Its outdoors is the base
      // field — the same apron, taxiway and strip the world scene lays down —
      // and the runway comes from the registry record rather than from a
      // second copy of the numbers. hangar.js has no world of its own, so the
      // record is passed rather than looked up; without it the room simply
      // draws no strip, the way it draws no props without the library. The
      // KITS ride in the same way (HANGARS S2): the player's shed record says
      // what the room is equipped with, and the fit engine does the placing.
      hangar = genHangarBuild(THREE, shed.dims || undefined,
        { home: world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0],
          kits: shed.kits, shell: shed.shell });
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
      // the part system (G41, rehomed by HANGARS S1): the shell's default
      // dress first, then every part's saved dress off the player's record —
      // a class default the player's own choices always win over.
      if (hangar.setPart) {
        const shellRec = (typeof SHELLS !== 'undefined' && SHELLS[shed.shell])
          ? SHELLS[shed.shell] : null;
        if (shellRec && shellRec.skin)
          for (const k in shellRec.skin)
            hangar.setPart(k, Object.assign({ rough: 1, nrm: 1 },
                                            shellRec.skin[k]));
        const saved = shed.parts || {};
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
    const L = dimLims();
    for (const k in L)
      if (d && typeof d[k] === 'number')
        next[k] = Math.max(L[k][0], Math.min(L[k][1], d[k]));
    const shed = shedHome();
    shed.dims = next;
    playerSave();
    disposeHangar();
    if (inGarage) applyEnv();
    // the world's shed follows the same record, live — dragging the slider
    // resizes the building you will taxi past, not just the room you are in
    if (WF && WF.setShedDims)
      WF.setShedDims(Object.assign({ shell: shedHome().shell },
        playerShedDims(player, 'HOME',
          (typeof siteOf === 'function') ? siteOf('HOME') : null)));
    return getHangar() ? hangar.dims : null;
  }

  // ---- which room, and its mood -------------------------------------------
  // The prefs trio (PREF/prefGet/prefSet) lives at the top of the function
  // now, above the world build — the player's document is read before the
  // first scene stands. The rule it carried is unchanged: a viewer preference
  // is not part of the aeroplane and never lands in a saved build.
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
    shedHome().parts = all;          // property, not a pref (HANGARS S1)
    playerSave();
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
    dimLimits: () => dimLims(),
    setDims: setDims,
    // THE SHELL (HANGARS S2/S3): what the building IS. Choosing one adopts
    // its class dims explicitly (the sliders then start from there) and
    // rebuilds; the player's per-part dress carries over — their choices
    // always win over a class default.
    shells: () => (typeof SHELLS !== 'undefined')
      ? Object.keys(SHELLS).map(k => ({ key: k, name: SHELLS[k].name,
                                        status: SHELLS[k].status }))
      : [],
    shell: () => shedHome().shell,
    setShell: k => {
      if (typeof SHELLS === 'undefined' || !SHELLS[k] ||
          SHELLS[k].status !== 'live') return null;
      const shed = shedHome();
      if (shed.shell === k) return k;
      shed.shell = k;
      shed.dims = Object.assign({}, SHELLS[k].dims);
      playerSave();
      disposeHangar();
      if (inGarage) applyEnv(); else getHangar();
      if (WF && WF.setShedDims)
        WF.setShedDims(Object.assign({ shell: shedHome().shell },
          playerShedDims(player, 'HOME',
            (typeof siteOf === 'function') ? siteOf('HOME') : null)));
      return shed.shell;
    },
    // THE FIT-OUT (HANGARS S2): which kits stand in the room. A toggle is a
    // rebuild — the setDims idiom, and the same cost. `park` is the shed
    // itself and is not offered as a checkbox.
    kits: () => {
      if (typeof HANGAR_KITS === 'undefined') return [];
      const on = new Set(shedHome().kits);
      return HANGAR_KITS_DEFAULT.filter(k => k !== 'park')
        .map(k => ({ key: k, name: HANGAR_KITS[k].name, on: on.has(k) }));
    },
    setKit: (k, on) => {
      if (typeof HANGAR_KITS === 'undefined' || !HANGAR_KITS[k] ||
          k === 'park') return null;
      const shed = shedHome();
      const cur = new Set(shed.kits);
      if (on !== false) cur.add(k); else cur.delete(k);
      shed.kits = HANGAR_KITS_DEFAULT.filter(x => cur.has(x) || x === 'park');
      playerSave();
      disposeHangar();
      if (inGarage) applyEnv(); else getHangar();
      return shed.kits.slice();
    },
    // what the last build could not place, and never silently (§4.3)
    fitReport: () => (getHangar() && hangar.fitReport)
      ? hangar.fitReport : null,
    // the verbs this shed has earned — derived, advisory, never enforced
    caps: () => (typeof hangarCaps === 'function')
      ? hangarCaps(shedHome()) : [],
    // ...and what the current BUILD wants of one, read off its resolved
    // spec's declared constructions (HANGARS S5). The engineer's handbook,
    // never a guardrail: nothing anywhere enforces this (P5 owns that
    // ruling, and an unconsidered enforcement is a game nobody can play).
    wants: () => {
      try {
        const R = (window.GARAGE_SPEC && window.GARAGE_SPEC.resolved)
          ? window.GARAGE_SPEC.resolved() : null;
        return (R && typeof hangarWants === 'function') ? hangarWants(R) : [];
      } catch (e) { return []; }
    },
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
    lampRigDefault: () => (getHangar() && hangar.lampRigDefault)
      ? hangar.lampRigDefault() : null,
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
    groundBounceDefault: () => (window.LIGHT_RIG && window.LIGHT_RIG.groundBounceDefault)
      ? window.LIGHT_RIG.groundBounceDefault() : null,
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

  // ================= 3d skin: the baked payloads =================
  // Model frame is (x aft, y up, z left), RH. Every payload here is a
  // REFERENCE plane for refplane.js since the fleet retired (2026-09-05):
  // the PA-18 and the C172 still carry the rigging they were baked with
  // (tools/model_prep.py) but nothing flies them any more.
  const MODELS3D = {};
  if (typeof MODEL_PA18 !== 'undefined') MODELS3D.pa18 = MODEL_PA18;
  if (typeof MODEL_C172 !== 'undefined') MODELS3D.c172 = MODEL_C172;
  // REFERENCE-ONLY payloads (G138, tools/ref_prep.py). They join the same map
  // because MODEL_DECODE — the one decode that owns the b64 drop — reads this
  // map and refplane.js goes through it. They carry `ref:1`, no surfaces and
  // no hub, so nothing here can fly one: buildModel would find no `skin` group
  // to mount and SKIN_CFG has no row for them. They never reach the aircraft
  // select either, which is populated from body.html, not from this map.
  // Each guard is its own line because MANIFEST.models decides which payloads
  // the artifact actually carries, and a missing one must be a preset that
  // shows nothing rather than a page that does not boot.
  if (typeof MODEL_D112 !== 'undefined') MODELS3D.d112 = MODEL_D112;
  if (typeof MODEL_PIO200 !== 'undefined') MODELS3D.pio200 = MODEL_PIO200;
  if (typeof MODEL_C195 !== 'undefined') MODELS3D.c195 = MODEL_C195;
  // a22/p68/rv8/sr22 deleted 2026-09-01 (SKETCHFAB Standard — see ref_table.py)
  // the second batch (G142)
  if (typeof MODEL_DA40 !== 'undefined') MODELS3D.da40 = MODEL_DA40;
  if (typeof MODEL_G115 !== 'undefined') MODELS3D.g115 = MODEL_G115;
  if (typeof MODEL_STEMME !== 'undefined') MODELS3D.stemme = MODEL_STEMME;
  if (typeof MODEL_GUEPARD !== 'undefined') MODELS3D.guepard = MODEL_GUEPARD;
  if (typeof MODEL_YAK18T !== 'undefined') MODELS3D.yak18t = MODEL_YAK18T;
  if (typeof MODEL_EIII !== 'undefined') MODELS3D.eiii = MODEL_EIII;
  if (typeof MODEL_PA28 !== 'undefined') MODELS3D.pa28 = MODEL_PA28;
  // skin config per aircraft key: body-frame mount offset + binding thresholds
  // (SKIN-PROC.md). Only the garage build is left (the pa18/c172 rows — a
  // measured mount offset and, for the c172, five rigged groups — retired with
  // the fleet, 2026-09-05). The generated skin is built FROM the sim's own
  // node positions, in the sim's own body frame, so there is no mount to
  // calibrate: the offset is zero by construction, not by measurement.
  const SKIN_CFG = {
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
  // THE BYTES ARE EXTERNAL NOW (2026-09-01): a payload names its geometry file
  // (payload.bin, under media/geo/models/) and MODEL_LOAD is the one place
  // that fetches it. MODEL_DECODE keeps its old synchronous contract — decoded
  // groups or null — where null now also means "still on the wire": callers
  // that can wait call MODEL_LOAD and try again when it resolves.
  const binCache = {}, loadCache = {};
  window.MODEL_DECODE = key => {
    if (decCache[key]) return decCache[key];
    const d = MODELS3D[key];
    if (!d || !d.groups) return null;
    if (d.bin && !binCache[key]) return null;   // not warmed — MODEL_LOAD owns the fetch
    const out = decodeModel(d, binCache[key]);
    for (const g in d.groups) d.groups[g].b64 = null;
    delete binCache[key];                        // decoded arrays are the keeper now
    return (decCache[key] = out);
  };
  // MODEL_LOAD(key) -> Promise<decoded groups | null>. Warms the bin through
  // ASSET_FETCH (one request per file, page-lifetime cache there too), then
  // decodes through the ONE decode above. Null means what it means at
  // MODEL_DECODE: no such payload, or nothing to fetch it with (the node
  // gates' sandbox has no ASSET_FETCH, and their answer is fs, not this).
  window.MODEL_LOAD = key => {
    if (decCache[key]) return Promise.resolve(decCache[key]);
    const d = MODELS3D[key];
    if (!d || !d.groups) return Promise.resolve(null);
    if (!d.bin) return Promise.resolve(window.MODEL_DECODE(key));
    if (typeof window.ASSET_FETCH !== 'function') return Promise.resolve(null);
    if (loadCache[key]) return loadCache[key];
    return (loadCache[key] = window.ASSET_FETCH(d.bin).then(buf => {
      binCache[key] = buf;
      return window.MODEL_DECODE(key);
    }).catch(e => {
      if (window.console) console.warn('model ' + key + ' failed to load:',
                                       e && e.message);
      return null;
    }));
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
  // THE AEROPLANE'S GLASS SORTS ABOVE THE GROUND IT FLIES OVER (the user:
  // "issue with the wing `cut lamps` material. It does not show when rendered
  // on top of the strip. It shows when rendered on top of the other surfaces
  // though").
  //
  // WHY THE STRIP AND NOT THE FIELD. three.js draws every transparent object
  // after every opaque one and sorts them by renderOrder first. Open country
  // is TERRAIN — opaque, drawn in the opaque pass, done before the aeroplane's
  // glass is reached. The aerodrome is not: its grass patch (renderOrder 2)
  // and its runway sheet (renderOrder 3) are `transparent, depthWrite:false`
  // DECALS laid over that terrain, because the patch has to fade at its edges
  // (render_world.js says so in as many words). The flown aeroplane's groups
  // took `RENDER_ORDER[name] || 0` — which is 0 for anything not named
  // `covers` or `glass` — so the runway was drawn AFTER the lens.
  //
  // AND NOTHING STOPPED IT, because the depth test had nothing to reject it
  // with: the wing is REALLY CUT at the lamp bay, the lens itself is
  // depthWrite:false like all glass, and looking down through the bay the ray
  // misses the interior cage's aft wall. No opaque fragment, no depth, no
  // rejection — the strip painted straight over the pane. Over open country
  // there is no transparent decal to do it, which is exactly the difference
  // the screenshot shows.
  //
  // A BAND, not a bigger number. The world's decals live in single digits
  // (`Math.round(y * 100)` on a few centimetres of height); the SUBJECT gets
  // its own thousand, so a new decal at any plausible height still cannot
  // reach it, and the aeroplane's own internal order is preserved inside the
  // band rather than flattened.
  const AERO_CLEAR = 1000;
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
    let dec;
    if (data.cage || data.generated) dec = data.groups;
    else {
      dec = window.MODEL_DECODE(key);
      if (!dec && data.bin && window.MODEL_LOAD) {
        // the geometry is still on the wire: fly the truss for now, and when
        // the bytes land re-enter the same door the dropdown uses — IF this
        // aeroplane is still the one selected and nothing built it meanwhile.
        // A null resolve (fetch failed, or a fetchless sandbox) retries
        // nothing: the aeroplane is absent, not late.
        window.MODEL_LOAD(key).then(d2 => {
          if (d2 && curKey === key && !modelCache[key]) setAircraft(key);
        });
        return null;
      }
      if (!dec) dec = decodeModel(data);
    }
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
              // THE FLOWN AEROPLANE IS PAINTED LIKE THE EDITOR'S (G108). Two
              // arguments were missing and both mattered to the markings: the
              // surface CLASS, without which every flown surface was a
              // fuselage, and the LATERAL AXIS, which is z in the model frame
              // and x in the cage — `uSideAxis` has documented that since G69
              // and no caller ever passed it, so the far flank was mirrored
              // about the wrong axis on everything that flew.
              wing: m.wing || 0,
              // the dialled deviations (G113): tile/roughness/normal
              // multipliers, the tail's metric rib pitch and the part's own
              // ageing rate — absent means the finish's defaults, exactly
              // as in the editor. Without these a dialled section flew with
              // the factory numbers.
              tileK: m.tileK, roughK: m.roughK, nrmK: m.nrmK,
              ribM: m.ribM, wearK: m.wearK, wearM: m.wearM,
              side: THREE.DoubleSide });
      }
      // ...AND SO ARE THE TANKS AND THE PACKS (2026-09-04, user: "the fuel
      // tank material does not seem to make it in game — red in the editor,
      // white in the flight interface"). They are the second family in a cage
      // payload with a factory of its own, and they took the fall-through
      // below: a flat colour and two scalars. That is not what a tank looks
      // like — the red was the SCANNED SHEET, tinted and hue-rotated — so a
      // painted shell flew as its multiplier, which for the factory colour is
      // plain white. Same answer as AEROSKIN's above, from the same door: the
      // payload names the SET and the hue, `color` carries the tint, and the
      // energy layer's own factory rebuilds the material the editor drew.
      // (The uv comes with it — the snapshot carries a vessel bucket's real
      // metre-true uv where the rest of the cage has none.)
      if (data.cage && m.ves && window.CAGE_ENERGY &&
          window.CAGE_ENERGY.material)
        return matCache[mn] = window.CAGE_ENERGY.material({
          set: m.ves, tint: m.color, hueRad: m.vesHue || 0,
          hueOn: !!m.vesHueOn });
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
      // the payload's own declaration of what is see-through is `opacity < 1`
      // — the same fact `castShadow` below already reads
      const clear = !!(mats[name] && mats[name].opacity < 1);
      mesh.renderOrder = (RENDER_ORDER[name] || 0) + (clear ? AERO_CLEAR : 0);
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
    const engRigs = [], strutRigs = [];                              // G179.2
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
      // G148: THE REST IS COMPUTED, NEVER CAPTURED (G145's lesson, on the
      // gear). A rig's rest = its node's DESIGN position through the exact
      // projection nodeLocal applies per frame, so zero load reads zero
      // delta on frame 1 and after every fullReset. The old lazy
      // `rest0 = first posed frame's L` froze that frame's settling into
      // the rig for the model's whole life — and fullReset never cleared
      // it.
      const toB = defBodyProject(curDef);
      const offX = (data.off && data.off[0]) || 0,
            offY = (data.off && data.off[1]) || 0;
      const nodeRest = idx => { const q = toB(curDef.nodes[idx].p);
        return [q[0] - offX, q[1] - offY, q[2]]; };
      // G179.2: which physics engine node(s) a drawn unit rides — by the
      // SIGN of its z (G58.3's rule), both nodes of a centreline unit
      const engNodesFor = z => {
        const E = curDef.refs.engine || [];
        if (Math.abs(z) < 0.05) return E.slice();
        const same = E.filter(i => (curDef.nodes[i].p[2] >= 0) === (z >= 0));
        return same.length ? same : E.slice();
      };
      const meanRest = idxs => { const o = [0, 0, 0];
        for (const i of idxs) { const q = nodeRest(i);
          o[0] += q[0] / idxs.length; o[1] += q[1] / idxs.length; o[2] += q[2] / idxs.length; }
        return o; };
      const dSeg2 = (v, a, b) => {
        const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
        const ap = [v[0]-a[0], v[1]-a[1], v[2]-a[2]];
        const L2 = ab[0]*ab[0] + ab[1]*ab[1] + ab[2]*ab[2] || 1e-9;
        const t = (ap[0]*ab[0] + ap[1]*ab[1] + ap[2]*ab[2]) / L2;
        const tc = Math.max(0, Math.min(1, t));
        const qx = ap[0]-ab[0]*tc, qy = ap[1]-ab[1]*tc, qz = ap[2]-ab[2]*tc;
        return [qx*qx + qy*qy + qz*qz, t];
      };
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
          // ...and it rides the same node as its engine (G179.2)
          { const idxs = engNodesFor(pt.pivot[2]);
            if (idxs.length) engRigs.push({ obj: pg, idxs, pivot: pt.pivot,
                                            rest0: meanRest(idxs) });
            // G194: which ENGINE this prop belongs to, off the node it rides
            // (refs.engineOf), so its spin follows that engine's own lever
            const EO = curDef.refs.engineOf || [];
            const j = idxs.length ? curDef.refs.engine.indexOf(idxs[0]) : -1;
            pg.userData.engIdx = j >= 0 && EO[j] != null ? EO[j] : 0; }
        }
        else if (pt.kind === 'liftstrut' && pt.members && pt.members.length &&
                 curDef.parts && curDef.parts.wf) {
          // A LIFT STRUT IS A LINE BETWEEN TWO POINTS (G179.2, the user:
          // "one end associated with the fuselage, the other end with the
          // wing, and the bar does not deform, it just follows the 2 points
          // ... it can't get distorted"). The wing layer published each
          // member's own drawn pin and tip; every vertex takes the nearest
          // member and its projection t along it, and moves by t times that
          // member's physics TIP node travel — 0 at the pin (the rigid
          // fuselage), 1 at the tip (the wing skin's own station). Straight
          // by construction, whatever the physics does.
          grp.add(pg);
          const W2 = curDef.parts.wf;
          const rPos = W2.R && W2.R.strutF != null && curDef.nodes[W2.R.strutF].p[2] > 0;
          const sideOf = z => ((z >= 0) === rPos ? W2.R : W2.L);
          const nodeOfMember = pt.members.map(m => {
            const S2 = sideOf(m.tip[2]);
            if (!S2 || S2.strutF == null) return null;
            const same = pt.members.filter(o => (o.tip[2] >= 0) === (m.tip[2] >= 0));
            const xMin = Math.min(...same.map(o => o.tip[0]));
            const front = m.tip[0] <= xMin + 1e-6;           // x is aft
            return front ? S2.strutF : (S2.strutR != null ? S2.strutR : S2.strutF);
          });
          pg.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            const pa = o.geometry.attributes.position;
            if (!pa || !pa.array) return;
            const src = pt.groups[Object.keys(pt.groups)
              .find(k => pt.groups[k].pos === pa.array)] || null;
            if (src) {                       // G58.4's aliasing rule
              if (!src.base0) src.base0 = pa.array.slice();
              else pa.array.set(src.base0);
            }
            const base = pa.array.slice();
            const memb = new Uint8Array(pa.count), W = new Float32Array(pa.count);
            for (let i = 0; i < pa.count; i++) {
              const v = [base[i*3], base[i*3+1], base[i*3+2]];
              let best = 0, bd = Infinity, bt = 0;
              pt.members.forEach((m, k) => {
                const r2 = dSeg2(v, m.pin, m.tip);
                if (r2[0] < bd) { bd = r2[0]; best = k; bt = r2[1]; }
              });
              memb[i] = best; W[i] = Math.max(0, Math.min(1, bt));
            }
            strutRigs.push({ posAttr: pa, base, memb, w: W, idx: nodeOfMember,
                             rest0: nodeOfMember.map(n => n == null ? null : nodeRest(n)) });
          });
        }
        else if ((pt.kind === 'cabane' || pt.kind === 'interplane' || pt.kind === 'wire') &&
                 pt.members && pt.members.length) {
          // G185: THE TRUSS FOLLOWS ITS OWN TWO ENDS. Each drawn member's
          // pin and tip find the physics node nearest them at rest (within
          // 0.4 m, in the mesh's own frame — the design CG's, so the rest
          // positions are shifted by oR); a vertex takes (1-t) of the pin
          // node's travel and t of the tip node's — a strut translates,
          // tilts and stretches between the very nodes its beam runs
          // between, a wire the same. An end with no node within reach is
          // held (the fuselage's, on a cabane foot).
          grp.add(pg);
          const oR = defBodyProject(curDef)(defCG(curDef));
          const nearNode = q => {
            let best = null, bd = 0.16;               // 0.4 m squared
            for (let i = 0; i < curDef.nodes.length; i++) {
              const r = nodeRest(i);
              const dx = r[0] - oR[0] - q[0], dy = r[1] - oR[1] - q[1], dz = r[2] - oR[2] - q[2];
              const d2 = dx*dx + dy*dy + dz*dz;
              if (d2 < bd) { bd = d2; best = i; }
            }
            return best;
          };
          const tipOf = pt.members.map(m => nearNode(m.tip));
          const pinOf = pt.members.map(m => nearNode(m.pin));
          pg.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            const pa = o.geometry.attributes.position;
            if (!pa || !pa.array) return;
            const src = pt.groups[Object.keys(pt.groups)
              .find(k => pt.groups[k].pos === pa.array)] || null;
            if (src) {
              if (!src.base0) src.base0 = pa.array.slice();
              else pa.array.set(src.base0);
            }
            const base = pa.array.slice();
            const memb = new Uint8Array(pa.count), W = new Float32Array(pa.count);
            for (let i = 0; i < pa.count; i++) {
              const v = [base[i*3], base[i*3+1], base[i*3+2]];
              let best = 0, bd = Infinity, bt = 0;
              pt.members.forEach((m, k) => {
                const r2 = dSeg2(v, m.pin, m.tip);
                if (r2[0] < bd) { bd = r2[0]; best = k; bt = r2[1]; }
              });
              memb[i] = best; W[i] = Math.max(0, Math.min(1, bt));
            }
            strutRigs.push({ posAttr: pa, base, memb, w: W, idx: tipOf,
                             rest0: tipOf.map(n => n == null ? null : nodeRest(n)),
                             idxPin: pinOf,
                             restPin: pinOf.map(n => n == null ? null : nodeRest(n)) });
          });
        }
        else if (pt.kind === 'eng') {
          // THE ENGINE UNIT IS ONE RIGID PART ON ITS OWN NODE (G179.2, the
          // user: "ALL of the engine mesh should be parented to the wing
          // nodes"). It used to be skin: the wing-box selector cut a
          // wing-mounted block through the middle and the halves went two
          // ways — 6 cm apart on the take-off roll, 24 at FLEX x4. Drawn
          // place + its engine node's travel, exactly as a wheel is posed.
          if (pg.position && pg.position.set)
            pg.position.set(pt.pivot[0], pt.pivot[1], pt.pivot[2]);
          grp.add(pg);
          const idxs = engNodesFor(pt.pivot[2]);
          if (idxs.length) engRigs.push({ obj: pg, idxs, pivot: pt.pivot,
                                          rest0: meanRest(idxs) });
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
                               idx: legNode[pt.kind],
                               rest0: nodeRest(legNode[pt.kind]) });
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
              drive: pt.drive, sgn: pt.sgn || 1,
              plane: pt.plane || 1 });      // G185: which plane's box binds it
          });
        }
        else if (pt.kind === 'castorT') {
          if (pg.position && pg.position.set)
            pg.position.set(pt.pivot[0], pt.pivot[1], pt.pivot[2]);
          grp.add(pg);
          castorRig = { obj: pg, idx: nodeOf.tw, pivot: pt.pivot,
                        axle: pt.axle, axis: pt.axis,
                        rest0: nodeRest(nodeOf.tw) };
        }
        else if (nodeOf[pt.kind] != null) {
          if (pg.position && pg.position.set)
            pg.position.set(pt.pivot[0], pt.pivot[1], pt.pivot[2]);
          grp.add(pg);
          const w = { obj: pg, idx: nodeOf[pt.kind], R: pt.R,
                      pivot: pt.pivot, rest0: nodeRest(nodeOf[pt.kind]),
                      prev: null };
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
    // G185: one binding box PER PLANE — plane 1 reads its own spec, spar
    // record and root, and the binding keeps only that plane's spar nodes
    // (cfg.plane), or a biplane's two planes at one station would AVERAGE
    const cageCfg = (kPl) => {
      const k = kPl | 0;
      const PLk = k && curDef.parts && curDef.parts.planes ? curDef.parts.planes[k] : null;
      const W2 = k ? (curDef.spec && curDef.spec.wings && curDef.spec.wings[k])
                   : (curDef.spec && curDef.spec.wing);
      const zR = ((PLk ? PLk.zRoot : (curDef.parts && curDef.parts.zRoot)) || 0.5) + 0.06;
      const offC = [(data.off && data.off[0]) || 0,
                    (data.off && data.off[1]) || 0, 0];
      if (!W2 || W2.xLE == null)
        return { off: offC, tags: ['WF', 'WR'], zRoot: zR, xMax: 1.5, plane: k };
      // the binding tests SNAPSHOT-LOCAL coordinates — design minus
      // (cg0 + off) on x and y (which is why the old `x ≤ 1.5` was, in
      // design terms, "everything but the extreme tail"). The box is
      // authored in design coords and shifted here; margins absorb the
      // G54.2 pitch rotation.
      const cg0b = defCG(curDef);
      const dx0 = cg0b[0] + offC[0], dy0 = cg0b[1] + offC[1];
      // G140: the wing walks by station SEATS now (tipX/crankX, metres);
      // legacy hand-written specs may still say sweep — cover both reaches
      const sw = Math.max(
        Math.abs(+W2.tipX || 0), Math.abs(+W2.crankX || 0),
        Math.abs(Math.tan((W2.sweep || 0) * Math.PI / 180) * W2.span * 0.5))
        * ((+W2.tipX || 0) < 0 || (W2.sweep || 0) < 0 ? -1 : 1);
      let yMin;
      try {
        const F = (PLk ? PLk.wf : curDef.parts.wf).R.F;
        yMin = Math.min(curDef.nodes[F[0]].p[1],
                        def.nodes[F[F.length - 1]].p[1]) - 0.30 - dy0;
      } catch (e) { yMin = undefined; }
      return { off: offC, tags: ['WF', 'WR'], zRoot: zR, plane: k,
               xMin: W2.xLE - 0.15 + Math.min(0, sw) - dx0,
               xMax: W2.xLE + W2.chord + 0.25 + Math.max(0, sw) - dx0,
               yMin };
    };
    const cfg = data.cage ? cageCfg(0) : SKIN_CFG[key];
    // G185: the second plane's box, when the def has one
    const cfg2 = (data.cage && curDef.parts && curDef.parts.planes && curDef.parts.planes[1])
      ? cageCfg(1) : null;
    const isPlane2 = name => !!(cfg2 && data.mats && data.mats[name] && data.mats[name].plane === 2);
    // G59.3 second pass: bind each control surface to the SAME spar
    // stations the wing skin uses, so it flexes with the wing it is
    // bolted to instead of only deflecting on its hinge.
    for (const s2 of surfParts) {
      try { s2.bind = makeSkinBinding(s2.dsg, s2.nv2, def, (s2.plane === 2 && cfg2) ? cfg2 : cfg); }
      catch (e) { s2.bind = null; }
      s2.dsg = null;
    }
    const rigNames = data.cage ? Object.keys(dec) : (SKIN_CFG[key].rig || ['skin']);
    const rigs = rigNames.filter(n => dec[n]).map(name => {
      const posAttr = meshes[name].geometry.attributes.position;
      // THE LIFT STRUT IS NOT WING SKIN. The wing-box selector binds every
      // vertex by its own |z| to the spar-station deltas, and the strut is a
      // 16-ring tube running DIAGONALLY through that box — each ring got a
      // different station's deflection and the rings under yMin got none,
      // which is the mid-span kink on every flight (the same disease G58.1
      // cured for the strut ROOT, caught here for the strut's whole body).
      // zRoot:Infinity binds nothing here; the strut takes its OWN binding —
      // the two-end follow built just below (G140).
      const bindCfg = (data.cage && name === 'sstrut')
        ? { ...cfg, zRoot: Infinity }
        : isPlane2(name) ? cfg2 : cfg;   // G185: the second plane's skin
      return {
        name, posAttr, base: posAttr.array.slice(),
        bind: makeSkinBinding(posAttr.array, dec[name].nv, def, bindCfg),
        // control surface hinges (payload v2: per-vertex surface ids + hinge table)
        hb: (data.v >= 2 && dec[name].sid) ? makeHingeBinding(dec[name], data.surfaces) : null,
      };
    });
    // G140: THE STRUT FOLLOWS ITS OWN TWO ENDS (the user's ruling: "the
    // strut should probably not deform itself, just move its begin and end
    // points. Or better, scale gracefully between these"). Each vertex is
    // assigned to one of the four drawn members (side x front/rear) by
    // nearest axis in snapshot space, with t its fraction along foot->tip;
    // per frame it takes (1-t) of the foot node's body-frame delta and t of
    // the tip's — the tube translates, tilts and stretches between the very
    // nodes its beam runs between (61 exports them as wf.*.strutF/strutR),
    // and can neither kink mid-span nor part company with a flexing wing.
    // G179.2: the lift struts are PARTS now (kind 'liftstrut', below):
    // the two-end follow that lived here keyed on a rig NAME, then on a
    // 7 cm search around the physics line, and both missed struts the
    // wing layer drew off that line. Identity beats surgery.
    // station structure is a property of the fiche, so one delta buffer serves all
    const nz = rigs[0].bind.zs.length;
    const deltas = { P: new Float32Array(nz * 3), N: new Float32Array(nz * 3) };
    const m = Object.assign(entry, { grp, props, rigs, deltas,
                        off: cfg.off,
                        // G179: the design CG in the rest body frame — what
                        // poseModel adds to land the CG-authored mesh on the
                        // structural origin it is now posed from
                        oRest: defBodyProject(curDef)(defCG(curDef)),
                        // ...and for the gen skin, whose `rest` genRestFrame
                        // authored about that CG: the firewall ring in that
                        // frame, so genNodeBody lands on the same authoring
                        // point while measuring from the structure
                        oNode: (key === 'gen' && typeof genRestFrame === 'function')
                          ? genRestFrame(curDef).to(defOrigin(curDef)) : null,
                        wheelParts: wheelParts.length ? wheelParts : null,
                        engRigs: engRigs.length ? engRigs : null,       // G179.2
                        strutRigs: strutRigs.length ? strutRigs : null, // G179.2
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
    // G179: THE POSE IS PINNED TO THE STRUCTURE. `cg` here is sim.bodyOrigin()
    // — the firewall ring, the datum the axes are already taken from — not
    // the mass centre. The mesh is authored about the DESIGN CG, so `oR`
    // (that CG in the rest body frame) carries the group there: at rest the
    // two agree exactly, and in flight the drawn fuselage follows the
    // fuselage NODES instead of a CG that a sagging engine or a draining
    // tank moves against them. nodeLocal below reads the same `cg`, and the
    // gear rigs' rest (nodeRest, via defBodyProject) is built on the same
    // origin — one datum on both sides of every delta.
    const [xA, yU] = sim.axes(), cg = sim.bodyOrigin(),
          O = model.off || SKIN_CFG[curKey].off, oR = model.oRest || [0, 0, 0];
    vX.set(xA[0], xA[1], xA[2]); vY.set(yU[0], yU[1], yU[2]);
    vZ.crossVectors(vX, vY);                     // z left: keeps the basis proper (no mirror)
    mBasis.makeBasis(vX, vY, vZ);
    const ox = O[0] + oR[0], oy = O[1] + oR[1], oz = oR[2];
    mBasis.setPosition(
      cg[0] + ox*xA[0] + oy*yU[0] + oz*vZ.x,
      cg[1] + ox*xA[1] + oy*yU[1] + oz*vZ.y,
      cg[2] + ox*xA[2] + oy*yU[2] + oz*vZ.z);
    model.grp.matrix.copy(mBasis);
    // THE PROJECTOR'S FRAME IS THIS ONE, AND IT MOVES (G160.2). The box decal
    // modes read `vCraftPos = uCraftInv * modelMatrix * v`, so uCraftInv has to
    // be the inverse of whatever carries the aeroplane's pose — and that is
    // `model.grp`, right here, rebuilt from the solver's basis and CG on every
    // frame. I first set this once per build off `craft`, reasoning that both
    // move together so the product would be invariant. `craft` is never posed
    // at all: it sits at identity and the aeroplane's motion lives in the
    // vertex buffers and in this matrix. So inv(craft) was the identity,
    // vCraftPos collapsed to WORLD position, and a side-projected marking slid
    // across the aeroplane as it flew down the map — which is the exact defect
    // that was already written up, arrived at a second way.
    //
    // ONCE PER FRAME IS NOT OPTIONAL for the same reason: this matrix is new
    // every frame, so a value cached at build time is stale as soon as the
    // aeroplane rolls.
    //
    // FIELD MODE DOES NOT CARE, and that is why this stayed invisible: the
    // registration defaults to `field`, which rides the surface field baked
    // into aStruct and never touches vCraftPos. Only `side` and `plan` read it.
    if (window.AEROSKIN && window.AEROSKIN.aeroSetCraft) {
      model.grp.updateWorldMatrix(true, false);
      window.AEROSKIN.aeroSetCraft(THREE, model.grp.matrixWorld,
        // model.grp's own basis, as built two lines above: local x is the
        // solver's along-axis, local y is up, local z is the cross (left).
        { lateral: 'z', along: 'x', up: 'y', aft: false });
    }
    if (running)                                 // a paused world holds its prop
      for (const p of model.props) {
        // G194: EACH PROP ITS OWN ENGINE. The rate follows that engine's lever
        // (a cut engine winds down over ~1.5 s to a windmill that stops when
        // the aeroplane does), the sense is the engine's own hand, so a
        // counter-rotating pair turns in opposite directions on screen.
        const ud = p.userData || {};
        const ei = ud.engIdx || 0;
        const eng = sim.ctl.eng && sim.ctl.eng[ei];
        const lever = eng ? (eng.on ? +eng.thr : 0) : 1;
        const on = !eng || eng.on;
        const V = (sim.out && sim.out.V) || 0;
        const target = on ? 8 + 110 * sim.ctl.thr * lever : Math.min(8, 0.4 * V);
        ud.spinRate = (ud.spinRate == null ? target : ud.spinRate) +
                      (target - (ud.spinRate == null ? target : ud.spinRate)) * (1 - Math.exp(-(1/60) / 1.5));
        const sense = ((def && def.params && def.params.engines || [])[ei] || {}).sense || 1;
        const d = sense * ud.spinRate * (1/60);                     // visual only
        const ax2 = ud.spinAxis;
        if (ax2 && p.quaternion && p.quaternion.setFromAxisAngle) {
          // G59.1: about the shaft, so the disc stays in its own plane
          ud.spinAng = (ud.spinAng || 0) + d;
          vSpin.set(ax2[0], ax2[1], ax2[2]);
          p.quaternion.setFromAxisAngle(vSpin, ud.spinAng);
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
      genNodeBody(sim, model.nodeBody, model.oNode);
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
      // a rig with no bound vertices and no hinges (the lift strut) rides the
      // group matrix — or its OWN two-end binding, applied just below
      if (!r.hb && !r.bind.bound.length) continue;
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
        // G148: DRAWN PLACE + PHYSICS DELTA — the same law the leg and
        // the castor pose by. Absolute node placement pinned the wheel to
        // the SIM while its leg held the DRAWING, so every calibration
        // residual (the off vector has no z, per-side vs mean track)
        // became a permanent gap between parts bolted together.
        if (w.pivot && w.rest0)
          w.obj.position.set(w.pivot[0] + L[0] - w.rest0[0],
                             w.pivot[1] + L[1] - w.rest0[1],
                             w.pivot[2] + L[2] - w.rest0[2]);
        else w.obj.position.set(L[0], L[1], L[2]);
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
    // G179.2: the ENGINE UNITS and their propellers ride their own node —
    // drawn place + the node's travel, with the skin's flex gain so a unit
    // stays on the wing it sits on at FLEX x4 as well as at x1
    if (model.engRigs) for (const e of model.engRigs) {
      if (!e.obj.position || !e.obj.position.set) continue;      // smoke stub
      const g = skinMode === 1 ? SKIN_GAINS[1] : SKIN_GAINS[0];
      let lx = 0, ly = 0, lz = 0;
      for (const i of e.idxs) { const L = nodeLocal(i); lx += L[0]; ly += L[1]; lz += L[2]; }
      const n = e.idxs.length;
      e.obj.position.set(e.pivot[0] + g * (lx / n - e.rest0[0]),
                         e.pivot[1] + g * (ly / n - e.rest0[1]),
                         e.pivot[2] + g * (lz / n - e.rest0[2]));
    }
    // ...and the LIFT STRUTS: each vertex moves by its projection along its
    // own member times that member's tip-node travel — a straight line from
    // the pin on the rigid fuselage to the tip on the flexing wing
    if (model.strutRigs) for (const s of model.strutRigs) {
      if (!s.posAttr || !s.posAttr.array) continue;
      const g = skinMode === 1 ? SKIN_GAINS[1] : SKIN_GAINS[0];
      const D = s.idx.map((n, k) => {
        if (n == null || !s.rest0[k]) return [0, 0, 0];
        const L = nodeLocal(n);
        return [L[0] - s.rest0[k][0], L[1] - s.rest0[k][1], L[2] - s.rest0[k][2]];
      });
      // G185: a truss member's PIN end moves too (a lift strut's pin is the
      // rigid fuselage and has no idxPin)
      const DP = s.idxPin ? s.idxPin.map((n, k) => {
        if (n == null || !s.restPin[k]) return [0, 0, 0];
        const L = nodeLocal(n);
        return [L[0] - s.restPin[k][0], L[1] - s.restPin[k][1], L[2] - s.restPin[k][2]];
      }) : null;
      const p2 = s.posAttr.array, b = s.base, W = s.w, M2 = s.memb;
      for (let i = 0; i < W.length; i++) {
        const d = D[M2[i]] || D[0], t = g * W[i];
        const dp = DP ? (DP[M2[i]] || DP[0]) : null, tp = dp ? g * (1 - W[i]) : 0;
        p2[i*3]   = b[i*3]   + t * d[0] + (dp ? tp * dp[0] : 0);
        p2[i*3+1] = b[i*3+1] + t * d[1] + (dp ? tp * dp[1] : 0);
        p2[i*3+2] = b[i*3+2] + t * d[2] + (dp ? tp * dp[2] : 0);
      }
      s.posAttr.needsUpdate = true;
    }
    if (model.stretchRigs) for (const s of model.stretchRigs) {
      if (!s.posAttr || !s.posAttr.array) continue;
      const L = nodeLocal(s.idx);
      if (!s.rest0) s.rest0 = L;            // fallback only — see nodeRest
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
        if (!c.rest0) c.rest0 = L;          // fallback only — see nodeRest
        c.obj.position.set(
          c.pivot[0] + L[0] - c.rest0[0],
          c.pivot[1] + L[1] - c.rest0[1],
          c.pivot[2] + L[2] - c.rest0[2]);
        if (c.axis && c.obj.quaternion.setFromAxisAngle) {
          vY.set(c.axis[0], c.axis[1], c.axis[2]);
          // THE DRAWN CASTOR STEERS THE WAY THE SOLVER'S WHEEL ROLLS
          // (2026-09-04, the user: "check that the tail wheel turns in the
          // right direction"). The solver turns the third wheel's rolling
          // direction by -twSteer*dr about +y (30_solver, "measured: matches
          // nose-left convention"); this rotated the castor by -dr about its
          // SWIVEL axis, which points DOWN — the opposite sense, at twice the
          // angle. The join maps cage to model by a pure rotation about y,
          // so the sense survives it. Written as -twSteer*dr about +y and
          // projected onto the swivel's own direction; a nosewheel's negative
          // twSteer falls out of the same line.
          const tws = (def && def.params && typeof def.params.twSteer === 'number')
            ? def.params.twSteer : 0.5;
          const up = c.axis[1] < 0 ? -1 : 1;
          c.obj.quaternion.setFromAxisAngle(vY, -tws * (link.dr || 0) * up);
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
  // WIRE and UV are gone (playability round): the wireframe never told a
  // player anything the Frame mode doesn't, and the UV pane was permanently
  // empty for the cage build (no `dec` on the join payload) — a diagnostic
  // for a pipeline the game no longer flies.
  if ($('bMood')) $('bMood').onclick = () =>
    setMood(hangar ? (hangarMood + 1) % hangar.moods.length : 0);

  $('bSkin').onclick = () => setSkinMode((skinMode + 1) % 4);
  // THE COVERING, BY NAME. The button cycles; the `camera` flyout's pills
  // pick, and both go through here so there is one place that changes it.
  function setSkinMode(n) {
    skinMode = ((n | 0) % 4 + 4) % 4;
    applySkinVis();
  }

  // ---- W10 route: spawn at any aerodrome (default the home base), fly
  // a circuit there or cross-country to any other strip ----
  let fromId = 'HOME', destId = 'CIRCUIT';
  const aeroById = id => world.aerodromes.find(a => a.id === id) || world.aerodromes[0];
  // 'taxi' (the stand, G151) or 'lineup' (the runway). A string on purpose:
  // the flight layer's flPref objects are declared far below this and this
  // must be readable by the very first applyRoute at boot.
  const flStartTaxi = () => prefGet('flydiy.flStart', 'taxi') !== 'lineup';
  // G193: THE PATTERN ON THE GROUND. One overlay per applied route, built by
  // pattern_vis.js from the same declaration the pilot follows (sitePattern)
  // and the same sampler (patternPath), so the ribbon is the line the
  // aeroplane steers to. Its layers are the rail's `patterns` flyout; off by
  // default, so nothing on screen changes until asked.
  let patVis = null, patVisK = -1;
  const patOnGet = () => {
    try { return patOn; } catch (e) { return { graph: false, slope: false, targets: false, map: false }; }
  };
  function patternVisFor(from, st) {
    if (patVis) { try { patVis.dispose(); } catch (e) {} patVis = null; }
    if (!from || !window.PATTERN_VIS || typeof sitePattern !== 'function') return;
    let P = null;
    try { P = sitePattern(from, st || null); } catch (e) { P = null; }
    if (!P) return;
    const gy = (x, z) => (world && typeof world.terrainH === 'function')
      ? world.terrainH(x, z) : (from.elev || 0);
    try {
      patVis = window.PATTERN_VIS.buildPatternVis(THREE, P, gy,
        { patternPath: (typeof patternPath === 'function') ? patternPath : null });
      scene.add(patVis.group);
      patVis.setLayers(patOnGet());
      patVisK = -1;
    } catch (e) { console.error('pattern overlay:', e); patVis = null; }
  }
  function applyRoute() {
    const from = aeroById(fromId);
    const to = destId === 'CIRCUIT' ? from : aeroById(destId);
    // G151: ON THE APRON, NOT ON THE RUNWAY. `placeAtAerodrome` puts the
    // aeroplane on the strip's SPAWN IDENTITY — the datum every flying gate
    // departs from — and rolling out onto it teleported the player 75 m from
    // the shed facing away from it, which is the first thing every single
    // flight showed. G123 declared `site.stand` for exactly this and wired it
    // to nothing, because moving the spawn would have moved every take-off
    // measurement in the battery.
    // Nothing moves now either: the aeroplane starts on the STAND, and the
    // pilot's own DEPART planner (built for W14's backtrack, taught in G151 to
    // notice it is off the centreline) taxis it onto the strip. The spawn
    // identity keeps its meaning because that is where the taxi ENDS.
    // THE THREE-POINT STANCE FIRST (G170): the design pose is the level
    // attitude and the tail would fall a metre onto the tail wheel on the
    // first frame. The solver pitches the airframe onto its three points here,
    // in the design frame, before the placement rotates it onto the site.
    if (typeof sim.stance === 'function') sim.stance();
    const st = (typeof siteOf === 'function') ? siteOf(from.id) : null;
    patternVisFor(from, st);
    // ...AND WHETHER IT DOES IS THE PLAYER'S (2026-09-04, the user: "the
    // planes are really a lot too slow when rolling out of the hangar ... an
    // option to just remove that"). The rail's `start` flyout writes this
    // pref; off, the aeroplane is placed on the spawn identity itself, lined
    // up on the strip, exactly as every flight began before G151. Read here,
    // on every applyRoute, so RESTART is what applies it.
    const stand = (st && flStartTaxi()) ? st.stand : null;
    if (stand) {
      placeAtStand(sim, from, stand);
      ap.setRoute(from, to);      // frame + altRef, so the HUD has them at once
      // G193: the whole SITE, not its taxiOut list — the pilot builds the
      // pattern (the taxi graph, the hold, the two touchdown targets) from it
      ap.departFrom(from, to, st);   // then plan from the live pose
    } else {
      placeAtAerodrome(sim, from);   // HOME is a bit-exact no-op
      ap.setRoute(from, to);
    }
  }
  // G107: YOUR builds fly the TEST PILOT (41_test_pilot.js) — bounded
  // attempts, structured verdicts; the classic autopilot (40_) is what the
  // generator's own gates are calibrated on.
  // G130: that rule became the DEFAULT of a choice. 'auto' is the test pilot
  // for your build; 'classic' puts the old autopilot under it, which flies
  // it unbounded. (Until the fleet retired, 2026-09-05, 'auto' also meant
  // "classic under a fiche" — there is no fiche now, so 'auto' is 'test'.)
  let pilotChoice = 'auto';
  const mkPilot = () => {
    const test = pilotChoice !== 'classic';
    return (test && typeof makeTestPilot === 'function')
      ? makeTestPilot(sim, def, world) : makeAutopilot(sim, def, world);
  };
  if ($('selPilot')) $('selPilot').onchange = e => {
    pilotChoice = e.target.value;
    // mid-flight the change takes effect through a fresh departure; in the
    // garage it simply decides who flies the next roll-out
    if (!inGarage) fullReset();
  };
  function setAircraft(key) {
    def = AIRCRAFT[key]();
    sim = makeSim(def, world);
    sim.reset(0);
    ap = mkPilot(key);
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
      size: 0.06 }));
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
    // THE MARKINGS REACH THE FLOWN AEROPLANE (G160). The user's report was
    // "the registration did not make it in-game intact, my settings affected
    // only the garage", and that was literally true: the only caller of
    // aeroSetDecals was the editor panel, so a placed registration was painted
    // on while you were building and gone the moment you flew.
    //
    // `genSpec` is the garage's spec; nothing else has one (a boot before the
    // editor's first commit has none yet, and flies bare).
    if (key === 'gen' && genSpec && window.AEROSKIN
        && window.AEROSKIN.aeroApplySpecDecals) {
      try {
        // THE FRAME IS SET IN THE POSE LOOP, not here — see G160.2 beside
        // `model.grp.matrix.copy(mBasis)`. It has to be, because the matrix it
        // inverts is rebuilt every frame; setting it once at build time named
        // the right uniform at the wrong moment.
        window.AEROSKIN.aeroApplySpecDecals(THREE, genSpec);
      } catch (e) {
        // IT STILL SWALLOWS, IT JUST SAYS SO FIRST — the same ruling
        // _cage_ui.js reached about its own finish panels. One layer failing
        // must not take the aircraft build with it, but a silent catch here
        // is indistinguishable from the bug this block exists to fix: an
        // aeroplane with no markings on it. It cost a debugging round during
        // G160 itself, when a typo threw in here and the only symptom was a
        // bare fuselage that looked exactly like the original defect.
        console.error('markings: this build’s own decals did not go on —', e);
      }
    }
    applySkinVis();
    dist = distT = def.params.viewDist;   // aircraft change SNAPS, no glide
    const PP = POWERPLANTS[def.params.powerplant];
    let half = 0;                          // wingspan from the wing strips, like the solver
    for (const st of def.strips) if (st.kind === 'wing')
      for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
        half = Math.max(half, Math.abs(def.nodes[i].p[2]));
    const mass = sim.totalM < 5 ? (sim.totalM*1000).toFixed(0) + ' g' : sim.totalM.toFixed(0) + ' kg';
    $('acName').textContent = def.params.name;
    // THE PLATE HEADER IS NOT A SPEC SHEET (the flight rebaseline). This
    // string used to be the whole fiche — mass, engine, span, node count — on
    // the aircraft card. The engine and the span are the WORKSHOP's (#edSpec
    // says both, beside the aeroplane you are changing); the node count was a
    // debug number printed over a render. What the flight wants from it is the
    // one number that decides how the aeroplane behaves today: what it weighs.
    $('acSpec').textContent = `${mass} all-up`;
    // the plaque belongs to the build on the stand, so every aircraft
    // change re-asks: a rebuilt aeroplane must never wear the previous
    // build's numbers — it would be reading someone else's certificate.
    if (typeof drawPlaque === 'function') drawPlaque();
    // the file ribbon's shelf shows only while the garage build is on the
    // stand, and a programmatic aircraft switch fires no 'change' event on
    // the select — so the switch itself tells the shelf (see garage.js's
    // syncShelf note; without this the ribbon booted as "unsaved · new"
    // with the save/load doors hidden for the whole session).
    if (window.GARAGE_SPEC && typeof window.GARAGE_SPEC.syncShelf === 'function')
      window.GARAGE_SPEC.syncShelf();
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
  // WHICH SECTION OF THE AEROPLANE THE SKIN UNDER THE POINTER IS ON. The
  // fuselage covering is one material from the firewall to the tail (see
  // cageBodyZones in tools/_cage_gen.js), so the section is a STATION
  // question: the mesh carries the station table it was built with, in its
  // own coordinates, and the struck point converted into them answers it.
  // This stays app.js's job for the same reason the rest of the ray is: it
  // is scene-graph arithmetic, and turning `nose` into a PART is the part
  // table's business over in editor.js.
  const pickLocal = new THREE.Vector3();
  // the see-inside switch, asked of the one place that decides it
  const viewThru = name => !!(window.CAGE_VIEW && window.CAGE_VIEW.thru
                              && window.CAGE_VIEW.thru(name));
  function cageZoneOf(o, worldPt) {
    const zs = o.userData && o.userData.bodyZones;
    if (!zs || !zs.length || !worldPt) return null;
    o.worldToLocal(pickLocal.copy(worldPt));
    const z = pickLocal.z;
    for (const q of zs) if (z >= q.z0) return q.key;
    return zs[zs.length - 1].key;
  }
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
        // WHAT YOU CAN SEE THROUGH, YOU CAN CLICK THROUGH (the user: "maybe
        // we should have a view where the interior is visible, and not the
        // fuselage, to be able to get to the engine and the cockpit through
        // clicking"). The material factory decides what the x-ray takes
        // away and publishes the same answer here, so a faded covering and
        // a click-through covering can never disagree.
        if (names[mi] && viewThru(names[mi])) continue;
        if (names[mi]) return { section: names[mi], name: '', layer: 'cage',
                                zone: cageZoneOf(o, h.point),
                                point: h.point.toArray() };
      }
      // A LAYER OBJECT: the nearest name on the way up is the part (the layers
      // name what they build — edWheelL, edProp, edSurf_ailR, edFit_pitot),
      // and the group at the top says which layer it belongs to.
      let p = o, name = '', layer = '', thru = false;
      while (p && p !== edSitP) {
        const n = p.name || '';
        if (n.lastIndexOf('cageLayer:', 0) === 0) layer = n.slice(10);
        else if (!name && n) name = n;
        // a LAYER says for itself whether the x-ray took it (the cowl does):
        // it owns its own materials, so it owns the answer
        if (p.userData && p.userData.xray) thru = true;
        p = p.parent;
      }
      if (thru) continue;
      if (layer) return { section: null, name, layer, point: h.point.toArray() };
    }
    // THE RAY WAS CAST AND HIT NOTHING — which is an ANSWER, and a different
    // one from the `null`s above. Those mean "not a question": the stand is
    // not up, the canvas has no size, the pointer is outside the render. The
    // editor deselects on a miss and must not deselect on a non-question, so
    // the two are told apart here rather than guessed at over there.
    return { miss: true, section: null, name: '', layer: '' };
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
      // inside, you can look at your own feet and straight up at the skylight
      elT = edEyeOn() ? Math.max(-1.45, Math.min(1.45, elT))
                      : Math.max(-0.05, Math.min(1.4, elT));
      px = e.clientX; py = e.clientY;
    } else if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) distT = Math.max(edEyeOn() ? 0.12 : 4,
        Math.min(edEyeOn() ? 3 : 200, dist0 * pinch0 / Math.max(20, d)));
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
    // ONE PAIR OF BOUNDS, not two. The wheel said [4, 120] and the pinch said
    // [4, 200], which is a difference nobody chose; they agree now, and both
    // shrink to a cabin's worth of travel when the camera is inside one.
    distT = edEyeOn() ? Math.max(0.12, Math.min(3, distT * (1 + e.deltaY * 0.001)))
                      : Math.max(4, Math.min(120, distT * (1 + e.deltaY * 0.001)));
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
    // THE PHASE IS THE CLOCK OF THIS SCREEN (the flight rebaseline). It says
    // the word in the plate's own header, it decides whether the brief is
    // open or folded, and it decides which verbs are on the row — because the
    // screen's rule is temporal: what am I flying / what is it doing / what
    // happened, in the order the flight asks them.
    $('rail').classList.toggle('held', active === null);
    if (typeof flPhaseMoved === 'function') flPhaseMoved(active);
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
  // G153: `APRON` stood here — one declaration, zero readers, named as dead by
  // G123 and deleted now that it is also WRONG. It carried a build-stand pose
  // (hdg PI-0.62, spawn [26,40]) that the site has genuinely declared since
  // G123 and that G151 corrected; leaving a second, stale answer beside the
  // live one is how three copies of a runway happened in the first place.
  // `siteOf('HOME').stand` is the one answer.
  let inGarage = false;
  // ---- THE TRACE'S CHANNELS (the user: "I'd like to have more info on the
  // trace and be able to select/deselect the one I want to see from the
  // legend. I'd like throttle, trim levels, stick inputs (3 values, + and -
  // for yaw, roll and pitch. Vs also and AOA. Basically everything we have on
  // the top ribbon") -----------------------------------------------------
  //
  // ONE LANE PER CHANNEL, NOT FIFTEEN LINES IN ONE FRAME. Altitude is in
  // metres, throttle is a percentage and bank is degrees; drawing them against
  // a shared vertical axis is the dual-axis mistake, and normalising them onto
  // one so they can share it is the same mistake with the evidence removed —
  // it invites you to read a crossing as an event. Stacked lanes over ONE time
  // axis is what a flight-data recorder draws, and it is what this draws: each
  // lane has its own range, its own baseline, and its name and CURRENT VALUE
  // written at its left. The phase marks run the full height, so the thing you
  // actually want — what the throttle did WHEN the vertical speed went — is
  // read down a column.
  //
  // COLOUR IS BY FAMILY, and the six families are the first six slots of the
  // dataviz reference theme's dark column, in its own documented order. That
  // order is validated (worst adjacent CVD dE 8.4, normal-vision 19.3, all six
  // >= 3:1 on this surface); re-ordering it or inventing a seventh hue breaks
  // that. Fifteen channels do not each get a hue — they could not pass, and
  // they do not need to: a lane is one series with its name on it, so colour
  // groups rather than identifies.
  //
  // THERE IS NO TRIM, and one was asked for. `sim.ctl` is
  // { thr, de, da, dr, brake, flap } — the autopilot holds attitude on the
  // elevator directly and no trim state exists to plot. FLAP and BRAKE are
  // here instead because they are real controls this aeroplane has. A trim
  // channel would have to be invented, and an invented instrument is the one
  // thing this project does not ship (see GATE HONEST).
  const TEL_FAM = {
    path:  '#3987e5',   // 1 blue    — where it is going
    speed: '#d95926',   // 2 orange  — how fast
    att:   '#199e70',   // 3 aqua    — how it sits in the air
    ctl:   '#c98500',   // 4 yellow  — what the pilot is doing
    load:  '#d55181',   // 5 magenta — what the airframe is taking
    eng:   '#008300',   // 6 green   — what the engine is giving
  };
  // `get` takes (out, ctl, dbg, smax). `sgn` marks a channel that swings about
  // zero, so its lane is drawn with a zero line and a symmetric range.
  // NINE, not fifteen (the user: "just keep true air speed, remove brake,
  // power, indicated airspeed and bank. Omit the `stick` to pitch yaw and
  // roll"). Every cut is the same cut: a channel that says what another one
  // already says, or that says nothing a builder acts on.
  //   - INDICATED went because `indicated` and `true` side by side is a
  //     question about instruments, not about the aeroplane, and the trace is
  //     about the aeroplane. The PFD still carries IAS, which is where the
  //     distinction belongs — it is the number you do not stall by.
  //   - BANK is read off the aeroplane in the window; a graph of it is a graph
  //     of something you are already looking at.
  //   - BRAKE is on for the first and last twenty seconds and flat between.
  //   - POWER tracks throttle everywhere except thin air, and the density-
  //     altitude sheet is where thin air is actually measured. It stays a PFD
  //     readout.
  //   - `stick` went off the three control labels: on a lane already named
  //     `pitch`, in degrees, the word was noise.
  const TEL_CH = [
    { k: 'alt',   l: 'altitude',        u: 'm',    f: 'path',  get: (o, c, d) => d.alt || 0 },
    { k: 'agl',   l: 'height agl',      u: 'm',    f: 'path',  get: (o, c, d) => d.agl || 0 },
    { k: 'vs',    l: 'vertical speed',  u: 'm/s',  f: 'path',  sgn: 1, get: o => o.vs || 0 },
    { k: 'tas',   l: 'speed',           u: 'km/h', f: 'speed', get: o => (o.V || 0) * 3.6 },
    { k: 'aoa',   l: 'angle of attack', u: '°', f: 'att', sgn: 1, get: o => (o.alpha || 0) * 57.3 },
    { k: 'thr',   l: 'throttle',        u: '%',    f: 'ctl',   get: (o, c) => c.thr * 100 },
    { k: 'pitch', l: 'pitch',           u: '°', f: 'ctl', sgn: 1, get: (o, c) => c.de * 57.3 },
    { k: 'roll',  l: 'roll',            u: '°', f: 'ctl', sgn: 1, get: (o, c) => c.da * 57.3 },
    { k: 'yaw',   l: 'yaw',             u: '°', f: 'ctl', sgn: 1, get: (o, c) => c.dr * 57.3 },
    { k: 'flap',  l: 'flap',            u: '%',    f: 'ctl',   get: (o, c) => (c.flap || 0) * 100 },
    { k: 'str',   l: 'peak strain',     u: '%',    f: 'load',  get: (o, c, d, sm) => sm * 100 },
  ];
  const TEL_DEF = ['alt', 'tas', 'thr'];
  const tel = { t: [], marks: [], km: 0, ch: {}, lo: {}, hi: {} };
  for (const c of TEL_CH) { tel.ch[c.k] = []; tel.lo[c.k] = 0; tel.hi[c.k] = 0; }
  function telClear() {
    tel.t.length = tel.marks.length = 0; tel.km = 0;
    for (const c of TEL_CH) {
      tel.ch[c.k].length = 0; tel.lo[c.k] = 0; tel.hi[c.k] = 0;
    }
  }
  let telAcc = 0, lastPhase = 'ROLL', telBase = 0;  // telBase: multi-hop offset
  let telLast = null;                               // last sampled ground point
  const telWrap = $('telp');
  function record(dt) {
    telAcc += dt;
    if (telAcc < 0.1) return;
    telAcc = 0;
    let sm = 0;
    try { sm = sim.stats().smax || 0; } catch (e) {}
    const o = sim.out, c = sim.ctl, d = ap.dbg;
    tel.t.push(telBase + ap.t);
    // EVERY CHANNEL, ALWAYS. Recording only what is currently drawn would mean
    // turning a lane on mid-flight showed a graph that starts now — which is
    // the one thing a trace must not do. Fifteen numbers at 10 Hz is nothing.
    for (const ch of TEL_CH) {
      let v = 0;
      try { v = +ch.get(o, c, d, sm) || 0; } catch (e) {}
      tel.ch[ch.k].push(v);
      if (v < tel.lo[ch.k]) tel.lo[ch.k] = v;
      if (v > tel.hi[ch.k]) tel.hi[ch.k] = v;
    }
    // ...GUARDED, because an integrator poisons itself for good on one bad
    // sample: a single non-finite frame (a reset mid-place, a divergence the
    // 30-frame watchdog has not caught yet) would make every later distance
    // NaN, and the header would read `NaN km flown` for the rest of the run.
    const cgD = sim.cgPos();
    if (Number.isFinite(cgD[0]) && Number.isFinite(cgD[2])) {
      if (telLast) {
        const dk = Math.hypot(cgD[0] - telLast[0], cgD[2] - telLast[2]) / 1000;
        if (Number.isFinite(dk)) tel.km += dk;
      }
      telLast = [cgD[0], cgD[2]];
    }
    if (ap.phase !== lastPhase) {
      tel.marks.push([telBase + ap.t, ap.phase]); lastPhase = ap.phase;
    }
  }
  // ---- THE TRACE, DRAWN AS LANES ----------------------------------------
  // One lane per selected channel over one shared time axis; the phase marks
  // run the full height so a column can be read down. Each lane carries its
  // own name and its CURRENT VALUE at the left (the user: "the numbers on top
  // should show the latest value, not the maximum of the scale, that's
  // confusing") — and under the crosshair, the value AT THE TIME you are
  // pointing at instead, which is the same readout answering a better
  // question.
  let telHover = -1;                 // sample index under the pointer, or -1
  function telOn() { return TEL_CH.filter(c => traceOn[c.k]); }
  function drawTel() {
    const cv = $('tel'), g = cv.getContext('2d'), S = 2;
    // THE BUFFER FOLLOWS THE BOX — the panel is resizable, so this is not an
    // optimisation, it is the only way the graph is ever the right shape.
    const cw = Math.max(2, Math.round((cv.clientWidth || 526) * S)),
          ch2 = Math.max(2, Math.round((cv.clientHeight || 160) * S));
    if (cv.width !== cw || cv.height !== ch2) { cv.width = cw; cv.height = ch2; }
    const W = cv.width / S, H = cv.height / S;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.clearRect(0, 0, W, H);
    const on = telOn();
    if (!on.length) {
      g.font = "500 9px 'IBM Plex Sans', sans-serif";
      g.fillStyle = 'rgba(151,144,127,.9)';
      g.fillText('no channels selected — pick one below', 8, 16);
      return;
    }
    const n = tel.t.length;
    const t1 = n ? Math.max(tel.t[n - 1], 1e-3) : 1;
    const L = 106, R = 6, TOP = 4, BOT = 12;        // L: the direct-label gutter
    const plotW = Math.max(10, W - L - R);
    const laneH = Math.max(10, (H - TOP - BOT) / on.length);
    const X = t => L + t / t1 * plotW;
    const at = telHover >= 0 && telHover < n ? telHover : n - 1;

    // the phase marks first, under everything, full height
    g.lineWidth = 1;
    g.font = "500 7.5px 'IBM Plex Sans', sans-serif";
    let lastLabelX = -99;
    for (const [tm, ph] of tel.marks) {
      const x = Math.round(X(tm)) + 0.5;
      g.strokeStyle = 'rgba(255,248,236,.13)';
      g.beginPath(); g.moveTo(x, TOP); g.lineTo(x, H - BOT); g.stroke();
      if (x - lastLabelX < 10) continue;
      lastLabelX = x;
      g.fillStyle = 'rgba(151,144,127,.75)';
      g.save(); g.translate(x + 3, TOP + 2); g.rotate(Math.PI / 2);
      g.fillText(ph, 0, 0); g.restore();
    }

    on.forEach((c, i) => {
      const y0 = TOP + i * laneH, y1 = y0 + laneH;
      const pad = Math.min(6, laneH * 0.16);
      // THE LANE'S OWN RANGE. A signed channel is drawn about a zero line and
      // symmetrically, so `+3 deg of aileron` and `-3` are the same distance
      // from the middle and a centred trace means centred controls.
      let lo = tel.lo[c.k], hi = tel.hi[c.k];
      if (c.sgn) { const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-3); lo = -m; hi = m; }
      else { lo = Math.min(0, lo); hi = Math.max(hi, lo + 1e-3); }
      const span = Math.max(hi - lo, 1e-3);
      const Y = v => y1 - pad - (v - lo) / span * (laneH - 2 * pad);
      // the lane's floor, and its zero if zero is inside it
      g.strokeStyle = 'rgba(255,248,236,.07)';
      g.beginPath(); g.moveTo(L, Math.round(y1) - 0.5);
      g.lineTo(W - R, Math.round(y1) - 0.5); g.stroke();
      if (c.sgn) {
        g.strokeStyle = 'rgba(255,248,236,.10)';
        const yz = Math.round(Y(0)) - 0.5;
        g.beginPath(); g.moveTo(L, yz); g.lineTo(W - R, yz); g.stroke();
      }
      if (n > 1) {
        const arr = tel.ch[c.k];
        g.beginPath();
        for (let k = 0; k < n; k++) {
          const x = X(tel.t[k]), y = Y(arr[k]);
          k ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.strokeStyle = TEL_FAM[c.f]; g.lineWidth = 1.6; g.lineJoin = 'round';
        g.stroke();
      }
      // THE DIRECT LABEL. A lane is one series, so its name belongs on it —
      // the legend below is a switchboard, not the only place identity lives.
      const v = n ? tel.ch[c.k][at] : 0;
      g.font = "500 8px 'IBM Plex Sans', sans-serif";
      g.fillStyle = 'rgba(151,144,127,.95)';
      g.fillText(c.l, 2, y0 + laneH / 2 - 2);
      g.font = "600 10.5px 'IBM Plex Sans', sans-serif";
      g.fillStyle = TEL_FAM[c.f];
      const txt = (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + c.u;
      g.fillText(txt, 2, y0 + laneH / 2 + 9);
    });

    // the crosshair, and the phase it is standing in
    if (telHover >= 0 && n) {
      const x = Math.round(X(tel.t[at])) + 0.5;
      g.strokeStyle = 'rgba(230,219,201,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, TOP); g.lineTo(x, H - BOT); g.stroke();
      let ph = '';
      for (const [tm, p2] of tel.marks) if (tm <= tel.t[at]) ph = p2;
      g.font = "500 8px 'IBM Plex Sans', sans-serif";
      g.fillStyle = 'rgba(230,219,201,.95)';
      const lab = tel.t[at].toFixed(1) + ' s' + (ph ? '  ·  ' + ph : '');
      const tw = g.measureText(lab).width;
      g.fillText(lab, Math.min(x + 5, W - R - tw), H - 3);
    } else {
      g.font = "500 8px 'IBM Plex Sans', sans-serif";
      g.fillStyle = 'rgba(151,144,127,.8)';
      g.fillText(t1.toFixed(0) + ' s', W - R - 26, H - 3);
    }
    const mm = Math.floor(t1 / 60), ss = Math.round(t1 - mm * 60);
    $('tsum').textContent = tel.km.toFixed(1) + ' km flown · ' +
      (mm ? mm + ' min ' + String(ss).padStart(2, '0') + ' s' : ss + ' s');
  }

  function script(dt) {
    // parking brake while HOLDING (W13 wind: a free-rolling taildragger
    // drifts downwind while you pick a route). ROLL sets brake=0 on start.
    if (!started) { sim.ctl.brake = 0.6; setRail(null); return; }
    ap.update(dt);
    if (patVis && ap.frame && ap.frame.k !== patVisK) {
      patVisK = ap.frame.k;
      patVis.setActive(patVisK, ap.gs);
    }
    record(dt);
    setRail(ap.phase);
    // THE GAME IS THE "EXTERNAL RUNNER" (G130). The test pilot's watchdog
    // writes outcome='gave-up' at its budget and keeps flying, deferring the
    // actual stop to whoever runs the sim (41_test_pilot.js) — and the live
    // game never did, so a build that could not complete the circuit flew
    // for ever with the only door home locked inside an arrival card that
    // needs a landing. The donor autopilot has no watchdog at all, so the
    // fleet gets a generous wall-clock bound of its own (the longest gate
    // legs fly ~600 s; a new leg makes a new pilot, so the clock is per leg).
    if (ap.phase !== 'STOPPED') {
      if (ap.report && ap.report.outcome === 'gave-up') endFlight('gave-up');
      else if (!ap.report && ap.t > 900) endFlight('gave-up');
      // the card just went up mid-air: the phase-moved branch below would
      // read "not STOPPED" and take it straight back down
      if (flightOver) return;
    }
    // THE ENDING IS THE CARD'S (the flight rebaseline). The touchdown summary
    // used to be written over the telemetry panel's header, which is the one
    // place fullReset() closes — so the one thing a flight produced lived on a
    // surface that answers a different question. The trace header says what
    // the trace is OF (distance flown, time), and what HAPPENED is the arrival
    // card's whole job. The logging is unchanged and still automatic.
    if (ap.phase === 'STOPPED' && (ap.tdInfo || ap.report)) logFlight();
    // THE ARRIVAL CARD (G107.2): shown ONCE per stop, gone the moment the
    // phase moves on (a new leg, a reset, a fresh roll) — so `nextLeg` and
    // `departFrom` dismiss it by flying, with no extra wiring.
    if (ap.phase === 'STOPPED' && !arrivalShown && (ap.tdInfo || ap.report)) {
      arrivalShown = true; showArrival();
    } else if (ap.phase !== 'STOPPED' && arrivalShown) {
      arrivalShown = false; $('arrCard').hidden = true;
    }
  }
  // A FLIGHT CAN END WITHOUT A LANDING (G130). The sim freezes where it is
  // (running=false — the render keeps drawing the frozen aeroplane), the
  // report gains its outcome so showArrival and logFlight have their facts,
  // and the card goes up with Fly again / Back to the hangar live. Resume
  // un-freezes and hides the card (the phase moved on), for watching a
  // hopeless build keep trying; Restart and the hangar door stay the real
  // exits. fullReset clears the latch.
  let flightOver = false;
  function endFlight(outcome) {
    if (flightOver || inGarage) return;
    flightOver = true;
    if (!ap.report) ap.report = { verdicts: [], outcome, landing: null };
    else if (!ap.report.outcome) ap.report.outcome = outcome;
    running = false;
    $('bPause').textContent = 'Resume'; $('bPause').classList.add('on');
    logFlight();
    arrivalShown = true; showArrival();
  }
  // the capture rig's one handle into the flight (G130): the probe page
  // verifies endings and reads the pilot from OUTSIDE the game — nothing
  // in-page consumes this, and nothing else is exposed
  // G179.2: the live model too, so a session can ask WHICH vertices follow
  // WHAT (rigs, parts, bindings) instead of reasoning about a screenshot
  window.FLIGHT_PROBE = { ap: () => ap, endFlight, model: () => model, sim: () => sim, def: () => def };
  // THE ARRIVAL CARD (G107.2). The flight's ending, said to the player's
  // face: until now `tdInfo` rendered only inside a telemetry panel that
  // fullReset() closes, so the one thing a flight produced was behind a
  // button nobody had pressed. The card reads the TEST PILOT's report when
  // there is one (outcome, landing, card, verdicts) and falls back to the
  // fleet autopilot's tdInfo — both pilots get an ending. The landing run
  // for the fleet pilot is computed HERE, display-only, from the same frame
  // numbers both pilots publish (`dbg.s` now vs `tdInfo.x` at touch).
  let arrivalShown = false;
  function showArrival() {
    const el = $('arrCard');
    if (!el) return;
    const rep = ap.report || null, td = ap.tdInfo;
    const outcome = rep ? (rep.outcome || 'stopped') : (td ? 'completed' : 'stopped');
    const good = outcome === 'completed';
    // WHERE, not WHAT (the flight rebaseline). The title said ARRIVED or the
    // outcome shouted in caps; it now names the PLACE, which is the sentence
    // a player reads at the end of a flight, and the outcome is the tag beside
    // it. Both come from what the flight actually did.
    const to = (ap.route && ap.route.to) || null;
    $('arrTitle').textContent = good
      ? (to && to.name ? 'Arrived at ' + to.name : 'Arrived')
      : (to && to.name ? 'Short of ' + to.name : 'The flight ended');
    $('arrTag').textContent = good ? (td ? 'landed' : 'stopped')
      : String(outcome).replace(/-/g, ' ');
    el.classList.toggle('bad', !good);
    // THE PLAQUE'S OWN TWO-COLUMN GRAMMAR, so the flight's numbers and the
    // bench's numbers read as the same kind of thing.
    const rows = [];
    const row = (l, v, cls) => rows.push('<div><span>' + l + '</span><b' +
      (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b></div>');
    const L = rep && rep.landing;
    const t1 = telBase + (ap.t || 0);
    const mm = Math.floor(t1 / 60), ss = Math.round(t1 - mm * 60);
    row('outcome', outcome.replace(/-/g, ' '));
    row('flight time', (mm ? mm + ' min ' + String(ss).padStart(2, '0') + ' s'
                           : ss + ' s'));
    row('distance', tel.km.toFixed(1) + ' km');
    if (td) {
      row('touchdown', (td.V * 3.6).toFixed(0) + ' km/h · ' +
                       td.sink.toFixed(2) + ' m/s');
      row('off centreline', Math.abs(td.z).toFixed(1) + ' m');
      row('landing run', Math.round(L ? L.run
        : Math.abs((ap.dbg.s ?? td.x) - td.x)) + ' m');
      row('past the aim', Math.round(L ? L.pastAim : td.x - ap.xAim) + ' m');
    }
    // PEAK STRAIN IS ON THE CARD AND ON THE TRACE, and it is the same number:
    // the trace draws it against time, the card quotes its maximum. Warn ink,
    // because it is the one flight number with a declared envelope behind it
    // (the load test's +3.8 g limit).
    row('peak strain', (tel.hi.str || 0).toFixed(2) + ' %', 'warn');
    const cd = rep && rep.card;
    if (cd && (cd.alt != null || cd.V != null)) {
      const f = (a, v) => [a != null ? Math.round(a) + ' m' : null,
                          v != null ? Math.round(v * 3.6) + ' km/h' : null]
        .filter(Boolean).join(' · ');
      row('test card', f(cd.alt, cd.V));
      row('held', (cd.altFlown != null || cd.VFlown != null)
        ? f(cd.altFlown, cd.VFlown) : 'never settled on the leg');
    }
    $('arrRows').innerHTML = rows.join('');
    // THE PILOT'S OWN WORDS. The last verdict is the prose line under the
    // grid; `What went wrong` opens the rest of them. That button is the door
    // the ROADMAP wants a teaching report behind — until that report exists,
    // it shows the material the report will be BUILT from rather than
    // pretending to be it.
    arrWhy = false;
    arrVerd = (rep && rep.verdicts) || [];
    drawArrNotes();
    const bw = $('bWhy');
    if (bw) {
      bw.hidden = arrVerd.length < 2;
      bw.textContent = 'What went wrong';
    }
    el.hidden = false;
  }
  let arrWhy = false, arrVerd = [];
  function drawArrNotes() {
    const n = $('arrNotes');
    if (!n) return;
    if (!arrVerd.length) { n.innerHTML = ''; return; }
    const list = arrWhy ? arrVerd : arrVerd.slice(-1);
    n.innerHTML = list.map(v => '<i>' + v.t + ' s · ' + v.note + '</i>').join('');
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
      // G152: WHEN, AND FOR HOW LONG. The row carried where it went and how it
      // touched down, and no TIME at all — so a logbook could count flights and
      // could never accrue anything. Hours are the number an aeroplane earns:
      // they are what "my Cub has 40 hours on it" means, and the whole reason a
      // fleet feels like a fleet. `ap.t` is the flight's own clock (and since
      // G151 it includes the taxi, which is honest — that time was flown).
      // OLD ROWS HAVE NEITHER FIELD and never will; every reader treats a
      // missing `t` as "not counted" rather than as zero, so an imported
      // logbook from before today reads as flights-without-hours instead of
      // silently claiming 0.00 h. No version bump: there is nothing to branch a
      // migration on, which is the G105 ruling applied again.
      const stamp = r => {
        r.t = Math.max(0, Math.round(ap.t));
        r.on = new Date().toISOString().slice(0, 10);
        return r;
      };
      if (t) {
        const row = stamp({
          from: fromId, to: destId,
          sink: +t.sink.toFixed(2), V: +(t.V * 3.6).toFixed(0),
          off: +Math.abs(t.z).toFixed(1),
        });
        // the LANDING RUN, when the pilot measured one. The test pilot's
        // report carries it (G107 put it on the plaque); the fleet AP does not,
        // so the field is present or absent rather than faked.
        const L = ap.report && ap.report.landing;
        if (L && L.run != null) row.run = L.run;
        G.log().flights.push(row);
        if (G.note) G.note({ id: 'flight', verdict: 'arrived', ok: true });
      } else if (ap.report && ap.report.outcome) {
        // G107: the test pilot refused the flight — that is a logbook row too,
        // and it still cost the time it took to find out
        G.log().flights.push(stamp({ from: fromId, to: destId,
                                     outcome: ap.report.outcome }));
        if (G.note) G.note({ id: 'flight', verdict: ap.report.outcome,
                             ok: false });
      }
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

  // THE TEST FLIGHT (G107) — the bench row the roadmap has carried since G64,
  // finally with a `run`: a SECOND sim flies the whole circuit on the TEST
  // PILOT, fast-stepped and offscreen, and brings back the LANDING RUN plus
  // the pilot's own report. IN PAGE, per the row's declared decision — the
  // game already runs this exact sim in the browser. Stepping is budgeted by
  // WALL CLOCK per poll (not by step count) so a heavy build slows the test
  // down instead of freezing the panel. Memoised on `def` like the two sheets
  // above: a rebuild takes the flight away with the rest of the certificate.
  let tf = null, tfFor = null, tfVal = null;
  const tfIfRun = () => (tfFor === def ? tfVal : null);
  // `card` (G107.1): { alt: metres, Vkmh: km/h } from the bench's own two
  // fields — units convert HERE, at the UI boundary; the pilot speaks SI.
  function tfStart(card) {
    const s2 = makeSim(def, world);
    s2.reset(0);
    for (let i = 0; i < 600; i++) s2.step(1 / 60);   // parked settle
    const pilot = (typeof makeTestPilot === 'function')
      ? makeTestPilot(s2, def, world) : makeAutopilot(s2, def, world);
    if (pilot.setCard && card && (card.alt || card.Vkmh))
      pilot.setCard({ alt: card.alt || NaN,
                      V: card.Vkmh ? card.Vkmh / 3.6 : NaN });
    // the budget grows with the card's climb; give the runner the same slack
    tf = { sim: s2, ap: pilot, t: 0, maxS: (pilot.budget || 420) + 60, def };
  }
  function tfPoll() {
    if (!tf) return null;
    const t0 = performance.now();
    let fin = null;
    while (performance.now() - t0 < 60 && !fin) {
      for (let i = 0; i < 60; i++) {
        tf.ap.update(1 / 60); tf.sim.step(1 / 60); tf.t += 1 / 60;
        if (tf.sim.stats().bad) { fin = { bad: true }; break; }
        if ((tf.ap.phase === 'STOPPED' && tf.ap.t > 5) || tf.t > tf.maxS) {
          fin = {}; break;
        }
      }
    }
    if (!fin) return { phase: tf.ap.phase, t: tf.t,
                       frac: Math.min(1, tf.t / 300) };
    const rep = tf.ap.report || { verdicts: [], outcome: null, landing: null };
    if (fin.bad) rep.outcome = 'broke-up';
    else if (!rep.outcome) rep.outcome = 'gave-up';
    tfFor = tf.def; tfVal = { report: rep, t: tf.t };
    tf = null;
    return { done: true, report: rep, t: tfVal.t };
  }
  function tfEnd() { tf = null; }

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
    // WHY A ROW IS RED, AND WHAT TO TURN. The user asked for it in these
    // words: "every failure of the test should come accompanied with
    // explanations and recommendations. A simple hover over the values should
    // suffice, with pointers to what parameters to adjust."
    //
    // KEYED ON THE ROW'S OWN LABEL, so the pointers live in ONE place rather
    // than threaded through twenty call sites — and a row that grows a verdict
    // later gets its explanation simply by naming itself.
    //
    // `what` is shown ALWAYS, because a number you do not understand is not
    // much better for being green. `fix` is appended only when the row is
    // actually warn or bad: a clean row does not need telling how to recover.
    // Both name the CONTROLS a builder has rather than the internals — a
    // pointer to a variable nobody can see is not a recommendation.
    const WHY = {
      'best L/D': { what: 'the glide ratio - metres forward per metre down, at '
           + 'the speed it is best, which is printed with it. Real light '
           + 'aeroplanes sit at 8-12, an open-frame ultralight nearer 6-8, a '
           + 'glider 25 and up.',
        fix: 'on a light aeroplane this is PARASITE drag first: cover the '
           + 'fuselage, put spats on the wheels, fair the legs and the struts. '
           + 'Span and a narrower chord help after that. Exposed engines, '
           + 'radiators and an open truss are what an ultralight pays for.' },
      'L/D at cruise': { what: 'lift over drag at the cruise speed the power '
           + 'curve sets (65% of the thrust available). More power buys a '
           + 'faster cruise, and a faster cruise sits further from the best '
           + 'glide - so this number FALLS when you add an engine, and the '
           + 'wing barely moves it.' },
      'climb': { what: 'best rate of climb at sea level, at full power.',
        fix: 'this is power against weight: a bigger engine, a coarser propeller, '
           + 'less structure, or more wing area. Check the empty weight first - '
           + 'covering and fittings add up faster than they look.' },
      'take-off run': { what: 'ground roll plus the climb to the 15 m screen.',
        fix: 'more power or less weight shortens it; so does more wing area and a '
           + 'flap that actually lifts (a plain flap does little). A fine-pitch '
           + 'propeller helps here and costs you cruise speed.' },
      'take-off there': { what: 'the same run at the hot-and-high field.',
        fix: 'thin air takes power and lift together. A normally aspirated engine '
           + 'loses roughly 3% per 300 m of density altitude, so the levers are '
           + 'installed power and weight, in that order.' },
      'climb there': { what: 'rate of climb at the hot-and-high field.',
        fix: 'the same lever as climb but less forgiving - at density altitude '
           + 'the margin is small, so weight comes off before power goes on.' },
      'power there': { what: 'the fraction of sea-level power the engine still makes.',
        fix: 'a normally aspirated engine cannot avoid this. A turbocharged or an '
           + 'electric powerplant holds its output far better with height, and a '
           + 'flat-rated turbine keeps its full rating to a density altitude.' },
      'service ceiling': { what: 'the height at which climb falls to 0.5 m/s.',
        fix: 'power against weight again, and wing area. A low ceiling and a poor '
           + 'climb are the same problem read twice.' },
      'static margin': { what: 'how far the centre of gravity sits ahead of the '
           + 'neutral point, as a fraction of the mean chord, AT THE WORST OF '
           + 'THE FOUR LOADING CORNERS (solo and full cabin, full fuel and '
           + 'reserves). Positive means the aeroplane returns to trim by itself '
           + 'however you load it; the fleet sits near 0.20.',
        fix: 'move mass FORWARD (the engine, the tanks, the seats) or move the '
           + 'wing AFT. A longer tail arm carries the neutral point back and '
           + 'helps both. Negative is unflyable, not merely twitchy.' },
      'as loaded': { what: 'the CG of the aeroplane exactly as it stands — the '
           + 'dummies you have switched on, the fuel you specified — as a '
           + 'fraction of the mean chord behind the leading edge, and its own '
           + 'margin.' },
      'forward corner': { what: 'the loading that puts the CG furthest forward, '
           + 'and where. A published CG range for a real aeroplane is this '
           + 'corner to the aft one.' },
      'aft corner': { what: 'the loading that puts the CG furthest aft. This is '
           + 'the corner the static margin is judged at.',
        fix: 'the aft seat and the tail-end fuel are what move it. Bring the '
           + 'seats forward, or the wing aft, or carry the fuel nearer the '
           + 'wing.' },
      'weathervane': { what: 'directional stiffness (Cn_beta) - how hard the '
           + 'aeroplane points itself back into the airflow. The Cub reads 0.11.',
        fix: 'fin AREA and fin HEIGHT both move it, and so does a longer tail '
           + 'arm. Under 0.03 it wanders; negative and it swaps ends.' },
      'stands on': { what: 'what the aeroplane is actually resting on, measured '
           + 'rather than assumed.',
        fix: 'if it is not on its wheels the undercarriage geometry is wrong - '
           + 'leg length, rake, and where the mains sit relative to the CG.' },
      'prop clear': { what: 'propeller tip to the ground in the resting attitude.',
        fix: 'longer undercarriage legs, a smaller propeller disc, or raise the '
           + 'thrust line. Under 0.05 m it strikes on any soft field.' },
      'nose-over': { what: 'the angle from the mains to the CG - how hard you can '
           + 'brake before it goes on its nose.',
        fix: 'move the main wheels FORWARD, or the CG aft. Under 15 degrees is a '
           + 'taildragger that will not forgive a firm brake.' },
      'gear': { what: 'the undercarriage as built.',
        fix: 'FOLDED means it collapsed under its own weight - the legs are too '
           + 'soft, or the aeroplane is too heavy for them.' },
      'outcome': { what: 'whether the test pilot completed the circuit.',
        fix: 'read the pilot notes below - the circuit stopped somewhere, and the '
           + 'phase it stopped in names the problem.' },
      'landing run': { what: 'roll from touchdown to a stop.',
        fix: 'a lower stall speed is almost the whole of it - more wing area, or '
           + 'a flap that lifts. The approach speed follows the stall.' },
      'touchdown': { what: 'sink rate and speed at the moment the wheels arrive.',
        fix: 'a firm arrival is usually approach speed or the flare. More wing '
           + 'area lowers both; softer gear absorbs what is left.' },
      'past the aim': { what: 'how far beyond the aiming point it touched down.',
        fix: 'floating means too much speed on the approach for the drag '
           + 'available; a flap that adds drag as well as lift settles it.' },
      'held': { what: 'what the pilot actually flew on the cruise leg, against '
           + 'what the test card asked for.',
        fix: 'the aeroplane could not hold the ask. Speed short is drag or power; '
           + 'height short is climb.' },
      'pilot notes': { what: 'bounded verdicts the test pilot recorded in flight.',
        fix: 'each code names one thing it did not like - the newest is shown.' },
    };
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // EVERY NUMBER SAYS WHAT IT IS JUDGED AGAINST (G179.4, the user: "all
    // numbers should give their acceptable bounds. I don't know what I'm
    // working against"). ONE table: the verdict colour and the printed bound
    // both read it, so they cannot disagree, and a row with no entry is
    // information, not a judgement. `lo`/`hi` are the ok band's edges (warn
    // past them, or bad when `badAtLo` says the band's edge is the red one);
    // `badLo`/`badHi` the red edges; `text` is what the row prints.
    const BOUNDS = {
      'best L/D':        { lo: 6, text: '\u2265 6' },
      'climb':           { lo: 0.5, badAtLo: true, text: '\u2265 0.5 m/s' },
      'take-off run':    { hi: 500, badHi: 1100, text: '\u2264 500 m' },
      'take-off there':  { hi: 500, badHi: 1100, text: '\u2264 500 m' },
      'climb there':     { lo: 0.3, badAtLo: true, text: '\u2265 0.3 m/s' },
      'power there':     { lo: 75, text: '\u2265 75%' },
      'service ceiling': { lo: 500, text: '\u2265 500 m' },
      'as loaded':       { text: 'margin \u2265 0.05' },
      'static margin':   { lo: 0.05, badLo: 0, text: '\u2265 0.05' },
      'weathervane':     { lo: 0.03, badLo: 0, text: '\u2265 0.03' },
      'prop clear':      { lo: 0.12, badLo: 0.05, text: '\u2265 0.12 m' },
      'nose-over':       { lo: 15, text: '\u2265 15\u00b0' },
      'power nose-over': { hi: 0.75, badHi: 1, text: '< 0.75' },
    };
    const judge = (label, v) => {
      const b = BOUNDS[label];
      if (!b || v == null || !isFinite(v)) return '';
      if (b.badLo != null && v < b.badLo) return 'bad';
      if (b.badHi != null && v > b.badHi) return 'bad';
      if (b.lo != null && v < b.lo) return b.badAtLo ? 'bad' : 'warn';
      if (b.hi != null && v > b.hi) return 'warn';
      return '';
    };
    const R = (label, val, cls, why) => {
      const w = why !== undefined ? why : WHY[label];
      const bnd = BOUNDS[label];
      let t = '';
      if (w) t = typeof w === 'string' ? w
              : (w.what || '') + (cls && w.fix ? ' \u2014 ' + w.fix : '');
      if (bnd) t += (t ? ' \u00b7 ' : '') + 'judged against ' + bnd.text;
      if (bnd) val = val + ' <i>' + bnd.text + '</i>';
      // A ROW THAT DOES NOT FIT HALF THE PLATE TAKES THE WHOLE PLATE
      // (2026-09-03, the user: "the formatting of the plaque is
      // unacceptable"). The sheet is a two-column grid and a value cell could
      // not shrink, so '14.5 kg/h (20 L/h)' or 'coarse (cruise)' pushed its
      // column past the panel edge and the clip took the number with it --
      // '97 kr', '218', '5.2' -- and the burn-off line ran across its
      // neighbour. The threshold is the widest value the half-width holds at
      // this type size; anything past it spans, and its value may wrap.
      const wide = String(val).length > 11 || String(label).length > 15;
      rows.push('<div class="r' + (cls ? ' ' + cls : '') + (wide ? ' wide' : '') +
        '"' + (t ? ' title="' + esc(t) + '"' : '') +
        '><span>' + label + '</span><b>' + val + '</b></div>');
    };
    H('weights');
    R('empty', n1(s.empty, 0) + ' kg');
    R('payload', n1(s.payload, 0) + ' kg');
    R('all-up', n1(s.mass, 0) + ' kg');
    R('cost', n1(s.cost, 0));
    H('wing');
    R('area', n1(s.Sw, 1) + ' m²');
    R('loading', n1(s.wingLoad, 1) + ' kg/m²');
    R('aspect', n1(s.AR, 1));
    R('best L/D', n1(s.LDbest, 1) + ' at ' + n1((s.VbestLD || 0) * 3.6, 0) + ' km/h',
      judge('best L/D', s.LDbest));
    R('L/D at cruise', n1(s.LD, 1));
    H('speeds & field');
    R('stall', n1(s.Vs * 3.6, 0) + ' km/h');
    R('cruise', n1(s.VCruise * 3.6, 0) + ' km/h');
    R('climb', n1(s.climbRate, 2) + ' m/s', judge('climb', s.climbRate || 0));
    R('take-off run', n1(s.TORun, 0) + ' m', judge('take-off run', s.TORun || 0));
    // IN THIN AIR (G72) — only when its own bench test has been run on THIS
    // build, so the section is earned the same way the plaque is.
    const da = densAltIfRun();
    if (da) {
      const hot = da.cases.filter(c => c.id === 'hot')[0];
      H('in thin air');
      if (hot) {
        R('density altitude', n1(hot.densAlt, 0) + ' m');
        R('take-off there', n1(hot.TORun, 0) + ' m', judge('take-off there', hot.TORun || 0));
        R('climb there', n1(hot.climbRate, 2) + ' m/s', judge('climb there', hot.climbRate || 0));
        R('power there', n1((hot.power || 1) * 100, 0) + '%',
          judge('power there', (hot.power || 1) * 100));
      }
      const cap = v => v == null ? '> ' + n1(da.ceilingCap, 0) + ' m' : n1(v, 0) + ' m';
      R('service ceiling', cap(da.serviceCeiling),
        da.serviceCeiling == null ? '' : judge('service ceiling', da.serviceCeiling));
      R('absolute ceiling', cap(da.absCeiling));
    }
    // ON THE TEST FLIGHT (G107) — only when the test-pilot circuit has been
    // flown on THIS build; the landing run is a number nothing else computes.
    const tfr = tfIfRun();
    if (tfr && tfr.report) {
      const rep = tfr.report, L = rep.landing;
      H('on the test flight');
      R('outcome', rep.outcome || '—',
        rep.outcome === 'completed' ? '' : 'bad');
      if (L) {
        R('landing run', n1(L.run, 0) + ' m',
          (L.run || 0) > 500 ? 'warn' : '');
        R('touchdown', n1(L.sink, 2) + ' m/s · ' + n1(L.V * 3.6, 0) + ' km/h',
          (L.sink || 0) > 1.8 ? 'warn' : '');
        R('past the aim', n1(L.pastAim, 0) + ' m',
          Math.abs(L.pastAim || 0) > 150 ? 'warn' : '');
      }
      // the TEST CARD (G107.1): what was asked, what was flown — the flown
      // means from the settled cruise leg, judged against the ask
      const cd = rep.card;
      if (cd && (cd.alt != null || cd.V != null)) {
        const ask = [cd.alt != null ? n1(cd.alt, 0) + ' m' : null,
                     cd.V != null ? n1(cd.V * 3.6, 0) + ' km/h' : null]
          .filter(Boolean).join(' · ');
        R('test card', ask);
        const short = (cd.alt != null && cd.altFlown != null
                        && cd.altFlown < cd.alt * 0.93)
                   || (cd.V != null && cd.VFlown != null
                        && cd.VFlown < cd.V * 0.93);
        const flew = [cd.altFlown != null ? n1(cd.altFlown, 0) + ' m' : null,
                      cd.VFlown != null ? n1(cd.VFlown * 3.6, 0) + ' km/h' : null]
          .filter(Boolean).join(' · ');
        R('held', flew || '— never settled on the leg', short || !flew ? 'warn' : '');
      }
      if (rep.verdicts.length)
        R('pilot notes', rep.verdicts.length + ' — ' +
          rep.verdicts[rep.verdicts.length - 1].code, 'warn');
    }
    // G134: THE POWERPLANT SHEET — the thermo laws' first readout (the name
    // and horsepower stay in the footer, as ever). The duty is the heat the
    // cowl will one day have to swallow (the ventilation arc consumes it);
    // the burn is full-throttle shaft work through the family SFC, quoted
    // now so the consumption arc lands on a number the player has already
    // lived with. The litres use the MEDIUM'S density off the sheet (Jet-A
    // 0.80, avgas 0.72 — 2026-09-05); 0.72 only for a sheet that predates it.
    if (s.coolKW != null) {
      H('powerplant');
      if (s.engineFamily === 'electric')
        R('full-throttle draw', n1(s.drawKW, 1) + ' kW');
      else if (s.burnKgH != null)
        R('full-throttle burn', n1(s.burnKgH, 1) + ' kg/h (' +
          n1(s.burnKgH / (s.energyKgL || 0.72), 0) + ' L/h)');
      R('cooling duty', n1(s.coolKW, 0) + ' kW · ' +
        (s.engineCooling === 'liquid' ? 'by radiator' : 'by fins'));
    }
    H('balance');
    R('CG', n1(s.cgX, 2) + ' m');
    R('neutral pt', n1(s.npX, 2) + ' m');
    // THE CG ENVELOPE (2026-09-03): the four loading corners, the margin at
    // the worst of them. The as-drawn number is still shown, named for what
    // it is, so a builder can see which corner they happen to be sitting in.
    const E = s.envelope;
    const pc = v => v == null ? '\u2014' : n1(v * 100, 0) + '% MAC';
    const smCls = v => judge('static margin', v || 0);
    if (E && E.aft && E.fwd) {
      R('as loaded', pc(E.cgPct) + ' \u00b7 margin ' + n1(s.staticMargin, 2),
        smCls(s.staticMargin));
      R('forward corner', E.fwd.label + ' \u00b7 ' + pc(E.fwd.cgPct));
      R('aft corner', E.aft.label + ' \u00b7 ' + pc(E.aft.cgPct));
      R('static margin', n1(E.staticMarginAft, 2) + ' \u00b7 ' + E.worst.label,
        smCls(E.staticMarginAft));
    } else {
      // the fleet's own band: the Cub measures 0.22, the stock build 0.20.
      // Under 0.05 is twitchy; negative is unflyable.
      R('static margin', n1(s.staticMargin, 2), smCls(s.staticMargin));
    }
    // G115: the directional half, at last — the fin was the one surface with
    // no readout. Measured Cn_beta (weathervane stiffness): the stock build
    // reads 0.08, the Cub family 0.11; under 0.03 is a wanderer, negative
    // swaps ends. Fin AREA and fin HEIGHT both move it now.
    if (s.cnBeta != null)
      R('weathervane', n1(s.cnBeta, 3), judge('weathervane', s.cnBeta || 0));
    // G121: the sheet AT RESERVES — the same airframe with 15% fuel. The
    // static margin is the row this group exists for: with a nose or
    // outboard tank it genuinely moves as the fuel goes, and a plaque that
    // quotes one mass would be lying the day burn arrives.
    if (s.reserve) {
      H('at reserves (' + n1(s.reserve.litres, 0) + ' L)');
      R('all-up', n1(s.reserve.mass, 0) + ' kg');
      R('stall', n1(s.reserve.Vs * 3.6, 0) + ' km/h');
      // the margin at reserves is one of the envelope's corners now and is
      // judged there; this sheet keeps the numbers that are only about fuel
      if (!(E && E.aft))
        R('static margin', n1(s.reserve.staticMargin, 2),
          smCls(s.reserve.staticMargin));
      R('climb', n1(s.reserve.climbRate, 2) + ' m/s');
    }
    H('on the ground');
    R('stands on', s.onWheels ? 'its wheels' : (s.restsOn || '—'),
      s.onWheels ? '' : 'bad');
    R('deck angle', n1(s.deckAngle, 1) + '°');
    // G98: THE ENERGY AND WHAT HOLDS IT. The tank used to be invisible on
    // this sheet because it weighed nothing; now it is a thing you bought and
    // it says so, beside the fuel or the cells it holds.
    if (s.energyKind) {
      H(s.energyKind === 'battery' ? 'the pack' : 'fuel and tank');
      R(s.energyKind === 'battery' ? 'cells' : 'fuel', s.energyMedium);
      R(s.vesselName, n1(s.vesselKg, 1) + ' kg');
      R(s.energyKind === 'battery' ? 'cell mass' : 'fuel aboard',
        n1(s.energyKg, 1) + ' kg' +
        (s.energyKind === 'battery' ? ' · empty weight' : ' · payload, and it burns off'));
      R('room needed', n1(s.energyL, 0) + ' L');
      // G99: WHERE IT SITS, AND WHETHER IT FITS. A vessel is a real solid in a
      // declared bay now, so the sheet says which bay, how full of it the
      // vessel is, and whether the bay can take it at all.
      for (const v of (s.vessels || []))
        R(v.bayName + (v.feed === 'gravity' ? ' · gravity fed' : ''),
          n1(v.capacity, 0) + (s.energyKind === 'battery' ? ' kWh' : ' L') +
          ' · ' + n1(v.needL, 0) + ' of ' + n1(v.roomL, 0) + ' L' +
          (v.fits ? '' : ' — DOES NOT FIT'),
          v.fits ? (v.fill > 0.85 ? 'warn' : '') : 'bad',
          // a bay row's label is the BAY's own name, so it cannot be keyed by
          // label like the rest - it hands its explanation over directly.
          { what: 'what this vessel holds, against the room the bay actually has.',
            fix: 'move it to a larger bay, split it across two, or ask for less '
               + 'capacity. A wing bay grows with span and chord; a body bay '
               + 'grows with the cabin length and the fuselage section.' });
    }
    if (s.propPitch)
      R('propeller pitch',
        (s.propPitch === 'climb' ? 'fine (climb)'
          : s.propPitch === 'cruise' ? 'coarse (cruise)' : 'standard') +
        (s.propPitchAuto ? ' · chosen for you' : ''));
    R('prop clear', n1(s.propClear, 2) + ' m', judge('prop clear', s.propClear || 0));
    R('nose-over', n1(s.noseOver, 0) + '°', judge('nose-over', s.noseOver || 0));
    // G179: a high thrust line on a taildragger — over on power alone at >= 1
    if (s.powerOver > 0.5)
      R('power nose-over', n1(s.powerOver, 2) + ' ×' +
        (s.groundThrCap < 1 ? ' · pilots hold ' + n1(s.groundThrCap * 100, 0) + '% until the tail is up' : ''),
        judge('power nose-over', s.powerOver));
    if (s.gearFolded) R('gear', 'FOLDED', 'bad');
    $('pqRows').innerHTML = rows.join('');
    $('pqNote').textContent = s.engineName + ' · ' + n1(s.hp, 0) + ' hp · ' +
      s.propName + ' · ' + s.gearType +
      (s.gearFairing ? ' (' + s.gearFairing + ')' : '') + ' · ' + s.bracing +
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
    applySkinVis();     // hides the mesh under the cage build
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
    showCage = false; applySkinVis();  // the MESH flies, not the editor's cage
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
    // FLY ON (the flight rebaseline). The old card carried `Fly again` and the
    // bar's `Fly the circuit` went dead after a landing; there is one primary
    // verb now, at the far right of the top row, and after a stop it means
    // reset-and-go — which is the whole of that dead end fixed.
    if (!inGarage && (flightOver || (started && ap.phase === 'STOPPED'))) {
      $('arrCard').hidden = true;
      fullReset();
      started = true;
      return;
    }
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
  // THE ARRIVAL CARD'S OWN TWO BUTTONS (the flight rebaseline). They belong
  // to the FLIGHT, which is why they are on the card and not on the top row —
  // and neither of them is a way OUT of the screen, because `Fly on` and
  // `The shed` up there already are.
  //
  // `Log the flight` does not do the logging: logFlight() has written the row
  // the moment the aeroplane stopped, since G65, and a button that claimed to
  // write it would be claiming something untrue. It is the door TO the book —
  // it takes you to the shed, where the logbook is, with the row already in it.
  if ($('bLog')) $('bLog').onclick = () => {
    $('arrCard').hidden = true; arrivalShown = false;
    enterGarage();
    openEditor();
  };
  // `What went wrong` opens the rest of the pilot's verdicts. The teaching
  // report the ROADMAP wants lands behind this button; until it does, this
  // shows the material it will be built from rather than pretending to be it.
  if ($('bWhy')) $('bWhy').onclick = () => {
    arrWhy = !arrWhy;
    $('bWhy').textContent = arrWhy ? 'Fewer notes' : 'What went wrong';
    drawArrNotes();
  };
  // G130: the door home is ON THE BAR now, not only on the arrival card — a
  // circling flight, a hopeless climb, a leg abandoned mid-way all walk back.
  if ($('bHangar2')) $('bHangar2').onclick = () => {
    $('arrCard').hidden = true; arrivalShown = false;
    flyOpenSet(null);
    enterGarage();
    openEditor();
  };
  function fullReset() {
    if (inGarage) return enterGarage();   // Reset in the garage means back to the stand
    sim.reset(0); ap = mkPilot(curKey); applyRoute(); started = false; running = true;
    $('bPause').textContent = 'Pause'; $('bPause').classList.remove('on');
    telClear(); telLast = null; telHover = -1;
    lastPhase = 'ROLL'; telBase = 0; flightLogged = false; flightOver = false;
    $('arrCard').hidden = true; arrivalShown = false;
    // THE TRACE IS A SUMMONED PANEL NOW, and a summoned panel is the player's:
    // fullReset used to close it, which is why the one number a flight
    // produced kept disappearing. It empties, it does not close.
    $('tsum').textContent = '';
    railPhase = ''; setRail(null);
  }
  $('bReset').onclick = fullReset;
  // selecting the Garage build puts you IN the garage. Since G35 the garage's
  // editor is the CAGE EDITOR overlay — it opens with the garage, and closing
  // it leaves you at the stand (builds bar, env buttons, Roll out & fly).
  // G135 hid the menu behind this and left it holding the garage build alone;
  // the fleet's keys retired with the fiches (2026-09-05). It stays the
  // aircraft-change door UISMOKE drives — the gate switches aeroplane through
  // exactly this code path.
  $('selAc').onchange = e => {
    setAircraft(e.target.value);
    enterGarage(); openEditor();
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
    // THE OTHER HALF (G142, user: "a view where half of our plane is cutout,
    // but the other half compared to the reference plane"). setClipping above
    // only ever cut the REFERENCE, because a clipping plane is a material
    // setting and refplane.js owns its own materials. Cutting the BUILD is a
    // different thing entirely: those materials belong to the editor, they are
    // rebuilt from scratch on every slider drag, and refplane.js is forbidden
    // from reaching them (GATE REF's ONE ROOT list). So the mount does it, and
    // the reference only ever ASKS.
    //
    // THE PLANES ARE REMEMBERED, not just applied, and that is the whole
    // subtlety: a build that is rebuilt mid-comparison comes back with fresh
    // materials carrying no clip, and the composite aeroplane silently becomes
    // two whole ones overlapping. applyVis calls this again with the stored
    // value for exactly that reason.
    setBuildClip: planes => {
      buildClip = (planes && planes.length) ? planes : null;
      applyBuildClip();
    },
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
  // THE BUILD'S OWN CLIPPING PLANES (G142), and nothing else in the project
  // sets them. Kept here beside the mount it acts on rather than in
  // refplane.js, which is not allowed to touch the editor's materials.
  //
  // MATERIALS, NOT MESHES. The aeroskin is one material shared across most of
  // the aeroplane (G109-G113), so the walk collects the distinct materials and
  // writes each one once — a few dozen writes rather than a few thousand. A
  // material that is not ours to un-clip is never seen: this only ever walks
  // edSitP, and only the reference asks it to.
  let buildClip = null;
  function applyBuildClip() {
    const seen = new Set();
    edSitP.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        // ONLY CLEAR WHAT WE SET. `clippingPlanes` is null on an untouched
        // material, so writing null back is a no-op for anything we did not
        // clip — but if a future feature ever gives the build its own plane,
        // this is the line that would trample it, and it should learn to merge
        // rather than assign.
        m.clippingPlanes = buildClip;
        m.needsUpdate = true;
      }
    });
  }
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
    // THE CAGE ONLY EVER HIDES; IT NEVER SHOWS. With the cage standing, none
    // of the model's meshes belong on screen. With it down, WHICH of them
    // show is applySkinVis's ruling — this function forcing them all visible
    // for every flight was the always-on truss over the covered aeroplane,
    // the second shadow caster (proxy AND skin), and the re-show half of the
    // Frame-mode freeze.
    if (showCage) {
      if (model && model.grp) model.grp.visible = false;
      if (proxy && proxy.mesh) proxy.mesh.visible = false;
      if (lines) lines.visible = false;
      if (pts) pts.visible = false;
    }
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
    // G107.1: "untested" was accusing TESTED aeroplanes — a build whose test
    // flight was refused read "Roll out untested", which is the one thing it
    // is not. Three states, three sentences: never a lock, ever.
    const untested = st && !st.passed;
    b.textContent = !untested ? 'Roll out & fly'
      : st.any ? 'Roll out — not passed' : 'Roll out untested';
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
    refreshInterior();
    // THE HALF-AND-HALF SURVIVES A REBUILD (G142). Every slider drag throws
    // the build's meshes and materials away and makes new ones, and a new
    // material carries no clipping plane — so without this the composite
    // aeroplane quietly becomes two whole ones overlapping, at the exact
    // moment you are dragging a slider to compare them.
    applyBuildClip();
    if (typeof window.BENCH_DIRTY === 'function') window.BENCH_DIRTY();
    // THE AUTOSAVE FOLLOWS THE EDITOR (2026-09-03). The shelf's `spec` is a
    // cache of these parameters and nothing refreshed it between roll-outs,
    // so a reload lost every slider moved since. Debounced inside the shelf —
    // a commit runs the whole join, so it rides the pause after a drag rather
    // than every pixel of one.
    if (window.GARAGE_SPEC && window.GARAGE_SPEC.touch)
      window.GARAGE_SPEC.touch();
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
    // G190: the autosave's image pages come back before the editor exists;
    // the seed is the first moment they can be baked onto the atlas
    try {
      const G = window.GARAGE_SPEC;
      if (E.decalImagesFrom && G && G.images) E.decalImagesFrom(G.images() || {});
    } catch (err) { console.error('cage editor seed (images):', err); }
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
    // G187: nothing of the editor's chrome outlives the switch — the colour
    // picker used to (a strip off <body>, closed by timers), and sat over the
    // runway. It hides with #edWrap now, and is told as well.
    if (!ws && window.CAGE_RECENT && window.CAGE_RECENT.hide)
      window.CAGE_RECENT.hide();
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
    if (window.CAGE_RECENT && window.CAGE_RECENT.hide) window.CAGE_RECENT.hide();
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
      ap = mkPilot(curKey);
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

  // THE PFD CARRIES WHAT YOU ASKED IT TO (the flight rebaseline). Three
  // readouts always — IAS, ALT, VS — and six the `instruments` flyout can add.
  // The twelve-cell telemetry grid is gone: AoA, bank, AGL, throttle, TAS and
  // power became these six; OAT and density altitude became live rows in the
  // `air` flyout, because they are what the AIR is doing and not what the
  // AEROPLANE is doing; peak strain became a line on the trace; and elevator,
  // aileron and rudder went, because a control POSITION is what the autopilot
  // is holding, not something the screen is being asked.
  const R = ['ias','alt','vs','aoa','bank','agl','thr','tas','pwr']
    .reduce((o, k) => (o[k] = $('r-' + k), o), {});
  const RD = {};
  for (const d0 of document.querySelectorAll ? document.querySelectorAll('#pfdRow .rd') : [])
    RD[d0.dataset.i] = d0;
  function hud() {
    const o = sim.out, cg = sim.cgPos(), c = sim.ctl, d = ap.dbg;
    // THE LABEL SAYS IAS, so the number is now an indicated one (G72). It read
    // o.V, which is TRUE airspeed — identical at sea level and a lie everywhere
    // else, on the one instrument a pilot would use to decide not to stall.
    const ias = (o.Veas ?? o.V) * 3.6;
    R.ias.textContent = ias.toFixed(0);
    R.alt.textContent = cg[1].toFixed(0);
    R.vs.textContent = (o.vs >= 0 ? '+' : '') + o.vs.toFixed(1);
    // NO GREEN: ok is simply the ink, and warn is only ever used against a
    // number the PLAQUE actually declares. The stall is one — genShakedown
    // has measured `Vs` since G4 and the bench check quotes it. Vne and a
    // sink-rate limit are NOT declared anywhere in this project, so those two
    // warns are OWED rather than invented; see the handover.
    // ...AND ONLY IN THE AIR. Below the stall on the runway is not a stall,
    // it is a take-off roll, and a readout that shouts through every one of
    // them is a readout nobody reads.
    if (RD.ias) RD.ias.classList.toggle('warn',
      !!(started && flVs > 0 && (d.agl || 0) > 3 && ias < flVs * 3.6));
    if (!instOn) return;
    if (instOn.aoa) R.aoa.textContent = (o.alpha * 57.3).toFixed(1);
    if (instOn.bank) R.bank.textContent = ((d.ph || 0) * 57.3).toFixed(1);
    if (instOn.agl) R.agl.textContent = (d.agl || 0).toFixed(0);
    if (instOn.thr) R.thr.textContent = (c.eng && c.eng.length > 1)
      ? c.eng.map(e => (c.thr * (e.on ? e.thr : 0) * 100).toFixed(0)).join('·')
      : (c.thr * 100).toFixed(0);
    if (instOn.tas) R.tas.textContent = (o.V * 3.6).toFixed(0);
    if (instOn.pwr) R.pwr.textContent = ((o.powerK ?? 1) * 100).toFixed(0);
    // the air's own numbers, in the flyout that is about the air (G72's OAT
    // and density altitude, which were two of the twelve cells)
    if (flyOpen === 'air') flAirLive(o);
    if (flyOpen === 'engines' && o.thrustPer)
      for (let i = 0; i < o.thrustPer.length; i++) {
        const el = $('flEngT' + i);
        if (el) el.textContent = (o.thrustPer[i] || 0).toFixed(0) + ' N';
      }
  }

  // ---- W13 minimap: baked terrain underlay (from render_world) + live
  // route / aerodromes / aircraft / wind. Redrawn on the HUD cadence.
  // Click the map to toggle small/large; click the top-right chip to
  // switch north-up (whole domain) <-> nose-up (6 km, aircraft-centred).
  let mapBig = false, mapNoseUp = false;
  let mapBaseCv = null, mapBaseFor = null;   // G130: cached north-up underlay
  const NOSE_RANGE = 6000;
  function drawMap() {
    const base = WF.minimap, cv = $('mm');
    if (!base || !cv.getContext || !sim) return;   // G194: a persisted 'large map' drew it at boot, before the sim
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
    // G130: in north-up the underlay is one CONSTANT picture per canvas
    // size (sea fill + the whole 24 km bake), and it was re-composited ten
    // times a second — at 1024² with the map open large. Composite it once
    // into an offscreen canvas and blit; nose-up stays live, its frame
    // moves with the aircraft.
    let blitted = false;
    if (!mapNoseUp) {
      try {
        if (!mapBaseCv || mapBaseCv.width !== W2 || mapBaseFor !== base) {
          const oc = document.createElement('canvas');
          oc.width = oc.height = W2;
          const bg = oc.getContext('2d');
          bg.fillStyle = '#48899e';                    // beyond-domain reads as sea
          bg.fillRect(0, 0, W2, W2);
          bg.translate(W2 / 2, W2 / 2); bg.scale(k, k);
          bg.drawImage(base, -12000, -12000, 24000, 24000);
          mapBaseCv = oc; mapBaseFor = base;
        }
        g.drawImage(mapBaseCv, 0, 0);
        blitted = true;
      } catch (e) { mapBaseCv = null; }                // a shim canvas: live path
    }
    if (!blitted) {
      g.fillStyle = '#48899e';                         // beyond-domain reads as sea
      g.fillRect(0, 0, W2, W2);
      g.save();
      g.translate(W2 / 2, W2 / 2); g.rotate(rot); g.scale(k, k); g.translate(-cx, -cz);
      g.drawImage(base, -12000, -12000, 24000, 24000);
      g.restore();
    }
    const from = aeroById(fromId), to = destId === 'CIRCUIT' ? from : aeroById(destId);
    if (to !== from) {
      g.strokeStyle = 'rgba(255,178,87,.85)'; g.lineWidth = 2 * mk; g.setLineDash([5 * mk, 4 * mk]);
      g.beginPath(); g.moveTo(PX(from.x, from.z), PY(from.x, from.z));
      g.lineTo(PX(to.x, to.z), PY(to.x, to.z)); g.stroke();
      g.setLineDash([]);
    }
    // G193: the patterns on the map — the two glide-slope tracks and the two
    // touchdown targets of the aerodromes in play, the active slope brighter,
    // and the taxi graph once the map is nose-up (at 24 km per 344 px a 100 m
    // taxiway is a pixel)
    if (patOnGet().map && ap.patOf) {
      const aes = to !== from ? [from, to] : [from];
      for (const a of aes) {
        const P = ap.patOf(a);
        if (!P || !P.approaches) continue;
        for (const apr of P.approaches) {
          const act = ap.frame && ap.frame.k === apr.k && a.id === (ap.route && ap.route.to && ap.route.to.id);
          g.strokeStyle = act ? 'rgba(143,215,255,.95)' : 'rgba(143,215,255,.45)';
          g.lineWidth = (act ? 2 : 1.2) * mk; g.setLineDash([4 * mk, 3 * mk]);
          g.beginPath(); g.moveTo(PX(apr.aimAP[0], apr.aimAP[1]), PY(apr.aimAP[0], apr.aimAP[1]));
          g.lineTo(PX(apr.aimAP[0] - apr.u[0] * 2500, apr.aimAP[1] - apr.u[1] * 2500),
                   PY(apr.aimAP[0] - apr.u[0] * 2500, apr.aimAP[1] - apr.u[1] * 2500));
          g.stroke(); g.setLineDash([]);
          g.beginPath(); g.arc(PX(apr.td[0], apr.td[1]), PY(apr.td[0], apr.td[1]), 3 * mk, 0, 6.283);
          g.fillStyle = act ? '#8fd7ff' : 'rgba(143,215,255,.6)'; g.fill();
        }
        if (mapNoseUp && typeof patternPath === 'function') {
          g.strokeStyle = 'rgba(255,178,87,.8)'; g.lineWidth = 1.5 * mk;
          for (const T of [0, 1]) for (const kind of ['out', 'back']) {
            const ids = P.routes && P.routes[kind] && P.routes[kind][T];
            if (!ids) continue;
            let path; try { path = patternPath(P, ids, 1.0); } catch (e) { continue; }
            g.beginPath();
            for (let i = 0; i < path.pts.length; i += 4) {
              const q = path.pts[i];
              if (i === 0) g.moveTo(PX(q.x, q.z), PY(q.x, q.z)); else g.lineTo(PX(q.x, q.z), PY(q.x, q.z));
            }
            g.stroke();
          }
          for (const h of P.stops || []) {
            const nd = P.nodes.find(n => n.id === h);
            if (!nd) continue;
            g.beginPath(); g.arc(PX(nd.x, nd.z), PY(nd.x, nd.z), 2.6 * mk, 0, 6.283);
            g.fillStyle = '#ffd35a'; g.fill();
          }
        }
      }
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

  // =========================================================================
  // THE FLIGHT INTERFACE (the flight-rebaseline handoff, Claude Design)
  // =========================================================================
  // The workshop was rebaselined at G77-G108 around one rule; this is the same
  // pass over the other screen. THE EDITOR'S RULE IS SPATIAL — every surface
  // has exactly one job. Flight has a before, during and after the editor does
  // not, so its rule is TEMPORAL: the screen answers what am I flying / what
  // is it doing / what happened, in the order the flight asks them, and
  // nothing that answers one stays on screen while another is being asked.
  //
  // Four surfaces, and nothing appears in two of them: the top bar (the brief
  // and the verbs), the bottom-left rail (how you look), the bottom-right PFD
  // (what it is doing, phase rail inside), and the summoned panels.
  //
  // NO NEW SOURCE OF TRUTH. Every decision is still one of app.js's own
  // selects, still in the DOM (#flStore) and still carrying its own handler;
  // the plate renders them and the flyouts drive them. That is why this
  // rebaseline touched no state machine: `setAircraft`, `fromId`/`destId` and
  // `selCond`'s weather handler are the writers they always were.
  const FL = { ready: false };
  const flS = k => $('sel' + k);

  // ---- what the player has chosen about LOOKING, and it is remembered ------
  // View state is not the aeroplane: it never flies and it never lands in a
  // saved build (G106). It is a pref, beside `cageExpert`.
  const flPref = (k, d) => {
    try { const v = JSON.parse(prefGet('flydiy.fl' + k, 'null'));
          return (v && typeof v === 'object') ? Object.assign({}, d, v) : Object.assign({}, d); }
    catch (e) { return Object.assign({}, d); }
  };
  const flSave = (k, v) => prefSet('flydiy.fl' + k, JSON.stringify(v));
  // G193: which pattern layers are shown (off by default: no change on screen
  // until asked)
  const patOn = flPref('Pat', { graph: false, slope: false, targets: false, map: false });
  // THESE TWO REPLACE `#mmp.big` AND `#telp.show`. The map and the trace were
  // permanent panels; they are summoned now, so whether they are up is the
  // player's and is kept.
  // `pos` is where the player has PUT each panel, keyed by id — geometry, not
  // a decision (see flPlace / flLayout). `pfdSmall` is the compact PFD.
  const panels = flPref('Panels', { map: false, trace: false, big: false,
                                    noseUp: false, pfdSmall: false, pos: {} });
  if (!panels.pos || typeof panels.pos !== 'object') panels.pos = {};
  // WHICH READOUTS THE PFD CARRIES. The other cells do not hide — they stopped
  // existing. Three is right for watching; a builder debugging a wing wants
  // more, and that is what this is for.
  const instOn = flPref('Inst', { aoa: false, bank: false, agl: false,
                                  thr: false, tas: false, pwr: false });
  // WHICH LANES ARE DRAWN. The default is the five a builder watches on a
  // first circuit — where it got to, how fast, whether it was climbing, what
  // the pilot was asking of the engine, and what the airframe was taking.
  // The other ten are one click away in the legend.
  // THREE ON, TO START (the user: "only speed, altitude and throttle enabled
  // by default"). The other six are one click away in the legend.
  const traceOn = flPref('Trace', { alt: true, tas: true, thr: true });
  const cam = flPref('Cam', { mode: 'orbit', fov: 46, level: true, lead: 0.35 });
  mapBig = !!panels.big; mapNoseUp = !!panels.noseUp;

  // ---- the rail: five questions about looking -----------------------------
  // `camera` is editor.js's own glyph, verbatim. The other four are new, drawn
  // to the same 18-box and the same 1.35 stroke, because a rail that is half
  // one hand and half another is not a rail.
  const FL_RAIL = [
    { k: 'camera', label: 'camera', title: 'How the flight is framed',
      icon: 'M4 5.5h2.2l1-1.5h3.6l1 1.5H14a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z|M9 11.6a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z' },
    { k: 'instruments', label: 'instruments', title: 'What the PFD carries',
      icon: 'M9 15.4A6.4 6.4 0 1 0 9 2.6a6.4 6.4 0 0 0 0 12.8Z|M9 9l3.1-2.6|M9 4.6v1.1|M13.4 9h-1.1|M4.6 9h1.1' },
    { k: 'map', label: 'map', title: 'Where the aeroplane is',
      icon: 'M6.6 3.2 2.8 4.8v10l3.8-1.6 4.8 1.6 3.8-1.6v-10l-3.8 1.6-4.8-1.6Z|M6.6 3.2v10.6|M11.4 4.8v10.6' },
    { k: 'trace', label: 'trace', title: 'What the flight has done so far',
      icon: 'M2.6 12.4l3.4-4.2 2.8 2.2 3-4.4 3.6 3.2|M2.6 15.2h12.8' },
    { k: 'air', label: 'air', title: 'The air it is flying in',
      icon: 'M2.4 6.6h8.2a2.1 2.1 0 1 0-2-2.6|M2.4 9.8h11.2a2.1 2.1 0 1 1-2 2.6|M2.4 13h6' },
    // 2026-09-04: WHERE THE FLIGHT STARTS — the stand and a taxi out (G151),
    // or lined up on the strip. A runway in perspective, centreline dashed.
    { k: 'start', label: 'start', title: 'Where the flight starts',
      icon: 'M5.6 15.4 7.6 2.6|M12.4 15.4 10.4 2.6|M9 3.6v1.6|M9 7.4v1.8|M9 11.4v2.2' },
    // G193: THE PATTERNS — the taxi graph, the glide slopes and the two
    // touchdown targets, drawn on the ground and on the map. A dot-and-arc
    // glyph: three dots joined by a bent path.
    { k: 'patterns', label: 'patterns', title: 'The taxi and approach patterns',
      icon: 'M3.2 14.2h5.4a3 3 0 0 0 3-3V6.4a2.6 2.6 0 0 1 2.6-2.6H15|M3.2 14.2a1 1 0 1 0 0-.1|M8.6 14.2a1 1 0 1 0 0-.1|M15 3.8a1 1 0 1 0 0-.1' },
    // G194: THE ENGINES — a lever and a switch per engine over the pilot's one
    // throttle. A two-blade prop glyph.
    { k: 'engines', label: 'engines', title: 'What each engine is doing',
      icon: 'M9 9.2a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z|M9 6.4C9 3.6 10.6 2.4 12.2 2.4c1.8 0 2 1.4 1 2.6L9 7.8|M9 9.2c0 2.8-1.6 4-3.2 4-1.8 0-2-1.4-1-2.6L9 7.8' },
  ];
  const FL_SLOTS = {
    ac:    { title: 'Which aeroplane' },
    pilot: { title: 'Who flies it' },
    route: { title: 'Where it goes' },
    day:   { title: 'What day it is' },
  };

  let flyOpen = null;
  { const r = $('flRail');
    for (const t of FL_RAIL) {
      const b = document.createElement('button');
      b.className = 'flRailBtn';
      b.dataset.f = t.k;
      b.title = t.title;
      b.type = 'button';
      b.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true">' +
        t.icon.split('|').map(d => '<path d="' + d + '"/>').join('') +
        '</svg><span></span>';
      b.querySelector('span').textContent = t.label;
      b.onclick = () => flyOpenSet(flyOpen === t.k ? null : t.k);
      r.appendChild(b);
    }
  }
  for (const b of document.querySelectorAll('#flSlots .flSlot'))
    b.onclick = () => flyOpenSet(flyOpen === b.dataset.s ? null : b.dataset.s);
  $('flLine').onclick = () => { flFoldSet(false); };
  $('flPlate').addEventListener('click', e => {
    // the header is the way back to the one line, once the flight is under way
    if (e.target === $('flPlate') ||
        (e.target.closest && e.target.closest('#flPlateHead')))
      if (railPhase !== null) flFoldSet(true);
  });

  // A FLYOUT BORROWS, IT DOES NOT TAKE — the editor's own rule, and here it is
  // load-bearing for a different reason: the select IS the state, so a flyout
  // that cloned it would be the second source of truth this design refuses.
  const flBorrowed = [];
  function flReturn() {
    while (flBorrowed.length) {
      const b = flBorrowed.pop();
      b.el.className = b.cls;
      if (b.parent) b.parent.insertBefore(b.el, b.next);
    }
  }
  function flBorrow(el, host) {
    flBorrowed.push({ el, parent: el.parentElement, next: el.nextSibling,
                      cls: el.className });
    el.className = 'fsel';
    host.appendChild(el);
  }

  // ---- the flyout's own row vocabulary ------------------------------------
  const flRow = (host, label, cls) => {
    const r = document.createElement('div');
    r.className = 'fr' + (cls ? ' ' + cls : '');
    const k = document.createElement('span');
    k.className = 'k'; k.textContent = label; k.title = label;
    r.appendChild(k); host.appendChild(r);
    return r;
  };
  const flToggle = (host, label, get, set, offTxt, onTxt) => {
    const r = flRow(host, label);
    const c = document.createElement('input');
    c.type = 'checkbox'; c.className = 'fsw'; c.checked = !!get();
    const v = document.createElement('span');
    v.className = 'v'; v.style.flex = 'none'; v.style.textAlign = 'left';
    v.style.color = 'var(--ed-faint)'; v.style.font = "400 11px/1 'IBM Plex Sans'";
    const word = () => v.textContent = c.checked ? (onTxt || 'on') : (offTxt || 'off');
    word();
    c.onchange = () => { set(c.checked); word(); };
    r.appendChild(c); r.appendChild(v);
    return r;
  };
  const flRange = (host, label, lo, hi, step, get, set, fmt) => {
    const r = flRow(host, label);
    const i = document.createElement('input');
    i.type = 'range'; i.className = 'frng';
    i.min = lo; i.max = hi; i.step = step; i.value = get();
    const b = document.createElement('b');
    b.className = 'v'; b.textContent = fmt(+i.value);
    i.oninput = () => { set(+i.value); b.textContent = fmt(+i.value); };
    r.appendChild(i); r.appendChild(b);
    return r;
  };
  const flLive = (host, label, id) => {
    const r = flRow(host, label);
    const b = document.createElement('span');
    b.className = 'v'; b.id = id; b.textContent = '—';
    r.appendChild(b);
    return r;
  };
  const flPills = (host, list, isOn, pick) => {
    const w = document.createElement('div');
    w.className = 'fpills';
    for (const o of list) {
      const b = document.createElement('button');
      b.className = 'pill' + (isOn(o) ? ' on' : '');
      b.type = 'button';
      b.textContent = o.label;
      if (o.why) { b.disabled = true; b.title = o.why; }
      else b.onclick = () => { pick(o); flyOpenSet(flyOpen); };
      w.appendChild(b);
    }
    host.appendChild(w);
    return w;
  };
  const flNote = (host, txt) => {
    const n = document.createElement('div');
    n.className = 'fnote'; n.textContent = txt;
    host.appendChild(n);
  };
  // a select's options, as the pill list they describe
  const flOpts = sel => Array.from(sel.options).map(o => ({
    label: o.textContent, value: o.value }));
  const flPick = (sel, value) => {
    sel.value = value;
    if (typeof sel.onchange === 'function') sel.onchange({ target: sel });
    flRender();
  };

  // ---- ONE FLYOUT AT A TIME, opened FROM ITS OWN BUTTON --------------------
  // openFly's one stated rule, kept verbatim: an answer that always appears in
  // the same place does not say which question it answers. The slots open
  // DOWNWARD from the top bar and the rail opens UPWARD from the bottom, which
  // is the only difference between the two families.
  function flyOpenSet(k) {
    const fly = $('flFly'), body = $('flFlyBody'), head = $('flFlyHead');
    if (!fly) return;
    flReturn();
    while (body.firstChild) body.removeChild(body.firstChild);
    flyOpen = k;
    for (const b of $('flRail').children)
      b.classList.toggle('on', b.dataset.f === k);
    for (const b of document.querySelectorAll('#flSlots .flSlot'))
      b.classList.toggle('on', b.dataset.s === k);
    if (!k) { fly.hidden = true; return; }
    fly.hidden = false;
    const rail = FL_RAIL.filter(x => x.k === k)[0];
    head.textContent = (rail || FL_SLOTS[k] || {}).title || k;
    (rail ? FL_BUILD[k] : FL_BUILD['slot_' + k])(body);
    // ...and then it is measured and clamped to the free estate, exactly as
    // the editor's is. The anchor is the button's own box; the layer is the
    // whole window, because the flight view has no panels insetting it.
    const btn = rail
      ? [...$('flRail').children].filter(b => b.dataset.f === k)[0]
      : document.querySelector('#flSlots .flSlot[data-s="' + k + '"]');
    const W = window.innerWidth, H = window.innerHeight;
    const w = fly.offsetWidth || 296;
    const bb = btn ? btn.getBoundingClientRect() : { left: 22, bottom: 90, top: 90 };
    // the brief's slots keep the horizontal anchor; the ribbon's branch below
    // overwrites it, because a vertical ribbon anchors the other way round
    fly.style.left = Math.round(Math.max(22, Math.min(bb.left - 6, W - w - 22))) + 'px';
    if (rail) {
      // BESIDE ITS OWN BUTTON. The ribbon stands up the left edge now, so a
      // flyout that still opened upward would answer a question two hundred
      // pixels below the one being asked. It opens to the RIGHT, top-aligned
      // to the button and pulled up only as far as the window makes it.
      const rb = $('flRail').getBoundingClientRect();
      fly.style.left = Math.round(Math.min(rb.right + 10, W - w - 22)) + 'px';
      fly.style.bottom = 'auto';
      const maxH = H - 44;
      fly.style.maxHeight = Math.round(maxH) + 'px';
      const hFly = Math.min(fly.offsetHeight || 260, maxH);
      fly.style.top = Math.round(Math.max(22,
        Math.min(bb.top - 8, H - hFly - 22))) + 'px';
    } else {
      const dn = bb.bottom + 10;
      fly.style.bottom = 'auto'; fly.style.top = Math.round(dn) + 'px';
      fly.style.maxHeight = Math.round(H - dn - 96) + 'px';
    }
  }

  const FL_BUILD = {
    // -------- the four brief slots --------------------------------------
    slot_ac(body) {
      flPills(body, flOpts(flS('Ac')), o => o.value === flS('Ac').value,
              o => flPick(flS('Ac'), o.value));
      flNote(body, 'The garage build is the aeroplane this game is about. The ' +
                   'bench subjects are measured in node, not flown here.');
    },
    slot_pilot(body) {
      flPills(body, flOpts(flS('Pilot')), o => o.value === flS('Pilot').value,
              o => flPick(flS('Pilot'), o.value));
      flNote(body, 'Auto puts the test pilot under your own build and the ' +
                   'classic autopilot under anything else. Changing it ' +
                   'restarts the flight.');
    },
    slot_route(body) {
      // BORROWED, not rebuilt: #selDest's "change while stopped chains the
      // next leg" behaviour is its own handler's, and it is kept by not
      // touching it.
      flBorrow(flS('From'), flRow(body, 'from'));
      flBorrow(flS('Dest'), flRow(body, 'to'));
      flNote(body, railPhase === 'STOPPED'
        ? 'Picking a new destination now chains the next leg — same flight, ' +
          'no reset.'
        : 'Changing the origin restarts the flight.');
    },
    slot_day(body) {
      flBorrow(flS('Cond'), flRow(body, 'standard day'));
      flNote(body, 'A day is air AND wind. The weather changes live — the ' +
                   'pilot flies EAS and takes it mid-flight.');
    },
    // -------- the rail --------------------------------------------------
    camera(body) {
      const eyeWhy = flEyeWhy();
      flPills(body, FL_CAM.map(c => ({ label: c.k, value: c.k,
                                       why: c.k === 'cockpit' ? eyeWhy : null })),
              o => o.value === cam.mode, o => flCamMode(o.value));
      flRange(body, 'field of view', 28, 84, 1, () => cam.fov,
              v => { cam.fov = v; flSave('Cam', cam); flApplyFov(); },
              v => v.toFixed(0) + '°');
      flToggle(body, 'level horizon', () => cam.level,
               v => { cam.level = v; flSave('Cam', cam); });
      flRange(body, 'lead the turn', 0, 1, 0.05, () => cam.lead,
              v => { cam.lead = v; flSave('Cam', cam); },
              v => v.toFixed(2));
      // THE COVERING. #bSkin left the HUD and landed here: what the aeroplane
      // is DRAWN AS is a looking question, and this is where looking lives.
      // The button still owns the cycle and the label — these press it.
      const sk = $('bSkin');
      if (sk && sk.style.display !== 'none') {
        flPills(body, SKIN_NAMES.map((n, i) => ({ label: n, value: i })),
                o => o.value === skinMode, o => setSkinMode(o.value));
      }
      // THE SMOOTHING (G144.2, the user: "does it also apply to the flight
      // screen? If so, we should have the option there too"). It does — the
      // resolve pass wraps the game's single default-framebuffer render, so
      // the flight world was already going through it. The tier is one fact
      // with two readers: the editor's display row and this one, and the PASS
      // is the keeper — both surfaces just press it, and flPills' own
      // reopen-on-pick keeps this one honest after a press.
      const aaP = (typeof window !== 'undefined' && window.FLYDIY_AA) || null;
      if (aaP && aaP.able() && window.AA_RESOLVE && window.AA_RESOLVE.TIERS) {
        flRow(body, 'smoothing');
        flPills(body,
          [['off', 'off'], ['msaa', 'smooth'], ['full', 'smoothest']]
            .filter(p => window.AA_RESOLVE.TIERS[p[0]])
            .map(p => ({ label: p[1], value: p[0] })),
          o => o.value === aaP.tier(), o => aaP.setTier(o.value));
      }
      flNote(body, 'Cockpit is the pilot eye the editor already flies — one ' +
                   'control, both screens.');
    },
    instruments(body) {
      flToggle(body, 'small', () => panels.pfdSmall, v => flPfdSmall(v));
      flRow(body, 'ias · alt · vs', 'off').appendChild(
        Object.assign(document.createElement('span'),
          { className: 'v', textContent: 'always' }));
      for (const [k, label] of FL_INST)
        flToggle(body, label, () => instOn[k],
                 v => { instOn[k] = v; flSave('Inst', instOn); flInstApply(); });
      flNote(body, panels.pfdSmall
        ? 'Small carries IAS, altitude, vertical speed and power, and holds ' +
          'the rest back until you turn it off — your choices are kept.'
        : 'Three readouts is right for watching. A builder debugging a wing ' +
          'wants six.');
    },
    map(body) {
      flToggle(body, 'show', () => panels.map, v => flPanel('map', v));
      flToggle(body, 'large', () => mapBig, v => flMapBig(v));
      flToggle(body, 'north up', () => !mapNoseUp,
               v => { mapNoseUp = !v; panels.noseUp = mapNoseUp;
                      flSave('Panels', panels); drawMap(); },
               'nose up', 'north up');
    },
    start(body) {
      flToggle(body, 'taxi out',
               () => flStartTaxi(),
               v => { prefSet('flydiy.flStart', v ? 'taxi' : 'lineup'); flRender(); },
               'lined up', 'from the stand');
      flNote(body, 'On, the aeroplane is wheeled out of the shed and taxis to ' +
                   'the strip; off, it starts on the runway, lined up. Takes ' +
                   'effect on Restart.');
    },
    engines(body) {
      if (!sim) { flNote(body, 'No aeroplane on the field yet.'); return; }
      const n = (def && def.params && def.params.nEngines) || 1;
      if (!sim.ctl.eng || sim.ctl.eng.length !== n)
        sim.ctl.eng = Array.from({ length: n }, () => ({ on: 1, thr: 1 }));
      const E = sim.ctl.eng;
      const sides = (def && def.params && def.params.engines) || [];
      for (let i = 0; i < n; i++) {
        const side = (sides[i] && sides[i].side) || 0;
        const name = n > 1 ? 'engine ' + (i + 1) + (side < 0 ? ' · port' : side > 0 ? ' · starboard' : '')
                           : 'engine';
        const r = flRow(body, name);
        r.style.fontWeight = '600';
        flPills(body, [{ label: 'running', value: 1 }, { label: 'cut', value: 0 }],
                o => o.value === E[i].on, o => { E[i].on = o.value; flRender(); });
        flRange(body, 'lever', 0, 100, 5, () => E[i].thr * 100,
                v => { E[i].thr = v / 100; }, v => v.toFixed(0) + ' %');
        const live = flRow(body, 'thrust');
        const v = document.createElement('span');
        v.className = 'v'; v.id = 'flEngT' + i; v.textContent = '—';
        live.appendChild(v);
      }
      flPills(body, [{ label: 'sync levers', value: 1 }], () => false,
              () => { for (const e of E) { e.on = 1; e.thr = 1; } flRender(); });
      flNote(body, 'The levers scale the pilot’s own throttle: the pilot keeps ' +
                   'one throttle and does not know you touched these — cut one ' +
                   'engine of a pair and the good one carries the yaw. Restart ' +
                   'puts every lever back.');
    },
    patterns(body) {
      const set = k => v => { patOn[k] = !!v; flSave('Pat', patOn);
                              if (patVis) patVis.setLayers(patOn); drawMap(); };
      flToggle(body, 'taxi graph', () => patOn.graph, set('graph'));
      flToggle(body, 'glide slopes', () => patOn.slope, set('slope'));
      flToggle(body, 'touchdown targets', () => patOn.targets, set('targets'));
      flToggle(body, 'on the map', () => patOn.map, set('map'));
      flNote(body, 'The taxi graph is what the pilot follows out of the stand: ' +
                   'the dots, the smoothed corners, the amber STOP bar where it ' +
                   'lines up and halts. There are two touchdown targets, one per ' +
                   'landing direction; the brighter slope is the one being flown.');
    },
    trace(body) {
      flToggle(body, 'show', () => panels.trace, v => flPanel('trace', v));
      // WHICH LANES is the legend's, not this flyout's: a switchboard beside
      // the graph it switches beats one behind a button, and having it in two
      // places would be two places to disagree.
      flPills(body, [{ label: 'all', value: 1 }, { label: 'none', value: 0 },
                     { label: 'the three', value: 2 }],
              () => false, o => {
        for (const c of TEL_CH)
          traceOn[c.k] = o.value === 1 ? true : o.value === 0 ? false
            : TEL_DEF.indexOf(c.k) >= 0;
        flSave('Trace', traceOn); flTraceKeys();
      });
      flNote(body, 'Eleven channels, one lane each, over one clock. Pick ' +
                   'them from the legend under the graph; drag the panel by ' +
                   'its header and size it by the corner, or double-click the ' +
                   'header to put it back.');
    },
    air(body) {
      flLive(body, 'outside air', 'flAirOat');
      flLive(body, 'density altitude', 'flAirDalt');
      flLive(body, 'wind', 'flAirWind');
      flLive(body, 'gusts', 'flAirGust');
      // TIME OF DAY IS GREYED HERE and absent from the main screen: the world
      // still flies one fixed midday sun (render_world.js SUN), the day cycle
      // owns it, and when it lands this row is already its home.
      flBorrow(flS('Time'), flRow(body, 'time of day', 'off'));
      flAirLive(sim.out);
      flNote(body, 'Which day it is, is the brief’s. This is what that ' +
                   'day is doing to the aeroplane right now.');
    },
  };

  const FL_INST = [['aoa', 'angle of attack'], ['bank', 'bank'],
    ['agl', 'height above ground'], ['thr', 'throttle'],
    ['tas', 'true airspeed'], ['pwr', 'power']];
  const SKIN_NAMES = ['covered', 'flex ×4', 'frame', 'overlay'];

  // WHICH READOUTS THE PFD CARRIES — and the SMALL PFD overrides that answer
  // rather than editing it, so turning the small one off gives you back
  // exactly the set you had chosen.
  const PFD_SMALL = ['ias', 'alt', 'vs', 'pwr'];
  function flInstApply() {
    const small = !!panels.pfdSmall;
    const p = $('pfd');
    if (p) p.classList.toggle('small', small);
    for (const d0 in RD) {
      if (!RD[d0]) continue;
      RD[d0].hidden = small ? PFD_SMALL.indexOf(d0) < 0
                            : !(d0 === 'ias' || d0 === 'alt' || d0 === 'vs' ||
                                instOn[d0]);
    }
    const f = $('pfdFold');
    if (f) { f.textContent = small ? '▴' : '▾';
             f.title = small ? 'Bigger' : 'Smaller'; }
    flLayout();
  }
  function flPfdSmall(on) {
    panels.pfdSmall = !!on; flSave('Panels', panels); flInstApply();
  }
  if ($('pfdFold')) $('pfdFold').onclick = e => {
    e.stopPropagation();
    flPfdSmall(!panels.pfdSmall);
    if (flyOpen === 'instruments') flyOpenSet('instruments');
  };
  // WHAT STILL HAS TO BE MEASURED (the flight rebaseline, re-cut when the PFD
  // moved to the top row). The design's fixed numbers are drawn against one
  // aeroplane at one size; two of them do not survive a game whose top bar
  // grows and shrinks with the brief.
  //
  //   - THE MAP hangs under the verbs, and where the verbs end depends on
  //     whether the brief is open (four slot rows on a phone), whether the bar
  //     has wrapped, and how tall the PFD is — it rides that row now. 92 px is
  //     the design's number and it is the FLOOR, not the answer.
  //   - THE TRACE, once the player has placed it, is clamped back on screen
  //     when the window changes size, because a panel you dragged to the
  //     bottom-right of a wide window is a panel you cannot reach in a narrow
  //     one. Its resting geometry is CSS's; only a placed one is written here.
  // ...AND IT IS ASKED EVERY SIXTH FRAME, not on an event. The top bar's
  // height changes for half a dozen reasons that are not `resize` — the brief
  // folding, the notice appearing, a readout being added, the bar wrapping —
  // and a listener per cause is a listener that will be forgotten. Two
  // getBoundingClientRects on a 10 Hz tick is nothing, and the write is
  // memoised so an unchanged answer touches no style.
  function flLayout() {
    const W = window.innerWidth || 1440, H = window.innerHeight || 810;
    const inset = W > 760 ? 22 : 12;
    // THE MAP SITS IN THE TOP RIGHT, and what it has to clear is not the top
    // bar's HEIGHT but only the part of the bar that is actually beside it.
    // The bar spans the screen; its right third is empty (the verbs went to
    // the bottom), so on a wide screen the map goes to the design's own 92 px
    // and stays there. When the bar collapses to one column on a phone, the
    // PFD IS in the map's column and the map drops below it. Measured over the
    // bar's children rather than its box, because its box is a lie about where
    // its content is.
    const m = $('mmp'), top = $('flTop');
    if (m && top && !m.classList.contains('placed')) {
      const mb = m.getBoundingClientRect();
      const x0 = mb.width ? mb.left : W - inset - 208, x1 = mb.width ? mb.right : W - inset;
      let low = 0;
      for (const kid of top.children) {
        const b = kid.getBoundingClientRect();
        if (b.width && b.right > x0 && b.left < x1) low = Math.max(low, b.bottom);
      }
      const v = Math.round(Math.max(W > 760 ? 92 : 84, low ? low + 12 : 0)) + 'px';
      if (m.style.top !== v) m.style.top = v;
    }
    // THE RIBBON AND THE TRACE SHARE THE LEFT EDGE, and on a tall narrow
    // window they stop fitting past each other: the ribbon is centred on the
    // height and the trace, anchored to the bottom, grows up into it. Measured
    // rather than guessed at a breakpoint — it is a function of the window's
    // HEIGHT as much as its width. Insetting the LEFT is stable: it does not
    // move the trace's top, so this cannot oscillate.
    const t = $('telp'), r = $('flRail');
    const P = panels.pos || {};
    if (t && r && !P.telp && !t.classList.contains('placed')) {
      const tb = t.getBoundingClientRect(), rb = r.getBoundingClientRect();
      const v = (tb.height && !r.classList.contains('placed') && tb.top < rb.bottom)
        ? Math.round(rb.right + 10) + 'px' : '';
      if (t.style.left !== v) t.style.left = v;
    }
    // ...and every panel the player has placed is kept reachable. A HANDLE on
    // screen, not the whole panel: dragging one half off the left edge is a
    // legitimate thing to want, losing its header is not.
    for (const key in P) {
      const el = $(key), p = P[key];
      if (!el || !p) continue;
      const w = p.w ? Math.max(120, Math.min(p.w, W - 2 * inset)) : 0;
      const h = p.h ? Math.max(90, Math.min(p.h, H - 2 * inset)) : 0;
      const bw = w || el.offsetWidth || 120;
      el.style.left = Math.round(Math.max(inset - bw + 90,
                                          Math.min(p.x, W - 90))) + 'px';
      el.style.top = Math.round(Math.max(inset, Math.min(p.y, H - 40))) + 'px';
      // only the trace is resizable; the rest keep their own size
      if (key === 'telp') {
        el.style.width = Math.round(Math.max(240, w)) + 'px';
        el.style.height = Math.round(Math.max(132, h)) + 'px';
      }
    }
  }

  // ---- EVERY PANEL IS PLACEABLE (the user: "make all panels draggable, not
  // the buttons nor the top left menu, but all the others could be dragged")
  // -----------------------------------------------------------------------
  // The two that are NOT are the two that are anchors: the brief is where you
  // look first and the verbs are where your hand goes, and a screen where
  // even those move has no shape left to remember. Everything else is the
  // player's: the PFD, the map, the look ribbon and the trace.
  //
  // THE FIRST DRAG RE-ANCHORS AND RE-PARENTS. At rest each panel sits where
  // its CSS puts it — the PFD is a grid cell in the top bar, the map is
  // pinned to the right, the ribbon is centred on the height — and none of
  // those can express "wherever the player dropped it". So the first drag
  // takes the box it is ALREADY occupying (no jump on the first pixel),
  // moves the element to #ui, and switches it to plain left/top. Double-click
  // puts it back in its own parent at its own index, which is why `home` is
  // recorded before anything moves.
  //
  // THE 4 px THRESHOLD IS WHAT LETS A PANEL BE BOTH. The map's canvas and the
  // ribbon's buttons still take clicks; a pointer that has not travelled 4 px
  // was a click and is left alone, and one that has is a drag and swallows
  // the click that would have followed.
  const flHome = {};
  function flPlace(el, opts) {
    if (!el) return;
    const key = el.id;
    const handle = (opts && opts.handle) || el;
    const grip = opts && opts.grip;
    flHome[key] = { parent: el.parentElement, next: el.nextSibling };
    const pos = () => (panels.pos || (panels.pos = {}))[key];
    let mode = null, armed = null, ox = 0, oy = 0, box = null, eatClick = false;
    const anchor = () => {
      const b = el.getBoundingClientRect();
      const P = panels.pos || (panels.pos = {});
      P[key] = { x: b.left, y: b.top, w: b.width, h: b.height };
      if (!el.classList.contains('placed')) {
        el.classList.add('placed');
        $('ui').appendChild(el);          // out of the grid, out of the anchor
      }
      return b;
    };
    const grab = e => { try { el.setPointerCapture(e.pointerId); } catch (err) {} };
    const down = kind => e => {
      if (e.button) return;
      armed = kind;
      box = el.getBoundingClientRect();
      ox = e.clientX - box.left; oy = e.clientY - box.top;
      const sx = e.clientX, sy = e.clientY;
      el.__flStart = [sx, sy];
      // the grip has nothing else to do, so it drags at once
      if (kind === 'size') { mode = 'size'; anchor(); grab(e); }
      // NO CAPTURE HERE. Chrome 148 retargets pointerup AND the click that
      // follows to the element holding pointer capture, so a capture taken on
      // pointerdown turned every press on a ribbon button, the PFD's fold and
      // the map's canvas into a click on the PANEL — and the flight's whole
      // left bar went dead with no error (2026-09-04). The pointer is grabbed
      // only once the gesture has proved itself a drag, in pointermove.
      e.stopPropagation();
    };
    if (handle) handle.addEventListener('pointerdown', down('move'));
    if (grip) grip.addEventListener('pointerdown', down('size'));
    el.addEventListener('pointermove', e => {
      if (!armed) return;
      const st = el.__flStart;
      if (!mode) {
        if (Math.abs(e.clientX - st[0]) + Math.abs(e.clientY - st[1]) < 4) return;
        mode = armed; anchor(); grab(e);
      }
      const P = pos();
      if (mode === 'move') { P.x = e.clientX - ox; P.y = e.clientY - oy; }
      else { P.w = e.clientX - box.left + 4; P.h = e.clientY - box.top + 4; }
      flLayout();
      e.preventDefault();
    });
    const up = e => {
      if (!armed) return;
      armed = null;
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!mode) return;                  // never travelled: it was a click
      mode = null;
      // ONE CLICK IS EATEN, AND ONLY ONE. The click that belongs to this
      // gesture is dispatched in the same input task as the pointerup, so a
      // zero-delay timer is exactly the boundary between "the tail of the
      // drag" and "the next thing the player did" — a flag cleared by the
      // click itself survives a drag that ends with the pointer still and
      // eats a genuine press minutes later; a time window has to guess.
      eatClick = true;
      setTimeout(() => { eatClick = false; }, 0);
      flSave('Panels', panels);
      if (el.id === 'telp') drawTel(); else if (el.id === 'mmp') drawMap();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // a drag that started on a control must not also press it
    el.addEventListener('click', e => {
      if (eatClick) { eatClick = false; e.stopPropagation(); e.preventDefault(); }
    }, true);
    // ...AND A WAY BACK. A panel you can move somewhere useless needs one
    // gesture that undoes every move at once, or the only cure is the
    // browser's storage inspector.
    (handle || el).addEventListener('dblclick', () => {
      const P = panels.pos || {};
      delete P[key]; flSave('Panels', panels);
      el.classList.remove('placed');
      el.style.left = el.style.top = el.style.width = el.style.height = '';
      const h = flHome[key];
      if (h && h.parent) h.parent.insertBefore(el, h.next);
      flLayout();
      if (el.id === 'telp') drawTel(); else if (el.id === 'mmp') drawMap();
    });
    // the panel scrolls nothing and orbits nothing: a drag on it is a drag on
    // the panel, never on the world behind it
    el.addEventListener('pointerdown', e => e.stopPropagation());
  }

  // ---- THE CROSSHAIR. A line chart you cannot point at makes you estimate
  // off a pixel; pointing at it turns every lane's direct label into the value
  // AT THAT MOMENT, and names the phase you are standing in. It is the same
  // readout answering a better question, so nothing new appears on screen.
  {
    const cv = $('tel');
    if (cv) {
      const pick = e => {
        const n = tel.t.length;
        if (!n) return;
        const b = cv.getBoundingClientRect();
        const L = 106, R = 6;                 // must match drawTel's gutters
        const w = Math.max(10, b.width - L - R);
        const t1 = Math.max(tel.t[n - 1], 1e-3);
        const tx = (e.clientX - b.left - L) / w * t1;
        // nearest sample, not the one to the left: the pointer is AT a time
        let best = 0, bd = Infinity;
        for (let i = 0; i < n; i++) {
          const d = Math.abs(tel.t[i] - tx);
          if (d < bd) { bd = d; best = i; }
        }
        telHover = best;
        drawTel();
      };
      cv.addEventListener('pointermove', pick);
      cv.addEventListener('pointerleave', () => {
        if (telHover < 0) return;
        telHover = -1; drawTel();
      });
    }
  }

  // WHICH LINES THE TRACE DRAWS is the flyout's, and the legend says the same
  // three words the graph does — a key for a line that is not drawn is a key
  // for something that is not there.
  // THE LEGEND IS THE SWITCHBOARD (the user: "be able to select/deselect the
   // one I want to see from the legend"). Built once from TEL_CH, so a
  // fifteenth channel is a row in that table and nothing else.
  function flTraceKeys() {
    const L = $('legend');
    if (!L) return;
    if (!L.children.length) {
      for (const c of TEL_CH) {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.c = c.k;
        b.title = c.l + ' (' + c.u + ')';
        // built, not written as markup: `innerHTML` gives you a string, and
        // the swatch has to be an ELEMENT for its colour to be set on it
        const sw = document.createElement('i');
        sw.style.background = TEL_FAM[c.f];
        b.appendChild(sw);
        const nm = document.createElement('span');
        nm.textContent = c.l;
        b.appendChild(nm);
        b.onclick = () => {
          traceOn[c.k] = !traceOn[c.k];
          flSave('Trace', traceOn);
          flTraceKeys();
        };
        L.appendChild(b);
      }
    }
    for (const b of L.children) b.classList.toggle('on', !!traceOn[b.dataset.c]);
    if (panels.trace) drawTel();
  }
  function flPanel(k, on) {
    panels[k] = !!on; flSave('Panels', panels);
    const el = $(k === 'map' ? 'mmp' : 'telp');
    if (el) el.hidden = !on;
    flLayout();
    if (on) (k === 'map' ? drawMap : drawTel)();
  }
  function flMapBig(on) {
    mapBig = !!on; panels.big = mapBig; flSave('Panels', panels);
    const cv = $('mm');
    cv.width = cv.height = mapBig ? 1024 : 344;
    $('mmp').classList.toggle('big', mapBig);
    drawMap();
  }
  function flAirLive(o) {
    const w = $('flAirWind');
    if (!w) return;
    const s = flS('Cond'), C = (typeof CONDITIONS === 'object' &&
      CONDITIONS[s.value]) || null;
    const g = C && C.wind ? (C.wind.gust || 0) : 0;
    $('flAirOat').textContent = ((o && o.oatC != null) ? o.oatC : 15).toFixed(0) + ' °C';
    $('flAirDalt').textContent = ((o && o.densityAlt) || 0).toFixed(0) + ' m';
    w.textContent = windBase
      ? Math.hypot(windBase[0], windBase[2]).toFixed(1) + ' m/s at 10 m'
      : 'calm';
    $('flAirGust').textContent = g ? '±' + (g * 100).toFixed(0) + ' %' : 'none';
  }

  // ---- THE CAMERA (new: the flight had no camera UI at all) ---------------
  // Five framings, and each one writes the SAME azT/elT/distT the mouse
  // writes, so they ease the way a drag eases. `orbit` is the mode that writes
  // nothing — it is exactly today's free orbit, and it is what a drag drops
  // you back into.
  const FL_CAM = [{ k: 'chase' }, { k: 'orbit' }, { k: 'cockpit' },
                  { k: 'wing' }, { k: 'tower' }];
  let flHdg0 = 0, flYawRate = 0, flEyeLoc = null, flEyeSrc = null;
  function flCamMode(m) {
    cam.mode = m; flSave('Cam', cam);
    if (m !== 'cockpit' && flyEye) { flyEye = null; setNear(CAM_NEAR); }
    if (m === 'orbit') { distT = def.params.viewDist; elT = 0.25; }
    flApplyFov();
  }
  function flApplyFov() {
    if (camera.fov === cam.fov) return;
    camera.fov = cam.fov; camera.updateProjectionMatrix();
  }
  // NO PILOT, NO COCKPIT — the same question the editor's `interior` preset
  // asks, of the same published object. It also needs the SNAPSHOT, because
  // the eye is published in the shed's frame and has to be walked into the
  // flying model's; see flyEyeAt().
  function flEyeWhy() {
    if (curKey !== 'gen') return 'The cockpit view is your own build’s.';
    if (!window.CAGE_CREW_EYE)
      return 'No pilot in this build — turn the crew layer on (Cabin fit → fitted)';
    if (!(window.CAGE_VISUAL && window.CAGE_VISUAL.cage))
      return 'Roll out first — the eye is placed off the built aeroplane';
    return null;
  }
  // THE EYE, WALKED INTO THE FLYING FRAME. _cage_crew publishes it in the
  // shed's WORLD space, because that is the frame the editor's camera lives
  // in. The aeroplane that flies is the snapshot, and _cage_join bakes every
  // vertex through one mapping: mount-local -> (-z, y, x), then the G54.2
  // pitch calibration about the model z axis. The eye takes exactly that
  // mapping, with the snapshot's own `pitch` — so this is not a second
  // implementation of the crew layer, it is the same point read in the frame
  // the model is drawn in.
  function flyEyeAt() {
    const E = window.CAGE_CREW_EYE, V = window.CAGE_VISUAL;
    if (!E || !E.p || !V || !model || !model.grp) return null;
    if (flEyeSrc !== E) {
      flEyeSrc = E;
      edSitP.updateMatrixWorld(true);
      const v = edSitP.worldToLocal(new THREE.Vector3().fromArray(E.p));
      const f = new THREE.Vector3().fromArray(E.fwd || [0, 0, 1]);
      const q = edSitP.getWorldQuaternion(new THREE.Quaternion()).invert();
      f.applyQuaternion(q);
      const b = V.pitch || 0, cB = Math.cos(b), sB = Math.sin(b);
      const map = (x, y, z) => {
        const px = -z, py = y;
        return new THREE.Vector3(px * cB - py * sB, px * sB + py * cB, x);
      };
      flEyeLoc = { p: map(v.x, v.y, v.z), f: map(f.x, f.y, f.z).normalize() };
    }
    if (!flEyeLoc) return null;
    model.grp.updateMatrixWorld(true);
    const M = model.grp.matrixWorld;
    const p = flEyeLoc.p.clone().applyMatrix4(M);
    const nm = new THREE.Matrix3().setFromMatrix4(M);
    const f = flEyeLoc.f.clone().applyMatrix3(nm).normalize();
    return { p, f };
  }
  const flUp = new THREE.Vector3();
  function flCamera() {
    if (!FL.ready) return;
    if (inGarage) {                       // the shed has the editor's camera
      if (flyEye) { flyEye = null; setNear(CAM_NEAR); }
      camera.up.set(0, 1, 0);
      return;
    }
    flApplyFov();
    const xA = sim.axes()[0], yU = sim.axes()[1];
    const hdg = Math.atan2(xA[2], xA[0]);
    let dh = hdg - flHdg0;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    flYawRate += (dh * 60 - flYawRate) * 0.1;
    flHdg0 = hdg;
    // LEVEL HORIZON, off, rolls the camera with the aeroplane — which is what
    // the wing view and the cockpit are for, and what makes a turn read as a
    // turn instead of as the world sliding sideways.
    if (cam.level || cam.mode === 'orbit' || cam.mode === 'tower')
      camera.up.set(0, 1, 0);
    else camera.up.copy(flUp.set(yU[0], yU[1], yU[2]));
    const D = def.params.viewDist || 12;
    if (cam.mode === 'cockpit') {
      const e = flyEyeAt();
      if (e) {
        // THE PIVOT IS IN FRONT OF THE EYES, not at them — an orbit of radius
        // zero has no direction to place a camera along (G107's own note).
        flyEye = e.p.clone().addScaledVector(e.f, EYE_PIVOT);
        target.copy(flyEye);
        setNear(EYE_NEAR);
        if (distT > 3) { distT = dist = EYE_PIVOT;
          const back = e.f.clone().negate();
          elT = el = Math.asin(Math.max(-1, Math.min(1, back.y)));
          azT = az = Math.atan2(back.z, back.x);
        }
        return;
      }
      if (flyEye) { flyEye = null; setNear(CAM_NEAR); }
    } else if (flyEye) { flyEye = null; setNear(CAM_NEAR); }
    if (cam.mode === 'chase') {
      azT = hdg + Math.PI + cam.lead * flYawRate * 0.55;
      elT = 0.15; distT = D * 0.62;
    } else if (cam.mode === 'wing') {
      azT = hdg - Math.PI / 2 + cam.lead * flYawRate * 0.35;
      elT = 0.04; distT = D * 0.5;
    } else if (cam.mode === 'tower') {
      // THE ONE FRAMING THAT IS NOT AN ORBIT OF THE AEROPLANE: a fixed point
      // at the field you left, twelve metres up, that watches you go. It is
      // still written as az/el/dist because that is the only camera this file
      // has — solved backwards from the tower to the aeroplane.
      const a = aeroById(fromId);
      const dx = a.x - target.x, dz = a.z - target.z,
            dy = (a.elev || 0) + 12 - target.y;
      const r = Math.max(30, Math.hypot(dx, dy, dz));
      azT = az = Math.atan2(dz, dx);
      elT = el = Math.asin(Math.max(-1, Math.min(1, dy / r)));
      distT = dist = Math.min(r, 6500);
    }
  }
  // A DRAG DROPS YOU BACK INTO ORBIT. A locked camera that fights the mouse is
  // the worst of both; the rail says which framing you are in, and taking hold
  // of it says you want your own.
  $('c').addEventListener('pointerdown', () => {
    if (!inGarage && cam.mode !== 'orbit' && cam.mode !== 'cockpit') {
      flCamMode('orbit');
      if (flyOpen === 'camera') flyOpenSet('camera');
    }
  });

  // ---- THE BRIEF, THE VERBS AND THE NOTICE --------------------------------
  const flTrip = () => {
    const f = flS('From'), d = flS('Dest');
    const fo = f.options[f.selectedIndex], dov = d.options[d.selectedIndex];
    return (fo ? fo.textContent : '—') + ' → ' +
           (dov ? dov.textContent.replace(/^⟳\s*/, '') : '—');
  };
  const flSel = sel => {
    const o = sel.options[sel.selectedIndex];
    return o ? o.textContent : '—';
  };
  // A MENU ROW AND A SLOT VALUE ARE NOT THE SAME SENTENCE. The option text
  // has to say what it is among five others ("Standard day · calm"); the slot
  // already carries the word `day` as its own label, and the ⟳ belongs to the
  // menu row that has to be told apart from a list of aerodromes.
  const flDay = () => flSel(flS('Cond')).replace(/^Standard day(?= )/, 'Standard');
  let flFolded = false, flFoldedByPlayer = false;
  function flFoldSet(on) {
    flFolded = !!on; flFoldedByPlayer = true;
    if (flFolded) flyOpenSet(null);
    flRender();
  }
  // THE BRIEF FOLDS WHEN THE WHEELS LEAVE, and that fold is most of how this
  // screen gets quiet. Unfolding it airborne is allowed; it just is not the
  // default. `flFoldedByPlayer` is the override, and it is cleared by every
  // phase change so the rule takes back over on the next flight.
  function flPhaseMoved(active) {
    if (!FL.ready) return;
    const held = active === null || active === 'GARAGE';
    if (!flFoldedByPlayer) flFolded = !held;
    if (held) { flFolded = false; flFoldedByPlayer = false; }
    flRender();
  }
  let flVs = 0;
  function flRender() {
    if (!FL.ready) return;
    const held = railPhase === null || railPhase === 'GARAGE';
    const stopped = flightOver || (started && ap && ap.phase === 'STOPPED');
    $('flPlate').hidden = flFolded;
    $('flLine').hidden = !flFolded;
    $('acName').textContent = flSel(flS('Ac')).replace(/^⚒\s*/, '');
    $('flPilotV').textContent = flSel(flS('Pilot'));
    $('flRouteV').textContent = flTrip();
    $('flDayV').textContent = flDay();
    $('flLineName').textContent = $('acName').textContent;
    $('flLineTrip').textContent = flTrip();
    $('flLineDay').textContent = flDay();
    $('flHold').textContent = held ? 'held' : (stopped ? 'down' : 'flying');
    // THE VERBS. Pause and Restart never move between states; the primary is
    // never disabled, and changes its WORDS rather than its state.
    //
    // ...AND NOT IN THE SHED. #bGo is the one control the two screens share:
    // in the garage it is ROLL OUT and syncGoLabel owns every word of it (it
    // is the certificate speaking), and out here it is the flight's primary.
    // Writing both from both places is how a screen ends up disagreeing with
    // itself — so each owns it in its own mode, and this one steps back.
    const flying = started && !stopped && !held;
    if (!inGarage) {
      $('bGo').hidden = flying;
      $('bGo').textContent = stopped ? 'Fly on' : 'Fly the circuit';
      $('bGo').classList.remove('warn');
    }
    $('bPause').hidden = !flying;
    $('bReset').hidden = !flying;
    // THE NOTICE, which is where #bGo.warn's meaning went: the bench's verdict
    // said out loud, once, in a plate with one job — instead of encoded in the
    // colour of a button you were about to press anyway.
    const st = (typeof window.BENCH_STATE === 'function') ? window.BENCH_STATE() : null;
    const bad = !!(st && !st.passed) && curKey === 'gen';
    $('flNotice').hidden = !bad || flFolded;
    if (bad) $('flNoticeV').textContent = st.any
      ? 'the bench has not passed for this build'
      : 'nothing on the bench has been run for this build';
    try { const sh = shakeOf(); flVs = (sh && sh.Vs) || 0; } catch (e) { flVs = 0; }
    flLayout();                 // the phase name is half of the PFD's width
  }
  // the bench and the aeroplane both change what the plate says
  const flBenchWas = window.BENCH_CHANGED;
  window.BENCH_CHANGED = () => { if (flBenchWas) flBenchWas(); flRender(); };

  // ---- THE FIRST FLIGHT'S ONE HINT, and then never again ------------------
  if (prefGet('flydiy.flHint', '') !== '1') {
    const h = $('flHint');
    if (h) {
      h.hidden = false;
      const drop = () => { h.hidden = true; prefSet('flydiy.flHint', '1'); };
      $('c').addEventListener('pointerdown', drop, { once: true });
      setTimeout(drop, 12000);
    }
  }

  // ---- Esc closes; a click on the render closes ---------------------------
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && flyOpen) { flyOpenSet(null); e.preventDefault(); }
  });
  $('c').addEventListener('pointerdown', () => { if (flyOpen) flyOpenSet(null); });
  window.addEventListener('resize', () => {
    flLayout();
    if (flyOpen) flyOpenSet(flyOpen);
  });

  // ---- the four panels the player can place --------------------------------
  // The trace drags by its header and sizes by its grip; the other three drag
  // from anywhere on themselves, past the 4 px threshold that keeps their own
  // controls clickable. #flBrief and #flActs are deliberately absent.
  flPlace($('telp'), { handle: $('telHead'), grip: $('telGrip') });
  flPlace($('mmp'), {});
  flPlace($('pfd'), {});
  flPlace($('flRail'), {});

  // ---- boot the layer -----------------------------------------------------
  FL.ready = true;
  flInstApply();
  flTraceKeys();
  $('mmp').hidden = !panels.map;
  $('telp').hidden = !panels.trace;
  if (mapBig) flMapBig(true);
  flApplyFov();
  flRender();

  // the first aeroplane is the garage build on its defaults; the garage
  // bridge below re-applies the restored WIP over it before the first frame
  setAircraft('gen');
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
    // screen: the aeroplane standing in the room is normally the cage build,
    // and watching the wing bend IS the wing test. Restoring is applyStand's
    // job, so there is one answer to "what is on the stand" and not two.
    showPhysical: on => {
      showCage = !on && !!window.CAGE_UI && inGarage;
      applySkinVis();
      // the LIVE test is watching the wing bend: the truss shows OVER the
      // skin for its duration, whatever the skin mode says
      if (on) {
        if (lines) lines.visible = true;
        if (pts) pts.visible = true;
      }
    },
    // THE CERTIFICATE PERSISTS (G107.3): the two sheets only a test run can
    // produce, handed to the bench for its stored snapshot — and seeded back
    // on restore, memoised onto the CURRENT def so the plaque's gating
    // (daFor === def, tfFor === def) accepts them as this aeroplane's own.
    sheets: () => ({ densAlt: densAltIfRun(), flight: tfIfRun() }),
    restoreSheets: sh => {
      if (sh && sh.densAlt) { daVal = sh.densAlt; daFor = def; }
      if (sh && sh.flight) { tfVal = sh.flight; tfFor = def; }
    },
    // THE TEST FLIGHT (G107): the offscreen fast circuit on the test pilot;
    // the bench's card ({alt, Vkmh}) rides in (G107.1)
    circuitStart: card => tfStart(card),
    circuitPoll: () => tfPoll(),
    circuitEnd: () => tfEnd(),
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
      if (k !== 'i') exitInterior();
      if (k === 'r') { edPan.set(0, 0, 0); distT = 14; azT = -2.5; elT = 0.22; return; }
      if (k === 'q') { azT = -2.5; elT = 0.25; distT = 12; edPan.set(0, 0, 0); }
      if (k === 's') { azT = -Math.PI / 2; elT = 0.06; distT = 13; edPan.set(0, 0, 0); }
      if (k === 't') { azT = -Math.PI / 2; elT = 1.35; distT = 15; edPan.set(0, 0, 0); }
      if (k === 'f') { azT = Math.PI; elT = 0.10; distT = 10; edPan.set(0, 0, 0); }
      if (k === 'i') enterInterior();
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
    // THE PASS SIZES OFF THE DRAWING BUFFER, not off `w`/`h`. On a screen with
    // devicePixelRatio above 1 those two are different numbers, and a target
    // built from the CSS pair would quietly render the whole game at less than
    // the canvas it lands on.
    if (aa) {
      const db = renderer.getDrawingBufferSize
        ? renderer.getDrawingBufferSize(new THREE.Vector2()) : { x: w, y: h };
      aa.setSize(db.x, db.y);
    }
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
        // G130: a divergence is an ENDING, not a caption — the card comes up
        // with the door home on it, and the logbook gets its broke-up row
        endFlight('broke-up');
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
    if (edEye) { if (edSit.visible) target.copy(edEye); else exitInterior(); }
    // THE FLIGHT CAMERA (the flight rebaseline). It writes the SAME azT/elT/
    // distT the mouse writes, every frame, so a chase eases exactly the way a
    // drag eases and `orbit` is simply the mode that writes nothing. Cockpit
    // moves `target` instead, like the editor's interior. It runs after the
    // target is set and before the easing, which is the only slot where both
    // of those are true.
    flCamera();
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
    // G130: the truss buffers upload only when something draws them — in
    // Covered/Flex flight (lines, points and the shadow proxy all hidden
    // since applyStand stopped forcing them on) that is three fewer dirty
    // BufferAttributes and two fewer draws every frame
    if (lines && (lines.visible || pts.visible || (proxy && proxy.mesh.visible))) sync();
    poseModel();
    if (++frame % 6 === 0) {
      hud();
      flLayout();
      if (panels.map) drawMap();
      if (panels.trace) drawTel();
    }
    // THE ONLY RENDER TO THE DEFAULT FRAMEBUFFER in the whole viewer, which is
    // what makes G144's pass a single substitution rather than a campaign:
    // every other renderer.render() in hangar.js and render_world.js is bound
    // to its own target and is untouched by this.
    if (aa) aa.render(inGarage ? garageScene() : scene, camera);
    else renderer.render(inGarage ? garageScene() : scene, camera);
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
  // room you build it in — and the PA-18 and the C172 are measuring sticks
  // (reference planes in the editor's tree), not aeroplanes you fly.
  //
  // IT RUNS LAST, after every bridge above has been wired, because opening the
  // editor is not a small thing: it boots the cage bundle, the four layers, the
  // hangar's own panel section and the part tree, and each of those expects the
  // room, the mount and the garage handle to exist. This is also the point that
  // pays the cost the LAZY boot was deferring — deliberately, because "later"
  // is now "at boot" and the loading screen is the honest place for it.
  //
  // AND IT FALLS BACK. If any of that throws, the game still opens — with the
  // error in the console rather than a black screen. A boot path is the one
  // place where a partial failure must not be fatal.
  // G135 CHANGED WHAT IT FALLS BACK TO. It used to open on the PA-18, on the
  // apron; the fiches are gate subjects now and the user never sees one, so a
  // failure that put a Super Cub on screen would be showing an aeroplane that
  // no longer exists as far as the game is concerned. It falls back to the
  // GARAGE BUILD standing on the apron instead — the same aeroplane, minus the
  // room and the editor that failed to open.
  try {
    const sel = $('selAc');
    if (sel) sel.value = 'gen';
    // ---- THE AUTOSAVE IS READ BACK (2026-09-03) --------------------------
    // The working build has been written to localStorage on every rebuild
    // since G63, and debounced after every slider since the save-integrity
    // pass earlier today — and NOTHING PUT IT INTO THE EDITOR AT BOOT. The
    // seed below (seedEditor) reads `genSpec`, which is set only by
    // `api.apply`, which only garage.js's `rebuild` calls — and the boot restore
    // assigns its spec at module scope without rebuilding. So `genSpec` was
    // null here, the seed returned early, the editor opened on the page's own
    // default aeroplane, and `syncBuild()` four lines below exported THAT over
    // the restored build and wrote it to the autosave.
    //
    // MEASURED, twice, on dev.html: move the nose length to 0.62 and the span
    // to 11.4, wait for the debounce, and the stored WIP carries both (4624
    // bytes). Reload: the editor reads 0.44 and 10.0, the shelf's spec agrees
    // with the editor, and the WIP has been rewritten to the editor's
    // defaults (4515 bytes). Every slider moved since the last explicit SAVE
    // was lost by the refresh it was supposed to survive — the one case the
    // autosave exists for (the user: "do we have a form of auto-save of the
    // current plane? Would be useful in case of browser crash/refresh").
    //
    // The fix is one line and it is the missing half of the same idea:
    // hand the restored spec to the boot before anything is built from it.
    // `setAircraft` then builds the aeroplane you were working on, seedEditor
    // finds a cage to seed from, and syncBuild exports the SEEDED editor
    // rather than the template. A spec with no cage still seeds nothing — a
    // fresh session opens on the page's own aeroplane, exactly as before.
    if (window.GARAGE_SPEC && typeof window.GARAGE_SPEC.get === 'function') {
      try {
        const wip = window.GARAGE_SPEC.get();
        if (wip && wip.cage && Object.keys(wip.cage).length) genSpec = wip;
      } catch (e) { console.error('wip restore:', e); }
    }
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
    // THE CERTIFICATE SURVIVES THE REFRESH (G107.3). The boot seed above is
    // a dirty storm like any load — and the bench's rule (an empty bench
    // never nulls the store) is what let the WIP's stored plaque live
    // through it. Restore comes LAST, same as garage.js loadSpec does it.
    if (typeof window.BENCH_RESTORE === 'function' && window.GARAGE_SPEC
        && window.GARAGE_SPEC.plaque)
      window.BENCH_RESTORE(window.GARAGE_SPEC.plaque());
  } catch (err) {
    console.error('cage boot:', err);
    try { const sel = $('selAc'); if (sel) sel.value = 'gen';
          setAircraft('gen'); } catch (e2) {}
  }
  // (Until the fleet retired, 2026-09-05, the PA-18 and C172 bins were warmed
  // here behind the splash; a reference plane fetches its own on pick.)
  hud();
  loop();
})();
