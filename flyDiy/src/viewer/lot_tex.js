// GENERATED FILE - DO NOT EDIT. Built by tools/lot_tex_prep.js from
// assets/lot/ (CC0: ambientCG; see CREDITS.md). The files live under
// media/tex/lot/ (hash-in-filename); loading starts at script eval and every
// consumer waits on img.complete/onload.
//
// THE LOT'S GROUND (G290): five sets the lot ground shader splats by the
// plan's own weights - grass and dense grass mixed on a noise, dry ground
// under the buildings, pebbles at the seafront, dirt on the paths.
const LOT_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    lush: { name: 'dense grass', tile: 2.4, px: 512,
      diff: mk('media/tex/lot/lush_diff_512.90a67ae0.jpg'),
      nor: mk('media/tex/lot/lush_nor_gl_512.379ad06b.jpg'),
      rough: mk('media/tex/lot/lush_rough_512.8f65b07b.jpg') },
    grass: { name: 'grass', tile: 2.4, px: 512,
      diff: mk('media/tex/lot/grass_diff_512.7cc9f4c2.jpg'),
      nor: mk('media/tex/lot/grass_nor_gl_512.151550a5.jpg'),
      rough: mk('media/tex/lot/grass_rough_512.f5626b4f.jpg') },
    pebble: { name: 'pebbles', tile: 4.5, px: 512,
      diff: mk('media/tex/lot/pebble_diff_512.00fbe38a.jpg'),
      nor: mk('media/tex/lot/pebble_nor_gl_512.b29a459b.jpg'),
      rough: mk('media/tex/lot/pebble_rough_512.d985d705.jpg') },
    dry: { name: 'dry ground', tile: 2.2, px: 512,
      diff: mk('media/tex/lot/dry_diff_512.9f177ab8.jpg'),
      nor: mk('media/tex/lot/dry_nor_gl_512.89d1ffc2.jpg'),
      rough: mk('media/tex/lot/dry_rough_512.8360b752.jpg') },
    dirt: { name: 'dirt path', tile: 1.8, px: 512,
      diff: mk('media/tex/lot/dirt_diff_512.c5983cf7.jpg'),
      nor: mk('media/tex/lot/dirt_nor_gl_512.27f8e9b2.jpg'),
      rough: mk('media/tex/lot/dirt_rough_512.a924c560.jpg') },
  };
})() : null;
