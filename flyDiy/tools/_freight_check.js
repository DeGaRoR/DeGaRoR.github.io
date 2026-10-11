// GATE FREIGHT (G2340-G2344 FREIGHT-MODEL; futureDesigns/game/FREIGHT-2026-10-07.md §1, §2, §4).
//
//   THE CARDS     every validated build's hold, doors, seats and plaque re-measured off its own mesh
//                 (tools/_freight_site.js: _bay_site.js's inset sections, cageDoorEdges' outlines, the join's
//                 seats, genShakedown's corners) and FREIGHT_CARDS held to it byte for byte; one build re-measured
//                 uncached every run and equal (deterministic; --full re-measures all five)
//   THE ITEMS     a load is items (the goods' dims), the kilos exactly; 120 kg of crated parts = 2 crates
//                 0.8 x 0.6 x 0.5; every goods word a job can draw has its dims; BULK SPLITS INTO BAGS (ruled)
//   THE DOORS     a door too small refuses (an oversize box on every design, a shrunk door on a copy of a card);
//                 a box that passes is not refused once smaller; an upright drum goes in upright; THE STRETCHER
//                 (2.0 x 0.6 x 0.5 m) against every design, stated as the geometry says (room / door)
//   THE PACKER    deterministic and order-free; every placed item inside the hold, on the floor or wholly on a
//                 stackable item, clear of the seats, the occupants and every other item, through a door; the
//                 report's CG = the moments recomputed; for the GENERATED JOBS, every doer design's proposal places
//                 everything with its CG in the plaque's range, the floors and the baggage placard held, under the
//                 MTOW; a limit not met is REPORTED, never refused (a heavy drum on a floor, a load aft of range)
//   THE GAME      jobs carry their items (valid, the load's kilos), "every job is flyable" holds with volume, a
//                 sub carrying an item no door takes is no design's; the map's mark (✓ / ✗ for the hard no-no's:
//                 gear vs surface, NO DOOR FITS; a build contract none; an unknown hold never a ✗); the stop record's
//                 load IS the loaded items (the typed kilos the fallback) and a delivery missing an item is refused
//   THE VIEW      (G2345 FREIGHT-LOAD, 77_freight_load.js) the loading view's pure half: it opens on the packer's
//                 proposal; its report is freightReport's key for key; the drag's sweep (every item to a grid over
//                 the hold, both orientations) - every allowed target stands (the packer's own checks restated) on
//                 the stations' grid, every refusal says why; the refusals by name (the pilot, a passenger, an empty
//                 seat still in, no door, the stack, the overhang, the drum, the low roof); the snap and the wall;
//                 OUT OF RANGE ALLOWED and said (the CG aft, the MTOW); the seats out / in; Propose again = the
//                 packer with the seats as they are; Accept's record (career.load), its survival through the
//                 normaliser, freightAccepted (FREIGHT-STRAP's read), the stop's items, the record leaving once
//                 delivered
//   THE STRAP     (G2400 FREIGHT-STRAP, 78_freight_strap.js + 30_solver.js's setFreight) the accepted load strapped:
//                 every item's kilos on the eight nodes of the rings round it, their centroid the item's own (so the
//                 sim's CG moves by exactly the report's item moments), the adds = the items + the job's passengers -
//                 the baggage allowance; a passenger and the allowance billed by the FRAME'S OWN rule (a build with
//                 that seat filled / that allowance zero, node for node); the sim: totalM + the adds, every loaded node
//                 the def's mass + its add, a reset keeps the load, the burn keeps a load on a tank's node, the CG and
//                 the pitch inertia moved by the shares (the parallel-axis identity), DELIVERY (null) puts every node
//                 back to the def's own number, BYTE-IDENTITY with nothing aboard (never asked, asked with nothing,
//                 loaded then unloaded: the same flight to the bit; loaded: another flight); the straps (outside every
//                 box, the feet on the floor inside the hold, two a stack, a buckle and four anchors; nothing without a
//                 load); the stop (a 3-stop chain on the C172: the first leg's record delivered at B and dropped, the
//                 second leg's placed by the packer's proposal, the player's own placement kept, nothing after C)
//   PURITY        76_freight.js, 77_freight_load.js, 78_freight_strap.js: no DOM, storage, clock or random
//
//   node tools/_freight_check.js              the gate (warm: the cards from the OS temp dir, keyed by the content
//                                             that measures; cold ~90 s - FLYDIY_FREIGHT_NOCACHE=1 measures afresh)
//   node tools/_freight_check.js --show       also print the cards, the stretcher and a packing per design
//   node tools/_freight_check.js --evidence   write reports/evidence/FREIGHT-MODEL/freight.txt
//   node tools/_freight_check.js --selftest   the model's own sources doctored one rule at a time; each must
//                                             turn a check red (a check that cannot fail is not a check)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), os = require('os');
const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');
const SELF = process.argv.includes('--selftest');
const SHOW = process.argv.includes('--show');
const EVID = process.argv.includes('--evidence');
const FULL = process.argv.includes('--full');

const SRC = {};
for (const f of ['72_contract_data.js', '73_contracts.js', '74_career.js', '75_career_wire.js', '76_freight.js', '77_freight_load.js', '78_freight_strap.js'])
  SRC[f.slice(0, 2)] = fs.readFileSync(path.join(ROOT, 'src', 'core', f), 'utf8');
const namesOf = s => [...s.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
// the five files, evaluated FRESH over the core's globals (minus their own names): the selftest doctors exactly
// the rule under test
function loadModel(mut) {
  const src = {};
  for (const k of Object.keys(SRC)) src[k] = (mut && mut['s' + k]) ? mut['s' + k](SRC[k]) : SRC[k];
  const names = [].concat(...Object.values(src).map(namesOf)).filter((n, i, a) => a.indexOf(n) === i);
  const base = Object.assign({ console }, CORE);
  for (const n of names) delete base[n];
  const ctx = vm.createContext(base);
  vm.runInContext(['72', '73', '74', '75', '76', '77', '78'].map(k => src[k]).join('\n') + '\n;this.__M = { ' + names.join(', ') + ' };', ctx, { filename: 'freight' });
  return Object.assign(ctx.__M, { __src: src });
}

// ---- THE CARDS, MEASURED (cached by content: the measuring code, the meshes' code, the build files) -------------
const SITE = require('./_freight_site.js');
function measureKey(DS) {
  const h = crypto.createHash('sha256');
  // the core that measures: every core source but the game layer (70_-76_ and the export line read no mesh and
  // build no aeroplane), so a change to the contracts or the packer does not re-measure five meshes
  const core = fs.readdirSync(path.join(ROOT, 'src', 'core')).filter(f => /\.js$/.test(f) && !/^(7\d|90)_/.test(f)).sort();
  for (const f of core) h.update(f + fs.readFileSync(path.join(ROOT, 'src', 'core', f)));
  const tools = fs.readdirSync(__dirname).filter(f => /^_(cage_.*|freight_site|bay_site|fit_site|scene_headless)\.js$/.test(f)).sort();
  for (const f of tools) h.update(f + fs.readFileSync(path.join(__dirname, f)));
  for (const k of Object.keys(DS).sort()) { h.update(k + '|' + DS[k].build + '|' + (DS[k].patch || '')); h.update(fs.readFileSync(path.join(ROOT, DS[k].build))); }
  return h.digest('hex').slice(0, 16);
}
function measuredCards(DS) {
  const f = path.join(os.tmpdir(), 'flydiy-freight-cards-' + measureKey(DS) + '.json');
  if (process.env.FLYDIY_FREIGHT_NOCACHE !== '1') { try { return { cards: JSON.parse(fs.readFileSync(f, 'utf8')), cached: true }; } catch (e) { /* measure */ } }
  const cards = SITE.measureAll(DS);
  try { fs.writeFileSync(f, JSON.stringify(cards)); } catch (e) { /* a read-only temp */ }
  return { cards, cached: false };
}
const DS0 = loadModel(null).CONTRACT_DESIGNS;
const MEAS = measuredCards(DS0);
// DETERMINISM: one build re-measured afresh every run (all five with --full), equal to the measurement
const AGAIN = {};
for (const k of (FULL ? Object.keys(DS0) : ['cub'])) AGAIN[k] = SITE.freightMeasureFile(DS0[k].build, DS0[k]);

// ---- G2400 (FREIGHT-STRAP): THE BUILDS THAT FLY (built once: the strap's rows weigh the loads on them) -------------
// the Cub and the metal C172 as their validated files build (tools/_freight_site.js's own path: migrate, buildGen),
// and three variants the frame bills itself - the Cub with its rear seat filled, the Cub with no baggage allowance, the
// C172 with its co-pilot's seat empty - for the rows that hold 78_'s copies of the frame's rules to the frame
const STRAP_DEFS = (() => {
  const spec = k => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, DS0[k].build), 'utf8')); return CORE.genMigrateSpec(JSON.parse(JSON.stringify(j.spec || j))); };
  const mk = (k, patch) => { const s = spec(k); if (patch) patch(s); return CORE.buildGen(s); };
  return { cub: mk('cub'), c172: mk('c172'), jodel: mk('jodel'),
           cubPax: mk('cub', s => { s.cabin.occupied = [1, 1]; }), cubNoBag: mk('cub', s => { s.cabin.baggage = 0; }),
           c172Solo: mk('c172', s => { s.cabin.occupied = [1, 0, 0, 0]; }) };
})();
const STRAP_WORLD = CORE.makeWorld();
// the core's text, doctored (the selftest's solver breaks: 30_ lives in the built core) -> its exports
function coreOf(fn) {
  const txt = fn(fs.readFileSync(path.join(__dirname, 'flight_core.js'), 'utf8'));
  const ctx = vm.createContext({ console, module: { exports: {} }, performance, TextDecoder, TextEncoder, setTimeout, clearTimeout });
  vm.runInContext(txt, ctx, { filename: 'flight_core.doctored.js' });
  return ctx.module.exports;
}
const fnv = (...arrs) => {
  let h = 2166136261;
  for (const a of arrs) { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; }
  return h;
};

let fails = [], checks = 0;
const ok = (c, msg) => { checks++; if (!c) fails.push(msg); return !!c; };
const J = o => JSON.stringify(o);
const clone = o => JSON.parse(J(o));
let REPORT = [];

