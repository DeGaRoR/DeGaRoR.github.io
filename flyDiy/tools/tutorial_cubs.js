#!/usr/bin/env node
// tutorial_cubs.js - THE TUTORIAL'S THREE CUBS (TUTORIAL-CUBS, 13 Nov 2026, for the GAME coordinator).
//
// The user (13 Nov): tutorial v2 is FULLY DETERMINISTIC - each tutorial build ends EXACTLY on a reference file, 4-5
// modifications from its start (basic modding: the tutor points at the exact row and value). This file is the recipe
// of the three reference files, the one place their edit lists are written, and their proof:
//
//   1 CLIENT CUB (the start)   builds/cub_2026-09-20.json - the validated J-3 (list:1, builds/cub_2026-09-20_corrected.json)
//                              in the client's own battered white and blue (its paint + finish: AIRCRAFT-LOOKS' livery
//                              format, CLIENT-CUB-LOOK), N1938J. Nothing else of the J-3 moved.
//   2 CLIENT CUB UPGRADED      builds/client_cub_upgraded_2026-11-13.json - file 1 + UPGRADE (5 rows), toward the
//                              Carbon Cub SS (list:47)
//   3 CLIENT CUB ON FLOATS     builds/client_cub_floats_2026-11-13.json - file 2 + FLOATS (4 rows): the Wipline row the
//                              frame's own sizing asks for at this gross, rigged as the PA-18 on floats (list:25), the
//                              seaplane pitch
//
// Every edit is ONE garage row (its data-k) set to ONE value, as the row's own widget writes it (a catalogue row - the
// engine, the float model - is a STARTER: picking it writes its dials once, CAGE_ENG_APPLY_PRESET /
// CAGE_FLOAT_APPLY_PRESET, exactly what the page's PAGE.post does on the row change). Every file is written JOINED
// (tools/_load_build.js: the game's own load door), so it is a fixed point of that door: the game opens it as written.
//
//   node tools/tutorial_cubs.js --build [--only=client,upgraded,floats]   write the files (needs HYDRO-SCALE for floats)
//   node tools/tutorial_cubs.js --check                                    node proof + the plaque, the bench's rows
//   node tools/tutorial_cubs.js --page [--only=upgraded]                   THE PAGE'S PROOF: dev.html headless (Chromium,
//        SwiftShader), the start opened through the load door (GARAGE_SPEC.set), each row moved through its own widget
//        (#p_<k>: the select's change, the checkbox's change, the slider's typed value), the spec settled, compared
//        leaf for leaf with the target file. ~5 min a boot.
//
// THE FLOATS AND HYDRO-SCALE: the float model row writes presetParams' hull. On a tree without claude/ready/hydro-scale
// (USER 13 Nov: "Wipline floats scaled to disp, shape kept") the 1450 row still writes the ~11 % bigger hull, so step 3
// lands on file 3 only once HYDRO-SCALE is in; --check says which tree it runs on.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const ONLY = ((argv.find(a => a.startsWith('--only=')) || '').slice(7) || 'client,upgraded,floats').split(',');

