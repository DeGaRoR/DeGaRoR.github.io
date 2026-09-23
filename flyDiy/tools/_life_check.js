#!/usr/bin/env node
// LIFE CHECK — GATE LIFE (SCENERY LIFE, 2026-09-23): the scenery's life (src/viewer/scenery_life.js), headless,
// with the real vendor three and the real premises core, on a SYNTHETIC premises built here (a flat ground with one
// hill, a zone of two houses on a road, an apron with a parked aeroplane beside a runway):
//   1. THE KIT - every procedural piece is position + normal + colour (the BatchedMesh's one attribute set), no
//      NaN, under its triangle budget; a thing that stands has its foot on y = 0.
//   2. THE LAWS - the stand is deterministic in the seed; nothing inside a house's walls, nothing before a door,
//      no wall mount over an opening; no yard thing on a carriageway (a parked car beside it, never on it); a mast
//      off every apron, out of the runway's funnel, 700 m from the next; `on: false` stands nothing, a category at 0
//      none of its kind, twice the clutter more of it; traffic only on a road the record left without, never a
//      taxiway.
//   3. THE DRAW - an eye in the street draws, an eye 50 km off draws nothing; every drawn item inside its last
//      distance; the draws a handful.
//   4. THE HOOKS - the renderer makes it, ticks it, keeps each house's report, asks it for traffic; the editor
//      has the LIFE section; the world pack loads it before the renderer; the world ticks the premises for it.
// node tools/_life_check.js [--verbose]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const VERB = process.argv.includes('--verbose');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };

const THREE = require('../vendor/three.min.js');
const PG = require('../src/core/27_premises.js');
// the page's globals the module reads, stubbed: the prop registry (scans with no cuts: people, cars, bins), the
// yard kit's vehicle menu
global.window = global;
window.PREMISES_GEN = PG;
const scan = (key, group, dim) => ({ key, group, nt: 2000, dim, mats: {}, parts: [] });
global.PROP_REG = { order: [], props: {} };
for (const [k, g, d] of [['person_andrew', 'people', [0.6, 1.8, 0.5]], ['person_john', 'people', [0.6, 1.8, 0.7]], ['person_luke', 'people', [0.6, 1.6, 0.6]],
  ['auto_sedan_red', 'auto', [1.7, 1.3, 4.0]], ['auto_pickup_white', 'auto', [2.1, 1.6, 5.1]], ['bin_metal', 'vessel', [0.78, 0.91, 0.56]], ['drum_steel', 'vessel', [0.63, 0.93, 0.64]],
  ['barrel_plastic', 'vessel', [0.49, 0.88, 0.48]], ['jerrycan', 'vessel', [0.27, 0.32, 0.34]], ['crate_wood_a', 'storage', [0.41, 0.41, 0.42]], ['crate_wood_b', 'storage', [0.41, 0.82, 0.42]], ['crate_wood_c', 'storage', [1.01, 0.41, 0.42]], ['pallets_three', 'yard', [1.77, 0.77, 1.30]], ['pallets_stack', 'yard', [2.13, 1.11, 1.56]], ['pallet_one', 'yard', [1.72, 0.2, 1.17]], ['cinder_pallet', 'yard', [1.0, 1.06, 1.8]], ['cement_bags', 'yard', [1.97, 0.99, 1.85]]]) {
  PROP_REG.props[k] = scan(k, g, d); PROP_REG.order.push(k);
}
global.propLevels = () => [];
global.propReady = () => false;
window.HOUSE_GEN = { YARD_KIT: { auto_sedan_red: { L: 4.0, W: 1.7, H: 1.3, auto: 'car' }, auto_pickup_white: { L: 5.1, W: 2.1, H: 1.6, auto: 'pickup' } },
  AUTO_KEYS: kinds => ['auto_sedan_red', 'auto_pickup_white'] };
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src/viewer/scenery_life.js'), 'utf8');
vm.runInThisContext(SRC, { filename: 'scenery_life.js' });
const SL = window.SCENERY_LIFE;
verdict(!!(SL && SL.make && SL.DEF && SL.CATS), 'the module loads headless and publishes make, DEF, CATS');

