// ============================================================
// THE WEATHER'S OWN PANEL (CLIMATE K2, 2026-09-22) — one panel on two rails,
// beside the day's and the clouds'.
//
// The weather used to be ONE SELECT. `#selCond` carried six hand-written
// CONDITIONS presets straight into `world.setWeather`, and everything else the
// air can be — a direction, a gust, a dew point, a mixed layer, a front — was
// either a developer's F8 dial or did not exist. The climate (09_climate.js)
// made all of it declarable on the DAY, so this is the panel that declares it:
//
//   THE WIND      speed and the direction it blows FROM, the gust, and the
//                 terrain's hand on it (the ridge lift and the lee's roughness)
//   THE AIR       the temperature, the QNH, the dew point, the day's own swing
//   THE COLUMN    the mixed layer's depth and the lid over it — the shape a
//                 glider feels, and the thing that decides where the cumulus
//                 sit (the base is DERIVED: 05_atmos's atmosWater finds it)
//   THE FRONT     a storm on the clock: when it arrives and how hard
//
// #selCond IS STILL THE KEEPER and is not retired: its options became these
// presets, its handler still the one place a preset is applied, and this panel
// PRESSES it (the pattern DAY_UI already uses). One fact, one keeper.
//
// Every row writes through DAY_CLOCK.set, so the flight rail, the shed's rail,
// the F8 fold, the URL and the saved pref all say the same thing.
// ============================================================
var WEATHER_UI = (function () {
  'use strict';
  const KT = 0.514444;
  const CLIM = () => (typeof CLIMATE !== 'undefined' ? CLIMATE : null);
  // ---- THE PRESETS: whole days, as the day's own fields ----------------------
  // A pick is a SET, not a mode: every row below stays live afterwards, and a
  // day that happens to match a preset lights its pill again.
  const PRESETS = [
    { k: 'calm', label: 'calm', title: 'Still air, a standard day',
      day: { wind: null, oatC: null, qnhPa: null, dewC: null, diurnalC: null, lapse: null, mixH: null, inversion: null, storm: null } },
    { k: 'breeze', label: 'light breeze', title: 'A steady 8 kt off the sea, the air standard',
      day: { wind: { kts: 8, dirDeg: 250, gust: 0.15, refH: 10 }, oatC: null, qnhPa: null, dewC: null,
             diurnalC: null, lapse: null, mixH: null, inversion: null, storm: null } },
    { k: 'ridge', label: 'ridge day', title: 'A 20 kt wind on the hills — the lift is on the windward faces, the lee is rough',
      day: { wind: { kts: 20, dirDeg: 270, gust: 0.3, refH: 10, terrain: 1, aloftK: 1.25, veerDeg: 15 },
             oatC: 12, qnhPa: 101800, dewC: 3, diurnalC: null, lapse: null, mixH: null, inversion: null, storm: null } },
    { k: 'thermal', label: 'thermal day', title: 'A warm afternoon: a deep mixed layer under a lid, cumulus at its top',
      day: { wind: { kts: 7, dirDeg: 200, gust: 0.25, refH: 10, terrain: 0.7, thermals: 1 },
             oatC: 24, qnhPa: 101600, dewC: 8, diurnalC: 11, lapse: 'mixed', mixH: 1900,
             inversion: { dT: 3, thick: 200 }, cloudCover: 0.35, cloudType: 'cu', storm: null } },
    { k: 'hot', label: 'hot and high', title: 'A 35 °C afternoon — thin air, long take-off runs',
      day: { wind: { kts: 5, dirDeg: 210, gust: 0.35, refH: 10 }, oatC: 35, qnhPa: 100800, dewC: 12,
             diurnalC: null, lapse: null, mixH: null, inversion: null, storm: null } },
    { k: 'front', label: 'a front', title: 'A cold front an hour out: the wind rises and veers, then it clears',
      day: { wind: { kts: 12, dirDeg: 190, gust: 0.35, refH: 10, terrain: 0.6 }, oatC: 17, qnhPa: 101000, dewC: 13,
             diurnalC: null, lapse: null, mixH: null, inversion: null, stormIn: 3600 } },
    { k: 'gale', label: 'gale', title: 'A 35 kt gale — a rough lee, a built sea',
      day: { wind: { kts: 35, dirDeg: 245, gust: 0.5, refH: 10, terrain: 1, aloftK: 1.3, veerDeg: 20 },
             oatC: 9, qnhPa: 99200, dewC: 7, diurnalC: null, lapse: null, mixH: null, inversion: null, storm: null } },
  ];
  // `stormIn` on a preset is "this many seconds from now" — resolved against
  // the clock at the moment it is picked, never stored.
  function dayOf(p, dayNow) {
    const o = Object.assign({}, p.day);
    if (o.stormIn != null) { o.storm = { at: (dayNow ? dayNow.utc : 0) + o.stormIn, intensity: 1 }; delete o.stormIn; }
    return o;
  }
  const near = (a, b, t) => Math.abs((a == null ? 0 : a) - (b == null ? 0 : b)) <= t;
  function presetOf(day) {
    if (!day) return null;
    const w = day.wind || null;
    for (const p of PRESETS) {
      const d = p.day, pw = d.wind || null;
      if (!!w !== !!pw) continue;
      if (w && !(near(w.kts, pw.kts, 0.6) && near(w.dirDeg, pw.dirDeg, 3) && near(w.gust, pw.gust, 0.03)
                && near(w.terrain, pw.terrain, 0.05) && near(w.thermals, pw.thermals, 0.05))) continue;
      if (!near(day.oatC, d.oatC == null ? day.oatC : d.oatC, 0.6)) continue;
      if ((d.storm != null || d.stormIn != null) !== !!day.stormSpec) continue;
      return p.k;
    }
    return null;
  }
  // ---- the rows' own vocabulary ---------------------------------------------
  const COMPASS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
  const deg = v => (((+v % 360) + 360) % 360);
  const cardinal = d => COMPASS.reduce((b, c) => {
    let e = Math.abs(deg(d) - c[1]); e = Math.min(e, 360 - e);
    return e < b.e ? { e, s: c[0] } : b; }, { e: 999, s: '' }).s;
  const hhmm = s => { const t = ((s % 86400) + 86400) % 86400;
    return String(Math.floor(t / 3600)).padStart(2, '0') + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0'); };
  const dur = s => { const m = Math.round(Math.abs(s) / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
  const condSel = () => (typeof document !== 'undefined' ? document.getElementById('selCond') : null);

  // mount(host, H, ctx): H = { row, range, pills, note, select, field }; ctx = { day: DAY_CLOCK, refresh, open }
  function mount(host, H, ctx) {
    const CK = ctx && ctx.day;
    const refresh = () => { if (ctx && ctx.refresh) ctx.refresh(); };
    const head = txt => { const r = H.row(host, txt); r.classList.add('fsec'); return r; };
    const d = CK && CK.day ? CK.day() : null;
    if (!d) { H.note(host, 'This build has no clock, so it has no weather either.'); return; }
    // the wind, always read through the day's declared spec (the climate resolves it)
    const wind = () => d.wind || {};
    const setWind = patch => {
      const w = Object.assign({ refH: 10 }, d.wind || {}, patch);
      if (!(w.kts > 0)) { CK.set({ wind: null }); } else CK.set({ wind: w });
      refresh();
    };

    // ---- the preset, through #selCond, which stays the keeper ------------------
    head('the day');
    const sel = condSel();
    H.pills(host, PRESETS.map(p => ({ label: p.label, value: p.k, title: p.title })),
      o => o.value === presetOf(d),
      o => {
        if (sel && Array.from(sel.options).some(x => x.value === o.value)) {
          sel.value = o.value; sel.dispatchEvent(new Event('change'));      // the keeper applies it
        } else CK.set(dayOf(PRESETS.find(p => p.k === o.value), d));
        refresh();
      });

    // ---- the wind ------------------------------------------------------------
    head('the wind');
    H.range(host, 'speed', 0, 45, 1, () => (wind().kts || 0), v => setWind({ kts: v }),
      v => (v > 0 ? v.toFixed(0) + ' kt' : 'calm'));
    H.range(host, 'from', 0, 355, 5, () => deg(wind().dirDeg || 0), v => setWind({ dirDeg: v }),
      v => deg(v).toFixed(0).padStart(3, '0') + '° ' + cardinal(v));
    H.pills(host, COMPASS.map(c => ({ label: c[0], value: c[1], title: 'The wind from the ' + c[0] })),
      o => Math.abs(deg(wind().dirDeg || 0) - o.value) < 23, o => setWind({ dirDeg: o.value }));
    H.range(host, 'gusts', 0, 1, 0.05, () => (wind().gust || 0), v => setWind({ gust: v }),
      v => (v > 0 ? '±' + (v * 100).toFixed(0) + ' %' : 'steady'));
    H.range(host, 'the hills', 0, 1, 0.1, () => (wind().terrain != null ? wind().terrain : 0),
      v => setWind({ terrain: v }), v => (v > 0 ? (v * 100).toFixed(0) + ' %' : 'flat'));
    H.note(host, 'The wind is reported at 10 m, as an anemometer reports it, and the column shears above it. ' +
                 'THE HILLS turn it into a real wind over ground: the air follows the slope, so a windward face ' +
                 'lifts and a lee sinks and is rough — that is the ridge lift a glider works.');

    // ---- the air --------------------------------------------------------------
    head('the air');
    H.range(host, 'temperature', -25, 40, 1, () => (d.oatC != null ? d.oatC : 15),
      v => { CK.set({ oatC: v }); refresh(); }, v => v.toFixed(0) + ' °C');
    H.range(host, 'QNH', 960, 1045, 1, () => Math.round(d.qnhPa / 100),
      v => { CK.set({ qnhPa: v * 100 }); refresh(); }, v => v.toFixed(0) + ' hPa');
    H.range(host, 'dew point', -30, 30, 1, () => (d.dewC != null ? Math.round(d.dewC) : 5),
      v => { CK.set({ dewC: v }); refresh(); }, v => v.toFixed(0) + ' °C');
    H.range(host, 'the day’s swing', 0, 18, 1, () => d.diurnalC,
      v => { CK.set({ diurnalC: v || null }); refresh(); }, v => (v > 0 ? '±' + (v / 2).toFixed(1) + ' °C' : 'steady'));
    {
      const w = wOf(d);
      H.note(host, 'The dew point is the one fact; the humidity follows it (' + (w.rh == null ? '—' : (w.rh * 100).toFixed(0) + ' %') +
                   ' at the surface) and so does the cloud base, at ' + (d.cloudBase > 0 ? d.cloudBase.toFixed(0) + ' m' : 'the ground') +
                   '. The swing is peak-to-peak about the temperature above, warmest three hours after noon.');
    }

    // ---- the column ------------------------------------------------------------
    head('the column');
    const lapse = () => (d.spec && d.spec().lapse) || 'isa';
    H.select(host, 'shape', [
      { label: 'standard (6.5 °C/km)', value: 'isa' },
      { label: 'mixed layer (a working day)', value: 'mixed' }],
      () => lapse(), v => { CK.set(v === 'mixed' ? { lapse: 'mixed' } : { lapse: null, mixH: null, inversion: null }); refresh(); });
    H.range(host, 'mixed to', 300, 3500, 100, () => { const s = d.spec(); return s.mixH != null ? s.mixH : 1200; },
      v => { CK.set({ lapse: 'mixed', mixH: v }); refresh(); }, v => v.toFixed(0) + ' m');
    H.range(host, 'the lid', 0, 8, 0.5, () => { const s = d.spec(); return s.inversion ? (s.inversion.dT || 0) : 0; },
      v => { CK.set({ lapse: 'mixed', inversion: v > 0 ? { dT: v, thick: 200 } : null }); refresh(); },
      v => (v > 0 ? '+' + v.toFixed(1) + ' °C' : 'none'));
    {
      const w = wOf(d), top = w.mixTop;
      H.note(host, 'A working day is stirred by its own thermals to 9.8 °C/km and capped by a lid. The thermals stop at ' +
                   (top == null ? '—' : top.toFixed(0) + ' m') + ' — the lower of the lid and the condensation level (' +
                   (w.lcl == null ? 'none today' : w.lcl.toFixed(0) + ' m') + '), and where the base wins, every thermal wears a cumulus.');
      // A LOW DECK IS SAID BEFORE IT IS FLOWN INTO. The condensation level is
      // the day's own 125 m per degree of spread, so a nearly saturated day puts
      // the base on the deck - at rh 0.98 it is 37 m, and everything above the
      // valley floor is inside cloud. That is exact rather than a fault, and the
      // answer to it is a BRIEFING, not a fudge: the panel says so here, where
      // the player decides, rather than letting them find out in the climb.
      if (d.cloudBase > 0 && d.cloudBase < 200 && d.cloudCover > 0.05) {
        const r = H.row(host, 'the deck is on the deck');
        r.classList.add('fnote');
        r.textContent = 'The cloud base is at ' + d.cloudBase.toFixed(0) + ' m — below circuit height. '
          + 'You will be in cloud from the climb-out; the dew point and the temperature are ' + (d.oatC - d.dewC).toFixed(1)
          + ' °C apart, and every degree of that is 125 m of base.';
      }
    }

    // ---- the front ---------------------------------------------------------------
    head('the front');
    const st = d.stormSpec;
    H.pills(host, [
      { label: 'none', value: 0, title: 'No front today' },
      { label: 'in 1 h', value: 3600 }, { label: 'in 3 h', value: 10800 }, { label: 'now', value: 60 }]
      .map(o => Object.assign({ title: o.title || 'A cold front arriving' }, o)),
      o => (o.value === 0 ? !st : !!st && Math.abs((st.at - d.utc) - o.value) < 600),
      o => { CK.set({ storm: o.value ? { at: d.utc + o.value, intensity: (st && st.intensity) || 1 } : null }); refresh(); });
    H.range(host, 'how hard', 0.2, 1, 0.1, () => (st && st.intensity != null ? st.intensity : 1),
      v => { if (st) { CK.set({ storm: Object.assign({}, st, { intensity: v }) }); refresh(); } },
      v => (v * 100).toFixed(0) + ' %');
    H.note(host, frontLine(d));

    // ---- what the air is doing, live ------------------------------------------------
    // The rows are LIVE (the rail's flLive): a front walks the clock and these
    // walk with it without the panel being touched. A rail with no live row
    // gets the same facts, once.
    head('right now');
    if (H.live) {
      H.live(host, 'wind at 10 m', 'wxWind');
      H.live(host, 'the column', 'wxCol');
      H.live(host, 'visibility', 'wxVis');
      H.live(host, 'the front', 'wxFront');
    } else {
      const L = lines(d);
      H.note(host, L.wxWind + ' · ' + L.wxCol + ' · ' + L.wxVis + ' visibility');
    }
    // the clouds are next door (one fact, one keeper)
    if (ctx && ctx.open) {
      H.pills(host, [{ label: 'the clouds…', value: 'clouds', title: 'The decks, the veil, the look — the CLOUDS flyout' }],
        () => false, () => ctx.open('clouds'));
    }
  }

  // wOf(day): the numbers the notes read, straight off the climate when there is
  // one (never recomputed here — the day declares, the climate derives)
  // THE WORLD, through the one handle the viewer publishes (app.js FLIGHT_PROBE,
  // which the F8 panel and every rig already read): `world()` is the world that
  // booted, island or analytic. In the shed there is none, and the notes say so.
  function worldNow() {
    const W = typeof window !== 'undefined' ? window : {};
    return (W.FLIGHT_PROBE && W.FLIGHT_PROBE.world) ? W.FLIGHT_PROBE.world() : null;
  }
  function wOf(day) {
    const w = worldNow(), c = w && w.climate ? w.climate : null;
    if (!c) return { rh: null, lcl: null, mixTop: null, vis: day ? day.visibilityKm : null, sfcVis: null, drawn: false };
    const p = c.profile ? c.profile(0) : null, hz = c.haze ? c.haze() : null;
    // TWO VISIBILITIES, AND THE PLAYER IS TOLD THE ONE THEY FLY IN. `vis` is the
    // COLUMN - the authored number, what the day was written with and what a front
    // moves. `sfcVis` is what an eye on the ground can actually see horizontally,
    // which on a fog morning is the fog's number and not the column's: the column
    // would cheerfully say 37 km while the far end of the strip has gone. Preferring
    // the renderer's own measurement (CLIMATE_LINK.pub.visM) when it exists means the
    // panel quotes what was DRAWN; the weather's own surfaceVisM is the fallback.
    const L = (typeof window !== 'undefined') ? window.CLIMATE_LINK : null;
    const drawn = L && L.pub && L.pub.on && L.pub.visM != null ? L.pub.visM : null;
    return { rh: p ? p.rh : null, lcl: p ? p.lcl : null,
             mixTop: c.mixTop ? c.mixTop() : null,
             vis: hz ? hz.column.visibilityKm : (day ? day.visibilityKm : null),
             sfcVis: drawn != null ? drawn : (hz ? hz.surfaceVisM : null),
             drawn: drawn != null };
  }
  // THE VISIBILITY ROW. The column first, because that is the day as authored; then
  // the surface, but ONLY when it is meaningfully worse - on a clear day the two are
  // the same number twice and a panel that says so is noise. Under a kilometre it is
  // said in metres, as a METAR does, because that is the regime where the difference
  // stops being interesting and starts being the flight.
  function visKmStr(km) { return km >= 60 ? '60+ km' : km >= 10 ? km.toFixed(0) + ' km' : km.toFixed(1) + ' km'; }
  function visLine(w) {
    if (w.vis == null) return '—';
    const col = visKmStr(w.vis);
    if (w.sfcVis == null || !isFinite(w.sfcVis)) return col;
    const sKm = w.sfcVis / 1000;
    if (sKm > w.vis * 0.9) return col;                       // nothing on the deck worth saying
    const sfc = sKm < 1 ? (Math.round(w.sfcVis / 100) * 100) + ' m' : visKmStr(sKm);
    return col + ' · ' + sfc + ' on the deck' + (w.drawn ? '' : '*');
  }
  // what the front is doing, said in a sentence
  function frontLine(day) {
    const s = day && day.storm;
    if (!s) return 'A cold front is a whole day on the clock: the wind rises and veers ahead of it, the temperature and ' +
                   'the pressure fall as it passes, the sky closes to cumulonimbus, and then it clears.';
    if (s.phase === 'none') return 'The front is ' + dur(s.inS) + ' out, at ' + hhmm(s.at + day.offsetH * 3600) + ' local.';
    if (s.phase === 'pre') return 'It is coming: the wind is up ' + ((s.windK - 1) * 100).toFixed(0) + ' % and still rising.';
    if (s.phase === 'passage') return 'The front is over us — ' + ((s.windK - 1) * 100).toFixed(0) + ' % on the wind, veered ' +
      s.veer.toFixed(0) + '°, the pressure ' + (s.dQnh / 100).toFixed(1) + ' hPa down.';
    return 'It is clearing: ' + (s.I * 100).toFixed(0) + ' % of it left.';
  }
  // the live lines, for whichever rail asked for them
  function lines(day) {
    const w = wOf(day), wd = worldNow();
    const cl = wd && wd.climate ? wd.climate : null;
    const sw = cl && cl.surfaceWind ? cl.surfaceWind() : null;
    const from = sw && sw.spd > 0.05 ? deg(Math.atan2(-sw.base[0], sw.base[2]) * 180 / Math.PI) : null;
    return {
      wxWind: sw && sw.spd > 0.05
        ? (sw.spd / KT).toFixed(0) + ' kt from ' + from.toFixed(0).padStart(3, '0') + '° ' + cardinal(from)
        : 'calm',
      wxCol: (day.oatC != null ? day.oatC.toFixed(0) : '—') + ' °C · ' + (day.qnhEff / 100).toFixed(0) + ' hPa'
             + (w.mixTop != null ? ' · thermals to ' + w.mixTop.toFixed(0) + ' m' : '')
             + (day.cloudBase > 0 && day.cloudCover > 0.05 ? ' · base ' + day.cloudBase.toFixed(0) + ' m' : ''),
      wxVis: visLine(w),
      wxFront: day.storm ? day.storm.phase + ' · ' + (day.storm.I * 100).toFixed(0) + ' %'
               : (day.stormSpec ? 'in ' + dur(day.stormSpec.at - day.utc) : 'none'),
    };
  }
  const API = { PRESETS, presetOf, dayOf, mount, lines, frontLine, cardinal, wOf };
  if (typeof window !== 'undefined') window.WEATHER_UI = API;
  return API;
})();
