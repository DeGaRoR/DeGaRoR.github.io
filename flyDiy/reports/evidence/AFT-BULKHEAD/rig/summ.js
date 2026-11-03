const fs=require('fs');for(const b of process.argv.slice(3)){const t=fs.readFileSync(process.argv[2]+'/m_'+b+'.txt','utf8');const L=t.split('\n');const i=L.findIndex(l=>l.startsWith('{'));if(i<0){console.log(b,'NO JSON',t.slice(-800));continue;}
const j=JSON.parse(L[i]);const B=j.bulkhead;console.log('=== '+b,JSON.stringify(j.rows),'A',JSON.stringify(j.A));if(!B){console.log('  none',j.why);continue;}
console.log('  bulk',JSON.stringify({front:B.frontFaces,of:B.faces,z:B.z,zMin:B.zMin,lean:B.lean,x:B.x,y:B.y,w:B.width,h:B.height,area:B.area,yv:B.yVsCabin,rear:B.rearSeat}));
console.log('  glassZ',JSON.stringify(B.glassZ));console.log('  seatTop',JSON.stringify(Object.fromEntries(Object.entries(B.seatMesh).map(([k,v])=>[k,v.y]))),'seatThru',JSON.stringify(j.seatThroughWall),'grid',j.grid.n);
for(const[k,v]of Object.entries(j.views))console.log('  ',k.padEnd(8),'eye',JSON.stringify(v.eye),'vis',v.visiblePct,'glass',v.thruGlassPct,'open',v.thruOpenPct,'aboveSeat',v.aboveSeatPct,'visAbove',v.visibleAboveSeatPct,'|',v.blockedBy.slice(0,4).join('; '));
console.log('  sweep',Object.entries(j.sweep).map(([k,v])=>k+':'+v[0]).join(' '));}
