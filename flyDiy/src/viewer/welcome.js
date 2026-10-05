// welcome.js - THE WELCOME SCREEN AND THE DEVICE GATE (Friendly Welcome, G1210-G1219)
//
// Evaluated in the BOOT slot right after boot.js, BEFORE the vendor and before the island's ~35 MB: the page's
// island loader (build.js ISLAND_LOADER) chains window.FLYDIY_WELCOME into FLYDIY_BOOT, so nothing heavy is fetched
// or run until the player has pressed Play. The contract is futureDesigns/FRIENDLY-WELCOME-BUDGETS.md §3 layer 1:
//
// - TWO DETECTED AXES, THE LOWER WINS. The GPU class from the card's name (a throwaway WebGL2 context's
//   WEBGL_debug_renderer_info, the GPU table below) and the memory class (the mobile flag, navigator.deviceMemory);
//   the suggested preset is the lower of the two.
// - ONCE PER GRAPHICS CARD. The choice is remembered under the card's name (localStorage flydiy.welcome); a new card
//   asks again, the graphics menu's "re-check my computer" row asks again in place. ?gfx=<preset> skips it (the preset
//   is already chosen), and so does a choice already saved in the menu (flydiy.gfx): THE PLAYER'S CHOICE ALWAYS WINS.
// - THE DEVICE GATE. A phone or a tablet (userAgentData.mobile, or a coarse pointer on a small screen) and a browser
//   without WebGL2 get a polite page instead: what was detected, flyDiy is for a computer for now, and a "try anyway
//   (experimental)" link that continues on potato.
// - THE LOST CONTEXT. A canvas of the game that loses its WebGL context (the GTX 660 drew 0 frames on gamer) gets a
//   clear message offering potato, never a blank screen.
// - THE RIGS NEVER SEE ANY OF IT (gfx_settings.js's RIG: navigator.webdriver or HeadlessChrome; ?welcome=1 /
//   ?devgate=1 force a screen for a rig that wants to look at one).
//
// The pick reaches the graphics menu as WELCOME.pick: gfx_settings.js takes it the way it takes ?gfx= (the preset's
// options, saved), so a later choice in the menu still wins. GATE GFX tests the pure half (gpuClass, memClass, mobile,
// decide) in a vm with stubbed navigators.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  if (!W) return;
  const KEY = 'flydiy.welcome';
  const ORDER = ['potato', 'retro', 'current', 'gamer', 'ultra'];   // GATE GFX holds it to Object.keys(GFX.PRESETS)
  const LABEL = { potato: 'potato', retro: '5 years ago', current: 'current', gamer: 'gamer', ultra: 'ultra' };
  const WHY = {
    potato: 'an integrated or older card, a laptop: the lightest picture',
    retro: 'a card that was good five years ago (GTX 1060 class)',
    current: 'a current mid-range card (RTX 3060 class)',
    gamer: 'a strong card (RTX 3080 class): the reference',
    ultra: 'the dearest picture, for screenshots and the cards above a 3080',
  };
  const rank = p => ORDER.indexOf(p);
  const lower = (a, b) => (rank(a) <= rank(b) ? a : b);
  const search = () => (W.location && W.location.search) || '';
  // THE RIGS (gfx_settings.js G528, the same test): a headless or driven browser measures a fixed frame and sees no screen
  const isRig = nav => !!(nav && (nav.webdriver || /HeadlessChrome/.test(nav.userAgent || '')));
  const force = (k, q) => new RegExp('[?&]' + k + '=1').test(q);

  // ---- THE GPU TABLE: the card's name -> its class --------------------------------------------------------------
  // The browser's name for a card is ANGLE's on Windows ("ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002206)
  // Direct3D11 vs_5_0 ps_5_0, D3D11)"), the driver's elsewhere. cleanGpu() keeps the model, which is both what the
  // screen shows and the key the choice is remembered under (a driver update must not ask again).
  const cleanGpu = s => {
    s = String(s || '').trim();
    const m = /^ANGLE \((.*)\)$/.exec(s);
    if (m) { const parts = m[1].split(', '); s = parts.length >= 2 ? parts[1] : parts[0]; }
    return s.replace(/\s*\(0x[0-9a-f]+\)/ig, '').replace(/\s+(Direct3D|D3D1|OpenGL|Vulkan|Metal)\S*.*$/i, '').replace(/\s+/g, ' ').trim();
  };
  // -> { cls, why }. Ordered: the software renderers and the integrated parts first, then the families by number;
  // a name the table does not know is 'current' (the middle: never the dearest on a guess, never the poorest)
  // G1460 (SOFT-GPU): a software renderer - no graphics card in use (SwiftShader: every cloud session's headless Chromium;
  // llvmpipe / softpipe: Mesa's; Microsoft's Basic Render Driver). The game's 'software' rung keys on this answer
  // (gfx_settings.js SOFT); on any other name it is false and nothing of the rung exists
  const isSoftware = raw => /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(String(raw || ''));
  const gpuClass = raw => {
    const s = cleanGpu(raw);
    let m;
    if (!s) return { cls: 'current', why: 'the card did not say its name' };
    if (isSoftware(s)) return { cls: 'potato', why: 'a software renderer (no graphics card in use)' };
    if (/Mali|Adreno|PowerVR|Apple A\d|Videocore/i.test(s)) return { cls: 'potato', why: 'a phone or tablet graphics part' };
    if (/Intel/i.test(s) && /\b(HD|UHD|Iris)\b/i.test(s)) return { cls: 'potato', why: 'Intel integrated graphics' };
    if (/Radeon\(TM\) Graphics|Radeon Graphics|Radeon Vega \d+ Graphics|Vega \d+ Graphics/i.test(s)) return { cls: 'potato', why: 'AMD integrated graphics' };
    if ((m = /RTX\s*(\d{2})(\d{2})/i.exec(s))) {
      const series = +m[1], tier = +m[2];
      if (series === 20) return { cls: 'current', why: 'an RTX 20 series card' };
      if (series >= 30) return tier >= 70 ? { cls: 'gamer', why: 'an RTX ' + series + '70 or stronger' } : { cls: 'current', why: 'an RTX ' + series + 'xx below a ' + series + '70' };
    }
    if ((m = /GTX\s*(\d{3,4})/i.exec(s))) {
      const n = +m[1];
      if (n >= 600 && n < 1000) return { cls: 'potato', why: 'a GTX 600-900 series card' };
      if (n >= 1000 && n < 1100) return { cls: 'retro', why: 'a GTX 10 series card' };
      if (n >= 1600 && n < 1700) return { cls: 'retro', why: 'a GTX 16 series card' };
    }
    if (/GeForce\s+(GT|MX)\s*\d{3}/i.test(s) || /\bGT\s*\d{3}\b/.test(s)) return { cls: 'potato', why: 'an entry-level GeForce' };
    if ((m = /RX\s*(\d{3,4})/i.exec(s))) {
      const n = +m[1];
      if (n >= 400 && n < 600) return { cls: 'retro', why: 'a Radeon RX 400 / 500' };
      if (n >= 5000 && n < 6000) return { cls: 'current', why: 'a Radeon RX 5000' };
      if (n >= 6000 && n < 7000) return n >= 6800 ? { cls: 'gamer', why: 'a Radeon RX 6800 or stronger' } : { cls: 'current', why: 'a Radeon RX 6000 below a 6800' };
      if (n >= 7000 && n < 8000) return n >= 7800 ? { cls: 'gamer', why: 'a Radeon RX 7800 or stronger' } : { cls: 'current', why: 'a Radeon RX 7000 below a 7800' };
      if (n >= 9000 && n < 10000) return n >= 9070 ? { cls: 'gamer', why: 'a Radeon RX 9070 or stronger' } : { cls: 'current', why: 'a Radeon RX 9000' };
    }
    if (/RX\s*Vega/i.test(s)) return { cls: 'retro', why: 'a Radeon RX Vega' };
    if (/\bR[79]\s*\d{3}/i.test(s)) return { cls: 'potato', why: 'a Radeon R7 / R9' };
    return { cls: 'current', why: 'a card the table does not know' };
  };

  // ---- THE MEMORY CLASS: the cap the device's memory puts on the preset ------------------------------------------
  // env { mobile, mem } -> { cls, why }. deviceMemory is rounded and capped at 8 by the browsers; absent (Firefox,
  // Safari) it says nothing, and a desktop is not capped on nothing
  const memClass = env => {
    if (env.mobile) return { cls: 'potato', why: 'a phone or tablet: a few hundred MB a tab' };
    if (env.mem > 0 && env.mem <= 4) return { cls: 'potato', why: env.mem + ' GB of memory or less' };
    return { cls: 'gamer', why: env.mem > 0 ? (env.mem >= 8 ? '8 GB of memory or more' : env.mem + ' GB of memory') : 'the browser does not say its memory' };
  };

  // ---- THE PHONE / TABLET TEST --------------------------------------------------------------------------------
  // env { uaMobile (userAgentData.mobile, or undefined), ua, coarse (primary pointer coarse), fine (any fine pointer),
  // minSide (the screen's shorter side, CSS px) } -> the reason, or '' for a computer. A touch laptop has a fine pointer
  // too; an iPad says it is a Mac, so the coarse pointer on a screen of 1100 px or less is what finds it
  const mobileWhy = env => {
    if (env.uaMobile === true) return 'the browser says it is a phone or tablet';
    if (env.uaMobile === undefined && /Android|iPhone|iPad|iPod|Mobile/i.test(env.ua || '')) return 'the browser names a phone or tablet';
    if (env.coarse && !env.fine && env.minSide > 0 && env.minSide <= 1100) return 'a touch screen of ' + env.minSide + ' px with no mouse';
    return '';
  };

  // ---- WHAT THIS DEVICE IS: read once, from the browser -------------------------------------------------------
  const probe = () => {
    const nav = W.navigator || {}, scr = W.screen || {};
    const mq = q => { try { return !!(W.matchMedia && W.matchMedia(q).matches); } catch (e) { return false; } };
    const env = {
      ua: nav.userAgent || '',
      uaMobile: nav.userAgentData && typeof nav.userAgentData.mobile === 'boolean' ? nav.userAgentData.mobile : undefined,
      coarse: mq('(pointer: coarse)'), fine: mq('(any-pointer: fine)'),
      minSide: Math.min(scr.width || 0, scr.height || 0),
      screen: (scr.width || 0) + ' × ' + (scr.height || 0) + (W.devicePixelRatio && W.devicePixelRatio !== 1 ? ' at ' + (+W.devicePixelRatio.toFixed(2)) + 'x' : ''),
      threads: nav.hardwareConcurrency || 0, mem: nav.deviceMemory || 0,
      webgl2: false, gpu: '',
    };
    // the throwaway context: a detached canvas (no listener of the page sees its loss), let go at once
    try {
      const c = W.document.createElement('canvas');
      const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
      if (gl) {
        env.webgl2 = true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        env.gpu = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      }
    } catch (e) {}
    env.mobile = !!mobileWhy(env);
    return env;
  };

  // ---- THE DECISION: pure, tested in GATE GFX ------------------------------------------------------------------
  // (env, store {getItem}, query, nav) -> { screen: 'none' | 'welcome' | 'gate', why, suggest, gpu, mem, gpuName }
  const read = (store, k) => { try { return store.getItem(k); } catch (e) { return null; } };
  // host (A0, 2026-10-03): the box's rigs drive a headed Chrome with webdriver OFF and load from localhost - the welcome
  // held every boot of train 27's gate ("boot timeout"); a player loads from Pages. localhost skips it unless ?welcome=1 / ?devgate=1
  const isLocal = h => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h || '');
  const decide = (env, store, q, nav, host) => {
    const gpuName = cleanGpu(env.gpu);
    const g = gpuClass(env.gpu), m = memClass(env);
    const out = { screen: 'none', why: '', suggest: lower(g.cls, m.cls), gpu: g, mem: m, gpuName, mobile: mobileWhy(env) };
    if (isRig(nav) && !force('welcome', q) && !force('devgate', q)) { out.why = 'a rig'; return out; }
    if (isLocal(host) && !force('welcome', q) && !force('devgate', q)) { out.why = 'localhost (a rig or a dev server)'; return out; }
    if (/[?&]gfx=[a-z]/.test(q) && !force('welcome', q) && !force('devgate', q)) { out.why = '?gfx= chose the preset'; return out; }
    let rec = null; try { rec = JSON.parse(read(store, KEY) || 'null'); } catch (e) {}
    if (force('devgate', q) || ((out.mobile || !env.webgl2) && !(rec && rec.tried))) {
      out.screen = 'gate'; out.why = !env.webgl2 ? 'no WebGL2' : out.mobile; return out;
    }
    if (force('welcome', q)) { out.screen = 'welcome'; out.why = '?welcome=1'; return out; }
    if (rec && rec.gpu === gpuName) { out.why = 'this card was seen (' + rec.preset + ')'; return out; }
    if (!rec && read(store, 'flydiy.gfx')) { out.why = 'a choice saved in the menu'; out.adopt = true; return out; }
    out.screen = 'welcome'; out.why = rec ? 'a new graphics card' : 'the first visit';
    return out;
  };
  const remember = (store, d, preset, extra) => {
    try { store.setItem(KEY, JSON.stringify(Object.assign({ gpu: d.gpuName, preset, suggested: d.suggest, at: new Date().toISOString().slice(0, 10) }, extra || {}))); } catch (e) {}
  };

  // ---- THE SCREENS ------------------------------------------------------------------------------------------------
  const BACKDROP = 'shot_2026-09-12_224119';   // the hangar Cub (media/tex/shots, shots_pack.json)
  const CSS = `
#welcome { position:fixed; inset:0; z-index:90; display:flex; align-items:center; justify-content:center; padding:16px; overflow:auto;
  background:#1a1815 center / cover no-repeat; color:#f4efe6; font:400 14px/1.45 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; }
#welcome .wcard { width:min(520px, 100%); background:rgba(26,24,21,.86); border:1px solid rgba(255,255,255,.10); border-radius:10px;
  padding:22px 24px 20px; box-shadow:0 10px 40px rgba(0,0,0,.4); }
#welcome .wbrand { font-size:11px; font-weight:600; letter-spacing:.18em; text-transform:uppercase; color:#97907f; }
#welcome h1 { margin:6px 0 14px; font-size:20px; font-weight:500; }
#welcome .wsec { margin:14px 0 6px; font:600 10px/1 'IBM Plex Sans', sans-serif; letter-spacing:.2em; text-transform:uppercase; color:#97907f; }
#welcome dl { display:grid; grid-template-columns:110px 1fr; gap:5px 12px; margin:0; }
#welcome dt { color:#a59d8f; } #welcome dd { margin:0; color:#d8d1c4; overflow-wrap:anywhere; }
#welcome dd i { font-style:normal; color:#7d766a; }
#welcome .wsug { margin-top:16px; padding:12px 14px; border-radius:8px; background:rgba(230,161,90,.08); border:1px solid rgba(230,161,90,.30); }
#welcome .wsug b { color:#e6a15a; font-weight:600; }
#welcome .wsug small { display:block; margin-top:4px; color:#a59d8f; font-size:12px; }
#welcome .wpills { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
#welcome .wpills[hidden] { display:none; }
#welcome .pill { font:500 12px/1 'IBM Plex Sans', sans-serif; padding:7px 11px; border-radius:12px; cursor:pointer;
  color:#d8d1c4; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.14); }
#welcome .pill.on { color:#1a1815; background:#e6a15a; border-color:#e6a15a; }
#welcome .wfoot { display:flex; align-items:center; gap:14px; margin-top:18px; }
#welcome .wplay { font:600 14px/1 'IBM Plex Sans', sans-serif; letter-spacing:.06em; padding:11px 24px; border-radius:7px; cursor:pointer;
  color:#1a1815; background:#e6a15a; border:1px solid #e6a15a; }
#welcome .wlink { background:none; border:0; padding:0; color:#a59d8f; text-decoration:underline; cursor:pointer; font:inherit; font-size:13px; }
#welcome .wnote { margin-top:12px; color:#7d766a; font-size:12px; }
#welcome p { margin:8px 0; color:#d8d1c4; }
#welcome button { transition:none; backdrop-filter:none; -webkit-backdrop-filter:none; }
`;
  const el = (tag, cls, text) => { const e = W.document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const sheet = () => {
    if (W.document.getElementById('welcomeCss')) return;
    const s = el('style'); s.id = 'welcomeCss'; s.textContent = CSS; (W.document.head || W.document.body).appendChild(s);
  };
  const open = () => {
    sheet();
    let o = W.document.getElementById('welcome');
    if (o) o.remove();
    o = el('div'); o.id = 'welcome'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    // THE BACKDROP (A0, the user 2026-10-03: "pick a nice screenshot to put behind - we'll update all these later"): the
    // boot deck's own picture of the yellow Cub in the lit hangar, read off its <figure> in #bootShots (the build hashes
    // the file name, so it is found, not spelled), darkened under the card. No picture (a rig, a trimmed deck): the plain.
    try {
      const host = W.document.getElementById('bootShots'), imgs = host ? host.getElementsByTagName('img') : [];
      for (let i = 0; i < imgs.length; i++) { const u = imgs[i].getAttribute('src') || imgs[i].getAttribute('data-src') || '';
        if (u.indexOf(BACKDROP) >= 0) { o.style.backgroundImage = 'linear-gradient(rgba(20,18,15,.58), rgba(20,18,15,.72)), url("' + u + '")'; break; } }
    } catch (e) {}
    const card = el('div', 'wcard'); o.appendChild(card);
    card.appendChild(el('div', 'wbrand', 'flyDiy'));
    (W.document.body || W.document.documentElement).appendChild(o);
    return { o, card };
  };
  const facts = (card, env, d) => {
    card.appendChild(el('div', 'wsec', 'Your computer'));
    const dl = el('dl');
    const row = (k, v, note) => { dl.appendChild(el('dt', null, k)); const dd = el('dd', null, v); if (note) { dd.appendChild(W.document.createTextNode(' ')); dd.appendChild(el('i', null, note)); } dl.appendChild(dd); };
    row('graphics', d.gpuName || (env.webgl2 ? 'not named by the browser' : 'no WebGL2'), env.webgl2 ? '→ ' + LABEL[d.gpu.cls] + ' (' + d.gpu.why + ')' : '');
    row('processor', env.threads ? env.threads + ' threads' : 'not said');
    row('memory', env.mem ? (env.mem >= 8 ? '8 GB or more' : env.mem + ' GB') : 'not said', '→ ' + (d.mem.cls === 'gamer' ? 'no cap' : LABEL[d.mem.cls] + ' at most'));
    row('screen', env.screen || 'not said', d.mobile ? '(' + d.mobile + ')' : '');
    card.appendChild(dl);
  };
  // THE WELCOME: resolves with the preset the player plays on
  const showWelcome = (env, d, opt) => new Promise(res => {
    const { o, card } = open();
    card.appendChild(el('h1', null, opt && opt.recheck ? 'Your computer, checked again' : 'Welcome'));
    facts(card, env, d);
    let pick = d.suggest;
    const sug = el('div', 'wsug');
    const sugT = el('div'); sug.appendChild(sugT);
    const sugW = el('small'); sug.appendChild(sugW);
    const pills = el('div', 'wpills'); pills.hidden = true;
    const play = el('button', 'wplay'); play.type = 'button';
    const paint = () => {
      sugT.textContent = ''; sugT.appendChild(W.document.createTextNode(pick === d.suggest ? 'Suggested: ' : 'Chosen: '));
      sugT.appendChild(el('b', null, LABEL[pick]));
      sugW.textContent = pick === d.suggest ? 'the lower of the graphics card (' + LABEL[d.gpu.cls] + ') and the memory (' + (d.mem.cls === 'gamer' ? 'no cap' : LABEL[d.mem.cls]) + ') - ' + WHY[pick] : WHY[pick];
      for (const b of pills.children) b.classList.toggle('on', b.dataset.p === pick);
      play.textContent = 'Play on ' + LABEL[pick];
    };
    for (const p of ORDER) {
      const b = el('button', 'pill', LABEL[p]); b.type = 'button'; b.dataset.p = p; b.title = WHY[p];
      b.onclick = () => { pick = p; paint(); };
      pills.appendChild(b);
    }
    sug.appendChild(pills);
    card.appendChild(sug);
    const foot = el('div', 'wfoot');
    const other = el('button', 'wlink', 'choose another'); other.type = 'button';
    other.onclick = () => { pills.hidden = !pills.hidden; };
    foot.appendChild(play); foot.appendChild(other);
    card.appendChild(foot);
    card.appendChild(el('div', 'wnote', 'Asked once for this graphics card. Every option can be changed later in GRAPHICS, where "re-check my computer" asks again.'));
    play.onclick = () => { o.remove(); res(pick); };
    paint();
    try { play.focus(); } catch (e) {}
  });
  // THE DEVICE GATE: resolves 'potato' when the player tries anyway (it never resolves otherwise: nothing loads)
  const showGate = (env, d) => new Promise(res => {
    const { card } = open();
    card.appendChild(el('h1', null, 'flyDiy is made for a computer, for now'));
    card.appendChild(el('p', null, !env.webgl2
      ? 'This browser has no WebGL2, which the game draws with. A recent Chrome, Edge or Firefox on a desktop or a laptop has it.'
      : 'Phones and tablets do not have the memory the island needs yet: the browser closes the page before it has loaded. A lighter version for them is being built.'));
    facts(card, env, d);
    card.appendChild(el('p', null, 'Open this page on a desktop or a laptop to fly.'));
    const foot = el('div', 'wfoot');
    const go = el('button', 'wlink', 'try anyway (experimental)'); go.type = 'button';
    go.onclick = () => { W.document.getElementById('welcome').remove(); res('potato'); };
    foot.appendChild(go);
    card.appendChild(foot);
  });

  // ---- THE LOST CONTEXT -----------------------------------------------------------------------------------------
  const lostMsg = () => {
    if (W.document.getElementById('welcome')) return;
    const { card } = open();
    const cur = (W.GFX && W.GFX.get && W.GFX.get().preset) || '';
    card.appendChild(el('h1', null, 'The graphics card stopped drawing'));
    card.appendChild(el('p', null, 'The browser lost the game’s WebGL context. It usually means the graphics card ran out of memory' +
      (cur && cur !== 'potato' ? ' on the ' + (LABEL[cur] || cur) + ' preset.' : '.') + ' The potato preset asks the least of it.'));
    const foot = el('div', 'wfoot');
    const pot = el('button', 'wplay', 'Reload on potato'); pot.type = 'button';
    pot.onclick = () => { try { const u = new URL(W.location.href); u.searchParams.set('gfx', 'potato'); W.location.href = u.toString(); } catch (e) { W.location.reload(); } };
    const again = el('button', 'wlink', 'reload as it is'); again.type = 'button';
    again.onclick = () => W.location.reload();
    foot.appendChild(pot); foot.appendChild(again);
    card.appendChild(foot);
  };
  const isGameCanvas = t => !!(t && t.isConnected && (t.id === 'c' || (W.FLYDIY_RENDERER && W.FLYDIY_RENDERER.domElement === t)));

  // ---- THE RUN ----------------------------------------------------------------------------------------------------
  const nav = W.navigator || {};
  const API = W.WELCOME = {
    ORDER, LABEL, KEY, cleanGpu, gpuClass, isSoftware, memClass, mobileWhy, decide, isRig, probe,
    RIG: isRig(nav), SOFT: false, pick: null, decision: null, env: null,   // SOFT (G1460): the probe's card is a software renderer
    // the graphics menu's "re-check my computer": the welcome again, in place; resolves with the preset picked
    recheck: () => {
      const env = probe(), d = decide(env, { getItem: () => null }, '', {});
      API.env = env; API.decision = d;
      return showWelcome(env, d, { recheck: true }).then(p => { remember(W.localStorage, d, p); return p; });
    },
  };
  if (W.addEventListener) {
    W.addEventListener('webglcontextlost', e => { if (!API.RIG && isGameCanvas(e.target)) lostMsg(); }, true);
    W.addEventListener('webglcontextrestored', e => {
      if (!isGameCanvas(e.target)) return;
      const o = W.document.getElementById('welcome'); if (o && /stopped drawing/.test(o.textContent)) o.remove();
    }, true);
  }
  if (!W.document || !W.document.createElement) return;
  let d;
  try { const env = probe(); API.env = env; API.SOFT = isSoftware(env.gpu); d = API.decision = decide(env, W.localStorage, search(), nav, W.location && W.location.hostname); }
  catch (e) { return; }   // a welcome that cannot decide is no welcome: the game loads as it did
  if (d.adopt) { let pr = 'menu'; try { pr = JSON.parse(W.localStorage.getItem('flydiy.gfx')).preset || pr; } catch (e) {} remember(W.localStorage, d, pr); }
  if (d.screen === 'none') return;
  const t0 = Date.now();
  W.FLYDIY_WELCOME = (d.screen === 'gate' ? showGate(API.env, d).then(p => { remember(W.localStorage, d, p, { tried: true }); return p; })
                                          : showWelcome(API.env, d).then(p => { remember(W.localStorage, d, p); return p; }))
    .then(p => {
      API.pick = p;
      // the loading screen's clock did not run while the player read (boot.js: the scripts' share is measured from T0)
      try { if (W.BOOT && W.BOOT.shift) W.BOOT.shift(Date.now() - t0); } catch (e) {}
      return p;
    });
})();
