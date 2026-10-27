# Short-field / STOL technique: sourced figures for a sim autopilot

Research date: 2026-10-27. **Method caveat:** in this session every direct page fetch (faa.gov, faasafety.gov,
atsb.gov.au mirror of the AFH, wikipedia, cfinotebook, boldmethod, cubcrafters) was blocked by the egress proxy.
All figures below come from web-search result excerpts that quote those pages, not from my own reading of the
full PDFs. Lines tagged **[AFH, recalled]** are FAA Airplane Flying Handbook wording I am confident of but could
not re-read here. Lines tagged **[UNSOURCED]** or **[DERIVED]** have no source or are my own arithmetic.
Units: 1 kt = 1.852 km/h, 1 mph = 1.609 km/h, 1 ft = 0.305 m.

---

## 1. Final approach speed vs Vso

- FAA AFH (FAA-H-8083-3, short-field approach): use the manufacturer's approach speed; if there is none,
  **not more than 1.3 Vso**, plus **no more than half the gust factor** in gusty air. Too much speed makes you
  touch down too far along or roll too far.
- ACS short-field landing: Private **1.3 Vso +10/-5 kt**; Commercial **1.3 Vso ±5 kt** (from a flashcard set,
  not checked against the ACS); CFI level "1.3 Vso ±5" (forum transcription).
- Part 23 baseline: the reference landing approach speed is generally no less than 1.3 Vso (summarised by AOPA).
- Real practice:
  - Some training articles fly short-field finals at **1.2 Vso**.
  - Backcountry and forum practice is roughly **1.2-1.3 Vso** on final, then bleeding speed "from about
    1.3 to 0.9 Vso" (in IAS terms) over the last part so touchdown happens at minimum speed.
  - Super Cub owners report **about 45-50 mph** (some "45 mph IAS on short farm strips") against Vso of
    43 mph CAS. That is about **1.05-1.15 Vso**. [forum, anecdotal]
  - STOL competitors "configure for landing, then get desperately slow". They fly **well below 1.3 Vso**, on
    the back side of the power curve ("reverse command": more power is needed to go slower) (AOPA 2022). The
    stall warning sounds the whole way down in a CubCrafters Carbon Cub FX STOL demo [forum report of video].
- Counterpoint: the FAA "On Landings" safety pamphlet says 1.3 Vso is for short final only. AOPA and
  instructors warn against flying slower than the POH speed just because the runway is short.

**For the autopilot:** Vapp = 1.3 Vso(landing config) for the "FAA" mode and 1.15-1.2 Vso for the "bush" mode.
Add 0.5 x gust factor. Over the last ~100-200 ft before touchdown, decay the target linearly to about 1.05 Vso.
Never command below about 1.05 Vso while still above flare height.

Sources:
- https://www.faasafety.gov/files/events/SO/SO15/2024/SO15131753/ShortFieldApproachLanding_afh_ch9.pdf (AFH ch. 9 extract)
- https://www.cfinotebook.net/lesson-plans/private-pilot-airplane/takeoffs-landings-and-go-arounds/private-pilot-short-field-approach-and-landing-lesson-plan
- https://brainscape.com/flashcards/short-field-approach-landing-7266717/packs/11843327 (Commercial ±5, unofficial)
- https://aopa.org/news-and-media/all-news/2022/november/pilot/technique-stol-landings
- https://www.aopa.org/news-and-media/all-news/2016/august/flight-training/dont-try-this-at-home
- https://www.faasafety.gov/files/notices/2014/Oct/FAA_P-8740-49_OnLandingsPart_II_[hi-res]_branded.pdf
- https://backcountrypilot.org/forum/short-landing-roll-technique-18842 ; https://euroga.org/forums/the-most-reliable-way-to-do-a-forced-landing-high-key-low-key/8797

## 2. Approach path: power, angle, flaps, slips

- AFH: the approach is **power-on**, with power adjusted to hold the approach speed, flown at minimum speed
  close to minimum controllable airspeed. Pitch and power must be coordinated. With obstacles, fly a
  **slightly steeper** path, which puts touchdown closer to the obstacle and leaves more room to stop.
  **Full flaps** allow the steeper approach.
