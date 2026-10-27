// ============================================================
// THE BELLY POD (G2410-G2419, BELLY-POD for the GAME COORDINATOR; FREIGHT-2026-10-07.md §4: "External loads: a BELLY
// POD first, as its own session. It needs a bench first, trials on each validated plane, a ground-clearance check, a
// place in the certification, and a real aerodynamic cost").
//
// A moulded glassfibre pod under the fuselage, its top the body's own keel line (the lower longerons), its bottom flat
// between a rounded nose fairing and a boat-tail: the shape of a Cessna 206 / 208 cargo pod, sized by the player.
// OFF BY DEFAULT and ABSENT BY DEFAULT: a spec without `pod`, or with `pod.on` falsy, builds exactly the aeroplane it
// built before this file existed (GATE POD holds every validated build to its bytes). On:
//   spec.pod = { on: 1, len, width, depth, noseFair, tailFair, x, loadKg, door }
//     len       m, the pod's length nose to tail
//     width     m, across the flat floor (cut to 0.95 of the belly's own width at the pod's middle: it hangs UNDER
//               the fuselage, it does not overhang it)
//     depth     m, the floor's depth below the lowest point of the keel over the flat run (the keel rises aft, so
//               the pod is deeper aft - a flat floor under a sloping belly, like the real ones)
//     noseFair  the nose fairing's share of the length (a quarter-ellipse in side view)
//     tailFair  the boat-tail's share (a straight ramp from the floor up to the keel)
//     x         m aft of the firewall, the pod's nose; null = centred on the wing's quarter chord, which is where a
//               load moves the CG least
//     loadKg    the freight in it as built (payload; FREIGHT-MODEL's packer and FREIGHT-STRAP place real items)
//     door      'left' | 'right': the side hatch the load goes through (FREIGHT §1: "an item must pass the door")
// What this file answers, pure (no sim): the pod's resolved shape (genPodResolve), its CARGO SPACE for FREIGHT-
// MODEL's packer (genPodSpace: kind 'pod', its box, floor limit and door), its drag build-up (genPodCdA), its ground /
// water clearance in each attitude (genPodClearance) and the CG with it loaded (genPodBalance). 61_gen_frame bills
// its mass, 62_gen_aero adds its drag, 64_gen_build reports it on the shakedown, 66_gen_cert its mounting loads.
// ============================================================
const GEN_POD = {
  // the defaults a pod switched on takes (a C206-class pod scaled to a light two- to four-seater)
  def: { len: 2.0, width: 0.56, depth: 0.28, noseFair: 0.22, tailFair: 0.30, x: null, loadKg: 0, door: 'left' },
  clamp: { len: [0.8, 4.5], width: [0.25, 1.2], depth: [0.12, 0.6], noseFair: [0.08, 0.45], tailFair: [0.10, 0.50],
           x: [-0.2, 8], loadKg: [0, 800] },
  // THE SHELL: a glass / foam sandwich (two plies of 7781 a side over 6 mm foam ~ 1.9-2.4 kg/m2 laid up), the floor a
  // stiffer panel that takes the load to the fittings, the hardware the four fittings, the hatch's hinge and latches
  wall: 0.02,              // m, shell and floor thickness: the interior box is the shell inset by this
  shellKgM2: 2.2, floorKgM2: 3.0, hardwareKg: 4.0,
  // PRICE: the glassfibre datum (GEN_PRICES.spat: 380 a wheel pant of ~0.5 m2 -> ~700 a square metre moulded) plus
  // the fittings, the hatch and the STC-style paperwork a pod carries
  price: { perM2: 700, base: 1500 },
  // THE FLOOR LIMIT: 30 lb/ft2 = 146 kg/m2, the order of the placards on the C208's cargo pod zones; the rated load
  // is this times the floor's area
  floorLimit: 146,
  // THE DRAG (Raymer, Aircraft Design: A Conceptual Approach, 12.5 - the component build-up CdA = Cf FF Q Swet):
  //   Cf    the moulded skin's own coefficient per m2 of wetted area (GEN_MATERIALS.carbon.cdWet, "moulded: the
  //         smoothest body on the list" - the same row a moulded fuselage pays)
  //   FF    the body form factor on the fineness ratio (12.31: 1 + 60/f^3 + f/400, genFusCdA's own)
  //   Q     the interference factor (12.5.5): 1.5 "for a nacelle or store mounted directly on the fuselage"
  //   boxK  the slab-sided penalty (GEN_DRAG.boxK: Hoerner ch. 6, a rectangular section ~10 % over a round one)
  // Swet is the EXPOSED wetted area (the top is the belly's). Not subtracted: the belly skin the pod covers (Raymer's
  // Q is written on the store's own area with the host unchanged). Checked against a published cost: AOPA's Turbine
  // Quick Look on the C208 - the belly pod (111 ft3) "penalizes cruise speed by nine knots" (~5.5 % of 165 KTAS)
  // - which a cube-law power balance turns into ~16 % more parasite area: ~0.12 m2 on a C208 taken at CD0 0.03 on its
  // 26 m2 (an assumption, not a published figure); this build-up on a smooth pod of that size (4.6 x 1.1 x 0.55 m)
  // gives ~0.09 m2 - the C208's pod is stepped and blunt-ended, so the real one should cost more (HANDOVER G2410).
  // On the validated C172 the default pod costs 3.5 km/h on the probe and 3.9 km/h flown (~2 kt), the order the
  // 206 / 337 owners report for their smaller pods. The side and plan areas join the body's cross-flow blobs at
  // the body's 0.57.
  Q: 1.5,
  crossK: 0.57,
  // THE CLEARANCE ADVISORY: under this the pod is shown amber (a hard landing compresses the gear, a rut is deeper
  // than a runway); at or under 0 it strikes, shown red with the number - the engineer's handbook: shown, not forbidden
  clearWarn: 0.08,
  nSta: 24,
  // G3463 (BELLY-POD-2): THE FLOWN POD'S MEMBERS AS WHAT THEY ARE, for the damage layer (61_gen_frame's pod block; read
  // only with damage on - the sections and materials change no force, stiffness or mass):
  //   the 16 HANGERS are the four fittings' bolts and lugs: 4130 steel (GEN_CRASH.tubeFabric), sized so the pod FULL
  //     (shell + rated load) holds 23.561(b)(3)'s 9 g forward at the ultimate (as recalled, the emergency landing's
  //     cargo case; the same 9 g genCertPodMounts reports), a fitting's load over `mountShare` of the 16 (each pod
  //     node hangs from all four fittings, so two members of a fitting's four carry its quarter); fittings break
  //     brittle at 1.15 x their ultimate (30_solver dmgMember's seam rule)
  //     - and, the larger, the shell BEARING the aeroplane against the belly between them on a belly landing: the
  //     aeroplane's mass the frame is built at (genLattice's `gross`, parts.podFrame.bearKg) at `bearG` g over the 16 in compression (GAME, calibrated on the metal Cessna gear-up, damage on - a
  //     gear-up landing at 0.5-1.5 m/s crushes the pod, 3 m/s tears it off at its fittings; at 20 g nothing yields, at
  //     4 g it tears at any touch; a normal landing on the wheels never reaches it). `mountK` the hangers' stiffness
  //     over the gear class's: x 1 (x 8 made the pod a brace of the belly - the fuselage's own flexing loaded its
  //     fittings to 55 % of their ultimate parked; at x 1, 14 %)
  //   the 6 BRACES are the moulded shell: E-glass (GEN_CRASH.glass), the section two skins of `shellSkin` round the
  //     section's perimeter, shared by the six
  //   G3468: re-calibrated 10 -> 8.25 on the straight floor (its nodes ~7 mm higher than the old level floor's on the
  //   metal Cessna, the touch softer): 8 tears the pod off at 1.5 m/s, 8.5 and up hold it at 3 m/s - a narrow band,
  //   GATE DMGPOD's two anchors either side of it (HANDOVER G3468)
  mountG: 9, mountK: 1, mountShare: 1 / 8, bearG: 8.25, mountMat: 'tubeFabric', shellMat: 'glass', shellSkin: 0.0015,
  // G3468 (BELLY-POD-2): THE MAIN GEAR'S FITTINGS ARE NOT THE POD'S (the user, 27 Oct: "yours clips on the front
  // suspension ... the default cub should stop right before the X component"). The mains are anchored on the two frame
  // rings that straddle the axle (61_gen_frame genLattice's own rule, iFwd / iAft: 0.10 m either side); where those
  // anchors - the lower longerons - stand within `gearReach` of the pod's wall, the gear's vee, its fittings and its
  // bracing come down UNDER the belly where the pod would be (measured on the drawn Cub: the vee and its fittings fill
  // the pod's box from 0.35 to 1.04 m aft of the firewall, the aft ring at 0.99), and the pod keeps aft of the aft ring
  // by `gearFit` (the fitting's reach). Mains that leave the body well outboard of it (the Cessnas' spring legs, 0.18 m
  // outboard of a 0.63 m pod) leave the run free: the pod passes between them, as the 206's and the 185's pods do.
  gearReach: 0.12, gearFit: 0.08,
};

