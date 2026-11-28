#!/usr/bin/env node
// _tank_bays_check.js - GATE TANKBAYS (TANK-BAYS, the user 24 Nov, building a Lazair: "I would want the fuel tanks to be
// able to stick to the back face of a pod, where the aft aero pod goes. There's a lot of place there and the software
// prevents me from putting it there. Anywhere in the boom, attached to the aft pod, inside an aft cowl or aero pods is
// fine. And the plastic one is really dirty, with a grunge texture that can't be taken off. I'd need a clean plastic one").
//
//   1. THE CORE'S ROWS (60c GEN_BAYS): the four mounted bays appended after the old ones (whose order and records are
//      untouched), each a body bay to the frame; the frame bills a tank behind the pod AT ITS STATION (the CG moves by
//      its kilos x the station's move over the aeroplane's mass) and the burn drains it there.
//   2. THE EDITOR (the page's own chain, tools/_load_build.js, on the validated Chinook pod-and-rod with its pusher taken
//      off the aft face - a Lazair's layout - and as it is): a 20 L tank behind the pod is put by the search against the
//      face, on the centreline, upright, under the rod, clear of the crew and the frame, its station written into the
//      spec, its cradle drawn reaching the face; pushed into the pod it is red with what it meets, slid away from the face
//      it is red ("not against the pod's aft face"); slung under the rod it hangs from two clamps; with the taper's panels
//      closing the frame the face is not offered (in words); with the aero aft drawn
//      the face is not offered (in words) and the fairing is; with the pusher on the face, the face is not offered and a
//      tank left there is kept, weighed, drawn nowhere and red with the reason; a rod tank in the pusher's disc is red.
//   3. THE CLEAN JUG: its own finish (no scanned map at all - no grunge), translucent, its owner declared, the same
//      program variant as the fuel drawn inside it (no new shader), rebuilt identically by the flown aeroplane's door;
//      the moulded (dirty) plastic is kept as it was.
//
//   node tools/_tank_bays_check.js   -> "GATE TANKBAYS: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
const LB = require(path.join(T, '_load_build.js'));
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; return !!c; };
const cl = o => JSON.parse(JSON.stringify(o));
const POD = 'builds/chinook_2026-09-21_corrected.json';
const podRaw = () => JSON.parse(fs.readFileSync(path.join(ROOT, POD), 'utf8'));
const MOUNTED = ['podAft', 'boom', 'aeroAft', 'aeroNose'];

