// the look review's views (C3b, G858): r_village, the village road - each camera twice, unique then kit, the aeroplane
// hidden; the kit's finishes waited for (its slots all in the stack) before either capture
const H = "FLIGHT_PROBE.model().grp.visible=false";
const READY = "new Promise(res => { const t0 = performance.now(); const f = () => { const K = WORLD.premises && WORLD.premises.kit; if ((K && K.status === 'ready' && K.host && !K.host.waiting && K.found >= K.rows.filter(r => !r.out).length) || (K && K.status === 'error') || performance.now() - t0 > 120000) res(1); else setTimeout(f, 250); }; f(); })";
const REPORT = "(() => { const K = WORLD.premises.kit, h = K.host; return JSON.stringify({ mode: K.mode, shown: h && h.visible, status: K.status, err: K.err, rows: K.rows && K.rows.length, found: K.found, hidden: K.hide.size, looks: h && h.stats.looks, waiting: h && h.waiting, slotless: h && h.stats.slotless, rungs: h && h.rungs() }); })()";
const cams = [
  // along the street at eye height, looking north-west from its south-east end, then south-east from its north-west end
  { name: 'r1_street_nw', at: [610, -2600, 1.5], cam: [-0.769, 0.02, 132] },
  { name: 'r2_street_se', at: [560, -2585, 1.5], cam: [2.724, 0.03, 98] },
  // three-quarter views from a roof's height and from a low hill
  { name: 'r3_quarter_a', at: [620, -2615, 1], cam: [0.9, 0.35, 120] },
  { name: 'r4_quarter_b', at: [600, -2600, 1], cam: [-2.2, 0.45, 150] },
  // the street from above: the roofs' repetition
  { name: 'r5_overview', at: [620, -2620, 1], cam: [-0.8, 1.0, 380] },
];
const out = [];
for (const c of cams) for (const m of ['unique', 'kit'])
  out.push({ name: c.name + '_' + m, at: c.at, cam: c.cam, hour: 'noon', settle: 120,
    js: `(async () => { ${H}; await ${READY}; WORLD.premises.kitSet('${m}'); return 1; })()`, report: REPORT });
require('fs').writeFileSync(require('path').join(__dirname, 'kitab_views.json'), JSON.stringify(out, null, 1));
console.log(out.length + ' views');
