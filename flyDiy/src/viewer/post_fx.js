// post_fx.js - THE SWITCHABLE POST PASSES (POST-FX study, 2026-09-21)
//
// Six effects, each a row of the GRAPHICS menu, EVERY ONE OFF BY DEFAULT in
// every preset: bloom, look (a grade), lens (vignette / chromatic aberration),
// rays (the sun's shafts), ao (a screen-space occlusion), eye (auto-exposure).
// The user's ruling that shaped this file: "all the effects should have on/off
// switches in the graphics menu; let's not take too much risk here, and ensure
// we can perfectly operate as of today when turning the post fx off."
//
// THE CONTRACT WITH THE RESOLVE PASS (aa_resolve.js, untouched by this file):
//   - With every row off, nothing is installed: aa.setPost(null), no target
//     asked for (needRT(false, 'post')), no material made. The frame is the
//     frame of the day before this file existed, to the byte - GATE POSTFX
//     holds it.
//   - With any row on, the pass's POST hook is taken: called after the resolve
//     blit, with the RESOLVED target in hand. Its `.texture` is the frame in
//     DISPLAY SPACE (tone-mapped, sRGB-encoded - the resolve target is an XR
//     target, see aa_resolve.js THE TARGET IS DISPLAY-SPACE) and its
//     `.depthTexture` the scene's depth, logarithmic (log2(1 + w) / log2(far +
//     1), the convention clouds.js reads).
//   - NOTHING HERE DRAWS INTO THE RESOLVE TARGET. A draw into the 8x
//     multisampled target after render() costs a second full resolve (7 ms on
//     the 3080 - HANDOVER G425). Every pass reads rt.texture and writes either
//     its own single-sampled target or the canvas (autoClear off).
//   - No colour management, no tone mapping, no exposure: the passes take the
//     display-space picture and give a display-space picture. A bloom taken
//     off a tone-mapped image is NOT the HDR bloom the S7 ruling refused (that
//     one needs the linear pipeline and the resolve owning colour); it is the
//     cheap, switchable kind, and the study says so. `toneMapped: false` on
//     every material here, like the flare's.
//
// THE EYE (auto-exposure) is the one effect that is not a picture: it reads a
// 16x16 average of the frame back (async, r186 readRenderTargetPixelsAsync -
// never a blocking readPixels) and writes a THIRD factor into the exposure
// contract (GFX.setEye: base x step x eye), bounded to +/-1.5 stops around
// the schedule light_rig.js declares, so the shed's lamp cap and the night
// keep their meaning. eyeK is 1 whenever the row is off.
//
// THE COMPOSITING (G448.3): under the GRAPHICS row `compositing: linear` the
// resolve target holds RADIANCE and the blit runs the one tone map, so what
// this file reads from rt.texture is linear HDR - the bloom's threshold is a
// radiance (the HDR bloom S7 asked for), and every pass that puts picture
// values back on the canvas curves them first with the renderer's own two
// chunks (PFX_LINEAR; the small targets that must hold display values - the
// eye's mean, the rays' mask - are XR targets like the resolve's used to be).
// Under `display` nothing of that is compiled in and the passes are as landed.
//
// Costs: each pass carries a GPU timer (the clouds' pattern) into
// POST_FX.stats; tools/frame_perf.js --probes reads them per configuration.
'use strict';
const POST_FX = (() => {
  const S = { bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off' };
  const KEYS = Object.keys(S);
  let THREE = null, renderer = null, aa = null, gl = null, ready = false, installed = false;
  const stats = { bloomMs: 0, lookMs: 0, raysMs: 0, aoMs: 0, eyeMs: 0, eyeK: 1, eyeLum: 0, passes: 0 };
  const T = {};      // targets, by name
  const M = {};      // materials, by name
  let fsScene = null, fsCam = null, quad = null;
  let hooked = false;

  // ---- the GPU timer: one query round a pass, read back when it lands (clouds.js) ---------
  const timer = { ext: null, pending: [] };
  function tBegin(tag) { if (!timer.ext) return null; const q = gl.createQuery(); gl.beginQuery(timer.ext.TIME_ELAPSED_EXT, q); return { q, tag }; }
  function tEnd(h) { if (!h) return; gl.endQuery(timer.ext.TIME_ELAPSED_EXT); timer.pending.push(h); }
  function tPoll() {
    if (!timer.ext || !timer.pending.length) return;
    const keep = [];
    for (const h of timer.pending) {
      if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) {
        if (!gl.getParameter(timer.ext.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(h.q, gl.QUERY_RESULT) / 1e6; stats[h.tag + 'Ms'] = (stats[h.tag + 'Ms'] || 0) * 0.8 + 0.2 * ms; }
        gl.deleteQuery(h.q);
      } else keep.push(h);
    }
    timer.pending = keep.length > 16 ? keep.slice(-16) : keep;
  }

  // ---- the shaders -------------------------------------------------------------------------
  const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  // CURVE(c): in linear mode the renderer's tone map + encode over a sampled radiance, so the pass
  // works on the picture the viewer sees; a no-op in display mode (the sample is the picture)
  const CURVE = `
    vec3 pfxCurve(vec3 c) {
    #ifdef PFX_LINEAR
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      return gl_FragColor.rgb;
    #else
      return c;
    #endif
    }`;
  const LUMA = `float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`;
  // the log depth, back to a view-axis distance (clouds.js's convention)
  const DEPTH = `
    uniform sampler2D tDepth; uniform float uLogFar;
    float viewW(vec2 uv) { float d = texture2D(tDepth, uv).r; return exp2(d * uLogFar) - 1.0; }`;

  // BLOOM: threshold (soft knee) at half resolution, a 13-tap downsample chain, a 9-tap tent
  // upsample chain, additive onto the canvas (the CoD:AW pyramid, Jimenez 2014)
  const BLOOM_THR = `${LUMA} uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr, uKnee; varying vec2 vUv;
    void main() {
      vec3 c = 0.25 * (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
                     + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb);
      float l = luma(c);
      float soft = clamp(l - uThr + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
      float w = max(soft, l - uThr) / max(l, 1e-4);
      gl_FragColor = vec4(c * w, 1.0); }`;
  const BLOOM_DOWN = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      vec2 t = uTexel;
      vec3 a = texture2D(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb, b = texture2D(tSrc, vUv + t * vec2(0.0, -2.0)).rgb, c = texture2D(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
      vec3 d = texture2D(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb,  e = texture2D(tSrc, vUv).rgb,                       f = texture2D(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
      vec3 g = texture2D(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb,  h = texture2D(tSrc, vUv + t * vec2(0.0, 2.0)).rgb,  i = texture2D(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
      vec3 j = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb, k = texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
      vec3 l = texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb,  m = texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
      vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
      gl_FragColor = vec4(o, 1.0); }`;
  const BLOOM_UP = `${CURVE} uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uGain, uFinal; varying vec2 vUv;
    void main() {
      vec2 t = uTexel;
      vec3 o = texture2D(tSrc, vUv).rgb * 4.0
             + (texture2D(tSrc, vUv + t * vec2(-1.0, 0.0)).rgb + texture2D(tSrc, vUv + t * vec2(1.0, 0.0)).rgb + texture2D(tSrc, vUv + t * vec2(0.0, -1.0)).rgb + texture2D(tSrc, vUv + t * vec2(0.0, 1.0)).rgb) * 2.0
             + texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
      o *= uGain / 16.0;
      if (uFinal > 0.5) o = pfxCurve(o);   // the draw onto the canvas: the glow curved like the picture (linear mode)
      gl_FragColor = vec4(o, 1.0); }`;

  // LOOK + LENS: one pass over the frame - lift / gain / contrast round mid grey / saturation, a
  // vignette and a three-tap chromatic aberration (the taps offset with the radius squared)
  const LOOK = `${LUMA} ${CURVE} uniform sampler2D tSrc; uniform vec2 uTexel; uniform vec3 uLift, uGain; uniform float uContrast, uSat, uVig, uCA; varying vec2 vUv;
    void main() {
      vec2 r = vUv - 0.5; float r2 = dot(r, r);
      vec3 c;
      if (uCA > 0.0) {
        vec2 off = r * r2 * uCA * 4.0;
        c = vec3(texture2D(tSrc, vUv + off).r, texture2D(tSrc, vUv).g, texture2D(tSrc, vUv - off).b);
      } else c = texture2D(tSrc, vUv).rgb;
      c = pfxCurve(c);
      c = c * uGain + uLift;
      c = (c - 0.5) * uContrast + 0.5;
      float l = luma(c); c = mix(vec3(l), c, uSat);
      c *= 1.0 - uVig * smoothstep(0.15, 0.7, r2 * 2.0);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`;

  // RAYS: a half-resolution mask of the bright far pixels round the sun (depth at the far plane =
  // the sky), a 32-tap radial blur toward the sun, additive onto the canvas, dimmed like the flare
  const RAYS_MASK = `${LUMA} ${DEPTH} ${CURVE} uniform sampler2D tSrc; uniform vec2 uSun; uniform float uRadius; varying vec2 vUv;
    void main() {
      float d = texture2D(tDepth, vUv).r;
      float sky = step(0.9995, d);
      vec3 c = pfxCurve(texture2D(tSrc, vUv).rgb);
      float near = 1.0 - smoothstep(0.0, uRadius, distance(vUv, uSun));
      float l = max(luma(c) - 0.55, 0.0) * 2.2;
      gl_FragColor = vec4(c * sky * l * near, 1.0); }`;
  const RAYS_BLUR = `uniform sampler2D tSrc; uniform vec2 uSun; uniform float uDecay, uLen; varying vec2 vUv;
    void main() {
      vec2 d = (uSun - vUv) * uLen / 32.0;
      vec3 acc = vec3(0.0); float w = 1.0, tot = 0.0; vec2 p = vUv;
      for (int i = 0; i < 32; i++) { acc += texture2D(tSrc, p).rgb * w; tot += w; w *= uDecay; p += d; }
      gl_FragColor = vec4(acc / tot, 1.0); }`;
  const ADD = `uniform sampler2D tSrc; uniform float uGain; uniform vec3 uTint; varying vec2 vUv;
    void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uGain * uTint, 1.0); }`;

  // AO: a horizon-based occlusion at half resolution off the depth alone (GTAO-shaped: 4 slices,
  // 2 directions, 8 steps, Jimenez et al. 2016's slice integral), normals from the depth's
  // neighbours, a per-pixel rotation from interleaved-gradient noise, then a depth-aware
  // 5-tap blur in x and in y, and a MULTIPLY onto the canvas masked to the far plane. Applied to
  // the tone-mapped picture, which darkens the lit as much as the ambient - the honest AO lives
  // in the material pass, and the study says so.
  const AO = `${DEPTH} uniform vec2 uTexel, uProj; uniform float uRadius, uFrame; varying vec2 vUv;
    vec3 posAt(vec2 uv) { float w = viewW(uv); return vec3((uv * 2.0 - 1.0) * uProj * w, -w); }
    void main() {
      float w0 = viewW(vUv);
      if (w0 > 4000.0) { gl_FragColor = vec4(1.0); return; }
      vec3 P = posAt(vUv);
      vec3 px = posAt(vUv + vec2(uTexel.x, 0.0)) - P, mx = P - posAt(vUv - vec2(uTexel.x, 0.0));
      vec3 py = posAt(vUv + vec2(0.0, uTexel.y)) - P, my = P - posAt(vUv - vec2(0.0, uTexel.y));
      vec3 dx = abs(px.z) < abs(mx.z) ? px : mx, dy = abs(py.z) < abs(my.z) ? py : my;
      vec3 N = normalize(cross(dx, dy)); if (N.z < 0.0) N = -N;
      vec3 V = normalize(-P);
      // the sample radius on screen: uRadius metres at this distance, clamped to the taps' reach
      float rPix = clamp(uRadius / (w0 * uProj.y) * 0.5, 2.0 * uTexel.y, 0.12);
      float ign = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y + uFrame * 0.0625));
      float vis = 0.0;
      for (int s = 0; s < 4; s++) {
        float phi = (float(s) + ign) * 0.7853981634;
        vec2 dir = vec2(cos(phi), sin(phi));
        vec3 axis = normalize(cross(vec3(dir, 0.0), V));
        vec3 Np = N - axis * dot(N, axis); float npl = length(Np);
        vec3 ortho = normalize(cross(V, axis));   // along the screen direction dir (axis x V points against it)
        float gamma = atan(dot(Np, ortho), dot(Np, V));
        float h[2]; h[0] = -1.0; h[1] = -1.0;
        for (int side = 0; side < 2; side++) {
          float sg = side == 0 ? 1.0 : -1.0;
          float hmax = -1.0;
          for (int i = 1; i <= 8; i++) {
            float t = (float(i) - 0.5 + ign * 0.5) / 8.0;
            vec2 uv = vUv + sg * dir * t * rPix * vec2(uTexel.x / uTexel.y, 1.0);   // isotropic in pixels
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
            vec3 Sp = posAt(uv) - P; float len = length(Sp);
            float fall = clamp(1.0 - len * len / (uRadius * uRadius), 0.0, 1.0);
            float ch = mix(-1.0, dot(Sp, V) / max(len, 1e-4), fall);
            hmax = max(hmax, ch);
          }
          h[side] = hmax;
        }
        float h0 = -acos(clamp(h[1], -1.0, 1.0)), h1 = acos(clamp(h[0], -1.0, 1.0));
        h0 = gamma + max(h0 - gamma, -1.5707963); h1 = gamma + min(h1 - gamma, 1.5707963);
        float a = 0.25 * (-cos(2.0 * h0 - gamma) + cos(gamma) + 2.0 * h0 * sin(gamma))
                + 0.25 * (-cos(2.0 * h1 - gamma) + cos(gamma) + 2.0 * h1 * sin(gamma));
        vis += npl * a;
      }
      gl_FragColor = vec4(vec3(clamp(vis * 0.25, 0.0, 1.0)), 1.0); }`;
  const AO_BLUR = `${DEPTH} uniform sampler2D tSrc; uniform vec2 uTexel, uDir; varying vec2 vUv;
    void main() {
      float w0 = viewW(vUv); float acc = 0.0, tot = 0.0;
      for (int i = -2; i <= 2; i++) {
        vec2 uv = vUv + uDir * uTexel * float(i);
        float w = exp(-abs(viewW(uv) - w0) / (0.02 * w0 + 0.05)) * (1.0 - 0.15 * abs(float(i)));
        acc += texture2D(tSrc, uv).r * w; tot += w; }
      gl_FragColor = vec4(vec3(acc / max(tot, 1e-4)), 1.0); }`;
  const AO_APPLY = `uniform sampler2D tSrc; uniform float uPow; varying vec2 vUv;
    void main() { float ao = texture2D(tSrc, vUv).r; gl_FragColor = vec4(vec3(pow(ao, uPow)), 1.0); }`;

  // EYE: the frame averaged down to 16x16 (linear taps over a 4x4 block each; the mean of the
  // display-space picture is what the eye of a viewer sees), read back asynchronously
  const EYE = `${CURVE} uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      vec3 c = vec3(0.0);
      for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) c += texture2D(tSrc, vUv + uTexel * (vec2(float(x), float(y)) - 1.5)).rgb;
      gl_FragColor = vec4(pfxCurve(c / 16.0), 1.0); }`;

  // ---- presets ------------------------------------------------------------------------------
  // the bloom's numbers per compositing: display thresholds sit on the curve (0..1), linear ones are
  // radiances (white is ~1 / exposure; the sun's disc and a lamp's filament are far above it)
  const BLOOM = { display: { soft: { thr: 0.82, knee: 0.15, gain: 0.32 }, strong: { thr: 0.66, knee: 0.25, gain: 0.7 } },
                  linear:  { soft: { thr: 1.6, knee: 0.6, gain: 0.35 }, strong: { thr: 0.9, knee: 0.6, gain: 0.6 } } };
  const LOOKS = {
    punchy: { lift: [0, 0, 0], gain: [1, 1, 1], contrast: 1.14, sat: 1.15 },
    soft:   { lift: [0.015, 0.012, 0.01], gain: [0.985, 0.985, 0.985], contrast: 0.93, sat: 0.96 },
    faded:  { lift: [0.06, 0.055, 0.05], gain: [0.93, 0.93, 0.95], contrast: 0.9, sat: 0.84 },
  };
  const LENS = { vignette: { vig: 0.32, ca: 0 }, 'vignette+aberration': { vig: 0.32, ca: 0.0035 } };
  const EYE_TARGET = 0.40, EYE_STOPS = 1.5, EYE_TAU_UP = 0.6, EYE_TAU_DOWN = 1.6;

  // ---- the setup --------------------------------------------------------------------------
  let linear = false;    // the compositing (G448.3), set by GFX through setLinear before any material is made
  function mat(frag, uniforms, extra) {
    // toneMapped only matters in linear mode, where the renderer's chunks are compiled in (PFX_LINEAR)
    // and run on a draw to the canvas or to a display (XR) target; the sky-glare rule (no curve of our
    // own) holds either way - the chunks ARE the renderer's
    return new THREE.ShaderMaterial(Object.assign({ uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false,
      toneMapped: linear, defines: linear ? { PFX_LINEAR: 1 } : {} }, extra || {}));
  }
  function target(w, h, half, display) {
    const t = new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false });
    // a target that must hold DISPLAY values in linear mode (the eye's mean, the rays' mask): the XR
    // rule makes the renderer run the chunks into it, as the resolve target did before G448.3
    if (display && linear) { t.isXRRenderTarget = true; t.texture.colorSpace = THREE.SRGBColorSpace; }
    return t;
  }
  function init(T3, R, AA) {
    THREE = T3; renderer = R; aa = AA;
    try {
      gl = renderer.getContext && renderer.getContext();
      ready = !renderer.isWebGPURenderer && !!(gl && THREE.WebGLRenderTarget && THREE.ShaderMaterial && aa && aa.setPost && renderer.capabilities && renderer.capabilities.isWebGL2);
      if (ready) timer.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    } catch (e) { ready = false; }
    return ready;
  }
  function build() {
    if (installed || !ready) return;
    fsScene = new THREE.Scene(); fsScene.name = 'postfx';
    fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false;
    fsScene.add(quad);
    const V2 = () => new THREE.Vector2(1, 1);
    M.thr = mat(BLOOM_THR, { tSrc: { value: null }, uTexel: { value: V2() }, uThr: { value: 0.8 }, uKnee: { value: 0.2 } });
    M.down = mat(BLOOM_DOWN, { tSrc: { value: null }, uTexel: { value: V2() } });
    M.up = mat(BLOOM_UP, { tSrc: { value: null }, uTexel: { value: V2() }, uGain: { value: 1 }, uFinal: { value: 0 } }, { blending: THREE.AdditiveBlending, transparent: true });
    // the glow onto the canvas: SCREEN, the add that cannot clip (the canopy's lesson, G448.2)
    M.upOut = mat(BLOOM_UP, { tSrc: { value: null }, uTexel: { value: V2() }, uGain: { value: 1 }, uFinal: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcColorFactor, transparent: true });
    M.add = mat(ADD, { tSrc: { value: null }, uGain: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } }, { blending: THREE.AdditiveBlending, transparent: true });
    M.look = mat(LOOK, { tSrc: { value: null }, uTexel: { value: V2() }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uContrast: { value: 1 }, uSat: { value: 1 }, uVig: { value: 0 }, uCA: { value: 0 } });
    M.raysMask = mat(RAYS_MASK, { tSrc: { value: null }, tDepth: { value: null }, uLogFar: { value: 1 }, uSun: { value: V2() }, uRadius: { value: 0.55 } });
    M.raysBlur = mat(RAYS_BLUR, { tSrc: { value: null }, uSun: { value: V2() }, uDecay: { value: 0.93 }, uLen: { value: 0.9 } });
    M.ao = mat(AO, { tDepth: { value: null }, uLogFar: { value: 1 }, uTexel: { value: V2() }, uProj: { value: V2() }, uRadius: { value: 1.2 }, uFrame: { value: 0 } });
    M.aoBlur = mat(AO_BLUR, { tSrc: { value: null }, tDepth: { value: null }, uLogFar: { value: 1 }, uTexel: { value: V2() }, uDir: { value: V2() } });
    M.aoApply = mat(AO_APPLY, { tSrc: { value: null }, uPow: { value: 1.0 } }, { blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendEquation: THREE.AddEquation, transparent: true });
    M.eye = mat(EYE, { tSrc: { value: null }, uTexel: { value: V2() } });
    T.eye = target(16, 16, false, true);
    installed = true;
  }
  let sized = { w: 0, h: 0 };
  function size(rt) {
    const w = rt.width, h = rt.height;
    if (sized.w === w && sized.h === h) return;
    sized = { w, h };
    for (const k in T) if (k !== 'eye') { T[k].dispose(); delete T[k]; }
    // the bloom pyramid: 1/2 .. 1/32
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 5; i++) { T['b' + i] = target(bw, bh, true); T['u' + i] = target(bw, bh, true); bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); }
    T.rays0 = target(w >> 1, h >> 1, true, true); T.rays1 = target(w >> 1, h >> 1, true, true);
    T.ao0 = target(w >> 1, h >> 1, false); T.ao1 = target(w >> 1, h >> 1, false);
  }
  function draw(m, to) {
    quad.material = m;
    renderer.setRenderTarget(to);
    renderer.render(fsScene, fsCam);
  }

  // ---- the passes ---------------------------------------------------------------------------
  function bloom(rt) {
    const P = BLOOM[linear ? 'linear' : 'display'][S.bloom]; if (!P) return;
    const h = tBegin('bloom');
    M.thr.uniforms.tSrc.value = rt.texture; M.thr.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height);
    M.thr.uniforms.uThr.value = P.thr; M.thr.uniforms.uKnee.value = P.knee;
    draw(M.thr, T.b0);
    for (let i = 1; i < 5; i++) { M.down.uniforms.tSrc.value = T['b' + (i - 1)].texture; M.down.uniforms.uTexel.value.set(1 / T['b' + (i - 1)].width, 1 / T['b' + (i - 1)].height); draw(M.down, T['b' + i]); }
    // up: the smallest level into the next, additively, each with the tent
    renderer.autoClear = false;
    for (let i = 3; i >= 0; i--) {
      const src = i === 3 ? T.b4 : T['b' + (i + 1)];
      M.up.uniforms.tSrc.value = src.texture; M.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); M.up.uniforms.uGain.value = 1;
      draw(M.up, T['b' + i]);
    }
    M.upOut.uniforms.tSrc.value = T.b0.texture; M.upOut.uniforms.uTexel.value.set(1 / T.b0.width, 1 / T.b0.height); M.upOut.uniforms.uGain.value = P.gain;
    draw(M.upOut, null);
    tEnd(h);
  }
  function look(rt) {
    const L = LOOKS[S.look] || { lift: [0, 0, 0], gain: [1, 1, 1], contrast: 1, sat: 1 }, Z = LENS[S.lens] || { vig: 0, ca: 0 };
    const h = tBegin('look');
    const u = M.look.uniforms;
    u.tSrc.value = rt.texture; u.uTexel.value.set(1 / rt.width, 1 / rt.height);
    u.uLift.value.fromArray(L.lift); u.uGain.value.fromArray(L.gain); u.uContrast.value = L.contrast; u.uSat.value = L.sat;
    u.uVig.value = Z.vig; u.uCA.value = Z.ca;
    renderer.autoClear = false;
    draw(M.look, null);
    tEnd(h);
  }
  function rays(rt, camera) {
    if (!rt.depthTexture) return;
    const G = (typeof window !== 'undefined') ? window.SKY_GLARE : null;
    if (!G || !G.ndc || !G.ndc.ok) return;
    const vis = (G.visible || 0) * ((typeof window !== 'undefined' && window.CLOUDS && window.CLOUDS.sunT && camera) ? Math.max(0, Math.min(1, window.CLOUDS.sunT(camera.position.x, camera.position.y, camera.position.z))) : 1);
    if (vis < 0.02) return;
    const h = tBegin('rays');
    const sx = G.ndc.x * 0.5 + 0.5, sy = G.ndc.y * 0.5 + 0.5;
    M.raysMask.uniforms.tSrc.value = rt.texture; M.raysMask.uniforms.tDepth.value = rt.depthTexture; M.raysMask.uniforms.uLogFar.value = Math.log2(camera.far + 1);
    M.raysMask.uniforms.uSun.value.set(sx, sy);
    draw(M.raysMask, T.rays0);
    M.raysBlur.uniforms.tSrc.value = T.rays0.texture; M.raysBlur.uniforms.uSun.value.set(sx, sy);
    draw(M.raysBlur, T.rays1);
    M.raysBlur.uniforms.tSrc.value = T.rays1.texture;
    draw(M.raysBlur, T.rays0);
    renderer.autoClear = false;
    M.add.uniforms.tSrc.value = T.rays0.texture; M.add.uniforms.uGain.value = 0.55 * vis; M.add.uniforms.uTint.value.setRGB(1, 0.94, 0.85);
    draw(M.add, null);
    tEnd(h);
  }
  let aoFrame = 0;
  function ao(rt, camera) {
    if (!rt.depthTexture) return;
    const h = tBegin('ao');
    const logFar = Math.log2(camera.far + 1);
    const tanH = Math.tan(camera.fov * Math.PI / 360);
    const u = M.ao.uniforms;
    u.tDepth.value = rt.depthTexture; u.uLogFar.value = logFar; u.uTexel.value.set(1 / T.ao0.width, 1 / T.ao0.height);
    u.uProj.value.set(tanH * camera.aspect, tanH); u.uFrame.value = (aoFrame++ % 16);
    draw(M.ao, T.ao0);
    const b = M.aoBlur.uniforms;
    b.tDepth.value = rt.depthTexture; b.uLogFar.value = logFar; b.uTexel.value.set(1 / T.ao0.width, 1 / T.ao0.height);
    b.tSrc.value = T.ao0.texture; b.uDir.value.set(1, 0); draw(M.aoBlur, T.ao1);
    b.tSrc.value = T.ao1.texture; b.uDir.value.set(0, 1); draw(M.aoBlur, T.ao0);
    renderer.autoClear = false;
    M.aoApply.uniforms.tSrc.value = T.ao0.texture; M.aoApply.uniforms.uPow.value = 1.0;
    draw(M.aoApply, null);
    tEnd(h);
  }
  // THE EYE: a 16x16 mean, read back asynchronously; the loop on the display mean, in stops
  let eyeBusy = false, eyeK = 1, eyeLast = 0;
  const eyeBuf = (typeof Uint8Array !== 'undefined') ? new Uint8Array(16 * 16 * 4) : null;
  function eye(rt) {
    if (!renderer.readRenderTargetPixelsAsync || eyeBusy) { tick(); return; }
    const h = tBegin('eye');
    M.eye.uniforms.tSrc.value = rt.texture; M.eye.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height);
    draw(M.eye, T.eye);
    tEnd(h);
    eyeBusy = true;
    renderer.readRenderTargetPixelsAsync(T.eye, 0, 0, 16, 16, eyeBuf).then(() => {
      let s = 0; for (let i = 0; i < 256; i++) s += 0.2126 * eyeBuf[i * 4] + 0.7152 * eyeBuf[i * 4 + 1] + 0.0722 * eyeBuf[i * 4 + 2];
      stats.eyeLum = s / 256 / 255; eyeBusy = false;
    }).catch(() => { eyeBusy = false; });
    tick();
  }
  function tick() {
    const now = performance.now(), dt = eyeLast ? Math.min(0.1, (now - eyeLast) / 1000) : 0; eyeLast = now;
    if (S.eye === 'off') { eyeK = 1; }
    else if (stats.eyeLum > 0) {
      // the mean the eye wants, in stops from the mean it sees (the picture is display-space:
      // a stop of exposure is ~0.45 of the mean's log2 here, so the loop is scaled to it)
      const want = Math.log2(EYE_TARGET / Math.max(0.02, stats.eyeLum)) * 0.45;
      let k = Math.log2(eyeK) + want;
      k = Math.max(-EYE_STOPS, Math.min(EYE_STOPS, k));
      const tau = k > Math.log2(eyeK) ? EYE_TAU_UP : EYE_TAU_DOWN;
      const a = 1 - Math.exp(-dt / tau);
      eyeK = Math.pow(2, Math.log2(eyeK) + (k - Math.log2(eyeK)) * a);
    }
    stats.eyeK = eyeK;
    const G = (typeof window !== 'undefined') ? window.GFX : null;
    if (G && G.setEye) G.setEye(eyeK);
  }

  // ---- the hook ---------------------------------------------------------------------------
  function render(r, camera, rt) {
    if (!ready || !rt) return;
    build(); size(rt);
    tPoll();
    const prevTarget = renderer.getRenderTarget(), ac = renderer.autoClear;
    stats.passes = 0;
    if (S.look !== 'off' || S.lens !== 'off') { look(rt); stats.passes++; }
    if (S.ao !== 'off') { ao(rt, camera); stats.passes++; }
    if (S.rays !== 'off') { rays(rt, camera); stats.passes++; }
    if (S.bloom !== 'off') { bloom(rt); stats.passes++; }
    if (S.eye !== 'off') { eye(rt); stats.passes++; } else if (eyeK !== 1) tick();
    renderer.autoClear = ac;
    renderer.setRenderTarget(prevTarget);
  }
  const active = () => KEYS.some(k => S[k] !== 'off');
  // apply(): the hook installed only while something is on; nothing else touched otherwise
  function apply() {
    if (!aa) return false;
    const on = ready && active();
    if (on && !hooked) { aa.setPost(render); hooked = true; }
    if (!on && hooked) { aa.setPost(null); hooked = false; }
    if (aa.needRT) aa.needRT(on, 'post');
    if (!on && eyeK !== 1) { eyeK = 1; stats.eyeK = 1; const G = (typeof window !== 'undefined') ? window.GFX : null; if (G && G.setEye) G.setEye(1); }
    return on;
  }
  function set(k, v) { if (!(k in S)) return false; S[k] = v; return apply(); }
  // setLinear(on): the compositing changed (G448.3) - every material and target is rebuilt for it
  function setLinear(on) { on = !!on; if (on === linear) return linear; linear = on; dispose(); return linear; }
  function dispose() {
    for (const k in T) { T[k].dispose(); delete T[k]; }
    for (const k in M) { M[k].dispose(); delete M[k]; }
    installed = false; sized = { w: 0, h: 0 };
  }
  const API = { S, KEYS, stats, init, apply, set, render, active, dispose, setLinear, get linear() { return linear; }, get hooked() { return hooked; }, get ready() { return ready; } };
  if (typeof window !== 'undefined') window.POST_FX = API;
  return API;
})();