const FILES = {
  validated: 'builds/cub_2026-09-20_corrected.json',
  client: 'builds/cub_2026-09-20.json',
  upgraded: 'builds/client_cub_upgraded_2026-11-13.json',
  floats: 'builds/client_cub_floats_2026-11-13.json',
};
// THE EDITS, in the order the tutor asks for them: [part (the editor's part tree), data-k, value, what the row says,
// why]. A catalogue row's value is its index in the row's list; `name` is the entry the player picks.
const UPGRADE = [
  { part: 'engine', k: 'engPreset', v: 21, name: 'rotax 915 iS', row: 'engine',
    why: 'power: 65 -> 141 hp for 9 kg more (the A-65 out); the Carbon Cub flies 180 hp' },
  { part: 'main wheels > size', k: 's1R', v: 0.37, row: 'main wheel radius',
    why: 'bush tyres: 0.22 -> 0.37 m, a 29 in tundra (the Carbon Cub\'s 29 in Airstreak is 0.368, typed; 0.37 is on the slider\'s 0.005 grid)' },
  { part: 'wing > devices', k: 'wgVG', v: 1, row: 'vortex generators',
    why: 'the stall: Vs 15.97 -> 15.14 m/s, the take-off run 153 -> 135 m, on the J-3 alone (the Carbon Cub carries them)' },
  { part: 'wing > structure', k: 'wgCons', v: 7, name: 'fabric on aluminium spar', row: 'construction',
    why: 'a lighter fit: the wing 22 kg lighter (the Carbon Cub\'s wing row)' },
  { part: 'stabiliser > size', k: 'stSpan', v: 1.59, row: 'span (x the drawn)',
    why: 'a Super Cub-sized tail (the Carbon Cub\'s 1.589, on the 0.01 grid): the flare check passes with the new engine' },
];
const FLOATS = [
  { part: 'floats > catalogue', k: 'gearFloats', v: 1, row: 'floats (instead of wheels)',
    why: 'the wheels off, the floats on (the 1450 brings no seaplane propeller: the float kit leaves the prop alone)' },
  { part: 'floats > catalogue', k: 'fltPreset', v: 0, name: 'Wipline 1450', row: 'float model (applies once)',
    why: 'the frame\'s sizing (32_hydro floatParamsFor: a pair displaces 1.8 x the gross) at this Cub\'s gross asks for ' +
         'the smallest row; the catalogue sells it for the Carbon Cub SS' },
  { part: 'floats > placement', k: 'fltDrop', v: 1, row: 'keel below the belly',
    why: 'rigged as the PA-18 on floats (list:25: keel 1.00 m below the belly, track 0.80, struts 55 deg, both spreaders, cross wires)' },
  { part: 'propeller', k: 'propPitch', v: 4, name: 'seaplane', row: 'pitch',
    why: 'the float prop (what the float kit fits with the 2350): the run off the water 80 -> 57 m, the climb 5.7 -> 7.9 m/s' },
];

// ---- node: an edit set applied to a spec as the rows write it ----------------------------------------------------
let PANEL = null;
const panel = () => PANEL || (PANEL = require(path.join(T, '_bake_joined.js')).loadPanel().W);
function applyEdits(spec, edits) {
  const s = JSON.parse(JSON.stringify(spec));
  for (const e of edits) {
    if (e.k === 'engPreset' || e.k === 'fltPreset') {
      const W = panel(), full = Object.assign(W.CAGE2.cageDefaults(), s.cage);
      const before = JSON.parse(JSON.stringify(full));
      if (e.k === 'engPreset') {
        const name = W.CAGE_ENG_PRESET_LABELS()[e.v].split(' · ')[0];
        if (name !== e.name) throw new Error('engine row ' + e.v + ' is ' + name + ', not ' + e.name);
        W.CAGE_ENG_APPLY_PRESET(full, name);
      } else {
        const name = W.CAGE_FLOAT_PRESETS[e.v];
        if (name !== e.name) throw new Error('float row ' + e.v + ' is ' + name + ', not ' + e.name);
        if (!W.CAGE_FLOAT_APPLY_PRESET(full, name)) throw new Error('no float preset ' + name);
      }
      for (const q of Object.keys(full)) if (JSON.stringify(full[q]) !== JSON.stringify(before[q])) s.cage[q] = full[q];
    }
    // the pitch row is a VIEW of spec.prop.pitch, never a cage key (_cage_eng.js ENGINE-DIALS B: CAGE_PROP_PITCH.set
    // writes the spec through GARAGE_SPEC.update)
    if (e.k === 'propPitch') {
      const K = panel().CAGE_PROP_PITCH.KEYS;
      if (K[e.v] !== e.name) throw new Error('pitch row ' + e.v + ' is ' + K[e.v] + ', not ' + e.name);
      s.prop = Object.assign({}, s.prop, { pitch: K[e.v] }); continue;
    }
    s.cage[e.k] = e.v;
  }
  return s;
}
const LB = () => require(path.join(T, '_load_build.js'));
const readJ = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
function leaves(o, p, out) { for (const k in o) { const v = o[k], q = p ? p + '.' + k : k;
  if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, q, out); else out[q] = JSON.stringify(v); } return out; }
