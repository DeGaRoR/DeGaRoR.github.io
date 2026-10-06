#!/usr/bin/env node
// island_tour.js - THE ISLAND TOUR, RUN (ISLAND-TOUR, G1965-G1974): one build, the pilot, every location in one go,
// damage ON (tools/_tour_lib.js says how). Prints a line per leg; --json writes the whole record (legs + the track).
//   node tools/island_tour.js [--build cub|c172|floats|<file.json>] [--order HOME,w3,...] [--json out.json] [--md out.md] [--verbose]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const B = TR.BUILDS[opt('build', 'cub')] || { key: path.resolve(opt('build')), name: path.basename(opt('build')) };
const order = (opt('order', null) || TR.ORDERS[B.tour || 'land']).split(',');
const def = TR.defOf(C, PT, B.key);
const t0 = Date.now();
const TW = TR.tourWorld(C, IN, fs);
console.log('island_tour: ' + B.name + ' (span ' + def.params.gen.span.toFixed(2) + ' m), damage ' + (def.params.damage ? 'ON' : 'off') + ', ' + TW.obstacles + ' obstacles + ' + TW.trunks + ' trunks in the world; ' + order.join(' > '));
const R = TR.flyTour(C, TW.W, def, order, { debug: +opt('debug', 0), debugLeg: opt('debug-leg', null), log: L => { console.log(TR.fmtLeg(L)); if (argv.includes('--verbose')) console.log('    phases ' + L.phases.join('>') + '\n    verdicts ' + L.verdicts.join(' | ')); } });
console.log((R.done ? 'TOUR DONE' : 'TOUR NOT DONE') + ' - ' + R.legs.length + ' legs, fuel left ' + R.fuel + ' L, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall');
const out = opt('json', null);
if (out) fs.writeFileSync(out, JSON.stringify(Object.assign({ build: B.name, span: def.params.gen.span }, R)));
const md = opt('md', null);
if (md) fs.writeFileSync(md, '### ' + B.name + ': ' + order.join(' > ') + ' - ' + (R.done ? 'DONE' : 'NOT DONE') + ', fuel left ' + R.fuel + ' L\n\n' + TR.mdTable(R) + '\n');
process.exit(R.done ? 0 : 1);
