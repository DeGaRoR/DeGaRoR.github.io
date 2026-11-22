#!/usr/bin/env node
// ============================================================================
// THE STORY PACK (STORY-REVAMP, 22 Nov 2026) - writes src/missions/story.json: the game layer as ONE mission pack.
//   node tools/_story_pack.js            write the pack
//   node tools/_story_pack.js --check    exit 1 when the file differs from a fresh write (GATE STORYPACK 9)
//   node tools/_story_pack.js --table    the structure as a table (counts, steps, tracks - no words)
// The user's rulings it follows (flyDiy/reports/story-revamp-inputs/, the backbone stories of 22 Nov):
//   - NO GENERATED JOBS: rules.jobs 'none' - the board is this file and nothing else; the regular work is a mission that
//     REPEATS (repeat: { every }).
//   - CONTRACTS IN ANY ORDER: every contract sits in an any-order chapter; a `needs` is written only where one flight
//     cannot make sense before another.
//   - PROJECTS = ORDERED STEPS TIED TO A SITE: a project declares its steps; a step names its missions, its works (cost,
//     days on the career's clock), its site and the world stage it builds (track); what a step or a project GIVES is
//     machinery (no buying).
//   - THE SANDBOX = THE FINAL STAGE: a step's track is a value of 72_ CONTRACT_TRACKS; no career = every track at its max.
//   - "This is a game about building planes": rules.unflyable 'offer' - a delivery no validated design can fly is on the
//     board all the same; the player builds the aeroplane for it.
// THE WORDS are drafts (draft: true): short, to be rewritten by whoever writes the story. This file is the authoring
// source until the mission editor takes the pack over (then: drop this tool, keep the gate).
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const BUILTIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'builtin.json'), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));

const text = {}, missions = [], projects = [], chapters = {};
const T = (k, t) => { text[k] = { t, draft: true }; return k; };
// ---- the steps' shorthands -------------------------------------------------------------------------------------------
const carry = (from, to, kg, pax, more) => Object.assign({ do: 'carry', from, place: to, load: { kg: kg || 0, pax: pax || 0 } }, more || {});
const land = to => ({ do: 'land', place: to });
const photo = (from, at) => ({ do: 'photo', from, place: at });
const leg = (...steps) => ({ steps });
const item = (id, kind, kg, dims) => ({ id, kind, kg, dims });
// a mission: M(id, provider, chapter, { kind, legs, pay, rep, needs, repeat, client, goods ... }, title, brief, done?)
function M(id, provider, chapter, o, title, brief, done) {
  const m = Object.assign({ id, provider, kind: o.kind || 'contract', title: T('ms.' + id + '.title', title), brief: T('ms.' + id + '.brief', brief) }, o);
  m.pay = typeof o.pay === 'number' ? { base: o.pay } : o.pay;
  m.rep = { provider, gain: o.rep == null ? 0.5 : o.rep };
  if (done) m.onDone = Object.assign({}, m.onDone || {}, { say: { who: o.client || CLIENT_OF[provider], text: T('ms.' + id + '.done', done) } });
  missions.push(m);
  if (chapter) (chapters[chapter] = chapters[chapter] || []).push(id);
  return id;
}
// a mission kept from the built-in pack (its record as it is, its words 72_'s), with what the story pack changes
function KEEP(id, chapter, change) {
  const m = clone(BUILTIN.missions.find(x => x.id === id));
  if (!m) throw new Error('no built-in mission ' + id);
  delete m.needs;                                               // contracts in any order: a need is written here, or not at all
  Object.assign(m, change || {});
  if (m.unlock === null) delete m.unlock;
  missions.push(m);
  if (chapter) (chapters[chapter] = chapters[chapter] || []).push(id);
  return id;
}
const CLIENT_OF = { field: 'leonard', minedock: 'pete', resort: 'martha', survey: 'kate', clients: 'adam', home: 'sophie', community: 'james', aeroclub: 'stig' };

// ---- THE CLIENTS THE PACK BRINGS -------------------------------------------------------------------------------------
// (their faces are STAND-INS from the existing portraits: reports/STORY-REVAMP.md, the gaps)
const clients = [
  { id: 'home', fields: ['w1', 'cb_sea'], track: 'home', person: 'sophie', colour: '#c9785a' },
  { id: 'community', fields: ['w6', 'w7'], track: 'community', person: 'james', colour: '#7d9a8c' },
];
T('prov.home.name', 'Home'); T('prov.home.short', 'Home');
T('prov.home.desc', 'Your own strip in the middle of the island, and everything it could become.');
T('prov.community.name', 'The Muskeg Community'); T('prov.community.short', 'Community');
T('prov.community.desc', 'They came for the quiet and they mean to keep it. Supplies are welcome. Visitors are a committee matter.');