// ---- 1. THE KIT ----------------------------------------------------------------------------------------------
{
  const K = SL.buildKit(THREE);
  const BUDGET = { can: 100, bottle: 100, paper: 60, sheet: 40, bag: 200, tyre: 400, tyres: 1000, tyreUp: 400, mast: 20000, shelter: 200, dish: 600 };
  const MOUNTED = new Set(['dish']);
  let attrs = 0, nan = 0, over = [], foot = [];
  for (const k in K) {
    const g = K[k], names = Object.keys(g.attributes).sort().join(',');
    if (names !== 'color,normal,position' || g.index) attrs++;
    const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) { nan++; break; }
    const tris = g.attributes.position.count / 3;
    if (tris > (BUDGET[k] || 900)) over.push(k + ' ' + tris);
    g.computeBoundingBox();
    if (!MOUNTED.has(k) && Math.abs(g.boundingBox.min.y) > 0.03) foot.push(k + ' ' + g.boundingBox.min.y.toFixed(3));
    if (VERB) console.log('   ' + k.padEnd(10) + ' ' + String(tris).padStart(6) + ' tris  y ' + g.boundingBox.min.y.toFixed(2) + '..' + g.boundingBox.max.y.toFixed(2));
  }
  verdict(Object.keys(K).length >= 20, Object.keys(K).length + ' pieces in the kit');
  verdict(attrs === 0, 'every piece: position + normal + colour, non-indexed (one BatchedMesh takes them all)' + (attrs ? ' - ' + attrs + ' do not' : ''));
  verdict(nan === 0, 'no NaN in any piece');
  verdict(!over.length, 'every piece under its triangle budget' + (over.length ? ': ' + over.join(', ') : ''));
  verdict(!foot.length, 'every standing piece has its foot on y = 0' + (foot.length ? ': ' + foot.join(', ') : ''));
}

