#!/usr/bin/env node
// THE BELLY POD'S TRIALS (G2417, BELLY-POD): the default pod on each validated build - whether it fits, its clearance
// per attitude, the deepest pod each one takes, its drag and its cost in cruise / climb / range (the probe's and the
// flown leg's, reports/evidence/POD/flights.json), the CG full against the four loading corners, the mounts under a
// real certificate. Evidence, not a gate (GATE POD gates the rules): writes reports/evidence/POD/trials.{json,md}.
//
//   node tools/pod_trials.js [--no-cert]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const L = require(path.join(T, '_treecrash_lib.js'));
const C = L.core();
const B = require(path.join(ROOT, 'src', 'viewer', 'bench.js'));
const CERT = !process.argv.includes('--no-cert');
const BUILDS = {
  cub: { label: 'the user\'s Cub (A-65, taildragger)', file: 'builds/cub_2026-09-20_corrected.json' },
  jodel: { label: 'the Jodel (A-65, taildragger)', file: 'builds/jodel_2026-09-20_corrected.json' },
  c172: { label: 'the Cessna 172 (tricycle)', file: 'builds/cessna172_2026-09-20_corrected.json' },
  floats: { label: 'the C172 on floats', file: 'bugReports/cessnaFloatsWOrks.json' },
  twinf: { label: 'the twin on floats (ultralight)', file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json',
           patch: j => { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); return j; } },
};
const clone = o => JSON.parse(JSON.stringify(o));
const n = (v, d) => (v == null || !isFinite(v)) ? '—' : (+v).toFixed(d);
const sgn = (v, d) => (v == null || !isFinite(v)) ? '—' : (v > 0 ? '+' : '') + (+v).toFixed(d);
const specOf = k => { let j = JSON.parse(fs.readFileSync(path.join(ROOT, BUILDS[k].file), 'utf8')); if (BUILDS[k].patch) j = BUILDS[k].patch(j); return j.spec || j; };
const build = s => C.buildGen(C.genMigrateSpec(clone(s)));
const FL = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'reports/evidence/POD/flights.json'), 'utf8')); } catch (e) { return {}; } })();
const row = B.BENCH_TESTS.find(t => t.id === 'pod');

