#!/usr/bin/env node
// _stand_check.js — GATE STAND (A1-STAND G600-G604, playtest 2026-09-26): the stand's frame, held.
//
// The code under test is LIFTED from the shipped sources (render_world.js, hangar.js, cover_ring.js) and run on the
// real vendor three.js under node - never a copy of it kept here.
//
//   1. THE SHELL MERGES (G600, render_world.js mergeShell). A synthetic shed: boxes (six face groups, one material),
//      a piece under a posed parent, a MIRRORED piece (negative scale), a second material, a transparent pane, an
//      instanced mesh, a hidden piece, a thin trim. Every visible triangle comes out in the group's frame at the same
//      three positions, wound so its face normal agrees with its vertex normals (the mirrored piece re-wound); one
//      mesh per (material, casts); the pane, the instanced mesh carried across untouched and posed where they stood;
//      the hidden piece dropped; the trim merged but casting nothing; castMin 0 casts all.
//   2. THE NEAR MAP'S REGISTRY (G601, render_world.js nearTag). A scene of casters round the CG: the first pass puts
//      everything on the far layer and the big near casters on the near one - not the small, not the far away, not
//      the craft; a mesh added after it is on the far layer AT ONCE (no walk), a removed one leaves the registry, a
//      craft piece added later takes the craft's layers; and a pass reads the registry, not the scene (no traverse
//      after the first).
//   3. THE EXTERIOR'S GLASS (G604, hangar.js): the exterior build's glass is not transmissive (a transmissive mesh
//      in view makes three draw the whole opaque scene twice); the room's is untouched.
//   4. THE COVER RING'S KEYS (G603, cover_ring.js): numeric cell keys, no string key or split left in update(),
//      and a block's InstancedMesh made empty and handed its buffer (GATE COVER holds the picture).
//
//   node tools/_stand_check.js   -> "GATE STAND: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
const lift = (src, a, b) => { const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i); return i < 0 || j < 0 ? null : src.slice(i, j); };
console.log('GATE STAND');