- AOPA (Flight Training "Insights"): a short-field approach **does not have to be a steep power-off descent**.
  Use flaps and power, and do not rely on idle, because you need power available for sink and updrafts. A truly
  steep approach needs **40 deg or more** of flap (most 30-deg-flap airplanes cannot do it).
- Backcountry and mountain technique: fly the glide path "like an ILS". **Pitch controls the path, power
  controls the airspeed**, aimed at a point short of the touchdown spot. One Super Cub pilot sets up **50 mph,
  full flaps, idle** and then uses power to move the aim point. Power-off approaches are "good forced-landing
  practice, not good short-field technique" (forum).
- STOL competition "dragged-in" variant:
  - Approach nose-high at very low speed with fairly high rpm, often already in ground effect.
  - Little or no flare; cut the power and let it drop, then brake hard (AOPA 2022). The nose-high attitude
    blocks the forward view.
  - AOPA calls this "borderline abusive" and not for everyday use.
- Glide angle in degrees: **no authoritative source found [UNSOURCED].**
  - Data points: the normal glide path is about 3 deg. The UK CAA treats 4.5 deg or more as a "steep approach"
    (airline context). A forum report puts a TB10 at full flap and idle at about a 13 % gradient (7.4 deg),
    and "controllable" with full flaps plus some power at about 6 % (3.4 deg).
  - [DERIVED] To clear a 50 ft obstacle and touch down 300-500 ft beyond it, the path must be about 6-9.5 deg.
- Slips: valid in airplanes whose POH allows them; they steepen the path in low-drag airframes (Kitplanes).
  No numeric guidance found. Some POHs prohibit slips with full flaps. [Cub POH limit not verified]

**For the autopilot:**
- Flaps: full flaps on final.
- "FAA" mode: gamma_ref = -4 to -6 deg, power-on. "Obstacle" mode: -6 to -8 deg [DERIVED].
- "Drag-in" mode: gamma_ref = -2 to -3 deg at 1.05-1.1 Vso with high power, back side of the curve.
- Control law: pitch (elevator) tracks the glide path, throttle tracks airspeed. Below Vmd the coupling flips,
  so do not use pitch-for-speed there.
- Optional slip: up to 10-15 deg of sideslip to steepen when high, but only above about 50 ft AGL [UNSOURCED].

Sources:
- https://www.aopa.org/news-and-media/all-news/2006/october/flight-training-magazine/insights
- https://euroga.org/forums/backcountry-airstrip-operations-in-tricycle-aircraft/6428
- https://backcountrypilot.org/stol-tips/stol-tips-landing
- https://euroga.org/forums/what-is-the-steepest-glideslope-your-plane-could-fly/3630
- https://regulatorylibrary.caa.co.uk/965-2012/Content/Regs/08270_CAT.POL.A.245.htm
- https://www.kitplanes.com/wind-tunnel-78/
- https://aopa.org/news-and-media/all-news/2022/november/pilot/technique-stol-landings

## 3. Aim point and touchdown accuracy

- ACS:
  - Private: touch down at a proper pitch attitude **within 200 ft beyond (or on) the specified point**, with
    minimal float, no side drift, on the centreline. Clear a 50 ft obstacle (real or simulated).
  - Commercial: **within 100 ft beyond** the point (flashcard source).
  - CFI: "+100 ft / -0 ft" (forum transcription). Touching down short of the point is a failure.
- Competition: aim **short of** the touchdown spot. Valdez rules: the mains **may not touch before the line**,
  and landing distance is measured from the line to where the mains stop.
- AFH: the aim point is selected so touchdown happens as close to the threshold or obstacle as possible.
  Excess speed makes you float past it.

**For the autopilot:**
- Aim point (glide-path intercept with the ground) = 30-60 ft before the desired touchdown spot. The flare and
  the last slow-down consume that distance.
- Acceptance window: touchdown error between 0 and +100 ft (commercial standard) or +200 ft (private standard);
  never short.

Sources:
- https://accounts.cfinotebook.net/lesson-plans/private-pilot-airplane/takeoffs-landings-and-go-arounds/private-pilot-airplane-short-field-approach-and-landing-lesson-plan
- https://pilotsofamerica.com/community/threads/acs-standards-question.149165
- https://www.aopa.org/news-and-media/all-news/2018/may/17/valdez-stol-distances-get-shorter
- https://www.kitplanes.com/stol-mods-how-short-can-you-go/

