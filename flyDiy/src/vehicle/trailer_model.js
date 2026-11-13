// ============================================================
// THE LAUNCH TRAILER'S MODEL (TOW-LAUNCH phase 4, 2026-11-12) - the user: "include the modeling of an appropriate
// trailer; professional quality modeling". A hot-dip galvanised TANDEM-AXLE launch trailer, built to the build it
// carries (trailer.js's fit): the frame's rails under the floats (or either side of a hull's keel), the bunks where the
// cradle's pads are, at the bottom's deadrise, the bow stops at the bows, the drawbar as long as the nose needs.
//
//   THE FRAME     two C-channel rails (125 x 50 x 4), C-channel cross members, an A-frame of 100 x 50 box with a
//                 centre tongue (80 x 80) to a cast ball coupling (its lever, its grip), two safety chains drooped to
//                 the ball, a jockey wheel stowed up on its clamp, the lighting cable clipped along the left rail
//   RUNNING GEAR  two rubber-torsion axles (60 x 60 square tube, trailing arms, spindles), four 185R14C tyres on
//                 pressed-steel 5-stud wheels (brake drum, hub cap, wheel nuts), a spare under the rear, tandem
//                 mudguards with a tread top and rubber mud flaps, the axle's U-bracket mounts
//   LIGHTS        a rear light board: two combination lamps (stop/tail red, indicator amber, reverse white), triangle
//                 reflectors, a plate board (blank) and its lamp, amber side reflectors, white front ones
//   THE CRADLE    floats: per float two timber bunks (50 x 140, one plank each) tilted to the float's deadrise on swivel
//                 brackets and posts off saddle plates on the rails; a bow stop post per float (a rubber V-block)
//                 carrying the LATCH (a release hook, its red lever) and the yellow strap to the bow eye - drawn
//                 while the latch is shut. Hull: two bunks under the chines, black keel rollers on the centreline,
//                 one winch post at the bow (the hand winch: drum, gear case, crank) with the latch and strap.
//
// THE COST: one Group of merged meshes, one per material (11), and the wheels as 4 InstancedMesh (tyre, wheel, drum,
// chrome) of 5 instances (4 turning, the spare) - 15-16 draw calls, ~37k triangles (GATE TRAILER's MODEL measures); a
// frame's update: the group's matrix and 4 instance matrices x 4 meshes (~2 us). The materials are MeshStandard -
// they take the scene's environment like every prop - dressed in the game's library and one baked AO map (THE SURFACES,
// below: a 512 x 512 atlas, ~3 s of CPU once a geometry, in the frames' idle time).
//
// Frame: the trailer's (trailer.js): origin on the ground under the axles' centre, +x forward to the ball, +y up,
// +z right. buildTrailerModel(THREE, T [, o]) -> { group, update(T, latched), stats }; buildTowHitch(THREE) -> the
// car's half (the ball mount, for the car's rig at its ball point).
// ============================================================

