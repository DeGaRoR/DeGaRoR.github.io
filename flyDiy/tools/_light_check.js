#!/usr/bin/env node
// _light_check.js — GATE LIGHT.
//
// WHY THIS GATE EXISTS. "The aeroplane is lit from below" has been reported
// THREE times, and closed three times by finding one culprit:
//
//   G62.7  "still something is lighting up the airplane"   -> the stove: a
//          THREE.Light nobody held a reference to. 52% of the night frame,
//          0.6 m off the floor.
//   G65    "when I turn everything off, I still have the bottom light"
//          -> lamp_desk: an emissive MATERIAL. Not a Light at all, so no
//          switch could see it.
//   this   "the plane is lit from the bottom ... the yellow one"
//          -> the aeroplane's own wing, filling the lower hemisphere of the
//          room's reflection probe. Not an object in any list; an ENVIRONMENT.
//
// Three reports, three different KINDS of source, three one-off fixes. Every
// one of those verdicts was measured by hand in a live page and written into
// HANDOVER, and not one of them could be re-run. That is why it kept coming
// back: the fix each time covered the kind that had just been found.
//
// So this gate does not check that the lighting looks right. It checks the
// things that let a source hide:
//   1. THE CONTRACT — one place decides exposure, the light model and the
//      ground-bounce term, and the rooms apply it.
//   2. THE CENSUS — the scene-graph audit can see all three kinds, and says
//      so when something emitting is not claimed by a switch.
//   3. THE SWITCHBOARD — every declared source has an action that mutes it,
//      and "all off" is one operation rather than seven.
//   4. THE FIXES THEMSELVES, as source assertions: the specific lines whose
//      removal reproduces a bug this project has already paid for.
//
// What it does NOT do is measure pixels: that needs a GPU and a browser, and
// there is none in the battery. The measurement lives in tools/_light_probe.js
// and is run against a served page (see the FOOT of this file for the recipe).
// This gate guards the structure that measurement depends on.
'use strict';
const fs = require('fs');
const path = require('path');

const V = path.join(__dirname, '..', 'src', 'viewer');
const read = f => fs.readFileSync(path.join(V, f), 'utf8').replace(/\r/g, '');
// CRLF FIRST, ALWAYS. GATE SKINMAT failed on its own documentation once
// because the files are CRLF and JS's `.` does not match `\r`; one of the
// files this gate reads currently has DOUBLED carriage returns. Normalise
// before matching anything, or a passing rule silently stops matching.

const fail = [];
const check = (ok, label) => { if (!ok) fail.push(label); return ok; };

// ---------------------------------------------------------------- 1. contract
const rigSrc = read('light_rig.js');
const RIG = require(path.join(V, 'light_rig.js'));

check(typeof RIG.applyRig === 'function', 'LIGHT_RIG.applyRig missing');
check(typeof RIG.board === 'function', 'LIGHT_RIG.board missing');
check(typeof RIG.census === 'function', 'LIGHT_RIG.census missing');
check(typeof RIG.groundBounce === 'function', 'LIGHT_RIG.groundBounce missing');
// THE BOUND MOVED, AND WHO MOVED IT (2026-08-31). This read `< 1`, and its
// message said why: 1 is the unoccluded half-dome of lit floor, which is the
// belly-glow the G94 occlusion term was written to remove. The user overruled
// it on the look and set the default to 1, so the check follows — `<= 1`,
// which still catches the two things it was really guarding: a negative or
// absent term, and a term above unity, which would be a floor returning more
// light than falls on it. The physics argument stays in light_rig.js.
check(RIG.groundBounce() > 0 && RIG.groundBounce() <= 1,
      `ground bounce ${RIG.groundBounce()} is not a fraction — it is the ` +
      'share of the lit floor an aeroplane standing on it can see, so 0 < b <= 1');

