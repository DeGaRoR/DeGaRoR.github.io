// HULL-TYPES sketches (study only, 2026-11-03; futureDesigns/HULL-TYPES-2026-11.md).
//
// Every figure here is DRAWN FROM THE PROPOSED ROWS: a family is a set of the cage's existing frame rows (shared, the
// same keys and meanings as tools/_cage_page5.js "0 · frames") plus the few boat-only rows of the proposal. The same
// object prints the preset table (--table), so the sketches and the study's tables cannot drift apart.
//
// THE READING (the proposal, §3.2): a frame's `botY` is the section's LOWEST point in both modes (the keel datum the
// gear and the ground already read). Normal mode: a flat belly between the keel corners at +-botW (or the botRound
// arc). Hull mode: the centre column is the KEEL at botY, the keel corners become the CHINE, raised by botW tan(beta)
// (the deadrise, boat-only) - the V is botRound with a point instead of an arc. The floor level stays on the
// chine->waist wall, so the flare is the shared rows' own (waist half-width vs bottom half-width). The step is a tight
// ring pair at hullStepZ, its aft ring's keel hullHs higher; the afterbody keel is the shared pax / boom / tail
// frames' bottom heights.
//
// Units: metres, the cage frame at planeScale 1 (CAGE_UNIT 1.0, tools/_cage_gen.js). z = station from the bow tip,
// aft positive (drawn nose LEFT). Run:  node futureDesigns/hull-types/draw_hulls.js [--table]
'use strict';
const fs = require('fs'), path = require('path');
const OUT = __dirname;
const D2R = Math.PI / 180;

// ---------------------------------------------------------------------------------------------------------------
// the shared frame rows (the cage's), per family. Frames in station order; each: z, topY, waistY, botY, topW,
// waistW, botW. Keys are the cage's own (frNose*, frWin*, frCab*, frPax*, aftRoofY/frBoom*/aftKeelY, tailRoofY/
// frTail*/tailKeelY/tailHalfW) - written here as one compact record per frame for the drawing.
// ---------------------------------------------------------------------------------------------------------------
const F = (z, topY, waistY, botY, topW, waistW, botW) => ({ z, topY, waistY, botY, topW, waistW, botW });

// THE BASE CABIN BOAT (a 2-4 seat amphibian, ~7.2 m): the classic blended-cabin hull's frames
const CABIN_BOAT = {
  nose: F(0.00, 0.62, 0.55, 0.42, 0.08, 0.10, 0.06),
  win:  F(1.35, 1.28, 0.58, 0.00, 0.40, 0.58, 0.46),
  cab:  F(2.45, 1.38, 0.60, -0.04, 0.48, 0.62, 0.50),
  pax:  F(3.55, 1.30, 0.62, 0.10, 0.44, 0.58, 0.44),
  boom: F(4.70, 1.10, 0.66, 0.38, 0.30, 0.40, 0.28),
  tail: F(7.10, 1.05, 0.95, 0.88, 0.08, 0.10, 0.06),
};
const clone = o => JSON.parse(JSON.stringify(o));
const withF = (base, over) => { const b = clone(base); for (const k in over) Object.assign(b[k], over[k]); return b; };

