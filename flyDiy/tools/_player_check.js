#!/usr/bin/env node
// ============================================================================
// GATE PLAYER — the player's property is ONE document with ONE contract.
// ============================================================================
// HANGARS S1 moved the shed out of browser prefs (flydiy.hangarDims,
// flydiy.hangarParts) into flydiy.player — a sibling document to the
// aeroplane's spec with its OWN version, because G105's ruling cuts both
// ways: state that is not the aeroplane costs no spec version, and property
// that is not a preference gets the same migration discipline the spec has
// (ruling 4: save compatibility is forever).
//
// What is held, in named blocks:
//   THE SHAPE        playerDefault() is a well-formed, round-trippable
//                    factory — two calls share nothing.
//   THE WALK         the migrator machinery works before its first real
//                    entry (G106's idiom: inject a throwaway, walk, remove).
//   THE LIFT         the two old pref values land verbatim, junk filtered.
//   THE VINTAGE SHELF a frozen save per vintage loads forever.
//   THE COMPOSITION  the default document composes to the site's declared
//                    dims — a fresh profile sees the gate-proven aerodrome.
//   THE WRITE-STOP   app.js never writes the old pref keys again, and view
//                    state was NOT swept into the document (G106: view state
//                    is not property).
//
// Negative-verified: --selftest breaks each rule and requires the matching
// check to fail. A gate that has never failed has never been tested.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');

