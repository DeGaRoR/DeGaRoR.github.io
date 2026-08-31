#!/usr/bin/env node
// GATE SITE — the base aerodrome as ONE declared place (G123).
//
//   node tools/_site_check.js            -> "GATE SITE: PASS|FAIL"
//   node tools/_site_check.js --selftest -> negative verification
//
// Until this chantier there were THREE copies of one runway: the 'HOME' record
// in 20_world.js, a hand-restated 1100 x 30 at (-520, 0) in render_world.js,
// and an unrelated 320 x 24 strip pointing out of the garage door in
// hangar.js. The registry's own comment admitted it — "the h0 runway carve box
// / renderer decals are not yet driven from these records".
//
// src/core/25_airfield.js collapses them. This gate exists because a shared
// declaration only stays shared if something asserts that nobody quietly went
// back to writing their own numbers, and because a site is a set of geometric
// claims — nothing paved under the building, a taxiway that actually reaches
// the runway, a fence with a gate in it — that no unit test would otherwise
// look at and no screenshot would reliably show.
//
// WHAT IT GUARDS, and why each one is here:
//
//   ONE RUNWAY  neither consumer restates the runway's numbers. Source-scanned,
//               the way GATE PROPS re-parses the Python table and GATE REF
//               scans refplane.js: the property is about what the files SAY,
//               and that is a fact about their text.
//   THE FRAME   siteToLocal / siteToWorld round-trip, and the door really does
//               face the strip. A sign error here is invisible in code review
//               and puts the runway behind the shed.
//   NO PAVING   the apron and taxiway do not run under the hangar. The old
//               apron decal did, by ten metres, and nobody saw it because the
//               building it ran under was a 15 x 10 box.
//   THE JOIN    the taxiway meets the runway, inside its length. The old one
//               stopped fifteen metres past the threshold, joined to nothing.
//   THE GATE    the fence does not cross the taxiway. The old one did.
//   ON THE PAD  every declared item lies inside x [-1180, 130], |z| < 90, where
//               20_world.js's h0 multiplies terrain by exactly zero. This is
//               the quiet one: outside it nothing FAILS, things merely float,
//               and the windbreak and the straw bales both used to.
//   THE SHED    the declared dims match hangar.js's own defaults, so the
//               building in the world is the room you stand in.
//
// NEGATIVE-VERIFIED: --selftest breaks each rule in turn and requires the
// matching check to fail. A gate that has never failed has never been tested.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8');
const CORE = require('./flight_core.js');

const SELF = process.argv.includes('--selftest');
let fails = [], checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); return !!cond; };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol,
  msg + ' (' + a + ' vs ' + b + ', tol ' + tol + ')');

// rectangles, as [x0,x1,z0,z1]; overlap is strict so touching edges are legal
const rect = r => [Math.min(r.x0, r.x1), Math.max(r.x0, r.x1),
                   Math.min(r.z0, r.z1), Math.max(r.z0, r.z1)];
const overlaps = (a, b) => {
  const A = rect(a), B = rect(b);
  return A[0] < B[1] && B[0] < A[1] && A[2] < B[3] && B[2] < A[3];
};
const areaOfOverlap = (a, b) => {
  const A = rect(a), B = rect(b);
  const w = Math.min(A[1], B[1]) - Math.max(A[0], B[0]);
  const d = Math.min(A[3], B[3]) - Math.max(A[2], B[2]);
  return (w > 0 && d > 0) ? w * d : 0;
};

