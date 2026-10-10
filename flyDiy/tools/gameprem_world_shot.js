#!/usr/bin/env node
// gameprem_world_shot.js - G2310 PREM-S3: THE WORLD EVIDENCE, FOR A0's GPU BOX. NOT RUN IN THE CLOUD: SwiftShader cannot
// draw the world (it fails on world renders), so this ships unrun; A0 runs it on the box (a real GPU) and reads the stills.
//
// What it shoots (futureDesigns/GAME-PREMISES-2026-10-06.md §5 point 5; GAME §4.4):
//   1. EACH BASE'S EXTERIOR AGAINST ITS INTERIOR, AT THE SAME DIMS. A player document holding the main hangar and two side
//      hangars (w3: the field shed at Tamgas Hill, dressed - its doors in plank; HOME.2: the club next door at HOME), and in a
//      second pass mk_sea (the slipway shed at Metlakatla; ?town=all, Metlakatla's runway is in the 'town' variant only).
//      For each held hangar: the garage opened THERE (FLYDIY_PLAYER.set + the base select's playerGoTo: the room is that
//      shed's shell / dims / kits / dress) -> <id>_interior.jpg; then rolled out and the free eye put 30 m in front of the
//      plot's door and 8 m up, looking at it (FLYDIY_PREM_EYE) -> <id>_exterior.jpg. The two must read as the same building:
//      the frame family (timber / portal), the proportions, the door, the dress.
//   2. THE ROLL-OUT AT w3: a Cub saved and stood IN w3's side hangar, the garage there, `Roll out` pressed: the shot plays in
//      w3's room (its door) - frames every 0.5 s -> w3_rollout_##.jpg - and the first world frame at the plot's stand
//      (w3_stand.jpg); the trip's `anim` is read back ('played', not 'away').
//   3. THE SANDBOX, UNCHANGED: a fresh profile (HOME only) at HOME's stand -> sandbox_home.jpg, to sit beside the same still
//      from the base build (A0: `--page _base.html` with master's / the integration branch's built page beside this one).
//   Every still's JSON twin (the world's side sheds: WORLD.playerSheds(), the room's dims, `here`, the trip) -> shots.json.
//
//   node tools/gameprem_world_shot.js                     # all of it, the GPU (headless=new with the GPU flags)
//   node tools/gameprem_world_shot.js --only w3,rollout   # a part
//   node tools/gameprem_world_shot.js --headed            # a visible window (a laptop's GPU)
//   node tools/gameprem_world_shot.js --page _base.html   # another built page beside index.html (the sandbox control)
//   out: reports/evidence/PREM-S3/world/ (jpg + shots.json)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const OUT = path.join(ROOT, 'reports', 'evidence', 'PREM-S3', 'world');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('only', null) ? opt('only').split(',') : null;
const want = k => !ONLY || ONLY.includes(k);
const PAGE = opt('page', 'index.html'), PORT = +opt('port', 8131);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = require('./flight_core.js');

