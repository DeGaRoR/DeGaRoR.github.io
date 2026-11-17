#!/usr/bin/env node
// GATE LIVERYSET (LIVERY-MANAGER, the user 13 Nov: several saved liveries a plane, swapped in the garage's Finish tab;
// the design page ULksoJtJ796Ge9bfFKigHP, approved with its defaults). Node only, ~2 s. (GATE LIVERY, _livery_check.js,
// is G775's: one aeroplane's finish never reaching the next.) On the user's validated builds (the Cub, the Jodel, the
// metal Cessna, the Cessna floats, the twin floatplane, Rufus) and the Carbon Cub SS (a rich livery: three kit layers,
// section tints, glass):
//   KEY    genCertKey (the structural certificate's store key) is BLIND to a livery - colours, finish, decals, glass,
//          the registration and the name changed: the same key - and SEES the paint job (it weighs): a new key
//   FLY    wearing another plane's livery changes nothing the aeroplane is: every node's place and mass, every member,
//          the empty mass (the paint job kept: Rufus is bare, the Carbon Cub full), and every spec key but paint / finish
//          byte-identical; the plane's job, wear and weather kept
//   OPS    the library: an old save opens as one "Livery 1" and writes NOTHING (latent - today's bytes); save-as, wear,
//          rename, remove (never the last, never the worn); the round trip through the envelope exact; a hand-edited list
//          cleaned, never a throw
//   DOOR   garage.js writes `liveries` / `livery` beside the spec only when there are some (the envelope's own rows), and
//          its unwrap hands them back
//   node tools/_liveryset_check.js [--selftest]  -> "GATE LIVERYSET: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const T = __dirname, ROOT = path.join(T, '..');
const SELF = process.argv.includes('--selftest');
const CORE_SRC = fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8');
const GARAGE_SRC = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'garage.js'), 'utf8');
const load = src => { const m = new Module(path.join(T, 'flight_core.js'), null); m.filename = path.join(T, 'flight_core.js'); m.paths = Module._nodeModulePaths(T); m._compile(src, m.filename); return m.exports; };
const BUILDS = {
  cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  metal: 'bugReports/cessnaMetal (1).json', floats: 'bugReports/cessnaFloatsWOrks.json',
  twin: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', rufus: 'builds/rufus_2026-10-18_certified.json',
};
const DONOR = 'builds/candidates/carbon_cub_ss.json';
// the validated builds through the game's load door (tools/_load_build.js, GATE JOINPARITY); the donor is a candidate card
const LB = require('./_load_build.js');
const rawSpec = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return j.spec || j; };
const specOf = f => f === DONOR ? rawSpec(f) : LB.loadBuild(f).spec;
const clone = o => JSON.parse(JSON.stringify(o));
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16); };
// the aeroplane, without its look: every node's place and mass, every member, the empty mass
const airframe = (C, spec) => {
  const d = C.buildGen(clone(spec));
  return fnv(JSON.stringify([d.nodes.map(n => [n.p, n.m]), d.beams.map(b => [b.a, b.b, b.k, b.kTrue || 0, b.cls || '']),
    d.parts && d.parts.ledger ? d.parts.ledger.mass : null]));
};
const notLook = s => { const c = Object.assign({}, s); delete c.paint; delete c.finish; return JSON.stringify(c); };