// ---- 1. THE CORE'S ROWS ------------------------------------------------------------------------------------------
console.log('1. THE CORE: four mounted bays, billed where they are');
{
  const keys = Object.keys(C.GEN_BAYS);
  const old = ['nose', 'cabin', 'underFloor', 'aftCabin', 'wingRoot', 'wingPanel', 'wing2Root', 'wing2Panel', 'wing2LE', 'strut'];
  ok(JSON.stringify(keys.slice(0, old.length)) === JSON.stringify(old) && JSON.stringify(keys.slice(old.length)) === JSON.stringify(MOUNTED),
    '1a the mounted bays are appended after the old ones, whose order is untouched', keys.join(' '));
  ok(MOUNTED.every(k => C.GEN_BAYS[k].on === 'body' && C.GEN_BAYS[k].mount && typeof C.GEN_BAYS[k].range === 'function' && /\w/.test(C.GEN_BAYS[k].name)),
    '1a each is a body bay to the frame, with its mount, its rule and its name');
  const d0 = C.buildGen(), S0 = d0.spec;
  const L = C.genBayList(S0, d0.parts.ST);
  ok(L.every(b => b.litres > 0) && MOUNTED.every(k => L.find(b => b.key === k)), '1b every bay, the new ones too, has a volume (the outside ones: their rule\'s room)',
    MOUNTED.map(k => k + ' ' + L.find(b => b.key === k).litres.toFixed(0) + ' L').join(', '));
  const pa = C.genBayResolve(S0, 'podAft', d0.parts.ST), bo = C.genBayResolve(S0, 'boom', d0.parts.ST);
  ok(pa.ext && bo.ext && pa.litres === C.GEN_BAYS.podAft.room && pa.x0 === S0.fuse.boxRear && pa.x1 > pa.x0,
    '1b behind the pod: outside the skin (its room is the rule\'s), from the pod\'s aft end', pa.x0.toFixed(2) + '..' + pa.x1.toFixed(2) + ' m');
  // billed at the station: two stations 0.3 m apart behind the pod move the CG aft by the tank's kilos x 0.3 / M
  const spec = podRaw().spec;
  const at = (along, lv) => { const s = cl(spec); s.energy = Object.assign({}, s.energy, { vessel: 'moulded', vessels: [{ bay: 'podAft', capacity: 20, along, lv, rot: 0, form: 'box', dims: null }] }); return s; };
  const dA = C.buildGen(at(1.30, 0.5)), dB = C.buildGen(at(1.60, 0.5));
  const M = dA.nodes.reduce((t, n) => t + n.m, 0), mB = dB.nodes.reduce((t, n) => t + n.m, 0);
  const cgA = C.defCG(dA), cgB = C.defCG(dB);
  const tankKg = dA.nodes.reduce((t, n) => t + (n.mFuel || 0), 0) + 0;
  const vr = C.genVesselResolve('fuel', 20, 'moulded', 'avgas100LL'), tankAll = vr.contentsKg + vr.vesselKg;
  const want = tankAll * 0.3 / M;
  const dx = Math.hypot(cgB[0] - cgA[0], cgB[1] - cgA[1], cgB[2] - cgA[2]);
  ok(Math.abs(mB - M) < 1e-6 && Math.abs(dx - want) / want < 0.15,
    '1c a tank behind the pod weighs where it sits: 0.3 m aft moves the CG by its kilos (fuel and shell) x 0.3 / M',
    'CG moved ' + (dx * 1000).toFixed(1) + ' mm, ' + tankAll.toFixed(1) + ' kg x 0.3 / ' + M.toFixed(0) + ' kg = ' + (want * 1000).toFixed(1) + ' mm; ' + tankKg.toFixed(1) + ' kg of fuel on the nodes');
  // the burn drains it there: the fuel's own nodes carry the fuel, empty moves the CG toward the empty aeroplane's
  const sA = dA.spec, dE = C.buildGen(C.genSpecAtFuel(sA, 0));
  const fuelNodes = dA.nodes.map((n, i) => [i, n.mFuel || 0]).filter(q => q[1] > 0);
  const fx = fuelNodes.reduce((t, q) => t + dA.nodes[q[0]].p[0] * q[1], 0) / Math.max(1e-9, fuelNodes.reduce((t, q) => t + q[1], 0));
  const cgE = C.defCG(dE);
  ok(fuelNodes.length >= 2 && Math.abs(tankKg - 20 * 0.72) < 0.3 && Math.sign(cgE[0] - cgA[0]) === -Math.sign(fx - cgA[0]),
    '1c the burn drains it in place: its fuel on the nodes at its station, and an empty tank moves the CG away from it',
    fuelNodes.length + ' fuel nodes, their centre ' + (fx - cgA[0]).toFixed(3) + ' m from the CG; empty: CG ' + ((cgE[0] - cgA[0]) * 1000).toFixed(1) + ' mm');
}

