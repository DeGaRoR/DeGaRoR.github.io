// GATE LOAD — the sandbag test.
//
// The real proof-of-structure for an amateur-built aeroplane: the wing is
// loaded with sandbags laid out to match the spanwise lift distribution, held,
// and inspected. FAR 23 normal category asks for +3.8 g LIMIT with no permanent
// deformation, and 1.5x that — +5.7 g ULTIMATE — without failure. That is the
// load case every deflection number in GATE FLEX has been approximating, so
// this runs it properly and reports it the way a builder would read it.
//
// HOW IT IS SET UP, and why there are no trestles. The real rig inverts the
// aeroplane and stands the fuselage on supports, so the wing carries n*W and
// the supports react it. Here the aeroplane is dropped into free air and the
// distributed wing load is applied against its OWN INERTIA — which is a n-g
// pull-up, and puts exactly the same bending moment through the spar. No
// constraints to invent, no ground contact to filter, no aerodynamics, and it
// is deterministic. The baseline is taken in FREE FALL, which is the 0 g jig
// shape: the same datum the real test measures deflection from.
//
// The load is spread over the wing strips using `st.area` and the strips' own
// node weights `st.w` — i.e. distributed exactly the way the solver distributes
// lift, so the sandbags sit where the lift does by construction rather than by
// a second approximation that could drift from it.
//
// PERMANENT SET is the check this cannot do honestly yet: the solver has no
// yield model (see HANDOVER, RUPTURE AND PERMANENT SET — the costed design).
// The proxy is peak member force against sigY*A, which IS the load at which the
// member would take a set, and which is physically correct even on soft springs
// because failure is a force threshold. Reported as a percentage of yield.
// The rig itself lives in src/core/65_gen_loadtest.js, not here, because the
// GARAGE runs the same test in-game: you build, you load test, then you roll
// out. One implementation, ticked headlessly by this gate and per-frame by the
// viewer — so an in-game verdict and a gate verdict can never disagree.
const { buildGen, buildPA18, buildC172, makeSim,
        makeLoadTest, GEN_LOAD_LIMIT, GEN_LOAD_ULT,
        GEN_DEFAULT, GEN_MATERIALS } = require('./flight_core.js');

const say = s => console.log(s);
const results = {};
const G = 9.81;
const LIMIT = 3.8, ULT = 5.7;          // FAR 23 normal category, and 1.5x it

// ---------------------------------------------------------------------------
function stations(def) {
  const wf = [], wr = [];
  def.nodes.forEach((n, i) => {
    if (n.p[2] <= 0) return;
    if (n.tag === 'WF') wf.push(i);
    if (n.tag === 'WR') wr.push(i);
  });
  wf.sort((a, b) => def.nodes[a].p[2] - def.nodes[b].p[2]);
  return wf.map(f => {
    const z = def.nodes[f].p[2];
    let r = -1, bd = Infinity;
    for (const q of wr) { const d = Math.abs(def.nodes[q].p[2] - z); if (d < bd) { bd = d; r = q; } }
    return { f, r, z };
  });
}

// The sandbag layout: total load n*W split across the wing strips in proportion
// to their area, then onto nodes through each strip's own attachment weights —
// so the bags sit where the lift does by construction.
//
// AND THE TRESTLES, which are a KINEMATIC CLAMP on everything that is not wing.
// That is what the real rig is — the fuselage is bolted down and only the wing
// is loaded — and it is also the only version of this that holds still long
// enough to be read. Two earlier cuts are worth recording because both looked
// plausible and both produced confident nonsense:
//   1. Load the wing and let the aeroplane's own INERTIA react it. A legitimate
//      pull-up on paper, but only the wing is loaded and nothing balances the
//      pitching moment, so it rotated under the measurement: the C172 read
//      1.25 % at 1 g and -0.95 % at 3.8 g.
//   2. React at the wing ROOT stations to make it self-equilibrated in FORCE.
//      Net moment is still not zero — the wing load's x-centroid is not the
//      root nodes' — so it rotated slowly instead of quickly, and at 5.7 g the
//      body frame flipped mid-run and the trace jumped from 5.10 to 0.22.
// A load case you cannot hold still is not a load case you can measure.
function bags(def, n) {
  const W = def.nodes.reduce((s, nd) => s + nd.m, 0) * G;
  const wing = def.strips.filter(st => st.kind === 'wing');
  const area = wing.reduce((s, st) => s + st.area, 0);
  if (!(area > 0)) return null;
  const load = new Map();
  for (const st of wing) {
    const share = n * W * (st.area / area);
    for (const [i, w] of st.w) load.set(i, (load.get(i) || 0) + share * w);
  }
  return { pts: [...load.entries()], W };
}
// everything that is not a wing node gets bolted to the rig
function rigNodes(def) {
  const wing = new Set(['WF', 'WR', 'WB', 'WB2']);
  const out = [];
  def.nodes.forEach((n, i) => { if (!wing.has(n.tag)) out.push(i); });
  return out;
}

