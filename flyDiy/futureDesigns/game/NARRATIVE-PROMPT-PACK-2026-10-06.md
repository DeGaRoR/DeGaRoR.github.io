# THE NARRATIVE + PORTRAITS PROMPT PACK — for an external AI (prepared, NOT run)
### (2026-10-06, G2201, the GAME COORDINATOR; companion of `futureDesigns/GAME-2026-10-06.md` §9-§11)

**Status: PREPARED, NOT RUN.** Nothing in this pack has been sent to any AI or service. **The user chooses which AI to
use and runs it** (or explicitly OKs a session to run it; GAME §16 GQ21). The outputs come back as files that a
session imports into `src/game/` (text) and `media/portraits/` (images), with credits in `CREDITS.md`.

**How to use it**
1. **Text** (one conversation with a writing AI): paste **Block 0** (the bible and the constraints), then **Blocks 1, 2
   and 3** one at a time. Each asks for JSON in a fixed shape (Block 5), so the result imports without retyping. Keep
   the conversation going, so the AI keeps the bible.
2. **Portraits** (an image AI): for each pilot, paste **Block 4's style line + that pilot's prompt**. Generate 2-4
   candidates, and keep one per pilot as 1024×1024 PNG/WebP named `<pilot id>.png`.
   - **Match the body first.** Each pilot is worn by a Mixamo character. Before generating, take a still of that
     character in the garage's crew picker (or ask a session for `tools/char_stills.js`, owed). Then edit the
     **APPEARANCE** line so the face and clothes agree with the 3-D body.
   - The `NEW:` bodies need a Mixamo download first (your OK, GQ13).
