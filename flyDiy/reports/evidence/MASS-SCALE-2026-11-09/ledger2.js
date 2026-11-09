const path=require('path'); process.chdir('/tmp/claude-0/-workspace-DeGaRoR-github-io/4f908d22-ff33-5ae9-a5b8-4742f699e31b/scratchpad/pilot/flyDiy');
const RC=require(path.resolve('tools/real_check.js')); const C=require(path.resolve('tools/flight_core.js'));
for (const f of process.argv.slice(2)) {
  const {spec}=RC.loadSpec({file:f}); const def=C.buildGen(spec); const L=def.parts.ledger;
  const rows=Object.entries(L).filter(([k,v])=>!v.payload).map(([k,v])=>[k,+v.mass.toFixed(1)]).sort((a,b)=>b[1]-a[1]);
  console.log(f, rows.reduce((a,r)=>a+r[1],0).toFixed(1)); console.log(rows.map(r=>r.join(' ')).join(' | '));
}
