// G1824-G1827 (DMG-DRIVE): the drivetrain's scenarios, flown on the user's validated builds (tools/_treecrash_lib.js BUILDS),
// node only. Shared by the probe (tools/dmg_drive_probe.js: what the drivetrain does) and GATE DMGDRIVE
// (tools/_dmg_drive_check.js: each real number as a check against the sim):
//   dive(key, o)      the aeroplane held at a true airspeed (a dive: the flight path pushed down until the speed is reached,
//                     then held on the path angle), at a throttle or with the engine off; the shaft speed, the tip Mach, the
//                     drivetrain's state over the run
//   noseOver(key, o)  settled on its wheels, then turned nose-down about the main axle so the propeller's disc (or the nose,
//                     on a build whose disc clears) meets the ground with the nose falling at `V` m/s
//   trunkStrike(key, o) a trunk on the thrust line at `V` m/s (taxied below 12 m/s, flown 4 m up above), TREE-CRASH's rig
//   mountLoads(key)   the engine mount's members (D1a's 'mount' group: the bearer and its fittings) under the probe at full
//                     power tied down, a flown 3.8 g pull at full power, a snap-roll entry, a hard landing
// Each returns what the sim did: out.rpm / out.rpmEng, sim.damage() and, where the core has it, sim.damage().drive.
'use strict';
const L = require('./_treecrash_lib.js');

const finite = L.finite;
const R2D = 180 / Math.PI;
// the speed of sound in the sim's air (out.oatC)
const aSound = sim => Math.sqrt(1.4 * 287.05 * ((sim.out.oatC != null ? sim.out.oatC : 15) + 273.15));
// a drive state the base core does not have reads as none
const driveOf = (sim, k) => { const D = sim.damage && sim.damage(); return D && D.drive ? D.drive[k || 0] : null; };
// the mount's members (the 'mount' break groups, D1a) and the engine's own body (both ends on ENG / CGE)
function mountBeams(def) {
  const out = [], G = (def.parts && def.parts.dmg && def.parts.dmg.groups) || [];
  G.forEach((g, gi) => { if (/mount$/.test(g.key)) for (const j of g.t0.concat(g.t1)) out.push({ bi: j, grp: g.key }); });
  return out;
}
const tagOf = (def, bi) => def.nodes[def.beams[bi].a].tag + '-' + def.nodes[def.beams[bi].b].tag;
const clearPeak = sim => { const P = sim.damagePeak && sim.damagePeak(); if (P) { P.t.fill(0); P.c.fill(0); if (P.cl) P.cl.fill(0); if (P.tw) P.tw.fill(0); } };

