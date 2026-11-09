// scores.js <flyDiy tree> <evidence dirs comma>: the report's own loading (shape passes merged, later folders win), scored
const [root, dirs] = process.argv.slice(2); process.chdir(root);
const fs = require('fs'), path = require('path');
const RC = require(root + '/tools/real_check.js'), RR = require(root + '/tools/real_report.js');
const by = {}, shapes = {};
for (const d of dirs.split(',')) { const D = path.join(root, 'reports/evidence', d); if (!fs.existsSync(D)) continue;
  for (const f of fs.readdirSync(D)) { if (!f.endsWith('.json')) continue; let o; try { o = JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); } catch (e) { continue; }
    if (!o || !o.key || !o.cases) continue; if (f.endsWith('.shape.json')) shapes[o.key] = o; else by[o.key] = o; } }
for (const k in shapes) { if (by[k]) { if (shapes[k].shape) by[k].shape = shapes[k].shape; } else by[k] = shapes[k]; }
const out = {};
for (const k in by) { const o = by[k]; try { o.verdicts = RC.verdicts(o); const s = RR.scorePlane(o);
  out[k] = { O: s.overall, P: s.performance, G: s.geometry, S: s.specs, conf: s.confidence, v: o.verdicts.map(v => [v.k, v.src, v.ours && v.ours.map(x => +(+x).toFixed(1)), v.verdict]) };
  } catch (e) { out[k] = { err: e.message.slice(0, 80) }; } }
console.log(JSON.stringify(out));