// ======================================================================================================================
// THE FIELD TRUST (leonard) - HOME, the villages, the back-country strips
// ======================================================================================================================
KEEP('field.01', 'field.work');
KEEP('field.02', 'field.work');                                  // the tutorial's one job (79_ STORY_JOB): its id is the story's
KEEP('field.n1', 'field.work');
M('field.round', 'field', 'field.work', { legs: [leg(carry('HOME', 'w5', 20, 0), carry('HOME', 'w3', 20, 0))], pay: 1400, rep: 0.25, repeat: { every: 3 }, goods: 'goods.mail' },
  'The mail round', 'Two sacks, two strips: the Cannery and the Fishing Village, in the order you like. It comes round again.');
M('field.hike', 'field', 'field.work', { legs: [leg(carry('HOME', 'w8', 60, 0))], pay: 2200, goods: 'goods.supplies' },
  'Trail supplies', 'Sixty kilos of supplies for the trail crew at the Hiking Strip. The strip is dirt. After rain it is something else.');
M('field.ridge', 'field', 'field.work', { legs: [leg(carry('w3', 'w4', 0, 1))], pay: 2400 },
  'A lift up the mountain', 'One passenger from the Fishing Village to the Mountainside Strip. You land uphill. You will see why.');
M('field.cannery', 'field', 'field.work', { legs: [leg(carry('w5', 'HOME', 80, 0))], pay: 2000, goods: 'goods.parts' },
  'The cannery\'s crates', 'Eighty kilos out of the Cannery Runway and back to the field. Short strip, full load: mind the far end.');
// THE OLD HANGAR (the track `field`: made safe, roofed, restored - HOME.2's derelict stages) -> the metal shop
M('hangar.01', 'field', null, { legs: [leg(carry('w3', 'HOME', 60, 0))], pay: 2200 },
  'Props for the old hangar', 'Sixty kilos of shoring props from the Fishing Village. The Trust wants the old wartime hangar standing before it wants it pretty.');
M('hangar.02', 'field', null, { legs: [leg(carry('w5', 'HOME', 0, 1))], pay: 2000 },
  'The engineer', 'A structural engineer is waiting at the Cannery Runway with a hard hat and an opinion. Bring both.');
M('hangar.03', 'field', null, { legs: [leg(carry('w3', 'HOME', 90, 0))], pay: 2600 },
  'Roof sheets', 'Ninety kilos of roofing sheet from the Fishing Village: all a small aeroplane will take in one go.');
M('hangar.04', 'field', null, { legs: [leg(carry('w5', 'HOME', 80, 0))], pay: 2400 },
  'Rivets by the crate', 'Eighty kilos of fasteners out of the Cannery Runway. Leonard counted them. Twice.');
M('hangar.05', 'field', null, { legs: [leg(carry('w3', 'HOME', 120, 0))], pay: 4500, rep: 1 },
  'The door motor', 'A hundred and twenty kilos in one piece: the motor for the big doors. Not a job for the smallest aeroplane you own.',
  'She opens. First time since the war. The machines inside are yours to use: I would not know which end to hold.');
projects.push({ id: 'hangar', name: 'The old wartime hangar', client: 'field',
  steps: [
    { id: 'safe', missions: ['hangar.01', 'hangar.02'], works: { cost: 0, days: 2 }, site: { id: 'HOME', state: 'safe' }, track: 'field:1' },
    { id: 'roof', missions: ['hangar.03', 'hangar.04'], works: { cost: 0, days: 3 }, site: { id: 'HOME', state: 'roof' }, track: 'field:2' },
    { id: 'restored', missions: ['hangar.05'], works: { cost: 0, days: 3 }, site: { id: 'HOME', state: 'restored' }, track: 'field:3', gives: ['kit:metal', 'tech:2'] },
  ], onDone: { abilities: [] } });
// THE TOTEM SITE (the track `heritage`: East Point, 150 m in the forest, never lengthened)
M('heritage.01', 'field', null, { legs: [leg(carry('HOME', 'nv_strip', 0, 1))], pay: 5200, rep: 1 },
  'The appraisal', 'One appraiser to East Point Clearing: a hundred and fifty metres in the trees, the sea at one end. The experts swear it can be done. The experts are not flying.');
M('heritage.02', 'field', null, { legs: [leg(carry('w3', 'nv_strip', 300, 0, { load: { kg: 300, pax: 0, items: [item('totem', 'long', 300, [3.0, 0.6, 0.6])] } }))], pay: 15000, rep: 1.5 },
  'The totem', 'Three metres of carved cedar, three hundred kilos, from the Fishing Village to East Point. It does not come apart. Neither should you.',
  'It stands. The whole island will come and look at it, and nobody will ask how it got there. You and I will know.');
