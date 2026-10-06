#!/usr/bin/env node
// GATE HONESTY - the B3a playtest items that are node-measurable (G700, 2026-09-26, the Jolene playtest:
// futureDesigns/PLAYTEST-2026-09-26.md §1.5). The page-side halves (the HUD's AGL and IAS, "fly on") are in
// GATE UISMOKE, which runs the app block; this gate holds what the core decides.
//
//   node tools/_honesty_check.js              -> "GATE HONESTY: PASS|FAIL"
//
// STAND   "The plane is dropped from very high on reload." The stand a deeper shell walks out of the
//         door (standFor) carried no `elev`, so placeAtStand fell back to the RUNWAY's elevation: on
//         Jolene HOME's apron is 30.60 m and the strip's centre 31.68 - a 1.08 m drop at every roll-out
//         from the works. And on a sloped stand the one elevation read at the stand's point leaves the
//         wheels off (East Point: 6.4 cm up) or in (Skyline: 2.7 cm down) their own ground. The game's
//         placement is replayed here exactly as applyRoute runs it (stance, standFor with the world's
//         ground, placeAtStand, seatOnGround) on EVERY Jolene stand, the declared one and the two walked
//         depths where the site has a shed, for two builds (a taildragger and a tricycle): the lowest
//         contact must start 1 cm +- 1 cm over the ground under it, and the settle that follows (3 s,
//         brakes on) must be the gear's own sag, not a fall. The pre-G700 placement is replayed as the
//         negative: it must be caught.
// WIRING  applyRoute hands standFor the world's ground and calls seatOnGround (source-scanned: the page
//         is where the two meet).
// GARAGE  the orphan `materials & extras` bar: the overflow counts only rows it would show.
// DAY     "Light breeze by default, so the sea is not fully calm": the game's day (DAY_CLOCK GAME_DAY)
//         and the weather card's default preset agree, and it is not calm.
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
for (const k of Object.keys(C)) global[k] = C[k];

let checks = 0;
const fails = [];
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); return !!cond; };

// ---- STAND ------------------------------------------------------------------
{
  const IN = require(path.join(T, 'island_node.js'));
  const boot = IN.islandBoot('jolene');
  ok(!!boot, 'the Jolene island is not in the manifest');
  const world = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot),
    premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
  const gH = (x, z) => world.terrainH(x, z);
  const builds = [['stock', 'build_v9_stock_2026-09-15.json'], ['cessnaMetal', 'build_v10_cessnaMetal_2026-09-26.json']];
  // the lowest contact's height over the ground under it (the solver's own contact: node minus radius)
  const clearance = sim => {
    let m = Infinity;
    for (let i = 0; i < sim.n; i++) m = Math.min(m, sim.p[i * 3 + 1] - sim.r[i] - gH(sim.p[i * 3], sim.p[i * 3 + 2]));
    return m;
  };
  const settle = sim => {
    const cg0 = sim.cgPos()[1];
    let vDown = 0;
    for (let f = 0; f < 180; f++) { sim.ctl.brake = 0.6; sim.step(1 / 60); vDown = Math.min(vDown, sim.cgVel()[1]); }
    return { drop: cg0 - sim.cgPos()[1], vDown };
  };
  const tasRest = [];
  let nStands = 0, worstC = 0, worstDrop = 0, caught = 0, oldCases = 0;
  for (const [bn, bf] of builds) {
    const j = JSON.parse(fs.readFileSync(path.join(T, 'fixtures', bf), 'utf8'));
    const def = C.buildGen(C.genMigrateSpec(j.spec || j));
    for (const a of world.aerodromes) {
      const site = C.siteOf(a.id);
      if (!site || !site.stand) continue;
      const cases = [['declared', null]];
      if (site.hangar) for (const HD of [20, 26]) cases.push(['walked HD ' + HD, { HD }]);
      for (const [nm, dims] of cases) {
        // THE GAME'S PATH (app.js applyRoute)
        const sim = C.makeSim(def, world); sim.reset(0); sim.stance();
        const st = dims ? C.standFor(site, dims, gH) : site.stand;
        ok(st.elev !== undefined, `${a.id} ${nm}: the stand carries no elev (placeAtStand would read the runway's)`);
        C.placeAtStand(sim, a, st);
        C.seatOnGround(sim, gH, def.refs);
        const c0 = clearance(sim), s = settle(sim);
        nStands++;
        worstC = Math.max(worstC, Math.abs(c0 - 0.01)); worstDrop = Math.max(worstDrop, s.drop);
        ok(Math.abs(c0 - 0.01) <= 0.01, `${bn} ${a.id} ${nm}: the lowest contact starts ${(c0 * 100).toFixed(1)} cm over its ground (want 1 +- 1)`);
        // TAS AT REST IN CALM (the playtest's "IAS 20 standing" was a pause mid-taxi): 3 s more on the brakes, the
        // solver's true airspeed must be 0 on the dial (under 0.5 km/h) - the world here has the core's calm day
        if (a.id === 'HOME' && !dims) {
          for (let f = 0; f < 180; f++) { sim.ctl.brake = 0.6; sim.step(1 / 60); }
          const tas = (sim.out.V || 0) * 3.6;
          tasRest.push(bn + ' ' + tas.toFixed(2));
          ok(tas < 0.5, `${bn} at rest on HOME's stand in calm air: TAS ${tas.toFixed(2)} km/h (want 0)`);
        }
        ok(s.drop < 0.12 && s.vDown > -0.9, `${bn} ${a.id} ${nm}: the settle is a fall, not the gear's sag (${(s.drop * 100).toFixed(1)} cm, ${s.vDown.toFixed(2)} m/s down)`);
        // THE NEGATIVE: the pre-G700 placement (the walked stand without elev; no seat) must be caught
        if (dims) {
          oldCases++;
          const s2 = C.makeSim(def, world); s2.reset(0); s2.stance();
          const w = C.standFor(site, dims);
          C.placeAtStand(s2, a, { x: w.x, z: w.z, hdg: w.hdg });
          const c1 = clearance(s2);
          if (Math.abs(c1 - 0.01) > 0.01) caught++;
        }
      }
    }
  }
  ok(nStands >= 10, `only ${nStands} stand placements measured (Jolene has 5 stand sites, HOME with a shed)`);
  ok(oldCases > 0 && caught === oldCases, `the pre-G700 walked-stand placement was not caught (${caught}/${oldCases})`);
  console.log(`STAND: ${nStands} placements (2 builds x every Jolene stand, HOME walked to HD 20 and 26): the lowest contact ` +
    `within ${(worstC * 100).toFixed(1)} cm of 1 cm clear, settle <= ${(worstDrop * 100).toFixed(1)} cm (the sag); ` +
    `the pre-G700 walked placement caught ${caught}/${oldCases}; TAS at rest in calm ${tasRest.join(', ')} km/h`);
}

