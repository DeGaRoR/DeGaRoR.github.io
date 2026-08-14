// LOFT FIT — the fuselage deck-line slope instrument.
//
// It asserts nothing by default, like make_perf.js and gen_ap_probe.js: it
// builds a spread of generated aeroplanes and prints WHERE the body's deck line
// breaks, which is the only readout that says why the fuselage reads bastardized
// rather than that it does.
//
// WHY IT MEASURES THE EMITTED MESH AND NOT THE SPEC. The crank the user sees is
// in the covering, and the covering does not use the truss's line: bay 0 holds a
// designed windscreen step (63_gen_skin.js:555-564) while bays >= 1 use a
// CLAMPED Catmull-Rom (:537-543), and the two meet at station 1 with no
// continuity condition. Measuring `section(i,s)` would mean reimplementing that
// split here, and a reimplementation cannot witness its own drift. So this walks
// the vertices the generator actually emitted, picked by the generator's OWN UV
// contract: a fuselage row runs u = h/GEN_RADIAL with h = 0 at top centre, and
// the body band is v in 0.03..0.47 (genUVBody) against the wing's 0.53..0.97
// (genUVPanel). So u == 0 and v < 0.5 IS the deck line, exactly, with no
// geometric guessing and nothing to go stale.
//
// The canopy crown is measured the same way at u == 0.5, its own arc midpoint,
// and reported beside the body — because the shell's front seam sits at the FOOT
// of the windscreen step (:621), so the step is inside the canopy region and the
// shell climbs it instead of swallowing it. Two numbers, one defect.
//
// The bar comes from the two reference meshes, measured the same way:
//
//   C172 (assets/c172/c172.obj), envelope of fuselage skin and glass through the
//   windshield: 1.598 -> 1.660 -> 1.857 -> 1.949 -> 1.998 -> 2.002 — monotone
//   and C1. The skin has a HOLE there and the glass fills it. The windshield is
//   not a geometric feature; it is a transparent REGION of one continuous
//   lofted surface.
//
//   PA-18 (assets/pa18/pa18.obj) DOES have a visible hard edge at its windscreen
//   bow, but the envelope is still monotone (0.154 -> 0.15 -> ... -> 0.68 ->
//   0.70). That edge is a crease in the surface NORMAL at a real frame tube, not
//   a discontinuity in the station curve. This instrument must therefore be read
//   with the crease tags in hand: a break at a station tagged to crease is
//   intended; a break anywhere else is the defect.
//
// Usage:
//   node tools/loft_fit.js                 all specs
//   node tools/loft_fit.js stock lowDeck   a subset
//   node tools/loft_fit.js --dump stock    the whole deck line, sample by sample
//   node tools/loft_fit.js --assert 0.15   exit 1 if any spec breaks the bound
//
// The --assert form is what graduates into GATE GEN once the loft rework lands.
// It is the numeric definition of "the crank is unrepresentable", and it is
// worth more than any screenshot.
const { buildGen, genSkin, genRestFrame, GEN_DEFAULT } =
  require('./flight_core.js');