function run(mut) {
  fails = []; checks = 0;
  // THE REGISTRY (HANGARS S5): every check below reads S = SITES.HOME by
  // reference, so the whole HOME battery and every --selftest mutator work
  // verbatim; the registry-wide checks iterate SITES beside them.
  const SITES = JSON.parse(JSON.stringify(CORE.AIRFIELD_SITES));
  const S = SITES.HOME;
  const world = CORE.makeWorld();
  const HOME = world.aerodromes.find(a => a.id === 'HOME');
  let srcW = read('render_world.js'), srcH = read('hangar.js');
  if (mut && mut.S) mut.S(S);
  if (mut && mut.SITES) mut.SITES(SITES);
  if (mut && mut.srcW) srcW = mut.srcW(srcW);
  if (mut && mut.srcH) srcH = mut.srcH(srcH);

  // ---- the record itself is still what everything is derived FROM ---------
  ok(!!HOME, 'HOME is missing from world.aerodromes');
  if (!HOME) return { checks, fails };
  const R = CORE.siteRunway(HOME);

  // ---- ONE RUNWAY: neither scene restates it ------------------------------
  // The literals that were the duplicate. Comments are stripped first: this
  // file, and the files it scans, are allowed to TALK about the old numbers
  // while not USING them — which is exactly what their headers now do.
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '')
                      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const RESTATED = [
    [/\b1100\b/, 'the runway length 1100'],
    [/-520\b/, 'the runway centre -520'],
    [/\bPlaneGeometry\(\s*1100\s*,/, 'a hardcoded 1100 m strip'],
    [/\bPlaneGeometry\(\s*320\s*,\s*24\s*\)/, "the garage's own 320 x 24 strip"],
  ];
  for (const [re, what] of RESTATED) {
    ok(!re.test(strip(srcW)), 'render_world.js still restates ' + what);
    ok(!re.test(strip(srcH)), 'hangar.js still restates ' + what);
  }
  // and both must actually READ the declaration — through the registry's
  // accessor since S5 (the alias stays for fallbacks, but the scenes ask)
  ok(/siteOf\(\s*'HOME'\s*\)/.test(strip(srcW)),
     'render_world.js does not read the site registry');
  ok(/siteOf\(\s*'HOME'\s*\)/.test(strip(srcH)),
     'hangar.js does not read the site registry');
  ok(/siteRunway/.test(srcW), 'render_world.js does not derive the runway');
  ok(/siteToLocal|siteToWorld/.test(srcH),
     'hangar.js does not use the frame conversion');

  // ---- THE FRAME ----------------------------------------------------------
  for (const [px, pz] of [[0, 0], [-12.5, 0], [7.5, -13], [-62, 17]]) {
    const w = CORE.siteToWorld(px, pz, S.hangar);
    const b = CORE.siteToLocal(w.x, w.z, S.hangar);
    near(b.x, px, 1e-9, 'frame round-trip x at (' + px + ',' + pz + ')');
    near(b.z, pz, 1e-9, 'frame round-trip z at (' + px + ',' + pz + ')');
  }
  // the door is at local -HD; going further out of it must APPROACH the strip
  const doorW = CORE.siteToWorld(-S.hangar.HD, 0, S.hangar);
  const outW = CORE.siteToWorld(-S.hangar.HD - 10, 0, S.hangar);
  ok(Math.abs(outW.z - R.cz) < Math.abs(doorW.z - R.cz),
     'walking out of the door does not go toward the runway');
  // and the frontage must lie ALONG the strip, not across it: two points a
  // metre apart in local z must differ in world x, not world z
  const f0 = CORE.siteToWorld(0, 0, S.hangar), f1 = CORE.siteToWorld(0, 1, S.hangar);
  ok(Math.abs(f1.x - f0.x) > 0.99 && Math.abs(f1.z - f0.z) < 0.01,
     'the shed frontage does not run along the runway');

  // ---- THE SHED matches the room ------------------------------------------
  // hangar.js's own defaults, read out of its source so the two cannot drift.
  const dm = srcH.match(/const HW = D0\.HW \|\| ([\d.]+), HD = D0\.HD \|\| ([\d.]+), EAVE = D0\.EAVE \|\| ([\d.]+)/);
  ok(!!dm, 'cannot find hangar.js default dims');
  if (dm) {
    near(S.hangar.HW, +dm[1], 1e-9, 'declared HW vs hangar.js default');
    near(S.hangar.HD, +dm[2], 1e-9, 'declared HD vs hangar.js default');
    near(S.hangar.EAVE, +dm[3], 1e-9, 'declared EAVE vs hangar.js default');
  }

  // ---- THE REGISTRY ITSELF (HANGARS S5) -----------------------------------
  // The alias is an identity, not a copy — the one line that keeps every
  // legacy fallback byte-exact can never drift from the registry's HOME.
  ok(CORE.AIRFIELD_SITE === CORE.AIRFIELD_SITES.HOME,
     'AIRFIELD_SITE has drifted from AIRFIELD_SITES.HOME');
  ok(CORE.siteOf('HOME') === CORE.AIRFIELD_SITES.HOME,
     'siteOf(HOME) does not return the registry record');
  ok(CORE.siteOf('NOPE') === null && CORE.siteOf('M1') === null,
     'an absent or meadow site must read as null, not undefined');
  // ...and the shed the whole battery is proven against is frozen: the
  // hangar record byte-for-byte, so a rename can never smuggle a move.
  ok(JSON.stringify(SITES.HOME.hangar) === JSON.stringify(
       { x: 42, z: 62, ry: -Math.PI / 2, HW: 15, HD: 12.5, EAVE: 7.0 }),
     'the HOME hangar record is not byte-identical to the declaration');
  for (const id of Object.keys(SITES)) {
    ok(!!world.aerodromes.find(a => a.id === id),
       'site key ' + id + ' resolves to no aerodrome');
    ok(!/^A\d+$/.test(id), 'site key ' + id + ' is a seed-dependent strip ' +
       'id — it would silently detach under a different seed');
  }
  for (const a of world.aerodromes)
    if (a.kind === 'meadow' && ['M1', 'M2', 'M3'].includes(a.id))
      ok(a.id in SITES, 'meadow ' + a.id + ' lost its registry KEY — a ' +
         'meadow with no site is null, not missing');
  // every granted site's buildings stand where the ground is EXACT — HOME
  // on the h0 pad (the full walk below), a meadow inside blendM's 0.45 r
  // plateau. No meadow is granted yet, so this loop is proven by selftest.
  for (const [id, T] of Object.entries(SITES)) {
    if (!T) continue;
    const aero = world.aerodromes.find(a => a.id === id);
    const pts = [];
    if (T.hangar) {
      const bx = CORE.siteHangarBox(T.hangar);
      pts.push([bx.x0, bx.z0], [bx.x0, bx.z1], [bx.x1, bx.z0], [bx.x1, bx.z1]);
    }
    for (const b of T.buildings || []) pts.push([b.x, b.z]);
    if (T.windsock) pts.push([T.windsock.x, T.windsock.z]);
    for (const r of [T.apron, T.taxiway]) if (r)
      pts.push([r.x0, r.z0], [r.x1, r.z1]);
    for (const [x, z] of pts)
      ok(CORE.siteOnFlat(aero, x, z), 'site ' + id + ': (' + x + ', ' + z +
         ') stands off the exact-flat ground');
  }

  // ---- THE PLAYER COMPOSES TO THE DECLARATION (HANGARS S1) ----------------
  // The shed's size is the player's property now, composed over the site per
  // key. A FRESH profile carries no dims of its own, so what it composes to
  // must be exactly the declared shed — the default player taxis through the
  // aerodrome this gate proves, not some fourth copy of the numbers.
  {
    const doc = CORE.playerDefault();
    if (mut && mut.doc) mut.doc(doc);
    const c = CORE.playerShedDims(doc, 'HOME', { hangar: S.hangar });
    near(c.HW, S.hangar.HW, 1e-9, 'a fresh profile composes to the declared HW');
    near(c.HD, S.hangar.HD, 1e-9, 'a fresh profile composes to the declared HD');
    near(c.EAVE, S.hangar.EAVE, 1e-9,
         'a fresh profile composes to the declared EAVE');
  }

  // ---- THE ENVELOPE STAYS ON THE PAD (HANGARS S1) -------------------------
  // Player dims drive the WORLD's shed now, so the claim that must hold at
  // ANY legal size is the invisible one: the building never leaves the flat
  // pad where y = 0 is exact. (It MAY eat its own apron at full stretch —
  // that is visible and the player's own doing; floating slightly forever is
  // neither.) The envelope is the union of every live shell's slider limits.
  {
    const lims = {};
    for (const k of Object.keys(CORE.SHELLS)) {
      if (CORE.SHELLS[k].status !== 'live') continue;
      const L = CORE.SHELLS[k].lims;
      for (const d of ['HW', 'HD'])
        lims[d] = lims[d]
          ? [Math.min(lims[d][0], L[d][0]), Math.max(lims[d][1], L[d][1])]
          : L[d].slice();
    }
    if (mut && mut.L) mut.L(lims);
    for (const HW of lims.HW) for (const HD of lims.HD) {
      const bx = CORE.siteHangarBox(Object.assign({}, S.hangar, { HW, HD }));
      for (const [x, z] of [[bx.x0, bx.z0], [bx.x0, bx.z1],
                            [bx.x1, bx.z0], [bx.x1, bx.z1]])
        ok(CORE.siteOnPad(x, z), 'a shed dragged to HW ' + HW + ' / HD ' + HD +
           ' leaves the flat pad at (' + x + ', ' + z + ')');
    }
  }

  // ---- NO PAVING UNDER THE BUILDING ---------------------------------------
  const box = CORE.siteHangarBox(S.hangar);
  ok(areaOfOverlap(S.apron, box) < 0.6 * (box.x1 - box.x0),
     'the apron runs under the hangar (' +
     areaOfOverlap(S.apron, box).toFixed(1) + ' m2)');
  ok(!overlaps(S.taxiway, box), 'the taxiway runs under the hangar');
  // ...and the apron does reach the door, or the aeroplane rolls onto grass
  ok(S.apron.z1 >= box.z0 - 0.01,
     'the apron does not reach the door line (' + S.apron.z1 + ' vs ' + box.z0 + ')');
  // the neighbours keep out of the shed too
  for (const b of S.buildings)
    ok(!overlaps({ x0: b.x - b.w / 2, x1: b.x + b.w / 2,
                   z0: b.z - b.d / 2, z1: b.z + b.d / 2 }, box),
       'building at (' + b.x + ',' + b.z + ') overlaps the hangar');

  // ---- THE JOIN: the taxiway reaches the runway, inside its length --------
  const rw = { x0: Math.min(R.end0.x, R.end1.x), x1: Math.max(R.end0.x, R.end1.x),
               z0: R.cz - R.half, z1: R.cz + R.half };
  ok(overlaps(S.taxiway, rw) ||
     Math.abs(Math.min(S.taxiway.z0, S.taxiway.z1) - rw.z1) < 0.01,
     'the taxiway does not meet the runway');
  ok(S.taxiway.x0 >= rw.x0 - 0.01 && S.taxiway.x1 <= rw.x1 + 0.01,
     'the taxiway meets the runway outside its length (x ' + S.taxiway.x0 +
     '..' + S.taxiway.x1 + ' vs strip ' + rw.x0 + '..' + rw.x1 + ')');
  // and it reaches the apron at the other end
  ok(Math.abs(Math.max(S.taxiway.z0, S.taxiway.z1) -
              Math.min(S.apron.z0, S.apron.z1)) < 0.01,
     'the taxiway does not meet the apron');
  ok(S.taxiway.x0 >= Math.min(S.apron.x0, S.apron.x1) - 0.01 &&
     S.taxiway.x1 <= Math.max(S.apron.x0, S.apron.x1) + 0.01,
     'the taxiway leaves the apron off its side');

  // ---- THE GATE: the fence does not cross the taxiway ---------------------
  const F = S.fence;
  const tx0 = Math.min(S.taxiway.x0, S.taxiway.x1),
        tx1 = Math.max(S.taxiway.x0, S.taxiway.x1);
  const crossesZ = F.z > Math.min(S.taxiway.z0, S.taxiway.z1) &&
                   F.z < Math.max(S.taxiway.z0, S.taxiway.z1);
  for (const [a, b] of F.runs)
    ok(!(crossesZ && Math.min(a, b) < tx1 && tx0 < Math.max(a, b)),
       'the fence run ' + a + '..' + b + ' crosses the taxiway');
  ok(F.runs.length >= 2 || !crossesZ, 'the fence has no gate for the taxiway');

  // ---- ON THE PAD ---------------------------------------------------------
  const pts = [];
  const push = (x, z, what) => pts.push([x, z, what]);
  for (const r of [S.apron, S.taxiway])
    for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) push(x, z, 'paving');
  for (const c of [box.x0, box.x1]) for (const d of [box.z0, box.z1])
    push(c, d, 'the hangar');
  for (const b of S.buildings) push(b.x, b.z, 'a building');
  push(S.windsock.x, S.windsock.z, 'the windsock');
  push(S.stand.x, S.stand.z, 'the stand');
  for (const [a, b] of S.fence.runs) { push(a, S.fence.z, 'the fence'); push(b, S.fence.z, 'the fence'); }
  for (let x = S.trees.x0; x <= S.trees.x1; x += S.trees.step) push(x, S.trees.z, 'a tree');
  for (const k in S.clutter) {
    const v = S.clutter[k];
    if (typeof v[0] === 'number') push(v[0], v[1], k);
    else for (const it of v) push(it[0], it[1], k);
  }
  for (const m of CORE.siteMarkers(HOME)) push(m.x, m.z, 'an edge marker');
  for (const [x, z, what] of pts)
    ok(CORE.siteOnPad(x, z),
       what + ' at (' + x.toFixed(1) + ',' + z.toFixed(1) + ') is off the flat pad');

  // ---- the derived runway agrees with the record it came from -------------
  near(Math.hypot(R.end1.x - R.end0.x, R.end1.z - R.end0.z), HOME.len, 1e-6,
       'derived runway length');
  // tdz is AUTHORED, not derived — assert the property that actually matters:
  // that the autopilot's aim point is on the strip it is aiming at.
  const along = (R.tdz.x - R.end0.x) * R.dx + (R.tdz.z - R.end0.z) * R.dz;
  const across = Math.abs((R.tdz.x - R.cx) * R.nx + (R.tdz.z - R.cz) * R.nz);
  ok(along > 0 && along < R.len, 'HOME.tdz is off the end of its own runway');
  ok(across <= R.half, 'HOME.tdz is off the side of its own runway');
  // and the derived aiming points must reproduce what was painted by hand
  near(R.aim0.x, 25 - 272.5, 1e-6, 'derived aim0 vs the painted marker');
  near(R.aim1.x, -1065 + 272.5, 1e-6, 'derived aim1 vs the painted marker');
  ok(CORE.siteMarkers(HOME).length >= 2, 'no edge markers derived');

  return { checks, fails };
}

