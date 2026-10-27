#!/usr/bin/env node
// newshapes_build.js - NEW-SHAPES-1 (G3510-G3519, cloud, 2026-10-26): THE ROUND BODY AND THE OPEN OCCUPANT SECTIONS,
// PROVEN ON TWO AEROPLANES. A TOOL, not a gate. The user (23 Oct): "the proofs would be a stearman and a moth".
//
// Each aeroplane is born as the shed births one: the archetype card the design flow carries (_cage_design.js
// ARCHETYPES 'stearman' / 'tigermoth': the biplane, the engine from the catalogue, the gear, the wires - and since
// G3517 the round body, the two open sections and the rear-seat pilot), designBake -> the birth spec, the second person
// aboard (FLY), then THE PAGE'S OWN LOAD
// DOOR (tools/_load_build.js: the editor's layers draw it headless, the join measures it, the energy layer fits the
// tanks) -> buildGen. Nothing is patched in memory.
//
//   node tools/newshapes_build.js --build          (re)write tools/fixtures/{stearman,tigermoth}_2026-10.json
//   node tools/newshapes_build.js [--only=stearman|tigermoth] [--no-fly] [--maxS=420] [--json=<file>]
//                                                   the fixture's join, sheet, design check, the openings as drawn,
//                                                   the pilot's circuit, against the real aeroplane
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const flag = k => argv.includes('--' + k);

// ---- THE REAL AEROPLANES (sources: HANDOVER G3510's table; as published, sources disagree where marked) -------------
const REAL = {
  stearman: { name: 'Boeing-Stearman Model 75 / PT-17 (Continental R-670 / W-670, 220 hp)',
    span: 9.80, length: 7.54, Sw: 27.6, empty: 878, mtow: 1232, VsKt: [44, 48], VmaxKt: 108, climbMs: [4.1, 4.3] },
  tigermoth: { name: 'de Havilland DH.82A Tiger Moth (DH Gipsy Major I, 130 hp)',
    span: 8.94, length: 7.29, Sw: 22.2, empty: [495, 506], mtow: 828, VsKt: 37, VmaxKt: [90, 95], climbMs: [3.4, 4.1] },
  camel: { name: 'Sopwith Camel F.1 (Clerget 9B rotary, 130 hp)',
    span: 8.53, length: 5.71, Sw: 21.46, empty: [403, 434], mtow: 660, VsKt: null, VmaxKt: 98, climbMs: [4.6, 4.9] },
};

// ---- THE ROWS ARE THE CARDS' (G3517) -------------------------------------------------------------------------------
// The shape's rows were tuned here (the coaming under the chin, the prop clearance, the margin) and then MOVED INTO
// THE ARCHETYPE CARDS themselves (_cage_design.js 'stearman' / 'tigermoth', OPEN_TANDEM): the fixture is the card,
// born as the design flow births it, with one loading on top - the second person aboard, in the front seat (the
// pilot flies from the rear), so the proof flies at the type's gross and not solo.
const FLY = { paxOcc1: 1 };
const FIX = k => path.join(T, 'fixtures', k + '_2026-10.json');

function birth(key) {
  const BJ = require('./_bake_joined.js');
  const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === key);
  const spec = D.designBake(a.sel, a.over);
  spec.cage = Object.assign({}, spec.cage, FLY, JSON.parse(opt('over', '{}')));
  return { v: spec.v, birth: 1, name: a.name.replace('-alike', '') + (key === 'camel' ? ' (round body, open cockpit)' : ' (round body, open cockpits)'),
    what: 'NEW-SHAPES-1 G3510-G3519 - ' + REAL[key].name + ' through the garage\'s own path (tools/newshapes_build.js)', spec };
}

function buildFixture(key) {
  const LB = require('./_load_build.js');
  const env = birth(key);
  const r = LB.gameSpecFull(env);
  return { env: { what: env.what, v: env.v, name: env.name, spec: r.spec }, errors: r.errors || [], notes: r.notes };
}

