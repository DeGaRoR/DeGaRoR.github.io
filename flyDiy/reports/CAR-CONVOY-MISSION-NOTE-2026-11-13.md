# CAR to A0: the car-delivery mission, intention (13 Nov 2026)

The user wants this (in their words): "we need to have this assembly actually drive, with proper physics. The car should be
mounted on the trailer like the planes are. No advanced functionality, the car stays inert for now, but let's put this on
the home field as baked copies like the planes, and let's have a car mission where you have to deliver that car somewhere,
as a change." They asked me only to tell you the intention and when the final models will be available.

## The assembly
- **Tow car:** the Field Wagon Retro van, `builds/vehicles/utility_retro_2026-11.json` (a car: `spec.kind 'car'`, its
  sheet `src/cars/car_utility.json`, a drawn 50 mm ball at `window.CAGE_GEAR_HITCH`).
- **Trailer:** TOW-LAUNCH's launch trailer in its car-deck dress, `src/vehicle/trailer_model.js` with
  `fit.kind 'car'` and `fit.car { xR, xF, track[F/R], tyreR, tyreW, x0, x1 }`: a hardwood deck over the guards, chocks
  cut to the tyres, folding ramps (`Tr.ramp 'up'` for the road, `'down'` to load). It's TOW-LAUNCH's file
  (claude/tow-launch-trailer-look 522f7c7b, with my deck merged in).
- **Cargo:** the boat-tail roadster, `builds/candidates/roadster_2026-11.json`, inert, chocked on the deck. It sits there
  the way a plane sits in the launch trailer's cradle: a payload mass on the deck, no wheels of its own in the physics.
- **Composition reference:** `tools/convoy_shot.js` places the three exactly. The trailer couples on the van's drawn
  ball; the cargo's axles straddle the tandem, `xR = 0.25 - wb/2` with a little weight on the ball; it's levelled
  (the garage tilts the ground to a stance) and its tyres are measured from the drawn wheel groups.

## The proposal (yours to schedule and assign)
1. **Drive it:** the tow rig TOW-LAUNCH already runs (DM.tow, trailer.js), the trailer in its car fit, the roadster's
   mass and CG on the deck as the planes' are in the cradle.
2. **Baked copies on the Home Field:** the van + trailer + roadster parked there as the planes' baked copies are.
3. **A car mission:** deliver the roadster to a car-only destination (drive_mode CAR_SITES: Dockside Diner, Harbour
   General Store, Cedar Harbour dock, Hilltop Coffee, Jolene Island Packing). Done when the van parks there with the
   trailer still hitched (no unloading, as the user said: no advanced functionality).

## When the final models are ready
On `claude/fly-diy-car-build-uu6e6w`:
- **Now:** the van's three liveries, the roadster and the car-deck trailer, all final in shape and livery.
- **In progress:** the user's last request, professional tyre and rim texturing (PBR rubber, tread and sidewall normals,
  rim UVs, wear and dirt, rotation-safe), done on the cars and as an option for the planes.
- **Final, with the tyres:** by Saturday 14 Nov, 12:00, ahead of the agreed Saturday 19:30 tip for L40c.
