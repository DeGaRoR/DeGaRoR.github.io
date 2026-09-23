#!/usr/bin/env node
// build.js — assembles all GENERATED files from src/ parts. Never edit outputs by hand.
//   tools/flight_core.js  (node gates require it)
//   ../index.html         (the served page: vendor+fonts+core+viewer+editor inlined,
//                          model/prop payloads as <script src> refs — multi-file
//                          since 2026-09-01; the last single-file build is
//                          archived in ../archiveSingle/, local only)
//   ../dev.html           (no-build dev page: <script src>/<link> refs throughout;
//                          serve it with tools/_serve.js, not file://)
// Ordering authority for core concatenation is MANIFEST.core below.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CORE_DIR = path.join(ROOT, 'src', 'core');
const VIEW_DIR = path.join(ROOT, 'src', 'viewer');
const MODELS_DIR = path.join(ROOT, 'src', 'models');
const PROPS_DIR = path.join(ROOT, 'src', 'props');
const VENDOR_DIR = path.join(ROOT, 'vendor');

const MANIFEST = {
  core: [
    '00_registry.js',
    // THE ATMOSPHERE (G72): pure, no dependencies, and needed by more than the
    // solver — 60_gen_spec synthesises the prop against a density and
    // 64_gen_build quotes stall speeds at one, so it sits in the 00_ band
    // rather than with the world.
    '05_atmos.js',
    // THE SUN AND THE DAY (SKY S1/S2, 2026-09-14): pure almanac and the one
    // day object the world carries; before the world, which makes the day.
    '06_solar.js',
    '07_day.js',
    '08_cloud_field.js',
    // THE CLIMATE (K0, 2026-09-22): the one wind field w(x,y,z,t) - the G72
    // legacy column moved in verbatim, the rich terms, the relief raster;
    // pure, before the world, which composes it.
    '09_climate.js',
    // THE TERRAIN CODEC (W2, 2026-09-14): the quadtree asset's reader, one
    // global; before the world because an island world is built on it.
    '19_terrain_codec.js',
    // THE HAND-WRITTEN FLEET RETIRED 2026-09-05 (user ruling: every vessel is
    // a garage one). The seven fiches (cub, dc3, chinook, c172, jodel, drone,
    // pa18) that stood here, their circuit gates and make_perf are gone; the
    // PA-18 and C172 payloads stay as REFERENCE planes (MANIFEST.models).
    '20_world.js',
    '21_world_hydro.js',
    '22_world_biomes.js',
    '23_world_settle.js',
    '24_world_aero.js',
    // THE SITE (G123): where the base aerodrome's buildings, paving and
    // furniture stand, plus the one world<->shed frame conversion. Reads the
    // HOME record out of 20_world.js and restates nothing, so it has to sit
    // after it; nothing in the solver band depends on it.
    '25_airfield.js',
    // THE FIT-OUT (HANGARS S2): shells, kits, capabilities and the placement
    // engine — pure arithmetic on dims and PROP_REG, no THREE, so GATE HANGAR
    // proves placement in plain node and hangar.js only stands the meshes.
    '26_hangar_fit.js',
    // THE PREMISES (G385): the world editor's record composed over the world
    // - pure, no THREE; makeWorld (20_) reads it at call time through the
    // PREMISES_GEN global, so it only has to be in the bundle; after 25_
    // because its runway records take the airfield's shape.
    '27_premises.js',
    // THE ISLAND (W2, 2026-09-14): a world source from data - the baked
    // quadtree as the ground, the cover grid as the classifier, the canopy
    // grid as the trees' height. makeWorld(seed, { island }) takes it; pure.
    '28_island.js',
    // THE GROUND FIELDS (alpha splatting, 2026-09-20): the micro-variation
    // inside one terrain type - the noise fields, the splat RECIPE, the per-
    // code rows - read by the ground (per fragment) and the vegetation (per
    // instance); JS + the same GLSL as a string; pure.
    '28b_ground_fields.js',
    // THE BIOMES (G454.12): a terrain-type code names a bench mix; the fill walker
    // reads the table the payload ships (TREE_PACK.biomes); pure.
    '28c_biomes.js',
    // THE OBSTACLES (G433): the solid things on the ground as column grids - the
    // world's registry (20_ makes it), the solver's push-out (30_), the viewer
    // stands and takes down the shapes; pure.
    '29_obstacles.js',
    '30_solver.js',
    // THE ELECTRICAL BUS (the panel arc, session 4): pure, read by the
    // cockpit and the gates; after the solver only by kinship
    '31_elec.js',
    // THE FLOAT IN WATER (H1, G382): the hull, its panels and their force
    // law; the frame builds a float from it and the solver runs it
    '32_hydro.js',
    // THE GROUND PATH (G193): a declared pattern graph sampled into a path the
    // pilots follow (fillets, curvature, a STOP); pure, read by 25_'s
    // sitePattern consumers, the two pilots, pattern_vis.js and the gates.
    // THE NAV (G202.1): a GPS-style navigator — waypoints, a flight plan, a
    // direct-to, DTK/XTK/DIS/ETE/CDI and VNAV; pure, read by the pilot's AP
    // box and by the panel to come.
    '38_nav.js',
    '39_ground_path.js',
    '40_autopilot.js',
    // the TEST PILOT (G107): the second autopilot, forked from 40_ — bounded
    // attempts, structured verdicts. Generated builds fly it; the fleet keeps 40_.
    '41_test_pilot.js',
    // THE CROSSWIND LIMIT (G193.2): the plaque's measured crosswind, a ladder
    // of departures on the test pilot; pure, polled by the page, run whole by
    // the gates.
    '42_crosswind.js',
    // THE PILOT (G202): the third pilot — the test pilot's inner loops under a
    // new decision layer (rectangular circuit into wind, planned arrival,
    // accelerate-stop reject, trike rotation, taxi-back with a U-turn, a
    // published status). Generated builds fly it; 41_ stays for A/B.
    '43_pilot.js',
    '44_machine_sheet.js',     // P0.4 (PILOT-ROADMAP): the one sheet the pilot reads the aeroplane from
    '50_model_codec.js',
    '51_prop_codec.js',
    '52_char_codec.js',
    // THE ANIMALS (2026-09-22): a skinned subject with a CLIP LIBRARY and a
    // rigid child — decode only, no three.js, and required by node
    // (tools/animal_lod.js poses the skin with it before it cuts).
    '55_animal_codec.js',
    // the baked trees (W0b): decode only, no three.js — the same file the
    // node gate requires, so the payload has ONE reader
    '53_tree_codec.js',
    // THE DECIMATOR (G411): one self-contained function, pure, no THREE — the
    // pier baker (tools/prop_lod.js) and the parked aeroplanes' far levels
    // (src/viewer/parked.js, in a Worker off its source) both cut with it.
    '54_decimate.js',
    // GARAGE: procedural airframe generator (spec -> loft -> frame -> aero -> skin)
    '60_gen_spec.js',
    // the body's SHAPE, owned in one place: one C1 curve that both the truss
    // and the covering sample. Needs genClamp from 60_; consumed by 61_ and 63_.
    '60b_gen_loft.js',
    // WHERE THE ENERGY LIVES (G97-G101). Needs GEN_RULES from 60_; consumed by
    // 61_, which bills the mass of whatever ends up in these bays. It has to
    // sit between them for that reason and no other.
    '60c_gen_energy.js',
    '61_gen_frame.js',
    '62_gen_aero.js',
    '63_gen_wing.js',
    '64_gen_build.js',
    '65_gen_loadtest.js',
    // THE PLAYER (HANGARS S1): the player's property as one document — its
    // own version and migrator walk beside the spec's (G105: state that is
    // not the aeroplane costs no spec version). References 26_'s default kit
    // list, so it sits after it; app.js owns the localStorage glue.
    '70_player.js',
    '90_node_exports.js',
  ],
  // baked 3D model payloads (tools/model_prep.py baked the PA-18 and C172
  // when they were flyable, tools/ref_prep.py the rest — all REFERENCE
  // planes since the fleet retired 2026-09-05; data, not core):
  // <script src> refs in BOTH pages since 2026-09-01, when the artifact went
  // multi-file (assets externalized) and the single-file form retired to
  // flyDiy/archiveSingle/. The old 100 MiB-per-file push ceiling died with
  // it, and with it the ROOM reason to hold a payload back.
  //
  // THIS LIST IS THE PUBLISH LIST. Everything on it is referenced by the
  // committed, served index.html — so it is also what GATE REF holds against
  // each payload's declared licence. Dropping an aeroplane from the reference
  // set is one line here: the preset stays in refplane.js's table, the panel
  // filters its dropdown against what actually loaded, and the gate reports
  // the difference every run.
  //
  // WHAT IS NOT HERE, AND WHY. Two hard reasons:
  //   DELETED   a22, p68, rv8, sr22 said "SKETCHFAB Standard", which does not
  //             permit redistribution — never shippable, so on 2026-09-01 the
  //             user had them deleted outright (GLBs, payloads, presets,
  //             table rows). GATE REF still fails the build if a non-CC-BY
  //             payload ever lands on this list again.
  //   NO SPEC   draco is Mike Patey's one-off turbine Wilga and nobody has
  //             published its dimensions, so nothing can hold its scale. It
  //             is baked but has no preset either — see refplane.js.
  models: ['pa18_model.js', 'c172_model.js',
    'd112_model.js', 'pio200_model.js', 'c195_model.js',
    'stemme_model.js', 'guepard_model.js',
    // the rest of the CC-BY batch (G142), held back only for ROOM while the
    // artifact was one file; shipped the day the ceiling died.
    'da40_model.js', 'g115_model.js', 'yak18t_model.js',
    'eiii_model.js', 'pa28_model.js'],
  // baked HANGAR PROP packs (generated by tools/prop_prep.py from the declared
  // table in tools/props_table.py - data, not core). One file per editor group;
  // the ORDER is written by the baker into src/props/props_packs.json, so a new
  // group needs no edit here. They ride in the MODELS slot, behind the
  // aeroplanes and behind 51_prop_codec.js, which defines registerPropPack().
  props: (() => { try { return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src', 'props', 'props_packs.json'), 'utf8')); }
    catch (e) { return []; } })(),
  // THE PANEL HARDWARE KIT (the panel arc, session 4c; tools/panel_prep.py
  // from tools/panel_table.py): the switches, knobs, buttons and the key,
  // baked as props into their own packs. They ride in the MODELS slot with
  // the hangar's props, behind 51_prop_codec.js; the panel layer reads them
  // off PROP_REG and stands them on the plate.
  panelhw: (() => { try { return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src', 'panelhw', 'panelhw_packs.json'), 'utf8')); }
    catch (e) { return []; } })(),
  // baked RIGGED CHARACTERS (tools/char_prep.py from tools/chars_table.py):
  // one manifest per character, order written by the baker. They ride in the
  // MODELS slot behind 52_char_codec.js, which defines registerChar().
  // THE ANIMALS (2026-09-22): the baked skins + their clip libraries
  // (tools/animal_prep.py from tools/animals_table.py) and, beside them, the
  // static LEVELS as a PROP pack (tools/animal_lod.js). Both ride in the
  // MODELS slot: the first behind 55_animal_codec.js, which defines
  // registerAnimal(), the second behind 51_prop_codec.js's registerPropPack.
  animals: (() => { try { return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src', 'animals', 'animals_index.json'), 'utf8'))
      .concat(JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'animals', 'animals_packs.json'), 'utf8'))); }
    catch (e) { return []; } })(),
  chars: (() => { try { return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src', 'chars', 'chars_index.json'), 'utf8')); }
    catch (e) { return []; } })(),
  // THE WORLD PACK (G385, the premises port): the building generators the
  // editor composes with and the textures they read - the bench's files
  // (tools/_house_gen.js and its kin, the tram, the totem park, the village's
  // plan functions, the cabin), shipped as <script src> REFS after the
  // viewer and before app.js (the generators read viewer globals at build
  // time and app.js makes the world). Refs, not inlined: 900 KB of code that
  // a player who never opens the editor still downloads once and caches,
  // but that never counts against index.html's budget. ORDER is the bench
  // page's (tools/_premises.html).
  world: [
    // THE ANIMALS (2026-09-22): plume.js (the village chimney's smoke recipe,
    // made portable, for the whale's blow), animals.js (the ONE factory: the
    // skinned instance, the clip player, the LOD ladder) and animal_run.js
    // (the herds, the pods and the flocks). In the WORLD pack rather than
    // inlined for the reason the rest of this list is: 47 KB of code that is
    // fetched once and cached, and that index.html's budget need not carry.
    // render_world.js and render_premises.js are the two hosts that make a
    // runner, and both ask for window.ANIMAL_RUN at call time, so the refs
    // landing after the inlined viewer is soon enough.
    ['src/viewer', 'plume.js'], ['src/viewer', 'animals.js'], ['src/viewer', 'animal_run.js'],
    ['src/viewer', 'house_tex.js'], ['src/viewer', 'lot_tex.js'], ['src/viewer', 'sign_tex.js'],
    ...(() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'pier', 'pier_packs.json'), 'utf8')).map(f => ['src/pier', f]); } catch (e) { return []; } })(),
    ...(() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'totems', 'totems_packs.json'), 'utf8')).map(f => ['src/totems', f]); } catch (e) { return []; } })(),
    ['tools', '_house_kit.js'], ['tools', '_house_gen.js'], ['tools', '_big_gen.js'], ['tools', '_sport_gen.js'], ['tools', '_marine_gen.js'], ['tools', '_shed_gen.js'], ['tools', '_hangar_gen.js'], ['tools', '_tower_gen.js'], ['tools', '_tram_gen.js'], ['tools', '_totem_gen.js'],
    ...(() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'cabin', 'cabin_packs.json'), 'utf8')).map(f => ['src/cabin', f]); } catch (e) { return []; } })(),
    ['src/viewer', 'cabin_livery.js'], ['src/viewer', 'cabin.js'], ['src/viewer', 'tram_run.js'],
    // powerline.js after tram_run.js (it takes its sag from the tram's rope) and before the renderer
    ['src/viewer', 'powerline.js'],
    ['tools', '_village_gen.js'],
    // THE PARKED AEROPLANES (G411): builds as props, before the renderer that stands them
    ['src/viewer', 'parked.js'],
    // THE SCENERY'S LIFE (2026-09-23): people, clutter, rubbish, cars, small structures, antennas - made by the renderer below
    ['src/viewer', 'scenery_life.js'],
    ['src/viewer', 'render_premises.js'], ['src/viewer', 'premises_host.js'], ['src/viewer', 'premises_ui.js'],
  ].filter(([d, f]) => fs.existsSync(path.join(ROOT, d, f))),
  viewer: {
    shell: 'shell.html',
    // TWO STYLESHEETS, IN ORDER (G77). style.css is the GAME's — the flight
    // HUD's amber on glass, the boot splash, the aircraft card. editor.css is
    // the editor's own palette (design option 9b), scoped entirely under
    // #edWrap. They are separate files because they are separate designs and
    // the screen shows one or the other, and because a single sheet is the one
    // place two sessions working on two different surfaces are guaranteed to
    // collide.
    // ...AND A THIRD (the flight rebaseline). flight.css is the FLIGHT
    // layer's, scoped entirely under #ui, and it exists for the same reason
    // the other two are separate: a single sheet is the one place two
    // sessions working on two different surfaces are guaranteed to collide.
    // It is last because it declares the editor's Bone palette on #ui, and
    // that declaration is the whole of what makes the two screens one product.
    // ...AND A FOURTH (G200). controls.css is the CONTROL-MAPPING panel's,
    // scoped entirely under #ctlPanel — a third top-level host, because the
    // flight layer and the workshop layer each hide the other (editor.css's
    // mode rules) and this one panel opens from BOTH screens. It redeclares
    // the palette it uses for the same reason flight.css does.
    styles: ['style.css', 'editor.css', 'flight.css', 'controls.css', 'bench.css'],
    body: 'body.html',
    // THE LOADING SCREEN (LOADING S1, 2026-09-14): boot.js fills the BOOT slot
    // of body.html - a plain script in BOTH pages (inlined here, a src ref in
    // dev.html, never text/x-flydiy) so window.BOOT exists before the vendor
    // parses and the overlay speaks from the first ~100 ms; shots_pack.json is
    // the baker's manifest (tools/shots_prep.py) of the pictures it rotates,
    // spliced into the SHOTS slot as <figure>s
    boot: 'boot.js',
    shots: 'shots_pack.json',
    // the LAST entry fills the APP slot; everything before it fills RENDER
    // hangar.js before app.js: app.js asks whether the room can be built at all
    // (genHangarSupported) before it offers it as an environment
    // hangar_floor.js / hangar_walls.js before hangar.js: the texture
    // payloads (G37/G40) start their images decoding at load and
    // hangar.js reads them when building
    // hangar_sky.js before hangar.js too (G62): the sky SET is what the moods
    // are made of, and the room reads the rows as it builds. Unlike the other
    // two it decodes on demand, one 4k equirect at a time — see the file.
    // props.js before hangar.js: the room places props, and the one
    // material factory has to exist before anything asks for a crate
    // workshop.js after garage.js: the workshop pieces bake their sheets with
    // garage.js's own canvas bakers. hangar.js only CALLS them (lazily, at
    // first garage entry), so its own position is unchanged.
    // bench.js after garage.js: the bench writes its results into the
    // shelf's logbook (window.GARAGE_SPEC.note), and before app.js, which
    // calls benchInit with the bridge
    // aeroskin.js before hangar.js: the room's setMood scales every
    // material's own envMapIntensity (r128 has no scene.environmentIntensity)
    // and the aeroplane's factory has to exist to be registered. It is loaded
    // ahead of the EDITOR too, which needs it at first garage entry — the
    // editor block lands at the head of RENDER, so the dependency is on the
    // lazy CAGE_UI_BOOT, not on script order.
    // editor.js after bench.js and before app.js (G77): it is the third
    // bridge app.js hands out, beside garageInit and benchInit, and like them
    // it must be defined before app.js runs. It attaches window.CAGE_ON_ROWS,
    // which _cage_ui.js calls when it has built its rows — so the editor panel
    // does not need CAGE_UI to exist at load, only at first garage entry.
    // light_rig.js FIRST, before every room: it owns the renderer contract
    // (exposure + physicallyCorrectLights), the ground-bounce term that any
    // environment probe is occluded by, and the switchboard each room
    // declares its own sources into. A room applies a rig; it decides none.
    // site_tex.js before BOTH scenes (G123): the aerodrome's ground materials
    // are the one library the world's apron and the garage's apron share, and
    // like the other payloads its images start decoding at script eval.
    // site_ground.js after site_tex.js and before BOTH scenes: it is the one
    // factory for the aerodrome's ground materials, blade atlas and tufts, and
    // the world and the garage each ask it for the same things.
    // wood_tex.js before aeroskin.js (G125): the scanned wood detail sheets —
    // like the other payloads, the images start decoding at script eval, and
    // aeroDetailTex reads the table at first material build.
    // skin_tex.js the same, for the sheets that are not wood (the firewall's
    // fireproof foil): one loader, two payload tables, either may be absent.
    // vessel_tex.js is NOT one of those: it is the props' three-map recipe
    // (diff / arm / nor), for tanks and packs, which are objects in the scene
    // rather than covering. The energy layer reads it lazily at first draw, so
    // it only has to be evaluated before the editor is opened — but it sits
    // with its siblings because its images, like theirs, start decoding here.
    // aa_resolve.js anywhere before app.js (G144): it only publishes a table
    // and a factory at eval, and app.js is the one caller — it makes the pass
    // in its renderer block and hands it the frame at the bottom of the loop.
    // assets.js FIRST: it only publishes window.ASSET_FETCH at eval — the one
    // fetch+cache for external media/geo binaries — and everything after it
    // (props.js's propWarm, app.js's MODEL_LOAD) may ask for it at runtime.
    // trees_pack.js before trees.js before render_world.js (W0c): the
    // manifest is a plain assignment, the loader reads it at eval and publishes
    // treeWarm/treeBuild, and the world asks whether the payload is ready
    // before it decides between a real tree and the cone it drew for a year.
    // storage.js first (LOADING S4): the media cache's worker registers at load and
    // the version line reads FLYDIY_BUILD; nothing else depends on it
    scripts: ['storage.js', 'assets.js', 'aa_resolve.js',
              'light_rig.js', 'day_clock.js', 'atmo.js', 'sky_light.js', 'sky_glare.js', 'clouds.js', 'clouds_ui.js', 'day_ui.js', 'weather_ui.js', 'climate_link.js',
              // post_fx.js (POST-FX study, 2026-09-21): the switchable post passes over the resolve
              // pass's hook; publishes window.POST_FX at eval, app.js inits it, gfx_settings.js sets its rows
              'post_fx.js', 'shadow_near.js', 'site_tex.js', 'site_ground.js',
              'splat_tex.js', 'splat_ground.js',   // the island's ground library (17 sets, lazily-made Images) + the splat: the arrays, the GLSL, F8's handle
              // THE PAVEMENT (v1.16, 2026-09-22): the library manifest + the one material every strip, road and apron wears
              'pavement_tex.js', 'pavement.js',
              'guardrail.js',   // the W-beam beside a road (2026-09-22): the rule, the geometry, the one steel material
              // water.js before render_world.js (G460): the world takes the one water material as it builds its sea
              'water.js', 'spray.js',   // the spray sprites (H7.1, G460.9): app.js's syncWaterFx draws through it
              'trees_pack.js', 'trees.js', 'cover_ring.js', 'stand_cards.js', 'rock_map.js', 'cliffs.js', 'render_world.js',
              'hangar_floor.js', 'hangar_walls.js',
              'hangar_sky.js', 'props.js', 'wood_tex.js', 'skin_tex.js',
              'vessel_tex.js', 'panel_tex.js',
              // aeroweather.js BEFORE aeroskin.js (G345): the hooks read AEROWX at
              // compile, and r128 keys the program on the hook's source
              'aeroweather.js', 'aeroskin.js', 'hangar.js',
    // refplane.js before editor.js (G89): the editor's tree offers the
    // REFERENCE PLANE row and calls window.REFPLANE for its badge, its panel
    // and its boot, so the handle must exist before editorInit runs. It needs
    // nothing of the editor in return — the mount and the floor line come
    // from app.js's window.REF_MOUNT, and it reads them lazily, when a
    // preset is picked.
    // design_flow.js before editor.js: the tile renderer over the macro-row
    // declaration; editor.js's render() dispatches to window.DESIGN_FLOW
    // (lazily, like REFPLANE) when `Design & construction` is selected.
    // plaque.js and stickers.js before bench.js (G208): the plaque's sheet
    // (explanations, bounds, hover cards) and the certification roundels;
    // bench.js and app.js read both through window.PLAQUE / window.STICKERS.
    // bench_worker.js before bench.js (A9): the load rig's and the crosswind
    // ladder's thread (window.BENCH_WORKER), imported RAW by its own Blob
    // worker next to tools/flight_core.js — so it must stay a file the page
    // can fetch, like balance.js.
              'garage.js', 'workshop.js', 'plaque.js', 'stickers.js', 'bench_worker.js', 'bench.js', 'refplane.js',
    // balance.js before editor.js (G101): the energy layer's panel draws the
    // weight-and-balance chart through window.BALANCE, and reads it lazily
    // like REFPLANE and DESIGN_FLOW; it needs the core (buildGen, genShakedown,
    // genSpecAtFuel), which the core bundle already put in scope.
    // pattern_vis.js before app.js (G193): the ground pattern's overlay,
    // built by app.js's applyRoute through window.PATTERN_VIS
    // input.js before editor.js AND app.js (G200): the manual-controls model
    // publishes window.FLYDIY_INPUT_API at eval, like aa_resolve.js; app.js
    // makes the instance and editor.js's rail reads it. input_panel.js is the
    // mapping panel over it, opened from both rails; DOM-lazy, built on the
    // first open, so its position only has to precede the two callers.
              'design_flow.js', 'balance.js', 'pattern_vis.js',
    // dev_panel.js (W0c.11): the developer's dials, DOM-lazy, over handles
    // the world publishes at runtime (TREE_*, WORLD_RIG, DEV_CAM) - it only
    // has to be in the page; F8 builds it.
    // gfx_settings.js (G286) before editor.js and app.js: both rails host its
    // menu and app.js applies its saved choice the moment the world exists
              'input.js', 'input_panel.js', 'gfx_settings.js', 'editor.js',
              // THE COCKPIT IN FLIGHT (the panel arc, session 4): readings,
              // switches, the bus, the lamps — app.js calls in; RENDER slot
              'cockpit.js', 'app.js', 'dev_panel.js'],
  },
  // THE EDITOR (G35): the cage bench, embedded — the game's editor since the
  // old garage panel retired. The list and its ORDER are tools/_cage8.html's
  // script list verbatim (that page stays the standalone bench); the files
  // live in tools/ because the bench is where they are developed and gated.
  // They land at the head of the RENDER slot behind a CAGE_UI_LAZY flag, so
  // the editor boots on first open (app.js openEditor), not at page load.
  editor: [
    // THE DECLARED ASSEMBLY (G76) first: the part tree, the param -> part map
    // and the part -> section map every later file reads. Pure data, no deps.
    '_cage_parts.js',
    // THE FIN GRAMMAR (TAIL CHANTIER 2 P3): pure, no deps — and the design
    // rows read its frozen dicts (FIN_CUB, FIN_STRAIGHT, ST2FIN) at LOAD
    // time for the tail-outline starter's delta sets, so it sits before them
    '_fin_gen.js',
    // THE MACRO ROWS (NEW-AIRCRAFT): the birth certificate's declaration —
    // tiles, archetypes, GATE DESIGN. Pure data too, and every table it
    // reads (GEN_*, ENG_PAGE) is reached lazily, so it sits with its sibling.
    '_cage_design.js',
    // THE CHARACTERS (G204): the rig/skin module the crew layer dresses its
    // dummies with — reads CHAR_REG at call time, so only before the crew.
    // THE KNIFE (G245): the drawn-window cut, pure, reached by cageSheet at
    // call time through the KNIFE_GEN global — before the generator.
    // THE SHOULDER (G325): the sill trim, pure, reached by cageSheet at call
    // time through the SHOULDER_GEN global — before the generator too.
    '_cage_page5.js', '_knife_gen.js', '_shoulder_gen.js', '_cage_gen.js', '_cage_char.js',
    '_cage_crew.js',
    // THE INSTRUMENTS (the panel arc, session 2): the fit as a list, the
    // Instruments part's column and the join's `systems` seam; its geometry
    // comes in session 3. Reads the crew's anchors, so after the crew.
    '_panel_gen.js', '_cage_panel.js',
    '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    // THE FITTINGS (G81-G84), the reading and drawing halves. Pure modules
    // with no post hook, so they only have to be loaded before the layer.
    '_fit_site.js', '_fit_gen.js',
    // THE HINGE SHAPES (G238): the same table/placer/shapes split, over
    // GEAR_KIT. Pure module, no post hook — only has to be before the layer.
    '_hinge_gen.js',
    // THE SADDLES (G307): the bolted clamp a tail meets on a bare tube boom.
    // Pure shapes over GEAR_KIT, no post hook — before the fin/stab/gear
    // layers that draw them.
    '_rod_fit.js',
    '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js',
    '_strut_gen.js', '_boom_gen.js', '_cage_wing.js',
    // THE BRACE LAYER (G185): the cabane, interplane struts and wires — reads
    // the wing layer's def and ray, so after the wing; changes nothing the
    // gear reads, so before it.
    '_cage_brace.js',
    // THE GEAR LAYER BUILDS AFTER THE WING (G138): the low-wing rule roots
    // a leg on the wing's built underside (CAGE_WING.underAt), and PAGE.post
    // runs in load order — earlier, it would read the previous build's wing,
    // stale by one slider drag (the access layer's own reason, below). The
    // gear MODULES (_gear_kit/_gear_gen/_gear_page) stay early: _cage_fin
    // and _cage_stab read GEAR_GEN.CAGE_MATS at load time.
    '_cage_gear.js',
    // THE FLOATS (H2, G389): drawn from 32_hydro's own loft, after the gear
    // (the same airframe contract, the same fitting sites); G451: the drawn
    // Wipline's generator (pure geometry) just before its layer
    '_float_gen.js', '_cage_float.js',
    '_cage_fin.js', '_cage_stab.js',              // (_fin_gen.js loads above, with the design rows)
    // THE HEADLESS TAIL (TAIL CHANTIER 2 P5): the layers' build with no page,
    // for the birth seed (designBake sizes the drawn tail off the rule once)
    '_tail_headless.js',
    // THE FITTINGS LAYER IS LAST IN THE POST CHAIN, and it has to be: it
    // measures the sill off the ground line the GEAR settled on, and G84 puts
    // fittings on the WING's loft and the COWL's shell. PAGE.post runs in load
    // order, so anything earlier would read the previous build's wing — stale
    // by one slider drag, and undefined on the first.
    '_cage_access.js',
    '_cage_light.js',       // G96: the aeroplane's own lights + switches
    // THE ENERGY LAYER (G99): the interior's measurement, the vessel's
    // geometry, then the layer that draws and edits it. _bay_site reads
    // window.FIT_SITE at load, so it sits after _fit_site; the layer reads the
    // crew and the wing in its post hook, so it sits after both.
    '_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
    // THE CONTROL HARDWARE (G238) IS LAST OF THE DRAWING LAYERS, and for the
    // access layer's reason turned round: it reads the WING's, the FIN's and
    // the STAB's published hinge lines and ATTACHES its moving halves to the
    // `edSurf_*` objects those layers drew. Anything after it would traverse
    // a scene with hardware already hanging on the surfaces.
    '_cage_hinge.js',
    '_cage_join.js',        // the physics-bearing table (G45)
    '_cage_ui.js',
  ],
};

