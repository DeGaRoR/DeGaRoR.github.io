// ============================================================
// THE DAY'S OWN PANEL (2026-09-20, the user: "do the same for the day panel
// on both rails" - after the clouds panel, one panel on two rails).
//
// The flight rail's `day` slot and the shed's `night` flyout used to say the
// same thing in two vocabularies: the brief borrowed #selCond and #selTime
// out of #flStore and drew the hour, the date and the rate in its own rows;
// the shed borrowed the tree's `time of day` row, a MOOD select that reached
// the clock through hangar.js's mood table (and overwrote the cloud cover on
// the way). This is the one panel both mount, in each rail's own rows:
//   THE CONDITIONS - the air and the wind (#selCond stays the keeper: its
//     handler is world.setWeather, and this panel presses it, never rebuilds it).
//   THE HOUR - the clock's presets, solved on the day's own almanac; the local
//     hour; the date; the rate the clock runs at with play.
//   THE CLOUDS - a door to the CLOUDS flyout (the weather is that panel's; one
//     fact, one keeper).
// The host hands in its row vocabulary (row, range, pills, note, select,
// field) and a context (the clock, a refresh, a way to open a sibling flyout).
// Every write goes through DAY_CLOCK, so the shed's sky, the world's sun,
// the lamps and the plate all hear the same change.
// ============================================================
var DAY_UI = (function () {
  'use strict';
  // the clock's presets, said the way #selTime used to say them
  const PRESETS = [
    { k: 'dawn',      label: 'dawn',      title: 'Dawn · civil twilight, the sun 6° under' },
    { k: 'morning',   label: 'morning',   title: 'Morning · the sun at 25°, rising' },
    { k: 'noon',      label: 'noon',      title: 'Solar noon on this date' },
    { k: 'afternoon', label: 'afternoon', title: 'Afternoon · the sun at 33°, falling (the alps hour)' },
    { k: 'golden',    label: 'golden',    title: 'Golden hour · the sun at 8°' },
    { k: 'sunset',    label: 'sunset',    title: 'Sunset · the upper limb on the horizon' },
    { k: 'dusk',      label: 'dusk',      title: 'Dusk · civil twilight, the sun 6° under' },
    { k: 'night',     label: 'night',     title: 'Night · the solar midnight, the darkest hour there is' },
  ];
  const hhmm = v => String(Math.floor(v)).padStart(2, '0') + ':' + String(Math.round((v % 1) * 60) % 60).padStart(2, '0');
  const rateLabel = r => (r === 0 ? 'frozen' : r === 1 ? 'real time' : r + 'x');
  // the conditions select, in the DOM on both screens (#flStore); pressed through its own change event
  const condSel = () => (typeof document !== 'undefined' ? document.getElementById('selCond') : null);

  // mount(host, H, ctx): H = { row, range, pills, note, select, field } the rail's helpers;
  // ctx = { day: DAY_CLOCK, refresh, open(k) }
  function mount(host, H, ctx) {
    const CK = ctx && ctx.day;
    const refresh = () => { if (ctx && ctx.refresh) ctx.refresh(); };
    const head = txt => { const r = H.row(host, txt); r.classList.add('fsec'); return r; };
    // ---- the conditions ---------------------------------------------------------------
    // TIME-CONTROLS: the career's weather is the day's (told, not chosen) - no conditions select there
    const sel = condSel(), career = !!(CK && CK.isCareer && CK.isCareer());
    if (sel && H.select && !career) {
      head('conditions');
      H.select(host, 'standard day', Array.from(sel.options).map(o => ({ label: o.textContent, value: o.value })),
        () => sel.value, v => { sel.value = v; sel.dispatchEvent(new Event('change')); refresh(); });
      H.note(host, 'A day is air AND wind. The weather changes live — the pilot flies EAS and takes it mid-flight; ' +
                   'the dewpoint sets the low deck’s base.');
    }
    // ---- the hour ------------------------------------------------------------------------
    if (!CK || !CK.day()) { H.note(host, 'This build has no clock.'); return; }
    // G2650 (SIM-CLOCK): THE DAY SETTINGS GIVE WAY TO THE CLOCK, gradually. The career's clock is game state (its
    // document's, forward only): the panel READS it and offers WAIT (to the next named hour or a clock time - one jump,
    // the next day's when it has passed; on the ground only). The sandbox's presets are "set the clock" (they may go
    // back), with "next full moon" beside them; the hour, the date and the rate stay the sandbox's.
    if (CK.isCareer && CK.isCareer()) { careerClock(host, H, CK, head, refresh); return; }
    freeClock(host, H, CK, head, refresh);
    // ---- the clouds are next door --------------------------------------------------------
    if (ctx && ctx.open && typeof CLOUD_FIELD !== 'undefined') {
      head('clouds');
      const d = CK.day();
      const cover = d.cloudCover > 0 ? (d.cloudCover * 100).toFixed(0) + ' % ' + (CLOUD_FIELD.TYPES[d.cloudType] ? CLOUD_FIELD.TYPES[d.cloudType].label : d.cloudType) : 'clear';
      H.pills(host, [{ label: 'the clouds… (' + cover + ')', value: 'clouds', title: 'The decks, the veil, the look - the CLOUDS flyout' }],
        () => false, () => ctx.open('clouds'));
    }
  }
  // THE SANDBOX'S CLOCK: set it freely - the presets (they may go back), the next full moon, the hour, the date, the rate
  function freeClock(host, H, CK, head, refresh) {
    head('set the clock');
    H.pills(host, PRESETS.map(p => ({ label: p.label, value: p.k, title: p.title })),
      o => o.value === CK.nearestPreset(), o => { CK.preset(o.value); refresh(); });
    if (CK.nextFullMoon)
      H.pills(host, [{ label: 'next full moon', value: 'fullmoon', title: 'The date of the next full moon, at dusk - a moonlit night (the career reaches one by waiting)' }],
        () => false, () => { CK.nextFullMoon(); refresh(); });
    H.range(host, 'local hour', 0, 24, 1 / 12, () => CK.localHours(), v => { CK.set({ localHours: v }); refresh(); }, hhmm);
    if (H.field) {
      const i = document.createElement('input'); i.type = 'date'; i.value = CK.day().date;
      i.onchange = () => { if (i.value) { CK.set({ date: i.value }); refresh(); } };
      H.field(host, 'date', i);
    }
    H.pills(host, CK.RATES.map(r => ({ label: rateLabel(r), value: r, title: r === 0 ? 'The clock stands' : 'The clock runs at ' + r + '× with play' })),
      o => o.value === CK.day().rate, o => { CK.rate(o.value); refresh(); });
    H.note(host, 'One clock for the shed and the world. It runs with play; the sun, the sky, the lamps and the ' +
                 'almanac follow it (' + CK.label() + (CK.moonAt ? ' · ' + moonWords(CK) : '') + ').');
  }
  // ============================================================
  // TIME-CONTROLS (A0 2 Nov, the user: "proper time controls, including in the garage ... a single new icon on top ...
  // that pops up a menu, with proper time controls. In flight, in the career, this will replace the time of day and
  // weather menu"). THE TIME MENU: what day and hour it is, the day's weather (SAID, never set here), and the time
  // actions the mode allows - the sandbox sets the clock freely (freeClock), the career only goes forward (careerClock:
  // the waits). Mounted by the garage top bar's time card (editor.js QUICK 'time') and, in the career, by the flight's
  // conditions button (app.js FL2 slot_time). ctx = { day, refresh, weather?() (the sandbox's door to SET the weather),
  // forecast?(day) -> [lines] (the career's weather plan, WEATHER-DAYS, once it lands) }
  function menu(host, H, ctx) {
    const CK = ctx && ctx.day;
    const refresh = () => { if (ctx && ctx.refresh) ctx.refresh(); };
    const head = txt => { const r = H.row(host, txt); r.classList.add('fsec'); return r; };
    if (!CK || !CK.day()) { H.note(host, 'This build has no clock.'); return; }
    const d = CK.day(), career = !!(CK.isCareer && CK.isCareer());
    // ---- now ------------------------------------------------------------------------------
    head(career ? 'now · the career' : 'now · the sandbox');
    H.note(host, [nowWords(d)].concat(CK.label().split(' · ').slice(1)).join(' · ') + (CK.moonAt ? ' · ' + moonWords(CK) : ''));   // (label's own hour and date said once)
    // ---- the day's weather, said ------------------------------------------------------------
    head('the weather');
    for (const l of weatherWords(d)) H.note(host, l);
    let fc = null;
    try { fc = ctx.forecast ? ctx.forecast(d) : null; } catch (e) { fc = null; }
    if (fc && fc.length) { head('the forecast'); for (const l of fc) H.note(host, l); }
    if (!career && ctx.weather)
      H.pills(host, [{ label: 'set the weather…', value: 'wx', title: 'The sandbox sets the weather freely: the wind, the air, the front, the clouds' }],
        () => false, () => ctx.weather());
    else if (career) H.note(host, 'The career\'s weather comes with the day: it is told here, not chosen.');
    // ---- the time actions this mode allows ----------------------------------------------------
    if (career) careerClock(host, H, CK, head, refresh); else freeClock(host, H, CK, head, refresh);
  }
  // the date and the hour in words ("Mon 2 Nov 2026, 14:05"), from the day's local date and seconds
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function nowWords(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.localDate || d.date || '');
    const hm = hhmm(((d.localSeconds || 0) / 3600) % 24);
    if (!m) return hm;
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return DOW[dt.getUTCDay()] + ' ' + (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] + ', ' + hm;
  }
  // the weather in a few lines: the day's preset when it is one, the wind and the air, the sight and the front, the clouds
  function weatherWords(d) {
    const WU = typeof WEATHER_UI !== 'undefined' ? WEATHER_UI : null;
    if (!WU) return ['This build has no weather.'];
    const out = [];
    let p = null; try { p = WU.presetOf ? WU.presetOf(d) : null; } catch (e) { p = null; }
    const P = p && WU.PRESETS ? WU.PRESETS.filter(x => x.k === p)[0] : null;
    if (P) out.push(P.label + ' - ' + P.title);
    let L = null; try { L = WU.lines ? WU.lines(d) : null; } catch (e) { L = null; }
    if (L) {
      out.push('wind ' + L.wxWind + ' · ' + L.wxCol);
      out.push('visibility ' + L.wxVis + (L.wxFront && L.wxFront !== 'none' ? ' · the front ' + L.wxFront : ''));
    }
    if (typeof CLOUD_FIELD !== 'undefined') out.push('clouds ' + (d.cloudCover > 0.02 ? (d.cloudCover * 100).toFixed(0) + ' % ' +
      (CLOUD_FIELD.TYPES && CLOUD_FIELD.TYPES[d.cloudType] ? CLOUD_FIELD.TYPES[d.cloudType].label : (d.cloudType || '')) : 'clear'));
    return out.length ? out : ['A standard day.'];
  }
  // the moon in words at the clock's hour ("full moon, up" / "no moon" / "half moon, not up")
  function moonWords(CK) {
    const m = CK.moonAt ? CK.moonAt(null, null) : null;
    if (!m) return '';
    return m.phase === 'new' ? 'no moon' : m.phase + ' moon, ' + (m.up ? 'up' : 'not up');
  }
  // THE CAREER'S CLOCK (G2650): read-only, and WAIT
  function careerClock(host, H, CK, head, refresh) {
    head('the clock');
    H.note(host, 'The career\'s clock: ' + CK.label() + ' · ' + moonWords(CK) + '. It runs with flown time and only moves forward; ' +
                 'on the ground you can wait it out.');
    const gate = () => { if (CK.canWait && !CK.canWait()) { H.note(host, 'Wait on the ground: in the hangar or on the stand.'); return false; } return true; };
    const go = t => { const r = CK.wait(t); if (r && !r.ok && H.note) H.note(host, r.why); refresh(); };
    // G2665 (NIGHT-OPS): "until the window opens" - the tracked job's time-of-day window, when it is closed now (the
    // page's door: app.js clockJobWait, 75_ careerWaitWindow)
    let jw = null;
    try { jw = typeof window !== 'undefined' && window.FLYDIY_CLOCK && window.FLYDIY_CLOCK.jobWait ? window.FLYDIY_CLOCK.jobWait() : null; } catch (e) { jw = null; }
    if (jw) H.pills(host, [{ label: 'the job\'s window', value: 'job', title: 'Wait until the tracked job\'s window opens (' + jw.words + ')' }], () => false, () => { if (gate()) go(jw.target); });
    H.pills(host, PRESETS.map(p => { const r = CK.waitPreview(p.k); return { label: p.label, value: p.k, title: 'Wait until ' + p.title.toLowerCase() + (r ? ' (' + hhmm((CK.localHours() + r.waitS / 3600) % 24) + ', in ' + (r.waitS / 3600).toFixed(1) + ' h)' : '') }; }),
      () => false, o => { if (gate()) go(o.value); });
    if (H.field && typeof document !== 'undefined') {
      const i = document.createElement('input'); i.type = 'time'; i.step = 60; i.value = '06:00';
      i.onchange = () => { if (/^\d{2}:\d{2}$/.test(i.value) && gate()) go(i.value); };
      H.field(host, 'wait until', i);
    }
  }
  const API = { PRESETS, mount, menu, nowWords, weatherWords, hhmm, moonWords };
  if (typeof window !== 'undefined') window.DAY_UI = API;
  return API;
})();
