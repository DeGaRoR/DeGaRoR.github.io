// _mass_stations.js (G457) — WHERE A BUILD'S MASS SITS, section by section.
//
//   node tools/_mass_stations.js [builds/x.json] [--nodes fuselage outfit ...]
//
// Reads the ledger's mass and moment per section (61_gen_frame `mx`, the
// same numbers the plaque's empty CG is read from) and prints each section's
// centroid in metres aft of the windscreen base and in % of MAC, then the
// empty and loaded totals against the plaque and the neutral point. With
// --nodes it rebuilds under GEN_MASS_TRACE and lists the named sections by
// 0.25 m station with the node tags that carry them — the instrument that
// found the 172's fuel on the front spar alone, its baggage a bay behind
// the box, its paint on the tail and its cowl on the windscreen base.
const C = require('./flight_core.js');
const f = process.argv[2];
const spec = f ? require(require('path').resolve(f)).spec : C.GEN_DEFAULT;
const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
const sh = C.genShakedown(def, { slim: true });
const L = def.parts.ledger;
const pc = x => ((x - sh.xLEmac) / sh.cBar * 100).toFixed(1).padStart(6);
let tm = 0, tmx = 0, em = 0, emx = 0;
const rows = Object.entries(L).sort((a, b) => b[1].mass - a[1].mass);
console.log('section'.padEnd(10), 'kg'.padStart(7), '  x m', '  %MAC', ' payload');
for (const [k, e] of rows) {
  if (!(e.mass > 0)) continue;
  const x = e.mx / e.mass;
  console.log(k.padEnd(10), e.mass.toFixed(1).padStart(7), x.toFixed(2).padStart(6), pc(x), e.payload ? '   yes' : '');
  tm += e.mass; tmx += e.mx; if (!e.payload) { em += e.mass; emx += e.mx; }
}
console.log('EMPTY'.padEnd(10), em.toFixed(1).padStart(7), (emx / em).toFixed(2).padStart(6), pc(emx / em), ' | plaque empty', pc(sh.cgEmptyX));
console.log('LOADED'.padEnd(10), tm.toFixed(1).padStart(7), (tmx / tm).toFixed(2).padStart(6), pc(tmx / tm), ' | plaque', pc(sh.cgX), ' NP', pc(sh.xNP != null ? sh.xNP : sh.cgX + sh.staticMargin * sh.cBar), ' margin', (sh.staticMargin * 100).toFixed(0));
console.log('LE mac', sh.xLEmac.toFixed(2), 'cBar', sh.cBar.toFixed(2), 'boxRear', def.spec.fuse && def.spec.fuse.boxRear, 'firewall x', def.spec.fuse && def.spec.fuse.xFirewall);
if (process.argv.includes('--nodes')) {
  // per-section node histogram: 0.25 m bins along x, tags named
  globalThis.GEN_MASS_TRACE = true;
  const d2 = C.buildGen(JSON.parse(JSON.stringify(spec)));
  for (const s of process.argv.slice(3).filter(a => !a.startsWith('--'))) {
    const e = d2.parts.ledger[s]; if (!e || !e.nodeM) continue;
    const bins = {};
    for (const [i, dm] of e.nodeM) { const x = d2.nodes[i].p[0]; const b = (Math.floor(x / 0.25) * 0.25).toFixed(2); (bins[b] = bins[b] || { m: 0, tags: {} }); bins[b].m += dm; bins[b].tags[d2.nodes[i].tag] = (bins[b].tags[d2.nodes[i].tag] || 0) + dm; }
    console.log('\n' + s + ' by station (x m: kg  tags)');
    for (const b of Object.keys(bins).sort((a, c) => +a - +c)) {
      const T = Object.entries(bins[b].tags).sort((a, c) => c[1] - a[1]).slice(0, 6).map(([t, m]) => t + ' ' + m.toFixed(1)).join(', ');
      console.log(b.padStart(6), bins[b].m.toFixed(1).padStart(7), ' ', T);
    }
  }
}
