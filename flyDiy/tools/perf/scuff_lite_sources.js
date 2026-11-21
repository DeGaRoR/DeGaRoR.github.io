'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),S=require('../../src/viewer/skin_scuff'),input=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),out=path.resolve(process.argv[3]);
const rows=[],seen=new Set();
for(const p of input.programs){const shaders=p.shaders.map(k=>input.sources[k]),vs=shaders.find(s=>s.includes('gl_Position')),s=shaders.find(s=>s.includes('gl_FragColor')||s.includes('pc_fragColor'));if(!s?.includes('#define DMG_SCUFF 1'))continue;const kind=s.includes(S.AERO_DMG_GLASS_FS)?'Window cracks':s.includes(S.AERO_DMG_SURF_FS)?'Surface damage':null;if(!kind||seen.has(kind))continue;
 if(!vs||s.split(S.AERO_DMG_FS_PARS).length!==2)throw Error('Expected exact damage library '+p.id);
 const share=s.replace('uniform sampler2D tGrunge;','').replace('uniform sampler2D tDmgG;','uniform sampler2D tGrunge;\n#define tDmgG tGrunge').replace('#define GD_OFF 1','// Computed mud retained');
 const fullPars=S.AERO_DMG_FS_PARS.replace('uniform sampler2D tDmgG;','uniform sampler2D tGrunge;\n#define tDmgG tGrunge'),cut=fullPars.indexOf(kind==='Window cracks'?'float dmgH2(':'// cells in 3-D:');if(cut<0||!share.includes(fullPars))throw Error('Shared library anchor '+p.id);
 let lite=share.replace(fullPars,fullPars.slice(0,cut));if(kind==='Surface damage')lite=lite.replace(S.AERO_DMG_SURF_FS,S.AERO_DMG_SURF_LITE_FS);
 for(const [label,source]of [['Original (mud workaround)',s],['Full detail + shared mud',share],['Simplified + shared mud',lite]])rows.push({name:kind+' / '+label,family:kind,vs,fs:source,program:p.id});seen.add(kind);
}
if(!seen.has('Surface damage')||!seen.has('Window cracks'))throw Error('Missing captured surface/window family');
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({input:process.argv[2],scope:'Complete captured original game shader pairs. Exact damage-library/body substitutions only; all other shader text remains. Compiler/sampler check, not rendered/GPU-frame/loading savings. Window crack body unchanged; its unused surface helpers are removed.',rows:rows.map(r=>({name:r.name,program:r.program,chars:r.fs.length}))},null,2));console.log(rows.map(r=>({name:r.name,chars:r.fs.length})));
