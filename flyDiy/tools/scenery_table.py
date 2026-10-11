#!/usr/bin/env python3
"""scenery_table.py - THE DECLARED SCENERY KIT (ASSETS-OCT, G2900-G2909, 2026-10-11).

The user (11 Oct): "Most of them need a round of game-readification. There are
many raw scans, and we need the full chain: decimation, reprojection, like we
have done with the woodworking machines ... the buildings are important, large
assets, but the bulldozer and starfighter are only scenery elements and should
be kept reasonable." The goal: new fantasy locations; SCENERY-ED's model placer
reads this kit (A0, 11 Oct: the pier-style kit is the bank's format).

Every row is a delivered Sketchfab model under assets/sceneryOctober/ (never
edited), CC BY 4.0 - `credit` is the line the credits screen carries. The
LICENCE table and the SPEC table are futureDesigns/SCENERY-OCT-2026-10-11.md.

TWO STAGES, like the woodworking machines (G1240):
  1. tools/scenery_prep.py (Blender, CPU) cuts the delivered model to `prep`'s
     budget and reprojects it onto one clean atlas -> assets/sceneryOctober_prep/
     <key>/<key>.glb (gitignored, the bake SOURCE). tools/observatory_prep.py is
     the observatory's own stage 1 (textured from the house library).
  2. tools/scenery_kit.py (prop_prep's runner) bakes that file like any prop ->
     src/scenery/scenery_<group>.js + media/geo/scenery + media/tex/scenery;
     node tools/prop_lod.js --kit scenery cuts the far levels (`lodOf`/`lodDist`).

Each row is props_table.py's P() plus:
  credit  {title, author, licence, source}
  prep    the stage-1 recipe: route ('scan' | 'model' | 'asis' | 'observatory'),
          target tris (L0), size (atlas px), tol (m: past it a source vertex is a
          feature the cut lost), scale, crop (scan terrain trims, Blender frame)
  height  the standing height after the scale (the gate checks it, +-3 %)
"""
GROUPS = [
    ('landmark', 'landmark buildings'),
    ('vessel', 'ships and boats'),
    ('wreck', 'machines and wrecks'),
    ('crowd', 'people'),
]

SRC = 'sceneryOctober'
PREP = 'sceneryOctober_prep'


def C(title, author, handle, url):
    return dict(title=title, author=author, licence='CC BY 4.0',
                source='https://sketchfab.com/3d-models/' + url,
                line='"%s" by %s (sketchfab.com/%s), CC BY 4.0, modified' % (title, author, handle))


def P(key, group, label, file, note, credit, prep, height, place='level', tex=2048, mats=None):
    # a prepped row is baked from its stage-1 file (the scale and the placement already
    # in it: `place` 'level' = centred in plan, its own z 0 kept - a scan's ground, a
    # vessel's waterline); an as-is row from the delivered file
    asis = prep['route'] == 'asis'
    return dict(key=key, group=group, label=label, src=key, note=note,
                mats=mats, place=place, scale=prep.get('scale', 1.0) if asis else 1.0, rot=(0, 0, 0), tex=tex,
                dir=SRC if asis else PREP + '/' + key, file=file if asis else key + '.glb',
                delivered=file, credit=credit, prep=prep, height=height)


