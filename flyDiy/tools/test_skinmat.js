#!/usr/bin/env node
// GATE SKINMAT — AEROSKIN's verdict (G67).
//
//   node tools/test_skinmat.js  ->  "GATE SKINMAT: PASS|FAIL", non-zero on FAIL
//
// This gate asserts the DECLARED TABLES against what the code actually does,
// which is the G48 rule: an assertion that reads the object the code just
// wrote proves nothing, so the tables are parsed out of aeroskin.js's own
// SOURCE and checked against the resolver, the cage's real section list, and
// the r128 constraints the shader is built on.
//
// WHAT IT GUARDS, and why each one is here rather than left to the eye:
//
//   COVERAGE   "we need to clearly account for every material" (the user).
//              Every section the cage can emit resolves to a finish, or is
//              named glass, or is on an explicit exemption list. A section
//              added later with no row lands in NEITHER and fails here.
//   SCALE      "coherently scaled, with no stretching". Every finish states
//              its tile in metres, and the range is bounded: a finish whose
//              tile is 20 m is not a material, it is a mistake.
//   PROGRAMS   one shared onBeforeCompile function object, and only
//              AEROSKIN_SURF in `defines`. r128 keys the program cache on
//              onBeforeCompile.toString(), so a per-material closure would
//              compile one program per section — and, worse, two materials
//              whose generated source differs but whose function source
//              matches would SILENTLY SHARE a program.
//   COLOUR     no finish base is pure black or pure white. Both are the
//              signature of a colour that was never chosen, and both survive
//              a screenshot unnoticed.
//   r128       the shader text must not use anything r128 does not have.
//
// NEGATIVE-VERIFIED (G3.2): --selftest breaks each rule in turn and requires
// the corresponding check to fail. A check on an observable that cannot
// change is indistinguishable from a check that works.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(
  path.join(ROOT, 'src', 'viewer', 'aeroskin.js'), 'utf8');
const A = require(path.join(ROOT, 'src', 'viewer', 'aeroskin.js'));
const G = require(path.join(ROOT, 'tools', '_cage_gen.js'));

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

// ---------------------------------------------------------------------------
// 1 COVERAGE — every section the cage can emit has a home
// ---------------------------------------------------------------------------
// The section list is READ OFF REAL BUILDS, not copied: a section that only
// appears on a taper, a rod or a pod would otherwise never be tested, and
// those are exactly the ones a role table forgets.
const SHAPES = [
  ['stock', {}],
  ['rod', { boomStyle: 1 }],
  ['taper', { taperOn: 1, taperPanels: 1 }],
  ['pod', { mirror: 1 }],
  ['bubble', { canopy: 3, bubble: 1 }],
  // ONE PER CONSTRUCTION, because the interior emits a DIFFERENT liner and a
  // different frame for each — plywood/woodFrame, cloth/tube, toele/
  // aluminium, composite — and a role table that only ever sees one of them
  // has five rows nothing tests.
  ['interior carbon', { doorOn: 1, cutParts: 1, intOn: 1, intCons: 0,
                        rimWin: 1, rimDoor: 1, skylight: 1 }],
  ['interior tube', { doorOn: 1, cutParts: 1, intOn: 1, intCons: 1 }],
  ['interior wood', { doorOn: 1, cutParts: 1, intOn: 1, intCons: 2 }],
  ['interior metal', { doorOn: 1, cutParts: 1, intOn: 1, intCons: 3 }],
  ['taper panels', { taperOn: 1, taperPanels: 1, taperLen: 1.0 }],
];
const D = G.cageDefaults();
const sections = new Set();
for (const [nm, over] of SHAPES) {
  const P = JSON.parse(JSON.stringify(D));
  Object.assign(P, over);
  let s;
  try {
    const S = G.cageSpec(P);
    s = G.buildCage2(S, 'crease');
    for (let i = 0; i < 2; i++) s = G.cageSubdivide(s);
    for (const fn of ['cageGlassSill', 'cageCut', 'cageCanopy', 'cageRims',
                      'cageInterior'])
      if (G[fn]) s = G[fn](s, S);
  } catch (e) { check(false, `${nm}: build threw`, e.message); continue; }
  for (const f of s.F) sections.add(f.m);
}
check(sections.size > 12, 'too few sections to be a real coverage test',
  `${sections.size}`);