const genPodOn = S => !!(S && S.pod && typeof S.pod === 'object' && +S.pod.on);

// the keel line (the lower longerons' y) and the belly's half-width at x, off the station table
function genPodKeel(ST, x) {
  if (!ST || !ST.length) return { yb: 0, w: 0.3 };
  if (x <= ST[0].x) return { yb: ST[0].yb, w: ST[0].w };
  for (let i = 0; i < ST.length - 1; i++) {
    const a = ST[i], b = ST[i + 1];
    if (x <= b.x) { const t = (x - a.x) / Math.max(1e-9, b.x - a.x); return { yb: a.yb + t * (b.yb - a.yb), w: a.w + t * (b.w - a.w) }; }
  }
  const z = ST[ST.length - 1]; return { yb: z.yb, w: z.w };
}

// the pod's floor (its bottom) at station x - the resolved stations' own line (R.sta)
function genPodFloorAt(R, x) {
  // (the run: its straight floor exactly; the fairings: the stations' line)
  if (R && R.floorA != null && x >= R.xa && x <= R.xb) return R.floorA + (R.floorB - R.floorA) * (x - R.xa) / Math.max(1e-9, R.xb - R.xa);
  const S = R && R.sta;
  if (!S || !S.length) return R ? R.yBot : 0;
  if (x <= S[0].x) return S[0].bot;
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1];
    if (x <= b.x) { const t = (x - a.x) / Math.max(1e-9, b.x - a.x); return a.bot + t * (b.bot - a.bot); }
  }
  return S[S.length - 1].bot;
}

