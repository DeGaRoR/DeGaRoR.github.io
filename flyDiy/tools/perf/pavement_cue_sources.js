'use strict';
// Compiler-only field-read surrogates keep downstream cue/material branches live.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),out=path.resolve(process.argv[3]);
const p=d.programs.find(p=>p.shaders.some(k=>d.sources[k].includes('bool paved = cls < 1.5')));if(!p)throw Error('No pavement source');
const [vs,original]=p.shaders.map(k=>d.sources[k]);
function endBrace(s,brace){let depth=1,line=false,comment=false;for(let i=brace+1;i<s.length;i++){const a=s[i],b=s[i+1];if(line){if(a==='\n')line=false;continue;}if(comment){if(a==='*'&&b==='/'){comment=false;i++;}continue;}if(a==='/'&&b==='/'){line=true;i++;continue;}if(a==='/'&&b==='*'){comment=true;i++;continue;}if(a==='{')depth++;if(a==='}'&&!--depth)return i;}throw Error('Unbalanced source');}
function replaceFunction(s,name,body){const r=new RegExp('(?:float|vec4) '+name+'\\([^)]*\\)\\s*\\{'),m=r.exec(s);if(!m)throw Error('Missing '+name);const b=s.indexOf('{',m.index),e=endBrace(s,b);return s.slice(0,b+1)+'\n'+body+'\n'+s.slice(e);}
const sampler='uniform highp sampler2D uBakedCueProbe;\n';
function injected(s){const marker='struct Smp { vec4 c; vec4 n; };';if(s.split(marker).length!==2)throw Error('Smp identity changed');return s.replace(marker,sampler+marker);}
const relief=s=>replaceFunction(replaceFunction(s,'pvBand','return texture2D(uBakedCueProbe, q * 0.01)[k0 == 4 ? 0 : 1];'),'pvRelief','return texture2D(uBakedCueProbe, vec2(u, v) * 0.01).z;');
const holes=s=>replaceFunction(s,'pvHoles','return texture2D(uBakedCueProbe, vec2(u, v) * 0.01);');
const ways=s=>replaceFunction(s,'pvWays','return texture2D(uBakedCueProbe, vec2(u, v) * 0.01);');
const base=injected(original),rows=[{name:'Original full runway cues',family:'Original',vs,fs:original},
 {name:'Relief and curvature fields read from cache — compiler surrogate',family:'Relief fields',vs,fs:relief(base)},
 {name:'Hole/hazard fields read from cache — compiler surrogate',family:'Hole fields',vs,fs:holes(base)},
 {name:'Track/way fields read from cache — compiler surrogate',family:'Way fields',vs,fs:ways(base)},
 {name:'All above shape fields cached — compiler surrogate',family:'All shape fields',vs,fs:ways(holes(relief(base)))}];
const start=original.indexOf('      if (uMicro2.w > 0.5 && !grassy) {');if(start<0)throw Error('Micro cue block missing');const brace=original.indexOf('{',start),end=endBrace(original,brace),block=original.slice(start,end+1);
const material='Smp pvCueMaterial(vec2 p, float layer) { Smp a; vec4 q = texture2D(uBakedCueProbe, p * 0.01 + layer * 0.1); a.c = q; a.n = vec4(normalize(q.xyz + vec3(0.0, 0.0, 0.1)), q.w); return a; }\n';
const mixed=block.replace(/pvSet\((1|3|4), uvS\)/g,(_,k)=>'pvCueMaterial(uvS, '+k+'.0)');if(mixed===block)throw Error('Micro texture calls missing');
rows.push({name:'Micro-cue material sampling precomposed — compiler surrogate',family:'Cue material sampling',vs,fs:injected(original.slice(0,start)+mixed+original.slice(end+1)).replace('struct Smp { vec4 c; vec4 n; };','struct Smp { vec4 c; vec4 n; };\n'+material)});
const fixed=block.replace(/clamp\(uPavWet, 0\.0, 1\.0\)/g,'0.0');
rows.push({name:'Fixed humidity colour/roughness only; live puddles — diagnostic',family:'Humidity appearance',vs,fs:original.slice(0,start)+fixed+original.slice(end+1)});
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({program:p.id,sourceIds:p.shaders,production:false,purpose:'Choose what to bake by measuring source interventions. Field-read surrogates are variable texture inputs, not zeros, so downstream texture/cue branches remain live. They do not include cache generation/lookup/memory costs and do not establish image correctness or full loading savings. Humidity diagnostic fixes only cue colour/roughness modulation; fillM/puddle water remain live.'},null,2));console.log('Prepared '+rows.length+' pavement compiler diagnostics');
