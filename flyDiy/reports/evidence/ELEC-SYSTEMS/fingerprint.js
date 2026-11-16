// usage: node fingerprint.js <flyDiy root>  -> one line per builds/*.json: certKey, sha(nodes/beams/params), mass, cgX, sys kg
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.resolve(process.argv[2]);
const LB = require(path.join(ROOT, 'tools/_load_build.js'));
const C = require(path.join(ROOT, 'tools/flight_core.js'));
const files = fs.readdirSync(path.join(ROOT, 'builds')).filter(f => f.endsWith('.json') && !f.endsWith('.edits.json')).sort();
for (const f of files) {
  try {
    const r = LB.loadBuild('builds/' + f);
    const def = C.buildGen(r.spec);
    const key = C.genCertKey(def);
    const sha = crypto.createHash('sha1').update(JSON.stringify([def.nodes, def.beams, def.params])).digest('hex').slice(0, 12);
    let m = 0, mx = 0; for (const n of def.nodes) { m += n.m; mx += n.m * n.p[0]; }
    const sys = C.genSystemsResolve(r.spec);
    console.log([f.padEnd(48), key, sha, m.toFixed(3), (mx / m).toFixed(4), sys.kg.toFixed(2), (r.errors || []).length].join('  '));
  } catch (e) { console.log(f.padEnd(48), 'ERROR', e.message.split('\n')[0]); }
}
