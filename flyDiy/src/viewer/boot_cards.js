// boot_cards.js - THE LOADING SCREEN'S CARDS (G640, 2026-09-26)
//
// Data only: window.BOOT_CARDS, read by boot.js's carousel (it rides in the
// same inline block, ahead of boot.js; a second tag in dev.html). The user,
// after the Jolene playtest: "That's a lot of time for users to read, so tell
// them what happens, but also cool things about the game, or more advanced
// techniques for flying their planes or playing the game."
//
// A card is { k, t, x, set?, when? }:
//   k     'now' (what is happening, opens a deck of its own set), 'island',
//         'game', 'fly', 'garage' - boot.js's KIND names them on the card
//   t, x  the title and the text: a card is read in ~10 s, keep it short
//   set   'garage' (the shed's boot and the way back), 'rollout' (the world),
//         'any' (the default); a NOW card names its deck: 'garage', 'rollin',
//         'rollout', 'settings'
//   when  'cold': only while this site's shaders are not cached yet
//
// EVERY CLAIM HERE IS THE GAME'S OWN, checked against the code the day it was
// written (the keys: input.js; the plaque's words and bounds: plaque.js; the
// bench: bench.js; the balance: editor.js / balance.js; the fields:
// tools/fixtures/island_jolene.json; the pilot's speeds: 44_machine_sheet.js).
// NOT CLAIMED, because the game does not do it: a map or a pause key (both are
// buttons), autopilot modes a player engages, an in-flight gear lever, a wing
// that breaks, a stall horn. A feature that changes changes its card.
(function () {
  'use strict';
  const C = [
    // ---- right now: why this screen, and why the first time is longer ----
    { k: 'now', set: 'garage', t: 'The shed opens when it is finished',
      x: 'Nothing shows half-built: the room, your aeroplane, its skin and the crew all land behind this screen, and the first frames are drawn here too.' },
    { k: 'now', set: 'garage', when: 'cold', t: 'Why the first visit is slower',
      x: "On the first launch, and after an update, your graphics driver compiles the game's shaders for this machine. It is done once: the next launches reuse them and start much faster." },
    { k: 'now', set: 'rollout', t: 'The world is built on the first roll-out',
      x: 'The shed never needed the world, so it waits until now: the ground, the water, the villages, the forest around the stand. A second roll-out at the same stand is almost instant.' },
    { k: 'now', set: 'rollout', when: 'cold', t: 'Why the first flight is slower',
      x: 'The world has shaders of its own - the ground, the water, the trees, the clouds. Your graphics driver compiles them once for this machine, and the browser keeps them for the next visit.' },
    { k: 'now', set: 'rollin', t: 'Back to the shed',
      x: 'A flight that ended is already in the logbook: it was written the moment the aeroplane stopped.' },
    { k: 'now', set: 'settings', t: 'Applying your settings',
      x: 'Shadows, water, clouds and the tone curve change what the graphics card draws, so those surfaces are recompiled first - here, not in the middle of your flight.' },

    // ---- the island --------------------------------------------------------
    { k: 'island', set: 'rollout', t: 'Jolene is a real island',
      x: 'Jolene is Annette Island, in south-east Alaska, built from its real elevation data. Its highest point is Tamgas Mountain, 1 096 m.' },
    { k: 'island', set: 'rollout', t: 'Jolene AFB',
      x: 'The home field is a Second World War cross of old concrete: 13/31 is 2 325 m long, 02/20 is 1 835 m. Room for anything you can build.' },
    { k: 'island', set: 'rollout', t: 'Skyline Altiport',
      x: '380 m of grass on a slope that rises about 29 m. You land uphill and you leave downhill, whatever the wind says.' },
    { k: 'island', set: 'rollout', t: 'Tamgas Hill Strip',
      x: '520 m of gravel, one way only, with about 14.5 m of rise along it. Decide on the go-around before you are committed.' },
    { k: 'island', set: 'rollout', t: 'Jumbo Mine Street',
      x: "The mining village's main street is the runway: 250 m of gravel, 676 m up the mountain, one way. You land north-north-east, over the south end." },
    { k: 'island', set: 'rollout', t: 'East Point Clearing',
      x: 'The shortest strip on the island: 150 m of gravel cut in the trees, one way. The right speed on final, or a go-around.' },
    { k: 'island', set: 'rollout', t: 'Two lanes on the water',
      x: 'Annette Dock and the Metlakatla Seaplane Base each have 1 500 m of water. Build floats, and the sea is a runway.' },
    { k: 'island', set: 'rollout', t: 'Metlakatla',
      x: "The island's one real town, rebuilt with its Town Hall, the Duncan Cottage Museum, the Long House and the boat harbour." },
    { k: 'island', set: 'rollout', t: 'The Skyline tramway',
      x: 'Two cabins run the line in opposite directions, between the valley station and the ski lodge at the summit.' },
    { k: 'island', set: 'rollout', t: 'Look down',
      x: 'The map marks the wildlife too: bears, elk and deer on the island, whales off its coast.' },

    // ---- the game -----------------------------------------------------------
    { k: 'game', t: 'The world before the island',
      x: "The game was built on a procedural 24 km world with Home Strip and Skarvik. It is still one pick away: the world row of the graphics menu." },
    { k: 'game', t: 'One clock for the shed and the world',
      x: 'The hour you set in the shed is the hour you fly in: dawn, morning, noon, afternoon, golden, sunset, dusk, night. Pausing stops the clock.' },
    { k: 'game', t: 'The weather is yours',
      x: 'Pick a day on the flight plate - a breeze, a ridge day, a thermal day, hot and high, a front, a gale - or set the wind, the gusts, the thermals and the sea breeze in the weather rail.' },
    { k: 'game', t: 'Eight skies',
      x: 'The clouds rail: clear, fair weather, scattered, broken deck, overcast, two decks, high sheet, storm.' },
    { k: 'game', t: 'Who flies?',
      x: 'The flight plate names the pilot: auto, cautious, brisk, the test pilot or the autopilot. Press A to take the controls yourself, and again to hand them back.' },
    { k: 'game', t: 'Routes',
      x: 'Pick a departure and a destination on the flight plate, or ⟳ Circuit to fly one and come home. Pick a new destination after landing and the next leg chains on.' },
    { k: 'game', t: 'The phase rail',
      x: 'TAXI, LINE UP, TAKEOFF ROLL, CLIMB, CROSSWIND, DOWNWIND, BASE, FINAL, FLARE, ROLLOUT: the rail says where the flight is, the status line what the pilot is aiming for.' },
    { k: 'game', t: 'Views',
      x: 'C cycles the views: chase, orbit, cockpit, wing and tower. In the cockpit, L lets the mouse turn your head, and Escape gives the mouse back.' },
    { k: 'game', t: 'Five presets',
      x: 'potato, 5 years ago, current, gamer, ultra - or your own mix. The frame rate row holds 60, holds 30, or runs free; auto picks for you.' },
    { k: 'game', t: 'The pictures are kept',
      x: "After the first visit the browser keeps the textures and models. The graphics menu's storage row shows the build, the cache, and a refresh caches button." },

    // ---- flying -------------------------------------------------------------
    { k: 'fly', t: 'The approach speed',
      x: 'The pilot flies final at 1.3 times the stall speed with the flaps down, and 1.2 into a short field. Fly it the same way.' },
    { k: 'fly', t: 'Flaps',
      x: 'F lowers the flaps a notch, G raises them. In the cockpit view, click the flap lever instead: the head keys take F there.' },
    { k: 'fly', t: 'Trim',
      x: 'Numpad 1 trims the nose up, Numpad 7 down - or roll the trim wheel in the cockpit. Trim is a steady hand on the stick: set it for the speed you want.' },
    { k: 'fly', t: 'No stall horn',
      x: 'Below the plaque’s stall speed, and more than 3 m up, the airspeed turns to its warning colour. Keep an eye on the number.' },
    { k: 'fly', t: 'Crosswind on the ground',
      x: 'A tail-up taildragger weathervanes into the wind on its mains. The limit is built in the shed, not flown: mains further aft, a bigger fin, a lower thrust line.' },
    { k: 'fly', t: 'Brakes',
      x: 'B holds the brakes, P sets the parking brake. Go easy on a taildragger: with a nose-over angle under 15 degrees, a firm brake is not forgiven.' },
    { k: 'fly', t: 'The throttle is a lever',
      x: 'PageUp and PageDown move it and it stays where you leave it; Home is full power, End is idle.' },
    { k: 'fly', t: 'Hot and high',
      x: 'Thin air costs a piston engine a quarter of its thrust where an electric motor loses a twentieth. A turbine is flat-rated; a turbo holds its power up to its critical altitude.' },
    { k: 'fly', t: 'The air rail',
      x: 'Outside air temperature, density altitude, wind, gusts and the time of day, live: open the air rail before a mountain strip.' },
    { k: 'fly', t: 'Reading the trace',
      x: 'The trace draws the flight as it happens: altitude, speed, angle of attack, pitch, roll, yaw, flap, and the peak strain on the airframe. Drag it and size it where you want it.' },
    { k: 'fly', t: 'Netto',
      x: 'On a ridge or a thermal day, add the netto vario from the instruments rail: it shows what the air is doing, not the aeroplane.' },
    { k: 'fly', t: 'Off the water',
      x: 'On floats the hull ploughs, climbs over the hump, then planes on the step and lifts. The water rudders come up by themselves at take-off power.' },
    { k: 'fly', t: 'Short fields',
      x: 'Ground effect is modelled on every wing strip: a fast approach floats on it, past the aim. On a short strip, the speed is the landing.' },
    { k: 'fly', t: 'Master, key and fuel',
      x: 'M is the master switch, J and H turn the key through OFF, L, R, BOTH and START, U sets the fuel selector. Fuel off stops the engine; START brings it back.' },
    { k: 'fly', t: 'Lights',
      x: 'T the taxi light, L the landing light (outside the cockpit view), N the navigation lights, K the beacon, I the instrument lights, O the cabin flood.' },
    { k: 'fly', t: 'See the circuit',
      x: 'The patterns rail draws the taxi routes, the glide slopes and the touchdown targets onto the world.' },
    { k: 'fly', t: 'Where the flight starts',
      x: 'The start rail decides: wheeled out of the shed and taxiing to the strip, or already lined up on the runway.' },
    { k: 'fly', t: 'Controls',
      x: 'The arrow keys fly the aeroplane (down is nose up), comma and full stop are the rudder. Every key can be rebound, and a gamepad works too.' },

    // ---- in the shed --------------------------------------------------------
    { k: 'garage', set: 'garage', t: 'The centre of gravity and the neutral point',
      x: 'The amber post is the centre of gravity, the cyan post the neutral point, the bar between them the stability margin. Comfortable is 10 to 25 %; under 5 % is twitchy; negative will not fly.' },
    { k: 'garage', set: 'garage', t: 'Moving the margin',
      x: 'Move the wing aft to gain margin, forward to lose it; move weight the other way. The neutral point moves with the wing and the tail, not with the weights.' },
    { k: 'garage', set: 'garage', t: 'Fuel moves the centre of gravity',
      x: 'The weight and balance chart under Fuel & energy draws the CG walking from full tanks to dry, against the neutral line and a caution line 5 % ahead of it.' },
    { k: 'garage', set: 'garage', t: 'Wing loading',
      x: 'The weight over the wing area: a trainer sits near 40 kg/m², an ultralight under 25, a fast tourer past 80. The lower it is, the slower it stalls.' },
    { k: 'garage', set: 'garage', t: 'The sandbag test',
      x: 'The wing loading test turns the aeroplane on its back and loads the wing with sandbags: +3.8 g, the limit, then +5.7 g, the ultimate - FAR 23, normal category.' },
    { k: 'garage', set: 'garage', t: 'When the wing does not hold',
      x: 'A tip bent past 15 % of the half-span fails the test. The advisor then measures the fixes for you: lift struts, an aluminium or a carbon wing, a metre off the span.' },
    { k: 'garage', set: 'garage', t: 'The plaque is earned',
      x: 'It starts empty and the bench fills it. Change the build and it is withdrawn: every number on it belongs to the aeroplane that was tested.' },
    { k: 'garage', set: 'garage', t: 'Roll out untested',
      x: 'You can always roll out, tested or not - the button just says so. Untested is a word on a button, not a lock.' },
    { k: 'garage', set: 'garage', t: 'Start from an archetype',
      x: 'New aeroplane: a Cub-alike, a Tiger Moth-alike, a Beaver-alike, a P-38-alike, a motorglider and more - or custom build, or surprise me. Every value stays yours to change.' },
    { k: 'garage', set: 'garage', t: 'Materials',
      x: 'Steel tube and fabric is the cheap way to build. Spruce and ply fails in compression and at its glue joints. Alloy sheet is flush-riveted and clean; carbon is the smoothest, and the dearest.' },
    { k: 'garage', set: 'garage', t: 'Weathervane',
      x: 'The fin and the length of the tail decide how firmly the aeroplane points into the wind. A longer tail arm also moves the neutral point aft.' },
    { k: 'garage', set: 'garage', t: 'Taildraggers',
      x: 'A taildragger sits at a deck angle of 8 to 12 degrees. The plaque’s nose-over rows say how hard you can brake, and whether full power can tip it over.' },
    { k: 'garage', set: 'garage', t: 'Cleaner glides further',
      x: 'Cover the fuselage, put spats on the wheels, fair the legs: the plaque’s best L/D shows what each one was worth.' },
    { k: 'garage', set: 'garage', t: 'Four kinds of flap',
      x: 'None, plain, slotted or Fowler. A plain flap does little; the Fowler slides aft and lifts the most. The bench check measures the stall with each.' },
    { k: 'garage', set: 'garage', t: 'Save, and save again',
      x: 'The working build is kept on every change. Save, save as, new and load live on the name plate - drop a .json on it to import one.' },
    { k: 'garage', set: 'garage', t: 'Wheels or floats',
      x: 'The undercarriage tile: a taildragger, a tricycle, or floats. On floats the bench adds a hydroplane test - the plough, the hump, the step, lift-off.' },
    { k: 'garage', set: 'garage', t: 'Density altitude',
      x: 'The bench flies the same take-off and climb out of a hot mountain strip. The verdict: WORKS HOT AND HIGH, or SEA LEVEL ONLY.' },
    { k: 'garage', set: 'garage', t: 'The test flight',
      x: 'A real circuit, awarded on arrival - yours or the pilot’s - with a director cutting the cameras.' },
    { k: 'garage', set: 'garage', t: 'Forty engines',
      x: 'From the Rotax 277 to the PT6A turboprop, with the Gipsy Major and the Wasp Junior between - and electric motors, the EMRAX and Pipistrel’s E-811.' },
    { k: 'garage', set: 'garage', t: 'Explode it',
      x: 'The explode button on the rail pulls the aeroplane apart, part from part, so you can see what is under the skin.' },
    { k: 'garage', set: 'garage', t: 'Cameras in the shed',
      x: '3/4 front, side, plan, nose - or interior, the pilot’s own eyes, once a crew is fitted.' },
    { k: 'garage', set: 'garage', t: 'The shed’s light',
      x: 'The room follows the clock: afternoon, golden, sunset, dusk, night - and overcast when the clouds close in.' },
  ];
  if (typeof window !== 'undefined') window.BOOT_CARDS = C;
  if (typeof module !== 'undefined') module.exports = C;
})();
