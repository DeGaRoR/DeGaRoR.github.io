// ftest_ls4.js <build.json> : the LS4's quick flight test - the design check's rows, then glides from 500 m (damage on, certified)
const T='/workspace/DeGaRoR.github.io/flyDiy/tools/';const C=require(T+'flight_core.js'),L=require(T+'_treecrash_lib.js');const fs=require('fs');
const sp=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).spec; const d0=C.buildGen(JSON.parse(JSON.stringify(sp)));
const d=Object.assign({},d0,{params:Object.assign({},d0.params,{damage:true}),cert:C.genCertify(d0,{})});
const g=d.params.gen; console.log('mass', d.parts.gauge.W0.toFixed(0), 'Vs', (g.VsMeas||g.Vs).toFixed(1), 'VCruise', d.params.ap.VCruise.toFixed(1));
try { const dc=C.genDesignCheck(d); const bad=dc.rows.filter(r=>r.level!=='pass'); console.log('design rows', dc.rows.length, 'not pass:', bad.map(r=>r.level+': '+(r.label||r.key)+' '+(r.value!=null?r.value:'')+(r.unit||'')).join(' | ')||'none'); } catch(e) { console.log('design threw', e.message); }
const fly=(name, ctlFn, secs)=>{ const W0=L.flatWorld(0), s=C.makeSim(d,W0.W); s.reset(0);
  C.placeAtAerodrome(s,Object.assign({},W0.strip,{elev:0,spawnElev:500}));
  const V0=1.6*(g.VsMeas||g.Vs), fx=Math.cos(W0.strip.hdg), fz=Math.sin(W0.strip.hdg); for(let i=0;i<s.n;i++){s.v[i*3]=V0*fx;s.v[i*3+2]=V0*fz;}
  const cy=()=>{let m=0,y=0;for(let i=0;i<s.n;i++){m+=s.m[i];y+=s.m[i]*s.p[3*i+1];}return y/m;};
  let fin=true, vmin=1e9, vmax=0, h0=null, t0=10; const log=[];
  for(let f=0;f<60*secs;f++){ ctlFn(s, f/60); s.step(1/60); if(!s.p.every(Number.isFinite)){fin=false;break;}
    const V=s.out.V; if(f/60>3){vmin=Math.min(vmin,V);vmax=Math.max(vmax,V);} if(f===60*t0) h0=cy(); if(f%(60*10)===0) log.push((f/60)+'s V'+V.toFixed(1)+' h'+cy().toFixed(0)+' pitch'+(s.out.pitch!=null?(s.out.pitch*57.3).toFixed(0):'?')+' bank'+(s.out.roll!=null?(s.out.roll*57.3).toFixed(0):'?')); }
  const sink = h0!=null ? (h0-cy())/(secs-t0) : null, X=s.damage();
  console.log(name, 'finite', fin, 'V', vmin.toFixed(1)+'..'+vmax.toFixed(1), 'm/s', 'mean sink', sink&&sink.toFixed(2), 'm/s', 'breaks', X.breaks, 'yields', X.yields); console.log('   ', log.join(' | ')); };
fly('hands off', (s)=>{}, 60);
fly('stick: 0.1 back 20-25 s, 0.1 fwd 35-40 s, aileron 0.2 at 45-48 s', (s,t)=>{ s.ctl.de = t>20&&t<25 ? -0.1 : t>35&&t<40 ? 0.1 : 0; s.ctl.da = t>45&&t<48 ? 0.2 : 0; }, 60);