projects.push({ id: 'heritage', name: 'The totem site', client: 'field', requires: { projects: ['mine'] },
  steps: [
    { id: 'appraisal', missions: ['heritage.01'], works: { cost: 0, days: 3 }, site: { id: 'nv_strip', state: 'cleared' }, track: 'heritage:1' },
    { id: 'totem', missions: ['heritage.02'], site: { id: 'nv_strip', state: 'raised' }, track: 'heritage:2' },
  ] });

// ======================================================================================================================
// THE MINE AND THE DOCK (pete) - the old mine as a heritage site, the harbour, the lumber camp
// ======================================================================================================================
KEEP('minedock.n1', 'minedock.work');
KEEP('minedock.b1', 'minedock.orders');
KEEP('minedock.b2', 'minedock.orders');
KEEP('minedock.01', null);                                       // look at it
KEEP('minedock.02', null, { unlock: null });                     // the experts (its stage is the step's now)
M('mine.03', 'minedock', null, { legs: [leg(carry('HOME', 'mn_strip', 60, 0), carry('w3', 'mn_strip', 60, 0))], pay: 3600, goods: 'goods.parts' },
  'Lime and timber', 'Sixty kilos from the field, sixty from the Fishing Village, both to Copperhead Mine Street. One big aeroplane or two small trips: the old street does not care.');
M('mine.04', 'minedock', null, { legs: [leg(carry('HOME', 'mn_strip', 0, 2))], pay: 3800, rep: 1 },
  'Opening day', 'The first two paying visitors to the old mine. You land in the middle of the village, as people always did. Try to look as if it is normal.',
  'They loved it. One of them asked if the landing is always like that. I said yes.');
M('mine.tour', 'minedock', 'minedock.work', { legs: [leg(carry('HOME', 'mn_strip', 0, 2)), leg(carry('mn_strip', 'HOME', 0, 2))], pay: 3000, rep: 0.25, repeat: { every: 2 }, needs: { projects: ['mine'] } },
  'The mine tour', 'Two visitors out to Copperhead Mine Street, two back. The regulars of the season.');
projects.push({ id: 'mine', name: 'The old Copperhead mine', client: 'minedock',
  steps: [
    { id: 'look', missions: ['minedock.01'], site: { id: 'mn_strip', state: 'surveyed' } },
    { id: 'experts', missions: ['minedock.02'], works: { cost: 0, days: 2 }, site: { id: 'mn_strip', state: 'scaffold' }, track: 'minedock:1' },
    { id: 'materials', missions: ['mine.03'], works: { cost: 0, days: 4 }, site: { id: 'mn_strip', state: 'restored' }, track: 'minedock:2' },
    { id: 'opening', missions: ['mine.04'], site: { id: 'mn_strip', state: 'open' } },
  ] });
// THE HARBOUR (the track `minedock` 3-4: Greywater's dock site, then the cold store and the slipway) - by floatplane
KEEP('minedock.05', null, { unlock: null });
KEEP('minedock.06', null, { unlock: null });
projects.push({ id: 'harbour', name: 'Greywater harbour', client: 'minedock', requires: { projects: ['mine'] },   // (one track, two projects: in order)
  steps: [
    { id: 'pier', missions: ['minedock.05'], works: { cost: 0, days: 3 }, site: { id: 'SEA', state: 'pier' }, track: 'minedock:3' },
    { id: 'store', missions: ['minedock.06'], works: { cost: 0, days: 4 }, site: { id: 'SEA', state: 'store' }, track: 'minedock:4' },
  ] });
// THE LUMBER CAMP (the track `lumber`: north of Cedar Harbour, reached by water)
M('lumber.01', 'minedock', null, { legs: [leg(carry('SEA', 'mk_sea', 0, 1))], pay: 2600 },
  'The foreman', 'One foreman from Greywater Dock to Cedar Harbour, with a chainsaw he will not check in. Floats only.');
M('lumber.02', 'minedock', null, { legs: [leg(carry('SEA', 'mk_sea', 150, 0))], pay: 3400, goods: 'goods.gear' },
  'Saws and fuel', 'A hundred and fifty kilos of saws, chain and fuel to Cedar Harbour.');
M('lumber.03', 'minedock', null, { legs: [leg(carry('mk_sea', 'SEA', 0, 2))], pay: 2800 },
  'Crew change', 'Two loggers back to Greywater Dock after three weeks in the trees. Open a window.');
M('lumber.04', 'minedock', null, { legs: [leg(carry('SEA', 'mk_sea', 250, 0))], pay: 5200, rep: 1 },
  'The saw head', 'Two hundred and fifty kilos: the head of the camp\'s mill, to Cedar Harbour. About all a floatplane with four seats will lift.',
  'She is cutting. You hear that? That is money.');
