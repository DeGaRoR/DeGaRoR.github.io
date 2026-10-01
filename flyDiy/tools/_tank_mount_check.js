#!/usr/bin/env node
// GATE TANKMOUNT - NO TANK SUPPORT THROUGH THE SKIN, ON EVERY ARCHETYPE
// (G1106, CUB-COCKPIT 2026-09-30).
//
// The user, from the Cub's seat: two dark posts on the cowl top in front of
// the windscreen - "The support for the tank are poking through the meshes.
// They're drawn far too recklessly ... If you can't do something clean, get
// rid of it." They were the energy layer's MOUNT (G189: legs from each strap
// to "the surface the bay stands on", G317: each foot asked the fuselage
// airframe table its height, a coarse ray grid keeping the outermost hit,
// windscreen included, or a flat plane at the section's top) - and over a
// 20-30 L nose tank 167 of 352 leg vertices stood past the fuselage sheet,
// 37.5 mm out. The mount is gone (G1106).
//
// This builds every CAGE_DESIGN archetype headless, the energy layer
// included (tools/_scene_headless.js runs the page's own PAGE.post chain;
// the three energy files are taken out of its exclusion list here), and for
// every drawn vessel asks the geometric question: does any part of the
// tank's own drawing lie beyond a surface of the aeroplane, seen from the
// tank's centre? Each vertex of the vessel's `mount` (legs, feet) and `hard`
// (straps, filler, vent, sump) is joined to the solid's centre and the
// segment raycast against every OTHER mesh in the scene (the fuselage sheet,
// the cowl, the windscreen, the wing, the crew...). A crossing is a piece of
// the tank's hardware outside a skin.
//
// Rows (judged):
//   mount: no archetype draws an edVessel_*_mount mesh (the support is gone)
//   mount: VESSEL_MESH exports no mount builder
//   drawn: the check is not vacuous - body tanks were drawn on N archetypes
// Measured (printed, --json for the table): per archetype the vessels, the
// hardware vertices and how many cross a skin (the straps' own clearance -
// a declared follow-up, not this gate's verdict unless --strict).
//
//   node tools/_tank_mount_check.js [--tools <dir>] [--only cub,c172] [--sizes 1,0.66,0.45] [--json out.json] [--strict]
//
// `--tools <dir>` runs the same measurement over another tree's tools/ (the
// before/after table: a copy of master's). No --help: an unknown flag is
// ignored, and the check runs.
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TOOLS = path.resolve(opt('tools', __dirname));
const ONLY = opt('only', null);
const JSON_OUT = opt('json', null);
const STRICT = argv.includes('--strict');

const fail = [];
const check = (ok, what, info) => { if (!ok) fail.push(what + (info != null ? ' (' + info + ')' : '')); };