// ---------------------------------------------------------------- 2. census
// A SYNTHETIC SCENE with one of each kind, two of them unclaimed. The census
// has to find all three: this is the assertion that would have failed before
// G62.7 (a Light), before G65 (an emissive material), and before this chantier
// (an unlit MeshBasicMaterial, the kind nothing could ever dim).
{
  const mk = (o) => Object.assign({ visible: true, parent: null, children: [] }, o);
  const light = mk({ isLight: true, type: 'PointLight', position: { y: 0.6 }, intensity: 14 });
  const emisMat = { emissive: { r: 1, g: 0.9, b: 0.6 }, emissiveIntensity: 1, name: 'lamp_desk' };
  const emisMesh = mk({ isMesh: true, material: emisMat });
  const unlitMat = { isMeshBasicMaterial: true, name: 'skyBackdrop' };
  const unlitMesh = mk({ isMesh: true, material: unlitMat });
  const exemptMat = { isMeshBasicMaterial: true, name: 'view',
                      userData: { lightExempt: 'the view outside' } };
  const exemptMesh = mk({ isMesh: true, material: exemptMat });
  const all = [light, emisMesh, unlitMesh, exemptMesh];
  const scene = mk({ traverse(f) { f(this); all.forEach(f); } });

  const none = RIG.census(scene, new Set());
  check(none.lights.length === 1, 'census missed the THREE.Light (the G62.7 kind)');
  check(none.emissive.length === 1, 'census missed the emissive material (the G65 kind)');
  check(none.unlit.length === 1, 'census missed the unlit MeshBasicMaterial');
  check(none.unclaimed.length === 3,
        `census flagged ${none.unclaimed.length} unclaimed, want 3`);
  check(!none.unclaimed.some(u => u.name === 'view'),
        'census flagged an explicitly exempt source — the exemption is how the ' +
        'sky through the glazing stays honest instead of being fudged');

  const claimed = RIG.census(scene, new Set([light, emisMat, unlitMat]));
  check(claimed.unclaimed.length === 0,
        'census flagged a source that IS claimed by a switch');
}

// ---------------------------------------------------------------- 3. switchboard
{
  const hits = [];
  const b = RIG.board('test')
    .declare('a', 'A', 'light', () => hits.push('a'))
    .declare('b', 'B', 'emissive', () => hits.push('b'))
    .declare('c', 'C', 'unlit', () => hits.push('c'));
  check(b.list().length === 3, 'board lost a declared source');
  check(b.on('a') === true, 'a source is muted before anything muted it');

  b.allOff(); hits.length = 0; b.apply();
  check(hits.length === 3, `allOff+apply fired ${hits.length} mutes, want 3 — ` +
        'a switch with no action is a switch that does nothing');

  b.allOn(); hits.length = 0; b.apply();
  check(hits.length === 0, 'allOn still fired a mute');

  b.only('b'); hits.length = 0; b.apply();
  check(hits.join(',') === 'a,c', `only('b') muted [${hits}] — want a,c`);

  check(b.set('nope', false) === null, 'board accepted an undeclared key');
}

// ---------------------------------------------------------------- 4. the fixes
// Each of these is a line whose removal reproduces a bug that has already cost
// this project a session. They are read out of the source, never copied.
const app = read('app.js');
const world = read('render_world.js');
const shed = read('hangar.js');

// 4a. THE SUBJECT IS NOT IN ITS OWN PROBE. This is the bug that named the
// chantier. G62.3 excluded `craft`; the aeroplane you actually see in the
// garage is the EDITOR'S CAGE on its own mount, which no exclusion covered, so
// a lit 10 m wing one metre under the cube camera became the room's ambient
// and lit its own underside. Measured at NIGHT: belly 287% of the wing's own
// top surface with the cage in the probe, 3.4% with it out.
{
  const bake = app.slice(app.indexOf('function bakeHangarEnv'),
                         app.indexOf('function setEnvSource'));
  check(bake.length > 200, 'could not find bakeHangarEnv to check');
  const sub = /const\s+subjects\s*=\s*\[([^\]]*)\]/.exec(bake);
  check(!!sub, 'bakeHangarEnv no longer declares a `subjects` list — the room ' +
               'probe is bakeable with the aeroplane standing in it again');
  if (sub) {
    for (const name of ['craft', 'edSit', 'refSit'])
      check(sub[1].includes(name),
            `bakeHangarEnv excludes ${sub[1].trim()} — \`${name}\` is not among ` +
            'them, so that subject lights itself through the environment');
    check(/subjects\.forEach\([^)]*visible\s*=\s*false/.test(bake) ||
          /subjects\.forEach\(o\s*=>\s*\{[^}]*visible\s*=\s*false/.test(bake),
          'the subjects list is declared but never hidden for the bake');
  }
  check(/cam\.position\.set\(0,\s*3\.2,\s*0\)/.test(bake),
        'the probe moved: re-measure the belly before trusting this gate');
}