// ---- 2. THE LAWS ---------------------------------------------------------------------------------------------
// a flat ground at 5 m with a 30 m hill at (400, 400); a road along z = 20 through a residential zone; two houses
// north of it; an apron and a runway to the south-east with an aeroplane on the apron
const H0 = 5, hill = (x, z) => Math.max(0, 30 - Math.hypot(x - 400, z - 400) / 10);
const heightAt = (x, z) => H0 + hill(x, z);
const road = { id: 'r1', pts: [[-260, 20], [260, 20]], w: 6, cls: 'gravel', traffic: 0 };
const taxi = { id: 'taxi_a', pts: [[300, -330], [300, -600]], w: 24, cls: 'paved' };
const zone = { id: 'z1', kind: 'residential', poly: [[-200, -60], [200, -60], [200, 60], [-200, 60]] };
const apron = [[280, -300], [400, -300], [400, -220], [280, -220]];
const runway = Object.assign({}, PG.RUNWAY_DEF || {}, { id: 'w1', c: [700, -260], hdg: 0, len: 900, wid: 30 });
const craft = [{ x: 330, z: -260, yaw: 0 }];
const house = (id, x, z, yaw, cat) => {
  const plot = { id, kind: 'residential', cat: cat || 'residential', poly: [[x - 12, z - 18], [x + 12, z - 18], [x + 12, z + 12], [x - 12, z + 12]], front: [x, z + 12], tg: [1, 0], n: [0, -1] };
  const stats = { groundAO: [{ x: 0, z: 0, hx: 5, hz: 3.5 }, { x: 0, z: 4.6, hx: 1.2, hz: 1.1 }], doors: [{ x: 0, z: 4.0 }],
    openings: [{ side: 0, s0: 2, s1: 3, y0: 1.2, y1: 2.4, kind: 'window' }, { side: 0, s0: 4.5, s1: 5.5, y0: 0.1, y1: 2.2, kind: 'door' }, { side: 2, s0: 1, s1: 9, y0: 1.0, y1: 3.4, kind: 'window' },
      { side: 1, s0: 0.5, s1: 6.5, y0: 0.8, y1: 3.2, kind: 'window' }, { side: 3, s0: 0.5, s1: 6.5, y0: 0.8, y1: 3.2, kind: 'window' }],
    eaveY: 3.9, ridgeY: 6.2, pitch: 30, bbox: { x0: -5, x1: 5, y0: 0, y1: 6.2, z0: -3.5, z1: 5.7 } };
  return [id, { grp: { position: { x, y: H0, z }, rotation: { y: yaw } }, built: { stats }, plot }];
};
const HOUSES = new Map([house('h1', -40, -10, 0), house('h2', 60, -8, 0.3), house('h3', 140, -10, 0, 'industrial'), house('h4', -130, -10, 0, 'landmark')]);
const onRoad = (x, z) => [road].some(r => PG.roadDist(r, x, z) < r.w / 2 + 1);
let eye = new THREE.Vector3(0, 12, 0);
const rec = { seed: 3, layers: { zones: [zone] }, life: undefined };
const host = {
  root: new THREE.Group(), game: true, record: () => rec, frame: () => ({ toWorld: (x, z) => [x, z], toLocal: (x, z) => [x, z], yaw: 0 }), heightAt, waterY: () => -10,
  houses: () => HOUSES, plots: () => [...HOUSES.values()].map(h => h.plot), roads: () => [road, taxi], runways: () => [runway], zones: () => [zone],
  aprons: () => [apron], aircraft: () => craft, sites: () => [{ x: 330, z: -230 }],
  cover: (x, z) => (onRoad(x, z) || PG.inPoly(apron, x, z) ? { kill: 1, cls: 'gravel' } : null),
  eye: () => eye, lampsOn: () => 0, queued: () => 0, obstacles: () => null, onTraffic: () => {},
};
const L = SL.make(THREE, host);
const stand = cfg => { L.set(cfg || null); L.standNow(); return L.items(); };
{
  const a = stand(null), b = stand(null);
  verdict(a.length > 0 && JSON.stringify(a) === JSON.stringify(b), 'the stand is deterministic in the seed (' + a.length + ' items, twice the same)');
  const c = stand({ seed: 2 });
  verdict(JSON.stringify(c) !== JSON.stringify(a), 'another life seed stands another life');
  stand(null);
  const byCat = L.stats.byCat;
  if (VERB) console.log('   ' + JSON.stringify(byCat));
  for (const q of ['clutter', 'rubbish', 'antennas', 'small', 'people']) verdict((byCat[q] || 0) > 0, 'the defaults stand ' + q + ' (' + (byCat[q] || 0) + ')');
  verdict(a.every(q => Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z)), 'every item finite');
  // nothing inside a house, nothing before its door (clutter), no dish over an opening
  let inside = 0, door = 0, overOpen = 0, dishes = 0;
  for (const [, h] of HOUSES) {
    const P = h.grp.position, y = h.grp.rotation.y, c = Math.cos(y), s = Math.sin(y);
    const toH = (x, z) => { const dx = x - P.x, dz = z - P.z; return [dx * c - dz * s, dx * s + dz * c]; };
    for (const q of a) {
      const [lx, lz] = toH(q.x, q.z);
      if (Math.abs(lx) < 5 && Math.abs(lz) < 3.5 && q.cat !== 'antennas') { inside++; if (VERB) console.log('   inside: ' + q.kind + ' ' + lx.toFixed(2) + ',' + lz.toFixed(2)); }
      if (q.cat === 'clutter' && Math.hypot(lx - 0, lz - 4.0) < 2.4) door++;
      if (q.kind === 'p:dish' && Math.abs(lx) <= 5.2 && Math.abs(lz) <= 3.7) {
        dishes++;
        const side = Math.abs(lz - 3.5) < 0.2 ? 0 : Math.abs(lz + 3.5) < 0.2 ? 2 : Math.abs(lx - 5) < 0.2 ? 1 : 3;
        const t = side === 0 ? lx + 5 : side === 2 ? 5 - lx : side === 1 ? 3.5 - lz : lz + 3.5, dy = q.y - P.y;
        for (const o of h.built.stats.openings) if (o.side === side && t > o.s0 - 0.3 && t < o.s1 + 0.3 && dy + 0.35 > o.y0 - 0.3 && dy - 0.3 < o.y1 + 0.3) overOpen++;
      }
    }
  }
  verdict(inside === 0, 'nothing stands inside a house\'s walls (' + inside + ')');
  verdict(door === 0, 'no clutter within 2.4 m of a door (' + door + ')');
  verdict(overOpen === 0, dishes + ' dishes, none over a window or a door (' + overOpen + ')');
  // the plot's category routes the laws (VILLAGE_GEN.finishPlot writes plot.cat): a works and a landmark get no
  // mailbox and no house fuel tank; a works gets its yard's clutter
  const near = (id, r) => { const P = HOUSES.get(id).grp.position; return a.filter(q => Math.hypot(q.x - P.x, q.z - P.z) < r); };
  const homely = q => /p:(mailbox|pig|oiltank)$/.test(q.kind);
  verdict(!near('h3', 16).some(homely) && !near('h4', 16).some(homely), 'an industrial plot and a landmark: no mailbox, no house fuel tank');
  const works = stand({ clutter: 3 }).filter(q => q.cat === 'clutter' && Math.hypot(q.x - 140, q.z + 10) < 16).map(q => q.kind);
  verdict(works.some(k => /drum|pallet|cinder|cement|cone|crate|barrel/.test(k)) && !works.some(k => /propane2/.test(k)), 'an industrial yard gets its works clutter (' + [...new Set(works)].join(' ') + ')');
  stand(null);
  // the carriageway: nothing but the traffic on it; a parked car beside it
  const onCarriage = a.filter(q => q.cat !== 'cars' && PG.roadDist(road, q.x, q.z) < road.w / 2 - 0.05 && Math.abs(q.x) < 255);
  verdict(!onCarriage.length, 'nothing stands on the carriageway (' + onCarriage.length + (onCarriage.length ? ': ' + onCarriage.slice(0, 3).map(q => q.kind).join(' ') : '') + ')');
  const cars = a.filter(q => q.cat === 'cars');
  verdict(cars.every(q => PG.roadDist(road, q.x, q.z) >= road.w / 2 + 0.8), cars.length + ' parked cars, every one beside the carriageway, none on it');
  // the masts: off the apron, out of the funnel, apart
  const masts = L.masts();
  const box = PG.runwayBox(runway, 150);
  verdict(masts.length >= 1, masts.length + ' masts stood (a settlement and a field)');
  verdict(masts.every(m => !PG.inPoly(apron, m.x, m.z) && PG.sdPoly(apron, m.x, m.z) >= 25), 'every mast 25 m off the apron');
  verdict(masts.every(m => !PG.inPoly(box, m.x, m.z)), 'every mast out of the runway\'s funnel (150 m either side, 150 m past the ends)');
  verdict(masts.every((m, i) => masts.every((n, j) => i === j || Math.hypot(m.x - n.x, m.z - n.z) >= 700)), 'the masts 700 m apart');
  // the switches
  verdict(stand({ on: false }).length === 0, 'life off: nothing stands');
  for (const q of ['people', 'clutter', 'rubbish', 'antennas', 'small']) verdict(!stand({ [q]: 0 }).some(x => x.cat === q), q + ' at 0: none of it');
  const n1 = stand(null).filter(q => q.cat === 'clutter').length, n2 = stand({ clutter: 2.5 }).filter(q => q.cat === 'clutter').length;
  verdict(n2 > n1, 'more clutter asked, more stood (' + n1 + ' -> ' + n2 + ')');
  const ant = cfg => JSON.stringify(stand(cfg).filter(q => q.cat === 'antennas'));
  verdict(ant(null) === ant({ clutter: 0, rubbish: 0 }), 'one stream a law: switching the clutter and the rubbish off moves no antenna');
  // traffic: the record's road without traffic gets the life's; a taxiway and an authored road do not
  stand(null);
  verdict(L.trafficOf(road) > 0 && L.trafficOf(taxi) === 0 && L.trafficOf(Object.assign({}, road, { traffic: 2 })) === 0,
    'traffic on a road left without (' + L.trafficOf(road).toFixed(2) + '/km), none on a taxiway, the record\'s own where it gave one');
  L.set({ on: false }); verdict(L.trafficOf(road) === 0, 'life off: no traffic of its own');
}

