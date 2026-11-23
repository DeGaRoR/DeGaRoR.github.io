'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.resolve(process.argv[2]);
const read = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const s = read('candidate/summary.json');
const gpu = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'candidate/programs.json.gz'))));
const thermal = fs.readFileSync(path.join(root, 'candidate/thermal.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const last = thermal.findLast(x => 'completed' in x);
const a = s.garage.bakeAudit;
const valid = !!(last?.completed && last.code === 0 && !thermal.some(x => x.abort) &&
 s.bootHealth?.ok && !s.errors.length && !s.garage.glError && !s.final.glError &&
 s.garage.clock.legacy === false && s.garageSoak.length >= 18 &&
 !gpu.programQueryErrors.length && a.refineHeightReuse && a.polyQueries.enabled);
const result = { valid, build:s.garage.build, seconds:valid?s.garage.t/1000:null,
 peakC:last.peakC, query:s.query, clock:s.garage.clock, stages:Object.fromEntries(s.garage.boot.log.filter(x=>x.k==='step').map(x=>[x.id,x.ms/1000])),
 programQueryErrors:gpu.programQueryErrors, garageResponsiveness:s.garageResponsiveness,
 bakeAudit:a, sceneryAudit:s.garage.sceneryAudit, pageWarnings:s.pageErrors,
 scope:'Single combined native startup smoke test on a later build. No isolated or cumulative loading-saving estimate; no departure/FPS or full-map visual acceptance. Both flags remain OFF by default.' };
fs.writeFileSync(path.join(root,'analysis.json'),JSON.stringify(result,null,2));
if(!valid)process.exitCode=1;
console.log(JSON.stringify({valid,seconds:result.seconds,peakC:result.peakC}));
