// groundfx_look.js - GROUND-FX's knobs for the WORLD EDITOR (world_rail.js, F9 > "ground fx") (2026-11-16)
//
// THE USER, 16 Nov (via A0): every new world setting must be editable in the world editor, so the look can be hand-tuned
// after the credits run out - the dust and the mud count. This is the table of those knobs over the objects that already
// hold them (no copies): dust.js's LOOK (the drawn look), L (the laws: the rates, the clouds' life and shape) and CLS (per
// surface class: how much dust and grit it gives, its colour, a wet class's throw), aeroweather.js's AERO_MUD (the mud coat
// on the aeroplane today) and ground_deposit.js's K / PBR / DEF / SP (the computed mud and dust film, the drying, the reach).
// A row is [id, label, lo, hi, step, unit]; the id is 'handle:path.to.key' (dust, wx, gd). The rail draws a slider, a switch
// (a boolean) or a colour (an [r, g, b] in linear light) per row; the look keeps the DELTA against the values this file
// took the first time it was asked (the shipped ones: before any saved look is put back), the export lists it under
// "groundfx". A handle the page does not carry (ground_deposit.js before the page's mud grid) leaves its rows out.
// Pure: window.GROUNDFX_LOOK in the page, module.exports for GATE GFXLOOK (tools/_gfxlook_check.js), which binds the
// handles itself.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  let BOUND = null;   // node: { dust, wx, gd }
  const HANDLES = {
    dust: () => (BOUND ? BOUND.dust : W && W.DUST) || null,
    wx: () => { const a = BOUND ? BOUND.wx : W && W.AEROWX; return (a && a.AERO_MUD) ? { AERO_MUD: a.AERO_MUD } : null; },
    gd: () => (BOUND ? BOUND.gd : W && W.GROUND_DEPOSIT) || null,
  };

  // ---- THE ROWS, by group (the rail's cards) -----------------------------------------------------------------------
  const GROUPS = [
    { k: 'clouds', title: 'the dust clouds', sub: 'every dry surface: dirt, sand, gravel, grass, snow', open: true, rows: [
      ['dust:LOOK.dens', 'density', 0, 2, 0.01],
      ['dust:LOOK.fwdMax', 'backlit glow cap', 1, 6, 0.1],
      ['dust:LOOK.ground', 'colour from the ground'],
      ['dust:LOOK.lift', 'lighter than the ground', 0.5, 2, 0.01, 'x'],
      ['dust:LOOK.lumMin', 'darkest dust', 0, 0.3, 0.005],
      ['dust:LOOK.lumMax', 'palest dust', 0.1, 0.8, 0.01],
      ['dust:LOOK.v2', 'lit volume sprites, shadow, eddies'],
      ['dust:L.linger', 'hangs for', 5, 120, 1, ' s'],
      ['dust:L.coarse', 'share that settles fast', 0, 1, 0.01],
      ['dust:L.rvMax', 'height', 1, 12, 0.1, ' m'],
      ['dust:L.aspect', 'widest over tall', 1, 5, 0.05, 'x'],
      ['dust:L.eddyU', 'swirl', 0, 2, 0.02, ' m/s'],
    ] },
    { k: 'sources', title: 'how much each source throws', sub: 'the rates (all surfaces; the class cards below scale them)', open: true, rows: [
      ['dust:L.wheelK', 'wheels: dust', 0, 0.3, 0.005],
      ['dust:L.brakeK', 'braking: more dust', 0, 4, 0.05],
      ['dust:L.gritRate', 'wheels: grit (gravel, sand)', 0, 30, 0.5],
      ['dust:L.propK', 'the prop’s blast', 0, 4, 0.05],
      ['dust:L.tdK', 'the touchdown’s puff', 0, 3, 0.05],
      ['dust:L.slipK', 'the slipstream carries', 0, 2, 0.05, 'x'],
      ['dust:L.treadCone', 'the tread’s throw: cone', 0.1, 1.2, 0.01],
      ['dust:L.projHeavy', 'heavy mud: how high it reaches', 0, 2, 0.05],
      ['dust:LOOK.splashRate', 'puddle splashes', 0, 400, 5],   // (DIRT-STRIP's, dirt-faults: shown once dust.js carries it)
    ] },
    { k: 'sizes', title: 'the sizes', sub: 'drawn sizes (the throw and the mud on the aeroplane keep theirs)', open: false, rows: [
      ['dust:LOOK.gritSize', 'grit and drift', 0.25, 4, 0.05, 'x'],
      ['dust:LOOK.clodSize', 'clods, drops, clumps', 0.25, 4, 0.05, 'x'],
      ['dust:L.splatMax', 'a landed splat, at most', 0.05, 0.5, 0.01, ' m'],
      ['dust:L.splatLife', 'a landed splat lasts', 2, 120, 1, ' s'],
    ] },
    // per surface class: generated below (CLASS_ROWS)
    { k: 'coat', title: 'mud on the aeroplane', sub: 'the coat as it is drawn today (aeroweather.js AERO_MUD)', open: false, rows: [
      ['wx:AERO_MUD.kAcc', 'how fast it cakes', 0, 0.5, 0.005, '/s'],
      ['wx:AERO_MUD.vMax', 'grows up to the speed', 5, 60, 1, ' m/s'],
      ['wx:AERO_MUD.belly', 'on the belly', 0, 1, 0.01],
      ['wx:AERO_MUD.dep', 'in the hollows', 0, 1, 0.01],
      ['wx:AERO_MUD.kRain', 'rain washes it', 0, 0.02, 0.0005, '/s'],
      ['wx:AERO_MUD.kWater', 'water washes it', 0, 0.2, 0.005, '/s'],
    ] },
    { k: 'deposit', title: 'the computed mud and dust film', sub: 'where the throw lands on the aeroplane (ground_deposit.js)', open: false, rows: [
      ['gd:K.D0', 'mud: throw for a full coat (less = more mud)', 0.02, 1, 0.01],
      ['gd:K.D0d', 'dust film: for a full film (less = more)', 0.02, 1, 0.01],
      ['gd:DEF.reach', 'reaches up to (over the tyres)', 1, 8, 0.1, ' m'],
      ['gd:K.tDry', 'mud dries in', 30, 1800, 10, ' s'],
      ['gd:K.kRewet', 'rain re-wets', 0, 0.1, 0.001, '/s'],
      ['gd:K.rainDust', 'rain washes the film', 0, 0.1, 0.001, '/s'],
      ['gd:PBR.roughWet', 'wet mud: roughness', 0, 1, 0.01],
      ['gd:PBR.roughDry', 'dry mud: roughness', 0, 1, 0.01],
      ['gd:PBR.roughDust', 'dust film: roughness', 0, 1, 0.01],
      ['gd:PBR.dustTop', 'dust on top faces', 0, 1, 0.01, 'x'],
      ['gd:PBR.bump', 'mud relief', 0, 3, 0.05, 'x'],
      ['gd:SP.edge', 'spatter: soft edges', 0.01, 0.4, 0.005],
    ] },
    // RAIN ON THE SKIN (THE USER via A0, 16 Nov: "upward faces darker + glossier in rain, drying after", its own rows)
    { k: 'rain', title: 'rain on the aeroplane', sub: 'the skin wets in rain and dries after (ground_deposit.js RAIN)', open: false, rows: [
      ['gd:RAIN.darken', 'darker when wet', 0, 0.8, 0.01, 'x'],
      ['gd:RAIN.gloss', 'glossier when wet', 0, 0.95, 0.01, 'x'],
      ['gd:RAIN.sides', 'the sides wet (of the top)', 0, 1, 0.01, 'x'],
      ['gd:RAIN.tWet', 'wets through in', 2, 120, 1, 's'],
      ['gd:RAIN.tDry', 'dries in', 30, 3600, 10, 's'],
    ] },
  ];
  // per class: how much dust (fines) and grit (loose) it gives, its own colour (used where the ground hands none in, or
  // with "colour from the ground" off); a wet class (mud, slush) its throw: the tread's, the bow wave's, clods vs drops,
  // the landed splats
  const NICE = { dirt: 'dirt', sand: 'sand', gravel: 'gravel', grass: 'grass', paved: 'paved', mud: 'mud', snow: 'snow', powder: 'powder snow', slush: 'slush' };
  function classGroups() {
    const D = HANDLES.dust(); if (!D || !D.CLASSES) return [];
    return D.CLASSES.filter(c => D.CLS[c]).map(c => {
      const r = [['dust:CLS.' + c + '.fines', 'dust (fines)', 0, 1.5, 0.01], ['dust:CLS.' + c + '.loose', 'grit (loose)', 0, 1.5, 0.01], ['dust:CLS.' + c + '.col', 'colour']];
      if (D.CLS[c].proj) r.push(['dust:CLS.' + c + '.proj.tread', 'the tread’s throw', 0, 30, 0.5], ['dust:CLS.' + c + '.proj.bow', 'the bow wave', 0, 400, 5],
        ['dust:CLS.' + c + '.proj.clod', 'clods (vs drops)', 0, 1, 0.01], ['dust:CLS.' + c + '.proj.splat', 'landed splats', 0, 2, 0.05, 'x'], ['dust:CLS.' + c + '.proj.adh', 'sticks to the tyre', 0, 10, 0.1]);
      return { k: 'cls:' + c, title: NICE[c] || c, sub: D.CLS[c].proj ? 'a wet class: it throws' : 'a dry class: it clouds', open: false, cls: c, rows: r };
    });
  }

  // ---- THE PATHS ---------------------------------------------------------------------------------------------------
  function at(id) {   // -> [object, key] or null
    const i = id.indexOf(':'), h = HANDLES[id.slice(0, i)], o0 = h && h(); if (!o0) return null;
    const ks = id.slice(i + 1).split('.'); let o = o0;
    for (let j = 0; j < ks.length - 1; j++) { o = o[ks[j]]; if (o === null || typeof o !== 'object') return null; }
    const k = ks[ks.length - 1];
    return (k in o) ? [o, k] : null;
  }
  const clone = v => (Array.isArray(v) ? v.slice() : v);
  const same = (a, b) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9) : typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-12 : a === b);
  function get(id) { const p = at(id); return p ? clone(p[0][p[1]]) : undefined; }
  function set(id, v) {
    const p = at(id); if (!p) return false;
    const cur = p[0][p[1]];
    if (Array.isArray(cur)) { if (!Array.isArray(v) || v.length !== cur.length) return false; for (let i = 0; i < cur.length; i++) cur[i] = +v[i]; }   // (in place: the draw holds the array)
    else if (typeof cur === 'boolean') p[0][p[1]] = !!v;
    else { const n = +v; if (!isFinite(n)) return false; p[0][p[1]] = n; }
    return true;
  }
  function groups() {
    const out = [];
    for (const g of GROUPS) { if (g.k === 'coat' || g.k === 'deposit' || g.k === 'rain') continue; out.push(g); }
    out.push(...classGroups());
    for (const g of GROUPS) if (g.k === 'coat' || g.k === 'deposit' || g.k === 'rain') out.push(g);
    // a row whose handle or key this page does not carry is left out (a group with none is left out)
    return out.map(g => Object.assign({}, g, { rows: g.rows.filter(r => at(r[0])) })).filter(g => g.rows.length);
  }
  const ids = () => { const o = []; for (const g of groups()) for (const r of g.rows) o.push(r[0]); return o; };

  // ---- THE DEFAULTS (taken once, the first time asked: before any saved look is put back) ------------------------------
  let DEF = null;
  function defaults() {
    if (!DEF) DEF = {};
    for (const id of ids()) if (!(id in DEF)) DEF[id] = get(id);   // (a handle that arrives later adds its rows' then)
    return DEF;
  }
  function now() { defaults(); const o = {}; for (const id of ids()) o[id] = get(id); return o; }
  function delta() { const D = defaults(), o = {}; for (const id of ids()) { const v = get(id); if (!same(v, D[id])) o[id] = v; } return o; }
  // put a look back: only the rows that differ; full = everything not named goes back to its default (an import, a reset)
  function apply(o, full) {
    const D = defaults(); let n = 0;
    for (const id of ids()) {
      const want = o && (id in o) ? o[id] : full ? D[id] : undefined;
      if (want === undefined || same(get(id), want)) continue;
      if (set(id, want)) n++;
    }
    return n;
  }
  const reset = () => apply({}, true);
  // linear rgb <-> '#rrggbb' (the colour rows)
  const toS = v => { v = Math.max(0, Math.min(1, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
  const toL = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const hexOf = c => '#' + c.map(v => Math.round(toS(v) * 255).toString(16).padStart(2, '0')).join('');
  const linOf = h => { const n = parseInt(String(h).slice(1), 16); return [toL(((n >> 16) & 255) / 255), toL(((n >> 8) & 255) / 255), toL((n & 255) / 255)]; };
  const kindOf = id => { const v = get(id); return Array.isArray(v) ? 'colour' : typeof v === 'boolean' ? 'switch' : 'range'; };

  const GROUNDFX_LOOK = { groups, ids, get, set, kindOf, defaults, now, delta, apply, reset, hexOf, linOf, bind: h => { BOUND = h; DEF = null; } };
  if (W) W.GROUNDFX_LOOK = GROUNDFX_LOOK;
  if (typeof module !== 'undefined' && module.exports) module.exports = GROUNDFX_LOOK;
})();
