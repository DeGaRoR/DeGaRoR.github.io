// GENERATED FILE - DO NOT EDIT. Built by tools/cabin_prep.py from
// assets/cabin/livery_*.png (the user's banners). The files live under
// media/tex/cabin/ (hash-in-filename); loading starts at script eval and
// cabin.js waits on img.complete/onload.
//
// THE LIVERIES OF THE TRAM CABIN (G343): one on each flank of the body,
// clipped to the banner's rectangle, mirrored on the far side. `aspect` is
// the banner's width over its height, which sizes the rectangle it fills.
const CABIN_LIVERY = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    admiralty: { img: mk('media/tex/cabin/livery_admiralty.ceffd0a4.jpg'), w: 1024, h: 341, aspect: 3.0000 },
    chatham: { img: mk('media/tex/cabin/livery_chatham.9928991f.jpg'), w: 1024, h: 341, aspect: 3.0000 },
  };
})() : null;
