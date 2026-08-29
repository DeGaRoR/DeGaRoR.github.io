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
const station = (i, name) => [name, [
  ['s' + i + 'On',    'fitted',       0, 1, 1],
  ['s' + i + 'Z',     i === 2 ? 'z / tail offset' : 'station z',
                                     -4, 4, 0.01, sOn(i)],
  ['s' + i + 'X',     'half track',   0, 1.6, 0.01, sOn(i)],
  ['s' + i + 'Leg',   'leg',          0, 3, 1, GP.LEGS, sOn(i)],
  ['s' + i + 'R',     'wheel radius', 0.05, 0.40, 0.005, sOn(i)],
  ['s' + i + 'Drop',  'leg drop',     0.05, 1.00, 0.01, sOn(i)],
  ['s' + i + 'Brake', 'brake',        0, 1, 1, sOn(i)],
  ['s' + i + 'Steer', 'steering',     0, 2, 1, GP.STEERS, sOn(i)],
  ['s' + i + 'Fair',  'fairing',      0, 2, 1, ['none', 'spat', 'trousers'],
   sOn(i)],
  ...legRows(i),
]];

const GROUP = ['9 · undercarriage', [
  ['gearOn',  'undercarriage', 0, 1, 1],
  ['gearSit', 'stand it on the ground', 0, 1, 1,
   { when: P => +P.gearOn }],
  station(1, 'station 1 — mains').concat([{ when: P => +P.gearOn }]),
  station(2, 'station 2 — third wheel').concat([{ when: P => +P.gearOn }]),
  // the wheel dressing — shared rows (G33: this group never made the
  // cage port; tundra + smooth tread = the bush slick)
  ['wheel', GP.WHEEL_ROWS.map(r => r.slice()), { when: P => +P.gearOn }],
  ['balance + prop', [
    ['cgZ',   'CG station z', -2, 4, 0.01],
    ['cgY',   'CG height y',  -1, 1, 0.01],
    ['propR', 'prop radius',  0.20, 2.00, 0.005],
    ['propZ', 'prop plane z', -1, 5, 0.01],
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
  scene.add(group);

  const bags = {};
  for (const k of ['tyre', 'hub', 'brake', 'brakefix', 'steel', 'alloy',
                   'chrome', 'dark', 'bronze', 'fair'])
    bags[k] = GG.Bag();
  // G58.2: EACH WHEEL GETS ITS OWN BAGS, so the join can ride it on its
  // axle node and SPIN it (G47.2's "per-wheel bags in the gear kit",
  // user: "identify the individual meshes corresponding to the wheel and
  // move those"). A PROXY hands the wheel() call its own tyre/hub/brake
  // while the leg, castor fork and spat keep writing into the shared
  // bags — so exactly the parts that turn, turn, and the fork does NOT
  // rotate with the wheel. Zero changes inside the gear kit itself.
  const wheelUnits = [];
  const allBags = () => { const b = {};
    for (const k in bags) b[k] = GG.Bag(); return b; };
  const wheelProxy = () => {
    const wb = { tyre: GG.Bag(), hub: GG.Bag(), brake: GG.Bag() };
    wheelUnits.push(wb);
    return { proxy: Object.assign({}, bags, wb), wb };
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
  const contacts = [];
  for (const st of stations) {
    const sides = st.x > 0.01 ? [-1, 1] : [0];
    for (const s of sides) {
      const sgn = s === 0 ? 1 : s;
      let r;
      const wu = wheelProxy();
      const lb = allBags();               // this unit's LEG bags
      if (st.leg === 3) {
        // legTailwheel builds spring AND wheel into one bag-set; the
        // proxies route the spinning parts to the wheel unit, the fork
        // to the castor unit, and the spring stays in the leg unit
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
        if (st.steer > 0 && st.x < 0.01) {
          const u = GG.castorUnit(lb, st.P, r.axle, sgn, st.R, st.P.twSteer, false);
          GG.wheel(wu.proxy, u.hub, u.axis, st.R, { brake: !!st.brake, P: st.P });
          if (st.fair) GG.spat(bags, u.hub, u.axis, st.R, st.fair === 2);
          r = { axle: u.hub, axis: u.axis, travel: r.travel };
        } else {
          GG.wheel(wu.proxy, r.axle, r.axis, st.R,
                   { brake: !!st.brake, inboard: sgn, P: st.P });
          if (st.fair) GG.spat(bags, r.axle, r.axis, st.R, st.fair === 2);
        }
      }
      wu.wb.axle = r.axle; wu.wb.R = st.R;
      wu.wb.kind = (st.leg === 3 || st.x <= 0.01) ? 'T'
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
  for (const k in bags) bags[k].mesh(group, GG.MAT[k]);
  // G58.2/.3: bake each unit into its own NAMED group — the join's
  // snapshot picks these up by name, exactly as it does the prop's
  for (const wb of wheelUnits) {
    const wg = new THREE.Group();
    wg.name = 'edWheel' + (wb.kind || 'T');
    for (const k of ['tyre', 'hub', 'brake'])
      wb[k].mesh(wg, GG.MAT[k]);
    group.add(wg);
  }
  for (const lu of legUnits) {
    const lg = new THREE.Group();
    lg.name = 'edLeg' + lu.kind;
    for (const k in lu.bags) lu.bags[k].mesh(lg, GG.MAT[k]);
    group.add(lg);
  }
  if (castorUnitOut) {
    const cgp = new THREE.Group();
    cgp.name = 'edCastorT';
    for (const k in castorUnitOut.bags)
      castorUnitOut.bags[k].mesh(cgp, GG.MAT[k]);
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
  const mains = contacts.filter(c => c.st.x > 0.01).map(c => toG(c.p));
  const singles = contacts.filter(c => c.st.x <= 0.01).map(c => toG(c.p));
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