## 4. Flare, power reduction and touchdown

- **AFH [recalled]:**
  - Start the flare (roundout) precisely. A steep, slow approach gives little margin, and if you flare late you
    fly into the ground.
  - **"A lack of floating during the flare ... is one verification that the approach speed was correct."**
  - Touch down at **minimum controllable airspeed**, at about the **power-off stall attitude**.
  - Avoid closing the throttle too quickly before you are ready to touch down.
- ACS: "minimum float".
- Boldmethod: a steeper descent means a higher sink rate. Flare late and the landing is hard; flare early and
  you stall high with a large sink.
- Competition advice: reduce **power to idle in the roundout**. Variant: carry power to touchdown or just
  above it, then chop it (AOPA 2022).
- Tailwheel:
  - The **three-point (full-stall) landing gives the shortest roll** because touchdown is at minimum speed and
    the high-AoA attitude adds drag (AvWeb, Rich Stowell).
  - The stick is nearly **full aft** as the airplane settles at stall speed.
  - Wheel landings touch down faster, so the roll is longer. They do give better precision and crosswind
    control.
  - Note: in a three-point attitude a tailwheel airplane may or may not be fully stalled. Some Cubs touch
    tail-first if slowed below Vso.

**For the autopilot:**
- Flare height h_f is about 5-10 ft for a Cub [UNSOURCED, typical]. Use an exponential flare: tau of about
  1-1.5 s, target sink 0.5-1.5 ft/s.
- Throttle: ramp from approach power to idle across the flare, reaching idle at or 1-2 ft before main-gear
  contact. Do not cut power at flare start on a back-side approach.
- Tailwheel attitude target = the three-point attitude, with touchdown speed 1.0-1.05 Vso.
- Float timer: if the airplane is still airborne more than 2 s after the flare starts, flag the approach as
  too fast.

Sources:
- https://www.faasafety.gov/files/events/SO/SO15/2024/SO15131753/ShortFieldApproachLanding_afh_ch9.pdf
- https://www.boldmethod.com/learn-to-fly/maneuvers/short-field-landing/
- https://avweb.com/features/tailwheel-landing-battle-three-point-or-wheel/
- https://www.safepilots.org/library/contributed/Tailwheel%20Transition%20FAQ%20-%20Rich%20Stowell.pdf
- https://avweb.com/features/flying-tailwheel-the-checkout/

## 5. Roll-out: flaps, brakes, elevator

- **AFH [recalled]:**
  - Nosewheel airplanes hold the positive pitch attitude while the elevator is effective (aerodynamic
    braking).
  - Tailwheel airplanes are held firmly in the **three-point attitude**.
  - Brake firmly.
  - A forum quote of one AFH edition says to retract the flaps only after stopping or turning off, so FAA
    editions and POHs differ on this.
- POH practice (Cessna, quoted by AOPA): "For maximum brake effectiveness, **retract the flaps, hold full
  nose-up elevator, and apply maximum brake pressure without sliding the tires.**" The Cirrus SR22 POH is the
  same.
- AOPA "Proficient Pilot": dumping flaps on touchdown cuts lift, loads the wheels and reduces tyre skidding.
  Caveats:
  - Wrong-lever risk in retractable-gear airplanes.
  - Slow electric flaps can briefly *increase* lift as they pass about 20 deg.
- Tailwheel: **stick fully aft** for the whole roll. This keeps tailwheel traction and stops the tail rising
  under braking (nose-over).
  - ATSB case: a three-point touchdown too far along, then hard braking, ended with the airplane flipped
    over.
  - Lone "max wheel braking + max up-elevator" lesson-plan wording.
- Competition: "as much braking power as you can add" right after touchdown.

**For the autopilot:**
- On weight-on-wheels: throttle idle, flaps fully up (manual Cub flaps work instantly; for electric flaps use
  the flap-rate model), elevator full aft (tailwheel).