// 4b. THE PROBE IS RE-BAKED WHEN A SWITCH MOVES. The environment is a
// photograph of the room taken under whatever lights were on at the time.
// Without this, muting the lamps leaves their light in the picture — the room
// stays lit by a lamp that is visibly off. It produced a FALSE ABLATION
// reading during this chantier before it was found.
// Sliced, not span-matched: the explanation this line needed is longer than
// any sane regex window, and a rule that silently stops matching when someone
// writes a comment is worse than no rule.
const setLightBody = (src) => {
  const i = src.indexOf('setLight: (k, on)');
  return i < 0 ? '' : src.slice(i, src.indexOf('\n    },', i));
};
check(/bakeHangarEnv\(\)/.test(setLightBody(app)),
      'GARAGE_ENV.setLight no longer re-bakes the probe — a muted source stays ' +
      'baked into the environment and the switch is a lie');

// 4c. THE AEROPLANE DOES NOT FLY OUT REFLECTING THE SHED. Every mood scales
// its envMapIntensity for the room's probe (AFTERNOON runs x2.2) and nothing
// used to put it back. Measured after rolling out: 2.20 against an authored
// 1.0, pointed at a completely different environment. That is "washed out".
{
  const roll = app.slice(app.indexOf('function rollOut'),
                         app.indexOf('function rollOut') + 2200);
  check(/aeroSetEnv\(\s*WORLD_ENV\s*\)/.test(roll),
        'rollOut no longer resets the aeroplane\'s envMapIntensity for the world');
  const we = /const\s+WORLD_ENV\s*=\s*([\d.]+)/.exec(app);
  check(!!we && +we[1] > 0 && +we[1] <= 1,
        'WORLD_ENV is missing or not a fraction — the world counts the sky ' +
        'twice for Standard materials (hemisphere AND probe), so it is not 1');
}

