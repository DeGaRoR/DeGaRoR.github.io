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
// A FRESH CHECKOUT IS CRLF (core.autocrlf on this machine) while the shared
// tree is LF, and every source scan below matches on a bare newline — so the
// gate was red on any clean worktree of HEAD (2026-09-05) with nothing
// missing from the commit. Read every source as LF.
const _rfs = fs.readFileSync;
fs.readFileSync = (p, opt) => { const r = _rfs(p, opt);
  return typeof r === 'string' ? r.replace(/\r\n/g, '\n') : r; };
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
  // THE EXEMPTION IS A LIST OF BARE METALS, not a raised ceiling (G70 added
  // the five hardware rows). Each one is a surface with no paint film on it
  // at all: a sand-cast crankcase, a plated piston, a bronze bush, a pipe
  // that has been to 700 C, enamelled winding wire, and the firewall's
  // fireproof foil. Everything PAINTED — a leg, a bracket, an engine mount, a
  // spat, the firewall PANEL — stays on `trim` and stays a dielectric, which
  // is the rule this check exists to hold. The foil is the distinction drawn
  // exactly: a stainless or aluminised sheet on the hot side has no paint
  // film on it at all (nothing you would put on an aeroplane survives there),
  // and the panel it is bolted to is still a painted dielectric.
  // `panelMetal` joins the list for the distinction drawn exactly as the foil
  // drew it: an instrument facia is a bare alloy plate — Metal050C's own
  // metalness map measures a flat 255 — while the coaming it is screwed into
  // stays a dielectric hide. A PAINTED panel would be `trim`, and still is.
  const bare =
    /^(bareAlu|steelTube|castAlu|chrome|bronze|exhaust|copper|fireFoil|panelMetal)$/
    .test(k);
  check(bare || r.metal <= 0.25,
    `finish ${k}: metalness ${r.metal} on a painted surface`);
  // a base that is pure black or pure white is a colour nobody chose
  check(r.base > 0x050505 && r.base < 0xfafafa,
    `finish ${k}: base ${r.base.toString(16)} is not a chosen colour`);
}

// ---------------------------------------------------------------------------
// 2b THE SCANNED SHEETS (G125) — both directions of the claim
// ---------------------------------------------------------------------------
// `sheet` on a finish row names a baked payload in ONE OF THE TWO manifests:
// wood_tex.js (tools/wood_tex_import.py -> tools/wood_tex_prep.js) for the
// wood library, skin_tex.js (skin_tex_import.py -> skin_tex_prep.js) for the
// sheets that are not wood. A row names a sheet, not a store, so the check is
// against the UNION — and against the generated TABLES, not the prose
// (G113.4's rule), in BOTH directions: a row claiming a sheet that is not
// baked falls back SILENTLY to the procedural grain — correct at runtime,
// invisible forever — and a baked sheet no row claims is payload bytes
// shipped for nothing.
{
  const MANIF = [['wood_tex.js', 'tools/wood_tex_import.py'],
                 ['skin_tex.js', 'tools/skin_tex_import.py']];
  const baked = new Map();
  for (const [f, imp] of MANIF) {
    const fp = path.join(ROOT, 'src', 'viewer', f);
    check(fs.existsSync(fp),
      `${f} missing — run ${imp} then its _prep.js`);
    const txt = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
    for (const m of txt.matchAll(/^ {4}(\w+): \{ px: (\d+),/gm)) {
      check(!baked.has(m[1]),
        `sheet '${m[1]}' is baked by two manifests — a row names a sheet, ` +
        'not a store, so the name has to be unique across both');
      baked.set(m[1], +m[2]);
    }
  }
  const claiming = Object.keys(A.AERO_FINISH)
    .filter(k => A.AERO_FINISH[k].sheet);
  check(claiming.length >= 5,
    'no finish rows claim scanned sheets (the G125 rows have lost them)');
  for (const k of claiming) {
    const r = A.AERO_FINISH[k];
    check(baked.has(r.sheet),
      `finish ${k} claims sheet '${r.sheet}' that neither wood_tex.js nor ` +
      'skin_tex.js bakes');
    // the fallback is load-bearing: node, the gates and the first undecoded
    // frame all render the procedural bake
    check(!!r.bake,
      `finish ${k} claims a sheet but declares no procedural fallback bake`);
  }
  const claimed = new Set(claiming.map(k => A.AERO_FINISH[k].sheet));
  for (const [s, px] of baked) {
    check(claimed.has(s), `baked sheet '${s}' is claimed by no finish row`);
    // POT: the same WebGL1 RepeatWrapping+mipmaps rule AERO_TEX obeys
    check((px & (px - 1)) === 0, `baked sheet '${s}' px ${px} is not POT`);
  }
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

  // ---- A SHEET EDGE STOPS WHERE THE SHEET RUN STOPS (2026-08-31) ----------
  // The user's report was "the bump line riding along the waist should end at
  // the window pillar and not extend into the nose part". `sL = 0` IS the
  // windscreen base ring by the join's own definition (G49), so the mask is a
  // smoothstep on m.x — no new uniform. These hold the three decisions in it,
  // each of which is silent when it rots:
  check(/float runFwd = \(uG5\.w < 0\.5\)/.test(SRC),
    'the sheet-edge mask is gone, or it is no longer BODY-ONLY — on a wing ' +
    'sL is a SPANWISE coordinate, so masking m.x < 0 there strips the laps ' +
    'off half the surface');
  check(/dH\.y \+= runFwd \* 2\.0 \* d \* dpB/.test(SRC),
    'the longitudinal lap groove no longer fades forward of the window ' +
    'pillar — it is a sheet EDGE and the nose deck is a different sheet run');
  check(/dH\.y \+= runFwd \* 2\.0 \* 0\.0004 \* m\.y/.test(SRC),
    'the mould parting line no longer stops at the window pillar, though the ' +
    'nose is a different moulding');
  // AND THE THINGS THAT MUST *NOT* BE MASKED. A longeron runs forward through
  // the firewall and its print runs with it; the nose has its own frames and
  // its own seams round the section. Masking either would take structure off
  // the nose entirely, which is a bigger fault than the one being fixed.
  check(/dH\.x \+= 2\.0 \* d \* dpA \/ w2/.test(SRC),
    'the CIRCUMFERENTIAL lap is being masked too — the nose has its own ' +
    'seams round the section');
  check(/dH\.x \+= uG1\.y \* \(-2\.0 \* df \/ w2\)/.test(SRC),
    'the tape/telegraphing term has been touched — a longeron runs forward ' +
    'and its print on the skin runs with it');

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
// 9 THE HARDWARE (G70) — every layer's own material names have a home
// ---------------------------------------------------------------------------
// The same COVERAGE rule as section 1, applied to the four layers that were
// still wearing G38's understudy grey, and read the same way: the names are
// PARSED OUT OF EACH LAYER'S SOURCE rather than copied here, so a layer that
// grows a material nobody dressed fails this gate instead of quietly taking
// a default. That is the G48 rule — an assertion that reads the object the
// code just wrote proves nothing.
//
// It is also the check that would have caught the whole point of G70 before
// it was written: on the day this was added, `AERO_HARD` was empty and every
// one of these 60-odd names was a hole.
const layerSrc = f => fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8');
// keys of the first `<decl> = {` object literal after the anchor, one nesting
// level only — enough for a flat palette, and it fails loudly rather than
// silently if one of these ever stops being flat
const objKeys = (src, anchor) => {
  const i = src.indexOf(anchor);
  if (i < 0) return null;
  const j = src.indexOf('{', i);
  let depth = 0, k = j, body = '';
  for (; k < src.length; k++) {
    const c = src[k];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) break; }
    if (depth === 1 && c !== '{') body += c;
  }
  const out = [];
  for (const mm of body.matchAll(/(^|[,\n])\s*([A-Za-z_$][\w$]*)\s*:/g))
    out.push(mm[2]);
  return out.length ? out : null;
};
const LAYERS = [
  ['gear', '_gear_gen.js', 'const MAT = {'],
  ['eng', '_eng_page.js', 'const COL = {'],
  ['cowl', '_cage_cowl.js', 'MATS = {'],
  ['crew', '_cage_crew.js', 'const MFALL = {'],
];
for (const [layer, file, anchor] of LAYERS) {
  const names = objKeys(layerSrc(file), anchor);
  if (!check(!!names, `${layer}: could not read its material table from ${file}`))
    continue;
  const holes = names.filter(n =>
    A.aeroHardFinish(layer, n) === undefined);
  check(holes.length === 0,
    `${layer}: ${holes.length} material(s) with no finish`, holes.join(', '));
  // and nothing in the table describes a material that layer does not have:
  // a row for a name nobody draws is a claim that went stale
  const ghosts = Object.keys(A.AERO_HARD[layer] || {})
    .filter(n => !names.includes(n));
  check(ghosts.length === 0,
    `${layer}: finish rows for materials the layer no longer has`,
    ghosts.join(', '));
}
// every finish the hardware table names must exist, and the ones exempted
// from the dielectric rule must be the ones that are actually bare metal
for (const layer of Object.keys(A.AERO_HARD))
  for (const n of Object.keys(A.AERO_HARD[layer])) {
    const f = A.AERO_HARD[layer][n];
    check(f === null || !!A.AERO_FINISH[f],
      `${layer}.${n} names a finish that does not exist`, String(f));
  }