PROPS = [
    # ---- landmarks -----------------------------------------------------------
    P('heating_plant', 'landmark', 'abandoned heating plant',
      'abandoned_heating_plant_-_scan.glb',
      'Photoscan, 1.2 M tris on ONE 1024 map. The blue-clad boiler house, its chimney stack and the '
      'coal conveyor; the 74 x 46 m scanned site cut back to them + a 3 m apron (scanned shrubs and '
      'far terrain dropped - our ground, grass and trees do them better), the cut edge skirted down.',
      C('Abandoned Heating Plant - Scan', 'illusoXR', 'illusoXR',
        'abandoned-heating-plant-scan-67ce905f1f9643ff8c5b31424467e9ec'),
      dict(route='scan', target=60000, size=2048, tol=0.05, scale=1.0,
           crop=dict(keep=[(-34, -2, -15, 16), (-4, 8, -13, -3), (-4, 35, -3, 3), (14, 25, -10, -4)],
                     apron=[(-35, -1, -16, 17), (-5, 9, -14, -2)])),
      height=None),
    P('bunker', 'landmark', 'WW2 cliff-top bunker', 'devils_slide_bunker_-_pacifica_ca.glb',
      'Photoscan of the Devil\'s Slide fire-control bunker on its rock mound (the mound kept: it is '
      'the cliff top it stands on), graffiti and all; the mound\'s rim skirted down.',
      C("Devil's Slide Bunker - Pacifica, CA", 'Azad Balabanian', 'azadbal',
        'devils-slide-bunker-pacifica-ca-52982f5a24834be48dab4057d2df1c3d'),
      dict(route='scan', target=24000, size=2048, tol=0.03, scale=1.0, crop=dict(skirt=True)),
      height=None),
    P('sky_rest', 'landmark', 'ruined sky-rest tower', 'abandoned_new_muroto_sky_rest_resort_japan (1).glb',
      'Photoscan already cut to 5.2 k by its author, one 4096 map: no cut, the map to 2048.',
      C('Abandoned New Muroto Sky Rest resort, Japan', 'Raiz', 'RaizVR',
        'abandoned-new-muroto-sky-rest-resort-japan-14cbb0fa1a4d4be2af20c910e10beb0d'),
      dict(route='asis', size=2048, scale=1.0), height=None, place='floor'),
    P('observatory', 'landmark', 'ridge observatory', 'tutor_tv_observatory.glb',
      'Modelled, delivered untextured; scaled 0.25 by its stairs (14 x 10 x 9.4 m) and textured from '
      'the house library (tools/observatory_prep.py) - FOR THE USER\'S REVIEW.',
      C('Tutor TV Observatory', 'Tommen', 'Tommen', 'tutor-tv-observatory-28a2c1ff61304e6eb36b6840b43e2fc1'),
      dict(route='observatory', target=20000, size=2048, scale=0.25), height=9.42),
    # ---- vessels -------------------------------------------------------------
    P('ferry_merituuli', 'vessel', 'island car ferry', 'hailuoto_car_ferry_la_merituuli.glb',
      'Modelled, 1303 meshes and 22 materials: flattened to one atlas, the glass and the lamps their own.',
      C('Hailuoto car ferry L/A Merituuli', 'Snowsoup', 'snowsoup',
        'hailuoto-car-ferry-la-merituuli-6e3a4f3513bd4529854552b7afb0a7ac'),
      dict(route='model', target=30000, size=2048, tol=0.02, scale=1.0, margin=1.0), height=None),
    P('fishing_boat', 'vessel', 'steel fishing boat', 'boat_fishing.glb',
      'Modelled game asset, 27 k on its own clean uvs and 1024 maps: AS-IS ([[import-models-as-is]]) - '
      'a reprojection packed its 2 400 islands (rails, rigging) at 22 % and lost its maps detail; '
      'the far levels by prop_lod.js half-edge cut on its own uvs.',
      C('Boat Fishing', 'mortalityrexotable', 'mortalityrexotable', 'boat-fishing-1874f9a9e58a408d988f8a09771886a5'),
      dict(route='asis', size=1024, scale=1.0), height=None, tex=1024),
    # ---- machines and wrecks ---------------------------------------------------
    P('starfighter', 'wreck', 'F-104G gate guardian', 'f-104_g_starfighter.glb',
      'Photoscan of a stripped F-104G, 996 k on 4 UDIM tiles: one atlas. Scaled x1.09: the scan is '
      '~9 % small on all three axes against the type (16.7 m long, 6.63 m span, 4.11 m tall).',
      C('F-104 G Starfighter', 'fhernand', 'fhernand', 'f-104-g-starfighter-5cdfee92623e4b59bc967be7537b1372'),
      dict(route='scan', target=16000, size=2048, tol=0.02, scale=1.09), height=4.09),
    P('loader_wreck', 'wreck', 'abandoned wheel loader', 'abandoned_bulldozer.glb',
      'Photoscan, 50 k ("bulldozer" in the file; an articulated wheel loader). SCALED 0.6: the scan '
      'stands 12.9 m long, 6.2 m tall, 5 m wide over its dirt plate, where a loader of this cab and '
      'bucket is ~8 m, 3.4-3.7 m and 2.9 m (all three ~1.7x). The plate cut to a 0.5 m pad, skirted.',
      C('Abandoned bulldozer', 'lebeden', 'lebeden', 'abandoned-bulldozer-3ee4f4ffb57e4a66a968dd3491e48711'),
      dict(route='scan', target=10000, size=1024, tol=0.02, scale=0.6, crop=dict(pad=0.5)),
      height=None, tex=1024),
]