// ---- 2. THE EDITOR ------------------------------------------------------------------------------------------------
// the probe the load door runs in the page after its last build (FLYDIY_JOIN_PROBE): what the layer decided and drew
const PROBE = String.raw`
var E = CAGE_ENERGY, L = E.last(), out = {};
var ctx = L.ctx, FS = (CAGE2.CAGE_UNIT || 1) * ((ctx && ctx.P && ctx.P.planeScale) || 1);
out.zFwM = VESSEL_GEN.firewallZ(ctx.spec, CAGE2) * FS;
out.bays = (E.bays() || []).map(function (b) { return { key: b.key, mode: b.mode || null, x0: b.x0, x1: b.x1, roomL: b.roomL, face: b.face == null ? null : b.face }; });
out.gone = E.mountGone();
out.discs = E.propDiscs().map(function (d) { return { along: out.zFwM - d.z, x: d.x, y: d.y, R: d.R, t: d.t }; });
var D0 = E.propDiscs()[0];
out.discProbe = D0 ? [E.discHit({ c: [D0.x, D0.y - 0.6 * D0.R, D0.z], e: [0.1, 0.1, 0.2], rot: 0 }),
                      E.discHit({ c: [D0.x, D0.y - D0.R - 0.06 - 0.1, D0.z], e: [0.1, 0.1, 0.2], rot: 0 }),
                      E.discHit({ c: [D0.x, D0.y - 0.6 * D0.R, D0.z - D0.t - 0.06 - 0.2], e: [0.1, 0.1, 0.2], rot: 0 })] : null;
out.results = (E.results() || []).map(function (r) {
  return { bay: r.bay && r.bay.key, mode: r.mode || null, ok: !!r.ok, why: (r.why || []).slice(), c: r.c || null, e: r.e || null,
           along: r.v ? r.v.along : null, lv: r.v ? r.v.lv : null, form: r.v ? r.v.form : null, faceGap: r.faceGap == null ? null : r.faceGap,
           crewHits: r.crewHits || 0, gone: !!r.gone, rod: r.rodAt ? { yBot: r.rodAt.yBot, x: r.rodAt.x } : null };
});
var group = null;
(function walk(o, d) { if (!o || group) return; if (o.name === 'cageLayer:energy') { group = o; return; } if (d < 5) (o.children || []).forEach(function (c) { walk(c, d + 1); }); })(__scene, 0);
var matOf = function (m) {
  return m ? { type: m.type, transparent: !!m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite,
               maps: ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'alphaMap'].filter(function (k) { return !!m[k]; }),
               hook: typeof m.onBeforeCompile === 'function' && /vesselHue/.test(m.onBeforeCompile.toString()),
               owner: m.userData && m.userData.progOwner, vesSet: m.userData && m.userData.vesSet } : null;
};
out.meshes = [];
if (group) group.children.forEach(function (c) {
  if (!c.isMesh) return;
  var rec = { name: c.name, unfit: !!(c.userData && c.userData.edUnfit) };
  if (/_shell$/.test(c.name) || /^edFuel_/.test(c.name)) rec.mat = matOf(c.material);
  if (/_(cradle|pad[LR]|clamp[FA]|hanger[FA])$/.test(c.name)) { c.geometry.computeBoundingBox(); var bb = c.geometry.boundingBox;
    rec.at = [c.position.x, c.position.y, c.position.z]; rec.size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z]; }
  out.meshes.push(rec);
});
out.gameClean = matOf(E.material({ set: 'cleanPoly', tint: 0xf2e8c4, hueRad: 0, hueOn: false }));
out.gamePlastic = matOf(E.material({ set: 'plastic', tint: 0xdedac9, hueRad: 0, hueOn: false }));
out.texPlastic = typeof VESSEL_TEX_SETS !== 'undefined' && !!VESSEL_TEX_SETS.plastic;
return JSON.stringify(out);
`;
const PROBE_FILE = path.join(T, '.joincache', 'tank_bays_probe.js');
fs.mkdirSync(path.dirname(PROBE_FILE), { recursive: true });
fs.writeFileSync(PROBE_FILE, PROBE);
process.env.FLYDIY_JOIN_PROBE = PROBE_FILE;
// a pod and rod with its pusher taken off the aft face (the engines on the wing, as a Lazair's): `cage` laid over its
// rows, `vessels` its tank list (the look: the clean jug, the moulded catalogue)
const look = { finish: 'cleanPoly', hue: null, tint: null };
const load = (cage, vessels) => {
  const r = LB.loadBuild(POD, { patch: j => { const s = j.spec;
    s.cage = Object.assign({}, s.cage, cage || {});
    s.energy = Object.assign({}, s.energy, { vessel: 'moulded', vessels: vessels.map(v => Object.assign({ along: null, lv: null, rot: 0, form: 'box', dims: null }, look, v)) });
    return j; } });
  const p = typeof r.probe === 'string' && r.probe[0] === '{' ? JSON.parse(r.probe) : null;
  if (!p) console.log('  (probe: ' + String(r.probe).slice(0, 300) + ')');
  return { spec: r.spec, p };
};
// (a Lazair's own rows: the twin on the wing, the taper an open truss of tubes, the rod high off the pod's roof)
const LAZ = { engMount: 3, taperPanels: 0, rodY: 0.47, rodIncl: -0.6 };
const res0 = p => (p && p.results && p.results[0]) || {};
const hasMesh = (p, re) => !!(p && p.meshes && p.meshes.some(m => re.test(m.name)));
console.log('2. THE EDITOR: behind the pod, on the rod, in the fairing - placed, judged, drawn, said');
let face = null;
{
  const { spec, p } = load(LAZ, [{ bay: 'podAft', capacity: 20 }]);
  const r = res0(p), bay = p && p.bays.find(b => b.key === 'podAft');
  face = bay && bay.face;
  ok(!!bay && bay.mode === 'face' && face != null, '2a behind the pod is offered on a pod and rod whose aft face is free, the face measured',
    bay ? 'face at ' + (face != null ? face.toFixed(3) : '?') + ' m' : 'not offered: ' + JSON.stringify(p && p.gone));
  ok(r.ok && r.bay === 'podAft', '2a the 20 L jug finds its place and fits', (r.why || []).join('; ') || 'clear');
  ok(r.c && Math.abs(r.c[0]) < 1e-6 && r.e && r.e[1] > r.e[2], '2a ...on the centreline, upright (taller than it is deep)',
    r.e ? 'W ' + (2 * r.e[0]).toFixed(3) + ' H ' + (2 * r.e[1]).toFixed(3) + ' L ' + (2 * r.e[2]).toFixed(3) + ' m' : '');
  ok(r.faceGap != null && r.faceGap <= 0.15 && r.along - (2 * (r.e ? r.e[2] : 0)) / 2 >= face - 0.01,
    '2a ...against the pod\'s aft face (the cradle reaches it), behind it', 'gap ' + (r.faceGap != null ? (r.faceGap * 1000).toFixed(0) + ' mm' : 'none') + ', station ' + (r.along != null ? r.along.toFixed(3) : '?') + ' m');
  ok(r.c && Math.abs((p.zFwM - r.along) - r.c[2]) < 1e-9, '2a the station written into the vessel IS the drawn one (the ledger bills what is drawn)');
  const sv = spec.energy && spec.energy.vessels && spec.energy.vessels[0];
  ok(sv && sv.bay === 'podAft' && sv.along === r.along && sv.lv === r.lv, '2a ...and committed to the spec the aeroplane flies', sv ? sv.along + ' / ' + sv.lv : 'none');
  ok(hasMesh(p, /^edVessel_0_cradle$/) && hasMesh(p, /^edVessel_0_padL$/) && !p.meshes.some(m => /^edVessel_0_/.test(m.name) && m.unfit),
    '2a its cradle is drawn (the tray and the two pads to the face), none of it red');
  const sh = p.meshes.find(m => m.name === 'edVessel_0_shell'), fu = p.meshes.find(m => m.name === 'edFuel_0');
  ok(sh && sh.mat && sh.mat.vesSet === 'cleanPoly' && sh.mat.maps.length === 0 && sh.mat.transparent && sh.mat.opacity < 1,
    '3a the clean jug: no scanned map (no grunge), translucent', sh && sh.mat ? 'maps [' + sh.mat.maps.join(',') + '], opacity ' + sh.mat.opacity : 'no shell');
  ok(sh && sh.mat && sh.mat.owner === 'aircraft / fuel tanks and batteries / clean plastic jug', '3a its owner is declared (GATE PROGRAMS: feature / system / variant)', sh && sh.mat && sh.mat.owner);
  ok(sh && fu && sh.mat && fu.mat && sh.mat.type === fu.mat.type && sh.mat.transparent === fu.mat.transparent && sh.mat.side === fu.mat.side &&
     sh.mat.maps.length === fu.mat.maps.length && sh.mat.hook === fu.mat.hook,
    '3a ...and the fuel inside\'s own program variant (a plain transparent standard material): no new shader');
  const g = p.gameClean, pl = p.gamePlastic;
  ok(g && sh && sh.mat && g.type === sh.mat.type && g.transparent === sh.mat.transparent && g.opacity === sh.mat.opacity && g.maps.length === 0 && g.owner === sh.mat.owner,
    '3b the flown aeroplane\'s door (CAGE_ENERGY.material off the payload\'s record) rebuilds the same clean jug');
  ok(pl && pl.vesSet === 'plastic' && !pl.transparent && (!p.texPlastic || pl.maps.length >= 3),
    '3b the moulded plastic is kept as it was (its scanned set where the page has it, opaque)', pl ? 'maps [' + pl.maps.join(',') + ']' : '');
  // the aeroplane it flies: its CG with the tank where it is drawn, the tank's fuel on its nodes
  const d = C.buildGen(cl(spec));
  const fuelKg = d.nodes.reduce((t, n) => t + (n.mFuel || 0), 0);
  ok(Math.abs(fuelKg - 20 * 0.72) < 0.3, '2a the flown aeroplane carries the 20 L where the spec put it', fuelKg.toFixed(2) + ' kg of fuel');
}
if (face != null) {
  // pushed into the pod, then slid away from the face: red, and said
  const { p } = load(LAZ, [{ bay: 'podAft', capacity: 20, along: face - 0.25, lv: 0.5 }, { bay: 'podAft', capacity: 20, along: face + 0.55, lv: 0.5 }]);
  const a = p && p.results[0], b = p && p.results[1];
  ok(a && !a.ok && a.why.some(w => /into|through|crew|no room/.test(w)), '2b pushed into the pod it is red, with what it meets', a ? a.why.join('; ') : 'none');
  ok(b && !b.ok && b.why.some(w => /not against the pod/.test(w)), '2b slid away from the face it is red: the cradle has nothing to bolt to', b ? b.why.join('; ') : 'none');
}
{
  const { p } = load(LAZ, [{ bay: 'boom', capacity: 15 }]);
  const r = res0(p), bay = p && p.bays.find(b => b.key === 'boom');
  ok(bay && bay.mode === 'rod', '2c on the rod: offered as a tank slung under the tube', bay ? bay.x0.toFixed(2) + '..' + bay.x1.toFixed(2) + ' m' : JSON.stringify(p && p.gone));
  ok(r.ok && r.form === 'cyl' && r.rod && r.c && r.c[1] + r.e[1] < r.rod.yBot && Math.abs(r.c[0] - r.rod.x) < 1e-9,
    '2c ...a cylinder under the rod, its top a clamp\'s band below it', (r.why || []).join('; ') || (r.rod && r.c ? (1000 * (r.rod.yBot - r.c[1] - r.e[1])).toFixed(0) + ' mm under the rod' : ''));
  ok(hasMesh(p, /^edVessel_0_clampF$/) && hasMesh(p, /^edVessel_0_clampA$/) && hasMesh(p, /^edVessel_0_hangerF$/), '2c ...on two clamps round the tube and their hangers');
}
{
  const { p } = load(Object.assign({}, LAZ, { aeroAftOn: 1 }), [{ bay: 'aeroAft', capacity: 15 }]);
  const r = res0(p);
  ok(p && !p.bays.find(b => b.key === 'podAft') && /aero aft fairing covers/.test(p.gone.podAft || ''), '2d with the aero aft drawn, behind the pod is not offered, in words', p && p.gone.podAft);
  ok(p && p.bays.find(b => b.key === 'aeroAft' && b.mode === 'inside'), '2d ...the aft fairing is', p && JSON.stringify((p.bays.find(b => b.key === 'aeroAft') || {})));
  ok(r.ok && r.c && r.rod == null, '2d a 15 L tank inside the fairing finds its place under the rod', (r.why || []).join('; ') || (r.along != null ? 'at ' + r.along.toFixed(2) + ' m, lv ' + r.lv : ''));
}
{
  // the pod as the validated build has it: its pusher on the aft face
  const { p, spec } = load({}, [{ bay: 'podAft', capacity: 20, along: 1.4, lv: 0.5 }, { bay: 'boom', capacity: 10 }]);
  const a = p && p.results[0];
  ok(p && !p.bays.find(b => b.key === 'podAft') && /pusher/.test(p.gone.podAft || ''), '2e with the pusher on the aft face, behind the pod is not offered, in words', p && p.gone.podAft);
  ok(a && a.gone && !a.ok && /pusher/.test(a.why.join(' ')) && !hasMesh(p, /^edVessel_0_/), '2e a tank left there keeps its bay: drawn nowhere, red with the reason', a && a.why.join('; '));
  const sv = spec.energy.vessels[0];
  ok(sv && sv.bay === 'podAft' && sv.along === 1.4, '2e ...and the spec keeps it (weighed at its station, the builder\'s fuel never dropped silently)');
  const b = p && p.results[1];
  ok(b && (b.ok ? !/disc/.test(b.why.join(' ')) : b.why.length > 0), '2e a rod tank behind a pusher: placed where it clears, or red with its reason', b ? (b.ok ? 'clear at ' + b.along.toFixed(2) + ' m' : b.why.join('; ')) : 'none');
}
{
  const { p } = load({ engMount: 3 }, [{ bay: 'podAft', capacity: 20 }]);
  ok(p && !p.bays.find(b => b.key === 'podAft') && /taper’s panels/.test(p.gone.podAft || ''), '2d with the taper panels closing the frame behind the pod, its face is not offered, in words', p && p.gone.podAft);
}
{
  // THE PROPELLER'S DISC: the pusher's, measured off its drawn blades, and a box asked inside it, just past its tip, and
  // just behind its plane (the clearance is a hand: PROP_CLR)
  const { p } = load({}, [{ bay: 'boom', capacity: 10 }]);
  const d = p && p.discs && p.discs[0], q = p && p.discProbe;
  ok(d && d.R > 0.5 && d.R < 1.2, '2f the pusher disc is measured off its drawn blades', d ? 'at ' + d.along.toFixed(2) + ' m, ' + (2 * d.R).toFixed(2) + ' m across' : 'none');
  ok(q && /propeller’s disc/.test(q[0] || '') && q[1] == null && q[2] == null, '2f a tank in the disc is red and says so; one a hand past its tip, or behind its plane, is not', q ? JSON.stringify(q) : 'none');
}

console.log('GATE TANKBAYS: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exitCode = fails ? 1 : 0;
