// GENERATED FILE - DO NOT EDIT. Built by tools/skin_tex_prep.js from
// assets/skin/ (CC0: ambientCG; see CREDITS.md). Each image IS an AEROSKIN
// detail sheet (R,G normal / B the 0.80-mean ride) — DATA, not a picture;
// aeroDetailTex draws it linear. The files live under media/tex/skin/
// (hash-in-filename); loading starts at script eval, ready long before the
// first material is built; until then the procedural bake's neutral fill
// stands in for a frame. wood_tex.js is the same table for the wood library —
// aeroDetailTex reads both, so a sheet may live in either.
const SKIN_TEX_SHEETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    foil: { px: 512, img: mk('media/tex/skin/foil_aero_512.b96de146.jpg') },
    panel: { px: 1024, img: mk('media/tex/skin/panel_aero_1k.3609dbf2.jpg') },
    leather: { px: 512, img: mk('media/tex/skin/leather_aero_512.73449514.jpg') },
  };
})() : null;
