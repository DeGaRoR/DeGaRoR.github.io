#!/usr/bin/env python3
"""metlakatla_author.py - METLAKATLA, the one real town on Annette Island, as the
world editor's record. jolene_author.py imports this and splices its layers into
tools/fixtures/island_jolene.json; run THAT to write the fixture.

    py -3.11 tools/jolene_author.py          # writes the fixture, town and all
    py -3.11 tools/metlakatla_author.py      # prints this module's own layers

WHERE THE COORDINATES COME FROM, honestly. The frame is the game's own
(EPSG:3338 minus the WWII field's origin; north is -z; grid north leans 19.32 deg
east of true). The town sits at x -4300..-2400, z -9150..-7650, about 9.4 km
north-north-west of the field.

Nothing here was eyeballed off a picture in isolation. The user's Google views
were REGISTERED onto the frame by tools/met_fit.py - the rotation pinned at the
convergence, the scale and offset found by cross-correlating the view's own
water/land split against bench/jolene/dem.coast.u8 - and then the street grid was
pulled off the registered views by tools/met_streets.py, which votes every
road-like pixel onto the perpendicular offset of the line it lies on and walks
each peak to its ends. tools/met_trace.py draws this record back over the island's
radar orthoimage, which is how it was checked. The views themselves are Google's
and are not in the repo; the NUMBERS are, here.

THE STREET GRID is two families: the numbered avenues on grid bearing 43 deg
(atan2(z, x) = 133), about 46 m apart, and the named cross streets on 133 deg
(atan2 = 43), 46-100 m apart. Everything else - Walden Point Road, Airport Road,
Skaters Lake Road, the graveyard road, the subdivision loops - is a traced
polyline.
"""
import json, math, os, random, sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- the DEM, for the levels (the same reader jolene_author.py uses) ----------
BENCH = os.path.join(ROOT, 'bench', 'jolene')
if not os.path.exists(os.path.join(BENCH, 'dem.json')):
    BENCH = 'D:/Dev/DeGaRoR.github.io/flyDiy/bench/jolene'   # a worktree: the main checkout's bake
_J = json.load(open(os.path.join(BENCH, 'dem.json')))
_W, _H, _X0, _Z0, _CELL = _J['w'], _J['h'], _J['x0'], _J['z0'], _J['cell']
_DEM = np.fromfile(os.path.join(BENCH, 'dem.f32'), np.float32).reshape(_H, _W)
_COAST = np.fromfile(os.path.join(BENCH, 'dem.coast.u8'), np.uint8).reshape(_H, _W)
# THE LAKES, from the prep's own table. `dem.lake.u8` IS a proper signed distance
# field - (u8 - 128) * 4 metres, positive INSIDE a lake, and the water session
# histogrammed all 12.1 M cells to prove it: smooth and monotone either side of 128,
# 1.47 % inside, 84 % at the -508 m clamp. My first cut read it with `v > 0`, and the
# sign lives in the 128, so every cell on the island tested as lake and all sixty-one
# roads were dropped. THE FIELD WAS NOT WRONG; THE TEST WAS. The box table is kept
# anyway because it is the conservative side to be coarse on and it needs no raster -
# but if this ever wants to follow a crooked shoreline exactly, the field is there and
# it is honest.
_LAKES = [q for q in json.load(open(os.path.join(BENCH, 'dem.lakes.json')))
          if q.get('cells', 0) >= 20]


def dem(x, z):
    c = (x - _X0) / _CELL
    r = (z - _Z0) / _CELL
    i, j = int(c), int(r)
    u, v = c - i, r - j
    return float(_DEM[j, i] * (1 - u) * (1 - v) + _DEM[j, i + 1] * u * (1 - v)
                 + _DEM[j + 1, i] * (1 - u) * v + _DEM[j + 1, i + 1] * u * v)


def is_land(x, z):
    return int(_COAST[int(round((z - _Z0) / _CELL)), int(round((x - _X0) / _CELL))]) >= 128


def coast_m(x, z):
    """Metres inland of the island's own waterline (negative at sea).
    dem.coast.u8 is signed m/4 with 128 at the line (bench/jolene/dem.json)."""
    c = (x - _X0) / _CELL
    r = (z - _Z0) / _CELL
    i = min(max(int(c), 0), _W - 2)
    j = min(max(int(r), 0), _H - 2)
    u, v = c - i, r - j
    q = (float(_COAST[j, i]) * (1 - u) * (1 - v) + float(_COAST[j, i + 1]) * u * (1 - v)
         + float(_COAST[j + 1, i]) * (1 - u) * v + float(_COAST[j + 1, i + 1]) * u * v)
    return (q - 128.0) * 4.0


def lake_m(x, z):
    """Metres outside the nearest lake's water; negative over a lake.

    A lake is its BOX and its LEVEL: a point inside the box whose ground is at or
    under the level is water, and the distance is measured to the box otherwise. It
    is coarse at a crooked shoreline and that is the right side to be coarse on -
    keeping a road ten metres further from a bank costs nothing.
    """
    best = 1e9
    for q in _LAKES:
        dx = max(q['x0'] - x, x - q['x1'], 0.0)
        dz = max(q['z0'] - z, z - q['z1'], 0.0)
        d = math.hypot(dx, dz)
        if d == 0.0 and dem(x, z) <= q['level'] + 2.0:
            return -1.0
        best = min(best, d if d > 0 else (dem(x, z) - q['level']) * 4.0)
    return best


def trim_lakes(rs, margin=10.0):
    """A premises MUST NOT GRADE WITHIN A LAKE'S FIELD (the water session, 2026-09-23).

    A lake's surface is a fixed level because its level is set by its OUTLET - the
    spill height - and nothing a road does to the bank can move it. So the ground
    meets the water and the water never follows the ground. Grading DOWN near a bank
    is the worse direction, not the safer one: the water quad is cut by the DEM's own
    lake mask, so ground lowered below the level is below the water and still not
    covered by it - it pokes out past the water's edge, which is most of the hard
    black rim we were looking at. Measured before this: the town's road grades cut
    3.3 m inside Skaters Lake's box.

    The margin is the road's own falloff plus the water's 2 m shore fade.
    """
    del LAKED[:]
    for r in list(rs):
        if not r.get('graded'):
            continue
        m = margin + (r.get('falloff') or 6)
        pts = r['pts']
        S = []
        for i in range(1, len(pts)):
            a, b = pts[i - 1], pts[i]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            n = max(1, int(L / 10))
            for k in range(n):
                f = k / float(n)
                S.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
        S.append(tuple(pts[-1]))
        free = [lake_m(q[0], q[1]) > m for q in S]
        if all(free):
            continue
        best = run = None
        for k, f in enumerate(free):
            if not f:
                run = None
                continue
            run = (k, k) if run is None else (run[0], k)
            if best is None or run[1] - run[0] > best[1] - best[0]:
                best = run
        share = 1.0 - sum(free) / float(len(free))
        if best is None or (best[1] - best[0]) * 10 < 45:
            rs.remove(r)
            DROPPED.append((r['id'], 'it runs inside a lake field end to end'))
            LAKED.append((r['id'], 'dropped'))
            continue
        r['pts'] = [pt(*S[best[0]]), pt(*S[best[1]])] if len(pts) == 2 else [pt(*q) for q in S[best[0]:best[1] + 1]]
        LAKED.append((r['id'], 'trimmed %d %%' % round(share * 100)))


LAKED = []


def pull_inland(x, z, margin=30.0, step=14.0, tries=24):
    """THE WATERLINE IS NOT THE BEACH. Metlakatla's shore streets stand on ground
    the 10 m DEM does not have: its zero line lies out on the shelf, so a street
    traced at its true position lands in the sea (jolene_author.py made the same
    note for its village and put the harbour street 35 m inland). Rather than
    invent fill under the whole waterfront - which would cut a step through the
    town behind it - a point that is not far enough inland WALKS up the coast
    field's own gradient until it is."""
    for _ in range(tries):
        if coast_m(x, z) >= margin:
            return x, z
        best, bx, bz = coast_m(x, z), x, z
        for k in range(16):
            a = math.pi * 2 * k / 16
            nx, nz = x + math.cos(a) * step, z + math.sin(a) * step
            c = coast_m(nx, nz)
            if c > best:
                best, bx, bz = c, nx, nz
        if (bx, bz) == (x, z):
            return x, z
        x, z = bx, bz
    return x, z


R = lambda v, n=2: round(float(v), n)
def pt(x, z): return [R(x), R(z)]

# ---- the axes the user drew ---------------------------------------------------
# The user, over a met_trace picture of the town with the record on it: "I also
# think you have been too approximative in your grid, and you miss a lot of the
# natural feeling. I have traced in red some axis that I would like to see
# reproduced, that would break your absolute grid pattern."
#
# THE GRID CAME FROM A VOTE, and a vote over a rotated regular grid answers with a
# rotated regular grid: 73 straight segments on two bearings, every one of them
# geometrically defensible and the whole visibly wrong, because Metlakatla's
# arterials curve round the hill, follow the shore and cut the blocks at their own
# angles. No detector was going to find that; a person drawing over the trace was.
# `tools/met_axes.py` reads the drawing back - the picture's own orange grid gives
# the calibration, the red strokes are thinned to centrelines, the network is cut
# at its junctions, and a stroke is carried through a junction it merely crosses.
# MEASURED: 8989 red pixels -> 11 branches -> 10 axes over 4089 m, the calibration
# agreeing between the picture's two axes to 0.24 %.
#
# These are ARTERIALS: paved, 7 m, filleted, and they carry the traffic. A traced
# grid street that merely re-draws one of them straight is dropped (see `roads`).

MK_AX = [
    # 0: 1157 m, 62 points
    [(-4151.1, -8316.3), (-4134.3, -8323.5), (-4117.6, -8330.9), (-4101, -8338.4), (-4084.6, -8345.7), (-4068.6, -8352.5), (-4151.1, -8316.3), (-4142.6, -8333.2), (-4133.7, -8350.2), (-4124.2, -8367.3), (-4114, -8384.1), (-4102.8, -8400), (-4090.7, -8414.5), (-4077.7, -8427.1), (-4064.3, -8438.1), (-4050.4, -8448.1), (-4036.4, -8457.6), (-4022, -8466.8), (-4007.3, -8475.9), (-3992.4, -8485), (-3977.3, -8494.2), (-3962.1, -8503.4), (-3946.5, -8512.6), (-3930.4, -8521.9), (-3914, -8531.3), (-3897.6, -8540.8), (-3881.4, -8550.4), (-3865.2, -8559.9), (-3849, -8569.1), (-3832.9, -8578.3), (-3816.9, -8587.8), (-3801.1, -8598.1), (-3785.5, -8609.3), (-3770.4, -8621.4), (-3756, -8634.2), (-3742.4, -8647.4), (-3729.5, -8661.1), (-3717.4, -8675.3), (-3706.1, -8689.7), (-3695.7, -8704.1), (-3686.1, -8718.3), (-3676.9, -8732.5), (-3667.8, -8746.7), (-3658.6, -8761), (-3649.1, -8775.6), (-3639.2, -8790.4), (-3629.2, -8805.3), (-3619.2, -8820.4), (-3609.4, -8835.6), (-3599.7, -8850.8), (-3590, -8865.7), (-3580.1, -8879.8), (-3570, -8893), (-3560, -8905.3), (-3550, -8917), (-3540.1, -8928.7), (-3530, -8940.6), (-3519.5, -8952.8), (-3508.6, -8964.9), (-3497.7, -8976.5), (-3487.2, -8987.4), (-3477.1, -8997.6)],
    # 1: 638 m, 35 points
    [(-3440.2, -8453.1), (-3454.9, -8439.9), (-3470.5, -8427.8), (-3487.5, -8417.3), (-3505.5, -8408.2), (-3524.2, -8400.2), (-3543.1, -8392.8), (-3562.2, -8385.8), (-3581.3, -8379.3), (-3600.3, -8373), (-3618.9, -8366.3), (-3637, -8358.7), (-3654.9, -8350.3), (-3672.9, -8341.4), (-3691.4, -8332.5), (-3710.4, -8324), (-3729.7, -8315.7), (-3749, -8307.9), (-3768.3, -8300.8), (-3787.4, -8294.4), (-3806.2, -8288.2), (-3824.5, -8281.6), (-3842.1, -8274), (-3859.6, -8265.4), (-3877.4, -8256.2), (-3895.8, -8247.3), (-3914.3, -8239.6), (-3932, -8234.4), (-3948, -8233.3), (-3961.6, -8237), (-3973, -8244.9), (-3982.6, -8255.5), (-3990.6, -8266.7), (-3997.4, -8277.5), (-4003.3, -8287.8)],
    # 2: 616 m, 34 points
    [(-3492.8, -8508.7), (-3504.8, -8519.8), (-3517.2, -8530.5), (-3530.3, -8540.3), (-3544, -8548.5), (-3558.4, -8554), (-3573.4, -8555.9), (-3588.9, -8554), (-3605.2, -8549.1), (-3622.1, -8542.9), (-3639.8, -8536.3), (-3658, -8529.8), (-3676.5, -8523.3), (-3695.3, -8516.9), (-3714.2, -8510.8), (-3733.2, -8504.6), (-3752.1, -8498.1), (-3770.9, -8491.3), (-3789.5, -8484.2), (-3807.9, -8476.9), (-3826, -8469.5), (-3843.8, -8461.9), (-3861.5, -8454.1), (-3879.3, -8446.2), (-3897.2, -8438.2), (-3915, -8430), (-3932.8, -8421.8), (-3950.7, -8413.5), (-3968.8, -8405.3), (-3986.7, -8397.1), (-4004.3, -8388.5), (-4021.1, -8379.3), (-4037.3, -8369.4), (-4053, -8359)],
    # 3: 558 m, 30 points
    [(-3492.8, -8508.7), (-3509.3, -8499.1), (-3526, -8490), (-3543, -8481.8), (-3560.7, -8474.3), (-3578.9, -8467.6), (-3597.7, -8461.5), (-3616.6, -8455.9), (-3635.4, -8450.1), (-3653.7, -8443.7), (-3671.3, -8436.5), (-3688.4, -8428.6), (-3705.2, -8420.6), (-3722.3, -8412.7), (-3739.8, -8405.3), (-3757.8, -8398.4), (-3776.1, -8391.5), (-3794.3, -8384.1), (-3812.3, -8375.6), (-3829.9, -8366.2), (-3847.3, -8356.2), (-3864.8, -8346.1), (-3882.5, -8336.1), (-3900.5, -8326.9), (-3918.8, -8318.5), (-3937.2, -8310.9), (-3955.3, -8304), (-3972.4, -8297.9), (-3988.3, -8292.6), (-4003.3, -8287.8)],
    # 4: 385 m, 21 points
    [(-3359.1, -8413.2), (-3344.7, -8401.4), (-3330.8, -8388.8), (-3318, -8374.7), (-3307.2, -8358.9), (-3299.5, -8341.5), (-3295.5, -8323.1), (-3294.7, -8304.2), (-3295.9, -8285.1), (-3297.3, -8265.7), (-3297.4, -8246.3), (-3295.1, -8226.9), (-3290.1, -8207.7), (-3282.6, -8189), (-3273.3, -8170.7), (-3262.9, -8152.7), (-3252.3, -8135.4), (-3242, -8118.8), (-3232.1, -8103.1), (-3222.3, -8088.3), (-3212.7, -8074)],
    # 5: 352 m, 18 points
    [(-3145.8, -8692.6), (-3156.6, -8677.5), (-3168.1, -8661.9), (-3180.8, -8645.8), (-3194.8, -8628.9), (-3209.6, -8611.8), (-3224.4, -8594.6), (-3238.8, -8577.7), (-3252.6, -8561.2), (-3265.9, -8544.9), (-3278.9, -8528.7), (-3291.8, -8512.3), (-3304.6, -8495.3), (-3317.1, -8477.9), (-3328.9, -8460.5), (-3339.9, -8443.8), (-3349.9, -8428.1), (-3359.1, -8413.2)],
    # 6: 131 m, 9 points
    [(-4151.1, -8316.3), (-4161.5, -8298.7), (-4171.3, -8281.5), (-4180.6, -8264.9), (-4189.4, -8249.3), (-4197.5, -8235.1), (-4204.9, -8222.5), (-4211.2, -8211.7), (-4216.6, -8202.3)],
    # 7: 90 m, 6 points
    [(-3359.1, -8413.2), (-3376.5, -8421.6), (-3393.5, -8430.1), (-3409.8, -8438.6), (-3425.3, -8446.3), (-3440.2, -8453.1)],
    # 8: 87 m, 6 points
    [(-4003.3, -8287.8), (-4014.3, -8302.1), (-4024.8, -8316.5), (-4034.6, -8330.9), (-4043.9, -8345.1), (-4053, -8359)],
    # 9: 77 m, 6 points
    [(-3492.8, -8508.7), (-3480.7, -8496.7), (-3468.9, -8484.8), (-3458.2, -8473.5), (-3448.7, -8462.9), (-3440.2, -8453.1)],
]