M('lumber.run', 'minedock', 'minedock.work', { legs: [leg(carry('SEA', 'mk_sea', 80, 1))], pay: 2400, rep: 0.25, repeat: { every: 3 }, needs: { projects: ['lumber'] } },
  'The camp run', 'A logger and eighty kilos of supplies to Cedar Harbour. The camp eats, the camp runs.');
projects.push({ id: 'lumber', name: 'The lumber camp', client: 'minedock', requires: { projects: ['harbour'] },
  steps: [
    { id: 'landing', missions: ['lumber.01'], works: { cost: 0, days: 2 }, site: { id: 'mk_sea', state: 'landing' }, track: 'lumber:1' },
    { id: 'camp', missions: ['lumber.02', 'lumber.03'], works: { cost: 0, days: 3 }, site: { id: 'mk_sea', state: 'camp' }, track: 'lumber:2' },
    { id: 'mill', missions: ['lumber.04'], works: { cost: 0, days: 4 }, site: { id: 'mk_sea', state: 'mill' }, track: 'lumber:3' },
  ] });

// ======================================================================================================================
// THE RESORT (martha) - Skyline
// ======================================================================================================================
KEEP('resort.01', 'resort.work');
KEEP('resort.04', 'resort.orders', { unlock: null });
KEEP('resort.b2', 'resort.orders');
M('resort.guests', 'resort', 'resort.work', { legs: [leg(carry('HOME', 'tw_ski', 0, 1)), leg(carry('tw_ski', 'HOME', 0, 1))], pay: 2200, rep: 0.25, repeat: { every: 3 }, goods: 'goods.guests' },
  'Guests up, guests down', 'One guest up to Skyline, one back down. Martha\'s season, a seat at a time.');
KEEP('resort.02', null, { unlock: null });
KEEP('resort.03', null);
M('skyline.03', 'resort', null, { legs: [leg(carry('HOME', 'tw_ski', 90, 0))], pay: 2800, goods: 'goods.supplies' },
  'The kitchen', 'Ninety kilos of kitchen for the lodge at Skyline. The stove is in three pieces. One of them is the heavy one.');
KEEP('resort.05', null, { unlock: null });
projects.push({ id: 'skyline', name: 'Skyline in summer', client: 'resort',
  steps: [
    { id: 'deal', missions: ['resort.02'], site: { id: 'tw_ski', state: 'deal' }, track: 'resort:1' },
    { id: 'lodge', missions: ['resort.03', 'skyline.03'], works: { cost: 0, days: 3 }, site: { id: 'tw_ski', state: 'lodge' }, track: 'resort:2' },
    { id: 'hangar', missions: ['resort.05'], works: { cost: 0, days: 3 }, site: { id: 'tw_ski', state: 'hangar' }, track: 'resort:3' },
  ] });

// ======================================================================================================================
// THE SURVEY (kate) - the counts, East Point, the observatory on Mount Ardent
// ======================================================================================================================
KEEP('survey.01', 'survey.work');
KEEP('survey.02', 'survey.work');
KEEP('survey.03', 'survey.work', { needs: { after: ['survey.01'] } });
KEEP('survey.05', 'survey.work', { needs: { rep: 1 } });
KEEP('survey.04', 'survey.orders', { needs: { rep: 1 } });
// THE OBSERVATORY (the track `observatory`: the tower, the drum, the hall - one a step; its altiport is snow)
M('obs.01', 'survey', null, { kind: 'survey', legs: [leg(photo('HOME', 'mt_strip'), photo('HOME', 'w4')), leg(land('HOME'))], pay: 3200 },
  'First look at Ardent', 'Two passes for the survey: over the summit of Mount Ardent, and over the Mountainside Strip on the way. Pick a day you can see the mountain.');
M('obs.02', 'survey', null, { legs: [leg(carry('HOME', 'mt_strip', 200, 1))], pay: 6500, rep: 1 },
  'Boots on the summit', 'One scientist and two hundred kilos of instruments, onto the snow at Ardent Altiport. Skis. Uphill. No second try.');
M('obs.03', 'survey', null, { legs: [leg(carry('mt_strip', 'HOME', 0, 1))], pay: 3800, needs: { after: ['obs.02'] } },
  'Bring her down', 'The feasibility round is over and the scientist would like a bath. One passenger from Ardent Altiport to the field.');
M('obs.04', 'survey', null, { legs: [leg(carry('HOME', 'mt_strip', 0, 2))], pay: 4200 },
  'The riggers', 'Two riggers to Ardent Altiport. The cableway takes steel. It does not take people.');
M('obs.05', 'survey', null, { legs: [leg(carry('w3', 'mt_strip', 120, 0))], pay: 4600, goods: 'goods.gear' },
  'What the cable car refuses', 'A hundred and twenty kilos of instruments from the Fishing Village to Ardent: too fragile for the cableway, they say. So they asked a pilot.');
