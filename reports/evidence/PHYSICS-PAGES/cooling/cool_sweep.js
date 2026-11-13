// every card through the load door: the cooling block, the page desktop + phone 320, the checks
const path = require('path'), fs = require('fs'), FLY = process.cwd();
const C = require(path.join(FLY, 'tools/flight_core.js')), LB = require(path.join(FLY, 'tools/_load_build.js')), FP = require(path.join(FLY, 'src/viewer/fiche_physics.js'));
const files = process.argv.slice(3), outF = process.argv[2], res = [];
const textEdges = (out, w) => { const bad = [];
  const flat = out.replace(/<g transform="translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)">([\s\S]*?)<\/g>/g, (all, dx, dy, sc, inner) => inner.replace(/<text x="(-?[\d.]+)" y="(-?[\d.]+)" font-size="([\d.]+)"/g, (t, x, y, sz) => `<text x="${(+dx + sc * x).toFixed(1)}" y="${(+dy + sc * y).toFixed(1)}" font-size="${(sc * sz).toFixed(2)}"`));
  for (const m of flat.matchAll(/<text x="(-?[\d.]+)" y="[^"]*" font-size="([\d.]+)"([^>]*)>([^<]*)<\/text>/g)) { const x = +m[1], sz = +m[2], a = (m[3].match(/text-anchor="(\w+)"/) || [])[1], L = m[4].replace(/&[a-z]+;/g, 'x').length * sz * 0.5;
    const [l, r] = a === 'end' ? [x - L, x] : a === 'middle' ? [x - L / 2, x + L / 2] : [x, x + L]; if (l < -1 || r > w + 1) bad.push(m[4]); }
  return bad; };
for (const f of files) {
  const row = { f };
  try {
    const r = LB.loadBuild(f); if (typeof r.probe === 'string') throw new Error(r.probe);
    const def = C.buildGen(r.spec), Cd = C.genFicheCooling(def), S = def.spec;
    const D = { model: C.genFicheModel(def), drag: C.genFicheDrag(def), cooling: Cd };
    row.kind = Cd && Cd.kind; row.path = Cd && Cd.path; row.pushes = Cd && Cd.pushes; row.nEng = Cd && Cd.nEng; row.layout = Cd && Cd.layout;
    row.mounts = (S.engAt || []).map(e => e && e.mount).join('+'); row.parts = Cd && Cd.parts ? Cd.parts.map(p => p.what.replace(/^the /, '') + ':' + p.faces).join(', ') : '';
    row.hot = Cd && Cd.cases && Cd.cases.hot ? Cd.cases.hot.margin : null; row.radA = Cd && Cd.radA; row.duct = Cd && Cd.duct;
    for (const [nm, o] of [['desk', {}], ['phone', { layout: { screen: 'phone', theme: 'dark', w: 320 } }]]) {
      const svg = FP.svg('cooling', D, Object.assign({ name: path.basename(f), sig: 'Wingsmith' }, o));
      row[nm] = { ok: /^<svg /.test(svg) && !/NaN|undefined|Infinity/.test(svg), past: nm === 'phone' ? textEdges(svg, 320).slice(0, 3) : [] };
      fs.writeFileSync(outF.replace(/\.json$/, '') + '_' + path.basename(f).replace(/\W+/g, '_') + '_' + nm + '.svg', svg);
    }
  } catch (e) { row.err = String(e && e.message || e).slice(0, 160); }
  res.push(row); console.log(JSON.stringify(row).slice(0, 300));
}
fs.writeFileSync(outF, JSON.stringify(res, null, 1));
