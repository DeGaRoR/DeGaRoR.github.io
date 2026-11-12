// ============================================================
// THE FICHE'S PHYSICS PAGES (PHYSICS-PAGES, 11 Nov 2026) - the data behind the fiche pages that show what a player never
// sees: the LOAD TEST and its BREAKING POINT, the DRAG, the X-RAY (electrics and tanks) and WHAT THE SIM FLIES.
//
// NO PHYSICS HERE. Every number is read off a function the game already runs, the way it runs it:
//   load     makeLoadTest on the stand's airframe (app.js startLoadTest's cfg), the shape and each member's force at the
//            limit load, each force over that member's own yield (fy0 in tension, fc0 in compression, the damage
//            model's figures)
//   destroy  the bench to destruction (bench_worker.js benchLoadRun with destroy: the certified airframe, the damage
//            layer on, the bags to three times the ultimate at the load test's own rate), the shape when the first part
//            lets go and the damage record (sim.damage(): firstYield, firstBreak, broken, groups)
//   drag     def.params.gen.drag (genFusCdA's build-up, genGearCdA, the truss, the pod), the gear row split by
//            genGearCdA's own terms (the sum checked against the row), and each row's cost in km/h by the cruise rule
//            64_gen_build solves the belly pod's cost with (drag = 65 % of the thrust, from the best-glide speed to
//            4 Vs) run again with that row's drag area off the same probe
//   elec     genSystemsResolve with the lights the build has fitted (the light layer's li_<key>Fit rows), and the bus
//            (makeBus) run with the alternator switched off until it can no longer feed an instrument
//   tanks    the vessels' resolved records (genVesselResolve's _res) and their bays (genBayResolve)
//   model    def.nodes (masses), def.beams, def.strips with the control chords, the two body drag points
//            (refs.fusDrag / fusDragAft with params.fusCdA / fusCdAAft), the propeller disc (params.prop.D at
//            refs.engine), the ground contacts
//
//   genFichePages(def, { destroy: true|false, load: true|false, propOff }) -> { v, model, load, destroy, drag, elec, tanks }
//            (propOff: genAidPropOff(CAGE_ENG), the drawn hubs; the model's propeller discs stand there)
//
// Heavy parts: the load test steps the sim (seconds), the bench to destruction longer (up to a minute on a strong wing):
// the page asks for them on the bench's thread; each part can be left out ({ load: false, destroy: false }).
// GATE PHYSPAGES (tools/_physpages_check.js) holds every part to the function it reads.
// ============================================================
const GEN_FICHE_PAGES_V = 1;
const GEN_FICHE_CRUISE_K = 0.65;   // 64_gen_build's pod rule: cruise where the drag is 65 % of the thrust

const GEN_FICHE_TEN = [1, 10, 100, 1000, 1e4, 1e5];
function genFicheR(x, k) { const m = GEN_FICHE_TEN[k == null ? 3 : k]; return Math.round(x * m) / m; }