// ---- THE SHAPE -------------------------------------------------------------------------------------------------
// S: the resolved spec (S.wings, S.pod); ST: the frame's station table (x aft of the firewall, w the half-width, yb
// the keel). Returns null with the pod off.
// the run under the belly the main gear's fittings take, or null (the mains root clear of a pod `half` wide)
function genPodGearKeep(S, ST, half) {
  const g = S && S.gear;
  if (!g || g.type === 'floats' || g.x == null || !isFinite(+g.x) || !ST || ST.length < 2) return null;
  const gx = +g.x;
  let iF = 0; for (let i = 0; i < ST.length; i++) if (ST[i].x < gx - 0.10) iF = i;
  let iA = Math.min(ST.length - 1, iF + 1); for (let i = 0; i < ST.length; i++) if (ST[i].x > gx + 0.10) { iA = i; break; }
  const wMin = Math.min(genPodKeel(ST, ST[iF].x).w, genPodKeel(ST, ST[iA].x).w);
  if (wMin - half >= GEN_POD.gearReach) return null;
  return { x0: ST[iF].x - GEN_POD.gearFit, x1: ST[iA].x + GEN_POD.gearFit, gap: wMin - half };
}
function genPodResolve(S, ST) {
  if (!genPodOn(S) || !ST || ST.length < 2) return null;
  const D = GEN_POD.def, K = GEN_POD.clamp, sp = S.pod;
  const num = (k) => { const v = sp[k]; return (v == null || !isFinite(+v)) ? D[k] : genClamp(+v, K[k][0], K[k][1]); };
  const len = num('len'), depth = num('depth'), nf = num('noseFair'), tf = Math.min(num('tailFair'), 0.9 - nf);
  const xEnd = ST[ST.length - 1].x;
  // where it hangs: the nose at `x`, else centred on the wing's quarter chord; always under the body
  const w0 = (S.wings && S.wings[0]) || {};
  const xQ = (w0.xLE != null ? +w0.xLE : 1) + 0.25 * (+w0.chord || 1.5);
  let x0 = (sp.x != null && isFinite(+sp.x)) ? genClamp(+sp.x, K.x[0], K.x[1]) : xQ - 0.5 * len;
  // (never ahead of the firewall's fittings: on a Cub the quarter chord is 0.7 m aft of it and a 2 m pod centred
  // there would hang under the engine)
  x0 = genClamp(x0, ST[0].x + 0.15, Math.max(ST[0].x + 0.15, xEnd - 0.3 - len));
  // (never through the main gear's fittings: aft of them - G3468, the limit and the default alike)
  // (the gear's question, not the pod's size: asked at the default pod's half-width, so a pod's place never jumps as it
  // is resized - the volume row bisects on a continuous pod)
  const gearKeep = genPodGearKeep(S, ST, 0.5 * GEN_POD.def.width);
  const gearMoved = !!(gearKeep && x0 < gearKeep.x1 && x0 + len > gearKeep.x0);
  if (gearMoved) x0 = Math.min(gearKeep.x1, Math.max(ST[0].x + 0.15, xEnd - 0.3 - 0.8));
  const x1 = Math.min(xEnd - 0.3, x0 + len);
  const L = x1 - x0;
  const xa = x0 + nf * L, xb = x1 - tf * L;                    // the flat floor's run
  // THE FLOOR FOLLOWS THE BELLY (G3468): a STRAIGHT floor `depth` under the keel at both ends of the run - the chord,
  // as a moulded belly pod hangs (the Airglas Cub pod, the 206's); a level floor under a belly that rises aft (the
  // Cub's, 0.15 m over its run) made a wedge 0.28 m deep at its nose and 0.43 m at its tail, closed by a boat-tail as
  // steep. Straight, so its lowest point is always one of its ends - where the flown pod's nodes are. `yBot` is the
  // floor's LOWEST point (genPodFloorAt gives it at any station)
  const xm = 0.5 * (x0 + x1);
  const hw = Math.min(0.5 * num('width'), 0.95 * genPodKeel(ST, xm).w);
  // the side-view profile, sampled: top (the keel), bottom, half-width
  const N = GEN_POD.nSta, sta = [];
  let yBot = 1e9;
  // (the fairings rise from the run's own ends, monotonically - the lowest points stay the run's two ends, where the
  // flown pod's nodes are, genPodNodesAt)
  const fa = genPodKeel(ST, xa).yb - depth, fb = genPodKeel(ST, xb).yb - depth;
  for (let i = 0; i <= N; i++) {
    const x = x0 + L * i / N, top = genPodKeel(ST, x).yb;
    let d, h;
    if (x < xa) { const u = (xa - x) / Math.max(1e-9, xa - x0); const s = Math.sqrt(Math.max(0, 1 - u * u));
                  d = (top - fa) * s; h = hw * (0.35 + 0.65 * s); }
    else if (x > xb) { const v = (x - xb) / Math.max(1e-9, x1 - xb); d = (top - fb) * (1 - v); h = hw * (1 - 0.55 * v); }
    else { d = top - (fa + (fb - fa) * (x - xa) / Math.max(1e-9, xb - xa)); h = hw; }   // (a straight floor: the chord)
    d = Math.max(0, d);
    sta.push({ x, top, bot: top - d, d, hw: h });
    yBot = Math.min(yBot, top - d);
  }
  // areas, volume and the shell's centroid (the corners are rounded: 0.92 of the box section)
  let swet = 0, sx = 0, vol = 0, vx = 0, side = 0, plan = 0, frontal = 0;
  for (let i = 0; i < N; i++) {
    const a = sta[i], b = sta[i + 1], dx = b.x - a.x;
    const d = 0.5 * (a.d + b.d), h = 0.5 * (a.hw + b.hw), xc = 0.5 * (a.x + b.x);
    const sl = Math.hypot(dx, b.bot - a.bot);
    const per = 2 * d + 2 * h;                             // two sides and the floor (the top is the belly)
    const dA = per * sl; swet += dA; sx += dA * xc;
    const dV = 0.92 * 2 * h * d * dx; vol += dV; vx += dV * xc;
    side += d * dx; plan += 2 * h * dx;
    frontal = Math.max(frontal, 0.92 * 2 * h * d);
  }
  // the end caps the strips leave open: the boat-tail's last section is closed on the keel (d = 0); the nose's
  // first is a 0.35 hw ellipse of no depth - both 0, so nothing to add
  const wall = GEN_POD.wall;
  const floorM2 = Math.max(0, xb - xa) * Math.max(0, 2 * (hw - wall));
  // the hold: the flat run's interior, inset by the wall (the fairings are fairing, not hold)
  let litres = 0, lx = 0, dMinFlat = 1e9;
  for (const s of sta) if (s.x >= xa - 1e-9 && s.x <= xb + 1e-9) dMinFlat = Math.min(dMinFlat, s.d);
  for (let i = 0; i < N; i++) {
    const a = sta[i], b = sta[i + 1];
    const lo = Math.max(a.x, xa), hi = Math.min(b.x, xb);
    if (hi <= lo) continue;
    const d = 0.5 * (a.d + b.d) - 2 * wall, w = 2 * (hw - wall);
    if (d <= 0 || w <= 0) continue;
    const dl = d * w * (hi - lo) * 1000; litres += dl; lx += dl * 0.5 * (lo + hi);
  }
  const shellKg = swet * GEN_POD.shellKgM2 + floorM2 * GEN_POD.floorKgM2 + GEN_POD.hardwareKg;
  const price = Math.round(GEN_POD.price.base + GEN_POD.price.perM2 * swet);
  const maxKg = Math.round(GEN_POD.floorLimit * floorM2);
  const loadKg = num('loadKg');
  // THE DOOR: a side hatch over the middle 55 % of the flat run, 80 % of the hold's shallowest depth tall, its sill
  // on the floor (FREIGHT-MODEL's packer passes an item through it in some orientation)
  const dl = 0.55 * (xb - xa), dc = 0.5 * (xa + xb);
  // (the floor follows the belly, and so does the door: its sill on the floor - y0 / y1 at its middle, `slope` the
  // floor's rise per metre aft - the packer reads its w x h)
  const fA = genPodFloorAt({ sta }, dc - 0.5 * dl), fB = genPodFloorAt({ sta }, dc + 0.5 * dl);
  const doorH = Math.max(0, 0.8 * (dMinFlat - 2 * wall));
  const sill = genPodFloorAt({ sta }, dc) + wall;                // (the box's own floor: the door and the hold share it)
  const door = { side: sp.door === 'right' ? 1 : -1, sideName: sp.door === 'right' ? 'right' : 'left',
                 x0: dc - 0.5 * dl, x1: dc + 0.5 * dl, y0: sill, y1: sill + doorH, w: dl, h: doorH,
                 slope: dl > 0 ? (fB - fA) / dl : 0 };
  // THE MOUNTS: the two frame rings that straddle the shell's centroid (61_gen_frame's own `straddle` rule), each a
  // pair of fittings on its lower longerons - the rings the frame bills the pod's mass onto
  const xS = swet > 0 ? sx / swet : xm, xL = litres > 0 ? lx / litres : 0.5 * (xa + xb);
  const mounts = genPodStraddle(ST, xS);
  return { on: true, len: L, x0, x1, xa, xb, yBot, floorA: fa, floorB: fb, hw, depth, noseFair: nf, tailFair: tf, sta,
           swet, side, plan, frontal, vol, xVol: vol > 0 ? vx / vol : xm, xShell: xS, xLoad: xL,
           litres, floorM2, maxKg, loadKg, shellKg, price, door, mounts, wall, gearKeep, gearMoved };
}
// 61_gen_frame's straddle(x), over the station table alone
function genPodStraddle(ST, x) {
  let f = 0;
  for (let i = 0; i < ST.length; i++) if (ST[i].x < x - 0.05) f = i;
  let a = Math.min(ST.length - 1, f + 1);
  for (let i = 0; i < ST.length; i++) if (ST[i].x > x + 0.05) { a = i; break; }
  return [f, Math.max(a, Math.min(f + 1, ST.length - 1))];
}

