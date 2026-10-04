// ============================================================
// RADIO JOLENE'S TALK (SND-RADIO G1675-G1679, SOUND-2026-10-04 §7, the stations ruling 2026-10-04): window.RADIO_TALK -
// the community station's spoken breaks, written from THE GAME, and the voice that reads them.
//
//   PURE (node-testable, no DOM, no clock): readGame(world, opt) -> the numbers a break quotes, read off the world the
//             frame was handed (AUDIO.world): the DAY (07_day.js: oatC, dewC, the cloud base, the cover, the visibility,
//             qnhEff, utc / localSeconds / tzLabel, rh, the storm), the CLIMATE (09_climate.js: surfaceWind() - the 10 m
//             wind, grid frame -> TRUE by the day's convergence, the spec's gust; haze().surfaceVisM - the surface
//             visibility a pilot is told), the SEA (world.seaTarget.A, the wind sea the world raised) and the AERODROMES
//             (world.aerodromes: the home strip HOME = Jolene field, the strips' real names and surfaces, the one-way
//             strips, the sea lanes). Every number the game does not hold is DECLARED below and listed in `.declared`.
//             Then the segments, each a { kind, key, text } (the text is DATA: a recorded line can replace the voice
//             per key later - LINES are the static ones):
//               stationId   "Radio Jolene, ninety point seven, community radio for Jolene Island and the Sound", greeted
//                           by the part of the day, with a time check every other one
//               back        the back-announce: "That was <title> by <artist>, and before that ..."
//               awos        Jolene field automated weather, AWOS phrasing: zulu time, wind (calm / direction at speed /
//                           gusts), visibility (statute miles, fractions, "one zero"), sky (few / scattered / ceiling
//                           broken / overcast, "clear below one two thousand"), temperature, dew point (minus), altimeter
//                           (inches, digit by digit) - every digit spoken one by one, 9 as "niner"
//               marine      the inside waters: wind in compass words and 5 kt steps, seas, advisories, fog, the outlook
//                           (a front on the day's clock: rising, veering, seas building)
//               pilots      the favoured runway at the field (from the wind and the designators), a one-way strip (land
//                           uphill; soft after rain when the air is wet), the sea lane active, eagles on the runway
//               bulletin    island bulletins (mill, tram, ferry, fuel dock, potluck, coho run, library)
//               swap        swap corner
//             breakScript(state, wx, tracks, opt) -> the segments of the next break (a rotation; state counts breaks).
//   THE VOICE makeSpeaker(env): window.speechSynthesis - NOT Web Audio (a browser's speech never enters an
//             AudioContext), so the music's BED under it is the music deck's own gain (music.js). One utterance per
//             segment; done() once, when the last ends or the break is cancelled; a late onend of a cancelled break is
//             ignored (a generation counter). The voice by name (persisted by music.js), else Microsoft George (en-GB)
//             when the system has it, else an en-GB voice, else any English one, else the default.
// ============================================================
var RADIO_TALK = (function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const KT = 0.514444, SM = 1609.344, FT = 0.3048, INHG = 3386.389, D2R = Math.PI / 180;
  const DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
  const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const PREFERRED_VOICE = 'Microsoft George - English (United Kingdom)';
  // the user's bench settings (2026-10-04): rate 0.95, pitch 0.95
  const RATE = 0.95, PITCH = 0.95;
  // THE DECLARED NUMBERS (used only where the game holds none; each use is named in readGame's `.declared`)
  const DECL = {
    visM: 16093,        // no climate and no day: ten miles
    qnhPa: 101325,      // no day: the standard atmosphere
    oatC: 15, dewC: 5,  // no day: ISA and a dry 10 degree spread
    cover: 0, baseM: 1500,
    seaK: 0.018,        // no world.seaTarget: the world's own law (20_world.js: A = 0.018 x wind m/s)
    stormWindK: 2.2, stormVeerDeg: 55,   // 07_day.js STORM_D's defaults, when the front's spec names none
    fieldName: 'Jolene field',           // no HOME aerodrome
  };
  // the AWOS thresholds (FAA AC 150/5220-16 / the METAR rules, declared): a gust is reported when the peaks and lulls
  // differ by 10 kt or more; calm under 1 kt; the ceilometer sees to 12 000 ft; cover in oktas
  const GUST_SPREAD_KT = 10, CALM_KT = 1, SKY_TOP_FT = 12000;
  const SCA_KT = 23, GALE_KT = 34;   // the inside waters' small craft advisory and gale warning (NWS Alaska, declared)
  const SOFT_RH = 0.85;              // a wet day: the gravel strip is soft
  // the pronunciation table: what the voice must not spell out
  const SAY = [[/HoliznaCC0/g, 'Holizna'], [/\bAFB\b/g, 'field'], [/\bCC0\b/g, 'public domain'], [/ & /g, ' and ']];
  const say = s => { let o = String(s); for (const [re, w] of SAY) o = o.replace(re, w); return o; };
  // the runway looks (27_premises.js RUNWAY_LOOKS), said
  const LOOK = { grass: 'grass', worn: 'old concrete', concrete: 'concrete', asphalt: 'asphalt', gravel: 'gravel', dirt: 'dirt', sand: 'sand', none: '' };

  // ---- THE STATIC LINES (a recorded file may replace any of these by its key) --------------------------------------
  const LINES = {
    'id.main': 'Radio Jolene, ninety point seven, community radio for Jolene Island and the Sound.',
    'intro.awos': 'Here is the field.',
    'intro.marine': 'And the marine forecast.',
    'intro.pilots': 'Notes for pilots.',
    'intro.bulletin': 'Island bulletins.',
    'intro.swap': 'Swap corner.',
    'bulletin.mill': 'The sawmill at the head of the bay is on winter hours from Monday: seven in the morning till half past three, closed Sundays.',
    'bulletin.tram': 'The mine tram runs every half hour from the harbour road. The last car down leaves the top at a quarter past six.',
    'bulletin.ferry': 'The mainland ferry is running about forty minutes behind. If you are meeting someone, the coffee at the terminal is on.',
    'bulletin.fuel': 'The fuel dock has avgas and marine diesel again. Cash or the club card, and mind the new float on the north side.',
    'bulletin.potluck': 'Potluck at the community hall on Saturday at six. Bring a dish, bring a chair, bring your cousin.',
    'bulletin.coho': 'The coho are running at the creek mouth. Skiffs, please keep clear of the seaplane lane while you fish.',
    'bulletin.library': 'The library is open late on Thursday, until eight. Overdue books forgiven if you bring them back with a story.',
    'swap.floats': 'A set of float rigging for a Cub, needs new cables. Will trade for a chainsaw that runs. Ask at the boat shed.',
    'swap.tailwheel': 'For sale: a tailwheel, nearly round, and a crab pot, nearly square. Both at the fuel dock.',
    'swap.carb': 'Wanted: someone who can rebuild a carburettor and will not laugh at mine. Leave a note on the hangar door.',
    'swap.skiff': 'Free to a good home: a fourteen foot skiff with a little rain in it. The oars are the good part.',
  };
  const BULLETINS = ['bulletin.mill', 'bulletin.tram', 'bulletin.ferry', 'bulletin.fuel', 'bulletin.potluck', 'bulletin.coho', 'bulletin.library'];
  const SWAPS = ['swap.floats', 'swap.tailwheel', 'swap.carb', 'swap.skiff'];
  // the rotation of a break's feature (the weather twice a round: it is what the field listens for)
  const FEATURES = ['awos', 'bulletin', 'pilots', 'marine', 'awos', 'swap'];

  // ---- SPOKEN NUMBERS -----------------------------------------------------------------------------------------------
  const norm360 = d => ((d % 360) + 360) % 360;
  // every digit one by one ("2992" -> "two niner niner two"); a minus sign said
  function digits(v) {
    const s = String(v), o = [];
    for (const ch of s) { if (ch >= '0' && ch <= '9') o.push(DIG[+ch]); else if (ch === '-') o.push('minus'); else if (ch === '.') o.push('point'); }
    return o.join(' ');
  }
  const signed = t => { const r = Math.round(t); return (r < 0 ? 'minus ' : '') + digits(Math.abs(r)); };   // (-0.4 -> "zero")
  const pad = (n, w) => String(n).padStart(w, '0');
  // AWOS heights: "one two thousand", "four thousand five hundred", "eight hundred"
  function heightWords(ft) {
    const th = Math.floor(ft / 1000), hu = Math.round((ft % 1000) / 100), o = [];
    if (th > 0) o.push(digits(th) + ' thousand');
    if (hu > 0) o.push(DIG[hu] + ' hundred');
    return o.join(' ') || 'one hundred';
  }
  // the AWOS rounding: to 100 ft under 5 000, 500 ft to 10 000, 1 000 ft above; never under 100
  function roundFt(ft) {
    const q = ft < 5000 ? 100 : ft <= 10000 ? 500 : 1000;
    return Math.max(100, Math.round(ft / q) * q);
  }
  const VIS_STEPS = [[0.25, 'one quarter'], [0.5, 'one half'], [0.75, 'three quarters'], [1, 'one'], [1.25, 'one and one quarter'],
    [1.5, 'one and one half'], [1.75, 'one and three quarters'], [2, 'two'], [2.5, 'two and one half'], [3, 'three'], [4, 'four'],
    [5, 'five'], [6, 'six'], [7, 'seven'], [8, 'eight'], [9, 'niner'], [10, 'one zero']];
  // statute miles, the largest reportable value not above the measure ("10 SM" and more -> "one zero")
  function visWords(sm) {
    if (!(sm >= 0.25)) return 'less than one quarter';
    let w = VIS_STEPS[0][1];
    for (const [v, t] of VIS_STEPS) if (sm + 1e-9 >= v) w = t;
    return w;
  }
  const coverClass = c => (c < 0.0625 ? '' : c < 0.3125 ? 'few' : c < 0.5625 ? 'scattered' : c < 0.9375 ? 'broken' : 'overcast');
  const compass = d => COMPASS[Math.round(norm360(d) / 45) % 8];
  const round5 = k => Math.round(k / 5) * 5;
  // the local clock in words: "four twenty", "four o'clock", "four oh five"
  function clockWords(sec) {
    const m = Math.floor(sec / 60) % 60, h24 = Math.floor(sec / 3600) % 24, h = h24 % 12 || 12;
    const mm = m === 0 ? "o'clock" : m < 10 ? 'oh ' + WORD[m] : numberWords(m);
    return WORD[h] + ' ' + mm;
  }
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  function numberWords(n) {
    n = Math.round(n);
    if (n < 10) return WORD[n];
    if (n < 20) return TEENS[n - 10];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + WORD[n % 10] : '');
    return String(n);
  }
  const partOfDay = sec => { const h = (sec / 3600) % 24; return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night'; };
  const thisPart = p => (p === 'night' ? 'tonight' : 'this ' + p);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // when a thing `inS` seconds away happens, from the local second `now`: "within the next few hours", "later this
  // morning", "this evening", "tonight", "tomorrow morning"
  function whenWords(now, inS) {
    if (inS < 3 * 3600) return 'within the next few hours';
    const at = now + inS, p = partOfDay(at), tomorrow = Math.floor(at / 86400) > Math.floor(now / 86400) && (at % 86400) >= 5 * 3600;
    if (tomorrow) return 'tomorrow ' + (p === 'night' ? 'night' : p);
    return (p === partOfDay(now) ? 'later ' : '') + thisPart(p);
  }

  // ---- READING THE GAME ---------------------------------------------------------------------------------------------
  // world: AUDIO.world (day, climate, seaTarget, aerodromes); opt.sim: the page's sim (out.windX/Z when no climate)
  function readGame(W, opt) {
    opt = opt || {};
    const day = W && W.day, cl = W && W.climate, declared = [];
    const num = v => typeof v === 'number' && v === v;
    const geo = day && day.geo;
    const conv = geo && num(geo.convergenceDeg) ? geo.convergenceDeg : 0;
    // THE WIND: the climate's 10 m wind (grid: x east, z south) -> FROM, true (09_climate bearingToBase inverted)
    let spd = 0, dirT = 0, gust = 0, windFrom = 'climate';
    const sw = cl && cl.surfaceWind ? cl.surfaceWind() : null;
    const out = opt.sim && opt.sim.out;
    if (sw && sw.base) {
      const b = sw.base; spd = Math.hypot(b[0], b[2]);
      dirT = spd > 0.05 ? norm360(Math.atan2(-b[0], b[2]) / D2R + conv) : 0;
      gust = cl.spec && num(cl.spec.gust) ? cl.spec.gust : 0;
    } else if (out && num(out.windX)) {
      spd = Math.hypot(out.windX, out.windZ || 0); dirT = spd > 0.05 ? norm360(Math.atan2(-out.windX, out.windZ || 0) / D2R + conv) : 0;
      windFrom = 'sim'; declared.push('wind: no climate - the solver\'s wind at the aeroplane (out.windX/Z), gusts unknown');
    } else { windFrom = 'none'; declared.push('wind: no climate and no sim - calm'); }
    // THE VISIBILITY: the climate's surface visibility (Koschmieder, both media), else the day's column
    let visM;
    const hz = cl && cl.haze ? cl.haze() : null;
    if (hz && num(hz.surfaceVisM)) visM = hz.surfaceVisM;
    else if (day && num(day.visibilityKm)) { visM = day.visibilityKm * 1000; declared.push('visibility: the day\'s column (no climate haze)'); }
    else { visM = DECL.visM; declared.push('visibility: ' + DECL.visM + ' m (declared)'); }
    // THE SKY: the day's low deck (its base the LCL, 125 m a degree of spread: above the surface) + the upper decks that
    // name a base; the cover the effective one (a front's included)
    const layers = [];
    if (day) {
      const cov = num(day.cloudCoverEff) ? day.cloudCoverEff : num(day.cloudCover) ? day.cloudCover : 0;
      if (num(day.cloudBase)) layers.push({ cover: cov, baseM: day.cloudBase });
      else { layers.push({ cover: cov, baseM: DECL.baseM }); declared.push('cloud base: ' + DECL.baseM + ' m (declared)'); }
      for (const u of Array.isArray(day.cloudUpper) ? day.cloudUpper : []) if (u && num(u.base)) layers.push({ cover: u.cover || 0, baseM: u.base });
    } else declared.push('sky: no day - clear (declared)');
    layers.sort((a, b) => a.baseM - b.baseM);
    const oatC = day && num(day.oatC) ? day.oatC : (declared.push('temperature: ' + DECL.oatC + ' C (declared)'), DECL.oatC);
    const dewC = day && num(day.dewC) ? day.dewC : (declared.push('dew point: ' + DECL.dewC + ' C (declared)'), DECL.dewC);
    const qnhPa = day && num(day.qnhEff) ? day.qnhEff : day && num(day.qnhPa) ? day.qnhPa : (declared.push('QNH: 1013.25 hPa (declared)'), DECL.qnhPa);
    const utc = day && num(day.utc) ? day.utc : 0, local = day && num(day.localSeconds) ? day.localSeconds : utc;
    if (!day) declared.push('time: no day - 0000 zulu');
    const st = day && day.storm ? day.storm : null, ss = day && day.stormSpec ? day.stormSpec : null;
    // THE SEA: the wind sea the world is raising (amplitude A -> crest to trough 2A)
    let seaA;
    if (W && W.seaTarget && num(W.seaTarget.A)) seaA = W.seaTarget.A;
    else { seaA = spd > 0.5 ? DECL.seaK * spd : 0; declared.push('sea: the world\'s law 0.018 x wind (no seaTarget)'); }
    // THE AERODROMES
    const aero = W && Array.isArray(W.aerodromes) ? W.aerodromes : [];
    const home = aero.find(a => a.id === 'HOME') || aero.find(a => a.kind === 'strip') || null;
    if (!home) declared.push('field: no home aerodrome - "' + DECL.fieldName + '"');
    const prefix = n => String(n || '').replace(/\s*\d{1,2}[LRC]?\/\d{1,2}[LRC]?\s*$/, '').trim();
    const desig = n => { const m = /(\d{1,2})[LRC]?\/(\d{1,2})[LRC]?\s*$/.exec(String(n || '')); return m ? [+m[1], +m[2]] : null; };
    const homeName = home ? prefix(home.name) : '';
    // the field's runways, the home strip's first (the calm-wind runway, the eagles')
    const runways = aero.filter(a => a.kind === 'strip' && homeName && prefix(a.name) === homeName && desig(a.name))
      .sort((a, b) => (a === home ? -1 : b === home ? 1 : 0)).map(a => desig(a.name));
    return {
      field: say(homeName || DECL.fieldName), homeName, runways,
      windKt: spd / KT, windDirT: dirT, gust, windFrom,
      visM, layers, oatC, dewC, rh: day && num(day.rh) ? day.rh : null, qnhPa, utc, local, tz: (day && day.tzLabel) || 'UTC',
      // (kNow: the factor the front already puts on the wind read above - 07_day's storm.windK at this hour)
      storm: st ? { I: st.I, phase: st.phase, inS: st.inS, kNow: num(st.windK) ? st.windK : 1, windK: ss && num(ss.windK) ? ss.windK : DECL.stormWindK,
                    veerDeg: ss && num(ss.veerDeg) ? ss.veerDeg : DECL.stormVeerDeg } : null,
      seaFt: 2 * seaA / FT,
      oneWay: aero.filter(a => a.kind === 'strip' && a.landHdg != null).map(a => ({ name: say(a.name), look: LOOK[a.look] != null ? LOOK[a.look] : (a.look || '') })),
      lanes: aero.filter(a => a.kind === 'water').map(a => say(a.name)),
      declared,
    };
  }

  // ---- THE SEGMENTS -------------------------------------------------------------------------------------------------
  const seg = (kind, key, text) => ({ kind, key, text });
  // the wind, AWOS: calm / "two five zero at eight" / "... gusts two six"
  function windAwos(wx) {
    const kt = Math.round(wx.windKt);
    if (kt < CALM_KT) return 'wind calm';
    const d10 = Math.round(wx.windDirT / 10) * 10 % 360 || 360;
    const peak = Math.round(wx.windKt * (1 + wx.gust)), lull = Math.round(wx.windKt * (1 - wx.gust));
    return 'wind ' + digits(pad(d10, 3)) + ' at ' + digits(kt) + (peak - lull >= GUST_SPREAD_KT ? ' gusts ' + digits(peak) : '');
  }
  function skyAwos(wx) {
    const o = [];
    let ceiling = false;
    for (const L of wx.layers) {
      const cls = coverClass(L.cover), ft = roundFt(L.baseM / FT);
      if (!cls || L.baseM / FT >= SKY_TOP_FT) continue;
      if ((cls === 'broken' || cls === 'overcast') && !ceiling) { ceiling = true; o.push('ceiling ' + heightWords(ft) + ' ' + cls); }
      else o.push((cls === 'few' ? 'few clouds' : cls === 'scattered' ? 'scattered clouds' : cls) + ' at ' + heightWords(ft));
    }
    return o.length ? 'sky condition ' + o.join(', ') : 'sky condition clear below one two thousand';
  }
  const altimeter = qnhPa => digits(pad(Math.round(qnhPa / INHG * 100), 4));
  const zulu = utc => { const s = ((Math.floor(utc) % 86400) + 86400) % 86400; return digits(pad(Math.floor(s / 3600), 2) + pad(Math.floor(s / 60) % 60, 2)); };
  function awos(wx) {
    const t = [wx.field + ' automated weather observation, ' + zulu(wx.utc) + ' zulu', windAwos(wx), 'visibility ' + visWords(wx.visM / SM),
      skyAwos(wx), 'temperature ' + signed(wx.oatC) + ', dew point ' + signed(wx.dewC), 'altimeter ' + altimeter(wx.qnhPa)];
    return t.map(cap).join('. ') + '.';
  }
  function marineWind(kt, dir, gust) {
    if (kt < 5) return 'variable winds five knots or less';
    const peak = kt * (1 + gust), lull = kt * (1 - gust);
    return compass(dir) + ' wind ' + numberWords(round5(kt)) + ' knots' + (peak - lull >= GUST_SPREAD_KT ? ', gusts to ' + numberWords(round5(peak)) : '');
  }
  const seasWords = ft => (Math.round(ft) <= 1 ? 'seas one foot or less' : 'seas ' + numberWords(Math.round(ft)) + ' feet');
  function marine(wx) {
    const kt = wx.windKt, part = partOfDay(wx.local);
    const head = kt >= GALE_KT ? ', gale warning' : kt >= SCA_KT ? ', small craft advisory' : '';
    const o = ['Marine forecast for the inside waters, Jolene Sound and the passages' + head + '.',
      cap(thisPart(part)) + ', ' + marineWind(kt, wx.windDirT, wx.gust) + '. ' + cap(seasWords(wx.seaFt)) + '.'];
    const visKm = wx.visM / 1000, s = wx.storm;
    if (s && s.phase === 'passage') o.push('Rain, heavy at times.');
    else if (visKm < 1) o.push('Dense fog, visibility under a mile.');
    else if (visKm < 5) o.push('Patchy fog.');
    if (s && (s.phase === 'none' || s.phase === 'pre') && s.inS > 0 && s.inS < 18 * 3600) {
      const k = Math.max(1, s.windK / Math.max(1, s.kNow || 1));   // the rest of the front's rise (the wind read carries kNow)
      o.push('A front ' + whenWords(wx.local, s.inS) +
        ': ' + marineWind(kt * k, wx.windDirT + s.veerDeg, wx.gust) + ', ' + seasWords(wx.seaFt * k * k).replace('seas', 'seas building to') + '.');
    } else if (s && (s.phase === 'passage' || s.phase === 'post')) o.push('Easing behind the front, the wind backing and dropping off.');
    else o.push('Outlook, little change.');
    return o.join(' ');
  }
  // the favoured runway at the field: the designator end most into the wind (designator x 10 against the true wind:
  // declared - the magnetic variation is not carried); calm -> the first designator of the home strip
  function favoured(wx) {
    if (!wx.runways.length) return '';
    const ends = []; for (const r of wx.runways) ends.push(r[0], r[1]);
    let best = wx.runways[0][0];
    if (Math.round(wx.windKt) >= 3) { let bc = -2; for (const e of ends) { const c = Math.cos((wx.windDirT - e * 10) * D2R); if (c > bc) { bc = c; best = e; } } }
    return 'At ' + wx.field + ', runway ' + digits(pad(best, 2)) + ' is favoured' + (Math.round(wx.windKt) >= 3 ? ', ' + windAwos(wx) + '.' : ', the wind calm.');
  }
  function pilots(wx, k) {
    const o = [LINES['intro.pilots']];
    const f = favoured(wx); if (f) o.push(f);
    if (wx.oneWay.length) {
      const s = wx.oneWay[k % wx.oneWay.length];
      const wet = (wx.rh != null && wx.rh >= SOFT_RH) || (wx.storm && (wx.storm.phase === 'passage' || wx.storm.phase === 'post'));
      o.push(s.name + (s.look ? ', ' + s.look : '') + (wet ? ', soft after the rain' : '') + ': it is one way, so land uphill and take off downhill.');
    }
    if (wx.lanes.length) o.push('The seaplane lane at ' + wx.lanes[k % wx.lanes.length] + ' is active. Skiffs, keep clear of the buoys.');
    if (wx.runways.length) o.push('And the eagles are back on runway ' + digits(pad(wx.runways[0][0], 2)) + ' ' + thisPart(partOfDay(wx.local)) + '. Give them a low pass before you land.');
    return o.join(' ');
  }
  function stationId(wx, k) {
    const p = partOfDay(wx.local);
    const greet = p === 'night' ? 'Good evening, night owls.' : 'Good ' + p + '.';
    return greet + ' ' + LINES['id.main'] + (k % 2 ? ' The time on the island, ' + clockWords(wx.local) + '.' : '');
  }
  function backAnnounce(tracks) {
    const t = (tracks || []).filter(x => x && x.title);
    if (!t.length) return '';
    const one = x => say(x.title) + ' by ' + say(x.artist);
    return 'That was ' + one(t[0]) + (t[1] ? ', and before that, ' + one(t[1]) : '') + '.';
  }
  // the next break: tuning in = the ID and the weather; else the back-announce, the ID every other break, one feature
  function breakScript(state, wx, tracks, opt) {
    const k = state.k | 0, S = [];
    if (opt && opt.tuneIn) {
      S.push(seg('id', 'id.main', stationId(wx, 1)), seg('awos', 'awos', LINES['intro.awos'] + ' ' + awos(wx)));
      state.k = k + 1; return S;
    }
    const b = backAnnounce(tracks);
    if (b) S.push(seg('back', 'back', b));
    if (k % 2 === 0) S.push(seg('id', 'id.main', stationId(wx, k / 2)));
    const f = FEATURES[k % FEATURES.length];
    if (f === 'awos') S.push(seg('awos', 'awos', LINES['intro.awos'] + ' ' + awos(wx)));
    else if (f === 'marine') S.push(seg('marine', 'marine', LINES['intro.marine'] + ' ' + marine(wx)));
    else if (f === 'pilots') { S.push(seg('pilots', 'pilots', pilots(wx, state.p | 0))); state.p = (state.p | 0) + 1; }
    else if (f === 'bulletin') { const key = BULLETINS[(state.b | 0) % BULLETINS.length]; state.b = (state.b | 0) + 1; S.push(seg('bulletin', key, LINES['intro.bulletin'] + ' ' + LINES[key])); }
    else { const key = SWAPS[(state.s | 0) % SWAPS.length]; state.s = (state.s | 0) + 1; S.push(seg('swap', key, LINES['intro.swap'] + ' ' + LINES[key])); }
    state.k = k + 1;
    return S;
  }
  // the seconds a break should take at a rate (the player's watchdog: a browser that never fires onend still ends it)
  const estSeconds = (segs, rate) => segs.reduce((s, x) => s + x.text.length, 0) / 14 / (rate || 1) + 0.6 * segs.length;

  // ---- THE VOICE (speechSynthesis) ------------------------------------------------------------------------------------
  function makeSpeaker(env) {
    const E = env || G;
    let live = 0, gen = 0, onDone = null;
    const synth = () => E.speechSynthesis || null;
    const available = () => !!(synth() && E.SpeechSynthesisUtterance);
    function voices() { try { return (synth() && synth().getVoices()) || []; } catch (e) { return []; } }
    function pickVoice(name) {
      const v = voices();
      return v.find(x => name && x.name === name) || v.find(x => x.name === PREFERRED_VOICE) ||
        v.find(x => /^en[-_]GB/i.test(x.lang || '')) || v.find(x => /^en/i.test(x.lang || '')) || null;
    }
    function finish() { if (!live) return; live = 0; gen++; const f = onDone; onDone = null; if (f) f(); }
    // speak the segments; done() once when the last ends (or on cancel). false when there is no voice to speak with
    function speak(segs, o, done) {
      cancel(true);
      const S = synth();
      if (!S || !E.SpeechSynthesisUtterance || !segs.length) return false;
      const my = ++gen, v = pickVoice(o && o.voice);
      let left = segs.length;
      onDone = done || null; live = 1;
      for (const s of segs) {
        const u = new E.SpeechSynthesisUtterance(s.text);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
        u.rate = o && o.rate || RATE; u.pitch = o && o.pitch || PITCH; u.volume = o && o.volume != null ? o.volume : 1;
        u.onend = u.onerror = () => { if (my === gen && --left <= 0) finish(); };
        try { S.speak(u); } catch (e) { cancel(true); return false; }
      }
      return true;
    }
    // stop now; done() runs unless silent
    function cancel(silent) {
      if (!live) return;
      const f = onDone; live = 0; gen++; onDone = null;
      try { synth().cancel(); } catch (e) {}
      if (!silent && f) f();
    }
    return { speak, cancel, voices, pickVoice, available, get speaking() { return live === 1; } };
  }

  const api = {
    LINES, BULLETINS, SWAPS, FEATURES, DECL, RATE, PITCH, PREFERRED_VOICE, GUST_SPREAD_KT, SCA_KT, GALE_KT,
    digits, signed, heightWords, roundFt, visWords, coverClass, compass, clockWords, numberWords, whenWords, say,
    readGame, windAwos, skyAwos, altimeter, zulu, awos, marine, favoured, pilots, stationId, backAnnounce, breakScript, estSeconds,
    makeSpeaker,
  };
  return api;
})();
if (typeof window !== 'undefined') window.RADIO_TALK = RADIO_TALK;
if (typeof module !== 'undefined' && module.exports) module.exports = RADIO_TALK;
