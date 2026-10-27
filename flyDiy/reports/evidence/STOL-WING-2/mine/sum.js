const fs=require('fs'),d=process.argv[2];
for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.log')).sort()){const t=fs.readFileSync(d+'/'+f,'utf8').trim().split('\n');let r;try{r=JSON.parse(t[t.length-1])}catch(e){console.log(f,'(running)');continue}
const lo=(r.phases.find(p=>p.startsWith('LIFTOFF'))||'-');console.log(f.padEnd(34),r.outcome.padEnd(18),lo.padEnd(14),'t'+r.t,(r.verdicts.find(v=>/reject/.test(v))||''))}
