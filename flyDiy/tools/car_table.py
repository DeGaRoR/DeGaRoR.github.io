#!/usr/bin/env python3
"""car_table.py - THE DECLARED DRIVEABLE CARS (ASSETS-OCT G2908, 2026-10-11).

The user: "make them game ready; they should already be really low poly for most. We should have an
INTERIOR view. We need only one at first, but cool to have several driveable models eventually."
reports/CAR-FEASIBILITY-STUDY-2026-10-02.md (Mesh): a separate body + 4 wheels, the right scale, a known
forward axis, the wheels' centres, a compact collision proxy, camera anchors incl. a driver's eye.

CAR #1 is the Conquer '89 pickup (A0, 11 Oct; the suitability table: futureDesigns/SCENERY-OCT-2026-10-11.md
§ cars): delivered game-ready in metres, +x forward, its four wheels, its steering wheel and its light groups
as their own nodes, a real interior (dash, seats) and full glass. So it is baked AS-IS
([[import-models-as-is]]): no cut, the parts selected by NODE (prop_prep's `nodes`), one prop each:

  car_conquer_body     everything else: body, hood, tailgate, bottom, suspension, interior, the glass and
                       the lamp covers, plates, badges - in the delivered frame (place 'mount')
  car_conquer_wheel_l  the front-left wheel, on its own centre (place 'centre'): the four wheels are two
  car_conquer_wheel_r  meshes (the left pair and the right pair are each one mesh at two places) - the
                       data sheet puts them back at their four centres
  car_conquer_steer    the steering wheel, on its own centre; its axis is on the data sheet
  car_conquer_head / _brake / _reverse / _blink   the lamps, each group its own prop (the game lights them
                       separately: night, braking, reversing, indicating) in the body's frame

`rot` (-0.45 deg about x): the export's root turns the car 0.45 deg off level (its y-up conversion is
89.58 deg, not 90 - the front-left wheel stands 11 mm above the front-right); the levelled car stands
square on its wheels. tools/car_prep.py measures the data sheet (src/cars/car_<key>.json).
"""

GROUPS = [
    ('car', 'driveable cars'),
]

SRC = 'vehicles/driveable'
SOURCES = {
    'conquer': ("Conquer '89 Pickup - Low poly model", 'Daniel Zhabotinsky', 'CC-BY-4.0',
                'https://sketchfab.com/3d-models/conquer-89-pickup-low-poly-model-6c48c94be8974dc7a5932f697c0ba68f'),
}
CREDIT = {'conquer': '"Conquer \'89 Pickup - Low poly model" by Daniel Zhabotinsky (sketchfab.com/DanielZhabotinsky), '
                     'CC BY 4.0, modified (split into parts, levelled)'}
FILE = {'conquer': 'conquer_89_pickup_-_low_poly_model.glb'}
LEVEL = (-0.45, 0, 0)

N = lambda s: 'CnqerP89_' + s
WHEELS = {'FL': N('WheelStock_FL_RB1c_Tire_1k_0'), 'FR': N('WheelStock_FR_RB1c_Tire_1k_0'),
          'RL': N('WheelStock_RL_RB1c_Tire_1k_0'), 'RR': N('WheelStock_RR_RB1c_Tire_1k_0')}
STEER = N('Steering_Wheel_UCB_Interiors_2_0')
LAMPS = {'head': N('Headlights_UCB_Lights_and_Glass_0'), 'brake': N('Brakelights_UCB_Lights_and_Glass_0'),
         'reverse': N('Reverse_UCB_Lights_and_Glass_0'), 'blink': N('Blinkers_UCB_Lights_and_Glass_0')}
BODY = [N(s) for s in (
    'Body_CnqerP89_Bodymat_0', 'front_bumper_UCB_BOTTOM_0', 'hood_CnqerP89_Bodymat_0',
    'Rear_glass_UCB_Lights_and_Glass_Transperent_0', 'Bottom_UCB_BOTTOM_0',
    'Headlights_Glass_UCB_Lights_and_Glass_Transperent_0', 'bumper_rear_UCB_BOTTOM_0',
    'Glass_Passenger_UCB_Lights_and_Glass_Transperent_0', 'Windshield_UCB_Lights_and_Glass_Transperent_0',
    'Interior_UCB_Interiors_2_0', 'Trunkdoor_CnqerP89_Bodymat_0', 'Trunk_door_inner_UCB_BOTTOM_0',
    'Suspension_UCB_BOTTOM_0', 'Glass_Driver_UCB_Lights_and_Glass_Transperent_0',
    'Taillights_Glass_UCB_Lights_and_Glass_Transperent_0', 'Trunk_Cover_UCB_BOTTOM_0',
    'NP_Stock_Rear_Numberplates_Misk_U_0', 'Trunkdoor_Badges_Carbadges_misc_U_0',
    'NP_Stock_Front_Numberplates_Misk_U_0', 'Badges_Body_Carbadges_misc_U_0')]


def P(key, label, nodes, place, note, tex=1024, car='conquer'):
    return dict(key=key, group='car', label=label, src=car, dir=SRC, file=FILE[car], mats=None,
                nodes=nodes, place=place, scale=1.0, rot=LEVEL, tex=tex, note=note, car=car)


PROPS = [
    P('car_conquer_body', "Conquer '89 pickup - body", BODY, 'mount',
      'Body, interior (dash, seats), glass, lamp covers, plates; the delivered frame: +x forward, y up, '
      '+z right (left-hand drive). 16.4 k tris.'),
    P('car_conquer_wheel_l', "Conquer '89 pickup - wheel (left)", [WHEELS['FL']], 'centre',
      'The left wheels (FL, RL are the same mesh): 0.70 m tyre, 0.27 m wide, on its centre.'),
    P('car_conquer_wheel_r', "Conquer '89 pickup - wheel (right)", [WHEELS['FR']], 'centre',
      'The right wheels (FR, RR), mirrored sidewalls, on its centre.'),
    P('car_conquer_steer', "Conquer '89 pickup - steering wheel", [STEER], 'centre',
      'The steering wheel on its centre; it turns about the data sheet\'s `steer.axis`.', tex=512),
] + [P('car_conquer_' + k, "Conquer '89 pickup - %s lamps" % k, [n], 'mount',
       'The %s lamps, in the body\'s frame: lit by the game on their own.' % k, tex=512)
     for k, n in LAMPS.items()]
