// ============================================================
// THE CLOCK — the viewer's hand on world.day (SKY S1, 2026-09-14).
//
// The DAY lives in the world (07_day.js) so physics, gates and the renderer
// read one object; this file is the only thing that makes it ADVANCE, and
// the one place its presets, its pref and its URL override live. The user's
// ruling (aj): a real clock that moves with play, at a rate the player sets
// (0 frozen · 1 real · 10 · 60 · 600), one clock for the shed and the world.
//
// Frame-locked like the sim (app.js ticks it 1/60 a frame), never the wall
// clock: the game boots on the day's FIXED default unless `flydiy.day` or
// `?day=YYYY-MM-DDTHH:MMZ` says otherwise, so a screenshot is reproducible.
//
// PRESETS are solved on the day's own almanac, on its own date: dawn is the
// sun at -6 deg rising, golden 8 deg falling, night the solar midnight — so
// "night" in June at 55 N is the darkest twilight there is, not a fiction.
// ============================================================
var DAY_CLOCK = (function () {
  'use strict';
  // v2 (2026-09-23): the game's own day below - a new key, so every player starts once on it
  const PREF = 'flydiy.day.v2';
  // THE GAME'S DAY (2026-09-23, the user: "small, elegant summer clouds, well split, a great sky for flying ... at day
  // with good visibility, but still maximizing the shadows and atmospheric effects ... performance optimized"):
  // chosen on screenshots at 30-450 m, from two sides of the sun (futureDesigns/PERF-2026-09-23.md, the default look).
  // Midsummer, 16:00 local (the sun ~46 deg in the WSW: the ground side-lit, the clouds' shadows on it), the new
  // fair-weather cumulus (08_cloud_field 'cuh': many small cells, a shallow column) at a quarter cover on seed 1,
  // turbidity 2.8 (~48 km: the hills keep their aerial depth). The physics' own default (07_day DAY.DEFAULT, the gates'
  // baseline) is untouched: this is the GAME's first day, when no link and no saved day say otherwise.
  const GAME_DAY = { date: '2026-06-21', localHours: 16, rate: 1, cloudType: 'cuh', cloudCover: 0.25, cloudSeed: 1, turbidity: 2.8 };
  const RATES = [0, 1, 10, 60, 600];
  const PRESETS = ['dawn', 'morning', 'noon', 'afternoon', 'golden', 'sunset', 'dusk', 'night'];
  let world = null, day = null, sinceSave = 0;
  const W = typeof window !== 'undefined' ? window : null;

  const read = () => { try { return JSON.parse(localStorage.getItem(PREF) || 'null'); } catch (e) { return null; } };
  // ... and THE WEATHER with it (2026-09-20, the clouds panel): the low deck's cover and type, the upper decks
  // ...and THE WEATHER with it (CLIMATE K2): the wind, the air, the column's
  // shape and a front all live on the day's declared spec, so the pref carries
  // whatever of them the player set. An older pref simply has none of them.
  const save = () => { if (!day) return; try { const sp = day.spec();
    localStorage.setItem(PREF, JSON.stringify({ date: day.date, utc: Math.round(day.utc), rate: day.rate,
    cloudCover: day.cloudCover, cloudType: day.cloudType, cloudUpper: day.cloudUpper && day.cloudUpper.length ? day.cloudUpper : null,
    wind: sp.wind || null, storm: sp.storm || null, diurnalC: sp.diurnalC || null,
    oatC: sp.oatC != null ? sp.oatC : null, qnhPa: sp.qnhPa != null ? sp.qnhPa : null, dewC: sp.dewC != null ? sp.dewC : null,
    lapse: sp.lapse || null, mixH: sp.mixH != null ? sp.mixH : null, inversion: sp.inversion || null })); } catch (e) {} sinceSave = 0; };
  // ?wind=<kt>,<deg from>[,<gust>][,<terrain>]   e.g. ?wind=20,270,0.3,1 - a ridge day
  // ?storm=<hours from now>[,<intensity>]        e.g. ?storm=1 - a front an hour out
  // Both are read once at bind, after the pref and after ?day=, so a link wins.
  function weatherFromUrl() {
    if (!W || !W.location) return null;
    const o = {};
    const w = /[?&]wind=([^&]+)/.exec(W.location.search);
    if (w) {
      const a = decodeURIComponent(w[1]).split(',').map(Number);
      o.wind = a[0] > 0 ? { kts: a[0], dirDeg: a[1] || 0, gust: a[2] || 0, refH: 10 } : null;
      if (o.wind && a[3] != null && isFinite(a[3])) o.wind.terrain = a[3];
    }
    const st = /[?&]storm=([^&]+)/.exec(W.location.search);
    if (st) {
      const a = decodeURIComponent(st[1]).split(',').map(Number);
      o.storm = a[0] != null && isFinite(a[0]) ? { at: 0, inH: a[0], intensity: a[1] != null && isFinite(a[1]) ? a[1] : 1 } : null;
    }
    return Object.keys(o).length ? o : null;
  }
  // ?day=2026-12-21T20:44Z  (UT)  or  ?day=2026-12-21T12:30  (local)  or  ?day=golden
  function fromUrl() {
    if (!W || !W.location) return null;
    const m = /[?&]day=([^&]+)/.exec(W.location.search);
    if (!m) return null;
    const v = decodeURIComponent(m[1]);
    if (PRESETS.includes(v)) return { preset: v };
    const t = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(Z?))?$/.exec(v);
    if (!t) return null;
    const o = { date: t[1] };
    if (t[2] != null) { const h = +t[2] + (+t[3]) / 60; if (t[4]) o.utc = h * 3600; else o.localHours = h; }
    return o;
  }

  // the UT second on the day's date for a named hour; every fallback is a real hour on that date
  function presetUtc(name) {
    const noon = day.noonUtc, rise = day.sunriseUtc, set = day.sunsetUtc;
    const at = (el, rising, fb) => { const u = day.utcFor(el, rising); return u != null ? u : fb; };
    switch (name) {
      case 'noon': return noon;
      case 'night': return noon - 43200 >= 0 ? noon - 43200 : noon + 43200;
      case 'morning': return at(25, true, rise != null ? (rise + noon) / 2 : noon - 10800);
      case 'afternoon': return at(33.4, false, set != null ? (set + noon) / 2 : noon + 7200);   // the alps row's hour, the anchor the lights were judged in
      case 'golden': return at(8, false, set != null ? (set + noon) / 2 : noon + 10800);
      case 'sunset': return at(-0.833, false, set != null ? set : noon + 21600);
      case 'dawn': return at(-6, true, rise != null ? rise - 1800 : noon - 43200);
      case 'dusk': return at(-6, false, set != null ? set + 1800 : noon + 43200);
    }
    return noon;
  }

  const api = {
    RATES, PRESETS,
    bind(w) {
      world = w; day = w && w.day;
      if (!day) return;
      const url = fromUrl(), pref = read();
      if (!url && !(pref && pref.date)) w.setDay(GAME_DAY);   // a new player (or a new key): the game's day
      else w.setDay({ cloudSeed: GAME_DAY.cloudSeed, turbidity: GAME_DAY.turbidity });   // not player-saved: the game's air and sky seed always
      if (url) { if (url.preset) api.preset(url.preset); else w.setDay(url); }
      else if (pref && pref.date) w.setDay({ date: pref.date, utc: pref.utc, rate: pref.rate != null ? pref.rate : 1 });
      // the saved weather comes back with the day (a ?cloud= on the URL, below, wins over it)
      if (pref && pref.cloudCover != null) w.setDay({ cloudCover: pref.cloudCover, cloudType: pref.cloudType || 'cu', cloudUpper: Array.isArray(pref.cloudUpper) ? pref.cloudUpper : null });
      // ...and so does the WEATHER (CLIMATE K2): the wind, the air, the column, a front. Only the
      // keys the pref actually carries are set, so a pref written before this session changes nothing.
      if (pref) {
        const o = {};
        for (const k of ['wind', 'storm', 'diurnalC', 'oatC', 'qnhPa', 'dewC', 'lapse', 'mixH', 'inversion'])
          if (pref[k] != null) o[k] = pref[k];
        if (Object.keys(o).length) w.setDay(o);
      }
      // ?cloud=0.45  or  ?cloud=0.9,st  (CLOUDS C4): the cover and the type, for a reproducible shot;
      // ?cloud=0.45,cu;0.3,ac,3500;0.5,as (A6): the upper decks after semicolons - cover, type, base (m, optional)
      if (W && W.location) {
        const c = /[?&]cloud=([0-9.]+)(?:,([a-z]{2}))?((?:;[0-9.]+(?:,[a-z]{2})?(?:,[0-9]+)?)*)/.exec(W.location.search);
        if (c) {
          const o = { cloudCover: Math.max(0, Math.min(1, +c[1])) }; if (c[2]) o.cloudType = c[2];
          if (c[3]) o.cloudUpper = c[3].split(';').filter(Boolean).map(s => { const p = s.split(','); const u = { cover: +p[0], type: p[1] || 'ac' }; if (p[2]) u.base = +p[2]; return u; });
          else o.cloudUpper = null;
          w.setDay(o);
        }
      }
      // ?wind= / ?storm= last of all, so a link wins over the pref and over ?day=
      const wx = weatherFromUrl();
      if (wx) {
        if (wx.storm && wx.storm.inH != null) wx.storm = { at: day.utc + wx.storm.inH * 3600, intensity: wx.storm.intensity };
        w.setDay(wx);
      }
      if (W) W.addEventListener('pagehide', save);
    },
    // the tick: dt seconds of play (the loop's 1/60); saves at most every 30 s
    // the tick: the WORLD's, not the day's alone (CLIMATE K2) - world.dayTick
    // advances the clock and lets the front's hand reach the wind with it; the
    // solver still never touches either (the two-clocks rule, 09_climate.js).
    tick(dt) {
      if (!day) return;
      // the world's tick takes the SIM clock and the craft's place too (K4): the
      // sea's phase is anchored at the aeroplane, so the surface it rides stays
      // continuous while the sea builds under a changing wind
      let t = 0, ax = 0, az = 0;
      const FP = W && W.FLIGHT_PROBE;
      if (FP && FP.sim) { try { const sm = FP.sim(); t = sm.t; const c = sm.cgPos(); ax = c[0]; az = c[2]; } catch (e) {} }
      if (world && world.dayTick) world.dayTick(dt, t, ax, az); else day.advance(dt);
      if ((sinceSave += dt) > 30) save();
    },
    set(o) { if (!world) return; world.setDay(o); save(); },
    preset(name) { if (!day || !PRESETS.includes(name)) return; world.setDay({ utc: presetUtc(name) }); save(); },
    presetUtc: name => (day ? presetUtc(name) : null),
    // the preset nearest the current hour (for a select to show), by sun elevation and side of noon
    nearestPreset() {
      if (!day) return 'noon';
      let best = 'noon', bd = Infinity;
      for (const p of PRESETS) { const u = presetUtc(p); const d = Math.min(Math.abs(day.utc - u), 86400 - Math.abs(day.utc - u)); if (d < bd) { bd = d; best = p; } }
      return best;
    },
    rate(r) { if (world && RATES.includes(+r)) { world.setDay({ rate: +r }); save(); } return day ? day.rate : 1; },
    localHours() { return day ? day.localSeconds / 3600 : 12; },
    label() {
      if (!day) return '';
      const s = day.local.split(' ');
      return s[1].slice(0, 5) + ' ' + s[2] + ' · sun ' + day.sunEl.toFixed(0) + '° · ' + day.illumClass + (day.rate !== 1 ? ' · ' + (day.rate ? day.rate + 'x' : 'frozen') : '');
    },
    day: () => day,
  };
  return api;
})();
if (typeof window !== 'undefined') window.DAY_CLOCK = DAY_CLOCK;
