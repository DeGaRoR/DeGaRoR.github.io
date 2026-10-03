// record HOME's pattern, its sampler's answers and the ground heights, so a browser page can replay them
const path = require('path'), fs = require('fs');
const ROOT = process.argv[2];
global.THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const CORE = require(path.join(ROOT, 'tools', 'flight_core.js'));
const { buildPatternVis } = require(path.join(ROOT, 'src', 'viewer', 'pattern_vis.js'));
const world = CORE.makeWorld(), home = world.aerodromes.find(a => a.id === 'HOME');
const pat = CORE.sitePattern(home, CORE.siteOf(home.id));
const samples = {}, H = {};
const pp = (P, ids, step) => { const k = JSON.stringify([ids, step]); const r = CORE.patternPath(P, ids, step); samples[k] = { pts: r.pts.map(q => ({ x: q.x, z: q.z, hdg: q.hdg })) }; return samples[k]; };
const gy = (x, z) => { const k = x.toFixed(2) + ',' + z.toFixed(2); return H[k] = world.terrainH(x, z); };
buildPatternVis(THREE, pat, gy, { patternPath: pp, aero: home });
fs.writeFileSync('/tmp/claude-0/ev/comp/data.js', 'window.REC = ' + JSON.stringify({ pat, home: JSON.parse(JSON.stringify(home)), samples, H }) + ';');
console.log('recorded', Object.keys(samples).length, 'routes', Object.keys(H).length, 'heights', 'elev', home.elev, 'xz', home.x, home.z, 'hdg', home.hdg);