// ---- THE SURFACES (13 Nov, the user: "give that a bit more love ... more advanced textures and materials ... the planks ...
//      fit every plank to a single plank, not the same for every plank ... bake some ambient occlusion, because it looks very
//      sharp ... reuse the materials that we have everywhere in the game ... a second UV map, so that you can bake the
//      ambient occlusion and multiply with the first one"):
//   THE GAME'S MATERIALS  the house kit's library (src/viewer/house_tex.js HOUSE_TEX_SETS - the buildings', the hangars'):
//                 'galv' (galvanised sheet) on the frame, darker on the running gear; 'steelgrey' (painted steel) on the
//                 wheels and drums; 'deckwood' (tight decking boards) on the bunks. Its texel-density contract: the UVs in
//                 METRES, the texture's repeat 1 / tile - and the very textures the world's houses use when the world pack is
//                 in (its tex(): one texture a set and map, uploaded once). Without the library (node, a bare page) the
//                 plain colours stand, as before.
//   THE PLANKS    each bunk is ONE board of deckwood's twelve (its rows 42.67 px apart, the seams inset 3 px): its top and
//                 bottom span that board's width, its edges a narrow strip of it, its ends another board; the board and its
//                 offset along the grain are each plank's own (a hash of its number) - no two bunks alike.
//   UV0           everything else: a box projection in metres by the face's dominant axis.
//   UV1 + THE AO  a second UV set, an atlas of non-overlapping charts (a part's faces of one dominant axis, connected),
//                 shelf-packed at TRL_AO.dpm px a metre (lowered to hold TRL_AO.budget texels: the car deck ~26); the ambient occlusion BAKED into it on the CPU (renderer-agnostic,
//                 node-testable): per texel TRL_AO.rays cosine-weighted rays against a BVH of the whole trailer (the wheels at
//                 rest) and the ground plane, a falloff over TRL_AO.reach; the empty texels dilated. The wheels' parts are
//                 baked in their own frame (they turn) against themselves. The map is every material's aoMap on channel 1
//                 (three multiplies it into the ambient / environment light; TRL_AO.direct of it on the direct diffuse too,
//                 for the crevices the sun's shadow map is too coarse to see). In a page the bake runs in the frames' idle
//                 time (requestIdleCallback, <= 6 ms slices: ~3 s of CPU on a desktop, the AO arriving a few seconds after the
//                 trailer - a white map until then, no shader change); in node at once. One bake a geometry (a cache by its
//                 positions' hash).
const TRL_AO = { dpm: 40, budget: 32000, pad: 2, rays: 24, reach: 0.6, slice: 6, direct: 0.4 };   // (budget: the texels baked - a bigger trailer bakes coarser, never longer)
const TRL_PLANK = { key: 'deckwood', boards: 12, inset: 3 / 512 };
// ---- THE WEATHERING (13 Nov, the user: "a little weathering on it ... the same system as the planes and the field"):
//   The aeroplanes' system (src/viewer/aeroweather.js) places its layers in the FLOWN CRAFT's space (its shared uCraftInv,
//   its exhaust and wheel sources) - a trailer is its own object, so it takes that system's PIECES and RULES here, in the
//   trailer's own frame, with its own uniforms:
//     the GRUNGE SHEET   aeroWxGrungeTex (r fbm6, g cells14, b fbm12, a fbm2 - linear data) at the planes' tiles (fine
//                        0.35 m, coarse 2.4 m, streaks 0.22 x 2.6 m), projected on the face's dominant axis in metres
//     the COLOURS        AERO_WX_COL's dust, dirt, mud, grime and rust (linear albedo, each with its roughness floor)
//     NO SHINY DIRT      the planes' invariant: under any cover the roughness rises to the layer's floor (>= 0.85) and
//                        the metalness falls with it
//     the GROUND DIRT    the house kit's rule (tools/_house_gen.js uDirtTop / uDirtH / uDirtK): a gradient up from the
//                        ground, broken by the coarse blotch
//   and the trailer's own sources: the MUD each wheel throws (onto what faces it, inside the guards, the flaps, the rails
//   by the tyres - the cells' splatter over a body), the CAVITIES from the baked AO (grime in the crevices, the zinc's
//   white rust in the galvanised corners, rust in the steel wheels' recesses), the RAIN's streaks down the flanks, the
//   wood's silvering on the tops; the tyres and wheels dirtied in their own frame (they turn). Every layer is a CLAMPED
//   SUM of the macros x its gain (as aeroWxResolve's), the macros the trailer's: x AGE, y MUD, z RAIN (TRL_WX.wear: "a
//   little"); window.AEROWX_OFF (the planes' switch) leaves the trailer clean too; without the grunge sheet (node, a
//   page without aeroweather.js) the materials stay as they were. One program patch (its own cache key, 'trl-wx'), the
//   AO's direct share (above) folded in; per material its gains (TRL_WX.mat: dirt, the corrosion kind, the silvering, the
//   saturation - the timber, the deck's and the bunks', at HALF its saturation, the user's "the wood looks a lot harsher").
const TRL_WX = {
  wear: [0.45, 0.35, 0.40],                                     // x AGE, y MUD, z RAIN ("a little")
  tile: [0.35, 2.40, 0.22, 2.60],                               // the planes' tiles (AERO_WX_KNOB fineTile, coarseTile, streakAcross, streakAlong)
  dirt: [0.62, 0.50, 0.55],                                     // the house rule: the top (m), the height it fades over (m), its gain
  col: { dust: [0.100, 0.088, 0.072, 0.88], dirt: [0.130, 0.104, 0.076, 0.90], mud: [0.085, 0.062, 0.040, 0.95],
         grime: [0.070, 0.060, 0.048, 0.92], rust: [0.200, 0.075, 0.030, 0.95], zinc: [0.42, 0.43, 0.42, 0.92] },   // (AERO_WX_COL; zinc: the white rust)
  // per material [dirt gain, corrosion 0 none / 1 zinc / 2 iron, silvering, saturation]
  mat: { galv: [1, 1, 0, 1], galvDk: [1.1, 1, 0, 1], wheel: [0.9, 2, 0, 1], drum: [1, 2, 0, 1], rubber: [0.8, 0, 0, 1], chock: [0.7, 0, 0, 1],
         plank: [0.8, 0, 0.6, 0.5], timber: [0.8, 0, 0.6, 0.5], alu: [0.6, 0, 0, 1], black: [0.7, 0, 0, 1], chrome: [0.35, 0, 0, 1],
         white: [0.5, 0, 0, 1], red: [0.3, 0, 0, 1], amber: [0.3, 0, 0, 1], strap: [0.6, 0, 0, 1], carpet: [0.8, 0, 0, 1] },
};
const TRL_WX_VS_HEAD = '\nvarying vec3 vTrlP;\nvarying vec3 vTrlN;\n';
const TRL_WX_VS_BODY = '\n\tvTrlP = transformed; vTrlN = objectNormal;\n';
const TRL_WX_FS_HEAD = `
varying vec3 vTrlP;
varying vec3 vTrlN;
uniform sampler2D tTrlG;
uniform vec4 uTrlWear;       // x age, y mud, z rain, w on
uniform vec4 uTrlTile;       // fine, coarse, streak across, streak along (m)
uniform vec3 uTrlDirt;       // the house rule: top, height, gain
uniform vec4 uTrlWh[4];      // the wheels: centre (trailer frame), radius
uniform vec4 uTrlMat;        // dirt gain, corrosion, silvering, saturation
uniform vec4 uTrlC[6];       // dust, dirt, mud, grime, rust, zinc: rgb + roughness floor
`;
const TRL_WX_FS_COLOR = `
	float trlCov = 0.0; float trlFloor = 0.85;
	{
		vec3 P = vTrlP; vec3 N = normalize(vTrlN) * (gl_FrontFacing ? 1.0 : -1.0); vec3 aN = abs(N);
		vec2 pl = aN.y > max(aN.x, aN.z) ? P.xz : (aN.x > aN.z ? P.zy : P.xy);
		vec4 gF = texture2D(tTrlG, pl / uTrlTile.x);
		vec4 gC = texture2D(tTrlG, pl / uTrlTile.y + vec2(0.37, 0.61));
		float age = uTrlWear.x, mud = uTrlWear.y, rain = uTrlWear.z, k = uTrlMat.x * uTrlWear.w;
		float ao = 1.0;
#ifdef USE_AOMAP
		ao = texture2D(aoMap, vAoMapUv).r;
#endif
		vec3 c = diffuseColor.rgb;
		float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
		c = mix(vec3(L), c, uTrlMat.w);                                                  // the saturation
		float up = clamp(N.y, 0.0, 1.0);
		c = mix(c, vec3(L * 0.92 + 0.015), clamp(uTrlMat.z * age * up * (0.45 + 0.55 * gC.a), 0.0, 1.0));   // the wood's silvering
		float cov, a;
#ifdef USE_INSTANCING
		// A WHEEL (its own frame, the axle on z): the tread's road dirt and dust, the rim's recesses (brake dust, rust)
		float rr = length(P.xy) / max(0.05, uTrlWh[0].w);
		float tread = smoothstep(0.66, 0.84, rr);
		a = clamp(k * (0.2 * age + 0.4 * mud) * mix(0.35, 1.0, tread) * (0.55 + 0.9 * (gF.r - 0.5)), 0.0, 0.55);
		c = mix(c, uTrlC[1].rgb, a); trlCov = max(trlCov, a);
		a = clamp(k * age * 0.35 * (1.0 - tread) * smoothstep(0.85, 0.4, ao) * (0.5 + gF.b), 0.0, 0.6);
		c = mix(c, uTrlC[3].rgb, a); trlCov = max(trlCov, a);
		if (uTrlMat.y > 1.5) { a = clamp(age * 0.4 * smoothstep(0.8, 0.35, ao) * smoothstep(0.6, 0.85, gF.g), 0.0, 0.35); c = mix(c, uTrlC[4].rgb, a); trlCov = max(trlCov, a); }
#else
		// THE GROUND DIRT (the house rule), broken by the blotch and the mottle
		float hg = clamp((uTrlDirt.x - P.y) / max(0.01, uTrlDirt.y), 0.0, 1.0);
		a = clamp(k * uTrlDirt.z * (0.5 + 0.5 * age + 0.5 * mud) * hg * smoothstep(0.15, 0.75, 0.55 * gC.a + 0.45 * gF.r + 0.35 * hg - 0.15), 0.0, 0.75);
		c = mix(c, uTrlC[1].rgb, a); trlCov = max(trlCov, a);
		// THE DUST on the tops
		a = clamp(k * age * 0.3 * up * up * smoothstep(0.3, 0.8, gF.r * 0.7 + gC.a * 0.5), 0.0, 0.4);
		c = mix(c, uTrlC[0].rgb, a); trlCov = max(trlCov, a);
		// THE WHEELS' MUD: round each tyre, inside its guard, on what faces it - a body and the cells' splatter
		float m = 0.0;
		for (int i = 0; i < 4; i++) {
			vec4 W = uTrlWh[i]; vec2 d = P.xy - W.xy; float r = length(d), dz = abs(P.z - W.z);
			float reach = smoothstep(W.w + 0.5, W.w + 0.02, r) * smoothstep(0.34, 0.1, dz);
			float face = 0.35 + 0.65 * clamp(dot(N.xy, -d / max(r, 1e-3)), 0.0, 1.0);
			m = max(m, reach * face);
		}
		m *= k * mud;
		float spl = smoothstep(1.0 - 0.6 * m, 1.12 - 0.6 * m, gF.g);
		a = clamp(m * 0.5 * (0.6 + 0.8 * gF.b) + spl * min(0.6, 1.2 * m), 0.0, 0.8);
		c = mix(c, uTrlC[2].rgb, a); trlCov = max(trlCov, a);
		// THE CAVITIES (the baked AO): grime in the crevices
		float cav = smoothstep(0.82, 0.38, ao);
		a = clamp(k * age * 0.75 * cav * (0.45 + 0.8 * gF.b), 0.0, 0.7);
		c = mix(c, uTrlC[3].rgb, a); trlCov = max(trlCov, a);
		// THE RAIN: streaks down the flanks, from under every edge
		float vert = 1.0 - smoothstep(0.25, 0.6, aN.y);
		float acr = aN.x > aN.z ? P.z : P.x;
		float st = texture2D(tTrlG, vec2(acr / uTrlTile.z, P.y / uTrlTile.w) + vec2(0.11, 0.53)).b;
		a = clamp(k * rain * 0.5 * vert * smoothstep(0.52, 0.78, st) * (0.5 + 0.5 * cav), 0.0, 0.4);
		c = mix(c, uTrlC[3].rgb, a); trlCov = max(trlCov, a);
		// THE CORROSION: the zinc's white rust in the galvanised corners, rust in the steel's
		if (uTrlMat.y > 0.5) {
			float cs = age * smoothstep(0.85, 0.4, ao) * smoothstep(0.5, 0.8, gF.g * 0.6 + gF.r * 0.6);
			vec4 cc = uTrlMat.y > 1.5 ? uTrlC[4] : uTrlC[5];
			a = clamp(cs * (uTrlMat.y > 1.5 ? 0.6 : 0.45) + rain * vert * 0.15 * smoothstep(0.6, 0.85, st) * cav, 0.0, 0.55);
			c = mix(c, cc.rgb, a); trlCov = max(trlCov, a);
		}
#endif
		diffuseColor.rgb = c;
	}
`;
const TRL_WX_FS_ROUGH = '\n\troughnessFactor = mix( roughnessFactor, max( roughnessFactor, trlFloor ), clamp( trlCov * 1.6, 0.0, 1.0 ) );\n';
const TRL_WX_FS_METAL = '\n\tmetalnessFactor *= 1.0 - clamp( trlCov * 1.6, 0.0, 1.0 );\n';
const TRL_WX_U = new WeakMap();   // THREE -> the shared uniforms (one write reaches every trailer's material)
// the grunge sheet: the planes' (aeroWxGrungeTex) on a page; in node, the same noise (aeroWxGrunge) as a DataTexture when
// aeroweather.js is loaded; otherwise none (the weathering off)
function trlWxGrunge(T) {
  const W = (typeof AEROWX !== 'undefined' && AEROWX) || (typeof globalThis !== 'undefined' && globalThis.AEROWX) || null;
  if (!W || (typeof window !== 'undefined' && window.AEROWX_OFF)) return null;
  if (typeof document !== 'undefined' && W.aeroWxGrungeTex) return W.aeroWxGrungeTex(T);
  if (!W.aeroWxGrunge) return null;
  const S = W.AERO_WX_GRUNGE_PX || 256, t = new T.DataTexture(W.aeroWxGrunge(S), S, S, T.RGBAFormat);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.needsUpdate = true; return t;
}
function trlWxShared(T) {
  if (TRL_WX_U.has(T)) return TRL_WX_U.get(T);
  const g = trlWxGrunge(T); if (!g) return null;
  const C = TRL_WX.col, U = {
    tTrlG: { value: g },
    uTrlWear: { value: new T.Vector4(TRL_WX.wear[0], TRL_WX.wear[1], TRL_WX.wear[2], 1) },
    uTrlTile: { value: new T.Vector4(...TRL_WX.tile) },
    uTrlDirt: { value: new T.Vector3(...TRL_WX.dirt) },
    uTrlC: { value: ['dust', 'dirt', 'mud', 'grime', 'rust', 'zinc'].map(k => new T.Vector4(...C[k])) },
  };
  TRL_WX_U.set(T, U); return U;
}
// the patch: the AO's direct share (always) and the weathering (when the shared uniforms exist); every anchor must hit
// (a renamed three chunk is a loud miss: m.userData.trlWxMiss, GATE TRAILER reads it)
function trlPatch(T, m, key, wheels) {
  const U = trlWxShared(T), gains = TRL_WX.mat[key] || [0.8, 0, 0, 1], own = { uTrlMat: { value: new T.Vector4(...gains) }, uTrlWh: { value: wheels } };
  m.userData.trlWx = !!U; m.userData.trlKey = key;
  m.onBeforeCompile = sh => {
    const miss = [], rep = (src, a, b) => { if (src.indexOf(a) < 0) { miss.push(a); return src; } return src.replace(a, b); };
    let fs = rep(sh.fragmentShader, '#include <aomap_fragment>', '#include <aomap_fragment>\n#ifdef USE_AOMAP\n\treflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, ' + TRL_AO.direct.toFixed(2) + ' );\n#endif');
    if (U) {
      Object.assign(sh.uniforms, U, own);
      sh.vertexShader = rep(rep(sh.vertexShader, '#include <common>', '#include <common>' + TRL_WX_VS_HEAD), '#include <begin_vertex>', '#include <begin_vertex>' + TRL_WX_VS_BODY);
      fs = rep(fs, '#include <common>', '#include <common>' + TRL_WX_FS_HEAD);
      fs = rep(fs, '#include <color_fragment>', '#include <color_fragment>' + TRL_WX_FS_COLOR);
      fs = rep(fs, '#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + TRL_WX_FS_ROUGH);
      fs = rep(fs, '#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>' + TRL_WX_FS_METAL);
    }
    sh.fragmentShader = fs; m.userData.trlWxMiss = miss;
  };
  m.customProgramCacheKey = () => (U ? 'trl-wx' : 'trl-ao-direct');
}
// the trailer's weathering macros, for every trailer at once: trailerWeather({ age, mud, rain }) (0..1 each; omitted keep)
function trailerWeather(T, w) {
  const U = trlWxShared(T); if (!U) return null; const v = U.uTrlWear.value;
  if (w) { if (w.age != null) v.x = +w.age; if (w.mud != null) v.y = +w.mud; if (w.rain != null) v.z = +w.rain; if (w.on != null) v.w = w.on ? 1 : 0; }
  return { age: v.x, mud: v.y, rain: v.z, on: v.w > 0.5 };
}
const trlLib = () => (typeof HOUSE_TEX_SETS !== 'undefined' && HOUSE_TEX_SETS) || null;
const TRL_TEXC = new Map();
function trlTex(T, key, map) {
  const S = trlLib(), set = S && S[key];
  if (!set || !set[map]) return null;
  // the world pack's own cache (tools/_house_gen.js tex: the houses' textures, uploaded once), when it is in this page
  if (typeof tex === 'function') { try { const t = tex(key, map); if (t && t.isTexture) return t; } catch (e) {} }
  const ck = key + '|' + map; if (TRL_TEXC.has(ck)) return TRL_TEXC.get(ck);
  const img = set[map]; if (Array.isArray(img)) return null;
  const t = new T.Texture(img); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
  if (map === 'diff' || map === 'paint') t.colorSpace = T.SRGBColorSpace;
  t.repeat.set(1 / set.tile, 1 / set.tile);
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else if (img.addEventListener) img.addEventListener('load', ok);
  TRL_TEXC.set(ck, t); return t;
}
// a material dressed in a library set: its maps, the set's metalness, a tint (the map x colour)
function trlDress(T, m, key, tint, o) {
  const S = trlLib(), set = S && S[key]; if (!set) return false;
  const d = trlTex(T, key, 'diff'); if (!d) return false;
  m.map = d; m.roughnessMap = trlTex(T, key, 'rough'); const n = trlTex(T, key, 'nor'); if (n) { m.normalMap = n; m.normalScale.set((o && o.nrm) || 1, (o && o.nrm) || 1); }
  m.color.setHex(tint); if (o && o.lift) m.color.multiplyScalar(o.lift);   // (a library map darker than the part: lifted, linear)
  m.metalness = o && o.metal != null ? o.metal : set.metal; m.roughness = o && o.rough != null ? o.rough : 1;
  m.needsUpdate = true; return true;
}
const trlHash = n => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
// a plank's UV0 in its own frame (x across [-w/2, w/2], y [-th, 0], z along [0, L]), before it is placed: board `k` of the set
function trlPlankUV(T, g, w, th, k, off) {
  const S = trlLib(), tile = (S && S[TRL_PLANK.key] && S[TRL_PLANK.key].tile) || 2.2, nB = TRL_PLANK.boards, e = TRL_PLANK.inset;
  const band = (kk, f) => tile * ((1 - (kk + 1) / nB + e) + f * (1 / nB - 2 * e));   // v (metres) at fraction f across board kk
  const P = g.attributes.position.array, n = P.length / 3, uv = new Float32Array(n * 2);
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), nn = new T.Vector3();
  for (let t = 0; t < n; t += 3) {
    a.fromArray(P, t * 3); b.fromArray(P, t * 3 + 3); c.fromArray(P, t * 3 + 6);
    nn.subVectors(b, a).cross(c.clone().sub(a)); const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    for (let i = 0; i < 3; i++) {
      const q = i === 0 ? a : i === 1 ? b : c; let u, v;
      if (ay >= ax && ay >= az) { u = q.z + off; v = band(nn.y > 0 ? k : (k + 5) % nB, (q.x + w / 2) / w); }            // top / bottom
      else if (ax >= az) { u = q.z + off; v = band(k, 0.3 + 0.4 * (q.y + th) / th); }                                   // the edges
      else { u = (q.x + w / 2) * 0.6 + off; v = band((k + 3) % nB, (q.y + th) / th); }                                    // the ends
      uv[(t + i) * 2] = u; uv[(t + i) * 2 + 1] = v;
    }
  }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.userData.uvOwn = true;
  return g;
}
// the face's class by its dominant axis (0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z) and its projection (metres) onto that plane
const trlCls = (nx, ny, nz) => { const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz); return ax >= ay && ax >= az ? (nx >= 0 ? 0 : 1) : ay >= az ? (ny >= 0 ? 2 : 3) : (nz >= 0 ? 4 : 5); };
const trlProj = (c, x, y, z) => c < 2 ? [c === 0 ? -z : z, y] : c < 4 ? [x, c === 2 ? -z : z] : [c === 4 ? x : -x, y];
// UV0 (unless the part carries its own) and the part's CHARTS for UV1: its triangles of one class, connected by shared vertices
function trlCharts(T, g, frame, out) {
  const P = g.attributes.position.array, nT = P.length / 9;
  const cls = new Uint8Array(nT), own = !!g.userData.uvOwn;
  const uv = own ? null : new Float32Array(nT * 6);
  for (let t = 0; t < nT; t++) {
    const o = t * 9, ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2], vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
    const c = trlCls(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); cls[t] = c;
    if (uv) for (let i = 0; i < 3; i++) { const q = trlProj(c, P[o + i * 3], P[o + i * 3 + 1], P[o + i * 3 + 2]); uv[t * 6 + i * 2] = q[0]; uv[t * 6 + i * 2 + 1] = q[1]; }
  }
  if (uv) g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  // the vertices welded (0.1 mm), the triangles of one class joined through them
  const key = new Map(), vid = new Int32Array(nT * 3);
  for (let i = 0; i < nT * 3; i++) { const k = Math.round(P[i * 3] * 1e4) + ',' + Math.round(P[i * 3 + 1] * 1e4) + ',' + Math.round(P[i * 3 + 2] * 1e4); let id = key.get(k); if (id === undefined) key.set(k, id = key.size); vid[i] = id; }
  const par = new Int32Array(nT); for (let t = 0; t < nT; t++) par[t] = t;
  const find = t => { while (par[t] !== t) { par[t] = par[par[t]]; t = par[t]; } return t; };
  const seen = new Map();   // (class, vertex) -> a triangle
  for (let t = 0; t < nT; t++) for (let i = 0; i < 3; i++) { const k = cls[t] * 1e7 + vid[t * 3 + i], s = seen.get(k); if (s === undefined) seen.set(k, t); else { const a = find(s), b = find(t); if (a !== b) par[a] = b; } }
  const groups = new Map(); for (let t = 0; t < nT; t++) { const r = find(t); let L = groups.get(r); if (!L) groups.set(r, L = []); L.push(t); }
  for (const tris of groups.values()) {
    const c = cls[tris[0]], q = new Float32Array(tris.length * 6); let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    tris.forEach((t, j) => { for (let i = 0; i < 3; i++) { const o = t * 9 + i * 3, p = trlProj(c, P[o], P[o + 1], P[o + 2]); q[j * 6 + i * 2] = p[0]; q[j * 6 + i * 2 + 1] = p[1]; u0 = Math.min(u0, p[0]); v0 = Math.min(v0, p[1]); u1 = Math.max(u1, p[0]); v1 = Math.max(v1, p[1]); } });
    let area = 0; for (let j = 0; j < tris.length; j++) { const k = j * 6; area += Math.abs((q[k + 2] - q[k]) * (q[k + 5] - q[k + 1]) - (q[k + 4] - q[k]) * (q[k + 3] - q[k + 1])) / 2; }
    out.push({ g, frame, tris, q, u0, v0, w: u1 - u0, h: v1 - v0, area });
  }
}
// the charts shelf-packed into a W x H atlas (powers of two); each chart's place (x, y in pixels)
function trlPack(charts) {
  const { pad } = TRL_AO;
  // the density: TRL_AO.dpm, lowered so the charts' surface (their triangles' projected area) holds at most TRL_AO.budget
  // texels - the boat trailers keep 40 px/m, the car deck's acres of plank come down to ~26
  const m2 = charts.reduce((s, c) => s + c.area, 0), dpm = Math.min(TRL_AO.dpm, Math.sqrt(TRL_AO.budget / Math.max(1e-6, m2)));
  for (const c of charts) { c.pw = Math.max(1, Math.ceil(c.w * dpm)) + 2 * pad; c.ph = Math.max(1, Math.ceil(c.h * dpm)) + 2 * pad; }
  const area = charts.reduce((s, c) => s + c.pw * c.ph, 0);
  let W = 64; while (W * W < area * 1.25) W *= 2;
  const order = charts.slice().sort((a, b) => b.ph - a.ph || b.pw - a.pw);
  for (;;) {
    let x = 0, y = 0, rowH = 0, fits = true;
    for (const c of order) {
      if (c.pw > W) { fits = false; break; }
      if (x + c.pw > W) { x = 0; y += rowH; rowH = 0; }
      c.x = x; c.y = y; x += c.pw; rowH = Math.max(rowH, c.ph);
    }
    const H0 = y + rowH; let H = 64; while (H < H0) H *= 2;
    if (fits && H <= W * 2) return { W, H, dpm };
    W *= 2;
  }
}
// UV1 written per vertex from the charts (a part's vertices are its charts' - each triangle in exactly one)
function trlWriteUV1(T, charts, W, H, dpm) {
  const { pad } = TRL_AO, per = new Map();
  for (const c of charts) {
    let a = per.get(c.g); if (!a) { a = new Float32Array(c.g.attributes.position.count * 2); per.set(c.g, a); }
    c.tris.forEach((t, j) => { for (let i = 0; i < 3; i++) { const k = (t * 3 + i) * 2;
      a[k] = (c.x + pad + (c.q[j * 6 + i * 2] - c.u0) * dpm) / W; a[k + 1] = (c.y + pad + (c.q[j * 6 + i * 2 + 1] - c.v0) * dpm) / H; } });
  }
  for (const [g, a] of per) g.setAttribute('uv1', new T.BufferAttribute(a, 2));
}
// a BVH over triangles (9 floats each) and an any-hit ray query (the hit's distance, or Infinity)
function trlBVH(tri) {
  const n = tri.length / 9, idx = new Int32Array(n), cen = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { idx[i] = i; for (let a = 0; a < 3; a++) cen[i * 3 + a] = (tri[i * 9 + a] + tri[i * 9 + 3 + a] + tri[i * 9 + 6 + a]) / 3; }
  const cap = 2 * n + 1, bb = new Float32Array(cap * 6), lft = new Int32Array(cap), st = new Int32Array(cap), cnt = new Int32Array(cap); let nn = 0;
  const build = (s, e) => {
    const id = nn++; let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = s; i < e; i++) { const o = idx[i] * 9; for (let v = 0; v < 9; v += 3) { const x = tri[o + v], y = tri[o + v + 1], z = tri[o + v + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; } }
    bb.set([x0, y0, z0, x1, y1, z1], id * 6);
    if (e - s <= 4) { st[id] = s; cnt[id] = e - s; lft[id] = -1; return id; }
    const ex = x1 - x0, ey = y1 - y0, ez = z1 - z0, ax = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const sub = Array.from(idx.subarray(s, e)).sort((p, q) => cen[p * 3 + ax] - cen[q * 3 + ax]); idx.set(sub, s);
    const m = (s + e) >> 1; cnt[id] = 0; lft[id] = build(s, m); st[id] = build(m, e); return id;
  };
  build(0, n);
  const stack = new Int32Array(128);
  return function hit(ox, oy, oz, dx, dy, dz, tmax) {
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz; let sp = 0; stack[sp++] = 0;
    while (sp) {
      const id = stack[--sp], b = id * 6;
      let t0 = (bb[b] - ox) * ix, t1 = (bb[b + 3] - ox) * ix; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
      let u0 = (bb[b + 1] - oy) * iy, u1 = (bb[b + 4] - oy) * iy; if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
      if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1;
      let w0 = (bb[b + 2] - oz) * iz, w1 = (bb[b + 5] - oz) * iz; if (w0 > w1) { const q = w0; w0 = w1; w1 = q; }
      if (w0 > t0) t0 = w0; if (w1 < t1) t1 = w1;
      if (t1 < 0 || t0 > t1 || t0 > tmax) continue;
      if (lft[id] >= 0) { stack[sp++] = lft[id]; stack[sp++] = st[id]; continue; }
      for (let i = st[id], e = st[id] + cnt[id]; i < e; i++) {
        const o = idx[i] * 9, ax = tri[o], ay = tri[o + 1], az = tri[o + 2];
        const e1x = tri[o + 3] - ax, e1y = tri[o + 4] - ay, e1z = tri[o + 5] - az, e2x = tri[o + 6] - ax, e2y = tri[o + 7] - ay, e2z = tri[o + 8] - az;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-12 && det < 1e-12) continue;
        const inv = 1 / det, sx = ox - ax, sy = oy - ay, sz = oz - az, u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t > 1e-4 && t < tmax) return t;
      }
    }
    return Infinity;
  };
}
// the texels to bake: each chart's triangles rasterised in the atlas - a texel's point (its frame's) and its face's normal
function trlTexels(charts, W, H) {
  const out = { pos: [], nor: [], frame: [], at: [] }, own = new Int32Array(W * H).fill(-1);
  for (const c of charts) {
    const P = c.g.attributes.position.array, U = c.g.attributes.uv1.array;
    for (const t of c.tris) {
      const o = t * 9, k = t * 6;
      const x0 = U[k] * W, y0 = U[k + 1] * H, x1 = U[k + 2] * W, y1 = U[k + 3] * H, x2 = U[k + 4] * W, y2 = U[k + 5] * H;
      const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(d) < 1e-9) continue;
      const ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2], vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      for (let j = Math.max(0, Math.floor(Math.min(y0, y1, y2))); j <= Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2))); j++)
        for (let i = Math.max(0, Math.floor(Math.min(x0, x1, x2))); i <= Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2))); i++) {
          const px = i + 0.5, py = j + 0.5;
          const a = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d, b = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d, g = 1 - a - b;
          if (a < -1e-4 || b < -1e-4 || g < -1e-4 || own[j * W + i] >= 0) continue;
          own[j * W + i] = out.at.length; out.at.push(j * W + i); out.frame.push(c.frame);
          out.pos.push(a * P[o] + b * P[o + 3] + g * P[o + 6], a * P[o + 1] + b * P[o + 4] + g * P[o + 7], a * P[o + 2] + b * P[o + 5] + g * P[o + 8]);
          out.nor.push(nx, ny, nz);
        }
    }
  }
  return out;
}
// the bake: a slice of texels [i0, i1) into `ao` (0..1, per texel); the rays a Hammersley set, cosine-weighted, turned per texel
function trlBakeSlice(X, hits, ao, i0, i1) {
  const { rays, reach } = TRL_AO, K = rays;
  for (let i = i0; i < i1; i++) {
    const nx = X.nor[i * 3], ny = X.nor[i * 3 + 1], nz = X.nor[i * 3 + 2], fr = X.frame[i], hit = hits[fr];
    const ox = X.pos[i * 3] + nx * 0.002, oy = X.pos[i * 3 + 1] + ny * 0.002, oz = X.pos[i * 3 + 2] + nz * 0.002;
    // a tangent basis, turned by the texel's own angle (no banding)
    let tx, ty, tz; if (Math.abs(nx) < 0.9) { tx = 0; ty = nz; tz = -ny; } else { tx = -nz; ty = 0; tz = nx; }
    let tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx, rot = (trlHash(i) / 4294967296) * Math.PI * 2;
    let occ = 0;
    for (let k = 0; k < K; k++) {
      let r = k, inv = 0, f = 0.5; while (r) { if (r & 1) inv += f; r >>= 1; f *= 0.5; }   // the radical inverse (base 2)
      const u = (k + 0.5) / K, s = Math.sqrt(inv), ph = 2 * Math.PI * u + rot, cz = Math.sqrt(1 - inv);
      const lx = Math.cos(ph) * s, ly = Math.sin(ph) * s;
      const dx = tx * lx + bx * ly + nx * cz, dy = ty * lx + by * ly + ny * cz, dz = tz * lx + bz * ly + nz * cz;
      let t = hit(ox, oy, oz, dx, dy, dz, reach);
      if (fr === 0 && dy < -1e-6) { const tg = -oy / dy; if (tg < t) t = tg; }   // the ground under the trailer (its frame: y = 0)
      if (t < reach) occ += 1 - t / reach;
    }
    ao[i] = 1 - occ / K;
  }
}
const TRL_AO_CACHE = new Map();
// the whole pass: charts, UV1, the bake (now, or in slices), the map. `parts`: [{ geoms, frame }], frame 0 the trailer's (with
// the ground), 1 the wheel's own; `occl`: per frame, Float32Array triangles (9 floats each) the rays may hit
function trlAO(T, parts, occl, o) {
  const t0 = Date.now(), charts = [];
  for (const p of parts) for (const g of p.geoms) trlCharts(T, g, p.frame, charts);
  const { W, H, dpm } = trlPack(charts); trlWriteUV1(T, charts, W, H, dpm);
  const data = new Uint8Array(W * H * 4).fill(255);
  const map = new T.DataTexture(data, W, H, T.RGBAFormat); map.channel = 1; map.flipY = false;
  map.magFilter = T.LinearFilter; map.minFilter = T.LinearFilter; map.generateMipmaps = false; map.needsUpdate = true;
  const stats = { W, H, dpm: +dpm.toFixed(1), charts: charts.length, texels: 0, rays: TRL_AO.rays, ms: 0, done: false, mean: 1 };
  // the cache: the same geometry (its positions' hash) bakes once
  let h = 0x811c9dc5; for (const p of parts) for (const g of p.geoms) { const A = g.attributes.position.array; for (let i = 0; i < A.length; i += 7) h = Math.imul(h ^ ((A[i] * 1e4) | 0), 16777619) >>> 0; }
  const ck = h + ':' + W + 'x' + H;
  const finish = (bytes, X, ao) => {
    if (!bytes) {
      // the texels' values, then the empty ones dilated from their neighbours (the charts' padding: no seam under bilinear)
      const val = new Float32Array(W * H).fill(-1); for (let i = 0; i < X.at.length; i++) val[X.at[i]] = ao[i];
      for (let pass = 0; pass < TRL_AO.pad + 2; pass++) {
        const nv = val.slice();
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (val[j * W + i] >= 0) continue; let s = 0, n = 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const v = val[jj * W + ii]; if (v >= 0) { s += v; n++; } }
          if (n) nv[j * W + i] = s / n; }
        val.set(nv);
      }
      bytes = new Uint8Array(W * H); let sum = 0;
      for (let i = 0; i < W * H; i++) { const v = val[i] < 0 ? 1 : val[i]; bytes[i] = Math.round(Math.max(0, Math.min(1, v)) * 255); }
      for (let i = 0; i < X.at.length; i++) sum += ao[i]; stats.mean = X.at.length ? sum / X.at.length : 1;
      TRL_AO_CACHE.set(ck, { bytes, mean: stats.mean, texels: X.at.length });
    }
    for (let i = 0; i < W * H; i++) { const v = bytes[i]; data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; }
    map.needsUpdate = true; stats.done = true; stats.ms = Date.now() - t0;
    if (o.onAO) o.onAO(stats);
  };
  const hit0 = TRL_AO_CACHE.get(ck);
  if (o.ao === false) { stats.done = true; return { map, stats }; }
  if (hit0) { stats.texels = hit0.texels; stats.mean = hit0.mean; stats.cached = true; finish(hit0.bytes); return { map, stats }; }
  const X = trlTexels(charts, W, H), ao = new Float32Array(X.at.length); stats.texels = X.at.length;
  const hits = occl.map(tri => (tri && tri.length ? trlBVH(tri) : () => Infinity));
  const async = o.ao !== 'sync' && typeof window !== 'undefined' && typeof setTimeout === 'function';
  if (!async) { trlBakeSlice(X, hits, ao, 0, X.at.length); finish(null, X, ao); return { map, stats }; }
  // (the slices in the frames' IDLE time - requestIdleCallback, to its deadline and never past TRL_AO.slice ms - so the bake
  //  costs no frame; where there is none, one setTimeout slice at a time)
  let i = 0;
  const idle = typeof requestIdleCallback === 'function', next = () => (idle ? requestIdleCallback(step, { timeout: 250 }) : setTimeout(step, 16));
  const step = dl => { const te = Date.now() + TRL_AO.slice;
    while (i < X.at.length && Date.now() < te && (!dl || !dl.timeRemaining || dl.didTimeout || dl.timeRemaining() > 1)) { const e = Math.min(X.at.length, i + 32); trlBakeSlice(X, hits, ao, i, e); i = e; }
    if (i < X.at.length) next(); else finish(null, X, ao); };
  next();
  return { map, stats };
}

