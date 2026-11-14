// dt_manifest.js - WHAT THE DRAFTING TABLE LOADS of the game, in load order (paths from flyDiy/).
//
// The garage's generator and drawing layers, without the game: the core's generator files only (the world, the flight
// solver, the career are not loaded) and the editor's layers minus what needs a person, a cabin or the UI (crew, panel,
// characters, energy, lamps, hinges, fittings, the editor's own UI). Measured 11 Nov 2026: the cut core builds every
// archetype to the same triangles as the full one. The order is build.js MANIFEST's (core, then editor); GATE DRAFTING
// (tools/drafting/dt_check.js) holds this list against it, so a layer added to the game is noticed here.
(function (root) {
  'use strict';
  const CORE = ['00_registry.js', '01_names.js', '05_atmos.js', '60_gen_spec.js', '60b_gen_loft.js', '60c_gen_energy.js',
    '60d_gen_pod.js', '61_gen_frame.js', '62_gen_aero.js', '62c_gear_mech.js', '63_gen_wing.js', '64_gen_build.js',
    '64b_gen_design.js', '64c_gen_aids.js', '65_gen_loadtest.js', '66_gen_cert.js', '66b_cert_rule.js']
    .map(f => 'src/core/' + f);
  const VIEWER = ['src/viewer/matlib.js'];
  const EDITOR = ['_ray_index.js', '_cage_parts.js', '_fin_gen.js', '_cage_design.js', '_new_plane.js', '_cage_page5.js',
    '_knife_gen.js', '_shoulder_gen.js', '_cage_gen.js', '_cage_chain.js', '_seat_gen.js', '_cage_furnish.js',
    '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_fit_site.js', '_pillar_site.js', '_fit_gen.js', '_hinge_gen.js',
    '_rod_fit.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js',
    '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_cage_gear.js',
    '_float_gen.js', '_cage_float.js', '_cage_fin.js', '_cage_stab.js', '_tail_headless.js', '_pod_gen.js',
    '_cage_pod.js'].map(f => 'tools/' + f);
  // left out on purpose (the reason is the file's own job)
  const LEFT_OUT = ['_cage_crew.js', '_panel_gen.js', '_cage_panel.js', '_cage_char.js', '_bay_site.js', '_vessel_gen.js',
    '_vessel_mesh.js', '_cage_energy.js', '_cage_ui.js', '_cage_hinge.js', '_cage_access.js', '_cage_light.js',
    '_cage_join.js'];
  const THREE_JS = 'vendor/three.min.js';
  const OWN = ['tools/drafting/dt_build.js', 'tools/drafting/dt_core.js'];
  const api = { CORE, VIEWER, EDITOR, LEFT_OUT, THREE_JS, OWN, ALL: [THREE_JS].concat(CORE, VIEWER, EDITOR, OWN) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DT_MANIFEST = api;
})(typeof self !== 'undefined' ? self : this);
