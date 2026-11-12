#!/usr/bin/env node
// GATE NACELLE (the Archaeopteryx study's stage 3, futureDesigns/archaeopteryx/CONFIG_STUDY.md) - THE HANGING NACELLE,
// first piece: THE MAST. The cabin hangs on one structural mast from the wing's centre section, through a cut in the
// roof, down to the keel.
//
// The user (11 Nov 2026): "the pylon is structural and should go down to the bottom of the plane, where the supporting
// beam will go, making the fuselage as we see it now not the central piece anymore. It should probably get a proper cut
// to allow the pylon through, and be constrained at its bottom to the supporting beam"; then "the wheel should anchor
// onto the pylon ... the engine ... on the back face of the pylon"; and, on the real one's photo, "the cabin piece is
// actually in front of the pillar" - the whole cabin moves relative to the pillar.
//
//   node tools/_nacelle_check.js            -> "GATE NACELLE: PASS|FAIL"
//
// A. THE SPEC: fuselage.hang reaches the spec from the cage's row (the join's), with its station and chord on the root
//    chord and the drawn mast's stations (hangX, measured), only under a wing above the cabin (high or parasol); gone when
//    off, under a low wing.
// B2 (12 Nov, v1): the keel both ways - the single beam (hangKeels 1: its frame members, its drawing straight and level
//    at the mast's foot, the nose hanging on it) and the card's twin tubes (hangKeels 2: two tubes at the window's sill,
//    each station on its ring's corners on its side, laddered across, both ends on the mast; drawn level, nose to mast).
// B. THE FRAME: one mast (GEN_HANG's lattice) from the root chord down to the keel where the drawn one stands - its head tied to
//    every root-bay node of the hub (in the rod's rigid cluster when the rod is rooted there), its foot's two lowest
//    levels tied to the keel corners of the rings round it; the wing has no other tie to the cabin's rings (the rod's
//    own socket aside), on a parasol no cabane; nothing degenerate; the mast weighs GEN_HANG.kgM a metre; THE WHEEL HANGS
//    FROM ITS FOOT: the monowheel's axle under the mast's middle, its members on the mast's nodes, none on the cabin's.
// C. THE AEROPLANE STANDS: parked on its wheel 6 s it settles (no member lets go); the hub held, the cabin under 2 g more
//    hangs from the mast and the rod's ring (its nose's keel within 25 mm: 12 measured on the card, the box no longer tied
//    into the cabin's rings).
// D. THE DRAWING: the mast at its station on the root chord, the cabin free of it (a longer cabin leaves it where it
//    stands); the pusher on its back face; the wheel's fitting its middle; the sunk wheel's square cut leaves the rod over
//    it whole (no rod face reaches below the rod);
//    the mast drawn from the wheel's fork (a sunk wheel) or the keel up to the wing's underside; on a parasol the
//    mast drawn and no cabane strut (its cut through a raised aft section is not clean yet: not held here); under a wing
//    on the body no cut (nothing to cut); none of it without the row.
'use strict';
const path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const SH = require(path.join(T, '_scene_headless.js')), KG = require(path.join(T, '_knife_gen.js'));
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const r3 = v => Math.round(v * 1000) / 1000;
const { D } = BJ.loadPanel();
const A = D.ARCHETYPES.find(x => x.key === 'archaeopteryx');
const born = cage => {
  const s0 = D.designBake(Object.assign({}, A.sel), { cage: Object.assign({}, A.over.cage, cage), spec: Object.assign({}, A.over.spec) });
  return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
};
const build = sp => C.buildGen(JSON.parse(JSON.stringify(sp)));
const PARA = { wgPos: 3, wgParaH: 0.35, rodY: 1.2677 };
// (the card hangs since 11 Nov: off is the row at 0)
const s0 = born({ hangOn: 0 }), s1 = born({ hangOn: 1 }), sP = born(Object.assign({ hangOn: 1 }, PARA)), sP0 = born(Object.assign({ hangOn: 0 }, PARA));
// THE TWO KEELS (12 Nov): the card flies the twin tubes (hangKeels 2); the single beam is the row at 1
const s1s = born({ hangOn: 1, hangKeels: 1 });
const d0 = build(s0), d1 = build(s1), dP = build(sP), dP0 = build(sP0), d1s = build(s1s);

