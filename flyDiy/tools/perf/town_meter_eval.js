// town_meter_eval.js - THE TOWN METER OF A RUN, READ IN THE PAGE (G3415, CITY-B): an expression for rollout_perf's --eval
// (`--eval @flyDiy/tools/perf/town_meter_eval.js`), so a rig's own rollout_perf reads it with no change of its own. It reads the
// flight recorder's 'town' / 'townN' / 'townKB' columns (every frame since the roll-out screen went: the 'reveal' event)
// and render_premises' parts (premises.town: their sums since the boot / the frames metered), and answers one JSON:
//   { frames, ms: { med, p90, p99, max, mean }, over2, over5, items: { med, max }, kb: { mean, p99, frames } | null,
//     parts: [[part, mean ms]], over100: [[s after the reveal, frame ms, town ms]], city: premises.cityStats() | null,
//     rings: premises.ring() }
(() => {
  const R = window.FLIGHT_REC && FLIGHT_REC.rec, PR = window.WORLD && WORLD.premises;
  if (!R || !R.C || R.C.town === undefined) return JSON.stringify({ err: 'no town meter in this build (G3415)' });
  const ev = R.events || [];
  let rev = 0; for (const e of ev) if (e[1] === 'reveal') rev = e[0];
  const ms = [], n = [], kb = [], o100 = [];
  for (let f = Math.max(0, R.frame - R.N + 1); f < R.frame; f++) {
    const r = R.row(f); if (!(r.t >= rev) || !(r.dt === r.dt)) continue;
    ms.push(r.town); n.push(r.townN); if (r.townKB === r.townKB) kb.push(r.townKB);
    if (r.dt > 100) o100.push([+((r.t - rev) / 1000).toFixed(2), Math.round(r.dt), +r.town.toFixed(2)]);
  }
  const srt = a => a.slice().sort((x, y) => x - y), pc = (a, p) => (a.length ? srt(a)[Math.min(a.length - 1, Math.floor(a.length * p))] : null);
  const r3 = x => (x == null ? null : +x.toFixed(3));
  const T = PR && PR.town, parts = T ? T.parts.map((k, i) => [k, r3(T.sumParts[i] / Math.max(1, T.frames))]).sort((a, b) => b[1] - a[1]) : null;
  return JSON.stringify({ frames: ms.length, ms: { med: r3(pc(ms, 0.5)), p90: r3(pc(ms, 0.9)), p99: r3(pc(ms, 0.99)), max: r3(ms.length ? Math.max(...ms) : null), mean: r3(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)) },
    over2: r3(ms.filter(x => x > 2).length / Math.max(1, ms.length)), over5: r3(ms.filter(x => x > 5).length / Math.max(1, ms.length)),
    items: { med: pc(n, 0.5), max: n.length ? Math.max(...n) : null }, kb: kb.length ? { mean: r3(kb.reduce((a, b) => a + b, 0) / kb.length), p99: r3(pc(kb, 0.99)), frames: kb.length } : null,
    parts, over100: o100.slice(0, 60), city: PR && PR.cityStats ? PR.cityStats() : null, rings: PR && PR.ring ? PR.ring() : null });
})()