function checks(C, garageSrc) {
  const bad = [], say = [];
  const ok = (c, m) => { say.push((c ? '  ok     ' : '  FAIL   ') + m); if (!c) bad.push(m); };
  const donor = specOf(DONOR), dl = C.liveryOf(donor);
  ok(dl.finish && dl.finish.decals && dl.finish.decals.m1On && !('job' in dl.paint) && !('wear' in dl.finish),
     'the donor\'s livery (the Carbon Cub SS) holds its kit layers and section tints, and neither the paint job nor the wear');
  const key = s => C.genCertKey(C.buildGen(clone(s)));
  for (const k of Object.keys(BUILDS)) {
    const s = specOf(BUILDS[k]), k0 = key(s);
    // KEY: a look change of every kind - colours, finish, decals, glass, registration, name
    const a = clone(s);
    a.paint = Object.assign({}, a.paint, { base: 0x123456, trim: 0x654321, gloss: 0.11, sweep: 0.9, regX: 0.6 });
    a.finish = Object.assign({}, a.finish || {}, { sections: { body: { tint: 0xabcdef } }, decals: { m1On: 1, m1Pat: 7, regH: 0.5 }, glass: { opacity: 0.6 } });
    a.meta = Object.assign({}, a.meta, { reg: 'F-LIVR', name: 'livery test' });
    const b = clone(s); b.paint = Object.assign({}, b.paint, { job: (s.paint && s.paint.job) === 'bare' ? 'full' : 'bare' });
    ok(key(a) === k0 && key(b) !== k0, `${k}: KEY blind to a livery (colours, finish, decals, glass, reg, name) and sees the paint job (${(s.paint && s.paint.job) || 'full'} -> ${b.paint.job})`);
    // FLY: wearing the Carbon Cub's livery
    const sw = clone(s); sw.finish = Object.assign({}, sw.finish || {}); sw.finish.sections = Object.assign({}, sw.finish.sections || {}, { body: Object.assign({}, (sw.finish.sections || {}).body, { wearM: 0.37 }) });
    const ww = C.liveryApply(sw, dl);
    ok(ww.finish && ww.finish.sections && ww.finish.sections.body && ww.finish.sections.body.wearM === 0.37 && !('wearM' in (C.liveryOf(sw).finish.sections.body || {})),
       `${k}: a section's own wear (wearM) is the plane's: kept through a swap, never in a livery`);
    const w = C.liveryApply(s, dl);
    const kept = (w.paint.job === (s.paint && s.paint.job)) && JSON.stringify((w.finish || {}).wear) === JSON.stringify((s.finish || {}).wear)
      && JSON.stringify((w.finish || {}).weather) === JSON.stringify((s.finish || {}).weather);
    ok(airframe(C, w) === airframe(C, s) && notLook(w) === notLook(s) && kept && key(w) === k0 && C.liverySame(C.liveryOf(w), dl),
       `${k}: FLY wearing the Carbon Cub's livery - the airframe, the masses and every other spec key the same, its job / wear / weather kept, the cert key the same`);
  }
  // OPS
  const s0 = specOf(BUILDS.rufus);
  let st = C.liveryState(s0, null, null);
  ok(st.list.length === 1 && st.list[0].name === 'Livery 1' && !C.liveryModified(st) && C.liveryEnvelope(st) === null,
     'OPS an old save opens as one "Livery 1", unmodified, and the envelope writes nothing (latent)');
  const ed = clone(st.spec); ed.paint = Object.assign({}, ed.paint, { base: 0xff0000 }); st = Object.assign({}, st, { spec: ed });
  ok(C.liveryModified(st), 'OPS an edit marks the worn livery modified');
  st = C.LIVERY_OPS.saveAs(st, '  Red   one ');
  ok(st.list.length === 2 && st.on === 'l2' && st.list[1].name === 'Red one' && !C.liveryModified(st), 'OPS save-as adds a named livery, worn, unmodified');
  st = C.LIVERY_OPS.wear(st, 'l1');
  ok(st.spec.paint.base === s0.paint.base && st.spec.paint.job === s0.paint.job && !C.liveryModified(st), 'OPS wearing "Livery 1" again gives back the plane\'s own colours');
  ok(C.LIVERY_OPS.remove(st, 'l1').list.length === 2 && C.LIVERY_OPS.remove(C.liveryState(s0, null, null), 'l1').list.length === 1
     && C.LIVERY_OPS.remove(st, 'l2').list.length === 1, 'OPS remove: never the worn one, never the last, the other goes');
  st = C.LIVERY_OPS.rename(st, 'l2', 'Racing red');
  const env = C.liveryEnvelope(st), back = env && C.liveryState(st.spec, clone(env.liveries), env.livery);
  ok(!!env && env.livery === 'l1' && JSON.stringify(back.list) === JSON.stringify(st.list) && back.on === st.on,
     'OPS the round trip through the envelope is exact (' + (env ? JSON.stringify(env).length : 0) + ' bytes for two liveries)');
  { const m = clone(st.list[0]), n = clone(m); n.finish = Object.assign({}, n.finish || {}); n.finish.decals = Object.assign({}, n.finish.decals || {}, { regW: 1.71130 });
    m.finish = Object.assign({}, m.finish || {}); m.finish.decals = Object.assign({}, m.finish.decals || {}, { regW: 1.73661 });
    const u = clone(n); u.finish.decals.regLock = 0;
    ok(C.liverySame(m, n) && !C.liverySame(m, u), 'OPS a locked registration\'s measured width never reads as an edit; an unlocked one does'); }
  let threw = false, cl = null;
  try { cl = C.liveriesClean([null, 7, { x: 1 }, { id: 'a', paint: {} }, { id: 'a', name: '', paint: { base: 1 }, finish: [] }]); } catch (e) { threw = true; }
  ok(!threw && cl && cl.length === 2 && cl[0].id !== cl[1].id && cl[1].name && cl[1].finish === null, 'OPS a hand-edited list is cleaned, never a throw');
  // DOOR: the envelope writes the rows only when there are some; the unwrap hands them back
  ok(/\.\.\.\(\s*lv\s*\?\s*\{\s*liveries:\s*lv\.liveries,\s*livery:\s*lv\.livery\s*\}\s*:\s*\{\}\s*\)/.test(garageSrc)
     && /liveries:\s*o\.liveries\s*\|\|\s*null,\s*livery:\s*o\.livery\s*\|\|\s*null/.test(garageSrc),
     'DOOR garage.js: the envelope spreads liveries / livery in only when present; the unwrap hands them back');
  return { bad, say };
}

