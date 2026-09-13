#!/usr/bin/env python3
"""cabin_prep.py — bake the declared TRAM CABIN (tools/cabin_table.py) and the
two LIVERIES it wears (G343).

Usage:  python tools/cabin_prep.py            (bake the pack and the liveries)
        python tools/cabin_prep.py --report   (inventory only, writes nothing)

tools/prop_prep.py's runner pointed at a fourth table: the pack lands in
src/cabin/ (cabin_cabin.js + cabin_packs.json), the geometry under
media/geo/cabin/. The file ships no map, so the baker's texture bank is
empty and media/tex/cabin/ holds only the liveries.

THE LIVERIES (the user's two banners, assets/cabin/livery_*.png, 2172 x 724):
resized to 1024 wide, encoded once, named by hash, and published by the slim
manifest src/viewer/cabin_livery.js (pre-loading <img> refs like
sign_tex.js). cabin.js projects one on each flank of the body, clipped to
the banner's rectangle, mirrored on the far side so the words read from
either side.
"""
import hashlib, importlib.util, io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import prop_prep                                     # noqa: E402

_spec = importlib.util.spec_from_file_location('cabin_table', os.path.join(HERE, 'cabin_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)

CFG = dict(
    table=TABLE,
    src_dir=os.path.join(ROOT, 'assets', 'cabin'),
    out_dir=os.path.join(ROOT, 'src', 'cabin'),
    geo='geo/cabin', tex='tex/cabin', prefix='cabin_', packs='cabin_packs.json',
    origin='assets/cabin/, per the declared table in tools/cabin_table.py',
)

LIVERIES = [('admiralty', 'livery_admiralty.png'), ('chatham', 'livery_chatham.png')]
LIVERY_W = 1024


def bake_liveries(report):
    from PIL import Image
    out = {}
    for key, fn in LIVERIES:
        p = os.path.join(CFG['src_dir'], fn)
        im = Image.open(p).convert('RGB')
        w, h = im.size
        hh = int(round(h * LIVERY_W / w))
        im = im.resize((LIVERY_W, hh), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=90, optimize=True)
        raw = buf.getvalue()
        rel = prop_prep.write_media(CFG['tex'], 'livery_' + key, 'jpg', raw) if not report else '(report)'
        out[key] = (rel, LIVERY_W, hh, w / float(h))
        print('livery %-10s %s  %dx%d -> %dx%d  %.1f KB' % (key, fn, w, h, LIVERY_W, hh, len(raw) / 1024))
    if report:
        return
    mf = os.path.join(ROOT, 'src', 'viewer', 'cabin_livery.js')
    lines = ['// GENERATED FILE - DO NOT EDIT. Built by tools/cabin_prep.py from',
             '// assets/cabin/livery_*.png (the user\'s banners). The files live under',
             '// media/tex/cabin/ (hash-in-filename); loading starts at script eval and',
             '// cabin.js waits on img.complete/onload.',
             '//',
             '// THE LIVERIES OF THE TRAM CABIN (G343): one on each flank of the body,',
             '// clipped to the banner\'s rectangle, mirrored on the far side. `aspect` is',
             '// the banner\'s width over its height, which sizes the rectangle it fills.',
             "const CABIN_LIVERY = (typeof Image !== 'undefined') ? (() => {",
             "  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';",
             "  const mk = src => { const i = new Image(); i.src = B + src; return i; };",
             '  return {']
    for key, (rel, w, hh, asp) in out.items():
        lines.append("    %s: { img: mk('%s'), w: %d, h: %d, aspect: %.4f }," % (key, rel, w, hh, asp))
    lines += ['  };', '})() : null;', '']
    open(mf, 'w', encoding='utf8', newline='\n').write('\n'.join(lines))
    # the manifest names the liveries; anything else in media/tex/cabin/ is stale
    gone = prop_prep.prune_media(CFG['tex'], [v[0] for v in out.values()])
    if gone:
        print('pruned %d stale map(s) from media/%s/' % (len(gone), CFG['tex']))
    print('src/viewer/cabin_livery.js: %d liveries' % len(out))


if __name__ == '__main__':
    argv = sys.argv[1:]
    report = '--report' in argv
    prop_prep.main(argv, CFG)
    bake_liveries(report)
