// ============================================================
// THE DESIGN AIDS (DESIGN-AIDS, the user 3 Nov: "I think we miss helpers in the garage. CG and neutral point are good,
// but maybe we could have center of lift, thrust vector, something to help with floats dimensioning and positioning?
// ... What would have helped me further getting it stable and good?").
//
// genDesignAids(def, bal, opts) -> the numbers the garage's aids draw AND the rows the certificate reads, from the BUILT
// aeroplane (def: the lattice, its strips, its floats, its prop) and its balance (bal: { cgX, npX, cBar } - the
// garage's balance job, LAST_BAL, or the shakedown). One function, two readers (app.js buildIndicators draws it,
// bench.js's certificate judges it), so the picture and the verdict can never disagree (WYSIWYG). Pure and cheap: no
// sim is stepped and no probe is flown - geometry, the ledger's masses and moments, and the float's own hull tables
// (32_hydro levelVolume) - so the garage asks for it on a release like the CG posts and a hidden aid asks nothing.
//
// FRAME: the design frame of def.nodes (x aft, y up, z left; metres). Every point the viewer draws is in it; the
// viewer maps it onto the posed lattice by the mains (app.js aidsToWorld).
//
// WHAT IT MEASURES (each one a published rule of thumb where there is one, named in its row):
//   lift     each lifting surface's aerodynamic centre (the area-weighted quarter chord of its strips - the point the
//            solver applies their lift at) and its area, for the lift arrows (sized by surface)
//   thrust   each propeller's axis through the disc, the static thrust (the def's own prop row), its offset from the
//            CG and the pitching moment at full power (nose-up +), as a share of the elevator at the approach
//   floats   the step against the CG (the step 10-15 deg aft of the vertical through the CG: the floatplane rule the
//            frame's own H1 rule solves to 12), the waterline at gross (the pair's level displacement = the mass),
//            the buoyancy reserve (FAR 23.751: 80 % over the gross -> 1.8; usual 1.8-2.5), the floats' length against
//            the fuselage (the rule: ~0.75-0.9 of it on a single; here the bow ahead of the prop and the CG inside the
//            planing bottom), the spacing (track), and the prop's clearance over the water at gross
//   range    the CG over the four loading corners (solo / every seat x full fuel / reserves), from the ledger's
//            payload rows moved seat by seat - the same corners genShakedown's envelope rebuilds (GATE AIDS holds the
//            two within 3 % of the chord on the validated builds)
//   tails    the horizontal and vertical tail volumes against the design check's own thresholds and Raymer's typical
//   prop     each disc's clearance to the ground (wheels) or the water (floats, at gross) and to the structure: the
//            wing's trailing edge WITH THE FLAPS DOWN (the travel and the Fowler's slide, 60_gen_spec), the stab
//   stance   on wheels: the tip-back / nose-over angle (the line from the main contact to the CG against the
//            vertical: a tricycle 15-25 deg, a taildragger's mains 12-25 deg ahead) and the nose wheel's share (8-20 %)
// and THE ROWS (the design check's row shape + `tier`) - see GEN_CERT_TIER in 64b_gen_design.js for the split.
// ============================================================

const GEN_AIDS = {
  personKg: 80,             // a seat's occupant when the ledger cannot say (the cabin ledger's own mass / occupants)
  stepDeg: [8, 16, 12],     // the step aft of the CG's vertical: low, high, the target (H1's 12; the rule 10-15). Measured
                            // (the bench's hydroplane run): the user's twin at -3 deg sat 31 deg nose-up afloat and reared
                            // to 89 (abort); at 2 deg (_4b) 5 deg nose-up afloat, off in 22 s; at 12 deg level, off in 22-27 s
  reserve: [1.8, 3.0],      // FAR 23.751 (80 % reserve) and the advisor's oversized edge (32_hydro floatAdvice)
  propWater: 0.30,          // m of disc over the water at gross, the spray band (spray rises ~0.3 m off the bow wave)
  propGround: 0.18,         // m: FAR 23.925(a)(1) - 7 in (0.18 m) on a tricycle, 9 in a taildragger: the smaller
  propStruct: 0.05,         // m: a disc to the structure (FAR 23.925(c): 1 in radial; 0.05 m axial is the cert's)
  tipBack: [15, 25],        // deg: a tricycle's main contact behind the CG
  noseShare: [0.08, 0.20],  // the nose wheel's share of the weight
  tailDragger: [12, 25],    // deg: a taildragger's mains ahead of the CG (genShakedown noseOver)
  Vh: [0.30, 0.50], Vv: [0.020, 0.040],   // the design check's warn edges and Raymer's homebuilt typical
};

// the strips' force point (their quarter chord, by their node weights) - the solver's own application point
function genAidStripPt(def, st) {
  let x = 0, y = 0, z = 0, ws = 0;
  for (const [i, w] of st.w) { const p = def.nodes[i].p; x += p[0] * w; y += p[1] * w; z += p[2] * w; ws += w; }
  return ws > 0 ? [x / ws, y / ws, z / ws] : [0, 0, 0];
}
function genAidNodeCG(def) {
  let m = 0, x = 0, y = 0, z = 0;
  for (const n of def.nodes) { m += n.m; x += n.p[0] * n.m; y += n.p[1] * n.m; z += n.p[2] * n.m; }
  return m > 0 ? [x / m, y / m, z / m, m] : [0, 0, 0, 0];
}