const C = load(CORE_SRC);
const R = checks(C, GARAGE_SRC);
for (const l of R.say) console.log(l);
if (SELF) {
  const brk = (what, a, b, g) => {
    let r;
    if (g) r = checks(C, GARAGE_SRC.replace(a, b));
    else {
      const pairs = Array.isArray(a) ? a : [[a, b]];
      let src = CORE_SRC;
      for (const [x, y] of pairs) { if (!src.includes(x)) { console.log('  selftest ' + what + ': ANCHOR GONE'); R.bad.push('selftest anchor: ' + what); return; } src = src.replace(x, y); }
      r = checks(load(src), GARAGE_SRC);
    }
    const red = r.bad.length > 0;
    console.log('  selftest ' + what + ': ' + (red ? 'red (ok)' : 'GREEN - the check is blind'));
    if (!red) R.bad.push('selftest: ' + what);
  };
  brk('the swap takes the donor\'s paint job', "const LIVERY_NOT_PAINT = ['job'];", 'const LIVERY_NOT_PAINT = [];');
  brk('the swap drops the plane\'s wear', "const LIVERY_NOT_FINISH = ['wear', 'weather'];", "const LIVERY_NOT_FINISH = ['weather'];");
  brk('the swap drops a section\'s wear', "const LIVERY_NOT_SECTION = ['wearM'];", 'const LIVERY_NOT_SECTION = [];');
  brk('a measured width reads as an edit', "if (d.regLock === undefined || d.regLock) delete d.regW;", '');
  brk('the key sees the registration', "const GEN_CERT_KEY_LOOK = ['paint', 'finish', 'meta', 'v', 'name', 'reg'];", "const GEN_CERT_KEY_LOOK = ['paint', 'finish', 'meta', 'v', 'name'];");
  // (the job reaches the key twice: paint.job itself, and the built spec's _frame masses its coats weigh into)
  brk('the key loses the paint job', [['if (spec.paint && typeof spec.paint === \'object\' && spec.paint.job != null) c.paint = { job: spec.paint.job };', ''],
    ['if (GEN_CERT_KEY_LOOK.indexOf(k) < 0) c[k] = spec[k];', "if (GEN_CERT_KEY_LOOK.indexOf(k) < 0 && k !== '_frame') c[k] = spec[k];"]]);
  brk('the envelope always writes', "if (st.list.length === 1 && st.list[0].name === 'Livery 1') return null;", '');
  brk('remove takes the worn one', 'if (st.list.length <= 1 || id === st.on ||', 'if (st.list.length <= 1 ||');
  brk('the door always writes the rows', /\.\.\.\(\s*lv\s*\?/, '...(true ?', true);
}
console.log('GATE LIVERYSET: ' + (R.bad.length ? 'FAIL (' + R.bad.length + ')' : 'PASS'));
process.exit(R.bad.length ? 1 : 0);
