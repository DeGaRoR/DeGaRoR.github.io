#!/usr/bin/env node
// reveal_probe.js - REVEAL-HITCH (A0 19 Oct, Game-ON polish): WHAT THE FIRST FRAMES AFTER THE ROLL-OUT SCREEN DO. Every leg of
// the strict gate has ONE ~700 ms frame right after the roll-out screen lifts (L19a and L19b alike: half the main thread idle -
// a GPU / compositor wait - the rest updateMatrixWorld / render / applySkinDeform / coverAt), then a 120-230 ms
// worldUpdate -> buildField stretch 0.7 s in. The page in node (tools/_page_node.js, the recording GL): the build loaded,
// `Roll out` pressed, and from the click to REVEAL + N frames, per frame: the JS wall time (node's own clock - the work, not
// the GPU), the GL work handed over (program links, texture and buffer upload bytes, draws by pass, GL calls) and the boot
// state; the heaviest frames named by a V8 CPU profile sliced to each frame (self and inclusive functions).
//   node tools/perf/reveal_probe.js [--build cub|metal] [--after 90] [--top 6] [--json out.json]
'use strict';
const fs = require('fs'), path = require('path'), inspector = require('inspector');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };
const BUILD = opt('build', 'metal'), AFTER = +opt('after', 90), TOP = +opt('top', 6), JSON_OUT = opt('json', null);
const sess = new inspector.Session(); sess.connect();
const post = (m, p) => new Promise((res, rej) => sess.post(m, p || {}, (e, r) => (e ? rej(e) : res(r))));
const nowUs = () => Number(process.hrtime.bigint() / 1000n);
(async () => {
  const { openPage } = require('../_page_node.js');
  const storage = {}; if (BUILDS[BUILD]) storage['flydiy.wip'] = fs.readFileSync(path.join(ROOT, BUILDS[BUILD]), 'utf8');
  const P = await openPage({ quiet: true, storage, query: process.env.PROBE_Q || '' });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  await P.frames(30);
  // PROBE_PLANT=1: the reveal's grass planted ahead, as the browser's boot does after its warm draw (app.js revealPlant - the
  // harness's boot takes the synchronous path, which has no warm draw)
  if (process.env.PROBE_PLANT && W.FLYDIY_REVEAL_PLANT_NOW) { const t = Date.now(); const r = await W.FLYDIY_REVEAL_PLANT_NOW(); console.log('reveal plant ' + JSON.stringify(r) + ' in ' + (Date.now() - t) + ' ms (node)'); }
  // per frame: wall time and the recorder's counters (diffed)
  const snap = () => P.rec.snapshot();
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const rows = []; let s0 = null, t0 = 0, revealAt = null, rec = true;
  P.onFrame((ph, n) => {
    if (!rec) return;
    if (ph === 'start') { s0 = snap(); t0 = nowUs(); return; }
    const s1 = snap(), dt = (nowUs() - t0) / 1000, B = W.BOOT || {};
    const tb = k => (s1.bytes[k] || 0) - (s0.bytes[k] || 0);
    const r = { n, ms: +dt.toFixed(1), t0, t1: nowUs(), state: B.state + (B.set ? ':' + B.set : ''), links: s1.links - s0.links,
      tex: tb('texImage2D') + tb('texSubImage2D') + tb('compressedTexImage2D') + tb('compressedTexSubImage2D') + tb('texImage3D') + tb('texSubImage3D') + tb('compressedTexSubImage3D'),
      buf: tb('bufferData') + tb('bufferSubData'), draws: sum(s1.draws) - sum(s0.draws), calls: sum(s1.calls) - sum(s0.calls) };
    rows.push(r);
    if (revealAt === null && rows.length > 1 && B.state === 'gone' && rows[rows.length - 2].state !== r.state) revealAt = rows.length - 1;
    // PROBE_DUMP=1: the reveal's eye against the stand (for the pre-plant's geometry) - the first frames after the click's trip
    if (process.env.PROBE_DUMP && W.FLIGHT_PROBE && rows.length >= (revealAt === null ? 1e9 : revealAt + 1) && rows.length <= (revealAt === null ? 0 : revealAt + 3)) {
      try { const FP = W.FLIGHT_PROBE, cam = typeof FP.camera === 'function' ? FP.camera() : FP.camera, sm = FP.sim(), cg = sm.cgPos(), xA = sm.axes()[0];
        const st = typeof W.siteOf === 'function' ? W.siteOf('HOME') : null;
        console.log('DUMP frame ' + (rows.length - 1 - revealAt) + ' eye ' + [cam.position.x, cam.position.y, cam.position.z].map(v => v.toFixed(2)) + ' cg ' + cg.map(v => v.toFixed(2)) +
          ' hdgAft ' + Math.atan2(xA[2], xA[0]).toFixed(4) + ' stand ' + JSON.stringify(st && st.stand)); } catch (e) { console.log('DUMP err ' + e.message); } }
  });
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 200 }); await post('Profiler.start');
  const tClick = nowUs();
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
  if (revealAt === null) revealAt = rows.length - 1;
  await P.frames(AFTER);
  rec = false;
  const { profile: pr } = await post('Profiler.stop');
  // the table: the frames from 5 before the reveal to AFTER after, and the heaviest frames named
  const at = revealAt;
  console.log('build ' + BUILD + ': ' + rows.length + ' frames recorded from the click (' + ((rows[0] ? rows[0].t0 - tClick : 0) / 1000).toFixed(0) + ' ms in), the reveal at frame ' + at + ' (' + (rows[at] && rows[at].state) + ')');
  console.log('  i      ms  state            links      tex KB     buf KB  draws  calls');
  for (let i = Math.max(0, at - 5); i < Math.min(rows.length, at + 40); i++) { const r = rows[i];
    console.log('  ' + String(i - at).padStart(3) + ' ' + String(r.ms).padStart(7) + '  ' + String(r.state).padEnd(15) + ' ' + String(r.links).padStart(6) + ' ' + String((r.tex / 1024).toFixed(0)).padStart(10) + ' ' + String((r.buf / 1024).toFixed(0)).padStart(10) + ' ' + String(r.draws).padStart(6) + ' ' + String(r.calls).padStart(6)); }
  const after = rows.slice(at), heavy = after.map((r, i) => [i, r]).sort((a, b) => b[1].ms - a[1].ms).slice(0, 4);
  // slice the profile by frame (profile time = V8's monotonic µs; hrtime is the same clock on this platform - checked below)
  const byId = new Map(pr.nodes.map(x => [x.id, x])), par = new Map(); for (const x of pr.nodes) for (const c of (x.children || [])) par.set(c, x.id);
  let t = pr.startTime; const S = pr.samples.map((id, i) => { t += pr.timeDeltas[i]; return [t, id]; });
  const name = x => { const cf = x.callFrame; return (cf.functionName || '(anon)') + ' ' + ((cf.url || '').split('/').pop().split('?')[0]) + (cf.url ? ':' + (cf.lineNumber + 1) : ''); };
  const inProf = rows.filter(r => r.t0 >= pr.startTime && r.t1 <= pr.endTime).length;
  console.log('\n  (profile ' + ((pr.endTime - pr.startTime) / 1e6).toFixed(1) + ' s, ' + pr.samples.length + ' samples; ' + inProf + ' of ' + rows.length + ' frames inside it)');
  const out = { build: BUILD, revealAt: at, rows: rows.map(r => Object.assign({}, r, { t0: undefined, t1: undefined })), heavy: [] };
  for (const [i, r] of heavy) {
    const self = new Map(), incl = new Map(); let n = 0;
    for (const [ts, id] of S) { if (ts < r.t0 || ts > r.t1) continue; n++; const x = byId.get(id); self.set(name(x), (self.get(name(x)) || 0) + 1);
      const seen = new Set(); for (let y = id; y != null; y = par.get(y)) { const k = name(byId.get(y)); if (seen.has(k) || k.startsWith('(root)')) continue; seen.add(k); incl.set(k, (incl.get(k) || 0) + 1); } }
    const ms = c => (c * (r.ms / Math.max(1, n))).toFixed(1);
    const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([f, c]) => ms(c).padStart(7) + ' ms  ' + f);
    console.log('\n== frame ' + (i >= 0 ? '+' : '') + i + ' after the reveal: ' + r.ms + ' ms JS, links ' + r.links + ', tex ' + (r.tex / 1024).toFixed(0) + ' KB, buf ' + (r.buf / 1024).toFixed(0) + ' KB, draws ' + r.draws + ' (' + n + ' samples)');
    console.log('  self:\n    ' + top(self, TOP).join('\n    '));
    console.log('  inclusive:\n    ' + top(incl, TOP + 8).join('\n    '));
    out.heavy.push({ i, ms: r.ms, self: top(self, TOP), incl: top(incl, TOP + 8) });
  }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
  try { P.close(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('reveal_probe: ' + (e && e.stack || e)); process.exit(1); });