// the airframe as the solver holds it: what the model page draws, and what every other page places its callouts by
function genFicheModel(def, opts) {
  const S = def.spec || {}, CT = S.controls || {}, P = def.params || {};
  const tags = [], tagIx = {};
  const tagOf = t => { t = t || ''; if (!(t in tagIx)) { tagIx[t] = tags.length; tags.push(t); } return tagIx[t]; };
  const nodes = def.nodes.map(n => [genFicheR(n.p[0]), genFicheR(n.p[1]), genFicheR(n.p[2]), genFicheR(n.m, 2), tagOf(n.tag)]);
  const CLS = ['fus', 'wing', 'tail', 'wire', 'gear'];
  const beams = def.beams.map(b => [b.a, b.b, Math.max(0, CLS.indexOf(b.cls || (b.gear ? 'gear' : 'fus'))), b.vis === 'inner' ? 1 : 0]);
  const share = st => st.kind === 'stab' ? (CT.elevator && CT.elevator.chord) || 0 : st.kind === 'fin' ? (CT.rudder && CT.rudder.chord) || 0
    : st.ail ? (CT.aileron && CT.aileron.chord) || 0 : st.flap ? (CT.flap && CT.flap.chord) || 0 : 0;
  const KIND = ['wing', 'stab', 'fin'];
  const strips = def.strips.map(st => [st.fIn, st.fOut, st.rIn, st.rOut, genFicheR(st.chord), Math.max(0, KIND.indexOf(st.kind)),
                                       genFicheR(share(st)), st.ail ? 1 : st.flap ? 2 : 0, genFicheR(st.area)]);
  const mid = ix => { const a = [].concat(ix || []); if (!a.length) return null; const c = [0, 0, 0]; for (const i of a) for (let k = 0; k < 3; k++) c[k] += def.nodes[i].p[k] / a.length; return c.map(v => genFicheR(v)); };
  const engI = [].concat((def.refs && def.refs.engine) || []);
  const engAt = Array.isArray(S.engAt) ? S.engAt : [];
  return {
    tags, nodes, beams, strips, CLS, KIND,
    drag: { fwd: mid(def.refs && def.refs.fusDrag), aft: mid(def.refs && def.refs.fusDragAft),
            cda: (P.fusCdA || []).map(v => genFicheR(v, 4)), cdaAft: (P.fusCdAAft || []).map(v => genFicheR(v, 4)) },
    prop: { D: genFicheR((P.prop && P.prop.D) || 0), at: mid(engI), pusher: engAt.some(e => e && e.mount === 'pusher'),
            mounts: engAt.map(e => e && e.mount),
            // the discs where the blades are DRAWN: each engine station (the mount's flange) moved by the editor's own
            // measure of its hub (64c genAidPropOff off CAGE_ENG, handed in as opts.propOff); [x, y, z, drawn 1|0] - a
            // disc without that measure stays at its flange (drawn 0)
            discs: engAt.map((e, i) => { if (!e) return null; const PO = opts && Array.isArray(opts.propOff) ? opts.propOff : null, off = PO && PO[i];
              return [genFicheR(e.x + (off ? off[0] : 0)), genFicheR(e.y + (off ? off[1] : 0)), genFicheR(e.z || 0), off ? 1 : 0]; }).filter(Boolean) },
    engineKg: genFicheR(engI.reduce((a, i) => a + def.nodes[i].m, 0) + def.nodes.filter(n => n.tag === 'CGE').reduce((a, n) => a + n.m, 0), 1),
    contacts: [].concat((def.refs && def.refs.mains) || [], def.refs && def.refs.tw >= 0 ? [def.refs.tw] : []),
    floats: !!(def.parts && def.parts.floats),
    semi: genFicheR((S.geom && S.geom.semi) || 0),
  };
}

// the shape of a run against its jig, in the body frame (x aft, y up, z right), metres
function genFicheShape(sim, def, base, now) {
  const out = [];
  for (let i = 0; i < def.nodes.length; i++) {
    const d = [0, 1, 2].map(q => now.p[i * 3 + q] - base.p[i * 3 + q]);
    out.push([0, 1, 2].map(a => genFicheR(d[0] * now.ax[a][0] + d[1] * now.ax[a][1] + d[2] * now.ax[a][2], 4)));
  }
  return out;
}
const genFicheSnap = sim => ({ p: Float64Array.from(sim.p), ax: sim.axes().map(a => a.slice()) });