// the openings as DRAWN, off the editor's own sheet (cage units -> metres): each opening's length, width, the decking
// between them, the screens, the coaming; and the skin's boundary loops (an opening is ONE loop: no sliver, no pane)
function drawnOpenings(spec) {
  const BJ = require('./_bake_joined.js');
  BJ.loadPanel();
  const C2 = require('./_cage_gen.js');
  const P = C2.cageFromSpec(spec);
  const FS = (C2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const sh = C2.cageSheet(P, { level: 2 });
  const m = sh.sheet;
  const SKIN = new Set(['body', 'ceilingLoop', 'waistband', 'floorLoop', 'taper', 'pillarTail', 'pillarTaper',
    'pillarPassenger', 'pillarCabin', 'pillarWindow', 'pillarFront']);
  const ec = new Map();
  for (const f of m.F) if (SKIN.has(f.m) && !f.cutPart)
    for (let k = 0; k < f.v.length; k++) { const a = f.v[k], b = f.v[(k + 1) % f.v.length];
      const key = a < b ? a + '_' + b : b + '_' + a; ec.set(key, (ec.get(key) || []).concat([[a, b]])); }
  const nxt = new Map(); let over = 0;
  for (const [, l] of ec) { if (l.length === 1) nxt.set(l[0][0], l[0][1]); if (l.length > 2) over++; }
  const seen = new Set(), loops = [];
  for (const s0 of nxt.keys()) { if (seen.has(s0)) continue; const pts = []; let v = s0;
    while (!seen.has(v) && nxt.has(v)) { seen.add(v); pts.push(m.V[v]); v = nxt.get(v); } loops.push(pts); }
  const box = p => { const zs = p.map(q => q[2]), xs = p.map(q => Math.abs(q[0])), ys = p.map(q => q[1]);
    return { z0: Math.min(...zs) * FS, z1: Math.max(...zs) * FS, w: 2 * Math.max(...xs) * FS, y1: Math.max(...ys) * FS,
             rail: Math.min(...ys) * FS, n: p.length }; };
  const holes = loops.map(box).filter(b => b.z1 - b.z0 > 0.05).sort((a, b) => b.z1 - a.z1);
  // CLEAN FROM THE INSIDE TOO: no face of anything else the cage drew (the interior's truss, liners, bulkheads, the
  // dash) reaches into an opening - a point counts when it is above the opening's rail and inside its outline in
  // plan by more than 15 mm (the liner's own rim wall stands ON the edge, which is what a lining's edge is)
  const holeLoops = loops.filter(p => { const zs = p.map(q => q[2]); return Math.max(...zs) - Math.min(...zs) > 0.05 / FS
    && Math.max(...zs) - Math.min(...zs) < 3 && Math.min(...p.map(q => q[1])) > 0; });
  const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j]; if ((a[2] > z) !== (b[2] > z) && x < (b[0] - a[0]) * (z - a[2]) / (b[2] - a[2]) + a[0]) c = !c; } return c; };
  const dSeg = (x, z, P) => { let d = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
    const ex = b[0] - a[0], ez = b[2] - a[2], L2 = ex * ex + ez * ez || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[2]) * ez) / L2));
    d = Math.min(d, Math.hypot(x - a[0] - t * ex, z - a[2] - t * ez)); } return d; };
  const intrude = {};
  const SKIP = new Set([...SKIN, 'windshield', 'paneEdge', 'joint']);
  for (const f of m.F) {
    if (SKIP.has(f.m)) continue;
    for (const i of f.v) { const p = m.V[i];
      for (const H of holeLoops) { const yR = Math.min(...H.map(q => q[1]));
        if (p[1] > yR && inPoly(p[0], p[2], H) && dSeg(p[0], p[2], H) * FS > 0.015) intrude[f.m] = (intrude[f.m] || 0) + 1; } }
  }
  const count = mm => m.F.filter(f => f.m === mm).length;
  return { FS, holes, intrude, faceLoops: loops.length, overShared: over, screens: count('windshield'), joint: count('joint'),
    rim: (m.openLoops || []).length };
}

// THE OCCUPANTS IN THEIR OPENINGS: the crew layer as the load chain drew it (tools/_crew_head_probe.js) - each seated
// head's top inside an opening's fore/aft extent, and how far it stands over the coaming rail
function occupants(key, D) {
  const LB = require('./_load_build.js');
  const env = process.env.FLYDIY_JOIN_PROBE, nc = process.env.FLYDIY_JOIN_NOCACHE;
  process.env.FLYDIY_JOIN_PROBE = path.join(T, '_crew_head_probe.js'); process.env.FLYDIY_JOIN_NOCACHE = '1';
  let L; try { L = LB.loadBuild(path.relative(ROOT, FIX(key))); }
  finally { if (env == null) delete process.env.FLYDIY_JOIN_PROBE; else process.env.FLYDIY_JOIN_PROBE = env;
            if (nc == null) delete process.env.FLYDIY_JOIN_NOCACHE; else process.env.FLYDIY_JOIN_NOCACHE = nc; }
  const o = (L.probe && L.probe.out) || {};
  return ['edDum1', 'edDum2'].filter(k => o[k]).map(k => {
    const [x, y, z] = o[k].at, h = D.holes.find(q => z >= q.z0 && z <= q.z1);
    return { who: k === 'edDum1' ? 'pilot' : 'second', z, headTop: y, inOpening: !!h,
             overRail: h ? y - h.rail : null, overCrown: h ? y - h.y1 : null };
  });
}

