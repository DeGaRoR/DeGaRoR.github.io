// rings.js <build.json> [overJSON] - THE CAGE'S CONTROL RINGS, nose to tail: per station its cage z, metres aft of the
// front, top, bottom and half-width (cage units - x planeScale = m). The rings are what the frame rows move; read
// them to see WHICH ring a row moved (a ring pair taking two frames' deviations shows here). Method: tools/REF_MATCH.md.
const T=require('path').resolve(__dirname,'..')+'/'; const SH=require(T+'_scene_headless.js'); const spec=JSON.parse(require('fs').readFileSync(process.argv[2],'utf8')).spec;
const S=SH.sceneBuild(spec,{garage:spec,over:JSON.parse(process.argv[3]||'{}')}); const V=S.built.cage.V; const m=new Map();
for(const p of V){ const k=p[2].toFixed(3); const r=m.get(k)||{z:p[2],t:-1e9,b:1e9,w:0,n:0}; r.t=Math.max(r.t,p[1]); r.b=Math.min(r.b,p[1]); r.w=Math.max(r.w,Math.abs(p[0])); r.n++; m.set(k,r); }
const R=[...m.values()].filter(r=>r.n>=6).sort((a,b)=>b.z-a.z); const z0=R[0].z;
for(const r of R) console.log('z',r.z.toFixed(3),' aft(m)',((z0-r.z)*S.FS).toFixed(2),' top',r.t.toFixed(3),' bot',r.b.toFixed(3),' hw',r.w.toFixed(3),' n',r.n);
