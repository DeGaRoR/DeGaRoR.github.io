// fleet_b_eval.js - rollout_perf --eval @tools/perf/fleet_b_eval.js (FLEET-PROPS B, G2225): read at the end of a run.
// The GPU timer (FLIGHT_REC's per-frame column) and draws / tris per frame, by where the aeroplane was: TAXI (on the
// ground, rolling 1.5-20 m/s), AIR (over 100 m AGL: the climb-out and the circuit over HOME); the fleet's state (the
// page's build, the flag, the stand's set and misses, the decodes) and every fleet holder's level, drawn or held back.
(() => {
  const R = window.FLIGHT_REC && FLIGHT_REC.rec;
  const med = a => { const s = a.filter(v => v === v).sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
  const p90 = a => { const s = a.filter(v => v === v).sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * 0.9))].toFixed(3) : null; };
  const G = { taxi: { gpu: [], calls: [], tris: [] }, air: { gpu: [], calls: [], tris: [] } };
  if (R) for (let f = Math.max(0, R.frame - 60000); f < R.frame; f++) {
    const r = R.row(f); if (!r || !(r.dt === r.dt)) continue;
    const k = (r.agl < 2 && r.spd > 1.5 && r.spd < 20) ? 'taxi' : r.agl > 100 ? 'air' : null;
    if (!k || (r.flags & (1 | 4 | 64))) continue;   // the garage, a held frame, the boot: out
    G[k].gpu.push(r.gpu); G[k].calls.push(r.calls); G[k].tris.push(r.tris);
  }
  const sum = g => ({ n: g.gpu.length, gpuN: g.gpu.filter(v => v === v).length, gpu: med(g.gpu), gpuP90: p90(g.gpu), calls: med(g.calls), tris: med(g.tris) });
  const P = window.PARKED, F = P && P.fleet, S = window.FLEET_STAND && FLEET_STAND.state, cam = window.FLIGHT_PROBE && FLIGHT_PROBE.camera ? FLIGHT_PROBE.camera() : null;
  const holders = S ? S.holders.map(h => { const lod = h.children[0], e = h.matrixWorld.elements;
    return { slot: h.userData.fleetSlot, level: lod ? lod.levels.findIndex(l => l.object.visible) : -1, ladder: lod ? lod.levels.map(l => Math.round(l.distance)) : null,
             d: cam ? Math.round(Math.hypot(e[12] - cam.position.x, e[13] - cam.position.y, e[14] - cam.position.z)) : null }; }) : [];
  const gx = window.GFX && GFX.get ? GFX.get() : null;
  return { build: window.FLYDIY_BUILD || null, preset: gx && gx.preset, gfxBuild: gx && gx.build, fleetOn: !!(P && P.fleetOn && P.fleetOn()), limit: S ? S.limit : null,
           taxi: sum(G.taxi), air: sum(G.air), stand: S ? { key: S.key, n: S.holders.length, miss: S.plan ? S.plan.miss : null, stats: S.stats } : null,
           fleet: F ? { stats: F.stats, why: F.why, lru: F.lru.slice() } : null, holders };
})()
