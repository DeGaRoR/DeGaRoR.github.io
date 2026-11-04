#!/usr/bin/env node
// night_shots.js - NIGHT-LOOK (2026-11-02): THE NIGHT, THE BLUE HOUR AND THE SUNSET, FIXED FRAMES WITH THE NUMBERS
// (G2600's tools/moonlight_shots.js, claude/moonlight-g2600, ported to master: the same rig and readout, the views of
// flydiy-notes/NIGHT-LOOK-STUDY-2026-11.md section 3 - Cabin Lake toward Mount Ardent on the 23 Dec 2026 full moon,
// the blue hour with the moon rising, the sunset, a moonless control - plus the HOME stand.)
//
// shadowsky_shots.js's rig (headless Chrome on this machine's GPU, a page per build, the roll-out, then a held
// aeroplane per view, the sim paused) with what a night needs: each view sets the DAY (a date, a UT hour, the cloud, the
// clock frozen), places the aeroplane (the HOME stand, 300 m over HOME, a 150 m final, or AGL over a world x,z), aims the
// orbit (the runway, the sea with the moon ahead or behind, the sun, the moon, or toward a world x,z), waits for the
// light's ease and the probe, and writes a PNG and a row:
//   the frame's mean luminance and mean code over the 3D view, the sky band's and the ground band's, and the page's light
//   (the key - sun | moon - its intensity and elevation, the hemisphere, the exposure, the moon's phase and height, the
//   cover); and THE RESOLVE TARGET'S RADIANCE (fp16) read back over a ground band: its mean, its least non-zero value,
//   how many distinct values it holds and the subnormal share - the precision the night is drawn in.
//
//   node tools/night_shots.js [--pages index.html[,other.html]] [--q gfx=gamer] [--views a,b]
//          [--out <dir>] [--size 1600x900] [--port 8547] [--fallback D:/Dev/DeGaRoR.github.io]
//
// A GPU RUN: boxlock.sh take gpu <who> "UNTIMED ..." first (A0's slot), drop after. Stills only after the loading
// overlay is gone (+3 s); every still is looked at before it is reported.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PAGES = opt('pages', 'index.html').split(',');
const SIZE = opt('size', '1600x900').split('x').map(Number);
const SPORT = +opt('port', 8547);
const Q = opt('q', '');
const FALLBACK = opt('fallback', 'D:/Dev/DeGaRoR.github.io');
const ONLY = (opt('views', '') || '').split(',').filter(Boolean);
// --build <file.json>: the aeroplane the roll-out flies (a build file, wrapped or bare: GARAGE_SPEC.set before the
// roll-out); --over '{"li_nav":1}': rows laid over its cage (a test copy, never saved); the twin_ views run only with a build
// --scene ref: THE REFERENCE SCENE (A0 2 Nov ~20:00, the user: "try and reproduce the screenshot somehow. Put my little
// plane in there, get somewhere with some lights, trees and mountains"): ONE repeatable frame, re-rendered after every
// NIGHT-LOOK step into <evidence>/refscene/<--step> (default step0). The user's floatplane rolled out at Cedar Harbour
// Seaplane Base (FLYDIY_ROUTE.spawn mk_sea: the keels seated on the water by the game's own placement), moved on the
// water to the spot the SCENE SOLVER picks for its heading (below), framed three-quarter front, low over the water, the
// lit town waterfront and the lit Skyline summit (685 m, the tram's top station) behind. The scene's numbers are
// printed on its row (the plane's spot, the eye, the bearing), so a step that changes them says so.
// --scene user: THE USER'S OWN FRAME (A0 2 Nov ~21:00, the user's screenshot of the live game, Jolene AFB at dusk with
// Codex's night floor): the default aeroplane held 180 m over HOME, the camera behind and above it toward the sunset,
// the game's default day (light breeze, few cu) - the same <step> folder, so the user sees their own view improve.
const SCENE = opt('scene', null), STEP = opt('step', 'step0');
// --frame '{"plane":[x,z],"bearing":deg}': the picked composition, frozen (the peaks' grid follows the roll-out's spot, so a --pick can move between runs; the same camera is the point of a step-vs-master pair)
const PHOTO = SCENE === 'scout' || SCENE === 'photo', PICK = +opt('pick', 0), THR = +opt('thr', 0.18), TAXI_MS = +opt('taxi', 0), NOSE = opt('nose', null), FRAME = JSON.parse(opt('frame', 'null'));
const OUT = path.resolve(opt('out', PHOTO ? 'D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-04/night-' + SCENE + '/' + STEP : SCENE ? 'D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-03/night/refscene/' + STEP : path.join(__dirname, '..', 'reports', 'evidence', 'NIGHT-LOOK')));
// the user accepted FLAGSHIP's stabilised _3 (2 Nov ~22:00, A0): it loads as designed with the float-step fix (claude/flagship
// 621df2b46, _cage_float.js) - on a master without it the floats' station clamps back (named on step 0's frames)
// A0 4 Nov (the user: "no light on the plane"): the twin's lights are all FITTED (every li_*Fit 1) but their switches were
// saved off (li_nav, beacon, land, taxi, pax, instr, pedal 0). The user had them switched on in the saved twin
// (claude/ready/twin4b-lights 705dbaf95), and the photo scenes fly THAT plane: the user's latest twin, _4b (the less swept
// wings, tipX 0.5, the door fixes), as the ready branch holds it, copied to the notes folder until it lands
const TWIN_DEF = 'D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-02/phone/Twin_busher_floats_3.json';
const TWIN_4B = path.join(__dirname, '..', 'builds', 'candidates', 'Twin_busher_floats_4b.json');   // the real file: FLAGSHIP's battery + gen20, CABIN-CRAFT's interior rows
const BUILD = opt('build', PHOTO ? TWIN_4B : SCENE === 'ref' ? TWIN_DEF : null), OVER = JSON.parse(opt('over', 'null'));
const SPAWN = opt('spawn', SCENE === 'ref' || PHOTO ? 'mk_sea' : null);
const BTAG = BUILD ? '_' + path.basename(BUILD, '.json').replace(/\W+/g, '').slice(0, 24) + (OVER ? '_over' : '') : '';
// --variants '[{"eye":0},{"eye":1.5}]': each NIGHT view shot once per set of light_rig NIGHT dials (pages that have them;
// the day views once, with the first set) - the file name carries the set (e.g. _eye1.5)
const VARIANTS = JSON.parse(opt('variants', '[null]'));
const vtag = o => (o ? '_' + Object.keys(o).map(k => k + o[k]).join('_') : '');
const REPO = path.resolve(__dirname, '..', '..');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });

// ---- the days (Jolene, 55 N; 06_solar, found off the almanac): the study's section 3 ----
const XMAS = { date: '2026-12-24', utc: 3 * 3600 };     // 23 Dec 18:00 AKST: the moon 99.9 % lit, 22.5 deg up at az 75 (ENE), the sun at -21
const BLUE = { date: '2026-12-24', utc: 1 * 3600 };     // 16:00 AKST: the sun at -5.2 (the blue hour), the full moon rising at 7.8 deg, az 54
const SET_ = { date: '2026-12-24', utc: 0.25 * 3600 };  // 15:15 AKST: the sun near 0
const NEWM = { date: '2027-01-08', utc: 3 * 3600 };     // two weeks on: the moonless control
const NOON = { date: '2026-12-23', utc: 21 * 3600 };    // 12:00 AKST: the December noon (the sun ~11.5 deg) - the rig's control
const DUSK4 = { date: '2026-12-24', utc: 0.85 * 3600 }; // 15:51 AKST: the sun at about -4 deg, the full moon rising ENE
const LIT = { flood: 1, nav: 1, beacon: 1, land: 1, taxi: 1, instr: 1, pedal: 1, pax: 1 }, DARK = { flood: 0, nav: 0, beacon: 0, land: 0, taxi: 0, instr: 0, pedal: 0, pax: 0 };
// the reference scene's days (06_solar): 19 Apr 2027 AKDT, the full moon (99.2 %) rising in the ESE as the sun sets in the
// WNW - at 04:25Z the sun at -4.2 deg and the moon 7.8 deg up at az 126 true (107 grid), over the town and the summit
const APR_DUSK = { date: '2027-04-20', utc: 4.42 * 3600 }, APR_BLUE = { date: '2027-04-20', utc: 4.75 * 3600 };   // -4.2 / -6.7 deg
const APR_AM = { date: '2027-04-20', utc: 17.0 * 3600 };   // 09:00 AKDT: a morning sun in the south-east, behind or beside the eye (the scout; the first scout's 18:00 sun blew the water out)
const APR_NIGHT = { date: '2027-04-20', utc: 7 * 3600 };   // 23:00 AKDT: the sun at -19.9, the moon 19.8 deg up at az 162
// the lit things of the island's premises (the fixture's sites whose items carry lit panes or lamps, and the town's built
// zones), for the scene solver: [x, z, weight]
const LITS = (() => { try { const fj = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8')), L = [];
  for (const q of fj.layers.sites) { const n = (q.items || []).filter(i => /house|cabin|store|lodge|shed|church|cannery|warehouse|boat|wharf|pier|floats|light|hangar|big\//i.test(i.key)).length; if (n) L.push([q.at.x, q.at.z, Math.min(n, 5)]); }
  for (const z of fj.layers.zones) if (/residential|commercial|industrial|harbour/.test(z.kind)) { let cx = 0, cz = 0; for (const p of z.poly) { cx += p[0]; cz += p[1]; } L.push([cx / z.poly.length, cz / z.poly.length, 4]); }
  return L; } catch (e) { return []; } })();
// the photo scene's breeze (the user 4 Nov: "a little wave on the sea, not full calm ... calm taxiing, small breeze"): 4 kt on the nose (camera B's nose bears ~38),
// so it holds its heading, nose right (the game's 8 kt from 250 weathercocked the taxi nose-left); and a night with the moon ahead of camera B, left of the plane (az 239, 10 deg up, 98 %): the silver path on the water
const CALM = { wind: { kts: +opt('kts', 4), dirDeg: NOSE != null ? +NOSE : 38, gust: 0, refH: 10 } }, MOON_AHEAD = { date: '2027-09-14', utc: 11.5 * 3600 };
const CLEAR = { cloudCover: 0 }, FEW = { cloudCover: 0.2, cloudType: 'cu' };
// views: at 'stand' | 'over' (300 m over HOME's field) | 'final' (150 m on a 2 km final to HOME) | 'xz' (agl over x,z);
//        aim 'runway' | 'seaMoon' | 'awayMoon' | 'moon' | 'sun' | 'toward' (the x,z in V.to); dist the orbit's
//        distance, el its elevation (rad)
const CABIN = { at: 'xz', x: 1890, z: -17804, agl: 12 };        // Cabin Lake (cb_sea, the float strip's centre)
const ARDENT = [9106, -5886];                                   // Mount Ardent's summit, 1 100 m, 13.9 km SSE of the lake
const VIEWS = [
  { name: 'noon_stand',       day: Object.assign({}, NOON, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16, settle: 14 },
  { name: 'cabin_noon',       day: Object.assign({}, NOON, CLEAR), ...CABIN, aim: 'toward', to: ARDENT, el: 0.06, dist: 22 },
  { name: 'cabin_sunset',     day: Object.assign({}, SET_, CLEAR), ...CABIN, aim: 'sun', el: 0.06, dist: 22, settle: 12 },
  { name: 'cabin_blue_moon',  day: Object.assign({}, BLUE, CLEAR), ...CABIN, aim: 'moon', el: 0.06, dist: 22, settle: 12 },
  { name: 'cabin_blue_ardent', day: Object.assign({}, BLUE, CLEAR), ...CABIN, aim: 'toward', to: ARDENT, el: 0.06, dist: 22 },
  { name: 'cabin_full_ardent', day: Object.assign({}, XMAS, FEW), ...CABIN, aim: 'toward', to: ARDENT, el: 0.06, dist: 22, settle: 14 },
  { name: 'cabin_full_clear', day: Object.assign({}, XMAS, CLEAR), ...CABIN, aim: 'toward', to: ARDENT, el: 0.06, dist: 22 },
  { name: 'cabin_full_moon',  day: Object.assign({}, XMAS, CLEAR), ...CABIN, aim: 'moon', el: 0.06, dist: 22 },
  { name: 'cabin_full_north', day: Object.assign({}, XMAS, CLEAR), ...CABIN, aim: 'toward', to: [1890, -40000], el: 0.06, dist: 22 },
  { name: 'cabin_new_ardent', day: Object.assign({}, NEWM, CLEAR), ...CABIN, aim: 'toward', to: ARDENT, el: 0.06, dist: 22, settle: 12 },
  { name: 'full_stand',       day: Object.assign({}, XMAS, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16, settle: 12 },
  { name: 'blue_stand',       day: Object.assign({}, BLUE, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16, settle: 12 },
  { name: 'full_over_sea',    day: Object.assign({}, XMAS, CLEAR), at: 'over', aim: 'seaMoon', el: 0.05, dist: 30 },
  { name: 'new_stand',        day: Object.assign({}, NEWM, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16, settle: 12 },
  // THE USER'S FLOATPLANE ON THE LAKE (A0 2 Nov 19:40, the user: "something readable at night/dusk, and lights that work in
  // the cabin, and outside to reflect in lakes"): Twin_busher_floats_2 on Cabin Lake, its keels at the height the sea
  // roll-out seated them (agl 'keep'), the cabin flood and every fitted outside light ON (CK.sw, as the rail's pills)
  { twin: 1, name: 'twin_dusk_q3',   day: Object.assign({}, DUSK4, CLEAR), ...CABIN, agl: 'keep', aim: 'q3', el: 0.10, dist: 15, lights: LIT, settle: 12 },
  { twin: 1, name: 'twin_dusk_low',  day: Object.assign({}, DUSK4, CLEAR), ...CABIN, agl: 'keep', aim: 'sun', el: 0.025, dist: 18, lights: LIT },
  { twin: 1, name: 'twin_full_q3',   day: Object.assign({}, XMAS, CLEAR), ...CABIN, agl: 'keep', aim: 'q3', el: 0.10, dist: 15, lights: LIT, settle: 12 },
  { twin: 1, name: 'twin_full_low',  day: Object.assign({}, XMAS, CLEAR), ...CABIN, agl: 'keep', aim: 'q3', el: 0.025, dist: 18, lights: LIT },
  { twin: 1, name: 'twin_full_dark', day: Object.assign({}, XMAS, CLEAR), ...CABIN, agl: 'keep', aim: 'q3', el: 0.10, dist: 15, lights: DARK },
  { twin: 1, name: 'twin_full_cabin', day: Object.assign({}, XMAS, CLEAR), ...CABIN, agl: 'keep', aim: 'q3', el: 0.04, dist: 6, lights: LIT },
  // THE REFERENCE SCENE: the dusk (the main shot), the deeper blue hour, the full-moon night, and the lights-off control
  { ref: 1, name: 'ref_dusk',       day: Object.assign({}, APR_DUSK, CLEAR), aim: 'ref', el: 0.035, dist: 18, fov: 26, lights: LIT, settle: 14 },
  { ref: 1, name: 'ref_blue',       day: Object.assign({}, APR_BLUE, CLEAR), aim: 'ref', el: 0.035, dist: 18, fov: 26, lights: LIT, settle: 10 },
  { ref: 1, name: 'ref_night',      day: Object.assign({}, APR_NIGHT, CLEAR), aim: 'ref', el: 0.035, dist: 18, fov: 26, lights: LIT, settle: 12 },
  { ref: 1, name: 'ref_dusk_dark',  day: Object.assign({}, APR_DUSK, CLEAR), aim: 'ref', el: 0.035, dist: 18, fov: 26, lights: DARK, settle: 8 },
  // THE USER'S FRAME: 2 Nov 2026 16:30 / 16:45 AKST (the HUD's "16:.."; the sun -3.9 / -6.0 deg at az 249 / 252, the moon
  // down: Codex's floor alone), and the full night (17:45, -14.4) for the same eye
  { user: 1, name: 'jolene_dusk',   day: { date: '2026-11-03', utc: 1.5 * 3600 }, at: 'over', agl: 180, aim: 'sun', el: 0.22, dist: 24, settle: 14 },
  { user: 1, name: 'jolene_dusk6',  day: { date: '2026-11-03', utc: 1.75 * 3600 }, at: 'over', agl: 180, aim: 'sun', el: 0.22, dist: 24, settle: 10 },
  { user: 1, name: 'jolene_night',  day: { date: '2026-11-03', utc: 2.75 * 3600 }, at: 'over', agl: 180, aim: 'sun', el: 0.22, dist: 24, settle: 10 },
  // --scene scout / photo (A0 4 Nov, the user: "the framing is still wrong, no mountains in the background, no light on the plane,
  // camera angle poor, bad FOV, bad framing ... try to have them looking nice"): a photographer's frame - the twin on the water
  // 3/4 front (the eye 35-45 deg off the nose), the eye low (~2.5 m over the water), a long lens (24 deg) at 26 m (the plane ~45 %
  // of the width), a real peak stacked big behind it (aim 'compose': the plane on the line from the eye to the peak), the town's
  // lights low in the background, no open sea. scout = three compositions in a clear afternoon (the sun ~14 deg) for the user
  // to pick (a clear morning: the first scout's afternoon was contre-jour); photo = the picked one (--pick N) at dusk, blue hour and night
  { scout: 1, name: 'scout_a', day: Object.assign({}, APR_AM, FEW), aim: 'compose', pick: 0, el: 0.03, dist: 26, fov: 24, lights: LIT, settle: 12 },
  { scout: 1, name: 'scout_b', day: Object.assign({}, APR_AM, FEW), aim: 'compose', pick: 1, el: 0.03, dist: 26, fov: 24, lights: LIT, settle: 10 },
  { scout: 1, name: 'scout_c', day: Object.assign({}, APR_AM, FEW), aim: 'compose', pick: 2, el: 0.03, dist: 26, fov: 24, lights: LIT, settle: 10 },
  { scout: 1, name: 'scout_d', day: Object.assign({}, APR_AM, FEW), aim: 'compose', pick: 3, el: 0.03, dist: 26, fov: 24, lights: LIT, settle: 10 },   // three spares: the
  { scout: 1, name: 'scout_e', day: Object.assign({}, APR_AM, FEW), aim: 'compose', pick: 4, el: 0.03, dist: 26, fov: 24, lights: LIT, settle: 10 },   // three best go to
  { scout: 1, name: 'scout_f', day: Object.assign({}, APR_AM, FEW), aim: 'compose', pick: 5, el: 0.03, dist: 26, fov: 24, lights: LIT, settle: 10 },   // the user
  // the user's pick (4 Nov, B): "camera lower and closer up, showing a little more sky ... the cabin lit, plus the aurora and the
  // plane" - 20 m, the eye ~1 m over the water, looking 1.2 m over the plane's centre (`lift`) so the tilt is 5 deg: the horizon drops, the plane
  // sits low with the summits and the sky over it, and less of the near water's blurred mirror shows (the first cut's 0.66 m eye, A0: the floats hung under a hard line)
  { photo: 1, name: 'photo_day',   day: Object.assign({}, APR_AM, FEW, CALM), aim: 'compose', pick: PICK, el: -0.091, lift: 1.22, dist: 20, fov: 24, lights: LIT, settle: 8 },
  { photo: 1, name: 'photo_dusk',  day: Object.assign({}, APR_DUSK, CLEAR, CALM), aim: 'compose', pick: PICK, el: -0.091, lift: 1.22, dist: 20, fov: 24, lights: LIT, settle: 14 },
  { photo: 1, name: 'photo_blue',  day: Object.assign({}, APR_BLUE, CLEAR, CALM), aim: 'compose', pick: PICK, el: -0.091, lift: 1.22, dist: 20, fov: 24, lights: LIT, settle: 10 },
  { photo: 1, name: 'photo_moon',  day: Object.assign({}, MOON_AHEAD, CLEAR, CALM), aim: 'compose', pick: PICK, el: -0.091, lift: 1.22, dist: 20, fov: 24, lights: LIT, settle: 12, js: 'if (window.AURORA) AURORA.on({ azDeg: ' + (FRAME ? FRAME.bearing : 0) + ' })' },
  { photo: 1, name: 'photo_night', day: Object.assign({}, APR_NIGHT, CLEAR, CALM), aim: 'compose', pick: PICK, el: -0.091, lift: 1.22, dist: 20, fov: 24, lights: LIT, settle: 12, js: 'if (window.AURORA) AURORA.on({ azDeg: ' + (FRAME ? FRAME.bearing : 0) + ' })' },
].filter(v => ONLY.length ? ONLY.includes(v.name) : SCENE === 'ref' ? !!v.ref : SCENE === 'scout' ? !!v.scout : SCENE === 'photo' ? !!v.photo : SCENE === 'user' ? !!v.user : (!v.ref && !v.user && !v.scout && !v.photo && !!v.twin === !!BUILD));

// ---- in the page ----
// HOME's strip, the nearest sea's heading from it (72 headings, the first water 600 m - 8 km out), the night's hour
// with the moon over that heading (or behind it), the aeroplane placed and the orbit aimed. Returns the plan.
const SETUP = V => `(async () => {
  const b = document.getElementById('bPause'); if (b && ${V.aim === 'compose' && TAXI_MS > 0 ? '/resume/i' : '/pause/i'}.test(b.textContent)) b.click();   // --taxi <m/s>: the photo scene runs, a wake needs a moving hull
  const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world();
  ${V.js || ''};
  // the stand is where the roll-out put the aeroplane: kept at the first view, put back for every 'stand' view
  if (!window.__moonStand) window.__moonStand = s.cgPos().slice();
  // the keels' seat: the CG's height over the water where the roll-out put a float build (first view; 2 m otherwise)
  if (window.__floatAgl == null) { const c = s.cgPos(), wh = w.waterH ? w.waterH(c[0], c[2]) : null; window.__floatAgl = (s.hydro || ${!!BUILD}) && wh != null && isFinite(wh) && Math.abs(c[1] - wh) < 4 ? c[1] - wh : 2; }
  const A = (w.aerodromes || []).find(a => a.id === 'HOME') || (w.aerodromes || [])[0];
  const strip = A && A.strips ? (A.strips.find(q => !q.flyIn) || A.strips[0]) : A;
  const hd = strip && strip.hdg != null ? strip.hdg : 0;
  const cx = strip ? strip.x : 0, cz = strip ? strip.z : 0, dx = strip && strip.dx != null ? strip.dx : Math.cos(hd), dz = strip && strip.dz != null ? strip.dz : Math.sin(hd), len = strip && strip.len ? strip.len : 600;
  // the landing direction (a premises strip names it: landHdg; the generator's lands toward -dx)
  const lh = strip && strip.landHdg != null ? [Math.cos(strip.landHdg), Math.sin(strip.landHdg)] : [-dx, -dz];
  const wet = (x, z) => { const h = w.terrainH(x, z), wh = w.waterH ? w.waterH(x, z) : null; return (wh != null && isFinite(wh) && wh > h) || h <= 0; };
  let sea = null;
  for (let r = 600; r <= 8000 && !sea; r += 200) for (let k = 0; k < 72 && !sea; k++) { const a = k / 72 * Math.PI * 2; if (wet(cx + Math.cos(a) * r, cz + Math.sin(a) * r) && wet(cx + Math.cos(a) * (r + 400), cz + Math.sin(a) * (r + 400))) sea = [Math.cos(a), Math.sin(a), r]; }
  if (!sea) sea = [dx, dz, 0];
  const day = Object.assign({ rate: 0 }, ${JSON.stringify(V.day)});
  const aim = ${JSON.stringify(V.aim)};
  if (aim === 'seaMoon' || aim === 'seaNoMoon') {   // the hour on this night (+-6 h) whose moon is over the sea (or behind the eye), the moon > 15 deg
    const want = aim === 'seaMoon' ? 1 : -1; let best = null;
    for (let m = -360; m <= 360; m += 10) { let u = day.utc + m * 60;
      DAY_CLOCK.set({ date: day.date, utc: ((u % 86400) + 86400) % 86400 });
      const d = DAY_CLOCK.day(), mv = d.moon; if (d.sunEl > -12 || d.moonEl < 15) continue;
      const h = Math.hypot(mv[0], mv[2]) || 1, c = (mv[0] * sea[0] + mv[2] * sea[1]) / h * want;
      if (!best || c > best.c) best = { c, utc: ((u % 86400) + 86400) % 86400 }; }
    if (best && best.c > 0.5) day.utc = best.utc;
  }
  DAY_CLOCK.set(day);
  if (${JSON.stringify(V.preset || null)}) DAY_CLOCK.preset(${JSON.stringify(V.preset || null)});   // a named hour solved on that date (the clock's own)
  let px = cx, pz = cz, agl = 0, look = [dx, dz];
  if (${JSON.stringify(V.at)} === 'stand') { const st = window.__moonStand, cg = s.cgPos(); if (Math.hypot(st[0] - cg[0], st[1] - cg[1], st[2] - cg[2]) > 0.5) await FLIGHT_PROBE.place({ by: [st[0] - cg[0], st[1] - cg[1], st[2] - cg[2]], zeroV: true }); agl = null; look = [dx, dz]; }
  else if (${JSON.stringify(V.at)} === 'over') { agl = ${+V.agl || 300}; look = [sea[0], sea[1]]; }
  else if (${JSON.stringify(V.at)} === 'xz') { px = ${+V.x || 0}; pz = ${+V.z || 0}; agl = ${V.agl === 'keep' ? 'window.__floatAgl' : (+V.agl || 10)}; }
  else if (${JSON.stringify(V.at)} === 'final') { const tx = cx - lh[0] * len / 2, tz = cz - lh[1] * len / 2; px = tx - lh[0] * 1200; pz = tz - lh[1] * 1200; agl = 150; look = [lh[0], lh[1]]; }
  if (aim === 'q3') { const ax = s.axes ? s.axes() : null; if (ax) { const nx = -ax[0][0], nz = -ax[0][2], lx = -ax[2][0], lz = -ax[2][2];   // the nose, the left wing
      const ex = nx * 0.77 + lx * 0.64, ez = nz * 0.77 + lz * 0.64, h = Math.hypot(ex, ez) || 1; look = [-ex / h, -ez / h]; } }   // the eye 40 deg off the nose, port side
  if (aim === 'ref') {   // THE SCENE SOLVER: the plane anywhere on the water round Cedar Harbour (a 150 m sweep, 11 x 9.5 km) where the
    // plane, the eye and 150 m ahead are water; the eye 30..150 deg off the nose, port or starboard (the roll-out's heading is the
    // plane's: the probe moves it, never turns it, so the eye goes round it). Scored on the relief behind (the highest angle over
    // three rays across the frame, 10 deg cap, x3), the lit things in the frame's width (250 m - 3.5 km, x0.4) and the shore.
    // A0 19:00, the user: "both mountains and some life in the background, but no open sea, frame so you are closer to the plane,
    // lower FOV, and not too much sea" - the lens is the view's fov (26: about twice the plane of the 46 default at 18 m), and
    // every ray across the frame's width must reach land within 2.5 km (landFrac 1: no open sea; a spot short of it pays 30 a ray share)
    // A0 4 Nov: "a real mountain behind" - diag3's spot had 2.2 deg (a hill) with the eye held 30-50 deg off the nose: the relief
    // leads the score now, the sweep is wider and the eye goes all round
    if (!window.__refScene) {
      const ax = s.axes(), n = [-ax[0][0], -ax[0][2]], l = [-ax[2][0], -ax[2][2]], LITS = ${JSON.stringify(LITS)}, dist = ${+V.dist || 17};
      const hf = Math.atan(Math.tan((${+V.fov || 46} / 2) / 57.2958) * 16 / 9), cosHf = Math.cos(hf);
      const nn = Math.hypot(n[0], n[1]) || 1; n[0] /= nn; n[1] /= nn; const ll = Math.hypot(l[0], l[1]) || 1; l[0] /= ll; l[1] /= ll;
      const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
      let best = null, tried = 0;
      for (const side of [1, -1]) for (const off of [30, 50, 70, 90, 110, 130, 150]) { const co = Math.cos(off / 57.2958), si = Math.sin(off / 57.2958), e = [n[0] * co + side * l[0] * si, n[1] * co + side * l[1] * si], lk = [-e[0], -e[1]];
        const rays = [rot(lk, -0.7 * hf), lk, rot(lk, 0.7 * hf)];
        for (let px = -9000; px <= 2000; px += 150) for (let pz = -14500; pz <= -5000; pz += 150) {
          if (!wet(px, pz) || !wet(px + e[0] * dist, pz + e[1] * dist)) continue;
          let fg = true; for (let k = 20; k <= 150; k += 26) if (!wet(px + lk[0] * k, pz + lk[1] * k)) { fg = false; break; } if (!fg) continue;
          tried++;
          const ex = px + e[0] * dist, ez = pz + e[1] * dist, ey = (w.waterH(px, pz) || 0) + 1.5;
          let mt = 0; for (const r of rays) for (let k = 800; k <= 14000; k += 250) { const a = Math.atan2(w.terrainH(ex + r[0] * k, ez + r[1] * k) - ey, k) * 57.2958; if (a > mt) mt = a; }
          let L = 0; for (const p of LITS) { const vx = p[0] - ex, vz = p[1] - ez, dd = Math.hypot(vx, vz); if (dd < 250 || dd > 3500) continue; if ((vx * lk[0] + vz * lk[1]) / dd < cosHf) continue; L += p[2]; }
          const top = Math.min(mt, 10) * 3 + Math.min(L, 30) * 0.4 - (L < 6 ? 12 : 0);   // "some life": under 6 lit things pays 12 if (best && top <= best.sc) continue;   // the shore can only cost
          let land = 0; for (let r = 0; r < 9; r++) { const a = -hf + 2 * hf * r / 8, ca = Math.cos(a), sa = Math.sin(a), rx = lk[0] * ca - lk[1] * sa, rz = lk[0] * sa + lk[1] * ca;
            for (let k = 60; k <= 2500; k += 40) if (!wet(ex + rx * k, ez + rz * k)) { land++; break; } }
          const lf = land / 9, sc = top - (1 - lf) * 30;
          if (!best || sc > best.sc) best = { sc, side, off, px, pz, look: lk, L, mt: +mt.toFixed(1), lf: +lf.toFixed(2) };
        } }
      window.__refScene = best ? Object.assign(best, { tried }) : { sc: 0, side: 1, px: -4200, pz: -9500, look: [0.94, 0.34], L: 0, mt: 0, tried };
    }
    const R = window.__refScene; px = R.px; pz = R.pz; agl = window.__floatAgl; look = R.look;
  }
  if (aim === 'compose') {   // THE PHOTOGRAPHER'S FRAME: peaks found on the terrain (400 m grid, 30 km round the roll-out; Mount Ardent always),
    // the eye 35 or 45 deg off the nose (port or starboard: the probe moves the plane, never turns it, so the LOOK is fixed by the
    // roll-out's heading and the plane goes on the line from the eye to the peak, 2-18 km short of it). Kept where the plane, the
    // eye and a 15 m ring are water, the peak is not hidden by nearer ground (30 m of trees on it), and the frame's width reaches land
    // within 7 km (no open sea) but no nearer than 1 km across the middle of the frame (scout 1: a wall of trees, no sky, no mountain:
    // a low eye hides the far water anyway). The peak 3-10.5 deg up (the lens' top is 12: all of it in the frame), 0 or 7 deg either
    // side of the plane. Scored on the peak's angle (x3) and the lit things in the frame (x0.8, 20 cap). The best per peak,
    // best first, the best with the town's lights second: pick 0, 1, 2 are different backdrops.
    if (!window.__compose && !${JSON.stringify(!!FRAME)}) {
      const ax = s.axes(), n = [-ax[0][0], -ax[0][2]], l = [-ax[2][0], -ax[2][2]], LITS = ${JSON.stringify(LITS)}, dist = ${+V.dist || 22};
      const nn = Math.hypot(n[0], n[1]) || 1; n[0] /= nn; n[1] /= nn; const ll = Math.hypot(l[0], l[1]) || 1; l[0] /= ll; l[1] /= ll;
      const hf = Math.atan(Math.tan((${+V.fov || 24} / 2) / 57.2958) * 16 / 9), cosHf = Math.cos(hf);
      const c0 = s.cgPos(), cells = [];
      for (let x = c0[0] - 30000; x <= c0[0] + 30000; x += 400) for (let z = c0[2] - 30000; z <= c0[2] + 30000; z += 400) { const h = w.terrainH(x, z); if (h > 150 && !wet(x, z)) cells.push([h, x, z]); }
      cells.sort((a, b) => b[0] - a[0]);
      const peaks = [[w.terrainH(${ARDENT[0]}, ${ARDENT[1]}), ${ARDENT[0]}, ${ARDENT[1]}, 'Ardent']];
      for (const q of cells) { if (peaks.length >= 10 || q[0] < 0.4 * (cells[0] ? cells[0][0] : 0)) break; if (peaks.every(p => Math.hypot(p[1] - q[1], p[2] - q[2]) > 3000)) peaks.push([q[0], q[1], q[2], 'peak' + peaks.length]); }
      const out = [];
      for (const P of peaks) { let bestP = null;
        for (const side of [1, -1]) for (const off of [35, 45]) for (const beside of [0, 0.122, -0.122]) { const co = Math.cos(off / 57.2958), si = Math.sin(off / 57.2958), e = [n[0] * co + side * l[0] * si, n[1] * co + side * l[1] * si], lk = [-e[0], -e[1]];
          const cb = Math.cos(beside), sb = Math.sin(beside), tp = [lk[0] * cb - lk[1] * sb, lk[0] * sb + lk[1] * cb];   // the line to the peak, beside the look
          for (let k = 4000; k <= 24000; k += 250) {
            const px = P[1] - tp[0] * k, pz = P[2] - tp[1] * k, ex = px + e[0] * dist, ez = pz + e[1] * dist;
            if (!wet(px, pz) || !wet(ex, ez)) continue;
            let ring = true; for (let r = 0; r < 8 && ring; r++) { const a = r * Math.PI / 4; if (!wet(px + Math.cos(a) * 15, pz + Math.sin(a) * 15)) ring = false; } if (!ring) continue;
            const ey = (w.waterH(px, pz) || 0) + 2.5, D = k + dist, pa = Math.atan2(P[0] - ey, D) * 57.2958;
            if (pa < 3 || pa > 10.5) continue;
            let hid = false; for (let t = 300; t < D - 1500 && !hid; t += 150) { const g = w.terrainH(ex + tp[0] * t, ez + tp[1] * t) + 30; if (Math.atan2(g - ey, t) * 57.2958 > pa - 1) hid = true; } if (hid) continue;
            let near = false; for (const a of [-0.5 * hf, 0, 0.5 * hf]) { const ca = Math.cos(a), sa = Math.sin(a), rx = lk[0] * ca - lk[1] * sa, rz = lk[0] * sa + lk[1] * ca; for (let t = 60; t < 1000 && !near; t += 60) if (!wet(ex + rx * t, ez + rz * t)) near = true; } if (near) continue;
            let land = 0; for (let r = 0; r < 9; r++) { const a = -hf + 2 * hf * r / 8, ca = Math.cos(a), sa = Math.sin(a), rx = lk[0] * ca - lk[1] * sa, rz = lk[0] * sa + lk[1] * ca;
              for (let t = 60; t <= 7000; t += 60) if (!wet(ex + rx * t, ez + rz * t)) { land++; break; } }
            let L = 0; for (const q of LITS) { const vx = q[0] - ex, vz = q[1] - ez, dd = Math.hypot(vx, vz); if (dd < 300 || dd > D) continue; if ((vx * lk[0] + vz * lk[1]) / dd < cosHf) continue; L += q[2]; }
            const lf = land / 9, sc = pa * 3 + Math.min(L, 20) * 0.8 - (1 - lf) * 30;
            if (!bestP || sc > bestP.sc) bestP = { sc, side, off, beside: +(beside * 57.2958).toFixed(0), px, pz, look: lk, L, mt: +pa.toFixed(1), lf: +lf.toFixed(2), peak: P[3], peakAt: [Math.round(P[1]), Math.round(P[2])], peakH: Math.round(P[0]), km: +(D / 1000).toFixed(1) };
          } }
        if (bestP) out.push(bestP); }
      out.sort((a, b) => b.sc - a.sc);
      const tw = out.findIndex(c => c.L >= 6); if (tw > 1) out.splice(1, 0, out.splice(tw, 1)[0]);   // the town's lights in the first two
      window.__compose = { list: out, peaks: peaks.map(p => [p[3], Math.round(p[0]), Math.round(p[1]), Math.round(p[2])]) };
    }
    const FR = ${JSON.stringify(FRAME)}, C = FR ? [{ sc: 0, side: 1, px: FR.plane[0], pz: FR.plane[1], look: [Math.sin(FR.bearing / 57.29578), -Math.cos(FR.bearing / 57.29578)], L: 0, mt: 0, lf: 1, peak: 'frame' }] : window.__compose.list, R = C[Math.min(FR ? 0 : ${+V.pick || 0}, C.length - 1)] || { sc: 0, side: 1, px: -4200, pz: -9500, look: [0.94, 0.34], L: 0, mt: 0 };
    window.__refScene = Object.assign({ tried: C.length }, R); px = R.px; pz = R.pz; agl = window.__floatAgl; look = R.look;
  }
  if (aim === 'toward') { const T = ${JSON.stringify(V.to || [0, 0])}; const tx = T[0] - px, tz = T[1] - pz, h = Math.hypot(tx, tz) || 1; look = [tx / h, tz / h]; }
  if (aim === 'sun') { const sv = DAY_CLOCK.day().sun, h = Math.hypot(sv[0], sv[2]) || 1; look = [sv[0] / h, sv[2] / h]; }
  if (aim === 'moon' || aim === 'awayMoon') { const mv = DAY_CLOCK.day().moon, h = Math.hypot(mv[0], mv[2]) || 1, k = aim === 'moon' ? 1 : -1; look = [mv[0] / h * k, mv[2] / h * k]; }
  if (aim === 'runway' && ${JSON.stringify(V.at)} === 'stand') { const cg = s.cgPos(); look = [cx - cg[0] + dx * len * 0.3, cz - cg[2] + dz * len * 0.3]; const l = Math.hypot(look[0], look[1]) || 1; look = [look[0] / l, look[1] / l]; }
  if (aim === 'ref' && agl == null) agl = 2;
  if (agl != null) { const cg = s.cgPos(), wh = w.waterH ? w.waterH(px, pz) : null, gy = Math.max(w.terrainH(px, pz), Number.isFinite(wh) ? wh : -1e9) + agl;   // the sea's level IS 0 (|| -1e9 sank the plane 13 m)
    if (aim !== 'compose' || !${TAXI_MS}) await FLIGHT_PROBE.place({ at: [px, gy, pz], zeroV: true });
    // THE TAXI: once a view, the plane put back along its own nose and given the taxi's speed, so it comes through the frame's spot with a wake
    // behind it by the capture; the hand holds a low throttle (a seed on the first view: the pilot's roll-out ends there)
    else if (window.__nsPlaced !== ${JSON.stringify(V.name)}) {
      window.__nsPlaced = ${JSON.stringify(V.name)};
      const ax = s.axes(), h = Math.hypot(ax[0][0], ax[0][2]) || 1; let nx = -ax[0][0] / h, nz = -ax[0][2] / h, yaw = 0; const back = ${TAXI_MS} * 15, NB = ${NOSE == null ? 'null' : +NOSE};
      // --nose <bearing>: the plane turned to that heading first (the user: it should go to the right of the frame)
      if (NB != null) { const tx = Math.sin(NB / 57.29578), tz = -Math.cos(NB / 57.29578); yaw = Math.atan2(nz * tx - nx * tz, nx * tx + nz * tz); nx = tx; nz = tz; }
      await FLIGHT_PROBE.place({ yaw, at: [px - nx * back, gy, pz - nz * back], zeroV: true, dv: [nx * ${TAXI_MS}, 0, nz * ${TAXI_MS}] });
      if (!FLIGHT_PROBE.manual()) { s.ctl.thr = ${THR}; FLIGHT_PROBE.setManual(true); }
    }
    // L31a: after a worker placement the view's cgPos stays at the roll-out (the camera and the terrain's streaming follow it) while the page's sim.p and the model move: the photo scenes read the live points
    if (aim === 'compose' && !s.__nsCg) { s.__nsCg = 1; const gv = new THREE.Vector3(); s.cgPos = () => { const K0 = window.FLYDIY_COCKPIT_I, g = K0 && K0.model && K0.model.grp; if (g) { g.getWorldPosition(gv); return [gv.x, gv.y + (window.__nsLift || 0), gv.z]; } const q = s.p, N = q.length / 3; let x = 0, y = 0, z = 0; for (let i = 0; i < N; i++) { x += q[i * 3]; y += q[i * 3 + 1]; z += q[i * 3 + 2]; } return [x / N, y / N + (window.__nsLift || 0), z / N]; }; }
    if (aim === 'compose') window.__nsLift = ${+V.lift || 0};
    // no thrown water in the picture (the user 4 Nov: "we need to see a wake, but no projections of water"): a RIG setting, the spray's and the sheets' meshes dark; the wake is the water's field, untouched
    if (aim === 'compose') { let rootN = FLIGHT_PROBE.camera(); while (rootN.parent) rootN = rootN.parent; rootN.traverse(o => { if (o.isMesh && o.geometry && o.geometry.isInstancedBufferGeometry && !o.frustumCulled && (o.renderOrder === 3 || o.renderOrder === 4) && o.material) o.material.visible = false; }); }
  }
  const az = Math.atan2(-look[1], -look[0]);   // app.js placeCamera: the eye at target + dist (cos el cos az, sin el, cos el sin az), looking back at it
  // the lens: the view's fov (the ref scene's 26), every other view the flight's own (46, put back)
  // the ref scene's eye is the plain orbit (diag3: the night frame sat closer than the blue and dusk ones of the same run, the
  // flight's own framing between them); camMode first - it puts the orbit's own distance back - then the lens, then the eye
  if ((aim === 'ref' || aim === 'compose') && FLIGHT_PROBE.camMode && FLIGHT_PROBE.camModeNow && FLIGHT_PROBE.camModeNow() !== 'orbit') FLIGHT_PROBE.camMode('orbit');
  if (window.FLYDIY_HVIEW && FLYDIY_HVIEW.flyFov) { const cm = FLIGHT_PROBE.camera(); if (window.__fov0 == null) window.__fov0 = cm.fov; FLYDIY_HVIEW.flyFov(${+V.fov || 0} || window.__fov0); }
  window.__nsAz = az;
  FLIGHT_PROBE.camSet(az, ${V.el}, ${V.dist}); if ((aim === 'ref' || aim === 'compose') && FLIGHT_PROBE.camSettle) FLIGHT_PROBE.camSettle();
  const LT = ${JSON.stringify(V.lights || null)}, K = window.FLYDIY_COCKPIT_I || null, lit = {};   // app.js's CK is module-local; the page hands it out as FLYDIY_COCKPIT_I
  if (LT && K && K.sw) { for (const k of Object.keys(LT)) if (('sw_' + k) in K.sw) { K.sw['sw_' + k] = LT[k]; if (K.handSw) K.handSw['sw_' + k] = true; lit[k] = LT[k]; } if (K.glow) K.glow(0); }
  const d = DAY_CLOCK.day();
  return { lights: LT ? { set: lit, lightOn: K ? K.lightOn : null, unfit: K && K.unfit ? [...K.unfit] : null, lamps: K && K.model && K.model.lamps ? K.model.lamps.map(l => l.kind + ':' + l.key) : null, flood: K && K.model && K.model.floodLight ? +K.model.floodLight.intensity.toExponential(3) : null } : null,
    floatAgl: window.__floatAgl, scene: window.__refScene ? (R => ({ plane: [Math.round(R.px), Math.round(R.pz)], side: R.side > 0 ? 'port' : 'starboard', offNose: R.off, bearingGrid: Math.round((Math.atan2(R.look[0], -R.look[1]) * 57.2958 + 360) % 360), lits: R.L, reliefDeg: R.mt, landFrac: R.lf, kmh: +(Math.hypot(...FLIGHT_PROBE.sim().cgVel()) * 3.6).toFixed(1), tried: R.tried, peak: R.peak, peakAt: R.peakAt, peakH: R.peakH, peakKm: R.km, peaks: window.__compose ? window.__compose.peaks : undefined, fov: FLIGHT_PROBE.camera().fov, camMode: FLIGHT_PROBE.camModeNow ? FLIGHT_PROBE.camModeNow() : null, eyeOverWater: (c => +(c.eye[1] - Math.max(w.terrainH(c.eye[0], c.eye[2]), Number.isFinite(w.waterH(c.eye[0], c.eye[2])) ? w.waterH(c.eye[0], c.eye[2]) : -1e9)).toFixed(2))(FLIGHT_PROBE.camGet()), eyeDist: (c => +Math.hypot(c.eye[0] - c.target[0], c.eye[1] - c.target[1], c.eye[2] - c.target[2]).toFixed(2))(FLIGHT_PROBE.camGet()), score: +R.sc.toFixed(1) }))(window.__refScene) : null, local: d.local, sunEl: +d.sunEl.toFixed(1), moonEl: +d.moonEl.toFixed(1), phase: +d.moonPhase.toFixed(3), sea: sea.map(v => +v.toFixed(2)), az: +az.toFixed(3) };
})()`;
const FRAMES = n => `new Promise(r => { let k = 0; const f = () => { if (++k >= ${n}) r(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;
// the light as the page holds it, and the resolve target's fp16 radiance over the ground band
const REPORT = `(() => {
  const W = window, w = window.WORLD || {}, R = FLIGHT_PROBE.renderer(), L = W.SKY_LIGHT && W.SKY_LIGHT.last, d = DAY_CLOCK.day();
  const o = { key: L ? (L.isMoon ? 'moon' : 'sun') : '?', keyI: w.sun ? +w.sun.intensity.toExponential(3) : null, keyY: w.SUN ? +w.SUN.y.toFixed(3) : null,
    keyDirMoon: !!(w.KEY_SKY), hemiI: w.hemi ? +w.hemi.intensity.toExponential(3) : null, exposure: +R.toneMappingExposure.toExponential(3),
    moonPhase: +d.moonPhase.toFixed(3), moonEl: +d.moonEl.toFixed(1), sunEl: +d.sunEl.toFixed(1), cover: d.cloudCoverEff,
    night: W.LIGHT_RIG && W.LIGHT_RIG.nightU ? Array.from(W.LIGHT_RIG.nightU.uNightEye.value.toArray ? W.LIGHT_RIG.nightU.uNightEye.value.toArray() : W.LIGHT_RIG.nightU.uNightEye.value).map(v => +v.toFixed(3)) : null,
    linear: W.FLYDIY_AA && W.FLYDIY_AA.linear ? W.FLYDIY_AA.linear() : null,
    // the exposure's chain: the schedule's, the declared base, the ease, the eye, the rig row
    exSched: W.LIGHT_RIG ? +W.LIGHT_RIG.exposureFor(d.sunEl).toExponential(3) : null, exBase: W.GFX && W.GFX.exposureBase ? W.GFX.exposureBase() : null, eyeK: W.GFX && W.GFX.eye ? W.GFX.eye() : null,
    ease: W.LIGHT_EASE ? { on: W.LIGHT_EASE.on, init: W.LIGHT_EASE.init, ex: W.LIGHT_EASE.ex, tEx: W.LIGHT_EASE.tEx, setEx: W.LIGHT_EASE.setEx, applies: W.LIGHT_EASE.applies, writes: W.LIGHT_EASE.writes } : null,
    rig: w.rig && w.rig.get ? (r => ({ manual: r.manual, exposure: r.exposure, env: r.env }))(w.rig.get()) : null, inGarage: !!(W.FLYDIY_IN_GARAGE),
    // the premises lamps under the pre-exposure (NIGHT-LOOK 3 Nov: the town's windows went dark at P = 2^14)
    pre: W.LIGHT_RIG && W.LIGHT_RIG.preState ? W.LIGHT_RIG.preState() : null,
    lamps: (Lm => Lm ? { on: Lm.on, kLit: Lm.kLit, litNow: Lm.litNow, armed: Lm.armed, muted: Lm.muted, glassN: Lm.glass.size, glowKeys: Lm.glowKeys.size,
      glass: [...Lm.glass].slice(0, 3).map(([u, b]) => [b, u.value]), pool: Lm.pool.map(l => +l.intensity.toExponential(2)) } : null)(w.premises && w.premises.lamps),
    glow: (() => { try { const out = {}; for (const [k, v] of PROP_GLOW) { const b = PROP_BUILT.get(k), ms = []; if (b) for (const m0 of b.mats) MATLIB.each(m0, m => { if (m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b) && ms.length < 4) ms.push([m.name || m.type, m.userData.emis0, +(+m.emissiveIntensity).toExponential(3), m.emissive.getHexString(), m.toneMapped, m.uuid.slice(0, 6)]); }); out[k] = { k: v, built: !!b, ms }; } return out; } catch (e) { return 'ERR ' + e.message; } })() };
  try {
    const rt = W.FLYDIY_AA && W.FLYDIY_AA.target && W.FLYDIY_AA.target();
    if (rt) {
      const ww = 96, hh = 48, x0 = Math.floor(rt.width / 2 - ww / 2), y0 = Math.floor(rt.height * 0.18);   // a ground band low in the frame
      const buf = new Uint16Array(ww * hh * 4); R.readRenderTargetPixels(rt, x0, y0, ww, hh, buf);
      const h2f = h => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * f * Math.pow(2, -24) : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * Math.pow(2, e - 15); };
      let sum = 0, n = 0, minNZ = Infinity, sub = 0, zero = 0; const vals = new Set();
      for (let i = 0; i < ww * hh; i++) { const r = h2f(buf[i * 4]), g = h2f(buf[i * 4 + 1]), b = h2f(buf[i * 4 + 2]); const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += Y; n++; vals.add(buf[i * 4 + 1]); if (g > 0 && g < minNZ) minNZ = g; if (g > 0 && g < 6.1e-5) sub++; if (g === 0) zero++; }
      o.rt = { type: rt.texture.type, samples: rt.samples, meanY: +(sum / n).toExponential(3), minG: minNZ === Infinity ? 0 : +minNZ.toExponential(3), distinctG: vals.size, subnormalShare: +(sub / n).toFixed(3), zeroShare: +(zero / n).toFixed(3) };
      // the hot pixels (NIGHT-LOOK 3 Nov: the shore lamps lost under P): the lower 65 % of the target (the land, the water, the
      // aeroplane - the stars above), each texel's luminance as exposed (x the renderer's exposure); how many pass 1 and 4,
      // and the ten brightest spots 12 px apart (x / y as fractions of the frame from its top left) - drawn into the target or lost after it
      if (rt.width * rt.height <= 4.2e6) {
        const fw = rt.width, fh = Math.floor(rt.height * 0.65), fb = new Uint16Array(fw * fh * 4); R.readRenderTargetPixels(rt, 0, 0, fw, fh, fb);
        const ek = R.toneMappingExposure, hot = []; let n1 = 0, n4 = 0, bad = 0;
        for (let i = 0; i < fw * fh; i++) { const r = h2f(fb[i * 4]), g = h2f(fb[i * 4 + 1]), b = h2f(fb[i * 4 + 2]); if (!isFinite(r + g + b)) { bad++; continue; }
          const E = (0.2126 * r + 0.7152 * g + 0.0722 * b) * ek; if (E > 1) { n1++; if (E > 4) n4++; hot.push([E, i, r, g, b]); } }
        hot.sort((p, q) => q[0] - p[0]); const top = [];
        for (const h of hot) { const x = h[1] % fw, y = rt.height - 1 - Math.floor(h[1] / fw); if (top.some(t => Math.abs(t.x - x) < 12 && Math.abs(t.y - y) < 12)) continue; top.push({ x, y, E: +h[0].toFixed(2), rgb: [h[2], h[3], h[4]].map(v => +(v * ek).toFixed(2)) }); if (top.length >= 10) break; }
        o.hot = { over1: n1, over4: n4, nonFinite: bad, top: top.map(t => [+(t.x / rt.width).toFixed(3), +(t.y / rt.height).toFixed(3), t.E, t.rgb]) };
      }
    }
  } catch (e) { o.rtErr = String(e).slice(0, 120); }
  return JSON.stringify(o);
})()`;

// ---- the PNG's numbers (an 8-bit RGB/RGBA PNG, not interlaced: CDP's) ----
function png(file) {
  const b = fs.readFileSync(file); let o = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (o < b.length) { const n = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'IDAT') idat.push(d); o += 12 + n; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), st = w * bpp, px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)], src = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)), row = px.subarray(y * st, (y + 1) * st), up = y ? px.subarray((y - 1) * st, y * st) : null;
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, u = up ? up[x] : 0, c = (up && x >= bpp) ? up[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? u : c); }
      row[x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const LIN = Array.from({ length: 256 }, (_, i) => lin(i));
function stats(file) {
  const P = png(file), { w, h, bpp, px } = P;
  // the 3D view without the rails: the middle 60 % across, 8-92 % down; bands: the top fifth (sky) and the bottom fifth (ground)
  const box = (y0, y1) => { let s = 0, c = 0, n = 0; for (let y = Math.floor(h * y0); y < Math.floor(h * y1); y++) for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
    const i = (y * w + x) * bpp; s += 0.2126 * LIN[px[i]] + 0.7152 * LIN[px[i + 1]] + 0.0722 * LIN[px[i + 2]]; c += (px[i] + px[i + 1] + px[i + 2]) / 3; n++; } return [s / n, c / n]; };
  const [mY, mC] = box(0.08, 0.92), [sY, sC] = box(0.08, 0.26), [gY, gC] = box(0.74, 0.92);
  return { meanY: +mY.toFixed(5), meanCode: +mC.toFixed(1), skyY: +sY.toFixed(5), skyCode: +sC.toFixed(1), groundY: +gY.toFixed(5), groundCode: +gC.toFixed(1) };
}
function diff(f1, f2) {
  const A = png(f1), B = png(f2); let n = 0, mx = 0;
  for (let i = 0; i < A.px.length && i < B.px.length; i++) { const d = Math.abs(A.px[i] - B.px[i]); if (d) n++; if (d > mx) mx = d; }
  return { differing: n, maxDelta: mx };
}

async function runPage(page) {
  const port = 9300 + (process.pid % 300) + PAGES.indexOf(page);
  const udd = path.join(os.tmpdir(), 'cdp_moon_' + port + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=' + SIZE[0] + ',' + SIZE[1], '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  const rows = [];
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    let conN = 0; const conLog = t => { if (conN++ < 60) console.log('CONSOLE ' + String(t).slice(0, 700)); };   // the page's errors in the run's log (a frame that lost the plane says why here)
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') conLog('EXC ' + JSON.stringify(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text));
      if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || (m.params.args[0] && /^NSDIAG/.test(m.params.args[0].value || '')))) conLog(m.params.type + ' ' + m.params.args.map(q => q.value != null ? q.value : q.description).join(' ')); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\./.test(k)) localStorage.removeItem(k)}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
    const url = 'http://localhost:' + SPORT + '/flyDiy/' + page + (Q ? '?' + Q : '');
    await cmd('Page.navigate', { url });
    await sleep(1500);
    try { await ev("Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('timeout'), 150000))])"); } catch (e) { await sleep(18500); }
    if (BUILD) {   // the build, through the garage's own set door (a new aeroplane: no slot, no plaque), before the roll-out
      const raw = JSON.parse(fs.readFileSync(BUILD, 'utf8')), spec = raw.spec || raw;
      if (OVER) spec.cage = Object.assign({}, spec.cage, OVER);
      for (let i = 0; i < 60 && !(await ev('!!(window.GARAGE_SPEC && GARAGE_SPEC.set)')); i++) await sleep(1000);
      await ev('(GARAGE_SPEC.set(' + JSON.stringify(spec) + '), 1)'); await sleep(4000);
      console.log('night_shots: build ' + path.basename(BUILD) + (OVER ? ' over ' + JSON.stringify(OVER) : '') + ' set; gear ' + JSON.stringify(spec.gear && spec.gear.type));
    }
    if (SPAWN) { await ev('(window.FLYDIY_ROUTE && FLYDIY_ROUTE.spawn ? FLYDIY_ROUTE.spawn(' + JSON.stringify(SPAWN) + ') : null)'); console.log('night_shots: roll-out from ' + SPAWN); }
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) { await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); await sleep(6000); flying = await ev("/TAXI|TAKEOFF|ROLL|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) && !!window.FLIGHT_PROBE"); }
    if (BUILD) await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");   // a float build: held on the water before its pilot starts a take-off run
    for (let i = 0; i < 150; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    await sleep(3000);   // the overlay gone + 3 s
    // the flight's electrics while it RUNS, before the first view pauses it (a lamp dark with master + alt on: the rig, or a player's state?)
    for (let i = 0; i < 3; i++) { await ev("(() => { const K = window.FLYDIY_COCKPIT_I, b = K && K.bus, e = FLIGHT_PROBE.sim(); console.log('NSDIAG running bus', JSON.stringify(b ? { V: b.V, ok: b.ok, soc: b.soc, master: b.master, alt: b.alt, altOn: b.altOn, loadA: b.loadA, busOk: K.busOk, btn: document.getElementById('bPause').textContent, hud: e.t } : 'no bus')); return 1; })()"); await sleep(1500); }
    const tag = path.basename(page, '.html') + (Q ? '_' + Q.replace(/\W+/g, '') : '') + BTAG;
    fs.mkdirSync(OUT, { recursive: true });
    const hasNight = await ev('!!(window.LIGHT_RIG && window.LIGHT_RIG.setNight)');
    for (const V of VIEWS) for (const [vi, VAR] of VARIANTS.entries()) {
      if (vi > 0 && (/^(noon|dusk|sunset)/.test(V.name) || !hasNight)) continue;
      if (hasNight) await ev('(LIGHT_RIG.setNight(Object.assign(LIGHT_RIG.nightDefaults(), ' + JSON.stringify(VAR || {}) + ')), window.WORLD && WORLD.relight && WORLD.relight(), 1)');
      if (opt('eval', null)) await ev('(() => { ' + opt('eval') + ' ; return 1; })()');   // --eval '<js>': a page toggle before each view (a diagnosis: GFX.set('bloom','off'))
      const vt = hasNight && !/^(noon|dusk|sunset)/.test(V.name) ? vtag(VAR) : '';
      const plan = await ev(SETUP(V));
      await ev(FRAMES(90)); await sleep((V.settle || 8) * 1000);     // the light's ease (LIGHT-SMOOTH tau 1.2 s), the probe's re-bake, the clouds' fit
      const plan2 = await ev(SETUP(V));            // again: the aeroplane and the orbit where they were asked (a fit or a probe moved nothing, but be sure)
      if (opt('after', null)) await ev('(() => { ' + opt('after') + ' ; return 1; })()');   // --after '<js>': a page change after the lights are set, before the frames (a tuning round)
      await ev(FRAMES(120)); await sleep(1500);
      if (PHOTO && !argv.includes("--hud")) await ev("(() => { let st = document.getElementById('__nsClean'); if (!st) { st = document.createElement('style'); st.id = '__nsClean'; st.textContent = 'body * { visibility: hidden !important; }'; document.head.appendChild(st); } const cs = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height); if (cs[0]) cs[0].style.setProperty('visibility', 'visible', 'important'); return 1; })()");   // a picture: no HUD, no card
      await sleep(300);
      const png1 = await cmd('Page.captureScreenshot', { format: 'png' });
      // THE SWEEP (the user 4 Nov: "you can try many angles in a single scene, saving you the load time"): --sweep 1, the settled scene from many
      // eyes, each a camSet and a few frames. n name; da degrees round the plane from the view's own; dist m; eye m over the water; lift m over the plane's centre; fov deg
      if (PHOTO && opt('sweep', null)) {
        const CG = 1.6, EYES = [['low_close', 0, 15, 0.7, 1.3, 24], ['low_closer', 0, 11, 0.7, 1.5, 28], ['low_far', 0, 30, 0.8, 1.6, 22], ['wide', 0, 16, 0.9, 1.6, 36], ['wider', 0, 12, 0.8, 1.8, 46],
          ['left20', -20, 20, 0.9, 1.3, 24], ['right20', 20, 20, 0.9, 1.3, 24], ['left45', -45, 18, 0.8, 1.4, 28], ['right45', 45, 18, 0.8, 1.4, 28], ['front', 60, 16, 0.8, 1.5, 30], ['belly', 15, 9, 0.6, 2.2, 40], ['high', 0, 22, 3.0, 0.6, 24]];
        const PICK_E = String(opt('sweep')) === '1' ? null : String(opt('sweep')).split(',');   // --sweep low_close,belly: only those eyes
        for (const [n, da, dist, eye, lift, fov] of EYES) {
          if (PICK_E && !PICK_E.includes(n)) continue;
          const el = Math.asin(Math.max(-0.5, Math.min(0.5, (eye - CG - lift) / dist)));
          await ev('(() => { window.__nsLift = ' + lift + '; FLYDIY_HVIEW.flyFov(' + fov + '); FLIGHT_PROBE.camSet(window.__nsAz + ' + (da / 57.29578) + ', ' + el + ', ' + dist + '); return 1; })()');
          await ev(FRAMES(12)); await sleep(350);
          const pa = await cmd('Page.captureScreenshot', { format: 'png' });
          fs.mkdirSync(path.join(OUT, 'sweep'), { recursive: true });
          fs.writeFileSync(path.join(OUT, 'sweep', V.name + vt + '_' + n + '.png'), Buffer.from(pa.result.data, 'base64'));
        }
      }
      // THE SHOTS: --shots <file.json>, [[name, js], ...]: the scene paused on the frame just taken (the same instant), a page change, a capture - tones and dials A/B with no load
      if (PHOTO && opt('shots', null)) {
        await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()"); await sleep(300);
        fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
        for (const [n, js] of JSON.parse(fs.readFileSync(opt('shots'), 'utf8'))) {
          await ev('(() => { ' + js + ' ; return 1; })()'); await ev(FRAMES(16)); await sleep(250);
          const said = await ev('window.__say || null'); if (said) { fs.appendFileSync(path.join(OUT, 'shots', 'say.txt'), n + ' ' + JSON.stringify(said) + '\n'); await ev('window.__say = null'); }   // a shot's page numbers
          const ps = await cmd('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(OUT, 'shots', V.name + vt + '_' + n + '.png'), Buffer.from(ps.result.data, 'base64'));
        }
      }
      if (PHOTO) await ev("(() => { const st = document.getElementById('__nsClean'); if (st) st.remove(); return 1; })()");
      const file = path.join(OUT, V.name + '_' + tag + vt + '.png');
      fs.writeFileSync(file, Buffer.from(png1.result.data, 'base64'));
      const page = JSON.parse(await ev(REPORT)), st = stats(file);
      const row = { view: V.name, page: tag, dials: hasNight ? VAR : null, plan: plan2 || plan, still: st, light: page, file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/') };
      rows.push(row);
      console.log((V.name + vt).padEnd(30) + ' ' + tag.padEnd(22) + ' meanY ' + st.meanY.toFixed(4) + ' code ' + st.meanCode.toFixed(0) + ' sky ' + st.skyCode.toFixed(0) + ' gnd ' + st.groundCode.toFixed(0)
        + ' | ex sched ' + page.exSched + ' base ' + page.exBase + ' ease ' + JSON.stringify(page.ease) + ' rig ' + JSON.stringify(page.rig)
        + ' | ' + page.key + ' I ' + page.keyI + ' keyY ' + page.keyY + ' hemi ' + page.hemiI + ' ex ' + page.exposure + (page.rt ? ' | rt meanY ' + page.rt.meanY + ' minG ' + page.rt.minG + ' distinct ' + page.rt.distinctG + ' sub ' + page.rt.subnormalShare : '') + ' | ' + plan.local);
    }
    try { await cmd('Browser.close'); } catch (e) {}
  } finally { await sleep(500); kill(); }
  return rows;
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(SPORT), REPO, '--fallback', FALLBACK], { stdio: 'ignore' });
  await sleep(800);
  const all = [];
  try {
    for (const p of PAGES) { console.log('night_shots: ' + p + (Q ? ' ?' + Q : '')); all.push(...await runPage(p)); }
  } finally { try { execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} }
  // the day's proof: each daytime view, page against page (the first two pages)
  const t = (n, p) => path.join(OUT, n + '_' + path.basename(p, '.html') + (Q ? '_' + Q.replace(/\W+/g, '') : '') + '.png');
  if (PAGES.length >= 2) for (const V of VIEWS.filter(v => /^(noon|dusk|sunset)/.test(v.name))) {
    if (fs.existsSync(t(V.name, PAGES[0])) && fs.existsSync(t(V.name, PAGES[1]))) { const d = diff(t(V.name, PAGES[0]), t(V.name, PAGES[1])); console.log('DAY PROOF ' + V.name + ' (page vs page): ' + JSON.stringify(d)); all.push({ view: V.name, dayProof: d }); }
  }
  for (const p of PAGES) for (const n of ['noon_over', 'noonx_over']) if (fs.existsSync(t(n, p)) && fs.existsSync(t(n + '_b', p))) {   // the noise floor: one page, one place, twice, nothing moved
    const d = diff(t(n, p), t(n + '_b', p)); console.log('CONTROL ' + n + ' twice in ' + p + ': ' + JSON.stringify(d)); all.push({ view: n, control: p, d });
  }
  const jf = path.join(OUT, 'night_' + (Q ? Q.replace(/\W+/g, '') : 'default') + '.json');
  fs.writeFileSync(jf, JSON.stringify(all, null, 1));
  console.log('-> ' + path.relative(process.cwd(), jf));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
