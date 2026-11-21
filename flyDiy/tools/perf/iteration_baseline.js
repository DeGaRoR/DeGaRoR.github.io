// Real-game loading/iteration measurements using the established page harness.
// Usage: node tools/perf/iteration_baseline.js [output-directory] [query-string]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const PR = require('../page_rig.js');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../../reports/evidence/PERFORMANCE-2026-11-18/post-driver'));
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SNAP = `(() => ({t:performance.now(),build:window.FLYDIY_BUILD,body:document.body.className,
  boot:window.BOOT?{state:BOOT.state,busy:BOOT.busy?BOOT.busy():null,t0:BOOT.t0,log:BOOT.log}:null,
  canvas:window.FLYDIY_RENDERER?[FLYDIY_RENDERER.domElement.width,FLYDIY_RENDERER.domElement.height]:null,
  programs:window.FLYDIY_RENDERER?FLYDIY_RENDERER.info.programs.length:null,
  gfx:window.GFX&&GFX.budget?GFX.budget():null,heap:performance.memory?performance.memory.usedJSHeapSize:null}))()`;
let rig;
const results = {driver:cp.execFileSync('nvidia-smi',['--query-gpu=name,driver_version','--format=csv,noheader'],{encoding:'utf8'}).trim(),
  sha:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),query:process.argv[3]||'',runs:[],errors:[]};
const save = () => fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(results,null,2));
async function log(name) {
  await rig.ev(`window.__ITERLOG=FLIGHT_REC.rec.logParts().join('');__ITERLOG.length`);
  const n=await rig.ev('__ITERLOG.length'), fd=fs.openSync(path.join(out,name+'.flightlog.json'),'w');
  try {for(let i=0;i<n;i+=2000000)fs.writeSync(fd,await rig.ev(`__ITERLOG.slice(${i},${i+2000000})`));}finally{fs.closeSync(fd);}
}
async function waitReady() {
  const until=Date.now()+480000;
  while(Date.now()<until){const s=await rig.J(SNAP); if(s.boot&&s.boot.state==='gone'&&!s.boot.busy)return s;await sleep(500);}
  throw Error('No completed loading chain within eight minutes');
}
async function mark(name){await rig.ev(`FLIGHT_REC.mark(${JSON.stringify('seg:'+name)})`);}
(async()=>{try{
  const card=fs.readFileSync(path.join(__dirname,'../../builds/cessna172r_2026-11-08.json'),'utf8');
  rig=await PR.start({name:'iteration-baseline',size:'5120x1271',cap:1200,boot:480,q:results.query,seed:{'flydiy.wip':card}});
  results.gpu=rig.gpu; save();
  for(let pass=1;pass<=2;pass++){
    const r={pass,label:pass===1?'fresh-profile-first-launch':'same-profile-warm-reload',operations:[]};results.runs.push(r);save();
    r.garage=await waitReady(); console.log('PASS',pass,'garage fully ready',Math.round(r.garage.t),'ms');save();
    await mark('garage-soak');await sleep(10000);r.garageAfterSoak=await rig.J(SNAP);save();
    for(let trip=1;trip<=2;trip++){
      await mark('departure-'+trip);let t=await rig.ev('performance.now()');rig.flying=false;await rig.fly();
      const world=await waitReady();r.operations.push({name:'garage-to-world-'+trip,ms:world.t-t,snapshot:world});save();
      await mark('world-soak-'+trip);await sleep(5000);
      await mark('return-'+trip);t=await rig.ev(`(()=>{const t=performance.now();FLYDIY_MENU.act('shed');return t})()`);
      const deadline=Date.now()+180000;while(Date.now()<deadline){const s=await rig.J(SNAP);if(s.body.includes('mode-ws')&&s.boot.state==='gone'&&!s.boot.busy){r.operations.push({name:'world-to-garage-'+trip,ms:s.t-t,snapshot:s});break;}await sleep(500);}
      if(!r.operations.some(o=>o.name==='world-to-garage-'+trip))throw Error('Garage return timed out');
      console.log('PASS',pass,'trip',trip,r.operations.slice(-2).map(x=>x.name+' '+Math.round(x.ms)+' ms').join(', '));save();
    }
    await mark('end');await log('pass-'+pass);r.errors=rig.errors.slice();save();
    if(pass===1){await rig.cmd('Page.reload',{ignoreCache:false});await sleep(1500);}
  }
}catch(e){results.errors.push(String(e.stack||e));console.error(e);if(rig){try{results.failure=await rig.J(SNAP);await log('failure');}catch(x){results.errors.push(String(x));}}process.exitCode=1;
}finally{save();if(rig)await rig.close();}})();
