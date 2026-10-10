const fs=require('fs'),path=require('path'),zlib=require('zlib');
const src=fs.readFileSync('match.js','utf8'); eval(src.slice(src.indexOf('function readPNG'), src.indexOf('module.exports')).replace(/^const /gm,'var '));
for (const base of process.argv.slice(2)) {
  const r=k=>readPNG(fs.readFileSync('out8/raw/'+base+'_'+k+'.png'));
  const A=r('A'),T=r('today'),K=r('trunk'),C=r('C'); const n=T.w*T.h; let c=0,sT=0,sK=0,sA=0,cA=0;
  for(let i=0;i<n;i++){const o=i*T.bpp; const yT=0.2126*toLin(T.data[o])+0.7152*toLin(T.data[o+1])+0.0722*toLin(T.data[o+2]); const yK=0.2126*toLin(K.data[o])+0.7152*toLin(K.data[o+1])+0.0722*toLin(K.data[o+2]);
    if(Math.abs(yT-yK)>0.004){c++;sT+=yT;sK+=yK;} }
  console.log(base.padEnd(60),'trunk-changed px',c,'of',n,' mean lin today',(sT/Math.max(1,c)).toFixed(4),'-> trunk fix',(sK/Math.max(1,c)).toFixed(4),' ratio',(sK/Math.max(1e-6,sT)).toFixed(3));
}
