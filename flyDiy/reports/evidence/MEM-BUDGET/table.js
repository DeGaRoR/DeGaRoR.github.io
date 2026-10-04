// node table.js a.json b.json ... : per milestone the most backing stores (MB) the step's rows reached
const files = process.argv.slice(2);
const M = [['reading the island', /reading the island/], ['reading the model', /reading the model/], ['the garage up (workshop / stand)', /opening the workshop|your aeroplane on the stand|raising the shed/],
  ['world: island ground .. ground colour', /island ground|ground colour|ground bake/], ['world: ring .. fill', /: ring|ground materi|rivers|water|fill|biomes/],
  ['world: premises made .. patch block', /premises made|patch ground|patch block/], ['world: lots .. ground under', /: lots|roads|paved|pavement|houses|ground under/],
  ['world: far terrain sink, meadows', /far terrain|meadows/], ['building the field', /building the field/], ['parking the other aeroplanes', /parking the other/],
  ['growing the forest', /growing the forest/], ['the world settling', /the world settling/], ['baking / your aeroplane, built', /committing|baking your|your aeroplane, built|certificate/],
  ['pictures, upload, compile, first light', /pictures|uploading the textures|compiling|first light|shaders/]];
const rows = files.map(f => require(require('path').resolve(f)));
const pad = (s, n) => String(s).padEnd(n);
console.log('| step | ' + files.map(f => require('path').basename(f, '.json')).join(' | ') + ' |'); console.log('|---|' + files.map(() => '---:').join('|') + '|');
for (const [name, rx] of M) console.log('| ' + name + ' | ' + rows.map(o => { const v = o.rows.filter(r => rx.test(String(r[1])) && r[3] > 0).map(r => r[3]); return v.length ? Math.round(Math.max(...v)) : '-'; }).join(' | ') + ' |');
console.log('| PEAK (no GC, the run) | ' + rows.map(o => Math.round(o.peakAB)).join(' | ') + ' |');
console.log('| after the load + a full GC | ' + rows.map(o => o.afterGC && o.afterGC.ab ? Math.round(o.afterGC.ab) : '-').join(' | ') + ' |');
