// load_matrix_eval.js - the numbers a row of tools/perf/load_matrix.sh reads in the page at the end of its load
// (boot_perf --eval-file). ONE expression; every read is guarded: a build without the counter prints nothing for it.
//   slicesWorst   __WORLD_SLICES.worst: the longest main-thread slice of the world build (PERF-WORLDBUILD)
//   settle        FLYDIY_WORLD_SETTLE: why the settle step ended, under which rule, after how many updates
//   stripw        FLYDIY_STRIPW: the strips' worker (used / inline / missed / waitMs; coarse / landed / lost / landMax)
//   lamps, pace   the premises lamp pool's state and the compile pacer's N
(() => {
  const g = k => { try { return window[k]; } catch (e) { return undefined; } };
  const pick = (o, ks) => { if (!o) return undefined; const r = {}; for (const k of ks) if (o[k] !== undefined) r[k] = o[k]; return r; };
  const S = g('__WORLD_SLICES'), W = g('FLYDIY_WORLD_SETTLE'), T = g('FLYDIY_STRIPW');
  const out = {
    slicesWorst: S && S.worst,
    settle: pick(W, ['why', 'rule', 'n', 'held', 'last']),
    stripw: pick(T, ['used', 'inline', 'missed', 'waitMs', 'coarse', 'landed', 'lost', 'landMax', 'lastLandS']),
    heapMB: (() => { try { return Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (e) { return undefined; } })(),
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return JSON.stringify(out);
})()
