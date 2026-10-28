// the true verdict per gate from a gatelogs dir: the battery table's row (ID PASS|FAIL|SKIP) decides; the line quoted is
// the first FAIL shard's `GATE ID: ...` line when it failed, else its PASS line
const fs=require('fs'),path=require('path');
module.exports=dir=>{const out=new Map();if(!fs.existsSync(dir))return out;
  for(const f of fs.readdirSync(dir).map(x=>path.join(dir,x)).sort((a,b)=>fs.statSync(a).mtimeMs-fs.statSync(b).mtimeMs)){
    const t=fs.readFileSync(f,'utf8');
    for(const m of t.matchAll(/^([A-Z0-9_-]+)\s+(PASS|FAIL|SKIP)\b/mg)){
      const id=m[1],v=m[2];const lines=[...t.matchAll(new RegExp('^GATE '+id+': (.*)$','mg'))].map(x=>x[1]);
      const q=v==='PASS'?(lines.find(l=>/^PASS/.test(l))||'PASS'):v==='SKIP'?'SKIP':(lines.find(l=>!/^PASS/.test(l))||'FAIL');
      out.set(id,{v,line:'GATE '+id+': '+q,file:path.basename(f),mt:fs.statSync(f).mtimeMs});}}
  return out;};
if(require.main===module){const d=module.exports(process.argv[2]);for(const [k,o] of d)if(o.v!=='PASS')console.log(k,o.line,o.file);}
