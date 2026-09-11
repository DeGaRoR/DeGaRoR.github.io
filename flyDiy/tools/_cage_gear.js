// CAGE GEAR LAYER — the undercarriage, standing on the LIVE cage.
//
// The gear bench (_gear.html) built its legs against an AIRFRAME CONTRACT so
// that the same modules could later be bolted to the real fuselage instead of
// its stub. This is that later: `cageAirframe` answers the identical contract
// from the cage the editor has just built, so not one leg, pad, lug or bolt
// changed to get here — which was the whole point of the contract.
//
// Load order: _cage_gen -> _gear_kit -> _gear_gen -> _gear_page -> _cage_crew
// -> THIS -> _cage_ui. It CHAINS PAGE.post rather than replacing it (the crew
// layer assigns post directly), and it appends its own panel group to whatever
// tree the page declared.
//
// UNITS. The cage is generated at its own size and worn at `planeScale`; the
// hardware is metric and never scales — the crew layer's rule, and the reason
// a wheel can be a ruler. cageAirframe converts once, on the vertices, so
// everything here is metres.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const GG = window.GEAR_GEN, GP = window.GEAR_PAGE, CG2 = window.CAGE2;
if (!GG || !GP) { console.error('cage gear layer: gear modules not loaded'); return; }
const D2R = Math.PI / 180;

// ---- defaults ------------------------------------------------------------
// The bench's own defaults, minus the STUB airframe's dimensions: there is no
// stub here, and leaving `afLen` and friends in the set would put five dead
// sliders on the panel describing a body that does not exist.
const STUB_KEYS = ['afLen', 'afHalfW', 'afHeight', 'afKeelY', 'afKeelRise'];
const gearDef = GP.gearDefaults();
for (const k of STUB_KEYS) delete gearDef[k];

// SITED ON THE DEFAULT CAGE, in metres. The bench's station numbers were tuned
// against an OBJ export, which is in cage units — carrying them over unchanged
// would have put the wheels in the wrong place by exactly `planeScale`, so
// these were measured off the page's own body instead (jodel: 5.27 m long,
// nose z +2.96, tail z -2.31, keel y -0.69).
//
// NOTE, for when the mass model arrives: `cgZ`/`cgY` are still hand-set here,
// which means the CG-angle and nose-load checks below are judging a CG nobody
// computed. They become derived the moment the body has a mass integral.
Object.assign(gearDef, {
  gearOn: 1, gearSit: 1,
  // s1Z is the FUSELAGE FITTING, not the axle: a swinging link trails its
  // wheel well aft of its own station (at linkSwing -42 the axle sits 0.65 m
  // behind it), and siting the fitting where the wheel should go put the
  // contact BEHIND the CG — CG angle -1.3 deg, an aeroplane that sits on its
  // tail. Measured back to 16.2 deg, inside the 15-18 window, at 2.00.
  s1On: 1, s1Z: 2.00, s1X: 0.80, s1Leg: 1, s1R: 0.20, s1Drop: 0.45,
  s1Brake: 1, s1Steer: 0, s1Fair: 0,
  // G26.4 (user): a TAILWHEEL station follows the tail — when the leg
  // is a tailwheel, station z is measured FORWARD OF THE AFT EXTREMITY
  // (AF.z0, which tracks the boom/rod length by construction), so
  // shortening the boom carries the wheel with the tail. Non-tailwheel
  // legs (a trike's nose unit) keep the absolute station.
  s2On: 1, s2Z: 0.06, s2X: 0, s2Leg: 3, s2R: 0.10, s2Drop: 0.20,
  s2Brake: 0, s2Steer: 1, s2Fair: 0,
  shockKind: 1, linkSwing: -42,
  cgZ: 1.17, cgY: 0.05, propR: 0.875, propZ: 2.96,
});
// the page's own defaults still win — this only fills what it did not say
PAGE.defaults = Object.assign(gearDef, PAGE.defaults || {});

