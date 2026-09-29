// parked_mats.js - THE PARKED AEROPLANES' MATERIALS, COUNTED IN THE PAGE (AS4b M5, G929), for rollout_perf's --eval:
//   node tools/rollout_perf.js --port <p> --udd <dir> --eval @tools/parked_mats.js
// One expression, read-only. For every parked aeroplane in the world scene (a THREE.LOD named 'parked:<key>'): how it
// was stood (cooked offline, G805, or captured live), its rungs, and the materials its meshes wear - by uuid over all the
// placements, by uuid per placement, and whether any material is a placement's OWN (worn by no other placement of the
// same key): ASSETS §5.3 M5's "per-placement material copies". Plus PARKED's own log of how each key was had.
(() => {
  const W = window.WORLD, sc = W.scene, PK = window.PARKED;
  const lods = []; sc.traverse(o => { if (o.isLOD && /^parked:/.test(o.name || '')) lods.push(o); });
  const byKey = {}, all = new Set();
  for (const L of lods) {
    const k = L.name.slice(7), K = byKey[k] || (byKey[k] = { placements: 0, cooked: 0, live: 0, mats: new Map(), perPlacement: [] });
    K.placements++; if (L.userData.cooked) K.cooked++; else K.live++;
    const mine = new Set();
    L.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m) { mine.add(m.uuid); all.add(m.uuid); K.mats.set(m.uuid, (K.mats.get(m.uuid) || 0) + (mine.has(m.uuid) ? 0 : 1)); } });
    K.perPlacement.push(mine.size);
    K._sets = (K._sets || []).concat([mine]);
  }
  const out = {};
  for (const [k, K] of Object.entries(byKey)) {
    let own = 0; for (const s of K._sets) for (const u of s) if (K._sets.filter(t => t.has(u)).length === 1 && K.placements > 1) own++;
    out[k] = { placements: K.placements, cooked: K.cooked, live: K.live, materials: new Set([].concat(...K._sets.map(s => [...s]))).size, perPlacement: K.perPlacement, ownPerPlacement: own };
  }
  const log = (PK && PK.records) ? Object.fromEntries(Object.entries(PK.records).map(([k, r]) => [k, { cooked: !!(r && r.cooked), baked: !!(r && r.baked), t: r && r.t }])) : null;
  return { lods: lods.length, materials: all.size, byKey: out, L0: PK ? !!PK.L0 : null, records: log };
})()