// ---- 3. THE DRAW ---------------------------------------------------------------------------------------------
{
  stand(null);
  eye = new THREE.Vector3(0, 12, 10);
  L.draw(eye);
  const near = L.stats.visible;
  verdict(near > 0, 'an eye in the street draws ' + near + ' items (' + L.stats.draws + ' draws)');
  verdict(L.stats.draws <= 12, 'in a handful of draws (' + L.stats.draws + '; the scans have no bytes here, the pieces are one or two)');
  let far = 0;
  for (const q of L.items()) { const d = Math.hypot(q.x - eye.x, q.y - eye.y, q.z - eye.z), cut = q.cat === 'antennas' && q.kind === 'p:mast' ? 6000 : q.kind === 'p:shelter' ? 900 : (SL.CUT[q.cat] || 300) + 90; if (d > cut) far++; }
  verdict(near <= L.items().length - far, 'nothing drawn past its last distance (' + near + ' drawn, ' + far + ' past their cut)');
  L.draw(new THREE.Vector3(50000, 10, 50000));
  verdict(L.stats.visible === 0, 'an eye 50 km off draws nothing (' + L.stats.visible + ')');
  L.set({ dist: 0.3 }); L.draw(eye);
  verdict(L.stats.visible < near, 'a shorter draw distance draws less (' + near + ' -> ' + L.stats.visible + ')');
  L.dispose();
  verdict(!host.root.children.length, 'dispose takes the life out of the scene');
}

