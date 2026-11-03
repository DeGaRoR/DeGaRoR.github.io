// NEW PLANE — the new-aeroplane generator's DECLARATION (NEW-PLANE, the user 2-3 Nov 2026).
//
// The user: "it should generate the plane only after the main choices are made, main choices should be little, like
// 10-15, the detail should be left out" · "it gets stuck into its own menu, and does not leave to the normal sliders
// ... it's confusing and spits out ugly planes" · "this interface should be full screen. At this stage, we only
// choose, then generate the plane and we're in the normal editor. No calculations or rendering while choosing" ·
// "ensure these choices allow us reproducing the breadth of archetypes ... the current non authored archetypes will
// really be the output of the current new plane generator. If there are rules for generation of archetypes, use them".
//
// THIS FILE CHOOSES NOTHING ON ITS OWN AND BUILDS NOTHING. It is three pure things over tools/_cage_design.js:
//   STEPS       the main choices, in order, each a short list of options with the design rows' own SVG symbols
//   why()       the STATIC rule table that greys an option (CONFIG-MATRIX's measured cells, the classes' seats and
//               bays, the catalogue's power bands) - a string the tile shows, never a build
//   compose()   choices -> { sel, over } for CAGE_DESIGN.designBake, the archetypes' own recipe (class + role seeds,
//               the tiles' writes, an over.cage patch) - so a generated aeroplane and a card are one code path
// The chooser (src/viewer/new_plane.js) renders STEPS and calls why() while choosing; generate() is the ONE build.
// GATE NEWPLANE (tools/_newplane_check.js) holds the rule units and a handful of builds.
//
// THE RULES USED, and where each comes from (the brief's "use the existing archetype-generation rules"):
//   class seed       CLASS_ROWS' seeds: span, chord, cabin widths, the taper section and the cintre (SHAPE_SEED)
//   mission seed     ROLE_ROWS' seeds (flaps, the bush tyre...), under the explicit choices (they are written after)
//   tail size        designBake's designTailSeed: the volume coefficients size the drawn tail once, at birth
//   tail outline     FIN_ARCH, the five fin/stab presets ONLY (the user: "use only the presets for the fins")
//   wing shape       WING_ARCH, the planform presets (the wingArch starter row, beside finArch)
//   the cowl         ONE PRESET PER ENGINE TYPE (_cage_cowl.js COWL_PRESETS), applied on the birth build through the
//                    cowl layer's door, sized to the fitted engine; the user fiddles in the editor
//   the aero nose    automatic when nothing is bolted to the nose: "a collapse, 3 rings and a slight ease" (NOSE_NP)
//   the pusher       a back cowl (cowlOn) whose barrel runs the fitted engine's length to the prop's cone (the preset's
//                    length rule), engBlockZ/Y left at 0 (FINISH-4: cowled pushers ignore the block rows)
//   the stance       STANCE: the tricycle's legs per class so the deck sits level-to-nose-up (GEN_RULES.trikeDeck),
//                    the taildragger's three-point attitude from the class's tailwheel leg
//   the canopy       the glazing guidelines: a bubble rides the windscreen's own continuation (bubH 0.79 / bubW 1.25,
//                    the G267 single bubble), the arceau fit is always on, the cabin lamps follow the bubble (no
//                    flood on a bubble - _cage_light.js), an open cockpit has no canopy at all
//   colour/material  spec.paint + the body sections' tint (BODY_PAINT, the aeroskin reach) / intCons -> fuselage
//                    material and the wing's (wgCons follows the fuselage): the mass and the structure follow
'use strict';
(function () {
const W = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined') ? global : {};
const D = () => W.CAGE_DESIGN || ((typeof require === 'function') ? require('./_cage_design.js') : null);
const icon = (row, v) => { try { const o = D().optionOf(row, v); return o ? o.icon : null; } catch (e) { return null; } };

// ---------------------------------------------------------------------------------------------------------------------
// THE ORDER (STATUS.md explains it): what the aeroplane IS first (size, job), then what drives the layout (the engines:
// their placement decides the booms, the nose and the wing that may carry them), then the body that results, the
// wing, the gear and the tail that balance it, then the people inside and the glass over them, then what it is made
// of and how it looks. Every step greys only on choices made BEFORE it, so going back never invalidates silently: a
// pick that a later change greys is cleared and named in the summary.
// ---------------------------------------------------------------------------------------------------------------------
const SWATCHES = [
  ['Cub yellow', 0xf2c437], ['Cream', 0xefe6cf], ['Signal red', 0xb5342a], ['Sky blue', 0x7fa8c9],
  ['Forest', 0x3d5c40], ['Silver', 0xc7c9cc], ['White', 0xf4f2ea], ['Night blue', 0x1b3a5c],
];
// the trim that goes with a base (dark on light, light on dark): the scheme's second colour, never asked
const TRIM_OF = { 0xf2c437: 0x1b3a5c, 0xefe6cf: 0x7c3327, 0xb5342a: 0xf4f2ea, 0x7fa8c9: 0x1b3a5c,
                  0x3d5c40: 0xf4f2ea, 0xc7c9cc: 0x7c3327, 0xf4f2ea: 0xb5342a, 0x1b3a5c: 0xf2c437 };

// option helper: [value, label, note, icon]
const O = (value, label, note, ic) => ({ value, label, note: note || '', icon: ic || null });
const planIcon = k => { try { return D().iconPlan(k); } catch (e) { return null; } };
// plain symbols where a choice has none in the design rows (the user: "simple svg")
const SYM = {
  body: {
    open: { vb: '0 0 64 40', paths: [{ d: 'M8 16 L40 12 L60 18 M8 26 L40 28 L60 21 M14 15 L16 27 M24 14 L26 27 M34 13 L36 28 M14 15 L26 27 M24 14 L36 28', w: 1.3 }] },
  },
  seats: { single: icon('seatLayout', 0), side: icon('seatLayout', 1) },
  top: {
    cabin: () => icon('mirror', 0), turtle: () => icon('mirror', 1),
    open: { vb: '0 0 64 40', paths: [{ d: 'M4 22 L60 20 L60 28 L4 28 Z' }, { d: 'M20 22 Q22 16 28 15 L30 22', w: 1.4 },
                                      { d: 'M38 21 Q40 15 46 14 L48 21', w: 1.4 }] },
  },
  twinBooms: (rod) => ({ vb: '0 0 64 40', paths: [
    { d: 'M4 16 L26 16 L26 24 L4 24 Z' },
    { d: rod ? 'M26 13 L58 13 M26 27 L58 27' : 'M26 11 L58 12 L58 14 L26 15 Z M26 25 L58 26 L58 28 L26 29 Z', w: rod ? 2.2 : 1.5 },
    { d: 'M54 12 L54 28', w: 2 }] }),
};

const STEPS = [
  { key: 'class', title: 'Size class', help: 'how big, how many seats, which rules it flies under',
    rows: [{ key: 'class', opts: () => D().CLASS_ROWS.map(o => Object.assign(O(o.value, o.label, o.note, o.icon),
                                                      o.inactive ? { inactive: o.inactive } : {})) }] },
  { key: 'mission', title: 'Mission', help: 'what it is for: biases the flaps, the tyres and the wing, nothing more',
    rows: [{ key: 'mission', opts: () => D().ROLE_ROWS.map(o => O(o.value, o.label, o.note, o.icon)) }] },
  { key: 'engArch', title: 'Engine architecture', help: 'how many engines, and where they sit',
    rows: [{ key: 'engArch', opts: () => [
      O('nose', 'Single, nose', 'a tractor on the nose', icon('engMount', 'nose')),
      O('pusher', 'Single, pusher', 'on the aft bulkhead, pushing', icon('engMount', 'pusher')),
      O('wingTop', 'Over the wing', 'on a pylon over the centre section', icon('engMount', 'wingTop')),
      O('twin', 'Twin (wings)', 'a nacelle a side, both pulling', icon('engCount', 2)),
      O('pushPull', 'Push-pull', 'one in the nose, one pushing between twin booms', icon('engCount', 'pushPull')),
      O('three', 'Three', 'the nose and a nacelle a side', icon('engCount', 3)),
      O('four', 'Four', 'two nacelles a side', icon('engCount', 4)),
    ] }] },
  { key: 'engType', title: 'Engine type', help: 'the kind of engine; the model is the catalogue\'s nearest to the class (the editor changes it)',
    rows: [{ key: 'engType', opts: () => D().designEngineFamilies().map(o => O(o.value, o.label, '', o.icon)) }] },
  { key: 'body', title: 'Fuselage shape', help: 'the section the body is lofted on, or no skin at all',
    rows: [{ key: 'body', opts: () => [
      O('box', 'Box', 'flat sides, flat top', icon('section', 0)),
      O('roundTop', 'Round top', 'a turtle-round deck over flat sides', icon('section', 1)),
      O('round', 'Round', 'round all over', icon('section', 3)),
      O('open', 'Open frame', 'no covering: the truss in the wind (ultralights)', SYM.body.open),
    ] }] },
  { key: 'booms', title: 'Boom architecture', help: 'what carries the tail',
    rows: [{ key: 'booms', opts: () => [
      O('lofted', 'Lofted tail cone', 'the skin runs to the tail', icon('boomStyle', 0)),
      O('rod', 'Pod & rod', 'a bare tube carries the tail', icon('boomStyle', 1)),
      O('twin', 'Twin booms', 'two lofted booms off the wing', icon('booms', 'twin')),
      O('twinRod', 'Twin tubes', 'two bare tubes off the wing', SYM.twinBooms(true)),
    ] }] },
  { key: 'wing', title: 'Wing', help: 'where it sits, its shape, how it is held',
    rows: [
      { key: 'wing', label: 'Layout', opts: () => [
        O('high', 'High', '', icon('wgPos', 0)), O('mid', 'Mid', '', icon('wgPos', 1)), O('low', 'Low', '', icon('wgPos', 2)),
        O('parasol', 'Parasol', 'on cabane struts above the deck', icon('wgPos', 3)),
        O('biplane', 'Biplane', 'two planes, wires and N struts', icon('planes', 'biplane')),
      ] },
      { key: 'planform', label: 'Shape', opts: () => Object.keys(D().WING_ARCH).map(k =>
        O(k, D().WING_ARCH[k].label, D().WING_ARCH[k].note, planIcon(k))) },
      { key: 'bracing', label: 'Bracing', opts: () => [
        O('struts', 'Lift struts', 'cheap and light, a little drag', icon('wgBrace', 0)),
        O('cantilever', 'Cantilever', 'a real spar box, clean', icon('wgBrace', 1)),
      ] },
    ] },
  { key: 'gear', title: 'Landing gear', help: 'how it sits on the ground',
    rows: [{ key: 'gear', opts: () => [
      O('tail', 'Taildragger', 'three-point attitude', icon('gearLayout', 'tail')),
      O('trike', 'Tricycle', 'sits level on a nose wheel', icon('gearLayout', 'trike')),
      O('floats', 'Floats', 'starts on the water', icon('gearLayout', 'floats')),
    ] }] },
  { key: 'tail', title: 'Tail', help: 'the layout and the fin and stab outline (the presets; the size follows the wing)',
    rows: [
      { key: 'tail', label: 'Layout', opts: () => [
        O('conv', 'Conventional', '', icon('empennage', 'conv')), O('t', 'T-tail', 'the stab on the fin tip', icon('empennage', 't')),
        O('cruci', 'Cruciform', '', icon('empennage', 'cruci')), O('v', 'V-tail', 'two canted panels, no fin', icon('empennage', 'v')),
      ] },
      { key: 'fin', label: 'Fin design', opts: () => ['rounded', 'straight', 'swept', 'broad', 'tall'].map(k => {
        const o = D().optionOf('finArch', k); return O(k, o.label, o.note, o.icon); }) },
    ] },
  { key: 'cabin', title: 'Cabin', help: 'the seat row and what the fuselage top does behind it',
    rows: [
      { key: 'seats', label: 'Seats', opts: () => [O('single', 'Single row', 'one seat abreast', SYM.seats.single),
                                                    O('side', 'Side by side', 'two abreast', SYM.seats.side)] },
      { key: 'top', label: 'Cabin design', opts: () => [
        O('cabin', 'Cabin', 'the roof runs aft to the boom (Cub, C172)', SYM.top.cabin()),
        O('turtle', 'Turtledeck', 'the deck falls away behind the cockpit (RV, glider)', SYM.top.turtle()),
        O('open', 'Open cockpit', 'no roof, a small screen per seat (Tiger Moth)', SYM.top.open),
      ] },
    ] },
  { key: 'bays', title: 'Passenger bays', help: 'each bay is a section of fuselage seating a row as wide as the cockpit\'s',
    rows: [{ key: 'bays', opts: () => [0, 1, 2, 3, 4].map(n => O(n, n === 0 ? 'No bay' : n + (n === 1 ? ' bay' : ' bays'),
                                                                     n === 1 ? 'a tandem, or a 2+2' : '', icon('paxCount', n))) }] },
  { key: 'canopy', title: 'Canopy', help: 'the glazing',
    rows: [{ key: 'canopy', opts: () => [
      O('screen', 'Windscreen', 'the body\'s own glazing', icon('canopy', 'screen')),
      O('bubble', 'Bubble', 'a blown hood over the cockpit', icon('canopy', 'bubble')),
    ] }] },
  { key: 'material', title: 'Construction', help: 'what it is made of: the mass, the strength and the finish follow',
    rows: [{ key: 'material', opts: () => D().rowOptions(D().rowByKey.intCons).map(o => O(o.value, o.label, '', o.icon)) }] },
  { key: 'colour', title: 'Base colour', help: 'the paint; the trim is chosen to go with it',
    rows: [{ key: 'colour', opts: () => SWATCHES.map(([l, h]) => O(h, l, '', icon('base', h) || { vb: '0 0 64 40', paths: [{ d: 'M8 8 L56 8 L56 32 L8 32 Z', fill: '#' + h.toString(16).padStart(6, '0') }] })) }] },
];
const ROW_KEYS = [];
for (const s of STEPS) for (const r of s.rows) ROW_KEYS.push(r.key);
const stepOfRow = {};
for (const s of STEPS) for (const r of s.rows) stepOfRow[r.key] = s.key;
// the option lists are static once the declaration is loaded (their icons are drawn once, not per grey check)
const OPTS_CACHE = {};
const optsOf = rowKey => {
  if (OPTS_CACHE[rowKey]) return OPTS_CACHE[rowKey];
  for (const s of STEPS) for (const r of s.rows) if (r.key === rowKey) {
    const o = r.opts();
    if (o.length) OPTS_CACHE[rowKey] = o;
    return o;
  }
  return [];
};

// ---------------------------------------------------------------------------------------------------------------------
// THE ENGINE MODEL: the family's catalogue engine nearest (in ratio) to the power the class's own seed engine makes,
// split by the engine count (a twin's engines are each ~0.85 of the single's; three or four, ~0.45 - the shed's
// Trimotor and four-engine starters ride 912s on a 4-seater). The RC outrunners, the e-PPG and the bench's generic
// rows are not offered; a family with nothing within a factor 2.5 of the target (4 for the turboprop: the smallest PT6 on
// the Caravan's 4-seater) is greyed (why: engType). [VAL] 4 let a 190 kW Hirth V onto a microlight, nosed over on its wheels.
// ---------------------------------------------------------------------------------------------------------------------
const MODEL_SKIP = new Set(['RC 2212 outrunner', 'RC 6374 outrunner', 'e-PPG 12 kW', 'flat twin', 'flat six',
                            'custom engine', 'Rolls-Royce Merlin 66', 'P&W R-1830', 'rotax 277',
                            'Clerget 9B']);   // (the rotary is the Camel's - validation A: a generated 4-seater on it would not accelerate)
const COUNT_K = { nose: 1, pusher: 1, wingTop: 1, twin: 0.85, pushPull: 0.85, three: 0.45, four: 0.45 };
let PW_CACHE = null;
function powerOf(name) {
  const pw = W.CAGE_ENG_PRESET_POWER;
  if (typeof pw !== 'function') return null;
  if (!PW_CACHE) PW_CACHE = {};
  if (!(name in PW_CACHE)) PW_CACHE[name] = pw(name);
  return PW_CACHE[name];
}
function classPower(cls) {
  const o = D().optionOf('class', cls);
  const nm = o && o.seed && o.seed.cage && o.seed.cage.engPreset;
  return nm ? powerOf(nm) : null;
}
const MODEL_CACHE = {};
// `k`: a biplane wants 1.3x the monoplane's power (validation A: the Tiger Moth's choices on the eab's 74 kW climbed 0.55 m/s)
function modelFor(cls, family, arch, k) {
  const mk = cls + '|' + family + '|' + arch + '|' + (k || 1);
  if (mk in MODEL_CACHE) return MODEL_CACHE[mk];
  return (MODEL_CACHE[mk] = modelFor0(cls, family, arch, k || 1));
}
function modelFor0(cls, family, arch, k) {
  const target = (classPower(cls) || 60000) * (COUNT_K[arch] || 1) * k;
  let best = null, bestR = Infinity;
  for (const o of D().designEngineModels()) {
    if (o.family !== family || MODEL_SKIP.has(o.value)) continue;
    const p = powerOf(o.value);
    if (!(p > 0)) continue;
    const r = Math.max(p / target, target / p);
    if (r < bestR) { bestR = r; best = o.value; }
  }
  return best ? { name: best, ratio: bestR } : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// THE STATIC RULE TABLE. Each line: a row, an option, and the reason it is greyed given the choices made so far.
// Sources: [CM] = docs/CONFIG-MATRIX.md (origin/claude/config-matrix-step4, measured 2 Nov, section 11); [CL] = the
// classes' own seeds (seats, bays); [CAT] = the engine catalogue's power; [VAL] = validation A (STATUS.md), a
// combination measured broken once and greyed rather than offered.
// ---------------------------------------------------------------------------------------------------------------------
const MAX_BAYS = { ul1: 0, ulm: 1, lsa: 1, eab: 2, n23: 4, sail: 1 };
const SINGLE_SEAT = new Set(['ul1', 'sail']);
const RULES = [
  // [CM 11] the pusher needs an aft bulkhead: a lofted body runs to the tail
  ['booms', 'lofted', c => (c.engArch === 'pusher') && 'a lofted body runs to the tail: no aft bulkhead for the pusher (pod & rod, or twin booms)'],
  ['booms', 'lofted', c => c.engArch === 'pushPull' && 'the rear engine pushes between twin booms (the Skymaster)'],
  ['booms', 'rod', c => c.engArch === 'pushPull' && 'the rear disc would sweep the rod: a push-pull carries its tail on twin booms'],
  // an open frame is a truss: there is no skin to loft a tail cone or a boom on
  ['booms', 'lofted', c => c.body === 'open' && 'an open frame has no skin to loft a tail cone on: the tail rides a tube'],
  ['booms', 'twin', c => c.body === 'open' && 'an open frame has no skin to loft booms on: twin tubes, or a rod'],
  // [CM 11] the stab cannot seat on a centre fin the booms do not have
  ['tail', 't', c => /^twin/.test(c.booms || '') && 'twin booms have no centre fin for the stab to sit on'],
  ['tail', 'v', c => /^twin/.test(c.booms || '') && 'one canted panel per boom is not a V-tail (a garage gap: the inverted V)'],
  // [CM 11] the pylon stands on a high wing or a parasol
  ['wing', 'mid', c => c.engArch === 'wingTop' && 'the over-the-wing pylon stands on a high wing or a parasol'],
  ['wing', 'low', c => c.engArch === 'wingTop' && 'the over-the-wing pylon stands on a high wing or a parasol'],
  // a biplane is braced by its interplane struts and wires (every biplane card is `cantilever` in the lift-strut row)
  ['bracing', 'struts', c => c.wing === 'biplane' && 'a biplane is braced by its interplane struts and wires'],
  // the elliptic law has no crank for a strut to land on (the frame's G140 ruling: the strut lands at the crank)
  ['bracing', 'struts', c => c.planform === 'elliptic' && 'the elliptic wing has no crank for a lift strut to land on'],
  ['planform', 'hershey', c => c.wing === 'biplane' && 'two planes with a strut crank each: build it as a monoplane, or shape each plane in the editor'],
  // [CL] seats and bays per class
  ['seats', 'side', c => SINGLE_SEAT.has(c.class) && 'a single-seat class'],
  ...[1, 2, 3, 4].map(n => ['bays', n, c => c.class && n > (MAX_BAYS[c.class] == null ? 4 : MAX_BAYS[c.class]) &&
    'more fuselage than the class carries (' + (MAX_BAYS[c.class] ? 'up to ' + MAX_BAYS[c.class] : 'no bay') + ')']),
  ['bays', 2, c => c.top === 'open' && 'open cockpits: a pilot and at most one passenger, each in their own hole'],
  ['bays', 3, c => c.top === 'open' && 'open cockpits: a pilot and at most one passenger, each in their own hole'],
  ['bays', 4, c => c.top === 'open' && 'open cockpits: a pilot and at most one passenger, each in their own hole'],
  ['bays', 2, c => c.top === 'turtle' && 'a turtledeck falls away behind a short cockpit (the RV-4 is one bay)'],
  ['bays', 3, c => c.top === 'turtle' && 'a turtledeck falls away behind a short cockpit (the RV-4 is one bay)'],
  ['bays', 4, c => c.top === 'turtle' && 'a turtledeck falls away behind a short cockpit (the RV-4 is one bay)'],
  ['top', 'open', c => c.body === 'open' && 'an open frame is already open'],
  // the canopy: an open cockpit has no hood; an open frame has nothing to glaze
  ['canopy', 'bubble', c => c.top === 'open' && 'an open cockpit has its own small screens, no hood'],
  ['canopy', 'bubble', c => c.body === 'open' && 'an open frame has no body to seat a hood on'],
  // [CL] engines and classes
  ['engArch', 'three', c => c.class && c.class !== 'n23' && 'three engines want a Normal-category airframe'],
  ['engArch', 'four', c => c.class && c.class !== 'n23' && 'four engines want a Normal-category airframe'],
  // [VAL] a pusher on a tailwheel: the disc swings down to the ground as the tail sits (validation A: the ulm pusher
  // taildragger sat 9.5 deg tail-down with the pilot unable to raise it - the Pod-and-boom and Archaeopteryx cards are
  // tricycles, and so is every pusher pod)
  ['gear', 'tail', c => (c.engArch === 'pusher') && 'a pusher sits on a nose wheel: tail-down, its disc would swing into the ground'],
  ['engArch', 'pushPull', c => (c.class === 'ul1' || c.class === 'sail') && 'two engines and twin booms on a single-seat glider or ultralight'],
  ['engArch', 'twin', c => c.class === 'sail' && 'a sailplane carries one sustainer'],
  ['engArch', 'wingTop', c => c.class === 'sail' && 'a sailplane carries its sustainer on the nose or behind the pod'],
  // [CAT] a family with no catalogue engine near the class's power
  ...['electric', 'inline', 'flat', 'vee', 'radial', 'turbine'].map(f => ['engType', f, c => {
    if (!c.class) return null;
    const m = modelFor(c.class, f, c.engArch || 'nose');
    if (!m) return 'no ' + f + ' engine in the catalogue';
    return m.ratio > (f === 'turbine' ? 4 : 2.5) ? 'the nearest ' + f + ' engine (' + m.name + ') is ' + (m.ratio).toFixed(1) +
      ' times the power this class and layout want' : null;
  }]),
  // [CL] the ultralight's bolted tube is an ultralight's
  ['material', 4, c => c.class && !['ul1', 'ulm'].includes(c.class) && 'bolted aluminium tube is the ultralight\'s structure'],
  ['body', 'open', c => c.class && !['ul1', 'ulm'].includes(c.class) && 'an open frame is an ultralight\'s'],
];
const RULE_INDEX = {};
for (const [row, val, f] of RULES) (RULE_INDEX[row + '=' + val] = RULE_INDEX[row + '=' + val] || []).push(f);
// the greyed reason for one option, given the choices (null = offered). Only choices of EARLIER steps are read (the
// order contract), except the class, which every later rule may read.
function why(ch, rowKey, value) {
  const o = optsOf(rowKey).find(x => x.value === value);
  if (o && o.inactive) return o.inactive;
  const fs = RULE_INDEX[rowKey + '=' + value];
  if (!fs) return null;
  const before = {};
  const lim = ROW_KEYS.indexOf(rowKey);
  for (let i = 0; i < lim; i++) { const k = ROW_KEYS[i]; if (ch[k] != null) before[k] = ch[k]; }
  for (const f of fs) { const w = f(before); if (w) return w; }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// THE DEFAULTS: what a skipped step takes - the class's most typical aeroplane (read off the shed's own cards of that
// class), bent by the choices already made. A default is never a greyed option: the first offered one in a preference
// list wins.
// ---------------------------------------------------------------------------------------------------------------------
const PREF = {
  ul1:  { mission: 'trainer', engArch: 'nose', engType: 'inline', body: 'box', booms: 'rod', wing: 'high', planform: 'rect',
          gear: 'tail', tail: 'conv', fin: 'straight', seats: 'single', top: 'cabin', bays: 0, canopy: 'screen', material: 1, colour: 0xf2c437 },
  ulm:  { mission: 'trainer', engArch: 'nose', engType: 'flat', body: 'roundTop', booms: 'lofted', wing: 'high', planform: 'rect',
          gear: 'tail', tail: 'conv', fin: 'broad', seats: 'side', top: 'cabin', bays: 0, canopy: 'screen', material: 3, colour: 0xefe6cf },
  lsa:  { mission: 'trainer', engArch: 'nose', engType: 'flat', body: 'round', booms: 'lofted', wing: 'low', planform: 'taper',
          gear: 'trike', tail: 'conv', fin: 'swept', seats: 'side', top: 'cabin', bays: 0, canopy: 'bubble', material: 0, colour: 0xf4f2ea },
  eab:  { mission: 'touring', engArch: 'nose', engType: 'flat', body: 'roundTop', booms: 'lofted', wing: 'low', planform: 'taper',
          gear: 'tail', tail: 'conv', fin: 'straight', seats: 'side', top: 'cabin', bays: 0, canopy: 'screen', material: 2, colour: 0xefe6cf },
  n23:  { mission: 'touring', engArch: 'nose', engType: 'flat', body: 'roundTop', booms: 'lofted', wing: 'high', planform: 'hershey',
          gear: 'trike', tail: 'conv', fin: 'swept', seats: 'side', top: 'cabin', bays: 1, canopy: 'screen', material: 3, colour: 0xf4f2ea },
  sail: { mission: 'glider', engArch: 'nose', engType: 'electric', body: 'round', booms: 'lofted', wing: 'mid', planform: 'taper',
          gear: 'tail', tail: 't', fin: 'tall', seats: 'single', top: 'turtle', bays: 0, canopy: 'bubble', material: 0, colour: 0xf4f2ea },
};
const BRACE_PREF = { high: 'struts', parasol: 'struts', mid: 'cantilever', low: 'cantilever', biplane: 'cantilever' };
function defaultFor(ch, rowKey) {
  const cls = ch.class || 'eab';
  let want = rowKey === 'class' ? 'eab' : rowKey === 'bracing' ? BRACE_PREF[ch.wing] || 'cantilever' : (PREF[cls] || PREF.eab)[rowKey];
  // a pusher's natural body is the pod & rod; a push-pull's the twin booms; a bubble over a turtledeck when the deck is
  if (rowKey === 'booms' && ch.engArch === 'pushPull') want = 'twin';
  if (rowKey === 'booms' && ch.engArch === 'pusher') want = 'rod';
  if (rowKey === 'booms' && ch.body === 'open') want = 'rod';
  if (rowKey === 'wing' && ch.engArch === 'wingTop') want = 'high';
  if (rowKey === 'gear' && ch.engArch === 'pusher') want = 'trike';
  // a light pusher takes the light two-stroke (the Pod-and-boom card's 582): a boxer's weight behind the pod is the
  // margin the balance fit then has to buy back by sliding the wing aft, into the disc
  if (rowKey === 'engType' && ch.engArch === 'pusher' && ['ul1', 'ulm', 'lsa'].includes(cls)) want = 'inline';
  if (rowKey === 'canopy' && ch.top === 'turtle') want = 'bubble';
  const opts = optsOf(rowKey);
  const ok = v => opts.some(o => o.value === v) && !why(ch, rowKey, v);
  if (want != null && ok(want)) return want;
  const first = opts.find(o => !why(ch, rowKey, o.value));
  return first ? first.value : null;
}
// every row filled: the choices as given where offered, a default where skipped or greyed by a later change
// (`cleared` names each pick a later change greyed - the summary says so)
function complete(chIn) {
  const ch = {}, cleared = [];
  for (const k of ROW_KEYS) {
    const v = chIn ? chIn[k] : undefined;
    if (v != null && optsOf(k).some(o => o.value === v) && !why(ch, k, v)) ch[k] = v;
    else { if (v != null) cleared.push(k); ch[k] = defaultFor(ch, k); }
  }
  return { choices: ch, cleared };
}

// ---------------------------------------------------------------------------------------------------------------------
// THE STANCE (the brief: "tricycles that make sense, and hold their horizontal lines"). The tricycle tile's legs
// (s2Drop 0.37 / fork 0.09, the mains at s1Z 0.95) were tuned on the 172-, RV- and Caravan-alikes (+0.2..+1.2 deg
// nose-up). A class whose mains hang a different height (the class's own legDrop through the gear layer) needs its
// nose leg to match, so the deck stays a touch nose-up (GEN_RULES.trikeDeck 1.2) and never sits nose-down. The table
// is MEASURED (validation A, STATUS.md) per class x engine weight band, the nose leg as the cage's s2Drop.
// ---------------------------------------------------------------------------------------------------------------------
const STANCE = {
  // class: { trike: { s2Drop, s1Z }, tail: { s1Drop? } } - filled from validation A; null = the tile's own values
  ul1: { trike: null }, ulm: { trike: null }, lsa: { trike: null }, eab: { trike: null }, n23: { trike: null },
  sail: { trike: null },
};
const HEAVY = new Set(['radial', 'turbine', 'vee']);
function stanceFor(ch) {
  const row = STANCE[ch.class] || {};
  const t = ch.gear === 'trike' ? row.trike : ch.gear === 'tail' ? row.tail : null;
  if (!t) return {};
  const band = HEAVY.has(ch.engType) ? 'heavy' : 'light';
  return Object.assign({}, t.all || {}, t[band] || {});
}

// THE STANCE FIT (the brief: "tricycles that make sense, and hold their horizontal lines"; the taildragger "a proper
// 3-point attitude"). The drawn gear's stations are absolute in the airframe (s1Z, metres), the CG is wherever the
// engine, the bays and the wing put it - so no compose-time table can seat the mains for every combination (validation
// A measured the tile's own s1Z putting the eab taildragger's mains 11.7 deg ahead of its CG, where the pilot will not
// open the throttle, and the n23 tricycle's 37 deg behind it). The fit READS THE DRAWN AEROPLANE once - the joined
// spec of the birth build - and moves the legs by the core's own rules, in metres:
//   taildragger  the mains GEN_RULES.gearRake + 1 deg ahead of the CG (the gear layer's 15-18 window)
//   tricycle     the nose wheel carrying GEN_RULES.noseLoad (0.25: the soft airframe's measured need) and the tip-back
//                angle >= 15 deg; then the nose leg sized so the deck sits GEN_RULES.trikeDeck (1.2 deg) nose-up -
//                the cabin floor, the waterline and the designed incidence hold their lines on the ground
//   both         the prop clearance >= 0.25 m on a tailwheel, 0.22 m on a nose wheel (FAR 23.925 0.229 / 0.178, a
//                margin over each): the mains lengthened, a tricycle's nose leg with them
// Returns the cage rows to change, or null when the drawn stance already holds (then nothing is rebuilt).
const FIT = { smLo: 0.06, smHi: 0.40, smMid: 0.18, maxStep: 0.45, dSmDx: 0.55, dCgDx: -0.20, tailRake: 18.5, noseShare: 0.25, tipBack: 15, deck: 1.2, clearTail: 0.25, clearTrike: 0.22, tolX: 0.03, tolDeg: 0.4 };
function coreFn(n) {
  if (typeof W[n] === 'function') return W[n];
  try { const f = eval('typeof ' + n + ' === "function" ? ' + n + ' : null'); if (f) return f; } catch (e) {}
  return (typeof require === 'function') ? require('./flight_core.js')[n] : null;
}
function stanceFit(spec, cage) {
  const BG = coreFn('buildGen'), SHK = coreFn('genShakedown');
  if (!BG || !spec || !spec.gear) return null;
  const type = spec.gear.type;
  let def;
  try { def = BG(JSON.parse(JSON.stringify(spec))); } catch (e) { return null; }
  const out = {};
  // the FULL panel values: a saved spec's cage holds only the rows that differ from the defaults (cageToSpec), so a
  // row at its default is read off the editor's own defaults (CAGE_PARAMS + the layers' page defaults)
  const C2 = W.CAGE2 || (typeof CAGE2 !== 'undefined' ? CAGE2 : null);
  const PG = W.CAGE_PAGE || (typeof CAGE_PAGE !== 'undefined' ? CAGE_PAGE : null);
  const full = Object.assign({}, C2 && C2.cageDefaults ? C2.cageDefaults() : {}, (PG && PG.defaults) || {}, spec.cage || {}, cage || {});
  const c = k => +full[k];
  let cx = 0, cy = 0, mm = 0;
  for (const n of def.nodes) { cx += n.p[0] * n.m; cy += n.p[1] * n.m; mm += n.m; }
  cx /= mm; cy /= mm;
  // THE BALANCE (the brief: "CG in the green band"), before the legs: the wing slid fore or aft (wgDx, the row the
  // Stearman- and Archaeopteryx-alikes were balanced with by hand) until the static margin is back in the band's
  // middle. Measured once (validation A): the margin moves -0.55 per metre of wgDx (forward +) on three unlike
  // aeroplanes, the CG -0.20 m per metre with it. Only a margin outside 8-35 % is moved.
  if (SHK) {
    // the margin as drawn AND at the four loading corners (solo / full cabin x full / reserve fuel, the shakedown's
    // envelope): the wing moves every corner alike, so the band is judged on their spread - the worst corner over 6 %,
    // the most nose-heavy under 40 %, or (a spread wider than the band: a big cabin) the spread centred in it
    let lo = null, hi = null, sm0 = null;
    try {
      const sh = SHK(def, {});
      sm0 = sh.staticMargin;
      const sms = [sh.staticMargin].concat(((sh.envelope && sh.envelope.corners) || []).map(k => k.staticMargin))
        .filter(v => typeof v === 'number' && isFinite(v));
      if (sms.length) { lo = Math.min(...sms); hi = Math.max(...sms); }
    } catch (e) { lo = null; }
    if (lo != null && (lo < FIT.smLo || hi > FIT.smHi)) {
      let dSm;
      if (hi - lo > FIT.smHi - FIT.smLo - 0.04) dSm = (FIT.smLo + FIT.smHi) / 2 - (lo + hi) / 2;
      else if (lo < FIT.smLo) dSm = FIT.smLo + 0.04 - lo;
      else dSm = FIT.smHi - 0.04 - hi;
      // the aeroplane AS DRAWN stays in the band whatever the corners ask (validation A: centring a 4-bay cabin's
      // spread left the Caravan's choices 70 % nose-heavy as drawn and the full-cabin corner still unstable - that
      // spread is the cabin's, said by the design check, not a wing position)
      if (typeof sm0 === 'number' && isFinite(sm0)) dSm = Math.max(0.10 - sm0, Math.min(0.32 - sm0, dSm));
      const d = Math.max(-1.0, Math.min(1.0, -dSm / FIT.dSmDx));
      if (Math.abs(d) > 0.02) {
        out.wgDx = +((c('wgDx') || 0) + d).toFixed(2);
        cx += FIT.dCgDx * d;
      }
    }
  }
  if (type !== 'taildragger' && type !== 'tricycle') return Object.keys(out).length ? out : null;
  const Pp = def.parts, G = def.spec.gear;
  if (!Pp || !(Pp.TW >= 0)) return Object.keys(out).length ? out : null;
  const ground = G.y - (G.contactR != null ? G.contactR : G.wheelR);
  const h = Math.max(0.3, cy - ground);
  const gx = Pp.gx, twX = Pp.twX;
  const tw = def.nodes[Pp.TW];
  const dyN = (tw.p[1] - G.twR) - ground;          // the third wheel's contact over the mains' ground
  const propClear = (def.spec.engAt ? Math.min(...def.spec.engAt.map(e => e.y)) : def.spec.engY) - def.spec.propR - ground;
  // THE LEGS' RESPONSE, measured once (validation A, STATUS.md "the stance rule units"): per metre of the row,
  //   s1Z     the axle 1 m forward (a bungee V 1.04-1.06), the mains' ground line +0.062 m (taildragger) / -0.191 m
  //           (tricycle) - the keel slopes under the station
  //   s1Drop  the ground 1 m lower, the axle 0.10 m (spring blade) / 0.31 m (bungee V) / 0 (oleo) forward
  //   s2Drop  the nose wheel's contact 1 m lower, nothing else
  const leg = Math.round(c('s1Leg'));
  const J = { gz: leg === 1 ? -1.05 : -1, gd: leg === 1 ? -0.306 : leg === 0 ? -0.10 : 0,
              yz: 0 };   // (the ground's tilt under the station, +0.06 / -0.19 on the aeroplanes measured, depends on
                         // the keel there - validation A: the C172 card's deck went to 7 deg on it - so it is left to the
                         // second pass, which reads the drawn result)
  const tanR = d => Math.tan(d * Math.PI / 180);
  const target = (dz, dd) => {
    const hh = h + (-J.yz * dz) + dd;           // the CG stands higher by what the ground falls
    // a taildragger sits on its three points: the rake is judged in THAT attitude, so in the level design frame the
    // CG-to-axle line leans the three-point deck less (validation A: the level-frame fit overshot by the deck, 10-14 deg)
    if (type === 'taildragger') {
      const gN = gx + J.gz * dz + J.gd * dd;
      const deck3 = Math.atan2(dyN - J.yz * dz + dd - tailC, twX - gN) * 180 / Math.PI;
      // (never less than 5 deg in the level frame: a three-point deck past the rake would put the target behind the CG
      // - validation A's pair 3, nosed over at -40 deg)
      return cx - hh * tanR(Math.max(5, FIT.tailRake - deck3));
    }
    const share = (cx - FIT.noseShare * twX) / (1 - FIT.noseShare);
    return Math.max(share, cx + hh * tanR(FIT.tipBack));
  };
  // a taildragger's three-point deck brought into 8-15 deg (GEN_RULES.deckMin/Max) by its tailwheel leg (the castor's s2_twLegDrop lowers
  // the tailwheel's contact 1:1): aimed at 12, from the mains as they stand
  let tailC = 0;
  if (type === 'taildragger') {
    const d3 = Math.atan2(dyN, twX - gx) * 180 / Math.PI;
    if (d3 > 15 || d3 < 8) tailC = Math.max(-FIT.maxStep, Math.min(FIT.maxStep, dyN - tanR(12) * (twX - gx)));
    if (Math.abs(tailC) > 0.005) out.s2_twLegDrop = +Math.max(0.05, Math.min(0.80, c('s2_twLegDrop') + tailC)).toFixed(3);
    else tailC = 0;
  }
  const clearT = type === 'taildragger' ? FIT.clearTail : FIT.clearTrike;
  // a and b by turns (the coupling is a few per cent): the axle onto its target, then the prop clear of the ground
  let a = 0, b = 0;
  for (let it = 0; it < 4; it++) {
    a = (target(a, b) - (gx + J.gd * b)) / J.gz;
    const pcNow = propClear - J.yz * a;          // the ground's move under the new station
    b = Math.max(0, clearT - pcNow);
  }
  a = Math.max(-FIT.maxStep, Math.min(FIT.maxStep, a));   // damped: the next pass reads the drawn result again
  if (Math.abs(a) > FIT.tolX) out.s1Z = +(c('s1Z') + a).toFixed(3);
  b = Math.min(b, FIT.maxStep);
  if (b > 0.01) out.s1Drop = +(c('s1Drop') + b).toFixed(3);
  if (type === 'tricycle') {
    const gxN = gx + J.gz * a + J.gd * b;
    const dy = dyN - J.yz * a + b;               // the nose contact over the mains' new ground (the ground moves -yz)
    const deck = Math.atan2(-dy, gxN - twX) * 180 / Math.PI;
    if (Math.abs(deck - FIT.deck) > FIT.tolDeg || out.s1Z != null || out.s1Drop != null) {
      const cc = dy + tanR(FIT.deck) * (gxN - twX);   // a longer nose leg lowers the nose wheel's contact
      const ccD = Math.max(-FIT.maxStep, Math.min(FIT.maxStep, cc));
      if (Math.abs(ccD) > 0.005) out.s2Drop = +Math.max(0.10, c('s2Drop') + ccD).toFixed(3);
    }
  }
  return Object.keys(out).length ? out : null;
}

// THE AERO NOSE: the user's recipe for a nose with nothing bolted to it - "a collapse, 3 rings and a slight ease"
// (NOSE_AERO with its four rings and 0.62 ease was G2760's; the length, tip and droop are kept)
const NOSE_NP = () => Object.assign({}, D().NOSE_AERO, { cowlLoops: 3, cowlEase: 0.30 });
const NOSE_FREE = new Set(['pusher', 'wingTop', 'twin', 'four']);
// THE COWL PRESET per engine type (x architecture): _cage_cowl.js COWL_PRESETS' keys; a V on the nose of a low-wing
// fighter-ish build takes the faired V. Every value is the user's to fiddle with in the editor afterwards.
function cowlPresetFor(ch) {
  const t = ch.engType;
  let k = { flat: 'flat', inline: 'inline', vee: 'vee', radial: 'radial', electric: 'electric', turbine: 'turbine' }[t] || 'flat';
  if (t === 'vee' && ch.wing === 'low' && ch.planform === 'elliptic') k = 'faired';
  if (ch.engArch === 'pusher') k += '@pusher';
  return k;
}
// the propeller per engine type (the user: "drop the amount of blades on prop, that's not key")
function propFor(ch, model) {
  const p = model ? powerOf(model) : null;
  if (ch.engType === 'turbine') return 'carbon3';
  if (ch.engType === 'electric') return (p && p > 90000) ? 'carbon3' : 'wood2';
  if (p && p > 120000) return 'alu2';
  return 'wood2';
}
// the details nobody is asked (the brief: "no detail sliders") - each a rule over the main choices
function flapsFor(ch) {
  if (ch.mission === 'aerobatic' || ch.mission === 'glider' || ch.wing === 'biplane' || ch.class === 'ul1') return 0;
  if (ch.mission === 'bush' || ch.mission === 'cargo') return ch.class === 'ulm' ? 3 : 2;
  if (ch.class === 'n23') return 2;
  return 1;
}
function suspensionFor(ch) {
  if (ch.gear === 'floats') return 'spring';
  if (ch.class === 'n23' && (ch.mission === 'bush' || ch.mission === 'cargo' || HEAVY.has(ch.engType))) return 'oleo';
  if (ch.wing === 'biplane' || ch.wing === 'parasol') return 'bungee';
  if (ch.class === 'ul1' || ch.class === 'sail') return 'spring';
  return ch.material === 1 ? 'bungee' : 'spring';
}
function fairFor(ch) {
  if (ch.gear === 'floats' || ch.mission === 'bush' || ch.mission === 'cargo' || ch.class === 'ul1') return 0;
  if (ch.wing === 'biplane' || ch.wing === 'parasol' || ch.top === 'open') return 0;
  return 1;
}
// the dihedral by where the wing sits (a low wing needs its own; a high wing's pendulum does half the work)
const DIHEDRAL = { high: 1.5, parasol: 1.5, mid: 3, low: 5, biplane: null };
const SECTION = { box: 0, roundTop: 1, round: 3, open: 0 };
const WGPOS = { high: 0, mid: 1, low: 2, parasol: 3, biplane: 3 };

// choices -> { sel, over, meta } (pure: no table but the declaration's, no build)
function compose(chIn) {
  const { choices: ch, cleared } = complete(chIn);
  const model = modelFor(ch.class, ch.engType, ch.engArch, ch.wing === 'biplane' ? 1.3 : 1);
  const twin = /^twin/.test(ch.booms);
  const rod = ch.booms === 'rod' || ch.booms === 'twinRod' || ch.body === 'open';
  const open = ch.top === 'open';
  const sel = {
    class: ch.class, role: ch.mission,
    seatLayout: ch.seats === 'side' ? 1 : 0,
    paxCount: ch.bays,
    canopy: open ? 'screen' : ch.canopy,
    mirror: ch.top === 'turtle' ? 1 : 0,
    intCons: ch.material,
    boomStyle: rod ? 1 : 0, booms: twin ? 'twin' : 'single',
    covering: ch.body === 'open' ? 'open' : 'skin',
    section: SECTION[ch.body],
    wgPos: WGPOS[ch.wing], wgBrace: ch.bracing === 'struts' ? 0 : 1,
    planes: ch.wing === 'biplane' ? 'biplane' : 'mono',
    wingArch: ch.planform,
    wgFlapType: flapsFor(ch),
    engFamily: ch.engType,
    engMount: ch.engArch === 'pusher' ? 'pusher' : ch.engArch === 'wingTop' ? 'wingTop' : 'nose',
    engCount: { twin: 2, pushPull: 'pushPull', three: 3, four: 4 }[ch.engArch] || 1,
    gearLayout: ch.gear, suspension: suspensionFor(ch), s1Fair: fairFor(ch),
    empennage: ch.tail, finArch: ch.fin,
    scheme: 'trim',
  };
  const trim = TRIM_OF[ch.colour] != null ? TRIM_OF[ch.colour] : 0x1b3a5c;
  if (model) sel.engModel = model.name;
  sel.prop = propFor(ch, model && model.name);
  // over.cage: what the tiles cannot say, applied after them (designFull's over channel)
  const cage = {};
  // the choices the mount tiles overwrite (Pusher writes the rod, Over the wing a high wing): the user's stand
  cage.boomStyle = rod ? 1 : 0;
  cage.wgPos = WGPOS[ch.wing];
  if (DIHEDRAL[ch.wing] != null && ch.planform !== 'cranked') cage.wgDihedral = DIHEDRAL[ch.wing];
  // the aero nose, when nothing is bolted to it
  if (NOSE_FREE.has(ch.engArch)) Object.assign(cage, NOSE_NP());
  // the pusher's back cowl: on, its shape the engine type's preset (the birth build's door), its barrel the fitted
  // engine's length to the prop's cone; the block rows at 0 (FINISH-4)
  if (ch.engArch === 'pusher') Object.assign(cage, { cowlOn: 1, engBlockZ: 0, engBlockY: 0 });
  // an open cockpit: the open-tandem trainer's rows (OPEN_TANDEM), one hole or two
  if (open) {
    Object.assign(cage, D().OPEN_TANDEM, { aeroNose: 0, wgCentre: ch.wing === 'biplane' ? 3 : 0 });
    if (ch.bays === 0) Object.assign(cage, { paxCount: 0, paxOpen1: 0, pilotRear: 0 });
    if (ch.seats === 'side') cage.paxSeatZ = 0;
  }
  // the bubble: the windscreen's own continuation (the G267 single bubble's numbers; the arceau fit is always on)
  if (sel.canopy === 'bubble') Object.assign(cage, { bubH: 0.79, bubW: 1.25, canLoops: 1 });
  // the stance (STANCE, measured)
  Object.assign(cage, stanceFor(ch));
  // the colour on the body as the global paint pick writes it (every exterior section), the wing and tail with it
  const tint = { ...D().BODY_PAINT(ch.colour), wingSkin: { tint: ch.colour }, finSkin: { tint: ch.colour },
                 stabSkin: { tint: ch.colour } };
  const spec = { paint: { job: 'full', sweep: 0.35, base: ch.colour, trim },
                 finish: { sections: tint } };
  return { choices: ch, cleared, sel, over: { cage, spec }, cowlPreset: cowlPresetFor(ch),
           model: model ? model.name : null };
}

// THE ONE BAKE: the composed card through the archetypes' own recipe. Pure (no page), so the gate and the chooser
// compose the identical spec. The cowl preset rides out beside it: the chooser hands it to the cowl layer's birth door.
function bake(chIn) {
  const c = compose(chIn);
  const spec = D().designBake(c.sel, c.over);
  spec.meta = Object.assign({}, spec.meta || {}, { newPlane: c.choices });
  return Object.assign(c, { spec });
}

// THE INVERSE: an archetype's card read back as choices (the coverage table: every card must be reachable)
function fromArchetype(a) {
  const s = a.sel || {}, oc = (a.over && a.over.cage) || {};
  const engCount = s.engCount;
  const engArch = engCount === 2 ? 'twin' : engCount === 'pushPull' ? 'pushPull' : engCount === 3 ? 'three'
    : engCount === 4 ? 'four' : s.engMount === 'pusher' ? 'pusher' : s.engMount === 'wingTop' ? 'wingTop' : 'nose';
  const twin = s.booms === 'twin' || engArch === 'pushPull';
  const rod = s.boomStyle === 1 || s.engMount === 'pusher' || s.covering === 'open';
  const sec = s.section;
  const plan = oc.wgPlan === 1 ? 'elliptic' : oc.wgCrankAt > 0 ? 'hershey'
    : (oc.wgChordTip != null && oc.wgChordTip !== oc.wgChord && typeof oc.wgChordTip !== 'function') ? 'taper'
    : (typeof oc.wgChordTip === 'function' && oc.wgTipX === 0 && oc.wgCrankAt == null) ? 'taper' : 'rect';
  const openTop = oc.cpOpen === 1;
  return {
    class: s.class, mission: s.role || 'trainer', engArch, engType: s.engFamily || 'flat',
    body: s.covering === 'open' ? 'open' : sec === 3 ? 'round' : sec === 1 || sec === 2 ? 'roundTop' : 'box',
    booms: twin ? (rod ? 'twinRod' : 'twin') : rod ? 'rod' : 'lofted',
    wing: s.planes === 'biplane' ? 'biplane' : ['high', 'mid', 'low', 'parasol'][s.wgPos == null ? 0 : s.wgPos],
    planform: plan, bracing: s.planes === 'biplane' ? 'cantilever' : s.wgBrace === 0 ? 'struts' : 'cantilever',
    gear: s.gearLayout || 'tail', tail: s.empennage || 'conv', fin: s.finArch || 'straight',
    seats: s.seatLayout === 1 ? 'side' : 'single', top: openTop ? 'open' : s.mirror === 1 ? 'turtle' : 'cabin',
    bays: openTop ? (oc.paxCount != null ? oc.paxCount : 1) : (s.paxCount != null ? s.paxCount : 0),
    canopy: s.canopy === 'bubble' ? 'bubble' : 'screen',
    material: s.intCons != null ? s.intCons : 1, colour: s.base != null ? s.base : 0xefe6cf,
  };
}
// an archetype is AUTHORED when the card is a stock design (over.stock) or carries a hand-fitted tail (finHeight /
// stSpan in its cage, the reference-matched cards) or is blocked (WIP); otherwise it is the generator's
function authored(a) {
  const oc = (a.over && a.over.cage) || {};
  return !!(a.over && a.over.stock) || oc.finHeight != null || oc.stSpan != null || !!a.blocked;
}

// a seeded random choice set (the gate's random builds and the chooser's "surprise me"): every row a random OFFERED
// option, in step order, so greys always hold
function randomChoices(seed) {
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const ch = {};
  for (const k of ROW_KEYS) {
    const live = optsOf(k).filter(o => !why(ch, k, o.value));
    if (live.length) ch[k] = live[Math.floor(rnd() * live.length)].value;
  }
  return ch;
}

const FIT_PASSES = 3;   // at most three corrective loads after the birth's (each re-reads the drawn aeroplane)
const API = { stanceFit, FIT, FIT_PASSES, STEPS, ROW_KEYS, RULES, STANCE, WING_KEYS: () => Object.keys(D().WING_ARCH), optsOf, why, defaultFor, complete,
              compose, bake, fromArchetype, authored, randomChoices, modelFor, cowlPresetFor, propFor, NOSE_NP, MAX_BAYS,
              SWATCHES };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.NEW_PLANE_GEN = API;
})();