- Brake = k x available, ramping 0 -> 100 % over about 0.5-1 s.
- Anti-skid: release when wheel slip exceeds about 10-15 %.
- Anti-nose-over limiter: cut brake pressure when pitch drops below the three-point attitude by more than
  about 2 deg, or when tail load reaches about 0 [UNSOURCED, design suggestion].
- Rudder holds the centreline (tailwheel airplanes are directionally unstable on the ground).

Sources:
- https://www.aopa.org/news-and-media/all-news/2019/july/pilot/proficient-pilot-flap
- https://www.aopa.org/news-and-media/all-news/2013/august/16/epilot-custom-content
- https://pilotsofamerica.com/community/threads/short-field-landings-and-takeoffs.1710/page-2
- https://www.atsb.gov.au/node/11387
- https://backcountrypilot.org/forum/raising-the-flaps-after-landing-14531

## 6. 50 ft obstacle

- ACS and AFH: the short-field landing and takeoff assume a **50 ft obstacle** (real or simulated). POH
  "total distance" figures are over 50 ft.
- Obstacle-crossing technique (AOPA "ol' drop and plop", forum readings of the AFH): cross the obstacle at
  approach speed, then **progressively reduce power** to steepen the path. The instructor variant is: chop
  power, set minimum speed, lower the nose immediately. Sources disagree on whether to lower or raise the
  pitch afterwards.

**For the autopilot:** treat the obstacle as a hard floor of 50 ft at x_obst. Plan the path so h(x_obst) >= 50 ft
+ 10 ft margin. After crossing, steepen gamma by reducing power (to idle if needed) while holding airspeed at or
above Vapp - 5 kt.

Sources:
- https://www.aopa.org/news-and-media/all-news/2020/october/flight-training-magazine/ol-drop-and-plop
- https://pilotsofamerica.com/community/posts/3538616

---

## 7. Short-field take-off flap setting

- **Piper PA-18 Information Manual:**
  - "A minimum takeoff distance is obtained by beginning the takeoff with **flaps up**, then applying **full
    flaps** when takeoff speed (**30-35 mph**) has been reached."
  - "Half or full flap can be applied to reduce takeoff run; the more flap used the shorter the run."
  - "The best angle of climb is attained with **full flap**." (Best *rate* is flaps up.)
  - This is the factory "flap pop" technique.
- PA-18 flaps have **3 notches** (Wikipedia). Full flap is about **50 deg** (simulator product page only;
  TCDS A-759 not checked [UNVERIFIED]).
- Bush practice:
  - One notch, then full flaps at about 50 mph and rotate (forum).
  - AOPA: start on the first notch and apply full flaps rapidly as the wing goes light.
  - Delay flap until the last moment because flap in the prop wash adds drag (backcountrypilot).
- After lift-off: **never dump flaps**. "Milk" them up slowly in level or shallow climb. Retracting too fast or
  at the wrong time is described as "disastrous".
- AFH/ACS: use the manufacturer's flap setting. Common light-airplane settings are 0-10 deg (Cessna) or 25 deg
  (Piper PA-28). [Cessna/Piper figures UNSOURCED here]

**For the autopilot:** Cub mode: start the roll with flaps 0 or 1 notch. At IAS >= 0.8-0.9 Vs1 (30-35 mph for
a PA-18), command full flaps over about 0.5 s and rotate. After lift-off, hold ground effect, then retract to 1
notch above about 50 ft and Vy - 5, and to 0 above about 300 ft. Retract one notch at a time, with at least
2-3 s between notches.

Sources:
- https://supercubproject.com/downloads/PA-18_Information_Manual.pdf (Piper PA-18 Information Manual)
- https://backcountrypilot.org/forum/why-pop-full-flaps-on-short-take-off-24074
- https://backcountrypilot.org/forum/what-s-your-take-on-this-technique-6321
- https://www.aopa.org/news-and-media/all-news/2008/august/01/short-matters
- https://en.wikipedia.org/wiki/Piper_PA-18_Super_Cub

## 8. Tailwheel take-off attitude and rotation

- **AFH (quoted in a forum post):** "the airplane should be allowed to roll with its full weight on the main
  wheels and accelerated to the lift-off speed ... In tailwheel-type airplanes, the **tail should be allowed to
  rise off the ground slightly, then held in this tail-low flight attitude** until the proper lift-off or
  rotation airspeed is attained."
