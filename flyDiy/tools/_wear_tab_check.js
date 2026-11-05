#!/usr/bin/env node
// ============================================================================
// GATE WEARTAB - THE GARAGE'S THIRD VIEW (WEAR-TAB, 2026-11-05; futureDesigns/WEAR-SYSTEM-2026-11.md)
// ============================================================================
// The user: "a third tab in the slider menu. On top of structure and finish, we'll have wear. Let's move the visual
// wear over there for now, and the physical wear, as simple sliders ... keep them under expert row for now".
//   THREE VIEWS     body.html carries structure / finish / wear in #edViewTabs; editor.js's setView takes 'wear', a
//                   boot restores it, the story's lock shuts it (lockSync's list, the tutor's T0 deny).
//   MOVED, SAME KEYS the four weathering macros (data-weather) and every section's wear rate (data-wear) are skipped by
//                   renderFinish and taken by renderWear; the prefs and the spec are written as before (aeroSavePrefs
//                   j.wear / j.wearM, finishToSpec out.weather) - the saved format did not move.
//   THE PHYSICS     spec.aging written only through GARAGE_SPEC.update and taken off through GARAGE_SPEC.remove at
//                   0 / 0; read-only in a career; expert rows.
//   AN OLD BUILD    every saved build's def is the same bits with aging at 0 / 0 (GEN_AGING's x1 paths), and the
//                   write-then-clear round trip through the garage's merge gives the spec back byte for byte (its
//                   certificate the same); a real age DOES move the certificate (the structure group) - named.
//
//   node tools/_wear_tab_check.js            -> "GATE WEARTAB: PASS|FAIL"
//   node tools/_wear_tab_check.js --selftest -> each row doctored once must go red
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SELF = process.argv.includes('--selftest');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function run(src) {
  const fails = [], ok = (c, what) => { if (!c) fails.push(what); return !!c; };
  const { BODY, ED, UI, APP, CSS } = src;
  // ---- THREE VIEWS
  const tabs = (BODY.match(/<nav id="edViewTabs">([\s\S]*?)<\/nav>/) || [])[1] || '';
  const ids = (tabs.match(/<button id="(edTab\w+)"/g) || []).map(s => s.slice(12, -1)).filter(id => !/hidden/.test(tabs.split('id="' + id + '"')[1].split('>')[0]));
  ok(ids.join() === 'edTabShape,edTabFinish,edTabWear', 'three views shown: structure, finish, wear (' + ids.join() + ')');
  ok(/view = \['finish', 'design', 'wear'\]\.includes\(v\) \? v : 'shape';/.test(ED), 'setView takes wear');
  ok(/let view = \['finish', 'wear'\]\.includes\(pref\(LS_VIEW\)\) \? pref\(LS_VIEW\) : 'shape';/.test(ED), 'a boot restores wear');
  ok(/if \(view === 'wear'\) \{ renderWear\(\); applyVis\(\); reopenFly\(\); return; \}/.test(ED), 'render dispatches the wear view');
  ok(/const t4 = \$\('edTabWear'\); if \(t4\) t4\.onclick = \(\) => setView\('wear'\);/.test(ED), 'the wear tab is wired');
  ok(/for \(const id of \['edTabShape', 'edTabDesign', 'edTabWear'\]\)/.test(ED), 'the story\'s lock shuts the wear tab');
  ok(/if \(lockWhy && v !== 'finish'\) \{ lockSync\(\); return; \}/.test(ED), 'the lock still holds the finish view');
  ok(/finish: \(\) => \(\{ allow: '#edWrap', deny: '#edTabShape, #edTabDesign, #edTabWear' \}\)/.test(APP), 'the tutor\'s T0 denies the wear tab');
  // ---- MOVED, SAME KEYS
  ok(/if \(el\.dataset && \(el\.dataset\.weather \|\| el\.dataset\.wear\)\) continue;/.test(ED), 'renderFinish leaves the wear rows');
  ok(/if \(d\.weather\) look\.push\(el\);\s*else if \(d\.wear && d\.sec\)/.test(ED), 'renderWear takes the macros and the wear rates');
  ok(/d\.dataset\.matHead = '1';\s*d\.dataset\.weather = k;/.test(UI), 'the macro rows carry data-weather');
  ok(/if \(store === secWear\) \{ d\.dataset\.wear = '1';/.test(UI), 'the wear-rate rows carry data-wear');
  ok(/j\.tint = secTint; j\.finish = secFin; j\.wear = WEAR;/.test(UI) && /j\.wearM = secWear;/.test(UI) && /Object\.assign\(secWear, j\.wearM \|\| \{\}\);/.test(UI), 'the prefs keep wear / wearM');
  ok(/out\.weather = wx;/.test(UI) && /if \(secWear\[nm\] != null\) o\.wearM = secWear\[nm\];/.test(UI), 'the spec keeps finish.weather / wearM');
  ok(/secG: 'wear:looks', expert: true/.test(ED) && /secG: 'wear:part', expert: true/.test(ED) && /secG: 'wear:aging', expert: true/.test(ED), 'the wear rows are expert rows');
  ok(/const exOff = g\.expert && !ex;/.test(ED), 'applyVis hides an expert block with expert off');
  // ---- THE PHYSICS
  ok(/if \(y <= 0 && h <= 0\) \{ if \(agingOfSpec\(\)\) G\.remove\('aging'\); \}\s*else G\.update\(\{ aging: \{ years: y, engineHours: h \} \}\);/.test(ED), 'aging written by update, cleared by remove at 0 / 0');
  ok(/if \(!G \|\| wearCareer\(\)\) \{ sync\(\); return; \}/.test(ED) && /yr\.i\.disabled = hr\.i\.disabled = held;/.test(ED), 'read-only in a career');
  ok(/r\.i\.oninput = show; r\.i\.onchange = write;/.test(ED), 'a build per change, not per pixel');
  ok(/#edWrap\.wea #edResetPart/.test(CSS), 'no per-part reset in the wear view');
  return fails;
}

function physics() {
  const C = require('./flight_core.js');
  const fails = [], ok = (c, what) => { if (!c) fails.push(what); return !!c; };
  // every leaf of two defs, compared bit for bit (Object.is: -0 and NaN count); cycles walked once. The one path allowed
  // to differ is the spec's own copy of the key (def.spec.aging) - the physics must not see it
  const diff = (A, B) => {
    const out = [], seen = new Set();
    const walk = (a, b, p) => {
      if (out.length > 4 || a === b) return;
      if (p === '.spec.aging') return;
      if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
        if (typeof a === 'function' && typeof b === 'function') return;
        if (!Object.is(a, b)) out.push(p);
        return;
      }
      if (seen.has(a)) return; seen.add(a);
      for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) walk(a[k], b[k], p + '.' + k);
    };
    walk(A, B, ''); return out;
  };
  const files = fs.readdirSync(path.join(ROOT, 'builds')).filter(f => /\.json$/.test(f) && !/\.edits\.json$/.test(f));
  let n = 0;
  for (const f of files) {
    let sp; try { const j = JSON.parse(rd('builds/' + f)); sp = C.genMigrateSpec(j.spec || j); } catch (e) { continue; }
    if (!sp || sp.aging) continue;
    const z = JSON.parse(JSON.stringify(sp)); z.aging = { years: 0, engineHours: 0 };
    let d; try { d = diff(C.buildGen(sp), C.buildGen(z)); } catch (e) { ok(false, f + ': builds (' + e.message + ')'); continue; }
    ok(!d.length, f + ': its def at aging 0 / 0 is the same bits (' + d.join(', ') + ')');
    if (!n) { const y = JSON.parse(JSON.stringify(sp)); y.aging = { years: 10, engineHours: 400 };
              ok(diff(C.buildGen(sp), C.buildGen(y)).length > 0, f + ': the comparison sees a real age (10 y, 400 h)'); }
    // the editor's write-then-clear, through the garage's merge door (garage.js merge = genSpecMerge; remove deletes the key)
    const w = C.genSpecMerge(JSON.parse(JSON.stringify(sp)), { aging: { years: 12, engineHours: 800 } });
    const back = Object.assign({}, w); delete back.aging;
    ok(JSON.stringify(back) === JSON.stringify(C.genSpecMerge(JSON.parse(JSON.stringify(sp)), {})), f + ': write then clear gives the spec back');
    const m0 = C.certMajor(sp), m1 = C.certMajor(w);
    ok(m0.fp === C.certMajor(back).fp, f + ': write then clear keeps the certificate');
    ok(m0.fp !== m1.fp && C.certGroupsChanged(m0.groups, m1.groups).join() === 'structure', f + ': an age moves the structure group (the withdrawal, named)');
    n++;
  }
  ok(n >= 8, 'enough saved builds (' + n + ')');
  console.log('  physics: ' + n + ' saved builds - def x1 at 0 / 0, write-then-clear byte for byte, an age withdraws (structure)');
  return fails;
}

