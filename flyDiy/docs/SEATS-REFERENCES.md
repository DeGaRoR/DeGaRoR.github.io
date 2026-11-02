# SEATS — references (SEATS session, 2026-11-02)

What each seat preset is modelled on: its real shape, dimensions, materials and mass, and what the model keeps fixed
(calibrated) and what stays on the rows. The models are ours — built from the parameters below in
`tools/_seat_gen.js`; nothing is copied from any manufacturer's drawing or any third-party model. Sources are public:
pilot's operating handbooks (weight and balance sections), parts catalogues and type-certificate data where they list a
seat, manufacturers' and restorers' published descriptions, museum descriptions and period photographs.

**Mass honesty.** A number marked *est.* is our estimate from the construction (frame tube by length, cushion foam by
volume, shell by area), not a published figure. A number without it is the published order of magnitude for that
seat. Each preset's `kg` (and `kgPax` for a cabin seat) in `SEAT_PRESETS` is the mass the build bills per seat when the
preset is wired (STEP 3): it replaces today's `GEN_SEATS` row for that build.

**The seating reference.** Every preset puts its occupied surfaces on the same two lines the crew's occupant is seated
against (squab top ~65 mm over the stand height at the hinge, the back's face through the hinge leaning by the
recline), so the pilot sits right whatever the preset. What the user keeps on the rows: stand height (`seatH`),
recline (`seatRake`), squab tilt (`seatTilt`), fore/aft (`seatZ`), layout and spacing (`seatLayout`, `seatGap`), and
since this session the passengers' own seat (`paxSeatType`, -1 = the pilots'). What is calibrated: width and back
height (a cabin narrower than the seat scales its width to the room, a low roof shortens the back; `fit` says so).

| # | preset | modelled on | width (outer) | back above hinge | mass / seat | default recline / tilt |
|---|---|---|---|---|---|---|
| 0 | Tube frame (today) | — kept as is, the minimum | cabin-derived | cabin-derived | 3.0 (`sling`) | 13 / 3 |
| 10 | Cub (reworked base) | Piper J-3 / PA-11 front seat | 0.46 m | 0.50 m | 3.5 *est.* | 12 / 4 |
| 1 | Composite shell (today) | — kept as is until the verdict | cabin-derived | cabin-derived | 7.0 (`basic`) | 22 / 6 |
| 3 | Carbon bucket (reworked) | racing / homebuilt carbon bucket | 0.47 m | 0.80 m | 4.5 *est.* | 22 / 6 |
| 4 | Cessna 172 | C172 front seat (late 1970s–2000s) | 0.49 m | 0.70 m | 14 | 13 / 4 |
| 5 | ICON A5 | ICON A5 seat | 0.53 m | 0.84 m | 9 *est.* | 18 / 5 |
| 6 | Bonanza | Beechcraft Bonanza A36 / G36 seat | 0.54 m | 0.80 m (+ headrest) | 18 *est.* | 15 / 4 |
| 7 | Ultralight | Aeroprakt A22-class sling seat | 0.46 m | 0.56 m | 3.5 *est.* | 16 / 6 |
| 8 | Extra 330 | Extra 300/330 carbon seat + back-pack parachute | 0.45 m | 0.70 m | 6 *est.* (chute not billed) | 38 / 10 |
| 9 | DC-3 | DC-3 / C-47 pilot seat; DST/DC-3 day seat | 0.52 m | 0.68 m pilot, 0.84 m pax | 20 pilot, 18 pax *est.* | 14 / 4 |
| 11 | Agricultural | Air Tractor AT-802 / Thrush crew seat | 0.55 m | 0.88 m | 16 *est.* | 11 / 5 |
| 12 | WWI wicker | Sopwith Camel-type rattan seat | 0.46 m | 0.46 m | 3 *est.* | 9 / 3 |
| 13 | Glider tub | ASK-21 / Discus-type cockpit pan + backrest | 0.58 m | 0.66 m | 3 *est.* (pan is hull) | 40 / 16 |
| 14 | Bush jump seat | Beaver / Husky folding cabin seat | 0.46 m | 0.50 m | 2.5 *est.* | 10 / 3 |
| 15 | Warbird bucket | Spitfire / T-6 pilot's bucket | 0.49 m | 0.60 m | 8 *est.* | 13 / 6 |
| 16 | Beaver | DHC-2 Beaver crew seat; rear bench | 0.50 m (bench 0.56 / place) | 0.66 m crew, 0.56 m bench | 12 crew, 6 per bench place *est.* | 12 / 4 |

Belts: none (the user, 2 Nov: "drop the seat belts for all"). The harness belongs to the occupant layer if it returns.
Headrests: part of the seat (Bonanza on posts, ICON / carbon / ag / glider integrated or padded); the headliner and trim
are CABIN-CRAFT's.

## Per seat

