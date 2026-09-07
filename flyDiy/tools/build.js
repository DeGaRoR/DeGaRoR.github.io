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
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

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
    '30_solver.js',
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
    '50_model_codec.js',
    '51_prop_codec.js',
    '52_char_codec.js',
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
  // baked RIGGED CHARACTERS (tools/char_prep.py from tools/chars_table.py):
  // one manifest per character, order written by the baker. They ride in the
  // MODELS slot behind 52_char_codec.js, which defines registerChar().
  chars: (() => { try { return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src', 'chars', 'chars_index.json'), 'utf8')); }
    catch (e) { return []; } })(),
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
    styles: ['style.css', 'editor.css', 'flight.css', 'controls.css'],
    body: 'body.html',
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
    scripts: ['assets.js', 'aa_resolve.js',
              'light_rig.js', 'site_tex.js', 'site_ground.js', 'render_world.js',
              'hangar_floor.js', 'hangar_walls.js',
              'hangar_sky.js', 'props.js', 'wood_tex.js', 'skin_tex.js',
              'vessel_tex.js',
              'aeroskin.js', 'hangar.js',
    // refplane.js before editor.js (G89): the editor's tree offers the
    // REFERENCE PLANE row and calls window.REFPLANE for its badge, its panel
    // and its boot, so the handle must exist before editorInit runs. It needs
    // nothing of the editor in return — the mount and the floor line come
    // from app.js's window.REF_MOUNT, and it reads them lazily, when a
    // preset is picked.
    // design_flow.js before editor.js: the tile renderer over the macro-row
    // declaration; editor.js's render() dispatches to window.DESIGN_FLOW
    // (lazily, like REFPLANE) when `Design & construction` is selected.
              'garage.js', 'workshop.js', 'bench.js', 'refplane.js',
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
              'input.js', 'input_panel.js', 'editor.js', 'app.js'],
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
    // THE MACRO ROWS (NEW-AIRCRAFT): the birth certificate's declaration —
    // tiles, archetypes, GATE DESIGN. Pure data too, and every table it
    // reads (GEN_*, ENG_PAGE) is reached lazily, so it sits with its sibling.
    '_cage_design.js',
    // THE CHARACTERS (G204): the rig/skin module the crew layer dresses its
    // dummies with — reads CHAR_REG at call time, so only before the crew.
    '_cage_page5.js', '_cage_gen.js', '_cage_char.js', '_cage_crew.js',
    '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    // THE FITTINGS (G81-G84), the reading and drawing halves. Pure modules
    // with no post hook, so they only have to be loaded before the layer.
    '_fit_site.js', '_fit_gen.js',
    '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js',
    '_strut_gen.js', '_cage_wing.js',
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
    '_fin_gen.js', '_cage_fin.js', '_cage_stab.js',
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
    '_cage_join.js',        // the physics-bearing table (G45)
    '_cage_ui.js',
  ],
};

