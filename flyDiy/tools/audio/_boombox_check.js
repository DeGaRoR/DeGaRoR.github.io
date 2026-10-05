#!/usr/bin/env node
// GATE BOOMBOX (G1713, SND-BOOMBOX) - the shed's radio, in node (no browser, no Web Audio):
//   BB_QUICK  editor.js's QUICK table, read and run in a vm over recording AUDIO / AUDIO_MUSIC stand-ins and the real
//             boombox.js: `sound` drives AUDIO.enable both ways and shows the state (a struck speaker off; ?audio=0
//             greyed and said); `radio` turns the music on when there was none (the sound first, music in the garage
//             on - OFF by default), else steps the station (stepStation(1)); after 'off' it plays the last station; its
//             second action (right-click / hold) is setStation('off'); the bar listens to AUDIO's events.
//   BB_HIT    boombox.js's pick on vendor THREE: the oriented box (PROP_REG's bb) struck along a camera ray; an
//             aeroplane hit NEARER keeps the click, one behind it does not; a hidden kit is not struck; a vertical ray
//             inside the world AABB but outside the rotated box misses. hangar.js's mobileProp resolves 'prop:boombox'
//             (propPlace's name); app.js asks BOOMBOX.click before the switches and EDITOR_PICK, hovers through it, and
//             calls BOOMBOX.frame once, after AUDIO.update; frame() does nothing while the panel is closed.
//   BB_PANEL  the panel on tools/_page_dom.js: in #edView, now playing, every station + off, each control calling its
//             API (setStation + musicGarage on, set('music'), set('master'), skip, setTalk, the two music toggles,
//             openCredits, the folder pick); Esc, a press outside and the radio off screen close it; ?audio=0 and the
//             sound off build only the line and the switch.
//   BB_MINE   my_music.js + the real audio.js + music.js: nothing touched before a gesture (no IndexedDB, no picker, no
//             object URL); the picker stubbed - the audio files kept (titles from names), the handle alone stored; the
//             'mine' station plays blob: URLs through the decks, a track of unknown length is not cut, every URL is
//             revoked when its deck lets it go (at most two live), forget drops the station; the next visit: a granted
//             handle walked on restore, a 'prompt' one only on reconnect (requestPermission); the <input webkitdirectory>
//             fallback; a page that loaded on 'mine' returns to it once the folder is back.
//   SELFTEST  every check run again on MUTATED source text (in memory) must go red; the files on disk byte-identical.
//   node tools/audio/_boombox_check.js [--selftest]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const FILES = {
  boombox: 'src/viewer/boombox.js', editor: 'src/viewer/editor.js', music: 'src/viewer/audio/music.js',
  mymusic: 'src/viewer/audio/my_music.js', audio: 'src/viewer/audio/audio.js', params: 'src/viewer/audio/audio_params.js',
  app: 'src/viewer/app.js', hangar: 'src/viewer/hangar.js', props: 'src/viewer/props.js', build: 'tools/build.js',
  css: 'src/viewer/editor.css', curio: 'src/props/props_curio.js',
};
const readAll = () => { const S = {}; for (const k in FILES) S[k] = fs.readFileSync(path.join(ROOT, FILES[k]), 'utf8'); return S; };
const shaOf = S => crypto.createHash('sha256').update(Object.keys(FILES).map(k => S[k]).join('\u0000')).digest('hex');
const SRC0 = readAll(), SHA0 = shaOf(SRC0);
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const { makeDocument } = require(path.join(ROOT, 'tools', '_page_dom.js'));
const STATIONS = ['jazz', 'lofi', 'dubambient', 'roots', 'blues', 'classical', 'mix'];

// the boombox's registry row, off the baked pack (registerPropPack's argument)
function propRow(S) {
  let pack = null;
  vm.runInNewContext(S.curio, { registerPropPack: p => { pack = p; } }, { filename: 'props_curio.js' });
  return pack && pack.props && pack.props.boombox;
}
// a balanced slice of src from the opener at `at` ('[' or '{')
function balanced(src, at) {
  const open = src[at], close = open === '[' ? ']' : '}';
  let d = 0;
  for (let i = at; i < src.length; i++) { if (src[i] === open) d++; else if (src[i] === close && !--d) return src.slice(at, i + 1); }
  throw new Error('unbalanced ' + open);
}

// ---- recording stand-ins (BB_QUICK, BB_PANEL) ---------------------------------------------------------------------------
function fakeAudio(o, store) {
  o = o || {};
  const calls = [], H = {}, set = { musicGarage: o.mg ? 1 : 0, music: 0.6, master: 0.8, musicFlight: 0 };
  const A = { enabled: o.enabled !== false, state: o.state || 'running', calls,
    enable(on) {
      calls.push(['enable', !!on]);
      if (!A.enabled) { if (on && !o.q0) store['flydiy.audio'] = '1'; return; }
      A.state = on ? 'running' : 'off';
    },
    get: k => set[k],
    set(k, v) { calls.push(['set', k, v]); if (A.enabled) set[k] = v; A.emit('settings', { k }); },
    onEvent(t, fn) { (H[t] = H[t] || []).push(fn); return () => { const a = H[t]; a.splice(a.indexOf(fn), 1); }; },
    emit(t, d) { for (const f of (H[t] || []).slice()) f(d); },
    listeners: t => (H[t] || []).length };
  return A;
}
function fakeMusic(o) {
  o = o || {};
  const calls = [];
  const M = { STATION_KEYS: STATIONS.slice(), ST_MINE: 'mine', station: o.station || 'roots', hasMine: !!o.mine, mineCount: o.mine ? 3 : 0,
    mineName: o.mine ? 'Albums' : '', lastStation: o.last || 'roots', talk: true, calls,
    setStation(s) { calls.push(['setStation', s]); M.station = s; return true; },
    stepStation(d) { calls.push(['stepStation', d]); return true; },
    labelOf: s => (s === 'mine' ? 'My music' : s === 'off' ? 'radio off' : 'L:' + s),
    skip() { calls.push(['skip']); return true; }, setTalk(on) { calls.push(['setTalk', !!on]); M.talk = !!on; },
    openCredits() { calls.push(['openCredits']); }, nowPlaying: () => ({ title: 'Song Title', artist: 'An Artist', licence: 'CC0' }) };
  return M;
}
const did = (calls, name, ...args) => calls.some(c => c[0] === name && args.every((a, i) => c[i + 1] === a));
const idx = (calls, name) => calls.findIndex(c => c[0] === name);

// a vm page for boombox.js (and the QUICK table): window = the context
function bbPage(S, o) {
  o = o || {};
  const store = o.store || {};
  const ctx = { console: o.loud ? console : { warn() {}, log() {}, error() {}, info() {} }, THREE, URLSearchParams, Date, Math,
    setTimeout: () => 0, clearTimeout() {}, Promise, location: { search: o.search || '' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
  ctx.window = ctx; ctx.globalThis = ctx;
  if (o.dom) {
    const D = makeDocument({ html: '<div id="edView"></div>', win: ctx });
    ctx.document = D.document; ctx.Event = D.Event;
    ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
    ctx.innerWidth = 1200; ctx.innerHeight = 800;
    const view = D.document.getElementById('edView');
    view.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 });
    ctx.__D = D;
  }
  ctx.AUDIO = o.A; ctx.AUDIO_MUSIC = o.M; ctx.AUDIO_MYMUSIC = o.MY;
  if (o.reg) ctx.PROP_REG = o.reg;
  vm.createContext(ctx);
  vm.runInContext(S.boombox, ctx, { filename: 'boombox.js' });
  return Object.assign(ctx, { store, B: ctx.BOOMBOX });
}