- Disagreement among pilots:
  - Some (Cessna 170 forum) say a tail-low hold lengthens the roll. They prefer a near-level tail-up attitude
    for acceleration, then rotate.
  - Others (J-3, C170) find tail-low shorter.
- Cub instructors: the Cub "is controllable well below stall speeds", so lift off early and let it fly off.
- UK AAIB PA-18-150 accident: lift-off at about **34 kt (39 mph)** left too little control authority to stop
  a divergence after take-off.
- Soft field: keep weight off the wheels, lift off as early as possible, then accelerate **in ground effect**.
- Short field: accelerate in the lowest-drag attitude, then rotate at the POH lift-off speed.

**For the autopilot:**
- Short field: lift the tail to about 1-3 deg nose-up from level, i.e. "slightly tail-low"; hold it while
  accelerating.
- At V_R of about 1.0-1.1 Vs(take-off flap), possibly after the flap pop, rotate to the three-point attitude
  or slightly less.
- After lift-off, hold 2-5 ft in ground effect until V >= Vx, then climb.
- Soft field: the same sequence, but with the tail held lower and lift-off at about 1.0 Vs.

Sources:
- https://pilotsofamerica.com/community/threads/short-field-takeoffs.34017/
- https://forum.cessna170.org/forums/viewtopic.php?p=47016
- https://www.supercub.org/forum/threads/can-the-tail-get-too-high.50278/post-658814
- https://assets.publishing.service.gov.uk/media/6827189950dbd3ce8372ab22/Piper_PA-18-150_G-CUBX_07-25.pdf

## 9. Climb: Vx to 50 ft, then Vy

- ACS short-field take-off: lift off at the recommended speed, then climb at **Vx +10/-5 kt** (private) or
  **+5/-0 kt** (commercial) **until the obstacle is cleared or 50 ft AGL**. Then pitch for **Vy ±5 kt** (one
  plan says +10/-5). Retract flaps and gear after clearing obstacles or as the manufacturer says.
- AFH: a 5 kt deviation from Vx can noticeably reduce climb performance.
- PA-18:
  - Best angle is with full flap (Piper manual), but the **numeric Vx and Vy could not be read [UNSOURCED]**.
  - Commonly quoted values are about 45-50 mph Vx (flaps) and about 74-75 mph Vy (clean). Not confirmed.
  - Rate of climb is **960 fpm** (PA-18-150, Wikipedia/GlobalAir).
  - [DERIVED] With Vso = 43 mph CAS, Vx of about 45-50 mph is about **1.05-1.15 Vso**, and Vy of about 75 mph
    is about 1.6-1.75 Vso.

**For the autopilot:** climb at Vx = 1.1-1.2 Vs(current flap) until h >= 50 ft AGL (or above the obstacle + 10
ft). Then lower the nose, accelerate to Vy of about 1.6-1.75 Vso, and retract flaps as in section 7. Speed
tolerance band: -0/+5 kt.

Sources:
- https://www.cfinotebook.net/lesson-plans/private-pilot-airplane/takeoffs-landings-and-go-arounds/private-pilot-short-field-takeoff-and-climb-lesson-plan
- https://atpflightschool.com/downloads/lesson_plans/20_Short_Field_Takeoff_Max_Performance_Climb.docx
- https://avweb.com/features/pelicans-perch-22short-and-soft-field-takeoffs-faa-vs-reality/

## 10. Reference numbers for sanity-checking the sim