// THE LOAD TEST at the limit: app.js startLoadTest's cfg on a fresh sim of this def
function genFicheLoad(def) {
  const S = def.spec || {};
  const sim = makeSim(def, null); sim.reset(0);
  const cfg = { material: (S.fuselage && S.fuselage.material) || undefined,
                wingMaterial: typeof genSurfKey === 'function' ? genSurfKey(S, 'wing', 0) : undefined };
  const rig = makeLoadTest(sim, def, cfg);
  if (!rig.state.ok) return { ok: false, why: rig.state.why };
  let base = null, lim = null, F = null, frames = 0;
  while (!rig.state.done && frames < 60 * 30) {
    const ph = rig.state.phase; rig.step(1 / 60); frames++;
    if (ph === 'settle' && rig.state.phase !== 'settle') base = genFicheSnap(sim);
    if (!lim && rig.state.n >= rig.limit) {
      lim = genFicheSnap(sim);
      F = sim.beams.map(b => ((b.tens && b.strain < 0) ? 0 : b.k * b.strain * b.L0));
    }
  }
  const st = rig.state;
  const util = sim.beams.map((b, i) => { const f = F ? F[i] : 0, cap = f >= 0 ? (b.fy0 || b.fu) : (b.fc0 || b.fy0 || b.fu); return cap > 0 ? genFicheR(Math.abs(f) / cap, 4) : 0; });
  let worst = 0; util.forEach((u, i) => { if (u > util[worst]) worst = i; });
  return { ok: true, limit: rig.limit, ult: rig.ult, W: genFicheR(rig.W, 1), semi: genFicheR(rig.semi), bags: rig.bags.length,
           verdict: st.verdict, limitPct: st.limitPct, ultPct: st.ultPct,
           tipM: genFicheR(st.limitPct / 100 * rig.semi, 4), ultTipM: genFicheR(st.ultPct / 100 * rig.semi, 4),
           shape: lim && base ? genFicheShape(sim, def, base, lim) : null, util, comp: F ? F.map(f => (f < 0 ? 1 : 0)) : null,
           worst, worstU: util[worst], worstComp: F ? F[worst] < 0 : false, frames };
}

// THE BENCH TO DESTRUCTION: bench_worker.js benchLoadRun's destroy path (its setup restated here; GATE PHYSPAGES holds
// the verdict, the loads and the damage record to benchLoadRun's own)
function genFicheDestroy(def0, opts) {
  const S = def0.spec || {}, U = GEN_LOAD_ULT;
  const def = Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: true }) });
  if (opts && opts.cert && opts.cert.Ft && opts.cert.nb === def.beams.length) def.cert = opts.cert;
  else if (typeof genCertAttach === 'function')
    genCertAttach(def, { world: def.parts && def.parts.floats && typeof makeWorld === 'function' ? makeWorld() : null });
  const sim = makeSim(def, null); sim.reset(0);
  const cfg = { material: (S.fuselage && S.fuselage.material) || undefined,
                wingMaterial: typeof genSurfKey === 'function' ? genSurfKey(S, 'wing', 0) : undefined,
                destroy: true, ult: 3 * U, rampS: 4 * 3 };
  const rig = makeLoadTest(sim, def, cfg);
  if (!rig.state.ok) return { ok: false, why: rig.state.why };
  let base = null, atBreak = null, frames = 0;
  while (!rig.state.done && frames < 60 * 120) {
    const ph = rig.state.phase; rig.step(1 / 60); frames++;
    if (ph === 'settle' && rig.state.phase !== 'settle') base = genFicheSnap(sim);
    if (!atBreak && rig.state.brokeAt != null) atBreak = genFicheSnap(sim);
  }
  const st = rig.state, D = sim.damage();
  const yielded = [], broken = [];
  sim.beams.forEach((b, i) => { if (b.broken) broken.push(i); else if (b.yielded) yielded.push(i); });
  return { ok: true, verdict: st.verdict, yieldAt: st.yieldAt, breakAt: st.breakAt, brokeAt: st.brokeAt,
           brokeKey: st.brokeKey, brokeSeam: st.brokeSeam, breakFirst: st.breakFirst || null,
           firstBreak: D.firstBreak ? { beam: D.firstBreak.beam, how: D.firstBreak.how, seam: D.firstBreak.seam, cls: D.firstBreak.cls } : null,
           firstYield: D.firstYield && typeof D.firstYield === 'object' ? { beam: D.firstYield.beam, cls: D.firstYield.cls } : null,
           groups: (D.groups || []).map(G => ({ key: G.key, seam: G.seam })), broken, yielded,
           shape: atBreak && base ? genFicheShape(sim, def, base, atBreak) : null, frames };
}

