const path=require('path'),fs=require('fs'),zlib=require('zlib');
const T=process.argv[2];
const FIX=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(T,'fixtures','stol_baseline.json.gz'))));
const LB=require(path.join(T,'_load_build.js'));
const D=require(path.join(T,'_stol_fp.js')).STOL_ROW_DEFAULTS;
for (const k of ['cub','floats']) { const B=FIX.builds[k];
  const J=(B.load.validated?LB.loadValidated(B.load.validated):LB.loadBuild(B.load.file)).spec;
  for (const w of J.wings||[]) { if (w&&w.stol===null) delete w.stol; if (w&&w.tipShape===null) delete w.tipShape; }
  for (const r of Object.keys(D)) if (J.cage) delete J.cage[r];
  const diff=[];
  const walk=(a,b,p)=>{ if (JSON.stringify(a)===JSON.stringify(b)) return; if (a&&b&&typeof a==='object'&&typeof b==='object'){ for (const q of new Set([...Object.keys(a),...Object.keys(b)])) walk(a[q],b[q],p+'.'+q);} else diff.push(p+': '+JSON.stringify(b)+' -> '+JSON.stringify(a)); };
  walk(J,B.spec,k); console.log(diff.slice(0,30).join('\n'), diff.length);
}
