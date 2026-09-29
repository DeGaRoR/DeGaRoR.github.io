// progwait_eval.js - progwait_hook.js's read-out (rollout_perf --eval @tools/perf/progwait_eval.js): every wait over
// 12 ms as [t ms, wait ms, GL call, the page's mark, three's program name, its key's length, who wears it (object /
// material, skinned or not; '' = no scene material: a depth / distance variant of the shadow maps, or a warm-up's), the
// key's head], the marks, the sum of the waits by mark, and (with --progwatch) every program with its link time
(() => {
  const R = WORLD.renderer, byGl = new Map();
  for (const pr of R.info.programs) byGl.set(pr.program, pr);
  const who = new Map();
  const add = (pr, s) => { if (!pr) return; const l = who.get(pr) || []; if (l.length < 3 && !l.includes(s)) l.push(s); who.set(pr, l); };
  try {
    WORLD.scene.traverse(o => {
      for (const m of (o.material ? [].concat(o.material) : [])) {
        if (!m) continue;
        const pp = R.properties.get(m), tag = (o.name || o.type) + '/' + (m.name || m.type) + (o.isSkinnedMesh ? ' [skinned]' : '') + (o.visible ? '' : ' [hidden]');
        if (pp.programs) for (const pr of pp.programs.values()) add(pr, tag);
        add(pp.currentProgram, tag);
      }
    });
  } catch (e) {}
  const rows = (window.__PWAITS || []).map(w => { const pr = byGl.get(w.p);
    return [Math.round(w.t), Math.round(w.ms), w.fn, w.mark, pr ? pr.name : '?', pr ? String(pr.cacheKey).length : 0, pr ? (who.get(pr) || []).join(' | ') : '(disposed)',
            pr ? String(pr.cacheKey).replace(/\s+/g, ' ').slice(0, 220) : '', w.fr, w.calls, w.rt,
            (() => { const e = pr && window.__PW && window.__PW.get(pr); return e ? [e.k, Math.round(e.t0), e.t1 == null ? -1 : Math.round(e.t1 - e.t0)] : null; })()]; });
  const byMark = {};
  for (const r of rows) byMark[r[3]] = Math.round((byMark[r[3]] || 0) + r[1]);
  // with --progwatch: every program three made - its name, key hash, first seen pending, ms to ready - and who wears it
  const progs = [];
  for (const [pr, e] of (window.__PW || new Map())) progs.push([e.k, Math.round(e.t0), e.t1 == null ? -1 : Math.round(e.t1 - e.t0), (who.get(pr) || []).join(' | ').slice(0, 160)]);
  return { waits: rows, byMark, marks: window.__PWMARKS || [], progs, warns: (window.__PWWARN || []).slice(0, 200) };
})()
