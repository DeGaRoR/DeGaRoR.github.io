process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const D=require(path.join(ROOT,'tools/_dmg_drive_lib.js'));
for (const k of (process.argv[2]||'twinFloats,metal').split(',')) for (const thr of [0,1]) {
  const r=D.tipStrike(k,{thr,bite:0.03,secs:3}); const d=r.drive[0];
  console.log(k,'thr',thr,'rpm0',r.rpm0.toFixed(0),'R',r.R,'strike',d.strike,JSON.stringify(d.strikeAt),'running',r.running.join(','),'mountAt',r.mountAt);
}