# ---- the second pass: three pens on one picture -------------------------------
# `tools/met_axes.py --colour green|blue|red` read all three off one annotated
# trace, and each pen means a different shape.
#
# GREEN, the user: "For the seafront, do the roads in green" - the waterfront
#   street, drawn by hand because the vote was drawing it straight and wrong.
# BLUE, the user: "delete the one I crossed in blue" - seven ticks, each within
#   4.6 m of mk_sa27 and of nothing else. A tick is a PLACE, so the rule is a
#   place rule: a street running under two or more marks goes. Naming the id would
#   be easier and would rot the first time the street table is re-traced.
# RED, the user: "in the new zone inscribed in the red annotation, you should
#   delete your previous grid pattern" - 17.5 ha of the south-western quarter
#   where the three drawn AXES are the street plan, and the voted grid laid over
#   them was exactly the "absolute grid pattern" complained of. The axes do not
#   live in STREETS and so survive; what the polygon eats is the vote's work.
MK_SHORE = [
    # 0: 329 m, 29 points
    [(-3680.9, -8811.9), (-3673.2, -8821.9), (-3665.2, -8831.9), (-3656.8, -8841.8), (-3647.9, -8851.6), (-3638.9, -8861.2), (-3630, -8870.8), (-3621.7, -8880.7), (-3614.1, -8891), (-3606.9, -8901.6), (-3599.8, -8912.4), (-3592.9, -8923.2), (-3586, -8933.7), (-3579.2, -8943.7), (-3572.6, -8953.5), (-3566.1, -8963.1), (-3559.6, -8972.6), (-3553.3, -8982.1), (-3547, -8991.6), (-3540.8, -9001.2), (-3534.5, -9010.8), (-3528.4, -9020.2), (-3522.7, -9029.4), (-3517.5, -9038.5), (-3512.9, -9047.9), (-3508.7, -9057.4), (-3505.1, -9066.8), (-3501.9, -9075.6), (-3499.1, -9083.7)],
]

# THE THIRD PASS, the user: "highlighted in blue the roads you should delete".
# Four strokes this time rather than ticks, so the rule is a LINE rule: a street
# lying under a stroke for most of its length goes. Matched against the composed
# record, three of the four are unambiguous at 100 % of their samples - mk_sa25,
# mk_sa28 and mk_sc66, all three of them the vote's straight copies of the hand-
# drawn hill road - and the fourth is the straight head of Skaters Lake Road,
# which `trim_to_axes` had already taken off in the same pass. That agreement is
# the check: the pen and the rule found the same four roads independently.
MK_BLUE = [
    # 0: 417 m, 46 points
    [(-3939.1, -8451), (-3932.9, -8457.3), (-3926.8, -8463.6), (-3921, -8470), (-3915.5, -8476.8), (-3910.1, -8484.1), (-3904.4, -8491.5), (-3898.1, -8498.8), (-3891.4, -8505.5), (-3884.4, -8511.5), (-3877.4, -8517.4), (-3870.6, -8523.6), (-3864.1, -8530.3), (-3858, -8537.4), (-3851.7, -8544.7), (-3845.1, -8552.2), (-3838.5, -8559.6), (-3831.9, -8566.2), (-3825.3, -8572.1), (-3818.8, -8577.6), (-3812.3, -8583.4), (-3805.9, -8589.7), (-3799.8, -8596.6), (-3793.8, -8604), (-3787.7, -8611.5), (-3781.5, -8618.9), (-3775.2, -8626), (-3768.9, -8632.5), (-3762.5, -8638.7), (-3755.9, -8644.5), (-3749.4, -8650.2), (-3743.2, -8655.9), (-3737.5, -8662.1), (-3731.9, -8669), (-3726.3, -8676.7), (-3720.6, -8684.6), (-3714.8, -8691.9), (-3708.8, -8698.4), (-3702.3, -8704.6), (-3695.2, -8711.4), (-3687.4, -8718.8), (-3679.4, -8726.7), (-3671.5, -8734.6), (-3664.1, -8741.9), (-3658.1, -8748.3), (-3653.3, -8753.6)],
    # 1: 334 m, 35 points
    [(-3248.3, -8158.4), (-3252.5, -8168.2), (-3256.4, -8178), (-3259.8, -8187.6), (-3262.4, -8197.4), (-3264.4, -8207.2), (-3265.9, -8217.2), (-3267.4, -8227.2), (-3269.1, -8237.2), (-3271.2, -8247.2), (-3273.7, -8257.2), (-3276.6, -8267.1), (-3279.9, -8276.7), (-3283.5, -8285.7), (-3287.3, -8294), (-3291.3, -8302), (-3295.3, -8310.3), (-3299.4, -8319.2), (-3303.8, -8328.5), (-3308.4, -8337.8), (-3312.8, -8347.1), (-3316.8, -8356.2), (-3320.3, -8365.4), (-3323.2, -8374.7), (-3325.9, -8384), (-3329.2, -8392.7), (-3334, -8400.1), (-3340.8, -8405.8), (-3349.2, -8409.5), (-3358.7, -8412), (-3368.5, -8413.9), (-3378.2, -8416.1), (-3387.5, -8418.7), (-3396.4, -8421.7), (-3405, -8424.8)],
    # 2: 200 m, 21 points
    [(-4035.7, -8461), (-4043, -8455.1), (-4050.2, -8448.2), (-4057.2, -8440.2), (-4064, -8431.6), (-4070.5, -8423.2), (-4076.9, -8415.3), (-4083.4, -8407.8), (-4090.1, -8400.4), (-4097.2, -8392.9), (-4104.3, -8385.4), (-4111.3, -8378.2), (-4118.4, -8371.4), (-4125.7, -8364.6), (-4133, -8357.8), (-4140.1, -8351.2), (-4146.9, -8344.9), (-4153.5, -8338.7), (-4160.2, -8332.1), (-4166.9, -8324.9), (-4173.6, -8317.2)],
    # 3: 42 m, 5 points
    [(-3998, -8341), (-4006.6, -8348.1), (-4014.7, -8355.1), (-4022.2, -8361.8), (-4029.4, -8368.5)],
]


MK_KILL = [
    (-3481.1, -9010.4, 8.8), (-3505.7, -8988.7, 10.0), (-3527.3, -8968.6, 5.6),
    (-3544.6, -8949.3, 9.4), (-3561.5, -8930.0, 10.0), (-3577.5, -8916.8, 7.5),
    (-3598.3, -8892.1, 8.8),
]

MK_CLEAR = [
    # 17.5 ha, 152 points
    [(-3600.6, -8570.1), (-3588.1, -8569.3), (-3575.6, -8568.2), (-3563.3, -8566.3), (-3551.5, -8563.4), (-3540.5, -8559.3), (-3530.8, -8554), (-3521.9, -8547.9), (-3513.4, -8541.6), (-3504.8, -8535.5), (-3495.9, -8529.8), (-3486.7, -8524.1), (-3477.4, -8517.8), (-3468.3, -8510.4), (-3459.7, -8502), (-3452, -8493), (-3445, -8483.9), (-3438.7, -8474.9), (-3433, -8465.7), (-3428.4, -8456), (-3425.4, -8445.5), (-3424.1, -8434.2), (-3424.2, -8422.1), (-3425.3, -8409.8), (-3427.2, -8397.6), (-3429.9, -8385.5), (-3433.5, -8374), (-3438.1, -8363.3), (-3443.7, -8353.6), (-3450.2, -8345.3), (-3457.7, -8338.1), (-3466.2, -8331.8), (-3475.7, -8325.7), (-3486.2, -8319.6), (-3497.4, -8313.5), (-3509, -8307.6), (-3520.6, -8301.9), (-3531.6, -8296.4), (-3542.1, -8291.2), (-3552.2, -8286.4), (-3562.7, -8281.9), (-3573.9, -8277.6), (-3585.8, -8273.8), (-3598.2, -8270.3), (-3610.7, -8267.3), (-3623.2, -8264.6), (-3635.7, -8262.1), (-3648.3, -8259.7), (-3660.7, -8257.5), (-3673.1, -8255.4), (-3685.4, -8253.5), (-3697.6, -8251.4), (-3709.9, -8249.2), (-3722.3, -8246.9), (-3734.8, -8244.3), (-3747.3, -8241.7), (-3759.8, -8238.9), (-3772.4, -8236.1), (-3784.9, -8233.4), (-3797.2, -8230.8), (-3809.5, -8228.4), (-3821.8, -8226.3), (-3834, -8224.5), (-3846.4, -8222.7), (-3858.9, -8220.9), (-3871.4, -8219.2), (-3884, -8217.7), (-3896.5, -8216.6), (-3909, -8216), (-3921.6, -8215.7), (-3934.1, -8215.7), (-3946.6, -8215.9), (-3959.2, -8216.5), (-3971.7, -8217.4), (-3984.2, -8218.7), (-3996.7, -8220.2), (-4009.1, -8221.9), (-4021.4, -8223.5), (-4033.6, -8225.1), (-4045.9, -8226.4), (-4058.3, -8227.3), (-4070.7, -8227.9), (-4083.1, -8228.3), (-4095.4, -8228.8), (-4107.6, -8229.5), (-4119.8, -8230.8), (-4132, -8232.6), (-4143.9, -8235.3), (-4155.4, -8239.1), (-4166, -8244.4), (-4174.8, -8251.4), (-4180.9, -8260.2), (-4183.7, -8270.6), (-4183.6, -8281.8), (-4181.3, -8293.2), (-4177.6, -8304), (-4172.7, -8314), (-4166.7, -8322.9), (-4159.7, -8330.7), (-4151.6, -8337.4), (-4142.5, -8343.4), (-4132.4, -8349), (-4121.6, -8354), (-4110.2, -8358.4), (-4098.7, -8362.2), (-4087.8, -8365.8), (-4078.3, -8370.2), (-4070.3, -8375.9), (-4063.2, -8383), (-4056.2, -8390.9), (-4048.5, -8398.9), (-4039.9, -8406.4), (-4030.3, -8413.2), (-4019.8, -8419.2), (-4008.8, -8424.6), (-3997.5, -8429.6), (-3985.9, -8434.5), (-3974.1, -8439.4), (-3962.3, -8444.8), (-3950.8, -8450.6), (-3940.1, -8456.8), (-3930.2, -8463), (-3921.3, -8469), (-3913, -8474.8), (-3904.7, -8480.4), (-3895.9, -8485.6), (-3886.3, -8490.3), (-3875.7, -8494.6), (-3864.5, -8498.4), (-3852.8, -8502.1), (-3840.8, -8505.8), (-3828.7, -8509.9), (-3816.5, -8514.6), (-3804.6, -8519.5), (-3793.1, -8524.4), (-3781.9, -8528.7), (-3770.7, -8532.2), (-3759.1, -8535), (-3747.1, -8537.2), (-3734.7, -8539.1), (-3722.2, -8540.8), (-3709.7, -8542.4), (-3697.2, -8544.1), (-3684.6, -8545.8), (-3672.2, -8547.4), (-3660, -8549.2), (-3648.2, -8551.3), (-3637.1, -8554.2), (-3627, -8557.9), (-3618, -8561.9), (-3610.2, -8565.6), (-3603.1, -8568.9)],
]


def in_clear(x, z):
    return any(inpoly(g, x, z) for g in MK_CLEAR)


def inpoly(poly, x, z):
    inside = False
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        if (a[1] > z) != (b[1] > z):
            t = (z - a[1]) / (b[1] - a[1])
            if x < a[0] + (b[0] - a[0]) * t:
                inside = not inside
    return inside


BLUE_HIT = None


def blue_kills(half=16.0, want=0.70):
    """Which street each blue stroke marks.

    THE TEST RUNS THE OTHER WAY ROUND from the axes' one, and getting that back to
    front cost an hour: a stroke is drawn over PART of a street - it says "this
    one", not "all of this" - so the share that matters is the share of the STROKE
    lying on the street, not the share of the street lying under the stroke. Tested
    the wrong way the three marked roads scored 0.31 to 0.54 and none of them was
    dropped; the right way round they score 1.00, 1.00 and 1.00.

    The drawn axes are not candidates. A stroke over one of them is the user
    striking out the straight copy that used to lie there, and if that copy has
    already gone the stroke matches nothing - which is what is reported.
    """
    global BLUE_HIT
    if BLUE_HIT is not None:
        return BLUE_HIT
    cands = []
    for i, (a, b, c, d, fam) in enumerate(STREETS):
        p0, p1 = pull_inland(a, b, 22.0), pull_inland(c, d, 22.0)
        cands.append(('mk_s%s%02d' % (fam.lower(), i), [p0, p1]))
    for rid, name, pts, w, cls, look, grade, traffic in TRACED:
        cands.append((rid, [pull_inland(q[0], q[1], 18.0) for q in pts]))
    out, BLUE_REPORT[:] = set(), []
    for k, g in enumerate(MK_BLUE):
        best = (0.0, None)
        for rid, pl in cands:
            hit = 0
            for q in g:
                dm = 1e9
                for i in range(1, len(pl)):
                    a, b = pl[i - 1], pl[i]
                    dx, dz = b[0] - a[0], b[1] - a[1]
                    t = max(0.0, min(1.0, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / max(1e-9, dx * dx + dz * dz)))
                    dm = min(dm, math.hypot(q[0] - (a[0] + dx * t), q[1] - (a[1] + dz * t)))
                if dm < half:
                    hit += 1
            sh = hit / float(len(g))
            if sh > best[0]:
                best = (sh, rid)
        if best[0] >= want:
            out.add(best[1])
            BLUE_REPORT.append((k, best[1], best[0]))
        else:
            BLUE_REPORT.append((k, None, best[0]))
    BLUE_HIT = out
    return out


BLUE_REPORT = []