// ---- THE CARGO SPACE (FREIGHT-MODEL's packer) -------------------------------------------------------------------
// The kind FREIGHT §1 names ("later a belly pod"): a box (aeroplane metres: x aft of the firewall, y up, z the half
// width), its floor limit, its rated load, its station for the CG and the door it is reached through. The packer
// fits an item if it passes `door` in some orientation and packs inside `box`.
function genPodSpace(S, ST, R) {
  const P = R || genPodResolve(S, ST);
  if (!P) return null;
  const w = P.wall;
  // the packer's box: the hold's own height (the depth inside the walls), on the floor at the run's middle - the floor
  // follows the belly, the box is the packer's axis-aligned stand-in for it
  const y0 = genPodFloorAt(P, 0.5 * (P.xa + P.xb)) + w;
  return { kind: 'pod', id: 'pod', name: 'Belly pod', external: true,
           box: { x0: P.xa, x1: P.xb, y0, y1: y0 + Math.max(0, P.depth - 2 * w), halfW: P.hw - w },
           litres: P.litres, floorM2: P.floorM2, floorKgM2: GEN_POD.floorLimit, maxKg: P.maxKg,
           station: P.xLoad, door: Object.assign({}, P.door) };
}

// ---- THE DRAG ---------------------------------------------------------------------------------------------------
function genPodCdA(R) {
  if (!R) return null;
  const cdWet = (typeof GEN_MATERIALS !== 'undefined' && GEN_MATERIALS.carbon && GEN_MATERIALS.carbon.cdWet) || 0.0045;
  const dEq = Math.sqrt(4 * Math.max(1e-6, R.frontal) / Math.PI);
  const f = Math.max(1.5, R.len / Math.max(0.05, dEq));
  const FF = 1 + 60 / (f * f * f) + f / 400;
  const boxK = 1 + ((typeof GEN_DRAG !== 'undefined' && GEN_DRAG.boxK) || 0.10);
  const cda = cdWet * FF * GEN_POD.Q * boxK * R.swet;
  return { cda, cdWet, FF, f, Q: GEN_POD.Q, boxK, swet: R.swet, frontal: R.frontal,
           cdFrontal: cda / Math.max(1e-6, R.frontal),
           // the cross-flow: the side area to the lateral blob, the plan area to the vertical, at the body's 0.57
           crossY: GEN_POD.crossK * R.plan, crossZ: GEN_POD.crossK * R.side,
           src: 'Raymer 12.5 (Cf FF Q Swet): Cf the moulded row 0.0045/m2, FF 1+60/f^3+f/400, Q 1.5 (store on the fuselage), box 1.10 (Hoerner ch. 6)' };
}