function diffKeys(A, B) { const a = leaves(A, '', {}), b = leaves(B, '', {}); const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) out.push([k, a[k], b[k]]); return out; }
const hydroScaled = () => { try { const C = require(path.join(T, 'flight_core.js')); const H = C.HYDRO || global.HYDRO;
  const Q = H.presetParams('Wipline 1450'), v = H.makeFloat(Q).volDeck * (Q.rho || H.DEF.rho);
  return Math.abs(v - H.FLOAT_PRESETS['Wipline 1450'].disp) < 5; } catch (e) { return null; } };

const META = { name: 'Client Cub', reg: 'N1938J' };
function compose(key) {
  if (key === 'client') {
    const V = readJ(FILES.validated), cur = readJ(FILES.client);
    const s = JSON.parse(JSON.stringify(V.spec));
    s.paint = cur.spec.paint; s.finish = JSON.parse(JSON.stringify(cur.spec.finish));   // the client's livery (AIRCRAFT-LOOKS' format)
    // ...but its struts in their own paint: the September file pinned them `castAlu` under their own tint, a bare finish
    // on a painted pin that GATE LIVERY holds red (master's standing 2 of 328, HANDOVER L32b); the tint #dcd8cc kept,
    // the struts now painted like the gear legs beside them (the one look change: AIRCRAFT-LOOKS to confirm)
    const st = s.finish.sections && s.finish.sections.strut;
    if (st && st.fin === 'castAlu' && st.tint != null && st.tint !== 0xffffff) s.finish.sections.strut = { tint: st.tint };
    s.meta = Object.assign({}, s.meta, META);
    return s;
  }
  if (key === 'upgraded') return applyEdits(readJ(FILES.client).spec, UPGRADE);
  if (key === 'floats') return applyEdits(readJ(FILES.upgraded).spec, FLOATS);
}
const ENVELOPE = {
  client: { name: 'Client Cub', note: 'TUTORIAL-CUBS (13 Nov 2026): the Client Cub as the story hands it over - the validated J-3 ' +
    '(list:1, builds/cub_2026-09-20_corrected.json) in the client\'s own battered white and blue (CLIENT-CUB-LOOK: paint + ' +
    'finish whole, wear 0.8), N1938J; nothing else of the J-3 moved. The tutorial\'s start. Recipe: tools/tutorial_cubs.js.' },
  upgraded: { name: 'Client Cub upgraded', from: FILES.client, edits: UPGRADE,
    note: 'TUTORIAL-CUBS (13 Nov 2026): the tutorial\'s first target - the Client Cub moved toward the Carbon Cub SS (list:47) ' +
    'in five garage rows (edits). Recipe and proof: tools/tutorial_cubs.js.' },
  floats: { name: 'Client Cub on floats', from: FILES.upgraded, edits: FLOATS,
    note: 'TUTORIAL-CUBS (13 Nov 2026): the water step\'s target - the upgraded Client Cub on floats in four garage rows ' +
    '(edits): the Wipline row the frame\'s sizing asks for at this gross, rigged as the PA-18 on floats (list:25), the ' +
    'seaplane pitch. The float ' +
    'model row lands here on a tree with HYDRO-SCALE. Recipe and proof: tools/tutorial_cubs.js.' },
};
function envelope(key, spec) {
  const E = ENVELOPE[key], tut = E.edits ? { from: E.from, edits: E.edits.map(e => Object.assign({ part: e.part, k: e.k, value: e.v },
    e.name ? { pick: e.name } : null, { row: e.row, why: e.why })) } : null;
  return Object.assign({ what: 'flydiy-build', v: spec.v || 10, name: E.name }, { note: E.note }, tut ? { tutorial: tut } : null,
    { spec, plaque: null, log: { built: '2026-11-13', tests: [], flights: [] } });
}

