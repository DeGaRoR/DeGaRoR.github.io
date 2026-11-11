const LB = require('/workspace/pp-wt/flyDiy/tools/_load_build.js'), fs = require('fs');
const [key, file] = process.argv.slice(2);
try { const r = LB.loadBuild(file); if (typeof r.probe === 'string') throw new Error(r.probe);
  fs.writeFileSync(__dirname + '/p_' + key + '.json', JSON.stringify({ key, file, name: r.name, errors: r.errors, notes: r.notes, spec: r.spec, probe: r.probe })); console.log('ok', key, r.name);
} catch (e) { console.log('FAIL', key, e.message.slice(0, 200)); }