const read = f => fs.readFileSync(f, 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

// THE SHIPPED WORLDS (2026-09-23): src/core/world_packs.json, baked by
// tools/world_prep.js, names every gzipped payload under media/world/<id>.
// It is INLINED into the island loader rather than fetched: the loader runs
// before any script and must not spend a round trip learning what to fetch,
// and inlining puts the three tiny headers (~3.7 KB) on the page for free.
// Parse-then-stringify minifies AND fails the build loudly on a bad manifest.
const WORLD_PACK = (() => {
  const p = path.join(CORE_DIR, 'world_packs.json');
  if (!fs.existsSync(p)) return '{"islands":[]}';   // no world baked on this machine yet
  const pack = JSON.parse(read(p));                 // throws loudly on a bad manifest
  // only what the LOADER reads rides in the page: the id and name for the
  // GRAPHICS menu, the files it fetches, and the credit (CC-BY asks that the
  // notice travel with the asset; trees_pack.js sets the same precedent).
  // `authoring` is deliberately left out - it is jolene_author.py's 11 MB DEM
  // and naming it here would advertise a path the page must never fetch.
  return JSON.stringify({ islands: (pack.islands || []).map(w => ({ id: w.id, name: w.name, credit: w.credit, files: w.files })) });
})();

// IN-PROCESS (2026-09-14, the gate rationalization): this used to write each
// part to a temp file and spawn `node --check` on it - 151 spawns at ~350 ms
// each, 45-50 s of every battery before the first gate ran. vm.Script runs the
// same V8 parse without executing anything; it is stricter in exactly the way
// a <script> body needs (a top-level `import`/`export`/`await`/`return` is a
// syntax error here where --check may re-read the file as CommonJS or ESM).
function syntaxCheck(label, code) {
  try { new vm.Script(code, { filename: label }); }
  catch (e) {
    console.error(`SYNTAX FAIL in ${label}:\n${(e.stack || String(e)).split('\n').slice(0, 5).join('\n')}`);
    process.exit(1);
  }
}

// Slot substitution. Replacer functions are MANDATORY: the core is full of `$`
// sequences and String.replace treats $&, $', $` as magic patterns.
function fill(tpl, slot, blob) {
  const marker = `<!--__${slot}_SLOT__-->`;
  if (!tpl.includes(marker)) {
    console.error(`shell.html is missing ${marker}`);
    process.exit(1);
  }
  return tpl.replace(marker, () => blob);
}

function buildCore() {
  const parts = MANIFEST.core.map(f => read(path.join(CORE_DIR, f)));
  parts.forEach((p, i) => syntaxCheck(MANIFEST.core[i], p));
  const body = parts.join('');
  syntaxCheck('core-concat', body);

  const outFile = path.join(__dirname, 'flight_core.js');
  const hash = sha(body);
  if (fs.existsSync(outFile)) {
    const old = read(outFile);
    const m = old.match(/^\/\/ body-sha256: (\w+)\n/m);
    if (m) {
      const oldBody = old.split('\n').slice(2).join('\n');
      if (sha(oldBody) !== m[1])
        console.warn('WARNING: manual edits detected in generated tools/flight_core.js — they are being overwritten. Edit src/core/ instead.');
    }
  }
  const header = `// GENERATED FILE - DO NOT EDIT. Built from src/core/ by tools/build.js.\n// body-sha256: ${hash}\n`;
  fs.writeFileSync(outFile, header + body);
  return { body, bytes: body.length };
}

function inlineFonts(css) {
  // url(../../vendor/fonts/X.woff2) -> data URI (artifact must be self-contained)
  return css.replace(/url\((['"]?)\.\.\/\.\.\/vendor\/fonts\/([^'")]+)\1\)/g, (_, __, file) => {
    const buf = fs.readFileSync(path.join(VENDOR_DIR, 'fonts', file));
    return `url(data:font/woff2;base64,${buf.toString('base64')})`;
  });
}

function buildViewer(coreBody) {
  const V = MANIFEST.viewer;
  const shellPath = path.join(VIEW_DIR, V.shell);
  if (!fs.existsSync(shellPath)) {
    console.log('src/viewer/shell.html not present — core-only build.');
    return [];
  }
  const shell = read(shellPath);
  const css = V.styles.map(f => read(path.join(VIEW_DIR, f))).join('\n');
  const bootJs = read(path.join(VIEW_DIR, V.boot));
  syntaxCheck(V.boot, bootJs);
  const shotsPath = path.join(VIEW_DIR, V.shots);
  const shots = fs.existsSync(shotsPath) ? JSON.parse(read(shotsPath)) : [];
  const figures = shots.map((r, i) => {
    const set = r.set === 'world' ? 'rollout' : 'garage';
    return `<figure class="bs" data-set="${set}"><img src="${r.src}" alt="" decoding="async"${i === 0 ? ' fetchpriority="high"' : ''}><figcaption>${r.cap || ''}</figcaption></figure>`;
  }).join('\n');
  let bodyHtml = read(path.join(VIEW_DIR, V.body));
  bodyHtml = fill(bodyHtml, 'SHOTS', figures);
  const bodyArt = fill(bodyHtml, 'BOOT', `<script>\n${bootJs}</script>`);
  const bodyDev = fill(bodyHtml, 'BOOT', `<script src="src/viewer/${V.boot}?v=${sha(bootJs).slice(0, 8)}"></script>`);
  const scripts = V.scripts.map(f => read(path.join(VIEW_DIR, f)));
  scripts.forEach((s, i) => syntaxCheck(V.scripts[i], s));
  const editor = MANIFEST.editor.map(f => read(path.join(__dirname, f)));
  editor.forEach((s, i) => syntaxCheck(MANIFEST.editor[i], s));
  const models = MANIFEST.models.map(f => read(path.join(MODELS_DIR, f)));
  models.forEach((m, i) => syntaxCheck(MANIFEST.models[i], m));
  const props = MANIFEST.props.map(f => read(path.join(PROPS_DIR, f)));
  props.forEach((m, i) => syntaxCheck(MANIFEST.props[i], m));
  const PANELHW_DIR = path.join(ROOT, 'src', 'panelhw');
  const panelhw = MANIFEST.panelhw.map(f => read(path.join(PANELHW_DIR, f)));
  panelhw.forEach((m, i) => syntaxCheck(MANIFEST.panelhw[i], m));
  const CHARS_DIR = path.join(ROOT, 'src', 'chars');
  const chars = MANIFEST.chars.map(f => read(path.join(CHARS_DIR, f)));
  chars.forEach((m, i) => syntaxCheck(MANIFEST.chars[i], m));
  const ANIMALS_DIR = path.join(ROOT, 'src', 'animals');
  const animals = MANIFEST.animals.map(f => read(path.join(ANIMALS_DIR, f)));
  animals.forEach((m, i) => syntaxCheck(MANIFEST.animals[i], m));
  const three = read(path.join(VENDOR_DIR, 'three.min.js'));
  // the lazy flag rides IN FRONT of the editor scripts, in both pages: with
  // it set, _cage_ui.js defines CAGE_UI_BOOT and returns instead of booting.
  // CAGE_IN_GAME rides with it (G63) and says which SHELF owns saving: the
  // game's (garage.js, one store and one format) rather than the bench's own
  // preset/config bar. The standalone _cage*.html pages set neither.
  const LAZY = `<script>window.CAGE_UI_LAZY = 1; window.CAGE_IN_GAME = 1;</script>`;
  // THE RENDERER FLAG (W0.5b, 2026-09-13; RENDERER-DECISION §4h). dev.html
  // only - index.html stays the WebGLRenderer build until the flip.
  //   ?tsl=1    the WebGPU/TSL bundle, WebGPURenderer on its WebGL2 backend
  //   ?tsl=gpu  the same, asking for the WebGPU backend
  //   ?cm=0     ColorManagement OFF (the r128 "as authored" reading; managed is the ruling)
  //   (localStorage flydiy.tsl = '1' | 'gpu' holds the choice across loads)
  // The node renderer throws on a render before init(), and the boot bakes
  // (PMREM, impostors) render - so under the flag the renderer is made HERE,
  // initialised, and only then is the rest of the page let run (DEV_PROMOTE).
  // THE ISLAND LOADER, shared by BOTH pages (G434.3): it lived in DEV_LOADER alone, so index.html -
  // the page that is played - never booted Jolene, whatever the pref said
  const ISLAND_LOADER = `<script>
(function () {
  // THE ISLAND (W2, 2026-09-14): ?world=jolene boots the data world. The asset
  // (the quadtree) and the grids are fetched BEFORE any script runs, because
  // makeWorld is called during app.js's own evaluation.
  // THE WORLD SHIPS (2026-09-23): out of media/world/<id>, named by the
  // manifest src/core/world_packs.json which tools/world_prep.js bakes and
  // build.js inlines below. It read bench/ until this landing - gitignored,
  // so Jolene, the DEFAULT map, was in no clone, no worktree and no cloud
  // session. Every payload is ONE gzip stream under a content-hashed .bin,
  // so there is one decode path and sw.js's permanent /media/ cache is safe.
  // The manifest KEY is the path into the boot object, so nothing here spells
  // a filename and a second island is a bake, not an edit.
  // JOLENE IS THE DEFAULT (G434, the user: "make Jolene the new starting
  // terrain ... the old map stays"): the map is ?world= when given, else the
  // GRAPHICS menu's choice (localStorage flydiy.world), else jolene; 'none' is
  // the analytic world. The list is published for the menu. An island whose
  // files are not there falls back to the analytic world with a line in the
  // console - never a page that hangs.
  var name = new URLSearchParams(location.search).get('world');
  if (name === null) { try { name = localStorage.getItem('flydiy.world'); } catch (e) {} }
  if (!name) name = 'jolene';
  window.FLYDIY_WORLD = name;
  var u8 = function (b) { return new Uint8Array(b); };
  var gz = function (buf) { var ds = new DecompressionStream('gzip'); return new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer().then(u8); };
  // the manifest key is a dotted path; this is the only assembly either
  // consumer needs (island_node.js carries the same line)
  var set = function (o, k, v) { var p = k.split('.'); for (var j = 0; j < p.length - 1; j++) o = (o[p[j]] = o[p[j]] || {}); o[p[p.length - 1]] = v; };
  var boot = { id: name, grid: {}, far: {}, hydro: new URLSearchParams(location.search).get('hydro') || 'blend' };
  // THE MANIFEST IS FETCHED, NOT INLINED. It was inlined at build time at first,
  // to spend no round trip before the payloads - but index.html is held to
  // 8.7 MiB by GATE MEDIA and had 589 bytes of headroom the day this landed, so
  // 2.3 KB of manifest was not this asset's to spend. One ~700-byte request in
  // front of a 35 MB download is nothing, and the world now costs the page
  // LESS than the loader it replaced. FLYDIY_WORLDS therefore arrives async;
  // both readers (app.js, gfx_settings.js) build a menu on demand long after
  // boot and already guard on it being a non-empty array.
  window.FLYDIY_BOOT = window.FLYDIY_BOOT.then(function () {
    return fetch('src/core/world_packs.json').then(function (r) { return r.ok ? r.json() : { islands: [] }; }, function () { return { islands: [] }; }).then(function (PACK) {
    var all = PACK.islands || [];
    window.FLYDIY_WORLDS = all.map(function (w) { return { id: w.id, name: w.name }; }).concat([{ id: 'none', name: 'Home Strip (the analytic world)' }]);
    var isl = null;
    for (var i = 0; i < all.length; i++) if (all[i].id === name) isl = all[i];
    if (!isl) { window.FLYDIY_WORLD = 'none'; window.ISLAND_BOOT = null; return; }
    var keys = Object.keys(isl.files), done = 0, fetched = 0;
    for (var k2 = 0; k2 < keys.length; k2++) if (!('json' in isl.files[keys[k2]])) fetched++;
    return Promise.all(keys.map(function (k) {
      var r = isl.files[k];
      // PRESENCE IS THE CONTRACT: a key that is named must arrive. The old
      // loader's opt() let a grid 404 quietly; GATE MEDIA now holds
      // referenced == present, so a miss here is a broken checkout and the
      // catch below says so rather than drawing an island with a hole in it.
      if ('json' in r) { set(boot, k, r.json); return null; }
      return fetch(r.src).then(function (res) { if (!res.ok) throw new Error(r.src + ' ' + res.status); return res.arrayBuffer(); })
        .then(gz).then(function (u) {
          set(boot, k, r.kind === 'json' ? JSON.parse(new TextDecoder().decode(u)) : u);
          done++;
          // ~35 MB now rides in front of the first paint - without a phase the
          // loading screen would sit frozen on the step before it
          try { if (window.BOOT && BOOT.phase) BOOT.phase('world', 'reading the island', done / fetched); } catch (e) {}
        });
    })).then(function () {
      if (!(boot.far && boot.far.header && boot.far.topo && boot.far.payload)) boot.far = null;
      window.ISLAND_BOOT = boot;
    });
    })
      .catch(function (e) { console.warn('flyDiy: the island "' + name + '" did not load (' + (e && e.message) + '); the analytic world boots instead'); window.FLYDIY_WORLD = 'none'; window.ISLAND_BOOT = null; });
  });
})();
</script>`;
  const DEV_LOADER = `<script>
(function () {
  var q = new URLSearchParams(location.search), tsl = q.get('tsl');
  try { if (!q.has('tsl')) tsl = localStorage.getItem('flydiy.tsl') || ''; } catch (e) {}
  window.FLYDIY_TSL = (tsl === '1' || tsl === 'gpu') ? tsl : '';
  document.write('<script src="vendor/' + (window.FLYDIY_TSL ? 'three.webgpu.min.js' : 'three.min.js') + '"><\\/script>');
})();
</script>
<script>
(function () {
  var cm = new URLSearchParams(location.search).get('cm');
  try { if (cm === null) cm = localStorage.getItem('flydiy.cm'); } catch (e) {}
  if (cm === '0') THREE.ColorManagement.enabled = false;   // "as authored" (the r128 reading); managed is the ruling
  var ready = Promise.resolve();
  if (window.FLYDIY_TSL) {
    var r = new THREE.WebGPURenderer({ canvas: document.getElementById('c'), antialias: true,
      logarithmicDepthBuffer: true, forceWebGL: window.FLYDIY_TSL !== 'gpu' });
    window.FLYDIY_RENDERER = r;
    ready = r.init();
  }
  window.FLYDIY_BOOT = ready;
})();
</script>
${ISLAND_LOADER}
`;
  const DEV_PROMOTE = `<script>
window.FLYDIY_BOOT.then(function () {
  var tags = document.querySelectorAll('script[type="text/x-flydiy"]');
  for (var i = 0; i < tags.length; i++) {
    var s = document.createElement('script');
    s.src = tags[i].getAttribute('src'); s.async = false;
    document.body.appendChild(s);
  }
}, function (e) { console.error('flyDiy: the renderer did not initialise', e); });
</script>`;

  // Each ref carries a hash of its file's CONTENT as ?v=. python -m http.server
  // sends no Cache-Control, so Chrome falls back to HEURISTIC freshness — a
  // tenth of the file's age — and will happily serve a stale copy of a file you
  // edited today without ever revalidating, which reads exactly like a bug in
  // the code you just wrote. Content, not mtime, so a rebuild that changed
  // nothing leaves the pages byte-identical.
  const ver = p => { try { return '?v=' + sha(read(p)).slice(0, 8); }
                     catch (e) { return ''; } };
  const ref = (dir, sub, f) => `<script src="${sub}/${f}${ver(path.join(dir, f))}"></script>`;
  // THE DEV PAGE'S SCRIPTS ARE INERT UNTIL THE LOADER PROMOTES THEM (W0.5b):
  // type="text/x-flydiy" is not executed by the parser; DEV_PROMOTE below
  // appends real copies in order (async = false) once the vendor is in and,
  // under the renderer flag, once the node renderer has initialised
  const dref = (dir, sub, f) => `<script type="text/x-flydiy" src="${sub}/${f}${ver(path.join(dir, f))}"></script>`;
  // the payload refs are the SAME tags in both pages: model and prop payloads
  // stopped being inlined on 2026-09-01 (the multi-file artifact) and the
  // committed .js files under src/models/ and src/props/ are served directly.
  const payloadRefs = MANIFEST.models.map(f => ref(MODELS_DIR, 'src/models', f))
    .concat(MANIFEST.props.map(f => ref(PROPS_DIR, 'src/props', f)))
    .concat(MANIFEST.panelhw.map(f => ref(PANELHW_DIR, 'src/panelhw', f)))
    .concat(MANIFEST.chars.map(f => ref(CHARS_DIR, 'src/chars', f)))
    .concat(MANIFEST.animals.map(f => ref(ANIMALS_DIR, 'src/animals', f))).join('\n');

  // --- the served page: code inlined, payloads referenced ---
  let art = shell;
  art = fill(art, 'STYLE', `<style>\n${inlineFonts(css)}</style>`);
  art = fill(art, 'BODY', bodyArt);
  // the colour-management switch the GRAPHICS menu stores (flydiy.cm): read
  // right after the vendor, before any colour is made
  // ...and the loading screen's markers: one line after the vendor and one
  // after the core, so the phase line moves while the 7 MB of scripts parse
  const MARK = id => `<script>window.BOOT&&BOOT.phase('${id}','${id === 'vendor' ? 'reading the renderer' : 'reading the model'}')</script>`;
  // the core's sha (LOADING S2): a cache of something the physics computed
  // (the shakedown) is only valid for the core that computed it
  // ...and THE BUILD (LOADING S4): one id for the whole page's code (core + every
  // viewer and editor script), written into both pages, into version.json beside
  // them (the server's copy, fetched with no-store) and into sw.js - the version
  // line in the GRAPHICS menu compares the first two
  const BUILD_ID = sha(coreBody + scripts.join('\n') + editor.join('\n')).slice(0, 12);
  const CORE_SHA = `<script>window.FLYDIY_CORE_SHA='${sha(coreBody).slice(0, 12)}';window.FLYDIY_BUILD='${BUILD_ID}'</script>`;
  fs.writeFileSync(path.join(ROOT, 'version.json'), JSON.stringify({ build: BUILD_ID, date: new Date().toISOString() }) + '\n');
  // THE MEDIA CACHE'S WORKER (LOADING S4): media/ only, cache-first - every file
  // there is named by its content hash, so a hit can never be stale; scripts,
  // pages and everything else are never touched. One cache for every
  // build (the names change when the bytes do); the REFRESH CACHES button in
  // the GRAPHICS menu drops it. Registered by index.html alone (storage.js).
  // OWED, since the world started shipping (2026-09-23): this cache has NO
  // eviction, and a world is ~35 MB a bake - which was tolerable when the
  // biggest re-bakeable payload was a few MB of texture and is not now. So the
  // WORLD, and only the world, is swept on activate: every /media/world/ entry
  // outside THIS build's path set goes. Scoped there on purpose - a texture is
  // a few hundred KB and an older page still open in another tab may want it,
  // whereas a superseded world is tens of megabytes that nothing will ask for
  // again (world_prep prunes the old names off the server in the same bake, so
  // a stale tab would 404 and fall back to the analytic world either way).
  const WORLD_KEEP = JSON.stringify([].concat(...JSON.parse(WORLD_PACK).islands
    .map(w => Object.values(w.files || {}).filter(r => r.src).map(r => r.src))));
  fs.writeFileSync(path.join(ROOT, 'sw.js'), `// GENERATED FILE - DO NOT EDIT. Written by tools/build.js (LOADING S4). Build ${BUILD_ID}.
// The media cache: cache-first for media/ (content-hashed, immutable), nothing else.
// The world payloads this build asks for; anything else under media/world/ is
// swept on activate (a superseded world is ~35 MB and nothing will ask for it).
const WORLD_KEEP = ${WORLD_KEEP};
const CACHE = 'flydiy-media-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil((async () => {
  await self.clients.claim();
  try {
    const c = await caches.open(CACHE), keep = new Set(WORLD_KEEP);
    for (const req of await c.keys()) {
      const p = new URL(req.url).pathname, i = p.indexOf('/media/world/');
      if (i >= 0 && !keep.has(p.slice(i + 1))) await c.delete(req);
    }
  } catch (err) {}   // a cache that will not open is not worth failing activate over
})()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let u; try { u = new URL(req.url); } catch (err) { return; }
  if (u.origin !== self.location.origin || u.pathname.indexOf('/media/') < 0) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) c.put(req, res.clone()).catch(() => {});
    return res;
  }))));
});
`);
  art = fill(art, 'VENDOR', `<script>\n${three}\n</script>\n<script>(function(){var cm=null;try{cm=localStorage.getItem('flydiy.cm');}catch(e){}if(cm==='0')THREE.ColorManagement.enabled=false;})();</script>\n${MARK('vendor')}\n<!--ISLAND-LOADER-->`);
  art = fill(art, 'CORE', `<script>\n${coreBody}</script>\n${MARK('core')}\n${CORE_SHA}`);
  art = fill(art, 'MODELS', payloadRefs);
  // THE WORLD PACK'S PLACE (G386): after every viewer script the generators read and BEFORE app.js,
  // which makes the world - app.js is not the last viewer script (dev_panel.js is), so the refs go
  // into the RENDER slot right ahead of it, in both pages
  const APP_AT = V.scripts.indexOf('app.js');
  const worldRefs = MANIFEST.world.map(([d, f]) => ref(path.join(ROOT, d), d, f)).join('\n');
  const renderTags = scripts.slice(0, -1).map(s => `<script>\n${s}</script>`);
  renderTags.splice(APP_AT, 0, worldRefs);
  art = fill(art, 'RENDER', [LAZY]
    .concat(editor.map(s => `<script>\n${s}</script>`))
    .concat(renderTags).join('\n'));
  art = fill(art, 'APP', `<script>\n${scripts[scripts.length - 1]}</script>`);
  // THE ISLAND ON THE SHIPPED PAGE (G434.3): index.html's scripts are inlined and run as they parse,
  // and makeWorld runs during app.js's evaluation - so every script after the vendor is made INERT
  // (type text/x-flydiy) and promoted, in order, once the island's files are fetched (or refused,
  // with the analytic world as the fallback). dev.html has done exactly this since W2.
  {
    const cut = art.indexOf('<!--ISLAND-LOADER-->');
    if (cut < 0) throw new Error('build: the ISLAND-LOADER marker is missing from the shell');
    const head = art.slice(0, cut), tail = art.slice(cut)
      .replace(/<script>/g, '<script type="text/x-flydiy">')
      .replace(/<script src=/g, '<script type="text/x-flydiy" src=');
    const promote = `<script>
window.FLYDIY_BOOT.then(function () {
  var tags = document.querySelectorAll('script[type="text/x-flydiy"]');
  for (var i = 0; i < tags.length; i++) {
    var s = document.createElement('script');
    if (tags[i].getAttribute('src')) s.src = tags[i].getAttribute('src'); else s.textContent = tags[i].textContent;
    s.async = false;
    document.body.appendChild(s);
  }
}, function (e) { console.error('flyDiy: the boot did not initialise', e); });
</script>`;
    art = head + '<script>window.FLYDIY_BOOT = Promise.resolve();</script>\n' + ISLAND_LOADER + '\n' + tail + '\n' + promote;
  }
  // the CORE marker block is filled above; the worker's registration is storage.js's (RENDER)
  art = `<!-- GENERATED FILE - DO NOT EDIT. Built from src/ by tools/build.js. -->\n` + art;
  if (!art.includes('function makeAutopilot')) {
    console.error('POST-BUILD ASSERTION FAILED: artifact lost the core (String.replace corruption?)');
    process.exit(1);
  }
  // the loading screen precedes the vendor, and every baked picture is on the page
  if (art.indexOf('window.BOOT = B') < 0 || art.indexOf('window.BOOT = B') > art.indexOf('function makeAutopilot')) {
    console.error('POST-BUILD ASSERTION FAILED: boot.js must precede the core in index.html');
    process.exit(1);
  }
  for (const r of shots) if (!art.includes(r.src)) { console.error('POST-BUILD ASSERTION FAILED: shot missing from index.html: ' + r.src); process.exit(1); }
  for (const f of MANIFEST.models)
    if (!art.includes(`src="src/models/${f}?v=`)) {
      console.error(`POST-BUILD ASSERTION FAILED: artifact lost the ${f} ref`);
      process.exit(1);
    }
  for (const f of MANIFEST.props)
    if (!art.includes(`src="src/props/${f}?v=`)) {
      console.error(`POST-BUILD ASSERTION FAILED: artifact lost the ${f} ref`);
      process.exit(1);
    }
  for (const f of MANIFEST.panelhw)
    if (!art.includes(`src="src/panelhw/${f}?v=`)) {
      console.error(`POST-BUILD ASSERTION FAILED: artifact lost the ${f} ref`);
      process.exit(1);
    }
  for (const f of MANIFEST.chars)
    if (!art.includes(`src="src/chars/${f}?v=`)) {
      console.error(`POST-BUILD ASSERTION FAILED: artifact lost the ${f} ref`);
      process.exit(1);
    }
  for (const f of MANIFEST.animals)
    if (!art.includes(`src="src/animals/${f}?v=`)) {
      console.error(`POST-BUILD ASSERTION FAILED: artifact lost the ${f} ref`);
      process.exit(1);
    }
  for (const [d, f] of MANIFEST.world)
    if (!art.includes(`src="${d}/${f}?v=`)) {
      console.error(`POST-BUILD ASSERTION FAILED: artifact lost the world pack ref ${f}`);
      process.exit(1);
    }
  const artFile = path.join(ROOT, 'index.html');
  fs.writeFileSync(artFile, art);

  // --- dev page: refs only; JS/CSS edits need just a browser refresh ---
  let dev = shell;
  dev = fill(dev, 'STYLE', V.styles.map(f =>
    `<link rel="stylesheet" href="src/viewer/${f}${ver(path.join(VIEW_DIR, f))}">`)
    .join('\n'));
  dev = fill(dev, 'BODY', bodyDev);
  dev = fill(dev, 'VENDOR', DEV_LOADER);
  dev = fill(dev, 'CORE', MANIFEST.core.map(f => dref(CORE_DIR, 'src/core', f)).join('\n') + '\n' + CORE_SHA);
  dev = fill(dev, 'MODELS', payloadRefs.replace(/<script src=/g, '<script type="text/x-flydiy" src='));
  const devRender = V.scripts.slice(0, -1).map(f => dref(VIEW_DIR, 'src/viewer', f));
  devRender.splice(APP_AT, 0, MANIFEST.world.map(([d, f]) => dref(path.join(ROOT, d), d, f)).join('\n'));
  dev = fill(dev, 'RENDER', [LAZY]
    .concat(MANIFEST.editor.map(f => dref(__dirname, 'tools', f)))
    .concat(devRender)
    .join('\n'));
  dev = fill(dev, 'APP', dref(VIEW_DIR, 'src/viewer', V.scripts[V.scripts.length - 1]) + '\n' + DEV_PROMOTE);
  dev = `<!-- GENERATED FILE - DO NOT EDIT. Built from src/ by tools/build.js. Regenerate when markup or MANIFEST changes; plain JS/CSS edits only need a refresh. -->\n` + dev;
  const devFile = path.join(ROOT, 'dev.html');
  fs.writeFileSync(devFile, dev);

  return [
    { file: 'index.html', bytes: art.length },
    { file: 'dev.html', bytes: dev.length },
  ];
}

function build() {
  const t0 = Date.now();
  const core = buildCore();
  const viewer = buildViewer(core.body);
  const outs = [{ file: 'tools/flight_core.js', bytes: core.bytes }, ...viewer];
  console.log(
    outs.map(o => `${o.file} (${(o.bytes / 1024).toFixed(1)} KB)`).join(', ') +
    ` — syntax OK, ${Date.now() - t0} ms`
  );
}

module.exports = { build, MANIFEST };
if (require.main === module) build();
