// fit_tail.js <build.json> <tail.json> <fin|stab> <out.json> [startJSON] [--hold k=v,...]
// THE TAIL'S OUTLINE ROWS FITTED TO A REFERENCE'S. Ours is the drawn sheet the fin / stab layers build (the headless
// tail, _tail_headless.js - the layers' own arithmetic, ~10 ms a build), rasterised at 1 cm in the side view (fin) or
// the plan (stab, the starboard half); the reference's outline comes from refmatch.py --tail (already in our frame).
// The score is 1 - IoU; the rows (the macro tier and every corner, in their GARAGE ranges - nothing a hand cannot
// set) are searched coordinate-wise with a halving step. Writes the rows (round them to the rows' steps before a
// card takes them), the score, the layer's own area measure, and <out>.png: both outlines (dark green = both,
// light green = the reference only, red = ours only). Method: tools/REF_MATCH.md.
'use strict';
const fs=require('fs'), path=require('path'); const T=path.resolve(__dirname,'..')+'/'; const SH=require(T+'_scene_headless.js');
const [FILE, TAILJ, PART, OUT] = process.argv.slice(2); const START=JSON.parse(process.argv[6]||'{}');
const spec=JSON.parse(fs.readFileSync(FILE,'utf8')).spec;
const S=SH.sceneBuild(spec,{garage:spec}); const TH=S.W.TAIL_HEADLESS||require(T+'_tail_headless.js'); const FS=S.FS; const mesh=S.built.sheet;
const REF=JSON.parse(fs.readFileSync(TAILJ,'utf8'));
const H=0.01;
// the reference polygons in the view's 2D (u = z, v = y for the fin; u = z, v = span for the stab, x > 0 half)
const refTris = PART==='fin' ? REF.fin.map(t=>t.map(p=>[p[2],p[1]])) : REF.stab.filter(t=>t.every(p=>p[0]>=-1e-6)).map(t=>t.map(p=>[p[2],p[0]]));
function raster(tris, box){ const [u0,v0,nu,nv]=box; const g=new Uint8Array(nu*nv);
  for(const t of tris){ let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity; for(const p of t){a=Math.min(a,p[0]);b=Math.max(b,p[0]);c=Math.min(c,p[1]);d=Math.max(d,p[1]);}
    const i0=Math.max(0,Math.floor((a-u0)/H)), i1=Math.min(nu-1,Math.ceil((b-u0)/H)), j0=Math.max(0,Math.floor((c-v0)/H)), j1=Math.min(nv-1,Math.ceil((d-v0)/H));
    const [A,B,C]=t; const den=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]); if(Math.abs(den)<1e-14) continue;
    for(let i=i0;i<=i1;i++){ const x=u0+(i+0.5)*H; for(let j=j0;j<=j1;j++){ const y=v0+(j+0.5)*H;
      const l1=((B[1]-C[1])*(x-C[0])+(C[0]-B[0])*(y-C[1]))/den, l2=((C[1]-A[1])*(x-C[0])+(A[0]-C[0])*(y-C[1]))/den; if(l1>=-1e-9&&l2>=-1e-9&&1-l1-l2>=-1e-9) g[j*nu+i]=1; } } }
  return g; }
function oursTris(over){ const P=Object.assign({}, S.P, over); let tb; try{ tb=TH.tailBuild(P,{level:2, mesh}); }catch(e){ return null; }
  const x=tb[PART]; if(!x) return null; const sh=x.disp||x.sheet; const out=[];
  const map = PART==='fin' ? p=>[p[2]*FS, p[1]*FS] : p=>[p[2]*FS + (x.lay.zOff||0)*FS, (p[1]-x.lay.sRef)*FS + (x.lay.rootX||0)];
  for(const f of sh.F){ const v=f.v||f; for(let k=1;k+1<v.length;k++) out.push([map(sh.V[v[0]]),map(sh.V[v[k]]),map(sh.V[v[k+1]])]); }
  return { tris: out, measure: x.measure }; }
let bx=[Infinity,-Infinity,Infinity,-Infinity]; for(const t of refTris) for(const p of t){bx[0]=Math.min(bx[0],p[0]);bx[1]=Math.max(bx[1],p[0]);bx[2]=Math.min(bx[2],p[1]);bx[3]=Math.max(bx[3],p[1]);}
const BOX=[bx[0]-0.8, bx[2]-0.6, Math.ceil((bx[1]-bx[0]+1.6)/H), Math.ceil((bx[3]-bx[2]+1.2)/H)];
const RG=raster(refTris,BOX); let nRef=0; for(const v of RG) nRef+=v;
// the control surface stays a control surface: the layer's own ctlFrac (the cut's share of the area - what the join
// flies as elevChord / rudChord) is held inside the flown envelope's 0.15 - 0.65, else an outline can win the IoU by
// shrinking the elevator to a sliver behind the hinge (the PT-17's first fit: 0.04)
const CTL=[0.18, 0.62];
function score(over){ const o=oursTris(over); if(!o) return 9; const g=raster(o.tris,BOX); let I=0,U=0; for(let k=0;k<g.length;k++){ if(g[k]&&RG[k]) I++; if(g[k]||RG[k]) U++; }
  const c=o.measure&&o.measure.ctlFrac; const pen = c==null ? 0 : (c<CTL[0] ? (CTL[0]-c)*3 : c>CTL[1] ? (c-CTL[1])*3 : 0);
  return 1-I/U+pen; }
