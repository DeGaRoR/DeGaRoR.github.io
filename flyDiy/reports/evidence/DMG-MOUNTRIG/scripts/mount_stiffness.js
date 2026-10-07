// G2361 (DMG-MOUNTRIG): the mount truss on the stiffness matrix (unit k per member, the firewall corners pinned; the metal Cessna's geometry): the smallest eigenvalue and its mode, and the compliance under unit loads, for the old rig, the first cut and the candidates. node <this file>
const P={S0TL:[0,1.115,-.545],S0TR:[0,1.115,.545],S0BL:[0,0,-.545],S0BR:[0,0,.545],
EL:[-1.162,.522,-.326],ER:[-1.162,.522,.326],CG:[-.832,.522,0],TL:[-.4,.848,-.326],TR:[-.4,.848,.326],BL:[-.4,.196,-.326],BR:[-.4,.196,.326]};
const free=['EL','ER','CG','TL','TR','BL','BR'];
function K(mem){const n=free.length*3;const K=Array.from({length:n},()=>new Float64Array(n));
 for(const[a,b,kx]of mem){const pa=P[a],pb=P[b];const d=pb.map((x,i)=>x-pa[i]);const L=Math.hypot(...d);const u=d.map(x=>x/L);const k=kx||1;
  const ia=free.indexOf(a),ib=free.indexOf(b);const idx=[];if(ia>=0)idx.push([ia,-1]);if(ib>=0)idx.push([ib,1]);
  for(const[i,si]of idx)for(const[j,sj]of idx)for(let p=0;p<3;p++)for(let q=0;q<3;q++)K[i*3+p][j*3+q]+=k*si*sj*u[p]*u[q];}return K;}
function jacobi(A){const n=A.length;A=A.map(r=>Array.from(r));const V=A.map((r,i)=>r.map((_,j)=>i===j?1:0));
 for(let sweep=0;sweep<100;sweep++){let off=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)off+=A[i][j]**2;if(off<1e-20)break;
  for(let p=0;p<n;p++)for(let q=p+1;q<n;q++){if(Math.abs(A[p][q])<1e-14)continue;const th=(A[q][q]-A[p][p])/(2*A[p][q]);const t=Math.sign(th||1)/(Math.abs(th)+Math.sqrt(th*th+1));const c=1/Math.sqrt(t*t+1),s=t*c;
   for(let k=0;k<n;k++){const akp=A[k][p],akq=A[k][q];A[k][p]=c*akp-s*akq;A[k][q]=s*akp+c*akq;}
   for(let k=0;k<n;k++){const apk=A[p][k],aqk=A[q][k];A[p][k]=c*apk-s*aqk;A[q][k]=s*apk+c*aqk;}
   for(let k=0;k<n;k++){const vkp=V[k][p],vkq=V[k][q];V[k][p]=c*vkp-s*vkq;V[k][q]=s*vkp+c*vkq;}}}
 const ev=A.map((r,i)=>r[i]);return {ev,V};}
function test(name,mem){const {ev,V}=jacobi(K(mem));const idx=ev.map((e,i)=>[e,i]).sort((a,b)=>a[0]-b[0]);const [e0,i0]=idx[0];
 const mode=free.map((f,j)=>f+':'+[0,1,2].map(c=>V[j*3+c][i0].toFixed(2)).join(',')).join(' ');
 console.log(name.padEnd(28),'members',mem.length,'min eig',e0.toFixed(4),'2nd',idx[1][0].toFixed(4),'| mode',mode);}