// THE DOCUMENT: the sandbox's own default, then the hangars held through the rules themselves (never written by hand)
function docWith(ids) {
  let d = C.playerNormalise(C.playerMigrate(C.playerDefault()));
  const buy = { w3: ['w3', 'w3', 'field'], 'HOME.2': ['HOME', 'HOME.2', 'club'], mk_sea: ['mk_sea', 'mk_sea', 'field'], SEA: ['SEA', 'SEA', 'field'] };
  for (const id of ids) { const b = buy[id]; const r = C.playerAcquire(d, b[0], b[1], b[2], 'own'); if (!r.ok) throw new Error(id + ': ' + r.why); d = r.doc; }
  if (d.sheds.w3) d.sheds.w3.parts = { doorMain: { set: 'rawplank', tile: 2, rough: 1, nrm: 1 } };   // a dress, so the exterior shows it
  return d;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = cp.spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  await sleep(1000);
  const browser = await pw.chromium.launch({ headless: !argv.includes('--headed'),
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=default', '--js-flags=--max-old-space-size=8192'] });
  const twin = {};
  const session = async (name, doc, search, body) => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await page.addInitScript(d => { try { if (sessionStorage.getItem('__ps')) return; sessionStorage.setItem('__ps', '1'); localStorage.clear(); if (d) localStorage.setItem('flydiy.player', d); localStorage.setItem('flydiy.flManual', '0'); } catch (e) {} }, doc ? JSON.stringify(doc) : null);
    const ev = async (expr, d) => { try { return await page.evaluate(expr); } catch (e) { return d === undefined ? 'ERR ' + e.message.split('\n')[0] : d; } };
    await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE + (search || ''), { waitUntil: 'load', timeout: 300000 });
    let up = false;
    for (let i = 0; i < 300 && !up; i++) {
      await sleep(2000);
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build|sandbox/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()", 0);
      up = (await ev("!!(window.FLYDIY_PLAYER && window.WORLD && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'))", false)) === true;
    }
    console.log(name + ': ' + (up ? 'up' : 'NOT up') + (errs.length ? ' (' + errs.length + ' page errors: ' + errs[0] + ')' : ''));
    if (up) { try { await body(page, ev, errs); } catch (e) { console.log('  ' + name + ': ' + e.message.split('\n')[0]); } }
    twin[name] = Object.assign(twin[name] || {}, { errors: errs.slice(0, 5) });
    await ctx.close();
  };
  const shoot = (page, f) => page.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 85, timeout: 120000 });
  const rollOut = async (page, ev) => { await ev("document.getElementById('edRoll').click()", 0); for (let i = 0; i < 120; i++) { await sleep(1000); if ((await ev('!!(window.FLYDIY_PREM_EYE && document.body && !document.body.classList.contains("garage") && (!window.BOOT || !BOOT.state || BOOT.state === "gone"))', false)) === true) break; } await sleep(4000); };
  const plotOf = async (ev, id) => JSON.parse(await ev(`JSON.stringify((()=>{ for (const a of window.WORLD.aerodromes || []) { const s = siteOf(a.id); const p = s && s.plots && s.plots.find(q => q.id === ${JSON.stringify(id)}); if (p) return p; } return null; })())`, 'null'));

  // 1. exterior vs interior, per held hangar
  const passes = [{ name: 'held', ids: ['w3', 'HOME.2'], search: '' }, { name: 'held_town', ids: ['mk_sea'], search: '?town=all' }];
  for (const P of passes) {
    const ids = P.ids.filter(want);
    if (!ids.length) continue;
    const doc = docWith(P.ids);
    for (const id of ids) {
      await session(P.name + ':' + id, doc, P.search, async (page, ev) => {
        await ev(`(()=>{ const d = FLYDIY_PLAYER.doc(); d.here = ${JSON.stringify(id)}; FLYDIY_PLAYER.set(d); return 1; })()`, 0);
        await ev("window.GARAGE_ENV && GARAGE_ENV.dims && GARAGE_ENV.dims()", 0);   // the room built for `here`
        await sleep(6000);
        const room = await ev('JSON.stringify({ here: FLYDIY_PLAYER.doc().here, dims: GARAGE_ENV.dims(), shell: GARAGE_ENV.shell() })', '');
        await shoot(page, id + '_interior.jpg');
        await rollOut(page, ev);
        const p = await plotOf(ev, id);
        if (p) {
          const fx = Math.cos(p.hdg), fz = Math.sin(p.hdg), y = (p.y || 0);
          await ev(`window.FLYDIY_PREM_EYE([${p.x + fx * 30}, ${y + 8}, ${p.z + fz * 30}], [${p.x}, ${y + 3}, ${p.z}])`, 0);
          await sleep(5000);
          await shoot(page, id + '_exterior.jpg');
        }
        const sheds = await ev('JSON.stringify(window.WORLD.playerSheds ? window.WORLD.playerSheds() : null)', '');
        twin[P.name + ':' + id] = { room, plot: p, sheds };
      });
    }
  }
  // 2. the roll-out at w3, out of the side hangar's door
  if (want('rollout')) {
    const doc = docWith(['w3']);
    doc.fleet = {}; doc.here = 'w3';
    await session('rollout:w3', doc, '', async (page, ev) => {
      // the default build saved as 'Cub' (garage.js's door), then stood in w3 through the rules (playerStore)
      await ev("(()=>{ const n = document.getElementById('gName') || document.querySelector('input[name=buildName]'); if (n) n.value = 'Cub'; const b = document.getElementById('gSave'); if (b) b.click(); return 1; })()", 0);
      await sleep(3000);
      await ev("(()=>{ const d = FLYDIY_PLAYER.doc(); const n = Object.keys(d.fleet)[0]; if (n) { d.fleet[n].hangar = 'w3'; d.fleet[n].aero = 'w3'; } d.here = 'w3'; FLYDIY_PLAYER.set(d); return n; })()", 0);
      await sleep(5000);
      await ev("document.getElementById('edRoll').click()", 0);
      for (let k = 0; k < 24; k++) { await sleep(500); await shoot(page, 'w3_rollout_' + String(k).padStart(2, '0') + '.jpg'); }
      await rollOut(page, ev);
      await shoot(page, 'w3_stand.jpg');
      twin['rollout:w3'] = { trip: await ev('JSON.stringify(window.FLYDIY_TRIP ? FLYDIY_TRIP.last && FLYDIY_TRIP.last() : null)', ''), route: await ev('JSON.stringify(window.FLYDIY_ROUTE ? FLYDIY_ROUTE.state && FLYDIY_ROUTE.state() : null)', '') };
    });
  }
  // 3. the sandbox, unchanged (HOME only)
  if (want('sandbox')) {
    await session('sandbox', null, '', async (page, ev) => {
      await rollOut(page, ev);
      await shoot(page, 'sandbox_home.jpg');
      twin.sandbox = { sheds: await ev('JSON.stringify(window.WORLD.playerSheds ? window.WORLD.playerSheds() : null)', '') };
    });
  }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(twin, null, 1));
  console.log('stills and shots.json -> ' + path.relative(ROOT, OUT));
  await browser.close();
  process.exit(0);
})();
