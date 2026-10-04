// SND-RADIO-3 (G1700-G1702): RADIO JOLENE'S BROADCAST, WRITTEN OFFLINE - a seeded, deterministic generator.
//
//   node tools/audio/radio_gen.js            write tools/audio/radio_script.json (and the spoken-title map back into
//                                            voice_script.json when a catalogue track has none yet)
//   node tools/audio/radio_gen.js --check    exit 1 when radio_script.json is not what this file writes (or a line breaks
//                                            the writing rules)
//   node tools/audio/radio_gen.js --print    the whole program as text, break by break
//
// THE IDEA (the user's verdict, 2026-10-04: "a series of numbers, badly linked" -> make it LIVE): Radio Jolene's talk is
// written here, ONCE, for the ear - the bible (tools/audio/radio_bible.md), the cast, the businesses, the story threads
// and the grammars below - and rendered by tools/audio/prep_voice.js as WHOLE takes (one Piper take per item, or one per
// full sentence). At runtime src/viewer/audio/radio_talk.js only CHOOSES and SEQUENCES the rendered items: it never
// assembles words, it never reads a number.
//
// THE SCRIPT (radio_script.json):
//   items     { key: { v, cat, text, phone?, part?, wx? } }   one rendered take each. v: the voice (norman, john, kristin,
//             or a caller: voices[v] says which Piper model and speaker); phone: rendered through the phone line.
//   segments  { id: { cat, items: [keys], th?, st? } }       what a break plays: one community item, an ad, a call-in (the
//             host, the caller, the host), the recorded message (the host's intro, the officer), the interview.
//             th / st: the story thread and its step (threads advance in order).
//   pools     { id: { generic: [], morning: [], afternoon: [], evening: [], night: [] },
//               wx: { lead: { sky: [] }, wind: { band: [] }, gusty: [], advice: { hazard: [] }, outlook: { trend: [] },
//                     feel: { temp: [] } },
//               ba: { trackId: [keys] } }                     chosen at runtime by the game's state and by what was heard
//   program   [ [tokens] ]   the breaks in broadcast order: '@id' (a station ID / greeting), '@ba' (the back-announce of
//             the track just played), '@wx' (the weather in words, from the game), or a segment id.
//   threads   { th: [segment ids in order] }
//   voices    { v: { model, speaker } }
// The program is seeded: the same file always writes the same script (GATE AUDIO's RADIO_HORIZON holds the result: two
// hours of broadcast without a repeated item, the threads in order).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'radio_script.json');
const SCRIPT = path.join(__dirname, 'voice_script.json');
const MUSIC = path.join(ROOT, 'src', 'viewer', 'audio', 'music_catalogue.json');
const SEED = 20261004;
const BREAKS = 30;            // the program's length: about 2.6 hours at 'talk every 2' on Radio Jolene's 22 tracks
const ROOTS = 'roots';

// ---- the random (mulberry32: seeded, the same every run) -------------------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- THE VOICES ------------------------------------------------------------------------------------------------------
// norman: the host (the user's pick). john: Chief Walt Brennan (the interview). kristin: Officer Dana Hale (recorded
// messages). The callers: LibriTTS speakers (en_US-libritts-high, CC BY 4.0), chosen for distinct, clean voices
// (median pitch and noise floor measured over 100 speakers; reports/evidence/SND-RADIO-3/voices/).
const VOICES = {
  norman: { model: 'norman' }, walt: { model: 'john' }, dana: { model: 'kristin' },
  carl: { model: 'libritts', speaker: 189 }, bobby: { model: 'libritts', speaker: 576 }, wendell: { model: 'libritts', speaker: 27 },
  ada: { model: 'libritts', speaker: 567 }, marjorie: { model: 'libritts', speaker: 315 }, bev: { model: 'libritts', speaker: 585 },
  ruthann: { model: 'libritts', speaker: 162 },
};
const CALLERS = { carl: 1, bobby: 1, wendell: 1, ada: 1, marjorie: 1, bev: 1, ruthann: 1 };

// ---- THE STATION IDS AND GREETINGS -------------------------------------------------------------------------------------
const IDS = {
  generic: [
    'This is Radio Jolene, the voice of the island, coming to you from the back room of the hall.',
    "You're listening to Radio Jolene, community radio for the island and the Sound.",
    "Radio Jolene, where the coffee's hot and the news is all local.",
    "This is Radio Jolene, I'm Norman, and I'll be keeping you company for a while.",
    'Radio Jolene, run by volunteers and powered by the coffee urn.',
    "You're tuned to Radio Jolene, good music and island news, nothing fancy.",
    'Radio Jolene, for everyone on the island, and anybody passing through.',
    "Radio Jolene here, the only station that knows whose dog that is.",
  ],
  morning: [
    "Good morning to you, Jolene. Coffee's on at the hall, and so is the radio.",
    'Morning, folks, Norman here, up with the gulls on Radio Jolene.',
    'Good morning to everyone up early, and to the fishermen already out there.',
    'Morning on the island, this is Radio Jolene, easing you into the day.',
  ],
  afternoon: [
    'Good afternoon, Jolene, this is Norman keeping the afternoon company.',
    "Afternoon, folks, you're listening to Radio Jolene.",
    'Good afternoon to everyone at work, and to everyone pretending to work.',
    "It's afternoon on the island, and this is Radio Jolene.",
  ],
  evening: [
    'Good evening to you, Jolene. Supper is done, the dishes can wait, and this is Radio Jolene.',
    'Evening, folks, Norman here, settling in with you on Radio Jolene.',
    'Good evening to everyone tying up for the night.',
    'Evening on the island, this is Radio Jolene, keeping the lights on.',
  ],
  night: [
    'Good evening, night owls. Radio Jolene is still on, and so am I.',
    "It's late, folks, and this is Radio Jolene for anyone still up.",
    'Still with us, night owls? Norman here, on Radio Jolene.',
    "Late night on the island, the harbour's quiet and Radio Jolene is on.",
  ],
};

