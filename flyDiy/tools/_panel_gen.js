// THE INSTRUMENT PANEL, PURE — the panel arc, session 3 (2026-09-11).
//
// No THREE, no DOM at module scope, node-loadable: what an instrument IS
// (its face, its scale, its hands and the law each hand turns by), where
// the dials go on a dash (the standard T), and how a face is painted. The
// layer (_cage_panel.js) draws what this says; the flight (session 4) turns
// the hands by the laws this publishes; GATE PANEL reads all of it headless.
//
// THE ONE RULE THAT HOLDS THE PICTURE TO THE NUMBER: `angleOf(key, hand, v)`
// is the ONLY function that turns a reading into a needle angle, and the
// painter's tick marks call it too — so the printed scale and the moving
// needle cannot disagree. Angles are CLOCK angles: degrees clockwise from 12
// o'clock as the pilot sees the face.
//
// UNITS ARE PER BUILD (the user's ruling): `units` is 'aviation' (kt / ft /
// fpm / psi) or 'metric' (km/h / m / m/s / bar). Every law takes SI in and
// converts through the scale it was painted with.
//
// THE MIRROR RULE. Cage +x is PORT — the pilot's LEFT. A canvas painted with
// 3 o'clock at +u must land on the pilot's RIGHT, which is cage −x, so a face
// quad's u runs AGAINST x: u = 0.5 − (x − cx)/d. Miss this and every dial
// reads mirrored while the needles (which are 3D) read correctly. `faceUV`
// below is the one place that arithmetic lives.
(() => {
'use strict';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------
// THE SCALES — what each face is painted with, per unit system. `min`/`max`
// in DISPLAY units, `k` = display per SI, `a0` the clock angle of `min`,
// `sweep` the clock degrees from min to max (clockwise positive).
// ---------------------------------------------------------------------------
const UNITS = {
  aviation: { speed: { k: 1.943844, u: 'KNOTS' }, alt: { k: 3.28084, u: 'FEET' },
              // psi per PASCAL (A3: it was psi per kPa, against metric's bar
              // per pascal and the cockpit's pascals - the psi gauge pegged)
              vs: { k: 196.8504 / 100, u: '×100 FT/MIN' }, press: { k: 1 / 6894.757, u: 'PSI' },
              temp: { k: 1, u: '°C' } },
  metric:   { speed: { k: 3.6, u: 'KM/H' }, alt: { k: 1, u: 'METRES' },
              vs: { k: 1, u: 'M/S' }, press: { k: 1e-5, u: 'BAR' },
              temp: { k: 1, u: '°C' } },
};
// a round number at or above x, in steps
const roundUp = (x, step) => Math.ceil(x / step - 1e-9) * step;
// the largest 1 / 2 / 2.5 / 5 decade step at or under x (a tick step that
// reads: 5, 10, 25 gallons - never 5.8)
function niceStep(x) {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [5, 2.5, 2, 1]) if (m * p <= x * (1 + 1e-9)) return m * p;
  return p;
}

// what the scale of each instrument is, given the aeroplane (o: Vs0, Vs1,
// Vh, Vne, Vfe in m/s EAS; rpm the rated engine speed; tanks litres) and
// the unit system. Returns { min, max, k, a0, sweep, unit, major, minor,
// arcs[] } — `major`/`minor` are tick steps in display units.
function scaleOf(key, units, o) {
  const U = UNITS[units] || UNITS.aviation;
  o = o || {};
  switch (key) {
    case 'asi': {
      const vne = o.Vne || 1.25 * (o.Vh || 45);
      const max = roundUp(1.12 * vne * U.speed.k, units === 'metric' ? 20 : 20);
      const min = 0;
      const arcs = [];
      const sp = v => v * U.speed.k;
      if (o.Vs0 && o.Vfe) arcs.push({ from: sp(o.Vs0), to: sp(o.Vfe), col: '#f2f2f0', w: 0.10 });
      if (o.Vs1 && o.Vh) arcs.push({ from: sp(o.Vs1), to: sp(o.Vh), col: '#3dbb5e', w: 0.14 });
      if (o.Vh && vne) arcs.push({ from: sp(o.Vh), to: sp(vne), col: '#f0c23a', w: 0.14 });
      if (vne) arcs.push({ from: sp(vne) - 0.6 * max / 100, to: sp(vne) + 0.6 * max / 100, col: '#e8332a', w: 0.20 });
      return { min, max, k: U.speed.k, a0: 0, sweep: 330, unit: U.speed.u,
               major: units === 'metric' ? 20 : 20, minor: units === 'metric' ? 10 : 5, arcs,
               // the low end is dead on a real ASI: the first mark sits at
               // 1/6 of the sweep so the scale reads from 20 kt like the thing
               // it copies (linear above the first mark)
               dead: units === 'metric' ? 40 : 20 };
    }
    case 'alt':
      // one turn per 1000 (ft or m) for the long hand: painted 0-9
      // (the scale is in the display unit — feet or metres — so its ticks
      // land where the long hand's `per` puts them; session 4c: at 0..10 the
      // ten marks all sat at 12 o'clock, one thousandth of a turn apart)
      return { min: 0, max: 1000, k: U.alt.k, a0: 0, sweep: 360, unit: U.alt.u,
               major: 100, minor: 20, arcs: [], per: 1000 };
    case 'vsi': {
      const full = units === 'metric' ? 10 : 20;   // ±10 m/s or ±2000 fpm
      return { min: -full, max: full, k: U.vs.k, a0: 270 - 170, sweep: 340, unit: U.vs.u,
               major: units === 'metric' ? 2 : 5, minor: units === 'metric' ? 1 : 1, arcs: [] };
    }
    case 'tacho': {
      const rated = o.rpm || 2300;
      const max = roundUp(1.25 * rated, 500);
      return { min: 0, max, k: 1, a0: 225, sweep: 270, unit: 'RPM ×100', major: 500, minor: 100,
               arcs: [{ from: 0.6 * rated, to: rated, col: '#3dbb5e', w: 0.12 },
                      { from: rated - max / 100, to: rated + max / 100, col: '#e8332a', w: 0.20 }] };
    }
    case 'gmeter':
      return { min: -3, max: 6, k: 1, a0: -144, sweep: 324, unit: 'G', major: 1, minor: 0.5, arcs: [] };
    case 'oilP': {
      const max = units === 'metric' ? 7 : 100;
      return { min: 0, max, k: U.press.k, a0: 225, sweep: 270, unit: U.press.u,
               major: units === 'metric' ? 1 : 20, minor: units === 'metric' ? 0.5 : 10,
               arcs: [{ from: 0.25 * max, to: 0.85 * max, col: '#3dbb5e', w: 0.12 },
                      { from: 0, to: 0.2 * max, col: '#e8332a', w: 0.12 }] };
    }
    case 'oilT':
      // G442.3 (the playtest: "the graduations follow the units convention"):
      // a US instrument reads in FAHRENHEIT - an AFFINE law (display = SI x k
      // + off), the one scale that needs an offset; 100-250 F, the green arc
      // 140-230, the red from 245 (the same water the metric face shows)
      if (units !== 'metric')
        return { min: 100, max: 250, k: 1.8, off: 32, a0: 225, sweep: 270, unit: '°F', major: 50, minor: 10,
                 arcs: [{ from: 140, to: 230, col: '#3dbb5e', w: 0.12 }, { from: 244, to: 250, col: '#e8332a', w: 0.12 }] };
      return { min: 40, max: 130, k: 1, a0: 225, sweep: 270, unit: U.temp.u, major: 30, minor: 10,
               arcs: [{ from: 60, to: 110, col: '#3dbb5e', w: 0.12 }, { from: 118, to: 130, col: '#e8332a', w: 0.12 }] };
    case 'fuel': {
      // THE FUEL / CHARGE GAUGE (A3, the 2026-09-20 playtest: "a fuel / charge
      // gauge that follows the build's energy kind, litres or kWh, the units
      // convention"). The face is painted in the QUANTITY the build carries -
      // litres (metric) or US gallons (aviation) of a tank, kWh of a pack -
      // E at empty, F at the design capacity, the reserve's red arc under
      // 10 %. The hand's DRIVE is the fraction of that capacity (0..1): the
      // stops the join bakes hold whatever the tank, and `k` is the capacity
      // in display units, so `v * k` is what the numerals say. `o.energy` =
      // { kind: 'fuel' | 'battery', capacity } (litres or kWh) - without it
      // (a bench with no build) the face is the old E / half / F fraction.
      const E = o.energy || null, battery = !!(E && E.kind === 'battery');
      const cap = E && E.capacity > 0 ? E.capacity : 0;
      const red = [{ from: 0, to: 0.1, col: '#e8332a', w: 0.14 }];
      if (!cap) return { min: 0, max: 1, k: 1, a0: 300, sweep: 120, unit: '', major: 0.5, minor: 0.25,
                         arcs: red, labels: { 0: 'E', 0.5: '½', 1: 'F' }, title: battery ? 'CHARGE' : 'FUEL', kind: battery ? 'battery' : 'fuel' };
      const kq = battery ? 1 : (units === 'metric' ? 1 : 0.264172);   // display per litre / kWh
      const max = cap * kq, major = niceStep(max / 2);
      return { min: 0, max, k: max, a0: 300, sweep: 120, major, minor: major / 4,
               unit: battery ? 'kWh' : (units === 'metric' ? 'LITRES' : 'US GAL'),
               arcs: [{ from: 0, to: 0.1 * max, col: '#e8332a', w: 0.14 }],
               ends: { lo: 'E', hi: 'F' }, title: battery ? 'CHARGE' : 'FUEL', kind: battery ? 'battery' : 'fuel' };
    }
    case 'volts':
      return { min: 8, max: 16, k: 1, a0: 225, sweep: 270, unit: 'VOLTS', major: 2, minor: 1,
               arcs: [{ from: 12.5, to: 14.5, col: '#3dbb5e', w: 0.12 }, { from: 8, to: 11, col: '#e8332a', w: 0.12 }] };
    case 'turn':
      // the aeroplane symbol tilts: rate one (3 deg/s) = the mark at ±20 deg
      return { min: -6, max: 6, k: 180 / Math.PI, a0: -40, sweep: 80, unit: '2 MIN', major: 3, minor: 3, arcs: [] };
    case 'slip':
      // G2808 (E7): the inclinometer's ball in its tube, on the turn coordinator - sideslip (rad) along the tube's
      // +-20 deg; drawn with sgn -1, so a slip to the right sends the ball right (the side the air comes from)
      return { min: -0.25, max: 0.25, k: 1, a0: -20, sweep: 40, unit: '', major: 0.25, minor: 0.25, arcs: [] };
    case 'amps':
      // G2808 (W5): THE AMMETER HALF of the volt / ammeter - a second, shorter needle over the bottom gap the volts
      // scale leaves (5:05 to 6:55). It reads the current OUT of the battery (discharge +), so a charging battery
      // swings it to the pilot's right, under the '+'; the printed marks are the law's own (ticks / angleOf)
      return { min: -30, max: 30, k: 1, a0: 152, sweep: 56, unit: 'AMPS', major: 30, minor: 10, arcs: [],
               labels: { '-30': '+', 0: '0', 30: '\u2212' } };
    case 'clock':
      return { min: 0, max: 12, k: 1, a0: 0, sweep: 360, unit: '', major: 1, minor: 1 / 5, arcs: [] };
    default:
      return { min: 0, max: 1, k: 1, a0: 0, sweep: 300, unit: '', major: 0.25, minor: 0.05, arcs: [] };
  }
}

// ---------------------------------------------------------------------------
// THE CATALOGUE OF FACES — what each instrument shows and what turns on it.
// A hand: { name, drive (the READINGS key, SI), law: 'lin' (value → angle
// through the scale) | 'turn' (a periodic hand: 360° per `per` SI units) |
// 'hold' (a fixed pose); `per` for a turning hand is in the scale's DISPLAY
// units (1000 ft or 1000 m per turn of the altimeter's long hand); L (length as a fraction of the dial radius), w
// (width), tail (counterweight length), kind: 'needle' | 'drum' | 'card' |
// 'symbol' }. Two-axis parts (the attitude ball) carry `drive2`.
// ---------------------------------------------------------------------------
const FACES = {
  asi:    { painter: 'asi', hands: [{ name: 'needle', drive: 'ias', law: 'lin', L: 0.82, w: 0.055, tail: 0.08 }] },
  alt:    { painter: 'alt', hands: [
              { name: 'h100', drive: 'alt', law: 'turn', per: 1000, L: 0.86, w: 0.05, tail: 0.08 },
              { name: 'h1k',  drive: 'alt', law: 'turn', per: 10000, L: 0.58, w: 0.09, tail: 0.08 },
              { name: 'h10k', drive: 'alt', law: 'turn', per: 100000, L: 0.90, w: 0.025, tail: 0.0 }] },
  vsi:    { painter: 'vsi', hands: [{ name: 'needle', drive: 'vs', law: 'lin', L: 0.82, w: 0.055, tail: 0.08 }] },
  ai:     { painter: 'ai', hands: [{ name: 'ball', kind: 'drum', drive: 'roll', drive2: 'pitch', law: 'ball' }] },
  aiE:    { painter: 'ai', hands: [{ name: 'ball', kind: 'drum', drive: 'roll', drive2: 'pitch', law: 'ball' }] },
  turn:   { painter: 'turn', hands: [{ name: 'plane', kind: 'symbol', drive: 'r', law: 'lin', L: 0.7, w: 0.06 }] },
  dg:     { painter: 'dg', hands: [{ name: 'card', kind: 'card', drive: 'hdg', law: 'card' }] },
  compass:{ painter: 'compass', hands: [{ name: 'card', kind: 'drumV', drive: 'hdg', law: 'card' }] },
  tacho:  { painter: 'tacho', hands: [{ name: 'needle', drive: 'rpmEng', law: 'lin', L: 0.82, w: 0.055, tail: 0.08 }] },
  gmeter: { painter: 'gmeter', hands: [{ name: 'needle', drive: 'nz', law: 'lin', L: 0.82, w: 0.055, tail: 0.08 },
                                       { name: 'max', drive: 'nzMax', law: 'lin', L: 0.82, w: 0.03, tail: 0.0 },
                                       { name: 'min', drive: 'nzMin', law: 'lin', L: 0.82, w: 0.03, tail: 0.0 }] },
  oilP:   { painter: 'oilP', hands: [{ name: 'needle', drive: 'oilP', law: 'lin', L: 0.8, w: 0.07, tail: 0.08 }] },
  oilT:   { painter: 'oilT', hands: [{ name: 'needle', drive: 'oilT', law: 'lin', L: 0.8, w: 0.07, tail: 0.08 }] },
  fuel:   { painter: 'fuel', hands: [{ name: 'needle', drive: 'fuelFrac', law: 'lin', L: 0.8, w: 0.07, tail: 0.08 }] },
  volts:  { painter: 'volts', hands: [{ name: 'needle', drive: 'volts', law: 'lin', L: 0.8, w: 0.07, tail: 0.08 }] },
  // G2808: two hands that ride another face, each on its own scale - the ammeter's needle on the volts dial (W5),
  // the slip ball in the turn coordinator's tube (E7). No painter: the host face paints their marks.
  amps:   { painter: null, host: 'volts', hands: [{ name: 'needle', drive: 'ampsOut', law: 'lin', L: 0.55, w: 0.05, tail: 0.08 }] },
  slip:   { painter: null, host: 'turn', hands: [{ name: 'ball', kind: 'ball', drive: 'beta', law: 'lin' }] },
  clock:  { painter: 'clock', hands: [
              { name: 'hour', drive: 'clockH', law: 'turn', per: 12, L: 0.55, w: 0.08, tail: 0.08 },
              { name: 'minute', drive: 'clockM', law: 'turn', per: 60, L: 0.85, w: 0.06, tail: 0.08 },
              { name: 'second', drive: 'clockS', law: 'turn', per: 60, L: 0.88, w: 0.02, tail: 0.08 }] },
  // the radios: a face with a window, no hands yet (session 5 paints the
  // digits live)
  com:    { painter: 'com', hands: [] },
  xpdr:   { painter: 'xpdr', hands: [] },
  // G2808: the NAV receiver's head (it was billed and powered with nothing on the panel) and the hour meter
  nav:    { painter: 'nav', hands: [] },
  hobbs:  { painter: 'hobbs', hands: [] },
};
// the instrument light's rest pose for each drive when nothing feeds it
const REST = { ias: 0, alt: 0, vs: 0, roll: 0, pitch: 0, r: 0, hdg: 0, rpmEng: 0, nz: 1, nzMax: 1,
               nzMin: 1, oilP: 0, oilT: 40, fuelFrac: 0, volts: 0, clockH: 10, clockM: 10, clockS: 0,
               beta: 0, ampsOut: 0 };

// THE LAW: a reading (SI) to a clock angle (deg) for one hand of one face.
function angleOf(key, hand, v, units, o) {
  const H = typeof hand === 'string' ? (FACES[key].hands.find(h => h.name === hand) || FACES[key].hands[0]) : hand;
  const S = scaleOf(key, units, o);
  if (!H) return 0;
  if (H.law === 'turn') {                     // `per` is in the scale's DISPLAY units
    const per = H.per || 1;
    return (((v * S.k) / per) % 1 + 1) % 1 * 360;
  }
  if (H.law === 'lin') {
    let d = v * S.k + (S.off || 0);                // display = SI x k (+ the one affine offset, Fahrenheit)
    if (S.dead != null) {                       // the ASI's dead low end
      const lo = S.dead, span = S.max - S.min;
      const f0 = (lo - S.min) / span;           // the first mark's fraction
      // below the first mark the needle sits at a sixth of the way in and
      // creeps; above it the scale is linear to the max
      if (d <= lo) return S.a0 + S.sweep * (1 / 6) * Math.max(0, d / lo);
      return S.a0 + S.sweep * ((1 / 6) + (5 / 6) * clamp((d - lo) / (S.max - lo), 0, 1.02));
    }
    return S.a0 + S.sweep * clamp((d - S.min) / (S.max - S.min), -0.02, 1.02);
  }
  return 0;
}
// where a DISPLAY value sits on the face (the painter's ticks) — the same
// arithmetic as angleOf, reached through it so they cannot drift
function angleOfDisp(key, d, units, o) {
  const S = scaleOf(key, units, o);
  return angleOf(key, FACES[key].hands[0] || { law: 'lin' }, dispToSI(S, d), units, o);
}
// a DISPLAY value back to the SI the hand is driven with (the join's stops,
// the gate): the inverse of the lin law's first line
function dispToSI(S, d) { return (d - (S.off || 0)) / S.k; }

// ---------------------------------------------------------------------------
// THE LAYOUT — the standard T on the dash face.
// ---------------------------------------------------------------------------
//   [clock]  ASI   AI    ALT   |  TACHO  GMETER  |  COM
//            TURN  DG    VSI   |  oilP oilT      |  XPDR
//                              |  fuel volts     |
//   key  master  alt  | taxi beacon land nav | flood instr panel pedal pax
//
// A missing flight instrument leaves its hole (a blanking plate on a real
// panel): the T's positions are fixed so the pilot's scan does not move
// when a gyro is not bought. `A` is the crew's anchor record (dashTop,
// dashLip, dashAftZ, halfW, floorAt, zDash), `pilotX` the seat's x, `items`
// the resolved fit's keys, `switches` the light rows to draw, `radios` the
// avionics keys fitted. Returns dials[] {k, cx, cy, r, slot}, switches[]
// {k, kind, x, y}, ext, zFace, yMid, xLim, overflow[].
const D_BIG = 0.0794, D_SMALL = 0.0572, GAP = 0.012, PAN_INSET = 0.012;
// the switch row's 16 mm plates, a gap, and (G282) the tape label stuck at
// 45 deg over each switch — 12 mm more than before, so the dials' bottoms
// clear the labels' upper corners
const SW_ROOM = 0.038;
const SW_DROP = 0.028;             // the row's centre this far under the lowest dial
const T_KEYS = { asi: [0, 0], ai: [1, 0], alt: [2, 0], turn: [0, 1], dg: [1, 1], vsi: [2, 1] };
// THE FLEXIBLE LAYOUT (G3341, DASH-REDESIGN, the garage review's item 12:
// "one row when the plate is wide enough; switches beside the dials when
// they fit; room reserved below a dial only where its switches really go").
// The rule above reserves SW_ROOM under EVERY dial and stacks the T two
// deep, and on a short plate that is what sends dials to the overflow. With
// `A.flexLayout` (the crew sets it on the arch dash: new builds) the
// standard layout still runs first and stands whenever it places
// everything; when it does not, the dials go on ONE row from the pilot's
// centre out, nothing reserved under them, and the switch row takes the
// LOWEST height at which a clear run holds it - under the dials where they
// leave the room, beside them where they do not. The layout with fewer
// dials left off wins; a tie keeps the standard one.
// THE GLASS PANEL (G2808, the user's ruling of 25 Oct: "GPS placement is in front of the pilot, glass cockpit
// style. The same device could later hold a real MFD / PFD ... just get rid of some manual gauges, or find a more
// flexible way to place them. If really too small, then it does not fit"). A build with a screen (o.screens: the
// GPS today, a PFD / MFD later through the same record) lays out SCREEN FIRST: the unit on the pilot's line as high
// as it fits under the crown, then every dial in the scan's priority at the clear place nearest the pilot's line and
// highest, then the switch row on the lowest clear run. Tried with the bottom band kept for the switches and
// without; the one that leaves fewer dials off wins. What finds no place is overflow: named in the column, not
// drawn - and not billed (genSystemsResolve's `noRoom`, which the join writes from this layout).
// What a layout costs (G2808): a screen outweighs every dial, a dial every switch drawn under a dial or a screen,
// that switch a T broken into single dials, and that every breaker with no room
// (G2815: each screen lost costs its 1000 - a pair's PFD placed beats both lost, whatever dials the second costs)
const layoutCost = L => 1000 * (+L.screenLost || 0) + 10 * L.overflow.length + 5 * (L.swClash || 0) +
  (L.tBroken ? 3 : 0) + (L.extraOverflow ? L.extraOverflow.length : 0);
// the packer's three ways with the switch row: the bottom band kept for it, the strip laid first, nothing kept
const PACK_MODES = [[false, true], [true, 'strip'], [true, true]];
function layout(A, o) {
  if (o && Array.isArray(o.screens) && o.screens.length) {
    let best = null;
    for (const [fr, mode] of PACK_MODES) {
      const L = placeExtras(A, o, layoutCore(A, o, fr, mode));
      if (!best || layoutCost(L) < layoutCost(best)) best = L;
      if (!layoutCost(best)) break;
    }
    // A PORTABLE NEED NOT COST A DIAL: one the plate holds only by sending a dial off the dash (or a switch under
    // one) stands in its cradle on the glareshield instead - on the pilot's line, in front of him all the same -
    // and the dials are laid out as they would be without it
    if (layoutCost(best) && o.screens.every(S => S.cradle)) {
      const oc = Object.assign({}, o, { cradleFirst: true });
      const C = placeExtras(A, oc, dialLayout(A, Object.assign({}, o, { screens: [] })));
      if (layoutCost(C) < layoutCost(best)) best = C;
    }
    return best;
  }
  return placeExtras(A, o, dialLayout(A, o));
}
// the dials and the switches, no screen: the standard rule, the flexible row, then the packer
function dialLayout(A, o) {
  const std = layoutCore(A, o, false);
  if (!std.overflow.length) return std;
  let best = std;
  if (A && A.flexLayout) { const flex = layoutCore(A, o, true); if (flex.overflow.length < best.overflow.length) best = flex; }
  // ...AND WHEN THE RULES ABOVE STILL LEAVE A DIAL OFF, THE PACKER (G2808: a dial off the dash is a dial not
  // billed, so it gets every chance): the glass panel's own, with no screen - the T as a block where it fits, each
  // other dial at the clear place nearest its group - taken only when it leaves fewer dials off and no switch
  // under a dial
  if (best.overflow.length) {
    let P = null;
    for (const [fr, mode] of PACK_MODES) {
      const L = layoutCore(A, o, fr, mode);
      if (L.swClash) continue;
      if (!P || layoutCost(L) < layoutCost(P)) P = L;
    }
    if (P && P.overflow.length < best.overflow.length) best = P;
  }
  return best;
}
// THE EXTRAS (G2802 / G2803, AVIONICS-GPS phase 2): the GPS screen and the breaker row. They are placed AFTER the
// dials and the switches, into the plate those left free, and move nothing the rule above placed - a panel without
// them lays out byte for byte as it did (GATE PANEL). Adds to the layout:
//   screens[]     {k, cx, cy, w, h, sw, sh[, coaming, z, top]} - a unit's face (w x h) and its screen (sw x sh), cage
//                 metres; `coaming` a portable in its cradle on the glareshield (centre cx, cy; z the cradle's
//                 station, top the glareshield's height under it)
//   breakers      {rows: [{y, pitch, row: [{k, x, y}]}], row (every button), pitch} - the breaker buttons, in rows
//                 along clear runs, +x (the pilot's left) first
//   extraOverflow the extras that found no room ('gps', 'breaker:<key>')
// o.screens [{k, w, h, sw, sh, cradle}] (the GPS's GEN_AVIONICS face; cradle: a portable may stand on the
// glareshield), o.breakers [keys] (genSystemsResolve's breakers).
const CB_PITCH = 0.016, CB_PITCH_MIN = 0.013, CB_HALF = 0.009, CB_UP = 0.022;   // a 9 mm collar, its tape above it
function placeExtras(A, o, L) {
  o = o || {};
  const screensWant = Array.isArray(o.screens) ? o.screens : [];
  const cbWant = Array.isArray(o.breakers) ? o.breakers : [];
  const placed = Array.isArray(L.screens) ? L.screens : [];        // the glass layout's own (G2808)
  L.screens = placed.slice(); L.breakers = { row: [], pitch: CB_PITCH }; L.extraOverflow = [];
  if (!screensWant.length && !cbWant.length) return L;
  const F = A && A.face ? A.face : null;
  const KO = Array.isArray(A && A.keepOut) ? A.keepOut : [];
  const yTop = L.yTop, yBot = L.yBot, xLim = L.xLim;
  // the boxes already taken: every dial on the plate (its circle, a gap round it), every switch with its tape
  const boxes = [];
  for (const d of L.dials) if (!d.coaming) boxes.push({ circle: true, cx: d.cx, cy: d.cy, r: d.r + 0.006 });
  for (const s of L.switches) {
    const hw = s.kind === 'key' ? 0.022 : s.kind === 'flap' ? 0.013 : 0.013;
    boxes.push({ x0: s.x - hw, x1: s.x + hw, y0: s.y - (s.kind === 'flap' ? 0.024 : 0.016),
                 y1: s.y + (s.kind === 'flap' ? 0.046 : 0.032) });
  }
  for (const k of KO) boxes.push({ x0: k.x0 - 0.004, x1: k.x1 + 0.004, y0: k.y0 - 0.004, y1: k.y1 + 0.004 });
  for (const q of placed) boxes.push({ x0: q.cx - q.w / 2 - 0.006, x1: q.cx + q.w / 2 + 0.006, y0: q.cy - q.h / 2 - 0.006, y1: q.cy + q.h / 2 + 0.006 });
  const hitsBox = (x0, x1, y0, y1) => boxes.some(b => {
    if (b.circle) {
      const nx = Math.max(x0, Math.min(b.cx, x1)), ny = Math.max(y0, Math.min(b.cy, y1));
      return Math.hypot(nx - b.cx, ny - b.cy) < b.r;
    }
    return x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1;
  });
  // a rectangle is ON the plate when the columns under it hold it, inset (the dials' own rule, PAN_INSET)
  const onPlate = (x0, x1, y0, y1) => {
    if (x0 < -xLim - 1e-6 || x1 > xLim + 1e-6 || y1 > yTop + 1e-6 || y0 < yBot - 1e-6) return false;
    if (!F) return true;
    const ns = Math.max(1, Math.ceil((x1 - x0) / 0.02));
    for (let i = 0; i <= ns; i++) {
      const x = x0 + (x1 - x0) * i / ns, c = F.at(x);
      if (!c || Math.abs(c.x - x) > 0.03) return false;
      if (y1 > c.y1 - PAN_INSET + 1e-6 || y0 < c.y0 + PAN_INSET - 1e-6) return false;
    }
    return true;
  };
  // THE SCREENS: the highest place nearest the panel's middle (a GPS sits in the centre stack), on a 5 mm grid
  for (const S of screensWant) {
    if (placed.some(q => q.k === S.k)) continue;
    const w = +S.w, h = +S.h;
    let best = null;
    if (!(o.cradleFirst && S.cradle))
    for (let cx = -xLim + w / 2; cx <= xLim - w / 2 + 1e-9; cx += 0.005)
      for (let cy = yTop - h / 2; cy - h / 2 >= yBot - 1e-9; cy -= 0.005) {
        const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
        if (!onPlate(x0, x1, y0, y1) || hitsBox(x0, x1, y0, y1)) continue;
        const score = Math.abs(cx) + 0.5 * (yTop - y1);
        if (!best || score < best.score - 1e-12) best = { cx, cy, score };
        break;                                        // the highest at this x is the best at this x
      }
    if (best) {
      const rec = { k: S.k, cx: best.cx, cy: best.cy, w, h, sw: +S.sw || w * 0.8, sh: +S.sh || h * 0.75 };
      L.screens.push(rec);
      boxes.push({ x0: rec.cx - w / 2 - 0.006, x1: rec.cx + w / 2 + 0.006, y0: rec.cy - h / 2 - 0.006, y1: rec.cy + h / 2 + 0.006 });
      continue;
    }
    // A PORTABLE WITH NO ROOM ON THE PLATE stands in a cradle on the glareshield (where a portable is really
    // carried when the panel is full), beside the compass on the pilot's right, leaning back to the eye. A unit
    // built into the panel (`S.cradle` false) has no such place: it is named, not drawn.
    if (S.cradle && A && (A.dashAftZ != null || L.zFace != null)) {
      // on the pilot's line (G2808), clear of the compass in the middle of the coaming
      const xP = L.side === 'centre' ? 0 : (o.pilotX || 0), clr = 0.035 + 0.014 + w / 2;
      const cxC = Math.abs(xP) >= clr ? xP : (xP > 0 ? clr : -clr);
      const zc = (A.dashAftZ != null ? A.dashAftZ : L.zFace) + 0.015;
      const top = A.dashTopAt ? A.dashTopAt(cxC, w / 2, zc - 0.02, zc + 0.02) : (A.dashTop != null ? A.dashTop : yTop + PAN_INSET);
      if (Math.abs(cxC) + w / 2 <= (A.halfW || xLim + 0.05) && isFinite(top)) {
        L.screens.push({ k: S.k, cx: cxC, cy: top + 0.012 + h / 2, w, h, sw: +S.sw || w * 0.8, sh: +S.sh || h * 0.75,
                         coaming: true, z: zc, top });
        continue;
      }
    }
    L.extraOverflow.push(S.k);
  }
  // THE BREAKERS: ONE row on the lowest clear run that holds them all (the pitch shrinks to 13 mm first); when no
  // run does, rows along the lowest runs that hold three or more (then two), at most five rows. What no run holds is
  // named, never drawn over a dial.
  if (cbWant.length) {
    const rows = [];
    // (a load the dash had no room for - a dial or a radio head in the overflow, a screen named - is not fitted, so
    // neither is its breaker, G2808)
    let left = cbWant.filter(k => !L.overflow.includes(k) && !L.extraOverflow.includes(k));
    const runAt = (y, pitch, minN) => {
      let run0 = null;
      for (let x = -xLim; x <= xLim + 1e-9; x += 0.002) {
        const ok = onPlate(x - 0.001, x + 0.001, y - CB_HALF, y + CB_UP) && !hitsBox(x - 0.001, x + 0.001, y - CB_HALF, y + CB_UP);
        if (ok && run0 === null) run0 = x;
        if ((!ok || x + 0.002 > xLim + 1e-9) && run0 !== null) {
          const run1 = ok ? x : x - 0.002;
          const fit = Math.floor((run1 - run0 - 2 * CB_HALF) / pitch + 1e-9) + 1;
          if (fit >= minN) return { lo: run0, hi: run1, fit };
          run0 = null;
        }
      }
      return null;
    };
    while (left.length && rows.length < 5) {
      // the lowest run that holds EVERY breaker left, at either pitch; failing that, the lowest that holds three,
      // then two (G2808: a crowded plate's breakers in short rows, rather than off the dash and off the bill)
      let got = null;
      for (const minN of left.length > 3 ? [left.length, 3, 2] : left.length > 2 ? [left.length, 2] : [left.length]) {
        for (const pitch of [CB_PITCH, CB_PITCH_MIN]) {
          for (let y = yBot + CB_HALF + 0.002; y + CB_UP <= yTop + 1e-9 && !got; y += 0.004) {
            const r = runAt(y, pitch, minN);
            if (r) got = Object.assign(r, { y, pitch });
          }
          if (got) break;
        }
        if (got) break;
      }
      if (!got) break;
      const take = left.slice(0, Math.min(left.length, got.fit));
      left = left.slice(take.length);
      // +x first (the tape's canvas reads left to right for the pilot), from the run's +x end
      const row = [];
      let x = got.hi - CB_HALF;
      for (const k of take) { row.push({ k, x, y: got.y }); x -= got.pitch; }
      rows.push({ y: got.y, pitch: got.pitch, row });
      boxes.push({ x0: row[row.length - 1].x - CB_HALF - 0.004, x1: row[0].x + CB_HALF + 0.004,
                   y0: got.y - CB_HALF - 0.004, y1: got.y + CB_UP + 0.002 });
    }
    for (const k of left) L.extraOverflow.push('breaker:' + k);
    L.breakers = { rows, row: [].concat(...rows.map(r => r.row)), pitch: rows.length ? rows[0].pitch : CB_PITCH };
  }
  return L;
}
function layoutCore(A, o, flexRow, glass) {
  o = o || {};
  const items = o.items || [], side = o.side || 'pilot', pilotX = o.pilotX || 0;
  // THE PLATE (session 4b): when the crew measured the dash's face plate
  // (A.face - its outline as columns, its plane), every dial is placed ON
  // it: inside its outline with the bezel inset all round, on its plane.
  // Without it (an older crew record, the bench's flat dash) the band the
  // crew always published stands in.
  const F = A.face || null;
  const zFace = F ? F.zTop : (A.dashAftZ != null ? A.dashAftZ : A.zDash) - 0.004;
  const hasDash = A.dashLip != null && A.dashTop != null;
  const yTop = F ? F.yTop - PAN_INSET : hasDash ? A.dashTop - PAN_INSET : A.floorAt(A.zDash) + 0.42 + 0.135;
  const yBot = F ? F.yBot + PAN_INSET : hasDash ? Math.min(A.dashLip + PAN_INSET, yTop - 0.090) : yTop - 0.270;
  const xLim = F ? Math.max(0.16, F.xMax - PAN_INSET) : Math.max(0.16, A.halfW - 0.05);
  // a dial fits where its whole circle, inset, is inside the plate's outline
  // - seven points round its rim against the column under each
  // THE KEEP-OUTS (G442.1): the crew's throttle shadow on the plate, from the
  // pilot's eye (A.keepOut, cage x / y rectangles) - nothing is placed under it
  const KO = Array.isArray(A.keepOut) ? A.keepOut : [];
  const kept = (x0, x1, y0, y1) => KO.some(k => x1 > k.x0 && x0 < k.x1 && y1 > k.y0 && y0 < k.y1);
  const fits = (cx, cy, r) => {
    if (Math.abs(cx) + r > xLim + 1e-6) return false;
    if (kept(cx - r, cx + r, cy - r, cy + r)) return false;
    // the switch row lives along the bottom: a dial leaves it its 16 mm and a gap
    // (the flexible row reserves nothing: its switches find their own room)
    if (cy + r > yTop + 1e-6 || cy - r < yBot + (flexRow ? 0 : SW_ROOM) - 1e-6) return false;
    if (!F) return true;
    for (const sN of [-1, -0.7, -0.35, 0, 0.35, 0.7, 1]) {
      const c = F.at(cx + sN * r);
      if (!c || Math.abs(c.x - (cx + sN * r)) > 0.03) return false;
      const h = r * Math.sqrt(1 - sN * sN);
      if (cy + h > c.y1 - PAN_INSET + 1e-6 || cy - h < c.y0 + PAN_INSET - 1e-6) return false;
    }
    return true;
  };
  // the highest centre a dial of radius r fits at over x (under the arch of
  // a plate whose crown is in the middle), or null when none does
  const topAt = (cx, r) => {
    for (let cy = yTop - r; cy - r >= yBot - 1e-6; cy -= 0.005) if (fits(cx, cy, r)) return cy;
    return null;
  };
  // the widest |x| the plate offers at height y (for the switch row)
  const xLimAt = y => {
    if (!F) return xLim;
    let m = 0;
    for (const c of F.cols) if (c.y0 + PAN_INSET <= y && c.y1 - PAN_INSET >= y) m = Math.max(m, Math.abs(c.x));
    return Math.max(0.10, Math.min(xLim, m));
  };
  const overflow = [];
  const dials = [], switches = [];
  const has = k => items.includes(k);
  // the T: three columns, two rows, big dials, centred on the pilot (or the
  // dash) and clamped inside the panel; its top row sits as high as the
  // OUTER columns fit under the crown
  const colW = D_BIG + GAP, rowH = D_BIG + GAP;
  const xC = side === 'centre' ? 0 : pilotX;
  let xT = clamp(xC, -xLim + 1.5 * colW, xLim - 1.5 * colW);
  // the top row as high as its three columns fit under the crown; when the
  // outer column is under the crown's fall, the T slides toward the middle
  // of the plate (a hand's width at most) before it drops
  const rowTop = x => { let y = yTop - D_BIG / 2; for (const c of [-1, 0, 1]) { const t = topAt(x + c * colW, D_BIG / 2); if (t == null) return null; if (t < y) y = t; } return y; };
  let y0 = rowTop(xT);
  if (y0 == null || y0 < yTop - D_BIG / 2 - 0.012) {
    const toMid = Math.sign(-xT) || 1, xB = xT;
    for (let d = 0.01; d <= 0.12 + 1e-9; d += 0.01) {
      const x2 = xB + toMid * d, y2 = rowTop(x2);
      if (y2 != null && (y0 == null || y2 > y0)) { xT = x2; y0 = y2; }
      if (y2 != null && y2 >= yTop - D_BIG / 2 - 0.012) break;
    }
  }
  if (y0 == null) y0 = yTop - D_BIG / 2;
  const tRows = fits(xT, y0 - rowH, D_BIG / 2) ? 2 : 1;
  const tSlot = (k, c, r) => {
    if (r >= tRows) { overflow.push(k); return; }
    // cage +x is the pilot's LEFT: column 0 is the leftmost = the largest x
    const cx = xT + (1 - c) * colW, cy = y0 - r * rowH;
    if (!fits(cx, cy, D_BIG / 2)) { overflow.push(k); return; }
    dials.push({ k, cx, cy, r: D_BIG / 2 });
  };
  // THE COMPACT PANEL (G442.4, the user: "the placement of the dials seems
  // predetermined; they should be optimized for the actual dash, in central
  // positions first"). The T and its blanking holes are the SIX-PACK's rule:
  // a scan that must not move when a gyro is not bought. A panel with no
  // gyro T at all (no attitude, no DG, no turn coordinator - build (4)'s
  // asi alt tacho fuel) has no scan to keep, and its dials pack from the
  // pilot's centre OUT: the big ones on the top row (the ASI in the middle,
  // the altimeter to its right, the tacho to its left, then the VSI and the
  // G-meter), the small ones on a row under them the same way, the clock
  // among them. Each takes the highest place that fits under the crown.
  const compact = !has('ai') && !has('aiE') && !has('dg') && !has('turn');
  let gx0 = 0, dir = -1, groupW = 0;             // the engine group's edge, for the radios
  const aiKey = has('aiE') ? 'aiE' : (has('ai') ? 'ai' : null);
  const radioKeys = (o.radios || []).filter(k => k === 'com' || k === 'xpdr' || k === 'nav');   // G2808: the NAV head
  const screens = [];
  let tBroken = false;
  // the switch row along the bottom band: key, master, alt, then the
  // light throws and the dimmers — pitch 40 mm, centred under the T
  const sw = [];
  // THE KEY IS ALWAYS THERE (G442.1, the playtest: "the KEY / MASTER / ALT
  // row is missing on builds without a bus"): a piston engine's key is its
  // MAGNETO switch (OFF / R / L / BOTH) and a hand-propped Cub has one - the
  // bus buys the START position, the master and the alternator rockers, not
  // the key. On a battery build the key is the pack's POWER key, two
  // positions (OFF / ON) on the same lock, `power: true` for the tape.
  sw.push({ k: 'key', kind: 'key', power: o.energyKind === 'battery' });
  if (o.elec && o.elec.hasBus) {
    sw.push({ k: 'master', kind: 'rocker' });
    if (o.elec.altA) sw.push({ k: 'alt', kind: 'rocker' });
    // G318: an avionics master when a radio is fitted — the user drew the
    // tape; the bus gates the radios' loads on it
    // G2801: ...and when any avionics is fitted (a NAV- or GPS-only fit had its loads on no switch at all)
    if ((o.radios || []).some(k => k === 'com' || k === 'xpdr') || o.avionics) sw.push({ k: 'avionics', kind: 'rocker' });
  }
  for (const k of (o.extLights || [])) sw.push({ k, kind: o.swStyle === 'pushpull' ? 'pushpull' : 'toggle', light: true });   // G371
  for (const k of (o.intLights || [])) sw.push({ k, kind: 'knob', light: true });
  if (o.flapSwitch) sw.push({ k: 'flap', kind: 'flap' });     // G335: at the row's right end, a Cessna's
  // the row's room at a height: the plate's width there less the keep-outs
  // (G442.1) and, on the flexible row, less every dial whose own switch
  // room or face covers that height - its free runs of switch centres
  const runsAt = (y, withDials) => {
    const xS = xLimAt(y), lo0 = -xS + 0.02, hi0 = xS - 0.02;
    const cuts = KO.filter(k => k.y1 > y - 0.012 && k.y0 < y + 0.012).map(k => [k.x0 - 0.012, k.x1 + 0.012]);
    if (withDials) for (const d of dials) if (!d.coaming && y > d.cy - d.r - SW_DROP - 1e-9 && y < d.cy + d.r + 0.012)
      cuts.push([d.cx - d.r - 0.012, d.cx + d.r + 0.012]);
    if (withDials) for (const q of screens) if (y > q.cy - q.h / 2 - SW_DROP - 1e-9 && y < q.cy + q.h / 2 + 0.012)
      cuts.push([q.cx - q.w / 2 - 0.012, q.cx + q.w / 2 + 0.012]);
    cuts.sort((a, b) => a[0] - b[0]);
    const runs = []; let a = lo0;
    for (const c of cuts) { if (c[0] > a) runs.push([a, Math.min(c[0], hi0)]); a = Math.max(a, c[1]); }
    if (a < hi0) runs.push([a, hi0]);
    return runs.filter(r => r[1] - r[0] > 0.02);
  };
  let screenLost = 0;                             // (how many: G2815)
  // THE STRIP FIRST (G2808, glass === 'strip'): the switch row laid on the plate's lowest clear run BEFORE anything
  // else, and the screen and the dials kept off it alone - the bottom band beside it is theirs (a short plate whose
  // whole band, kept, would cost dials, and whose band, given away, would leave the switches nowhere)
  let strip = null;
  if (glass === 'strip') {
    const y = yBot + 0.010, rs = runsAt(y, false);
    if (rs.length) {
      const holds = rs.filter(r => r[0] <= xC && xC <= r[1]);
      const R = (holds.length ? holds : rs).reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m));
      const pitch = Math.min(0.030, (R[1] - R[0]) / Math.max(1, sw.length - 1 || 1));
      let x = Math.min(R[1], Math.max(R[0] + pitch * (sw.length - 1), xC + pitch * (sw.length - 1) / 2));
      const at = [];
      for (const q of sw) { at.push(Object.assign({ x: clamp(x, R[0], R[1]), y, pitch }, q)); x -= pitch; }
      strip = { at, y, x0: Math.min(...at.map(q => q.x)), x1: Math.max(...at.map(q => q.x)) };
    }
  }
  const offStrip = (x0, x1, y0, y1) => !strip || !(x1 > strip.x0 && x0 < strip.x1 && y0 < strip.y + SW_DROP + 1e-9 && y1 > strip.y);
  if (glass) {
    // THE GLASS PANEL (G2808; see layout()). The plate's columns, memoised by the millimetre: the packer below asks
    // the same few hundred x's thousands of times
    const colMemo = new Map();
    const colAt = x => { const q = Math.round(x * 1000); let c = colMemo.get(q); if (c === undefined) { c = F ? F.at(q / 1000) || null : null; colMemo.set(q, c); } return c; };
    const yLow = yBot + (flexRow ? 0 : SW_ROOM);
    // a rectangle ON the plate: inside the outline, inset, clear of the keep-outs and of the switch band
    const rectFits = (x0, x1, y0, y1) => {
      if (x0 < -xLim - 1e-6 || x1 > xLim + 1e-6 || y1 > yTop + 1e-6 || y0 < yLow - 1e-6) return false;
      if (kept(x0, x1, y0, y1) || !offStrip(x0 - 0.008, x1 + 0.008, y0 - 0.008, y1 + 0.008)) return false;
      if (!F) return true;
      const ns = Math.max(1, Math.ceil((x1 - x0) / 0.01));
      for (let i = 0; i <= ns; i++) {
        const x = x0 + (x1 - x0) * i / ns, c = colAt(x);
        if (!c || Math.abs(c.x - x) > 0.03) return false;
        if (y1 > c.y1 - PAN_INSET + 1e-6 || y0 < c.y0 + PAN_INSET - 1e-6) return false;
      }
      return true;
    };
    const dialFits = (cx, cy, r) => {
      if (Math.abs(cx) + r > xLim + 1e-6 || cy + r > yTop + 1e-6 || cy - r < yLow - 1e-6) return false;
      if (kept(cx - r, cx + r, cy - r, cy + r) || !offStrip(cx - r - 0.008, cx + r + 0.008, cy - r, cy + r)) return false;
      if (!F) return true;
      for (const sN of [-1, -0.7, -0.35, 0, 0.35, 0.7, 1]) {
        const c = colAt(cx + sN * r);
        if (!c || Math.abs(c.x - (cx + sN * r)) > 0.03) return false;
        const h = r * Math.sqrt(1 - sN * sN);
        if (cy + h > c.y1 - PAN_INSET + 1e-6 || cy - h < c.y0 + PAN_INSET - 1e-6) return false;
      }
      return true;
    };
    // clear of what is placed: a screen and a GAP round it, a dial and a GAP between bezels
    const clearOf = (cx, cy, r) => {
      for (const d of dials) { const dx = d.cx - cx, dy = d.cy - cy, m = d.r + r + GAP; if (dx * dx + dy * dy < m * m - 1e-9) return false; }
      for (const q of screens) {
        const nx = Math.max(q.cx - q.w / 2, Math.min(cx, q.cx + q.w / 2)), ny = Math.max(q.cy - q.h / 2, Math.min(cy, q.cy + q.h / 2));
        const dx = nx - cx, dy = ny - cy, m = r + GAP;
        if (dx * dx + dy * dy < m * m - 1e-9) return false;
      }
      return true;
    };
    // THE SCREENS: on the pilot's line, as high as they fit - the score is the distance off the line plus half the
    // drop under the crown, on a 5 mm grid (a keep-out or the plate's edge slides a unit sideways, not down a row)
    for (const S of (Array.isArray(o.screens) ? o.screens : [])) {
      const w = +S.w, h = +S.h;
      // G2815: a screen's own line - the pilot's (every GPS), the passenger's beside him (a single big display put
      // there: the pilot's mirrored), the panel's middle (the MFD of a pair, beside the PFD)
      const xT = S.line === 'copilot' ? -xC : S.line === 'centre' ? 0 : xC;
      let best = null;
      for (let cx = -xLim + w / 2; cx <= xLim - w / 2 + 1e-9; cx += 0.005)
        for (let cy = yTop - h / 2; cy - h / 2 >= yLow - 1e-9; cy -= 0.005) {
          const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
          if (!rectFits(x0, x1, y0, y1)) continue;
          if (screens.some(q => x1 + GAP > q.cx - q.w / 2 && x0 - GAP < q.cx + q.w / 2 && y1 + GAP > q.cy - q.h / 2 && y0 - GAP < q.cy + q.h / 2)) continue;
          const score = Math.abs(cx - xT) + 0.5 * (yTop - y1);
          if (!best || score < best.score - 1e-12) best = { cx, cy, score };
          break;                                      // the highest at this x is the best at this x
        }
      if (best) screens.push({ k: S.k, cx: best.cx, cy: best.cy, w, h, sw: +S.sw || w * 0.8, sh: +S.sh || h * 0.75, line: S.line || 'pilot' });
      else screenLost++;                              // placeExtras tries it again (a portable's cradle) or names it
    }
    // THE DIALS. The flight group first, AS A T where it fits as one (the six-pack's scan kept beside the screen: the
    // attitude in the middle of the top row, the airspeed on its left, the altimeter on its right, the turn, the
    // heading and the climb under them - only the fitted ones, no blanking holes); then each dial on its own, in the
    // scan's priority (what the T could not hold, the engine, the fuel, the rest, the radio heads last). A place is
    // scored by its drop under the crown (x 0.7) plus its distance from its group - the pilot's line for the group's
    // first dial, the group's first dial after that - so an engine cluster stays a cluster.
    const BIG = new Set(['asi', 'ai', 'aiE', 'alt', 'dg', 'turn', 'vsi', 'tacho', 'gmeter']);
    const rOf = k => (BIG.has(k) ? D_BIG / 2 : D_SMALL / 2);
    const scan = (r, score) => {
      let best = null;
      for (let cx = -xLim + r; cx <= xLim - r + 1e-9; cx += 0.005)
        for (let cy = yTop - r; cy - r >= yLow - 1e-9; cy -= 0.005) {
          if (!clearOf(cx, cy, r) || !dialFits(cx, cy, r)) continue;
          const sc = score(cx, cy);
          if (!best || sc < best.score - 1e-12) best = { cx, cy, score: sc };
          break;                                      // the highest at this x is the best at this x
        }
      return best;
    };
    const tKeys = ['asi', 'alt', 'turn', 'dg', 'vsi'].filter(has).concat(aiKey ? [aiKey] : []);
    const tPos = k => (k === aiKey ? T_KEYS.ai : T_KEYS[k]);
    let tDone = false;
    if (tKeys.length >= 2) {
      // the T's anchor is its top row's middle slot; a one-row T when nothing is fitted on its bottom row
      const rows = tKeys.some(k => tPos(k)[1] === 1) ? 2 : 1, R0 = D_BIG / 2;
      let best = null;
      for (let ax = -xLim; ax <= xLim + 1e-9; ax += 0.005)
        for (let ay = yTop - R0; ay - R0 - (rows - 1) * rowH >= yLow - 1e-9; ay -= 0.005) {
          let ok = true;
          for (const k of tKeys) {
            const [c, rr] = tPos(k), cx = ax + (1 - c) * colW, cy = ay - rr * rowH;
            if (!clearOf(cx, cy, R0) || !dialFits(cx, cy, R0)) { ok = false; break; }
          }
          if (!ok) continue;
          const sc = Math.abs(ax - xC) + 0.7 * (yTop - ay - R0);
          if (!best || sc < best.score - 1e-12) best = { ax, ay, score: sc };
          break;
        }
      if (best) {
        for (const k of tKeys) { const [c, rr] = tPos(k); dials.push({ k, cx: best.ax + (1 - c) * colW, cy: best.ay - rr * rowH, r: R0, group: 't' }); }
        tDone = true;
      }
    }
    const GROUP = { asi: 't', alt: 't', turn: 't', dg: 't', vsi: 't', ai: 't', aiE: 't',
                    tacho: 'eng', gmeter: 'eng', fuel: 'eng', oilP: 'eng', oilT: 'eng', volts: 'eng', clock: 'eng', hobbs: 'eng',
                    com: 'radio', xpdr: 'radio', nav: 'radio' };
    // (the primary three, then the engine's speed and the fuel - the gauge that says how long the flight can last -
    // before the gyros that only back the scan up)
    const order = (tDone ? [] : [aiKey, 'asi', 'alt']).concat(['tacho', 'fuel']).concat(tDone ? [] : ['turn', 'dg', 'vsi'])
      .concat(['gmeter', 'oilP', 'oilT', 'volts', 'clock', 'hobbs'])
      .filter((k, i, a) => k && has(k) && a.indexOf(k) === i).concat(radioKeys);
    for (const k of order) {
      const r = rOf(k), g = GROUP[k] || k, head = dials.find(d => d.group === g);
      const best = scan(r, (cx, cy) => 0.7 * (yTop - cy - r) + (head ? Math.hypot(cx - head.cx, cy - head.cy) : Math.abs(cx - xC)));
      if (best) dials.push({ k, cx: best.cx, cy: best.cy, r, group: g });
      else overflow.push(k);
    }
    for (const d of dials) delete d.group;
    xT = screens.length ? screens[0].cx : xC;
    tBroken = tKeys.length >= 2 && !tDone;
  } else if (flexRow) {
    // ONE ROW, from the pilot's centre out: the flight group first (the
    // T's top row, then its bottom row), the engine, the small gauges, the
    // radios last - each dial beside the last on the side it alternates to,
    // as high as it fits under the crown, and the other side when it does
    // not fit on its own
    const BIG = new Set(['asi', 'ai', 'aiE', 'alt', 'dg', 'turn', 'vsi', 'tacho', 'gmeter']);
    // (the T's order read along a row: the AI in the middle, the ASI to the
    // pilot's left (+x), the altimeter to the right, the turn and the VSI
    // outboard on their own columns' sides; without an AI the compact
    // panel's: the ASI in the middle, the altimeter right, the tacho left)
    const order = (aiKey ? [aiKey, 'asi', 'alt', 'turn', 'vsi', 'dg'] : ['asi', 'alt', 'tacho'])
      .concat(['asi', 'alt', 'turn', 'vsi', 'dg', 'tacho', 'gmeter', 'fuel', 'clock', 'oilP', 'oilT', 'volts', 'hobbs'])
      .filter((k, i, a) => k && has(k) && a.indexOf(k) === i).concat(radioKeys);
    const edge = [xC, xC];                        // the row's -x and +x edges so far
    let first = true, side = aiKey ? 1 : 0;       // 0: -x (the pilot's right) next, 1: +x
    for (const k of order) {
      const r = BIG.has(k) ? D_BIG / 2 : D_SMALL / 2;
      let placed = false;
      for (const sd of first ? [0] : [side, 1 - side]) {
        const cx = first ? clamp(xC, -xLim + r, xLim - r) : sd === 0 ? edge[0] - GAP - r : edge[1] + GAP + r;
        const cy = topAt(cx, r);
        if (cy == null) continue;
        dials.push({ k, cx, cy, r });
        if (first) { edge[0] = cx - r; edge[1] = cx + r; } else if (sd === 0) edge[0] = cx - r; else edge[1] = cx + r;
        placed = true; break;
      }
      if (!placed) overflow.push(k);
      else if (!first) side = 1 - side;
      first = false;
    }
  } else if (compact) {
    const big = ['asi', 'alt', 'tacho', 'vsi', 'gmeter'].filter(has);
    const smalls = ['fuel', 'oilP', 'oilT', 'volts', 'clock', 'hobbs'].filter(has);
    // offsets from the centre, alternating: 0, the pilot's right (-x), left (+x), ...
    const spread = (n, pitch) => { const o = [0]; for (let i = 1; o.length < n; i++) { o.push(-i * pitch); if (o.length < n) o.push(i * pitch); } return o; };
    const rowOf = (keys, r, pitch, yWant) => {
      const offs = spread(keys.length, pitch);
      let low = yWant;
      keys.forEach((k, i) => {
        const cx = clamp(xC + offs[i], -xLim + r, xLim - r);
        const cy = fits(cx, yWant, r) ? yWant : topAt(cx, r);
        if (cy == null) { overflow.push(k); return; }
        dials.push({ k, cx, cy, r });
        low = Math.min(low, cy - r);
      });
      return low;
    };
    const yB = topAt(xC, D_BIG / 2);
    const low0 = rowOf(big, D_BIG / 2, colW, yB != null ? yB : yTop - D_BIG / 2);
    const y1 = low0 - GAP - D_SMALL / 2;
    rowOf(smalls, D_SMALL / 2, D_SMALL + GAP, y1);
    const onRows = dials.filter(d => !d.coaming);
    gx0 = onRows.length ? Math.min(...onRows.map(d => d.cx - d.r)) - GAP : xC;
  } else {
  for (const k of ['asi', 'alt', 'turn', 'dg', 'vsi']) if (has(k)) tSlot(k, T_KEYS[k][0], T_KEYS[k][1]);
  if (aiKey) tSlot(aiKey, T_KEYS.ai[0], T_KEYS.ai[1]);
  // the clock, left of the ASI when there is room
  if (has('clock')) {
    const cx = xT + 1.5 * colW + D_SMALL / 2 + GAP;
    let cy = y0 - (D_BIG - D_SMALL) / 2;
    if (!fits(cx, cy, D_SMALL / 2)) cy = topAt(cx, D_SMALL / 2);
    if (cy != null) dials.push({ k: 'clock', cx, cy, r: D_SMALL / 2 });
    else overflow.push('clock');
  }
  // the engine group, to the pilot's right of the T (−x); the other side
  // when it does not fit
  const eng = ['tacho', 'gmeter'].filter(has);
  // the FUEL / CHARGE gauge heads the cluster (A3): on a short plate the
  // last small gauge is the one that falls off, and the one that says how
  // long the flight can last is not the one to lose
  const small = ['fuel', 'oilP', 'oilT', 'volts', 'hobbs'].filter(has);      // G2808: the hour meter drawn, last
  groupW = Math.max(eng.length ? eng.length * colW : 0, small.length ? 2 * (D_SMALL + GAP) : 0);
  gx0 = xT - 1.5 * colW - GAP - 0.010;    // the group's near (left) edge, going −x
  dir = -1;
  if (gx0 - groupW < -xLim) { gx0 = xT + 1.5 * colW + GAP + 0.010 + (has('clock') ? D_SMALL + GAP : 0); dir = 1; }
  let gy = y0;
  {
    let x = gx0;
    let engLow = gy;
    for (const k of eng) {
      const cx = x + dir * D_BIG / 2;
      // a dial under the crown's fall drops to where it fits, the small
      // gauges below it with it
      const cy = fits(cx, gy, D_BIG / 2) ? gy : topAt(cx, D_BIG / 2);
      if (cy == null) { overflow.push(k); continue; }
      dials.push({ k, cx, cy, r: D_BIG / 2 });
      engLow = Math.min(engLow, cy);
      x += dir * colW;
    }
    if (eng.length) gy = engLow - D_BIG / 2 - GAP - D_SMALL / 2;
    // the small gauges in two columns under the tacho; one that has no room
    // below (a short plate) goes ALONG the row instead, outboard
    let i = 0, extra = 0;
    for (const k of small) {
      const col = i % 2, row = Math.floor(i / 2);
      let cx = gx0 + dir * (col * (D_SMALL + GAP) + D_SMALL / 2);
      let cy = gy - row * (D_SMALL + GAP);
      if (!fits(cx, cy, D_SMALL / 2)) {
        cx = gx0 + dir * ((2 + extra) * (D_SMALL + GAP) + D_SMALL / 2); cy = gy;
        if (!fits(cx, cy, D_SMALL / 2)) { const t = topAt(cx, D_SMALL / 2); if (t == null) { overflow.push(k); i++; continue; } cy = t; }
        extra++;
      }
      dials.push({ k, cx, cy, r: D_SMALL / 2 });
      i++;
    }
  }
  }   // (the T)
  // the radios: a column past the engine group, 57 mm controllers (the
  // flexible row carried them along itself)
  const radios = (flexRow || glass) ? [] : radioKeys;
  if (radios.length) {
    // past whatever the group reached (a small gauge sent along the row)
    for (const d of dials) if (!d.coaming && d.k !== 'clock' && !(d.k in T_KEYS) && d.k !== 'aiE')
      groupW = Math.max(groupW, dir * (d.cx - gx0) + D_SMALL / 2);
    const rx = gx0 + dir * (groupW + GAP + D_SMALL / 2);
    const ry = fits(rx, y0, D_SMALL / 2) ? y0 : topAt(rx, D_SMALL / 2);
    radios.forEach((k, i) => {
      const cy = ry == null ? null : ry - i * (D_SMALL + GAP);
      if (cy == null || !fits(rx, cy, D_SMALL / 2) || cy - D_SMALL / 2 < yBot + 0.03) { overflow.push(k); return; }
      dials.push({ k, cx: rx, cy, r: D_SMALL / 2 });
    });
  }
  // NO FITTED INSTRUMENT IS LEFT OFF THE DASH WHILE A T SLOT STANDS EMPTY
  // (A3, the 2026-09-20 playtest: the user's 2 kWh trainer had a two-dial T
  // with the attitude hole blank between them, and its charge gauge in the
  // overflow). The blanking plate is for the six-pack's scan; on a panel
  // that has no gyro to scan there is no scan to keep, and the hole takes
  // the dial that had nowhere else - the T's first row first, big dials at
  // their size, small ones centred in the slot.
  if (overflow.length && !compact && !flexRow && !glass) {
    const taken = (cx, cy) => dials.some(d => !d.coaming && Math.hypot(d.cx - cx, d.cy - cy) < d.r + 1e-6);
    for (const k of overflow.slice()) {
      const r = (k === 'tacho' || k === 'gmeter' || k in T_KEYS || k === 'aiE') ? D_BIG / 2 : D_SMALL / 2;
      let done = false;
      for (let row = 0; row < tRows && !done; row++) for (const c of [1, 0, 2]) {
        const cx = xT + (1 - c) * colW, cy = y0 - row * rowH;
        if (taken(cx, cy) || !fits(cx, cy, r)) continue;
        dials.push({ k, cx, cy, r, inHole: true }); overflow.splice(overflow.indexOf(k), 1); done = true; break;
      }
    }
  }
  // the compass on the coaming, on the pilot's line - the coaming is the
  // dash's TOP (the glareshield), above the plate
  if (has('compass')) {
    const r = 0.070 / 2;
    // in the MIDDLE of the dash (4f, the user: "the only place where there
    // is no curvature and it could realistically stick")
    const cx = 0;
    // ...standing ON the glareshield where it is, which is lower than the
    // dash's crown (the roll behind the lip is the highest point)
    const zc = (A.dashAftZ != null ? A.dashAftZ : zFace) + 0.045;
    const coam = A.dashTopAt ? A.dashTopAt(cx, 0.05, zc - 0.03, zc + 0.03) : hasDash ? A.dashTop : yTop + PAN_INSET;
    dials.push({ k: 'compass', cx, cy: coam + r * 0.5 + 0.002, r, coaming: true, z: zc });
  }
  let ySw = Math.max(yBot + 0.010, (dials.filter(d => !d.coaming).reduce((m, d) => Math.min(m, d.cy - d.r), yTop)) - SW_DROP);
  let flexRun = null;
  if ((flexRow || glass) && !strip) {
    // the LOWEST height whose clear run holds the row at a 30 mm pitch
    const need = 0.030 * Math.max(0, sw.length - 1);
    for (let y = yBot + 0.010; y <= yTop - 0.010 + 1e-9 && !flexRun; y += 0.004) {
      const ok = runsAt(y, true).filter(r => r[1] - r[0] >= need - 1e-9);
      if (!ok.length) continue;
      const holds = ok.filter(r => r[0] <= xC && xC <= r[1]);
      flexRun = (holds.length ? holds : ok).reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m));
      ySw = y;
    }
  }
  // NO ONE RUN HOLDS THE ROW (G2808, a glass panel on a short plate - the Jodel's): the lowest height whose clear
  // runs hold it BETWEEN them at a 26 mm pitch, +x first, rather than a row drawn over a screen or a dial
  let multi = null;
  if ((flexRow || glass) && !flexRun && !strip) {
    for (let y = yBot + 0.010; y <= yTop - 0.010 + 1e-9 && !multi; y += 0.004) {
      const rs = runsAt(y, true).sort((a, b) => b[1] - a[1]);
      let cap = 0;
      for (const r of rs) cap += Math.floor((r[1] - r[0]) / 0.026 + 1e-9) + 1;
      if (cap >= sw.length) { multi = rs; ySw = y; }
    }
  }
  const xSw = xLimAt(ySw);                     // the plate's own width down there
  // the longest free run, the one holding the pilot's centre when there is
  // a choice; the pitch shrinks to fit before anything is lost
  let lo = -xSw + 0.02, hi = xSw - 0.02;
  if (flexRun) { lo = flexRun[0]; hi = flexRun[1]; }
  else {
    const cuts = KO.filter(k => k.y1 > ySw - 0.012 && k.y0 < ySw + 0.012).sort((a, b) => a.x0 - b.x0);
    const runs = []; let a = lo;
    for (const k of cuts) { if (k.x0 - 0.012 > a) runs.push([a, Math.min(k.x0 - 0.012, hi)]); a = Math.max(a, k.x1 + 0.012); }   // a switch plate's own half width
    if (a < hi) runs.push([a, hi]);
    const ok = runs.filter(r => r[1] - r[0] > 0.02);
    if (ok.length) {
      const holds = ok.filter(r => r[0] <= xC && xC <= r[1]);
      const best = (holds.length ? holds : ok).reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m));
      lo = best[0]; hi = best[1];
    }
  }
  if (strip) for (const q of strip.at) switches.push(q);
  else if (multi) {
    let i = 0;
    for (const r of multi) {
      for (let x = r[1]; x >= r[0] - 1e-9 && i < sw.length; x -= 0.026) switches.push(Object.assign({ x, y: ySw, pitch: 0.026 }, sw[i++]));
      if (i >= sw.length) break;
    }
  } else {
  const pitch = Math.min(0.040, (hi - lo) / Math.max(1, sw.length - 1 || 1));
  let x = Math.min(hi, Math.max(lo + pitch * (sw.length - 1), xC + pitch * (sw.length - 1) / 2));
  for (const s of sw) { switches.push(Object.assign({ x: clamp(x, lo, hi), y: ySw, pitch }, s)); x -= pitch; }   // the pitch rides along: the tapes size to it
  }
  // the extent, the way the crew always published it
  // (a glass panel's screens are in its extent too, G2808: a box of half-sizes hx, hy)
  const onPanel = dials.filter(d => !d.coaming).map(d => ({ cx: d.cx, cy: d.cy, hx: d.r, hy: d.r }))
    .concat(screens.map(q => ({ cx: q.cx, cy: q.cy, hx: q.w / 2, hy: q.h / 2 })));
  const ext = onPanel.length ? {
    x0: Math.min(...onPanel.map(d => d.cx - d.hx)), x1: Math.max(...onPanel.map(d => d.cx + d.hx)),
    y0: Math.min(...onPanel.map(d => d.cy - d.hy)), y1: Math.max(...onPanel.map(d => d.cy + d.hy)), z: zFace } : null;
  // (a switch under a dial or a screen - the rule GATE PANEL / GPSFACE read: within a bezel's width plus 8 mm, from
  // the switch room under it to its top - counted, so the layouts tried can be weighed by it, G2808)
  const swClash = switches.filter(s => dials.some(d => !d.coaming && Math.abs(s.x - d.cx) < d.r + 0.008 && s.y > d.cy - d.r - SW_DROP + 1e-9 && s.y < d.cy + d.r) ||
    screens.some(q => s.x > q.cx - q.w / 2 - 0.008 && s.x < q.cx + q.w / 2 + 0.008 && s.y > q.cy - q.h / 2 - 0.008 && s.y < q.cy + q.h / 2 + 0.008)).length;
  return { dials, switches, ext, zFace, yTop, yBot, yMid: (yTop + yBot) / 2, xLim, overflow, xT, side, compact,
           screens, screenLost, glass: !!glass, swClash, tBroken,
           // the plate's plane, for the builder to stand the dials on
           plane: F ? { zTop: F.zTop, yTop: F.yTop, tilt: F.tilt } : null };
}