def crossed_out(x0, z0, x1, z1):
    """How many blue ticks this street runs under."""
    n = 0
    for kx, kz, kr in MK_KILL:
        dx, dz = x1 - x0, z1 - z0
        t = max(0.0, min(1.0, ((kx - x0) * dx + (kz - z0) * dz) / max(1e-9, dx * dx + dz * dz)))
        if math.hypot(kx - (x0 + dx * t), kz - (z0 + dz * t)) < kr + 9.0:
            n += 1
    return n


def cleared_share(x0, z0, x1, z1):
    """What share of this street lies in a red clearing polygon."""
    L = math.hypot(x1 - x0, z1 - z0)
    n = max(4, int(L / 12))
    hit = sum(1 for k in range(n + 1)
              if in_clear(x0 + (x1 - x0) * k / float(n), z0 + (z1 - z0) * k / float(n)))
    return hit / float(n + 1)



# ---- the wood the user drew, in the town's own gaps ---------------------------
# The user, over two game screenshots with three closed red loops on them: "Just
# spawn some medium canopy forest in the zones highlighted in red in my screenshots,
# that's all. Normal conifers from the forest, just not too tall."
#
# READ OFF A GAME SCREENSHOT, which has no coordinate grid: `met_axes.py --pixels
# --shape region` traces each loop in the picture's own 0..1 coordinates, and the
# game then UNPROJECTS them - the shot's camera restored exactly (the same teleport
# and the same camSet), a ray cast through each point, marched against world.terrainH
# at 2 m and bisected. That is the instrument for any future "this bit here" drawn on
# a screenshot rather than on a trace.
#
# A `forest` ZONE, not a ttype stamp. The island's own fill is driven by the terrain
# type AND gated on world.surface being FOREST_FLOOR or GRASS - and inside a town the
# cover map says BUILT over about a third of the ground, which is exactly where these
# three patches are. So the stamp could not reach them. planForest plants into the
# record instead: it steps round every plot, every road and every exclude by
# construction, which is what these gaps are between.
MK_WOOD = [
    # 10.67 ha
    [(-4012.9, -8014), (-3921.9, -8019.2), (-3833, -8017.3), (-3743.1, -8000.3), (-3645.7, -7970.9), (-3634.6, -8255), (-3581.2, -8260.8), (-3518.8, -8249.8), (-3583.6, -8358.8), (-3625.8, -8360.8), (-3664.6, -8355), (-3688.5, -8243), (-3746, -8237.8), (-3803.3, -8243.6), (-3860.3, -8243.7), (-3925, -8225.9), (-3990.6, -8215.3), (-4055.1, -8210.2), (-3990.6, -8215.3), (-4121.4, -7981), (-4012.9, -8014)],
    # 0.38 ha
    [(-3889.9, -8444.8), (-3860.6, -8446.7), (-3884.2, -8404.6), (-3849.9, -8405.7), (-3832.1, -8448.1), (-3804, -8449.2), (-3775.8, -8452.8), (-3748.7, -8454.6), (-3772.2, -8480.5), (-3749.1, -8484.6), (-3722.5, -8458.9), (-3696.2, -8459.3), (-3704.3, -8486.1), (-3709.3, -8503.3), (-3690.2, -8505.2), (-3682.5, -8487.6), (-3662.1, -8490.4), (-3646.8, -8464.4), (-3670.6, -8460.9), (-3696.2, -8459.3), (-3722.5, -8458.9), (-3748.7, -8454.6), (-3748.2, -8415.1)],
    # 1.46 ha
    [(-3731.8, -8673.6), (-3724.7, -8607.7), (-3759.5, -8534.5), (-3799.8, -8519.4), (-3786, -8484), (-3821.4, -8470.5), (-3807.7, -8445.7), (-3825.6, -8414.2), (-3796.3, -8425), (-3767.2, -8435.6), (-3775.6, -8457.1), (-3743.6, -8467.5), (-3715.4, -8510.8), (-3680.7, -8521.7), (-3679.6, -8563.6), (-3640.5, -8576.6)],
]


# Normal conifers, and the palette names COLLECTIONS rather than subjects (a tree's
# key is `<collection>|<subject>` and no author can know the subject names).
MK_WOOD_TREES = ['spruce_tree.glb', 'realistic_fir_trees_pack_lods_gameready.glb',
                 'fir_tree_georgeous.glb', 'pine_georgeous.glb', 'larch_tree.glb']


def simple_ring(g):
    """A traced loop, made SIMPLE, or the whole thing is dropped in silence.

    The unprojection marches a ray against the terrain, and where a ray grazes a roof
    or a bank two consecutive points land out of order - so two of the three loops
    the user drew crossed themselves, and `compose` refuses a self-crossing polygon
    without a word (`polySimple`). Crossing vertices are shaved first; if that will
    not settle it, the ring is re-ordered by ANGLE about its own centroid, which is
    right for a blob somebody drew round a patch of ground and wrong for nothing they
    are likely to draw.
    """
    seen, g2 = set(), []
    for q in g:
        k = (round(q[0], 1), round(q[1], 1))
        if k in seen:
            continue
        seen.add(k)
        g2.append([q[0], q[1]])
    g = g2
    for _ in range(len(g)):
        k = first_crossing(g)
        if k < 0:
            return g
        del g[k]
        if len(g) < 5:
            break
    cx = sum(q[0] for q in g) / len(g)
    cz = sum(q[1] for q in g) / len(g)
    ang = sorted(g, key=lambda q: math.atan2(q[1] - cz, q[0] - cx))
    if first_crossing(ang) < 0:
        return ang
    # AN ANGULAR SORT NEEDS A STAR SHAPE and the biggest loop is a long band across
    # the back of the town - 600 m by 390 - which is not one. So: find the band's own
    # long axis, walk the points along it, and build the ring as the upper edge out
    # and the lower edge back. That is simple by construction for anything longer
    # than it is wide, which is what a band drawn behind a row of houses is.
    # A RAY THAT MISSES LEAVES A HOLE. The march returns nothing where a ray grazes a
    # roof or leaves the terrain, and those points are dropped - so the biggest loop
    # came back as two long chains 280 m apart with the joins between them missing,
    # which no re-ordering of a broken cycle can mend. It IS a band, though: fit its
    # MIDLINE, put every point above the line on one side and below it on the other,
    # walk each side along the band, and the ring closes by construction.
    n = float(len(g))
    sxx = sum((q[0] - cx) ** 2 for q in g) or 1.0
    sxz = sum((q[0] - cx) * (q[1] - cz) for q in g)
    a = sxz / sxx                               # z = cz + a (x - cx)
    lo = sorted((q for q in g if q[1] - (cz + a * (q[0] - cx)) < 0), key=lambda q: q[0])
    up = sorted((q for q in g if q[1] - (cz + a * (q[0] - cx)) >= 0), key=lambda q: q[0])
    if len(lo) < 2 or len(up) < 2:
        return None
    ring = lo + up[::-1]
    return ring if len(ring) >= 4 and first_crossing(ring) < 0 else None


MK_WOOD_ZONES = ('mk_z_res_n', 'mk_z_res_e', 'mk_z_res_c', 'mk_z_res_w', 'mk_z_res_s',
                 'mk_z_res_sub', 'mk_z_core', 'mk_z_town')


def wood_zones():
    """FULL CONIFERS, PLACED (the user: "just take the full conifers, NOT the crown
    only ones, and place them. Just use the normal forest biome if you can't").

    The painted route is built and correct and cannot deliver here: the island's fill
    had 13 465 trees built and 55 576 chunks STILL QUEUED after 61 s of settling, so
    the town's own chunks never come up and the gaps stay bare however the biome is
    tuned. Placing them puts the trees in the record, where `planForest` steps round
    every plot, road, site and exclude by construction - which is exactly the ground
    the user keeps pointing at - and where they are drawn through treeBuild's three
    rungs with G511.1's 900 m cull.

    NO `rules.size`: these are the pack's conifers at their own scale, which is what
    "the full conifers, not the crown only ones" asks for.
    """
    out = []
    for i, g0 in enumerate(MK_WOOD):          # the three loops the user drew
        g = simple_ring(g0)
        if g is None or len(g) < 4:
            DROPPED.append(('mk_z_wood%d' % i, 'the traced loop will not come simple'))
            continue
        out.append({'id': 'mk_z_wood%d' % i, 'kind': 'forest', 'poly': [pt(*q) for q in g],
                    'density': 0.4, 'palette': list(MK_WOOD_TREES),
                    'rules': {'clearings': False}})
    return out


def wood_zones_quarters(zs):
    """...and the same wood through every residential quarter's gaps, because the
    user's loops were examples and not the whole instruction: "this should not be
    limited to what I highlighted, you should understand the spirit"."""
    out = []
    for z in zs:
        if z['id'] not in MK_WOOD_ZONES:
            continue
        out.append({'id': 'mk_z_wq_' + z['id'][5:], 'kind': 'forest', 'poly': z['poly'],
                    'density': 0.11, 'palette': list(MK_WOOD_TREES),
                    'rules': {'clearings': False}})
    return out


def wood_stamps_drawn():
    """The three loops the user drew, as PAINT rather than as placed trees.

    They were `forest` zones at first, which put 2310 individual trees in the record -
    one THREE.LOD each, no impostor, no instancing. The user's ruling: "I don't want
    them to be fixed trees, I want to use the normal tree system, and just paint those
    zones ... maybe alter the terrain type, let the game do the work." So the same
    polygons stamp terrain type 16 `residential` - medium conifers, high density - and
    the COVER class with it, which is the piece that was missing (v1.23): the island's
    fill is gated on `world.surface`, and over a town the cover raster says BUILT,
    which is PAVED, which the fill refuses.
    """
    out = []
    for i, g0 in enumerate(MK_WOOD):
        g = simple_ring(g0)
        if g is None or len(g) < 4:
            DROPPED.append(('mk_tt_wood_drawn%d' % i, 'the traced loop will not come simple'))
            continue
        out.append({'id': 'mk_tt_drawn%d' % i, 'poly': [pt(*q) for q in g], 'code': 16,
                    'from': RESVEG_FROM, 'clear': True, 'cover': WC_GRASS})
    return out



# ---- the street grid, pulled off the registered views (met_streets.py) -------
# (x0, z0, x1, z1, family): A = the named cross streets, C = the numbered avenues
STREETS = [
    (-2600, -8700, -2730, -8561, 'A'),
    (-2779, -8558, -2876, -8454, 'A'),
    (-2700, -8702, -2780, -8616, 'A'),
    (-2869, -8603, -3067, -8391, 'A'),
    (-2850, -8703, -2996, -8546, 'A'),
    (-3122, -8462, -3210, -8368, 'A'),
    (-2898, -8760, -3186, -8452, 'A'),
    (-2994, -8701, -3256, -8420, 'A'),
    (-2909, -8823, -3259, -8449, 'A'),
    (-2898, -8944, -3351, -8458, 'A'),
    (-2933, -8963, -3413, -8448, 'A'),
    (-2969, -8980, -3459, -8455, 'A'),
    # trimmed 55 m short of its traced end: it ran INTO the ball field, and a
    # 27 m diamond will not fit between streets 46 m apart - in the real town
    # the field takes the block and the avenue stops at it
    (-3109, -8927, -3286, -8736, 'A'),
    (-3597, -8407, -3695, -8302, 'A'),
    (-3493, -8567, -3631, -8419, 'A'),
    (-3324, -8753, -3457, -8611, 'A'),
    (-3612, -8495, -3857, -8232, 'A'),
    (-3143, -9041, -3514, -8643, 'A'),
    (-3554, -8602, -3790, -8349, 'A'),
    (-3503, -8703, -3836, -8346, 'A'),
    (-3275, -8964, -3606, -8609, 'A'),
    (-3671, -8572, -3780, -8455, 'A'),
    (-3317, -8987, -3611, -8671, 'A'),
    (-3355, -9022, -3728, -8622, 'A'),
    (-3918, -8474, -4138, -8237, 'A'),
    (-3340, -9096, -3944, -8448, 'A'),
    (-4003, -8439, -4239, -8186, 'A'),
    (-3438, -9070, -4009, -8459, 'A'),
    (-3878, -8651, -4346, -8149, 'A'),
    (-3964, -8624, -4309, -8254, 'A'),
    (-3982, -8654, -4139, -8486, 'A'),
    (-3813, -8881, -3956, -8727, 'A'),
    (-3060, -8911, -2899, -8761, 'C'),
    (-2837, -8702, -2668, -8544, 'C'),
    (-3222, -9004, -2988, -8785, 'C'),
    (-3252, -8980, -2898, -8650, 'C'),
    (-2997, -8701, -2693, -8418, 'C'),
    (-3458, -9088, -2898, -8566, 'C'),
    (-3515, -9082, -2898, -8507, 'C'),
    (-3136, -8702, -2864, -8448, 'C'),
    (-3574, -9084, -2929, -8482, 'C'),
    (-2869, -8381, -2745, -8265, 'C'),
    (-3561, -9015, -2982, -8475, 'C'),
    (-3208, -8648, -2958, -8415, 'C'),
    (-3577, -8978, -3284, -8705, 'C'),
    (-3601, -8932, -3349, -8697, 'C'),
    (-3305, -8652, -3130, -8489, 'C'),
    (-3625, -8897, -3144, -8448, 'C'),
    (-3322, -8572, -3116, -8380, 'C'),
    (-3648, -8866, -3376, -8613, 'C'),
    (-3679, -8839, -3259, -8448, 'C'),
    (-3401, -8526, -3238, -8373, 'C'),
    (-3854, -8907, -3367, -8452, 'C'),
    (-3701, -8703, -3360, -8385, 'C'),
    (-3623, -8579, -3522, -8485, 'C'),
    (-3470, -8435, -3358, -8331, 'C'),
    (-3893, -8812, -3677, -8610, 'C'),
    (-3924, -8788, -3577, -8464, 'C'),
    (-3921, -8703, -3575, -8381, 'C'),
    (-3887, -8625, -3580, -8338, 'C'),
    (-3828, -8497, -3657, -8337, 'C'),
    (-4045, -8658, -3894, -8518, 'C'),
    (-3866, -8474, -3677, -8298, 'C'),
    (-4104, -8624, -3972, -8501, 'C'),
    (-4114, -8586, -3795, -8289, 'C'),
    (-4123, -8547, -3952, -8388, 'C'),
    (-4135, -8472, -3999, -8346, 'C'),
    (-4176, -8429, -3945, -8213, 'C'),
    (-4201, -8405, -4062, -8276, 'C'),
    (-4236, -8371, -4116, -8259, 'C'),
    (-4262, -8346, -4143, -8235, 'C'),
]

# ---- the traced roads: everything that is not on the grid ---------------------
# Read off the registered views at 0.5-1.7 m per pixel (met_trace.py tiles).
WALDEN_PNT_RD = [(-2954, -8696), (-2854, -8663), (-2687, -8604), (-2537, -8563), (-2370, -8521),
                 (-2237, -8488), (-2104, -8446), (-1970, -8413), (-1837, -8379), (-1687, -8346),
                 (-1570, -8312), (-1437, -8296), (-1362, -8318)]
AIRPORT_RD = [(-2872, -8688), (-2862, -8560), (-2852, -8420), (-2846, -8280), (-2841, -8140),
              (-2836, -8030), (-2820, -7900), (-2796, -7760)]
SKATERS_LAKE_RD = [(-3412, -8432), (-3332, -8402), (-3292, -8300), (-3262, -8180), (-3230, -8090),
                   (-3180, -8035), (-3100, -8025), (-2990, -8022), (-2880, -8028), (-2846, -8030)]
