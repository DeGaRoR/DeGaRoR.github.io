#!/usr/bin/env node
// cold_links_src.js - THE HEAVY WORLD PROGRAMS' SOURCES, OUT OF THE PAGE IN NODE (COLD-LINKS, G1310): reads
// lc_keyprobe.js's --out file made with LC_SRC=full (every program three made in the one loading, its vertex and
// fragment source as the driver gets them) and writes the programs cold_links_bench.js links: the ground's rings
// (island-ring / -outer / -outer-dry / -fine), the premises patch (premises-patch-*), the pavement and the water - by
// the last field of three's cache key (the material's customProgramCacheKey) or the program's name. A source made
// twice is written once (the bench links what the driver would have to link, not three's keys).
//   LC_SRC=full PAGE_FALLBACK=<checkout> node tools/perf/lc_keyprobe.js --build <build.json> --out kp.json
//   node tools/perf/cold_links_src.js kp.json progs.json
'use strict';
const fs = require('fs');
const [IN, OUT] = process.argv.slice(2);
if (!IN || !OUT) { console.error('cold_links_src: <keyprobe.json> <out.json>'); process.exit(2); }
const J = JSON.parse(fs.readFileSync(IN, 'utf8'));
const WANT = /^(island-|premises-patch-|pavement:)/;
const out = [], seen = new Map();
for (const p of J.progs) {
  if (!p.srcText) continue;
  const k = p.key.split(','), tag = k[k.length - 1];
  const name = WANT.test(tag) ? tag : (p.name === 'water' ? 'water' : null);
  if (!name) continue;
  const [vs, fs2] = p.srcText.split(' //---- ');
  if (seen.has(p.srcText)) { console.log('  same source as ' + seen.get(p.srcText) + ': ' + name + ' (' + p.mark + ')'); continue; }
  const nm = out.some(o => o.name === name) ? name + '#' + out.filter(o => o.name.startsWith(name)).length : name;
  seen.set(p.srcText, nm);
  out.push({ name: nm, mark: p.mark, vs, fs: fs2 });
  console.log('  ' + nm.padEnd(34) + ' ' + p.mark.padEnd(18) + ' vs ' + vs.length + ' fs ' + fs2.length);
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('cold_links_src: ' + out.length + ' programs -> ' + OUT);