// THE DRAG: the rows, the gear's terms, each one's km/h
function genFicheGearTerms(S) {
  // genGearCdA's own terms, one by one (62_gen_aero.js); GATE PHYSPAGES checks the sum against genGearCdA
  const G = S.gear, semi = S.geom.semi;
  const fd = t => 1 - 0.18 * (Math.max(0.70, Math.min(1.60, t || 1)) - 1);
  const wCd = (G.fairing === 'full' ? 0.15 : G.fairing === 'spat' ? 0.22 : 0.55) * (G.fairing && G.fairing !== 'none' ? fd(G.fairTail) : 1);
  const tCd = (G.twFairing === 'full' ? 0.15 : G.twFairing === 'spat' ? 0.22 : 0.55) * (G.twFairing && G.twFairing !== 'none' ? fd(G.twFairTail) : 1);
  const R = G.wheelR || 0.20, Rt = G.twR || 0.10, legCd = (G.fairing === 'full' || G.legFair === 'fair') ? 0.30 : 1.0;
  let lever = 0;
  if (G.suspension === 'lever') {
    const lv = G.lever, dx = lv && lv.horn && lv.top ? [0, 1, 2].map(k => lv.horn[k] - lv.top[k]) : null;
    lever = 2 * legCd * (dx ? Math.hypot(dx[0], dx[1], dx[2]) : 0.50) * 0.060;
  }
  return { wheels: 2 * wCd * (2 * R * 0.76 * R), third: tCd * (2 * Rt * 0.76 * Rt), legs: 2 * legCd * (G.legDrop || 0.42) * 0.05, lever,
           thirdLeg: (G.twFairing === 'full' || G.twLegFair === 'fair' ? 0.30 : 1.0) * (G.twLeg || 0.20) * 0.05,
           struts: S.bracing && S.bracing.type === 'strut' ? 2 * 0.10 * (0.55 * semi * 1.12) * 0.06 : 0 };
}
const GEN_FICHE_DRAG_GROUPS = { fuselage: ['body'], cooling: ['cool', 'heads', 'exh'], screen: ['screen'], junct: ['junct'],
  mainGear: ['g:wheels', 'g:legs', 'g:lever'], third: ['g:third', 'g:thirdLeg'], struts: ['g:struts'], wires: ['brace'],
  nacelles: ['nacelles'], pod: ['pod'], strutPods: ['strutPods'] };
function genFicheDrag(def) {
  const S = def.spec, g = def.params.gen || {}, D = g.drag || {};
  const sim = makeSim(def, null); sim.reset(0);
  const W = sim.totalM * 9.81, aMax = 0.85 * genStallAngle(def), Vs0 = g.Vs || 10;
  const sh = genShakedown(def);
  const dragAt = (v, cda) => genProbeAt(sim, v, genAlphaForLift(sim, v, W, aMax)).drag - 0.5 * RHO * v * v * cda;
  const cruise = cda => {
    let lo = Math.max(1.05 * Vs0, sh.VbestLD || 0), hi = 4 * Vs0;
    if (dragAt(lo, cda) >= GEN_FICHE_CRUISE_K * sim.thrustAt(lo, 1)) return lo;
    for (let i = 0; i < 24; i++) { const m = 0.5 * (lo + hi); if (dragAt(m, cda) < GEN_FICHE_CRUISE_K * sim.thrustAt(m, 1)) lo = m; else hi = m; }
    return 0.5 * (lo + hi);
  };
  const v0 = cruise(0);
  const terms = genFicheGearTerms(S);
  const rows = {};
  let known = 0;
  for (const r of ['body', 'cool', 'heads', 'screen', 'junct', 'exh', 'gear', 'brace', 'pod', 'strutPods']) {
    if (D[r] > 0) rows[r] = D[r];
    known += D[r] || 0;
  }
  // what the axial row carries with no row of its own: the off-nose nacelles (62_gen_aero's G179.5 block)
  if (D.axial - known > 1e-6) rows.nacelles = D.axial - known;
  const groups = {};
  for (const k in GEN_FICHE_DRAG_GROUPS) {
    let c = 0;
    for (const r of GEN_FICHE_DRAG_GROUPS[k]) c += r.startsWith('g:') ? (terms[r.slice(2)] || 0) : (rows[r] || 0);
    if (c > 0) groups[k] = { cda: genFicheR(c, 4), dV: genFicheR(cruise(c) - v0, 3) };
  }
  const a = genAlphaForLift(sim, v0, W, aMax), pr = genProbeAt(sim, v0, a), q = 0.5 * RHO * v0 * v0;
  return { Vc: genFicheR(v0, 3), axial: genFicheR(D.axial, 4), surf: genFicheR((pr.drag - q * D.axial) / q, 4),
           rows: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, genFicheR(v, 4)])),
           gear: Object.fromEntries(Object.entries(terms).map(([k, v]) => [k, genFicheR(v, 5)])), groups,
           floats: S.gear.type === 'floats', gearType: S.gear.type };
}