// ---------------------------------------------------------------------------
// THE ATLAS — 4096 × 2048 with 512-px slots, 32 faces (a full panel with its
// ball strip, its roses and its radios is 19); slot i at column i % 8, row
// floor(i / 8) from the top. `faceUV(slot)` gives the rect in texture
// space (v up, flipY), `faceUV.at(slot, x, y, cx, cy, d)` the mirror rule.
// ---------------------------------------------------------------------------
const ATLAS_W = 4096, ATLAS_H = 2048, SLOT = 512, COLS = 8;
// a face takes one slot; a STRIP (the compass card, 360° of rose) takes
// `wide` slots side by side in one row — the caller reserves them
function slotRect(i, wide) {
  return { x: (i % COLS) * SLOT, y: Math.floor(i / COLS) * SLOT, w: SLOT * (wide || 1), h: SLOT };
}
function faceUV(slot, x, y, cx, cy, d) {
  const R = slotRect(slot);
  const u = 0.5 - (x - cx) / d, v = 0.5 + (y - cy) / d;   // the mirror rule
  return [(R.x + u * R.w) / ATLAS_W, 1 - (R.y + (1 - v) * R.h) / ATLAS_H];
}

// ---------------------------------------------------------------------------
// THE PAINTERS — one per face, into a 2D context, at the slot's rect. They
// WRITE ONLY (no measureText, no gradients that read back): UISMOKE's
// context is a Proxy of no-ops and a painter that reads from it throws.
// Numerals in the vendored Plex, with a plain fallback.
// ---------------------------------------------------------------------------
const FONT = '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif';
const FONT_MONO = '"IBM Plex Mono", Consolas, monospace';
const INK = '#f4f2ec', INK_DIM = '#b9b6ad', FACE = '#101214', FACE_EDGE = '#1c1f24';

