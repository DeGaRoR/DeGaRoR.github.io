// GENERATED FILE - DO NOT EDIT. Built by tools/wall_tex_prep.js from
// assets/hangar_walls/ (Poly Haven CC0). The files live under
// media/tex/walls/ (hash-in-filename). A SET LOADS WHEN IT IS READ (LOADING
// S4): the maps are getters that create their Image on first access, so the
// one set the room wears is fetched and the other eight are not (they used
// to start at script eval, 18 MB of every boot) - and every consumer waits
// on img.complete/onload, so a slow network is a late needsUpdate, not a bug.
const HANGAR_WALL_TILE_M = 2;
const HANGAR_WALL_SETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const lazy = (name, p) => { const o = { name }, im = {};
    for (const k in p) Object.defineProperty(o, k, { enumerable: true, get() { if (!im[k]) { im[k] = new Image(); im[k].src = B + p[k]; } return im[k]; } });
    return o; };
  return {
    factory: lazy('factory wall', { diff: 'media/tex/walls/factory_diff_1k.6a8d2d4d.jpg', nor: 'media/tex/walls/factory_nor_gl_1k.5ddb399e.webp', rough: 'media/tex/walls/factory_rough_1k.c543c5bb.webp' }),
    rustymetal: lazy('rusty painted metal', { diff: 'media/tex/walls/rustymetal_diff_1k.b086937b.jpg', nor: 'media/tex/walls/rustymetal_nor_gl_1k.396e828d.webp', rough: 'media/tex/walls/rustymetal_rough_1k.f029d83b.webp' }),
    rustysheet: lazy('rusty metal sheet', { diff: 'media/tex/walls/rustysheet_diff_1k.ecfacdea.jpg', nor: 'media/tex/walls/rustysheet_nor_gl_1k.fe791cbf.webp', rough: 'media/tex/walls/rustysheet_rough_1k.aa0feef8.webp' }),
    concrete004: lazy('concrete 004', { diff: 'media/tex/walls/concrete004_diff_1k.446261c8.jpg', nor: 'media/tex/walls/concrete004_nor_gl_1k.788b24df.webp', rough: 'media/tex/walls/concrete004_rough_1k.a07da26c.webp' }),
    concrete008: lazy('concrete 008', { diff: 'media/tex/walls/concrete008_diff_1k.a203166d.jpg', nor: 'media/tex/walls/concrete008_nor_gl_1k.aebf6e8b.webp', rough: 'media/tex/walls/concrete008_rough_1k.df19642f.webp' }),
    slabwall: lazy('concrete slab', { diff: 'media/tex/walls/slabwall_diff_1k.9a8fa059.jpg', nor: 'media/tex/walls/slabwall_nor_gl_1k.e16fe110.webp', rough: 'media/tex/walls/slabwall_rough_1k.80b21972.webp' }),
    sandstone: lazy('sandstone brick', { diff: 'media/tex/walls/sandstone_diff_1k.cfce6a38.jpg', nor: 'media/tex/walls/sandstone_nor_gl_1k.b357782b.webp', rough: 'media/tex/walls/sandstone_rough_1k.9892f24e.webp' }),
    planks09: lazy('brown planks', { diff: 'media/tex/walls/planks09_diff_1k.7dccb662.jpg', nor: 'media/tex/walls/planks09_nor_gl_1k.b86d380d.webp', rough: 'media/tex/walls/planks09_rough_1k.1aa7bee4.webp' }),
    rawplank: lazy('raw plank wall', { diff: 'media/tex/walls/rawplank_diff_1k.f81252ac.jpg', nor: 'media/tex/walls/rawplank_nor_gl_1k.a10fd28f.webp', rough: 'media/tex/walls/rawplank_rough_1k.9d0ef655.webp' }),
  };
})() : null;
