'use strict';
// One canonical document. Refresh after EVERY meaningful experiment/result.
// Earlier focused reports remain historical source records, embedded in full.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../reports');
const sources=[
 ['Initial audit and supplied-log analysis','PERFORMANCE-AUDIT-2026-11-18.md'],
 ['Shader observations','PERFORMANCE-SHADERS-2026-11-19.md'],
 ['Individual shader/world preparation inventory','SHADER-BREAKDOWN-2026-11-19.md'],
 ['Compiler experiments','COMPILER-OPTIMIZATION-2026-11-19.md'],
 ['Private Chrome state reconstruction','CHROME-PROFILE-2026-11-19.md'],
 ['Edited round-trip investigation','EDITED-ROUNDTRIP-2026-11-19.md'],
 ['Correct lamp prelink signature','LAMP-PRELINK-2026-11-19.md'],
 ['Visual tradeoffs and subsystem analysis','PERFORMANCE-TRADEOFFS-2026-11-19.md'],
 ['Static parked props and town tests','STATIC-PROPS-AND-TOWN-2026-11-19.md'],
 ['Baseline reconciliation and invalid comparisons','BASELINE-RECONCILIATION-2026-11-19.md'],
 ['Latest manual retest','MANUAL-RETEST-2026-11-19.md'],
 ['Ground branch specialization','GROUND-SPECIALIZATION-2026-11-19.md'],
 ['Material/lighting prototype','MATERIAL-CACHE-PROTOTYPE-2026-11-19.md'],
 ['Success/failure ledger and traps','PERFORMANCE-ATTEMPTS-2026-11.md']
];
const evidence='evidence/PERFORMANCE-2026-11-19/material-cache';
const decisionPath=path.join(root,evidence,'integration-journal.json');
const decision=fs.existsSync(decisionPath)?JSON.parse(fs.readFileSync(decisionPath,'utf8')).entries.findLast(e=>e.id==='Final integrated comparison and decision'):null;
const featureStudyPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/feature-isolation/analysis.json');
const featureStudy=fs.existsSync(featureStudyPath)?JSON.parse(fs.readFileSync(featureStudyPath,'utf8')):null;
const focusedPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/damage-mist-comparison/analysis.json');
const focused=fs.existsSync(focusedPath)?JSON.parse(fs.readFileSync(focusedPath,'utf8')):null;
const scuffStudyPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/analysis.json');
const scuffStudy=fs.existsSync(scuffStudyPath)?JSON.parse(fs.readFileSync(scuffStudyPath,'utf8')):null;
const mistScuffPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json');
const mistScuff=fs.existsSync(mistScuffPath)?JSON.parse(fs.readFileSync(mistScuffPath,'utf8')):null;
const mistScuffFinalPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization-final/analysis.json');
const mistScuffFinal=fs.existsSync(mistScuffFinalPath)?JSON.parse(fs.readFileSync(mistScuffFinalPath,'utf8')):null;
const runwayPath=path.join(root,'evidence/PERFORMANCE-2026-11-20/runway-field-study/results.json');
const runwayStudy=fs.existsSync(runwayPath)?JSON.parse(fs.readFileSync(runwayPath,'utf8')):null;
let runwayReport='';
if(runwayStudy){
 runwayReport='## Runway higher-level bake: measured compiler targets\n\nSource interventions on the captured full pavement program, visible real-GPU Chrome, one program at a time. Field-read surrogates use variable texture values so downstream material branches stay live. These are not production caches or visually validated images. They exclude bake generation, upload, storage, first draw and runtime sampling costs. This study therefore establishes **no delivered garage-loading saving**.\n\n| Intervention | Complete program link (s) | Shorter than original (s) | Linked / GL error |\n| --- | ---: | ---: | --- |\n';
 for(const run of runwayStudy.runs){const original=run.rows.find(r=>r.family==='Original');for(const r of run.rows)runwayReport+=`| ${r.name} | ${(r.ms/1000).toFixed(3)} | ${original?((original.ms-r.ms)/1000).toFixed(3):'pending'} | ${r.ok} / ${r.glError} |\n`;}
 runwayReport+='\nOne order only; no reliable per-system additive attribution. Shape fields together are a better compiler target than the failed low-level noise-corner cache. Relief/curvature, holes/hazards and ways must be considered together, with weather/wear-dependent amplitudes and narrow ruts preserved. The humidity intervention changes only colour/roughness modulation inside the cue block; it retains live puddle filling and is not permission to remove wetness. Its single-run difference does not justify a quality cut.\n\nNext runway experiment: precompute higher-level shape fields or compact hole/track descriptors once per runway, keep the original geometry/contact and texture cues, include generation/invalidation/memory cost in the benchmark, compare dry/wet images with a cues-off negative control, then re-benchmark whole startup and GPU cadence. Do not enable a cache based on compiler-only numbers. [Raw results](evidence/PERFORMANCE-2026-11-20/runway-field-study/results.json), [source intervention scope](evidence/PERFORMANCE-2026-11-20/runway-field-study/scope.json).\n\n';
}
let text=`# Wingsmith performance — consolidated living report

Updated: ${new Date().toISOString()}. Branch: codex/wingsmith-performance-audit. This is the single report to read and update for subsequent sessions. It includes observations, analysis, successes, failed attempts, measurement corrections and data references. The current summary takes precedence over historical next-step/status statements reproduced below.

${decision&&decision.summary?'## Current decision\n\n'+decision.summary+'\n':''}

${require('./benchmark_ledger_report.js')(root,focused)}
${require('./mist_scuff_followup_report.js')(root)}
${mistScuffFinal?mistScuffFinal.reportMarkdown:''}
${mistScuff?mistScuff.reportMarkdown:''}
${focused?focused.reportMarkdown:''}
${scuffStudy?scuffStudy.reportMarkdown:''}
${require('./optimization_followup_report.js')(root)}
${runwayReport}
${featureStudy?featureStudy.reportMarkdown:''}
## Visual scope of the benchmark options

These options are experiments, not an approved final graphics preset. User decision: keep runway micro-relief cues; replace their repeated calculations with precomputed fields if validation succeeds.

| Test option | What is excluded or changed | What remains |
| --- | --- | --- |
| perftrim=1 (common recent reference) | R1 cliff/rock shader path, bias worker, fallback rock map, procedural rock ring; player-derived parked fleet generation and flown-bake module initialization | Prior simple cliff textures; mountain geometry; three prebuilt Cub/C172/Jodel props; flown aircraft render/physics |
| Extra scenery/effects cuts (121.247 s, or combined 95.740 s) | mk_ town records including the usual keep exceptions; extra forest band; sub-alpine classification; pocket/forest mist veil; ambient animals; generated scenery cars and road traffic; dust including mud/snow classes; aircraft spray/splash pools; new damage/scuff visuals; crack-sheet fetch | Baseline forest, mountain terrain, main water/waves/reflections, other fog/clouds, AFB02/20, authored static car props and player vehicle modules, damage physics |
| pavmicro=0 (152.447 s alone; 95.740 s combined) | Shader bump, hollow, rut, fine normal, wetness/puddle relief cues on applicable nongrass soft strips | Physical micro-relief/contact, strip mesh, base material textures, CPU alpha. **Not accepted as a final solution: these cues are required.** |
| pavnoise=1 (new validation) | Replaces repeated integer noise hashing with exact precomputed corner coefficients for six relief octaves and two lump fields | Existing interpolation, micro-relief cues, weather/wear, wetness, puddles, material blending, geometry/contact; no extra scenery cuts implied. Adds bounded CPU/GPU texture storage. Must prove browser correctness and net benefit. |

The 95.740-second result must always be labelled **combined visual-cut diagnostic**. Do not present its saving as a preserved-visual optimization or attribute it to the runway shader alone. The new noise cache is opt-in while under test. Hard/soft shader splitting was measured in isolation and rejected; no material split was integrated.

## Objectives and constraints

- Immediately usable garage under 20 seconds, without post-loading freezes; world departure at most 30 seconds; fast repeated garage/world iteration after design edits.
- Eliminate compilation/repeated work first. Later, stage studio → furnished garage → world within the same editor/state, with a smooth transition around the aircraft. Background loading must not simply move blocking work behind an interactive screen.
- Preserve visuals. No reductions without explicit consent and a scoped benefit argument. Accepted cuts for the current configuration: advanced cliffs and player-derived aircraft bakes only. Preserve the town and all seven user-prioritized systems. Single-system exclusions are diagnostic measurements only, not approved quality reductions. User requires runway micro-relief cues; their removal is not an accepted final solution.
- RTX 3080 driver updated, reference 621.24; real visible Chrome, saved game-state fixture, 5120×1271 viewport/DPR 1. The fixed integration fixture's active design is Piper Cub (confirmed from saved build metadata and screenshots). It is not a reconstruction of every earlier Mosquito/studio manual test. Browser rendering tests take precedence over optimistic internal summaries. Native F11 fullscreen was not independently verified.
- User's private fixture is external to this report/repository. No clearing or modifying the user's real Chrome profile. No publication or generated-main-page commits.

## Current evidence and interpretation

| Observation | Result / interpretation |
| --- | --- |
| Latest manual playtest | Studio 2:56; backdrop off 1:22; another 19 s until garage stops lagging; departure 54 s; return ~2 s. Published build 48a71176c5a6. |
| Historical 6–9-minute launch | Valid historical evidence, retired by user as the active target after the fresh manual retest. Do not chase driver/profile differences without recurrence. |
| Corrected full-hangar browser comparison | Master 243.853 s → existing combined audit 211.248 s, one pair (~13.4%). Do not attribute the entire difference to a single change. Studio/full hangar must be labelled separately. |
| Shader critical path | Ground and pavement are conspicuously expensive; link submission-to-observed-completion intervals overlap and are not exclusive compiler times. Never sum them into recoverable time. |
| Exact terrain neighbour cache | 71,148 equivalence checks; retained CPU work reduction. |
| Generator yielding | Largest measured generator task ~7.2 → 2.5 s; total work still about 32 s. Better responsiveness, not a total-work reduction. |
| Lamp-signature correction | Prevents obsolete light-count variants. Retained; studio comparisons around twenty seconds better. |
| Shadow array fallback | Real comparison-mode correctness fix; corrected captures have no GL draw errors. Not independently a loading win. |
| Static fleet / compact town | No cold-loading win demonstrated in matched tests. Does not settle near-town FPS or fleet swapping. Cooked-city subset reconciliation bug invalidated the first town test. |
| Small shader rewrites | Rock-loop saving failed repetition; far-one ground variant slower in both orders; other reductions in links did not improve readiness. Full ledger below. |
| Split ground material/lighting prototype | Isolated coarse compile 33.329 → 19.007 s; reversed 34.518 → 21.961 s (36–43% lower for that program). Not whole-game savings. |
| Split rendered acceptance | One fine tile, controlled lighting, overhead/oblique: mean RGB byte errors 0.00716 / 0.00981; max 1/255; no GL errors. Inverted normals correctly fail (mean error 23.718). Other recipes/tiers/weather not yet broadly accepted. |
| Split GPU work | Full-viewport terrain stress test: 19.969 ms original vs 19.504 ms split medians, twelve samples each. Roughly equal; not game FPS. Extra material buffers ~99.30 MiB at 5120×1271, excluding depth. |

## Live integration and browser re-benchmark

The functional packed integration is query-flagged with **groundcache=2**. It generates standard-material builder/lighting sources from hooks and shader chunks BEFORE original GL compilation, stores the same eight half-floats in one RGBA32UI buffer, and uses a ground-only material pass. Original hooks/materials remain available for groundcache=0 control. The earlier groundcache=1 MRT path is retained only to reproduce its failed first-use experiment; do not use it for acceptance. The render path rebuilds material data for each rendered view and uses live lighting/shadows in the final scene; no feature is deliberately removed. Loading readiness and texture upload walks include both derived materials; render-target textures are initialized through the renderer's target path. Default remains off while full-loading benefit and broader quality/runtime acceptance are assessed. The unsuccessful shaderlogs policy was reverted from production code.

Actual whole-game results appear below as soon as each run saves its summary. No result without normal readiness and an error assessment counts as a successful optimization. First-run failures and aborted work remain visible.

`;
const dir=path.join(root,evidence);
const criticalFile=path.join(dir,'critical-path.json');
if(fs.existsSync(criticalFile)){
 const c=JSON.parse(fs.readFileSync(criticalFile,'utf8'));
 text+='## Garage wait: reconciled elapsed-time waterfall\n\nControl integrated-control-2, saved Piper Cub, full hangar, groundcache=0. The loading-system clock runs **217.185 seconds** to cover removal; navigation-to-observed-ready is **218.046 seconds**. Their difference includes clock-origin and polling differences; do not invent its location in the waterfall. All 24 logged steps plus explicit gaps reconcile exactly to cover removal.\n\n';
 text+='| Lane | Start (s) | End (s) | Elapsed (s) | What the player is waiting for |\n| --- | ---: | ---: | ---: | --- |\n';
 for(const s of c.spans)text+=`| ${s.name} | ${(s.startMs/1000).toFixed(3)} | ${((s.startMs+s.durationMs)/1000).toFixed(3)} | ${(s.durationMs/1000).toFixed(3)} | ${s.attributes.Explanation} |\n`;
 text+='\n### What remains unknown before another optimization\n\n'+c.limits.map(s=>'- '+s).join('\n')+'\n\nThe next measurement must capture creation-time material/object ownership, shader family and exact vertex/fragment identity, render-pass and light-count variants, last-pending/first-ready observations, polling gaps, blocking GL calls and first draws, on a shared clock. Record which pending programs each readiness gate actually awaits. Avoid high-frequency forced GL status polling that changes the benchmark. Validate overhead against an uninstrumented run. Until then, a suspected expensive shader is not a measured number of recoverable seconds.\n\n### Handover leads, not new instructions or proven attribution\n\nflyDiy/HANDOVER.md lines 317246 and 317495–317529 record an earlier 143 → 205–215 s loading regression with a bisect outstanding, increased world draw calls, 2.2–2.6× vegetation shadow triangles and extra strip geometry. Investigate these historical changes against controlled versions; do not treat their runtime costs as startup shader costs. Current focus: attribution and critical path; pause further speculative shader rewrites.\n\nRaw reconciled spans: [critical-path.json]('+evidence+'/critical-path.json).\n\n';
}
const reviewFile=path.join(dir,'critical-review.json');
if(fs.existsSync(reviewFile)){
 const review=JSON.parse(fs.readFileSync(reviewFile,'utf8'));
 text+='## Critical review of the large startup gates\n\n';
 for(const item of review.items)text+=`### ${item.title}\n\n${item.body}\n\n`;
}
const shaderPath=path.join(root,'evidence/PERFORMANCE-2026-11-19/shader-critical-path/analysis.json');
if(fs.existsSync(shaderPath)){
 const a=JSON.parse(fs.readFileSync(shaderPath,'utf8'));
 text+='## New ownership and pending-tail capture — 20 November\n\nNormal browser readiness passed in about 214 s on unchanged runtime build ee694f8981b9. This is diagnostic, not a claimed speedup. Creation-time interception attributes '+a.creationAttributedPrograms+' of '+a.totalPrograms+' program instances to material records. Scene paths and shader keys provide finer subsystem identification for only part of that set; generic/shared materials remain unresolved. The hook adds no GL queries, but its CPU overhead has not been isolated. Two sparse-tree impostor warnings were captured; they are retained in the diagnostic log.\n\n';
 text+='**Important: settle did not finish.** It stopped at '+a.settle.n+' updates after '+a.settle.ms+' ms, rest=false, premises near=0, fill busy=true, with '+a.settle.fill.queued+' queued fill entries. Do not describe this gate as guaranteeing an idle scene. The 40 ms slicing budget and 1500-update limit need completion-condition review before tuning.\n\n';
 text+='World shader gate: 100.157–195.644 s (95.487 s). Fine-ground program #143 was submitted at 85.500 s, last observed pending near 195.564 s and then completed; the following shadow variants finish near 195.64 s. Coarse ground #19 completed by 155.206 s; pavement #22 by 144.314 s. This identifies fine ground as a near-final readiness dependency, not proof that deleting it saves 95 s: other compilation proceeds in parallel and submission order/driver contention matter.\n\n';
 text+='Synchronous renderer.compile calls inside the world gate total '+(a.synchronousCompileCallMs/1000).toFixed(3)+' s. This excludes other JavaScript, query blocking, asynchronous compilation and scheduling waits; it is not a complete CPU accounting.\n\n';
 text+='| Identified family | Program instances | New links submitted in world gate | Representative program | Submission → observed ready (s) |\n| --- | ---: | ---: | ---: | --- |\n';
 for(const g of a.groups){const r=g.representative;text+=`| ${g.family} | ${g.programs} | ${g.worldGateSubmissions} | ${r.id} | ${r.submitted.toFixed(3)} → ${r.ready===null?'unobserved':r.ready.toFixed(3)} |\n`;}
 text+='\n'+a.method+' The 373 other/shared instances are not 373 unknown source texts; their exact sources are saved, but subsystem ownership is insufficiently resolved. Cloud composite is identified; cloud volume/history passes are not fully attributed.\n\nRaw ownership, exact shader sources, query observations, compile calls, BOOT clock origin and health: evidence/PERFORMANCE-2026-11-19/shader-critical-path. Next: combine the game recorder and Chrome main-thread trace with explicit per-streamer counters; use existing scripted scenarios for later repeat-trip/flight acceptance. No further speculative shader rewrites until this attribution is usable.\n\n';
}
const investigationPath=path.join(dir,'ground-investigation.json');
if(fs.existsSync(investigationPath)){
 const a=JSON.parse(fs.readFileSync(investigationPath,'utf8'));
 text+='## Focused ground, runway and ecosystem investigation — 20 November\n\n'+a.profileScope+'\n\n';
 text+='### Repeated cliff/rock compiler diagnostic\n\n| Ground | Variant | Mean compile/link (s) | Original order (s) | Reverse order (s) |\n| --- | --- | ---: | ---: | ---: |\n';
 for(const r of a.compilerRows)text+=`| ${r[0]} | ${r[1]} | ${r[2].toFixed(3)} | ${r[3].toFixed(3)} | ${r[4].toFixed(3)} |\n`;
 text+='\nThe diagnostic GS_NOTROND exclusion was injected only into captured source for an isolated compiler test. No gameplay visual was removed or changed. Fresh Chrome profiles, shader disk cache disabled, one program at a time, same RTX 3080; original order then reversed order. Driver-level caching was not independently eliminated. These are compiler comparisons, not full-load savings. All eight links passed.\n\n';
 text+='### Measured CPU work\n\n| Group | Execution (s) |\n| --- | ---: |\n';
 for(const r of [...a.cpuGroups,...a.settleScopes])text+=`| ${r[0]} | ${r[1].toFixed(3)} |\n`;
 text+='\nGenerator execution total '+a.generatorExecutionSeconds.toFixed(3)+' s. The listed generation groups are yield-boundary groups, not exclusive feature attribution. The listed settling scopes are only part of a '+(a.settle.ms/1000).toFixed(3)+'-second instrumented settle; do not sum them into the earlier control run.\n\n'+a.findings.map(s=>'- '+s).join('\n')+'\n\n### Actions to pursue, in order\n\n';
 for(const r of a.actions)text+=`**${r.priority}. ${r.title}.** ${r.scope}\n\nExpected benefit/evidence: ${r.benefit}\n\nAcceptance: ${r.acceptance}\n\n`;
 text+='Raw Chrome profile and recorder scopes: evidence/PERFORMANCE-2026-11-19/geometry-cpu-profile/{chrome.cpuprofile,stage-data.json}. Compiler source/result pairs: evidence/PERFORMANCE-2026-11-19/shader-critical-path/cliff-compiler-*.json. The normal runtime is unchanged.\n\n';
}
const retainedPath=path.join(dir,'retained-study.json');
if(fs.existsSync(retainedPath)){
 const s=JSON.parse(fs.readFileSync(retainedPath,'utf8'));
 text+='## Retained cuts, terrain memo repair and guarded benchmarks\n\nUpdated '+s.updated+'. This section supersedes earlier proposed actions where they have now been implemented or tested.\n\n';
 if(s.matched){const m=s.matched;text+=`**Completed matched scenery comparison:** ${m.baselineSeconds.toFixed(3)} → ${m.cutSeconds.toFixed(3)} s, ${m.savingSeconds.toFixed(3)} s (${(m.savingFraction*100).toFixed(1)}%) lower in this pair. ${m.limits} The revised user ceiling is90°C, automatic stop85°C; sampled peak80°C in each completed run. Extra cuts remain diagnostic options, not the default trimmed profile.\n\n`;}
 text+='| Run | Status | Garage ready (s) | Sampled CPU peak (°C) | Build |\n| --- | --- | ---: | ---: | --- |\n';
 for(const r of s.runs)text+=`| ${r.name} | ${r.status} | ${r.garageSeconds===null?'—':r.garageSeconds.toFixed(3)} | ${r.thermal.peakC===null?'not recorded':r.thermal.peakC} | ${r.build||'—'} |\n`;
 text+='\n';for(const n of s.notes)text+='- '+n+'\n';
 text+='\n### Preparation and round-trip details\n\n| Completed run | World geometry (s) | Settle (s) | World shader gate (s) | Hangar shader gate (s) | Worst garage rAF gap (ms) |\n| --- | ---: | ---: | ---: | ---: | ---: |\n';
 for(const r of s.runs.filter(r=>r.valid))text+=`| ${r.name} | ${r.phases.world.toFixed(3)} | ${r.phases.settle.toFixed(3)} | ${r.phases.worldCompile.toFixed(3)} | ${r.phases.compile.toFixed(3)} | ${r.garageResponse?r.garageResponse.max.toFixed(1):'—'} |\n`;
 text+='\n';for(const r of s.runs.filter(r=>r.valid)){text+='**'+r.name+'**: '+(r.trips.length?r.trips.map(t=>t.name+' '+t.seconds.toFixed(3)+' s'+(t.profiled?' (following soak CPU-profiled)':'')).join('; '):'boot-only, no round-trip claim')+'.\n\n';}
 text+='### Further diagnosis: what is already baked or optimized\n\n';
 for(const t of s.terrain)text+=`**${t.item}.** ${t.finding}\n\nNext action: ${t.action}\n\n`;
 text+='Raw summaries, shader sources, CPU profiles and temperature logs are in the named evidence directories. The failed thermal run and interrupted host-crash run remain excluded. No generated main files are committed, and nothing is published.\n\n';
}
const roadResult=path.join(dir,'trimmed-road-bounds-3/summary.json');
if(fs.existsSync(roadResult)){
 const r=JSON.parse(fs.readFileSync(roadResult,'utf8'));
 if(r.final&&r.bootHealth&&r.bootHealth.ok&&!r.errors.length)text+='## Exact road bounds: completed browser validation\n\n**Retained.**161.388 s garage versus164.592 s prior reference:3.203 s/1.9% observed, single comparison, not a fixed saving. Town/ecosystems/effects and runway cues retained; common cliff/bake exclusions remain. Two departures9.468/8.813 s, returns0.365/0.322 s.20 s garage soak: maximum18 ms rAF gap, no gaps over100 ms. Zero captured GL errors; two pre-existing sparse-impostor warnings remain.\n\n100,940 exact-result comparisons over97 roads pass for coverAt (sides and pavement-only), treePaveAt, pavedNear and pavedAt. The five callers use finite maximum influence distances with the existing index; other consumers still request exact unbounded distance. No road/terrain geometry, vegetation rules or visual density change. Captured pavement vertex and fragment source IDs are identical to reference.\n\nWorld generation35.033→31.933 s; nearby settle18.042→16.513 s; world shader gate72.849→70.724 s; hangar shader gate6.927→10.347 s. Gates overlap compilation and are not additive shader bills. This remains a modest CPU optimization, not the20-second-garage solution. Earlier attempts stopped at85/86°C and are excluded. Completed peak84°C under explicit87°C guard, user ceiling90°C.\n\nEvidence: '+evidence+'/road-bounds-cpu-check.json, road-bounds-source-check.json, trimmed-road-bounds-3/summary.json and thermal.jsonl.\n\n';
}
const noiseResult=path.join(dir,'trimmed-pavnoise-1/runway-bright-gpu-metrics.json');
if(fs.existsSync(noiseResult)){
 const a=JSON.parse(fs.readFileSync(noiseResult,'utf8'));
 text+='## Runway cues preserved: exact coefficient-cache experiment\n\n**Correctness passed for the tested patch; performance rejected. Default remains the original full-cue shader.** CPU checks:20,000 integer hashes and80,000 exact noise samples. Browser load182.456 s versus earlier164.592 s reference; not a saving. Both round trips passed.12 fields,8 MiB GPU texture plus8 MiB CPU backing,8.3 ms generation. Scope: '+a.scope+'\n\n| Wetness | Mean byte error | Maximum byte error | Difference when cues disabled |\n| --- | ---: | ---: | ---: |\n';
 for(const c of a.cases)text+='| '+c.wet+' | '+c.meanByteError+' | '+c.maxByteError+' | '+c.negativeControlMean.toFixed(3)+' |\n';
 text+='\nFull-width5120×1271 controlled patch GPU samples (ms), original: '+a.gpu.reference.map(x=>x.toFixed(3)).join(', ')+'. Cached: '+a.gpu.cached.map(x=>x.toFixed(3)).join(', ')+'. Extra texture lookups did not improve this test. These are not full-game frame times. Dry/wet images, metric JSON and captured source identities are under '+evidence+'/trimmed-pavnoise-1/. CPU peak84°C, below user90°C ceiling. The prototype remains opt-in for diagnosis, not enabled as a shipped optimization.\n\n';
}
const pavementPath=path.join(root,'evidence/PERFORMANCE-2026-11-19/pavement-split/analysis.json');
if(fs.existsSync(pavementPath)){
 const a=JSON.parse(fs.readFileSync(pavementPath,'utf8'));
 text+='## Next priority: pavement compiler structure\n\n'+a.scope+'\n\n| Compiler case | First order (s) | Reverse order (s) |\n| --- | ---: | ---: |\n';
 for(const r of a.rows)text+=`| ${r.name} | ${r.seconds[0].toFixed(3)} | ${r.seconds[1].toFixed(3)} |\n`;
 text+='\nHard+soft totals: '+a.hardSoftTotals.map(v=>v.toFixed(3)).join(' / ')+' s versus original '+a.original.map(v=>v.toFixed(3)).join(' / ')+' s. '+a.decision+'\n\nThe implemented pavmicro=0 diagnostic changes only the shader micro-relief cue block and its program cache key. All strip/road/polygon geometry, physical contact, recipe textures and CPU alpha functions remain unchanged; VM checks compare the exact functions and shader substitution. It affects visual bump/hollow/rut/wet cues on applicable non-grass soft strips. It is not enabled by default. User subsequently required those cues to remain: this switch is only a cost diagnostic, not a proposed final graphics setting. No hard/soft material split was integrated.\n\n';
}
if(fs.existsSync(dir))for(const name of fs.readdirSync(dir).filter(n=>/^integrated-/.test(n)).sort()){
 const file=path.join(dir,name,'summary.json');if(!fs.existsSync(file))continue;
 const r=JSON.parse(fs.readFileSync(file,'utf8'));
 text+=`### ${name}\n\n`;
 text+=`Query: ${r.query}. Build: ${r.garage&&r.garage.build||r.failure&&r.failure.build||'not yet recorded'}. Normal boot health: ${r.bootHealth?r.bootHealth.ok:'not yet recorded'}.\n\n`;
 text+=`Garage readiness from navigation: ${r.garage?(r.garage.t/1000).toFixed(3)+' s':'not completed'}.\n\n`;
 const invalid=!!((r.garage&&r.garage.glError)||(r.errors&&r.errors.length)||(r.pageErrors||[]).some(e=>/Shader Error|not compiled|VALIDATE_STATUS/.test(e)));
 text+=`Rendered benchmark status: **${invalid?'INVALID / unsuccessful; exclude from speed claims':r.final?'completed; assess detailed errors and scope':'in progress, not yet accepted'}**.\n\n`;
 if(r.operations&&r.operations.length)text+='| Operation | Seconds |\n| --- | ---: |\n'+r.operations.map(o=>`| ${o.name} | ${(o.ms/1000).toFixed(3)} |`).join('\n')+'\n\n';
 text+=`Recorded errors: ${JSON.stringify(r.errors||[])}. Page errors: ${JSON.stringify(r.pageErrors||[])}.\n\n`;
 if(r.garage&&r.garage.cache)text+=`Integration counters at readiness: ${JSON.stringify(r.garage.cache)}.\n\n`;
 text+=`Full data: [${name} summary](${evidence}/${name}/summary.json); program sources, phase submissions and long tasks: ${name}/programs.json.gz.\n\n`;
}
const journal=path.join(dir,'integration-journal.json');
if(fs.existsSync(journal)){text+='## Integration observations and corrective actions\n\n';for(const entry of JSON.parse(fs.readFileSync(journal,'utf8')).entries)text+=`### ${entry.id} — ${entry.status}\n\n${entry.observation||entry.summary||''}\n\nCorrection / next action: ${entry.action}\n\n`;}
const comparisonFile=path.join(dir,'integrated-comparison.json');
if(fs.existsSync(comparisonFile)){
 const c=JSON.parse(fs.readFileSync(comparisonFile,'utf8'));
 text+='## Matched integration comparison and post-ready behaviour\n\n'+c.method+'\n\n';
 text+='| Run | Garage ready (s) | World compile row (s) | Garage compile row (s) | Worst garage rAF gap (ms) |\n| --- | ---: | ---: | ---: | ---: |\n';
 for(const r of c.runs)text+=`| ${r.name} | ${r.garageSeconds.toFixed(3)} | ${(r.phaseMs.worldCompile/1000).toFixed(3)} | ${(r.phaseMs.compile/1000).toFixed(3)} | ${r.garageResponse.maxMs.toFixed(1)} |\n`;
 text+='\nThese phase wall times are waits/elapsed work boundaries, not exclusive compiler costs. Compilation overlaps and may finish while a different phase is active. Do not add per-program completion delays or interpret a reduced worldCompile row as an equal startup saving.\n\n';
 text+='| Run | Combined ground program instances | Builder instances | Reader instances |\n| --- | ---: | ---: | ---: |\n';
 for(const r of c.runs)text+=`| ${r.name} | ${r.inventory.combinedGround} | ${r.inventory.builder} | ${r.inventory.reader} |\n`;
 text+='\nThe combined-ground count above means the standard-lit coarse/fine material programs identified by their full material main and PhysicalMaterial block. It does not claim that pavement or every Lambert/outer-ground shader was replaced. The cold census for retained runs is captured before numerical image/GPU diagnostic work. Subsequent reference programs are excluded.\n\n';
 text+='| Run | Second world visit rAF median (ms) | p99 (ms) | First world visit worst gap (ms) |\n| --- | ---: | ---: | ---: |\n';
 for(const r of c.runs){const first=r.operations.find(o=>o.name==='departure-1'),second=r.operations.find(o=>o.name==='departure-2');text+=`| ${r.name} | ${second.response.p50Ms.toFixed(1)} | ${second.response.p99Ms.toFixed(1)} | ${first.response.maxMs.toFixed(1)} |\n`;}
 text+='\nThese are short ~5-second scheduling samples, not a completed circuit or isolated GPU measurement. They suggest a runtime cost that the terrain-only GPU microbenchmark misses. Extra traversal and ground shading before non-ground occlusion are plausible contributors, not separately measured attributions. Detailed results, frame gaps, operations, source submissions and image dimensions: [comparison data]('+evidence+'/integrated-comparison.json).\n\n';
}
const imageResult=path.join(dir,'integrated-candidate-7/packed-image-result.json');
if(fs.existsSync(imageResult)){
 const r=JSON.parse(fs.readFileSync(imageResult,'utf8')).value;
 text+='## Packed-path rendered and GPU acceptance\n\nControlled live fine-terrain test; reference reconstructs the complete original material prefix and original lighting tail from the current shaders. It is compiled only after the cold loading/round-trip measurements. Same test lighting is applied to reference/candidate; world shadow maps are retained.\n\n';
 for(const row of r.cases)text+=`- ${row.name}: ${row.coveredPixels} covered pixels; mean absolute RGB byte error ${row.meanAbsoluteByteError.toFixed(6)}, p99 ${row.p99ByteError}, max ${row.maxByteError}; pass=${row.pass}; GL errors=${row.glErrors.length}.\n`;
 text+=`\nDeliberately inverted normals: mean RGB error ${r.negativeControl.invertedNormalsMeanByteError.toFixed(3)}, detected=${r.negativeControl.detected}. Full data and PNGs are in ${evidence}/integrated-candidate-7/.\n\n`;
 const gpuFile=path.join(dir,'integrated-candidate-7/packed-gpu-cost.json');
 if(fs.existsSync(gpuFile)){const g=JSON.parse(fs.readFileSync(gpuFile,'utf8')).value;text+=`5120×1271 GPU-query stress test, twelve alternating samples per path: original median ${g.original.medianMs.toFixed(3)} ms; packed split ${g.split.medianMs.toFixed(3)} ms. Extra material storage ${g.materialCacheMiB.toFixed(2)} MiB, excluding depth/final target. ${g.scope} No GPU time or game-FPS improvement is established by this near-equal result.\n\n`;}
 text+='Whole-game garage/world screenshots were inspected at reduced preview size. This checks gross appearance in the saved night scene, not full pixel equivalence under every AA mode, recipe, shore, weather or cockpit/crash view.\n\n';
}
text+=`## Measurement rules and remaining acceptance

Require normal ready evidence, idle loading chain and no fail/error records: a watchdog removing the cover is not success. Compare like-for-like scenes, saved content, viewport, settings and draw-error instrumentation. Measure from actual button input to advancing simulation; the rollout panel alone misses pre-panel stalls. Fresh profiles do not by themselves prove an empty driver shader cache. Keep compiler-only tests separate from whole-game loading and GPU render timings.

Completed in this batch: live integration, repeated normal-ready packed startup, same-build control, two unchanged-design round trips per passing run, cold shader-source census, pixel/normal negative-control checks, whole-scene screenshots, GPU stress samples and post-ready frame-gap measurements. The under-20-second garage and no-freeze objectives are NOT achieved. The roughly 8-second world departures in this fixture already occurred in the controls, so they are not an optimization saving. These full-hangar Piper Cub runs must not be presented as a direct before/after of the user's studio/Mosquito manual test.

Remaining acceptance: edited-aircraft iteration, full scripted circuit, cockpit/crash cases, other terrain recipes/tiers/shore/weather/AA boundaries, long-run material/resource ownership and explicit UI input acknowledgement. Current scheduling samples already warn of slower world cadence with the extra pass. Keep the flag off by default pending that work.

Next optimization priorities: direct active-recipe/pavement shader specialization with correct invalidation, and caching deterministic world geometry/masks. Existing CPU evidence measures ~31.6 seconds of generator execution (patch ~7.25 s, aerodromes ~6.86 s, roads bucket ~5.10 s), which gives targets, not guaranteed recoverable wall time. Avoid more camera-dependent passes without proving net runtime value. The approved garage/world separation remains relevant to the 20-second objective, but must not be sold as reducing total preparation work.

The scripted baseline already present is tools/flight_scripts/perf/main_journey.json, with tools/flight_script.js --runner page; home_circuit.json is the shorter circuit smoke case. Use tools/RIG-PROCEDURE.md and the shared page rig; do not invent a physics-only substitute for browser timing.

## Complete historical findings, data and unsuccessful attempts

The following sections embed all fourteen focused audit reports in full so this document is self-contained. They are chronological/source records, not fourteen separate documents the reader must consult. Their earlier status/next-step language is superseded by the current summary and live integration results above. Raw evidence links remain available for reproducibility.

`;
for(const [title,file]of sources){const content=fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'').replace(/^(#{1,6}) /gm,(_,hash)=>'#'.repeat(Math.min(6,hash.length+2))+' ');text+=`\n## Record: ${title}\n\nSource record: ${file}.\n\n${content}\n`;}
fs.writeFileSync(path.join(root,'PERFORMANCE-REPORT.md'),text);
console.log('Updated PERFORMANCE-REPORT.md ('+text.length+' characters, '+sources.length+' full source records).');