// ---- THE GROUND AND THE WATER -----------------------------------------------------------------------------------
// The pod's lowest point against the ground in each attitude the aeroplane takes on it, off the lattice as built
// (x aft of the firewall, y up; the level lattice is the design attitude):
//   level        the fuselage level, on the mains' contact line: a tricycle at rest, a taildragger tail-up on its run
//   three-point  a taildragger at rest: rotated tail-down about the mains' contact by the deck angle
//   rotation     a tricycle at the take-off / landing flare's limit: rotated about the mains until the tail strikes
//                (the pod may be what strikes first - the clearance is then at that angle, and negative)
//   at rest on the water   a float build: the floats' even-keel waterline at the all-up mass in fresh water
//                (Archimedes over the hull's own sections, 32_hydro levelVolume)
// def: the built def (spec, parts); mass: the all-up kg. Pure.
function genPodClearance(def, mass) {
  const S = def && def.spec, P = def && def.parts, R = P && P.pod;
  if (!R || !S || !S.gear) return null;
  const pts = R.sta.map(s => [s.x, s.bot]);
  const rows = [];
  const lowest = (th, x0, y0) => {           // rotate tail-down by th (rad) about (x0, y0); the lowest point
    let best = { h: 1e9, x: 0 };
    const c = CORE_MATH.cos(th), s = CORE_MATH.sin(th);
    for (const [x, y] of pts) { const h = (y - y0) * c - (x - x0) * s; if (h < best.h) best = { h, x }; }
    return best;
  };
  if (P.floats && P.floats.length) {
    const F0 = P.floats[0], FP = F0.P, yK = F0.pos[1];
    const W = Math.max(1, mass || 0), rho = (typeof HYDRO !== 'undefined' && HYDRO.DEF && HYDRO.DEF.rho) || 1000;
    let hw = null;
    if (typeof HYDRO !== 'undefined' && HYDRO.levelVolume) {
      const F = { P: FP, xBow: -FP.xs, xStern: FP.L - FP.xs };
      let lo = 0, hi = (FP.H || 0.6) * 1.5;
      for (let k = 0; k < 40; k++) { const m = 0.5 * (lo + hi); if (2 * HYDRO.levelVolume(F, m, 400) * rho < W) lo = m; else hi = m; }
      hw = 0.5 * (lo + hi);
    }
    const yW = hw == null ? yK : yK + hw;
    const b = lowest(0, 0, yW);
    rows.push({ id: 'water', name: 'at rest on the water', deg: 0, clear: b.h, x: b.x, draft: hw });
  } else {
    const ground = S.gear.y - S.gear.contactR;
    const gx = P.gx;
    const lv = lowest(0, gx, ground);
    rows.push({ id: 'level', name: S.gear.type === 'tricycle' ? 'level, at rest' : 'level, tail up', deg: 0, clear: lv.h, x: lv.x });
    const tw = P.TW >= 0 ? def.nodes[P.TW] : null;
    if (S.gear.type !== 'tricycle' && tw) {
      const deck = Math.atan(((tw.p[1] - S.gear.twR) - ground) / (P.twX - gx));
      const b = lowest(deck, gx, ground);
      rows.push({ id: 'threePoint', name: 'three-point, at rest', deg: deck * 180 / Math.PI, clear: b.h, x: b.x });
    } else {
      // the tail strike: the steepest the aft body allows about the mains (the keel's stations aft of them)
      let th = 0.35;
      for (const s of P.ST) if (s.x > gx + 0.3) th = Math.min(th, Math.atan2(s.yb - ground, s.x - gx));
      const b = lowest(th, gx, ground);
      rows.push({ id: 'rotation', name: 'rotated to the tail strike', deg: th * 180 / Math.PI, clear: b.h, x: b.x });
    }
  }
  let worst = rows[0];
  for (const r of rows) if (r.clear < worst.clear) worst = r;
  // THE UNDERCARRIAGE IN THE WAY: the mains leave the body at the lower longerons' corners (the pod is cut to 0.95
  // of the belly's width, so they clear by construction - the gap is reported); a NOSE LEG or a TAILWHEEL under the
  // pod's run is a conflict, the pod refused with it (it would have to be cut round the leg)
  const legs = [];
  const zMain = (P.gearAnchors || []).map(i => P.ST[i] ? P.ST[i].w : null).filter(v => v != null);
  if (zMain.length && !(P.floats && P.floats.length))
    legs.push(R.gearKeep ? { id: 'mains', name: 'the main gear\'s fittings, ahead of it', gap: R.x0 - R.gearKeep.x1, ok: R.x0 >= R.gearKeep.x1 - 1e-6 }
                         : { id: 'mains', name: 'the main legs, beside it', gap: Math.min(...zMain) - R.hw, ok: true });
  if (P.TW >= 0 && P.twX > R.x0 - 0.1 && P.twX < R.x1 + 0.1)
    legs.push({ id: S.gear.type === 'tricycle' ? 'nose' : 'tail', name: S.gear.type === 'tricycle' ? 'the nose leg, under it' : 'the tailwheel, under it',
                gap: -1, ok: false });
  const legsOk = legs.every(l => l.ok);
  return { rows, worst, legs, legsOk, ok: worst.clear > 0 && legsOk,
           warn: worst.clear > 0 && worst.clear < GEN_POD.clearWarn };
}