console.log('A. THE SPEC');
ok(s1.fuselage.hang === true && !('hang' in s0.fuselage) && d1.spec.fuse.hang === true && !('hang' in d0.spec.fuse),
   `A the row writes fuselage.hang (${s1.fuselage.hang}); none without it`);
{ const sa = born({ hangOn: 1, hangAt: 0.7, hangLen: 0.4 }), hx = sa.fuselage.hangX;
  ok(sa.fuselage.hangAt === 0.7 && sa.fuselage.hangLen === 0.4 && Array.isArray(hx) && hx[1] - hx[0] > 0.3,
     `A the mast's station and chord ride along (${sa.fuselage.hangAt}, ${sa.fuselage.hangLen}) and the drawn mast is measured (hangX ${hx ? hx.join(' - ') : '-'})`); }
{ const cs = (f, pos) => { const x = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); Object.assign(x.fuselage, f); if (pos) x.wings[0].position = pos; return C.clampSpec(x).fuselage; };
  const lo = cs({ hang: true, hangAt: 0.5, hangLen: 0.5, hangX: [1, 1.3] }, 'low'), off = cs({ hang: false, hangAt: 0.5, hangLen: 0.5 }), cl = cs({ hang: true, hangAt: 2, hangLen: 0.01, hangX: [1.3, 1] }, 'parasol');
  ok(!('hang' in lo) && !('hangAt' in lo) && !('hangLen' in lo) && !('hangX' in lo) && !('hang' in off) && !('hangAt' in off) && !('hangLen' in off)
     && cl.hang === true && cl.hangAt === 0.95 && cl.hangLen === 0.1 && !('hangX' in cl),
     `A gone under a low wing and when off; clamped on a parasol (${cl.hangAt}, ${cl.hangLen}), a backwards hangX dropped`); }

console.log('B. THE FRAME');
for (const [lab, d, dOff] of [['high wing', d1, d0], ['parasol', dP, dP0]]) {
  const M = d.refs.mast, wf = d.parts.wf, P = d.nodes.map(n => n.p);
  const tied = (a, b) => d.beams.some(q => (q.a === a && q.b === b) || (q.a === b && q.b === a));
  const hub = [];
  for (const sd of ['L', 'R']) for (const k of ['F', 'R', 'FB', 'RB']) if (wf[sd][k] && wf[sd][k][0] != null && !hub.includes(wf[sd][k][0])) hub.push(wf[sd][k][0]);
  const rings = d.nodes.map((n, i) => /^S\d+[TB][LR]$/.test(n.tag) ? i : -1).filter(i => i >= 0);
  const keel = d.nodes.map((n, i) => /^S\d+B[LR]$/.test(n.tag) ? i : -1).filter(i => i >= 0);
  const RC = (d.parts.clusters || d.clusters || []).find(c => c.tag === 'ROD');
  const ok1 = M && M.head.length === 4 && M.head.every(h => hub.every(m => tied(h, m))) && (!RC || !RC.hub || M.head.every(h => RC.nodes.includes(h)));
  const lv0 = M ? M.nodes.slice(0, 8) : [];
  const ok2 = M && lv0.every(t => keel.some(k => tied(t, k))) && M.foot.every(t => Math.abs(P[t][1] - Math.min(...keel.filter(k => Math.abs(P[k][0] - P[t][0]) < 0.7).map(k => P[k][1]))) < 0.08);
  // the wing's other ties to the cabin's rings: none but the rod's socket (the rod's root ring, 3c)
  const wing = new Set(d.nodes.map((n, i) => /^W/.test(n.tag) ? i : -1).filter(i => i >= 0));
  const sock = new Set(RC && RC.rings ? RC.rings[0] : []);
  const stray = d.beams.filter(q => (wing.has(q.a) && rings.includes(q.b) && !sock.has(q.b)) || (wing.has(q.b) && rings.includes(q.a) && !sock.has(q.a)));
  const cab = d.beams.filter(q => q.cls === 'cabane' && !(M.nodes.includes(q.a) || M.nodes.includes(q.b)));
  ok(ok1 && ok2, `B ${lab}: the mast (${M ? M.nodes.length : 0} nodes, ${M ? r3(M.h) : '-'} m, ${M ? r3(M.x[1] - M.x[0]) : '-'} m chord) - its head tied to the hub's ${hub.length} root nodes${RC && RC.hub ? ' and in the rod\'s cluster' : ''}, its foot on the keel corners`);
  ok(!stray.length && !cab.length && !(d.parts.degenerate || []).length,
     `B ${lab}: no other tie from the wing to the cabin's rings (${stray.length}), no cabane (${cab.length}), nothing degenerate`);
  const m0 = dOff.nodes.reduce((a, n) => a + n.m, 0), m1 = d.nodes.reduce((a, n) => a + n.m, 0);
  ok(M && Math.abs(M.kg - C.GEN_HANG.kgM * M.h) < 1e-6 && isFinite(m1 - m0),
     `B ${lab}: the mast weighs ${M ? M.kg.toFixed(2) : '-'} kg (${C.GEN_HANG.kgM} kg/m); the aeroplane ${m1.toFixed(1)} kg (${m0.toFixed(1)} on the cabin)`);
  const ax = d.refs.mains[0], hx = d.spec.fuse.hangX;
  const legs = d.beams.filter(q => q.a === ax || q.b === ax).map(q => q.a === ax ? q.b : q.a);
  ok(d.refs.mains.length === 1 && M && Array.isArray(hx) && Math.abs(M.x[0] - hx[0]) < 1e-9 && Math.abs(M.x[1] - hx[1]) < 1e-9
     && P[ax][0] > M.x[0] && P[ax][0] < M.x[1] && legs.length >= 4 && legs.every(n => M.nodes.includes(n)),
     `B ${lab}: the mast where the drawn one stands (${M ? M.x.map(r3).join(' - ') : '-'} m), the wheel under its chord (${r3(P[ax][0])}), its ${legs.length} members all on the mast`);
}

