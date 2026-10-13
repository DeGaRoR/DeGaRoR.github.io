const path=require('path'); const T=path.join(process.cwd(),'tools');
const L=require(path.join(T,'_treecrash_lib.js')); const C=L.core();
function solveSym(M,b){const n=b.length;const A=M.map((r,i)=>r.concat([b[i]]));for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];for(let r=0;r<n;r++){if(r===c)continue;const f=A[r][c]/A[c][c];for(let k=c;k<=n;k++)A[r][k]-=f*A[c][k];}}return A.map((r,i)=>r[n]/r[i]);}
const EQ={M:p=>1,x:p=>p[0],y:p=>p[1],xx:p=>p[0]*p[0],yy:p=>p[1]*p[1],zz:p=>p[2]*p[2],xy:p=>p[0]*p[1]};
for(const eqs of [['M','x','y','xx','yy','xy'],['M','x','y','xx','yy','zz','xy']]) for(const k of ['cub','jodel','metal']){
  const d=L.defOf(k),N=d.nodes; const ix=t=>N.findIndex(n=>n.tag===t);
  const ring=['MNTTL','MNTTR','MNTBL','MNTBR'].map(ix); const mu=ring.map(i=>N[i].m);
  const prs=[['ENGL','ENGR'],['S0TL','S0TR'],['S0BL','S0BR'],['S1TL','S1TR'],['S1BL','S1BR'],['S2TL','S2TR'],['S2BL','S2BR'],['S3TL','S3TR'],['S3BL','S3BR']].map(p=>p.map(ix));
  const fs=eqs.map(e=>EQ[e]);
  const A=prs.map(pp=>fs.map(f=>pp.reduce((s,i)=>s+f(N[i].p),0)));
  const b=fs.map(f=>-ring.reduce((s,i,j)=>s+0.25*mu.reduce((a,c)=>a+c,0)*f(N[i].p),0));
  const w=prs.map(pp=>N[pp[0]].m); const n=fs.length;
  const G=[];for(let i=0;i<n;i++){G.push([]);for(let j=0;j<n;j++){let s=0;for(let q=0;q<prs.length;q++)s+=A[q][i]*w[q]*A[q][j];G[i].push(s);}}
  const lam=solveSym(G,b); const dm=prs.map((pp,q)=>w[q]*A[q].reduce((s,a,j)=>s+a*lam[j],0));
  console.log(eqs.join(''),k,'ring',mu.reduce((a,c)=>a+c,0).toFixed(2),'dm/node',prs.map((pp,q)=>N[pp[0]].tag+':'+dm[q].toFixed(2)).join(' '));
}
