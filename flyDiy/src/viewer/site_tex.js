// GENERATED FILE - DO NOT EDIT. Built by tools/site_tex_prep.js from
// assets/airfield/ (CC0: Poly Haven + ambientCG; see CREDITS.md). The files
// live under media/tex/site/ (hash-in-filename); loading starts at script
// eval, ahead of the first garage entry building the room or the world scene
// placing the shed — and every consumer waits on img.complete/onload.
//
// Ground materials for the aerodrome's surfaces — apron, taxiway, strip and
// field. They join the same LIB the walls use, so any part can wear any set.
const SITE_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    brushed: { name: 'brushed concrete', tile: 2, px: 512,
      diff: mk('media/tex/site/brushed_diff_512.09ed18c5.jpg'),
      nor: mk('media/tex/site/brushed_nor_gl_512.ffe58c0f.jpg'),
      rough: mk('media/tex/site/brushed_rough_512.006fd4cf.jpg') },
    cracked: { name: 'cracked concrete', tile: 4, px: 512,
      diff: mk('media/tex/site/cracked_diff_512.53ca6cb6.jpg'),
      nor: mk('media/tex/site/cracked_nor_gl_512.25eb1586.jpg'),
      rough: mk('media/tex/site/cracked_rough_512.e6529d75.jpg') },
    antislip: { name: 'anti-slip concrete', tile: 2, px: 512,
      diff: mk('media/tex/site/antislip_diff_512.4a3ec588.jpg'),
      nor: mk('media/tex/site/antislip_nor_gl_512.47d37001.jpg'),
      rough: mk('media/tex/site/antislip_rough_512.773b9db1.jpg') },
    asphalt: { name: 'asphalt', tile: 4, px: 512,
      diff: mk('media/tex/site/asphalt_diff_512.97b52f47.jpg'),
      nor: mk('media/tex/site/asphalt_nor_gl_512.8cab2f84.jpg'),
      rough: mk('media/tex/site/asphalt_rough_512.ac02fc18.jpg') },
    asphaltaerial: { name: 'asphalt · aerial', tile: 16, px: 512,
      diff: mk('media/tex/site/asphaltaerial_diff_512.96d5e567.jpg'),
      nor: mk('media/tex/site/asphaltaerial_nor_gl_512.e32bc255.jpg'),
      rough: mk('media/tex/site/asphaltaerial_rough_512.a5c0e524.jpg') },
    grass004: { name: 'lawn grass', tile: 2, px: 512,
      diff: mk('media/tex/site/grass004_diff_512.7cc9f4c2.jpg'),
      nor: mk('media/tex/site/grass004_nor_gl_512.151550a5.jpg'),
      rough: mk('media/tex/site/grass004_rough_512.f5626b4f.jpg') },
    grass005: { name: 'field grass', tile: 2, px: 512,
      diff: mk('media/tex/site/grass005_diff_512.452ae05b.jpg'),
      nor: mk('media/tex/site/grass005_nor_gl_512.bf66784f.jpg'),
      rough: mk('media/tex/site/grass005_rough_512.5497193f.jpg') },
    leafygrass: { name: 'leafy grass', tile: 2, px: 512,
      diff: mk('media/tex/site/leafygrass_diff_512.8e2afea6.jpg'),
      nor: mk('media/tex/site/leafygrass_nor_gl_512.9b63c7d7.jpg'),
      rough: mk('media/tex/site/leafygrass_rough_512.0187dd5d.jpg') },
    ground003: { name: 'dry ground', tile: 2, px: 512,
      diff: mk('media/tex/site/ground003_diff_512.c3aa8c9e.jpg'),
      nor: mk('media/tex/site/ground003_nor_gl_512.b6f78081.jpg'),
      rough: mk('media/tex/site/ground003_rough_512.ccf85026.jpg') },
    dirt: { name: 'dirt floor', tile: 2, px: 512,
      diff: mk('media/tex/site/dirt_diff_512.d29ff9e3.jpg'),
      nor: mk('media/tex/site/dirt_nor_gl_512.51163e34.jpg'),
      rough: mk('media/tex/site/dirt_rough_512.29ee3f04.jpg') },
  };
})() : null;
