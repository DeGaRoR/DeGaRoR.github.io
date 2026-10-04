# SND-VOICE — Radio Jolene's voice (G1626–G1629, 2026-10-04)

**Pick by ear:** open `index.html` in this folder (served by Pages next to the game), or play the MP3s directly.
Each shortlisted voice reads the same three things:

| | station ID | a bulletin | the AWOS, assembled from words (the gusty, low-ceiling day) |
|---|---|---|---|
| **john** (shipped) | `john_station_id.mp3` | `john_bulletin.mp3` | `john_awos_gusty_low.mp3` |
| norman | `norman_station_id.mp3` | `norman_bulletin.mp3` | `norman_awos_gusty_low.mp3` |
| libritts (speaker 856) | `libritts_station_id.mp3` | `libritts_bulletin.mp3` | `libritts_awos_gusty_low.mp3` |
| cori (female, UK) | `cori_station_id.mp3` | `cori_bulletin.mp3` | `cori_awos_gusty_low.mp3` |

The AWOS observation (`demos.json`): 1753Z, wind 268° 15 kt gusting 26, 2 SM in light rain and mist, scattered 300,
ceiling 600 broken, 1400 overcast, −2 °C over −4, altimeter 29.92. The AWOS demo is exactly what the game plays:
`VOICE_MODEL.awosClips(obs)` laid end to end with its rests (`tools/audio/prep_voice.js`'s `assemble`, the same
timeline `AUDIO_VOICE.play` schedules). **What to listen for:** the warmth and the pace of the lines; in the AWOS,
whether the digits run like a real automated station (each group falling on its last digit) or sound stitched.

Switching the shipped voice is one command: `node tools/audio/prep_voice.js --voice norman` (then commit
`media/audio/voice/`, the catalogue and CREDITS.md, which the run rewrites).

## The voice table