// THE LOADING CORNERS, by moving the ledger's payload: empty = every non-payload row; the occupants at the first N
// seats (the corner's rule, G180); the fuel scaled from its row (its moment arm kept: the tank does not move)
function genAidCorners(def) {
  const S = def.spec, L = def.parts && def.parts.ledger;
  if (!L || !S || !S.cabin) return null;
  let me = 0, mxe = 0;
  for (const k in L) { const e = L[k]; if (!e || e.payload || !(e.mass > 0)) continue; if (e.mx == null) return null; me += e.mass; mxe += e.mx; }
  if (!(me > 0)) return null;
  const cab = L.cabin || { mass: 0, mx: 0 }, fu = L.fuel || { mass: 0, mx: 0 }, cg0 = L.cargo || { mass: 0, mx: 0 };
  const occ = Array.isArray(S.cabin.occupied) ? S.cabin.occupied.filter(Boolean).length : Math.max(1, S.occupants | 0);
  const pk = occ > 0 && cab.mass > 0 ? cab.mass / occ : GEN_AIDS.personKg;
  const seatsX = Array.isArray(S.cabin.seatsX) && S.cabin.seatsX.length ? S.cabin.seatsX.slice()
    : [occ > 0 && cab.mass > 0 ? cab.mx / cab.mass : (S.cabin.seatX || 0)];
  const seats = Math.max(1, Math.min(seatsX.length, Math.max(1, S.seats | 0)));
  const litres = S.fuel && S.fuel.litres > 0 ? S.fuel.litres : 0;
  const res = litres > 10 ? Math.max(4, 0.15 * litres) / litres : 1;
  const xf = fu.mass > 0 ? fu.mx / fu.mass : 0;
  // the drawn fuel is full (a saved build's tanks are its capacity); a battery does not burn
  const battery = S.energy && S.energy.kind === 'battery';
  const corner = (label, n, k) => {
    let m = me + cg0.mass, mx = mxe + cg0.mx;
    for (let i = 0; i < n; i++) { m += pk; mx += pk * seatsX[i]; }
    const f = battery ? 1 : k; m += fu.mass * f; mx += fu.mass * f * xf;
    return { label, occupants: n, fuel: f, mass: m, cgX: mx / m };
  };
  const C = [corner('solo · full fuel', 1, 1), corner('solo · reserves', 1, res),
             corner('full cabin · full fuel', seats, 1), corner('full cabin · reserves', seats, res)];
  let fwd = C[0], aft = C[0];
  for (const c of C) { if (c.cgX < fwd.cgX) fwd = c; if (c.cgX > aft.cgX) aft = c; }
  return { corners: C, fwd, aft, emptyKg: me, personKg: pk, seats };
}

