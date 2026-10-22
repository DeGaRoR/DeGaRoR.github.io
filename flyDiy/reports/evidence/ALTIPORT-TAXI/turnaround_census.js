// the turn-around census: every Jolene land strip x every validated build x poses on the centreline facing an end
// (where a landing stops: 15..150 m from the end it faces), the planner's own departure plan (makePilot + departFrom +
// one update: DEPART's planDeparture) with the island's obstacles in the world -> the plan, its swept clearance
const path = require('path'), fs = require('fs');
const T = process.env.ROOT_T || require('path').join(__dirname, '..', '..', '..', 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const TL = require(path.join(T, '_taxiclear_lib.js'));
const TW = TR.tourWorld(C, IN, fs); const W = TW.W; const I = TL.index(TW.shapes);
const ROOT = path.join(T, '..');
const builds = [['cub', 'builds/cub_2026-09-20_corrected.json'], ['jodel', 'builds/jodel_2026-09-20_corrected.json'], ['c172m', 'bugReports/cessnaMetal (1).json']];
const strips = (process.argv[2] || 'tw_ski,w3,mn_strip,nv_strip,HOME,w2').split(',');
const rows = [];
for (const [bk, bf] of builds) {
  const spec = PT.specOf(path.join(ROOT, bf)).spec;
  const def = C.buildGen(C.genMigrateSpec(spec)); const half = def.params.gen.span / 2, Rg = C.groundRmin(def, 0.85);
  for (const id of strips) {
    const a = W.aerodromes.find(q => q.id === id); if (!a || a.water) continue;
    const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
    for (const sg of [1, -1]) for (const dEnd of [15, 25, 33, 45, 60, 90, 150]) {
      if (dEnd > a.len - 20) continue;
      const s = sg * (a.len / 2 - dEnd), x = a.x + ux * s, z = a.z + uz * s, hdg = Math.atan2(sg * uz, sg * ux);
      const sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
      C.placeAtStand(sim, a, { x, z, hdg, elev: W.terrainH(x, z) }); if (C.seatOnGround) C.seatOnGround(sim, (p, q) => W.terrainH(p, q), def.refs);
      const ap = C.makePilot(sim, def, W, { style: 'normal' });
      const other = W.aerodromes.find(q => q.id !== id && !q.water);
      ap.departFrom(a, other); ap.update(1 / 60);
      const P = ap.path;
      let w = { d: Infinity };
      if (P && P.pts) for (const q of P.pts) { const n = I.nearest(q.x, q.z, 40); const d = n ? n.d : Infinity; if (d < w.d) w = { d, what: TL.fmtWhat(n.s) }; }
      const tight = P && P.pts ? Math.min(...P.pts.filter(q => Math.abs(q.kap) > 1e-6).map(q => 1 / Math.abs(q.kap)), Infinity) : null;
      const v = ap.report.verdicts.map(q => q.code).join(',');
      rows.push({ b: bk, id, end: sg > 0 ? 'end+' : 'end-', dEnd, phase: ap.phase, path: P ? P.ids.join('>') : '-', rMin: tight, need: half + 3, cl: w.d, what: w.what, pivAt: ap.pivAt ? (ap.pivAt.turn ? 'TURN ' : 'keep ') + JSON.stringify(ap.pivAt.route) + ' / ' + JSON.stringify(ap.pivAt.pose) : '', Rg });
    }
  }
}
for (const r of rows) console.log([r.b, r.id, r.end, r.dEnd, r.phase, 'rMin ' + (r.rMin != null ? r.rMin.toFixed(1) : '-') + '/Rg ' + r.Rg.toFixed(1), 'centreline ' + (isFinite(r.cl) ? r.cl.toFixed(1) : 'inf') + ' (need ' + r.need.toFixed(2) + ') ' + (r.what || ''), r.path, r.pivAt].join(' | '));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