const SRC = { BODY: rd('src/viewer/body.html'), ED: rd('src/viewer/editor.js'), UI: rd('tools/_cage_ui.js'),
              APP: rd('src/viewer/app.js'), CSS: rd('src/viewer/editor.css') };
if (SELF) {
  const sub = (f, a, b) => Object.assign({}, SRC, { [f]: SRC[f].replace(a, b) });
  const D = [
    ['no wear tab', sub('BODY', 'id="edTabWear" class="edTab"', 'id="edTabWear" class="edTab" hidden')],
    ['setView drops wear', sub('ED', "['finish', 'design', 'wear'].includes(v)", "['finish', 'design'].includes(v)")],
    ['the lock leaves wear open', sub('ED', "['edTabShape', 'edTabDesign', 'edTabWear']", "['edTabShape', 'edTabDesign']")],
    ['finish keeps the wear rows', sub('ED', 'if (el.dataset && (el.dataset.weather || el.dataset.wear)) continue;', '')],
    ['the prefs lose wearM', sub('UI', 'j.wearM = secWear;', '')],
    ['aging written at zero', sub('ED', "if (y <= 0 && h <= 0) { if (agingOfSpec()) G.remove('aging'); }", 'if (false) {}')],
    ['free in a career', sub('ED', 'if (!G || wearCareer()) { sync(); return; }', 'if (!G) { sync(); return; }')],
    ['the tutor opens wear', sub('APP', ", #edTabWear' })", "' })")],
  ];
  let bad = 0;
  for (const [what, s] of D) { const r = run(s); console.log((r.length ? '  caught  ' : '  MISSED  ') + what); if (!r.length) bad++; }
  console.log('GATE WEARTAB selftest: ' + (bad ? 'FAIL (' + bad + ' missed)' : 'PASS (' + D.length + ' of ' + D.length + ')'));
  process.exit(bad ? 1 : 0);
}
const fails = run(SRC).concat(physics());
for (const f of fails) console.log('  FAIL ' + f);
console.log('GATE WEARTAB: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
process.exit(fails.length ? 1 : 0);
