#!/usr/bin/env node
// GATE STRUT (G88) — the verdict on the lift-strut foot.
//
//   node tools/_strut_check.js [--verbose]   ->  "GATE STRUT: PASS|FAIL"
//
// WHAT IT CAN AND CANNOT SEE. The fitting is drawn in the browser with
// GEAR_KIT's primitives, and a gate that needed THREE to say anything would
// say it about a stub. So this tests the two halves that are actually
// decidable in node, and they are the two halves that were wrong:
//
//   THE SITE. "Constrained to the aircraft skin" is a claim with a number in
//   it — the distance from the drawn foot to the surface — and the claim is
//   that the number is ZERO, on any body, for any seed, at any slider. The
//   snap is a scan and the surface is not convex, so "it found the nearest
//   point" is checked against brute force rather than asserted.
//
//   THE DECLARED TABLE. A plate shorter than the pins it carries, or a blade
//   fatter than the clevis it enters, is a fault in a number and is cheaper
//   to catch here than in a screenshot.
//
// THE STUB HAS A DENT IN IT, on purpose. A fuselage section is star-shaped
// about its own centre and NOT convex — a chine, a door sill or a fairing is
// a dent — and a gradient walk started at the wrong angle settles in one. The
// negative probes below prove that a coarser search actually fails this body,
// so the scan is not being paid for out of superstition.
'use strict';
const path = require('path');
const SG = require(path.join(__dirname, '_strut_gen.js'));

const VERBOSE = process.argv.includes('--verbose');
const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------------------------------------------------------------------------
// a body to stand on: the airframe contract, analytically, with a chine
// ---------------------------------------------------------------------------
function stubAF() {
  const z0 = -2.40, z1 = 3.00;
  const shape = z => {
    const t = clamp((z - z0) / (z1 - z0), 0, 1);
    return clamp(t < 0.72 ? 0.34 + 0.66 * Math.pow(t / 0.72, 0.45)
                          : 1 - 0.55 * Math.pow((t - 0.72) / 0.28, 1.6),
                 0.10, 1);
  };
  const halfWAt = z => 0.55 * shape(z);
  const heightAt = z => 0.62 * shape(z);
  const keelAt = z => -0.70 + 0.32 * Math.pow(clamp((z - 1.4) / (z1 - 1.4), 0, 1), 2);
  const cyAt = z => keelAt(z) + heightAt(z);
  const rad = (z, a) => {
    const W = halfWAt(z), H = heightAt(z);
    const s = Math.sin(a) / W, c = Math.cos(a) / H;
    const e = 1 / Math.sqrt(s * s + c * c);
    // THE CHINE: a 10 % dent at +/- 0.95 rad off the keel. This is what makes
    // the section non-convex and the scan necessary.
    const k = (Math.abs(a) - 0.95) / 0.18;
    return e * (1 - 0.10 * Math.exp(-k * k));
  };
  const surf = (z, a) => [Math.sin(a) * rad(z, a), cyAt(z) - Math.cos(a) * rad(z, a), z];
  const nrmAt = () => [0, -1, 0];             // unused by the site math
  return { z0, z1, surf, keelAt, halfWAt, heightAt, cyAt, nrmAt };
}
const AF = stubAF();
const PAD = 0.05;

// brute force: the true nearest surface point, on a fine grid
function brute(p) {
  let bd = Infinity, bz = 0, ba = 0;
  for (let i = 0; i <= 540; i++) {
    const z = AF.z0 + PAD + (AF.z1 - AF.z0 - 2 * PAD) * i / 540;
    for (let k = 0; k < 720; k++) {
      const a = -Math.PI + 2 * Math.PI * k / 720;
      const d = d3(AF.surf(z, a), p);
      if (d < bd) { bd = d; bz = z; ba = a; }
    }
  }
  return { z: bz, ang: ba, d: bd };
}