// ---- THE WEATHER IN WORDS (radio_talk.js quantises the game's weather into these keys) --------------------------------
// lead: the sky, the fog, the rain - one per segment, matched to the game. A lead may carry a part of the day ('morning',
// 'afternoon', 'evening' = evening and night); it is only chosen then. wind: the wind band. gusty: added on a gusty
// breezy or windy day. advice: per hazard, for pilots and boaters. outlook: a front on the way, or the weather easing
// behind one. feel: cold or mild.
const WX = {
  lead: {
    clear: [
      'Not a cloud over the island right now, so get your washing out while it lasts.',
      'Clear skies all round, and you can see right across the Sound to the mainland hills.',
      "It's a clear one out there, the kind of day the postcards promise.",
      "Blue sky over the harbour, and the water's flat as a dinner plate.",
      "Sun's out and the sky is clean, so the berry pickers are going to be busy.",
      'Clear as a bell over Jolene, good flying and good drying.',
      ['Clear and still this morning, with the far hills standing up sharp across the water.', 'morning'],
      ["Clear skies tonight, so it'll get cold, and the stars are worth a look.", 'evening'],
    ],
    fair: [
      'A few clouds drifting over, nothing to worry about, a fair day on the island.',
      'Mostly sunny, with a few puffy clouds parked over the hills.',
      "Sun and cloud are taking turns today, and the sun's winning for now.",
      'Fair weather out there, a little cloud over the ridge and plenty of blue.',
      "A bit of cloud coming and going, but it's a good day to be outside.",
      'Some cloud about, but the pretty kind you only notice because it catches the light.',
      ['A fair start this morning, with a few clouds sitting over the point.', 'morning'],
      ["Patches of cloud this evening, and there's a nice light on the water down at the dock.", 'evening'],
    ],
    cloudy: [
      "Plenty of cloud over us today, but it's high and dry for now.",
      "The clouds have moved in and the sun's playing hide and seek.",
      "It's turned cloudy, so if you left anything out on the line, keep an eye on it.",
      'A good lid of cloud over the island, but nothing falling out of it yet.',
      'Cloudy skies, the light is a bit flat, but the hills are still showing.',
      "More cloud than sky right now, but it's holding together nicely.",
      ["Clouds rolled in overnight, so it's a grey start, but a dry one.", 'morning'],
      ['Cloud piling up over the mountains this afternoon, so keep a jacket handy.', 'afternoon'],
    ],
    grey: [
      'Grey skies over Jolene, a proper lid on the day.',
      "It's grey from one end of the island to the other, which is to say, normal.",
      'Overcast and quiet out there, the kind of day the gulls complain about.',
      'A solid grey sky, so the coffee pot at the cafe will be working hard.',
      'Grey and still, good weather for indoor chores and long stories.',
      'Overcast all round, and the hills have got their hats on.',
      ['Grey start to the morning, and it looks like it means to stay.', 'morning'],
      ["Grey skies this evening, so settle in, there's nothing to see up there.", 'evening'],
    ],
    low: [
      "The cloud's down low today, sitting right on the trees above the harbour.",
      "Low cloud hanging over the island, and you can't see the top of the hill.",
      'The cloud is down on the ridge, so the high strips are socked in.',
      'Cloud sitting low and heavy, and the mountains across the Sound have gone missing.',
      "Low grey cloud wrapped around the hills, it's a day for staying low.",
      "The cloud's come right down to the water's edge on the far side.",
      ['Low cloud this morning, sitting on the trees like it pays rent.', 'morning'],
      ["Low cloud tonight, and it'll be dark early, so take a flashlight to the hall.", 'evening'],
    ],
    mist: [
      "A bit of haze on the water, the far shore's gone soft and blurry.",
      "It's misty out there, you can see the point but not much past it.",
      "There's a damp haze hanging over the Sound, everything has gone a little grey.",
      'Hazy and soft out there, the islands across the way are just shapes.',
      'A light mist around the harbour, and the boats look like a painting.',
      "The haze is cutting the view down, so take it easy on the water.",
      ["Mist lying in the low spots this morning, it'll burn off if the sun shows up.", 'morning'],
      ['Mist settling in this evening, so drive the harbour road slow.', 'evening'],
    ],
    fog: [
      "Fog's sitting thick in the narrows, you can hear the gulls but you can't see them.",
      'We are fogged in, folks, I can barely see the fuel dock from the hall window.',
      "Thick fog over the harbour, so if you're flying, give it till it lifts.",
      'The fog came in quiet, and it looks like it has settled in for a while.',
      'Pea soup out there, you could lose a skiff a stone throw off the float.',
      "Fog all round the island, and the horn at the point is earning its keep.",
      ["Fog's sitting in the narrows this morning, so if you're flying, give it till noon.", 'morning'],
      ["Fog rolling in tonight, so if you're out on the water, come on home.", 'evening'],
    ],
    rain: [
      "It's coming down out there, proper island rain, the sideways kind.",
      "Rain has settled in good, and the gutters at the hall are singing.",
      'Wet and windy as this weather comes through, so stay in if you can.',
      "Heavy rain right now, and the creek is going to be running high.",
      "We're getting a good soaking, so if you've got a leaky roof, now you know where.",
      'Rain blowing across the harbour in sheets, a good day to mend things indoors.',
      ['Rain on the windows this morning, so put the kettle on and stay put.', 'morning'],
      ['A wet night coming down, so tie things down and bring the dog in.', 'evening'],
    ],
  },
  wind: {
    calm: [
      'Hardly a breath of wind, the flag at the post office is just hanging there.',
      'No wind to speak of, the smoke from the smokehouse is going straight up.',
      "Dead calm on the water, a good day to paint the boat if you've been putting it off.",
      "The wind's taken the day off, and I don't blame it.",
      'Not a ripple in the harbour, the water is like glass.',
      'Calm as can be, you can hear a screen door shut clear across the cove.',
      'Still air today, so the mosquitoes will be out, bring the good spray.',
    ],
    light: [
      'Just a light breeze, enough to keep the bugs moving.',
      "A gentle wind off the water, nothing that'll bother a skiff.",
      "Light winds, the kind that's nice on the face and easy on the boats.",
      'A little breeze coming through, and the wind chimes at the store are going.',
      'Easy winds today, a fine day for a paddle.',
      'The breeze is light and steady, good for the drying racks.',
      'A soft little wind, just enough to ruffle the water in the cove.',
    ],
    breezy: [
      "A good fresh breeze out there, and there's a bit of chop past the point.",
      'Breezy today, so hang onto your hat on the float plane dock.',
      "There's some wind about, whitecaps starting out in the Sound.",
      'A fresh wind blowing through, your laundry will be dry in an hour.',
      'Breezy enough that the gulls are flying sideways.',
      'A steady breeze, so small boats will want to keep to the lee side.',
      "There's a brisk wind off the water, so button up your jacket at the dock.",
    ],
    windy: [
      "It's properly windy out there, the trees on the ridge are bending.",
      'Strong winds today, so check your lines and tie down anything that flaps.',
      "A stiff wind blowing, and the Sound's all whitecaps.",
      'Windy enough to blow the lid off a garbage can, and it did, at the hall.',
      'Big wind today, small boats should think twice before heading out.',
      "Strong wind coming over the weather side, and the harbour's lumpy.",
      'The wind has some muscle to it today, the spruce trees are complaining.',
    ],
    gale: [
      "It's blowing a gale out there, and nobody should be on the water.",
      'Gale force winds, folks, stay off the Sound and keep the kids in.',
      "It's howling, the whole island is rattling, so tie down and stay in.",
      "The wind's screaming over the ridge, and the float plane is staying put today.",
      "A real gale blowing, the barge won't move in this, and neither should you.",
      "Heavy wind out there, if it's not tied down it'll be on the mainland by lunch.",
      'The wind is roaring through the narrows, nobody crosses today, nobody.',
    ],
  },
  gusty: [
    "It's gusty too, so expect a shove now and then.",
    'The gusts come through in bursts, so mind your boat lines.',
    'The gusts are the tricky part today, they come out of nowhere.',
    "It's gusty around the point, so take it slow if you're crossing.",
  ],
  advice: {
    fogPilot: [
      "Pilots, don't try to sneak in under this fog, the hills are in there somewhere.",
      "If you're flying, wait it out, the fog will lift and the island will still be here.",
      'Fog on the strips, so floats and wheels alike, stay on the ground for now.',
    ],
    fogBoat: [
      "Skiffs, go slow in the narrows and keep your horn handy.",
      "If you're out on the water, hug the shore and listen for the point.",
      'Boaters, the fog is thick, so run your lights even in the middle of the day.',
    ],
    windBoat: [
      "Small boats should stay tied up, it's not worth it today.",
      "If you're on the water, check your bilge pump and head for the harbour.",
      'Gus asks everyone to double up their lines on the float today.',
    ],
    windPilot: [
      "Pilots, there's a nasty crosswind on the gravel strips, so think it over.",
      "If you're flying, expect it bumpy over the ridge and sloppy on landing.",
      "Jim at Blue Heron says he's not flying in this, and he flies in everything.",
    ],
    softStrip: [
      'After this rain, Tamgas Hill strip will be soft, so land uphill and take off downhill.',
      'The gravel strips will be mushy after the rain, so mind your wheels.',
      'East Point clearing goes soft in the wet, give it a day before you land there.',
    ],
    eagles: [
      'The eagles are back on the runway at the field, so give them a low pass before you land.',
      "Pilots, there's an eagle sitting on the field like he owns it, so buzz him first.",
      'Eagles are feeding on the beach by the strip, so watch for them on your approach.',
    ],
    frost: [
      'Mind the frost on the float plane dock, those boards get slick.',
      'Cold enough for ice on the boardwalk, so walk like a penguin.',
      'Cold out there, so plug in your engine heater before you try to start it.',
    ],
  },
  outlook: {
    front: [
      'There is weather on the way, so get your errands done before it gets here.',
      'A front is coming in later, expect the wind to pick up and the rain to follow.',
      "Looks like a change is coming, the sky over the mainland's gone dark.",
      'Weather is moving in, so if the barge is due, it might be late.',
    ],
    easing: [
      "The worst of it should pass, and it'll ease off behind this front.",
      "It's clearing up behind the weather, so things should settle down.",
      'This front is moving through, and by and by the wind will drop.',
      "This blow's on its way out, and the sky is already lightening in the west.",
    ],
  },
  feel: {
    cold: [
      "It's cold, folks, so put a hat on, your mother would want you to.",
      'Chilly out there, a good day for soup at the Copper Kettle.',
      'A bit of a bite in the air, so bundle up the kids for the walk to school.',
    ],
    mild: [
      "Warm for the island, shirt sleeves weather if you're brave.",
      'Mild and pleasant, the kind of day you remember in January.',
      "Nice and warm out, and the bees at Marty's place are out working.",
    ],
  },
};