if (argv.includes('--build')) {
  for (const key of ['client', 'upgraded', 'floats']) {
    if (!ONLY.includes(key)) continue;
    if (key === 'floats' && hydroScaled() === false) { console.log('floats: this tree has no HYDRO-SCALE (the 1450 row writes the old hull) - not written'); continue; }
    // the start is written AS THE VALIDATED J-3 IS SAVED (raw: the game joins it on open, as it joins list:1) - and so
    // the plane list's row 26 stays storyClientSpec of it (GATE PLANELISTS: its `over` lays `systems` over the file's,
    // storyClientSpec replaces it; equal while the file's systems is the J-3's own { fit }). The targets are written
    // JOINED: fixed points of the load door.
    const raw = compose(key), r = LB().gameSpecFull({ spec: raw });
    if (r.errors && r.errors.length) console.log(key + ': the join says', JSON.stringify(r.errors));
    fs.writeFileSync(path.join(ROOT, FILES[key]), JSON.stringify(envelope(key, key === 'client' ? raw : r.spec), null, 1) + '\n');
    console.log('wrote ' + FILES[key]);
  }
}

if (argv.includes('--check')) {
  const C = require(path.join(T, 'flight_core.js'));
  let bad = 0;
  const say = (ok, line) => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + line); };
  console.log('tree: HYDRO-SCALE ' + (hydroScaled() ? 'in' : 'NOT in (step 3 cannot land on file 3 here)'));
  const plaque = s => { const sh = C.genShakedown(C.buildGen(s)), r = x => +(+x).toFixed(2);
    return { sh, line: 'mass ' + r(sh.mass) + ' kg, empty ' + r(sh.empty) + ', ' + sh.engineName + ' ' + r(sh.hp) + ' hp, Vs ' + r(sh.Vs) +
      ' m/s, Vs flap ' + r(sh.VsFlap) + ', TO run ' + sh.TORun + ' m, climb ' + r(sh.climbRate) + ' m/s, cruise ' + r(sh.VCruise) +
      ' m/s, SM ' + r(sh.staticMargin) + ', cost ' + Math.round(sh.cost),
      rows: (sh.design.rows || []).filter(x => x.level !== 'pass').map(x => x.level + ' ' + x.id + ' ' + x.value).join('; ') || 'all pass',
      verdict: sh.design.verdict, cert: C.genCertTiers(sh.design.rows) }; };
  for (const key of ['client', 'upgraded', 'floats']) {
    if (!ONLY.includes(key)) continue;
    const J = readJ(FILES[key]), s = J.spec;
    const again = LB().gameSpec({ spec: s });
    if (key !== 'client') {
      const fp = diffKeys(s, again);
      say(fp.length === 0, key + ': a fixed point of the load door (opened, it is the file)' + (fp.length ? ' - ' + fp.length + ' leaves move: ' + fp.slice(0, 4).map(d => d[0]).join(', ') : ''));
    }
    if (key === 'client') {
      const Vr = readJ(FILES.validated).spec, dr = diffKeys(Vr, s).map(x => x[0]);
      say(dr.every(k => /^(paint|finish|meta)\./.test(k)), 'client: the validated J-3 file to the leaf but paint / finish / meta (' + dr.length + ' leaves)');
      const V = LB().gameSpec(readJ(FILES.validated)), d = diffKeys(V, again).map(x => x[0]);
      say(d.every(k => /^(paint|finish|meta)\./.test(k)), 'client: opened, the validated J-3 as the game opens it, to the leaf but paint / finish / meta (' + d.length + ' leaves, ' +
        d.filter(k => !/^(paint|finish|meta)\./.test(k)).slice(0, 4).join(', ') + ')');
      say(s.meta.reg === 'N1938J' && s.finish.wear === 0.8, 'client: N1938J, the battered finish (wear 0.8)');
    } else {
      const E = ENVELOPE[key], start = readJ(E.from).spec;
      if (key === 'floats' && !hydroScaled()) { console.log('skip floats: start + edits needs HYDRO-SCALE'); }
      else {
        const land = LB().gameSpec({ spec: applyEdits(start, E.edits) }), d = diffKeys(land, s);
        say(d.length === 0, key + ': ' + E.from + ' + ' + E.edits.length + ' rows lands on the file to the leaf' + (d.length ? ' - ' + d.slice(0, 4).map(x => x[0]).join(', ') : ''));
      }
      say(E.edits.length >= 4 && E.edits.length <= 5, key + ': ' + E.edits.length + ' rows (' + E.edits.map(e => e.k + '=' + e.v).join(', ') + ')');
    }
    const P = plaque(again);
    console.log('     ' + P.line); console.log('     the bench\'s design check: ' + P.verdict + ' (' + P.rows + ')');
    console.log('     the certificates (genCertTiers): airworthiness ' + P.cert.safe + ', commercial ' + P.cert.comm + ' (a warn is a certificate: CERTGATES)');
    say(P.verdict !== 'fail' && P.cert.safe !== 'fail' && P.cert.comm !== 'fail', key + ': no FAIL on the design check, both certificates held');
  }
  console.log('tutorial_cubs --check: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  process.exitCode = bad ? 1 : 0;
}

