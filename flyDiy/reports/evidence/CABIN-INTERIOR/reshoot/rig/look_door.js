// CABIN-RESHOOT (scratch rig): a named eye and target in the crew layer's frame (x port, y up, z forward, metres),
// resolved in the page from the crew anchors and the sheet; returns world eye / target, fov, near, what it hid.
async (name, anchor) => {
  let g = null; window.CAGE_UI_SCENE.traverse(o => { if (!g && o.name === 'cageLayer:crew') g = o; });
  if (!g) return { err: 'no crew layer' };
  const C = window.CAGE_CREW, A = C && C.A; if (!A) return { err: 'no CAGE_CREW.A' };
  g.updateMatrixWorld(true); const par = g.parent; par.updateMatrixWorld(true);
  const toW = p => par.localToWorld(new THREE.Vector3(p[0], p[1], p[2]));
  const toL = p => par.worldToLocal(new THREE.Vector3(p[0], p[1], p[2])).toArray();
  const UI = window.CAGE_UI, M = UI.MS, k = (window.CAGE2 ? CAGE2.CAGE_UNIT : 1) * ((UI.P && UI.P.planeScale) || 1);
  const V = M.V.map(p => [p[0] * k, p[1] * k, p[2] * k]), mid = (A.waistY + A.roofY) / 2;
  const T = []; for (const f of M.F) { if (f.v.length < 3) continue; const q = f.v.map(i => V[i]); for (let n = 1; n + 1 < q.length; n++) T.push([q[0], q[n], q[n + 1], f.m]); }
  const hits = (x, z) => { const ys = []; for (const [a, b, c, m] of T) { const dd = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(dd) < 1e-12) continue;
    const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / dd, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / dd;
    if (l1 < -1e-6 || l2 < -1e-6 || l1 + l2 > 1 + 1e-6) continue; ys.push(l1 * a[1] + l2 * b[1] + (1 - l1 - l2) * c[1]); } return ys.filter(y => y > mid).sort((p, q) => p - q); };
  const skinY = (x, z) => { const h = hits(x, z); return h.length ? h[h.length - 1] : A.roofY; };
  const linerY = (x, z) => { const h = hits(x, z); return h.length ? h[0] : A.roofY; };
  let zWs = -Infinity; for (const f of M.F) { if (f.m !== 'windshield') continue; for (const i of f.v) { const q = V[i]; if (q[1] > mid && Math.abs(q[0]) < 0.25) zWs = zWs === -Infinity ? q[2] : Math.min(zWs, q[2]); } }
  const seats = C.seatsAt || [], zF = Math.max(...seats.map(s => s.zBack)), front = seats.filter(s => Math.abs(s.zBack - zF) < 0.05), rear = seats.filter(s => s.zBack < zF - 0.3).sort((a, b) => b.zBack - a.zBack);
  const zS = front.reduce((a, s) => a + s.zBack, 0) / front.length, pilot = seats.find(s => s.pilot) || front[0];
  if (!isFinite(zWs)) zWs = zS + 0.5;
  const E = window.CAGE_CREW_EYE, P = E ? toL(E.p) : [pilot.x, A.waistY + 0.55, pilot.zBack + 0.12];
  const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  let eye, tgt, fov = 46, near = 0.05, hideNear = null;
  const noWing = /NW$/.test(name); if (noWing) name = name.slice(0, -2);   // ...NW: the same view with the wing layer hidden (rig only)
  const zPod = Math.min(zS + 0.47, zWs - 0.03) - 0.15;            // the console's centre (the same rule; also for BEFORE)
  if (name === 'inUp') {           // the pilot's head, up and forward: headliner, console, header
    eye = P; tgt = [0, linerY(0, zPod + 0.05) - 0.02, zPod + 0.05]; fov = 75; near = 0.02; hideNear = 0.35;
  } else if (name === 'inSide') {  // the cabin's centre, the port upper wall
    const z = (zS + (rear.length ? rear[0].zBack : zS - 0.6)) / 2 + 0.25;
    eye = [0, (A.waistY + A.roofY) / 2 + 0.08, z]; tgt = [0.6, A.roofY - 0.18, z]; fov = 75; near = 0.02; hideNear = 0.45;
  } else if (name === 'inRear') {  // the rear seat's head, forward over the front seats
    const r = rear[0], dz = P[2] - pilot.zBack;
    eye = r ? [r.x, P[1], r.zBack + dz] : [0, P[1], zS - 0.55]; tgt = [0, linerY(0, zPod) - 0.06, zPod]; fov = 70; near = 0.02; hideNear = 0.35;
  } else if (name === 'inLamp') {  // 0.4 m from the console's lamp (its pilot-side seat), from below and aft
    const s = anchor || (A.ohc && A.ohc.seats && A.ohc.seats[0] && A.ohc.seats[0].p) || [pilot.x * 0.2, linerY(0, zPod - 0.075) - 0.05, zPod - 0.075];
    const d = nrm([-0.25 * Math.sign(s[0] || 1), -0.78, -0.58]);
    eye = [s[0] + d[0] * 0.4, s[1] + d[1] * 0.4, s[2] + d[2] * 0.4]; tgt = s; fov = 50; near = 0.02; hideNear = 0.3;
  } else if (name === 'roofHdr') { // outside: the windscreen header and the roof's front at 1.2 m, eye above looking down 25 deg, from ahead-port
    const y = skinY(0, zWs - 0.04); tgt = [0, y, zWs - 0.04];
    const el = 25 * Math.PI / 180, az = 30 * Math.PI / 180;
    eye = [tgt[0] + 1.2 * Math.cos(el) * Math.sin(az), tgt[1] + 1.2 * Math.sin(el), tgt[2] + 1.2 * Math.cos(el) * Math.cos(az)]; fov = 46; near = 0.05;
  } else if (name === 'roofHdrLo') { // outside: the header from ahead-port at 1.2 m, eye 8 deg above (under a high wing's leading edge)
    const y = skinY(0, zWs - 0.04); tgt = [0, y, zWs - 0.04];
    const el = 8 * Math.PI / 180, az = 25 * Math.PI / 180;
    eye = [tgt[0] + 1.2 * Math.cos(el) * Math.sin(az), tgt[1] + 1.2 * Math.sin(el), tgt[2] + 1.2 * Math.cos(el) * Math.cos(az)]; fov = 46; near = 0.05;
  } else if (name === 'roofHdrAft') { // outside: the same from aft-port (the roof's front seen over the cabin top)
    const y = skinY(0, zWs - 0.04); tgt = [0, y, zWs - 0.04];
    const el = 25 * Math.PI / 180, az = 150 * Math.PI / 180;
    eye = [tgt[0] + 1.2 * Math.cos(el) * Math.sin(az), tgt[1] + 1.2 * Math.sin(el), tgt[2] + 1.2 * Math.cos(el) * Math.cos(az)]; fov = 46; near = 0.05;
  } else if (name === 'roofGraze') { // outside: along the roof, eye 5 cm over the skin ahead of the header, looking aft
    const z0 = zWs + 0.10, z1 = zWs - 0.9;
    eye = [0, skinY(0, zWs - 0.02) + 0.05, z0]; tgt = [0, skinY(0, z1) + 0.05, z1]; fov = 46; near = 0.02;
  } else if (name === 'roofGrazeAft') { // outside: along the roof from aft, eye 5 cm over the skin, looking forward at the header
    const z0 = zS - 0.6, z1 = zWs;
    eye = [0, skinY(0, z0) + 0.05, z0]; tgt = [0, skinY(0, zWs - 0.04) + 0.05, z1]; fov = 46; near = 0.02;
  } else if (name === 'roofAt') {  // outside: a point of the roof (anchor) at 0.9 m, from above-port-aft, 30 deg down
    const s = anchor; const el = 30 * Math.PI / 180, az = 120 * Math.PI / 180;
    tgt = s; eye = [s[0] + 0.9 * Math.cos(el) * Math.sin(az), s[1] + 0.9 * Math.sin(el), s[2] + 0.9 * Math.cos(el) * Math.cos(az)]; fov = 46; near = 0.02;
  } else return { err: 'unknown in: view ' + name };
  // hide a crew character whose head is within hideNear of the eye (the camera would sit in it)
  const hid = [];
  window.__rigHid = window.__rigHid || [];
  if (noWing) window.CAGE_UI_SCENE.traverse(o => { if (o.name === 'cageLayer:wing' && o.visible) { o.visible = false; window.__rigHid.push(o); hid.push(o.name); } });
  if (hideNear) {
    const ew = toW(eye), bw = new THREE.Vector3();
    g.traverse(o => { if (!o.isSkinnedMesh || !o.skeleton || !o.visible) return; const hb = o.skeleton.bones.find(b => /head$/i.test(b.name)); if (!hb) return;
      hb.getWorldPosition(bw); if (bw.distanceTo(ew) < hideNear) { o.visible = false; window.__rigHid.push(o); hid.push(o.name || 'skinned'); } });
  }
  const ew = toW(eye), tw = toW(tgt), d = ew.clone().sub(tw), dist = d.length();
  const az = Math.atan2(d.z, d.x), el = Math.asin(d.y / dist);
  const cam = FLIGHT_PROBE.camera(); window.__rigCam = window.__rigCam || { fov: cam.fov, near: cam.near };
  cam.fov = fov; cam.near = near; cam.updateProjectionMatrix();
  FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSettle(); await new Promise(r => requestAnimationFrame(r));
  const G = FLIGHT_PROBE.camGet(); FLIGHT_PROBE.pan(tw.x - G.target[0], tw.y - G.target[1], tw.z - G.target[2]); FLIGHT_PROBE.camSet(az, el, dist);
  const r3 = v => v.map(x => +x.toFixed(3));
  return { asked: [az, el, dist], eyeL: r3(eye), tgtL: r3(tgt), eyeW: r3(ew.toArray()), fov, near, hid, zWs: +zWs.toFixed(3), zS: +zS.toFixed(3), zPod: +zPod.toFixed(3), P: r3(P), ohc: A.ohc, crewEye: !!E };
}