GRAVEYARD_RD = [(-4205, -8486), (-4252, -8420), (-4300, -8300), (-4350, -8180), (-4400, -8060),
                (-4432, -7970), (-4444, -7900)]
RAVEN_ST = [(-3215, -8020), (-3175, -7965), (-3100, -7940), (-3020, -7930), (-2960, -7900),
            (-2930, -7850), (-2900, -7800), (-2862, -7772)]
WOLF_ST = [(-3060, -7975), (-3010, -7950), (-2975, -7915), (-2950, -7880), (-2935, -7840)]
BREAKWATER_RD = [(-3090, -8930), (-3040, -8880), (-3000, -8830), (-2975, -8780), (-2958, -8736)]

TRACED = [
    ('mk_r_walden', 'Walden Point Road', WALDEN_PNT_RD, 6.5, 'paved', 'worn', 0.09, 2),
    ('mk_r_airport', 'Airport Road', AIRPORT_RD, 6.0, 'paved', 'worn', 0.10, 1),
    ('mk_r_skaters', 'Skaters Lake Road', SKATERS_LAKE_RD, 6.0, 'paved', 'worn', 0.10, 1),
    ('mk_r_graveyard', 'Oceanview Graveyard Road', GRAVEYARD_RD, 5.0, 'paved', 'worn', 0.11, 0),
    ('mk_r_raven', 'Raven Street', RAVEN_ST, 5.5, 'paved', 'worn', 0.10, 0),
    ('mk_r_wolf', 'Wolf Street', WOLF_ST, 5.0, 'paved', 'worn', 0.10, 0),
    ('mk_r_breakwater', 'Breakwater Road', BREAKWATER_RD, 6.0, 'paved', 'worn', 0.10, 1),
]


DROPPED = []


def trim_dry(x0, z0, x1, z1):
    """Cut a straight street back to its longest dry run."""
    n = max(2, int(math.hypot(x1 - x0, z1 - z0) / 10))
    dry = [coast_m(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n) >= 0 for k in range(n + 1)]
    best = (0, -1)
    i = 0
    while i <= n:
        if not dry[i]:
            i += 1
            continue
        j = i
        while j + 1 <= n and dry[j + 1]:
            j += 1
        if j - i > best[1] - best[0]:
            best = (i, j)
        i = j + 1
    a, b = best
    return (x0 + (x1 - x0) * a / n, z0 + (z1 - z0) * a / n,
            x0 + (x1 - x0) * b / n, z0 + (z1 - z0) * b / n)


# THE BALL FIELD TAKES THE BLOCK. Metlakatla's streets are 46 m apart and the
# smallest honest baseball park is 91 x 76 m (measured: SITE_P shrinks the lit
# preset's outfield from 80 m to 56 and it is still that big), so NO position
# within 120 m of the traced field clears the grid - the search says so. In the
# real town the field occupies its block and the avenues stop at its fence, so
# that is what is authored: any street entering this box is cut at the fence, and
# a street the box would cut in TWO keeps its longer half and says so.
# (cx, cz, half along U, half along V, margin) - the foot measured at compose.
BALLFIELD = (-3324.0, -8682.0, 45.6, 38.0, 6.0)


def clip_ballfield(x0, z0, x1, z1):
    """The part of this street outside the ball field's box, or None."""
    cx, cz, ha, hb, m = BALLFIELD
    ha, hb = ha + m, hb + m
    def inside(x, z):
        dx, dz = x - cx, z - cz
        return abs(dx * UAX[0] + dz * UAX[1]) < ha and abs(dx * VAX[0] + dz * VAX[1]) < hb
    n = 60
    keep = [k for k in range(n + 1)
            if not inside(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n)]
    if len(keep) == n + 1:
        return x0, z0, x1, z1
    if not keep:
        return None
    # the longest unbroken run of samples outside the box
    best, run = (keep[0], keep[0]), (keep[0], keep[0])
    for k in keep[1:]:
        run = (run[0], k) if k == run[1] + 1 else (k, k)
        if run[1] - run[0] > best[1] - best[0]:
            best = run
    a, b = best
    return (x0 + (x1 - x0) * a / n, z0 + (z1 - z0) * a / n,
            x0 + (x1 - x0) * b / n, z0 + (z1 - z0) * b / n)


def axis_polys():
    """The drawn axes, walked ashore, as game polylines."""
    out = []
    for g in MK_AX:
        pts = [pull_inland(x, z, 16.0) for x, z in g]
        # a stroke drawn over the waterfront may have wandered into the bay; the
        # walk brings it back, and the near-duplicates the walk makes are dropped
        keep = [pts[0]]
        for q in pts[1:]:
            if math.hypot(q[0] - keep[-1][0], q[1] - keep[-1][1]) > 6.0:
                keep.append(q)
        if len(keep) >= 2 and sum(math.hypot(keep[i][0] - keep[i - 1][0], keep[i][1] - keep[i - 1][1])
                                  for i in range(1, len(keep))) >= 60:
            out.append(keep)
    return out


AXES = None


def seg_near_axis(x0, z0, x1, z1, half=17.0):
    """What share of this straight street lies within `half` m of a drawn axis?

    A vote that finds a street also finds the arterial the user drew, and draws it
    STRAIGHT: the same road twice, a few metres apart, which on the ground is a pair
    of parallel carriageways through somebody's garden. The drawn line wins.
    """
    global AXES
    if AXES is None:
        AXES = axis_polys()
    L = math.hypot(x1 - x0, z1 - z0)
    n = max(4, int(L / 12))
    hit = 0
    for k in range(n + 1):
        u = k / float(n)
        px, pz = x0 + (x1 - x0) * u, z0 + (z1 - z0) * u
        d = 1e9
        for g in AXES:
            for i in range(1, len(g)):
                a, b = g[i - 1], g[i]
                dx, dz = b[0] - a[0], b[1] - a[1]
                t = max(0.0, min(1.0, ((px - a[0]) * dx + (pz - a[1]) * dz) / max(1e-9, dx * dx + dz * dz)))
                d = min(d, math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t)))
        if d < half:
            hit += 1
    return hit / float(n + 1)


def dist_to_lines(px, pz, LINES):
    d = 1e9
    for g in LINES:
        for i in range(1, len(g)):
            a, b = g[i - 1], g[i]
            dx, dz = b[0] - a[0], b[1] - a[1]
            t = max(0.0, min(1.0, ((px - a[0]) * dx + (pz - a[1]) * dz) / max(1e-9, dx * dx + dz * dz)))
            d = min(d, math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t)))
    return d


def dist_to_axes(px, pz):
    global AXES
    if AXES is None:
        AXES = axis_polys()
    return dist_to_lines(px, pz, AXES)


def trim_to_axes(pts, half=20.0, step=15.0, LINES=None):
    """The part of this TRACED road that no drawn axis already covers.

    The user, of the axis running south past Skaters Lake: "The one going down to
    the south replaced the straight approximation you made before too." A traced
    road is not a voted street and was not being tested at all, so Skaters Lake
    Road kept running straight under the hand-drawn curve for its first 470 m -
    two carriageways twenty metres apart. The rule is the same one the streets
    get, with one difference: a traced road may be only PARTLY duplicated (the
    axis stops at the lake and the road runs on east), so it is trimmed to its
    longest clear run rather than dropped.
    """
    S = []
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, int(L / step))
        for k in range(n):
            u = k / float(n)
            S.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
    S.append(tuple(pts[-1]))
    free = [(dist_to_lines(q[0], q[1], LINES) if LINES is not None else dist_to_axes(*q)) >= half for q in S]
    if all(free):
        return pts, 0.0
    best = run = None
    for k, f in enumerate(free):
        if not f:
            run = None
            continue
        run = (k, k) if run is None else (run[0], k)
        if best is None or run[1] - run[0] > best[1] - best[0]:
            best = run
    if best is None or best[1] - best[0] < 3:
        return None, 1.0
    keep = S[best[0]:best[1] + 1]
    cut = 1.0 - (best[1] - best[0] + 1) / float(len(S))
    return [list(q) for q in keep], cut


def roads():
    del DROPPED[:]
    """Every street. THE WHOLE TOWN IS ONE SURFACE: `paved`/`worn`, which is old
    concrete (RUNWAY_LOOKS.worn -> cls 'concrete', set 'cracked'). The user:
    "change all city roads back to concrete (or whatever you have in majority),
    get rid of the dirt ones, they don't belong here" - and the majority was
    exactly this, 33 of 61. There is no gravel and no dirt in Metlakatla now; the
    back lanes are told apart by WIDTH and by having no traffic, not by surface.
    `smooth` rounds the corners of the traced lines (contract v1.19)."""
    out = []
    for i, (x0, z0, x1, z1, fam) in enumerate(STREETS):
        # A STREET DETECTOR FINDS FLOATS. The marina's finger floats and the
        # cannery's dock read exactly like a bright grey line on a dark ground,
        # so met_streets.py handed back a dozen of them. A candidate whose middle
        # is at sea, or whose ends will not come ashore, is not a street.
        if coast_m((x0 + x1) / 2, (z0 + z1) / 2) < 0:
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'its middle is at sea'))
            continue
        # a street that reaches the shore is one the town CARRIES: it keeps the
        # extra half-metre of width and the traffic. It is not a surface test any
        # more - every street in Metlakatla is old concrete (see `roads`).
        carries = min(dem(x0, z0), dem(x1, z1)) < 14.0
        (x0, z0), (x1, z1) = pull_inland(x0, z0, 22.0), pull_inland(x1, z1, 22.0)
        if min(coast_m(x0, z0), coast_m(x1, z1)) < 4.0:
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'an end will not come ashore'))
            continue
        # and a straight street may still cross a cove between its two dry ends
        n = max(2, int(math.hypot(x1 - x0, z1 - z0) / 15))
        wet = [k for k in range(n + 1)
               if coast_m(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n) < -3.0]
        if wet:
            x0, z0, x1, z1 = trim_dry(x0, z0, x1, z1)
            if math.hypot(x1 - x0, z1 - z0) < 70:
                DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'it crosses the water'))
                continue
        # THE DRAWN AXIS WINS. A straight street lying on top of one for most of its
        # length is the same road traced twice, and two carriageways 8 m apart is
        # exactly the "absolute grid pattern" the user asked to be broken.
        if crossed_out(x0, z0, x1, z1) >= 2:
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'crossed out in blue'))
            continue
        if ('mk_s%s%02d' % (fam.lower(), i)) in blue_kills():
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'struck out in blue'))
            continue
        cl = cleared_share(x0, z0, x1, z1)
        if cl > 0.55:
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'inside the red clearing (%d %%)' % round(cl * 100)))
            continue
        share = seg_near_axis(x0, z0, x1, z1)
        if share > 0.55:
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'an axis is drawn along %d %% of it' % round(share * 100)))
            continue
        clip = clip_ballfield(x0, z0, x1, z1)
        if clip is None:
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'the ball field takes its whole length'))
            continue
        if clip != (x0, z0, x1, z1):
            x0, z0, x1, z1 = clip
            if math.hypot(x1 - x0, z1 - z0) < 40:
                DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'the ball field leaves it a stub'))
                continue
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'CUT at the ball field'))
        # THE WIDTH IS THE PAINT. From G508 a paved road marks itself by its width
        # (`lanesOf`): under 5.2 m it is ONE lane - white edge lines and no centre -
        # and from 5.2 m it takes a dashed yellow centre line. Metlakatla's streets
        # are single-track residential lanes and a centre line down them would read
        # as a highway through a village, so the grid is 5.0 m and only the drawn
        # ARTERIALS are wide enough to be painted as two lanes.
        # ...AND NO PAINT ON A BACK STREET. A paved road takes two white edge lines
        # 35 cm in even at one lane, which is the right general rule and the wrong
        # one for a rural Alaskan town: Metlakatla's numbered avenues are bare chip
        # seal to the shoulder. `pav.marks: 'none'` keeps the band, the wear and the
        # polish and draws no paint. The ARTERIALS are left to the default - a centre
        # line is what tells you which roads carry the town.
        out.append({'id': 'mk_s%s%02d' % (fam.lower(), i), 'pts': [pt(x0, z0), pt(x1, z1)],
                    'w': 5.0 if carries else 4.5, 'cls': 'paved',
                    'pav': {'marks': 'none'},
                    'look': 'worn', 'band': 2,
                    'graded': True, 'falloff': 6, 'grade': 0.12, 'smooth': 0,
                    'traffic': 1 if carries else 0})
    # the seafront road the user drew in green: the waterfront's own line
    sh = [pull_inland(x, z, 14.0) for x, z in MK_SHORE[0]]
    out.append({'id': 'mk_r_shore', 'pts': [pt(*q) for q in sh], 'w': 6.5, 'cls': 'paved',
                'look': 'worn', 'band': 2, 'graded': True, 'falloff': 7, 'grade': 0.12,
                'smooth': 22, 'traffic': 1})
    for k, g in enumerate(axis_polys()):
        out.append({'id': 'mk_ax%02d' % k, 'pts': [pt(*q) for q in g], 'w': 6.5, 'cls': 'paved',
                    'look': 'worn', 'band': 2, 'graded': True, 'falloff': 8, 'grade': 0.12,
                    'smooth': 26, 'traffic': 1})
    for rid, name, pts, w, cls, look, grade, traffic in TRACED:
        if rid in blue_kills():
            # A TRACED ROAD IS A POLYLINE and a stroke may mark only part of it:
            # the Skaters Lake stroke covers the straight head the hill axis
            # replaces, and the road runs on east past the lake where nothing was
            # drawn over it. So a marked traced road is TRIMMED to the part that
            # was not struck out, and dropped only if nothing is left.
            pts, cut = trim_to_axes(pts, half=16.0, LINES=MK_BLUE)
            if pts is None:
                DROPPED.append((rid, 'struck out in blue, whole'))
                continue
            DROPPED.append((rid, 'STRUCK OUT in blue over %d %% of it, trimmed' % round(cut * 100)))
        pts, cut = trim_to_axes(pts)
        if pts is None:
            DROPPED.append((rid, 'a drawn axis replaces it whole'))
            continue
        if cut > 0.02:
            DROPPED.append((rid, 'TRIMMED: a drawn axis replaces %d %% of it' % round(cut * 100)))
        out.append({'id': rid, 'pts': [pt(*pull_inland(*p, margin=18.0)) for p in pts], 'w': w, 'cls': cls, 'look': look,
                    'band': 2 if look else None, 'graded': True, 'falloff': 8 if w > 5.5 else 6,
                    'grade': grade, 'smooth': 30, 'traffic': traffic, 'rail': 'auto'})
    # SNAP, THEN DROP, THEN SNAP. Two streets 10 m apart score as a 19 % double and
    # survive; snapping their ends onto each other makes the same pair a 52 % one,
    # which is the honest reading - they were always the same street. So the pass
    # runs after the first snap, and the second snap tidies the ends the drop freed.
    snap_ends(out)
    drop_doubles(out)
    snap_ends(out)
    # ...and only now the stubs and the slivers: an end that the snap joined is not a
    # free end, and a street the double pass removed is not a sliver.
    trim_lakes(out)
    trim_slivers(out)
    snap_ends(out)          # a trimmed end is a new near miss; the trims get their own snap
    thin_stubs(out)
    return out


DOUBLED = []


def rank(rid):
    """Who wins when two roads lie on each other: the drawn axis, then the traced
    road, then the voted street."""
    return 2 if rid.startswith('mk_ax') else (1 if rid.startswith('mk_r_') else 0)


