// at rest: prop D, hub (ENG nodes mean) height, disc low point, gear nodes
const path=require('path'); const ROOT=process.env.ROOT||process.cwd(); const T=path.join(ROOT,'tools');
const L=require(path.join(T,'_treecrash_lib.js')); const C=L.core();
const key=process.argv[2]||'metal';
const def=L.defOf(key,{}); const sp=C.genDriveSpec(def);
const N=def.nodes;
console.log(key,'prop D',sp.D,'R',sp.R,'params.prop',JSON.stringify(def.params.prop),'powerplant',def.params.powerplant);
const E=def.refs.engine; console.log('engine nodes', E.map(i=>N[i].tag+' '+N[i].p.map(v=>v.toFixed(3)).join(',')));
for (const t of ['CGE','MNTBL','MNTTL','TW','GAL','GAR','S0BL','S0TL']) { const i=N.findIndex(n=>n.tag===t); if(i>=0) console.log(t,N[i].p.map(v=>v.toFixed(3)).join(','), 'm',(N[i].m||0).toFixed(2)); }
console.log('refs', Object.keys(def.refs).join(' '));
const F=L.flatWorld(0); const sim=C.makeSim(def,F.W); sim.reset(0); C.placeAtAerodrome(sim,Object.assign({},F.strip,{elev:0,spawnElev:0}));
for(let f=0;f<600;f++) sim.step(1/60);
let cx=0,cy=0,cz=0; for(const i of E){cx+=sim.p[i*3];cy+=sim.p[i*3+1];cz+=sim.p[i*3+2];} cx/=E.length;cy/=E.length;cz/=E.length;
const ax=sim.axes()[0]; console.log('at rest: hub y',cy.toFixed(3),'disc low',(cy - sp.R*Math.sqrt(1-ax[1]*ax[1])).toFixed(3),'pitch deg',(Math.asin(ax[1])*57.3).toFixed(2));
const D=sim.damage&&sim.damage(); if(D&&D.drive) console.log('gapMin',D.drive.map(d=>d.gapMin));
const lows=[]; for(let i=0;i<sim.n;i++) lows.push([sim.p[i*3+1],N[i].tag]); lows.sort((a,b)=>a[0]-b[0]); console.log('lowest nodes',lows.slice(0,8).map(a=>a[1]+':'+a[0].toFixed(3)).join(' '));