// ---- 1. mergeShell ------------------------------------------------------------------------------------
{
  const code = lift(RW, '    const SHELL = { merge: true, castMin: 0.5', '    let shedNode = null;');
  ok(!!code, '1 mergeShell found in render_world.js (SHELL .. shedNode)');
  if (code) {
    const ctx = vm.createContext({ THREE, Math, Map, Set, Float32Array, Uint16Array, Uint32Array, Object, Array });
    vm.runInContext(code + '\nthis.mergeShell = mergeShell; this.SHELL = SHELL; this.shellCoarse = shellCoarse;', ctx);
    const matA = new THREE.MeshStandardMaterial({ color: 0x888888 }), matB = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.3 });
    const G = new THREE.Group(); G.position.set(100, 2, -50); G.rotation.y = 0.7;   // the LOD's pose above: the merge must not bake it
    const mk = (geo, mat, cast, f) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; if (f) f(m); return m; };
    const wall = mk(new THREE.BoxGeometry(20, 7, 0.06), matA, true, m => m.position.set(0, 3.5, 10));
    const sub = new THREE.Group(); sub.position.set(-5, 1, 2); sub.rotation.set(0.1, 0.4, -0.2); sub.scale.set(1.5, 1, 1);
    const inSub = mk(new THREE.BoxGeometry(3, 2, 1), matA, true); sub.add(inSub);
    const mirrored = mk(new THREE.BoxGeometry(4, 3, 2), matA, true, m => { m.position.set(6, 1.5, -3); m.scale.set(-1, 1, 1); });
    const door = mk(new THREE.PlaneGeometry(8, 6), matB, true, m => m.position.set(-10, 3, 0));
    const trim = mk(new THREE.BoxGeometry(20, 0.1, 0.1), matB, true, m => m.position.set(0, 7, 10));   // 20 m long, 0.1 in two extents: no shadow
    const pane = mk(new THREE.PlaneGeometry(10, 2), glass, false, m => m.position.set(0, 4, 10.1));
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matA, 3); inst.position.set(2, 0, 2); inst.castShadow = true;
    const hidden = mk(new THREE.BoxGeometry(1, 1, 1), matA, true, m => { m.visible = false; });
    G.add(wall, sub, mirrored, door, trim, pane, inst, hidden);
    G.updateMatrixWorld(true);
    // the reference: every visible, mergeable triangle in the group's frame, with its vertex normals
    const inv = new THREE.Matrix4().copy(G.matrixWorld).invert(), rel = new THREE.Matrix4(), nm = new THREE.Matrix3();
    const tris = (m, M) => { const g = m.geometry, p = g.attributes.position, n = g.attributes.normal, ix = g.index, out = [];
      nm.getNormalMatrix(M); const cnt = ix ? ix.count : p.count;
      for (let i = 0; i < cnt; i += 3) { const t = []; for (let k = 0; k < 3; k++) { const v = ix ? ix.getX(i + k) : i + k;
        const P = new THREE.Vector3(p.getX(v), p.getY(v), p.getZ(v)).applyMatrix4(M), N = new THREE.Vector3(n.getX(v), n.getY(v), n.getZ(v)).applyMatrix3(nm).normalize(); t.push([P, N]); }
        out.push(t); } return out; };
    const key = t => t.map(([P]) => [P.x, P.y, P.z].map(x => x.toFixed(4)).join(',')).sort().join('|');
    const ref = new Map();
    for (const m of [wall, inSub, mirrored, door, trim]) { rel.multiplyMatrices(inv, m.matrixWorld); for (const t of tris(m, rel.clone())) ref.set(key(t), (ref.get(key(t)) || 0) + 1); }
    const nRef = [...ref.values()].reduce((a, b) => a + b, 0);
    const paneW = pane.matrixWorld.clone(), instW = inst.matrixWorld.clone();   // (the merge re-parents them)
    const out = ctx.mergeShell(G, 0.5);
    ok(!!out, '1 the shell merged');
    if (out) {
      out.updateMatrixWorld(true);
      const meshes = out.children.filter(o => o.isMesh);
      const merged = meshes.filter(o => o.userData.shellMerged);
      const got = new Map(); let wound = 0, nGot = 0;
      for (const m of merged) for (const t of tris(m, new THREE.Matrix4())) {
        nGot++; got.set(key(t), (got.get(key(t)) || 0) + 1);
        const e1 = t[1][0].clone().sub(t[0][0]), e2 = t[2][0].clone().sub(t[0][0]), fn = e1.cross(e2);
        if (fn.lengthSq() > 1e-12 && fn.dot(t[0][1].clone().add(t[1][1]).add(t[2][1])) > 0) wound++;
      }
      let same = got.size === ref.size; for (const [k, v] of ref) if (got.get(k) !== v) same = false;
      ok(same && nGot === nRef, '1 every visible triangle, the same three positions, in the group\'s frame', nGot + ' of ' + nRef);
      ok(wound === nGot, '1 every merged triangle wound to its normals (the mirrored piece re-wound)', wound + ' / ' + nGot);
      const bins = merged.map(m => (m.material === matA ? 'A' : m.material === matB ? 'B' : '?') + (m.castShadow ? '+' : '-')).sort().join(' ');
      ok(bins === 'A+ B+ B-', '1 one mesh per (material, casts): the trim merged apart, casting nothing', bins);
      const pOut = meshes.find(m => m.material === glass), iOut = out.children.find(o => o.isInstancedMesh);
      const posed = (a, b) => { const x = new THREE.Vector3(), y = new THREE.Vector3(); a.getWorldPosition(x); rel.multiplyMatrices(inv, b); y.setFromMatrixPosition(rel); return x.distanceTo(y) < 1e-6; };
      ok(!!pOut && posed(pOut, paneW) && !pOut.userData.shellMerged, '1 the transparent pane carried across, where it stood');
      ok(!!iOut && iOut.count === 3 && posed(iOut, instW), '1 the instanced mesh carried across, where it stood');
      ok(!meshes.some(m => m.geometry === hidden.geometry), '1 the hidden piece dropped');
      // G1398 (HOUSE-LOD): the coarse rung is the merged shell's large pieces - the walls and the DOOR kept, the 0.1 m
      // trim and the glass gone - on the near rung's own geometry and material (shared, nothing copied)
      const C = ctx.shellCoarse(out, ctx.SHELL.coarseShare), C1 = ctx.shellCoarse(out, ctx.SHELL.coarseShare, new Set([matA]));
      const own = C ? C.children.filter(c => !c.userData.coarseFill) : [], fl = C ? C.children.filter(c => c.userData.coarseFill) : [];
      const cb = own.map(m => (m.material === matA ? 'A' : m.material === matB ? 'B' : '?') + (m.castShadow ? '+' : '-')).sort().join(' ');
      ok(!!C && cb === 'A+ B+' && own.every(c => merged.some(m => m.geometry === c.geometry && m.material === c.material)) && !C.children.some(c => c.material === glass),
         '1b the coarse rung (G1398): the walls and the door, not the trim, sharing the near rung\'s geometry', cb);
      { const f = fl[0], pp = f && f.geometry.attributes.position, bb = f && new THREE.Box3().setFromBufferAttribute(pp), pb = new THREE.Box3().setFromObject(pOut);
        out.updateMatrixWorld(true); const pbl = pb.clone().applyMatrix4(new THREE.Matrix4().copy(out.matrixWorld).invert());
        ok(fl.length === 1 && !f.material.transparent && f.material.vertexColors && !f.castShadow && bb.min.distanceTo(pbl.min) < 1e-4 && bb.max.distanceTo(pbl.max) < 1e-4,
           '1b3 ... the openings (the pane) as ONE opaque vertex-coloured mesh where the pane stood, casting nothing: no hole'); }
      ok(!!C1 && C1.children.length === C.children.length && C1.children.filter(c => !c.userData.coarseFill).every(c => c.castShadow === (c.material === matA)), '1b2 ... and only the materials named cast (the outer wall and roof in the game)');
    }
    const G2 = new THREE.Group(); G2.add(mk(new THREE.BoxGeometry(20, 0.1, 0.1), matB, true), mk(new THREE.BoxGeometry(5, 5, 5), matB, true));
    const o2 = ctx.mergeShell(G2, 0);
    ok(!!o2 && o2.children.length === 1 && o2.children[0].castShadow, '1 castMin 0: every piece casts, as built');
    ok(/const merged = SHELL\.merge \? mergeShell\(shed\.group, SHELL\.castMin\) : null;\s*\n\s*if \(merged\) shed\.group = merged;/.test(RW) &&
       RW.indexOf('const merged = SHELL.merge') < RW.indexOf('lod.addLevel(shed.group, 0)'), '1 standShed merges before the LOD takes the group');
    ok(/const coarseOf = merged \? shellCoarse\(merged, SHELL\.coarseShare, new Set\(\[wears\(shed\.mats\.wallOut\) \? shed\.mats\.wallOut : shed\.mats\.wall, shed\.mats\.roofOut\]\.filter\(Boolean\)\)\) : null;/.test(RW) && /lod\.addLevel\(coarseOf \|\| coarse, 320\);/.test(RW) &&
       /this\.levels\[1\]\.distance = Math\.min\(SHELL\.swapM\[1\], Math\.max\(SHELL\.swapM\[0\], R \* F \/ SHELL\.swapPx\)\);/.test(RW),
       '1c standShed: the coarse rung from the merged shell (the box only when it did not merge), its switch by projected size (G1398)');
  }
}