function report(key, L, C, PR) {
  const R = REAL[key];
  const def = C.buildGen(JSON.parse(JSON.stringify(L.spec)));
  const sh = C.genShakedown(def, { corners: true });
  const kt = v => v / 0.514444, rng = v => Array.isArray(v) ? v.join('-') : String(v);
  const S = def.spec, g = S.geom || {};
  let m = 0; for (const n of def.nodes) m += n.m;
  const dc = sh.design ? sh.design.rows : [];
  const bad = dc.filter(r => r.level === 'fail'), warn = dc.filter(r => r.level === 'warn');
  const D = drawnOpenings(L.spec);
  console.log('\n== ' + key + ' - ' + L.name);
  console.log('  load chain: join errors ' + (L.errors || []).length + (L.errors && L.errors.length ? ' ' + JSON.stringify(L.errors) : ''));
  console.log('  design check: ' + dc.length + ' rows, ' + bad.length + ' fail, ' + warn.length + ' warn' +
    (bad.length ? ' FAIL ' + bad.map(r => r.id + '=' + r.value).join(' ') : '') + (warn.length ? ' warn ' + warn.map(r => r.id + '=' + r.value).join(' ') : ''));
  console.log('  drawn: ' + D.holes.length + ' openings ' + D.holes.map(h => (h.z1 - h.z0).toFixed(2) + ' x ' + h.w.toFixed(2) + ' m (' + h.n + ' edges)').join(', ') +
    (D.holes.length >= 2 ? '; decking between ' + (D.holes[0].z0 - D.holes[1].z1).toFixed(2) + ' m' : '') +
    '; skin boundary loops ' + D.faceLoops + ' (the openings + the engine face), over-shared edges ' + D.overShared +
    '; coaming loops ' + D.rim + ', screen faces ' + D.screens + '; inside the openings ' + JSON.stringify(D.intrude));
  const OC = occupants(key, D);
  D.occupants = OC;
  console.log('  occupants: ' + OC.map(q => q.who + ' head ' + (q.inOpening ? 'in an opening, ' + (100 * q.overRail).toFixed(0) +
    ' cm over the coaming rail, ' + (100 * q.overCrown).toFixed(0) + ' cm over the crown' : 'NOT under an opening (z ' + q.z + ')')).join('; '));
  console.log('  cabin: ' + JSON.stringify({ glazing: S.cabin && S.cabin.glazing, seats: S.seats, glazedM2: S.cabin && S.cabin.glazedM2 }) +
    '  drag screen ' + (S.gen && S.gen.drag ? '' : '') + ((def.params.gen || {}).drag ? JSON.stringify((def.params.gen.drag || {}).screen) : ''));
  const rows = [
    ['span m', R.span, g.span || (S.wings && S.wings[0] && S.wings[0].span), 2],
    ['wing area m2 (both planes)', R.Sw, sh.Sw || g.Sw, 1],
    ['empty kg', rng(R.empty), sh.empty, 0], ['flown mass kg', '(MTOW ' + R.mtow + ')', m, 0],
    ['Vs clean kt', rng(R.VsKt), kt(sh.Vs), 0], ['Vmax / cruise kt (sheet)', rng(R.VmaxKt), kt(sh.VCruise), 0],
    ['climb m/s (sheet)', rng(R.climbMs), sh.climbRate, 1], ['take-off roll m (sheet)', '-', sh.TORun, 0],
    ['static margin', '-', sh.staticMargin, 3], ['prop clearance m (level)', '>= 0.229 (FAR 23.925)', sh.propClear, 3],
    ['price (ledger)', '-', sh.cost, 0],
  ];
  for (const [k, r, v, d] of rows) console.log('    ' + k.padEnd(28) + String(r).padStart(14) + '  ' + (v == null || !isFinite(v) ? '-' : (+v).toFixed(d)).padStart(10));
  return { def, sh, D, mass: m, dc };
}

if (require.main === module) {
  const keys = opt('only', 'stearman,tigermoth').split(',');
  if (flag('build')) {
    for (const k of keys) {
      const r = buildFixture(k);
      fs.writeFileSync(FIX(k), JSON.stringify(r.env, null, 1) + '\n');
      console.log('wrote ' + path.relative(ROOT, FIX(k)) + ' (join errors: ' + r.errors.length + ')');
      for (const e of r.errors) console.log('  ERRS ' + e);
    }
    if (!flag('report')) process.exit(0);
  }
  const LB = require('./_load_build.js');
  const C = require('./flight_core.js');
  const PR = require('./dc3_probe.js');
  const out = {};
  for (const k of keys) {
    const L = LB.loadBuild(path.relative(ROOT, FIX(k)));
    const r = report(k, L, C, PR);
    out[k] = { errors: L.errors, drawn: r.D, design: r.dc.map(x => ({ id: x.id, value: x.value, level: x.level })), mass: r.mass };
    if (!flag('no-fly')) {
      const F = PR.fly(C, r.def, +opt('maxS', 420));
      PR.printFlight(F);
      out[k].flight = F;
    }
  }
  if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
}
module.exports = { FLY, REAL, birth, buildFixture, drawnOpenings, FIX };
