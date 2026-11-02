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
Levels of detail: the same generator at three levels (hero / mid / phone), see reports/evidence/SEATS/STATUS.md.

| # | name (the seat's spirit) | modelled on | width (outer) | back above hinge | mass / seat | seed recline / tilt |
|---|---|---|---|---|---|---|
| 0 | Tube & sling | Piper J-3 / PA-11 front seat | 0.46 m | 0.50 m | 3.0 (= today's `sling` row) | 12 / 4 |
| 1 | Carbon bucket | racing / homebuilt carbon bucket | 0.47 m | 0.80 m | 4.5 *est.* | 22 / 6 |
| 2 | Vintage airliner | DST / DC-3 day seat (1936–40s) | 0.52 m | 0.84 m | 18 *est.* | 14 / 4 |
| 3 | Touring | Cessna 172 front seat (late 1970s–2000s) | 0.49 m | 0.70 m | 14 | 13 / 4 |
| 4 | Sculpted sport | ICON A5 seat | 0.53 m | 0.84 m | 9 *est.* | 18 / 5 |
| 5 | Executive leather | Beechcraft Bonanza A36 / G36 seat | 0.54 m | 0.80 m (+ headrest) | 18 *est.* | 15 / 4 |
| 6 | Ultralight sling | Aeroprakt A22-class sling seat | 0.46 m | 0.56 m | 3.5 *est.* | 16 / 6 |
| 7 | Aerobatic recline | Extra 300/330 carbon seat + back-pack parachute | 0.45 m | 0.70 m | 6 *est.* (chute not billed) | 38 / 10 |
| 8 | Vintage crew | DC-3 / C-47 pilot seat (its cabin: type 2) | 0.52 m | 0.68 m | 20 *est.* | 14 / 4 |
| 9 | Heavy-duty work | Air Tractor AT-802 / Thrush crew seat | 0.55 m | 0.88 m | 16 *est.* | 11 / 5 |
| 10 | Woven cane | Sopwith Camel-type rattan seat | 0.46 m | 0.46 m | 3 *est.* | 9 / 3 |
| 11 | Reclined tub | ASK-21 / Discus-type cockpit pan + backrest | 0.58 m | 0.66 m | 3 *est.* (the pan is hull) | 40 / 16 |
| 12 | Folding canvas | Beaver / Husky folding cabin seat | 0.46 m | 0.50 m | 2.5 *est.* | 10 / 3 |
| 13 | Parachute bucket | Spitfire / T-6 pilot's bucket | 0.49 m | 0.60 m | 8 *est.* | 13 / 6 |
| 14 | Bush utility | DHC-2 Beaver crew seat | 0.50 m | 0.66 m | 12 *est.* | 12 / 4 |

0, 1 and 2 replaced today's tube frame, moulded composite shell and airliner seat (the user, 2 Nov). The names are the
seat's spirit, not an aeroplane's (the user: "find names avoiding naming planes"); the column beside them is only what
each was modelled on. The masses are the core's `GEN_SEATS` rows (`GEN_SEAT_TYPES` maps a type to its row); the join
writes `cabin.seatsKg` seat by seat when a drawn seat weighs other than the outfit's row, so the build, the bench and
the cert weigh what is drawn. A cabin takes its own type through `paxSeatType` (absent = the pilots', or type 8's
own cabin seat, type 2).

Belts: none (the user, 2 Nov: "drop the seat belts for all"). The harness belongs to the occupant layer if it returns.
Headrests: part of the seat (Bonanza on posts, ICON / carbon / ag / glider integrated or padded); the headliner and trim
are CABIN-CRAFT's.

## Per seat

**Tube & sling (0; the Cub's).** The J-3's front seat is a welded 4130 tube frame bolted to the fuselage's cross
tubes: a pan loop of 3/4-inch tube, a canvas bottom laced across it, a loose box cushion, and a back of canvas laced
between two uprights with a thin pad. No rails (a Cub's seat does not slide). Materials: painted steel tube, cotton or
synthetic canvas, a leatherette box cushion with piping. The cushion and pad wear the existing `seatTrim` livery
section, as the default seat always has.

**Carbon bucket (1).** A one-piece carbon/epoxy shell: a pan with thigh bolsters rising into shoulder bolsters and an
integrated headrest, a rolled rim (never a sawn edge), two thin removable pads (suede-like cloth, contrast stitch),
bolted to two side-mount brackets on alloy rails. Real carbon buckets are 3–6 kg with pads.

**Touring (3; the C172's).** Two seat rails (top-hat alloy extrusions with a row of 1/4-inch adjust holes) per seat, four rollers,
a pressed pan on a tube frame, a fore/aft adjust bar under the front and a recline lever on the outboard side;
upholstery of cloth inserts in vinyl or leather bolsters, horizontal pleats in the back, piping on every edge, and a
moulded plastic back shell with a map pocket. Later seats are taller with the headrest zone above a seam. Each
front seat is in the 12–16 kg range depending on the articulating mechanism; 14 kg is used.

**Sculpted sport (4; the ICON A5's).** Modern sport-car idiom: a sculpted moulded shell (gloss white / grey) wrapping thigh and shoulder
bolsters into an integrated headrest, leather bolsters, a quilted centre panel, contrast (orange) stitching, a satin
alloy pedestal. The A5's seats are fixed in the hull; the rows still move them in the game.

**Executive leather (5; the Bonanza's).** Deep leather club seating: rolled channels in squab and back, fat bolsters with piping, a tall back, a
separate adjustable headrest on two chrome posts, a padded armrest on the aisle side, a skirted base on tracks.

**Ultralight sling (6; the A22-class).** A bent 6061 alloy tube frame (pan and back in one bend each side, ~25 mm tube), a heavy
canvas sling laced to it with a thin foam pad sewn in. No brace behind the back (the user, 2 Nov): the bend is
triangulated inside the seat's own footprint.

**Aerobatic recline (7; the Extra's).** A carbon shell for a reclined aerobatic pilot: a low narrow pan with a high front lip, a long back far
past an upright seat's, and in it the pilot's back-pack parachute — the seat back is the chute's shape (the pack is
modelled; its mass is the occupant's, not the seat's).

**Vintage crew (8) and Vintage airliner (2): the DC-3's.** Pilots: a riveted alloy bucket deep enough for a seat-pack parachute, leather squab and back cushions, padded
arms on brackets, on a column with tracks. Passengers (1936–40s day seat): a deep upholstered reclining seat in wool
mohair, a high rounded buttoned back, a linen antimacassar over the top, leather arm rolls with chrome ends, on a
polished tube frame.

**Heavy-duty work (9; the ag plane's).** Crash-rated work seat (the class is certificated to high vertical loads, ~26 g): a deep pressed-steel
bucket with a high back and head wings, thick black cordura cushions under a sheepskin cover (the near-universal
operator fit), two vertical height-adjust tracks behind with carriage blocks, a red-knobbed height lever on the right,
two energy-absorbing crush tubes under the pan.

**Woven cane (10; the WWI scout's).** Woven rattan on cane stakes: a round tub whose back wraps the pilot in plan, a thick wrapped rim, a
leather cushion in the pan, the whole on two ash bearers that rest on the longerons. Light and springy.

**Reclined tub (11; the sailplane's).** The pan is the cockpit's moulded GRP (white gelcoat), a thin cushion in it; the pilot lies back
against a padded backrest board hinged at its foot, its angle set by struts onto notched quadrants; a headrest pad
on the board. Anchored here by four small tubes (the user, 2 Nov).

**Folding canvas (12; the bush cabin's).** A light painted steel U-frame on two floor hinges with quick-release pins, folding front legs, an
olive canvas seat, and a canvas back hung between two uprights with a webbing strap across.

**Parachute bucket (13; the warbird's).** The Spitfire's moulded resin-bonded (reddish-brown "bakelite") bucket — flared sides with
lightening holes, pressed vertical ribs in the back, a padded leather shoulder cushion, the seat-pack parachute in the
pan, hung from a steel frame behind with a height lever.

**Bush utility (14; the Beaver's).** The crew seat: a 1950s painted steel-tube frame whose side members run into the back, a pressed alloy back
panel with flanged lightening holes, channel-pleated leatherette cushions, short floor tracks. (The folding rear bench
was modelled and dropped, the user 2 Nov; a cabin takes any preset through `paxSeatType`.)

## Finishes

Every preset's materials come from the finish system (`AEROSKIN.aeroMaterial`: leather, cabin cloth, webbing,
composite, gelcoat, alloy, chrome, …), and the main ones go through the editor's livery resolver: the upholstery is
four livery sections, each with the editor's finish and tint pickers (the user: "a couple of configurable colors ...
base, accent and seam"): `seatTrim` the base upholstery (the section the default seat has always worn), `seatAccent`
the inserts and secondary panels, `seatSeam` the piping, stitching and bindings, `seatFrame` the frames and shells.
With nothing picked a seat wears its calibrated look (the preset's finish and tint are each section's bottom-out); a
pick on a section wins on every seat of the aeroplane.