const block=[['EL','ER'],['CG','EL'],['CG','ER']];
const iso=[['TL','CG'],['TR','CG'],['BL','CG'],['BR','CG'],['TL','EL'],['BL','EL'],['TR','ER'],['BR','ER']];
const bear=[['TL','S0TL'],['TL','S0BL'],['TR','S0TR'],['TR','S0BR'],['BL','S0BL'],['BL','S0BR'],['BR','S0BR'],['BR','S0BL']];
const sides=[['TL','BL',.5],['TR','BR',.5]];
const old=[['EL','ER'],['EL','S0TL'],['EL','S0BL'],['EL','S0BR'],['ER','S0TR'],['ER','S0BR'],['ER','S0BL'],['CG','EL'],['CG','ER'],['CG','S0TL'],['CG','S0TR'],['CG','S0BL'],['CG','S0BR']];
const P2={...P}; 
// old rig: only EL ER CG free; ring nodes unused - give them a trivial anchor
test('OLD rig',old.concat([['TL','S0TL'],['TL','S0BL'],['TL','S0TR'],['TR','S0TR'],['TR','S0BR'],['TR','S0TL'],['BL','S0BL'],['BL','S0BR'],['BL','S0TL'],['BR','S0BR'],['BR','S0BL'],['BR','S0TR']]));
test('FIRST CUT (8 bearers+sides)',[...block,...iso,...bear,...sides]);
const bear12=[...bear,['TL','S0TR'],['TR','S0TL'],['BL','S0TL'],['BR','S0TR']];
test('bear12 sides',[...block,...iso,...bear12,...sides]);
const ring4=[['TL','BL'],['TR','BR'],['TL','TR'],['BL','BR']];
test('bear8 ring4',[...block,...iso,...bear,...ring4]);
test('bear12 ring4',[...block,...iso,...bear12,...ring4]);
const iso12=[...iso,['TL','ER'],['TR','EL'],['BL','ER'],['BR','EL']];
test('bear12 ring4 iso12',[...block,...iso12,...bear12,...ring4]);
test('bear8 ring4 iso12',[...block,...iso12,...bear,...ring4]);
const isoX=[['TL','CG'],['TR','CG'],['BL','CG'],['BR','CG'],['TL','EL'],['BL','EL'],['TR','ER'],['BR','ER'],['TL','BR'],['TR','BL']];
test('bear8 ring4 +ringX',[...block,...iso,...bear,...ring4,['TL','BR'],['TR','BL']]);
test('bear12 ring4 +ringX',[...block,...iso,...bear12,...ring4,['TL','BR'],['TR','BL']]);
function solve(A,b){const n=b.length;A=A.map((r,i)=>Array.from(r).concat([b[i]]));for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];for(let r=0;r<n;r++){if(r===c)continue;const f=A[r][c]/A[c][c];for(let k=c;k<=n;k++)A[r][k]-=f*A[c][k];}}return A.map((r,i)=>r[n]/r[i]);}
function comp(name,mem){const k=K(mem);const out=[];for(const [lab,load] of [['aft@flange',{EL:[.5,0,0],ER:[.5,0,0]}],['down@CG',{CG:[0,-1,0]}],['side@CG',{CG:[0,0,1]}],['aft@EL only',{EL:[1,0,0]}]]){
 const b=new Array(free.length*3).fill(0);for(const f in load)for(let c=0;c<3;c++)b[free.indexOf(f)*3+c]=load[f][c];const u=solve(k,b);
 const cg=free.indexOf('CG'),el=free.indexOf('EL');out.push(lab+' CG '+[0,1,2].map(c=>u[cg*3+c].toFixed(2)).join(',')+' EL '+[0,1,2].map(c=>u[el*3+c].toFixed(2)).join(','));}
 console.log(name.padEnd(24),out.join(' | '));}
console.log('--- compliance (displacement per unit load, in 1/k)');
comp('OLD',old.concat([['TL','S0TL'],['TL','S0BL'],['TL','S0TR'],['TR','S0TR'],['TR','S0BR'],['TR','S0TL'],['BL','S0BL'],['BL','S0BR'],['BL','S0TL'],['BR','S0BR'],['BR','S0BL'],['BR','S0TR']]));
comp('FIRST CUT',[...block,...iso,...bear,...sides]);
comp('bear12 ring4',[...block,...iso,...bear12,...ring4]);
comp('bear12 ring4 iso12',[...block,...iso12,...bear12,...ring4]);
console.log('--- more');
const ringTB=[['TL','TR'],['BL','BR']];
for (const [n,m] of [['b12 iso12 noring',[...block,...iso12,...bear12]],['b12 iso12 sides',[...block,...iso12,...bear12,...sides]],['b12 iso12 sidesfull',[...block,...iso12,...bear12,['TL','BL'],['TR','BR']]],
 ['b12 iso12 ringTB',[...block,...iso12,...bear12,...ringTB]],['b12 iso8x ring4',[...block,['TL','CG'],['TR','CG'],['BL','CG'],['BR','CG'],['TL','ER'],['TR','EL'],['BL','ER'],['BR','EL'],...bear12,...ring4]],
 ['b12 iso12 ring4 k2',[...block,...iso12.map(x=>[x[0],x[1],2]),...bear12.map(x=>[x[0],x[1],2]),...ring4]]]) { test(n,m); comp(n,m); }
console.log('--- lean');
const bear10=[...bear,['TL','S0TR'],['TR','S0TL']];
for (const [n,m] of [['SHIPPED: b12 iso8 noring',[...block,...iso,...bear12]],['b10 iso8 noring',[...block,...iso,...bear10]],['b10 iso12 noring',[...block,...iso12,...bear10]],['b12 iso8 sides',[...block,...iso,...bear12,...sides]]]) { test(n,m); comp(n,m); }
