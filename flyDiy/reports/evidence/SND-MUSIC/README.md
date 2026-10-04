# SND-MUSIC — evidence (G1670–G1674)

No real music ships yet: `src/viewer/audio/music_catalogue.json` is `[]` until the coordinator writes the user's
picks from the "flyDiy Music Picks" board. With an empty catalogue the player is silent, and the credits
screen says "No music ships yet." Everything below is what the player does once tracks are in it. A cloud session
cannot hear anything: these are the gate's numbers and a node simulation, not a listening test.

## What you should hear in the garage

1. **The loading screen (welcome).** Nothing plays before your first click or key (the browser requires one, and
   the game has no click-to-start). From that click on, a welcome track fades in over 4 s while the load carries on.
   Only one `<audio>` element streams (~16 KB/s at 128 kbps). The track is decoded by the browser's media thread,
   never into the page's memory.
2. **The shed opens.** A welcome track that is also tagged `garage` **plays on** into the shed, with no cut. A track
   that is not tagged `garage` fades out over 4 s, and a garage track starts.
3. **In the shed** each track plays to its end. Then comes **silence of 30 s to 2 min** (random each time), then
   the next track at full level. Every track in the garage list plays once before any track repeats, and a new
   round never opens on the track that closed the last one (see `garage_hour_simulated.txt`: an hour with 5
   garage tracks, no track twice in a row, silences of 39–120 s).
4. **When a track starts**, a small line appears bottom-left of the workshop view for 6 s:
   `♪ Title — Artist · CC0`. It then fades out.
5. **Engine start in the shed** (the starter, then the catch): the music dips by 10 dB within ~0.3 s. It holds
   while the events keep coming and comes back over ~2 s about 6 s after the last one.
6. **Roll out to fly.** With *music in flight* off (the default), the music fades out over 4 s and its element is
   emptied, so nothing streams in flight. With it on, music plays **only in a cruise**: off the ground, at least
   200 m above the ground for 20 s, flaps up, and not descending low (below 450 m at more than 2.5 m/s down is
   the approach). It stops when you drop under 120 m, put flaps out, start the approach or touch down.
7. **Back in the shed**, the track you left resumes where it stopped, if more than 20 s of it remained.
8. **The sound menu** (both rails) adds *music in the garage* (on; it covers the welcome too), *skip track*
   (a 4 s crossfade to the next track; in a silence, the wait ends), and *music credits*.
9. **Hidden tab, pause or unfocused window**: the music pauses with the rest of the sound and continues on return.

The crossfades (welcome, cruise, photo, skip, and a context change) are **equal-power**: the two gains are
trim·sin and trim·cos of the same phase, so the loudness holds steady through the 4 s, with no dip in the middle.
Each track also plays at its own trim, `−16 LUFS − lufs` from the catalogue, clamped to −12…+6 dB.

## Credits

The shed's information panel has an about line (`#credit`, where the PA-18 / C172 CC-BY credits are). It gains a
**music & sound credits** link. The screen it opens lists every catalogue track (its credit line, linked to its
page) and then the sound's origins: the engine synth's Antonio-R1 / DasEtwas (MIT) and Baldan et al. CREDITS.md's
music list is generated from the same catalogue (`node tools/audio/music_credits.js`), and GATE AUDIO fails if the
two differ.

## The A/B switch

`?audio=0` builds nothing: no music, no elements. The credits link is still there, because attribution does not
depend on the sound.

## The gate (node, `node tools/audio/_audio_check.js`, ~5 s)

```
MUSIC_CAT      the catalogues validate (the shipped one, the test one, the run one); validate refuses NC, unhashed
               files, files outside media/audio/music, unknown contexts, no duration, no artist, silly lufs, a
               repeated id; the test tracks are named by their bytes, last what they say, weigh < 100 KB; trim;
               a track's URL = FLYDIY_ASSET_BASE + media/audio/music/<stem>.<h8>.mp3
MUSIC_CTX      welcome (bus at its volume under the loading screen) -> garage (the track carries) -> flight with
               the setting off (faded, 0 streaming at 4.5 s, bus 0, a 40 s cruise stays silent) -> setting on:
               ground silent, 15 s climb silent, 22 s level = cruise (cruise tracks only), flaps out / the approach /
               100 m AGL = silence; garage setting off = silence, on = resumes the left track past where it was;
               photo hook; hidden tab pauses, back plays; sound off/on: 2 NEW elements (an element connects once)
MUSIC_SHUFFLE  bags of 2/5/7 over 60 rounds: no repeat inside a round, no round opening on the last; failed
               tracks skipped, all-failed -> -1; 24+ welcome starts: rounds of 4 distinct, never twice in a row
MUSIC_GAPS     an hour in the shed: >= 12 tracks, every silence in 30..120 s, spread > 30 s; then 20 min: never 3
               elements, two together only for the 3 s preload, nothing streaming in a silence but its last 3 s
MUSIC_XFADE    both fades in one 4 s window, power sum within 2 % of 1, silence to silence, the level = the trim;
               skip = a new track and, 5 s later, one element
MUSIC_DUCK     -10 dB (+-0.5) 1 s into an engine start, held while events repeat, 0 dB 11 s after the last
MUSIC_BUDGET   no decodeAudioData / new Audio() in music.js; 2 elements + 2 media sources per context, born
               preload 'none'; a steady shed schedules no AudioParam; the music's update: 0 GC and no heap growth
               over 100 000 frames (~0.1 us a frame)
MUSIC_CREDITS  creditRows = the catalogue (three catalogues); the about-line button opens the screen; its rows =
               the catalogue's ids in order; it names every sound origin; CREDITS.md's block = the shipped catalogue's;
               its Sound section names every origin
MUSIC_WIRING   build.js lists audio/music.js before app.js and inlines music_catalogue.json as FLYDIY_MUSIC; sw.js
               answers Range requests from the cache; src_engine.js emits engine start / catch; the settings carry
               "music in the garage" (on); the menu draws music in the garage / skip track / music credits
SELFTEST       73 mutations of the source text (27 core + 46 music), each turns its check red; files byte-identical
```
