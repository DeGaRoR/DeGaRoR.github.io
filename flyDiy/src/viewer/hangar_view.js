// ============================================================================
// hangar_view.js — THE VIEW OUT OF THE DOOR (G3630-G3639 HANGAR-VIEW; flydiy-notes/HANGAR-VIEW-DESIGN-2026-10.md)
// The user, 25 Oct: "making sure the outside view in the hangar matches the scenery. An idea would be to generate our own
// HDRI from the game. Or to build a simplified scene in front, but accurate."
//
// THE WORLD ITSELF, CAPTURED: the boot builds and settles the world round the stand with the shed on screen (app.js
// 'frames', worldWarmDraw), so the real world is in the renderer before the garage is ever revealed. Six faces of it are
// drawn from the room's centre (the world's own shed and the aeroplane out of the draw) - its sky dome, its clouds, its
// light and exposure: what the world camera shows there - and kept as two atlases (3 x 2 faces):
//   COLOUR    N x N a face, RGBA8, the DISPLAY values (the capture is display-space like aa_resolve's target: tone
//             mapped and encoded per material), drawn back raw - the door shows the world camera's pixels
//   DISTANCE  n x n a face, half float, metres from the centre (the depth buffer resolved on the GPU: no readback)
// and drawn in the room as a sphere mesh whose vertices stand at the captured distance (the vertex shader reads the
// distance atlas): the slab, the strip and the trees take their parallax as the eye orbits. A triangle stretched across a
// depth jump (a tree's edge on the sky) is discarded, and a FAR shell behind it, the same colour at the sky's distance,
// fills the hole. Both are backdrops (no depth test, no depth write, drawn first): everything in the room covers them.
//
//   HANGAR_VIEW.make(THREE, renderer) -> view     { group (into the room's group, the shed frame), capture(o), on(v),
//                                                  ready, stats, dispose() }
//   view.capture(o)  o = { scene, node (the world shed: its matrixWorld is the room's frame), C: [x, y, z] (the room's
//                    centre, shed frame), hide: [objects], sky (the dome), clouds (CLOUDS.draw), faces: [i...] | null
//                    (all six), exposure (the world's raw toneMappingExposure) } -> { faces, ms, done }
//                    a partial call writes STAGING atlases; the sixth face swaps them in (never half a view on screen)
//   HANGAR_VIEW.S    the dials (N by tier, n, far, the jump that breaks the mesh)
// ============================================================================
'use strict';
var HANGAR_VIEW = (() => {
  // THE SIX FACES IN THE SHED'S FRAME (the door at local -x): forward F and up U; three's camera basis x = U x -F
  const FACES = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, -1], [0, -1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0]];
  const S = {
    N: 1024,          // a colour face (the tier's: app.js hangarViewN - potato 768)
    n: 160,           // a distance face
    far: 20000,       // the sky's distance (m), and the capture camera's far
    near: 0.5,
    rows: 192, cols: 256,   // the near mesh: rows dense at the horizon (10 m to infinity sits in ~10 degrees from a 2 m eye)
    jump: 0.5,        // fwidth(log distance) a pixel past which a triangle is a sheet across a depth jump: discarded
    samples: 2,       // the capture's MSAA: the clouds' composite reads the capture's depth (a resolve, never the attachment)
  };
  const GLSL_FACE = `
    uniform vec3 uF[6]; uniform vec3 uU[6]; uniform vec3 uR[6];
    vec2 hvAtlas(vec3 d, float halfTexel) {
      int k = 0; float m = dot(d, uF[0]);
      for (int i = 1; i < 6; i++) { float t = dot(d, uF[i]); if (t > m) { m = t; k = i; } }
      vec2 f = vec2(dot(d, uR[k]), dot(d, uU[k])) / max(m, 1e-4);
      vec2 uv = clamp(f * 0.5 + 0.5, vec2(halfTexel), vec2(1.0 - halfTexel));
      float col = mod(float(k), 3.0), row = floor(float(k) / 3.0 + 0.01);
      return vec2((col + uv.x) / 3.0, (row + uv.y) / 2.0);
    }`;
  const QUAD_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  function make(THREE, renderer) {
    const V3 = () => new THREE.Vector3();
    const basis = FACES.map(f => { const F = new THREE.Vector3(f[0], f[1], f[2]), U = new THREE.Vector3(f[3], f[4], f[5]);
      return { F, U, R: U.clone().cross(F.clone().negate()) }; });
    const maxTex = (renderer.capabilities && renderer.capabilities.maxTextureSize) || 4096;
    const st = { col: null, dist: null, stage: null, N: 0, n: 0, faces: 0, captures: 0, ms: 0, lastMs: 0, C: [0, 2, 0], on: true };

    // ---- THE ROOM'S MESHES (the shed frame; app.js adds `group` to the room's group) -----------------------------
    const faceU = () => ({ uF: { value: basis.map(b => b.F) }, uU: { value: basis.map(b => b.U) }, uR: { value: basis.map(b => b.R) } });
    const viewMat = near => new THREE.ShaderMaterial({
      uniforms: Object.assign(faceU(), { uCol: { value: null }, uDist: { value: null }, uC: { value: V3() }, uFar: { value: S.far },
        uHalf: { value: 0.5 / S.N }, uHalfD: { value: 0.5 / S.n }, uJump: { value: S.jump }, uLin: { value: 0 }, uK: { value: 1 } }),
      defines: near ? { HV_NEAR: '' } : {},
      vertexShader: GLSL_FACE + `
        uniform sampler2D uDist; uniform vec3 uC; uniform float uFar, uHalfD;
        varying vec3 vDir; varying float vL;
        void main() {
          vec3 d = normalize(position);
          #ifdef HV_NEAR
          float D = clamp(texture2D(uDist, hvAtlas(d, uHalfD)).r, 0.5, uFar);
          #else
          float D = uFar;
          #endif
          vDir = d; vL = log(D);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(uC + d * D, 1.0);
          gl_Position.z = 0.5 * gl_Position.w;   // a backdrop: never clipped by the room camera's near / far (no depth test)
        }`,
      fragmentShader: GLSL_FACE + `
        uniform sampler2D uCol; uniform float uHalf, uJump, uLin, uK;
        varying vec3 vDir; varying float vL;
        void main() {
          #ifdef HV_NEAR
          if (fwidth(vL) > uJump) discard;     // a sheet across a depth jump: the far shell shows through
          #endif
          vec3 c = texture2D(uCol, hvAtlas(normalize(vDir), uHalf)).rgb;
          // LINEAR (the room's target is aa_resolve's linear split): the capture's radiance, decoded, scaled by the world's
          // exposure over the room's - the room's ONE tone map in the blit then shows the world camera's pixels.
          // DISPLAY (the display-space target, or the canvas): the capture's display values, raw (no tone map)
          if (uLin > 0.5) { c = pow(c, vec3(2.2)); c = uK * c / max(vec3(1.0) - c, vec3(1.0 / 255.0)); }
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
    // the near mesh: a sphere whose rows crowd the horizon (e = 90 deg x s (0.25 + 0.75 s^2), s uniform in [-1, 1])
    const sphere = (cols, rows, dense) => {
      const p = [], idx = [];
      for (let j = 0; j <= rows; j++) {
        const s = -1 + 2 * j / rows, e = (dense ? s * (0.25 + 0.75 * s * s) : s) * Math.PI / 2, ce = Math.cos(e), se = Math.sin(e);
        for (let i = 0; i <= cols; i++) { const a = 2 * Math.PI * i / cols; p.push(ce * Math.cos(a), se, ce * Math.sin(a)); }
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setIndex(idx);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);   // displaced in the shader: never culled
      return g;
    };
    const group = new THREE.Group(); group.name = 'hangarView';
    const farMesh = new THREE.Mesh(sphere(64, 32, false), viewMat(false)); farMesh.name = 'hangarView:far';
    const nearMesh = new THREE.Mesh(sphere(S.cols, S.rows, true), viewMat(true)); nearMesh.name = 'hangarView:near';
    for (const m of [farMesh, nearMesh]) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; }
    farMesh.renderOrder = -1001; nearMesh.renderOrder = -1000;
    group.add(farMesh, nearMesh); group.visible = false;

    // ---- THE CAPTURE'S PASSES ----------------------------------------------------------------------------------
    const RZ = !!(renderer.capabilities && renderer.capabilities.reversedDepthBuffer);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false;
    const qScene = new THREE.Scene(); qScene.add(quad);
    const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const blitMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: null }, uLin: { value: 0 } }, vertexShader: QUAD_VERT,
      fragmentShader: 'uniform sampler2D uT; uniform float uLin; varying vec2 vUv; void main() { vec3 c = max(texture2D(uT, vUv).rgb, vec3(0.0));' +
        ' if (uLin > 0.5) c = pow(c / (vec3(1.0) + c), vec3(1.0 / 2.2)); gl_FragColor = vec4(c, 1.0); }',
      depthTest: false, depthWrite: false, toneMapped: false });
    // the depth buffer to metres along the ray: reversed float ([0, 1], near at 1: w = f n / ((f - n) d + n)) or the
    // logarithmic buffer (d = log2(1 + w) / log2(far + 1)); the face's 90 degrees take w to the distance
    const distMat = new THREE.ShaderMaterial({ uniforms: { uD: { value: null }, uDZ: { value: new THREE.Vector3(RZ ? 1 : 0, S.near, S.far) } }, vertexShader: QUAD_VERT,
      fragmentShader: `uniform sampler2D uD; uniform vec3 uDZ; varying vec2 vUv;
        void main() {
          float d = texture2D(uD, vUv).r, n = uDZ.y, f = uDZ.z;
          float w = uDZ.x > 0.5 ? f * n / max((f - n) * d + n, 1e-6) : exp2(d * log2(f + 1.0)) - 1.0;
          vec2 q = vUv * 2.0 - 1.0;
          gl_FragColor = vec4(min(w * sqrt(1.0 + dot(q, q)), f), 0.0, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false, toneMapped: false });
    let cap = null, capCam = null, skyScene = null;
    const atlases = (N, n) => ({
      col: new THREE.WebGLRenderTarget(3 * N, 2 * N, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false }),
      dist: new THREE.WebGLRenderTarget(3 * n, 2 * n, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false }),
      done: 0, N, n });
    const capTarget = (N, lin) => {
      if (cap && cap.width === N && cap.userData.lin === lin) return cap;
      if (cap) cap.dispose();
      cap = new THREE.WebGLRenderTarget(N, N, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        generateMipmaps: false, depthBuffer: true, stencilBuffer: true, samples: S.samples,
        depthTexture: new THREE.DepthTexture(N, N, RZ ? THREE.FloatType : THREE.UnsignedInt248Type) });
      cap.depthTexture.format = THREE.DepthStencilFormat; cap.depthTexture.minFilter = cap.depthTexture.magFilter = THREE.NearestFilter;
      cap.resolveStencilBuffer = false;
      // AS THE WORLD'S FRAME IS DRAWN (aa_resolve): DISPLAY-SPACE (W0.5a: the materials tone-map and encode per
      // material.toneMapped, the dome's display values raw) or THE LINEAR SPLIT (G448.3, the presets' 'linear' compositing:
      // radiance, the one tone map in the blit) - the capture holds what the world camera's target holds
      cap.isXRRenderTarget = !lin; cap.texture.colorSpace = lin ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
      cap.userData.lin = lin;
      return cap;
    };
    const region = (rt, k, size) => { const x = (k % 3) * size, y = Math.floor(k / 3) * size; rt.viewport.set(x, y, size, size); rt.scissor.set(x, y, size, size); rt.scissorTest = true; };
    const pass = (mat, rt) => { quad.material = mat; renderer.setRenderTarget(rt); renderer.render(qScene, qCam); rt.scissorTest = false; rt.viewport.set(0, 0, rt.width, rt.height); };
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _F = V3(), _U = V3(), _R = V3(), _C = V3();

    function capture(o) {
      const t0 = performance.now();
      const N = Math.max(128, Math.min(S.N, Math.floor(maxTex / 3))), n = S.n;
      const list = o.faces || [0, 1, 2, 3, 4, 5];
      if (!st.stage || st.stage.N !== N || st.stage.n !== n) { if (st.stage && st.stage !== st.live) disposeSet(st.stage); st.stage = atlases(N, n); }
      const lin = !!o.linear;
      if (st.stage.done && st.stage.lin !== lin) { disposeSet(st.stage); st.stage = atlases(N, n); }   // (a set is one mode)
      st.stage.lin = lin;
      const T = capTarget(N, lin);
      capCam = capCam || new THREE.PerspectiveCamera(90, 1, S.near, S.far);
      if (typeof UI_LAYER !== 'undefined' && UI_LAYER.blind) UI_LAYER.blind(capCam);
      capCam.near = S.near; capCam.far = S.far; capCam.updateProjectionMatrix();
      const node = o.node; node.updateMatrixWorld(true);
      _C.set(o.C[0], o.C[1], o.C[2]).applyMatrix4(node.matrixWorld);
      // the renderer as the world has it, put back after
      const prevT = renderer.getRenderTarget(), ac = renderer.autoClear, sm = renderer.shadowMap.autoUpdate, ex = renderer.toneMappingExposure;
      const cc = new THREE.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha();
      if (o.exposure > 0) renderer.toneMappingExposure = o.exposure;
      const hidden = [];
      for (const h of (o.hide || [])) if (h && h.visible) { h.visible = false; hidden.push(h); }
      const bg = o.scene.background; o.scene.background = null;
      try {
        for (const k of list) {
          const b = basis[k];
          _F.copy(b.F).transformDirection(node.matrixWorld); _U.copy(b.U).transformDirection(node.matrixWorld); _R.copy(b.R).transformDirection(node.matrixWorld);
          _m.makeBasis(_R, _U, _F.negate()); _q.setFromRotationMatrix(_m);
          capCam.position.copy(_C); capCam.quaternion.copy(_q); capCam.updateMatrixWorld(true);
          // the world's shadow maps are NOT redrawn: the world aims its cascades at the stand / the aircraft in its own update,
          // not at the eye, and the maps hold what the last world frame drew there (the boot's warm draw; a return's taxi-in)
          renderer.shadowMap.autoUpdate = false;
          renderer.setRenderTarget(T); renderer.setClearColor(0x000000, 1); renderer.autoClear = false; renderer.clear(true, true, true);
          // THE SKY FIRST, as the water's mirror draws it (water.js G460.11.3): the dome rides the main camera
          if (o.sky) {
            skyScene = skyScene || new THREE.Scene();
            const sky = o.sky, par = sky.parent, vis = sky.visible;
            skyScene.add(sky); sky.position.copy(capCam.position); sky.visible = true;
            renderer.render(skyScene, capCam);
            sky.visible = vis; sky.position.set(0, 0, 0); if (par) par.add(sky); else skyScene.remove(sky);
          }
          // THE CLOUDS: their march for this eye, composited by the scene's own cloud quad at the cloud's depth
          if (o.clouds) { try { o.clouds(renderer, capCam, T); } catch (e) {} }
          renderer.render(o.scene, capCam);
          // the face into the staging atlases: colour as drawn, distance resolved
          blitMat.uniforms.uT.value = T.texture; blitMat.uniforms.uLin.value = lin ? 1 : 0; region(st.stage.col, k, N); pass(blitMat, st.stage.col);
          distMat.uniforms.uD.value = T.depthTexture; distMat.uniforms.uDZ.value.set(RZ ? 1 : 0, S.near, S.far); region(st.stage.dist, k, n); pass(distMat, st.stage.dist);
          st.stage.done |= 1 << k; st.faces++;
        }
      } finally {
        o.scene.background = bg;
        for (const h of hidden) h.visible = true;
        renderer.toneMappingExposure = ex; renderer.setClearColor(cc, ca); renderer.autoClear = ac; renderer.shadowMap.autoUpdate = sm;
        renderer.setRenderTarget(prevT);
      }
      const done = st.stage.done === 63;
      if (done) {   // the set is whole: it goes on screen, the old one goes
        const old = st.live; st.live = st.stage; st.stage = null;
        if (old) disposeSet(old);
        for (const m of [farMesh, nearMesh]) { const U = m.material.uniforms;
          U.uCol.value = st.live.col.texture; U.uDist.value = st.live.dist.texture; U.uC.value.set(o.C[0], o.C[1], o.C[2]);
          U.uHalf.value = 0.5 / st.live.N; U.uHalfD.value = 0.5 / st.live.n; U.uFar.value = S.far; U.uJump.value = S.jump; U.uLin.value = st.live.lin ? 1 : 0; }
        st.C = o.C.slice(); st.captures++; st.live.ex = o.exposure > 0 ? o.exposure : null;
        if (cap) { cap.dispose(); cap = null; }   // the capture target is let go between sets (MSAA + depth at N: ~30 MB at 1024)
        group.visible = st.on;
      }
      st.lastMs = performance.now() - t0; st.ms += st.lastMs;
      return { faces: list.length, ms: st.lastMs, done };
    }
    function disposeSet(s) { if (!s) return; s.col.dispose(); s.dist.dispose(); }
    return {
      group, capture,
      get ready() { return !!st.live; },
      get staging() { return !!(st.stage && st.stage.done); },
      on(v) { st.on = v !== false; group.visible = st.on && !!st.live; return st.on; },
      // the linear set's gain: the world's exposure at the capture over the room's now (app.js, every shed frame - the mood moves it)
      gain(k) { if (k > 0) for (const m of [farMesh, nearMesh]) m.material.uniforms.uK.value = k; return st.live ? st.live.ex : null; },
      get linear() { return !!(st.live && st.live.lin); },
      // what it holds: the sizes, the GPU bytes (colour RGBA8 + distance RGBA16F), the captures and their time
      stats: () => ({ live: !!st.live, N: st.live ? st.live.N : 0, n: st.live ? st.live.n : 0, captures: st.captures, faces: st.faces,
        ms: Math.round(st.ms), lastMs: Math.round(st.lastMs * 10) / 10, C: st.C,
        mb: st.live ? Math.round((6 * st.live.N * st.live.N * 4 + 6 * st.live.n * st.live.n * 8) / 1e5) / 10 : 0 }),
      dispose() { disposeSet(st.live); disposeSet(st.stage); st.live = st.stage = null; if (cap) cap.dispose(); cap = null; group.visible = false; },
      _meshes: { far: farMesh, near: nearMesh },
    };
  }
  return { make, S, FACES };
})();
if (typeof window !== 'undefined') window.HANGAR_VIEW = HANGAR_VIEW;
if (typeof module !== 'undefined' && module.exports) module.exports = HANGAR_VIEW;
