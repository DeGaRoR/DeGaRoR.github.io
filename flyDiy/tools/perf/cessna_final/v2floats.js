// node v2floats.js <out.json> [fltMass=<kg a float>] - the floats V2-172: the land V2's file + the float rows of
// G3390's 172R-on-Wipline-2350 (tools/fixtures/test_copies/c172r_wipline2350_stcprop_2026-10-20.json), nothing else
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/cessna172r_2026-11-08.json'), 'utf8'));
const F = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/fixtures/test_copies/c172r_wipline2350_stcprop_2026-10-20.json'), 'utf8'));
const c = L.spec.cage, fc = F.spec.cage, took = [];
for (const k of Object.keys(fc)) if (/^flt/.test(k) || ['gearFloats', 'finVentralZ', 'finVentralTip', 'cw_propD'].includes(k)) { c[k] = fc[k]; took.push(k); }
L.spec.gear = Object.assign({}, L.spec.gear, { type: F.spec.gear.type, floats: F.spec.gear.floats });
L.spec.prop = Object.assign({}, L.spec.prop, { D: F.spec.prop.D, pitch: F.spec.prop.pitch });
for (const a of process.argv.slice(3)) { const [k, v] = a.split('='); c[k] = +v; took.push(k + '=' + v); }
fs.writeFileSync(process.argv[2], JSON.stringify(L));
console.log(path.basename(process.argv[2]) + ': ' + took.length + ' float rows (' + took.filter(k => !/^flt/.test(k)).join(', ') + ' + flt*), gear ' + L.spec.gear.type + ', prop ' + L.spec.prop.D + ' ' + L.spec.prop.pitch);