function run(mut) {
  fails = []; checks = 0; REPORT = [];
  const M = loadModel(mut);
  const DS = M.CONTRACT_DESIGNS, K = M.FREIGHT_CARDS, F = M.CONTRACT_FIELDS;
  const say = s => REPORT.push(s);

  // ==== THE CARDS ==============================================================================================
  ok(J(Object.keys(K).sort()) === J(Object.keys(DS).sort()), 'a card for every validated design (' + Object.keys(K).join(', ') + ')');
  for (const k of Object.keys(DS)) {
    ok(J(K[k]) === J(MEAS.cards[k]), k + ': FREIGHT_CARDS = its build measured off its mesh (tools/_freight_site.js)');
    const c = K[k];
    if (!c) continue;
    ok(c.mass && c.mass.mtow > 0 && c.mass.base.kg > 0 && c.mass.cg[0] <= c.mass.cg[1] && c.mass.mac[1] > 0, k + ': the plaque (MTOW, the base loading, the certified CG range, the MAC)');
    if ((DS[k].seats || 0) > 1) {
      ok(c.hold && c.hold.n >= 5 && c.hold.half.length === c.hold.n + 1 && c.hold.half.every(r => r.length === c.hold.ny && r.every(v => Number.isInteger(v) && v >= 0)), k + ': a hold, measured station by station');
      ok(c.doors.length > 0 && c.doors.every(d => d.rects.length && d.rects.every(r => r[0] > 0 && r[1] > 0) && d.x1 > d.x0), k + ': its doors, each with its clear openings');
      ok(c.doors.some(d => d.x1 >= c.hold.x0 && d.x0 <= c.cabinX1), k + ': a door opens onto the cabin');
      ok(c.seats.length === DS[k].seats && c.seats[0].i === 0, k + ': its seats (the join\'s stations), the pilot\'s first');
    }
  }
  for (const k of Object.keys(AGAIN)) ok(J(AGAIN[k]) === J(MEAS.cards[k]), k + ': measured twice, the same card (deterministic)');
  say('THE CARDS (measured off each validated build\'s mesh; x metres aft of the windscreen-base ring)');
  for (const k of Object.keys(K)) {
    const c = K[k], H = c.hold;
    say('  ' + k.padEnd(6) + (H ? 'hold ' + H.x0 + '-' + (H.x0 + H.n * H.dx).toFixed(1) + ' m (cabin to ' + c.cabinX1 + ', baggage aft)' : 'no hold (nothing behind the pilot)')
      + ' · doors ' + (c.doors.map(d => d.id + ' ' + d.x0 + '-' + d.x1 + ' m, widest ' + Math.max(...d.rects.map(r => r[0])) + ' x ' + d.rects.find(r => r[0] === Math.max(...d.rects.map(q => q[0])))[1] + ', tallest ' + d.rects.find(r => r[1] === Math.max(...d.rects.map(q => q[1])))[0] + ' x ' + Math.max(...d.rects.map(r => r[1]))).join('; ') || 'none')
      + ' · MTOW ' + c.mass.mtow + ' kg, base ' + c.mass.base.kg + ' kg, CG range ' + c.mass.cg.map(x => ((x - c.mass.mac[0]) / c.mass.mac[1] * 100).toFixed(1)).join('-') + ' % MAC');
  }

  // ==== THE ITEMS ==============================================================================================
  const parts = M.freightItems({ kg: 120 }, 'goods.parts');
  ok(parts.length === 2 && parts.every(i => i.kind === 'crate' && i.kg === 60 && J(i.dims) === J([0.8, 0.6, 0.5])), '120 kg of crated parts = 2 crates 0.8 x 0.6 x 0.5 m, 60 kg each');
  ok(J(M.freightItems({ kg: 120 }, 'goods.parts')) === J(parts), 'a load is always the same items');
  ok(M.freightItems({ kg: 0, pax: 2 }, 'goods.crew').length === 0, 'passengers are seats, not items');
  const goodsWords = new Set();
  for (const p of Object.values(M.CONTRACT_PROVIDERS)) for (const g of p.goods) if (g.kind === 'kg' || g.kind === 'bulk') goodsWords.add(g.word);
  for (const w of goodsWords) {
    ok(!!M.FREIGHT_GOODS[w], w + ': its items have dims (FREIGHT_GOODS)');
    for (const kg of [5, 17.5, 40, 95, 160]) {
      const its = M.freightItems({ kg }, w);
      ok(Math.abs(M.freightKg(its) - kg) < 1e-9 && its.every(i => i.kg > 0 && M.FREIGHT_KINDS[i.kind] && !M.FREIGHT_KINDS[i.kind].split), w + ' ' + kg + ' kg: items that weigh the load exactly, none left bulk');
    }
  }
  // BULK SPLITS INTO BAGS (ruled)
  const bulk = M.freightSplit([{ id: 'cement', kind: 'bulk', kg: 110, dims: [1, 1, 1] }]);
  ok(bulk.length === 5 && bulk.every(b => b.kind === 'bag' && b.kg <= M.FREIGHT_BAG.kg && J(b.dims) === J(M.FREIGHT_BAG.dims)) && Math.abs(M.freightKg(bulk) - 110) < 1e-9,
     'bulk splits into bags: 110 kg -> 5 sacks of at most 25 kg, 110 kg exactly');
  const sup = M.freightItems({ kg: 90 }, 'goods.supplies');
  ok(sup.length === 4 && sup.every(b => b.kind === 'bag'), 'the bulk goods (supplies, 90 kg) arrive as 4 sacks');

  // ==== THE DOORS ==============================================================================================
  const holds = Object.keys(K).filter(k => K[k].hold);
  for (const k of holds) {
    const c = K[k];
    ok(!M.freightDoorAny(c, { id: 'huge', kind: 'box', dims: [1.3, 1.3, 1.3] }).ok, k + ': a box larger than every door is refused');
    ok(M.freightDoorAny(c, { id: 'small', kind: 'box', dims: [0.3, 0.25, 0.2] }).ok, k + ': a small box goes in');
    // monotone: what passes still passes smaller
    for (const d of [[0.8, 0.6, 0.5], [0.65, 0.4, 0.3], [1.5, 0.2, 0.2], [0.6, 0.35, 0.3]]) {
      const big = M.freightDoorAny(c, { id: 'b', kind: 'box', dims: d }).ok, small = M.freightDoorAny(c, { id: 's', kind: 'box', dims: d.map(v => v * 0.8) }).ok;
      ok(!big || small, k + ': ' + d.join('x') + ' passes, so 80 % of it passes');
    }
    // a door too small refused: the same card with its doors halved refuses the crate it took
    const sm = clone(c); sm.id = k + '-small';
    for (const d of sm.doors) d.rects = d.rects.map(r => [r[0] * 0.5, r[1] * 0.5]);
    const crate = { id: 'crate', kind: 'crate', dims: [0.8, 0.6, 0.5] };
    if (M.freightDoorAny(c, crate).ok) ok(!M.freightDoorAny(sm, crate).ok, k + ': the crate it takes is refused through doors half the size');
  }
  ok(M.freightDoorAny(K.cub, { id: 'crate', kind: 'crate', dims: [0.8, 0.6, 0.5] }).ok, 'the Cub takes a parts crate through its door');
  // an upright drum goes in upright or not at all
  const drum = { id: 'drum', kind: 'drum', kg: 200, dims: [0.58, 0.58, 0.88] };
  for (const k of holds) { const r = M.freightDoorAny(K[k], drum); ok(!r.ok || r.how === 'straight', k + ': a drum goes in upright (' + (r.ok ? 'it does' : 'it does not') + ')'); }
  {
    // a door wide but low: the drum would pass laid down, so upright it must be refused
    const low = clone(K.c172); low.id = 'c172-low';
    for (const d of low.doors) d.rects = [[1.2, 0.70]];
    ok(!M.freightDoorAny(low, drum).ok, 'a drum is not tipped to pass a low door');
    const r = M.freightPack(K.c172, [drum], { seatsOut: [1, 2, 3], limits: false });
    ok(r.ok && Math.abs((r.placed[0].at.y1 - r.placed[0].at.y0) - 0.88) < 1e-6, 'a drum is stowed upright');
  }
  // THE STRETCHER: what the geometry says, design by design (room: the hold with every seat but the pilot's out)
  const ST = M.FREIGHT_STRETCHER;
  ok(J(ST.dims) === J([2.0, 0.6, 0.5]) && ST.kind === 'stretcher', 'the stretcher is 2.0 x 0.6 x 0.5 m');
  say('THE STRETCHER (2.0 x 0.6 x 0.5 m, 95 kg): the room inside (every seat but the pilot\'s out, no door asked) and the doors');
  const stv = {};
  for (const k of Object.keys(K)) {
    const c = K[k], out = (c.seats || []).filter(s => s.i > 0).map(s => s.i);
    const room = M.freightPack(c, [ST], { seatsOut: out, doors: false, limits: false }).ok;
    const door = M.freightDoorAny(c, ST).ok;
    let longest = 0;
    for (let L = 200; L >= 50 && !longest; L -= 5) if (M.freightDoorAny(c, { id: 'x', kind: 'long', dims: [L / 100, 0.6, 0.5] }).ok) longest = L / 100;
    stv[k] = { room, door, longest };
    say('  ' + k.padEnd(6) + 'room ' + (room ? 'yes' : 'no') + ' · through a door ' + (door ? 'yes' : 'no') + ' · the longest 0.6 x 0.5 m item a door takes: ' + (longest ? longest.toFixed(2) + ' m' : 'none'));
  }
  ok(!stv.cub.room && !stv.cub.door, 'the stretcher does not fit the Cub (no room behind the pilot, and no door takes it)');
  ok(stv.c172.room, 'the C172\'s hold has the room for the stretcher (the seats out)');
  ok(!stv.c172.door, 'GEOMETRY: no door of the C172 takes the rigid 2.0 m stretcher (its doors swing in ' + stv.c172.longest + ' m of that section): reported, not a fit');
  ok(Object.keys(K).every(k => !stv[k].door), 'no validated design takes the 2.0 m stretcher through a door (the medevac needs a cargo door or a folding stretcher)');

  // ==== THE PACKER =============================================================================================
  const inside = (c, p) => M.freightHoldFits(c, p.at);
  const overl = (a, b) => a.x0 < b.x1 - 1e-6 && b.x0 < a.x1 - 1e-6 && a.y0 < b.y1 - 1e-6 && b.y0 < a.y1 - 1e-6 && a.z0 < b.z1 - 1e-6 && b.z0 < a.z1 - 1e-6;
  function packChecks(k, c, items, opts, tag) {
    const r = M.freightPack(c, items, opts);
    const its = M.freightSplit(items);
    ok(r.placed.length + r.unplaced.length === its.length, tag + ': every item placed or reported');
    ok(r.placed.every(p => inside(c, p)), tag + ': every placed item inside the hold');
    const obst = M.freightObstacles(c, M.freightSeats(c, opts));
    ok(r.placed.every((p, i) => !r.placed.some((q, j) => j !== i && overl(p.at, q.at)) && !obst.some(o => overl(p.at, o))), tag + ': no item through another, a seat or an occupant');
    ok(r.placed.every(p => p.on ? (() => { const s = r.placed.find(q => q.id === p.on); return s && s.stack && Math.abs(s.at.y1 - p.at.y0) < 1e-6 && p.at.x0 >= s.at.x0 - 1e-6 && p.at.x1 <= s.at.x1 + 1e-6 && p.at.z0 >= s.at.z0 - 1e-6 && p.at.z1 <= s.at.z1 + 1e-6; })()
                                  : Math.abs(p.at.y0 - M.freightRestY(c, p.at.x0, p.at.x1)) < 1e-6), tag + ': each on the floor or wholly on a stackable item');
    ok(opts.doors === false || r.placed.every(p => p.door && M.freightDoorAny(c, its.find(i => i.id === p.id)).ok), tag + ': each through a door');
    // the CG the report states = the moments recomputed
    const occ = M.CONTRACT_FIT.occKg, seats = M.freightSeats(c, opts);
    let kg = c.mass.base.kg, mx = c.mass.base.kg * c.mass.base.x;
    for (const s of seats) if (s.occ && s.i > 0) { kg += occ; mx += occ * s.x; }
    for (const p of r.placed) { kg += p.kg; mx += p.kg * (p.at.x0 + p.at.x1) / 2; }
    ok(Math.abs(r.report.mass.kg - kg) < 1e-3 && Math.abs(r.report.cg.x - mx / kg) < 1e-3, tag + ': the report\'s mass and CG are the moments');
    return r;
  }
  // deterministic and order-free
  const mixed = M.freightItems({ kg: 45 }, 'goods.tools').concat(M.freightItems({ kg: 30 }, 'goods.mail'), M.freightItems({ kg: 50 }, 'goods.supplies'));
  const p1 = M.freightPack(K.c172, mixed, { pax: 1 }), p2 = M.freightPack(K.c172, mixed, { pax: 1 }), p3 = M.freightPack(K.c172, mixed.slice().reverse(), { pax: 1 });
  ok(J(p1) === J(p2), 'the packer is deterministic');
  const byId = r => J(r.placed.slice().sort((a, b) => (a.id < b.id ? -1 : 1)));
  ok(byId(p1) === byId(p3), 'the packer is order-free (the items handed in reversed: the same placements)');
  packChecks('c172', K.c172, mixed, { pax: 1 }, 'c172 mixed load, one passenger');
  // near the CG: a single box moves the CG less than the same box at the hold's aft end would
  {
    const box = [{ id: 'one', kind: 'box', kg: 20, dims: [0.4, 0.3, 0.25] }];
    for (const k of holds) {
      const r = M.freightPack(K[k], box, {});
      if (!r.ok) continue;
      const H = K[k].hold, aft = H.x0 + H.n * H.dx - 0.2;
      const base = K[k].mass.base, cgAft = (base.kg * base.x + 20 * aft) / (base.kg + 20);
      ok(Math.abs(r.report.cg.x - base.x) <= 0.5 * Math.abs(cgAft - base.x), k + ': a box goes near the CG (moves it ' + (r.report.cg.x - base.x).toFixed(3) + ' m; at the hold\'s aft end ' + (cgAft - base.x).toFixed(3) + ')');
    }
  }
  // REPORTED, NEVER REFUSED: a drum on a floor, a load aft of the range, over the MTOW
  {
    const r = M.freightPack(K.c172, [drum], { seatsOut: [1, 2, 3] });
    ok(r.ok && !r.report.floorOk && r.report.why.some(w => /kg\/m2/.test(w)), 'a 200 kg drum (the seats out): placed, and its floor load over the limit said (' + r.report.why.join('; ') + ')');
    const j = M.freightPack(K.jodel, M.freightItems({ kg: 70 }, 'goods.tools'), {});
    ok(j.ok && !j.report.cg.ok && j.report.cg.side === 'aft' && j.report.why.some(w => /aft of the certified/.test(w)), 'the Jodel with 70 kg of tools, seats in: placed, the CG aft of its range said');
    const h = M.freightPack(K.c172, M.freightItems({ kg: 80 }, 'goods.mail'), { pax: 3 });
    ok(h.placed.length > 0 && !h.report.mass.ok && h.report.why.some(w => /MTOW/.test(w)), 'three passengers and 80 kg of mail in the C172: over the MTOW, said, nothing refused');
    const f = M.freightReport(K.c172, [{ id: 'far', kg: 300, at: { x0: 2.6, x1: 3.0, y0: -0.34, y1: 0, z0: -0.2, z1: 0.2 } }], {});
    ok(!f.ok && !f.cg.ok && f.cg.side === 'aft' && !f.baggage.ok, 'a placement the player made aft of the range: the report says so (never forbidden)');
  }
  // THE GENERATED JOBS: every doer design's proposal places everything within every limit
  let packs = 0, jobs = 0, carry = 0;
  const genSeeds = ['f1', 'f2'];
  for (const seed of genSeeds) for (const p of Object.keys(M.CONTRACT_PROVIDERS)) for (let e = 0; e < 4; e++) for (let i = 0; i < 3; i++) {
    const job = M.contractJob(seed, p, e, i, { rep: (e * 2) % 6 });
    if (!job) continue;
    jobs++;
    ok(M.contractDoers([].concat(...job.stages.map(s => s.subs))).length > 0, job.id + ' (' + seed + '): flyable, the volume included');
    ok(!M.contractValidate(job).length, job.id + ' (' + seed + '): valid with its items (' + M.contractValidate(job).join('; ') + ')');
    for (const s of M.contractSubsOf(job)) {
      if (s.do !== 'carry' || !(s.load.kg > 0)) continue;
      carry++;
      ok(Array.isArray(s.load.items) && s.load.items.length && Math.abs(M.freightKg(s.load.items) - s.load.kg) < 1e-9, job.id + ': its load is its items (' + s.load.kg + ' kg)');
      for (const d of M.contractDoers([s])) {
        const c = M.freightCardOf(DS[d]);
        if (!c) continue;
        const fit = M.freightFits(c, s.load.items, { pax: s.load.pax });
        const r = packChecks(d, c, s.load.items, { pax: s.load.pax, seatsOut: fit.seatsOut }, job.id + ' (' + seed + ') on the ' + d);
        packs++;
        ok(r.ok && r.report.cg.ok && r.report.floorOk && r.report.baggage.ok && r.report.mass.ok,
           job.id + ' (' + seed + ') on the ' + d + ': all placed, the CG in the plaque\'s range, the floors and the placard held, under the MTOW (' + r.report.why.join('; ') + ')');
      }
    }
  }
  ok(packs > 50 && carry > 30, 'the generated jobs were packed (' + jobs + ' jobs, ' + carry + ' loads, ' + packs + ' proposals)');
  say('THE GENERATED JOBS: ' + jobs + ' jobs (seeds ' + genSeeds.join(', ') + '), ' + carry + ' loads, ' + packs + ' proposals by their doer designs - every one all placed, in range, within the floors / the placard / the MTOW');

  // ==== THE GAME: the physical gate, the mark, the stop record ===================================================
  // a sub carrying an item no door takes is no design's
  const strSub = { do: 'carry', from: 'HOME', to: 'w3', load: { kg: 95, pax: 0, items: [M.FREIGHT_STRETCHER] } };
  ok(M.contractDoers([strSub]).length === 0, 'a stretcher job is no validated design\'s (no door takes it)');
  ok(!M.contractCanDo(DS.c172, [strSub]).ok && /door/.test(M.contractCanDo(DS.c172, [strSub]).why), 'the C172 says why: ' + M.contractCanDo(DS.c172, [strSub]).why);
  ok(M.contractDoers([{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 120, pax: 0, items: M.freightItems({ kg: 120 }, 'goods.parts') } }]).includes('c172'), 'the C172 carries the two parts crates');
  // the mark: ✓ / ✗ for the hard no-no's only
  const recOf = (subs, kind) => M.contractNormalise({ id: 't', provider: 'field', kind: kind || 'job', title: 'x', brief: 'x', stages: [{ subs }], pay: { base: 0 } });
  const cubF = [{ slot: 'A', design: DS.cub }], c172F = [{ slot: 'B', design: DS.c172 }], floatF = [{ slot: 'C', design: DS.c172f }];
  const mStr = M.freightMark(recOf([strSub]), cubF.concat(c172F));
  ok(mStr && mStr.ok === false && mStr.door.ok === false && /no door fits/.test(mStr.door.why) && mStr.door.items.includes('stretcher'), 'the mark: a stretcher job -> ✗ "no door fits" (' + (mStr && mStr.door.why) + ')');
  const crSub = { do: 'carry', from: 'HOME', to: 'w3', load: { kg: 120, pax: 0, items: M.freightItems({ kg: 120 }, 'goods.parts') } };
  ok(M.freightMark(recOf([crSub]), c172F).ok === true, 'the mark: the parts crates with a C172 in the fleet -> ✓');
  const wetSub = { do: 'carry', from: 'SEA', to: 'mk_sea', load: { kg: 20, pax: 0, items: M.freightItems({ kg: 20 }, 'goods.mail') } };
  const mWet = M.freightMark(recOf([wetSub]), cubF);
  ok(mWet.ok === false && mWet.gear.ok === false, 'the mark: a water job with a wheeled fleet -> ✗ (gear vs surface: ' + mWet.gear.why + ')');
  ok(M.freightMark(recOf([wetSub]), floatF).ok === true, 'the mark: the same job with the floats C172 -> ✓');
  ok(M.freightMark(recOf([crSub], 'build'), cubF) === null, 'the mark: a build contract carries none');
  ok(M.freightMark(recOf([strSub]), []).ok === null, 'the mark: no airframe known -> no mark (null)');
  ok(M.freightMark(recOf([strSub]), [{ slot: 'X', design: M.careerDesignOfShake ? { id: null, gear: 'wheels', seats: 4 } : null, card: null }]).door.ok !== false, 'the mark: a hold not measured never makes a ✗');
  // the mark on the map's record
  {
    const d0 = M.careerNew({ id: 'fr', seed: 'fr' });
    const f = clone(d0);
    f.fleet = { Cub: { aero: 'HOME' } };
    f.career.airframes = { Cub: { design: 'cub' } };
    const R = M.careerMapRecord(f, null, {});
    ok(R.contracts.length > 0 && R.contracts.every(c => c.kind === 'build' ? c.mark === null : c.mark && 'gear' in c.mark && 'door' in c.mark), 'the map record: every contract but a build carries its mark');
    ok(R.contracts.some(c => c.mark && c.mark.ok === false && c.mark.gear.ok === false), 'the map record: a water job is ✗ for a Cub-only fleet');
    const N = M.careerMapRecord(d0, null, {});
    ok(N.contracts.every(c => c.mark === null || c.mark.ok === null), 'the map record: a fleet with no certificate makes no ✗');
  }
  // THE STOP RECORD'S LOAD IS THE LOADED ITEMS (the typed kilos the fallback)
  {
    const items = M.freightItems({ kg: 45 }, 'goods.tools');
    const S1 = M.careerStopRecord({ how: 'stopped', aero: 'w3', occupants: 1, cargoKg: 3, items });
    ok(S1.load.items && S1.load.items.length === items.length && S1.load.kg === 45, 'the stop record: the loaded items and their kilos (not the typed 3 kg)');
    const S2 = M.careerStopRecord({ how: 'stopped', aero: 'w3', occupants: 2, cargoKg: 34.6 });
    ok(!S2.load.items && S2.load.kg === 35 && S2.load.pax === 1, 'the stop record: no items loaded -> the typed kilos (the fallback)');
    const S3 = M.careerStopRecord({ how: 'stopped', aero: 'w3', occupants: 1, items: [{ id: 'cement', kind: 'bulk', kg: 50, dims: [1, 1, 1] }] });
    ok(S3.load.items.length === 2 && S3.load.items.every(i => i.kind === 'bag'), 'the stop record: a bulk item aboard is its bags');
    // a delivery: every item of the job aboard -> done; one missing -> refused, said
    const sub = { do: 'carry', from: 'HOME', to: 'w3', load: { kg: 45, pax: 0, items } };
    const rec = recOf([sub]);
    const row = { from: 'HOME', to: 'w3', t: 300 };
    const all = M.contractSubOnStop(rec, rec.stages[0].subs[0], {}, (M.careerStopRecord({ row, how: 'stopped', aero: 'w3', occupants: 1, items })), {}, null);
    ok(all.st === 'done', 'a delivery with every item aboard: done');
    const less = M.contractSubOnStop(rec, rec.stages[0].subs[0], {}, (M.careerStopRecord({ row, how: 'stopped', aero: 'w3', occupants: 1, items: items.slice(1) })), {}, null);
    ok(less.st === 'no' && /not aboard/.test(less.why) && less.why.includes(items[0].id), 'a delivery missing an item: refused, the item named (' + less.why + ')');
    const typed = M.contractSubOnStop(rec, rec.stages[0].subs[0], {}, (M.careerStopRecord({ row, how: 'stopped', aero: 'w3', occupants: 1, cargoKg: 45 })), {}, null);
    ok(typed.st === 'done', 'a delivery with no items loaded: the typed kilos stand (the fallback)');
    const T = M.careerTrackedLoad((() => { const d = M.careerNew({ id: 'tl', seed: 'tl' }); const id = d.career.contracts.offered.find(i => { const r = M.careerContract(d, i); return /^job:/.test(i) && r.stages[0].subs[0].do === 'carry' && r.stages[0].subs[0].load.kg > 0; }); return M.careerAccept(d, id).doc || M.careerAccept(d, id); })());
    ok(T && Array.isArray(T.items) && T.items.length && Math.abs(M.freightKg(T.items) - T.kg) < 1e-9, 'the tracked load names its items (what FREIGHT-LOAD packs)');
  }

  // ==== THE LOADING VIEW'S PURE HALF (G2345 FREIGHT-LOAD, 77_freight_load.js) ===================================
  // the hand on the packer's proposal: the snap, the refusals (only the physically impossible, each with its why),
  // out of range ALLOWED, the seats, Propose again, the report = freightReport's, Accept's record, the stop, FREIGHT-STRAP's read
  {
    const P = M.FREIGHT_PACK;
    // THE ORACLE: a placed row stands physically (the packer's own checks, restated)
    const stands = (card, st, r) => {
      const ob = M.freightObstacles(card, M.freightSeats(card, st));
      const others = st.placed.filter(q => q.id !== r.id);
      const sup = r.on ? others.find(q => q.id === r.on) : null;
      const onOk = r.on ? (sup && sup.stack && Math.abs(r.at.y0 - sup.at.y1) < 1e-6 && r.at.x0 >= sup.at.x0 - 1e-9 && r.at.x1 <= sup.at.x1 + 1e-9 && r.at.z0 >= sup.at.z0 - 1e-9 && r.at.z1 <= sup.at.z1 + 1e-9)
        : Math.abs(r.at.y0 - M.freightRestY(card, r.at.x0, r.at.x1)) < 1e-6;
      return M.freightHoldFits(card, r.at) && onOk && !ob.some(q => M.frOverlap(r.at, q)) && !others.some(q => M.frOverlap(r.at, q.at)) && M.freightDoorAny(card, r).ok;
    };
    const onGrid = (H, x0) => Math.abs((x0 - H.x0) / P.step - Math.round((x0 - H.x0) / P.step)) < 1e-6;
    const cases = [['cub', M.freightItems({ kg: 120 }, 'goods.parts'), 0], ['cub', M.freightItems({ kg: 60 }, 'goods.mail'), 0],
                   ['jodel', M.freightItems({ kg: 40 }, 'goods.mail'), 0], ['c172', M.freightItems({ kg: 60 }, 'goods.mail'), 1],
                   ['c172', M.freightItems({ kg: 120 }, 'goods.parts'), 0], ['c172f', M.freightItems({ kg: 90 }, 'goods.supplies'), 1]];
    let sweepOk = 0, sweepNo = 0, sweepBad = [], whyless = 0;
    for (const [k, items, pax] of cases) {
      const card = K[k], tag = k + ' ' + items[0].id.replace(/\.\d+$/, '') + ' x' + items.length + (pax ? ' +' + pax : '');
      const st = M.freightLoadNew(card, items, { pax });
      const PK = M.freightPack(card, items, { pax, seatsOut: [] });
      ok(J(st.placed) === J(PK.placed) && st.items.length === M.freightSplit(items).length, tag + ': the view opens on the packer\'s proposal');
      const R = M.freightLoadReport(card, st), R0 = M.freightReport(card, st.placed, { pax, seatsOut: [] });
      ok(Object.keys(R0).every(x => J(R[x]) === J(R0[x])), tag + ': the report is freightReport\'s, key for key');
      ok(J(R.ashore) === J(PK.unplaced.map(u => u.id)), tag + ': what the packer left is on the ground (' + R.ashore.join(', ') + ')');
      // every proposed item asked back to its own middle: the same box (the snap is the packer's grid)
      for (const r of st.placed) {
        if (st.placed.some(q => q.on === r.id)) continue;   // (one with another on top is refused: the stack, below)
        const t = M.freightLoadTarget(card, st, r.id, { x: 0.5 * (r.at.x0 + r.at.x1), z: 0.5 * (r.at.z0 + r.at.z1) });
        ok(t.ok && J(t.row.at) === J(r.at) && t.row.on === r.on, tag + ': ' + r.id + ' dropped where the packer put it stays there (' + (t.why || '') + ')');
      }
      // THE SWEEP: every item to every point of a grid over the hold - every yes stands, on the grid; every no says why
      const H = card.hold;
      for (const it of st.items) for (let x = H.x0 - 0.2; x <= H.x0 + H.n * H.dx + 0.2; x += 0.13) for (let z = -0.7; z <= 0.7; z += 0.11) for (const turn of [false, true]) {
        const t = M.freightLoadTarget(card, st, it.id, { x, z, turn });
        if (t.ok) {
          sweepOk++;
          const st2 = Object.assign({}, st, { placed: st.placed.filter(q => q.id !== it.id).concat([t.row]) });
          if (!stands(card, st2, t.row) || !onGrid(H, t.row.at.x0) || Math.abs(t.row.kg - it.kg) > 1e-9) sweepBad.push(tag + ' ' + it.id + ' @' + x.toFixed(2) + ',' + z.toFixed(2));
        } else { sweepNo++; if (!t.why) whyless++; }
      }
    }
    ok(!sweepBad.length, 'the drag\'s sweep: every target it allows stands (in the hold, on the floor or wholly on a stackable item, clear of seats / occupants / items, through a door) on the stations\' grid' + (sweepBad.length ? ': ' + sweepBad.slice(0, 4).join('; ') : ''));
    ok(sweepOk > 200 && sweepNo > 200 && !whyless, 'the sweep met both answers (' + sweepOk + ' allowed, ' + sweepNo + ' refused), every refusal says why');
    say('THE LOADING VIEW (77_): the sweep - ' + sweepOk + ' targets allowed (each stands), ' + sweepNo + ' refused (each with its why)');
    // THE REFUSALS, BY NAME
    const c172 = K.c172, cub = K.cub, jodel = K.jodel;
    const parcel = M.freightItem({ id: 'parcel', kind: 'box', kg: 8, dims: [0.3, 0.3, 0.3] });
    let st = M.freightLoadNew(c172, M.freightItems({ kg: 60 }, 'goods.mail').concat([parcel]), { pax: 1 });
    const m1 = st.placed.find(p => p.id === 'parcel');
    const rP = M.freightLoadTarget(c172, st, m1.id, { x: c172.seats[0].back - 0.3, z: c172.seats[0].z });
    ok(!rP.ok && /pilot/.test(rP.why), 'refused: into the pilot (' + rP.why + ')');
    const rX = M.freightLoadTarget(c172, st, m1.id, { x: c172.seats[1].back - 0.3, z: c172.seats[1].z });
    ok(!rX.ok && /passenger in seat 1/.test(rX.why), 'refused: into the passenger (' + rX.why + ')');
    const s2 = c172.seats.find(s => s.i === 2);
    const rS = M.freightLoadTarget(c172, st, m1.id, { x: s2.back - 0.25, z: s2.z });
    ok(!rS.ok && /seat 2 is there/.test(rS.why), 'refused: onto an empty seat still in (' + rS.why + ')');
    const out2 = M.freightLoadSeat(c172, st, 2, true);
    ok(out2.ok && J(out2.st.seatsOut) === '[2]', 'an empty seat taken out');
    const rS2 = M.freightLoadTarget(c172, out2.st, m1.id, { x: s2.back - 0.25, z: s2.z });
    ok(rS2.ok && rS2.row.at.x1 > s2.back - 0.5, 'with the seat out, its space takes the item (' + (rS2.why || 'x ' + rS2.row.at.x0 + '-' + rS2.row.at.x1) + ')');
    ok(!M.freightLoadSeat(c172, st, 0, true).ok && /pilot/.test(M.freightLoadSeat(c172, st, 0, true).why), 'the pilot\'s seat stays');
    ok(!M.freightLoadSeat(c172, st, 1, true).ok && /passenger sits/.test(M.freightLoadSeat(c172, st, 1, true).why), 'a passenger\'s seat stays');
    const moved = M.freightLoadMove(c172, out2.st, m1.id, { x: s2.back - 0.25, z: s2.z });
    const back = M.freightLoadSeat(c172, moved.st, 2, false);
    ok(moved.ok && !back.ok && back.why.includes(m1.id), 'a seat does not go back under an item (' + back.why + ')');
    const away = M.freightLoadMove(c172, moved.st, m1.id, { x: 2.8, z: 0 });
    ok(away.ok && M.freightLoadSeat(c172, away.st, 2, false).ok, '...and goes back once the item is moved');
    // the door, the stack, the overhang, the drum
    const big = M.freightItem({ id: 'big', kind: 'crate', kg: 50, dims: [1.4, 1.2, 1.1] });
    const sB = M.freightLoadNew(c172, [big], { pax: 0 });
    const rB = M.freightLoadTarget(c172, sB, 'big', { x: 1.5, z: 0 });
    ok(!sB.placed.length && !rB.ok && /passes no door/.test(rB.why) && M.freightLoadAshore(c172, sB)[0].door === false, 'refused: an item no door takes stays on the ground (' + rB.why + ')');
    const crate = M.freightItem({ id: 'crate', kind: 'crate', kg: 30, dims: [0.6, 0.5, 0.4] }), box = M.freightItem({ id: 'box', kind: 'box', kg: 10, dims: [0.4, 0.3, 0.3] });
    const drum = M.freightItem({ id: 'drum', kind: 'drum', kg: 60, dims: [0.45, 0.45, 0.6] });
    let sC = { v: 1, card: 'c172', pax: 0, seatsOut: [2, 3], items: [crate, box, drum], placed: [] };
    sC = M.freightLoadMove(c172, sC, 'crate', { x: 1.3, z: 0 }).st;
    const onTop = M.freightLoadMove(c172, sC, 'box', { x: 1.3, z: 0 });
    ok(onTop.ok && onTop.row.on === 'crate' && Math.abs(onTop.row.at.y0 - sC.placed[0].at.y1) < 1e-9, 'a box dropped on a crate stands on it (on: ' + onTop.row.on + ')');
    sC = onTop.st;
    const pull = M.freightLoadMove(c172, sC, 'crate', { x: 2.7, z: 0 }), pullG = M.freightLoadUnload(c172, sC, 'crate');
    ok(!pull.ok && /box is on it/.test(pull.why) && !pullG.ok, 'refused: the crate pulled from under the box (' + pull.why + ')');
    const over = M.freightLoadMove(c172, M.freightLoadUnload(c172, sC, 'box').st, 'drum', { x: 1.3, z: 0 });
    ok(over.ok && over.row.on === 'crate', 'the drum stands on the crate (the crate is stackable)' + (over.why ? ': ' + over.why : ''));
    const low = M.freightLoadTarget(c172, Object.assign({}, sC, { placed: sC.placed.filter(p => p.id === 'crate').map(p => Object.assign({}, p, { at: Object.assign({}, p.at, { x0: 2.4, x1: 3.0 }) })) }), 'drum', { x: 2.7, z: 0 });
    ok(!low.ok && /roof is too low|hold closes/.test(low.why), 'refused: the drum on a crate under the tail\'s low roof (' + low.why + ')');
    const onDrum = M.freightLoadTarget(c172, over.st, 'box', { x: over.row.at.x0 + 0.2, z: (over.row.at.z0 + over.row.at.z1) / 2 });
    ok(!onDrum.ok && /nothing goes on the drum/.test(onDrum.why), 'refused: a box on the drum (' + onDrum.why + ')');
    const bigOn = M.freightItem({ id: 'tub', kind: 'box', kg: 10, dims: [0.9, 0.3, 0.6] });
    const sO = Object.assign({}, sC, { items: sC.items.concat([bigOn]), placed: sC.placed.filter(p => p.id === 'crate') });
    const rO = M.freightLoadTarget(c172, sO, 'tub', { x: 1.3, z: 0 });
    ok(!rO.ok && /would not stand|overhangs/.test(rO.why), 'refused: a bigger item on a smaller one (' + rO.why + ')');
    // the snap: a drop between stations lands on the grid; near a wall it slides off it
    const sn = M.freightLoadTarget(c172, sC, 'box', { x: 2.533, z: 0.013 });
    ok(sn.ok && onGrid(c172.hold, sn.row.at.x0) && Math.abs(sn.row.at.z0 / P.zStep - Math.round(sn.row.at.z0 / P.zStep)) < 1e-6, 'the snap: the fore end on the stations\' grid, across on the z step (x0 ' + (sn.row && sn.row.at.x0) + ')');
    const wall = M.freightLoadTarget(c172, sC, 'box', { x: 2.533, z: 0.9 });
    ok(wall.ok && M.freightHoldFits(c172, wall.row.at) && wall.row.at.z1 > 0.2, 'a drop at the wall slides off it into the hold (z ' + (wall.row && wall.row.at.z0 + '-' + wall.row.at.z1) + ')');
    // OUT OF RANGE IS ALLOWED, AND SAID
    let sJ = M.freightLoadNew(jodel, M.freightItems({ kg: 40 }, 'goods.tools'), { pax: 0 });
    let aft = sJ;
    for (const r of sJ.placed.slice()) { const m = M.freightLoadMove(jodel, aft, r.id, { x: 2.0, z: 0 }); if (m.ok) aft = m.st; }
    const rJ = M.freightLoadReport(jodel, aft);
    ok(aft !== sJ && !rJ.cg.ok && rJ.cg.side === 'aft' && rJ.why.some(w => /aft of the certified/.test(w)), 'the Jodel\'s tools moved aft: allowed, the CG reported aft of its range (' + rJ.cg.pct + ' %, ' + rJ.cg.pctRange.join('-') + ')');
    const heavy = M.freightItems({ kg: 260 }, 'goods.parts');
    const sH = M.freightLoadNew(c172, heavy, { pax: 3 });
    const rH = M.freightLoadReport(c172, sH);
    ok(sH.placed.length > 0 && !rH.mass.ok && rH.why.some(w => /over the MTOW/.test(w)), 'three passengers and 260 kg of crates: loaded, over the MTOW said (' + rH.mass.kg + ' of ' + rH.mass.mtow + ')');
    // PROPOSE AGAIN: the packer's answer for the seats as they are
    const pr = M.freightLoadPropose(c172, Object.assign({}, away.st, { seatsOut: [2, 3] }));
    ok(J(pr.placed) === J(M.freightPack(c172, away.st.items, { pax: 1, seatsOut: [2, 3] }).placed) && J(pr.seatsOut) === '[2,3]', 'Propose again = freightPack with the seats as they are');
    const prBad = M.freightLoadNew(c172, away.st.items, { pax: 1, seatsOut: [0, 1, 3] });
    ok(J(prBad.seatsOut) === '[3]', 'only an empty seat can be out (the pilot\'s and the passenger\'s kept: ' + J(prBad.seatsOut) + ')');
    // ACCEPT'S RECORD, THE STOP, FREIGHT-STRAP'S READ
    let d = M.careerNew({ id: 'fl', seed: 'fl' });
    const jid = d.career.contracts.offered.find(i => { const r = M.careerContract(d, i); return /^job:/.test(i) && r.stages[0].subs.some(s => s.load && s.load.items && s.load.items.length); });
    d = M.careerAccept(d, jid).doc; d = M.careerTrack(d, jid).doc;
    d.career.airframes.Ces = { design: 'c172' };
    ok(M.freightLoadCard(d, 'Ces', null) === c172 && M.freightLoadCard(d, 'x', { log: { factory: { design: 'cub' } } }) === cub && M.freightLoadCard(d, 'x', null) === null, 'the card: the career\'s airframe row, a factory envelope, none for an unmeasured build');
    const JB = M.freightLoadJob(d, 'Ces'), TL = M.careerTrackedLoad(d);
    ok(J(JB.items) === J(TL.items) && JB.ctx.contract === jid && JB.ctx.sub === TL.sub && JB.ctx.slot === 'Ces' && !JB.rec, 'the view opens on the tracked contract\'s current stage\'s load (' + jid + ', ' + JB.items.length + ' items)');
    const sv = M.freightLoadNew(c172, JB.items, { pax: JB.pax });
    const before = J(d);
    const A = M.freightLoadAccept(d, c172, sv, JB.ctx);
    ok(A.ok && J(d) === before, 'Accept: a new document, the old one untouched');
    const L = A.doc.career.load;
    ok(L.slot === 'Ces' && L.design === 'c172' && L.contract === jid && L.items.length === sv.placed.length && L.items.every((p, i) => J(p.at) === J(sv.placed[i].at) && p.kg === sv.placed[i].kg)
       && Math.abs(L.kg - M.freightKg(sv.placed)) < 1e-9, 'Accept\'s record: the airframe, the job\'s sub, every item aboard with its box and kilos');
    const N = M.careerNormalise(JSON.parse(J(A.doc)));
    ok(J(N.career.load) === J(L), 'the record survives the career\'s normaliser (a save / load)');
    const FA = M.freightAccepted(A.doc);
    ok(FA && FA.items.every(p => J(p.c) === J([0.5 * (p.at.x0 + p.at.x1), 0.5 * (p.at.y0 + p.at.y1), 0.5 * (p.at.z0 + p.at.z1)].map(v => Math.round(v * 1000) / 1000))) && Math.abs(FA.kg - L.kg) < 1e-9,
       'freightAccepted (FREIGHT-STRAP\'s read): each item\'s centre and kilos in the card\'s frame');
    ok(J(M.freightAccepted(M.freightLoadRecord(c172, sv, JB.ctx)).items) === J(FA.items) && M.freightAccepted(d) === null, 'freightAccepted reads the sandbox\'s record the same way; none accepted -> null');
    const RT = M.freightLoadFromRecord(c172, L);
    ok(J(RT.placed.map(p => [p.id, p.at, p.on])) === J(sv.placed.map(p => [p.id, p.at, p.on || null])) && RT.items.length === sv.items.length, 'reopened on the accepted record: the same placement');
    ok(M.freightLoadJob(A.doc, 'Ces').rec === A.doc.career.load && !M.freightLoadJob(A.doc, 'Cub').rec, 'the view reopens on the accepted placement for the same airframe only');
    const SI = M.freightStopItems(A.doc, 'Ces');
    const stop = M.careerStopRecord({ how: 'stopped', aero: 'HOME', occupants: 1, cargoKg: 999, items: SI });
    ok(SI && J(stop.load.items.map(i => i.id)) === J(L.items.map(i => i.id)) && Math.abs(stop.load.kg - L.kg) < 1e-9 && M.freightStopItems(A.doc, 'Cub') === null,
       'the stop record\'s load IS the accepted items (not the typed 999 kg); another airframe\'s stop carries none');
    ok(M.freightLoadSettle(A.doc) === A.doc, 'the accepted load stays aboard while its sub is open');
    const dn = JSON.parse(J(A.doc)); dn.career.contracts.live[jid].subs[L.sub] = true;
    ok(!M.freightLoadSettle(dn).career.load && dn.career.load, 'delivered (its sub done): the load leaves the record');
    const ab = M.careerAbandon ? M.careerAbandon(A.doc, jid).doc : null;
    ok(!ab || !M.freightLoadSettle(ab).career.load, 'its contract abandoned: the load leaves the record');
    // an item left on the ground is named in the record and is not in the stop's load
    const g1 = M.freightLoadUnload(c172, sv, sv.placed[0].id).st;
    const A2 = M.freightLoadAccept(d, c172, g1, JB.ctx).doc;
    ok(A2.career.load.ashore.length === 1 && A2.career.load.ashore[0].id === sv.placed[0].id && !M.freightStopItems(A2, 'Ces').some(i => i.id === sv.placed[0].id),
       'an item left on the ground: named in the record, not in the stop\'s load');
    say('  Accept: ' + jid + ' on the C172 - ' + L.items.length + ' items, ' + L.kg + ' kg, CG ' + L.cg.pct + ' % MAC' + (L.ok ? ' (within every limit)' : ' · ' + L.why.join('; ')));
  }

  // ==== THE STRAP (G2400 FREIGHT-STRAP) ========================================================================
  {
    const C = mut && mut.core ? coreOf(mut.core) : CORE;
    const D = STRAP_DEFS, W0 = STRAP_WORLD, HOME = W0.aerodromes.find(a => a.id === 'HOME') || W0.aerodromes[0];
    const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-9 : e) * Math.max(1, Math.abs(a), Math.abs(b));
    const occKg = CORE.GEN_RULES.occupantKg;
    say('THE STRAP (G2400: the accepted load as point masses on the build that flies, strapped)');
    // the rings' shares: the kilos, and the point (their centroid) - inside the box the rings span
    const sh = M.freightStrapShares(D.cub, 1.2, 0.3, 0.1, 50);
    const shm = sh.reduce((a, s) => a + s[1], 0), shx = sh.reduce((a, s) => a + s[1] * D.cub.nodes[s[0]].p[0], 0) / shm,
          shy = sh.reduce((a, s) => a + s[1] * D.cub.nodes[s[0]].p[1], 0) / shm, shz = sh.reduce((a, s) => a + s[1] * D.cub.nodes[s[0]].p[2], 0) / shm;
    ok(sh.length === 8 && near(shm, 50) && near(shx, 1.2) && near(shy, 0.3) && near(shz, 0.1), 'a point mass on the rings: eight nodes, its kilos, its centroid the point (1.2, 0.3, 0.1 on the Cub)');
    // THE FRAME'S OWN RULES: a passenger = the build with that seat filled; the allowance = the build with none
    const samePos = (a, b) => a.nodes.length === b.nodes.length && a.nodes.every((nd, i) => nd.p.every((v, j) => v === b.nodes[i].p[j]));
    const massRule = (a, b, list) => { const dm = new Float64Array(a.nodes.length); for (const [i, kg] of list) dm[i] += kg; let w = 0; a.nodes.forEach((nd, i) => { w = Math.max(w, Math.abs(nd.m + dm[i] - b.nodes[i].m)); }); return w; };
    const rules = [['the Cub\'s rear seat filled', D.cub, D.cubPax, M.freightStrapSeatBill(D.cub, 1, occKg)],
                   ['the Cub with no baggage allowance', D.cub, D.cubNoBag, M.freightStrapBaggage(D.cub, -D.cub.spec.baggage)],
                   ['the C172\'s co-pilot\'s seat empty', D.c172, D.c172Solo, M.freightStrapSeatBill(D.c172, 1, -occKg)]];
    for (const [nm, a, b, list] of rules) {
      const sp = samePos(a, b), w = sp ? massRule(a, b, list) : NaN, dmT = list.reduce((x, q) => x + q[1], 0), dmB = b.nodes.reduce((x, q) => x + q.m, 0) - a.nodes.reduce((x, q) => x + q.m, 0);
      // (the allowance also sizes the gauged structure through the design gross, so the no-allowance build differs off the
      // cargo rings too: its row holds the rings the allowance is billed on, and their kilos)
      if (/baggage/.test(nm)) {
        // ...so it is held to the frame's own LEDGER: the cargo section (61_ sec('cargo'): the allowance + the bay's kilos)
        const Lc = a.parts.ledger && a.parts.ledger.cargo, mT = list.reduce((x, q) => x + q[1] * a.nodes[q[0]].p[0], 0);
        ok(Lc && !(a.spec.cargoKg > 0) && near(dmT, -Lc.mass, 1e-12) && near(mT, -Lc.mx, 1e-9),
           nm + ': 78_ takes the allowance off exactly as the frame billed it (its ledger\'s cargo section: ' + (Lc ? Lc.mass + ' kg, ' + Lc.mx.toFixed(4) + ' kg.m' : 'none') + '; 78_: ' + dmT.toFixed(1) + ' kg, ' + mT.toFixed(4) + ' kg.m)');
        continue;
      }
      ok(sp && w < 1e-9 && near(dmT, dmB, 1e-9), nm + ': 78_\'s copy of the frame\'s rule = the frame\'s own build, node for node (worst ' + (sp ? w.toExponential(1) : 'the lattice moved') + ' kg, ' + dmT.toFixed(1) + ' kg)');
    }
    // THE LOADS: the Cub's 120 kg of crated parts; the C172's 60 kg of mail + a passenger (the build's co-pilot is that
    // passenger); the C172's 120 kg of crates with nobody beside the pilot (the co-pilot gives their 80 kg back)
    const CASES = [['cub', M.freightItems({ kg: 120 }, 'goods.parts'), 0, 'the Cub, 120 kg of crated parts'],
                   ['c172', M.freightItems({ kg: 60 }, 'goods.mail'), 1, 'the C172, 60 kg of mail + a passenger'],
                   ['c172', M.freightItems({ kg: 120 }, 'goods.parts'), 0, 'the C172, 120 kg of crates, nobody beside the pilot']];
    for (const [k, its, pax, nm] of CASES) {
      const card = K[k], def = D[k];
      const st = M.freightLoadNew(card, its, { pax });
      const rec = M.freightLoadRecord(card, st, { slot: 'S' });
      const A = M.freightAccepted(rec);
      const R = M.freightStrapAdds(def, A, { card });
      if (!ok(R && R.adds.length > 0 && A.items.length > 0, nm + ': masses to put aboard (' + (A ? A.items.length : 0) + ' items aboard)')) continue;
      // the items: their kilos, their centroids; the report's item moments
      let mx = 0, worst = 0;
      for (const it of R.items) {
        const s2 = M.freightStrapShares(def, it.g[0], it.g[1], it.g[2], it.kg), m2 = s2.reduce((a, q) => a + q[1], 0);
        const c2 = [0, 1, 2].map(j => s2.reduce((a, q) => a + q[1] * def.nodes[q[0]].p[j], 0) / m2);
        worst = Math.max(worst, Math.abs(m2 - it.kg), ...c2.map((v, j) => Math.abs(v - it.g[j])));
        mx += it.kg * it.g[0];
      }
      const repMx = st.placed.reduce((a, q) => a + q.kg * 0.5 * (q.at.x0 + q.at.x1), 0);
      ok(worst < 1e-9 && near(mx, repMx, 1e-6), nm + ': each item\'s kilos and centre on the rings; the items\' x-moment = the report\'s (' + repMx.toFixed(3) + ' kg.m)');
      const seatKg = R.seats.reduce((a, q) => a + q.kg, 0);
      ok(near(R.kg, M.freightKg(st.placed)) && near(R.dm, R.kg + seatKg - R.baggageOff, 1e-9) && R.baggageOff === def.spec.baggage,
         nm + ': the adds = the items ' + R.kg + ' kg + the passengers ' + seatKg + ' kg - the baggage allowance ' + R.baggageOff + ' kg');
      if (k === 'c172' && pax === 1) ok(R.seats.every(q => q.kg === 0), nm + ': the job\'s passenger IS the build\'s co-pilot (seat 1): no seat changes');
      if (k === 'c172' && pax === 0) ok(R.seats[1] && R.seats[1].kg === -occKg, nm + ': the build\'s co-pilot gives their ' + occKg + ' kg back (the job seats nobody there)');
      // THE SIM
      const sim = C.makeSim(def, W0);
      sim.reset(0);
      const M0 = sim.totalM, c0 = sim.cgPos(), m0 = Float64Array.from(sim.m);
      const I = q => { const c = q.cgPos(); let v = 0; for (let i = 0; i < q.n; i++) { const dx = q.p[i * 3] - c[0], dy = q.p[i * 3 + 1] - c[1]; v += q.m[i] * (dx * dx + dy * dy); } return v; };
      const I0 = I(sim);
      sim.setFreight(R.adds);
      const add = new Float64Array(sim.n); for (const [i, kg] of R.adds) add[i] += kg;
      const massesOk = q => def.nodes.every((nd, i) => Object.is(q.m[i], add[i] !== 0 ? Math.max(0.5, nd.m + add[i]) : nd.m));
      ok(massesOk(sim) && near(sim.totalM, M0 + R.dm, 1e-12), nm + ': aboard - every loaded node the def\'s mass + its add, totalM ' + M0.toFixed(1) + ' -> ' + sim.totalM.toFixed(1) + ' kg');
      sim.reset(0);
      ok(massesOk(sim) && near(sim.totalM, M0 + R.dm, 1e-12), nm + ': a reset keeps the load aboard');
      // (a reset seats the wheels by the weight aboard - a few mm: the unloaded sums are taken at THESE positions)
      const P = sim.p, cu = [0, 1, 2].map(j => { let s2 = 0; for (let i = 0; i < sim.n; i++) s2 += m0[i] * P[i * 3 + j]; return s2 / M0; });
      const mo = [0, 0, 0]; for (const [i, kg] of R.adds) for (let j = 0; j < 3; j++) mo[j] += kg * P[i * 3 + j];
      const c1 = sim.cgPos(), want = [0, 1, 2].map(j => (M0 * cu[j] + mo[j]) / (M0 + R.dm));
      ok([0, 1, 2].every(j => Math.abs(c1[j] - want[j]) < 1e-9), nm + ': the CG moves by the adds\' moments (x ' + (c1[0] - cu[0] >= 0 ? '+' : '') + ((c1[0] - cu[0]) * 1000).toFixed(1) + ' mm, '
         + ((c1[0] - cu[0]) / card.mass.mac[1] * 100).toFixed(1) + ' % MAC)');
      // the pitch inertia: what the shares add about the new CG + the build's own shift (the parallel-axis sum), exactly
      const I1 = I(sim);
      let I0b = 0; for (let i = 0; i < sim.n; i++) { const dx = P[i * 3] - cu[0], dy = P[i * 3 + 1] - cu[1]; I0b += m0[i] * (dx * dx + dy * dy); }
      let Iw = 0; for (let i = 0; i < sim.n; i++) { const dx = P[i * 3] - c1[0], dy = P[i * 3 + 1] - c1[1]; Iw += (sim.m[i] - m0[i]) * (dx * dx + dy * dy); }
      const Ishift = M0 * ((cu[0] - c1[0]) ** 2 + (cu[1] - c1[1]) ** 2);
      ok(near(I1, I0b + Ishift + Iw, 1e-9) && I1 !== I0b, nm + ': the pitch inertia ' + I0b.toFixed(1) + ' -> ' + I1.toFixed(1) + ' kg.m2 (the shares about the new CG + the build\'s shift)');
      // DELIVERY: nothing aboard - every node the def's own number, totalM the reset's sum
      sim.setFreight(null);
      let sum = 0; for (const nd of def.nodes) sum += nd.m;
      ok(def.nodes.every((nd, i) => Object.is(sim.m[i], nd.m)) && Object.is(sim.totalM, sum) && sim.freight() === null, nm + ': delivered (null) - every node back to the def\'s own mass, to the bit');
      // THE STRAPS
      const G = M.freightStrapMesh(A.items, card, null);
      const SK = M.freightStrapStacks(A.items);
      ok(G.count.stacks === SK.length && G.count.bands === 2 * SK.length && G.count.buckles === SK.length && G.count.anchors === 4 * SK.length && G.count.boxes === A.items.length,
         nm + ': ' + SK.length + ' stack(s): two straps, a buckle and four anchors each');
      const inside = (q, b) => q[0] > b.x0 + 1e-6 && q[0] < b.x1 - 1e-6 && q[1] > b.y0 + 1e-6 && q[1] < b.y1 - 1e-6 && q[2] > b.z0 + 1e-6 && q[2] < b.z1 - 1e-6;
      // each stack's own straps against its own boxes (a strap between two stacks packed hard together is reported)
      let through = 0, touch = 0;
      for (const S2 of SK) {
        const own = A.items.filter(p2 => S2.ids.includes(p2.id)), oth = A.items.filter(p2 => !S2.ids.includes(p2.id));
        const G2 = M.freightStrapMesh(own, card, () => true);
        // every vertex, and every strap run sampled along its length (a run's ends can stand clear while it cuts through)
        const pts = [];
        for (const g of [G2.straps, G2.metal]) for (let v = 0; v < g.pos.length; v += 3) pts.push([g.pos[v], g.pos[v + 1], g.pos[v + 2]]);
        for (const bd of M.freightStrapBands(S2, card).bands) {
          const to3 = q => bd.along === 'x' ? [q[0], q[1], bd.at] : [bd.at, q[1], q[0]];
          for (let k = 0; k + 1 < bd.pts.length; k++) { const a3 = to3(bd.pts[k]), b3 = to3(bd.pts[k + 1]); for (let u = 0; u <= 40; u++) pts.push([0, 1, 2].map(j => a3[j] + (b3[j] - a3[j]) * u / 40)); }
        }
        for (const q of pts) {
          if (own.some(p2 => inside(q, p2.at))) through++;
          if (oth.some(p2 => inside(q, p2.at))) touch++;
        }
      }
      ok(!through, nm + ': no strap, buckle or anchor inside the load it ties' + (touch ? ' (' + touch + ' strap vertices meet a neighbouring stack packed against it)' : ''));
      const H = card.hold, x1H = H.x0 + H.n * H.dx;
      const feetOk = SK.every(S2 => M.freightStrapBands(S2, card).anchors.every(a => { const xa = Math.max(H.x0, Math.min(x1H, a.c[0])), fy = M.freightRestY(card, xa - 0.01, xa + 0.01);
        return a.c[0] >= H.x0 - 0.1 && a.c[0] <= x1H + 0.1 && fy != null && Math.abs(a.c[1] - a.h[1] - fy) < 0.015; }));
      ok(feetOk, nm + ': every foot anchored on the hold\'s floor, within its length');
      const idxOk = [G.straps, G.metal].concat(Object.values(G.boxes)).every(g => g.idx.length % 3 === 0 && g.idx.every(i => i < g.pos.length / 3) && g.nrm.length === g.pos.length);
      ok(idxOk, nm + ': the drawing\'s arrays (triangles, normals) whole');
      say('  ' + nm + ': ' + R.adds.length + ' nodes, +' + R.dm.toFixed(1) + ' kg (items ' + R.kg + ', passengers ' + seatKg + ', baggage allowance -' + R.baggageOff + '), CG x ' + ((c1[0] - c0[0]) * 1000).toFixed(1) + ' mm, pitch inertia +' + (I1 - I0).toFixed(1) + ' kg.m2; '
          + SK.length + ' stack(s), ' + (G.straps.idx.length / 3) + ' strap + ' + (G.metal.idx.length / 3) + ' metal triangles');
      // BYTE-IDENTITY (the Cub): never asked, asked with nothing, loaded then unloaded - one flight, to the bit
      if (k === 'cub') {
        const fly = pre => { const q = C.makeSim(def, W0); pre(q); q.reset(0); C.placeAtAerodrome(q, HOME); q.ctl.thr = 0.7; q.ctl.brake = 0;
                             for (let j = 0; j < 240; j++) q.step(1 / 60); return [fnv(q.p, q.v), q]; };
        const [h0] = fly(() => {}), [h1] = fly(q => { q.setFreight(null); q.setFreight([]); }), [h2] = fly(q => { q.setFreight(R.adds); q.setFreight(null); });
        const [hL, sL] = fly(q => q.setFreight(R.adds));
        ok(h0 === h1 && h0 === h2, 'BYTE-IDENTITY: nothing aboard (never asked; asked with nothing; loaded then unloaded) flies the same 4 s to the bit (' + h0.toString(16) + ')');
        ok(hL !== h0 && sL.freight().length === R.adds.length, 'loaded, it flies another aeroplane (' + hL.toString(16) + ')');
        // THE BURN KEEPS A LOAD ON A TANK'S NODE
        const fi = def.nodes.findIndex(nd => nd.mFuel > 0);
        if (fi >= 0) {
          const q = C.makeSim(def, W0); q.setFreight([[fi, 5]]); q.reset(0); C.placeAtAerodrome(q, HOME); q.ctl.thr = 1; q.ctl.brake = 1;
          for (let j = 0; j < 120; j++) q.step(1 / 60);
          const nd = def.nodes[fi], dry = Math.max(0.5, nd.m - nd.mFuel), want2 = dry + nd.mFuel * q.fuel.frac + 5;
          ok(q.fuel.frac < 1 && near(q.m[fi], want2, 1e-12), 'the burn keeps a load on a tank\'s node (' + (q.m[fi]).toFixed(4) + ' kg = dry + fuel x ' + q.fuel.frac.toFixed(5) + ' + 5)');
        }
      }
    }
    // THE LIMITS SAID, NEVER REFUSED (the user, FREIGHT §2: "shown red but allowed"): over the MTOW and the CG out of the
    // certified range each carry their flag (the brief's warn line, the logbook row) - and the masses go aboard all the same
    {
      const sH = M.freightLoadNew(K.c172, M.freightItems({ kg: 260 }, 'goods.parts'), { pax: 3 });
      const AH = M.freightAccepted(M.freightLoadRecord(K.c172, sH, { slot: 'S' })), fH = M.freightStrapFlags(AH, K.c172);
      ok(fH.some(f => f.k === 'mtow' && f.kg === Math.ceil(AH.mass - K.c172.mass.mtow) && /over MTOW by \d+ kg/.test(f.say)) && !!M.freightStrapAdds(D.c172, AH, { card: K.c172 }),
         'over the MTOW (the C172, three passengers + 260 kg of crates): flagged "' + (fH.find(f => f.k === 'mtow') || {}).say + '" - and it still goes aboard');
      let sJ = M.freightLoadNew(K.jodel, M.freightItems({ kg: 40 }, 'goods.tools'), { pax: 0 });
      for (const r of sJ.placed.slice()) { const m = M.freightLoadMove(K.jodel, sJ, r.id, { x: 2.0, z: 0 }); if (m.ok) sJ = m.st; }
      const AJ = M.freightAccepted(M.freightLoadRecord(K.jodel, sJ, { slot: 'S' })), fJ = M.freightStrapFlags(AJ, K.jodel);
      ok(fJ.some(f => f.k === 'cg' && f.side === 'aft') && !fJ.some(f => f.k === 'mtow') && !!M.freightStrapAdds(D.jodel, AJ, { card: K.jodel }),
         'the CG aft of the certified range (the Jodel\'s tools moved aft): flagged "' + (fJ.find(f => f.k === 'cg') || {}).say + '" - and it still goes aboard');
      const sOk = M.freightLoadNew(K.c172, M.freightItems({ kg: 60 }, 'goods.mail'), { pax: 1 });
      const AOk = M.freightAccepted(M.freightLoadRecord(K.c172, sOk, { slot: 'S' }));
      ok(M.freightStrapFlags(AOk, K.c172).length === 0 && AOk.ok, 'within every limit (the C172\'s mail + a passenger): no flag');
      const appSrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
      ok(/FST\.flags = R && got && typeof freightStrapFlags === 'function' \? freightStrapFlags\(got\.A, got\.card\) : \[\];/.test(appSrc) && /function fsWarnSync\(\)/.test(appSrc)
         && /r\.load = \{ items: FA\.items, kg: Math\.round\(FA\.dm \* 10\) \/ 10, flags: FA\.flags \};/.test(appSrc),
         'the page says the flags on the brief before take-off (fsWarnSync) and writes them on the logbook row (r.load.flags)');
    }
    // NOTHING ACCEPTED: no masses, no drawing
    ok(M.freightStrapAdds(D.cub, null) === null && M.freightStrapAdds(D.cub, M.freightAccepted({ career: {} })) === null, 'nothing accepted: no masses (the sim is never asked)');
    const G0 = M.freightStrapMesh([], K.cub, null);
    ok(G0.straps.pos.length === 0 && G0.metal.pos.length === 0 && !Object.keys(G0.boxes).length, 'nothing accepted: nothing to draw');
    // THE AEROPLANE IT RIDES: the slot and the design
    const rc = M.freightLoadRecord(K.cub, M.freightLoadNew(K.cub, M.freightItems({ kg: 60 }, 'goods.parts'), { pax: 0 }), { slot: 'Cub1' });
    ok(!!M.freightStrapFor(rc, 'Cub1', 'cub') && !M.freightStrapFor(rc, 'Ces', 'cub') && !M.freightStrapFor(rc, 'Cub1', 'c172'), 'the load rides its own airframe (the slot) and the hold it was placed in (the design) only');
    // THE LOOK: the loading view and the strapped load wear the same table
    const flSrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'freight_load.js'), 'utf8');
    ok(/freightLookKey\(it\)/.test(flSrc) && /FREIGHT_LOOK\.col/.test(flSrc) && M.freightLookKey({ id: 'leg2.parts.1', kind: 'crate' }) === M.FREIGHT_LOOK.goods['goods.parts'],
       'the loading view reads 78_\'s look table; a later leg\'s item finds its goods');
    // THE STOP: a 3-stop chain on the C172, flown stop by stop
    {
      let pick = null;
      for (const sd of ['strap', 'wire3', 'dev', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const dd = M.careerNew({ id: 'fs', seed: sd });
        const id = dd.career.contracts.offered.find(i => { const r = M.careerContract(dd, i); if (!r || r.kind !== 'job' || r.stages.length !== 2) return false;
          const L1 = r.stages[0].subs[0].load, L2 = r.stages[1].subs[0].load, S = M.contractStops(r);
          return S.length === 3 && new Set(S.map(x => x.at)).size === 3 && L1 && L2 && (L1.items || []).length && (L2.items || []).length && !r.stages[0].subs[0].when && !r.stages[1].subs[0].when
            && M.freightFits(K.c172, L1.items, { pax: L1.pax || 0 }).ok && M.freightFits(K.c172, L2.items, { pax: L2.pax || 0 }).ok; });
        if (id) { pick = { d: dd, id }; break; }
      }
      if (ok(!!pick, 'the stop: a 3-stop chain with items on both legs, on offer')) {
        let d = M.careerTrack(M.careerAccept(pick.d, pick.id).doc, pick.id).doc;
        d.career.airframes.Ces = { design: 'c172' };
        const rec = M.careerContract(d, pick.id), [A1, B1, C1] = M.contractStops(rec).map(x => x.at);
        const J1 = M.freightLoadJob(d, 'Ces');
        d = M.freightLoadAccept(d, K.c172, M.freightLoadNew(K.c172, J1.items, { pax: J1.pax }), J1.ctx).doc;
        const st = (aero, from) => M.careerStopRecord({ how: 'stopped', aero, occupants: 1 + (J1.pax || 0), items: M.freightStopItems(d, 'Ces'), row: { from, to: aero, t: 600 }, hour: 12 });
        let r = M.careerOnStop(d, st(A1, 'HOME')); d = M.freightLoadSettle(r.doc);
        ok(r.ok && d.career.load && d.career.load.stage === 0, 'the stop: loaded at ' + A1 + ', the first leg\'s load still aboard');
        r = M.careerOnStop(d, st(B1, A1)); d = M.freightLoadSettle(r.doc);
        ok(r.ok && !d.career.load, 'the stop: delivered at ' + B1 + ' - the first leg\'s items leave (the record dropped)');
        const N1 = M.freightStrapNext(d, 'Ces', K.c172);
        const J2 = M.freightLoadJob(N1.doc, 'Ces');
        ok(N1.how === 'proposed' && N1.rec && N1.rec.stage === 1 && N1.rec.items.length > 0
           && J(N1.rec.items.map(q => q.at)) === J(M.freightLoadNew(K.c172, J2.items, { pax: J2.pax }).placed.map(q => q.at)) && !!M.freightStrapAdds(D.c172, M.freightAccepted(N1.doc), { card: K.c172 }),
           'the stop: the second leg\'s items arrive placed by the packer\'s proposal (' + (N1.rec ? N1.rec.items.length : 0) + ' items, accepted for stage 2) and weigh on the aeroplane');
        // the player's own placement for that stage is kept
        const mv = N1.rec ? M.freightLoadMove(K.c172, M.freightLoadFromRecord(K.c172, N1.rec), N1.rec.items[0].id, { x: N1.rec.items[0].at.x0 + 0.3, z: 0 }) : { ok: false };
        const own = N1.rec ? M.freightLoadAccept(d, K.c172, mv.ok ? mv.st : M.freightLoadFromRecord(K.c172, N1.rec), J2.ctx).doc : null;
        const N2 = own ? M.freightStrapNext(own, 'Ces', K.c172) : null;
        ok(!!N2 && N2.how === 'kept' && N2.doc === own, 'the stop: the player\'s own placement for that stage is kept, not proposed over');
        d = N1.doc;
        r = M.careerOnStop(d, M.careerStopRecord({ how: 'stopped', aero: C1, occupants: 1 + (J2.pax || 0), items: M.freightStopItems(d, 'Ces'), row: { from: B1, to: C1, t: 600 }, hour: 12 }));
        d = M.freightLoadSettle(r.doc);
        const N3 = M.freightStrapNext(d, 'Ces', K.c172);
        ok(r.ok && r.doc.career.contracts.done.some(x => x.id === pick.id) && !d.career.load && N3.how === 'none' && !M.freightStrapFor(N3.doc, 'Ces', 'c172'),
           'the stop: delivered at ' + C1 + ', the job done - nothing aboard after it');
        say('  the stop: ' + pick.id + ' ' + A1 + ' -> ' + B1 + ' -> ' + C1 + ' on the C172: ' + J1.items.length + ' items to ' + B1 + ', ' + J2.items.length + ' proposed for ' + C1);
      }
    }
  }

  // ==== PURITY =================================================================================================
  {
    for (const f of ['76', '77', '78']) {
      const s = M.__src[f].replace(/\/\/.*$/gm, '');
      for (const w of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'THREE', 'Math.random', 'Date.now', 'new Date', 'performance', 'fetch('])
        ok(!new RegExp('\\b' + w.replace(/[.(]/g, m => '\\' + m)).test(s), f + '_: pure (no ' + w + ')');
    }
  }
  return { fails: fails.slice(), checks };
}

