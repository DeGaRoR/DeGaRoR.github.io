// home_census.js - HOME-FRAME (G3087): WHAT OF THE SCENERY COSTS THE FRAME AT HOME, by knock-out, in one page.
// A0 (13 Oct): SCENERY-SHIP's rev 27 costs ~+2 ms of the frame loop at HOME (cub chase 16.5 -> 18.3 ms, render 11.8 ->
// 12.9) against train 50. The premises renderer's census at HOME says what grew: the fine ground patch along every road
// the user drew (54 -> 197 LOD blocks, 2.6 -> 5.4 M tris), the road batches (12 -> 66), the cable chunks drawn (37 ->
// 109), the cars posed and drawn (7 -> 32; a car's reach was its prop cull, ~3.6 km). This ranks them: with the flight
// paused at HOME (the premises' tick still runs - the cars still posed), each candidate is toggled in A B A B windows
// of WIN ms (the base and the change side by side, the same view), and per window the median of the frame's render CPU
// (every renderer.render), the loop's JS, the world update, and the draw calls / triangles of the frame (every render
// pass summed). Knock-outs marked (probe) are upper bounds only - not fixes (a hidden patch block is a hole).
// Usage (an --eval of tools/rollout_perf.js, GPU slot): node tools/rollout_perf.js --build builds/cub_2026-09-20_corrected.json
//   --cam chase --secs 6 --eval @tools/perf/home_census.js --eval-ms 240000 --label home_census --port 8701 --udd <dir>
(async () => {
  const W = window.WORLD, R = W && W.premises, RD = W && W.renderer, RP = window.__RP, PW = typeof POWERLINE !== 'undefined' ? POWERLINE : null;
  if (!R || !RD || !RP || !RP.fr) return { err: 'no world / premises / recorder' };
  const G = R.groups, WIN = 2500, SETTLE = 700;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  let calls = 0, tris = 0;
  if (!RD.__hc) { const rr = RD.render; RD.render = function () { const x = rr.apply(this, arguments); calls += RD.info.render.calls; tris += RD.info.render.triangles; return x; }; RD.__hc = 1; }
  const med = a => { const s = a.filter(x => x != null && x === x).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const window_ = async () => {
    const i0 = RP.fr.length, C = [], T = [], t0 = performance.now();
    while (performance.now() - t0 < WIN) { calls = 0; tris = 0; await raf(); if (calls > 0) { C.push(calls); T.push(tris); } }
    const rows = RP.fr.slice(i0);
    return { n: rows.length, render: med(rows.map(r => r[10])), loop: med(rows.map(r => r[2])), world: med(rows.map(r => r[5])), calls: med(C), mtris: med(T) == null ? null : +(med(T) / 1e6).toFixed(2) };
  };
  // the eye: the aircraft (paused at HOME); the patch's blocks and the roads' batches by their own bounding spheres
  const sim = window.FLIGHT_PROBE && window.FLIGHT_PROBE.sim(), cg = sim ? sim.cgPos() : [0, 0, 0];
  const far = (o, d) => { o.updateWorldMatrix && o.updateWorldMatrix(true, true);
    let c = null; o.traverse(m => { if (!c && m.geometry) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); const s = m.geometry.boundingSphere; c = s.center.clone().applyMatrix4(m.matrixWorld); } });
    return c ? Math.hypot(c.x - cg[0], c.z - cg[2]) > d : false; };
  const hide = (list) => { const was = list.map(o => o.visible); list.forEach(o => { o.visible = false; }); return () => list.forEach((o, i) => { o.visible = was[i]; }); };
  const patch = () => (G.ground ? G.ground.children.filter(c => c.isGroup || c.isLOD) : []);
  const patchBlocks = () => [].concat(...patch().map(p => p.children.filter(c => c.isLOD)));
  const roadBatches = () => { const out = []; if (G.roads) G.roads.traverse(o => { if (o.isMesh && o.parent && o.parent.userData && o.parent.userData.batch) out.push(o); }); return out; };
  const V = [
    ['cars capped at 1200 m', () => { R.trafficReach(1200); return () => R.trafficReach(0); }],
    ['cars capped at 600 m', () => { R.trafficReach(600); return () => R.trafficReach(0); }],
    ['cars none (probe)', () => { R.trafficReach(1); return () => R.trafficReach(0); }],
    ['cables reach 1200 m', () => { if (!PW) return null; PW.set({ reach: 1200 }); return () => PW.set({ reach: 1200 }); }],
    ['cables none (probe)', () => { if (!PW) return null; PW.set({ reach: 1 }); return () => PW.set({ reach: 1200 }); }],
    ['patch blocks > 3 km hidden (probe)', () => hide(patchBlocks().filter(b => far(b, 3000)))],
    ['patch all hidden (probe)', () => hide(patch())],
    ['road batches > 3 km hidden (probe)', () => hide(roadBatches().filter(m => far(m, 3000)))],
    ['roads + poles + cables all hidden (probe)', () => (G.roads ? hide([G.roads]) : null)],
  ];
  const out = { at: [+cg[0].toFixed(0), +cg[2].toFixed(0)], stats: Object.assign({}, R.stats, { steps: undefined }), patchBlocks: patchBlocks().length, roadBatches: roadBatches().length, rows: [] };
  const pb = document.getElementById('bPause'), wasRunning = pb && /Pause/.test(pb.textContent);
  if (pb && wasRunning) { pb.click(); await sleep(1000); }
  await sleep(SETTLE);
  out.base = await window_();
  for (const [name, on] of V) {
    const A = [], B = [];
    for (let k = 0; k < 2; k++) {
      await sleep(SETTLE); A.push(await window_());
      const off = on(); if (!off) { B.push(null); break; }
      await sleep(SETTLE); B.push(await window_()); off();
    }
    if (B[0] === null) { out.rows.push({ name, skipped: true }); continue; }
    const m = (L, k) => med(L.map(x => x && x[k]));
    out.rows.push({ name, base: { render: m(A, 'render'), loop: m(A, 'loop'), world: m(A, 'world'), calls: m(A, 'calls'), mtris: m(A, 'mtris') },
      knock: { render: m(B, 'render'), loop: m(B, 'loop'), world: m(B, 'world'), calls: m(B, 'calls'), mtris: m(B, 'mtris') } });
  }
  if (pb && wasRunning) pb.click();
  out.table = out.rows.filter(r => !r.skipped).map(r => r.name.padEnd(36) + ' render ' + r.base.render + ' -> ' + r.knock.render + '  loop ' + r.base.loop + ' -> ' + r.knock.loop + '  world ' + r.base.world + ' -> ' + r.knock.world + '  calls ' + r.base.calls + ' -> ' + r.knock.calls + '  Mtris ' + r.base.mtris + ' -> ' + r.knock.mtris);
  return out;
})()