M('obs.06', 'survey', null, { legs: [leg(carry('HOME', 'mt_strip', 150, 0))], pay: 5000, goods: 'goods.parts' },
  'The drum\'s bearings', 'A hundred and fifty kilos for the observatory\'s second building.');
M('obs.07', 'survey', null, { legs: [leg(carry('HOME', 'mt_strip', 0, 2))], pay: 4200 },
  'The glaziers', 'Two glaziers to Ardent Altiport, and their lunch.');
M('obs.08', 'survey', null, { legs: [leg(carry('HOME', 'mt_strip', 200, 0))], pay: 6000, rep: 1, goods: 'goods.parts' },
  'The big lens crate', 'Two hundred kilos, one crate, do not tilt. To Ardent Altiport.');
M('obs.09', 'survey', null, { legs: [leg(carry('HOME', 'mt_strip', 250, 0))], pay: 7000, rep: 1, goods: 'goods.parts' },
  'The groomer', 'Two hundred and fifty kilos of snow groomer for a wider, kinder strip on Ardent. The last time you land on the narrow one.',
  'A station on the highest point of the island, and half of it came up in your aeroplane. The lab is open to you: use it.');
projects.push({ id: 'observatory', name: 'The Ardent observatory', client: 'survey', requires: { projects: ['hangar'] },
  steps: [
    { id: 'rounds', missions: ['obs.01'], site: { id: 'mt_strip', state: 'observed' } },
    { id: 'recon', missions: ['obs.02', 'obs.03'], site: { id: 'mt_strip', state: 'feasible' } },
    { id: 'tower', missions: ['obs.04', 'obs.05'], works: { cost: 0, days: 4 }, site: { id: 'mt_strip', state: 'tower' }, track: 'observatory:1' },
    { id: 'drum', missions: ['obs.06', 'obs.07'], works: { cost: 0, days: 4 }, site: { id: 'mt_strip', state: 'drum' }, track: 'observatory:2' },
    { id: 'hall', missions: ['obs.08'], works: { cost: 0, days: 4 }, site: { id: 'mt_strip', state: 'hall' }, track: 'observatory:3' },
    { id: 'strip', missions: ['obs.09'], works: { cost: 0, days: 3 }, site: { id: 'mt_strip', state: 'wide' }, gives: ['tech:3'] },
  ] });

// ======================================================================================================================
// PRIVATE CLIENTS (adam) - the charters, the orders, two runs nobody talks about
// ======================================================================================================================
KEEP('clients.01', 'clients.work');
KEEP('clients.n1', 'clients.work');
KEEP('clients.n2', 'clients.work', { needs: { after: ['clients.n1'] } });
KEEP('clients.03', 'clients.work', { unlock: null });
KEEP('clients.02', 'clients.orders');
KEEP('clients.04', 'clients.orders', { needs: { rep: 1 } });
// (clients.05, the 6 g order, is NOT in the pack: the certificate has no aerobatic box yet - 73_ contractCertifiable holds it
// off every board - and no aerobatic aeroplane exists; it comes back with the Aero Club's aerobatics. reports/STORY-REVAMP.md)
KEEP('clients.b1', 'clients.orders');
M('booze.01', 'clients', 'clients.work', { legs: [leg(carry('w5', 'w8', 60, 0, { require: { when: { after: 'dusk' } } }))], pay: 3600, rep: 0 },
  'A favour after dark', 'Sixty kilos of "preserves" from the Cannery Runway to the Hiking Strip, after dusk. The label says jam. Nobody is going to read the label.');
M('booze.02', 'clients', 'clients.work', { legs: [leg(carry('w6', 'w5', 80, 0, { require: { when: { before: 'dawn' } } }))], pay: 4400, rep: 0, needs: { after: ['booze.01'] } },
  'The same favour, the other way', 'Eighty kilos out of the Old Community Runway to the Cannery, before dawn. It turns out the quiet people up there make something worth the trip.');

// ======================================================================================================================
// HOME (sophie) - your own strip, your own lake: the first project (the user's backbone story 2)
// ======================================================================================================================
const H = (id, legs, o, title, brief, done) => M(id, 'home', null, Object.assign({ legs, pay: 0, rep: 0.25 }, o || {}), title, brief, done);
H('home.01', [leg(carry('HOME', 'w1', 80, 0))], null,
  'Drain pipe and a roller', 'Eighty kilos from the field to your own strip: drain pipe and a hand roller. The Cabin Strip is bumpy, narrow and sometimes mud. It is also the only way in.');
H('home.02', [leg(carry('w3', 'w1', 60, 0))], null,
  'Rakes, stakes and string', 'Sixty kilos from the Fishing Village: enough to mark a strip and clear a corner to park on.');
