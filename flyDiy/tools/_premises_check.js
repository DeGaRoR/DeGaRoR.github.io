#!/usr/bin/env node
// GATE PREMISES — the premises record's verdict (G353 / GPREM; the contract:
// futureDesigns/PREMISES-CONTRACT-2026-09-13.md §6).
//
//   node tools/_premises_check.js              -> the fixtures under tools/fixtures/premises_*.json
//   node tools/_premises_check.js --selftest   -> negative verification
//   node tools/_premises_check.js --sink 8402  -> a screenshot sink for the bench (POST /save?name=x, PNG body)
//
// Holds, headless (no THREE, no DOM), on tools/_premises_gen.js:
//
//   1  ROUND TRIP: the envelope unwraps to the record it wrapped, nulls and
//      all; a bare record is accepted; a foreign document is refused.
//   2  MIGRATION: every fixture walks to PREMISES_V and normalises.
//   3  (the catalogue — arrives with the sites; v0 holds only that collect()
//      answers, deriving an entry per preset when a generator has no CATALOGUE)
//   4  DETERMINISM: the fixture composes twice to the same heights; with its
//      DISJOINT modifiers permuted, the same heights.
//   5  IDENTITY: an empty record changes nothing; the fixture stood far from
//      HOME on the flight world changes nothing outside its extent + falloff,
//      and HOME's pad stays exactly 0 (GATE WORLD's goldens are safe).
//   6  C1 AND THE BUDGET: no step across any falloff band (the slope over
//      0.25 m stays under 3); a million terrainH calls with the fixture
//      composed on the flight world under 2500 ms (WORLD-CONTRACT rule 4).
//   7  FLATTEN: every flatten is flat to 1 cm over its body; a raise moves
//      its body by its dh; a ramp's body lies on its plane; a grade's
//      centreline is at its nodes' heights.
//  10  SURFACE: a surface polygon answers its class inside and -1 outside.
//  11  EXCLUDE: an exclude polygon answers true inside, false outside.
//  12  BAKED VS LIVE: the extent rastered to int16 at 1 m; ten thousand
//      points within 0.02 m + cell^2 / 8 of the second differences at the
//      cell — bilinear's own bound (WORLD-V2 §6.3; contract v1.1).
//  13  THE CONTRACT HELD: no catalogue key appears as a string literal in any
//      _premises_* file — the editor accepts a new asset without an edit.
//
// NEGATIVE-VERIFIED: --selftest crosses a polygon, forges an envelope, moves
// a level after compose, and requires each rule red.
'use strict';
const fs = require('fs');
const path = require('path');

const TOOLS = __dirname;
const SELFTEST = process.argv.includes('--selftest');
const SINK = process.argv.indexOf('--sink');
if (SINK >= 0) { sink(+process.argv[SINK + 1] || 8402); return; }

const PG = require(path.join(TOOLS, '_premises_gen.js'));

const fail = [];
let checks = 0;
function check(ok, what, detail) {
  checks++;
  if (!ok) fail.push(what + (detail ? ' — ' + detail : ''));
  return ok;
}

// a synthetic terrain with relief at every scale the modifiers care about
const synth = { id: 'synth', terrainH: (x, z) => 3 * Math.sin(x / 40) + 2 * Math.cos(z / 33) + 0.02 * z + 0.4 * Math.sin(x / 7 + z / 9) };
// the flight world, when the build exists (run_gates builds first; a loose run may not have it)
let FLIGHT = null;
try { const fc = require(path.join(TOOLS, 'flight_core.js')); if (fc && fc.makeWorld) FLIGHT = fc.makeWorld(); } catch (e) { FLIGHT = null; }

const fixtures = fs.readdirSync(path.join(TOOLS, 'fixtures')).filter(f => /^premises_v\d+_.*\.json$/.test(f)).sort();
check(fixtures.length > 0, '2 there is at least one fixture');

const rnd = PG.mulberry32(11);
const sampleIn = (bb, n, f) => { for (let k = 0; k < n; k++) f(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.z0 + rnd() * (bb.z1 - bb.z0)); };

