// load_matrix_eval.js - the numbers a row of tools/perf/load_matrix.sh reads in the page at the end of its load
// (boot_perf --eval-file). ONE expression; every read is guarded: a build without the counter prints nothing for it.
//   slicesWorst   __WORLD_SLICES.worst: the longest main-thread slice of the world build (PERF-WORLDBUILD)
//   settle        FLYDIY_WORLD_SETTLE: why the settle step ended, under which rule, after how many updates
//   stripw        FLYDIY_STRIPW: the strips' worker (why / asked / used / inline / missed / waitMs) and near first
//                 (near / coarse / landed / lost / landMax / lastLandS)
//   lab           FLYDIY_LAB: PERF-LEAD's switches as the page read them (noLogs / wcSliced / firstUse / lampsFixed)
//   lamps         the premises lamp pool: armed, fixedCount; guard: the draw guard's held / compiles / firstUseMs
//   heapMB        the JS heap in use
(() => {
  const g = k => { try { return window[k]; } catch (e) { return undefined; } };
  const pick = (o, ks) => { if (!o) return undefined; const r = {}; for (const k of ks) if (o[k] !== undefined) r[k] = o[k]; return Object.keys(r).length ? r : undefined; };
  const S = g('__WORLD_SLICES'), W = g('FLYDIY_WORLD_SETTLE'), T = g('FLYDIY_STRIPW'), L = g('FLYDIY_LAB'), G = g('FLYDIY_GUARD');
  let lamps; try { const P = WORLD.premises && WORLD.premises.lamps; if (P) lamps = { armed: !!P.armed, fixed: !!P.fixedCount }; } catch (e) {}
  const on = o => { if (!o) return undefined; const r = Object.keys(o).filter(k => o[k]); return r.length ? r.join('+') : undefined; };
  const out = {
    slicesWorst: S && S.worst,
    settle: pick(W, ['why', 'rule', 'n']),
    stripw: pick(T, ['why', 'asked', 'used', 'inline', 'missed', 'waitMs', 'near', 'coarse', 'landed', 'lost', 'landMax', 'lastLandS']),
    lab: on(L),
    lamps,
    guard: G && pick(G.stats, ['held', 'compiles', 'ready', 'timedOut', 'firstUseMs']),
    heapMB: (() => { try { return Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (e) { return undefined; } })(),
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return JSON.stringify(out);
})()
