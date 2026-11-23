'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(process.argv[2]);
const read=p=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):null,m=read(path.join(root,'manifest.json'));
const runs=m.cases.map(c=>{const s=read(path.join(root,c.folder||c.id,'summary.json'));return {id:c.id,label:c.label,valid:!!(c.exitCode===0&&s?.bootHealth?.ok&&!s.errors.length&&!s.garage.glError&&!s.final.glError&&s.garage.clock.legacy===false),seconds:c.exitCode===0&&s?.bootHealth?.ok&&!s.errors.length?s.garage.t/1000:null,build:s?.garage.build,response:s?.garageResponsiveness,errors:s?.errors};});
const compiler=read(path.join(root,'compiler/results/results.json'));
const proof=read(path.join(root,'candidate/page-diagnostic.json'));
let visual=null;
if(proof?.ok){const v=proof.value;visual={scope:v.scope,cache:v.cache,row:v.row,pk:v.pk,micro:v.micro,gpu:v.gpu,glError:v.glError,cases:v.cases.map(c=>{const images={};for(const [name,b64]of Object.entries(c.images)){const file='way-'+c.wet+'-'+name+'.png';fs.writeFileSync(path.join(root,'candidate',file),Buffer.from(b64,'base64'));images[name]=file;}const {images:_,...stats}=c;return {...stats,images};})};fs.writeFileSync(path.join(root,'descriptors.json'),JSON.stringify(v.descriptors,null,2));}
fs.writeFileSync(path.join(root,'analysis.json'),JSON.stringify({protocol:m.protocol,runs,compiler:compiler?.runs.map(x=>({order:x.order,rows:x.rows.map(r=>({name:r.name,seconds:r.ms/1000,ok:r.ok,glError:r.glError}))})),visual,visualError:proof&&!proof.ok?proof.error:null,decision:'Prototype OFF. No isolated compiler improvement established in opposite orders. Integrated observations and image/GPU diagnostics must be assessed before further work.'},null,2));
console.log('Way-curve study: '+runs.filter(r=>r.valid).length+'/'+runs.length+' valid loading observations');
