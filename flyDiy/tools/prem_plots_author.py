#!/usr/bin/env python3
# prem_plots_author.py - G2310 PREM-S3: Jolene's PLOTS (premises contract v1.34), written into the record.
#   python3 tools/prem_plots_author.py           # writes tools/fixtures/island_jolene.json (idempotent)
# Each plot is where a player's hangar MAY stand (71_player_bases.js BASE_OFFERS: the plot id is the hangar id). HOME's
# plot is the record's `hangar` (G434), untouched: runwayPlots reads it as plot HOME. The places were SEARCHED, not
# guessed (the search: every 4 m and 22.5 deg round the field's stand, the footprint of the largest shell the plot is
# offered with): on level ground (the footprint's spread <= 0.6 m on land), 3 m off every solid thing the game registers
# (tools/_taxiclear_lib.js: the cooked places, props, cars, trunks), 15 m off the strip's box, the field's routes the
# widest validated build's half-span + 3 m off, and off the fleet's tie-down spots; a slipway (water) on dry shore with
# the water within 40 m of its door. GATE TAXICLEAR 11 / GATE SITE hold the result, so an edit that breaks one fails.
# tw_ski (Skyline) has NO plot: the summit's flat top is the strip, the lodge, the pilot hut, the patrol hut and the wc,
# and every footprint a field shed needs (18 x 20 m, its door 13 m) off them is on a slope of 1 m or more (measured: no
# candidate within 260 m) - a plot there needs a pad cut into the ground, which every player would see (GQ8).
import json, os, sys
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'island_jolene.json')
PLOTS = {
  # the works next door at HOME: north of the apron, its door to the stand's lane; its way joins HOME's taxiOut
  'HOME': [{ 'id': 'HOME.2', 'x': -118.0, 'z': 780.0, 'hdg': -1.9635,
             'stand': { 'x': -130.2, 'z': 750.4, 'hdg': None },
             'taxiOut': [[-126.0, 730.0], [-130.0, 705.0], [-138.0, 690.0], [-137.5, 664.0], [-132.0, 648.0], [-133.0, 590.0], [-120.0, 500.0], [-92.0, 442.0]] }],
  # Tamgas Hill: west of the hut, the door to the strip; its way to the strip's own last point on the centreline
  'w3': [{ 'id': 'w3', 'x': -749.07, 'z': -2345.14, 'hdg': -0.7854,
           'stand': { 'x': -735.0, 'z': -2359.35, 'hdg': None },
           'taxiOut': [[-715.0, -2385.0], [-693.75, -2428.47]] }],
  # Jumbo Mine Street: the derelict shed at the street's north end, its door down the street. NO way of its own: the
  # street's authored pattern is the one MILL-TAXI cleared (G1925), and a generated one from a stand here re-runs its
  # faults (measured: out[1] 3.0 m off the mill, back[0] 3.8 m off the clinic, the parked box 2 m off a prop) - the
  # roll-out from this shed is cut to the street's stand
  'mn_strip': [{ 'id': 'mn_strip', 'x': 7273.0, 'z': -15181.0, 'hdg': -1.5708 }],
  # the slipways: the shed on the shore, its stand on the water off the slip (no way out: the lane is the field)
  'SEA': [{ 'id': 'SEA', 'x': 760.5, 'z': -2851.0, 'hdg': -1.1781, 'slip': True,
            'stand': { 'x': 783.9, 'z': -2907.9, 'hdg': None } }],
  'mk_sea': [{ 'id': 'mk_sea', 'x': -4019.0, 'z': -8629.5, 'hdg': -0.7854, 'slip': True,
               'stand': { 'x': -3978.9, 'z': -8670.0, 'hdg': None } }],
}
def main():
  t = open(P, encoding='utf-8').read()
  d = json.loads(t)
  n = 0
  for r in d['layers']['runways']:
    if r['id'] in PLOTS:
      r['plots'] = PLOTS[r['id']]; n += 1
  out = json.dumps(d, indent=1, ensure_ascii=False) + '\n'
  if out != t:
    open(P, 'w', encoding='utf-8').write(out)
  print('plots on', n, 'runways;', 'written' if out != t else 'unchanged')
if __name__ == '__main__':
  main()