// ---- THE BALANCE ------------------------------------------------------------------------------------------------
// The CG with the pod loaded to its rated load, against the range the shakedown's corners span (when it has them)
// and the neutral point: the margin left. sh: genShakedown's sheet of THIS build (the pod's shell and its loadKg
// already billed); R: the resolved pod.
function genPodBalance(sh, R) {
  if (!sh || !R) return null;
  const pct = x => (sh.cBar > 0 && typeof sh.xLEmac === 'number') ? (x - sh.xLEmac) / sh.cBar : null;
  const add = Math.max(0, R.maxKg - (R.loadKg || 0));
  const m = sh.mass + add, cg = (sh.mass * sh.cgX + add * R.xLoad) / Math.max(1e-6, m);
  const sm = (sh.npX - cg) / Math.max(1e-6, sh.cBar);
  const env = sh.envelope || null;
  const lo = env ? env.fwd.cgX : null, hi = env ? env.aft.cgX : null;
  return { loadKg: R.maxKg, mass: m, cgX: cg, cgPct: pct(cg), staticMargin: sm,
           cgAsIs: sh.cgX, cgAsIsPct: pct(sh.cgX), shift: cg - sh.cgX,
           range: env ? { fwd: lo, aft: hi, fwdPct: pct(lo), aftPct: pct(hi) } : null,
           inRange: env ? (cg >= lo - 1e-9 && cg <= hi + 1e-9) : null,
           designGross: sh.pod && sh.pod.designGross != null ? sh.pod.designGross : null,
           overGross: sh.pod && sh.pod.designGross != null ? m - sh.pod.designGross : null };
}

// ---- THE SHELL (a clean generated mesh; the drawn pod) ----------------------------------------------------------
// The pod's skin in the generator's own body frame (metres: x aft of the firewall, y up, z across), lofted through the
// sampled stations: each section a rounded box (a superellipse of exponent 4, the corners of a moulded pod) from the
// keel on one side, down round the floor, back up to the keel on the other; open along the top (the belly closes it).
// Pure: { pos: Float32Array, idx: Uint32Array, nv, nt }. GATE POD checks it is finite, closed at its ends, its
// lowest vertex the resolver's floor and every vertex inside the resolver's box.
function genPodShell(R, nAround) {
  if (!R) return null;
  const NA = Math.max(8, nAround | 0 || 16), pos = [], idx = [];
  for (const s of R.sta) {
    for (let j = 0; j <= NA; j++) {
      const t = Math.PI * j / NA;                  // 0: the right side at the keel, pi/2: the floor, pi: the left side
      const c = CORE_MATH.cos(t), sn = CORE_MATH.sin(t);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 0.5), ey = Math.pow(Math.abs(sn), 0.5);
      pos.push(s.x, s.top - s.d * ey, s.hw * ex);
    }
  }
  const W = NA + 1;
  for (let i = 0; i < R.sta.length - 1; i++)
    for (let j = 0; j < NA; j++) {
      const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx), nv: pos.length / 3, nt: idx.length / 3 };
}

// ---- THE EDITOR'S VIEW: A VOLUME AND A SHAPE (G2675, BELLY-POD-2) ------------------------------------------------
// The user (7 Oct): "it should be a configurable volume from the garage editor". The spec keeps the core's own rows
// (len / width / depth, through GEN_POD.clamp); the editor leads with what a builder asks for - how many litres the
// hold takes, and how that volume is shaped - and these two pure functions map one onto the other:
//   shape   0 = long and shallow (the least frontal area, the most ground clearance), 1 = short and deep. It is the
//           pod's length over its depth, 12 at 0 to 4 at 1, linearly; the width is twice the depth (the default
//           pod's 0.56 / 0.28), cut by the resolver to 0.95 of the belly as always.
//   litres  the HOLD (genPodResolve's `litres`: the flat run's interior, inset by the wall - the fairings are fairing,
//           not hold): what the freight packer fills.
// genPodFromVolume bisects the depth (the hold grows monotonically with it at a fixed shape) on the resolver itself,
// with the aeroplane's own station table: the answer is exactly what the frame will build. Where a clamp or the body
// stops it short, `reached` is false and `litres` is the most this shape can hold here.
const GEN_POD_UI = {
  litres: [20, 1000], shape: [0, 1],
  ldAt0: 12, ldAt1: 4, wd: 2.0,
  round: 1000,                                                    // the spec's dims to the millimetre
};
const genPodLD = t => GEN_POD_UI.ldAt0 + (GEN_POD_UI.ldAt1 - GEN_POD_UI.ldAt0) * genClamp(+t || 0, 0, 1);
// the shape a pod's own dims read as (the inverse of genPodLD, clamped)
function genPodShapeOf(len, depth) {
  const r = (+len || GEN_POD.def.len) / Math.max(1e-6, +depth || GEN_POD.def.depth);
  return genClamp((r - GEN_POD_UI.ldAt0) / (GEN_POD_UI.ldAt1 - GEN_POD_UI.ldAt0), 0, 1);
}
// S: the resolved spec (S.pod's other rows - fairings, x, door - are kept); ST: the frame's station table.
// -> { len, width, depth, litres, reached }
function genPodFromVolume(S, ST, litres, shape) {
  const K = GEN_POD.clamp, U = GEN_POD_UI, ld = genPodLD(shape);
  const want = genClamp(+litres || 0, U.litres[0], U.litres[1]);
  const q = v => Math.round(v * U.round) / U.round;
  const dims = d => ({ len: q(genClamp(ld * d, K.len[0], K.len[1])), width: q(genClamp(U.wd * d, K.width[0], K.width[1])), depth: q(genClamp(d, K.depth[0], K.depth[1])) });
  const at = d => { const o = dims(d); const R = genPodResolve(Object.assign({}, S, { pod: Object.assign({}, S && S.pod, o, { on: 1 }) }), ST);
                    o.litres = R ? R.litres : 0; return o; };
  let lo = K.depth[0], hi = K.depth[1];
  const top = at(hi);
  if (top.litres < want) return Object.assign(top, { reached: false });
  const bot = at(lo);
  if (bot.litres >= want) return Object.assign(bot, { reached: bot.litres - want < 0.5 });
  for (let i = 0; i < 40; i++) { const m = 0.5 * (lo + hi); if (at(m).litres < want) lo = m; else hi = m; }
  return Object.assign(at(hi), { reached: true });
}

