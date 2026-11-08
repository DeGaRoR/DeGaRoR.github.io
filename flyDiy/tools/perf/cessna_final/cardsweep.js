// node tools/perf/cessna_final/cardsweep.js <core.js> <out.json> - CESSNA-FINAL: every ARCHETYPES card BORN (designBake
// through the load door's birth envelope, as the new-aeroplane chooser hands it over - real_check's loadSpec), built by
// <core.js>: empty, all-up, CG x, node / member counts, the hash of what the solver flies, and the born cage's noseBody
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..', '..'), T = path.join(ROOT, 'tools');
const [coreF, outF] = process.argv.slice(2, 4);
process.env.FLYDIY_CORE = path.resolve(coreF);
const L = require(path.join(T, '_treecrash_lib.js')), C = L.core();
const LB = require(path.join(T, '_load_build.js')), BJ = require(path.join(T, '_bake_joined.js'));
const { D } = BJ.loadPanel();
const out = {};
for (const a of D.ARCHETYPES) {
  try {
    const born = D.designBake(a.sel, a.over);
    const r = LB.gameSpecFull({ birth: 1, spec: born });
    const def = C.buildGen(JSON.parse(JSON.stringify(r.spec)));
    const led = def.parts && def.parts.ledger || {};
    let E = 0; for (const k in led) if (!led[k].payload) E += led[k].mass;
    let M = 0, cx = 0; for (const n of def.nodes) { M += n.m; cx += n.m * n.p[0]; }
    const h = crypto.createHash('sha1');
    for (const n of def.nodes) h.update(n.p.map(v => v.toFixed(6)).join(',') + ':' + n.m.toFixed(6) + ';');
    for (const b of def.beams) h.update(b.a + '-' + b.b + ':' + (+b.k).toPrecision(9) + ':' + (+(b.A || 0)).toPrecision(9) + ';');
    out['card:' + a.key] = { empty: +E.toFixed(3), mass: +M.toFixed(3), cgX: +(cx / M).toFixed(4), n: def.nodes.length, nb: def.beams.length,
      hash: h.digest('hex').slice(0, 16), mat: r.spec.fuselage && r.spec.fuselage.material, susp: r.spec.gear && r.spec.gear.suspension,
      seats: r.spec.cabin && r.spec.cabin.seats, seatsX: r.spec.cabin && r.spec.cabin.seatsX ? r.spec.cabin.seatsX.length : null,
      noseBody: born.cage && born.cage.noseBody || 0, noseSec: r.spec.fuselage && r.spec.fuselage.noseSec || null };
  } catch (e) { out['card:' + a.key] = { err: String(e.message || e).slice(0, 200) }; }
}
fs.writeFileSync(outF, JSON.stringify(out, null, 1));
console.log(Object.keys(out).length + ' cards -> ' + outF + ' (' + Object.values(out).filter(o => o.err).length + ' errors)');
