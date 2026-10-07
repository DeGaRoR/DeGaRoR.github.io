#!/usr/bin/env python3
"""polyhaven_fetch.py — download a Poly Haven MODEL as delivered (G2405).

Usage:  python tools/polyhaven_fetch.py <dest> <asset_id> [asset_id ...] [--res 1k]
  e.g.  python tools/polyhaven_fetch.py assets/loads medical_box cement_bag

Writes  <dest>/<asset_id>/<asset_id>_<res>.gltf + the .bin + textures/*.jpg,
        byte-for-byte as Poly Haven serves them (the props pipeline's
        `assets/props/<slug>/` layout), every file checked against the md5 the
        files API publishes. Nothing is edited: the baker re-encodes.

`<dest>` is resolved under flyDiy/ unless absolute. The sources are gitignored;
from a worktree pass the MAIN checkout's folder (media_lib.asset_src reads it)
— never a junction ([[worktree-junction-wipe]]).

Poly Haven is CC0: no credit is owed, the table's SOURCES row records it anyway.
"""
import hashlib, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {'User-Agent': 'flyDiy-asset-prep (polyhaven_fetch.py)'}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def fetch(dest, aid, res):
    files = json.loads(get('https://api.polyhaven.com/files/%s' % aid))
    g = files['gltf'][res]['gltf']
    out = os.path.join(dest, aid)
    todo = [(os.path.basename(g['url']), g)] + list(g['include'].items())
    n = 0
    for rel, f in todo:
        p = os.path.join(out, *rel.split('/'))
        if os.path.exists(p) and hashlib.md5(open(p, 'rb').read()).hexdigest() == f['md5']:
            continue
        raw = get(f['url'])
        if hashlib.md5(raw).hexdigest() != f['md5']:
            raise SystemExit('%s: md5 mismatch on %s' % (aid, rel))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(raw)
        n += 1
    print('%-30s %d file(s) written, %d checked  -> %s' % (aid, n, len(todo), out))


if __name__ == '__main__':
    args = sys.argv[1:]
    res = '1k'
    if '--res' in args:
        i = args.index('--res')
        res = args[i + 1]
        del args[i:i + 2]
    if len(args) < 2:
        raise SystemExit(__doc__)
    dest = args[0] if os.path.isabs(args[0]) else os.path.join(ROOT, args[0])
    for aid in args[1:]:
        fetch(dest, aid, res)
