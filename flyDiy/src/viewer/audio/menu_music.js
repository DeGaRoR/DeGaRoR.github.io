// ============================================================
// THE MENU'S MUSIC (AUDIO-ROBUST 5, 22 Nov 2026). The user: "audio should start playing from the menu onwards, and
// through the loading, on by default, and a little button both in the menu and the loading screen to turn it off. Keep
// the possibility to choose a song, random, or radio Jolene".
//
// The welcome menu runs in the BOOT slot, BEFORE the island and before audio.js / music.js exist (welcome.js: nothing
// heavy runs until the player has chosen). So the menu's music is a small player of its own, here, in the BOOT slot
// (inlined ahead of welcome.js), and music.js TAKES ITS ELEMENT OVER when it connects (adopt(): the same <audio>
// element, the same song at the same second, routed into the game's mix) - one stream from the menu to the world:
// the menu, every loading screen, and (AUDIO.loadingBehind) the garage while the world still builds.
//
//   WHEN      at the player's FIRST click or key (the browser allows no sound before one), on the menu or on a
//             loading screen; never with ?audio=0, the sound off (flydiy.audio '0') or the loading music turned off
//             (flydiy.audio.musicLoading '0' - the SAME switch as the loading screen's button and the sound menu's
//             'music while loading', on by default)
//   WHAT      the player's station (flydiy.audio.station, music.js's: Radio Jolene - 'roots' - for a new player;
//             'mix' = Random; a station with no track plays lo-fi, as music.js does), a song dealt at random from
//             it, joined 15-60 % of its way in like tuning a live radio; the next one at its end
//   HOW LOUD  the element's own volume = master x music x the track's trim (music.js's levels: the loading screen's
//             mix is exactly that product, so the take-over is level)
//   THE CONTROLS  mount(card): a row on the menu card - a '♪ music on / off' pill and a picker: the stations (Radio
//             Jolene, Random, Jazz ...) and every song by name (a song: it plays now, its station becomes the
//             player's). The loading screen's #bootMusic button is wired here until music.js takes it (the same switch).
//   HIDDEN    a hidden tab pauses it (audio.js's rule), back -> it plays on
// Nothing allocates per frame (there are no frames: it is all events). ~4 KB of code, no fetch before the click.
// ============================================================
var MENU_MUSIC = (function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  if (!W || !W.document) return null;
  const D = W.document;
  const PFX = 'flydiy.audio';
  const get = (k, d) => { try { const v = W.localStorage && W.localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { if (W.localStorage) W.localStorage.setItem(k, String(v)); } catch (e) {} };
  const q = (() => { try { return new URLSearchParams(W.location ? W.location.search : '').get('audio'); } catch (e) { return null; } })();
  const SOUND_OFF = q === '0' || (q !== '1' && get(PFX, '1') === '0');
  // the stations, music.js's (GATE AUDIO holds the two lists equal)
  const STATIONS = [['roots', 'Radio Jolene'], ['mix', 'Random'], ['jazz', 'Jazz'], ['lofi', 'Lo-fi / Hip-hop'],
    ['dubambient', 'Dub / Ambient'], ['blues', 'Blues'], ['classical', 'Classical']];
  const ST_START = 'roots', ST_DEFAULT = 'lofi', LUFS_TARGET = -16, TRIM_MIN = 0.25, TRIM_MAX = 2, JOIN_MIN = 0.15, JOIN_MAX = 0.6;
  const cat = Array.isArray(W.FLYDIY_MUSIC) ? W.FLYDIY_MUSIC.filter(t => t && typeof t.file === 'string' && Array.isArray(t.contexts)) : [];
  const base = () => (typeof W.FLYDIY_ASSET_BASE === 'string' ? W.FLYDIY_ASSET_BASE : '');
  const urlOf = t => (/^(https?:|\/|\.)/.test(cat[t].file) ? cat[t].file : base() + cat[t].file);
  const trimOf = t => (typeof cat[t].lufs === 'number' ? Math.max(TRIM_MIN, Math.min(TRIM_MAX, Math.pow(10, (LUFS_TARGET - cat[t].lufs) / 20))) : 1);
  const vol = (k, d) => { const v = +get(PFX + '.' + k, d); return v === v ? Math.max(0, Math.min(1, v)) : d; };
  const stationOf = t => (cat[t] && cat[t].station) || ST_DEFAULT;
  const S = { el: null, t: -1, station: get(PFX + '.station', ST_START), adopted: false, playing: false, last: -1, ui: [] };
  if (!STATIONS.some(s => s[0] === S.station)) S.station = ST_START;   // ('off' and 'mine' fall back to the start station here)
  const on = () => !SOUND_OFF && get(PFX + '.musicLoading', '1') !== '0';
  // the station's songs (music.js's rule for a loading screen: every track of the station; Random: all; none: lo-fi)
  function listOf(st) {
    const all = cat.map((t, i) => i);
    if (st === 'mix') return all;
    const l = all.filter(i => stationOf(i) === st);
    return l.length ? l : all.filter(i => stationOf(i) === ST_DEFAULT);
  }
  function pick(st) {
    const l = listOf(st);
    if (!l.length) return -1;
    let t = l[Math.floor(Math.random() * l.length)];
    if (t === S.last && l.length > 1) t = l[(l.indexOf(t) + 1) % l.length];
    return t;
  }
  function level() { return S.t >= 0 ? Math.min(1, vol('master', 0.8) * vol('music', 0.6) * trimOf(S.t)) : 0; }
  function play(t, join) {
    if (S.adopted || t < 0) return;
    if (!S.el) {
      S.el = D.createElement('audio');
      S.el.crossOrigin = 'anonymous'; S.el.preload = 'auto';
      S.el.addEventListener('ended', onEnded);
      S.el.addEventListener('error', onEnded);
    }
    S.t = t; S.last = t;
    S.el.src = urlOf(t);
    S.el.volume = level();
    if (join && cat[t].durationS > 0) { try { S.el.currentTime = cat[t].durationS * (JOIN_MIN + (JOIN_MAX - JOIN_MIN) * Math.random()); } catch (e) {} }
    S.playing = true;
    try { const r = S.el.play(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    paint();
  }
  function stop() {
    S.playing = false;
    if (S.el && !S.adopted) { try { S.el.pause(); } catch (e) {} }
    paint();
  }
  function onEnded() { if (!S.adopted && S.playing) play(pick(S.station), false); }
  // the first click or key: the browser's permission for sound
  function gesture() {
    W.removeEventListener('pointerdown', gesture, true); W.removeEventListener('keydown', gesture, true);
    if (!S.adopted && !S.playing && on() && cat.length) play(pick(S.station), true);
  }
  if (!SOUND_OFF && cat.length) { W.addEventListener('pointerdown', gesture, true); W.addEventListener('keydown', gesture, true); }
  if (D.addEventListener) D.addEventListener('visibilitychange', () => {
    if (S.adopted || !S.el || !S.playing) return;
    try { if (D.hidden) S.el.pause(); else { const r = S.el.play(); if (r && r.catch) r.catch(() => {}); } } catch (e) {}
  });
  // the switch (the menu's pill and the loading screen's button: flydiy.audio.musicLoading, music.js's setting)
  function setOn(v) {
    put(PFX + '.musicLoading', v ? '1' : '0');
    if (v) { if (!S.playing) play(S.t >= 0 && listOf(S.station).indexOf(S.t) >= 0 ? S.t : pick(S.station), S.t < 0); }
    else stop();
  }
  function choose(v) {
    if (/^song:\d+$/.test(v)) {   // a song: it plays now, from its start; its station becomes the player's
      const t = +v.slice(5);
      if (!cat[t]) return;
      S.station = stationOf(t); put(PFX + '.station', S.station);
      put(PFX + '.musicLoading', '1'); play(t, false); return;
    }
    if (!STATIONS.some(s => s[0] === v)) return;
    S.station = v; put(PFX + '.station', v);
    put(PFX + '.musicLoading', '1'); play(pick(v), true);
  }
  function paint() {
    for (const u of S.ui) {
      const live = S.playing && on();
      u.btn.textContent = live ? '♪ music on' : '♪ music off';
      if (u.btn.classList) u.btn.classList.toggle('on', live);
      u.btn.title = live ? 'Music: on (press to turn it off)' : 'Music: off (press to turn it on)';
      if (u.sel) u.sel.value = S.station;
      if (u.now) u.now.textContent = live && S.t >= 0 ? cat[S.t].title + ' — ' + cat[S.t].artist : '';
    }
  }
  // the menu's row: the pill, the picker (stations, then every song), the song playing
  function mount(card) {
    if (SOUND_OFF || !cat.length || !card || !D.createElement) return null;
    const row = D.createElement('div'); row.className = 'wmusic';
    const btn = D.createElement('button'); btn.type = 'button'; btn.className = 'wmusicbtn';
    btn.onclick = () => setOn(!(S.playing && on()));
    const sel = D.createElement('select'); sel.className = 'wmusicsel'; sel.title = 'what plays: a station, Random, or one song';
    const g1 = D.createElement('optgroup'); g1.label = 'stations';
    for (const [k, l] of STATIONS) { const o = D.createElement('option'); o.value = k; o.textContent = l; g1.appendChild(o); }
    const g2 = D.createElement('optgroup'); g2.label = 'a song';
    cat.forEach((t, i) => { const o = D.createElement('option'); o.value = 'song:' + i; o.textContent = t.title + ' — ' + t.artist; g2.appendChild(o); });
    sel.appendChild(g1); sel.appendChild(g2);
    sel.onchange = () => { choose(sel.value); paint(); };
    const now = D.createElement('small'); now.className = 'wmusicnow';
    row.appendChild(btn); row.appendChild(sel); row.appendChild(now);
    card.appendChild(row);
    S.ui.push({ btn, sel, now });
    paint();
    return row;
  }
  // the loading screen's button, until music.js takes it (mountBootMusic replaces the handler: the same switch)
  function bootButton() {
    const b = D.getElementById && D.getElementById('bootMusic');
    if (!b || SOUND_OFF || !cat.length || b.dataset.mm) return;
    b.dataset.mm = '1'; b.hidden = false;
    S.ui.push({ btn: b, sel: null, now: null });
    b.onclick = () => setOn(!(S.playing && on()));
    paint();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', bootButton); else bootButton();
  // music.js's take-over: the element, its song and where it is; nothing of this player runs after it
  function adopt() {
    if (S.adopted || !S.el || !S.playing || S.t < 0 || S.el.ended) return null;
    S.adopted = true;
    S.el.removeEventListener('ended', onEnded); S.el.removeEventListener('error', onEnded);
    S.ui = S.ui.filter(u => u.sel);   // (the loading screen's button is music.js's from now)
    return { el: S.el, t: S.t, id: cat[S.t].id, pos: S.el.currentTime || 0 };
  }
  // music.js connected but did not take it (no Web Audio, its context says no music): the menu's song stops
  function release() { if (!S.adopted && S.el) { S.playing = false; try { S.el.pause(); S.el.removeAttribute('src'); S.el.load(); } catch (e) {} paint(); } }
  return { mount, adopt, release, setOn, choose, STATIONS, get playing() { return S.playing; }, get track() { return S.t; },
           get station() { return S.station; }, get adopted() { return S.adopted; }, _gesture: gesture };
})();
if (typeof window !== 'undefined') window.MENU_MUSIC = MENU_MUSIC;
if (typeof module !== 'undefined' && module.exports) module.exports = MENU_MUSIC;