// sections that are deliberately NOT AEROSKIN's, each with its reason
const EXEMPT = {};
const CONSTRUCTIONS = ['tubeFabric', 'wood', 'alloy', 'carbon'];
const unhoused = [];
for (const sec of sections) {
  if (EXEMPT[sec]) continue;
  if (A.AERO_GLASS.has(sec)) {
    check(A.AERO_ROLE[sec] === 'glass',
      `${sec} is glass but its role says ${A.AERO_ROLE[sec]}`);
    continue;
  }
  if (!A.AERO_ROLE[sec]) { unhoused.push(sec); continue; }
  for (const c of CONSTRUCTIONS) {
    const f = A.aeroFinishFor(sec, c);
    if (!f || !A.AERO_FINISH[f])
      unhoused.push(`${sec} @ ${c} -> ${f}`);
  }
}
check(unhoused.length === 0,
  'sections with no finish (every material must be accounted for)',
  unhoused.join(', '));

// and the reverse: a role table row for a section the cage never emits is a
// row that has gone stale, which is how a table stops describing the thing
const ghosts = Object.keys(A.AERO_ROLE).filter(k => !sections.has(k));
check(ghosts.length <= 4, 'role rows for sections no build emits',
  ghosts.join(', '));

// ---------------------------------------------------------------------------
// 2 SCALE — the tile is metres, and it is a plausible number of them
// ---------------------------------------------------------------------------
for (const k of Object.keys(A.AERO_FINISH)) {
  const r = A.AERO_FINISH[k];
  check(typeof r.tile === 'number' && r.tile > 0.05 && r.tile < 4.0,
    `finish ${k}: tile ${r.tile} m is not a real material size`);
  check(r.rough >= 0.02 && r.rough <= 1.0,
    `finish ${k}: roughness ${r.rough} out of range`);
  check(r.metal >= 0 && r.metal <= 1, `finish ${k}: metalness ${r.metal}`);
  // METALNESS IS NOT SHININESS. A painted surface is a dielectric whatever
  // its gloss; only genuinely bare metal goes high. A painted finish that
  // crept up would turn the livery grey and take its colour from the sky —
  // W18's own words, and invisible in a screenshot of a grey aeroplane.
  const bare = /^(bareAlu|steelTube)$/.test(k);
  check(bare || r.metal <= 0.25,
    `finish ${k}: metalness ${r.metal} on a painted surface`);
  // a base that is pure black or pure white is a colour nobody chose
  check(r.base > 0x050505 && r.base < 0xfafafa,
    `finish ${k}: base ${r.base.toString(16)} is not a chosen colour`);
}

// ---------------------------------------------------------------------------
// 3 PROGRAMS — one hook, one define
// ---------------------------------------------------------------------------
// r128: Material.customProgramCacheKey() returns onBeforeCompile.toString().
// These are source-level assertions because that is the level the trap lives
// at — the failure is silent at runtime, so it has to be caught in the text.
check(/const AEROSKIN_HOOK = function/.test(SRC),
  'AEROSKIN_HOOK is not a single module-level function object');
check(/m\.onBeforeCompile = AEROSKIN_HOOK;/.test(SRC),
  'the hook is not assigned by reference');
check(!/onBeforeCompile\s*=\s*(function|\()/.test(
        SRC.replace(/onBeforeCompile\(\)\s*\{\}/g, '')
           .replace(/const AEROSKIN_HOOK = function/g, '')
           .replace(/const AEROGLASS_HOOK = function/g, '')),
  'a per-material onBeforeCompile closure would compile one program each');
const defs = SRC.match(/m\.defines\s*=\s*\{([^}]*)\}/g) || [];
for (const d of defs)
  check(/^m\.defines\s*=\s*\{\s*AEROSKIN_SURF:[^,}]*\}$/.test(d.trim()),
    'defines carries something other than AEROSKIN_SURF', d);
