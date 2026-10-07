process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const D=require(path.join(ROOT,'tools/_dmg_drive_lib.js'));const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));
const k=process.argv[2]||'metal', V=+(process.argv[3]||2);
const r=D.noseOver(k,{V,secs:2});
const def=r.def, N=def.nodes, tw=def.refs.tw;
console.log(k,'V',V,'pitch0',r.pitch0.toFixed(1),'at',r.at,'discT',r.discT,'strikeT',r.strikeT,'bite',r.bite.toFixed(3),'drive',JSON.stringify(r.drive[0].strike),'tl',JSON.stringify(r.tl.slice(0,8)));