3. **Licences**: the AI's terms must allow commercial use of the outputs. Record the AI, the date and the terms in
   `CREDITS.md` (the project's credit-only rule).

---

## BLOCK 0 — the bible and the hard constraints (paste first)

```
You are the narrative writer for "flyDiy", a browser flight game where the player DESIGNS small aeroplanes
(a real physics editor), proves them on a test bench, and runs an air service with them on one island.
The autopilot is a hired pilot with a personality; the player is the engineer and the operator.

SETTING. Jolene Island, south-east Alaska (terrain from a real island; all PEOPLE and ORGANISATIONS are
fictional). Rain, low cloud, spruce and cedar forest, a 1,100 m hill (Tamgas), a long WWII-era paved
airfield (Jolene AFB, runways 13/31 and 02/20), a 520 m gravel hill strip (Tamgas Hill Strip), a mine
reached by a 250 m strip that is really a street (Jumbo Mine Street), a 150 m clearing (East Point
Clearing), a snow altiport above the resort (Skyline Altiport, 380 m, uphill), a dock (Annette Dock,
water) and a seaplane base by the town (Metlakatla Seaplane Base, water).

PREMISE. The old Army airfield has been a weed field for decades. The Field Trust leases it to anyone who
will bring it back to life. The player arrives with a crate of tools, a small grant, a voucher for one
small aeroplane, and one pilot who believes in them. The island needs air links: the mine wants to
reopen, the dock wants its mail and its fish spotted, the resort wants guests, the survey office wants
eyes on the coast, and private clients want aeroplanes nobody sells. The player designs the aeroplanes
that do the work.

TONE. Warm, practical, wry. Bush flying, small community, weather as the antagonist. Humour comes from
people, not slapstick. No villains, no corporate evil, no melodrama, no romance plots. Danger is real but
never gory. Clients speak like real people asking for something they need. Short lines: everything
appears in a game UI (a contract card is 1-3 sentences; a pilot's bark is under 12 words).

DESIGN RULES THE TEXT MUST RESPECT.
- A build contract asks for PERFORMANCE in the client's own words ("four of us, fast", "under 300 kg",
  "an hour on a tiny tank", "electric"), never for a configuration (never "high wing", "tricycle gear",
  a brand or an engine model).
- The player chooses freely: no text may say the player MUST use a given aeroplane or pilot.
- Time passes only in flight; do not write deadlines in days or hours ("by Friday"). Conditions are fine
  ("before dark", "if the cloud lifts").
- Money is "credits"; do not invent prices (the game computes them).

HARD CONSTRAINTS (non-negotiable).
1. The island's real counterpart is home to a living Indigenous community. Every person and organisation
   you write is FICTIONAL. Do not depict, reference or invent Indigenous governance, culture, regalia,
   ceremonies, lore, language or spiritual practice. Islanders are ordinary people with jobs and
   personalities; never exotic set dressing; no "wise elder" or "mystic" tropes for anyone.
2. No real companies, brands, real people, or real aircraft manufacturers' names. Invent them.
3. Characters are diverse in age, gender and background without tokenism. No accent spelling, no ethnic
   jokes, no stereotypes tied to origin.
4. Nothing sexual, no slurs, no gratuitous violence, nothing political.
5. Write in plain English (UK or US, consistently US spelling for in-game text).
Answer only in the JSON shapes requested.
```

---

## BLOCK 1 — the providers and their voices

```
Write the six contract providers. For each: a name for the organisation (keep the provided working name
if it fits, or improve it), a one-paragraph description (60-90 words), the CONTACT PERSON who gives the
player work (name, age, role, 3-sentence personality, how they talk), five sample "bark" lines the
contact says in the UI (under 12 words each), and the provider's three-act arc as titles + 2-sentence
summaries. Each arc ends with something BUILT on the island (given below). JSON: Block 5, "providers".

1. field   — "The Field Trust", the airfield's landlord at Jolene AFB. Tutorial work, restoring the field.
             Arc ends: the second WWII hangar restored and the old tower relit.
2. mine    — "Jumbo Mine Co.", reopening an old copper mine reached by the 250 m street strip. Crews,
             parts, samples, heavy loads into a short field. Arc ends: a new headframe and ore shed.
3. dock    — "The Dock & Cannery", Annette Dock and the seaplane base. Fish spotting, float freight, mail.
             Arc ends: the pier extended, a cold store and a slipway.
4. resort  — "Skyline Resort", the snow altiport above the hill. Guests, sightseeing, a VIP who wants an
             electric aeroplane. Arc ends: the lodge built and the snow strip lengthened.
5. survey  — "The Survey Office", a two-desk science office. Wildlife counts, coast and weather flights,
             proving new landing sites (East Point, gravel bars). Arc ends: new stations on the map.
6. clients — "Private clients & the Club": individuals who want an aeroplane built for them, and the
             flying club's challenges. Arc ends: a club house, and a small museum hangar for the
             player's best design.
```

---

## BLOCK 2 — the contracts, jobs and build-contract briefs

```
For each provider write:
(a) its ARC: 4-6 contracts in order. Each contract: id, title (max 5 words), brief (1-3 sentences in the
    contact's voice), 1-4 stages, each stage one line saying what is done ("carry 3 engineers from Jolene
    AFB to Jumbo Mine Street"), and a completion line (1 sentence) + what gets built when it is the last.
    Use only the airfields listed in Block 0.
(b) 8 JOB TEMPLATES (repeatable one-leg runs): title pattern with {from} {to} {load} slots, a one-line
    brief, and the kind of load (passengers / mail / parts / fish / samples / gear / guests).
(c) For "clients" and "resort" and "mine", 3 BUILD-CONTRACT BRIEFS each. A brief is the client asking for
    an aeroplane in their own words; then list the measurable criteria in plain words underneath (seats
    occupied, empty mass limit, cruise speed with that load, endurance on a fuel limit, electric, lands
    at a given strip, crosswind, cost limit, aerobatic strength). Use these as inspiration, then invent
    your own:
      "I need to get my team of four to the mine fast."      -> 4 aboard, fast cruise, lands at the mine
      "Something I can push out of my shed alone."            -> light empty mass, short span
      "An hour in the air on a ridiculous tank."              -> tiny tank, long endurance
      "Electric. The guests hate the noise."                  -> electric, 2 aboard, lands at the altiport
      "A trainer for the club, cheap and forgiving."          -> cost limit, crosswind, a student can fly it
    Never name a configuration or a brand.
(d) 6 CHALLENGES (timed or best-performance, bronze/silver/gold), one line each.
JSON: Block 5, "contracts", "jobs", "builds", "challenges".
```

---

## BLOCK 3 — the sixteen recruitable pilots

The game's flying is a **profile** (PILOT-PERSONA: `reaction` s, `smooth` ×, `hamFist`, `overRotate` rad, `flareK`,
`bankK`, `comfortG` g, `field` short/normal, `slip`, and the style cautious/normal/brisk). **The numbers below are
fixed by the design; the AI writes the PERSON who flies like that.** The traits are game hooks (refusals, skill
growth, economy); the AI may phrase them but not change them.

