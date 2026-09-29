#!/usr/bin/env node
// GATE RWYLIGHTS (G1066, POLISH-1) - the runway lights stand where a light may stand, and look like one by day.
//
// The user (2026-09-29): "floating black balls at runway intersections". They were the runway EDGE LIGHTS
// (render_world.js standRunwayLights): 9 cm near-black spheres 35 cm over the ground, no stem, every 60 m at half
// width + 1.5 m - and where two runways cross, one runway's edge row ran straight over the other's concrete.
//
//   1. THE PLACES, on Jolene (the shipped island, its premises fixture) and the procedural world (makeWorld()):
//      every strip's lights from the core's runwayLightPoints - the one list standRunwayLights stands - held against
//      an INDEPENDENT test: no ELEVATED edge or threshold light inside another land strip's pavement rectangle, nor
//      within the 3 m clear of it; none on or near a premises pavement that is not grass (pavedNear); every FLUSH
//      (inset) light stands in a pavement. What went flush or was left out is named (why) and small (a strip keeps
//      its lights; HOME's and w2's green threshold rows stand flush on the turn pads), a grass polygon changes
//      nothing (nv_strip on its meadow keeps all of them elevated), and the crossing is SEEN: the old placement (no
//      other strip, no premises) stands HOME's and w2's lights elevated on each other's concrete - the check is not blind.
//   2. THE LIGHT, its geometry lifted from render_world.js (rwyLightGeo) and built on the real vendor three: one merged
//      geometry (one draw a colour a strip, as before), the lens round the instance's origin (the night's growth is
//      about the lens), the stem reaching the ground and into the lens, the base can on the ground, the emissive
//      mask on the uv (the lens 0.75 = lit, the rest 0.25 = dark), the lens's day colour pale (glass, not near-black),
//      the material: vertex colours + the emissive map, the switchboard's `runway` mute and the grown-with-distance
//      scale by the lens's radius.
//
//   node tools/_rwylights_check.js [--verbose]   -> "GATE RWYLIGHTS: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const VERBOSE = process.argv.includes('--verbose');
const C = require(path.join(T, 'flight_core.js'));
for (const k of Object.keys(C)) global[k] = C[k];
const IN = require(path.join(T, 'island_node.js'));
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));

let fails = 0, nOk = 0;
const check = (ok, label, extra) => {
  if (!ok || VERBOSE) console.log((ok ? '  ok     ' : '  FAIL   ') + label + (ok || extra == null ? '' : ' - ' + extra));
  if (ok) nOk++; else fails++;
  return ok;
};

