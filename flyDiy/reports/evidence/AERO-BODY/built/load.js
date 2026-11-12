const LB=require('/workspace/DeGaRoR.github.io/flyDiy/tools/_load_build.js'), fs=require('fs');
const [key,file]=process.argv.slice(2); const t=Date.now(); const r=LB.loadBuild(file);
fs.writeFileSync(__dirname+'/spec_'+key+'.json', JSON.stringify({key,file,name:r.name,errors:r.errors,notes:r.notes,spec:r.spec}));
const A=r.spec.fuselage&&r.spec.fuselage.aeroBody; console.log('ok',key,((Date.now()-t)/1000).toFixed(0)+'s','errors',(r.errors||[]).length, A?('rows '+A.rows.length+' x '+A.rows[0].x+'..'+A.closeX+' base '+JSON.stringify(A.base)+' rod '+JSON.stringify(A.rod)+' tailOnBody '+A.tailOnBody):'NO aeroBody');
