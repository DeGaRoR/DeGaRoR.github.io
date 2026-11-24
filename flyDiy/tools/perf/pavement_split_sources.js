'use strict';
// Compiler-only diagnosis: can hard/soft surface families be compiled separately?
// No renderer changes, scene edits or feature removal are applied here.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const input=process.argv[2],out=path.resolve(process.argv[3]);if(!input)throw Error('Captured programs.json.gz and output directory required');
const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(input))),needle='bool paved = cls < 1.5';
const program=d.programs.find(p=>p.shaders.some(k=>d.sources[k].includes(needle)));
if(!program)throw Error('No identified pavement source');
const [vs,fragment]=program.shaders.map(k=>d.sources[k]);
if(fragment.split(needle).length!==2)throw Error('Ambiguous hard/soft selector');
const rows=[{name:'pavement-original',vs,fs:fragment},...[[true,'hard'],[false,'soft']].map(([value,name])=>({name:'pavement-'+name+'-only-DIAGNOSTIC',vs,fs:fragment.replace(needle,'bool paved = '+value)}))];
const micro='if (uMicro2.w > 0.5 && !grassy)';
if(fragment.split(micro).length!==2)throw Error('Ambiguous runway micro-relief block');
rows.push({name:'pavement-no-micro-relief-DIAGNOSTIC',vs,fs:fragment.replace(micro,'if (false)')});
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));fs.writeFileSync(path.join(out,'sources-reverse.json'),JSON.stringify([...rows].reverse()));
fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({source:input,program:program.id,sourceIds:program.shaders,change:'Hard/soft cases change only paved to a constant. The separate no-micro case replaces only the uMicro2.w && !grassy block condition with false.',production:false,limits:'Isolated compiler timings, not loading savings. Runtime integration would require correct material assignment and unchanged overlap/alpha draw order.'},null,2));
console.log('Prepared four pavement compiler variants: original, hard, soft and no micro shader cues');