// ---- THE DIVE -----------------------------------------------------------------------------------------------------
// From level flight at `V0` (default 1.3 V_S) 1500 m up: the path angle is driven by a PI on the speed error toward `V`
// (pushing over to as much as 70 deg down), the elevator by a PI on the load factor the path's turn asks for. `thr` the
// throttle (0 = idle), `off` the engine's key off (windmilling). Held `hold` s once within 1 % of V.
function dive(key, o) {
  const C = L.core(), def = L.defOf(key, o), { W, strip } = L.flatWorld(0);
  const sim = C.makeSim(def, W); sim.reset(0); L.lastRun.sim = sim;
  const g = def.params.gen, V0 = o.V0 || Math.max(1.3 * g.Vs, 30), Vt = o.V;
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: o.alt || 2500 }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V0 * fx; sim.v[i*3+1] = 0; sim.v[i*3+2] = V0 * fz; }
  if (o.off && sim.setEngine) for (let k = 0; k < sim.eng.length; k++) sim.setEngine(k, { key: 'off' });
  sim.ctl.thr = o.thr == null ? 1 : o.thr;
  const sgn = o.sgn || 1;      // a positive elevator raises nz on these builds (measured: de +0.3 at 40 m/s -> 2.9 g)
  // the attitude flown: a pitch angle asked by the speed loop, held by the elevator on the pitch error and the pitch rate
  // (a stiff, damped attitude hold - a load-factor loop rang at 1 Hz on the light tails)
  let Ith = 0, held = 0, reached = null, t = 0, thPrev = null, Iv = null, Vp = null, thC = null, accF = null;
  const rec = { rpmMax: 0, rpmEngMax: 0, VMax: 0, nzMax: -9, nzMin: 9, tipMach: 0, hist: [] };
  for (let f = 0; f < 60 * (o.secs || 90); f++) {
    const v = sim.cgVel(), V = sim.out.V || Math.hypot(v[0], v[1], v[2]);
    const gam = Math.asin(Math.max(-1, Math.min(1, v[1] / (Math.hypot(v[0], v[1], v[2]) || 1))));
    const th = -Math.asin(Math.max(-1, Math.min(1, sim.axes()[0][1])));   // nose-up positive (x is aft)
    const q = thPrev == null ? 0 : (th - thPrev) * 60; thPrev = th;
    const e = Vt - V;
    // the speed loop, on the energy: the acceleration asked (0.4 /s x the speed error, at most 3 m/s2) against the one
    // measured gives the path angle that would deliver it (sin g' = sin g + (a - a*) / g), flown as an attitude (the
    // path plus the present angle of attack), the nose at most 60 deg down, the attitude asked slewed at 0.3 rad/s
    const acc = Vp == null ? 0 : (V - Vp) * 60; Vp = V;
    accF = accF == null ? acc : accF + (acc - accF) * 0.1;
    const aD = Math.max(-3, Math.min(3, 0.4 * e));
    const sg = Math.max(-0.87, Math.min(0.35, Math.sin(gam) + (accF - aD) / 9.81));
    const thT = Math.asin(sg) + (th - gam);
    thC = thC == null ? th : thC + Math.max(-0.3 / 60, Math.min(0.3 / 60, thT - thC));
    Ith = Math.max(-0.5, Math.min(0.5, Ith + 1.0 * Math.max(0.12, Math.min(1, (40 / Math.max(V, 1)) ** 2)) * (thC - th) / 60));
    // (the gains scheduled on the dynamic pressure: the elevator's authority grows as V^2 - unscheduled the attitude loop
    // rang at V_D on the slick builds)
    const gk = Math.max(0.12, Math.min(1, (40 / Math.max(V, 1)) ** 2));
    sim.ctl.de = Math.max(-1, Math.min(1, sgn * gk * (0.9 * (thC - th) - 0.35 * q) + Ith));
    sim.ctl.da = 0; sim.ctl.dr = 0;
    sim.step(1 / 60); t += 1 / 60;
    if (!finite(sim)) { rec.bad = true; break; }
    if (sim.cgPos()[1] < 300) { rec.low = true; break; }   // (the ground near: the run is over, not a crash)
    if (!reached && Math.abs(V - Vt) < 0.01 * Vt) reached = t;
    if (reached) {
      held += 1 / 60;
      const n = (sim.out.rpm[0] || 0) / 60, a = aSound(sim), D = (def.params.prop || {}).D || 1.8;
      rec.rpmMax = Math.max(rec.rpmMax, sim.out.rpm[0] || 0); rec.rpmEngMax = Math.max(rec.rpmEngMax, sim.out.rpmEng[0] || 0);
      rec.tipMach = Math.max(rec.tipMach, Math.hypot(Math.PI * D * n, V) / a);
      rec.VMax = Math.max(rec.VMax, V); rec.nzMax = Math.max(rec.nzMax, sim.out.nz); rec.nzMin = Math.min(rec.nzMin, sim.out.nz);
      if (held >= (o.hold || 10)) break;
    }
    if (f % 30 === 0) rec.hist.push([+t.toFixed(2), +V.toFixed(1), +(gam * R2D).toFixed(1), Math.round(sim.out.rpmEng[0] || 0), +sim.out.nz.toFixed(2)]);
  }
  const D = sim.damage ? sim.damage() : null;
  return Object.assign(rec, { V: Vt, reached, held, sim, def, finite: finite(sim), alt: sim.cgPos()[1],
    running: sim.eng.map(e => e.running), seized: sim.eng.map(e => !!e.seized), drive: D && D.drive ? JSON.parse(JSON.stringify(D.drive)) : null,
    yields: D ? D.yields : 0, breaks: D ? D.breaks : 0, crashed: D ? D.crashed : false });
}

