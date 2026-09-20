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
    head('the hour');
    H.pills(host, PRESETS.map(p => ({ label: p.label, value: p.k, title: p.title })),
      o => o.value === CK.nearestPreset(), o => { CK.preset(o.value); refresh(); });
    H.range(host, 'local hour', 0, 24, 1 / 12, () => CK.localHours(), v => { CK.set({ localHours: v }); refresh(); }, hhmm);
    if (H.field) {
      const i = document.createElement('input'); i.type = 'date'; i.value = CK.day().date;
      i.onchange = () => { if (i.value) { CK.set({ date: i.value }); refresh(); } };
      H.field(host, 'date', i);
    }
    H.pills(host, CK.RATES.map(r => ({ label: rateLabel(r), value: r, title: r === 0 ? 'The clock stands' : 'The clock runs at ' + r + '× with play' })),
      o => o.value === CK.day().rate, o => { CK.rate(o.value); refresh(); });
    H.note(host, 'One clock for the shed and the world. It runs with play; the sun, the sky, the lamps and the ' +
                 'almanac follow it (' + CK.label() + ').');
    // ---- the clouds are next door --------------------------------------------------------
    if (ctx && ctx.open && typeof CLOUD_FIELD !== 'undefined') {
      head('clouds');
      const d = CK.day();
      const cover = d.cloudCover > 0 ? (d.cloudCover * 100).toFixed(0) + ' % ' + (CLOUD_FIELD.TYPES[d.cloudType] ? CLOUD_FIELD.TYPES[d.cloudType].label : d.cloudType) : 'clear';
      H.pills(host, [{ label: 'the clouds… (' + cover + ')', value: 'clouds', title: 'The decks, the veil, the look - the CLOUDS flyout' }],
        () => false, () => ctx.open('clouds'));
    }
  }
  const API = { PRESETS, mount, hhmm };
  if (typeof window !== 'undefined') window.DAY_UI = API;
  return API;
})();