console.log('B2. THE KEEL BEAM');
{ const d = d1s, K = d.refs.keel, M = d.refs.mast, tied = (a, b) => d.beams.some(q => (q.a === a && q.b === b) || (q.a === b && q.b === a));
  const ring = t => d.nodes.findIndex(n => n.tag === t);
  const ok1 = K && M && Math.abs(K.x[1] - M.x[0]) < 1e-9 && K.rings[0] === 0 && K.rings.every((i, k) => ['BL', 'BR'].every(s => tied(K.bottom[k], ring('S' + i + s)) && tied(K.top[k], ring('S' + i + s))));
  const lb = K ? K.bottom[K.bottom.length - 1] : -1, ok2 = K && M && [M.foot[0], M.foot[1]].every(q => tied(lb, q));
  ok(ok1 && ok2 && Math.abs(K.kg - C.GEN_HANG.keelKgM * K.len) < 1e-6,
     `B2 the keel beam from the nose's ring to the mast's front (${K ? K.x.map(r3).join(' - ') : '-'} m, ${K ? K.bottom.length : 0} stations, ${K ? K.kg.toFixed(2) : '-'} kg), every station on its ring's bottom corners, its end on the mast's foot`);
  ok(!d0.refs.keel, 'B2 none without the hanging nacelle'); }