// ---- THE STORY THREADS (each step a segment; the steps advance in order) ----------------------------------------------
// [voice, text] turns; a plain string is Norman. A step with several turns is a call-in, the recorded message or the
// interview (cat says which). target: the break the step aims for (the scheduler keeps the order and the spacing).
const T = (cat, target, turns) => ({ cat, target, turns: Array.isArray(turns) ? turns : [turns] });
const THREADS = {
  dog: [
    T('lost', 1, "Here's one for the lost and found. Biscuit, the Pruitt kids' dog, slipped his collar last night down by the laundry. He's a scruffy brown fellow with one ear up and one ear down. He answers to Biscuit, and to the sound of a sandwich being unwrapped. If you see him, call the laundry, or just tell Tommy and Jess. Those kids are worried sick."),
    T('call', 8, [
      'We have Bobby Tran on the line, calling from the fish plant. Go ahead, Bobby, you are on the air.',
      ['bobby', "Hey there, Norman, good morning. I think I saw the Pruitts' dog this morning, behind the fish plant. Brown, one floppy ear, real interested in our garbage. He took off toward the old cannery before I could grab him."],
      "Thanks, Bobby, that's good news. So Biscuit was down by the old cannery, folks. If you're out that way, bring a sandwich.",
    ]),
    T('thanks', 15, "Good news from the Pruitt house. Biscuit is home, safe and sound. Pearl Whitaker found him asleep on a pile of life jackets at the Swap Shed. She says he didn't even pretend to be sorry. Tommy and Jess want to thank everyone who looked. Biscuit has a new collar, and a new interest in staying home."),
  ],
  fair: [
    T('event', 2, "Mark your calendars, folks. The fall fair is a week from Saturday at the community hall. There'll be the pie table, the craft tables, the fire department's chowder, and the kids' boat races at the harbour. If you want a table, see Lorna at the Copper Kettle. She's got the list, and she's got opinions about where you go."),
    T('event', 7, "A word about pies. The fair's pie contest needs bakers, and Mae Holloway is defending her title for the fourth year running. Somebody has to stop her. Drop your name with Lorna at the cafe. Store bought pies will be spotted, and gently mocked."),
    T('interview', 13, [
      "I've got Chief Walt Brennan here in the studio, which is to say the back room, before the fair on Saturday. Walt, thanks for coming in.",
      ['walt', 'Happy to be here, Norman. Any excuse to sit in a chair that does not have a pager on it.'],
      'The fire department is running the chowder table again this year?',
      ['walt', "We sure are, Norman. Danny's making his mother's recipe, and he's sworn us all to secrecy."],
      "And I hear you're bringing the engine down for the kids?",
      ['walt', "We'll park the engine by the hall, and the kids can climb all over it, within reason."],
      'Anything folks should know before they come?',
      ['walt', "Bring a camp stove for the food tables if you like, but keep a bucket of water handy. And we would love a few more volunteers this winter."],
      'What does a new volunteer need to bring?',
      ['walt', 'Boots, a good attitude, and your Tuesday evenings free. We train you on everything else.'],
      'Chowder, a fire engine, and a standing invitation. Thanks for coming in, Walt.',
      ['walt', 'Thank you for having me, Norman. I will see everybody on Saturday.'],
    ]),
    T('event', 18, "The fair is this Saturday, folks. Doors open at the hall at ten. The boat races start when the tide's right, and the chowder runs out when it runs out. Bring a chair, bring a dollar for the raffle, and bring your cousin."),
    T('thanks', 25, "Now that was a fair. Thank you to everyone who came out Saturday. The chowder was gone by one, and the raffle raised enough for the new hall stove. Mae Holloway won the pie contest again, and that makes four. Next year we're hiring a lawyer. Thanks to Lorna for running the tables, and to the fire department for the chowder and the patience."),
  ],
  boardwalk: [
    T('work', 3, "Calling all hands, folks. The boardwalk out to the float plane dock has some soft boards, and one of them nearly ate my boot yesterday. Work party Saturday morning after the tide turns. Bring a hammer, bring gloves, and bring a thermos. I'll bring the doughnuts, and the bad jokes come free."),
    T('work', 9, "Update on the boardwalk. Frank Olsen at the sawmill has cut us a stack of good cedar, and he wouldn't take a dime for it. Thank you kindly, Frank. The lumber is at the head of the boardwalk under a tarp, so please don't borrow it for your woodshed."),
    T('thanks', 16, "The boardwalk's done, and you can walk to the float plane dock without saying a prayer. Thank you to everyone who showed up. That's Lyle and Ruth Ann Moss, Danny Kessler, the Pruitts, Pete Navarro and Bobby Tran. And Nadia Kowalski, who drove more nails than anybody. Also me, I held the doughnuts."),
  ],
  barge: [
    T('barge', 4, "A word from the harbour. The barge is running late with this weather, and Gus Lindgren says it won't leave town until things settle. If you're waiting on freight, or on that new refrigerator, sit tight. The store has enough milk to get us through, June says, if we don't all panic at once."),
    T('barge', 10, "The barge is on its way, folks, and it should tie up at the harbour tomorrow on the morning tide. Sam Whitcomb asks that everyone keep their trucks off the main dock while they unload. Fuel deliveries go first, then freight, then that refrigerator."),
    T('thanks', 14, "The barge is in and unloaded, and nobody dropped anything in the harbour this time. Thanks to Sam Whitcomb and the dock crew for a long cold day's work. If you had freight coming, it's at the warehouse behind the store. Ray says bring something with your name on it."),
  ],
  skiff: [
    T('call', 5, [
      "We've got Carl Jensen on the line. Go ahead, Carl, you're on Radio Jolene.",
      ['carl', "Hi there, Norman, thanks for taking my call. My skiff slipped her line at high tide last night, and she's gone. She's a green fourteen footer with a white stripe and a bad attitude. If anybody sees her, give me a shout at the boat works."],
      "A green skiff with a white stripe, folks. Keep your eyes peeled along the beaches. We'll find her, Carl.",
    ]),
    T('lost', 11, "An update on Carl Jensen's skiff. Jim Corrigan spotted her from the air, sitting high and dry on the beach past the point. She's upside down, but she's in one piece. Carl's headed out there with Lyle Moss to flip her back over. Nice eyes, Jim Corrigan."),
    T('thanks', 17, "Carl Jensen's skiff is back on her mooring, with a new line and a very firm talking to. Carl wants to thank Jim for spotting her, and Lyle for the tow. And Kari at the boat works, for patching the hole nobody's going to talk about."),
  ],
  cat: [
    T('lost', 6, "Elsie Ward's cat Pickles has gone missing. He's a big orange tabby with a white chin, and he thinks he's in charge of the whole harbour road. If you see him, he likes to be talked to like a grown man. Let Elsie know, or leave a note at the store."),
    T('thanks', 12, "Pickles has been found. Earl Tibbets opened the storeroom this morning and there he was, asleep on the flour sacks like a king. Elsie is very relieved, and Earl is checking the flour."),
  ],
  fiddle: [
    T('event', 19, "Fiddle night is coming to the hall. Otis Bell is getting out the fiddle again, and his granddaughter Lucy is bringing her guitar. Friday evening after supper, no charge, cookies welcome. Otis says he'll take requests, as long as they're songs he already knows."),
    T('event', 23, "A reminder that it's fiddle night at the hall tonight. Otis and Lucy Bell start after supper, and the chairs are already out. Bring something sweet for the table and something warm to wear, that hall takes a while to heat up."),
    T('thanks', 27, "Thank you to Otis and Lucy Bell for a lovely fiddle night. A full hall, two encores, and not one cookie left. Lucy played a song she wrote herself, and I saw a few hard old fishermen reaching for their hankies. I was not one of them, probably."),
  ],
  play: [
    T('school', 20, "Now some news from the school. Helen Brandt's students are putting on a play at the hall, about the first winter on the island. All fourteen kids are in it, and Helen says that includes the ones who aren't speaking to each other this week. Next Thursday evening, everybody welcome."),
    T('school', 24, "The school play needs costumes, folks. Helen Brandt is looking for old coats and wool hats. Anything that looks like it came over on a boat a long time ago. Elsie Ward is already knitting, which means the kids will be warm whether the play is good or not. Drop things at the school."),
    T('thanks', 29, "The school play was a hit. Fourteen kids, one long winter, and only one scarf caught on fire, very briefly, by the lantern prop. Chief Brennan says that's a record. Well done to Helen Brandt and the kids. Somebody please give Jess Pruitt an award for her bear."),
  ],
  doctor: [
    T('clinic', 21, "Some news from the clinic. The visiting doctor is coming over on Blue Heron next week, for two days. If you need to be seen, sign up with Rosa Delgado at the clinic. She says that means you too, Wendell, and she knows about the knee."),
    T('clinic', 26, "A reminder that the doctor is at the clinic today and tomorrow. There are still a few spots open, so if you've been putting something off, now's the time. Rosa says bring your list of medicines, or at least the bottles."),
  ],
  books: [
    T('library', 22, "Marjorie Fisk at the library is having a book sale on Saturday, upstairs over the store. Paperbacks a quarter, hardbacks a dollar, and the mystery shelf is overflowing. The money goes to new shelves, because the old ones are leaning like the dock pilings."),
    T('call', 28, [
      'I have Marjorie Fisk on the line, from the library. Go ahead, Marjorie, you are on the air.',
      ['marjorie', "Hello there, Norman, thank you. I just wanted to say thank you to everyone who came to the book sale. We sold almost everything, and we raised enough for two new shelves. And whoever bought all the westerns, I know it was you, Wendell."],
      "Thank you kindly, Marjorie. I'll be in for a mystery next week, and I won't say which one.",
    ]),
  ],
  burnban: [
    T('officer', 0, [
      'Officer Hale dropped off a message for us, so here it is in her own words.',
      ['dana', "This is Officer Dana Hale, for the fire department. It's been a dry spell, so there is a burn ban on the whole island until further notice. That means no beach fires and no burning brush. Smokehouses are fine if you keep a hose close by. Thanks for looking out for each other."],
    ]),
    T('fire', 12, "Good news from the fire hall. With all this rain, Chief Brennan has lifted the burn ban. Beach fires are back, as long as they're small, watched, and out before you go home. The chief asks that nobody burn anything that used to be a couch."),
  ],
  volunteer: [
    T('fire', 6, "The fire department has a training night this Tuesday at the fire hall. If you've ever thought about volunteering, come and watch. Danny Kessler will show you the pump, and Ruth Ann Moss will show you the paperwork. The chief will show you where the coffee is."),
    T('fire', 20, "Please welcome the fire department's newest volunteer, Nadia Kowalski. She passed her first training night, she rolled a hose faster than Danny, and she has asked us not to tell him. Danny, she's faster than you. Welcome aboard, Nadia, we're glad to have you."),
  ],
  boots: [
    T('lost', 9, "Found on the main dock, a pair of red rubber boots, ladies size, nearly new. Gus has them in the harbour office. Whoever walked home without their boots, I'd love to hear the story."),
    T('call', 19, [
      'Wendell Price is on the line now. Go ahead, Wendell, you are on the air.',
      ['wendell', "Norman, those red boots at the harbour office are mine. They're not ladies boots, they're just red. My wife bought them. Tell Gus I'll be by for them, and tell him to stop laughing."],
      "Thanks for calling, Wendell. The red boots have an owner, and the owner has his dignity, mostly.",
    ]),
  ],
  ada: [
    T('notice', 18, "Ada Thorne turns ninety on Sunday. Ninety years on this island, and she still walks to the store every morning. There's a card at the counter of the Tibbets store for everyone to sign, and June says there'll be cake. Don't tell Ada about the cake."),
    T('call', 24, [
      'We have a very special caller. Ada Thorne is on the line. Happy birthday to you, Ada.',
      ['ada', "Oh, thank you, Norman dear. I just wanted to thank everybody for the card, and the cake, and all the visits. Ninety is nothing special, you just keep waking up. But it was lovely, and I'm keeping the leftover cake."],
      "You've earned it, Ada. Happy birthday from all of us at Radio Jolene.",
    ]),
  ],
};

