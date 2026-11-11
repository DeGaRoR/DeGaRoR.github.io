const FLY='/workspace/DeGaRoR.github.io/flyDiy'; const fs=require('fs');
const LB=require(FLY+'/tools/_load_build.js');
const [key,file]=process.argv.slice(2);
const t=Date.now(); const r=LB.loadBuild(file);
fs.writeFileSync(__dirname+'/spec_'+key+'.json', JSON.stringify({key,file,name:r.name,errors:r.errors,spec:r.spec}));
console.log('ok',key,r.name,(Date.now()-t)/1000,'s',r.errors&&r.errors.length);
