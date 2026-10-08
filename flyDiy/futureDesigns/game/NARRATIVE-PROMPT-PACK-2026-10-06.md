# THE NARRATIVE + PORTRAITS PROMPT PACK — for an external AI (prepared, NOT run)
### (2026-10-06, G2201, the GAME COORDINATOR; companion of `futureDesigns/GAME-2026-10-06.md` §9-§11)

**Updated after the user's calls (6 Oct ~20:30; study §R):** five providers (the mine and the dock merged), **four**
recruitable pilots on the existing Mixamo bodies (no download), one delivery per build contract followed by a
follow-up from a happy client, and no running costs or wages in the text.

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
reopen and ship through the dock, the dock wants its mail and its fish spotted, the resort wants guests, the survey office wants
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
- Money is "credits"; do not invent prices (the game computes them). There are no wages or running costs:
  pilots sign on for a one-time fee; contracts pay net.
- A client gets ONE aeroplane per build contract. A happy client comes back with a FOLLOW-UP: the same need
  with one thing changed (faster, one more seat, a smaller tank, floats, cheaper).

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
Write the five contract providers. For each: a name for the organisation (keep the provided working name
if it fits, or improve it), a one-paragraph description (60-90 words), the CONTACT PERSON who gives the
player work (name, age, role, 3-sentence personality, how they talk), five sample "bark" lines the
contact says in the UI (under 12 words each), and the provider's three-act arc as titles + 2-sentence
summaries. Each arc ends with something BUILT on the island (given below). JSON: Block 5, "providers".

1. field    — "The Field Trust", the airfield's landlord at Jolene AFB. Tutorial work, restoring the field.
              Arc ends: the second WWII hangar restored and the old tower relit.
2. minedock — "Jumbo Mine & Dock Co.", one company reopening an old copper mine (reached by the 250 m
              street strip) and shipping through Annette Dock and the seaplane base: crews, parts, samples,
              heavy loads into a short field, float freight, mail, fish spotting for the dock's cannery
              tenants. Arc ends: a new headframe and ore shed, then the pier extended with a slipway.
3. resort   — "Skyline Resort", the snow altiport above the hill. Guests, sightseeing, a VIP who wants an
              electric aeroplane. Arc ends: the lodge built and the snow strip lengthened.
4. survey   — "The Survey Office", a two-desk science office. Wildlife counts, coast and weather flights,
              proving new landing sites (East Point, gravel bars). Arc ends: new stations on the map.
5. clients  — "Private clients & the Club": individuals who want an aeroplane built for them, and the
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
(c) For "clients", "resort" and "minedock", 3 BUILD-CONTRACT BRIEFS each, and for each brief ONE FOLLOW-UP
    brief (the same client, happy with the first aeroplane, asking for the same with one thing changed). A brief is the client asking for
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

## BLOCK 3 — the four recruitable pilots

The game's flying is a **profile** (PILOT-PERSONA: `reaction` s, `smooth` ×, `hamFist`, `overRotate` rad, `flareK`,
`bankK`, `comfortG` g, `field` short/normal, `slip`, and the style cautious/normal/brisk). **The numbers below are
fixed by the design; the AI writes the PERSON who flies like that.** The traits are game hooks (refusals, skill
growth, repairs); the AI may phrase them but not change them. **Each pilot is worn by an existing Mixamo body**, so
the seed (age, look) follows the body. Two more bodies are reserved and are not recruits: ch20 (the red racing
suit) is the TEST PILOT, and ch02 is kept for the user's own purposes.

