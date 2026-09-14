// dev_panel.js - THE DEVELOPER'S DIALS (W0c.11)
//
// Every number the forest and the light are tuned by, on a slider, in the
// game, behind a key. The bench has had this from its first day and the game
// had console handles nobody could find; the user's ruling after the ladder
// landed was "we really need in game sliders, behind a developer mode".
//
// F8 opens it (or window.DEV_PANEL.toggle()). It owns no state of its own:
// every row is a getter and a setter over a handle the world already
// publishes - TREE_FILL, TREE_LOD, TREE_LEAF, TREE_MIX, WORLD.treeLod,
// WORLD_RIG, DEV_CAM - so a value moved here is the same value a console or
// a gate would move, and closing the panel changes nothing. DOM-lazy: built
// on the first open, nothing in the page until then.
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const W = window;
  let root = null, rows = [], raf = 0, fpsEl = null, frames = 0, tLast = 0
  let genEl = null;   // the streamer's readout (W0c.30)
  const live = [];    // rows re-read on the fps tick (the clock's readout; sliders are not, a drag would fight it)
  const $ = (t, a, kids) => { const e = document.createElement(t); if (a) for (const k in a) { if (k === 'text') e.textContent = a[k]; else if (k === 'style') e.style.cssText = a[k]; else e.setAttribute(k, a[k]); } if (kids) for (const c of kids) e.appendChild(c); return e; };
  const have = k => { try { return !!W[k]; } catch (e) { return false; } };
  const CSS = `
#devPanel{position:fixed;top:8px;right:8px;width:300px;max-height:calc(100vh - 16px);overflow:auto;z-index:9000;
  background:rgba(14,16,20,.92);color:#d6dbe4;font:11px/1.35 ui-monospace,Consolas,monospace;border:1px solid #3a4150;border-radius:6px;padding:8px 10px;box-shadow:0 6px 24px rgba(0,0,0,.5)}
#devPanel h4{margin:8px 0 4px;font-size:10px;letter-spacing:.12em;color:#8fb3ff;font-weight:600;text-transform:uppercase}
#devPanel .r{display:grid;grid-template-columns:86px 1fr 52px;align-items:center;gap:6px;margin:2px 0}
#devPanel .r label{color:#aab2c0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#devPanel .r input[type=range]{width:100%;margin:0}
#devPanel .r output{text-align:right;color:#f0f3f7}
#devPanel .r select{width:100%;background:#1c2028;color:#d6dbe4;border:1px solid #3a4150;border-radius:3px;font:inherit}
#devPanel .hd{display:flex;justify-content:space-between;align-items:center}
#devPanel .hd b{color:#fff;letter-spacing:.08em}
#devPanel .hd i{color:#8fb3ff;font-style:normal}
#devPanel .note{color:#7d8696;font-size:10px;margin:2px 0 4px}
#devPanel button{background:#1c2028;color:#d6dbe4;border:1px solid #3a4150;border-radius:3px;font:inherit;padding:1px 6px;cursor:pointer}
#devPanel h4.fold{cursor:pointer;user-select:none;display:flex;justify-content:space-between}
#devPanel h4.fold::after{content:'▾';color:#5f6b80}
#devPanel h4.fold.shut::after{content:'▸'}
#devPanel .fb{margin-left:4px;border-left:1px solid #2a3140;padding-left:6px}
#devPanel .fb.shut{display:none}
#devPanel h4.sub{font-size:9px;color:#7d9bd6;margin:6px 0 2px}
`;
  // one row: a range over a getter/setter; `fmt` renders the readout
  const slider = (label, min, max, step, get, set, fmt) => {
    const inp = $('input', { type: 'range', min, max, step });
    const out = $('output');
    const row = $('div', { class: 'r' }, [$('label', { text: label, title: label }), inp, out]);
    const show = v => { out.textContent = fmt ? fmt(v) : (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)); };
    inp.oninput = () => { const v = +inp.value; set(v); show(v); };
    const R = { el: row, refresh: () => { let v; try { v = +get(); } catch (e) { v = NaN; } if (isFinite(v)) { inp.value = v; show(v); } else { out.textContent = '-'; inp.disabled = true; } } };
    rows.push(R);
    return row;
  };
  const select = (label, opts, get, set) => {
    const sel = $('select');
    for (const o of opts) sel.appendChild($('option', { value: o[0], text: o[1] }));
    sel.onchange = () => { set(sel.value); refresh(); };
    const row = $('div', { class: 'r' }, [$('label', { text: label }), sel, $('output')]);
    rows.push({ el: row, refresh: () => { try { sel.value = String(get()); } catch (e) {} } });
    return row;
  };
  const note = t => $('div', { class: 'note', text: t });
  // A FOLD (2026-09-14, the user: "unify the world sliders with the F8 menu ...
  // the settings on individual species can be collapsed, grouped under an
  // overall tree section, but we need to surface the environment controls"):
  // a heading that opens and shuts its block; the state is remembered.
  const folds = (() => { try { return JSON.parse(localStorage.getItem('flydiy.devpanel.folds') || '{}'); } catch (e) { return {}; } })();
  const fold = (parent, title, open, sub) => {
    const shut = folds[title] === undefined ? !open : folds[title];
    const h = $('h4', { class: 'fold' + (sub ? ' sub' : '') + (shut ? ' shut' : ''), text: title });
    const body = $('div', { class: 'fb' + (shut ? ' shut' : '') });
    h.onclick = () => { const s = body.classList.toggle('shut'); h.classList.toggle('shut', s); folds[title] = s;
      try { localStorage.setItem('flydiy.devpanel.folds', JSON.stringify(folds)); } catch (e) {} };
    parent.appendChild(h); parent.appendChild(body);
    return body;
  };
  const refresh = () => { for (const r of rows) r.refresh(); };

  const lod = () => W.TREE_LOD, leaf = () => W.TREE_LEAF, rig = () => W.WORLD_RIG, world = () => W.WORLD;
  const setLod = (i, v) => { const b = lod().get(); b[i] = v; for (let k = i + 1; k < 3; k++) b[k] = Math.max(b[k], v); for (let k = 0; k < i; k++) b[k] = Math.min(b[k], v); lod().set(b); refresh(); };

  function build() {
    document.head.appendChild($('style', { text: CSS }));
    root = $('div', { id: 'devPanel' });
    fpsEl = $('i', { text: '' });
    root.appendChild($('div', { class: 'hd' }, [$('b', { text: 'DEVELOPER' }), fpsEl,
      (() => { const b = $('button', { text: 'close (F8)' }); b.onclick = toggle; return b; })()]));

    // ---- MAP LAYERS: the bench's layer views and the stack's knobs, top-level (G403) ----
    if (world() && world().ground && world().ground.on()) {
      const M = fold(root, 'map layers (the island)', true);
      const gs = k => v => world().ground.set({ [k]: v });
      M.appendChild(select('view', world().ground.modes().map((m, i) => [String(i), m]),
        () => String(world().ground.get().mode), v => world().ground.set({ mode: +v })));
      M.appendChild(note('the bench’s layer views: the stack, then each map alone - tint (Landsat), radar (IFSAR), canopy (Meta/WRI), class (WorldCover), NDVI, coast (the signed field), height, snow'));
      M.appendChild(slider('lightness', 0.2, 2.5, 0.02, () => world().ground.get().light, gs('light')));
      M.appendChild(slider('saturation', 0, 2, 0.02, () => world().ground.get().sat, gs('sat')));
      M.appendChild(slider('shore band', 0, 1, 0.05, () => world().ground.get().shore, gs('shore')));
      M.appendChild(slider('class blur', 0, 200, 5, () => world().ground.get().classBlur, gs('classBlur'), v => v + ' m'));
      M.appendChild(slider('class wobble', 0, 60, 2, () => world().ground.get().edgeWobble, gs('edgeWobble'), v => v + ' m'));
      M.appendChild(select('water', [['1', 'the map (class 80 lakes)'], ['0', 'off']], () => String(world().ground.get().waterMap), v => world().ground.set({ waterMap: +v })));
      M.appendChild(note('water from the map: the cover\u2019s class 80 UNIONED with the imagery\u2019s NDWI (green vs NIR - water absorbs NIR), as a signed field (a smooth edge) and one flat surface per lake at the 85th percentile of the DEM under it. The procedural bake instead: boot with ?hydro=proc and compare.'));
      M.appendChild(note('TERRAIN TYPE legend (recomputed, not recoloured): dark blue sea \u00b7 blue lake \u00b7 yellow-green heath (grass/moss) \u00b7 olive muskeg (grass, flat, wet, low) \u00b7 pale sand (shore, low NDVI) \u00b7 grey-brown scree (bare) \u00b7 dark grey rock (slope > 38\u00b0, or bare > 28\u00b0) \u00b7 mustard scrub (tree cover under 2.5 m canopy, shrub) \u00b7 dark green forest (tree cover, canopy 2.5 m+) \u00b7 white snow (900 m+, slope under 35°) \u00b7 red built'));
      M.appendChild(slider('snowline', 300, 1200, 10, () => world().ground.get().snow, gs('snow'), v => v + ' m'));
      // THE STACK (G404): each albedo layer - on, blend mode, alpha - in the bench's order
      const Ms = fold(M, 'the stack (bottom first)', true, true);
      const G = world().ground, BL = G.blends().map((b, i) => [String(i), b]);
      G.stack().forEach((l, i) => {
        Ms.appendChild(note(l.src));
        Ms.appendChild(select('  on', [['1', 'on'], ['0', 'off']], () => String(G.stack()[i].on ? 1 : 0), v => G.setLayer(i, { on: +v })));
        Ms.appendChild(select('  blend', BL, () => String(G.stack()[i].mode), v => G.setLayer(i, { mode: +v })));
        Ms.appendChild(slider('  alpha', 0, 1, 0.01, () => G.stack()[i].op, v => G.setLayer(i, { op: v })));
      });
      Ms.appendChild(note('class (WorldCover palette) > tint (Landsat) > radar (IFSAR, level 1) > shade (canopy, normalised) > snow (its own mask). Remembered in this browser.'));
      M.appendChild(note('after the stack: the rocky shore off the coast field, then lightness and saturation; lit by the sun after'));
    }
    // ---- TREES: everything about the forest, folded by concern ----------------
    const T = fold(root, 'trees', true);
    if (W.TREE_FILL && W.TREE_FILL.onIsland && W.TREE_FILL.onIsland()) {
      const Ti = fold(T, 'from the map (the island)', true, true);
      const isl = k => v => W.TREE_FILL.setIsland({ [k]: v });
      Ti.appendChild(note('THE RULE: the terrain type says the kind of stand (forest full, scrub half, muskeg a stunted few, heath almost none, rock/sand/water none); the canopy says how much of it stands (the ramp from `cover from` to `full cover`) and how tall (canopy x gain over the model\'s height); NDVI is the vigour (a weak stand thins); a slope over 35\u00b0 thins to a third; species by altitude, wet ground and steepness (the pool)'));
      Ti.appendChild(slider('cover from', 0, 10, 0.5, () => W.TREE_FILL.island().from, isl('from'), v => v + ' m'));
      Ti.appendChild(slider('full cover', 2, 30, 1, () => W.TREE_FILL.island().full, isl('full'), v => v + ' m'));
      Ti.appendChild(slider('size gain', 0.3, 2.5, 0.05, () => W.TREE_FILL.island().gain, isl('gain')));
      Ti.appendChild(slider('size min', 0.1, 1, 0.05, () => W.TREE_FILL.island().min, isl('min')));
      Ti.appendChild(slider('size max', 1, 4, 0.1, () => W.TREE_FILL.island().max, isl('max')));
    }
    T.appendChild(slider('fill density', 16, 400, 8, () => W.TREE_FILL.get(), v => W.TREE_FILL.set(v),
      v => v + ' (' + (1024 / v).toFixed(1) + ' m)'));
    // ONE lightness for the trees, both tiers: the leaf master light (the
    // models) and the impostors' lit term, moved together (the user, G400)
    T.appendChild(slider('tree lightness', 0.2, 2, 0.02, () => leaf().master().light,
      v => { leaf().tint({ light: v }); world().treeLod.lit.value = v * 0.9; }));
    const mix = k => v => { W.TREE_MIX[k] = v; if (W.TREE_MIX.apply) W.TREE_MIX.apply(); };
    T.appendChild(slider('furnished', 0, 1, 0.05, () => W.TREE_MIX.furnished, mix('furnished')));
    T.appendChild(slider('size spread', 0, 0.6, 0.02, () => W.TREE_MIX.spread, mix('spread')));
    T.appendChild(note('furnished = share of living trees drawn as the specimen (the rest as the stand shape); both replant on release'));
    genEl = note('');
    T.appendChild(genEl);
    const Tl = fold(T, 'ladder', false, true);
    Tl.appendChild(slider('L0 to (m)', 20, 600, 10, () => lod().get()[0], v => setLod(0, v), v => v + ' m'));
    Tl.appendChild(slider('L1 to (m)', 20, 600, 10, () => lod().get()[1], v => setLod(1, v), v => v + ' m'));
    Tl.appendChild(slider('L2 to (m)', 20, 800, 10, () => lod().get()[2], v => setLod(2, v), v => v + ' m'));
    Tl.appendChild(slider('fade window', 0, 100, 2, () => lod().fade(), v => lod().fade(v), v => v + ' m'));
    Tl.appendChild(note('impostors beyond L2; L1 to = L2 to (the default) skips the half-foliage L2; L0 = L1 = L2 is "L0 then impostor"; the window dithers one rung into the next'));
    Tl.appendChild(slider('imp lit', 0, 3, 0.05, () => world().treeLod.lit.value, v => { world().treeLod.lit.value = v; }));
    Tl.appendChild(slider('imp gain', 1, 12, 0.25, () => lod().imp().gain, v => lod().imp({ gain: v })));
    Tl.appendChild(slider('imp solid', 0, 1, 0.05, () => lod().imp().solid, v => lod().imp({ solid: v })));
    const Tf = fold(T, 'leaf', false, true);
    Tf.appendChild(slider('wrap', 0, 1, 0.02, () => leaf().get().wrap, v => leaf().set({ wrap: v })));
    Tf.appendChild(slider('sss', 0, 2, 0.02, () => leaf().get().sss, v => leaf().set({ sss: v })));
    Tf.appendChild(slider('sss power', 1, 8, 0.25, () => leaf().get().sssp, v => leaf().set({ sssp: v })));
    Tf.appendChild(slider('ao bake', 0, 4, 0.1, () => leaf().get().ao, v => leaf().set({ ao: v })));
    Tf.appendChild(slider('sharp', 0, 3, 0.05, () => leaf().sharp(), v => leaf().sharp(v)));
    Tf.appendChild(slider('master hue', -0.2, 0.2, 0.005, () => leaf().master().hue, v => leaf().tint({ hue: v }), v => v.toFixed(3)));
    Tf.appendChild(slider('master sat', 0, 2, 0.02, () => leaf().master().sat, v => leaf().tint({ sat: v })));
    Tf.appendChild(slider('master light', 0.2, 2, 0.02, () => leaf().master().light, v => leaf().tint({ light: v })));
    const Tc = fold(T, 'species', false, true);
    Tc.appendChild(note('the bench’s per-collection tint, live on both tiers'));
    for (const c of (leaf().collections ? leaf().collections() : [])) {
      const short = c.name.replace(/\.glb$/, '').replace(/_tree|_trees_pack_lods_gameready|realistic_/g, '').slice(0, 14);
      const Ts = fold(Tc, short, false, true);
      Ts.appendChild(slider('hue', -0.2, 0.2, 0.005, () => c.tint.hue || 0, v => leaf().tintOf(c.name, { hue: v }), v => v.toFixed(3)));
      Ts.appendChild(slider('sat', 0, 1.5, 0.02, () => (c.tint.sat === undefined ? 1 : c.tint.sat), v => leaf().tintOf(c.name, { sat: v })));
      Ts.appendChild(slider('light', 0.2, 2, 0.02, () => (c.tint.light === undefined ? 1 : c.tint.light), v => leaf().tintOf(c.name, { light: v })));
      Ts.appendChild(slider('bark', 0.2, 2, 0.02, () => (c.tint.bark === undefined ? 1 : c.tint.bark), v => leaf().tintOf(c.name, { bark: v })));
    }
    // ---- THE CLOCK (SKY S1/S2): the day the world is on, and its sun --------------
    const ck = () => W.DAY_CLOCK, dy = () => (W.DAY_CLOCK ? W.DAY_CLOCK.day() : null);
    const K = fold(root, 'clock', true);
    K.appendChild(select('preset', ['dawn', 'morning', 'noon', 'afternoon', 'golden', 'sunset', 'dusk', 'night'].map(p => [p, p]),
      () => (ck() ? ck().nearestPreset() : 'noon'), v => { if (ck()) ck().preset(v); }));
    K.appendChild(slider('local hour', 0, 24, 1 / 12, () => (ck() ? ck().localHours() : NaN), v => { if (ck()) ck().set({ localHours: v }); },
      v => String(Math.floor(v)).padStart(2, '0') + ':' + String(Math.round((v % 1) * 60)).padStart(2, '0')));
    { // the date: an input row in the slider grid
      const inp = $('input', { type: 'date' }), out = $('output');
      inp.onchange = () => { if (ck() && inp.value) ck().set({ date: inp.value }); };
      const row = $('div', { class: 'r' }, [$('label', { text: 'date' }), inp, out]);
      rows.push({ el: row, refresh: () => { const d = dy(); if (d) { inp.value = d.date; out.textContent = d.tzLabel; } } });
      K.appendChild(row);
    }
    K.appendChild(select('rate', [['0', 'frozen'], ['1', 'real time'], ['10', '10x'], ['60', '60x (a minute a second)'], ['600', '600x']],
      () => (dy() ? String(dy().rate) : '1'), v => { if (ck()) ck().rate(+v); }));
    K.appendChild(select('the sun', [['day', 'the day’s (almanac)'], ['manual', 'manual (the sliders below)']],
      () => (rig().get().manual ? 'manual' : 'day'), v => rig().set({ manual: v === 'manual' })));
    { // the almanac, read out
      const n = note('');
      const R = { el: n, refresh: () => { const d = dy(); n.textContent = d ? `${d.local} · sun ${d.sunEl.toFixed(1)}° at ${d.sunAz.toFixed(0)}° true (${d.illumClass}) · moon ${d.moonEl.toFixed(0)}° ${(d.moonPhase * 100).toFixed(0)}% · cloud base ${d.cloudBase.toFixed(0)} m · vis ${d.visibilityKm.toFixed(0)} km` : 'no day'; } };
      rows.push(R); live.push(R);
      K.appendChild(n);
    }
    // ---- THE ATMOSPHERE (SKY S3): the day's air as the sky sees it -------------------
    const A = fold(root, 'atmosphere', true);
    A.appendChild(slider('turbidity', 1.5, 10, 0.1, () => (dy() ? dy().turbidity : NaN), v => { if (ck()) ck().set({ turbidity: v }); }, v => v.toFixed(1) + (v < 3 ? ' clear' : v < 6 ? ' hazy' : ' thick')));
    A.appendChild(slider('ozone', 100, 500, 10, () => (dy() ? dy().ozone : NaN), v => { if (ck()) ck().set({ ozone: v }); }, v => v + ' DU'));
    A.appendChild(slider('ground albedo', 0, 0.6, 0.01, () => (dy() ? dy().groundAlbedo : NaN), v => { if (ck()) ck().set({ groundAlbedo: v }); }));
    A.appendChild(slider('humidity', 0.05, 1, 0.01, () => (dy() ? dy().rh : NaN), v => { if (ck()) ck().set({ rh: v }); }, v => (v * 100).toFixed(0) + ' %'));
    A.appendChild(slider('cloud cover', 0, 1, 0.02, () => (dy() ? dy().cloudCover : NaN), v => { if (ck()) ck().set({ cloudCover: v }); }));
    A.appendChild(slider('stars', 0, 3, 0.1, () => (W.ATMO && W.ATMO.U.stars ? W.ATMO.U.stars.value : NaN), v => { if (W.ATMO && W.ATMO.U.stars) W.ATMO.U.stars.value = v; }));
    { const n = note(''); const R = { el: n, refresh: () => { const S = W.SKY_LIGHT, K = S && S.K(); n.textContent = K && K.K_SUN ? `K_sun ${K.K_SUN.toFixed(2)} K_hemi ${K.K_HEMI.toFixed(2)} · ${S.isMoon ? 'the moon is the key' : 'the sun is the key'} · exposure base ${(W.GFX && W.GFX.exposureBase ? W.GFX.exposureBase() : 0).toFixed(3)}` : 'atmosphere off (painted dome)'; } }; rows.push(R); live.push(R); A.appendChild(n); }
    A.appendChild(note('the rig row’s sun / hemisphere / exposure below are GAINS on the alps anchors (2.8 / 0.274 / 0.92) under the physical sky'));
    // ---- ENVIRONMENT: the light, the air, the ground's shading, surfaced ----------
    const E = fold(root, 'environment', true);
    E.appendChild(select('rig row', [['sunset', 'sunset (the world’s)'], ['alps', 'alps afternoon (the bench’s)'], ['island', 'island (alps, hemisphere x2)']],
      () => rigRowName, v => { rigRowName = v; rig().row(v); }));
    // dragging either sun slider takes the rig MANUAL (the clock fold above hands it back)
    E.appendChild(slider('sun elev', 0, 90, 0.5, () => rig().get().elev, v => rig().set({ manual: true, elev: v }), v => v.toFixed(1) + '°'));
    E.appendChild(slider('sun azimuth', -180, 180, 1, () => rig().get().azim, v => rig().set({ manual: true, azim: v }), v => v.toFixed(0) + '°'));
    E.appendChild(slider('sun', 0, 5, 0.05, () => rig().get().sunI, v => rig().set({ sunI: v })));
    E.appendChild(slider('sun warmth', 0, 1, 0.02, () => sunWarm(), v => rig().set({ sunCol: warmHex(v) })));
    E.appendChild(slider('hemisphere', 0, 1.5, 0.02, () => rig().get().hemi, v => rig().set({ hemi: v })));
    E.appendChild(slider('exposure', 0.3, 2, 0.02, () => rig().get().exposure, v => rig().set({ exposure: v })));
    E.appendChild(select('environment', [['dome', 'the sky dome (baked at boot)'], ['alps', 'alps panorama (invisible)']],
      () => rig().get().env, v => rig().set({ env: v })));
    E.appendChild(note('distance is the atmosphere’s aerial perspective (S4): no fog rows - turbidity and humidity above are the haze'));
    const Es = fold(E, 'shadows and floor', false, true);
    Es.appendChild(slider('shadow reach', 105, 540, 5, () => rig().get().shadowMin, v => rig().set({ shadowMin: v }), v => '±' + v + ' m'));
    Es.appendChild(slider('forest floor', 0, 1, 0.02, () => rig().get().floor, v => rig().set({ floor: v })));
    Es.appendChild(slider('floor blur', 2, 7, 0.25, () => rig().get().floorBlur, v => rig().set({ floorBlur: v }), v => v.toFixed(2) + ' (' + Math.round(1.37 * Math.pow(2, v)) + ' m)'));
    Es.appendChild(slider('floor edge', 0.08, 0.8, 0.02, () => rig().get().floorEdge, v => rig().set({ floorEdge: v })));
    Es.appendChild(select('shadow snap', [['1', 'texel-snapped (still)'], ['0', 'free (swims)']],
      () => (rig().get().snap === false ? '0' : '1'), v => rig().set({ snap: v === '1' })));
    Es.appendChild(select('far shadows', [['1', 'on (impostor cascade)'], ['0', 'off']],
      () => (rig().get().farShadow === false ? '0' : '1'), v => rig().set({ farShadow: v === '1' })));
    Es.appendChild(select('shadow map', [['1024', '1024'], ['2048', '2048'], ['4096', '4096']],
      () => rig().get().shadowMap, v => rig().set({ shadowMap: +v })));
    const wsea = () => (W.FLIGHT_PROBE && W.FLIGHT_PROBE.world) ? W.FLIGHT_PROBE.world() : null;
    const Ew = fold(E, 'the sea', false, true);
    Ew.appendChild(slider('swell (m)', 0, 1.5, 0.05, () => wsea() && wsea().sea ? wsea().sea.A : NaN, v => { const w = wsea(); if (w && w.setSea) w.setSea({ A: v, L: w.sea.L || 12, dir: w.sea.dir || 0 }); }));
    Ew.appendChild(slider('wavelength', 3, 60, 1, () => wsea() && wsea().sea ? wsea().sea.L : NaN, v => { const w = wsea(); if (w && w.setSea) w.setSea({ A: w.sea.A, L: v, dir: w.sea.dir || 0 }); }, v => v + ' m'));
    Ew.appendChild(note('the sea follows the wind through the DAY (setWeather); these override it until the next wind'));
    // ---- FRAME, CAMERA -------------------------------------------------------
    const F = fold(root, 'frame', false);
    F.appendChild(select('AA tier', [['full', 'smoothest (8x MSAA + 1.25x)'], ['msaa', 'smooth (8x MSAA)'], ['off', 'off (4x MSAA)']],
      () => (W.FLYDIY_AA && W.FLYDIY_AA.tier) ? W.FLYDIY_AA.tier() : 'full', v => { if (W.FLYDIY_AA) W.FLYDIY_AA.setTier(v); }));
    F.appendChild(note('measured (tree_perf, densest stand, bands 60/132/270, NG 112): smooth ~24 ms, smoothest ~29; with geometry to 450 m: 32 / 38'));
    const C = fold(root, 'camera', false);
    C.appendChild(slider('free cam speed', 1, 400, 1, () => W.DEV_CAM.speed, v => { W.DEV_CAM.speed = v; }, v => v + ' m/s'));
    C.appendChild(note('CAMERA → free: WASD/ZQSD, R/F up-down, Shift x5, drag to look'));
    document.body.appendChild(root);
  }
  let rigRowName = 'sunset';
  // the sun's colour as one warmth number: white at 0, the sunset's ffa652 at 1
  const warmHex = w => { const r = 255, g = Math.round(255 - (255 - 0xa6) * w), b = Math.round(255 - (255 - 0x52) * w); return (r << 16) | (g << 8) | b; };
  const sunWarm = () => { const c = rig().get().sunCol; const b = c & 255; return Math.min(1, Math.max(0, (255 - b) / (255 - 0x52))); };

  function tick(t) {
    frames++;
    if (t - tLast > 500) {
      fpsEl.textContent = (frames * 1000 / (t - tLast)).toFixed(0) + ' fps'; frames = 0; tLast = t;
      for (const r of live) r.refresh();
      if (genEl && W.TREE_FILL && W.TREE_FILL.stat) { const S = W.TREE_FILL.stat();
        genEl.textContent = 'fill chunks: ' + S.live + ' live, ' + S.queued + ' queued; gen ' + S.gens + ' x ' +
          (S.gens ? ((S.walkMs + S.buildMs) / S.gens).toFixed(1) : '-') + ' ms (walk ' + (S.gens ? (S.walkMs / S.gens).toFixed(1) : '-') +
          ', build ' + (S.gens ? (S.buildMs / S.gens).toFixed(1) : '-') + '), worst frame ' + (S.frameMax || 0).toFixed(0) + ' ms'; }
    }
    raf = requestAnimationFrame(tick);
  }
  function toggle() {
    if (!root) {
      if (!have('WORLD') || !have('TREE_LEAF')) { console.warn('dev panel: the world is not up yet'); return false; }
      build();
    }
    const on = root.style.display === 'none' || !root.dataset.on;
    root.style.display = on ? '' : 'none';
    root.dataset.on = on ? '1' : '';
    if (on) { refresh(); tLast = performance.now(); frames = 0; raf = requestAnimationFrame(tick); }
    else cancelAnimationFrame(raf);
    return on;
  }
  window.addEventListener('keydown', e => {
    if (e.code !== 'F8') return;
    e.preventDefault(); e.stopImmediatePropagation();
    toggle();
  }, true);
  W.DEV_PANEL = { toggle, refresh };
})();
