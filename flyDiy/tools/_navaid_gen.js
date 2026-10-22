// _navaid_gen.js - THE RADIO NAVAIDS (ASSETS-OCT G2909, 2026-10-11, the user: "the real model, at the real
// spot" - the Annette Island VOR/DME, ANN 117.1, 55 03'37.471"N 131 34'42.238"W, 174 ft).
//
// A DOPPLER VOR (DVOR) with its DME, as the FAA builds them, one thing said in four parts:
//
//   THE COUNTERPOISE  a flat metal disc on steel columns - the ground plane the antennas radiate over,
//                     raised so the terrain under it does not bend the course. Esri imagery of the ANN site
//                     shows a 44-46 m disc (A0, z18 at 0.342 m/px: ~130 px), concentric rings and radial
//                     panel joints: the FAA's extended 150 ft (45.7 m) counterpoise. Height: a conventional
//                     DVOR counterpoise stands ~5 m (16 ft); the default is that (a dial).
//   THE ARRAY         the CARRIER radome at the centre, and the SIDEBAND ring: 50 Doppler antennas, each a
//                     small fibreglass "derby" dome on a stub, on a 44 ft (13.4 m) circle (FAA DVOR, 50
//                     antennas on a 22 ft radius - US DOT/FAA reports; dials)
//   THE DME           a slender fibreglass radome on a mast over the carrier, the site's highest point, with
//                     its RED OBSTRUCTION LIGHT (rule 29: the glass is the emitting geometry, glow palette 2 =
//                     red; published as a `beacon` light for the night lamp pool)
//   THE SITE          the equipment shelter west of the disc (a painted hut on its slab, its door lamp) and
//                     the access ladder up to the counterpoise
//
// Its MATERIALS are the control towers' (TOWER_GEN's finish: the house library's galvanised steel for the
// disc and the columns, the pale casing paint for the fibreglass, the cladding paint for the shelter) - no new
// material site, one finish shared. Same API as the other generators (DEF/ROWS/PRESETS/BAGS/MAT/build/
// applyFinish/makeFinish/catOf/CATALOGUE); headless for the gates. Loaded ON DEMAND (build.js MANIFEST.lazy):
// a record that names a navaid/ key asks for it (world_boot.js, the house worker, the editor).
//
// AND THE SMALL HYDRO PLANTS (G2909, the user, 11-12 Oct: "Metlakatla has 2 hydroelectric plants. They really only
// look like a concrete slab with an industrial warehouse on top ... use the substation model and tune it down" -
// "IRL the substation is tiny"). Key utility/hydro powerhouse (P.kind 'hydro'): a LONG NARROW SHED on its concrete
// base at the water (~25 x 10 m, the long axis along the shore, a low-pitch roof in TWO TONES - pale galvanised
// and rusty red-brown halves along its length), riprap down the water side, and at its land end a SMALL FENCED
// SWITCHYARD: one small transformer cut out of the user's substation pack ("Substation" by One80 Solar, CC BY 4.0)
// by tools/hydro_prep.py and carried in the GENERATED block below, and one lattice takeoff mast built here
// (int16 positions over each part's box, its triangles, a role per triangle: steel / porcelain).
(() => {
'use strict';
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const TW = window.TOWER_GEN;
const { clamp, Bag, face, uvFrame, boxAB, beam, cyl } = K;

// BEGIN GENERATED (tools/hydro_prep.py - the switchyard parts cut from "Substation" by One80 Solar, CC BY 4.0)
const UTIL_MESH = {"transformer":{"lo":[-2.1442,0.0,-1.4722],"hi":[2.1442,2.8448,1.4722],"nv":449,"nt":450,"pos":"iYBDbJ9mwI0ob79nApD2cV1nYY/6cWBnGpN7eUVnKZNJedZnBJMKesVnUZ9neIdn/9MTdaVnVudqcphnn+DAc+hnXVrneL1niVqaeSNoQVqYeWlnX169cBto7F0YcXJnT19ZcLRnZG1ubMRnAIDmbL/+LIhlbUj/o492cQwAFYsjb4H/M4/ncGn/HJP8eYv/LJMpeab/qZJyeBMA5dEMdeT/YBDmc63/I1o4ecT/RlpNea7/5FnBeFsA7V0ZcZX/KWS7bScA9WLYbvP/gW3CbMf/2Mzv7PVkK82v9ptfQM4UDdxdiM4lHONdds25Bb9cYNE3UeBlS9HyUsBmStXAZUloRdXSZqhod9RuZ2BoddkHbhFoB92/cG5n2dkScPRn+TgPcnlnaVGqdIJnzFPLdAVoZFpDdlZmmVqSdWhmM1uedbRl72yeawlnkubs60xlmeczDn4xzed1DWIzcuiiFcoolOk9MZcTWeo9N2wQW+15WCEFgPP8cKT+zvA3a3r/ovQpcWL/4PbVcKT+NSsmcTAArVPPdNj/W1MOdSz/ZFpDdjP+M1uedZH9klqUdUD+72yea+b+4/xndR3/4/yKcKX/4/xTdTcAgU8XdBr/fU8XdDAAf0/ueKX/bDYZd4H/Wjb8cYH/YzaLdFYB8hqxdYH/4BqUcIH/6Roic1YBxuBTdTVnxuCKcMhnxuBndU9o4/xTdTVn4/yKcMhn4/xndU9of08kdDVnf08RdE9of0/teMhnYzaLdBZmbDb8cetnWjYZd+tnKWp7fMlnI2lhezxo92cIfIZnZmXwd9Vq12T+f0lpQGWNe2lj92HrdhBqd2FIfa9rhGHCfJNjFGkPfApojme4e9hnQF2AevVncV50dhBq8V3SfK9r/l1LfJNjgluWdARoNliyeQNo2FolehRoKWp7fBEAI2lhe4QA92cIfM3/ZWXwdx0D12T+f5EBQGWNe7D74GF6dx0DUmGIf5EBumEWe7D7+mjYezIAQF2AejwAiWcQfEkAW14Ddx0DzF0Rf5EBNV6ferD7gluWdEsANliyeUoA2FolelsADG57fCYAEm9he7P/PnAIfGkAz3Lwdxr9XXP+f6b+9XKNe4YEVHZ6dxr943aIf6b+enYWe4YE+m7ue+P/9XqAevr/qXDpexoA2nkDdxr9aHoRf6b+AHqfeoYEs3yWdOv//3+yeez/XH0letv/DG57fN5nEm9he2tnPnAIfCJouHJhd5dlOHO/ffhjK3M5fRRsPnbrdpdlvnZIffhjsXbCfBRs+m7pe55nqXDze89n9XqAerNnw3l0dpdlQ3rSfPhjNnpLfBRss3yWdKRn/3+yeaVnXH0lepRnF2uoeHRwrmpteAdzV2rqdwdzL2q9f6//T2paeJH/HGpeeP3/I2pzeIRnJGr/f0pnQmrKf8lnSW4zeMj/9m1leMv/Lm7kf+7/Jm5/eEcAy21leEEAvWl7eKh1fGqPeNT6vWl7eACAwWmqedT6g26+fwCAg26+f6h1xG2qf9T6f26PftT6iW6EeKh1e26jedT6iW6EeACAwG2JeNT6t2m1f6h1xWmWftT6t2m1fwCAgWqvf9T6Om5/eB5oWW5veLJnNG69f85n9m1leKhnAm5leBBogW3ld7Fw6W3qdwdzUG3Pd0F1j2oseCN1IGxHeYZ1eG6UeJZ1/W1NeYh1IGyeeOB0RGpNeYh1yGmTeJZ1zmkcfOB0P2ocfIZ1Q2rrfoh1yGmkf5Z1IGzxfoZ1IGybf+B0/W3rfoh1eG6kf5Z1cm4cfOB0AW4cfIZ1G2waeLJyimoUgNprrG0UgIp5SAJI5V5u7/7A4INwRgC137lvoAEQ4qNxnQGi4O1tmP6G5ZRvRADO7ORligAF6+NqSv6C6EhqZP9z4gBsZv6R4W1voQEV6KVoJwHQ5JNxOv8n3MZy9/6R2a53JgKm3uRzxP6+3wJyzv9f3oh3UgG34Uxz//5I4G91WwFx2WR3MwID3Bl1zADl3MdwbwAB2nF0vQCb3sBwNgAN3N54oACX0lZ8DgGL1R9/yP7W0319qP5i2ux5oQEy2GN4uv/D2c58iv8X1wV3Sv8k2P9/pP4e0hZ6aQMr1D98zgEu2FJ63wEW2N55fg8Fpnl1lglApnl1lgkFpkN8fg9ApkN8hA14gBZ0IwtkgEt4hA0AgIh8Bw88gE94Bw82ptF1Bw/LuNF1OwyBr9F1Vw+Br+N5bgzwpcx4uQs8gCh5Iw08gHR4+gCKpvp18gCHpsl3Uwt2pgV26wBKpst17PRqtvt1dQOA18Z9Vv3h1yJ+Iv8q0p54tgOE1tF8qAOW1PZ6lP942ax/XQpzgDh81wteir551wtzgL55PApzgJl17wteisF37wtzgMF3LQ1eiu959Q24gO16TQ1eivB3+w24gM121AtCnOd4zAq9pdV4SA1CnMF4UA69pdJ45P6w1eV3Vf8B1jR4C/+61XB35P4z1mZ34v401WF3Vf+E1rV3DA7ntwJ2bw32uF53JwHLp7B2nObK7PZlFui96YBrk+hI5V5uOuXA4INwkea137lv7OcQ4qNx6eei4O1t5OSG5ZRvS+WE6ntqIeZs5+Jnr+Vz4gBssuSR4W1vcufQ5JNxhuUn3MZyQ+WR2a53ceip3t9zEOW+3wJyGeZf3oh3nue34UxzJOfZ3L1wS+VI4G91pudx2WR3f+gD3Bl1u+YB2nF0Ceeb3r9wguYN3N147OaX0lZ8WueL1R9/E+XW03198+Ri2ux57ecy2GN4BubD2c581uUX1wV3leUk2P9/8OQe0hZ6tOkr1D98Gugu2FJ6K+gW2N55wemA18Z9ouPh1yJ+AuqD1tB8buUp0p549OmW1PV64OV42ax/MOWw1eV3oeUB1jR4VuW61XB3MOUz1mZ3LuU01WF3oeWE1rV3kvVMZpNnqfWDZXZnQZWQeapm3wFYZalox1h+eOhoUcSGbCdnwlgkeY//3PXgZcj9ZPU9ZqP+fPV0ZYf+QZWIeSb99iZHbCf/HsR1bOH9UnuTeQ9ozXxBerNnbHtJe1pnInwneotmvXxDeqJoXX1geotmJnuJeYpnO3sje+xmM3t3eqxoGHcDe7RnQXkIeRJojnl2fFVnrXN2e7Rn13V7eRJoI3bqfFVnQ3Dqe7RnbHLueRJouXJdfVVnVXvGeZUAzXxBevr/aXsie1n/InxgeukAXX0neukAvXxDetP+MXs+e6AAJ3uSeUsAQXt4egX/GHcDe/z/QXkIeVkAjnl2fJ3/rXN2e/z/13V7eVkAI3bqfJ3/Q3Dqe/z/bHLueVkAuXJdfZ3/1VxyejwAa1sKelj/ZVt2ehoBElxgek3/2Fonek3/eFtDemQBC130eRkB8lxsez0ABF1Lekj/HWEDezsA814Ied3/p152fJoAh2R2ezsAXmJ7ed3/EWLqfJoA8mfqezsAyGXued3/fGVdfZoA1VxyevVndVtiebJnWlspezloFVwMegZneFtDehxp4Fp4egZnBF0+e09nDl2SeaRn9Fx4eupoHWEDe/Nn814IeZVnp152fFJoh2R2e/NnXmJ7eZVnEWLqfFJo8mfqe/NnyGXueZVnfGVdfVJo","idx":"AQADAAAAAQAFAAYAAgAEAAUAAwAGAAQABgAHAAQABAAJAAUABwAJAAQACQAKAAUABQAKAAgABwAIAAkACAAKAAsACgAMAA0ACgANAAsACAALAAkACgAJAAwACwAOAAwADQAPAAsACwAPAA4ADAAOABAADAAQAA0ADQAQAA8ADgARABAAEAARAA8ADwARAA4ACwAMAAkABQAIAAcABgAFAAcAAwAEAAIAAQAGAAMAAgAFAAEAAAADAAIAAAACAAEAEgATABUAEgAWABMAEwAUABUAFQAUABkAFQAZABYAFAAYABkAFgAYABQAGQAXABYAFgAXABgAFwAaABgAGgAbABgAGQAeABoAGgAdABsAHAAfAB4AHQAeACEAHwAgAB4AHQAhAB8AHgAgACEAIQAiAB8AIAAiACEAHwAiACAAHQAfABwAGwAcAB4AHQAcABsAHgAdABoAGwAeABkAGAAbABkAGQAaABcAEwAWABQAFQAWABIAIwAnACQAIwAlACcAIwAkACUAJgAlACQAJgAsACgAKAApACcAKAAqACkAKQAqACsAKQArACwAKgAtAC8AKwAvACwALwAuACwALgAvADAALwAxADAALQAyADEAMAAxADQAMAA0ADIAMAAyAC0AMgAzADEAMQAzADUAMgA0ADMANQA2ADQANAA2ADMAMwA2ADUAMQA1ADQALwAtADEALgAwAC0ALAAuAC0ALAAtACoAKgAvACsALAAqACgAKQAsACYAJwApACYAJQAoACcAJgAoACUAJwAmACQAOgA7ADkAOwA8ADgAOQA7ADgAOAA8ADoAPAA9ADoAOgA9ADsAPQA+ADsAOwA+AD8APwBBAEAAPwA+AEEAQABCAD4AQQBCAEAAQgBDAD4APgBDAEEAQwBEAEEAQQBEAEIAQgBEAEcAQgBHAEMAQwBFAEQARABFAEYARABGAEcAQwBHAEUARgBIAEcARwBIAEUARQBIAEYAPQBAAD4APwBAAD0APAA/AD0AOwA/ADwANwA6ADkAOAA6ADcANwA5ADgAYgBhAGMAYQBiAGMAZQBkAGYAZABlAGYAaABnAGkAZwBoAGkAagBrAGwAawBqAGwAbgBtAG8AbQBuAG8AcgBxAHAAcQByAHAAdABzAHUAcwB0AHUAdwB2AHgAdgB3AHgAegB5AHsAeQB6AHsAfgB8AH0AfAB+AH0AgAB/AIEAfwCAAIEAhACDAIIAgwCEAIIAhgCFAIcAhQCGAIcAiACKAIkAiQCKAIgAiwCNAIwAjACNAIsAkACOAI8AjgCQAI8AkQCTAJIAkgCTAJEAlgCVAJQAlQCWAJQAmACXAJkAlwCYAJkAmgCcAJsAnACaAJsAnQCfAJ4AnwCdAJ4AoQCgAKIAoAChAKIAowClAKQApQCjAKQAqACnAKYApwCoAKYAqQCqAKsAqwCqAM8AqwCqAKkArgCtAKwArQCuAKwAsACxAK8AsQCwAK8AsgCzALQAtQCyALQAswC1ALQAtQCzALYAsgC1ALMAuAC5ALcAugC3ALkAugC5ALcAuAC3ALkAvQC7ALwAvgC7ALwAvQC8ALsAvgC8ALsAwADBAL8AwgC/AMEAwgDBAL8AwAC/AMEAxADFAMMAxgDDAMUAxgDFAMMAxADDAMUAxwDIAMkAygDHAMkAyADKAMkAygDLAMcAyADHAMoAzADOAM0A0ADRANIA0wDQANIA1ADQANMA0wDVANQA1ADVANYA1gDXANQA2ADXANYA1gDZANgA2gDZANgA2wDaANgA3ADaANsA2wDdANwA3ADdAN4A3gDfANwA0gDfAN4A3gDfANEA3QDfAN4A3wDdANwA3ADdANoA2wDaAN0A2QDaANsA2ADZANsA2ADZANcA1gDXANkA1QDXANYA1wDVANQA1ADVANAA0wDQANUA3gDRANIA0gDRANMA0gDRAN8A0QDQANMA4QDiAOAA4gDhAOAA5gDvAO0A6QDuAOsA5ADtAOcA7wDmAOUA6QDqAO4A6gDrAOgA6ADjAOoA6wDsAOgA6wDqAOkA7ADrAO4A5wDvAOQA7QDvAOgA7QDkAOYA5QDkAO8A7QDoAOcA5wDoAOwA7gDjAOwA4wDuAOoA7wDjAOgA4wDvAOwA7ADvAOcA8QD0APoA9gDwAPQA9ADyAPYA+QD7APUA8gD5APMA9QDzAPkA8wD2APIA8AD2APkA9wD6APwA8AD5APIA+ADwAPIA+AD8APoA+gD3APEA8AD4APoA9gDzAPsA+wD5APYA8gD0APgA/AD4APQA9ADxAPwA9ADwAPoA/QADAQEBAQH+AP0A/gABAQIBAgH/AP4A/wACAQMBAAEDAQIBAgEBAQABAwH9AP8ABgEFAQQBCQEKAQsBCwEMAQkBDgEPAQ0BDQEPARABDwENARABDgENAQ8BEQESARMBEgERARQBEgERARMBEQESARQBFgEXARUBFwEWARUBGgEYARkBGgEbARgBHAEYARsBHAEbARkBGAEcARkBGgEZARsBIwEkASUBJgEnASgBMQEyATMBMwE0ATEBMQE0ATUBNAEzATUBNAE2ATMBNgEyATQBMgE1ATMBMQE1ATIBOQE3ATgBOQE4ATcBPwFGAUUBOwE6AUIBPQFFAUABRgE/AT4BOgFDAUIBQQE8ATsBQgFEAUEBQQE7AUIBRAFCAUMBQAFGAT0BRQFGAUEBRQE9AT8BPgE9AUYBRQFBAUABQAFBAUQBOgE7AUMBQwE8AUQBPAFDATsBRgE8AUEBPAFGAUQBRAFGAUABSAFLAVEBTgFHAUsBSwFJAU4BTQFSAUwBSQFNAUoBTAFKAU0BSgFOAUkBRwFOAU0BTwFRAVMBRwFNAUkBUAFHAUkBUAFTAVEBUQFPAUgBRwFQAVEBTgFKAVIBUgFNAU4BSQFLAVABUwFQAUsBSwFIAVMBSwFHAVEBVAFaAVgBWAFVAVQBVQFYAVkBWQFWAVUBVgFZAVoBVwFaAVkBWQFYAVcBWgFUAVYBXQFcAVsBZgFnAWgBaAFpAWYBZgFpAWoBaQFoAWoBaQFrAWgBawFnAWkBZwFqAWgBZgFqAWcBbQFxAWwBcAFtAWwBbAFuAW8BcAFsAW8BbwFuAXEBbwFxAW0BbwFtAXABbAFxAW4BcwF4AXYBcwF2AXQBcgFzAXQBcgF0AXcBdwF1AXMBdQF4AXMBdAF2AXgBdAF4AXUBdwF0AXUBdwFzAXIBewF5AXoBeQF7AXoBfgF8AX0BfAF+AX0BgQF/AYABgQGAAX8BhAGDAYIBgwGEAYIBhwGGAYUBhgGHAYUBigGJAYgBiQGKAYgBjQGLAYwBiwGNAYwBkAGOAY8BkAGPAY4BkgGRAZMBkQGSAZMBlgGVAZQBlQGWAZQBmQGYAZcBmAGZAZcBnAGbAZoBmwGcAZoBnQGeAZ8BnQGfAZ4BogGgAaEBogGhAaABpAGjAaUBowGkAaUBqAGnAaYBpwGoAaYBqwGqAakBqgGrAakBrgGtAawBrQGuAawBrwGwAbEBrwGxAbABswGyAbQBswG0AbIBtQG3AbYBtgG3AbUBugG5AbgBuQG6AbgBvQG8AbsBvAG9AbsBwAG/Ab4BvwHAAb4B","role":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}};
// END GENERATED
const BAGS = TW.BAGS, EXTRA = TW.EXTRA;
const makeFinish = () => TW.makeFinish();
const MAT = TW.MAT;
const SETS = role => HG.ROLE_SETS[({ siding: 'wall', roof: 'roof', steel: 'steel', stone: 'stone', metal: 'metal' })[role] || role];
const SET_IDX = (role, key) => Math.max(0, SETS(role).indexOf(key));
const setNames = role => SETS(role).slice();
const FT = 0.3048;

const DEF = {
  seed: 7,
  // the counterpoise
  cpD: 150 * FT, cpH: 16 * FT, cpT: 0.12, cpSegs: 64, rings: 3, joints: 24,
  colRings: 4, colW: 0.22,
  // the array
  sbN: 50, sbD: 44 * FT, sbStub: 0.45, sbDomeR: 0.32, sbDomeH: 0.34, carrierR: 0.55, carrierH: 1.3,
  // the DME and its light
  dme: 1, dmeH: 3.2, dmeR: 0.16, lights: 1,
  // the site
  shelter: 1, shelterL: 4.2, shelterW: 3.0, shelterH: 2.7, shelterGap: 3.5, ladder: 1,
  // the finish (TOWER_GEN's dials)
  steelSet: SET_IDX('steel', 'steelgrey'), metalSet: SET_IDX('metal', 'galv'), roofSet: SET_IDX('roof', 'galv'),
  wallSet: SET_IDX('siding', 'boxprof'), wallCol: 6, stoneSet: SET_IDX('stone', 'concrete'), trimCol: 6,
  dirt: 0.3, dirtH: 0.8, noise: 0.14, clouds: 0.35, ao: 0.8, aoRange: 0.6, aoDirect: 0.35, aoGround: 1,
  slopeX: 0, slopeZ: 0,
  // THE HYDRO POWERHOUSE (kind 'hydro'): the shed, its base, the riprap, the yard
  kind: 'dvor',
  hL: 25, hW: 10, hEave: 6.0, hPitch: 12, slabH: 1.2, slabOut: 1.0, riprap: 3.5, roofSplit: 0.5, hWin: 6,
  yard: 1, yardL: 9, yardW: 7, roof2Set: SET_IDX('roof', 'rust'),
};
const ROWS_DVOR = [
  ['the counterpoise', [
    ['cpD', 'diameter (m)', 20, 50, 0.1], ['cpH', 'height above ground (m)', 2.5, 8, 0.05],
    ['rings', 'panel rings', 0, 5, 1], ['joints', 'radial joints', 0, 48, 2], ['colRings', 'column rings', 2, 6, 1],
  ]],
  ['the array', [
    ['sbN', 'sideband antennas', 24, 60, 1], ['sbD', 'sideband circle (m)', 8, 18, 0.05],
    ['carrierH', 'carrier radome height', 0.6, 2.4, 0.05],
  ]],
  ['the DME and the site', [
    ['dme', 'DME mast', 0, 1, 1], ['dmeH', 'DME mast height', 1.5, 6, 0.1, null, P => !!P.dme],
    ['lights', 'obstruction + door lights', 0, 1, 1],
    ['shelter', 'equipment shelter', 0, 1, 1], ['shelterGap', 'shelter off the disc (m)', 1, 12, 0.5, null, P => !!P.shelter],
    ['ladder', 'access ladder', 0, 1, 1],
    ['slopeZ', 'ground slope z', -8, 8, 0.5], ['slopeX', 'ground slope x', -6, 6, 0.5],
  ]],
  ['finish', [
    ['metalSet', 'counterpoise', 0, SETS('metal').length - 1, 1, setNames('metal')],
    ['steelSet', 'columns', 0, SETS('steel').length - 1, 1, setNames('steel')],
    ['wallSet', 'shelter cladding', 0, SETS('siding').length - 1, 1, setNames('siding')], ['wallCol', 'shelter paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['roofSet', 'shelter roof', 0, SETS('roof').length - 1, 1, setNames('roof')], ['stoneSet', 'footings', 0, SETS('stone').length - 1, 1, setNames('stone')],
    ['trimCol', 'radome paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['dirt', 'dirt', 0, 1, 0.05], ['clouds', 'weather clouds', 0, 1, 0.05], ['ao', 'baked occlusion', 0, 1, 0.05], ['aoGround', 'ground skirt', 0, 1, 1],
  ]],
];
const ROWS_HYDRO = [
  ['the powerhouse', [
    ['hL', 'length (m)', 12, 40, 0.5], ['hW', 'width (m)', 6, 16, 0.25], ['hEave', 'eave height (m)', 3.5, 9, 0.1],
    ['hPitch', 'roof pitch (deg)', 5, 25, 1], ['roofSplit', 'roof: galvanised share of the length', 0, 1, 0.05], ['hWin', 'windows (water side)', 0, 10, 1],
  ]],
  ['the base and the shore', [
    ['slabH', 'concrete base height (m)', 0.3, 3, 0.05], ['slabOut', 'base out past the walls (m)', 0.3, 3, 0.1],
    ['riprap', 'riprap width (m)', 0, 8, 0.25], ['slopeZ', 'ground slope z', -8, 8, 0.5], ['slopeX', 'ground slope x', -6, 6, 0.5],
  ]],
  ['the switchyard', [
    ['yard', 'fenced switchyard', 0, 1, 1], ['yardL', 'yard length (m)', 5, 16, 0.5, null, P => !!P.yard], ['yardW', 'yard width (m)', 4, 12, 0.5, null, P => !!P.yard],
    ['lights', 'door lamp', 0, 1, 1],
  ]],
  ['finish', [
    ['wallSet', 'cladding', 0, SETS('siding').length - 1, 1, setNames('siding')], ['wallCol', 'paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['roofSet', 'roof, first part', 0, SETS('roof').length - 1, 1, setNames('roof')], ['metalSet', 'roof, second part', 0, SETS('metal').length - 1, 1, setNames('metal')],
    ['stoneSet', 'concrete', 0, SETS('stone').length - 1, 1, setNames('stone')], ['steelSet', 'switchyard steel', 0, SETS('steel').length - 1, 1, setNames('steel')],
    ['dirt', 'dirt', 0, 1, 0.05], ['clouds', 'weather clouds', 0, 1, 0.05], ['ao', 'baked occlusion', 0, 1, 0.05], ['aoGround', 'ground skirt', 0, 1, 1],
  ]],
];
const PRESETS = {
  'DVOR-DME': {},                                                  // the FAA's: Annette Island ANN 117.1
  'DVOR-DME compact': { cpD: 100 * FT, sbN: 48, shelterGap: 2.5 },   // the conventional 30 m counterpoise
  // the Purple Lake / Chester Lake powerhouses (3.9 / 1.1 MW, Metlakatla Power & Light): the photo's pale shed
  'hydro powerhouse': { kind: 'hydro', wallSet: SET_IDX('siding', 'boxprof'), wallCol: 6, roofSet: SET_IDX('roof', 'galv'),
                        roof2Set: SET_IDX('roof', 'rust'), steelSet: SET_IDX('steel', 'steelgrey'), stoneSet: SET_IDX('stone', 'concrete'),
                        metalSet: SET_IDX('metal', 'rust'), lights: 1, dirt: 0.45, clouds: 0.5 },
};
const CATS = { 'DVOR-DME': 'landmark', 'DVOR-DME compact': 'landmark', 'hydro powerhouse': 'landmark' };
const HYDRO = P => P.kind === 'hydro';
// the editor's rows: the DVOR's dials for a navaid, the shed's for a powerhouse (each row's own visibility)
const onlyIf = (rows, f) => rows.map(([g, rs]) => [g, rs.map(r => { const v = r[6]; return [r[0], r[1], r[2], r[3], r[4], r[5] || null, P => f(P) && (!v || v(P))]; })]);
const ROWS = onlyIf(ROWS_DVOR, P => !HYDRO(P)).concat(onlyIf(ROWS_HYDRO, HYDRO));
const catOf = name => CATS[name] || null;

// a flat annulus strip on the counterpoise's top (a panel seam): n quads between radii r0, r1 at y
function annulus(bag, r0, r1, y, n) {
  for (let i = 0; i < n; i++) {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n;
    const p = (r, a) => [Math.cos(a) * r, y, Math.sin(a) * r];
    face(bag, [p(r1, a0), p(r1, a1), p(r0, a1), p(r0, a0)], [0, 1, 0], q => [q[0], q[2]]);
  }
}

function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  if (HYDRO(P)) return buildHydro(P, lod, F);
  const Q = { lod: lod | 0 };
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const LIT = HG.litBegin();
  const occ = [];
  const R = P.cpD / 2, Hc = P.cpH, T = P.cpT;
  const yTop = Hc, yBot = Hc - T;
  const N = Q.lod === 0 ? Math.round(P.cpSegs) : 32;

  // ==== THE COUNTERPOISE: the disc (top, underside, rim) ====
  const rim = []; for (let i = 0; i < N; i++) { const a = 2 * Math.PI * i / N; rim.push([Math.cos(a) * R, Math.sin(a) * R]); }
  for (let i = 0; i < N; i++) {
    const a = rim[i], b = rim[(i + 1) % N];
    face(bags.metal, [[0, yTop, 0], [b[0], yTop, b[1]], [a[0], yTop, a[1]]], [0, 1, 0], q => [q[0], q[2]]);
    face(bags.metal, [[0, yBot, 0], [a[0], yBot, a[1]], [b[0], yBot, b[1]]], [0, -1, 0], q => [q[0], q[2]]);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ml = Math.hypot(mid[0], mid[1]) || 1;
    face(bags.metal, [[a[0], yBot, a[1]], [b[0], yBot, b[1]], [b[0], yTop, b[1]], [a[0], yTop, a[1]]], [mid[0] / ml, 0, mid[1] / ml],
         q => [Math.atan2(q[2], q[0]) * R, q[1]]);
  }
  occ.push({ x: 0, z: 0, r: R, k: 0.22, soft: 0.8 });          // a raised disc: open under, a light shade
  // the panel seams the imagery shows: concentric rings and radial joints, in the column steel, 1 cm proud
  if (Q.lod === 0) {
    const rings = Math.round(P.rings);
    for (let k = 1; k <= rings; k++) { const r = R * k / (rings + 1); annulus(bags.steel, r - 0.06, r + 0.06, yTop + 0.01, Math.max(24, Math.round(N * r / R))); }
    annulus(bags.steel, R - 0.12, R, yTop + 0.01, N);
    const J = Math.round(P.joints);
    for (let k = 0; k < J; k++) {
      const a = 2 * Math.PI * (k + 0.5) / J, c = Math.cos(a), s = Math.sin(a), w = 0.05;
      const r0 = P.sbD / 2 + 0.6;
      face(bags.steel, [[c * r0 - s * w, yTop + 0.01, s * r0 + c * w], [c * R - s * w, yTop + 0.01, s * R + c * w],
                        [c * R + s * w, yTop + 0.01, s * R - c * w], [c * r0 + s * w, yTop + 0.01, s * r0 - c * w]], [0, 1, 0], q => [q[0], q[2]]);
    }
  }
  // the columns: rings of square steel columns, a concrete footing under each (lod 0), radial girders under the disc
  let cols = 0;
  const CR = Math.round(P.colRings);
  for (let k = 1; k <= CR; k++) {
    const r = (R - 0.6) * k / CR, n = Math.max(4, Math.round(6 * k * (CR >= 4 ? 1 : 1.5)));
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * (i + (k % 2) * 0.5) / n, x = Math.cos(a) * r, z = Math.sin(a) * r, y0 = g(x, z);
      beam(bags.steel, [x, y0 - 0.1, z], [x, yBot, z], P.colW / 2, P.colW / 2, [1, 0, 0], 0);
      if (Q.lod === 0) boxAB(bags.stone, [x - 0.3, y0 - 0.25, z - 0.3], [x + 0.3, y0 + 0.12, z + 0.3], { ny: 1 });
      occ.push({ x, z, r: 0.35, k: 0.3 });
      cols++;
    }
  }
  if (Q.lod === 0) for (let k = 0; k < 12; k++) {
    const a = 2 * Math.PI * k / 12, c = Math.cos(a), s = Math.sin(a);
    beam(bags.steel, [c * 0.4, yBot - 0.18, s * 0.4], [c * (R - 0.3), yBot - 0.18, s * (R - 0.3)], 0.08, 0.09, [0, 1, 0], 0);
  }

  // ==== THE ARRAY ====
  // the carrier: a fibreglass radome at the centre (casing paint), on a short steel plinth
  const segD = Q.lod === 0 ? 12 : 8;
  cyl(bags.steel, [0, yTop, 0], [0, 1, 0], P.carrierR * 0.8, 0.25, segD, false);
  const yC = yTop + 0.25;
  K.prismRings(bags.trim, K.ringN(0, 0, P.carrierR, segD, 0, yC), K.ringN(0, 0, P.carrierR, segD, 0, yC + P.carrierH), false, false);
  K.apexTo(bags.trim, K.ringN(0, 0, P.carrierR, segD, 0, yC + P.carrierH), [0, yC + P.carrierH + P.carrierR * 0.45, 0]);
  // the sidebands: n derby domes on stubs on the circle
  const nSB = Math.round(P.sbN), rSB = P.sbD / 2, segS = Q.lod === 0 ? 8 : 5;
  for (let i = 0; i < nSB; i++) {
    const a = 2 * Math.PI * i / nSB, x = Math.cos(a) * rSB, z = Math.sin(a) * rSB;
    cyl(bags.steel, [x, yTop, z], [0, 1, 0], 0.035, P.sbStub, Q.lod === 0 ? 4 : 3, false);
    const yd = yTop + P.sbStub;
    K.prismRings(bags.trim, K.ringN(x, z, P.sbDomeR, segS, 0, yd), K.ringN(x, z, P.sbDomeR, segS, 0, yd + P.sbDomeH * 0.6), true, false);
    K.apexTo(bags.trim, K.ringN(x, z, P.sbDomeR, segS, 0, yd + P.sbDomeH * 0.6), [x, yd + P.sbDomeH, z]);
  }

  // ==== THE DME and its RED OBSTRUCTION LIGHT ====
  let top = yC + P.carrierH + P.carrierR * 0.45, beacon = null;
  if (P.dme) {
    const y0 = yC + P.carrierH + 0.1;
    cyl(bags.steel, [0, y0, 0], [0, 1, 0], 0.05, 0.4, 6, false);
    K.prismRings(bags.trim, K.ringN(0, 0, P.dmeR, 8, 0, y0 + 0.4), K.ringN(0, 0, P.dmeR, 8, 0, y0 + P.dmeH), true, false);
    const yl = y0 + P.dmeH;
    cyl(bags.steel, [0, yl, 0], [0, 1, 0], 0.07, 0.06, 8, false);
    bags.glass.setGlow(P.lights ? 2 : 0);
    K.prismRings(bags.glass, K.ringN(0, 0, 0.09, 8, 0, yl + 0.06), K.ringN(0, 0, 0.09, 8, 0, yl + 0.24), false, true);
    bags.glass.setGlow(0);
    top = yl + 0.24;
    if (P.lights) { beacon = { kind: 'beacon', x: 0, y: yl + 0.15, z: 0, nx: 0, nz: 0, col: [1.0, 0.12, 0.06], k: 2.0, range: 60.0, beacon: 1, alt: [1.0, 0.12, 0.06] }; LIT.lights.push(beacon); }
  }

  // ==== THE SITE: the shelter west of the disc (-x), the ladder up to the rim ====
  let shelter = null;
  if (P.shelter) {
    const L = P.shelterL, W = P.shelterW, Hs = P.shelterH;
    const x1 = -(R + P.shelterGap), x0 = x1 - W, z0 = -L / 2, z1 = L / 2;
    const y0 = Math.max(g(x0, z0), g(x0, z1), g(x1, z0), g(x1, z1));
    boxAB(bags.stone, [x0 - 0.3, y0 - 0.4, z0 - 0.3], [x1 + 0.3, y0 + 0.15, z1 + 0.3], { ny: 1 });            // the slab
    boxAB(bags.siding, [x0, y0 + 0.15, z0], [x1, y0 + 0.15 + Hs, z1], { ny: 1, py: 1 });
    boxAB(bags.roof, [x0 - 0.2, y0 + 0.15 + Hs, z0 - 0.2], [x1 + 0.2, y0 + 0.3 + Hs, z1 + 0.2], { ny: 1 });   // a flat roof, its edge
    // the door on the east face (toward the disc) and its lamp
    face(bags.trim, [[x1 + 0.01, y0 + 0.15, -0.45], [x1 + 0.01, y0 + 0.15, 0.45], [x1 + 0.01, y0 + 2.2, 0.45], [x1 + 0.01, y0 + 2.2, -0.45]], [1, 0, 0],
         uvFrame([x1, y0, -0.45], [0, 0, 1], [0, 1, 0]));
    bags.glass.setGlow(P.lights ? 1 : 0);
    boxAB(bags.glass, [x1 + 0.01, y0 + 2.35, -0.08], [x1 + 0.12, y0 + 2.5, 0.08], { nx: 1 });
    bags.glass.setGlow(0);
    if (P.lights) LIT.lights.push({ kind: 'porch', x: x1 + 0.2, y: y0 + 2.4, z: 0, nx: 1, nz: 0, col: [1.0, 0.82, 0.55], k: 1.0, range: 9.0 });
    occ.push({ x: (x0 + x1) / 2, z: 0, hx: W / 2 + 0.3, hz: L / 2 + 0.3, k: 0.45 });
    shelter = { x0, z0, x1, z1, floorY: y0 + 0.15, door: [x1, y0 + 0.15, 0] };
  }
  if (P.ladder) {
    const xl = -(R + 0.05), zl = (P.shelter ? P.shelterL / 2 + 1.5 : 0), y0 = g(xl, zl);
    for (const s of [-0.22, 0.22]) beam(bags.steel, [xl - 0.4, y0, zl + s], [xl, yTop + 1.0, zl + s], 0.025, 0.025, [0, 0, 1], 0);
    if (Q.lod === 0) for (let k = 1; k * 0.3 < yTop - y0; k++) { const t = k * 0.3 / (yTop + 1.0 - y0), x = xl - 0.4 * (1 - t);
      beam(bags.steel, [x, y0 + k * 0.3, zl - 0.22], [x, y0 + k * 0.3, zl + 0.22], 0.012, 0.012, [0, 1, 0], 0); }
  }

  // ==== THE GROUND SKIRT AND THE BAKE ====
  for (const o of occ) o.dry = true;
  if (P.aoGround) HG.buildGroundAO(bags.aoskirt, occ, g);
  const aoInfo = K.bakeAO(BAGS.map(k => bags[k]), { strength: P.ao === undefined ? 0.8 : P.ao, range: P.aoRange || 0.6, ground: g });
  let tris = 0, verts = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of BAGS) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) { const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2];
      if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z; }
  }
  const stats = {
    tris, verts, per, bbox: bb, footprint: Math.PI * R * R, eaveY: yTop, ridgeY: top, floorY: 0,
    role: 'navaid', navaid: { kind: 'DVOR/DME', counterpoise: { d: P.cpD, y: yTop }, sidebands: { n: nSB, d: P.sbD }, columns: cols, top, beacon: !!beacon },
    shelter, front: { x: shelter ? shelter.x0 - 2 : -(R + 2), z: 0, side: -1, depth: 0 },
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, pier: null, lit: LIT, smoke: null, sign: null, yard: [],
  };
  return { bags, stats, P, V: { L: P.cpD, w: P.cpD, wallT: 0.12, floorY: 0 }, R: null, MAT: F ? F.MAT : MAT };
}
// ---- THE HYDRO POWERHOUSE ----------------------------------------------------------------------------------
// the generated parts, decoded once (base64 -> int16 positions over the part's box, uint16 triangles, a role byte)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function unb64(s) {
  const out = new Uint8Array(Math.floor(s.length * 3 / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((s[i + 2] === '=' ? 0 : B64.indexOf(s[i + 2])) << 6) | (s[i + 3] === '=' ? 0 : B64.indexOf(s[i + 3]));
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
const MESH_CACHE = {};
function utilMesh(name) {
  if (MESH_CACHE[name]) return MESH_CACHE[name];
  const M = UTIL_MESH[name];
  if (!M) return null;
  const pb = unb64(M.pos), ib = unb64(M.idx), rb = unb64(M.role);
  const dv = new DataView(pb.buffer), di = new DataView(ib.buffer);
  const P = [];
  for (let i = 0; i < M.nv; i++) P.push([0, 1, 2].map(k => M.lo[k] + (dv.getInt16((i * 3 + k) * 2, true) + 32768) / 65535 * (M.hi[k] - M.lo[k])));
  const T = [];
  for (let t = 0; t < M.nt; t++) T.push([di.getUint16(t * 6, true), di.getUint16(t * 6 + 2, true), di.getUint16(t * 6 + 4, true)]);
  return (MESH_CACHE[name] = { P, T, R: Array.from(rb), lo: M.lo, hi: M.hi });
}
// a generated part set down at (x, y, z), turned by yaw about y: steel triangles to `steelBag`, porcelain to `trimBag`
function placeMesh(name, steelBag, trimBag, x, y, z, yaw) {
  const M = utilMesh(name);
  if (!M) return 0;
  const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
  const W = M.P.map(p => [x + p[0] * c + p[2] * s, y + p[1], z - p[0] * s + p[2] * c]);
  M.T.forEach((t, k) => {
    const a = W[t[0]], b = W[t[1]], d = W[t[2]];
    const n = K.nrm(K.crs(K.sub(b, a), K.sub(d, a)));
    if (!(n[0] === n[0])) return;                          // a degenerate sliver
    face(M.R[k] ? trimBag : steelBag, [a, b, d], n, q => [q[0] + q[2], q[1]]);
  });
  return M.T.length;
}

// THE TAKEOFF MAST (A0, 12 Oct: procedural, ~200 tris; the pack's was hundreds of separate bars): a square lattice
// of 4 legs tapering 0.9 -> 0.5 m over 5 m, a horizontal girt and one diagonal per face per panel, a cross-arm
// at the top with three insulator strings (porcelain: the trim bag) hanging the line off it
function latticeMast(steel, trim, x, y, z, lod) {
  const H = 5.0, wb = 0.9, wt = 0.5, panels = lod === 0 ? 3 : 2, n0 = steel.tris + trim.tris;
  const at = (c, h) => { const w = (wb + (wt - wb) * h / H) / 2; return [x + c[0] * w, y + h, z + c[1] * w]; };
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const c of C) beam(steel, at(c, 0), at(c, H), 0.035, 0.035, [1, 0, 0], 0);
  for (let k = 1; k <= panels; k++) {
    const h0 = H * (k - 1) / panels, h1 = H * k / panels;
    for (let e = 0; e < 4; e++) {
      const a = C[e], b = C[(e + 1) % 4];
      beam(steel, at(a, h1), at(b, h1), 0.02, 0.02, [0, 1, 0], 0);
      if (lod === 0) beam(steel, at(a, h0), at(b, h1), 0.015, 0.015, [0, 1, 0], 0);
    }
  }
  const yA = y + H - 0.1, arm = 1.3;
  beam(steel, [x - arm, yA, z], [x + arm, yA, z], 0.04, 0.05, [0, 1, 0], 0);
  for (const dx of [-arm + 0.15, 0, arm - 0.15]) cyl(trim, [x + dx, yA - 0.55, z], [0, 1, 0], 0.06, 0.5, lod === 0 ? 6 : 4, true);
  return steel.tris + trim.tris - n0;
}

function buildHydro(P, lod, F) {
  const Q = { lod: lod | 0 };
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const LIT = HG.litBegin();
  const occ = [];
  const rnd = (() => { let st = ((P.seed | 0) * 2654435761 + 7) >>> 0; return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const L = P.hL, W = P.hW, out = P.slabOut;
  const x0 = -L / 2, x1 = L / 2, z0 = -W / 2, z1 = W / 2;
  // ==== THE BASE: a concrete slab standing slabH out of the ground (the level pad's median), a skirt into it ====
  const gb = Math.min(g(x0 - out, z0 - out), g(x1 + out, z0 - out), g(x0 - out, z1 + out), g(x1 + out, z1 + out));
  const yS = g(0, 0) + P.slabH;
  boxAB(bags.stone, [x0 - out, gb - 0.8, z0 - out], [x1 + out, yS, z1 + out], { ny: 1 });
  occ.push({ x: 0, z: 0, hx: L / 2 + out, hz: W / 2 + out, k: 0.5 });
  // ==== THE RIPRAP: rough stone down the water side (+z), a band of jittered quads from the base's edge ====
  if (P.riprap > 0.1) {
    const n = Math.max(6, Math.round((L + 2 * out) / 1.6)), m = Q.lod === 0 ? 3 : 1;
    const zA = z1 + out, zB = zA + P.riprap, yA = yS - 0.15, yB = g(0, zB) - 1.4;
    const pt = (i, j) => {
      const u = i / n, v = j / m, x = (x0 - out - 0.4) + u * (L + 2 * out + 0.8);
      const jit = (i > 0 && i < n && j > 0 && j < m) ? (rnd() - 0.5) * 0.45 : 0;
      return [x + jit * 0.6, yA + (yB - yA) * v + jit, zA + (zB - zA) * v + (j > 0 ? (rnd() - 0.5) * 0.4 : 0)];
    };
    const grid = [];
    for (let j = 0; j <= m; j++) { const row = []; for (let i = 0; i <= n; i++) row.push(pt(i, j)); grid.push(row); }
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
      face(bags.stone, [a, d, c, b], K.nrm(K.crs(K.sub(d, a), K.sub(b, a))), q => [q[0] * 0.7, q[2] * 0.7]);
    }
    // a few boulders on the band
    if (Q.lod === 0) for (let k = 0; k < Math.round(L / 2.5); k++) {
      const bx = x0 + rnd() * L, bz = zA + 0.4 + rnd() * (P.riprap - 0.8), s = 0.35 + rnd() * 0.45;
      const by = yA + (yB - yA) * ((bz - zA) / Math.max(0.1, zB - zA));
      boxAB(bags.stone, [bx - s, by - s * 0.4, bz - s * 0.8], [bx + s, by + s * 0.7, bz + s * 0.8], { ny: 1 });
    }
  }
  // ==== THE SHED: walls (the cladding), gables, the two-tone roof, the doors, the windows ====
  const yE = yS + P.hEave, rise = (W / 2 + 0.35) * Math.tan(P.hPitch * Math.PI / 180), yR = yE + rise - 0.35 * Math.tan(P.hPitch * Math.PI / 180);
  boxAB(bags.siding, [x0, yS, z0], [x1, yE, z1], { ny: 1, py: 1 });
  for (const xe of [x0, x1]) {
    const sgn = xe < 0 ? -1 : 1;
    face(bags.siding, [[xe, yE, z0], [xe, yE, z1], [xe, yR, 0]].map(p => p), [sgn, 0, 0], uvFrame([xe, yE, z0], [0, 0, 1], [0, 1, 0]));
  }
  const ov = 0.35, xr0 = x0 - ov, xr1 = x1 + ov, xs = xr0 + (xr1 - xr0) * clamp(P.roofSplit, 0, 1);
  const zE0 = z0 - ov, zE1 = z1 + ov, yEo = yE - ov * Math.tan(P.hPitch * Math.PI / 180);
  const slope = (bag, xa, xb) => {
    if (xb - xa < 0.05) return;
    for (const [zE, sg] of [[zE0, -1], [zE1, 1]]) {
      const n = K.nrm([0, 1, sg * Math.tan(P.hPitch * Math.PI / 180)]);
      face(bag, [[xa, yEo, zE], [xb, yEo, zE], [xb, yR, 0], [xa, yR, 0]], n, q => [q[0], q[2] * (sg < 0 ? -1 : 1)]);
      face(bag, [[xa, yEo - 0.06, zE], [xa, yR - 0.06, 0], [xb, yR - 0.06, 0], [xb, yEo - 0.06, zE]], [0, -1, 0], q => [q[0], q[2]]);   // its underside
    }
  };
  slope(bags.roof, xr0, xs);               // the pale galvanised part
  slope(bags.metal, xs, xr1);              // the rusty red-brown part
  occ.push({ x: 0, z: 0, hx: L / 2 + 0.3, hz: W / 2 + 0.3, k: 0.4 });
  // the roll-up door on the land end (-x), a man door beside it, its lamp
  const dW = Math.min(4.2, W * 0.45), dH = Math.min(4.6, P.hEave * 0.75);
  face(bags.trim, [[x0 - 0.02, yS, -dW / 2], [x0 - 0.02, yS, dW / 2], [x0 - 0.02, yS + dH, dW / 2], [x0 - 0.02, yS + dH, -dW / 2]], [-1, 0, 0], uvFrame([x0, yS, -dW / 2], [0, 0, 1], [0, 1, 0]));
  const mz = Math.min(z1 - 0.8, dW / 2 + 1.4);
  face(bags.trim, [[x0 - 0.02, yS, mz - 0.45], [x0 - 0.02, yS, mz + 0.45], [x0 - 0.02, yS + 2.1, mz + 0.45], [x0 - 0.02, yS + 2.1, mz - 0.45]], [-1, 0, 0], uvFrame([x0, yS, mz - 0.45], [0, 0, 1], [0, 1, 0]));
  bags.glass.setGlow(P.lights ? 1 : 0);
  boxAB(bags.glass, [x0 - 0.14, yS + 2.3, mz - 0.08], [x0 - 0.02, yS + 2.45, mz + 0.08], { px: 1 });
  bags.glass.setGlow(0);
  if (P.lights) LIT.lights.push({ kind: 'porch', x: x0 - 0.3, y: yS + 2.35, z: mz, nx: -1, nz: 0, col: [1.0, 0.82, 0.55], k: 1.0, range: 10.0 });
  // a row of high windows on the water side (+z) - the photo's
  const nWin = Math.round(P.hWin);
  for (let k = 0; k < nWin; k++) {
    const xc = x0 + (k + 0.5) * L / nWin, wy = yS + P.hEave * 0.62, ww = Math.min(1.8, L / nWin * 0.5), wh = 0.9;
    face(bags.pane, [[xc - ww / 2, wy, z1 + 0.02], [xc + ww / 2, wy, z1 + 0.02], [xc + ww / 2, wy + wh, z1 + 0.02], [xc - ww / 2, wy + wh, z1 + 0.02]], [0, 0, 1],
         uvFrame([xc - ww / 2, wy, z1], [1, 0, 0], [0, 1, 0]));
  }
  // ==== THE SWITCHYARD at the land end: a gravel pad, a fence, the mast and the transformer from the pack ====
  let yard = null, yardTris = 0;
  if (P.yard) {
    const yx1 = x0 - out - 2.0, yx0 = yx1 - P.yardL, yz0 = -P.yardW / 2 - 1.5, yz1 = yz0 + P.yardW;
    const yg = Math.max(g(yx0, yz0), g(yx1, yz0), g(yx0, yz1), g(yx1, yz1));
    boxAB(bags.stone, [yx0, yg - 0.5, yz0], [yx1, yg + 0.12, yz1], { ny: 1 });
    // the fence: posts every ~2.5 m, a top rail and a mid wire (a gap on the shed side for the gate)
    const fence = [[yx0, yz0], [yx1, yz0], [yx1, yz1], [yx0, yz1]];
    for (let e = 0; e < 4; e++) {
      const a = fence[e], b = fence[(e + 1) % 4], Ls = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(Ls / 2.5));
      for (let k = 0; k <= n; k++) {
        const t = k / n, px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
        if (k < n || e === 3) beam(bags.steel, [px, yg, pz], [px, yg + 2.1, pz], 0.03, 0.03, [1, 0, 0], 0);
      }
      if (e === 1) continue;                                    // the gate side (toward the shed) left open
      for (const h of [2.05, 1.0]) beam(bags.steel, [a[0], yg + h, a[1]], [b[0], yg + h, b[1]], 0.02, 0.02, [0, 1, 0], 0);
    }
    yardTris += placeMesh('transformer', bags.steel, bags.trim, (yx0 + yx1) / 2 + 0.6, yg + 0.12, (yz0 + yz1) / 2, 0);
    yardTris += latticeMast(bags.steel, bags.trim, yx0 + 1.3, yg + 0.12, yz0 + 1.3, Q.lod);
    occ.push({ x: (yx0 + yx1) / 2, z: (yz0 + yz1) / 2, hx: P.yardL / 2, hz: P.yardW / 2, k: 0.2 });
    yard = { x0: yx0, z0: yz0, x1: yx1, z1: yz1, y: yg + 0.12, tris: yardTris };
  }
  // ==== THE GROUND SKIRT AND THE BAKE ====
  for (const o of occ) o.dry = true;
  if (P.aoGround) HG.buildGroundAO(bags.aoskirt, occ, g);
  const aoInfo = K.bakeAO(BAGS.map(k => bags[k]), { strength: P.ao === undefined ? 0.8 : P.ao, range: P.aoRange || 0.6, ground: g });
  let tris = 0, verts = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of BAGS) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) { const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2];
      if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z; }
  }
  const stats = {
    tris, verts, per, bbox: bb, footprint: (L + 2 * out) * (W + 2 * out), eaveY: yE, ridgeY: yR, floorY: yS,
    role: 'utility', utility: { kind: 'hydro powerhouse', L, W, slabY: yS, roofSplit: P.roofSplit, yard },
    front: { x: x0 - out - 1, z: 0, side: -1, depth: 0 },
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, pier: null, lit: LIT, smoke: null, sign: null, yard: [],
  };
  return { bags, stats, P, V: { L, w: W, wallT: 0.12, floorY: yS }, R: null, MAT: F ? F.MAT : MAT };
}