// the seeds: a truss node sits INSIDE the body, on a lower longeron, so these
// are interior points spread over the cabin and the boom, both flanks, plus
// four deliberately awkward ones (on the keel, above the deck, far outside).
const SEEDS = [];
for (const z of [-1.6, -0.4, 0.6, 1.4, 2.2])
  for (const x of [0.38, -0.38, 0.16, -0.16])
    SEEDS.push([x, AF.keelAt(z) + 0.06, z]);
SEEDS.push([0.02, AF.keelAt(0.8) - 0.30, 0.8]);      // under the keel
SEEDS.push([0.02, AF.cyAt(0.8) + 0.60, 0.8]);        // over the deck
SEEDS.push([1.60, -0.40, 0.9]);                      // well outside, +x
SEEDS.push([-1.60, -0.40, 0.9]);                     // well outside, -x

// ---------------------------------------------------------------------------
// 1: the snap IS the nearest point, and it is ON the surface
// ---------------------------------------------------------------------------
{
  let worst = 0, worstAt = null;
  for (const s of SEEDS) {
    const got = SG.strutSnap(AF, s, { pad: PAD });
    const ref = brute(s);
    const gap = got.d - ref.d;
    if (gap > worst) { worst = gap; worstAt = s; }
    // the point it reports must BE the surface point at the station it
    // reports, or every consumer that re-asks the contract gets a different
    // answer than the one that was checked
    check(d3(got.p, AF.surf(got.z, got.ang)) < 1e-12,
          'snap: reported point is not surf(z, ang)');
    check(got.z >= AF.z0 + PAD - 1e-9 && got.z <= AF.z1 - PAD + 1e-9,
          'snap: station off the body', got.z.toFixed(3));
  }
  check(worst < 1e-4, 'snap: not the nearest point',
        (worst * 1000).toFixed(3) + ' mm worse than brute force at ' +
        JSON.stringify(worstAt));
  if (VERBOSE) console.log('  snap vs brute force, worst: ' +
    (worst * 1e6).toFixed(1) + ' um over ' + SEEDS.length + ' seeds');
}

// ---------------------------------------------------------------------------
// 2: the trim offsets are metres, and zero is the identity
// ---------------------------------------------------------------------------
{
  for (const s of SEEDS.slice(0, 12)) {
    const site = SG.strutSite(AF, s, 0, 0, { pad: PAD });
    check(Math.abs(site.z - site.snap.z) < 1e-12 &&
          Math.abs(site.ang - site.snap.ang) < 1e-12,
          'site: zero trim is not the identity');
    // fore/aft: exact, inside the clamp band
    for (const dz of [-0.30, -0.05, 0.12, 0.40]) {
      const t = SG.strutSite(AF, s, dz, 0, { pad: PAD });
      const want = clamp(site.snap.z + dz, AF.z0 + PAD, AF.z1 - PAD);
      check(Math.abs(t.z - want) < 1e-12, 'site: fore/aft is not exact',
            (t.z - want).toExponential(2));
    }
    // lateral: an ARC LENGTH. The chord between the two feet is shorter than
    // the arc and approaches it as the step shrinks, so this brackets rather
    // than equates — an angular slider would fail the lower bound on a fat
    // section and the upper bound on a thin one.
    for (const dl of [0.06, 0.12]) {
      const t = SG.strutSite(AF, s, 0, dl, { pad: PAD });
      const gap = d3(AF.surf(t.z, t.ang), AF.surf(site.z, site.ang));
      check(gap <= dl + 1e-9 && gap >= dl * 0.95,
            'site: lateral is not an arc length', gap.toFixed(4) + ' for ' + dl);
    }
  }
}