const out = {};
for (const k of Object.keys(BUILDS)) {
  const t0 = Date.now(), spec = specOf(k);
  const d0 = build(spec), s0 = C.genShakedown(d0, {});
  const sp = clone(spec); sp.pod = { on: 1 };
  const d1 = build(sp), s1 = C.genShakedown(d1, {});
  const p = s1.pod;
  // the deepest pod it takes: the depth at which the worst attitude's clearance reaches 0 (strikes) and 0.08 (amber)
  const worstAt = depth => { const q = clone(sp); q.pod.depth = depth; const d = build(q); return C.genPodClearance(d, d.parts.ledger ? C.genShakedown(d, { slim: true, corners: false }).mass : 0).worst.clear; };
  const solve = target => { let lo = 0.12, hi = 0.60; if (worstAt(lo) < target) return null; if (worstAt(hi) >= target) return hi;
    for (let i = 0; i < 12; i++) { const m = 0.5 * (lo + hi); if (worstAt(m) >= target) lo = m; else hi = m; } return lo; };
  const maxDepth = solve(0), maxDepthWarn = solve(0.08);
  let cert = null;
  if (CERT) {
    const sf = clone(sp); sf.pod.loadKg = d1.parts.pod.maxKg;
    const df = build(sf), tc = Date.now();
    const cf = C.genCertify(df);
    const MR = C.genCertPodMounts(df, cf);
    cert = { s: (Date.now() - tc) / 1000, rows: MR.rows.map(r => ({ ring: r.ring, side: r.side, kg: r.kg, upN: r.up, envN: r.envelope, share: r.share })), worstShare: MR.worstShare };
  }
  const bench = row.run({ shake: () => s1 });
  out[k] = { label: BUILDS[k].label, pod: { len: p.len, width: p.width, depth: p.depth, x0: p.x0, x1: p.x1, litres: p.litres, floorM2: p.floorM2,
             maxKg: p.maxKg, shellKg: p.shellKg, price: p.price, door: p.door, mounts: p.mounts },
             clearance: p.clearance, maxDepth, maxDepthWarn,
             drag: { cda: p.cda, cdFrontal: p.cdFrontal, fineness: p.fineness, share: p.dragShare, axial0: d0.params.gen.drag.axial, axial1: d1.params.gen.drag.axial },
             cruise: p.cruise,
             sheet: { VCruise0: s0.VCruise, VCruise1: s1.VCruise, climb0: s0.climbRate, climb1: s1.climbRate, range0: s0.rangeKm, range1: s1.rangeKm,
                      empty0: s0.empty, empty1: s1.empty, cost0: s0.cost, cost1: s1.cost, mass0: s0.mass, mass1: s1.mass, sm0: s0.staticMargin, sm1: s1.staticMargin },
             balance: p.balance, envelope: s1.envelope ? { fwdPct: s1.envelope.fwd.cgPct, aftPct: s1.envelope.aft.cgPct, worstSM: s1.envelope.staticMarginAft } : null,
             flown: ['off', 'on', 'full'].map(m => FL[k + '_' + m] && FL[k + '_' + m].leg ? Object.assign({ mode: m }, FL[k + '_' + m].leg) : null),
             cert, bench: { verdict: bench.verdict, ok: bench.ok, note: bench.note }, s: (Date.now() - t0) / 1000 };
  console.error(k + ' ' + out[k].s.toFixed(0) + ' s');
}
fs.mkdirSync(path.join(ROOT, 'reports/evidence/POD'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/evidence/POD/trials.json'), JSON.stringify(out, null, 1));

// the table
const md = [];
md.push('# BELLY-POD trials (G2417) — the default pod (2.0 × 0.56 × 0.28 m, nose fairing 22 %, boat-tail 30 %, centred on the quarter chord or 0.15 m aft of the firewall) on each validated build');
md.push('');
md.push('| build | fits? | clearance per attitude (m) | deepest pod it takes (strike / amber 0.08 m) | hold · rated | shell · price | CdA (Cd frontal) · share of body | cruise rule (probe) | VCruise (sheet, clamped) | climb | range (sheet) | flown TAS off / on / full (km/h) | flown range off / on / full (km) | CG full (% MAC) · margin | mounts (pod full, cert) |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const k in out) {
  const o = out[k], c = o.clearance, b = o.balance || {}, cr = o.cruise || {}, sh = o.sheet, f = o.flown;
  const env = o.envelope ? ' (corners ' + n(o.envelope.fwdPct * 100, 1) + '–' + n(o.envelope.aftPct * 100, 1) + ')' : '';
  md.push('| ' + o.label + ' | ' + (o.bench.ok ? 'yes' : '**' + o.bench.verdict + '**') +
    ' | ' + c.rows.map(r => r.name + ' ' + n(r.clear, 3)).join('; ') + ((c.legs || []).length ? '; mains beside it ' + n(c.legs[0].gap, 3) : '') +
    ' | ' + n(o.maxDepth, 2) + ' / ' + n(o.maxDepthWarn, 2) + ' m' +
    ' | ' + n(o.pod.litres, 0) + ' L · ' + o.pod.maxKg + ' kg | ' + n(o.pod.shellKg, 1) + ' kg · ' + o.pod.price + ' cr' +
    ' | ' + n(o.drag.cda, 4) + ' m² (' + n(o.drag.cdFrontal, 3) + ') · ' + n(o.drag.share * 100, 1) + ' %' +
    ' | ' + n(cr.vWithout * 3.6, 1) + ' → ' + n(cr.vWith * 3.6, 1) + ' km/h (' + sgn(cr.dPct * 100, 2) + ' %)' +
    ' | ' + n(sh.VCruise0 * 3.6, 1) + ' → ' + n(sh.VCruise1 * 3.6, 1) +
    ' | ' + n(sh.climb0, 2) + ' → ' + n(sh.climb1, 2) + ' m/s (drag alone ' + sgn(cr.dClimb, 3) + ')' +
    ' | ' + n(sh.range0, 0) + ' → ' + n(sh.range1, 0) + ' km' +
    ' | ' + f.map(x => x ? n(x.tasKmh, 1) : '—').join(' / ') + ' | ' + f.map(x => x ? n(x.rangeKm, 0) : '—').join(' / ') +
    ' | ' + n(b.cgAsIsPct * 100, 1) + ' → ' + n(b.cgPct * 100, 1) + env + ' · ' + n(sh.sm1, 3) + ' → ' + n(b.staticMargin, 3) +
    ' | ' + (o.cert ? o.cert.rows.map(r => n(r.kg, 1)).join('/') + ' kg; ' + n(Math.max(...o.cert.rows.map(r => r.upN)) / 1000, 2) + ' kN at +3.8 g; ≤ ' + n(o.cert.worstShare * 100, 0) + ' % of the node\'s certified envelope' : '—') + ' |');
}
fs.writeFileSync(path.join(ROOT, 'reports/evidence/POD/trials.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