# ---- the crowd (added 11 Oct, the user: "only the textured, higher-polygon figures; drop the
# low-poly white ones"). Six STATIC photoscanned figures (no rig: char_prep bakes rigged characters,
# so these take the pier kit's static people's route), each delivered at a normalised ~100 units:
# scaled to a standing height each. Only the textured row's material is taken (`mats`); the white
# (.001) and flat grey (.002) twins are not.
PEOPLE_SRC = C('WIP - Lowpoly People - 2', 'Loïc Norgeot', 'norgeotloic',
               'wip-lowpoly-people-2-4cf6f452719c4363bab5faddbc221391')
for _n, _lab, _h, _u in (
        (1, 'woman with a plush rabbit', 1.68, 99.766),
        (2, 'young man, T-shirt', 1.78, 99.996),
        (3, 'man, arms crossed', 1.80, 100.374),
        (4, 'young woman, hands on hips', 1.65, 99.792),
        (5, 'man, hand on his head', 1.80, 99.929),
        (6, 'cyclist in a hi-vis jacket', 1.80, 99.715)):
    PROPS.append(P('crowd_%d' % _n, 'crowd', _lab, 'wip_-_lowpoly_people_-_2.glb',
                   'Photoscanned figure, 1 500 tris as delivered (a crowd budget already), its 1024 maps at 512.',
                   PEOPLE_SRC, dict(route='asis', scale=round(_h / _u, 6)), height=_h, place='floor', tex=512,
                   mats=['0%d_person' % _n]))

# ---- the ALMA antenna (added 11 Oct, replacing the blocked telescope): ONE prep job, three rows.
# The delivered rig (base / azimuth fork / elevation dish) is kept as three rigid parts on one atlas,
# in one frame (place 'mount'); src/scenery/scenery_assembly.json carries the pivots, the axes, the
# light anchors and the motion for the placer. The lights' `at`: 'top' / 'rim' of a part, or metres
# in the delivered (Blender import) frame.
ALMA_SRC = C('Antena Alma / Modelo norteamericano.', 'fundacionastromania', 'fundacionastromania',
             'antena-alma-modelo-norteamericano-84a46f3691c84cec97e3031033b482af')
JOBS = {
    'alma': dict(key='alma', group='landmark', delivered='antena_alma__modelo_norteamericano..glb',
                 prep=dict(route='model', target=24000, size=2048, tol=0.02, scale=2.5, margin=1.5,
                           parts=[('base', 'antenna_base_0'), ('fork', 'azimuth_6'), ('dish', 'elevation_axis_4')],
                           lights=[
                               dict(kind='obstruction', part='fork', at='top',
                                    note='steady red, the highest point that does not move with the dish'),
                               dict(kind='obstruction', part='base', at='rim', note='steady red, the platform rim'),
                               dict(kind='service', part='base', at=(1.66, 0.1, 1.05),
                                    note='warm lamp over the electrical door (the DANGER plate)'),
                               dict(kind='service', part='base', at=(1.76, -0.15, 1.35),
                                    note='warm lamp at the top of the ladder')],
                           motion=dict(kind='track', driver='sim clock', hour_angle_deg_per_sim_hour=15,
                                       note='the dish TRACKS a source: the fork turns in azimuth and the dish '
                                            'in elevation as the hour angle advances (15 deg an hour), a few '
                                            're-points a night; never a visible spin; static (frame-1 pose) '
                                            'until the placer drives parts'))),
}
for _pn, _lab in (('base', 'base'), ('fork', 'fork (azimuth)'), ('dish', 'dish (elevation)')):
    _r = P('alma_' + _pn, 'landmark', 'ALMA 12 m antenna - ' + _lab, 'antena_alma__modelo_norteamericano..glb',
           'One part of the ALMA antenna assembly (src/scenery/scenery_assembly.json: pivot, axis, lights). '
           'Delivered a 5.4 m miniature, x2.5 to the real 12 m dish; 199 k tris / 35 materials -> 24 k on one atlas.',
           ALMA_SRC, dict(route='model', job='alma'), height=None, place='mount')
    _r['dir'] = PREP + '/alma'
    _r['file'] = 'alma_%s.glb' % _pn
    PROPS.append(_r)

# prop_prep's provenance record, per row (`src` is the row's key; `dir` says where the file is)
SOURCES = {r['key']: (r['credit']['title'], r['credit']['author'], 'CC-BY-4.0', r['credit']['source'])
           for r in PROPS}

# NOT IN THE KIT:
# - satellite__radio_telescope_from_votv: BLOCKED and DROPPED (the user, 11 Oct) - a rip from the game
#   Voices of the Void (Unreal's own WorldGridMaterial in the file); replaced by the ALMA antenna.