function buildTrailerModel(THREE, Tr, o) {
  o = o || {};
  const T = THREE, fit = Tr.fit;
  const seg = o.lod === 'low' ? 0.5 : 1;
  const S = n => Math.max(3, Math.round(n * seg));
  // ---- materials ----
  const std = (c, m, r, extra) => new T.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, extra || {}));
  const M = o.materials || {
    galv: std(0xaeb3b8, 0.72, 0.40),          // hot-dip galvanised: a matt silver
    galvDk: std(0x8f959b, 0.70, 0.52),        // the axles, the arms, the brackets (duller, older zinc)
    carpet: std(0x3a414a, 0.0, 0.98),         // (marine carpet: unused since 13 Nov - the bunks are bare planks, M.plank)
    rubber: std(0x18191b, 0.0, 0.88),         // tyres, mud flaps, V-blocks, keel rollers
    wheel: std(0xc8ccd0, 0.55, 0.32),         // the pressed-steel wheels, painted silver
    chrome: std(0xe9ebee, 1.0, 0.16),         // the hub caps, the wheel nuts, the ball
    black: std(0x121314, 0.15, 0.55),         // the lamp housings, the cable, the jockey wheel's tyre, the grips
    red: std(0xa8131b, 0.1, 0.25, { emissive: 0x3a0306 }),
    amber: std(0xd9781a, 0.1, 0.25, { emissive: 0x301302 }),
    white: std(0xf1f1ec, 0.05, 0.45),
    strap: std(0xe2b21c, 0.0, 0.8),          // the latch's webbing strap, the winch strap
    drum: std(0x3d4043, 0.6, 0.6),            // the brake drums (cast iron, painted)
  };
  // (CAR-3: the car deck's own: oiled hardwood planks, the ramps' extruded aluminium)
  if (!M.timber) M.timber = std(0x6f4a2c, 0.0, 0.78);
  if (!M.alu) M.alu = std(0xc9ced3, 0.85, 0.3);
  // (13 Nov: the wheel chocks' moulded rubber - the library's coarse concrete for its grain, its normal and roughness only)
  if (!M.chock) { M.chock = std(0x26272a, 0.0, 1.0); const n = trlTex(T, 'concretec', 'nor'), r = trlTex(T, 'concretec', 'rough');
    if (n) { M.chock.normalMap = n; M.chock.normalScale.set(0.5, 0.5); } if (r) M.chock.roughnessMap = r; }
  // the bunks' planks (13 Nov: bare timber boards, the user's "planks"), and the game's library on what it suits (above)
  if (!M.plank) M.plank = std(0x8a5a32, 0.0, 0.85);
  if (!o.materials) {
    // (the galv map is a roof's, mean 0.17 linear: hot-dip galvanising is a bright matt silver - the map lifted x2.6 (x1.9 the
    //  older, duller zinc of the running gear), metalness 0.7, roughness ~0.7 over the map's 0.51)
    trlDress(T, M.galv, 'galv', 0xffffff, { lift: 2.6, metal: 0.7, rough: 1.4 });
    trlDress(T, M.galvDk, 'galv', 0xf4f6f8, { lift: 1.9, metal: 0.65, rough: 1.6 });
    trlDress(T, M.wheel, 'steelgrey', 0xd6d9dc, { metal: 0.55, rough: 0.8 });
    trlDress(T, M.drum, 'steelgrey', 0x55595d, { metal: 0.6, rough: 1 });
    trlDress(T, M.plank, TRL_PLANK.key, 0xf2e6d8, { metal: 0, rough: 1, nrm: 1.2 });
    trlDress(T, M.timber, TRL_PLANK.key, 0xc9b39c, { metal: 0, rough: 0.85, nrm: 1.1 });   // (the car deck's oiled hardwood: the same boards, darker)
  }
  let plankN = 0;
  const bins = new Map();   // material -> [geometries, in the trailer's frame]
  const put = (mat, g) => { if (!bins.has(mat)) bins.set(mat, []); bins.get(mat).push(g); return g; };
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  // ---- profiles (2D shapes in the member's cross-section: x across, y up) ----
  function rrect(w, h, r) {   // a rounded rectangle centred on 0
    const s = new T.Shape(), x0 = -w / 2, y0 = -h / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x0 + w, y0 + h - r); s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x0 + r, y0 + h); s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function chan(h, b, t, open) {   // a C channel h tall, b flanges, t thick; open toward +x (open = 1) or -x (-1)
    const s = new T.Shape(), k = open || 1, ri = t * 0.8;
    const P = [[0, -h / 2], [b, -h / 2], [b, -h / 2 + t], [t + ri, -h / 2 + t], [t, -h / 2 + t + ri], [t, h / 2 - t - ri], [t + ri, h / 2 - t], [b, h / 2 - t], [b, h / 2], [0, h / 2]];
    P.forEach(([x, y], i) => { const X = k * (x - b / 2); if (i === 0) s.moveTo(X, y); else s.lineTo(X, y); });
    s.closePath(); return s;
  }
  function angle(a, t) {   // an equal angle a x a x t, the corner at the origin, legs along +x and +y
    const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(a, 0); s.lineTo(a, t); s.lineTo(t * 1.6, t); s.quadraticCurveTo(t, t, t, t * 1.6); s.lineTo(t, a); s.lineTo(0, a); s.closePath(); return s;
  }
  // a member: the profile swept straight from a to b; `up` orients the profile's y
  function member(mat, shape, a, b, up, curveSeg) {
    const d = V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
    const g = new T.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: curveSeg || S(3) });
    const z = d.clone().normalize(), u = V3(...(up || [0, 1, 0]));
    let x = new T.Vector3().crossVectors(u, z); if (x.lengthSq() < 1e-8) x = new T.Vector3().crossVectors(V3(1, 0, 0), z); x.normalize();
    const y = new T.Vector3().crossVectors(z, x);
    const m = new T.Matrix4().makeBasis(x, y, z).setPosition(a[0], a[1], a[2]);
    g.applyMatrix4(m); return put(mat, g);
  }
  const boxAt = (mat, w, h, d, at, rot) => { const g = new T.BoxGeometry(w, h, d); if (rot) g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rot))); g.translate(...at); return put(mat, g); };
  const rbox = (mat, sx, sy, sz, r, at, rotY) => {   // a rounded box: a rounded rect (x by y) extruded over z
    const g = new T.ExtrudeGeometry(rrect(sx, sy, r), { depth: sz, bevelEnabled: false, curveSegments: S(3) }); g.translate(0, 0, -sz / 2);
    if (rotY) g.rotateY(rotY); g.translate(...at); return put(mat, g);
  };
  const cyl = (mat, r0, r1, h, at, axis, n) => {   // axis: 'x' | 'y' | 'z'
    const g = new T.CylinderGeometry(r1, r0, h, n || S(16)); if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(...at); return put(mat, g);
  };
  const tube = (mat, pts, r, n, closed) => put(mat, new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => V3(...p))), n || 48, r, S(6), !!closed));

  // ---- the layout, from the fit ----
  const isF = fit.kind === 'floats', isC = fit.kind === 'car', Ld = fit.Ld, ballY = Tr.ballH ?? 0.48;   // (the coupling at the car's ball height)
  const wheelR = Tr.wheelR, wZ = Tr.wheelZ, ax = Tr.axleDx / 2;
  const railH = 0.125, railB = 0.05, railT = 0.004;
  const railTop = 0.585, railY = railTop - railH / 2;
  const zR = isF ? Math.max(...fit.floats.map(f => Math.abs(f.z))) : Math.max(0.45, Math.min(0.55, wZ - 0.42));
  // CAR-3 (the user, 13 Nov: "the tow's trailer, adapted for cars (with a foldable ramp), with the roadster on the
  // trailer"): fit.kind 'car' - fit.car { xR, xF (the carried car's rear and front axles, the trailer's x), track
  // (trackF / trackR when the axles differ),
  // tyreR, tyreW, x0, x1 (its tail and nose) }. The deck stands over the trailer's own guards; the pads are the deck's ends
  const C = isC ? fit.car : null;
  // (the deck over the mudguards: the outriggers' 115 mm under the deck clear the guards' tread top, 2 R + 63 mm, by 10 mm -
  //  13 Nov, the user: "why did you remove the metal arch from the flatbed? It was looking good")
  const deckY = isC ? Math.max(railTop + 0.12, 2 * wheelR + 0.13, 2 * wheelR + 0.063 + 0.115 + 0.01) : 0;
  const pads = isC ? [{ kind: 'deck', at: [Math.min(C.x0, C.xR - C.tyreR) - 0.15, deckY, 0] }, { kind: 'deck', at: [Math.max(C.x1 - 0.2, C.xF + C.tyreR) + 0.05, deckY, 0] }] : fit.pads;
  const keelOf = side => pads.filter(p => p.kind === 'keel' && p.float === side).sort((a, b) => b.at[0] - a.at[0]);
  // the bows: the float's (the hull's) most forward keel station, the trailer's frame
  const bows = isC ? [{ z: 0, x: C.x1, y: deckY + 0.3, B: 1, beta: 0, side: 0 }]
             : isF ? fit.floats.map(f => { const k = f.keel.slice().sort((a, b) => b[0] - a[0])[0]; return { z: f.z, x: k[0], y: k[1], B: f.B, beta: f.beta, side: f.side }; })
                   : [(k => ({ z: 0, x: k[0], y: k[1], B: fit.hull.B, beta: fit.hull.beta, side: 0 }))(fit.hull.keel.slice().sort((a, b) => b[0] - a[0])[0])];
  const xBow = Math.max(...bows.map(b => b.x));
  const xPadMin = Math.min(...pads.map(p => p.at[0])), xPadMax = Math.max(...pads.map(p => p.at[0]));
  const xRear = Math.min(-(ax + wheelR + 0.32), xPadMin - 0.42);
  const xFront = Math.max(xBow + 0.10, xPadMax + 0.45, ax + wheelR + 0.4);
  const xC = Ld - 0.40;   // the coupler's socket: the A-frame's apex
  const stations = [];    // the cross members' x (and what stands on them)

  // ---- THE FRAME ----
  for (const s of [-1, 1]) member(M.galv, chan(railH, railB, railT, -s), [xRear, railY, s * zR], [xFront, railY, s * zR]);   // the rails, open inward
  // the rails' ends: black plastic caps on the C's (the rear), the A-frame's ends welded
  const cross = (x, mat) => { stations.push(x); member(mat || M.galv, chan(0.1, 0.05, 0.004, 1), [x, railY, -zR + railB / 2], [x, railY, zR - railB / 2], [0, 1, 0]); };
  cross(xRear + 0.03); cross(xFront - 0.03); cross(0);
  if (xFront - 0.03 - ax > 1.2) cross((xFront + ax) / 2);
  if (-ax - (xRear + 0.03) > 0.9) cross((xRear - ax) / 2);
  // the A-frame: two 100 x 50 boxes from the front corners to the socket, the centre tongue 80 x 80
  const aY = railY;
  for (const s of [-1, 1]) member(M.galv, rrect(0.05, 0.1, 0.005), [xFront - 0.05, aY, s * (zR - 0.02)], [xC + 0.02, aY, s * 0.055]);
  member(M.galv, rrect(0.08, 0.08, 0.006), [xFront - 0.06, aY, 0], [xC + 0.03, aY, 0]);
  // gusset plates where the A-frame meets the front cross member
  // (the triangle in the corner between the cross member and the A-frame member, on the top flanges: forward and inward)
  for (const s of [-1, 1]) { const g = new T.Shape(); g.moveTo(0, 0); g.lineTo(0.26, 0); g.lineTo(0, -0.26 * s); g.closePath();
    const G = new T.ExtrudeGeometry(g, { depth: 0.006, bevelEnabled: false }); G.rotateX(Math.PI / 2); G.translate(xFront - 0.03, railTop + 0.006, s * (zR - 0.04)); put(M.galv, G); }
  // THE COUPLING (a cast ball coupling, the kind every light trailer carries): its housing drawn from a side profile - the
  // socket round the tongue's end, the neck rising to the head, the dome over the ball, the nose rounding down in front
  // of it - extruded 0.09 wide with a bevel; the lever along its top, hinged at the head, its black grip at the back;
  // the lock's button; the breakaway cable's ring under the socket
  { const sp = new T.Shape(), x0 = xC - Ld, yb = aY - ballY;   // (the profile about the ball's centre: x along, y up)
    sp.moveTo(x0 - 0.03, yb - 0.045); sp.lineTo(x0 + 0.2, yb - 0.045); sp.quadraticCurveTo(-0.07, -0.045, -0.05, -0.02);
    sp.lineTo(-0.035, -0.012); sp.absarc(0, 0, 0.036, Math.PI * 0.82, Math.PI * 0.18, true);   // (the cup round the ball's top)
    sp.lineTo(0.05, -0.012); sp.quadraticCurveTo(0.065, -0.01, 0.066, 0.01);
    sp.quadraticCurveTo(0.068, 0.07, 0.0, 0.074); sp.quadraticCurveTo(-0.06, 0.076, -0.1, 0.055);
    sp.quadraticCurveTo(-0.16, yb + 0.05, x0 + 0.2, yb + 0.045); sp.lineTo(x0 - 0.03, yb + 0.045); sp.closePath();
    const hg = new T.ExtrudeGeometry(sp, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: S(8) });
    hg.translate(Ld, ballY, -0.035); put(M.galv, hg);
    // the lever: hinged at the head's top, along the housing to its grip
    const lev = []; for (let i = 0; i <= 12; i++) { const u = i / 12; lev.push([Ld - 0.005 - 0.27 * u, ballY + 0.088 + 0.012 * Math.sin(u * Math.PI) - 0.03 * u * u, 0]); }
    tube(M.galvDk, lev, 0.011, 24); tube(M.black, lev.slice(8), 0.016, 12);
    cyl(M.galvDk, 0.013, 0.013, 0.095, [Ld - 0.005, ballY + 0.085, 0], 'z', S(10));   // the hinge pin
    cyl(M.chrome, 0.008, 0.008, 0.02, [Ld - 0.12, ballY + 0.06, 0.045], 'z', S(8));    // the lock's button
    const ring = new T.TorusGeometry(0.02, 0.004, S(6), S(14)); ring.rotateY(Math.PI / 2); ring.translate(xC + 0.06, aY - 0.06, -0.05); put(M.chrome, ring); }
  // THE SAFETY CHAINS: from eyes on the A-frame either side, drooped and crossed under the coupling to the ball's mount
  for (const s of [-1, 1]) {
    const a = [xC - 0.08, aY - 0.03, s * 0.09], b = [Ld + 0.05, ballY - 0.07, -s * 0.03];
    const n = 16, L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, sag = 0.11 * 4 * u * (1 - u);
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - sag, z = a[2] + (b[2] - a[2]) * u;
      const link = new T.TorusGeometry(0.011, 0.0028, S(5), S(10)); link.scale(1.55, 1, 1);
      if (i % 2) link.rotateX(Math.PI / 2);
      const dir = V3(b[0] - a[0], -0.4 * Math.cos(u * Math.PI) * 0.11 * 4 / Math.max(0.3, L) * L, b[2] - a[2]).normalize();
      link.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(V3(1, 0, 0), dir)));
      link.translate(x, y, z); put(M.galvDk, link);
    }
    cyl(M.galv, 0.012, 0.012, 0.03, [a[0], a[1] - 0.005, a[2]], 'z', S(8));   // the eye
  }
  // THE JOCKEY WHEEL (stowed up): the clamp on the right A-frame member, the tube, the crank, the wheel in its fork
  { const u = 0.62, jx = xFront + (xC - xFront) * u, jz = (zR - 0.02) + (0.055 - (zR - 0.02)) * u + 0.075;
    rbox(M.galvDk, 0.08, 0.11, 0.08, 0.006, [jx, aY, jz - 0.0], 0);
    cyl(M.galv, 0.024, 0.024, 0.62, [jx, aY + 0.08, jz], 'y', S(14));
    cyl(M.galv, 0.019, 0.019, 0.2, [jx, aY + 0.4, jz], 'y', S(12));
    const crank = [[jx, aY + 0.5, jz], [jx + 0.02, aY + 0.52, jz], [jx + 0.14, aY + 0.52, jz], [jx + 0.15, aY + 0.56, jz]];
    tube(M.galv, crank, 0.007, 16); cyl(M.black, 0.012, 0.012, 0.07, [jx + 0.15, aY + 0.6, jz], 'y', S(10));
    const wy = aY - 0.22;   // stowed: the wheel's bottom 0.2 m off the ground
    for (const s of [-1, 1]) boxAt(M.galv, 0.03, 0.12, 0.006, [jx, wy + 0.05, jz + s * 0.035]);
    const jt = new T.TorusGeometry(0.075, 0.022, S(8), S(18)); jt.translate(jx, wy, jz); put(M.black, jt);
    cyl(M.wheel, 0.055, 0.055, 0.05, [jx, wy, jz], 'z', S(14)); }
  // THE CABLE: from the plug by the coupling, along the left A-frame member and rail, to the light board; its clips
  { const zc = -(zR - 0.035), y0 = railY + 0.035;
    const pts = [[xC - 0.02, ballY - 0.06, -0.12], [xC - 0.25, aY + 0.01, -0.12], [xFront, y0, zc], [ax + 0.4, y0, zc], [xRear + 0.12, y0, zc], [xRear + 0.05, y0 - 0.05, -(wZ - 0.05)]];
    tube(M.black, pts, 0.0055, 96);
    cyl(M.black, 0.018, 0.018, 0.07, [xC - 0.02, ballY - 0.08, -0.12], 'y', S(10));   // the 13-pin plug, hung on its holder
    for (const x of [xFront - 0.3, 0.4, -0.6, xRear + 0.3]) boxAt(M.galvDk, 0.012, 0.012, 0.026, [x, y0, zc]); }

  // ---- RUNNING GEAR (the tandem: two rubber-torsion axles under the rails) ----
  const axY = 0.40, armL = 0.17, spX = -0.11;   // the axle tube's centre; the trailing arm's drop to the spindle
  for (const xa of [-ax, ax]) {
    member(M.galvDk, rrect(0.06, 0.06, 0.006), [xa, axY, -(wZ - 0.14)], [xa, axY, wZ - 0.14], [0, 1, 0]);
    for (const s of [-1, 1]) {
      // the U-bracket from the rail's bottom flange to the tube; the trailing arm; the spindle stub
      boxAt(M.galvDk, 0.1, railY - railH / 2 - axY + 0.03, 0.008, [xa, (railY - railH / 2 + axY) / 2, s * zR - s * 0.01]);
      boxAt(M.galvDk, 0.1, railY - railH / 2 - axY + 0.03, 0.008, [xa, (railY - railH / 2 + axY) / 2, s * zR + s * 0.07]);
      // the U-bolts clamping the tube to the bracket, their nuts on the top plate
      const rb = railY - railH / 2;
      for (const dz of [-0.035, 0.035]) {
        const zz = s * zR + s * 0.03 + dz, U = [];
        for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); U.push([xa - Math.cos(a) * 0.036, i === 0 || i === 10 ? rb + 0.004 : axY - Math.sin(a) * 0.036, zz]); }
        U[1][1] = axY; U[9][1] = axY;
        tube(M.galvDk, U, 0.006, 20);
        for (const sx of [-1, 1]) cyl(M.galvDk, 0.011, 0.011, 0.012, [xa + sx * 0.036, rb + 0.01, zz], 'y', 6);
      }
      boxAt(M.galvDk, 0.11, 0.008, 0.13, [xa, rb + 0.004, s * zR + s * 0.03]);
      const a0 = [xa, axY, s * (wZ - 0.15)], a1 = [xa + spX, wheelR, s * (wZ - 0.15)];
      member(M.galvDk, rrect(0.05, 0.03, 0.006), [a0[0], a0[1], a0[2]], [a1[0], a1[1], a1[2]], [0, 0, 1]);
      cyl(M.galvDk, 0.025, 0.025, 0.06, [a1[0], a1[1], s * (wZ - 0.11)], 'z', S(12));
    }
  }
  // THE MUDGUARDS: one tandem guard a side - the arcs over both wheels and the flat between, a rolled lip, a tread top;
  // its stays to the rail; a rubber flap behind the rear wheel
  // (13 Nov, the user: "ensure there's no clipping of the arches through any wheels": the arcs were drawn round the AXLE
  //  TUBES (+-ax) while the wheels ride the trailing arms 0.11 m aft (spX) - the rear tyre came out of its arc and the flap
  //  cut it. Every arc, the tread plate, the flap and the reflector are now on the WHEELS' centres (xwF, xwR). Under the car
  //  deck the guards stay (the user: "it was looking good"): the deck stands over them (deckY) and its outriggers' braces
  //  stop inboard of them over the guards' length)
  const xwF = ax + spX, xwR = -ax + spX, Rf = wheelR + 0.055, gw = 0.27, guardZin = wZ - gw / 2 + 0.01, guardX = [xwR - Rf - 0.06, xwF + Rf + 0.06];
  { 
    const path = (r) => { const P = []; const n = S(14);
      for (let i = 0; i <= n; i++) { const a = -0.25 + (Math.PI / 2 + 0.25) * (i / n); P.push([xwF + Math.cos(a) * r, wheelR + Math.sin(a) * r]); }
      for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (Math.PI / 2 + 0.3) * (i / n); P.push([xwR + Math.cos(a) * r, wheelR + Math.sin(a) * r]); }
      return P; };
    const outer = path(Rf + 0.0035), inner = path(Rf);
    const sh = new T.Shape(); outer.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); inner.slice().reverse().forEach(([x, y]) => sh.lineTo(x, y)); sh.closePath();
    for (const s of [-1, 1]) {
      const g = new T.ExtrudeGeometry(sh, { depth: gw, bevelEnabled: false }); g.translate(0, 0, s > 0 ? wZ - gw / 2 + 0.01 : -(wZ + gw / 2) - 0.01 + 0.0); put(M.galv, g);
      // the rolled outer lip (a tube along the guard's outer edge)
      tube(M.galv, outer.map(([x, y]) => [x, y, s * (wZ + gw / 2 + 0.01)]), 0.006, 64);
      // the tread plate on the flat top, the stays
      boxAt(M.galvDk, 2 * ax + 0.02, 0.004, gw - 0.04, [spX, wheelR + Rf + 0.006, s * (wZ + 0.01)]);
      // its mounting (12 Nov, the user: "your wheel arches are poking through" - the three 30 mm angle stays ran up into
      // the guard's skin and, over the wheels, into the tyres' shoulders): over each wheel a flat bar from the rail's
      // outer face out under the skin, above the tyre and inboard of it; between the tyres, where there is no tyre, one
      // angle stay from the rail's foot up to under the skin
      const yUnder = wheelR + Rf - 0.006, zIn = s * (wZ - gw / 2 + 0.035);
      for (const xw of [xwR, xwF]) boxAt(M.galvDk, 0.04, 0.006, Math.abs(zIn - s * (zR + 0.025)), [xw, yUnder, (zIn + s * (zR + 0.025)) / 2]);
      member(M.galvDk, angle(0.03, 0.003), [spX, railY - railH / 2, s * (zR + 0.025)], [spX, yUnder - 0.035, zIn], [1, 0, 0]);
      // the mud flap
      boxAt(M.rubber, 0.006, 0.26, gw - 0.02, [xwR - Rf - 0.035, 0.215, s * (wZ + 0.01)], [0, 0, -0.08]);
      // the amber side reflector on the guard's front
      boxAt(M.amber, 0.06, 0.03, 0.006, [xwF + Rf * 0.75, wheelR + Rf * 0.62, s * (wZ + gw / 2 + 0.018)]);
    }
  }

  // ---- THE LIGHTS: the rear board, the lamps, the plate, the reflectors ----
  { const yb = railY - 0.02, xb = xRear - 0.025, half = wZ + 0.05;
    member(M.galv, angle(0.05, 0.004), [xb, yb, -half], [xb, yb, half], [0, 1, 0]);
    for (const s of [-1, 1]) {
      const z0 = s * (half - 0.13);
      rbox(M.black, 0.065, 0.11, 0.24, 0.012, [xb - 0.03, yb + 0.06, z0], Math.PI / 2 * 0);   // the housing
      boxAt(M.red, 0.012, 0.045, 0.1, [xb - 0.064, yb + 0.085, z0 - s * 0.05]);              // tail / stop
      boxAt(M.amber, 0.012, 0.045, 0.07, [xb - 0.064, yb + 0.085, z0 + s * 0.045]);          // the indicator
      boxAt(M.white, 0.012, 0.035, 0.05, [xb - 0.064, yb + 0.032, z0 + s * 0.06]);            // reverse
      boxAt(M.red, 0.012, 0.035, 0.12, [xb - 0.064, yb + 0.032, z0 - s * 0.03]);              // fog
      // the triangle reflector under it
      const tri = new T.Shape(); tri.moveTo(-0.075, 0); tri.lineTo(0.075, 0); tri.lineTo(0, 0.13); tri.closePath();
      const tg = new T.ExtrudeGeometry(tri, { depth: 0.008, bevelEnabled: false }); tg.rotateY(-Math.PI / 2); tg.translate(xb - 0.04, yb - 0.17, z0); put(M.red, tg);
      boxAt(M.galvDk, 0.01, 0.12, 0.012, [xb - 0.03, yb - 0.08, z0]);
    }
    // the plate board (blank) and its lamp
    boxAt(M.galvDk, 0.012, 0.15, 0.56, [xb - 0.035, yb - 0.03, 0]);
    boxAt(M.white, 0.004, 0.115, 0.52, [xb - 0.043, yb - 0.03, 0]);
    rbox(M.black, 0.04, 0.025, 0.08, 0.006, [xb - 0.05, yb + 0.06, 0], 0);
    // the front white reflectors on the A-frame's corners
    for (const s of [-1, 1]) boxAt(M.white, 0.006, 0.05, 0.05, [xFront + 0.03, aY, s * (zR + 0.03)]);
  }

  // ---- THE CRADLE ----
  const strapParts = [];
  const bunkPart = (x0, x1, y0, y1, z, tilt, w, len) => {   // a timber bunk (one plank) from x0 to x1, its top at y (the line), tilted about x
    const L = Math.hypot(x1 - x0, y1 - y0), th = 0.05;
    let g = new T.ExtrudeGeometry(rrect(w, th, 0.012), { depth: L, bevelEnabled: false, curveSegments: S(3) });
    g.translate(0, -th / 2, 0); if (g.index) g = g.toNonIndexed();
    // THE PLANK: its own board of the deckwood set and its own offset along the grain (13 Nov)
    const hk = trlHash(++plankN);
    trlPlankUV(T, g, w, th, hk % TRL_PLANK.boards, (hk >>> 8) % 1000 / 1000 * 2.2);
    g.rotateZ(tilt);
    const m = new T.Matrix4().makeBasis(V3(0, 0, -1).applyAxisAngle(V3(0, 1, 0), 0), V3(0, 1, 0), V3(1, 0, 0));
    // (extruded along +z; turned so +z runs along +x, then pitched with the line)
    const pitch = Math.atan2(y1 - y0, x1 - x0);
    g.applyMatrix4(new T.Matrix4().makeRotationY(Math.PI / 2)); g.applyMatrix4(new T.Matrix4().makeRotationZ(pitch));
    g.translate(x0, y0, z); put(M.plank, g); void m; void len;
  };
  // a post from the rail (or a bolster) up to a bunk's bracket, with its swivel plate
  const post = (x, z, yTop, zBase) => {
    const yb = railTop;
    member(M.galv, rrect(0.05, 0.05, 0.005), [x, yb, zBase], [x, yTop - 0.03, z], [1, 0, 0]);
    boxAt(M.galvDk, 0.12, 0.008, 0.07, [x, yTop - 0.026, z]);
    cyl(M.galvDk, 0.012, 0.012, 0.09, [x, yTop - 0.04, z], 'z', S(8));
  };
  const bolster = (x, z0, z1) => member(M.galv, angle(0.06, 0.005), [x, railTop, z0], [x, railTop, z1], [0, 1, 0]);
  const latchAt = (x, y, z, toBow) => {
    // the release hook: its body, its red lever; the strap (drawn while shut) to the bow eye
    rbox(M.galvDk, 0.07, 0.06, 0.05, 0.008, [x, y, z], 0);
    member(M.red, rrect(0.016, 0.016, 0.004), [x + 0.02, y + 0.02, z + 0.03], [x + 0.11, y + 0.09, z + 0.03]);
    const len = Math.hypot(toBow[0] - x, toBow[1] - y, toBow[2] - z);
    const sg = new T.BoxGeometry(len, 0.004, 0.05);
    const dir = V3(toBow[0] - x, toBow[1] - y, toBow[2] - z).normalize();
    sg.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(V3(1, 0, 0), dir)));
    sg.translate((x + toBow[0]) / 2, (y + toBow[1]) / 2, (z + toBow[2]) / 2);
    strapParts.push(sg);
    const eye = new T.TorusGeometry(0.018, 0.004, S(6), S(12)); eye.translate(toBow[0], toBow[1], toBow[2]); put(M.chrome, eye);
  };
  if (isF) {
    for (const f of fit.floats) {
      const K = keelOf(f.side); if (K.length < 2) continue;
      const P1 = K[0].at, P0 = K[K.length - 1].at, b = Math.tan(f.beta * Math.PI / 180), d = f.B * 0.25;
      const yAt = x => P0[1] + (P1[1] - P0[1]) * (x - P0[0]) / ((P1[0] - P0[0]) || 1);
      const xa = P0[0] - 0.32, xb = P1[0] + 0.28;
      for (const s of [-1, 1]) {
        const z = f.z + s * d, lift = d * b;
        bunkPart(xa, xb, yAt(xa) + lift, yAt(xb) + lift, z, -s * Math.atan(b), 0.14);
        for (const x of [P0[0], P1[0]]) post(x, z, yAt(x) + lift - 0.05, f.z + s * 0.025);
      }
      for (const x of [P0[0], P1[0]]) bolster(x, f.z - d - 0.06, f.z + d + 0.06);
      // the bow stop: a post off the front cross member, a rubber V-block at the bow, the latch below it
      const bw = bows.find(q => q.side === f.side), xs = Math.max(bw.x + 0.07, xFront - 0.03), yTop = bw.y + 0.12;
      member(M.galv, rrect(0.06, 0.06, 0.006), [xs, railTop - 0.1, f.z], [xs, yTop, f.z], [1, 0, 0]);
      const vb = new T.Shape(); vb.moveTo(-0.07, 0.06); vb.lineTo(0, 0); vb.lineTo(0.07, 0.06); vb.lineTo(0.07, 0.09); vb.lineTo(0, 0.035); vb.lineTo(-0.07, 0.09); vb.closePath();
      const vg = new T.ExtrudeGeometry(vb, { depth: 0.08, bevelEnabled: false }); vg.rotateY(-Math.PI / 2); vg.rotateX(0); vg.translate(xs - 0.03, yTop - 0.06, f.z); put(M.rubber, vg);
      latchAt(xs - 0.05, bw.y + 0.02, f.z, [bw.x - 0.02, bw.y + 0.07, f.z]);
      member(M.galvDk, angle(0.04, 0.004), [xs - 0.25, railTop, f.z], [xs - 0.02, yTop - 0.15, f.z], [0, 0, 1]);   // its brace
    }
  } else if (isC) {
    // ---- THE CAR DECK: outriggers on posts off the rails at every station, a full deck of hardwood planks along the
    // trailer, galvanised angle along both edges with stake pockets and D-rings, a ladder headboard at the front, moulded
    // rubber chocks fore and aft of the front tyres on their plates (13 Nov: the tyre straps removed), and THE RAMPS: two aluminium ladder ramps hinged at the deck's tail on the car's wheel tracks - folded up for the
    // road (Tr.ramp 'down': lowered to the ground, the loading slope)
    const xd0 = xRear + 0.02, xd1 = xFront - 0.02, half = Math.max(C.track / 2 + C.tyreW / 2 + 0.14, wZ + 0.16), pt = 0.035;
    const yb = deckY - pt;                                     // the outriggers' top
    const st = [xd0 + 0.04, ...stations.filter(x => x > xd0 + 0.2 && x < xd1 - 0.2), xd1 - 0.04];
    for (const x of st) {
      member(M.galv, rrect(0.05, 0.08, 0.005), [x, yb - 0.04, -half], [x, yb - 0.04, half], [0, 1, 0]);
      for (const s of [-1, 1]) {
        member(M.galv, rrect(0.05, 0.05, 0.005), [x, railTop, s * zR], [x, yb - 0.08, s * zR], [1, 0, 0]);
        const zb = x > guardX[0] && x < guardX[1] ? Math.min(guardZin - 0.04, zR + 0.32) : Math.min(half - 0.05, zR + 0.32);   // (inboard of a guard)
        member(M.galvDk, angle(0.03, 0.003), [x, railTop, s * zR], [x, yb - 0.08, s * zb], [1, 0, 0]);
      }
    }
    // the planks: along the trailer, 14 cm wide, 6 mm apart
    const nP = Math.max(4, Math.round((2 * half) / 0.146));
    // (13 Nov, the surfaces: each deck plank ONE board of the plank set, its own board and offset - as the bunks)
    for (let k = 0; k < nP; k++) { const z = -half + (k + 0.5) * (2 * half / nP), w = 2 * half / nP - 0.006;
      let g = new T.ExtrudeGeometry(rrect(w, pt, 0.004), { depth: xd1 - xd0, bevelEnabled: false, curveSegments: S(2) }); g.translate(0, -pt / 2, 0); if (g.index) g = g.toNonIndexed();
      const hk = trlHash(++plankN); trlPlankUV(T, g, w, pt, hk % TRL_PLANK.boards, (hk >>> 8) % 1000 / 1000 * 2.2);
      g.rotateY(Math.PI / 2); g.translate(xd0, deckY, z); put(M.timber, g); }
    // the edges, their stake pockets and the D-rings
    for (const s of [-1, 1]) {
      member(M.galv, angle(0.05, 0.005), [xd0, deckY, s * half], [xd1, deckY, s * half], [0, 1, 0]);
      for (let k = 0; k <= 4; k++) { const x = xd0 + 0.2 + (xd1 - xd0 - 0.4) * k / 4;
        boxAt(M.galvDk, 0.06, 0.08, 0.04, [x, deckY - 0.05, s * (half + 0.02)]);
        const ring = new T.TorusGeometry(0.022, 0.005, S(6), S(12)); ring.rotateY(Math.PI / 2); ring.translate(x, deckY + 0.012, s * (half - 0.04)); put(M.chrome, ring); }
    }
    // the headboard: three posts, two rails, a mesh of flat bars
    { const xh = xd1 - 0.03, hH = 0.5;
      for (const z of [-half + 0.03, 0, half - 0.03]) member(M.galv, rrect(0.05, 0.05, 0.005), [xh, deckY, z], [xh, deckY + hH, z], [1, 0, 0]);
      for (const y of [deckY + 0.2, deckY + hH]) member(M.galv, rrect(0.04, 0.04, 0.004), [xh, y, -half + 0.03], [xh, y, half - 0.03], [0, 1, 0]);
      for (let k = 1; k < 9; k++) { const z = -half + 0.03 + (2 * half - 0.06) * k / 9; boxAt(M.galvDk, 0.006, hH - 0.02, 0.012, [xh, deckY + hH / 2, z]); } }
    // THE WHEEL CHOCKS (13 Nov, the user: "remove the yellow cable, and model the wheel blocks properly with a decent
    // material" - the tyre straps are gone): ahead of and behind each front tyre a moulded rubber chock - its face a concave
    // arc round the tyre (4 mm clear of it), a flat crown, its back a slope with three grip ribs, every edge bevelled - on
    // a galvanised base plate bolted to the deck (four bolt heads); the rubber M.chock (the library's moulded grain)
    const trF = C.trackF || C.track, trR = C.trackR || C.track, plate = 0.006, cW = C.tyreW + 0.03, Rc = C.tyreR + 0.004, hC = Math.min(0.13, C.tyreR * 0.36);
    const chockShape = sx => {
      const yc = C.tyreR - plate, P = [];                       // (the tyre's centre over the plate's top, the chock's frame)
      const xAt = y => sx * Math.sqrt(Math.max(0, Rc * Rc - (yc - y) * (yc - y)));
      for (let i = 0; i <= 8; i++) { const y = hC * i / 8; P.push([xAt(y), y]); }   // the face up the tyre
      const xt = xAt(hC) + sx * 0.035, xb = xAt(0) + sx * 0.21; P.push([xt, hC]);       // the crown
      for (let k = 1; k <= 3; k++) {                                                     // the back's ribs
        const f0 = (k - 0.62) / 3.6, f1 = (k - 0.38) / 3.6, f = (k - 0.5) / 3.6, x0 = xt + (xb - xt) * f0, x1 = xt + (xb - xt) * f1, xm = xt + (xb - xt) * f;
        P.push([x0, hC * (1 - f0)], [xm + sx * 0.008, hC * (1 - f) + 0.012], [x1, hC * (1 - f1)]);
      }
      P.push([xb, 0.004], [xb - sx * 0.006, 0], [xAt(0), 0]);
      const sh = new T.Shape(); P.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath(); return sh;
    };
    for (const s of [-1, 1]) {
      const z = s * trF / 2;
      for (const sx of [-1, 1]) {
        const g = new T.ExtrudeGeometry(chockShape(sx), { depth: cW - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2, curveSegments: S(4) });
        g.translate(C.xF, deckY + plate, z - (cW - 0.012) / 2); put(M.chock, g);
        const xp = C.xF + sx * (Math.sqrt(Math.max(0, Rc * Rc - (C.tyreR - plate) * (C.tyreR - plate))) + 0.11);
        boxAt(M.galvDk, 0.27, plate, cW + 0.07, [xp, deckY + plate / 2, z]);
        for (const dx of [-0.11, 0.11]) for (const dz of [-1, 1]) cyl(M.chrome, 0.009, 0.009, 0.006, [xp + dx, deckY + plate + 0.003, z + dz * (cW / 2 + 0.02)], 'y', 6);
      }
    }
    // THE RAMPS: FOLDING ladders - two sections hinged in the middle, each two side rails with rungs every 8 cm - on the
    // wheel tracks, hinged at the deck's tail. Up for the road: the first section stands up off the hinge, the second
    // folded back down against it (a low tailgate); Tr.ramp 'down': the two in line to the ground, the loading slope
    const rampL = Math.max(1.2, Math.min(2.4, deckY / Math.tan(20 * Math.PI / 180))), rW = Math.max(0.26, C.tyreW + 0.08);
    const down = Tr.ramp === 'down', hx = xd0 - 0.01, hy = deckY;
    const ladder = (p0, p1, z) => {
      for (const sz of [-1, 1]) member(M.alu, rrect(0.035, 0.06, 0.004), [p0[0], p0[1], z + sz * rW / 2], [p1[0], p1[1], z + sz * rW / 2], [0, 0, 1]);
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      for (let t = 0.05; t < L - 0.03; t += 0.08) { const f = t / L; cyl(M.alu, 0.011, 0.011, rW, [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, z], 'z', S(8)); }
    };
    for (const s of [-1, 1]) {
      const z = s * (trF + trR) / 4, h = rampL / 2;
      let A1, B1;
      if (down) { const run = Math.sqrt(Math.max(0.01, rampL * rampL - hy * hy)); A1 = [hx - run / 2, hy / 2]; B1 = [hx - run, 0.01]; ladder([hx, hy], A1, z); ladder(A1, B1, z); }
      else { const lean = 0.10; A1 = [hx - Math.sin(lean) * h, hy + Math.cos(lean) * h]; B1 = [A1[0] - 0.075 + Math.sin(lean) * (h - 0.08), A1[1] - (h - 0.08) * Math.cos(lean)]; ladder([hx, hy], A1, z); ladder([A1[0] - 0.075, A1[1]], B1, z); }
      cyl(M.galvDk, 0.012, 0.012, rW + 0.06, [hx, hy, z], 'z', S(10));                                    // the tail hinge's pin
      cyl(M.galvDk, 0.014, 0.014, rW + 0.05, [down ? A1[0] : A1[0] - 0.037, A1[1], z], 'z', S(10));        // the fold's
      for (const sz of [-1, 1]) boxAt(M.galvDk, 0.06, 0.05, 0.008, [hx + 0.02, hy - 0.02, z + sz * (rW / 2 + 0.03)]);   // its knuckles
    }
  } else {
    const H = fit.hull, b = Math.tan(H.beta * Math.PI / 180);
    // the keel rollers on their brackets, on bolsters across the rails
    for (const kp of keelOf(0)) {
      const x = kp.at[0], yk = kp.at[1];
      bolster(x, -zR, zR);
      const prof = []; for (let i = 0; i <= 8; i++) { const u = i / 8; prof.push(new T.Vector2(0.045 + 0.02 * Math.pow(Math.abs(u - 0.5) * 2, 1.6), (u - 0.5) * 0.16)); }
      const rg = new T.LatheGeometry(prof, S(16)); rg.rotateX(Math.PI / 2); rg.translate(x, yk - 0.05, 0); put(M.rubber, rg);
      for (const s of [-1, 1]) member(M.galv, rrect(0.05, 0.008, 0.002), [x, railTop, s * 0.1], [x, yk - 0.05, s * 0.1], [1, 0, 0]);
      cyl(M.galvDk, 0.01, 0.01, 0.22, [x, yk - 0.05, 0], 'z', S(8));
    }
    // the bunks under the chines
    for (const s of [-1, 1]) {
      const C = pads.filter(p => p.kind === 'chine' && p.float === s).sort((a, b2) => a.at[0] - b2.at[0]); if (C.length < 1) continue;
      const P0 = C[0].at, P1 = C[C.length - 1].at;
      const yAt = x => P0[1] + (P1[1] - P0[1]) * (x - P0[0]) / ((P1[0] - P0[0]) || 1);
      const z = P0[2], xa = P0[0] - 0.4, xb = P1[0] + 0.4;
      bunkPart(xa, xb, yAt(xa), yAt(xb), z, -s * Math.atan(b), 0.14);
      for (const x of [P0[0], P1[0]]) { bolster(x, -zR, zR); post(x, z, yAt(x) - 0.05, s * zR); }
    }
    // the winch post at the bow: its brace, the V-roller, the hand winch (drum, gear case, crank), the latch, the strap
    const bw = bows[0], xs = Math.max(bw.x + 0.1, xFront - 0.03), yTop = bw.y + 0.14;
    member(M.galv, rrect(0.07, 0.07, 0.007), [xs, railTop - 0.1, 0], [xs, yTop, 0], [1, 0, 0]);
    member(M.galvDk, rrect(0.05, 0.05, 0.005), [xs - 0.4, railTop, 0], [xs - 0.02, yTop - 0.2, 0], [0, 0, 1]);
    const vr = []; for (let i = 0; i <= 8; i++) { const u = i / 8; vr.push(new T.Vector2(0.03 + 0.035 * Math.abs(u - 0.5) * 2, (u - 0.5) * 0.14)); }
    const vg = new T.LatheGeometry(vr, S(14)); vg.rotateX(Math.PI / 2); vg.translate(xs - 0.06, yTop - 0.02, 0); put(M.rubber, vg);
    const wy = yTop - 0.24;
    cyl(M.strap, 0.035, 0.035, 0.07, [xs + 0.05, wy, 0], 'z', S(14));                 // the drum, its strap wound
    cyl(M.galv, 0.05, 0.05, 0.004, [xs + 0.05, wy, 0.038], 'z', S(16)); cyl(M.galv, 0.05, 0.05, 0.004, [xs + 0.05, wy, -0.038], 'z', S(16));
    rbox(M.galv, 0.1, 0.12, 0.05, 0.01, [xs + 0.05, wy, 0.07], 0);                     // the gear case
    const crank = [[xs + 0.05, wy, 0.1], [xs + 0.05, wy, 0.13], [xs + 0.05, wy - 0.18, 0.13], [xs + 0.05, wy - 0.18, 0.16]];
    tube(M.galv, crank, 0.008, 16); cyl(M.black, 0.013, 0.013, 0.09, [xs + 0.05, wy - 0.18, 0.2], 'z', S(10));
    latchAt(xs - 0.06, bw.y + 0.03, 0, [bw.x - 0.02, bw.y + 0.08, 0]);
  }

  // a SOLID lathe section from an open polyline (r, y): offset t/2 either side along its normal, the two sides joined
  // into one closed loop - a lathe of it has every face wound outward from the material, whatever side is seen
  function solidSection(line, t) {
    const N = line.map((q, i) => {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      let dr = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dr, dy) || 1; dr /= l; dy /= l;
      return [dy, -dr];   // (the lathe's own outward normal for a segment along (dr, dy))
    });
    const A = line.map((q, i) => new T.Vector2(q[0] + N[i][0] * t / 2, q[1] + N[i][1] * t / 2));
    const B = line.map((q, i) => new T.Vector2(q[0] - N[i][0] * t / 2, q[1] - N[i][1] * t / 2)).reverse();
    return A.concat(B, [A[0].clone()]);
  }
  // ---- THE WHEELS: one wheel's parts (its axis +z, the outer face +z), instanced x 5 ----
  const W = { tyre: [], wheel: [], drum: [], chrome: [] };
  { const r = wheelR, w = 0.185, rr = 0.178, n = S(32);
    // the tyre's section (r, z): bead, sidewall bulge, the shoulder, the tread with three grooves
    const P = [];
    const sec = [[rr, -w * 0.38], [rr + 0.02, -w * 0.46], [0.235, -w * 0.5], [0.262, -w * 0.47], [0.282, -w * 0.4], [0.29, -w * 0.33],
                 [0.292, -w * 0.22], [0.284, -w * 0.21], [0.284, -w * 0.17], [0.292, -w * 0.16], [0.292, -w * 0.03], [0.284, -w * 0.02], [0.284, w * 0.02], [0.292, w * 0.03],
                 [0.292, w * 0.16], [0.284, w * 0.17], [0.284, w * 0.21], [0.292, w * 0.22], [0.29, w * 0.33], [0.282, w * 0.4], [0.262, w * 0.47], [0.235, w * 0.5], [rr + 0.02, w * 0.46], [rr, w * 0.38]];
    for (const [R, Z] of sec) P.push(new T.Vector2(R * r / 0.292, Z));
    const tg = new T.LatheGeometry(P, n); tg.rotateX(Math.PI / 2); W.tyre.push(tg);
    // the pressed-steel wheel: the rim's flanges and well, the dished disc, its vent holes (dark), five studs' nuts
    const rim = [[rr - 0.004, w * 0.36], [rr + 0.012, w * 0.38], [rr + 0.008, w * 0.33], [rr - 0.006, w * 0.3], [rr - 0.02, w * 0.12], [rr - 0.02, -w * 0.12], [rr - 0.006, -w * 0.3], [rr + 0.008, -w * 0.33], [rr + 0.012, -w * 0.38], [rr - 0.004, -w * 0.36]];
    // (12 Nov, the user: "a normal flip issue on the walls of your rims": the rim and the disc were single sheets - their
    //  back faces, the rim's well and the flanges' inner walls, were culled: the wheel was see-through between the disc and
    //  the bead. Each is now a SOLID section 4 mm thick, its two faces wound outward from the metal)
    const rg = new T.LatheGeometry(solidSection(rim.map(([R, Z]) => [R, Z]).reverse(), 0.004), n); rg.rotateX(Math.PI / 2); W.wheel.push(rg);
    const disc = [[0.035, 0.035], [0.06, 0.036], [0.085, 0.03], [0.12, 0.012], [0.15, 0.0], [rr - 0.02, -0.01]];
    const dg = new T.LatheGeometry(solidSection(disc, 0.004), n); dg.rotateX(Math.PI / 2); W.wheel.push(dg);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + Math.PI / 5;
      const h = new T.CylinderGeometry(0.018, 0.018, 0.004, S(12)); h.scale(1.5, 1, 1); h.rotateX(Math.PI / 2); h.rotateZ(a); h.translate(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0.011); W.drum.push(h); }
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5, R = 0.056;
      const nut = new T.CylinderGeometry(0.0095, 0.0095, 0.016, 6); nut.rotateX(Math.PI / 2); nut.translate(Math.cos(a) * R, Math.sin(a) * R, 0.044); W.chrome.push(nut); }
    const cap = []; for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; cap.push(new T.Vector2(Math.sin(a) * 0.032, 0.05 + Math.cos(a) * 0.018)); }
    cap.push(new T.Vector2(0.032, 0.035));
    const cg = new T.LatheGeometry(cap.reverse(), S(16)); cg.rotateX(Math.PI / 2); W.chrome.push(cg);   // (bottom to top: the faces out)
    // the brake drum behind the disc
    const drum = new T.CylinderGeometry(0.12, 0.12, 0.08, S(20)); drum.rotateX(Math.PI / 2); drum.translate(0, 0, -0.06); W.drum.push(drum);
  }

  // ---- MERGE: one mesh per material (the frame), one InstancedMesh per wheel part ----
  // the spare's carrier: two angle bars under the rails (with the frame: its surfaces and its AO are the frame's)
  for (const s of [-1, 1]) { const a = new T.BoxGeometry(0.62, 0.006, 0.04); a.translate(xRear + 0.42, railY - railH / 2 - 0.006, s * 0.2); put(M.galvDk, a); }
  for (const s of [-1, 1]) { const a = new T.BoxGeometry(0.006, 0.006, 2 * zR); a.translate(xRear + 0.42 + s * 0.3, railY - railH / 2 - 0.003, 0); put(M.galvDk, a); }
  // every part as triangles (three vertices each), with its normals
  const flat = g => { const q = g.index ? g.toNonIndexed() : g; if (q !== g) g.dispose(); if (!q.attributes.normal) q.computeVertexNormals(); return q; };
  for (const list of bins.values()) for (let i = 0; i < list.length; i++) list[i] = flat(list[i]);
  for (let i = 0; i < strapParts.length; i++) strapParts[i] = flat(strapParts[i]);
  for (const k in W) for (let i = 0; i < W[k].length; i++) W[k][i] = flat(W[k][i]);
  // the wheels' places: four on the spindles, the spare flat under the rear (outer face down)
  const wheelAt = [[-ax + spX, -1], [-ax + spX, 1], [ax + spX, -1], [ax + spX, 1]].map(([x, s]) => ({ x, s, z: s * wZ }));
  const mtx = new T.Matrix4(), mR = new T.Matrix4(), mS = new T.Matrix4();
  const wheelMat = (i, spin, out) => {
    if (i === 4) return out.makeTranslation(xRear + 0.42, railY - railH / 2 - 0.105, 0).multiply(mR.makeRotationX(Math.PI / 2));
    const w = wheelAt[i]; out.makeTranslation(w.x, wheelR, w.z);
    if (w.s < 0) out.multiply(mR.makeRotationY(Math.PI));   // the outer face out (-z on the left)
    return out.multiply(mS.makeRotationZ(w.s < 0 ? spin : -spin));   // rolling forward: the top goes forward
  };
  // THE SURFACES' PASS (above): UV0, the charts, UV1, the AO - the frame (frame 0: the trailer and the wheels at rest, the
  // ground) and the wheel's parts (frame 1: themselves); the strap is surfaced but hits nothing (it comes and goes)
  const staticG = [].concat(...bins.values()), wheelG = [].concat(...Object.values(W));
  const tris = (geoms, mats) => { let n = 0; for (const g of geoms) n += g.attributes.position.array.length * (mats ? mats.length : 1);
    const out = new Float32Array(n), v = new T.Vector3(); let k = 0;
    for (const g of geoms) { const P = g.attributes.position.array;
      if (!mats) { out.set(P, k); k += P.length; continue; }
      for (const m of mats) for (let i = 0; i < P.length; i += 3) { v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(m); out[k++] = v.x; out[k++] = v.y; out[k++] = v.z; } }
    return out; };
  const rest = [0, 1, 2, 3, 4].map(i => wheelMat(i, 0, new T.Matrix4()));
  const o0 = tris(staticG), o1 = tris(wheelG, rest), occl0 = new Float32Array(o0.length + o1.length); occl0.set(o0); occl0.set(o1, o0.length);
  const AO = trlAO(T, [{ geoms: staticG.concat(strapParts), frame: 0 }, { geoms: wheelG, frame: 1 }], [occl0, tris(wheelG)], o);
  // (three's aoMap darkens the ambient / environment light only; the sun's shadow map is far coarser than a bracket on a rail,
  //  so the small contacts stayed sharp in sunlight - 40 % of the AO on the direct diffuse too: the crevices the shadow map
  //  cannot see. A WebGL program patch, its own cache key; a node renderer ignores it)
  // the patch (THE WEATHERING, above): the AO's direct share and the layers; the wheels' centres for their mud
  const wxWheels = [0, 1, 2, 3].map(i => new T.Vector4(wheelAt[i].x, wheelR, wheelAt[i].z, wheelR));
  for (const [key, m] of Object.entries(M)) if (m && m.isMaterial) { m.aoMap = AO.map; m.aoMapIntensity = 1; trlPatch(T, m, key, wxWheels); m.needsUpdate = true; }
  function merge(list) {
    let n = 0; for (const q of list) n += q.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), uv1 = new Float32Array(n * 2); let k = 0;
    for (const q of list) {
      pos.set(q.attributes.position.array, k * 3); nor.set(q.attributes.normal.array, k * 3);
      if (q.attributes.uv) uv.set(q.attributes.uv.array, k * 2); if (q.attributes.uv1) uv1.set(q.attributes.uv1.array, k * 2);
      k += q.attributes.position.count;
    }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2)); out.setAttribute('uv1', new T.BufferAttribute(uv1, 2));
    out.computeBoundingSphere(); out.computeBoundingBox();
    for (const g of list) g.dispose(); return out;
  }
  const group = new T.Group(); group.name = 'trailer'; group.matrixAutoUpdate = false;
  let triN = 0, draws = 0;
  for (const [mat, list] of bins) { const g = merge(list); const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.name = 'trailer:' + (mat.name || ''); group.add(m); triN += g.attributes.position.count / 3; draws++; }
  const strap = strapParts.length ? new T.Mesh(merge(strapParts), M.strap) : null;
  if (strap) { strap.castShadow = true; strap.name = 'trailer:strap'; group.add(strap); triN += strap.geometry.attributes.position.count / 3; draws++; }
  const NW = 5, inst = [];
  for (const k of ['tyre', 'wheel', 'drum', 'chrome']) {
    const g = merge(W[k]), mat = k === 'tyre' ? M.rubber : k === 'wheel' ? M.wheel : k === 'drum' ? M.drum : M.chrome;
    const im = new T.InstancedMesh(g, mat, NW); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.name = 'trailer:wheels:' + k;
    group.add(im); inst.push(im); triN += g.attributes.position.count / 3 * NW; draws++;
  }
  function poseWheels(spin) {
    for (let i = 0; i < NW; i++) { wheelMat(i, spin, mtx); for (const im of inst) im.setMatrixAt(i, mtx); }
    for (const im of inst) im.instanceMatrix.needsUpdate = true;
  }
  poseWheels(0);

  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3();
  function update(Tp, latched) {
    _a.set(Tp.f[0], Tp.f[1], Tp.f[2]); _b.set(Tp.u[0], Tp.u[1], Tp.u[2]); _c.set(Tp.r[0], Tp.r[1], Tp.r[2]);
    group.matrix.makeBasis(_a, _b, _c).setPosition(Tp.A[0], Tp.A[1], Tp.A[2]); group.matrixWorldNeedsUpdate = true;
    poseWheels(Tp.spin || 0);
    if (strap) strap.visible = latched !== false;
  }
  return { group, update, strap, materials: M, aoMap: AO.map, stats: { tris: Math.round(triN), draws, materials: bins.size, x: [xRear, Ld + 0.06], width: 2 * (wZ + 0.15), xFront, xRear, deckY: isC ? deckY : null, ao: AO.stats,
    wheels: wheelAt.map(w => [w.x, wheelR, w.z]), wheelR, wheelW: 0.185, rimR: 0.178 } };
}