H('home.03', [leg(carry('w3', 'w1', 250, 0))], null,
  'The cabin, flat-packed', 'Two hundred and fifty kilos of timber frame from the Fishing Village. The hunter\'s shed was fine for one. It is not going to be one.');
H('home.04', [leg(carry('HOME', 'w1', 200, 0))], null,
  'Windows and a stove', 'Two hundred kilos from the field: glass, a stove, a door that shuts.');
H('home.05', [leg(carry('HOME', 'w1', 30, ['sophie']))], { rep: 0.5 },
  'Sophie moves in', 'One passenger, thirty kilos of what she could not leave behind, from the field to the Cabin Strip. Land it gently.',
  'It has a door. And a view. You told me it was a shed.');
H('home.06', [leg(carry('HOME', 'w1', 450, 0, { load: { kg: 450, pax: 0, items: [item('digger', 'crate', 450, [1.8, 0.9, 1.3])] } }))], { rep: 0.5 },
  'The little digger', 'Four hundred and fifty kilos in one crate: a digger small enough to fly and big enough to cut a road to the lake. You do not own an aeroplane that carries it. Yet.');
H('home.07', [leg(carry('w3', 'w1', 120, 0))], null,
  'Diesel for the digger', 'A hundred and twenty kilos of fuel from the Fishing Village. The digger drinks.');
H('home.08', [leg(carry('SEA', 'cb_sea', 150, 0))], null,
  'Floats for a dock', 'A hundred and fifty kilos of dock floats from Greywater to your lake. First landing on Cabin Lake: floats under the aeroplane too.');
H('home.09', [leg(carry('mk_sea', 'cb_sea', 100, 0))], null,
  'Cedar planks', 'A hundred kilos of decking from Cedar Harbour to Cabin Lake.');
H('home.10', [leg(carry('SEA', 'cb_sea', 250, 0))], null,
  'The long dock', 'Two hundred and fifty kilos of dock from Greywater. Room for more than one aeroplane, for a reason.');
H('home.11', [leg(carry('mk_sea', 'cb_sea', 200, 0))], null,
  'The lakeside cabin', 'Two hundred kilos of cabin from Cedar Harbour: beds for people who fly in.');
H('home.12', [leg(carry('SEA', 'cb_sea', 0, 2))], { rep: 0.5 },
  'The fly-in', 'Two friends from Greywater to your lake, for the night. They would have brought their own aeroplane. They said yours is nicer.',
  'Everybody stayed. Nobody wanted to be the first to leave.');
H('home.13', [leg(carry('HOME', 'w1', 280, 0))], null,
  'Trusses', 'Two hundred and eighty kilos of roof truss from the field: your hangar is about to stop being a shed.');
H('home.14', [leg(carry('w3', 'w1', 200, 0))], { rep: 0.5 },
  'Doors wide enough', 'Two hundred kilos of door from the Fishing Village: wide enough for the aeroplanes you have been borrowing space for.',
  'Now build something that needs it.');
projects.push({ id: 'home', name: 'Home improvement', client: 'home',
  steps: [
    { id: 'strip', missions: ['home.01', 'home.02'], works: { cost: 1500, days: 2 }, site: { id: 'w1', state: 'strip' }, track: 'home:1' },
    { id: 'cabin', missions: ['home.03', 'home.04', 'home.05'], works: { cost: 6000, days: 4 }, site: { id: 'w1', state: 'cabin' }, track: 'home:2' },
    { id: 'road', missions: ['home.06', 'home.07'], works: { cost: 4000, days: 5 }, site: { id: 'w1', state: 'road' }, track: 'home:3' },
    { id: 'dock', missions: ['home.08', 'home.09'], works: { cost: 3000, days: 3 }, site: { id: 'cb_sea', state: 'dock' }, track: 'home:4' },
    { id: 'lakeside', missions: ['home.10', 'home.11'], works: { cost: 8000, days: 4 }, site: { id: 'cb_sea', state: 'lakeside' }, track: 'home:5' },
    { id: 'flyin', missions: ['home.12'], site: { id: 'cb_sea', state: 'flyin' } },
    { id: 'hangar', missions: ['home.13', 'home.14'], works: { cost: 12000, days: 5 }, site: { id: 'w1', state: 'hangar' }, track: 'home:6', gives: ['hangar:home'] },
  ] });

// ======================================================================================================================
// THE MUSKEG COMMUNITY (stand-in face: james) - the old strip, then the new one in stages (the backbone story 1)
// ======================================================================================================================
const K = (id, legs, o, title, brief, done) => M(id, 'community', null, Object.assign({ legs }, o || {}), title, brief, done);
K('community.01', [leg(carry('HOME', 'w6', 0, 1))], { pay: 3200 },
  'The muskeg expert', 'One expert to the Old Community Runway: a path that happens to be straight, and happens to be mud. A small rough aeroplane. The community will meet you at the edge of it. Only at the edge.');
