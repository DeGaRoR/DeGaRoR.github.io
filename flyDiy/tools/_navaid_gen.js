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
(() => {
'use strict';
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const TW = window.TOWER_GEN;
const { clamp, Bag, face, uvFrame, boxAB, beam, cyl } = K;

// BEGIN GENERATED (tools/hydro_prep.py - the switchyard parts cut from "Substation" by One80 Solar, CC BY 4.0)
const UTIL_MESH = {"mast":{"lo":[-0.3696,0.0,-0.4798],"hi":[0.3696,5.0375,0.4798],"nv":1043,"nt":738,"pos":"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","idx":"AgAAAAEAAwACAAEAAQAFAAMAAwAFAAQABgAFAAEABAAFAAYABgADAAQABgABAAMAAAACAAQACAAHAAoACAAMABQACAAUAAkADgAIAAkADgAJAAoADAALABcACAALAAwACgANAAsADwAQAA4ACAAOABAACAAQABEACAARAAcAEQATAAcAEAAPABUAEAAVABYAEgAQABYAEgAWABQAEwASABQAEwAUABUADwATABUAEgATAA8ADQAWABcAGAAUAA0AFwAUABgAGAANABcAFAAWAA0AFwAWABUAFwAVABQAEgAPABAADgAHAA8ACgAJAA0ACAAKAAsACgAHAA4AGwAZABoAGQAbABoAHgAcAB0AHAAeAB0AIQAfACAAHwAhACAAIgAjACQAIwAiACQAJgAlACcAJgAnACUAKgAoACkAKgApACgALAAtACsALAArAC0ALgAvADAALgAwAC8AMgAxADMAMgAzADEANgA0ADUANAA2ADUAOAA5ADcAOAA3ADkAOgA7ADwAOgA8ADsAPQA/AD4APgA/AD0AQgBAAEEAQgBBAEAARABDAEUARABFAEMARgBHAEgARgBIAEcASQBLAEoASgBLAEkATABOAE0ATQBOAEwAUQBPAFAATwBRAFAAUgBUAFMAUwBUAFIAVwBVAFYAVQBXAFYAWQBYAFoAWQBaAFgAXQBbAFwAXQBcAFsAXgBgAF8AXwBgAF4AYwBhAGIAYQBjAGIAZQBkAGYAZQBmAGQAZwBoAGkAZwBpAGgAagBrAGwAagBsAGsAbQBvAG4AbgBvAG0AcABxAHIAcAByAHEAcwB1AHQAcwB0AHUAdgB3AHgAdgB4AHcAeQB7AHoAeQB6AHsAfAB9AH4AfQB8AH4AfwCBAIAAfwCAAIEAggCDAIQAggCEAIMAhgCFAIcAhgCHAIUAiACJAIoAiACKAIkAiwCNAIwAiwCMAI0AkACOAI8AjgCQAI8AkQCTAJIAkgCTAJEAlQCUAJYAlQCWAJQAlwCYAJkAlwCZAJgAmgCcAJsAmwCcAJoAnQCeAJ8AngCdAJ8AoQCgAKIAoQCiAKAApACjAKUAowCkAKUApgCoAKcApwCoAKYAqQCqAKsAqgCpAKsArACuAK0ArQCuAKwArwCwALEArwCxALAAsgCzALQAsgC0ALMAtQC3ALYAtQC2ALcAuAC5ALoAuQC4ALoAuwC8AL0AuwC9ALwAwAC+AL8AvgDAAL8AwwDCAMEAwQDCAMMAxgDEAMUAxADGAMUAyADJAMcAxwDJAMgAygDLAMwAygDMAMsAzQDPAM4AzQDOAM8A0gDQANEA0ADSANEA0wDUANUA0wDVANQA1gDXANgA1gDYANcA2QDbANoA2QDaANsA3ADeAN0A3ADdAN4A4QDfAOAA3wDhAOAA4wDkAOIA4gDkAOMA5QDnAOYA5QDmAOcA6ADpAOoA6ADqAOkA6wDsAO0A6wDtAOwA7wDwAO4A7gDwAO8A8QDyAPMA8gDxAPMA9AD1APYA9AD2APUA9wD5APgA9wD4APkA+gD8APsA+gD7APwA/QD/AP4A/QD+AP8AAAEBAQIBAAECAQEBAwEFAQQBAwEEAQUBBgEHAQgBBgEIAQcBCQELAQoBCQEKAQsBDAENAQ4BDAEOAQ0BDwERARABEAERAQ8BEgETARQBEgEUARMBFQEXARYBFQEWARcBGAEZARoBGQEYARoBGwEdARwBHAEdARsBHgEfASABHgEgAR8BIQEjASIBIQEiASMBJAEmASUBJQEmASQBJwEoASkBJwEpASgBKgEsASsBKwEsASoBLQEuAS8BLQEvAS4BMQEwATIBMQEyATABMwE0ATUBMwE1ATQBNgE4ATcBNwE4ATYBOwE5AToBOQE7AToBPAE+AT0BPAE9AT4BPwFAAUEBPwFBAUABQgFDAUQBQgFEAUMBRwFGAUUBRgFHAUUBSQFIAUoBSgFIAUkBTAFNAUsBTQFMAUsBTwFQAU4BTwFOAVABUgFTAVEBUgFRAVMBVQFWAVQBVQFUAVYBWAFZAVcBWAFXAVkBWwFcAVoBWwFaAVwBXgFfAV0BXgFdAV8BYgFhAWABYQFiAWABZAFjAWUBZQFjAWQBZwFoAWYBaAFnAWYBagFrAWkBagFpAWsBbQFuAWwBbQFsAW4BcAFxAW8BcAFvAXEBcwF0AXIBcwFyAXQBdgF3AXUBdgF1AXcBeQF6AXgBeQF4AXoBfQF8AXsBfAF9AXsBfwF+AYABgAF+AX8BggGDAYEBgwGCAYEBhAGFAYYBhAGGAYUBhwGIAYkBhwGJAYgBigGLAYwBigGMAYsBjQGOAY8BjQGPAY4BkAGRAZIBkAGSAZEBkwGUAZUBkwGVAZQBlgGYAZcBlgGXAZgBmgGZAZsBmQGaAZsBngGcAZ0BngGdAZwBoQGfAaABoQGgAZ8BowGiAaQBogGjAaQBpQGnAaYBpgGnAaUBqgGpAagBqgGoAakBrAGrAa0BqwGsAa0BrgGwAa8BrwGwAa4BswGyAbEBsgGzAbEBtAG1AbYBtAG2AbUBuAG3AbkBtwG4AbkBvAG7AboBvAG6AbsBvwG9Ab4BvwG+Ab0BwQHAAcIBwAHBAcIBwwHFAcQBxAHFAcMByAHHAcYByAHGAccByQHKAcsBygHJAcsBzAHOAc0BzQHOAcwB0QHQAc8B0AHRAc8B1AHSAdMB1AHTAdIB1gHVAdcB1QHWAdcB2gHYAdkB2gHZAdgB3QHcAdsB3QHbAdwB3gHfAeAB3wHeAeAB4QHjAeIB4gHjAeEB5AHmAeUB5QHmAeQB6AHnAekB5wHoAekB6gHsAesB6wHsAeoB7wHuAe0B7gHvAe0B8gHxAfAB8gHwAfMBIQD1AfIBHgAhAPIBHgDyAfMBGQAeAPMBGQDwAR4AHgDxASEAIQDxAfYBIQD2ASMAIQAjAPUB9AH2AfUB9QH2AfEBIwD0AfUBIwAZAPQBIwD2ARkA8wH2AfQBGQDzAfQB8wHwAfYB9QHxAfIBHgDwAfEBGQD2AfAB+AH3AfkB9wH4AfkB+gH8AfsB+wH8AfoB/QH/Af4B/gH/Af0BAAIBAgICAQIAAgICAwIFAgQCBAIFAgMCCAIHAgYCBwIIAgYCCgIJAgsCCQIKAgsCDAIOAg0CDQIOAgwCDwIRAhACEAIRAg8CFAISAhMCEgIUAhMCFQIXAhYCFgIXAhUCGgIZAhgCGQIaAhgCHAIbAh0CGwIcAh0CHgIgAh8CIAIeAh8CIQIjAiICIwIhAiICJgIkAiUCJAImAiUCJwIpAigCKQInAigCLAIrAioCKwIsAioCLwItAi4CLQIvAi4CMgIwAjECMAIyAjECNQIzAjQCMwI1AjQCOAI2AjcCNgI4AjcCOwI5AjoCOQI7AjoCPgI8Aj0CPAI+Aj0CQAI/AkECQAJBAj8CRAJCAkMCQgJEAkMCRwJFAkYCRQJHAkYCSQJIAkoCSAJJAkoCTQJLAkwCSwJNAkwCUAJPAk4CTwJQAk4CUwJSAlECUgJTAlECVgJVAlQCVQJWAlQCWQJYAlcCWAJZAlcCXAJaAlsCWgJcAlsCXwJdAl4CXQJfAl4CYQJiAmACYgJhAmACZQJkAmMCZAJlAmMCaAJnAmYCZwJoAmYCawJqAmkCagJrAmkCbgJsAm0CbAJuAm0CcQJvAnACbwJxAnACcwJ0AnICcgJ0AnMCdwJ2AnUCdgJ3AnUCegJ5AngCeQJ6AngCfQJ8AnsCfAJ9AnsCfwKAAn4CfwJ+AoACggKDAoECggKBAoMChgKEAoUChgKFAoQCiQKIAocCiAKJAocCjAKLAooCiwKMAooCjwKOAo0CjgKPAo0CkQKSApACkQKQApIClAKVApMClAKTApUClgKXApgClgKYApcCmgKbApkCmgKZApsCngKdApwCngKcAp0CoQKgAp8CoAKhAp8CpAKjAqICowKkAqICpwKmAqUCpgKnAqUCqQKqAqgCqQKoAqoCrAKtAqsCrAKrAq0CsAKuAq8CrgKwAq8CsgKxArMCsgKzArECtQK2ArQCtAK2ArUCuQK4ArcCuAK5ArcCvAK7AroCuwK8AroCvwK+Ar0CvgK/Ar0CwgLAAsECwgLBAsACxALFAsMCxALDAsUCxgLHAsgCxwLGAsgCywLJAsoCywLKAskCzQLMAs4CzALNAs4C0ALPAtECzwLQAtEC0wLSAtQC0gLTAtQC1gLVAtcC1QLWAtcC2QLYAtoC2ALZAtoC3ALbAt0C2wLcAt0C3wLeAuAC3gLfAuAC4gLhAuMC4QLiAuMC5QLkAuYC5ALlAuYC6ALnAukC5wLoAukC6wLqAuwC6gLrAuwC7gLtAu8C7QLuAu8C8QLwAvIC8ALxAvIC9ALzAvUC8wL0AvUC9wL2AvgC9gL3AvgC+gL5AvsC+QL6AvsC/QL8Av4C/AL9Av4CAAP/AgED/wIAAwEDAwMCAwQDAgMDAwQDBgMFAwcDBQMGAwcDCAMKAwkDCAMJAwoDDQMLAwwDCwMNAwwDEAMOAw8DDgMQAw8DEwMRAxIDEQMTAxIDFgMUAxUDFAMWAxUDGQMXAxgDGQMYAxcDGwMaAxwDGgMbAxwDHwMeAx0DHgMfAx0DIQMiAyADIgMhAyADJAMlAyMDJQMkAyMDKAMnAyYDJwMoAyYDKwMqAykDKgMrAykDLAMtAy4DLQMsAy4DLwMxAzADLwMwAzEDMgMzAzQDMwMyAzQDNQM2AzcDNgM1AzcDOAM5AzoDOQM4AzoDOwM8Az0DPAM7Az0DPwM+A0ADPgM/A0ADQgNBA0MDQQNCA0MDRANFA0YDRQNEA0YDSANHA0kDRwNIA0kDSgNLA0wDSwNKA0wDTgNPA00DTgNNA08DUQNQA1IDUANRA1IDVANVA1MDVANTA1UDVwNYA1YDVwNWA1gDWgNZA1sDWQNaA1sDXQNcA14DXANdA14DXwNgA2EDYANfA2EDYwNkA2IDYwNiA2QDZQNmA2cDZgNlA2cDaANpA2oDaQNoA2oDbQNrA2wDawNtA2wDcANvA24DcANuA28DcwNxA3IDcQNzA3IDdgN0A3UDdAN2A3UDeQN3A3gDdwN5A3gDfAN6A3sDegN8A3sDfwN9A34DfwN+A30DgQOAA4IDgAOBA4IDhQOEA4MDhAOFA4MDhwOIA4YDiAOHA4YDigOLA4kDiwOKA4kDjgONA4wDjQOOA4wDkQOQA48DkAORA48DkgOTA5QDkwOSA5QDlgOXA5UDlgOVA5cDmgOZA5gDmQOaA5gDnQOcA5sDnAOdA5sDnwOeA6ADngOfA6ADogOhA6MDoQOiA6MDpgOlA6QDpQOmA6QDqQOoA6cDqAOpA6cDqwOqA6wDqgOrA6wDrwOuA60DrQOuA68DsQOwA7IDsAOxA7IDtAO1A7MDtAOzA7UDuAO3A7YDtgO3A7gDugO7A7kDugO5A7sDvQO8A74DvAO9A74DwQPAA78DvwPAA8EDwwPEA8IDwwPCA8QDxgPFA8cDxQPGA8cDyQPKA8gDyQPIA8oDzQPMA8sDzAPNA8sD0APPA84DzwPQA84D0wPRA9ID0QPTA9ID1gPVA9QD1gPUA9UD2QPXA9gD1wPZA9gD3APaA9sD2gPcA9sD3wPdA94D3QPfA94D4gPgA+ED4APiA+ED5QPjA+QD5QPkA+MD5wPmA+gD5gPnA+gD6wPqA+kD6gPrA+kD7QPuA+wD7gPtA+wD8APxA+8D8QPwA+8D9APzA/ID8wP0A/ID9gP3A/UD9wP2A/UD+AP5A/oD+QP4A/oD+wP8A/0D/AP7A/0D/gP/AwAE/wP+AwAEAQQCBAMEAgQBBAMEBAQFBAYEBQQEBAYEBwQIBAkECAQHBAkECgQLBAwECwQKBAwEDQQOBA8EDgQNBA8EEAQRBBIEEQQQBBIE","role":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"},"transformer":{"lo":[-2.1442,0.0,-1.4722],"hi":[2.1442,2.8448,1.4722],"nv":449,"nt":450,"pos":"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","idx":"AQADAAAAAQAFAAYAAgAEAAUAAwAGAAQABgAHAAQABAAJAAUABwAJAAQACQAKAAUABQAKAAgABwAIAAkACAAKAAsACgAMAA0ACgANAAsACAALAAkACgAJAAwACwAOAAwADQAPAAsACwAPAA4ADAAOABAADAAQAA0ADQAQAA8ADgARABAAEAARAA8ADwARAA4ACwAMAAkABQAIAAcABgAFAAcAAwAEAAIAAQAGAAMAAgAFAAEAAAADAAIAAAACAAEAEgATABUAEgAWABMAEwAUABUAFQAUABkAFQAZABYAFAAYABkAFgAYABQAGQAXABYAFgAXABgAFwAaABgAGgAbABgAGQAeABoAGgAdABsAHAAfAB4AHQAeACEAHwAgAB4AHQAhAB8AHgAgACEAIQAiAB8AIAAiACEAHwAiACAAHQAfABwAGwAcAB4AHQAcABsAHgAdABoAGwAeABkAGAAbABkAGQAaABcAEwAWABQAFQAWABIAIwAnACQAIwAlACcAIwAkACUAJgAlACQAJgAsACgAKAApACcAKAAqACkAKQAqACsAKQArACwAKgAtAC8AKwAvACwALwAuACwALgAvADAALwAxADAALQAyADEAMAAxADQAMAA0ADIAMAAyAC0AMgAzADEAMQAzADUAMgA0ADMANQA2ADQANAA2ADMAMwA2ADUAMQA1ADQALwAtADEALgAwAC0ALAAuAC0ALAAtACoAKgAvACsALAAqACgAKQAsACYAJwApACYAJQAoACcAJgAoACUAJwAmACQAOgA7ADkAOwA8ADgAOQA7ADgAOAA8ADoAPAA9ADoAOgA9ADsAPQA+ADsAOwA+AD8APwBBAEAAPwA+AEEAQABCAD4AQQBCAEAAQgBDAD4APgBDAEEAQwBEAEEAQQBEAEIAQgBEAEcAQgBHAEMAQwBFAEQARABFAEYARABGAEcAQwBHAEUARgBIAEcARwBIAEUARQBIAEYAPQBAAD4APwBAAD0APAA/AD0AOwA/ADwANwA6ADkAOAA6ADcANwA5ADgAYgBhAGMAYQBiAGMAZQBkAGYAZABlAGYAaABnAGkAZwBoAGkAagBrAGwAawBqAGwAbgBtAG8AbQBuAG8AcgBxAHAAcQByAHAAdABzAHUAcwB0AHUAdwB2AHgAdgB3AHgAegB5AHsAeQB6AHsAfgB8AH0AfAB+AH0AgAB/AIEAfwCAAIEAhACDAIIAgwCEAIIAhgCFAIcAhQCGAIcAiACKAIkAiQCKAIgAiwCNAIwAjACNAIsAkACOAI8AjgCQAI8AkQCTAJIAkgCTAJEAlgCVAJQAlQCWAJQAmACXAJkAlwCYAJkAmgCcAJsAnACaAJsAnQCfAJ4AnwCdAJ4AoQCgAKIAoAChAKIAowClAKQApQCjAKQAqACnAKYApwCoAKYAqQCqAKsAqwCqAM8AqwCqAKkArgCtAKwArQCuAKwAsACxAK8AsQCwAK8AsgCzALQAtQCyALQAswC1ALQAtQCzALYAsgC1ALMAuAC5ALcAugC3ALkAugC5ALcAuAC3ALkAvQC7ALwAvgC7ALwAvQC8ALsAvgC8ALsAwADBAL8AwgC/AMEAwgDBAL8AwAC/AMEAxADFAMMAxgDDAMUAxgDFAMMAxADDAMUAxwDIAMkAygDHAMkAyADKAMkAygDLAMcAyADHAMoAzADOAM0A0ADRANIA0wDQANIA1ADQANMA0wDVANQA1ADVANYA1gDXANQA2ADXANYA1gDZANgA2gDZANgA2wDaANgA3ADaANsA2wDdANwA3ADdAN4A3gDfANwA0gDfAN4A3gDfANEA3QDfAN4A3wDdANwA3ADdANoA2wDaAN0A2QDaANsA2ADZANsA2ADZANcA1gDXANkA1QDXANYA1wDVANQA1ADVANAA0wDQANUA3gDRANIA0gDRANMA0gDRAN8A0QDQANMA4QDiAOAA4gDhAOAA5gDvAO0A6QDuAOsA5ADtAOcA7wDmAOUA6QDqAO4A6gDrAOgA6ADjAOoA6wDsAOgA6wDqAOkA7ADrAO4A5wDvAOQA7QDvAOgA7QDkAOYA5QDkAO8A7QDoAOcA5wDoAOwA7gDjAOwA4wDuAOoA7wDjAOgA4wDvAOwA7ADvAOcA8QD0APoA9gDwAPQA9ADyAPYA+QD7APUA8gD5APMA9QDzAPkA8wD2APIA8AD2APkA9wD6APwA8AD5APIA+ADwAPIA+AD8APoA+gD3APEA8AD4APoA9gDzAPsA+wD5APYA8gD0APgA/AD4APQA9ADxAPwA9ADwAPoA/QADAQEBAQH+AP0A/gABAQIBAgH/AP4A/wACAQMBAAEDAQIBAgEBAQABAwH9AP8ABgEFAQQBCQEKAQsBCwEMAQkBDgEPAQ0BDQEPARABDwENARABDgENAQ8BEQESARMBEgERARQBEgERARMBEQESARQBFgEXARUBFwEWARUBGgEYARkBGgEbARgBHAEYARsBHAEbARkBGAEcARkBGgEZARsBIwEkASUBJgEnASgBMQEyATMBMwE0ATEBMQE0ATUBNAEzATUBNAE2ATMBNgEyATQBMgE1ATMBMQE1ATIBOQE3ATgBOQE4ATcBPwFGAUUBOwE6AUIBPQFFAUABRgE/AT4BOgFDAUIBQQE8ATsBQgFEAUEBQQE7AUIBRAFCAUMBQAFGAT0BRQFGAUEBRQE9AT8BPgE9AUYBRQFBAUABQAFBAUQBOgE7AUMBQwE8AUQBPAFDATsBRgE8AUEBPAFGAUQBRAFGAUABSAFLAVEBTgFHAUsBSwFJAU4BTQFSAUwBSQFNAUoBTAFKAU0BSgFOAUkBRwFOAU0BTwFRAVMBRwFNAUkBUAFHAUkBUAFTAVEBUQFPAUgBRwFQAVEBTgFKAVIBUgFNAU4BSQFLAVABUwFQAUsBSwFIAVMBSwFHAVEBVAFaAVgBWAFVAVQBVQFYAVkBWQFWAVUBVgFZAVoBVwFaAVkBWQFYAVcBWgFUAVYBXQFcAVsBZgFnAWgBaAFpAWYBZgFpAWoBaQFoAWoBaQFrAWgBawFnAWkBZwFqAWgBZgFqAWcBbQFxAWwBcAFtAWwBbAFuAW8BcAFsAW8BbwFuAXEBbwFxAW0BbwFtAXABbAFxAW4BcwF4AXYBcwF2AXQBcgFzAXQBcgF0AXcBdwF1AXMBdQF4AXMBdAF2AXgBdAF4AXUBdwF0AXUBdwFzAXIBewF5AXoBeQF7AXoBfgF8AX0BfAF+AX0BgQF/AYABgQGAAX8BhAGDAYIBgwGEAYIBhwGGAYUBhgGHAYUBigGJAYgBiQGKAYgBjQGLAYwBiwGNAYwBkAGOAY8BkAGPAY4BkgGRAZMBkQGSAZMBlgGVAZQBlQGWAZQBmQGYAZcBmAGZAZcBnAGbAZoBmwGcAZoBnQGeAZ8BnQGfAZ4BogGgAaEBogGhAaABpAGjAaUBowGkAaUBqAGnAaYBpwGoAaYBqwGqAakBqgGrAakBrgGtAawBrQGuAawBrwGwAbEBrwGxAbABswGyAbQBswG0AbIBtQG3AbYBtgG3AbUBugG5AbgBuQG6AbgBvQG8AbsBvAG9AbsBwAG/Ab4BvwHAAb4B","role":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}};
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
};
const ROWS = [
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
const PRESETS = {
  'DVOR-DME': {},                                                  // the FAA's: Annette Island ANN 117.1
  'DVOR-DME compact': { cpD: 100 * FT, sbN: 48, shelterGap: 2.5 },   // the conventional 30 m counterpoise
};
const CATS = { 'DVOR-DME': 'landmark', 'DVOR-DME compact': 'landmark' };
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
