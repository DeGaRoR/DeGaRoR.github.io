// probe_audit.js: the Archaeopteryx's mass ledger row by row, station and moment about the neutral point (~1.206 m). NB its '% MAC' uses gen.xLEmac (the ROOT LE, 0.625): see probe_mac.js
const T=require('path').join(__dirname,'../../tools/')+'/';const C=require(T+'flight_core.js'),BJ=require(T+'_bake_joined.js'),LB=require(T+'_load_build.js');
const {D}=BJ.loadPanel(); const A=D.ARCHETYPES.find(x=>x.key==='archaeopteryx');
const s0=D.designBake(A.sel,A.over); const sp=LB.gameSpecFull({v:s0.v,birth:1,spec:s0}).spec; const d=C.buildGen(JSON.parse(JSON.stringify(sp)));
const g=d.params.gen, pct=x=>(100*(x-g.xLEmac)/g.cBar).toFixed(0)+'%';
console.log('MAC LE',g.xLEmac.toFixed(3),'c',g.cBar.toFixed(3),' NP ~',(g.xLEmac+0.572*g.cBar).toFixed(3));
const L=d.parts.ledger; const rows=[]; for (const k in L){const e=L[k]; if(!(e.mass>0))continue; rows.push([k,e.mass,e.mx/e.mass,e.payload]);}
rows.sort((a,b)=>a[2]-b[2]); let M=0,MX=0;
for (const [k,m,x,p] of rows){M+=m;MX+=m*x; console.log(k.padEnd(12),m.toFixed(2).padStart(7),'kg at',x.toFixed(3),pct(x).padStart(5),(p?'payload':''),' moment vs NP',(m*(x-(g.xLEmac+0.572*g.cBar))).toFixed(1));}
console.log('total',M.toFixed(1),'CG',(MX/M).toFixed(3),pct(MX/M));
console.log('ledger entry keys', Object.keys(L.wings||L.wing||{}));
console.log('pilot/seat', JSON.stringify(sp.crew||sp.seats||sp.occupants||null).slice(0,300));
console.log('systems', JSON.stringify(sp.systems));
