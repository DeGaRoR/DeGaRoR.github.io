// back_guard.js - THE BROWSER'S BACK NEVER DROPS THE PLAYER OUT OF THE GAME SILENTLY (G3880-G3884, GAME-MENUS; the user,
// 27 Oct: "we need a confirmation box when doing 'back' in the browser, on computer like on mobile")
//
// - THE HISTORY GUARD. Once the game is up (app.js's FLIGHT_PROBE exists) and at the player's FIRST input (a pointer
//   down, a key, a touch), one sentinel entry is pushed on top of the page's own ({ flydiyBackGuard: 1 }, the same URL).
//   At the first input and never at boot: Chrome's history intervention skips, on Back, an entry a page added before
//   the player ever touched it - a boot-time push would let Back leave the page without a word. Every back the browser
//   offers (the desktop button, Alt+Left, a mouse's back button, Android's back button / gesture, iOS's edge swipe)
//   pops the sentinel: a popstate on the page's own entry. The guard pushes the sentinel again at once (so Back once
//   more lands here too) and shows the box.
// - THE BOX (#bgBox): "Leave flyDiy?" - Stay (the default: focused, Esc, Back again) / Leave. At the TOP edge, never a
//   centre card; the garage's --ed-* tokens, IBM Plex Sans upright (no serif, no italics); draggable - by
//   window.FLYDIY_DRAG (card_drag.js, the cards rule) when the page has it, else by its title line; phone sized under
//   html.phone (profile.js). While it is open every key stops here (the flight never sees one).
// - THE SIM HOLDS while it is open: the player's own Pause (#bPause, app.js: running / userPaused / FLYDIY_HELD) is
//   pressed when the flight runs and pressed again on Stay - never when the player had paused, never in the garage
//   (the button is hidden there: nothing runs).
// - LEAVE releases everything and goes back past the sentinel and the page's entry (history.go(-2)); a game that was
//   the tab's first page (history.length 2: its entry and the sentinel) has nothing to go back to, so after 600 ms still
//   here it replaces itself with the page it came from (document.referrer) or the site's root.
// - TAB CLOSE / RELOAD on a desktop: a beforeunload asks the browser's own prompt (the browser words it), with the game
//   up and the guard armed - but not within 3 s of an in-page click or Enter / Space: the page's own reloads (the
//   graphics menu, the world pills, the update pill, storage's reset) come from a click in the page and pass. F5,
//   Ctrl/Cmd+R, Ctrl/Cmd+W are never an in-page intent.
// - NEVER ON A RIG: welcome.js's WELCOME.RIG (a driven or headless browser: every gate, bench and stills rig - the
//   same answer gfx_settings.js takes; navigator.webdriver when welcome.js is absent), ?nogate, ?backguard=0, or a page
//   inside a frame -> window.BACK_GUARD = { on: false, why } and not one listener. ?backguard=1 forces it on a rig that
//   wants to test it.
//
// window.BACK_GUARD = { on, why, armed(), isOpen(), open(), stay(), leave(), release() } - release() is for a page's
// own navigation that is not a click (none today). GATE BACKGUARD (tools/_backguard_check.js) drives all of it in a vm
// with a stub window, history and DOM, and the negative: a rig gets no guard.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  if (!W || !W.document || !W.history) return;
  const D = W.document;
  const q = (W.location && W.location.search) || '';
  const flag = (k, v) => new RegExp('[?&]' + k + (v === undefined ? '(=1)?(&|$)' : '=' + v + '(&|$)')).test(q);
  const RIG = W.WELCOME && typeof W.WELCOME.RIG === 'boolean' ? W.WELCOME.RIG : !!(W.navigator && W.navigator.webdriver);
  let top = true; try { top = W.top === W || !W.top; } catch (e) { top = false; }
  const why = flag('backguard', 0) ? 'off by ?backguard=0' : flag('nogate') ? 'off by ?nogate'
    : !top ? 'off in a frame' : RIG && !flag('backguard', 1) ? 'off on a rig' : 'on';
  if (why !== 'on') { W.BACK_GUARD = { on: false, why }; return; }

  const now = () => (W.performance && W.performance.now ? W.performance.now() : Date.now());
  const isSent = s => !!(s && typeof s === 'object' && s.flydiyBackGuard === 1);
  const gameUp = () => !!W.FLIGHT_PROBE;
  let armed = false, released = false, shown = false, heldByUs = false, lastIntent = -1e9, gone = false, fallT = 0;
  let box = null, bStay = null;

  const push = () => { try { W.history.pushState({ flydiyBackGuard: 1 }, ''); } catch (e) {} };
  const pauseBtn = () => D.getElementById('bPause');
  const flying = b => !!(b && !b.hidden);
  const hold = () => { const b = pauseBtn(); if (flying(b) && !b.classList.contains('on')) { b.click(); heldByUs = true; } };
  const resume = () => { const b = pauseBtn(); if (heldByUs && flying(b) && b.classList.contains('on')) b.click(); heldByUs = false; };

  const CSS = '#bgBox{--ed-plate:rgba(32,29,26,.94);--ed-ink:#f4efe6;--ed-dim:#c0b8ac;--ed-acc:#e6dbc9;--ed-acc-ink:#221f1b;'
    + '--ed-border:rgba(255,248,236,.14);--ed-btn-bg:rgba(255,255,255,.06);--ed-btn-bd:rgba(255,255,255,.18);'
    + 'position:fixed;z-index:100000;top:calc(env(safe-area-inset-top, 0px) + 12px);left:50%;transform:translateX(-50%);'
    + 'width:min(420px, calc(100vw - 32px));box-sizing:border-box;padding:14px 16px;background:var(--ed-plate);color:var(--ed-ink);'
    + 'border:1px solid var(--ed-border);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45);'
    + "font:14px/1.4 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;font-style:normal;user-select:none}"
    + '#bgBox[hidden]{display:none}'
    + '#bgBox .bgHead{font-weight:600;font-size:15px;margin-bottom:6px;cursor:grab;touch-action:none}'
    + '#bgBox .bgBody{color:var(--ed-dim);margin-bottom:12px}'
    + '#bgBox .bgActs{display:flex;gap:10px;justify-content:flex-end}'
    + '#bgBox button{font:inherit;min-height:40px;min-width:96px;padding:0 16px;border-radius:8px;cursor:pointer;'
    + 'border:1px solid var(--ed-btn-bd);background:var(--ed-btn-bg);color:var(--ed-ink)}'
    + '#bgBox button.bgStay{background:var(--ed-acc);color:var(--ed-acc-ink);border-color:var(--ed-acc)}'
    + 'html.phone #bgBox{padding:16px}html.phone #bgBox button{min-height:48px;flex:1}';

  // the title line drags the box when card_drag.js is not on the page (the cards rule: no card covers anything for good)
  function ownDrag(el, h) {
    let p = null;
    h.addEventListener('pointerdown', e => {
      const r = el.getBoundingClientRect();
      p = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { h.setPointerCapture(e.pointerId); } catch (x) {}
    });
    h.addEventListener('pointermove', e => {
      if (!p || e.pointerId !== p.id) return;
      el.style.transform = 'none'; el.style.left = (e.clientX - p.dx) + 'px'; el.style.top = (e.clientY - p.dy) + 'px';
    });
    const end = () => { p = null; };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  }
  function make() {
    const st = D.createElement('style'); st.id = 'bgCss'; st.textContent = CSS; (D.head || D.body).appendChild(st);
    box = D.createElement('div'); box.id = 'bgBox'; box.hidden = true;
    box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-labelledby', 'bgHead');
    const h = D.createElement('div'); h.className = 'bgHead'; h.id = 'bgHead'; h.textContent = 'Leave flyDiy?';
    const t = D.createElement('div'); t.className = 'bgBody'; t.textContent = 'Going back closes the game. Anything not saved is lost.';
    const a = D.createElement('div'); a.className = 'bgActs';
    const bl = D.createElement('button'); bl.className = 'bgLeave'; bl.type = 'button'; bl.textContent = 'Leave';
    bStay = D.createElement('button'); bStay.className = 'bgStay'; bStay.type = 'button'; bStay.textContent = 'Stay';
    bl.addEventListener('click', () => G.leave()); bStay.addEventListener('click', () => G.stay());
    a.appendChild(bl); a.appendChild(bStay); box.appendChild(h); box.appendChild(t); box.appendChild(a); D.body.appendChild(box);
    if (W.FLYDIY_DRAG && typeof W.FLYDIY_DRAG.card === 'function') { try { W.FLYDIY_DRAG.card(box, 'backGuard', { handle: '.bgHead' }); } catch (e) { ownDrag(box, h); } }
    else ownDrag(box, h);
  }

  const G = W.BACK_GUARD = {
    on: true, why,
    armed: () => armed && !released,
    isOpen: () => shown,
    open() {
      if (shown) return;
      if (!box) make();
      shown = true; box.hidden = false; hold();
      try { bStay.focus(); } catch (e) {}
    },
    stay() {
      if (!shown) return;
      shown = false; box.hidden = true; resume();
    },
    leave() {
      G.release(); if (box) box.hidden = true; shown = false; heldByUs = false;
      // the tab's first page (its entry + the sentinel: nothing before) has nowhere to go back to; any other page's Back
      // may take longer than 600 ms to load the page before, so the fallback is for the first page alone
      const first = (W.history.length || 0) <= 2;
      try { W.history.go(-2); } catch (e) {}
      if (first) fallT = W.setTimeout(() => { if (!gone) { try { W.location.replace(D.referrer || '/'); } catch (e) {} } }, 600);
    },
    release() { released = true; },
  };

  const intentKey = e => !(e.key === 'F5' || ((e.ctrlKey || e.metaKey) && /^[rw]$/i.test(e.key || '')));
  const arm = () => {
    if (armed || released || !gameUp()) return;
    armed = true;
    if (!isSent(W.history.state)) push();   // a reload keeps the page on its sentinel: nothing to add
  };
  W.addEventListener('pointerdown', arm, true);
  W.addEventListener('touchend', arm, true);
  W.addEventListener('pointerup', () => { lastIntent = now(); }, true);
  W.addEventListener('click', () => { lastIntent = now(); }, true);
  W.addEventListener('keydown', e => {
    if (shown) {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { e.preventDefault(); G.stay(); }
      return;
    }
    arm();
    if ((e.key === 'Enter' || e.key === ' ') && intentKey(e)) lastIntent = now();
    else if (!intentKey(e)) lastIntent = -1e9;
  }, true);
  W.addEventListener('popstate', e => {
    if (!armed || released) return;
    if (isSent(e.state)) return;   // forward onto the sentinel: nothing to ask
    push();                        // Back once more lands here again
    if (shown) G.stay(); else G.open();
  });
  W.addEventListener('beforeunload', e => {
    if (!armed || released || !gameUp() || now() - lastIntent < 3000) return;
    e.preventDefault(); e.returnValue = '';
  });
  W.addEventListener('pagehide', () => { gone = true; if (fallT) W.clearTimeout(fallT); });
  // back from the bfcache (a Leave that went, then Forward): the guard re-arms at the next input
  W.addEventListener('pageshow', e => { if (e && e.persisted) { gone = false; released = false; armed = false; } });
})();