// ---- BB_QUICK ---------------------------------------------------------------------------------------------------------
function quickOf(S, page) {
  const e = S.editor, q0 = e.indexOf('const QI = {'), q1 = e.indexOf('const QUICK = [');
  if (q0 < 0 || q1 < 0) throw new Error('editor.js has no QI / QUICK');
  const qi = balanced(e, e.indexOf('{', q0)), qa = balanced(e, e.indexOf('[', q1));
  return vm.runInContext('(function () { const $ = () => null; const QI = ' + qi + '; return ' + qa + '; })()', page);
}
function checkQuick(S) {
  const F = [];
  const run = (o, fn) => {
    const store = o.store || {};
    const A = fakeAudio(o.a, store), M = fakeMusic(o.m);
    const pg = bbPage(S, { A, M, search: o.search, store });
    const Q = quickOf(S, pg), q = k => Q.find(x => x.k === k);
    if (!q('sound') || !q('radio')) { F.push('the quick bar has no `sound` / `radio` entry'); return; }
    fn(q, A, M, pg);
  };
  for (const k of ['sound', 'radio']) run({}, q => { const e = q(k); if (e.row || typeof e.state !== 'string' || !(e.why && e.why.length >= 20)) F.push('`' + k + '` neither names a row nor declares its state and why'); });
  // sound: on -> off, off -> on, the icon is the state
  run({ a: { state: 'running' } }, (q, A) => {
    const v = q('sound').view();
    if (!v.on || v.off) F.push('sound running: the button does not read on');
    if (v.icon.indexOf('a3.6 3.6') < 0) F.push('sound on: no waves in the icon');
    q('sound').act();
    if (!did(A.calls, 'enable', false)) F.push('sound on, pressed: AUDIO.enable(false) not called');
  });
  run({ a: { state: 'off' } }, (q, A) => {
    const v = q('sound').view();
    if (v.on || v.icon.indexOf('M2.4 2.6l13.2 12.8') < 0) F.push('sound off: the speaker is not struck through');
    q('sound').act();
    if (!did(A.calls, 'enable', true)) F.push('sound off, pressed: AUDIO.enable(true) not called');
  });
  run({ a: { enabled: false, state: 'off', q0: true }, search: '?audio=0' }, q => {
    const v = q('sound').view();
    if (!v.off || v.on || !/\?audio=0/.test(v.title)) F.push('?audio=0: the sound button is not greyed with its reason (' + v.title + ')');
  });
  run({ a: { enabled: false, state: 'off' }, store: { 'flydiy.audio': '0' } }, (q, A, M, pg) => {
    q('sound').act();
    if (pg.store['flydiy.audio'] !== '1') F.push('the stub, pressed: the sound is not switched on for the next load');
    if (!/next page load/.test(q('sound').view().title)) F.push('the stub switched on: the title does not say the next load');
  });
  // radio: the music on when none (musicGarage), else the next station
  run({ a: { mg: 0 }, m: { station: 'roots' } }, (q, A, M) => {
    if (q('radio').view().on) F.push('radio: on with music in the garage off');
    q('radio').act();
    if (!did(A.calls, 'set', 'musicGarage', 1)) F.push('radio pressed with music in the garage off: musicGarage not turned on');
    if (did(M.calls, 'stepStation', 1)) F.push('radio pressed with no music: it stepped instead of playing the station');
  });
  run({ a: { mg: 1 }, m: { station: 'jazz' } }, (q, A, M) => {
    const v = q('radio').view();
    if (!v.on || v.title.indexOf('L:jazz') < 0) F.push('radio playing: not on, or the title has no station (' + v.title + ')');
    q('radio').act();
    if (!did(M.calls, 'stepStation', 1)) F.push('radio playing, pressed: stepStation(1) not called');
    if (did(A.calls, 'enable', true)) F.push('radio playing, pressed: the sound switched again');
  });
  run({ a: { mg: 1, state: 'off' }, m: { station: 'jazz' } }, (q, A, M) => {
    q('radio').act();
    const e = idx(A.calls, 'enable');
    if (e < 0 || !A.calls[e][1]) F.push('radio pressed with the sound off: AUDIO.enable(true) not called');
    if (did(M.calls, 'stepStation', 1)) F.push('radio pressed with the sound off: it stepped instead of playing');
  });
  run({ a: { mg: 1 }, m: { station: 'off', last: 'blues' } }, (q, A, M) => {
    if (q('radio').view().title.indexOf('L:blues') < 0) F.push('radio off: the title does not name the station it would play');
    q('radio').act();
    if (!did(M.calls, 'setStation', 'blues')) F.push('radio off, pressed: the last station not played');
  });
  run({ a: { mg: 1 }, m: { station: 'jazz' } }, (q, A, M) => {
    if (typeof q('radio').alt !== 'function') { F.push('radio: no second action'); return; }
    q('radio').alt();
    if (!did(M.calls, 'setStation', 'off')) F.push('radio\'s second action: setStation(\'off\') not called');
  });
  // the bar's wiring: the second action bound, the repaint on AUDIO's events
  if (!/b\.oncontextmenu = e => \{ e\.preventDefault\(\); alt\(\); \};/.test(S.editor)) F.push('buildQuick: no right-click for the second action');
  if (!/setTimeout\(\(\) => \{ b\.dataset\.held = '1'; alt\(\); \}, QUICK_HOLD_MS\)/.test(S.editor)) F.push('buildQuick: no hold for the second action');
  const ev = /for \(const ev of \[([^\]]*)\]\) A\.onEvent\(ev, syncQuick\)/.exec(S.editor);
  if (!ev || ['settings', 'station'].some(k => ev[1].indexOf("'" + k + "'") < 0)) F.push('buildQuick: the bar does not repaint on AUDIO\'s settings and station events');
  // music.js says when the station moves
  if (!/function tell\(\) \{ const AU = G\.AUDIO; if \(AU && AU\.emit\) AU\.emit\('station', station\); \}/.test(S.music) || S.music.indexOf('    tell();   // G1712: the bar and the boombox repaint') < 0)
    F.push('music.js: setStation does not emit \'station\'');
  return F;
}

