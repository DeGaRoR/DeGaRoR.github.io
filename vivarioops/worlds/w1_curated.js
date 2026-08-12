// worlds/w1_curated.js — EVOLVED SPECIMENS PROMOTED TO REFERENCES.
//
// ── HOW THIS FILE DIFFERS FROM seeds.js, AND WHY IT IS A SEPARATE FILE ───────
//
// `seeds.js` is a library of hand-written CONSTRUCTORS: `chain({...})`,
// `medusa({...})`. Every number in it was typed by a person, and the file reads
// as design because that is what it is.
//
// Nothing here was DESIGNED. These genomes came out of real breeding runs and
// are pasted in verbatim. They are machine output and they look like it —
// `nzc0ht`, `orientation: [-0.598756, 0.243404, 0.534476]` — and mixing that into
// a file of authored literals would make both harder to read and would blur the
// one distinction the Atlas exists to preserve.
//
// ── TWO KINDS OF PROVENANCE LIVE HERE, AND THEY ARE NOT EQUAL ────────────────
//
// CURATED (`snarlback-teal`, `protea`) were FOUND: picked out of a live Atlas by
// a player because they looked interesting. A human eye is in that loop.
//
// SELECTED (`oddfoot-glossy`, `spokebeast-banded`, `stumbler-striped`) were won
// by an objective — `tools/_zgoalevo.mjs`, scoring control-subtracted goal
// closure against a paired random-selection null arm. Nobody looked at them and
// liked them; they out-scored their siblings.
//
// The distinction is recorded in each entry's note rather than in the filename,
// because it changes what the specimen is EVIDENCE of. A curated animal is
// evidence the search produces things worth keeping. A selected one is evidence
// the objective selects for what it claims to. And a selected one bred from
// AUTHORED FOUNDERS is evidence of neither — only that selection improves a
// competent founder, which standing rule 10 requires be said out loud every time.
//
// ── THEY ARE STILL REFERENCES, AND THAT IS THE POINT ─────────────────────────
//
// A curated specimen did not survive trial and error any less than its siblings —
// it survived MORE of it. But the moment it enters the library as breeding stock,
// its descendants got a running start that a fresh random draw did not, and a run
// seeded from here has shown that evolution IMPROVES A CURATED FOUNDER rather
// than that it discovered anything. So each carries `origin.founder` and the
// Vivarium's Ancestry row reports it, exactly as it does for the authored eels.
//
// If anything the provenance here is BETTER than the eels': these creatures are
// evidence that the search works, because the search is where they came from.
//
// ── VERSIONS ARE LEFT AS RECORDED ────────────────────────────────────────────
//
// `Protea` was captured at GENOME_V 5 and is left there so that every load
// exercises the 5 -> 6 migration rather than trusting it — the same reasoning
// `w1_residents.js` gives for keeping its literals at version 2. The snarlback was
// captured at 6 and stays at 6. Neither was edited by hand: a curated specimen
// that has been "tidied" is no longer the animal that was curated.

import { migrate } from '../engine/l1/genome.js';

/**
 * Teal pulsing snarlback · *Phylloliganomalops longiventissimis*
 *
 * Captured at GENOME_V 6, `origin.founder: 'jelly'`, `generations: 26` — this
 * animal is a MEDUSA DESCENDANT, twenty-six births down from the bell-and-crown
 * body added the same afternoon, and it kept the tentacle node (`n5uidr`,
 * `0.24 x 0.24 x 0.8`, recursiveLimit 3) while growing a segmented spine around
 * it. That lineage is exactly what the founder field was added to make visible,
 * and it would have been unrecoverable a generation later without it.
 *
 * The founder is REWRITTEN to its own id below, and the jelly ancestry recorded
 * here in prose instead. `origin.founder` answers "which library entry was this
 * lineage started from", and from now on the answer for its descendants is this
 * creature — but the fact that it came from the medusa is worth not losing.
 */
