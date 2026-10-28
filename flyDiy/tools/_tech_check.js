// _tech_check.js - GATE TECH (G3230-G3239 TECH-MASK): the machine shop's three segments, one table.
//   node tools/_tech_check.js [--selftest] [--emit]      -> "GATE TECH: PASS|FAIL"
// Holds (79b_tech.js, pure; editor.js's TECH-MASK block; 76_procure.js's filter; futureDesigns/game/GAME-PLAN-2026-10-15.md
// §R "a segmented tech tree", §4.1-§4.4):
//   - THE TABLE: every option of every GEN table it covers has a segment (1-3), and every row names an option that exists;
//     the gear types and canopy styles are clampSpec's own (probed); the editor's row lists are the join's own vocabularies
//     and the cage rows' own option counts;
//   - THE STAGES: the validated builds read their expected segments (Cub, Jodel 1; the metal Cessna and its floats 2; the
//     twin floatplane 2), the story's starter and the client's Cub 1; TECH_DESIGNS is re-derived from every build file
//     (--emit prints it); the stage is the MAX over the keys; it is never written into a spec or a save;
//   - THE CAREER: a new story career opens at segment 1, careerNormalise keeps it (and adds nothing to a career without
//     one), careerTechAllows / careerTechUnlock;
//   - THE SANDBOX UNCHANGED: no machine shop in the sandbox or a career without one (every option allowed, the market and
//     the catalogue as before, the editor touches nothing); every page call behind CAREER_DEV;
//   - THE EDITOR (editor.js's own TECH-MASK block, headless over the real cage rows and the real design table): at
//     segment 1 it greys EXACTLY the above-segment options, the reason written in the option and under the row; nothing
//     at segment 3, nothing with no state, nothing while the story's lock holds (then it applies); a part already above
//     is held; an entry opens its option; the design tiles (construction, powertrain, twin, tricycle, bubble) likewise;
//   - THE MARKET AND THE MAKERS: the catalogue's models at or below the segment, a model's keys exact against its spec
//     for every option, a maker refusing an above-segment model, the used listings at or below the segment;
//   - THE STORY'S OCCASIONS: the three still listed at T7 (the fabric 4-seater stands as the metal Cessna, one above);
//   - --selftest: six breaks, each caught.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SELF = process.argv.includes('--selftest'), EMIT = process.argv.includes('--emit');
const J = o => JSON.stringify(o);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CORE_SRC = read('tools/flight_core.js');
const TECH_SRC = read('src/core/79b_tech.js');
const ED_SRC = read('src/viewer/editor.js');
const DF_SRC = read('src/viewer/design_flow.js');
const APP_SRC = read('src/viewer/app.js');
const PROCURE_SRC = read('src/core/76_procure.js');

// ---- a core, evaluated fresh (the selftest doctors 79b_tech.js / 76_procure.js inside it) -----------------------------
function coreOf(doctor) {
  let src = CORE_SRC;
  if (doctor) { const t = doctor(TECH_SRC, PROCURE_SRC); src = src.replace(TECH_SRC, t.tech).replace(PROCURE_SRC, t.procure); }
  const ctx = vm.createContext({ console, module: { exports: {} }, Math, JSON, Date });
  vm.runInContext(src, ctx, { filename: 'flight_core.js' });
  return { M: ctx.module.exports, ctx };
}

// ---- the panel's own tables: the cage rows' option names, the engine catalogue (as GATE PROCURE loads them) -----------
function panel() {
  const C = require(path.join(__dirname, 'flight_core.js'));
  for (const k of Object.keys(C)) if (!(k in global)) global[k] = C[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => (k === 'Vector3' ? function () { return { set: noop, x: 0, y: 0, z: 0 }; } : class extends Obj {}) });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_float_gen.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js'])
    require(path.join(__dirname, f));
  const EP = global.window.ENG_PAGE;
  const presets = Object.keys(EP.PRESETS).filter(n => n !== 'bare engine').concat([EP.CUSTOM_ENGINE || 'custom engine']);
  const JOIN = require(path.join(__dirname, '_cage_join.js'));
  const COWL = require(path.join(__dirname, '_cowl_gen.js'));
  global.window = {};
  const DES = require(path.join(__dirname, '_cage_design.js'));
  delete global.window; delete global.THREE;
  // a row's option names, off its own declaration in the cage sources: ['key', 'label', lo, hi, st, [names] ...]
  const SRCS = fs.readdirSync(__dirname).filter(f => /^_cage_\w+\.js$/.test(f)).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const namesOf = k => {
    const m = new RegExp("\\[\\s*'" + k + "',\\s*'[^']*',\\s*[-\\d.]+,\\s*[-\\d.]+,\\s*[-\\d.]+,\\s*(\\[[^\\]]*\\])").exec(SRCS);
    if (m) return vm.runInNewContext(m[1]);
    // the blade's material row is the cowl page's MATERIALS (_cage_cowl.js groupItems: rowNames over CW.MATERIALS)
    if (k === 'cw_material') return COWL.MATERIALS.map(x => x.name);
    // the second wing's rows are the first's, re-keyed (_cage_wing.js w2Key: 'w2' + k.slice(2))
    return /^w2/.test(k) && /const w2Key = k => 'w2' \+ k\.slice\(2\);/.test(SRCS) ? namesOf('wg' + k.slice(2)) : null;
  };
  return { presets, engines: JOIN.CAGE_JOIN_ENGINES, propMats: JOIN.CAGE_JOIN_PROP_MATS, DES, namesOf, JOIN_SRC: read('tools/_cage_join.js') };
}
const PANEL = panel();