// the finish: the control towers' own, its dials mapped (a navaid has no timber, no deck, no derelict)
function applyFinish(P, F) { return TW.applyFinish(Object.assign({}, TW.DEF, DEF, P || {}, { derelict: 0 }), F); }
function finishReport() { return TW.finishReport(); }

window.NAVAID_GEN = { DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, SET_IDX, CATS, catOf, build, applyFinish, makeFinish, finishReport };
// THE CATALOGUE: a landmark; the foot is the counterpoise's circle and the shelter west of it; the ground levelled
// under the whole foot (a DVOR wants flat ground round it), the way in from the west (the access road)
window.NAVAID_GEN.CATALOGUE_V = 1;
window.NAVAID_GEN.CATALOGUE_ALIASES = {};
window.NAVAID_GEN.CATALOGUE = Object.keys(PRESETS).map(name => {
  const Pd = Object.assign({}, DEF, PRESETS[name]);
  if (HYDRO(Pd)) {
    // the shed + its base + the riprap on the water side (+z) + the yard at the land end (-x); the way in from -x
    const ext = P => { const p = Object.assign({}, Pd, P || {}); const hx = p.hL / 2 + p.slabOut, hz = p.hW / 2 + p.slabOut;
      return { xw: hx + (p.yard ? p.yardL + 2.5 : 1), xe: hx + 1, zl: Math.max(hz, p.yard ? p.yardW / 2 + 1.5 : 0) + 1, zw: hz + p.riprap + 0.5 }; };
    return { key: 'utility/' + name, kind: 'building', gen: 'NAVAID_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
      foot: P => { const e = ext(P); return [[-e.xw, -e.zl], [e.xe, -e.zl], [e.xe, e.zw], [-e.xw, e.zw]]; }, keepOut: 3,
      ground: { need: 'median', falloff: 6, standing: 'slab' },
      size: P => { const e = ext(P); return { L: e.xw + e.xe, w: e.zl + e.zw }; },
      hooks: P => [{ name: 'gate', kind: 'path', p: [-ext(P).xw - 1, 0, 0], dir: [-1, 0, 0] }], hooksOf: () => [],
      lod: { dist: [0, 200, 600, 1500] }, slots: { lights: 'stats.lit.lights', ao: 'stats.groundAO' },
      tags: ['utility', 'hydro', 'power', 'industrial'], role: 'utility', cat: catOf(name), headless: true, gate: 'HOUSE' };
  }
  const ext = P => { const p = Object.assign({}, Pd, P || {}); const R = p.cpD / 2; return { R: R + 1.5, west: R + (p.shelter ? p.shelterGap + p.shelterW + 1.5 : 1.5) }; };
  const foot = P => { const e = ext(P), out = []; for (let i = 0; i < 24; i++) { const a = 2 * Math.PI * i / 24, c = Math.cos(a);
    out.push([c < 0 ? Math.min(c * e.R, c * e.west) : c * e.R, Math.sin(a) * e.R]); } return out; };
  return { key: 'navaid/' + name, kind: 'building', gen: 'NAVAID_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
    foot, keepOut: 6,
    // the MEDIAN of the ground under the foot (siteShelves' rule for a need that is not 'level'): a 50 m pad
    // levelled to its highest corner would stand on a fill bank on any slope
    ground: { need: 'median', falloff: 10, standing: 'slab' },
    size: P => { const e = ext(P); return { L: e.R + e.west, w: 2 * e.R }; },
    hooks: P => [{ name: 'gate', kind: 'path', p: [-ext(P).west - 1, 0, 0], dir: [-1, 0, 0] }], hooksOf: () => [],
    lod: { dist: [0, 300, 900, 2500] }, slots: { lights: 'stats.lit.lights', ao: 'stats.groundAO' },
    tags: ['navaid', 'vor', 'dme', 'radio'], role: 'navaid', cat: catOf(name), headless: true, gate: 'HOUSE' };
});
})();
