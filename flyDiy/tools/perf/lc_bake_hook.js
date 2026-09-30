// lc_bake_hook.js - LOAD-COMPILE (G1137): the shed probe's bakes counted by boot step (rollout_perf --pre; read with
// --eval 'window.__LCBAKE'). Every PMREMGenerator fromCubemap / fromEquirectangular is one bake of an environment; the
// mark is the boot step (BOOT.run's steps wrapped, as progwait_hook does) or 'after' once the boot has lifted.
(() => {
  const W = window, B = W.__LCBAKE = { mark: 'boot', by: {}, n: 0 };
  const hookT = () => {
    const T = W.THREE;
    if (!T || !T.PMREMGenerator) { setTimeout(hookT, 20); return; }
    for (const k of ['fromCubemap', 'fromEquirectangular']) {
      const f = T.PMREMGenerator.prototype[k];
      T.PMREMGenerator.prototype[k] = function () { B.n++; const m = B.mark + ':' + k; B.by[m] = (B.by[m] || 0) + 1; return f.apply(this, arguments); };
    }
  };
  hookT();
  const hookB = () => {
    const BO = W.BOOT;
    if (!BO || !BO.run) { setTimeout(hookB, 20); return; }
    const run = BO.run;
    BO.run = function (steps, o) {
      for (const s of steps || []) { const fn = s.fn; s.fn = function () { B.mark = ((o && o.set) || 'boot') + ':' + s.id; return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }; }
      const done = o && o.done;
      if (o) o.done = function () { B.mark = 'after'; return typeof done === 'function' ? done.apply(this, arguments) : undefined; };
      return run.apply(this, arguments);
    };
  };
  hookB();
})();