// ---- a minimal DOM for the editor's block ------------------------------------------------------------------------------
function fakeEl(tag) {
  const el = { tagName: String(tag).toUpperCase(), children: [], parentNode: null, className: '', textContent: '', disabled: false, hidden: false,
    checked: false, value: '', classList: null,
    appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
    removeChild(c) { el.children = el.children.filter(x => x !== c); c.parentNode = null; return c; },
    get options() { return el.children.filter(c => c.tagName === 'OPTION'); } };
  const cls = new Set();
  el.classList = { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); } };
  return el;
}
const ROWS_UNDER_TEST = ['intCons', 'wgCons', 'w2Cons', 'finCons', 'stCons', 'glazeMat', 'canopy', 'fairCons', 'engMount', 'engPower', 'engPreset', 'cw_material'];
function rowMeta(k, names, val) {
  const row = fakeEl('div'), el = fakeEl('select');
  names.forEach((n, i) => { const o = fakeEl('option'); o.value = String(i); o.textContent = n; el.appendChild(o); });
  row.appendChild(el);
  return { k, names, kind: 'select', el, row, val };
}
// the editor's TECH-MASK block, sliced out of editor.js and run over a core context with the cage rows
function editorOf(core, edSrc) {
  const a = edSrc.indexOf('  // ---- G3230 TECH-MASK: THE MACHINE SHOP IN THE EDITOR (begin)');
  const b = edSrc.indexOf('  // ---- G3230 TECH-MASK (end)');
  if (a < 0 || b < a) throw new Error('editor.js: the TECH-MASK block is not found');
  const ctx = core.ctx;
  ctx.document = { createElement: fakeEl };
  ctx.window = { CAGE_DESIGN: PANEL.DES };
  ctx.CAGE_JOIN_ENGINES = PANEL.engines; ctx.CAGE_JOIN_PROP_MATS = PANEL.propMats;
  vm.runInContext('let CU = null, lockWhy = null;\n' + edSrc.slice(a, b) +
    '\nthis.__ed = { set: (c, l) => { CU = c; lockWhy = l; }, TM: window.TECH_MASK };', ctx, { filename: 'editor.js (TECH-MASK)' });
  return ctx.__ed;
}