// ---- 4. THE HOOKS --------------------------------------------------------------------------------------------
{
  const rd = n => fs.readFileSync(path.join(__dirname, '..', n), 'utf8');
  const RP = rd('src/viewer/render_premises.js'), UI = rd('src/viewer/premises_ui.js'), RW = rd('src/viewer/render_world.js'), B = rd('tools/build.js');
  verdict(RP.includes('window.SCENERY_LIFE.make(THREE,'), 'the premises renderer makes the life');
  verdict(/function tick\(dt\) \{[^\n]*if \(LIFE\) LIFE\.tick\(\);/.test(RP), 'its tick ticks it');
  verdict(RP.includes('built: h.built || null'), 'each house keeps its generator\'s report (HOUSES[].built)');
  verdict((RP.match(/trafficOf\(rd\)/g) || []).length >= 3, 'the traffic asks it for a road the record left without');
  verdict(/if \(LIFE\) \{ LIFE\.set\(rec\.life\); LIFE\.dirty\(\);/.test(RP), 'a rebuild hands it the record\'s life block');
  verdict(/k: 'life',\s+label: 'LIFE'/.test(UI) && UI.includes('function lifeRows()') && UI.includes("if (section === 'life') return lifeRows();"), 'the world editor has the LIFE section');
  const iL = B.indexOf("['src/viewer', 'scenery_life.js']"), iR = B.indexOf("['src/viewer', 'render_premises.js']");
  verdict(iL > 0 && iR > iL, 'the world pack loads it before the renderer');
  verdict(RW.includes('premisesR.stats.life)'), 'the world ticks the premises while the life is on');
}

console.log('GATE LIFE: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