// ---- THE STANDALONE NOTICES (no thread; placed where a break has room) ------------------------------------------------
const NOTICES = [
  ['bingo', "Bingo at the hall Wednesday night, folks. Agnes Cole is calling, cards are a dollar, and the big prize this week is a whole smoked salmon from Kessler's. Agnes asks that everyone please stop yelling bingo when it isn't."],
  ['bingo', "A reminder that bingo is on again Wednesday at the hall. Last week Wendell won three times in a row, and there's been an inquiry. Agnes promises a fresh deck of cards and a very close eye."],
  ['harbour', "A word from Gus at the harbour. There's a big log drifting around the channel past the fuel dock, mostly under water. If you're running the channel, keep a sharp eye out, and slow down."],
  ['harbour', "Gus Lindgren asks everyone to keep the end of the main float clear. That's where the float plane ties up, and Jim doesn't want to land on your crab pots."],
  ['harbour', "The fuel dock will be closed Monday morning while Sid Mercer fixes the pump. He says it'll be open by noon, and if not, by the time he says it'll be open."],
  ['berries', "Here's the berry report for you. The salmonberries are out along the creek trail, and they're good this year. Please leave some for the bears, and please make some noise while you pick. They're not great with surprises."],
  ['bees', "Marty Shaw tells me his bees made more honey than he can eat this year, which nobody believed was possible. He's got jars at the store, and he says they taste like fireweed and stubbornness."],
  ['fire', "A reminder from the fire department. Smoke alarm batteries are free at the fire hall, all you have to do is come and ask. Chief Brennan says if your alarm is chirping, it is not a bird."],
  ['fire', "Chimney season is coming, folks. If you burn wood, get your chimney swept before the first cold snap. Danny Kessler has the brushes, and he'll do it for a pot of coffee and the story of your last chimney fire."],
  ['clinic', "Flu shots are in at the clinic. Rosa Delgado is giving them every afternoon this week. It takes two minutes, it doesn't hurt much, and she has lollipops, which are not only for the kids."],
  ['library', "Story hour at the library is Saturday morning. Nadia Kowalski is reading, and she does all the voices. The little ones are welcome, and so are the big ones who still like being read to."],
  ['lost', "From the lost and found. A single oar, found floating off the boat ramp. If you've been rowing in circles, this might be why. It's at the harbour office with Gus."],
  ['thanks', "A thank you from Ada Thorne to whoever stacked a cord of firewood by her porch last week. You left without a word. She knows who you are, she says, and she's baking you a pie anyway."],
  ['thanks', "A big thank you to the school kids who cleaned up the beach by the boat ramp. Three bags of garbage, two old tires, and one very confused crab, returned to the water."],
  ['smokehouse', [
    "I've got Bev Kessler on the line from the smokehouse. Go ahead, Bev, you're on.",
    ['bev', "Hi there, Norman, how are you. I just want folks to know the big smokehouse has room this week, if you've got fish you want smoked. Bring it cleaned, bring your own salt if you're particular, and I'll take care of the rest."],
    "Thanks for that, Bev. Room at the smokehouse, folks, and nobody does it better.",
  ]],
  ['pancakes', [
    'Ruth Ann Moss is calling from the fire hall. Go ahead, Ruth Ann.',
    ['ruthann', "Good morning to you, Norman. Just a reminder that the fire department pancake breakfast is Sunday at the fire hall. It's all you can eat, and the money goes to the new pump. Walt is flipping, so come early before he gets tired."],
    'Pancakes, a good cause, and the chief with a spatula. See you there, Ruth Ann.',
  ]],
  ['officer', [
    'Officer Hale asked me to play this one, so listen up.',
    ['dana', "This is Officer Dana Hale. A black bear has been visiting the dump after dark. Please keep your garbage inside until pickup day, and don't feed him, even by accident. If you see him in the village, give him room and let me know. Thank you, and stay safe out there."],
  ]],
  ['officer', [
    'A recorded message from Officer Hale.',
    ['dana', "Officer Dana Hale here. A reminder that four wheelers don't belong on the boardwalk, it's for feet and wheelbarrows. And on the harbour road, slow right down by the school, the little ones walk there every morning. I would rather wave at you than write you up."],
  ]],
];

