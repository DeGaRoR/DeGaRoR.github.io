# flyDiy livery stickers: the twelve Alaska marks

One colour, no text, cut from vinyl. The user approved all twelve on 9 Nov 2026 (v3); LIVERY-STICKERS made them
cutter-ready, polished four of them, and put them in the game.

## The pipeline

    node make_v3.js          marks_a/b/c.js (+ core_v3.js, lib_v3.js) -> mask/NN_id.svg (luminance masks: white adds ink,
                             black cuts it, in paint order, with clip paths, transforms and stroked halos)
    python3 flatten.py       mask/ -> svg/NN_id.svg + cut.json: THE CUTTER-READY ART, one filled path per mark
                             (fill-rule evenodd), no strokes, no masks, no clips; holes are real holes, the halos'
                             separation gaps are geometry, overlaps are unioned (pip install shapely svgelements)
    node diff.js             old vs new, pixel for pixel (Chromium, 1200 px across): prints what moved
    node ../../tools/livery_marks_prep.js   cut.json -> src/viewer/livery_marks.js (the game's copy)

`alaska_ne.py` makes `alaska_ne.json` (mark 12's outline) from Natural Earth 1:50m admin-1 (public domain); its
header has the download line.

## The flatten, measured (9 Nov)

`node diff.js mask svg 1200`: the worst mark moved 22 pixels of 1.9 M (0.001 %, a pixel "moves" when its coverage
changes by more than half), ink within 0.12 %: the anti-aliasing of the polygonised circles. The look is identical.

## The polish (9 Nov, the user's notes), everything else byte-identical

- 02 grizzly: "the head is too long and light, the mass doesn't read as a bear" -> the shoulder hump is the highest
  thing on the back, the head below it, short and deep (dished face, blunt muzzle, heavy jaw, ruff).
- 08 true north: "the head-on plane is crowded" -> `headOn(.., { simple: true })`: no fin, struts, prop blades or
  windscreen; a thicker wing, fatter tyres; drawn 15 % bigger with the peaks lower.
- 09 moose: "the antlers read as a crown when small" -> one broad blade with four short points and a brow palm.
- 12 alaska: "drawn from memory" -> Natural Earth on the Alaska Albers conic, the panhandle's islands closed in, the
  fjords taken off; the Aleutian swooshes laid along the real islands.

`node before_after.js out.png` draws the four before (the approved masks, flattened) and after, big and at sticker size.
