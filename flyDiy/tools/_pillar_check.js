#!/usr/bin/env node
// GATE PILLAR (PILLAR-ANCHORS, 2026-11-02) - THE PILLARS ARE THE ANCHORS, THE DOORS OPEN.
//
//   node tools/_pillar_check.js          -> "GATE PILLAR: PASS|FAIL"
//
// The user, 2 Nov: "being able to snap the strut into the cabin pillar, and also to constrain the handles to go
// there ... Floats struts should also preferably go onto these pillars, and not try to go on the door areas, when
// possible. Pillars should really be the target for all fixation devices and anchors."
//
// WHAT IT HOLDS
//   1 THE SWEEP IS A RULER: a flat 0.8 x 1.0 m door hinged on a vertical line, turned 0 -> 90 deg past a post a
//     known distance from its arc - PILLAR_SITE.swingSweep reads the analytic clearance to 3 mm, at the analytic
//     angle; a post ON the panel reads 0; the door's own fitting (an access-layer plate on it) is not an obstacle.
//   2 SNAP OFF IS THE BUILD AS IT WAS (the validated aeroplanes stay bit-identical): every validated build loads with
//     pilSnap 0 (absent from its cage: CAGE_ZERO_ABSENT, never written at 0), and with the snap off every layer draws
//     the SAME vertices with the pillar module loaded or removed (a hash of the scene's positions, both ways).
//   3 THE PILLAR RECORD: the C172-alike card (born in the design flow) has its B and C pillars, each carrying its
//     frame ring (B's forward ring = the join's noseGap station, C's aft ring = the cabin's rear), off every door;
//     the card is born with pilSnap 1 (the default for a new placement).
//   4 SNAP ON (the C172-alike and the twin floatplane fixture with pilSnap 1): the lift strut's foot stands on the
//     pillar the frame roots the strut on; the float struts' roots on the pillars the frame hangs the truss on; no
//     strut root on a door's panel; no anchor (step, grab) on a door's panel; the door handle is the latch lever,
//     within 0.15 m of the latch edge, and light (< 300 triangles a handle).
//   5 THE DOOR-SWING TABLE, printed (the C172-alike as born): every door's least clearance and its obstacle kinds -
//     reported, not bounded (the user decides per build; tools/door_swing_survey.js is the repo-wide table).
'use strict';
const path = require('path');
const crypto = require('crypto');
const T = __dirname;
let fails = 0;
const ok = (c, label, extra) => { console.log((c ? '  ok     ' : '  FAIL   ') + label + (extra != null ? '  [' + extra + ']' : '')); if (!c) fails++; };

const PS = require(path.join(T, '_pillar_site.js'));

