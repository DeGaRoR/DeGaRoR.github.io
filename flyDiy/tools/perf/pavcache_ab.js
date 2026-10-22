// pavcache_ab.js - G3101 PAVE-CACHE: THE KEPT APRONS AND MERGES DRAW WHAT A FRESH BUILD DRAWS (SCENERY-ED-2's ask, 13 Oct).
// An --eval of tools/rollout_perf.js (the game on the user's file, the GPU slot): the scenery editor opened, the edit
// sequence SCENERY-ED-2 named - an apron dragged, a road dragged across another apron, a strip moved, a world-look
// slider then an edit, two undos, an edit outside every apron - each a real command of the editor (its own rebuild with
// the caches); then every mesh under the roads group is signed (name, order, counts, its bounding sphere, its position /
// aPav arrays' hash where the page still holds them), a WHOLE rebuild is forced (the caches flushed, everything made
// again) and signed again: the two multisets must be the same. Run it twice - default (the cache on) and with
// --q 'pavcache=0' (the control): both must say SAME.
// Usage: node tools/rollout_perf.js --build builds/cub_2026-09-20_corrected.json --cam chase --secs 4
//          --eval @tools/perf/pavcache_ab.js --eval-ms 300000 --label pavcache_ab [--q pavcache=0] --port .. --udd ..
(async () => {
  const P = window.PREMISES_EDITOR; if (!P) return { err: 'no editor' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  P.openEditor(); for (let i = 0; i < 300 && !P.ed; i++) await sleep(200); if (!P.ed) return { err: 'the editor did not open' };
  const ed = P.ed, R = P.R, PG = window.PREMISES_GEN, rec = () => ed.record(), out = { steps: [] };
  const fnv = a => { let h = 2166136261; for (let i = 0; i < a.length; i++) { h ^= Math.round(a[i] * 1000) & 0xffffffff; h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  const sign = () => { const L = []; R.groups.roads.traverse(m => { if (!m.isMesh || !m.geometry) return; const g = m.geometry, p = g.attributes.position, v = g.attributes.aPav, s = g.boundingSphere;
    L.push([m.name, m.renderOrder, p ? p.count : 0, g.index ? g.index.count : 0, s ? [s.center.x, s.center.y, s.center.z, s.radius].map(x => x.toFixed(2)).join(',') : '-',
      p && p.array && p.array.length ? fnv(p.array) : 'gpu', v && v.array && v.array.length ? fnv(v.array) : '-', m.visible ? 1 : 0].join('|')); });
    return L.sort(); };
  const drag = (id, key, dx, dz) => { const f = PG.findById(rec(), id); if (!f) return 'no ' + id; ed.setTool('select'); ed.select(id);
    const h = R.handles(id).find(q => q.key === key) || R.handles(id)[0]; if (!h) return 'no handle on ' + id;
    const L = R.overlay.frame.toLocal(h.p[0], h.p[2]); ed.cmd('drag', { key: h.key, x: L[0] + dx, z: L[1] + dz }); return id + ' ' + h.key; };
  // the aprons (paved polygons the composition made) and a road crossing one, a strip, a site far from every apron
  const O = R.overlay, paves = O.pavePolys || [];
  const featOf = id => { const f = PG.findById(rec(), id); if (f) return f; const a = PG.areaOfEntry ? PG.areaOfEntry(rec(), id) : null; return a ? { layer: 'areas', entry: a.area } : null; };
  const apron = paves.map(pp => featOf(pp.id)).find(Boolean), apron2 = paves.map(pp => featOf(pp.id)).filter(Boolean)[1] || apron;
  const near = (pp, r) => (O.roads || []).find(rd => !rd.runway && rd.pts.some(q => PG.inPoly(pp.poly, q[0], q[1])) && PG.findById(rec(), rd.id));
  const pp2 = paves.find(pp => near(pp)) || paves[0], road = pp2 && near(pp2), strip = rec().layers.runways[0];
  const site = rec().layers.sites.find(st => st.at && !paves.some(pp => Math.hypot(st.at.x - pp.poly[0][0], st.at.z - pp.poly[0][1]) < 600));
  if (apron) out.steps.push(drag(apron.entry.id, 'v0', 2.5, 0));
  if (road) out.steps.push(drag(road.id, 'v' + Math.floor(PG.findById(rec(), road.id).entry.pts.length / 2), 0, 3));
  if (strip) out.steps.push(drag(strip.id, 'e1', 0, 4));
  if (window.PAVEMENT && window.PAVEMENT.look && window.THREE) { const k = (window.PAVEMENT.LOOK_KEYS || [])[0]; if (k) { window.PAVEMENT.look(window.THREE, { [k]: 0.37 }); out.steps.push('look ' + k); } }
  if (apron2) out.steps.push(drag(apron2.entry.id, 'v0', -1.5, 1));
  ed.undo(); ed.undo(); out.steps.push('undo x2');
  if (site) out.steps.push(drag(site.id, 'at', 3, 0));
  await sleep(1500);
  const A = sign();
  ed.dirty();   // the whole rebuild: R.rebuild(null) - the caches flushed (RC.flush on no bbox)
  await sleep(1500);
  const B = sign();
  const ka = new Map(); for (const s of A) ka.set(s, (ka.get(s) || 0) + 1);
  let diff = 0; for (const s of B) { const n = ka.get(s) || 0; if (n) ka.set(s, n - 1); else diff++; } for (const [, n] of ka) diff += n;
  if (window.PAVEMENT && window.PAVEMENT.look && window.THREE) window.PAVEMENT.look(window.THREE, null);
  out.pavcache = !/[?&]pavcache=0/.test(location.search); out.meshes = [A.length, B.length]; out.diff = diff; out.verdict = diff === 0 ? 'SAME' : 'DIFFERENT';
  out.sample = diff ? { onlyKept: A.filter(s => !B.includes(s)).slice(0, 6), onlyFresh: B.filter(s => !A.includes(s)).slice(0, 6) } : null;
  return out;
})()
