// ENGINE MESH — the VISUAL builder, standing on _eng_gen.js's physics.
//
// WHY A SECOND BUILDER. engResolve is the truth about mass, power and the
// envelope, and the cowl is fitted to it — that must not move. engBuild was a
// placeholder mesh: a tube, bare barrels, no plumbing, and it reached only
// half the envelope's width (its head stopped at r0+0.96*stroke+0.62b where
// the envelope's rTip is r0+stroke+1.85b). This module replaces the PICTURE,
// not the physics: it reads engResolve's own placement rule (`place`) so the
// visual engine and the cowl fit agree by construction, and it dresses the
// engine with everything you can see on a real one — finned barrels, rocker
// covers, pushrod tubes, intake risers, exhaust stacks, magnetos and their
// plug leads, carburettor, the tube mount and the firewall it bolts to.
//
// TWO PIECES OF MACHINERY carry the whole file:
//
//   1. THE ARTERY — a tube swept along a path with parallel-transport frames.
//      Plug leads, intake runners, exhaust pipes, fuel line, throttle cable:
//      all one primitive. "Cables go where they should" is then a ROUTING
//      TABLE from named ports, the same design move as ENG_ARCH: a family is
//      a table, not a builder.
//   2. THE DENSITY GOVERNOR — one target edge length, EDGE = caseR * 0.34 /
//      quality, from which EVERY part derives its section count, its path
//      sampling AND its band subdivision (lathes interpose rings, profile
//      flats interpose points). "Consistent poly density" is therefore a
//      measured property (_eng_mesh_check.js asserts it), not an eyeballed
//      one. The deliberate exception is the plain boxes (sump, case ridge),
//      marked kind:'box' so the check knows they opted out.
//
// EVERY DETAIL DIMENSION IS A RATIO of the bore or the case radius, never
// metres. The registry spans 28 mm to 1.4 m of engine — 50x — and one
// absolute constant anywhere turns some engine into a toy. The check builds
// the same engine at 2x every length input and asserts the mesh scales
// exactly; that assertion is what keeps this rule honest.
//
// SCOPE (first chantier): the FLAT family, dressed — which is six of the ten
// registry rows and the calibration anchor (A-65). Radial, two-stroke, the
// 912's gearbox/radiator and the electric outrunner are later chantiers; the
// parts library and the routing-table design are what they will reuse.
// engMeshBuild throws on any other architecture rather than half-drawing it.
//
// The mesh is an ASSEMBLY OF PARTS THAT INTERSECT, hidden by flanges and
// bosses at the joints — the gear and crew precedent. No booleans, no welded
// manifold. Faces are quads ({V, F:[{v,m}]}, the cage shape); triangles are
// quads with one repeated vertex, which quadWire and the OBJ export already
// understand. NOT subdivided: machinery renders at governor density, like
// the gear.
//
// Frame: crank axis along +z (flange face at z = 0, nose at +z), y up,
// x lateral — engResolve's frame, so the mesh drops into the same scenes.
'use strict';