// ---- 1 the ruler --------------------------------------------------------------------------------------------------
{
  // the door: x = 0.5 (the flank, +x port), z 0..0.8 (forward edge at z 0.8 = the hinge), y 0..1; outward +x
  const tris = [];
  const N = 8, M = 10;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const z0 = 0.8 * i / N, z1 = 0.8 * (i + 1) / N, y0 = j / M, y1 = (j + 1) / M;
    tris.push([[0.5, y0, z0], [0.5, y0, z1], [0.5, y1, z1]], [[0.5, y0, z0], [0.5, y1, z1], [0.5, y1, z0]]);
  }
  const door = { key: 'test:P', sgn: 1, n: [1, 0, 0], tris, z0: 0, z1: 0.8, yLo: 0, yHi: 1, w: 0.8, h: 1 };
  const axes = [{ A: [0.5, 0, 0.8], B: [0.5, 1, 0.8], part: 'all' }];
  // a vertical post (a thin box, half-width 0.01, square to the axes) centred at radius 0.84 from the hinge, 45 deg
  // out: its nearest corner stands 0.84 - 0.01 sqrt 2 = 0.826 m from the hinge, so the door's aft edge (radius 0.8)
  // passes it at 45 deg with 26 mm
  const post = (r, deg, hw) => {
    const a = deg * Math.PI / 180, cx = 0.5 + r * Math.sin(a), cz = 0.8 - r * Math.cos(a), t = [];
    const P = [[cx - hw, cz - hw], [cx + hw, cz - hw], [cx + hw, cz + hw], [cx - hw, cz + hw]];
    for (let k = 0; k < 4; k++) { const p = P[k], q = P[(k + 1) % 4];
      t.push([[p[0], 0.2, p[1]], [q[0], 0.2, q[1]], [q[0], 0.8, q[1]]], [[p[0], 0.2, p[1]], [q[0], 0.8, q[1]], [p[0], 0.8, p[1]]]); }
    return t;
  };
  const s1 = PS.swingSweep(door, axes, [{ label: 'post', layer: 'wing', cat: 'wing strut', tris: post(0.84, 45, 0.01) }], { step: 5 });
  ok(Math.abs(s1.minMM - 26) <= 2, 'RULER: a post 26 mm past the door\'s arc reads 26 mm', s1.minMM + ' mm @' + s1.deg + ' deg');
  ok(s1.deg != null && s1.deg >= 35 && s1.deg <= 55, 'RULER: ...at the angle it stands at (45 deg)', s1.deg);
  // a post bolted OUTSIDE the panel (its inner face on the skin): the door, turning out, runs into it at once
  const s2 = PS.swingSweep(door, axes, [{ label: 'post', layer: 'float', cat: 'float strut', tris: post(0.6, 0, 0.012).map(t => t.map(p => [p[0] + 0.012, p[1], p[2]])) }], { step: 5 });
  ok(s2.minMM <= 1, 'RULER: a post standing on the panel reads 0', s2.minMM + ' mm @' + s2.deg);
  ok(s2.onClosed && s2.onClosed['float strut'], 'RULER: ...and is named as ON the closed door', JSON.stringify(s2.onClosed));
  // a plate lying on the door (the fittings layer's handle) rides the door
  const plate = [[[0.501, 0.5, 0.1], [0.501, 0.5, 0.2], [0.505, 0.55, 0.2]]];
  const s3 = PS.swingSweep(door, axes, [{ label: 'access handle', layer: 'access', cat: 'anchor', tris: plate }], { step: 5 });
  ok(s3.minMM >= 60, 'RULER: the door\'s own fitting is not in its way', s3.minMM);
  // the keep-out: a point on the swing's path is in the door's way, one behind the hinge is not
  const PSr = { doors: [door] };
  ok(!!PS.inDoor(PSr, [0.5 + 0.5 * Math.sin(Math.PI / 3), 0.5, 0.8 - 0.5 * Math.cos(Math.PI / 3)], 0.02, { hinges: [{ door: 'test:P', A: axes[0].A, B: axes[0].B }] }),
     'KEEP-OUT: a point on the swing\'s arc is in the door\'s way');
  ok(!PS.inDoor(PSr, [0.55, 0.5, 1.0], 0.02, { hinges: [{ door: 'test:P', A: axes[0].A, B: axes[0].B }] }), 'KEEP-OUT: a point ahead of the hinge is not');
}

// ---- the builds ----------------------------------------------------------------------------------------------------
const LB = require(path.join(T, '_load_build.js'));
const SH = require(path.join(T, '_scene_headless.js'));
const CF = require(path.join(T, 'flight_core.js'));
const build = (spec, over, prebuild) => SH.sceneBuild(spec, { garage: spec, inGame: true, over: over || {}, prebuild,
  resolved: () => CF.buildGen(JSON.parse(JSON.stringify(spec))).spec });
