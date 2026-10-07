// the twin's float nose-in (90 km/h, 5 m/s, 20 deg): the ROD root's ratio over time, pitch, the float bow's load
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const k=process.argv[2]||'twinFloats'; const V=+(process.argv[3]||25), sink=+(process.argv[4]||5), pitch=+(process.argv[5]||20);
let last=0;
const r=L.waterCase(k,{probe:true,V,sink,pitch,secs:4,onFrame:(sim,s)=>{const X=sim.clusterCuts().cuts; let w=null; for(const c of X) if(!w||Math.max(c.rb,c.rt)>Math.max(w.rb,w.rt)) w=c;
 const xA=sim.axes()[0]; const pk=Math.max(...X.map(c=>c.pk||0));
 if (s%6===0 || (w && Math.max(w.rb,w.rt)>0.8)) console.log((s/60).toFixed(3),'pitch',(Math.asin(xA[1])*57.3).toFixed(1),'cg y',sim.cgPos()[1].toFixed(2),'vy',sim.cgVel()[1].toFixed(2),'worst',w&&w.tag+'/'+w.kind,w&&w.rb.toFixed(3),w&&w.rt.toFixed(3),'Mb',w&&(w.Mb/1000).toFixed(2)+'kNm','Mu',w&&(w.Mu/1000).toFixed(2),'pk',pk.toFixed(3));}});
console.log('members',r.members, JSON.stringify(r.dmg).slice(0,300));