// 4d. THE WORLD'S RIG IS DECLARED ONCE. render_world builds the same hemi+sun
// pair twice: once for the world, once for the tree-impostor bake, which
// freezes it into an atlas drawn as an UNLIT MeshBasicMaterial. Edit one and
// the far forest stays lit for a world that no longer exists — silently, and
// with nothing downstream able to tell you.
{
  const hemis = world.match(/new THREE\.HemisphereLight\(/g) || [];
  check(hemis.length === 1,
        `render_world constructs ${hemis.length} HemisphereLights — there must ` +
        'be exactly one, inside the shared factory, or the impostor bake and ' +
        'the world it stands in will drift apart');
  check(/const RIG = \{[^}]*sun:/.test(world), 'the world RIG object is gone');
  const uses = world.match(/RIG\.sun/g) || [];
  check(uses.length >= 2,
        `RIG.sun is read ${uses.length} time(s) — the impostor bake is supposed ` +
        'to read the same value the world does, not a copy of it');
  check((world.match(/hemiLight\(\)/g) || []).length >= 2,
        'the impostor bake no longer uses the world\'s own hemisphere factory');
}

// 4e. EVERY AMBIENT-FROM-BELOW IS OCCLUDED. The world stacked TWO independent
// uplights on the aeroplane's belly — the hemisphere's groundColor and the
// environment's solid ground cap — and neither knew about the other. Measured
// on the wing in flight, the belly came back RGB (14, 60, 34): green, from a
// light that is a flat colour and never moves.
check(/groundColor\.multiplyScalar\(gb\)/.test(world),
      'the world hemisphere\'s ground term is no longer occluded');
check(/C\(0x6d7a45\)\.multiplyScalar\(gb\)/.test(world),
      'the world environment\'s ground cap is no longer occluded');
check(/LIGHT_RIG\.groundBounce\(\)/.test(world) &&
      /LIGHT_RIG\.groundBounce\(\)/.test(app),
      'a room is deciding its own ground bounce instead of applying the rig\'s');

// 4f. THE SHED'S SWITCH LIST COVERS ALL THREE KINDS, and every switch has an
// action. A list is what was wrong every previous time.
{
  const m = /const LIGHTS = \[([\s\S]*?)\n\];/.exec(shed);
  check(!!m, 'hangar LIGHTS table not found');
  if (m) {
    const keys = [...m[1].matchAll(/key:\s*'([a-z]+)'/g)].map(x => x[1]);
    const kinds = new Set([...m[1].matchAll(/kind:\s*'([a-z]+)'/g)].map(x => x[1]));
    for (const k of ['light', 'emissive', 'unlit', 'env'])
      check(kinds.has(k), `no shed source is declared kind '${k}' — the ` +
            'switchboard cannot be complete for a kind it does not name');
    check(keys.includes('sky'),
          'the shed has no switch for the backdrop — it is a MeshBasicMaterial, ' +
          'lit by nothing and dimmable by nothing, so "all off" cannot reach black');
    const mutes = shed.slice(shed.indexOf('function applyMutes'),
                             shed.indexOf('function setLight'));
    for (const k of keys)
      check(new RegExp(`muted\\.${k}\\b`).test(mutes) ||
            new RegExp(`muted\\[e\\.key\\]`).test(mutes),
            `switch '${k}' is declared but applyMutes never acts on it`);
    check(/skyMesh\.visible = !muted\.sky/.test(mutes),
          'the backdrop is muted but never restored — an unlit source that is ' +
          'only ever hidden can never be switched back on');
  }
  check(/function setLights\(/.test(shed),
        'the shed has no master switch: "start from nothing and add one back" ' +
        'is seven clicks and seven chances to leave one on');
  check(/claimed:/.test(shed), 'the shed no longer publishes what its switches reach');
}

// 4g. THERE IS NO SECOND, UNCONTROLLED ROOM. The studio was a white void with
// a full-strength hemisphere, a warm fill and a bright-floored dome, none of
// it switchable, reachable only as a silent fallback.
check(!/new THREE\.Scene\(\)[\s\S]{0,200}studio/.test(app) && !/\bstudio\./.test(app),
      'the studio is back — a second light rig with no switches, entered by ' +
      'accident when the hangar fails to build');

// ---------------------------------------------------------------------------
// 5. THE AEROPLANE'S OWN LAMPS (2026-08-31, four items from the user's second
//    review). Source rules, in this file's own idiom: each names a behaviour
//    that is invisible from a number and silent when it rots.
// ---------------------------------------------------------------------------
{
  // `read` is rooted at src/viewer; the cage layers live in tools/, and they
  // are CRLF like everything else here — same normalisation, same reason.
  const lit = fs.readFileSync(path.join(__dirname, '_cage_light.js'), 'utf8')
                .split(String.fromCharCode(13)).join('');

  // 5a. THE BEACON IS SEATED, NOT STRADDLING. It used to put the fairing's
  // centre ON the fin's fitted top line — measured, 286 of 633 of its vertices
  // ended up under the fin's own top edge, buried up to 26 mm, and with
  // DoubleSide on the lodge and the lens that is the red light showing THROUGH
  // the fin the user reported.
  check(/sink:\s*beaconSink/.test(lit),
        'the beacon site no longer declares a sink — the fairing is back to ' +
        'straddling the fin, which is what "the light renders through the ' +
        'dorsal fin" looked like');
  check(/const sink = site\.sink == null \? 0\.5 : site\.sink;/.test(lit),
        'the pod branch lost its sink default — a site that does not declare ' +
        'one must keep the OLD behaviour, or every wingtip light moves');
  check(/const lift = high \* \(0\.5 - sink\)/.test(lit),
        'the fairing is no longer lifted off the surface it sits on');

  // 5b. AND THE ROTOR GOES WITH IT. The mirror is a child group positioned
  // independently; leaving it at site.p sweeps it inside the fin while the
  // dome stands on top — a fault that reads exactly like the one just fixed.
  check(/rot\.position\.set\(seat\[0\], seat\[1\], seat\[2\]\)/.test(lit),
        'the beacon rotor is placed at the SITE and not at the seated fairing ' +
        '— the mirror sweeps inside the fin while the dome stands proud');

  // 5c. THE CABIN LAMPS ASK THE CAGE WHERE ITS CEILING IS. `spec.cabin.roofY`
  // is a fuselage number and always was — but on a HIGH wing the wing sits AT
  // the deck, so a lamp at the roof line and the wing are in the same place
  // and the lamp reads as hung off the wing. Measuring the built ceiling is
  // what makes it right for a high wing, a low wing and a parasol alike.
  check(/const ceilAt = \(x, z, rad\) =>/.test(lit),
        'the cabin lamps no longer measure the ceiling they hang from');
  // G296: THE LADDER. A cabin lamp mounts on the first real structure its
  // cabin's top offers — roof face, ceiling-loop rail, windscreen header,
  // canopy arch, coaming — and a seat with none gets NO lamp: the G94
  // fallback to the spec's roof line hung a dome in the middle of a
  // skylight, so a lamp position may never come from `A.roofY` again.
  check(/const LADDER = \{[\s\S]*?flood: \[\[roofAt, frameAt\], \[headerAt, frameAt\], \[coamingAt\], \[archAt, coamingAt\]\]/.test(lit),
        'the cabin lamps no longer climb the mounting ladder per cabin top (closed / convertible / open / bubble)');
  check(/const mountAt = \(kind, s\) =>/.test(lit) && /mountAt\('flood', pilot\)/.test(lit) && /mountAt\('pax', s\)/.test(lit),
        'the flood or the passenger lamps stopped using the mounting ladder');
  check(!/cl \? cl\.y : A\.roofY/.test(lit) && !/\(cl \? cl\.y : A\.roofY\)/.test(lit),
        'a cabin lamp position falls back to the spec roof line again — that is the dome in the skylight');
  check(/const sink = kind => 0\.62 \* \(LIGHTS\[kind\]\.w \/ 2\)/.test(lit),
        'the cabin lamps no longer sink their flange into the structure they mount on');
  check(/Math\.abs\(ny \/ nl\) < 0\.55/.test(lit),
        'the ceiling search no longer checks the face NORMAL: `body` is the ' +
        'whole fuselage skin, so a high side panel passes for a roof and the ' +
        'lamp is screwed to the cabin wall (measured: 269 mm low)');
  check(/q\.y > crown - 0\.06/.test(lit),
        'the ceiling search stopped preferring the liner under the crown');

  // 5d. THE REFLECTOR IS LIT BY THE BULB IT SURROUNDS, and the proud fitting
  // has a reflector at all — `PROF.cup` existed and was used only by the
  // recessed wing lamp and the beacon's mirror, so the ceiling flood was a
  // bulb standing in a bare barrel.
  check(/function cupMat\(/.test(lit),
        'the lit-reflector material is gone — a dark reflector under a lit ' +
        'bulb is what the user asked to have fixed');
  check(/revolveInto\(cup, /.test(lit),
        'the proud fitting has no reflector: PROF.can is a HOUSING, and the ' +
        'bowl is PROF.cup');
  check(/emissiveIntensity: lv \* 0\.55/.test(lit),
        'the reflector no longer follows the lamp dimmer, or it is at parity ' +
        'with the lens — at parity the cup reads as a second bulb');
  check(/cupMats\[id\]/.test(lit),
        'the reflector material is not pooled — one material per lamp per ' +
        'dim step is a new program every time a slider moves');

  // 5e. THE PLACEMENT ROWS ARE REAL ROWS, not literals with a comment.
  for (const k of ['li_beaconSink', 'li_navSpan', 'li_navChord', 'li_navRise',
                   'li_podLen', 'li_podGirth', 'li_reflect'])
    check(lit.indexOf("'" + k + "'") >= 0 && lit.indexOf(k + ':') >= 0,
          k + ' is not both declared and offered — a default with no row is ' +
          'unreachable, and a row with no default reads NaN');
  check(/wb\.max\.x - navSpan/.test(lit) && /tipR\.zLE - navChord/.test(lit),
        'the wingtip nav is back to inline literals for its own position');
  check(/Number\.isFinite\(v\) \? Math\.max\(lo, Math\.min\(hi, v\)\) : d/.test(lit),
        'the placement rows are not clamped: a stale save reaches the ' +
        'geometry as NaN and the fitting vanishes');
}

// ---------------------------------------------------------------- selftest
// THE G48 RULE: a gate that has never failed has not been tested. Each probe
// breaks one thing this file claims to guard; every one must be CAUGHT.
if (process.argv.includes('--selftest')) {
  console.log('  --- selftest ---');
  const probes = [
    ['probe excluded only craft', app,
      s => s.replace(/const subjects = \[craft, edSit, refSit\]/,
                     'const subjects = [craft]'),
      s => { const b = s.slice(s.indexOf('function bakeHangarEnv'),
                               s.indexOf('function setEnvSource'));
             const m = /const\s+subjects\s*=\s*\[([^\]]*)\]/.exec(b);
             return !m || !m[1].includes('edSit'); }],
    ['switch does not re-bake', app,
      s => s.replace(/if \(k !== 'env'\) bakeHangarEnv\(\);/, ''),
      s => !/bakeHangarEnv\(\)/.test(setLightBody(s))],
    ['craft flies out with the shed\'s env', app,
      s => s.replace(/aeroSetEnv\(WORLD_ENV\)/, 'void 0'),
      s => { const r = s.slice(s.indexOf('function rollOut'),
                               s.indexOf('function rollOut') + 2200);
             return !/aeroSetEnv\(\s*WORLD_ENV\s*\)/.test(r); }],
    ['impostor bake grows its own hemisphere', world,
      s => s.replace('      sc.add(hemiLight());',
                     '      sc.add(new THREE.HemisphereLight(C(0xbcd8f0), C(0x6a5a3c), 0.50));'),
      s => (s.match(/new THREE\.HemisphereLight\(/g) || []).length !== 1],
    ['world ground bounce un-occluded', world,
      s => s.replace('C(0x6d7a45).multiplyScalar(gb)', 'C(0x6d7a45)'),
      s => !/C\(0x6d7a45\)\.multiplyScalar\(gb\)/.test(s)],
    ['hemisphere ground term un-occluded', world,
      s => s.replace('h.groundColor.multiplyScalar(gb);', ''),
      s => !/groundColor\.multiplyScalar\(gb\)/.test(s)],
    ['the backdrop loses its switch', shed,
      s => s.replace(/\{ key: 'sky',[^}]*\}/, "{ key: 'nope', name: 'x', kind: 'unlit' }"),
      s => { const m = /const LIGHTS = \[([\s\S]*?)\n\];/.exec(s);
             return !m || !/key:\s*'sky'/.test(m[1]); }],
    ['the master switch goes', shed,
      s => s.replace('function setLights(', 'function setLightsX('),
      s => !/function setLights\(/.test(s)],
  ];
  let caught = 0;
  for (const [name, src, breakIt, detect] of probes) {
    const broken = breakIt(src);
    const changed = broken !== src;
    const noticed = changed && detect(broken);
    console.log(`  selftest ${name.padEnd(38)} ${noticed ? 'CAUGHT' : 'MISSED'}` +
                (changed ? '' : '  (probe did not bite — the rule it targets moved)'));
    if (noticed) caught++;
  }
  // the census's own failure mode, exercised for real
  const blind = RIG.census({ traverse(f) { f(this); } }, new Set());
  const emptyOK = blind.unclaimed.length === 0;
  console.log(`  selftest ${'census on an empty scene'.padEnd(38)} ` +
              `${emptyOK ? 'CAUGHT' : 'MISSED'}`);
  if (emptyOK) caught++;
  check(caught === probes.length + 1,
        `selftest: ${probes.length + 1 - caught} probe(s) went unnoticed`);
}

// ---------------------------------------------------------------- verdict
// counted off the TABLE, not off a loose match anywhere in the file — a
// summary line that reports a number nobody derived is the same class of thing
// this gate exists to stop
{
  const t = /const LIGHTS = \[([\s\S]*?)\n\];/.exec(shed);
  const shedKeys = t ? [...t[1].matchAll(/key:\s*'([a-z]+)'/g)].map(x => x[1]) : [];
  const worldKeys = [...world.matchAll(/\.declare\('([a-z]+)'/g)].map(x => x[1]);
  console.log(`sources: shed ${shedKeys.length} [${shedKeys.join(' ')}]` +
              `, world ${worldKeys.length} [${worldKeys.join(' ')}]` +
              `; ground bounce ${RIG.groundBounce()}`);
}
// THE PIXELS ARE NOT IN THIS GATE, and that is a limitation, not a decision:
// the battery has no GPU. To measure the thing this gate protects —
//   node flyDiy/tools/_serve.js 8125 ; node tools/make_probe.js
//   open tools/_probe.html, then in the page:
//     fetch('/flyDiy/tools/_light_probe.js').then(r=>r.text()).then(eval)
//     __lit.sweep()     // belly as a % of the wing's own top, every mood
//     __lit.ablate(4)   // NIGHT, from black, one source at a time
// A belly above ~25% of the top in any mood means it has come back.
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE LIGHT: FAIL');
  process.exit(1);
}
console.log('GATE LIGHT: PASS');