// ---- THE BUSINESSES AND THE AD GRAMMAR --------------------------------------------------------------------------------
// An ad = an opener + what they sell + a local gimmick + a closing line, generated from each business's row, then
// polished by hand where a line reads stiff (POLISH replaces a generated ad by its key, word for word).
const BIZ = [
  { key: 'store', name: 'Tibbets Island Store', who: 'Earl and June', sells: ['groceries, hardware, fishing line and birthday cards', 'fresh bread on barge days and frozen everything the rest of the week'],
    gimmick: ["If they don't have it, Earl will tell you a story about the time they did.", 'June keeps a jar of dog biscuits on the counter, and the dogs of Jolene know exactly where it is.'],
    close: ['Tibbets Island Store, open every day but Christmas.', 'The Tibbets store, on the harbour road, where everybody ends up eventually.'] },
  { key: 'cafe', name: 'the Copper Kettle', who: 'Lorna Beck', sells: ['soup, coffee, and the best halibut sandwich on the island', 'pie by the slice, and pie by the whole pie if you ask nicely'],
    gimmick: ["Lorna's soup of the day is whatever the boats brought in, and it's always good.", 'The coffee is strong enough to stand a spoon in, and Lorna will refill it until you beg.'],
    close: ['The Copper Kettle, warm inside, whatever it is doing outside.', 'Come hungry to the Copper Kettle, and tell Lorna Norman sent you, she will charge you extra.'] },
  { key: 'fuel', name: 'Harbour Fuel and Tackle', who: 'Sid Mercer', sells: ['gas, diesel, outboard oil and bait', 'hooks, lures, rain gear, and ice by the bag'],
    gimmick: ['Sid will tell you where the fish are biting, and he is right about half the time.', "Sid's got the only pump on the island that gives you a weather forecast for free."],
    close: ['Harbour Fuel and Tackle, at the end of the main float.', 'Fill up with Sid at Harbour Fuel and Tackle, and mind the new float on the north side.'] },
  { key: 'boatworks', name: 'Lindgren Boat Works', who: 'Kari Lindgren', sells: ['outboard repair, hull patching and winter storage', 'new props, old props, and props you did not know you needed'],
    gimmick: ["Kari can hear what's wrong with your motor from across the harbour.", 'Bring your skiff in for a check before the storms, and Kari will tell you the truth, gently.'],
    close: ['Lindgren Boat Works, by the ramp, look for the upside down boats.', 'Lindgren Boat Works, keeping Jolene afloat.'] },
  { key: 'air', name: 'Blue Heron Air', who: 'Jim Corrigan', sells: ['charter flights to town and back, freight and passengers', 'sightseeing over the island, and mail runs when Ray asks nicely'],
    gimmick: ["Jim has landed on every stretch of water within an hour of here, and most of them on purpose.", 'Book a flight with Jim, and he will point out every whale, eagle and cousin on the way.'],
    close: ['Blue Heron Air, from the float plane dock, weather permitting.', 'Fly Blue Heron Air, and see the island the way the eagles do.'] },
  { key: 'smokehouse', name: "Kessler's Smokehouse", who: 'Bev Kessler', sells: ['smoked salmon, smoked black cod, and jerky for the trail', 'custom smoking for your own catch, cleaned and ready'],
    gimmick: ["Bev's been smoking fish since before the store had a freezer.", 'The smoke from Bev\'s place is the best smell on the harbour road, and that is not even close.'],
    close: ["Kessler's Smokehouse, follow your nose.", "Kessler's Smokehouse, on the creek road, open when the smoke is going."] },
  { key: 'mill', name: 'Head of the Bay Lumber', who: 'Frank Olsen', sells: ['rough cut cedar and spruce, cut to order', 'firewood by the cord, split and delivered'],
    gimmick: ["Frank will cut you exactly what you ask for, and then tell you what you should have asked for.", 'Every board from Frank\'s mill comes with a free lecture on grain.'],
    close: ['Head of the Bay Lumber, at the sawmill, listen for the saw.', 'Head of the Bay Lumber, building Jolene one board at a time.'] },
  { key: 'swap', name: 'the Swap Shed', who: 'Pearl Whitaker', sells: ['used tools, kitchen things, books, and the odd treasure', 'winter coats and boots for the whole family'],
    gimmick: ['Nothing costs money at the Swap Shed, you bring a thing and you take a thing.', 'Pearl knows the history of every object in the place, so allow extra time.'],
    close: ['The Swap Shed, at the old cannery, Saturdays and whenever Pearl is around.', 'The Swap Shed, because one person\'s junk is another person\'s spare part.'] },
  { key: 'laundry', name: 'Big Spruce Laundry and Showers', who: 'Hank and Darlene Pruitt', sells: ['washers, dryers, and hot showers by the quarter hour', 'soap, towels, and a warm place to wait out the rain'],
    gimmick: ['The dryers are the warmest seat on the island, and Darlene has a couch for the long loads.', 'Come in off the boat, get clean, and leave the fish smell with Hank.'],
    close: ['Big Spruce Laundry and Showers, by the harbour.', "Big Spruce Laundry and Showers, you'll smell like a person again."] },
  { key: 'engine', name: "Pete's Small Engine", who: 'Pete Navarro', sells: ['chainsaws, generators, and lawn mowers, fixed and tuned', 'parts, plugs and blades for anything with a pull cord'],
    gimmick: ["If it's got a pull cord and it won't start, Pete has heard it before.", 'Pete fixes it right the first time, and he only sighs a little.'],
    close: ["Pete's Small Engine, behind the fire hall.", "Pete's Small Engine, because winter is coming and your generator knows it."] },
];
// one ad per business, a second for the ones the island uses every day (the voice budget: about 12 MB in all)
const SECOND_AD = {};
const AD_OPEN = [
  'Here is a word from {name}.',
  'This part of the show comes to you from {name}.',
  'Radio Jolene is brought to you by good neighbours, like {name}.',
  'A few words now for {name}.',
  'And now, a message from our friends at {name}.',
];
// hand-polished ads (the evidence's three samples are among them)
const POLISH = {
  'ad.cafe.1': "A few words now for the Copper Kettle. Lorna Beck has soup, coffee, and the best halibut sandwich on the island. Her soup of the day is whatever the boats brought in, and it's always good. The Copper Kettle, warm inside, whatever it's doing outside.",
  'ad.engine.1': "Here's a word from Pete's Small Engine. Pete Navarro fixes chainsaws, generators and lawn mowers, and he tunes them too. If it's got a pull cord and it won't start, Pete has heard it before. Pete's Small Engine, behind the fire hall, because winter is coming and your generator knows it.",
  'ad.air.1': "This part of the show comes to you from Blue Heron Air. Jim Corrigan flies charters to town and back, freight and passengers. Jim has landed on every stretch of water within an hour of here, and most of them on purpose. Blue Heron Air, from the float plane dock, weather permitting.",
};
const lowerFirst = s => s.charAt(0).toLowerCase() + s.slice(1);
const upperFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
function adText(b, n, r) {
  const open = AD_OPEN[(n + Math.floor(r() * AD_OPEN.length)) % AD_OPEN.length].replace('{name}', b.name);
  const verb = /^[A-Z].* and [A-Z]/.test(b.who) ? 'have' : 'has';
  return upperFirst(open) + ' ' + b.who + ' ' + verb + ' ' + b.sells[n % b.sells.length] + '. ' + b.gimmick[n % b.gimmick.length] + ' ' + b.close[n % b.close.length];
}