K('community.02', [leg(carry('w3', 'w7', 80, 0))], { pay: 3000, goods: 'goods.parts' },
  'What the grinder lacks', 'Eighty kilos of parts from the Fishing Village to the new strip. Their rock grinder came by sea and has not ground a rock since.');
K('community.03', [leg(carry('HOME', 'w7', 60, 0))], { pay: 2800, goods: 'goods.parts' },
  'Belts and teeth', 'Sixty kilos more for the grinder, from the field. The new strip is two hundred metres of the same mud as the old one.');
K('community.04', [leg(carry('HOME', 'w7', 90, 0))], { pay: 3200, goods: 'goods.tools' },
  'A blade for the grader', 'Ninety kilos of grader blade from the field. Four hundred metres now, and every one of them has a bump.');
K('community.05', [leg(carry('w5', 'w7', 80, 0))], { pay: 3000, goods: 'goods.parts' },
  'Culverts from the Cannery', 'Eighty kilos of culvert pipe from the Cannery Runway.');
K('community.06', [leg(carry('mn_strip', 'w7', 60, 0))], { pay: 3400, goods: 'goods.tools' },
  'Rail from the old mine', 'Sixty kilos of old mine rail from Copperhead Mine Street: the community has plans for it. The community always has plans.');
K('community.07', [leg(carry('w3', 'w7', 90, 0))], { pay: 3000, goods: 'goods.supplies' },
  'Geotextile', 'Ninety kilos of the cloth that keeps gravel on top of a swamp, from the Fishing Village.');
K('community.08', [leg(carry('HOME', 'w7', 0, 4))], { pay: 6000, rep: 1 },
  'Four experts at once', 'Four experts from the field to a kilometre of new gravel. One flight, the committee insists: four arrivals would be four too many. You need a bigger aeroplane.');
K('community.09', [leg(carry('HOME', 'w7', 300, 0))], { pay: 6500, rep: 1, goods: 'goods.parts' },
  'A tower, some assembly required', 'Three hundred kilos of tower from the field.');
K('community.10', [leg(carry('HOME', 'w7', 400, 0))], { pay: 8000, rep: 1, goods: 'goods.parts' },
  'A hangar in bundles', 'Four hundred kilos of hangar frame from the field.');
K('community.11', [leg(carry('w3', 'w7', 350, 0))], { pay: 7500, rep: 1, goods: 'goods.parts' },
  'The terminal', 'Three hundred and fifty kilos from the Fishing Village: the smallest terminal on any map. It has a bench.',
  'The committee has voted. You may land here whenever you bring something. That is the warmest thing we have ever said to anyone.');
projects.push({ id: 'community', name: 'The community\'s runway', client: 'community',
  steps: [
    { id: 'expert', missions: ['community.01'], works: { cost: 0, days: 5 }, site: { id: 'w7', state: 'first' }, track: 'community:1' },
    { id: 'grinder', missions: ['community.02', 'community.03'], works: { cost: 0, days: 5 }, site: { id: 'w7', state: 'second' }, track: 'community:2' },
    { id: 'grader', missions: ['community.04'], works: { cost: 0, days: 4 }, site: { id: 'w7', state: 'graded' }, track: 'community:3' },
    { id: 'push', missions: ['community.05', 'community.06', 'community.07'], works: { cost: 0, days: 7 }, site: { id: 'w7', state: 'gravel' }, track: 'community:4' },
    { id: 'experts', missions: ['community.08'], site: { id: 'w7', state: 'planned' } },
    { id: 'tower', missions: ['community.09'], works: { cost: 0, days: 4 }, site: { id: 'w7', state: 'tower' }, track: 'community:5' },
    { id: 'hangar', missions: ['community.10'], works: { cost: 0, days: 4 }, site: { id: 'w7', state: 'hangar' }, track: 'community:6' },
    { id: 'terminal', missions: ['community.11'], works: { cost: 0, days: 4 }, site: { id: 'w7', state: 'terminal' }, track: 'community:7' },
  ] });

// ---- THE TREE ----------------------------------------------------------------------------------------------------------
const chap = (id, title) => ({ id, title: T('ms.chapter.' + id, title), order: 'any', missions: chapters[id] || [] });
const campaigns = [
  { id: 'story.field', title: 'prov.field.name', provider: 'field', order: 'any', chapters: [chap('field.work', 'Work')] },
  { id: 'story.minedock', title: 'prov.minedock.name', provider: 'minedock', order: 'any', chapters: [chap('minedock.work', 'Work'), chap('minedock.orders', 'Aircraft orders')] },
  { id: 'story.resort', title: 'prov.resort.name', provider: 'resort', order: 'any', chapters: [chap('resort.work', 'Work'), chap('resort.orders', 'Aircraft orders')] },
  { id: 'story.survey', title: 'prov.survey.name', provider: 'survey', order: 'any', chapters: [chap('survey.work', 'Work'), chap('survey.orders', 'Aircraft orders')] },
  { id: 'story.clients', title: 'prov.clients.name', provider: 'clients', order: 'any', chapters: [chap('clients.work', 'Work'), chap('clients.orders', 'Aircraft orders')] },
  clone(BUILTIN.campaigns.find(c => c.tutorial)),
];
for (const m of BUILTIN.missions) if (m.tutorial) missions.push(clone(m));