// ---- THE NOSE-OVER ------------------------------------------------------------------------------------------------
// Settled on its wheels (a floatplane on the sea lane), then the whole aeroplane turned nose-down about the line through
// its main contacts until the lowest of the propeller's disc and the nose's nodes is `gap` m over the surface, and set
// rotating about that line so that point falls at `V` m/s - the moment a taildragger trips over its mains, or a nosewheel
// folds. The engine running at `thr` (default 0.2: a taxi). Flown `secs` s.
function noseOver(key, o) {
  const C = L.core(), def = L.defOf(key, o);
  let W, strip, sim;
  const probe = C.makeSim(def, null);
  if (probe.hydro) { W = C.makeWorld(); strip = W.aerodromes.find(a => a.id === 'SEA'); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, strip); }
  else { ({ W, strip } = L.flatWorld(0)); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 })); }
  L.lastRun.sim = sim;
  sim.ctl.thr = 0;
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  sim.ctl.thr = o.thr == null ? 0.2 : o.thr;
  const n = sim.n, p = sim.p, v = sim.v, [xA, yU, zR] = sim.axes();
  const surf = (x, z) => { const t = W.terrainH(x, z), w = W.waterH ? W.waterH(x, z) : -1e9; return Math.max(t, w > -1e8 ? w : -1e9); };
  // the pivot: the main contacts (the floats' lowest nodes ahead of the CG, else the mains)
  const mains = def.refs.mains && def.refs.mains.length ? def.refs.mains : [];
  let px = 0, py = 0, pz = 0;
  if (mains.length && !sim.hydro) { for (const i of mains) { px += p[i*3]; py += p[i*3+1] - def.nodes[i].r; pz += p[i*3+2]; } px /= mains.length; py /= mains.length; pz /= mains.length; }
  else { const c = sim.cgPos(); let yl = Infinity; for (let i = 0; i < n; i++) yl = Math.min(yl, p[i*3+1] - def.nodes[i].r); px = c[0]; py = yl; pz = c[2]; }
  // the disc's lowest point (hub = the engine's thrust nodes' mean; the disc normal to the body's x) and the nose's nodes
  const D = (def.params.prop || {}).D || 1.8, Rp = D / 2;
  const low = () => {
    const ax = sim.axes()[0]; let hx = 0, hy = 0, hz = 0; const E = def.refs.engine || [];
    for (const i of E) { hx += p[i*3]; hy += p[i*3+1]; hz += p[i*3+2]; } hx /= E.length; hy /= E.length; hz /= E.length;
    let dx = -ax[0] * -ax[1], dy = -1 + ax[1] * ax[1], dz = -ax[2] * -ax[1]; const dl = Math.hypot(dx, dy, dz) || 1;
    const lx = hx + Rp * dx / dl, ly = hy + Rp * dy / dl, lz = hz + Rp * dz / dl;
    let best = ly - surf(lx, lz), at = 'disc';
    for (const i of (def.refs.noseFrame || []).concat(def.refs.engine || [])) { const c = p[i*3+1] - def.nodes[i].r - surf(p[i*3], p[i*3+2]); if (c < best) { best = c; at = 'nose'; } }
    return { gap: best, at, hubY: hy };
  };
  const k = zR, rot = th => { const cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) { const d = [p[i*3] - px, p[i*3+1] - py, p[i*3+2] - pz], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
      const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
      for (let j = 0; j < 3; j++) p[i*3+j] = [px, py, pz][j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs); } };
  // nose-down about +z (right): a negative angle about zR lowers the nose (x aft: genCertDrop's convention)
  const gap0 = o.gap == null ? 0.03 : o.gap; let th = 0, gp = low(), it = 0;
  const step = -0.2 * Math.PI / 180;
  while (gp.gap > gap0 && it++ < 900) { rot(step); th += step; gp = low(); }
  // G2367 (DMG-BUNDLE-GREEN): A TRICYCLE NOSES OVER ON A FOLDED NOSE LEG. Pitched about its mains until its disc is
  // `gap` off, a tricycle's nose wheel is IN the ground (the metal Cessna at its drawn thrustline: 0.148 m, the leg then
  // throws the nose back up and its disc never bites the turf at 2 m/s) - a certified tricycle keeps its disc clear with
  // the nose strut bottomed and its tyre flat (FAR 23.925(a), as recalled): its prop meets the ground only once the nose
  // leg has gone. So the leg is folded as a break folds a member (its members slack: k, c 0) and the wheel left on the
  // ground under the nose. A taildragger (its third wheel aft) is untouched. (The old metal Cessna's disc sat lower than
  // its nose wheel, 2.4 cm in the ground at rest: the rig never met the leg)
  const twN = def.refs.tw;
  // (a fall only: the brush row lifts the nose off the turf at 0.3 m/s on its leg)
  if (o.foldNose !== false && o.V > 0 && twN != null && mains.length && !sim.hydro) {
    let mx = 0; for (const i of mains) mx += def.nodes[i].p[0]; mx /= mains.length;
    if (def.nodes[twN].p[0] < mx) {
      for (const b of sim.beams) if ((b.a === twN || b.b === twN) && !b.broken) { b.kB = b.k; b.cB = b.c; b.k = 0; b.c = 0; b.broken = true; }
      const g = surf(p[twN*3], p[twN*3+2]) + def.nodes[twN].r; if (p[twN*3+1] < g) p[twN*3+1] = g;
    }
  }
  // the angular rate that drops the lowest point at V: omega = V / (its horizontal arm from the pivot)
  const E = def.refs.engine || []; let hx = 0; for (const i of E) hx += p[i*3]; hx /= E.length;
  const arm = Math.max(0.3, Math.abs((hx - px) * xA[0] + 0) + Math.abs(hx - px) * 0) || 1;
  const armH = Math.hypot(hx - px, 0) || 1;
  const w = -o.V / Math.max(0.3, armH + Rp * 0);
  for (let i = 0; i < n; i++) { const rx = p[i*3] - px, ry = p[i*3+1] - py, rz = p[i*3+2] - pz;
    // v = w k x r
    v[i*3] = w * (k[1]*rz - k[2]*ry); v[i*3+1] = w * (k[2]*rx - k[0]*rz); v[i*3+2] = w * (k[0]*ry - k[1]*rx); }
  clearPeak(sim);
  const rpm0 = sim.out.rpm.slice(), pitch0 = th * R2D;
  // (times from the start of the fall: the disc's first touch, the strike the sim registered; the disc's deepest bite)
  let strikeT = null, discT = null, bite = 0;
  const tl = [], t0 = sim.t;
  for (let f = 0; f < 60 * (o.secs || 2); f++) {
    sim.step(1 / 60);
    if (o.onFrame) o.onFrame(sim, f);              // G2357 (DMG-SCAR): a gate's per-frame reader (the ground's contacts)
    const Dm = sim.damage(), lw = low();
    if (strikeT === null && Dm.propStrike) strikeT = sim.t - t0;
    if (discT === null && lw.gap < 0) discT = sim.t - t0;
    bite = Math.max(bite, -lw.gap);
    if (f % 6 === 0) tl.push([+(sim.t - t0).toFixed(2), +lw.gap.toFixed(3), Math.round(sim.out.rpm[0] || 0), sim.eng[0].running ? 1 : 0]);
  }
  const Dm = sim.damage();
  return { V: o.V, pitch0, at: gp.at, strikeT, discT, bite, R: Rp, rpm0, rpm: sim.out.rpm.slice(), running: sim.eng.map(e => e.running), seized: sim.eng.map(e => !!e.seized),
    propStrike: Dm.propStrike, propAt: Dm.propAt, drive: Dm.drive ? JSON.parse(JSON.stringify(Dm.drive)) : null, yields: Dm.yields, breaks: Dm.breaks,
    groups: (Dm.groups || []).map(G => G.key), crashed: Dm.crashed, reason: Dm.reason, gPeak: Dm.gPeak, finite: finite(sim), tl, sim, def };
}