const EM = (() => {
  const EG = (typeof module !== 'undefined' && typeof require === 'function')
    ? require('./_eng_gen.js') : window.ENG_GEN;

  // -------------------------------------------------------------------------
  // THE FICHE — visual parameters only; everything engResolve understands
  // (bore, stroke, cyl, rpm, finN, finR, headR, ...) rides through to it.
  // Defaults are the A-65 dressed as a Continental: pushrods BELOW (cam under
  // the crank), carb on the sump, two magnetos, short stacks.
  // -------------------------------------------------------------------------
  const ENGM_DEFAULT = {
    quality: 2.0,      // density governor (user default: hero bench at 2)
    // (G24.6, from the user's reference photos: banks sit further "en
    // quinconce", and fins are thin numerous plates, not toruses)
    // POLYCOUNT GROUPS (G24.3): 0 = auto (the governor picks sides from the
    // radius); a number is an absolute side count for that family of parts.
    // Longitudinal sampling and corner arcs stay with `quality` — these
    // control the ROUND sections, which is where the triangles live.
    sideCyl: 0,        // barrels, fins, heads, head fins
    sideShaft: 0,      // prop shaft + flange
    sideAcc: 0,        // mags, generator, oil filler, carb, airbox, spider
    sidePipe: 10,      // intake, exhaust, collector, air horn — the governor
                       // would give a thin pipe 6 sides (consistent edges!),
                       // but an open exhaust tip reads hexagonal at that
    sideDetail: 0,     // rods, plugs, leads, lines, mount tubes, washers
    screws: 1,         // the bolt sets (flange, rockers, mount) — LOD drop
    stagger: 0.5,      // bank stagger along z, / bore (conrods share a pin)
    rodPos: -1,        // pushrod tubes: -1 below (Continental/VW), +1 above (Lycoming)
    rockerW: 0.95,     // rocker cover width  / bore (spans z)
    rockerH: 0.66,     // rocker cover height / bore (spans y)
    rockerR: 0.24,     // rocker corner radius / bore
    rockerBoss: 0.05,  // centre boss height beyond the face / bore
    rockerBossW: 0.52, // centre boss footprint / cover
    // ARCHITECTURE AXES (G24.5) — these are engResolve's OWN flags riding
    // through, so the mass/power numbers follow the geometry for free:
    // `liquid` swaps fins for a water jacket + radiator + hoses, `geared`
    // grows the gearbox bell on the nose, `twoStroke` deletes the
    // valvetrain (rockers, pushrods) and moves the plugs to the head dome.
    baseFins: 1,       // finned barrels (a liquid engine will turn these off)
    headFins: 8,       // fin plates on the head barrel
    intake: 1,         // intake risers, sump plenum -> head bottom aft
    exStyle: 1,        // 0 none · 1 short stacks · 2 collector per side
    exDrop: 1.5,       // stack drop below the sump, / bore
    leads: 1,          // ignition harness: 2 plugs + 2 leads per cylinder
    leadR: 0.034,      // lead radius / bore
    mags: 1,           // two magnetos on the accessory case
    genOn: 1,          // generator/alternator lump on the case top
    oilFill: 1,        // oil filler neck + cap
    carbOn: 1,         // carburettor under the sump
    airbox: 1,         // air filter canister ahead of the induction unit
    injected: 0,       // induction: 0 = carburettor, 1 = fuel injection —
                       // EXCLUSIVE (G24.13): injection replaces the float
                       // bowl with a servo body + spider, never both
    finShape: 0,       // barrel fins: 0 = discs, 1 = square plates (912)
    rockerSpan: 0,     // 1 = ONE cover per bank (the VW conversion look)
    plumb: 1,          // fuel line + throttle cable, firewall -> carb
    // RADIATOR (liquid only), position + size in caseR units (G24.9):
    radX: 0,           // lateral offset
    radY: 0.55,        // gap above the case top
    radZ: 0.55,        // forward of the case aft face
    radW: 2.0,         // core width
    radH: 0.75,        // core height
    radD: 0.42,        // core depth
    mount: 1,          // conical tube mount + rubber shock stacks
    mountX: 1,         // diagonal brace tubes in the side planes
    mountGap: 0.85,    // firewall stand-off behind the engine, / caseR
    fwOn: 1,           // the firewall plate itself
    // THE PLATE IS AIRCRAFT-SIDE, IN METRES — the declared exception to the
    // everything-is-a-ratio rule (G24.4, user ruling: fixed across presets).
    // The scale-invariance check builds with fwOn:0 for exactly this reason.
    fwW: 0.80,         // firewall width,  METRES
    fwH: 0.70,         // firewall height, METRES
    fwSpread: 1.5,     // firewall mount points, spread / lug spread
    ruler: 1,          // 0.1 m tick strip on the plate (0.5 m ticks taller)
  };

  // Slider identity for the page — flat list, ranges live with the page.
  const ENGM_PARAMS = Object.keys(ENGM_DEFAULT);

  const ENGM_MAT = {
    case: 'emCase', ridge: 'emRidge', sump: 'emSump', acc: 'emAcc',
    pad: 'emPad',
    barrel: 'emBarrel', fin: 'emFin', head: 'emHead', rocker: 'emRocker',
    rod: 'emRod', intake: 'emIntake', exhaust: 'emExhaust',
    plug: 'emPlug', ceramic: 'emCeramic', lead: 'emLead',
    mag: 'emMag', cap: 'emMagCap',
    gen: 'emGen', oil: 'emOil', carb: 'emCarb', air: 'emAir',
    filter: 'emFilter',
    spider: 'emSpider', flange: 'emFlange', mount: 'emMount',
    puck: 'emPuck', firewall: 'emFirewall', mark: 'emMark',
    fuel: 'emFuel', throttle: 'emThrottle',
  };

  // ---- tiny vector kit ----------------------------------------------------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                         a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // a frame perpendicular to d: u ⊥ d, w ⊥ d ⊥ u
  const frameOf = d => {
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = nrm(crs(d, ref));
    return { u, w: nrm(crs(d, u)) };
  };

  // -------------------------------------------------------------------------
  // BUILD
  // -------------------------------------------------------------------------
  function engMeshBuild(spec) {
    const R = EG.engResolve(spec);
    // dressed families: FLAT, and INLINE for two-strokes (G24.12 — the
    // registry's 277/582; an inline four-stroke would need its own
    // valvetrain dress and refuses loudly rather than half-drawing)
    if (R.arch !== 'flat' && !(R.arch === 'inline' && R.P.twoStroke))
      throw new Error('engMeshBuild: dressed families are flat and ' +
                      'inline two-stroke (got "' + R.arch + '"' +
                      (R.arch === 'inline' ? ', four-stroke' : '') + ')');
    const inline = R.arch === 'inline';
    const P = Object.assign({}, ENGM_DEFAULT, R.P);   // R.P carries ride-through keys
    // the MESH's own default for a knob the physics fiche also carries:
    // real fins are thin and NUMEROUS (G24.6) — spec still overrides
    if (!spec || spec.finN === undefined) P.finN = 14;
    const L = R.place;
    const b = R.P.bore, cR = L.caseR;

    // ---- THE DENSITY GOVERNOR ---------------------------------------------
    // One edge target for the whole engine. 0.34*caseR at quality 1 gives the
    // A-65's case ~20 sides and its barrels ~10, which is where the old
    // hand-set sect=12 lived; everything else follows the same number.
    const EDGE = cR * 0.34 / Math.max(0.2, P.quality);
    // an explicit side count (from the polycount groups) beats the governor
    const sectOf = (r, s) => s > 0
      ? Math.max(4, Math.min(48, Math.round(s)))
      : Math.max(6, Math.min(48, Math.round(2 * Math.PI * r / EDGE)));
    const stepsOf = l => Math.max(1, Math.min(64, Math.round(l / EDGE)));
    const S = { cyl: P.sideCyl, shaft: P.sideShaft, acc: P.sideAcc,
                pipe: P.sidePipe, detail: P.sideDetail };
    // corner-arc sampling for the rounded-rect parts (rocker covers, head
    // fin plates): rides the cyl side group when set, else the quality
    // dial — their corners are too small for the edge target to resolve,
    // so the governor alone left them visually static (G24.8)
    const ARC = S.cyl ? Math.max(2, Math.round(S.cyl / 5))
                      : Math.max(2, Math.round(2.5 * P.quality));
    // OPTION COMPATIBILITY (G24.13, audited): the flags below are the
    // resolved truth every builder reads — incompatible asks resolve here,
    // in one place, instead of half-happening downstream.
    //   injection is exclusive with the carburettor (servo body instead of
    //   float bowl) and meaningless on a two-stroke; two-strokes have no
    //   valvetrain and no head intake; liquid kills fins; inlines force
    //   expansion exhausts. The radiator side moves the whole cooling
    //   circuit's anchors.
    const inj = !!P.injected && !P.twoStroke;
    const below = !!P.liquid && P.radY < 0;

    // ---- mesh + part bookkeeping ------------------------------------------
    const V = [], F = [], parts = [];
    let cur = null;
    const part = (name, kind, comps) => {
      if (cur) { cur.v1 = V.length; cur.f1 = F.length; }
      cur = { name, kind: kind || 'solid', comps: comps || 1,
              v0: V.length, f0: F.length };
      parts.push(cur);
    };
    const endParts = () => { if (cur) { cur.v1 = V.length; cur.f1 = F.length; cur = null; } };
    const v = p => { V.push(p); return V.length - 1; };
    const quad = (a, c, d, e, m) => F.push({ v: [a, c, d, e], m });

    // optional zClamp = [lo, hi]: points beyond it slide onto the plane —
    // a clamped fin disc grows the FLAT a real fin wears where its
    // neighbour lives (G24.5, the cylinder-intersection cure)
    const ring = (c, u, w, r, n, zClamp) => {
      const out = [];
      for (let k = 0; k < n; k++) {
        const t = k / n * 2 * Math.PI, ct = Math.cos(t), st = Math.sin(t);
        const p = [c[0] + (u[0] * ct + w[0] * st) * r,
                   c[1] + (u[1] * ct + w[1] * st) * r,
                   c[2] + (u[2] * ct + w[2] * st) * r];
        if (zClamp) p[2] = Math.max(zClamp[0], Math.min(zClamp[1], p[2]));
        out.push(v(p));
      }
      return out;
    };
    // an arbitrary 2D profile (list of [a,b] in the u,w plane) as a ring
    const ringShape = (c, u, w, pts) => pts.map(p =>
      v([c[0] + u[0] * p[0] + w[0] * p[1],
         c[1] + u[1] * p[0] + w[1] * p[1],
         c[2] + u[2] * p[0] + w[2] * p[1]]));
    const band = (A, B, m) => {
      for (let k = 0; k < A.length; k++) {
        const k2 = (k + 1) % A.length;
        quad(A[k], A[k2], B[k2], B[k], m);
      }
    };
    const capFan = (rg, c, m, flip) => {
      const ci = v(c);
      for (let k = 0; k < rg.length; k++) {
        const k2 = (k + 1) % rg.length;
        quad(ci, flip ? rg[k2] : rg[k], flip ? rg[k] : rg[k2], ci, m);
      }
    };
    // a cap that OBEYS THE GOVERNOR: a big face (firewall, case end) filled
    // with concentric rings shrinking to the centre, so its radial edges are
    // ~EDGE like everything else — a plain fan's spokes would be the longest
    // edges in the mesh and the density check would rightly flag them.
    const capAuto = (rg, c, m, flip) => {
      const rmax = Math.max(...rg.map(i => len(sub(V[i], c))));
      const k = stepsOf(rmax);
      if (k <= 1) return capFan(rg, c, m, flip);
      let prev = rg;
      for (let j = 1; j < k; j++) {
        const s = 1 - j / k;
        const inner = rg.map(i => v(mad(c, sub(V[i], c), s)));
        band(flip ? inner : prev, flip ? prev : inner, m);
        prev = inner;
      }
      capFan(prev, c, m, flip);
    };

    // ---- BEVELS -----------------------------------------------------------
    // Machined metal has no zero-radius edges (user G24.1 ruling: "bevel all
    // these hard edges"). Every profile corner is cut by a small two-step
    // chamfer BEFORE revolving — one rule in the primitives, and every lathe,
    // case rim, flange step and washer picks it up at once. Sized by the
    // engine (a ratio, never metres) and clamped by its own segments so a
    // plug boss gets a sliver where the case gets a real radius.
    const BEV = 0.055 * cR;
    const chamfer2D = (steps, bev) => {
      if (steps.length < 3) return steps;
      const out = [steps[0]];
      for (let i = 1; i + 1 < steps.length; i++) {
        const a = out[out.length - 1], p = steps[i], c = steps[i + 1];
        if (p.r <= 0) { out.push(p); continue; }
        const d0 = [p.t - a.t, p.r - a.r], d1 = [c.t - p.t, c.r - p.r];
        const l0 = Math.hypot(d0[0], d0[1]), l1 = Math.hypot(d1[0], d1[1]);
        if (!l0 || !l1) { out.push(p); continue; }
        const sin = Math.abs(d0[0] * d1[1] - d0[1] * d1[0]) / (l0 * l1);
        if (sin < 0.10) { out.push(p); continue; }            // straight-ish
        const cc = Math.min(bev, 0.40 * l0, 0.40 * l1);
        const pA = { t: p.t - d0[0] / l0 * cc, r: p.r - d0[1] / l0 * cc };
        const pC = { t: p.t + d1[0] / l1 * cc, r: p.r + d1[1] / l1 * cc };
        out.push(pA, { t: 0.25 * pA.t + 0.5 * p.t + 0.25 * pC.t,
                       r: 0.25 * pA.r + 0.5 * p.r + 0.25 * pC.r }, pC);
      }
      out.push(steps[steps.length - 1]);
      return out;
    };

    // ---- LATHE: one profile revolved along one axis -----------------------
    // steps: [{t, r}] with t along `axis` from `o`; r = 0 is a CAP POINT —
    // the fan is emitted at the r=0 step's own t, so a profile that starts or
    // ends at zero radius closes itself. capA/capB CONVERT the open ends into
    // r=0 points, which routes them through the same chamfer — a capped end
    // gets a beveled rim for free. Long segments interpose rings by the
    // governor. Section count off the largest radius: one topology end to end.
    const lathe = (o, axis, uw, steps, m, capA, capB, sides) => {
      const { u, w } = uw || frameOf(axis);
      if (capA && steps[0].r > 0)
        steps = [{ t: steps[0].t, r: 0 }, ...steps];
      if (capB && steps[steps.length - 1].r > 0)
        steps = [...steps, { t: steps[steps.length - 1].t, r: 0 }];
      steps = chamfer2D(steps, BEV);
      const n = sectOf(Math.max(...steps.map(s => s.r)), sides);
      // expand: subdivide segments whose length beats the edge target
      const ex = [steps[0]];
      for (let i = 1; i < steps.length; i++) {
        const a = steps[i - 1], c = steps[i];
        const d = Math.hypot(c.t - a.t, c.r - a.r);
        const k = (a.r > 0 && c.r > 0) ? stepsOf(d) : 1;
        for (let j = 1; j <= k; j++)
          ex.push(j === k ? c : { t: a.t + (c.t - a.t) * j / k,
                                  r: a.r + (c.r - a.r) * j / k });
      }
      let prev = null;
      const rings = [];
      for (const st of ex) {
        const rg = st.r > 0 ? ring(mad(o, axis, st.t), u, w, st.r, n) : null;
        if (rg && prev) band(prev, rg, m);
        if (rg && !prev && rings.some(x => x === null))       // r=0 -> real: open cone
          capAuto(rg, mad(o, axis, st.t), m, true);
        if (!rg && prev)                                      // real -> r=0: close
          capAuto(prev, mad(o, axis, st.t), m, false);
        rings.push(rg);
        prev = rg;
      }
      const real = rings.filter(r => r);
      return { first: real[0], last: real[real.length - 1], n };
    };

    // ---- THE ARTERY: parallel-transport tube sweep ------------------------
    // path: list of points. r: scalar or per-point array. The frame is
    // transported (previous normal re-projected off the new tangent), which
    // is what keeps a lead from twisting through a bend.
    const sweep = (path, r, m, opt) => {
      opt = opt || {};
      const N = path.length;
      const T = [];
      for (let i = 0; i < N; i++) {
        const a = path[Math.max(0, i - 1)], c = path[Math.min(N - 1, i + 1)];
        T.push(nrm(sub(c, a)));
      }
      let nv = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      nv = nrm(sub(nv, mul(T[0], dot(nv, T[0]))));
      const rr = i => Array.isArray(r) ? r[i] : r;
      const sect = sectOf(Math.max(...path.map((_, i) => rr(i))), opt.sides);
      const rings = [];
      let lastN = nv;
      for (let i = 0; i < N; i++) {
        if (i) lastN = nrm(sub(lastN, mul(T[i], dot(lastN, T[i]))));
        const bw = nrm(crs(T[i], lastN));
        rings.push(ring(path[i], lastN, bw, rr(i), sect));
        if (i === N - 1) nv = { n: lastN, b: bw };            // kept for the lip
      }
      for (let i = 0; i + 1 < N; i++) band(rings[i], rings[i + 1], m);
      if (opt.capA) capFan(rings[0], path[0], m, true);
      if (opt.capB) capFan(rings[N - 1], path[N - 1], m, false);
      if (opt.lipB) {          // an OPEN pipe end: rim turned inward, then closed
        const last = rings[rings.length - 1];
        const inner = ring(path[N - 1], nv.n, nv.b, rr(N - 1) * 0.72, last.length);
        band(last, inner, m);
        capFan(inner, path[N - 1], m, false);
      }
      return { a0: path[0], a1: path[N - 1] };
    };

    // ---- path builders ----------------------------------------------------
    // even re-sampling by the governor, so a path's edge length IS the target
    const resample = pts => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++)
        cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
      const tot = cum[cum.length - 1];
      const n = Math.max(2, stepsOf(tot));
      const out = [];
      let i = 0;
      for (let j = 0; j <= n; j++) {
        const s = j / n * tot;
        while (i + 1 < cum.length - 1 && cum[i + 1] < s) i++;
        const t = (s - cum[i]) / ((cum[i + 1] - cum[i]) || 1);
        out.push(mad(pts[i], sub(pts[i + 1], pts[i]), t));
      }
      return out;
    };
    // waypoints -> polyline with ROUNDED CORNERS (quadratic arc per corner,
    // sampled by the governor) — the elbow every pipe needs.
    const fillet = (pts, rad) => {
      const out = [pts[0]];
      for (let i = 1; i + 1 < pts.length; i++) {
        const p = pts[i];
        const d0 = sub(p, pts[i - 1]), d1 = sub(pts[i + 1], p);
        const l0 = len(d0), l1 = len(d1);
        const rr = Math.min(rad, 0.44 * l0, 0.44 * l1);
        const a = mad(p, d0, -rr / l0), c = mad(p, d1, rr / l1);
        const k = Math.max(2, stepsOf(2 * rr));
        for (let j = 0; j <= k; j++) {
          const t = j / k, s = 1 - t;
          out.push([s * s * a[0] + 2 * s * t * p[0] + t * t * c[0],
                    s * s * a[1] + 2 * s * t * p[1] + t * t * c[1],
                    s * s * a[2] + 2 * s * t * p[2] + t * t * c[2]]);
        }
      }
      out.push(pts[pts.length - 1]);
      return resample(out);
    };
    // Catmull-Rom through the waypoints — the CABLE path: it sags where the
    // waypoints sag and never kinks. Endpoints are hit exactly (t=1 gives p2).
    const smooth = pts => {
      const at = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
      let tot = 0;
      for (let i = 0; i + 1 < pts.length; i++) tot += len(sub(pts[i + 1], pts[i]));
      const n = Math.max(6, stepsOf(tot));
      const out = [];
      for (let j = 0; j <= n; j++) {
        const s = j / n * (pts.length - 1);
        const i = Math.min(pts.length - 2, Math.floor(s)), t = s - i;
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
        const t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map(k =>
          0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t +
                 (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
                 (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
      return out;
    };

    // rounded-rect profile in a 2D plane; corner arcs AND the straight flats
    // are sampled by the governor, so a big plate is not four long edges
    const roundRect = (w2, h2, r, kO) => {
      const k = kO || Math.max(2, stepsOf(0.5 * Math.PI * r));
      const pts = [];
      const cs = [[w2 / 2 - r, h2 / 2 - r, 0], [-(w2 / 2 - r), h2 / 2 - r, 0.5],
                  [-(w2 / 2 - r), -(h2 / 2 - r), 1], [w2 / 2 - r, -(h2 / 2 - r), 1.5]];
      for (let ci = 0; ci < 4; ci++) {
        const [cx, cy, a0] = cs[ci];
        for (let j = 0; j <= k; j++) {
          const a = (a0 + j / k * 0.5) * Math.PI;
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        // the flat run to the next corner's first point
        const [nx, ny, na] = cs[(ci + 1) % 4];
        const p0 = pts[pts.length - 1];
        const p1 = [nx + r * Math.cos(na * Math.PI), ny + r * Math.sin(na * Math.PI)];
        const fl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const fk = stepsOf(fl);
        for (let j = 1; j < fk; j++)
          pts.push([p0[0] + (p1[0] - p0[0]) * j / fk,
                    p0[1] + (p1[1] - p0[1]) * j / fk]);
      }
      return pts;
    };
    // an arbitrary 2D outline: corners rounded by the governor (or kO),
    // edges subdivided — polyShape is to a trapezoid what roundRect is to
    // a rect
    const polyShape = (pts, rad, kO) => {
      const N = pts.length, arcs = [];
      for (let i = 0; i < N; i++) {
        const p = pts[i], a = pts[(i + N - 1) % N], c = pts[(i + 1) % N];
        const d0 = [p[0] - a[0], p[1] - a[1]], d1 = [c[0] - p[0], c[1] - p[1]];
        const l0 = Math.hypot(d0[0], d0[1]), l1 = Math.hypot(d1[0], d1[1]);
        const rr = Math.min(rad, 0.35 * l0, 0.35 * l1);
        const pA = [p[0] - d0[0] / l0 * rr, p[1] - d0[1] / l0 * rr];
        const pC = [p[0] + d1[0] / l1 * rr, p[1] + d1[1] / l1 * rr];
        const k = kO || Math.max(2, stepsOf(2 * rr)), arc = [];
        for (let j = 0; j <= k; j++) {
          const t = j / k, s = 1 - t;
          arc.push([s * s * pA[0] + 2 * s * t * p[0] + t * t * pC[0],
                    s * s * pA[1] + 2 * s * t * p[1] + t * t * pC[1]]);
        }
        arcs.push(arc);
      }
      const out = [];
      for (let i = 0; i < N; i++) {
        out.push(...arcs[i]);
        const e0 = arcs[i][arcs[i].length - 1], e1 = arcs[(i + 1) % N][0];
        const fl = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
        const fk = stepsOf(fl);
        for (let j = 1; j < fk; j++)
          out.push([e0[0] + (e1[0] - e0[0]) * j / fk,
                    e0[1] + (e1[1] - e0[1]) * j / fk]);
      }
      return out;
    };
    // a prism: one 2D shape extruded from t0 to t1 along `axis`. `bev` cuts
    // the rims (the shape insets about its own bbox centre); the run is
    // subdivided by the governor like every other long surface.
    const prism = (o, axis, u, w, shape, t0, t1, m, capA, capB, bev) => {
      const xs = shape.map(p => p[0]), ys = shape.map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const hx = (Math.max(...xs) - Math.min(...xs)) / 2;
      const hy = (Math.max(...ys) - Math.min(...ys)) / 2;
      const span = Math.abs(t1 - t0), sgn = Math.sign(t1 - t0) || 1;
      const bv = Math.min(bev || 0, 0.40 * span, 0.5 * Math.min(hx, hy));
      const kIn = bv > 0 ? 1 - bv / Math.min(hx, hy) : 1;
      const inset = shape.map(p => [cx + (p[0] - cx) * kIn, cy + (p[1] - cy) * kIn]);
      const ts = [{ t: t0, s: inset }];
      if (bv > 0) ts.push({ t: t0 + sgn * bv, s: shape });
      const i0 = t0 + sgn * bv, i1 = t1 - sgn * bv;
      const nk = Math.max(1, stepsOf(Math.abs(i1 - i0)));
      for (let j = 1; j < nk; j++)
        ts.push({ t: i0 + (i1 - i0) * j / nk, s: shape });
      if (bv > 0) ts.push({ t: i1, s: shape });
      ts.push({ t: t1, s: inset });
      const rings = ts.map(st => ringShape(mad(o, axis, st.t), u, w, st.s));
      for (let i = 0; i + 1 < rings.length; i++) band(rings[i + 1], rings[i], m);
      const cOf = t => [o[0] + axis[0] * t + u[0] * cx + w[0] * cy,
                        o[1] + axis[1] * t + u[1] * cx + w[1] * cy,
                        o[2] + axis[2] * t + u[2] * cx + w[2] * cy];
      if (capA) capAuto(rings[0], cOf(t0), m, false);
      if (capB) capAuto(rings[rings.length - 1], cOf(t1), m, true);
      return { A: rings[0], B: rings[rings.length - 1] };
    };
    // a shape lathed along an axis with per-step scale (the case, the acc
    // dome) — the same phantom-cap + chamfer route as lathe, so its rims
    // bevel too; scale is chamfered in metre space via the shape's radius
    const shapeLathe = (o, axis, u, w, shape, steps, m, capA, capB) => {
      const S0 = Math.max(...shape.map(p => Math.hypot(p[0], p[1])));
      let st = steps.map(s => ({ t: s.t, r: s.s * S0 }));
      if (capA && st[0].r > 0) st = [{ t: st[0].t, r: 0 }, ...st];
      if (capB && st[st.length - 1].r > 0)
        st = [...st, { t: st[st.length - 1].t, r: 0 }];
      st = chamfer2D(st, BEV);
      const ex = [st[0]];
      for (let i = 1; i < st.length; i++) {
        const a = st[i - 1], c = st[i];
        const k = (a.r > 0 && c.r > 0)
          ? stepsOf(Math.hypot(c.t - a.t, c.r - a.r)) : 1;
        for (let j = 1; j <= k; j++)
          ex.push(j === k ? c : { t: a.t + (c.t - a.t) * j / k,
                                  r: a.r + (c.r - a.r) * j / k });
      }
      let prev = null, sawNull = false;
      for (const s2 of ex) {
        const rg = s2.r > 1e-12
          ? ringShape(mad(o, axis, s2.t), u, w,
                      shape.map(p => [p[0] * s2.r / S0, p[1] * s2.r / S0]))
          : null;
        if (rg && prev) band(prev, rg, m);
        if (rg && !prev && sawNull) capAuto(rg, mad(o, axis, s2.t), m, true);
        if (!rg && prev) capAuto(prev, mad(o, axis, s2.t), m, false);
        if (!rg) sawNull = true;
        prev = rg;
      }
    };
    // a WASHER + HEX HEAD — what reads as "bolted" at arm's length. Two
    // pieces (they do not share verts), so a part of N bolts declares 2N.
    const bolt = (pos, dir, rb, m) => {
      const { u, w } = frameOf(dir);
      lathe(pos, dir, { u, w }, [
        { t: 0, r: 1.7 * rb }, { t: 0.35 * rb, r: 1.7 * rb },
      ], m, true, true, S.detail);
      const hex = [];
      for (let k = 0; k < 6; k++) {
        const a2 = (k + 0.5) / 6 * 2 * Math.PI;
        hex.push([Math.cos(a2) * rb, Math.sin(a2) * rb]);
      }
      prism(pos, dir, u, w, hex, 0.35 * rb, 1.05 * rb, m, false, true);
    };
    // THIN PLATE FINS: each fin is an extruded plane — two faces and a
    // beveled knife rim. UNIFORM by user ruling (G24.8: the machined
    // barrel stack is regular; randomisation reverted) — only the gentle
    // base-to-head taper gradient remains. zLim clips against the
    // neighbour cylinder, growing the flat the real casting wears.
    const finStack = (at, u, w, f0, f1, n, rIn, rBase, grad, sect, zLim, m) => {
      for (let k = 0; k < n; k++) {
        const tC = f0 + (k + 0.5) / n * (f1 - f0);
        const th = (f1 - f0) / n * 0.16;
        const rB = rBase * (1 - grad + grad * 2 * ((k + 0.5) / n));
        const mk = (rim, dt, shrink) => {
          const c0 = at(tC + dt), out = [];
          for (let j = 0; j < sect; j++) {
            const a2 = j / sect * 2 * Math.PI;
            const rr = (rim ? rB : rIn) - (shrink || 0);
            const ca = Math.cos(a2), sa = Math.sin(a2);
            const p = [c0[0] + (u[0] * ca + w[0] * sa) * rr,
                       c0[1] + (u[1] * ca + w[1] * sa) * rr,
                       c0[2] + (u[2] * ca + w[2] * sa) * rr];
            if (zLim) p[2] = Math.max(zLim[0], Math.min(zLim[1], p[2]));
            out.push(v(p));
          }
          return out;
        };
        const bev = 0.018 * b;
        const A0 = mk(false, -th), A1 = mk(true, -th, bev);
        const Mm = mk(true, 0), B1 = mk(true, th, bev), B0 = mk(false, th);
        band(A0, A1, m); band(A1, Mm, m); band(Mm, B1, m); band(B1, B0, m);
      }
    };
    // SQUARE HEAD FINS (G24.7, from the user's reference): the head
    // casting's fins are rounded-corner RECTANGLES — square flats meet the
    // neighbour by construction — NOTCHED top and bottom in line with the
    // spark plugs, so the plug bosses live in a clean channel instead of
    // punching through plates. Solid plates: the centre is buried in the
    // head, so the faces stop at 0.45 scale and never pay for a hole.
    // UNIFORM (G24.8: randomisation reverted); corner arcs ride ARC so the
    // density settings reach them.
    const finPlates = (at, f0, f1, n, H, zLo, zHi, cr, notch, e2, m) => {
      for (let k = 0; k < n; k++) {
        const tC = f0 + (k + 0.5) / n * (f1 - f0);
        const th = (f1 - f0) / n * 0.16;
        const Hk = H;
        const pts = [[zHi, -Hk], [zHi, Hk]];
        const nd = notch ? Hk - notch.floor : 0;
        const useN = notch && nd > 0.08 * b &&
          notch.z - notch.w > zLo + cr + 0.02 * b &&
          notch.z + notch.w < zHi - cr - 0.02 * b;
        if (useN)
          pts.push([notch.z + notch.w, Hk], [notch.z + notch.w, Hk - nd],
                   [notch.z - notch.w, Hk - nd], [notch.z - notch.w, Hk]);
        pts.push([zLo, Hk], [zLo, -Hk]);
        if (useN)
          pts.push([notch.z - notch.w, -Hk], [notch.z - notch.w, -(Hk - nd)],
                   [notch.z + notch.w, -(Hk - nd)], [notch.z + notch.w, -Hk]);
        const out = polyShape(pts, cr, ARC);
        const inner = out.map(p => [p[0] * 0.45, p[1] * 0.45]);
        // the rim bevel is a NORMAL OFFSET, not a scale: scaling about the
        // centre shifted the notch walls sideways and twisted the bevel
        // quads — the shading artifact the user circled (G24.9)
        const bevd = 0.018 * b;
        const ins = out.map((p, i) => {
          const a2 = out[(i + out.length - 1) % out.length];
          const c2 = out[(i + 1) % out.length];
          const e0 = [p[0] - a2[0], p[1] - a2[1]];
          const e1 = [c2[0] - p[0], c2[1] - p[1]];
          const l0 = Math.hypot(e0[0], e0[1]) || 1;
          const l1 = Math.hypot(e1[0], e1[1]) || 1;
          const n0 = [-e0[1] / l0, e0[0] / l0], n1 = [-e1[1] / l1, e1[0] / l1];
          let nx = n0[0] + n1[0], ny = n0[1] + n1[1];
          const nl = Math.hypot(nx, ny) || 1;
          nx /= nl; ny /= nl;
          const cosH = Math.max(0.4, nx * n0[0] + ny * n0[1]);
          return [p[0] + nx * bevd / cosH, p[1] + ny * bevd / cosH];
        });
        const mk = (arr, dt) => arr.map(p =>
          v(mad(mad(at(tC + dt), e2, p[1]), [0, 0, 1], p[0])));
        const A0 = mk(inner, -th), A1 = mk(ins, -th);
        const Mm = mk(out, 0), B1 = mk(ins, th), B0 = mk(inner, th);
        band(A0, A1, m); band(A1, Mm, m); band(Mm, B1, m); band(B1, B0, m);
      }
    };
    // a REAL spark plug (G24.6): steel boss, hex, the white ceramic the
    // eye finds, and the terminal the lead lands on. The terminal tip is
    // base + 0.41b along the axis — the layout's plug PORTS use the same
    // number, so leads and geometry agree by construction.
    const sparkPlug = (base, ax) => {
      const { u, w } = frameOf(ax);
      lathe(base, ax, { u, w }, [
        { t: -0.06 * b, r: 0.085 * b }, { t: 0.14 * b, r: 0.080 * b },
      ], ENGM_MAT.plug, false, false, S.detail);
      const hex = [];
      for (let k = 0; k < 6; k++) {
        const a2 = (k + 0.5) / 6 * 2 * Math.PI;
        hex.push([Math.cos(a2) * 0.075 * b, Math.sin(a2) * 0.075 * b]);
      }
      prism(base, ax, u, w, hex, 0.14 * b, 0.23 * b, ENGM_MAT.plug, false, true);
      lathe(base, ax, { u, w }, [
        { t: 0.23 * b, r: 0.052 * b }, { t: 0.30 * b, r: 0.050 * b },
        { t: 0.36 * b, r: 0.034 * b },
      ], ENGM_MAT.ceramic, true, true, S.detail);
      lathe(base, ax, { u, w }, [
        { t: 0.355 * b, r: 0.024 * b }, { t: 0.41 * b, r: 0.022 * b },
      ], ENGM_MAT.plug, false, true, S.detail);
    };

    // =======================================================================
    // LAYOUT — every port the routing table cites, computed once.
    // =======================================================================
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
    const zFront = -R.P.flangeLen;
    const zBack = L.zAft + (R.P.accessories ? R.P.accLen : 0);
    const hasAcc = !!R.P.accessories;

    const cyls = [];
    for (let i = 0; i < R.cyl; i++) {
      // the INLINE lies on its side (G24.14, user ruling): all cylinders
      // to ONE flank, apparatus on the other — a single lateral bank, so
      // every flat-bank builder applies verbatim. (engResolve's envelope
      // still assumes the vertical inline — a divergence for the cowl to
      // note, physics-side.)
      const a = inline ? Math.PI / 2 : L.ang[i];
      const sx = Math.sin(a) >= 0 ? 1 : -1;
      // bank stagger: the two rods share one crankpin, so one bank leads
      // (an inline has one bank — no stagger)
      const z = L.zOf(L.stn[i]) + (inline ? 0 : sx * 0.5 * P.stagger * b);
      const rr0 = cR * 0.96;                    // barrel root, buried in the case
      const finTop = L.r0 + R.P.stroke + 0.55 * b;   // fin zone ends, head begins
      const headTop = finTop + 0.85 * b;
      const rockerOut = L.rTip;                 // the DRESSED width IS the envelope's
      // the frame is engResolve's own placement rule: an angle about the
      // crank — flat gives lateral cylinders, inline vertical ones
      const dir = [Math.sin(a), Math.cos(a), 0];
      const uw = { u: [Math.cos(a), -Math.sin(a), 0], w: [0, 0, 1] };
      // the plate/cover free axis: ⊥ the cylinder, in the engine's plane
      const e2 = Math.abs(Math.sin(a)) > 0.5 ? [0, 1, 0] : [1, 0, 0];
      cyls.push({
        i, sx, z, dir, uw, e2,
        rr0, finTop, headTop, rockerOut,
        at: r => [dir[0] * r, dir[1] * r, z],
        // ports (all on the head, where the real bosses are)
        // a two-stroke's plugs sit in the head dome, side by side; a
        // four-stroke's flank the rocker box top and bottom. The PORT is
        // the plug's TERMINAL (base + 0.41b of plug stack) — the lead
        // lands where a lead lands (G24.6).
        plugBaseT: P.twoStroke
          ? [sx * (rockerOut - 0.24 * b), 0.30 * b, z - 0.16 * b]
          : [sx * (finTop + 0.42 * b), 0.50 * b, z - 0.14 * b],
        plugBaseB: P.twoStroke
          ? [sx * (rockerOut - 0.24 * b), -0.30 * b, z - 0.16 * b]
          : [sx * (finTop + 0.42 * b), -0.50 * b, z - 0.14 * b],
        plugT: P.twoStroke
          ? [sx * (rockerOut + 0.17 * b), 0.30 * b, z - 0.16 * b]
          : [sx * (finTop + 0.42 * b), 0.91 * b, z - 0.14 * b],
        plugB: P.twoStroke
          ? [sx * (rockerOut + 0.17 * b), -0.30 * b, z - 0.16 * b]
          : [sx * (finTop + 0.42 * b), -0.91 * b, z - 0.14 * b],
        intakeP: [sx * (finTop + 0.30 * b), -0.52 * b, z + 0.34 * b],
        exhaustP: [sx * (finTop + 0.30 * b), -0.52 * b, z - 0.34 * b],
      });
    }
    // NEIGHBOUR GAPS (G24.5): same-bank cylinders sit one pitch apart and
    // their fins and heads are WIDER than the half-pitch — the real engine
    // clips them flat against each other, so the mesh does too.
    for (const bank of [-1, 1]) {
      const row = cyls.filter(c => c.sx === bank).sort((a, b2) => a.z - b2.z);
      for (let i = 0; i < row.length; i++) {
        row[i].gapDn = i > 0 ? row[i].z - row[i - 1].z : 1e9;
        row[i].gapUp = i + 1 < row.length ? row[i + 1].z - row[i].z : 1e9;
      }
    }
    // THE CASE FOLLOWS THE STAGGER (G24.10): the quinconce moved the banks
    // but the block did not, and the leading pad hung in air past the nose
    // (user catch) — and the assert then caught the SAME overhang at the
    // tail. Both ends now cover the outermost pad; the nose is capped so a
    // stub of shaft still shows, and everything aft (acc tiers, mags,
    // lugs) keys off the extended tail.
    // coverage is MANDATORY (the pad assert); the shaft-stub preference
    // yields when a big bore needs the room (IO-360, caught by the assert)
    const zNose = Math.max(zFront,
      Math.min(-0.02 * R.P.flangeLen,
               Math.max(Math.max(...cyls.map(c => c.z), -1e9) + 0.80 * b,
                        -0.30 * R.P.flangeLen)));
    const zTail = Math.min(zBack,
      Math.min(...cyls.map(c => c.z), 1e9) - 0.80 * b);

    // THE ACCESSORY BODY IS TWO TIERS (G24.4): a short backplate at 0.88 of
    // the case, then a small centre hump at 0.60 — which is both what the
    // real part looks like AND what lets straight mount tubes clear it.
    const accT1 = zTail - 0.24 * cR;                 // backplate aft face
    const ACC1 = 0.88, ACC2 = 0.60;

    // magnetos hang off the BACKPLATE's aft face, body + distributor cap +
    // one lead tower per cylinder (the harness starts on real metal now)
    const mkMag = sx => {
      const r = 0.30 * b;
      const pos = [sx * 0.50 * cR, 0.55 * cR, accT1 - 1.4 * r];
      const capZ = pos[2] - 1.25 * r;                // cap front face
      const n = Math.max(1, R.cyl);
      const dx = Math.min(0.55, 2.0 / Math.max(1, n - 1)) * r;
      const towers = [];
      for (let i = 0; i < n; i++)
        towers.push([pos[0] + (i - (n - 1) / 2) * dx, pos[1] + 1.35 * r,
                     capZ - 0.25 * r]);
      return { pos, r, capZ, towers };
    };
    const magL = mkMag(-1), magR = mkMag(1);
    const sumpY = -cR - L.sump;                      // sump floor

    const carb = {
      pos: [0, sumpY - 0.42 * b, (zBack + L.zOf(L.nSt - 1)) / 2],
      r: 0.30 * b, h: 0.62 * b,
    };
    // the fuel line lands on an INLET BOSS on the float bowl's flank, and
    // the throttle on an arm that actually reaches the barrel — both were
    // floating in air before (G24.4 fitment scrutiny, caught by eye where
    // the AABB test could not)
    carb.bowlIn = add(carb.pos, [0.44 * b, -0.48 * b, 0]);
    carb.arm = add(carb.pos, [-0.44 * b, 0.10 * b, 0]);

    // engine-side mount: boss + rubber puck stand the tube OFF the case
    // (0.32*cR of stack), so a STRAIGHT tube starts clear of the backplate
    // and never needs to bend — the user's option A, made geometric
    const lugC = [[-0.78 * cR, 0.62 * cR, zTail], [0.78 * cR, 0.62 * cR, zTail],
                  [-0.78 * cR, -0.62 * cR, zTail], [0.78 * cR, -0.62 * cR, zTail]];
    const lugs = lugC.map(p => [p[0], p[1], zTail - 0.26 * cR]);  // tube attach
    const zFw = L.zAft - P.mountGap * cR;
    const fwT = Math.max(0.008, 0.06 * cR);
    const fwPts = lugC.map(p => [
      Math.sign(p[0]) * Math.min(Math.abs(p[0]) * P.fwSpread, 0.42 * P.fwW / 2),
      Math.sign(p[1]) * Math.min(Math.abs(p[1]) * P.fwSpread, 0.42 * P.fwH / 2),
      zFw]);
    // each service leaves the firewall on the SIDE OF ITS DESTINATION —
    // fuel right (the bowl inlet is right), throttle left (the arm is
    // left). The first cut crossed both over the centreline, straight
    // through the drooping exhaust stacks (G24.2).
    const fuelFw = [0.36 * P.fwW * cR / 2, -0.30 * P.fwH * cR / 2, zFw];
    const thrFw = [-0.36 * P.fwW * cR / 2, -0.30 * P.fwH * cR / 2, zFw];

    const ports = { magL: magL.pos, magR: magR.pos, carbIn: carb.bowlIn,
                    carbArm: carb.arm, fuelFw, thrFw, lugs, fwPts,
                    plugT: cyls.map(c => c.plugT), plugB: cyls.map(c => c.plugB),
                    intake: cyls.map(c => c.intakeP),
                    exhaust: cyls.map(c => c.exhaustP) };
    // {name, from, to, a0, a1}: every routed line declares its ends — the
    // check holds a1 against the port table and both ends against the target
    // parts' own emitted geometry.
    const arteries = [];
    const artery = (name, from, to, ends) =>
      arteries.push(Object.assign({ name, from, to }, ends));

    // ---- THE CLEARANCE FIELD (G24.2, "clip hunting") ----------------------
    // A sampled cable is a spline, and a spline between two clear waypoints
    // happily sags THROUGH the case shoulder — the same lesson the fin's
    // root learned against the deck (G22: a line between two points on a
    // curved body goes inside it). So routing does not trust waypoints:
    // every sampled point is pushed out of the case's own rounded-rect
    // field (full section over the case, the shrinking scale over the acc
    // dome, the split ridge over the spine) to surface + margin. `fade`
    // relaxes the margin at the ends for tubes whose endpoints are JOINTS.
    // CONTINUOUS and slightly conservative, on purpose: the real dome steps
    // from 1.0 to 0.92 of the case at zBack, and a tube ring straddling a
    // step in the field tilts a vertex into the wider side (measured:
    // -0.061cR on the flat six's crossing lead, exactly at zBack). The
    // check asserts against the REAL surface; this field just clears it
    // with room, so conservative costs nothing.
    // Two-tier acc body (G24.4): backplate 0.90, hump 0.66, blended over a
    // short ramp so no field step can tilt a ring vertex into the metal.
    const caseHalf = z => {
      if (z > zNose + 0.02 * cR || z < L.zAft - 0.02 * cR) return 0;
      if (z >= zTail) return cR;
      if (z >= accT1) return cR * (0.90 + 0.10 *
        Math.max(0, 1 - (zTail - z) / (0.10 * cR)));
      const t = (accT1 - z) / (0.10 * cR);
      return cR * (t >= 1 ? 0.66 : 0.90 - 0.24 * t);
    };
    const clearCase = (path, margin, fade) => path.map((p, i, arr) => {
      let m = margin;
      if (fade) {
        const t = i / (arr.length - 1 || 1);
        m *= Math.min(1, 4 * t, 4 * (1 - t));
      }
      const h = caseHalf(p[2]);
      if (!h || m <= 0) return p;
      const r = 0.55 * h, hr2 = h - r;
      const ax = Math.abs(p[0]), ay = Math.abs(p[1]);
      const qx = ax - hr2, qy = ay - hr2;
      let d, dir;
      if (qx > 0 || qy > 0) {
        const cx = Math.max(qx, 0), cy = Math.max(qy, 0);
        d = Math.hypot(cx, cy) - r;
        const gl = Math.hypot(cx, cy) || 1;
        dir = [Math.sign(p[0]) * cx / gl, Math.sign(p[1]) * cy / gl];
      } else {
        d = Math.max(qx, qy) - r;
        dir = qx > qy ? [Math.sign(p[0]) || 1, 0] : [0, Math.sign(p[1]) || 1];
      }
      const out = d < m
        ? [p[0] + dir[0] * (m - d), p[1] + dir[1] * (m - d), p[2]] : p.slice();
      // the split ridge stands proud of the case top: a lead draped over
      // the spine must clear IT, not the case surface
      if (h === cR && Math.abs(out[0]) < 0.22 * cR && out[1] > 0.5 * cR)
        out[1] = Math.max(out[1], cR + 0.10 * cR + 0.6 * m);
      return out;
    });
    // projection can kink where the field begins; one relax pass and a
    // re-projection gives a fair curve that is still clear
    const relax = pts => pts.map((p, i) => (i === 0 || i === pts.length - 1)
      ? p : [0, 1, 2].map(k =>
        0.25 * pts[i - 1][k] + 0.5 * p[k] + 0.25 * pts[i + 1][k]));
    const routeClear = (path, m, fade) =>
      clearCase(relax(clearCase(path, m, fade)), m, fade);

    // =======================================================================
    // THE CASE — rounded-square section along z, with the vertical-split
    // ridges a real opposed case shows along its top and bottom centreline.
    // =======================================================================
    part('case');
    const caseShape = roundRect(2 * cR, 2 * cR, 0.55 * cR);
    shapeLathe([0, 0, 0], Z, X, Y, caseShape, [
      { t: zNose, s: 0.86 }, { t: zNose - 0.05 * cR, s: 1 },
      { t: zTail + 0.05 * cR, s: 1 }, { t: zTail, s: 0.86 },
    ], ENGM_MAT.case, true, true);

    part('ridge', 'box', 2);
    {
      // the case halves' bolt flange: a thin spine, top and bottom
      const w = 0.16 * cR, h = 0.10 * cR;
      for (const sy of [1, -1]) {
        const y0 = sy * cR * 0.99, y1 = sy * (cR + h);
        const zA = zNose - 0.03 * cR, zB = zTail + 0.03 * cR;
        const q = [v([-w, y0, zA]), v([w, y0, zA]), v([w, y0, zB]), v([-w, y0, zB]),
                   v([-w * 0.8, y1, zA]), v([w * 0.8, y1, zA]),
                   v([w * 0.8, y1, zB]), v([-w * 0.8, y1, zB])];
        const M = ENGM_MAT.ridge;
        quad(q[4], q[5], q[6], q[7], M);
        quad(q[0], q[4], q[7], q[3], M); quad(q[5], q[1], q[2], q[6], M);
        quad(q[0], q[1], q[5], q[4], M); quad(q[3], q[7], q[6], q[2], M);
      }
    }

    // ---- sump: the wet belly the carb hangs from --------------------------
    if (L.sump > 1e-6) {
      part('sump');
      const xw = cR * 0.80, zA = zNose - 0.02 * cR, zB = zTail + 0.02 * cR;
      const sh = polyShape([[-xw, -cR * 0.48], [xw, -cR * 0.48],
                            [xw * 0.68, sumpY], [-xw * 0.68, sumpY]], 0.12 * cR);
      prism([0, 0, 0], Z, X, Y, sh, zB, zA, ENGM_MAT.sump, true, true, 0.05 * cR);
    }

    // ---- accessory body: backplate + hump, and what lives on it -----------
    if (hasAcc) {
      const shA = roundRect(2 * cR, 2 * cR, 0.55 * cR);
      part('acc');
      shapeLathe([0, 0, 0], Z, X, Y, shA, [
        { t: zTail, s: ACC1 }, { t: accT1, s: ACC1 },
      ], ENGM_MAT.acc, false, true);
      part('accHump');
      shapeLathe([0, 0, 0], Z, X, Y, shA, [
        { t: accT1, s: ACC2 }, { t: L.zAft + 0.06 * cR, s: ACC2 },
        { t: L.zAft, s: ACC2 * 0.86 },
      ], ENGM_MAT.acc, false, true);
      // the backplate's aft face carries its life: two round inspection
      // covers with a centre nub, and the oil-screen plug at the bottom
      for (const sx2 of [-1, 1]) {
        part('accCover');
        lathe([sx2 * 0.36 * cR, -0.34 * cR, accT1], [0, 0, -1],
              { u: X, w: Y }, [
          { t: -0.01 * cR, r: 0.14 * cR }, { t: 0.045 * cR, r: 0.14 * cR },
          { t: 0.045 * cR, r: 0.05 * cR }, { t: 0.075 * cR, r: 0.05 * cR },
        ], ENGM_MAT.pad, false, true, S.acc);
      }
      part('accPlug', 'solid', 2);
      bolt([0, -0.52 * cR, accT1], [0, 0, -1], 0.045 * cR, ENGM_MAT.flange);
    }
    if (P.mags && hasAcc) {
      for (const [mg, occ] of [[magL, 0], [magR, 1]]) {
        // mounting flange ring against the backplate, then the body
        part('magPad');
        lathe([mg.pos[0], mg.pos[1], accT1], [0, 0, -1], { u: X, w: Y }, [
          { t: -0.01 * cR, r: 1.25 * mg.r }, { t: 0.05 * cR, r: 1.25 * mg.r },
        ], ENGM_MAT.pad, true, true, S.acc);
        part('mag');
        lathe(mg.pos, [0, 0, -1], { u: [1, 0, 0], w: [0, 1, 0] }, [
          { t: -1.4 * mg.r, r: 0 }, { t: -1.4 * mg.r, r: 0.80 * mg.r },
          { t: 0, r: 0.86 * mg.r }, { t: 0.3 * mg.r, r: mg.r },
          { t: 1.1 * mg.r, r: mg.r }, { t: 1.25 * mg.r, r: 0 },
        ], ENGM_MAT.mag, false, false, S.acc);
        // THE DISTRIBUTOR CAP, with ONE LEAD TOWER PER CYLINDER — the
        // harness now starts on real metal (fitment, G24.4)
        part('magCap', 'solid', 1 + R.cyl);
        prism([mg.pos[0], mg.pos[1], 0], Z, X, Y,
              roundRect(2.1 * mg.r, 2.1 * mg.r, 0.5 * mg.r),
              mg.capZ - 0.5 * mg.r, mg.capZ, ENGM_MAT.cap, true, true,
              0.12 * mg.r);
        for (const tw of mg.towers)
          lathe([tw[0], tw[1] - 0.30 * mg.r, tw[2]], [0, 1, 0],
                { u: [1, 0, 0], w: [0, 0, 1] }, [
            { t: 0, r: 0.15 * mg.r }, { t: 0.30 * mg.r, r: 0.10 * mg.r },
          ], ENGM_MAT.cap, false, true, S.detail);
      }
    }
    if (P.genOn && hasAcc) {
      part('gen');
      const gr = 0.30 * cR, gO = [0, cR * 0.92, zTail + 0.2 * cR];
      lathe(gO, [0, 0, -1], { u: [1, 0, 0], w: [0, 1, 0] }, [
        { t: 0, r: 0 }, { t: 0, r: gr * 0.8 }, { t: 0.25 * gr, r: gr },
        { t: 2.4 * gr, r: gr }, { t: 2.7 * gr, r: gr * 0.55 },
        { t: 2.9 * gr, r: 0 },
      ], ENGM_MAT.gen, false, false, S.acc);
      part('genPulley');            // V-groove double disc on the front end
      lathe(gO, [0, 0, -1], { u: [1, 0, 0], w: [0, 1, 0] }, [
        { t: -0.36 * gr, r: 0.28 * gr }, { t: -0.30 * gr, r: 0.58 * gr },
        { t: -0.20 * gr, r: 0.30 * gr }, { t: -0.10 * gr, r: 0.58 * gr },
        { t: -0.04 * gr, r: 0.28 * gr },
      ], ENGM_MAT.flange, true, true, S.acc);
      part('genStrap');             // the hold-down band over the body
      lathe(gO, [0, 0, -1], { u: [1, 0, 0], w: [0, 1, 0] }, [
        { t: 1.05 * gr, r: 1.07 * gr }, { t: 1.35 * gr, r: 1.07 * gr },
      ], ENGM_MAT.flange, true, true, S.acc);
      {
        // cooling slots behind the pulley — what says ALTERNATOR (G24.13)
        const nV = 8;
        part('genVents', 'fins', nV);
        for (let k = 0; k < nV; k++) {
          const a2 = (k + 0.5) / nV * 2 * Math.PI;
          const rad = [Math.cos(a2), Math.sin(a2), 0];
          const tan = [-Math.sin(a2), Math.cos(a2), 0];
          prism([gO[0] + rad[0] * 0.90 * gr, gO[1] + rad[1] * 0.90 * gr, 0],
                Z, rad, tan,
                [[-0.09 * gr, -0.13 * gr], [0.09 * gr, -0.13 * gr],
                 [0.09 * gr, 0.13 * gr], [-0.09 * gr, 0.13 * gr]],
                gO[2] - 0.75 * gr, gO[2] - 0.35 * gr,
                ENGM_MAT.cap, true, true);
        }
      }
    }
    if (P.oilFill) {
      part('oil');
      const or = 0.09 * cR;
      lathe([0.30 * cR, cR * 0.9, zFront + 0.35 * (zBack - zFront)], [0, 1, 0],
            { u: [1, 0, 0], w: [0, 0, 1] }, [
        { t: 0, r: or }, { t: 0.5 * cR, r: or },
        { t: 0.5 * cR, r: 1.8 * or }, { t: 0.62 * cR, r: 1.8 * or },
        { t: 0.62 * cR, r: 0 },
      ], ENGM_MAT.oil, false, false, S.acc);
    }

    // ---- prop shaft, flange, bolt ring ------------------------------------
    if (P.geared) {
      // the reduction bell (G24.13 rework — it read "insignificant"):
      // a fat two-step housing with rib rings and its bolt circle
      part('gearbox');
      lathe([0, 0, 0], Z, { u: X, w: Y }, [
        { t: zNose - 0.02 * cR, r: 0.74 * cR },
        { t: zNose * 0.66, r: 0.68 * cR },
        { t: zNose * 0.40, r: 0.50 * cR },
        { t: zNose * 0.18, r: 0.44 * cR },
        { t: -0.12 * R.P.flangeLen, r: 0.38 * cR },
      ], ENGM_MAT.case, true, true, S.shaft);
      part('gearRib', 'fins', 2);
      lathe([0, 0, 0], Z, { u: X, w: Y }, [
        { t: zNose * 0.80, r: 0.74 * cR }, { t: zNose * 0.74, r: 0.74 * cR },
      ], ENGM_MAT.case, true, true, S.shaft);
      lathe([0, 0, 0], Z, { u: X, w: Y }, [
        { t: zNose * 0.55, r: 0.62 * cR }, { t: zNose * 0.49, r: 0.62 * cR },
      ], ENGM_MAT.case, true, true, S.shaft);
      if (P.screws)
        for (let k = 0; k < 6; k++) {
          part('gearBolt', 'solid', 2);
          const a = (k + 0.5) / 6 * 2 * Math.PI;
          bolt([0.56 * cR * Math.cos(a), 0.56 * cR * Math.sin(a),
                zNose * 0.53], Z, 0.022 * cR, ENGM_MAT.flange);
        }
    }
    part('flange');
    lathe([0, 0, 0], Z, { u: X, w: Y }, [
      { t: zNose, r: 0.52 * cR }, { t: -0.30 * R.P.flangeLen, r: 0.52 * cR },
      { t: -0.30 * R.P.flangeLen, r: R.P.flangeR * b },
      { t: 0, r: R.P.flangeR * b }, { t: 0, r: 0.20 * b },
      { t: 0.12 * b, r: 0.20 * b }, { t: 0.12 * b, r: 0 },
    ], ENGM_MAT.flange, true, false, S.shaft);
    if (P.screws) {
      // six hex bolts on the flange face — what says "flange"
      const nb = 6, rb = 0.040 * b, rc = 0.30 * b;
      for (let k = 0; k < nb; k++) {
        part('flangeBolt', 'solid', 2);
        const a = k / nb * 2 * Math.PI;
        bolt([rc * Math.cos(a), rc * Math.sin(a), 0], Z, rb, ENGM_MAT.flange);
      }
    }
    // ---- timing cover: the raised disc a real case wears on its nose ------
    part('timing');
    lathe([0, 0, 0], Z, { u: X, w: Y }, [
      { t: zNose, r: 0.60 * cR }, { t: zNose + 0.055 * cR, r: 0.60 * cR },
    ], ENGM_MAT.case, true, true, S.shaft);
    if (P.screws)
      for (let k = 0; k < 6; k++) {
        part('timingScrew', 'solid', 2);
        const a = (k + 0.5) / 6 * 2 * Math.PI;
        bolt([0.48 * cR * Math.cos(a), 0.48 * cR * Math.sin(a),
              zNose + 0.055 * cR], Z, 0.020 * cR, ENGM_MAT.flange);
      }

    // =======================================================================
    // CYLINDERS — barrel + fins + head + rocker cover + pushrod tubes,
    // one builder, mirrored by `sx`.
    // =======================================================================
    for (const c of cyls) {
      const uw = c.uw;                     // section plane ⊥ the cylinder
      const o = [0, 0, c.z];

      part('cylPad' + c.i);
      // the machined pad the barrel bolts to — the case flank stops being
      // a bare wall (G24.4 "personality")
      prism(o, c.dir, Z, c.e2, roundRect(1.45 * b, 1.45 * b, 0.30 * b),
            cR * 0.88, cR * 1.03, ENGM_MAT.pad, false, true, 0.05 * b);

      // the neighbour planes: fins and heads are wider than the half-pitch
      // and get CLIPPED against the next cylinder, like the real casting
      const air = !P.liquid;
      const zLim = [c.z - Math.min(c.gapDn / 2 - 0.03 * b, 4 * b),
                    c.z + Math.min(c.gapUp / 2 - 0.03 * b, 4 * b)];
      const hrEff = Math.min(L.headR, 0.48 * Math.min(c.gapDn, c.gapUp, 8 * b));

      part('barrel' + c.i);
      // base flange at the case wall, then the core the fins ride on — or,
      // liquid-cooled, one smooth water-jacket casting
      lathe(o, c.dir, uw, [
        { t: c.rr0, r: 0.62 * b }, { t: c.rr0 + 0.10 * b, r: 0.62 * b },
        { t: c.rr0 + 0.10 * b, r: air ? 0.51 * b : 0.56 * b },
        { t: c.finTop, r: air ? 0.51 * b : 0.56 * b },
      ], ENGM_MAT.barrel, false, false, S.cyl);

      if (air && P.baseFins) {
        const n = Math.max(2, Math.round(P.finN));
        part('fins' + c.i, 'fins', n);
        const finR = R.P.finR * b / 2;
        if (P.finShape) {
          // square-plate barrel fins (the 912/modern look, G24.13)
          finPlates(c.at, c.rr0 + 0.20 * b, c.finTop - 0.03 * b, n, finR,
                    -Math.min(c.gapDn / 2 - 0.03 * b, finR),
                    Math.min(c.gapUp / 2 - 0.03 * b, finR),
                    0.10 * b, null, c.e2, ENGM_MAT.fin);
        } else {
          finStack(c.at, uw.u, uw.w, c.rr0 + 0.20 * b, c.finTop - 0.03 * b, n,
                   0.53 * b, finR, 0.07, sectOf(finR, S.cyl), zLim,
                   ENGM_MAT.fin);
        }
      }

      part('head' + c.i);
      // radius CLAMPED to the neighbour gap (the envelope keeps the
      // generous L.headR — the cowl's truth is conservative, the visual
      // head is honest); a two-stroke head runs on into a plain dome
      lathe(o, c.dir, uw, [
        { t: c.finTop, r: air ? 0.51 * b : 0.56 * b },
        { t: c.finTop + 0.06 * b, r: hrEff },
        { t: c.headTop, r: hrEff },
        P.twoStroke ? { t: c.rockerOut - 0.10 * b, r: hrEff * 0.62 }
                    : { t: c.headTop + 0.10 * b, r: hrEff * 0.86 },
        P.twoStroke ? { t: c.rockerOut, r: 0 }
                    : { t: c.headTop + 0.10 * b, r: 0 },
      ], ENGM_MAT.head, false, false, S.cyl);
      if (air && P.headFins > 0) {
        const n = Math.round(P.headFins);
        part('headFins' + c.i, 'fins', n);
        const hEnd = P.twoStroke ? c.rockerOut - 0.30 * b : c.headTop;
        finPlates(c.at, c.finTop + 0.10 * b, hEnd, n, hrEff * 1.15,
                  -Math.min(c.gapDn / 2 - 0.03 * b, hrEff * 1.15),
                  Math.min(c.gapUp / 2 - 0.03 * b, hrEff * 1.15),
                  0.10 * b,
                  P.twoStroke ? null
                    : { z: -0.14 * b, w: 0.19 * b, floor: 0.42 * b },
                  c.e2, ENGM_MAT.fin);
      }
      if (P.liquid) {
        // the coolant outlet boss on the head crown — UNDERSIDE when the
        // radiator hangs below (G24.13: the circuit follows the radiator)
        part('coolBoss' + c.i, 'tube');
        const cS = below ? -1 : 1;
        const cbDir = [0, cS, 0];
        const cbB = [c.sx * (c.finTop + 0.55 * b), cS * hrEff * 0.75, c.z];
        const cbL = hrEff * 0.25 + 0.24 * b;
        lathe(cbB, cbDir, null, [
          { t: 0, r: 0.10 * b }, { t: cbL, r: 0.10 * b },
        ], ENGM_MAT.head, false, true, S.detail);
        c.coolTip = mad(cbB, cbDir, cbL);
      }

      // (rocker covers moved below the loop — one per cylinder or, VW
      // style, ONE per bank; G24.13)

      // ---- pushrod tubes: four-stroke furniture ---------------------------
      if (!P.twoStroke) {
        const ry = P.rodPos >= 0 ? 1 : -1;
        for (const dz of [-0.20 * b, 0.20 * b]) {
          part('rod' + c.i, 'tube');
          const A = [c.sx * cR * 0.86, ry * 0.42 * b, c.z + dz];
          const B = [c.sx * (c.finTop + 0.10 * b), ry * 0.46 * b, c.z + dz];
          const path = resample([A, B]);
          const rr = path.map((_, k) =>
            0.068 * b * (k === path.length - 1 ? 1.5 : 1));  // head bellmouth
          sweep(path, rr, ENGM_MAT.rod,
                { capA: true, capB: true, sides: S.detail });
        }
      }

      // ---- SPARK PLUGS (the leads' destination is a real plug) ------------
      if (P.leads) {
        for (const [bb, ax] of P.twoStroke
             ? [[c.plugBaseT, c.dir], [c.plugBaseB, c.dir]]
             : [[c.plugBaseT, [0, 1, 0]], [c.plugBaseB, [0, -1, 0]]]) {
          part('plug' + c.i, 'tube', 4);
          sparkPlug(bb, ax);
        }
      }

      // ---- intake riser: sump plenum -> head bottom-aft port --------------
      // (four-stroke only: a two-stroke breathes through its crankcase)
      if (P.intake && !P.twoStroke) {
        part('intake' + c.i, 'tube');
        const A = [c.sx * 0.42 * cR, sumpY + 0.10 * b, c.z + 0.20 * b];
        const knee = [c.sx * (c.finTop - 0.15 * b), sumpY + 0.16 * b, c.z + 0.34 * b];
        const path = fillet([A, knee, c.intakeP], 0.65 * b);
        artery('intake' + c.i, 'sump', 'head' + c.i,
          sweep(path, 0.16 * b, ENGM_MAT.intake,
                { capA: true, capB: true, sides: S.pipe }));
        // FLANGED at both ends (G24.11): a bare tube punching a wall was
        // not at the level of the rest — a tapered boss at the sump, a
        // collar at the head port
        const dI0 = nrm(sub(path[1], path[0]));
        part('intFlange' + c.i, 'tube');
        lathe(path[0], dI0, null, [
          { t: -0.02 * b, r: 0.24 * b }, { t: 0.15 * b, r: 0.20 * b },
        ], ENGM_MAT.intake, true, true, S.pipe);
        const dIN = nrm(sub(path[path.length - 1], path[path.length - 2]));
        part('intCollar' + c.i, 'tube');
        lathe(path[path.length - 1], dIN, null, [
          { t: -0.16 * b, r: 0.20 * b }, { t: -0.01 * b, r: 0.225 * b },
        ], ENGM_MAT.intake, true, true, S.pipe);
      }

      // ---- exhaust: head bottom-fwd port, down and out --------------------
      // (an inline two-stroke always runs chambers when exhaust is on)
      const exMode = inline ? (P.exStyle ? 3 : 0) : P.exStyle;
      if (exMode === 1) {
        part('exhaust' + c.i, 'tube');
        const knee = [c.sx * (c.finTop - 0.30 * b), -cR - L.sump * 0.4, c.z - 0.40 * b];
        const tip = [c.sx * 0.72 * cR, sumpY - P.exDrop * b, c.z + 0.30 * b];
        const path = fillet([c.exhaustP, knee, tip], 0.75 * b);
        const rr = path.map((_, k) =>
          0.18 * b * (k >= path.length - 2 ? 1.14 : 1));    // flared outlet
        artery('exhaust' + c.i, 'head' + c.i, 'tip',
          sweep(path, rr, ENGM_MAT.exhaust,
                { capA: true, lipB: true, sides: S.pipe }));
      } else if (exMode === 3) {
        // TWO-STROKE MUSIC: the expansion chamber — cone out to a fat
        // belly, cone back down to a thin stinger, sweeping aft low on
        // the cylinder's own side
        part('exhaust' + c.i, 'tube');
        const path = fillet([c.exhaustP,
              [c.sx * (c.finTop - 0.30 * b), -cR - L.sump * 0.4, c.z - 0.40 * b],
              [c.sx * 0.60 * cR, sumpY - 0.9 * b, c.z - 0.7 * b],
              [c.sx * 0.55 * cR, sumpY - 0.9 * b, c.z - 2.4 * b]], 0.9 * b);
        const prof = [[0, 0.13], [0.18, 0.14], [0.45, 0.30], [0.62, 0.28],
                      [0.85, 0.085], [1, 0.085]];
        const rr = path.map((_, k) => {
          const f2 = k / (path.length - 1);
          let j = 0;
          while (j + 1 < prof.length && prof[j + 1][0] < f2) j++;
          const [f0, r0] = prof[j];
          const [f1, r1] = prof[Math.min(j + 1, prof.length - 1)];
          return b * (r0 + (r1 - r0) * Math.max(0, Math.min(1,
            (f2 - f0) / ((f1 - f0) || 1))));
        });
        artery('exhaust' + c.i, 'head' + c.i, 'chamber',
          sweep(path, rr, ENGM_MAT.exhaust,
                { capA: true, lipB: true, sides: S.pipe }));
      }
    }

    // ---- ROCKER COVERS (four-stroke): one per cylinder, or — VW
    // conversion style — ONE WIDE COVER PER BANK (G24.13). Same profile,
    // fine bevels, perimeter-spaced screws; wide covers earn 8 of them.
    if (!P.twoStroke && cyls.length) {
      const hT = cyls[0].headTop, rO = cyls[0].rockerOut;
      const rockerCover = (zC, sxb, Wb, idx) => {
        part('rocker' + idx);
        const bv = 0.030 * b, bw = P.rockerBossW;
        const rEff = Math.min(P.rockerR, 0.48 * Math.min(Wb / b, P.rockerH));
        const sh = roundRect(Wb, P.rockerH * b, rEff * b, ARC);
        const o2 = [0, 0, zC], dir2 = [sxb, 0, 0];
        const t0 = hT + 0.02 * b, tF = t0 + 0.13 * b;
        const tFa = rO - 0.08 * b, tB = rO + P.rockerBoss * b;
        const seq = [
          { t: t0, f: [1.22, 1.30] },
          { t: tF - bv, f: [1.22, 1.30] },
          { t: tF, f: [1.19, 1.26] },                 // flange rim bevel
          { t: tF, f: [1.035, 1.045] },               // exposed step face
          { t: tF + bv, f: [1, 1] },                  // wall root chamfer
          { t: rO - 0.16 * b, f: [1, 1] },            // the wall
          { t: tFa - bv, f: [0.965, 0.955] },
          { t: tFa, f: [0.88, 0.84] },                // face bevel
          { t: tFa, f: [bw * 1.07, bw * 1.02] },      // face annulus
          { t: tFa + bv, f: [bw, bw * 0.96] },        // boss root chamfer
          { t: tB - bv, f: [bw, bw * 0.96] },
          { t: tB, f: [bw * 0.84, bw * 0.78] },       // crown bevel
          { t: tB + 0.020 * b, f: [bw * 0.60, bw * 0.52] },
        ];
        let prev = null;
        for (const s of seq) {
          const rg = ringShape(mad(o2, dir2, s.t), Z, Y,
                               sh.map(p => [p[0] * s.f[0], p[1] * s.f[1]]));
          if (prev) band(rg, prev, ENGM_MAT.rocker);
          else capAuto(rg, mad(o2, dir2, s.t), ENGM_MAT.rocker, false);
          prev = rg;
        }
        capAuto(prev, mad(o2, dir2, tB + 0.020 * b), ENGM_MAT.rocker, true);
        if (P.screws) {
          const nS = Wb > 1.6 * P.rockerW * b ? 8 : 6;
          part('rockerScrew' + idx, 'solid', 2 * nS);
          const cum = [0];
          for (let i2 = 1; i2 <= sh.length; i2++) {
            const a3 = sh[i2 - 1], b3 = sh[i2 % sh.length];
            cum.push(cum[i2 - 1] + Math.hypot(b3[0] - a3[0], b3[1] - a3[1]));
          }
          const tot = cum[cum.length - 1];
          for (let k = 0; k < nS; k++) {
            const s2 = (k + 0.5) / nS * tot;
            let i2 = 0;
            while (i2 + 1 < cum.length - 1 && cum[i2 + 1] < s2) i2++;
            const a3 = sh[i2], b3 = sh[(i2 + 1) % sh.length];
            const f2 = (s2 - cum[i2]) / ((cum[i2 + 1] - cum[i2]) || 1);
            bolt([dir2[0] * tF,
                  (a3[1] + (b3[1] - a3[1]) * f2) * 1.15,
                  zC + (a3[0] + (b3[0] - a3[0]) * f2) * 1.11],
                 dir2, 0.028 * b, ENGM_MAT.flange);
          }
        }
      };
      if (P.rockerSpan && !inline) {
        let bi = 0;
        for (const bank of [-1, 1]) {
          const row = cyls.filter(c2 => c2.sx === bank);
          if (!row.length) continue;
          const zs = row.map(c2 => c2.z);
          rockerCover((Math.min(...zs) + Math.max(...zs)) / 2, bank,
                      (Math.max(...zs) - Math.min(...zs)) + P.rockerW * b,
                      bi++);
        }
      } else {
        for (const c2 of cyls) rockerCover(c2.z, c2.sx, P.rockerW * b, c2.i);
      }
    }

    // ---- collector exhaust: per side, stacks merge into one pipe aft ------
    if (P.exStyle === 2 && !inline) {
      for (const sx of [-1, 1]) {
        const side = cyls.filter(c => c.sx === sx);
        if (!side.length) continue;
        const colY = sumpY - 0.75 * P.exDrop * b;
        const colX = sx * 0.55 * cR;
        const zMin = Math.min(...side.map(c => c.z)) - 0.4 * b;
        const zMax = Math.max(...side.map(c => c.z)) + 0.4 * b;
        for (const c of side) {
          part('exhaust' + c.i, 'tube');
          const jn = [colX, colY, c.z - 0.35 * b];    // plunges into the collector
          const knee = [sx * (c.finTop - 0.30 * b), -cR - L.sump * 0.4, c.z - 0.42 * b];
          const path = fillet([c.exhaustP, knee, jn], 0.7 * b);
          artery('exhaust' + c.i, 'head' + c.i, 'collector',
            sweep(path, 0.17 * b, ENGM_MAT.exhaust,
                  { capA: true, capB: true, sides: S.pipe }));
        }
        part('collector', 'tube');
        // a tapered can: domed nose, straight run the stacks plunge into,
        // then a reduced tailpipe bending down and aft to an open lip
        const colR = 0.23 * b;
        const pC = fillet([[colX, colY, zMax + 0.3 * b],
                           [colX, colY, zMin - 0.5 * b],
                           [colX, colY - 0.35 * b, zMin - 1.6 * b]], 1.0 * b);
        const rrC = pC.map((_, k) => {
          if (k === 0) return 0.55 * colR;
          if (k === 1) return 0.85 * colR;
          return k >= pC.length - 2 ? 0.74 * colR : colR;
        });
        sweep(pC, rrC, ENGM_MAT.exhaust,
              { capA: true, lipB: true, sides: S.pipe });
      }
    }

    // =======================================================================
    // THE IGNITION HARNESS — the routing table made visible. Left mag fires
    // the top plugs, right mag the bottom plugs (one lead per plug, two per
    // cylinder). Top leads ride over the case spine; bottom leads drop down
    // the case flank — which is where they run on the real engine, because
    // a lead crossing the exhaust would cook.
    // =======================================================================
    if (P.leads && P.mags && hasAcc) {
      const lr = Math.max(P.leadR * b, 0.02 * cR);
      for (const c of cyls) {
        part('leadT' + c.i, 'tube');
        const mg = magL.pos;
        const pT = routeClear(smooth([
          magL.towers[c.i],
          [c.sx * 0.30 * cR, cR * 1.12, (mg[2] + c.z) / 2],
          [c.sx * 0.75 * cR, cR * 0.75, c.z - 0.05 * b],
          [c.plugT[0], c.plugT[1] + 0.24 * b, c.plugT[2]],
          c.plugT,
        ]), lr + 0.030 * cR);
        artery('leadT' + c.i, 'magL', 'plugT' + c.i,
          sweep(pT, lr, ENGM_MAT.lead,
                { capA: true, capB: true, sides: S.detail }));

        part('leadB' + c.i, 'tube');
        const mgB = magR.pos;
        const pB = routeClear(smooth([
          magR.towers[c.i],
          [c.sx * 0.95 * cR, 0.30 * cR, (mgB[2] + c.z) / 2],
          [c.sx * 1.02 * cR, -0.45 * cR, c.z - 0.05 * b],
          [c.plugB[0], c.plugB[1] - 0.24 * b, c.plugB[2]],
          c.plugB,
        ]), lr + 0.030 * cR);
        artery('leadB' + c.i, 'magR', 'plugB' + c.i,
          sweep(pB, lr, ENGM_MAT.lead,
                { capA: true, capB: true, sides: S.detail }));
      }
    }

    // ---- fuel injection spider (IO-360): dome on the case spine, one thin
    // line arcing to each head's intake side --------------------------------
    if (inj) {
      part('spider');
      const sp = [0, cR * 1.06, (zFront + zBack) / 2];
      lathe(sp, [0, 1, 0], { u: [1, 0, 0], w: [0, 0, 1] }, [
        { t: -0.06 * cR, r: 0 }, { t: -0.06 * cR, r: 0.16 * cR },
        { t: 0.10 * cR, r: 0.13 * cR }, { t: 0.16 * cR, r: 0 },
      ], ENGM_MAT.spider, false, false, S.acc);
      for (const c of cyls) {
        part('injLine' + c.i, 'tube');
        const path = routeClear(smooth([
          add(sp, [c.sx * 0.10 * cR, 0.05 * cR, 0]),
          [c.sx * 0.60 * cR, cR * 0.95, c.z + 0.30 * b],
          [c.sx * (c.finTop - 0.05 * b), 0.30 * b, c.z + 0.34 * b],
          add(c.intakeP, [0, 0.16 * b, 0]),
        ]), 0.020 * b + 0.025 * cR);
        artery('injLine' + c.i, 'spider', 'head' + c.i,
          sweep(path, 0.020 * b, ENGM_MAT.spider,
                { capA: true, capB: true, sides: S.detail }));
      }
    }

    // =======================================================================
    // CARBURETTOR + AIRBOX, hanging from the sump
    // =======================================================================
    if (P.carbOn) {
      part('carb');
      // the RISER reaches up INTO the sump (G24.9 — the carb's mounting
      // flange floated 0.11b below the block, top face showing)
      lathe(add(carb.pos, [0, carb.h / 2, 0]), [0, -1, 0],
            { u: [1, 0, 0], w: [0, 0, 1] }, inj ? [
        // fuel injection: a SERVO body — no float bowl (exclusive, G24.13)
        { t: -0.17 * b, r: 0.26 * b }, { t: -0.02 * b, r: 0.26 * b },
        { t: 0, r: 0.42 * b }, { t: 0.10 * b, r: carb.r },
        { t: carb.h + 0.26 * b, r: carb.r },
        { t: carb.h + 0.26 * b, r: 0 },
      ] : [
        { t: -0.17 * b, r: 0.26 * b }, { t: -0.02 * b, r: 0.26 * b },
        { t: 0, r: 0.42 * b }, { t: 0.10 * b, r: carb.r },
        { t: carb.h, r: carb.r },
        { t: carb.h, r: 0.36 * b },                       // float bowl
        { t: carb.h + 0.34 * b, r: 0.36 * b },
        { t: carb.h + 0.34 * b, r: 0 },
      ], ENGM_MAT.carb, true, false, S.acc);
      part('carbInlet', 'tube');
      // the boss the fuel line lands on — bowl wall or servo body
      lathe([carb.pos[0] + (inj ? 0.24 : 0.30) * b,
             carb.pos[1] - 0.48 * b, carb.pos[2]],
            [1, 0, 0], { u: [0, 1, 0], w: [0, 0, 1] }, [
        { t: 0, r: 0.055 * b }, { t: (inj ? 0.20 : 0.14) * b, r: 0.055 * b },
      ], ENGM_MAT.carb, false, true, S.detail);
      part('carbArm', 'tube');
      // rooted IN the barrel, reaching past the attach point — it floated
      sweep(resample([add(carb.pos, [-0.26 * b, 0.10 * b, 0]),
                      add(carb.pos, [-0.52 * b, 0.10 * b, 0])]),
            0.03 * b, ENGM_MAT.carb,
            { capA: true, capB: true, sides: S.detail });
      if (P.airbox) {
        // AIRBOX v2 (G24.11): the old drum poked INTO the block and was a
        // bare cylinder. Now: a ribbed filter canister BELOW the sump,
        // domed front with a centre bolt, rear plate, and the horn into
        // the carb throat — registered as an artery so fitment holds it.
        const ax = [carb.pos[0], carb.pos[1] - 0.06 * b,
                    carb.pos[2] + 1.05 * b];
        // THE FILTER ELEMENT IS EXPOSED (G24.12, user: it is what shows
        // through the nose cowl IRL): chromed end caps, and between them
        // the pleated element in its own material, pleats and all
        part('air');
        lathe(ax, Z, { u: X, w: Y }, [
          { t: 0.52 * b, r: 0 }, { t: 0.50 * b, r: 0.28 * b },  // dome
          { t: 0.42 * b, r: 0.44 * b }, { t: 0.32 * b, r: 0.44 * b },
        ], ENGM_MAT.air, false, false, S.acc);
        part('airFilter', 'tube');
        lathe(ax, Z, { u: X, w: Y }, [
          { t: 0.32 * b, r: 0.415 * b }, { t: -0.04 * b, r: 0.415 * b },
        ], ENGM_MAT.filter, false, false, S.acc);
        {
          const nP = Math.max(12, sectOf(0.44 * b, S.acc));
          part('airPleats', 'fins', nP);
          for (let k2 = 0; k2 < nP; k2++) {
            const a2 = k2 / nP * 2 * Math.PI;
            const rad = [Math.cos(a2), Math.sin(a2), 0];
            const tan = [-Math.sin(a2), Math.cos(a2), 0];
            prism([ax[0] + rad[0] * 0.435 * b, ax[1] + rad[1] * 0.435 * b,
                   ax[2]], Z, rad, tan,
                  [[-0.022 * b, -0.006 * b], [0.022 * b, -0.006 * b],
                   [0.022 * b, 0.006 * b], [-0.022 * b, 0.006 * b]],
                  -0.04 * b, 0.32 * b, ENGM_MAT.filter, true, true);
          }
        }
        part('airRear');
        lathe(ax, Z, { u: X, w: Y }, [
          { t: -0.04 * b, r: 0.44 * b }, { t: -0.12 * b, r: 0.44 * b },
          { t: -0.18 * b, r: 0.32 * b }, { t: -0.18 * b, r: 0 },
        ], ENGM_MAT.air, true, false, S.acc);
        if (P.screws) {
          part('airBolt', 'solid', 2);
          bolt(mad(ax, Z, 0.50 * b), Z, 0.028 * b, ENGM_MAT.flange);
        }
        part('airHorn', 'tube');
        const hPort = add(carb.pos, [0, 0.03 * b, 0.24 * b]);
        const path = fillet([mad(ax, Z, -0.14 * b),
                             [ax[0], ax[1] + 0.02 * b,
                              (ax[2] + carb.pos[2]) / 2],
                             hPort], 0.30 * b);
        artery('airHorn', 'air', 'carb',
          sweep(path, 0.19 * b, ENGM_MAT.air,
                { capA: true, capB: true, sides: S.pipe }));
      }
    }

    // ---- LIQUID COOLING: radiator over the case aft, a hose per head,
    // and the return to a pump boss on the case top --------------------------
    if (P.liquid) {
      // parametric (G24.9): position radX/radY/radZ, size radW/radH/radD —
      // and DETAIL: a recessed slat core (count rides the governor), side
      // tanks, headers, expansion tank. radY is SIGNED (G24.11): negative
      // hangs the radiator under the sump.
      const rW = P.radW * cR, rH = P.radH * cR, rD = P.radD * cR;
      const rC = [P.radX * cR,
                  below ? -(cR + L.sump) + P.radY * cR - rH / 2
                        : cR + P.radY * cR + rH / 2,
                  zBack + P.radZ * cR];
      part('radiator');
      prism([rC[0], rC[1], 0], Z, X, Y, roundRect(rW, rH, 0.10 * cR),
            rC[2] - rD / 2, rC[2] + rD / 2, ENGM_MAT.air, true, true,
            0.05 * cR);
      {
        // header strips top and bottom, then the slats across the face
        for (const sy2 of [-1, 1]) {
          part('radHeader', 'box');
          prism([rC[0], rC[1] + sy2 * rH * 0.44, 0], Z, X, Y,
                [[-rW * 0.46, -rH * 0.05], [rW * 0.46, -rH * 0.05],
                 [rW * 0.46, rH * 0.05], [-rW * 0.46, rH * 0.05]],
                rC[2] + rD / 2, rC[2] + rD / 2 + 0.025 * cR,
                ENGM_MAT.carb, true, true);
        }
        const nS = Math.max(6, Math.round(stepsOf(rW) * 1.8));
        part('radCore', 'box', nS);
        for (let i2 = 0; i2 < nS; i2++) {
          const x2 = rC[0] - rW * 0.42 + (i2 + 0.5) / nS * rW * 0.84;
          prism([x2, rC[1], 0], Z, X, Y,
                [[-0.014 * cR, -rH * 0.36], [0.014 * cR, -rH * 0.36],
                 [0.014 * cR, rH * 0.36], [-0.014 * cR, rH * 0.36]],
                rC[2] + rD / 2, rC[2] + rD / 2 + 0.035 * cR,
                ENGM_MAT.mark, true, true);
        }
      }
      for (const sx2 of [-1, 1]) {
        part('radTank', 'tube');
        lathe([rC[0] + sx2 * (rW / 2 + 0.02 * cR), rC[1], rC[2]],
              [0, 1, 0], null, [
          { t: -rH * 0.62, r: 0.15 * cR }, { t: rH * 0.62, r: 0.15 * cR },
        ], ENGM_MAT.carb, true, true, S.acc);
        part('radStrut', 'tube');
        sweep(resample([[rC[0] + sx2 * rW * 0.28,
                         rC[1] + (below ? rH * 0.5 : -rH * 0.5), rC[2]],
                        [rC[0] * 0.4 + sx2 * 0.45 * cR,
                         below ? -(cR + L.sump) * 0.98 : cR * 0.9,
                         Math.min(rC[2] + 0.1 * cR, zFront - 0.1 * cR)]]),
              0.035 * cR, ENGM_MAT.mount,
              { capA: true, capB: true, sides: S.detail });
      }
      part('expTank');
      lathe([rC[0], rC[1] + rH / 2 + 0.10 * cR, rC[2]], [0, 1, 0], null, [
        { t: -0.12 * cR, r: 0 }, { t: -0.12 * cR, r: 0.12 * cR },
        { t: 0.14 * cR, r: 0.12 * cR }, { t: 0.14 * cR, r: 0 },
      ], ENGM_MAT.carb, false, false, S.acc);
      part('pumpBoss', 'tube');
      const pumpAt = [-0.40 * cR, 0, zFront - 0.25 * (zFront - zBack)];
      const pumpY = below ? -(cR + L.sump) * 0.96 : cR * 0.90;
      lathe([pumpAt[0], pumpY, pumpAt[2]], [0, below ? -1 : 1, 0], null, [
        { t: 0, r: 0.14 * cR }, { t: 0.22 * cR, r: 0.11 * cR },
      ], ENGM_MAT.case, false, true, S.detail);
      const pumpTip = [pumpAt[0], pumpY + (below ? -0.24 : 0.24) * cR,
                       pumpAt[2]];
      // COOLANT RAILS (G24.11, the "terribly messy" hoses revised): each
      // bank's bosses feed ONE rail running along the head crowns — the
      // 912's own scheme — and a single hose per side drops to its tank.
      for (const sx2 of [-1, 1]) {
        const side = cyls.filter(c2 => c2.sx === sx2 && c2.coolTip);
        if (!side.length) continue;
        const tips = side.map(c2 => c2.coolTip);
        const railY = tips[0][1] + 0.02 * b, railX = tips[0][0];
        const zHi2 = Math.max(...tips.map(t2 => t2[2])) + 0.35 * b;
        const zLo2 = Math.min(...tips.map(t2 => t2[2])) - 0.35 * b;
        part('coolRail', 'tube');
        sweep(resample([[railX, railY, zHi2], [railX, railY, zLo2]]),
              0.085 * b, ENGM_MAT.puck,
              { capA: true, capB: true, sides: S.pipe });
        part(sx2 < 0 ? 'coolantL' : 'coolantR', 'tube');
        const tank = [rC[0] + sx2 * (rW / 2 + 0.02 * cR), rC[1],
                      rC[2] - 0.14 * cR];
        const ph = routeClear(smooth([
          [railX, railY, zLo2],
          [sx2 * 1.10 * cR, below ? -0.35 * cR : cR * 1.25,
           (zLo2 + rC[2]) / 2],
          [tank[0], tank[1] + (below ? 0.22 : -0.22) * rH, rC[2] - 0.40 * cR],
          tank,
        ]), 0.10 * b + 0.02 * cR);
        artery(sx2 < 0 ? 'coolantL' : 'coolantR', 'coolRail', 'radTank',
          sweep(ph, 0.10 * b, ENGM_MAT.puck,
                { capA: true, capB: true, sides: S.pipe }));
      }
      part('coolantRet', 'tube');
      const pRet = routeClear(smooth([
        [rC[0] - (rW / 2 + 0.02 * cR), rC[1] + (below ? rH * 0.4 : -rH * 0.4),
         rC[2]],
        [-0.85 * cR, below ? -(cR + L.sump) * 0.7 : cR * 1.30,
         (rC[2] + pumpAt[2]) / 2],
        pumpTip,
      ]), 0.10 * b + 0.02 * cR);
      artery('coolantRet', 'radTank', 'pumpBoss',
        sweep(pRet, 0.10 * b, ENGM_MAT.puck,
              { capA: true, capB: true, sides: S.pipe }));
    }

    // =======================================================================
    // MOUNT + FIREWALL — the engine holds on to the aeroplane
    // =======================================================================
    if (P.mount) {
      const tubeR = 0.075 * cR;
      for (let k = 0; k < 4; k++) {
        part('mountTube' + k, 'tube');
        artery('mountTube' + k, 'lug' + k, 'fw' + k,
          sweep(resample([lugs[k], fwPts[k]]), tubeR, ENGM_MAT.mount,
                { capA: true, capB: true, sides: S.detail }));
      }
      if (P.mountX) {
        // side-plane diagonals — STRAIGHT (user ruling: no curved tubing).
        // They start on the shock stack's aft face like the main tubes, so
        // the small acc body and the stand-off are what make straight work.
        for (const [a, c] of [[0, 2], [2, 0], [1, 3], [3, 1]]) {
          part('mountDiag', 'tube');
          sweep(resample([lugs[a], fwPts[c]]), tubeR * 0.8, ENGM_MAT.mount,
                { capA: true, capB: true, sides: S.detail });
        }
      }
      // ENGINE-SIDE (G24.4 rework): a machined boss on the case's aft face
      // and a rubber puck, both ALONG THE CRANK AXIS — the stack stands the
      // tube 0.32*caseR off the case, which is what lets it run straight.
      for (let k = 0; k < 4; k++) {
        part('lugBoss' + k);
        lathe(lugC[k], [0, 0, -1], { u: X, w: Y }, [
          { t: -0.02 * cR, r: 0.16 * cR }, { t: 0.10 * cR, r: 0.13 * cR },
        ], ENGM_MAT.flange, true, true, S.detail);
        part('puck' + k, 'tube');
        lathe([lugC[k][0], lugC[k][1], zTail - 0.10 * cR], [0, 0, -1],
              { u: X, w: Y }, [
          { t: 0, r: 0.15 * cR }, { t: 0.22 * cR, r: 0.15 * cR },
        ], ENGM_MAT.puck, true, true, S.detail);
      }
      if (P.fwOn) {
        for (let k = 0; k < 4; k++) {
          const d = nrm(sub(fwPts[k], lugs[k]));
          part('fwPad' + k);
          prism([fwPts[k][0], fwPts[k][1], 0], Z, X, Y,
                roundRect(0.36 * cR, 0.36 * cR, 0.09 * cR),
                zFw, zFw + 0.05 * cR, ENGM_MAT.flange, true, true, 0.015 * cR);
          part('fwCone' + k, 'tube');
          lathe(fwPts[k], mul(d, -1), frameOf(d), [
            { t: -0.02 * cR, r: 0.14 * cR }, { t: 0.15 * cR, r: 0.085 * cR },
          ], ENGM_MAT.mount, true, false, S.detail);
          if (P.screws) {
            part('fwPadBolt' + k, 'solid', 8);
            for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
              bolt([fwPts[k][0] + px * 0.12 * cR, fwPts[k][1] + py * 0.12 * cR,
                    zFw + 0.05 * cR], Z, 0.026 * cR, ENGM_MAT.flange);
          }
        }
      }
    }
    if (P.fwOn) {
      part('firewall');
      prism([0, 0, 0], Z, X, Y,
            roundRect(P.fwW, P.fwH, 0.08 * Math.min(P.fwW, P.fwH)),
            zFw - fwT, zFw, ENGM_MAT.firewall, true, true, 0.45 * fwT);
      if (P.ruler) {
        // THE METRE STRIP (G24.4): 0.1 m ticks, taller at each half metre,
        // on a baseline near the plate's foot. Deliberately metric — the
        // plate is the aircraft-side datum, and this is its scale.
        const half = Math.floor(0.42 * P.fwW / 0.1) * 0.1;
        const nT = Math.round(2 * half / 0.1) + 1;
        const y0 = -0.32 * P.fwH;
        part('ruler', 'box', nT + 1);
        prism([0, y0, 0], Z, X, Y,
              [[-half - 0.012, -0.004], [half + 0.012, -0.004],
               [half + 0.012, 0.004], [-half - 0.012, 0.004]],
              zFw, zFw + 0.006, ENGM_MAT.mark, true, true);
        for (let i = 0; i < nT; i++) {
          const x = -half + i * 0.1;
          const major = Math.abs(x / 0.5 - Math.round(x / 0.5)) < 1e-6;
          prism([x, y0 + 0.004, 0], Z, X, Y,
                [[-0.0045, 0], [0.0045, 0],
                 [0.0045, major ? 0.052 : 0.028], [-0.0045, major ? 0.052 : 0.028]],
                zFw, zFw + 0.012, ENGM_MAT.mark, true, true);
        }
      }
    }

    // ---- the SERVICES through the firewall: fuel + throttle ---------------
    if (P.plumb && P.carbOn && P.fwOn) {
      part('fuel', 'tube');
      const pf = smooth([
        fuelFw,
        [fuelFw[0] * 0.55, fuelFw[1] - 0.35 * cR, zFw + 0.35 * (carb.pos[2] - zFw)],
        [carb.bowlIn[0] + 0.30 * b, carb.bowlIn[1] - 0.22 * b, carb.bowlIn[2] - 0.3 * b],
        carb.bowlIn,
      ]);
      artery('fuel', 'firewall', 'carb',
        sweep(pf, Math.max(0.045 * b, 0.020 * cR), ENGM_MAT.fuel,
              { capA: true, capB: true }));
      part('throttle', 'tube');
      const pt = smooth([
        thrFw,
        [thrFw[0] * 0.9, thrFw[1] - 0.30 * cR, zFw + 0.4 * (carb.pos[2] - zFw)],
        [carb.arm[0] - 0.16 * b, carb.arm[1] + 0.05 * b, carb.arm[2] - 0.25 * b],
        carb.arm,
      ]);
      artery('throttle', 'firewall', 'carbArm',
        sweep(pt, Math.max(0.020 * b, 0.009 * cR), ENGM_MAT.throttle,
              { capA: true, capB: true }));
    }

    endParts();
    // tris: a quad with a repeated vertex (the cap-fan convention) is ONE
    // triangle on screen, so the count the renderer pays is not 2*quads
    let tris = 0;
    for (const f of F) tris += new Set(f.v).size >= 4 ? 2 : 1;
    return { V, F, parts, ports, arteries, resolved: R, P,
             edgeTarget: EDGE,
             stats: { verts: V.length, quads: F.length, tris } };
  }

  // -------------------------------------------------------------------------
  // LOD RECIPES — settings dicts over the polycount groups, nothing else:
  // the same builder, the same routing, the same checks. LADDER, not law —
  // a game will pick its own numbers; these are the measured starting rungs.
  // `screws` is the first part-DROPPING lever (bolts are all hex+washer and
  // stop reading long before the silhouette does).
  // -------------------------------------------------------------------------
  // Every set carries EVERY key any rung touches (leads/plumb included) —
  // G23.5's preset self-containment lesson: applied far-then-close must not
  // drag far's dropped wires along.
  const ENGM_LODS = [
    { name: 'hero (auto)', set: { quality: 2.0, sideCyl: 0, sideShaft: 0,
        sideAcc: 0, sidePipe: 10, sideDetail: 0, screws: 1,
        finN: 14, headFins: 8, leads: 1, plumb: 1 } },
    { name: 'close', set: { quality: 0.62, sideCyl: 10, sideShaft: 8,
        sideAcc: 6, sidePipe: 6, sideDetail: 4, screws: 1,
        finN: 10, headFins: 3, leads: 1, plumb: 1 } },
    { name: 'mid', set: { quality: 0.5, sideCyl: 8, sideShaft: 6,
        sideAcc: 6, sidePipe: 6, sideDetail: 4, screws: 0,
        finN: 8, headFins: 2, leads: 1, plumb: 1 } },
    // at range the wires are thinner than a pixel: `far` DROPS them (and
    // their plugs with them) — the first automatic part-shedding rung
    { name: 'far', set: { quality: 0.35, sideCyl: 6, sideShaft: 6,
        sideAcc: 4, sidePipe: 4, sideDetail: 4, screws: 0,
        finN: 5, headFins: 0, leads: 0, plumb: 0 } },
  ];

  return { ENGM_DEFAULT, ENGM_PARAMS, ENGM_MAT, ENGM_LODS, engMeshBuild };
})();

if (typeof module !== 'undefined') module.exports = EM;
if (typeof window !== 'undefined') window.ENG_MESH = EM;
