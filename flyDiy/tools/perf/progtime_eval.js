// progtime_eval.js - progtime_hook.js's read-out (rollout_perf --eval @tools/perf/progtime_eval.js): every link as
// [issued ms, linked ms (-1: never seen linked), the step it was issued in, three's name, its key's hash, key length,
// the material type wearing it], the step marks, and per step: links issued, the sum and the worst of their link times.
// and every link's full key (the duplicate study: keys that differ in a light count or a define)
(() => {
  const L = window.__PT; if (!L) return null;
  const R = window.FLYDIY_RENDERER || WORLD.renderer, byGl = new Map();
  for (const pr of R.info.programs) byGl.set(pr.program, pr);
  const mat = new Map();
  const walk = sc => { try { sc.traverse(o => { for (const m of (o.material ? [].concat(o.material) : [])) { if (!m) continue; const pp = R.properties.get(m);
    const tag = (m.type || '?') + (m.name ? ':' + m.name : '') + (o.isInstancedMesh ? ' [I]' : '') + (o.isSkinnedMesh ? ' [S]' : '');
    if (pp.programs) for (const pr of pp.programs.values()) if (!mat.has(pr.program)) mat.set(pr.program, tag); } }); } catch (e) {} };
  walk(WORLD.scene); if (window.FLIGHT_PROBE && FLIGHT_PROBE.garageScene) try { walk(FLIGHT_PROBE.garageScene()); } catch (e) {}
  const rows = L.links.map(e => { const pr = byGl.get(e.p);
    return [Math.round(e.t0), e.t1 == null ? -1 : Math.round(e.t1 - e.t0), e.mark, e.name || (pr && pr.name) || '?', e.key || '', e.keyLen || 0, mat.get(e.p) || (pr ? '' : '(disposed)')]; });
  const by = {};
  for (const r of rows) { const b = by[r[2]] || (by[r[2]] = { n: 0, sum: 0, worst: 0, slow: 0 }); b.n++; if (r[1] > 0) { b.sum += r[1]; b.worst = Math.max(b.worst, r[1]); if (r[1] > 1000) b.slow++; } }
  const out = { rows, marks: L.marks, by };
  out.keys = L.links.map(e => e.ck || null);
  return out;
})()
