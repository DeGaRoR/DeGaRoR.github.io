// GENERATED FILE - DO NOT EDIT. Built by tools/labels_prep.py from
// assets/interior/labels.png (the user's own tape labels). ONE column
// sheet, one tile per label, the tape centred in its tile; the panel
// layer draws tile i through a fixed uv window. `names` is the sheet's
// order, the contract between the sheet and the switch that wears it.
// Lives under media/tex/panel/ (hash-in-filename); loading starts at
// script eval, like every sheet.
const PANEL_TEX_SHEETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    labels: { img: mk('media/tex/panel/labels_512x160.127fcec6.png'), w: 512, h: 160, n: 8,
              names: ["Cabin", "Dash", "Instr", "Feet", "beac", "pos", "land", "cruise"] },
  };
})() : {};
if (typeof window !== 'undefined') window.PANEL_TEX_SHEETS = PANEL_TEX_SHEETS;
