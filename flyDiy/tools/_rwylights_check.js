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
//   2. THE LIGHT (G1415-G1419): the fixture lifted from render_world.js (rwyFixtureGeo) and built on the real vendor
//      three - one geometry for every strip carrying a WWII-style elevated flarepath fitting (30-40 cm, a 10-15 cm
//      well-glass) and, stored mirrored under it, the flush fitting an instance flip brings up; the winding that makes
//      the flip work; the colours (2800 K behind clear glass, the threshold's green filter); and off the source: one
//      fixture mesh and one glow layer a strip, both culled, the glow's size and fall-off law, the haze transmitting it,
//      the switchboard's mute, nothing per light per frame.
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

// ---- 2. THE LIGHT (G1415-G1419, RUNWAY-LIGHTS) -----------------------------------------------------------------
// The fixture lifted from render_world.js (rwyLathe / rwyFixtureGeo) and built on the real vendor three; the glow
// layer's material, its shader text and the per-frame drive read off the source.
{
  const RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
  const cut = (a, b) => { const i = RW.indexOf(a); if (i < 0) throw new Error('render_world.js: ' + a + ' not found'); const j = RW.indexOf(b, i); return RW.slice(i, j < 0 ? undefined : j); };
  let F = null;
  try {
    F = new Function('THREE', 'C', cut('  const RWY = { meshes', '  // the parts\' surfaces') + '\nreturn { rwyFixtureGeo, RWY_DEEP, RWY_LENS_Y, RWY_INSET_Y, RWY_LENS_R, RWY_KIND };')(THREE, h => new THREE.Color(h).convertSRGBToLinear());
  } catch (e) { check(false, 'the fixture lifts out of render_world.js', e.message); }
  if (F) {
    const g = F.rwyFixtureGeo(), P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, I = g.index.array;
    check(!!g.index && !!N && !!UV && !!g.attributes.color && g.groups.length === 0, 'ONE merged fixture geometry (position, normal, colour, uv, one index, no groups): one draw a strip');
    check(F.rwyFixtureGeo() === g, 'one geometry for every strip (built once)');
    // the two fixtures: elevated above y = -1, the flush one stored mirrored round y = -RWY_DEEP
    const up = new THREE.Box3(), flush = new THREE.Box3(), glassUp = new THREE.Box3(), glassFl = new THREE.Box3(), v = new THREE.Vector3();
    let badUv = 0;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i); const u = UV.getX(i);
      if (u !== 0.25 && u !== 0.75) badUv++;
      if (v.y > -1) { up.expandByPoint(v); if (u === 0.75) glassUp.expandByPoint(v); }
      else { const w = new THREE.Vector3(v.x, -v.y - F.RWY_DEEP, v.z); flush.expandByPoint(w); if (u === 0.75) glassFl.expandByPoint(w); }
    }
    check(badUv === 0, 'every vertex on the surface map (0.25 the painted iron, 0.75 the glass)', badUv);
    const H = up.max.y, Wd = up.max.x * 2;
    check(H > 0.30 && H < 0.40 && up.min.y < 0 && up.min.y > -0.05, 'the elevated fitting stands ' + (H * 100).toFixed(1) + ' cm (a WWII flarepath fitting: 30-40 cm), its foot in the ground', H);
    check(Wd > 0.18 && Wd < 0.25, 'its foot plate ' + (Wd * 100).toFixed(0) + ' cm across', Wd);
    const gw = glassUp.max.x * 2;
    check(gw > 0.10 && gw < 0.15 && glassUp.min.y > 0.2 && glassUp.max.y < 0.32, 'the well-glass ' + (gw * 100).toFixed(1) + ' cm across (10-15 cm), between ' + (glassUp.min.y * 100).toFixed(0) + ' and ' + (glassUp.max.y * 100).toFixed(0) + ' cm', gw);
    check(F.RWY_LENS_Y > glassUp.min.y && F.RWY_LENS_Y < glassUp.max.y && Math.abs(F.RWY_LENS_R - glassUp.max.x) < 0.003, 'the glow stands in the glass (' + F.RWY_LENS_Y + ' m), the core\'s floor its radius');
    check(flush.max.y > 0.015 && flush.max.y < 0.04 && flush.min.y < -0.01 && glassFl.max.y === flush.max.y, 'the flush fitting: a ' + (flush.max.y * 100).toFixed(1) + ' cm glass dome over the surface, its ring sunk', flush.max.y);
    check(F.RWY_INSET_Y > 0 && F.RWY_INSET_Y < glassFl.max.y, 'the flush light\'s glow inside its dome');
    // the winding: the elevated fixture faces out (CCW = its normals); the flush one is stored INSIDE OUT, so the instance's
    // y flip turns it the right way out (and the elevated one under it inside out: culled)
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3(), t = new THREE.Vector3();
    let outUp = 0, inUp = 0, outFl = 0, inFl = 0;
    for (let k = 0; k < I.length; k += 3) {
      a.fromBufferAttribute(P, I[k]); b.fromBufferAttribute(P, I[k + 1]); c.fromBufferAttribute(P, I[k + 2]);
      n.subVectors(b, a).cross(t.subVectors(c, a)); if (n.lengthSq() < 1e-14) continue;
      m.set(0, 0, 0); for (const q of [0, 1, 2]) m.add(t.fromBufferAttribute(N, I[k + q]));
      const o = n.dot(m) > 0;
      if (a.y > -1) { if (o) outUp++; else inUp++; } else { if (o) outFl++; else inFl++; }
    }
    check(outUp > 0 && inUp === 0 && inFl > 0 && outFl === 0, 'the elevated fixture faces out, the stored flush one inside out (' + outUp + ' / ' + inFl + ' faces): the instance flip rights it', [outUp, inUp, outFl, inFl].join(' '));
    check(I.length / 3 <= 260, 'a light is ' + I.length / 3 + ' triangles, both fixtures (260 at most: the old ball, stem and can were 124)', I.length / 3);
    // the colours: the clear glass white, the threshold glass green; the glow at 2800 K behind it, luminance-normalised
    const lum = c3 => 0.2126 * c3[0] + 0.7152 * c3[1] + 0.0722 * c3[2];
    const E = F.RWY_KIND.edge, T = F.RWY_KIND.thr;
    check(Math.abs(lum(E.light) - 1) < 0.01 && Math.abs(lum(T.light) - 1) < 0.01, 'the two lights\' colours at luminance 1 x sqrt(cd) / 3 (both 9 cd)', [lum(E.light), lum(T.light)].join(' '));
    check(Math.abs(E.light[1] / E.light[0] - 0.445) < 0.01 && Math.abs(E.light[2] / E.light[0] - 0.117) < 0.01, 'the edge light is a 2800 K bulb behind clear glass (1 : 0.445 : 0.117)');
    check(T.light[0] === 0 && T.light[1] > T.light[2] && T.glass[1] > T.glass[0] && E.glass.join() === '1,1,1', 'the threshold\'s colour is its glass: a green filter (and green glass by day); the edge glass clear');
  }
  const src = RW.slice(RW.indexOf('function standRunwayLights'), RW.indexOf('let fillUpdate'));
  check((src.match(/new THREE\.InstancedMesh\(/g) || []).length === 1 && (src.match(/new THREE\.Points\(/g) || []).length === 1 && !/frustumCulled = false/.test(src), 'a strip is ONE instanced fixture mesh and ONE points layer (the two draws the two colour meshes were), both frustum-culled');
  check(/pv\.set\(x, fl \? y - RWY_DEEP : y, z\); sv\.set\(1, fl \? -1 : 1, 1\);/.test(src) && /im\.setColorAt\(i, tint\.setRGB\(K\.glass\[0\], K\.glass\[1\], K\.glass\[2\]\)\);/.test(src), 'a flush light is the fixture flipped and lifted; the glass\'s colour the instance\'s');
  check(/const L = runwayLightPoints\(a, world\.aerodromes, PO && PO\.pavedNear \? PO\.pavedNear : null\);/.test(src), 'standRunwayLights stands the core\'s places (the list this gate holds)');
  check(/sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false/.test(RW) && /blending: THREE\.CustomBlending, blendSrc: THREE\.OneFactor, blendDst: THREE\.OneFactor/.test(RW), 'the glow: three\'s points program, additive (one + one), no depth write');
  check(/float rwB = uRwyL \* 1000\.0 \/ max\(rwD, 1\.0\);/.test(RW) && /float rwMin = max\(1\.5, uRwyPx \/ 360\.0\);/.test(RW) && /rwW = max\(rwW, 2\.0 \* \$\{RWY_LENS_R\} \/ max\(rwD, 0\.1\) \* rwPx\);/.test(RW), 'the core: never under 1.5 px, never narrower than the lens; its brightness ~ 1 / d (Stevens, a point source)');
  check(/gl_FragColor\.rgb \*= atmoAP\(\)\.a;/.test(RW) && /mistApply\(vec3\(1\.0\), rwV, rwL, cameraPosition\.y\) - mistApply\(vec3\(0\.0\)/.test(RW), 'the haze transmits the light and adds nothing to the sprite');
  check(/\.declare\('runway', 'runway lights', 'emissive', \(\) => \{ RWY\.U\.lvl\.value = 0; RWY\.shown = false; for \(const g of RWY\.glows\) g\.visible = false; \}\)/.test(RW), 'the NIGHT strip still mutes them (the switchboard\'s `runway`)');
  const ap = RW.slice(RW.indexOf('  function runwayLightsApply('), RW.indexOf('  function applyWorldLights()'));
  check(!/for \(let i/.test(ap) && /if \(RWY\.shown !== show\) \{ RWY\.shown = show; for \(const g of RWY\.glows\) g\.visible = show; \}/.test(ap), 'nothing per light per frame: one uniform; the strips\' layers hidden by day (a loop over the strips, only when the state turns)');
}

if (fails) { console.log('GATE RWYLIGHTS: FAIL (' + fails + ' of ' + (fails + nOk) + ')'); process.exit(1); }
console.log('  ' + nOk + ' checks');
console.log('GATE RWYLIGHTS: PASS');
