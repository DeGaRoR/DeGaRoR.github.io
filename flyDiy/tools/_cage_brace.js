// CAGE BRACE LAYER (G185) — the cabane, the interplane struts and the bracing
// wires: everything that holds a plane up that is not a lift strut.
//
// WHAT THIS DRAWS AND WHAT IT DOES NOT. The frame (61_gen_frame.js) decides
// which members exist: a plane standing a cabane height above the roof gets
// its root ties drawn as cabane struts (class 'cabane'); a second plane gets
// interplane struts (class 'interplane') and flying/landing wires (class
// 'wire'). This layer reads those beams off the wing layer's own def and
// draws EXACTLY them — a fitting at each end, the member between — through
// the same plate + clevis the lift struts wear (_strut_gen.js), on the
// surfaces that are really there (the built fuselage through the airframe
// contract; the built wing through the wing layer's ray). It moves no physics
// and it invents no member: if a build wants a strut the frame did not emit,
// that is the frame's change (the G87 posture, restated for the truss).
//
// Loads AFTER _cage_wing (it reads window.CAGE_WING: def, nodeCage, wingRay,
// AF) and BEFORE _cage_gear (the manifest's G133 ordering — the gear reads
// the wing, and nothing here changes what the gear reads). Chains PAGE.post.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});

PAGE.defaults = Object.assign({
  // the cabane's drawing style (the structure is identical either way — see
  // 61_gen_frame's cabane block) and its foot's two trims, the lift strut's
  // own pair: fore/aft moves BOTH ends of every member so a strut stays
  // straight, in/out walks the foot round the section as arc length
  bpCabane: 0, bpStrutZ: 0, bpStrutX: 0,
  // the biplane's truss: the interplane strut kind and station, its fore/aft
  // trim, and the wires (flying + landing, flying only, none) with their gauge
  bpInter: 0, bpInterAt: 0.62, bpInterZ: 0, bpWires: 1, bpWireD: 5,
}, PAGE.defaults || {});

// ---- panel ----------------------------------------------------------------
// A cabane exists on a PARASOL plane (wgPos 3) and on a biplane (w2On, from
// G185.6 on); the rows are gated the same way the part is.
const onCab = P => Math.round(P.wgPos || 0) === 3 || !!+P.w2On;
const onBip = P => !!+P.w2On;
const BRACE_ITEMS = [
  ['cabane', [
    ['bpCabane', 'cabane', 0, 1, 1, ['N struts', 'V struts'], { when: onCab }],
    ['bpStrutZ', 'fore / aft', -0.20, 0.20, 0.01, { when: onCab, dim: 'm' }],
    ['bpStrutX', 'in / out (foot)', -0.25, 0.35, 0.01, { when: onCab, dim: 'm' }],
  ], { when: onCab }],
  ['interplane & wires', [
    ['bpInter', 'interplane struts', 0, 2, 1, ['N struts', 'I strut', 'none'], { when: onBip }],
    ['bpInterAt', 'station (semispan)', 0.30, 0.95, 0.01,
     { when: P => onBip(P) && Math.round(P.bpInter) < 2 }],
    ['bpInterZ', 'fore / aft', -0.20, 0.20, 0.01,
     { when: P => onBip(P) && Math.round(P.bpInter) < 2, dim: 'm' }],
    ['bpWires', 'bracing wires', 0, 2, 1, ['none', 'flying + landing', 'flying only'], { when: onBip }],
    ['bpWireD', 'wire diameter', 3, 8, 0.5,
     { when: P => onBip(P) && Math.round(P.bpWires) > 0, dim: 'mm' }],
  ], { when: onBip }],
];
{
  const host6 = (PAGE.groupsOverride || []).find(g => g[0] === '6 · wings');
  if (host6) host6[1].push(...BRACE_ITEMS);
  else (PAGE.groupsOverride || (PAGE.groups = PAGE.groups || []))
    .push(['6 · wings', BRACE_ITEMS]);
}

// ---- materials (the no-editor fallback; the livery overrides) -------------
const COL = { strut: 0xe6e2d8, wire: 0x9aa0a6 };
const flat = (c, extra) => new THREE.MeshStandardMaterial(Object.assign(
  { color: c, roughness: 0.32, metalness: 0.12 }, extra || {}));