const SNARLBACK = {"version":6,"seed":0,"rootNodeId":"seg","mouth":{"face":5,"at":[0,-0.213759]},"morphology":{"taperStrength":0.075613,"taperRatio":1},"origin":{"founder":"snarlback-teal","generations":0},"nodes":[{"id":"seg","dims":[0.5,0.35,1.2],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.5707963267948966},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[]},{"id":"nj3jyx","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.020787,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"n5uidr","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.02,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"nvoy3w","dims":[0.5,0.35,1.2],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.5707963267948966},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[]},{"id":"ntrstm","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.020787,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"ncywfc","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.02,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"nspdu3","dims":[0.24,0.24,0.8],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.8,0.8,0.8],"phaseLag":0},"colorGenes":{"hueShift":0.020787,"valueShift":-0.1,"patternPhase":0.3},"sites":[]},{"id":"n8n70y","dims":[0.637115,1.739543,1.248339],"density":1,"recursiveLimit":3,"joint":{"type":"twist","angleLimits":[0.199778,0.032575,0.000279],"phaseLag":0.457573},"colorGenes":{"hueShift":-0.089335,"valueShift":-0.110414,"patternPhase":0.687335},"sites":[]}],"connections":[{"id":"c_self","parentNodeId":"seg","childNodeId":"nj3jyx","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.95,0.95,0.95],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cg2tqe","parentNodeId":"nj3jyx","childNodeId":"n5uidr","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.9,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"coaskf","parentNodeId":"n5uidr","childNodeId":"n5uidr","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.795749,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"c0x21e","parentNodeId":"n5uidr","childNodeId":"nvoy3w","parentFace":5,"position":[0.325619,-0.561918],"orientation":[0.094478,0.159013,-0.086681],"scale":[0.531751,1.889455,1.805816],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true},{"id":"cir0xp","parentNodeId":"nvoy3w","childNodeId":"ntrstm","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.95,0.95,0.95],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"c0kcmn","parentNodeId":"ntrstm","childNodeId":"ncywfc","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.9,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"c2oso6","parentNodeId":"nspdu3","childNodeId":"ncywfc","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.9,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cm5acj","parentNodeId":"ncywfc","childNodeId":"ncywfc","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.795749,0.9,0.9],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cvlg9q","parentNodeId":"ncywfc","childNodeId":"nspdu3","parentFace":5,"position":[0.325619,-0.561918],"orientation":[0.094478,0.159013,-0.086681],"scale":[0.531751,1.889455,1.805816],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true},{"id":"cldwvv","parentNodeId":"nspdu3","childNodeId":"n8n70y","parentFace":5,"position":[-0.109249,0.69961],"orientation":[0.401384,-0.697474,-0.391128],"scale":[1.38519,0.693256,0.666627],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"ctzmpt","parentNodeId":"nspdu3","childNodeId":"n8n70y","parentFace":3,"position":[0.86787,0.668817],"orientation":[-0.377229,-0.105241,0.187611],"scale":[0.923285,1.541928,1.565962],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":true}],"material":{"hue":0.32,"hueVariance":0.08,"patternScale":3,"patternContrast":0.426084,"stripeAnisotropy":0.263938,"iridescence":0.068442},"controller":{"omega":1.724066,"preyGain":0.6,"threatGain":-0.718938,"phaseBase":0,"phaseSlope":0.005478,"proprioGain":0,"chemoGain":0,"jointGenes":{"seg":{"amplitude":0.9,"bias":0,"freqMult":1},"nj3jyx":{"amplitude":0.75,"bias":0,"freqMult":1},"n5uidr":{"amplitude":0.75,"bias":-0.02448,"freqMult":1},"nvoy3w":{"amplitude":0.9,"bias":0,"freqMult":1},"ntrstm":{"amplitude":0.75,"bias":0,"freqMult":1},"ncywfc":{"amplitude":0.75,"bias":-0.02448,"freqMult":1},"nspdu3":{"amplitude":0.75,"bias":0,"freqMult":1},"n8n70y":{"amplitude":0.747363,"bias":-0.110555,"freqMult":2}}},"social":{"trophic":0.4,"boldness":0.5,"cohesion":0.3,"separation":0.5,"alignment":0.4,"separationRadius":3.294354}};

/**
 * Rose tumbling sunwheel · *Protea dentarticata*
 *
 * Captured at GENOME_V 5, so it migrates on load. Radial, and it got there on its
 * own: `cwn8fq`, `chwwbm` and `cksine` each carry ALL THREE reflection booleans,
 * which `reflectionVariants` expands to eight instances apiece. Nothing selected
 * for symmetry — `maxReflectionAxes` was merely raised to 3 at B2 §2.2 and the
 * search found the rest.
 *
 * IT ALSO HAS A RECEPTOR, unprompted: `nn348k.sites` carries one site at
 * `face 0, [-0.734, 0.406]`. That is the organ Phase 2 wired, arrived at by
 * mutation in a run that had no reason to favour it, and it makes this specimen
 * the first creature in the library that can actually smell. Its `chemoGain` is
 * still 0, so it is blind in practice — a receptor with no gain behind it, which
 * is precisely the half-finished state the gene's neutral start predicts.
 */
const PROTEA = {"version":5,"seed":926907228,"rootNodeId":"nn348k","mouth":{"face":3,"at":[0,0]},"nodes":[{"id":"nn348k","dims":[0.883356,0.565847,0.286405],"density":1,"recursiveLimit":5,"joint":{"type":"twist","angleLimits":[0.032271,0.221319,0.063573],"phaseLag":0.17753},"colorGenes":{"hueShift":-0.148127,"valueShift":0.266022,"patternPhase":0.105015},"sites":[{"face":0,"at":[-0.734164,0.406145]}]},{"id":"nmt8im","dims":[0.314644,0.222705,1.566241],"density":1,"recursiveLimit":2,"joint":{"type":"twist","angleLimits":[0.341478,0.080413,0.14768],"phaseLag":-0.143513},"colorGenes":{"hueShift":-0.059256,"valueShift":0.199385,"patternPhase":0.19143},"sites":[]},{"id":"ntjupf","dims":[1.267014,1.343016,0.346489],"density":1,"recursiveLimit":3,"joint":{"type":"twist","angleLimits":[0.344555,0.1598,0.270263],"phaseLag":-0.110145},"colorGenes":{"hueShift":0.001504,"valueShift":-0.145649,"patternPhase":0.559081},"sites":[]},{"id":"ny02an","dims":[0.447142,1.244652,0.752558],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.658578,1.559305,1.025491],"phaseLag":-0.046023},"colorGenes":{"hueShift":-0.053297,"valueShift":-0.025907,"patternPhase":0.642255},"sites":[]},{"id":"nzc0ht","dims":[0.471529,1.073433,1.615999],"density":1,"recursiveLimit":5,"joint":{"type":"twist","angleLimits":[0.221091,0.182429,0.309016],"phaseLag":0.12146},"colorGenes":{"hueShift":-0.109233,"valueShift":0.164836,"patternPhase":0.981162},"sites":[]},{"id":"nnz7l2","dims":[0.511485,1.060973,0.320112],"density":1,"recursiveLimit":4,"joint":{"type":"revolute","angleLimits":[0.189775,1.329994,0.968646],"phaseLag":-0.109365},"colorGenes":{"hueShift":-0.034379,"valueShift":-0.202652,"patternPhase":0.281378},"sites":[]},{"id":"n75rcs","dims":[1.935962,1.95305,0.224818],"density":1,"recursiveLimit":1,"joint":{"type":"revolute","angleLimits":[0.644154,0.447955,0.095155],"phaseLag":0.213379},"colorGenes":{"hueShift":0.065246,"valueShift":-0.238619,"patternPhase":0.567533},"sites":[]}],"connections":[{"id":"cwn8fq","parentNodeId":"nn348k","childNodeId":"nmt8im","parentFace":3,"position":[0.935296,-0.950869],"orientation":[-0.520549,0.143321,-0.740268],"scale":[1.993003,0.833266,1.90538],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"chwwbm","parentNodeId":"nn348k","childNodeId":"ntjupf","parentFace":1,"position":[-0.609826,0.880807],"orientation":[0.370499,-0.168555,0.370961],"scale":[0.643833,1.598579,1.045739],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"c959k8","parentNodeId":"nn348k","childNodeId":"ny02an","parentFace":0,"position":[-0.010093,-0.553083],"orientation":[0.05056,0.432668,-0.149829],"scale":[1.884355,1.024546,1.886478],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cpq66x","parentNodeId":"ny02an","childNodeId":"nzc0ht","parentFace":1,"position":[-0.350927,0.429305],"orientation":[-0.598756,0.243404,0.534476],"scale":[1.799869,0.89181,1.19027],"reflectX":false,"reflectY":false,"reflectZ":true,"terminalOnly":false},{"id":"cksine","parentNodeId":"nzc0ht","childNodeId":"nzc0ht","parentFace":0,"position":[-0.612067,0.942772],"orientation":[-0.040359,0.519965,0.522495],"scale":[0.517289,0.543081,1.225605],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"chzs82","parentNodeId":"ny02an","childNodeId":"nnz7l2","parentFace":4,"position":[0.942986,-0.756245],"orientation":[-0.308712,0.602208,-0.351586],"scale":[1.431488,1.931635,0.810245],"reflectX":false,"reflectY":true,"reflectZ":false,"terminalOnly":false},{"id":"cspk21","parentNodeId":"nnz7l2","childNodeId":"n75rcs","parentFace":4,"position":[0.307545,-0.382296],"orientation":[-0.650724,0.70216,-0.388528],"scale":[0.524197,0.953082,1.90782],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"ciyrk1","parentNodeId":"n75rcs","childNodeId":"nnz7l2","parentFace":1,"position":[0.664467,-0.816365],"orientation":[-0.114628,0.406113,-0.238618],"scale":[1.912497,1.836917,0.716139],"reflectX":true,"reflectY":true,"reflectZ":false,"terminalOnly":false}],"material":{"hue":0.883525,"hueVariance":0.102881,"patternScale":6.182229,"patternContrast":0.912005,"stripeAnisotropy":0.393451,"iridescence":0.88963},"controller":{"omega":3.128496,"preyGain":0.17066,"threatGain":-0.885082,"phaseBase":2.940501,"phaseSlope":0.037773,"proprioGain":0,"chemoGain":0,"jointGenes":{"nn348k":{"amplitude":0.862602,"bias":0.408237,"freqMult":2},"nmt8im":{"amplitude":0.136075,"bias":0.098905,"freqMult":1},"ntjupf":{"amplitude":0.108103,"bias":-0.006079,"freqMult":1},"ny02an":{"amplitude":0.983335,"bias":0.479901,"freqMult":1},"nzc0ht":{"amplitude":0.273537,"bias":-0.176507,"freqMult":1},"nnz7l2":{"amplitude":0.94271,"bias":0.498962,"freqMult":1},"n75rcs":{"amplitude":0.632293,"bias":0.328363,"freqMult":1}}},"social":{"trophic":0.374453,"boldness":0.944093,"cohesion":0.149174,"separation":0.655104,"alignment":0.370678,"separationRadius":3.96144}};

/**
 * Migrate and stamp the founder.
 *
 * `migrate` ONLY — NOT `deserialise`, and the difference caught me. These came out
 * of the Atlas store, which holds the HYDRATED form: `controller.jointGenes` is
 * the map the engine reads, keyed by nodeId. `deserialise` expects the SERIALISED
 * form, where the same field is an array (genome.js:341 explains why it is keyed
 * rather than positional), and it throws on sight of the map.
 *
 * Two representations of one field, and the only thing that distinguishes them is
 * which side of `serialise` you are on. Deep-copied first so a literal above is
 * never mutated by a migration running twice.
 */
/**
 * Glossy tumbling oddfoot · *Tactops gravis*  ·  SELECTED, NOT CURATED
 *
 * The first two entries in this file were FOUND — picked out of a live Atlas by
 * a player because they looked interesting. These two were SELECTED: they are
 * the score-arm winners of `tools/_zgoalevo.mjs`, five generations of selection
 * on control-subtracted goal closure, against a paired random-selection null arm
 * that started from the same founders. That is a different kind of provenance
 * and it is worth the distinction: nobody looked at these and liked them.
 *
 * Seed 1. TWO BODIES AND ONE JOINT — the smallest animal in the library, and it
 * reaches a beacon 4.5 cm away in three of six directions (closure 0.508 against
 * a blind control of 0.013). Its out-of-plane closure is 0.806, BETTER than its
 * in-plane 0.267, which is the opposite of what a single-plane bender should
 * manage and is worth someone eventually explaining.
 *
 * What selection actually moved is legible in one gene: `preyGain 0.400 +
 * threatGain 0.875 = 1.275`, against the 0.200 every authored eel ships. The
 * bodies in this library were never the binding constraint on reaching a target;
 * the sensor gain was, and nothing had ever selected on it.
 */
const ODDFOOT = {"version":6,"seed":138889026,"rootNodeId":"na10el","mouth":{"face":3,"at":[0,0]},"morphology":{"taperStrength":0.839048,"taperRatio":1.014117},"origin":{"founder":null,"generations":0},"nodes":[{"id":"na10el","dims":[1.363376,0.606498,1.315932],"density":1,"recursiveLimit":5,"joint":{"type":"revolute","angleLimits":[0.210732,0.71526,0.220457],"phaseLag":0.231984},"colorGenes":{"hueShift":0.034001,"valueShift":-0.277059,"patternPhase":0.681431},"sites":[]},{"id":"n181kb","dims":[0.570175,0.922991,0.904727],"density":1,"recursiveLimit":5,"joint":{"type":"revolute","angleLimits":[1.417689,1.098276,0.028951],"phaseLag":0.263315},"colorGenes":{"hueShift":-0.122219,"valueShift":0.186987,"patternPhase":0.080139},"sites":[]}],"connections":[{"id":"csi951","parentNodeId":"na10el","childNodeId":"n181kb","parentFace":4,"position":[0.648287,0.80896],"orientation":[-0.754957,0.415305,0.438698],"scale":[1.306687,1.644197,1.61537],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false}],"material":{"hue":0.362768,"hueVariance":0.241753,"patternScale":2.447442,"patternContrast":0.131204,"stripeAnisotropy":0.468459,"iridescence":0.895496},"controller":{"omega":4.313698,"preyGain":0.399767,"threatGain":0.87477,"phaseBase":2.270631,"phaseSlope":0.04304,"proprioGain":0,"chemoGain":0,"jointGenes":{"na10el":{"amplitude":0.768679,"bias":0.147372,"freqMult":1},"n181kb":{"amplitude":0.411614,"bias":-0.412143,"freqMult":1}}},"social":{"trophic":0.227515,"boldness":0.66479,"cohesion":0.639094,"separation":0.997864,"alignment":0.711468,"separationRadius":1.874504}};

/**
 * Banded lurching spokebeast · *Phyllisohydra dentinodissima*  ·  SELECTED
 *
 * Seed 2, and the opposite body: 24 bodies, 23 joints, radial — `actino`, with
 * fifteen mirrored instances and four levels of depth. Closure 0.497, and again
 * strongest out of plane (0.592 against 0.377 in plane).
 *
 * TWO SEEDS, TWO UNRELATED BODY PLANS, THE SAME ANSWER. Neither converged on a
 * shape; both converged on a gain and on whatever gait keeps a bend productive.
 * That is the evidence that the objective is selecting for the behaviour rather
 * than for a morphological accident, and it is why both are kept rather than
 * only the better one.
 */
const SPOKEBEAST = {"version":6,"seed":1875994371,"rootNodeId":"njyn9j","mouth":{"face":4,"at":[0,0]},"morphology":{"taperStrength":0.949217,"taperRatio":0.829764},"origin":{"founder":null,"generations":0},"nodes":[{"id":"njyn9j","dims":[0.746493,1.428242,0.558772],"density":1,"recursiveLimit":1,"joint":{"type":"revolute","angleLimits":[0.74535,0.249144,0.371424],"phaseLag":-0.037278},"colorGenes":{"hueShift":0.063628,"valueShift":0.00165,"patternPhase":0.350233},"sites":[]},{"id":"nusj3z","dims":[0.214024,0.21891,0.461221],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.819809,1.297401,0.225366],"phaseLag":-0.150955},"colorGenes":{"hueShift":-0.081773,"valueShift":0.197332,"patternPhase":0.663025},"sites":[]},{"id":"nu64nf","dims":[0.986477,0.698388,0.633467],"density":1,"recursiveLimit":5,"joint":{"type":"revolute","angleLimits":[0.551606,1.48301,0.156106],"phaseLag":0.286941},"colorGenes":{"hueShift":-0.093053,"valueShift":0.166417,"patternPhase":0.679852},"sites":[]},{"id":"n5ufxx","dims":[1.781587,1.169919,0.832604],"density":1,"recursiveLimit":3,"joint":{"type":"revolute","angleLimits":[0.965387,1.013476,1.088381],"phaseLag":0.015141},"colorGenes":{"hueShift":-0.057031,"valueShift":0.036412,"patternPhase":0.046881},"sites":[]}],"connections":[{"id":"ctpg9q","parentNodeId":"njyn9j","childNodeId":"nusj3z","parentFace":0,"position":[0.934244,0.644582],"orientation":[-0.010262,0.663034,-0.268868],"scale":[1.702143,1.462973,1.13648],"reflectX":true,"reflectY":true,"reflectZ":false,"terminalOnly":false},{"id":"ck5ms8","parentNodeId":"njyn9j","childNodeId":"nu64nf","parentFace":1,"position":[-0.802595,-0.881599],"orientation":[-0.671825,0.757551,-0.034994],"scale":[1.548818,1.913581,1.785693],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"cj1db4","parentNodeId":"nu64nf","childNodeId":"n5ufxx","parentFace":3,"position":[0.618536,-0.62255],"orientation":[-0.118142,-0.431209,-0.657465],"scale":[1.64941,1.58113,0.551201],"reflectX":false,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"c2s5l4","parentNodeId":"nusj3z","childNodeId":"nusj3z","parentFace":5,"position":[0.934104,-0.88801],"orientation":[-0.180337,0.076447,0.14205],"scale":[0.83022,0.759972,0.739557],"reflectX":true,"reflectY":true,"reflectZ":false,"terminalOnly":false},{"id":"c03uxw","parentNodeId":"njyn9j","childNodeId":"njyn9j","parentFace":5,"position":[0.830536,0.203693],"orientation":[0.262383,0.015432,-0.038201],"scale":[0.71783,0.645719,0.680309],"reflectX":true,"reflectY":false,"reflectZ":true,"terminalOnly":true},{"id":"cmcike","parentNodeId":"nusj3z","childNodeId":"njyn9j","parentFace":4,"position":[0.794466,0.794154],"orientation":[0.288898,0.053976,0.753396],"scale":[0.764968,1.973008,0.668721],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":false},{"id":"c2abgx","parentNodeId":"nusj3z","childNodeId":"n5ufxx","parentFace":5,"position":[0.611242,-0.432017],"orientation":[-0.108342,-0.446122,-0.064994],"scale":[1.745994,1.245743,1.863256],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false}],"material":{"hue":0.317122,"hueVariance":0.049003,"patternScale":2.489322,"patternContrast":0.216993,"stripeAnisotropy":0.691064,"iridescence":0.092424},"controller":{"omega":4.753209,"preyGain":-0.323863,"threatGain":0.807421,"phaseBase":0.797498,"phaseSlope":0.000006,"proprioGain":0.084184,"chemoGain":0,"jointGenes":{"njyn9j":{"amplitude":0.159439,"bias":0.001151,"freqMult":1},"nusj3z":{"amplitude":0.74185,"bias":0.060361,"freqMult":1},"nu64nf":{"amplitude":0.971954,"bias":-0.289851,"freqMult":1},"n5ufxx":{"amplitude":0.769844,"bias":-0.470049,"freqMult":1}}},"social":{"trophic":0.163752,"boldness":0.375034,"cohesion":0.039853,"separation":0.226493,"alignment":0.155175,"separationRadius":3.529055}};

/**
 * Striped lurching stumbler · *Streptoligosphalmatops longifrontissimis*  ·  SELECTED
 *
 * ── ROUND TWO, AND WHY THERE HAD TO BE ONE ──────────────────────────────────
 *
 * The oddfoot and the spokebeast above were selected on a target SCALED to each
 * creature's own cruise speed. That is the right way to compare bodies and it
 * was the wrong way to breed for a tank, because it normalises range out of the
 * objective entirely. `tools/_zbeacon.mjs` then failed at 1 arrival in 30, and
 * the reason was not aim:
 *
 *     creature             closure   v cm/s   can travel in 120 s   task
 *     oddfoot-glossy         0.202    0.019         2.3 cm          8 cm
 *     spokebeast-banded      0.311    0.033         4.0 cm          8 cm
 *
 * They aim beautifully and cannot get there. The spokebeast spends nearly its
 * whole 4 cm budget swimming straight at the mark on all five placements — the
 * most consistent aiming in that table — and still ends 4.3 cm short.
 *
 * This one was selected on an ABSOLUTE 8 cm target, the distance the tank
 * actually poses, from authored founders that can cover it. It is the best
 * beacon-reacher in the library: 2 arrivals in 8 placements, closure 0.403,
 * and 25.9 cm of reach against the task's 8.
 *
 * ⚠ WHAT THAT LETS IT CLAIM, AND WHAT IT DOES NOT — standing rule 10.
 * This is an eel descendant. Its run shows SELECTION IMPROVING A COMPETENT
 * FOUNDER; it does not show that evolution discovered seeking, and it must
 * never be quoted as if it did. The oddfoot and the spokebeast are the ones
 * that speak to discovery — random founders, no authored ancestry — and that is
 * exactly why all three stay in this file rather than only the one that wins.
 *
 * WHAT SELECTION MOVED, in both rounds and from both kinds of founder, is the
 * SENSOR GAIN: 0.200 in every authored eel, 0.608 and 0.554 here, 1.275 and
 * 0.484 in the round-one pair. Four winners, two founding regimes, one gene.
 */
const STUMBLER_A = {"version":6,"seed":0,"rootNodeId":"seg","mouth":{"face":5,"at":[0,0]},"morphology":{"taperStrength":0,"taperRatio":1},"origin":{"founder":"eel","generations":0},"nodes":[{"id":"seg","dims":[0.5,0.35,1.2],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.5707963267948966},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[{"face":1,"at":[0.809439,0.73985]}]}],"connections":[{"id":"c_self","parentNodeId":"seg","childNodeId":"seg","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.95,1.084166,0.95],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false}],"material":{"hue":0.55,"hueVariance":0.08,"patternScale":3,"patternContrast":0.4,"stripeAnisotropy":0.7,"iridescence":0.15},"controller":{"omega":4,"preyGain":0.6,"threatGain":0.007831,"phaseBase":0,"phaseSlope":0,"proprioGain":0,"chemoGain":0,"jointGenes":{"seg":{"amplitude":0.8,"bias":0,"freqMult":1}}},"social":{"trophic":0.4,"boldness":0.5,"cohesion":0.3,"separation":0.5,"alignment":0.4,"separationRadius":1.5}};

/**
 * ── THE SECOND SEED, KEPT AS A RECORD AND NOT AS A LIBRARY ENTRY ─────────────
 *
 * Seed 11's winner: same body count, `eel`'s own node set, `preyGain 0.770 +
 * threatGain -0.216 = 0.554`, and it performed within noise of `STUMBLER_A` in
 * the tank (2/8 arrivals against 2/8, closure 0.308 against 0.403).
 *
 * It was promoted alongside it and then withdrawn, because the two are
 * indistinguishable TO A PERSON LOOKING AT THE LIST. The vernacular derives from
 * body traits, so both came out as "striped lurching stumbler" — the same words
 * `eel`, `eel-unison` and `eel-finned` already carry. Five identically-named
 * animals in a library a player picks from is not evidence, it is noise, and the
 * replication it was kept for is a claim about the EXPERIMENT that belongs in a
 * handover rather than a second shelf entry.
 *
 * The genome stays here, unreferenced, so the claim "two independent seeds
 * converged on the same body count and the same gene" can be re-checked rather
 * than taken on trust. Reproduce with:
 *
 *     node tools/_zgoalevo.mjs 14 5 11 60 8 authored
 */
// eslint-disable-next-line no-unused-vars
const STUMBLER_B_UNUSED ={"version":6,"seed":0,"rootNodeId":"seg","mouth":{"face":5,"at":[-0.046402,0]},"morphology":{"taperStrength":0,"taperRatio":1},"origin":{"founder":"eel","generations":0},"nodes":[{"id":"seg","dims":[0.5,0.35,1.2],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.9,0.9,0.9],"phaseLag":1.5707963267948966},"colorGenes":{"hueShift":0,"valueShift":0,"patternPhase":0},"sites":[]}],"connections":[{"id":"c_self","parentNodeId":"seg","childNodeId":"seg","parentFace":5,"position":[0,0],"orientation":[0,0,0],"scale":[0.95,1.075547,0.95],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false}],"material":{"hue":0.55,"hueVariance":0.08,"patternScale":3,"patternContrast":0.4,"stripeAnisotropy":0.7,"iridescence":0.15},"controller":{"omega":4,"preyGain":0.77045,"threatGain":-0.216345,"phaseBase":0,"phaseSlope":0,"proprioGain":0,"chemoGain":0,"jointGenes":{"seg":{"amplitude":0.8,"bias":0.032906,"freqMult":1}}},"social":{"trophic":0.4,"boldness":0.5,"cohesion":0.3,"separation":0.5,"alignment":0.4,"separationRadius":1.5}};
/**
 * Beacon-seeking euryprotea · *Euryprotea dentinodata*
 *
 * SELECTED, AND THE FIRST ENTRY IN THIS FILE WITH NO AUTHORED ANCESTOR AT ALL.
 * `origin.founder` is `null` and `generations` is 6: a random draw's
 * great-great-great-great-grandchild, won by `tools/_zbreed.mjs` on `closedCm`
 * against a paired random-selection null arm, from a founding population that
 * contained no eel, no medusa and nothing anybody drew. Every other SELECTED
 * specimen here was bred from authored founders or on a target scaled to the
 * creature; standing rule 10 required that be said out loud each time, and this
 * is the first one it does not apply to.
 *
 * On the canonical trial — six directions x 90 s at the 8 cm the tank actually
 * places its beacon — it closes 6.21 cm of the 8, arrives in two of six, and
 * holds station for 28% of the run. In-plane 5.85 against out-of-plane 5.95: it
 * is no worse at targets ninety degrees out of the plane it bends in than at
 * ones inside it, which is the same corkscrewing the authored eels do and which
 * nothing selected for directly.
 *
 * Its sensor gain sums to 0.824 against the 0.200 every authored eel ships —
 * the third independent run to land on that finding from a different direction.
 * Both channels are NEGATIVE (`preyGain` -0.546, `threatGain` -0.278) and it
 * seeks anyway: the sign is evolved, and what matters is the loop's closed sign,
 * not which end of it carries the minus.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
 *
 * It is not the highest-scoring animal that run produced. That was a 6.87 cm
 * seeker arriving in SIX of six — and `origin.generations` on it is 0, so it was
 * never bred: it walked in through N17's stranger slot as a fresh random draw at
 * generation 17 and won on arrival. It is kept in the ark and out of this file,
 * because a library entry is a claim about where creatures come from and that
 * one is a claim about the random draw rather than about breeding. See
 * design/15-BREEDING.md section 5.5.
 */
const BEACON_EURYPROTEA = {"version":8,"seed":3551230541,"rootNodeId":"n9nbqb","mouth":{"face":4,"at":[0,0]},"morphology":{"taperStrength":0.68046,"taperRatio":0.911075},"origin":{"founder":null,"generations":6},"nodes":[{"id":"n9nbqb","dims":[1.877973,1.887,0.668199],"density":1,"recursiveLimit":5,"joint":{"type":"twist","angleLimits":[0.065284,0.09053,0.280914],"phaseLag":-0.005462},"colorGenes":{"hueShift":-0.136749,"valueShift":-0.205367,"patternPhase":0.306669},"sites":[]},{"id":"n1xx72","dims":[1.769118,1.988542,0.88681],"density":1,"recursiveLimit":2,"joint":{"type":"twist","angleLimits":[0.110936,0.151222,0.113752],"phaseLag":-0.249822},"colorGenes":{"hueShift":-0.08672,"valueShift":-0.151817,"patternPhase":0.683628},"sites":[]},{"id":"ng1fdo","dims":[1.376822,0.589723,1.273854],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.979376,0.411418,0.295227],"phaseLag":-0.182145},"colorGenes":{"hueShift":-0.058008,"valueShift":0.285814,"patternPhase":0.457483},"sites":[]},{"id":"nv2cfn","dims":[1.107842,0.359186,0.965267],"density":1,"recursiveLimit":4,"joint":{"type":"twist","angleLimits":[0.253992,0.300488,0.18104],"phaseLag":-0.106967},"colorGenes":{"hueShift":0.077254,"valueShift":0.007009,"patternPhase":0.3748},"sites":[]},{"id":"n0yrpq","dims":[1.20734,1.547332,1.466452],"density":1,"recursiveLimit":3,"joint":{"type":"twist","angleLimits":[0.303004,0.17377,0.178967],"phaseLag":-0.272468},"colorGenes":{"hueShift":-0.040252,"valueShift":0.131459,"patternPhase":0.140906},"sites":[]},{"id":"ngrg55","dims":[1.376822,0.589723,1.273854],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[0.979376,0.411418,0.295227],"phaseLag":-0.182145},"colorGenes":{"hueShift":-0.058008,"valueShift":0.285814,"patternPhase":0.457483},"sites":[]},{"id":"nppkyx","dims":[1.107842,0.359186,0.965267],"density":1,"recursiveLimit":4,"joint":{"type":"twist","angleLimits":[0.253992,0.300488,0.18104],"phaseLag":-0.106967},"colorGenes":{"hueShift":0.077254,"valueShift":0.007009,"patternPhase":0.3748},"sites":[]},{"id":"nluzi5","dims":[1.996343,0.284513,1.980047],"density":1,"recursiveLimit":6,"joint":{"type":"revolute","angleLimits":[1.134995,0.138037,0.488423],"phaseLag":0.464789},"colorGenes":{"hueShift":-0.029589,"valueShift":0.222469,"patternPhase":0.141559},"sites":[]}],"connections":[{"id":"cv8oiu","parentNodeId":"n9nbqb","childNodeId":"n1xx72","parentFace":1,"position":[-0.695456,0.437003],"orientation":[-0.404155,-0.444572,0.369243],"scale":[1.46643,0.9798,1.029966],"reflectX":true,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cgsk8k","parentNodeId":"n1xx72","childNodeId":"ng1fdo","parentFace":0,"position":[0.04725,0.133684],"orientation":[0.434835,0.264547,0.706453],"scale":[1.724194,0.977162,0.656656],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"czlx5q","parentNodeId":"ng1fdo","childNodeId":"nv2cfn","parentFace":0,"position":[0.366248,-0.364813],"orientation":[-0.723609,0.203232,0.149062],"scale":[1.972139,1.472633,1.225822],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cynhtp","parentNodeId":"nv2cfn","childNodeId":"n0yrpq","parentFace":3,"position":[0.696647,-0.559213],"orientation":[-0.19493,0.745744,-0.255669],"scale":[0.959227,0.51746,0.552414],"reflectX":true,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"cvr2lg","parentNodeId":"nv2cfn","childNodeId":"n0yrpq","parentFace":1,"position":[-0.166911,-0.644885],"orientation":[-0.51882,-0.222348,-0.030764],"scale":[0.887263,1.143797,0.994787],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"caglol","parentNodeId":"n0yrpq","childNodeId":"n0yrpq","parentFace":1,"position":[0.788733,0.849138],"orientation":[-0.130406,0.205935,-0.057311],"scale":[0.577736,1.380941,0.735645],"reflectX":true,"reflectY":true,"reflectZ":true,"terminalOnly":true},{"id":"cbhx0v","parentNodeId":"n9nbqb","childNodeId":"ngrg55","parentFace":5,"position":[-0.892284,-0.192822],"orientation":[-0.071856,0.301759,-0.577156],"scale":[1.585431,0.642811,1.567823],"reflectX":true,"reflectY":false,"reflectZ":true,"terminalOnly":false},{"id":"chfcly","parentNodeId":"ngrg55","childNodeId":"nppkyx","parentFace":0,"position":[0.366248,-0.364813],"orientation":[-0.723609,0.203232,0.149062],"scale":[1.972139,1.472633,1.225822],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false},{"id":"csky0w","parentNodeId":"ngrg55","childNodeId":"nluzi5","parentFace":3,"position":[0.890144,-0.203024],"orientation":[-0.283162,0.708279,0.597164],"scale":[1.356546,1.21688,1.045644],"reflectX":false,"reflectY":false,"reflectZ":false,"terminalOnly":false}],"material":{"hue":0.879816,"hueVariance":0.049221,"patternScale":5.126505,"patternContrast":0.930778,"stripeAnisotropy":0.435815,"iridescence":0.676756},"controller":{"omega":4.961705,"preyGain":-0.545889,"threatGain":-0.277923,"preyGain2":0,"threatGain2":0,"brakeGain":0,"phaseBase":0.28104,"phaseSlope":0.090225,"proprioGain":0,"chemoGain":0,"jointGenes":{"n0yrpq":{"amplitude":0.835096,"bias":-0.191583,"freqMult":1},"n1xx72":{"amplitude":0.556196,"bias":0.214,"freqMult":1},"n9nbqb":{"amplitude":0.83399,"bias":-0.313616,"freqMult":1},"ng1fdo":{"amplitude":0.390599,"bias":-0.147025,"freqMult":1},"ngrg55":{"amplitude":0.390599,"bias":-0.147025,"freqMult":1},"nluzi5":{"amplitude":0.607724,"bias":0.062006,"freqMult":2},"nppkyx":{"amplitude":0.136451,"bias":-0.428382,"freqMult":0.5},"nv2cfn":{"amplitude":0.136451,"bias":-0.428382,"freqMult":0.5}}},"social":{"trophic":0.46485,"boldness":0.186628,"cohesion":0.985618,"separation":0.810748,"alignment":0.533706,"separationRadius":3.853094}};

function curate(raw, id) {
  const g = migrate(JSON.parse(JSON.stringify(raw)));
  return { ...g, origin: { founder: id, generations: 0 } };
}

export const CURATED = [
  {
    id: 'snarlback-teal',
    name: 'Teal pulsing snarlback',
    binomial: 'Phylloliganomalops longiventissimis',
    note: 'FOUND, NOT DESIGNED — picked out of a live Atlas for its efficiency. A medusa descendant twenty-six generations down: it kept jelly’s tentacle node and grew a segmented spine around it, which is a body plan nobody in this project would have thought to draw. Its `origin.founder` is rewritten to its own id here because it is a library entry now; the jelly ancestry is recorded in the source comment so it is not lost.',
    genome: curate(SNARLBACK, 'snarlback-teal'),
  },
  {
    id: 'protea',
    name: 'Rose tumbling sunwheel',
    binomial: 'Protea dentarticata',
    note: 'FOUND, NOT DESIGNED, and radial without anyone asking: three of its connections carry all three reflection booleans, eight instances apiece. Nothing selected for symmetry — `maxReflectionAxes` was raised to 3 and the search did the rest, which is the strongest evidence in the library that the encoding can reach these shapes on its own. It also grew a receptor by mutation, with a `chemoGain` of 0 behind it: an eye with no nerve, which is exactly the half-finished state a neutral-start gene predicts.',
    genome: curate(PROTEA, 'protea'),
  },
  {
    id: 'oddfoot-glossy',
    name: 'Glossy tumbling oddfoot',
    binomial: 'Tactops gravis',
    note: 'SELECTED, NOT CURATED — the score-arm winner of a five-generation run on control-subtracted goal closure, against a paired null arm from the same founders. Two bodies and one joint, and it reaches a beacon in half the directions tried. Its evolved sensor gain sums to 1.275 against the 0.200 every authored eel ships, which is the whole finding: the bodies were never the binding constraint on reaching a target, the gain was.',
    genome: curate(ODDFOOT, 'oddfoot-glossy'),
  },
  {
    id: 'spokebeast-banded',
    name: 'Banded lurching spokebeast',
    binomial: 'Phyllisohydra dentinodissima',
    note: 'SELECTED, NOT CURATED, and the other seed of the same experiment. Twenty-four bodies where the oddfoot has two, radial where it is a stub — two unrelated body plans that converged on the same answer under the same objective. Strongest out of its own steering plane, which no single-plane bender should manage and which nobody has yet explained.',
    genome: curate(SPOKEBEAST, 'spokebeast-banded'),
  },
  {
    id: 'stumbler-striped',
    name: 'Striped lurching stumbler',
    binomial: 'Streptoligosphalmatops longifrontissimis',
    note: 'SELECTED on an ABSOLUTE 8 cm target — the distance the tank poses — from authored founders that can cover it. An eel descendant that raised its sensor gain from the library\u2019s 0.200 to 0.608. Its provenance is weaker than the oddfoot\u2019s and it is recorded as such: this is selection improving a competent founder, not evolution discovering seeking.',
    genome: curate(STUMBLER_A, 'stumbler-striped'),
  },
  {
    id: 'beacon-euryprotea',
    name: 'Glossy lurching euryprotea',
    binomial: 'Euryprotea dentinodata',
    note: 'SELECTED FROM RANDOM FOUNDERS — the first library entry with no authored ancestor: `origin.founder` null, six births deep, won by tools/_zbreed.mjs on closedCm against a paired null arm. Closes 6.21 cm of the tank’s own 8 cm beacon and holds station for 28% of the trial, and it is no worse out of its steering plane than in it. Sensor gain 0.824 against the library’s 0.200, both channels negative and seeking anyway. The run’s highest scorer was better still and is deliberately NOT here: it was never bred, it arrived as a random stranger at generation 17.',
    genome: curate(BEACON_EURYPROTEA, 'beacon-euryprotea'),
  },
];

export const curatedById = (id) => CURATED.find((c) => c.id === id) ?? null;

export default CURATED;
