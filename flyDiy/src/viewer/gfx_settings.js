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
    { k: 'lighting', label: 'lighting', steps: [
        { v: 'sunset', label: 'sunset', why: 'the world’s golden hour' },
        { v: 'alps',   label: 'afternoon', why: 'the bench’s afternoon sky, the light the trees were judged in' } ] },
  ];
  const BANDS = { near: [60, 132, 270], far: [150, 300, 450] };
  const SHADOWS = { off: { on: false, map: 1024, far: false }, near: { on: true, map: 1024, far: false },
                    full: { on: true, map: 2048, far: true }, ultra: { on: true, map: 4096, far: true } };

  // ---- the presets: measured on the reference machine (tools/tree_perf.js) --
  const PRESETS = {
    low:    { aa: 'off',  density: 80,  bands: 'near', shadows: 'near', canopy: 'off', lighting: 'sunset' },
    medium: { aa: 'msaa', density: 100, bands: 'near', shadows: 'full', canopy: 'on',  lighting: 'sunset' },
    high:   { aa: 'msaa', density: 128, bands: 'far',  shadows: 'full', canopy: 'on',  lighting: 'sunset' },
    ultra:  { aa: 'full', density: 160, bands: 'far',  shadows: 'ultra', canopy: 'on', lighting: 'sunset' },
  };
  const PRESET_WHY = {
    low: 'for an integrated or old GPU', medium: 'for a mid-range card - the default',
    high: 'this machine at ~30 fps in the worst stand', ultra: 'when the card allows',
  };

  // ---- the state ----------------------------------------------------------
  const S = Object.assign({ preset: 'medium' }, PRESETS.medium);
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
    if (rig && applied.lighting !== S.lighting) {
      rig.row(S.lighting);
      // the row carries its own shadow / floor numbers: re-assert ours
      applied.shadows = null; applied.canopy = null;
      applied.lighting = S.lighting;
      apply();
    }
  };
  const set = (k, v) => {
    if (k === 'preset') { if (!PRESETS[v]) return S; Object.assign(S, PRESETS[v]); S.preset = v; }
    else { S[k] = v; S.preset = presetOf(); }
    save(); apply(); return Object.assign({}, S);
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
                 'lit surfaces (a short hitch). The F8 panel is the developer’s: every dial, ' +
                 'nothing saved.');
    hosts++;
    if (!rafId) { last = 0; rafId = W.requestAnimationFrame(tick); }
    const iv = setInterval(() => {
      if (!body.isConnected) { clearInterval(iv); hosts = Math.max(0, hosts - 1); return; }
      if (readout && readout.textContent !== undefined) readout.textContent = frameText();
    }, 500);
  };

  load();
  W.GFX = {
    OPTIONS, PRESETS, BANDS, SHADOWS,
    get: () => Object.assign({}, S),
    set, apply, mount, presetOf, frameText,
    // the world calls this once it exists (render_world.js, end of build)
    onWorld: () => { applied = {}; apply(); },
    // what each option costs to change, for anyone who asks
    restart: () => ({ aa: 'live (reallocates the frame)', density: 'live (re-streams the forest, ~10 s)',
                      bands: 'live', shadows: 'live (recompiles the lit surfaces)', canopy: 'live', lighting: 'live',
                      anything: 'no restart' }),
  };
})();
