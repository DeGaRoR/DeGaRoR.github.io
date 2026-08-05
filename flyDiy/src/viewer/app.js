(() => {
  const world = makeWorld();
  const AIRCRAFT = { pa18: buildPA18, cub: buildCub, drone: buildDrone, dc3: buildDC3, jojo: buildJodel, c172: buildC172, chnk: buildChinook };
  let def, sim, ap, nb, curKey;
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

  // ================= aircraft (rebuilt on selection) =================
  let bGeo, bPos, bCol, lines, pGeo, pPos, pts, proxy;
  function buildShadowProxy() {
    // invisible skin stitched across wingtips/engines/tailplane so the
    // wireframe casts a real sun shadow. ENGL/ENGR exist only on the Cub and
    // DC-3; single-engine fiches fall back to their lone ENG node.
    if (proxy) { scene.remove(proxy.mesh); proxy.mesh.geometry.dispose(); proxy = null; }
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
    scene.add(mesh);
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
  // skinMode: 0 = skin, flex x1 · 1 = skin, flex x4 (exaggerated) · 2 = frame only
  const SKIN_GAINS = [1, 4];
  const LINK_TAU = 0.15;   // s per pole, two poles; 0 -> raw ctl on the surfaces
  let model = null, skinMode = 0;
  // transparent-pass determinism (r128): gauge covers paint before cabin glass
  const RENDER_ORDER = { covers: 1, glass: 2 };
  function buildModel(key) {
    if (modelCache[key]) return modelCache[key];
    const data = MODELS3D[key];
    if (!data) return null;
    const dec = decodeModel(data);
    // The payload's base64 strings are dead once decoded — the c172's alone are
    // ~6 MB of JS heap held for the life of the page. modelCache never evicts,
    // so decode happens exactly once and dropping them is safe. (Anything that
    // later wants to rebuild must go through modelCache, not decodeModel.)
    for (const g in data.groups) data.groups[g].b64 = null;
    // v3 payloads carry texs/mats tables + per-group mat; v2 shim implies them
    const texSrcs = data.texs || { skin: data.tex };
    const mats = data.mats || { skin: { tex: 'skin' }, glass: { opacity: 0.28, color: 0xaad4ea } };
    const grpMat = name => (data.texs && data.groups[name].mat) ||
                           (name === 'glass' ? 'glass' : 'skin');
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
      const common = { side: THREE.DoubleSide, transparent: op < 1, opacity: op,
        depthWrite: op >= 1,
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
      return matCache[mn] = new THREE.MeshStandardMaterial(m.tex
        ? Object.assign({ map: texs[m.tex],
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
      // every group named prop* turns with the propeller (blades, spinner, cap)
      const isProp = name.lastIndexOf('prop', 0) === 0;
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
    if (!model || skinMode === 2) return;
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
    const showSkin = has && skinMode < 2 && model.ready;
    if (model) model.grp.visible = showSkin;
    lines.visible = pts.visible = !showSkin;
    if (proxy) proxy.mesh.visible = !showSkin;   // the visible skin casts the shadow instead
    b.style.display = has ? '' : 'none';
    b.textContent = ['Skin', 'Flex ×4', 'Frame'][skinMode];
    b.classList.toggle('on', showSkin);
  }
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
    if (lines) { scene.remove(lines); lines.geometry.dispose(); }
    if (pts) { scene.remove(pts); pts.geometry.dispose(); }
    bGeo = new THREE.BufferGeometry();
    bPos = new Float32Array(nb * 6); bCol = new Float32Array(nb * 6);
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    lines = new THREE.LineSegments(bGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
    lines.frustumCulled = false;
    scene.add(lines);
    pGeo = new THREE.BufferGeometry();
    pPos = new Float32Array(sim.n * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xc8d8ea,
      size: key === 'drone' ? 0.018 : 0.06 }));
    pts.frustumCulled = false;
    scene.add(pts);
    buildShadowProxy();
    curKey = key;
    if (model) scene.remove(model.grp);
    model = buildModel(key);
    if (model) scene.add(model.grp);
    applySkinVis();
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
    let past = active !== null;
    for (const [k] of PHASES) {
      const d = tickEls[k];
      if (k === active) { d.className = 'now'; past = false; }
      else d.className = past ? 'done' : '';
    }
  }

  // ================= autopilot + telemetry =================
  let running = true, started = false;
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

  $('bGo').onclick = () => { started = true; };
  function fullReset() {
    sim.reset(0); ap = makeAutopilot(sim, def, world); applyRoute(); started = false; running = true;
    $('bPause').textContent = 'Pause'; $('bPause').classList.remove('on');
    tel.t.length = tel.alt.length = tel.V.length = tel.marks.length = 0;
    lastPhase = 'ROLL'; telBase = 0;
    telWrap.classList.remove('show'); $('bTel').classList.remove('on');
    $('tsum').textContent = '';
    railPhase = ''; setRail(null);
  }
  $('bReset').onclick = fullReset;
  $('selAc').onchange = e => { setAircraft(e.target.value); fullReset(); hud(); };
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
    if (running) {
      script(1 / 60);
      sim.step(1 / 60);              // substep rate is a per-aircraft property
      if (++wdFrame % 30 === 0 && !Number.isFinite(sim.p[1])) {
        running = false;
        $('phName').textContent = 'SIM DIVERGED — RESET';
      }
    }
    const cg = sim.cgPos();
    WF.worldUpdate(cg);
    target.set(cg[0], cg[1], cg[2]);
    placeCamera();
    sync();
    poseModel();
    if (++frame % 6 === 0) { hud(); drawMap(); if (telWrap.classList.contains('show')) drawTel(); }
    renderer.render(scene, camera);
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