| Aircraft | Vso (landing config) | T/O ground roll | T/O over 50 ft | Ldg roll | Ldg over 50 ft | Source |
|---|---|---|---|---|---|---|
| Piper PA-18-150 Super Cub | 43 mph / 38 kt / 69 km/h (flaps down); Vs1 ~47 mph CAS | 200 ft (61 m) | 500 ft (152 m) | 350 ft (107 m) | 725 ft (221 m) | Wikipedia, Plane & Pilot, GlobalAir |
| PA-18-150 alt. data | VS0 40 KIAS, VS1 43 KIAS, VFE 87 KIAS | | | | | metarcentral (not POH) |
| CubCrafters Carbon Cub (SS/FX/EX) | 28 kt / 32 mph / 52 km/h; Vs1 35 kt | ~60 ft (18 m) | 260 ft (79 m) | ~245 ft (75 m); "16 m in competition" | 1,030 ft | Plane & Pilot 2017; aircraft.com listing; GlobalAir |
| Just SuperSTOL / Highlander | 28-32 kt (32-37 mph), slats + Fowler flaps | ~100-150 ft | — | ~100-150 ft | — | Flying, Wikipedia, Aeropedia |
| Zenith STOL CH 701 | ~34 mph / 30 kt (slats, flaperons) | 50-60 ft | — | 80 ft | — | Plane & Pilot, Aeropedia |
| Zenith CH 750 | 35 mph flaps down | 100 ft | — | 125 ft | — | GlobalAir |
| Valdez 2016, Super Cub (Breeden) | — | 40 ft | — | 55 ft | — | AvWeb |
| Valdez 2018 records (modified Cubs) | — | 11 ft | — | 9.5 ft | — | AOPA |

- VGs (Micro AeroDynamics) cut stall by about **5 mph** on J-3/PA-11 (supplier claim) and about 4.4 kt in
  landing configuration on a PA-28. No PA-18-specific certified number was found.
- A Swiss accident report quotes an older PA-18-150 owner's manual "recommended approach speed" of
  **70 mph**. That is far above what bush pilots fly (45-50 mph).

**Sanity check of the sim [DERIVED]:**
- Sim stock Cub: Vref 63 km/h = 34 kt = 39 mph.
  - That is **below** the published PA-18-150 Vso of 69 km/h (0.91 Vso), so either the sim's Vso is lower
    than a real PA-18 or Vref is mislabelled.
  - Expected real values: Vapp = 1.3 Vso = **90 km/h (56 mph)** for the FAA method, or **72-80 km/h (45-50
    mph)** for bush practice.
  - A 63 km/h Vref only makes sense for a J-3-weight or VG/slat-equipped Cub, or as a touchdown speed rather
    than an approach speed.
- Sim landing roll 62 m (203 ft) against a book roll of 107 m (350 ft). That is about 0.6x the book figure:
  plausible for an expert max-braking, flap-dump landing (a competition Super Cub did 17 m), but short for
  "standard" technique.
- STOL Cub in the sim should approach a Carbon Cub: Vso about 52 km/h, roll about 75 m at book technique,
  20-40 m with competition technique.

Sources:
- https://en.wikipedia.org/wiki/Piper_PA-18_Super_Cub ; https://www.planeandpilotmag.com/article/piper-pa-18-super-cub/
- https://www.globalair.com/aircraft-specifications/piper/piper-pa-18-150-specifications/503 ; https://metarcentral.com/aircraft/pa18
- https://planeandpilotmag.com/article/2017-cubcrafters-carbon-cub ; https://www.aircraft.com/aircraft/200995507/sp-yfx-2016-cubcrafters-carbon-cub-fx
- https://www.globalair.com/aircraft-specifications/cubcrafters/carbon-cub-ex2-specifications/1897
- https://www.flyingmag.com/news-new-highlander-superstol/ ; https://en.wikipedia.org/wiki/Just_Superstol
- https://planeandpilotmag.com/article/zenith-aircraft-company-stol-ch-701-801 ; https://aeropedia.com.au/content/zenair-stol-ch-701/
- https://avweb.com/flight-safety/breeden-wins-valdez-stol/ ; https://www.aopa.org/news-and-media/all-news/2018/may/17/valdez-stol-distances-get-shorter
- https://www.aircraftspruce.ca/catalog/appages/microvgkits3.php ; https://www.flightglobal.com/vortex-expansion/34904.article
- https://www.sust.admin.ch/inhalte/AV-berichte/565.pdf

## Not sourced (open items)
- Numeric PA-18 Vx and Vy, and the Carbon Cub POH Vx, Vy and approach speed. The PA-18 manual table could not be
  read.
- Glide-path angle in degrees for short-field and STOL approaches (only derived values are given).
- PA-18 flap angles per notch (the 50 deg full-flap figure is unverified) and the slip-with-flaps limit.
- The exact current AFH (3C) wording on flap retraction during the landing roll. Editions and POHs differ.
- Flare height and timing numbers for a Cub.