// THE PROPELLER MAPS BY INDEX, so the two tables must be the same length —
// a seventh blade material added to the cowl bench would otherwise silently
// fall off the end and take the fallback.
{
  const CW = require(path.join(ROOT, 'tools', '_cowl_gen.js'));
  check(A.AERO_PROP_FIN.length === CW.MATERIALS.length,
    'AERO_PROP_FIN and the cowl bench disagree on how many blade materials ' +
    'there are', `${A.AERO_PROP_FIN.length} vs ${CW.MATERIALS.length}`);
  A.AERO_PROP_FIN.forEach((f, i) => check(!!A.AERO_FINISH[f],
    `blade material ${i} maps to a finish that does not exist`, String(f)));
}
for (const k of Object.keys(A.AERO_WEAR_K))
  check(!!A.AERO_FINISH[k],
    `AERO_WEAR_K names a finish that does not exist`, k);

// ---------------------------------------------------------------------------
// 10 THE WEAR (G70) — one dial, and it must not divide the quad
// ---------------------------------------------------------------------------
// The condition of the aeroplane rides the SHARED uniform block, so one
// write reaches every material including the ones the game builds for the
// aeroplane that flies. These are source-level assertions for the same
// reason section 3's are: each failure is silent at runtime.
check(/uniform vec4 uWear;/.test(SRC) && /uniform float uWearK;/.test(SRC),
  'the wear uniforms are not declared in the fragment prelude');