// ---- panel ---------------------------------------------------------------
// The leg detail rows are GENERATED from the bench's own LEG_ROWS, prefixed
// per station. That is the dividend of the parameter model being shared: the
// ranges and labels here cannot drift from the bench's, because they ARE the
// bench's.
// G28 (user): the kind subfolders are GONE — conditional rows made the
// nesting unnecessary. Every leg kind's detail rows splice FLAT into the
// station group, each gated on the fitted kind (and the station being
// on), so only the fitted leg's ~6-12 rows exist at a time. The two rows
// whose discriminator is another row in the same set follow it too
// (bungee wrap <- shock kind, brace top <- drag brace), per station.
const legRowWhen = (i, key, kind) => {
  const kw = P => +P['s' + i + 'On'] && +P['s' + i + 'Leg'] === +kind;
  if (key === 'bungeeSpan')
    return P => kw(P) && +P['s' + i + '_shockKind'] === 1;
  if (key === 'oleoBraceZ')
    return P => kw(P) && +P['s' + i + '_oleoBrace'];
  return kw;
};
const legRows = i => {
  const out = [];
  for (const kind of Object.keys(GP.LEG_ROWS))
    for (const r of GP.LEG_ROWS[kind])
      out.push(['s' + i + '_' + r[0], r[1], r[2], r[3], r[4], r[5],
                { when: legRowWhen(i, r[0], kind) }]);
  return out;
};
const sOn = i => ({ when: P => +P['s' + i + 'On'] });
// ...AND THE UNDERCARRIAGE IS IN METRES (2026-09-11, the audit the user asked
// for after the cabin-width slip: "Did you audit for measurement errors like
// the cabin width?"). It is, and the gear is the other half of the same trap.
// The panel has TWO length systems — `dim: 'len'` is CAGE units and prints
// value x CAGE_UNIT x planeScale, `dim: 'm'` is metres and prints itself —
// and this layer works in the AIRFRAME's metre frame: measured on the
// Jodel-alike, `s1R` 0.20 draws a wheel 0.400 m across and 0.30 draws 0.600,
// exactly, while `halfW` 0.52 draws a cabin 0.775 m wide (x 0.745). Not one
// gear row declared either, so every one of them printed NO metre readout at
// all — no cue, in the one place where the cue is the difference between a
// 15-inch wheel and an 11-inch one. `sOnM` is `sOn` that says so.
const sOnM = i => ({ when: P => +P['s' + i + 'On'], dim: 'm' });
const fairOn = i => ({ when: P => +P['s' + i + 'On']
                             && Math.round(P['s' + i + 'Fair'] || 0) > 0 });
// any fairing anywhere — the build-material row prices the whole set
const fairAny = P =>
  Math.round(P.s1Fair || 0) > 0 || Math.round(P.s2Fair || 0) > 0 ||
  Math.round(P.s1LegFair || 0) > 0 || Math.round(P.s2LegFair || 0) > 0;