// ---- A FLOATPLANE'S NOSE-IN (the water's nose-over: the bow digs in) - A0's WATER CASE (TREE-CRASH waterCase): 0.3 m over
// the sea lane at `V` m/s along its heading, sinking `sink`, pitched `pitch` deg nose-down, the engine at `thr`
function noseIn(key, o) {
  const r = L.waterCase(key, Object.assign({ V: o.V, sink: o.sink, pitch: o.pitch, secs: o.secs || 3, onStart: sim => { sim.ctl.thr = o.thr == null ? 0.2 : o.thr; } }, o.cert ? { cert: true } : {}));
  const sim = L.lastRun.sim, Dm = sim.damage();
  return { V: o.V, sink: o.sink, pitch: o.pitch, propStrike: Dm.propStrike, propAt: Dm.propAt, running: sim.eng.map(e => e.running), seized: sim.eng.map(e => !!e.seized),
    drive: Dm.drive ? JSON.parse(JSON.stringify(Dm.drive)) : null, groups: (Dm.groups || []).map(G => G.key), breaks: Dm.breaks, crashed: Dm.crashed, reason: Dm.reason,
    gPeak: Dm.gPeak, finite: r.finite };
}

// ---- A TRUNK IN THE DISC ------------------------------------------------------------------------------------------
// TREE-CRASH's rig (atTrunk): a 0.3 m trunk on the centreline (or `off` m across) `Dist` m ahead; below 12 m/s taxied on
// the wheels at the throttle `thr`, above it flown 4 m up at full throttle (the disc at the trunk's height either way)
function trunkStrike(key, o) {
  const C = L.core(), d0 = L.defOf(key), hydro = !!(d0.parts && d0.parts.floats), V = o.V, flown = V >= 12;
  // a floatplane does not taxi on land: its trunk rows are flown only (the analytic world's trunks stand on land)
  if (hydro && !flown) return { V, na: 'a floatplane on land' };
  // the trunk on the thrust line of the first engine (a twin's are on the wings: on the centreline the trunk meets the cabin)
  const E = d0.refs.engine || [], EO = d0.refs.engineOf || E.map(() => 0); let ez = 0, c = 0;
  E.forEach((i, j) => { if ((EO[j] | 0) === 0) { ez += d0.nodes[i].p[2]; c++; } }); ez = c ? ez / c : 0;
  if (o.off == null && Math.abs(ez) > 0.3) o = Object.assign({}, o, { off: -ez });
  // G2035 (DMG-DRIVE2): `across` m to the left of the engine's line (a trunk in the disc clear of the spinner: on the
  // centreline at 3 m/s the spinner and the hub take the taxi before the blades reach the trunk)
  if (o.across) o = Object.assign({}, o, { off: (o.off || 0) + o.across });
  const r = L.atTrunk(key, Object.assign({ D: o.Dist || (flown ? 8 : 4), V, off: o.off || 0, thr: o.thr == null ? (flown ? 1 : 0.3) : o.thr, secs: o.secs || 3, agl: flown ? 4 : 0,
    trunk: o.trunk }, o.elastic ? { elastic: true } : {}, o.cert ? { cert: true } : {}));
  const sim = r.sim, Dm = sim.damage();
  return { V, flown, propStrike: Dm.propStrike, propAt: Dm.propAt, running: sim.eng.map(e => e.running), seized: sim.eng.map(e => !!e.seized),
    drive: Dm.drive ? JSON.parse(JSON.stringify(Dm.drive)) : null, groups: (Dm.groups || []).map(G => G.key), breaks: Dm.breaks, crashed: Dm.crashed,
    reason: Dm.reason, gPeak: Dm.gPeak, finite: r.finite, sim, def: r.def };
}

