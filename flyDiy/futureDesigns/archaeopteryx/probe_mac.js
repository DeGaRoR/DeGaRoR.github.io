// probe_mac.js: the wing's true area-weighted MAC LE (0.795) against gen.xLEmac (0.625, the root LE), and the wing's mass on its front / rear spar nodes
const T=require('path').join(__dirname,'../../tools/')+'/';const C=require(T+'flight_core.js'),BJ=require(T+'_bake_joined.js'),LB=require(T+'_load_build.js');
const {D}=BJ.loadPanel(); const A=D.ARCHETYPES.find(x=>x.key==='archaeopteryx');
const s0=D.designBake(A.sel,A.over); const sp=LB.gameSpecFull({v:s0.v,birth:1,spec:s0}).spec; const d=C.buildGen(JSON.parse(JSON.stringify(sp)));
const P=d.parts, g=d.params.gen; console.log('gen xLEmac',g.xLEmac,'cBar',g.cBar,'semi?',P.zs, 'zRoot',P.zRoot,'zCrank',P.zCrank);
console.log('xFat src', P.xFat.toString().slice(0,300)); console.log('chordAt src', P.chordAt.toString().slice(0,300));
const z0=P.zRoot, z1=P.zs[P.zs.length-1]||6.5; let A1=0,Ax=0,Ac2=0; const n=400;
for (let i=0;i<n;i++){ const z=z0+(i+0.5)*(z1-z0)/n, c=P.chordAt(z), xle=P.xFat(z)-P.sparFront*c; A1+=c; Ax+=c*xle; Ac2+=c*c; if(i%80===0) console.log(' z',z.toFixed(2),'c',c.toFixed(3),'xLE',xle.toFixed(3)); }
console.log('area-weighted MAC LE', (Ax/A1).toFixed(3), ' cBar (int c2/int c)', (Ac2/A1).toFixed(3));
// mass on wing nodes (the wf F/R/FB/RB lists) and their x
const sum=(ids)=>ids.reduce((a,i)=>[a[0]+d.nodes[i].m,a[1]+d.nodes[i].m*d.nodes[i].p[0]],[0,0]);
for (const s of ['L','R']) for (const k of ['F','R','FB','RB']) { const [m,mx]=sum(P.wf[s][k]); console.log(s,k,m.toFixed(2),'kg at x',(mx/m).toFixed(3)); }
console.log('nodes 0..10 x/m', d.nodes.slice(0,8).map(n=>n.p[0].toFixed(2)+'/'+(n.m||0).toFixed(2)).join(' '));