// --------------------------------------------------------------------------
const base = run(null);
if (!SELF) {
  for (const f of base.fails) console.log('  - ' + f);
  // the runner matches ^GATE SITE: PASS$ exactly, so the count goes above it
  console.log(base.checks + ' checks');
  console.log('GATE SITE: ' + (base.fails.length
    ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}

// ---- negative verification -----------------------------------------------
const BREAKS = [
  ['apron under the shed', { S: S => { S.apron.z1 = 70; } }],
  ['taxiway under the shed', { S: S => { S.taxiway.x1 = 45; S.taxiway.z1 = 60; } }],
  ['taxiway short of the runway', { S: S => { S.taxiway.z0 = 20; } }],
  ['taxiway past the threshold', { S: S => { S.taxiway.x0 = 40; S.taxiway.x1 = 56; } }],
  ['fence across the taxiway', { S: S => { S.fence.runs = [[-80, 60]]; } }],
  ['an item off the pad', { S: S => { S.trees.z = 95; } }],
  ['shed dims drifted from the room', { S: S => { S.hangar.HW = 18; } }],
  // the shed moved to the far side of the strip: the door now faces AWAY
  ['the shed on the wrong side', { S: S => { S.hangar.z = -62; } }],
  ['render_world restates the runway',
   { srcW: s => s + '\nconst strip = new THREE.PlaneGeometry(1100, 30);\n' }],
  ['hangar keeps its own strip',
   { srcH: s => s + '\nnew THREE.PlaneGeometry(320, 24)\n' }],
  // HANGARS S1: a fresh profile that ships its OWN size no longer composes
  // to the declaration — the composition lock must see it
  ['a fresh profile ships its own size',
   { doc: d => { d.sheds.HOME.dims = { HW: 20 }; } }],
  // ...and a widened slider envelope must be caught by the pad walk before a
  // player can drag the building off the flat ground
  ['the size envelope escapes the pad', { L: L => { L.HD[1] = 40; } }],
  // HANGARS S5: a granted meadow site must stand on the EXACT plateau
  // (blendM is flat inside 0.45 r; 150 m off M1's centre is on the blend)
  ['a meadow site off its flat ground', { SITES: T => {
    T.M1 = { hangar: { x: -2200 + 150, z: -1500, ry: 0,
                       HW: 4, HD: 5, EAVE: 3 } }; } }],
  // ...and a site may never key a seed-dependent strip id
  ['a site keyed on a seed strip', { SITES: T => { T.A3 = T.HOME; } }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  const r = run(mut);
  const caught = r.fails.length > base.fails.length;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name +
    (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE SITE selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS'));
process.exit(bad ? 1 : 0);