const pre = PART==='fin' ? 'fin' : 'st';
const ROWS = PART==='fin' ? [['finHeight',0.5,1.8],['finChord',0.5,1.6],['finChordTip',0.3,1.5],['finSweep',-10,45],['finHinge',0.08,0.45],
  ['finTipZ',-0.6,0.6],['finTipY',-0.8,0.8],['finAftZ',-0.5,0.3],['finAftY',-0.9,0.6],['finBaseZ',-0.5,0.3],['finBaseY',-0.15,0.5],
  ['finMidY',-0.8,0.4],['finUY',-0.4,0.4],['finLEZ',-0.8,0.3],['finLEY',-0.2,0.4],['finShoulderZ',-0.1,0.5],['finShoulderY',-0.1,0.3],['finTopY',-0.3,0.3],
  ['finTERoot',-0.4,0.4],['finTEU',-0.4,0.2],['finTEMid',-0.4,0.2],['finSharpTip',0,3],['finSharpAft',0,3],['finSharpBase',0,3],['finSharpShoulder',0,3],['finSharpLE',0,3],['finRootFwd',-1.2,2.0]]
 : null;
const rows = ROWS || [];
if(PART==='stab'){ // the stab rows: the fin's laid flat (ST2FIN), with their page ranges where known, else the fin's
  const FG=require(T+'_fin_gen.js'); for(const [sk,fk] of Object.entries(FG.ST2FIN)){ const r=[['finHeight',0.5,1.8],['finChord',0.5,1.6],['finChordTip',0.3,1.5],['finSweep',-10,45],['finHinge',0.08,0.45],['finTipZ',-0.6,0.6],['finTipY',-0.8,0.8],['finAftZ',-0.5,0.3],['finAftY',-0.9,0.6],['finBaseZ',-0.5,0.3],['finBaseY',-0.15,0.5],['finMidY',-0.8,0.4],['finUY',-0.4,0.4],['finLEZ',-0.8,0.3],['finLEY',-0.2,0.4],['finShoulderZ',-0.1,0.5],['finShoulderY',-0.1,0.3],['finTopY',-0.3,0.3],['finTERoot',-0.4,0.4],['finTEU',-0.4,0.2],['finTEMid',-0.4,0.2],['finSharpTip',0,3],['finSharpAft',0,3],['finSharpBase',0,3],['finSharpShoulder',0,3],['finSharpLE',0,3],['finRootFwd',-1.2,2.0]].find(q=>q[0]===fk); if(r) rows.push([sk,r[1],r[2]]); } }
// --hold k=v,k=v (after the start JSON): rows SET and left out of the search - the user's shape choices held while the
// fitter places the rest (the DC-3, 27 Oct: "straighten only the rudder, not the fin leading edge", "round only the
// elevator's ends")
const HI=process.argv.indexOf('--hold'), HOLD={};
if(HI>0 && process.argv[HI+1]) for(const kv of process.argv[HI+1].split(',')){ const [k,v]=kv.split('='); HOLD[k]=+v; }
for(let i=rows.length-1;i>=0;i--) if(rows[i][0] in HOLD) rows.splice(i,1);
const cur={}; for(const [k] of rows) cur[k]= START[k]!==undefined?START[k]:(S.P[k]!==undefined?S.P[k]:0);
Object.assign(cur, START, HOLD);
let best=score(cur); const t0=Date.now(); console.log(PART,'start 1-IoU',best.toFixed(4),'rows',rows.length,'ref cells',nRef);
for(let pass=0, frac=0.25; pass<7; pass++, frac*=0.5){ let gain=false;
  for(const [k,lo,hi] of rows){ const st=(hi-lo)*frac; for(const dir of [1,-1]){ let moved=false; for(;;){ const v=Math.max(lo,Math.min(hi,cur[k]+dir*st)); if(v===cur[k]) break; const tr=Object.assign({},cur,{[k]:v}); const s=score(tr); if(s<best-1e-5){ best=s; cur[k]=v; moved=true; gain=true; } else break; } if(moved) break; } }
  console.log(' pass',pass,'step',frac.toFixed(4),'1-IoU',best.toFixed(4),((Date.now()-t0)/1000).toFixed(0)+'s'); }
const o=oursTris(cur); const rnd={}; for(const k in cur) rnd[k]=+(+cur[k]).toFixed(3);
fs.writeFileSync(OUT, JSON.stringify({rows:rnd, score:best, measure:o&&o.measure},null,1)); console.log(JSON.stringify(rnd)); console.log('measure', JSON.stringify(o&&o.measure).slice(0,300));
// the picture: reference cells green, ours grey, both = dark green; written raw for PIL
{ const g=raster(o.tris,BOX); const [u0,v0,nu,nv]=BOX; const buf=Buffer.alloc(nu*nv*3);
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const k=j*nu+i, q=((nv-1-j)*nu+(nu-1-i))*3; const a=g[k], b=RG[k];
    const c = a&&b ? [60,140,80] : b ? [150,230,160] : a ? [190,120,110] : [250,250,250]; buf[q]=c[0];buf[q+1]=c[1];buf[q+2]=c[2]; }
  writePNG(OUT.replace(/\.json$/,'')+'.png', buf, nu, nv); }
function writePNG(file, rgb, w, h) { const zlib=require('zlib');
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