// ---------------------------------------------------------------------------
// 3: the foot never leaves its own flank, however hard the slider is pushed
// ---------------------------------------------------------------------------
{
  for (const s of SEEDS) {
    for (const dz of [-40, 40]) for (const dl of [-40, 40]) {
      const t = SG.strutSite(AF, s, dz, dl, { pad: PAD });
      check(t.z >= AF.z0 + PAD - 1e-9 && t.z <= AF.z1 - PAD + 1e-9,
            'clamp: station left the body', t.z.toFixed(3));
      check(Math.abs(t.ang) >= 0.04 - 1e-9 && Math.abs(t.ang) <= Math.PI - 0.12 + 1e-9,
            'clamp: foot crossed the keel or the deck', t.ang.toFixed(3));
      check(Math.sign(t.ang) === t.side,
            'clamp: foot changed flank');
      check(isFinite(t.z) && isFinite(t.ang), 'clamp: non-finite site');
    }
  }
}

// ---------------------------------------------------------------------------
// 4: BOTH FEET MOVE THE SAME WAY. A slider that takes the right strut out and
// the left strut in is a slider nobody can use, and mirroring the seed is the
// only way to see it — the two sides differ by the sign of an angle.
// ---------------------------------------------------------------------------
{
  for (const z of [-0.4, 0.6, 1.4]) {
    const y = AF.keelAt(z) + 0.06;
    const R = SG.strutSite(AF, [0.38, y, z], 0, 0, { pad: PAD });
    const L = SG.strutSite(AF, [-0.38, y, z], 0, 0, { pad: PAD });
    check(Math.abs(R.z - L.z) < 1e-9 && Math.abs(R.ang + L.ang) < 1e-9,
          'mirror: the two feet are not mirrored', R.ang.toFixed(4) + ' / ' +
          L.ang.toFixed(4));
    for (const dl of [0.10, -0.10]) {
      const r2 = SG.strutSite(AF, [0.38, y, z], 0, dl, { pad: PAD });
      const l2 = SG.strutSite(AF, [-0.38, y, z], 0, dl, { pad: PAD });
      const dR = Math.abs(AF.surf(r2.z, r2.ang)[0]) - Math.abs(AF.surf(R.z, R.ang)[0]);
      const dL = Math.abs(AF.surf(l2.z, l2.ang)[0]) - Math.abs(AF.surf(L.z, L.ang)[0]);
      check(Math.abs(dR - dL) < 1e-9 && Math.sign(dR) === Math.sign(dl),
            'mirror: the sliders move the feet in different directions',
            dR.toFixed(5) + ' / ' + dL.toFixed(5));
    }
  }
}

// ---------------------------------------------------------------------------
// 5: the declared fitting is a fitting that can be built
// ---------------------------------------------------------------------------
const RULES = [
  ['the plate covers both clevises',
   F => F.padL >= 2 * (F.lugGap + F.lugR) + 0.02],
  ['the plate is wider than an eye',
   F => F.padW >= 2 * F.lugR + 0.02],
  ['the pin passes through both ears',
   F => F.pinShank >= 2 * (F.bladeT * 0.5 + F.lugT + 0.0015) + 0.004],
  ['the eye stands clear of the plate',
   F => F.standoff > F.lugR + F.padT],
  ['the end fitting is a NARROWING of the strut',
   F => F.bladeC < F.chordK * F.strutR],
  ['...and a FLATTENING of it',
   F => F.bladeT < 2 * 0.118 * F.chordK * F.strutR],
  ['the transition is a tenth of the member, not half of it',
   F => F.endFrac > 0.02 && F.endFrac < 0.5],
  ['a screw is smaller than a bolt eye',
   F => F.screwR < F.lugR && F.screwR < F.pinR],
  ['the doubler is a sheet, not a slab',
   F => F.padT > 0.002 && F.padT < 0.02],
  ['the strut is 63_gen_skin\'s own external wing member',
   F => Math.abs(F.strutR - 0.020 * 1.15) < 1e-9 && F.chordK === 3.6],
  // the WING end (G87): the same object, spreading into a spar cap instead
  // of into a 0.6 mm skin, and living in a band a few tenths of a chord wide
  ['the wing plate covers its own clevis',
   F => F.wingPadL >= 2 * F.lugR + 0.04 && F.wingPadW >= 2 * F.lugR + 0.02],
  ['the wing plate is the smaller of the two',
   F => F.wingPadL < F.padL && F.wingPadW < F.padW],
  ['the wing eye stands clear of its plate',
   F => F.wingStandoff > F.lugR + F.wingPadT],
  ['the wing doubler is a sheet, not a slab',
   F => F.wingPadT > 0.002 && F.wingPadT < 0.02],
  ['the same pin serves both ends',
   F => F.pinShank >= 2 * (F.bladeT * 0.5 + F.lugT + 0.0015) + 0.004],
];
{
  const F = SG.STRUT_FIT;
  for (const [label, rule] of RULES)
    check(rule(F), 'fitting: ' + label);
  for (const k in F)
    check(isFinite(F[k]) && F[k] > 0, 'fitting: ' + k + ' is not a real length');
}