const station = (i, name) => [name, [
  ['s' + i + 'On',    i === 2 ? 'third wheel' : 'main gear', 0, 1, 1],
  // s<i>Z is the FITTING (see the defaults note); the wheel's own station
  // is the fitting plus the family's law plus s<i>AxZ (2026-09-04)
  ['s' + i + 'Z',     'fitting fore / aft',
                                     -4, 4, 0.01, sOnM(i)],
  ['s' + i + 'X',     'in / out (half track)',   0, 1.6, 0.01, sOnM(i)],
  ['s' + i + 'Leg',   'leg',          0, 3, 1, GP.LEGS, sOn(i)],
  ['s' + i + 'R',     i === 2 ? 'third wheel radius' : 'main wheel radius', 0.05, 0.40, 0.005, sOnM(i)],
  ['s' + i + 'Drop',  'up / down (leg drop)',     0.05, 1.00, 0.01, sOnM(i)],
  // the wheel's fore/aft FROM the fitting — the leg's rake, on every family;
  // hidden on a tailwheel, whose spring length already is that knob
  ['s' + i + 'AxZ',   'wheel fore / aft (from fitting)', -1.2, 1.2, 0.01,
   { when: P => +P['s' + i + 'On'] && Math.round(P['s' + i + 'Leg']) !== 3,
     dim: 'm' }],
  ['s' + i + 'Brake', 'brake',        0, 1, 1, sOn(i)],
  ['s' + i + 'Steer', 'steering',     0, 2, 1, GP.STEERS, sOn(i)],
  // G133: the castor exclusion is GONE — legTailwheel draws its own shell
  // now, so the switch that was two lies (G121.2) is two truths everywhere
  ['s' + i + 'Fair',  'fairing',      0, 2, 1, ['none', 'spat', 'trousers'],
   sOn(i)],
  // ...and the shape is an instrument (G133): skirt around the mode's own
  // base, tail run-out to a droplet, rake for a taildragger's flying
  // attitude, width for a fat tyre. Rows exist only where a shell does.
  ['s' + i + 'FairSkirt', 'skirt depth +', -0.12, 0.30, 0.01,
   Object.assign({ dim: 'm' }, fairOn(i))],
  ['s' + i + 'FairTail', 'tail droplet ×', 0.70, 1.60, 0.01, fairOn(i)],
  ['s' + i + 'FairRake', 'fairing rake °', -25, 25, 1, fairOn(i)],
  ['s' + i + 'FairW',   'fairing width ×', 0.80, 1.50, 0.01, fairOn(i)],
  // the leg's own streamline shroud, without buying the wheel a spat.
  // Hidden on trousers (they already shroud the leg) and on the castor
  // (its spring shroud is the trouser state's own).
  ['s' + i + 'LegFair', 'leg fairing', 0, 1, 1, ['bare', 'streamlined'],
   { when: P => +P['s' + i + 'On']
             && Math.round(P['s' + i + 'Fair'] || 0) < 2
             && !(i === 2 && Math.round(P.s2Leg) === 3) }],
  ...legRows(i),
]];

const GROUP = ['9 · undercarriage', [
  ['gearOn',  'undercarriage', 0, 1, 1],
  ['gearSit', 'stand it on the ground', 0, 1, 1,
   { when: P => +P.gearOn }],
  station(1, 'station 1 — mains').concat([{ when: P => +P.gearOn }]),
  station(2, 'station 2 — third wheel').concat([{ when: P => +P.gearOn }]),
  // G133: one build material for the whole set of fairings — a set of
  // spats is laid up as one job, and the row exists only when one is worn
  ['fairCons', 'fairing build', 0, 2, 1, ['glassfibre', 'carbon', 'alloy'],
   { when: P => +P.gearOn && fairAny(P) }],
  // the wheel dressing — shared rows (G33: this group never made the
  // cage port; tundra + smooth tread = the bush slick)
  ['wheel', GP.WHEEL_ROWS.map(r => r.slice()), { when: P => +P.gearOn }],
  ['balance + prop', [
    ['cgZ',   'CG station z', -2, 4, 0.01, { dim: 'm' }],
    ['cgY',   'CG height y',  -1, 1, 0.01, { dim: 'm' }],
    ['propR', 'prop radius',  0.20, 2.00, 0.005, { dim: 'm' }],
    ['propZ', 'prop plane z', -1, 5, 0.01, { dim: 'm' }],
  ], { when: P => +P.gearOn }],
]];
// a page that curated its own tree replaced the base panel outright, so an
// appended group has to go into THAT array; otherwise the base append list.
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// ---- the build ------------------------------------------------------------
let group = null;

