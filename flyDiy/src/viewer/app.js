(() => {
  const world = makeWorld();
  const AIRCRAFT = { cub: buildCub, drone: buildDrone, dc3: buildDC3, jojo: buildJodel, c172: buildC172, chnk: buildChinook };
  let def, sim, ap, nb;

  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1b2e);
  scene.fog = new THREE.Fog(0x0d1b2e, 300, 1900);

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

  const worldFx = buildWorldScene(scene, world);

  // ================= aircraft (rebuilt on selection) =================
  let bGeo, bPos, bCol, lines, pGeo, pPos, pts;
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
    dist = def.params.viewDist;
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

  // ================= autopilot + telemetry =================
  let running = true, started = false;
  const tel = { t: [], alt: [], V: [], marks: [] };
  let telAcc = 0, lastPhase = 'ROLL';
  const phaseEl = document.getElementById('phase');
  const telWrap = document.getElementById('telWrap');

  function record(dt) {
    telAcc += dt;
    if (telAcc < 0.1) return;
    telAcc = 0;
    tel.t.push(ap.t); tel.alt.push(ap.dbg.alt || 0); tel.V.push((ap.dbg.V || 0) * 3.6);
    if (ap.phase !== lastPhase) { tel.marks.push([ap.t, ap.phase]); lastPhase = ap.phase; }
  }
  function drawTel() {
    const cv = document.getElementById('tel'), g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    if (tel.t.length < 2) return;
    const t1 = tel.t[tel.t.length - 1], W = cv.width, H = cv.height;
    const aMax = Math.max(20, ...tel.alt) * 1.1, vMax = Math.max(60, ...tel.V) * 1.1;
    g.strokeStyle = '#2a4468'; g.beginPath();
    g.moveTo(0, H - 0.5); g.lineTo(W, H - 0.5); g.stroke();
    const line = (arr, max, color) => {
      g.strokeStyle = color; g.beginPath();
      for (let i = 0; i < tel.t.length; i++) {
        const x = tel.t[i] / t1 * W, y = H - arr[i] / max * (H - 12);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    };
    line(tel.alt, aMax, '#4fd8e8');
    line(tel.V, vMax, '#ff9a3c');
    g.fillStyle = '#5a7291'; g.font = '9px monospace';
    for (const [tm, ph] of tel.marks) {
      const x = tm / t1 * W;
      g.fillRect(x, 0, 1, H);
      g.save(); g.translate(x + 3, 10); g.rotate(Math.PI / 2); g.fillText(ph, 0, 0); g.restore();
    }
  }

  function script(dt) {
    if (!started) { phaseEl.textContent = 'HOLDING'; return; }
    ap.update(dt);
    record(dt);
    let txt = ap.phase;
    if (ap.phase === 'STOPPED' && ap.tdInfo) {
      txt = `STOPPED — touchdown sink ${ap.tdInfo.sink.toFixed(2)} m/s at ${(ap.tdInfo.V * 3.6).toFixed(0)} km/h, ${Math.abs(ap.tdInfo.z).toFixed(1)} m off centerline`;
      telWrap.classList.add('show'); drawTel();
    }
    phaseEl.textContent = txt;
  }

  document.getElementById('bGo').onclick = () => { started = true; };
  function fullReset() {
    sim.reset(0); ap = makeAutopilot(sim, def); started = false;
    tel.t.length = tel.alt.length = tel.V.length = tel.marks.length = 0;
    lastPhase = 'ROLL'; telWrap.classList.remove('show');
    phaseEl.textContent = 'HOLDING';
  }
  document.getElementById('bReset').onclick = fullReset;
  const selBtns = { cub: document.getElementById('bCub'), drone: document.getElementById('bDrone'),
                    dc3: document.getElementById('bDC3'), jojo: document.getElementById('bJojo'), c172: document.getElementById('bC172'), chnk: document.getElementById('bChnk') };
  for (const key of ['cub', 'drone', 'dc3', 'jojo', 'c172', 'chnk']) {
    selBtns[key].onclick = () => {
      setAircraft(key); fullReset();
      for (const k in selBtns) selBtns[k].classList.toggle('on', k === key);
      hud();
    };
  }
  document.getElementById('bPause').onclick = e => {
    running = !running; e.target.textContent = running ? 'Pause' : 'Run';
  };
  document.getElementById('bTel').onclick = () => {
    telWrap.classList.toggle('show'); drawTel();
  };

  const inst = document.getElementById('inst');
  function hud() {
    const o = sim.out, cg = sim.cgPos(), c = sim.ctl, d = ap.dbg;
    inst.innerHTML =
      `IAS <b>${(o.V * 3.6).toFixed(0)}</b> km/h   ALT <b>${cg[1].toFixed(1)}</b> m   ` +
      `VS ${o.vs >= 0 ? '+' : ''}${o.vs.toFixed(1)} m/s\n` +
      `α ${(o.alpha * 57.3).toFixed(1)}°   bank ${((d.ph || 0) * 57.3).toFixed(1)}°   ` +
      `AGL ${(d.agl || 0).toFixed(1)} m\n` +
      `thr ${(c.thr * 100).toFixed(0)}%   elev ${(c.de * 57.3).toFixed(1)}°   ` +
      `ail ${(c.da * 57.3).toFixed(1)}°   rud ${(c.dr * 57.3).toFixed(1)}°\n` +
      `${def.params.name} — ${POWERPLANTS[def.params.powerplant].engine.name} · ` +
      `${POWERPLANTS[def.params.powerplant].prop.name}\n` +
      `${sim.n} nodes · ${nb} beams · ${sim.totalM < 5 ? (sim.totalM*1000).toFixed(0) + ' g' : sim.totalM.toFixed(0) + ' kg'}`;
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
        phaseEl.textContent = 'SIM DIVERGED — press Reset';
      }
    }
    const cg = sim.cgPos();
    target.set(cg[0], cg[1], cg[2]);
    placeCamera();
    sync();
    if (++frame % 6 === 0) hud();
    renderer.render(scene, camera);
  }
  hud();
  loop();
})();
