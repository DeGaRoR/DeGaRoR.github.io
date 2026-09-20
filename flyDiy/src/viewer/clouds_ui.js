// ============================================================
// THE CLOUDS' OWN PANEL (2026-09-20, the user: "we need a proper UI for the
// cloud layers, as well as some settings covering the range of capabilities,
// also in a clear UI accessible from the left option bar").
//
// One flyout on the flight rail (`clouds`), in the rail's own rows and pills
// (app.js hands them in, the way GRAPHICS mounts), over two kinds of state:
//   THE WEATHER - the day's: the low deck (cover, type; its base is the
//     dewpoint's, an override here), two upper decks (cover, type, base) and
//     the cirrus veil. Presets pick a whole sky. Saved with the day
//     (day_clock.js: flydiy.day carries the cloud fields since this panel).
//   THE LOOK AND THE COST - the march's dials the player may want: how the
//     cloud is drawn (resolution, quality), how it looks (detail, erosion,
//     the shadow's strength and softness, the depth of the underside), how it
//     moves (the drift), which sky (the seed). Saved as flydiy.clouds and
//     applied over CLOUDS.S at boot - the developer's F8 fold keeps every
//     other dial.
// Every row writes through the same setters the F8 fold and the WORLD editor
// use (CLOUDS.S, DAY_CLOCK.set, CLOUD_FIELD.upperWith), so the three agree.
// ============================================================
var CLOUDS_UI = (function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const PREF = 'flydiy.clouds';
  // the dials this panel owns (a whitelist: what is saved and restored)
  const DIALS = ['detail', 'erodeK', 'shadow', 'shadowSoft', 'ambDepth', 'driftK', 'veil', 'veilKm', 'steps', 'lightSteps', 'seed', 'base'];
  const CL = () => (typeof CLOUDS !== 'undefined' ? CLOUDS : null);
  const S = () => (CL() ? CL().S : null);
  const CF = () => (typeof CLOUD_FIELD !== 'undefined' ? CLOUD_FIELD : null);
  const read = () => { try { return JSON.parse(W.localStorage.getItem(PREF) || 'null'); } catch (e) { return null; } };
  const save = () => { const s = S(); if (!s) return; const o = {}; for (const k of DIALS) o[k] = s[k]; try { W.localStorage.setItem(PREF, JSON.stringify(o)); } catch (e) {} };
  // apply(): the saved dials over CLOUDS.S (at boot, before the first frame draws)
  function apply() {
    const s = S(), o = read(); if (!s || !o) return;
    for (const k of DIALS) if (o[k] != null && isFinite(+o[k])) s[k] = +o[k];
  }
  // THE PRESETS: whole skies, as the day's fields (a pick is a set, not a mode - every row stays live)
  const PRESETS = [
    { k: 'clear',     label: 'clear',           day: { cloudCover: 0,    cloudType: 'cu', cloudUpper: null } },
    { k: 'fair',      label: 'fair weather',    day: { cloudCover: 0.25, cloudType: 'cu', cloudUpper: null } },
    { k: 'scattered', label: 'scattered',       day: { cloudCover: 0.45, cloudType: 'cu', cloudUpper: null } },
    { k: 'broken',    label: 'broken deck',     day: { cloudCover: 0.65, cloudType: 'sc', cloudUpper: null } },
    { k: 'overcast',  label: 'overcast',        day: { cloudCover: 0.9,  cloudType: 'st', cloudUpper: null } },
    { k: 'layered',   label: 'two decks',       day: { cloudCover: 0.35, cloudType: 'cu', cloudUpper: [{ cover: 0.4, type: 'ac' }] } },
    { k: 'high',      label: 'high sheet',      day: { cloudCover: 0.15, cloudType: 'cu', cloudUpper: [{ cover: 0.7, type: 'as' }] } },
    { k: 'storm',     label: 'storm',           day: { cloudCover: 0.5,  cloudType: 'cb', cloudUpper: [{ cover: 0.5, type: 'as', base: 6500 }] } },
  ];
  const presetOf = day => {
    const up = day.cloudUpper || [];
    for (const p of PRESETS) {
      const d = p.day, pu = d.cloudUpper || [];
      if (Math.abs(day.cloudCover - d.cloudCover) > 0.001 || day.cloudType !== d.cloudType || up.length !== pu.length) continue;
      if (pu.every((u, i) => Math.abs(up[i].cover - u.cover) < 0.001 && up[i].type === u.type)) return p.k;
    }
    return null;
  };
  // mount(host, H, ctx): H = { row, range, pills, note } the rail's helpers; ctx = { day: DAY_CLOCK, refresh }
  function mount(host, H, ctx) {
    const CK = ctx && ctx.day, cf = CF(), s = S();
    const refresh = () => { if (ctx && ctx.refresh) ctx.refresh(); };
    const head = txt => { const r = H.row(host, txt); r.classList.add('fsec'); return r; };   // the host's own row class kept (fr / r), a section head added
    if (!cf || !CK || !CK.day()) { H.note(host, 'This build has no cloud field.'); return; }
    const day = () => CK.day();
    const types = cf.TYPE_ORDER.map(t => ({ label: cf.TYPES[t].label, value: t }));
    // ---- presets ----------------------------------------------------------------------
    head('sky');
    H.pills(host, PRESETS.map(p => ({ label: p.label, value: p.k })), o => o.value === presetOf(day()), o => { const p = PRESETS.find(q => q.k === o.value); CK.set(p.day); refresh(); });
    // ---- the low deck -------------------------------------------------------------------
    head('low deck');
    H.range(host, 'cover', 0, 1, 0.05, () => day().cloudCover, v => { CK.set({ cloudCover: v }); refresh(); }, v => v > 0 ? (v * 100).toFixed(0) + ' %' : 'none');
    H.pills(host, types, o => o.value === day().cloudType, o => { CK.set({ cloudType: o.value }); refresh(); });
    if (s) H.range(host, 'base', 0, 4000, 50, () => s.base, v => { s.base = v; save(); },
      v => v > 0 ? v + ' m' : '≈' + Math.round(day().cloudBase) + ' m');   // 0 = the dewpoint's, shown
    // ---- the upper decks ----------------------------------------------------------------
    for (let di = 0; di < cf.MAX_LAYERS - 1; di++) {
      head('upper deck ' + (di + 1));
      const up = () => day().cloudUpper[di] || { cover: 0, type: 'ac' };
      const put = patch => { CK.set({ cloudUpper: cf.upperWith(day().cloudUpper, di, patch) }); refresh(); };
      H.range(host, 'cover', 0, 1, 0.05, () => up().cover, v => put({ cover: v }), v => v > 0 ? (v * 100).toFixed(0) + ' %' : 'none');
      if (up().cover > 0) {
        H.pills(host, types, o => o.value === up().type, o => put({ type: o.value }));
        H.range(host, 'base', 500, 9000, 100, () => (up().base != null ? up().base : cf.TYPES[cf.typeOf(up().type)].alt), v => put({ base: v }), v => v + ' m');
      }
    }
    // ---- the high veil ------------------------------------------------------------------
    if (s) {
      head('cirrus veil');
      H.range(host, 'amount', 0, 2.5, 0.05, () => s.veil, v => { s.veil = v; save(); }, v => v > 0 ? v.toFixed(2) + '×' : 'off');
      H.range(host, 'height', 5, 12, 0.5, () => s.veilKm, v => { s.veilKm = v; save(); }, v => v.toFixed(1) + ' km');
      // ---- the look -----------------------------------------------------------------------
      head('look');
      H.range(host, 'detail', 0, 0.8, 0.02, () => s.detail, v => { s.detail = v; save(); }, v => v.toFixed(2));
      H.range(host, 'erosion', 0.4, 1.6, 0.05, () => s.erodeK, v => { s.erodeK = v; save(); }, v => v.toFixed(2) + '×');
      H.range(host, 'underside depth', 0, 0.4, 0.01, () => s.ambDepth, v => { s.ambDepth = v; save(); }, v => v.toFixed(2));
      H.range(host, 'shadow', 0, 1, 0.05, () => s.shadow, v => { s.shadow = v; save(); }, v => v > 0 ? (v * 100).toFixed(0) + ' %' : 'off');
      H.range(host, 'shadow softness', 0.1, 1, 0.05, () => s.shadowSoft, v => { s.shadowSoft = v; save(); }, v => v.toFixed(2));
      // ---- the motion ---------------------------------------------------------------------
      head('motion');
      H.range(host, 'drift × wind', 0, 4, 0.1, () => s.driftK, v => { s.driftK = v; save(); }, v => v > 0 ? v.toFixed(1) + '×' : 'still');
      H.pills(host, [{ label: 'another sky (seed ' + s.seed + ')', value: 'seed' }], () => false, () => { s.seed = 1 + Math.floor(Math.random() * 98); save(); });
      // ---- the cost -----------------------------------------------------------------------
      head('render');
      const G = W.GFX;
      if (G && G.get) H.pills(host, [['off', 'off'], ['half', 'half resolution'], ['full', 'full resolution']].map(p => ({ label: p[1], value: p[0] })),
        o => o.value === G.get().clouds, o => G.set('clouds', o.value));
      H.pills(host, [{ label: 'fast', value: 24 }, { label: 'standard', value: 48 }, { label: 'fine', value: 96 }], o => o.value === s.steps, o => { s.steps = o.value; save(); });
      H.pills(host, [{ label: 'light x3', value: 3 }, { label: 'light x5', value: 5 }, { label: 'light x8', value: 8 }], o => o.value === s.lightSteps, o => { s.lightSteps = o.value; save(); });
      const c = CL();
      H.note(host, (c && c.baked ? 'GPU ' + c.stats.gpuMs.toFixed(2) + ' ms a frame. ' : '') +
        'The weather is the day’s and is kept with it; the look, motion and render settings are kept on this machine. ' +
        'The cover is what an observer on the ground would call it (the sky’s share); the base of the low deck is the dewpoint’s unless overridden.');
    }
  }
  const API = { PREFS: PREF, DIALS, PRESETS, presetOf, mount, apply, save, read };
  if (typeof window !== 'undefined') { window.CLOUDS_UI = API; API.apply(); }   // the saved dials over CLOUDS.S, at load
  return API;
})();