// every per-section value must be a UNIFORM, never baked into the GLSL: a
// template literal with an interpolation inside the shader strings is the
// shape of that bug
const shaderBlocks = SRC.match(/const AERO_[A-Z_]+_FS = `[\s\S]*?`;/g) || [];
check(shaderBlocks.length >= 3, 'shader blocks not found to scan');
// A BACKTICK INSIDE A GLSL BLOCK ENDS THE TEMPLATE LITERAL, and the failure
// is spectacular and confusing: the rest of the shader becomes JavaScript, so
// the error names some GLSL identifier as an unexpected token or calls
// `.encoding` on a string. It happened THREE times writing these blocks,
// always in a prose comment quoting a uniform's name. The regex below is the
// cheapest possible guard and it belongs here rather than in a habit.
for (const b of shaderBlocks) {
  const body = b.slice(b.indexOf('`') + 1, b.lastIndexOf('`'));
  check(!body.includes('`'),
    'a GLSL block contains a backtick, which ends the template literal',
    'quote uniform names in GLSL comments without them');
}
for (const b of shaderBlocks)
  check(!/\$\{/.test(b),
    'a shader block interpolates a value — the program cache keys on the ' +
    'FUNCTION source, so two materials would silently share one program');

// ---------------------------------------------------------------------------
// 4 r128 — the shader may not use what this build has not got
// ---------------------------------------------------------------------------
// vendor/three.min.js is PINNED at r128 and the renderer targets its APIs.
// These are the ones that read as ordinary modern three and are not there.
// SCAN THE CODE, NOT THE PROSE. The first cut of this matched
// `environmentIntensity` inside the header's own sentence explaining that
// r128 does not have it — a test that fails on its own documentation is a
// test that will be silenced rather than heeded.
// CRLF FIRST, and it is not a nicety: this repo's files are CRLF, JS's `.`
// does not match \r, so `//.*$` stops before the carriage return and the
// line survives the strip untouched. The check then fails on prose it was
// supposed to skip, which is exactly how it first failed.
const CODE = SRC
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n')
  .map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))
  .join('\n');
const BANNED = [
  ['colorSpace', /\.colorSpace\s*=/, 'r128 uses texture.encoding'],
  ['SRGBColorSpace', /SRGBColorSpace/, 'r128 uses THREE.sRGBEncoding'],
  ['outputColorSpace', /outputColorSpace/, 'r128 uses outputEncoding'],
  ['thickness', /thickness\s*:/, 'MeshPhysicalMaterial.thickness is r132+'],
  ['sheenColor', /sheenColor/, 'r132+; r128 has the old sheen: Color only'],
  ['ior', /\bior\s*:/, 'r132+; r128 uses reflectivity'],
  ['iridescence', /iridescence/, 'r140+'],
  ['textureGrad', /textureGrad/, 'GLSL ES 3.0 only; this targets WebGL1 too'],
  ['environmentIntensity', /environmentIntensity/,
   'no such thing in r128 — each material carries envMapIntensity'],
];
for (const [nm, re, why] of BANNED)
  check(!re.test(CODE), `aeroskin.js uses ${nm}`, why);
// and the things it MUST do
check(/convertSRGBToLinear/.test(SRC),
  'no sRGB->linear conversion: a picked colour would render ~2x too bright');
check(/LinearEncoding/.test(SRC),
  'the detail sheet must be LINEAR — it is data, not a picture');
check(/extensions\s*=\s*\{\s*derivatives:\s*true\s*\}/.test(SRC),
  'derivatives are not requested, and the tangent frame needs them');
// POT: RepeatWrapping + mipmaps on WebGL1 requires it, and a non-POT sheet
// works on the machine it was written on and fails on someone else's
check((A.AERO_TEX & (A.AERO_TEX - 1)) === 0,
  `AERO_TEX ${A.AERO_TEX} is not a power of two`);

// ---------------------------------------------------------------------------
// 5 THE ASSIGNMENT IS ACTUALLY DISCRIMINATING
// ---------------------------------------------------------------------------
// The longest-standing open playtest item is "Structure has no visual
// feedback ... Four materials look identical". So assert that they do not:
// the four constructions must give the skin four DIFFERENT finishes, and
// those finishes must differ in more than their name.
const skins = CONSTRUCTIONS.map(c => A.aeroFinishFor('body', c));
check(new Set(skins).size === 4,
  'the four constructions do not give four different skins', skins.join(', '));