// ---- 2. the near registry --------------------------------------------------------------------------------
{
  const code = lift(RW, '  const NEAR_MIN_R = 0.75;', '\n  // ---- THE WORLD\'S SWITCHBOARD');
  ok(!!code, '2 the near registry found in render_world.js');
  if (code) {
    const NL = 3, FL = 2;
    const scene = new THREE.Scene();
    let walks = 0; const tr = scene.traverse; scene.traverse = function (f) { walks++; return tr.call(this, f); };
    const ctx = vm.createContext({ THREE, Math, Map, Set, WeakSet, Array, Object, scene, sunNear: {}, SHADOW_NEAR: { NEAR_LAYER: NL, FAR_LAYER: FL, S: { half: 30 } } });
    vm.runInContext(code + '\nthis.nearTag = nearTag; this.reg = () => nearReg;', ctx);
    const box = (s, x, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial()); m.position.set(x, s / 2, z); m.castShadow = cast; return m; };
    const big = box(4, 20, 0), small = box(0.4, 5, 0), far = box(4, 300, 0), quiet = box(4, 10, 10, false);
    const craft = new THREE.Group(); craft.userData.craft = true; const craftPart = box(0.3, 0, 0); craftPart.userData.craft = true; craft.add(craftPart);
    const grp = new THREE.Group(); grp.add(big, small); scene.add(grp, far, quiet, craft);
    scene.updateMatrixWorld(true);
    const pass = () => { for (let i = 0; i < 30; i++) ctx.nearTag([0, 0, 0]); };
    ctx.nearTag([0, 0, 0]);   // the first pass (tick 0)
    ok([big, small, far, quiet, grp].every(o => o.layers.isEnabled(FL)) && !craftPart.layers.isEnabled(FL), '2 the first pass: everything on the far layer, the craft left to shadow_near');
    ok(big.layers.isEnabled(NL) && !small.layers.isEnabled(NL) && !far.layers.isEnabled(NL) && !quiet.layers.isEnabled(NL) && !craftPart.layers.isEnabled(NL),
       '2 the near layer: the big caster within reach only (not the small, the far, the non-caster, the craft)');
    const w0 = walks;
    const late = box(3, -15, 5); grp.add(late);
    ok(late.layers.isEnabled(FL), '2 a mesh added later is on the far layer at once (no walk)');
    late.updateMatrixWorld(true); pass();
    ok(late.layers.isEnabled(NL), '2 ...and on the near layer at the next pass');
    grp.remove(big); pass();
    ok(!ctx.reg().has(big) && ctx.reg().has(late), '2 a removed mesh leaves the registry');
    const wing = box(2, 1, 0); craft.add(wing);
    ok(wing.layers.isEnabled(NL) && !wing.layers.isEnabled(FL) && !ctx.reg().has(wing), '2 a craft piece added later takes the craft\'s layers, never the registry');
    far.position.set(25, 2, 0); far.updateMatrixWorld(true); pass();
    ok(far.layers.isEnabled(NL), '2 a caster that moves (not frozen) is re-posed at each pass');
    const stuck = box(4, 400, 0); stuck.matrixAutoUpdate = false; stuck.updateMatrix(); scene.add(stuck); stuck.updateMatrixWorld(true); stuck.matrixWorldAutoUpdate = false; pass();
    stuck.position.set(10, 2, 0); stuck.updateMatrix(); stuck.matrixWorld.copy(stuck.matrix); pass();
    ok(!stuck.layers.isEnabled(NL), '2 a frozen caster is read by its cached sphere (render_premises freezes what never moves)');
    ok(walks === w0, '2 no scene walk after the first pass', (walks - w0) + ' walks');
  }
}

