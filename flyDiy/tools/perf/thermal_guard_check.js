'use strict';
const assert=require('assert/strict'),guard=require('./thermal_guard'),p={stopC:90,peakC:94,sustainedMs:3000};
let s={};assert.equal(guard(92,0,s,p),null);assert.equal(guard(89,1000,s,p),null);assert.equal(guard(92,2000,s,p),null);assert.equal(guard(91,4000,s,p),null);assert.match(guard(90,5000,s,p),/sustained/);
assert.match(guard(94,0,{},p),/peak/);assert.match(guard(95,0,{},p),/peak/);assert.match(guard(87,0,{},{stopC:87}),/reached/);assert.equal(guard(86,0,{},{stopC:87}),null);
console.log('Thermal guard: brief spike, recovery/reset, sustained heat, hard peak and legacy immediate-stop checks passed.');