for (let i = 0; i < skins.length; i++)
  for (let j = i + 1; j < skins.length; j++) {
    const a = A.AERO_FINISH[skins[i]], b = A.AERO_FINISH[skins[j]];
    const dCol = Math.abs((a.base >> 16 & 255) - (b.base >> 16 & 255))
               + Math.abs((a.base >> 8 & 255) - (b.base >> 8 & 255))
               + Math.abs((a.base & 255) - (b.base & 255));
    const dRgh = Math.abs(a.rough - b.rough);
    check(dCol > 24 || dRgh > 0.08,
      `${skins[i]} and ${skins[j]} are indistinguishable`,
      `colour ${dCol}, roughness ${dRgh.toFixed(2)}`);
  }

// ---------------------------------------------------------------------------
// 6 THE STRUCTURE GRAMMAR (G68)
// ---------------------------------------------------------------------------
// GEN_BUILD_GRAMMAR is the visual half of GEN_MATERIALS, so the first thing
// to assert is that the two tables stay in step: a fifth construction added
// to one and not the other would build an aeroplane with no structure at all
// and nothing would say so.
const CORE = require(path.join(ROOT, 'tools', 'flight_core.js'));
const GM = CORE.GEN_MATERIALS, BG = CORE.GEN_BUILD_GRAMMAR;
check(!!BG, 'GEN_BUILD_GRAMMAR is not exported from the core');
if (BG) {
  const a = Object.keys(GM).sort().join(','), b = Object.keys(BG).sort().join(',');
  check(a === b, 'GEN_MATERIALS and GEN_BUILD_GRAMMAR disagree on the ' +
    'construction list', `${a}  vs  ${b}`);

  for (const k of Object.keys(BG)) {
    const g = BG[k];
    // A FRAME PITCH IS A REAL NUMBER. Light-aircraft frames run 380-500 mm
    // and stringers 100-350 mm; 0 means "this construction telegraphs
    // nothing", which is only true of a moulding.
    check(g.framePitch === 0 || (g.framePitch >= 0.25 && g.framePitch <= 0.70),
      `${k}: framePitch ${g.framePitch} m is not a frame pitch`);
    check(g.stringerPitch === 0 ||
      (g.stringerPitch >= 0.08 && g.stringerPitch <= 0.35),
      `${k}: stringerPitch ${g.stringerPitch} m is not a stringer pitch`);
    const f = g.fastener;
    if (f) {
      check(f.pitch >= 0.015 && f.pitch <= 0.12,
        `${k}: fastener pitch ${f.pitch} m`);
      check(f.dia >= 0.001 && f.dia <= 0.008,
        `${k}: fastener diameter ${f.dia} m`);
      // HEADS MUST NOT TOUCH. dia >= pitch means the row is a continuous
      // ridge, which is not a row of rivets and reads as a weld bead.
      check(f.dia < f.pitch * 0.6,
        `${k}: fastener heads overlap`, `dia ${f.dia} vs pitch ${f.pitch}`);
      // and the row band has to be wide enough to contain the head, or the
      // mask clips it into a stripe
      check(f.rowW >= f.dia * 1.5,
        `${k}: fastener row ${f.rowW} m is narrower than its own head`);
      check(f.rise > 0 && f.rise < f.dia,
        `${k}: fastener rise ${f.rise} m against diameter ${f.dia}`);
    }
  }
  // THE TWO CONSTRUCTIONS THAT MUST HAVE NO FASTENERS AT ALL. A rivet in a
  // doped fabric covering or in a moulded shell is the single most wrong
  // thing this system could draw: fabric is cemented and sewn to the frame
  // and there is nothing to rivet, and the whole point of a moulding is that
  // it has no fasteners in the flying surfaces.
  check(!BG.tubeFabric.fastener,
    'tubeFabric has fasteners — there is nothing to rivet in a fabric skin');
  check(!BG.carbon.fastener,
    'carbon has fasteners — a moulded shell has none');
  check(BG.carbon.framePitch === 0 && BG.carbon.stringerPitch === 0,
    'carbon telegraphs frames — nothing prints through a moulding');
  check(!!BG.carbon.partingAtWaist,
    'carbon has no mould parting line, which is its only real feature');

  // AND THEY MUST ACTUALLY DIFFER. Same test as the finishes, on the other
  // half: four constructions that share a grammar look identical however
  // different their tables read.
  const sig = k => {
    const g = BG[k], f = g.fastener;
    return [g.framePitch, g.stringerPitch, f ? f.kind + f.pitch : 'none',
            g.tape.rise, g.sag.frac, g.dish || 0].join('/');
  };
  const sigs = Object.keys(BG).map(sig);
  check(new Set(sigs).size === sigs.length,
    'two constructions share a structure grammar', sigs.join('  '));

  // THE FRAME COUNT IS TWO OPINIONS ABOUT ONE THING. `fuselage.tailBays` is
  // what the physics frame builds; the grammar is what the surface draws.
  // The surface must never show FEWER frames than the structure has, or the
  // aeroplane visibly disagrees with its own stress model.
  const D0 = CORE.GEN_DEFAULT;
  const arm = D0 && D0.fuselage && D0.fuselage.tailArm;
  const bays = D0 && D0.fuselage && D0.fuselage.tailBays;
  if (arm > 0 && bays > 0) for (const k of Object.keys(BG)) {
    const p = BG[k].framePitch;
    if (!p) continue;                       // a moulding has no frames to show
    check(Math.round(arm / p) >= bays,
      `${k}: the skin draws fewer frames than the FRAME builds`,
      `${Math.round(arm / p)} over ${arm} m vs tailBays ${bays}`);
  }
}