// ---------------------------------------------------------------------------
// 5b: THE EAR REACHES THE PLATE (G108)
// ---------------------------------------------------------------------------
// The one thing about the DRAWN fitting that this gate could not see, and it
// was wrong for the whole life of the arc: the user, with the joint circled,
// "there is a small gap between the end of the struts and the metal plate they
// attach to, on both ends".
//
// It is decidable in node after all, and GATE GEAR (G67.3) is why: `lug` is
// _gear_kit's, _gear_kit touches THREE at exactly one point (`bag.mesh()`),
// so a stub records what the bench DRAWS through the bench's own output path.
//
// WHAT IS ASSERTED is the height the ear's ROOT reaches, off the skin, in the
// fitting's own frame — and it is asserted about `strutClevisUp`, the
// generator's OWN answer to which way the ear points, so reverting that line
// turns this red. A gate that re-derived the cross product would be checking
// its own copy of the rule.
//
// The declared intent is `stand * 0.92`: an ear whose root sits at 8 % of the
// stand-off off the skin, which for either end is inside its own doubler.
// What was drawn instead spanned 39..71 mm against a 7 mm plate.
{
  const fs2 = require('fs'), vm2 = require('vm');
  function stubTHREE() {
    function Mat(o) { Object.assign(this, { isMat: 1 }, o || {}); }
    class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
    class BufferGeometry {
      constructor() { this.attributes = {}; this.index = null; }
      setAttribute(k, a) { this.attributes[k] = a; }
      setIndex(i) { this.index = i; }
      computeVertexNormals() {}
    }
    class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
    class LineSegments { constructor(g, m) { this.geometry = g; this.material = m; } }
    return { BufferAttribute, BufferGeometry, Mesh, LineSegments,
             LineBasicMaterial: Mat, MeshLambertMaterial: Mat,
             MeshBasicMaterial: Mat, DoubleSide: 2, FrontSide: 0 };
  }
  const win = {};
  {
    const ctx = { window: win, THREE: stubTHREE(), console, Math, JSON,
                  Float32Array, Object, Array, Set, Map, Number, String,
                  isFinite, parseInt, parseFloat };
    ctx.globalThis = ctx;
    vm2.createContext(ctx);
    for (const f of ['_gear_kit.js', '_gear_gen.js'])
      vm2.runInContext(fs2.readFileSync(path.join(__dirname, f), 'utf8'), ctx,
                       { filename: f });
  }
  const K = win.GEAR_KIT, GG = win.GEAR_GEN;
  if (!check(!!K && !!GG, 'ear: the kit did not load headlessly')) {
    // nothing below can run; the failure is already recorded
  } else {
    const F = SG.STRUT_FIT;
    // ONE EAR, in the fitting's own frame, at a real site on the stub body
    const earSpan = (up, stand) => {
      const site = SG.strutSite(AF, [0.38, AF.keelAt(0.6) + 0.06, 0.6], 0, 0,
                                { pad: PAD });
      const reach = F.padL * 0.5 + F.lugGap + 0.10;
      const S = SG.strutSkin(AF, site.z - reach, site.z + reach) || AF;
      const Fr = GG.fitFrame(S, site.z, site.ang);
      const zz = site.z + F.lugGap;
      const p = S.surf(zz, site.ang), n = S.nrmAt(zz, site.ang);
      const bag = K.Bag();
      K.lug(bag, K.off(p, n, stand), Fr.fore,
            up === 'RULE' ? SG.strutClevisUp(K, n, Fr.fore) : n,
            F.lugR, F.lugT, stand * 0.92);
      const m = bag.mesh({ add() {} }, {});
      const a = m.geometry.attributes.position.array;
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < a.length; i += 3) {
        const h = (a[i] - p[0]) * n[0] + (a[i+1] - p[1]) * n[1] + (a[i+2] - p[2]) * n[2];
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      return { lo, hi };
    };
    for (const [end, stand, plate] of [['fuselage', F.standoff, F.padT],
                                       ['wing', F.wingStandoff, F.wingPadT]]) {
      const e = earSpan('RULE', stand);
      check(e.lo <= plate,
            'ear: the ' + end + ' clevis does not reach its plate',
            (e.lo * 1000).toFixed(1) + ' mm off the skin, plate top ' +
            (plate * 1000).toFixed(1) + ' mm');
      check(e.hi >= stand - 1e-6,
            'ear: the ' + end + ' clevis does not reach its pin',
            (e.hi * 1000).toFixed(1) + ' vs ' + (stand * 1000).toFixed(1) + ' mm');
      if (VERBOSE) console.log('  ' + end + ' ear: ' + (e.lo * 1000).toFixed(1) +
        ' .. ' + (e.hi * 1000).toFixed(1) + ' mm off the skin (plate ' +
        (plate * 1000).toFixed(1) + ', pin ' + (stand * 1000).toFixed(1) + ')');
    }
    // THE NEGATIVE PROBE IS THE BUG ITSELF: hand `lug` the surface normal, the
    // way this file did until G108, and the ear must fail to reach the plate.
    const bad = earSpan('n', F.standoff);
    check(bad.lo > F.padT,
          'ear: the OLD wrong vector still reaches the plate — this check is inert',
          (bad.lo * 1000).toFixed(1) + ' mm');
    if (VERBOSE) console.log('  probe (up = n, the G108 bug): ' +
      (bad.lo * 1000).toFixed(1) + ' .. ' + (bad.hi * 1000).toFixed(1) + ' mm');
  }
}

