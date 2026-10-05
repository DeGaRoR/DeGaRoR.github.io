# SND-BOOMBOX: evidence to take on the box (G1710-G1714)

Cloud sessions can't render the game. On the box, run:

    node tools/_serve.js 8450 ..          (from flyDiy/, in another terminal)
    node tools/perf/boombox_evidence.js   [--url http://localhost:8450/flyDiy/dev.html] [--out reports/evidence/SND-BOOMBOX]

The script presses everything with real mouse and keyboard events (CDP Input.*). It reads the page only to know when to
shoot. It writes the PNGs and `summary.json` (what was read at each step) into this folder.

## What to check

| file | look for |
|---|---|
| `1_garage.png` | The boombox stands on the floor, abeam to starboard, about 0.6 m off the aeroplane's flank and facing out. It is not inside the aeroplane's footprint and not hidden by the stand. |
| `2_quickbar.png` | Five buttons, top right: inside, ref, **sound** (a speaker with waves), **radio** (a boombox with dashed cones while the music is off), time. Same plate, same 18 px glyph weight as the others. |
| `3_hover.png` | The pointer over the radio: a faint warm pool of light on the floor under it (the cursor is not in a headless screenshot: `summary.json` → `hover.cursor` must read `pointer`). The aeroplane part under the pointer is **not** tinted. |
| `4_panel.png` | One click opens a small card beside the radio. It wears the rail flyout's plate (dark plate, hairlines, uppercase head "RADIO", ×). Inside: now playing, eight station pills (the six, Random, off), music / master sliders, skip, three toggles (Radio Jolene talk, music in the garage, music in flight), MY MUSIC with "choose a folder…", and "music credits". |
| `5_panel_playing.png` | After pressing Lo-fi: Lo-fi is lit, "music in the garage" is on, the now-playing title and artist are filled in, and `summary.json` → `station.garageMusic` is `1`. |
| `6_quickbar_on.png` | The radio button is lit (accent fill) and its cones are solid. `summary.json` → `quick bar, playing.buttons.radio` starts `[on] Radio: Lo-fi / Hip-hop`. |
| `7_after_esc.png` | Esc closed the card (`esc.open` is `false`). |
| `8_audio0_panel.png` | With `?audio=0`: the sound button is greyed ("Sound is off for this page (?audio=0)"). The click still opens the card, which holds one line ("Sound is off for this page (?audio=0).") and a greyed "turn the sound on" button. Nothing else: `audio=0 click.inputs` is `0`. |

## By hand, with headphones (the script can't hear)

- **The folder** (Chromium): open the card, click "choose a folder…", and pick a folder of mp3 / ogg / m4a / wav / flac files.
  - The card says "N tracks from <folder> · played here, never uploaded", and a **My music** pill appears.
  - Press it. Your files play with the same crossfade, with no silences between them and no Radio Jolene talk.
  - Reload, then open the card again. Either the folder comes straight back, or a "reconnect <folder>" button asks the browser's permission once.
  - "forget" drops the folder and its station.
  - In Firefox or Safari, the picker is the folder input, and the card says the folder must be chosen again each visit.
- **The [ / ] keys** step the stations as before. With a folder there, they also reach My music after Random. The quick bar's title follows the station.
- **Right-click** (or a 600 ms hold) on the radio button switches the radio off. Press it again and the last station comes back.
- **The lean** (G1714): orbit the camera close to the radio. Within about 2 m the garage music sits slightly toward its side (at most a third of the way). From the far side of the aeroplane it is centred, and in flight it is centred.
- **Clicks on the aeroplane**: a part standing in front of the radio still selects the part, never the radio.