// ---------------------------------------------------------------------------
// the spread
// ---------------------------------------------------------------------------
// Deliberately NOT balanced for static margin the way gen_ap_probe.js is: this
// instrument never flies anything, so an out-of-band CG cannot be mistaken for a
// shape defect. What each entry varies is the thing that moves the deck line.
//
// Overrides are DOTTED AUTHORED PATHS, applied to a deep clone of GEN_DEFAULT.
// A partial spec object does NOT work — resolveSpec/clampSpec fill from the
// default wholesale rather than deep-merging, so `buildGen({fuselage:{...}})`
// silently builds the stock aeroplane. gen_ap_probe.js:174 has the same
// clone-then-mutate shape for the same reason.
const SPECS = {
  // the calibration point: GEN_DEFAULT, Cub-like
  stock:       {},
  // a low cowl deck makes the windscreen step TALLER — the worst case for the
  // bay-0 discontinuity — and a high one nearly removes it, so the two bracket
  // the defect
  lowDeck:     { 'fuselage.cowlDeck': 0.52 },
  highDeck:    { 'fuselage.cowlDeck': 0.94 },
  // a steep screen shortens the run, concentrating the same rise; a laid-back
  // one spreads it
  steepScreen: { 'cabin.canopy.wsAngle': 74 },
  rakedScreen: { 'cabin.canopy.wsAngle': 26 },
  // the aft shape families: the taper exponent is the only thing GEN_SHAPES
  // changes today, and it acts on every bay boundary aft of the cabin
  waisted:     { 'fuselage.shape': 'waisted' },
  boomShape:   { 'fuselage.shape': 'boom' },
  // more bays aft = more clamped-Catmull-Rom boundaries to break at
  manyBays:    { 'fuselage.tailBays': 6 },
  // the drone deck is 1.0, the ONE case with no windscreen step at all. It
  // should come out clean; if it does not, the defect is not the step.
  drone:       { 'cabin.seating': 'drone' },
  // a tall bubble drives the canopy shell hardest
  bubble:      { 'cabin.glazing': 'bubble', 'cabin.canopy.height': 0.8 },
  // no canopy at all: the covering owns the whole deck line, so this isolates
  // the body's own break from anything the shell adds
  noGlazing:   { 'cabin.glazing': 'none' },
};

const clone = o => JSON.parse(JSON.stringify(o));
const setPath = (o, path, v) => {
  const k = path.split('.');
  let t = o;
  for (let i = 0; i < k.length - 1; i++) t = t[k[i]];
  t[k[k.length - 1]] = v;
};
const specFor = ov => {
  const s = clone(GEN_DEFAULT);
  for (const p in ov) setPath(s, p, ov[p]);
  return s;
};

// ---------------------------------------------------------------------------
// measurement
// ---------------------------------------------------------------------------
// A line of {x, y} picked off one group by its u coordinate. `uWant` is the
// generator's own ring parameter: 0 = top centre for a body row, 0.5 = arc
// midpoint for a canopy row.
function lineAt(g, uWant, bodyBandOnly) {
  if (!g) return [];
  const out = [];
  for (let i = 0; i < g.nv; i++) {
    if (Math.abs(g.uv[i * 2] - uWant) > 1e-6) continue;
    if (bodyBandOnly && g.uv[i * 2 + 1] > 0.5) continue;   // wing uses 0.53..0.97
    if (Math.abs(g.pos[i * 3 + 2]) > 1e-4) continue;       // centreline only
    out.push({ x: g.pos[i * 3], y: g.pos[i * 3 + 1] });
  }
  out.sort((a, b) => a.x - b.x);
  // a crease duplicates a row at the same x; keep the higher point once
  const ded = [];
  for (const p of out) {
    const last = ded[ded.length - 1];
    if (last && p.x - last.x <= 1e-6) { if (p.y > last.y) last.y = p.y; continue; }
    ded.push(p);
  }
  return ded;
}

