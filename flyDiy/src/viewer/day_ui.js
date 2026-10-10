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
    const sel = condSel();
    if (sel && H.select) {
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
    // ---- the clouds are next door --------------------------------------------------------
    if (ctx && ctx.open && typeof CLOUD_FIELD !== 'undefined') {
      head('clouds');
      const d = CK.day();
      const cover = d.cloudCover > 0 ? (d.cloudCover * 100).toFixed(0) + ' % ' + (CLOUD_FIELD.TYPES[d.cloudType] ? CLOUD_FIELD.TYPES[d.cloudType].label : d.cloudType) : 'clear';
      H.pills(host, [{ label: 'the clouds… (' + cover + ')', value: 'clouds', title: 'The decks, the veil, the look - the CLOUDS flyout' }],
        () => false, () => ctx.open('clouds'));
    }
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
  const API = { PRESETS, mount, hhmm, moonWords };
  if (typeof window !== 'undefined') window.DAY_UI = API;
  return API;
})();
