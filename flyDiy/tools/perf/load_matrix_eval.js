// load_matrix_eval.js - the numbers a row of tools/perf/load_matrix.sh reads in the page at the end of its load
// (boot_perf --eval-file). ONE expression; every read is guarded: a build without the counter prints nothing for it.
//   slicesWorst   __WORLD_SLICES.worst: the longest main-thread slice of the world build (PERF-WORLDBUILD)
//   settle        FLYDIY_WORLD_SETTLE: why the settle step ended, under which rule, after how many updates
//   stripw        FLYDIY_STRIPW: the strips' worker (why / asked / used / inline / missed / waitMs) and near first
//                 (near / coarse / landed / lost / landMax / lastLandS)
//   patchw        FLYDIY_PATCHW: the premises patch's sampling asked of the worker (why / asked / used / here / waitMs)
//   lab           FLYDIY_LAB: PERF-LEAD's switches as the page read them; cubeSkipped: objects left out of the cube's compiles
//   lamps         the premises lamp pool: armed, fixedCount; guard: the draw guard's held / compiles / firstUseMs
//   alprocks      FLYDIY_ALPROCKS, if MOUNTAIN-VEG's build publishes it (cells / instances / worstMs / sets / cyl / ops)
//   heapMB        the JS heap in use
(() => {
  const g = k => { try { return window[k]; } catch (e) { return undefined; } };
  const pick = (o, ks) => { if (!o) return undefined; const r = {}; for (const k of ks) if (o[k] !== undefined) r[k] = o[k]; return Object.keys(r).length ? r : undefined; };
  const S = g('__WORLD_SLICES'), W = g('FLYDIY_WORLD_SETTLE'), T = g('FLYDIY_STRIPW'), L = g('FLYDIY_LAB'), G = g('FLYDIY_GUARD');
  let lamps; try { const P = WORLD.premises && WORLD.premises.lamps; if (P) lamps = { armed: !!P.armed, fixed: !!P.fixedCount }; } catch (e) {}
  const on = o => { if (!o) return undefined; const r = Object.keys(o).filter(k => o[k] === true); return r.length ? r.join('+') : undefined; };
  const out = {
    slicesWorst: S && S.worst,
    settle: pick(W, ['why', 'rule', 'n']),
    stripw: pick(T, ['why', 'asked', 'used', 'inline', 'missed', 'waitMs', 'near', 'coarse', 'landed', 'lost', 'landMax', 'lastLandS']),
    patchw: pick(g('FLYDIY_PATCHW'), ['why', 'asked', 'used', 'here', 'waitMs']),
    lab: on(L),
    cubeSkipped: (L && L.cubeSkipped) || undefined,
    lamps,
    guard: G && pick(G.stats, ['held', 'compiles', 'ready', 'timedOut', 'firstUseMs']),
    alprocks: pick(g('FLYDIY_ALPROCKS'), ['cells', 'instances', 'worstMs', 'sets', 'cyl', 'ops']),
    // (22 Nov eve) ?latelinks=bg's own counters; the long tasks AFTER the reveal (init_longtasks.js): n, their sum, the worst, how
    // many of 100 ms+, over how many seconds, and the first 30 s alone; the far terrain's slots; the mirror's captures / kept
    bg: L && L.lateBg ? pick(L.bg, ['revealed', 'running', 'done', 'xrayMs', 'ms', 'xrayLinks', 'scuffLinks', 'twins', 'noTwin', 'err']) : undefined,
    lateSkipped: (L && L.lateSkipped) || undefined,
    afterReveal: (() => { const T = g('__LT'); if (!T || !T.reveal) return undefined;
      const a = T.tasks.filter(t => t[0] >= T.reveal), a30 = a.filter(t => t[0] < T.reveal + 30000), sum = l => l.reduce((s, t) => s + t[1], 0), mx = l => l.reduce((m, t) => Math.max(m, t[1]), 0);
      return { secs: Math.round((performance.now() - T.reveal) / 1000), n: a.length, ms: sum(a), worst: mx(a), over100: a.filter(t => t[1] >= 100).length,
               first30: { n: a30.length, ms: sum(a30), worst: mx(a30), over100: a30.filter(t => t[1] >= 100).length } }; })(),
    farslots: (() => { const F = g('FLYDIY_FARSLOTS'); return F && F.on ? { sentKB: Math.round(F.sentKB), writes: F.writes, grows: F.grows, moved: F.moved } : undefined; })(),
    mirror: (() => { try { const M = WATER.mirror; return M && (M.pace || M.lean) ? pick(M, ['mode', 'captures', 'kept', 'leaned', 'skipped']) : undefined; } catch (e) { return undefined; } })(),
    heapMB: (() => { try { return Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (e) { return undefined; } })(),
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return JSON.stringify(out);
})()
