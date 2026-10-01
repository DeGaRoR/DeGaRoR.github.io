// pave_diff.js - THE PAVEMENT OLD vs NEW, PIXEL FOR PIXEL, AND THE PROP DISC OVER THE PAVEMENT (2026-10-01), for
// rollout_perf's --eval (with --eval-ms 600000):
//   node tools/rollout_perf.js --port <p> --udd <dir> --secs 25 --q pave=new --eval @tools/pave_diff.js --eval-ms 600000
// One expression. The flight PAUSED and the shadow maps frozen, the page's own main camera:
//   APRON   the scene rendered NEW -> OLD -> NEW again (PAVE_AB stands the pavement again between) into one render
//           target; NEW-vs-NEW is the floor (nothing should move), NEW-vs-OLD is what AS4b changed: pixels over 2 / 8 / 32
//           codes, and where they lie (a coarse grid of the image). A seam of the table (a neighbour row bleeding in)
//           would show as lines in NEW-vs-OLD only; a line in both NEW and OLD is not the table's.
//   DISC    a side camera at the spinning prop disc's height, 7 m off its axis, looking across it over the pavement:
//           the disc must draw OVER the pavement (the user's report: its lower half was gone over the apron).
// Returns the stats and JPEG stills (data URLs) of each capture and of the amplified diff, for the rig's log.
(async () => {
  const W = window.WORLD, R = W.renderer, P = window.PAVEMENT || (typeof PAVEMENT !== 'undefined' ? PAVEMENT : null);
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const frames = async n => { for (let i = 0; i < n; i++) await raf(); };
  let cap = null; const rr = R.render;
  R.render = function (s, c) { if (!cap && s === W.scene) cap = { s, c }; return rr.apply(this, arguments); };
  await frames(3); R.render = rr;
  if (!cap) return { err: 'the main pass was not caught' };
  { const bP = document.getElementById('bPause'); if (bP && !window.FLYDIY_HELD) bP.click(); await frames(60); }
  const SM = R.shadowMap, su = SM.autoUpdate;
  const w = Math.min(1600, R.domElement.width), h = Math.round(w * R.domElement.height / R.domElement.width);
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, colorSpace: THREE.SRGBColorSpace, type: THREE.UnsignedByteType });
  const grab = cam => { SM.autoUpdate = false; SM.needsUpdate = false; const was = R.getRenderTarget(); R.setRenderTarget(rt); rr.call(R, cap.s, cam); R.setRenderTarget(was);
    const px = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, px); SM.autoUpdate = su; return px; };
  const jpeg = (px, amp, ref) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), id = x.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = ((h - 1 - y) * w + i) * 4, d = (y * w + i) * 4;   // GL rows bottom-up
      if (amp) { const m = Math.max(Math.abs(px[s] - ref[s]), Math.abs(px[s + 1] - ref[s + 1]), Math.abs(px[s + 2] - ref[s + 2])); const v = Math.min(255, m * amp); id.data[d] = v; id.data[d + 1] = v; id.data[d + 2] = v; }
      else { id.data[d] = px[s]; id.data[d + 1] = px[s + 1]; id.data[d + 2] = px[s + 2]; }
      id.data[d + 3] = 255; }
    x.putImageData(id, 0, 0); return c.toDataURL('image/jpeg', 0.9); };
  const cmp = (a, b) => { let n2 = 0, n8 = 0, n32 = 0, mx = 0; const G = 8, grid = Array.from({ length: G }, () => new Array(G).fill(0));
    for (let i = 0; i < a.length; i += 4) { const m = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (m > mx) mx = m; if (m > 2) { n2++; const p = i / 4, y = h - 1 - Math.floor(p / w), x = p % w; grid[Math.floor(y * G / h)][Math.floor(x * G / w)]++; } if (m > 8) n8++; if (m > 32) n32++; }
    return { over2: n2, over8: n8, over32: n32, max: mx, of: a.length / 4, grid }; };
  const out = { size: [w, h], mode0: P && P.MODE && P.MODE.table ? 'new' : 'old' };
  // ---- APRON: NEW, OLD, NEW
  if (P && P.ab) {
    P.ab('new'); await frames(150); const A = grab(cap.c);
    P.ab('old'); await frames(150); const B = grab(cap.c);
    P.ab('new'); await frames(150); const A2 = grab(cap.c);
    out.apron = { cam: [cap.c.position.x, cap.c.position.y, cap.c.position.z].map(v => +v.toFixed(1)), floor: cmp(A, A2), newVsOld: cmp(A, B),
      jpgNew: jpeg(A), jpgOld: jpeg(B), jpgDiff: jpeg(A, 16, B), jpgFloor: jpeg(A, 16, A2) };
  }
  // ---- STAND: the user's angle - on HOME's apron, LOW (1.6 m), looking toward the nearest hangar - NEW, OLD
  { const FP = window.FLIGHT_PROBE, sm = FP && FP.sim && FP.sim(), cg = sm && sm.cgPos ? sm.cgPos() : null, wd = FP && FP.world && FP.world();
    let hg = null, hd = Infinity;
    if (cg) cap.s.traverse(o => { if (!/hangar|shed/i.test(o.name || '')) return; const p = new THREE.Vector3(); o.getWorldPosition(p); const d = Math.hypot(p.x - cg[0], p.z - cg[2]); if (d > 15 && d < 600 && d < hd) { hd = d; hg = p; } });
    if (cg && hg && wd && P && P.ab) {
      const dir = new THREE.Vector3(hg.x - cg[0], 0, hg.z - cg[2]).normalize();
      const cam = cap.c.clone(); const cx = cg[0] - dir.x * 12, cz = cg[2] - dir.z * 12;
      cam.position.set(cx, wd.terrainH(cx, cz) + 1.6, cz); cam.lookAt(hg.x, wd.terrainH(hg.x, hg.z) + 2.5, hg.z);
      cam.aspect = w / h; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const was = P.MODE.table ? 'new' : 'old';
      P.ab('new'); await frames(120); const A = grab(cam);
      P.ab('old'); await frames(120); const B = grab(cam);
      P.ab(was); await frames(60);
      out.stand = { cam: cam.position.toArray().map(v => +v.toFixed(1)), toward: hg.toArray().map(v => +v.toFixed(1)), dist: +hd.toFixed(0), newVsOld: cmp(A, B), jpgNew: jpeg(A), jpgOld: jpeg(B), jpgDiff: jpeg(A, 16, B) };
    } else out.stand = { err: 'no hangar near the craft (' + (hg ? 'world' : 'hangar') + ' missing)' };
  }
  // ---- DISC: a side camera over the pavement
  let disc = null; cap.s.traverse(o => { if (!disc && o.userData && o.userData.propDisc) disc = o; });
  if (disc) {
    disc.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(disc.matrixWorld);
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(disc.matrixWorld));   // the disc's own plane normal is unknown here: use the craft's forward
    const FP = window.FLIGHT_PROBE, sm = FP && FP.sim && FP.sim(), cg = sm && sm.cgPos ? sm.cgPos() : null;
    const fwd = cg ? new THREE.Vector3(c.x - cg[0], 0, c.z - cg[2]).normalize() : ax.setY(0).normalize();
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const cam = cap.c.clone(); cam.position.copy(c).addScaledVector(side, 7).addScaledVector(fwd, 1.5); cam.position.y = c.y + 0.6; cam.lookAt(c.x, c.y - 0.3, c.z);
    cam.aspect = w / h; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const D = grab(cam);
    out.disc = { visible: disc.visible, renderOrder: disc.renderOrder, opacity: +(disc.material.opacity || 0).toFixed(3), at: [c.x, c.y, c.z].map(v => +v.toFixed(2)), jpg: jpeg(D) };
  } else out.disc = { err: 'no prop disc in the scene' };
  rt.dispose();
  return out;
})()
