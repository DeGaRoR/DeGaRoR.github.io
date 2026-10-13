// every mirror pair of members (each end's node across z = 0 within 1 mm): the envelope's asymmetry per class
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
for (const k of (process.argv[2]||'cub,jodel,metal,floats,twinFloats').split(',')) {
  const d=L.defOf(k,{}), K=L.certOf(k), N=d.nodes, n=N.length;
  const mir=new Int32Array(n).fill(-1);
  for(let i=0;i<n;i++){let best=-1,bd=1e-3;for(let j=0;j<n;j++){const p=N[j].p,q=N[i].p;const dd=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]+q[2]);if(dd<=bd){bd=dd;best=j;}}mir[i]=best;}
  const at=new Map(); d.beams.forEach((b,bi)=>{const a=Math.min(b.a,b.b),c=Math.max(b.a,b.b); if(!at.has(a+','+c)) at.set(a+','+c,bi);});
  const byCls={}; const worst=[];
  d.beams.forEach((b,bi)=>{ if(mir[b.a]<0||mir[b.b]<0) return; const a=Math.min(mir[b.a],mir[b.b]),c=Math.max(mir[b.a],mir[b.b]); const bj=at.get(a+','+c); if(bj==null||bj<=bi) return;
    for (const [F,lab] of [[K.Ft,'T'],[K.Fc,'C']]) { const x=F[bi],y=F[bj]; if(!(x>0&&y>0)) continue; const r=Math.max(x,y)/Math.min(x,y);
      const cl=b.cls; byCls[cl]=byCls[cl]||{n:0,over10:0,max:1}; byCls[cl].n++; if(r>1.1) byCls[cl].over10++; if(r>byCls[cl].max) byCls[cl].max=r;
      worst.push([r,cl,lab,N[b.a].tag+'-'+N[b.b].tag,(x/1000).toFixed(2),(y/1000).toFixed(2)]); } });
  worst.sort((a,b)=>b[0]-a[0]);
  console.log(k, JSON.stringify(Object.fromEntries(Object.entries(byCls).map(([c,v])=>[c,v.n+' pairs, '+v.over10+' >1.1x, max '+v.max.toFixed(2)]))));
  for (const w of worst.slice(0,6)) console.log('   ', w[0].toFixed(2), w.slice(1).join(' '));
}