// ---- THE EDITOR'S READOUTS AND ITS RED REASONS (G2675) ----------------------------------------------------------
// Off the core's own numbers, nothing re-derived: the hold and the floor (genPodSpace), the empty mass and the price
// (the ledger's `pod` row), the drag (genPodCdA, through 62_gen_aero) and its cost in cruise and range (the sheet's
// pod.cruise on this aeroplane's probe), the CG with the pod empty (its shell's moment on the sheet's own mass) and
// full (genPodBalance), and the clearance in every attitude (genPodClearance). sh may be null (the garage runs the
// shakedown post-idle): the rows that need it then say so (`pending`), the rest are exact already.
// RED, with the reason, when it is out of bounds: a clearance under GEN_POD.clearWarn (0.08 m), a strike, a leg under
// the pod, or a static margin under 0 full (the Jodel's refusal); AMBER when the margin full is under the bench's 0.05.
function genPodReadout(def, sh) {
  const P = def && def.parts, R = P && P.pod;
  if (!R) return null;
  const S = def.spec, sp = genPodSpace(S, P.ST, R), pd = genPodCdA(R), Lg = P.ledger && P.ledger.pod;
  const p = sh && sh.pod;
  const C = p ? p.clearance : genPodClearance(def, sh ? sh.mass : null);
  const out = {
    litres: sp.litres, floorM2: sp.floorM2, maxKg: sp.maxKg, len: R.len, width: 2 * R.hw, depth: R.depth,
    shape: genPodShapeOf(R.len, R.depth),
    emptyKg: Lg ? Lg.mass : R.shellKg, price: Lg ? Lg.cost : R.price,
    cda: pd.cda, cdFrontal: pd.cdFrontal,
    cruise: null, rangeKm: null, dRangeKm: null, cgEmpty: null, cgFull: null,
    clearance: C ? C.rows.map(r => ({ id: r.id, name: r.name, deg: r.deg, clear: r.clear })) : [],
    legs: C ? (C.legs || []).map(l => ({ id: l.id, name: l.name, gap: l.gap, ok: l.ok })) : [],
    pending: !p, red: [], amber: [],
  };
  if (p) {
    const c = p.cruise || {};
    out.cruise = { vWith: c.vWith, vWithout: c.vWithout, dV: c.dV, dPct: c.dPct, dClimb: c.dClimb };
    // G3461: the sheet's penalty against the same aeroplane with no pod (take-off, climb, cruise)
    out.perf = p.perf ? Object.assign({}, p.perf) : null;
    out.rangeKm = sh.rangeKm;
    out.dRangeKm = sh.rangeKm != null && c.dRangePct != null ? sh.rangeKm - sh.rangeKm / (1 + c.dRangePct) : null;
    // the CG empty: the shell's moment taken back off the sheet's own mass and CG (the pod billed by moment, 61_)
    const m0 = sh.mass - R.shellKg, cg0 = m0 > 0 ? (sh.mass * sh.cgX - R.shellKg * R.xShell) / m0 : sh.cgX;
    const pct = x => (sh.cBar > 0 && typeof sh.xLEmac === 'number') ? (x - sh.xLEmac) / sh.cBar : null;
    out.cgEmpty = { cgX: sh.cgX, shift: sh.cgX - cg0, cgPct: pct(sh.cgX), staticMargin: sh.staticMargin };
    const b = p.balance;
    if (b) out.cgFull = { cgX: b.cgX, shift: b.shift, cgPct: b.cgPct, staticMargin: b.staticMargin, loadKg: b.loadKg };
  }
  const n2 = v => (+v).toFixed(2);
  for (const r of out.clearance) {
    if (!(r.clear > 0)) out.red.push('it strikes ' + r.name + ' (' + n2(r.clear) + ' m)');
    else if (r.clear < GEN_POD.clearWarn) out.red.push(r.name + ': ' + n2(r.clear) + ' m clear, under ' + GEN_POD.clearWarn + ' m');
  }
  for (const l of out.legs) if (!l.ok) out.red.push(l.name);
  if (out.cgFull && out.cgFull.staticMargin != null) {
    if (out.cgFull.staticMargin < 0) out.red.push('full, its static margin is ' + n2(out.cgFull.staticMargin) + ' (unstable)');
    else if (out.cgFull.staticMargin < 0.05) out.amber.push('full, its static margin is only ' + n2(out.cgFull.staticMargin));
  }
  out.ok = !out.red.length;
  return out;
}

