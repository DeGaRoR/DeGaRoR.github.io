// hangar_switch.js - THE HANGAR SWITCH (HANGAR-SWITCH, the user 22 Nov: "There should be a way to swap between the three hangars
// of the game, at least in sandbox mode ... a new separate control, and we shouldn't have the ability to configure the garage from
// the tree of parts"; on the mock: "on the left side, a little burger menu, a little hangar menu, a little hangar icon, and make
// sure that it looks different from a home icon ... and a little plane icon").
//
// WHAT: a small icon on the garage's top-left plate, between the burger (#edMenu) and the plane (#fbName): a hangar's outline
// (a wide arched roof over a big door - never a house's pitched roof and small door). It opens a compact list (#edHangarList),
// one line a hangar the player holds (the sandbox: all three, built and restored - 71_player_bases.js playerSandboxHangars): a
// simple drawn outline of its building, its name, the aeroplane in it, a tick on the one you are in; a locked one (a career's,
// the story's) says why. A line pressed = FLYDIY_PLAYER.gotoGarage(id) - the game's one move between hangars (the map's Go uses
// it): each hangar keeps its own aeroplane (an empty one opens with the stand empty and the chooser).
// ONE POPUP AT A TIME (the user 22 Nov: "when you open the menu, you should close the menu of the loading planes and vice
// versa"): opening this closes the burger's menu and the plane's shelf; each of those closes this (HANGAR_SWITCH.close).
// THE TIME (the official performance table, row 5: "Change garage (teleport from one to the other) < 5 s, no UI freeze"): every
// switch is timed, the click to the new room drawn (two frames after gotoGarage resolves) and the longest frame between -
// HANGAR_SWITCH.last(), and the in-game Benchmark's row (perf_bench.js) reads it.
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.createElement) return;
  const W = window, $ = id => document.getElementById(id);
  const S = { btn: null, list: null, busy: false, last: null, hist: [] };
  // the buildings' outlines (26 x 16, stroke = the text colour): the Shed's small gable, the club's long low roof, the large
  // hangar's arch - drawn, not pictures (the user: "the simple drawn outline is completely fine")
  const SHAPE = {
    field: '<path d="M5 15V7l8-4.5L21 7v8"/><path d="M3 15h20"/><path d="M9 15V9.5h8V15"/>',
    club: '<path d="M2.5 15V7.5L13 3l10.5 4.5V15"/><path d="M1 15h24"/><path d="M6 15V8.8h14V15"/>',
    works: '<path d="M1.5 15V9C1.5 5 6.6 2.5 13 2.5S24.5 5 24.5 9V15"/><path d="M0.5 15h25"/><path d="M4.5 15V8.6h17V15"/>',
  };
  const outline = shell => '<svg viewBox="0 0 26 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">' +
    (SHAPE[shell] || SHAPE.club) + '</svg>';
  const mk = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const shellOf = id => { try { const d = W.FLYDIY_PLAYER.doc(); return (d.sheds[id] && d.sheds[id].shell) || 'club'; } catch (e) { return 'club'; } };
  // the hangar's own words: "the club hangar at Home" -> "The club hangar" (the aerodrome only when the list holds two places)
  const nameOf = (g, places) => { let n = String(g.name || g.id); if (places < 2) n = n.replace(/ at .*$/, ''); return n.charAt(0).toUpperCase() + n.slice(1); };

  function close() {
    if (!S.list) return;
    S.list.hidden = true;
    if (S.btn) { S.btn.classList.remove('open'); S.btn.setAttribute('aria-expanded', 'false'); }
  }
  function others() {   // ONE POPUP AT A TIME: the burger's menu and the plane's shelf
    try { if (W.FLYDIY_MENU && W.FLYDIY_MENU.isOpen && W.FLYDIY_MENU.isOpen()) W.FLYDIY_MENU.close(); } catch (e) {}
    try { if (W.GARAGE_SHELF && W.GARAGE_SHELF.close) W.GARAGE_SHELF.close(); } catch (e) {}
  }
  function fill() {
    const L = S.list; L.textContent = '';
    let G = [];
    try { G = (W.FLYDIY_PLAYER && W.FLYDIY_PLAYER.garages) ? W.FLYDIY_PLAYER.garages() : []; } catch (e) { G = []; }
    const places = new Set(G.map(g => g.aero)).size;
    for (const g of G) {
      const row = mk('button', 'hsRow' + (g.here ? ' here' : '') + (g.locked ? ' locked' : ''));
      row.type = 'button'; row.setAttribute('role', 'menuitem'); row.dataset.hangar = g.id;
      row.innerHTML = outline(shellOf(g.id));
      const t = mk('span', 'hsName', nameOf(g, places));
      t.appendChild(mk('span', 'hsSub', g.locked ? (g.why || 'not yours yet') : (g.stand || (g.planes && g.planes[0]) || 'empty')));
      row.appendChild(t);
      row.appendChild(mk('span', 'hsTick', g.here ? '✓' : ''));
      if (g.locked) row.disabled = true;
      row.onclick = e => { if (e && e.stopPropagation) e.stopPropagation(); go(g.id); };
      L.appendChild(row);
    }
    if (!G.length) L.appendChild(mk('span', 'hsNote', 'no hangar to go to'));
  }
  function open() {
    if (!S.list) return;
    others(); fill();
    S.list.hidden = false;
    S.btn.classList.add('open'); S.btn.setAttribute('aria-expanded', 'true');
  }
  // THE MOVE, timed: click -> gotoGarage resolved -> two frames drawn (the new room on screen); the longest frame between
  function go(id) {
    close();
    if (S.busy || !W.FLYDIY_PLAYER || !W.FLYDIY_PLAYER.gotoGarage) return Promise.resolve(null);
    S.busy = true;
    const t0 = performance.now(); let prev = t0, worst = 0, run = true;
    const tick = () => { const n = performance.now(); worst = Math.max(worst, n - prev); prev = n; if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const frame = () => new Promise(r => requestAnimationFrame(() => r()));
    // THE ROOM FIRST (app.js GARAGE_ROOMS): a room not built yet is built detached and its programs warmed while this one
    // stays on screen; the move then only unparks it
    let prep = null;
    const R = W.GARAGE_ROOMS && W.GARAGE_ROOMS.prepare ? Promise.resolve(W.GARAGE_ROOMS.prepare(id)).catch(() => null) : Promise.resolve(null);
    return R.then(p => { prep = p; return W.FLYDIY_PLAYER.gotoGarage(id); }).then(r => frame().then(frame).then(() => {
      run = false; S.busy = false;
      const rec = { id, ok: !!(r && r.ok), why: (r && r.why) || '', ms: Math.round(performance.now() - t0), worstFrameMs: Math.round(worst), at: Date.now(),
                    prepare: prep, room: W.GARAGE_ROOMS && W.GARAGE_ROOMS.last ? W.GARAGE_ROOMS.last() : null };
      S.last = rec; S.hist.push(rec); if (S.hist.length > 20) S.hist.shift();
      sync();
      return rec;
    }), e => { run = false; S.busy = false; console.warn('flyDiy: the hangar switch -', e && e.message); return null; });
  }
  function sync() {   // the button's title names where you are
    if (!S.btn) return;
    let here = '';
    try { const g = W.FLYDIY_PLAYER.garages().find(x => x.here); here = g ? nameOf(g, 1) : ''; } catch (e) {}
    S.btn.title = here ? 'Hangar: ' + here : 'Hangar';
  }
  function mount() {
    const fleet = $('edFleet'), plane = $('fbName');
    if (!fleet || !plane || $('edHangar')) return !!$('edHangar');
    const b = mk('button'); b.id = 'edHangar'; b.type = 'button'; b.title = 'Hangar';
    b.setAttribute('aria-label', 'the hangar: go to another of your hangars'); b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
    fleet.insertBefore(b, plane);
    const L = mk('div'); L.id = 'edHangarList'; L.setAttribute('role', 'menu'); L.hidden = true;
    fleet.appendChild(L);
    S.btn = b; S.list = L;
    b.addEventListener('click', e => { if (e.stopPropagation) e.stopPropagation(); if (L.hidden) open(); else close(); });
    document.addEventListener('click', e => { if (!L.hidden && e.target !== b && !L.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    sync();
    return true;
  }
  W.HANGAR_SWITCH = { open, close, go, mount, isOpen: () => !!(S.list && !S.list.hidden), last: () => S.last, history: () => S.hist.slice() };
  if (!mount()) {
    const t = setInterval(() => { if (mount()) clearInterval(t); }, 500);
    setTimeout(() => clearInterval(t), 60000);
  }
})();