// ---- 1. THE PLACES --------------------------------------------------------------------------------------------
// the strip frame, written out here (not the core's): s along the heading, w across
const inRect = (b, x, z, m) => {
  const cb = Math.cos(b.hdg), sb = Math.sin(b.hdg), dx = x - b.x, dz = z - b.z;
  return Math.abs(dx * cb + dz * sb) <= b.len / 2 + m && Math.abs(-dx * sb + dz * cb) <= b.wid / 2 + m;
};
const hardQ = q => !!q && (q.kind === 'strip' || q.cls !== 'grass');
function places(name, W) {
  const strips = W.aerodromes.filter(b => b.len && b.wid && b.kind !== 'meadow' && b.kind !== 'water');
  const PO = W.premises && W.premises.overlay, paved = PO && PO.pavedNear ? PO.pavedNear : null;
  const clear = C.RWY_LIGHTS.clear;
  let total = 0, elevated = 0, insetAll = 0, cutAll = 0, upOnStrip = 0, upInClear = 0, upOnPave = 0, upNearPave = 0, flatOff = 0;
  const per = {};
  for (const a of strips) {
    const L = C.runwayLightPoints(a, W.aerodromes, paved);
    const pts = L.edge.concat(L.thr);
    total += pts.length; cutAll += L.cut.length; insetAll += L.inset.length;
    for (const [x, z, fl] of pts) {
      let onS = false, nearS = false;
      for (const b of strips) if (b !== a) { if (inRect(b, x, z, 0)) onS = true; else if (inRect(b, x, z, clear - 1e-9)) nearS = true; }
      const onP = paved ? hardQ(paved(x, z, 0, a.id)) : false, nearP = paved ? hardQ(paved(x, z, clear - 1e-6, a.id)) : false;
      if (fl) { if (!onS && !onP) flatOff++; continue; }       // a flush light stands IN a pavement, nowhere else
      elevated++;
      if (onS) upOnStrip++; if (nearS) upInClear++; if (onP) upOnPave++; else if (nearP) upNearPave++;
    }
    // the old list: the same count as before G1066 = stood (elevated + flush) + left out
    const nE = Math.max(2, Math.round(a.len / C.RWY_LIGHTS.every)), was = 2 * (nE + 1) + 2 * C.RWY_LIGHTS.thrN;
    per[a.id] = { kept: pts.length, inset: L.inset.length, cut: L.cut.length, was, thr: L.thr.length,
                  whys: [...new Set(L.cut.map(c => c.why))], insetWhys: [...new Set(L.inset.map(c => c.why))] };
    check(pts.length + L.cut.length === was, name + ' ' + a.id + ': stood + left out = the strip\'s lights (' + pts.length + ' + ' + L.cut.length + ' = ' + was + ')', pts.length + L.cut.length);
    check(L.cut.concat(L.inset).every(c => typeof c.why === 'string' && c.why.length > 0), name + ' ' + a.id + ': every flush or left-out light says why');
    check(pts.length >= 0.8 * was, name + ' ' + a.id + ': the strip keeps its lights (' + pts.length + ' of ' + was + ', ' + L.inset.length + ' flush)', pts.length + ' of ' + was);
    if (VERBOSE) console.log('         ' + name + ' ' + a.id + ': ' + (pts.length - L.inset.length) + ' elevated, ' + L.inset.length + ' flush' + (L.inset.length ? ' (' + per[a.id].insetWhys.join('; ') + ')' : '') +
      ', ' + L.cut.length + ' left out' + (L.cut.length ? ' (' + per[a.id].whys.join('; ') + ')' : ''));
  }
  check(upOnStrip === 0, name + ': NO elevated runway light inside another strip\'s pavement rectangle (' + elevated + ' elevated of ' + total + ' on ' + strips.length + ' strips)', upOnStrip + ' inside');
  check(upInClear === 0, name + ': none within the ' + clear + ' m clear of another strip either', upInClear);
  if (paved) check(upOnPave === 0 && upNearPave === 0, name + ': none on, or within ' + clear + ' m of, a premises pavement that is not grass (a taxiway, a turn pad, an apron, a road)', upOnPave + ' on, ' + upNearPave + ' near');
  check(flatOff === 0, name + ': every flush light stands in a pavement (' + insetAll + ')', flatOff + ' off it');
  console.log('  ' + name + ': ' + total + ' lights on ' + strips.length + ' strips - ' + elevated + ' elevated, ' + insetAll + ' flush, ' + cutAll + ' left out' +
    (insetAll + cutAll ? ' (' + Object.entries(per).filter(([, v]) => v.cut || v.inset).map(([k, v]) => k + ' ' + v.inset + '/' + v.cut).join(', ') + ')' : ''));
  return { per, strips, paved };
}
const jFx = path.join(T, 'fixtures', 'island_jolene.json');
const J = IN.islandWorld('jolene', { premises: fs.readFileSync(jFx, 'utf8') });
if (check(!!J, 'Jolene composes in node (island_node + its premises fixture)')) {
  const R = places('jolene', J);
  // THE CROSSING IS SEEN: the old placement (no other strip, no premises) stands HOME's lights on w2's concrete and w2's on
  // HOME's - elevated; now those are flush
  for (const [id, other] of [['HOME', 'w2'], ['w2', 'HOME']]) {
    const a = R.strips.find(s => s.id === id), b = R.strips.find(s => s.id === other);
    if (!check(!!a && !!b, 'jolene: ' + id + ' and ' + other + ' are strips')) continue;
    const old = C.runwayLightPoints(a, [a], null), pts = old.edge.concat(old.thr);
    const inside = pts.filter(([x, z, fl]) => !fl && inRect(b, x, z, 0)).length;
    check(inside > 0 && old.inset.length === 0 && old.cut.length === 0, 'jolene: the old placement stood ' + inside + ' of ' + id + '\'s lights ELEVATED on ' + other + '\'s pavement (the check sees the bug)', inside);
    check(R.per[id].insetWhys.includes('strip ' + other), 'jolene: ' + id + '\'s lights on ' + other + ' are flush now', R.per[id].insetWhys.join('; '));
    // the threshold rows stand on the turn pads' concrete: flush, all of them kept (the night's green bars)
    check(R.per[id].thr === 2 * C.RWY_LIGHTS.thrN, 'jolene: ' + id + ' keeps both green threshold rows (' + R.per[id].thr + ', flush on the turn pads)', R.per[id].thr);
  }
  // A GRASS POLYGON IS NOT A PAVEMENT: nv_strip lies on its grass meadow polygon and keeps every light, elevated
  if (R.per.nv_strip) check(R.per.nv_strip.cut === 0 && R.per.nv_strip.inset === 0, 'jolene: nv_strip (on the grass nv_meadow polygon) keeps all its lights elevated', JSON.stringify(R.per.nv_strip));
}
{
  const W = C.makeWorld();
  const R = places('the procedural world', W);
  check(Object.keys(R.per).length >= 5, 'the procedural world: its land strips all stood lights', Object.keys(R.per).join(' '));
}
// the core's test itself: on another strip -> flush, in its clear -> left out, beyond -> elevated; the own box never counts
{
  const a = { id: 'A', x: 0, z: 0, hdg: 0, len: 1000, wid: 30 }, b = { id: 'B', x: 0, z: 0, hdg: Math.PI / 2, len: 800, wid: 20 };
  const S = C.runwayLightStrips([a, b, { id: 'M', kind: 'meadow', x: 0, z: 0, hdg: 0, len: 500, wid: 500 }, { id: 'S', kind: 'water', x: 0, z: 0, hdg: 0, len: 500, wid: 500 }]);
  check(S.length === 2, 'runwayLightStrips: meadows and water lanes are not strips', S.map(s => s.id).join(' '));
  const site = (x, z, p) => JSON.stringify(C.runwayLightSite(x, z, a, S, p || null));
  check(site(0, 16.5) === '{"on":true,"why":"strip B"}', 'a light on the crossing strip goes flush', site(0, 16.5));
  check(site(12, 16.5) === '{"on":false,"why":"strip B"}', 'a light 2 m off its edge (inside the 3 m clear) is left out', site(12, 16.5));
  check(site(14, 16.5) === 'null' && site(400, 16.5) === 'null', 'a light 4 m off its edge stands elevated; the strip\'s own box never counts');
  const grass = () => ({ d: 5, id: 'g', kind: 'poly', cls: 'grass' });
  const conc = (x, z, m) => m > 0 ? { d: -1, id: 't', kind: 'road', cls: 'concrete' } : null, concOn = () => ({ d: 2, id: 't', kind: 'road', cls: 'concrete' });
  check(site(400, 16.5, grass) === 'null' && site(400, 16.5, conc) === '{"on":false,"why":"road t (concrete)"}' && site(400, 16.5, concOn) === '{"on":true,"why":"road t (concrete)"}',
    'a grass polygon stands a light; a concrete road within the clear leaves it out, on it makes it flush');
}

