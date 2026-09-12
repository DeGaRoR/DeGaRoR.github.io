// GENERATED FILE - DO NOT EDIT. Built by tools/prop_prep.py from
// assets/interior/, per the declared table in tools/panel_table.py.
// Group: the key. Decoded by src/core/51_prop_codec.js; geometry in
// media/geo/panelhw/ (per-prop bin, parts carry off/len), textures
// in media/tex/panelhw/. B re-roots the media paths for pages that
// do not live at flyDiy/ (see tools/_media_lib.js).
registerPropPack((p => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  for (const k in p.texs) p.texs[k] = B + p.texs[k];
  for (const k in p.props) if (p.props[k].bin) p.props[k].bin = B + p.props[k].bin;
  return p;
})({"v":2,"groups":[["key","the key"]],"order":["hw_key"],"texs":{"ddee1e364d55":"media/tex/panelhw/ddee1e364d55.jpg","45b3f5dcacbb":"media/tex/panelhw/45b3f5dcacbb.jpg","3a60ad7d066c":"media/tex/panelhw/3a60ad7d066c.jpg"},"props":{"hw_key":{"key":"hw_key","group":"key","label":"the key","place":"level","note":"a flat key, oval bow with a hole, bitted blade; textured","bb":[-0.03094,-0.01062,-0.00076,0.03094,0.01588,0.00076],"dim":[0.0619,0.0265,0.0015],"nv":2375,"nt":3932,"src":{"dir":"key","title":"Door Key","author":"Sketchfab (user-supplied export)","lic":"see assets/interior","url":"https://sketchfab.com/"},"mats":{"default":{"col":[1,1,1],"rough":1.0,"metal":1.0,"ao":0.0,"opacity":1,"dbl":1,"map":"ddee1e364d55","arm":"45b3f5dcacbb","nor":"3a60ad7d066c","norScl":1.0}},"parts":[{"mat":"default","nv":2375,"nt":3932,"uvMin":[0.01,0.254139],"uvScl":[0.98,0.735861],"off":0,"len":54475}],"bin":"media/geo/panelhw/hw_key.2ec98486.bin"}}}));
