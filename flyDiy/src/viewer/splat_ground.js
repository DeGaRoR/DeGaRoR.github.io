// ===========================================================================
// THE ISLAND'S SPLAT, IN THE GAME (alpha splatting, 2026-09-20) — the bench's
// tools/_island.html `splat` source ported into the island ground hook of
// render_world.js: the ground drawn by terrain type from the library
// (media/tex/splat, seventeen sets in two texture arrays), height-blended,
// hex-tiled, triplanar, with the shared micro-fields (28b_ground_fields.js)
// and the macro tiers - the detail gives way to the aerial packs, then to the
// stack the game already ships (the lit Landsat albedo IS the macro here).
// ===========================================================================
// WHAT THIS FILE OWNS
//   SPLAT_GROUND.make(gU, isla)  -> { uniforms, glslCommon, glslMap, glslNormal, glslRough, api }
//     uniforms    the u S* uniforms (two arrays, the per-code tables, the knobs)
//     glslCommon  the functions, spliced after the hook's own helpers
//     glslMap     the call, spliced into the map_fragment block after the
//                 stack's `t` (the stack is the macro it fades to)
//     glslNormal  the normal's perturbation, spliced after normal_fragment_maps
//     glslRough   the sets' roughness, spliced after roughnessmap_fragment (the
//                 near ring is a MeshStandardMaterial since 2026-09-21 - the
//                 muskeg pools 0.03, wet mud, bare rock catch the sun and the
//                 probe; a Lambert ring has no such include and ignores it)
//     api         F8's handle: get/set knobs, code rows, grades, the library
//   The arrays are assembled from SPLAT_TEX_SETS (lazily-made Images) once the
//   maps have decoded; the ground draws the stack alone until then (uSplatOn).
//
// SAMPLERS (measured, tools/sampler_census.js, 2026-09-20): the near ring
// spent 8 units, the outer ring 12, the premises patch 13, of 16; the two
// arrays make that 10 / 14 / 15; the Standard near ring (envMap + dfgLUT,
// 2026-09-21) 12 / 14 / 15 - the patch clones a Lambert twin. Nothing else
// may be added to the island's ground programs without a census (GATE SPLAT
// --gpu holds these numbers as the ratchet).
//
// THE SHADER'S RULES (learned on the bench, ANGLE/D3D):
//   - implicit texture() on the arrays: textureGrad/textureLod on a
//     sampler2DArray is an fxc INTERNAL ERROR (links unoptimised on the third
//     retry and took the GPU process down);
//   - loop bounds are UNIFORMS: a constant-bound loop with the material chain
//     inside is unrolled fourteen times;
//   - one struct through the chain, no `out` parameters;
//   - an oriented set (the beach facing the sea) tiles plainly, never turned.
'use strict';
const SPLAT_GROUND = (() => {
  const NCODE = 15, NLIB = 24;
  const G = (typeof GROUND_FIELDS !== 'undefined') ? GROUND_FIELDS : null;

  // ---- the state: the recipe (the module's default under the browser's copy) --
  const load = () => {
    const R = JSON.parse(JSON.stringify(G.RECIPE));
    let sv0 = null;
    try { const sv = JSON.parse(localStorage.getItem('flydiy.ground.splat.v1') || 'null'); sv0 = sv;
      if (sv) { if (sv.codes) for (const k in sv.codes) R.codes[k] = Object.assign(R.codes[k] || {}, sv.codes[k]);
        if (sv.knobs) Object.assign(R.knobs, sv.knobs); if (sv.grade) R.grade = sv.grade; if (sv.on !== undefined) R.on = sv.on; } } catch (e) {}
    if (R.on === undefined) R.on = 1;
    R.macroExpSaved = !!(sv0 && sv0.knobs && sv0.knobs.macroExp);   // an override sticks; else the auto value (make)
    return R;
  };
  const save = R => { try { localStorage.setItem('flydiy.ground.splat.v1', JSON.stringify({ codes: R.codes, knobs: R.knobs, grade: R.grade, on: R.on })); } catch (e) {} };

  // ---- the GLSL: the bench's splat, on the game's fields ----------------------
  // inputs the hook already has at map_fragment: vWPi (world), gA (ori, canopy,
  // coast, lake), uGPackB (ndvi, terrain type), uGGrid, uGCell, gVnoise, gLuma,
  // gN (the slope normal off the screen derivatives), cameraPosition
  const glslCommon = () => `
  uniform highp sampler2DArray uSplat, uSplatN;
  uniform float uSplatOn;
  uniform vec4 uSMatA[${NCODE}], uSMatS[${NCODE}], uSMatF[${NCODE}], uSMatFS[${NCODE}], uSMatM[${NCODE}], uSVary[${NCODE}];
  uniform vec4 uSGrade[${NLIB}];
  uniform float uSGloss[${NLIB}];
  uniform float uSLum[${NLIB}];   // each set's mean luminance after its grade (linear): the detail's texel over it is pure TEXTURE
  uniform float uSGrass[${NLIB}];   // per set: how far its DARK texels are pulled to the open ground's grass (the forest floor's, 2026-09-23)
  uniform vec4 uSGrassC;            // that grass, MEASURED - the mean of the open-ground sets after their own normalisation
  float gSRel = 1.0;   // sMat's texel over its set's mean, read by sSplat per candidate
  uniform vec4 uSSplit, uSSplit2, uSDist, uSDist2, uSHex, uSPud, uSPud2, uSVeg;
  uniform float uSFarN, uSNearN;   // PERF 2026-09-23: how many sets a terrain type blends, far (past the detail fade) and near: 3 = its recipe's, 1 = its first
  uniform float uSHexPx;   // PERF 2026-09-23: the hex tiling only where a set's tile spans more than this many pixels (0 = everywhere)
  float gSPixM = 1.0;      // the fragment's footprint on the ground, metres a pixel (sSplat, in uniform flow)
  float gSSlope = 0.0;     // the ground's slope in degrees at this fragment (sSplat, before the candidates): a puddle needs a level place
  uniform vec2 uSSeam, uSNrm, uSLakeE;
  uniform float uSBeachRot;
  uniform int uSNCode, uSNCand;
  vec3 gSN; float gSRough; float gSHexRot;
  ${G.glsl}
  struct Smp { vec4 c; vec4 n; };
  vec3 sHweights3(float ha, float wa, float hb, float wb, float hc, float wc, float depth){
    float ma = max(max(ha + wa, hb + wb), hc + wc) - depth;
    vec3 b = max(vec3(ha + wa, hb + wb, hc + wc) - ma, 0.0);
    return b / (b.x + b.y + b.z);
  }
  vec2 sHweights2(float ha, float wa, float hb, float wb, float depth){
    float ma = max(ha + wa, hb + wb) - depth;
    vec2 b = max(vec2(ha + wa, hb + wb) - ma, 0.0);
    return b / (b.x + b.y);
  }
  vec2 sHash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  Smp sFetch(float layer, vec2 uv, vec2 cs){
    Smp o;
    o.c = texture(uSplat, vec3(uv, layer));
    o.c.rgb = sRGBTransferEOTF(vec4(o.c.rgb, 1.0)).rgb;   // the colour is sRGB bytes decoded here (an sRGB array texture is refused - GL 1281); the height in alpha is linear
    vec4 nr = texture(uSplatN, vec3(uv, layer));
    vec2 t = nr.xy * 2.0 - 1.0;
    t = vec2(cs.x * t.x + cs.y * t.y, -cs.y * t.x + cs.x * t.y);
    o.n = vec4(t, nr.z * 2.0 - 1.0, 1.0 - (1.0 - nr.a) * uSGloss[int(layer + 0.5)]);   // the rough map through the set's gloss grade (1 = the map's, 0 = matte)
    vec4 g = uSGrade[int(layer + 0.5)];
    o.c.rgb *= g.rgb; float l = gLuma(o.c.rgb); o.c.rgb = mix(vec3(l), o.c.rgb, g.a);
    // THE GRASS UNDER THE TREES IS THE SAME GRASS (the user, 2026-09-23, circling the forest
    // floor beside an open slope: "move the forest texture to match better the surrounding grass.
    // Not perfectly, but better. So we can believe that the grass in between the rocks is the same
    // as the grass on flat planes. On the forest floor texture, the brightest areas are rock, the
    // darkest are grass. If you can selectively edit only the grass, that would be ace").
    // THE MASK IS LUMINANCE, NOT HUE - that is the user's own observation about THIS photograph, and
    // it is why the green-dominance mask below cannot do this job: the floor's grass is a dark
    // brown-green and its rock is the bright part, so hue tells them apart badly and value perfectly.
    // The pivot is the set's OWN mean luminance (uSLum), so the split follows the photograph rather
    // than a number someone typed. The pull is a RECOLOUR AT CONSTANT VALUE: the texel keeps its own
    // light and dark - the texture's whole structure - and only its colour walks toward uSGrassC,
    // which is MEASURED from the open-ground sets the user is comparing it against.
    { float gr = uSGrass[int(layer + 0.5)];
      if (gr > 0.001) {
        float l = gLuma(o.c.rgb), lm = max(uSLum[int(layer + 0.5)], 1e-4);
        float dark = 1.0 - smoothstep(lm * 0.55, lm * 1.25, l);   // 1 on the darkest texels (the grass), 0 on the brightest (the rock)
        vec3 hue = uSGrassC.rgb / max(gLuma(uSGrassC.rgb), 1e-4);
        o.c.rgb = mix(o.c.rgb, hue * l, dark * gr);
      } }
    // THE GRASS INSIDE A TEXTURE, AND ONLY IT (the user, 2026-09-23: "restore only the rock
    // texture to its original tone, then very slightly tune the grass part of the texture to
    // get more lush green, without modifying the rock color. Ever so subtle"). A set is one
    // photograph of ground: rocksA is boulders WITH vegetation between them, grassRock is the
    // pair in one image. A per-SET gain cannot tell them apart - it moves the boulders with the
    // moss. This is per TEXEL: how far the green channel stands over the other two, which is 0
    // on anything grey or brown (rock, sand, peat) and rises on leaf and moss. uSVeg.x is the
    // whole strength, and at its shipped value the greenest texel moves about 3 %.
    if (uSVeg.x > 0.001) {
      float veg = clamp((o.c.g - max(o.c.r, o.c.b)) / max(max(o.c.r, max(o.c.g, o.c.b)), 1e-4) * 3.0, 0.0, 1.0);
      o.c.rgb = mix(o.c.rgb, o.c.rgb * vec3(0.96, 1.08, 0.92), veg * uSVeg.x);
    }
    return o;
  }
  Smp sTile(float layer, vec2 st){
    if (uSHex.y < 0.5 || gSHexRot < 0.0) return sFetch(layer, st, vec2(1.0, 0.0));
    vec2 sk = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (st * uSHex.z);
    vec2 base = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
    float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
    vec3 w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
    vec2 v1 = base + vec2(s, s), v2 = base + vec2(s, 1.0 - s), v3 = base + vec2(1.0 - s, s);
    vec2 r1 = sHash2(v1), r2 = sHash2(v2), r3 = sHash2(v3);
    float a1 = (r1.x - 0.5) * 2.0 * gSHexRot, a2 = (r2.x - 0.5) * 2.0 * gSHexRot, a3 = (r3.x - 0.5) * 2.0 * gSHexRot;
    mat2 R1 = mat2(cos(a1), sin(a1), -sin(a1), cos(a1)), R2 = mat2(cos(a2), sin(a2), -sin(a2), cos(a2)), R3 = mat2(cos(a3), sin(a3), -sin(a3), cos(a3));
    Smp s1 = sFetch(layer, R1 * st + r1 * 7.3, vec2(cos(a1), sin(a1)));
    Smp s2v = sFetch(layer, R2 * st + r2 * 7.3, vec2(cos(a2), sin(a2)));
    Smp s3 = sFetch(layer, R3 * st + r3 * 7.3, vec2(cos(a3), sin(a3)));
    vec3 hw = sHweights3(s1.c.a, w.x, s2v.c.a, w.y, s3.c.a, w.z, uSHex.x);
    Smp o; o.c = s1.c * hw.x + s2v.c * hw.y + s3.c * hw.z; o.n = s1.n * hw.x + s2v.n * hw.y + s3.n * hw.z;
    return o;
  }
  Smp sSet(float layer, float scale, vec3 P, vec3 tw, float ang){
    scale = max(scale, 0.01);
    vec2 p = P.xz; float ca = 1.0, sa = 0.0;
    gSHexRot = ang != 0.0 ? -1.0 : uSHex.w;
    // THE HEX CUT, A DIAL LEFT AT 0 (PERF 2026-09-23): the hex tiling dropped where a set's tile spans under
    // uSHexPx pixels. At 4 it showed the tiles repeating as a checker over the far field (a tile of 4-16 px
    // still has its low frequencies, and they repeat), and its 'saving' was the mip-0 bug below (NO CONTINUE):
    // with the mips honoured the far samples are cheap and the hex costs nothing measurable. 0 = everywhere.
    if (uSHexPx > 0.0 && scale < uSHexPx * gSPixM) gSHexRot = -1.0;
    if (ang != 0.0) { ca = cos(ang); sa = sin(ang); mat2 R = mat2(ca, sa, -sa, ca); p = R * p; }
    Smp t = sTile(layer, p / scale);
    vec2 tt = vec2(ca * t.n.x + sa * t.n.y, -sa * t.n.x + ca * t.n.y);
    Smp o; o.c = t.c * tw.y; o.n = vec4(tt.x, 0.0, tt.y, t.n.a) * tw.y;
    if (tw.x > 0.01) { Smp u = sTile(layer, P.zy / scale); o.c += u.c * tw.x; o.n += vec4(0.0, u.n.y, u.n.x, u.n.a) * tw.x; }
    if (tw.z > 0.01) { Smp u = sTile(layer, P.xy / scale); o.c += u.c * tw.z; o.n += vec4(u.n.x, u.n.y, 0.0, u.n.a) * tw.z; }
    return o;
  }
  // the triplet's height blend of its (up to) three sampled sets; A says which exist
  Smp sBlend(vec4 A, Smp a, Smp b, Smp c, float m1, float m2){
    if (A.y < 0.0) return a;
    Smp o;
    if (A.z < 0.0) { vec2 w = sHweights2(a.c.a, 1.0 - m1, b.c.a, m1, uSHex.x); o.c = a.c * w.x + b.c * w.y; o.n = a.n * w.x + b.n * w.y; return o; }
    vec3 w = sHweights3(a.c.a, (1.0 - m1) * (1.0 - m2), b.c.a, m1 * (1.0 - m2), c.c.a, m2, uSHex.x);
    o.c = a.c * w.x + b.c * w.y + c.c * w.z; o.n = a.n * w.x + b.n * w.y + c.n * w.z;
    return o;
  }
  Smp sTriplet(vec4 A, vec4 S, vec3 P, vec3 tw, float ang, float m1, float m2){
    Smp a = sSet(A.x, S.x, P, tw, ang);
    if (A.y < 0.0) return a;
    Smp b = sSet(A.y, S.y, P, tw, ang);
    Smp c = b;
    if (A.z >= 0.0) c = sSet(A.z, S.z, P, tw, ang);
    return sBlend(A, a, b, c, m1, m2);
  }
  bool sSame(float l1, float s1, float l2, float s2){ return l1 == l2 && abs(s1 - s2) < 1e-4; }
  // THE DETAIL BAND, SHARED (PERF 2026-09-23): between detailFrom and detailTo (150-900 m) a pixel blends the
  // near triplet and the far one, and was sampling both whole - six sets, each hex-tiled (3 fetches) in both
  // arrays and triplanar on a slope. But a far set is very often a near one (a null far set falls back to the
  // near set, and the recipe reuses its sets: forest, old forest, sand, snow, shingle and dense scrub have a far
  // triplet IDENTICAL to the near, heath and scrub share two of three). A set sampled at the same layer and scale
  // at the same point is the same sample: take it once. The same pixels, bit for bit up to the sum's order.
  Smp sBand(vec4 A, vec4 S, vec4 F, vec4 FS, vec3 P, vec3 tw, float ang, float m1, float m2, float fw){
    Smp a0 = sSet(A.x, S.x, P, tw, ang), a1 = a0, a2 = a0;
    if (A.y >= 0.0) { if (sSame(A.y, S.y, A.x, S.x)) a1 = a0; else a1 = sSet(A.y, S.y, P, tw, ang); }
    if (A.y >= 0.0 && A.z >= 0.0) { if (sSame(A.z, S.z, A.x, S.x)) a2 = a0; else if (A.y >= 0.0 && sSame(A.z, S.z, A.y, S.y)) a2 = a1; else a2 = sSet(A.z, S.z, P, tw, ang); }
    Smp f0, f1 = a0, f2 = a0;
    if (sSame(F.x, FS.x, A.x, S.x)) f0 = a0;
    else if (A.y >= 0.0 && sSame(F.x, FS.x, A.y, S.y)) f0 = a1;
    else if (A.y >= 0.0 && A.z >= 0.0 && sSame(F.x, FS.x, A.z, S.z)) f0 = a2;
    else f0 = sSet(F.x, FS.x, P, tw, ang);
    if (F.y >= 0.0) {
      if (sSame(F.y, FS.y, F.x, FS.x)) f1 = f0;
      else if (sSame(F.y, FS.y, A.x, S.x)) f1 = a0;
      else if (A.y >= 0.0 && sSame(F.y, FS.y, A.y, S.y)) f1 = a1;
      else if (A.y >= 0.0 && A.z >= 0.0 && sSame(F.y, FS.y, A.z, S.z)) f1 = a2;
      else f1 = sSet(F.y, FS.y, P, tw, ang);
    }
    if (F.y >= 0.0 && F.z >= 0.0) {
      if (sSame(F.z, FS.z, F.x, FS.x)) f2 = f0;
      else if (sSame(F.z, FS.z, F.y, FS.y)) f2 = f1;
      else if (sSame(F.z, FS.z, A.x, S.x)) f2 = a0;
      else if (A.y >= 0.0 && sSame(F.z, FS.z, A.y, S.y)) f2 = a1;
      else if (A.y >= 0.0 && A.z >= 0.0 && sSame(F.z, FS.z, A.z, S.z)) f2 = a2;
      else f2 = sSet(F.z, FS.z, P, tw, ang);
    }
    Smp n = sBlend(A, a0, a1, a2, m1, m2), f = sBlend(F, f0, f1, f2, m1, m2), o;
    o.c = (1.0 - fw) * n.c + fw * f.c; o.n = (1.0 - fw) * n.n + fw * f.n;
    return o;
  }
  Smp sMat(int i, vec3 P, vec3 tw, float seaAng, float fw, float slope){
    vec4 A = uSMatA[i]; vec4 S = uSMatS[i]; vec4 M = uSMatM[i];
    // THE BLEND'S DEPTH, A DIAL (PERF 2026-09-23): a type's 2nd and 3rd sets are its dearest pixels (each set hex-tiled,
    // colour + normal, triplanar on a slope: one set per type measured 8-10 ms cheaper at 5120 x 1440). uSNearN 1 =
    // one set everywhere (the lower tiers), uSFarN 1 = one set past the detail fade, where a blotch is a few pixels
    if (uSNearN < 1.5) { A.y = -1.0; A.z = -1.0; }
    Smp o; o.c = vec4(0.5, 0.5, 0.5, 0.5); o.n = vec4(0.0, 0.0, 0.0, 0.8);
    if (A.x < 0.0) return o;
    float ang = A.w > 0.5 ? seaAng : 0.0;
    float period = max(M.x, 0.5) * 6.0, sharp = M.y * 2.0;   // 2x (4x cut the sets into hard blotches once lit in the game)
    float m1 = A.y >= 0.0 ? gfMixK(P.xz, period, 0.52 - M.z, sharp) : 0.0;
    float m2 = A.z >= 0.0 ? gfMixK(P.xz + vec2(101.0, -77.0), period * 1.61, 0.52 - M.w, sharp) : 0.0;
    vec4 F = uSMatF[i], FS = uSMatFS[i];
    if (F.x < 0.0) { F.x = A.x; FS.x = S.x; } if (F.y < 0.0) { F.y = A.y; FS.y = S.y; } if (F.z < 0.0) { F.z = A.z; FS.z = S.z; }
    if (uSFarN < 1.5) { F.y = -1.0; F.z = -1.0; }
    if (fw <= 0.001) o = sTriplet(A, S, P, tw, ang, m1, m2);
    else if (fw >= 0.999) o = sTriplet(F, FS, P, tw, ang, m1, m2);
    else o = sBand(A, S, F, FS, P, tw, ang, m1, m2, fw);
    vec4 V = uSVary[i];
    if (V.y > 0.0 || V.x > 0.0) { vec2 gf = gfShade(P.xz, V.z); o.c.rgb = gfHueTurn(o.c.rgb, gf.x * V.x) * (1.0 + gf.y * V.y); }
    gSRel = gLuma(o.c.rgb) / max(uSLum[int(A.x + 0.5)], 1e-3);   // the texel over its set's mean: the texture alone, no set colour
    if ((i == 3 || i == 7) && uSPud.y > 0.0) {   // the pools: muskeg AND scrub (the user, 2026-09-21: the scrub is the muskeg)
      // A POND IS A SHORE AND A MARGIN, NOT A SPOT (the user, 2026-09-23, from 400 m
      // over the strip: "puddles just look too harsh seen from there. They look like
      // speckles on a surface, not like puddles"). Two reasons it read as a speckle:
      //   THE SHORE WAS UNDER A PIXEL. pudEdge is 0.01 noise units = 1.33 m of ground,
      //   which is right at walking distance and invisible at altitude, so the mask's
      //   0..1 ramp fell inside one pixel and every pond had a hard, aliasing rim.
      //   uSPud2.x widens it with distance (the 0.5 contour is fixed - the ramp is
      //   centred on the threshold - so the pond neither grows nor shrinks).
      //   AND IT HAD NO MARGIN. Real muskeg water sits in a wet hollow: peat-stained
      //   shallows over the bed, then open water. uSPud2.y is where the open water
      //   starts in the mask; under it the ground's own colour goes dark and wet and
      //   KEEPS ITS ROUGHNESS, so only the middle of a pond is a mirror.
      // BOTH RIDE THE SAME DISTANCE TERM, and both are ZERO at the eye: a pond you
      // taxi past keeps the hard shoreline and the open water it has today (which is
      // what it looks like from the bank), and only the pond a kilometre off becomes
      // a soft wet hollow. The complaint was about altitude; the close view was not
      // broken and must not be traded away to fix it.
      float pd = distance(P.xz, cameraPosition.xz);
      float far = clamp(pd / 500.0, 0.0, 1.0);
      float e = uSPud.z * (1.0 + uSPud2.x * far);
      float m = gfPoolAt((P.xz + vec2(uSPud.x)) * uSPud.w, uSPud.y, e);
      // A PUDDLE NEEDS A LEVEL PLACE (2026-09-23, the user: "real puddles would be distributed along
      // terrain depressions ... here you splatter them everywhere"). Measured on Jolene before this:
      // 42 % of the pools stood on ground steeper than 10 degrees, because the field never asked the
      // terrain anything. Full water under half of uSPud2.w degrees, none above it - and the same ramp
      // runs on the CPU in render_world's poolAt, so the tufts and the debris agree with what is drawn.
      if (uSPud2.w > 0.01) m *= clamp((uSPud2.w - gSSlope) / (uSPud2.w * 0.5), 0.0, 1.0);
      float rim = uSPud2.y * far;
      float deep = rim > 0.001 ? smoothstep(rim, 1.0, m) : 1.0;
      o.c.rgb = mix(o.c.rgb, mix(o.c.rgb * uSPud2.z, vec3(0.022, 0.030, 0.034), deep), m);   // still water, linear
      o.n = mix(o.n, vec4(0.0, 0.0, 0.0, 0.03), m * deep);
    }
    return o;
  }
  int sCodeAt(vec2 cellIx){
    vec2 gn = uGGrid.zw / uGCell;
    return min(int(texture2D(uGPackB, (cellIx + 0.5) / gn).g * 255.0 + 0.5), 11);
  }
  // THE SPLAT: macro = the stack's colour (lit by the game's sun after)
  vec3 sSplat(vec3 macro, vec3 nGeo, float canopy, vec2 uv, float sd, float lsd){
    gSN = vec3(0.0); gSRough = 0.9;
    gSPixM = max(length(fwidth(vWPi.xz)), 1e-4);   // here, before any branch: the derivative is the whole quad's
    vec2 xz = vWPi.xz, p = xz;
    float slope = degrees(acos(clamp(nGeo.y, 0.0, 1.0)));
    gSSlope = slope;   // the pools read it in sMat (2026-09-23)
    if (uSSplit2.z > 0.0) { vec2 q = xz / 23.0; p += (vec2(gVnoise(q), gVnoise(q + 77.0)) - 0.5) * 2.0 * uSSplit2.z; }
    float w[${NCODE}]; for (int i = 0; i < uSNCode; i++) w[i] = 0.0;
    vec2 g = (p - uGGrid.xy) / uGCell - 0.5;
    vec2 b = floor(g), f = g - b;
    float R = max(uSSplit2.w, 0.3), wsum = 0.0;
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec2 o = vec2(float(i), float(j));
      float d = length(o - f) / R;
      if (d >= 1.0) continue;
      float k = (1.0 - d) * (1.0 - d);
      w[sCodeAt(b + o)] += k; wsum += k;
    }
    for (int i = 0; i < uSNCode; i++) w[i] /= max(wsum, 1e-4);
    w[4] += w[0]; w[0] = 0.0;
    float lakeM = 0.0;
    if (uSLakeE.y > 0.5) lakeM = smoothstep(-uSLakeE.x * 0.5, uSLakeE.x * 0.5, lsd);
    // a LAKE cell votes as its shore (muskeg, a muddy margin): the ground under and round the water is ground;
    // the bed paint and the surface quad do the water (a voteless cell fell back to the stack's pale blue - the
    // stair-step band round every lake)
    w[3] += w[1]; w[1] = 0.0;
    float sCliff = smoothstep(uSSplit.x, uSSplit.y, slope);
    float sOld   = smoothstep(uSSplit.z, uSSplit.w, canopy);
    float sDense = smoothstep(uSSplit2.x, uSSplit2.y, canopy);
    w[12] = w[6] * sCliff; w[6] *= 1.0 - sCliff;
    w[13] = w[8] * sOld;   w[8] *= 1.0 - sOld;
    w[14] = w[7] * sDense; w[7] *= 1.0 - sDense;
    vec2 e = vec2(1.0 / uGGrid.z, 1.0 / uGGrid.w) * 1.5;
    vec2 gr = vec2(texture2D(uGPackA, uv + vec2(e.x, 0.0)).b - texture2D(uGPackA, uv - vec2(e.x, 0.0)).b,
                   texture2D(uGPackA, uv + vec2(0.0, e.y)).b - texture2D(uGPackA, uv - vec2(0.0, e.y)).b);
    float seaAng = uSBeachRot - atan(gr.x, gr.y);
    float d = distance(vWPi, cameraPosition);
    float fw = smoothstep(uSDist.x, uSDist.y, d);
    float mw = uSDist2.x * smoothstep(uSDist.z, uSDist.w, d);
    vec3 tw = vec3(0.0, 1.0, 0.0);
    if (uSDist2.z > 0.5) { vec3 a = pow(abs(nGeo), vec3(uSDist2.z)); tw = a / (a.x + a.y + a.z); }
    vec4 C[8]; vec4 NN[8]; float Wt[8]; float Rl[8]; int n = 0; float ma = -10.0;
    // NO CONTINUE IN THIS LOOP (PERF 2026-09-23): ANGLE's D3D back end makes a gradient-free copy ('Lod0',
    // SampleLevel 0) of every function that samples a texture when it is called inside a loop holding a break or
    // a continue - the splat's every set was read at MIP 0 at every distance: shimmer, and a texture cache blown
    // on every ground pixel past a few hundred metres. The same test as an if-block keeps the derivatives.
    for (int i = 0; i < uSNCode; i++) {
      if (w[i] >= 0.004 && n < uSNCand) {
        Smp m = sMat(i, vWPi, tw, seaAng, fw, slope);
        C[n] = m.c; NN[n] = m.n; Wt[n] = w[i]; Rl[n] = gSRel; ma = max(ma, m.c.a + w[i]); n++;
      }
    }
    ma -= uSSeam.x;
    vec3 col = vec3(0.0); vec4 nrm = vec4(0.0); float tot = 0.0, rel = 0.0;
    for (int j = 0; j < uSNCand; j++) {
      if (j >= n) break;
      float bb = max(C[j].a + Wt[j] - ma, 0.0);
      col += C[j].rgb * bb; nrm += NN[j] * bb; rel += Rl[j] * bb; tot += bb;
    }
    rel = tot > 1e-5 ? rel / tot : 1.0;
    col = tot > 1e-5 ? col / tot : macro;
    nrm = tot > 1e-5 ? nrm / tot : vec4(0.0, 0.0, 0.0, 0.9);
    gSN = nrm.xyz * uSNrm.x * (1.0 - mw) * (1.0 - lakeM);
    gSRough = mix(clamp(nrm.a, 0.05, 1.0), 1.0, mw);   // the far tier is the lit stack: no sheen out there
    vec3 mac = macro * uSSeam.y;
    // THE MACRO IN THE NEAR GROUND (the user, 2026-09-21: "the whole island looks yellow, while the colour data
    // gives mostly green and brown and there is little macro contrast remaining once the detailed textures show"):
    // 'tinted' was the imagery's HUE at the detail's own brightness - the imagery's light and dark (the
    // green valley, the brown slope, the pale flat) were thrown away. macroLum (uSDist2.w) keeps them: the
    // detail's texel over its set's mean is the texture alone (rel), and mac * rel is the imagery's colour AND
    // brightness wearing that texture. macroNear (uSDist2.y) is still how much of the detail's own colour gives way.
    if (uSDist2.y > 0.0) { float lc = gLuma(col); vec3 tinted = mac * mix(lc / max(gLuma(mac), 1e-3), rel, uSDist2.w); col = mix(col, tinted, uSDist2.y); }
    return mix(col, mac, mw);
  }
`;
  // in the map_fragment block, right after the stack's t (before the water and the shore)
  const glslMap = () => `
  if (uSplatOn > 0.5) t = sSplat(t, gN, can, guv, (gA.b * 255.0 - 128.0) * 4.0, lsd);
`;
  // after normal_fragment_maps: the sets' relief bends the shading normal (view space)
  const glslNormal = () => `
  if (uSplatOn > 0.5) { vec3 pw = (viewMatrix * vec4(gSN, 0.0)).xyz; normal = normalize(normal + pw); }
`;
  // after roughnessmap_fragment (a Standard ring): the sets' roughness, the `sheen` knob its lever
  // (1 = the sets' own, 0 = matte everywhere - the old Lambert look)
  const glslRough = () => `
  if (uSplatOn > 0.5) roughnessFactor = 1.0 - (1.0 - gSRough) * uSNrm.y;
`;

  // ---- the arrays: seventeen sets, assembled once the Images have decoded -----
  // colour + height (rgb + a) and normal + rough (rgb + a): four maps per set
  function buildArrays(sets, U, done) {
    const N = sets.length, px = sets[0].px, S = px * px * 4;
    const data = new Uint8Array(S * N), dataN = new Uint8Array(S * N);
    const cnv = document.createElement('canvas'); cnv.width = cnv.height = px;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    const dec = img => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; }));
    Promise.all(sets.map(async (m, i) => {
      const [d, n, h, r] = [m.diff, m.nor, m.height, m.rough || null];
      await Promise.all([dec(d), dec(n), dec(h), r ? dec(r) : Promise.resolve()]);
      const o = i * S;
      if (d.naturalWidth) { ctx.drawImage(d, 0, 0, px, px); data.set(ctx.getImageData(0, 0, px, px).data, o); }
      if (h.naturalWidth) { ctx.drawImage(h, 0, 0, px, px); const hd = ctx.getImageData(0, 0, px, px).data; for (let k = 0; k < px * px; k++) data[o + k * 4 + 3] = hd[k * 4]; }
      else for (let k = 0; k < px * px; k++) data[o + k * 4 + 3] = 128;
      if (n.naturalWidth) { ctx.drawImage(n, 0, 0, px, px); dataN.set(ctx.getImageData(0, 0, px, px).data, o); }
      else for (let k = 0; k < px * px; k++) { dataN[o + k * 4] = 128; dataN[o + k * 4 + 1] = 128; dataN[o + k * 4 + 2] = 255; }
      // the ROUGH map in the normal array's alpha (2026-09-21: the near ring is a Standard material and
      // reads it at roughnessmap_fragment); a manifest without one - or a map that failed - is 0.9 flat
      if (r && r.naturalWidth) { ctx.drawImage(r, 0, 0, px, px); const rd = ctx.getImageData(0, 0, px, px).data; for (let k = 0; k < px * px; k++) dataN[o + k * 4 + 3] = rd[k * 4]; }
      else for (let k = 0; k < px * px; k++) dataN[o + k * 4 + 3] = 230;
    })).then(() => {
      const mk = (dd, srgb) => { const t = new THREE.DataArrayTexture(dd, px, px, N);
        t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
        // NOT colorSpace = sRGB: an SRGB8_ALPHA8 array upload came back GL_INVALID_VALUE (2026-09-20) - the shader decodes
        t.anisotropy = 8; t.needsUpdate = true; return t; };
      U.uSplat.value = mk(data, true); U.uSplatN.value = mk(dataN, false);
      done();
    });
  }

  // THE MACRO'S EXPOSURE, MEASURED (2026-09-21, the user: "the far colour does not match our close
  // colours ... we should stay within the same luminosity"): the map's albedo is a shaded July
  // image, ~0.035 linear over land where the sets sit at ~0.105 - three times darker. The far
  // tier (the stack) is lifted by the ratio of the sets' mean luminance (weighted by the codes'
  // shares of the land) to the map's, so the far and the near are one luminance by construction.
  function autoExposure(isla, R) {
    try {
      const T = isla.ttype, A = isla.albedo, n = T.length; if (!T || !A) return 1;
      const cnt = new Float64Array(16); let lm = 0, nm = 0;
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      for (let i = 0; i < n; i += 37) { const t = T[i]; if (t < 2) continue; cnt[t]++;
        lm += 0.2126 * lin(A[i * 3]) + 0.7152 * lin(A[i * 3 + 1]) + 0.0722 * lin(A[i * 3 + 2]); nm++; }
      const mean = {}; for (const s of SPLAT_TEX_SETS) mean[s.key] = s.mean;
      let ls = 0, ns = 0;
      for (let c = 2; c < 16; c++) { const row = R.codes[c]; if (!row || !cnt[c]) continue;
        const keys = row.tex.filter(k => k && mean[k]); if (!keys.length) continue;
        const L = keys.reduce((a, k) => a + 0.2126 * mean[k][0] + 0.7152 * mean[k][1] + 0.0722 * mean[k][2], 0) / keys.length;
        ls += L * cnt[c]; ns += cnt[c]; }
      if (!nm || !ns) return 1;
      return Math.min(6, Math.max(1, (ls / ns) / (lm / nm)));
    } catch (e) { return 1; }
  }
  // THE SETS NORMALISED TO THE IMAGERY (2026-09-22, the user: "the whole island looks yellow, while the
  // colour data gives mostly green and brown ... do the per-set albedo normalisation to the imagery").
  // The imagery (isla.albedo, the Landsat composite the stack is built on) is the colour authority:
  // per terrain type its mean linear rgb is measured (forest 0.017/0.030/0.009, heath 0.056/0.064/0.028,
  // scrub 0.041/0.055/0.020 on Jolene - the sets ship at 3-10x that: dry 0.30/0.25/0.12, forestAir
  // 0.13/0.08/0.03). Each set gets one gain per channel so that, over the codes it stands on (weighted
  // by the code's cells and the set's slot in the code's mix: first 0.6, second 0.3, third 0.1), its
  // mean lands on the imagery's. A derived code (cliff / old forest / dense scrub) takes its parent's
  // imagery. Clamped 0.15-2.5. albedoNorm (knob, 0..1) is how far the gain is applied; at 1 the
  // macro's exposure is 1 as well (the imagery as it is - autoExposure lifted it to the OLD sets).
  function normGains(isla, R) {
    const out = {};
    try {
      const T = isla.ttype, A = isla.albedo, n = T.length; if (!T || !A) return out;
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const acc = {};
      for (let i = 0; i < n; i += 7) { const t = T[i]; if (t < 2) continue; const a = acc[t] || (acc[t] = [0, 0, 0, 0]);
        a[0] += lin(A[i * 3]); a[1] += lin(A[i * 3 + 1]); a[2] += lin(A[i * 3 + 2]); a[3]++; }
      const target = {}; for (const k in acc) { const a = acc[k]; target[k] = [a[0] / a[3], a[1] / a[3], a[2] / a[3], a[3]]; }
      // THE WORLD'S MEAN ALBEDO, off the same pass (2026-09-22): the cell-weighted mean of every
      // LAND cell's imagery (t >= 2, the convention above - water and no-data are not the ground the
      // hemisphere's lower half stands for). The hemisphere's ground term is derived from it in
      // render_world, so it is measured ONCE, here, where the raster is already being walked.
      { let r = 0, g = 0, b = 0, n2 = 0; for (const k in acc) { const a = acc[k]; r += a[0]; g += a[1]; b += a[2]; n2 += a[3]; }
        if (n2) R.albedoMean = [r / n2, g / n2, b / n2]; }
      const parent = { 12: 6, 13: 8, 14: 7 };
      const mean = {}; for (const st of SPLAT_TEX_SETS) mean[st.key] = st.mean;
      const num = {}, den = {}, SLOT = [0.6, 0.3, 0.1];
      for (let c = 2; c < 16; c++) {
        const row = R.codes[c]; if (!row) continue;
        const tg = target[parent[c] || c]; if (!tg) continue;
        row.tex.forEach((k, si) => { if (!k || !mean[k]) return;
          const w = tg[3] * SLOT[si]; const N = num[k] || (num[k] = [0, 0, 0]);
          for (let ch = 0; ch < 3; ch++) N[ch] += w * tg[ch] / Math.max(mean[k][ch], 1e-4);
          den[k] = (den[k] || 0) + w; });
      }
      // A MINERAL SET KEEPS ITS HUE (the user, 2026-09-22: "you have coloured the rocks a little too much"):
      // the imagery's rock cells are forested rock (green) and its scree a bright grey - a per-channel
      // gain turned the boulders green-blue. Rock, cliff, shingle, sand, dirt take ONE luminance gain,
      // floored at 0.5 (the muskeg reference shows its boulders pale tan, not dark); the vegetation
      // sets take the imagery's colour.
      // AND `mud` IS A MINERAL SURFACE (2026-09-23, the user on the Jumbo Mine shot: "the rock assets
      // have been fully colored green and they look real bad ... revert at least for this texture").
      // It was left out of the list above and it is the worst offender of all: measured on Jolene its
      // gain is 0.29/0.55/0.29 - the green channel nearly twice the other two, a GREEN PULL OF 1.92,
      // which turns bare peat and dirt the colour of algae. It matters more than any other set because
      // it is the FIRST (0.6 weight) set of muskeg AND scrub and the second of forest, so it is most of
      // the ground the eye sees between the trees. With it on the luminance path the rock-and-dirt
      // surfaces all keep their hue and only the vegetation sets take the imagery's colour, which is
      // what the rule was for.
      // AND A ROCK SET IS NOT NORMALISED AT ALL (2026-09-23, the user, after the luminance gain
      // was not enough: "fix for the rock color not working at all ... restore only the rock
      // texture to its original tone"). One gain kept the hue and still moved the tone - rocksA
      // and rocksB and cliff were all halved (0.50) and rockyB pushed to the clamp (2.50), so the
      // boulders were as dark, or as bright, as the island's mean vegetation asked them to be.
      // The photograph of a rock IS its tone; there is nothing in the imagery that knows better,
      // because at 10 m a pixel the imagery's rock cells are rock WITH TREES ON THEM. So the rock
      // sets take no gain: 1/1/1, the texture as it shipped. The rest of the mineral list (sand,
      // shingle, dirt, peat, snow) keeps the single luminance gain - those surfaces do vary with
      // the place, and the imagery is a fair judge of how light they are.
      // AND THE FOREST FLOOR IS NOT THE CANOPY (2026-09-23, the user, circling the ground under and
      // between the trees round the Jumbo Mine: "that's the rock texture, but used for the forest
      // ground. And this one has become terribly green. That is the one I want restored to original
      // tones ... that's the same terrain going on under the trees"). The set is `forestAir`, and it
      // was the clearest case of all: it SHIPS BROWN - 0.126/0.083/0.026, red highest, blue almost
      // nothing - and the gain 0.15/0.36/0.35 turned it into 0.019/0.030/0.009, GREEN highest and six
      // times darker. THE REASON IS A CONFUSION THE WHOLE NORMALISATION MAKES HERE: the imagery's
      // colour for a forest cell is the CANOPY seen from orbit, and `forestAir` is the GROUND UNDER
      // that canopy - which this game then covers with its own drawn trees. Painting the floor with
      // the canopy's colour and standing the trees on top counts the canopy twice, and what is left
      // showing between the trunks is a green that belongs to the leaves. So the forest floor takes
      // no gain either: it is the photograph's own brown, and the trees over it are the green.
      const ROCK = /^(rocks[A-Z]|rocky[A-Z]|cliff|pebble|forestAir)$/;
      const MINERAL = /^(beach|coast[A-Za-z]*|dirt|mud|snowAir)$/;
      for (const k in num) {
        const g = num[k].map(v => v / den[k]);
        if (ROCK.test(k)) { out[k] = [1, 1, 1]; }   // rock, and the forest floor: the photograph's own tone
        else if (MINERAL.test(k)) { const L = 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2]; const l = Math.min(2.5, Math.max(0.5, L)); out[k] = [l, l, l]; }
        else out[k] = g.map(v => Math.min(2.5, Math.max(0.15, v)));
      }
    } catch (e) {}
    return out;
  }
  function make(gU, isla) {
    if (!G || typeof SPLAT_TEX_SETS === 'undefined' || !SPLAT_TEX_SETS) return null;
    // ?splat=0: the ground without the splat's code at all (a clean A/B, and the compile-time control)
    try { if (/[?&]splat=0/.test(location.search)) return null; } catch (e) {}
    const R = load();
    const BLEND = { from: 0, to: 0 };   // the GRAPHICS row's detail fade (0 = the recipe's), kept over a knob re-apply
    if (R.knobs.albedoNorm === undefined) R.knobs.albedoNorm = RECIPE.knobs.albedoNorm === undefined ? 1 : RECIPE.knobs.albedoNorm;
    R.norm = isla ? normGains(isla, R) : {};
    if (!R.macroExpSaved && isla) { const auto = autoExposure(isla, R); R.knobs.macroExp = +(auto + (1 - auto) * R.knobs.albedoNorm).toFixed(2); }
    if (Object.keys(R.norm).length) console.log('splat: the sets normalised to the imagery (gain r/g/b): ' + Object.keys(R.norm).map(k => k + ' ' + R.norm[k].map(v => v.toFixed(2)).join('/')).join(', '));
    const LIB = SPLAT_TEX_SETS.map(s => s.key);
    const V4 = () => new THREE.Vector4();
    const blank = new THREE.DataArrayTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, 1); blank.needsUpdate = true;
    const blankN = new THREE.DataArrayTexture(new Uint8Array([128, 128, 255, 230]), 1, 1, 1); blankN.needsUpdate = true;
    const U = {
      uSplat: { value: blank }, uSplatN: { value: blankN }, uSplatOn: { value: 0 },
      uSMatA: { value: Array.from({ length: NCODE }, () => new THREE.Vector4(-1, -1, -1, 0)) },
      uSMatS: { value: Array.from({ length: NCODE }, () => new THREE.Vector4(1, 1, 1, 0)) },
      uSMatF: { value: Array.from({ length: NCODE }, () => new THREE.Vector4(-1, -1, -1, 0)) },
      uSMatFS: { value: Array.from({ length: NCODE }, () => new THREE.Vector4(1, 1, 1, 0)) },
      uSMatM: { value: Array.from({ length: NCODE }, () => new THREE.Vector4(30, 1, 0, 0)) },
      uSVary: { value: Array.from({ length: NCODE }, () => new THREE.Vector4(0, 0, 20, 0)) },
      uSGrade: { value: Array.from({ length: NLIB }, () => new THREE.Vector4(1, 1, 1, 1)) },
      uSGloss: { value: new Float32Array(NLIB).fill(1) }, uSLum: { value: new Float32Array(NLIB).fill(0.2) },
      uSGrass: { value: new Float32Array(NLIB).fill(0) }, uSGrassC: { value: V4() },
      uSSplit: { value: V4() }, uSSplit2: { value: V4() }, uSDist: { value: V4() }, uSDist2: { value: V4() }, uSHex: { value: V4() }, uSPud: { value: V4() }, uSPud2: { value: V4() }, uSVeg: { value: V4() },
      uSFarN: { value: 3 }, uSNearN: { value: 3 },   // the blend's depth (sMat): 3 = the recipe's, 1 = one set (the GRAPHICS 'ground' row)
      uSHexPx: { value: 0 },   // the hex cut's dial: 0 = hex everywhere (see sSet)
      uSSeam: { value: new THREE.Vector2() }, uSNrm: { value: new THREE.Vector2() }, uSLakeE: { value: new THREE.Vector2(1, 1) },
      uSBeachRot: { value: 0 }, uSNCode: { value: NCODE }, uSNCand: { value: 8 },
    };
    let ready = false;
    const push = () => {
      const K = R.knobs;
      for (let i = 0; i < NCODE; i++) {
        const m = R.codes[i], A = U.uSMatA.value[i], S = U.uSMatS.value[i], F = U.uSMatF.value[i], FS = U.uSMatFS.value[i], M = U.uSMatM.value[i], Vv = U.uSVary.value[i];
        if (!m) { A.set(-1, -1, -1, 0); continue; }
        const li = k => k ? LIB.indexOf(k) : -1;
        A.set(li(m.tex[0]), li(m.tex[1]), li(m.tex[2]), m.orient === 'sea' ? 1 : 0);
        S.set(m.scale[0] || 1, m.scale[1] || 1, m.scale[2] || 1, 0);
        const far = m.far || [null, null, null], fs = m.farScale || [0, 0, 0];
        F.set(li(far[0]), li(far[1]), li(far[2]), 0); FS.set(fs[0] || 1, fs[1] || 1, fs[2] || 1, 0);
        M.set(m.mix[0], m.mix[1], m.mix[2], m.mix[3]);
        const v = m.vary || [0, 0, 20]; Vv.set(v[0] * Math.PI / 180, v[1], v[2], 0);
      }
      LIB.forEach((k, i) => { const g = R.grade[k] || {}; const c = new THREE.Color(g.gain || '#ffffff');
        const nm = (R.norm && R.norm[k]) || [1, 1, 1], kA = K.albedoNorm === undefined ? 1 : K.albedoNorm;
        c.r *= 1 + (nm[0] - 1) * kA; c.g *= 1 + (nm[1] - 1) * kA; c.b *= 1 + (nm[2] - 1) * kA;   // the normalisation rides on the hand grade
        U.uSGrade.value[i].set(c.r, c.g, c.b, g.sat === undefined ? 1 : g.sat);
        U.uSGloss.value[i] = g.gloss === undefined ? 1 : +g.gloss;
        U.uSGrass.value[i] = g.grass === undefined ? 0 : +g.grass;   // the forest floor's dark texels toward the open grass
        // the set's mean luminance after its grade (the import's linear mean x the gain; the saturation leaves luma alone)
        const mn = (SPLAT_TEX_SETS.find(x => x.key === k) || {}).mean || [0.2, 0.2, 0.2];
        U.uSLum.value[i] = Math.max(1e-3, 0.2126 * mn[0] * c.r + 0.7152 * mn[1] * c.g + 0.0722 * mn[2] * c.b); });
      // THE OPEN GROUND'S GRASS, MEASURED (2026-09-23): the mean of the sets the eye compares the forest
      // floor against - the heath's `grass` and `dry` and the scrub's `grassRock` - each after its own
      // normalisation, so the target moves with the island rather than being a colour someone picked.
      { const kA2 = K.albedoNorm === undefined ? 1 : K.albedoNorm; let gc = [0, 0, 0], gn = 0;
        for (const gk of ['grass', 'grassRock', 'dry']) {
          const mn2 = (SPLAT_TEX_SETS.find(x => x.key === gk) || {}).mean; if (!mn2) continue;
          const g2 = R.grade[gk] || {}, cc = new THREE.Color(g2.gain || '#ffffff');
          const nm2 = (R.norm && R.norm[gk]) || [1, 1, 1], gg = [cc.r, cc.g, cc.b];
          for (let ch = 0; ch < 3; ch++) gc[ch] += mn2[ch] * gg[ch] * (1 + (nm2[ch] - 1) * kA2);
          gn++;
        }
        if (gn) U.uSGrassC.value.set(gc[0] / gn, gc[1] / gn, gc[2] / gn, 1);
      }
      U.uSSplit.value.set(K.cliffLo, K.cliffHi, K.oldLo, K.oldHi);
      U.uSSplit2.value.set(K.denseLo, K.denseHi, K.splatWobble, K.splatBlend);
      U.uSDist.value.set(BLEND.from || K.detailFrom, BLEND.to || K.detailTo, K.macroFrom, K.macroTo);   // the blend row may pull the detail fade in (blend below)
      U.uSDist2.value.set(K.macroMix, K.macroNear, K.triK, K.macroLum === undefined ? 0 : K.macroLum);
      U.uSHex.value.set(K.hDepth, K.hexOn, K.hexN, K.hexRot * Math.PI / 180);
      U.uSSeam.value.set(K.seamDepth, K.macroExp);
      U.uSNrm.value.set(K.nrmK, K.sheen === undefined ? 1 : K.sheen);   // (.y was the bench's specK, unused in the game; the game's lever is `sheen`)
      U.uSPud.value.set(K.pudCell, K.pudCover, K.pudEdge, K.pudSlope);
      // the pond's shore at altitude and where its open water starts (2026-09-23)
      U.uSPud2.value.set(K.pudFar === undefined ? 0 : K.pudFar, K.pudRim === undefined ? 0 : K.pudRim, K.pudWet === undefined ? 0.5 : K.pudWet, K.pudFlat === undefined ? 0 : K.pudFlat);
      U.uSVeg.value.set(K.vegLush === undefined ? 0 : K.vegLush, 0, 0, 0);   // the green INSIDE a texture, per texel (2026-09-23)
      U.uSLakeE.value.set(K.lakeEdge, 1);
      U.uSBeachRot.value = K.beachRot * Math.PI / 180;
      U.uSplatOn.value = (ready && R.on) ? 1 : 0;
    };
    push();
    buildArrays(SPLAT_TEX_SETS, U, () => { ready = true; push(); });
    const api = {
      on: () => !!R.on,
      ready: () => ready,
      library: () => SPLAT_TEX_SETS.map(s => ({ key: s.key, metres: s.metres })),
      names: () => Object.assign({}, G.RECIPE.names),
      knobs: () => Object.assign({}, R.knobs),
      norm: () => Object.assign({}, R.norm || {}),   // the per-set gains the imagery asked for (see normGains)
      albedoMean: () => (R.albedoMean ? R.albedoMean.slice() : null),   // the world's mean LAND albedo, linear rgb (the hemisphere's ground half reads it)
      set: o => { for (const k in o) { if (k === 'on') R.on = o[k] ? 1 : 0; else if (k in R.knobs) R.knobs[k] = +o[k]; } push(); save(R); return api.knobs(); },
      // the sets a type blends and where its near sets give way to the far one (GRAPHICS 'ground blend', PERF 2026-09-23):
      // from / to 0 = the recipe's detailFrom / detailTo. 'lean far' pulls the fade in to 100-400 m: with one far set,
      // the screenshots at 30 / 100 / 300 m showed no difference from the recipe's 150-900 m, and 1-2 ms more came back
      blend: (near, far, from, to) => { U.uSNearN.value = near; U.uSFarN.value = far; BLEND.from = from || 0; BLEND.to = to || 0;
        const K = R.knobs; U.uSDist.value.x = BLEND.from || K.detailFrom; U.uSDist.value.y = BLEND.to || K.detailTo; return [near, far, U.uSDist.value.x, U.uSDist.value.y]; },
      code: i => R.codes[i] ? JSON.parse(JSON.stringify(R.codes[i])) : null,
      setCode: (i, o) => { const c = R.codes[i] || (R.codes[i] = { tex: [null, null, null], scale: [1, 1, 1], far: [null, null, null], farScale: [0, 0, 0], mix: [30, 3, 0, 0], vary: [0, 0, 20] });
        for (const k in o) c[k] = o[k]; push(); save(R); return api.code(i); },
      grade: k => Object.assign({ gain: '#ffffff', sat: 1, gloss: 1 }, R.grade[k] || {}),
      setGrade: (k, o) => { R.grade[k] = Object.assign(api.grade(k), o); push(); save(R); return api.grade(k); },
      reset: () => { try { localStorage.removeItem('flydiy.ground.splat.v1'); } catch (e) {} Object.assign(R, load()); push(); },
      export: () => JSON.stringify({ codes: R.codes, knobs: R.knobs, grade: R.grade }),
    };
    return { uniforms: U, glslCommon: glslCommon(), glslMap: glslMap(), glslNormal: glslNormal(), glslRough: glslRough(), api };
  }
  return { make };
})();
if (typeof window !== 'undefined') window.SPLAT_GROUND = SPLAT_GROUND;