function faceBase(g, R, o) {
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2, r = R.w / 2;
  g.save();
  g.fillStyle = FACE;
  g.beginPath(); g.arc(cx, cy, r, 0, 2 * Math.PI); g.fill();
  // a faint rim shading toward the bezel
  g.strokeStyle = FACE_EDGE; g.lineWidth = r * 0.06;
  g.beginPath(); g.arc(cx, cy, r * 0.97, 0, 2 * Math.PI); g.stroke();
  g.restore();
  return { cx, cy, r };
}
// polar helpers on the face: clock angle → canvas point (clockwise from 12)
const pol = (cx, cy, r, deg) => [cx + r * Math.sin(deg * D2R), cy - r * Math.cos(deg * D2R)];
function ticks(g, F, key, units, o, opt) {
  const S = scaleOf(key, units, o);
  const { cx, cy, r } = F;
  opt = opt || {};
  const rOut = r * (opt.rOut || 0.90);
  // the arcs first, under the ticks
  for (const a of (S.arcs || [])) {
    const a0 = angleOfDisp(key, a.from, units, o), a1 = angleOfDisp(key, a.to, units, o);
    g.beginPath();
    g.strokeStyle = a.col; g.lineWidth = r * (a.w || 0.12); g.lineCap = 'butt';
    g.arc(cx, cy, rOut - r * (a.w || 0.12) / 2, (a0 - 90) * D2R, (a1 - 90) * D2R, a1 < a0);
    g.stroke();
  }
  g.strokeStyle = INK; g.lineCap = 'butt';
  const lo = S.dead != null ? S.dead : S.min;
  let last = lo;
  for (let v = lo; v <= S.max + 1e-9; v = +(v + S.minor).toFixed(9)) {
    const isMajor = Math.abs(v / S.major - Math.round(v / S.major)) < 1e-6;
    const a = angleOfDisp(key, v, units, o);
    const len = isMajor ? 0.16 : 0.08;
    const [x0, y0] = pol(cx, cy, rOut, a), [x1, y1] = pol(cx, cy, rOut - r * len, a);
    g.lineWidth = r * (isMajor ? 0.035 : 0.018);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    // a numeral within a seventh of the sweep of the F end would sit on the
    // F (the Cub's 11.9 US gal: "10" against "F") - the tick stays, the
    // numeral goes
    const crowdsEnd = S.ends && v > S.min && (S.max - v) / (S.max - S.min) < 0.14 && Math.abs(v - S.max) > 1e-9;
    if (isMajor && !opt.noLabels && !crowdsEnd) {
      const [lx, ly] = pol(cx, cy, rOut - r * (opt.labelIn || 0.30), a);
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `600 ${Math.round(r * (opt.fontK || 0.19))}px ${FONT}`;
      const lab = S.labels && S.labels[v] != null ? S.labels[v]
        : (S.ends && Math.abs(v - S.min) < 1e-9) ? S.ends.lo
        : (S.ends && Math.abs(v - S.max) < 1e-9) ? S.ends.hi
        : (opt.labelOf ? opt.labelOf(v) : String(Math.round(v * 100) / 100));
      g.fillText(lab, lx, ly);
    }
    last = v;
  }
  // THE FULL MARK (A3): a scale whose max is the tank's own capacity is not
  // a multiple of its step, so the loop stops short of it - the end gets its
  // major tick and its letter regardless
  if (S.ends && S.max - last > 1e-9) {
    const a = angleOfDisp(key, S.max, units, o);
    const [x0, y0] = pol(cx, cy, rOut, a), [x1, y1] = pol(cx, cy, rOut - r * 0.16, a);
    g.lineWidth = r * 0.035;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (!opt.noLabels) {
      const [lx, ly] = pol(cx, cy, rOut - r * (opt.labelIn || 0.30), a);
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `600 ${Math.round(r * (opt.fontK || 0.19))}px ${FONT}`;
      g.fillText(S.ends.hi, lx, ly);
    }
  }
  return S;
}
function unitText(g, F, txt, dy, k) {
  g.fillStyle = INK_DIM; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 ${Math.round(F.r * (k || 0.11))}px ${FONT}`;
  g.fillText(txt, F.cx, F.cy + F.r * (dy == null ? 0.42 : dy));
}
// THE HUB CAP (G442.2, the playtest: 'the airspeed needle crosses through the
// dial'): a hand's counterweight tail poked out the far side of a 0.06 r hub
// and the needle read as a bar across the face - the cap is 0.10 r, the size
// a real instrument's is, and every tail (0.08 r) hides under it
function hub(g, F, k) {
  g.fillStyle = '#2a2d33';
  g.beginPath(); g.arc(F.cx, F.cy, F.r * (k || 0.10), 0, 2 * Math.PI); g.fill();
}

const PAINT = {
  asi(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'asi', units, o, { labelOf: v => String(v), fontK: 0.15 });   // G371: three-digit labels every 20 must not touch
    unitText(g, F, 'AIRSPEED', -0.35, 0.10);
    unitText(g, F, scaleOf('asi', units, o).unit, 0.38, 0.10);
    hub(g, F);
  },
  alt(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'alt', units, o, { labelOf: v => String(Math.round(v / 100) % 10), fontK: 0.22 });
    unitText(g, F, 'ALTITUDE', -0.35, 0.10);
    unitText(g, F, units === 'metric' ? 'METRES ×100 · 1 000' : 'FEET ×100 · 1 000', 0.36, 0.085);
    // the Kollsman window, right of centre — a static 1013 / 29.92
    const w = F.r * 0.34, h = F.r * 0.16;
    g.fillStyle = '#e9e4d6'; g.fillRect(F.cx + F.r * 0.28, F.cy - h / 2, w, h);
    g.fillStyle = '#111'; g.font = `600 ${Math.round(F.r * 0.11)}px ${FONT_MONO}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(units === 'metric' ? '1013' : '29.92', F.cx + F.r * 0.28 + w / 2, F.cy);
    hub(g, F);
  },
  vsi(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'vsi', units, o, { labelOf: v => String(Math.abs(Math.round(v))) });
    unitText(g, F, 'VERTICAL SPEED', -0.22, 0.09);
    unitText(g, F, scaleOf('vsi', units, o).unit, 0.24, 0.085);
    // UP / DOWN either side of the zero
    g.fillStyle = INK_DIM; g.font = `600 ${Math.round(F.r * 0.10)}px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('UP', F.cx - F.r * 0.52, F.cy - F.r * 0.30);
    g.fillText('DOWN', F.cx - F.r * 0.52, F.cy + F.r * 0.32);
    hub(g, F);
  },
  // the attitude indicator's FIXED face: the roll scale round the top, the
  // aeroplane symbol; the ball is its own strip (see `aiBall`)
  ai(g, R, units, o) {
    const F = faceBase(g, R);
    const { cx, cy, r } = F;
    // the window: the ball shows through the middle
    g.fillStyle = '#0a0c0e'; g.beginPath(); g.arc(cx, cy, r * 0.80, 0, 2 * Math.PI); g.fill();
    // the roll scale: 0 (a triangle) then 10 20 30 45 60 90 either side
    g.strokeStyle = INK; g.fillStyle = INK;
    for (const d of [-90, -60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60, 90]) {
      const len = (d === 0 || Math.abs(d) === 30 || Math.abs(d) === 60 || Math.abs(d) === 90) ? 0.10 : 0.06;
      const [x0, y0] = pol(cx, cy, r * 0.90, d), [x1, y1] = pol(cx, cy, r * (0.90 - len), d);
      g.lineWidth = r * 0.03; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    const [tx, ty] = pol(cx, cy, r * 0.80, 0);
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - r * 0.05, ty - r * 0.09); g.lineTo(tx + r * 0.05, ty - r * 0.09); g.closePath(); g.fill();
    // the aeroplane symbol: a bar with a dot, orange
    g.strokeStyle = '#f0a030'; g.lineWidth = r * 0.05; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - r * 0.42, cy); g.lineTo(cx - r * 0.12, cy); g.stroke();
    g.beginPath(); g.moveTo(cx + r * 0.12, cy); g.lineTo(cx + r * 0.42, cy); g.stroke();
    g.fillStyle = '#f0a030'; g.beginPath(); g.arc(cx, cy, r * 0.035, 0, 2 * Math.PI); g.fill();
  },
  // the ball's STRIP: sky over ground with the horizon at the middle and a
  // pitch ladder to ±30°; the strip spans ±90° of pitch over its height (v),
  // wrapped 1:1 on a drum of 180° of arc, so the window shows ±30°.
  aiBall(g, R) {
    const { x, y, w, h } = R;
    g.fillStyle = '#4f8dd6'; g.fillRect(x, y, w, h / 2);
    g.fillStyle = '#8a5a2b'; g.fillRect(x, y + h / 2, w, h / 2);
    g.strokeStyle = INK; g.lineWidth = h * 0.006;
    g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
    // the ladder: pitch d sits at v = 0.5 + d/180
    g.fillStyle = INK; g.font = `700 ${Math.round(h * 0.036)}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const d of [-30, -20, -10, -5, 5, 10, 20, 30]) {
      const yy = y + h / 2 - (d / 180) * h;
      const len = Math.abs(d) % 10 === 0 ? w * 0.30 : w * 0.16;
      g.lineWidth = h * 0.0045;
      g.beginPath(); g.moveTo(x + w / 2 - len / 2, yy); g.lineTo(x + w / 2 + len / 2, yy); g.stroke();
      if (Math.abs(d) % 10 === 0) {
        g.fillText(String(Math.abs(d)), x + w / 2 - len / 2 - w * 0.075, yy);
        g.fillText(String(Math.abs(d)), x + w / 2 + len / 2 + w * 0.075, yy);
      }
    }
  },
  turn(g, R, units, o) {
    const F = faceBase(g, R);
    const { cx, cy, r } = F;
    // L / R marks at the rate-one tilt, and the level marks
    g.strokeStyle = INK; g.lineWidth = r * 0.04;
    for (const a of [-20, 20, -90, 90]) {
      const [x0, y0] = pol(cx, cy, r * 0.92, a), [x1, y1] = pol(cx, cy, r * 0.78, a);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    g.fillStyle = INK; g.font = `600 ${Math.round(r * 0.16)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('L', cx - r * 0.46, cy + r * 0.62); g.fillText('R', cx + r * 0.46, cy + r * 0.62);
    unitText(g, F, 'TURN COORDINATOR', -0.55, 0.085);
    unitText(g, F, '2 MIN', 0.82, 0.085);
    // the inclinometer tube, low on the face; the ball is geometry
    g.strokeStyle = '#d8d4c8'; g.lineWidth = r * 0.02;
    g.beginPath(); g.arc(cx, cy - r * 0.55, r * 1.05, (90 - 22) * D2R, (90 + 22) * D2R); g.stroke();
    g.strokeStyle = INK; g.lineWidth = r * 0.03;
    for (const dx of [-0.11, 0.11]) { g.beginPath(); g.moveTo(cx + r * dx, cy + r * 0.40); g.lineTo(cx + r * dx, cy + r * 0.56); g.stroke(); }
  },
  // the DG: a fixed face with the lubber line; the rotating CARD is a disc
  // with the rose painted (see `rose`)
  dg(g, R) {
    const F = faceBase(g, R);
    const { cx, cy, r } = F;
    g.fillStyle = '#0a0c0e'; g.beginPath(); g.arc(cx, cy, r * 0.84, 0, 2 * Math.PI); g.fill();
    g.fillStyle = INK;
    const [tx, ty] = pol(cx, cy, r * 0.96, 0);
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - r * 0.06, ty - r * 0.11); g.lineTo(tx + r * 0.06, ty - r * 0.11); g.closePath(); g.fill();
    // the aeroplane symbol, fixed, over the card
    g.strokeStyle = '#f0a030'; g.lineWidth = r * 0.045; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy - r * 0.30); g.lineTo(cx, cy + r * 0.22); g.stroke();
    g.beginPath(); g.moveTo(cx - r * 0.30, cy); g.lineTo(cx + r * 0.30, cy); g.stroke();
    g.beginPath(); g.moveTo(cx - r * 0.12, cy + r * 0.20); g.lineTo(cx + r * 0.12, cy + r * 0.20); g.stroke();
  },
  // the compass rose on a DISC (the DG's card): 0 at the top, N E S W, a
  // numeral every 30, a tick every 5
  rose(g, R) {
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2, r = R.w / 2;
    g.fillStyle = '#0e1012'; g.beginPath(); g.arc(cx, cy, r, 0, 2 * Math.PI); g.fill();
    g.strokeStyle = INK; g.fillStyle = INK;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 5) {
      const big = d % 30 === 0, mid = d % 10 === 0;
      const [x0, y0] = pol(cx, cy, r * 0.96, d), [x1, y1] = pol(cx, cy, r * (0.96 - (big ? 0.14 : mid ? 0.09 : 0.05)), d);
      g.lineWidth = r * (big ? 0.03 : 0.015);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (big) {
        const lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] || String(d / 10);
        const [lx, ly] = pol(cx, cy, r * 0.66, d);
        g.save(); g.translate(lx, ly); g.rotate(d * D2R);
        g.font = `600 ${Math.round(r * (lab.length === 1 && isNaN(+lab) ? 0.22 : 0.17))}px ${FONT}`;
        g.fillText(lab, 0, 0); g.restore();
      }
    }
  },
  // the magnetic compass CARD as a strip: 360° across u, letters upright;
  // wrapped on a vertical drum, read through the bowl's window
  // WHITE ON BLACK (G311, the user: "invert the colours of the dash mounted
  // compass. It is actually very bright when lit, it will be better on
  // dark background. Not the case, only the graduated part"): the card
  // takes the faces' own black and ink, so the posts light its marks the
  // way they light every other scale
  compassStrip(g, R) {
    const { x, y, w, h } = R;
    g.fillStyle = FACE; g.fillRect(x, y, w, h);
    g.fillStyle = INK; g.strokeStyle = INK;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 5) {
      const xx = x + (d / 360) * w;
      const big = d % 30 === 0, mid = d % 10 === 0;
      g.lineWidth = h * (big ? 0.03 : 0.015);
      g.beginPath(); g.moveTo(xx, y + h * 0.62); g.lineTo(xx, y + h * (0.62 + (big ? 0.28 : mid ? 0.18 : 0.10))); g.stroke();
      if (big) {
        const lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] || String(d / 10);
        g.font = `700 ${Math.round(h * (isNaN(+lab) ? 0.30 : 0.24))}px ${FONT}`;
        // the strip wraps at the seam: the N straddles it, so it is painted
        // on both sides (the clip keeps what falls inside the band)
        g.fillText(lab, xx, y + h * 0.32);
        if (d === 0) g.fillText(lab, xx + w, y + h * 0.32);
      }
    }
  },
  compass(g, R) {                               // the bowl's face: unused, a lubber line only
    const F = faceBase(g, R);
    g.strokeStyle = INK; g.lineWidth = F.r * 0.04;
    g.beginPath(); g.moveTo(F.cx, F.cy - F.r * 0.9); g.lineTo(F.cx, F.cy - F.r * 0.6); g.stroke();
  },
  tacho(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'tacho', units, o, { labelOf: v => String(v / 100) });
    unitText(g, F, 'RPM', -0.30, 0.12);
    unitText(g, F, '×100', 0.36, 0.09);
    hub(g, F);
  },
  gmeter(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'gmeter', units, o, { labelOf: v => (v > 0 ? '+' : '') + v });
    unitText(g, F, 'ACCELEROMETER', -0.30, 0.08);
    unitText(g, F, 'G', 0.38, 0.14);
    hub(g, F);
  },
  oilP(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'oilP', units, o, { fontK: 0.17 });
    unitText(g, F, 'OIL', -0.30, 0.13); unitText(g, F, scaleOf('oilP', units, o).unit, 0.36, 0.11);
    hub(g, F, 0.10);
  },
  oilT(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'oilT', units, o, { fontK: 0.17 });
    unitText(g, F, 'OIL TEMP', -0.30, 0.11); unitText(g, F, scaleOf('oilT', units, o).unit, 0.36, 0.12);
    hub(g, F, 0.10);
  },
  fuel(g, R, units, o) {
    const F = faceBase(g, R);
    // the numerals a size down when they are quantities (E 5 10 F), the
    // letters alone at the old size
    const S = ticks(g, F, 'fuel', units, o, { fontK: 0.20, labelIn: 0.34,
      labelOf: v => String(Math.round(v * 10) / 10) });
    unitText(g, F, S.title || 'FUEL', 0.30, 0.14);
    if (S.unit) unitText(g, F, S.unit, 0.52, 0.10);
    hub(g, F, 0.10);
  },
  volts(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'volts', units, o, { fontK: 0.17 });
    // G2808 (W5): the ammeter's marks over the bottom gap, from the same law its needle turns by
    ticks(g, F, 'amps', units, o, { fontK: 0.15, labelIn: 0.26 });
    unitText(g, F, 'VOLTS', 0.22, 0.10);
    unitText(g, F, 'AMPS', 0.42, 0.08);
    hub(g, F, 0.10);
  },
  clock(g, R, units, o) {
    const F = faceBase(g, R);
    const { cx, cy, r } = F;
    g.strokeStyle = INK; g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 60; i++) {
      const a = i * 6, big = i % 5 === 0;
      const [x0, y0] = pol(cx, cy, r * 0.92, a), [x1, y1] = pol(cx, cy, r * (0.92 - (big ? 0.12 : 0.05)), a);
      g.lineWidth = r * (big ? 0.035 : 0.015);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (big) { const [lx, ly] = pol(cx, cy, r * 0.62, a); g.font = `600 ${Math.round(r * 0.19)}px ${FONT}`; g.fillText(String(i / 5 || 12), lx, ly); }
    }
    unitText(g, F, '8 DAY', 0.40, 0.09);
    hub(g, F, 0.10);
  },
  // the radios: a dark controller face with a lit window, digits static
  // until session 5 makes them live
  com(g, R) {
    const F = faceBase(g, R); const { cx, cy, r } = F;
    g.fillStyle = '#1a1c1f'; g.fillRect(cx - r * 0.72, cy - r * 0.30, r * 1.44, r * 0.46);
    g.fillStyle = '#ffb347'; g.font = `600 ${Math.round(r * 0.26)}px ${FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('122.500', cx, cy - r * 0.07);
    g.fillStyle = INK_DIM; g.font = `500 ${Math.round(r * 0.11)}px ${FONT}`;
    g.fillText('COM', cx, cy - r * 0.55); g.fillText('STBY 121.500', cx, cy + r * 0.32);
    g.fillStyle = '#3a3d44'; g.beginPath(); g.arc(cx - r * 0.45, cy + r * 0.62, r * 0.16, 0, 2 * Math.PI); g.fill();
    g.beginPath(); g.arc(cx + r * 0.45, cy + r * 0.62, r * 0.16, 0, 2 * Math.PI); g.fill();
  },
  nav(g, R) {
    const F = faceBase(g, R); const { cx, cy, r } = F;
    g.fillStyle = '#1a1c1f'; g.fillRect(cx - r * 0.72, cy - r * 0.30, r * 1.44, r * 0.46);
    g.fillStyle = '#7fe08a'; g.font = `600 ${Math.round(r * 0.26)}px ${FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('110.50', cx, cy - r * 0.07);
    g.fillStyle = INK_DIM; g.font = `500 ${Math.round(r * 0.11)}px ${FONT}`;
    g.fillText('NAV', cx, cy - r * 0.55); g.fillText('STBY 113.90', cx, cy + r * 0.32);
    g.fillStyle = '#3a3d44'; g.beginPath(); g.arc(cx - r * 0.45, cy + r * 0.62, r * 0.16, 0, 2 * Math.PI); g.fill();
    g.beginPath(); g.arc(cx + r * 0.45, cy + r * 0.62, r * 0.16, 0, 2 * Math.PI); g.fill();
  },
  // THE HOUR METER (G2808): a counter window, four white drums and the tenths in reverse, over HOURS
  hobbs(g, R) {
    const F = faceBase(g, R); const { cx, cy, r } = F;
    const w = r * 1.30, h = r * 0.36, x0 = cx - w / 2, y0 = cy - h / 2, cw = w / 5;
    g.fillStyle = '#050607'; g.fillRect(x0, y0, w, h);
    g.font = `600 ${Math.round(r * 0.28)}px ${FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) {
      if (i === 4) { g.fillStyle = INK; g.fillRect(x0 + 4 * cw + 1, y0 + 1, cw - 2, h - 2); }
      g.fillStyle = i === 4 ? '#101214' : INK;
      g.fillText('0', x0 + (i + 0.5) * cw, cy + r * 0.01);
    }
    g.fillStyle = INK_DIM; g.font = `500 ${Math.round(r * 0.12)}px ${FONT}`;
    g.fillText('HOURS', cx, cy + r * 0.40); g.fillText('1/10', cx + r * 0.52, cy - r * 0.32);
  },
  xpdr(g, R) {
    const F = faceBase(g, R); const { cx, cy, r } = F;
    g.fillStyle = '#1a1c1f'; g.fillRect(cx - r * 0.72, cy - r * 0.30, r * 1.44, r * 0.46);
    g.fillStyle = '#ffb347'; g.font = `600 ${Math.round(r * 0.28)}px ${FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('1200', cx - r * 0.18, cy - r * 0.07);
    g.font = `600 ${Math.round(r * 0.13)}px ${FONT_MONO}`; g.fillText('ALT', cx + r * 0.48, cy - r * 0.07);
    g.fillStyle = INK_DIM; g.font = `500 ${Math.round(r * 0.11)}px ${FONT}`;
    g.fillText('XPDR', cx, cy - r * 0.55); g.fillText('IDENT', cx, cy + r * 0.62);
  },
};

// paint the whole atlas for a set of faces: `faces` = [{key, slot, painter}]
// THE LIGHT ON THE FACE (G298, the user: "I'd avoid the shortcut of doing
// emissive textures on the quadrants, and I would try to light them from
// inside the dial, like IRL"). A post-lit instrument has two small lamps on
// its bezel, at ten and two o'clock, shining across the face: the printing
// near them is bright, the far rim is dim, the black stays black. That
// irradiance is painted into the atlas's ALPHA channel, one tile per face
// (the same law for every round face — the posts are at the same clock
// positions on every bezel), and the faces material reads it as the
// light's strength: radiance = albedo x irradiance x dimmer — a face LIT,
// not a texture glowing (see _cage_panel.js facesMaterial). The strips (the
// ball, the compass card) and the rotating rose take a flat share: they
// are deeper in the case, lit from the same posts more evenly.
//   I(p) = 0.18 + sum over the two posts of 0.55 / (1 + (d / 0.5 r)^2), <= 1
// ...and the same law at ONE point, for a needle (G305): clock angle deg,
// radius as a fraction of the face's — what the hand at that angle gets
function postIrrAt(deg, rf) {
  const x = rf * Math.sin(deg * D2R), y = rf * Math.cos(deg * D2R);
  let I = 0.18;
  for (const pd of [-60, 60]) {
    const px = 0.95 * Math.sin(pd * D2R), py = 0.95 * Math.cos(pd * D2R);
    const d = Math.hypot(x - px, y - py) / 0.5;
    I += 0.55 / (1 + d * d);
  }
  return Math.min(1, I);
}
const POST_TILE = 128;
let postTile = null;
function postIrradiance() {
  if (postTile) return postTile;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = POST_TILE;
  const c = cv.getContext('2d');
  const id = c && c.createImageData ? c.createImageData(POST_TILE, POST_TILE) : null;
  if (!id || !id.data) return null;                 // a no-op context (UISMOKE)
  const r = POST_TILE / 2, cx = r, cy = r;
  const posts = [[-60, 0.95], [60, 0.95]].map(([deg, k]) =>
    [cx + r * k * Math.sin(deg * D2R), cy - r * k * Math.cos(deg * D2R)]);
  for (let y = 0; y < POST_TILE; y++) for (let x = 0; x < POST_TILE; x++) {
    let I = 0.18;
    for (const [px, py] of posts) {
      const d = Math.hypot(x + 0.5 - px, y + 0.5 - py) / (0.5 * r);
      I += 0.55 / (1 + d * d);
    }
    const a = Math.round(255 * Math.min(1, I));
    const i = (y * POST_TILE + x) * 4;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = a;
  }
  c.putImageData(id, 0, 0);
  return (postTile = cv);
}
function paintAtlas(g, faces, units, o) {
  g.clearRect(0, 0, ATLAS_W, ATLAS_H);
  for (const f of faces) {
    const p = PAINT[f.painter || FACES[f.key].painter];
    if (!p) continue;
    const R = slotRect(f.slot, f.wide);
    g.save();
    // clip to the slot so a painter cannot bleed into a neighbour
    g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
    p(g, R, units, o);
    // ...then the light on it, multiplied into the alpha (destination-in
    // keeps the paint and scales its alpha by the tile's)
    g.globalCompositeOperation = 'destination-in';
    const tile = f.wide || /:(rose|strip|ball)$/.test(f.key) ? null : postIrradiance();
    if (tile) g.drawImage(tile, R.x, R.y, R.w, R.h);
    else { g.fillStyle = 'rgba(255,255,255,0.72)'; g.fillRect(R.x, R.y, R.w, R.h); }
    g.restore();
  }
}

const API = { UNITS, FACES, REST, scaleOf, angleOf, angleOfDisp, layout, placeExtras, ATLAS_W, ATLAS_H, SLOT, COLS, slotRect, faceUV,
              PAINT, paintAtlas, postIrrAt, D_BIG, D_SMALL, GAP, niceStep, dispToSI };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.PANEL_GEN = API;
})();
