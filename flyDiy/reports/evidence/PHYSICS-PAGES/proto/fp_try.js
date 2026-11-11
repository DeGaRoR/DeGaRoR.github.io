// render the four pages with the module, frames fitted by its own fitFrame on the fiche pictures' alpha
const fs=require('fs'), FP=require('/workspace/pp-wt/flyDiy/src/viewer/fiche_physics.js');
const FI='/workspace/pp-wt/flyDiy/media/fiches/', IX=JSON.parse(fs.readFileSync(FI+'index.json')).fiches;
const P={cub:['design:cub','design_cub','cub_2026_09_20_corrected_json'],c172:['list:5','list_5','cessna172_2026_09_20_json'],twin:['cand:Twin_busher_floats_4b.json','cand_Twin_busher_floats_4b.json','Twin_busher_floats_4b_json']};
const SHAPE={cub:{side:[228,583],plan:[583,900]},c172:{side:[210,675],plan:[675,900]},twin:{side:[289,628],plan:[628,900]}};
function pics(k){ const [key,dir,f]=P[k], s=IX[key].data.pxPerM, D=JSON.parse(fs.readFileSync(__dirname+'/pages_'+f+'.json')); const o={};
  for(const v of ['side','plan']){ const [h,w]=SHAPE[k][v], a=new Uint8Array(fs.readFileSync(__dirname+`/alpha_${k}_${v}.bin`));
    const t0=Date.now(); const fr=FP.fitFrame(D.model, v, a, w, h, s);
    o[v]={href:'data:image/webp;base64,'+fs.readFileSync(FI+dir+'/'+v+'.webp').toString('base64'), W:w, H:h, s, frame:fr}; o[v].ms=Date.now()-t0; }
  return {D, pics:o, name:IX[key].name, reg:IX[key].data.reg};
}
module.exports={pics};
if(require.main===module){
  const k=process.argv[2]||'cub', theme=process.argv[3]||'sheet'; const r=pics(k);
  console.log(k, 'fit side', JSON.stringify(r.pics.side.frame), r.pics.side.ms+'ms', 'plan', JSON.stringify(r.pics.plan.frame), r.pics.plan.ms+'ms');
  const html=`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"></head><body style="margin:0;background:#888">${FP.PAGES.map(p=>'<div style="width:1200px;margin:6px">'+FP.svg(p.id,r.D,{theme,name:r.name,reg:r.reg,pics:r.pics,sig:'Wingsmith · certified airworthy'})+'</div>').join('')}</body></html>`;
  fs.writeFileSync(__dirname+'/fp_'+k+'_'+theme+'.html',html);
}