const pack = { what: 'flydiy-missions', v: 1, id: 'story', title: 'Wingsmith', rules: { jobs: 'none', shady: false, unflyable: 'offer' },
  clients, campaigns, missions, projects, sites: [], text };

// one mission, one project, one text key per line: the pack diffs by line
function packText(p) {
  const J = o => JSON.stringify(o);
  const L = ['{', '  "what": ' + J(p.what) + ',', '  "v": ' + J(p.v) + ',', '  "id": ' + J(p.id) + ',', '  "title": ' + J(p.title) + ',', '  "rules": ' + J(p.rules) + ','];
  const list = (k, rows, last) => { L.push('  ' + J(k) + ': ['); rows.forEach((r, i) => L.push('    ' + J(r) + (i < rows.length - 1 ? ',' : ''))); L.push('  ]' + (last ? '' : ',')); };
  list('clients', p.clients);
  L.push('  "campaigns": [');
  p.campaigns.forEach((c, i) => { const { chapters: ch, ...head } = c; L.push('    ' + J(head).slice(0, -1) + ', "chapters": [');
    ch.forEach((h, j) => L.push('      ' + J(h) + (j < ch.length - 1 ? ',' : ''))); L.push('    ]}' + (i < p.campaigns.length - 1 ? ',' : '')); });
  L.push('  ],');
  list('missions', p.missions);
  L.push('  "projects": [');
  p.projects.forEach((q, i) => { const { steps, ...head } = q; L.push('    ' + J(head).slice(0, -1) + ', "steps": [');
    steps.forEach((s, j) => L.push('      ' + J(s) + (j < steps.length - 1 ? ',' : ''))); L.push('    ]}' + (i < p.projects.length - 1 ? ',' : '')); });
  L.push('  ],', '  "sites": [],', '  "text": {');
  const keys = Object.keys(p.text);
  keys.forEach((k, i) => L.push('    ' + J(k) + ': ' + J(p.text[k]) + (i < keys.length - 1 ? ',' : '')));
  L.push('  }', '}');
  return L.join('\n') + '\n';
}

const why = C.missionPackValidate(pack, {});
if (why.length) { console.error('the story pack does not validate (' + why.length + '):\n  ' + why.slice(0, 40).join('\n  ')); process.exit(1); }
const out = path.join(ROOT, 'src', 'missions', 'story.json'), txt = packText(pack);
const canon = o => (Array.isArray(o) ? o.map(canon) : o && typeof o === 'object' ? Object.keys(o).sort().reduce((a, k) => (a[k] = canon(o[k]), a), {}) : o);
if (JSON.stringify(canon(JSON.parse(txt))) !== JSON.stringify(canon(pack))) { console.error('the written pack does not read back as built'); process.exit(1); }
if (process.argv.includes('--table')) {
  const P = C.missionPackNormalise(pack), real = P.missions.filter(m => m.tutorial == null);
  console.log('missions ' + real.length + ' (+ ' + (P.missions.length - real.length) + ' tutorial listings) | clients ' + P.clients.length + ' of the pack + 5 of the game | projects ' + P.projects.length);
  for (const q of P.projects) { console.log('project ' + q.id + ' (' + q.client + ')' + (q.requires.projects.length ? ' after ' + q.requires.projects.join(',') : '') + ': ' + q.steps.length + ' steps');
    q.steps.forEach((s, i) => console.log('   ' + (i + 1) + ' ' + s.id.padEnd(10) + ' missions ' + s.missions.length + (s.works ? '  works ' + s.works.days + ' d' + (s.works.cost ? ' / ' + s.works.cost : '') : '') + (s.track ? '  -> ' + s.track : '') + (s.gives && s.gives.length ? '  gives ' + s.gives.join(',') : ''))); }
  process.exit(0);
}
if (process.argv.includes('--check')) {
  const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === txt;
  console.log(same ? 'story.json = a fresh write' : 'story.json differs from a fresh write');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(out, txt);
console.log('wrote ' + path.relative(ROOT, out) + ': ' + missions.filter(m => !m.tutorial).length + ' missions, ' + projects.length + ' projects (' + projects.reduce((a, q) => a + q.steps.length, 0) + ' steps), ' +
  clients.length + ' clients of its own, ' + Object.keys(text).length + ' text keys');
