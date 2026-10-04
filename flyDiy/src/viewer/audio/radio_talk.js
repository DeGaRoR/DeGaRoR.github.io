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
      oneWay: aero.filter(a => a.kind === 'strip' && a.landHdg != null).map(a => ({ name: say(a.name), key: a.name, look: LOOK[a.look] != null ? LOOK[a.look] : (a.look || '') })),
      lanes: aero.filter(a => a.kind === 'water').map(a => say(a.name)),
      laneKeys: aero.filter(a => a.kind === 'water').map(a => a.name),   // (G1682: the clip keys are the game's names)
      declared,
    };
  }

  // ---- THE SEGMENTS -------------------------------------------------------------------------------------------------
  const seg = (kind, key, text, clips) => ({ kind, key, text, clips: clips || null });
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
  const MARINE_HEAD = 'Marine forecast for the inside waters, Jolene Sound and the passages';
  function marineWind(kt, dir, gust) {
    if (kt < 5) return 'variable winds five knots or less';
    const peak = kt * (1 + gust), lull = kt * (1 - gust);
    return compass(dir) + ' wind ' + numberWords(round5(kt)) + ' knots' + (peak - lull >= GUST_SPREAD_KT ? ', gusts to ' + numberWords(round5(peak)) : '');
  }
  const seasWords = ft => (Math.round(ft) <= 1 ? 'seas one foot or less' : 'seas ' + numberWords(Math.round(ft)) + ' feet');
  function marine(wx) {
    const kt = wx.windKt, part = partOfDay(wx.local);
    const head = kt >= GALE_KT ? ', gale warning' : kt >= SCA_KT ? ', small craft advisory' : '';
    const o = [MARINE_HEAD + head + '.',
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
  // the favoured end (its designator) and whether the wind is reported (3 kt and more)
  function favouredEnd(wx) {
    const ends = []; for (const r of wx.runways) ends.push(r[0], r[1]);
    let best = wx.runways[0][0];
    const windy = Math.round(wx.windKt) >= 3;
    if (windy) { let bc = -2; for (const e of ends) { const c = Math.cos((wx.windDirT - e * 10) * D2R); if (c > bc) { bc = c; best = e; } } }
    return { best, windy };
  }
  function favoured(wx) {
    if (!wx.runways.length) return '';
    const f = favouredEnd(wx);
    return 'At ' + wx.field + ', runway ' + digits(pad(f.best, 2)) + ' is favoured' + (f.windy ? ', ' + windAwos(wx) + '.' : ', the wind calm.');
  }
  // (the lines a recorded clip says whole: one per strip and lane - clipLines renders the declared places)
  const onewayLine = (name, look, wet) => name + (look ? ', ' + look : '') + (wet ? ', soft after the rain' : '') + ': it is one way, so land uphill and take off downhill.';
  const laneLine = name => 'The seaplane lane at ' + name + ' is active. Skiffs, keep clear of the buoys.';
  const isWet = wx => (wx.rh != null && wx.rh >= SOFT_RH) || !!(wx.storm && (wx.storm.phase === 'passage' || wx.storm.phase === 'post'));
  function pilots(wx, k) {
    const o = [LINES['intro.pilots']];
    const f = favoured(wx); if (f) o.push(f);
    if (wx.oneWay.length) { const s = wx.oneWay[k % wx.oneWay.length]; o.push(onewayLine(s.name, s.look, isWet(wx))); }
    if (wx.lanes.length) o.push(laneLine(wx.lanes[k % wx.lanes.length]));
    if (wx.runways.length) o.push('And the eagles are back on runway ' + digits(pad(wx.runways[0][0], 2)) + ' ' + thisPart(partOfDay(wx.local)) + '. Give them a low pass before you land.');
    return o.join(' ');
  }
  const greetLine = p => (p === 'night' ? 'Good evening, night owls.' : 'Good ' + p + '.');
  function stationId(wx, k) {
    const p = partOfDay(wx.local);
    const greet = greetLine(p);
    return greet + ' ' + LINES['id.main'] + (k % 2 ? ' The time on the island, ' + clockWords(wx.local) + '.' : '');
  }
  function backAnnounce(tracks) {
    const t = (tracks || []).filter(x => x && x.title);
    if (!t.length) return '';
    const one = x => say(x.title) + ' by ' + say(x.artist);
    return 'That was ' + one(t[0]) + (t[1] ? ', and before that, ' + one(t[1]) : '') + '.';
  }

  // ---- THE RECORDED VOICE (G1682, SND-RADIO-2; ruling s12) -----------------------------------------------------------
  // Every segment also carries `clips`: the same words as a SEQUENCE for AUDIO_VOICE.play (clip keys and rests in
  // seconds), or null when there is no clip form (no VOICE_MODEL on the page, a field the clips do not name, a track
  // with no id). The keys are VOICE_MODEL's words (the AWOS assembled from the game's weather by awosClips, the digits,
  // the marine numbers, the back-announces 'ba.<id>' / 'title.<id>' / 'artist.<slug>') and the station's own lines,
  // clipLines(places): LINES whole, the greetings, the time check, the pilots' and the marine forecast's phrases, one
  // line per one-way strip and sea lane (tools/audio/voice_script.json "places" declares Jolene's). A number or a place
  // with no clip is simply a key the catalogue lacks: the player (music.js) plays a segment's clips only when EVERY key
  // resolves (AUDIO_VOICE.missing), else speaks its text - per segment.
  const R_WORD = 0.05, R_GROUP = 0.28, R_SENT = 0.55;   // VOICE_MODEL.REST's
  const VMOD = () => G.VOICE_MODEL || (typeof VOICE_MODEL !== 'undefined' ? VOICE_MODEL : null);
  const slug = x => String(x || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const PARTS = ['morning', 'afternoon', 'evening', 'night'];
  const partKey = p => slug(thisPart(p));   // this_morning .. tonight
  // the front's "when" phrases (whenWords' whole range)
  const WHENS = ['within the next few hours'].concat(PARTS.map(p => 'later ' + thisPart(p)), PARTS.map(thisPart), PARTS.map(p => 'tomorrow ' + p));
  function clipLines(places) {
    const L = {}, pl = places || {};
    for (const k in LINES) L[k] = LINES[k];
    for (const p of PARTS) L['greet.' + p] = greetLine(p);
    L['time.intro'] = 'The time on the island,';
    for (let h = 1; h <= 12; h++) L['clk.h.' + h] = WORD[h] + ',';
    for (let m = 0; m < 60; m++) L['clk.m.' + m] = (m === 0 ? "o'clock" : m < 10 ? 'oh ' + WORD[m] : numberWords(m)) + '.';
    Object.assign(L, { 'pil.at_field': 'At ' + DECL.fieldName + ', runway,', 'pil.is_favoured': 'is favoured,', 'pil.is_favoured_calm': 'is favoured, the wind calm.',
      'pil.eagles': 'And the eagles are back on runway,', 'pil.low_pass': 'Give them a low pass before you land.' });
    for (const p of PARTS) L['part.' + partKey(p)] = thisPart(p) + '.';
    for (const [name, look] of pl.strips || []) { L['pil.oneway.' + slug(name)] = onewayLine(say(name), LOOK[look] != null ? LOOK[look] : look || '', false); L['pil.oneway.' + slug(name) + '.soft'] = onewayLine(say(name), LOOK[look] != null ? LOOK[look] : look || '', true); }
    for (const name of pl.lanes || []) L['pil.lane.' + slug(name)] = laneLine(say(name));
    L['mf.head'] = LINES['intro.marine'] + ' ' + MARINE_HEAD + '.';
    L['mf.head.sca'] = LINES['intro.marine'] + ' ' + MARINE_HEAD + ', small craft advisory.';
    L['mf.head.gale'] = LINES['intro.marine'] + ' ' + MARINE_HEAD + ', gale warning.';
    for (const p of PARTS) L['mf.part.' + p] = cap(thisPart(p)) + ',';
    Object.assign(L, { 'mf.variable': 'variable winds five knots or less.', 'mf.gusts_to': 'gusts to,', 'mf.seas_le1': 'Seas one foot or less.',
      'mf.rain_heavy': 'Rain, heavy at times.', 'mf.fog_dense': 'Dense fog, visibility under a mile.', 'mf.seas_building': 'seas building to,',
      'mf.easing': 'Easing behind the front, the wind backing and dropping off.', 'mf.little_change': 'Outlook, little change.' });
    for (const w of WHENS) L['mf.front.' + slug(w)] = 'A front ' + w + ':';
    return L;
  }
  // a digit string as clips (VOICE_MODEL's d.N, the last a final take when fin), word rests between
  function dig(o, str, fin) { for (let i = 0; i < str.length; i++) { if (i) o.push(R_WORD); o.push('d.' + str[i] + (fin && i === str.length - 1 ? '.f' : '')); } return o; }
  const add = (o, rest, ...keys) => { if (o.length) o.push(rest); for (let i = 0; i < keys.length; i++) { if (i) o.push(R_WORD); o.push(keys[i]); } return o; };
  // the AWOS observation VOICE_MODEL.awosClips reads, from what readGame read (the same rules as awos() above)
  function obsOf(wx) {
    const kt = Math.round(wx.windKt), peak = Math.round(wx.windKt * (1 + wx.gust)), lull = Math.round(wx.windKt * (1 - wx.gust));
    const sky = [];
    for (const L of wx.layers) { const c = coverClass(L.cover); if (c) sky.push({ cover: { few: 'FEW', scattered: 'SCT', broken: 'BKN', overcast: 'OVC' }[c], ft: L.baseM / FT }); }
    const s = ((Math.floor(wx.utc) % 86400) + 86400) % 86400;
    return { timeZ: Math.floor(s / 60), wind: { dirDeg: wx.windDirT, kt: kt < CALM_KT ? 0 : kt, gustKt: peak - lull >= GUST_SPREAD_KT ? peak : 0 },
      visSM: wx.visM / SM, sky, tempC: wx.oatC, dewC: wx.dewC, qnhPa: wx.qnhPa };
  }
  const jolene = wx => wx.field === DECL.fieldName;   // the clips name Jolene field (awos.intro, pil.at_field)
  function idClips(wx, k) {
    const o = add([], 0, 'greet.' + partOfDay(wx.local));
    add(o, R_GROUP, 'id.main');
    if (k % 2) { const sec = wx.local, m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600) % 24 % 12 || 12; add(o, R_SENT, 'time.intro', 'clk.h.' + h, 'clk.m.' + m); }
    return o;
  }
  function backClips(tracks) {
    const V = VMOD(), t = (tracks || []).filter(x => x && x.title);
    if (!V || !t.length || t.some(x => !x.id)) return null;
    const o = V.backAnnounce(t[0]).slice();
    if (t[1]) { o.push(R_SENT); o.push(...V.backAnnounce(t[1], 'before_that')); }
    return o;
  }
  function awosClipsOf(wx) {
    const V = VMOD();
    if (!V || !jolene(wx)) return null;
    return ['intro.awos', R_GROUP].concat(V.awosClips(obsOf(wx)));
  }
  function marineWindClips(o, kt, dir, gust) {
    if (kt < 5) return add(o, R_GROUP, 'mf.variable');
    add(o, R_WORD, 'mar.' + compass(dir), 'mar.wind', 'n.' + round5(kt), 'mar.knots');
    if (kt * (1 + gust) - kt * (1 - gust) >= GUST_SPREAD_KT) add(o, R_WORD, 'mf.gusts_to', 'n.' + round5(kt * (1 + gust)));
    return o;
  }
  const seasClips = (o, ft, building) => (Math.round(ft) <= 1 && !building ? add(o, R_SENT, 'mf.seas_le1')
    : add(o, building ? R_WORD : R_SENT, building ? 'mf.seas_building' : 'mar.seas', 'n.' + Math.max(1, Math.round(ft)), Math.max(1, Math.round(ft)) === 1 ? 'mar.foot' : 'mar.feet'));
  function marineClips(wx) {
    const kt = wx.windKt, part = partOfDay(wx.local), s = wx.storm, visKm = wx.visM / 1000;
    const o = add([], 0, kt >= GALE_KT ? 'mf.head.gale' : kt >= SCA_KT ? 'mf.head.sca' : 'mf.head');
    add(o, R_SENT, 'mf.part.' + part);
    marineWindClips(o, kt, wx.windDirT, wx.gust);
    seasClips(o, wx.seaFt, false);
    if (s && s.phase === 'passage') add(o, R_SENT, 'mf.rain_heavy');
    else if (visKm < 1) add(o, R_SENT, 'mf.fog_dense');
    else if (visKm < 5) add(o, R_SENT, 'mar.fog');
    if (s && (s.phase === 'none' || s.phase === 'pre') && s.inS > 0 && s.inS < 18 * 3600) {
      const k = Math.max(1, s.windK / Math.max(1, s.kNow || 1));
      add(o, R_SENT, 'mf.front.' + slug(whenWords(wx.local, s.inS)));
      marineWindClips(o, kt * k, wx.windDirT + s.veerDeg, wx.gust);
      seasClips(o, wx.seaFt * k * k, true);
    } else if (s && (s.phase === 'passage' || s.phase === 'post')) add(o, R_SENT, 'mf.easing');
    else add(o, R_SENT, 'mf.little_change');
    return o;
  }
  function windClips(o, wx) {
    const kt = Math.round(wx.windKt), d10 = Math.round(wx.windDirT / 10) * 10 % 360 || 360;
    const peak = Math.round(wx.windKt * (1 + wx.gust)), lull = Math.round(wx.windKt * (1 - wx.gust)), g = peak - lull >= GUST_SPREAD_KT;
    add(o, R_WORD, 'w.wind'); o.push(R_WORD); dig(o, pad(d10, 3), false); add(o, R_WORD, 'w.at'); o.push(R_WORD); dig(o, String(kt), !g);
    if (g) { add(o, R_WORD, 'w.gusts'); o.push(R_WORD); dig(o, String(peak), true); }
    return o;
  }
  function pilotsClips(wx, k) {
    if (wx.runways.length && !jolene(wx)) return null;
    const o = ['intro.pilots'];
    if (wx.runways.length) {
      const f = favouredEnd(wx);
      add(o, R_SENT, 'pil.at_field'); o.push(R_WORD); dig(o, pad(f.best, 2), false);
      if (f.windy) { add(o, R_WORD, 'pil.is_favoured'); windClips(o, wx); } else add(o, R_WORD, 'pil.is_favoured_calm');
    }
    if (wx.oneWay.length) add(o, R_SENT, 'pil.oneway.' + slug(wx.oneWay[k % wx.oneWay.length].key) + (isWet(wx) ? '.soft' : ''));
    if (wx.lanes.length) add(o, R_SENT, 'pil.lane.' + slug(wx.laneKeys[k % wx.lanes.length]));
    if (wx.runways.length) { add(o, R_SENT, 'pil.eagles'); o.push(R_WORD); dig(o, pad(wx.runways[0][0], 2), false); add(o, R_WORD, 'part.' + partKey(partOfDay(wx.local)), 'pil.low_pass'); }
    return o;
  }
  // the next break: tuning in = the ID and the weather; else the back-announce, the ID every other break, one feature
  function breakScript(state, wx, tracks, opt) {
    const k = state.k | 0, S = [];
    if (opt && opt.tuneIn) {
      S.push(seg('id', 'id.main', stationId(wx, 1), idClips(wx, 1)), seg('awos', 'awos', LINES['intro.awos'] + ' ' + awos(wx), awosClipsOf(wx)));
      state.k = k + 1; return S;
    }
    const b = backAnnounce(tracks);
    if (b) S.push(seg('back', 'back', b, backClips(tracks)));
    if (k % 2 === 0) S.push(seg('id', 'id.main', stationId(wx, k / 2), idClips(wx, k / 2)));
    const f = FEATURES[k % FEATURES.length];
    if (f === 'awos') S.push(seg('awos', 'awos', LINES['intro.awos'] + ' ' + awos(wx), awosClipsOf(wx)));
    else if (f === 'marine') S.push(seg('marine', 'marine', LINES['intro.marine'] + ' ' + marine(wx), marineClips(wx)));
    else if (f === 'pilots') { S.push(seg('pilots', 'pilots', pilots(wx, state.p | 0), pilotsClips(wx, state.p | 0))); state.p = (state.p | 0) + 1; }
    else if (f === 'bulletin') { const key = BULLETINS[(state.b | 0) % BULLETINS.length]; state.b = (state.b | 0) + 1; S.push(seg('bulletin', key, LINES['intro.bulletin'] + ' ' + LINES[key], ['intro.bulletin', R_SENT, key])); }
    else { const key = SWAPS[(state.s | 0) % SWAPS.length]; state.s = (state.s | 0) + 1; S.push(seg('swap', key, LINES['intro.swap'] + ' ' + LINES[key], ['intro.swap', R_SENT, key])); }
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

  // ---- THE TALKER (G1683, SND-RADIO-2): a break played segment by segment - a segment's recorded CLIPS when every key
  // has one (getVoice() -> AUDIO_VOICE: Web Audio, into o.dest - music.js's radio gain, so the music's ducks and the
  // context's suspend reach it), else its TEXT through makeSpeaker (speechSynthesis), else (no speech either) it is
  // skipped. Consecutive clip segments are ONE sequence (sample-exact, SEG_REST between them); consecutive spoken ones
  // are queued together. The same face as makeSpeaker - speak(segs, o, done) (done once: the last group's end, or a
  // cancel), cancel(silent), available(), speaking, voices(), pickVoice() - plus plan(segs) -> [{ clips, segs }],
  // seconds(segs, rate) (the watchdog's estimate: the clips' own length, the text's for speech) and `last` (what the
  // last break did, for the gate and the evidence). A cancelled break's late ends are ignored (a generation counter).
  const SEG_REST = 0.7;
  function makeTalker(env, getVoice) {
    const E = env || G, sp = makeSpeaker(E);
    const V = () => (getVoice ? getVoice() : null);
    let live = 0, gen = 0, onDone = null, handle = null, last = null;
    const resolves = x => { const v = V(); return !!(v && x.clips && x.clips.length && !v.missing(x.clips).length); };
    function plan(segs) {
      const groups = [];
      for (const x of segs) {
        const c = resolves(x), g = groups[groups.length - 1];
        if (g && g.clips === c) g.segs.push(x); else groups.push({ clips: c, segs: [x] });
      }
      return groups;
    }
    const seqOf = segs => { const o = []; for (const x of segs) { if (o.length) o.push(SEG_REST); for (const k of x.clips) o.push(k); } return o; };
    function seconds(segs, rate) {
      const v = V(), M = VMOD();
      return plan(segs).reduce((t, g) => t + SEG_REST + (g.clips && M ? M.timeline(seqOf(g.segs), k => v.dur(k)).total : estSeconds(g.segs, rate)), 0);
    }
    function finish() { if (!live) return; live = 0; gen++; handle = null; const f = onDone; onDone = null; if (f) f(); }
    function speak(segs, o, done) {
      cancel(true);
      if (!segs || !segs.length) return false;
      const groups = plan(segs);
      if (!groups.some(g => g.clips) && !sp.available()) return false;
      const my = ++gen, oo = o || {};
      live = 1; onDone = done || null;
      last = { groups: groups.map(g => ({ clips: g.clips, kinds: g.segs.map(x => x.kind) })), played: 0, spoken: 0, skipped: 0 };
      const L = last;
      let i = 0;
      const say = g => {   // a spoken group (the fallback); none possible -> skipped
        if (sp.available() && sp.speak(g.segs, oo, () => { if (my === gen) next(); })) { L.spoken += g.segs.length; return; }
        L.skipped += g.segs.length; next();
      };
      function next() {
        if (my !== gen) return;
        if (i >= groups.length) { finish(); return; }
        const g = groups[i++];
        if (!g.clips) { say(g); return; }
        const r = V().play(seqOf(g.segs), { dest: oo.dest, gain: oo.gain, onend: () => { if (my === gen) next(); } });
        Promise.resolve(r).then(h => {
          if (my !== gen) { if (h) h.stop(); return; }
          if (!h) { say(g); return; }   // nothing playable (no context, every clip failed): the voice reads it
          handle = h; L.played += g.segs.length;
        }, () => { if (my === gen) say(g); });
      }
      next();
      return true;
    }
    function cancel(silent) {
      if (!live) return;
      const f = onDone, h = handle; live = 0; gen++; onDone = null; handle = null;
      if (h) { try { h.stop(); } catch (e) {} }
      sp.cancel(true);
      if (!silent && f) f();
    }
    return { speak, cancel, plan, seconds, voices: sp.voices, pickVoice: sp.pickVoice,
      available: () => sp.available() || !!V(), get speaking() { return live === 1; }, get last() { return last; } };
  }

  const api = {
    LINES, BULLETINS, SWAPS, FEATURES, DECL, RATE, PITCH, PREFERRED_VOICE, GUST_SPREAD_KT, SCA_KT, GALE_KT,
    digits, signed, heightWords, roundFt, visWords, coverClass, compass, clockWords, numberWords, whenWords, say,
    readGame, windAwos, skyAwos, altimeter, zulu, awos, marine, favoured, pilots, stationId, backAnnounce, breakScript, estSeconds,
    makeSpeaker, makeTalker, clipLines, obsOf, slug, SEG_REST,
  };
  return api;
})();
if (typeof window !== 'undefined') window.RADIO_TALK = RADIO_TALK;
if (typeof module !== 'undefined' && module.exports) module.exports = RADIO_TALK;
