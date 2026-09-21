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
    { k: 'density', label: 'forest density', steps: [
        { v: 80,  label: 'sparse', why: 'a tree every 12.8 m' },
        { v: 100, label: 'normal', why: 'a tree every 10.2 m' },
        { v: 128, label: 'dense', why: 'a tree every 8 m' },
        { v: 160, label: 'very dense', why: 'a tree every 6.4 m' } ] },
    { k: 'bands', label: 'forest detail', steps: [
        { v: 'near', label: 'near', why: 'real trees to 270 m, pictures of trees beyond - the bench’s bands' },
        { v: 'far',  label: 'far', why: 'real trees to 450 m; the frame is 1.3-2x dearer in a dense stand' } ] },
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
    { k: 'mist', label: 'mist', steps: [
        { v: 'off', label: 'off', why: 'no ground mist whatever the day' },
        { v: 'on',  label: 'on', why: 'the day’s humidity as a layer over the low ground and the water' } ] },
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
    { k: 'lighting', label: 'lighting', steps: [
        { v: 'sunset', label: 'sunset', why: 'the world’s golden hour' },
        { v: 'alps',   label: 'afternoon', why: 'the bench’s afternoon sky, the light the trees were judged in' } ] },
    // THE COLOUR ROWS (W0.5a, the user: "can we play with that with sliders?").
    // The tone curve and the exposure are live on the renderer; colour
    // management is decided when a colour is MADE, so that row stores the
    // choice and reloads the page.
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
  const BANDS = { near: [60, 270, 270], far: [150, 450, 450] };   // W0c.32: L1 to the impostor, no L2
  const SHADOWS = { off: { on: false, map: 1024, far: false }, near: { on: true, map: 1024, far: false },
                    full: { on: true, map: 2048, far: true }, ultra: { on: true, map: 4096, far: true } };

  // ---- the presets: measured on the reference machine (tools/tree_perf.js) --
  const PRESETS = {
    // tone Cineon + colour managed: the user's ruling on the A/B (2026-09-13)
    low:    { aa: 'off',  density: 80,  bands: 'near', shadows: 'near', canopy: 'off', lighting: 'sunset', tone: 'cineon', exposure: 1, colour: 'managed', glare: 'on', mist: 'on', clouds: 'off', bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off' },
    medium: { aa: 'msaa', density: 100, bands: 'near', shadows: 'full', canopy: 'on',  lighting: 'sunset', tone: 'cineon', exposure: 1, colour: 'managed', glare: 'on', mist: 'on', clouds: 'half', bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off' },
    high:   { aa: 'msaa', density: 128, bands: 'far',  shadows: 'full', canopy: 'on',  lighting: 'sunset', tone: 'cineon', exposure: 1, colour: 'managed', glare: 'on', mist: 'on', clouds: 'half', bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off' },
    ultra:  { aa: 'full', density: 160, bands: 'far',  shadows: 'ultra', canopy: 'on', lighting: 'sunset', tone: 'cineon', exposure: 1, colour: 'managed', glare: 'on', mist: 'on', clouds: 'full', bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off' },
  };
  const PRESET_WHY = {
    low: 'for an integrated or old GPU', medium: 'for a mid-range card - the default',
    high: 'this machine at ~30 fps in the worst stand', ultra: 'when the card allows',
  };

  // ---- the state ----------------------------------------------------------
  const S = Object.assign({ preset: 'medium' }, PRESETS.medium);
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
    for (const o of OPTIONS) if (!o.steps.some(s => s.v === S[o.k])) S[o.k] = PRESETS.medium[o.k];
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
    if (W.ATMO && W.ATMO.MIST && applied.mist !== S.mist) { W.ATMO.MIST.on = S.mist !== 'off'; applied.mist = S.mist; }
    if (W.CLOUDS && applied.clouds !== S.clouds) { W.CLOUDS.S.mode = S.clouds; if (AA && AA.needRT) AA.needRT(S.clouds !== 'off'); applied.clouds = S.clouds; }
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
        label: p, value: p, title: PRESET_WHY[p] || 'your own mix of the options below',
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
    OPTIONS, PRESETS, BANDS, SHADOWS,
    get: () => Object.assign({}, S),
    set, apply, mount, presetOf, frameText,
    setExposure, setEye, eye: () => eyeK, exposureBase: () => expBase,
    // the world calls this once it exists (render_world.js, end of build)
    onWorld: () => { applied = {}; apply(); },
    // what each option costs to change, for anyone who asks
    restart: () => ({ aa: 'live (reallocates the frame)', density: 'live (re-streams the forest, ~10 s)',
                      bands: 'live', shadows: 'live (recompiles the lit surfaces)', canopy: 'live', lighting: 'live',
                      glare: 'live', mist: 'live', clouds: 'live',
                      bloom: 'live', look: 'live', lens: 'live', rays: 'live', ao: 'live', eye: 'live', anything: 'no restart' }),
  };
})();