// the waterline over the step keel (m) where the pair displaces the mass, level trim (32_hydro levelVolume: the same
// sections the physics loft reads); null when the pair cannot carry it to the deck
function genAidWaterline(F, massKg, rho) {
  if (typeof HYDRO === 'undefined' || !HYDRO || !HYDRO.levelVolume) return null;
  const need = massKg / (2 * rho);
  const H = (F.P.H || 0.5) * 1.6;
  if (HYDRO.levelVolume(F, H, 160) < need) return null;
  let lo = 0, hi = H;
  for (let i = 0; i < 22; i++) { const m = 0.5 * (lo + hi); if (HYDRO.levelVolume(F, m, 160) < need) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}

function genDesignAids(def, bal, opts) {
  const o = opts || {};
  const S = def.spec || {}, P = def.parts || {};
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const ncg = genAidNodeCG(def);
  const M = ncg[3];
  // the CG: the lattice's, in the design frame every other point here is in (the balance's cgX is read off a sim at its
  // reset attitude - a float build sits ~4 deg nose-up there, 5 cm of x at the CG's height); the neutral point: the
  // balance's offset from ITS CG (the garage's live answer / the sheet), carried onto this one
  const cgX = ncg[0];
  const cBar = bal && bal.cBar > 0 ? bal.cBar : ((def.params.gen || {}).cBar || 1);
  const npX = bal && isFinite(bal.npX) && isFinite(bal.cgX) ? cgX + (bal.npX - bal.cgX) : null;
  const cg = [cgX, ncg[1], 0];
  const out = { frame: 'design', cg, npX, cBar, mass: M, rows: [] };
  const row = r => out.rows.push(Object.assign({ level: 'pass', unit: '', fix: '' }, r));

  // ---- LIFT: the aerodynamic centre of each surface, its area ------------------------------------------------
  {
    const by = {};
    for (const st of def.strips) {
      if (st.kind !== 'wing' && st.kind !== 'stab') continue;
      const k = st.kind + (st.kind === 'wing' && st.plane ? st.plane : '');
      const p = genAidStripPt(def, st), a = st.area || 0;
      const b = by[k] || (by[k] = { kind: st.kind, plane: st.plane || 0, area: 0, x: 0, y: 0 });
      b.area += a; b.x += a * p[0]; b.y += a * p[1];
    }
    let tot = 0;
    out.lift = Object.keys(by).map(k => { const b = by[k]; tot += b.area; return { kind: b.kind, plane: b.plane, area: b.area, x: b.x / b.area, y: b.y / b.area }; });
    for (const l of out.lift) l.share = tot > 0 ? l.area / tot : 0;
  }

  // ---- THRUST: each disc's axis and its pitch moment about the CG ---------------------------------------------
  {
    const pr = def.params.prop || {};
    const T = pr.Tstatic || 0, R = S.propR || (pr.D || 1.8) / 2;
    const at = Array.isArray(S.engAt) && S.engAt.length ? S.engAt : [{ x: S.engX, y: S.engY, z: 0, mount: 'nose' }];
    const g = def.params.gen || {};
    const Vs = g.Vs || 20, Vc = def.params.ap && def.params.ap.VCruise || 2 * Vs;
    const Mde = g.plant && g.plant.Mde > 0 ? g.plant.Mde * Math.pow(1.3 * Vs / Vc, 2) : null;   // the elevator at 1.3 Vs
    // THE DRAWN DISC: the engine station (engAt) is the mount's; the blade plane stands ahead of it (a tractor) or
    // behind (a pusher) by the engine's length and the spinner - the editor's own measure (CAGE_ENG.units: each unit's
    // mount point and its prop hub, the join's frame), handed in as opts.propOff [[dx, dy] per unit, design frame]
    const PO = Array.isArray(o.propOff) ? o.propOff : null;
    out.thrust = at.map((e0, i) => {
      const off = PO && PO[i] ? PO[i] : null;
      const e = off ? Object.assign({}, e0, { x: e0.x + off[0], y: e0.y + off[1] }) : e0;
      const dy = e.y - cg[1];
      // thrust forward (-x): about the CG the moment's nose-up part is -dy * T (a line above the CG pitches nose-down)
      const Mup = -dy * T;
      return { at: [e.x, e.y, e.z || 0], dir: [-1, 0, 0], T, R, mount: e.mount || 'nose', dy, Mup, drawn: !!off,
               elev: Mde ? Math.abs(Mup) / Mde : null };
    });
    const sumM = out.thrust.reduce((s, t) => s + t.Mup, 0), share = Mde ? Math.abs(sumM) / Mde : null;
    const t0 = out.thrust[0];
    if (t0 && T > 0) {
      const lvl = share != null && share > 0.5 ? 'warn' : 'pass';
      row({ id: 'aid.thrust', group: 'power', tier: 'comm', label: 'Thrust line against the CG',
            value: r2(t0.dy), unit: 'm ' + (t0.dy >= 0 ? 'above' : 'below'), level: lvl,
            limit: 'the full-power pitch change under half the elevator at 1.3 Vs (warn above): the pilot must out-trim it on a go-around',
            why: 'the thrust line ' + Math.abs(r2(t0.dy)) + ' m ' + (t0.dy >= 0 ? 'above' : 'below') + ' the CG: full power pitches the nose ' +
                 (sumM >= 0 ? 'UP' : 'DOWN') + ' ' + Math.round(Math.abs(sumM)) + ' N m' + (share != null ? ' (' + Math.round(share * 100) + ' % of the elevator at 1.3 Vs)' : ''),
            fix: lvl === 'pass' ? '' : 'bring the thrust line nearer the CG: the engine ' + r2(Math.abs(t0.dy) * (1 - 0.5 / share)) + ' m ' +
                 (t0.dy >= 0 ? 'lower' : 'higher') + ', or more elevator' });
    }
  }

  // ---- THE LOADING CORNERS (the CG range) --------------------------------------------------------------------
  const env = genAidCorners(def);
  if (env) {
    const sm = x => npX != null ? (npX - x) / cBar : null;
    out.range = { fwdX: env.fwd.cgX, aftX: env.aft.cgX, fwd: env.fwd, aft: env.aft, corners: env.corners,
                  smFwd: sm(env.fwd.cgX), smAft: sm(env.aft.cgX), drawnX: cgX, emptyKg: env.emptyKg };
    // the corners' CG moves with the drawn one: the ledger's empty CG and the sheet's differ by the lattice's
    // re-gauging; the range is held to the drawn loading's own offset
    const corr = cgX - genAidCorners.drawnOf(def, env);
    if (isFinite(corr)) { out.range.fwdX += corr; out.range.aftX += corr;
      for (const c of out.range.corners) c.cgX += corr;
      out.range.smFwd = sm(out.range.fwdX); out.range.smAft = sm(out.range.aftX); }
    if (npX != null) {
      const B = typeof GEN_MARGIN_BANDS !== 'undefined' ? GEN_MARGIN_BANDS : { unstable: 0, comfy: 0.05, noseHeavy: 0.40 };
      const a = out.range.smAft, f = out.range.smFwd;
      const worstC = out.range.corners.reduce((w, c) => (c.cgX > w.cgX ? c : w), out.range.corners[0]);
      // a red corner (unstable) fails the commercial certificate; an orange one (under 5 %, or nose-heavy) is its note
      const lvl = a < B.unstable ? 'fail' : (a < B.comfy || f > B.noseHeavy) ? 'warn' : 'pass';
      row({ id: 'aid.range', group: 'balance', tier: 'comm', label: 'CG over every loading (seats x fuel)',
            value: r3(a), unit: 'MAC at the aft corner', level: lvl,
            limit: 'every corner (solo / every seat, full fuel / reserves) on the garage\'s CG colours: red (fail) under ' + B.unstable + '; orange (a note) under ' + B.comfy + ' or over ' + B.noseHeavy + '; green between',
            why: 'the CG runs ' + r2(out.range.fwdX) + ' .. ' + r2(out.range.aftX) + ' m (' + Math.round((out.range.aftX - out.range.fwdX) / cBar * 100) +
                 ' % of the chord): margin ' + Math.round(f * 100) + ' % (' + out.range.fwd.label + ') to ' + Math.round(a * 100) + ' % (' + worstC.label + ')',
            fix: lvl === 'pass' ? '' : a < B.comfy ? 'the aft corner (' + worstC.label + ') needs ' + r2((B.comfy - a) * cBar) +
                 ' m more margin: seats or tank nearer the CG, or the remedies of the static margin'
                 : 'the forward corner is nose-heavy: ' + r2((f - 0.25) * cBar) + ' m of CG aft' });
    }
  }

  // ---- TAIL VOLUMES -------------------------------------------------------------------------------------------
  {
    const t = S.tail, gm = S.geom;
    if (t && gm && gm.Sw > 0) {
      out.tails = { Vh: t.Sh > 0 ? t.Sh * t.lh / (gm.Sw * gm.cBar) : null, Vv: t.Sv > 0 ? t.Sv * t.lv / (gm.Sw * (gm.span || 1)) : null,
                    VhTyp: GEN_AIDS.Vh, VvTyp: GEN_AIDS.Vv };
      const ac = (out.lift || []).filter(l => l.kind === 'stab')[0];
      out.tails.at = ac ? [ac.x, ac.y, 0] : null;
    }
  }

  // ---- FLOATS ---------------------------------------------------------------------------------------------------
  const FL = P.floats;
  if (FL && FL.length && typeof HYDRO !== 'undefined' && HYDRO && HYDRO.makeFloat) {
    const rec = FL[0], FP = rec.P;
    const keel = def.nodes[rec.tetra[0]].p;               // the step keel (the float frame's origin)
    const stepX = keel[0], keelY = keel[1];
    const F = HYDRO.makeFloat(Object.assign({}, FP, { mLoad: 0, cgLoad: [0, 0, 0], loadI: [0, 0, 0] }));
    const rho = FP.rho || 1000;
    const pairKg = 2 * F.volDeck * rho, reserve = pairKg / Math.max(1, M);
    const hw = genAidWaterline(F, M, rho);
    const D = GEN_AIDS.stepDeg, h = Math.max(0.3, cg[1] - keelY);
    const ang = Math.atan2(stepX - cgX, h) * 180 / Math.PI;   // + = the step aft of the CG's vertical
    // the move that puts the step at the target, the floats' own mass walking with it (the H1 rule's fixpoint)
    let mF = 0;   // the float nodes' mass
    for (const n of def.nodes) if (n.tag === 'FLK' || n.tag === 'FLD') mF += n.m;
    const want = cgX + Math.tan(D[2] * Math.PI / 180) * h;
    const move = (want - stepX) / Math.max(0.2, 1 - mF / Math.max(1, M));
    const L = FP.L, track = 2 * Math.abs(keel[2]);
    const bowX = stepX - FP.xs, sternX = stepX + (L - FP.xs);
    const fusL = (S.fuselage && S.fuselage.len) || (def.params.gen && def.params.gen.drag && def.params.gen.drag.L) || null;
    const wl = hw != null ? keelY + hw : null;
    // the scale that brings the reserve to 1.8 (the hull scales as k^3 in volume)
    const kNeed = reserve < GEN_AIDS.reserve[0] ? Math.cbrt(GEN_AIDS.reserve[0] / Math.max(0.05, reserve)) : 1;
    out.floats = { stepX, keelY, z: Math.abs(keel[2]), ang, want: D, moveX: move, L, B: FP.B, H: FP.H, track, bowX, sternX,
                   waterY: wl, draft: hw, pairKg, reserve, fusL, mFloats: mF, scaleNeed: kNeed };
    const lvlS = ang < 0 ? 'fail' : (ang < D[0] || ang > D[1]) ? 'warn' : 'pass';
    row({ id: 'aid.step', group: 'water', tier: 'safe', label: 'Float step against the CG',
          value: r2(ang), unit: 'deg aft of the CG', level: lvlS,
          limit: 'the step ' + D[0] + '-' + D[1] + ' deg aft of the vertical through the CG (the floatplane rule 10-15; the frame solves 12); ahead of it the tail sinks and the aeroplane rears on the water',
          why: ang < 0 ? 'the step is ' + r2(cgX - stepX) + ' m AHEAD of the CG (' + r2(-ang) + ' deg): afloat and on the step the tail goes down and the nose rears'
                       : 'the step is ' + r2(stepX - cgX) + ' m aft of the CG (' + r2(ang) + ' deg)' + (ang < D[0] ? ': barely - afloat it sits nose-up' : ang > D[1] ? ': far - the bow is heavy on the water' : ''),
          fix: lvlS === 'pass' ? '' : 'move the floats ' + (move >= 0 ? 'aft ' : 'forward ') + r2(Math.abs(move)) + ' m (the step to ' + D[2] + ' deg)' });
    const lvlR = reserve < GEN_AIDS.reserve[0] ? 'fail' : reserve > GEN_AIDS.reserve[1] ? 'warn' : 'pass';
    row({ id: 'aid.reserve', group: 'water', tier: 'safe', label: 'Float buoyancy reserve',
          value: r2(reserve), unit: 'x gross', level: lvlR,
          limit: 'the pair displaces ' + GEN_AIDS.reserve[0] + ' x the gross to the deck (FAR 23.751: an 80 % reserve; usual 1.8-2.5); over ' + GEN_AIDS.reserve[1] + ' oversized',
          why: 'the pair displaces ' + Math.round(pairKg) + ' kg for ' + Math.round(M) + ' kg (' + r2(reserve) + ' x)' + (hw != null ? '; at gross it floats ' + r2(hw) + ' m deep of ' + r2(FP.H) + ' m' : '; at gross it sinks to the deck'),
          fix: lvlR === 'fail' ? 'floats ' + Math.round((1 - reserve / GEN_AIDS.reserve[0]) * 100) + ' % too small: scale them ' + Math.round((kNeed - 1) * 100) + ' % (length, beam and depth), or ' + Math.round(pairKg / GEN_AIDS.reserve[0] > 0 ? M - pairKg / GEN_AIDS.reserve[0] : 0) + ' kg lighter'
             : lvlR === 'warn' ? 'smaller floats would carry it: ' + Math.round((1 - Math.cbrt(2.2 / reserve)) * 100) + ' % smaller (weight and drag back)' : '' });
  }

  // ---- PROPELLER CLEARANCE -------------------------------------------------------------------------------------
  {
    const pr = out.thrust || [];
    const flapK = (S.controls && S.controls.flap && S.controls.flap.type) || 'none';
    const ftab = typeof GEN_FLAPS !== 'undefined' ? GEN_FLAPS[flapK] || {} : {};
    const fDeg = typeof GEN_FLAP_TRAVEL !== 'undefined' && GEN_FLAP_TRAVEL[flapK] != null ? GEN_FLAP_TRAVEL[flapK] : 40;
    const fc = (S.controls && S.controls.flap && S.controls.flap.chord) || 0.2;
    const ground = def.nodes.reduce((m, n) => Math.min(m, n.p[1] - (n.r || 0)), Infinity);
    out.prop = pr.map(t => {
      const R = t.R, c0 = t.at;
      const o2 = { at: c0, R, ground: null, groundLevel: null, water: null, struct: null, who: null, flapsDown: false, hit: null, drawn: t.drawn };
      if (!(FL && FL.length)) {
        // on its wheels: a tricycle sits level (the taxi attitude); a taildragger on its three points - the disc's
        // lowest point rotated about the main contact by the deck angle - and its level (tail-up) figure beside it
        o2.groundLevel = c0[1] - R - ground;
        o2.ground = o2.groundLevel;
        const nM = P.GAL != null && P.GAL >= 0 ? def.nodes[P.GAL] : null, tw = P.TW != null && P.TW >= 0 ? def.nodes[P.TW] : null;
        if (nM && tw && tw.p[0] > nM.p[0]) {
          const xM = nM.p[0], yM = nM.p[1] - (nM.r || 0);
          const th = Math.atan2((tw.p[1] - (tw.r || 0)) - yM, tw.p[0] - xM);
          o2.deckDeg = th * 180 / Math.PI;
          o2.ground = (yM + (c0[1] - yM) * Math.cos(th) - (c0[0] - xM) * Math.sin(th)) - R - yM;
        }
      }
      else if (out.floats && out.floats.waterY != null) o2.water = c0[1] - R - out.floats.waterY;
      if (!t.drawn) return o2;          // the structure: only against the disc the editor drew
      // the structure in the disc's swept circle: each wing / stab strip's trailing edge (flaps down where it has one)
      // and its leading edge, the gap ALONG the axis from the disc's plane
      let best = Infinity;
      for (const st of def.strips) {
        if (st.kind !== 'wing' && st.kind !== 'stab') continue;
        const q = genAidStripPt(def, st), c = st.chord || 1;
        const pts = [['LE', [q[0] - 0.25 * c, q[1], q[2]]], ['TE', [q[0] + 0.75 * c, q[1], q[2]]]];
        if (st.kind === 'wing' && st.flap && flapK !== 'none') {
          const d = fDeg * Math.PI / 180, hx = q[0] + (0.75 - fc) * c, fcl = fc * c;
          const sl = (ftab.slide || 0) * fcl, dr = (ftab.drop || 0) * fcl;
          pts.push(['flap', [hx + sl + fcl * Math.cos(d), q[1] - dr - fcl * Math.sin(d), q[2]]]);
        }
        for (const [nm, p] of pts) {
          const rad = Math.hypot(p[1] - c0[1], p[2] - c0[2]);
          if (rad > R) continue;
          const gap = Math.abs(p[0] - c0[0]);
          if (gap < best) { best = gap; o2.who = st.kind === 'stab' ? 'the stabiliser' : nm === 'flap' ? 'the flap, down ' + fDeg + ' deg' : nm === 'TE' ? 'the wing\'s trailing edge' : 'the wing\'s leading edge'; o2.flapsDown = nm === 'flap'; o2.hit = p; }
        }
      }
      o2.struct = isFinite(best) ? best : null;
      return o2;
    });
    const p0 = out.prop[0];
    if (p0) {
      const gV = p0.ground != null ? p0.ground : p0.water, gLim = p0.ground != null ? GEN_AIDS.propGround : GEN_AIDS.propWater;
      let lvlG = gV == null ? 'pass' : gV < 0 ? 'fail' : gV < gLim ? 'warn' : 'pass';
      // a taildragger lifted level (the tail-up run, FAR 23.925's 'level' attitude) is a warning, never more: how far
      // the tail is raised is the pilot's
      if (lvlG === 'pass' && p0.deckDeg != null && p0.groundLevel != null && p0.groundLevel < GEN_AIDS.propGround) lvlG = 'warn';
      const lvlS = p0.struct == null ? 'pass' : p0.struct < GEN_AIDS.propStruct ? 'fail' : p0.struct < 2 * GEN_AIDS.propStruct ? 'warn' : 'pass';
      const cm = v => Math.round(v * 100) + ' cm';
      const lvl = lvlG === 'fail' || lvlS === 'fail' ? 'fail' : lvlG === 'warn' || lvlS === 'warn' ? 'warn' : 'pass';
      const parts = [];
      if (gV != null) parts.push(r2(gV) + ' m over the ' + (p0.ground != null ? 'ground' + (p0.deckDeg != null ? ' on its three points (' + r2(p0.groundLevel) + ' m tail up, level)' : '') : 'water at gross'));
      if (p0.struct != null) parts.push(r2(p0.struct) + ' m from ' + p0.who);
      row({ id: 'aid.prop', group: 'power', tier: 'safe', label: 'Propeller clearance (ground / water / structure, flaps down)',
            value: r2(Math.min(gV != null ? gV : 9, p0.struct != null ? p0.struct : 9)), unit: 'm', level: lvl,
            limit: 'the disc ' + GEN_AIDS.propGround + ' m over the ground (FAR 23.925), ' + GEN_AIDS.propWater + ' m over the water at gross (the spray), ' +
                   GEN_AIDS.propStruct + ' m from any structure in its circle, the flaps fully down (warn under ' + 2 * GEN_AIDS.propStruct + ' m: the blades flex, the mount and the wing move)',
            why: (parts.length ? 'the disc is ' + parts.join(', ') : 'nothing in the disc\'s circle') + (p0.drawn ? '' : ' (the structure is measured against the drawn disc: the editor\'s)'),
            fix: lvl === 'pass' ? '' : (lvlS !== 'pass' ? 'the disc ' + cm(2 * GEN_AIDS.propStruct - p0.struct + 0.005) + ' further from ' + p0.who + ' (the engine aft, a smaller disc, or shorter flaps)' : '') +
                 (lvlS !== 'pass' && lvlG !== 'pass' ? '; ' : '') + (lvlG !== 'pass' ? 'raise the disc ' + cm(gLim - Math.min(gV, p0.groundLevel != null ? p0.groundLevel : gV) + 0.005) + ' (or a smaller propeller, or longer legs)' : '') });
    }
  }

  // ---- GROUND STANCE (wheels) --------------------------------------------------------------------------------
  if (!(FL && FL.length) && P.GAL != null && P.GAL >= 0) {
    const nM = def.nodes[P.GAL], yG = nM.p[1] - (nM.r || 0);
    const xM = nM.p[0], h = Math.max(0.2, cg[1] - yG);
    const tw = P.TW != null && P.TW >= 0 ? def.nodes[P.TW] : null;
    const trike = !!(tw && tw.p[0] < xM);
    const ang = Math.atan2(trike ? xM - cgX : cgX - xM, h) * 180 / Math.PI;   // + = the right side of the CG
    const share = tw ? (trike ? (xM - cgX) / Math.max(0.1, xM - tw.p[0]) : (xM - cgX) / Math.max(0.1, xM - tw.p[0])) : null;
    out.stance = { trike, mainX: xM, groundY: yG, tailX: tw ? tw.p[0] : null, ang, share: share != null ? Math.abs(share) : null,
                   want: trike ? GEN_AIDS.tipBack : GEN_AIDS.tailDragger };
    const W = out.stance.want, sh2 = out.stance.share;
    const lvl = ang < 0 ? 'fail' : (ang < W[0] || ang > W[1]) ? 'warn'
      : trike && sh2 != null && (sh2 < GEN_AIDS.noseShare[0] || sh2 > GEN_AIDS.noseShare[1]) ? 'warn' : 'pass';
    const moveM = Math.tan(W[0] * Math.PI / 180) * h - (trike ? xM - cgX : cgX - xM);
    row({ id: 'aid.stance', group: 'ground', tier: 'comm', label: trike ? 'Ground stance: tip-back angle and nose wheel share' : 'Ground stance: the mains ahead of the CG',
          value: r2(ang), unit: 'deg', level: lvl,
          limit: trike ? 'the mains ' + W[0] + '-' + W[1] + ' deg behind the CG\'s vertical (it sits on its tail when loaded aft under ' + W[0] + '), the nose wheel ' + Math.round(GEN_AIDS.noseShare[0] * 100) + '-' + Math.round(GEN_AIDS.noseShare[1] * 100) + ' % of the weight'
                       : 'the mains ' + W[0] + '-' + W[1] + ' deg ahead of the CG\'s vertical (nose-over under ' + W[0] + ', a heavy tail over ' + W[1] + ')',
          why: (trike ? 'tip-back ' : 'the mains ') + r2(ang) + ' deg' + (sh2 != null && trike ? ', nose wheel ' + Math.round(sh2 * 100) + ' %' : ''),
          fix: lvl === 'pass' ? '' : ang < W[0] ? 'the mains ' + r2(Math.abs(moveM)) + ' m ' + (trike ? 'aft' : 'forward') : ang > W[1] ? 'the mains a little ' + (trike ? 'forward' : 'aft') : 'the mains ' + (sh2 < GEN_AIDS.noseShare[0] ? 'forward' : 'aft') + ' to share the weight' });
  }
  return out;
}
// the drawn loading's CG by the same ledger arithmetic (the corners' reference)
genAidCorners.drawnOf = (def, env) => {
  const L = def.parts.ledger; let m = 0, mx = 0;
  for (const k in L) { const e = L[k]; if (!e || !(e.mass > 0) || e.mx == null) continue; m += e.mass; mx += e.mx; }
  return m > 0 ? mx / m : NaN;
};

// ============================================================
// THE KEY ISSUES (DESIGN-AIDS part 2; the user: "a failed certification should be crystal clear on what fails and what
// to do, without the need of scrolling through its full report. Only a number of key issues with remedial
// suggestions"). genKeyIssues(def, sh, aids, opts) -> [{ id, tier, level, title, what, remedy, row }] - the 3-5 rows
// that matter most, worst first (a safe-to-fly fail, then a safe-to-fly warning - a PROPOSED safe check is a warning
// until the user rules -, then the commercial tier's), each in plain words with its number and limit, and its remedy
// SIZED FROM THE MODEL: for the pitch rows the aeroplane is REBUILT with the wing 0.1 m aft and with the stabiliser
// 10 % bigger (buildGen + the shakedown's own two-probe neutral point, genAidBalance), and the margin's slope on each
// lever gives the move that reaches the garage's green (GEN_MARGIN_BANDS.comfy); the CG lever is the arithmetic of the
// ledger. The other rows carry their own sized fix (the design check's and the aids'). opts.spec: the spec to nudge
// (the joined one the page builds from; def.spec by default); opts.levers === false skips the rebuilds; opts.lv: the
// levers measured elsewhere (the bench's thread: bench_worker.js 'levers', genAidLevers there).
// ============================================================
function genAidBalance(def) {
  const sim = makeSim(def, null);
  sim.reset(0);
  const W = sim.totalM * 9.81, V = def.params.ap.VCruise;
  const a = genAlphaForLift(sim, V, W, 0.85 * genStallAngle(def));
  const r0 = genProbeAt(sim, V, a), r1 = genProbeAt(sim, V, a + 0.02);
  const np = -((r1.pitchUp - r0.pitchUp) / 0.02) / Math.max(1e-6, (r1.Fy - r0.Fy) / 0.02);
  const g = def.params.gen || {};
  const cBar = g.cBar || 1;
  return { cgX: r0.cg[0], npX: r0.cg[0] + np, sm: np / cBar, cBar, mass: sim.totalM };
}
function genAidLevers(def, sh, spec) {
  const base = spec || def.spec;
  const S0 = JSON.parse(JSON.stringify(base));
  const at = mut => { const S = JSON.parse(JSON.stringify(S0)); mut(S); try { return genAidBalance(buildGen(S)); } catch (e) { return null; } };
  const b0 = at(() => {});
  const w = at(S => { for (const wg of S.wings || []) if (wg && typeof wg.xLE === 'number') wg.xLE += 0.1; });
  // the stabiliser 10 % bigger: its area and, where the join measured them, its span and chord (the strips are built off
  // those - the area alone would leave the drawn tail as it was)
  const t = at(S => { const T = S.tail; if (!T) return; const k = Math.sqrt(1.1);
    if (T.Sh > 0) T.Sh *= 1.1; if (T.hSpan > 0) T.hSpan *= k; if (T.hChord > 0) T.hChord *= k; });
  if (!b0) return null;
  return { base: b0, wingPerM: w ? (w.sm - b0.sm) / 0.1 : null, stabPer10: t ? t.sm - b0.sm : null,
           cgPerM: -1 / b0.cBar, mass: b0.mass };
}
function genKeyIssues(def, sh, aids, opts) {
  const o = opts || {};
  const r2 = v => Math.round(v * 100) / 100;
  const rows = [].concat((sh && sh.design && sh.design.rows) || [], (aids && aids.rows) || [])
    .map(r => Object.assign({}, r, { tier: r.tier || genCertTierOf(r.id) }));
  // the static margin row speaks for the short period ("see the static margin"): one issue
  const bad = rows.filter(r => r.level !== 'pass');
  const keep = bad.filter(r => !(r.id === 'pitch.short' && bad.some(x => x.id === 'pitch.sm')));
  const rank = r => (r.tier === 'safe' ? 0 : 4) + (r.level === 'fail' ? (r.proposed ? 1 : 0) : 2);
  keep.sort((a, b) => rank(a) - rank(b));
  // the margin's levers, measured once, when a pitch row is among the issues
  let LV = null;
  const pitchIds = ['pitch.sm', 'aid.range', 'pitch.short'];
  const B = typeof GEN_MARGIN_BANDS !== 'undefined' ? GEN_MARGIN_BANDS : { comfy: 0.05 };
  const out = [];
  for (const r of keep) {
    if (out.length >= (o.max || 5)) break;
    let remedy = r.fix || '';
    const isPitch = pitchIds.indexOf(r.id) >= 0 && (sh || aids);
    if (isPitch && (o.lv || o.levers !== false)) {
      if (!LV) LV = o.lv || genAidLevers(def, sh, o.spec) || {};
      const smNow = r.id === 'aid.range' && aids && aids.range ? aids.range.smAft
        : r.id === 'pitch.sm' && typeof r.value === 'number' ? r.value
        : sh && isFinite(sh.staticMargin) ? sh.staticMargin : null;
      if (smNow != null && smNow < B.comfy) {
        const need = B.comfy - smNow, opt = [];
        if (LV.wingPerM > 0.01) { const d = need / LV.wingPerM; opt.push('move the wing aft ~' + r2(d) + ' m'); }
        if (LV.stabPer10 > 0.001) { const pc = Math.round(need / LV.stabPer10 * 10); opt.push(pc <= 150 ? 'grow the stabiliser ~' + pc + ' %' : 'the stabiliser alone cannot (it would take +' + pc + ' %)'); }
        if (LV.mass > 0 && LV.cgPerM) { const kgm = need / -LV.cgPerM * LV.mass; opt.push('move ~' + Math.round(kgm / 2) + ' kg forward 2 m (or ' + r2(need * (aids ? aids.cBar : 1)) + ' m of CG)'); }
        if (opt.length) remedy = opt.join(', or ') + ' - to a margin of ' + Math.round(B.comfy * 100) + ' %';
      }
    }
    // the margin rows in the plain words the posts use (genMarginBand: "unstable in pitch"), number and limit first
    let what = r.why;
    if (r.id === 'pitch.sm' && typeof r.value === 'number') {
      const bd = typeof genMarginBand === 'function' ? genMarginBand(r.value) : null;
      what = (bd ? bd.title : 'static margin') + ': margin ' + Math.round(r.value * 100) + ' %, needs +' + Math.round(B.comfy * 100) + ' % or more' +
             (bd && bd.why ? ' - ' + bd.why : '');
    } else if (r.id === 'aid.range' && aids && aids.range) {
      what = 'over the loadings the margin runs ' + Math.round(aids.range.smFwd * 100) + ' to ' + Math.round(aids.range.smAft * 100) + ' % (the worst: ' +
             aids.range.aft.label + '); every loading needs +' + Math.round(B.comfy * 100) + ' % or more';
    }
    out.push({ id: r.id, tier: r.tier, level: r.level, proposed: !!r.proposed, title: r.label,
               what, value: r.value, unit: r.unit, limit: r.limit, remedy, levers: isPitch ? LV : null });
  }
  return out;
}

// the editor's engine record (CAGE_ENG: units[i].at, the mount, and .propAt, the drawn hub, both in the join's model
// frame - x aft of the firewall is -z there, y up) -> the disc's offset from each engine station, design frame
function genAidPropOff(CE) {
  const U = CE && Array.isArray(CE.units) ? CE.units : null;
  if (!U || !U.length) return null;
  return U.map(u => (u && u.at && u.propAt) ? [-(u.propAt[2] - u.at[2]), u.propAt[1] - u.at[1]] : null);
}
