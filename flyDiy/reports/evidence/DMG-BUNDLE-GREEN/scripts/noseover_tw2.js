process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const D=require(path.join(ROOT,'tools/_dmg_drive_lib.js'));
const k=process.argv[2]||'metal', V=+(process.argv[3]||2);
const r=D.noseOver(k,{V,secs:0.001}); const sim=r.sim, def=r.def, tw=def.refs.tw;
console.log(k,'pitch0',r.pitch0.toFixed(1),'TW bottom over ground after 1 frame',(sim.p[tw*3+1]-def.nodes[tw].r).toFixed(3),'(r',def.nodes[tw].r,')');
