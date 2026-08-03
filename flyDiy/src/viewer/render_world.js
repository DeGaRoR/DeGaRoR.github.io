// ================= world rendering (shared generator) =================
// Golden hour: low sun aft-right, warm haze, long shadows.
// Builds every static scene element from the shared `world` object and
// returns { worldUpdate(cg) } — per-frame sun-frustum follow + cloud drift.
// Airfield decals are scaled to the CURRENT 1100 m runway (centre x=-520,
// thresholds +20/-1060); the physics flat pad is x in [-1180, 130].
function buildWorldScene(scene, world, renderer, camera) {
  const C = h => new THREE.Color(h).convertSRGBToLinear();
  const HAZE = 0xe8bd8d, SUNC = 0xffd39a;
  const SUN = new THREE.Vector3(0.80, 0.185, 0.57).normalize();
  scene.fog = new THREE.Fog(C(HAZE), 600, 5200);
  scene.add(camera);

  { // sky dome — parented to the camera so it never runs out
    const mat = new THREE.ShaderMaterial({
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
        }`,
      side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2, 32, 20), mat);
    sky.renderOrder = -1000; sky.frustumCulled = false;
    camera.add(sky);
  }

  scene.add(new THREE.HemisphereLight(C(0xbcd8f0), C(0x6a5a3c), 0.50));
  const sun = new THREE.DirectionalLight(C(SUNC), 2.75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.18;
  { const sc = sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
    sc.near = 20; sc.far = 1500; sc.updateProjectionMatrix(); }
  scene.add(sun); scene.add(sun.target);

  { // terrain: geometry from world.terrainH, colour baked to a texture.
    // SEG 512 (17.6 m polys) so the stage-1 river carves (8-45 m wide)
    // actually register in the mesh — at 256 they aliased away.
    const SEG = 512, SIZE = 9000, HALF = SIZE / 2;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const posA = geo.attributes.position;
    for (let i = 0; i < posA.count; i++)
      posA.setY(i, world.terrainH(posA.getX(i), posA.getZ(i)));
    geo.computeVertexNormals();

    // --- colour map: smooth height/slope base + crisp field patchwork ---
    const hsh = (ix, iz) => { let h = (ix * 374761393 + iz * 668265263 + 1013904223) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const MEAD = 0x8d9a54, GRASS = 0x74853c, DRY = 0xb5a068, ROCK = 0x8a7d6b,
          HIGH = 0x736d63, SNOW = 0xe9e2d3, SHORE = 0xc9b78c;
    const c = new THREE.Color(), c2 = new THREE.Color();
    const N = 320;
    const small = document.createElement('canvas'); small.width = small.height = N;
    const sctx = small.getContext('2d'), img = sctx.createImageData(N, N);
    const hG = new Float32Array(N * N), lowG = new Float32Array(N * N);
    const wx = i => -HALF + (i + 0.5) / N * SIZE;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = wx(i), z = wx(j), h = world.terrainH(x, z), e = 16;
      const slope = Math.min(1, Math.hypot(
        world.terrainH(x + e, z) - world.terrainH(x - e, z),
        world.terrainH(x, z + e) - world.terrainH(x, z - e)) / (2 * e) * 1.15);
      hG[j * N + i] = h;
      lowG[j * N + i] = (1 - Math.min(1, Math.max(0, (h - 55) / 90))) * (1 - Math.min(1, slope * 3.2));
      c.setHex(MEAD).lerp(c2.setHex(GRASS), Math.min(1, Math.max(0, (h - 10) / 90)));
      if (h > 90) c.lerp(c2.setHex(DRY), Math.min(1, (h - 90) / 150));
      if (h > 220) c.lerp(c2.setHex(ROCK), Math.min(1, (h - 220) / 170));
      if (h > 400) c.lerp(c2.setHex(HIGH), Math.min(1, (h - 400) / 160));
      const snowLine = 470 + slope * 250;
      if (h > snowLine) c.lerp(c2.setHex(SNOW), Math.min(1, (h - snowLine) / 90));
      if (h < 6) c.lerp(c2.setHex(SHORE), Math.min(1, (6 - h) / 8) * 0.85);
      c.lerp(c2.setHex(ROCK), Math.max(0, slope - 0.40) * 1.25 * (h > 60 ? 1 : 0.3));
      { // stage-2 biome tint: forest floor under stands, coastal sand, scree
        const sc = world.surface(x, z);
        if (sc === world.SURFACE.FOREST_FLOOR) c.lerp(c2.setHex(0x51602f), 0.42);
        else if (sc === world.SURFACE.SAND) c.lerp(c2.setHex(0xcfbe8a), 0.80);
        else if (sc === world.SURFACE.SCREE) c.lerp(c2.setHex(0x8f8570), 0.65);
      }
      const o = (j * N + i) * 4;
      img.data[o] = c.r * 255; img.data[o+1] = c.g * 255; img.data[o+2] = c.b * 255; img.data[o+3] = 255;
    }
    sctx.putImageData(img, 0, 0);

    const TW = 2048, cv = document.createElement('canvas');
    cv.width = cv.height = TW;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, TW, TW);
    const px = x => (x + HALF) / SIZE * TW, pz = z => (z + HALF) / SIZE * TW;
    const lowAt = (x, z) => {
      const i = Math.min(N-1, Math.max(0, Math.round((x + HALF) / SIZE * N - 0.5)));
      const j = Math.min(N-1, Math.max(0, Math.round((z + HALF) / SIZE * N - 0.5)));
      return lowG[j * N + i];
    };
    const FIELDS = ['#8a9a4e', '#c0aa61', '#b0a05e', '#96764f', '#6d8036',
                    '#9aa855', '#a8ab52', '#7e8f42'];
    const CS = 190;
    for (let fz = -HALF; fz < HALF; fz += CS) for (let fx = -HALF; fx < HALF; fx += CS) {
      const cx = fx + CS / 2, cz = fz + CS / 2;
      const low = lowAt(cx, cz);
      if (low < 0.25) continue;
      const strip = (Math.abs(cz) < 110 && cx < 130 && cx > -1180) ? 0 : 1;
      if (!strip) continue;
      const ix = Math.round(fx / CS), iz = Math.round(fz / CS);
      const r1 = hsh(ix, iz), r2 = hsh(ix + 91, iz - 13), r3 = hsh(ix - 7, iz + 51);
      const w = CS * (0.80 + r3 * 0.34), d = CS * (0.72 + r2 * 0.42);
      g.save();
      g.translate(px(cx + (r1 - 0.5) * 40), pz(cz + (r2 - 0.5) * 40));
      g.rotate((r3 - 0.5) * 0.5);
      g.globalAlpha = low * (0.32 + r2 * 0.34);
      g.fillStyle = FIELDS[(r1 * FIELDS.length) | 0];
      const W2 = w / SIZE * TW, D2 = d / SIZE * TW;
      g.fillRect(-W2/2, -D2/2, W2, D2);
      if (r3 > 0.55) {                       // ploughed furrows
        g.globalAlpha = low * 0.14;
        g.fillStyle = '#6f5a3e';
        for (let u = -W2/2; u < W2/2; u += 5) g.fillRect(u, -D2/2, 2, D2);
      }
      g.globalAlpha = low * 0.30;            // hedgerow
      g.strokeStyle = '#55672f'; g.lineWidth = 1.3;
      g.strokeRect(-W2/2, -D2/2, W2, D2);
      g.restore();
    }
    g.globalAlpha = 1;
    { // grain: fine speckle so the ground has texture at low altitude
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
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
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
          'diffuseColor.rgb *= mix(vec3(1.0), dC * 2.08, dF * 0.62);');
    };
    const ground = new THREE.Mesh(geo, gMat);
    ground.receiveShadow = true;
    scene.add(ground);

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
    const conif = P.filter(t => t.sp < 2), broad = P.filter(t => t.sp >= 2);

    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1.9, 5);
    trunkGeo.translate(0, 0.95, 0);
    const coneGeo = new THREE.ConeGeometry(1.7, 5.4, 7);
    coneGeo.translate(0, 3.9, 0);
    const blobGeo = new THREE.IcosahedronGeometry(2.05, 0);
    blobGeo.scale(1, 1.12, 1); blobGeo.translate(0, 3.5, 0);

    const trunks = new THREE.InstancedMesh(trunkGeo,
      new THREE.MeshLambertMaterial({ color: C(0x584431) }), P.length);
    const mk = (geo, list) => {
      const m = new THREE.InstancedMesh(geo,
        new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
      m.castShadow = true; m.receiveShadow = true; return m;
    };
    const cMesh = mk(coneGeo, conif), bMesh = mk(blobGeo, broad);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0),
          pv = new THREE.Vector3(), sv = new THREE.Vector3(), c3 = new THREE.Color();
    // per-species colour ramps (stage 2): spruce, pine, oak, birch, willow
    const SPC = [
      [C(0x2e4620), C(0x486327)],
      [C(0x4c6a2f), C(0x6f8038)],
      [C(0x5b7333), C(0x84813c)],
      [C(0x7c8f3f), C(0xa39f55)],
      [C(0x6d874d), C(0x8fa05e)],
    ];
    let ci = 0, bi = 0;
    P.forEach((T, i) => {
      const w = T.r, sp = T.sp;
      q.setFromAxisAngle(up, w * 6.283);
      pv.set(T.x, T.h - 0.05, T.z);
      sv.set(T.s * (0.86 + w * 0.28), T.s * (0.9 + w * 0.3), T.s * (0.86 + w * 0.28));
      if (sp === 1) { sv.x *= 0.78; sv.z *= 0.78; sv.y *= 1.15; }        // pine: tall, narrow
      else if (sp === 3) sv.multiplyScalar(0.82);                        // birch: slighter
      else if (sp === 4) { sv.y *= 0.72; sv.x *= 1.18; sv.z *= 1.18; }   // willow: low, wide
      m4.compose(pv, q, sv);
      trunks.setMatrixAt(i, m4);
      c3.copy(SPC[sp][0]).lerp(SPC[sp][1], w);
      if (sp < 2) { cMesh.setMatrixAt(ci, m4); cMesh.setColorAt(ci, c3); ci++; }
      else { bMesh.setMatrixAt(bi, m4); bMesh.setColorAt(bi, c3); bi++; }
    });
    trunks.instanceMatrix.needsUpdate = true;
    for (const m of [cMesh, bMesh]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      scene.add(m);
    }
    scene.add(trunks);
  }

  { // airfield: mown grass strip, threshold bars, markers, hangars, windsock
    // each layer gets its own height: coplanar decals + a log depth buffer z-fight
    // lit like the terrain, so the same sun shadows fall across them
    const decal = (w, h, color, y, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshLambertMaterial({ color: C(color), depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = Math.round(y * 100);
      m.receiveShadow = true;
      m.position.set(x, y, z); scene.add(m); return m;
    };
    { // strip + all markings baked into ONE texture on ONE plane at 2 cm:
      // the old per-marking decal stack (5..17 cm) was visibly floating and
      // buried the foam trainer (14 cm tall) under its own runway markings.
      const RW = 4096, RH = 128;                       // 1100x30 m -> ~3.7 px/m
      const cv2 = document.createElement('canvas'); cv2.width = RW; cv2.height = RH;
      const q = cv2.getContext('2d');
      const u = x => (x + 1070) / 1100 * RW, vv = z => (z + 15) / 30 * RH;
      const uw = w => w / 1100 * RW, vw = w => w / 30 * RH;
      q.fillStyle = '#6b7a36'; q.fillRect(0, 0, RW, RH);
      for (let i = 0; i < 7; i++) {                    // mowing stripes
        q.fillStyle = i % 2 ? '#77873b' : '#5f6f2c';
        q.fillRect(0, vv(-10.5 + i * 3.5 - 1.7), RW, vw(3.4));
      }
      q.fillStyle = '#8e9a55';                         // edge lines
      q.fillRect(0, vv(12.5 - 0.45), RW, vw(0.9));
      q.fillRect(0, vv(-12.5 - 0.45), RW, vw(0.9));
      q.fillStyle = '#e9e4d6';                         // threshold bars
      for (const tx of [25, -1065]) for (let k = 0; k < 5; k++)
        q.fillRect(u(tx - 4.5), vv(-8 + k * 4 - 0.75), uw(9), vw(1.5));
      q.fillStyle = '#d9d3c0';                         // centre dashes
      for (let i = 0; i < 37; i++)
        q.fillRect(u(5 - i * 29 - 5.5), vv(-0.3), uw(11), vw(0.6));
      const rtex = new THREE.CanvasTexture(cv2);
      rtex.encoding = THREE.sRGBEncoding;
      rtex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1100, 30),
        new THREE.MeshLambertMaterial({ map: rtex, depthWrite: false }));
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(-520, 0.02, 0);
      strip.renderOrder = 2;
      strip.receiveShadow = true;
      scene.add(strip);
    }

    const markGeo = new THREE.BoxGeometry(0.5, 0.7, 1.6);
    const markMat = new THREE.MeshLambertMaterial({ color: C(0xe4dccb) });
    for (let x = 10; x >= -1070; x -= 70) for (const zz of [15.5, -15.5]) {
      const m = new THREE.Mesh(markGeo, markMat);
      m.position.set(x, 0.35, zz); m.castShadow = true; m.receiveShadow = true; scene.add(m);
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
    building(42, 62, 15, 10, 4.4, 0.05);
    building(66, 70, 12, 8.5, 3.9, 0.16);
    building(16, 54, 6.5, 5.5, 2.8, -0.09, trim);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6),
      new THREE.MeshLambertMaterial({ color: C(0xd8d2c4) }));
    pole.position.set(-30, 3, 20); pole.castShadow = true; pole.receiveShadow = true; scene.add(pole);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 2.6, 10, 1, true),
      new THREE.MeshLambertMaterial({ color: C(0xe4622e), side: THREE.DoubleSide }));
    sock.rotation.z = Math.PI / 2; sock.rotation.y = 0.25;
    sock.position.set(-31.6, 5.5, 20); sock.castShadow = true; scene.add(sock);

    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1),
      new THREE.MeshLambertMaterial({ color: C(0x8a7457) }));
    for (let x = 60; x >= -80; x -= 6) {
      const p = fp.clone(); p.position.set(x, 0.55, 26);
      p.castShadow = true; p.receiveShadow = true; scene.add(p);
    }

    // apron + taxiway (kept as decals, but low — the tall stack showed)
    decal(66, 24, 0xa89a80, 0.02, 44, 48);
    decal(15, 40, 0xa89a80, 0.03, 40, 36);
    decal(66, 0.5, 0x8c7f68, 0.04, 44, 36.2);

    const prop = (geo, mat, x, y, z, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry; m.rotation.z = rz;
      m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    };
    const steel = new THREE.MeshLambertMaterial({ color: C(0x8d9299) });
    const rust  = new THREE.MeshLambertMaterial({ color: C(0xb2653a) });
    const wood  = new THREE.MeshLambertMaterial({ color: C(0xa8834f) });
    const straw = new THREE.MeshLambertMaterial({ color: C(0xd7bf7c) });

    const drum = new THREE.CylinderGeometry(0.31, 0.31, 0.9, 12);
    [[28, 44.5], [28.8, 45.4], [29.6, 44.2]].forEach(([x, z], i) =>
      prop(drum, i === 1 ? rust : steel, x, 0.45, z));
    prop(new THREE.CylinderGeometry(0.31, 0.31, 0.9, 12), rust, 30.6, 0.31, 45.6, 0, Math.PI / 2);

    const crate = new THREE.BoxGeometry(1.1, 0.8, 1.1);
    prop(crate, wood, 60, 0.4, 52); prop(crate, wood, 61.2, 0.4, 52.4, 0.4);
    prop(new THREE.BoxGeometry(1.1, 0.7, 1.1), wood, 60.2, 1.15, 52.1, 0.2);

    const bale = new THREE.CylinderGeometry(0.85, 0.85, 1.3, 12);
    [[-40, 92, 0.3], [-35, 95, 1.1], [-46, 97, 2.0], [-30, 90, 0.7]].forEach(([x, z, r]) =>
      prop(bale, straw, x, 0.85, z, r, Math.PI / 2));

    { // windbreak behind the hangars (well clear of the strip)
      const tg = new THREE.ConeGeometry(1.5, 6.2, 7); tg.translate(0, 3.1, 0);
      const tm = new THREE.MeshLambertMaterial({ color: C(0x4a6129) });
      for (let x = 96; x >= 4; x -= 8.5) {
        const t = prop(tg, tm, x + (x % 3) * 0.6, 0, 88 + (x % 5) * 0.7);
        t.scale.setScalar(0.85 + (x % 7) / 9);
      }
    }

    // a working windsock pole gets a guy-line stake; tie-downs on the apron
    const ring = new THREE.TorusGeometry(0.22, 0.05, 6, 10);
    for (const [x, z] of [[36, 44], [50, 44], [43, 52]])
      prop(ring, steel, x, 0.1, z, 0, Math.PI / 2);
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
    for (let k = 0; k < 26; k++) {
      const cx = (rnd() - 0.5) * 8000, cz = (rnd() - 0.5) * 8000;
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

  // per-frame: keep the aircraft AND the spot its shadow falls on inside the
  // sun frustum (grown with hysteresis so the map isn't re-projected every frame)
  let shadowHalf = 0;
  function worldUpdate(cg) {
    const gy = world.terrainH(cg[0], cg[2]);
    const agl = Math.max(0, cg[1] - gy);
    const reach = Math.min(agl / SUN.y, 520);
    const tx = cg[0] - SUN.x * reach * 0.5, tz = cg[2] - SUN.z * reach * 0.5;
    sun.target.position.set(tx, gy, tz);
    sun.position.set(tx + SUN.x * 700, gy + SUN.y * 700, tz + SUN.z * 700);
    const half = Math.max(105, Math.min(540, 105 + reach * 0.55));
    if (Math.abs(half - shadowHalf) > shadowHalf * 0.12 + 4) {
      shadowHalf = half;
      const c = sun.shadow.camera;
      c.left = -half; c.right = half; c.top = half; c.bottom = -half;
      c.updateProjectionMatrix();
    }
    clouds.position.x += 0.05;
  }

  return { worldUpdate, SUN, sun };
}