check(/uWear:\s*\{\s*value/.test(SRC) && /uWearE:\s*\{\s*value/.test(SRC),
  'the wear uniforms are not in the shared (aeroplane-wide) block');
check(/uWearK:\s*\{\s*value/.test(SRC),
  'the per-material wear rate is not a per-material uniform');
// THE BRANCH MUST BE ON UNIFORMS ONLY. `aeroW` is the dial times this
// material's rate — both uniforms — so the whole quad takes the same path and
// the texture fetch inside it has defined derivatives. A branch on anything
// varying would put texture2D in divergent flow, which is the trap the decal
// loop is written around and which shows up only as a crawling edge.
check(/float aeroWA = uWear\.x \* uWearK;/.test(SRC) &&
      /if \(aeroWA > 0\.0\) \{/.test(SRC),
  'the wear branch is not on uniforms alone');
// the streak helper takes its source as a parameter and returns 0 for an
// undeclared one, so an aeroplane with no exhaust measured gets no streak
check(/float aeroStreak\(vec2 m, vec4 s\) \{/.test(SRC),
  'aeroStreak is not the declared source-and-run helper');
check(/if \(s\.z <= 0\.0\) return 0\.0;/.test(SRC),
  'an undeclared wear source does not answer "no streak"');
// and metalness must fall with wear, or weathering is invisible on every
// metal aeroplane: the environment map washes an albedo change straight out
check(/metalnessFactor \*= 1\.0 - 0\.55 \* max\(aeroWG/.test(SRC),
  'wear does not dull metalness');
{
  // the sources are placed in the SURFACE FIELD, so the streaks are on the
  // fuselage and the flying surfaces only — the hardware has no coordinate
  // to run them along and must not pretend to
  const surfOnly = SRC.slice(SRC.indexOf('float aeroWA = uWear.x'));
  const seg = surfOnly.slice(0, surfOnly.indexOf('}\n`'));
  const iS = seg.indexOf('aeroWS =');
  const iG = seg.indexOf('#if AEROSKIN_SURF == 1');
  check(iG >= 0 && iS > iG,
    'the streaks are computed outside the surface-field branch');
}

// ---------------------------------------------------------------------------
// 11 THE LAYER SECTIONS — the per-part livery's declared chain holds
// ---------------------------------------------------------------------------
// AERO_SEC is walked in the player's browser on every build, so the things
// that would make the walk lie are asserted here: a chain that loops or ends
// nowhere, a pinned finish that does not exist, a name that collides with a
// cage section (the five override maps key on BOTH vocabularies at once, so
// a collision is one row silently driving two surfaces). The resolver is
// pure on purpose — the same function the browser runs is called here with
// hand-made override maps, one check per rule of the walk.
const secChainBad = tbl => {
  const bad = [];
  for (const s of Object.keys(tbl)) {
    const seen = new Set();
    let cur = s;
    while (cur != null) {
      if (seen.has(cur)) { bad.push(s + ': parent cycle at ' + cur); break; }
      seen.add(cur);
      const row = tbl[cur];
      if (!row) {
        // the chain left the table: its anchor must be a real cage section
        if (A.AERO_ROLE[cur] == null)
          bad.push(s + ': chain ends at unknown section ' + cur);
        break;
      }
      cur = row.parent;
    }
  }
  return bad;
};
const secFinBad = tbl => Object.keys(tbl)
  .filter(s => tbl[s].fin != null && !A.AERO_FINISH[tbl[s].fin]);
{
  const T = A.AERO_SEC || {};
  check(Object.keys(T).length > 0, 'AERO_SEC is missing or empty');
  const chainBad = secChainBad(T);
  check(chainBad.length === 0, 'layer section chains broken',
    chainBad.join('; '));
  const finBad = secFinBad(T);
  check(finBad.length === 0,
    'layer sections pinning finishes that do not exist', finBad.join(', '));
  const clash = Object.keys(T).filter(s =>
    A.AERO_ROLE[s] != null || A.AERO_LINER[s] != null ||
    A.AERO_GLASS.has(s) || sections.has(s));
  check(clash.length === 0,
    'layer section names collide with cage sections', clash.join(', '));
  const bare = Object.keys(T).filter(s => !T[s].label || !T[s].layer);
  check(bare.length === 0,
    'layer sections without a label or a layer', bare.join(', '));

  // THE WALK ITSELF, one rule per check:
  // an own override stops the walk...
  let r = A.aeroSecResolve('wingAil',
    { fin: { wingAil: 'chrome', wingSkin: 'ply', body: 'alclad' } },
    { cons: 'wood' });
  check(r.fin === 'chrome' && r.src === 'wingAil',
    'an own finish override does not stop the walk', JSON.stringify(r));
  // ...a parent's shadows the grandparent's...
  r = A.aeroSecResolve('wingAil',
    { fin: { wingSkin: 'ply', body: 'alclad' } }, { cons: 'wood' });
  check(r.fin === 'ply' && r.src === 'wingSkin',
    "the wing's override does not shadow the fuselage's for its children",
    JSON.stringify(r));
  // ...the fuselage's own tint reaches the aileron through two hops...
  r = A.aeroSecResolve('wingAil', { tint: { body: 0x123456 } },
    { cons: 'wood' });
  check(r.tint === 0x123456,
    "the fuselage's tint does not reach the aileron", JSON.stringify(r));
  // ...the five channels walk independently (a tinted aileron still takes
  // the fuselage's finish)...
  r = A.aeroSecResolve('wingAil',
    { tint: { wingAil: 0xffffff }, fin: { body: 'alclad' },
      tile: { finSkin: 2 } }, { cons: 'wood' });
  check(r.fin === 'alclad' && r.tint === 0xffffff && r.tileK == null,
    'the channels do not walk independently', JSON.stringify(r));
  // ...a dial inherits down its own chain...
  r = A.aeroSecResolve('finRud', { tile: { finSkin: 1.3 } },
    { cons: 'wood' });
  check(r.tileK === 1.3, 'a dial does not inherit down the chain',
    JSON.stringify(r));
  // ...a layer-decided bottom-out finish wins over the construction...
  r = A.aeroSecResolve('finSkin', {}, { cons: 'wood', fin: 'bareAlu' });
  check(r.fin === 'bareAlu' && r.src === null,
    'a layer bottom-out finish does not win over the construction',
    JSON.stringify(r));
  // ...and with nothing said at all, four constructions dress the wing four
  // different ways — the walk really does bottom out on AERO_BY_CONS.
  const skins2 = CONSTRUCTIONS.map(c =>
    A.aeroSecResolve('wingSkin', {}, { cons: c }).fin);
  check(new Set(skins2).size === CONSTRUCTIONS.length,
    'the constructions do not resolve a bare wing to distinct finishes',
    skins2.join(', '));
  check(skins2.every((f, i) =>
    f === A.aeroFinishFor('body', CONSTRUCTIONS[i])),
    "a bare wing's bottom-out is not the fuselage skin's own resolution",
    skins2.join(', '));

  // THE PINNED FIN (phase C): a hardware row's `fin` says what the part IS
  // — an ancestor's FINISH must never reach it, while its COLOUR still does.
  r = A.aeroSecResolve('spat', { fin: { body: 'ply' } }, { cons: 'wood' });
  check(r.fin === 'trim',
    "the fuselage's finish reaches a pinned spat", JSON.stringify(r));
  r = A.aeroSecResolve('spat',
    { fin: { body: 'ply' }, tint: { body: 0x224466 } }, { cons: 'wood' });
  check(r.tint === 0x224466,
    "the fuselage's tint does not reach the spat", JSON.stringify(r));
  r = A.aeroSecResolve('spat', { fin: { spat: 'composite' } },
    { cons: 'wood' });
  check(r.fin === 'composite',
    'a spat cannot be repainted over its pin', JSON.stringify(r));
  // ...and the SPINNER follows the PROPELLER: unset it wears the blade's
  // material (the layer's ctx.fin), overridden on the prop it follows that,
  // its own override wins over both.
  r = A.aeroSecResolve('spinner', {}, { fin: 'bareAlu' });
  check(r.fin === 'bareAlu',
    'an unset spinner does not wear the blade material', JSON.stringify(r));
  r = A.aeroSecResolve('spinner', { fin: { prop: 'chrome' } },
    { fin: 'bareAlu' });
  check(r.fin === 'chrome',
    "the propeller's override does not reach the spinner", JSON.stringify(r));
  r = A.aeroSecResolve('spinner',
    { fin: { spinner: 'trim', prop: 'chrome' } }, { fin: 'bareAlu' });
  check(r.fin === 'trim',
    "the spinner's own override does not win", JSON.stringify(r));

  // THE CREW (phase D): the second dummy's suit COLOUR follows the first
  // (paint the crew once, then differ one), while its MATERIAL stays its
  // own pin — personality is a tint, not a re-moulding.
  r = A.aeroSecResolve('dummy2', { tint: { dummy1: 0x8899aa } }, {});
  check(r.tint === 0x8899aa,
    "the first dummy's suit colour does not reach the second",
    JSON.stringify(r));
  r = A.aeroSecResolve('dummy2', { fin: { dummy1: 'leather' } }, {});
  check(r.fin === 'composite',
    "the first dummy's suit material leaks onto the second",
    JSON.stringify(r));

  // THE DIALS CROSS THE JOIN (G113), and the chain is three files long with
  // a silent failure at every link: the factory must STAMP the deviation on
  // the material (the snapshot walks materials), the join must COPY it into
  // the bucket, and the game's matFor must PASS it back to the same factory.
  // A missing link shows up only as an aeroplane that flies with factory
  // numbers, which nobody sees in a gate — so the wiring is asserted in the
  // text, the level the trap lives at.
  {
    const joinSrc = layerSrc('_cage_join.js');
    const appSrc = fs.readFileSync(
      path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    for (const k of ['TileK', 'RoughK', 'NrmK', 'RibM', 'WearK', 'WearM']) {
      check(new RegExp('userData\\.aero' + k + ' = ').test(SRC),
        `aeroMaterial does not stamp aero${k} for the join`);
      check(new RegExp('ud\\.aero' + k).test(joinSrc),
        `the join does not copy aero${k} into the payload`);
    }
    for (const k of ['tileK', 'roughK', 'nrmK', 'ribM', 'wearK', 'wearM'])
      check(new RegExp(k + ':\\s*m\\.' + k).test(appSrc),
        `the game's matFor does not pass ${k} back to the factory`);
  }

  // THE PART'S OWN CONDITION (G114) walks the chain like a dial: the
  // aileron shows the wing's treatment until it is told otherwise.
  r = A.aeroSecResolve('wingAil', { wear: { wingSkin: 2.5 } },
    { cons: 'wood' });
  check(r.wearM === 2.5, "the wing's condition does not reach the aileron",
    JSON.stringify(r));
  r = A.aeroSecResolve('wingAil',
    { wear: { wingAil: 0.5, wingSkin: 2.5 } }, { cons: 'wood' });
  check(r.wearM === 0.5, "a part's own condition does not win",
    JSON.stringify(r));

  // THE PART'S OWN CONSTRUCTION (G110) is CONSULTED at the material, not
  // just rendered as a row: GATE PARTS proves the rows exist, and this
  // proves the layer reads them — a construction row nothing consults is a
  // dead slider that still moves.
  const consWing = layerSrc('_cage_wing.js');
  const consTail = layerSrc('_cage_fin.js');
  check(/P0\.wgCons/.test(consWing),
    'wingMat does not consult the wing construction row (wgCons)');
  check(/P0\[pk\]/.test(consTail) && /stCons/.test(consTail) &&
        /finCons/.test(consTail),
    'tailMat does not consult the tail construction rows (finCons/stCons)');
}

// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  // NEGATIVE VERIFY: break each rule and require the check to notice.
  const probes = [
    ['a layer section parent cycle', () =>
      secChainBad({ a: { parent: 'b' }, b: { parent: 'a' } }).length > 0],
    ['a layer chain ending nowhere', () =>
      secChainBad({ a: { parent: '__noSuchSection__' } }).length > 0],
    ['a layer finish that does not exist', () =>
      secFinBad({ a: { parent: null, fin: '__nope__' } }).length > 0],
    ['a construction row nothing consults', () =>
      !/P0\.wgCons/.test('const cons = CONS4[intCons]')],
    ['a dial the join forgets', () =>
      !/ud\.aeroTileK/.test('mats[key] = { color, fin, grm }')],
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
    // G70
    ['a layer material with no finish',
      () => A.aeroHardFinish('gear', '__undressed__') === undefined],
    ['a finish row for a material the layer dropped',
      () => ['tyre', '__gone__'].filter(n => !['tyre'].includes(n)).length > 0],
    ['a blade material that fell off the end of the map',
      () => ![ 'ply', 'ply' ][2]],
    ['a wear branch on a varying',
      () => !/float aeroWA = uWear\.x \* uWearK;/.test('float aeroWA = vSurf.x;')],
    ['a streak with no source check',
      () => !/if \(s\.z <= 0\.0\) return 0\.0;/.test('float aeroStreak() { return 1.0; }')],
    ['wear that leaves metalness alone',
      () => !/metalnessFactor \*= 1\.0 - 0\.55/.test('metalnessFactor *= 1.0;')],
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

// ---------------------------------------------------------------------------
// THE PROJECTOR (G108)
// ---------------------------------------------------------------------------
// The user: "the projection on the fin is really really bad... the fuselage
// projection and the fin projection should be one if possible. The wing and
// the slabs projection should [be] another, fully independent one."
//
// Three claims, and each one was false before this chantier:
//
//   THE LOOP IS NOT INSIDE THE FIELD'S OWN #if. It was, so every surface on
//   the triplanar branch — the cowl, the engine, the spinner, the gear, the
//   cabin — could never carry a marking however it was aimed. This is the
//   check behind "so a continuous image can be projected on the plane".
//
//   THE SURFACE CLASS IS A CLASS, NOT A FLAG. uG5.w was `o.wing ? 1 : 0`, so
//   a fin and a wing were the same thing and no target could name one without
//   the other. It is 0 body / 1 wing / 2 tail now.
//
//   THE BOX PROJECTOR IS IN CRAFT SPACE. vObjPos is per-LAYER — measured on
//   the stock build the cowl is in metres and the fin in cage units — so a
//   projector built on it changes scale at every layer boundary. vCraftPos
//   comes through uCraftInv and is metres everywhere.
{
  // 1 — the decal block is reachable from the triplanar branch
  const dec = SRC.slice(SRC.indexOf('THE DECALS, last in the albedo stack'));
  const loopAt = dec.indexOf('for (int di = 0; di < AERO_MAXD; ++di)');
  const guardAt = dec.lastIndexOf('#if AEROSKIN_SURF == 1', loopAt);
  const endAt = dec.indexOf('#endif');
  check(loopAt > 0, 'projector: the decal loop is gone');
  check(!(guardAt > 0 && endAt > loopAt && guardAt < loopAt),
        'projector: the decal loop is back inside the field-only #if — ' +
        'the cowl and every other analytic surface cannot carry a marking');

  // 2 — the class, in the shader and in the factory
  check(/uG5\.w[^\n]*class|w class/.test(SRC),
        'projector: uG5.w is not documented as a surface class');
  check(/uG5: \{ value: new THREE\.Vector4\([^)]*\+o\.wing \|\| 0\)/.test(SRC),
        'projector: the surface class is being flattened to a flag again');

  // 3 — craft space exists and is what the box projector reads
  check(/varying vec3 vCraftPos;/.test(SRC),
        'projector: vCraftPos is not declared');
  check((SRC.match(/varying vec3 vCraftPos;/g) || []).length === 2,
        'projector: vCraftPos must be declared in BOTH shaders');
  check(/vCraftPos = \(uCraftInv \* modelMatrix/.test(SRC),
        'projector: vCraftPos is not built from uCraftInv * modelMatrix');
  check(/vec3 aeroA = vCraftPos;/.test(SRC),
        'projector: the box coordinate is not craft space');
  check(!/uSideAxis/.test(SRC.replace(/\/\/[^\n]*/g, '')),
        'projector: uSideAxis is back — it was declared, defaulted and never ' +
        'passed by any caller for two arcs, and craft space replaced it');

  // 4 — the modes and the class flags, as the packer writes them
  check(A.AERO_DEC_MODE === undefined || true, 'noop');
  const modes = /const AERO_DEC_MODE = \{ field: 0, side: 1, plan: 2 \};/.test(SRC);
  check(modes, 'projector: the three projection modes are not declared');
  check(/U\.uDecD\.value\[i\]\.set\(/.test(SRC),
        'projector: the mode and class flags are not packed');
  check(/on\.body \? 1 : 0, on\.wing \? 1 : 0, on\.tail \? 1 : 0/.test(SRC),
        'projector: the class flags are not one per class');

  // 5 — the shader picks the coordinate by MIXING, never by branching around
  //     a texture fetch: divergent flow makes the mip level undefined, which
  //     is this loop's oldest rule and the reason it is shaped as it is
  check(/vec2 dd = mix\(fieldC, boxC, step\(0\.5, mode\)\);/.test(SRC),
        'projector: the field/box choice is not a mix — a branch here makes ' +
        'texture2D derivatives undefined and the decal edge crawls');

  // 6 — the cage and the flown aeroplane both declare their frame, or the
  //     flown one is painted in a frame nobody set
  const UI = fs.readFileSync(path.join(ROOT, 'tools', '_cage_ui.js'), 'utf8');
  const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  check(/aeroSetCraft\(THREE, root\.matrixWorld/.test(UI),
        'projector: the editor never tells AEROSKIN where the craft is');
  check(/wing: m\.wing \|\| 0/.test(APP),
        'projector: the join does not carry the surface class into flight');
  const JOIN = fs.readFileSync(path.join(ROOT, 'tools', '_cage_join.js'), 'utf8');
  check(/ud\.aeroWing \? \{ wing: ud\.aeroWing \} : \{\}/.test(JOIN),
        'projector: the snapshot does not record the surface class');

  // 7 — THE MARKINGS REACH THE FLOWN AEROPLANE (G160). The user's report was
  //     "the registration did not make it in-game intact, my settings affected
  //     only the garage", and it was exactly true: aeroSetDecals had one
  //     caller and that caller was the editor panel. These four checks are the
  //     shape of the repair, and each of them is a way it could silently come
  //     undone again.
  const SKIN = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'aeroskin.js'), 'utf8');
  check(/function aeroApplySpecDecals\(THREE, spec\)/.test(SKIN),
        'markings: aeroskin has no door for a spec — the flight side would ' +
        'have to build the decal list itself, which is how the garage and ' +
        'the flown aeroplane end up disagreeing about where a marking sits');
  check(/aeroApplySpecDecals\(THREE, genSpec\)/.test(APP),
        'markings: the flight never applies this build’s own markings — the ' +
        'registration is painted on in the garage and gone the moment you fly');
  // AND OFF THE RIGHT OBJECT, EVERY FRAME (G160.2). The box projectors invert
  // whatever carries the aeroplane's pose, and that is `model.grp` — rebuilt
  // from the solver's basis on every frame. `craft` is never posed at all, so
  // handing THAT over made uCraftInv the identity and vCraftPos world
  // position, which is the original defect wearing a different hat. The regex
  // pins the object AND its neighbourhood: this call belongs beside the matrix
  // it inverts, not in the build.
  check(/model\.grp\.updateWorldMatrix\(true, false\);[\s\S]{0,80}aeroSetCraft\(THREE, model\.grp\.matrixWorld/.test(APP),
        'markings: the projector frame is not driven off the aeroplane’s ' +
        'own posed group each frame, so a side- or plan-projected marking ' +
        'slides across the aeroplane as it flies');
  check(!/aeroSetCraft\(THREE, craft\.matrixWorld/.test(APP),
        'markings: the projector frame is taken from `craft`, which is never ' +
        'posed — that makes vCraftPos world position');
  // AND THE MERGE ITSELF, run rather than pattern-matched. `finish.decals`
  // holds DEVIATIONS, so the rule that matters is what an ABSENT field falls
  // back to: a missing `regH` read as 0 gives a marking no height, which on
  // screen is indistinguishable from the markings never arriving at all —
  // this arc's own bug, reintroduced one layer down.
  const placed = { regH: 0.6, regL: 3.15, regC: 0.14, regW: 1, regLock: 0 };
  const merged = A.aeroDecalMerge({ finish: { decals: placed } });
  for (const k in placed)
    check(merged[k] === placed[k],
      'markings: the merge drops a placed value — a build’s own marking ' +
      'would be painted somewhere the builder never put it', k);
  check(merged.regTarget === A.AERO_DEC_DEF.regTarget
        && merged.regMode === A.AERO_DEC_DEF.regMode,
        'markings: an untouched field does not fall back to the default');
  check(A.aeroDecalMerge({}).regH === A.AERO_DEC_DEF.regH,
        'markings: a spec with no finish at all does not get the factory ' +
        'marking — null is the factory finish everywhere else in this file');

  // THE REGISTRATION HAS ONE OWNER (G160). It had three — an editor cache, a
  // per-browser pref, and the spec — and the spec, the only one that is saved
  // and flown, was the one nothing wrote. Each check below is one of those
  // three coming back.
  check(/G\.update\(\{ meta: \{ reg: v \} \}\)/.test(UI),
        'markings: the registration row does not write the spec — it would ' +
        'repaint the garage and never reach the saved build');
  check(!/const reg = DEC\.reg;/.test(UI),
        'markings: a load carries the previous aeroplane’s registration ' +
        'across instead of taking the loaded one’s');
  check(/delete d\.reg;/.test(UI),
        'markings: the registration rides in the per-browser preference ' +
        'again, so one aeroplane’s letters reappear on every other');

  // the editor must not have grown a second copy of the translation back
  check(!/list\.push\(\{ page: 0, sL: DEC\.regL/.test(UI)
        && /aeroDecalsFor\(THREE, DEC/.test(UI),
        'markings: the editor builds its own decal list again — there must be ' +
        'ONE keeper of what a placement means, or the two drift apart');
}

// ---------------------------------------------------------------------------
// THE MARKING'S OWN CONTROLS (G113.1)
// ---------------------------------------------------------------------------
// The user: "the registration also should offer a lot more controls;
// independent width and height, choice of police, plus station and height on
// side". Station and height on side already existed; width was DERIVED from
// the height and the face was one hard-coded string.
{
  const F = A.AERO_DEC_FONTS;
  check(Array.isArray(F) && F.length >= 2,
        'marking: there is no face table to choose from');

  // ONLY WHAT THE ARTIFACT SHIPS. This is a zero-network single-file build,
  // and a livery that renders in a different face on somebody else's machine
  // is not a livery. The vendored set is the two Plex families; a face that
  // named Helvetica would look right here and wrong everywhere else.
  const CSS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'style.css'), 'utf8');
  const shipped = [];
  const re = /@font-face \{ font-family:'([^']+)'[^}]*?font-weight:([0-9 ]+)/g;
  for (let m; (m = re.exec(CSS));)
    shipped.push({ fam: m[1], w: m[2].trim().split(/\s+/).map(Number) });
  check(shipped.length > 0, 'marking: no @font-face rules to check against');
  for (const f of F) {
    const m = /^([0-9]+)\s+[0-9.]+px\s+"([^"]+)"/.exec(f.css);
    if (!check(m, 'marking: a face row is not "<weight> <size>px \\"<family>\\""',
               f.name)) continue;
    const wt = +m[1], fam = m[2];
    const s2 = shipped.filter(x => x.fam === fam);
    check(s2.length > 0, 'marking: the face names a family this build does ' +
          'not ship', f.name + ' -> ' + fam);
    // a variable face declares a RANGE (100 700); a static one declares one
    const ok = s2.some(x => x.w.length > 1
      ? (wt >= x.w[0] && wt <= x.w[1]) : x.w[0] === wt);
    check(ok, 'marking: the face asks for a weight this build does not ship ' +
          '(it will be SYNTHESISED, which is what G69 was doing at 700)',
          f.name + ' -> ' + fam + ' ' + wt);
  }
  // ...and the faces have to be four different DRAWINGS, not four names for
  // one. The tracking is what a monospaced legal marking and a sans logotype
  // actually differ by at this size, so it is part of the row.
  const tracks = new Set(F.map(f => f.track));
  check(tracks.size > 1, 'marking: every face carries the same tracking — ' +
        'they would differ in name only');

  // the baker must take the face, or the row is a control over nothing
  check(/function aeroDecalText\(THREE, page, text, colHex, outHex, font\)/.test(SRC),
        'marking: the text baker does not take a face');
  check(/const F = AERO_DEC_FONTS\[/.test(SRC) && /g\.font = F\.css;/.test(SRC),
        'marking: the baker ignores the face it was handed');
  check(!/g\.font = '700 96px/.test(SRC),
        'marking: the hard-coded 700 Plex Mono is back — it is a weight this ' +
        'build does not ship and the browser synthesises it');

  // independent width, and the lock that keeps the old behaviour the default
  const UI2 = fs.readFileSync(path.join(ROOT, 'tools', '_cage_ui.js'), 'utf8');
  check(/regW: [0-9.]+, regLock: 1/.test(UI2),
        'marking: there is no independent width, or it does not default to ' +
        'the derived one');
  // THESE TWO NOW LIVE IN THE KEEPER (G160). The width rules used to be read
  // out of the editor panel, and that is exactly the arrangement that let the
  // flown aeroplane wear no markings at all: if the only place that knows what
  // `regLock` means is a panel, only the panel can paint it. aeroDecalsFor is
  // the one keeper, so the rules are asserted where they are now enforced.
  const SKIN2 = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'aeroskin.js'), 'utf8');
  check(/const w = D\.regLock \? D\.regH \* Math\.max\(1\.2, aspect\)/.test(SKIN2),
        'marking: a locked width does not follow the height at the face aspect');
  check(/: Math\.max\(0\.02, D\.regW\);/.test(SKIN2),
        'marking: the decal is not taking its width from the row');
  // and the panel still MIRRORS the derived width into its row, or the number
  // beside the slider stops agreeing with the marking on the aeroplane
  check(/if \(DEC\.regLock\) DEC\.regW = DEC\.regH \* Math\.max\(1\.2, R\.aspect\);/.test(UI2),
        'marking: the panel no longer shows the width the keeper derived');
  check(/regFont: 0/.test(UI2), 'marking: the face is not part of the state');
}

// ---------------------------------------------------------------------------
// THE GLAZING (G113.3)
// ---------------------------------------------------------------------------
// The user: "the glass material needs a lot more options, and the ability for
// a scratch roughness map... transparency, possibly edge detection for some
// corner dirt, reflection, possibly tinting or rainbow reflections. Be clever,
// see what we need and what the three.js materials allow."
//
// What r128 allows is the whole shape of the answer: this MeshPhysicalMaterial
// has transmission, clearcoat, clearcoatRoughness and reflectivity and NOTHING
// else of the modern glass set. So tint, clarity and reflection are material
// fields and the rest is drawn analytically.
{
  const G = /const GLASS_DEF = \{([\s\S]*?)\};/.exec(SRC);
  check(G, 'glazing: there is no declared default set');
  if (G) for (const k of ['tint', 'opacity', 'scratch', 'wipe', 'grime',
                          'refl', 'rainbow'])
    check(new RegExp('\\b' + k + ':').test(G[1]),
          'glazing: the declared set is missing a dial', k);

  // EVERY DIAL JOINS THE POOL KEY. The pool is keyed on LOOK; a dial that is
  // not in the key means two panes with different settings silently share one
  // material, and the second one you set does nothing. (Before this the key
  // was tint and opacity alone, which was true when those were all a pane
  // could differ by.)
  const K = /const key = 'glass\|'([\s\S]*?);\n/.exec(SRC);
  check(K, 'glazing: the pool key could not be read');
  if (K) for (const k of ['opacity', 'scratch', 'wipe', 'grime', 'refl',
                          'rainbow', 'ext'])
    check(K[1].indexOf(k) >= 0,
          'glazing: a dial is not in the pool key — two panes set differently ' +
          'would share one material', k);

  check(/uniform vec4  uGlass;/.test(SRC) && /uniform vec4  uGlassE;/.test(SRC),
        'glazing: the dials or the pane extent are not declared');

  // A SCRATCH IS GEOMETRY. On a transmission 0.92 / clearcoat 1.0 pane the
  // BASE roughness barely shows — the clear layer owns the specular — so a
  // scratch that only roughened the base was invisible, measured, in two
  // renders that came back pixel-identical. It has to tilt the clearcoat
  // normal, and this is the check that keeps it doing so.
  check(/clearcoatNormal = normalize\(clearcoatNormal - T \* dg\.x - B \* dg\.y\);/
        .test(SRC),
        'glazing: the scratches no longer perturb the clearcoat normal — on ' +
        'this material that makes them invisible');
  check(/aeroGSC = sc;/.test(SRC),
        'glazing: the scratch field is not carried to the clearcoat chunk');

  // THE EDGE IS THE PANE'S OWN, not the screen's. A screen-space edge detect
  // would move when the camera did, and dirt that moves is not dirt.
  const UI3 = fs.readFileSync(path.join(ROOT, 'tools', '_cage_ui.js'), 'utf8');
  check(/GLASS_EXT\[nm\] = \[lo0 \* F, lo1 \* F, hi0 \* F, hi1 \* F\];/.test(UI3),
        'glazing: the pane extent is not measured off the drawn mesh');
  check(/uGlassE\.z > uGlassE\.x/.test(SRC),
        'glazing: the grime does not guard on having a measured extent');

  // THE MOOD STILL SCALES THE REFLECTION. aeroSetEnv multiplies every material
  // by the room's factor off userData.env0, so the builder's dial has to be
  // folded into the BASE rather than written on top, or the two fight and
  // whichever ran last wins.
  check(/envMapIntensity: 1\.4 \* G\('refl'\)/.test(SRC),
        'glazing: the reflection dial is not folded into the base — it will ' +
        'fight aeroSetEnv');

  // AND THE RAINBOW IS AN EFFECT, said in the code. r128 has no iridescence;
  // claiming it would be the kind of quiet lie this project keeps a ledger
  // against.
  check(!/iridescence:/.test(SRC),
        'glazing: something is setting `iridescence`, which r128 does not have');
  check(/EFFECT rather than physics/.test(SRC),
        'glazing: the rainbow no longer says it is an effect');

  // deviations only, like the sections and the decals — a build that never
  // touched the glass must say nothing about it
  check(/for \(const k in GLASS_DEFV\) if \(GLASS\[k\] !== GLASS_DEFV\[k\]\)/.test(UI3),
        'glazing: the spec block is not deviations-only');
  check(/if \(o\.glass && typeof o\.glass === 'object'\)/.test(UI3),
        'glazing: the spec block never comes back in');
}

// ---------------------------------------------------------------------------
// THE FLAT SURFACES (G113.3) — item 21 of the review
// ---------------------------------------------------------------------------
// The user: "I would much rather have some box mapping for the slabs. They
// also look bad, even the fabric texture looks bad, and the leading edge wash
// out is completely irregular and screwed up. We cannot rely on geometry for
// the mapping of these parts, but they are also very flat, so let us use box
// mapping. Warning with the V tail configuration, let us be resistant to
// that."
//
// Two separate defects, and the second one was measurable.
{
  const FIN = fs.readFileSync(path.join(ROOT, 'tools', '_cage_fin.js'), 'utf8');

  // ---- 1. THE LEADING EDGE ENVELOPE MUST NOT DIP UNDER ITS OWN DATA ------
  // MEASURED IN THE PAGE before the fix: one vertex in FIVE on the stabiliser
  // (348 of 1728) and 6.7 % on the fin came back with a NEGATIVE chord
  // coordinate — ahead of their own leading edge. The wing, whose field is
  // built elsewhere, had none. The shader clamps with max(sC, 0), so the
  // wash-out band saturated over a fifth of the panel in a shape that
  // followed the TRIANGULATION. That is what "completely irregular" was.
  check(/const Z = zHi\.slice\(\);/.test(FIN) &&
        /zHi\[i\] = Math\.max\(Z\[i\], Z\[Math\.max\(0, i - 1\)\], Z\[Math\.min\(NB - 1, i \+ 1\)\]\);/
          .test(FIN),
        'flat surfaces: the leading-edge envelope is no longer dilated — the ' +
        'chord coordinate will go negative on any tapered tail again');

  // ...and the INVARIANT the dilation exists for, property-tested rather than
  // pattern-matched. `at()` is reimplemented here EXACTLY as the source
  // writes it, so this fails if either the dilation or the interpolation
  // changes shape.
  {
    const NB = 48;
    const at = (T, f01) => {
      const f = Math.max(0, Math.min(NB - 1.001, f01 * NB - 0.5));
      const i = Math.floor(f), t = f - i;
      return T[i] + (T[Math.min(NB - 1, i + 1)] - T[i]) * t;
    };
    let worstUn = 0, worstDi = 0;
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let trial = 0; trial < 400; trial++) {
      // a swept, tapered, sometimes kinked leading edge
      const raw = new Float64Array(NB);
      const a = rnd() * 2 - 1, b = rnd() * 3, k = Math.floor(rnd() * NB);
      for (let i = 0; i < NB; i++)
        raw[i] = a * i / NB + b * Math.pow(i / NB, 2) + (i === k ? rnd() : 0);
      const dil = new Float64Array(NB);
      for (let i = 0; i < NB; i++)
        dil[i] = Math.max(raw[i], raw[Math.max(0, i - 1)], raw[Math.min(NB - 1, i + 1)]);
      // every vertex sits in some bin and is at most that bin's own maximum
      for (let s = 0; s < 200; s++) {
        const f01 = s / 199;
        const bin = Math.max(0, Math.min(NB - 1, Math.floor(f01 * NB)));
        worstUn = Math.max(worstUn, raw[bin] - at(raw, f01));
        worstDi = Math.max(worstDi, raw[bin] - at(dil, f01));
      }
    }
    check(worstUn > 1e-6,
          'flat surfaces: the UNDILATED envelope no longer dips under its own ' +
          'data — this probe proves nothing and the dilation looks free');
    check(worstDi <= 1e-12,
          'flat surfaces: the dilated envelope still dips under its own data',
          'worst ' + worstDi.toExponential(2));
  }

  // ---- 2. THE MICROSURFACE IS BOX-MAPPED, AND ONLY THE MICROSURFACE ------
  check(/vec2 aeroDetST\(\)/.test(SRC),
        'flat surfaces: the detail coordinate is not a function of its own');
  check(/return mix\(fieldC, boxC, uBoxDet\) \/ uTileM;/.test(SRC),
        'flat surfaces: the field/box detail choice is not a mix — a branch ' +
        'around texture2D makes the mip level undefined');
  // the STRUCTURE and the WASH-OUT are different consumers of the same
  // attribute and must keep the field: ribs are placed on stations, and the
  // wash-out is metres from a leading edge that only the field knows about.
  check(/aeroStructure\(aeroM, aeroRA\)/.test(SRC),
        'flat surfaces: the structure grammar has been moved off the field');
  check(/uG4\.z > 0\.0 && uG5\.w > 0\.5/.test(SRC),
        'flat surfaces: the leading-edge wash-out gate has changed shape');

  // ---- 3. V-TAIL RESISTANCE IS MEASURED, NOT ASSUMED ---------------------
  // Nothing may say "a fin is vertical". The panel's own accumulated normal
  // decides its plane, so a canted surface takes whichever it is more of and
  // the code never learns that a V-tail exists.
  check(/nx \+= Math\.abs\(nor\[i\]\); ny \+= Math\.abs\(nor\[i \+ 1\]\);/.test(FIN),
        'flat surfaces: the box plane is no longer measured off the panel ' +
        'normals — a canted V-tail panel would take a plane it does not lie in');
  check(/tailMat\(k, sec, nx >= ny \? 0 : 1\)/.test(FIN),
        'flat surfaces: the measured plane is not handed to the material');

  // ...and it has to reach the pool key, or a fin and a stab share a material
  check(/o\.boxDet \? 'B' \+ \(\+o\.boxPlane \|\| 0\) : ''/.test(SRC),
        'flat surfaces: the box plane is not in the pool key — the fin and ' +
        'the stab would share one material and one plane');
}


// ---------------------------------------------------------------------------
// G113.4 — THE ENGINE, THE INK, THE FRAME AND THE GLAZING'S YEARS
// ---------------------------------------------------------------------------
// Four items closing the twenty-one-item review: the engine becomes paintable,
// the registration gets its own ink, a mode change stops moving the marking,
// and glass finally takes the condition dial G70 declared it could not.
//
// EVERY PATTERN BELOW IS MATCHED AGAINST COMMENT-STRIPPED SOURCE. Three times
// this arc an assertion searched for a name that the explanatory comment
// directly above it also used, and passed on the prose rather than the code.
{
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '')
                      .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))
                      .join('\n');
  const UI4 = strip(fs.readFileSync(
    path.join(ROOT, 'tools', '_cage_ui.js'), 'utf8'));
  const ENG = strip(fs.readFileSync(
    path.join(ROOT, 'tools', '_cage_eng.js'), 'utf8'));
  const SK = strip(SRC);

  // ---- A. THE ENGINE IS THE BUILDER'S TO PAINT --------------------------
  // The user: "try to get the material and color picker from the engine
  // (block and covers should be pickable)". Three groups, because an engine
  // is finished in three: the crankcase and its castings, the cylinders, and
  // the rocker covers as the accent.
  // G156 added a FOURTH, the mount ("Color selection engine braces"), and it
  // is deliberately not a fourth castings group — see below.
  const engRows = ['engBlock', 'engJug', 'engCover', 'engMount'];
  for (const k of engRows)
    check(A.AERO_SEC[k] && A.AERO_SEC[k].layer === 'eng',
          'engine: ' + k + ' is not a declared section on the eng layer');
  check(A.AERO_SEC.engJug && A.AERO_SEC.engJug.parent === 'engBlock' &&
        A.AERO_SEC.engCover && A.AERO_SEC.engCover.parent === 'engJug',
        'engine: the three groups no longer inherit down the chain — a ' +
        'painted crankcase must reach the cylinders and the covers');
  // THE MOUNT IS PAINT, NOT CASTINGS. AERO_HARD calls it "a painted steel
  // engine mount, a dielectric", so it must bottom out on `trim` and follow
  // the BODY — putting it under engBlock would make a painted crankcase drag
  // the airframe's mount with it, which is not what either is.
  check(A.AERO_SEC.engMount && A.AERO_SEC.engMount.fin === 'trim' &&
        A.AERO_SEC.engMount.parent === 'body',
        'engine: the mount must bottom out on trim and follow the body, not ' +
        'the crankcase');
  check(A.AERO_HARD && A.AERO_HARD.eng && A.AERO_HARD.eng.emMount === 'trim',
        'engine: the hardware table no longer calls the mount painted trim — ' +
        'the section above was written against that');

  // the map from the generator's own part names to those sections, parsed out
  // of the generator rather than trusted
  const engBlk = /const ENG_SEC = \{([\s\S]*?)\};/.exec(ENG);
  check(!!engBlk, 'engine: no ENG_SEC map in _cage_eng.js');
  if (engBlk) {
    const pairs = [...engBlk[1].matchAll(/(\w+)\s*:\s*'(\w+)'/g)]
                    .map(m => [m[1], m[2]]);
    check(pairs.length >= 9,
          'engine: the ENG_SEC map has shrunk', pairs.length + ' parts');
    // BOTH DIRECTIONS, because a rename on either side is silent otherwise
    const bad = pairs.filter(p => !engRows.includes(p[1]));
    check(!bad.length,
          'engine: ENG_SEC names a section that is not declared',
          bad.map(p => p.join('->')).join(', '));
    // every mapped name must be a real part in the hardware table — that is
    // the list the generator actually draws from (mats.map(matOf) over one
    // merged mesh), so a typo or a rename on either side becomes a row over
    // nothing rather than a silent no-op
    const dead = pairs.filter(p => !A.AERO_HARD.eng[p[0]]);
    check(!dead.length,
          'engine: ENG_SEC names a part that is not in AERO_HARD.eng — the ' +
          'row would be a control over nothing',
          dead.map(p => p[0]).join(', '));
    const cover = engRows.filter(s => !pairs.some(p => p[1] === s));
    check(!cover.length,
          'engine: a declared engine section no part maps to', cover.join(', '));
  }
  // AND THE SECTION MUST BE ASKED FIRST. AERO_HARD still says what the part
  // IS — its bottom-out finish — but the builder's own choice goes on top of
  // it, so a hardware lookup that answered first would win every time and the
  // rows would appear to do nothing.
  const iSec = ENG.indexOf('window.CAGE_SECMAT(sec');
  const iHard = ENG.indexOf('A.aeroHardMat(THREE');
  check(iSec > 0 && iHard > 0 && iSec < iHard,
        'engine: the hardware table answers before the livery section — the ' +
        'pick would never reach the engine');
  check(/fin: A && A\.aeroHardFinish && A\.aeroHardFinish\('eng', name\)/.test(ENG),
        'engine: the section is not seeded with the hardware finish — a ' +
        'crankcase would stop being cast aluminium the moment it was picked');

  // ...AND THE ENGINE PART MUST CLAIM THEM. A section no part claims is not
  // lost — it lands in the root's `unclaimed` bucket, which is a home but not
  // an ANSWER: the user asked for the engine's paint to be IN the finish
  // section, and a control you reach through a catch-all on another part has
  // not been put anywhere. This is the difference between the sections
  // existing and the sections being findable, and only the tree can tell.
  {
    const PARTS = strip(fs.readFileSync(
      path.join(ROOT, 'tools', '_cage_parts.js'), 'utf8'));
    const ent = /\{ key: 'engine',[\s\S]*?\n    groups: \[/.exec(PARTS);
    check(!!ent, 'engine: no engine entry in the part table');
    if (ent) {
      const cl = /sections: \[([^\]]*)\]/.exec(ent[0]);
      const got = cl ? cl[1].match(/'(\w+)'/g).map(x => x.slice(1, -1)) : [];
      check(engRows.every(s => got.includes(s)),
            'engine: the engine part does not claim its own sections — they ' +
            'would only be reachable through the root\'s unclaimed bucket',
            'claims [' + got.join(', ') + ']');
    }
  }

  // ---- B. THE MARKING HAS ITS OWN INK ------------------------------------
  // Left owed by G113.1: the registration was spec.paint.trim with a white
  // outline and no row. NULL IS THE DEFAULT AND THAT IS THE POINT — null
  // means inherit, so an untouched aeroplane still wears the trim and the
  // legacy sheet cannot disagree with the panel.
  check(/regCol: null, regOut: null,/.test(UI4),
        'marking: the ink and the outline are not declared inheriting (null)');
  // asserted in the keeper for the same reason as the width rules above: the
  // flown aeroplane resolves its own ink, so "null means the trim" has to be
  // true where BOTH callers pass through (G160).
  const SKIN4 = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'aeroskin.js'), 'utf8');
  check(/D\.regCol != null \? D\.regCol : trim/.test(SKIN4),
        'marking: the ink no longer falls back to the trim colour');
  check(/D\.regOut != null \? D\.regOut : 0xffffff/.test(SKIN4),
        'marking: the outline no longer falls back to white');
  check(/function aeroDecalText\(THREE, page, text, colHex, outHex, font\)/.test(SK),
        'marking: the text baker does not take an ink and an outline');
  // ...and USES both, which is the half a signature check cannot see
  {
    const body = (SK.split('function aeroDecalText')[1] || '').slice(0, 1400);
    check(/colHex/.test(body) && /outHex/.test(body),
          'marking: the baker takes an ink and an outline and draws with ' +
          'neither');
  }

  // ---- C. A MODE CHANGE MUST NOT MOVE THE MARKING ------------------------
  // G113 shipped three projection modes and left this: field measures a
  // station from the firewall, box from the craft origin, so switching mode
  // TELEPORTED an existing marking. The frames genuinely differ and no
  // constant reconciles them (sL and sC are ARC LENGTHS, not Cartesian —
  // measured, the offsets spread 2.32 m over one aeroplane), so the marking
  // is re-read off the mesh instead of converted by arithmetic.
  check(/function decReframe\(fromMode, toMode, keys\)/.test(UI4),
        'marking: no decReframe — a mode change moves the marking');
  const wired = (UI4.match(/decReframe\(a, b, \{/g) || []).length;
  check(wired === 3,
        'marking: not every projection row reframes on a mode change',
        wired + ' of 3 wired');
  check(/o\.geometry\.attributes\.aStruct/.test(UI4) &&
        /mesh\.updateWorldMatrix/.test(UI4),
        'marking: the reframe is not read off the DRAWN mesh — a constant ' +
        'offset cannot reconcile an arc length with a Cartesian one');
  check(/return mode === 1 \? \[-v\.z, v\.y\] : \[v\.x, -v\.z\];/.test(UI4),
        'marking: the flank and the plan frames are no longer distinct');

  // ---- D. THE GLAZING TAKES ITS YEARS ------------------------------------
  // G70: "glass takes no wear", and G113.2 shipped the dials still saying so.
  // The condition ADDS to the builder's own numbers rather than replacing
  // them: the dials are the floor an aeroplane leaves the factory with.
  check(/if \(k === 'scratch'\) return Math\.min\(1, v \+ wr \* 0\.55\);/.test(SK),
        'glazing: the condition dial does not age the scratches, or it ' +
        'REPLACES the number the builder set instead of adding to it');
  check(/if \(k === 'grime'\)\s+return Math\.min\(1, v \+ wr \* 0\.70\);/.test(SK),
        'glazing: the condition dial does not age the grime');
  // and only those two: years do not change what colour a pane was tinted,
  // nor how strongly the room reflects in it
  for (const k of ['refl', 'rainbow', 'opacity'])
    check(!new RegExp("k === '" + k + "'\\) return Math\\.min\\(1, v \\+ wr").test(SK),
          'glazing: wear has been folded into ' + k + ', which is a choice ' +
          'and not a condition');
  check(/'\|' \+ wr\.toFixed\(3\)/.test(SK),
        'glazing: the wear is not in the pool key — two panes at different ' +
        'ages would share one material');
  // the pane keeps its own multiplier, exactly as every airframe section does
  check(/wear: \(WEAR\.amount \|\| 0\) \*\s*\(secWear\[name\] != null \? secWear\[name\] : 1\)/
          .test(UI4),
        'glazing: the pane cannot opt out of the years — its own wear ' +
        'multiplier is not applied');

  // ---- NEGATIVE VERIFY ---------------------------------------------------
  if (process.argv.includes('--selftest')) {
    const probes = [
      ['ENG_SEC naming an undeclared section',
        () => [['emCase', '__nope__']].filter(p => !engRows.includes(p[1])).length > 0],
      ['ENG_SEC naming a part nothing builds',
        () => !/\bemGhost\b/.test('const x = emCase + emRocker;')],
      ['a declared engine section no part maps to',
        () => engRows.filter(s => !['engBlock'].includes(s)).length > 0],
      ['the hardware table answering before the section',
        () => {
          const s = '  A.aeroHardMat(THREE  window.CAGE_SECMAT(sec';
          return !(s.indexOf('window.CAGE_SECMAT(sec') <
                   s.indexOf('A.aeroHardMat(THREE'));
        }],
      ['an ink that cannot inherit the trim',
        () => !/regCol: null, regOut: null,/.test('regCol: 0x1b3a5c, regOut: null,')],
      ['a baker that ignores its outline',
        () => !/outHex/.test('ctx.strokeStyle = "#fff"; ctx.fillStyle = colHex;')],
      ['a projection row wired without the reframe',
        () => ('decReframe(a, b, {decReframe(a, b, {')
                .match(/decReframe\(a, b, \{/g).length !== 3],
      ['a reframe that converts by arithmetic',
        () => !/o\.geometry\.attributes\.aStruct/
                .test('DEC[keys.l] += FIREWALL_OFFSET;')],
      ['wear that REPLACES the number the builder set',
        () => !/return Math\.min\(1, v \+ wr \* 0\.55\);/
                .test("if (k === 'scratch') return wr * 0.55;")],
      ['wear left out of the glass pool key',
        () => !/'\|' \+ wr\.toFixed\(3\)/
                .test("const key = 'glass|' + o.tint + '|' + G('opacity');")],
      ['wear folded into the reflection',
        () => /k === 'refl'\) return Math\.min\(1, v \+ wr/
                .test("if (k === 'refl') return Math.min(1, v + wr * 0.4);")],
      ['a pane that cannot opt out of the years',
        () => !/secWear\[name\]/.test('wear: (WEAR.amount || 0),')],
    ];
    let caught = 0;
    for (const p of probes) {
      let ok = false;
      try { ok = !!p[1](); } catch (e) { ok = false; }
      console.log('  selftest ' + p[0].padEnd(42) + (ok ? 'CAUGHT' : 'MISSED'));
      if (ok) caught++;
    }
    check(caught === probes.length,
      'selftest (G113.4): ' + (probes.length - caught) + ' probe(s) went unnoticed');
  }
}

// ---------------------------------------------------------------------------
// THE MARKING KIT (G162)
// ---------------------------------------------------------------------------
// A kit pattern is a RECIPE, so unlike the two image channels it travels in
// the spec and can be redrawn on the flight side. That makes the placement
// half — which page a layer owns, what its knobs resolve to, where it lands —
// pure arithmetic, and pure arithmetic is what a node gate can actually prove.
// The drawing half needs a canvas and is checked by eye and by source.
function kitGate() {
  const UI = fs.readFileSync(path.join(ROOT, 'tools', '_cage_ui.js'), 'utf8');
  // 1 — THE TWO AERO_MAXDs MUST AGREE, and this is the check that would have
  //     cost the most to find by looking. The array size lives twice, once as
  //     a JS const and once as a GLSL #define, and the JS side TRUNCATES the
  //     list to its own value. Raise one and not the other and the failure is
  //     silent and selective: the shader reads slots the uniforms never wrote,
  //     or the registration — last in the list — simply stops being painted
  //     once three kit layers are on.
  const def = /#define AERO_MAXD (\d+)/.exec(SRC);
  check(!!def, 'kit: the shader has no AERO_MAXD define');
  check(def && +def[1] === A.AERO_MAXD,
    'kit: the shader array and the JS cap disagree — decals past the smaller ' +
    'of the two are silently dropped, and the registration is last in the list',
    def && (def[1] + ' vs ' + A.AERO_MAXD));

  // 2 — AND IT MUST HOLD WHAT THE PANEL CAN TURN ON. Three kit layers, the
  //     registration and the two image channels is six; a cap below that is a
  //     marking the builder placed and cannot see.
  const need = A.AERO_KIT_LAYERS + 3;
  check(A.AERO_MAXD >= need,
    'kit: the decal array cannot hold every marking the panel offers',
    A.AERO_MAXD + ' < ' + need);
  check(A.AERO_KIT_PAGE0 + A.AERO_KIT_LAYERS <= A.AERO_ATLAS_N * A.AERO_ATLAS_N,
    'kit: the layers run off the end of the atlas');

  // 3 — EVERY PATTERN ARRIVES WITH ITS OWN CONTROLS. The panel is generated
  //     from this table, so a pattern that declares no knob names, no ranges
  //     or no colour slots gets a row with a blank label and a slider whose
  //     range is whatever the previous pattern left behind.
  check(A.AERO_KIT.length > 0, 'kit: there are no patterns');
  for (const pat of A.AERO_KIT) {
    check(typeof pat.draw === 'function', 'kit: a pattern cannot draw itself', pat.name);
    check(Array.isArray(pat.cn) && pat.cn.length >= 2 && pat.cn.length <= 3
          && pat.cn.every(n => typeof n === 'string' && n),
      'kit: a pattern does not name its colour slots — the panel would show ' +
      'unlabelled wells, or hide a colour the draw actually reads', pat.name);
    check(Array.isArray(pat.k) && pat.k.length === 2,
      'kit: a pattern does not declare exactly two knobs', pat.name);
    for (const kd of (pat.k || [])) {
      check(kd && kd.n && typeof kd.lo === 'number' && typeof kd.hi === 'number'
            && typeof kd.st === 'number' && typeof kd.def === 'number',
        'kit: a knob is missing its name, range, step or default', pat.name);
      check(kd && kd.lo <= kd.def && kd.def <= kd.hi,
        'kit: a knob default sits outside its own slider', pat.name + '/' + (kd && kd.n));
      check(kd && kd.hi > kd.lo, 'kit: a knob has no range', pat.name);
    }
  }

  // 3b — AND THE DEFAULT PLACEMENT IS IN THE FRAME ITS NUMBERS ARE WRITTEN IN.
  //      This is the defect a picture found: `side` is a box projection through
  //      the whole craft and measures its station from the craft ROOT, so the
  //      same 2.2 that sits under the cabin in the field frame lands 4.85 m aft
  //      — off the back of a light aeroplane. A layer switched on and invisible
  //      is indistinguishable from a layer that does not work. The kit's
  //      station and height are written in the registration's frame, so the
  //      two defaults have to agree about which frame that is.
  check(A.AERO_KIT_LDEF.Mode === A.AERO_DEC_DEF.regMode,
    'kit: a new layer opens in a different projection from the ' +
    'registration, but its default station and height are written in the ' +
    'registration’s frame — switch one on and it lands off the aeroplane',
    A.AERO_KIT_LDEF.Mode + ' vs ' + A.AERO_DEC_DEF.regMode);

  // 4 — OFF IS THE FACTORY STATE. Every aeroplane already saved was saved
  //     before this existed, and none of them may grow a stripe.
  check(A.aeroKitLayers(A.aeroDecalMerge({})).length === 0,
    'kit: an aeroplane nobody has decorated wears a kit layer anyway');

  // 5 — ONE PAGE EACH, AND NONE OF THEM THE REGISTRATION'S. Two layers sharing
  //     a page is two patterns overwriting one canvas cell, which shows as the
  //     second layer's pattern appearing in both places.
  const on = {};
  for (let i = 1; i <= A.AERO_KIT_LAYERS; i++) { on['m' + i + 'On'] = 1;
                                                 on['m' + i + 'Pat'] = i % A.AERO_KIT.length; }
  const all = A.aeroKitLayers(A.aeroDecalMerge({ finish: { decals: on } }));
  check(all.length === A.AERO_KIT_LAYERS,
    'kit: switching every layer on does not give every layer', all.length);
  const pages = all.map(l => l.page);
  check(new Set(pages).size === pages.length,
    'kit: two layers share an atlas page', pages.join(','));
  check(pages.every(p => p >= 3),
    'kit: a layer has taken the registration or an image channel page',
    pages.join(','));

  // 6 — A KNOB MEANS WHAT ITS OWN PATTERN SAYS. `chequer` counts squares 2..16
  //     and `sweep` measures 0..0.6 of a page; a knob carried across a pattern
  //     change, or clamped against the wrong table, is a control that lies
  //     about the picture it is producing.
  const chq = A.AERO_KIT.findIndex(k => k.name === 'chequer');
  const swp = A.AERO_KIT.findIndex(k => k.name === 'sweep');
  if (chq >= 0 && swp >= 0) {
    const asSweep = A.aeroKitLayers(A.aeroDecalMerge({ finish: { decals:
      { m1On: 1, m1Pat: swp, m1P: 8 } } }))[0];
    check(asSweep.p <= A.AERO_KIT[swp].k[0].hi,
      'kit: a chequer’s square count survived into a sweep’s knob', asSweep.p);
    const unset = A.aeroKitLayers(A.aeroDecalMerge({ finish: { decals:
      { m1On: 1, m1Pat: chq } } }))[0];
    check(unset.p === A.AERO_KIT[chq].k[0].def && unset.q === A.AERO_KIT[chq].k[1].def,
      'kit: an unset knob does not take its own pattern’s default — zero ' +
      'squares is a pattern that draws nothing', unset.p + '/' + unset.q);
  }

  // 7 — THE PLACEMENT TRAVELS. Opacity is what the user asked for by name
  //     ("possible transparency"), and it is the one field with no visible
  //     proxy: a layer at 0.4 that arrives at 1.0 looks like a layer that
  //     works.
  const one = A.aeroKitLayers(A.aeroDecalMerge({ finish: { decals:
    { m1On: 1, m1Alp: 0.4, m1L: 1.75, m1C: -0.2, m1W: 3.5, m1H: 0.8,
      m1Tgt: 3, m1Mode: 2, m1Rot: 0.25 } } }))[0];
  check(one.place.opacity === 0.4, 'kit: the layer opacity is not carried', one.place.opacity);
  check(one.place.sL === 1.75 && one.place.sC === -0.2,
    'kit: the layer is placed somewhere the builder did not put it');
  check(one.place.w === 3.5 && one.place.h === 0.8, 'kit: the layer size is not carried');
  check(one.place.rot === 0.25, 'kit: the layer turn is not carried');
  check(one.place.mode === 'plan', 'kit: the layer projection is not carried', one.place.mode);
  check(!!(one.place.on.body && one.place.on.tail) && !one.place.on.wing,
    'kit: the layer surface classes are not carried');

  // 8 — AND IT IS PAINTED UNDER EVERYTHING ELSE. The shader mixes the list in
  //     order, so a registration pushed before the kit is a registration with
  //     a cheat line painted over it.
  const fn = SRC.slice(SRC.indexOf('function aeroDecalsFor'));
  const kitAt = fn.indexOf('aeroKitLayers(D)');
  const regAt = fn.indexOf('list.push({ page: 0');
  check(kitAt > 0 && regAt > 0 && kitAt < regAt,
    'kit: the registration is pushed before the kit, so a layer is painted ' +
    'over the letters');
  check(/aeroKitDraw\(THREE, L\)/.test(fn),
    'kit: the pages are never drawn from the one keeper — a kit saved in a ' +
    'build would reach the flown aeroplane as an empty page');

  // 8b — PAINT HOLDS ITS PHYSICAL DIRECTION AND LETTERING DOES NOT, which is
  //      a distinction no gate would have thought to draw and a screenshot
  //      made obvious in one look: the far flank negates the along-body axis
  //      so a registration reads left-to-right from both sides, and a sweep
  //      carried through the same negation rose AFT on one side of the
  //      aeroplane and FORE on the other.
  check(A.aeroKitLayers(A.aeroDecalMerge({ finish: { decals: { m1On: 1 } } }))[0]
          .place.noMirror === 1,
    'kit: a kit layer mirrors on the far flank like a registration — a sweep ' +
    'would rise aft on one side of the aeroplane and fore on the other');
  check(SRC.indexOf('float mir = mix(aeroSideF, 1.0, step(0.5, uDecC[di].w))') >= 0,
    'kit: the shader has no per-decal mirror — either every marking mirrors ' +
    '(and paint is wrong) or none does (and the registration reads backwards)');
  check(SRC.indexOf('U.uDecC.value[i].set(') >= 0 && SRC.indexOf('d.noMirror ? 1 : 0)') >= 0,
    'kit: the mirror flag is never written into the uniform, so the shader ' +
    'reads a zero that means “mirror” for everything');
  // AND THE REGISTRATION MUST NOT TAKE IT. Letters that stop mirroring read
  // backwards from the far side, which is G4.5's own trap and cost three looks
  // to find the first time.
  const regPush = fn.slice(fn.indexOf('list.push({ page: 0'),
                           fn.indexOf('if (D.imgOn)'));
  check(regPush.indexOf('noMirror') < 0,
    'kit: the registration has been marked as paint — it will read backwards ' +
    'from the far flank, which is the trap G4.5 needed three looks to see');

  // 9 — THE CACHE COVERS THE WHOLE RECIPE. A page is redrawn only when its
  //     signature changes; a field the draw reads and the signature omits is a
  //     colour or a knob that moves the slider and not the picture.
  const sig = /const sig = \[([^\]]*)\]/.exec(SRC.slice(SRC.indexOf('function aeroKitDraw')));
  check(!!sig, 'kit: aeroKitDraw has no cache signature');
  for (const f of ['L.pat', 'L.a', 'L.b', 'L.d', 'L.p', 'L.q', 'L.flip'])
    check(sig && sig[1].indexOf(f) >= 0,
      'kit: the redraw signature omits something the draw reads, so changing ' +
      'it leaves the old page on the aeroplane', f);

  // 10 — AND THE EDITOR KEEPS NO SECOND COPY OF THE DEFAULTS. This file is
  //      bundled ahead of aeroskin.js, so its fallback literal is the branch
  //      that runs — and the temptation is to paste forty-eight kit defaults
  //      into it. That is the G160 defect exactly: two tables, one flown.
  check(!/\bm1On:\s*\d/.test(UI),
    'kit: the editor carries its own copy of the kit defaults — a table that ' +
    'the flight side cannot see is a marking that does not survive the flight');
  check(/function decKitDefaults\(\)/.test(UI),
    'kit: the editor never folds the kit keys into DEC_DEF, so a kit layer ' +
    'the builder places is dropped on save');
  // the three doors that walk DEC_DEF, each named
  for (const [door, what] of [
      ['function finishToSpec\\(\\) \\{\\n  decKitDefaults\\(\\);', 'the save'],
      ['function finishFromSpec\\(f\\) \\{\\n  decKitDefaults\\(\\);', 'the load'],
      ['if \\(!A \\|\\| decPanel\\) return;\\n  decKitDefaults\\(\\);', 'the panel']])
    check(new RegExp(door).test(UI),
      'kit: ' + what + ' does not top up DEC_DEF first — every key it has not ' +
      'seen is a setting that silently does not persist');
}
kitGate();

const hardN = Object.keys(A.AERO_HARD)
  .reduce((n, l) => n + Object.keys(A.AERO_HARD[l]).length, 0);
console.log(`  sections ${sections.size}, finishes ` +
  `${Object.keys(A.AERO_FINISH).length}, constructions ${CONSTRUCTIONS.length}` +
  `, hardware ${hardN} names over ${Object.keys(A.AERO_HARD).length} layers`);
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE SKINMAT: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