// ONE CARD, ONE PROCESS (measured 2026-09-30). The layers keep state across
// builds in one process (caches keyed on the body, the energy layer's seed,
// the join's), and a card's hardware reading depended on the card built
// before it: the jodel read 12/422 vertices past the skin built first and
// 0/422 after the sesqui; in one sweep every card after the c172 read ~300/422,
// 250 mm out, and 0/422 alone. So the parent spawns one child per card (three
// at a time, the battery's --jobs budget) and judges their rows together -
// each reading is a first load, what a player opening that aeroplane sees.
// The carry-over itself (the editor switching designs in one page) is owed.
if (!argv.includes('--child')) {
  const { spawn } = require('child_process');
  const os = require('os');
  const keys = ONLY ? ONLY.split(',') : require(path.join(TOOLS, '_bake_joined.js')).loadPanel().D.ARCHETYPES.map(a => a.key);
  const pass = ['--tools', TOOLS].concat(opt('sizes', null) ? ['--sizes', opt('sizes')] : []);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tankmount_'));
  const out = new Array(keys.length);
  let next = 0;
  const one = () => new Promise(res => {
    const i = next++; if (i >= keys.length) return res(false);
    const jf = path.join(tmp, keys[i] + '.json');
    const ch = spawn(process.execPath, [__filename, '--child', '--only', keys[i], '--json', jf].concat(pass), { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    ch.stdout.on('data', d => { log += d; }); ch.stderr.on('data', d => { log += d; });
    ch.on('close', code => {
      let j = null; try { j = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch (e) {}
      out[i] = { key: keys[i], code, log, j }; res(true);
    });
  });
  const lane = async () => { while (await one()) {} };
  Promise.all([lane(), lane(), lane()]).then(() => {
    const rows = [];
    let mountMeshes = 0, mountCross = 0, withTanks = 0;
    for (const o of out) {
      for (const line of o.log.split('\n')) if (/^  \S/.test(line) && !/^  FAIL /.test(line)) console.log(line);
      if (!o.j) { check(false, o.key + ': the card\'s child reported nothing', 'exit ' + o.code + ' ' + o.log.split('\n').slice(-3).join(' | ')); continue; }
      for (const f of o.j.fail || []) if (!/^mount: no archetype|^drawn: /.test(f)) fail.push(o.key + ': ' + f);
      for (const r of o.j.rows) { rows.push(r); mountMeshes += r.mount; mountCross += r.mountOut; }
      if (o.j.rows.some(r => r.vessels > 0)) withTanks++;
    }
    check(mountMeshes === 0, 'mount: no archetype, at any of its tank sizes, draws an edVessel_*_mount mesh (G1106: the support is gone)',
      mountMeshes + ' meshes, ' + mountCross + ' vertices past a skin');
    check(withTanks >= Math.min(3, keys.length), 'drawn: body tanks were drawn (the check is not vacuous)', withTanks + ' of ' + keys.length + ' cards');
    if (STRICT) for (const r of rows) check(r.hardOut === 0, r.key + ' x' + r.cap + ': the tank hardware stays inside the skin', r.hardOut + '/' + r.hardVerts);
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ tools: TOOLS, rows }, null, 1));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    for (const f of fail) console.log('  FAIL ' + f);
    console.log('GATE TANKMOUNT: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
    process.exit(fail.length ? 1 : 0);
  });
  return;
}

const SH = require(path.join(TOOLS, '_scene_headless.js'));
// the crew too (G1109): its feet, pedals and seats are what a nose tank meets in the game
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                 '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(TOOLS, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();

const C0 = SH.context();
const W = C0.ctx, THREE = C0.THREE;
SH.stubCanvas();
console.error = () => {};     // the panel's atlas painters log against the stub canvas; geometry is what is read
check(!C0.errors.length, 'the headless layers load (energy included)', C0.errors.join(' | '));
const VM = W.VESSEL_MESH;
check(!!VM && typeof VM.build === 'function', 'the vessel builder loads headless');
check(!!VM && !('mount' in VM), 'mount: VESSEL_MESH exports no mount builder (G1106)');
check(!!W.CAGE_ENERGY && typeof W.CAGE_ENERGY.fromSpec === 'function', 'the energy layer loads headless');

// the displayed sheet {V, F:[{v:[...]}]} as a three mesh, fans per face
function sheetMesh(M, FS) {
  const pos = [];
  for (const f of M.F) {
    const v = f.v; if (!v || v.length < 3) continue;
    for (let i = 1; i + 1 < v.length; i++)
      for (const k of [v[0], v[i], v[i + 1]]) { const q = M.V[k]; pos.push(q[0] * FS, q[1] * FS, q[2] * FS); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  m.name = 'fuselage sheet'; m.updateMatrixWorld(true);
  return m;
}
const rc = new THREE.Raycaster();
const vO = new THREE.Vector3(), vP = new THREE.Vector3(), vD = new THREE.Vector3();
const rows = [];
let withTanks = 0, mountMeshes = 0, mountCross = 0;
const SIZES = (opt('sizes', '1,0.66,0.45')).split(',').map(Number);
const cards = D.ARCHETYPES.filter(a => !ONLY || ONLY.split(',').includes(a.key));
for (const a of cards) {
  // THE CARD AS THE GAME FLIES IT: the joined bake (the cabin, the seats,
  // the profile the join measures), and the energy layer handed the BUILT
  // spec through GARAGE_SPEC.resolved as the game hands it - off the game's
  // spec the bench's reconstruction put the Cub's nose tank 0 mm under its
  // band's top, and no support was drawn where the user saw two
  let base, birth;
  // THE CARD'S OWN TANKS (G1109): the energy layer is loaded here, and on the
  // first build it seeds ITSELF when nothing has (not in the game: no
  // GARAGE_SPEC to read, no prefs) - a 45 L nose tank, which the join then
  // exported as every card's energy. Seeded from the card's birth spec first,
  // the layer and the join carry what the design declares (the Caravan's 1257 L
  // in the wings, not a nose tank it does not have).
  try { birth = C.genNormaliseSpec(D.designBake(a.sel, a.over)); W.CAGE_ENERGY.fromSpec(birth.energy); base = BJ.bakeCard(a.key).spec; }
  catch (e) { check(false, a.key + ': the card bakes', e.message); continue; }
  {
    const bb = ((birth.energy && birth.energy.vessels) || []).map(v => v.bay).join(','),
          jb = ((base.energy && base.energy.vessels) || []).map(v => v.bay).join(',');
    const bc = ((birth.energy && birth.energy.vessels) || []).map(v => +(+v.capacity).toFixed(1)).join(',');
    const shaped = ((base.energy && base.energy.vessels) || []).some(v => v.dims);   // a bay-shaped box sets its own litres
    const jc = ((base.energy && base.energy.vessels) || []).map(v => +(+v.capacity).toFixed(1)).join(',');
    check(bb === jb && (shaped || bc === jc), a.key + ': the tanks asked about are the card\'s own (bays, and capacities unless the layer shaped them)',
      'card ' + bb + ' ' + bc + ' L vs ' + jb + ' ' + jc + ' L');
  }
  // THE SIZES A BUILDER PICKS: the card's own tanks, then two thirds and a
  // bit under half of their capacity - a smaller tank hangs lower in its band
  // with air above it, which is where G189 drew its legs (the stock Cub's
  // 45 L box touches the top of the nose band and drew none; at 20-30 L it
  // stood two posts on the cowl, the user's screenshot)
  for (const kCap of SIZES) {
  const spec = JSON.parse(JSON.stringify(base));
  const vs = (spec.energy && spec.energy.vessels) || [];
  if (kCap !== 1) { if (!vs.length) continue; for (const v of vs) { v.capacity = Math.round((+v.capacity || 0) * kCap * 10) / 10; v.along = null; v.lv = null; delete v.dims; } }
  let def;
  try { def = C.buildGen(spec); }
  catch (e) { check(false, a.key + ' x' + kCap + ': the card builds', e.message); continue; }
  // the layer seeds its vessels from the spec it is handed (the game's
  // applySpec door) - every card its own tanks
  try { W.CAGE_ENERGY.fromSpec(spec.energy); } catch (e) {}
  const r = SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
  if (r.errors.length) check(false, a.key + ': the scene builds clean', r.errors[0].split('\n')[0]);
  const all = [];
  r.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) all.push(o); });
  const ves = all.filter(o => /^edVessel_\d+_/.test(o.name));
  const skins = all.filter(o => !/^edVessel_|^edFuel_/.test(o.name) && o.visible !== false);
  // THE FUSELAGE ITSELF: the page draws the cage sheet outside PAGE.post, so
  // the headless scene has every layer but the skin they all stand on - the
  // sheet (glass, pillars and the cut door included) as one more mesh, in
  // the layers' frame (cage units x FS)
  skins.push(sheetMesh(r.built.sheet, r.FS));
  // a ray from INSIDE meets a skin from behind: three's raycaster skips a
  // back face on a FrontSide material, so every skin is asked both ways
  // (measured: without it the Cub's legs read 0 crossings)
  for (const s of skins) {
    if (!s.geometry.boundingSphere) s.geometry.computeBoundingSphere();
    for (const m of [].concat(s.material || [])) if (m) m.side = THREE.DoubleSide;
  }
  const row = { key: a.key, cap: kCap, vessels: 0, mount: 0, mountVerts: 0, mountOut: 0, hardVerts: 0, hardOut: 0,
                shellVerts: 0, shellOut: 0, pieces: {}, omitted: [], worst: null };
  const idx = new Set(ves.map(o => +o.name.split('_')[1]));
  row.vessels = idx.size;
  if (row.vessels) withTanks++;
  // each vessel's solid, for its named pieces (G1108): a hard / seal / mark
  // vertex is named by the piece whose range holds it
  const EN = W.CAGE_ENERGY.EN, solOf = {};
  for (const rr of (W.CAGE_ENERGY.results() || [])) { const vi = EN.vessels.indexOf(rr.v); if (vi >= 0 && rr.solid) solOf[vi] = rr.drawn || rr.solid; }
  for (const rr of (W.CAGE_ENERGY.results() || [])) if (rr.omitted && rr.omitted.length) row.omitted.push(...rr.omitted);
  const SLOT_I = { hard: 0, seal: 1, mark: 2 };
  const outByVes = {};
  for (const o of ves) {
    const vi = +o.name.split('_')[1];
    const slot = o.name.split('_').slice(2).join('_');
    if (!['mount', 'hard', 'seal', 'mark', 'shell'].includes(slot)) continue;
    if (slot === 'mount') { row.mount++; mountMeshes++; }
    const sol = solOf[vi], si = SLOT_I[slot];
    const nameAt = i => {
      if (si == null || !sol || !sol.pieces) return slot;
      const pc = sol.pieces.find(q => i >= q.start[si][0] && i < q.end[si][0]);
      return pc ? pc.name : slot;
    };
    // the solid's centre, world: every slot mesh is placed at the tank's centre
    o.getWorldPosition(vO);
    const pos = o.geometry.attributes.position;
    const step = slot === 'shell' ? Math.max(1, Math.floor(pos.count / 400)) : 1;   // the shell sampled, every hardware vertex asked
    for (let i = 0; i < pos.count; i += step) {
      vP.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      vD.subVectors(vP, vO); const L = vD.length(); if (L < 1e-4) continue;
      vD.multiplyScalar(1 / L);
      rc.set(vO, vD); rc.near = 0; rc.far = L;
      const hit = rc.intersectObjects(skins, false);
      const nm = slot === 'mount' || slot === 'shell' ? slot : nameAt(i);
      const P = row.pieces[nm] || (row.pieces[nm] = { n: 0, out: 0, mm: 0 });
      P.n++;
      if (slot === 'mount') row.mountVerts++; else if (slot === 'shell') row.shellVerts++; else row.hardVerts++;
      if (hit.length) {
        const out = L - hit[0].distance;
        P.out++; P.mm = Math.max(P.mm, +(out * 1000).toFixed(1));
        if (slot === 'mount') { row.mountOut++; mountCross++; } else if (slot === 'shell') row.shellOut++; else row.hardOut++;
        outByVes[vi] = (outByVes[vi] || 0) + 1;
        if (!row.worst || out > row.worst.mm / 1000)
          row.worst = { slot: nm, mm: +(out * 1000).toFixed(1), through: hit[0].object.name || hit[0].object.parent && hit[0].object.parent.name };
      }
    }
  }
  // G1108 THE VERDICTS. A tank the layer's fit passes (`ok`) must have no
  // vertex past any surface - shell, straps, pads, sender, and whichever
  // standoff pieces cleared. A tank it fails is drawn in the editor, stamped
  // `edUnfit` on every mesh, and the flown aeroplane (CAGE_JOIN.snapshot, what
  // the game and the parked captures fly) carries none of it; the physics is
  // the joined spec's (CAGE_JOIN.export + buildGen), the same with and without.
  const RES = (W.CAGE_ENERGY.results() || []).filter(rr => rr.on === 'body' && rr.c);
  row.ok = RES.map(rr => !!rr.ok); row.why = RES.filter(rr => !rr.ok).map(rr => rr.why.join('; '));
  let anyUnfit = false;
  for (const rr of RES) {
    const vi = EN.vessels.indexOf(rr.v);
    const mine = all.filter(o => new RegExp('^ed(Vessel|Fuel)_' + vi + '(_|$)').test(o.name));
    if (rr.ok) check((outByVes[vi] || 0) === 0, a.key + ' x' + kCap + ': a tank that fits has nothing past a surface (shell, straps, the pieces that stayed)', (outByVes[vi] || 0) + ' vertices');
    if (rr.ok) {
      // ...and nothing INSIDE it: a plate can enter a tank with no segment
      // from its centre crossing it (the Savannah-alike's dash, 130 of its
      // vertices inside the drawn shell). Every foreign point in the tank's
      // box - the sheet's corners and face centres, every other mesh's
      // vertices - is asked by ray PARITY against the drawn shell (two
      // directions), and counts when it and its six 5 mm neighbours are all in
      const shell = mine.find(o => /_shell$/.test(o.name));
      if (shell) {
        shell.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(shell);
        const cand = [];
        const Msh = r.built.sheet, FSh = r.FS;
        for (const f of Msh.F) { if (!f.v || f.v.length < 3) continue; let cx = 0, cy = 0, cz = 0;
          for (const k of f.v) { const q = Msh.V[k]; cand.push([q[0] * FSh, q[1] * FSh, q[2] * FSh]); cx += q[0]; cy += q[1]; cz += q[2]; }
          cand.push([cx * FSh / f.v.length, cy * FSh / f.v.length, cz * FSh / f.v.length]); }
        for (const o of all) { if (/^ed(Vessel|Fuel)_/.test(o.name)) continue; const P = o.geometry.attributes.position;
          for (let k = 0; k < P.count; k++) { vP.fromBufferAttribute(P, k).applyMatrix4(o.matrixWorld); cand.push([vP.x, vP.y, vP.z]); } }
        const sm = new THREE.Mesh(shell.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        sm.matrixWorld.copy(shell.matrixWorld); sm.matrixAutoUpdate = false;
        const rp = new THREE.Raycaster(), D1 = new THREE.Vector3(0.31, 0.93, 0.19).normalize(), D2 = new THREE.Vector3(-0.23, -0.91, 0.35).normalize();
        const inside = q => { for (const d of [D1, D2]) { rp.set(new THREE.Vector3(q[0], q[1], q[2]), d); rp.near = 0; rp.far = 10; if (rp.intersectObject(sm, false).length % 2 === 0) return false; } return true; };
        let deep = 0;
        for (const q of cand) {
          if (q[0] < box.min.x || q[0] > box.max.x || q[1] < box.min.y || q[1] > box.max.y || q[2] < box.min.z || q[2] > box.max.z) continue;
          if (!inside(q)) continue;
          let all6 = true;
          for (const [ax, sg] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) { const qq = q.slice(); qq[ax] += sg * 0.005; if (!inside(qq)) { all6 = false; break; } }
          if (all6) deep++;
        }
        row.intruders = (row.intruders || 0) + deep;
        check(deep === 0, a.key + ' x' + kCap + ': nothing else stands inside a tank that fits (5 mm deep, by parity)', deep + ' points');
      }
    }
    else {
      anyUnfit = true;
      check(mine.length > 0 && mine.every(o => o.userData && o.userData.edUnfit), a.key + ' x' + kCap + ': every mesh of a tank that does not fit is stamped edUnfit', mine.filter(o => !(o.userData && o.userData.edUnfit)).map(o => o.name).join());
    }
  }
  {
    // the join over this scene, as bakeJoined hangs it (two identity groups:
    // the join's mount walk wants the page's hierarchy)
    const outer = new THREE.Group(), inner = new THREE.Group();
    for (const ch of r.scene.children.slice()) inner.add(ch);
    outer.add(inner); r.scene.add(outer); r.scene.updateMatrixWorld(true);
    W.CAGE_UI = { P: r.P };
    const snap = () => { const v = W.CAGE_JOIN.snapshot(joined); let n = 0; for (const k in v.groups) n += v.groups[k].pos.length / 3;
                         return { ves: Object.keys(v.mats || {}).filter(k => v.mats[k].ves).length, verts: n }; };
    let J1, J2, joined;
    try {
      W.CAGE_JOIN_TAKE_UNFIT = false; J1 = JSON.parse(JSON.stringify(W.CAGE_JOIN.export()));
      joined = BJ.merge(spec, J1);
      const s1 = snap();
      W.CAGE_JOIN_TAKE_UNFIT = true; J2 = JSON.parse(JSON.stringify(W.CAGE_JOIN.export()));
      const s2 = snap();
      W.CAGE_JOIN_TAKE_UNFIT = false;
      row.flown = { ves: s1.ves, verts: s1.verts, vesIfTaken: s2.ves, vertsIfTaken: s2.verts };
      const allUnfit = RES.length > 0 && RES.every(rr => !rr.ok);
      if (allUnfit) check(s1.ves === 0, a.key + ' x' + kCap + ': the flown aeroplane carries no tank that does not fit', s1.ves + ' vessel materials');
      if (anyUnfit) check(s2.verts > s1.verts, a.key + ' x' + kCap + ': the A/B switch is real (the unfit tank is there when taken)', s1.verts + ' vs ' + s2.verts);
      else check(s2.verts === s1.verts, a.key + ' x' + kCap + ': with every tank fitting, nothing is left out', s1.verts + ' vs ' + s2.verts);
      const H = j => require('crypto').createHash('sha1').update(JSON.stringify((d => [d.nodes, d.beams, d.refs])(C.buildGen(BJ.merge(spec, j))))).digest('hex').slice(0, 12);
      row.phys = [H(J1), H(J2)];
      check(row.phys[0] === row.phys[1], a.key + ' x' + kCap + ': the physics is the same with and without the unfit tank drawn', row.phys.join(' vs '));
    } catch (e) { W.CAGE_JOIN_TAKE_UNFIT = false; check(false, a.key + ' x' + kCap + ': the join runs over the scene', (e && e.message || String(e)).split('\n')[0]); }
  }
  rows.push(row);
  console.log('  ' + (a.key + ' x' + kCap).padEnd(18) + ' vessels ' + row.vessels + '  mount meshes ' + row.mount +
    (row.mount ? ' (' + row.mountOut + '/' + row.mountVerts + ' verts past a skin)' : '') +
    '  shell ' + row.shellOut + '/' + row.shellVerts + '  hardware ' + row.hardOut + '/' + row.hardVerts + ' past a skin' +
    (row.hardOut ? ' [' + Object.keys(row.pieces).filter(k => row.pieces[k].out && k !== 'shell' && k !== 'mount').map(k => k + ' ' + row.pieces[k].out + '/' + row.pieces[k].n + ' ' + row.pieces[k].mm + 'mm').join(', ') + ']' : '') +
    (row.omitted.length ? '  omitted: ' + row.omitted.join(',') : '') +
    '  fit ' + (row.ok || []).map(o => o ? 'ok' : 'NOT').join('/') + (row.flown ? '  flown ves ' + row.flown.ves + (row.flown.vertsIfTaken !== row.flown.verts ? ' (-' + (row.flown.vertsIfTaken - row.flown.verts) + ' verts)' : '') : '') +
    (row.worst ? '  worst ' + row.worst.slot + ' ' + row.worst.mm + ' mm through ' + row.worst.through : ''));
  }
}
check(mountMeshes === 0, 'mount: no archetype, at any of its tank sizes, draws an edVessel_*_mount mesh (G1106: the support is gone)',
  mountMeshes + ' meshes, ' + mountCross + ' vertices past a skin');
check(withTanks >= Math.min(3, cards.length), 'drawn: body tanks were drawn (the check is not vacuous)', withTanks + ' of ' + cards.length);
if (STRICT) for (const r of rows) check(r.hardOut === 0, r.key + ': the tank hardware stays inside the skin', r.hardOut + '/' + r.hardVerts);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ tools: TOOLS, rows, fail }, null, 1));
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE TANKMOUNT: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
