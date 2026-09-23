// gfx_settings.js - GRAPHICS SETTINGS (G286)
//
// The menu a PC game has: a PRESET and, under it, the handful of options a
// player expects - not the F8 developer panel, which lists every dial the
// world publishes and owns nothing. This one owns a SAVED CHOICE
// (localStorage 'flydiy.gfx') and applies it the moment the world exists,
// before the first chunk of forest is planted, so a machine that cannot
// afford the forest never draws it dense. Spec:
// futureDesigns/GRAPHICS-SETTINGS-2026-09-12.md.
//
// Everything it drives is a live handle the world already publishes -
// FLYDIY_AA, TREE_FILL, TREE_LOD, WORLD_RIG, WORLD.sun - so applying a
// setting is the same act a console or the F8 panel performs. Every option
// is a NAMED STEP rather than a slider, because a step can be measured and
// written down (tools/tree_perf.js; the numbers are in the option labels).
//
// NOTHING NEEDS A RESTART. Each option takes effect live; three of them
// cost a moment when changed and the note under the menu says so: the AA
// tier reallocates its render target (one frame), a density change
// re-streams the forest around you (~10 s of chunks arriving), shadows
// on/off recompiles the lit materials (a short hitch).
//
// Hosted by both rails: app.js's flight rail and editor.js's shed rail each
// call GFX.mount(body, helpers) with their own row / pills / note builders,
// so the menu wears each screen's typography and neither screen holds any
// of its state.
(function () {
  'use strict';
  const W = (typeof window !== 'undefined') ? window : null;
  if (!W) return;
  const KEY = 'flydiy.gfx';

  // ---- the options: named steps over the handles ---------------------------
  const OPTIONS = [
    { k: 'aa', label: 'anti-aliasing', steps: [
        { v: 'off',  label: 'off', why: '4x MSAA - the cheapest frame' },
        { v: 'msaa', label: 'smooth', why: '8x MSAA' },
        { v: 'full', label: 'smoothest', why: '8x MSAA and a 1.25x supersample - the dearest frame' } ] },
    // THE RENDER SCALE (PERF 2026-09-23): the scene drawn at a fraction of the screen's pixels and enlarged
    // (aa_resolve.js, bicubic). The frame is fill-bound: on the 3080 the default preset is 16-23 ms at 1080p
    // and 38-50 ms at 5120x1440 - the pixels, not the content, decide the frame rate on a big screen.
    { k: 'scale', label: 'render scale', steps: [
        { v: 1,    label: '100 %', why: 'every pixel of the screen drawn' },
        { v: 0.85, label: '85 %', why: 'the scene at 85 % of the screen and enlarged - 72 % of the pixels' },
        { v: 0.75, label: '75 %', why: '56 % of the pixels: a big screen at a playable rate' },
        { v: 0.67, label: '67 %', why: '45 % of the pixels' },
        { v: 0.5,  label: '50 %', why: 'a quarter of the pixels - an old or integrated card on a big screen' } ] },
    { k: 'density', label: 'forest density', steps: [
        { v: 100, label: 'sparse', why: 'a tree every 10.2 m at most - 95 a hectare' },
        { v: 128, label: 'normal', why: 'a tree every 8 m at most - 156 a hectare' },
        { v: 160, label: 'dense', why: 'a tree every 6.4 m at most - 244 a hectare (a young spruce stand); the card holds ~4x the trees of sparse' },
        { v: 200, label: 'very dense', why: 'a tree every 5.1 m at most - 380 a hectare; the biome’s own count caps it below this, the card’s memory above it' } ] },
    { k: 'bands', label: 'forest detail', steps: [
        { v: 'near', label: 'impostors', why: 'the full tree to 10 m, its light rung to 30 m, pictures of trees beyond - in flight nearly every tree is a picture (2 triangles), which is what buys the density' },
        { v: 'far',  label: 'real trees', why: 'real trees to 270 m (the bands before 2026-09-21); the frame is 1.3-2x dearer in a dense stand' } ] },
    { k: 'shadows', label: 'shadows', steps: [
        { v: 'off',   label: 'off', why: 'no shadow at all' },
        { v: 'near',  label: 'near', why: 'a 1024 map around the aeroplane' },
        { v: 'full',  label: 'full', why: 'a 2048 map, and the far stands shade the ground' },
        { v: 'ultra', label: 'ultra', why: 'a 4096 map, and the far stands shade the ground' } ] },
    { k: 'canopy', label: 'forest floor', steps: [
        { v: 'off', label: 'off', why: 'the ground under a stand is lit like a field' },
        { v: 'on',  label: 'on', why: 'the ground under the crowns is in their shade' } ] },
    // THE SKY'S OWN (S7): the sun's glare (the corona in the sky and the flare over the frame) and
    // the mist (the day's humidity as a ground layer) - each off or on; the dials are F8's
    { k: 'glare', label: 'sun glare', steps: [
        { v: 'off', label: 'off', why: 'no corona, no flare' },
        { v: 'on',  label: 'on', why: 'the corona round the sun and a flare over the frame, hidden behind the wing and the hills' } ] },
    // THE WIND IN THE TREES (CLIMATE K4): a uniform-only bend on the leaves, the
    // cover's tufts and the impostor cards - no second program, no attribute, no
    // sampler; `off` is a zero gain in the same shader.
    { k: 'sway', label: 'wind sway', steps: [
        { v: 'off', label: 'off', why: 'the vegetation stands still whatever the wind' },
        { v: 'on',  label: 'on', why: 'leaves, tufts and far cards lean and flutter with the wind' } ] },
    // F1: the renderer stops drawing what the weather has already swallowed. `full` is the old
    // behaviour for anyone who would rather pay than ever risk a cut.
    { k: 'drawDist', label: 'draw distance', steps: [
        { v: 'vis',  label: 'by visibility', why: 'the far plane and the far terrain follow what the mist and the air actually let through (a foggy day is the CHEAP day: -45 % at the stand)' },
        { v: 'full', label: 'always full', why: 'draw to 100 km whatever the weather' } ] },
    // THE TERRAIN'S GEOMETRIC ERROR (PERF 2026-09-23): the ring and the far terrain drawn at the coarsest mesh whose
    // height error stays under this many pixels. At 8x MSAA the sub-pixel chords of rough ground cost by their COUNT,
    // not their pixels (each one that lands on a sample shades the ground's whole splat in a 2x2 quad): 2 px is
    // ~2-3 ms of the frame at 300 m on Jolene, 3 px ~4 ms; 'exact' is the picture as it was
    { k: 'terrain', label: 'terrain detail', steps: [
        { v: 1, label: 'exact', why: 'every ridge and bank to a pixel (the whole ring, the far terrain at 1 px)' },
        { v: 2, label: 'fine', why: 'the terrain within 2 px of its true shape - a far ridge may shift by a pixel as you fly' },
        { v: 3, label: 'coarse', why: 'within 3 px - the far ground visibly re-cuts as you fly; for cards that need the time' } ] },    { k: 'mist', label: 'mist', steps: [
        { v: 'off',   label: 'off', why: 'no ground mist whatever the day' },
        { v: 'on',    label: 'flat', why: 'the day’s humidity as one level layer over the world (the closed form: no cost)' },
        { v: 'land',  label: 'on the land', why: 'the layer lies in the valleys and on the water instead of at one altitude (F2: a short march, a few tenths of a ms)' },
        { v: 'banks', label: 'patchy', why: 'and it thins and thickens in banks that drift downwind - a face you fly into' } ] },
    // THE CLOUDS (C1): the volumetric layer, marched at half or full resolution
    { k: 'clouds', label: 'clouds', steps: [
        { v: 'off',  label: 'off', why: 'a clear sky whatever the day' },
        { v: 'half', label: 'half', why: 'the layer marched at half resolution (the cost of a few ms)' },
        { v: 'full', label: 'full', why: 'every pixel marched - for screenshots and the strongest cards' } ] },
    // THE POST PASSES (POST-FX study, 2026-09-21; src/viewer/post_fx.js): six switches, every
    // one OFF in every preset - the user's ruling: "ensure we can perfectly operate as of today
    // when turning the post fx off". Each is a pass over the resolved frame, in display space,
    // after the resolve; the cost of each is the F8 panel's readout and tools/frame_perf.js's.
    { k: 'bloom', label: 'bloom', steps: [
        { v: 'off',    label: 'off', why: 'no glow - the frame as resolved' },
        { v: 'soft',   label: 'soft', why: 'the brightest pixels (the sun, lamps, highlights) bleed a little - a five-level pyramid, about a millisecond' },
        { v: 'strong', label: 'strong', why: 'a wider, stronger glow from a lower threshold' } ] },
    { k: 'look', label: 'look', steps: [
        { v: 'off',    label: 'off', why: 'the tone curve alone' },
        { v: 'punchy', label: 'punchy', why: 'a little more contrast and saturation' },
        { v: 'soft',   label: 'soft', why: 'lifted blacks, a gentler contrast' },
        { v: 'faded',  label: 'faded', why: 'lifted blacks, muted colour, a warm cast - a print' } ] },
    { k: 'lens', label: 'lens', steps: [
        { v: 'off',                  label: 'off', why: 'no vignette, no colour fringe' },
        { v: 'vignette',             label: 'vignette', why: 'the corners darkened' },
        { v: 'vignette+aberration',  label: 'vignette + fringe', why: 'the corners darkened and a small chromatic fringe toward the edge' } ] },
    { k: 'rays', label: 'sun rays', steps: [
        { v: 'off', label: 'off', why: 'no shafts' },
        { v: 'on',  label: 'on', why: 'light shafts from the sun through the frame, hidden where the wing or the hills hide the sun - half resolution' } ] },
    { k: 'ao', label: 'ambient occlusion', steps: [
        { v: 'off', label: 'off', why: 'none' },
        { v: 'on',  label: 'on', why: 'creases and contacts darkened from the depth (half resolution, a few ms) - drawn over the finished picture, so it darkens lit surfaces too' } ] },
    { k: 'eye', label: 'auto exposure', steps: [
        { v: 'off', label: 'off', why: 'the day’s exposure schedule alone' },
        { v: 'on',  label: 'on', why: 'the exposure follows the frame’s brightness, within a stop and a half of the schedule' } ] },
    // THE ROAD FURNITURE (2026-09-22): the W-beam guardrails the roads raise where the ground falls
    // away past the shoulder and on the outside of a tight bend (src/viewer/guardrail.js). The switch
    // hides them - nothing is rebuilt, so it is free either way.
    { k: 'rails', label: 'guardrails', steps: [
        { v: 'on',  label: 'on', why: 'a galvanised W-beam where a road runs along a drop or round a tight bend - one draw call a road' },
        { v: 'off', label: 'off', why: 'no guardrails anywhere' } ] },
    // THE POWER LINE (2026-09-22): the poles along a road and the cable between them
    // (src/viewer/powerline.js). The poles are props with their own LOD ladder; the cable is a few
    // hundred metres of merged tube a mesh.
    { k: 'poles', label: 'power lines', steps: [
        { v: 'on',  label: 'on', why: 'utility poles every ~34 m along one verge, the cable strung between them, a street lamp on every second one' },
        { v: 'off', label: 'off', why: 'no poles and no cable' } ] },
    // THE WATER (H6, G460): the one material's two tiers
    { k: 'water', label: 'water', steps: [
        { v: 'simple', label: 'simple', why: 'the swell’s shading and the sun’s glitter; no ripple tile, no lifted surface, no foam' },
        { v: 'full',   label: 'full', why: 'the wind’s ripples, the near sea lifted by the swell, the foam' } ] },
    // THE WATER'S MIRROR (G460.11): the decor - trees, mountains, the aeroplane - reflected in the water from a low
    // eye; 'periodic' recaptures when the eye moves 4 m / turns 3 deg / every 2 s, 'live' every frame (a second scene
    // draw at a quarter of the pixels: the rigs that can afford it); the sky and its clouds are the probe's either way
    { k: 'mirror', label: 'reflections', steps: [
        { v: 'off',      label: 'sky only', why: 'the water reflects the sky and its clouds, never the shore' },
        { v: 'periodic', label: 'periodic', why: 'the shore, the trees and the aeroplane captured when the eye has moved or every 2 s' },
        { v: 'live',     label: 'live', why: 'the reflection captured every frame (a second scene draw at quarter size)' } ] },
    { k: 'lighting', label: 'lighting', steps: [
        { v: 'sunset', label: 'sunset', why: 'the world’s golden hour' },
        { v: 'alps',   label: 'afternoon', why: 'the bench’s afternoon sky, the light the trees were judged in' } ] },
    // THE COLOUR ROWS (W0.5a, the user: "can we play with that with sliders?").
    // The tone curve and the exposure are live on the renderer; colour
    // management is decided when a colour is MADE, so that row stores the
    // choice and reloads the page.
    // THE COMPOSITING (G448.3, the linear split): where the ONE tone map runs.
    // `linear` - the scene is drawn as radiance and the resolve pass curves the
    // sum once (a canopy's reflection adds to the cabin behind it before the
    // curve; a bulb behind its shade, a roof panel, likewise). `display` - the
    // frame as it was before G448.3: every material curves itself on the way
    // in and the blend unit works on the curved picture (the G144 rule).
    { k: 'compositing', label: 'compositing', steps: [
        { v: 'linear',  label: 'linear', why: 'radiance in the frame, one tone map at the end - glass, lamps and panels sum before the curve (the honest picture)' },
        { v: 'display', label: 'display', why: 'the frame before 2026-09-21: every surface curved on its own, then blended - the fallback' } ] },
    { k: 'tone', label: 'tone curve', steps: [
        { v: 'aces',     label: 'ACES', why: 'the filmic curve the game used until 2026-09-13' },
        { v: 'agx',      label: 'AgX', why: 'Blender 4’s default view transform - gentler highlights, less hue shift' },
        { v: 'neutral',  label: 'neutral', why: 'Khronos PBR neutral - keeps colours as they are, rolls off the top' },
        { v: 'reinhard', label: 'Reinhard', why: 'the classic soft roll-off' },
        { v: 'cineon',   label: 'Cineon', why: 'a film-stock curve, cooler shadows - the default since the colour ruling' },
        { v: 'linear',   label: 'linear', why: 'no curve, clipped at white' } ] },
    { k: 'exposure', label: 'exposure', steps: [
        { v: 0.7, label: '×0.7', why: 'darker' }, { v: 0.85, label: '×0.85', why: 'a little darker' },
        { v: 1,   label: '×1', why: 'the mood’s own exposure' },
        { v: 1.2, label: '×1.2', why: 'a little brighter' }, { v: 1.4, label: '×1.4', why: 'brighter' },
        { v: 1.7, label: '×1.7', why: 'much brighter' } ] },
    { k: 'colour', label: 'colour management', steps: [
        { v: 'managed', label: 'managed', why: 'every hex decoded as sRGB (three’s default): the honest reading, the ruling - RELOADS the page' },
        { v: 'linear',  label: 'as authored', why: 'a hex colour is the value the shader sees (the r128 reading every colour was first tuned in) - RELOADS the page' } ] },
  ];
  const TONE = { aces: 'ACESFilmicToneMapping', agx: 'AgXToneMapping', neutral: 'NeutralToneMapping',
                 reinhard: 'ReinhardToneMapping', cineon: 'CineonToneMapping', linear: 'LinearToneMapping' };
  const BANDS = { near: [10, 30, 30], far: [60, 270, 270] };   // 2026-09-21 impostor-first: L0 to 10 m, L1 to 30 m, pictures beyond; 'far' is W0c.32's near (L1 to 270)
  const SHADOWS = { off: { on: false, map: 1024, far: false }, near: { on: true, map: 1024, far: false },
                    full: { on: true, map: 2048, far: true }, ultra: { on: true, map: 4096, far: true } };

  // ---- the presets: FIVE TIERS (PERF 2026-09-23, the user: "5 levels in the end: potato computer, was good
  // 5 years ago, current, gamer and ultra. This computer is considered gamer, and it should hit consistently
  // the 60 fps with the visual settings more or less as they are now"). GAMER is the default and is the
  // medium of before, option for option (a saved choice that was 'medium' reads as 'gamer'); the reference
  // machine is the gamer box (RTX 3080, i7-13700KF). Each tier's cost is measured in tools/frame_perf.js on
  // Jolene (stand / forest / 300 m over the field) - futureDesigns/PERF-2026-09-23.md has the table.
  // What each tier gives up is ordered by what it buys per what it shows. At 1080p the frame is CPU-bound on the
  // DRAW COUNT (three's JavaScript per draw), so a lower tier sheds draws as well as pixels: the shadow pass
  // (~450-1 500 draws), the power poles (~260-400), then the render scale and the MSAA for the older GPU.
  // tone Cineon + colour managed: the user's ruling on the A/B (2026-09-13); every post pass OFF everywhere
  const POST_OFF = { bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off', compositing: 'linear' };
  const COLOUR = { lighting: 'sunset', tone: 'cineon', exposure: 1, colour: 'managed' };
  const PRESETS = {
    potato:  Object.assign({ scale: 0.67, drawDist: 'vis', terrain: 3, aa: 'off',  density: 100, bands: 'near', shadows: 'off',   canopy: 'off', rails: 'off', poles: 'off', glare: 'off', sway: 'off', mist: 'on',    clouds: 'off',  water: 'simple', mirror: 'off' }, COLOUR, POST_OFF),
    retro:   Object.assign({ scale: 1,    drawDist: 'vis', terrain: 2, aa: 'off',  density: 100, bands: 'near', shadows: 'near',  canopy: 'off', rails: 'on', poles: 'off', glare: 'on',  sway: 'off', mist: 'on',    clouds: 'off',  water: 'simple', mirror: 'off' }, COLOUR, POST_OFF),
    current: Object.assign({ scale: 1,    drawDist: 'vis', terrain: 2, aa: 'off',  density: 128, bands: 'near', shadows: 'full',  canopy: 'on',  rails: 'on', poles: 'on', glare: 'on',  sway: 'on',  mist: 'on',    clouds: 'half', water: 'full',   mirror: 'off' }, COLOUR, POST_OFF),
    gamer:   Object.assign({ scale: 1,    drawDist: 'vis', terrain: 1, aa: 'msaa', density: 128, bands: 'near', shadows: 'full',  canopy: 'on',  rails: 'on', poles: 'on', glare: 'on',  sway: 'on',  mist: 'land',  clouds: 'half', water: 'full',   mirror: 'periodic' }, COLOUR, POST_OFF),
    ultra:   Object.assign({ scale: 1,    drawDist: 'vis', terrain: 1, aa: 'full', density: 200, bands: 'near', shadows: 'ultra', canopy: 'on',  rails: 'on', poles: 'on', glare: 'on',  sway: 'on',  mist: 'banks', clouds: 'full', water: 'full',   mirror: 'live' }, COLOUR, POST_OFF),
  };
  const DEFAULT = 'gamer';
  const PRESET_LABEL = { potato: 'potato', retro: '5 years ago', current: 'current', gamer: 'gamer', ultra: 'ultra' };
  const PRESET_WHY = {
    potato:  'an integrated or very old GPU: the scene at 67 % of the screen, no shadows, no clouds, sparse forest',
    retro:   'a card that was good five years ago (GTX 1060 class): the near shadow, no clouds, sparse forest',
    current: 'a current mid-range card (RTX 3060 class): gamer without the 8x MSAA, the mirror and the mist march',
    gamer:   'the reference: RTX 3080 class - 53-60 fps at 1080p on Jolene (the frame is the CPU draw count there); the default',
    ultra:   'the dearest picture: supersampled, the densest forest, 4096 shadows, live reflections - for screenshots and the cards above a 3080',
  };

  // ---- the state ----------------------------------------------------------
  const S = Object.assign({ preset: DEFAULT }, PRESETS[DEFAULT]);
  let expBase = null;                        // the exposure the writers last declared
  let eyeK = 1;                              // the eye's factor (post_fx.js's auto exposure); 1 with the row off
  // THE ONE WAY EXPOSURE IS WRITTEN: base in, base x step x eye on the renderer. A
  // writer that has no menu (the headless stubs) sets the property itself.
  const setExposure = (R, v) => { expBase = v; if (R) R.toneMappingExposure = v * (S.exposure || 1) * eyeK; return expBase; };
  // the eye writes its factor here and nowhere else: the schedule keeps declaring the base
  const setEye = k => { eyeK = Math.max(0.25, Math.min(4, +k || 1)); const R = W.FLYDIY_RENDERER; if (R && expBase != null) R.toneMappingExposure = expBase * (S.exposure || 1) * eyeK; return eyeK; };
  const load = () => {
    try {
      const v = JSON.parse(W.localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object') for (const k in v) if (k in S) S[k] = v[k];
    } catch (e) {}
    for (const o of OPTIONS) if (!o.steps.some(s => s.v === S[o.k])) S[o.k] = PRESETS[DEFAULT][o.k];
    S.preset = presetOf();
  };
  const save = () => { try { W.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  // which preset the current options ARE, or 'custom'
  const presetOf = () => {
    for (const p in PRESETS) if (OPTIONS.every(o => PRESETS[p][o.k] === S[o.k])) return p;
    return 'custom';
  };

  // ---- applying: each option to its handle, only when the world has it -----
  let applied = {};                          // what the handles currently hold
  const apply = () => {
    const AA = W.FLYDIY_AA, world = W.WORLD, rig = W.WORLD_RIG;
    if (AA && AA.setTier && applied.aa !== S.aa) { AA.setTier(S.aa); applied.aa = S.aa; }
    if (AA && AA.setScale && applied.scale !== S.scale) { AA.setScale(S.scale); applied.scale = S.scale; }
    if (W.TREE_FILL && applied.density !== S.density) {
      // re-grid only when the number really changes: a re-grid re-streams
      // every chunk around the aircraft
      if (W.TREE_FILL.get() !== S.density) W.TREE_FILL.set(S.density);
      applied.density = S.density;
    }
    if (W.TREE_LOD && applied.bands !== S.bands) { W.TREE_LOD.set(BANDS[S.bands]); applied.bands = S.bands; }
    if (rig && world && world.sun && applied.shadows !== S.shadows) {
      const sh = SHADOWS[S.shadows];
      // castShadow off/on is what changes the light's shadow count and
      // makes three.js recompile the lit materials; shadowMap.enabled alone
      // leaves them sampling a stale map
      world.sun.castShadow = sh.on;
      rig.set({ shadowMap: sh.map, farShadow: sh.on && sh.far });
      applied.shadows = S.shadows;
    }
    if (rig && applied.canopy !== S.canopy) { rig.set({ floor: S.canopy === 'on' ? 0.30 : 1.0 }); applied.canopy = S.canopy; }
    // the sky's own switches (S7): the glare's two halves and the mist
    if (W.SKY_GLARE && applied.glare !== S.glare) { W.SKY_GLARE.S.on = S.glare !== 'off'; if (W.ATMO && W.ATMO.U && W.ATMO.U.glare) W.ATMO.U.glare.value = S.glare !== 'off' ? (W.ATMO.glareDial != null ? W.ATMO.glareDial : 1) : 0; applied.glare = S.glare; }
    if (W.WORLD && W.WORLD.vis && applied.drawDist !== S.drawDist) { W.WORLD.vis.on = S.drawDist !== 'full'; applied.drawDist = S.drawDist; }
    if (W.WORLD && W.WORLD.ground && applied.terrain !== S.terrain) {
      const g = W.WORLD.ground, far = g.farLod && g.farLod(), ring = g.ringLod && g.ringLod();
      if (far || ring) { if (far) { far.tolPx = S.terrain; far.update(true); } if (ring) { ring.tolPx = S.terrain; ring.update(); } applied.terrain = S.terrain; }
    }
    if (W.ATMO && W.ATMO.MIST && applied.mist !== S.mist) {
      const M = W.ATMO.MIST;
      M.on = S.mist !== 'off';
      M.relief = (S.mist === 'land' || S.mist === 'banks') ? 1 : 0;    // 0 keeps the closed form, bit-identical
      M.patch = S.mist === 'banks' ? 0.85 : 0;
      applied.mist = S.mist;
    }
    // the sway's gain: 0 is a zero bend in the SAME program, so switching it
    // never recompiles and never makes a second variant of a cached key
    if (W.CLIMATE_LINK) W.CLIMATE_LINK.S.swayGain = S.sway === 'off' ? 0 : 1;
    if (W.WATER && applied.water !== S.water) { W.WATER.set({ tier: S.water }); applied.water = S.water; }
    if (W.GUARDRAIL && applied.rails !== S.rails) { W.GUARDRAIL.setOn(S.rails !== 'off'); applied.rails = S.rails; }
    if (W.POWERLINE && applied.poles !== S.poles) { W.POWERLINE.setOn(S.poles !== 'off'); applied.poles = S.poles; }
    if (W.WATER && applied.mirror !== S.mirror) { W.WATER.set({ mirror: S.mirror }); applied.mirror = S.mirror; }
    if (W.CLOUDS && applied.clouds !== S.clouds) { W.CLOUDS.S.mode = S.clouds; if (AA && AA.needRT) AA.needRT(S.clouds !== 'off'); applied.clouds = S.clouds; }
    // the compositing (G448.3): the resolve target's space, the panes' blend, the post passes' input
    if (AA && AA.setLinear && applied.compositing !== S.compositing) {
      const lin = S.compositing !== 'display';
      AA.setLinear(lin);
      if (W.AEROSKIN && W.AEROSKIN.aeroSetGlassBlend && W.THREE) W.AEROSKIN.aeroSetGlassBlend(W.THREE, lin);
      if (W.POST_FX && W.POST_FX.setLinear) W.POST_FX.setLinear(lin);
      applied.compositing = S.compositing;
    }
    // the tone curve, live: r186 re-keys the program on renderer.toneMapping
    const R = W.FLYDIY_RENDERER, T = W.THREE;
    if (R && T && applied.tone !== S.tone && T[TONE[S.tone]] !== undefined) { R.toneMapping = T[TONE[S.tone]]; applied.tone = S.tone; }
    // the exposure, as a MULTIPLIER over the BASE the writers declare through
    // setExposure (the moods, the world's rig rows, the shed). NOT an accessor
    // on the renderer: the first cut made the property return base x step, and
    // the world's rig snapshot read it back and wrote it again as the row's
    // exposure — every row change compounded the step (the field shed blew
    // out at x1.4^n, the user's "lighting went crazy")
    if (R && applied.exposure !== S.exposure) {
      if (expBase == null) expBase = R.toneMappingExposure;
      R.toneMappingExposure = expBase * S.exposure * eyeK; applied.exposure = S.exposure;
    }
    // the post passes (post_fx.js): each row handed over; with every row off the module
    // installs nothing (its hook is null, no target asked for) - the frame of today
    if (W.POST_FX && W.POST_FX.set) for (const k of W.POST_FX.KEYS) if (applied[k] !== S[k]) { W.POST_FX.set(k, S[k]); applied[k] = S[k]; }
    // an island boots in the alps rig - the one the trees were judged in - whatever
    // the preset says (the user, 2026-09-14: "boot that on the alps HDR for now")
    // (the loader's ISLAND_BOOT, not FLIGHT_PROBE: onWorld() runs before the probe exists)
    const onIsland = !!W.ISLAND_BOOT;
    const lighting = onIsland ? 'island' : S.lighting;
    if (rig && applied.lighting !== lighting) {
      rig.row(lighting);
      // the row carries its own shadow / floor numbers: re-assert ours
      applied.shadows = null; applied.canopy = null;
      applied.lighting = lighting;
      apply();
    }
  };
  const set = (k, v) => {
    if (k === 'preset') { if (!PRESETS[v]) return S; Object.assign(S, PRESETS[v]); S.preset = v; }
    else { S[k] = v; S.preset = presetOf(); }
    save(); apply();
    // colour management is decided at construction: store the choice for the
    // page's loader (flydiy.cm) and reload when it differs from what runs
    if (W.THREE && W.THREE.ColorManagement) {
      const want = S.colour === 'managed', is = !!W.THREE.ColorManagement.enabled;
      if (want !== is) { try { W.localStorage.setItem('flydiy.cm', want ? '1' : '0'); } catch (e) {} W.location.reload(); }
    }
    return Object.assign({}, S);
  };

  // ---- the frame, for the readout ---------------------------------------
  const frames = [];
  let rafId = 0, last = 0, hosts = 0;
  const tick = t => {
    if (last) { frames.push(t - last); if (frames.length > 120) frames.shift(); }
    last = t;
    if (hosts > 0) rafId = W.requestAnimationFrame(tick);
    else { rafId = 0; last = 0; }
  };
  const frameText = () => {
    if (frames.length < 10) return 'measuring the frame…';
    const f = frames.slice().sort((a, b) => a - b);
    const med = f[f.length >> 1], p90 = f[Math.floor(f.length * 0.9)];
    return 'last ' + f.length + ' frames: ' + med.toFixed(0) + ' ms median (' + (1000 / med).toFixed(0) + ' fps) · ' + p90.toFixed(0) + ' ms p90';
  };

  // ---- the menu, in the host's own words ---------------------------------
  // helpers: { row(host, label) -> element, pills(host, list, isOn, pick), note(host, text) }
  const mount = (body, H) => {
    const pick = (k, v) => { set(k, v); if (H.refresh) H.refresh(); };
    // THE WORLD (G434): the map the game boots on - the page's loader published the list and its
    // choice (build.js: ?world=, else this pref, else Jolene); picking another stores it and reloads
    if (Array.isArray(W.FLYDIY_WORLDS) && W.FLYDIY_WORLDS.length) {
      const cur = W.FLYDIY_WORLD || 'none';
      H.row(body, 'world');
      H.pills(body, W.FLYDIY_WORLDS.map(w => ({ label: w.name, value: w.id, title: w.id === 'none' ? 'the procedural 24 km world the game was built on: Home Strip, Skarvik' : 'the island from the data: its own field, dock and village' })),
        o => o.value === cur, o => { if (o.value === cur) return; try { W.localStorage.setItem('flydiy.world', o.value); } catch (e) {} W.location.reload(); });
      H.note(body, 'The map reloads the page. Each map keeps its own saved premises (the world editor’s record).');
    }
    H.row(body, 'preset');
    H.pills(body, Object.keys(PRESETS).concat(['custom']).map(p => ({
        label: PRESET_LABEL[p] || p, value: p, title: PRESET_WHY[p] || 'your own mix of the options below',
        why: p === 'custom' && S.preset !== 'custom' ? 'change any option below' : undefined })),
      o => o.value === S.preset, o => pick('preset', o.value));
    for (const o of OPTIONS) {
      H.row(body, o.label);
      H.pills(body, o.steps.map(s => ({ label: s.label, value: s.v, title: s.why })),
        x => x.value === S[o.k], x => pick(o.k, x.value));
    }
    const readout = H.note(body, frameText());
    H.note(body, 'Everything takes effect at once; nothing needs a restart. Changing the ' +
                 'anti-aliasing reallocates the frame (a blink), a new density re-streams the ' +
                 'forest around you (about ten seconds), and shadows off or on recompiles the ' +
                 'lit surfaces (a short hitch). The tone curve and the exposure are live; ' +
                 'colour management reloads the page. The F8 panel is the developer’s: every ' +
                 'dial, nothing saved.');
    // THE STORAGE LINE (LOADING S4, the user: "a clear button from the interface
    // to refresh caches manually, and show the version numbers local and server
    // side"): the build this page runs, the server's (version.json, no-store),
    // the media cache's size, the worker's state - and the button
    if (W.STORAGE) {
      H.row(body, 'storage');
      const st = H.note(body, W.STORAGE.line());
      const upd = () => { if (st && body.isConnected) st.textContent = W.STORAGE.line(); };
      W.STORAGE.checkServer().then(upd); W.STORAGE.measure().then(upd);
      H.pills(body, [{ label: 'refresh caches', value: 'refresh', title: 'drop the media cache, update the worker and reload the page' }],
        () => false, () => { if (st) st.textContent = 'refreshing…'; W.STORAGE.refresh(); });
    }
    hosts++;
    if (!rafId) { last = 0; rafId = W.requestAnimationFrame(tick); }
    const iv = setInterval(() => {
      if (!body.isConnected) { clearInterval(iv); hosts = Math.max(0, hosts - 1); return; }
      if (readout && readout.textContent !== undefined) readout.textContent = frameText();
    }, 500);
  };

  load();
  // the colour row must SAY what runs: the page's loader decided it before
  // this script, from the same stored key, so read the truth back
  if (W.THREE && W.THREE.ColorManagement) S.colour = W.THREE.ColorManagement.enabled ? 'managed' : 'linear';
  W.GFX = {
    OPTIONS, PRESETS, PRESET_LABEL, DEFAULT, BANDS, SHADOWS,
    get: () => Object.assign({}, S),
    set, apply, mount, presetOf, frameText,
    setExposure, setEye, eye: () => eyeK, exposureBase: () => expBase,
    // the world calls this once it exists (render_world.js, end of build)
    onWorld: () => { applied = {}; apply(); },
    // what each option costs to change, for anyone who asks
    restart: () => ({ aa: 'live (reallocates the frame)', density: 'live (re-streams the forest, ~10 s)',
                      bands: 'live', shadows: 'live (recompiles the lit surfaces)', canopy: 'live', lighting: 'live', scale: 'live (reallocates the frame)',
                      glare: 'live', mist: 'live', drawDist: 'live', terrain: 'live (the far quadrants re-cut at once: a hitch)', clouds: 'live',
                      bloom: 'live', look: 'live', lens: 'live', rays: 'live', ao: 'live', eye: 'live',
                      compositing: 'live (reallocates the frame)', water: 'live', anything: 'no restart' }),
  };
})();