// ---------------------------------------------------------------------------
// 6: NEGATIVE PROBES. Every rule above has to be breakable, or it is inert.
// ---------------------------------------------------------------------------
{
  let inert = 0;
  // the table's rules, each against a table that violates exactly it
  const BREAK = {
    padL: 0.06, padW: 0.02, pinShank: 0.004, standoff: 0.004,
    bladeC: 0.40, bladeT: 0.40, endFrac: 0.90, screwR: 0.40,
    padT: 0.30, strutR: 0.10,
    wingPadL: 0.01, wingPadW: 0.01, wingPadT: 0.30, wingStandoff: 0.004,
  };
  for (const [label, rule] of RULES) {
    let broke = false;
    for (const k in BREAK) {
      const F = Object.assign({}, SG.STRUT_FIT); F[k] = BREAK[k];
      if (!rule(F)) { broke = true; break; }
    }
    if (!broke) { inert++; check(false, 'probe: rule cannot be broken', label); }
  }
  // the SCAN. A four-angle search on this body must actually be wrong, or
  // check 1 is passing for free and the chine is decoration.
  let coarseWorst = 0;
  for (const s of SEEDS) {
    const got = SG.strutSnap(AF, s, { pad: PAD, na: 4, win: 0.02 });
    coarseWorst = Math.max(coarseWorst, got.d - brute(s).d);
  }
  check(coarseWorst > 1e-3, 'probe: a 4-angle scan finds the nearest point too',
        'the body has no shape for check 1 to be about');
  // THE ARC. Dividing dLat by the radius at the STARTING angle is the obvious
  // implementation and it is wrong on any section that is not a circle; it
  // has to fail check 2's bracket, or that bracket is decoration.
  {
    let bad = 0;
    for (const s2 of SEEDS.slice(0, 12)) {
      const site = SG.strutSite(AF, s2, 0, 0, { pad: PAD });
      const p0 = AF.surf(site.z, site.ang);
      const r0 = Math.max(0.05, Math.hypot(p0[0], p0[1] - AF.cyAt(site.z)));
      for (const dl of [0.06, 0.12]) {
        const a2 = site.ang + site.side * dl / r0;      // the divided angle
        const gap = d3(AF.surf(site.z, a2), p0);
        if (!(gap <= dl + 1e-9 && gap >= dl * 0.95)) bad++;
      }
    }
    check(bad > 0, 'probe: a divided angle passes the arc-length bracket too');
  }
  // and a snap that returns the seed unprojected must fail check 1's own test
  const sham = SEEDS[0];
  check(d3(sham, AF.surf(SG.strutSnap(AF, sham, { pad: PAD }).z,
                         SG.strutSnap(AF, sham, { pad: PAD }).ang)) > 1e-6,
        'probe: the seeds are already on the skin, so the snap proves nothing');
  if (VERBOSE)
    console.log('  probes: ' + (RULES.length - inert) + '/' + RULES.length +
                ' table rules breakable, coarse scan off by ' +
                (coarseWorst * 1000).toFixed(1) + ' mm');
}