// THE TWIN KEEL (hangKeels 2, the card's; the user 12 Nov: "2 of them and the pilot fits between, mounted at the level of
// the bottom of the pilot window ... tubes ... they anchor on the nose part, they're straight"): a tube a side at the
// sill (hangKeelK of the ring's height), each station tied to its ring's two corners on its side, laddered across, both
// ends on the mast's levels, the tubes' mass GEN_HANG.tubeKgM a metre each
{ const d = d1, K = d.refs.keel, M = d.refs.mast, P = d.nodes.map(n => n.p), tied = (a, b) => d.beams.some(q => (q.a === a && q.b === b) || (q.a === b && q.b === a));
  const ring = t => d.nodes.findIndex(n => n.tag === t);
  const ok1 = K && K.twin === 1 && M && K.left.length === K.rings.length && K.right.length === K.rings.length && K.rings.length >= 2
    && K.rings.every((i, q) => tied(K.left[q], ring('S' + i + 'BL')) && tied(K.left[q], ring('S' + i + 'TL'))
                            && tied(K.right[q], ring('S' + i + 'BR')) && tied(K.right[q], ring('S' + i + 'TR')) && tied(K.left[q], K.right[q]))
    && K.left.every(n => d.nodes[n].tag === 'KEELL') && K.right.every(n => d.nodes[n].tag === 'KEELR');
  // STRAIGHT: each tube's stations on one line (the frame takes the sill at hangKeelK of each ring's own height, so the
  // tube rakes with the rings; the drawn tubes are level - D)
  const dev = side => { if (!K || side.length < 3) return 0; const a = P[side[0]], b = P[side[side.length - 1]];
    return Math.max(...side.map(n => { const t = (P[n][0] - a[0]) / ((b[0] - a[0]) || 1); return Math.hypot(...[0, 1, 2].map(c => P[n][c] - (a[c] + (b[c] - a[c]) * t))); })); };
  const sp = K ? Math.max(dev(K.left), dev(K.right)) : NaN, rake = K ? P[K.left[K.left.length - 1]][1] - P[K.left[0]][1] : NaN;
  const lE = K ? K.left[K.left.length - 1] : -1, rE = K ? K.right[K.right.length - 1] : -1;
  const ok2 = K && M && M.nodes.some(m => tied(lE, m)) && M.nodes.some(m => tied(rE, m)) && Math.abs(K.x[1] - M.x[0]) < 1e-9;
  ok(ok1 && ok2 && Math.abs(K.kg - 2 * C.GEN_HANG.tubeKgM * K.len) < 1e-6,
     `B2 the twin keel: two tubes (${K ? K.left.length : 0} stations a side, ${K ? K.x.map(r3).join(' - ') : '-'} m, ${K ? K.kg.toFixed(2) : '-'} kg), each station on its ring's corners on its side and laddered across, both ends on the mast`);
  ok(sp < 0.02, `B2 the twin keel's tubes straight (stations within ${r3(sp)} m of the line; ${r3(rake)} m of rake nose to mast, the rings' own sill)`);
  ok(!d1.refs.keel.bottom && d1s.refs.keel && !d1s.refs.keel.twin, 'B2 the twin and the single beam are the row\'s two answers'); }

console.log('C. THE AEROPLANE STANDS');
{ const flat = { terrainH: () => 0, waterH: () => -1e9, surface: () => 0, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } };
  for (const [lab, d] of [['high wing', d1], ['parasol', dP]]) {
    const s = C.makeSim(d, flat); s.reset(0);
    for (let f = 0; f < 360; f++) s.step(1 / 60);
    let vmax = 0; for (let i = 0; i < d.nodes.length; i++) vmax = Math.max(vmax, Math.hypot(s.v[i * 3], s.v[i * 3 + 1], s.v[i * 3 + 2]));
    const broken = s.damageCaps ? 0 : 0;
    // the hub held, 2 g more on every other node: the nose's keel
    const sim = C.makeSim(d, null); sim.reset(0);
    const N = (sim.trueBox ? sim.trueBox() : 0) || d.params.substeps, dt = 1 / (60 * N), wf = d.parts.wf, pin = new Set();
    for (const sd of ['L', 'R']) for (const j of [0, 1]) for (const k of ['F', 'R', 'FB', 'RB']) if (wf[sd][k] && wf[sd][k][j] != null) pin.add(wf[sd][k][j]);
    const p0 = Array.from(sim.p), nose = d.nodes.findIndex(n => n.tag === 'S0BL'), y0 = sim.p[nose * 3 + 1];
    let acc = 0, n = 0;
    for (let k = 0; k < 60 * N * 2; k++) {
      for (let i = 0; i < d.nodes.length; i++) if (!pin.has(i)) sim.impulse(i, 0, -2 * 9.81 * d.nodes[i].m * dt, 0);
      sim.step(dt, 1);
      for (const i of pin) for (let c = 0; c < 3; c++) { sim.p[i * 3 + c] = p0[i * 3 + c]; sim.v[i * 3 + c] = 0; }
      if (k >= 60 * N) { acc += y0 - sim.p[nose * 3 + 1]; n++; }
    }
    const drop = acc / n;
    ok(isFinite(vmax) && vmax < 0.5 && isFinite(drop) && Math.abs(drop) < 0.025 && !broken,
       `C ${lab}: parked 6 s it settles (fastest node ${vmax.toFixed(3)} m/s); the hub held, 2 g more: the nose's keel moves ${(1000 * drop).toFixed(1)} mm`);
  } }