const base = run(null);
if (!SELF) {
  const out = REPORT.slice();
  if (SHOW) {
    for (const k of Object.keys(DS0)) {
      const c = MEAS.cards[k];
      if (!c.hold) continue;
      const load = k === 'cub' ? CORE.freightItems({ kg: 80 }, 'goods.tools') : k === 'jodel' ? CORE.freightItems({ kg: 40 }, 'goods.mail')
        : CORE.freightItems({ kg: 120 }, 'goods.parts');
      const fit = CORE.freightFits(c, load, { pax: 0 });
      const r = CORE.freightPack(c, load, { pax: 0, seatsOut: fit.seatsOut });
      out.push('  ' + k + ' packs ' + load.map(i => i.id).join(' ') + (fit.seatsOut.length ? ' (seats ' + fit.seatsOut.join(', ') + ' out)' : '') + ': ' +
        r.placed.map(p => p.id + ' x ' + p.at.x0 + '-' + p.at.x1 + ' y ' + p.at.y0 + ' z ' + p.at.z0 + (p.on ? ' on ' + p.on : '') + ' [' + p.space + ', ' + p.how + ' through ' + p.door + ']').join('; ') +
        ' -> CG ' + r.report.cg.pct + ' % MAC (' + r.report.cg.pctRange.join('-') + '), ' + r.report.mass.kg + ' kg of ' + r.report.mass.mtow + (r.report.why.length ? ' · ' + r.report.why.join('; ') : ''));
    }
  }
  if (SHOW || EVID) for (const l of out) console.log(l);
  if (EVID) {
    const dir = path.join(ROOT, 'reports', 'evidence', 'FREIGHT-MODEL');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'freight.txt'), out.join('\n') + '\n\n' + base.checks + ' checks\nGATE FREIGHT: ' + (base.fails.length ? 'FAIL' : 'PASS') + '\n');
  }
  for (const f of base.fails) console.log('  - ' + f);
  console.log(base.checks + ' checks' + (MEAS.cached ? ' (cards from the measurement cache)' : ' (cards measured)'));
  console.log('GATE FREIGHT: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}

// ---- negative verification: each rule broken in its own source -------------------------------------------------
const sub = (a, b) => s => { if (s.indexOf(a) < 0) throw new Error('selftest anchor gone: ' + a); return s.split(a).join(b); };
const BREAKS = [
  ['a card drifts from its mesh', { s76: s => s.replace(/("mtow":)(\d)/, '$19') }],
  ['the hole test lets anything through', { s76: sub('const holeOk = (X, Y) => rects.some(r => X <= r[0] + 1e-9 && Y <= r[1] + 1e-9);', 'const holeOk = () => true;') }],
  ['the swing-in forgets the room inside', { s76: sub('          if (Yx > hMax + 1e-9 || Zx > frRoomW(H, st, Yx) + 1e-9) continue;', '') }],
  ['an upright drum is laid down', { s76: sub("  drum:      { rigid: true,  stack: false, upright: true },", "  drum:      { rigid: true,  stack: false },") }],
  ['bulk is not split', { s76: sub('    if (!FREIGHT_KINDS[it.kind].split) { out.push(it); continue; }', '    { out.push(it); continue; }') }],
  ['a split loses the remainder', { s76: sub('k < n - 1 ? each : frR3(kg - each * (n - 1))', 'each') }],
  ['the goods lose their dims', { s76: sub("  'goods.parts':    { kind: 'crate', unit: 60, dims: [0.80, 0.60, 0.50] },", '') }],
  ['the packer walks through the seats', { s76: sub('if (obst.some(q => frOverlap(b, q)) || placed.some(q => frOverlap(b, q.at))) continue;', 'if (placed.some(q => frOverlap(b, q.at))) continue;') }],
  ['the packer ignores the hold\'s walls', { s76: sub('              if (!freightHoldFits(card, b)) continue;', '              if (!(b.x1 <= frHoldX1(H) + 1e-9)) continue;') }],
  ['the packer floats an item', { s76: sub("          if (rest != null) ys.push({ y: rest, on: null, level: 0 });", "          if (rest != null) ys.push({ y: rest + 0.1, on: null, level: 0 });") }],
  ['the packer depends on the order handed in', { s76: sub("const order = items.slice().sort(", "const order = items.slice(); [].sort(") }],
  ['the packer forgets the CG', { s76: sub('    const xt = ((kg + it.kg) * cgWant - mx) / Math.max(1e-9, it.kg);', '    const xt = 99;') }],
  ['the report\'s CG skips the cargo', { s76: sub('  for (const p of placed) { const xc = 0.5 * (p.at.x0 + p.at.x1); kg += p.kg; mx += p.kg * xc; }', '') }],
  ['the floor limit is never checked', { s76: sub('ok: !S || kgM2 <= S.kgM2 + 1e-9', 'ok: true') }],
  ['a limit refuses instead of reporting', { s76: sub("    for (const strict of (o.limits === false ? [false] : [true, false])) {", "    for (const strict of [true]) {") }],
  ['the fit ignores the limits (any room is a doer)', { s76: sub('      if (a.ok && a.report.ok) { r = { ok: true, seatsOut: out, why: \'\', room: true }; break; }', '      if (a.ok) { r = { ok: true, seatsOut: out, why: \'\', room: true }; break; }') }],
  ['the jobs carry no items', { s73: sub('      withItems();\n      subs = [[', '      subs = [[') }],
  ['the physical gate ignores the volume', { s73: sub('      if (card) { const v = freightFits(card, L.items, { pax: L.pax || 0 }); if (!v.ok) return no(v.why); }', '') }],
  ['the mark ignores the doors', { s76: sub("      const one = cards.some(c => !freightNoDoor(c, items).length);", "      const one = true;") }],
  ['the mark marks a build contract', { s76: sub("  if (!rec || rec.kind === 'build') return null;", '  if (!rec) return null;') }],
  ['the stop record ignores the items', { s75: sub("  const items = Array.isArray(o.items) && o.items.length && typeof freightItem === 'function' ? freightSplit(o.items) : null;", '  const items = null;') }],
  ['a delivery missing an item is paid', { s73: sub('    if (miss) return !miss.length && (aboard.pax || 0) >= (L.pax || 0);', '    if (miss) return (aboard.pax || 0) >= (L.pax || 0);') }],
  ['the model reaches for the clock', { s76: s => s + '\nfunction frNow() { return Date.now(); }\n' }],
  // G2345 (FREIGHT-LOAD): the hand's rules
  ['the hand walks through a seat', { s77: sub("  if (ob) return flNo(", "  if (false) return flNo(") }],
  ['the hand walks through another item', { s77: sub("  if (hit) return flNo('the ' + hit.id + ' is there');", '') }],
  ['the hand floats an item', { s77: sub('  let y0 = floorY, sup = null;', '  let y0 = floorY + 0.05, sup = null;') }],
  ['the hand ignores the door', { s77: sub("  if (!door.ok) return flNo(", "  if (false) return flNo(") }],
  ['the hand ignores the walls', { s77: sub("  z0 = flR3(Math.max(-zm, Math.min(z0, zm - lz)));", '') }],
  ['an item pulled from under another', { s77: sub("  if (atop.length) return flNo(atop.map(p => p.id).join(', ') + ' is on it: move that first');", '') }],
  ['an overhang stands', { s77: sub("    if (fp.x0 < sup.at.x0 - 1e-9 || fp.x1 > sup.at.x1 + 1e-9) return flNo(", "    if (false) return flNo(") }],
  ['something goes on a drum', { s77: sub("    if (!sup.stack) return flNo(", "    if (false) return flNo(") }],
  ['the snap leaves the stations', { s77: sub('  let x0 = H.x0 + Math.round((wx - lx / 2 - H.x0) / P.step) * P.step;', '  let x0 = wx - lx / 2;') }],
  ['out of range is refused', { s77: sub("  const placed = st.placed.filter(p => p.id !== id).concat([t.row]);", "  const placed = st.placed.filter(p => p.id !== id).concat([t.row]);\n  if (!freightReport(card, placed, { pax: st.pax, seatsOut: st.seatsOut }).ok) return Object.assign({ st }, flNo('out of range'));") }],
  ['the report is not freightReport\'s', { s77: sub("  const R = freightReport(card, st.placed, { pax: st.pax, seatsOut: st.seatsOut });", "  const R = freightReport(card, st.placed, { pax: 0, seatsOut: [] });") }],
  ['a passenger\'s seat taken out', { s77: sub("    if (s.i <= st.pax) return { ok: false, why: 'a passenger sits in seat ' + s.i, st };", '') }],
  ['a seat goes back under an item', { s77: sub("  if (hit) return { ok: false, why: 'the ' + hit.id + ' stands where seat ' + s.i + ' goes: move it first', st };", '') }],
  ['Propose again keeps the hand\'s placement', { s77: sub('  return freightLoadNew(card, st.items, { pax: st.pax, seatsOut: st.seatsOut });', '  return st;') }],
  ['Accept loses the boxes', { s77: sub('at: Object.assign({}, p.at), on: p.on || null, space: p.space || null', 'on: p.on || null, space: p.space || null') }],
  ['the stop ignores the accepted load', { s77: sub("  if (!A || (slot != null && A.slot != null && A.slot !== String(slot))) return null;", '  return null;') }],
  ['a delivered load stays aboard', { s77: sub("  if (open) return doc;", '  return doc;') }],
  ['the hand reaches for the clock', { s77: s => s + '\nfunction flNow() { return Date.now(); }\n' }],
  // G2400 (FREIGHT-STRAP): the strapped load's rules (78_) and the solver's door (30_, in the built core)
  ['an item\'s weight shared without its lateral', { s78: sub('      out.push([L, kg * w * wl * (1 - wz)], [Rn, kg * w * wl * wz]);', '      out.push([L, kg * w * wl * 0.5], [Rn, kg * w * wl * 0.5]);') }],
  ['the items weigh nothing', { s78: sub('    for (const s of freightStrapShares(def, g[0], g[1], g[2], p.kg)) raw.push(s);', '') }],
  ['the lever is the nearer ring', { s78: sub('    wa = (x - ST[r0].x) / Math.max(1e-9, ST[r1].x - ST[r0].x);', '    wa = 0;') }],
  ['a passenger weighs nothing', { s78: sub('    if (d) fsSeatBill(def, s.i, d * occKg, raw);', '    if (d > 9) fsSeatBill(def, s.i, d * occKg, raw);') }],
  ['the build\'s passenger stays aboard', { s78: sub('    const d = (s.job ? 1 : 0) - (s.build ? 1 : 0);', '    const d = Math.max(0, (s.job ? 1 : 0) - (s.build ? 1 : 0));') }],
  ['the seat rule is not the frame\'s', { s78: sub('  const wa = Math.max(0, Math.min(1, (x - x0) / Math.max(1e-6, x1 - x0)));', '  const wa = 0.5;') }],
  ['the baggage allowance stays aboard', { s78: sub('  const bag = items.length && def.spec.baggage > 0 ? def.spec.baggage : 0;', '  const bag = 0;') }],
  ['a strap through the load', { s78: sub('  const topX = b.y1 + g, topZ', '  const topX = b.y1 - 0.05, topZ') }],
  ['an anchor off the floor', { s78: sub('  const anchors = [{ c: [ax0 - ha, fx0 + hy, zm]', '  const anchors = [{ c: [ax0 - ha, fx0 + hy + 0.04, zm]') }],
  ['the next stage arrives unplaced', { s78: sub("  if (!J.items.length) return { doc, rec: null, how: 'none', why: J.why };", "  return { doc, rec: null, how: 'none', why: J.why };") }],
  ['the player\'s placement proposed over', { s78: sub("  if (J.rec) return { doc, rec: J.rec, how: 'kept', why: '' };", '') }],
  ['another airframe\'s load flown', { s78: sub('  if (slot != null && A.slot != null && A.slot !== String(slot)) return null;', '') }],
  ['an over-MTOW load flies silently', { s78: sub('  if (acc.mass > K.mtow + 1e-6) {', '  if (false) {') }],
  ['a CG out of range flies silently', { s78: sub('    if (side) out.push(', '    if (false) out.push(') }],
  ['the strap reaches for the clock',{ s78: s => s + '\nfunction fsNow() { return Date.now(); }\n' }],
  ['a reset drops the load', { core: sub('m[i] = FRX && FRX[i] !== 0 ? Math.max(0.5, nd.m + FRX[i]) : nd.m; r[i] = nd.r;', 'm[i] = nd.m; r[i] = nd.r;') }],
  ['a load taken off leaves a trace', { core: sub('      m[i] = b !== 0 ? Math.max(0.5, base + b) : base;', '      m[i] = m[i] - a + b;') }],
  ['the burn drops the load', { core: sub('FRX ? DRY0[k] + FUEL0[k] * f2 + FRX[FUEL_IDX[k]] : DRY0[k] + FUEL0[k] * f2', 'DRY0[k] + FUEL0[k] * f2') }],
];
let bad = 0;
// --only-break=<regex>: the doctored rules whose names match (a re-check of a few in a short window); every rule by default
const ONLY_BREAK = (process.argv.find(a => a.startsWith('--only-break=')) || '').slice(13);
for (const [name, mut] of BREAKS) {
  if (ONLY_BREAK && !new RegExp(ONLY_BREAK, 'i').test(name)) continue;
  let r;
  try { r = run(mut); } catch (e) { r = { fails: [e.message], checks: 0 }; }
  const caught = r.fails.length > base.fails.length;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name + (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE FREIGHT selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS') + ' - ' + (BREAKS.length - bad) + ' of ' + BREAKS.length + ' doctored rules caught');
process.exit(bad ? 1 : 0);