// ---------------------------------------------------------------------------
// 7: THE BAND. The fore/aft trim is bounded by the wing's structural chord —
// "excluding the leading edge and the control surface sections" — and the one
// thing it must never do is exclude the frame's OWN answer, which is 0.
// ---------------------------------------------------------------------------
{
  const B = SG.STRUT_BAND;
  for (const c of [1.15, 1.60, 2.10])
    for (const ail of [0.10, 0.22, 0.35]) {
      const b = SG.strutBand(c, 0.15, 0.65, ail);
      check(b.lo <= 0 && b.hi >= 0, 'band: excludes the frame\'s own strut',
            `chord ${c}, aileron ${ail} -> ${b.lo.toFixed(3)}..${b.hi.toFixed(3)}`);
      // THE TRIM NEVER MAKES IT WORSE. At the reachable extremes the front
      // fitting is no nearer the leading edge than the limit OR than where
      // the frame already put it, and the rear no nearer the hinge — the
      // second half of that "or" is what a 35 % aileron needs, because there
      // the frame's own rear fitting is already inside the control surface.
      check(0.15 + b.lo / c >= Math.min(B.le, 0.15) - 1e-9,
            'band: the trim carries the front fitting into the leading edge');
      check(0.65 + b.hi / c <= Math.max((1 - ail) - B.hinge, 0.65) + 1e-9,
            'band: the trim carries the rear fitting into the control surface');
    }
  // A WIDE AILERON COSTS THE AFT HALF OF THE BAND, and does not close it:
  // the pair may still move forward, where there is room.
  const w = SG.strutBand(1.60, 0.15, 0.65, 0.35);
  check(w.hi === 0 && w.lo < -0.05,
        'band: a 35 % aileron did not spend the aft half',
        `${w.lo.toFixed(3)} .. ${w.hi.toFixed(3)}`);
  // it SCALES with chord: the same wing twice the size gets twice the travel
  const a = SG.strutBand(1.00, 0.15, 0.65, 0.22);
  const d = SG.strutBand(2.00, 0.15, 0.65, 0.22);
  check(Math.abs(d.hi - 2 * a.hi) < 1e-12 && Math.abs(d.lo - 2 * a.lo) < 1e-12,
        'band: does not scale with chord');
  // AND IT CAN BE EMPTY. A wing whose rear spar is already under its own
  // aileron has nowhere to put a fitting, and the honest answer is "nowhere",
  // not an inverted interval that a clamp would read backwards.
  const e = SG.strutBand(1.60, 0.15, 0.65, 0.45);
  check(e.lo === 0 && e.hi === 0, 'band: an impossible wing got a live band',
        `${e.lo} .. ${e.hi}`);
}