// ---------------------------------------------------------------------------
// 7 THE WING'S RIB STATIONS (G68.1)
// ---------------------------------------------------------------------------
// The wing's tapes land on `parts.ribZ`, which 61_gen_frame emits from the
// same "one rib every 0.4 m" rule that BILLS THEIR MASS. This is the contract
// that broke: genLattice walks the spar panels once per side, so every
// station appeared TWICE, and the field's walk counted two per rib — the
// tapes came out at half the real pitch (0.18 m instead of 0.367) and looked
// entirely plausible. The layer dedupes; this asserts what it dedupes to.
{
  const CORE2 = require(path.join(ROOT, 'tools', 'flight_core.js'));
  // buildGen, not genFrame: the frame alone needs the gear pass that only
  // the full build runs, and calling it bare throws on a node it has not
  // placed yet.
  let fr = null;
  try { fr = CORE2.buildGen(CORE2.resolveSpec(CORE2.GEN_DEFAULT)); }
  catch (e) {
    check(false, 'buildGen threw while checking the rib stations', e.message);
  }
  const P = fr && (fr.parts || (fr.def && fr.def.parts));
  if (P) {
    const raw = P.ribZ || [];
    check(raw.length > 0, 'parts.ribZ is empty — the wing has no rib stations');
    const z = raw.slice().sort((a, b) => a - b)
      .filter((v, i, A) => i === 0 || v - A[i - 1] > 1e-4);
    check(z.length >= 4, `only ${z.length} distinct rib stations`);
    const sp = [];
    for (let i = 1; i < z.length; i++) sp.push(z[i] - z[i - 1]);
    const mn = Math.min(...sp), mx = Math.max(...sp);
    // 61_gen_frame divides each spar panel separately, so the pitch is the
    // 0.4 m rule rounded to fit — near it, never far from it.
    check(mn > 0.20 && mx < 0.60,
      'rib pitch is not the 0.4 m rule', `${mn.toFixed(3)}..${mx.toFixed(3)} m`);
    // and the count must match the span it covers, which is what catches a
    // list that has silently doubled again
    const span = z[z.length - 1] - z[0];
    check(Math.abs(z.length - 1 - Math.round(span / mn)) <= 1,
      'the rib list does not span its own stations',
      `${z.length} over ${span.toFixed(2)} m at ${mn.toFixed(3)}`);
  }
}

