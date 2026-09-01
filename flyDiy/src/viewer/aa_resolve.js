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
// THE r128 FACT THAT COSTS AN AFTERNOON, so nobody pays it twice:
//
//     outputEncoding: null !== A ? v(A.texture) : t.outputEncoding
//     toneMapping:    r.toneMapped ? t.toneMapping : 0
//
//   Those are the two lines in vendor/three.min.js that decide it, and they do
//   NOT agree with each other. TONE MAPPING is taken from the RENDERER and
//   applies whatever you render into. OUTPUT ENCODING is taken from the TARGET
//   — and only from the renderer when there is no target.
//
//   Read that asymmetry the wrong way and the frame is dark; read it the other
//   wrong way and it is bright. Both happened while this was written, and both
//   were the same root cause: a target left at the default LinearEncoding gets
//   tone-mapped but un-encoded values, which is neither of the two states you
//   would reasonably assume it to be in.
//
//   The fix is not to compensate downstream. It is to set the target's encoding
//   and let both lines agree — see THE TARGET IS sRGB-ENCODED above. Then the
//   scene arrives already tone-mapped AND already encoded, this pass never
//   touches colour at all, and there is exactly one implementation of ACES in
//   the project instead of two that can drift apart.
//
// THE TARGET IS sRGB-ENCODED, NOT LINEAR — and that is the whole reason this
// pass is safe to turn on. It is also the mistake the first draft made, so the
// reasoning is written down rather than left as a flag nobody dares touch.
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
// re-grading all of it as a side effect.
//
// So the target carries `encoding = sRGBEncoding`, and r128 honours that:
//
//     outputEncoding: null !== A ? v(A.texture) : t.outputEncoding
//     function v(t) { return t && t.isTexture ? t.encoding : ... }
//
// With that one property set, materials encode on the way into the target
// exactly as they do on the way to the canvas, blending happens in display
// space exactly as it always has, and the pass keeps tone mapping OFF ITS OWN
// HANDS entirely — no second copy of ACES, no `/0.6` to get wrong, no chance of
// drifting from the renderer on a three upgrade. The first draft did carry its
// own ACES, and deleting it is the single biggest simplification here.
//
// THE TARGET IS STILL HALF FLOAT, though it now holds display-space values.
// Encoding decides the SPACE, type decides the PRECISION, and they are
// independent: an 8-bit target would quantise to 256 levels BEFORE the filter
// and the dither could act, which would hand back the very banding the dither
// exists to remove.
//
// WHAT THIS COSTS, stated plainly: the downsample filter now averages encoded
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
  const AA_FS_BLIT = AA_COMMON + `
    void main() {
      gl_FragColor = vec4(aaDither(texture2D(tSrc, vUv).rgb), 1.0);
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
      vec3 col = clamp(acc.rgb / wsum, 0.0, 1.0);
      gl_FragColor = vec4(aaDither(col), 1.0);
    }`;

  // -------------------------------------------------------------------------
  function aaMake(THREE, renderer) {
    // EVERY CAPABILITY IS ASKED FOR, none assumed. The headless smoke harness
    // stubs THREE with what the viewer needed before this file existed, so a
    // missing constructor here must degrade to the old path and not throw at
    // module eval — a dead viewer is a worse bug than a rough edge.
    const S = {
      tier: 'off', w: 1, h: 1, rt: null, mat: null, dither: 1,
      fsScene: null, fsCam: null, ss: 1, samples: 0, able: false, maxSamples: 0,
    };

    try {
      const gl = renderer.getContext && renderer.getContext();
      const caps = renderer.capabilities;
      S.able = !!(THREE.WebGLMultisampleRenderTarget && THREE.HalfFloatType &&
                  THREE.ShaderMaterial && THREE.WebGLRenderTarget &&
                  renderer.setRenderTarget && gl && caps && caps.isWebGL2);
      if (S.able) S.maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 4;
    } catch (e) { S.able = false; }

    function disposeRT() {
      if (S.rt) { S.rt.dispose(); S.rt = null; }
    }

    function buildRT() {
      disposeRT();
      if (!S.able || S.tier === 'off') return;
      const SW = Math.max(1, Math.round(S.w * S.ss));
      const SH = Math.max(1, Math.round(S.h * S.ss));
      S.rt = new THREE.WebGLMultisampleRenderTarget(SW, SH, {
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
      });
      S.rt.samples = Math.min(S.samples, S.maxSamples);
      // THE ONE LINE THAT KEEPS THE GAME LOOKING LIKE THE GAME. r128 takes the
      // output encoding from the TARGET when there is one, so this makes the
      // materials encode on the way in — and therefore makes the blend unit
      // composite in display space, exactly as it does on the canvas. Without
      // it every transparent material in the scene silently re-composites in
      // linear light. See THE TARGET IS sRGB-ENCODED in the header.
      S.rt.texture.encoding = THREE.sRGBEncoding;
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
          uR:      { value: S.ss },
          uDither: { value: S.dither },
        },
        vertexShader: AA_VS,
        fragmentShader: S.ss > 1.001 ? AA_FS_TENT : AA_FS_BLIT,
        depthTest: false, depthWrite: false,
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

    function setSize(w, h) {
      if (w === S.w && h === S.h) return;
      S.w = Math.max(1, w | 0); S.h = Math.max(1, h | 0);
      buildRT();
    }

    // THE ONE CALL app.js MAKES. It stands exactly where `renderer.render` did,
    // and when the tier is `off` it IS `renderer.render` — so the old path is
    // never emulated, only stepped around.
    function render(scene, camera) {
      if (!S.rt || S.tier === 'off') { renderer.render(scene, camera); return false; }
      // TONE MAPPING AND EXPOSURE ARE NOT TOUCHED. The materials do both, into
      // an encoded target, exactly as they do onto the canvas — so the hangar's
      // moods reach the frame without this pass knowing they exist.
      const prevTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
      renderer.setRenderTarget(S.rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prevTarget);
      renderer.render(S.fsScene, S.fsCam);
      return true;
    }

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
    function setDither(x) {
      S.dither = Math.max(0, Math.min(4, +x || 0));
      if (S.mat) S.mat.uniforms.uDither.value = S.dither;
      return S.dither;
    }

    return {
      render, setSize, setTier, dispose, setDither,
      dither: () => S.dither,
      tier: () => S.tier,
      able: () => S.able,
      report: () => ({
        tier: S.tier, able: S.able, ss: S.ss, dither: S.dither,
        samples: S.rt ? S.rt.samples : 0, maxSamples: S.maxSamples,
        buf: S.rt ? (S.rt.width + 'x' + S.rt.height) : (S.w + 'x' + S.h),
      }),
    };
  }

  const API = { make: aaMake, TIERS: AA_TIERS, DEF: AA_DEF, PREF: AA_PREF };
  if (typeof window !== 'undefined') window.AA_RESOLVE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
