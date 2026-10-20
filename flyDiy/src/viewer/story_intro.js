// ============================================================================
// story_intro.js — THE OPENING (G3380-G3389 STORY-INTRO; futureDesigns/game/GAME-PLAN-2026-10-15.md §R2):
// a New career's cinematic over the cabin strip, with its music, then a fade into the garage.
// The user, 19 Oct: "Some cinematic views of the cabin, with the camera moving to open the story mode, and a music.
// It zooms on the cabin, then we fade into the garage."
//
// LAZY (build.js MANIFEST.lazy; FLYDIY_LAZY('story_intro')): fetched only by a New career with the story (app.js
// storyIntroCurtain), so the sandbox, Continue and the phone garage never load a byte of it.
// NO SECOND WORLD: the page's world, built and settled round the cabin's stand by the boot (the roll-out starts from
// the garage's `here`), is drawn FROM THE SHED - the boot's own warm draw does the same (app.js worldWarmDraw). The garage
// stays booted under it, so the fade back is a switch of the scene drawn, nothing compiled or baked. The world's streams
// stay keyed on the stand (app.js hands WF.worldUpdate the cabin's point, not the eye): the eye moves, nothing is planted
// far away; the cover ring (220 m round the eye) plants on its budget as everywhere.
//
//   STORY_INTRO.plan(ctx) -> plan       PURE. ctx = { aero: the cabin's aerodrome record (x, z, hdg, len, elev, fly?),
//                                        plot: { x, z, hdg } the shed (the base plot) | null, terrainH(x, z), waterH?(x, z) }
//   STORY_INTRO.pose(plan, t) -> pose    PURE. { p: [x, y, z], l: [x, y, z], fov, black: 0..1, shot } at t seconds of the shots
//   STORY_INTRO.play(host) -> ctl        the player: host = { plan, el (the curtain app.js put up), music: volume 0..1,
//                                        swap() (the garage back on screen), done(how) }; ctl = { frame(dt) -> pose | null,
//                                        skip(), state() }
//   STORY_INTRO.MUSIC, CREDIT            the track (CC0; CREDITS.md)
// ============================================================================
'use strict';
var STORY_INTRO = (() => {
  const MUSIC = 'media/audio/music/yoiyami_sunset_plains_intro.cfae36cd.ogg';
  const CREDIT = { title: 'Sunset Plains', author: 'Yoiyami', licence: 'CC0', source: 'https://opengameart.org/content/sunset-plains' };
  // THE CLOCK (s): the warm views under black, the fade up, each shot, the dips between them, the fade to black at the
  // end (the music fades with it), then the garage comes up out of black
  const WARM_S = 0.6, FADE_IN_S = 2.6, DIP_S = 0.45, FADE_OUT_S = 1.8, GARAGE_IN_S = 1.1, SKIP_OUT_S = 0.45;
  const SHOT_S = [11, 10.5, 12.5];
  const N_SAMP = 48;          // the terrain samples along a shot's eye path (the floor under it)
  const FOV0 = 50;

  const lerp = (a, b, k) => a + (b - a) * k;
  const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const clamp01 = k => (k < 0 ? 0 : k > 1 ? 1 : k);
  const smooth = k => { k = clamp01(k); return k * k * (3 - 2 * k); };
  // a slow drift: eased at both ends, mostly linear (a cinematic dolly that never stops dead mid-shot)
  const drift = k => { k = clamp01(k); return 0.7 * k + 0.3 * smooth(k); };
  const unit = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

  // ---- THE PLAN (pure) --------------------------------------------------------------------------------------------
  // The places, from the record alone: the strip's two ends (end 0 -> end 1 is +hdg; a story strip is landed over end 0,
  // up the valley), the valley (the way the approach comes in: the record's `fly.appr`, else straight off end 0), the gap
  // (the approach's far point), the shed (the base plot, else the stand / spawn).
  // Three shots: THE VALLEY (from the low end, out over the lake valley to the mountain gap, rising), THE STRIP (in from
  // over the valley, low up the gravel toward the shed), THE CABIN (an arc round the shed, closing from 75 m to 30 m off its door,
  // the lens narrowing: the zoom) - the last fades to black as it closes.
  function plan(ctx) {
    const A = ctx.aero, H = (x, z) => {
      let h = +ctx.terrainH(x, z); if (!isFinite(h)) h = +A.elev || 0;
      if (ctx.waterH) { const w = +ctx.waterH(x, z); if (isFinite(w) && w > h) h = w; }
      return h;
    };
    const u = [Math.cos(A.hdg), Math.sin(A.hdg)], n = [-u[1], u[0]], hl = (+A.len || 300) / 2;
    const c = [+A.x, +A.z], e0 = [c[0] - u[0] * hl, c[1] - u[1] * hl], e1 = [c[0] + u[0] * hl, c[1] + u[1] * hl];
    const appr = A.fly && Array.isArray(A.fly.appr) && A.fly.appr.length ? A.fly.appr : null;
    // the valley: from the low end toward the approach's nearest turn that lies off the strip (else straight out)
    let v = [-u[0], -u[1]];
    if (appr) for (let i = appr.length - 1; i >= 0; i--) { const q = appr[i], d = Math.hypot(q[0] - e0[0], q[1] - e0[1]); if (d > 400) { v = unit(q[0] - e0[0], q[1] - e0[1]); break; } }
    const gap = appr ? appr[0] : [e0[0] + v[0] * 3500, e0[1] + v[1] * 3500];
    const shed = ctx.plot && isFinite(ctx.plot.x) ? [+ctx.plot.x, +ctx.plot.z] : (A.spawn ? [+A.spawn[0], +A.spawn[1]] : e1);
    // the shed's side of the strip (+1 / -1 along n); its door faces the strip (a base plot stands beside it)
    const sd = Math.sign((shed[0] - c[0]) * n[0] + (shed[1] - c[1]) * n[1]) || 1;
    const door = unit(c[0] + u[0] * hl * 0.5 - shed[0], c[1] + u[1] * hl * 0.5 - shed[1]);
    const P = (x, z, agl) => [x, H(x, z) + agl, z];
    const hS = H(shed[0], shed[1]);
    const gapY = H(gap[0], gap[1]) + 60;
    const shots = [];
    // 1. THE VALLEY: beside the low end, looking out to the gap; a slow push out and up over the valley
    shots.push({ id: 'valley',
      e0: P(e0[0] - v[0] * 30 + n[0] * sd * 35, e0[1] - v[1] * 30 + n[1] * sd * 35, 30),
      e1: P(e0[0] + v[0] * 170 + n[0] * sd * 70, e0[1] + v[1] * 170 + n[1] * sd * 70, 75),
      l0: [gap[0], gapY - 40, gap[1]], l1: [gap[0], gapY, gap[1]], fov0: FOV0, fov1: FOV0 - 2, clr: 12 });
    // 2. THE STRIP: in from over the valley, low up the gravel on the far side from the shed, the shed ahead
    const s2a = [e0[0] + v[0] * 230 - n[0] * sd * 55, e0[1] + v[1] * 230 - n[1] * sd * 55];
    const s2b = [c[0] + u[0] * hl * 0.25 - n[0] * sd * 40, c[1] + u[1] * hl * 0.25 - n[1] * sd * 40];
    shots.push({ id: 'strip', e0: P(s2a[0], s2a[1], 50), e1: P(s2b[0], s2b[1], 16),
      l0: [c[0], H(c[0], c[1]) + 4, c[1]], l1: [shed[0], hS + 3, shed[1]], fov0: FOV0 - 2, fov1: FOV0 - 4, clr: 8 });
    // 3. THE CABIN: an arc round the shed from 75 m (40 deg off the door's line, high) to 30 m off its door, 3.5 m over its ground (the look, 20 Oct: 14 m from the plot put the eye 4 m off the wall - an 18 x 20 m shed), the
    // lens closing in (the zoom)
    const a1 = Math.atan2(door[1], door[0]), a0 = a1 + sd * 0.75;
    const arc = k => { const a = lerp(a0, a1, k), r = lerp(75, 30, k); return [shed[0] + Math.cos(a) * r, shed[1] + Math.sin(a) * r]; };
    const s3 = { id: 'cabin', arc, ya: hS + 26, yb: H(...arc(1)) + 3.5, l0: [shed[0], hS + 4, shed[1]], l1: [shed[0], hS + 2.6, shed[1]], fov0: FOV0 - 4, fov1: 34, clr: 2.2 };
    s3.e0 = [arc(0)[0], s3.ya, arc(0)[1]]; s3.e1 = [arc(1)[0], s3.yb, arc(1)[1]];
    shots.push(s3);
    // the clock, and the floor under each eye path (the terrain + the shot's clearance, a running max so a ridge is lifted
    // over smoothly, never stepped)
    let t = 0;
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      s.t0 = t; s.t1 = t + SHOT_S[i]; t = s.t1;
      const fl = new Float64Array(N_SAMP + 1);
      for (let j = 0; j <= N_SAMP; j++) { const q = eyeXZ(s, j / N_SAMP); fl[j] = H(q[0], q[1]) + s.clr; }
      const fm = new Float64Array(N_SAMP + 1);
      for (let j = 0; j <= N_SAMP; j++) { let m = -Infinity; for (let k = Math.max(0, j - 2); k <= Math.min(N_SAMP, j + 2); k++) m = Math.max(m, fl[k]); fm[j] = m; }
      s.floor = fm;
    }
    return { v: 1, T: t, shots, shed: [shed[0], hS, shed[1]], gap: [gap[0], gapY, gap[1]], valley: v, side: sd,
             anchor: [shed[0], hS + 1.5, shed[1]],   // the world's point for its streams (app.js): the cabin, never the eye
             warm: warmViews(shots) };
  }
  function eyeXZ(s, k) {
    const d = drift(k);
    if (s.arc) return s.arc(d);
    return [lerp(s.e0[0], s.e1[0], d), lerp(s.e0[2], s.e1[2], d)];
  }
  // the views drawn once under black before the shots (each shot's start, middle and end): their buffers go up and their
  // programs' residue links there, not in the first frame a shot shows (the boot's warm draw saw the stand only)
  function warmViews(shots) {
    const out = [];
    for (const s of shots) for (const k of [0, 0.5, 1]) out.push(poseAt(s, k));
    return out;
  }
  function poseAt(s, k) {
    k = clamp01(k);
    const d = drift(k), q = eyeXZ(s, k);
    const j = k * N_SAMP, j0 = Math.min(N_SAMP, Math.floor(j)), j1 = Math.min(N_SAMP, j0 + 1), f = s.floor[j0] + (s.floor[j1] - s.floor[j0]) * (j - j0);
    const y0 = s.arc ? lerp(s.ya, s.yb, smooth(k)) : lerp(s.e0[1], s.e1[1], d);
    return { p: [q[0], Math.max(y0, isFinite(f) ? f : y0), q[1]], l: lerp3(s.l0, s.l1, smooth(k)), fov: lerp(s.fov0, s.fov1, smooth(k)), shot: s.id };
  }
  // t: seconds into the shots (< 0: before the fade up). black: the curtain's opacity - the fade up, a dip round each cut,
  // the fade out over the last FADE_OUT_S
  function pose(P, t) {
    const S = P.shots;
    let s = S[S.length - 1];
    for (const x of S) if (t < x.t1) { s = x; break; }
    const o = poseAt(s, (t - s.t0) / (s.t1 - s.t0));
    let black = t < 0 ? 1 : t < FADE_IN_S ? 1 - smooth(t / FADE_IN_S) : 0;
    for (let i = 1; i < S.length; i++) { const dc = Math.abs(t - S[i].t0); if (dc < DIP_S) black = Math.max(black, 1 - smooth(dc / DIP_S)); }
    if (t > P.T - FADE_OUT_S) black = Math.max(black, smooth((t - (P.T - FADE_OUT_S)) / FADE_OUT_S));
    o.black = black; o.t = t;
    return o;
  }

  // ---- THE PLAYER ---------------------------------------------------------------------------------------------------
  // States: 'warm' (black, the warm views a frame each), 'shots' (the clock runs, the music plays), 'out' (a skip: a quick
  // fade to black), 'garage' (the garage swapped in, the curtain fading off it), 'done'.
  const CSS = '#stIntro { position:fixed; top:0; left:0; right:0; bottom:0; z-index:60; cursor:pointer; background:transparent !important; }\n' +
    '#stIntro .siBlack { position:absolute; top:0; left:0; right:0; bottom:0; background:#000; pointer-events:none; }\n' +
    '#stIntro .siSkip { position:absolute; right:16px; bottom:16px; min-height:32px; padding:0 16px; border-radius:16px; cursor:pointer;\n' +
    '  border:1px solid var(--ed-btn-bd); background:var(--ed-plate); color:var(--ed-ink); font:500 12.5px/30px \'IBM Plex Sans\', sans-serif;\n' +
    '  font-style:normal; letter-spacing:.02em; box-shadow:0 2px 10px rgba(0,0,0,.35); }\n' +
    '#stIntro .siSkip:hover, #stIntro .siSkip:focus-visible { border-color:var(--ed-acc); outline:none; }\n' +
    '#stIntro .siSkip kbd { font:500 10.5px/1 \'IBM Plex Sans\', sans-serif; color:var(--ed-faint); margin-left:8px; }\n' +
    '#stIntro.out { pointer-events:none; cursor:auto; }\n#stIntro.out .siSkip { display:none; }\n' +
    'body.stIntro > *:not(#c):not(#stIntro):not(#boot):not(#raDissolve) { visibility:hidden !important; }\n' +
    // the whole window (the garage's canvas stands between its panels: body.mode-ws #c), as the stills' body.shot does
    'body.stIntro #c { margin-left:0 !important; width:100% !important; transition:none !important; }\n';
  function play(host) {
    const P = host.plan, D = typeof document !== 'undefined' ? document : null;
    let st = 'warm', t = -WARM_S, wi = 0, tw = 0, black = 1, out = null, gIn = 0, how = 'played';
    let el = host.el || null, blk = null, btn = null, au = null, keyH = null, visH = null;
    const vol0 = Math.max(0, Math.min(1, host.music == null ? 0.5 : +host.music));
    if (D && D.createElement) {
      if (!D.getElementById('stIntroCss')) { const s = D.createElement('style'); s.id = 'stIntroCss'; s.textContent = CSS; (D.head || D.body).appendChild(s); }
      if (!el && D.body) { el = D.createElement('div'); el.id = 'stIntro'; D.body.appendChild(el); }
      if (el && el.style) el.style.cssText = '';
      if (el) el.innerHTML = '<div class="siBlack"></div><button type="button" class="siSkip" aria-label="skip the opening">Skip<kbd>Esc</kbd></button>';
      if (el && el.querySelector) { blk = el.querySelector('.siBlack'); btn = el.querySelector('.siSkip'); }
      if (el && el.addEventListener) el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); skip(); });
      keyH = e => { if (e.key === 'Escape' && st !== 'garage' && st !== 'done') { e.preventDefault(); e.stopPropagation(); skip(); } };
      if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', keyH, true);
      if (D.body && D.body.classList) D.body.classList.add('stIntro');
    }
    // THE MUSIC (the New career's click is the page's gesture: the element plays). Loaded now, under the warm views; it
    // starts with the shots' clock (the track's own six-second swell out of silence is the fade up)
    if (host.music !== 0 && typeof Audio !== 'undefined') {
      try {
        au = new Audio(); au.preload = 'auto'; au.src = MUSIC; au.volume = vol0;
        visH = () => { try { if (D.hidden) au.pause(); else if (st === 'shots') au.play().catch(() => {}); } catch (e) {} };
        if (D && D.addEventListener) D.addEventListener('visibilitychange', visH);
      } catch (e) { au = null; }
    }
    const paint = b => { black = b; if (blk) blk.style.opacity = String(Math.round(b * 1000) / 1000); };
    paint(1);
    function skip() {
      if (st === 'garage' || st === 'done' || st === 'out') return;
      how = 'skipped';
      out = { t: 0, from: black, vol: au ? au.volume : 0 };
      st = 'out';
      if (btn) btn.disabled = true;
    }
    function toGarage() {
      st = 'garage'; gIn = 0;
      if (el && el.classList && el.classList.add) el.classList.add('out');
      if (D && D.body && D.body.classList) D.body.classList.remove('stIntro');
      if (au) { try { au.pause(); au.removeAttribute('src'); au.load(); } catch (e) {} }
      if (keyH && typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('keydown', keyH, true);
      if (visH && D && D.removeEventListener) D.removeEventListener('visibilitychange', visH);
      try { host.swap(); } catch (e) { if (typeof console !== 'undefined') console.warn('story intro: the swap', e && e.message); }
    }
    function finish() {
      st = 'done';
      if (el && el.parentNode) el.parentNode.removeChild(el);
      try { host.done(how); } catch (e) {}
    }
    // one frame: the pose to draw the world from, or null (the garage is drawn)
    function frame(dt) {
      dt = Math.min(0.1, Math.max(0, +dt || 0));
      if (st === 'warm') {
        tw += dt;
        if (wi < P.warm.length) { const o = P.warm[wi++]; o.black = 1; return o; }
        if (tw < WARM_S) return P.warm[P.warm.length - 1];
        st = 'shots'; t = 0;
        if (au) { try { const p = au.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
      }
      if (st === 'shots') {
        t += dt;
        const o = pose(P, t);
        paint(o.black);
        if (au && t > P.T - FADE_OUT_S) au.volume = vol0 * (1 - smooth((t - (P.T - FADE_OUT_S)) / FADE_OUT_S));
        if (t >= P.T) { toGarage(); return null; }
        return o;
      }
      if (st === 'out') {
        out.t += dt;
        const k = smooth(out.t / SKIP_OUT_S);
        paint(lerp(out.from, 1, k));
        if (au) au.volume = out.vol * (1 - k);
        if (out.t >= SKIP_OUT_S) { toGarage(); return null; }
        return pose(P, Math.max(0, t));
      }
      if (st === 'garage') {
        gIn += dt;
        paint(1 - smooth(gIn / GARAGE_IN_S));
        if (gIn >= GARAGE_IN_S) finish();
        return null;
      }
      return null;
    }
    return { frame, skip, state: () => ({ st, t, black, how, music: !!au }) };
  }

  return { plan, pose, play, MUSIC, CREDIT, WARM_S, FADE_IN_S, FADE_OUT_S, GARAGE_IN_S, SKIP_OUT_S, SHOT_S, CSS };
})();
if (typeof window !== 'undefined') window.STORY_INTRO = STORY_INTRO;
if (typeof module !== 'undefined' && module.exports) module.exports = STORY_INTRO;
