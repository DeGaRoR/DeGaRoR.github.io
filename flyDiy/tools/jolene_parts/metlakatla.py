"""METLAKATLA — Annette Island's one real town, as a jolene_parts part.

The town itself is `tools/metlakatla_author.py`, which is 1500 lines because almost
none of it is coordinates: it reads the island's own rasters, walks every street
ashore off the coast field, cuts the zone hulls, clips the roads against the ball
field and the lakes, snaps their ends together, drops the doubles and the slivers,
and reads back the lines the user drew on a trace and on two game screenshots. This
file is only the part protocol's handle on it.

Everything it emits is prefixed `mk_`, which GATE PREMISES section 14 already keys
several of its checks off.

ORDER MATTERS IN ONE PLACE and must not be tidied: the `zones` layer is sown in
ARRAY ORDER and `sowPlots` refuses a plot that overlaps one already sown, so the
named quarters claim their frontages, the catch-all `mk_z_town` fills what they
leave, and the `forest` zones come last because `planForest` reads the plots the
sowers have already cut.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import metlakatla_author as MK          # noqa: E402

PREFIX = 'mk_'
PART = MK.layers()
_e = MK.extent()                        # the loader wants [x0, z0, x1, z1]
EXTENT = [_e['x0'], _e['z0'], _e['x1'], _e['z1']]