// ---- A TRUNK IN THE DISC, TIED DOWN (the separation and the gearbox rows): settled on its wheels on the flat (a floatplane
// too: its floats on the grass), brakes on, the throttle run up to `thr` over 1 s and held 2 s, then a trunk set `fwd` m
// ahead of engine `eng`'s hub (G2035: by default just past the disc's band - see below) with its circle reaching `bite` m into the disc from the side (bite >= R: through the hub)
// and the run held `secs` s: the strike's tier, the engine, the imbalance, the mount
function tipStrike(key, o) {
  const C = L.core(), def = L.defOf(key, o), elev = 0, { W, TH, strip } = L.flatWorld(elev);
  const sim = C.makeSim(def, W); sim.reset(0); L.lastRun.sim = sim;
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev }));
  sim.ctl.brake = 1;
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  for (let f = 0; f < 180; f++) { sim.ctl.thr = Math.min(1, f / 60) * (o.thr == null ? 1 : o.thr); sim.step(1 / 60); }
  const k = o.eng || 0, E = def.refs.engine || [], EO = def.refs.engineOf || E.map(() => 0);
  let hx = 0, hy = 0, hz = 0, c = 0; E.forEach((i, j) => { if ((EO[j] | 0) === k) { hx += sim.p[i*3]; hy += sim.p[i*3+1]; hz += sim.p[i*3+2]; c++; } }); hx /= c; hy /= c; hz /= c;
  const ax = sim.axes(), fx = -ax[0][0], fz = -ax[0][2], fl = Math.hypot(fx, fz), ux = fx / fl, uz = fz / fl, R = (def.params.prop || {}).D / 2, rt = 0.15;
  // G2035 (DMG-DRIVE2): the disc is the hub's band (0..hub ahead of the thrust nodes) - the trunk stood 0.3 m ahead, which only
  // the old 1 m band reached; now by default half its radius past the band's front, its chord there reaching `bite` into the
  // disc (ahead of the wing: a trunk through the leading edge pushed the twin's disc 8 mm further in within five frames)
  const hub = C.genDriveSpec(def).hub, fw = o.fwd == null ? hub + rt / 2 : o.fwd, e = Math.max(0, fw - hub), hc = e < rt ? Math.sqrt(rt * rt - e * e) : 0;
  const lat = Math.max(0, R + hc - o.bite);
  // to the aeroplane's left of the hub (away from the cabin on the twin's left engine: -z is its side)
  // G2367 (DMG-BUNDLE-GREEN): the side is the hub's own, ACROSS THE HEADING from the CG - the world z's sign times a
  // perpendicular that turns with the heading put the twin's trunk INBOARD on the game's strip (z -0.58, the hub's
  // -1.65): into the pod's side, which then shoved the left nacelle 1 cm into its disc and an idle brush (0.031 R)
  // read as a stoppage (0.040 R). A nose engine (on the centreline) keeps the aeroplane's left as before
  const pxv = -uz, pzv = ux, cg = sim.cgPos(), off = (hx - cg[0]) * pxv + (hz - cg[2]) * pzv;
  const sd = off < -0.3 ? -1 : (off > 0.3 ? 1 : -1), lx = pxv * sd, lz = pzv * sd;
  TH.set('fill:test', [hx + ux * fw + lx * lat, hz + uz * fw + lz * lat, elev - 0.5, rt, elev + 10]);
  const t0 = sim.t, before = sim.out.rpm.slice();
  let mountAt = null, imbMax = 0, failAt = null, peakEng = 0;
  const MB = mountBeams(def);
  // G2367 (DMG-BUNDLE-GREEN): the engine LEAVES when its mount's group breaks - or, on DMG-MOUNTRIG's ring, when every
  // member from its own nodes (ENG / CGE) to anything else is broken: the eight isolators tear before the twelve bearers
  // (the group) go, the ring staying on the firewall (the metal Cessna's full-power graze: all eight at 7 ms)
  const engOwn = i => /^(ENG|CGE)/.test(def.nodes[i].tag || '');
  const tie = []; def.beams.forEach((b, bi) => { if (engOwn(b.a) !== engOwn(b.b)) tie.push(bi); });
  for (let f = 0; f < 60 * (o.secs || 4); f++) {
    sim.step(1 / 60);
    const Dm = sim.damage(), st = Dm.drive ? Dm.drive[k] : null;
    if (st) { imbMax = Math.max(imbMax, st.imbN || 0); if (st.failed && failAt == null) failAt = sim.t - t0; }
    peakEng = Math.max(peakEng, sim.out.rpmEng[k] || 0);
    if (mountAt == null && ((Dm.groups || []).some(G => /mount$/.test(G.key)) || (tie.length && tie.every(bi => sim.beams[bi].broken)))) mountAt = sim.t - t0;
    if (!finite(sim)) break;
  }
  const Dm = sim.damage();
  return { bite: o.bite, R, thr: o.thr == null ? 1 : o.thr, rpm0: before[k], drive: Dm.drive ? JSON.parse(JSON.stringify(Dm.drive)) : null, imbMax, mountAt, failAt, peakEng,
    groups: (Dm.groups || []).map(G => G.key), running: sim.eng.map(e => e.running), seized: sim.eng.map(e => !!e.seized), crashed: Dm.crashed, reason: Dm.reason, finite: finite(sim), sim, def };
}

