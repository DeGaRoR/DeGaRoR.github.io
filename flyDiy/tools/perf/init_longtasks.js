// init_longtasks.js - boot_perf --init-file: every long task of the page with its start, and the moment the boot's screen
// is gone, kept in window.__LT for load_matrix_eval.js (PERF-LEAD, 22 Nov: "what does the garage pay in the seconds
// AFTER the reveal" - the row of ?latelinks=bg, whose links run there). A long task is 50 ms or more by the browser's rule.
(() => {
  const L = window.__LT = { tasks: [], reveal: 0 };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) L.tasks.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { L.err = String(e && e.message); }
  const t = setInterval(() => { const B = window.BOOT; if (B && B.state === 'gone' && !L.reveal) { L.reveal = performance.now(); clearInterval(t); } }, 100);
})();