```
Write each of these four pilots as a person. Keep the given profile facts, traits and the seed (the age
range and the look come from the 3-D body and must not change); you may change the NAME (plausible,
diverse) and invent everything else. For each:
- name, age, pronouns, a one-line tagline;
- a backstory (80-120 words: where they learned to fly, why they are on Jolene, one thing they are proud
  of, one thing they avoid talking about);
- how they talk (2 sentences);
- 8 barks, each under 12 words: hired, take-off, landing well, landing badly, refusing a job (use the
  trait), weather, idle chat, after a long day;
- a one-line "flies like" a player can read (translate the profile into plain words);
- a HIRE pitch (2 sentences they'd say at the interview).
One of them (marked COMPANION) arrives with the player at the start and believes in them; give them a
reason. JSON: Block 5, "pilots".

ID     BODY  SEED (look from the body; age range)            PROFILE (base + knobs)                     TRAITS (game hooks)
kit    ch01  COMPANION. 30s; short-cropped light hair,       club; reaction .25, smooth .8, bankK .85,  mechanic (field repairs x0.9), cautious,
             white T-shirt, jeans, white trainers. Fixes     comfortG 1.25, style cautious              night-shy, grows steadily (ceiling: bush)
             engines and flies a little; the one who came
             with you.
rafe   ch42  late 20s-30s; tattooed forearms and hands,      hamfist; hamFist .04, comfortG 1.9,        fearless (no weather refusals), hard on
             red T-shirt, light ripped jeans, white          bankK 1.25                                 airframes (repair bills x1.1)
             trainers. Ex-crop-duster / airshow ground crew
             turned pilot: loud, brave, rough hands.
remy   remy  20s; a smart-casual young man. A brand-new      student; reaction .40, overRotate .03,     eager (the cheapest sign-on), grows fast
             commercial licence and no hours.                flareK .85                                 (ceiling: expert)
sky    ch22  20s-30s; white shirt, dark jeans. A bush        bush; reaction .12, smooth 1.0, slip,      short-field, loves taildraggers, the
             pilot who grew up landing on gravel bars.       field short, bankK 1.2, comfortG 1.7       priciest sign-on, refuses nothing
             (Gender and look from the body's still.)
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

**Per pilot.** `BODY` is the Mixamo character that wears the pilot in 3-D. `APPEARANCE` was read from each body's
texture atlas (the faces are not readable there). **Confirm it against a still** of the character in the garage's
crew picker before generating, and correct hair, skin tone, build and clothes so the portrait and the 3-D body agree.

| id | BODY | APPEARANCE (confirm on the still) | the rest of the prompt |
|---|---|---|---|
| kit | ch01 | short-cropped light hair, white T-shirt, blue jeans | "a mechanic's patience, a rag over one shoulder, grease on the knuckles, kind tired eyes, the hangar door behind" |
| rafe | ch42 | dark hair, tattooed forearms and hands, a red T-shirt | "a wide grin, a battered cap pushed back, swagger, sun on the face, a windsock behind" |
| remy | remy | the body's own look (a young man, casual) | "an eager half-smile, a brand-new headset around the neck, crisp clothes, a bright overcast sky" |
| sky | ch22 | dark hair, a white shirt (gender from the still) | "a calm weathered look, a fleece over the shirt, a gravel bar and a river behind" |

**Not recruits:** ch20 (the red racing suit) is the TEST PILOT, and ch02 is kept for the user's own purposes. Neither
needs a portrait unless the user asks.

**Downloads:** none. The four recruits wear bodies already in the game. If the user prefers four new Mixamo
characters, list the picks first; each download needs the user's OK and the LIVE-CREW texture-budget ruling.

---

## BLOCK 5 — the JSON shapes (the import contract)

```json
{
  "providers": [ { "id": "minedock", "name": "", "desc": "",
                   "contact": { "name": "", "age": 0, "role": "", "personality": "", "voice": "" },
                   "barks": ["", "", "", "", ""],
                   "arc": [ { "act": 1, "title": "", "summary": "" } ] } ],
  "contracts": [ { "id": "minedock.01", "provider": "minedock", "title": "", "brief": "",
                   "stages": [ { "line": "", "from": "HOME", "to": "mn_strip", "load": "3 engineers" } ],
                   "done": "", "builds": "" } ],
  "jobs":      [ { "provider": "minedock", "title": "{load} for {to}", "brief": "", "load": "mail" } ],
  "builds":    [ { "id": "clients.b1", "provider": "clients", "client": "", "brief": "",
                   "criteria": [ "4 aboard", "cruise at least 200 km/h with them", "lands at Jumbo Mine Street" ],
                   "followUp": { "brief": "", "changed": "one more seat" } } ],
  "challenges":[ { "id": "", "provider": "clients", "title": "", "line": "" } ],
  "pilots":    [ { "id": "kit", "name": "", "age": 0, "pronouns": "", "tagline": "", "backstory": "",
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