**Cub (the base seat, reworked).** The J-3's front seat is a welded 4130 tube frame bolted to the fuselage's cross
tubes: a pan loop of 3/4-inch tube, a canvas bottom laced across it, a loose box cushion, and a back of canvas laced
between two uprights with a thin pad. No rails (a Cub's seat does not slide). Materials: painted steel tube, cotton or
synthetic canvas, a leatherette box cushion with piping. The cushion and pad wear the existing `seatTrim` livery
section, as the default seat always has.

**Carbon bucket.** A one-piece carbon/epoxy shell: a pan with thigh bolsters rising into shoulder bolsters and an
integrated headrest, a rolled rim (never a sawn edge), two thin removable pads (suede-like cloth, contrast stitch),
bolted to two side-mount brackets on alloy rails. Real carbon buckets are 3–6 kg with pads.

**Cessna 172.** Two seat rails (top-hat alloy extrusions with a row of 1/4-inch adjust holes) per seat, four rollers,
a pressed pan on a tube frame, a fore/aft adjust bar under the front and a recline lever on the outboard side;
upholstery of cloth inserts in vinyl or leather bolsters, horizontal pleats in the back, piping on every edge, and a
moulded plastic back shell with a map pocket. Later seats are taller with the headrest zone above a seam. Each
front seat is in the 12–16 kg range depending on the articulating mechanism; 14 kg is used.

**ICON A5.** Modern sport-car idiom: a sculpted moulded shell (gloss white / grey) wrapping thigh and shoulder
bolsters into an integrated headrest, leather bolsters, a quilted centre panel, contrast (orange) stitching, a satin
alloy pedestal. The A5's seats are fixed in the hull; the rows still move them in the game.

**Bonanza.** Deep leather club seating: rolled channels in squab and back, fat bolsters with piping, a tall back, a
separate adjustable headrest on two chrome posts, a padded armrest on the aisle side, a skirted base on tracks.

**Ultralight (A22-class).** A bent 6061 alloy tube frame (pan and back in one bend each side, ~25 mm tube), a heavy
canvas sling laced to it with a thin foam pad sewn in. No brace behind the back (the user, 2 Nov): the bend is
triangulated inside the seat's own footprint.

**Extra 330.** A carbon shell for a reclined aerobatic pilot: a low narrow pan with a high front lip, a long back far
past an upright seat's, and in it the pilot's back-pack parachute — the seat back is the chute's shape (the pack is
modelled; its mass is the occupant's, not the seat's).

**DC-3.** Pilots: a riveted alloy bucket deep enough for a seat-pack parachute, leather squab and back cushions, padded
arms on brackets, on a column with tracks. Passengers (1936–40s day seat): a deep upholstered reclining seat in wool
mohair, a high rounded buttoned back, a linen antimacassar over the top, leather arm rolls with chrome ends, on a
polished tube frame.

**Agricultural.** Crash-rated work seat (the class is certificated to high vertical loads, ~26 g): a deep pressed-steel
bucket with a high back and head wings, thick black cordura cushions under a sheepskin cover (the near-universal
operator fit), two vertical height-adjust tracks behind with carriage blocks, a red-knobbed height lever on the right,
two energy-absorbing crush tubes under the pan.

**WWI wicker.** Woven rattan on cane stakes: a round tub whose back wraps the pilot in plan, a thick wrapped rim, a
leather cushion in the pan, the whole on two ash bearers that rest on the longerons. Light and springy.

**Glider tub.** The pan is the cockpit's moulded GRP (white gelcoat), a thin cushion in it; the pilot lies back
against a padded backrest board hinged at its foot, its angle set by struts onto notched quadrants; a headrest pad
on the board. Anchored here by four small tubes (the user, 2 Nov).

**Bush jump seat.** A light painted steel U-frame on two floor hinges with quick-release pins, folding front legs, an
olive canvas seat, and a canvas back hung between two uprights with a webbing strap across.

**Warbird bucket.** The Spitfire's moulded resin-bonded (reddish-brown "bakelite") bucket — flared sides with
lightening holes, pressed vertical ribs in the back, a padded leather shoulder cushion, the seat-pack parachute in the
pan, hung from a steel frame behind with a height lever.

**Beaver.** Crew: a 1950s painted steel-tube frame whose side members run into the back, a pressed alloy back panel
with flanged lightening holes, channel-pleated leatherette cushions, short floor tracks. Cabin: the folding rear bench,
drawn as one section per seated place (box cushion as wide as the place, webbing straps and a thin pad on tube
uprights), so a row reads as one bench.

## Finishes

Every preset's materials come from the finish system (`AEROSKIN.aeroMaterial`: leather, cabin cloth, webbing,
composite, gelcoat, alloy, chrome, …), and the main ones go through the editor's livery resolver: the upholstery is
the `seatTrim` section (the section the default seat has always worn), frames and shells `seatFrame`, inserts and
secondary trim `seatAccent`. With nothing picked a seat wears its calibrated look (the preset's finish and tint are
the section's bottom-out); a pick on the section overrides it. `seatFrame` / `seatAccent` get their rows in the
finish table when the presets are wired.