function run(core, edSrc) {
  const { M } = core;
  const fails = [];
  const ok = (c, what, x) => { if (!c) fails.push(what); if (!SELF) console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what + (x != null ? '  [' + x + ']' : '')); };
  const T = M.TECH_TABLE;

  // ================= 1 THE TABLE =================
  const SOURCES = {
    mat: Object.keys(M.GEN_MATERIALS), surf: Object.keys(M.GEN_SURF_MATERIALS), eng: Object.keys(M.POWERPLANTS),
    prop: Object.keys(M.GEN_PROP_MATS), pitch: Object.keys(M.GEN_PROP_PITCH), fit: Object.keys(M.GEN_SYSTEMS),
    gear: M.TECH_GEAR_TYPES, susp: Object.keys(M.GEN_SUSPENSION), fair: Object.keys(core.ctx.GEN_FAIR_MATS || vm.runInContext('GEN_FAIR_MATS', core.ctx)),
    glaze: Object.keys(M.GEN_OUTFIT.glassKgM2By), canopy: M.TECH_CANOPY_STYLES, fuel: Object.keys(M.GEN_FUELS), cell: Object.keys(M.GEN_CELLS),
    cfg: ['twin'], kit: ['stol'],
  };
  for (const k of Object.keys(M.GEN_ELEC)) if (k !== 'harness') SOURCES['elec.' + k] = Object.keys(M.GEN_ELEC[k]);
  for (const k of Object.keys(M.GEN_AVIONICS)) SOURCES['av.' + k] = Object.keys(M.GEN_AVIONICS[k]);
  const want = [];
  for (const g of Object.keys(SOURCES)) for (const o of SOURCES[g]) want.push(g + ':' + o);
  const missing = want.filter(k => T[k] == null);
  ok(!missing.length, 'every option of every covered table has a segment (' + want.length + ' options, ' + Object.keys(SOURCES).length + ' groups)', missing.slice(0, 6).join(', ') || null);
  const stray = Object.keys(T).filter(k => !want.includes(k));
  ok(!stray.length, 'every row of the table names an option that exists', stray.join(', ') || null);
  ok(Object.values(T).every(v => v === 1 || v === 2 || v === 3), 'every segment is 1, 2 or 3');
  ok([1, 2, 3].every(s => Object.values(T).includes(s)) && M.techName(1) === 'Wood and fabric' && M.techName(2) === 'Sheets and bolts' && M.techName(3) === 'Composite and electronics',
     'three segments, by the user\'s names (§R), each with options');
  ok(M.techWhy(2) === 'Machine shop: Sheets and bolts', 'the reason\'s words', M.techWhy(2));
  // clampSpec's own lists
  const clamp = patch => { const s = JSON.parse(J(M.GEN_DEFAULT)); for (const k of Object.keys(patch)) Object.assign(s[k] = s[k] || {}, patch[k]); return M.clampSpec(s) || s; };
  ok(M.TECH_GEAR_TYPES.every(t => clamp({ gear: { type: t } }).gear.type === t) && M.TECH_GEAR_TYPES.includes(clamp({ gear: { type: 'retractable?' } }).gear.type),
     'the gear types are clampSpec\'s (each kept, an unknown rewritten into the list)');
  const cn = st => { const s = JSON.parse(J(M.GEN_DEFAULT)); s.cabin.canopy.style = st; const r = M.clampSpec(s) || s; return r.cabin.canopy.style; };
  ok(M.TECH_CANOPY_STYLES.every(t => cn(t) === t) && M.TECH_CANOPY_STYLES.includes(cn('dome?')), 'the canopy styles are clampSpec\'s');
  ok(M.techSegOf('fam:piston') === 1 && M.techSegOf('fam:electric') === 3 && M.techSegOf('fam:turbine') === 3 && M.techSegOf('nope:x') === null,
     'a powertrain family opens with its first engine; an unknown key is never greyed');
  // the editor's rows: the join's vocabularies and the rows' own option counts
  const JS = PANEL.JOIN_SRC;
  const listIn = re => { const m = re.exec(JS); return m ? vm.runInNewContext(m[1]) : null; };
  const intJoin = listIn(/fus\.material = (\[[^\]]*\])\[/);
  const cons4 = listIn(/const CONS4 = (\[[^\]]*\]);/);
  const glz = listIn(/cabin\.glazingMat = (\[[^\]]*\])\[/);
  const fair = listIn(/spec\.gear\.fairMat = (\[[^\]]*\])\[/);
  const mounts = listIn(/const mk = (\[[^\]]*\])\[Math\.round\(P\.engMount/);
  ok(J(M.TECH_ROWS.intCons) === J(intJoin.map(m => 'mat:' + m)), 'intCons: the join\'s fuselage materials, in its order', J(intJoin));
  ok(J(M.TECH_SURF_ROW) === J([null].concat(cons4.map(m => 'surf:' + m))) && /material: Math\.round\(P\.wgCons\) > 0/.test(JS) && /\['carbon', 'steel', 'fabric',\s*'alloy', 'aluFabric', 'glass'\]\[Math\.round\(P\.wgCons\) - 1\]/.test(JS),
     'the surfaces\' rows (wg / w2 / fin / stab): "as the aeroplane", then the join\'s CONS4', J(cons4));
  ok(J(M.TECH_ROWS.glazeMat) === J(glz.map(m => 'glaze:' + m)) && J(M.TECH_ROWS.fairCons) === J(fair.map(m => 'fair:' + m)), 'glazeMat and fairCons: the join\'s lists');
  ok(/Math\.round\(\+P\.canopy\) === 3 \? 'bubble' : 'screen'/.test(JS) && M.TECH_ROWS.canopy.every((k, i) => k === (i === 3 ? 'canopy:bubble' : 'canopy:screen')), 'canopy: the fourth tile is the bubble (the join\'s rule)');
  ok(mounts && mounts[3] === 'wing' && M.TECH_ROWS.engMount[3] === 'cfg:twin' && M.TECH_ROWS.engMount.slice(0, 3).every(k => k === null), 'engMount: the wing nacelles (the fourth) are the twin');
  for (const k of ROWS_UNDER_TEST.filter(k => M.TECH_ROWS[k])) {
    const n = PANEL.namesOf(k);
    ok(n && n.length === M.TECH_ROWS[k].length, k + ': the row\'s ' + (n ? n.length : '?') + ' options, one key each');
  }
  const pk = M.techRowKeys('engPreset', { names: PANEL.presets, engines: PANEL.engines });
  ok(pk && pk.length === PANEL.presets.length && pk.slice(0, -1).every(k => k && T[k] != null) && pk[pk.length - 1] === null,
     'engPreset: every catalogue engine reads its registry row\'s segment, the custom engine none (' + PANEL.presets.length + ' options)');
  const cw = M.techRowKeys('cw_material', { propMats: PANEL.propMats });
  ok(cw && cw.every(k => T[k] != null) && cw.length === PANEL.namesOf('cw_material').length, 'cw_material: every blade material through CAGE_JOIN_PROP_MATS, in step with the cowl page\'s list', J(cw));

  // ================= 2 THE STAGES =================
  const FILE = {};
  for (const id of Object.keys(M.CONTRACT_DESIGNS)) FILE[id] = M.procureBaseSpec(id, JSON.parse(read(M.CONTRACT_DESIGNS[id].build)));
  const EXPECT = { cub: 1, jodel: 1, c172: 2, c172f: 2, twinf: 2 };
  for (const id of Object.keys(EXPECT)) ok(M.techStageOfSpec(FILE[id]) === EXPECT[id], 'the validated ' + M.CONTRACT_DESIGNS[id].label + ' reads segment ' + EXPECT[id],
    M.techStageOfSpec(FILE[id]) + (M.techOver(FILE[id], EXPECT[id] - 1).length ? ' by ' + M.techOver(FILE[id], EXPECT[id] - 1).map(r => r.key).join(', ') : ''));
  const derived = {};
  for (const id of Object.keys(FILE)) derived[id] = M.techKeysOfSpec(FILE[id]);
  if (EMIT && !SELF) for (const id of Object.keys(derived)) console.log('  ' + id + ': [' + derived[id].map(k => "'" + k + "'").join(', ') + '],');
  const off = Object.keys(derived).filter(id => J(derived[id]) !== J(M.TECH_DESIGNS[id]));
  ok(!off.length && J(Object.keys(M.TECH_DESIGNS).sort()) === J(Object.keys(FILE).sort()), 'TECH_DESIGNS = every build file re-derived (techKeysOfSpec; --emit prints it)', off.join(', ') || null);
  const starterF = M.STORY_FILES.starter.find(f => fs.existsSync(path.join(ROOT, f)));
  const starter = starterF ? JSON.parse(read(starterF)) : null;
  ok(starter && M.techStageOfSpec(starter.spec || starter) === 1, 'the story\'s starter (' + starterF + ') reads segment 1',
     starter && J(M.techOver(starter.spec || starter, 1).map(r => r.key)));
  const cubF = JSON.parse(read(M.STORY_FILES.client[0]));
  ok(M.techStageOfSpec(M.storyClientSpec(cubF.spec || cubF)) === 1, 'the client\'s Cub as it arrives (T2) reads segment 1');
  const t2 = JSON.parse(J(FILE.cub)); t2.engines = [{ type: 'jabiru2200_std' }]; t2.controls.flap = { type: 'plain', span: 0.5, chord: 0.2 }; t2.systems = { fit: 'basic' };
  ok(M.techStageOfSpec(t2) === 1, 'T2\'s checklist finishes inside segment 1 (a Jabiru, flaps, the basic panel: a battery for lights)');
  const mk = (patch) => { const s = JSON.parse(J(FILE.cub)); return Object.assign(s, patch); };
  ok(M.techStageOfSpec(mk({ fuselage: Object.assign({}, FILE.cub.fuselage, { material: 'carbon' }) })) === 3 &&
     M.techStageOfSpec(mk({ engines: [FILE.cub.engines[0], FILE.cub.engines[0]] })) === 2 &&
     M.techStageOfSpec(mk({ systems: { fit: 'basic', avionics: { gps: 'portable' } } })) === 3 &&
     M.techStageOfSpec(mk({ gear: Object.assign({}, FILE.cub.gear, { type: 'tricycle' }) })) === 2 &&
     M.techStageOfSpec(mk({ cabin: Object.assign({}, FILE.cub.cabin, { canopy: { style: 'bubble' } }) })) === 2 &&
     M.techStageOfSpec(mk({ wings: [Object.assign({}, FILE.cub.wings[0], { stol: { vg: 1 } })] })) === 3 &&
     M.techStageOfSpec({}) === 1,
     'the stage is the MAX of the options used: carbon 3, a twin 2, a GPS 3, a tricycle 2, a bubble 2, the STOL kit 3, an empty spec 1');
  const before = J(FILE.c172); M.techStageOfSpec(FILE.c172); M.techKeysOfSpec(FILE.c172);
  ok(J(FILE.c172) === before && !/tech/.test(J(Object.keys(FILE.c172))), 'computed, never stored: reading a spec\'s stage leaves it byte for byte');

  // ================= 3 THE CAREER =================
  const sb = M.playerNormalise(M.playerDefault ? M.playerDefault() : {});
  const c0 = M.careerNormalise(M.careerNew({ id: 't', seed: 'tech', name: 'gate' }));
  ok(!('tech' in c0.career) && M.careerTechOf(c0) === null && M.careerTechSeg(c0) === 3, 'a career without a machine shop (the dev career, every career before this): no `tech`, nothing masked');
  const st = M.storyNewCareer(c0, { aeros: [] });
  let d = st.doc;
  ok(st.ok && J(d.career.tech) === J({ seg: 1, entries: [] }), 'a new story career opens its machine shop at segment 1 ({ seg: 1, entries: [] })', J(d.career.tech));
  ok(J(M.careerNormalise(JSON.parse(J(d))).career.tech) === J(d.career.tech), 'the save round trip keeps it (careerNormalise)');
  const odd = JSON.parse(J(d)); odd.career.tech = { seg: 9, entries: ['mat:alloy', 'mat:alloy', 'nope', 7] };
  ok(J(M.careerNormalise(odd).career.tech) === J({ seg: 3, entries: ['mat:alloy'] }), 'careerNormalise: the segment clamped to 1-3, the entries to the table\'s keys, once each');
  ok(M.careerTechAllows(d, 'mat:tubeFabric') && !M.careerTechAllows(d, 'mat:alloy') && !M.careerTechAllows(d, 'eng:pt6a42_hartzell4') && M.careerTechAllows(d, 'unknown:x'),
     'careerTechAllows at segment 1: steel tube yes, aluminium no, a turbine no, an unknown key yes');
  const en = JSON.parse(J(d)); en.career.tech.entries = ['mat:alloy'];
  ok(M.careerTechAllows(en, 'mat:alloy') && !M.careerTechAllows(en, 'mat:aluTube'), 'an entry (§4.2, a finer key) opens that option alone');
  const u = M.careerTechUnlock(d, 2);
  ok(u.ok && u.doc.career.tech.seg === 2 && d.career.tech.seg === 1 && !M.careerTechUnlock(u.doc, 1).ok && !M.careerTechUnlock(c0, 2).ok,
     'careerTechUnlock: on a clone, never down, refused without a machine shop');
  ok(M.careerTechStageOk(d, 2, true) && !M.careerTechStageOk(d, 2, false) && !M.careerTechStageOk(d, 3, true), 'an occasion may stand one segment above (§4.4), no more');

  // ================= 4 THE SANDBOX UNCHANGED =================
  ok(M.careerTechOf(sb) === null && M.careerTechSeg(sb) === 3 && Object.keys(T).every(k => M.careerTechAllows(sb, k)), 'the sandbox: no machine shop, every option allowed');
  ok(J(M.procureCatalogue(sb)) === J(M.procureCatalogue()) && J(M.procureCatalogue(c0)) === J(M.procureCatalogue()), 'the catalogue of the sandbox and of a career without one: every model, as before');
  const raw = (doc) => { const c = doc.career; return M.procureMarket(c ? c.seed : 'sandbox', c ? c.contracts.done.length : 0, M.procureSold(doc)); };
  ok(J(M.procureMarketOf(sb)) === J(raw(sb)) && J(M.procureMarketOf(c0)) === J(raw(c0)), 'the used market of the sandbox and of a career without one: unfiltered, as before');
  ok(/function techMaskSync\(\) \{\n\s+if \(!CAREER_DEV \|\| !window\.TECH_MASK\) return;/.test(APP_SRC) && /if \(CAREER_DEV\) techMaskSync\(\);/.test(APP_SRC) &&
     /function storyMaskNote\(\) \{\n\s+techMaskSync\(\);/.test(APP_SRC), 'app.js: the machine shop reaches the editor only behind CAREER_DEV (techMaskSync; the story card and the editor\'s open)');
  ok(/window\.TECH_MASK\.tutorial\(m\)/.test(APP_SRC) && /tutorial\(m\) \{ techTut = m/.test(edSrc), 'the story\'s hand-over: storyMaskNote calls TECH_MASK.tutorial, the editor exposes it');
  ok(/window\.TECH_MASK \? window\.TECH_MASK\.tileWhy\(row, opt\)/.test(DF_SRC) && /window\.TECH_MASK \? window\.TECH_MASK\.seedWhy\(row, curOpt\)/.test(DF_SRC) &&
     /window\.TECH_MASK \? window\.TECH_MASK\.sig\(\) : ''/.test(DF_SRC), 'design_flow.js: the tiles, the seed pill and the relight signature read the mask');

  // ================= 5 THE EDITOR (headless) =================
  const E = editorOf(core, edSrc);
  const P = { intCons: 1, wgCons: 0, w2Cons: 0, finCons: 0, stCons: 0, glazeMat: 0, canopy: 0, fairCons: 0, engMount: 0, engPower: 0, engPreset: 0, cw_material: 0, dashStyle: 0 };
  const metas = ROWS_UNDER_TEST.map(k => rowMeta(k, k === 'engPreset' ? PANEL.presets : PANEL.namesOf(k), P[k]));
  const decoy = rowMeta('dashStyle', ['box', 'arch'], 0);
  const slider = { k: 'wgSpan', kind: 'slider', el: fakeEl('input'), row: fakeEl('div') };
  const ROWMETA = metas.concat([decoy, slider]);
  const CU = { P, ROWMETA };
  const snap = () => J(ROWMETA.map(m => [m.k, m.el.disabled, (m.el.options || []).map(o => [o.disabled, o.textContent]), m.row.children.length, m.row.classList.contains('tech')]));
  const pristine = snap();
  E.set(CU, null);
  E.TM.set(null); E.TM.apply();
  ok(snap() === pristine && E.TM.state() === null, 'no machine shop (the sandbox): the editor touches nothing');
  const keysOf = m => M.techRowKeys(m.k, { names: m.names, engines: PANEL.engines, propMats: PANEL.propMats });
  const expectGrey = (m, seg) => m.names.map((n, i) => { const s = M.techSegOf(keysOf(m)[i]); return s != null && s > seg; });
  const greyed = m => m.el.options.map(o => !!o.disabled);
  E.TM.set({ seg: 1, entries: [] });
  const bad = metas.filter(m => J(greyed(m)) !== J(expectGrey(m, 1)));
  ok(!bad.length, 'segment 1: EXACTLY the above-segment options greyed, row by row (' + metas.length + ' rows, ' + metas.reduce((s, m) => s + greyed(m).filter(Boolean).length, 0) + ' options greyed)',
     bad.map(m => m.k + ' ' + J(greyed(m))).join('; ') || null);
  const words = metas.every(m => m.el.options.every((o, i) => expectGrey(m, 1)[i] ? / · Machine shop: (Sheets and bolts|Composite and electronics)$/.test(o.textContent) : o.textContent === m.names[i]));
  ok(words, 'the reason IN the option ("aluminium · Machine shop: Sheets and bolts"), the open ones\' words untouched', metas[0].el.options[3].textContent);
  const notes = metas.every(m => { const any = expectGrey(m, 1).some(Boolean); const n = m.row.children.find(c => /edTech/.test(c.className));
    return any ? !!n && /^Machine shop: /.test(n.textContent) && m.row.classList.contains('tech') : !n && !m.row.classList.contains('tech'); });
  ok(notes, 'the reason written UNDER each greyed row (nothing hover-only), no line under a row with nothing greyed',
     (metas.find(m => m.k === 'intCons').row.children.find(c => /edTech/.test(c.className)) || {}).textContent);
  ok(J([decoy.el.disabled, greyed(decoy), decoy.row.children.length]) === J([false, [false, false], 1]) && !slider.el.disabled, 'a row the mask does not read is untouched');
  ok(!metas.some(m => m.el.disabled), 'the rows themselves stay open (the player\'s own options are not above)');
  const s1 = snap();
  E.TM.apply(); E.TM.apply();
  ok(snap() === s1, 'idempotent: a second pass writes the same (the reason not doubled)');
  E.TM.set({ seg: 3, entries: [] });
  ok(snap() === pristine, 'segment 3: nothing greyed, every option\'s own words back');
  E.TM.set({ seg: 1, entries: [] });
  E.set(CU, 'Tim: the structure comes later');
  E.TM.tutorial('finish');
  ok(snap() === pristine && E.TM.state().tutorial === 'finish' && E.TM.state().held, 'the story\'s lock wins while it holds (T0): the mask yields, the tutorial mode kept');
  E.set(CU, null); E.TM.apply();
  ok(snap() === s1, 'the lock lifted: the mask applies again');
  E.TM.tutorial(null);
  P.intCons = 3; E.TM.apply();
  const ic = metas.find(m => m.k === 'intCons');
  const icN = ic.row.children.find(c => /edTech/.test(c.className));
  ok(ic.el.disabled && icN && /^Machine shop: Sheets and bolts: yours to fly as it is, not to modify$/.test(icN.textContent) && !greyed(ic).some(Boolean),
     'a part already above the segment (an occasion\'s aluminium): the row held, the reason under it', icN && icN.textContent);
  P.intCons = 1; E.TM.apply();
  ok(!ic.el.disabled && snap() === s1, 'back to steel tube: the row free again');
  E.TM.set({ seg: 1, entries: ['mat:alloy'] });
  ok(!greyed(ic)[3] && greyed(ic)[4], 'an entry opens its option alone (aluminium yes, aluminium tube no)');
  E.TM.set({ seg: 1, entries: [] });
  // the design tiles, through the real design table
  const tileGreys = (key) => PANEL.DES.rowOptions(PANEL.DES.DESIGN_ROWS.find(r => r.key === key)).filter(o => !o.inactive)
    .filter(o => !!E.TM.tileWhy(PANEL.DES.DESIGN_ROWS.find(r => r.key === key), o)).map(o => o.value);
  const TILE_EXPECT = { intCons: [0, 3, 4, 5], engFamily: ['electric', 'turbine'], engCount: [2, 'pushPull', 3, 4], gearLayout: ['trike'], canopy: ['bubble'], suspension: [], covering: [], planes: [] };
  const tb = Object.keys(TILE_EXPECT).filter(k => J(tileGreys(k)) !== J(TILE_EXPECT[k]));
  // (ENGINE-CONFIGS-2: the push-pull, the three and the four are several engines - greyed with the twin)
  ok(!tb.length, 'the design tiles at segment 1: construction (composite, aluminium, aluminium tube, glassfibre), electric and turbine, the twin (and the push-pull, the three, the four), the tricycle, the bubble - and nothing else',
     tb.map(k => k + ' ' + J(tileGreys(k))).join('; ') || null);
  const trike = PANEL.DES.rowOptions(PANEL.DES.DESIGN_ROWS.find(r => r.key === 'gearLayout')).find(o => o.value === 'trike');
  ok(E.TM.tileWhy(PANEL.DES.DESIGN_ROWS.find(r => r.key === 'gearLayout'), trike) === 'Machine shop: Sheets and bolts', 'a tile\'s reason is the segment it needs', E.TM.tileWhy(PANEL.DES.DESIGN_ROWS.find(r => r.key === 'gearLayout'), trike));
  E.TM.set({ seg: 3, entries: [] });
  ok(Object.keys(TILE_EXPECT).every(k => !tileGreys(k).length) && E.TM.sig() === 'T3', 'segment 3: no tile greyed');
  E.TM.set(null);
  ok(Object.keys(TILE_EXPECT).every(k => !tileGreys(k).length) && E.TM.sig() === '' && snap() === pristine, 'no machine shop: no tile greyed, no signature, every row as it was');

  // ================= 6 THE MARKET AND THE MAKERS =================
  const seg = (doc, s) => { const x = JSON.parse(J(doc)); x.career.tech = { seg: s, entries: [] }; return x; };
  const cat = doc => [].concat(...M.procureCatalogue(doc).map(m => m.models));
  ok(J(cat(d)) === J(['scout', 'pinson']) && J(cat(seg(d, 2))) === J(cat(null)) && cat(null).length === 4,
     'the makers at segment 1: the Cub and the Jodel (the metal Cessna and the twin floatplane wait for segment 2)', J(cat(d)) + ' / ' + J(cat(seg(d, 2))));
  let exact = 0, wrong = [];
  for (const id of Object.keys(M.PROCURE_MODELS)) {
    const Md = M.PROCURE_MODELS[id], combos = [M.procureDefaults(id)];
    for (const r of Object.keys(Md.opts)) for (const v of Object.keys(Md.opts[r].vals)) { const o = M.procureOpts(id, Object.assign(M.procureDefaults(id), { [r]: v })); if (o.ok) combos.push(o.opts); }
    for (const o of combos) {
      const spec = M.procureSpec(id, o, FILE[M.procureDesignOf(id, o)]);
      if (J(M.techKeysOfModel(id, o)) === J(M.techKeysOfSpec(spec))) exact++; else wrong.push(id + ' ' + J(o));
    }
  }
  ok(!wrong.length && exact > 20, 'a model\'s keys are exact against its spec (procureSpec over the build file), every option value (' + exact + ' combinations)', wrong.slice(0, 2).join('; ') || null);
  ok(!M.techOptionOk(d, 'scout', null, 'avionics', 'ifr') && M.techOptionOk(d, 'scout', null, 'avionics', 'minimal') && M.techOptionOk(seg(d, 2), 'scout', null, 'avionics', 'ifr'),
     'an option above the segment: the Cub\'s IFR panel waits for segment 2');
  const buy = M.procureBuyModel(d, 'meridian', M.procureDefaults('meridian'), { slot: 'X', fileSpec: FILE.c172 });
  ok(!buy.ok && /^Machine shop: Sheets and bolts: not in your machine shop yet$/.test(buy.why), 'a maker refuses a model above the segment, with the reason', buy.why);
  const buy2 = M.procureBuyModel(d, 'scout', M.procureDefaults('scout'), { slot: 'X', fileSpec: FILE.cub });
  ok(!/Machine shop/.test(buy2.why || ''), 'a model inside the segment is not refused by the machine shop', buy2.why || 'ok');
  // the used market: every listing at or below the segment; a seed whose raw market holds an above-segment listing
  let found = null;
  for (let i = 0; i < 60 && !found; i++) {
    const x = JSON.parse(J(d)); x.career.seed = 'tech' + i;
    const all = raw(x);
    if (all.some(L => M.techStageOfModel(L.model, L.opts) > 1)) found = { x, all };
  }
  ok(!!found, 'a career seed whose raw used market lists an above-segment aeroplane (to filter)');
  if (found) {
    const shown = M.procureMarketOf(found.x);
    const gen = shown.filter(L => !L.occasion);
    ok(gen.every(L => M.techStageOfModel(L.model, L.opts) <= 1) && gen.length === found.all.filter(L => M.techStageOfModel(L.model, L.opts) <= 1).length,
       'the used market at segment 1: the listings at or below it, the others filtered (' + gen.length + ' of ' + found.all.length + ')');
    ok(J(M.procureMarketOf(seg(found.x, 3)).filter(L => !L.occasion)) === J(found.all), 'at segment 3: the whole market');
    const sold = found.all.find(L => M.techStageOfModel(L.model, L.opts) > 1);
    const bu = M.procureBuyUsed(found.x, sold.id, { slot: 'Y', fileSpec: FILE[sold.design] });
    ok(!bu.ok && /not for sale/.test(bu.why), 'an above-segment listing cannot be bought (not on the career\'s market)', bu.why);
  }

  // ================= 7 THE STORY'S OCCASIONS AT T7 =================
  let t7 = JSON.parse(J(d)); t7.career.story.beat = 'T7'; t7.career.story.done = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  t7 = M.careerNormalise(t7);
  const ap = M.storyApply(t7, { k: 'occasions', n: 3 });
  const occ = ap.ok ? M.procureMarketOf(ap.doc).filter(L => L.occasion).map(L => L.id) : [];
  ok(J(occ) === J(M.STORY_OCCASIONS.map(o => o.id)), 'the story\'s three occasions still listed at T7, segment 1 (' + occ.join(', ') + ')');
  const fab = ap.ok ? M.procureMarketOf(ap.doc).find(L => L.id === 'occ:fabric4') : null;
  ok(fab && M.techStageOfModel(fab.model, fab.opts) === 2, 'the fabric 4-seater (the metal Cessna until authored) is an occasion one segment above: listed by its flag');
  const noFlag = M.techListingOk(ap.doc, Object.assign({}, fab || {}, { occasion: false }));
  ok(!noFlag, 'the same aeroplane without the occasion flag is not listed at segment 1');
  return fails;
}

if (!SELF) {
  let fails = [];
  try { fails = run(coreOf(null), ED_SRC); } catch (e) { fails = ['GATE TECH threw: ' + (e && e.stack || e)]; console.log('  FAIL ' + fails[0]); }
  console.log(fails.length ? fails.length + ' failing' : 'all tech rows hold');
  console.log('GATE TECH: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
} else {
  const sub = (src, a, b) => { if (!src.includes(a)) throw new Error('selftest: the break\'s anchor is gone: ' + a.slice(0, 60)); return src.replace(a, b); };
  const T = (fn) => (t, p) => ({ tech: fn(t), procure: p });
  const breaks = [
    ['a table row dropped (the O-540 has no segment)', T(t => sub(t, "'eng:o540_hartzell': 2, ", '')), null],
    ['the stage is the MIN, not the max', T(t => sub(t, 'if (v != null && v > s) s = v; }\n  return s;\n}\n// the keys of a spec above', 'if (v != null && v < s) s = v; }\n  return s;\n}\n// the keys of a spec above')), null],
    ['the market ignores the machine shop', (t, p) => ({ tech: t, procure: sub(p, 'return typeof techListingOk === \'function\' ? all.filter(L => techListingOk(doc, L)) : all;', 'return all;') }), null],
    ['the occasion allowance lost', T(t => sub(t, 'careerTechStageOk(doc, s, !!(L && L.occasion))', 'careerTechStageOk(doc, s, false)')), null],
    ['the editor greys the open options too', null, s => sub(s, 'return s != null && s > techState.seg && !techState.entries.includes(key) ? s : null;', 'return s != null && s >= techState.seg ? s : null;')],
    ['the editor ignores the story\'s lock', null, s => sub(s, 'const on = !!techState && !lockWhy && !!CU && !!CU.ROWMETA;', 'const on = !!techState && !!CU && !!CU.ROWMETA;')],
  ];
  let bad = 0;
  for (const [what, doc, ed] of breaks) {
    let f;
    try { f = run(coreOf(doc), ed ? ed(ED_SRC) : ED_SRC); } catch (e) { f = ['threw: ' + e.message]; }
    console.log('  ' + (f.length ? 'caught ' : 'MISSED ') + what + (f.length ? ' (' + f[0] + ')' : ''));
    if (!f.length) bad++;
  }
  console.log('GATE TECH --selftest: ' + (bad ? 'FAIL' : 'PASS') + ' (' + breaks.length + ' breaks)');
  process.exit(bad ? 1 : 0);
}