// ---- THE FLOWN POD'S CONTACT POINTS (G2678) ---------------------------------------------------------------------
// The four points 61_gen_frame makes the pod's nodes at: the flat floor's fore (xa) and aft (xb) ends, half the pod's
// half-width out each side, ON the shell (genPodShell's superellipse: at |z| = hw / 2 its bottom is sqrt(sin t) of the
// depth down, cos t = 1/4) - so in every attitude genPodClearance measures, the lowest node is within a few
// millimetres of the lowest point of the shell (GATE POD holds it). Order: fore left, fore right, aft left, aft right
// (+z is left, the generator's frame). -> [[x, y, z] x 4]
const GEN_POD_NODE_Z = 0.5;
function genPodNodesAt(R, ST) {
  const ey = Math.sqrt(Math.sqrt(1 - 0.0625));             // |cos t| = 0.25 at |z| = hw / 2 (ex = sqrt|cos t|)
  const out = [];
  for (const x of [R.xa, R.xb]) {
    const top = genPodKeel(ST, x).yb, d = Math.max(0, top - genPodFloorAt(R, x)), y = top - d * ey, z = GEN_POD_NODE_Z * R.hw;
    out.push([x, y, z], [x, y, -z]);
  }
  return out;
}

// ---- THE POD IN A CRASH (G3463, BELLY-POD-2; the damage layer on) ---------------------------------------------------
// A pod is sacrificial: on a gear-up or a collapsed-gear landing it is what touches, it scrapes, and on a hard one it
// tears off at its fittings (61_gen_frame: its own part, group `pod:mount`, the 16 hangers its joint). Read after (or
// during) a flight from the solver's damage record - never pushed into it:
//   D.pod    each pod node's scrape (30_solver: slid metres, friction work, peak normal force)
//   D.groups the groups broken (pod:mount = torn off), D.broken / D.wB the members broken / their plastic work
// THE WEAR (Archard's law written as an energy: the volume abraded = the friction's work over a specific abrasion
// energy): each node stands for a quarter of the floor, so its patch is worn by work / (GEN_POD_DMG.eAbr x the patch).
// eAbr 1.0e9 J/m3 is GAME (the order of a polymer laminate's specific abrasion energy on an abrasive face; A0 to
// source): with it a 1 000 kg aeroplane sliding 100 m on its pod wears its aft patches ~2 mm - the outer skin of a
// glass / foam pod (two plies and a gelcoat: GEN_POD_DMG.skin) - which is what the pods' owners report of a gear-up
// slide (the floor ground through, the freight in it scuffed or wet). The tiers:
//   clean     no pod node touched                      freight safe
//   scuffed   worn under GEN_POD_DMG.scuff (the gelcoat) freight safe
//   ground    worn under the outer skin                 freight safe (a repair: the floor laid up again)
//   holed     the outer skin ground through             freight AT RISK (the floor open to the runway)
//   crushed   a pod member yielded or broke (no tear)   freight AT RISK (the shell deformed round it)
//   torn off  the mount group let go                    freight LOST with the pod (left on the ground)
// def: the built def (parts.pod, parts.podFrame); D: sim.damage(). -> null without a pod, else the verdict.
const GEN_POD_DMG = { eAbr: 1.0e9, skin: 0.002, scuff: 0.0005 };
function genPodDamage(def, D) {
  const P = def && def.parts, R = P && P.pod, F = P && P.podFrame;
  if (!R || !F) return null;
  const S = D && D.pod, patch = Math.max(1e-3, (R.xb - R.xa) * 2 * R.hw / 4);
  const worn = [0, 0, 0, 0], slide = [0, 0, 0, 0], work = [0, 0, 0, 0];
  if (S) for (let k = 0; k < 4; k++) { slide[k] = S.slide[k]; work[k] = S.work[k]; worn[k] = S.work[k] / (GEN_POD_DMG.eAbr * patch); }
  const wMax = Math.max(...worn), touched = slide.some(v => v > 0) || (S && S.fnPeak && Array.prototype.some.call(S.fnPeak, v => v > 0));
  const mine = F.hangers.concat(F.braces);
  const brk = new Set((D && D.broken) || []);
  const nBroken = mine.filter(b => brk.has(b)).length;
  const nSet = D && D.wB ? mine.filter(b => D.wB[b] > 0).length : 0;
  const torn = !!(D && D.groups && D.groups.some(g => g.key === 'pod:mount'));
  const state = torn ? 'torn off' : (nBroken || nSet) ? 'crushed' : wMax >= GEN_POD_DMG.skin ? 'holed'
    : wMax >= GEN_POD_DMG.scuff ? 'ground' : touched ? 'scuffed' : 'clean';
  const freight = torn ? 'lost' : (state === 'crushed' || state === 'holed') ? 'at risk' : 'safe';
  const loadKg = R.loadKg || 0;
  const mm = v => (v * 1000).toFixed(1);
  const say = state === 'clean' ? null
    : 'belly pod ' + state + (state === 'torn off' ? ' at its fittings' : '') + ' - slid ' + Math.max(...slide).toFixed(0) + ' m, worn '
      + mm(wMax) + ' mm' + (freight === 'safe' ? '' : '; its freight ' + (freight === 'lost' ? 'LOST with it' : 'AT RISK') + (loadKg > 0 ? ' (' + Math.round(loadKg) + ' kg)' : ''));
  return { state, freight, torn, touched: !!touched, worn, wornMax: wMax, slide, work, patch,
           members: { broken: nBroken, set: nSet, of: mine.length }, loadKg, say,
           tFirst: S ? S.tFirst : -1 };
}
