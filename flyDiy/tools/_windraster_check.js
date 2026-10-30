'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),css=fs.readFileSync(path.join(__dirname,'../src/viewer/flight.css'),'utf8');
const rule=css.match(/#ui \.rd b \.windA \{([^}]+)\}/);assert(rule,'wind arrow style exists');
const actual=Object.fromEntries(rule[1].split(';').filter(x=>x.trim()).map(x=>x.split(':').map(v=>v.trim())));
const geometry={display:'inline-block',width:'18px',height:'18px','margin-right':'4px','vertical-align':'2px',fill:'none',stroke:'currentColor','stroke-width':'2.2','stroke-linecap':'round','stroke-linejoin':'round','transform-origin':'50% 50%'};
assert.strictEqual(actual['will-change'],'transform','the rotating arrow keeps its compositor hint');delete actual['will-change'];assert.deepStrictEqual(actual,geometry,'hint changes no pixel geometry, paint or placement property');
assert(/#ui \.rd b \.windA\.calm \{ visibility:hidden; \}/.test(css),'calm behavior retained');
console.log('GATE WINDRASTER: PASS');
