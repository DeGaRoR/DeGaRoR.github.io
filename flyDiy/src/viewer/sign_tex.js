// GENERATED FILE - DO NOT EDIT. Built by tools/sign_prep.js from
// assets/billboards/out/ (the user's own painted signs; see CREDITS.md). The
// files live under media/tex/signs/ (hash-in-filename); loading starts at
// script eval and every consumer waits on img.complete/onload.
//
// THE BILLBOARDS (G313): each sign with its aspect (width over height) - the
// sign slot sizes its board by width and takes the height from here.
const SIGN_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
    air_taxi: { name: 'Admiralty Air Taxi', kind: 'roadside', aspect: 2.772, px: [693, 250], img: mk('media/tex/signs/air_taxi_1k.e6d423e9.png') },
    harbor_fuel: { name: 'Harbor Fuel & Bait', kind: 'harbour', aspect: 2.940, px: [682, 232], img: mk('media/tex/signs/harbor_fuel_1k.e72abc46.png') },
    general_store: { name: 'Kootz Landing General Store', kind: 'store', aspect: 2.897, px: [678, 234], img: mk('media/tex/signs/general_store_1k.a55420f7.png') },
    tidal_cup: { name: 'Tidal Cup Cafe', kind: 'store', aspect: 3.071, px: [688, 224], img: mk('media/tex/signs/tidal_cup_1k.00faf619.png') },
    bear_tours: { name: 'Bear Coast Tours', kind: 'roadside', aspect: 2.230, px: [660, 296], img: mk('media/tex/signs/bear_tours_1k.89a22627.png') },
    sitka_lumber: { name: 'Sitka Spruce Lumber', kind: 'industrial', aspect: 3.004, px: [682, 227], img: mk('media/tex/signs/sitka_lumber_1k.6d38fe1b.png') },
    north_motel: { name: 'North Channel Motel', kind: 'roadside', aspect: 2.917, px: [668, 229], img: mk('media/tex/signs/north_motel_1k.9d86db3a.png') },
    tongass_marine: { name: 'Tongass Marine Supply', kind: 'harbour', aspect: 3.027, px: [675, 223], img: mk('media/tex/signs/tongass_marine_1k.eb57d574.png') },
  };
})() : null;
// the same table headless, for the gates: keys, names, kinds, aspects
const SIGN_TEX_META = {"air_taxi":{"name":"Admiralty Air Taxi","kind":"roadside","aspect":2.772},"harbor_fuel":{"name":"Harbor Fuel & Bait","kind":"harbour","aspect":2.94},"general_store":{"name":"Kootz Landing General Store","kind":"store","aspect":2.897},"tidal_cup":{"name":"Tidal Cup Cafe","kind":"store","aspect":3.071},"bear_tours":{"name":"Bear Coast Tours","kind":"roadside","aspect":2.23},"sitka_lumber":{"name":"Sitka Spruce Lumber","kind":"industrial","aspect":3.004},"north_motel":{"name":"North Channel Motel","kind":"roadside","aspect":2.917},"tongass_marine":{"name":"Tongass Marine Supply","kind":"harbour","aspect":3.027}};
if (typeof module !== 'undefined' && module.exports) module.exports = { SIGN_TEX_META };
