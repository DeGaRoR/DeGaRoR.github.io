// progwait_hook.js - NAME EVERY WAIT ON A PROGRAM LINK (C4b, G879; the G874 method made a rig tool).
// Given to rollout_perf with `--pre @tools/perf/progwait_hook.js` (the page runs it before its own scripts), then read
// with `--eval @tools/perf/progwait_eval.js`. Every WebGL2 call that can block on a pending link (the program's info
// log, its parameters, its uniform / attribute lookups, useProgram) is timed; one over 12 ms is kept with its program
// object, the time and the page's mark (the boot step or the settings change it fell in - window.__PWMARK, set by
// wrapping BOOT.run / BOOT.show / GFX.set as they appear). The eval resolves each program to three's (its name, its key)
// and to the objects and materials wearing it, so a freeze's wait says WHICH shader it waited for.
(() => {
  const W = window, P = WebGL2RenderingContext.prototype;
  W.__PWAITS = []; W.__PWMARK = 'boot'; W.__PWWARN = [];
  // the page's warnings and errors, with the mark they fell in (a step that threw and was caught says so here)
  for (const k of ['warn', 'error']) { const f = console[k]; console[k] = function () { try { W.__PWWARN.push([Math.round(performance.now()), W.__PWMARK, k, Array.from(arguments).map(a => a && a.stack ? String(a.stack).slice(0, 400) : String(a)).join(' ').slice(0, 500)]); } catch (e) {} return f.apply(this, arguments); }; }
  const mark = m => { W.__PWMARK = m; W.__PWMARKS = W.__PWMARKS || []; W.__PWMARKS.push([Math.round(performance.now()), m]); };
  for (const fn of ['getProgramInfoLog', 'getProgramParameter', 'getUniformLocation', 'getActiveUniform', 'getAttribLocation', 'getActiveAttrib', 'useProgram', 'getUniformBlockIndex']) {
    const f = P[fn];
    if (typeof f !== 'function') continue;
    P[fn] = function (p) {
      const t0 = performance.now(), r = f.apply(this, arguments), ms = performance.now() - t0;
      if (ms > 12) { const R = W.WORLD && W.WORLD.renderer; const rt = R && R.getRenderTarget ? R.getRenderTarget() : null; W.__PWAITS.push({ t: t0, ms, fn, p, mark: W.__PWMARK, fr: R && R.info ? R.info.render.frame : -1, calls: R && R.info ? R.info.render.calls : -1, rt: rt ? (rt.name || '') + rt.width + 'x' + rt.height : 'canvas' }); }
      return r;
    };
  }
  // the marks: the boot's steps (BOOT.run's list and BOOT.show's screens) and each settings change
  const wrapSteps = (steps, set) => { for (const s of steps || []) { if (!s || s.__pw) continue; const fn = s.fn; s.__pw = 1; s.fn = function () { mark(set + ':' + s.id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }; } };
  const hook = () => {
    const B = W.BOOT;
    if (B && !B.__pw) {
      B.__pw = 1;
      const run = B.run, show = B.show;
      if (typeof run === 'function') B.run = function (steps, o) { wrapSteps(steps, (o && o.set) || 'boot'); return run.apply(this, arguments); };
      if (typeof show === 'function') B.show = function (set, o) { if (o && o.steps) wrapSteps(o.steps, o.set || set); mark('show:' + set); return show.apply(this, arguments); };
    }
    const G = W.GFX;
    if (G && !G.__pw && typeof G.set === 'function') { G.__pw = 1; const set = G.set; G.set = function (k, v) { mark('gfx:' + k + '=' + v); return set.apply(this, arguments); }; }
    if (!(B && B.__pw && G && G.__pw)) setTimeout(hook, 20);
  };
  hook();
})();