// ---- 2. THE LIGHT ---------------------------------------------------------------------------------------------
{
  const RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
  const cut = (a, b) => { const i = RW.indexOf(a); if (i < 0) throw new Error('render_world.js: ' + a + ' not found'); const j = RW.indexOf(b, i); return RW.slice(i, j < 0 ? undefined : j); };
  let geoFn = null, consts = null;
  try {
    consts = cut('  const RWY_LENS_R', '  function rwyMask');
    const fn = cut('  function rwyLightGeo(hex) {', '  // one strip\'s lights:');
    geoFn = new Function('THREE', 'C', consts + fn + '\nreturn { rwyLightGeo, RWY_LENS_R, RWY_LENS_Y, RWY_GLASS, RWY_INSET, RWY_INSET_Y };')(THREE, h => new THREE.Color(h).convertSRGBToLinear());
  } catch (e) { check(false, 'the light\'s geometry lifts out of render_world.js', e.message); }
  if (geoFn) for (const hex of [0xfff1cc, 0x37ff6a]) {
    const g = geoFn.rwyLightGeo(hex), P = g.attributes.position, UV = g.attributes.uv, COL = g.attributes.color, n = P.count;
    const tag = hex === 0xfff1cc ? 'edge' : 'threshold';
    check(!!g.index && !!g.attributes.normal && !!COL && !!UV && g.groups.length === 0, tag + ': ONE merged geometry (position, normal, colour, uv, one index, no groups: one draw a strip, as the sphere was)');
    let lens = new THREE.Box3(), rest = new THREE.Box3(), badUv = 0, v = new THREE.Vector3(), lensCol = [0, 0, 0], nl = 0;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i);
      const u = UV.getX(i);
      if (u === 0.75) { lens.expandByPoint(v); lensCol[0] += COL.getX(i); lensCol[1] += COL.getY(i); lensCol[2] += COL.getZ(i); nl++; }
      else if (u === 0.25) rest.expandByPoint(v); else badUv++;
    }
    const R = geoFn.RWY_LENS_R, H = geoFn.RWY_LENS_Y;
    check(badUv === 0 && nl > 0, tag + ': every vertex on the mask (the lens 0.75, lit; the stem and base 0.25, dark)', badUv);
    const c = lens.getCenter(new THREE.Vector3());
    check(c.length() < 1e-6 && Math.abs(lens.max.x - R) < 1e-6, tag + ': the lens round the instance\'s origin (the night grows it about itself), radius ' + R, c.toArray().map(x => x.toFixed(4)).join(','));
    check(rest.min.y <= -H - 0.02 && rest.min.y >= -H - 0.2, tag + ': the stem and base reach into the ground (' + (H + rest.min.y).toFixed(2) + ' m below it)', rest.min.y);
    check(rest.max.y > lens.min.y && rest.max.y < lens.max.y, tag + ': the stem ends inside the lens (no gap, nothing through its top)', rest.max.y + ' in ' + lens.min.y + '..' + lens.max.y);
    check(rest.max.x <= 0.07 && rest.max.x > 0.03, tag + ': a slim base can and stem (' + (2 * rest.max.x * 100).toFixed(0) + ' cm across at most)', rest.max.x);
    // FLUSH: the same geometry squashed to RWY_INSET about its centre at RWY_INSET_Y over the surface - a low dome, the
    // stem and base under the pavement
    const fy = geoFn.RWY_INSET, top = geoFn.RWY_INSET_Y + lens.max.y * fy, bot = geoFn.RWY_INSET_Y + rest.min.y * fy;
    check(top > 0.01 && top < 0.035 && bot < -0.05, tag + ': a flush light is a ' + (top * 100).toFixed(1) + ' cm dome over the pavement, its stem ' + (-bot * 100).toFixed(0) + ' cm under it', top + ' / ' + bot);
    const lum = (lensCol[0] + lensCol[1] + lensCol[2]) / (3 * nl), old = new THREE.Color(0x1a1c20).convertSRGBToLinear();
    check(lum > 0.3 && lum > 20 * (old.r + old.g + old.b) / 3, tag + ': the lens\'s day colour is pale glass (linear luminance ' + lum.toFixed(2) + ', the old near-black ' + ((old.r + old.g + old.b) / 3).toFixed(3) + ')', lum);
  }
  const src = RW.slice(RW.indexOf('function standRunwayLights'), RW.indexOf('let fillUpdate'));
  check(/vertexColors: true, emissive: C\(hex\), emissiveMap: rwyMask\(\), emissiveIntensity: 0/.test(src), 'the material: vertex colours for the parts, the emissive map masks the glow to the lens, off by day');
  check(/stand\(L\.edge, 0xfff1cc\); stand\(L\.thr, 0x37ff6a\);/.test(src) && (src.match(/new THREE\.InstancedMesh\(/g) || []).length === 1, 'two instanced meshes a strip at most (the edge row, the thresholds): the same draw count');
  check(/const P = pts\.map\(\(\[x, z, fl\]\) => \[x, world\.terrainH\(x, z\) \+ \(fl \? RWY_INSET_Y : RWY_LENS_Y\), z, fl \? RWY_INSET : 1\]\);/.test(src) && /sv\.set\(1, p3\[3\], 1\); M\.compose\(pv, q, sv\);/.test(src), 'a flush light stands at the surface, squashed; an elevated one with its lens 35 cm up');
  check(/const fy = P\[i\]\[3\], sy = sc \* \(fy \+ \(1 - fy\) \* Math\.min\(1, \(sc - 1\) \/ 2\)\);/.test(RW) && /rwyS\.set\(sc, sy, sc\);/.test(RW), 'at night a flush light grows like the rest (its squash lets go as it grows; by day it is back)');
  check(/const L = runwayLightPoints\(a, world\.aerodromes, PO && PO\.pavedNear \? PO\.pavedNear : null\);/.test(src), 'standRunwayLights stands the core\'s places (the list this gate holds)');
  check(/Math\.max\(1, Math\.min\(150, d \* 0\.003 \/ RWY_LENS_R\)\)/.test(RW) && /im\.userData\.grown = on > 0;/.test(RW), 'the lenses still grow with the distance at night (by the lens\'s own radius)');
  check(/\.declare\('runway', 'runway lights', 'emissive', \(\) => \{ for \(const k in RWY\.mats\) RWY\.mats\[k\]\.emissiveIntensity = 0; \}\)/.test(RW), 'the NIGHT strip still mutes them (the switchboard\'s `runway`)');
  check(/const body = 1 - 0\.985 \* on;/.test(RW) && /const c = RWY\.mats\[h\]\.color; c\.r = c\.g = c\.b = body; \}/.test(RW), 'the body darkens as the lights come on (the old near-black lens at night)');
}

if (fails) { console.log('GATE RWYLIGHTS: FAIL (' + fails + ' of ' + (fails + nOk) + ')'); process.exit(1); }
console.log('  ' + nOk + ' checks');
console.log('GATE RWYLIGHTS: PASS');
