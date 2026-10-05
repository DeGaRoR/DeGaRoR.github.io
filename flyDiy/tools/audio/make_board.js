// SND-ASSETS: fill board_template.html for one listening board.
//   node tools/audio/make_board.js music|sounds|engine   -> assets/audio/board/<kind>/board.html
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const BOARDS = {
  music: {
    title: 'flyDiy Music Picks',
    intro: "51 free (CC0) tracks shortlisted for the game: one minute of each, levelled to the same loudness. Mark each one keep, maybe or no, and tag where it would play. Your picks are saved for the Sound Coordinator, who reads them back to prepare the game's playlist.",
    contexts: ['garage', 'welcome', 'cruise', 'photo mode'], labels: ['Keep', 'Maybe', 'No'],
  },
  sounds: {
    title: 'flyDiy Sound Picks',
    intro: 'Free (CC0) field recordings and effects from freesound.org, up to 25 s of each from its middle, levelled. Keep the ones that sound right for a quiet Southeast Alaska island and its airstrips; tag how each would be used. The Sound Coordinator turns your keeps into the game\'s loops and one-shots.',
    contexts: ['loop', 'one-shot', 'hero (use as is)', 'needs cleaning'], labels: ['Keep', 'Maybe', 'No'],
  },
  stations: {
    title: 'flyDiy Radio Picks',
    intro: 'Three candidates for each new calm station (Jazz & Blues, Dub & Reggae, Electronic & Ambient, Classical, Acoustic), free under CC0 or CC-BY (credited). One minute each, levelled. Keep what fits; the station tags let you move a track to another station. Lo-fi is already filled from your HoliznaCC0 picks.',
    contexts: ['Jazz & Blues', 'Dub & Reggae', 'Electronic & Ambient', 'Classical', 'Acoustic'], labels: ['Keep', 'Maybe', 'No'],
  },
  jazzclass: {
    title: 'flyDiy Jazz & Bach',
    intro: 'Five public-domain candidates: classic jazz from 1923-24 (US public domain, over 70 years old in Europe, so the old shellac crackle comes with it) and two pieces of Kimiko Ishizaka’s CC0 Open Goldberg Variations for the classical station. The two Ketsa jazz tracks are already in.',
    contexts: ['Jazz', 'Classical', 'Radio Jolene (heritage hour)'], labels: ['Keep', 'Maybe', 'No'],
  },
  gtjazz: {
    title: 'flyDiy Lounge Jazz',
    intro: 'Modern, calm jazz for the Jazz station, closer to a racing game’s menu music than to the 1920s: five CC-BY candidates (credited). The two Ketsa tracks you approved are already in. One prolific catalogue of smooth-jazz tracks was left out because it looks machine-generated.',
    contexts: ['Jazz', 'Lo-fi / Hip-hop', 'Dub / Ambient'], labels: ['Keep', 'Maybe', 'No'],
  },
  voices: {
    title: 'Radio Jolene Voices',
    intro: 'Four clean, offline AI voices for Radio Jolene (Piper, trained on public-domain or CC-BY readings). Each reads the station ID, a bulletin and the airfield weather assembled from recorded words, as the game plays it. john ships today; pick the one you prefer.',
    contexts: ['warm', 'too robotic', 'too fast', 'weather sounds stitched'], labels: ['Best', 'OK', 'No'],
  },
  engine: {
    title: 'flyDiy Engine Lab',
    intro: "The procedural engines as they sound today, rendered offline from the exact code the game runs (no propeller yet: that comes next). Judge each render and say what's off. Your notes go to the tuning session.",
    contexts: ['pitch wrong', 'too synthetic', 'too loud', 'too quiet', 'idle too rough', 'love it'], labels: ['Right', 'Close', 'Wrong'],
  },
};
const kind = process.argv[2];
const B = BOARDS[kind];
if (!B) { console.log('usage: make_board.js ' + Object.keys(BOARDS).join('|')); process.exit(1); }
const t = fs.readFileSync(path.join(__dirname, 'board_template.html'), 'utf8');
const out = t.split('__TITLE__').join(B.title).split('__BOARD__').join(kind).split('__INTRO__').join(B.intro)
  .split('__CONTEXTS__').join(JSON.stringify(B.contexts)).split('__LABELS__').join(JSON.stringify(B.labels));
const dir = path.join(ROOT, 'assets', 'audio', 'board', kind);
fs.writeFileSync(path.join(dir, 'board.html'), out);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3') || f === 'index.json').map(f => ({ path: f }));
fs.writeFileSync(path.join(dir, 'files.json'), JSON.stringify(files));
console.log(kind, files.length, 'files');
