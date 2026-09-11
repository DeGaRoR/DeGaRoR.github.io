# DRAWN WINDOWS — the knife test (2026-09-11)

User ask: "passenger windows: I'd like to modulate their shapes; could we
properly inset/cut so I can manipulate width, height, z station, etc? Even
maybe some round windows? Need to be super clean, no shading issues, proper
joint. Do a test first."

This is the test. Nothing in the game or the editor pipeline changed: two new
files, `tools/_knife_gen.js` (the pass) and `tools/_win.html` (the bench,
launch `flydiy-win`).

## What the band windows are, and why they cannot do this

G12.3's windows are MATERIAL ZONES on the cage: the pax window is every face
between the sill rail and the ceil rail across the pax bay. Its shape is the
lattice's — a bay long, a band tall, square. Station, width and height are
not parameters because they are not free: they are the rails. The cage-inset
detour (v1-v3) tried to draw a frame INTO the cage and bought three lessons
(a creased loop is still a smooth curve; crease lines must not cross;
corner-pinned vertices stand proud of the converging surface) before the
user ruled for rim beads on the untouched surface.

## The method: knife-project the DISPLAYED surface

The drawn outline is cut into the SUBDIVIDED mesh — the G14 idiom ("step
through the available geometry, no fighting the subsurf") taken from faces to
a curve. `_knife_gen.js` header carries the full method; the load-bearing
points:

- the outline is CONVEX (rounded rectangle or ellipse) drawn in the side
  view (u, v) = (z, y) and projected along x, one flank per call (mirrored by
  calling both sides). Convex means the per-face cut is an intersection of
  half-planes: exact, and every piece well-formed.
- per face: Sutherland-Hodgman against the outline lines that touch it gives
  the pane's share; the OUTSIDE is walked as a simple polygon (face boundary
  from where the pane leaves it to where it rejoins, then the arc back) and
  ear-clipped. Window-inside-one-face is the annulus, bridged.
- every created point is the intersection of two CARRIERS (an original edge,
  an outline line), keyed by that pair — so the same point made from two
  faces welds bit-for-bit — and points on a shared edge are inserted into
  EVERY polygon on that edge afterwards (no T-junctions, even against a face
  the cut passed over: the far flank, the crown line, a previous cut's
  triangles).
- normals and the surface field are lerped from the split edge's ends. The
  skin keeps its PRE-CUT normals; the pane is pushed in along that same
  normal and carries it. That is the whole answer to "no shading issues":
  the normals view paints pane and skin one colour with the reveal the only
  break, and a grazing light shows no halo along the hole.
- the reveal wall is its own part with its own normals (a crisp step); the
  bead is the cageRims idiom (octagon, centre on the surface) swept along
  the loop the cut recorded.

## Measured

Headless (`node` over `_cage_gen.js` + `_knife_gen.js`) and in the bench,
the WATERTIGHT identity holds at L2 and L3 for every layout tried: the
hole's skin boundary edges == the pane's boundary edges == the loop's
points, zero over-shared edges, one closed loop per window per side.
Layouts: two rounded rects (277/277/277 at L2), three round windows
(734/734/734 at L3), sharp rects (r 0), a window reaching the crown, one
on the belly, one 1.1 x 0.85 m, one 80 x 60 mm inside a single face,
two windows sharing a lattice column (the second cut composes over the
first one's triangles). Cut time 40-130 ms at L2/L3 for two windows both
sides, in the pane.

What does NOT work, by design: OVERLAPPING windows. The second outline
crosses the first hole's reveal and the loops go open. The editor row must
refuse it (pitch >= width + a frame).

## Integrated the same day (G245) — user rulings: absolute stations, doors own
## their panes. Items 1-4 and 6 below are DONE as described in HANDOVER G245;
## 5 (the interior liners) and 7 (a gate) are still open.

1. WHERE THE WINDOWS LIVE. A `spec.windows` list, per window {shape, z, y,
   w, h, r, sides}; the inspector's first cut is count / first station /
   pitch / y / w / h / r / shape (the bench's rows). Per-window stations
   later. `reach`-style fractions of the pax bay, or absolute stations? The
   band window moved to a FRACTION so a cabin-length change carries it
   (60_gen_spec `reach`); a drawn window at an absolute station stays put
   while the cabin moves — same question, same answer probably.
2. THE SLOT. After cageGlassSill/cageCut, before cageCanopy/cageRims, in
   cageSheet. With drawn windows on, the pax glass BAND goes back to skin
   (the bench does this by material remap; the real one is the emission
   table: `CAGE_MAT.pax.glass = 'body'`).
3. THE BEAD. `cageRims` sweeps by zone outline and has corner rounding,
   rivet domes, the flat-seal and retaining-strip modes; `knifeBead` is a
   plain octagon. Give cageRims a "sweep this recorded loop" entrance and
   retire knifeBead — the joint vocabulary must not fork.
4. N-GONS AND EXPLICIT NORMALS downstream. `meshFrom` in `_cage_ui.js`
   (line ~938) and `workshop.js` (~471) fan quads only and call
   computeVertexNormals — on a cut skin that seams at the hole. Both need
   the fan over `f.v.length` and `m.N` when present. cageRims' `groupZones`
   only reads quads: a knife window inside a DOOR needs the door outline
   traced over n-gons, or the door part to carry the pane (G14 v2 semantics:
   doors own their windows).
5. THE INTERIOR. cageInterior thickens the skin by zone; the liners do not
   know about the holes. Reveal depth today is the wall; with a real inner
   shell the wall becomes the jamb between skin and liner.
6. THE FIELD. The pane's aStruct is lerped, so glass dirt/edge dirt
   (G113.2 GLASS_EXT) works unchanged.
7. A GATE: the watertight identity above, over the archetype set.
