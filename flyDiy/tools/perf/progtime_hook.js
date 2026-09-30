// progtime_hook.js - EVERY PROGRAM'S LINK ON THE BOOT'S CLOCK (LOAD-COMPILE, G1085). Given to rollout_perf with
// `--pre @tools/perf/progtime_hook.js`, read with `--eval @tools/perf/progtime_eval.js`. Every gl.linkProgram is
// recorded with the time it was issued and the boot step it fell in (the marks: BOOT.run's steps, wrapped as
// progwait_hook.js wraps them), then polled (KHR_parallel_shader_compile's COMPLETION_STATUS: never blocks) until it
// reports linked - so the read-out says, per step, how many programs it started, how long each took on the driver's
// threads, and how many were still linking when a later step began. Three's name and key are attached when the
// program shows in renderer.info.programs (a program disposed before that keeps only its GL side).
(() => {
  const W = window, P = WebGL2RenderingContext.prototype;
  const L = W.__PT = { links: [], marks: [], mark: 'boot', gl: null };
  const mark = m => { L.mark = m; L.marks.push([Math.round(performance.now()), m]); };
  const link = P.linkProgram;
  P.linkProgram = function (p) {
    L.gl = this;
    L.links.push({ p, t0: performance.now(), t1: null, mark: L.mark, name: null, key: null, mat: null });
    return link.apply(this, arguments);
  };
  const byGl = new Map();
  let pend = [];
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const poll = () => {
    const gl = L.gl, t = performance.now();
    if (gl) {
      for (const e of L.links) if (e.t1 === null && !e.pending) { e.pending = true; pend.push(e); }
      const keep = [];
      for (const e of pend) {
        let ok = false; try { ok = gl.getProgramParameter(e.p, 0x91B1); } catch (err) { ok = true; }
        if (ok) e.t1 = t; else keep.push(e);
      }
      pend = keep;
      const R = W.FLYDIY_RENDERER || (W.WORLD && W.WORLD.renderer);
      if (R && R.info && R.info.programs) for (const pr of R.info.programs) {
        if (byGl.has(pr.program)) continue;
        byGl.set(pr.program, 1);
        const e = L.links.find(x => x.p === pr.program);
        if (e) { e.name = pr.name; e.key = fnv(String(pr.cacheKey)); e.keyLen = String(pr.cacheKey).length; e.ck = String(pr.cacheKey); }
      }
    }
    setTimeout(poll, 20);
  };
  poll();
  const wrapSteps = (steps, set) => { for (const s of steps || []) { if (!s || s.__pt) continue; const fn = s.fn; s.__pt = 1; s.fn = function () { mark(set + ':' + s.id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }; } };
  const hook = () => {
    const B = W.BOOT;
    if (B && !B.__pt) {
      B.__pt = 1;
      const run = B.run, show = B.show;
      if (typeof run === 'function') B.run = function (steps, o) { wrapSteps(steps, (o && o.set) || 'boot'); return run.apply(this, arguments); };
      if (typeof show === 'function') B.show = function (set, o) { if (o && o.steps) wrapSteps(o.steps, o.set || set); mark('show:' + set); return show.apply(this, arguments); };
    }
    if (!(B && B.__pt)) setTimeout(hook, 20);
  };
  hook();
})();