// THE CAR'S HALF: the tow bar's ball mount for the pickup's receiver (50 mm square shank, the drop plate, the 50 mm ball
// and its neck). Its origin is the ball's centre, +x forward (into the receiver); the car's rig carries it at the ball.
function buildTowHitch(THREE) {
  const T = THREE, gal = new T.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.45 }), chrome = new T.MeshStandardMaterial({ color: 0xe9ebee, metalness: 1, roughness: 0.16 });
  const g = new T.Group(); g.name = 'car:hitch';
  const sh = new T.BoxGeometry(0.32, 0.05, 0.05); sh.translate(0.2, 0.08, 0); g.add(new T.Mesh(sh, gal));
  const pl = new T.BoxGeometry(0.06, 0.11, 0.07); pl.translate(0.03, 0.045, 0); g.add(new T.Mesh(pl, gal));
  const nk = new T.CylinderGeometry(0.014, 0.02, 0.03, 12); nk.translate(0, -0.035 + 0.04 * 0, 0); g.add(new T.Mesh(nk, chrome));
  const ball = new T.SphereGeometry(0.025, 16, 12); g.add(new T.Mesh(ball, chrome));
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

if (typeof module !== 'undefined') module.exports = { buildTrailerModel, buildTowHitch, trailerWeather, TRL_WX };