// ---- WIRING -----------------------------------------------------------------
{
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const i0 = app.indexOf('function applyRoute()'), i1 = app.indexOf('let pilotChoice', i0);
  const ar = i0 >= 0 && i1 > i0 ? app.slice(i0, i1) : '';
  ok(ar.length > 0, 'applyRoute is not where the gate expects it');
  ok(/standFor\(st, shedD, stGround\)/.test(ar), 'applyRoute does not hand standFor the world\'s ground');
  ok(/seatOnGround\(sim, stGround, def\.refs\)/.test(ar), 'applyRoute does not seat the wheels on their ground');
  console.log('WIRING: applyRoute reads the walked stand\'s ground and seats the wheels');
}

// ---- DAY --------------------------------------------------------------------
{
  const src = f => fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8');
  const lit = (txt, re) => { const m = re.exec(txt); return m ? m[1] : null; };
  const norm = o => o ? JSON.stringify(Object.keys(o).sort().reduce((q, k) => (q[k] = o[k], q), {})) : null;
  const ev = t => { try { return t ? Function('return (' + t + ');')() : null; } catch (e) { return null; } };
  const game = ev(lit(src('day_clock.js'), /const GAME_WIND = (\{[^}]*\});/));
  const breeze = ev(lit(src('weather_ui.js'), /k: 'breeze'[\s\S]*?wind: (\{[^}]*\})/));
  ok(!!game && game.kts > 0, 'the game\'s day has no wind (GAME_WIND)');
  ok(/GAME_DAY = \{[^}]*wind: GAME_WIND/.test(src('day_clock.js')), 'GAME_DAY does not carry GAME_WIND');
  ok(norm(game) === norm(breeze), `the game's day wind ${norm(game)} is not the weather card's light breeze ${norm(breeze)}`);
  const PM = require(path.join(T, 'pilot_matrix.js'));
  const mw = PM.WEATHERS.breeze && PM.WEATHERS.breeze.dayWind;
  ok(!!mw && game && mw[0] === game.kts && mw[1] === game.dirDeg && mw[2] === game.gust && mw[3] === game.breeze,
     'the pilot matrix\'s `breeze` weather is not the game\'s day');
  ok(/<option value="breeze" selected>/.test(src('body.html')), '#selCond does not open on the day\'s preset (breeze)');
  console.log(`DAY: the game's day blows ${game && game.kts} kt from ${game && game.dirDeg} (the weather card's light breeze, the matrix's \`breeze\`)`);
}

// ---- GARAGE -----------------------------------------------------------------
// The orphan `materials & extras` bar (154024): #edOpts hid only when #cgUi held no `.r` row, and it always
// held 493 - the FINISH view's pools (materials, decals; hidden here by editor.css) - plus one row shown: the
// dims box G439 retired. Measured on the page (headless Chromium, world=none, 2000 x 975): before, the bar at
// 935-975 over that one row; after, `opts-empty`, the inspector to the bottom, the document 975 tall.
{
  const ed = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.css'), 'utf8');
  const pools = (/const OPTS_POOLS = (\[[^\]]*\]);/.exec(ed) || [])[1];
  const P = pools ? Function('return ' + pools)() : [];
  ok(P.length > 0 && P.every(g => new RegExp('#cgUi > details\\[data-g="' + g + '"\\]').test(css)),
     'the overflow\'s pools are the groups editor.css hides there (' + P.join(', ') + ')');
  ok(/wrap\.classList\.toggle\('opts-empty', !optsLoose\(ui\)\)/.test(ed), '#edOpts hides when no row outside the pools is left');
  ok(/const RETIRED_ROWS = \[[^\]]*'dims box'/.test(ed) && /for \(const label of RETIRED_ROWS\)/.test(ed), 'the retired dims box toggle is parked with its pane');
  console.log('GARAGE: the overflow bar counts only rows it would show (pools: ' + P.join(', ') + '; retired: dims box)');
}

if (require.main === module) {
  for (const f of fails) console.log('  FAIL ' + f);
  console.log(`${checks} checks, ${fails.length} failed`);
  console.log('GATE HONESTY: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}
