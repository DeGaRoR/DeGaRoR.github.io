'use strict';
// GATE GARAGEFIRST (PERF-LEAD, 23 Nov 2026): ?boot=garagefirst - THE GARAGE FIRST, THE WORLD'S STEPS BEHIND IT (app.js LAB.gf).
// The user's row 3: "world loading time 1 minute, including the background loading (so ideally 1 minute spent in the garage)".
// The switch is OFF by default; this gate holds (1) that a page WITHOUT it boots and builds exactly as before (the six boot
// sites it guards, the build's 40 ms slice, the first light's key), and (2) the background runner's own logic, run here on
// fakes: the steps in the boot's order by the trips' own door (tripRun), the budget's hook up for the run and gone after,
// the run ENDING in the task of its last step (a Go joined at that instant finds it over), and Go joining a run mid-way
// (the roll-out's screen names exactly the steps left, the run goes fast, the roll-out goes on once and only when it is over).
// It does NOT load a browser: what the garage looks like while the world loads is the box's (tools/perf/rows/gf-*.txt).
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '../src/viewer/app.js'), 'utf8');
let bad = 0;
const ok = (c, what, more) => { console.log((c ? '  ok   ' : '  FAIL ') + what + (more ? '  (' + more + ')' : '')); if (!c) bad++; };

// ---- 1. the page without the switch ----
// (RE-PINNED 23 Nov 2026 21:05, the user after the day's rows: "Make it default". The check asked that ONLY the switch turn it
//  on; it now asks the default's exact rule: a real page - a renderer that can compile ahead - unless ?boot=loadfirst)
ok(/const GF_DEFAULT = typeof location !== 'undefined' && !!renderer && typeof renderer\.compileAsync === 'function' && !LABQ\('boot=loadfirst'\);/.test(src)
  && /gf: LABQ\('boot=garagefirst'\) \|\| GF_DEFAULT,/.test(src), '1a garage first is the default on a real page; ?boot=loadfirst is the one loading screen as it was; the node harness keeps the old boot');
