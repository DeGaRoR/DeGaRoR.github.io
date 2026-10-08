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
  // the scene's depth, back to a view-axis distance (clouds.js's convention): uDZ = (1 when the
  // renderer's buffer is REVERSED float - app.js, PERF 2026-09-23 - near, far), else logarithmic
  const DEPTH = `
    uniform sampler2D tDepth; uniform float uLogFar; uniform vec3 uDZ;
    float viewW(vec2 uv) { float d = texture2D(tDepth, uv).r; return uDZ.x > 0.5 ? uDZ.y * uDZ.z / (d * (uDZ.z - uDZ.y) + uDZ.y) : exp2(d * uLogFar) - 1.0; }
    float skyK(float d) { return uDZ.x > 0.5 ? 1.0 - step(1e-30, d) : step(0.9995, d); }   // 1 where the depth is the far plane's`;

  // BLOOM: threshold (soft knee) at half resolution, a 13-tap downsample chain, a 9-tap tent
  // upsample chain, additive onto the canvas (the CoD:AW pyramid, Jimenez 2014)
  // G960 THE GLINTS DO NOT EXPLODE (A2-GLINT, the user: "all landmarks, houses and little towns emit crazy flashes,
  // and I think the bloom effect has them explode"): the first pass is where one hot pixel becomes a flare, so it
  // takes the frame's four pixels (the taps sit on the source's pixel centres: each IS one pixel) through
  //   - a GUARD: a NaN or an Inf (a half-float overflow, a 0/0 in some hook) is black - one of them spread through the
  //     pyramid was a black or white square;
  //   - a CLAMP on the input's luminance (uClamp, the hue kept): what is far over the threshold blooms as a lot, not
  //     as a thousand times the threshold;
  //   - KARIS'S AVERAGE (Karis 2013, the CoD:AW talk's firefly fix): each pixel weighted by 1 / (1 + luma), so a lone
  //     hot pixel among dark ones counts about as much as a pixel of 1 and stays under the threshold, while an area
  //     that is bright as a whole (the sun, a lamp, a lit window up close) averages as itself.
  const BLOOM_THR = `${LUMA} uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr, uKnee, uClamp, uPre; varying vec2 vUv;
    vec3 bSafe(vec3 c) {
      if (any(isnan(c)) || any(isinf(c))) return vec3(0.0);
      c = max(c, vec3(0.0));
      float l = luma(c);
      return l > uClamp ? c * (uClamp / l) : c; }
    void main() {
      // G2620: the frame is x P at night (the pre-exposure): judged in true radiance (/ uPre), handed on x uPre (1 by day: exact)
      vec3 s0 = bSafe(texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb / uPre), s1 = bSafe(texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb / uPre);
      vec3 s2 = bSafe(texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb / uPre), s3 = bSafe(texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb / uPre);
      float w0 = 1.0 / (1.0 + luma(s0)), w1 = 1.0 / (1.0 + luma(s1)), w2 = 1.0 / (1.0 + luma(s2)), w3 = 1.0 / (1.0 + luma(s3));
      vec3 c = (s0 * w0 + s1 * w1 + s2 * w2 + s3 * w3) / (w0 + w1 + w2 + w3);
      float l = luma(c);
      float soft = clamp(l - uThr + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
      float w = max(soft, l - uThr) / max(l, 1e-4);
      gl_FragColor = vec4(c * w * uPre, 1.0); }`;
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
      float sky = skyK(d);
      vec3 c0 = texture2D(tSrc, vUv).rgb;
      if (any(isnan(c0)) || any(isinf(c0))) c0 = vec3(0.0);   // G1355: a half-float overflow (the sun's disc) must not smear a NaN down the blur
      vec3 c = clamp(pfxCurve(max(c0, vec3(0.0))), 0.0, 1.0);
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
  // G960: the glow a third of what it was (the user: "Even the soft bloom is far too bloomy. One fifth or one third
  // of the intensity would feel better"). Measured as the mean display increment over bloom off, the same paused
  // frame, 2216 x 1023, into the sun from 300 m: soft (0.35 -> 0.12) x0.31 at golden hour, x0.36 at noon; strong at
  // 0.2 was x0.45 / x0.40, so 0.16. clamp: the luminance the threshold pass lets in (display values stop at 1).
  const BLOOM = { display: { soft: { thr: 0.82, knee: 0.15, gain: 0.11, clamp: 4 }, strong: { thr: 0.66, knee: 0.25, gain: 0.2, clamp: 4 } },
                  linear:  { soft: { thr: 1.6, knee: 0.6, gain: 0.12, clamp: 16 }, strong: { thr: 0.9, knee: 0.6, gain: 0.16, clamp: 16 } } };
  const LOOKS = {
    punchy: { lift: [0, 0, 0], gain: [1, 1, 1], contrast: 1.14, sat: 1.15 },
    soft:   { lift: [0.015, 0.012, 0.01], gain: [0.985, 0.985, 0.985], contrast: 0.93, sat: 0.96 },
    faded:  { lift: [0.06, 0.055, 0.05], gain: [0.93, 0.93, 0.95], contrast: 0.9, sat: 0.84 },
  };
  const LENS = { vignette: { vig: 0.32, ca: 0 }, 'vignette+aberration': { vig: 0.32, ca: 0.0035 } };
  // G1354 (LIGHT-SMOOTH): the eye's time constants 0.6 / 1.6 s -> 1.5 / 2.0 s (the user: "luminosity adjustments happen
  // all of a sudden"; the brief: every light change over ~1-3 s) - see eye() for the measurement's own exposure
  const EYE_TARGET = 0.40, EYE_STOPS = 1.5, EYE_TAU_UP = 1.5, EYE_TAU_DOWN = 2.0;

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
    M.thr = mat(BLOOM_THR, { tSrc: { value: null }, uTexel: { value: V2() }, uThr: { value: 0.8 }, uKnee: { value: 0.2 }, uClamp: { value: 16 }, uPre: { value: 1 } });
    M.down = mat(BLOOM_DOWN, { tSrc: { value: null }, uTexel: { value: V2() } });
    M.up = mat(BLOOM_UP, { tSrc: { value: null }, uTexel: { value: V2() }, uGain: { value: 1 }, uFinal: { value: 0 } }, { blending: THREE.AdditiveBlending, transparent: true });
    // the glow onto the canvas: SCREEN, the add that cannot clip (the canopy's lesson, G448.2)
    M.upOut = mat(BLOOM_UP, { tSrc: { value: null }, uTexel: { value: V2() }, uGain: { value: 1 }, uFinal: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcColorFactor, transparent: true });
    M.add = mat(ADD, { tSrc: { value: null }, uGain: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } }, { blending: THREE.AdditiveBlending, transparent: true });
    M.look = mat(LOOK, { tSrc: { value: null }, uTexel: { value: V2() }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uContrast: { value: 1 }, uSat: { value: 1 }, uVig: { value: 0 }, uCA: { value: 0 } });
    M.raysMask = mat(RAYS_MASK, { tSrc: { value: null }, tDepth: { value: null }, uLogFar: { value: 1 }, uDZ: { value: new THREE.Vector3() }, uSun: { value: V2() }, uRadius: { value: 0.55 } });
    M.raysBlur = mat(RAYS_BLUR, { tSrc: { value: null }, uSun: { value: V2() }, uDecay: { value: 0.93 }, uLen: { value: 0.9 } });
    M.ao = mat(AO, { tDepth: { value: null }, uLogFar: { value: 1 }, uDZ: { value: new THREE.Vector3() }, uTexel: { value: V2() }, uProj: { value: V2() }, uRadius: { value: 1.2 }, uFrame: { value: 0 } });
    M.aoBlur = mat(AO_BLUR, { tSrc: { value: null }, tDepth: { value: null }, uLogFar: { value: 1 }, uDZ: { value: new THREE.Vector3() }, uTexel: { value: V2() }, uDir: { value: V2() } });
    M.aoApply = mat(AO_APPLY, { tSrc: { value: null }, uPow: { value: 1.0 } }, { blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendEquation: THREE.AddEquation, transparent: true });
    M.eye = mat(EYE, { tSrc: { value: null }, uTexel: { value: V2() } });
    T.eye = target(16, 16, false, true);
    // G1357 the catcher (v2): the copy, the one-pixel decision, the read on a catch; RING mip-mapped half-float slots
    M.catCopy = mat(CAT_COPY, { tSrc: { value: null }, uTexel: { value: V2() } });
    M.catDecide = mat(CAT_DECIDE, { tA: { value: null }, tB: { value: null }, tC: { value: null }, uLod: { value: 6 }, uSpike: { value: CAT.spike }, uSky: { value: CAT.sky } });
    M.catRead = mat(CAT_READ, { tA: { value: null }, tB: { value: null }, tC: { value: null }, uLod: { value: 6 }, uH: { value: CAT.H } });
    for (let k = 0; k < CAT.RING; k++) T['cat' + k] = catTarget();
    T.catQ = target(1, 1, false, false); T.catR = target(CAT.W, CAT.H + 1, false, false);
    cat.ringSeq.fill(-1);
    installed = true;
  }
  let sized = { w: 0, h: 0 };
  function size(rt) {
    const w = rt.width, h = rt.height;
    if (sized.w === w && sized.h === h) return;
    sized = { w, h };
    for (const k in T) if (k !== 'eye' && k.slice(0, 3) !== 'cat') { T[k].dispose(); delete T[k]; }
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
    M.thr.uniforms.uThr.value = P.thr; M.thr.uniforms.uKnee.value = P.knee; M.thr.uniforms.uClamp.value = P.clamp;
    M.thr.uniforms.uPre.value = linear && typeof LIGHT_RIG !== 'undefined' && LIGHT_RIG.P ? LIGHT_RIG.P() : 1;   // G2620
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
    // G1355: the shafts fade out as the sun leaves the frame (SKY_GLARE drops ndc.ok at 1.6 - the shafts were cut there on one frame)
    const edge = Math.max(Math.abs(G.ndc.x), Math.abs(G.ndc.y)), edgeK = 1 - Math.max(0, Math.min(1, (edge - 1.2) / 0.35));
    const vis = edgeK * (G.visible || 0) * ((typeof window !== 'undefined' && window.CLOUDS && window.CLOUDS.sunT && camera) ? Math.max(0, Math.min(1, window.CLOUDS.sunT(camera.position.x, camera.position.y, camera.position.z))) : 1);
    if (vis < 0.02) return;
    const h = tBegin('rays');
    const sx = G.ndc.x * 0.5 + 0.5, sy = G.ndc.y * 0.5 + 0.5;
    M.raysMask.uniforms.tSrc.value = rt.texture; M.raysMask.uniforms.tDepth.value = rt.depthTexture; M.raysMask.uniforms.uLogFar.value = Math.log2(camera.far + 1); dzOf(M.raysMask.uniforms.uDZ.value, camera);
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
  function dzOf(v, camera) { return v.set(renderer && renderer.capabilities && renderer.capabilities.reversedDepthBuffer ? 1 : 0, camera.near, camera.far); }
  function ao(rt, camera) {
    if (!rt.depthTexture) return;
    const h = tBegin('ao');
    const logFar = Math.log2(camera.far + 1);
    const tanH = Math.tan(camera.fov * Math.PI / 360);
    const u = M.ao.uniforms;
    u.tDepth.value = rt.depthTexture; u.uLogFar.value = logFar; dzOf(u.uDZ.value, camera); u.uTexel.value.set(1 / T.ao0.width, 1 / T.ao0.height);
    u.uProj.value.set(tanH * camera.aspect, tanH); u.uFrame.value = (aoFrame++ % 16);
    draw(M.ao, T.ao0);
    const b = M.aoBlur.uniforms;
    b.tDepth.value = rt.depthTexture; b.uLogFar.value = logFar; dzOf(b.uDZ.value, camera); b.uTexel.value.set(1 / T.ao0.width, 1 / T.ao0.height);
    b.tSrc.value = T.ao0.texture; b.uDir.value.set(1, 0); draw(M.aoBlur, T.ao1);
    b.tSrc.value = T.ao1.texture; b.uDir.value.set(0, 1); draw(M.aoBlur, T.ao0);
    renderer.autoClear = false;
    M.aoApply.uniforms.tSrc.value = T.ao0.texture; M.aoApply.uniforms.uPow.value = 1.0;
    draw(M.aoApply, null);
    tEnd(h);
  }
  // THE EYE: a 16x16 mean, read back asynchronously; the loop on the display mean, in stops
  // G1354 THE MEASUREMENT KNOWS ITS EXPOSURE (LIGHT-SMOOTH). The mean comes back a few frames late (async), and the loop
  // used to add the error it implies to the eye AS IT IS NOW: every frame the read was in flight (a GPU busy linking, a
  // stall) integrated the same stale error again - the eye overshot past the target and came back, a swing the user saw
  // as a sudden change. The target is now the exposure the measured frame was drawn with (kAt, eyeKRead) plus that frame's error:
  // a fixed point, however late the read; the ease toward it is unchanged.
  // G1356 THE EYE READ ITS FRAME TWICE ENCODED (LIGHT-SMOOTH; A0's "the scene got too dark"). Under the linear
  // compositing T.eye is a display target: an 8-bit texture tagged sRGB, which three stores as SRGB8_ALPHA8 - so the GPU
  // sRGB-encoded on the store what pfxCurve had already encoded. The mean came back as encode(encode(picture)): measured
  // 0.57 for a frame whose canvas mean was ~0.3, and the loop sat on its -1.5 stop floor (eyeK 0.354: the whole frame x0.35
  // whenever `eye` was on). The bytes are decoded once (the hardware's encode is the standard sRGB curve, exactly
  // inverted by this table), leaving the display values pfxCurve wrote. The display compositing's T.eye is a plain RGBA8.
  const EYE_DEC = (() => { const t = new Float32Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; t[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return t; })();
  // G1357 (EVEN-30's long tasks): the eye's read is a call into the GPU process in Chrome (the fence's poll, the buffer's
  // copy) - one in flight, issued from the frame, and at most every EYE_READ_MS (its loop's time constant is 1.5-2 s:
  // four reads a second lose nothing; a read a frame paid a wait a frame while the GPU process was busy linking)
  const EYE_READ_MS = 250;
  let eyeBusy = false, eyeK = 1, eyeLast = 0, eyeKRead = 1, eyeIssued = -1e9;
  const eyeBuf = (typeof Uint8Array !== 'undefined') ? new Uint8Array(16 * 16 * 4) : null;
  function eye(rt) {
    const tIssue = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (!renderer.readRenderTargetPixelsAsync || eyeBusy || tIssue - eyeIssued < EYE_READ_MS) { tick(); return; }
    eyeIssued = tIssue;
    const h = tBegin('eye');
    M.eye.uniforms.tSrc.value = rt.texture; M.eye.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height);
    draw(M.eye, T.eye);
    tEnd(h);
    eyeBusy = true;
    const kAt = eyeK;   // the eye this frame was drawn with
    const dec = (T.eye.texture.colorSpace === THREE.SRGBColorSpace && T.eye.texture.type === THREE.UnsignedByteType) ? EYE_DEC : null;
    renderer.readRenderTargetPixelsAsync(T.eye, 0, 0, 16, 16, eyeBuf).then(() => {
      let s = 0;
      if (dec) for (let i = 0; i < 256; i++) s += 0.2126 * dec[eyeBuf[i * 4]] + 0.7152 * dec[eyeBuf[i * 4 + 1]] + 0.0722 * dec[eyeBuf[i * 4 + 2]];
      else for (let i = 0; i < 256; i++) s += (0.2126 * eyeBuf[i * 4] + 0.7152 * eyeBuf[i * 4 + 1] + 0.0722 * eyeBuf[i * 4 + 2]) / 255;
      stats.eyeLum = s / 256; eyeKRead = kAt; eyeBusy = false;
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
      let k = Math.log2(eyeKRead) + want;   // G1354: from the exposure the measured frame had
      k = Math.max(-EYE_STOPS, Math.min(EYE_STOPS, k));
      const tau = k > Math.log2(eyeK) ? EYE_TAU_UP : EYE_TAU_DOWN;
      const a = 1 - Math.exp(-dt / tau);
      eyeK = Math.pow(2, Math.log2(eyeK) + (k - Math.log2(eyeK)) * a);
    }
    stats.eyeK = eyeK;
    const G = (typeof window !== 'undefined') ? window.GFX : null;
    if (G && G.setEye) G.setEye(eyeK);
  }

  // ---- THE CATCHER (G1357, LIGHT-SMOOTH for A0, 2026-10-03; v2 2026-10-04: NO READBACK A FRAME) ---------------------
  // The user: "a frame that misses rendering and gives a white or pale blue render" - single frames, not reproduced on
  // the bench (5 865 traced frames). So the user's own flight catches them, into the log "Save log" writes.
  // v1 read a 64 x 36 copy back EVERY frame (readRenderTargetPixelsAsync). EVEN-30 traced ~220 long tasks of 50-96 ms
  // in the user's first 100 s to that read's poll: in Chrome the fence's clientWaitSync and the getBufferSubData after
  // it are SYNCHRONOUS calls into the GPU process, so a read a frame is a wait a frame whenever that process is busy
  // (the links of the first minutes). v2 decides ON THE GPU and reads only what it caught:
  //   - each frame's 64 x 36 copy (the eye's 16 taps a texel, through the renderer's curve: display values; alpha = the
  //     texel is pale sky) goes into one of RING mip-mapped half-float targets - its 1 x 1 mip is the frame's mean colour
  //     and its pale-sky share;
  //   - a ONE-PIXEL decision draw reads the 1 x 1 mips of frames N-2, N-1, N and discards unless N-1 stands apart from
  //     BOTH neighbours (the mean's luma past `spike` the same way against each, or its sky share past `sky` with both
  //     neighbours under half of it); it is drawn inside an occlusion query (ANY_SAMPLES_PASSED_CONSERVATIVE), whose
  //     result Chrome hands back a frame or two later without a call into the GPU process (the recorder's timer queries
  //     are polled the same way);
  //   - only a query that says yes costs a read: frame N-1's copy (and the three means in an extra row) into an 8-bit
  //     target, read back once - a few times a session at most.
  // A catch is a flight-recorder EVENT 'catch': why, the recorder's frame index (join it to the row: draws, CPU split,
  // dt), the mean against its neighbours, the sky share, the exposure base, eyeK, far / near / the eye's height, the
  // clouds' shadow flag and in-cloud density, the hidden terrain quadrants, the post rows, the AA tier, and for the
  // first MAX_SHOTS of a session at least GAP_MS apart the frame's 64 x 36 picture as a JPEG data URL. The header
  // carries summary(): its counts and its own cost (tapUs). What a copy of the scene target cannot see: the bloom, the
  // rays and the glare, drawn onto the canvas after it. Off: localStorage flydiy.rec.catch = '0', or ?rec=0.
  const CAT = { W: 64, H: 36, RING: 8, spike: 0.06, sky: 0.7, MAX_SHOTS: 6, GAP_MS: 5000, MAXQ: 6 };
  const CAT_COPY = `${CURVE} uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      vec3 c = vec3(0.0);
      for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) c += texture2D(tSrc, vUv + uTexel * (vec2(float(x), float(y)) - 1.5)).rgb;
      c = clamp(pfxCurve(c / 16.0), 0.0, 1.0);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor = vec4(c, (c.b > c.r + 0.06 && l > 0.45) ? 1.0 : 0.0); }`;
  // the decision: the three frames' means (their top mips), N-1 judged; discard unless it stands apart from both
  const CAT_DECIDE = `uniform sampler2D tA, tB, tC; uniform float uLod, uSpike, uSky; varying vec2 vUv;
    void main() {
      vec4 a = textureLod(tA, vec2(0.5), uLod), b = textureLod(tB, vec2(0.5), uLod), c = textureLod(tC, vec2(0.5), uLod);
      vec3 W = vec3(0.2126, 0.7152, 0.0722);
      float la = dot(a.rgb, W), lb = dot(b.rgb, W), lc = dot(c.rgb, W), d1 = lb - la, d2 = lb - lc;
      bool spike = abs(d1) > uSpike && abs(d2) > uSpike && (d1 > 0.0) == (d2 > 0.0);
      bool sky = b.a > uSky && max(a.a, c.a) < 0.5 * uSky;
      if (!(spike || sky)) discard;
      gl_FragColor = vec4(1.0); }`;
  // the read on a catch: the frame's copy (rows 0..H-1) and, in row H, the three means (x 0, 1, 2: N-2, N-1, N; alpha the sky share)
  const CAT_READ = `uniform sampler2D tA, tB, tC; uniform float uLod, uH; varying vec2 vUv;
    void main() {
      float row = floor(gl_FragCoord.y), col = floor(gl_FragCoord.x);
      if (row < uH) { gl_FragColor = textureLod(tB, vec2(vUv.x, (row + 0.5) / uH), 0.0); return; }
      vec4 m = col < 0.5 ? textureLod(tA, vec2(0.5), uLod) : col < 1.5 ? textureLod(tB, vec2(0.5), uLod) : textureLod(tC, vec2(0.5), uLod);
      gl_FragColor = col < 2.5 ? m : vec4(0.0); }`;
  const NM = 10;   // a frame's state: f, the exposure base, eyeK, eyeLum, far, near, camY, cloudShadow, inCloudRho, visHidden
  const cat = { on: true, seq: 0, gen: 0, shots: 0, lastShot: -1e9, ringSeq: new Float64Array(CAT.RING).fill(-1), ringM: [], q: [], pool: [], ext: null,
    reading: false, st: { taps: 0, queries: 0, trips: 0, lost: 0, caught: 0, failed: 0, tapUs: 0, tapUsMax: 0, n: 0 } };
  for (let i = 0; i < CAT.RING; i++) cat.ringM.push(new Float64Array(NM));
  const catLod = () => Math.floor(Math.log2(Math.max(CAT.W, CAT.H)));   // the 1 x 1 level of a 64 x 36 chain
  function catTarget() {   // a ring slot: half float (no 8-bit sRGB storage, G1356), display values, mip-mapped
    const t = target(CAT.W, CAT.H, true, true);
    t.texture.generateMipmaps = true; t.texture.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  // the frame's state, as numbers into its ring slot (NaN: unknown)
  function catState(camera, m) {
    const W = (typeof window !== 'undefined') ? window : {}, C = W.CLOUDS, A = W.ATMO, REC = W.FLIGHT_REC;
    const num = v => (typeof v === 'number' ? v : (typeof v === 'boolean' ? (v ? 1 : 0) : NaN));
    m[0] = REC && REC.rec ? REC.rec.frame : NaN;
    m[1] = W.GFX && W.GFX.exposureBase && W.GFX.exposureBase() != null ? W.GFX.exposureBase() : NaN; m[2] = eyeK; m[3] = stats.eyeLum;   // the day's base (x the menu's step x eyeK on screen)
    m[4] = camera ? camera.far : NaN; m[5] = camera ? camera.near : NaN; m[6] = camera ? camera.position.y : NaN;
    m[7] = C ? num(C.shadowOn) : NaN; m[8] = A && A.MIST && A.MIST.cloud ? num(A.MIST.cloud.rho) : NaN;
    m[9] = W.WORLD && W.WORLD.vis ? num(W.WORLD.vis.nHidden) : NaN;
  }
  function catJpeg(px) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    try {
      const cv = document.createElement('canvas'); cv.width = CAT.W; cv.height = CAT.H;
      const g = cv.getContext('2d'), im = g.createImageData(CAT.W, CAT.H);
      for (let y = 0; y < CAT.H; y++) for (let x = 0; x < CAT.W; x++) {   // the read is bottom-up
        const i = ((CAT.H - 1 - y) * CAT.W + x) * 4, o = (y * CAT.W + x) * 4;
        im.data[o] = px[i]; im.data[o + 1] = px[i + 1]; im.data[o + 2] = px[i + 2]; im.data[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return cv.toDataURL('image/jpeg', 0.8);
    } catch (e) { return null; }
  }
  // a query said yes for frame `seq` (ring slots of seq - 1, seq, seq + 1 still holding them): read the copy and the means once
  function catRead(seq) {
    const sA = (seq - 1) % CAT.RING, sB = seq % CAT.RING, sC = (seq + 1) % CAT.RING;
    if (cat.ringSeq[sA] !== seq - 1 || cat.ringSeq[sB] !== seq || cat.ringSeq[sC] !== seq + 1) { cat.st.lost++; return; }   // the ring moved on
    const t = perfNow(), shot = cat.shots < CAT.MAX_SHOTS && t - cat.lastShot >= CAT.GAP_MS && !cat.reading;
    const m = cat.ringM[sB].slice();
    if (!shot) { catEvent(seq, m, null, null); return; }   // over the cap: the numbers alone, no read at all
    cat.shots++; cat.lastShot = t; cat.reading = true;
    const u = M.catRead.uniforms;
    u.tA.value = T['cat' + sA].texture; u.tB.value = T['cat' + sB].texture; u.tC.value = T['cat' + sC].texture; u.uLod.value = catLod(); u.uH.value = CAT.H;
    const prev = renderer.getRenderTarget();
    draw(M.catRead, T.catR);
    renderer.setRenderTarget(prev);
    const buf = new Uint8Array(CAT.W * (CAT.H + 1) * 4), gen = cat.gen;
    renderer.readRenderTargetPixelsAsync(T.catR, 0, 0, CAT.W, CAT.H + 1, buf).then(() => {
      cat.reading = false; if (gen !== cat.gen) return;
      const o = CAT.W * CAT.H * 4, mean = k => (0.2126 * buf[o + k * 4] + 0.7152 * buf[o + k * 4 + 1] + 0.0722 * buf[o + k * 4 + 2]) / 255;
      catEvent(seq, m, { prev: mean(0), mean: mean(1), next: mean(2), sky: buf[o + 7] / 255 }, catJpeg(buf));
    }, () => { cat.reading = false; cat.st.failed++; });
  }
  function catEvent(seq, m, v, jpeg) {
    cat.st.caught++;
    const r4 = x => (x === x && x != null ? Math.round(x * 10000) / 10000 : null);
    const W = (typeof window !== 'undefined') ? window : {}, AA = W.FLYDIY_AA, C = W.CLOUDS;
    const d = { why: !v ? 'caught (over the picture cap: no read)' : (Math.abs(v.mean - v.prev) > CAT.spike && Math.abs(v.mean - v.next) > CAT.spike ? (v.mean > v.prev ? 'bright spike' : 'dark spike') : 'pale sky'),
      f: r4(m[0]), seq, mean: v ? r4(v.mean) : null, prev: v ? r4(v.prev) : null, next: v ? r4(v.next) : null, sky: v ? r4(v.sky) : null,
      exposureBase: r4(m[1]), eyeK: r4(m[2]), eyeLum: r4(m[3]), far: r4(m[4]), near: r4(m[5]), camY: r4(m[6]), cloudShadow: r4(m[7]), inCloudRho: r4(m[8]), visHidden: r4(m[9]),
      cloudsOn: C ? !!C.active : null, post: Object.assign({ passes: stats.passes, linear }, S), aa: AA && AA.tier ? AA.tier() : null, jpeg };
    const R = W.FLIGHT_REC;
    if (R && R.event) R.event('catch', null, d);
  }
  // the queries back (QUERY_RESULT_AVAILABLE in order; Chrome answers from its own copy - no call into the GPU process)
  function catPoll(gl) {
    while (cat.q.length) {
      const h = cat.q[0];
      if (!gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) break;
      const yes = !!gl.getQueryParameter(h.q, gl.QUERY_RESULT);
      cat.q.shift(); cat.pool.push(h.q);
      if (yes && h.gen === cat.gen) { cat.st.trips++; catRead(h.seq); }
    }
  }
  const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // tap(renderer, camera, rt): aa_resolve's tap, once a frame after the post chain (app.js installs it when the recorder is on)
  function tap(r, camera, rt) {
    if (!cat.on || !ready || !rt || !rt.texture) return;
    const gl = renderer.getContext && renderer.getContext();
    if (!gl || typeof gl.createQuery !== 'function') return;
    const t0 = perfNow();
    build();
    cat.st.taps++;
    catPoll(gl);
    const seq = cat.seq++, k = seq % CAT.RING;
    const prevTarget = renderer.getRenderTarget(), ac = renderer.autoClear;
    M.catCopy.uniforms.tSrc.value = rt.texture; M.catCopy.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height);
    draw(M.catCopy, T['cat' + k]);                     // the mips follow when the target is left (three's own rule)
    cat.ringSeq[k] = seq; catState(camera, cat.ringM[k]);
    // judge the frame before this one, against the one before it and this one
    if (seq >= 2 && cat.q.length < CAT.MAXQ && cat.ringSeq[(seq - 2) % CAT.RING] === seq - 2) {
      const u = M.catDecide.uniforms;
      u.tA.value = T['cat' + ((seq - 2) % CAT.RING)].texture; u.tB.value = T['cat' + ((seq - 1) % CAT.RING)].texture; u.tC.value = T['cat' + k].texture;
      u.uLod.value = catLod(); u.uSpike.value = CAT.spike; u.uSky.value = CAT.sky;
      const q = cat.pool.length ? cat.pool.pop() : gl.createQuery();
      renderer.setRenderTarget(T.catQ);
      gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, q);
      quad.material = M.catDecide; renderer.render(fsScene, fsCam);
      gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
      cat.q.push({ q, seq: seq - 1, gen: cat.gen }); cat.st.queries++;
    }
    renderer.autoClear = ac; renderer.setRenderTarget(prevTarget);
    const d = (perfNow() - t0) * 1000; cat.st.tapUs += d; cat.st.n++; if (d > cat.st.tapUsMax) cat.st.tapUsMax = d;
  }
  let catInstalled = false;
  const catcher = {
    CAT, tap, install: () => { catInstalled = true; return tap; },
    get on() { return cat.on; }, set on(v) { cat.on = !!v; },
    summary: () => ({ on: cat.on, taps: cat.st.taps, queries: cat.st.queries, trips: cat.st.trips, lost: cat.st.lost, caught: cat.st.caught, failed: cat.st.failed, shots: cat.shots,
      tapUs: cat.st.n ? +(cat.st.tapUs / cat.st.n).toFixed(1) : null, tapUsMax: +cat.st.tapUsMax.toFixed(1), spike: CAT.spike, sky: CAT.sky }),
  };
  try { if (typeof localStorage !== 'undefined' && localStorage.getItem('flydiy.rec.catch') === '0') cat.on = false; } catch (e) {}

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
  // warmList() (G584): the programs the passes switched on will draw with, for the roll-out's compile step
  // (shader_warm.js) - { m, to }: `to` null is the canvas, 'rt' one of the pyramid's plain targets
  function warmList() {
    if (!ready) return [];
    const out = [], add = (m, canvas) => { if (m) out.push({ m, to: canvas ? null : 'rt' }); };
    if (cat.on && catInstalled) { build(); add(M.catCopy, true); add(M.catDecide); add(M.catRead); }   // G1357: the catcher's three
    if (!active() || !hooked) return out;
    build();
    if (S.look !== 'off' || S.lens !== 'off') add(M.look, true);
    if (S.ao !== 'off') { add(M.ao); add(M.aoBlur); add(M.aoApply, true); }
    if (S.rays !== 'off') { add(M.raysMask); add(M.raysBlur); add(M.add, true); }
    if (S.bloom !== 'off') { add(M.thr); add(M.down); add(M.up); add(M.upOut, true); }
    if (S.eye !== 'off') add(M.eye);
    return out;
  }
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
    installed = false; sized = { w: 0, h: 0 }; cat.gen++; cat.q.length = 0;   // (G1357: a read or query in flight on a disposed target lands nowhere)
  }
  const API = { S, KEYS, BLOOM, stats, catcher, init, apply, set, render, active, warmList, dispose, setLinear, get linear() { return linear; }, get hooked() { return hooked; }, get ready() { return ready; } };
  if (typeof window !== 'undefined') window.POST_FX = API;
  return API;
})();