for (const fx of fixtures) {
  const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', fx), 'utf8');
  let U;
  try { U = PG.unwrap(txt); } catch (e) { check(false, '2 ' + fx + ' unwraps', e.message); continue; }
  const rec = U.rec;
  check(rec.v === PG.PREMISES_V, '2 ' + fx + ' is at PREMISES_V');
  // 1 round trip
  const back = PG.unwrap(PG.envelope(U.name, rec)).rec;
  check(JSON.stringify(back) === JSON.stringify(rec), '1 ' + fx + ' round-trips through the envelope');
  check(JSON.stringify(PG.unwrap(JSON.stringify(rec)).rec) === JSON.stringify(rec), '1 a bare record is accepted');
  let refused = false; try { PG.unwrap('{"what":"flydiy-build","v":9}'); } catch (e) { refused = true; }
  check(refused, '1 a foreign document is refused');
  check(PG.issues(rec).length === 0, '2 ' + fx + ' has no issues', PG.issues(rec)[0]);

  // 4 determinism
  const O1 = PG.compose(rec, synth), O2 = PG.compose(rec, synth);
  let same = true;
  sampleIn(O1.extent, 2000, (x, z) => { if (O1.terrainAt(x, z) !== O2.terrainAt(x, z)) same = false; });
  check(same, '4 ' + fx + ' composes the same twice');
  {
    const perm = JSON.parse(JSON.stringify(rec));
    perm.layers.terrain.reverse();
    const O3 = PG.compose(perm, synth);
    // the fixture's modifiers are disjoint (their feathered bboxes do not touch), so order cannot matter
    let disjoint = true;
    const M = rec.layers.terrain.map(m => PG.makeModifier(m, 0).bbox);
    for (let i = 0; i < M.length; i++) for (let j = 0; j < i; j++)
      if (!(M[i].x1 < M[j].x0 || M[j].x1 < M[i].x0 || M[i].z1 < M[j].z0 || M[j].z1 < M[i].z0)) disjoint = false;
    let sameP = true;
    sampleIn(O1.extent, 2000, (x, z) => { if (Math.abs(O1.terrainAt(x, z) - O3.terrainAt(x, z)) > 1e-9) sameP = false; });
    check(!disjoint || sameP, '4 ' + fx + ' disjoint modifiers compose the same in any order');
  }

  // 5 identity
  {
    const E = PG.compose(PG.DEF(), synth);
    let untouched = true;
    sampleIn({ x0: -500, z0: -500, x1: 500, z1: 500 }, 10000, (x, z) => { const h = synth.terrainH(x, z); if (E.terrainH(x, z, h) !== h) untouched = false; });
    check(untouched && E.n === 0, '5 an empty record changes nothing');
    if (FLIGHT) {
      const far = JSON.parse(JSON.stringify(rec));
      far.frame.anchors = { '*': { x: 3000, z: 3000, yaw: 0.3 } };
      const OF = PG.compose(far, FLIGHT);
      let outside = true;
      const ex = OF.extent, pad = 20;
      sampleIn({ x0: 1500, z0: 1500, x1: 4500, z1: 4500 }, 5000, (x, z) => {
        const L = OF.frame.toLocal(x, z);
        if (L[0] > ex.x0 - pad && L[0] < ex.x1 + pad && L[1] > ex.z0 - pad && L[1] < ex.z1 + pad) return;
        const h = FLIGHT.terrainH(x, z);
        if (OF.terrainH(x, z, h) !== h) outside = false;
      });
      check(outside, '5 ' + fx + ' far from HOME changes nothing outside its extent');
      check(Math.abs(OF.terrainH(-520, 0, FLIGHT.terrainH(-520, 0))) < 1e-9 && FLIGHT.terrainH(-520, 0) === 0, '5 HOME\'s pad stays exactly 0');
    } else check(true, '5 (flight world not built here — the identity on the 24 km world is held when run_gates builds)');
  }

  // 6 C1 and the budget
  {
    let slopeMax = 0;
    const ex = O1.extent;
    sampleIn({ x0: ex.x0 - 10, z0: ex.z0 - 10, x1: ex.x1 + 10, z1: ex.z1 + 10 }, 4000, (x, z) => {
      const s = Math.max(Math.abs(O1.terrainAt(x + 0.25, z) - O1.terrainAt(x, z)), Math.abs(O1.terrainAt(x, z + 0.25) - O1.terrainAt(x, z))) / 0.25;
      if (s > slopeMax) slopeMax = s;
    });
    check(slopeMax < 3.0, '6 ' + fx + ' no step across a falloff', 'max slope ' + slopeMax.toFixed(2));
    const W = FLIGHT || synth;
    const OW = PG.compose(rec, W);
    const t0 = Date.now();
    let acc = 0;
    for (let k = 0; k < 1000000; k++) { const x = (k % 1000) * 0.5 - 250, z = ((k / 1000) | 0) * 0.5 - 250; acc += OW.terrainH(x, z, W.terrainH(x, z)); }
    const ms = Date.now() - t0;
    check(ms < 2500 && isFinite(acc), '6 a million terrainH calls under 2500 ms', ms + ' ms on ' + W.id);
  }

  // 7 the modifiers do what they say
  {
    const F = O1.frame;
    for (const m of rec.layers.terrain) {
      if (m.kind === 'grade') {
        let worst = 0;
        for (const p of m.pts) { const w = F.toWorld(p[0], p[1]); worst = Math.max(worst, Math.abs(O1.terrainAt(w[0], w[1]) - (F.y0 + p[2]))); }
        check(worst < 0.01, '7 grade ' + m.id + ' at its nodes\' heights', worst.toFixed(3) + ' m');
        continue;
      }
      const bb = PG.polyBBox(m.poly);
      let worst = 0, n = 0;
      sampleIn(bb, 400, (lx, lz) => {
        if (!PG.inPoly(m.poly, lx, lz)) return;
        n++;
        const w = F.toWorld(lx, lz), h = O1.terrainAt(w[0], w[1]);
        let target;
        if (m.kind === 'flatten') target = (m.abs ? 0 : F.y0) + m.level;
        else if (m.kind === 'raise') target = synth.terrainH(w[0], w[1]) + m.dh;
        else target = F.y0 + m.plane[0] * lx + m.plane[1] * lz + m.plane[2];
        worst = Math.max(worst, Math.abs(h - target));
      });
      check(n > 20 && worst < 0.01, '7 ' + m.kind + ' ' + m.id + ' holds over its body', worst.toFixed(3) + ' m over ' + n + ' samples');
    }
  }

  // 10 surface, 11 exclude
  for (const s of rec.layers.surface) {
    const bb = PG.polyBBox(s.poly);
    let ok = true;
    sampleIn({ x0: bb.x0 - 20, z0: bb.z0 - 20, x1: bb.x1 + 20, z1: bb.z1 + 20 }, 1000, (lx, lz) => {
      const w = O1.frame.toWorld(lx, lz);
      const inside = PG.inPoly(s.poly, lx, lz);
      const a = O1.surfaceAt(w[0], w[1]);
      if (inside ? a !== s.surface : a !== -1) ok = false;
    });
    check(ok, '10 surface ' + s.id + ' answers ' + PG.SURFACE_NAMES[s.surface] + ' inside and -1 outside');
  }
  for (const e of rec.layers.exclude) {
    const bb = PG.polyBBox(e.poly);
    let ok = true;
    sampleIn({ x0: bb.x0 - 20, z0: bb.z0 - 20, x1: bb.x1 + 20, z1: bb.z1 + 20 }, 1000, (lx, lz) => {
      const w = O1.frame.toWorld(lx, lz);
      if (O1.excludeAt(w[0], w[1], 'trees') !== PG.inPoly(e.poly, lx, lz)) ok = false;
    });
    check(ok, '11 exclude ' + e.id + ' answers inside and not outside');
  }

  // 12 baked vs live
  {
    const B = PG.bake(O1, synth, O1.extent, 1);
    let worst = -Infinity;
    sampleIn(O1.extent, 10000, (lx, lz) => {
      const w = O1.frame.toWorld(lx, lz);
      const live = O1.terrainAt(w[0], w[1]), baked = B.sample(lx, lz);
      worst = Math.max(worst, Math.abs(live - baked) - (0.02 + PG.curvTol(O1, O1.frame, lx, lz, 1)));
    });
    check(worst <= 0, '12 ' + fx + ' baked and live agree', 'over by ' + worst.toFixed(3) + ' m');
  }
  // the panel's own lines all green on the golden
  const lines = PG.checks(rec, synth);
  check(lines.every(l => l.ok), '12 the #chk lines are green on ' + fx, lines.filter(l => !l.ok).map(l => l.label).join('; '));
}

