#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""obj_sanitize.py — vertex-cluster decimation for a hand-modelled OBJ.

WHY THIS EXISTS, and why it is a PROPOSAL rather than part of the bake.

The project rule is [[import-models-as-is]]: never decimate a delivered model,
size is a loading-screen problem. That rule is about assets somebody else made,
where fidelity is the whole point of having them. This is for the user's OWN
export, where the question is not "is it faithful" but "did a modifier get left
at the wrong setting", and the answer is measured before anything is touched.

WHAT THE MEASUREMENT SAID about speedJojo_structureFuselage.obj:

    cintre4    7168 faces, 2728 distinct normals
               the two flat faces are 18.8% of faces but 59.0% of the area
               median face = a 1.7 mm square
    couple4   11968 faces, 1264 distinct normals
               flat faces 25.9% of faces, 38.7% of area
               median face = a 1.6 mm square

So four fifths of the triangles in a plywood former are on its RIM — the 1 cm
edge of a flat plate, rounded with enough bevel segments to need 2 728 distinct
face normals. That is not detail anybody will see at two metres in a shed; it
is a bevel modifier left at a high segment count before export.

THE HONEST FIX IS IN BLENDER: drop the bevel segments on the formers and
re-export. The source stays the truth and nothing downstream has to lie about
what it shipped. THIS TOOL is the fallback for when that is not convenient, and
it is deliberately the crudest thing that works, so that what it does is easy
to predict:

  - snap every vertex to a grid, and merge everything that lands in one cell
  - put the merged vertex at the CENTROID of what it merged, not at the grid
    point, so the silhouette moves by less than the cell rather than by a cell
  - drop faces that collapse to a line or a point
  - nothing else. No edge collapse, no normal recomputation, no re-topology.

The silhouette therefore cannot move further than the cell size, which is the
number to argue about and the only one this tool takes.

    python tools/obj_sanitize.py <in.obj> <out.obj> [cell_mm]
"""
import collections
import os
import sys

import numpy as np


def read_obj(path):
    """-> (V, VN, objects) where an object is (name, material, faces) and a
    face is a list of (v, vt, vn) 0-based indices with None for absent."""
    V, VT, VN = [], [], []
    objs, cur, mtl = [], None, None
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('v '):
            p = line.split(); V.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith('vt '):
            p = line.split(); VT.append(tuple(float(x) for x in p[1:3]))
        elif line.startswith('vn '):
            p = line.split(); VN.append(tuple(float(x) for x in p[1:4]))
        elif line.startswith('o '):
            cur = [line[2:].strip(), mtl, []]
            objs.append(cur)
        elif line.startswith('usemtl'):
            mtl = line.split()[1]
            if cur is not None and not cur[2]:
                cur[1] = mtl
        elif line.startswith('f '):
            f = []
            for tok in line.split()[1:]:
                bits = (tok.split('/') + ['', ''])[:3]
                def ix(s, n):
                    if s == '':
                        return None
                    i = int(s)
                    return i - 1 if i > 0 else n + i
                f.append((ix(bits[0], len(V)), ix(bits[1], len(VT)), ix(bits[2], len(VN))))
            if cur is None:
                cur = ['(default)', mtl, []]
                objs.append(cur)
            cur[2].append(f)
    return np.asarray(V, dtype=np.float64), VT, VN, objs


def cluster(V, cell):
    """grid-snap -> (new positions, old->new map). The representative is the
    centroid of the cell's members, so the surface moves by less than a cell."""
    q = np.floor(V / cell).astype(np.int64)
    key = np.ascontiguousarray(q).view(np.dtype((np.void, q.dtype.itemsize * 3)))
    _, inv = np.unique(key, return_inverse=True)
    n = inv.max() + 1
    acc = np.zeros((n, 3)); cnt = np.zeros(n)
    np.add.at(acc, inv, V)
    np.add.at(cnt, inv, 1)
    return acc / cnt[:, None], inv


def sanitize(src, dst, cell_mm=2.5):
    cell = cell_mm / 1000.0
    V, VT, VN, objs = read_obj(src)
    P, remap = cluster(V, cell)
    moved = np.linalg.norm(P[remap] - V, axis=1)

    out_faces, kept, dropped = [], 0, 0
    for name, mtl, faces in objs:
        keep = []
        for f in faces:
            idx = [remap[a] for a, _, _ in f]
            # drop anything that has collapsed to a line or a point
            ded = []
            for i in idx:
                if not ded or ded[-1] != i:
                    ded.append(i)
            if len(ded) > 2 and ded[0] == ded[-1]:
                ded.pop()
            if len(ded) < 3:
                dropped += 1
                continue
            keep.append(ded)
            kept += 1
        if keep:
            out_faces.append((name, mtl, keep))

    used = sorted({i for _, _, ks in out_faces for k in ks for i in k})
    ren = {o: n + 1 for n, o in enumerate(used)}
    with open(dst, 'w') as f:
        f.write('# sanitized by tools/obj_sanitize.py from %s\n'
                '# vertex-cluster decimation, cell %.1f mm; positions are cell\n'
                '# centroids, faces that collapsed were dropped, nothing else\n'
                '# was touched. Normals and uvs are NOT carried: the consumer\n'
                '# recomputes normals, which is what it did with the original.\n'
                % (os.path.basename(src), cell_mm))
        for i in used:
            f.write('v %.6f %.6f %.6f\n' % tuple(P[i]))
        last = None
        for name, mtl, ks in out_faces:
            f.write('o %s\n' % name)
            if mtl and mtl != last:
                f.write('usemtl %s\n' % mtl)
                last = mtl
            for k in ks:
                f.write('f ' + ' '.join(str(ren[i]) for i in k) + '\n')

    print('%s -> %s' % (os.path.basename(src), os.path.basename(dst)))
    print('  verts  %7d -> %7d   (%.1fx)' % (len(V), len(used), len(V) / max(1, len(used))))
    print('  faces  %7d -> %7d   (%.1fx), %d collapsed and dropped'
          % (sum(len(o[2]) for o in objs), kept,
             sum(len(o[2]) for o in objs) / max(1, kept), dropped))
    print('  objects %6d -> %7d' % (len(objs), len(out_faces)))
    print('  a vertex moved at most %.2f mm, median %.2f mm  (cell %.1f mm)'
          % (1000 * moved.max(), 1000 * np.median(moved), cell_mm))
    print('  file   %7.2f MB -> %7.2f MB'
          % (os.path.getsize(src) / 1048576, os.path.getsize(dst) / 1048576))


if __name__ == '__main__':
    sanitize(sys.argv[1], sys.argv[2],
             float(sys.argv[3]) if len(sys.argv) > 3 else 2.5)
