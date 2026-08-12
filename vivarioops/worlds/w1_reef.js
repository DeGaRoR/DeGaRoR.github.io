// worlds/w1_reef.js — THE OWNER'S OWN BREEDING STOCK, promoted to references.
//
// ── A THIRD KIND OF PROVENANCE, AND IT IS WHY THIS IS NOT IN w1_curated.js ───
//
// That file already holds two: CURATED specimens, picked out of a live Atlas by
// a player because they looked interesting, and SELECTED ones, won by an
// objective with a null arm. These six are neither. They came out of the
// project owner's own play over dozens of generations, chosen by hand and
// explicitly SELECTED ON LOCOMOTION — "I have selected on locomotion, these are
// the ones I told you about."
//
// That matters for what they are evidence of. They are the best swimmers this
// project has produced by a wide margin, and they were bred by a person steering
// a breeding loop, not by a fitness function. Measured against the shipped
// library on the same trial:
//
//     corpus                       best body-lengths/s
//     random draws (p50)                 0.0088
//     shipped library (eel-fast)         0.0933
//     THIS FILE (glossy teal flapper)    0.235
//
// ── WHY THEY ARE WORTH SHELVING RATHER THAN JUST ADMIRING ────────────────────
//
// Every steering experiment in this project has been run on creatures that can
// barely travel, and several conclusions were distorted by it — a whole session
// concluded "locomotion is the binding constraint" from random draws, which is
// false of this population: 17 of the owner's 23 saved creatures can cover 8 cm
// in two minutes, and the top two cover more than three hundred.
//
// They are also the corpus the goal-seeking failure modes were finally read off,
// because they are fast enough for the failure to be about AIM rather than about
// range. `tools/_zgoal.mjs` and the trajectory diagnostic split them cleanly:
//
//     creature                closest approach at   verdict
//     lesser pearl stumbler          2% of trial     passes by, never returns
//     spotted teal snarlback        14%              tries to aim, then circles
//     glossy teal flapper           24%              arcs beautifully, wanders 12x
//     Very fast swimmer             75%              genuinely tracks, runs out of clock
//
// ── ORIGIN IS REWRITTEN, ANCESTRY IS RECORDED HERE ───────────────────────────
//
// `curate()` sets `origin.founder` to the entry's own id, exactly as
// w1_curated.js does and for the same reason: they are library entries now, and
// their descendants should report THEM as the founder. The real ancestry is kept
// in prose on each entry so it is not lost — four of the six are jelly
// descendants, which is worth knowing given the medusa was added as a rendering
// experiment and has now founded most of the fast swimmers in the project.
//
// Captured at GENOME_V 7 and left there, so every load exercises the 7 -> 8
// migration rather than trusting it — the discipline w1_residents.js has kept
// through five schema bumps.

import { migrate } from '../engine/l1/genome.js';

/**
 * Glossy teal flapper · *Isohydra dentarticissima* — 52 generations, founder lost.
 *
 * THE FASTEST CREATURE IN THE PROJECT: 2.773 cm/s, 0.235 body-lengths/s, which is
 * 2.5x the best shipped eel and roughly a quarter of a real leech. Eight nodes,
 * mixed revolute and twist, a genuinely irregular body.
 *
 * It is also the clearest lesson in the difference between LOOKING like a
 * follower and being one. The owner's report — "clearly ends toward the beacon,
 * the most noticeable follower, arcing its trajectories" — is exactly right about
 * what it looks like, and its `wander` (path length over net displacement) is
 * **12.3**, five times anything else measured. It travels twelve times further
 * than it gets. Strong gain (|preyGain + threatGain| = 1.032, near the maximum)
 * on a ~118 cm turning radius in a 32 cm tank produces big committed sweeps
 * toward the mark that do not net progress.
 */