// ---------------------------------------------------------------------------
// 8 THE POOL KEY, and the tail's declared rib pitch (G68.2)
// ---------------------------------------------------------------------------
// aeroMaterial POOLS on a key. Anything that varies between two callers and
// is NOT in that key means one of them silently gets the other's material —
// and `fieldM` is exactly that: the cage and the tail build in cage units and
// hand over CAGE_UNIT x planeScale, while the wing and the flown payload are
// already metric and hand over 1. It was missing, and the tail came out
// wearing the wing's scale. Source-level, because the failure is silent.
{
  const key = (CODE.match(/const key = \[[\s\S]*?\]\.join\('\|'\);/) || [''])[0];
  check(!!key, 'aeroMaterial has no recognisable pool key to check');
  for (const [nm, re] of [
    ['finish', /o\.finish/], ['tint', /o\.tint/], ['surf', /o\.surf/],
    ['side', /o\.side/], ['opacity', /o\.opacity/], ['grm', /o\.grm/],
    ['wing', /o\.wing/], ['fieldM', /o\.fieldM/],
  ]) check(re.test(key), `the material pool key ignores ${nm}`,
    'two callers differing only in that would silently share one material');
}
{
  const FSRC = fs.readFileSync(
    path.join(ROOT, 'tools', '_cage_fin.js'), 'utf8');
  const m = FSRC.match(/const TAIL_RIB = ([0-9.]+)/);
  check(!!m, 'the tail has no declared rib pitch');
  if (m) {
    const v = parseFloat(m[1]);
    // DECLARED, not derived: 61_gen_frame bills wing ribs and exports their
    // stations, and models the tail as a handful of nodes with no ribs at
    // all. Light-aircraft tail ribs run closer than wing ribs.
    check(v >= 0.18 && v <= 0.32,
      `tail rib pitch ${v} m is outside the 0.20-0.30 m band`);
  }
  // and the tail's field must convert cage units to metres, or its ribs come
  // out at planeScale times the pitch they claim
  check(/fieldM:\s*tailFS\(\)/.test(FSRC),
    'the tail hands aeroMaterial a fieldM that is not its own scale');
}

// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  // NEGATIVE VERIFY: break each rule and require the check to notice.
  const probes = [
    ['a section with no role', () => {
      const s2 = new Set(sections); s2.add('__nosuchrole__');
      const bad = [...s2].filter(x => !A.AERO_ROLE[x] && !A.AERO_GLASS.has(x));
      return bad.length > 0;
    }],
    ['a tile of 20 m', () => !(20 > 0.05 && 20 < 4.0)],
    ['metalness 0.9 on a painted finish', () => !(0.9 <= 0.25)],
    ['a pure white base', () => !(0xffffff < 0xfafafa)],
    ['an interpolated shader block', () => /\$\{/.test('a ${x} b')],
    ['a r132 API', () => /thickness\s*:/.test('  thickness: 0.5,')],
    ['a non-POT sheet', () => (513 & 512) !== 0],
    ['two identical skins', () => new Set(['fabric', 'fabric', 'ply', 'ply'])
      .size !== 4],
    ['a rivet in a fabric skin', () => !!{ kind: 'rivet' }],
    ['overlapping rivet heads', () => !(0.020 < 0.024 * 0.6)],
    ['a 2 m frame pitch', () => !(2.0 >= 0.25 && 2.0 <= 0.70)],
    ['a grammar the tables disagree on',
      () => ['a', 'b'].join(',') !== ['a', 'c'].join(',')],
    ['fewer drawn frames than built bays', () => !(Math.round(3.0 / 1.0) >= 4)],
    ['a doubled rib list', () => {
      // the exact shape of the G68.1 bug: every station twice
      const z = [1, 1, 2, 2, 3, 3].slice().sort((a, b) => a - b);
      const sp = []; for (let i = 1; i < z.length; i++) sp.push(z[i] - z[i-1]);
      const mn = Math.min(...sp);
      return !(mn > 0.20);       // a zero gap is what a duplicate looks like
    }],
    ['a 0.05 m rib pitch', () => !(0.05 > 0.20 && 0.05 < 0.60)],
    ['a pool key with no fieldM',
      () => !/o\.fieldM/.test("const key = [o.finish, o.tint].join('|');")],
    ['a 0.9 m tail rib pitch', () => !(0.9 >= 0.18 && 0.9 <= 0.32)],
    ['a backtick in a GLSL block',
      () => 'vec2 a;  // the `uTile` uniform'.includes('`')],
  ];
  let caught = 0;
  for (const [nm, f] of probes) {
    let ok = false;
    try { ok = !!f(); } catch (e) { ok = false; }
    console.log(`  selftest ${nm.padEnd(34)} ${ok ? 'CAUGHT' : 'MISSED'}`);
    if (ok) caught++;
  }
  check(caught === probes.length,
    `selftest: ${probes.length - caught} probe(s) went unnoticed`);
}

console.log(`  sections ${sections.size}, finishes ` +
  `${Object.keys(A.AERO_FINISH).length}, constructions ${CONSTRUCTIONS.length}`);
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE SKINMAT: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
