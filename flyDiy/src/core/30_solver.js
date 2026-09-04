// ============================================================
function makeSim(def, world) {
  const P_ = def.params;
  const PP = POWERPLANTS[P_.powerplant];
  // The PROP may be the aeroplane's own rather than the powerplant's: a GARAGE
  // build chooses its disc, and every prop number below is then synthesised from
  // it (60_gen_spec.js). A fiche sets no `prop`, so it reads the registry exactly
  // as before and no fleet number moves.
  const PR = P_.prop || PP.prop;
  const PROPA = Math.PI * (PR.D / 2) ** 2;
  // THE AIR THIS SIM IS IN. A sim built with no world flies the STANDARD day:
  // genShakedown makes one that way on purpose, and a wind-tunnel probe must
  // never be in weather — which now includes the weather's air, not just its
  // wind. Read per pass rather than captured, because the viewer sets a new day
  // live exactly the way it already sets a new wind.
  // setAtmos(air, h) — the air AND the altitude a wind-tunnel probe is run at.
  // A TUNNEL IS AT A DECLARED AIR STATE, never at the incidental height the
  // aeroplane's nodes happen to be sitting at: every design-time number in
  // 64_gen_build is measured through probes, and if those read the model's own
  // ride height then a taller undercarriage would quietly change the stall
  // speed on the sheet. Default: ISA sea level, which is the datum.
  let atmOver = null, hProbe = 0;
  const setAtmos = (a, h) => { atmOver = a || null; hProbe = h || 0; };
  // WHERE THE GROUND IS, FOR GROUND EFFECT ONLY, when there is no world (G159).
  // A world-free sim has no place and therefore no terrain, which is the
  // shakedown's own ruling and the right one for the STANCE and for the AIR:
  // a number on the sheet must not depend on which patch of grass the
  // aeroplane is parked on. Ground EFFECT is not that kind of question. During
  // a take-off roll the wheels are on the ground, so h/b is set by the
  // aeroplane's own geometry and by nothing else, and leaving it out makes the
  // roll longer than the aeroplane's own wing says it is. So it is declared
  // rather than inferred: null (the default) is exactly the old behaviour, and
  // genTORunAt sets it to 0 for the length of the roll and clears it after.
  let gRef = null;
  const setGroundRef = h => { gRef = (h == null ? null : h); };
  const airOf = () => atmOver || (world && world.atmos) || ATMOS_ISA;
  // THE ENGINE'S OWN RELATION TO IT, declared on the registry row: 'na'
  // breathes the air and lapses with it, an electric motor's power comes out of
  // the pack and does not. Absent = 'na', because everything that flew before
  // this line existed was a piston.
  // G134: a GARAGE build may fly its OWN engine facts (def.params.engine, the
  // editor's dials resolved) — the registry row is then only the preset the
  // dials started from, exactly as params.prop already outranks PP.prop above.
  const EN = P_.engine || PP.engine;
  const ASP = (EN && EN.aspiration) || 'na';
  const n = def.nodes.length;
  const p = new Float64Array(n * 3), v = new Float64Array(n * 3),
        f = new Float64Array(n * 3), m = new Float64Array(n),
        r = new Float64Array(n);
  const beams = def.beams.map(b => ({ ...b, L0: 0, strain: 0 }));
  const _treeScratch = [];
  const ctl = { thr: 0, de: 0, da: 0, dr: 0, brake: 0, flap: 0 };
  const FP = P_.flaps;   // per-aircraft high-lift deltas; undefined = no flaps
  let simT = 0;          // sim time for the deterministic wind field
  const out = { V: 0, alpha: 0, thrust: 0, wash: 0, alt: 0, vs: 0 };
  let totalM = 0;
  for (const nd of def.nodes) totalM += nd.m;

  // wingspan datum for ground effect: outermost wing-strip node |z| in def
  // coordinates. Derived, not a fiche param — works for every aircraft.
  let bSpan = 0;
  for (const st of def.strips) if (st.kind === 'wing')
    for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
      bSpan = Math.max(bSpan, Math.abs(def.nodes[i].p[2]));
  bSpan = Math.max(0.1, bSpan * 2);

  function reset(drop = 0) {
    totalM = 0;                    // G121: masses may have changed (setNodeMass)
    for (let i = 0; i < n; i++) {
      const nd = def.nodes[i];
      p[i*3] = nd.p[0]; p[i*3+1] = nd.p[1]; p[i*3+2] = nd.p[2];
      v[i*3] = v[i*3+1] = v[i*3+2] = 0;
      m[i] = nd.m; r[i] = nd.r;
      totalM += nd.m;
      rigGround(i, nd.m);          // hoisted; reset only ever runs post-build
    }
    for (const b of beams) {
      b.L0 = Math.hypot(p[b.b*3]-p[b.a*3], p[b.b*3+1]-p[b.a*3+1], p[b.b*3+2]-p[b.a*3+2]);
      b.strain = 0;
    }
    // THE THREE-POINT STANCE (2026-09-04, the user: "quite a few of my builds
    // break their tailwheel simply on spawning, it just flips"). def.nodes are
    // the LEVEL attitude: on a taildragger the tail hangs ~1 m in the air and
    // FALLS onto the tailwheel in the first half second of every spawn
    // (measured on the default build: TW from y 1.08 to 0.09 in 0.67 s), the
    // one slam a 6 cm leg cannot take — it drove the node through the plane of
    // its anchors. So the airframe is pitched about the mains' axle until the
    // third wheel's contact shares the mains' ground line, BEFORE the first
    // step: the static stance the settle would have found, without the drop.
    // A tricycle gets the same treatment onto its nosewheel. Nothing changes
    // for a build without a third wheel, and a stance out of reach (the small
    // root of A sin t + B cos t = C does not exist) leaves the pose alone.
    // NOT CALLED HERE: it is a PLACEMENT step the GAME takes (app.js
    // applyRoute, right after reset and before placeAtStand), like the stand
    // itself. Measured: taken inside reset it moved every flying gate's
    // spawn, and three marginal cases (PILOT hover/card, FLEX alloy, GEN
    // sink) landed on the other side of their thresholds — the battery's
    // datum is the level drop + 600-frame settle, and it stays so.
    let minC = Infinity;
    for (let i = 0; i < n; i++) minC = Math.min(minC, p[i*3+1] - r[i]);
    for (let i = 0; i < n; i++) p[i*3+1] += -minC + 0.01 + drop;
    ctl.thr = ctl.de = ctl.da = ctl.dr = ctl.brake = ctl.flap = 0;
    simT = 0;
  }
  function stance() {
    const M = def.refs && def.refs.mains, tw = def.refs && def.refs.tw;
    if (!M || !M.length || tw == null || tw < 0) return 0;
    let ax = 0, ay = 0;
    for (const i of M) { ax += p[i*3]; ay += p[i*3+1]; }
    ax /= M.length; ay /= M.length;
    const A = p[tw*3] - ax, B = p[tw*3+1] - ay, C = r[tw] - r[M[0]];
    const R = Math.hypot(A, B);
    if (R < 1e-6 || Math.abs(C) > R) return 0;
    const th = Math.asin(C / R) - Math.atan2(B, A);
    if (!(Math.abs(th) < 0.6)) return 0;          // 34 deg: past that it is not a stance
    const cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const dx = p[i*3] - ax, dy = p[i*3+1] - ay;
      p[i*3] = ax + dx * cs - dy * sn;
      p[i*3+1] = ay + dx * sn + dy * cs;
    }
    return th;
  }

  // ---- small vec helpers on flat arrays ----
  const norm3 = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-9;
    a[0] /= L; a[1] /= L; a[2] /= L; return a; };
  const xAft = [0,0,0], yUp = [0,0,0], zRt = [0,0,0], t1 = [0,0,0], t2 = [0,0,0];
  const avgP = (ids, o) => { o[0]=o[1]=o[2]=0;
    for (const i of ids) { o[0]+=p[i*3]; o[1]+=p[i*3+1]; o[2]+=p[i*3+2]; }
    const k = 1 / ids.length; o[0]*=k; o[1]*=k; o[2]*=k; };
  function bodyAxes() {
    avgP(def.refs.noseFrame, t1); avgP(def.refs.tailMid, t2);
    xAft[0]=t2[0]-t1[0]; xAft[1]=t2[1]-t1[1]; xAft[2]=t2[2]-t1[2]; norm3(xAft);
    avgP(def.refs.upLo, t1); avgP(def.refs.upHi, t2);
    yUp[0]=t2[0]-t1[0]; yUp[1]=t2[1]-t1[1]; yUp[2]=t2[2]-t1[2]; norm3(yUp);
    zRt[0]=yUp[1]*xAft[2]-yUp[2]*xAft[1];   // right = up x aft (nose -x)
    zRt[1]=yUp[2]*xAft[0]-yUp[0]*xAft[2];
    zRt[2]=yUp[0]*xAft[1]-yUp[1]*xAft[0]; norm3(zRt);
  }

  // sig = ground-effect downwash factor (1 = free air). It scales the induced
  // drag term AND raises the lift slope via the lifting-line identity
  // 1/a3d = 1/a0 + 1/eAR (a0 reconstructed from the registry constants).
  // dCl0/dCd0/dAStall = high-lift deltas (already scaled by flap fraction):
  // flaps are camber + drag + reduced stall margin, never a bare alpha shift.
  function polar(al, P, sig = 1, dCl0 = 0, dCd0 = 0, dAStall = 0) {
    const s = Math.min(1, Math.max(0, (Math.abs(al) - (P.aStall - dAStall)) / 0.10));
    let a3 = P.a3d;
    if (sig < 1) a3 = 1 / (1 / P.a3d - (1 - sig) / P.eAR);
    const Cl = (P.Cl0 + dCl0 + a3 * al) * (1 - s) + 1.1 * Math.sin(2 * al) * s;
    const CdAtt = P.Cd0 + dCd0 + sig * Cl * Cl / P.eAR;
    const Cd = CdAtt * (1 - s) + (P.Cd0 + dCd0 + 1.9 * Math.sin(al) * Math.sin(al)) * s;
    return [Cl, Cd];
  }

  // strip force pass. probe=true: no prop/wash, aero only.
  const sc=[0,0,0], sw_=[0,0,0], sn=[0,0,0];
  function aeroPass(probe) {
    bodyAxes();
    // mean velocity (mass-weighted), and the mean altitude in the same sweep
    let vmx=0, vmy=0, vmz=0, pmy=0;
    for (let i = 0; i < n; i++) { vmx+=v[i*3]*m[i]; vmy+=v[i*3+1]*m[i]; vmz+=v[i*3+2]*m[i];
                                 pmy+=p[i*3+1]*m[i]; }
    vmx/=totalM; vmy/=totalM; vmz/=totalM; pmy/=totalM;

    // THE AIR, SAMPLED ONCE FOR THE WHOLE PASS at the aeroplane's own altitude.
    // Node y is metres above MEAN SEA LEVEL already (placeAtAerodrome offsets
    // every node by the strip's own elev), so there is no new datum here.
    // Once, not per strip, and that is a declared cut rather than laziness: the
    // density gradient across a 13 m span is 1e-4 of the density, and this pass
    // runs up to 200 times a frame.
    const AIR = airOf();
    // A TUNNEL PROBE reads the DECLARED air (hProbe, ISA sea level unless the
    // bench says otherwise); a FLYING aeroplane reads the air at its own mean
    // altitude. The two must not be the same line: if a probe read the model's
    // own ride height, a taller undercarriage would change the stall speed on
    // the sheet, and the sheet is what two builds are compared by.
    //
    // AND A SIM WITH NO WORLD HAS NO PLACE, so it has no altitude either — it
    // flies in the declared air too. That is genShakedown's own existing ruling
    // about the ground ("settled on a flat plane, so the answer does not depend
    // on which patch of grass it is parked on") extended to the air, and it is
    // needed for the same reason: the STANCE is measured by settling rather
    // than probing, so without this clause a 1.2e-4 density difference from the
    // aeroplane's own ride height reached the design sheet — enough to flip
    // which main wheel a deliberately-broken variant came to rest on.
    // genDensityAlt is unaffected by construction: it sets its height itself.
    const hAir = (probe || !world) ? hProbe : pmy;
    const rho = AIR.rho(hAir), sig = AIR.sigma(hAir);
    // EQUIVALENT AIRSPEED is the speed this aeroplane's WING thinks it is
    // doing: the speed at sea level that would make the same dynamic pressure.
    // Every V-number in this project (Vs, VCruise, VAppr, the plant gains) was
    // derived at rho0 and is therefore already an EAS, so this factor is what
    // lets the autopilot keep flying the numbers it was tuned with when the air
    // thins. At sea level it is EXACTLY 1 and nothing moves.
    const easK = Math.sqrt(sig);
    // and what the powerplant makes of it — see 05_atmos.js, where both
    // scalings are re-derived from 60_gen_spec's own prop synthesis rather than
    // asserted.
    const PS = atmosPropScale(sig, ASP);
    out.rho = rho; out.sigma = sig; out.easK = easK;
    out.densityAlt = AIR.densityAlt(hAir); out.oatC = AIR.T(hAir) - 273.15;
    out.powerK = PS.power; out.thrustK = PS.kT;

    // world samples: ONE terrain height (ground effect) and ONE wind vector
    // under the wing per pass; strips re-sample wind at their own position
    // so spatial gust structure produces roll/twist forcing. All wind terms
    // are exact zeros when no wind is set — the zero-wind battery is
    // byte-identical to the pre-wind one.
    let gH = gRef, wcx = 0, wcy = 0, wcz = 0;
    if (world) {
      let sx = 0, sy = 0, sz = 0, sN = 0;
      for (const st of def.strips) if (st.kind === 'wing') {
        sx += p[st.fIn*3] + p[st.fOut*3];
        sy += p[st.fIn*3+1] + p[st.fOut*3+1];
        sz += p[st.fIn*3+2] + p[st.fOut*3+2];
        sN += 2;
      }
      const mx = sx / sN, my = sy / sN, mz = sz / sN;
      gH = world.terrainH(mx, mz);
      // the CG sample used to pass a literal 0 for y. It was silent while the
      // wind field ignored y and wrong the moment it stopped (G72): the wing
      // would have been told the wind at sea level while its own strips, which
      // sample at their real positions two lines down, felt the wind at
      // altitude — the two disagreeing about the same air.
      if (world.wind) { const wv = world.wind(mx, my, mz, simT); wcx = wv[0]; wcy = wv[1]; wcz = wv[2]; }
    }
    // prop advance ratio uses AIRSPEED (thrust decays with air, not ground)
    const Vfwd = Math.max(0, -((vmx-wcx)*xAft[0]+(vmy-wcy)*xAft[1]+(vmz-wcz)*xAft[2]));

    // prop thrust + far-wake propwash
    let T = 0, wash = 0;
    if (!probe) {
      // TWO DIFFERENT COUNTS, and conflating them was a real defect (fixed
      // 2026-08-11). `refs.engine` is the list of NODES the thrust is applied
      // AT — the two mount points of ONE engine on the Cub, one node per
      // nacelle on the DC-3 — so it can say where the force goes but not how
      // many engines make it. `params.nEngines` says that, and every def
      // states it. The registry's Tstatic/kV2 are PER PROPELLER.
      const nE = def.params.nEngines || 1;
      const Tper = ctl.thr * Math.max(0, PR.Tstatic * PS.kT - PR.kV2 * PS.kV * Vfwd * Vfwd);
      T = Tper * nE;                                   // registry values are per engine
      // propwash is ONE disc's — the tail flies in the wake of the prop ahead
      // of it, not in the sum of the aeroplane's engines
      wash = Math.sqrt(Vfwd * Vfwd + 2 * Tper / (rho * PROPA)) - Vfwd;
      const per = T / def.refs.engine.length;          // spread over the MOUNTS
      for (const e of def.refs.engine) {
        f[e*3]   -= per * xAft[0];
        f[e*3+1] -= per * xAft[1];
        f[e*3+2] -= per * xAft[2];
      }
    }
    out.aeroFy = 0; out.wingFy = 0; out.stabFy = 0; out.dbgAl = 0; out.dbgN = 0;
    out.thrust = T; out.wash = wash;
    // THREE SPEEDS, and the distinction is load-bearing now that the air can be
    // thin: out.V is TRUE airspeed (air-relative — what alpha is built on and
    // what a propeller advances into), out.Veas is what the wing and the
    // instrument feel, out.Vg is over the ground (wheels, brakes, stop
    // detection). At sea level the first two are the same number exactly.
    const avx = vmx - wcx, avy = vmy - wcy, avz = vmz - wcz;
    out.V = Math.hypot(avx, avy, avz);
    out.Veas = out.V * easK;
    out.Vg = Math.hypot(vmx, vmy, vmz);
    out.windX = wcx; out.windY = wcy; out.windZ = wcz;
    out.alpha = Math.atan2(-(avx*yUp[0]+avy*yUp[1]+avz*yUp[2]),
                           -(avx*xAft[0]+avy*xAft[1]+avz*xAft[2]));
    out.vs = vmy;

    for (const st of def.strips) {
      // --- strip frame ---
      if (st.kind === 'wing') {
        const fi=st.fIn*3, fo=st.fOut*3, ri=st.rIn*3, ro=st.rOut*3, t=st.t;
        sc[0]=(p[ri]+(p[ro]-p[ri])*t)-(p[fi]+(p[fo]-p[fi])*t);
        sc[1]=(p[ri+1]+(p[ro+1]-p[ri+1])*t)-(p[fi+1]+(p[fo+1]-p[fi+1])*t);
        sc[2]=(p[ri+2]+(p[ro+2]-p[ri+2])*t)-(p[fi+2]+(p[fo+2]-p[fi+2])*t);
        norm3(sc);
        sw_[0]=(p[fo]-p[fi])*st.side; sw_[1]=(p[fo+1]-p[fi+1])*st.side; sw_[2]=(p[fo+2]-p[fi+2])*st.side;
        norm3(sw_);
        sn[0]=sw_[1]*sc[2]-sw_[2]*sc[1];
        sn[1]=sw_[2]*sc[0]-sw_[0]*sc[2];
        sn[2]=sw_[0]*sc[1]-sw_[1]*sc[0]; norm3(sn);
      } else if (st.kind === 'stab') {
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=yUp[0]; sn[1]=yUp[1]; sn[2]=yUp[2];
      } else if (st.kind === 'vtail') {
        // V-TAIL panel: chord still aft, but the normal is canted out of the
        // vertical by the panel's own dihedral, INWARD on each side:
        //   n = cos G * up  -  side * sin G * right
        // Both panels then lift upward together (their lateral parts cancel in
        // symmetric flight) and oppositely in yaw, which is the whole trick —
        // the mixing falls out of the geometry instead of being asserted.
        const cV = st.cosV, sV = st.sinV * st.side;
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=cV*yUp[0]-sV*zRt[0]; sn[1]=cV*yUp[1]-sV*zRt[1]; sn[2]=cV*yUp[2]-sV*zRt[2];
        norm3(sn);
      } else { // fin
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=zRt[0]; sn[1]=zRt[1]; sn[2]=zRt[2];
      }
      // --- local velocity + position via attach weights ---
      let vx=0, vy=0, vz=0, spx=0, spy=0, spz=0;
      for (const [i, w] of st.w) {
        vx+=v[i*3]*w; vy+=v[i*3+1]*w; vz+=v[i*3+2]*w;
        spx+=p[i*3]*w; spy+=p[i*3+1]*w; spz+=p[i*3+2]*w;
      }
      // wind at the strip's own position (spatial gust structure -> roll/twist)
      let wx_ = wcx, wy_ = wcy, wz_ = wcz;
      if (world && world.wind) { const wv = world.wind(spx, spy, spz, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      // relative air velocity = air motion (wash + wind) - node motion
      const wsh = wash * st.wash;
      let rx = wsh*xAft[0]+wx_-vx, ry = wsh*xAft[1]+wy_-vy, rz = wsh*xAft[2]+wz_-vz;
      const u = rx*sc[0]+ry*sc[1]+rz*sc[2];
      const w_ = rx*sn[0]+ry*sn[1]+rz*sn[2];
      const V2 = u*u + w_*w_;
      if (V2 < 0.01) continue;
      let al = Math.atan2(w_, u);
      let P = P_.polarWing;
      let fl = 0;                                  // flap fraction on this strip
      if (st.kind === 'wing') {
        al += P_.ailTau * ctl.da * st.side * st.ail;
        if (FP && st.flap && ctl.flap > 0) {
          fl = ctl.flap * st.flap;
          al += (FP.tau || 0) * fl;                // flaperon droop (surface rotates)
        }
      } else if (st.kind === 'stab') {
        al = (1 - P_.downwash) * al + P_.stabTrim - P_.elevTau * ctl.de;
        P = P_.polarTail;
      } else if (st.kind === 'vtail') {
        // ruddervator: elevator SYMMETRIC (both panels the same way, vertical
        // forces add and lateral cancel), rudder ANTISYMMETRIC (the reverse)
        // MINUS side, not plus. A V panel's normal leans INWARD (that is what
        // dihedral does — it is the same geometry that gives a dihedralled wing
        // its roll stability), so the panel that goes nose-up pushes the tail
        // toward the centreline, not away from it. With +side the aeroplane
        // yawed the wrong way on every rudder input: measured d(yawLeft)/d(dr)
        // = -6991 against a conventional tail's +3814.
        al = (1 - P_.downwash) * al + P_.stabTrim - P_.elevTau * ctl.de
             - P_.rudTau * ctl.dr * PAR.rudderSign * st.side;
        P = P_.polarTail;
      } else {
        al += P_.rudTau * ctl.dr * PAR.rudderSign;
        // G115: the fin flies its OWN polar when the def declares one (the
        // generator does, from the real fin aspect ratio); the fleet's
        // fiches never set polarFin, so the fallback keeps them bit-exact.
        P = P_.polarFin || P_.polarTail;
      }
      // ground effect (wing strips only; tail excluded — honest cut):
      // McCormick sigma = (16h/b)^2 / (1 + (16h/b)^2)
      let sig = 1;
      if (gH !== null && st.kind === 'wing') {
        const hb = Math.max(0.02,
          ((p[st.fIn*3+1] + p[st.fOut*3+1]) * 0.5 - gH) / bSpan);
        const g16 = 16 * hb;
        sig = g16 * g16 / (1 + g16 * g16);
      }
      const [Cl, Cd] = fl > 0
        ? polar(al, P, sig, (FP.dCl0 || 0) * fl, (FP.dCd0 || 0) * fl, (FP.dAStall || 0) * fl)
        : polar(al, P, sig);
      const q = 0.5 * rho * V2 * st.area, iv = 1 / Math.sqrt(V2);
      // drag along relative wind (in strip plane), lift perpendicular
      const dx=(u*sc[0]+w_*sn[0])*iv, dy=(u*sc[1]+w_*sn[1])*iv, dz=(u*sc[2]+w_*sn[2])*iv;
      const lx=(u*sn[0]-w_*sc[0])*iv, ly=(u*sn[1]-w_*sc[1])*iv, lz=(u*sn[2]-w_*sc[2])*iv;
      const Fx = q*(Cl*lx + Cd*dx), Fy = q*(Cl*ly + Cd*dy), Fz = q*(Cl*lz + Cd*dz);
      out.aeroFy += Fy;
      if (st.kind === 'wing') { out.wingFy += Fy; out.dbgAl += al; out.dbgN++;
        if (out.dump) out.dump.push({ side: st.side, t: st.t, wash: st.wash,
          al: al*57.3, Fy, ch: st.chord }); }
      else if (st.kind === 'stab' || st.kind === 'vtail') out.stabFy += Fy;
      for (const [i, w] of st.w) {
        f[i*3] += Fx*w; f[i*3+1] += Fy*w; f[i*3+2] += Fz*w;
      }
      // wing pitching moment as front/rear spar couple (d = spar spacing 0.78 m)
      // flap dCm0 feeds in here — the couple reading polarWing.Cm0 alone would
      // silently ignore the flap pitching moment (HANDOVER "watch Cm0")
      if (st.kind === 'wing') {
        const Fc = q * (P_.polarWing.Cm0 + (fl > 0 ? (FP.dCm0 || 0) * fl : 0))
                     * st.chord / P_.sparSpacing, t = st.t;
        const cW = [[st.fIn, (1-t)], [st.fOut, t], [st.rIn, -(1-t)], [st.rOut, -t]];
        for (const [i, w] of cW) {
          f[i*3] += Fc*w*sn[0]; f[i*3+1] += Fc*w*sn[1]; f[i*3+2] += Fc*w*sn[2];
        }
      }
    }
    // fuselage blobs: anisotropic CdA in body axes; side/vertical area split
    // between cabin and aft fuselage so yaw and pitch damping are physical
    const blob = (ids, CdA) => {
      let vx=0, vy=0, vz=0, bx=0, by=0, bz=0;
      for (const i of ids) {
        vx+=v[i*3]; vy+=v[i*3+1]; vz+=v[i*3+2];
        bx+=p[i*3]; by+=p[i*3+1]; bz+=p[i*3+2];
      }
      vx/=4; vy/=4; vz/=4; bx/=4; by/=4; bz/=4;
      // wind on the fuselage: without this there is no weathercocking
      let wx_ = 0, wy_ = 0, wz_ = 0;
      if (world && world.wind) { const wv = world.wind(bx, by, bz, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      const rx=wx_-vx, ry=wy_-vy, rz=wz_-vz, Vr = Math.hypot(rx, ry, rz);
      if (Vr < 0.1) return;
      const cb = [rx*xAft[0]+ry*xAft[1]+rz*xAft[2],
                  rx*yUp[0]+ry*yUp[1]+rz*yUp[2],
                  rx*zRt[0]+ry*zRt[1]+rz*zRt[2]];
      const k = 0.5 * rho * Vr * 0.25;
      for (const i of ids) {
        f[i*3]   += k*(CdA[0]*cb[0]*xAft[0] + CdA[1]*cb[1]*yUp[0] + CdA[2]*cb[2]*zRt[0]);
        f[i*3+1] += k*(CdA[0]*cb[0]*xAft[1] + CdA[1]*cb[1]*yUp[1] + CdA[2]*cb[2]*zRt[1]);
        f[i*3+2] += k*(CdA[0]*cb[0]*xAft[2] + CdA[1]*cb[1]*yUp[2] + CdA[2]*cb[2]*zRt[2]);
      }
    };
    blob(def.refs.fusDrag,    P_.fusCdA);
    blob(def.refs.fusDragAft, P_.fusCdAAft);
  }

  // G115: DEFDAMP is overridable per def — for the MEASUREMENT instrument
  // (tools/_yaw_probe.js runs free-yaw decay at two settings), not for play.
  // No fiche and no generated build sets it, so everything flies 0.5 as ever.
  const G = -9.81, DEFDAMP = def.params.defDamp ?? 0.5;
  // ground stiffness scales with node mass so light aircraft stay stable at the same dt
  const KGn = new Float64Array(n), CGn = new Float64Array(n),
        KTn = new Float64Array(n), CTn = new Float64Array(n);
  // G121: the per-node rig is a FUNCTION now, because a node's mass can
  // change (fuel burns; the sanctioned door is setNodeMass below) and the
  // ground spring plus its critical-damping companion must follow the mass
  // they carry, or the landing rollout at reserves rides constants rigged
  // for full tanks. Identical arithmetic to the old loop.
  function rigGround(i, mi) {
    // light nodes: Cub/drone-calibrated regime (unchanged); heavy nodes keep scaling
    KGn[i] = mi <= 6 ? Math.min(9e4, 2.5e5 * mi) : 1.5e4 * mi;
    CGn[i] = 1.6 * Math.sqrt(KGn[i] * mi);
    KTn[i] = Math.min(2.2e4, 2e5 * mi);
    CTn[i] = Math.min(40, 300 * mi);
  }
  for (let i = 0; i < n; i++) rigGround(i, def.nodes[i].m);

  // G121 — THE SANCTIONED MASS DOOR (the review's B1/B3, built BEFORE the
  // energy arc's burn so it cannot be built wrong). `m[]` was always exposed
  // and mutating it directly was always possible — and always wrong: totalM
  // was summed once at construction, and it is the divisor under the
  // mass-weighted mean velocity that alpha, vs, DEFDAMP's rigid mean, the
  // probe CG and cgPos/cgVel are all built on. Drain fuel behind its back
  // and ALPHA ITSELF corrupts — an invisible drag and rate damper that grow
  // as the tanks empty, and nothing NaNs. This door keeps every consumer
  // honest: the sum, the ground rig, nothing else touched. Burn calls this;
  // nothing else writes m[].
  function setNodeMass(i, kg) {
    if (!(i >= 0 && i < n) || !(kg > 0.01)) return;
    totalM += kg - m[i];
    m[i] = kg;
    rigGround(i, kg);
  }

  function trqOf() {
    let cgx=0, cgy=0;
    if (out.trqDebugOnce) { out.trqDebugOnce = false;
      let sp=0, sf=0, sm=0;
      for (let i = 0; i < n; i++) { sp+=p[i*3]; sf+=f[i*3+1]; sm+=m[i]; }
      console.log("trqOf dbg: n=", n, "sum p.x=", sp, "sum f.y=", sf, "sum m=", sm, "totalM=", totalM, "G=", typeof G !== "undefined" ? G : "UNDEF"); }
    for (let i = 0; i < n; i++) { cgx+=p[i*3]*m[i]; cgy+=p[i*3+1]*m[i]; }
    cgx/=totalM; cgy/=totalM;
    let Mz = 0;
    for (let i = 0; i < n; i++)
      Mz += (p[i*3]-cgx)*(f[i*3+1]-G*m[i]) - (p[i*3+1]-cgy)*f[i*3];
    return -Mz;   // nose-up positive, gravity excluded
  }
  function substep(dt) {
    for (let i = 0; i < n; i++) { f[i*3]=0; f[i*3+1]=G*m[i]; f[i*3+2]=0; }
    aeroPass(false);
    if (out.trq) out.trqAero = trqOf();
    for (const b of beams) {
      const a3=b.a*3, b3=b.b*3;
      let dx=p[b3]-p[a3], dy=p[b3+1]-p[a3+1], dz=p[b3+2]-p[a3+2];
      const L = Math.hypot(dx, dy, dz) || 1e-9;
      dx/=L; dy/=L; dz/=L;
      const vrel = (v[b3]-v[a3])*dx + (v[b3+1]-v[a3+1])*dy + (v[b3+2]-v[a3+2])*dz;
      const Fb = b.k * (L - b.L0) + b.c * vrel;
      b.strain = (L - b.L0) / b.L0;
      f[a3]+=Fb*dx; f[a3+1]+=Fb*dy; f[a3+2]+=Fb*dz;
      f[b3]-=Fb*dx; f[b3+1]-=Fb*dy; f[b3+2]-=Fb*dz;
    }
    // ground: wheels roll, everything else scrapes. Terrain-aware.
    const gH = world ? world.terrainH : null;
    for (let i = 0; i < n; i++) {
      const i3 = i*3;
      const gy = gH ? gH(p[i3], p[i3+2]) : 0;
      const pen = gy + r[i] - p[i3+1];
      if (pen <= 0) continue;
      let Fn = KGn[i] * pen - CGn[i] * v[i3+1];
      if (out.gndDump) out.gndPitch -= (p[i3] - out.gndCgx) * Fn;

      if (Fn < 0) Fn = 0;
      f[i3+1] += Fn;
      const isMain = def.refs.mains.includes(i), isTW = i === def.refs.tw;
      if (isMain || isTW) {
        // rolling dir = horizontal forward, tailwheel steered by rudder
        let hx = -xAft[0], hz = -xAft[2];
        if (isTW) {
          const s = P_.twSteer * ctl.dr;   // measured: matches nose-left convention
          const cs = Math.cos(s), sn_ = Math.sin(s);
          const nx = hx*cs - hz*sn_, nz = hx*sn_ + hz*cs;
          hx = nx; hz = nz;
        }
        const hL = Math.hypot(hx, hz) || 1e-9; hx/=hL; hz/=hL;
        const lx = -hz, lz = hx;
        const vr_ = v[i3]*hx + v[i3+2]*hz, vl = v[i3]*lx + v[i3+2]*lz;
        // G115: the wheel asks WHAT IT IS ROLLING ON. `world.surface` is the
        // biome classifier with the aerodrome strips folded in (measured: 5
        // at Morford's pavement, 0 at HOME); classes without a row read the
        // grass row, which equals the classic constants — so HOME, the
        // calibration datum, is unchanged to the last bit.
        const su = world && world.surface
          ? (GROUND_SURF[world.surface(p[i3], p[i3+2])] || GROUND_DEF)
          : GROUND_DEF;
        const muR = su[0] + (isMain ? ctl.brake * su[1] : 0);
        // G121.3: BELOW WALKING PACE THE COEFFICIENT IS A DAMPER, NOT A
        // RESISTANCE. The 0.2 m/s regularization means the sub-0.2 regime
        // was never physical rolling — and it turned out to be load-bearing
        // as the PLACEMENT-BOUNCE damper: at Morford the fleet's Cub, given
        // pavement's 0.02 in that regime, kept 2.5x less rock damping than
        // the grass the settle was calibrated on and flipped onto its back
        // in 1.7 s, parked, on flat ground (measured; XCTY3 caught it). So
        // the creep regime damps at least at the grass datum on EVERY
        // surface — bit-identical at HOME, where muR == CRR — and the true
        // surface coefficient applies from 0.2 m/s up, which is where the
        // takeoff run, the brakes and the surface honesty actually live.
        // 0.5 m/s, not the 0.2 regularization floor: the placement-bounce
        // ROCKING measured 0.1-0.3 m/s fore-aft at the wheels, just above
        // 0.2 — the band must cover the whole settle/rock regime. Costs a
        // paved takeoff under a metre (it passes 0.5 m/s in the first
        // second); HOME remains bit-identical (muR == CRR there).
        const muRe = Math.abs(vr_) < 0.5 ? Math.max(muR, CRR) : muR;
        const kR = Math.min(muRe * Fn / Math.max(Math.abs(vr_), 0.2), m[i]/dt);
        const kL = Math.min(su[2] * Fn / Math.max(Math.abs(vl), 0.02), m[i]/dt);
        f[i3]   -= kR*vr_*hx + kL*vl*lx;
        f[i3+2] -= kR*vr_*hz + kL*vl*lz;
      } else {
        const vx=v[i3], vz=v[i3+2], sp = Math.hypot(vx, vz);
        if (sp > 1e-6) {
          const kf = Math.min(0.8 * Fn / sp, m[i]/dt);
          f[i3] -= kf*vx; f[i3+2] -= kf*vz;
        }
      }
    }
    // tree collisions: cheap cylinder push-out, only when low and near trees
    if (world) {
      const cgx = p[0], cgz = p[2];   // any chassis node as coarse anchor
      if (p[1] < 24) {
        const near = world.treesNear(cgx, cgz, _treeScratch);
        if (near.length) for (let i = 0; i < n; i++) {
          const i3 = i*3;
          for (const ti of near) {
            const T = world.trees[ti];
            const dx = p[i3] - T.x, dz = p[i3+2] - T.z;
            const R = 0.7 * T.s + 0.12;
            const d2 = dx*dx + dz*dz;
            if (d2 > R*R) continue;
            if (p[i3+1] > T.h + 4.6 * T.s) continue;
            const d = Math.sqrt(d2) || 1e-6;
            const push = KTn[i] * (R - d) / d;
            f[i3] += push * dx - CTn[i] * v[i3];
            f[i3+2] += push * dz - CTn[i] * v[i3+2];
          }
        }
      }
    }
    if (out.trq) out.trqTotal = trqOf();
    // integrate; damp only deformation (velocity relative to rigid mean)
    let vmx=0, vmy=0, vmz=0;
    for (let i = 0; i < n; i++) { vmx+=v[i*3]*m[i]; vmy+=v[i*3+1]*m[i]; vmz+=v[i*3+2]*m[i]; }
    vmx/=totalM; vmy/=totalM; vmz/=totalM;
    const dp = Math.max(0, 1 - DEFDAMP * dt);
    for (let i = 0; i < n; i++) {
      const i3 = i*3, im = dt/m[i];
      v[i3]   = vmx + (v[i3]   + f[i3]*im   - vmx) * dp;
      v[i3+1] = vmy + (v[i3+1] + f[i3+1]*im - vmy) * dp;
      v[i3+2] = vmz + (v[i3+2] + f[i3+2]*im - vmz) * dp;
      p[i3] += v[i3]*dt; p[i3+1] += v[i3+1]*dt; p[i3+2] += v[i3+2]*dt;
    }
    // altitude of CG (wheel-corrected later by caller if needed)
    let cy = 0;
    for (let i = 0; i < n; i++) cy += p[i*3+1]*m[i];
    out.alt = cy/totalM;
  }

  function step(dtFrame, sub = P_.substeps ?? 24) {
    const dt = dtFrame / sub;
    for (let s = 0; s < sub; s++) { substep(dt); simT += dt; }
  }

  // ONE THRUST MODEL, TWO READERS. 64_gen_build's design-time numbers — the
  // cruise speed off the power curve, thrCruise, the climb gradient, the
  // take-off roll integration — used to re-type `Tstatic - kV2 V^2` straight
  // off the registry. That was harmless while the air was a constant and became
  // a SECOND, quieter engine the moment it stopped being one: the sheet would
  // have gone on quoting sea-level thrust while the aeroplane flew on less.
  // `floor` is the caller's own — genTrim floors the bracket at 1 N so a ratio
  // cannot divide by zero, the take-off roll floors it at 0 — and it is passed
  // rather than chosen here so the two readers keep their own numbers exactly.
  // What air a PROBE is in, for the readers that have to convert between the
  // equivalent airspeeds the sheet is written in and the true ones the tunnel
  // prescribes. Cheap, and it keeps the conversion in one place.
  function probeAir() {
    const A = airOf(), sg = A.sigma(hProbe);
    return { air: A, h: hProbe, rho: A.rho(hProbe), sigma: sg,
             easK: Math.sqrt(sg), densityAlt: A.densityAlt(hProbe),
             oatC: A.T(hProbe) - 273.15, power: atmosPowerRatio(sg, ASP),
             aspiration: ASP };
  }

  function thrustAt(V, floor = 0, hAlt) {
    const A = airOf();
    const PS = atmosPropScale(A.sigma(hAlt == null ? hProbe : hAlt), ASP);
    return Math.max(floor, PR.Tstatic * PS.kT - PR.kV2 * PS.kV * V * V)
           * (def.params.nEngines || 1);
  }

  // ---- wind tunnel: prescribe uniform velocity, measure aero force+moment ----
  function probe(vel) {
    for (let i = 0; i < n; i++) {
      f[i*3]=f[i*3+1]=f[i*3+2]=0;
      v[i*3]=vel[0]; v[i*3+1]=vel[1]; v[i*3+2]=vel[2];
    }
    aeroPass(true);
    let cgx=0, cgy=0, cgz=0;
    for (let i = 0; i < n; i++) { cgx+=p[i*3]*m[i]; cgy+=p[i*3+1]*m[i]; cgz+=p[i*3+2]*m[i]; }
    cgx/=totalM; cgy/=totalM; cgz/=totalM;
    let Fx=0, Fy=0, Fz=0, Mz=0, My=0;
    for (let i = 0; i < n; i++) {
      Fx+=f[i*3]; Fy+=f[i*3+1]; Fz+=f[i*3+2];
      Mz += (p[i*3]-cgx)*f[i*3+1] - (p[i*3+1]-cgy)*f[i*3];
      My += (p[i*3+2]-cgz)*f[i*3] - (p[i*3]-cgx)*f[i*3+2];
    }
    // nose-up pitch = -Mz ; nose-LEFT yaw = +My  (nose -x, +z is the LEFT side)
    return { Fx, Fy, Fz, pitchUp: -Mz, yawLeft: My, cg: [cgx, cgy, cgz] };
  }

  function stats() {
    let smax = 0, bad = false;
    for (const b of beams) smax = Math.max(smax, Math.abs(b.strain));
    for (let i = 0; i < n; i++) if (!isFinite(p[i*3+1])) bad = true;
    return { smax, bad };
  }
  function impulse(i, ix, iy, iz) { v[i*3]+=ix/m[i]; v[i*3+1]+=iy/m[i]; v[i*3+2]+=iz/m[i]; }
  function wheelsOnGround() {
    let c = 0;
    for (const i of [...def.refs.mains, def.refs.tw]) {
      const gh = world ? world.terrainH(p[i*3], p[i*3+2]) : 0;
      if (p[i*3+1] - r[i] - gh < 0.03) c++;
    }
    return c;
  }
  function cgPos() {
    let x=0, y=0, z=0;
    for (let i = 0; i < n; i++) { x+=p[i*3]*m[i]; y+=p[i*3+1]*m[i]; z+=p[i*3+2]*m[i]; }
    return [x/totalM, y/totalM, z/totalM];
  }
  function cgVel() {
    let x=0, y=0, z=0;
    for (let i = 0; i < n; i++) { x+=v[i*3]*m[i]; y+=v[i*3+1]*m[i]; z+=v[i*3+2]*m[i]; }
    return [x/totalM, y/totalM, z/totalM];
  }
  function axes() { bodyAxes(); return [xAft.slice(), yUp.slice(), zRt.slice()]; }

  // G121: totalM is a GETTER — it was a copied value, so a mass change via
  // setNodeMass would have been invisible to every external reader (the
  // autopilot's taxi feedforward, the shakedown's weights). Same number as
  // ever for anything that never changes mass; nothing writes it.
  return { p, v, m, r, beams, n, ctl, out, get totalM() { return totalM; },
           setNodeMass,
           reset, stance, step, probe, stats, impulse, wheelsOnGround, cgPos, cgVel, axes,
           setAtmos, setGroundRef, atmos: airOf, thrustAt, probeAir };
}