def drop_doubles(rs, share=0.45):
    """Two roads running side by side are one road traced twice.

    tools/met_cross.js measures it: how much of a road lies within half the two
    widths plus 9 m of another, at a tangent under 22 degrees. A VOTED street
    always loses - to a drawn axis, to a traced road, and to a longer street -
    because the vote is the thing that invents parallels: it finds the same line
    twice when a wide road's two kerbs each score as a peak.
    """
    del DOUBLED[:]
    def samples(r):
        S = []
        for i in range(1, len(r['pts'])):
            a, b = r['pts'][i - 1], r['pts'][i]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            n = max(1, int(L / 8))
            for k in range(n):
                u = k / float(n)
                S.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
        S.append(tuple(r['pts'][-1]))
        return S
    def length(r):
        return sum(math.hypot(r['pts'][i][0] - r['pts'][i - 1][0], r['pts'][i][1] - r['pts'][i - 1][1])
                   for i in range(1, len(r['pts'])))
    SM = {r['id']: samples(r) for r in rs}
    kill = set()
    for a in rs:
        if not a['id'].startswith('mk_s') or a['id'] in kill:      # only a voted street may lose
            continue
        for b in rs:
            if b is a or b['id'] in kill:
                continue
            reach = (a['w'] + b['w']) / 2.0 + 9.0
            near = sum(1 for q in SM[a['id']] if dist_to_lines(q[0], q[1], [b['pts']]) < reach)
            sh = near / float(len(SM[a['id']]))
            if sh < share:
                continue
            if b['id'].startswith('mk_s') and length(b) <= length(a):
                continue                                            # the longer street keeps the line
            kill.add(a['id'])
            DOUBLED.append((a['id'], b['id'], round(sh * 100)))
            break
    for i in range(len(rs) - 1, -1, -1):
        if rs[i]['id'] in kill:
            DROPPED.append((rs[i]['id'], 'runs alongside another road'))
            del rs[i]
    # A TRACED ROAD IS TRIMMED, NOT DROPPED. Wolf Street was traced lying on Raven
    # Street for 104 m and then leaving it - dropping it loses a real road, keeping
    # it draws two carriageways twenty metres apart. So the SHORTER of a doubled
    # pair keeps only its longest run clear of the longer one, whatever layer it
    # came from, and says how much it lost.
    for r in list(rs):
        # the DRAWN AXES are a designed network and meet each other on purpose; and a
        # couple of samples near a junction are not a double. Only a traced road, and
        # only when a QUARTER of it lies on a longer one.
        if len(r['pts']) < 3 or r['id'].startswith('mk_ax'):
            continue
        for o in rs:
            # PRECEDENCE: a drawn axis beats a traced road beats a voted street, and
            # among equals the longer line wins. Without it the hand-drawn seafront
            # road lost 38 % of itself to a voted street lying on it, which is the
            # rule running backwards - the whole point of the axes is that the drawn
            # line is the true one.
            if o is r or rank(o['id']) < rank(r['id']):
                continue
            if rank(o['id']) == rank(r['id']) and length(o) <= length(r):
                continue
            reach = (r['w'] + o['w']) / 2.0 + 9.0
            keep, cut = trim_to_axes(r['pts'], half=reach, LINES=[o['pts']])
            if cut <= 0.25:
                continue
            if keep is None or len(keep) < 2:
                rs.remove(r)
                DROPPED.append((r['id'], 'it lies on ' + o['id'] + ' end to end'))
            else:
                r['pts'] = [pt(*q) for q in keep]
                DOUBLED.append((r['id'], o['id'], round(cut * 100)))
                DROPPED.append((r['id'], 'TRIMMED: %d %% of it lay on %s' % (round(cut * 100), o['id'])))
            break


THINNED = []


def thin_stubs(rs, reach=12.0):
    """A street that goes nowhere is not a street of the same width.

    The user: "the stub roads should be a lot less wide." tools/met_cross.js counts
    67 ends in the open - a street that meets the network at one end and stops in
    the muskeg at the other. In a real town those are the last block's access: a
    single track. So a street with a free END loses a metre of width, and one free
    at BOTH ends - which meets nothing at all - narrows to 3.2 m.

    WIDTH ONLY. The first cut of this pass also dropped the both-ends-free streets
    to `dirt`, which the user struck out: "get rid of the dirt ones, they don't
    belong here". They keep the town's one surface and are told apart by their
    section, which is what a 3.2 m carriageway already says on its own.
    """
    del THINNED[:]
    def foot(q, pl):
        best = 1e9
        for i in range(1, len(pl)):
            a, b = pl[i - 1], pl[i]
            dx, dz = b[0] - a[0], b[1] - a[1]
            t = max(0.0, min(1.0, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / max(1e-9, dx * dx + dz * dz)))
            best = min(best, math.hypot(q[0] - (a[0] + dx * t), q[1] - (a[1] + dz * t)))
        return best
    for r in rs:
        if not r['id'].startswith('mk_s'):        # the arterials and the traced roads keep their width
            continue
        free = 0
        for k in (0, -1):
            q = r['pts'][k]
            d = min([foot(q, o['pts']) - o['w'] / 2.0 for o in rs if o is not r] or [1e9])
            if d > reach:
                free += 1
        if not free:
            continue
        if free == 2:
            r['w'] = 3.2
            r['traffic'] = 0
        else:
            r['w'] = max(3.6, r['w'] - 1.0)
        THINNED.append((r['id'], free, r['w'], r['cls']))


def tangent_gap(tg, o, q):
    """The angle in degrees between `tg` and road `o`'s direction nearest `q`."""
    best, bd = 0.0, 1e9
    for i in range(1, len(o['pts'])):
        a, b = o['pts'][i - 1], o['pts'][i]
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz) or 1.0
        t = max(0.0, min(1.0, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (L * L)))
        d = math.hypot(q[0] - (a[0] + dx * t), q[1] - (a[1] + dz * t))
        if d < bd:
            bd = d
            c = abs(tg[0] * dx / L + tg[1] * dz / L)
            best = math.degrees(math.acos(max(-1.0, min(1.0, c))))
    return best


SLIVERED = []


def trim_slivers(rs, deg=28.0, half=22.0):
    """A street that runs ALONG another for tens of metres at a shallow angle.

    Two ribbons in one lens: the paint, the band, the wear and the guardrails all
    fight inside it, and from the air it reads as one road that forked for no reason.
    A voted street is trimmed back to where it leaves the lens; the road it was
    lying on keeps its line.
    """
    del SLIVERED[:]
    def near(q, o):
        best = 1e9
        for i in range(1, len(o['pts'])):
            a, b = o['pts'][i - 1], o['pts'][i]
            dx, dz = b[0] - a[0], b[1] - a[1]
            t = max(0.0, min(1.0, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / max(1e-9, dx * dx + dz * dz)))
            best = min(best, math.hypot(q[0] - (a[0] + dx * t), q[1] - (a[1] + dz * t)))
        return best
    for r in list(rs):
        if not r['id'].startswith('mk_s') or len(r['pts']) != 2:
            continue
        others = [o for o in rs if o is not r and len(o['pts']) >= 2]
        a, b = r['pts'][0], r['pts'][1]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(4, int(L / 10))
        S = [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n + 1)]
        # THE ANGLE IS THE WHOLE TEST. Without it every street in a 46 m grid reads as
        # lying inside another's lens near its junctions - the first cut trimmed 44
        # roads and dropped 12, which is the tool saying the rule was wrong, not the
        # town. A sample is in a lens only where the road it is near runs nearly
        # PARALLEL to it there.
        tg = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        lens = [any(near(q, o) < half and tangent_gap(tg, o, q) < deg for o in others) for q in S]
        if sum(lens) * 10 < 25 or all(lens):
            continue
        # the longest run OUTSIDE the lens
        best = run = None
        for k, inside in enumerate(lens):
            if inside:
                run = None
                continue
            run = (k, k) if run is None else (run[0], k)
            if best is None or run[1] - run[0] > best[1] - best[0]:
                best = run
        if best is None or (best[1] - best[0]) * 10 < 45:
            rs.remove(r)
            DROPPED.append((r['id'], 'it runs alongside another road for its whole length'))
            SLIVERED.append((r['id'], 'dropped'))
            continue
        r['pts'] = [pt(*S[best[0]]), pt(*S[best[1]])]
        SLIVERED.append((r['id'], 'trimmed %d %%' % round(100 * sum(lens) / float(len(lens)))))


SNAPPED = []


def snap_ends(rs, reach=12.0):
    """An end that stops a few metres short of another road is pulled onto it.

    tools/met_cross.js counted twenty-six of them, most between one and seven
    metres. On the ground that is a junction the network does not have: the
    traffic will not turn there, the pole line stops, the plot sower reads two
    unconnected frontages, and from the air a street visibly stops just short of
    the one it should meet. The ends move, never the middles, so nothing that was
    traced moves off its street - the largest pull here is under `reach`.
    """
    del SNAPPED[:]
    def foot(q, pl):
        best = (1e9, None)
        for i in range(1, len(pl)):
            a, b = pl[i - 1], pl[i]
            dx, dz = b[0] - a[0], b[1] - a[1]
            t = max(0.0, min(1.0, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / max(1e-9, dx * dx + dz * dz)))
            f = (a[0] + dx * t, a[1] + dz * t)
            d = math.hypot(q[0] - f[0], q[1] - f[1])
            if d < best[0]:
                best = (d, f)
        return best
    for r in rs:
        if r['id'].startswith('mk_p') or r.get('cls') == 'water':
            continue
        for k in (0, -1):
            q = r['pts'][k]
            best = (1e9, None, None)
            for o in rs:
                if o is r:
                    continue
                d, f = foot(q, o['pts'])
                d -= o['w'] / 2.0                     # to the far side's edge, not its middle
                if d < best[0]:
                    best = (d, f, o['id'])
            if best[1] is None or not (0.4 < best[0] <= reach):
                continue
            r['pts'][k] = pt(*best[1])
            SNAPPED.append((r['id'], 'start' if k == 0 else 'end', round(best[0], 1), best[2]))


# ---- the town's own grid, as a frame ------------------------------------------
# U runs along an avenue (grid bearing 43 deg), V across it, down a cross street.
UAX = (math.cos(math.radians(-47.0)), math.sin(math.radians(-47.0)))
VAX = (math.cos(math.radians(43.0)), math.sin(math.radians(43.0)))


def grect(cx, cz, a, b):
    """A rectangle in the town's own grid: `a` metres along an avenue either side
    of (cx, cz), `b` metres along a cross street."""
    out = []
    for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        out.append(pt(cx + su * a * UAX[0] + sv * b * VAX[0], cz + su * a * UAX[1] + sv * b * VAX[1]))
    return out


def gyard(yid, cx, cz, a, b, seed=0, coast=True, bite=0.30, n=3):
    """A YARD, which is level but is not a perfect rectangle.

    The user, over the town from the air: "You have also large fully square patches,
    and I wish they would be less square. An industrial terrain is indeed level, but
    not always full square, especially next to natural features like coast or hills."
    That is exactly right and the rectangles were pure laziness: a yard is level
    because it was BULLDOZED level, and what it was bulldozed out of decides its
    outline - the sea takes the seaward corner, a bank takes the uphill one, and a
    working yard grows a bay where it needed one.

    So the rectangle is walked at `n` points a side, each pushed in or out by a value
    noise of the seed (the same bay on every re-run), and then, where `coast` is on,
    any vertex that is not far enough inland WALKS ashore up the coast field's own
    gradient - which is what bends a waterfront yard along its own beach instead of
    cutting a square hole in it.
    """
    rnd = random.Random(hash((yid, seed)) & 0xffffffff)
    # the rectangle's outline, walked
    ring = []
    C = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for k in range(4):
        su, sv = C[k]
        tu, tv = C[(k + 1) % 4]
        for i in range(n):
            f = i / float(n)
            u = (su + (tu - su) * f)
            v = (sv + (tv - sv) * f)
            # push the edge in or out; a CORNER moves less than the middle of a side
            edge = 1.0 - abs(2.0 * f - 1.0)
            k2 = 1.0 - bite * edge * rnd.random()
            x = cx + u * a * k2 * UAX[0] + v * b * k2 * VAX[0]
            z = cz + u * a * k2 * UAX[1] + v * b * k2 * VAX[1]
            ring.append((x, z))
    if coast:
        ring = [pull_inland(x, z, 6.0) for x, z in ring]
    # the walk can fold a vertex past its neighbours; the hull of the walked ring is
    # not what we want (it would square it up again), so only near-duplicates go
    out = [ring[0]]
    for q in ring[1:]:
        if math.hypot(q[0] - out[-1][0], q[1] - out[-1][1]) > 3.0:
            out.append(q)
    # ...AND THE RESULT MUST BE SIMPLE. The walk ashore can carry a vertex past its
    # neighbours, and `compose` refuses a self-crossing polygon outright - the ferry
    # yard's did, and the gate caught it. Drop the offending vertex and try again;
    # a shape that will not come right falls back to the rectangle it started as,
    # which is honest and is what was there before.
    for _ in range(len(out)):
        k = first_crossing(out)
        if k < 0:
            break
        del out[k]
        if len(out) < 4:
            break
    if len(out) < 4 or first_crossing(out) >= 0:
        return grect(cx, cz, a, b)
    return [pt(*q) for q in out]


