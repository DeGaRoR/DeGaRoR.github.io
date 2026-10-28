// door hinge triangles and draw calls: argv[2] = flyDiy tools dir
const path=require('path');const T=process.argv[2];
const SH=require(path.join(T,'_scene_headless.js'));const W0=SH.context().ctx;const PR=W0.CAGE_PAGE.presets;
const preset=(name)=>{const o=Object.assign({},W0.CAGE2.CAGE_PARAMS);const pre=PR[name];for(const k in pre)if(k!=='_base')o[k]=pre[k];return o;};
const cases=[['stock Cub (clamshell)',()=>SH.sceneBuild(null,{over:preset('piper cub')})],['STOL Cub',()=>SH.sceneBuild(SH.loadFixture('/tmp/claude-0/sp/stol_cub_showcase.json').spec,{})],
 ['Jodel',()=>SH.sceneBuild(null,{})],['Cessna 172',()=>SH.sceneBuild(null,{over:preset('cessna 172')})]];
for(const [n,f] of cases){const S=f();const H=S.W.CAGE_HINGE;let fixed=0;
 for(const q of H.placed) if(q.kind==='door') for(const k in q.trisF){const r=q.trisF[k];fixed+=r[1]-r[0];}
 let moving=0,draws=new Set(),all=0,meshes=0;
 S.scene.traverse(o=>{if(!o.isMesh)return;meshes++;all+=o.geometry.index?o.geometry.index.count/3:0; if(/^edHinge_door_/.test(o.name)){moving+=o.geometry.index.count/3;draws.add(o.name);} if(/^edHinge_static_door/.test(o.name))draws.add(o.name);});
 const nH=H.placed.filter(q=>q.kind==='door').reduce((a,q)=>a+q.n,0);
 console.log(n.padEnd(22),'hinges',nH,'tris fixed',fixed,'moving',moving,'total',fixed+moving,'per hinge',((fixed+moving)/nH).toFixed(0),'| door-hinge meshes',[...draws].join(','),'| scene meshes',meshes,'tris',all);}