const FLAPPER_TEAL = {"version":7,"seed":1213414624,"rootNodeId":"n4lt4h","mouth":{"face":3,"at":[0,0]},"morphology":{"taperStrength":0.403544,"taperRatio":0.902677},"origin":{"founder":null,"generations":52},"nodes":[{"id":"n4lt4h","dims":[1.86566,0.916151,0.832455],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.34418,0.557328,1.298782],"phaseLag":0.034185},"colorGenes":{"hueShift":0.087737,"valueShift":-0.15158,"patternPhase":0.805401},"sites":[]},{"id":"nbzhuu","dims":[1.148627,0.573218,1.670879],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[1.005371,0.425781,0.368254],"phaseLag":-0.074421},"colorGenes":{"hueShift":-0.086722,"valueShift":0.207299,"patternPhase":0.919811},"sites":[]},{"id":"nw1l97","dims":[1.510165,0.722219,1.633039],"density":1,"recursiveLimit":3,"joint":{"type":"twist","angleLimits":[0.10568,0.188538,0.278479],"phaseLag":0.118385},"colorGenes":{"hueShift":-0.062667,"valueShift":-0.17762,"patternPhase":0.688431},"sites":[]},{"id":"ngofbd","dims":[0.358395,0.643433,1.680159],"density":1,"recursiveLimit":2,"joint":{"type":"twist","angleLimits":[0.008077,0.12224,0.137971],"phaseLag":-0.091521},"colorGenes":{"hueShift":0.093509,"valueShift":0.104909,"patternPhase":0.689228},"sites":[]},{"id":"nsagku","dims":[0.472483,0.909814,1.89862],"density":1,"recursiveLimit":1,"joint":{"type":"twist","angleLimits":[0.203706,0.002877,0.152385],"phaseLag":0.924881},"colorGenes":{"hueShift":0.062589,"valueShift":0.007127,"patternPhase":0.989986},"sites":[]},{"id":"n5vm0p","dims":[1.096098,1.014476,1.012971],"density":1,"recursiveLimit":3,"joint":{"type":"twist","angleLimits":[0.050068,0.109196,0.211415],"phaseLag":0.214654},"colorGenes":{"hueShift":0.097333,"valueShift":-0.073651,"patternPhase":0.263547},"sites":[]},{"id":"nnncbn","dims":[0.339075,0.606087,1.961742],"density":1,"recursiveLimit":4,"joint":{"type":"twist","angleLimits":[0.333359,0.269013,0.054772],"phaseLag":0.304527},"colorGenes":{"hueShift":0.040252,"valueShift":-0.163282,"patternPhase":0.952021},"sites":[]},{"id":"n2nclo","dims":[1.246907,0.405801,0.343586],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[1.423486,1.567653,1.263423],"phaseLag":1.66382},"colorGenes":{"hueShift":-0.007828,"valueShift":-0.124775,"patternPhase":0.049895},"sites":[]}],"connections":[{"id":"csebdc","parentNodeId":"n4lt4h","childNodeId":"nbzhuu","parentFace":0,"position":[-0.15321,0.550686],"orientation":[-0.37381,0.02379,0.514759],"scale":[1.578752,1.327936,0.93333],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cyah1n","parentNodeId":"n4lt4h","childNodeId":"nw1l97","parentFace":3,"position":[-0.019377,0.185516],"orientation":[0.205043,0.700226,0.083945],"scale":[1.064314,0.931386,1.664849],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"ca64jh","parentNodeId":"nw1l97","childNodeId":"ngofbd","parentFace":0,"position":[0.178375,-0.035373],"orientation":[0.607677,0.602048,-0.651926],"scale":[1.394411,1.735148,1.740955],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"ckom8y","parentNodeId":"n4lt4h","childNodeId":"nsagku","parentFace":4,"position":[0.740505,-0.754926],"orientation":[-0.599084,-0.518103,0.747434],"scale":[0.726448,1.066238,1.725864],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"czfhmu","parentNodeId":"nbzhuu","childNodeId":"n5vm0p","parentFace":5,"position":[0.809759,-0.926921],"orientation":[0.145731,-0.635313,-0.040637],"scale":[0.796897,1.0326,1.350074],"reflectX":true,"reflectY":false,"reflectZ":true,"terminalOnly":false},{"id":"c8k430","parentNodeId":"nw1l97","childNodeId":"nnncbn","parentFace":3,"position":[0.760563,0.27011],"orientation":[0.233366,-0.686372,0.268988],"scale":[0.927558,0.767992,0.898864],"reflectX":true,"reflectY":false,"reflectZ":true,"terminalOnly":false},{"id":"cjeo1w","parentNodeId":"nbzhuu","childNodeId":"n5vm0p","parentFace":5,"position":[-0.465703,0.922868],"orientation":[0.061951,0.785398,-0.38055],"scale":[1.100009,0.86454,0.673541],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"chga03","parentNodeId":"n5vm0p","childNodeId":"n2nclo","parentFace":3,"position":[0.737126,0.89437],"orientation":[-0.437056,-0.35662,-0.623333],"scale":[0.947026,1.092983,1.394609],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false}],"material":{"hue":0.161715,"hueVariance":0.076604,"patternScale":1.438994,"patternContrast":0.180686,"stripeAnisotropy":0.948818,"iridescence":0.829274},"controller":{"omega":3.800504,"preyGain":-0.920584,"threatGain":-0.111541,"phaseBase":1.944284,"phaseSlope":-0.036868,"proprioGain":0,"chemoGain":-0.010222,"jointGenes":{"n4lt4h":{"amplitude":0.649161,"bias":0.201051,"freqMult":1},"nbzhuu":{"amplitude":0.655828,"bias":0.321257,"freqMult":1},"nw1l97":{"amplitude":0.066708,"bias":-0.253734,"freqMult":0.5},"ngofbd":{"amplitude":0.494822,"bias":-0.336091,"freqMult":1},"nsagku":{"amplitude":0.090424,"bias":-0.16979,"freqMult":2},"n5vm0p":{"amplitude":0.722269,"bias":0.346486,"freqMult":1},"nnncbn":{"amplitude":0.229544,"bias":-0.209282,"freqMult":2},"n2nclo":{"amplitude":0.033387,"bias":0.075153,"freqMult":1}},"preyGain2":0,"threatGain2":0},"social":{"trophic":0.870726,"boldness":0.876339,"cohesion":0.599401,"separation":0.206329,"alignment":0.504773,"separationRadius":2.079052}};

/**
 * Very fast swimmer · *Phylloligosphalmatops longinodissimis* — jelly, 41 gens.
 *
 * THE BEST GOAL-TRACKER MEASURED SO FAR, and the owner named it for the wrong
 * property: it is not the fastest (0.563 cm/s against the flapper's 2.773). What
 * it has is the combination nothing else does — a 1.4 cm turning radius, 23.6
 * deg/s of turn capability, and an evolved gain sum of 1.314.
 *
 * Its closest approach comes at **75% of the trial** with an overshoot of only
 * 1.20, which is what genuine convergence looks like: it is still closing when
 * the clock stops. The owner's "misses the beacon, then is too far to even care"
 * describes the end of a longer watch than the 90 s trial; inside the trial it is
 * grinding steadily inward and is the one creature braking makes WORSE
 * (1.41 -> 2.02 cm), because a brake slows a grind that was working.
 *
 * It carries a receptor on `nzarpx` with `chemoGain` -0.017 — an eye with almost
 * no nerve, and on the food channel rather than the beacon's.
 */
const SWIMMER_FAST = {"version":7,"seed":0,"rootNodeId":"seg","mouth":{"face":5,"at":[-0.043932,-0.213759]},"morphology":{"taperStrength":0.099608,"taperRatio":1.047745},"origin":{"founder":"jelly","generations":41},"nodes":[{"id":"seg","dims":[0.5,0.35,1.2],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.5707963267948966},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[]},{"id":"nzarpx","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.02,"valueShift":-0.1,"patternPhase":0.3},"sites":[{"face":5,"at":[-0.290743,0.038055]}]},{"id":"n71z86","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.02,"valueShift":-0.1,"patternPhase":0.310903},"sites":[]},{"id":"n78h08","dims":[0.5,0.35,1.2],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.5707963267948966},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[]}],"connections":[{"id":"c_self","parentNodeId":"seg","childNodeId":"nzarpx","parentFace":5,"position":[0,0],"orientation":[0.001495,0,0],"scale":[0.95,0.95,0.95],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"c8vogq","parentNodeId":"nzarpx","childNodeId":"nzarpx","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.795749,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"c9pr0u","parentNodeId":"nzarpx","childNodeId":"n71z86","parentFace":5,"position":[0.325619,-0.561918],"orientation":[0.094478,0.159013,-0.086681],"scale":[0.531751,1.889455,1.805816],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true},{"id":"cwabft","parentNodeId":"n71z86","childNodeId":"n71z86","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.795749,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cpoznk","parentNodeId":"n71z86","childNodeId":"n78h08","parentFace":5,"position":[0.325619,-0.561918],"orientation":[0.094478,0.159013,-0.086681],"scale":[0.531751,1.889455,1.805816],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true},{"id":"ctlfzj","parentNodeId":"nzarpx","childNodeId":"nzarpx","parentFace":5,"position":[0.635409,-0.731715],"orientation":[-0.024437,-0.179131,-0.183943],"scale":[0.613592,1.033408,0.645141],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false}],"material":{"hue":0.457781,"hueVariance":0.16869,"patternScale":1.736618,"patternContrast":0.426084,"stripeAnisotropy":0,"iridescence":0.822611},"controller":{"omega":2.151962,"preyGain":0.6,"threatGain":0.713644,"phaseBase":-0.02972,"phaseSlope":-0.069822,"proprioGain":0,"chemoGain":-0.017479,"jointGenes":{"seg":{"amplitude":0.9,"bias":0,"freqMult":1},"nzarpx":{"amplitude":0.75,"bias":-0.02448,"freqMult":2},"n71z86":{"amplitude":0.75,"bias":-0.02448,"freqMult":0.5},"n78h08":{"amplitude":0.9,"bias":0.043977,"freqMult":1}},"preyGain2":0,"threatGain2":0},"social":{"trophic":0.4,"boldness":0.052062,"cohesion":0.431207,"separation":0.195593,"alignment":0.4,"separationRadius":3.294354}};

/**
 * Spotted teal snarlback · *Phylloliganomalops longinodissimis* — jelly, 20 gens.
 *
 * THE BEST EVIDENCE IN THE PROJECT THAT THE BRAKE IS WORTH A GENE. Its gains are
 * the UNTOUCHED authored default — `preyGain 0.6`, `threatGain -0.4`, summing to
 * the 0.200 every eel ships — and it still has the highest steering authority in
 * the owner's collection (0.941) with 16.5 deg/s of capability.
 *
 * The owner: "able to change course, and even seems to try aiming... yet ends up
 * close, but not aiming quite right, and ending up going in circles somewhere not
 * so close." Measured, that is a closest approach at 14% of the trial and a
 * 2.57x overshoot. Give it `brakeGain` and it goes from a control-subtracted
 * closure of -0.112 — WORSE than swimming blind — to +0.153, and its best single
 * approach from 3.56 cm to 1.49.
 */
const SNARLBACK_SPOTTED = {"version":7,"seed":0,"rootNodeId":"seg","mouth":{"face":5,"at":[0,0]},"morphology":{"taperStrength":0,"taperRatio":1},"origin":{"founder":"jelly","generations":20},"nodes":[{"id":"seg","dims":[0.5,0.35,1.2],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.5707963267948966},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[]},{"id":"nj3jyx","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.020787,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"n1kkmn","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.02,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"n93rc1","dims":[0.637115,1.739543,1.248339],"density":1,"recursiveLimit":3,"joint":{"type":"twist","angleLimits":[0.199778,0.032575,0.000279],"phaseLag":0.457573},"colorGenes":{"hueShift":-0.089335,"valueShift":-0.110414,"patternPhase":0.687335},"sites":[]}],"connections":[{"id":"c_self","parentNodeId":"seg","childNodeId":"nj3jyx","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.95,0.95,0.95],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cg2tqe","parentNodeId":"nj3jyx","childNodeId":"n1kkmn","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.9,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"c5ftn9","parentNodeId":"n1kkmn","childNodeId":"n1kkmn","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.795749,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cyi70g","parentNodeId":"n1kkmn","childNodeId":"nj3jyx","parentFace":5,"position":[0.325619,-0.561918],"orientation":[0.094478,0.159013,-0.086681],"scale":[0.531751,1.889455,1.805816],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true},{"id":"cbq0i3","parentNodeId":"nj3jyx","childNodeId":"n93rc1","parentFace":5,"position":[-0.109249,0.69961],"orientation":[0.401384,-0.697474,-0.391128],"scale":[1.38519,0.693256,0.666627],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cu4tn5","parentNodeId":"nj3jyx","childNodeId":"n93rc1","parentFace":3,"position":[0.86787,0.668817],"orientation":[-0.377229,-0.105241,0.187611],"scale":[0.923285,1.541928,1.565962],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true}],"material":{"hue":0.32,"hueVariance":0.08,"patternScale":3,"patternContrast":0.587561,"stripeAnisotropy":0.263938,"iridescence":0.068442},"controller":{"omega":1.5,"preyGain":0.6,"threatGain":-0.4,"phaseBase":0,"phaseSlope":0,"proprioGain":0,"chemoGain":0,"jointGenes":{"seg":{"amplitude":0.9,"bias":0,"freqMult":1},"nj3jyx":{"amplitude":0.75,"bias":0,"freqMult":1},"n1kkmn":{"amplitude":0.75,"bias":-0.02448,"freqMult":1},"n93rc1":{"amplitude":0.747363,"bias":-0.110555,"freqMult":2}},"preyGain2":0,"threatGain2":0},"social":{"trophic":0.4,"boldness":0.5,"cohesion":0.3,"separation":0.5,"alignment":0.4,"separationRadius":3.294354}};

/**
 * Lesser pulsing snarlback · *Phylloliganomalops longiventissimis* — jelly, 20.
 *
 * The spotted snarlback's simpler sibling: same founder, same generation count,
 * same untouched 0.200 gain sum, but three nodes instead of four — it never grew
 * the `n93rc1` twist paddle. A useful pair: two lineages twenty births from the
 * same medusa, one of which added a limb and one of which did not, with the
 * steering genes identical between them. Any behavioural difference between the
 * two is morphology and nothing else.
 */
const SNARLBACK_LESSER = {"version":7,"seed":0,"rootNodeId":"seg","mouth":{"face":5,"at":[0,0]},"morphology":{"taperStrength":0.075613,"taperRatio":1},"origin":{"founder":"jelly","generations":20},"nodes":[{"id":"seg","dims":[0.5,0.35,1.2],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.5707963267948966},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[]},{"id":"nj3jyx","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.020787,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"n1kkmn","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.02,"valueShift":-0.1,"patternPhase":0.3},"sites":[]}],"connections":[{"id":"c_self","parentNodeId":"seg","childNodeId":"nj3jyx","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.95,0.95,0.95],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cg2tqe","parentNodeId":"nj3jyx","childNodeId":"n1kkmn","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.9,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"c5ftn9","parentNodeId":"n1kkmn","childNodeId":"n1kkmn","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.795749,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cyi70g","parentNodeId":"n1kkmn","childNodeId":"nj3jyx","parentFace":5,"position":[0.325619,-0.561918],"orientation":[0.094478,0.159013,-0.086681],"scale":[0.531751,1.889455,1.805816],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true}],"material":{"hue":0.317702,"hueVariance":0.08,"patternScale":3,"patternContrast":0.587561,"stripeAnisotropy":0.263938,"iridescence":0.068442},"controller":{"omega":1.5,"preyGain":0.6,"threatGain":-0.4,"phaseBase":0,"phaseSlope":0,"proprioGain":0,"chemoGain":0,"jointGenes":{"seg":{"amplitude":0.9,"bias":0,"freqMult":1},"nj3jyx":{"amplitude":0.75,"bias":0,"freqMult":1},"n1kkmn":{"amplitude":0.75,"bias":-0.02448,"freqMult":1}},"preyGain2":0,"threatGain2":0},"social":{"trophic":0.4,"boldness":0.5,"cohesion":0.3,"separation":0.5,"alignment":0.4,"separationRadius":3.294354}};

/**
 * Lesser pearl stumbler · *Phylloligosphalmatops longinodissimis* — jelly, 14.
 *
 * Fast (0.578 cm/s, 0.075 L/s) and BLIND BY ARITHMETIC: `preyGain 0.430` against
 * `threatGain -0.488` sums to **-0.058**. Its two sensor channels very nearly
 * cancel, so whatever it senses it barely acts on — the same cancellation that
 * made every authored eel a poor follower at 0.200, taken almost to zero.
 *
 * The owner's "very fast, but no orientation" is exactly that, and it is the one
 * Cluster A creature the brake does NOT rescue (7.24 -> 7.77 cm): there is no
 * steering signal for a brake to buy time for. It sits on this shelf as the
 * cleanest available demonstration that gain SUM, not gain magnitude, is what
 * decides whether a creature can follow anything.
 */
const STUMBLER_PEARL = {"version":7,"seed":0,"rootNodeId":"seg","mouth":{"face":5,"at":[0,0]},"morphology":{"taperStrength":0,"taperRatio":1},"origin":{"founder":"jelly","generations":14},"nodes":[{"id":"seg","dims":[0.63041,0.35,1.2],"density":1,"recursiveLimit":5,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.399014},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[]},{"id":"nmga80","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.020787,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"nv7k69","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.02,"valueShift":-0.1,"patternPhase":0.3},"sites":[]}],"connections":[{"id":"cmu5uz","parentNodeId":"seg","childNodeId":"nmga80","parentFace":3,"position":[0.22802,0.240691],"orientation":[0.660837,-0.066154,-0.26376],"scale":[1.695807,0.522109,1.298625],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cyljxj","parentNodeId":"nmga80","childNodeId":"nv7k69","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.9,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"c1ndmm","parentNodeId":"nv7k69","childNodeId":"nv7k69","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.795749,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false}],"material":{"hue":0.456307,"hueVariance":0.132011,"patternScale":6.921893,"patternContrast":0.365911,"stripeAnisotropy":0.2,"iridescence":0.464083},"controller":{"omega":5.146498,"preyGain":0.42988,"threatGain":-0.488217,"phaseBase":0,"phaseSlope":0,"proprioGain":0,"chemoGain":0,"jointGenes":{"seg":{"amplitude":0.808553,"bias":-0.026164,"freqMult":1},"nmga80":{"amplitude":0.75,"bias":0,"freqMult":1},"nv7k69":{"amplitude":0.75,"bias":0,"freqMult":1}},"preyGain2":0,"threatGain2":0},"social":{"trophic":0.5351,"boldness":0.011486,"cohesion":0.4,"separation":0.266962,"alignment":0.391272,"separationRadius":3.294354}};

/**
 * Glossy sculling crownbeast · *Isothetia dentifrontissima* — no founder recorded.
 *
 * The odd one out and kept for exactly that: six nodes, five of them twist
 * joints, a recursive `nxhfih` that connects back to the root, and `separation`
 * pinned at 1.0. It is slow (0.039 cm/s) and it is the most structurally unlike
 * anything else on any shelf in this project — the closest thing the library has
 * to a body plan nobody would draw.
 *
 * Shelved as VARIETY rather than as a contender, the same argument `jelly` was
 * added under: a library of six near-identical fast swimmers gives selection
 * nothing to work with.
 */
const CROWNBEAST_SCULLING = {"version":7,"seed":2286116653,"rootNodeId":"niost6","mouth":{"face":5,"at":[0,0]},"nodes":[{"id":"niost6","dims":[1.675792,1.711062,1.902502],"density":1,"recursiveLimit":2,"joint":{"type":"twist","angleLimits":[0.07919,0.113932,0.246478],"phaseLag":0.206899},"colorGenes":{"hueShift":0.005794,"valueShift":-0.19083,"patternPhase":0.854761},"sites":[]},{"id":"n2il4t","dims":[1.04497,0.561557,1.963673],"density":1,"recursiveLimit":2,"joint":{"type":"twist","angleLimits":[0.239822,0.250773,0.215628],"phaseLag":-0.228712},"colorGenes":{"hueShift":-0.127485,"valueShift":0.233265,"patternPhase":0.407375},"sites":[]},{"id":"nqwctt","dims":[0.391943,1.073498,0.48517],"density":1,"recursiveLimit":3,"joint":{"type":"twist","angleLimits":[0.031155,0.028347,0.115035],"phaseLag":-0.193036},"colorGenes":{"hueShift":-0.070278,"valueShift":-0.252952,"patternPhase":0.530775},"sites":[]},{"id":"nxhfih","dims":[1.145919,1.323137,1.261635],"density":1,"recursiveLimit":2,"joint":{"type":"revolute","angleLimits":[0.301706,1.347612,1.452318],"phaseLag":-0.060921},"colorGenes":{"hueShift":0.006891,"valueShift":0.255411,"patternPhase":0.36362},"sites":[]},{"id":"nk2s97","dims":[0.290938,1.567122,1.535572],"density":1,"recursiveLimit":5,"joint":{"type":"twist","angleLimits":[0.182686,0.174484,0.30275],"phaseLag":-0.065746},"colorGenes":{"hueShift":0.074764,"valueShift":-0.022067,"patternPhase":0.304287},"sites":[]},{"id":"n32r8p","dims":[0.30209,0.336623,1.362853],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.76839,0.650923,1.219703],"phaseLag":0.015649},"colorGenes":{"hueShift":-0.000532,"valueShift":0.197047,"patternPhase":0.446349},"sites":[]}],"connections":[{"id":"cchf90","parentNodeId":"niost6","childNodeId":"n2il4t","parentFace":1,"position":[-0.929161,-0.663234],"orientation":[0.623385,0.651682,0.025145],"scale":[1.183324,1.33188,1.783833],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"ctmyt9","parentNodeId":"niost6","childNodeId":"nqwctt","parentFace":5,"position":[-0.013136,-0.153297],"orientation":[-0.206408,0.356153,-0.716659],"scale":[1.652073,1.661177,1.533752],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"ckegg7","parentNodeId":"niost6","childNodeId":"nxhfih","parentFace":3,"position":[0.39863,-0.7456],"orientation":[-0.47473,0.67296,-0.388751],"scale":[0.703528,1.343836,1.405602],"reflectX":false,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"cy142z","parentNodeId":"nxhfih","childNodeId":"nk2s97","parentFace":4,"position":[0.898319,0.849274],"orientation":[0.323788,0.633195,0.210081],"scale":[1.192337,1.098702,1.790288],"reflectX":false,"reflectY":false,"reflectZ":true,"terminalOnly":false},{"id":"cxf90q","parentNodeId":"n2il4t","childNodeId":"n32r8p","parentFace":5,"position":[-0.683447,0.988179],"orientation":[-0.458395,-0.437322,0.537708],"scale":[1.0232,0.984736,0.999929],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"cwai03","parentNodeId":"nxhfih","childNodeId":"nxhfih","parentFace":5,"position":[-0.005449,0.572042],"orientation":[-0.211013,-0.159363,-0.27041],"scale":[0.747941,0.862623,0.787964],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true},{"id":"c3rfqd","parentNodeId":"nxhfih","childNodeId":"niost6","parentFace":4,"position":[-0.696905,0.054388],"orientation":[0.271056,-0.654919,-0.36999],"scale":[1.717041,1.090384,0.798384],"reflectX":true,"reflectY":false,"reflectZ":false,"terminalOnly":true},{"id":"com33e","parentNodeId":"nqwctt","childNodeId":"n2il4t","parentFace":4,"position":[0.544796,0.32818],"orientation":[-0.035748,0.56663,-0.204816],"scale":[1.931275,1.733168,0.629207],"reflectX":false,"reflectY":false,"reflectZ":true,"terminalOnly":false}],"material":{"hue":0.883525,"hueVariance":0.5,"patternScale":3.225711,"patternContrast":0.098258,"stripeAnisotropy":0.21859,"iridescence":0.986143},"controller":{"omega":3.518713,"preyGain":0.17066,"threatGain":-0.315664,"phaseBase":2.797875,"phaseSlope":-0.045782,"proprioGain":0,"chemoGain":0,"jointGenes":{"niost6":{"amplitude":0.011591,"bias":0.119838,"freqMult":1},"n2il4t":{"amplitude":0.639583,"bias":-0.237106,"freqMult":1},"nqwctt":{"amplitude":0.143391,"bias":0.402939,"freqMult":1},"nxhfih":{"amplitude":0.176044,"bias":-0.172181,"freqMult":1},"nk2s97":{"amplitude":0.230845,"bias":0.496312,"freqMult":1},"n32r8p":{"amplitude":0.786127,"bias":0.275273,"freqMult":1}},"preyGain2":0,"threatGain2":0},"social":{"trophic":0.492303,"boldness":0.174016,"cohesion":0.149174,"separation":1,"alignment":0.101889,"separationRadius":3.274153},"morphology":{"taperStrength":0,"taperRatio":1}};

/** Same contract as w1_curated.js: migrate forward, own the founder field. */
function reef(raw, id) {
  const g = migrate(JSON.parse(JSON.stringify(raw)));
  return { ...g, origin: { founder: id, generations: 0 } };
}

export const REEF = [
  {
    id: 'flapper-teal',
    name: 'Glossy teal flapper',
    binomial: 'Isohydra dentarticissima',
    note: 'BRED BY HAND, SELECTED ON LOCOMOTION — 52 generations. The fastest creature in the project at 0.235 body-lengths per second, 2.5x the best shipped eel. Also the clearest case of looking like a follower without being one: it arcs visibly toward a beacon and travels twelve times further than it gets, because a near-maximum sensor gain on a ~118 cm turning radius produces committed sweeps that do not net progress.',
    genome: reef(FLAPPER_TEAL, 'flapper-teal'),
  },
  {
    id: 'swimmer-fast',
    name: 'Very fast swimmer',
    binomial: 'Phylloligosphalmatops longinodissimis',
    note: 'BRED BY HAND — 41 generations down from jelly. The best goal-tracker measured in this project: a 1.4 cm turning radius, 23.6 deg/s of capability and an evolved gain sum of 1.314. Its closest approach comes at 75% of a trial with almost no overshoot, which is what genuine convergence looks like — it is still closing when the clock stops, and it is the one creature a brake makes worse.',
    genome: reef(SWIMMER_FAST, 'swimmer-fast'),
  },
  {
    id: 'snarlback-spotted',
    name: 'Spotted teal snarlback',
    binomial: 'Phylloliganomalops longinodissimis',
    note: 'BRED BY HAND — 20 generations down from jelly. The highest steering authority in the collection (0.941) carrying the UNTOUCHED authored gain sum of 0.200, so it tries to aim and cannot commit. It is the evidence that made brakeGain a gene: throttling on bearing takes it from a control-subtracted closure of -0.112, worse than blind, to +0.153.',
    genome: reef(SNARLBACK_SPOTTED, 'snarlback-spotted'),
  },
  {
    id: 'snarlback-lesser',
    name: 'Lesser pulsing snarlback',
    binomial: 'Phylloliganomalops longiventissimis',
    note: 'BRED BY HAND — the spotted snarlback’s sibling, same founder and same generation count, three nodes instead of four. The steering genes are identical between the two, so any behavioural difference is morphology and nothing else. Kept as that controlled pair rather than for its own performance.',
    genome: reef(SNARLBACK_LESSER, 'snarlback-lesser'),
  },
  {
    id: 'stumbler-pearl',
    name: 'Lesser pearl stumbler',
    binomial: 'Phylloligosphalmatops longinodissimis',
    note: 'BRED BY HAND — 14 generations down from jelly. Fast and blind by arithmetic: preyGain 0.430 against threatGain -0.488 sums to -0.058, so its two channels very nearly cancel and it acts on almost nothing it senses. The cleanest demonstration in the library that gain SUM decides whether a creature can follow, not gain magnitude.',
    genome: reef(STUMBLER_PEARL, 'stumbler-pearl'),
  },
  {
    id: 'crownbeast-sculling',
    name: 'Glossy sculling crownbeast',
    binomial: 'Isothetia dentifrontissima',
    note: 'BRED BY HAND, and kept for VARIETY rather than performance — the same argument jelly was added under. Six nodes, five of them twist joints, one connecting back to the root. Slow, and the most structurally unlike anything else on any shelf here: the closest the library has to a body plan nobody would have drawn.',
    genome: reef(CROWNBEAST_SCULLING, 'crownbeast-sculling'),
  },
];

export const reefById = (id) => REEF.find((c) => c.id === id) ?? null;

export default REEF;