// ---- THE MOUNT'S MEMBERS UNDER LOAD (the probe: every member's peak force over its yield, per substep) -------------
function mountPeak(sim, def) {
  const P = sim.damagePeak(), MB = mountBeams(def);
  let mx = 0, at = null;
  for (const m of MB) for (const [s, v] of [['t', P.t[m.bi]], ['c', P.c[m.bi]]]) if (v > mx) { mx = v; at = { tag: tagOf(def, m.bi), s, grp: m.grp }; }
  // the engine's own body (the crankcase stand-ins) apart
  let eb = 0; def.beams.forEach((b, bi) => { const e = i => /^(ENG|CGE)/.test(def.nodes[i].tag || ''); if (e(b.a) && e(b.b)) eb = Math.max(eb, P.t[bi], P.c[bi]); });
  return { max: mx, at, body: eb };
}
// the snap-roll entry: at V_A, the elevator full up, the rudder and the aileron full (one way), held `secs` s - the yaw
// and pitch rates the rig reaches (rad/s) and the mount's peak
function snapRoll(key, o) {
  const C = L.core(), def = L.defOf(key, Object.assign({ probe: true }, o)), { W, strip } = L.flatWorld(0);
  const sim = C.makeSim(def, W); sim.reset(0); L.lastRun.sim = sim;
  const VS = C.genCertSpeeds(def), V = o.V || VS.VA;
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 800 }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+1] = 0; sim.v[i*3+2] = V * fz; }
  sim.ctl.thr = 1;
  for (let f = 0; f < 30; f++) sim.step(1 / 60);
  clearPeak(sim);
  let wMax = [0, 0, 0], nzMax = 0;
  let ax0 = sim.axes().map(a => a.slice());
  for (let f = 0; f < 60 * (o.secs || 2); f++) {
    sim.ctl.de = -1; sim.ctl.dr = 1; sim.ctl.da = 1;
    sim.step(1 / 60);
    const ax = sim.axes();
    // body rates from the axes' change (x aft, y up, z right): roll about x, yaw about y, pitch about z
    const d = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const dx = d(ax[0], ax0[0]), dy = d(ax[1], ax0[1]);
    const wy = dot(dx, ax[2]) * 60, wz = dot(dx, ax[1]) * -60, wx = dot(dy, ax[2]) * -60;
    wMax = [Math.max(wMax[0], Math.abs(wx)), Math.max(wMax[1], Math.abs(wy)), Math.max(wMax[2], Math.abs(wz))];
    nzMax = Math.max(nzMax, sim.out.nz);
    ax0 = ax.map(a => a.slice());
  }
  return { V, wMax, nzMax, mount: mountPeak(sim, def), finite: finite(sim) };
}
function mountLoads(key, o) {
  o = o || {};
  const C = L.core(), out = {};
  // full power tied down (brakes on, 6 s)
  {
    const def = L.defOf(key, Object.assign({ probe: true }, o)), probe0 = C.makeSim(def, null);
    let W, strip, sim;
    if (probe0.hydro) { W = C.makeWorld(); strip = W.aerodromes.find(a => a.id === 'SEA'); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, strip); }
    else { ({ W, strip } = L.flatWorld(0)); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 })); }
    for (let f = 0; f < 240; f++) sim.step(1 / 60);
    clearPeak(sim); sim.ctl.thr = 1; sim.ctl.brake = 1;
    for (let f = 0; f < 360; f++) { if (probe0.hydro) { for (let i = 0; i < sim.n; i++) { sim.v[i*3] *= 0.9; sim.v[i*3+2] *= 0.9; } } sim.step(1 / 60); }
    out.fullPower = mountPeak(sim, def);
  }
  // a flown 3.8 g pull at full power
  // (at 1.3 V_A, the elevator's measured sense: + is nose-up on these builds - TREE-CRASH's pull at 45 m/s with its -1
  // reached 1.1-1.9 g on four of the five)
  { const def = L.defOf(key, Object.assign({ probe: true }, o)), VA = C.genCertSpeeds(def).VA;
    const r = L.pull(key, Object.assign({ probe: true, nz: 3.8, V: 1.3 * VA, sgn: 1 }, o)); out.pull = Object.assign(mountPeak(L.lastRun.sim, def), { nz: r.nzMax, V: 1.3 * VA }); }
  // the snap-roll entry
  { const r = snapRoll(key, o); out.snap = Object.assign(r.mount, { wMax: r.wMax, nzMax: r.nzMax, V: r.V }); }
  // a hard landing: FAR 23.473's limit sink, and 1.5 x it
  for (const [nm, kk] of [['land473', 1], ['land473x15', 1.5]]) {
    const sink = L.far473(key) * kk, r = L.hardLanding(key, Object.assign({ probe: true, sink }, o));
    out[nm] = Object.assign(mountPeak(L.lastRun.sim, L.defOf(key, Object.assign({ probe: true }, o))), { sink, nz: r.gMax });
  }
  return out;
}

module.exports = { dive, noseOver, noseIn, tipStrike, trunkStrike, mountLoads, snapRoll, mountBeams, mountPeak, driveOf, aSound, tagOf };