def first_crossing(poly):
    """The index of a vertex whose edge crosses a non-neighbouring one, or -1."""
    n = len(poly)
    def side(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    def hit(a, b, c, d):
        return (side(a, b, c) > 0) != (side(a, b, d) > 0) and (side(c, d, a) > 0) != (side(c, d, b) > 0)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        for j in range(i + 1, n):
            if j == i or (j + 1) % n == i or j == (i + 1) % n:
                continue
            c, d = poly[j], poly[(j + 1) % n]
            if hit(a, b, c, d):
                return (i + 1) % n
    return -1


def face(dx, dz):
    """A site yaw whose single item faces the direction (dx, dz): the item's world
    yaw is at.yaw + pi (placeSite's convention, 27_premises.js ~:790), and a
    building's front is its +z, which a yaw Y sends to (sin Y, cos Y)."""
    return R(math.atan2(dx, dz) - math.pi, 4)


# ---- the landmarks, read off the registered close views -----------------------
# (id, name, key, x, z, facing) - facing is the direction the front looks
LANDMARKS = [
    ('mk_hall', 'Metlakatla Town Hall', 'house/town hall', -3462, -8724, VAX),
    ('mk_church_presb', 'Metlakatla Presbyterian Church', 'house/church', -3416, -8770, VAX),
    ('mk_church_duncan', 'William Duncan Memorial Church', 'house/church', -3466, -8635, VAX),
    ('mk_church_cong', 'Congregational Church', 'house/village church', -3300, -8620, VAX),
    ('mk_kingdom_hall', 'Kingdom Hall', 'house/chapel', -4128, -8332, VAX),
    ('mk_school_elem', 'Richard Johnson Elementary School', 'house/school', -3310, -8782, VAX),
    ('mk_school_high', 'Metlakatla High School', 'house/school', -3358, -8598, VAX),
    ('mk_store_acc', 'Alaska Commercial Company', 'house/general store', -3470, -8996, VAX),
    ('mk_cafe_als', "Al's American", 'house/cafe', -3466, -8681, VAX),
    ('mk_inn', 'Metlakatla Inn & Suites', 'house/motel', -3365, -8879, VAX),
    ('mk_museum', 'Duncan Cottage Museum', 'house/saltbox cottage', -3209, -8907, VAX),
    ('mk_post', 'United States Postal Service', 'house/post office', -3392, -8560, VAX),
    ('mk_police', 'Metlakatla Police', 'house/police', -3268, -8586, VAX),
    ('mk_clinic', 'Annette Island Service Unit', 'house/clinic', -3230, -8700, VAX),
    ('mk_fire', 'Metlakatla Fire Hall', 'big/fire hall', -3180, -8742, VAX),
    ('mk_credit_union', 'Tongass Federal Credit Union', 'big/technical services', -3224, -8714, VAX),
    ('mk_employment', 'Employment & Training', 'big/terminal', -3259, -8766, VAX),
    ('mk_senior', 'Metlakatla Senior Citizens Center', 'house/clinic', -3560, -8846, VAX),
    ('mk_longhouse', 'Metlakatla Long House', 'house/log cabin', -3672, -8683, VAX),
    ('mk_harbormaster', 'MIC Harbor master', 'house/air taxi office', -3858, -8685, VAX),
    ('mk_se_winds', 'Southeast Winds', 'big/workshop', -3855, -8615, VAX),
    ('mk_marine', 'Tongass Marine Supply', 'house/marine supply', -3820, -8660, VAX),
    ('mk_fuel_float', 'Harbour fuel', 'house/fuel and bait', -3790, -8700, VAX),
    ('mk_boatshed', 'Harbour boat shed', 'big/boat shed', -3800, -8630, VAX),
    ('mk_power', 'Alaska Power & Telephone', 'big/workshop', -3026, -8801, VAX),
    ('mk_minimart', 'Mini-mart', 'big/store', -2916, -8560, VAX),
    ('mk_gardens_shed', 'Metlakatla Indian Community Gardens', 'shed/tool shed', -2812, -8354, VAX),
    ('mk_coffee', 'Shadow Mountain Coffee', 'house/cafe', -1987, -8404, VAX),
    ('mk_gas', 'Annette Island gas fuel storage', 'big/fuel shed', -2379, -8513, VAX),
    ('mk_housing', 'Metlakatla Housing Authority', 'big/technical services', -3271, -7938, VAX),
    ('mk_social', 'MIC Social Services', 'big/terminal', -3279, -7838, VAX),
    ('mk_landscaping', 'Landscaping office', 'shed/tool shed', -2960, -8620, VAX),
    # moved 22 m NE off a junction: at its read position the net store straddled
    # the fork of the cross street and Breakwater Road and NO offset within 16 m
    # cleared both (tools/met_nudge.js says so and then oscillates, which is the
    # tool telling you the position is wrong, not the nudge)
    ('mk_wildlife', 'MIC Fish and Wildlife', 'shed/net store', -2969, -8892, VAX),
]

# the ball park is a SPORT_GEN entry, not a building
SPORTS = [
    ('mk_ballpark', 'Metlakatla Baseball Field', 'sport/ball park, lit', -3324, -8682),
    ('mk_court', 'Metlakatla hard court', 'sport/hard court', -3252, -8640),
]


# OFF THE STREET (measured by tools/met_nudge.js, re-run it after any move).
# The civic buildings are placed from the registered close views to about +-10 m,
# and seventeen of them had a corner in the carriageway - which reads exactly as
# badly as a building ten metres out of place, and which `compose` names one by
# one ("stands on road ... set it back"). Each entry is the shortest push that
# clears the road's half width and 1.9 m, along the perpendicular the foul was
# measured on; the largest is 4.5 m, so the registration is not what moved.
NUDGE = {
    'mk_church_duncan': (-4.9, 4.9),
    'mk_church_presb': (2.1, -2.1),
    'mk_clinic': (-4.2, 4.2),
    'mk_credit_union': (3.5, -3.5),
    'mk_employment': (-8.1, -8.1),
    'mk_fire': (2.5, -2.5),
    'mk_kingdom_hall': (2.1, 14.5),
    'mk_landscaping': (-2.9, 3.4),
    'mk_longhouse': (-2.2, -6.1),
    'mk_marine': (-5.7, -5.7),
    'mk_minimart': (-2.1, -2.1),
    'mk_school_elem': (-11, 11),
    'mk_se_winds': (9.2, -2.5),
    'mk_senior': (7.5, 0),
    'mk_store_acc': (2.1, 2.1),
    'mk_wildlife': (-6.4, -5),
}


# How far inland a site must stand. 26 m is right for a house on a street and
# wrong for a net store on the cannery point, where the walk moved the thing
# forty metres up the spit and put it on a street it had been placed clear of -
# and then every nudge fought the walk instead of the street.
INLAND = {'mk_wildlife': 10.0, 'mk_marine': 14.0, 'mk_fuel_float': 12.0, 'mk_se_winds': 14.0}

# What a site overrides on its entry's own parameters.
# THE BALL PARK: the preset is a 125 x 100 m lit park with an 80 m outfield, and
# Metlakatla's diamond sits in a town block - at the preset's size it reached 48 m
# into the avenue behind it and no offset anywhere near its measured position
# cleared the grid. A 56 m outfield and two masts is a community field, which is
# what this is.
SITE_P = {'mk_ballpark': {'outfield': 56, 'masts': 2, 'standRows': 4}}


def sites():
    out = []
    for sid, name, key, x, z, dirv in LANDMARKS + [(a, b, c, d, e, VAX) for a, b, c, d, e in SPORTS]:
        dn = NUDGE.get(sid)
        if dn:
            x, z = x + dn[0], z + dn[1]
        x, z = pull_inland(x, z, INLAND.get(sid, 26.0))
        out.append({'id': sid, 'name': name,
                    'at': {'x': R(x), 'z': R(z), 'yaw': face(dirv[0], dirv[1])},
                    'yard': None,
                    'items': [{'id': sid + '_1', 'key': key, 'x': 0, 'z': 0, 'yaw': 0,
                               'P': dict(SITE_P.get(sid, {})), 'onRoad': False, 'bottomOnRoad': False}],
                    'fences': []})
    return out


def convex(pts):
    """The convex hull of these points, anticlockwise, or None under three."""
    P = sorted(set((round(float(x), 1), round(float(z), 1)) for x, z in pts))
    if len(P) < 3:
        return None
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower = []
    for q in P:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0:
            lower.pop()
        lower.append(q)
    upper = []
    for q in reversed(P):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0:
            upper.pop()
        upper.append(q)
    H = lower[:-1] + upper[:-1]
    return H if len(H) >= 3 else None


def hull(pts, margin=0.0):
    """The convex hull of these points, pushed out by `margin`, every corner then
    walked ashore. A zone was a rotated RECTANGLE first and it was wrong: the
    town's quarters are not rectangles, and the box around one of them reached
    400 m out to sea and half a kilometre into the muskeg behind.

    THE WALK BREAKS THE WINDING, so the result is HULLED AGAIN. Three corners of
    the town's own envelope came back from `pull_inland` two metres apart and out
    of order - a polygon that crosses itself - and `compose` drops such a zone
    where it stands (27_premises.js, `polySimple`), silently: the catch-all sowed
    nothing at all and nothing anywhere said why."""
    H = convex(pts)
    if not H:
        return None
    cx = sum(q[0] for q in H) / len(H)
    cz = sum(q[1] for q in H) / len(H)
    out = []
    for x, z in H:
        dx, dz = x - cx, z - cz
        L = math.hypot(dx, dz) or 1.0
        out.append(pull_inland(x + dx / L * margin, z + dz / L * margin, 8.0))
    H2 = convex(out)
    return [pt(*q) for q in H2] if H2 else None


def road_belt_raw(pts, half):
    left, right = [], []
    for i, q in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz) or 1.0
        nx, nz = -dz / L, dx / L
        left.append(pt(q[0] + nx * half, q[1] + nz * half))
        right.append(pt(q[0] - nx * half, q[1] - nz * half))
    return left + right[::-1]


def to_waterline(x, z, step=12.0, tries=40):
    """Walk to the island's own waterline from wherever you start."""
    for _ in range(tries):
        c = coast_m(x, z)
        if abs(c) < 5.0:
            return x, z
        best, bx, bz = abs(c), x, z
        for k in range(16):
            a = math.pi * 2 * k / 16
            nx, nz = x + math.cos(a) * step, z + math.sin(a) * step
            v = abs(coast_m(nx, nz))
            if v < best:
                best, bx, bz = v, nx, nz
        if (bx, bz) == (x, z):
            return x, z
        x, z = bx, bz
    return x, z


def street_pts(x0, x1, z0, z1, step=25.0):
    """Every point of every street inside the window, walked at `step`.

    It took the ENDS only at first, and a small window in the middle of a grid
    town catches almost none of them: the civic core's window found two points
    and `hull` returned None, so the town centre had no commercial zone at all
    and nothing said so. A street that merely CROSSES the window belongs to it."""
    out = []
    for a, b, c, d, fam in STREETS:
        L = math.hypot(c - a, d - b)
        n = max(1, int(L / step))
        for k in range(n + 1):
            u = k / float(n)
            x, z = a + (c - a) * u, b + (d - b) * u
            if x0 <= x <= x1 and z0 <= z <= z1:
                out.append((x, z))
    return out


# (id, kind, the window of streets it is cut from, margin)
ZONE_WINDOWS = [
    ('mk_z_core', 'commercial', (-3560, -3330, -8920, -8660), 26),
    ('mk_z_res_n', 'residential', (-3660, -3200, -9080, -8860), 26),
    ('mk_z_res_e', 'residential', (-3330, -2880, -8860, -8560), 26),
    ('mk_z_res_c', 'residential', (-3660, -3300, -8720, -8500), 26),
    ('mk_z_res_w', 'residential', (-4290, -3620, -8760, -8180), 26),
    ('mk_z_res_s', 'residential', (-3320, -2860, -8560, -8260), 26),
]
# the quarters with no street of their own in the table
ZONE_PTS = [
    ('mk_z_res_sub', 'residential',
     [(-3230, -8030), (-3170, -7960), (-3060, -7930), (-2960, -7900), (-2900, -7800),
      (-2860, -7770), (-3050, -7990), (-2930, -7840), (-3150, -8010)], 45),
    ('mk_z_ind', 'industrial',
     [(-3245, -9075), (-3090, -9080), (-3060, -8955), (-3210, -8945)], 25),
    ('mk_z_park_hayward', 'park', [(-3470, -9095), (-3400, -9105), (-3385, -9040), (-3455, -9030)], 18),
    # THE COMMUNITY GARDENS, moved 60 m east off Skaters Lake's bank. A `park` plot
    # cuts a DERIVED flatten for its lawn, and at the traced position that flatten
    # bit 3.5 m out of the bank of a lake whose surface the island holds at a fixed
    # level - so the water stood proud of ground the town had lowered under it.
    # A premises may not cut a lake's bank; there is no flatten that can win that.
    ('mk_z_park_gardens', 'park', [(-2800, -8380), (-2720, -8370), (-2710, -8300), (-2790, -8310)], 18),
    ('mk_z_bayside', 'industrial',
     [(-1660, -8470), (-1500, -8420), (-1400, -8330), (-1560, -8380)], 40),
]
# the waterfront the harbour zone follows: read from the island's own coast field,
# so the piled houses and their jetties stand on the line the GAME draws, not on
# the one the satellite shows
SHORE_ANCHORS = [(-4120, -8640), (-4010, -8700), (-3900, -8770), (-3780, -8830),
                 (-3660, -8890), (-3560, -8950), (-3470, -9010), (-3400, -9060)]


# THE PLOT DIAL (2026-09-23). The boot's build queue drains WHOLE, and the comment
# that wrote it says what it was sized for: "36 houses, 3 s on an RTX 3080 - a worker
# or a ladder is owed" (render_world.js, the G386 premises block). Metlakatla puts 452
# through it, twelve and a half times, and the roll-out's hard stop is 90 s - so a boot
# here stalls, which everyone including me has been reading as machine load all day.
# `MK_PLOTS` scales every town zone's density so the cost can be measured AS A CURVE
# against plot count rather than as a pass/fail threshold, which on a loaded box is
# really a machine-load threshold. tools/met_boot_curve.js drives it.
PLOT_K = float(os.environ.get('MK_PLOTS', '1') or 1)


def zones():
    out = []
    for zid, kind, win, margin in ZONE_WINDOWS:
        p = street_pts(*win)
        h = hull(p, margin) if len(p) >= 3 else None
        if h:
            out.append({'id': zid, 'kind': kind, 'poly': h, 'density': 1})
    for zid, kind, pts, margin in ZONE_PTS:
        h = hull(pts, margin)
        if h:
            out.append({'id': zid, 'kind': kind, 'poly': h, 'density': 1})
    # the harbour: a band astride the waterline - 45 m of beach inland, 55 m of
    # water in front, so KIND_RULES.harbour (waterOnly) can cut its plots
    line = [to_waterline(x, z) for x, z in SHORE_ANCHORS]
    out.append({'id': 'mk_z_harbour', 'kind': 'harbour',
                'poly': road_belt_raw(line, 50.0), 'density': 1})
    # THE TOWN ITSELF, SOWN LAST. The quarters above are cut from WINDOWS of the
    # street table, and a street that falls between two windows got no zone and
    # therefore no frontage at all: 31 of the 73 had their middle outside every
    # zone and 21 cut not one plot - bare tarmac with nothing along it, which is
    # what "there's still a lot of plots to fill" looks like from the air.
    # The sower rejects a plot that overlaps one already sown (27_premises.js
    # sowPlots, `ctx.plots` is the live list and the zones are walked in ARRAY
    # ORDER), so a catch-all placed LAST claims only what the quarters left: the
    # named quarters keep their own kind and density, and every other street in
    # the town's envelope gets houses. Convexity costs nothing here - a plot is
    # only ever cut along a road, and no road of the town runs in the sea.
    # THE DIAL CUTS ZONES, not only density. Turning the density down alone floors at
    # 293 plots however far it goes: `sowPlots` maps density to a GAP CHANCE capped at
    # 0.95, and the catch-all then refills whatever the quarters drop - self-
    # compensating, which is the right behaviour for authoring and useless for a curve.
    # So under 1 the catch-all goes and only a prefix of the quarters is kept.
    if PLOT_K < 1:
        keep = max(0, int(round(len(out) * PLOT_K)))
        for z in out[keep:]:
            DROPPED.append((z['id'], 'MK_PLOTS=%g: the dial dropped it' % PLOT_K))
        out = out[:keep]
        for z in out:
            z['density'] = round(z.get('density', 1) * PLOT_K, 3)
    env = hull([(a, b) for a, b, c, d, f in STREETS] + [(c, d) for a, b, c, d, f in STREETS], 44)
    if env and PLOT_K >= 1:
        out.append({'id': 'mk_z_town', 'kind': 'residential', 'poly': env, 'density': 0.62})
    # the wood goes LAST: planForest reads the plots the sowers have already cut
    out += wood_zones()
    out += wood_zones_quarters(out)
    return out


