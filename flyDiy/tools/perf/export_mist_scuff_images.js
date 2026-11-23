'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(process.argv[2]),m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))),index=[];
for(const c of m.cases){
 const folder=path.join(root,c.folder||c.id),file=path.join(folder,'page-diagnostic.json');if(!fs.existsSync(file))continue;
 const d=JSON.parse(fs.readFileSync(file)),v=d.value||d.partial;if(!v)continue;
 const images=[];
 for(const r of v.mistViews||[]){const name='mist-'+r.view+'.jpg';fs.writeFileSync(path.join(folder,name),Buffer.from(r.imageJPEG,'base64'));images.push({name,view:r.view,eye:r.eye});}
 for(const r of v.scuffImages||[]){if(!r.parity.channels||!r.activationVerified)continue;for(const [key,label]of [['oldMudOff','original'],['specialized','optimized'],['general','general-with-mud'],['intact','intact']]){const name='scuff-'+r.finish+'-'+label+'.png';fs.writeFileSync(path.join(folder,name),Buffer.from(r.images[key],'base64'));images.push({name,finish:r.finish,method:label});}}
 index.push({id:c.id,folder:c.folder||c.id,visualSetup:v.visualSetup,images,scuffQualityError:v.scuffQualityError,scuff:v.scuffImages?.map(({images,...r})=>r),scope:v.scuffQualityScope});
}
fs.writeFileSync(path.join(root,'image-index.json'),JSON.stringify(index,null,2));console.log(index.map(c=>({case:c.id,images:c.images.length,error:c.scuffQualityError})));