// ---- THE PAGE'S PROOF ---------------------------------------------------------------------------------------------
if (argv.includes('--page')) (async () => {
  const { chromium } = require('playwright');
  const { spawn } = require('child_process');
  const PORT = 8800 + (process.pid % 90);
  const srv = spawn(process.execPath, [path.join(T, '_serve.js'), String(PORT), path.join(ROOT, '..')], { stdio: 'ignore' });
  let bad = 0;
  try {
    for (const key of ['upgraded', 'floats']) {
      if (!ONLY.includes(key)) continue;
      const E = ENVELOPE[key], start = readJ(E.from).spec, want = readJ(FILES[key]).spec;
      const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
      const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
      p.on('pageerror', e => console.log('  page error: ' + String(e).slice(0, 200)));
      await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      const t0 = Date.now();
      await p.goto('http://localhost:' + PORT + '/flyDiy/dev.html');
      const READY = () => window.BOOT && BOOT.state === 'gone' && window.GARAGE_SPEC && !(window.CAGE_CREW_PENDING && CAGE_CREW_PENDING()) &&
        !(window.TANK_NOSE_PENDING && TANK_NOSE_PENDING());
      await p.waitForFunction(READY, null, { timeout: 3600000, polling: 2000 });
      const settle = async () => { let last = null, same = 0;
        for (let i = 0; i < 600; i++) { await p.waitForTimeout(2000);
          const s = await p.evaluate(() => (window.BOOT && BOOT.state === 'gone' && !(window.CAGE_CREW_PENDING && CAGE_CREW_PENDING()) &&
            !(window.TANK_NOSE_PENDING && TANK_NOSE_PENDING())) ? JSON.stringify(GARAGE_SPEC.get()) : null).catch(() => null);
          if (!s) continue; if (s === last) { if (++same >= 2) return JSON.parse(s); } else { last = s; same = 0; } }
        throw new Error('the page never settled'); };
      await p.waitForTimeout(3000);
      await p.evaluate(s => { GARAGE_SPEC.set(s); }, start);
      const opened = await settle();
            // (the start as node's load door opens it: the raw start file is joined on open, by the page as by node)
      const nodeOpen = LB().gameSpec({ spec: start }), d0 = diffKeys(nodeOpen, opened);
      console.log(key + ': booted + opened ' + E.from + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s; the page opened it ' + (d0.length ? 'with ' + d0.length + ' leaves off node\'s load door:' : 'as node\'s load door does'));
      for (const x of d0.slice(0, 30)) console.log('     ' + x[0] + ' ' + String(x[1]).slice(0, 60) + ' (node) / ' + String(x[2]).slice(0, 60) + ' (page)');
      if (d0.length) bad++;
      if (argv.includes('--open-only')) { fs.writeFileSync(path.join(require('os').tmpdir(), 'tutorial_cubs_open_' + key + '.json'), JSON.stringify(opened)); await b.close(); continue; }
      for (const e of E.edits) {
        const how = await p.evaluate(e => {
          const el = document.getElementById('p_' + e.k);
          if (!el) return 'no #p_' + e.k;
          if (el.tagName === 'SELECT') { el.value = String(e.v); el.dispatchEvent(new Event('change', { bubbles: true })); return 'select ' + el.options[el.selectedIndex].textContent; }
          if (el.type === 'checkbox') { el.checked = !!e.v; el.dispatchEvent(new Event('change', { bubbles: true })); return 'checkbox ' + el.checked; }
          if (el.type === 'range') { const vf = document.getElementById('v_' + e.k); vf.value = String(e.v); vf.dispatchEvent(new Event('change', { bubbles: true })); return 'typed ' + vf.value; }
          if (el.type === 'text') { el.value = String(e.v); el.dispatchEvent(new Event('change', { bubbles: true })); return 'stepper ' + el.value; }
          return 'unknown widget ' + el.tagName + ' ' + el.type;
        }, e);
        console.log('  row ' + e.k + ' -> ' + e.v + ': ' + how);
        if (/^no |unknown/.test(how)) bad++;
        await settle();
      }
      const got = await settle();
      const d = diffKeys(got, want);
      console.log('  ' + (d.length ? 'FAIL' : 'ok  ') + ' the page after ' + E.edits.length + ' rows = ' + FILES[key] + (d.length ? ': ' + d.length + ' leaves differ' : ' to the leaf'));
      for (const x of d.slice(0, 30)) console.log('     ' + x[0] + ' ' + String(x[2]).slice(0, 70) + ' (file) / ' + String(x[1]).slice(0, 70) + ' (page)');
      if (d.length) { bad++; fs.writeFileSync(path.join(require('os').tmpdir(), 'tutorial_cubs_page_' + key + '.json'), JSON.stringify(got)); }
      await b.close();
    }
  } finally { srv.kill(); }
  console.log('tutorial_cubs --page: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('tutorial_cubs --page: ERROR ' + e.message); process.exit(2); });

// ---- THE FLIGHTS: the game's pilot (43_pilot makePilot, Expert, calm, the validated world) on each file --------------
// Wheels: a full circuit off HOME to a stop. Floats: the same off the SEA lane, the HUMP read off the floats' own
// forces as GATE FLOATS reads it (R/W: the water's drag over the weight, its peak while wet under 14 m/s), the
// lift-off, the circuit, the touch on the water and the run to a stop.
if (argv.includes('--fly')) {
  const C = require(path.join(T, 'flight_core.js'));
  const f = (v, n = 1) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);
  let bad = 0;
  for (const key of ['client', 'upgraded', 'floats']) {
    if (!ONLY.includes(key)) continue;
    const spec = LB().gameSpec(readJ(FILES[key])), def = C.buildGen(spec), world = C.makeWorld();   // what the game flies
    const sea = def.parts && def.parts.floats && def.parts.floats.length;
    const ad = world.aerodromes.find(a => a.id === (sea ? 'SEA' : 'HOME'));
    const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, ad);
    const ap = C.makePilot(sim, def, world); ap.setRoute(ad, ad);
    let M = 0; for (const n of def.nodes) M += n.m; const W = M * 9.81;
    const R = { phases: [], lift: null, liftV: null, liftRun: null, touch: null, touchV: null, stopped: null, hump: { R: 0, V: 0 }, finite: true, maxRoll: 0, wetTouch: null };
    let T = 0, last = '', p0 = null, airborne = false;
    for (let s = 0; s < 700 * 60; s++) {
      ap.update(1 / 60); sim.step(1 / 60); T += 1 / 60;
      const cg = sim.cgPos(), v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
      if (!Number.isFinite(cg[0]) || !Number.isFinite(V)) { R.finite = false; break; }
      if (!p0 && ap.phase !== 'TAXI' && /ROLL|TAKEOFF|DEPART/.test(ap.phase)) p0 = [cg[0], cg[2]];
      if (ap.phase !== last) { R.phases.push(ap.phase + '@' + f(T)); last = ap.phase; }
      const [, yU] = sim.axes(); R.maxRoll = Math.max(R.maxRoll, Math.abs(Math.asin(Math.max(-1, Math.min(1, yU[2])))) * 57.2958);
      if (sea) {
        const fl = sim.hydro.floats, wet = fl.reduce((a, x) => a + x.wet, 0);
        // the water's drag: its force against the horizontal velocity (the lane's heading is not GATE FLOATS' -x)
        const Fx = fl.reduce((a, x) => a + x.out.F[0], 0), Fz = fl.reduce((a, x) => a + x.out.F[2], 0);
        const Rw = V > 0.5 ? -(Fx * v[0] + Fz * v[2]) / V / W : 0;
        if (!R.lift && wet > 0 && V < 14 && Rw > R.hump.R) R.hump = { R: Rw, V, t: T };
        if (!R.lift && p0 && wet === 0 && V > 10) { R.lift = T; R.liftV = V; R.liftRun = Math.hypot(cg[0] - p0[0], cg[2] - p0[1]); airborne = true; }
        if (airborne && R.lift && T > R.lift + 20 && wet > 0 && !R.touch) { R.touch = T; R.touchV = V; R.wetTouch = cg; }
      } else {
        const onG = sim.onGround ? sim.onGround() : null;
        if (!R.lift && /CLIMB|LIFTOFF/.test(ap.phase)) { R.lift = T; R.liftV = V; R.liftRun = p0 ? Math.hypot(cg[0] - p0[0], cg[2] - p0[1]) : null; airborne = true; }
        if (airborne && !R.touch && /ROLLOUT/.test(ap.phase)) { R.touch = T; R.touchV = V; }
      }
      if (ap.phase === 'STOPPED') { R.stopped = T; break; }
    }
    const ok = R.finite && R.lift != null && R.touch != null && R.stopped != null && R.maxRoll < 60;
    if (!ok) bad++;
    console.log((ok ? 'ok   ' : 'FAIL ') + key + ' (' + (sea ? 'SEA lane, floats' : 'HOME, wheels') + ', ' + f(M, 0) + ' kg as flown): ' +
      (sea ? 'hump R/W ' + f(R.hump.R, 2) + ' at ' + f(R.hump.V) + ' m/s (t ' + f(R.hump.t) + ' s); ' : '') +
      'lift-off ' + f(R.lift) + ' s at ' + f(R.liftV) + ' m/s after ' + f(R.liftRun, 0) + ' m; ' +
      'touch ' + (sea ? 'on the water ' : '') + f(R.touch) + ' s at ' + f(R.touchV) + ' m/s; stopped ' + f(R.stopped) + ' s; max roll ' + f(R.maxRoll) + ' deg');
    console.log('     ' + R.phases.join(' '));
  }
  console.log('tutorial_cubs --fly: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  process.exitCode = bad ? 1 : 0;
}

module.exports = { FILES, UPGRADE, FLOATS, applyEdits };
