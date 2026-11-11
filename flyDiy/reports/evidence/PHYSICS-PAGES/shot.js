const R=require('./render.js'); const fs=require('fs');
const {chromium}=require('playwright');
(async()=>{
 const k=process.argv[2]||'cub'; const which=(process.argv[3]||'load,drag,elec,tank').split(',');
 const fn={load:R.loadTest,drag:R.dragPage,elec:R.elecPage,tank:R.tankPage,sim:R.simPage,brk:R.breakPage};
 const html=`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"></head><body style="margin:0;background:#1a1815">${which.map(w=>'<div style="width:800px;margin:8px">'+fn[w](k)+'</div>').join('')}</body></html>`;
 fs.writeFileSync('shot.html',html);
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:816,height:800}});
 await p.goto('file://'+__dirname+'/shot.html'); await p.waitForTimeout(800);
 await p.screenshot({path:`shot_${k}.png`,fullPage:true}); await b.close();
})();
