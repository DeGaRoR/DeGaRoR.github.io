// ============================================================
// THE BOOMBOX (G1710-G1713, SND-BOOMBOX; the user 2026-10-05: "you'll place the boombox close to the plane, and make it
// clickable. It will spawn a little menu like the plane elements and will present the radio controls, volume and
// channels, and if possible and easy, the ability to point to a local music folder"): window.BOOMBOX.
//
//   THE RADIO  BOOMBOX.radio - the few things the shed's two radio surfaces do (the quick bar's `sound` and `radio`
//             buttons, editor.js QUICK; this panel), over AUDIO and AUDIO_MUSIC and nothing else: sound on, the music
//             in the garage on (OFF by default since 2026-10-04 - asking for music is what turns it on), a station, the
//             next one, the radio off. Neither surface keeps a state of its own: each reads AUDIO / AUDIO_MUSIC back.
//   THE HIT   app.js casts its ray on POINTER EVENTS only (the click; the hover at its own HOVER_MS throttle) and asks
//             pick(obj, ray, hit): the boombox's MOBILE prop (hangar.js mobileProp('boombox'), the group propPlace names
//             'prop:boombox') is struck when the ray meets its own box (PROP_REG's bb, in the prop's frame: an oriented
//             box, no triangles) NEARER than the aeroplane's hit - an aeroplane part in front of the radio keeps its
//             click. Nothing here runs per frame for the hit.
//   THE CUE   on hover: the pointer cursor and a faint warm pool of light on the floor under the radio (a child of its
//             group, one shared quad; the prop's own materials are shared per record by MATLIB and are never touched).
//   THE PANEL a small floating card in #edView (the rail's flyout's plate, editor.css #bbPanel), anchored beside the
//             radio's top: now playing, the stations (the six, the mix, the player's own folder once there, off), the
//             music and master volumes, skip, Radio Jolene's talk, music in the garage / in flight, MY MUSIC (folder
//             pick, reconnect, forget; my_music.js), the credits. It follows the radio while open - frame() runs a
//             projection and two style writes only then, and returns at once when closed - and closes on Esc, on a
//             press outside it, when the radio leaves the screen, or when the shed does.
//   ?audio=0  (and the sound switched off at load): AUDIO is the stub - the panel says the sound is off and offers the
//             switch (which, under the stub, starts the sound on the next load), and builds nothing else.
// ============================================================
var BOOMBOX = (function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const KEY = 'boombox';
  const AU = () => G.AUDIO || null, MU = () => G.AUDIO_MUSIC || null, MY = () => G.AUDIO_MYMUSIC || null;
  const query0 = () => { try { return new URLSearchParams(G.location ? G.location.search : '').get('audio') === '0'; } catch (e) { return false; } };
  const pref = k => { try { return G.localStorage ? G.localStorage.getItem(k) : null; } catch (e) { return null; } };
  const prefSet = (k, v) => { try { if (G.localStorage) G.localStorage.setItem(k, String(v)); } catch (e) {} };

  // ---- THE RADIO -------------------------------------------------------------------------------------------------------
  const radio = {
    // the sound is running (or armed: waiting for its gesture) - not off, not the stub
    soundOn() { const A = AU(); return !!(A && A.enabled && A.state !== 'off'); },
    // the stub, switched on for the next load (the pref says '1' while this page stays silent)
    soundNext() { const A = AU(); return !!(A && !A.enabled && !query0() && pref('flydiy.audio') !== '0'); },
    // the music in the shed: the sound on, music in the garage on, a station
    playing() { const A = AU(), M = MU(); return radio.soundOn() && !!A.get('musicGarage') && !!M && M.station !== 'off'; },
    station() { const M = MU(); return M ? M.station : 'off'; },
    label(s) { const M = MU(); s = s == null ? radio.station() : s; return M && M.labelOf ? M.labelOf(s) : s; },
    setSound(on) {
      const A = AU();
      if (!A) return false;
      A.enable(!!on);   // (the click is the gesture: the context is made inside it)
      if (!A.enabled && !on && !query0()) prefSet('flydiy.audio', '0');   // (the stub's enable only ever writes 'on')
      return radio.soundOn() || radio.soundNext();
    },
    // music, now: sound on, the garage's music on, the station (or the last one, after 'off')
    listen(st) {
      const A = AU(), M = MU();
      if (!A || !M) return false;
      if (!radio.soundOn()) radio.setSound(true);
      if (!A.get('musicGarage')) {
        A.set('musicGarage', 1);
        // the stub's set() writes nothing: the player asked for music, so the next load has it
        if (!A.enabled) prefSet('flydiy.audio.musicGarage', 1);
      }
      if (st) M.setStation(st);
      else if (M.station === 'off') M.setStation(M.lastStation || 'roots');
      return true;
    },
    // the quick bar's press: music if there was none, else the next station
    next() {
      const M = MU();
      if (!M) return false;
      if (!radio.playing()) return radio.listen();
      return M.stepStation(1);
    },
    off() { const M = MU(); return M ? M.setStation('off') : false; },
  };

  // ---- THE HIT (pointer events only) -----------------------------------------------------------------------------------
  let T = null, V = null;   // THREE's scratch, made on first use (no THREE at this file's evaluation in a headless rig)
  function scratch() {
    const THREE = G.THREE;
    if (T || !THREE || !THREE.Ray) return T;
    T = { inv: new THREE.Matrix4(), ray: new THREE.Ray(), box: new THREE.Box3(), p: new THREE.Vector3(), q: new THREE.Vector3() };
    return T;
  }
  // the prop's box in its own frame: PROP_REG's bb (the bake's), else its dims standing on the floor
  function localBox(o, box) {
    const R = G.PROP_REG || (typeof PROP_REG !== 'undefined' ? PROP_REG : null);
    const P = (o && o.userData && o.userData.prop) || (R && R.props && R.props[KEY]) || null;
    const b = P && P.bb, d = P && P.dim;
    if (b && b.length === 6) { box.min.set(b[0], b[1], b[2]); box.max.set(b[3], b[4], b[5]); return box; }
    const w = d ? d[0] : 0.72, h = d ? d[1] : 0.47, z = d ? d[2] : 0.19;
    box.min.set(-w / 2, 0, -z / 2); box.max.set(w / 2, h, z / 2);
    return box;
  }
  const shown = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
  // the distance along the WORLD ray to the boombox's box, or -1
  function hitBox(o, ray) {
    const S = scratch();
    if (!S || !o || !ray || !o.matrixWorld || !shown(o)) return -1;
    S.inv.copy(o.matrixWorld).invert();
    S.ray.copy(ray).applyMatrix4(S.inv);
    if (!S.ray.intersectBox(localBox(o, S.box), S.p)) return -1;
    S.p.applyMatrix4(o.matrixWorld);
    return S.p.distanceTo(ray.origin);
  }
  // app.js's question: does this click (or hover) belong to the radio? hit: pickAt's answer for the aeroplane (null =
  // not a question: the pointer off the render, no stand); the aeroplane's struck point wins when it is nearer
  function pick(o, ray, hit) {
    if (!hit || !o) return false;
    const d = hitBox(o, ray);
    if (d < 0) return false;
    const pd = hit.point && ray && ray.origin ? Math.hypot(hit.point[0] - ray.origin.x, hit.point[1] - ray.origin.y, hit.point[2] - ray.origin.z) : Infinity;
    return d < pd;
  }

  // ---- THE CUE ---------------------------------------------------------------------------------------------------------
  let halo = null, hovered = false, cueCanvas = null;
  function makeHalo() {
    const THREE = G.THREE;
    if (halo || !THREE || !THREE.Mesh || !THREE.DataTexture) return halo;
    // a soft elliptical pool: a radial falloff in a 32 x 32 alpha map, additive, never written to depth
    const N = 32, px = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1, r = Math.min(1, Math.hypot(u, v));
      const a = Math.round(255 * Math.pow(1 - r, 1.6)), i = (y * N + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = a;
    }
    const tex = new THREE.DataTexture(px, N, N, THREE.RGBAFormat);
    tex.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, map: tex, transparent: true, opacity: 0.42, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false });
    halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    halo.name = 'boomboxHalo';
    halo.rotation.x = -Math.PI / 2;
    halo.renderOrder = 2;
    halo.userData.edHi = true;   // (never a thing to click ON)
    halo.visible = false;
    return halo;
  }
  function cue(o, on) {
    if (on && o) {
      const h = makeHalo(), S = scratch();
      if (h && S) {
        if (h.parent !== o) { if (h.parent) h.parent.remove(h); o.add(h); }
        const b = localBox(o, S.box);
        h.scale.set((b.max.x - b.min.x) * 1.9, (b.max.z - b.min.z) * 3.6, 1);
        h.position.set((b.min.x + b.max.x) / 2, b.min.y + 0.004, (b.min.z + b.max.z) / 2);
        h.visible = true;
      }
    } else if (halo) halo.visible = false;
  }
  // the hover: app.js's pointermove (throttled there); returns true while the pointer is on the radio (the aeroplane's
  // own hover is then cleared, not shown under it)
  function hover(o, ray, hit, canvas) {
    const on = !!(o && pick(o, ray, hit));
    if (canvas) cueCanvas = canvas;
    if (on !== hovered) {
      hovered = on;
      if (cueCanvas && cueCanvas.style) cueCanvas.style.cursor = on ? 'pointer' : '';
      cue(o, on || isOpen());
    }
    return on;
  }

  // ---- THE PANEL -------------------------------------------------------------------------------------------------------
  let panel = null, body = null, obj = null, offs = [], vw = 0, vh = 0, vx = 0, vy = 0, cx = 0, cy = 0, cw = 0, ch = 0;
  let pw = 0, ph = 0, lastL = -1e9, lastT = -1e9, canvasEl = null;
  const refs = {};   // the live bits a refresh repaints (no rebuild under a dragged slider)
  const isOpen = () => !!panel;
  const D = () => G.document || null;
  function el(tag, cls, txt) {
    const e = D().createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function row(host, label) {
    const r = el('div', 'r'), k = el('span', 'k', label);
    r.appendChild(k); host.appendChild(r); return r;
  }
  function note(host, txt, cls) { const n = el('div', 'note' + (cls ? ' ' + cls : ''), txt); host.appendChild(n); return n; }
  function pill(host, txt, fn, title) {
    const b = el('button', 'pill', txt);
    b.type = 'button';
    if (title) b.title = title;
    b.onclick = e => { if (e && e.stopPropagation) e.stopPropagation(); fn(); refresh(); };
    host.appendChild(b); return b;
  }
  function toggle(host, label, get, set) {
    const r = row(host, label), c = el('input');
    c.type = 'checkbox'; c.checked = !!get();
    c.onchange = () => { set(c.checked); refresh(); };
    r.appendChild(c); r.classList.add('tog');
    return c;
  }
  function range(host, label, get, set) {
    const r = row(host, label), i = el('input'), v = el('span', 'v');
    i.type = 'range'; i.min = 0; i.max = 100; i.step = 1; i.value = Math.round(get() * 100);
    v.textContent = i.value + ' %';
    i.oninput = () => { set(+i.value / 100); v.textContent = i.value + ' %'; };
    r.appendChild(i); r.appendChild(v);
    return { i, v, get };
  }

  // build the body for the state the sound is in, then paint it; a build never asks for another (no recursion: refresh
  // decides whether one is due, paint only writes)
  function build() {
    building = true;
    try { buildBody(); } finally { building = false; }
    if (panel && !refs.offLine) paint();
  }
  function buildBody() {
    for (const k in refs) delete refs[k];
    while (body.firstChild) body.removeChild(body.firstChild);
    const A = AU(), M = MU();
    // THE SOUND OFF (the stub, or switched off in this page): one line and the switch, nothing else
    if (!A || !M || !radio.soundOn()) {
      const off0 = query0();
      refs.offLine = note(body, !A ? 'This build has no sound.'
        : off0 ? 'Sound is off for this page (?audio=0).'
        : radio.soundNext() ? 'Sound is on from the next page load.'
        : 'Sound is off.', 'first');
      if (A) {
        const w = el('div', 'bbBtns');
        const b = pill(w, 'turn the sound on', () => { radio.setSound(true); build(); measure(); }, 'Switch the game’s sound on');
        // (greyed where it cannot act in this page: the address says ?audio=0, or it is already on for the next load)
        if (off0 || radio.soundNext()) { b.disabled = true; b.title = off0 ? 'The page’s address turns the sound off (?audio=0): load it without' : 'On from the next page load'; }
        body.appendChild(w);
      }
      return;
    }
    // now playing
    refs.now = el('div', 'bbNow'); body.appendChild(refs.now);
    // the stations
    const w = el('div', 'bbSt');
    refs.st = [];
    const keys = M.STATION_KEYS.concat(M.hasMine ? [M.ST_MINE] : []).concat(['off']);
    for (const k of keys) {
      const b = pill(w, k === 'off' ? 'off' : radio.label(k).replace(/ \(.*\)$/, ''), () => (k === 'off' ? radio.off() : radio.listen(k)),
        k === 'off' ? 'The radio off' : 'Play ' + radio.label(k));
      b.dataset.st = k;
      refs.st.push(b);
    }
    body.appendChild(w);
    refs.music = range(body, 'music', () => A.get('music'), v => A.set('music', v));
    refs.master = range(body, 'master', () => A.get('master'), v => A.set('master', v));
    const ctl = el('div', 'bbBtns');
    refs.skip = pill(ctl, 'skip track', () => M.skip(), 'The next track now');
    body.appendChild(ctl);
    refs.talk = toggle(body, 'Radio Jolene talk', () => M.talk, on => M.setTalk(on));
    refs.garage = toggle(body, 'music in the garage', () => !!A.get('musicGarage'), on => A.set('musicGarage', on ? 1 : 0));
    refs.flight = toggle(body, 'music in flight', () => !!A.get('musicFlight'), on => A.set('musicFlight', on ? 1 : 0));
    // MY MUSIC
    const my = MY();
    if (my) {
      const sec = el('div', 'bbSec'); body.appendChild(sec);
      sec.appendChild(el('div', 'bbHead', 'my music'));
      refs.myLine = el('div', 'bbLine'); sec.appendChild(refs.myLine);
      refs.myBtns = el('div', 'bbBtns'); sec.appendChild(refs.myBtns);
    }
    const foot = el('div', 'bbBtns bbFoot');
    const cr = el('a', 'bbCredits', 'music credits');
    cr.href = '#';
    cr.onclick = e => { if (e && e.preventDefault) e.preventDefault(); M.openCredits(); };
    foot.appendChild(cr);
    body.appendChild(foot);
  }
  // the folder's buttons: rebuilt (they are few and never under a drag)
  function myButtons() {
    const my = MY(), M = MU(), s = my && my.state, w = refs.myBtns;
    if (!w || !s) return;
    while (w.firstChild) w.removeChild(w.firstChild);
    const busy = () => { refs.myLine.textContent = 'Reading the folder…'; };
    const after = () => { if (panel) { build(); measure(); } };
    if (s.pending && !s.via) {
      pill(w, 'reconnect ' + (s.name || 'the folder'), () => { busy(); my.reconnect().then(after); }, 'The browser asks once per visit');
      pill(w, 'choose another', () => { busy(); my.pick().then(after); });
    } else {
      pill(w, M && M.hasMine ? 'choose another folder' : 'choose a folder…', () => { busy(); my.pick().then(after); },
        'Play the music files of a folder on this computer - nothing is uploaded');
    }
    if (M && M.hasMine || s.pending) pill(w, 'forget', () => { my.forget().then(after); }, 'Drop the folder and its station');
  }
  function myText() {
    const my = MY(), M = MU(), s = my && my.state;
    if (!s || !refs.myLine) return;
    let t;
    if (s.busy) t = 'Reading the folder…';
    else if (M.hasMine) t = M.mineCount + ' track' + (M.mineCount === 1 ? '' : 's') + ' from ' + (M.mineName || 'your folder') +
      ' · played here, never uploaded' + (s.via === 'input' ? ' · this browser forgets the folder: choose it again next visit' : '');
    else if (s.pending) t = s.name + ' — the browser asks again each visit';
    else t = s.line || ('Your own files, played on this computer only' + (my.canDir() ? '.' : ' - this browser asks for the folder again each visit.'));
    refs.myLine.textContent = t;
  }
  // something changed under the panel (a track starts, a station, a setting from elsewhere): a rebuild when the panel's
  // shape is no longer the state's (the sound switched, the folder came or went), else a repaint
  let building = false;   // (an event the build itself caused waits for it)
  function refresh() {
    if (!panel || building) return;
    const A = AU(), M = MU(), off = !A || !M || !radio.soundOn();
    if (off !== !!refs.offLine || (!off && !!M.hasMine !== !!(refs.st || []).some(b => b.dataset.st === M.ST_MINE))) { build(); measure(); return; }
    if (!off) paint();
  }
  // the repaint: text, the lit station, the values - never a rebuild
  function paint() {
    const A = AU(), M = MU();
    if (!panel || !A || !M) return;
    const np = M.nowPlaying && M.nowPlaying();
    if (refs.now) {
      while (refs.now.firstChild) refs.now.removeChild(refs.now.firstChild);
      if (np) {
        refs.now.appendChild(el('div', 'bbTitle', np.title));
        refs.now.appendChild(el('div', 'bbArtist', np.artist + ' · ' + np.licence));
      } else {
        refs.now.appendChild(el('div', 'bbArtist', !A.get('musicGarage') ? 'Music in the garage is off - pick a station.'
          : M.station === 'off' ? 'The radio is off.' : A.state === 'armed' ? 'Waiting for a click (the browser asks for one).' : 'Tuning…'));
      }
    }
    const playing = radio.playing();
    for (const b of refs.st || []) b.classList.toggle('on', b.dataset.st === M.station && (playing || M.station === 'off'));
    for (const r of [refs.music, refs.master]) if (r && D().activeElement !== r.i) { r.i.value = Math.round(r.get() * 100); r.v.textContent = r.i.value + ' %'; }
    if (refs.talk) refs.talk.checked = !!M.talk;
    if (refs.garage) refs.garage.checked = !!A.get('musicGarage');
    if (refs.flight) refs.flight.checked = !!A.get('musicFlight');
    if (refs.skip) refs.skip.disabled = !playing;
    myText(); myButtons();
  }

  function measure() {
    if (!panel) return;
    const view = panel.parentNode;
    const vb = view && view.getBoundingClientRect ? view.getBoundingClientRect() : { left: 0, top: 0, width: G.innerWidth || 0, height: G.innerHeight || 0 };
    vx = vb.left; vy = vb.top; vw = vb.width; vh = vb.height;
    const cb = canvasEl && canvasEl.getBoundingClientRect ? canvasEl.getBoundingClientRect() : { left: 0, top: 0, width: G.innerWidth || 0, height: G.innerHeight || 0 };
    cx = cb.left; cy = cb.top; cw = cb.width; ch = cb.height;
    pw = panel.offsetWidth || 260; ph = panel.offsetHeight || 300;
    lastL = lastT = -1e9;
  }
  function onKey(e) { if (e && e.key === 'Escape') { if (e.stopPropagation) e.stopPropagation(); if (e.preventDefault) e.preventDefault(); close(); } }
  function onDown(e) {
    const t = e && e.target;
    if (panel && t && panel.contains && panel.contains(t)) return;
    if (t && t.closest && t.closest('#musicCredits')) return;   // the credits screen opened from here
    // a press ON the radio leaves it to the click that follows (which toggles the panel shut)
    if (t && t === canvasEl && hovered) return;
    close();
  }
  // open beside the radio o; canvas: the render's (the anchor's pixels)
  function open(o, canvas) {
    const Dc = D();
    if (!Dc || !Dc.createElement) return false;
    obj = o; canvasEl = canvas || canvasEl;
    if (!panel) {
      panel = el('div'); panel.id = 'bbPanel';
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'The radio');
      const head = el('div', 'bbH');
      head.appendChild(el('span', '', 'radio'));
      const x = el('button', 'bbX', '×'); x.type = 'button'; x.title = 'Close (Esc)'; x.onclick = () => close();
      head.appendChild(x);
      panel.appendChild(head);
      body = el('div', 'bbBody'); panel.appendChild(body);
      const host = Dc.getElementById && Dc.getElementById('edView');
      (host && !host.hidden ? host : Dc.body).appendChild(panel);
      Dc.addEventListener('keydown', onKey, true);
      Dc.addEventListener('pointerdown', onDown, true);
      if (G.addEventListener) G.addEventListener('resize', measure);
      const A = AU();
      if (A && A.onEvent && A.enabled) offs = ['music', 'station', 'settings', 'ready'].map(t => A.onEvent(t, () => refresh()));
    }
    build();
    measure();
    cue(o, true);
    // a kept folder comes back on this click (walked only if its permission still holds; else 'reconnect' waits) - once
    // per opening, never from a rebuild
    const my = MY();
    if (my && my.restore && radio.soundOn()) my.restore().then(() => { if (panel) refresh(); }, () => {});
    return true;
  }
  function close() {
    if (!panel) return;
    const Dc = D();
    Dc.removeEventListener('keydown', onKey, true);
    Dc.removeEventListener('pointerdown', onDown, true);
    if (G.removeEventListener) G.removeEventListener('resize', measure);
    for (const f of offs) { try { f(); } catch (e) {} }
    offs = [];
    if (panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null; body = null;
    for (const k in refs) delete refs[k];
    if (!hovered) cue(null, false);
  }
  // app.js's click: true when the radio took it (the panel toggles)
  function click(o, ray, hit, canvas) {
    if (!pick(o, ray, hit)) return false;
    if (panel && obj === o) close(); else open(o, canvas);
    return true;
  }
  // the frame: NOTHING while closed. Open: the radio's top projected, the card moved when it moved a pixel; closed when
  // the radio is gone (the shed left, the kit hidden) or off the screen. getObj: app.js's lookup, asked only now.
  function frame(camera, getObj) {
    if (!panel) return;
    const o = typeof getObj === 'function' ? getObj() : getObj;
    const S = scratch();
    if (!o || !S || !camera || !shown(o)) { close(); return; }
    if (o !== obj) { obj = o; cue(o, true); }
    const b = localBox(o, S.box);
    S.q.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).applyMatrix4(o.matrixWorld).project(camera);
    const ax = cx + (S.q.x + 1) / 2 * cw - vx, ay = cy + (1 - S.q.y) / 2 * ch - vy;
    if (!(S.q.z < 1) || ax < 0 || ay < 0 || ax > vw || ay > vh) { close(); return; }   // behind the eye, or off the view
    let L = ax + 26;
    if (L + pw > vw - 12) L = ax - 26 - pw;
    L = Math.max(12, Math.min(vw - pw - 12, L));
    const Tp = Math.max(12, Math.min(vh - ph - 12, ay - ph * 0.35));
    if (Math.abs(L - lastL) >= 1) { lastL = L; panel.style.left = Math.round(L) + 'px'; }
    if (Math.abs(Tp - lastT) >= 1) { lastT = Tp; panel.style.top = Math.round(Tp) + 'px'; }
  }

  return { radio, pick, hitBox, hover, click, open, close, frame, refresh, get isOpen() { return isOpen(); },
    get hovered() { return hovered; }, KEY, _localBox: localBox, _halo: () => halo };
})();
if (typeof window !== 'undefined') window.BOOMBOX = BOOMBOX;
if (typeof module !== 'undefined' && module.exports) module.exports = BOOMBOX;