const SELF = process.argv.includes('--selftest');
let fails = [], checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); return !!cond; };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol,
  msg + ' (' + a + ' vs ' + b + ', tol ' + tol + ')');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function run(mut) {
  fails = []; checks = 0;
  let srcA = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  if (mut && mut.srcA) srcA = mut.srcA(srcA);
  // the fixture set is readable through a hook so the selftest can doctor it
  let fixtures = fs.readdirSync(path.join(__dirname, 'fixtures'))
    .filter(f => /^player_.*\.json$/.test(f)).sort()
    .map(f => [f, JSON.parse(
      fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'))]);
  if (mut && mut.fix) fixtures = mut.fix(fixtures);

  // ---- THE SHAPE -----------------------------------------------------------
  const d1 = CORE.playerDefault(), d2 = CORE.playerDefault();
  ok(d1.what === 'flydiy-player', 'the default carries its own what tag');
  ok(d1.v === CORE.PLAYER_V, 'the default is stamped with PLAYER_V');
  ok(typeof d1.wallet === 'number' && isFinite(d1.wallet),
     'the wallet is a finite number');
  ok(d1.sheds && d1.sheds.HOME && typeof d1.sheds.HOME.shell === 'string',
     'HOME has a shell');
  ok(Array.isArray(d1.sheds.HOME.kits) && d1.sheds.HOME.kits.length > 0,
     'HOME has a kit list, and a fresh profile is not a bare shed');
  ok(eq(d1, JSON.parse(JSON.stringify(d1))),
     'the default survives a JSON round trip byte-for-byte');
  ok(d1 !== d2 && d1.sheds.HOME !== d2.sheds.HOME,
     'playerDefault is a FACTORY — two calls share no objects');
  // the default fit-out is the declared default fit-out, one source of truth
  ok(eq(d1.sheds.HOME.kits, CORE.HANGAR_KITS_DEFAULT),
     'the default shed carries HANGAR_KITS_DEFAULT verbatim');

  // ---- THE WALK ------------------------------------------------------------
  // the machinery is proven BEFORE its first real entry: inject a throwaway
  // migrator, walk a v0 document through it, remove it (G106's idiom).
  CORE.PLAYER_MIGRATORS[0] = doc => { doc.liftedBy0 = true; return doc; };
  try {
    const w = CORE.playerMigrate({ v: 0, wallet: 3 });
    ok(w.liftedBy0 === true, 'the walk runs an injected 0->1 migrator');
    ok(w.v === CORE.PLAYER_V, 'the walk stamps the document to PLAYER_V');
  } finally { delete CORE.PLAYER_MIGRATORS[0]; }
  const future = CORE.playerMigrate({ v: 99, wallet: 7, odd: 1 });
  ok(future.v === 99 && future.odd === 1,
     'a document from the future passes through untouched — never downgraded');
  ok(CORE.playerMigrate(null) === null,
     'a non-document is returned as it came, not invented');

  // ---- THE LIFT ------------------------------------------------------------
  const L1 = CORE.playerLift({ HW: 18, HD: 14, EAVE: 8, junk: 9 },
                             { ground: { set: 'cracked', tile: 4 } });
  ok(eq(L1.sheds.HOME.dims, { HW: 18, HD: 14, EAVE: 8 }),
     'the dims pref lands verbatim, junk keys filtered');
  ok(eq(L1.sheds.HOME.parts, { ground: { set: 'cracked', tile: 4 } }),
     'the parts pref lands verbatim');
  ok(L1.v === CORE.PLAYER_V, 'a lifted document is a current document');
  const L0 = CORE.playerLift(null, null);
  ok(eq(L0, CORE.playerDefault()),
     'lifting nothing is the default — a fresh profile and a wiped one agree');
  ok(!('dims' in CORE.playerLift({ HW: 'x' }, null).sheds.HOME),
     'a dims pref with no finite key lifts as absent, not as garbage');

  // ---- THE VINTAGE SHELF (ruling 4) ---------------------------------------
  ok(fixtures.length >= 1, 'there is at least one frozen player vintage');
  for (const [f, raw] of fixtures) {
    const doc = CORE.playerNormalise(CORE.playerMigrate(
      JSON.parse(JSON.stringify(raw))));
    ok(doc.v === CORE.PLAYER_V, 'vintage ' + f + ' lands on v' + CORE.PLAYER_V);
    ok(eq(doc.sheds.HOME.dims, raw.sheds.HOME.dims),
       'vintage ' + f + ' keeps its dims through the walk');
    ok(eq(doc.sheds.HOME.parts, raw.sheds.HOME.parts),
       'vintage ' + f + ' keeps its parts through the walk');
    const dm = doc.sheds.HOME.dims;
    ok(!dm || ['HW', 'HD', 'EAVE'].every(k => !(k in dm) ||
         (typeof dm[k] === 'number' && isFinite(dm[k]) && dm[k] >= 3)),
       'vintage ' + f + ' carries plausible metres, not garbage');
  }

  // ---- THE COMPOSITION LOCK ------------------------------------------------
  // a fresh document composes to exactly the declared shed, so the world a
  // default player taxis through is the one GATE SITE proved
  const S = CORE.AIRFIELD_SITE;
  const c0 = CORE.playerShedDims(CORE.playerDefault(), 'HOME', S);
  near(c0.HW, S.hangar.HW, 1e-9, 'default composes to the declared HW');
  near(c0.HD, S.hangar.HD, 1e-9, 'default composes to the declared HD');
  near(c0.EAVE, S.hangar.EAVE, 1e-9, 'default composes to the declared EAVE');
  const part = CORE.playerDefault();
  part.sheds.HOME.dims = { HW: 20 };
  const c1 = CORE.playerShedDims(part, 'HOME', S);
  ok(c1.HW === 20 && c1.HD === S.hangar.HD && c1.EAVE === S.hangar.EAVE,
     'a partial dims record falls through PER KEY, not as a block');

  // ---- THE WRITE-STOP (source-scanned, the GATE SITE idiom) ---------------
  const code = srcA.replace(/\/\/[^\n]*/g, '');    // comments may TALK about it
  ok(/prefGet\(\s*PLAYER_KEY|prefGet\(\s*'flydiy\.player'/.test(code),
     'app.js reads flydiy.player on the load path');
  ok(/playerNormalise\(\s*playerMigrate\(/.test(code),
     'the load path runs the walk before normalising');
  ok(/playerLift\(/.test(code), 'the lift is wired');
  ok(!/prefSet\(\s*'flydiy\.hangarDims'/.test(code),
     'nothing writes flydiy.hangarDims any more (reads stay legal: the lift)');
  ok(!/prefSet\(\s*'flydiy\.hangarParts'/.test(code),
     'nothing writes flydiy.hangarParts any more');
  ok(/prefSet\(\s*'flydiy\.hangarMobile'/.test(code),
     'hangarMobile is STILL a pref — view state is not property (G106)');
  ok(/prefSet\(\s*'flydiy\.hangarEnvSrc'/.test(code),
     'hangarEnvSrc is STILL a pref — view state is not property (G106)');

  return { checks, fails };
}

// ---------------------------------------------------------------------------
const base = run(null);
if (!SELF) {
  for (const f of base.fails) console.log('  - ' + f);
  console.log(base.checks + ' checks');
  console.log('GATE PLAYER: ' + (base.fails.length
    ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}

// ---- negative verification -------------------------------------------------
const BREAKS = [
  ['a vintage doctored to an alien shape',
   { fix: F => F.map(([f, r]) => [f, { v: 1, what: 'flydiy-player',
       sheds: { HOME: { shell: 'club', kits: [],
                        dims: { HW: 1 }, parts: null } } }]) }],
  ['the shelf swept empty', { fix: () => [] }],
  ['app.js quietly writes the old dims pref again',
   { srcA: s => s + "\nprefSet('flydiy.hangarDims', '{}');\n" }],
  ['app.js quietly writes the old parts pref again',
   { srcA: s => s + "\nprefSet('flydiy.hangarParts', '{}');\n" }],
  ['the estate swallows the mobile-kit view pref',
   { srcA: s => s.replace(/prefSet\(\s*'flydiy\.hangarMobile'[^)]*\)/g, '0') }],
  ['the load path skips the walk',
   { srcA: s => s.replace(/playerNormalise\(\s*playerMigrate\(/g,
                          'playerNormalise((') }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  const r = run(mut);
  const caught = r.fails.length > base.fails.length;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name +
    (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE PLAYER selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS'));
process.exit(bad ? 1 : 0);
