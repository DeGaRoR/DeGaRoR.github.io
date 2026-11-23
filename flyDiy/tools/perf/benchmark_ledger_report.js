'use strict';
// Render reviewed historical pairs and current validated studies into the ONE report.
const fs=require('fs'),path=require('path');
module.exports=function(root,focused){
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'evidence/PERFORMANCE-2026-11-20/benchmark-ledger.json'),'utf8'));
 const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
 const values=a=>a.map(n=>n.toFixed(3)).join(' / ');
 let text='## Measured change ledger — seconds, not cumulative claims\n\n'+ledger.rules+' For repeated runs the delta below uses their arithmetic means; individual times remain visible. Different clocks and fixtures are labelled. Historical pairs without repetition remain screening evidence.\n\n';
 text+='| Change | Scope | Control (s) | Candidate (s) | Shorter by (s) | Decision / evidence |\n| --- | --- | ---: | ---: | ---: | --- |\n';
 for(const e of ledger.entries){
  const delta=mean(e.controlSeconds)-mean(e.candidateSeconds);
  text+=`| ${e.change} | ${e.scope} | ${values(e.controlSeconds)} | ${values(e.candidateSeconds)} | ${delta.toFixed(3)} | ${e.status}. [Evidence](${e.evidence}) |\n`;
 }
 if(focused&&focused.complete){
  const valid=focused.runs.filter(r=>r.valid),controls=valid.filter(r=>r.mist&&r.damage),baseline=mean(controls.map(r=>r.seconds));
  for(const r of valid.filter(r=>!r.mist||!r.damage))text+=`| ${r.label} | Same build ${r.build}; startup-only; all five other prioritized systems, town, runway cues, cracks and physics retained | ${values(controls.map(c=>c.seconds))} | ${r.seconds.toFixed(3)} | ${(baseline-r.seconds).toFixed(3)} | Diagnostic exclusion only; one off-run, two bracketing controls. [Evidence](evidence/PERFORMANCE-2026-11-20/damage-mist-comparison/analysis.json) |\n`;
 }
 const nextPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/analysis.json');
 if(fs.existsSync(nextPath)){
  const study=JSON.parse(fs.readFileSync(nextPath,'utf8')),control=study.runs.find(r=>r.id==='control'&&r.valid);
  if(control){
   for(const r of study.runs.filter(r=>r.valid&&r.id!=='control'))text+=`| ${r.label} | Same build ${r.build}; original runway shader; single-run diagnostic | ${control.seconds.toFixed(3)} | ${r.seconds.toFixed(3)} | ${(control.seconds-r.seconds).toFixed(3)} | Exclusion only; no new quality preset enabled. [Evidence](evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/analysis.json) |\n`;
   const fieldPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/candidate-2/summary.json');
   if(fs.existsSync(fieldPath)){const r=JSON.parse(fs.readFileSync(fieldPath,'utf8'));if(r.bootHealth?.ok&&r.final&&!r.errors.length&&!r.garage.glError&&!r.final.glError&&r.garage.build===control.build)text+=`| Higher-level runway relief/curvature bake | Same build ${control.build}; mesh, cues and weather retained; one pair | ${control.seconds.toFixed(3)} | ${(r.garage.t/1000).toFixed(3)} | ${(control.seconds-r.garage.t/1000).toFixed(3)} | Opt-in prototype;128 MiB extra GPU texture plus CPU backing; controlled-patch images/GPU only. [Evidence](evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/candidate-2/summary.json) |\n`;}
  }else{
   for(const r of study.runs.filter(r=>r.valid))text+=`| ${r.label} | Separate screening; matched reference interrupted | — | ${r.seconds.toFixed(3)} | Not established | Actual ready time only; no marginal saving claim. [Evidence](evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/analysis.json) |\n`;
   const p=path.join(root,'evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/candidate-2/summary.json');if(fs.existsSync(p)){const r=JSON.parse(fs.readFileSync(p,'utf8'));if(r.bootHealth?.ok&&r.final&&!r.errors.length)text+=`| Higher-level runway relief/curvature bake | Build ${r.garage.build}; matched reference interrupted | — | ${(r.garage.t/1000).toFixed(3)} | Not established | Integrated/image/GPU prototype; default OFF;128 MiB extra GPU texture plus CPU backing. [Evidence](evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/candidate-2/summary.json) |\n`;}
  }
 }
 text+='\nNegative values mean slower. None of the rows may be added together: their changes, build states, shader overlap and controls differ. The current accepted-quality total must be read from its own controls, not reconstructed by subtracting this ledger from the original reference. A lower diagnostic time is not a delivered optimization.\n\nWork without an isolated whole-startup comparison (terrain-neighbour memoization, generator yielding, shadow-sampler correctness, readiness/polling fixes) stays documented without invented seconds saved. Compiler-only and image/GPU probes are listed in their own evidence sections; their seconds are not garage-loading savings. Safety stops, watchdog exits and GL-error runs remain failures and are excluded. Future sessions must add the control and candidate evidence, scene, source build, timing clock, validation outcome and visual scope before claiming another saving.\n\n';
 const mistPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json');
 if(fs.existsSync(mistPath)){
  const study=JSON.parse(fs.readFileSync(mistPath,'utf8')),control=study.runs.find(r=>r.id==='control'&&r.valid);
  if(control){text+='### Mist/scuff implementation screening\n\n| Change | Reference (s) | Candidate (s) | Shorter by (s) | Scope |\n| --- | ---: | ---: | ---: | --- |\n';for(const r of study.runs.filter(r=>r.valid&&r.id!=='control'&&r.build===control.build))text+=`| ${r.label} | ${control.seconds.toFixed(3)} | ${r.seconds.toFixed(3)} | ${(control.seconds-r.seconds).toFixed(3)} | Same build ${r.build}; one pair, not additive. Cloud-pass mist changes lighting/integration and needs review; scuff retains detail/restores mud. [Evidence](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json) |\n`;text+='\nThese screening results do not replace the repeated accepted-quality reference or establish a final visually approved preset.\n\n';}
 }
 const cooledPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/analysis.json');
 if(fs.existsSync(cooledPath)){
  const study=JSON.parse(fs.readFileSync(cooledPath,'utf8')),control=study.runs.find(r=>r.id==='control'&&r.valid);
  if(control){text+='### Latest same-build mist/scuff comparison\n\n| Configuration | Original-method reference (s) | Candidate (s) | Shorter by (s) | Evidence |\n| --- | ---: | ---: | ---: | --- |\n';for(const r of study.runs.filter(r=>r.valid&&r.id!=='control'&&r.build===control.build))text+=`| ${r.label} | ${control.seconds.toFixed(3)} | ${r.seconds.toFixed(3)} | ${(control.seconds-r.seconds).toFixed(3)} | Build${r.build}; fresh browser profiles, driver cache not erased. One run each; visual scope and screenshots in follow-up. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/analysis.json) |\n`;text+='\nNo sum of the scuff-only and combined differences is valid. Active-mist runtime observations and damage patch comparisons are post-cold diagnostics, not a complete scripted playtest.\n\n';}
 }
 const actualPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/mist-approved-default/analysis.json');
 if(fs.existsSync(actualPath)){const r=JSON.parse(fs.readFileSync(actualPath,'utf8')).runs.find(r=>r.valid);if(r)text+='### Approved mist B alone as the branch default\n\n'+r.seconds.toFixed(3)+'s, build'+r.build+', no mist/scuff query override; original scuff. Previous-build original-method reference161.865s: observed30.241s/18.7% shorter. Cloud-pass appearance explicitly approved after two A/B views; all other prioritized systems, town and full runway detail/cues retained, with accepted cliff/runtime-bake exclusions. This is not a repeated same-build marginal estimate. Normal-ready/GL/20s garage soak plus two unchanged-design trips passed; world FPS/hitches remain unresolved. [Evidence](evidence/PERFORMANCE-2026-11-20/mist-approved-default/analysis.json).\n\n';}
 return text;
};