const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  if (!P.gearOn) return;

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const AF = GG.cageAirframe(mesh, FS);
  if (!AF) { if (stat) stat.textContent += '  ·  gear: no skin to stand on'; return; }

  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:gear';
  scene.add(group);

  const bags = {};
  for (const k of ['tyre', 'hub', 'brake', 'brakefix', 'steel', 'alloy',
                   'chrome', 'dark', 'bronze', 'fair'])
    bags[k] = GG.Bag();
  // G58.2: EACH WHEEL GETS ITS OWN BAGS, so the join can ride it on its
  // axle node and SPIN it (G47.2's "per-wheel bags in the gear kit",
  // user: "identify the individual meshes corresponding to the wheel and
  // move those"). A PROXY hands the wheel() call its own bags while the
  // leg, castor fork and spat keep writing into the shared bags — so
  // exactly the parts that turn, turn, and the fork does NOT rotate with
  // the wheel. Zero changes inside the gear kit itself.
  //
  // G148: EVERY bag wheel() writes must be ROUTED, or it is a fuselage-
  // welded part (the shared bags mesh unnamed into the static merge).
  // The old 3-bag proxy left the bolt heads, hub caps, valve stems, the
  // brake caliper and its pipe frozen on the craft — hardware standing
  // mid-air inside a travelling, spinning wheel (the user's circles).
  // Spinning set {tyre,hub,brake,alloy,dark} -> the wheel unit; leg-
  // riding set {brakefix: caliper + pipe} -> that wheel's LEG unit, which
  // travels with the axle without turning. _gear_check §3 pins wheel()'s
  // write-set to exactly this routing. The tailwheel keeps the 3-bag
  // proxy: its call site routes alloy/dark to the leg unit itself.
  const wheelUnits = [];
  const allBags = () => { const b = {};
    for (const k in bags) b[k] = GG.Bag(); return b; };
  const wheelProxy = (lb) => {
    const wb = lb
      ? { tyre: GG.Bag(), hub: GG.Bag(), brake: GG.Bag(),
          alloy: GG.Bag(), dark: GG.Bag() }
      : { tyre: GG.Bag(), hub: GG.Bag(), brake: GG.Bag() };
    wheelUnits.push(wb);
    return { proxy: Object.assign({}, bags,
                                  lb ? { brakefix: lb.brakefix } : null, wb),
             wb };
  };
  // G58.3: the LEGS are separable units too — the join stretch-binds them
  // between their airframe attachment and the moving axle, so the
  // suspension visually compresses and stays lined up with the wheel.
  // The tailwheel additionally splits its CASTOR assembly (fork), which
  // yaws for ground manoeuvring; its leaf SPRING stays in the leg unit.
  const legUnits = [];
  let castorUnitOut = null;

  // IDENTICAL to the bench's loop, deliberately: if this had to be written
  // differently to run on a real body, the contract would not be one.
  // (One cage-side remap first: tailwheel stations are TAIL-RELATIVE —
  // see the defaults note above. The bench keeps absolute stations.)
  const stations = GP.gearStations(P);
  for (const st of stations)
    if (st.leg === 3) st.z = AF.z0 + Math.max(0.02, st.z);

  // G133: THE NEAREST SURFACE ABOVE THE WHEEL (user's rule). When the
  // WING'S UNDERSIDE at the axle's own span sits lower than the fuselage
  // section's MIDDLE, the leg roots on the wing instead of the flank — a
  // low-wing's gear is the wing's, automatically, as the track slider
  // walks the wheels outboard. The centreline guard is what keeps a high
  // wing from capturing its gear (a Cub's wing IS the nearest surface
  // straight above its wheels; its legs still belong to the belly).
  // `underAt` is published by the wing layer off its BUILT skin — the
  // load order moved (build.js/dev.html) so the wing builds first and the
  // probe is never one edit stale. The leg builders stay wing-ignorant:
  // they take a mount FRAME, and the axle is keel-datum'd either way, so
  // where the leg roots never moves the wheel, the stance or the join's
  // measured rows.
  // G185: on a biplane the wheel meets the LOWEST plane
  const WCW = (typeof window !== 'undefined' && window.CAGE_WING) || null;
  const WLO = WCW && WCW.planes ? (WCW.planes[WCW.lowest] || WCW) : WCW;
  const WUA = (WLO && WLO.underAt) || null;
  let onWing = 0;
  // THE OPEN-FRAME MOUNT: a frame provider (zOff, dx) -> {p, n, fore, side}
  // like the wing's, over the interior pass's published members
  // (`window.CAGE_MEMBERS`, cage units -> metres). The target is the point the
  // fuselage contract gives — the flank at the family's own angle; the nearest
  // member's surface toward it is the root, the member's direction is `fore`,
  // and `pivot` tells the builders to draw lugs, not a plate. The search
  // itself is GEAR_GEN's `memberFrame`, which the lift struts ask the same
  // question of: one description of "the nearest tube", not two.
  //
  // WHAT MAKES IT FIRE (2026-09-05, the user: the fittings "look for a plate
  // to attach to ... it fails in some cases, resulting in a distorted mesh").
  // It is not "this aeroplane has no covering" — it is "there is no covering
  // HERE". A door taken off (`doorGone`) leaves the flank open at exactly the
  // stations a main leg roots at, and a doubler bolted over an opening is a
  // plate spread across a hole. `solidAt` is the contract's own answer to
  // that, and it is the only thing this asks.
  const openMount = (st, sgn) => {
    const MB = window.CAGE_MEMBERS;
    if (!MB || !MB.length) return null;
    const bare = !(P.skinOn == null || +P.skinOn);
    const cen = st.x <= 0.01;
    const angDeg = cen ? 0
      : st.leg === 0 ? +st.P.beamAng : st.leg === 1 ? +st.P.linkAng
      : st.leg === 2 ? +st.P.oleoAng : 0;
    const ang = sgn * (angDeg || 0) * Math.PI / 180;
    // an airframe that cannot say (the bench's analytic stub) is taken at its
    // word, which is what it has always been taken at
    if (!bare && (!AF.solidAt || AF.solidAt(st.z, ang))) return null;
    // ...AND THERE HAS TO BE A TUBE WITHIN REACH. The published members are
    // the interior pass's; a rod boom is not one of them, so a tailwheel
    // asking at the tailpost was being handed the cabin frame a metre and a
    // half forward. Past a bay's worth of the local body, the leg keeps the
    // surface it does have — which on a rod boom is the rod, and real.
    const reach = Math.max(0.25, AF.halfWAt(st.z) * 1.2);
    if (!GG.memberFrame(MB, AF.surf(st.z, ang), FS, reach)) return null;
    const provider = (zOff, dx) => {
      const z = st.z + (zOff || 0);
      const tgt = AF.surf(z, ang);
      if (dx) tgt[0] += dx;
      return GG.memberFrame(MB, tgt, FS) ||
             { p: tgt, n: [0, -1, 0], fore: [0, 0, 1], side: [1, 0, 0] };
    };
    provider.pivot = true;
    return provider;
  };
  const wingMount = (st, sgn) => {
    if (!WUA || st.x <= 0.01 || st.leg === 3) return null;
    // the WHEEL may sit a little ahead of the leading edge (a low-wing's
    // axle rides forward of the spar) — seek the nearest wing chordwise
    // within 0.6 m of the station, the way a real leg roots at the spar
    // and rakes to its wheel. Beyond that reach the wing is not "above
    // the wheel" in any honest sense and the fuselage keeps the leg.
    let q = null, zBase = st.z;
    for (const dz of [0, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3, -0.45, 0.45,
                      -0.6, 0.6]) {
      q = WUA(sgn * st.x, st.z + dz);
      if (q) { zBase = st.z + dz; break; }
    }
    if (!q || !(q.y < AF.cyAt(st.z))) return null;
    // G133.1 (user): the builders ask for their root a little INBOARD of
    // the wheel (`dx`), above the strut's own foot — so a mounted leg
    // hangs dead straight and the wheel rides its stub axle outboard.
    return (zOff, dx) => {
      const xq = sgn * st.x + (dx || 0);
      let z = zBase + (zOff || 0);
      let w = WUA(xq, z);
      // a foot cannot land ahead of the leading edge it bolts to: walk the
      // request back toward the base until the wing answers
      for (let t = 0.25; t <= 1.001 && !w; t += 0.25) {
        const zt = z + (zBase - z) * t;
        w = WUA(xq, zt);
        if (w) z = zt;
      }
      if (!w) { w = WUA(xq, zBase) || q; z = zBase; }
      let n = (w.n && w.n[1] < -0.2) ? w.n : [0, -1, 0];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / nl, n[1] / nl, n[2] / nl];
      let f = [-n[2] * n[0], -n[2] * n[1], 1 - n[2] * n[2]];
      const fl = Math.hypot(f[0], f[1], f[2]) || 1;
      f = [f[0] / fl, f[1] / fl, f[2] / fl];
      return { p: [xq, w.y, z], n, fore: f,
               side: [n[1] * f[2] - n[2] * f[1], n[2] * f[0] - n[0] * f[2],
                      n[0] * f[1] - n[1] * f[0]] };
    };
  };

  const contacts = [];
  // G188: the third wheel is the station the table FLAGS single (row 2), not
  // whichever contact happens to sit on the centreline; a tailwheel builder
  // is centreline by construction, so it gets one contact whatever its row's
  // lateral offset says (two identical contacts otherwise).
  const isSingle = st => st.single != null ? !!st.single : st.x <= 0.01;
  for (const st of stations) {
    const sides = (st.leg === 3 || st.x <= 0.01) ? [0] : [-1, 1];
    for (const s of sides) {
      const sgn = s === 0 ? 1 : s;
      let r;
      const lb = allBags();               // this unit's LEG bags
      const wu = wheelProxy(st.leg === 3 ? null : lb);
      // the fairing's instruments ride the station (G133)
      const fOpt = { full: st.fair === 2, skirt: st.fairSkirt,
                     tail: st.fairTail, rake: st.fairRake, width: st.fairW };
      const m = wingMount(st, sgn);
      // THE OPEN FRAME (2026-09-04, spec §1.7): with no skin the fuselage
      // contract is a surface that is not there — the leg roots on the
      // nearest truss member instead, with a pivot (see openMount); the
      // low-wing rule still wins where it applies
      const om = m ? null : openMount(st, sgn);
      if (m) { st.mount = m; onWing++; }
      else if (om) st.mount = om;
      else delete st.mount;
      if (st.leg === 3) {
        // legTailwheel builds spring AND wheel into one bag-set; the
        // proxies route the spinning parts to the wheel unit, the fork
        // (and now its spat, G133) to the castor unit, and the spring —
        // with its trouser shroud — stays in the leg unit
        const cb = allBags();
        const proxy = Object.assign({}, lb, wu.wb, { castorBags: cb });
        r = GG.legTailwheel(proxy, AF, st.P, st);
        if (r.castor)
          castorUnitOut = { bags: cb, top: r.castor.top, ax: r.castor.ax,
                            axle: r.axle };
      } else {
        if (st.leg === 0) r = GG.legBeam(lb, AF, st.P, st, sgn);
        else if (st.leg === 1) r = GG.legLink(lb, AF, st.P, st, sgn);
        else r = GG.legOleo(lb, AF, st.P, st, sgn);
        // G133: spats ride their UNITS now, not the static shared bags —
        // a nose spat sits on its fork, a main spat on its own leg, so
        // the flown aeroplane carries them with the moving parts
        if (st.steer > 0 && st.x < 0.01) {
          // 2026-09-04 (the user: "the tricycle configuration tries strange
          // things for the front wheel"): the nose castor used to be drawn
          // INTO THE LEG'S bags, so the join stretched fork and spat with the
          // spring, and it never yawed — only the tailwheel's castor was
          // registered as the yawing part. It is its own bag-set now, handed
          // out through castorUnitOut exactly as legTailwheel's is; the wheel
          // rides inside it in the game (app.js: the tw wheel is the castor's
          // child, and refs.tw IS the nosewheel on a tricycle).
          const cb = allBags();
          const u = GG.castorUnit(cb, st.P, r.axle, sgn, st.R, st.P.twSteer, false);
          GG.wheel(wu.proxy, u.hub, u.axis, st.R, { brake: !!st.brake, P: st.P });
          if (st.fair) GG.spat(cb, u.hub, u.axis, st.R, fOpt);
          castorUnitOut = { bags: cb, top: u.top, ax: u.ax, axle: u.hub };
          r = { axle: u.hub, axis: u.axis, root: r.root, tip: u.top,
                travel: r.travel };
        } else {
          GG.wheel(wu.proxy, r.axle, r.axis, st.R,
                   { brake: !!st.brake, inboard: sgn, P: st.P });
          if (st.fair) GG.spat(lb, r.axle, r.axis, st.R, fOpt);
        }
      }
      delete st.mount;
      wu.wb.axle = r.axle; wu.wb.R = st.R;
      wu.wb.kind = (st.leg === 3 || isSingle(st)) ? 'T'
                 : (r.axle[0] > 0 ? 'L' : 'R');
      // G58.7: BOTH ends are anchors. `root` bolts to the airframe and
      // must stay put; the moving end is the spring's own tip (the
      // castor's swivel top) on a tailwheel, the axle otherwise — the
      // user's rule: "the spring should elongate or shrink, but both
      // the start and end anchor points remain in original position".
      legUnits.push({ bags: lb, kind: wu.wb.kind, axle: r.axle,
                      root: r.root || null, moving: r.tip || r.axle });
      contacts.push({ st, sgn, p: r.axle, R: st.R });
    }
  }
  // the SPAT is the builder's to paint (phase C): its own livery section,
  // trim by default, borrowing the fuselage's colour — everything else in
  // the general bags stays on the gear's own hardware table
  const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
  const spatM = () => (SM && SM('spat', { surf: 0, fieldM: 1, tint0: 0xcfd6de }))
    || GG.gearMat('fair');
  // ...and only when there ARE spats: the section registry lists what this
  // build actually drew, and an empty bag draws nothing
  for (const k in bags)
    bags[k].mesh(group, k === 'fair' && bags[k].tris ? spatM()
                                                     : GG.gearMat(k));
  // G58.2/.3: bake each unit into its own NAMED group — the join's
  // snapshot picks these up by name, exactly as it does the prop's
  for (const wb of wheelUnits) {
    const wg = new THREE.Group();
    wg.name = 'edWheel' + (wb.kind || 'T');
    for (const k of ['tyre', 'hub', 'brake', 'alloy', 'dark'])
      if (wb[k] && wb[k].mesh) wb[k].mesh(wg, GG.gearMat(k));
    group.add(wg);
  }
  // the LEGS take a livery section too (phase C): steel tube by default,
  // following nobody — but a builder can paint a leg without repainting the
  // chrome piston or the tyres, which stay hardware. Only the 'steel' bag
  // moves: it is the painted member (legs, blades, leaf springs) — and
  // since G133 a unit's 'fair' bag (its spat or shroud) takes the spat
  // section, guarded on tris so an unfaired build registers no section.
  const legM = (k, bag) => (k === 'steel' && SM &&
    SM('gearLeg', { surf: 0, fieldM: 1, tint0: 0x98a2ad }))
    || (k === 'fair' && bag && bag.tris ? spatM() : 0)
    || GG.gearMat(k);
  for (const lu of legUnits) {
    const lg = new THREE.Group();
    lg.name = 'edLeg' + lu.kind;
    for (const k in lu.bags) lu.bags[k].mesh(lg, legM(k, lu.bags[k]));
    group.add(lg);
  }
  if (castorUnitOut) {
    const cgp = new THREE.Group();
    cgp.name = 'edCastorT';
    for (const k in castorUnitOut.bags)
      castorUnitOut.bags[k].mesh(cgp, legM(k, castorUnitOut.bags[k]));
    group.add(cgp);
  }

  // ---- THE GROUND COMES TO THE AEROPLANE ---------------------------------
  // The bench pitches the whole machine until the extreme contacts share a
  // ground line. Here the cage is the thing being edited and must not tilt
  // under the editor, so the SAME attitude is expressed by tilting the ground
  // instead: identical geometry, and the fuselage stays where you put it.
  //
  // Rotating the body by `pitch` about x and dropping to y = 0 puts the ground,
  // read back in body coordinates, at the plane through gy along
  // n = (0, cos p, -sin p) — which is the grid's own normal once it is rolled
  // by -pitch. Nothing is approximated: it is the same transform, inverted.
  let pitch = 0, gy = 0, note = '';
  if (contacts.length > 1) {
    const byZ = contacts.slice().sort((a, b) => a.p[2] - b.p[2]);
    const A = byZ[0], B = byZ[byZ.length - 1];
    pitch = Math.atan2((B.p[1] - B.R) - (A.p[1] - A.R), B.p[2] - A.p[2]);
  }
  const cs = Math.cos(pitch), sn = Math.sin(pitch);
  const rot = p => [p[0], p[1] * cs - p[2] * sn, p[1] * sn + p[2] * cs];
  gy = Infinity;
  for (const c of contacts) gy = Math.min(gy, rot(c.p)[1] - c.R);
  if (!isFinite(gy)) gy = 0;

  if (P.gearSit && contacts.length) {
    const n = [0, cs, -sn];
    const grid = new THREE.GridHelper(12, 48, 0x39424e, 0x232a33);
    grid.rotation.x = -pitch;
    grid.position.set(n[0] * gy, n[1] * gy, n[2] * gy);
    group.add(grid);
  }

  // ---- the checks (the bench's, on the real body) -------------------------
  // Measured in the SAT frame — rotated and dropped — because a CG angle read
  // off an untilted drawing is not the angle the aeroplane has.
  const toG = p => { const q = rot(p); return [q[0], q[1] - gy, q[2]]; };
  const mains = contacts.filter(c => !isSingle(c.st)).map(c => toG(c.p));
  const singles = contacts.filter(c => isSingle(c.st)).map(c => toG(c.p));
  const notes = [];
  if (mains.length) {
    const mz = mains.reduce((s, p) => s + p[2], 0) / mains.length;
    notes.push('track ' + (Math.max(...mains.map(p => Math.abs(p[0]))) * 2).toFixed(2));
    const cg = toG([0, P.cgY, P.cgZ]);
    const tail = singles.find(p => p[2] < mz), nose = singles.find(p => p[2] > mz);
    if (tail) {
      notes.push('wb ' + (mz - tail[2]).toFixed(2));
      const ang = Math.atan2(mz - cg[2], Math.max(0.01, cg[1])) / D2R;
      notes.push('CG ang ' + ang.toFixed(1) + (ang >= 15 && ang <= 18 ? '' : '!'));
      notes.push('deck ' + (-pitch / D2R).toFixed(1));
    }
    if (nose) {
      const wb = nose[2] - mz;
      notes.push('wb ' + wb.toFixed(2));
      const share = 100 * (cg[2] - mz) / wb;
      notes.push('nose ' + share.toFixed(1) + '%' +
                 (share >= 8 && share <= 15 ? '' : '!'));
    }
    const gap = toG([0, AF.cyAt(P.propZ), P.propZ])[1] - P.propR;
    const req = nose ? 0.178 : 0.229;
    notes.push('prop clr ' + gap.toFixed(3) + (gap >= req ? '' : '!'));
  }
  // G133: say so when the low-wing rule took the legs — the one visible
  // trace of an automatic decision the builder never clicked
  if (onWing) notes.push('mains on wing');
  window.CAGE_GEAR = { AF, contacts, pitch, gy,
    // G58.3: the separable units' anchors, for the join's moving parts
    units: { legs: legUnits.map(u => ({ kind: u.kind, axle: u.axle,
                                        root: u.root, moving: u.moving })),
             castor: castorUnitOut
               ? { top: castorUnitOut.top, ax: castorUnitOut.ax,
                   axle: castorUnitOut.axle } : null } };
  if (stat && notes.length) stat.textContent += '  ·  gear: ' + notes.join(' · ');
};
})();
