process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const D=require(path.join(ROOT,'tools/_dmg_drive_lib.js'));
const k=process.argv[2]||'metal';
const r=D.tipStrike(k,{thr:1,bite:0.03,secs:3}); const Dm=r.sim.damage(), def=r.def, N=def.nodes;
console.log('groups',JSON.stringify((Dm.groups||[]).map(g=>[g.key,+g.t.toFixed(3)])),'firstBreak',JSON.stringify(Dm.firstBreak&&{t:Dm.firstBreak.t, tag:N[def.beams[Dm.firstBreak.beam].a].tag+'-'+N[def.beams[Dm.firstBreak.beam].b].tag, how:Dm.firstBreak.how}),'broken',Dm.broken.length,'strikeAt',JSON.stringify(Dm.drive[0].strikeAt),'guard',JSON.stringify(r.sim.guard()), 'crashed',Dm.crashed,Dm.reason);
const B=Dm.broken.map(i=>N[def.beams[i].a].tag+'-'+N[def.beams[i].b].tag+':'+def.beams[i].cls); console.log('broken',B.join(' '));
const G=(def.parts.dmg.groups||[]).find(g=>g.key==='eng:mount'); console.log('eng:mount t0',G&&G.t0.map(i=>N[def.beams[i].a].tag+'-'+N[def.beams[i].b].tag).join(' '),'t1',G&&G.t1.map(i=>N[def.beams[i].a].tag+'-'+N[def.beams[i].b].tag).join(' '));
