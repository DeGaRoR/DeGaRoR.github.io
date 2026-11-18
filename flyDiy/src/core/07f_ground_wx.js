// ============================================================
// THE GROUND'S WEATHER LADDER (SNOW-MUD, 2026-11-15) - a strip whose ground follows the weather. Pure, no state.
// The user (15 Nov): "should we have a mud ladder? Dirt to firm mud to soft mud as a function of the weather? ... these 3
// options, and maybe an auto setting? So we can keep doing tests, or mark a runway as always dry or muddy, and let some
// evolve with the weather" - and then: the grass the same (dry, wet, auto), the sand the same (wet sand is FIRMER and a
// little darker, "don't make the sand go too dark ... the aprons around should probably follow the same trend"), the
// bumps with it ("the more soft the mud is, the deeper the ruts and the holes should be, and they sort of firm up
// slightly with the dry setting"), and the projections' colour with it ("unify these two systems"). Snow and gravel do
// not climb a ladder (the user: snow follows other rules, gravel hardly changes).
//
// THE SETTING IS THE LOOK. A strip (a pad, a road) already says what it feels by its look (27_premises RUNWAY_LOOKS,
// "feel follows the look"); the fixed rungs were looks already (dirt, mud (firm), mud (soft); grass; sand) and the new
// ones join them: grass (wet), sand (wet), and three WEATHER looks - dirt (weather), grass (weather), sand (weather) -
// whose feel is a WEATHER CODE (20, 21, 22), resolved where the ground is read (20_world surface) against the soil's
// water (DIRT-DUST's SOIL_WET - the 96 h bucket of the plan's rain, sun and wind: pure in the instant, so the page,
// the physics worker and a gate read the same rung with no message). A fixed look is what it always was.
//
// THE RUNGS (the soil's water S, 0 bone dry .. 1 saturated, of the look's own class; SOIL_WET's mud = smoothstep(0.55,
// 0.9, S) of the dirt):
//   dirt (weather)   mud < 0.25: DIRT (GRAVEL 6, dirt's friction as the 'dirt' look)   < 0.75: MUD_FIRM 11   else MUD_SOFT 12
//   grass (weather)  S < 0.5: GRASS 0      else GRASS_WET 13 (Raymer table 17.1: wet grass rolls 0.08, brakes 0.2)
//   sand (weather)   S < 0.45: SAND 7      else SAND_WET 14 (wet sand is firm: ESTIMATE, a packed beach rolls ~0.05)
// so the storm days (12 mm/h at the front) make a dirt strip soft mud by the evening (GATE SOILWET: every storm day is
// mud by 17:00), firm mud the next day, and dirt again after two or three dry days; turf holds its water longer; sand
// drains at once.
//
// THE REST FOLLOWS THE RUNG (one law, three readers):
//   wear   the bumps' WORN relief (STRIP_MICRO: the ruts, the lanes, the holes, the lumps) x WEAR[rung]: soft mud cuts
//          them deeper, dry dirt firms them a little; wet sand firms, dry sand is the record's (the softer the ground,
//          the deeper what the traffic wears into it). A STEP per rung, not a slope: the drawn ribbon is re-draped when
//          the rung moves (a few times a game day), never every frame
//   tint   the drawn ground's colour: darker with its water (dirt 30 %, grass 12 %, sand 10 % at saturation - the sand
//          a shade, its aprons and the island around it do not darken), and the dirt toward the mud's own colour by its
//          mud (the pavement's 'mud' class) - and the dust or the mud a wheel throws takes THAT colour (app.js)
//   gloss  wet ground shines a little (the pavement's wet film, uWet.x)
// A DEV OVERRIDE (world.setGround: 'dry' | 'firm' | 'soft' | null - the soil's water held at forceDry / Firm / Soft for
// every reader: the wheels, the drawn ground, the dust and the puddles; replayed on the physics worker as setDay is)
// and the fixed looks keep every test on a known rung. GATE MUDLADDER.
// ============================================================
var GROUND_WX = (function () {
  'use strict';
  const WX = Object.freeze({ DIRT: 20, GRASS: 21, SAND: 22 });
  const DRY = Object.freeze({ 20: 6, 21: 0, 22: 7 });            // a weather code's dry rung (and what a tree, a plot, a map reads)
  const CLS = Object.freeze({ 20: 'dirt', 21: 'grass', 22: 'sand' });
  const GRASS_WET = 13, SAND_WET = 14;
  // THE LADDER'S NUMBERS (A0 for the user, 16 Nov: "every new world setting must be editable in the WORLD EDITOR"): one flat
  // table, the shipped values in LADDER_DEF, the live ones set by ladder(o) - the world rail's 'weather ladder' rows (world_rail.js
  // RUNWAYS), kept in THE LOOK and its export, reset there; the physics worker's world takes the same through
  // world.setGroundLadder (sim_link / sim_host replay it, as setDay). `version` counts the sets (the drawn strips re-apply on it).
  //   mudFirm / mudSoft     the dirt's mud (SOIL_WET's smoothstep(0.55, 0.9, S)) at which firm mud, then soft mud, begins
  //   grassWet / sandWet    the class's water S at which grass, sand are wet
  //   wear*                 the worn relief's scale (the ruts, the holes, the lumps) on that rung
  //   dark*                 the drawn ground's darkening at saturation (x S);  film*: its wet film (x S)
  //   forceDry / Firm / Soft  the dev override's held water (every class) - the rungs' middles
  const LADDER_DEF = Object.freeze({ mudFirm: 0.25, mudSoft: 0.75, grassWet: 0.5, sandWet: 0.45,
    wearDirtDry: 0.85, wearDirtFirm: 1.0, wearDirtSoft: 1.3, wearSandWet: 0.9,
    darkDirt: 0.30, darkGrass: 0.12, darkSand: 0.10, filmDirt: 0.35, filmGrass: 0.10, filmSand: 0.20,
    forceDry: 0.05, forceFirm: 0.70, forceSoft: 0.95 });
  // each knob's range (the rail's sliders and the setter's clamp)
  const LADDER_RANGE = Object.freeze({ mudFirm: [0, 1], mudSoft: [0, 1], grassWet: [0, 1], sandWet: [0, 1],
    wearDirtDry: [0.3, 2], wearDirtFirm: [0.3, 2], wearDirtSoft: [0.3, 2.5], wearSandWet: [0.3, 2],
    darkDirt: [0, 0.6], darkGrass: [0, 0.4], darkSand: [0, 0.4], filmDirt: [0, 1], filmGrass: [0, 1], filmSand: [0, 1],
    forceDry: [0, 1], forceFirm: [0, 1], forceSoft: [0, 1] });
  const LD = Object.assign({}, LADDER_DEF);
  let version = 0;
  // ladder() -> a copy of the live numbers; ladder(o) sets the keys it names (clamped to their range; mudSoft never under
  // mudFirm); ladder(null) -> the shipped ones. Returns the live copy
  function ladder(o) {
    if (o === null) { Object.assign(LD, LADDER_DEF); version++; }
    else if (o && typeof o === 'object') {
      let n = 0;
      for (const k in o) { if (!(k in LADDER_DEF)) continue; const v = +o[k]; if (!Number.isFinite(v)) continue; const R = LADDER_RANGE[k], c = v < R[0] ? R[0] : v > R[1] ? R[1] : v; if (LD[k] !== c) { LD[k] = c; n++; } }
      if (LD.mudSoft < LD.mudFirm) { LD.mudSoft = LD.mudFirm; n++; }
      if (n) version++;
    }
    return Object.assign({}, LD);
  }
  // the live numbers in the shapes state() reads (views over LD, not copies)
  const STEP = { get mudFirm() { return LD.mudFirm; }, get mudSoft() { return LD.mudSoft; }, get grassWet() { return LD.grassWet; }, get sandWet() { return LD.sandWet; } };
  const WEAR = { get dirt() { return [LD.wearDirtDry, LD.wearDirtFirm, LD.wearDirtSoft]; }, grass: [1, 1], get sand() { return [1, LD.wearSandWet]; } };
  const DARK = { get dirt() { return LD.darkDirt; }, get grass() { return LD.darkGrass; }, get sand() { return LD.darkSand; } };
  const FILM = { get dirt() { return LD.filmDirt; }, get grass() { return LD.filmGrass; }, get sand() { return LD.filmSand; } };
  const FORCE = Object.freeze({ dry: 'forceDry', firm: 'forceFirm', soft: 'forceSoft' });   // a level -> its knob
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const is = c => c === 20 || c === 21 || c === 22;
  const lookClass = c => CLS[c] || null;
  const dryOf = c => (is(c) ? DRY[c] : c);
  // the class's water and mud off a SOIL_WET result (or { cls }): S of the class, the dirt's mud
  function water(code, R) {
    if (!R || !R.cls) return 0;
    const k = CLS[code] || 'dirt';
    return clamp01(R.cls[k] != null ? +R.cls[k] : +R.wet || 0);
  }
  // state(code, R, out?) -> { code (the rung's SURFACE code), rung (0 dry, 1 firm / wet, 2 soft), cls, S, mud, wear,
  // dark (the colour multiplier's darkening), film } - for a weather code; a fixed code answers itself, rung 0
  const ST = { code: 0, rung: 0, cls: null, S: 0, mud: 0, wear: 1, dark: 0, film: 0 };
  function state(code, R, out) {
    const o = out || ST;
    o.cls = CLS[code] || null; o.S = 0; o.mud = 0; o.wear = 1; o.dark = 0; o.film = 0; o.rung = 0; o.code = code;
    if (!is(code)) return o;
    const S = water(code, R); o.S = S;
    if (code === WX.DIRT) {
      const m = smooth(0.55, 0.9, S); o.mud = m;
      o.rung = m < STEP.mudFirm ? 0 : m < STEP.mudSoft ? 1 : 2;
      o.code = o.rung === 0 ? DRY[code] : o.rung === 1 ? 11 : 12;
      o.wear = o.rung === 0 ? LD.wearDirtDry : o.rung === 1 ? LD.wearDirtFirm : LD.wearDirtSoft;
    } else if (code === WX.GRASS) {
      o.rung = S < STEP.grassWet ? 0 : 1; o.code = o.rung ? GRASS_WET : DRY[code]; o.wear = 1;
    } else {
      o.rung = S < STEP.sandWet ? 0 : 1; o.code = o.rung ? SAND_WET : DRY[code]; o.wear = o.rung ? LD.wearSandWet : 1;
    }
    o.dark = DARK[o.cls] * S; o.film = FILM[o.cls] * S;
    return o;
  }
  const resolve = (code, R) => (is(code) ? state(code, R).code : code);
  // a forced soil (the dev override): SOIL_WET's shape, every class at the rung's water
  const FR = { wet: 0, cls: { dirt: 0, sand: 0, gravel: 0, grass: 0 }, rainNow: 0, hoursDry: 96, mud: 0, src: 'ground' };
  function forced(level) {
    const k = FORCE[level]; if (k === undefined) return null; const v = LD[k];
    FR.wet = v; for (const k in FR.cls) FR.cls[k] = v; FR.mud = smooth(0.55, 0.9, v); FR.hoursDry = v > 0.3 ? 0 : 96;
    return FR;
  }
  return { WX, DRY, CLS, GRASS_WET, SAND_WET, STEP, WEAR, DARK, FILM, FORCE, LADDER_DEF, LADDER_RANGE, ladder, get version() { return version; },
    is, lookClass, dryOf, water, state, resolve, forced };
})();