ok(/if \(GF_BOOT && LAB\.gfS\.cloudEarly\) \{ const t0 = performance\.now\(\); cloudsWarm\(\); try \{ renderer\.getContext\(\)\.finish\(\); \} catch \(e\) \{\}/.test(src),
  '1k the clouds\' first draw is inside the boot (the recheck step), the page waiting for the GPU there - not behind the garage');
ok(/const GF_BOOT = LAB\.gf && !GARAGE_ONLY;/.test(src), '1b the boot asks one constant (GF_BOOT), false without the switch');
const sites = (src.match(/!GARAGE_ONLY && !GF_BOOT/g) || []).length;
ok(sites === 6, '1c six boot sites leave the world out under it (the world\'s steps, the parked captures, the settled prelink, images / upload / worldCompile, first light, the craft\'s programs) and no other', sites + ' sites');
for (const [re, what] of [
  [/if \(!GARAGE_ONLY && !GF_BOOT\) for \(const id of \['world', 'town', 'parking', 'trees', 'ring', 'settle'\]\) bootTripStep\(id\);/, 'the world\'s steps'],
  [/if \(!GARAGE_ONLY && !GF_BOOT && !PHONE_FLY\) bootStep\('parked',/, 'the parked captures'],
  [/if \(!GARAGE_ONLY && !GF_BOOT\) for \(const id of \['images', 'upload', 'worldCompile'\]\) bootTripStep\(id\);/, 'images / upload / worldCompile'],
  [/if \(!GARAGE_ONLY && !GF_BOOT\) bootTripStep\('frames'\);/, 'first light'],
  [/if \(!GARAGE_ONLY && !GF_BOOT\) bootTripStep\('craft'\);/, 'the craft\'s programs']]) ok(re.test(src), '1d the boot list: ' + what);
ok(/tripClose\(bootTrip\); if \(GF_BOOT\) gfArm\(\);/.test(src), '1e the background run is armed only at the boot\'s done, only under the switch');
ok(/function gfSliceMs\(\) \{ const G = LAB\.gfS; if \(!gfLive\(\)\) return 40;/.test(src) && /performance\.now\(\) - t0 < SL\)/.test(src), '1f the world build\'s slice is 40 ms unless a background run is live');
ok(/key: \(\) => 'lit' \+ \(gfLive\(\) && !LAB\.gfS\.warm \? '-bg' : ''\)/.test(src), '1g first light\'s key is \'lit\' unless a live run left its draws to Go (?gfwarm=0)');
ok(/function craftInWorld\(fn\) \{\n\s+if \(!inGarage \|\| !WF\) return fn\(\);\n\s+if \(gfLive\(\)\) return fn\(\);/.test(src), '1h the aeroplane is lent to the world across tasks unless a background run is live');
ok(/if \(LAB\.gf\) \{ const G = LAB\.gfS;\n\s+if \(G\.joining\) return;\n\s+if \(G\.running\) \{ gfJoin\(\(\) => rollOut\(after, sync\)\); return; \}/.test(src), '1i Go joins a live run, once; a run that never began is left to the roll-out\'s own screen');
// (23 Nov, the garage's 1.4 s freeze: a live compile for another state - the shed dressed for the shot - left the sky's
//  materials on programs still linking, and the garage's next frame drew them)
ok(/const keepLive = gfLive\(\) && renderer\.properties \? \[\] : null;/.test(src) && /if \(keepLive\) for \(const \[pp, was\] of keepLive\) if \(pp\.currentProgram !== was\) \{ pp\.currentProgram = was; pp\.uniformsList = null;/.test(src),
  '1j a compile behind the live garage puts back the program its frames were drawing (and only a live run does)');

// ---- 2. the runner, on fakes ----
const a = src.indexOf('  const GF_IDS = ['), b = src.indexOf('  // one phase of a trip: its needed steps under the roll-out screen', a);
ok(a > 0 && b > a, '2a the runner\'s block is found (GF_IDS .. tripPhase)');
const tripIds = [...src.matchAll(/\{ id: '([A-Za-z]+)', part: '(craft|world)'/g)].map(m => [m[1], m[2]]);
function world(over) {
  const order = [], shown = [];
  const sb = {
    console, Promise, setTimeout, clearTimeout,
    performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
    LAB: { gf: true, gfS: { armed: false, running: false, done: false, fast: false, joining: false, warm: true, step: null, log: [], passed: {}, waits: {}, t0: 0, ms: 0, revealAt: 0,
      inputAt: -1e9, deadline: 0, restMs: 12, busyMs: 3, delayMs: 0, worstSlice: 0, slices: 0, why: null, err: null } },
    renderer: { info: { programs: [] }, compileAsync() {} },
    TRIP_BY: {}, tripOpen: kind => ({ kind, steps: [], ran: new Set() }), tripClose: t => { t.done = true; },
    PK_ASYNC: () => false, parkedFlush: () => {}, startLoop: () => {}, loopDone: f => f,
    BOOT: { state: 'gone', log: [], show: (set, opt) => { shown.push({ set, ids: opt.steps.map(s => s.id) });
      (async () => { for (const s of opt.steps) await s.fn(); opt.done(); })(); } },
    addEventListener: () => {},
  };
  sb.window = sb; sb.order = order; sb.shown = shown;
  vm.createContext(sb);
  vm.runInContext('let holdRender = false, inGarage = true;\n' + src.slice(a, b) +
    '\n;this.__gf = { gfLive, gfSliceMs, gfRun, gfJoin, gfWait, gfArm, GF_IDS, hold: () => holdRender };', sb);
  for (const id of sb.__gf.GF_IDS) sb.TRIP_BY[id] = { id, label: 'the ' + id, w: 1 };
  sb.tripRun = (s, t) => { t.ran.add(s.id); order.push(s.id); if (over && over.at) over.at(s.id, sb); return new Promise(res => setTimeout(res, 2)); };
  return sb;
}
const until = (f, ms) => new Promise((res, rej) => { const t0 = Date.now(); const k = () => f() ? res() : Date.now() - t0 > ms ? rej(new Error('timeout')) : setTimeout(k, 2); k(); });
(async () => {
  if (!(a > 0 && b > a)) throw new Error('no runner block');
  { // every id the run steps exists in the trips' table; every 'world' step of the table is in the run
    const sb = world(), ids = sb.__gf.GF_IDS, known = new Set(tripIds.map(x => x[0]));
    ok(ids.every(id => known.has(id)), '2b every step of the run is a step of the trips\' table (TRIP_STEPS)', ids.filter(id => !known.has(id)).join(' ') || ids.length + ' steps');
    const worldIds = tripIds.filter(x => x[1] === 'world').map(x => x[0]);
    ok(worldIds.every(id => ids.includes(id)), '2c every world step of the table is in the run (a step added to the world\'s phase must be added here)', worldIds.filter(id => !ids.includes(id)).join(' ') || worldIds.length + ' world steps');
    ok(ids[ids.length - 1] === 'craft' && ids.indexOf('worldCompile') < ids.indexOf('frames'), '2d the boot\'s order: the world compiled before first light, the craft\'s programs last');
    // the slice
    const G = sb.LAB.gfS;
    ok(sb.__gf.gfSliceMs() === 40, '2e no run: the slice is 40 ms');
    G.running = true; ok(sb.__gf.gfSliceMs() === 12, '2f a live run at rest: the garage\'s budget (restMs)');
    G.inputAt = sb.performance.now(); ok(sb.__gf.gfSliceMs() === 3, '2g a live run while the pointer or a key moved: busyMs');
    G.fast = true; ok(sb.__gf.gfSliceMs() === 40 && !sb.__gf.gfLive(), '2h a run Go joined: 40 ms again, and no longer "live"');
  }
  { // a whole run
    let hookSeen = 0, liveSeen = 0;
    const sb = world({ at: (id, s) => { if (s.FLYDIY_WORLD_BUDGET && typeof s.FLYDIY_WORLD_BUDGET.left === 'function') hookSeen++; if (s.__gf.gfLive()) liveSeen++; } });
    const G = sb.LAB.gfS, ids = sb.__gf.GF_IDS;
    sb.__gf.gfRun(); await until(() => G.done, 4000);
    ok(sb.order.join() === ids.join(), '3a a run steps every step once, in order, through tripRun');
    ok(hookSeen === ids.length && liveSeen === ids.length, '3b the budget\'s hook (FLYDIY_WORLD_BUDGET.left) is up and the run "live" at every step', hookSeen + ' / ' + liveSeen);
    ok(!G.running && G.done && !sb.FLYDIY_WORLD_BUDGET && G.log.length === ids.length && !G.err, '3c at its end: not running, done, the hook gone, a row a step, no error');
    sb.__gf.gfRun(); await new Promise(r => setTimeout(r, 10));
    ok(sb.order.length === ids.length, '3d a finished run does not start again');
  }
  { // the run ends in the task of its last step
    const sb = world(), G = sb.LAB.gfS, ids = sb.__gf.GF_IDS, last = ids[ids.length - 1];
    let runningAtLast = null;
    sb.__gf.gfRun();
    sb.__gf.gfWait(last).then(() => { runningAtLast = G.running; });
    await until(() => G.done, 4000); await new Promise(r => setTimeout(r, 5));
    ok(runningAtLast === false, '4a whoever waits on the LAST step finds the run over (a Go joined at that instant cannot find it running with nothing left)');
  }
  { // Go joins a run mid-way
    let cb = 0, runningAtCb = null, joined = false;
    const sb = world({ at: (id, s) => { if (id === 'settle' && !joined) { joined = true; setTimeout(() => s.__gf.gfJoin(() => { cb++; runningAtCb = s.LAB.gfS.running; }), 0); } } });
    const G = sb.LAB.gfS, ids = sb.__gf.GF_IDS;
    sb.__gf.gfRun(); await until(() => G.done && cb > 0, 4000); await new Promise(r => setTimeout(r, 10));
    const left = ids.slice(ids.indexOf('settle'));
    ok(sb.shown.length === 1 && sb.shown[0].set === 'rollout', '5a Go on a live run puts ONE roll-out screen up');
    ok(sb.shown[0] && sb.shown[0].ids.join() === left.join(), '5b it names exactly the steps left, in order', (sb.shown[0] || { ids: [] }).ids.join(' '));
    ok(G.fast && cb === 1 && runningAtCb === false, '5c the run goes fast, and the roll-out goes on once, when the run is over', 'cb ' + cb + ', running at cb ' + runningAtCb);
    ok(sb.order.join() === ids.join(), '5d no step ran twice and none was skipped by the join');
    ok(sb.__gf.hold() === false, '5e the picture\'s hold is released when the join ends');
  }
  console.log('GATE GARAGEFIRST: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('  FAIL the gate threw: ' + (e && e.stack || e)); console.log('GATE GARAGEFIRST: FAIL'); process.exit(1); });
