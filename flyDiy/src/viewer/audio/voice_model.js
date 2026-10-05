// ============================================================
// RADIO JOLENE'S VOICE - THE TIMELINE (G1626-G1627, SND-VOICE; G1701, SND-RADIO-3; SOUND-2026-10-04 ruling s12).
// window.VOICE_MODEL (and module.exports in node): PURE - no Web Audio, no fetch, no clock.
//
// The station speaks in RECORDED takes: neural voices (Piper, MIT; voices trained from scratch on public-domain /
// CC-BY recordings - CREDITS.md, voice_catalogue.json) rendered OFFLINE by tools/audio/prep_voice.js into
// media/audio/voice/. Every take is a WHOLE line written for the ear (tools/audio/radio_gen.js): the AWOS vocabulary,
// its digits and its word assemblers are retired (G1701 - the user: "a series of numbers, badly linked").
//
//   timeline(seq, durOf)  a SEQUENCE - take keys (strings) and rests (numbers, seconds) - laid end to end: { at: [{ key,
//                         t, dur }], total }. A key whose dur is not > 0 (a take that failed to load) closes up; the rests
//                         stay. AUDIO_VOICE.play schedules each take at its t, sample-exact.
// ============================================================
var VOICE_MODEL = (function () {
  'use strict';
  function timeline(seq, durOf) {
    const at = []; let t = 0;
    for (const s of seq || []) {
      if (typeof s === 'number') { if (s > 0 && isFinite(s)) t += s; continue; }
      const d = +durOf(s); if (!(d > 0)) continue;
      at.push({ key: s, t, dur: d }); t += d;
    }
    return { at, total: t };
  }
  return { timeline };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VOICE_MODEL;