// ---------------------------------------------------------------------------------------------------------------
// THE FAMILIES: shared (frames + the shared switches) and boat (the boat-only rows). The `refs` are the aeroplanes the
// family stands for (the study's §1 table).
// ---------------------------------------------------------------------------------------------------------------
const FAMILIES = [
  { key: 'classicV', name: 'Classic single-step V, rising tail cone',
    refs: 'Seabee, Lake LA-4, Widgeon, Albatross, PBY Catalina, Borey, Volmer VJ-22, Osprey 2, Seawind 300C, Mermaid, Atol 650',
    frames: CABIN_BOAT,
    shared: { botRound: 0, crKeel: 3, topRound: 0.6, boomStyle: 0 },
    boat: { hullOn: 1, hullStepZ: 2.95, hullHs: 0.07, hullBeta: 22, hullBetaBow: 38, hullBetaA: 18,
            hullSteps: 1, hullRail: 0.03, hullPad: 0 },
    stab: 'tipFloat' },
  { key: 'twoStep', name: 'Two steps (main + rear step), long afterbody',
    refs: 'Dornier Wal (sourced); Goose and Sunderland aft step (unconfirmed)',
    frames: withF(CABIN_BOAT, { pax: { botY: 0.05 }, boom: { z: 5.0, botY: 0.24 }, tail: { botY: 0.90 } }),
    shared: { botRound: 0, crKeel: 3, topRound: 0.6, boomStyle: 0 },
    boat: { hullOn: 1, hullStepZ: 2.95, hullHs: 0.07, hullBeta: 22, hullBetaBow: 38, hullBetaA: 18,
            hullSteps: 2, hullStep2Z: 5.0, hullHs2: 0.05, hullRail: 0.03, hullPad: 0 },
    stab: 'tipFloat' },
  { key: 'padBow', name: 'Flat-floored pad ahead of the step (the "bass boat" bow)',
    refs: 'no reference in the list confirmed (a capability, not a family yet)',
    frames: withF(CABIN_BOAT, { win: { botW: 0.52 }, cab: { botW: 0.55 }, nose: { botY: 0.36 } }),
    shared: { botRound: 0, crKeel: 3, topRound: 0.8, boomStyle: 0 },
    boat: { hullOn: 1, hullStepZ: 2.95, hullHs: 0.06, hullBeta: 14, hullBetaBow: 28, hullBetaA: 14,
            hullSteps: 1, hullRail: 0.04, hullPad: 0.18 },
    stab: 'sponson' },
  { key: 'podBoom', name: 'Pod hull on a boom (Rod & pod + hull)',
    refs: 'short hull, slender tail boom: Che-22, Aventura II, Adventurer 333 (read off photos, unsourced)',
    frames: withF(CABIN_BOAT, {
      pax:  { z: 3.40, topY: 1.18, botY: 0.12, topW: 0.38, waistW: 0.52, botW: 0.40 },
      boom: { z: 4.10, topY: 0.95, waistY: 0.70, botY: 0.44, topW: 0.16, waistW: 0.22, botW: 0.16 },
      tail: { z: 4.40, topY: 0.86, waistY: 0.76, botY: 0.66, topW: 0.06, waistW: 0.07, botW: 0.05 } }),
    shared: { botRound: 0, crKeel: 3, topRound: 1, boomStyle: 1, rodY: 0.95, rodD: 0.10, rodLen: 2.6 },
    boat: { hullOn: 1, hullStepZ: 2.70, hullHs: 0.06, hullBeta: 20, hullBetaBow: 36, hullBetaA: 16,
            hullSteps: 1, hullRail: 0.03, hullPad: 0 },
    stab: 'tipFloat' },
  { key: 'tubOpen', name: 'Hull tub, open frame above (skin to the waist)',
    refs: 'Super Petrel LS / XP (a tub, open frame and wings above), SeaRey (a hull tub)',
    frames: withF(CABIN_BOAT, {
      win: { topY: 0.95 }, cab: { topY: 0.95 },
      pax:  { z: 3.40, topY: 0.85, botY: 0.12, topW: 0.40, waistW: 0.52, botW: 0.40 },
      boom: { z: 4.10, topY: 0.80, waistY: 0.70, botY: 0.44, topW: 0.16, waistW: 0.22, botW: 0.16 },
      tail: { z: 4.40, topY: 0.80, waistY: 0.76, botY: 0.66, topW: 0.06, waistW: 0.07, botW: 0.05 } }),
    shared: { botRound: 0, crKeel: 3, topRound: 0, boomStyle: 1, rodY: 1.35, rodD: 0.09, rodLen: 2.6,
              covering: 'tub', cpOpen: 1 },
    boat: { hullOn: 1, hullStepZ: 2.70, hullHs: 0.06, hullBeta: 18, hullBetaBow: 34, hullBetaA: 15,
            hullSteps: 1, hullRail: 0, hullPad: 0 },
    stab: 'tipFloat' },
  { key: 'roundChine', name: 'Round (soft) chine, deep keel',
    refs: 'no reference confirmed (botRound in hull mode: the existing row already draws it)',
    frames: CABIN_BOAT,
    shared: { botRound: 0.55, crKeel: 0.4, topRound: 1, boomStyle: 0 },
    boat: { hullOn: 1, hullStepZ: 2.95, hullHs: 0.07, hullBeta: 25, hullBetaBow: 40, hullBetaA: 20,
            hullSteps: 1, hullRail: 0.025, hullPad: 0 },
    stab: 'sponson' },
  { key: 'stepless', name: 'Stepless round body on hydrofoils',
    refs: 'LISA Akoya (no planing bottom, no step, two Seafoils), Vickers Wave (hydrofins)',
    frames: withF(CABIN_BOAT, { win: { botY: 0.02 }, cab: { botY: 0.0 }, pax: { botY: 0.12 } }),
    shared: { botRound: 1, crKeel: 0, topRound: 1, boomStyle: 0 },
    boat: { hullOn: 1, hullStepZ: 2.95, hullHs: 0, hullBeta: 0, hullBetaBow: 0, hullBetaA: 0,
            hullSteps: 0, hullRail: 0, hullPad: 0 },
    stab: 'hydrofin' },
  { key: 'trimaran', name: 'Trimaran: centre hull + two outrigger hulls',
    refs: 'Novotech Seagull (trimaran), MVP Model 3 (tri-hull)',
    frames: withF(CABIN_BOAT, { pax: { z: 3.40 }, boom: { z: 4.20, botY: 0.42 }, tail: { z: 4.50, botY: 0.62 } }),
    shared: { botRound: 0, crKeel: 3, topRound: 1, boomStyle: 1, rodY: 0.90, rodD: 0.10, rodLen: 2.4 },
    boat: { hullOn: 1, hullStepZ: 2.75, hullHs: 0.06, hullBeta: 20, hullBetaBow: 36, hullBetaA: 16,
            hullSteps: 1, hullRail: 0.03, hullPad: 0 },
    stab: 'outrigger' },
];

