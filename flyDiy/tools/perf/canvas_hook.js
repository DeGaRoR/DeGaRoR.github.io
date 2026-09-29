// canvas_hook.js - rollout_perf --pre (AS4b G927): every <canvas> the page makes, its size when first drawn into, and
// the source file:line that made it - window.__CANVAS. ASSETS §5.3 M4 counted "a 2048² canvas per runway
// (render_premises.js 988-999)"; this says what the game actually paints, by file, in MiB (w x h x 4).
//   node tools/rollout_perf.js ... --pre @tools/perf/canvas_hook.js --eval "window.__CANVAS_SUM()"
(() => {
  const L = window.__CANVAS = [];
  const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (tag) {
    const el = ce.apply(this, arguments);
    if (String(tag).toLowerCase() === 'canvas') {
      const st = (new Error().stack || '').split('\n').slice(2, 6).map(s => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).filter(s => !/canvas_hook/.test(s));
      const rec = { at: st[0] || '?', w: 0, h: 0 }; L.push(rec);
      const gc = el.getContext;
      el.getContext = function () { rec.w = el.width; rec.h = el.height; rec.ctx = arguments[0]; return gc.apply(this, arguments); };
    }
    return el;
  };
  window.__CANVAS_SUM = () => {
    const by = {};
    for (const r of L) { const f = (/([\w.-]+\.(?:js|html)):(\d+)/.exec(r.at) || [0, r.at, '?']); const k = f[1] + ':' + f[2] + ' ' + r.w + 'x' + r.h;
      const b = by[k] || (by[k] = { n: 0, MiB: 0 }); b.n++; b.MiB = +(b.MiB + r.w * r.h * 4 / 1048576).toFixed(3); }
    const total = +L.reduce((a, r) => a + r.w * r.h * 4 / 1048576, 0).toFixed(2);
    const big = L.filter(r => r.w >= 2048 || r.h >= 2048).length;
    return { canvases: L.length, MiB: total, of2048: big, top: Object.entries(by).sort((a, b) => b[1].MiB - a[1].MiB).slice(0, 25) };
  };
})();
