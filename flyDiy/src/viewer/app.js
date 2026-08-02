(() => {
  const world = makeWorld();
  const AIRCRAFT = { cub: buildCub, drone: buildDrone, dc3: buildDC3, jojo: buildJodel, c172: buildC172, chnk: buildChinook };
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

  // ================= 3d skin (baked OBJ, cub only for now) =================
  // Rigid mount in the body frame: model frame is (x aft, y up, z left), RH.
  // Offset calibrated so model main wheels sit on the sim's axle contact points.
  const MODELS3D = (typeof MODEL_PA18 !== 'undefined') ? { cub: MODEL_PA18 } : {};
  // per-aircraft skin config: body-frame mount offset + binding thresholds (SKIN-PROC.md)
  const SKIN_CFG = { cub: { off: [1.690, -0.070, 0], tags: ['WF', 'WR'],
                            zRoot: 1.30, xMax: 1.5 } };
  const modelCache = {};
  // skinMode: 0 = skin, flex x1 · 1 = skin, flex x4 (exaggerated) · 2 = frame only
  const SKIN_GAINS = [1, 4];
  const LINK_TAU = 0.15;   // s per pole, two poles; 0 -> raw ctl on the surfaces
  let model = null, skinMode = 0;
  function buildModel(key) {
    if (modelCache[key]) return modelCache[key];
    const data = MODELS3D[key];
    if (!data) return null;
    const dec = decodeModel(data);
    const tex = new THREE.TextureLoader().load(data.tex);
    tex.anisotropy = 4;
    const mkGeo = g => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
      geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
      geo.computeVertexNormals();
      return geo;
    };
    const skinMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    const grp = new THREE.Group();
    grp.matrixAutoUpdate = false;
    const skin = new THREE.Mesh(mkGeo(dec.skin), skinMat);
    skin.castShadow = true;                 // the skin replaces the proxy's sun shadow
    grp.add(skin);
    grp.add(new THREE.Mesh(mkGeo(dec.glass), new THREE.MeshLambertMaterial({
      color: 0xaad4ea, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false })));
    const pGeo = mkGeo(dec.prop);
    pGeo.translate(-data.hub[0], -data.hub[1], -data.hub[2]);
    const prop = new THREE.Mesh(pGeo, skinMat);
    prop.position.set(data.hub[0], data.hub[1], data.hub[2]);
    prop.castShadow = true;
    grp.add(prop);
    grp.frustumCulled = false;
    grp.traverse(o => { o.frustumCulled = false; });
    // deformation binding: wing-band vertices follow the sim spar stations
    const skinGeo = grp.children[0].geometry;
    const posAttr = skinGeo.attributes.position;
    const bind = makeSkinBinding(posAttr.array, dec.skin.nv, AIRCRAFT[key](), SKIN_CFG[key]);
    const deltas = { P: new Float32Array(bind.zs.length * 3),
                     N: new Float32Array(bind.zs.length * 3) };
    // control surface hinges (payload v2: per-vertex surface ids + hinge table)
    const hb = (data.v >= 2 && dec.skin.sid) ? makeHingeBinding(dec.skin, data.surfaces) : null;
    modelCache[key] = { grp, prop, bind, deltas, posAttr, hb, surfaces: data.surfaces,
                        link: makeLinkage(LINK_TAU),   // visual linkage lag (see SKIN-PROC)
                        base: posAttr.array.slice() };
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
    model.prop.rotation.x += (8 + 110 * sim.ctl.thr) * (1/60);   // visual only
    if (model.hb)
      applyHinges(model.hb, model.surfaces, model.base, model.posAttr.array,
                  model.link.step(sim.ctl, 1/60));
    sparDeltas(model.bind, sim, model.deltas);
    applySkinDeform(model.bind, model.base, model.posAttr.array,
                    model.deltas.P, model.deltas.N, SKIN_GAINS[skinMode],
                    model.hb && model.hb.hinged);
    model.posAttr.needsUpdate = true;   // normals kept from rest pose: flex < ~5 deg
  }
  function applySkinVis() {
    const b = $('bSkin'), has = !!model;
    const showSkin = has && skinMode < 2;
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

  function setAircraft(key) {
    def = AIRCRAFT[key]();
    sim = makeSim(def, world);
    sim.reset(0);
    ap = makeAutopilot(sim, def);
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
  const PHASES = [['ROLL','TAKEOFF ROLL'],['LIFTOFF','LIFT-OFF'],['CLIMB','CLIMB'],
    ['CRUISE','CRUISE'],['TURNBACK','TURNBACK'],['INBOUND','INBOUND'],
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
  let telAcc = 0, lastPhase = 'ROLL';
  const telWrap = $('telp');

  function record(dt) {
    telAcc += dt;
    if (telAcc < 0.1) return;
    telAcc = 0;
    tel.t.push(ap.t); tel.alt.push(ap.dbg.alt || 0); tel.V.push((ap.dbg.V || 0) * 3.6);
    if (ap.phase !== lastPhase) { tel.marks.push([ap.t, ap.phase]); lastPhase = ap.phase; }
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
    if (!started) { setRail(null); return; }
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
    sim.reset(0); ap = makeAutopilot(sim, def); started = false; running = true;
    $('bPause').textContent = 'Pause'; $('bPause').classList.remove('on');
    tel.t.length = tel.alt.length = tel.V.length = tel.marks.length = 0;
    lastPhase = 'ROLL'; telWrap.classList.remove('show'); $('bTel').classList.remove('on');
    $('tsum').textContent = '';
    railPhase = ''; setRail(null);
  }
  $('bReset').onclick = fullReset;
  $('selAc').onchange = e => { setAircraft(e.target.value); fullReset(); hud(); };
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

  setAircraft('cub');
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
    if (++frame % 6 === 0) { hud(); if (telWrap.classList.contains('show')) drawTel(); }
    renderer.render(scene, camera);
  }
  hud();
  loop();
})();