```
Write each of these sixteen pilots as a person. Keep the given profile facts, traits and the age/role
seed; you may change the NAME (keep it plausible and diverse) and invent everything else. For each:
name, age, pronouns, one-line tagline, backstory (80-120 words: where they learned to fly, why they are
on Jolene, one thing they are proud of, one thing they avoid talking about), how they talk (2 sentences),
8 barks (under 12 words: hired, take-off, landing well, landing badly, refusing a job (use the trait),
weather, idle chat, after a long day), a one-line "flies like" description a player can read
(translate the profile into plain words), and a HIRE pitch (2 sentences they'd say at the interview).
JSON: Block 5, "pilots".

ID      SEED (age, role)                         PROFILE (base + knobs)                           TRAITS (game hooks)
sven    70, the airfield's old mechanic who      student base; reaction .30, smooth .75,          mechanic (field repairs ×0.9), cautious style,
        flies — THE STARTING COMPANION           bankK .8, comfortG 1.2, style cautious           night-shy, grows slowly (ceiling: club)
peg     61, retired bush pilot, legend           bush; reaction .12, smooth 1.0, slip,            short-field, loves taildraggers, expensive,
                                                 field short, bankK 1.2, comfortG 1.7             refuses nothing
tomas   24, brand-new commercial licence         student; reaction .40, overRotate .03,           eager (cheap), grows fast (ceiling: bush)
                                                 flareK .85
ingrid  38, ex-airline first officer             club; reaction .15, smooth .7, bankK .8,         paved-strip nerves (refuses strips < 300 m),
                                                 comfortG 1.2                                     night-capable
kofi    45, coastal float pilot                  bush base, smooth .9, field short                float-rated (refuses nothing on water),
                                                                                                  dislikes snow strips
dale    52, ex-crop-duster                       hamfist; hamFist .04, comfortG 1.9, bankK 1.25   fearless (no weather refusals), hard on
                                                                                                  airframes (repair bills ×1.1)
aiko    33, glider instructor                    club; smooth .6, reaction .18, flareK 1.05       smooth (endurance legs measured best),
                                                                                                  refuses aerobatic jobs
rosa    29, ex-helicopter pilot converting       club; reaction .12, hamFist .02, smooth 1.3      night-capable, grows fast (ceiling: expert)
noah    19, island kid with 40 hours             student; reaction .45, overRotate .035,          local knowledge (weather barks), grows fast
                                                 flareK .8, bankK .7                              (ceiling: bush), cheapest
bea     41, flight nurse turned pilot            club; reaction .2, comfortG 1.25, style          medevac jobs pay more with her, refuses
                                                 cautious                                         aerobatic jobs
lars    35, ski-plane specialist                 bush base, field short, bankK 1.1                snow-rated, refuses water
camille 27, aerobatic competitor                 expert-like custom: reaction .1, bankK 1.3,      brisk style, impatient (refuses jobs paying
                                                 comfortG 2.0, smooth 1.2                         under her rate), aerobatic challenges +
elias   58, retired land surveyor                club; reaction .3, smooth .65, style cautious    survey jobs measured precise, night-shy
hal     66, raconteur, ex-charter pilot          club; reaction .25, flareK .95                   chatty (many barks), grumpy in rain
priya   31, engineer and test pilot              expert (profile off: flies as tuned)             test pilot (acceptance legs tighter), the
                                                                                                  most expensive, will not do cargo runs
walt    49, ferry pilot, long legs               expert-like; reaction .1, field normal           long-range legs, refuses strips < 250 m
```

---

## BLOCK 4 — the portraits (one per pilot)

**STYLE LINE (prepend to every prompt, unchanged, so the cast matches):**

```
Painted character portrait, head and shoulders, 3/4 view, soft gouache and ink illustration style,
muted coastal palette (slate blue, spruce green, warm ochre), gentle rim light, overcast sky and a hint
of a hangar or shoreline behind, the person looks at the viewer, natural expression, realistic
proportions, no text, no logos, no brand marks, no insignia, square 1:1, 1024x1024.
```

