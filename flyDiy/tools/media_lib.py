"""media_lib.py — the Python half of tools/_media_lib.js: the ONE way a baker
writes an external media file. Same rules as the JS half, one addition:

  BYTE-EXACT    the bytes written are the bytes the baker encoded — this
                helper never re-encodes.
  SELF-BUSTING  an 8-hex content hash rides IN THE FILENAME; a changed asset
                is a new URL, an unchanged one a byte-identical file.
  OWNED DIRS    a baker prunes what it owns. Two grains, because two bakers
                share media/geo/models/ (model_prep bakes pa18/c172,
                ref_prep the reference set) and media/geo/props/ has a
                sibling for the same reason (jodel_prep -> geo/airframe/):
                  prune_media(subdir, keep)          — owns the whole dir
                  prune_media_stems(subdir, stems, keep) — owns only files
                    named `<stem>.<h8>.<ext>` for its own stems, and leaves
                    every other baker's files standing (the props_packs.json
                    lesson, G62.11, applied to a directory).

Paths returned are PAGE-RELATIVE ('media/...'), forward slashes. The emitted
payload prefixes them with FLYDIY_ASSET_BASE at its own eval — see BASE_DECL.
"""
import hashlib
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # flyDiy/
MEDIA = os.path.join(ROOT, 'media')

BASE_DECL = ("const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') "
             "? FLYDIY_ASSET_BASE : '';")


def write_media_named(subdir, name, raw):
    """For assets whose NAME already is a content hash (the prop textures'
    sha12 ids) — writing `<stem>.<h8>.<ext>` on top would hash a hash. Same
    idempotent, byte-exact write; the caller owns the self-busting property."""
    rel = 'media/%s/%s' % (subdir, name)
    ap = os.path.join(ROOT, *rel.split('/'))
    os.makedirs(os.path.dirname(ap), exist_ok=True)
    if not os.path.exists(ap):
        with open(ap, 'wb') as f:
            f.write(raw)
    return rel


def write_media(subdir, stem, ext, raw):
    h8 = hashlib.sha256(raw).hexdigest()[:8]
    rel = 'media/%s/%s.%s.%s' % (subdir, stem, h8, ext)
    ap = os.path.join(ROOT, *rel.split('/'))
    os.makedirs(os.path.dirname(ap), exist_ok=True)
    if not os.path.exists(ap):                 # content-addressed: name IS bytes
        with open(ap, 'wb') as f:
            f.write(raw)
    return rel


def _prune(d, keep_names, own):
    if not os.path.isdir(d):
        return []
    gone = []
    for f in sorted(os.listdir(d)):
        p = os.path.join(d, f)
        if os.path.isfile(p) and f not in keep_names and own(f):
            os.remove(p)
            gone.append(f)
    return gone


def prune_media(subdir, keep_rels):
    """Whole-directory ownership: delete everything this bake did not emit."""
    return _prune(os.path.join(MEDIA, *subdir.split('/')),
                  {r.split('/')[-1] for r in keep_rels}, lambda f: True)


def prune_media_stems(subdir, stems, keep_rels, sep='.'):
    """Shared-directory ownership: delete only files named `<stem>.<h8>.<ext>`
    for the given stems — other bakers' files in the same directory stand.
    `sep` is what follows the stem: '.' for a payload's own file, '_' for a
    baker that names its textures `<stem>_<material>_<kind>.<h8>.<ext>`
    (tree_prep) — with the default, such a prune owned nothing (W0c.29)."""
    own = tuple(s + sep for s in stems)
    return _prune(os.path.join(MEDIA, *subdir.split('/')),
                  {r.split('/')[-1] for r in keep_rels},
                  lambda f: f.startswith(own))