let group = null;
const dispose = g => {
  if (!g) return;
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  if (g.parent) g.parent.remove(g);
};

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, P, stat } = ctx;
  dispose(group); group = null;
  window.CAGE_BRACE = null;
  const W = window.CAGE_WING;
  const SG = window.STRUT_GEN, GG = window.GEAR_GEN;
  if (!W || !W.def || !W.nodeCage || !W.nodeCageBody || !W.AF || !SG || !GG) return;
  const WIRE = !!(document.getElementById('wire') &&
                  document.getElementById('wire').checked);
  if (WIRE) return;                        // the frame view draws its own lines
  const def = W.def, N2 = def.nodes, AF = W.AF, nodeCage = W.nodeCage;
  const nodeCageBody = W.nodeCageBody;      // a foot is a fuselage station

  // ---- the members, by class -------------------------------------------
  const cab = (def.beams || []).filter(b => b.ext && b.cls === 'cabane');
  const inter = (def.beams || []).filter(b => b.ext && b.cls === 'interplane');
  const wires = (def.beams || []).filter(b => b.ext && b.cls === 'wire');
  if (!cab.length && !inter.length && !wires.length) return;
  const planes = W.planes || [];
  const planeOfNode = i => { for (const pl of planes) if (pl.spar && pl.spar.has(i)) return pl; return null; };

  // THE FORE/AFT TRIM AND ITS BAND: the wing's structural chord, the lift
  // strut's own rule (a control that silently stops is a control that lies)
  const CW = def.spec.wing || {};
  const PT = def.parts || {};
  const band = SG.strutBand(CW.chord || 1.6,
                            PT.sparFront != null ? PT.sparFront : 0.15,
                            PT.sparRear != null ? PT.sparRear : 0.65,
                            (def.spec.controls && def.spec.controls.aileron &&
                             def.spec.controls.aileron.chord) || 0.22);
  const want = -(P.bpStrutZ || 0);         // cage +z forward, body +x aft
  const sx = Math.max(band.lo, Math.min(band.hi, want));
  const clamped = Math.abs(sx - want) > 1e-6;
  // the interplane trim: the INTERSECTION of both planes' bands (a narrower
  // plane stops the slider sooner and says so)
  let band2 = band;
  if (def.spec.wings && def.spec.wings[1]) {
    const w1 = def.spec.wings[1], ct1 = w1.controls && w1.controls.aileron;
    const b1 = SG.strutBand(w1.chord || 1.6,
                            PT.sparFront != null ? PT.sparFront : 0.15,
                            PT.sparRear != null ? PT.sparRear : 0.65,
                            (ct1 && ct1.chord) || 0.22);
    band2 = { lo: Math.max(band.lo, b1.lo), hi: Math.min(band.hi, b1.hi) };
  }
  const wantI = -(P.bpInterZ || 0);
  const sxI = Math.max(band2.lo, Math.min(band2.hi, wantI));
  const clampedI = Math.abs(sxI - wantI) > 1e-6;

  group = new THREE.Group();
  group.name = 'cageLayer:brace';
  const notes = [];

  // A WING-TO-WING MEMBER: both ends are wing fittings (the interplane
  // strut's plate on the lower plane's UPPER skin and the upper plane's
  // LOWER skin; a wire's lug on the same plates). The strut module's
  // strutBuild is written foot-on-body + tips-on-wing, so the wing-to-wing
  // pair is drawn here with its own two wing plates through the module's
  // K.sweep and the same clevis rule — the aim of each ray is ACROSS the
  // wing from the side the member arrives on (the G86 lesson: aiming along
  // the member walks the fitting inboard of the spar).
  const K = window.GEAR_KIT;
  const FIT = SG.STRUT_FIT;
  const nrm = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/L, v[1]/L, v[2]/L]; };
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const wingEnd = (pl, q, fromBelow) => {
    // q: the spar node in cage space; fromBelow: the member arrives from
    // under this plane (a lower fitting on its lower skin) or from above
    if (!pl || !pl.wingRay) return { p: q, n: [0, fromBelow ? -1 : 1, 0], hit: false };
    const up = fromBelow ? -1 : 1;
    const h = pl.wingRay([q[0], q[1] + up * 0.6, q[2]], [0, -up, 0]);
    if (!h) return { p: q, n: [0, up, 0], hit: false };
    return { p: h.p, n: h.n, hit: true };
  };
  const plateAt = (bags, e) => {
    if (!e.hit || !K || !K.off) return e.p;
    // the plate's chordwise axis on the surface, its clevis standing off it
    const fw = nrm(sub([0, 0, 1], [e.n[0]*e.n[2], e.n[1]*e.n[2], e.n[2]*e.n[2]]));
    const back = [-e.n[0], -e.n[1], -e.n[2]];
    const proj = q => (e.pl && e.pl.wingRay) ? e.pl.wingRay(K.off(q, e.n, 0.15), back) : null;
    if (SG.padOn) SG.padOn(bags, K, e.p, e.n, fw, FIT.interPadL || 0.13, FIT.interPadW || 0.078,
                           FIT.interPadT || 0.005, proj, FIT);
    const ctr = K.off(e.p, e.n, FIT.wingStandoff);
    const half = 0.5 * (FIT.bladeT || 0.011) + 0.002;
    for (const s of [-1, 1])
      K.lug(bags.alloy, K.off(ctr, fw, s * half), fw, SG.strutClevisUp(K, e.n, fw),
            FIT.lugR, FIT.lugT, FIT.wingStandoff * 0.92);
    K.bolt(bags.steel, K.off(ctr, fw, -(half + FIT.lugT * 0.5 + 0.004)), fw, FIT.pinR, FIT.pinShank);
    return ctr;
  };
  // wire lugs are smaller and there is no blade: a single ear per end
  const lugAt = (bags, e) => {
    if (!e.hit || !K || !K.off) return e.p;
    const fw = nrm(sub([0, 0, 1], [e.n[0]*e.n[2], e.n[1]*e.n[2], e.n[2]*e.n[2]]));
    const ctr = K.off(e.p, e.n, (FIT.wireLugT || 0.006) + 0.004);
    K.lug(bags.alloy, ctr, fw, SG.strutClevisUp(K, e.n, fw), FIT.wireLugR || 0.010, FIT.wireLugT || 0.006, 0.01);
    return ctr;
  };

  // ---- THE INTERPLANE STRUTS ---------------------------------------------
  if (inter.length && K) {
    const bags = { alloy: GG.Bag(), steel: GG.Bag(), strut: GG.Bag() };
    const members = [];
    const done = new Map();          // one plate per (node): shared by the N's members
    let sN = 0, sLen = 0, onWing = 0;
    const cw = (FIT.chordK || 3.6) * (FIT.strutR || 0.023);
    const SECT = (typeof GEN_STRUT_SECT !== 'undefined') ? GEN_STRUT_SECT : null;
    const sect = t => SECT ? SECT.map(q => [(q[0] - 0.40) * cw, q[1] * cw])
                           : (() => { const o = []; for (let i = 0; i < 12; i++) { const a = 2*Math.PI*i/12; o.push([0.5*cw*Math.cos(a), 0.3*cw*Math.sin(a)]); } return o; })();
    for (const b of inter) {
      const pa = planeOfNode(b.a), pb = planeOfNode(b.b);
      const qa0 = N2[b.a].p, qb0 = N2[b.b].p;
      const qa = nodeCage([qa0[0] + sxI, qa0[1], qa0[2]]), qb = nodeCage([qb0[0] + sxI, qb0[1], qb0[2]]);
      const aIsUpper = qa[1] >= qb[1];
      const endOf = (id, pl, q, fromBelow) => {
        if (done.has(id)) return done.get(id);
        const e = wingEnd(pl, q, fromBelow); e.pl = pl;
        const ctr = plateAt(bags, e);
        if (e.hit) onWing++;
        done.set(id, ctr);
        return ctr;
      };
      // the upper end is reached from BELOW its plane; the lower from ABOVE
      const A = endOf(b.a, pa, qa, aIsUpper), Bp = endOf(b.b, pb, qb, !aIsUpper);
      K.sweep(bags.strut, K.resample([A, Bp], 16), sect, true, [0, 0, 1]);
      sN++; sLen += Math.hypot(Bp[0]-A[0], Bp[1]-A[1], Bp[2]-A[2]);
      members.push({ pin: A, tip: Bp, pinAt: 'wing', tipAt: 'wing', pinNode: b.a, tipNode: b.b });
    }
    const sg = new THREE.Group();
    sg.name = 'edFit_interplane';
    sg.userData.strutMembers = members;
    bags.strut.mesh(sg, (window.CAGE_SECMAT && window.CAGE_SECMAT('interplane',
      { surf: 0, fieldM: 1, tint0: COL.strut })) || flat(COL.strut));
    bags.alloy.mesh(sg, GG.gearMat('alloy'));
    bags.steel.mesh(sg, GG.gearMat('steel'));
    group.add(sg);
    notes.push('interplane ' + sN + ' · ' + (sLen / Math.max(1, sN)).toFixed(2) + ' m · ' +
      onWing + ' plates on skin' + (sxI || clampedI ? ' · fwd ' + (-sxI).toFixed(2) + (clampedI ? '!' : '') : ''));
  }

  // ---- THE WIRES ----------------------------------------------------------
  if (wires.length && K) {
    const bags = { alloy: GG.Bag(), steel: GG.Bag(), wire: GG.Bag() };
    const members = [];
    const rW = 0.5 * ((+P.bpWireD || 5) / 1000);
    const circ = (() => { const o = []; for (let i = 0; i < 8; i++) { const a = 2*Math.PI*i/8; o.push([rW*Math.cos(a), rW*Math.sin(a)]); } return o; })();
    let sN = 0, sLen = 0;
    for (const b of wires) {
      const pa = planeOfNode(b.a), pb = planeOfNode(b.b);
      const qa = nodeCage(N2[b.a].p), qb = nodeCage(N2[b.b].p);
      const aIsUpper = qa[1] >= qb[1];
      const ea = wingEnd(pa, qa, aIsUpper); ea.pl = pa;
      const eb = wingEnd(pb, qb, !aIsUpper); eb.pl = pb;
      const A = lugAt(bags, ea), Bp = lugAt(bags, eb);
      K.sweep(bags.wire, K.resample([A, Bp], 4), () => circ, true, [0, 0, 1]);
      sN++; sLen += Math.hypot(Bp[0]-A[0], Bp[1]-A[1], Bp[2]-A[2]);
      members.push({ pin: A, tip: Bp, pinAt: 'wing', tipAt: 'wing', pinNode: b.a, tipNode: b.b });
    }
    const sg = new THREE.Group();
    sg.name = 'edFit_wire';
    sg.userData.strutMembers = members;
    bags.wire.mesh(sg, (window.CAGE_SECMAT && window.CAGE_SECMAT('braceWire',
      { surf: 0, fieldM: 1, tint0: COL.wire })) || flat(COL.wire, { metalness: 0.8, roughness: 0.35 }));
    bags.alloy.mesh(sg, GG.gearMat('alloy'));
    group.add(sg);
    notes.push('wires ' + sN + ' · ' + (sLen / Math.max(1, sN)).toFixed(2) + ' m');
  }

  // ---- THE CABANE ------------------------------------------------------
  // Grouped BY FOOT: a cabane member runs from a top-longeron ring node
  // (b.b) up to a root spar node (b.a); one ring node may carry the post of
  // one spar and the diagonal of the other, which is exactly strutBuild's
  // shape — one foot, up to two wing ends, front first.
  {
    const byFoot = new Map();
    for (const b of cab) {
      const spar = (N2[b.a].tag === 'WF' || N2[b.a].tag === 'WR') ? b.a : b.b;
      const foot = spar === b.a ? b.b : b.a;
      if (!byFoot.has(foot)) byFoot.set(foot, []);
      byFoot.get(foot).push(spar);
    }
    const bags = { alloy: GG.Bag(), steel: GG.Bag(), strut: GG.Bag() };
    const members = [];
    let sN = 0, dOff = 0, dSnap = 0, sLen = 0, onWing = 0;
    for (const [foot, spars] of byFoot) {
      const fp = N2[foot].p;
      const site = SG.strutSite(AF, nodeCageBody([fp[0] + sx, fp[1], fp[2]]),
                                0, P.bpStrutX || 0);
      // two wing ends per call at most (strutBuild's contract); a foot with
      // three ties is drawn as a pair and a single on the same plate
      const ends = spars
        .map(id => { const q = N2[id].p;
                     return { top: nodeCage([q[0] + sx, q[1], q[2]]),
                              beam: nodeCage(q), node: id }; })
        .sort((a, b) => b.top[2] - a.top[2]);
      for (let i = 0; i < ends.length; i += 2) {
        const r = SG.strutBuild(bags, AF, site, ends.slice(i, i + 2),
                                { wingRay: W.wingRay });
        if (!r) continue;
        dSnap = Math.max(dSnap, site.snap.d);
        r.struts.forEach((st, j) => {
          sN++; sLen += st.len; dOff = Math.max(dOff, st.off);
          if (st.tip !== st.node) onWing++;
          members.push({ pin: st.pin, tip: st.tip, pinAt: 'body', tipAt: 'wing',
                         pinNode: foot, tipNode: ends[i + j].node });
        });
      }
    }
    if (sN) {
      const sg = new THREE.Group();
      sg.name = 'edFit_cabane';
      // G179.2's rule: the join reads these lines off the group and the game
      // poses every vertex along its own member, pin to tip
      sg.userData.strutMembers = members;
      bags.strut.mesh(sg,
        (window.CAGE_SECMAT && window.CAGE_SECMAT('cabane',
          { surf: 0, fieldM: 1, tint0: COL.strut })) || flat(COL.strut));
      bags.alloy.mesh(sg, GG.gearMat('alloy'));
      bags.steel.mesh(sg, GG.gearMat('steel'));
      group.add(sg);
      notes.push('cabane ' + sN + ' · ' + (sLen / sN).toFixed(2) + ' m · ' +
        onWing + '/' + sN + ' on wing · snap ' + (dSnap * 1000).toFixed(0) +
        ' mm · off ' + (dOff * 1000).toFixed(0) + ' mm' +
        (sx || clamped ? ' · fwd ' + (-sx).toFixed(2) + (clamped ? '!' : '') : ''));
    }
  }

  scene.add(group);
  if (stat && notes.length) stat.textContent += '  ·  brace: ' + notes.join(' · ');
  window.CAGE_BRACE = { group, cabane: cab.length, interplane: inter.length, wires: wires.length };
};
})();