**Per pilot.** `BODY` is the Mixamo character that wears the pilot in 3-D (GAME §9.1). `APPEARANCE` must be edited to
match that body's still before generating (hair, skin tone, build, clothes). `NEW:` means a Mixamo character to be
chosen and downloaded (the user's OK).

| id | BODY | APPEARANCE (edit to the body's still) | the rest of the prompt |
|---|---|---|---|
| sven | ch20 (the default pilot today) | an older man, 70, weathered face, grey stubble; *the body's red coverall* | "a mechanic's patience, a pencil behind the ear, grease on the knuckles, kind tired eyes" |
| peg | NEW: older woman, outdoor clothes | a woman of 61, silver hair tied back, deep laugh lines | "a faded flight jacket over a wool sweater, a look that has seen every weather" |
| tomas | remy | a young man, 24 | "an eager half-smile, a brand-new headset around his neck, a crisp shirt" |
| ingrid | NEW: woman, smart casual | a woman of 38, neat hair | "composed, a fleece over an old airline uniform shirt with no insignia, an assessing look" |
| kofi | ch42 | a man of 45 | "a rain jacket with the hood down, salt-stained cap, steady calm eyes, sea behind" |
| dale | NEW: heavy-set man, work wear | a man of 52, sunburnt | "a battered cap, a grin with a chipped tooth, an old work shirt, swagger" |
| aiko | ch02 | a woman of 33 | "a light windbreaker, sunglasses pushed up into her hair, a serene focused look" |
| rosa | ch22 | a woman of 29 | "a flight suit with the sleeves tied at the waist and a T-shirt, direct confident gaze" |
| noah | NEW: teenage boy, casual | a young man of 19 | "a hoodie, rain-wet hair, a shy proud smile, a logbook held to his chest" |
| bea | NEW: woman, practical | a woman of 41 | "a practical jacket with a small first-aid patch (no text), warm competent expression" |
| lars | NEW: man, cold-weather gear | a man of 35 | "a knitted hat, a snow-dusted parka, ski goggles on the hat, mountains behind" |
| camille | NEW: young woman, sporty | a woman of 27 | "a sleek sports jacket, a confident half-smirk, wind-tossed hair" |
| elias | ch01 | a man of 58 | "round glasses, a field vest with many pockets, a folded map, a methodical calm" |
| hal | NEW: old man, cardigan | a man of 66, bushy eyebrows | "a cardigan under a waxed jacket, mid-story, raised eyebrow, a mug of coffee" |
| priya | NEW: woman, technical | a woman of 31 | "a plain technical jacket, a tablet with a graph (no readable text), sharp curious eyes" |
| walt | NEW: man, travel-worn | a man of 49 | "a leather jacket, a duffel strap over the shoulder, a quiet distant look, runway lights behind" |

**Optional, provider contacts**: the same style line, head and shoulders, one per provider contact from Block 1, using
the AI's own description. These are 2-D portraits only (no 3-D body needed).

**The body map in short:**
- **Six existing bodies**: ch20 → sven, remy → tomas, ch42 → kofi, ch02 → aiko, ch22 → rosa, ch01 → elias.
  - These are **assignments to verify against the stills**. The ages and genders above follow the seeds, not the
    meshes. If a mesh disagrees (for example ch02 is a man), swap pilots between bodies, or edit the seed's age and
    gender before writing Block 3.
- **Ten new bodies (`NEW:`)**: these need Mixamo downloads, about 12-20 MB of PNG each after the CHAR-BUDGET
  compression, and the LIVE-CREW texture-budget ruling.
  - The alternative to downloading (GQ13): retextured clothes on the six existing bodies. That needs no download but
    gives less variety.

---

## BLOCK 5 — the JSON shapes (the import contract)

```json
{
  "providers": [ { "id": "mine", "name": "", "desc": "",
                   "contact": { "name": "", "age": 0, "role": "", "personality": "", "voice": "" },
                   "barks": ["", "", "", "", ""],
                   "arc": [ { "act": 1, "title": "", "summary": "" } ] } ],
  "contracts": [ { "id": "mine.01", "provider": "mine", "title": "", "brief": "",
                   "stages": [ { "line": "", "from": "HOME", "to": "mn_strip", "load": "3 engineers" } ],
                   "done": "", "builds": "" } ],
  "jobs":      [ { "provider": "dock", "title": "{load} for {to}", "brief": "", "load": "mail" } ],
  "builds":    [ { "id": "clients.b1", "provider": "clients", "client": "", "brief": "",
                   "criteria": [ "4 aboard", "cruise at least 200 km/h with them", "lands at Jumbo Mine Street" ] } ],
  "challenges":[ { "id": "", "provider": "clients", "title": "", "line": "" } ],
  "pilots":    [ { "id": "sven", "name": "", "age": 0, "pronouns": "", "tagline": "", "backstory": "",
                   "voice": "", "barks": { "hired": "", "takeoff": "", "goodLanding": "", "badLanding": "",
                   "refuse": "", "weather": "", "idle": "", "longDay": "" },
                   "fliesLike": "", "pitch": "" } ]
}
```

Airfield ids for `from` / `to`: HOME (Jolene AFB 13/31), w2 (Jolene AFB 02/20), w3 (Tamgas Hill Strip), mn_strip (Jumbo
Mine Street), nv_strip (East Point Clearing), tw_ski (Skyline Altiport), SEA (Annette Dock), mk_sea (Metlakatla Seaplane
Base).

**The import session** (PILOTS / CONTRACT-MODEL, GAME §15) will:
- validate the JSON against GATE CONTRACTS: every airfield id exists, every text key resolves, and no build criterion
  names a configuration (a word list);
- store the text as data keyed by id;
- never paste prose into code.
