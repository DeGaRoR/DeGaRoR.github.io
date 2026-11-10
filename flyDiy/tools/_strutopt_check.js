#!/usr/bin/env node
// GATE STRUTOPT (STRUT-OPTIONS, 2026-11-10) - THE LIFT STRUT'S OPTIONS: its section (bracing.section 'tube', the wing
// row wgStrutSec) and its jury strut (bracing.jury 'wing' | 'cabin', the row wgJury).
//
//   node tools/_strutopt_check.js            -> "GATE STRUTOPT: PASS|FAIL"
//
// 1. ABSENT IS THE OLD BYTES: a build with the rows stated at their default (the join's null, the cage's 0) builds the
//    same nodes, beams, params and certificate key as the file without them (Cub, Cessna, Ruckus).
// 2. EVERY OPTION IS A RIGID, SYMMETRIC TRUSS: rank 3n - 6 (GATE GEN's test) and left/right mass within 1 g, on the
//    single strut and the V pair, both jury styles, both sections.
// 3. THE JURY IS WHAT IT SAYS: four clamp nodes ('JS'), one jury per lift strut, drawn as the strut is; each half of a
//    split strut at twice the whole strut's k (the pair in series is the strut it was); the mass added is the drawn
//    jury's length at the class's own per metre x juryMassK (a hidden jury, the tie: none).
// 4. THE DRAG IS WHAT IT SAYS AND WHERE IT IS: a round strut adds (cdRound tubeD L_drawn - the streamline bill) on the
//    struts' own blobs (one a side, refs.strutDrag: never the body's axial row, which acts at the cabin ring),
//    a jury its drawn length x juryT x its section's Cd; a profiled strut with no jury adds nothing.
// 5. THE KEYS: genStolCageOff drops wgStrutSec 0 / wgJury 0 (every key the game hashes a build by).
'use strict';
const fs = require('fs'), path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));
const ROOT = path.join(__dirname, '..');
const fails = [];
const check = (ok, label) => { console.log((ok ? '  ok   ' : '  FAIL ') + label); if (!ok) fails.push(label); };
// THROUGH THE LOAD DOOR (GATE JOINPARITY: no tool flies a validated build raw): the spec the game flies
const LB = require(path.join(__dirname, '_load_build.js'));
const load = f => LB.gameSpec(JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')));
const clone = o => JSON.parse(JSON.stringify(o));
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', cessna: 'builds/cessna172_2026-09-20_corrected.json',
                 ruckus: 'builds/candidates/ruckus_std_2026-11-09.json' };

function rigidityRank(nodes, beams) {           // GATE GEN's (tools/test_gen.js G4), verbatim
  const n3 = nodes.length * 3;
  const rows = beams.map(b => {
    const r = new Float64Array(n3);
    const A = nodes[b.a].p, B = nodes[b.b].p;
    let dx = B[0]-A[0], dy = B[1]-A[1], dz = B[2]-A[2];
    const L = Math.hypot(dx, dy, dz) || 1;
    dx /= L; dy /= L; dz /= L;
    r[b.a*3] = dx; r[b.a*3+1] = dy; r[b.a*3+2] = dz;
    r[b.b*3] = -dx; r[b.b*3+1] = -dy; r[b.b*3+2] = -dz;
    return r;
  });
  let rank = 0, big = 0;
  for (let col = 0; col < n3 && rank < rows.length; col++) {
    let piv = -1, best = 0;
    for (let r = rank; r < rows.length; r++) { const v = Math.abs(rows[r][col]); if (v > best) { best = v; piv = r; } }
    big = Math.max(big, best);
    if (piv < 0 || best < 1e-9 * Math.max(1, big)) continue;
    const t = rows[rank]; rows[rank] = rows[piv]; rows[piv] = t;
    const pr = rows[rank], pv = pr[col];
    for (let r = rank + 1; r < rows.length; r++) {
      const f = rows[r][col] / pv;
      if (f === 0) continue;
      for (let c = col; c < n3; c++) rows[r][c] -= f * pr[c];
    }
    rank++;
  }
  return rank;
}
const mass = d => d.nodes.reduce((a, n) => a + n.m, 0);
const sideMass = (d, s) => d.nodes.reduce((a, n) => a + (Math.sign(n.p[2]) === s ? n.m : 0), 0);
const same = (a, b) => JSON.stringify(a.nodes) === JSON.stringify(b.nodes) && JSON.stringify(a.beams) === JSON.stringify(b.beams)
  && JSON.stringify(a.params) === JSON.stringify(b.params) && C.genCertKey(a) === C.genCertKey(b);

console.log('1. absent rows are the old bytes');
for (const k in BUILDS) {
  const s = load(BUILDS[k]);
  const d0 = C.buildGen(clone(s));
  const s1 = clone(s); s1.bracing.section = null; s1.bracing.jury = null; s1.cage.wgStrutSec = 0; s1.cage.wgJury = 0;
  check(same(d0, C.buildGen(s1)), k + ': section null, jury null, cage rows at 0 -> nodes, beams, params, cert key identical');
  check(!d0.beams.some(b => 'strut' in b || 'round' in b) && !('strutDrag' in d0.refs) && !('strutCdA' in d0.params),
        k + ': no member, ref or param carries the new fields');
}

