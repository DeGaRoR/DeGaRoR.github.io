// ---------------------------------------------------------------------------
// THE RESOLVE PASS (G144) — anti-aliasing, and the banding that came with it
// ---------------------------------------------------------------------------
// The user, on a hangar frame: "anti-aliasing? I think there's a lot of it".
// Seven places circled. Six were the same defect and the seventh was not, and
// only measuring told them apart.
//
// WHAT WAS ACTUALLY WRONG, MEASURED on the live page (2026-09-01):
//
//   `antialias: true` on this card gives FOUR MSAA samples. Four samples is
//   five coverage levels — 0, 25, 50, 75, 100% — and nothing between. On a
//   STEEP edge five levels is plenty. On a SHALLOW one it is a staircase: a
//   1:30 edge measured 7-pixel-long treads with a 64/255 jump between them.
//   Every circle but one was a shallow, high-contrast edge — the canopy sill,
//   the wing trailing edge, a gear brace white against its own shadow.
//
//   `devicePixelRatio` is 1 here, so the old `min(dpr, 1.75)` cap in app.js
//   was inert and the whole frame was rendered at one device pixel per CSS
//   pixel. There was no supersampling to lose; there was none.
//
// THE SEVENTH CIRCLE HAD NO EDGE IN IT. It was the brown fuselage flank, and
// it is BANDING, not aliasing: measured 97-, 81- and 67-pixel flat plateaus
// down the flank, 83% of the ramp sitting in runs of 4 px or more. A mid-tone
// saturated hue lands on a shallow stretch of the sRGB curve under the ACES
// shoulder, one channel carries nearly all the variation, and there is nothing
// left to break up the steps. Supersampling CANNOT fix that — it averages
// samples that have already been quantised to the same code. Dither can, and
// dither costs one line of the pass that was being written anyway. That is why
// anti-aliasing and dithering live in one file: they are one pass.
//
// WHAT THIS DOES, then, is take the main render off the default framebuffer:
//
//   scene -> multisampled HALF-FLOAT LINEAR target -> one fullscreen pass
//            (tent downsample, ACES, sRGB, dither) -> the canvas
//
// FOUR THINGS THIS BUYS that the default framebuffer cannot:
//
//   EIGHT SAMPLES INSTEAD OF FOUR. MAX_SAMPLES is 8 here but `antialias: true`
//   only ever handed out 4, and there is no way to ask the default framebuffer
//   for more. Measured: the jump per tread halves, 64 -> 32, and MSAA shades
//   ONCE PER FRAGMENT however many samples it takes — so this costs coverage
//   and bandwidth and NO extra shading. It is the cheapest thing here by a
//   wide margin, and the first draft of this work wrongly dismissed it.
//
//   A DOWNSAMPLE FILTER WE OWN. Raising `setPixelRatio` instead would have
//   left the filtering to the browser's compositor, and measured through two
//   different filters the SAME 1.25x buffer scored 53 levels or 172 depending
//   only on the filter. That is not a thing to leave to chance across machines.
//
//   FILTERING IN LINEAR LIGHT. The default framebuffer resolves MSAA over
//   values that have ALREADY been sRGB-encoded, which is wrong and darkens
//   edge pixels slightly. Here the filter runs before the transfer curve.
//
//   SOMEWHERE TO PUT THE DITHER. See the seventh circle, above.
//
// THE TARGET IS DISPLAY-SPACE, LIKE THE CANVAS — AND ON r186 THAT TAKES ONE
// FLAG (W0.5a, 2026-09-13). The arrangement this pass was written around:
//
//   r128 took the OUTPUT ENCODING from the target's texture and TONE MAPPING
//   from the renderer, so a target flagged sRGB received values that were
//   already tone-mapped and already encoded, this pass never touched colour,
//   and the blend unit composited in display space exactly as on the canvas.
//
//   Since r152/r155 an ordinary render target is written LINEAR and
//   UN-tone-mapped whatever its texture says (WebGLPrograms: toneMapping and
//   outputColorSpace come from the renderer only for the canvas). The first
//   r186 cut of this file followed that rule — linear target, three's
//   `tonemapping_fragment` + `colorspace_fragment` in the resolve shader — and
//   the very first frame showed why the old arrangement was not a taste: the
//   sky dome, a raw ShaderMaterial that writes DISPLAY values and relies on
//   never being tone-mapped, came out washed out under an ACES it was never
//   tuned for, and every `toneMapped: false` material in the game (the UI
//   colours, the impostor bake, the instrument faces) would have lost that
//   opt-out, because a post-process tone map cannot see it.
//
//   three itself has the same requirement for its WebXR layers, and the
//   renderer carries the rule for it: a target with `isXRRenderTarget` is
//   treated LIKE THE CANVAS — tone mapping per material.toneMapped, output
//   colour space from the target's own texture, unlit colours converted the
//   same way, and the storage kept linear-format so the SHADER does the
//   encoding (WebGLPrograms 181/213, UniformsUtils 140, WebGLTextures 2120,
//   WebGLRenderer 2378). That is r128's behaviour, to the line, and it is
//   the one flag set on the target below. It is a documented renderer rule,
//   not a private field; if a three bump ever drops it, GATE AA says so.
//
// ALPHA BLENDING HAPPENS IN WHATEVER SPACE THE TARGET IS IN. The blend unit is
// hardware; it mixes whatever the fragment shader wrote. Render into a LINEAR
// target and every transparent material in the game silently re-composites in
// linear light. MEASURED, a 50%-alpha white quad over five backgrounds, with an
// opaque control in the same frame:
//
//     background linear   0.02   0.05   0.12   0.25   0.50
//     delta, blended      +68    +56    +37    +18    +4     codes
//     delta, OPAQUE         0      0      0      0     0
//
// Opaque pixels were EXACT — zero, not "near zero" — which is what proved the
// tone curve was right and that this was blending and nothing else. But +68
// codes on a bright layer over a dark one is not a subtlety: the user caught it
// within a minute on the EDITOR'S SELECTION HIGHLIGHT, a bright cyan at partial
// alpha over the aeroplane, which stopped being a soft wash and became an
// almost opaque slab. The glazing, tuned by pixel bisection, was next in line.
//
// Linear blending is the physically correct one. It is NOT this file's to
// impose: the whole look of the game — 29 transparent materials, every editor
// overlay, the x-ray, the glazing — was judged by eye against gamma-space
// compositing, and a pass whose job is smoother EDGES has no business
// re-grading all of it as a side effect. So the target is display-space, the
// pass keeps tone mapping OFF ITS OWN HANDS entirely — no second copy of ACES,
// no transfer curve, nothing that could drift from the renderer on a three
// bump — and the one implementation of each stays in the renderer.
//
// THE TARGET IS STILL HALF FLOAT, though it holds display-space values.
// Encoding decides the SPACE, type decides the PRECISION, and they are
// independent: an 8-bit target would quantise to 256 levels BEFORE the filter
// and the dither could act, which would hand back the very banding the dither
// exists to remove.
//
// WHAT THIS COSTS, stated plainly: the downsample filter averages encoded
// values rather than linear ones, which is the mathematically worse of the two.
// It is also precisely what the default framebuffer's MSAA resolve has always
// done, so it is not a regression — it is the status quo, kept on purpose.
//
// The gate is GATE AA in tools/run_gates.js.
(function () {
  'use strict';

  // THE TIERS, declared. `ss` is the supersample ratio and `samples` the MSAA
  // count asked of the card; both are measured picks, not taste:
  //
  //   2.0x IS ABSENT ON PURPOSE. It measured WORSE than 1.25x through every
  //   filter tried (11 levels against 172), because an exact 2:1 ratio is a
  //   degenerate resample: each output pixel averages a 2x2 block drawn from
  //   only five possible values and lands straight back on a coarse set. It
  //   also costs 44% more fill than 1.25x. More is not better here.
  const AA_TIERS = {
    off:   { ss: 1,    samples: 0, label: 'Off (4x MSAA)',
             why: 'the default framebuffer, as it was before G144' },
    msaa:  { ss: 1,    samples: 8, label: 'Smooth (8x MSAA)',
             why: 'halves the staircase for no extra shading at all' },
    full:  { ss: 1.25, samples: 8, label: 'Smoothest (8x MSAA + 1.25x)',
             why: 'measured tread 7px -> 1px, jump 64 -> 3' },
  };
  // THE DEFAULT IS `msaa` — the user's second ruling (2026-09-01, "the best is
  // smooth... only setup the option by default if the outline works
  // perfectly"), and the condition was MET before the default moved:
  //
  //   The first build defaulted to `full` and broke the silhouette highlight
  //   inside a minute: the target had NO STENCIL BUFFER (r128 render targets
  //   default `stencilBuffer: false`), the G131 silhouette is drawn WITH the
  //   stencil, so its mask stamped nothing and the shell flooded the part
  //   solid. The user's first ruling parked the whole pass at `off`.
  //
  //   With `stencilBuffer: true` on the target, all four highlight modes AND
  //   hover were measured through the pass against `off` on the live page:
  //   flat-pixel mean under 0.07 codes, the silhouette rim pixel-equivalent
  //   (9400 vs 9422 rim px), the glazing region at 0.48 codes mean, and only
  //   24 px in a 1.8M-px frame past 20 codes — every one an isolated specular
  //   glint that 8 samples resolve and 4 miss, i.e. the AA doing its job.
  //   Sharpness is not traded: |Laplacian| 5.43 vs 5.48 on fine texture and
  //   1-px line amplitude IDENTICAL (193.5), because `msaa` resolves at 1:1
  //   and never resamples.
  //
  // ...AND THEN TO `full` (G144.2, the user: "update defaults to smoothest").
  // The blur numbers above were measured against the TENT kernel the user
  // originally judged; the shipped kernel is Catmull-Rom, which restores most
  // of the edge contrast the tent lost, and the user's third ruling picks it.
  // The measured cost that remains (~27% |Laplacian| on fine texture, line
  // amplitude 138 vs 193.5) is the 1.25x resample itself and stays written
  // here so the trade is a known one, not a forgotten one. `smooth` remains
  // one press away on either screen.
  //
  // The pref key is aa2, not aa: the first build persisted `full` under
  // `flydiy.aa`, and honouring that stored value would have re-broken the
  // very session that reported the bug.
  const AA_DEF = 'full';
  const AA_PREF = 'flydiy.aa2';

  // ---- the resolve shader ------------------------------------------------
  // THERE IS NO COLOUR MATH HERE, and that is the point. The target is already
  // tone-mapped and already sRGB-encoded (see the header), so this pass filters
  // display-space values and writes them out. No ACES, no transfer curve, no
  // exposure: one implementation of each of those exists in the project, in the
  // renderer, and this file is not a second one.
  const AA_COMMON = `
    uniform sampler2D tSrc;
    uniform vec2  uTexel;
    uniform float uR;
    uniform float uDither;
    varying vec2 vUv;
    // A TRIANGULAR-PDF dither, +/-1 LSB, applied in DISPLAY space — after the
    // transfer curve, because the quantisation it hides is the 8-bit write and
    // not anything upstream of it. Two hashes, not one: a single uniform hash
    // is a rectangular PDF, which leaves the step edges correlated and reads
    // as a texture rather than as grain.
    vec3 aaDither(vec3 c) {
      float n1 = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      float n2 = fract(sin(dot(gl_FragCoord.xy + vec2(7.3, 1.7), vec2(12.9898, 78.233))) * 43758.5453);
      return c + uDither * (n1 + n2 - 1.0) / 255.0;
    }`;

  const AA_VS = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  // ONE TAP, for the tiers that do not supersample. At ss = 1 the output grid
  // and the source grid are the same grid, so any kernel wider than a tap is
  // just a blur — and a 5x5 loop with 24 zero weights is 24 fetches wasted.
  // THE ONE TONE MAP (G448.3, the linear split): with the target LINEAR the
  // renderer's own two chunks run here, once, over background + reflection +
  // cloud summed in radiance - nothing of this file's own (GATE AA reads the
  // includes and no other colour math). In display mode the chunks are absent.
  const AA_OUT = `
    #ifdef AA_LINEAR
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    #endif
      gl_FragColor.rgb = aaDither(gl_FragColor.rgb);`;
  const AA_FS_BLIT = AA_COMMON + `
    void main() {
      gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0);` + AA_OUT + `
    }`;

  // CATMULL-ROM, NOT A TENT. The first kernel here was a tent of radius `uR`,
  // and the user's verdict on it was immediate and right: "smoothest tends to
  // add too much blur to everything". A tent is all positive lobes — it can
  // only average, so every 1-px line (the CG/NP annotations, panel lines, the
  // silhouette rim) loses contrast it never gets back. Catmull-Rom carries
  // NEGATIVE side lobes: the same resample, but the overshoot on either side
  // of an edge restores the local contrast the averaging took. It is the
  // standard resampling answer to exactly this complaint.
  //
  // `d / uR` scales the kernel to the output pixel's footprint in source
  // texels, so support is 2*uR — at ss 1.25 that is 2.5 texels and the 5x5
  // loop covers it exactly. Weights are computed per-axis (separable) and the
  // sum normalised; the negative lobes can push a pixel outside [0,1], and the
  // clamp is the price of the sharpness.
  const AA_FS_TENT = AA_COMMON + `
    float crw(float t) {
      t = abs(t);
      if (t <= 1.0) return 1.5*t*t*t - 2.5*t*t + 1.0;
      if (t <= 2.0) return -0.5*t*t*t + 2.5*t*t - 4.0*t + 2.0;
      return 0.0;
    }
    void main() {
      vec4 acc = vec4(0.0);
      float wsum = 0.0;
      for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
          vec2 o = vec2(float(i), float(j));
          float w = crw(o.x / uR) * crw(o.y / uR);
          acc += texture2D(tSrc, vUv + o * uTexel) * w;
          wsum += w;
        }
      }
      vec3 col = max(acc.rgb / wsum, 0.0);   // the negative lobes clamp at 0; the top is the tone map's in linear mode, 1.0 in display mode
      #ifndef AA_LINEAR
        col = min(col, 1.0);
      #endif
      gl_FragColor = vec4(col, 1.0);` + AA_OUT + `
    }`;

  // THE RENDER SCALE'S UPSAMPLE (PERF 2026-09-23): below 1x the scene is drawn into a smaller target and
  // this pass enlarges it - a bicubic Catmull-Rom over the 4x4 SOURCE texels round the output pixel (the
  // tent above is a downsample and would blur an enlargement). The frame is fill-bound at the resolutions
  // the game is played at (1080p 16-23 ms, 5120x1440 38-50 ms on the 3080 at the default preset), and this
  // is the lever that holds a frame rate on a big or a slow screen.
  const AA_FS_UP = AA_COMMON + `
    float crw(float t) {
      t = abs(t);
      if (t <= 1.0) return 1.5*t*t*t - 2.5*t*t + 1.0;
      if (t <= 2.0) return -0.5*t*t*t + 2.5*t*t - 4.0*t + 2.0;
      return 0.0;
    }
    void main() {
      vec2 p = vUv / uTexel - 0.5, i = floor(p), f = p - i;
      vec4 acc = vec4(0.0); float wsum = 0.0;
      for (int y = -1; y <= 2; y++) for (int x = -1; x <= 2; x++) {
        float w = crw(float(x) - f.x) * crw(float(y) - f.y);
        acc += texture2D(tSrc, (i + vec2(float(x), float(y)) + 0.5) * uTexel) * w; wsum += w;
      }
      vec3 col = max(acc.rgb / wsum, 0.0);
      #ifndef AA_LINEAR
        col = min(col, 1.0);
      #endif
      gl_FragColor = vec4(col, 1.0);` + AA_OUT + `
    }`;

  // THE AUTO SCALE'S DECISION (G528), pure: the state A (i: the step, probe / up: a step on trial, the holds), the median
  // frame f and the scene's GPU time g (null without the timer), the clock t (ms) -> the step to take. tools/test_aa.js
  // drives it with simulated frames: a CPU-bound frame must end where it started, a GPU-bound one must come down.
  function aaAutoDecide(A, f, g, t) {
    const T = A.T, ST = A.steps;
    if (A.probe) {                         // a step down was taken: did the pixels pay?
      const p = A.probe; A.probe = null;
      if (f > T * 1.05 && f > p.f * 0.95) {
        A.reverts++; A.stats.reverts++;
        A.holdDown = t + Math.min(300000, 30000 * Math.pow(2, A.reverts - 1));
        return A.i - 1;
      }
      A.reverts = 0; return A.i;
    }
    if (A.up) { A.up = null; if (f > T * 1.08) { A.holdUp = t + 60000; return A.i + 1; } return A.i; }
    if (f > T * 1.08 && A.i < ST.length - 1 && t > A.holdDown && t - A.since > 2000) { A.probe = { f }; return A.i + 1; }
    if (f <= T * 1.05 && A.i > 0 && t > A.holdUp && t - A.since > 4000) {
      const k = ST[A.i - 1] / ST[A.i];
      if (g == null || g * k * k < T * 0.8) { A.up = { f }; return A.i - 1; }
    }
    return A.i;
  }

  // -------------------------------------------------------------------------
  function aaMake(THREE, renderer) {
    // EVERY CAPABILITY IS ASKED FOR, none assumed. The headless smoke harness
    // stubs THREE with what the viewer needed before this file existed, so a
    // missing constructor here must degrade to the old path and not throw at
    // module eval — a dead viewer is a worse bug than a rough edge.
    const S = {
      tier: 'off', w: 1, h: 1, rt: null, mat: null, dither: 1, scale: 1,   // scale: the render scale (0.5-1, PERF 2026-09-23), times the tier's ss
      fsScene: null, fsCam: null, ss: 1, samples: 0, able: false, maxSamples: 0,
      // CLOUDS C1: a pass that draws OVER the scene into this target before the resolve (the cloud
      // march composites there, reading the scene's depth) - it asks for the target even at tier
      // `off` (a 0-sample target, the blit resolve) and for a depth texture on it
      overlay: null, post: null, pre: null, needRT: false,
      linear: false,       // G448.3: the linear split (radiance in the target, ONE tone map in the blit)
    };

    try {
      const gl = renderer.getContext && renderer.getContext();
      const caps = renderer.capabilities;
      // the node renderer (W0.5b) has no getContext, no MAX_SAMPLES to ask, and
      // its own MSAA on the canvas: the pass steps aside there, as it does on
      // any card that cannot carry it
      S.able = !renderer.isWebGPURenderer && !!(THREE.WebGLRenderTarget && THREE.HalfFloatType &&
                  THREE.ShaderMaterial && THREE.WebGLRenderTarget &&
                  renderer.setRenderTarget && gl && caps && caps.isWebGL2);
      if (S.able) S.maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 4;
      // THE REVERSED DEPTH BUFFER (PERF 2026-09-23, app.js): its precision is a FLOAT depth's, and the
      // canvas's is 24-bit fixed - so under it every tier draws into this target, `off` included (at
      // the canvas's own four samples), and the target's depth is 32-bit float
      S.rz = !!(caps && caps.reversedDepthBuffer);
    } catch (e) { S.able = false; }

    function disposeRT() {
      if (S.rt) { S.rt.dispose(); S.rt = null; }
    }

    function buildRT() {
      disposeRT();
      if (!S.able || (S.tier === 'off' && !S.needRT && !S.rz && S.scale >= 0.999)) return;
      const R = S.ss * S.scale;   // the target over the canvas: the tier's supersample times the render scale
      const SW = Math.max(1, Math.round(S.w * R));
      const SH = Math.max(1, Math.round(S.h * R));
      S.rt = new THREE.WebGLRenderTarget(SW, SH, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        generateMipmaps: false, type: THREE.HalfFloatType,
        format: THREE.RGBAFormat, depthBuffer: true,
        // THE STENCIL RIDES ALONG OR THE SILHOUETTE DIES. r128 render targets
        // default `stencilBuffer: false`, and the G131 selection silhouette is
        // drawn WITH the stencil (mask stamps a bit, shell tests NotEqual).
        // On a target without one the mask stamps nothing, the test passes
        // everywhere and the shell floods the part solid — which is exactly
        // what the user saw in the first build. With it, r128 allocates a
        // multisampled DEPTH24_STENCIL8 renderbuffer, same as the canvas has.
        stencilBuffer: true,
        // THE SCENE'S DEPTH, READABLE (CLOUDS C1): r186 resolves the multisampled depth into this
        // texture when the target is left (resolveDepthBuffer), 24-bit depth + the 8-bit stencil
        // UNDER THE REVERSED BUFFER it is FLOAT depth + the stencil (DEPTH32F_STENCIL8, the multisampled
        // renderbuffer's format follows the texture's type), and resolved only when a pass reads it
        depthTexture: (S.needRT || S.rz) && THREE.DepthTexture ? new THREE.DepthTexture(SW, SH, S.rz ? THREE.FloatType : THREE.UnsignedInt248Type) : null,   // null, not undefined: r186's setter reads it
      });
      if (S.rt.depthTexture) { S.rt.depthTexture.format = THREE.DepthStencilFormat; S.rt.depthTexture.minFilter = S.rt.depthTexture.magFilter = THREE.NearestFilter; }
      S.rt.resolveDepthBuffer = !!S.needRT;
      // THE STENCIL IS NEVER RESOLVED (PERF 2026-09-23): nothing reads the resolved texture's stencil (the
      // silhouette's stencil lives and dies inside the multisampled pass), and r186 resolves it by default -
      // ANGLE on D3D11 has no native depth-stencil resolve, so every frame paid a shader pass over every
      // sample of the stencil: 11.6 ms at 8x MSAA, 1080p, 300 m over the Jolene field (the frame study)
      S.rt.resolveStencilBuffer = false;
      S.rt.samples = Math.min(S.tier === 'off' && !S.needRT && S.rz ? 4 : S.samples, S.maxSamples);
      // THE TWO LINES THAT KEEP THE GAME LOOKING LIKE THE GAME (see THE TARGET
      // IS DISPLAY-SPACE in the header): the XR-target rule makes r186 treat
      // this target like the canvas — materials tone-map and encode on the
      // way in, per their own toneMapped, into the space this texture names —
      // and therefore makes the blend unit composite in display space, exactly
      // as it does on the canvas. Without them every transparent material in
      // the scene re-composites in linear light and the sky is tone-mapped
      // twice.
      // THE LINEAR SPLIT (G448.3): with S.linear the target is an ordinary
      // linear target - materials write radiance, the blend unit composites in
      // linear light (a canopy's reflection SUMS with the cabin behind it
      // before the one tone map in the blit) - and the two lines below are not
      // taken. The display-space rule stays the default and the fallback.
      if (!S.linear) {
        S.rt.isXRRenderTarget = true;
        S.rt.texture.colorSpace = THREE.SRGBColorSpace;
      } else {
        S.rt.isXRRenderTarget = false;
        S.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
      }
      if (!S.fsScene) {
        S.fsScene = new THREE.Scene();
        S.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        S.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
        S.quad.frustumCulled = false;
        S.fsScene.add(S.quad);
      }
      if (S.mat) S.mat.dispose();
      S.mat = new THREE.ShaderMaterial({
        uniforms: {
          tSrc:    { value: S.rt.texture },
          uTexel:  { value: new THREE.Vector2(1 / SW, 1 / SH) },
          uR:      { value: R },
          uDither: { value: S.dither },
        },
        vertexShader: AA_VS,
        fragmentShader: R > 1.001 ? AA_FS_TENT : R < 0.999 ? AA_FS_UP : AA_FS_BLIT,
        defines: S.linear ? { AA_LINEAR: 1 } : {},
        depthTest: false, depthWrite: false,
        toneMapped: true,     // the blit carries the renderer's tone map in linear mode (a no-op define otherwise)
      });
      S.quad.material = S.mat;
    }

    function setTier(k) {
      const t = AA_TIERS[k] || AA_TIERS[AA_DEF];
      const key = AA_TIERS[k] ? k : AA_DEF;
      if (!S.able) { S.tier = 'off'; S.ss = 1; S.samples = 0; disposeRT(); return S.tier; }
      S.tier = key; S.ss = t.ss; S.samples = t.samples;
      buildRT();
      try { localStorage.setItem(AA_PREF, key); } catch (e) {}
      return S.tier;
    }

    // setScale(k): the render scale, 0.5..1 - the scene drawn at k x the canvas and enlarged by the resolve
    function setScale(k) { k = Math.max(0.5, Math.min(1, +k || 1)); if (Math.abs(k - S.scale) < 1e-3) return S.scale; S.scale = k; buildRT(); return S.scale; }
    // THE AUTO SCALE (PERF 2026-09-23, G528): the render scale held to the frame budget - a new player's machine is not
    // known, and a big screen or a small GPU is exactly what the scale buys back. Every 30 frames the median frame is
    // read: over 1.08 x the budget (60 fps) the scale steps DOWN one of the menu's own steps (1 / .85 / .75 / .67 / .5,
    // a target rebuild each, at most every 2 s) - and the next reading must show it PAID: a frame the CPU binds (1080p
    // on the reference box: three's draws) does not get faster with fewer pixels, so an unpaid step is taken back and
    // the scale left alone for 30 s (doubling on each repeat, 5 min at most) - the picture is never blurred for nothing.
    // It steps UP when the frame holds the budget and the scene's own GPU time (the timer query round the scene pass)
    // says the next step's pixels fit in 80 % of it; an up step that then misses holds the ups for a minute.
    const AUTO = { on: false, T: 1000 / 60, steps: [1, 0.85, 0.75, 0.67, 0.5], i: 0, fr: [], gpu: [], q: [], last: 0, since: 0,
                   probe: null, up: null, holdDown: 0, holdUp: 0, reverts: 0, ext: null, stats: { down: 0, up: 0, reverts: 0 } };
    function autoScale(on) {
      on = !!on;
      AUTO.on = on; AUTO.fr = []; AUTO.gpu = []; AUTO.last = 0; AUTO.probe = AUTO.up = null;
      if (on) {
        let bi = 0, bd = 9;
        AUTO.steps.forEach((k, i) => { const d = Math.abs(k - S.scale); if (d < bd) { bd = d; bi = i; } });
        AUTO.i = bi;
        if (!AUTO.ext) { try { AUTO.ext = renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2'); } catch (e) {} }
      }
      return AUTO.on;
    }
    const aMed = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
    function autoStep(i, t) { AUTO.stats[i > AUTO.i ? 'down' : 'up']++; AUTO.i = i; AUTO.since = t; setScale(AUTO.steps[i]); AUTO.fr = []; AUTO.gpu = []; }
    function autoTick() {
      const t = performance.now();
      if (AUTO.last) { const dt = t - AUTO.last; if (dt < 250) AUTO.fr.push(dt); }   // a stall (a tab away, a load) is not a frame
      AUTO.last = t;
      const gl = renderer.getContext(), ext = AUTO.ext;
      while (ext && AUTO.q.length && gl.getQueryParameter(AUTO.q[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = AUTO.q.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) AUTO.gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
      }
      if (AUTO.fr.length < 30) return;
      const f = aMed(AUTO.fr), g = AUTO.gpu.length >= 5 ? aMed(AUTO.gpu) : null;
      AUTO.fr = []; AUTO.gpu = [];
      const ni = aaAutoDecide(AUTO, f, g, t);
      if (ni !== AUTO.i) autoStep(ni, t);
    }
    function setSize(w, h) {
      if (w === S.w && h === S.h) return;
      S.w = Math.max(1, w | 0); S.h = Math.max(1, h | 0);
      buildRT();
    }

    // THE ONE CALL app.js MAKES. It stands exactly where `renderer.render` did,
    // and when the tier is `off` it IS `renderer.render` — so the old path is
    // never emulated, only stepped around.
    function render(scene, camera) {
      if (!S.rt) { renderer.render(scene, camera); return false; }
      // TONE MAPPING AND EXPOSURE ARE NOT TOUCHED. The materials do both, into
      // an encoded target, exactly as they do onto the canvas — so the hangar's
      // moods reach the frame without this pass knowing they exist.
      if (AUTO.on) autoTick();
      const prevTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
      // THE PRE HOOK (A6): the clouds march BEFORE the scene, off the previous frame's resolved depth
      // (their integration's end - a frame stale at a ridge, invisible), and composite INSIDE the pass
      // as a quad at their own depth (the silhouettes per MSAA sample) - see clouds.js COMP_FRAG
      if (S.pre) S.pre(renderer, camera, S.rt);
      renderer.setRenderTarget(S.rt);
      // the auto scale's GPU reading: the scene pass alone (the clouds' and the post passes' own timers are outside it)
      let aq = null;
      if (AUTO.on && AUTO.ext && AUTO.q.length < 6) { const gl = renderer.getContext(); aq = gl.createQuery(); gl.beginQuery(AUTO.ext.TIME_ELAPSED_EXT, aq); }
      renderer.render(scene, camera);
      if (aq) { renderer.getContext().endQuery(AUTO.ext.TIME_ELAPSED_EXT); AUTO.q.push(aq); }
      if (S.overlay) S.overlay(renderer, camera, S.rt);     // the clouds' march (reads the target's depth)
      renderer.setRenderTarget(prevTarget);
      renderer.render(S.fsScene, S.fsCam);
      // THE POST HOOK (CLOUDS C2): the clouds composite onto the RESOLVED frame, not into the
      // multisampled target - three resolves the whole 8x target at the end of every render()
      // into it, and one more fullscreen draw there cost a second resolve (7 ms on a 3080 under
      // ANGLE, measured with the GPU timer; the march itself is 0.3 ms)
      if (S.post) S.post(renderer, camera, S.rt);
      return true;
    }
    // needRT(on): a pass wants the target and its depth even at tier `off`
    function needRT(on) { on = !!on; if (on === S.needRT) return; S.needRT = on; buildRT(); }

    function dispose() {
      disposeRT();
      if (S.mat) { S.mat.dispose(); S.mat = null; }
    }

    // the saved choice wins over the default, as any menu choice should
    let want = AA_DEF;
    try { want = localStorage.getItem(AA_PREF) || AA_DEF; } catch (e) {}
    setTier(want);

    // THE DITHER IS A KNOB, not a constant, for two reasons that are not the
    // same reason. Tuning: +/-1 LSB clears the 97-pixel plateaus on the flank
    // but leaves the flattest stretches banded, and how much grain is worth
    // how much smoothness is the user's eye, not a number this file can pick.
    // And PROOF: a dither cannot be told apart from a colour error by staring
    // at a mean, so anything measuring this pass has to be able to turn it off.
    // That is how the +1.5 code mean shift in G144's own bring-up was shown to
    // be the grain and not a broken tone curve.
    // setLinear(on): the target linear and the tone map in the blit (rebuilds the target)
    function setLinear(on) { on = !!on; if (on === S.linear) return S.linear; S.linear = on; buildRT(); return S.linear; }
    function setDither(x) {
      S.dither = Math.max(0, Math.min(4, +x || 0));
      if (S.mat) S.mat.uniforms.uDither.value = S.dither;
      return S.dither;
    }

    return {
      render, setSize, setTier, setScale, scale: () => S.scale, dispose,
      autoScale, autoState: () => ({ on: AUTO.on, scale: S.scale, step: AUTO.i, holdDownS: Math.max(0, (AUTO.holdDown - performance.now()) / 1000) | 0, stats: Object.assign({}, AUTO.stats) }), setDither, setLinear, linear: () => S.linear,
      needRT, setOverlay: f => { S.overlay = f || null; }, setPost: f => { S.post = f || null; }, setPre: f => { S.pre = f || null; },
      // the pass's own target (LOADING S2): a program compiled with it bound
      // carries the canvas's tone mapping and colour space, which is what the
      // first frame will ask for - null at tier 'off', where the canvas is the target
      target: () => S.rt || null,
      // G583: the blit's program, for the roll-out's compile step (shader_warm.js) - drawn onto the canvas
      warmList: () => (S.rt && S.mat ? [{ m: S.mat, to: null }] : []),
      dither: () => S.dither,
      tier: () => S.tier,
      able: () => S.able,
      report: () => ({
        tier: S.tier, able: S.able, ss: S.ss, scale: S.scale, auto: AUTO.on, dither: S.dither,
        samples: S.rt ? S.rt.samples : 0, maxSamples: S.maxSamples, depth: S.rz ? 'reversed float' : 'log 24',
        buf: S.rt ? (S.rt.width + 'x' + S.rt.height) : (S.w + 'x' + S.h),
      }),
    };
  }

  const API = { make: aaMake, TIERS: AA_TIERS, DEF: AA_DEF, PREF: AA_PREF, autoDecide: aaAutoDecide };
  if (typeof window !== 'undefined') window.AA_RESOLVE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