// the water-stability option, per family sketch: what the section-at-step / front views draw
const STAB = {
  tipFloat:  { name: 'strut tip floats', rows: { stabTipZ: 0.85, stabFloatL: 1.4, stabFloatVol: 0.06 } },
  sponson:   { name: 'hull-side sponsons', rows: { spnSpan: 0.95, spnChord: 1.5, spnY: 0.10, spnDihedral: -4 } },
  wingRoot:  { name: 'planing wing roots', rows: { wgPos: 'low', rootAtChine: 1 } },
  drooped:   { name: 'drooped buoyant tips', rows: { wgTip: 'drooped', tipDroop: 0.55, tipVol: 0.05 } },
  outrigger: { name: 'outrigger hulls (the float layer, wide track)', rows: { gearFloats: 1, fltTrack: 1.55, fltL: 2.6 } },
  hydrofin:  { name: 'hydrofins', rows: { finSpan: 0.8, finChord: 0.45, finY: 0.08 } },
};

// ---------------------------------------------------------------------------------------------------------------
// the reading: frames + boat rows -> the section at any station
// ---------------------------------------------------------------------------------------------------------------
const ORDER = ['nose', 'win', 'cab', 'pax', 'boom', 'tail'];
// a monotone cubic through the frames (the cage's CC-smoothed longerons read as a smooth line; a straight lerp
// would draw kinks the subdivided skin never shows)
function interp(frames, key, z) {
  const Fs = ORDER.map(k => frames[k]);
  if (z <= Fs[0].z) return Fs[0][key];
  if (z >= Fs[Fs.length - 1].z) return Fs[Fs.length - 1][key];
  let i = 0; while (z > Fs[i + 1].z) i++;
  const a = Fs[i], b = Fs[i + 1], t = (z - a.z) / (b.z - a.z);
  const s = t * t * (3 - 2 * t);
  return a[key] + (b[key] - a[key]) * (0.5 * t + 0.5 * s);
}
const smooth01 = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

