# Wave2 ready integration

Stack on claude/ready/a-perf-int (6dce81a1138cbc0982fe290b1e7dcbac0b641688), itself on master62d23a05b. A0 lands A first, then this branch. No master merge performed. Source-only and LF; shared checkout/index untouched.

Included: nightwarm, packinputs, introstate, introclouds, shaderwarm, nightlight, nightvisibility, coveridle. Final owner calibration uses nightVisibility0.8 (the first/darker preview, explicitly chosen by the user), replacing the temporary1.6 working level.

Night corrections: initialize the NaN exposure sentinel; aim the directional/shadow key at the selected moon; retain readable high-latitude night exposure; opt-in world-only ambient visibility floor with unchanged daylight/no-option room paths; blend exposed light energy to avoid adaptation spikes; synchronize discrete clock cuts with key/hemi/exposure and the existing two-probe bake(day,true) path. Ordinary clock/weather probe fades remain enabled. No extra lights, shader definitions, tone curve changes, AA reductions or cloud/detail removal. These are intentionally visible night-light repairs, not pixel-identical performance changes. The earlier exposure bug also held world noon at garage1.12 rather than its authored0.92; restored world noon is0.92.

Validation: 17 focused gates PASS. The 32-gate affected ancestor batch and final changed-area batch retain standing master reds; no new failure-case identities after matched master/candidate FRAMECOST checks. The corrected tools-only fixture waits for BOTH cover/grass producers and bounded transient uploads; original120-frame cap, thresholds and ALLOW rows unchanged. A permanent1812byte/frame allocator is explicitly tested to reach the cap and remain measurable. This fixture improves measurement correctness; it does not improve game FPS/loading.

Historical cold live Rufus/gamer/8xMSAA/Cineon/linear A/B/A, before the busy-box warning: master night worst7403/3001ms, cockpit8904/8003ms, near14422/14872ms; precursor candidate50/117/67ms, zero shader waits in all measured flight phases. Night green windows8.54/13.01% ->95.06%. These figures predate the final ambient/transition tuning and must not be presented as a fresh performance measurement of this final commit. All three controls/candidate were crash-free; means20.79/22.56/21.63% CPU. Loading125.6/99.9s controls vs101.1s candidate: no proven full-boot gain. Latest busy-machine runs are visual/functional only. Static paused three-run predecessor results are separate evidence, not a live-flight guarantee.

Intro: identical intro source completed1007frames with1007cloud draws, zero garage-atmosphere updates, no exceptions. Cloud/scene hook and guard fixes are integrated. No claim every intro hitch or sky flash is eliminated. Packinputs has controlled byte parity/41% fewer fixture page draws; no claimed whole-game FPS gain. Shaderwarm is rebased on62d23a05b; residual boot links/costs remain disclosed.

Named standing costs from the integrated family: MEDIA gzip4.65->4.66MiB; Cub garage:compile links47->37, Cessna47->41; seed80->81links and1460->1479GLcalls. Raw current counter rows, including unchanged seed9504buffer bytes on both sides, are retained in release-case-comparison.json. No budget allowances added.

Evidence: D:/Dev/flydiy-notes/CODEX-WAVE2-READY-20261030.md and evidence-2026-10-18/2026-10-30/nightvisibility/. Latest chosen0.8 stills and metadata are visual evidence only. The first-second white-ground flash is resolved by atomic probe cuts. Natural tick/weather easing is checked for no intermediate exposed-light spike, zero-light endpoints and no settled exposure churn.

Remaining: town construction freezes (excluded by user), mirror GPU/CPU cost, camera-dependent short-frame unevenness, loading target60-70s, and wider organic flight/intro validation. The user's historic116s sequence was not reproduced exactly: the live control reproduced the shader family, not every historic asset/state.

Retired, no more pushes: introperf, loadwarm, patchyield, viewwarm, performance-stack. A0 owns deletion and landing.