const read = f => fs.readFileSync(f, 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

function syntaxCheck(label, code) {
  const tmp = path.join(os.tmpdir(), `flydiy_check_${process.pid}_${label.replace(/[^\w.-]/g, '_')}.js`);
  fs.writeFileSync(tmp, code);
  const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  if (r.status !== 0) {
    console.error(`SYNTAX FAIL in ${label}:\n${r.stderr}`);
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
  const bodyHtml = read(path.join(VIEW_DIR, V.body));
  const scripts = V.scripts.map(f => read(path.join(VIEW_DIR, f)));
  scripts.forEach((s, i) => syntaxCheck(V.scripts[i], s));
  const editor = MANIFEST.editor.map(f => read(path.join(__dirname, f)));
  editor.forEach((s, i) => syntaxCheck(MANIFEST.editor[i], s));
  const models = MANIFEST.models.map(f => read(path.join(MODELS_DIR, f)));
  models.forEach((m, i) => syntaxCheck(MANIFEST.models[i], m));
  const props = MANIFEST.props.map(f => read(path.join(PROPS_DIR, f)));
  props.forEach((m, i) => syntaxCheck(MANIFEST.props[i], m));
  const CHARS_DIR = path.join(ROOT, 'src', 'chars');
  const chars = MANIFEST.chars.map(f => read(path.join(CHARS_DIR, f)));
  chars.forEach((m, i) => syntaxCheck(MANIFEST.chars[i], m));
  const three = read(path.join(VENDOR_DIR, 'three.min.js'));
  // the lazy flag rides IN FRONT of the editor scripts, in both pages: with
  // it set, _cage_ui.js defines CAGE_UI_BOOT and returns instead of booting.
  // CAGE_IN_GAME rides with it (G63) and says which SHELF owns saving: the
  // game's (garage.js, one store and one format) rather than the bench's own
  // preset/config bar. The standalone _cage*.html pages set neither.
  const LAZY = `<script>window.CAGE_UI_LAZY = 1; window.CAGE_IN_GAME = 1;</script>`;

  // Each ref carries a hash of its file's CONTENT as ?v=. python -m http.server
  // sends no Cache-Control, so Chrome falls back to HEURISTIC freshness — a
  // tenth of the file's age — and will happily serve a stale copy of a file you
  // edited today without ever revalidating, which reads exactly like a bug in
  // the code you just wrote. Content, not mtime, so a rebuild that changed
  // nothing leaves the pages byte-identical.
  const ver = p => { try { return '?v=' + sha(read(p)).slice(0, 8); }
                     catch (e) { return ''; } };
  const ref = (dir, sub, f) => `<script src="${sub}/${f}${ver(path.join(dir, f))}"></script>`;
  // the payload refs are the SAME tags in both pages: model and prop payloads
  // stopped being inlined on 2026-09-01 (the multi-file artifact) and the
  // committed .js files under src/models/ and src/props/ are served directly.
  const payloadRefs = MANIFEST.models.map(f => ref(MODELS_DIR, 'src/models', f))
    .concat(MANIFEST.props.map(f => ref(PROPS_DIR, 'src/props', f)))
    .concat(MANIFEST.chars.map(f => ref(CHARS_DIR, 'src/chars', f))).join('\n');

  // --- the served page: code inlined, payloads referenced ---
  let art = shell;
  art = fill(art, 'STYLE', `<style>\n${inlineFonts(css)}</style>`);
  art = fill(art, 'BODY', bodyHtml);
  art = fill(art, 'VENDOR', `<script>\n${three}\n</script>`);
  art = fill(art, 'CORE', `<script>\n${coreBody}</script>`);
  art = fill(art, 'MODELS', payloadRefs);
  art = fill(art, 'RENDER', [LAZY]
    .concat(editor.map(s => `<script>\n${s}</script>`))
    .concat(scripts.slice(0, -1).map(s => `<script>\n${s}</script>`)).join('\n'));
  art = fill(art, 'APP', `<script>\n${scripts[scripts.length - 1]}</script>`);
  art = `<!-- GENERATED FILE - DO NOT EDIT. Built from src/ by tools/build.js. -->\n` + art;
  if (!art.includes('function makeAutopilot')) {
    console.error('POST-BUILD ASSERTION FAILED: artifact lost the core (String.replace corruption?)');
    process.exit(1);
  }
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
  for (const f of MANIFEST.chars)
    if (!art.includes(`src="src/chars/${f}?v=`)) {
      console.error(`POST-BUILD ASSERTION FAILED: artifact lost the ${f} ref`);
      process.exit(1);
    }
  const artFile = path.join(ROOT, 'index.html');
  fs.writeFileSync(artFile, art);

  // --- dev page: refs only; JS/CSS edits need just a browser refresh ---
  let dev = shell;
  dev = fill(dev, 'STYLE', V.styles.map(f =>
    `<link rel="stylesheet" href="src/viewer/${f}${ver(path.join(VIEW_DIR, f))}">`)
    .join('\n'));
  dev = fill(dev, 'BODY', bodyHtml);
  dev = fill(dev, 'VENDOR', `<script src="vendor/three.min.js"></script>`);
  dev = fill(dev, 'CORE', MANIFEST.core.map(f => ref(CORE_DIR, 'src/core', f)).join('\n'));
  dev = fill(dev, 'MODELS', payloadRefs);
  dev = fill(dev, 'RENDER', [LAZY]
    .concat(MANIFEST.editor.map(f => ref(__dirname, 'tools', f)))
    .concat(V.scripts.slice(0, -1).map(f => ref(VIEW_DIR, 'src/viewer', f)))
    .join('\n'));
  dev = fill(dev, 'APP', ref(VIEW_DIR, 'src/viewer', V.scripts[V.scripts.length - 1]));
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