// ---- 3. the exterior's glass -------------------------------------------------------------------------------
{
  const H = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'hangar.js'), 'utf8');
  const i = H.indexOf('if (EXT) M.glass = new THREE.MeshStandardMaterial(');
  const stmt = i < 0 ? '' : H.slice(i, H.indexOf(';', i));
  ok(i > 0 && !/transmission/.test(stmt) && H.indexOf('const M = {') < i && i < H.indexOf("const gl = box(2 * HD - 0.25, GH, 0.03, M.glass"),
     '3 the exterior build swaps M.glass for a non-transmissive pane, before the band uses it');
  ok(/glass: new THREE\.MeshPhysicalMaterial\(\{[^}]*transmission: (\([^?]*GFX\.soft\(\)\) \? 0 : )?0\.90/.test(H), '3 the room\'s own glass is untouched (on a card; G1460: plain panes on the software rung)');
}

// ---- 4. the cover ring's keys -----------------------------------------------------------------------------
{
  const C = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'cover_ring.js'), 'utf8');
  const up = lift(C, '    function update() {', '    const api = {');
  ok(!!up && !/split\(|\+ ',' \+/.test(up), '4 update() makes no string key and splits none');
  ok(/const cellKey = \(cx, cz\) =>/.test(C) && !/cells\.(get|set|has)\([^)]*','/.test(C), '4 every cell lookup is by cellKey');
  ok(/new THREE\.InstancedMesh\(part\.geo, part\.mat, 0\);\s*\n\s*m\.instanceMatrix = new THREE\.InstancedBufferAttribute\(new Float32Array\(n \* 16\), 16\); m\.count = n;/.test(C),
     '4 a block\'s InstancedMesh is made empty and handed its buffer');
}

console.log('GATE STAND: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
