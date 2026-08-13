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
  let studioFloor = null, groundY = 0;
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
  let az = -2.5, el = 0.22, dist = 14;
  function placeCamera() {
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.cos(az),
      Math.max(0.4, target.y + dist * Math.sin(el)),
      target.z + dist * Math.cos(el) * Math.sin(az));
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
  const WORLD_EXPOSURE = renderer.toneMappingExposure;
  const WORLD_PHYSLIGHTS = !!renderer.physicallyCorrectLights;

  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0xe9e6de);
  {
    // A three-light room, the same shape as any product stand: a broad sky
    // term so nothing is ever black, one key that actually casts, and a warm
    // fill opposite it to keep the shaded side readable.
    studio.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-6, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    // the shadow box is sized to an aeroplane, not to a world — a world-sized
    // frustum spends all its depth precision on empty air and the contact
    // shadow under the wheels goes soft and detached
    const c = key.shadow.camera;
    c.left = -14; c.right = 14; c.top = 14; c.bottom = -14;
    c.near = 1; c.far = 48;
    studio.add(key);
    const fill = new THREE.DirectionalLight(0xfff4e6, 0.5);
    fill.position.set(9, 5, -7);
    studio.add(fill);
    // THE FLOOR, and it earns its place: without a surface to catch the key
    // light the aeroplane floats in a void and you cannot read its stance —
    // which is half of what you are looking at when you set gear and dihedral.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    studio.add(floor);
    studioFloor = floor;
    // An environment, because every material on this aeroplane is a
    // MeshStandardMaterial and r128 only reaches those through scene.environment.
    // Without one the metal reads black in here — the same trap the gear legs
    // and the spinner fell into against a dim sky.
    if (THREE.PMREMGenerator && renderer.setRenderTarget) {
      const dome = new THREE.Scene();
      const cv = document.createElement('canvas');
      cv.width = 8; cv.height = 64;
      const g2 = cv.getContext('2d');
      const gr = g2.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, '#f4f2ec'); gr.addColorStop(0.55, '#e9e6de');
      gr.addColorStop(1, '#b9b3a5');
      g2.fillStyle = gr; g2.fillRect(0, 0, 8, 64);
      const tx = new THREE.CanvasTexture(cv);
      tx.encoding = THREE.sRGBEncoding;
      dome.add(new THREE.Mesh(new THREE.SphereGeometry(100, 16, 12),
        new THREE.MeshBasicMaterial({ map: tx, side: THREE.BackSide })));
      const pm = new THREE.PMREMGenerator(renderer);
      pm.compileEquirectangularShader();
      studio.environment = pm.fromScene(dome).texture;
      pm.dispose();
    }
  }

  // ---- THE HANGAR, built on demand ----------------------------------------
  // Deferred because it is a thousand lines of geometry and a dozen baked
  // sheets: a session that never opens the garage should not pay for a shed.
  // Built once, then kept — it does not depend on the aeroplane.
  //
  // `genHangarSupported` is asked rather than assumed. The headless smoke gate
  // stubs THREE with what the viewer needed before this room existed, and a
  // missing constructor should degrade to the studio, not throw on boot.
  const hangarScene = new THREE.Scene();
  let hangar = null, hangarTried = false;
  function getHangar() {
    if (hangarTried) return hangar;
    hangarTried = true;
    if (typeof genHangarBuild !== 'function' ||
        !genHangarSupported(THREE)) return null;
    try {
      hangar = genHangarBuild(THREE);
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
      const physWas = renderer.physicallyCorrectLights;
      renderer.physicallyCorrectLights = true;
      if (THREE.PMREMGenerator && THREE.WebGLCubeRenderTarget && renderer.setRenderTarget) {
        const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
        const cam = new THREE.CubeCamera(0.5, 100, rt);
        cam.position.set(0, 3.2, 0);
        hangar.shafts.visible = false;      // dust is not geometry to reflect
        cam.update(renderer, hangarScene);
        hangar.shafts.visible = true;
        const pm = new THREE.PMREMGenerator(renderer);
        hangarScene.environment = pm.fromCubemap(rt.texture).texture;
        pm.dispose(); rt.dispose();
      }
      renderer.physicallyCorrectLights = physWas;
      hangar.setMood(hangarMood);
    } catch (e) {
      // a room that will not build is a fallback, not a dead garage
      hangar = null;
      if (window.console) console.warn('hangar unavailable, using the studio:', e.message);
    }
    return hangar;
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
  let envKind = prefGet('flydiy.garageEnv', 'hangar') === 'studio' ? 'studio' : 'hangar';
  let hangarMood = Math.max(0, Math.min(3, +prefGet('flydiy.garageMood', 0) | 0));
  // the room actually in use: the hangar if it is wanted AND it built
  function garageScene() {
    if (envKind === 'hangar') { const h = getHangar(); if (h) return hangarScene; }
    return studio;
  }
  function garageIsHangar() { return garageScene() === hangarScene; }
  // Put the aeroplane in the chosen room and give the renderer the settings
  // that room was lit for. Exposure is a RENDERER setting, not a scene one, so
  // it has to be handed back when we leave or the world inherits the hangar's.
  function applyEnv() {
    const s = garageScene();
    if (craft.parent !== s) s.add(craft);
    if (hangar) hangar.group.position.y = groundY;
    if (studioFloor) studioFloor.position.y = groundY;
    const inRoom = inGarage && garageIsHangar() && hangar;
    renderer.toneMappingExposure = inRoom ? hangar.setMood(hangarMood).ex
                                          : WORLD_EXPOSURE;
    renderer.physicallyCorrectLights = inRoom ? true : WORLD_PHYSLIGHTS;
    syncEnvBtn();
  }
  function setEnvKind(k) {
    envKind = k === 'studio' ? 'studio' : 'hangar';
    prefSet('flydiy.garageEnv', envKind);
    if (inGarage) applyEnv();
  }
  function setMood(i) {
    hangarMood = Math.max(0, Math.min(3, i | 0));
    prefSet('flydiy.garageMood', hangarMood);
    if (inGarage) applyEnv();
  }
  // The two buttons are GARAGE-ONLY and hide themselves outside it: a room you
  // are not in is not a setting worth showing, and the rail is already full.
  // The mood button additionally hides in the studio, which has one light and
  // no weather — offering "Golden hour" for a white void would be a lie.
  function syncEnvBtn() {
    const eb = $('bEnv'), mb = $('bMood');
    if (!eb || !mb) return;                       // core-only build
    const show = inGarage && curKey === 'gen';
    eb.style.display = show ? '' : 'none';
    const h = show && garageIsHangar() && hangar;
    mb.style.display = h ? '' : 'none';
    // the label says WHERE YOU ARE, not what the click will do. A button that
    // names its own effect reads as a state and gets misread as one.
    eb.textContent = h ? 'Hangar' : 'Studio';
    eb.classList.toggle('on', !!h);
    if (h) {
      const nm = hangar.moods[hangarMood] || '';
      mb.textContent = nm.charAt(0) + nm.slice(1).toLowerCase();
    }
  }

  // ================= aircraft (rebuilt on selection) =================
  let bGeo, bPos, bCol, lines, pGeo, pPos, pts, proxy;
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
  // skinMode: 0 = skin, flex x1 · 1 = skin, flex x4 (exaggerated) · 2 = frame,
  // flex x1. The gain is x4 in mode 1 AND NOWHERE ELSE — the frame view is the
  // structure as the solver actually has it, and the button says so.
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
    const data = key === 'gen' ? genSkin(curDef) : MODELS3D[key];
    if (!data) return null;
    const dec = data.generated ? data.groups : decodeModel(data);
    // The payload's base64 strings are dead once decoded — the c172's alone are
    // ~6 MB of JS heap held for the life of the page. modelCache never evicts,
    // so decode happens exactly once and dropping them is safe. (Anything that
    // later wants to rebuild must go through modelCache, not decodeModel.)
    if (!data.generated) for (const g in data.groups) data.groups[g].b64 = null;
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
    // generated groups are already named by material; imported ones carry a mat field
    const grpMat = data.generated
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
      texs[t].anisotropy = 4;
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
    const mkGeo = g => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
      geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
      geo.computeVertexNormals();
      return geo;
    };
    const matCache = {};
    const matFor = name => {
      const mn = grpMat(name);
      if (matCache[mn]) return matCache[mn];
      const m = mats[mn], op = m.opacity !== undefined ? m.opacity : 1;
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
      const geo = mkGeo(dec[name]);
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
      if (name === 'skin' || isProp)
        mesh.castShadow = true;             // the skin replaces the proxy's sun shadow
      meshes[name] = mesh;
      grp.add(mesh);
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
    const def = AIRCRAFT[key]();
    const rigs = (SKIN_CFG[key].rig || ['skin']).filter(n => dec[n]).map(name => {
      const posAttr = meshes[name].geometry.attributes.position;
      return {
        posAttr, base: posAttr.array.slice(),
        bind: makeSkinBinding(posAttr.array, dec[name].nv, def, SKIN_CFG[key]),
        // control surface hinges (payload v2: per-vertex surface ids + hinge table)
        hb: (data.v >= 2 && dec[name].sid) ? makeHingeBinding(dec[name], data.surfaces) : null,
      };
    });
    // station structure is a property of the fiche, so one delta buffer serves all
    const nz = rigs[0].bind.zs.length;
    const deltas = { P: new Float32Array(nz * 3), N: new Float32Array(nz * 3) };
    modelCache[key] = Object.assign(entry, { grp, props, rigs, deltas,
                        surfaces: data.surfaces,
                        link: makeLinkage(LINK_TAU) });  // visual linkage lag (SKIN-PROC)
    return modelCache[key];
  }
  const mBasis = new THREE.Matrix4(), vX = new THREE.Vector3(),
        vY = new THREE.Vector3(), vZ = new THREE.Vector3();
  function poseModel() {
    // a generated model keeps posing in Frame mode: mode 2 hides the covering
    // and shows the tube truss, which is still the same rigged mesh
    if (!model || (skinMode === 2 && !model.gen)) return;
    const [xA, yU] = sim.axes(), cg = sim.cgPos(), O = SKIN_CFG[curKey].off;
    vX.set(xA[0], xA[1], xA[2]); vY.set(yU[0], yU[1], yU[2]);
    vZ.crossVectors(vX, vY);                     // z left: keeps the basis proper (no mirror)
    mBasis.makeBasis(vX, vY, vZ);
    mBasis.setPosition(
      cg[0] + O[0]*xA[0] + O[1]*yU[0],
      cg[1] + O[0]*xA[1] + O[1]*yU[1],
      cg[2] + O[0]*xA[2] + O[1]*yU[2]);
    model.grp.matrix.copy(mBasis);
    for (const p of model.props)
      p.rotation.x += (8 + 110 * sim.ctl.thr) * (1/60);            // visual only
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
                      model.deltas.P, model.deltas.N, SKIN_GAINS[skinMode],
                      r.hb && r.hb.hinged);
      r.posAttr.needsUpdate = true;   // normals kept from rest pose: flex < ~5 deg
    }
  }
  function applySkinVis() {
    const b = $('bSkin'), has = !!model;
    // `ready` gates on texture decode: the wireframe holds the frame rather
    // than showing an untextured mirror for the beat before the maps land
    const gen = has && model.gen;
    // GARAGE: Frame mode strips the COVERING off the generated aeroplane and
    // leaves the welded truss standing. That is the build sequence, not a
    // debug view, so it shows real tubes rather than the line wireframe.
    const showSkin = has && model.ready && (skinMode < 2 || gen);
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
                                : cover.includes(n) ? skinMode < 2 : true;
    }
    lines.visible = pts.visible = !showSkin;
    if (proxy) proxy.mesh.visible = !showSkin;   // the visible skin casts the shadow instead
    b.style.display = has ? '' : 'none';
    // The gain is IN THE LABEL. Two of these three modes show the aeroplane's
    // real deflection and one deliberately quadruples it, and the button used to
    // say only "Covered / Flex ×4 / Bare frame" — which reads as though the ×4
    // belonged to the middle mode's name rather than being a property the other
    // two also have (at ×1). Naming every mode's gain removes the question.
    b.textContent = gen ? ['Covered ×1', 'Flex ×4', 'Frame ×1'][skinMode]
                        : ['Skin ×1', 'Flex ×4', 'Frame ×1'][skinMode];
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
  if ($('bEnv')) $('bEnv').onclick = () =>
    setEnvKind(garageIsHangar() ? 'studio' : 'hangar');
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
    skinMode = (skinMode + 1) % 3; applySkinVis();
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
    dist = def.params.viewDist;
    const PP = POWERPLANTS[def.params.powerplant];
    let half = 0;                          // wingspan from the wing strips, like the solver
    for (const st of def.strips) if (st.kind === 'wing')
      for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
        half = Math.max(half, Math.abs(def.nodes[i].p[2]));
    const mass = sim.totalM < 5 ? (sim.totalM*1000).toFixed(0) + ' g' : sim.totalM.toFixed(0) + ' kg';
    $('acName').textContent = def.params.name;
    $('acSpec').textContent = `${mass} · ${PP.engine.name} · ${(half*2).toFixed(1)} m · ${sim.n} nodes`;
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
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) { px = e.clientX; py = e.clientY; }
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = dist;
    }
  });
  const endTouch = e => touches.delete(e.pointerId);
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  canvas.addEventListener('pointermove', e => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) {
      az += (e.clientX - px) * 0.006; el += (e.clientY - py) * 0.006;
      el = Math.max(-0.05, Math.min(1.4, el));
      px = e.clientX; py = e.clientY;
    } else if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) dist = Math.max(4, Math.min(200, dist0 * pinch0 / Math.max(20, d)));
    }
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    dist = Math.max(4, Math.min(120, dist * (1 + e.deltaY * 0.001)));
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
    if (ap.phase === 'STOPPED' && ap.tdInfo)
      $('tsum').textContent =
        `touchdown ${ap.tdInfo.sink.toFixed(2)} m/s · ${(ap.tdInfo.V * 3.6).toFixed(0)} km/h · ` +
        `${Math.abs(ap.tdInfo.z).toFixed(1)} m off centreline`;
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
  function buildIndicators() {
    if (gInd) { craft.remove(gInd); gInd.geometry.dispose(); gInd = null; }
    for (const l of gLabels) { craft.remove(l); l.material.map.dispose(); l.material.dispose(); }
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
      craft.add(sp); gLabels.push(sp);
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
    craft.add(gInd);
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
  function startLoadTest() {
    if (!inGarage) return;
    rig = makeLoadTest(sim, def, { material: (genSpec && genSpec.fuselage &&
                                              genSpec.fuselage.material) || undefined });
    if (!rig.state.ok) { rig = null; return; }        // no spar stations to load
    railPhase = ''; setRail('LOAD TEST');
  }
  function loadTestState() { return rig ? rig.state : null; }
  function endLoadTest() {
    rig = null;
    if (inGarage) enterGarage();                      // back on its wheels
  }
  function enterGarage() {
    inGarage = true; started = false; running = true;
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
    $('bGo').textContent = 'Roll out & fly';
  }
  function rollOut() {
    rig = null;
    inGarage = false;
    scene.add(craft);                  // out of the room, onto the strip
    renderer.toneMappingExposure = WORLD_EXPOSURE;
    renderer.physicallyCorrectLights = WORLD_PHYSLIGHTS;
    syncEnvBtn();
    buildIndicators();                 // clears them
    $('bGo').textContent = 'Fly the circuit';
    fullReset();
  }

  $('bGo').onclick = () => { if (inGarage) rollOut(); started = true; };
  function fullReset() {
    if (inGarage) return enterGarage();   // Reset in the garage means back to the stand
    sim.reset(0); ap = makeAutopilot(sim, def, world); applyRoute(); started = false; running = true;
    $('bPause').textContent = 'Pause'; $('bPause').classList.remove('on');
    tel.t.length = tel.alt.length = tel.V.length = tel.marks.length = 0;
    lastPhase = 'ROLL'; telBase = 0;
    telWrap.classList.remove('show'); $('bTel').classList.remove('on');
    $('tsum').textContent = '';
    railPhase = ''; setRail(null);
  }
  $('bReset').onclick = fullReset;
  // selecting the Garage build puts you IN the garage; any other aeroplane is
  // finished and goes straight to the strip
  $('selAc').onchange = e => {
    setAircraft(e.target.value);
    if (curKey === 'gen') enterGarage(); else rollOut();
    hud();
  };
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
  // ---- W13 wind: presets drive world.setWind live — no reset needed, the
  // AP flies IAS and takes wind changes mid-flight. FRESH is beyond the
  // 3 m/s the wind gate validates: sporty on purpose. Direction is fixed
  // (quartering, headwind-ish on a +x landing at HOME).
  const WINDS = {
    calm: null,
    light: { base: [-1.7, 0, 1.9], gust: 0 },
    mod:   { base: [-2.6, 0, 3.0], gust: 0.5 },
    fresh: { base: [-3.9, 0, 4.6], gust: 0.9 },
  };
  let windBase = null;
  $('selWind').onchange = e => {
    const w = WINDS[e.target.value] || null;
    world.setWind(w);
    windBase = w ? w.base : null;
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

  const R = ['ias','alt','vs','aoa','bank','agl','thr','de','da','dr','str']
    .reduce((o, k) => (o[k] = $('r-' + k), o), {});
  function hud() {
    const o = sim.out, cg = sim.cgPos(), c = sim.ctl, d = ap.dbg;
    R.ias.textContent = (o.V * 3.6).toFixed(0);
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

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
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
    }
    else if (running && !inGarage) {
      script(1 / 60);
      sim.step(1 / 60);              // substep rate is a per-aircraft property
      if (++wdFrame % 30 === 0 && !Number.isFinite(sim.p[1])) {
        running = false;
        $('phName').textContent = 'SIM DIVERGED — RESET';
      }
    }
    const cg = sim.cgPos();
    // The world does not exist while you are in the studio, so it is not
    // updated: no terrain paging, no sky, no weather, no LOD churn. That is
    // most of what the garage used to spend its frame on for scenery nobody
    // could see anyway.
    if (!inGarage) WF.worldUpdate(cg);
    else if (hangar && garageIsHangar()) hangar.faceShafts(camera);
    target.set(cg[0], cg[1], cg[2]);
    placeCamera();
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
  hud();
  loop();
})();