console.log('D. THE DRAWING');
{ const scene = (sp, over) => SH.sceneBuild(sp, { over: over || {}, garage: sp });
  const look = S => {
    // (the engine's front: the drawn engine group's forward-most point, its mount on the face)
    const HG = S.W.CAGE_HANG, EG = S.scene.children.find(o => o.name === 'cageLayer:eng'),
          EF = EG ? { z: new (SH.context().THREE.Box3)().setFromObject(EG).max.z } : null,
          rodLow = (() => { const sh = S.built.sheet, FS = S.FS, ax = S.P.rodY * FS - 0.5 * S.P.rodD * FS - 0.02;
            const cs = ((S.W.CAGE_GEAR && S.W.CAGE_GEAR.cuts) || []).concat((S.W.CAGE_GEAR && S.W.CAGE_GEAR.cutsSide) || []);
            const m = cs.length ? KG.knifeWells(sh, cs) : sh; return m.F.filter(f => f.m === 'boomTube' && f.v.some(i => m.V[i][1] * FS < ax)).length; })(), c1 = ((S.W.CAGE_GEAR && S.W.CAGE_GEAR.contacts) || []).find(c => c.st && c.st.id === 1);
    let mast = null; S.scene.traverse(o => { if (o.name === 'hangMast') { o.geometry.computeBoundingBox(); mast = o.geometry.boundingBox; } });
    const cuts = ((S.W.CAGE_GEAR && S.W.CAGE_GEAR.cuts) || []).filter(c => c.top);
    const m = cuts.length ? KG.knifeWells(S.built.sheet, cuts) : null, st = m ? m.knifeStats.find(x => x.loops != null) : null;
    return { mast, cuts: cuts.length, loops: st ? st.loops : 0, cab: S.W.CAGE_BRACE ? S.W.CAGE_BRACE.cabane : null, AF: S.W.CAGE_GEAR && S.W.CAGE_GEAR.AF,
             eng: HG && EF && isFinite(EF.z) ? EF.z - HG.zR : null, zc: HG ? HG.zc : null, chord: HG ? HG.zF - HG.zR : null, rodLow,
             wheel: HG && c1 ? c1.p[2] - HG.zc : null, foot: HG ? HG.yFoot - HG.yK : null };
  };
  const H = look(scene(s1)), Pp = look(scene(sP)), O = look(scene(s0)), OP = look(scene(sP0));
  // the foot: on the sunk wheel's fork (the card's: 2 R sink over the keel, and 2 cm), else on the keel
  const sunk = +s1.cage.s1Sink > 0 ? 2 * (+s1.cage.s1R) * (+s1.cage.s1Sink) + 0.02 : 0;
  const reach = L => L.mast && L.AF && Math.abs(L.mast.min.y - (L.AF.keelAt(0.5 * (L.mast.min.z + L.mast.max.z)) + sunk)) < 0.07;
  const L2 = look(scene(born({ hangOn: 1, pilotLen: +s1.cage.pilotLen - 0.2 })));
  ok(H.eng != null && H.eng > -0.002 && H.eng < 0.02 && H.wheel != null && Math.abs(H.wheel - (+s1.cage.s1AxZ || 0)) < 0.005 && Math.abs(H.wheel) < 0.5 * H.chord && L2.zc != null && Math.abs(L2.zc - H.zc) < 0.005,
     `D the pusher on the mast's back face (${H.eng != null ? (1000 * H.eng).toFixed(1) : '-'} mm), the wheel at its middle and the row's offset, under its chord (${H.wheel != null ? (1000 * H.wheel).toFixed(1) : '-'} mm, the chord ${(1000 * H.chord).toFixed(0)}); a cabin 0.2 m shorter leaves the mast where it stands (${L2.zc != null ? (1000 * (L2.zc - H.zc)).toFixed(1) : '-'} mm)`);
  ok(H.rodLow === 0, `D the sunk wheel's square cut leaves the rod over it whole (${H.rodLow} rod faces below the rod)`);
  // the keel beam drawn STRAIGHT (12 Nov, the user: "make it straight"): from the cabin's first floor station, on its
  // floor, to the mast's foot, a finger into it - two stations and nothing between
  { const S1 = scene(s1s), HG = S1.W.CAGE_HANG; let K = null, V = null;
    S1.scene.traverse(o => { if (o.name === 'hangKeel') { K = o.userData.keel; const pa = o.geometry.attributes.position; V = []; for (let i = 0; i < pa.count; i++) V.push([pa.getX(i), pa.getY(i), pa.getZ(i)]); } });
    const CG2 = S1.W.CAGE2, RR = CG2.cageResolve(CG2.cageSpec(S1.P)), FS = S1.FS;
    const fl = RR.rings.map(r => r.lv && r.lv.floor).filter(f => f && Math.abs(f.z * FS - (K ? K.z0 : NaN)) < 1e-6)[0];
    const zs = V ? [...new Set(V.map(v => v[2].toFixed(5)))] : [];
    const top = V ? Math.max(...V.filter(v => Math.abs(v[2] - K.z1) < 1e-6).map(v => v[1])) : NaN;
    const bot0 = V ? Math.min(...V.filter(v => Math.abs(v[2] - K.z0) < 1e-6).map(v => v[1])) : NaN;
    // LEVEL (the user: "completely straight, keep it anchored where it is ... just anchor the nose ... the nose goes a
    // little bit further down"): its height is the mast's foot's, so the floor at its front is wherever the cabin puts it
    // - read and reported, the nose's to follow (the card flies the twin tubes, its cabin tuned to them)
    const bot1 = V ? Math.min(...V.filter(v => Math.abs(v[2] - K.z1) < 1e-6).map(v => v[1])) : NaN;
    ok(K && HG && zs.length === 2 && Math.abs(K.z1 - HG.zF) < 1e-6 && fl && Math.abs(bot0 - bot1) < 1e-6 && Math.abs(top - (HG.yFoot + 0.04)) < 1e-3,
       `D the keel beam drawn straight and level (${zs.length} stations) from the cabin's first floor station (${K ? r3(K.z0) : '-'} m; its floor ${fl ? r3(bot0 - (fl.y * FS - 0.02)) : '-'} m under the beam) to the mast's foot (${K ? r3(K.z1) : '-'} m, ${r3(top - HG.yFoot)} into it)`); }
  // the twin keel drawn: two straight tubes at the sill from where the nose closes in on them to the mast's front
  { const S1 = scene(s1), HG = S1.W.CAGE_HANG; let K = null;
    S1.scene.traverse(o => { if (o.name === 'hangKeel') K = o.userData.keel; });
    const CG2 = S1.W.CAGE2, RR = CG2.cageResolve(CG2.cageSpec(S1.P)), rg = RR.rings.find(q => q.name === 'ring');
    const ysill = rg && rg.lv && rg.lv.waist ? rg.lv.waist.y * S1.FS : NaN;
    ok(K && K.twin === 1 && HG && Math.abs(K.z1 - HG.zF) < 1e-6 && K.z0 - K.z1 > 0.5 && Math.abs(K.y - ysill) < 1e-6 && K.x > 0.1,
       `D the twin keel drawn: two tubes ${K ? r3(2 * K.x) : '-'} m apart at the window's sill (${K ? r3(K.y) : '-'} m), straight from the nose (${K ? r3(K.z0) : '-'} m) to the mast's front (${K ? r3(K.z1) : '-'} m)`); }
  ok(H.mast && reach(H) && H.cuts === 0 && Math.abs(H.foot - sunk) < 0.005,
     `D high wing: the mast drawn from the wheel's fork (${H.mast ? r3(H.mast.min.y) : '-'} m, ${r3(H.foot)} over the keel) up into the wing (${H.mast ? r3(H.mast.max.y) : '-'}), no roof to cut (${H.cuts})`);
  ok(Pp.mast && !Pp.cab, `D parasol: the mast drawn (${Pp.mast ? r3(Pp.mast.min.y) + ' to ' + r3(Pp.mast.max.y) + ' m' : '-'}), no cabane strut (${Pp.cab})`);
  ok(!O.mast && !OP.mast && !O.cuts && !OP.cuts && OP.cab > 0, `D without the row: no mast, no cut, the parasol's cabane drawn (${OP.cab} members)`); }

console.log(fails.length ? 'GATE NACELLE: FAIL (' + fails.length + ')' : 'GATE NACELLE: PASS');
process.exit(fails.length ? 1 : 0);
