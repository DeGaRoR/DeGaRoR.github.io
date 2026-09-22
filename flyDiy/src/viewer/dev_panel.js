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
  const color = (label, get, set) => {
    const inp = $('input', { type: 'color' }), out = $('output');
    const row = $('div', { class: 'r' }, [$('label', { text: label }), inp, out]);
    inp.oninput = () => { set(inp.value); out.textContent = inp.value; };
    rows.push({ el: row, refresh: () => { try { inp.value = get(); out.textContent = inp.value; } catch (e) {} } });
    return row;
  };
  const button = (label, fn) => { const b = $('button', { text: label }); b.onclick = () => { fn(); refresh(); }; return $('div', { class: 'r' }, [$('label', { text: '' }), b, $('output')]); };
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
      M.appendChild(note('water from the map: the cover\u2019s class 80 UNIONED with the imagery\u2019s NDWI (green vs NIR - water absorbs NIR), as a signed field (a smooth edge) and one flat surface per lake at the 85th percentile of the DEM under it. The bake\u2019s rivers run between them (the BLEND, the default: ?hydro=blend); ?hydro=map for the lakes alone, ?hydro=proc for the bake\u2019s own lakes and rivers.'));
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
      // ---- THE SPLAT (alpha splatting, 2026-09-20): the textures by terrain type ----
      const SP = world().ground.splat && world().ground.splat();
      if (SP) {
        const Sf = fold(M, 'splat (the textures by terrain type)', true, true);
        const ss = k => v => SP.set({ [k]: v });
        const kn = k => () => SP.knobs()[k];
        Sf.appendChild(select('splat', [['1', 'on'], ['0', 'off (the stack alone)']], () => String(SP.on() ? 1 : 0), v => SP.set({ on: +v })));
        Sf.appendChild(note('the ground drawn by terrain type from the library (17 sets): up to three sets per type mixed by the shared cloud mask, height-blended, hex-tiled, triplanar on the steep; the detail gives way to the aerial sets, then to the stack above. The bench (tools/_island.html) has the same knobs; `export` prints this browser\u2019s table.'));
        const LIB = [['', '- none -']].concat(SP.library().map(l => [l.key, `${l.key} (${l.metres} m)`]));
        const NAMES = SP.names();
        // THE TEXTURE PICKER: one surface at a time - its near and far triplets with their scales, the mask, the variation
        const Sp = fold(Sf, 'surfaces (the texture picker)', true, true);
        let cur = 2;
        const codeOpts = Object.keys(NAMES).filter(k => +k >= 2).map(k => [k, `${k} ${NAMES[k]}`]);
        Sp.appendChild(select('surface', codeOpts, () => String(cur), v => { cur = +v; }));
        Sp.appendChild(note('12 cliff, 13 forest old and 14 scrub dense are derived in the shader from rock / forest / scrub by slope and canopy (the splits below)'));
        const C = () => SP.code(cur) || { tex: [null, null, null], scale: [1, 1, 1], far: [null, null, null], farScale: [0, 0, 0], mix: [30, 3, 0, 0], vary: [0, 0, 20] };
        const setArr = (key, j, v) => { const c = C(); const a = (c[key] || [null, null, null]).slice(); a[j] = v; SP.setCode(cur, { [key]: a }); };
        const metres = k => { const l = SP.library().find(x => x.key === k); return l ? l.metres : 1; };
        ['A', 'B', 'C'].forEach((L, j) => {
          Sp.appendChild(select(`near ${L}`, LIB, () => C().tex[j] || '', v => { setArr('tex', j, v || null); if (v) setArr('scale', j, metres(v)); }));
          Sp.appendChild(slider(`  metres`, 0.5, 120, 0.5, () => C().scale[j], v => setArr('scale', j, v), v => v + ' m'));
        });
        ['A', 'B', 'C'].forEach((L, j) => {
          Sp.appendChild(select(`far ${L}`, LIB, () => (C().far || [])[j] || '', v => { setArr('far', j, v || null); if (v) setArr('farScale', j, metres(v)); }));
          Sp.appendChild(slider(`  metres`, 0.5, 120, 0.5, () => (C().farScale || [0, 0, 0])[j], v => setArr('farScale', j, v), v => v + ' m'));
        });
        Sp.appendChild(note('an empty far slot keeps the near set at distance; picking a set takes its own scale, then adjust'));
        Sp.appendChild(slider('mask cell', 2, 200, 1, () => C().mix[0], v => setArr('mix', 0, v), v => v + ' m'));
        Sp.appendChild(slider('mask sharpness', 0.1, 6, 0.1, () => C().mix[1], v => setArr('mix', 1, v)));
        Sp.appendChild(slider('bias A|B', -1, 1, 0.05, () => C().mix[2], v => setArr('mix', 2, v)));
        Sp.appendChild(slider('bias C', -1, 1, 0.05, () => C().mix[3], v => setArr('mix', 3, v)));
        Sp.appendChild(slider('hue swing', 0, 40, 1, () => (C().vary || [0, 0, 20])[0], v => setArr('vary', 0, v), v => v + '\u00b0'));
        Sp.appendChild(slider('value swing', 0, 0.6, 0.01, () => (C().vary || [0, 0, 20])[1], v => setArr('vary', 1, v)));
        Sp.appendChild(slider('vary cell', 2, 120, 1, () => (C().vary || [0, 0, 20])[2], v => setArr('vary', 2, v), v => v + ' m'));
        Sp.appendChild(select('orient', [['', 'as is'], ['sea', 'face the sea (the beach)']], () => C().orient || '', v => SP.setCode(cur, { orient: v || undefined })));
        // THE GRADE per set: a gain and a saturation - the sheet's numbers (tools/splat_sheet.py)
        const Sg = fold(Sf, 'grade (per set)', false, true);
        let gk = 'dry';
        Sg.appendChild(select('set', LIB.slice(1), () => gk, v => { gk = v; }));
        Sg.appendChild(color('gain', () => SP.grade(gk).gain, v => SP.setGrade(gk, { gain: v })));
        Sg.appendChild(slider('saturation', 0, 2, 0.05, () => SP.grade(gk).sat, v => SP.setGrade(gk, { sat: v })));
        Sg.appendChild(slider('gloss', 0, 1, 0.05, () => SP.grade(gk).gloss, v => SP.setGrade(gk, { gloss: v })));
        Sg.appendChild(note('gloss: the set’s roughness map as shipped at 1, matte at 0 (the near ring is a Standard material: wet sand, shingle and the pools catch the sun)'));
        const Sd = fold(Sf, 'distance \u00b7 macro', false, true);
        Sd.appendChild(slider('detail fades from', 0, 2000, 25, kn('detailFrom'), ss('detailFrom'), v => v + ' m'));
        Sd.appendChild(slider('detail gone by', 50, 4000, 25, kn('detailTo'), ss('detailTo'), v => v + ' m'));
        Sd.appendChild(slider('macro from', 0, 10000, 100, kn('macroFrom'), ss('macroFrom'), v => v + ' m'));
        Sd.appendChild(slider('macro full by', 100, 30000, 100, kn('macroTo'), ss('macroTo'), v => v + ' m'));
        Sd.appendChild(slider('macro strength', 0, 1, 0.05, kn('macroMix'), ss('macroMix')));
        Sd.appendChild(slider('macro tint under', 0, 1, 0.05, kn('macroNear'), ss('macroNear')));
        Sd.appendChild(slider('macro light kept', 0, 1, 0.05, kn('macroLum'), ss('macroLum')));
        Sd.appendChild(slider('albedo to imagery', 0, 1, 0.05, kn('albedoNorm'), ss('albedoNorm')));
        Sd.appendChild(note('albedo to imagery: each set\u2019s mean pulled onto the imagery\u2019s mean colour for the terrain types it stands on (one gain per channel per set, from the map\u2019s own pixels); 1 = the imagery is the level, 0 = the sets as shipped. The table is in the console at boot (SP.norm())'));
        Sd.appendChild(note('tint under: how much of the near ground’s colour is the imagery’s (the sets keep their texture); light kept: how much of the imagery’s own light and dark the tint carries (0 = the detail’s brightness, 1 = the imagery’s - the valley green, the slope brown, the flat pale)'));
        Sd.appendChild(note('the macro is the stack above (the Landsat albedo the game already ships); \u201ctint under\u201d gives the detail the place\u2019s colour, luminance kept'));
        const Sb = fold(Sf, 'blend \u00b7 tiling', false, true);
        Sb.appendChild(slider('blend radius', 0.5, 3, 0.1, kn('splatBlend'), ss('splatBlend'), v => v + ' cells'));
        Sb.appendChild(slider('edge wobble', 0, 40, 1, kn('splatWobble'), ss('splatWobble'), v => v + ' m'));
        Sb.appendChild(slider('zone seam depth', 0.02, 1, 0.02, kn('seamDepth'), ss('seamDepth')));
        Sb.appendChild(slider('height depth', 0.02, 1, 0.02, kn('hDepth'), ss('hDepth')));
        Sb.appendChild(select('hex tiling', [['1', 'on'], ['0', 'off']], () => String(SP.knobs().hexOn), v => SP.set({ hexOn: +v })));
        Sb.appendChild(slider('hex cells', 0.5, 6, 0.5, kn('hexN'), ss('hexN'), v => v + ' /tile'));
        Sb.appendChild(slider('hex rotation', 0, 180, 5, kn('hexRot'), ss('hexRot'), v => v + '\u00b0'));
        Sb.appendChild(slider('triplanar', 0, 16, 1, kn('triK'), ss('triK'), v => v ? 'k ' + v : 'off'));
        Sb.appendChild(slider('normal strength', 0, 3, 0.05, kn('nrmK'), ss('nrmK')));
        Sb.appendChild(slider('sheen', 0, 1, 0.05, kn('sheen'), ss('sheen')));
        Sb.appendChild(note('sheen: the sets’ roughness on the near ring (the muskeg pools, wet mud and bare rock catch the sun and the sky’s reflection); 0 is matte, the old look'));
        const Ss = fold(Sf, 'splits (derived surfaces)', false, true);
        Ss.appendChild(slider('cliff from', 10, 60, 1, kn('cliffLo'), ss('cliffLo'), v => v + '\u00b0'));
        Ss.appendChild(slider('cliff full at', 10, 70, 1, kn('cliffHi'), ss('cliffHi'), v => v + '\u00b0'));
        Ss.appendChild(slider('old growth from', 2, 30, 0.5, kn('oldLo'), ss('oldLo'), v => v + ' m'));
        Ss.appendChild(slider('old growth full', 2, 35, 0.5, kn('oldHi'), ss('oldHi'), v => v + ' m'));
        Ss.appendChild(slider('dense scrub from', 0, 5, 0.1, kn('denseLo'), ss('denseLo'), v => v + ' m'));
        Ss.appendChild(slider('dense scrub full', 0, 6, 0.1, kn('denseHi'), ss('denseHi'), v => v + ' m'));
        const Sm = fold(Sf, 'micro (puddles \u00b7 water\u2019s edge \u00b7 beach)', false, true);
        Sm.appendChild(slider('puddle wet', 0, 0.8, 0.01, kn('pudCover'), ss('pudCover')));
        Sm.appendChild(slider('puddle edge', 0.002, 0.05, 0.001, kn('pudEdge'), ss('pudEdge')));
        Sm.appendChild(slider('puddle scale', 0.5, 8, 0.5, kn('pudSlope'), ss('pudSlope'), v => 'x' + v));
        Sm.appendChild(slider('lake edge', 0.2, 8, 0.2, kn('lakeEdge'), ss('lakeEdge'), v => v + ' m'));
        Sm.appendChild(slider('beach angle', -180, 180, 5, kn('beachRot'), ss('beachRot'), v => v + '\u00b0'));
        // THE ROCK MAP (2026-09-22): the rocks' far tier - their top view projected on the ground where the meshes have faded
        const RM = world().ground.rockMap && world().ground.rockMap();
        if (RM) { const Sr = fold(Sf, 'rocks at distance (the rock map)', false, true);
          Sr.appendChild(select('rock map', [['1', 'on'], ['0', 'off (the meshes alone)']], () => String(RM.get().on ? 1 : 0), v => RM.set({ on: !!+v })));
          Sr.appendChild(slider('half width', 300, 2000, 50, () => RM.get().half, v => { RM.set({ half: v }); RM.replan(); }, v => v + ' m'));
          Sr.appendChild(slider('re-centre at', 100, 900, 25, () => RM.get().recentre, v => RM.set({ recentre: v }), v => v + ' m'));
          Sr.appendChild(button('replan', () => RM.replan()));
          Sr.appendChild(note('the cover ring plants the rocks within 220 m and thins them by its fade law; the same rocks are drawn top-down into a map over this half width (1 m a texel) and the ground reads it where the meshes have gone - one sampler, ?rockmap=0 for the A/B')); }
        Sf.appendChild(button('reset to the recipe', () => SP.reset()));
        Sf.appendChild(button('export (console)', () => { const j = SP.export(); console.log('SPLAT RECIPE ' + j); try { navigator.clipboard && navigator.clipboard.writeText(j); } catch (e) {} }));
        Sf.appendChild(note('remembered in this browser; `export` prints the table to the console (and the clipboard) - paste it into 28b_ground_fields.js RECIPE to make it the default'));
      }
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
    // ---- THE BIOMES (L4, 2026-09-21; BIOMES-IN-GAME-2026-09-20.md): the code -> mix map, the mixes'
    // own numbers, the cover ring, and the export back to tools/_trees_tuning.json ----
    if (W.TREE_FILL.biomes && W.TREE_FILL.biomes()) {
      const BIO = W.TREE_FILL.biomes(), TF = W.TREE_FILL;
      const B = fold(T, 'biomes', true, true);
      B.appendChild(note('a terrain-type code names a bench mix; the fill and the woodland draw their species from it, the cover ring plants its grass, flowers, rocks and bushes. Every number here is the bench’s (tools/_trees_tuning.json mixes) moved live; `export` prints the map + the mixes for that file, then `python tools/tree_prep.py` bakes the payload.'));
      { const n = note(''); const R = { el: n, refresh: () => { const c = TF.cover && TF.cover(); const st = c && c.stat(); n.textContent = st ? ('under the eye: ' + (st.mixAt || 'no biome') + ' · ring ' + st.live + ' cells / ' + st.instances + ' instances, ' + st.lastMs.toFixed(1) + ' ms last build · ' + st.agl.toFixed(0) + ' m AGL') : 'no cover ring'; } };
        B.appendChild(n); rows.push(R); live.push(R); }
      const mixNames = Object.keys(BIO.mixes);
      const isl = k => v => TF.setIsland({ [k]: v });
      B.appendChild(slider('biome gain', 0.5, 8, 0.1, () => TF.island().biomeGain, isl('biomeGain')));
      B.appendChild(slider('wobble', 0, 30, 1, () => TF.island().biomeWobble, isl('biomeWobble'), v => v + ' m'));
      B.appendChild(note('gain: a mix’s trees per m² over the grid’s (3.5 puts the conifer at the grid’s full density); wobble: the code read this far off the point on a 23 m noise, so a biome edge is not the map’s cell edge'));
      const Bm = fold(B, 'code → mix (the map)', true, true);
      for (const code of Object.keys(BIO.names).map(Number).filter(c => c >= 2)) {
        Bm.appendChild(select(code + ' ' + BIO.names[code], [['', '— none']].concat(mixNames.map(m => [m, m])),
          () => BIO.map[code] || '', v => TF.setBiome(code, v || null)));
      }
      Bm.appendChild(note('12 cliff, 13 old forest, 14 dense scrub are derived from rock / forest / scrub by slope and canopy (the splat’s knobs); none = nothing planted (sea, lake, snow, built)'));
      // the mixes: each one a fold of its forest knobs and its species rows
      const Bx = fold(B, 'the mixes', false, true);
      const spKind = name => { const P = W.TREE_PACK, c = P && P.collections.find(q => q.name === name); return c ? (c.kind || 'tree') : '?'; };
      for (const name of mixNames) {
        const M = BIO.mixOf(name), Fm = fold(Bx, name, false, true), F = () => (BIO.mixOf(name).forest || (BIO.mixOf(name).forest = {}));
        const fs = k => v => TF.setMix(name, ['forest', k], v);
        Fm.appendChild(slider('trees', 0, 1500, 10, () => F().count || 0, fs('count'), v => v + ' (' + (BIO.density(name) * 10000).toFixed(1) + '/ha)'));
        Fm.appendChild(slider('shrubs', 0, 20, 0.5, () => F().under || 0, fs('under'), v => v + ' /1000 m²'));
        Fm.appendChild(slider('rocks', 0, 30, 0.5, () => F().rocks || 0, fs('rocks'), v => v + ' /1000 m²'));
        Fm.appendChild(slider('blotch', 0, 1, 0.05, () => F().blotch || 0, fs('blotch')));
        Fm.appendChild(slider('blotch m', 4, 60, 1, () => F().blotchM || 18, fs('blotchM'), v => v + ' m'));
        Fm.appendChild(slider('cover spread', 0, 0.5, 0.01, () => F().coverSpread || 0, fs('coverSpread')));
        for (const sp of Object.keys(M.species || {})) {
          const row = () => BIO.mixOf(name).species[sp], kind = spKind(sp), Fs = fold(Fm, sp + ' (' + kind + ')', false, true);
          const ss = k => v => TF.setMix(name, ['species', sp, k], v);
          Fs.appendChild(slider('proportion', 0, 4, 0.05, () => row().proportion === undefined ? 1 : row().proportion, ss('proportion')));
          if (kind === 'tree') Fs.appendChild(slider('dead', 0, 0.5, 0.01, () => row().dead || 0, ss('dead')));
          if (kind === 'cover') {
            Fs.appendChild(slider('density', 0, 6, 0.05, () => row().density || 0, ss('density'), v => v + ' /m²'));
            Fs.appendChild(slider('patch', 0, 20, 0.5, () => row().patch || 0, ss('patch'), v => v ? v + ' m' : 'even'));
            Fs.appendChild(slider('patch share', 0, 1, 0.05, () => row().patchShare === undefined ? 0.25 : row().patchShare, ss('patchShare')));
          }
          if (kind === 'rock') Fs.appendChild(slider('size', 1, 40, 1, () => row().size || 1, ss('size')));
        }
      }
      // the cover ring's own dials
      if (TF.cover && TF.cover()) {
        const Bc = fold(B, 'the cover ring', false, true), C = () => TF.cover(), cs = k => v => C().set({ [k]: v });
        Bc.appendChild(slider('reach', 60, 400, 10, () => C().get().reach, cs('reach'), v => v + ' m'));
        Bc.appendChild(slider('full to', 10, 200, 5, () => C().get().near, cs('near'), v => v + ' m'));
        Bc.appendChild(slider('taper', 0, 1, 0.05, () => C().get().taper, cs('taper')));
        Bc.appendChild(slider('AGL full', 10, 200, 5, () => C().get().aglFull, cs('aglFull'), v => v + ' m'));
        Bc.appendChild(slider('AGL off', 30, 400, 5, () => C().get().aglOff, cs('aglOff'), v => v + ' m'));
        Bc.appendChild(slider('density', 0, 2, 0.05, () => C().get().density, cs('density')));
        Bc.appendChild(slider('shrubs', 0, 2, 0.05, () => C().get().shrubs, cs('shrubs')));
        Bc.appendChild(slider('rocks', 0, 2, 0.05, () => C().get().rocks, cs('rocks')));
        Bc.appendChild(slider('build ms', 0.5, 12, 0.5, () => C().get().budgetMs, cs('budgetMs'), v => v + ' ms'));
        Bc.appendChild(note('the ring fades in the vertex shader: full to `full to`, gone at `reach` (taper shapes the thinning), full under `AGL full`, gone above `AGL off`; density / shrubs / rocks scale the mix’s numbers and replant'));
      }
      B.appendChild(button('export (console)', () => { const j = BIO.export(); console.log('BIOMES ' + j); try { navigator.clipboard && navigator.clipboard.writeText(j); } catch (e) {} }));
      B.appendChild(note('export prints { biomes, mixes } to the console (and the clipboard): paste them over the two keys of tools/_trees_tuning.json, then `python tools/tree_prep.py` bakes the payload (TREE_PACK.biomes) - the bench reads the same file'));
    }
    T.appendChild(slider('fill density', 16, 400, 8, () => W.TREE_FILL.get(), v => W.TREE_FILL.set(v),
      v => v + ' (' + (1024 / v).toFixed(1) + ' m)'));
    // THE THINNING (G420, the row owed there): the complement's impostors keep
    // every tree to `thin from`, a quarter (the base's share) by `thin to`
    if (W.TREE_FILL.thin) {
      const th = () => W.TREE_FILL.thin();
      T.appendChild(slider('thin from', 500, 8000, 100, () => th()[0], v => W.TREE_FILL.thin(v, th()[1]), v => v + ' m'));
      T.appendChild(slider('thin to', 1000, 9000, 100, () => th()[1], v => W.TREE_FILL.thin(th()[0], v), v => v + ' m'));
      T.appendChild(note('one grid in two parts: the base (every 2nd point each way) stands to the ring\u2019s edge, the complement inside the fill reach thins in the shader between these two distances - no chunk is regenerated on approach'));
    }
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
    // S7: the glare's dials (the corona in the sky, the flare's glow / ghosts / streak) and the mist's
    A.appendChild(slider('corona', 0, 3, 0.05, () => (W.ATMO && W.ATMO.U.glare ? W.ATMO.U.glare.value : NaN), v => { if (W.ATMO && W.ATMO.U.glare) { W.ATMO.U.glare.value = v; W.ATMO.glareDial = v; } }));
    A.appendChild(slider('flare glow', 0, 3, 0.05, () => (W.SKY_GLARE ? W.SKY_GLARE.S.glow : NaN), v => { if (W.SKY_GLARE) W.SKY_GLARE.S.glow = v; }));
    A.appendChild(slider('flare ghosts', 0, 3, 0.05, () => (W.SKY_GLARE ? W.SKY_GLARE.S.ghosts : NaN), v => { if (W.SKY_GLARE) W.SKY_GLARE.S.ghosts = v; }));
    A.appendChild(slider('flare streak', 0, 3, 0.05, () => (W.SKY_GLARE ? W.SKY_GLARE.S.streak : NaN), v => { if (W.SKY_GLARE) W.SKY_GLARE.S.streak = v; }));
    const mist = () => (W.ATMO ? W.ATMO.MIST : null);
    A.appendChild(slider('mist density', 0, 6, 0.1, () => (mist() ? mist().k : NaN), v => { if (mist()) mist().k = v; }, v => v.toFixed(1) + 'x' + (mist() && mist().rho0 > 0 ? ' · vis ' + (3 / mist().rho0 / 1000).toFixed(1) + ' km' : ' · none (dry air)')));
    A.appendChild(slider('mist top', -20, 600, 5, () => (mist() ? mist().top : NaN), v => { if (mist()) mist().top = v; }, v => v + ' m ASL'));
    A.appendChild(slider('mist thickness', 5, 300, 5, () => (mist() ? mist().H : NaN), v => { if (mist()) mist().H = v; }, v => v + ' m'));
    A.appendChild(slider('mist forward', 0, 3, 0.1, () => (mist() ? mist().fwd : NaN), v => { if (mist()) mist().fwd = v; }));
    A.appendChild(note('the mist’s density is the day’s humidity (dry below 70 %); the GRAPHICS menu switches glare and mist off'));
    const lamps = () => (W.WORLD && W.WORLD.premises && W.WORLD.premises.lamps) ? W.WORLD.premises.lamps : null;
    A.appendChild(slider('village lamps', 0, 6, 0.1, () => (lamps() ? lamps().gain : NaN), v => { if (lamps()) lamps().gain = v; }, v => v.toFixed(1) + 'x' + (lamps() ? ' · ' + (W.WORLD.premises.stats.litNow || 0) + ' lit' : '')));
    { const n = note(''); const R = { el: n, refresh: () => { const S = W.SKY_LIGHT, K = S && S.K(); n.textContent = K && K.K_SUN ? `K_sun ${K.K_SUN.toFixed(2)} K_hemi ${K.K_HEMI.toFixed(2)} · ${S.isMoon ? 'the moon is the key' : 'the sun is the key'} · exposure base ${(W.GFX && W.GFX.exposureBase ? W.GFX.exposureBase() : 0).toFixed(3)}` : 'atmosphere off (painted dome)'; } }; rows.push(R); live.push(R); A.appendChild(n); }
    A.appendChild(note('the rig row’s sun / hemisphere / exposure below are GAINS on the alps anchors (2.8 / 0.274 / 0.92) under the physical sky'));
    // ---- THE CLOUDS (C1): the day's cover and type drive the field; the rest are the march's dials ----
    {
      const Cf = fold(root, 'clouds', true), cl = () => W.CLOUDS || null, cs = () => (W.CLOUDS ? W.CLOUDS.S : null);
      const types = (typeof CLOUD_FIELD !== 'undefined') ? CLOUD_FIELD.TYPE_ORDER.map(t => [t, CLOUD_FIELD.TYPES[t].label + ' (' + CLOUD_FIELD.TYPES[t].thick + ' m)']) : [['cu', 'cumulus']];
      Cf.appendChild(select('type', types, () => (dy() ? dy().cloudType : 'cu'), v => { if (ck()) ck().set({ cloudType: v }); }));
      Cf.appendChild(slider('cover', 0, 1, 0.02, () => (dy() ? dy().cloudCover : NaN), v => { if (ck()) ck().set({ cloudCover: v }); }, v => (v * 100).toFixed(0) + ' %'));
      // THE UPPER DECKS (A6): cover / type / base per deck above the low one
      if (typeof CLOUD_FIELD !== 'undefined') for (let di = 0; di < CLOUD_FIELD.MAX_LAYERS - 1; di++) {
        const up = () => (dy() ? dy().cloudUpper[di] : null) || { cover: 0, type: 'ac' };
        const put = patch => { if (ck()) ck().set({ cloudUpper: CLOUD_FIELD.upperWith(dy().cloudUpper, di, patch) }); };
        Cf.appendChild(slider('upper deck ' + (di + 1), 0, 1, 0.05, () => up().cover, v => put({ cover: v }), v => v > 0 ? (v * 100).toFixed(0) + ' %' : 'none'));
        Cf.appendChild(select('deck ' + (di + 1) + ' type', types, () => up().type, v => put({ type: v })));
        Cf.appendChild(slider('deck ' + (di + 1) + ' base', 500, 9000, 100, () => (up().base != null ? up().base : CLOUD_FIELD.TYPES[CLOUD_FIELD.typeOf(up().type)].alt), v => put({ base: v }), v => v + ' m'));
      }
      Cf.appendChild(slider('seed', 1, 99, 1, () => (cs() ? cs().seed : NaN), v => { if (cs()) cs().seed = v; }));
      Cf.appendChild(slider('erode', 0, 2, 0.05, () => (cs() ? cs().erodeK : NaN), v => { if (cs()) cs().erodeK = v; }, v => v.toFixed(2) + ' x the type’s'));
      Cf.appendChild(select('cover fit', [['1', 'the map fitted to the sky’s share (METAR cover)'], ['0', 'off: the map’s covered fraction = the cover']], () => (cs() ? String(cs().calCover) : '1'), v => { if (cs()) cs().calCover = +v; }));
      Cf.appendChild(slider('ambient depth', 0, 0.5, 0.01, () => (cs() ? cs().ambDepth : NaN), v => { if (cs()) cs().ambDepth = v; }, v => v.toFixed(2) + ' (the core darker than the fringe)'));
      Cf.appendChild(slider('base override', 0, 4000, 50, () => (cs() ? cs().base : NaN), v => { if (cs()) cs().base = v; }, v => v > 0 ? v + ' m' : 'the day’s (dewpoint)'));
      Cf.appendChild(slider('thickness override', 0, 5000, 100, () => (cs() ? cs().thick : NaN), v => { if (cs()) cs().thick = v; }, v => v > 0 ? v + ' m' : 'the type’s'));
      Cf.appendChild(slider('density', 0.005, 0.15, 0.005, () => (cs() ? cs().sigma : NaN), v => { if (cs()) cs().sigma = v; }, v => v.toFixed(3) + ' /m'));
      Cf.appendChild(slider('detail', 0, 0.8, 0.02, () => (cs() ? cs().detail : NaN), v => { if (cs()) cs().detail = v; }));
      Cf.appendChild(slider('curl', 0, 1, 0.05, () => (cs() ? cs().curl : NaN), v => { if (cs()) cs().curl = v; }));
      Cf.appendChild(slider('scale', 0, 30000, 500, () => (cs() ? cs().period : NaN), v => { if (cs()) cs().period = v; }, v => v > 0 ? v + ' m' : 'the type’s'));
      Cf.appendChild(slider('phase g', 0, 0.95, 0.01, () => (cs() ? cs().g : NaN), v => { if (cs()) cs().g = v; }));
      Cf.appendChild(slider('powder', 0, 1, 0.05, () => (cs() ? cs().powder : NaN), v => { if (cs()) cs().powder = v; }));
      Cf.appendChild(slider('multi-scatter', 0, 0.9, 0.05, () => (cs() ? cs().ms : NaN), v => { if (cs()) cs().ms = v; }));
      Cf.appendChild(slider('ambient', 0, 3, 0.05, () => (cs() ? cs().ambK : NaN), v => { if (cs()) cs().ambK = v; }));
      Cf.appendChild(slider('sun', 0, 3, 0.05, () => (cs() ? cs().sunK : NaN), v => { if (cs()) cs().sunK = v; }));
      Cf.appendChild(slider('steps', 8, 96, 4, () => (cs() ? cs().steps : NaN), v => { if (cs()) cs().steps = v; }));
      Cf.appendChild(slider('light steps', 1, 8, 1, () => (cs() ? cs().lightSteps : NaN), v => { if (cs()) cs().lightSteps = v; }));
      Cf.appendChild(slider('drift', 0, 4, 0.1, () => (cs() ? cs().driftK : NaN), v => { if (cs()) cs().driftK = v; }, v => v.toFixed(1) + 'x the wind'));
      Cf.appendChild(slider('shadow', 0, 1, 0.05, () => (cs() ? cs().shadow : NaN), v => { if (cs()) cs().shadow = v; }, v => v > 0 ? (v * 100).toFixed(0) + ' % of the layer’s' : 'off'));
      Cf.appendChild(slider('shadow softness', 0.1, 1, 0.05, () => (cs() ? cs().shadowSoft : NaN), v => { if (cs()) cs().shadowSoft = v; }, v => v.toFixed(2) + ' x sigma (the light round the cloud)'));
      Cf.appendChild(select('upsample', [['1', 'depth-aware 3x3 (the ridge keeps its edge)'], ['0', 'nearest']], () => (cs() ? String(cs().upsample) : '1'), v => { if (cs()) cs().upsample = +v; }));
      Cf.appendChild(slider('jitter', 0, 1, 0.05, () => (cs() ? cs().jitter : NaN), v => { if (cs()) cs().jitter = v; }, v => v.toFixed(2) + ' of a step (grain against banding, near only)'));
      Cf.appendChild(slider('veil', 0, 2.5, 0.05, () => (cs() ? cs().veil : NaN), v => { if (cs()) cs().veil = v; }, v => v > 0 ? v.toFixed(2) + ' x the type’s share of the cover' : 'off'));
      Cf.appendChild(slider('veil height', 5, 12, 0.5, () => (cs() ? cs().veilKm : NaN), v => { if (cs()) cs().veilKm = v; }, v => v.toFixed(1) + ' km'));
      Cf.appendChild(slider('sky under cloud', 0, 2, 0.05, () => (cs() ? cs().hemiUnderCloud : NaN), v => { if (cs()) cs().hemiUnderCloud = v; }, v => '+' + (v * 100).toFixed(0) + ' % diffuse at full cover'));
      Cf.appendChild(select('in cloud', [['1', 'the mist takes the layer at the eye'], ['0', 'off']], () => (cs() ? String(cs().inCloud) : '1'), v => { if (cs()) cs().inCloud = +v; }));
      Cf.appendChild(select('resolution', [['off', 'off'], ['half', 'half'], ['full', 'full']], () => (cs() ? cs().mode : 'off'),
        v => { if (cs()) { cs().mode = v; if (W.FLYDIY_AA && W.FLYDIY_AA.needRT) W.FLYDIY_AA.needRT(v !== 'off'); } }));
      { // the layer, read out
        const n = note('');
        const R = { el: n, refresh: () => { const c = cl(), Ls = (c && c.layers) || []; n.textContent = !c ? 'no clouds module' : !c.ready ? 'clouds: no 3D targets' : Ls.map((L, i) => `${L.type} ${L.base.toFixed(0)}-${L.top.toFixed(0)} m ${(L.cover * 100).toFixed(0)} % (map ${((c.stats.covers && c.stats.covers[i] || 0) * 100).toFixed(0)} %)`).join(' · ') + ' · ' + (c.baked ? `GPU ${c.stats.gpuMs.toFixed(2)} ms + shadow ${c.stats.shadowMs.toFixed(2)} ms (CPU ${c.stats.ms.toFixed(2)})` : `baking ${c.stats.slicesBaked}/129`) + (c.active ? '' : ' · idle'); } };
        rows.push(R); live.push(R);
        Cf.appendChild(n);
      }
      Cf.appendChild(note('the GRAPHICS menu switches the clouds off / half / full; cover and type are the day’s (the WORLD editor and CONDITIONS carry them)'));
    }
    // ---- ENVIRONMENT: the light, the air, the ground's shading, surfaced ----------
    const E = fold(root, 'environment', true);
    if (world() && world().envAlbedo) {
      E.appendChild(slider('albedo', 0.2, 1.5, 0.02, () => world().envAlbedo(), v => world().envAlbedo(v)));
      E.appendChild(note('one gain over the ground (after the splat) and the vegetation (leaf light + impostor lit) - the environment alone; the aeroplane, the buildings and the sky keep theirs'));
    }
    E.appendChild(select('rig row', [['sunset', 'sunset (the world’s)'], ['alps', 'alps afternoon (the bench’s)'], ['island', 'island (alps, hemisphere x2)']],
      () => rigRowName, v => { rigRowName = v; rig().row(v); }));
    // dragging either sun slider takes the rig MANUAL (the clock fold above hands it back)
    E.appendChild(slider('sun elev', 0, 90, 0.5, () => rig().get().elev, v => rig().set({ manual: true, elev: v }), v => v.toFixed(1) + '°'));
    E.appendChild(slider('sun azimuth', -180, 180, 1, () => rig().get().azim, v => rig().set({ manual: true, azim: v }), v => v.toFixed(0) + '°'));
    E.appendChild(slider('sun', 0, 5, 0.05, () => rig().get().sunI, v => rig().set({ sunI: v })));
    E.appendChild(slider('sun warmth', 0, 1, 0.02, () => sunWarm(), v => rig().set({ sunCol: warmHex(v) })));
    E.appendChild(slider('hemisphere', 0, 1.5, 0.02, () => rig().get().hemi, v => rig().set({ hemi: v })));
    E.appendChild(note('the hemisphere is the WORLD’s one ambient - its sky half is the day’s irradiance, its ground half the rig row’s average ground (every slope and underside out there, not this aeroplane’s)'));
    // THE GROUND UNDER THE CRAFT (2026-09-22): the probe's cap, which IS the aeroplane's ambient
    // from below - what it is now, what it is easing to, and what the probe last baked over.
    // (the panel can be built before the world is - every read is inside the refresh, guarded, the
    // way the K_sun line above is: `live` calls these with no try/catch of its own)
    { const n = note(''); const R = { el: n, refresh: () => {
        const g = (rig() && rig().groundUnder) ? rig().groundUnder() : null;
        if (!g) { n.textContent = 'the ground under the craft: (no world yet)'; return; }
        const f = a => a ? a.map(v => v.toFixed(3)).join('/') : '-';
        const mix = Object.keys(g.mix || {}).map(k => k.toLowerCase() + ' ' + Math.round(100 * g.mix[k] / 16) + '%').join(', ');
        n.textContent = `the ground under the craft: ${mix || '-'} over ±${g.r.toFixed(0)} m → cap ${f(g.alb)}` +
          `${g.pin ? ' (PINNED)' : ''} · baked ${f(g.baked)} (${g.bakes} bakes)`; } };
      rows.push(R); live.push(R); E.appendChild(n); }
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
    // THE WATER SHADER'S DIALS (H6, G460): the tier, the wind the ripples and the roughness read, the
    // bands' switches, the presets' colours, the debug views and a test texture in the interaction slot
    const WT = () => W.WATER || null;
    const Ewt = fold(E, 'the water shader', false, true);
    Ewt.appendChild(select('tier', [['full', 'full (ripples, lifted near sea, foam)'], ['simple', 'simple (the swell’s shading, the glitter)']], () => WT() ? WT().S.tier : 'full', v => WT() && WT().set({ tier: v })));
    Ewt.appendChild(slider('wind (ripples, glitter)', 0, 20, 0.5, () => WT() && WT().uniforms ? WT().uniforms.uWWind.value.x : NaN, v => WT() && WT().setWind(v, WT().uniforms ? Math.atan2(WT().uniforms.uWDir.value.y, WT().uniforms.uWDir.value.x) : 0), v => v + ' m/s'));
    Ewt.appendChild(slider('ripple strength', 0, 2, 0.05, () => WT() ? WT().S.detailK : NaN, v => { const w = WT(); if (w) { w.set({ detailK: v }); w.setWind(w.uniforms.uWWind.value.x, Math.atan2(w.uniforms.uWDir.value.y, w.uniforms.uWDir.value.x)); } }));
    Ewt.appendChild(slider('ripple tile (m)', 1, 8, 0.1, () => WT() ? WT().S.detailL[0] : NaN, v => WT() && WT().set({ detailL: [v, WT().S.detailL[1]] }), v => v.toFixed(1) + ' m'));
    Ewt.appendChild(slider('swell shading', 0, 1.5, 0.05, () => WT() ? WT().PRESETS.sea.wave : NaN, v => WT() && WT().set({ presets: { sea: { wave: v } } })));
    Ewt.appendChild(slider('shore fade (m)', 0.5, 12, 0.5, () => WT() ? WT().S.shoreFade : NaN, v => WT() && WT().set({ shoreFade: v }), v => v + ' m'));
    Ewt.appendChild(slider('crest foam at', 0.2, 2, 0.02, () => WT() ? WT().PRESETS.sea.foam : NaN, v => WT() && WT().set({ presets: { sea: { foam: v } } })));
    Ewt.appendChild(select('roughness law', [['1', 'slope variance (Bruneton)'], ['0', 'off (the material’s own)']], () => WT() && WT().S.sigma ? '1' : '0', v => WT() && WT().set({ sigma: v === '1' })));
    Ewt.appendChild(select('lifted near sea', [['1', 'on (the swell in the vertices)'], ['0', 'off (flat, shaded)']], () => WT() && WT().S.displace ? '1' : '0', v => WT() && WT().set({ displace: v === '1' })));
    Ewt.appendChild(select('debug view', [['0', 'the water'], ['1', 'normal'], ['2', 'roughness'], ['3', 'slope variance'], ['4', 'depth'], ['5', 'foam'], ['6', 'alpha'], ['7', 'body'], ['8', 'height']], () => String(WT() ? WT().S.dbg : 0), v => WT() && WT().set({ dbg: +v })));
    // THE INTERACTION SLOT'S TEST TEXTURE: a painted V of ripples (the shape H7 will write live) under
    // the aeroplane, the box snapped to whole metres so it does not swim with the CG
    Ewt.appendChild(select('interaction slot', [['0', 'empty'], ['1', 'a test V under the aeroplane']], () => (WT() && WT().uniforms && WT().uniforms.uWInterBox.value.w > 0.5) ? '1' : '0', v => {
      const w = WT(); if (!w || !W.THREE) return;
      if (v !== '1') { w.setInteraction(null); return; }
      const size = 80, t = w.paintTestV(W.THREE, 128, size);
      const cg = (W.FLIGHT_PROBE && W.FLIGHT_PROBE.sim) ? W.FLIGHT_PROBE.sim().cgPos() : [0, 0, 0];
      w.setInteraction(t, Math.round(cg[0]) - size / 2, Math.round(cg[2]) - size / 2, size);
    }));
    // THE LIVE FIELD (H7, G460.8): the game steps it while a floatplane is over water; this row drives it
    // under any aeroplane (a wheeled build has no hydro) and the button drops a splash under the CG
    Ewt.appendChild(select('interaction field (H7)', [['0', 'the game\'s (floats over water)'], ['1', 'forced on under the aeroplane']], () => (WT() && WT().field && WT().field.force) ? '1' : '0', v => { const w = WT(); if (!w || !w.field) return; w.field.force = v === '1'; if (!w.field.force) w.fieldOn(false); }));
    Ewt.appendChild(button('a test splash under the CG', () => { const w = WT(); if (!w || !w.field || !w.field.on) return; const cg = (W.FLIGHT_PROBE && W.FLIGHT_PROBE.sim) ? W.FLIGHT_PROBE.sim().cgPos() : [0, 0, 0]; w.stamp(cg[0], cg[2], 1.6, -0.6, 0.9, 'ring'); }));
    Ewt.appendChild(note('one material for every water (water.js): SEA.W in GLSL (the parity is GATE WATER’s), a ripple tile on the wind, the sub-pixel slope variance as roughness; ?water=0 for the stock A/B'));
    // ---- FRAME, CAMERA -------------------------------------------------------
    const F = fold(root, 'frame', false);
    F.appendChild(select('AA tier', [['full', 'smoothest (8x MSAA + 1.25x)'], ['msaa', 'smooth (8x MSAA)'], ['off', 'off (4x MSAA)']],
      () => (W.FLYDIY_AA && W.FLYDIY_AA.tier) ? W.FLYDIY_AA.tier() : 'full', v => { if (W.FLYDIY_AA) W.FLYDIY_AA.setTier(v); }));
    F.appendChild(note('measured (tree_perf, densest stand, bands 60/132/270, NG 112): smooth ~24 ms, smoothest ~29; with geometry to 450 m: 32 / 38'));
    { // the post passes' cost (post_fx.js): the GPU timer per pass, the eye's factor - the GRAPHICS menu switches them
      const n = note('');
      const R = { el: n, refresh: () => { const P = W.POST_FX; if (!P) { n.textContent = 'no post_fx module'; return; }
        const on = P.KEYS.filter(k => P.S[k] !== 'off');
        n.textContent = !on.length ? 'post fx: all off (no hook, no target)' : 'post fx: ' + on.map(k => k + ' ' + P.S[k] + (P.stats[k + 'Ms'] ? ' ' + P.stats[k + 'Ms'].toFixed(2) + ' ms' : '')).join(' · ')
          + (P.S.eye !== 'off' ? ' · eye x' + P.stats.eyeK.toFixed(2) + ' (mean ' + P.stats.eyeLum.toFixed(2) + ')' : ''); } };
      rows.push(R); live.push(R);
      F.appendChild(n);
    }
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
