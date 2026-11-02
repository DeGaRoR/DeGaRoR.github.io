// cowl_clip.js <build.json> [overJSON] - THE ENGINE AGAINST ITS COWL: per 2 cm slab along the cowl, every engine vertex
// (prop, spinner and hub excluded) against the cowl skin's radius at that bearing (5 deg bins, less 5 mm of shell; a
// bearing where the cut finds no skin - an inlet, the open front - is not counted). Prints how far the engine runs
// ahead of the cowl's front and the vertices outside, worst first. 0 outside = fits. Method: tools/REF_MATCH.md.
const fs=require('fs'), path=require('path'); const T=path.resolve(__dirname,'..')+'/'; const SH=require(T+'_scene_headless.js');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8')); const spec=raw.spec||raw; const over=JSON.parse(process.argv[3]||'{}');
const S=SH.sceneBuild(spec,{garage:spec,over}); const THREE=SH.context().THREE; S.scene.updateMatrixWorld(true); const v=new THREE.Vector3();
const cowl=[], eng=[];
S.scene.traverse(o=>{ if(!o.isMesh||!o.geometry.attributes.position||o.visible===false) return; let lay=''; for(let q=o;q;q=q.parent) if(/^cageLayer:/.test(q.name||'')){lay=q.name.slice(10);break;}
  const nm=[]; for(let q=o;q&&q!==S.scene;q=q.parent) nm.push(q.name||''); const N=nm.join('/');
  if(lay==='cowl'){ const pos=o.geometry.attributes.position, idx=o.geometry.index, n=idx?idx.count:pos.count; const W=i=>{v.fromBufferAttribute(pos, idx?idx.getX(i):i).applyMatrix4(o.matrixWorld); return [v.x,v.y,v.z];}; for(let i=0;i+2<n;i+=3) cowl.push([W(i),W(i+1),W(i+2)]); }
  if(lay==='eng' && !/prop|blade|spinner|hub/i.test(N)){ const pos=o.geometry.attributes.position; for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld); eng.push([v.x,v.y,v.z,N]); } } });
let cz0=1e9,cz1=-1e9; for(const t of cowl) for(const p of t){cz0=Math.min(cz0,p[2]);cz1=Math.max(cz1,p[2]);}
let ez0=1e9,ez1=-1e9; for(const p of eng){ez0=Math.min(ez0,p[2]);ez1=Math.max(ez1,p[2]);}
const segs=(z)=>{ const out=[]; for(const t of cowl){ for(let e=0;e<3;e++){ const a=t[e], b=t[(e+1)%3]; if((a[2]-z)*(b[2]-z)>0||a[2]===b[2]) continue; const s=(z-a[2])/(b[2]-a[2]); out.push([a[0]+(b[0]-a[0])*s, a[1]+(b[1]-a[1])*s]); } } return out; };
let worst=[], over0=0; const byName={};
for(let z=cz0+0.01; z<cz1; z+=0.02){ const pts=segs(z); if(pts.length<20) continue;
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; for(const p of pts){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  const bins=new Array(72).fill(-1);   // the OUTER skin radius per 5 deg bearing (max distance of the cut there), less 5 mm of shell
  for(const p of pts){ const a=Math.atan2(p[1]-cy,p[0]-cx), r=Math.hypot(p[0]-cx,p[1]-cy); const k=((Math.floor((a+Math.PI)/(2*Math.PI)*72))%72+72)%72; bins[k]=Math.max(bins[k],r); } const med=bins.filter(b=>b>0).sort((a,b)=>a-b)[36]||0; for(let k=0;k<72;k++) if(bins[k]>0.8*med) bins[k]-=0.005; else bins[k]=1e9;
  for(const e of eng){ if(Math.abs(e[2]-z)>0.01) continue; const a=Math.atan2(e[1]-cy,e[0]-cx), r=Math.hypot(e[0]-cx,e[1]-cy); const k=((Math.floor((a+Math.PI)/(2*Math.PI)*72))%72+72)%72;
    if(bins[k]>1e8) continue; const d=r-bins[k]; if(d>0){ over0++; worst.push([d,z,a*180/Math.PI,e[3],r,bins[k],e[0],e[1],cx,cy]); const nk=e[3]; byName[nk]=Math.max(byName[nk]||0,d);} } }
worst.sort((a,b)=>b[0]-a[0]);
// where along the cowl: the worst overshoot per 10 cm of station, with its bearing (90 = the top, -90 the bottom)
const bySt={}; for(const w of worst){ const k=Math.floor(w[1]*10); if(!bySt[k]||bySt[k][0]<w[0]) bySt[k]=w; }
console.log('cowl z', cz0.toFixed(3), cz1.toFixed(3), ' engine z', ez0.toFixed(3), ez1.toFixed(3), ' engine ahead of cowl front', (ez1-cz1).toFixed(3));
console.log('engine verts outside the cowl:', over0, ' worst mm:', worst.slice(0,3).map(w=>(w[0]*1000).toFixed(0)+' @z'+w[1].toFixed(2)+' '+w[2].toFixed(0)+'deg r'+w[4].toFixed(3)+' skin'+w[5].toFixed(3)+' p('+w[6].toFixed(2)+','+w[7].toFixed(2)+') c('+w[8].toFixed(2)+','+w[9].toFixed(2)+')').join(', '));
if(worst.length) console.log('by station (z, worst mm, bearing):', Object.keys(bySt).sort((a,b)=>a-b).map(k=>
  (k/10).toFixed(1)+' '+(bySt[k][0]*1000).toFixed(0)+'mm@'+bySt[k][2].toFixed(0)).join(' | '));
console.log('by part:', Object.entries(byName).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,d])=>k+' '+(d*1000).toFixed(0)+'mm').join(', '));
