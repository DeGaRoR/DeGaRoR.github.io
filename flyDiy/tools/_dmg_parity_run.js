// G2355 (DMG-DETERMINISM): ONE CRASH, THE SAME CODE IN NODE AND IN A PAGE - the page-vs-node parity run. A plain script
// (no require): in node `module.exports`, in a page `window.DMG_PARITY`. It flies _treecrash_lib's atTrunk's state path
// exactly (the flat world at 300 m with its own trunk set, the placement, the settle on the wheels, the ensemble's nudge,
// the speed, the trunk, the throttle, 60 frames a second) on the core it is handed and a def built there from the build's
// spec (buildGen o genMigrateSpec: the three land builds need no cage kit), the certificate handed in as the game's bench
// thread hands it ({ nb, Ft, Fc }); its own trig is the core's (C.CORE_MATH, G2370); it reads nothing back into the sim,
// so its bits are atTrunk's (GATE DMGDETERMINISM proves it in node: the same hash as the library's). The fingerprint is
// the caller's: sha1 of p then v (float64).
(function (root) {
  'use strict';
  const STD = {
    taxi:     { D: 4, V: 3, thr: 0, secs: 8 },
    noseover: { D: 12, V: 12, thr: 0, secs: 6, trunk: { r: 0.25, h: 0.35, sink: 0 } },
    trunk0:   { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 0 },
    trunk25:  { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 2.5 },
    flight:   { D: 40, agl: 60, V: 30, thr: 1, secs: 20, noTrunk: true },
  };
  const mulberry = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function run(C, spec, cert, id, seed) {
    const o = STD[id], d0 = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
    const def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage: !!cert }), cert: cert ? { nb: cert.nb, Ft: Float64Array.from(cert.Ft), Fc: Float64Array.from(cert.Fc) } : null });
    const elev = 300, W0 = C.makeWorld(0, {}), TH = C.TREE_HITS.make();
    const W = Object.assign({}, W0, { terrainH: () => elev, obstacles: C.OBSTACLES.make(), trees: [], treesNear: (x, z, q) => { q.length = 0; return q; }, treeHits: TH });
    const strip = W0.aerodromes.find(a => a.id === 'HOME') || W0.aerodromes[0];
    const sim = C.makeSim(def, W);
    sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
    // (G2370: the core's own sin / cos - in a page Math is the engine's, which is not node's in the last bit; in node
    // CORE_MATH's are the builtins' bits, so the library's atTrunk, on Math, flies the same velocities)
    const M = C.CORE_MATH || Math, fx = M.cos(strip.hdg), fz = M.sin(strip.hdg);
    if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
    if (seed) { const r = mulberry(seed * 2654435761 >>> 0); for (let i = 0; i < sim.n * 3; i++) sim.p[i] += 1e-9 * (2 * r() - 1); }
    for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
    const c0 = sim.cgPos().slice(), off = o.off || 0, tk = o.trunk || { r: 0.3, h: 10.05, sink: 0 };
    if (!o.noTrunk) TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev - tk.sink, tk.r, elev - tk.sink + tk.h]);
    sim.ctl.thr = o.thr;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    for (let f = 0; f < o.secs * 60; f++) sim.step(1 / 60);
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    const D = sim.damage ? sim.damage() : { broken: [], work: 0 };
    return { p: Float64Array.from(sim.p), v: Float64Array.from(sim.v), broken: D.broken.length, work: D.work, ms };
  }
  const api = { STD, run };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DMG_PARITY = api;
})(typeof window !== 'undefined' ? window : this);