// ---------------------------------------------------------------------------
// 8: THE EXACT SKIN. `strutSkin` answers the airframe contract off the MESH
// instead of off the interpolated table, and the whole claim is that its
// points are ON the drawn surface. The body here is a faceted prism, so "on
// the surface" is decidable exactly: every point must lie on one of the flat
// side faces, which a table that interpolates between the corners cannot do.
// ---------------------------------------------------------------------------
{
  const N = 12, R = 0.60, ZA = -1.0, ZB = 2.0;
  const V = [], F2 = [];
  for (const z of [ZA, ZB])
    for (let k = 0; k < N; k++) {
      const a = 2 * Math.PI * k / N;
      V.push([Math.sin(a) * R, -Math.cos(a) * R, z]);
    }
  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N;
    F2.push([k, k2, N + k2, N + k]);
  }
  const stub = {
    z0: ZA, z1: ZB, mesh: { V, F: F2 },
    cyAt: () => 0,
    // the TABLE: the circumscribed circle, which is what a radius sampled at
    // the corners and interpolated between them tends towards
    surf: (z, a) => [Math.sin(a) * R, -Math.cos(a) * R, z],
    nrmAt: () => [0, -1, 0],
    halfWAt: () => R,
  };
  const S = SG.strutSkin(stub, 0.2, 0.8);
  check(!!S && S.exact, 'skin: no exact surface over a mesh band');
  if (S) {
    // the prism's flat faces: inradius R cos(pi/N), so a point at angle a is
    // at radius R cos(pi/N) / cos(a mod (2pi/N) - pi/N)
    const inr = R * Math.cos(Math.PI / N), step = 2 * Math.PI / N;
    let worst = 0, tableWorst = 0;
    for (let i = 0; i <= 40; i++) {
      const a = -Math.PI + 0.001 + (2 * Math.PI - 0.002) * i / 40;
      const z = 0.3 + 0.4 * (i / 40);
      const p = S.surf(z, a);
      const r = Math.hypot(p[0], p[1]);
      let m = ((a % step) + step) % step;
      const want = inr / Math.cos(m - step / 2);
      worst = Math.max(worst, Math.abs(r - want));
      tableWorst = Math.max(tableWorst, Math.abs(R - want));
      check(Math.abs(p[2] - z) < 1e-12, 'skin: the station moved');
    }
    check(worst < 1e-9, 'skin: the point is not on the mesh',
          (worst * 1000).toFixed(4) + ' mm');
    // ...AND THE TABLE IS NOT. If the two agreed there would be nothing to
    // fix, and this whole solver would be dead weight.
    check(tableWorst > 1e-3, 'probe: the table already lands on the mesh',
          'the prism is too round for check 8 to be about anything');
    // OUTSIDE the band it degrades to the table rather than to zero radius
    const far = S.surf(ZB + 0.5, 0.4);
    check(Math.abs(Math.hypot(far[0], far[1]) - R) < 1e-9,
          'skin: off the band it does not fall back to the table');
    // an airframe with no mesh gets nothing, and callers use the table
    check(SG.strutSkin({ z0: 0, z1: 1, cyAt: () => 0 }, 0, 1) === null,
          'skin: a bodyless airframe returned a surface');
  }
}

// ---------------------------------------------------------------------------
console.log(`  ${SEEDS.length} seeds x ${RULES.length} fitting rules · ` +
            `body ${(AF.z1 - AF.z0).toFixed(2)} m with a chine`);
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE STRUT: FAIL');
  process.exit(1);
}
console.log('GATE STRUT: PASS');