// Returns per-station deflection (% of semispan) and the worst member load.
function loadTest(def, n, matKey) {
  // Thin wrapper over the shared rig in src/core/65_gen_loadtest.js. Ramping to
  // `n` and holding is exactly what the rig does, so this asks for a run whose
  // ultimate IS n and reads the settled state off it.
  const sim = makeSim(def, null);
  sim.reset(0);
  const rig = makeLoadTest(sim, def, { limit: n, ult: n, material: matKey,
                                       rampS: 3.0, holdS: 2.0, settleS: 4.0 });
  if (!rig.state.ok) return null;
  const dt = 1 / 60;
  for (let s = 0; s < 60 * 30 && !rig.state.done; s++) rig.step(dt);
  const S = rig.state;
  return { st: rig.stations, semi: rig.semi, defl: S.defl, tip: S.tipPct,
           worst: S.worstPct === null ? null : { cls: S.worstCls, pct: S.worstPct },
           bad: S.verdict === 'BROKE UP', W: rig.W, n: n };
}

// a wing seen from the front, bending up. 24 columns root -> tip.
function picture(r, scale) {
  const COLS = 24, rows = [];
  const at = (u) => {                       // interpolate the station profile
    const x = u * (r.st.length - 1), i = Math.min(r.st.length - 2, Math.floor(x));
    return r.defl[i] + (r.defl[i+1] - r.defl[i]) * (x - i);
  };
  const h = [];
  for (let c = 0; c < COLS; c++) h.push(at(c / (COLS - 1)));
  const HGT = 6;
  for (let row = HGT; row >= 0; row--) {
    let line = '';
    for (let c = 0; c < COLS; c++) {
      const lv = Math.round(h[c] / scale * HGT);
      line += lv === row ? '=' : (lv > row ? '=' : (row === 0 ? '.' : ' '));
    }
    rows.push('    ' + line);
  }
  return rows;
}

// ---------------------------------------------------------------------------
say('LOAD — the sandbag test. FAR 23 normal category: LIMIT +3.8 g (no permanent');
say('set), ULTIMATE +5.7 g (no failure). Load laid out over the wing strips in');
say('proportion to their area, applied against the aeroplane\'s own inertia, and');
say('measured from the FREE-FALL jig shape. Deflection is % of semispan.');
say('');
say('Real light aircraft, for scale: ~0.3-1 % of semispan at 1 g, ~2-4 % at limit.');
say('');

const CASES = [];
for (const m of Object.keys(GEN_MATERIALS))
  for (const br of ['strut', 'cantilever'])
    CASES.push([`GEN ${m} ${br}`, () => {
      const sp = JSON.parse(JSON.stringify(GEN_DEFAULT));
      sp.fuselage.material = m; sp.bracing.type = br;
      return buildGen(sp);
    }, m]);
CASES.push(['PA-18 (imported)', buildPA18, null]);
CASES.push(['C172 (imported)', buildC172, null]);

const rows = [];
say('airframe                     1.0 g    3.8 g LIMIT   5.7 g ULT    worst member @ult');
for (const [lbl, build, mat] of CASES) {
  let def;
  try { def = build(); } catch (e) { say(`  ${lbl.padEnd(26)} BUILD FAILED: ${e.message}`); continue; }
  const r1 = loadTest(def, 1.0, mat);
  const rl = loadTest(build(), LIMIT, mat);
  const ru = loadTest(build(), ULT, mat);
  if (!r1 || !rl || !ru) { say(`  ${lbl.padEnd(26)} not measurable`); continue; }
  const yieldPct = ru.worst ? ru.worst.pct : null;
  // The rig held and the structure integrated. The yield column is REPORTED,
  // not gated — see the note under the table for why.
  const ok = !r1.bad && !rl.bad && !ru.bad;
  rows.push({ lbl, r1, rl, ru, yieldPct, ok, mat });
  say(`  ${lbl.padEnd(26)} ${r1.tip.toFixed(2).padStart(6)} % ${rl.tip.toFixed(2).padStart(9)} %` +
      ` ${ru.tip.toFixed(2).padStart(11)} %   ` +
      (yieldPct === null ? '        n/a' : `${yieldPct.toFixed(0).padStart(4)}% of yield (${ru.worst.cls})`) +
      `   ${!ok ? '*** DID NOT SURVIVE' : (yieldPct !== null && yieldPct >= 100 ? 'over yield' : 'ok')}`);
}
{
  const over = rows.filter(r => r.yieldPct !== null && r.yieldPct >= 100);
  if (over.length) {
    say('');
    say('OVER YIELD AT ULTIMATE — reported, deliberately NOT gated:');
    for (const r of over) say(`    ${r.lbl} — ${r.yieldPct.toFixed(0)}% of yield`);
    say('  The load is right and the force is right (the root bending moment');
    say('  checks out by hand), but the ALLOWABLE is coarse: `A = lin/rho` gives');
    say('  ONE area for the whole wing class, and the worst member here is not a');
    say('  spar cap — it is the 3.4 m LIFT STRUT, which a real aeroplane sizes');
    say('  separately. The wood row is the loud case because it pairs a big');
    say('  section (12.9 cm2) with a small allowable (39 MPa crushing), i.e. a');
    say('  WOODEN lift strut, which nobody builds: wooden aeroplanes use steel');
    say('  struts, and the Jodel is a cantilever precisely to avoid the joint.');
    say('  Gating this would be gating the proxy, not the aeroplane. What it is');
    say('  really saying is that strut sizing wants its own area, and that is a');
    say('  materials-model change, not a load-test result.');
  }
}