// ---- THE BACK-ANNOUNCES -------------------------------------------------------------------------------------------------
// several phrasings per Radio Jolene track (BA_ROOTS), one per track elsewhere (the fallback stations' tracks), each a
// whole take; the title SAID as a person would (voice_script.json 'titles' - the store-listing words dropped)
const BA_FRAMES = [
  'That was {A}, {T}. A lovely one, that.',
  '{T}, from {A}. I could leave that one on all day.',
  "You've been listening to {A}, with {T}.",
  'That one was {T}, by {A}. Good music for mending nets.',
  '{A} there, playing {T}. Somebody turn that up next time.',
  'That was {T}, everybody, from {A}.',
  '{T}, by {A}. That one always slows me down, in a good way.',
  'Before I forget, that was {A} with {T}.',
  "That was {A}, and the tune was {T}, and that one's a keeper.",
  'That was {A}, {T}. My dog likes that one, so it stays on the list.',
  "That's {T}, from {A}, here on Radio Jolene.",
  'Nice and easy, that was {T}, by {A}.',
  'That was {T}, from {A}. Put the kettle on for that one.',
  '{A} with {T}, for everyone out on the water.',
  'That was {A}, and that was {T}. Hard to follow, but I will try.',
  'There it is, {T}, by {A}.',
  'A little {A} for you there, {T}.',
  'That was {A} just now, with {T}, and that was lovely.',
];
// a Radio Jolene track gets enough phrasings that two hours of breaks (one every TALK_EVERY tracks) never repeat one:
// at least BA_ROOTS, more when the station has few tracks (each is then announced more often)
const BA_ROOTS = 3, TALK_EVERY = 2, HORIZON_S = 2 * 3600, XFADE_S = 4;
// the other stations' tracks reach Radio Jolene only by the fallback (a context the station has no track for): one short take
const BA_SHORT = 'That was {T}, by {A}.';
// the spoken title: the store-listing words dropped ("Calming Royalty Free Guitar - "A Cloudy Life"" -> A Cloudy Life),
// a Goldberg variation said as a person would
function spokenTitle(t) {
  let s = String(t.title);
  const q = /"([^"]+)"\s*$/.exec(s); if (q) s = q[1];
  const gv = /Goldberg Variations[^:]*:\s*(.*)$/.exec(s);
  if (gv) {
    const v = /Variatio (\d+)/.exec(gv[1]);
    s = v ? 'Variation ' + numberWords(+v[1]) + ' of the Goldberg Variations' : /Aria da capo/.test(gv[1]) ? 'the Aria of the Goldberg Variations, played again' : 'the Aria of the Goldberg Variations';
  }
  s = s.replace(/,?\s*part (\d+)$/i, (m, d) => ', part ' + numberWords(+d));
  return s.replace(/[":;()\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function spokenArtist(a) {
  let s = String(a).replace(/\s*\(.*\)$/, '').trim();
  if (/^Kimiko Ishizaka/.test(a)) s = 'Kimiko Ishizaka, playing Bach';
  if (/^Benson Orchestra/.test(a)) s = 'the Benson Orchestra of Chicago';
  return s.replace(/HoliznaCC0/g, 'Holizna').replace(/^1000 Handz$/, 'A Thousand Hands');
}
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const numberWords = n => (n < 20 ? WORD[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + WORD[n % 10] : ''));

// ---- THE WRITING RULES (the generator refuses a line that breaks them; GATE AUDIO's RADIO_LINT holds them again) --------
const BANNED = /\b(zulu|niner|altimeter|knots?|statute|metar|awos|okta|hectopascals?)\b/i;
const DIGITW = '(?:zero|one|two|three|four|five|six|seven|eight|nine|niner)';
function lintText(text) {
  const F = [];
  if (/\d/.test(text)) F.push('a digit');
  if (/[:;()\[\]{}"“”‘—–\-\/\\*_#@&%]/.test(text)) F.push('a colon, semicolon, dash, bracket, quote or symbol');
  if (/\b[A-Z]{2,}\b/.test(text)) F.push('an acronym in capitals');
  if (BANNED.test(text)) F.push('an instrument word');
  if (new RegExp('\\b' + DIGITW + '[ ,]+' + DIGITW + '\\b', 'i').test(text)) F.push('two digit words in a row');
  // sentences: an initial (Matthew C. Wright) does not end one
  const body = text.replace(/\b([A-Z])\.\s+(?=[A-Z])/g, '$1 ');
  for (const s of body.split(/(?<=[.!?])\s+/)) {
    const w = s.trim().split(/\s+/).filter(Boolean).length;
    if (w < 4 || w > 22) F.push('a sentence of ' + w + ' words: ' + s.trim());
  }
  if (!/[.!?]$/.test(text.trim())) F.push('no closing stop');
  return F;
}

// ---- BUILDING THE SCRIPT ------------------------------------------------------------------------------------------------
function build() {
  const r = rng(SEED);
  const VS = JSON.parse(fs.readFileSync(SCRIPT, 'utf8'));
  const cat = fs.existsSync(MUSIC) ? JSON.parse(fs.readFileSync(MUSIC, 'utf8')) : [];
  const items = {}, segments = {}, threads = {}, problems = [];
  const item = (key, v, c, text, extra) => {
    if (items[key]) throw new Error('two items named ' + key);
    for (const p of lintText(text)) problems.push(key + ': ' + p);
    items[key] = Object.assign({ v, cat: c, text }, CALLERS[v] ? { phone: 1 } : {}, extra || {});
    return key;
  };
  // the station IDs
  const ids = {};
  for (const part in IDS) ids[part] = IDS[part].map((t, i) => item('id.' + part + '.' + (i + 1), 'norman', 'id', t));
  // the weather
  const wx = { lead: {}, wind: {}, gusty: [], advice: {}, outlook: {}, feel: {} };
  for (const sky in WX.lead) wx.lead[sky] = WX.lead[sky].map((x, i) => { const [t, part] = Array.isArray(x) ? x : [x, null];
    return item('wx.' + sky + '.' + (i + 1), 'norman', 'wx', t, part ? { part } : null); });
  for (const b in WX.wind) wx.wind[b] = WX.wind[b].map((t, i) => item('wx.wind.' + b + '.' + (i + 1), 'norman', 'wx', t));
  wx.gusty = WX.gusty.map((t, i) => item('wx.gusty.' + (i + 1), 'norman', 'wx', t));
  for (const h in WX.advice) wx.advice[h] = WX.advice[h].map((t, i) => item('wx.' + h + '.' + (i + 1), 'norman', 'wx', t));
  for (const o in WX.outlook) wx.outlook[o] = WX.outlook[o].map((t, i) => item('wx.' + o + '.' + (i + 1), 'norman', 'wx', t));
  for (const f in WX.feel) wx.feel[f] = WX.feel[f].map((t, i) => item('wx.' + f + '.' + (i + 1), 'norman', 'wx', t));
  // the back-announces: the spoken title map lives in voice_script.json ('titles', 'artists'); a track without one is
  // derived and written back, so the map is always whole and hand-editable
  VS.titles = VS.titles || {}; VS.artists = VS.artists || {};
  let added = 0;
  const ba = {};
  const roots = cat.filter(t => (t.station || 'lofi') === ROOTS), avg = roots.reduce((a, t) => a + t.durationS - XFADE_S, 0) / Math.max(1, roots.length);
  const perTrack = Math.max(BA_ROOTS, Math.ceil(HORIZON_S / avg / TALK_EVERY / Math.max(1, roots.length) * 1.4));
  cat.forEach((t, ti) => {
    if (VS.titles[t.id] == null) { VS.titles[t.id] = spokenTitle(t); added++; }
    if (VS.artists[t.artist] == null) { VS.artists[t.artist] = spokenArtist(t.artist); added++; }
    const T0 = VS.titles[t.id], A0 = VS.artists[t.artist], isRoots = (t.station || 'lofi') === ROOTS, n = isRoots ? perTrack : 1;
    ba[t.id] = [];
    for (let k = 0; k < n; k++) {
      const f = isRoots ? BA_FRAMES[(ti * 7 + k * 5) % BA_FRAMES.length] : BA_SHORT;
      ba[t.id].push(item('ba.' + t.id + '.' + (k + 1), 'norman', 'ba', upperFirst(f.replace('{T}', T0).replace('{A}', A0)), { track: t.id }));
    }
  });
  // a segment from turns (a plain string is Norman)
  const seg = (id, c, turns, th, st) => {
    const keys = turns.map((x, i) => { const [v, t] = Array.isArray(x) ? x : ['norman', x];
      return item(turns.length > 1 ? id + '.' + String.fromCharCode(97 + i) : id, v, c, t); });
    segments[id] = Object.assign({ cat: c, items: keys }, th ? { th, st } : {});
    return id;
  };
  // the threads
  const steps = [];
  for (const th in THREADS) {
    threads[th] = THREADS[th].map((s, i) => { const id = seg('th.' + th + '.' + (i + 1), s.cat, s.turns, th, i + 1); steps.push({ id, th, i, target: s.target }); return id; });
  }
  const notices = NOTICES.map(([k, x], i) => seg('nt.' + k + '.' + (i + 1), Array.isArray(x) ? (k === 'officer' ? 'officer' : 'call') : k, Array.isArray(x) ? x : [x]));
  const asides = [];
  // the ads: two per business from the grammar (POLISH replaces by key)
  const ads = [];
  BIZ.forEach(b => { for (let n = 0; n < (SECOND_AD[b.key] ? 2 : 1); n++) { const key = 'ad.' + b.key + '.' + (n + 1); ads.push(seg(key, 'ad', [POLISH[key] || adText(b, n, r)])); } });
  const program = schedule(r, steps, notices, ads, asides, segments);
  if (added) fs.writeFileSync(SCRIPT, JSON.stringify(VS, null, 1) + '\n');
  // the items no break plays and no pool holds are not rendered
  const used = new Set();
  for (const b of program) for (const t of b) if (segments[t]) for (const k of segments[t].items) used.add(k);
  for (const k in items) if (/^(id|wx|ba)\./.test(k)) used.add(k);
  const kept = {}; for (const k in items) if (used.has(k)) kept[k] = items[k];
  const segs = {}; for (const s in segments) if (segments[s].items.every(k => kept[k])) segs[s] = segments[s];
  return { problems, script: {
    about: "Radio Jolene's broadcast (SND-RADIO-3, G1700-G1702), written by tools/audio/radio_gen.js from the bible (tools/audio/radio_bible.md) - do not edit by hand: edit the generator and re-run it, then tools/audio/prep_voice.js.",
    seed: SEED, voices: VOICES, items: kept, segments: segs, threads,
    pools: { id: ids, wx, ba }, program } };
}

// ---- THE SCHEDULE: the program of breaks -----------------------------------------------------------------------------
// Each break: the back-announce, one to three segments, sometimes the weather, sometimes a station ID - never the same
// shape twice in a row. The threads' steps keep their order and at least two breaks between steps; an ad every break or
// two (never the same business twice running); call-ins and the officer spread out; the notices fill the rest.
function schedule(r, steps, notices, ads, asides, segments) {
  const B = BREAKS, cap = [], slot = Array.from({ length: B }, () => []);
  for (let b = 0; b < B; b++) cap[b] = 2 + (r() < 0.12 ? 1 : 0);
  // the threads, in target order; the interview is a break of its own
  const placed = {};
  for (const s of steps.slice().sort((a, b) => a.target - b.target || a.i - b.i)) {
    const prev = s.i ? placed[s.th + '.' + (s.i - 1)] : -9;
    let b = Math.max(s.target, prev + 2);
    const ok = x => x < B && slot[x].length < cap[x] && !slot[x].some(id => segments[id].cat === 'interview') &&
      (segments[s.id].cat !== 'interview' || !slot[x].length) && slot[x].filter(id => segments[id].th).length < 2;
    while (b < B && !ok(b)) b++;
    if (b >= B) throw new Error('the schedule cannot place ' + s.id + ' (target ' + s.target + ')');
    slot[b].push(s.id); placed[s.th + '.' + s.i] = b;
    if (segments[s.id].cat === 'interview') cap[b] = 1;
  }
  // the ads: about two breaks in three, alternating businesses
  let ai = 0;
  const adOrder = ads.slice().sort((a, b) => (a.slice(-1) - b.slice(-1)) || 0);   // every business's first ad, then the seconds
  for (let b = 0; b < B && ai < adOrder.length; b++) {
    if (slot[b].length >= cap[b] || b % 3 === 2) continue;
    slot[b].push(adOrder[ai++]);
  }
  // the rest: calls and officer messages spread, then the notices, then the asides
  const kind = id => segments[id].cat;
  const rest = notices.slice(), q = [];
  const callsLike = rest.filter(id => kind(id) === 'call' || kind(id) === 'officer'), plain = rest.filter(id => !callsLike.includes(id));
  // interleave: a call or officer every few
  let ci = 0;
  for (let i = 0; i < plain.length; i++) { q.push(plain[i]); if (i % 4 === 3 && ci < callsLike.length) q.push(callsLike[ci++]); }
  while (ci < callsLike.length) q.push(callsLike[ci++]);
  q.push(...asides);
  for (let b = 0; b < B && q.length; b++) {
    while (slot[b].length < cap[b] && q.length) {
      // never two calls in one break, never two of one kind
      const j = q.findIndex(id => !slot[b].some(x => kind(x) === kind(id) || (/call|officer|interview/.test(kind(x)) && /call|officer|interview/.test(kind(id)))));
      if (j < 0) break;
      slot[b].push(q.splice(j, 1)[0]);
    }
  }
  if (q.length) process.stderr.write('radio_gen: ' + q.length + ' notices left out of the program: ' + q.join(', ') + '\n');
  // the order inside a break and its shape
  const program = [], shapes = [];
  for (let b = 0; b < B; b++) {
    const segsB = slot[b].slice();
    // ads never open a break; calls and the interview after the community notice
    segsB.sort((x, y) => rank(kind(x)) - rank(kind(y)));
    const tok = [];
    // a station ID every third break, the weather every fifth (with the tune-in's: about six in two hours)
    const id = b % 3 === 0, wx = b % 5 === 2 && !segsB.some(x => kind(x) === 'interview');
    if (id && b % 2 === 0) tok.push('@id');
    tok.push('@ba');
    if (id && b % 2 === 1) tok.push('@id');
    const wxAt = wx ? (r() < 0.5 ? 0 : segsB.length) : -1;
    segsB.forEach((s, i) => { if (i === wxAt) tok.push('@wx'); tok.push(s); });
    if (wx && wxAt === segsB.length) tok.push('@wx');
    let shape = tok.map(t => (t[0] === '@' ? t : kind(t))).join(' ');
    if (shapes.length && shape === shapes[shapes.length - 1]) {
      // the same shape as the last break: move the weather, or swap two segments, or add a station ID
      const i = tok.indexOf('@wx');
      if (i >= 0) { tok.splice(i, 1); tok.splice(i === tok.length ? 1 : tok.length, 0, '@wx'); }
      else if (segsB.length > 1) { const a = tok.length - 1; [tok[a], tok[a - 1]] = [tok[a - 1], tok[a]]; }
      else tok.unshift('@id');
      shape = tok.map(t => (t[0] === '@' ? t : kind(t))).join(' ');
    }
    shapes.push(shape);
    program.push(tok);
  }
  return program;
}
const RANK = { lost: 0, notice: 0, event: 0, work: 0, barge: 0, school: 0, clinic: 0, library: 0, fire: 0, thanks: 1, harbour: 0, mail: 0, berries: 0, bees: 0,
  bingo: 0, swap: 0, meeting: 0, smokehouse: 2, pancakes: 2, ad: 3, call: 4, officer: 4, interview: 5, aside: 6 };
const rank = k => (RANK[k] != null ? RANK[k] : 1);

// ---- THE PRINT (a reading of the program) ---------------------------------------------------------------------------------
function print(script) {
  const o = [];
  script.program.forEach((b, i) => {
    o.push('BREAK ' + (i + 1) + '  [' + b.map(t => (t[0] === '@' ? t : script.segments[t].cat)).join(' ') + ']');
    for (const t of b) {
      if (t[0] === '@') { o.push('  ' + t); continue; }
      for (const k of script.segments[t].items) o.push('  ' + (script.items[k].v + (script.items[k].phone ? ' (phone)' : '')).padEnd(18) + script.items[k].text);
    }
  });
  return o.join('\n');
}
const serialise = s => JSON.stringify(s, null, 1) + '\n';

if (require.main === module) {
  const argv = process.argv.slice(2);
  const { problems, script } = build();
  if (problems.length) { console.error('radio_gen: the writing rules:\n  ' + problems.join('\n  ')); process.exit(1); }
  if (argv.includes('--print')) { console.log(print(script)); process.exit(0); }
  if (argv.includes('--check')) {
    const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === serialise(script);
    console.log(same ? 'radio_script.json: current' : 'radio_script.json: STALE - run node tools/audio/radio_gen.js');
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(OUT, serialise(script));
  const n = Object.keys(script.items).length, words = Object.values(script.items).reduce((a, x) => a + x.text.split(/\s+/).length, 0);
  console.log('radio_script.json: ' + n + ' items, ' + Object.keys(script.segments).length + ' segments, ' + script.program.length + ' breaks, ' + words + ' words');
}
module.exports = { build, lintText, spokenTitle, spokenArtist, print, VOICES, BREAKS, SEED };