// the bow: forward of the windscreen frame the keel rises to the stem (the nose frame's bottom height, shared);
// the deadrise warps toward the bow as the float generator's law (32_hydro.js sectionOf: t^2.5)
function sectionAt(fam, z, mode) {
  const fr = fam.frames, B = fam.boat, S = fam.shared;
  const g = k => interp(fr, k, z);
  let botY = g('botY');
  const topY = g('topY'), waistY = g('waistY'), topW = g('topW'), waistW = g('waistW');
  let botW = g('botW');
  const hull = mode === 'hull';
  let beta = 0, steps = [];
  if (hull) {
    const zs = B.hullStepZ;
    if (z <= zs) {
      const t = Math.min(1, (zs - z) / zs);
      beta = B.hullBeta + (B.hullBetaBow - B.hullBeta) * Math.pow(t, 2.5);
    } else beta = B.hullBetaA;
    // the step: the aft ring's keel hullHs over the fore ring's, fading into the next frame's own bottom height
    const stepRise = (zStep, hs) => {
      if (z <= zStep) return 0;
      const nxt = ORDER.map(k => fr[k]).find(f => f.z > zStep + 0.05);
      const zN = nxt ? nxt.z : zStep + 1;
      return hs * (1 - smooth01((z - zStep) / (zN - zStep)));
    };
    if (B.hullSteps > 0) botY += stepRise(zs, B.hullHs);
    if (B.hullSteps === 2) botY += stepRise(B.hullStep2Z, B.hullHs2);
  }
  // the section's points, starboard half, keel -> roof; normal: flat belly (or the botRound arc)
  const pad = hull ? Math.min(B.hullPad || 0, 0.6 * botW) : 0;
  const zPadEnd = hull ? B.hullStepZ : 0;
  const padHere = hull && pad > 0 && z <= zPadEnd && z >= 0.35 * zPadEnd ? pad : 0;
  const chineY = hull ? botY + (botW - padHere) * Math.tan(beta * D2R) : botY;
  const rB = S.botRound || 0;
  const pts = [];
  pts.push([0, botY]);                                   // the keel (centre column)
  if (padHere) pts.push([padHere, botY]);                // the pad's edge
  if (rB > 0 && !hull) {
    // the botRound arc from the crown toward the waist (the cage's roundTop: the corners ride the arc)
    for (let i = 1; i <= 6; i++) { const th = (90 - 90 * i / 6) * D2R;
      pts.push([botW * Math.cos(th) * (1 - rB) + waistW * Math.cos(th) * rB * 0 + botW * Math.cos(th) * rB,
                waistY + (botY - waistY) * (Math.sin(th) * rB + (1 - rB))]); }
  } else if (rB > 0 && hull) {
    // soft chine: the chine corner rounded (the crease off), the V kept
    const c = [botW, chineY], k = [0, botY], w = [waistW, waistY];
    const r = 0.45 * rB;
    const a = [c[0] + (k[0] - c[0]) * r, c[1] + (k[1] - c[1]) * r], b2 = [c[0] + (w[0] - c[0]) * r * 0.6, c[1] + (w[1] - c[1]) * r * 0.6];
    pts.push(a);
    for (let i = 1; i < 6; i++) { const t = i / 6, m = 1 - t;
      pts.push([m * m * a[0] + 2 * m * t * c[0] + t * t * b2[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b2[1]]); }
    pts.push(b2);
  } else pts.push([botW, chineY]);                       // the keel corner = the chine in hull mode
  const rail = hull && z < B.hullStepZ && z > 0.25 * B.hullStepZ ? (B.hullRail || 0) : 0;
  if (rail) { pts.push([botW + rail, chineY + 0.004]); pts.push([botW + rail * 0.6, chineY + 0.022]); }
  pts.push([waistW, waistY]);                            // the waist (the gunwale in hull mode)
  const yBand = waistY + 0.10;
  pts.push([waistW - 0.02 * (waistW - topW), yBand]);
  const rT = S.topRound || 0;
  for (let i = 1; i <= 5; i++) { const th = 90 * i / 5 * D2R;   // the roof: box -> the topRound arc
    const bx = topW + (waistW - topW) * (1 - i / 5) * 0.4, by = topY;
    const ax = waistW * Math.cos(th), ay = yBand + (topY - yBand) * Math.sin(th);
    pts.push([i === 5 ? 0 : ax * rT + bx * (1 - rT) * (i < 5 ? 1 : 0), ay * rT + by * (1 - rT)]); }
  return { z, pts, botY, chineY, waistY, topY, botW, waistW, beta, pad: padHere, rail };
}

// ---------------------------------------------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------------------------------------------
const C = { ink: '#1d2733', keel: '#b0352b', chine: '#1f6fb2', waist: '#6a7a8a', water: '#2a8bc7', fill: '#e9eef3',
            stab: '#3d8f4f', faint: '#9aa7b4', note: '#56636f' };
const f2 = v => (+v).toFixed(1);
function svgDoc(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Helvetica, Arial, sans-serif">\n` +
    `<rect width="${w}" height="${h}" fill="#ffffff"/>\n<text x="14" y="22" font-size="14" font-weight="bold" fill="${C.ink}">${title}</text>\n${body}</svg>\n`;
}
const pl = (pts, stroke, sw = 1.6, fill = 'none', dash = '') =>
  `<polyline points="${pts.map(p => f2(p[0]) + ',' + f2(p[1])).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>\n`;
const pg = (pts, stroke, fill, sw = 1.4) =>
  `<polygon points="${pts.map(p => f2(p[0]) + ',' + f2(p[1])).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>\n`;
const tx = (x, y, s, size = 11, fill = C.note, anchor = 'start') =>
  `<text x="${f2(x)}" y="${f2(y)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s}</text>\n`;

// side profile: roof, waist, chine and keel lines; the step; the waterline at rest (approximate: the chine at the step)
function sideProfile(fam, mode, ox, oy, sc, opts = {}) {
  const fr = fam.frames, zEnd = fr.tail.z, N = 220;
  const S = [];
  for (let i = 0; i <= N; i++) S.push(sectionAt(fam, zEnd * i / N, mode));
  if (mode === 'hull') {    // the step faces: a vertical drop at the step stations
    const add = (zs) => { S.push(Object.assign(sectionAt(fam, zs - 1e-4, mode), { z: zs - 1e-4 }),
                                 Object.assign(sectionAt(fam, zs + 1e-4, mode), { z: zs + 1e-4 })); };
    if (fam.boat.hullSteps > 0) add(fam.boat.hullStepZ); if (fam.boat.hullSteps === 2) add(fam.boat.hullStep2Z);
    S.sort((a, b) => a.z - b.z);
  }
  const X = z => ox + z * sc, Y = y => oy - y * sc;
  let o = '';
  // the body silhouette (roof over, keel under)
  const top = S.map(s => [X(s.z), Y(s.topY)]), bot = S.map(s => [X(s.z), Y(s.botY)]).reverse();
  o += pg(top.concat(bot), C.ink, C.fill, 1.8);
  o += pl(S.map(s => [X(s.z), Y(s.waistY)]), C.waist, 1.1, 'none', '5 3');
  if (mode === 'hull') o += pl(S.map(s => [X(s.z), Y(s.chineY)]), C.chine, 1.4);
  o += pl(S.map(s => [X(s.z), Y(s.botY)]), C.keel, 2.0);
  // the frames (the shared rows' stations)
  for (const k of ORDER) { const f = fr[k];
    o += `<line x1="${f2(X(f.z))}" y1="${f2(Y(f.topY) - 4)}" x2="${f2(X(f.z))}" y2="${f2(Y(sectionAt(fam, f.z, mode).botY) + 4)}" stroke="${C.faint}" stroke-width="0.8" stroke-dasharray="2 2"/>\n`;
    if (!opts.noLabels) o += tx(X(f.z), Y(f.topY) - 7, k, 9, C.faint, 'middle'); }
  // the boom (Rod & pod)
  if (fam.shared.boomStyle === 1) {
    const z0 = fr.tail.z - 0.4, z1 = z0 + fam.shared.rodLen, ry = fam.shared.rodY, rd = fam.shared.rodD;
    o += `<rect x="${f2(X(z0))}" y="${f2(Y(ry + rd / 2))}" width="${f2((z1 - z0) * sc)}" height="${f2(rd * sc)}" fill="${C.fill}" stroke="${C.ink}" stroke-width="1.2"/>\n`;
    // the tail feathers, schematic
    o += pg([[X(z1 - 0.9), Y(ry + rd / 2)], [X(z1 - 0.35), Y(ry + 1.05)], [X(z1), Y(ry + 1.05)], [X(z1), Y(ry + rd / 2)]], C.ink, '#ffffff', 1.0);
  } else {
    const zt = fr.tail.z, yt = fr.tail.topY;
    o += pg([[X(zt - 1.0), Y(yt - 0.02)], [X(zt - 0.35), Y(yt + 1.0)], [X(zt + 0.05), Y(yt + 1.0)], [X(zt + 0.05), Y(yt - 0.05)]], C.ink, '#ffffff', 1.0);
  }
  // the static waterline: through the step's chine, level (a sketch: the real rest trim is the solver's)
  if (mode === 'hull' && !opts.noWater) {
    const sS = sectionAt(fam, fam.boat.hullStepZ - 1e-3, mode);
    const wl = sS.botY + 0.62 * (sS.chineY - sS.botY) + 0.10;
    o += `<line x1="${f2(X(-0.3))}" y1="${f2(Y(wl))}" x2="${f2(X(zEnd + 0.3))}" y2="${f2(Y(wl))}" stroke="${C.water}" stroke-width="1" stroke-dasharray="8 4"/>\n`;
    o += tx(X(zEnd + 0.3), Y(wl) + 12, 'waterline at rest (sketch)', 9, C.water, 'end');
    const zs = fam.boat.hullStepZ;
    if (fam.boat.hullSteps > 0) o += tx(X(zs), Y(sectionAt(fam, zs - 1e-3, mode).botY) + 16, 'step', 10, C.keel, 'middle');
    if (fam.boat.hullSteps === 2) o += tx(X(fam.boat.hullStep2Z), Y(sectionAt(fam, fam.boat.hullStep2Z - 1e-3, mode).botY) + 16, 'rear step', 10, C.keel, 'middle');
  }
  return o;
}

// the section at a station (starboard + mirror), with the stability device at that station if any
function sectionView(fam, mode, z, cx, cy, sc, opts = {}) {
  const s = sectionAt(fam, z, mode);
  const half = s.pts.map(p => [cx + p[0] * sc, cy - p[1] * sc]);
  const mir = s.pts.slice().reverse().map(p => [cx - p[0] * sc, cy - p[1] * sc]);
  let o = '';
  if (fam.shared.covering === 'tub' && mode === 'hull') {
    // skin to the waist; the frame above drawn as tubes
    const iw = s.pts.findIndex(p => Math.abs(p[1] - s.waistY) < 1e-9 && p[0] > 0.01);
    const lowH = half.slice(0, iw + 1), lowM = mir.slice(mir.length - 1 - iw);
    o += pg(lowM.concat(lowH), C.ink, C.fill, 1.8);
    const upH = half.slice(iw), upM = mir.slice(0, mir.length - iw);
    o += pl(upM.concat(upH), C.ink, 1.0, 'none', '3 3');
  } else o += pg(mir.concat(half), C.ink, C.fill, 1.8);
  const X = x => cx + x * sc, Y = y => cy - y * sc;
  o += `<line x1="${f2(X(-s.waistW - 0.15))}" y1="${f2(Y(s.waistY))}" x2="${f2(X(s.waistW + 0.15))}" y2="${f2(Y(s.waistY))}" stroke="${C.waist}" stroke-width="0.8" stroke-dasharray="5 3"/>\n`;
  if (mode === 'hull') {
    o += `<circle cx="${f2(X(s.botW))}" cy="${f2(Y(s.chineY))}" r="2.6" fill="${C.chine}"/><circle cx="${f2(X(-s.botW))}" cy="${f2(Y(s.chineY))}" r="2.6" fill="${C.chine}"/>\n`;
    o += `<circle cx="${f2(X(0))}" cy="${f2(Y(s.botY))}" r="2.6" fill="${C.keel}"/>\n`;
    if (!opts.noLabels) {
      o += tx(X(s.botW) + 8, Y(s.chineY) + 4, `chine (keel corner) · β ${s.beta.toFixed(0)}°`, 10, C.chine);
      o += tx(X(0) + 6, Y(s.botY) + 14, 'keel (centre column)', 10, C.keel);
    }
  } else if (!opts.noLabels) {
    o += `<circle cx="${f2(X(s.botW))}" cy="${f2(Y(s.botY))}" r="2.6" fill="${C.ink}"/>\n`;
    o += tx(X(s.botW) + 8, Y(s.botY) + 4, 'keel corner (lower longeron)', 10, C.ink);
  }
  if (!opts.noLabels) o += tx(X(s.waistW) + 8, Y(s.waistY) - 3, mode === 'hull' ? 'waist = gunwale' : 'waist', 10, C.waist);
  return { svg: o, s };
}

// the water-stability device, front view (a half-span schematic: body section at the step + the device)
function stabFront(fam, cx, cy, sc) {
  const s = sectionAt(fam, fam.boat.hullStepZ - 1e-3, 'hull');
  const X = x => cx + x * sc, Y = y => cy - y * sc;
  let o = '';
  const half = s.pts.map(p => [X(p[0]), Y(p[1])]), mir = s.pts.slice().reverse().map(p => [X(-p[0]), Y(p[1])]);
  o += pg(mir.concat(half), C.ink, C.fill, 1.4);
  const semi = 5.2, st = fam.stab;
  const wl = s.botY + 0.62 * (s.chineY - s.botY) + 0.10;
  let wingY = s.topY - 0.05, root = s.waistW * 0.6;
  if (st === 'wingRoot') { wingY = s.chineY + 0.12; root = s.waistW; }
  // the wing (both sides)
  const tipDroop = st === 'drooped' ? 0.55 : 0;
  for (const sd of [-1, 1]) {
    const pts = [[X(sd * root), Y(wingY)], [X(sd * (semi - 0.5)), Y(wingY + 0.25)]];
    if (tipDroop) pts.push([X(sd * (semi - 0.1)), Y(wingY + 0.25 - tipDroop * 0.6)], [X(sd * semi), Y(wingY + 0.25 - tipDroop)]);
    else pts.push([X(sd * semi), Y(wingY + 0.27)]);
    o += pl(pts, C.ink, 3.2);
    if (tipDroop) { const tp = pts[pts.length - 1]; o += `<ellipse cx="${f2(tp[0])}" cy="${f2(tp[1])}" rx="${f2(0.16 * sc)}" ry="${f2(0.12 * sc)}" fill="${C.stab}" opacity="0.85"/>\n`; }
    if (st === 'tipFloat') {
      const fx = X(sd * semi * 0.85), fy = Y(wl + 0.12);
      o += `<line x1="${f2(fx)}" y1="${f2(Y(wingY + 0.25 * 0.85))}" x2="${f2(fx)}" y2="${f2(fy)}" stroke="${C.ink}" stroke-width="1.6"/>\n`;
      o += pg([[fx - 0.18 * sc, fy], [fx + 0.18 * sc, fy], [fx + 0.12 * sc, fy + 0.18 * sc], [fx, fy + 0.24 * sc], [fx - 0.12 * sc, fy + 0.18 * sc]], C.stab, C.stab);
    }
    if (st === 'sponson') {
      const y0 = s.chineY + 0.10, sp = 0.95;
      o += pg([[X(sd * s.botW * 0.95), Y(y0 + 0.22)], [X(sd * (s.botW + sp)), Y(y0 + 0.10)], [X(sd * (s.botW + sp)), Y(y0 + 0.02)], [X(sd * s.botW * 1.02), Y(y0 - 0.02)]], C.stab, C.stab);
    }
    if (st === 'hydrofin') {
      const y0 = s.chineY - 0.02;
      o += pl([[X(sd * s.botW), Y(y0 + 0.05)], [X(sd * (s.botW + 0.8)), Y(y0 - 0.06)]], C.stab, 4);
    }
    if (st === 'outrigger') {
      const fx = X(sd * 1.55), fy = Y(wl + 0.10);
      o += pl([[X(sd * root), Y(wingY)], [fx, Y(wingY + 0.06)]], C.ink, 3.2);
      o += `<line x1="${f2(fx)}" y1="${f2(Y(wingY + 0.06))}" x2="${f2(fx)}" y2="${f2(fy)}" stroke="${C.ink}" stroke-width="1.6"/>\n`;
      o += pg([[fx - 0.20 * sc, fy], [fx + 0.20 * sc, fy], [fx + 0.14 * sc, fy + 0.22 * sc], [fx, fy + 0.30 * sc], [fx - 0.14 * sc, fy + 0.22 * sc]], C.stab, C.stab);
    }
  }
  if (st === 'wingRoot') {
    for (const sd of [-1, 1]) o += pg([[X(sd * s.waistW * 0.95), Y(wingY + 0.04)], [X(sd * 1.6), Y(wingY + 0.12)], [X(sd * 1.6), Y(wingY + 0.04)], [X(sd * s.waistW * 0.95), Y(wingY - 0.06)]], C.stab, C.stab);
  }
  o += `<line x1="${f2(X(-semi - 0.2))}" y1="${f2(Y(wl))}" x2="${f2(X(semi + 0.2))}" y2="${f2(Y(wl))}" stroke="${C.water}" stroke-width="1" stroke-dasharray="8 4"/>\n`;
  return o;
}

function legend(x, y, hull) {
  let o = '', k = 0;
  const item = (col, s, dash) => { o += `<line x1="${x}" y1="${y + k * 15}" x2="${x + 22}" y2="${y + k * 15}" stroke="${col}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ''}/>` + tx(x + 28, y + k * 15 + 4, s, 10); k++; };
  item(C.keel, hull ? 'keel line (botY: the lowest point, both modes)' : 'keel line (botY)');
  if (hull) item(C.chine, 'chine (the keel corners, raised by botW·tan β)');
  item(C.waist, hull ? 'waist = gunwale / sheer' : 'waist', '5 3');
  if (hull) item(C.water, 'waterline (sketch)', '8 4');
  return o;
}

function rowsBlock(x, y, fam, w) {
  const B = fam.boat, S = fam.shared;
  const lines = [
    `boat rows: β ${B.hullBeta}° (bow ${B.hullBetaBow}°, aft ${B.hullBetaA}°) · step ${B.hullStepZ} m · depth ${B.hullHs} m` +
      (B.hullSteps === 2 ? ` · rear step ${B.hullStep2Z} m / ${B.hullHs2} m` : ''),
    `rail ${B.hullRail} m · pad ${B.hullPad} m · shared: botRound ${S.botRound} · crKeel ${S.crKeel} · topRound ${S.topRound}` +
      (S.boomStyle === 1 ? ' · Rod & pod' : '') + (S.covering === 'tub' ? ' · skin to the waist' : ''),
    `stability: ${STAB[fam.stab].name}`,
  ];
  return lines.map((s, i) => tx(x, y + i * 14, s, 10)).join('');
}

function familySheet(fam) {
  const W = 1100, H = 470;
  let o = '';
  o += tx(14, 40, 'like: ' + fam.refs, 11);
  o += tx(30, 66, 'SIDE PROFILE (nose left)', 10, C.ink);
  o += sideProfile(fam, 'hull', 40, 270, 82);
  o += legend(40, 330, true);
  o += rowsBlock(40, 405, fam);
  o += tx(800, 66, fam.boat.hullSteps > 0 ? 'SECTION AT THE STEP (looking aft)' : 'SECTION AT THE REFERENCE STATION', 10, C.ink);
  o += sectionView(fam, 'hull', fam.boat.hullStepZ - 1e-3, 880, 270, 125, { noLabels: false }).svg;
  o += tx(560, 330, 'FRONT VIEW (water stability: ' + STAB[fam.stab].name + ')', 10, C.ink);
  o += stabFront(fam, 700, 425, 17);
  return svgDoc(W, H, o, fam.name);
}

// THE SAME CAGE VALUES, twice: hullOn 0 and hullOn 1 (the user's rule made visible)
function sameValuesSheet() {
  const fam = FAMILIES[0];
  const W = 1100, H = 640;
  let o = '';
  o += tx(14, 40, 'One set of frame rows (the classic family\'s), drawn with the hull switch OFF (top) and ON (bottom). ' +
          'Only the boat rows differ: deadrise, step, rail.', 11);
  o += tx(30, 70, 'hullOn 0 · normal fuselage (flat belly between the keel corners)', 11, C.ink);
  o += sideProfile(fam, 'normal', 40, 255, 82, { noWater: true });
  o += sectionView(fam, 'normal', fam.boat.hullStepZ - 1e-3, 870, 225, 130).svg;
  o += tx(30, 360, 'hullOn 1 · boat hull (the same rows; the keel corners became the chine, the step is a ring pair)', 11, C.ink);
  o += sideProfile(fam, 'hull', 40, 555, 82, { noLabels: true });
  o += sectionView(fam, 'hull', fam.boat.hullStepZ - 1e-3, 870, 525, 130).svg;
  o += legend(40, 600, true).replace(/<line/g, '<line').slice(0);
  return svgDoc(W, H, o, 'The same cage values: normal fuselage vs boat hull');
}

// THE STABILITY OPTIONS on one sheet (front views)
function stabSheet() {
  const W = 1100, H = 520;
  let o = '';
  const keys = ['tipFloat', 'sponson', 'wingRoot', 'drooped', 'hydrofin', 'outrigger'];
  keys.forEach((k, i) => {
    const fam = Object.assign(clone(FAMILIES[0]), { stab: k });
    const cx = 190 + (i % 3) * 360, cy = 200 + Math.floor(i / 3) * 230;
    o += tx(cx, cy - 120, STAB[k].name, 12, C.ink, 'middle');
    o += tx(cx, cy - 104, Object.entries(STAB[k].rows).map(([a, b]) => a + ' ' + b).join(' · '), 9, C.note, 'middle');
    o += stabFront(fam, cx, cy, 30);
  });
  return svgDoc(W, H, o, 'Water stability: one discriminator, six options (front views at the step)');
}

if (process.argv.includes('--table')) {
  console.log('| family | refs | boat rows | shared rows it also writes | stability |');
  console.log('|---|---|---|---|---|');
  for (const f of FAMILIES) {
    const B = f.boat, S = f.shared;
    console.log(`| ${f.name} | ${f.refs} | β ${B.hullBeta}/${B.hullBetaBow}/${B.hullBetaA}°, step depth ${B.hullHs} m` +
      (B.hullSteps === 2 ? `, 2nd step ${B.hullHs2} m` : '') + `, rail ${B.hullRail} m, pad ${B.hullPad} m | botRound ${S.botRound}, crKeel ${S.crKeel}, topRound ${S.topRound}` +
      (S.boomStyle === 1 ? ', boomStyle 1 (Rod & pod)' : '') + (S.covering === 'tub' ? ', covering: to the waist' : '') + ` | ${STAB[f.stab].name} |`);
  }
} else {
  for (const f of FAMILIES) fs.writeFileSync(path.join(OUT, `family_${f.key}.svg`), familySheet(f));
  fs.writeFileSync(path.join(OUT, 'same_values_normal_vs_hull.svg'), sameValuesSheet());
  fs.writeFileSync(path.join(OUT, 'water_stability.svg'), stabSheet());
  console.log('wrote', FAMILIES.length + 2, 'sheets to', OUT);
}
module.exports = { FAMILIES, STAB, sectionAt };
