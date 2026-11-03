# PERF-1 integration: a-perf-int

Base: 62d23a05bab86efb9c915079cc8cec44fb79e8ab. Nine linear PERF commits: cookwait, flightlogevidence, windraster, recscene, groundquery, plotquery, worldeven, framepace, scenerylights. Source-only; all changed text files LF. Registry rows and HANDOVER appendices combined once; groundquery/plotquery text-merged. No generated files.

Current A0 review (30 October, trimmed): clean integration and LF/no built files are the delivery requirements. The earlier combined A/B, commit-style, rename and crop requirements were dropped. A0 owns landing, currently FINISH-1 (31 October from20:00) or FINISH-2 (1 November).

Completed validation: normal master/integration builds; syntax checks on every changed JavaScript file; all nine new gates PASS: COOKWAIT, FLIGHTEVIDENCE, WINDRASTER, SCENEDETAIL, GROUNDQUERY, PLOTQUERY, PATCHBOUNDS, PACECADENCE, SCENERYLIGHTS. LIGHT/CONTACT retain executable negative reorder tests. The optional affected-gate batch was stopped during its master side after the revised review was read. No completed combined affected-gate comparison or fresh three-run integration A/B is claimed. Existing individual-topic measurements remain historical evidence, not a new measurement of this integration.

Wind crop evidence: D:/Dev/flydiy-notes/evidence-2026-10-18/2026-10-30/windraster/.106anti-aliasing edge pixels differ within a13x14px arrow area; baseline repeat identical. User reports the two images look similar. The latest A0 review no longer requires crop approval.

Prior full-stack observations (included wave-2 shaderwarm/nightwarm, not wave-1 measurements): MEDIA gzip4.65->4.66MiB; Cub garage:compile links47->37, Cessna47->41; seed80->81links and1460->1479GLcalls, loading only. No page-size work.

Wave2 remains excluded and unready: nightwarm/HULLWARM, packinputs, introstate+introclouds, shaderwarm. Its working integration requires review, full combined checks and rebasing onto the final wave-1 tip before promotion. Shaderwarm itself is now rebased onto62d23a05b. No night-shader gain is claimed for wave1.

Retired: introperf, loadwarm, patchyield, viewwarm, performance-stack. No more pushes to those branches; A0 owns deletion. Original topic ready refs remain for audit; the nine fresh canonical PERF commits are the integration ancestors. The external manifest maps old ready SHAs to canonical commits.