// slope of each segment, then the change in slope at each interior sample.
// Reported at the SAMPLE, because that is where the eye sees the corner.
function breaks(line) {
  const seg = [];
  for (let i = 1; i < line.length; i++) {
    const dx = line[i].x - line[i - 1].x;
    if (dx < 1e-9) continue;
    seg.push({ x: line[i - 1].x, m: (line[i].y - line[i - 1].y) / dx });
  }
  const out = [];
  for (let i = 1; i < seg.length; i++)
    out.push({ x: seg[i].x, d: Math.abs(seg[i].m - seg[i - 1].m),
               m0: seg[i - 1].m, m1: seg[i].m });
  return out;
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const dump = argv.includes('--dump');
const ai = argv.indexOf('--assert');
const tol = ai >= 0 ? parseFloat(argv[ai + 1]) : null;
const named = argv.filter((a, i) =>
  !a.startsWith('--') && !(ai >= 0 && i === ai + 1));
const names = named.length ? named : Object.keys(SPECS);

const rows = [];
let worst = 0, worstAt = '';

for (const nm of names) {
  if (!SPECS[nm]) { console.log(`no such spec: ${nm}`); continue; }
  let def, skin;
  try {
    def = buildGen(specFor(SPECS[nm]));
    skin = genSkin(def);
  } catch (e) { rows.push({ nm, err: e.message }); continue; }

  const body = lineAt(skin.groups.skin, 0, true);
  const crown = lineAt(skin.groups.canopy, 0.5, false);

  // stations live in SIM x; the mesh is in the rest frame, so name a break by
  // pushing the stations through the same transform rather than by guessing
  // an offset
  const B = genRestFrame(def).to;
  const stX = def.parts.ST.map(s => B([s.x, 0, 0])[0]);
  const near = x => {
    let bi = 0, bd = 1e9;
    stX.forEach((sx, i) => { const d = Math.abs(sx - x); if (d < bd) { bd = d; bi = i; } });
    return `ST[${bi}]${bd > 0.06 ? '~' : ''}`;
  };

  const bb = breaks(body).sort((a, b) => b.d - a.d);
  const cb = breaks(crown).sort((a, b) => b.d - a.d);
  const top = bb[0] || { x: 0, d: 0, m0: 0, m1: 0 };

  rows.push({ nm, nB: body.length, nC: crown.length,
              d: top.d, x: top.x, m0: top.m0, m1: top.m1, at: near(top.x),
              second: bb[1] ? bb[1].d : 0,
              dC: cb[0] ? cb[0].d : 0 });
  if (top.d > worst) { worst = top.d; worstAt = nm; }

  if (dump) {
    console.log(`\n--- ${nm} ---`);
    console.log(`  stations (rest frame): ${stX.map(v => v.toFixed(3)).join(' ')}`);
    for (const [lbl, ln] of [['BODY deck (skin u=0)', body],
                             ['CANOPY crown (u=0.5)', crown]]) {
      if (!ln.length) continue;
      console.log(`  ${lbl}, ${ln.length} samples:`);
      let prev = null;
      for (const p of ln) {
        const m = prev ? (p.y - prev.y) / (p.x - prev.x) : null;
        console.log(`    x=${p.x.toFixed(4)}  y=${p.y.toFixed(4)}` +
                    (m === null ? '' : `  slope=${m.toFixed(4)}`));
        prev = p;
      }
    }
  }
}

console.log('');
console.log('DECK LINE SLOPE BREAKS — max |d(slope)| across one sample');
console.log('');
console.log('spec          nB  nC   bodyMax  at x    station   slope in -> out    2nd   canopyMax');
console.log('---------------------------------------------------------------------------------------');
for (const r of rows) {
  if (r.err) { console.log(`${r.nm.padEnd(12)}  BUILD FAILED: ${r.err}`); continue; }
  console.log(
    `${r.nm.padEnd(12)} ${String(r.nB).padStart(3)} ${String(r.nC).padStart(3)}` +
    `  ${r.d.toFixed(4).padStart(8)}  ${r.x.toFixed(3).padStart(6)}  ${r.at.padEnd(8)}` +
    ` ${r.m0.toFixed(3).padStart(7)} ->${r.m1.toFixed(3).padStart(7)}` +
    `  ${r.second.toFixed(3).padStart(5)}  ${r.dC.toFixed(3).padStart(7)}`);
}
console.log('');
console.log(`worst body break: ${worst.toFixed(4)} on "${worstAt}"`);
console.log('');
console.log('nB/nC = samples on the body deck line / the canopy crown line.');
console.log('bodyMax is the change in deck-line slope across one sample. A real');
console.log('aeroplane reads smooth because this stays small everywhere except at');
console.log('a frame member it is MEANT to crease over (the Cub\'s windscreen bow).');
console.log('canopyMax says whether the shell swallows the body\'s break or climbs it.');

if (tol != null) {
  const bad = rows.filter(r => r.err || r.d > tol);
  if (bad.length) {
    console.log(`\nFAIL: ${bad.length} spec(s) over ${tol}: ` +
                bad.map(b => `${b.nm}=${b.err ? 'BUILD' : b.d.toFixed(3)}`).join(' '));
    process.exit(1);
  }
  console.log(`\nOK: all ${rows.length} spec(s) within ${tol}`);
}
