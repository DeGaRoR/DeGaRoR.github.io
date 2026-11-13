# STAND-PAD / PARKING-AREA / START-CHAIN - the data shapes (Game coordinator, 13 Nov; branch claude/stand-pad)

For the [CLOUD] chips that build on them (DOCKS-LODGE, WILD-SITES, COMMUNITY-AIRPORT, OBSERVATORY-SITE). These shapes are
STABLE: build on them, do not rename. The island record is tools/fixtures/island_jolene.json (+ tools/jolene_parts/*.json).

## 1. The stand's pad - `runways[i].stand.pad`
    stand: { x, z, hdg|null, pad?: 'auto' (absent = auto) | 'off' | { w, l, falloff } }
- auto: 27_premises.js standPadOf makes a DERIVED ramp under the stand + its lead-in when the stand's grade (6 m baseline,
  worst of its centre and 4 m around, ground as composed so far) is over STAND_PAD.grade (0.02). Level across at the
  centreline's profile height at the stand's station, following the strip's gradient along it; across: the strip's edge to
  the stand's far side (w 22 m); along: 26 m centred; falloff 12 m. Applied BEFORE the strip's grade (the strip keeps its
  heights). Steps aside when its box (+ falloff) meets an AUTHORED terrain modifier.
- { w, l, falloff }: forced, whatever the grade (and even over authored terrain).
- The composed site says it: `siteOf(id).standPad = { level, slope }`.
- Editor: the stand's inspector row "pad under the stand" (premises_ui standPadRows).
- A water lane's dock (DOCKS-LODGE): a lane has no grade - give a lane's stand `pad: 'off'` or leave it absent (water lanes
  never reach standPadOf: compose skips them as sea lanes).

## 2. A parking area - an area's pavement draw `parking`
    areas[] = { id, poly | round: { c, r, n? } | rect, props: { draw: { look: <pavement class>, yaw, parking: { gap?, rowGap?, max? } }, wheels: {...} } }
- expandAreas copies the draw onto its material entry; 27_premises pavePolys carries `parking`; the cook (tools/fleet_spots.js
  via _taxiclear_lib paveOf) hands it to 25_airfield fleetSpots, which fills it FIRST (step 0): a grid centred in the area in
  its lanes' frame (yaw: the nose along the lanes), span + gap across, length + rowGap along, every corner inside the area,
  then the fleet's rules; parking.max caps the area; FLEET_SPOT.max (12) the field. Spot ids 'park:<area id>:<n>'.
- A circle: an area with `round` (its 24-gon). Spots appear in play after `node tools/fleet_spots.js --cook`.
- Editor: the area's pavement section, "parked aeroplanes fill it" (+ gap, at most).

## 3. The start chain - app.js applyRoute -> startChain(aeroId, st, front, flown)
- front = the hangar's door walked out (standFor(site, shedDims)) or, with no hangar, `site.stand`.
- free = no player's aeroplane (FLEET_STAND.plan at that field, the flown one aside) and no scenery `site.parked` aeroplane
  within START_FREE_R (12 m) -> start there ('front').
- else the field's first free cooked spot (FLEET_SPOTS_PACK.aero[id]), 'park:' spots first, hdg = -ry ('parking').
- else null -> the line-up (placeLinedUp) ('lineup'). A tie-down spot chosen in Storage still wins ('spot').
- The page says which: `window.FLYDIY_START_WHY()`.
- Water lanes never reach it today (applyRoute's hydro branch places the plane on the lane's spawn): DOCKS-LODGE adds the
  water front (a lane's dock as its stand) in that branch, with the same free test and the lane's spawn as the fallback.

Gates: PREMISES 35 (the pad), SCENERYED 43 (the editor row + the ground re-sample rule), PARKING (the area fill + the chain's
source rows). Lands as claude/ready/stand-pad (L40c, refs Sat 20:00), rebased on Sat master.
