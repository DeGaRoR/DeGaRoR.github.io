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
  // A SET LOADS WHEN IT IS READ (LOADING S4.1): the maps are getters, the
  // Image made on first access (one per url); nothing here fetches at script eval
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  return {
    foil: { px: 512, get img() { return mk('media/tex/skin/foil_aero_512.b96de146.jpg'); } },
    panel: { px: 1024, get img() { return mk('media/tex/skin/panel_aero_1k.3609dbf2.jpg'); } },
    leather: { px: 512, get img() { return mk('media/tex/skin/leather_aero_512.73449514.jpg'); } },
    plasticScr: { px: 512, get img() { return mk('media/tex/skin/plasticScr_aero_512.b1bfbee8.jpg'); } },
    plasticGrn: { px: 512, get img() { return mk('media/tex/skin/plasticGrn_aero_512.a351409b.jpg'); } },
    plasticWorn: { px: 512, get img() { return mk('media/tex/skin/plasticWorn_aero_512.81fe75e2.jpg'); } },
    rubberGrip: { px: 512, get img() { return mk('media/tex/skin/rubberGrip_aero_512.e371d52d.jpg'); } },
    hide: { px: 512, get img() { return mk('media/tex/skin/hide_aero_512.2e381f49.jpg'); } },
    sillAlu: { px: 1024, get img() { return mk('media/tex/skin/sillAlu_aero_1k.a51b4a39.jpg'); } },
  };
})() : null;
