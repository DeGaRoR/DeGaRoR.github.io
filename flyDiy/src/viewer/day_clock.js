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
  // v3 (G700, 2026-09-26): the game's day carries a light breeze; a v2 pref comes across (below)
  const PREF = 'flydiy.day.v3', PREF_V2 = 'flydiy.day.v2';
  // THE GAME'S DAY (2026-09-23, the user: "small, elegant summer clouds, well split, a great sky for flying ... at day
  // with good visibility, but still maximizing the shadows and atmospheric effects ... performance optimized"):
  // chosen on screenshots at 30-450 m, from two sides of the sun (futureDesigns/PERF-2026-09-23.md, the default look).
  // Midsummer, 16:00 local (the sun ~46 deg in the WSW: the ground side-lit, the clouds' shadows on it), the new
  // fair-weather cumulus (08_cloud_field 'cuh': many small cells, a shallow column) at a quarter cover on seed 1,
  // turbidity 2.8 (~48 km: the hills keep their aerial depth). The physics' own default (07_day DAY.DEFAULT, the gates'
  // baseline) is untouched: this is the GAME's first day, when no link and no saved day say otherwise.
  // G700 (the Jolene playtest: "light breeze by default, so the sea is not fully calm"): the day's wind is the
  // weather card's `light breeze` preset (weather_ui.js), 8 kt off the sea from 250 deg - the sea gets its ripples
  // and the windsock its lift. GATE HONESTY holds the two equal (and the pilot matrix's `breeze` weather to them).
  const GAME_WIND = { kts: 8, dirDeg: 250, gust: 0.15, refH: 10, breeze: 1 };
  const GAME_DAY = { date: '2026-06-21', localHours: 16, rate: 1, cloudType: 'cuh', cloudCover: 0.25, cloudSeed: 1, turbidity: 2.8, wind: GAME_WIND };
  const RATES = [0, 1, 10, 60, 600];
  const PRESETS = ['dawn', 'morning', 'noon', 'afternoon', 'golden', 'sunset', 'dusk', 'night'];
  let world = null, day = null, sinceSave = 0;
  const W = typeof window !== 'undefined' ? window : null;

  // A v2 PREF COMES ACROSS once: its date, hour and weather kept, except the still air every v2 day was saved
  // with by default (the old game day had no wind) - that one takes the new day's breeze. A calm picked on
  // purpose is picked again in one click, and saved as v3 from then on.
  const read = () => {
    try {
      const v3 = JSON.parse(localStorage.getItem(PREF) || 'null');
      if (v3) return v3;
      const v2 = JSON.parse(localStorage.getItem(PREF_V2) || 'null');
      if (v2 && !v2.wind) v2.wind = Object.assign({}, GAME_WIND);
      return v2;
    } catch (e) { return null; }
  };
  // ... and THE WEATHER with it (2026-09-20, the clouds panel): the low deck's cover and type, the upper decks
  // ...and THE WEATHER with it (CLIMATE K2): the wind, the air, the column's
  // shape and a front all live on the day's declared spec, so the pref carries
  // whatever of them the player set. An older pref simply has none of them.
  // (G2650) in the career the instant is the document's: the pref keeps the sandbox's own date / hour / rate
  // (written back as they were) and the career's instant goes to the page (careerHook.put)
  const save = () => { if (!day) return; try { const sp = day.spec(), keep = careerHook ? (read() || {}) : null;
    if (careerHook) try { careerHook.put({ date: day.date, utc: day.utc }); } catch (e) {}
    localStorage.setItem(PREF, JSON.stringify({ date: keep ? keep.date : day.date, utc: keep ? keep.utc : Math.round(day.utc), rate: keep ? keep.rate : day.rate,
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

  // the UT second on the day's date for a named hour; every fallback is a real hour on that date. The solver
  // moved into the core (07b_clock.js dayPresetUtc, G2650) so the sandbox's presets and the career's waits are one
  // solver; this is its door.
  const presetUtc = name => dayPresetUtc(day, name);

  // ---- G2650 SIM-CLOCK: THE CLOCK AS GAME STATE -----------------------------------------------------------------
  // THE ONE JUMP. Every change of the clock's INSTANT that is not the tick - a wait, a preset, the hour or the date
  // set, the next full moon - goes through jump(): ONE world.setDay (one DAY.set: one `version` bump, the re-bakes'
  // trigger - atmo.js's probe, render_world's applyDay - fire once, here and never per frame; the tick's
  // day.advance never bumps it: GATE CLOCK). Each jump is counted and published (`jumps`, `lastJump`, the window
  // event 'flydiy:dayjump') so SIM-CLOCK-GPU (G2660) can time the frame after it.
  // THE CAREER (`career(hook)`): the instant is the career document's (74_career.js career.day), not the pref; it
  // only moves FORWARD (a jump to an earlier instant is refused), the rate is real time, and every save hands the
  // instant to the page (hook.put -> careerDaySet -> the document). The sandbox keeps its pref and every control.
  const TIME_KEYS = ['date', 'utc', 'localHours'];
  let careerHook = null, jumps = 0, lastJump = null, canWait = null;
  const nowOf = () => ({ date: day.date, utc: day.utc });
  // where a time spec would land (a scratch day: the live one is not touched to find out)
  function landOf(o) {
    const p = DAY.makeDay({ date: day.date, utc: day.utc }, day.geo);
    const t = {}; for (const k of TIME_KEYS) if (o[k] != null) t[k] = o[k];
    p.set(t);
    return { date: p.date, utc: p.utc };
  }
  function jump(o, why) {
    if (!world || !day || !o) return null;
    const from = nowOf(), to = landOf(o), dt = dayAbs(to) - dayAbs(from);
    if (careerHook && dt < 0) return { ok: false, why: 'the career\'s clock only moves forward' };
    const T0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    world.setDay(o);
    jumps++;
    lastJump = { n: jumps, why: why || 'set', from, to: nowOf(), dtS: dt, version: day.version, t: T0 };
    try { if (W && W.dispatchEvent && typeof CustomEvent === 'function') W.dispatchEvent(new CustomEvent('flydiy:dayjump', { detail: lastJump })); } catch (e) {}
    save();
    return { ok: true, jump: lastJump };
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
    // a change of the instant is a JUMP (above); the weather, the air, the clouds are a plain set
    set(o) {
      if (!world || !o) return;
      if (TIME_KEYS.some(k => o[k] != null)) {
        const t = {}, w = {};
        for (const k of Object.keys(o)) (TIME_KEYS.includes(k) ? t : w)[k] = o[k];
        if (Object.keys(w).length) { if (careerHook) delete w.rate; world.setDay(w); }
        return jump(t, 'set');
      }
      if (careerHook && o.rate != null) { o = Object.assign({}, o); delete o.rate; }
      world.setDay(o); save();
    },
    // the sandbox's "set the clock": the named hour on the day's date (it may go back); the career WAITS for it
    preset(name) {
      if (!day || !PRESETS.includes(name)) return;
      if (careerHook) return api.wait(name);
      return jump({ utc: presetUtc(name) }, 'preset:' + name);
    },
    presetUtc: name => (day ? presetUtc(name) : null),
    // WAIT IT OUT (G2650): the next `target` (a preset's name, 'HH:MM', or local hours) - today's when still ahead,
    // else tomorrow's (07b_clock.js dayWaitUntil), as ONE jump. On the ground only: the page's guard (waitGuard)
    // says when - in the hangar, on the stand; never in flight. -> { ok, jump | why }
    wait(target) {
      if (!day) return { ok: false, why: 'no clock' };
      const g = canWait ? canWait() : true;
      if (g !== true) return { ok: false, why: typeof g === 'string' ? g : 'not on the ground' };
      const r = dayWaitUntil(day, target);
      if (!r) return { ok: false, why: 'no such hour: ' + target };
      return jump({ date: r.date, utc: r.utc }, 'wait:' + (typeof target === 'string' ? target : 'hour'));
    },
    waitPreview: target => (day ? dayWaitUntil(day, target) : null),
    waitGuard(fn) { canWait = typeof fn === 'function' ? fn : null; },
    canWait: () => { if (!canWait) return true; const g = canWait(); return g === true; },
    // the sandbox's "next full moon" (the date 06_solar's moon is full, at dusk); the career reaches one by waiting
    nextFullMoon() {
      if (!day) return { ok: false, why: 'no clock' };
      if (careerHook) return { ok: false, why: 'the career reaches a full moon only by waiting' };
      const r = dayNextFullMoon(day);
      return r ? jump({ date: r.date, utc: r.utc }, 'fullmoon') : { ok: false, why: 'no full moon found' };
    },
    moonAt: (date, hour) => (day ? dayMoonAt(day, date, hour) : null),
    // THE CAREER'S CLOCK: hook = { get() -> {date, utc}, put({date, utc}) }; the instant is set from the document
    // (a LOAD, not a jump: the boot's own set), real time, and saved through the hook from then on
    career(hook) {
      careerHook = hook && typeof hook.get === 'function' && typeof hook.put === 'function' ? hook : null;
      if (careerHook && world && day) { const o = careerHook.get(); if (o && o.date) world.setDay({ date: o.date, utc: o.utc, rate: 1 }); }
      return !!careerHook;
    },
    isCareer: () => !!careerHook,
    get jumps() { return jumps; },
    get lastJump() { return lastJump; },
    jump: (o, why) => jump(o, why),
    // the preset nearest the current hour (for a select to show), by sun elevation and side of noon
    nearestPreset() {
      if (!day) return 'noon';
      let best = 'noon', bd = Infinity;
      for (const p of PRESETS) { const u = presetUtc(p); const d = Math.min(Math.abs(day.utc - u), 86400 - Math.abs(day.utc - u)); if (d < bd) { bd = d; best = p; } }
      return best;
    },
    // the career runs in real time with play (no frozen clock, no fast-forward: a wait is how it moves on)
    rate(r) { if (world && RATES.includes(+r) && !(careerHook && +r !== 1)) { world.setDay({ rate: +r }); save(); } return day ? day.rate : 1; },
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