// every layer mesh's vertices (world), hashed one by one: { 'layer/name#count': hash }
const sceneHashes = r => {
  const per = {};
  r.scene.updateMatrixWorld(true);
  const v = new (r.W.THREE.Vector3)();
  r.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const p = o.geometry.attributes.position;
    const a = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); a[3 * i] = v.x; a[3 * i + 1] = v.y; a[3 * i + 2] = v.z; }
    let lay = ''; for (let q = o; q; q = q.parent) if (/^cageLayer:/.test(q.name || '')) { lay = q.name; break; }
    const k = lay + '/' + (o.name || '') + '#' + p.count;
    per[k] = (per[k] || '') + crypto.createHash('sha1').update(Buffer.from(a.buffer)).digest('hex').slice(0, 10);
  });
  return per;
};
const diffKeys = (x, y) => [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(k => x[k] !== y[k]);

// ---- 2 snap off = the build as it was ------------------------------------------------------------------------------
for (const key of Object.keys(LB.VALIDATED)) {
  const L = LB.loadValidated(key);
  const cage = (L.spec && L.spec.cage) || {};
  ok(!('pilSnap' in cage), `IDENTITY ${L.label}: no pilSnap in its cage (a saved build is never moved)`);
  const r1 = build(L.spec);
  ok(Math.round(+r1.P.pilSnap || 0) === 0, `IDENTITY ${L.label}: loads with the snap off`, r1.P.pilSnap);
  // two builds with the module loaded give the NOISE (the light layer's beacon turns between builds); a third
  // with the module removed may differ from them only there
  const h1 = sceneHashes(r1), h2 = sceneHashes(build(L.spec));
  const noise = new Set(diffKeys(h1, h2));
  const W = r1.W, keep = W.PILLAR_SITE;
  W.PILLAR_SITE = undefined;
  let h0;
  try { h0 = sceneHashes(build(L.spec)); } finally { W.PILLAR_SITE = keep; }
  const moved = diffKeys(h2, h0).filter(k => !noise.has(k));
  ok(!moved.length, `IDENTITY ${L.label}: every layer's vertices the same with the pillar module removed (${Object.keys(h2).length} meshes, ${noise.size} build-to-build noise)`, moved.slice(0, 4).join(', '));
}

// ---- 3 + 4 + 5 the C172-alike, born ---------------------------------------------------------------------------------
const born = key => {
  const BJ = require(path.join(T, '_bake_joined.js'));
  const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === key);
  const s0 = D.designBake(a.sel, a.over);
  return { s0, spec: LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec };
};
const checkSnap = (label, spec, opt) => {
  opt = opt || {};
  const r = build(spec, { pilSnap: 1 });
  const W = r.W, PSm = W.PILLAR_SITE;
  const R = W.CAGE2.cageResolve(r.built.spec);
  const PSx = PSm.pillarsOf(r.built.sheet, R, r.FS);
  const B = PSm.pillarOfFrame(PSx, 'B'), C = PSm.pillarOfFrame(PSx, 'C');
  if (opt.pillars) {
    ok(!!B && !!C, `PILLARS ${label}: the B and C pillars are published`, PSx.pillars.map(p => p.key + ' ' + p.z0.toFixed(3) + '..' + p.z1.toFixed(3)).join(', '));
    ok(PSx.pillars.every(p => !PSx.doors.some(d => p.zc > d.z0 + 0.01 && p.zc < d.z1 - 0.01)), `PILLARS ${label}: no pillar inside a door`);
    ok(PSx.zFw != null, `PILLARS ${label}: the firewall's station (the join's rule)`, PSx.zFw);
  }
  const members = name => { let m = null; r.scene.traverse(o => { if (o.name === name && o.userData.strutMembers) m = o.userData.strutMembers; }); return m || []; };
  const inBand = (z, p) => p && z >= p.z0 - 0.002 && z <= p.z1 + 0.002;
  const onDoor = p => PSm.inDoor(PSx, p, 0.02, { panelOnly: true });
  const ls = members('edFit_liftstrut');
  if (opt.strut) {
    ok(ls.length > 0, `SNAP ${label}: the lift struts are drawn`, ls.length);
    // a foot is its side's pins' middle (a V pair's two pins straddle the plate's centre)
    const feet = [1, -1].map(sg => { const z = ls.filter(m => (m.pin[0] >= 0 ? 1 : -1) === sg).map(m => m.pin[2]);
      return z.length ? z.reduce((a, b) => a + b, 0) / z.length : null; }).filter(z => z != null);
    const pl = feet.map(z => PSx.pillars.find(p => inBand(z, p) && p.frame));
    ok(feet.length && pl.every(Boolean), `SNAP ${label}: every lift strut's foot on a pillar with a frame ring`,
       feet.map(z => z.toFixed(3)).join(' ') + ' | ' + ((r.stat.split('  ·  ').find(x => x.startsWith('strut:'))) || ''));
    ok(ls.every(m => !onDoor(m.pin)), `SNAP ${label}: no lift strut foot on a door`);
    ok(/on the [^·]*(pillar|post)/.test(r.stat), `SNAP ${label}: the status line says which pillar`);
  }
  const fl = members('edFloatStruts');
  if (opt.floats) {
    const CFl = W.CAGE_FLOAT;
    ok(fl.length > 0, `SNAP ${label}: the float struts are drawn`, fl.length);
    ok(CFl && CFl.roots && (CFl.roots.fwd || CFl.roots.aft), `SNAP ${label}: the float struts root on pillars`, CFl && JSON.stringify(CFl.roots));
    ok(CFl && !(CFl.rootsOnDoor || []).length, `SNAP ${label}: no float strut root on a door's panel`, CFl && (CFl.rootsOnDoor || []).join(','));
  }
  const A = W.CAGE_ACCESS;
  const anchors = (A && A.placed || []).filter(q => q.on === 'body' && /^(step|grabHandle)$/.test(q.key));
  ok(anchors.every(q => !onDoor(q.p)), `SNAP ${label}: no step or grab handle on a door's panel`, anchors.map(q => q.key).join(','));
  const hd = (A && A.placed || []).filter(q => q.key === 'doorHandle');
  if (PSx.doors.length) {
    ok(hd.length === PSx.doors.length, `SNAP ${label}: a handle on every door side`, hd.length + ' / ' + PSx.doors.length);
    const tr = hd.map(q => Object.values(q.tris || {}).reduce((a, x) => a + (x[1] - x[0]), 0));
    ok(tr.every(n => n > 20 && n < 300), `SNAP ${label}: the latch lever is light (< 300 triangles)`, tr.join(' '));
    const near = hd.map(q => { const d = PSx.doors.find(dd => dd.sgn === (q.p[0] >= 0 ? 1 : -1) && q.p[2] >= dd.z0 - 0.02 && q.p[2] <= dd.z1 + 0.02);
      return d ? q.p[2] - d.z0 : null; });   // forward-hung: the latch is the aft edge (z0)
    ok(near.every(x => x != null && x >= 0 && x <= 0.15), `SNAP ${label}: each handle within 0.15 m of its latch edge`, near.map(x => x == null ? '-' : x.toFixed(3)).join(' '));
  }
  const rep = PSm.doorSwingReport(W.THREE, r.scene, r.built.sheet, R, r.FS, { edge: Math.round(+r.P.hgDoorEdge || 0), hinges: W.CAGE_HINGE && W.CAGE_HINGE.doors });
  for (const d of rep.doors)
    console.log('  table  ' + label + '  ' + PSm.swingLine(d) + (d.red ? '  RED' : '') + '  ' +
      Object.entries(d.byCat || {}).map(([k, v]) => k + ' ' + v.mm).join(', '));
  return { r, rep };
};
{
  const { s0, spec } = born('c172');
  ok(+((s0.cage || {}).pilSnap) === 1, 'BIRTH C172-alike: born with the pillar snap on (a new placement)', (s0.cage || {}).pilSnap);
  checkSnap('C172-alike', spec, { pillars: true, strut: true });
}
{
  const L = LB.loadValidated('floats');
  checkSnap(L.label, L.spec, { floats: true, strut: !!+(L.spec.cage || {}).wgStruts || true });
}

console.log(`GATE PILLAR: ${fails ? 'FAIL' : 'PASS'}`);
process.exitCode = fails ? 1 : 0;
