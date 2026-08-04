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
  let miniCanvas = null;              // W13 minimap underlay, baked with the outer ring
  let outerTexShared = null;          // W13.2: outer-ring texture, reused by strip patches
  let detailApply = null;             // W13.2: close-range grain hook for patch materials
  const socks = [];                   // every windsock: { pole:[x,y,z], mesh }
  let fillUpdate = () => {};          // W13 woodland fill streamer (set in the tree block)
  let trunkUpdate = () => {};         // trunk chunks on/off by distance (tree block)
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

  { // terrain (24 km domain, W6): two-ring mesh — 17.6 m polys over the
    // home ±4500 so river carves resolve, coarse ~100 m strips out to
    // ±12000 (fog caps visibility ~5 km: the far ring only needs
    // silhouette fidelity). Each ring bakes its own colour map from the
    // shared colorAt(); strips tuck 300 m under the inner rim, 2 m low,
    // so the seam never shows a crack.
    const SIZE = 24000, HALF = 12000, INNER = 4500;
    const hsh = (ix, iz) => { let h = (ix * 374761393 + iz * 668265263 + 1013904223) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    // W8 colour pass: the old DRY band (sandy tan from 90 m up) made the
    // warped uplands read as desert. Uplands now run grass -> olive heath
    // -> dry alpine grass -> rock, with a two-scale vegetation-patch
    // noise breaking the pure altitude banding.
    const MEAD = 0x8d9a54, GRASS = 0x74853c, HEATH = 0x7d8443, ALP = 0x97934f,
          ROCK = 0x857a68, HIGH = 0x6f6a60, SNOW = 0xe9e2d3, SHORE = 0xc9b78c,
          VEGD = 0x5f7034, VEGW = 0xa09a58;
    const vn = (x, z, cell) => {
      const fx = x / cell, fz = z / cell;
      const ix = Math.floor(fx), iz = Math.floor(fz);
      const tx = fx - ix, tz = fz - iz;
      const a = hsh(ix, iz), b = hsh(ix + 1, iz), d = hsh(ix, iz + 1), e2 = hsh(ix + 1, iz + 1);
      return (a * (1 - tx) + b * tx) * (1 - tz) + (d * (1 - tx) + e2 * tx) * tz;
    };
    const c = new THREE.Color(), c2 = new THREE.Color();
    let _h = 0, _low = 0;
    const colorAt = (x, z) => {
      const h = world.terrainH(x, z), e = 16;
      const slope = Math.min(1, Math.hypot(
        world.terrainH(x + e, z) - world.terrainH(x - e, z),
        world.terrainH(x, z + e) - world.terrainH(x, z - e)) / (2 * e) * 1.15);
      _h = h;
      _low = (1 - Math.min(1, Math.max(0, (h - 55) / 90))) * (1 - Math.min(1, slope * 3.2));
      const veg = vn(x + 31, z + 67, 720) * 0.62 + vn(x + 271, z + 113, 190) * 0.38;
      c.setHex(MEAD).lerp(c2.setHex(GRASS), Math.min(1, Math.max(0, (h - 10) / 90)));
      const vegF = 1 - Math.min(1, Math.max(0, (h - 140) / 120));   // patches fade out by ~260 m
      if (vegF > 0) c.lerp(c2.setHex(veg > 0.5 ? VEGW : VEGD), Math.abs(veg - 0.5) * 0.55 * vegF);
      if (h > 95) c.lerp(c2.setHex(HEATH), Math.min(1, (h - 95) / 140) * 0.85);
      if (h > 150) c.lerp(c2.setHex(ALP), Math.min(1, (h - 150) / 110) * (0.45 + veg * 0.35));
      if (h > 235) c.lerp(c2.setHex(ROCK), Math.min(1, (h - 235) / 140));
      if (h > 400) c.lerp(c2.setHex(HIGH), Math.min(1, (h - 400) / 160));
      // W12 strata banding: alternate 22 m beds darken in the rock zone —
      // matches the stage-5 terrace step, so treads/risers read as strata
      if (h > 190) c.lerp(c2.setHex(0x6b6257), (Math.floor(h / 22) % 2) ? 0.16 : 0.04);
      const snowLine = 470 + slope * 250;
      if (h > snowLine) c.lerp(c2.setHex(SNOW), Math.min(1, (h - snowLine) / 90));
      if (h < 6) c.lerp(c2.setHex(SHORE), Math.min(1, (6 - h) / 8) * 0.85);
      c.lerp(c2.setHex(ROCK), Math.max(0, slope - 0.40) * 1.25 * (h > 60 ? 1 : 0.3));
      // stage-2 biome tint + stage-3 road band (wider than the 3.5 m
      // GRAVEL truth so coarse texels catch it)
      const sc = world.surface(x, z);
      if (sc === world.SURFACE.FOREST_FLOOR) c.lerp(c2.setHex(0x51602f), 0.42);
      else if (sc === world.SURFACE.SAND) c.lerp(c2.setHex(0xcfbe8a), 0.80);
      else if (sc === world.SURFACE.SCREE) c.lerp(c2.setHex(0x8f8570), 0.65);
      if (world.roadNet.roadNear(x, z) < 9) c.lerp(c2.setHex(0xa38b5c), 0.7);
    };
    function bakeGround(x0, z0, x1, z1, N, opts) {
      const EXT = x1 - x0;
      const small = document.createElement('canvas'); small.width = small.height = N;
      const sctx = small.getContext('2d'), img = sctx.createImageData(N, N);
      const hG = new Float32Array(N * N), lowG = new Float32Array(N * N);
      const mimg = opts.mini ? sctx.createImageData(N, N) : null;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = x0 + (i + 0.5) / N * EXT, z = z0 + (j + 0.5) / N * EXT;
        colorAt(x, z);
        hG[j * N + i] = _h; lowG[j * N + i] = _low;
        const o = (j * N + i) * 4;
        img.data[o] = c.r * 255; img.data[o+1] = c.g * 255; img.data[o+2] = c.b * 255; img.data[o+3] = 255;
        if (mimg) {                        // W13 minimap: same bake, water made visible
          const wet = world.waterH(x, z) > _h - 0.2;
          mimg.data[o]   = wet ? 0x48 : img.data[o];
          mimg.data[o+1] = wet ? 0x89 : img.data[o+1];
          mimg.data[o+2] = wet ? 0x9e : img.data[o+2];
          mimg.data[o+3] = 255;
        }
      }
      sctx.putImageData(img, 0, 0);
      if (mimg) {                          // rivers/roads are sub-texel at ~62 m/px:
        const mc = document.createElement('canvas'); mc.width = mc.height = N;
        const mg = mc.getContext('2d');
        mg.putImageData(mimg, 0, 0);
        const mx = x => (x - x0) / EXT * N, mzz = z => (z - z0) / EXT * N;
        mg.lineCap = mg.lineJoin = 'round';
        mg.strokeStyle = '#4889a1';
        for (const r of world.hydro.rivers) {
          if (r.w < 10 || r.pts.length < 2) continue;
          mg.lineWidth = Math.max(0.7, r.w / EXT * N);
          mg.beginPath();
          r.pts.forEach((p, k) => k ? mg.lineTo(mx(p[0]), mzz(p[1])) : mg.moveTo(mx(p[0]), mzz(p[1])));
          mg.stroke();
        }
        mg.strokeStyle = '#ab8d5f'; mg.lineWidth = 0.7;
        for (const r of world.roadNet.roads) {
          if (r.pts.length < 2) continue;
          mg.beginPath();
          r.pts.forEach((p, k) => k ? mg.lineTo(mx(p[0]), mzz(p[1])) : mg.moveTo(mx(p[0]), mzz(p[1])));
          mg.stroke();
        }
        miniCanvas = mc;
      }
      const TW = 2048, cv = document.createElement('canvas');
      cv.width = cv.height = TW;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(small, 0, 0, TW, TW);
      const px = x => (x - x0) / EXT * TW, pz = z => (z - z0) / EXT * TW;
      const lowAt = (x, z) => {
        const i = Math.min(N-1, Math.max(0, Math.round((x - x0) / EXT * N - 0.5)));
        const j = Math.min(N-1, Math.max(0, Math.round((z - z0) / EXT * N - 0.5)));
        return lowG[j * N + i];
      };
      const FIELDS = ['#8a9a4e', '#c0aa61', '#b0a05e', '#96764f', '#6d8036',
                      '#9aa855', '#a8ab52', '#7e8f42'];
      const CS = 190;
      for (let fz = z0; fz < z1; fz += CS) for (let fx = x0; fx < x1; fx += CS) {
        const cx = fx + CS / 2, cz = fz + CS / 2;
        const low = lowAt(cx, cz);
        if (low < 0.25) continue;
        const strip = (Math.abs(cz) < 110 && cx < 130 && cx > -1180) ? 0 : 1;
        if (!strip) continue;
        // W13: fields only on genuinely flat ground — the altitude/slope
        // `low` gate still let ~20% grades through and hillsides grew odd
        // terraced patchwork. Corner-sample the patch: > 3.2 m of relief
        // across ~160 m kills it, anything close fades.
        const hC = world.terrainH(cx, cz);
        let rel = 0;
        for (const [ox, oz] of [[-80, -80], [80, -80], [-80, 80], [80, 80]])
          rel = Math.max(rel, Math.abs(world.terrainH(cx + ox, cz + oz) - hC));
        if (rel > 3.2) continue;
        const fA = low * (0.55 + 0.45 * (1 - rel / 3.2));
        const ix = Math.round(fx / CS), iz = Math.round(fz / CS);
        const r1 = hsh(ix, iz), r2 = hsh(ix + 91, iz - 13), r3 = hsh(ix - 7, iz + 51);
        const w = CS * (0.80 + r3 * 0.34), d = CS * (0.72 + r2 * 0.42);
        g.save();
        g.translate(px(cx + (r1 - 0.5) * 40), pz(cz + (r2 - 0.5) * 40));
        g.rotate((r3 - 0.5) * 0.5);
        g.globalAlpha = fA * (0.32 + r2 * 0.34);
        g.fillStyle = FIELDS[(r1 * FIELDS.length) | 0];
        const W2 = w / EXT * TW, D2 = d / EXT * TW;
        g.fillRect(-W2/2, -D2/2, W2, D2);
        if (r3 > 0.55) {                       // ploughed furrows
          g.globalAlpha = fA * 0.14;
          g.fillStyle = '#6f5a3e';
          for (let u = -W2/2; u < W2/2; u += 5) g.fillRect(u, -D2/2, 2, D2);
        }
        g.globalAlpha = fA * 0.30;             // hedgerow
        g.strokeStyle = '#55672f'; g.lineWidth = 1.3;
        g.strokeRect(-W2/2, -D2/2, W2, D2);
        g.restore();
      }
      g.globalAlpha = 1;
      if (opts.grain) { // fine speckle so the ground has texture down low
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
      const t = new THREE.CanvasTexture(cv);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    }
    const tex = bakeGround(-INNER, -INNER, INNER, INNER, 512, { grain: true });
    const outerTex = bakeGround(-HALF, -HALF, HALF, HALF, 512, { mini: true });
    outerTexShared = outerTex;

    const geo = new THREE.PlaneGeometry(2 * INNER, 2 * INNER, 512, 512);
    geo.rotateX(-Math.PI / 2);
    const posA = geo.attributes.position;
    for (let i = 0; i < posA.count; i++)
      posA.setY(i, world.terrainH(posA.getX(i), posA.getZ(i)));
    geo.computeVertexNormals();
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
    // shared close-range grain hook (W13.2): uvScale sets tiles/uv-unit so
    // materials with different uv extents get the same on-ground density
    detailApply = (mat, uvScale) => { mat.onBeforeCompile = sh => {
      sh.uniforms.uDetail = { value: dtex };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDUv;\nvarying float vDist;')
        .replace('#include <project_vertex>',
          '#include <project_vertex>\nvDUv = uv * ' + uvScale.toFixed(1) + ';\nvDist = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>',
          '#include <common>\nuniform sampler2D uDetail;\nvarying vec2 vDUv;\nvarying float vDist;')
        .replace('#include <map_fragment>',
          '#include <map_fragment>\nfloat dF = 1.0 - smoothstep(60.0, 500.0, vDist);\n' +
          'vec3 dC = texture2D(uDetail, vDUv).rgb;\n' +
          'diffuseColor.rgb *= mix(vec3(1.0), dC * 2.08, dF * 0.62);\n' +
          'float dF2 = 1.0 - smoothstep(15.0, 150.0, vDist);\n' +
          'vec3 dC2 = texture2D(uDetail, vDUv * 6.31).rgb;\n' +
          'diffuseColor.rgb *= mix(vec3(1.0), dC2 * 2.08, dF2 * 0.5);');
    }; };
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
          'diffuseColor.rgb *= mix(vec3(1.0), dC * 2.08, dF * 0.62);\n' +
          // W13 second octave: same grain re-sampled ~6x finer, fading in
          // over the last ~150 m — flare-height ground stops looking flat
          'float dF2 = 1.0 - smoothstep(15.0, 150.0, vDist);\n' +
          'vec3 dC2 = texture2D(uDetail, vDUv * 6.31).rgb;\n' +
          'diffuseColor.rgb *= mix(vec3(1.0), dC2 * 2.08, dF2 * 0.5);');
    };
    const ground = new THREE.Mesh(geo, gMat);
    ground.receiveShadow = true;
    scene.add(ground);

    { // outer ring: four coarse strips sharing one full-domain texture
      const oMat = new THREE.MeshLambertMaterial({ map: outerTex });
      const strip = (x0, z0, x1, z1, sx, sz) => {
        const g2 = new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz);
        g2.rotateX(-Math.PI / 2);
        g2.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
        const p = g2.attributes.position, uv = g2.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          p.setY(i, world.terrainH(x, z) - 2);
          uv.setXY(i, (x + HALF) / SIZE, 1 - (z + HALF) / SIZE);
        }
        g2.computeVertexNormals();
        const m = new THREE.Mesh(g2, oMat);
        m.receiveShadow = true;
        scene.add(m);
      };
      const OV = 4200;                  // tuck under the inner rim
      strip(-HALF, -HALF, HALF, -OV, 240, 78);
      strip(-HALF, OV, HALF, HALF, 240, 78);
      strip(-HALF, -OV, -OV, OV, 78, 84);
      strip(OV, -OV, HALF, OV, 78, 84);
    }

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

    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1.9, 5);
    trunkGeo.translate(0, 0.95, 0);
    const coneGeo = new THREE.ConeGeometry(1.7, 5.4, 7);
    coneGeo.translate(0, 3.9, 0);
    const blobGeo = new THREE.IcosahedronGeometry(2.05, 0);
    blobGeo.scale(1, 1.12, 1); blobGeo.translate(0, 3.5, 0);

    // ---- chunking, so the frustum can throw most of the forest away ------
    // three culls an InstancedMesh on its GEOMETRY's bounding sphere, and the
    // geometry is shared between chunks — which is why per-chunk bounds look
    // impossible and the streamed layer below gave up and set
    // frustumCulled = false. The way through: keep instance matrices RELATIVE
    // to their chunk centre, park each chunk mesh AT that centre, and inflate
    // the shared sphere once to a chunk's half-diagonal. Culling is then
    // conservative but correct, per chunk, against the camera AND the sun's
    // shadow camera — which is where most of the saving comes from.
    const CHW = 2048, CHR = CHW * Math.SQRT1_2 + 12;
    const chunkBounds = geo => {
      geo.computeBoundingSphere();
      geo.boundingSphere.center.set(0, 4, 0);
      geo.boundingSphere.radius = CHR;
    };
    [trunkGeo, coneGeo, blobGeo].forEach(chunkBounds);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0),
          pv = new THREE.Vector3(), sv = new THREE.Vector3(), c3 = new THREE.Color();
    const cells = new Map();
    for (const T of P) {
      const cx = Math.floor(T.x / CHW), cz = Math.floor(T.z / CHW);
      const k = cx * 4096 + cz;
      let a = cells.get(k);
      if (!a) cells.set(k, a = { cx, cz, list: [] });
      a.list.push(T);
    }
    const trunkMat = new THREE.MeshLambertMaterial({ color: C(0x584431) });
    const canopyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const trunkChunks = [];                 // distance-culled: see worldUpdate
    // per-species colour ramps (stage 2): spruce, pine, oak, birch, willow
    const SPC = [
      [C(0x2e4620), C(0x486327)],
      [C(0x4c6a2f), C(0x6f8038)],
      [C(0x5b7333), C(0x84813c)],
      [C(0x7c8f3f), C(0xa39f55)],
      [C(0x6d874d), C(0x8fa05e)],
    ];
    for (const cell of cells.values()) {
      const ox = (cell.cx + 0.5) * CHW, oz = (cell.cz + 0.5) * CHW;
      const conif = cell.list.filter(t => t.sp < 2), broad = cell.list.filter(t => t.sp >= 2);
      const mk = (geo, mat, n, shadow) => {
        if (!n) return null;
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.position.set(ox, 0, oz);
        if (shadow) { m.castShadow = true; m.receiveShadow = true; }
        return m;
      };
      const trunks = mk(trunkGeo, trunkMat, cell.list.length, false);
      const cMesh = mk(coneGeo, canopyMat, conif.length, true);
      const bMesh = mk(blobGeo, canopyMat, broad.length, true);
      let ci = 0, bi = 0;
      cell.list.forEach((T, i) => {
        const w = T.r, sp = T.sp;
        q.setFromAxisAngle(up, w * 6.283);
        pv.set(T.x - ox, T.h - 0.05, T.z - oz);        // chunk-local
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
      for (const m of [trunks, cMesh, bMesh]) {
        if (!m) continue;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        scene.add(m);
      }
      // Trunks are 1.9 m tall and 0.4 m wide: past a few hundred metres they
      // are sub-pixel, and they were 45% of every frame's triangles. Chunks
      // switch off by distance — the canopy sits on the ground, so nothing
      // reads as missing.
      trunkChunks.push({ m: trunks, x: ox, z: oz });
    }
    trunkUpdate = cg => {
      const R2 = 900 * 900;
      for (const t of trunkChunks) {
        const dx = t.x - cg[0], dz = t.z - cg[2];
        t.m.visible = dx * dx + dz * dz < R2;
      }
    };

    // ---- W13 dense fill: the collidable set is a 64 m stage-2 grid, so
    // stands render sparse even with the clump layer. This plants
    // render-only canopies on a ~13 m jittered grid wherever the biome
    // classifier says FOREST_FLOOR, streamed in 1024 m chunks around the
    // aircraft (the fog wall at 5.2 km hides the ring edge). Canopies
    // only — no trunks, no shadows, no physics: cheapest possible trees,
    // per the design call that collision only matters at the strips,
    // which keep their exclusion margins here.
    {
      const CH = 1024, NG = 78, SP2 = CH / NG, R_ACT = 5600, R_DROP = 6400;
      const bins = new Map();              // collidable trees in 128 m bins:
      world.trees.forEach((T, i) => {      // prefilter + species inheritance
        const k = Math.floor(T.x / 128) * 4096 + Math.floor(T.z / 128);
        const a = bins.get(k); a ? a.push(i) : bins.set(k, [i]);
      });
      const nearTree = (x, z) => {         // stands always hold a grid tree < 90 m
        const bx = Math.floor(x / 128), bz = Math.floor(z / 128);
        let best = -1, bd = 8100;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const a = bins.get((bx + dx) * 4096 + (bz + dz));
          if (a) for (const ti of a) {
            const T = world.trees[ti];
            const d = (T.x - x) * (T.x - x) + (T.z - z) * (T.z - z);
            if (d < bd) { bd = d; best = ti; }
          }
        }
        return best;
      };
      const ex = world.aerodromes.map(a => ({ x: a.x, z: a.z,
        r2: (a.len / 2 + 70) ** 2 }));
      const coneF = new THREE.ConeGeometry(1.55, 5.0, 5, 1, true);
      coneF.translate(0, 2.75, 0);
      const blobF = new THREE.IcosahedronGeometry(1.9, 0);
      blobF.scale(1, 1.05, 1); blobF.translate(0, 2.3, 0);
      // same trick as the woodland layer: instances are stored relative to the
      // chunk centre and the shared bounding sphere is inflated to a chunk, so
      // three CAN cull these after all (it never could while the matrices held
      // world coordinates against a 2 m shared sphere).
      for (const g of [coneF, blobF]) {
        g.computeBoundingSphere();
        g.boundingSphere.center.set(0, 3, 0);
        g.boundingSphere.radius = CH * Math.SQRT1_2 + 12;
      }
      const matF = new THREE.MeshLambertMaterial({ vertexColors: true });
      const chunks = new Map(), queue = [];
      function gen(cx, cz) {
        const recs = [[], []];             // conifer / broadleaf
        for (let gz = 0; gz < NG; gz++) for (let gx = 0; gx < NG; gx++) {
          const ix = cx * NG + gx, iz = cz * NG + gz;
          if (hsh(ix, iz + 31) < 0.1) continue;
          const x = cx * CH + (gx + 0.5) * SP2 + (hsh(ix + 7, iz) - 0.5) * SP2 * 1.6;
          const z = cz * CH + (gz + 0.5) * SP2 + (hsh(ix, iz + 7) - 0.5) * SP2 * 1.6;
          if (Math.abs(z) < 90 && x < 200 && x > -3400) continue;  // corridor
          const ti = nearTree(x, z);
          if (ti < 0) continue;            // no stand tree near: not forest
          let inEx = false;
          for (const e of ex)
            if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < e.r2) { inEx = true; break; }
          if (inEx) continue;
          const h = world.terrainH(x, z);
          if (h < 1.5) continue;
          if (world.waterH(x, z) > h) continue;
          if (world.surface(x, z) !== world.SURFACE.FOREST_FLOOR) continue;
          const sp = hsh(ix + 3, iz + 5) < 0.88 ? world.trees[ti].sp
                                                : (hsh(ix + 9, iz + 1) * 5) | 0;
          recs[sp < 2 ? 0 : 1].push(x, h, z, sp, hsh(ix + 2, iz + 8));
        }
        const meshes = [];
        recs.forEach((r, broadish) => {
          const n = r.length / 5;
          if (!n) return;
          const m = new THREE.InstancedMesh(broadish ? blobF : coneF, matF, n);
          const ox = (cx + 0.5) * CH, oz = (cz + 0.5) * CH;
          m.position.set(ox, 0, oz);
          for (let i = 0; i < n; i++) {
            const o = i * 5, sp = r[o + 3], w = r[o + 4];
            q.setFromAxisAngle(up, w * 6.283);
            const s = [1.15, 1.0, 1.1, 0.9, 0.85][sp] * (0.62 + w * 0.55);
            pv.set(r[o] - ox, r[o + 1] - 0.05, r[o + 2] - oz);
            sv.set(s, s * (0.9 + w * 0.25), s);
            m4.compose(pv, q, sv);
            m.setMatrixAt(i, m4);
            m.setColorAt(i, c3.copy(SPC[sp][0]).lerp(SPC[sp][1], w * 0.85));
          }
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
          scene.add(m); meshes.push(m);
        });
        return meshes;
      }
      let tick = 0;
      fillUpdate = cg => {
        if (tick++ % 24) return;           // ~0.4 s cadence
        const R = Math.ceil(R_ACT / CH);
        const ccx = Math.floor(cg[0] / CH), ccz = Math.floor(cg[2] / CH);
        for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) {
          const cx = ccx + dx, cz = ccz + dz;
          const mx2 = (cx + 0.5) * CH - cg[0], mz2 = (cz + 0.5) * CH - cg[2];
          if (mx2 * mx2 + mz2 * mz2 > R_ACT * R_ACT) continue;
          if (Math.abs((cx + 0.5) * CH) > 12000 || Math.abs((cz + 0.5) * CH) > 12000) continue;
          const k = cx * 4096 + cz;
          if (!chunks.has(k)) { chunks.set(k, { cx, cz, meshes: null }); queue.push(k); }
        }
        if (queue.length) {                // nearest first; the fog hides the rest
          for (let i = queue.length - 1; i >= 0; i--) {
            const c2 = chunks.get(queue[i]);
            if (!c2 || c2.meshes) queue.splice(i, 1);   // evicted or already built
          }
          const d2 = k => { const c2 = chunks.get(k);
            const ax = (c2.cx + 0.5) * CH - cg[0], az = (c2.cz + 0.5) * CH - cg[2];
            return ax * ax + az * az; };
          queue.sort((a, b) => d2(a) - d2(b));
          // close chunks (fresh spawn / teleport) get a burst; cruise trickles
          let budget = queue.length && d2(queue[0]) < 2500 * 2500 ? 6 : 2;
          while (budget-- > 0 && queue.length) {
            const c2 = chunks.get(queue.shift());
            if (c2) c2.meshes = gen(c2.cx, c2.cz);
          }
        }
        for (const [k, c2] of chunks) {    // evict far chunks
          const ax = (c2.cx + 0.5) * CH - cg[0], az = (c2.cz + 0.5) * CH - cg[2];
          if (ax * ax + az * az < R_DROP * R_DROP) continue;
          if (c2.meshes) for (const m of c2.meshes) {
            scene.remove(m); if (m.dispose) m.dispose();
          }
          chunks.delete(k);
        }
      };
    }
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
    sock.castShadow = true; scene.add(sock);
    socks.push({ pole: [-30, 5.5, 20], mesh: sock });   // W13: wind-driven, see setWindVis

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

  { // stage-3 settlements: instanced houses/barns + bridge decks
    const BL = world.roadNet.buildings;
    if (BL.length) {
      const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
      bodyGeo.translate(0, 0.5, 0);
      const roofGeo = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
      roofGeo.rotateY(Math.PI / 2); roofGeo.rotateZ(Math.PI / 2);   // prism, axis along x
      const bodies = new THREE.InstancedMesh(bodyGeo,
        new THREE.MeshLambertMaterial({ color: 0xffffff }), BL.length);
      const roofs = new THREE.InstancedMesh(roofGeo,
        new THREE.MeshLambertMaterial({ color: 0xffffff }), BL.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
            up = new THREE.Vector3(0, 1, 0), pv = new THREE.Vector3(),
            sv = new THREE.Vector3(), c3 = new THREE.Color();
      const WALLS = [C(0xcbb79a), C(0xd8cbb0), C(0xb9a284), C(0x8a6a4a)];
      const ROOFS = [C(0x9c5f43), C(0x7a5a43), C(0x6d5744)];
      BL.forEach((b, i) => {
        const gy = world.terrainH(b.x, b.z);
        const hsi = ((b.x * 7 + b.z * 13) & 1048575) | 0;
        q.setFromAxisAngle(up, -b.rot);
        pv.set(b.x, gy - 0.15, b.z);
        sv.set(b.w, b.hgt, b.l);
        m4.compose(pv, q, sv);
        bodies.setMatrixAt(i, m4);
        bodies.setColorAt(i, b.kind === 'barn' ? c3.copy(ROOFS[0]).multiplyScalar(1.05) : WALLS[hsi % 4]);
        const rr = b.l * 0.58;
        pv.set(b.x, gy - 0.15 + b.hgt + rr * 0.5 - 0.02, b.z);
        sv.set(b.w * 1.06, rr, rr);
        m4.compose(pv, q, sv);
        roofs.setMatrixAt(i, m4);
        roofs.setColorAt(i, ROOFS[hsi % 3]);
      });
      for (const m of [bodies, roofs]) {
        m.castShadow = true; m.receiveShadow = true;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        scene.add(m);
      }
    }
    const deckMat = new THREE.MeshLambertMaterial({ color: C(0x8a6a4a) });
    for (const r of world.roadNet.roads) {
      if (r.cls !== 'bridge') continue;
      const [a, b] = r.pts;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const y = Math.max(world.terrainH(a[0], a[1]), world.terrainH(b[0], b[1])) + 0.55;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(L + 5, 0.7, 6.5), deckMat);
      deck.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
      deck.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      deck.castShadow = true; deck.receiveShadow = true;
      scene.add(deck);
    }
  }

  { // stage-4 aerodromes: strip decals + windsocks at every field/strip
    const mkTex = kind => {
      const cv2 = document.createElement('canvas'); cv2.width = 512; cv2.height = 64;
      const q = cv2.getContext('2d');
      if (kind === 'paved') {
        q.fillStyle = '#63636a'; q.fillRect(0, 0, 512, 64);
        q.fillStyle = '#e9e4d6';
        for (const u of [10, 496]) for (let k = 0; k < 4; k++) q.fillRect(u, 8 + k * 14, 6, 8);
        q.fillStyle = '#d9d3c0';
        for (let u = 40; u < 470; u += 32) q.fillRect(u, 30, 14, 3);
      } else if (kind === 'grass') {
        q.fillStyle = '#6b7a36'; q.fillRect(0, 0, 512, 64);
        for (let i = 0; i < 6; i++) { q.fillStyle = i % 2 ? '#77873b' : '#5f6f2c'; q.fillRect(0, i * 11, 512, 10); }
        q.fillStyle = '#e9e4d6';
        for (const u of [8, 498]) q.fillRect(u, 12, 5, 40);
      } else {
        q.fillStyle = '#96917e'; q.fillRect(0, 0, 512, 64);
        q.fillStyle = '#c9c2ae';
        for (let u = 16; u < 500; u += 60) { q.fillRect(u, 6, 8, 5); q.fillRect(u, 53, 8, 5); }
      }
      const t = new THREE.CanvasTexture(cv2);
      t.encoding = THREE.sRGBEncoding;
      return t;
    };
    const texes = {};
    const poleMat = new THREE.MeshLambertMaterial({ color: C(0xd8d2c4) });
    const sockMat = new THREE.MeshLambertMaterial({ color: C(0xe4622e), side: THREE.DoubleSide });
    const patchMat = new THREE.MeshLambertMaterial({ map: outerTexShared });
    // patch uvs span the full 24 km domain: 613 tiles ~= the inner ring's
    // on-ground grain density (230 tiles over 9 km)
    if (detailApply) detailApply(patchMat, 613);
    for (const a of world.aerodromes) {
      if (a.kind === 'meadow' || a.id === 'HOME') continue;
      const kind = a.surface === world.SURFACE.PAVED ? 'paved'
        : a.surface === world.SURFACE.GRAVEL ? 'gravel' : 'grass';
      if (!texes[kind]) texes[kind] = mkTex(kind);
      // W13.2 ground patch: every strip outside the inner ring sits on the
      // coarse outer mesh (~100 m polys, tucked 2 m LOW) — the graded
      // bench and its banks exist in terrainH but were unrenderable, so
      // strips read as floating planes and a rolling aircraft sank below
      // the drawn surface. A local fine mesh renders the true grading,
      // edge-blended 2.2 m down so its border tucks under the outer ring
      // exactly like the ring seams do.
      if (Math.abs(a.x) > 3900 || Math.abs(a.z) > 3900) {
        const MARG = 90, RES = 9;
        const LX = a.len + 2 * MARG, WZ = a.wid + 2 * MARG;
        const g2 = new THREE.PlaneGeometry(LX, WZ,
          Math.ceil(LX / RES), Math.ceil(WZ / RES));
        g2.rotateX(-Math.PI / 2);
        g2.rotateY(-a.hdg);
        g2.translate(a.x, 0, a.z);
        const p = g2.attributes.position, uv = g2.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          const u0 = uv.getX(i), v0 = uv.getY(i);
          const edge = Math.min(Math.min(u0, 1 - u0) * LX, Math.min(v0, 1 - v0) * WZ);
          const r = Math.min(1, edge / 60);            // 0 at border, 1 inside 60 m
          p.setY(i, world.terrainH(x, z) - 2.2 * (1 - r) * (1 - r));
          uv.setXY(i, (x + 12000) / 24000, 1 - (z + 12000) / 24000);
        }
        g2.computeVertexNormals();
        const pm = new THREE.Mesh(g2, patchMat);
        pm.receiveShadow = true;
        scene.add(pm);
      }
      // the strip decal is DRAPED (per-vertex terrainH), not a flat plane
      // at a.elev — wheels roll on terrainH, and the two now agree
      const geo = new THREE.PlaneGeometry(a.len, a.wid,
        Math.ceil(a.len / 12), Math.max(2, Math.ceil(a.wid / 8)));
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(-a.hdg);
      geo.translate(a.x, 0, a.z);
      const dp = geo.attributes.position;
      for (let i = 0; i < dp.count; i++)
        dp.setY(i, world.terrainH(dp.getX(i), dp.getZ(i)) + 0.07);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo,
        new THREE.MeshLambertMaterial({ map: texes[kind], depthWrite: false }));
      m.renderOrder = 2;
      m.receiveShadow = true;
      scene.add(m);
      // windsock off the strip edge
      const px2 = a.x - Math.sin(a.hdg) * (a.wid / 2 + 9);
      const pz2 = a.z + Math.cos(a.hdg) * (a.wid / 2 + 9);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6), poleMat);
      pole.position.set(px2, a.elev + 3, pz2); pole.castShadow = true; scene.add(pole);
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 2.6, 10, 1, true), sockMat);
      sock.castShadow = true; scene.add(sock);
      socks.push({ pole: [px2, a.elev + 5.5, pz2], mesh: sock });   // W13 wind-driven
    }
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
    for (let k = 0; k < 64; k++) {
      const cx = (rnd() - 0.5) * 22000, cz = (rnd() - 0.5) * 22000;
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

  // W13: aim every windsock down the wind vector (mouth upwind), sagging
  // as the wind drops; calm socks hang. Called by the viewer on wind change.
  const _sd = new THREE.Vector3(), _su = new THREE.Vector3(0, 1, 0), _sm = new THREE.Vector3();
  function setWindVis(base) {
    const mag = base ? Math.hypot(base[0], base[2]) : 0;
    for (const s of socks) {
      if (mag < 0.3) _sd.set(0.30, -0.92, 0.18).normalize();
      else {
        const sag = 0.85 * Math.max(0, 1 - mag / 8);
        _sd.set(base[0] / mag, 0, base[2] / mag).multiplyScalar(Math.sqrt(1 - sag * sag));
        _sd.y = -sag;
      }
      s.mesh.quaternion.setFromUnitVectors(_su, _sm.set(-_sd.x, -_sd.y, -_sd.z));
      s.mesh.position.set(s.pole[0] + _sd.x * 1.3, s.pole[1] + _sd.y * 1.3, s.pole[2] + _sd.z * 1.3);
    }
  }
  setWindVis(null);

  // per-frame: keep the aircraft AND the spot its shadow falls on inside the
  // sun frustum (grown with hysteresis so the map isn't re-projected every frame)
  let shadowHalf = 0;
  function worldUpdate(cg) {
    fillUpdate(cg);
    trunkUpdate(cg);
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

  return { worldUpdate, SUN, sun, minimap: miniCanvas, setWindVis };
}
