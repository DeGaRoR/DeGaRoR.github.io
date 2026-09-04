// GENERATED FILE - DO NOT EDIT. Built by tools/vessel_tex_prep.js from
// assets/vessel/ (CC0: Poly Haven, ambientCG; see CREDITS.md). Three maps per
// set, the hangar props' own recipe (src/viewer/props.js): diff is sRGB base
// colour, arm is linear R = ao / G = roughness / B = metalness, nor is a
// linear OpenGL tangent normal. `tile` is METRES PER REPEAT — the vessel
// mesh lays uv out in real metres, so the grain is the same size on any tank.
// The files live under media/tex/vessel/ (hash-in-filename); loading starts at
// script eval, long before the first tank is drawn, and a material built
// before an image lands simply repaints when it does.
const VESSEL_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    paint: { px: 512, tile: 0.5, norScl: 1, ao: 0,
      label: "painted metal",
      diff: mk('media/tex/vessel/paint_diff_512.5b8ea38f.jpg'), arm: mk('media/tex/vessel/paint_arm_512.4a3844a6.jpg'), nor: mk('media/tex/vessel/paint_nor_gl_512.f384c90f.jpg') },
    alu: { px: 512, tile: 0.6, norScl: 0.85, ao: 0,
      label: "bare alloy",
      diff: mk('media/tex/vessel/alu_diff_512.f796b8b9.jpg'), arm: mk('media/tex/vessel/alu_arm_512.6dacf452.jpg'), nor: mk('media/tex/vessel/alu_nor_gl_512.f6dd0ae7.jpg') },
    plastic: { px: 512, tile: 0.35, norScl: 1, ao: 0,
      label: "moulded plastic",
      diff: mk('media/tex/vessel/plastic_diff_512.7750ccc0.jpg'), arm: mk('media/tex/vessel/plastic_arm_512.bc5b7120.jpg'), nor: mk('media/tex/vessel/plastic_nor_gl_512.fd96d905.jpg') },
    steel: { px: 512, tile: 0.22, norScl: 1, ao: 0,
      label: "steel hardware",
      diff: mk('media/tex/vessel/steel_diff_512.b68271e2.jpg'), arm: mk('media/tex/vessel/steel_arm_512.d8772b6a.jpg'), nor: mk('media/tex/vessel/steel_nor_gl_512.b6ea0af0.jpg') },
  };
})() : null;
