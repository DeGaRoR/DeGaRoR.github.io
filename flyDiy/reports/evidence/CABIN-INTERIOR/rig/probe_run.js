process.env.FLYDIY_JOIN_PROBE = require("path").resolve(process.argv[2]); process.env.FLYDIY_HEADLESS_MS = '1';
const LB = require(process.cwd() + '/tools/_load_build.js');
for (const f of process.argv.slice(3)) { const r = LB.loadBuild(f); console.log('== ' + f); console.log(JSON.stringify(r.probe, null, 0)); }
