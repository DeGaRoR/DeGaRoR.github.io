// GENERATED FILE - DO NOT EDIT. Built by tools/wood_tex_prep.js from
// assets/wood/ (CC0: Poly Haven + ambientCG; see CREDITS.md). Each image IS
// an AEROSKIN detail sheet (R,G normal / B height ride, mean 0.80) — DATA,
// not a picture; aeroDetailTex draws it linear. The files live under
// media/tex/wood/ (hash-in-filename); loading starts at script eval, ready
// long before the first material is built; until then the procedural bake's
// neutral fill stands in for a frame.
const WOOD_TEX_SHEETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    maple: { px: 512, img: mk('media/tex/wood/maple_aero_512.2a5e4c9d.jpg') },
    walnut: { px: 512, img: mk('media/tex/wood/walnut_aero_512.a5fd8aa3.jpg') },
    walnutfig: { px: 512, img: mk('media/tex/wood/walnutfig_aero_512.d4d39710.jpg') },
    laminate: { px: 512, img: mk('media/tex/wood/laminate_aero_512.88ac0df3.jpg') },
  };
})() : null;
