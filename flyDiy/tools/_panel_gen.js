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
              vs: { k: 196.8504 / 100, u: '×100 FT/MIN' }, press: { k: 1 / 6.894757, u: 'PSI' },
              temp: { k: 1, u: '°C' } },
  metric:   { speed: { k: 3.6, u: 'KM/H' }, alt: { k: 1, u: 'METRES' },
              vs: { k: 1, u: 'M/S' }, press: { k: 1e-5, u: 'BAR' },
              temp: { k: 1, u: '°C' } },
};
// a round number at or above x, in steps
const roundUp = (x, step) => Math.ceil(x / step - 1e-9) * step;

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
      return { min: 40, max: 130, k: 1, a0: 225, sweep: 270, unit: U.temp.u, major: 30, minor: 10,
               arcs: [{ from: 60, to: 110, col: '#3dbb5e', w: 0.12 }, { from: 118, to: 130, col: '#e8332a', w: 0.12 }] };
    case 'fuel':
      return { min: 0, max: 1, k: 1, a0: 300, sweep: 120, unit: '', major: 0.5, minor: 0.25,
               arcs: [{ from: 0, to: 0.1, col: '#e8332a', w: 0.14 }], labels: { 0: 'E', 0.5: '½', 1: 'F' } };
    case 'volts':
      return { min: 8, max: 16, k: 1, a0: 225, sweep: 270, unit: 'VOLTS', major: 2, minor: 1,
               arcs: [{ from: 12.5, to: 14.5, col: '#3dbb5e', w: 0.12 }, { from: 8, to: 11, col: '#e8332a', w: 0.12 }] };
    case 'turn':
      // the aeroplane symbol tilts: rate one (3 deg/s) = the mark at ±20 deg
      return { min: -6, max: 6, k: 180 / Math.PI, a0: -40, sweep: 80, unit: '2 MIN', major: 3, minor: 3, arcs: [] };
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
  asi:    { painter: 'asi', hands: [{ name: 'needle', drive: 'ias', law: 'lin', L: 0.82, w: 0.055, tail: 0.18 }] },
  alt:    { painter: 'alt', hands: [
              { name: 'h100', drive: 'alt', law: 'turn', per: 1000, L: 0.86, w: 0.05, tail: 0.15 },
              { name: 'h1k',  drive: 'alt', law: 'turn', per: 10000, L: 0.58, w: 0.09, tail: 0.10 },
              { name: 'h10k', drive: 'alt', law: 'turn', per: 100000, L: 0.90, w: 0.025, tail: 0.0 }] },
  vsi:    { painter: 'vsi', hands: [{ name: 'needle', drive: 'vs', law: 'lin', L: 0.82, w: 0.055, tail: 0.18 }] },
  ai:     { painter: 'ai', hands: [{ name: 'ball', kind: 'drum', drive: 'roll', drive2: 'pitch', law: 'ball' }] },
  aiE:    { painter: 'ai', hands: [{ name: 'ball', kind: 'drum', drive: 'roll', drive2: 'pitch', law: 'ball' }] },
  turn:   { painter: 'turn', hands: [{ name: 'plane', kind: 'symbol', drive: 'r', law: 'lin', L: 0.7, w: 0.06 }] },
  dg:     { painter: 'dg', hands: [{ name: 'card', kind: 'card', drive: 'hdg', law: 'card' }] },
  compass:{ painter: 'compass', hands: [{ name: 'card', kind: 'drumV', drive: 'hdg', law: 'card' }] },
  tacho:  { painter: 'tacho', hands: [{ name: 'needle', drive: 'rpmEng', law: 'lin', L: 0.82, w: 0.055, tail: 0.18 }] },
  gmeter: { painter: 'gmeter', hands: [{ name: 'needle', drive: 'nz', law: 'lin', L: 0.82, w: 0.055, tail: 0.18 },
                                       { name: 'max', drive: 'nzMax', law: 'lin', L: 0.82, w: 0.03, tail: 0.0 },
                                       { name: 'min', drive: 'nzMin', law: 'lin', L: 0.82, w: 0.03, tail: 0.0 }] },
  oilP:   { painter: 'oilP', hands: [{ name: 'needle', drive: 'oilP', law: 'lin', L: 0.8, w: 0.07, tail: 0.15 }] },
  oilT:   { painter: 'oilT', hands: [{ name: 'needle', drive: 'oilT', law: 'lin', L: 0.8, w: 0.07, tail: 0.15 }] },
  fuel:   { painter: 'fuel', hands: [{ name: 'needle', drive: 'fuelFrac', law: 'lin', L: 0.8, w: 0.07, tail: 0.15 }] },
  volts:  { painter: 'volts', hands: [{ name: 'needle', drive: 'volts', law: 'lin', L: 0.8, w: 0.07, tail: 0.15 }] },
  clock:  { painter: 'clock', hands: [
              { name: 'hour', drive: 'clockH', law: 'turn', per: 12, L: 0.55, w: 0.08, tail: 0.12 },
              { name: 'minute', drive: 'clockM', law: 'turn', per: 60, L: 0.85, w: 0.06, tail: 0.15 },
              { name: 'second', drive: 'clockS', law: 'turn', per: 60, L: 0.88, w: 0.02, tail: 0.2 }] },
  // the radios: a face with a window, no hands yet (session 5 paints the
  // digits live)
  com:    { painter: 'com', hands: [] },
  xpdr:   { painter: 'xpdr', hands: [] },
};
// the instrument light's rest pose for each drive when nothing feeds it
const REST = { ias: 0, alt: 0, vs: 0, roll: 0, pitch: 0, r: 0, hdg: 0, rpmEng: 0, nz: 1, nzMax: 1,
               nzMin: 1, oilP: 0, oilT: 40, fuelFrac: 0, volts: 0, clockH: 10, clockM: 10, clockS: 0 };

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
    let d = v * S.k;
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
  return angleOf(key, FACES[key].hands[0] || { law: 'lin' }, d / S.k, units, o);
}

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
function layout(A, o) {
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
  const fits = (cx, cy, r) => {
    if (Math.abs(cx) + r > xLim + 1e-6) return false;
    // the switch row lives along the bottom: a dial leaves it its 16 mm and a gap
    if (cy + r > yTop + 1e-6 || cy - r < yBot + SW_ROOM - 1e-6) return false;
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
  const aiKey = has('aiE') ? 'aiE' : (has('ai') ? 'ai' : null);
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
  const small = ['oilP', 'oilT', 'fuel', 'volts'].filter(has);
  let groupW = Math.max(eng.length ? eng.length * colW : 0, small.length ? 2 * (D_SMALL + GAP) : 0);
  let gx0 = xT - 1.5 * colW - GAP - 0.010;    // the group's near (left) edge, going −x
  let dir = -1;
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
  // the radios: a column past the engine group, 57 mm controllers
  const radios = (o.radios || []).filter(k => k === 'com' || k === 'xpdr');
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
  // the switch row along the bottom band: key, master, alt, then the
  // light throws and the dimmers — pitch 40 mm, centred under the T
  const sw = [];
  if (o.elec && o.elec.hasBus) {
    sw.push({ k: 'key', kind: 'key' }, { k: 'master', kind: 'rocker' });
    if (o.elec.altA) sw.push({ k: 'alt', kind: 'rocker' });
  }
  for (const k of (o.extLights || [])) sw.push({ k, kind: 'toggle', light: true });
  for (const k of (o.intLights || [])) sw.push({ k, kind: 'knob', light: true });
  const ySw = Math.max(yBot + 0.010, (dials.filter(d => !d.coaming).reduce((m, d) => Math.min(m, d.cy - d.r), yTop)) - SW_DROP);
  const xSw = xLimAt(ySw);                     // the plate's own width down there
  const pitch = Math.min(0.040, (2 * xSw - 0.02) / Math.max(1, sw.length));
  let x = Math.min(xSw - 0.02, Math.max(-xSw + 0.02 + pitch * (sw.length - 1), xC + pitch * (sw.length - 1) / 2));
  for (const s of sw) { switches.push(Object.assign({ x: clamp(x, -xSw + 0.02, xSw - 0.02), y: ySw }, s)); x -= pitch; }
  // the extent, the way the crew always published it
  const onPanel = dials.filter(d => !d.coaming);
  const ext = onPanel.length ? {
    x0: Math.min(...onPanel.map(d => d.cx - d.r)), x1: Math.max(...onPanel.map(d => d.cx + d.r)),
    y0: Math.min(...onPanel.map(d => d.cy - d.r)), y1: Math.max(...onPanel.map(d => d.cy + d.r)), z: zFace } : null;
  return { dials, switches, ext, zFace, yTop, yBot, yMid: (yTop + yBot) / 2, xLim, overflow, xT, side,
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
  for (let v = lo; v <= S.max + 1e-9; v = +(v + S.minor).toFixed(9)) {
    const isMajor = Math.abs(v / S.major - Math.round(v / S.major)) < 1e-6;
    const a = angleOfDisp(key, v, units, o);
    const len = isMajor ? 0.16 : 0.08;
    const [x0, y0] = pol(cx, cy, rOut, a), [x1, y1] = pol(cx, cy, rOut - r * len, a);
    g.lineWidth = r * (isMajor ? 0.035 : 0.018);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (isMajor && !opt.noLabels) {
      const [lx, ly] = pol(cx, cy, rOut - r * (opt.labelIn || 0.30), a);
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `600 ${Math.round(r * (opt.fontK || 0.19))}px ${FONT}`;
      const lab = S.labels && S.labels[v] != null ? S.labels[v]
        : (opt.labelOf ? opt.labelOf(v) : String(Math.round(v * 100) / 100));
      g.fillText(lab, lx, ly);
    }
  }
  return S;
}
function unitText(g, F, txt, dy, k) {
  g.fillStyle = INK_DIM; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 ${Math.round(F.r * (k || 0.11))}px ${FONT}`;
  g.fillText(txt, F.cx, F.cy + F.r * (dy == null ? 0.42 : dy));
}
function hub(g, F, k) {
  g.fillStyle = '#2a2d33';
  g.beginPath(); g.arc(F.cx, F.cy, F.r * (k || 0.06), 0, 2 * Math.PI); g.fill();
}

const PAINT = {
  asi(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'asi', units, o, { labelOf: v => String(v) });
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
    hub(g, F, 0.08);
  },
  oilT(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'oilT', units, o, { fontK: 0.17 });
    unitText(g, F, 'OIL TEMP', -0.30, 0.11); unitText(g, F, '°C', 0.36, 0.12);
    hub(g, F, 0.08);
  },
  fuel(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'fuel', units, o, { fontK: 0.24, labelIn: 0.34 });
    unitText(g, F, 'FUEL', 0.30, 0.14);
    hub(g, F, 0.08);
  },
  volts(g, R, units, o) {
    const F = faceBase(g, R);
    ticks(g, F, 'volts', units, o, { fontK: 0.17 });
    unitText(g, F, 'VOLTS', 0.36, 0.11);
    hub(g, F, 0.08);
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
    hub(g, F, 0.07);
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

const API = { UNITS, FACES, REST, scaleOf, angleOf, angleOfDisp, layout, ATLAS_W, ATLAS_H, SLOT, COLS, slotRect, faceUV,
              PAINT, paintAtlas, postIrrAt, D_BIG, D_SMALL, GAP };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.PANEL_GEN = API;
})();