// THE ELECTRICS: the record, the lamps fitted, the bus with the alternator off
function genFicheElec(def) {
  const S = def.spec || {}, cg = S.cage || {};
  const LK = Object.keys(GEN_LIGHT_AMPS);
  const lights = cg.lightOn ? LK.filter(k => cg['li_' + k + 'Fit'] == null || !!+cg['li_' + k + 'Fit']) : [];
  const sy = genSystemsResolve(S, { lights });
  const lamps = lights.map(k => ({ key: k, amps: GEN_LIGHT_AMPS[k] * (k === 'beacon' ? 0.5 : 1), cb: GEN_LIGHT_BREAKER[k] }));
  const run = (loads, alt) => {
    const bus = makeBus({ battAh: sy.battAh, altA: sy.altA, loads, breakers: sy.breakers });
    bus.master = true; bus.alt = alt; bus.avionics = true;
    bus.step(0.5, 2300, false);
    const r = { A: genFicheR(bus.loadA, 3) };
    if (!alt && sy.battAh > 0) { let t = 0; while (bus.ok && t < 6 * 3600) { bus.step(5, 2300, false); t += 5; } r.min = genFicheR(t / 60, 1); r.capped = t >= 6 * 3600; }
    return r;
  };
  const night = sy.loads.concat(lamps.map(l => ({ key: 'lt_' + l.key, amps: l.amps, cb: l.cb })));
  return { hasBus: sy.hasBus, elec: sy.elec, battAh: sy.battAh, altA: sy.altA, starter: sy.starter, vac: sy.vac,
           parts: sy.parts, breakers: sy.breakers, loads: sy.loads, lamps, bill: sy.bill.elec,
           day: run(sy.loads.slice(), true), night: run(night, true), dark: run(night, false),
           litePos: { bayFrac: cg.li_bayFrac != null ? +cg.li_bayFrac : 0.24 } };
}

// THE TANKS: the vessels as resolved, each with its bay
function genFicheTanks(def) {
  const S = def.spec || {}, E = S.energy || {};
  return { kind: E.kind || 'fuel', vessels: (E.vessels || []).map(v => {
    const R = v._res || {}, B = typeof genBayResolve === 'function' ? genBayResolve(S, v.bay, def.parts && def.parts.ST) : null;
    return { bay: v.bay, form: v.form, litres: R.litres, installedL: R.installedL, contentsKg: R.contentsKg, vesselKg: R.vesselKg,
             vessel: R.vessel && R.vessel.name, kWh: R.kWh,
             bayRes: B && { on: B.on, name: B.name, span: B.span || null, x0: B.x0, x1: B.x1, litres: B.litres } };
  }) };
}

function genFichePages(def, opts) {
  const o = opts || {};
  return { v: GEN_FICHE_PAGES_V, model: genFicheModel(def, o),
           load: o.load === false ? null : genFicheLoad(def),
           destroy: o.destroy === false ? null : genFicheDestroy(def, o),
           drag: genFicheDrag(def), elec: genFicheElec(def), tanks: genFicheTanks(def) };
}