console.log('2-4. every option on the Cub and the Ruckus');
const T = C.GEN_STRUT_OPT;
for (const k of ['cub', 'ruckus']) {
  const s = load(BUILDS[k]);
  for (const struts of [1, 2]) {
    const sb = clone(s); sb.bracing.struts = struts;
    const d0 = C.buildGen(clone(sb)), m0 = mass(d0), cda0 = d0.params.fusCdA[0];
    const kLift = d0.beams.find(b => b.ext && b.cls === 'wing').k;
    const semi = d0.spec.geom.semi;
    for (const section of [null, 'tube']) for (const jury of [null, 'wing', 'cabin']) {
      if (!section && !jury) continue;
      const sx = clone(sb); if (section) sx.bracing.section = section; if (jury) sx.bracing.jury = jury;
      const d = C.buildGen(sx), tag = `${k} struts ${struts} ${section || 'profiled'} jury ${jury || 'none'}`;
      const rank = rigidityRank(d.nodes, d.beams), want = 3 * d.nodes.length - 6;
      check(rank === want, `${tag}: rigid (rank ${rank} / ${want})`);
      check(Math.abs(sideMass(d, 1) - sideMass(d, -1)) < 1e-3, `${tag}: left / right mass symmetric`);
      const juries = d.beams.filter(b => b.strut === 'jury'), drawnJ = juries.filter(b => b.ext);
      const drawnLift = d0.beams.filter(b => b.ext && b.cls === 'wing').length;
      const jl = drawnJ.reduce((a, b) => a + b.L, 0);
      if (jury) {
        check(d.nodes.filter(n => n.tag === 'JS').length === 4 && juries.length === 4 && drawnJ.length === drawnLift,
              `${tag}: 4 clamps, 4 juries, ${drawnJ.length} drawn = the ${drawnLift} drawn lift struts`);
        const halves = d.beams.filter(b => b.strut === 'half');
        // (the class's k is the BUILD'S: it scales with the build's mass, which the jury moved - so against this
        // build's own class member, the tie)
        const kCls = d.beams.find(b => b.strut === 'tie').k;
        check(halves.length === 8 && halves.every(b => Math.abs(b.k - 2 * kCls) < 1e-6 * kCls)
              && Math.abs(kCls - kLift) < 0.03 * kLift,
              `${tag}: 8 halves, each at 2 x the class k (series = the strut; class k within 3 % of the base's: KS follows the mass)`);
        const dm = mass(d) - m0;
        check(dm > 0 && dm < 0.03 * m0, `${tag}: mass +${dm.toFixed(2)} kg (${jl.toFixed(2)} m of drawn jury, ${(dm / jl).toFixed(2)} kg/m)`);
      } else check(Math.abs(mass(d) - m0) < 1e-9 && d.nodes.length === d0.nodes.length, `${tag}: same nodes and mass (a section is no member)`);
      const lift = d.beams.filter(b => b.ext && b.cls === 'wing' && (b.strut === 'lift' || b.strut === 'half')).reduce((a, b) => a + b.L, 0);
      const want4 = jl * T.juryT * (section ? T.cdRound : T.cdStream)
        + (section ? lift * T.cdRound * T.tubeD - 2 * 0.10 * (0.55 * semi * 1.12) * 0.06 : 0);
      // ON THE STRUTS' OWN BLOBS (one a side, refs.strutDrag), the body's row untouched
      const sbl = d.refs.strutDrag || [];
      check(Math.abs(d.params.fusCdA[0] - cda0) < 1e-12 && sbl.length === 2 && sbl.every(ids => ids.length === 4)
            && sbl[0].every(i => d.nodes[i].p[2] * d.nodes[sbl[0][0]].p[2] > 0),
            `${tag}: the drag on two strut blobs (one a side), not on the body's axial row`);
      const dc = d.params.strutCdA ? d.params.strutCdA[0] * sbl.length : 0;
      check(Math.abs(dc - want4) < 1e-9 && dc > 0, `${tag}: strut drag area +${dc.toFixed(4)} m2 (the bill: ${want4.toFixed(4)})`);
    }
  }
}

console.log('5. keys');
const cg = C.genStolCageOff({ wgStrutSec: 0, wgJury: 0, wgSpan: 9 });
check(!('wgStrutSec' in cg) && !('wgJury' in cg) && cg.wgSpan === 9, 'genStolCageOff drops the strut rows at 0');
const cg1 = C.genStolCageOff({ wgStrutSec: 1, wgJury: 2 });
check(cg1.wgStrutSec === 1 && cg1.wgJury === 2, '...and keeps them when set');

console.log('GATE STRUTOPT: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
process.exitCode = fails.length ? 1 : 0;