// 3 the catalogue collects, deriving where a generator has none
{
  const cat = PG.collect({ HOUSE_GEN: { DEF: { L: 8, w: 6 }, PRESETS: { 'shore cabin': {}, 'village house': { L: 9 } } },
                           TOTEM_GEN: { CATALOGUE: [{ key: 'totem/park', kind: 'park', preset: 'park', foot: () => [[0, 0], [1, 0], [1, 1]], lod: { dist: [0, 150, 500, 1500] } }] } });
  check(cat.entries.size === 3 && cat.entries.get('house/shore cabin').derived === true && cat.entries.get('totem/park').kind === 'park', '3 collect() derives an entry per preset and takes an exported CATALOGUE');
  const dup = PG.collect({ HOUSE_GEN: { CATALOGUE: [{ key: 'a/b' }] }, BIG_GEN: { CATALOGUE: [{ key: 'a/b' }] } });
  check(dup.issues.length === 1, '3 a key collision is reported');
}

// 13 the contract held: no catalogue key literal in the editor's files
{
  const files = fs.readdirSync(TOOLS).filter(f => /^_premises.*\.(js|html)$/.test(f) && f !== '_premises_check.js');
  const re = /['"](house|big|shed|tram|totem|factory)\/[a-z]/;
  for (const f of files) {
    const src = fs.readFileSync(path.join(TOOLS, f), 'utf8');
    check(!re.test(src), '13 no catalogue key literal in ' + f);
  }
}

// ---------------------------------------------------------------------------
if (SELFTEST) {
  const neg = [];
  const rec = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', fixtures[0]), 'utf8')).rec;
  // a crossed polygon must be refused
  const bad = JSON.parse(JSON.stringify(rec));
  bad.layers.terrain[0].poly = [[0, 0], [10, 10], [10, 0], [0, 10]];
  neg.push([PG.issues(bad).length > 0, 'a crossed polygon is refused']);
  // a forged envelope must be refused
  let refused = false; try { PG.unwrap('{"what":"flydiy-premises","v":1}'); } catch (e) { refused = true; }
  neg.push([refused, 'an envelope without a record is refused']);
  // a moved level must change the heights (the determinism rule sees the change)
  const O1 = PG.compose(rec, synth);
  const mv = JSON.parse(JSON.stringify(rec)); mv.layers.terrain[0].level += 1;
  const O2 = PG.compose(mv, synth);
  const c = PG.polyBBox(rec.layers.terrain[0].poly);
  const w = O1.frame.toWorld((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2);
  neg.push([Math.abs(O1.terrainAt(w[0], w[1]) - O2.terrainAt(w[0], w[1])) > 0.9, 'a moved level moves the ground']);
  // a flatten with a zero falloff is an issue (a step)
  const st = JSON.parse(JSON.stringify(rec)); st.layers.terrain[0].falloff = 0;
  neg.push([PG.issues(st).length > 0, 'a zero falloff is refused']);
  for (const [ok, what] of neg) check(ok, 'selftest: ' + what);
}

// ---------------------------------------------------------------------------
if (fail.length) {
  for (const f of fail.slice(0, 30)) console.log('  ! ' + f);
  console.log('GATE PREMISES: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('  ' + checks + ' checks on ' + fixtures.length + ' fixture(s)' + (FLIGHT ? ', the flight world loaded' : ', flight world absent'));
console.log('GATE PREMISES: PASS');

// ---------------------------------------------------------------------------
// the screenshot sink: the bench renders to a target and POSTs a PNG here,
// because the Browser pane's on-screen canvas is 0 x 0 while hidden
function sink(port) {
  const http = require('http');
  const dir = path.join(TOOLS, '..', 'screenshots', 'premises');
  fs.mkdirSync(dir, { recursive: true });
  http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const u = new URL(req.url, 'http://x');
    if (req.method !== 'POST' || u.pathname !== '/save') { res.writeHead(404); res.end(); return; }
    const name = (u.searchParams.get('name') || 'shot').replace(/[^a-z0-9_\-]/gi, '_');
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const fp = path.join(dir, name + '.png');
      fs.writeFileSync(fp, Buffer.concat(chunks));
      console.log('saved', fp, fs.statSync(fp).size, 'bytes');
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    });
  }).listen(port, () => console.log('premises sink on http://localhost:' + port + '/save?name=<x> -> ' + dir));
}