# ---- the wood behind the town -------------------------------------------------
# The user: "probably a denser tree line past the village, made of forest mix".
# NOT a premises `forest` zone: the island's own tree fill already walks this
# ground and a zone's trees would stand on top of its. What is wrong is the
# TERRAIN TYPE the fill reads. Measured over the belt round the town, the raster
# is 27 % code 7 `scrub` (the muskeg mix: holes 1, canopyFloor 3.5 - a stunted
# few) and 5 % code 10 `built`, whose `village` mix plants FORTY trees where the
# conifer plants five thousand; the 10 m classification calls the whole cleared
# apron round Metlakatla built, far past the last street. So the belt stamps
# code 8 `forest` - the `conifer_young` mix - and stamps it ONLY over 7 and 10
# (`from`), so the bog, the heath, the rock and the beach stay themselves.
# 13 `forest old` would be denser still and may not be stamped: it is DERIVED
# from slope and canopy (contract v1.20).
WOOD_IN, WOOD_OUT = 34.0, 420.0


def wood_stamps():
    """The belt, as one quad per edge of the town's own envelope.

    Built from TWO hulls at first - an inner and an outer - and the pair has no
    reason to have the same number of corners once each has been re-hulled after
    its walk ashore, so the guard that asked for it silently produced nothing at
    all. The outer ring is now the inner ring's OWN corners pushed out along their
    own radials, which keeps them paired by construction; a quad the walk has
    folded or collapsed is dropped and counted."""
    ring = [(a, b) for a, b, c, d, f in STREETS] + [(c, d) for a, b, c, d, f in STREETS]
    inner = hull(ring, WOOD_IN)
    if not inner:
        return []
    cx = sum(q[0] for q in inner) / len(inner)
    cz = sum(q[1] for q in inner) / len(inner)
    outer = []
    for x, z in inner:
        dx, dz = x - cx, z - cz
        L = math.hypot(dx, dz) or 1.0
        k = (L + WOOD_OUT - WOOD_IN) / L
        outer.append(pt(*pull_inland(cx + dx * k, cz + dz * k, 8.0)))

    def crosses(a, b, c, d):
        def side(p, q, r):
            return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
        return (side(a, b, c) > 0) != (side(a, b, d) > 0) and (side(c, d, a) > 0) != (side(c, d, b) > 0)

    out, dropped = [], 0
    n = len(inner)
    for i in range(n):
        j = (i + 1) % n
        q = [inner[i], inner[j], outer[j], outer[i]]
        a = abs(sum(q[k][0] * q[(k + 1) % 4][1] - q[(k + 1) % 4][0] * q[k][1] for k in range(4))) / 2
        if a < 400 or crosses(q[0], q[1], q[2], q[3]) or crosses(q[1], q[2], q[3], q[0]):
            dropped += 1
            continue
        out.append({'id': 'mk_tt_wood%02d' % i, 'poly': [pt(*c) for c in q], 'code': 8,
                    'from': [7, 10]})
    if dropped:
        print('  wood belt: %d of %d wedges dropped (walked ashore or folded)' % (dropped, n))
    return out


# THE YARDS, cut once and shared. A yard is three entries - the SURFACE (what the
# physics stands on), the MATERIAL (what the pavement draws) and the FLATTEN (the
# level it was bulldozed to) - and all three must be the same polygon or the paving
# runs off its own level ground. Computed here, read by all three.
_Y = {}


def yards():
    if not _Y:
        _Y['harbour'] = gyard('harbour', -3840, -8680, 80, 40, 1)
        _Y['cannery'] = gyard('cannery', -3168, -9002, 58, 38, 2)
        _Y['ferry'] = gyard('ferry', -3520, -9060, 60, 35, 3)
        _Y['gas'] = gyard('gas', -2379, -8513, 55, 40, 4, coast=False, bite=0.22)
        _Y['bayside'] = gyard('bayside', *pull_inland(-1520, -8398, 45.0), 52, 34, seed=5)
    return _Y


class _YardMap(object):
    def __getitem__(self, k):
        return yards()[k]


YARD = _YardMap()


# ---- the ground the town needs cut --------------------------------------------
# Every flatten is absolute, its level read off the DEM under its own middle.
def flat(fid, cx, cz, a, b, falloff=16, drop=0.0):
    return {'id': fid, 'kind': 'flatten', 'poly': grect(cx, cz, a, b),
            'level': R(dem(cx, cz) + drop, 2), 'falloff': falloff, 'abs': True, 'order': 0}


def flat_at(fid, poly, cx, cz, falloff=16, drop=0.0):
    """A flatten on a GIVEN polygon (a yard's own outline), its level read off the
    DEM under the point it was centred on."""
    return {'id': fid, 'kind': 'flatten', 'poly': [pt(*q) for q in poly],
            'level': R(dem(cx, cz) + drop, 2), 'falloff': falloff, 'abs': True, 'order': 0}


# The moles, read off the registered close view of the harbour at 0.45 m/px.
# (id, polyline, crest half width, crest height over the water)
BREAKWATERS = [
    # the outer hook: its head carries the entrance light
    ('mk_bw_outer', [(-4004, -8912), (-4048, -8864), (-4070, -8837), (-4086, -8801),
                     (-4086, -8760), (-4070, -8719), (-4030, -8682)], 9.0, 4.0),
    # the north-east L, and the entrance between the two
    ('mk_bw_ne', [(-3989, -8814), (-3920, -8868), (-3866, -8910), (-3825, -8873),
                  (-3793, -8837), (-3761, -8792), (-3725, -8714)], 8.0, 3.8),
    ('mk_bw_small', [(-3010, -8902), (-2968, -8944), (-2934, -8976)], 7.0, 3.6),
    ('mk_bw_bayside', [(-1700, -8500), (-1650, -8466), (-1604, -8448)], 7.0, 3.4),
]


def breakwater_poly(pts, half):
    """A mound along a line, as one simple polygon: the line offset both ways."""
    left, right = [], []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz) or 1.0
        nx, nz = -dz / L, dx / L
        left.append(pt(p[0] + nx * half, p[1] + nz * half))
        right.append(pt(p[0] - nx * half, p[1] - nz * half))
    return left + right[::-1]


def terrain():
    out = []
    # the mounds first: a breakwater is ground, raised out of the sea floor
    for bid, pts, half, h in BREAKWATERS:
        out.append({'id': bid, 'kind': 'flatten', 'poly': breakwater_poly(pts, half),
                    'level': R(h, 2), 'falloff': R(half * 2.2, 1), 'abs': True, 'order': 0})
    out += [
        # NOT the ball park, nor either school yard: a catalogue entry that says
        # ground.need 'flatten' cuts its OWN (SPORT_GEN and HOUSE_GEN both do), and
        # an authored one beside it is a second flatten at a different level over
        # the same ground - which the validator refuses (27_premises.js ~:1343).
        # THE FLATTEN TAKES THE YARD'S OWN OUTLINE, not a rectangle over it: the
        # surface, the pavement and the level are one shape or the paving runs off
        # its own ground at the corners the yard lost to the sea.
        flat_at('mk_f_harbour_apron', YARD['harbour'], -3840, -8680, 14),
        # the cannery's yard on the point - kept OFF the water, because a flatten
        # that reached out there raised the ground under its own wharf
        flat_at('mk_f_cannery', YARD['cannery'], -3168, -9002, 16),
        flat_at('mk_f_gas', YARD['gas'], -2379, -8513, 14),
        # ON LAND: at its first position the level came off a cell the DEM clamps to 0
        # over the sea, and the flatten laid a sand-coloured table on the water
        flat_at('mk_f_bayside', YARD['bayside'], *pull_inland(-1520, -8398, 45.0), falloff=16),
        flat('mk_f_ferry_apron', -3520, -9060, 60, 35, 14),
    ]
    return out


def surface():
    S_PAVED, S_GRAVEL = 5, 6
    out = [
        {'id': 'mk_y_harbour', 'poly': YARD['harbour'], 'surface': S_PAVED, 'z': 0},
        {'id': 'mk_y_cannery', 'poly': YARD['cannery'], 'surface': S_PAVED, 'z': 0},
        {'id': 'mk_y_ferry', 'poly': YARD['ferry'], 'surface': S_GRAVEL, 'z': 0},
        {'id': 'mk_y_gas', 'poly': YARD['gas'], 'surface': S_GRAVEL, 'z': 0},
        {'id': 'mk_y_bayside', 'poly': YARD['bayside'], 'surface': S_GRAVEL, 'z': 0},
    ]
    for bid, pts, half, h in BREAKWATERS:
        out.append({'id': bid.replace('mk_bw', 'mk_y_bw'), 'poly': breakwater_poly(pts, half),
                    'surface': 1, 'z': 1})          # SURFACE.ROCK: armour stone underfoot
    return out