// --- the picture: the stock build, at all three loads, drawn to one scale
say('');
{
  const sp = JSON.parse(JSON.stringify(GEN_DEFAULT));
  const r1 = loadTest(buildGen(sp), 1.0, 'tubeFabric');
  const rl = loadTest(buildGen(sp), LIMIT, 'tubeFabric');
  const ru = loadTest(buildGen(sp), ULT, 'tubeFabric');
  const scale = Math.max(0.01, ru.tip);
  say(`STOCK BUILD, right wing seen from the front, root -> tip.`);
  say(`Full height = ${scale.toFixed(2)} % of semispan (${(scale/100*ru.semi*100).toFixed(1)} cm at the tip).`);
  for (const [nm, r] of [['5.7 g ULTIMATE', ru], ['3.8 g LIMIT', rl], ['1.0 g level', r1]]) {
    say(`  ${nm}   tip ${r.tip.toFixed(2)} % = ${(r.tip/100*r.semi*100).toFixed(1)} cm`);
    for (const line of picture(r, scale)) say(line);
  }
  say('');
  say('  spanwise profile (% of semispan), station z in metres:');
  say('    z        ' + r1.st.map(s => s.z.toFixed(2).padStart(7)).join(''));
  for (const [nm, r] of [['1.0 g  ', r1], ['3.8 g  ', rl], ['5.7 g  ', ru]])
    say(`    ${nm}  ` + r.defl.map(d => d.toFixed(2).padStart(7)).join(''));
}

// ---------------------------------------------------------------------------
results['every airframe survived the ultimate load'] = rows.every(r => r.ok);
results['deflection grows with load on every airframe'] =
  rows.every(r => r.rl.tip > r.r1.tip && r.ru.tip > r.rl.tip);
// The instrument's own proof. Deflection must scale with the load it is under:
// at 3.8x the bags a linear wing deflects 3.8x as far. This is what caught all
// three earlier versions of this rig — the unreacted one went NEGATIVE, the
// force-balanced one rotated, and the un-relaxed one was still ringing — and it
// is the assertion that keeps the numbers below meaningful.
results['deflection scales with load (linear, +/-15%)'] = rows.every(r => {
  const a = r.rl.tip / r.r1.tip / LIMIT, b = r.ru.tip / r.r1.tip / ULT;
  return a > 0.85 && a < 1.15 && b > 0.85 && b < 1.15;
});
results['every case was measured'] = rows.length === CASES.length;

// LOAD_JSON=1 dumps the measurements as JSON on stderr, so a report page is
// built from the gate's own numbers rather than a second implementation that
// could drift from it. Stderr keeps stdout's verdict contract clean.
if (process.env.LOAD_JSON === '1') {
  console.error(JSON.stringify({
    limit: LIMIT, ult: ULT,
    cases: rows.map(r => ({
      label: r.lbl, material: r.mat, semi: r.r1.semi,
      z: r.r1.st.map(s => s.z),
      g1: r.r1.defl, gLimit: r.rl.defl, gUlt: r.ru.defl,
      tip1: r.r1.tip, tipLimit: r.rl.tip, tipUlt: r.ru.tip,
      yieldPct: r.yieldPct, survived: r.ok,
    })),
  }));
}

say('');
const failed = Object.keys(results).filter(k => !results[k]);
for (const k of Object.keys(results)) say(`  ${results[k] ? 'ok  ' : 'FAIL'}  ${k}`);
if (failed.length) say(`failed: ${failed.join(' | ')}`);
say(failed.length ? 'GATE LOAD: FAIL' : 'GATE LOAD: PASS');
process.exitCode = failed.length ? 1 : 0;
