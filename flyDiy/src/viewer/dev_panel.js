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
  let root = null, rows = [], raf = 0, fpsEl = null, frames = 0, tLast = 0;
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
  const refresh = () => { for (const r of rows) r.refresh(); };

  const lod = () => W.TREE_LOD, leaf = () => W.TREE_LEAF, rig = () => W.WORLD_RIG, world = () => W.WORLD;
  const setLod = (i, v) => { const b = lod().get(); b[i] = v; for (let k = i + 1; k < 3; k++) b[k] = Math.max(b[k], v); for (let k = 0; k < i; k++) b[k] = Math.min(b[k], v); lod().set(b); refresh(); };

  function build() {
    document.head.appendChild($('style', { text: CSS }));
    root = $('div', { id: 'devPanel' });
    fpsEl = $('i', { text: '' });
    root.appendChild($('div', { class: 'hd' }, [$('b', { text: 'DEVELOPER' }), fpsEl,
      (() => { const b = $('button', { text: 'close (F8)' }); b.onclick = toggle; return b; })()]));

    root.appendChild($('h4', { text: 'forest' }));
    root.appendChild(slider('fill density', 16, 320, 8, () => W.TREE_FILL.get(), v => W.TREE_FILL.set(v),
      v => v + ' (' + (1024 / v).toFixed(1) + ' m)'));
    root.appendChild(slider('L0 to (m)', 20, 600, 10, () => lod().get()[0], v => setLod(0, v), v => v + ' m'));
    root.appendChild(slider('L1 to (m)', 20, 600, 10, () => lod().get()[1], v => setLod(1, v), v => v + ' m'));
    root.appendChild(slider('L2 to (m)', 20, 800, 10, () => lod().get()[2], v => setLod(2, v), v => v + ' m'));
    root.appendChild(slider('fade window', 0, 100, 2, () => lod().fade(), v => lod().fade(v), v => v + ' m'));
    root.appendChild(note('impostors beyond L2; L0 = L1 = L2 is "L0 then impostor"; the window dithers one rung into the next'));
    root.appendChild(slider('imp lit', 0, 3, 0.05, () => world().treeLod.lit.value, v => { world().treeLod.lit.value = v; }));
    root.appendChild(slider('imp gain', 1, 12, 0.25, () => lod().imp().gain, v => lod().imp({ gain: v })));
    root.appendChild(slider('imp solid', 0, 1, 0.05, () => lod().imp().solid, v => lod().imp({ solid: v })));
    root.appendChild(slider('furnished', 0, 1, 0.05, () => W.TREE_MIX.furnished, v => { W.TREE_MIX.furnished = v; }));
    root.appendChild(slider('size spread', 0, 0.6, 0.02, () => W.TREE_MIX.spread, v => { W.TREE_MIX.spread = v; }));
    root.appendChild(note('furnished / spread take effect on the next fill re-grid (move the density)'));

    root.appendChild($('h4', { text: 'leaf' }));
    root.appendChild(slider('wrap', 0, 1, 0.02, () => leaf().get().wrap, v => leaf().set({ wrap: v })));
    root.appendChild(slider('sss', 0, 2, 0.02, () => leaf().get().sss, v => leaf().set({ sss: v })));
    root.appendChild(slider('sss power', 1, 8, 0.25, () => leaf().get().sssp, v => leaf().set({ sssp: v })));
    root.appendChild(slider('ao bake', 0, 4, 0.1, () => leaf().get().ao, v => leaf().set({ ao: v })));
    root.appendChild(slider('sharp', 0, 3, 0.05, () => leaf().sharp(), v => leaf().sharp(v)));
    root.appendChild(slider('master hue', -0.2, 0.2, 0.005, () => leaf().master().hue, v => leaf().tint({ hue: v }), v => v.toFixed(3)));
    root.appendChild(slider('master sat', 0, 1.5, 0.02, () => leaf().master().sat, v => leaf().tint({ sat: v })));
    root.appendChild(slider('master light', 0.2, 2, 0.02, () => leaf().master().light, v => leaf().tint({ light: v })));

    root.appendChild($('h4', { text: 'light' }));
    root.appendChild(select('rig row', [['sunset', 'sunset (the world’s)'], ['alps', 'alps afternoon (the bench’s)']],
      () => rigRowName, v => { rigRowName = v; rig().row(v); }));
    root.appendChild(slider('sun elev', 0, 90, 0.5, () => rig().get().elev, v => rig().set({ elev: v }), v => v.toFixed(1) + '°'));
    root.appendChild(slider('sun azimuth', -180, 180, 1, () => rig().get().azim, v => rig().set({ azim: v }), v => v.toFixed(0) + '°'));
    root.appendChild(slider('sun', 0, 5, 0.05, () => rig().get().sunI, v => rig().set({ sunI: v })));
    root.appendChild(slider('sun warmth', 0, 1, 0.02, () => sunWarm(), v => rig().set({ sunCol: warmHex(v) })));
    root.appendChild(slider('hemisphere', 0, 1.5, 0.02, () => rig().get().hemi, v => rig().set({ hemi: v })));
    root.appendChild(slider('exposure', 0.3, 2, 0.02, () => rig().get().exposure, v => rig().set({ exposure: v })));
    root.appendChild(select('environment', [['dome', 'the sky dome (baked at boot)'], ['alps', 'alps panorama (invisible)']],
      () => rig().get().env, v => rig().set({ env: v })));
    root.appendChild(slider('shadow reach', 105, 540, 5, () => rig().get().shadowMin, v => rig().set({ shadowMin: v }), v => '±' + v + ' m'));
    root.appendChild(select('shadow map', [['1024', '1024'], ['2048', '2048'], ['4096', '4096']],
      () => rig().get().shadowMap, v => rig().set({ shadowMap: +v })));

    root.appendChild($('h4', { text: 'camera' }));
    root.appendChild(slider('free cam speed', 1, 400, 1, () => W.DEV_CAM.speed, v => { W.DEV_CAM.speed = v; }, v => v + ' m/s'));
    root.appendChild(note('CAMERA → free: WASD/ZQSD, R/F up-down, Shift x5, drag to look'));
    document.body.appendChild(root);
  }
  let rigRowName = 'sunset';
  // the sun's colour as one warmth number: white at 0, the sunset's ffa652 at 1
  const warmHex = w => { const r = 255, g = Math.round(255 - (255 - 0xa6) * w), b = Math.round(255 - (255 - 0x52) * w); return (r << 16) | (g << 8) | b; };
  const sunWarm = () => { const c = rig().get().sunCol; const b = c & 255; return Math.min(1, Math.max(0, (255 - b) / (255 - 0x52))); };

  function tick(t) {
    frames++;
    if (t - tLast > 500) { fpsEl.textContent = (frames * 1000 / (t - tLast)).toFixed(0) + ' fps'; frames = 0; tLast = t; }
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