// ---- BB_HIT -----------------------------------------------------------------------------------------------------------
function checkHit(S) {
  const F = [], P = propRow(S);
  if (!P || !P.bb) return ['the boombox has no bb in PROP_REG'];
  const pg = bbPage(S, { A: fakeAudio({}, {}), M: fakeMusic(), reg: { props: { boombox: P } } }), B = pg.B;
  const root = new THREE.Group(), o = new THREE.Group();
  o.name = 'prop:boombox'; o.userData.prop = P; o.position.set(0.4, 0, -0.2); o.rotation.y = Math.PI + 0.45;
  root.add(o); root.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.05, 100);
  cam.position.set(0, 1.4, 2.8); cam.lookAt(0.4, 0.2, -0.2); cam.updateMatrixWorld(true);
  const c = new THREE.Vector3((P.bb[0] + P.bb[3]) / 2, (P.bb[1] + P.bb[4]) / 2, (P.bb[2] + P.bb[5]) / 2).applyMatrix4(o.matrixWorld);
  const rc = new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2().copy(c.clone().project(cam)), cam);
  const ray = rc.ray, d = c.distanceTo(cam.position), at = t => ray.at(t, new THREE.Vector3()).toArray();
  if (!(B.hitBox(o, ray) > 0)) F.push('the ray through the radio\'s centre misses its box');
  if (!B.pick(o, ray, { miss: true, section: null, name: '', layer: '' })) F.push('the radio is not picked with nothing of the aeroplane under the pointer');
  if (B.pick(o, ray, { section: 'nose', name: '', layer: 'cage', point: at(d * 0.5) })) F.push('an aeroplane part IN FRONT of the radio loses its click to it');
  if (!B.pick(o, ray, { section: null, name: 'edWheelL', layer: 'gear', point: at(d + 1) })) F.push('a part BEHIND the radio takes the click');
  if (B.pick(o, ray, null)) F.push('a non-question (no stand, off the render) is answered');
  if (B.pick(null, ray, { miss: true })) F.push('no radio in the room, still picked');
  root.visible = false;
  if (B.pick(o, ray, { miss: true })) F.push('a hidden kit (mobileShow off) is still picked');
  root.visible = true;
  // the box is the PROP's, turned with it: a vertical ray inside the world AABB but outside the oriented box misses
  const lo = new THREE.Vector3(P.bb[0], P.bb[1], P.bb[2]), hi = new THREE.Vector3(P.bb[3], P.bb[4], P.bb[5]);
  const aabb = new THREE.Box3().setFromPoints([0, 1, 2, 3, 4, 5, 6, 7].map(i => new THREE.Vector3(i & 1 ? hi.x : lo.x, i & 2 ? hi.y : lo.y, i & 4 ? hi.z : lo.z).applyMatrix4(o.matrixWorld)));
  const inv = o.matrixWorld.clone().invert();
  let probe = null;
  for (let i = 0; i < 400 && !probe; i++) {
    const x = aabb.min.x + (aabb.max.x - aabb.min.x) * ((i * 0.618) % 1), z = aabb.min.z + (aabb.max.z - aabb.min.z) * ((i * 0.414) % 1);
    const l = new THREE.Vector3(x, 0.2, z).applyMatrix4(inv);
    if (l.x < lo.x - 0.02 || l.x > hi.x + 0.02 || l.z < lo.z - 0.02 || l.z > hi.z + 0.02) probe = [x, z];
  }
  const down = (x, z) => new THREE.Ray(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
  if (!probe) F.push('the test found no corner of the AABB outside the turned box');
  else if (B.hitBox(o, down(probe[0], probe[1])) >= 0) F.push('the hit box is the world AABB, not the radio\'s own turned box');
  if (!(B.hitBox(o, down(c.x, c.z)) > 0)) F.push('a vertical ray onto the radio\'s top misses it');
  // the cue: the cursor and the floor's halo, on and off
  const canvas = { style: { cursor: '' } };
  const on = B.hover(o, ray, { miss: true }, canvas), halo = B._halo();
  if (!on || canvas.style.cursor !== 'pointer') F.push('hover over the radio: no pointer cursor');
  if (!halo || !halo.visible || halo.parent !== o) F.push('hover over the radio: no halo under it');
  B.hover(o, ray, { point: at(d * 0.5) }, canvas);
  if (canvas.style.cursor !== '' || (halo && halo.visible)) F.push('hover over a part in front of the radio: the radio\'s cue stays');
  // G1714: the kit placed - the radio's centre handed to the music
  {
    const got = [], M2 = Object.assign(fakeMusic(), { setSourcePos: (...a) => got.push(a) });
    const pg2 = bbPage(S, { A: fakeAudio({}, {}), M: M2, reg: { props: { boombox: P } } });
    pg2.B.placed(o); pg2.B.placed(null);
    const g = got[0] || [];
    if (got.length !== 2 || Math.hypot(g[0] - c.x, g[1] - c.y, g[2] - c.z) > 1e-6 || got[1][0] !== null) F.push('placed() does not hand the radio\'s centre to the music (' + JSON.stringify(got) + ')');
  }
  if (!/hangar\.placeMobile\(\{[^}]*\}\);\n\s*\/\/ G1714[^\n]*\n\s*if \(window\.BOOMBOX && hangar\.mobileProp\) window\.BOOMBOX\.placed\(hangar\.mobileProp\('boombox'\)\);/.test(S.app))
    F.push('app.js: the radio\'s place is not handed on after placeMobile');
  // the frame: nothing while closed (no lookup, no projection)
  let asked = 0;
  B.frame(cam, () => { asked++; return o; });
  if (asked) F.push('BOOMBOX.frame looks the radio up while its panel is closed');
  // hangar.js resolves 'prop:boombox' out of the MOBILE ring; propPlace names it so
  const mp = /function mobileProp\(key\) \{[\s\S]*?\n\}/.exec(S.hangar);
  if (!mp) F.push('hangar.js has no mobileProp');
  else {
    const look = vm.runInNewContext('(function (MOBILE) { ' + mp[0] + '; return mobileProp; })', {})({ children: [{ name: 'prop:jerrycan' }, o, { name: 'prop:toolbox' }] });
    if (look('boombox') !== o || look('ladder') !== null) F.push('mobileProp does not resolve \'prop:boombox\'');
  }
  if (!/mobileShow: mobileShow, mobileProp: mobileProp,/.test(S.hangar)) F.push('hangar.js does not publish mobileProp');
  const pp = S.props.slice(S.props.indexOf('function propPlace('), S.props.indexOf('function propPlace(') + 1600);
  if (pp.indexOf("g.name = 'prop:' + key;") < 0) F.push('propPlace no longer names its group prop:<key>');
  // app.js: the click before the switches and the editor, the hover through it, the frame once after the sound
  const up = S.app.indexOf("canvas.addEventListener('pointerup'"), wheel = S.app.indexOf("canvas.addEventListener('wheel'");
  const cl = S.app.indexOf('window.BOOMBOX.click(bbProp(), pickRay.ray, hit, canvas)', up), sw = S.app.indexOf('!edSwitchClick(hit)', up), ep = S.app.indexOf('window.EDITOR_PICK(hit, false)', up);
  if (!(up > 0 && cl > up && cl < sw && sw < ep && ep < wheel)) F.push('app.js: the click does not ask the radio before the switches and EDITOR_PICK');
  if (S.app.split('BOOMBOX.click(').length !== 2 || S.app.split('BOOMBOX.hover(').length !== 3) F.push('app.js: the radio asked somewhere other than the click, the hover and the leave');
  const hv = S.app.indexOf('window.BOOMBOX.hover(h ? bbProp() : null, pickRay.ray, h, canvas)');
  if (!(hv > up && hv < wheel) || !/window\.EDITOR_PICK\(onBox \? \{ miss: true/.test(S.app)) F.push('app.js: the hover does not clear the part under the radio');
  if (!/function bbProp\(\) \{ return \(inGarage && hangar && hangar\.mobileProp\) \? hangar\.mobileProp\('boombox'\) : null; \}/.test(S.app)) F.push('app.js: the radio is not the hangar\'s mobileProp(\'boombox\')');
  const au = S.app.indexOf('AUDIO.update(sim, camera, fdt'), fr = S.app.indexOf('BOOMBOX.frame(camera, bbProp)');
  if (S.app.split('BOOMBOX.frame(').length !== 2 || !(fr > au && fr - au < 260)) F.push('app.js: BOOMBOX.frame is not called once, right after AUDIO.update');
  // the build: the files in, before app.js
  const ib = S.build.indexOf("'boombox.js'"), im = S.build.indexOf("'audio/my_music.js'"), mu = S.build.indexOf("'audio/music.js'"), ap = S.build.indexOf("'app.js'", ib);
  if (!(ib > 0 && im > mu && ap > ib)) F.push('build.js: boombox.js / my_music.js are not listed after music.js and before app.js');
  return F;
}

// ---- BB_PANEL ---------------------------------------------------------------------------------------------------------
function checkPanel(S) {
  const F = [], P = propRow(S);
  const reg = { props: { boombox: P } };
  const mk = (o) => {
    const store = o.store || {};
    const A = fakeAudio(o.a, store), M = fakeMusic(o.m);
    const MY = o.my === false ? null : { calls: [], state: { via: '', name: '', pending: null, line: '', busy: false },
      canDir: () => true, restore() { MY.calls.push('restore'); return Promise.resolve(MY.state); },
      pick() { MY.calls.push('pick'); return Promise.resolve(0); }, reconnect() { return Promise.resolve(0); }, forget() { return Promise.resolve(true); } };
    const pg = bbPage(S, { A, M, MY, dom: true, reg, search: o.search, store });
    const doc = pg.document, canvas = doc.createElement('canvas'); canvas.width = 1200; canvas.height = 800;
    const root = new THREE.Group(), obj = new THREE.Group();
    obj.name = 'prop:boombox'; obj.userData.prop = P; root.add(obj); root.updateMatrixWorld(true);
    return { pg, A, M, MY, doc, canvas, obj, B: pg.B };
  };
  const q = (doc, sel) => doc.querySelectorAll(sel);
  const ev = (pg, type, init) => new pg.__D.Event(type, Object.assign({ bubbles: true }, init || {}));
  // the full panel
  {
    const { pg, A, M, MY, doc, canvas, obj, B } = mk({ a: { mg: 0 }, m: { station: 'roots' } });
    B.open(obj, canvas);
    const panel = doc.getElementById('bbPanel');
    if (!panel || panel.parentNode !== doc.getElementById('edView')) F.push('the panel is not in #edView');
    const text = panel ? panel.textContent : '';
    if (text.indexOf('Song Title') < 0 || text.indexOf('An Artist') < 0 || text.indexOf('CC0') < 0) F.push('the panel does not say what is playing (title, artist, licence)');
    const st = [...q(doc, '#bbPanel [data-st]')].map(b => b.dataset.st);
    const want = STATIONS.concat(['off']);
    if (want.some(k => st.indexOf(k) < 0) || st.indexOf('mine') >= 0) F.push('the station buttons are not the six, the mix and off (' + st.join(',') + ')');
    const stb = k => [...q(doc, '#bbPanel [data-st]')].find(b => b.dataset.st === k);
    if (stb('jazz')) stb('jazz').click();
    if (!did(M.calls, 'setStation', 'jazz') || !did(A.calls, 'set', 'musicGarage', 1)) F.push('a station button does not play it (setStation + music in the garage on)');
    if (stb('off')) stb('off').click();
    if (!did(M.calls, 'setStation', 'off')) F.push('the off button does not switch the radio off');
    const ranges = [...q(doc, '#bbPanel input[type=range]')];
    const rowOf = el => el.parentNode && el.parentNode.querySelector('.k') && el.parentNode.querySelector('.k').textContent;
    const rng = k => ranges.find(r => rowOf(r) === k);
    for (const [k, v] of [['music', 30], ['master', 55]]) {
      const r = rng(k);
      if (!r) { F.push('no ' + k + ' slider'); continue; }
      r.value = String(v); r.dispatchEvent(ev(pg, 'input'));
      if (!did(A.calls, 'set', k, v / 100)) F.push('the ' + k + ' slider does not set AUDIO ' + k);
    }
    const pills = () => [...q(doc, '#bbPanel button.pill')];
    const pillT = t => pills().find(b => b.textContent === t);
    if (pillT('skip track')) { pillT('skip track').disabled = false; pillT('skip track').click(); }
    if (!did(M.calls, 'skip')) F.push('skip does not skip');
    const boxes = [...q(doc, '#bbPanel input[type=checkbox]')], box = k => boxes.find(b => rowOf(b) === k);
    const flip = (k, fn) => { const b = box(k); if (!b) { F.push('no `' + k + '` toggle'); return; } b.checked = !b.checked; b.dispatchEvent(ev(pg, 'change')); fn(b.checked); };
    flip('Radio Jolene talk', on => { if (!did(M.calls, 'setTalk', on)) F.push('the talk toggle does not call setTalk'); });
    flip('music in the garage', on => { if (!did(A.calls, 'set', 'musicGarage', on ? 1 : 0)) F.push('the garage toggle does not set musicGarage'); });
    flip('music in flight', on => { if (!did(A.calls, 'set', 'musicFlight', on ? 1 : 0)) F.push('the flight toggle does not set musicFlight'); });
    const cr = doc.querySelector('#bbPanel .bbCredits');
    if (cr) cr.click();
    if (!did(M.calls, 'openCredits')) F.push('the credits link does not open the credits');
    const fp = pills().find(b => /choose a folder/.test(b.textContent));
    if (!fp) F.push('no folder button (my music)'); else fp.click();
    if (MY.calls.indexOf('pick') < 0) F.push('the folder button does not pick a folder');
    if (MY.calls.indexOf('restore') < 0) F.push('the panel does not bring a kept folder back when it opens');
    // it follows the radio, and leaves when the radio leaves the screen
    const cam = new THREE.PerspectiveCamera(50, 1.5, 0.05, 100);
    cam.position.set(0, 1.2, 2.5); cam.lookAt(0, 0.3, 0); cam.updateMatrixWorld(true);
    B.frame(cam, () => obj);
    if (!B.isOpen || !/^\d+px$/.test(panel.style.left) || !/^\d+px$/.test(panel.style.top)) F.push('the open panel is not placed by the radio (' + panel.style.left + ', ' + panel.style.top + ')');
    cam.lookAt(0, 0.3, 6); cam.updateMatrixWorld(true);
    B.frame(cam, () => obj);
    if (B.isOpen) F.push('the radio behind the camera: the panel stays open');
    B.open(obj, canvas); cam.lookAt(-6, 0.3, 0); cam.updateMatrixWorld(true);
    B.frame(cam, () => obj);
    if (B.isOpen) F.push('the radio off the side of the view: the panel stays open');
    cam.lookAt(0, 0.3, 0); cam.updateMatrixWorld(true);
    // Esc; a press outside (and not one inside); the shed left
    B.open(obj, canvas);
    doc.dispatchEvent(ev(pg, 'keydown', { key: 'Escape' }));
    if (B.isOpen || doc.getElementById('bbPanel')) F.push('Esc does not close the panel');
    B.open(obj, canvas);
    doc.querySelector('#bbPanel .bbBody').dispatchEvent(ev(pg, 'pointerdown'));
    if (!B.isOpen) F.push('a press inside the panel closes it');
    doc.body.dispatchEvent(ev(pg, 'pointerdown'));
    if (B.isOpen) F.push('a press outside does not close the panel');
    B.open(obj, canvas); B.close(); B.open(obj, canvas);
    B.frame(cam, () => null);
    if (B.isOpen) F.push('the shed left (no radio): the panel stays open');
    if (A.listeners('station') || A.listeners('music')) F.push('a closed panel still listens to AUDIO');
    // the click toggles: on the radio, open; again, shut
    const rc = new THREE.Raycaster(); cam.lookAt(0, 0.3, 0); cam.updateMatrixWorld(true);
    rc.setFromCamera(new THREE.Vector2().copy(new THREE.Vector3(0, 0.23, 0).project(cam)), cam);
    if (!B.click(obj, rc.ray, { miss: true }, canvas) || !B.isOpen) F.push('a click on the radio does not open the panel');
    B.click(obj, rc.ray, { miss: true }, canvas);
    if (B.isOpen) F.push('a second click on the radio does not close it');
  }
  // the folder there: its station among the buttons
  {
    const { doc, obj, canvas, B } = mk({ a: { mg: 1 }, m: { station: 'mine', mine: true } });
    B.open(obj, canvas);
    if (![...q(doc, '#bbPanel [data-st]')].some(b => b.dataset.st === 'mine')) F.push('a folder picked: no `my music` station button');
  }
  // ?audio=0: the line and a switch, nothing else
  {
    const { doc, obj, canvas, B, A } = mk({ a: { enabled: false, state: 'off', q0: true }, search: '?audio=0' });
    B.open(obj, canvas);
    const t = doc.getElementById('bbPanel').textContent;
    if (!/Sound is off for this page \(\?audio=0\)/.test(t)) F.push('?audio=0: the panel does not say the sound is off');
    if (q(doc, '#bbPanel input').length || q(doc, '#bbPanel [data-st]').length) F.push('?audio=0: the panel builds controls (' + q(doc, '#bbPanel input').length + ' inputs)');
    if (![...q(doc, '#bbPanel button.pill')].some(b => /sound on/.test(b.textContent))) F.push('?audio=0: no switch offered');
    if (A.listeners('settings')) F.push('?audio=0: the panel listens to the stub');
  }
  // the sound off in this page: the switch turns it on and the panel fills
  {
    const { doc, obj, canvas, B, A } = mk({ a: { state: 'off' } });
    B.open(obj, canvas);
    if (q(doc, '#bbPanel [data-st]').length) F.push('the sound off: the panel builds the stations');
    const sw = [...q(doc, '#bbPanel button.pill')].find(b => /sound on/.test(b.textContent));
    if (!sw) F.push('the sound off: no switch'); else sw.click();
    if (!did(A.calls, 'enable', true)) F.push('the panel\'s switch does not call AUDIO.enable(true)');
    if (!q(doc, '#bbPanel [data-st]').length) F.push('the sound switched on: the panel does not fill');
  }
  // the CSS: the card has its plate in editor.css
  if (!/#bbPanel \{ position:absolute;[^}]*background:var\(--ed-plate\)/.test(S.css)) F.push('editor.css: #bbPanel has no plate');
  return F;
}

// ---- BB_MINE ----------------------------------------------------------------------------------------------------------
const tick = () => new Promise(r => setImmediate(r));
function minePage(S, o) {
  o = o || {};
  const C = { ctx: 0, urls: 0, revoked: 0, live: new Set(), idbOpen: 0, picker: 0, inputs: [], perm: 0 };
  const store = o.store || { 'flydiy.audio.musicGarage': '1', 'flydiy.audio.station': 'lofi' };
  const idbData = o.idb || {};
  const listeners = {};
  const param = v => ({ value: v, setTargetAtTime(x) { this.value = x; }, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; },
    setValueCurveAtTime(c) { this.value = c[c.length - 1]; }, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  class AC {
    constructor() { C.ctx++; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; this.state = 'running'; }
    createGain() { return Object.assign(node(), { gain: param(1) }); }
    createDynamicsCompressor() { return Object.assign(node(), { threshold: param(0), knee: param(0), ratio: param(0), attack: param(0), release: param(0) }); }
    createMediaElementSource() { return node(); }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
  }
  if (o.panner) AC.prototype.createStereoPanner = function () {
    const p = param(0), st = p.setTargetAtTime;
    p.setTargetAtTime = function (x, t, tau) { C.panSched = (C.panSched || 0) + 1; return st.call(this, x, t, tau); };
    C.panNode = Object.assign(node(), { pan: p }); return C.panNode; };
  const els = [];
  const audioEl = () => {
    const h = {};
    const e = { tag: 'audio', preload: '', crossOrigin: '', currentTime: 0, duration: NaN, paused: true, _src: '',
      get src() { return e._src; }, set src(v) { e._src = String(v); e.currentTime = 0; e.duration = NaN; },
      play() { e.paused = false; return Promise.resolve(); }, pause() { e.paused = true; }, load() {},
      removeAttribute(k) { if (k === 'src') e._src = ''; }, setAttribute() {},
      addEventListener(t, f) { (h[t] = h[t] || []).push(f); }, removeEventListener() {}, fire(t) { for (const f of h[t] || []) f({ type: t }); } };
    els.push(e); return e;
  };
  const body = { children: [], appendChild(c) { body.children.push(c); c.parentNode = body; return c; } };
  const generic = t => {
    const e = { tag: t, style: {}, attrs: {}, children: [], textContent: '', setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute: k => e.attrs[k],
      appendChild(c) { e.children.push(c); return c; }, remove() { const i = body.children.indexOf(e); if (i >= 0) body.children.splice(i, 1); },
      click() { e.clicked = (e.clicked || 0) + 1; }, addEventListener() {} };
    if (t === 'input') C.inputs.push(e);
    return e;
  };
  const document = { hidden: false, hasFocus: () => true, body, createElement: t => (t === 'audio' ? audioEl() : generic(t)),
    createTextNode: t => ({ textContent: t }), getElementById: () => null, addEventListener() {}, removeEventListener() {} };
  // IndexedDB: one store, requests resolved on the next turn
  const indexedDB = { open() {
    C.idbOpen++;
    const req = { result: null };
    setImmediate(() => {
      req.result = { createObjectStore() {}, close() {}, transaction() {
        const tx = {};
        const os = { put(v, k) { idbData[k] = v; return { result: k }; }, get(k) { return { result: idbData[k] }; }, delete(k) { delete idbData[k]; return { result: undefined }; } };
        tx.objectStore = () => os;
        setImmediate(() => tx.oncomplete && tx.oncomplete());
        return tx;
      } };
      if (req.onupgradeneeded) req.onupgradeneeded();
      req.onsuccess && req.onsuccess();
    });
    return req;
  } };
  const URL = { createObjectURL(b) { C.urls++; const u = 'blob:flydiy/' + C.urls + '-' + (b && b.name); C.live.add(u); return u; },
    revokeObjectURL(u) { if (C.live.delete(u)) C.revoked++; } };
  const win = { location: { search: '' }, document, indexedDB, URL, URLSearchParams, crypto: { getRandomValues: a => { a[0] = 12345; return a; } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    performance: { now: () => 0 }, AudioContext: AC,
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, removeEventListener(t, f) { const a = listeners[t]; if (a && a.indexOf(f) >= 0) a.splice(a.indexOf(f), 1); },
    FLYDIY_MUSIC: [
      { id: 'l0', file: 'media/audio/music/l0.12345678.mp3', title: 'L0', artist: 'X', source: 'u', licence: 'CC0', station: 'lofi', contexts: ['garage', 'welcome'], durationS: 30, lufs: -16 },
      { id: 'l1', file: 'media/audio/music/l1.12345678.mp3', title: 'L1', artist: 'X', source: 'u', licence: 'CC0', station: 'lofi', contexts: ['garage'], durationS: 30, lufs: -16 }],
    POWERPLANTS: {} };
  if (o.dir !== false) win.showDirectoryPicker = async () => { C.picker++; return o.handle; };
  const ctx = Object.assign({ console: { warn() {}, log() {}, error() {}, info() {} }, setTimeout: () => 0, clearTimeout() {}, setImmediate, Promise, Date, Math }, win);
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const k of ['params', 'audio', 'music', 'mymusic']) vm.runInContext(S[k], ctx, { filename: FILES[k] });
  const A = ctx.AUDIO, M = ctx.AUDIO_MUSIC, MY = ctx.AUDIO_MYMUSIC;
  M.seed(3); M.setJoin(false);
  // the listener at (0, 1, 0), unturned: its right axis is +x (a world matrix, as THREE's camera carries)
  const camera = { position: { x: 0, y: 1, z: 0 }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1] } }, cam = { mode: 'chase' }, world = { surface: () => 0, terrainH: () => 0 };
  let garage = true;
  const P = {
    gesture() { for (const f of (listeners.pointerdown || []).slice()) f({ type: 'pointerdown' }); },
    step(dt, n) {
      for (let i = 0; i < (n || 1); i++) {
        if (A.ctx) A.ctx.currentTime += dt;
        for (const el of els) if (!el.paused && el._src) {
          el.currentTime += dt; el.fire('timeupdate');
          if (el.duration > 0 && el.currentTime >= el.duration) { el.paused = true; el.fire('ended'); }
        }
        A.update(null, camera, dt, null, cam, garage, world);
      }
    },
    run(sec) { P.step(0.1, Math.round(sec / 0.1)); },
    setGarage(on) { garage = !!on; },
    playing: () => els.filter(e => !e.paused && e._src),
  };
  return Object.assign(P, { A, M, MY, C, els, store, idbData, ctx, body });
}
const file = (name) => ({ kind: 'file', name, getFile: async () => ({ name, size: 1000 }) });
const dirH = (name, kids, perm, C) => ({ kind: 'directory', name,
  async *values() { for (const k of kids) yield k; },
  queryPermission: async () => perm || 'granted',
  requestPermission: async () => { if (C) C.perm++; return 'granted'; } });
async function checkMine(S) {
  const F = [];
  const kids = () => [file('01 - First Song.mp3'), file('cover.jpg'), dirH('Disc 2', [file('b_side.flac'), file('notes.txt')]), file('track3.m4a')];
  // a first visit: nothing before the gesture; the pick; the station
  {
    const h = dirH('Albums', kids());
    const pg = minePage(S, { handle: h });
    const { A, M, MY, C } = pg;
    await tick();
    if (C.ctx || C.idbOpen || C.picker || C.urls) F.push('before any gesture: ' + C.ctx + ' contexts, ' + C.idbOpen + ' IndexedDB opens, ' + C.picker + ' pickers, ' + C.urls + ' object URLs');
    pg.gesture(); pg.run(1);
    if (C.idbOpen || C.urls) F.push('the gesture alone opened IndexedDB or made an object URL');
    const n = await MY.pick(); await tick(); await tick();
    if (n !== 3 || M.mineCount !== 3) F.push('the folder kept ' + M.mineCount + ' tracks (want the 3 audio files of 5)');
    if (!M.hasMine || M.mineName !== 'Albums') F.push('the folder is not a station (' + M.mineName + ')');
    const titles = M.catalogue.filter(t => t.user).map(t => t.title);
    if (titles.indexOf('First Song') < 0 || titles.indexOf('b side') < 0) F.push('titles not from the file names: ' + titles.join(' | '));
    const kept = Object.keys(pg.idbData);
    if (kept.length !== 1 || pg.idbData.dir !== h) F.push('IndexedDB keeps ' + kept.join(',') + ' (want the DirectoryHandle alone)');
    if (M.STATION_KEYS.indexOf('mine') >= 0) F.push('the player\'s folder leaked into the stations\' keys');
    if (C.urls) F.push('object URLs made before the station plays (' + C.urls + ')');
    // on air
    if (!M.setStation('mine') || M.station !== 'mine') F.push('the `mine` station cannot be tuned');
    pg.run(5);   // (the lo-fi track's crossfade out)
    const on = pg.playing();
    if (on.length !== 1 || on[0]._src.indexOf('blob:') !== 0) F.push('`mine` does not play a blob: URL (' + on.map(e => e._src).join(',') + ')');
    // no length known: never cut for it
    const first = on[0];
    pg.run(12);
    if (!first || first.paused || pg.playing().length !== 1) F.push('a track of unknown length was cut or crossfaded');
    // its length arrives: it crossfades into the next, the old URL revoked once its deck lets go
    if (first) { first.duration = first.currentTime + 6; first.fire('durationchange'); }
    pg.run(14);
    if (C.urls < 2) F.push('the next track did not load (' + C.urls + ' URLs)');
    if (C.revoked < 1) F.push('the finished track\'s object URL was not revoked');
    if (C.live.size > 2) F.push(C.live.size + ' object URLs live at once (two decks)');
    if (pg.playing().some(e => e._src.indexOf('blob:') !== 0)) F.push('`mine` played a shipped track');
    // off the folder: its URL goes with the fade
    M.setStation('lofi'); pg.run(8);
    if (C.live.size) F.push(C.live.size + ' object URLs still live after leaving `mine`');
    if (C.urls !== C.revoked) F.push('made ' + C.urls + ' object URLs, revoked ' + C.revoked);
    // forget: the station and the handle gone
    M.setStation('mine'); pg.run(1);
    await MY.forget(); await tick(); await tick();
    if (M.hasMine || M.station === 'mine') F.push('forget leaves the station (' + M.station + ')');
    if (Object.keys(pg.idbData).length) F.push('forget leaves the handle in IndexedDB');
    if (C.live.size) F.push('forget leaves ' + C.live.size + ' object URLs live');
  }
  // the next visit: a granted handle is walked on restore; a 'prompt' one waits for reconnect's requestPermission
  for (const perm of ['granted', 'prompt']) {
    const idb = {}, Cx = { perm: 0 };
    idb.dir = dirH('Albums', kids(), perm, Cx);
    const pg = minePage(S, { idb, handle: null });
    const { M, MY, C } = pg;
    pg.gesture(); pg.run(0.5);
    await tick();
    if (C.idbOpen) F.push('the next visit opened IndexedDB before the panel asked');
    await MY.restore(); await tick(); await tick();
    if (perm === 'granted' && M.mineCount !== 3) F.push('a granted handle not walked on restore (' + M.mineCount + ')');
    if (perm === 'prompt') {
      if (M.hasMine || !MY.state.pending) F.push('a \'prompt\' handle walked without asking, or not kept pending');
      if (Cx.perm) F.push('requestPermission called outside the reconnect click');
      await MY.reconnect(); await tick();
      if (!Cx.perm || M.mineCount !== 3) F.push('reconnect does not ask and walk the folder');
    }
    if (C.picker) F.push('the next visit opened the picker');
  }
  // no directory picker: the <input webkitdirectory>, once
  {
    const pg = minePage(S, { dir: false });
    const { M, MY, C } = pg;
    pg.gesture();
    const p = MY.pick();
    const i = C.inputs[C.inputs.length - 1];
    if (!i || i.type !== 'file' || !i.multiple || !('webkitdirectory' in i.attrs) || !i.clicked) F.push('the fallback is not a clicked <input type=file webkitdirectory multiple>');
    else {
      i.files = [{ name: 'a.mp3', webkitRelativePath: 'Mix/a.mp3' }, { name: 'b.ogg', webkitRelativePath: 'Mix/b.ogg' }, { name: 'c.png', webkitRelativePath: 'Mix/c.png' }];
      i.onchange();
    }
    const n = await p;
    if (n !== 2 || M.mineName !== 'Mix' || MY.state.via !== 'input') F.push('the fallback kept ' + n + ' from ' + M.mineName + ' via ' + MY.state.via);
    if (C.idbOpen) F.push('the fallback stored something');
  }
  // a page that loaded on 'mine': the start station until the folder is back, then 'mine'
  {
    const pg = minePage(S, { handle: dirH('Albums', kids()), store: { 'flydiy.audio.musicGarage': '1', 'flydiy.audio.station': 'mine' } });
    const { M, MY } = pg;
    if (M.station === 'mine') F.push('a page loaded on `mine` with no folder claims it');
    pg.gesture(); pg.run(0.5);
    await MY.pick(); await tick();
    if (M.station !== 'mine') F.push('the folder back: the page does not return to `mine` (' + M.station + ')');
  }
  return F;
}

// ---- BB_PAN (G1714) ---------------------------------------------------------------------------------------------------
function checkPan(S) {
  const F = [];
  const pg = minePage(S, { handle: null, panner: true }), { M, C } = pg;
  pg.gesture(); pg.run(1);
  if (!C.panNode) return ['the music has no StereoPanner between the duck and the bus'];
  const at = (x, y, z, sec) => { M.setSourcePos(x, y, z); pg.run(sec || 0.6); return M.pan; };
  const r = at(2, 1, 0), l = at(-2, 1, 0), f = at(0, 1, -2), far = at(30, 1, 0);
  if (!(r > 0.25 && r <= M.PAN_K + 1e-9)) F.push('the radio 2 m to the right: the music leans ' + r.toFixed(3) + ' (want a little right, at most ' + M.PAN_K + ')');
  if (!(l < -0.25)) F.push('the radio 2 m to the left: the music leans ' + l.toFixed(3));
  if (Math.abs(f) > 0.02) F.push('the radio straight ahead: the music leans ' + f.toFixed(3));
  if (Math.abs(far) > 0.02) F.push('the radio 30 m off: the music still leans ' + far.toFixed(3));
  at(2, 1, 0);
  const n0 = C.panSched; pg.run(3);
  if (C.panSched !== n0) F.push('a steady garage schedules the pan (' + (C.panSched - n0) + ' times in 3 s)');
  pg.setGarage(false); pg.run(0.6);
  if (Math.abs(M.pan) > 1e-9) F.push('out of the garage the music still leans ' + M.pan.toFixed(3));
  pg.setGarage(true); M.setSourcePos(null); pg.run(0.6);
  if (Math.abs(M.pan) > 1e-9) F.push('no radio in the room, the music still leans');
  if (C.panSched > 12) F.push('the pan scheduled ' + C.panSched + ' times over the run (a few moves)');
  return F;
}

const CHECKS = { BB_QUICK: checkQuick, BB_HIT: checkHit, BB_PANEL: checkPanel, BB_MINE: checkMine, BB_PAN: checkPan };
const MUT = [
  ['sound pressed keeps its state', 'editor', 'if (B) B.radio.setSound(!on); else A.enable(!on);', 'if (B) B.radio.setSound(on); else A.enable(on);', 'BB_QUICK'],
  ['the sound icon not struck', 'editor', ": '<path d=\"' + QI.spk + '\"/><path d=\"M2.4 2.6l13.2 12.8\"/>' };", ": '<path d=\"' + QI.spk + '\"/>' };", 'BB_QUICK'],
  ['the radio leaves the garage music off', 'boombox', "        A.set('musicGarage', 1);\n", '', 'BB_QUICK'],
  ['the radio always steps', 'boombox', '      if (!radio.playing()) return radio.listen();\n', '', 'BB_QUICK'],
  ['the radio never sounds', 'boombox', '      if (!radio.soundOn()) radio.setSound(true);\n', '', 'BB_QUICK'],
  ['no second action', 'editor', "      alt: () => { const B = window.BOOMBOX; if (B) B.radio.off(); } },", '      },', 'BB_QUICK'],
  ['the radio back on to lo-fi', 'boombox', "else if (M.station === 'off') M.setStation(M.lastStation || 'roots');", "else if (M.station === 'off') M.setStation('lofi');", 'BB_QUICK'],
  ['no station event', 'music', '    tell();   // G1712: the bar and the boombox repaint\n', '', 'BB_QUICK'],
  ['the radio steals the aeroplane\'s click', 'boombox', '    return d < pd;', '    return true;', 'BB_HIT'],
  ['a hidden kit clicked', 'boombox', 'if (!S || !o || !ray || !o.matrixWorld || !shown(o)) return -1;', 'if (!S || !o || !ray || !o.matrixWorld) return -1;', 'BB_HIT'],
  ['the world AABB', 'boombox', '    S.inv.copy(o.matrixWorld).invert();\n    S.ray.copy(ray).applyMatrix4(S.inv);\n    if (!S.ray.intersectBox(localBox(o, S.box), S.p)) return -1;',
    '    S.inv.copy(o.matrixWorld).invert();\n    S.ray.copy(ray);\n    if (!S.ray.intersectBox(localBox(o, S.box).applyMatrix4(o.matrixWorld), S.p)) return -1;\n    S.p.applyMatrix4(S.inv);', 'BB_HIT'],
  ['no cursor', 'boombox', "cueCanvas.style.cursor = on ? 'pointer' : '';", "cueCanvas.style.cursor = '';", 'BB_HIT'],
  ['the frame works while closed', 'boombox', '  function frame(camera, getObj) {\n    if (!panel) return;\n', '  function frame(camera, getObj) {\n', 'BB_HIT'],
  ['the click after the editor', 'app', "      if (window.BOOMBOX && hit && window.BOOMBOX.click(bbProp(), pickRay.ray, hit, canvas)) { /* the radio's panel */ }\n      else if (typeof window.EDITOR_PICK === 'function' && !edSwitchClick(hit)) window.EDITOR_PICK(hit, false);",
    "      if (typeof window.EDITOR_PICK === 'function' && !edSwitchClick(hit)) window.EDITOR_PICK(hit, false);\n      else if (window.BOOMBOX && hit && window.BOOMBOX.click(bbProp(), pickRay.ray, hit, canvas)) { /* the radio's panel */ }", 'BB_HIT'],
  ['the frame call gone', 'app', '    if (window.BOOMBOX) BOOMBOX.frame(camera, bbProp);', '', 'BB_HIT'],
  ['mobileProp by the wrong name', 'hangar', "if (o.name === 'prop:' + key) return o;", 'if (o.name === key) return o;', 'BB_HIT'],
  ['the music slider sets the master', 'boombox', "v => A.set('music', v));", "v => A.set('master', v));", 'BB_PANEL'],
  ['a station button without the garage music', 'boombox', "() => (k === 'off' ? radio.off() : radio.listen(k))", "() => (k === 'off' ? radio.off() : MU().setStation(k))", 'BB_PANEL'],
  ['no Esc', 'boombox', "function onKey(e) { if (e && e.key === 'Escape')", 'function onKey(e) { if (false)', 'BB_PANEL'],
  ['a press outside ignored', 'boombox', "      Dc.addEventListener('pointerdown', onDown, true);\n", '', 'BB_PANEL'],
  ['the panel kept off screen', 'boombox', '    if (!(S.q.z < 1) || ax < 0 || ay < 0 || ax > vw || ay > vh) { close(); return; }', '', 'BB_PANEL'],
  ['?audio=0 builds the radio', 'boombox', '    if (!A || !M || !radio.soundOn()) {\n      const off0', '    if (!A || !M) {\n      const off0', 'BB_PANEL'],
  ['no folder restore', 'boombox', '    if (my && my.restore && radio.soundOn()) my.restore().then(', '    if (false) my.restore().then(', 'BB_PANEL'],
  ['the flight toggle sets the garage', 'boombox', "on => A.set('musicFlight', on ? 1 : 0));", "on => A.set('musicGarage', on ? 1 : 0));", 'BB_PANEL'],
  ['the URL never revoked', 'music', '    try { G.URL.revokeObjectURL(d.blobUrl); } catch (e) {}\n', '', 'BB_MINE'],
  ['every file kept', 'music', 'const MINE_RE = /\\.(mp3|ogg|oga|opus|m4a|aac|wav|flac)$/i;', 'const MINE_RE = /./;', 'BB_MINE'],
  ['an unknown length is zero', 'music', 'DK[o + K_DUR] = cat[t].durationS || USER_DUR_S;', 'DK[o + K_DUR] = cat[t].durationS;', 'BB_MINE'],
  ['the handle not kept', 'mymusic', '      if (n) await keep(h);\n', '', 'BB_MINE'],
  ['IndexedDB at load', 'mymusic', '  return { pick, pickInput, restore,', '  restore();\n  return { pick, pickInput, restore,', 'BB_MINE'],
  ['permission asked on restore', 'mymusic', "    if (p === 'granted') await fromHandle(h);", "    if (p === 'granted' || await h.requestPermission({ mode: 'read' })) await fromHandle(h);", 'BB_MINE'],
  ['the folder never comes back', 'music', '    } else if (wantMine && list.length) setStation(ST_MINE);', '    }', 'BB_MINE'],
  ['no lean', 'music', '    if (panner) { PS[S_PANT] -= dt;', '    if (false) { PS[S_PANT] -= dt;', 'BB_PAN'],
  ['the lean the wrong way', 'music', 'x = PAN_K * near * (m[0] * dx', 'x = -PAN_K * near * (m[0] * dx', 'BB_PAN'],
  ['the lean in flight', 'music', 'if (SRC[3] > 0 && au.inGarage && m) {', 'if (SRC[3] > 0 && m) {', 'BB_PAN'],
  ['the far radio pulls', 'music', 'const near = Math.max(0, Math.min(1, (PAN_FAR - d) / (PAN_FAR - PAN_NEAR)));', 'const near = 1;', 'BB_PAN'],
  ['the lean schedules every tick', 'music', '    if (Math.abs(x - SRC[4]) < PAN_STEP && !(x === 0 && SRC[4] !== 0)) return;\n', '', 'BB_PAN'],
  ['the radio\'s place unsaid', 'app', "      if (window.BOOMBOX && hangar.mobileProp) window.BOOMBOX.placed(hangar.mobileProp('boombox'));\n", '', 'BB_HIT'],
  ['the release keeps the URL', 'music', '    unblob(k);   // G1712: the player\'s file\'s object URL goes with it\n', '', 'BB_MINE'],
];

let fails = 0;
const say = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; };
async function runCheck(k, S) {
  try { return await CHECKS[k](S); }
  catch (e) { return ['threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)]; }
}
(async () => {
  const ONLY_SELFTEST = process.argv.includes('--selftest');
  const base = {};
  const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);   // (a debugging aid: never a PASS)
  for (const k in CHECKS) base[k] = ONLY.length && ONLY.indexOf(k) < 0 ? null : await runCheck(k, SRC0);
  if (ONLY.length) { for (const k of ONLY) { say(!base[k].length, k); for (const f of base[k]) console.log('         ' + f); } console.log('GATE BOOMBOX: PARTIAL (--only)'); return; }
  if (!ONLY_SELFTEST) for (const k in base) {
    say(!base[k].length, k + (base[k].length ? ': ' + base[k].length + ' failure(s)' : ''));
    for (const f of base[k]) console.log('         ' + f);
  }
  let caught = 0;
  for (const [name, file, find, repl, check] of MUT) {
    if (base[check].length) { say(false, 'SELF-TEST "' + name + '": ' + check + ' is red on the pristine sources'); continue; }
    const n = SRC0[file].split(find).length - 1;
    if (n !== 1) { say(false, 'SELF-TEST "' + name + '": the anchor is found ' + n + ' times in ' + FILES[file] + ' (want 1)'); continue; }
    const S = Object.assign({}, SRC0);
    S[file] = SRC0[file].replace(find, () => repl);
    if (process.env.BB_MUT && process.env.BB_MUT.split('|').indexOf(name) < 0) { caught++; continue; }   // (a debugging aid: one mutation)
    const t0 = Date.now();
    const red = await runCheck(check, S);
    if (process.env.BB_TRACE) console.log('  .. ' + name + ' ' + (Date.now() - t0) + ' ms');
    if (red.length) caught++;
    if (ONLY_SELFTEST || !red.length) say(red.length > 0, 'SELF-TEST "' + name + '" turns ' + check + ' red' + (red.length ? ': ' + red[0] : ' - MISSED'));
  }
  say(shaOf(readAll()) === SHA0, 'SELF-TEST the sources are byte-identical after ' + MUT.length + ' mutations');
  say(caught === MUT.length, 'SELF-TEST ' + caught + ' / ' + MUT.length + ' mutations caught');
  console.log('GATE BOOMBOX: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exitCode = fails ? 1 : 0;
})();
