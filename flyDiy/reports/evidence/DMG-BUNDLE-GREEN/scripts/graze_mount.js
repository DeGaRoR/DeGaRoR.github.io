process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const D=require(path.join(ROOT,'tools/_dmg_drive_lib.js'));
const k=process.argv[2]||'metal';
const r=D.tipStrike(k,{thr:1,bite:0.03,secs:3,probe:true}); const mp=D.mountPeak(r.sim,r.def);
console.log(k,'probe: mount peak',mp.max.toFixed(2),JSON.stringify(mp.at),'engine body',mp.body.toFixed(2),'imb kN',(r.imbMax/1000).toFixed(1));
const r2=D.tipStrike(k,{thr:1,bite:0.03,secs:3}); console.log(k,'damage: mountAt',r2.mountAt,'groups',r2.groups.join(','),'strike',r2.drive[0].strike);