Every row read from the voice's own MODEL_CARD (copied into `cards/`). Engine for all: **Piper 1.2.0
(rhasspy/piper) + piper-phonemize 1.1.0, MIT** — pinned, because the maintained successor on PyPI (piper-tts ≥ 1.3,
OHF-Voice/piper1-gpl) is **GPL-3.0**. The engine is a render tool only; nothing of it ships (piper-phonemize drives
espeak-ng, GPL-3.0, for the phonemes; a program's output is not covered by its licence). Model files: the
rhasspy/piper-voices repository, MIT.

| voice | who | engine licence | model licence | dataset (licence, URL) | training lineage | quality | verdict |
|---|---|---|---|---|---|---|---|
| **en_US-john-medium** | male, US | MIT | MIT | LibriVox readings, one reader, ~12.5 h — **public domain** — https://librivox.org | fine-tuned 600 epochs from en_US-kristin-medium, itself **trained from scratch** on public-domain LibriVox (11.5 h) | medium, 22.05 kHz | **SHIPPED** |
| en_US-norman-medium | male, US | MIT | MIT | LibriVox readings, one reader, ~15.5 h — **public domain** — https://librivox.org | **trained from scratch**, 1200 epochs | medium, 22.05 kHz | clean; close second |
| en_US-libritts-high (speaker 856) | male, US (one of 904 speakers) | MIT | MIT | LibriTTS train-clean-360 — **CC BY 4.0** (credit: Zen et al., Google) — http://www.openslr.org/60/ | **trained from scratch** | high, 22.05 kHz | clean with credit |
| en_GB-cori-high | **female, UK** | MIT | MIT | LibriVox readings, one reader, ~24 h — **public domain** — https://librivox.org | **trained from scratch**, 500 epochs | high, 22.05 kHz | clean; the female alternative |
| en_US-kristin-medium | female, US | MIT | MIT | LibriVox, public domain | trained from scratch | medium | clean (not shortlisted) |
| en_US-ljspeech-high / -medium | female, US | MIT | MIT | LJ Speech, public domain — https://keithito.com/LJ-Speech-Dataset/ | trained from scratch | medium settings | clean (not shortlisted) |

The three LibriVox voices were compiled and trained by Bryce Beattie (the cards point to
https://brycebeattie.com/files/tts/). LibriVox recordings are dedicated to the public domain.

### Turned down (cards in `cards/rejected/`)

**The finding that matters:** most Piper English voices are **fine-tuned from `en_US-lessac`**, whose dataset is
the Blizzard Challenge 2013 Lessac data under CSTR's **research-only licence** — their weights descend from it,
whatever their own dataset's licence. That rules out even voices with a clean dataset of their own:

| voice | dataset licence (card) | lineage | why not |
|---|---|---|---|
| en_GB-alan (low, medium) | "See URL" (Mycroft mimic3 apope) | lessac / ryan | unclear dataset licence **and** a restricted base |
| en_GB-alba-medium | CC BY 4.0 | fine-tuned from lessac | lessac lineage |
| en_GB-aru-medium | CC BY 4.0 | fine-tuned from lessac | lessac lineage |
| en_GB-vctk-medium | CC BY 4.0 | fine-tuned from lessac | lessac lineage |
| en_GB-jenny_dioco-medium | "See URL" (custom) | fine-tuned from lessac | unclear + lessac |
| en_GB-northern_english_male-medium | CC BY-SA 4.0 | lessac | share-alike + lessac |
| en_GB-southern_english_female-low | CC BY-SA 4.0 | fine-tuned from ryan | share-alike; ryan is NC |
| en_GB-semaine-medium | CC BY-NC-SA 4.0 | lessac | non-commercial |
| en_US-lessac-medium | CSTR Blizzard 2013 licence (research) | from scratch | restricted |
| en_US-ryan-high | CC BY-NC-SA 4.0 | from scratch | non-commercial |
| en_US-kathleen-low | CC0 | fine-tuned from ryan (NC) | NC base |
| en_US-danny-low | "See URL" | fine-tuned from ryan | unclear + NC base |
| en_US-joe-medium | CC0 | fine-tuned from lessac | lessac lineage |
| en_US-libritts_r-medium | CC BY 4.0 | fine-tuned from lessac | lessac lineage |
| en_US-amy-medium, kusal, arctic | "See URL" / "See LICENSE file" | lessac | unclear + lessac |
| en_US-sam-medium | Apache-2.0 | lessac | lessac lineage |
| en_US-reza_ibrahim-medium | CC0 | lessac | lessac lineage |
| en_US-hfc_male-medium | CC BY-NC-SA 4.0 | lessac | non-commercial |
| en_US-bryce-medium | public domain | fine-tuned from an **unreleased** voice | lineage unknowable |

No Piper UK **male** voice has a clean lineage today (alan, northern_english_male, vctk all descend from lessac), so
the user's "Microsoft George" register is matched in character (low, even, unhurried), not in accent. Cori is UK.

## How the voices compare (measured, no ear involved)

No session can listen, so intelligibility was measured by an offline speech recogniser (Whisper base.en through
sherpa-onnx, both fetched from GitHub releases, never shipped) on the rendered clips:

| | john | norman | libritts 856 | cori |
|---|---|---|---|---|
| AWOS words recognised alone (80 clips, carrier-rendered) | 55 | 51 | 56 | 58 |
| same, rendered as LONE words (before the carrier) | — | 20 | — | — |
| script lines, word error rate (inflated by numerals, "eight to three" → "8-3", and homophones) | 19.9 % | 20.9 % | 20.3 % | 16.5 % |
| pace, words / s (lines at length scale 1.08) | **1.95** | 2.37 | 2.58 | 2.23 |
| median pitch (Hz) | 113 | 110 | 119 | 208 |
| the assembled AWOS, transcribed (its slips) | "gusts" → "Goss", "one thousand four hundred" → "1000 before 100", "dew point" lost | "gusts" → "Thus", "six hundred" → "6. Condred", "niner" → "minor" | "scattered" → "Standard", "dew point" lost | "five" → "Fai", "visibility" → "Pissibility", "altimeter" → "Ultimeter" |

The ASR mishears single words that a listener would not ("mist" → "missed", "dew point" → "do point", "haze" →
"Hayes"); the numbers matter as a comparison, not as absolutes. **John ships** for the calmest pace of the four and
the best male intelligibility; Norman is within noise of it. The user's ear decides.

## What makes the concatenation sound read and not stitched

1. **Carriers.** VITS voices are trained on sentences; asked for a lone "seven" they mumble (norman: 20 of 80 words
   recognised). Each word of one or two is rendered inside a comma list — `"zero, seven, zero."` — and cut out of
   it at the middles of the comma pauses, using the model's own phoneme durations (`voice_render.py`'s ALIGNED: the
   graph's `/Ceil` node exposed as an output; a frame is 256 samples). Norman: 20 → 51 of 80.
2. **Two takes per digit.** A continuing one (`"seven,"`, from the middle of the list — the voice holds up) and a final
   one (`"seven."`, from the end — the voice falls). `awosClips` ends each group on the final take: "one five" in
   "at one five, gusts two six" holds up before the gust and falls after it.
3. **Rests.** 50 ms between words of a group, 280 ms between groups, 550 ms between sentences (`VOICE_MODEL.REST`).
4. **Gap-free playback.** Every MP3 opens with the encoder's pad (lamejs writes no LAME tag); the player finds the
   first sample above 1e-3, plays `[offset, offset + dur]` and starts the next clip exactly at that end plus the
   rest (GATE AUDIO's VOICE_PLAY holds it sample-exact).
5. **Seeded.** The voice's noise nodes get a fixed seed in memory, so a re-render is byte-identical (a re-run of
   `prep_voice.js` changes no file) — and the durations output makes the cut deterministic too.

## The shipped set

`media/audio/voice/`: **169 clips, 251 s, 1.50 MB** (target < 6 MB) — mono 22.05 kHz MP3 at 48 kb/s, each trimmed
(20 ms before the first frame within 45 dB of the loudest, 60 ms after the last), high-passed at 60 Hz, levelled to
−20 LUFS (BS.1770 K-weighting on 100 ms gated blocks: words are shorter than the standard's 400 ms block), never above
−1 dBFS. 24 script lines, 119 vocabulary words (AWOS 64 with the digits and present weather, marine 49 with their
numbers, 6 back-announce frames), and per music track (12 today) its back-announce sentence and its title (12 + 12), and its artist
(2, deduplicated).