def material():
    """Paved polygons only (`look`), never a `set`: the four-slot material map is
    painted over the union of the SET polygons, and Metlakatla is 9 km from the
    field - one map over both would give every yard three texels
    (render_premises.js ~:124). pavement.js draws a `look` polygon as geometry."""
    return [
        {'id': 'mk_m_harbour', 'poly': YARD['harbour'], 'look': 'worn', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
        {'id': 'mk_m_cannery', 'poly': YARD['cannery'], 'look': 'worn', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
        {'id': 'mk_m_ferry', 'poly': YARD['ferry'], 'look': 'gravel', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
        {'id': 'mk_m_gas', 'poly': YARD['gas'], 'look': 'gravel', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
        {'id': 'mk_m_bayside', 'poly': YARD['bayside'], 'look': 'gravel', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
    ]


SKATERS_LAKE = [(-3200, -8400), (-3120, -8420), (-3010, -8405), (-2930, -8340), (-2900, -8250),
                (-2930, -8160), (-3010, -8105), (-3110, -8120), (-3180, -8200), (-3205, -8300)]


def exclude():
    return [
        {'id': 'mk_x_lake', 'poly': [pt(*p) for p in SKATERS_LAKE], 'what': ['trees', 'plots', 'settle']},
        {'id': 'mk_x_ballpark', 'poly': grect(-3324, -8682, 70, 60), 'what': ['trees', 'plots']},
        {'id': 'mk_x_quarry', 'poly': grect(-2660, -7740, 90, 70), 'what': ['trees', 'plots']},
    ]


# ---- the lusher vegetation, as a terrain type of its own ----------------------
# The layer is `ttype`, not `cover`: `coverAt` on the overlay already means what the
# COVER RING may plant at a point, and two unrelated things may not share a word.
# The user: "you will notice some more lush vegetation ... identify this as a new
# terrain type and give them the border biome for now ... that's where we have to
# use the border biome exactly", pointing at the bright green that borders Walden
# Point Road and fills the old cuts beside it. The `ttype` layer stamps terrain
# type 15 (`lush`) into the island's ttype grid at composition; 15 maps to the
# `borders` mix - deciduous shrubs, holly, raspberry, a birch here and there -
# which had been left orphaned when codes 7 and 14 were re-pointed on 2026-09-21.
LUSH_CUTS = [
    [(-2600, -8480), (-2380, -8420), (-2300, -8300), (-2480, -8250), (-2620, -8340)],
    [(-2150, -8380), (-1960, -8330), (-1900, -8220), (-2080, -8190), (-2180, -8280)],
    [(-1820, -8320), (-1620, -8270), (-1560, -8160), (-1740, -8130), (-1850, -8230)],
    [(-3080, -8620), (-2960, -8600), (-2900, -8500), (-3010, -8480), (-3090, -8540)],
]


def road_belt(pts, half):
    """A belt either side of a traced road - the corridor the alder takes."""
    return road_belt_raw(pts, half)


def ttype_stamps():
    # THE VERGE IS A VERGE. It was a 110 m wide band down Walden Point Road, which
    # is not what the picture shows and not what it plants: `borders` sows EIGHTY
    # trees where `conifer_young` sows five thousand, so a corridor that wide reads
    # as a bald scar through the wood rather than a lush edge to it. 26 m a side is
    # the road cut and its green shoulder. `from` keeps it off the bog, the rock and
    # the beach - a lusher border grows where the wood was cut, nowhere else.
    LUSH_FROM = [7, 8, 10, 14]
    out = [{'id': 'mk_tt_walden', 'poly': road_belt(WALDEN_PNT_RD, 26.0), 'code': 15, 'from': LUSH_FROM},
           {'id': 'mk_tt_airport', 'poly': road_belt(AIRPORT_RD, 22.0), 'code': 15, 'from': LUSH_FROM},
           {'id': 'mk_tt_skaters', 'poly': road_belt(SKATERS_LAKE_RD, 20.0), 'code': 15, 'from': LUSH_FROM}]
    for i, poly in enumerate(LUSH_CUTS):
        out.append({'id': 'mk_tt_cut%d' % i, 'poly': [pt(*p) for p in poly], 'code': 15, 'from': LUSH_FROM})
    # A MOLE IS ROCK. The terrain layer raises it out of the sea, but its cells
    # still carry ttype 0 and the ground would be drawn as water four metres up
    # in the air. Code 6 is `rock`, the island's own.
    for bid, pts, half, h in BREAKWATERS:
        out.append({'id': bid.replace('mk_bw', 'mk_tt_bw'), 'poly': breakwater_poly(pts, half + 2), 'code': 6})
    out += wood_stamps()
    # THE `city trees` PAINT IS OFF (2026-09-23, the user: "Here we have long trees on
    # stick that look like nothing and cost a lot. Let's change that and get rid of
    # them"). THE PACK HAS NO SMALL CONIFER: every conifer in it is a full-size model
    # (cedar, fir, larch, spruce, two pines, the fir pack), and `canopyFloor` makes a
    # short tree by SCALING a twenty-metre one - so a 7.5 m city tree is a long thin
    # trunk with a small crown, which is the stick. And it is not cheap: painting 49 ha
    # of the town at this density left the island's fill with 71 771 chunks queued
    # after 92 seconds, still climbing.
    # The PLUMBING stays - terrain type 16, the `city_trees` mix, and contract v1.23's
    # cover stamp, which is the piece that lets a painted biome plant over a town at
    # all. What it needs is an ASSET: a genuinely small conifer, or a scale law that
    # keeps a crown's proportions. That is the vegetation/perf sessions' ground.
    #   out += resveg_stamps()
    #   out += wood_stamps_drawn()
    return out


# ---- the residential vegetation ------------------------------------------------
# The user, over a shot of the town with green scribbles on the gaps: "fill the
# empty patches and in-between land with a new biome, small and medium conifers
# from the forest pack, high density, occasional bushes. We'll call this
# residential vegetation."
#
# NOT A PREMISES `forest` ZONE, and the reason is a number: at the density asked
# for, the gaps inside Metlakatla are 40-odd hectares, which planForest would put
# some twenty thousand INDIVIDUAL trees into the record - and render_premises
# builds one THREE.LOD per record tree. The island's own fill draws that density
# instanced and chunked for nothing, and it is driven by the TERRAIN TYPE. So the
# new thing is a biome (code 16, `residential`, tools/_trees_tuning.json), and the
# premises' job is only to say WHERE.
#
# THE SCRIBBLE IS NOT THE DEFINITION. The green marks sit in the western and
# southern quarters, where the gaps are biggest, but what they point AT is a rule
# that holds everywhere in the town: the ground the plots do not use. So the stamp
# is the town's own zone polygons with `clear: True` - every 10 m cell that carries
# no plot, no road, no site foot and no paving - which is that rule exactly, and
# which no hand-traced polygon could follow round three hundred and fifty plots.
RESVEG_ZONES = ('mk_z_core', 'mk_z_res_n', 'mk_z_res_e', 'mk_z_res_c', 'mk_z_res_w',
                'mk_z_res_s', 'mk_z_res_sub', 'mk_z_town')
# What it may replace: the scrub and the young wood it grows out of, the stale
# `built` classification over the whole town, and the lush verge. Never the bog,
# the heath, the rock, the beach or the water.
RESVEG_FROM = [7, 8, 10, 15]
# ESA WorldCover's GRASSLAND. `world.surface` maps BUILT and CROP to PAVED and the
# island's tree fill refuses PAVED, so every painted biome over a town needs this or
# it plants nothing whatever the terrain type says (contract v1.23).
WC_GRASS = 30


def resveg_stamps():
    out = []
    for z in zones():
        if z['id'] not in RESVEG_ZONES:
            continue
        out.append({'id': 'mk_tt_rv_' + z['id'][5:], 'poly': z['poly'], 'code': 16,
                    'from': RESVEG_FROM, 'clear': True, 'cover': WC_GRASS})
    return out


# ---- the seaplane base --------------------------------------------------------
# Metlakatla's own is a float off the north point; the lane runs north-west of the
# town, parallel to the shore, where the channel is open. `surface: 4` makes it a
# SEA LANE: nothing graded, nothing painted, and the seaplanes spawn on it.
SEA_C = (-3980, -9420)
SEA_HDG = math.atan2(UAX[1], UAX[0])       # along the shore, grid bearing 43 deg
SEA_LEN, SEA_WID = 1500.0, 200.0


def runways():
    return [{'id': 'mk_sea', 'name': 'Metlakatla Seaplane Base', 'c': pt(*SEA_C), 'hdg': R(SEA_HDG, 4),
             'len': SEA_LEN, 'wid': SEA_WID, 'surface': 4, 'look': 'none', 'crossfall': 0,
             'disp': [0, 0], 'papi': [False, False], 'falloff': None, 'site': None,
             'pattern': None, 'profile': None, 'approach': None}]


def objects():
    """Poles down the paved avenues, and the town's own aeroplane on the float."""
    out = []
    n = 0
    for rid, name, pts, w, cls, look, grade, traffic in TRACED:
        if traffic < 1:
            continue
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            steps = max(1, int(L / 70))
            for k in range(steps):
                u = (k + 0.5) / steps
                x, z = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
                dx, dz = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                off = w / 2 + 2.5
                n += 1
                out.append({'id': 'mk_o_pole%d' % n, 'kind': 'prop',
                            'key': ['pole_a', 'pole_b', 'pole_c'][n % 3],
                            'x': R(x - dz * off), 'z': R(z + dx * off),
                            'yaw': R(math.atan2(dx, dz), 3), 'dy': 0, 'on': 'ground'})
    return out


# ---- what jolene_author.py splices in -----------------------------------------
def layers():
    return {'terrain': terrain(), 'surface': surface(), 'material': material(),
            'exclude': exclude(), 'roads': roads(), 'runways': runways(),
            'zones': zones(), 'sites': sites() + marine_sites(), 'links': [],
            'objects': objects(), 'ttype': ttype_stamps()}


def extent():
    """The town's own box, for the record's union."""
    xs, zs = [], []
    for L in layers().values():
        for e in L:
            for p in (e.get('poly') or e.get('pts') or []):
                xs.append(p[0])
                zs.append(p[1])
            if e.get('c'):
                xs += [e['c'][0] - e['len'] / 2, e['c'][0] + e['len'] / 2]
                zs += [e['c'][1] - e['len'] / 2, e['c'][1] + e['len'] / 2]
            if e.get('at'):
                xs.append(e['at']['x'])
                zs.append(e['at']['z'])
            if e.get('x') is not None and not e.get('poly'):
                xs.append(e['x'])
                zs.append(e['z'])
    return {'x0': math.floor(min(xs) - 120), 'z0': math.floor(min(zs) - 120),
            'x1': math.ceil(max(xs) + 120), 'z1': math.ceil(max(zs) + 120)}


def report():
    L = layers()
    print('METLAKATLA')
    for k, v in L.items():
        print('  %-9s %3d' % (k, len(v)))
    print('  extent   ', extent())
    bad = []
    for r in L['roads']:
        for i in range(len(r['pts'])):
            p = r['pts'][i]
            if coast_m(p[0], p[1]) < 0:
                bad.append((r['id'], p, round(coast_m(*p), 1)))
            if i + 1 < len(r['pts']):
                a, b = p, r['pts'][i + 1]
                n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 15))
                for k in range(1, n):
                    q = (a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)
                    if coast_m(*q) < -3.0:
                        bad.append((r['id'] + ' (mid)', [round(q[0], 1), round(q[1], 1)], round(coast_m(*q), 1)))
                        break
    print('  streets dropped:', len(DROPPED))
    for b in DROPPED:
        print('     ', b[0], '-', b[1])
    print('  road points off the land mask:', len(bad))
    for b in bad[:12]:
        print('     ', b)
    dry = [s['id'] for s in L['sites'] if not is_land(s['at']['x'], s['at']['z'])]
    print('  sites off the land mask:', dry)
    for r in L['runways']:
        print('  %s at %s, water under the ends:' % (r['id'], r['c']),
              [is_land(r['c'][0] + math.cos(r['hdg']) * s * r['len'] / 2,
                       r['c'][1] + math.sin(r['hdg']) * s * r['len'] / 2) for s in (-1, 1)])


if __name__ == '__main__':
    if '--json' in sys.argv:
        print(json.dumps(layers(), indent=1))
    else:
        report()


# ---- the harbour: what MARINE_GEN stands in the water -------------------------
# A marine item is NEVER pulled ashore - it is meant to be over the water - and it
# cuts no ground (`ground.need` is 'none'), so its piles reach the real seabed.
def axis(dx, dz):
    """A site yaw whose single item runs its +x along (dx, dz). An item's world
    yaw is at.yaw + pi, and a yaw Y sends the model's +x to (cos Y, -sin Y)."""
    return R(math.atan2(-dz, dx) - math.pi, 4)


def to_water(x, z, want=-14.0, step=9.0, tries=30):
    """Walk out until the point is `want` metres SEAWARD of the island's own
    waterline. The test is the coast field, not the DEM: the DTM is clamped at 0
    over the sea (there is no bathymetry in it - the seabed is synthesised by
    28_island.js seaFloor), so `dem <= -1` is never true anywhere and a float
    slid until it gave up. A float or a wharf traced at its true position starts
    on dry DEM for the same reason a shore street does: the 10 m grid's coastline
    sits some 30 m inland of the real one here."""
    for _ in range(tries):
        if coast_m(x, z) <= want:
            return x, z
        best, bx, bz = coast_m(x, z), x, z
        for k in range(16):
            a = math.pi * 2 * k / 16
            nx, nz = x + math.cos(a) * step, z + math.sin(a) * step
            c = coast_m(nx, nz)
            if c < best:
                best, bx, bz = c, nx, nz
        if (bx, bz) == (x, z):
            return x, z
        x, z = bx, bz
    return x, z


def seaward(x, z, r=40.0):
    """Which way the land ends here - the direction a pier has to run."""
    best, bc = None, 1e9
    for k in range(32):
        a = math.pi * 2 * k / 32
        c = coast_m(x + math.cos(a) * r, z + math.sin(a) * r)
        if c < bc:
            bc, best = c, (math.cos(a), math.sin(a))
    return best or (0.0, -1.0)


def wet_span(c, dirv, L, want=-6.0):
    """Slide a thing that floats until BOTH its ends are over water."""
    x, z = c
    for _ in range(26):
        a = (x - dirv[0] * L / 2, z - dirv[1] * L / 2)
        b = (x + dirv[0] * L / 2, z + dirv[1] * L / 2)
        if coast_m(*a) <= want and coast_m(*b) <= want:
            return x, z
        nx, nz = to_water(x, z, coast_m(x, z) - 8.0, 7.0, 1)
        if (nx, nz) == (x, z):
            break
        x, z = nx, nz
    return x, z


def along(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def pier(pid, name, preset, root, tip, P=None):
    """A pier is authored by its ROOT (at the beach) and its TIP (out in the
    water); the item's own frame wants the centre and the axis."""
    dx, dz = tip[0] - root[0], tip[1] - root[1]
    L = math.hypot(dx, dz)
    # A PIER STARTS AT THE BEACH THE GAME DRAWS. Traced at its true root it began
    # eight metres up the shore, because the 10 m DEM's waterline sits that far
    # inland of the real one - and the trestle then hung its deck below the ground
    # it grew out of, because the composer measures the water at the ITEM. The root
    # walks to the island's own waterline; the tip walks out until there is water.
    ux, uz = dx / L, dz / L
    root = to_waterline(root[0], root[1])
    tip = (root[0] + ux * L, root[1] + uz * L)
    while coast_m(*tip) > -8.0 and L < 260:
        L += 8.0
        tip = (root[0] + ux * L, root[1] + uz * L)
    dx, dz = tip[0] - root[0], tip[1] - root[1]
    return {'id': pid, 'name': name,
            'at': {'x': R((root[0] + tip[0]) / 2), 'z': R((root[1] + tip[1]) / 2), 'yaw': axis(dx / L, dz / L)},
            'yard': None, 'fences': [],
            'items': [{'id': pid + '_1', 'key': preset, 'x': 0, 'z': 0, 'yaw': 0,
                       'P': dict({'L': R(L, 1)}, **(P or {})), 'onRoad': False, 'bottomOnRoad': False}]}


def spot(sid, name, preset, c, dirv, P=None, wet=0.0, on_road=False):
    """`on_road`: this thing is ALLOWED to meet a road. The composer names any
    item standing on a road an authoring mistake, and it is right about a church;
    it is wrong about a rubble mound whose landward section carries Breakwater
    Road along its crest, which is what a breakwater IS."""
    if wet:
        c = wet_span(c, dirv, wet)
    return {'id': sid, 'name': name,
            'at': {'x': R(c[0]), 'z': R(c[1]), 'yaw': axis(dirv[0], dirv[1])},
            'yard': None, 'fences': [],
            'items': [{'id': sid + '_1', 'key': preset, 'x': 0, 'z': 0, 'yaw': 0,
                       'P': dict(P or {}), 'onRoad': False, 'bottomOnRoad': bool(on_road)}]}


def marine_sites():
    out = []
    # THE NORTH POINT: the freight pier and, beside it, the trestle out to the
    # seaplane float - Metlakatla's own base, and the reason the SEA lane is here.
    out.append(pier('mk_mp_west', 'Metlakatla dock', 'marine/trestle pier, long',
                    (-3525, -9055), (-3571, -9110), {'w': 3.6, 'head': 1, 'headL': 20, 'headW': 13, 'deck': 3.4}))
    out.append(pier('mk_mp_air', 'Seaplane base trestle', 'marine/trestle pier',
                    (-3404, -9033), (-3356, -9106), {'w': 2.6, 'head': 0, 'deck': 2.6, 'lampSpc': 22}))
    out.append(spot('mk_mf_air', 'Metlakatla seaplane float', 'marine/seaplane float',
                    (-3351, -9114), UAX, {'gangway': 0, 'fingers': 2, 'fingerL': 13, 'floatL': 26}, wet=26))
    # THE BOAT HARBOUR: two rafts of finger floats behind the moles, the gangway
    # down from the apron on the shore side
    out.append(spot('mk_mf_harb_a', 'Metlakatla Boat Harbor floats', 'marine/boat harbour floats',
                    (-3905, -8790), VAX, {'floatL': 110, 'fingers': 12, 'fingerL': 13, 'pitch': 8.5, 'gangL': 18}, wet=110))
    out.append(spot('mk_mf_harb_b', 'Metlakatla Boat Harbor floats, inner', 'marine/boat harbour floats',
                    (-3878, -8776), VAX, {'floatL': 80, 'fingers': 9, 'fingerL': 12, 'pitch': 8.5, 'gangway': 0}, wet=80))
    # THE CANNERY: Annette Island Packing and the Maintenance Department stand on a
    # pile deck over the tide - the thing BIG_GEN cannot do (it has no stance).
    cw = seaward(-3124, -9042, 60)
    # THE MAINTENANCE DEPARTMENT AND THE PACKING PLANT STAND ON THE DECK. The user,
    # of the real thing: "a pack of warehouses on a floating structure". They are
    # BIG_GEN buildings, and BIG_GEN is the one generator that honours a `floorY`
    # handed in (27_premises.js placeItem keeps `Math.max(0.3, P.floorY)` for it),
    # which is how a shed gets to stand on a wharf instead of on the seabed.
    DECK = 3.4
    wharf = spot('mk_mw_cannery', 'Annette Island Packing', 'marine/wharf deck',
                 (-3124 + cw[0] * 46, -9042 + cw[1] * 46), (-cw[1], cw[0]),
                 {'L': 62, 'w': 30, 'deck': DECK, 'pilesPerBent': 8, 'rail': 0}, wet=62)
    for i, (key, lx, lz, P) in enumerate([
            ('big/cannery', -6, 1, {'L': 30, 'w': 14, 'eaveH': 6.2, 'signText': 'ANNETTE ISLAND PACKING'}),
            ('big/warehouse', 20, -6, {'L': 20, 'w': 11, 'eaveH': 5.0, 'dock': 0}),
            ('big/warehouse', 20, 7, {'L': 18, 'w': 10, 'eaveH': 4.6, 'dock': 0}),
            ('big/boat shed', -22, -5, {'L': 15, 'w': 9})]):
        wharf['items'].append({'id': 'mk_mw_cannery_b%d' % i, 'key': key, 'x': lx, 'z': lz, 'yaw': 0,
                               'P': dict({'floorOverWater': DECK + 0.22, 'plinth': 0, 'yard': 0}, **P),
                               'onRoad': False, 'bottomOnRoad': False})
    out.append(wharf)
    # the small harbour under Breakwater Road, by Alaska Power & Telephone
    out.append(spot('mk_mw_small', 'Metlakatla small boat dock', 'marine/wharf deck, small',
                    (-2946, -8902), VAX, {'L': 30, 'w': 14, 'deck': 3.0}, wet=30))
    out.append(spot('mk_mf_small', 'Small boat harbour floats', 'marine/boat harbour floats',
                    (-2995, -8862), VAX, {'floatL': 56, 'fingers': 6, 'fingerL': 9, 'pitch': 8, 'gangL': 12}, wet=56))
    # BAYSIDE, at the end of Walden Point Road: the dock, and the fish farm
    bd = seaward(-1540, -8398)
    out.append(pier('mk_mp_bayside', 'Bayside dock', 'marine/trestle pier',
                    (-1540, -8398), (-1540 + bd[0] * 55, -8398 + bd[1] * 55),
                    {'w': 3.2, 'head': 1, 'headL': 14, 'headW': 8}))
    out.append(spot('mk_mn_bayside', 'Bayside net pens', 'marine/net pens',
                    (-1392, -8360), VAX, {'rows': 2, 'cols': 4, 'pen': 13, 'netD': 10}, wet=54))
    # the armour on each mole: one straight run per segment, riding 0.3 m proud of
    # the mound the terrain layer raised, so the rubble reads as rubble
    for bid, pts, half, h in BREAKWATERS:
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            dx, dz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dz)
            if L < 12:
                continue
            last = (i == len(pts) - 2)
            out.append(spot(bid.replace('mk_bw', 'mk_ma') + '_%d' % i,
                            'breakwater armour', 'marine/breakwater' + (', light' if (last and bid == 'mk_bw_outer') else ''),
                            along(a, b, 0.5), (dx / L, dz / L),
                            {'L': R(L + 6, 1), 'crest': R(half * 2 - 1.2, 1), 'crestH': R(h + 0.3, 2),
                             'slope': 1.5, 'stones': 1, 'beacon': 1 if (i == 0 and bid == 'mk_bw_outer') else 0},
                            on_road=True))
    return out
