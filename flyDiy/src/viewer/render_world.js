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

  { // terrain: geometry from world.terrainH, colour baked to a texture
    const SEG = 256, SIZE = 9000, HALF = SIZE / 2;
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

    const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE),
      new THREE.MeshStandardMaterial({ color: C(0x3a7e96), roughness: 0.16, metalness: 0.0 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.4;
    scene.add(water);
  }

  { // woodland: every physics tree seeds a clump of non-colliding neighbours
    const hsh = (a, b) => { let h = (a * 374761393 + b * 668265263 + 1013904223) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const P = [];
    world.trees.forEach((T, i) => {
      P.push({ x: T.x, z: T.z, h: T.h, s: T.s, r: hsh(i, 7) });
      const n = 2 + (hsh(i, 3) * 3 | 0);
      for (let k = 0; k < n; k++) {
        const a = hsh(i, k * 13 + 1) * 6.283, d = 4 + hsh(i, k * 13 + 2) * 14;
        const x = T.x + Math.cos(a) * d, z = T.z + Math.sin(a) * d;
        if (Math.abs(z) < 90 && x < 200 && x > -3400) continue;  // corridor exclusion, matches world
        const h = world.terrainH(x, z);
        if (h < 1.5 || h > 200) continue;
        P.push({ x, z, h, s: T.s * (0.55 + hsh(i, k * 13 + 3) * 0.7), r: hsh(i, k * 13 + 4) });
      }
    });
    const conif = P.filter(t => t.r < 0.64), broad = P.filter(t => t.r >= 0.64);

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
    const DARK = C(0x3f5628), MID = C(0x5b7333), WARM = C(0x84813c), OLIVE = C(0x6f7d38);
    let ci = 0, bi = 0;
    P.forEach((T, i) => {
      const w = T.r;
      q.setFromAxisAngle(up, w * 6.283);
      pv.set(T.x, T.h - 0.05, T.z);
      sv.set(T.s * (0.86 + w * 0.28), T.s * (0.9 + w * 0.3), T.s * (0.86 + w * 0.28));
      m4.compose(pv, q, sv);
      trunks.setMatrixAt(i, m4);
      if (w < 0.64) {
        c3.copy(DARK).lerp(MID, w * 1.5);
        cMesh.setMatrixAt(ci, m4); cMesh.setColorAt(ci, c3); ci++;
      } else {
        c3.copy(OLIVE).lerp(WARM, (w - 0.64) * 2.6);
        bMesh.setMatrixAt(bi, m4); bMesh.setColorAt(bi, c3); bi++;
      }
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
    decal(1100, 30, 0x6b7a36, 0.05, -520, 0);            // strip (runway x +20 -> -1060)
    for (let i = 0; i < 7; i++)                          // mowing stripes
      decal(1100, 3.4, i % 2 ? 0x77873b : 0x5f6f2c, 0.09, -520, -10.5 + i * 3.5);
    decal(1100, 0.9, 0x8e9a55, 0.13, -520, 12.5);
    decal(1100, 0.9, 0x8e9a55, 0.13, -520, -12.5);
    for (const [tx, sgn] of [[20, 1], [-1060, -1]])      // threshold bars
      for (let k = 0; k < 5; k++)
        decal(9, 1.5, 0xe9e4d6, 0.17, tx + sgn * 5, -8 + k * 4);
    for (let i = 0; i < 37; i++)                         // centre dashes
      decal(11, 0.6, 0xd9d3c0, 0.17, 5 - i * 29, 0);

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

    // apron + taxiway
    decal(66, 24, 0xa89a80, 0.06, 44, 48);
    decal(15, 40, 0xa89a80, 0.07, 40, 36);
    decal(66, 0.5, 0x8c7f68, 0.08, 44, 36.2);

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
