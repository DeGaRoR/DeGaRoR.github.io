// GENERATED FILE - DO NOT EDIT. Built by tools/floor_tex_prep.js from
// assets/concrete_floor_damaged_01/ (Poly Haven CC0). The files live under
// media/tex/floor/ (hash-in-filename); loading starts at script eval, well
// ahead of the first garage entry baking the room — and every consumer
// already waits on img.complete/onload, so a slow network degrades to a
// late needsUpdate, never to a broken room.
const HANGAR_FLOOR_TILE_M = 5;
const HANGAR_FLOOR_IMG = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    diff: mk('media/tex/floor/diff.9b41f6e1.jpg'),
    nor: mk('media/tex/floor/nor.83ef2ff6.png'),
    rough: mk('media/tex/floor/rough.045a7994.jpg'),
  };
})() : null;
