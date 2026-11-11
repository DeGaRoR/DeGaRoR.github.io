// CAGE ENGINE LAYER (G29, full surface G31) — the dressed engine
// (G24/G25's _eng_mesh.js) on the nose of the aeroplane.
//
// THE WHOLE BENCH PANEL IS HERE (G31, user: "too shabby" — the first cut
// exposed presets only). The parameter table is the bench's own
// (_eng_page.js GROUPS, one home, same labels and ranges); every row
// renders here with an `eng_` prefix, drops carry their VALUE tables (the
// cage stores indices, the spec gets values), and the group `show`
// predicates translate to `when`s over the effective architecture. A
// PRESET IS A STARTER, not a mode: selecting one writes its values into
// the rows ONCE (the seating-starter pattern) and everything stays
// editable after — "custom" is simply the state after you touch anything.
//
// THE GENUINE FIREWALL: the bench's plate family (fwOn, fwW/fwH, ruler,
// battery/ECU placement ON the plate) never draws here — the cage's own
// firewall is the plate. The engine is positioned so the bench's firewall
// STATION (zFw = zAft − mountGap·caseR) lands exactly on the cage's
// engine face, and — G31 — the plate DIMENSIONS handed to the builder ARE
// THE FACE'S, so the mount truss's spread, its backing pads and bolts,
// and the fuel/throttle service entries all land on the real firewall at
// its real size instead of a phantom 0.80 m plate's.
//
// THE PROP AND THE NOSE CONE ARE CHILDREN OF THE ENGINE (user ruling),
// rebased from the cowl frame onto the crank; the engine group rides the
// cowl's aperture axis so the same two offsets steer everything. NO AUTO
// COWL FITTING (user ruling): the cowl is shaped by hand around it.
//
// POLYCOUNT: the global density governor rides the polycount folder as
// `engine detail` (+ the screws LOD toggle); the five per-element side
// counts stay bench-only (user ruling, G29).
//
// Load after _eng_gen/_eng_mesh/_eng_page and after _cage_cowl; before
// _cage_ui. Chains PAGE.post.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const EM = window.ENG_MESH, EP = window.ENG_PAGE,
      CW = window.COWL_GEN, CG2 = window.CAGE2;
if (!EM || !EP || !CW || !EP.GROUPS) {
  console.error('cage engine layer: _eng_mesh/_eng_page/_cowl_gen not loaded');
  return;
}
// CABIN-CRAFT, the FIREWALL RULE (_cage_cowl.js engineFaces): a cowled pusher - or a push-pull, whose aft unit is
// one - stands on the pod's face whatever the block rows say
const cowledPusherRow = P => (P.cowlOn == null || +P.cowlOn) && [1, 4].includes(Math.round(+P.engMount || 0));

// ---- the parameter surface ------------------------------------------------
// bench keys that do NOT become rows here: the per-element polycounts
// (ruling), and the plate family (the genuine firewall owns it)
const SKIP = new Set(['quality', 'sideCyl', 'sideShaft', 'sideAcc',
                      'sidePipe', 'sideDetail', 'screws',
                      'fwOn', 'fwW', 'fwH', 'ruler']);
const ED = EP.engDefaults();
const VALS = {};                 // drop key -> value table (P stores index)
const defaults = { engOn: 1, engPreset: 0, engPower: 0,
                   engDetail: 0.8, eng_screws: ED.screws ? 1 : 0,
                   engY: 0, propOn: 1,
                   // THE MOUNT (2026-09-04): 0 nose, 1 pusher on the aft
                   // bulkhead, 2 over the wing (one engine, high wing, a pylon
                   // engPylonH tall), 3 a wing pair at engNacAt of the semispan
                   // G2790 ENGINE-CONFIGS: 4 nose + pusher (push-pull, the
                   // Skymaster), 5 nose + a wing pair (the Trimotor), 6 two
                   // wing pairs (inner at engNacAt, outer at engNacAt2)
                   engMount: 0, engNacAt: 0.35, engNacAt2: 0.62, engPylonH: 0.30, engPylonFair: 0, engPylonForm: 0, engPylonAt: 0, engPylonAft: 0.15, engPylonFwd: 0, engFinAt: 0.55, engFinFwd: 0, engNacOver: 0, engNacLift: 0,
                   // THE BLOCK (2026-09-04, the user: "when mounted on the
                   // wing, we should be able to move the whole block holding
                   // the engine, not just the engine"): fore/aft and up/down
                   // of the mount FACE itself (pylon, nacelle, engine, prop
                   // move together); and which way a wing engine faces —
                   // 0 the mount's own (over the wing pushes, a pair pulls),
                   // 1 puller, 2 pusher
                   engBlockZ: 0, engBlockY: 0, engAim: 0, engTilt: 0,
                   // THE HAND OF A PAIR (G194): 0 same hand, 1 counter-rotating
                   // tops inward (the Seneca arrangement: down-going blades
                   // inboard, no critical engine), 2 tops outward. The solver
                   // reads nothing from it yet (PROP-EFFECTS-2026-09-05.md).
                   engRotate: 0 };
for (const [, rows] of EP.GROUPS)
  for (const r of rows) {
    const [k, , m3, opts] = r;
    if (SKIP.has(k)) continue;
    if (m3 === 'drop') {
      VALS[k] = opts.map(o => o[0]);
      const i = VALS[k].indexOf(ED[k]);
      defaults['eng_' + k] = i >= 0 ? i : 0;
    } else if (m3 === 'check') defaults['eng_' + k] = ED[k] ? 1 : 0;
    else defaults['eng_' + k] = ED[k];
  }
defaults.spinMat = 0;                 // G244: the cone follows the blades
PAGE.defaults = Object.assign(defaults, PAGE.defaults || {});

// the effective architecture, for the group `show` predicates and the spec
// the powertrain row: 0 piston (the arch drop decides which), 1 electric,
// 2 turbine (2026-09-05, TURBOPROP §9 — the binary became a three-way in
// SIX places, every one through this table or familyOf below)
const POWER_ARCH = [null, 'electric', 'turbine'];
const archOf = P => POWER_ARCH[Math.round(P.engPower)]
  || (VALS.arch[Math.round(P.eng_arch)] || 'flat');
// the thermo family and the cooling an architecture + its dials imply — ONE
// keeper, because CAGE_ENG_FACTS compared these four times over with the
// piston/electric binary written out each time, and a turbine preset would
// have been classed 'four' on BOTH sides and passed GATE ENGID by accident
const familyOf = (arch, spec) => arch === 'electric' ? 'electric'
  : arch === 'turbine' ? 'turbine' : (spec.twoStroke ? 'two' : 'four');
const coolingOf = (arch, spec) => arch === 'turbine' ? 'air'
  : (arch !== 'electric' && arch === 'radial') ? 'air'   // a radial coerces
  : (spec.liquid ? 'liquid' : 'air');                    // air-cooled (G28)

// ---- the dial dict, ONE KEEPER (G134) -------------------------------------
// Every panel row, values through the drop tables — the same dict the mesh
// build has always fed engMeshBuild, factored out so the JOIN can resolve
// the SAME engine the screen shows. Two callers, one mapping: a drift here
// was a drawn engine flying different numbers, which is the whole bug this
// arc exists to close.
// THE INSTALLATION STAYS THE BUILDER'S WHATEVER THE ENGINE (the user's
// picker ruling, 2026-09-05: "the engine mount parameters for example
// should stay available, but not everything related to the engine geometry
// itself" — WIDENED 2026-09-06 to the line it was always reaching for:
// "bring back the cylinder orientation for all engines … same for the
// exhaust management, which is not part of the engine geometry … same for
// the radiator positioning, and everything apart from the block design. Be
// critical, and bring back what would be adjusted IRL without being an
// engine manufacturer").
//
// THE LINE: you BUY an engine — its case, its cylinders, its bore and
// stroke, its gearbox, its blower, its castings and covers. You BUILD the
// installation — how it is clocked in the airframe, the exhaust system, the
// air filter, the radiator and where it hangs, what is bolted to the
// accessory pad, what stands in the bay, and what reaches the firewall.
// Everything on the second list is a row on this panel under a catalogue
// engine; everything on the first would make it a DIFFERENT engine and
// stays the custom engine's.
//
// Three whole groups are installation...
const INSTALL_GROUPS = new Set(['mount + firewall', 'services (entry points)',
                                'radiator (liquid)',
                                // starter, oil filter, battery, ECU: a bay
                                // is furnished by whoever builds it
                                'engine bay']);
// ...and these rows are installation while sitting in a group that is not.
// A row here must be one NO ENGINE MAKER decides for you AND one engResolve
// does not read — an install row rides over the preset's own geometry, so a
// row that moved mass, power or the CG would silently make the certified
// name a lie (GATE ENGID §11 asserts both halves).
const INSTALL_ROWS = new Set([
  // HOW IT IS CLOCKED. Only an inline or a V has a bank to turn (a boxer
  // lies across its case, a radial is a circle), so the row is gated to
  // those in ROW_WHEN below rather than shown where it does nothing.
  'inlineAim',
  // THE EXHAUST IS NOT THE ENGINE (the user's own words). Nobody sells you
  // the pipe: stacks or a collector, how far it drops, one can or two, and
  // where the outlet leaves are made FOR THE AIRFRAME, by the builder, and
  // are the first thing changed on a real installation. A turboprop's
  // stacks are the same choice, so `stackStyle` rides here with them.
  'exStyle', 'exDrop', 'exOut', 'exAim', 'exOutX', 'exOutY', 'exOutZ', 'exPair',
  'stackStyle',
  // THE AIR FILTER, likewise a bolt-on: a canister airbox or a pair of
  // cones, or none at all. (`injected` is NOT here — carburettor or
  // injection is what the O in an O-320 means, and flipping it under a
  // catalogue name would draw an engine that is not the one named.)
  'airbox', 'airStyle',
  // THE ACCESSORY PAD AND THE HARNESS: an alternator is an option on every
  // engine in this list, electronic ignition in place of a magneto is the
  // commonest modification there is, and the leads are routed by hand
  // round whatever else the builder put there. The electric's `leads` row
  // (phase cables) is the same key and comes back with them.
  'genOn', 'mags', 'leads', 'leadR',
]);
const INSTALL_KEYS = new Set(INSTALL_ROWS);
for (const [name, rows] of EP.GROUPS)
  if (INSTALL_GROUPS.has(name)) for (const r of rows) INSTALL_KEYS.add(r[0]);
if (typeof window !== 'undefined') window.CAGE_ENG_INSTALL = INSTALL_KEYS;
// the dial dict: every row off P (`onlyInstall` = only the installation
// rows, over a base that is the preset's own geometry)
const dialSpecOfP = (P, base, onlyInstall) => {
  const spec = base || EP.engDefaults();
  for (const [, rows] of EP.GROUPS)
    for (const r of rows) {
      const k = r[0];
      if (SKIP.has(k)) continue;
      if (onlyInstall && !INSTALL_KEYS.has(k)) continue;
      const v = P['eng_' + k];
      if (v === undefined) continue;
      spec[k] = r[2] === 'drop'
        ? VALS[k][Math.max(0, Math.min(VALS[k].length - 1, Math.round(v)))]
        : (r[2] === 'check' ? (v ? 1 : 0) : v);
    }
  // the TYPE rows name the layout, catalogue or custom. A catalogue engine
  // of another layout than the type rows say is replaced by that type's
  // first entry in post (engTypeFollow), before the mesh is built
  spec.arch = archOf(P);
  return spec;
};
const engSpecOfP = (P) => {
  // A CATALOGUE ENGINE'S GEOMETRY IS ITS PRESET'S (2026-09-05, the picker
  // ruling): its geometry rows are hidden, so the dials cannot be what is
  // drawn or flown; only the installation rows are read off P. The custom
  // engine reads every row, as every engine did before this line.
  const name = PRESET_NAMES[Math.max(0, Math.min(PRESET_NAMES.length - 1,
    Math.round(P.engPreset)))];
  const catalogue = !isCustomEng(P) && !!EP.PRESETS[name];
  return catalogue ? dialSpecOfP(P, presetSpecOf(name), true)
                   : dialSpecOfP(P, null, false);
};
// G154: published so the COWL can ask what engine it is wrapping. The cowl
// layer's post runs BEFORE this one, so it cannot wait to be told — it reads
// the spec itself and resolves the envelope. One description of what the
// engine is, not two.
window.CAGE_ENG_SPEC = engSpecOfP;

// THE PRESET'S OWN DIAL DICT — applyEngPreset's write, replayed onto a fresh
// default without touching P. Row-backed keys only, drops through the same
// VALS gate: a preset key with no panel row never reaches P, so it must not
// count as a deviation either, or an untouched preset would read "modified".
const presetSpecOf = (name) => {
  const pre = EP.PRESETS[name];
  if (!pre) return null;
  const base = Object.assign(EP.engDefaults(), pre);
  const spec = EP.engDefaults();
  for (const [, rows] of EP.GROUPS)
    for (const r of rows) {
      const k = r[0];
      if (SKIP.has(k) || base[k] === undefined) continue;
      if (r[2] === 'drop') {
        if (VALS[k].indexOf(base[k]) >= 0) spec[k] = base[k];
      } else if (r[2] === 'check') spec[k] = base[k] ? 1 : 0;
      else spec[k] = base[k];
    }
  spec.arch = (base.arch === 'electric' || base.arch === 'turbine') ? base.arch
    : (VALS.arch.indexOf(base.arch) >= 0 ? base.arch : spec.arch);
  return spec;
};
// the two presets with no registry row behind them — the join's own list
// (they used to fly the A-65's numbers as a DECLARED fallback; with facts
// they fly their own resolve instead, which retires that lie)
const ENG_FANTASY = new Set(['flat twin', 'flat six']);

// THE FLOWN FACTS (G134): engResolve over the current dials, mapped to the
// spec's custom-engine row — the bench readout and the flight model finally
// read the same dict. IDENTITY FOLLOWS THE FACTS (user ruling 2026-09-01,
// "no drift, and never call an engine wrongly"):
//   - dials whose RESOLVED facts equal the applied preset's own resolve ARE
//     that engine -> return null, the join keeps the registry row, and the
//     certified name flies its certified numbers. Dress dials (fins, rocker
//     covers, exhaust style) cannot move the facts, so redecorating a 912
//     does not rename it.
//   - any physics dial deviates -> the model's numbers fly, and the name
//     says so: "modified <registry name>" while the architecture and family
//     still match the preset, "custom <arch> ..." once they do not.
//   - the two fantasy presets always fly their own resolve, named custom.
// Returns null too when there is nothing honest to ship (layer off, bench
// absent, degenerate resolve) — the registry preset then flies as before.
// PRICE is deliberately absent: resolveSpec prices an unpriced custom row
// through genEnginePrice, so the market curve has one keeper (00_registry).
window.CAGE_ENG_FACTS = (P) => {
  if (!+P.engOn) return null;
  const EG = window.ENG_GEN;
  if (!EG || !EG.engResolve) return null;
  const spec = engSpecOfP(P);
  let R;
  try { R = EG.engResolve(spec); } catch (e) { return null; }
  if (!R || !(R.powerW > 0) || !(R.mass > 0)) return null;
  const elec = R.arch === 'electric', turb = R.arch === 'turbine';
  const facts = {
    mass: R.mass, powerW: R.powerW, rpm: R.rpm,
    // the panel arc: the reduction ratio the tacho law needs (prop = rpm/gear)
    gear: R.gearRatio > 1 ? +R.gearRatio.toFixed(3)
        : (spec.geared ? (+spec.gearRatio || 1) : 1),
    torque: R.torque != null ? R.torque
      : R.powerW / (2 * Math.PI * Math.max(1, R.rpm) / 60),
    aspiration: elec ? 'electric' : turb ? 'turbine' : (R.aspiration || 'na'),
    family: familyOf(R.arch, spec),
    cooling: coolingOf(R.arch, spec),
  };
  // a turbine's own two numbers ride to the clamp (TURBOPROP §1/§8): the
  // flat-rating margin 05_atmos reads, and the bare length the engine box
  // reads
  if (turb) { facts.flatK = R.flatK; facts.length = R.env.length; }
  // where its mass sits (the cgFwd half-session, 2026-09-05): the resolve's
  // own CG aft of the flange, the number GEN_ENG_CG holds for the registry
  // rows — measured the same way, so an untouched preset and its row agree
  facts.cgAft = +(-R.cgZ).toFixed(3);
  // a blown piston's critical altitude rides to the clamp the same way
  // (the blower model, 2026-09-05)
  if (!elec && !turb && R.critAlt > 0) facts.critAlt = R.critAlt;
  // ENGINE-GAP (8 Nov, the user's DC-3 via A0: "edit it manually with the sliders"): A CUSTOM ENGINE THAT STARTED
  // FROM A CATALOGUE ENGINE (P.engFrom, written by the starter at the switch - absent on every file saved before, so
  // nothing saved moves) flies THAT ENGINE'S REGISTRY ROW, scaled by what the dials changed in the model: power and
  // mass by R / R0, the rpm likewise, and the gear, the blower and its ceiling stay the row's until their own dials
  // move. The model alone read the R-1830's own dials as 1 036 kW and a direct drive against the row's 895 kW and
  // 1.78 - the switch to edit the geometry was a 16 % jump before a single dial was touched.
  const from = engFromName(P);
  const fs0 = from ? presetSpecOf(from) : null;
  let F0 = null;
  if (fs0) { try { F0 = EG.engResolve(fs0); } catch (e) { F0 = null; } }
  const row = from ? POWERPLANTS[CAGE_JOIN_ENGINES[from]].engine : null;
  if (F0 && F0.powerW > 0 && F0.mass > 0 && R.arch === F0.arch
      && facts.family === familyOf(F0.arch, fs0) && facts.cooling === coolingOf(F0.arch, fs0)) {
    const eqF = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
    const kP = R.powerW / F0.powerW, kM = R.mass / F0.mass, kN = R.rpm / F0.rpm;
    const gearSame = (+spec.geared ? 1 : 0) === (+fs0.geared ? 1 : 0)
      && (!+spec.geared || eqF(+spec.gearRatio || 0, +fs0.gearRatio || 0));
    const blowSame = elec || turb || (R.aspiration === F0.aspiration && eqF(R.critAlt || 0, F0.critAlt || 0));
    facts.powerW = row.powerW * kP;
    facts.mass = row.mass * kM;
    facts.rpm = eqF(kN, 1) ? row.rpm : row.rpm * kN;
    if (gearSame) facts.gear = row.gear || 1;
    if (blowSame) {
      facts.aspiration = row.aspiration || facts.aspiration;
      if (row.critAlt > 0) facts.critAlt = row.critAlt; else delete facts.critAlt;
    }
    facts.torque = facts.powerW / (2 * Math.PI * Math.max(1, facts.rpm) / 60);
    const same = eqF(kP, 1) && eqF(kM, 1) && eqF(kN, 1) && gearSame && blowSame
      && Math.abs((R.cgZ || 0) - (F0.cgZ || 0)) < 0.005 && (!turb || eqF(R.flatK, F0.flatK));
    facts.name = same ? row.name : `modified ${row.name}`;
    return facts;
  }
  const psName = PRESET_NAMES[Math.max(0, Math.min(PRESET_NAMES.length - 1,
    Math.round(P.engPreset)))];
  const ps = presetSpecOf(psName);
  let R0 = null;
  if (ps) { try { R0 = EG.engResolve(ps); } catch (e) { R0 = null; } }
  const eq = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  const isPreset = R0 && eq(R.mass, R0.mass) && eq(R.powerW, R0.powerW)
    && eq(R.rpm, R0.rpm) && R.arch === R0.arch
    && facts.family === familyOf(R0.arch, ps)
    && facts.cooling === coolingOf(R0.arch, ps)
    // a turbine's margin is a physics dial too: moving it moves what flies
    && (!turb || eq(R.flatK, R0.flatK))
    // a blower is a physics dial too (2026-09-05): its kind and its ceiling
    && (elec || turb || (R.aspiration === R0.aspiration
                         && eq(R.critAlt || 0, R0.critAlt || 0)))
    // and so is WHERE THE MASS SITS (the cgFwd half-session, 2026-09-05):
    // an engine whose centre of mass moved is a different engine — a longer
    // core, a deeper accessory case — while the fins and covers cannot move it
    && Math.abs((R.cgZ || 0) - (R0.cgZ || 0)) < 0.005;
  if (isPreset && !ENG_FANTASY.has(psName)) return null;
  // deviated (or fantasy): name the thing by what it now is
  const kW = R.powerW / 1000;
  const sameKind = R0 && R.arch === R0.arch && !ENG_FANTASY.has(psName)
    && facts.family === familyOf(R0.arch, ps);
  let regName = null;
  if (sameKind && typeof CAGE_JOIN_ENGINES !== 'undefined'
      && typeof POWERPLANTS !== 'undefined') {
    const row = POWERPLANTS[CAGE_JOIN_ENGINES[psName]];
    if (row) regName = row.engine.name;
  }
  facts.name = regName ? `modified ${regName}`
    : (elec || turb) ? `custom ${R.archName} ${kW.toFixed(kW < 10 ? 1 : 0)} kW`
    : `custom ${R.archName} ${R.cyl}-cyl ${R.litres.toFixed(1)} L`;
  return facts;
};

// THE SOUND ROW (SND-ENGINE G1611, SOUND-2026-10-04 §9): what the engine
// voice needs and the registry does not hold — the cylinders, their layout and
// the stroke — read off the SAME dial dict the mesh and the facts read
// (engSpecOfP: a catalogue engine's preset geometry, the custom engine's
// dials). PHYSICS-INERT, declared: the join writes it as
// spec.engines[i].sound and nothing in the resolve or the solver reads it;
// src/viewer/audio/engine_config.js does. null for an electric or a turbine
// (no piston voice) and with the layer off.
window.CAGE_ENG_SOUND = (P) => {
  if (!+P.engOn) return null;
  const spec = engSpecOfP(P);
  if (!['flat', 'inline', 'vee', 'radial'].includes(spec.arch)) return null;
  const cyl = Math.round(+spec.cyl);
  if (!(cyl >= 1)) return null;
  const dispL = Math.PI / 4 * spec.bore * spec.bore * spec.stroke * cyl * 1000;
  return { cyl, arch: spec.arch, twoStroke: spec.twoStroke ? 1 : 0,
           dispL: isFinite(dispL) && dispL > 0 ? +dispL.toFixed(2) : null };
};

// ---- panel ----------------------------------------------------------------
// THE CATALOGUE, PLUS ONE (2026-09-05, the user's picker ruling: "either
// the user picks an existing engine (after choosing the type of engine),
// either he chooses custom engine, and the engine-related options are
// shown"). The LAST option is the custom engine — not a preset, a MODE:
// with it the geometry rows appear and the dials fly; with any catalogue
// entry the geometry IS the preset's and the registry row flies, and only
// the installation rows (mount, firewall, services, radiator) stay the
// builder's. Appended, so every saved index still names the same engine.
const CUSTOM_ENGINE = EP.CUSTOM_ENGINE || 'custom engine';
// (NEW-SHAPES-1: the saved order is ENG_PAGE.presetNames() - the custom engine keeps slot 41, the presets added since
// it took that slot follow it, so no saved index moves; the menu still lists it last, by power, PRESET_ORDER)
const PRESET_NAMES = EP.presetNames ? EP.presetNames()
  : Object.keys(EP.PRESETS).filter(n => n !== 'bare engine').concat([CUSTOM_ENGINE]);
const CUSTOM_IDX = PRESET_NAMES.indexOf(CUSTOM_ENGINE);
// SEA-OFF (SEAPLANES-LAND 8 Nov): the presets the seaplanes merge added, behind the lab switch (engPreset's optHide)
const SEA_LAB_PRESETS = ['rotax 912 iS'];
const isCustomEng = P => Math.round(P.engPreset) === CUSTOM_IDX;
// ENGINE-GAP: the catalogue engine a custom engine started from (P.engFrom, a saved preset index), or null - only on
// the custom engine, only a catalogue entry with a registry row (never the two fantasy presets)
const engFromName = P => {
  if (!isCustomEng(P) || !(+P.engFrom >= 0)) return null;
  const name = PRESET_NAMES[Math.round(+P.engFrom)];
  if (!name || name === CUSTOM_ENGINE || !EP.PRESETS[name] || ENG_FANTASY.has(name)) return null;
  if (typeof CAGE_JOIN_ENGINES === 'undefined' || typeof POWERPLANTS === 'undefined') return null;
  const key = CAGE_JOIN_ENGINES[name];
  return key && POWERPLANTS[key] && POWERPLANTS[key].engine ? name : null;
};
// the type a preset belongs to, from its own table row (null for custom)
const presetArch = name => {
  const pre = EP.PRESETS[name];
  return pre ? (pre.arch || 'flat') : null;
};
// whether the engine that is FLOWN is liquid-cooled: a catalogue engine's
// cooling is its preset's, the custom engine's is the dial's (2026-09-05 —
// the dial is hidden under a catalogue engine, and GATE PARTS rightly
// refuses a switch nothing on the panel reaches)
const liquidOf = P => isCustomEng(P) ? !!+P.eng_liquid
  : !!(EP.PRESETS[PRESET_NAMES[Math.round(P.engPreset)]] || {}).liquid;
// the layout row's labels, from the bench's own drop (VALS.arch order)
const ARCH_LABELS = (EP.GROUPS.find(g => g[0] === 'engine')[1]
  .find(r => r[0] === 'arch') || [0, 0, 0, []])[3].map(o => o[1]);
// WHAT THE OPTION SAYS (G187, the user: "all engines should show their mass
// and power, straight in the drop down"). The number quoted is THE NUMBER
// THAT FLIES: an untouched preset flies its registry row (the join's identity
// ruling), so the row's mass and powerW are the label; the two fantasy
// presets fly their own resolve, so that is theirs, marked ≈. Computed LAZILY
// and once, because _cage_join.js (the name -> registry key map) is bundled
// AFTER this file — at load time `typeof CAGE_JOIN_ENGINES` is 'undefined'
// here, at row-build time it is not. The option VALUE stays the index into
// PRESET_NAMES: every consumer of the preset (the join, the design tiles,
// the facts) keys on that and never on the text.
let PRESET_LABELS_CACHE = null;
const presetLabel = (name) => {
  if (name === CUSTOM_ENGINE) return 'custom engine · the geometry rows are yours';
  let m = 0, p = 0, approx = false;
  if (!ENG_FANTASY.has(name) && typeof POWERPLANTS !== 'undefined'
      && typeof CAGE_JOIN_ENGINES !== 'undefined') {
    const row = POWERPLANTS[CAGE_JOIN_ENGINES[name]];
    if (row && row.engine) { m = row.engine.mass; p = row.engine.powerW; }
  }
  if (!(m > 0 && p > 0)) {
    const EG = (typeof window !== 'undefined') && window.ENG_GEN;
    const ps = presetSpecOf(name);
    if (EG && EG.engResolve && ps) {
      try { const R = EG.engResolve(ps); m = R.mass; p = R.powerW; approx = true; }
      catch (e) { m = 0; p = 0; }
    }
  }
  if (!(m > 0 && p > 0)) return name;
  const kW = p / 1000;
  return `${name} · ${approx ? '≈' : ''}${m.toFixed(0)} kg · ` +
         `${approx ? '≈' : ''}${kW.toFixed(kW < 10 ? 1 : 0)} kW`;
};
const PRESET_LABELS = () => {
  if (!PRESET_LABELS_CACHE) PRESET_LABELS_CACHE = PRESET_NAMES.map(presetLabel);
  return PRESET_LABELS_CACHE;
};
if (typeof window !== 'undefined') window.CAGE_ENG_PRESET_LABELS = PRESET_LABELS;
// THE LIST READS BY POWER (2026-09-06, the user: "all engines should be
// ordered by increasing power"). The option VALUE stays the index into
// PRESET_NAMES (a saved number never changes meaning); only the ORDER the
// options are shown in follows the power that flies — the registry row's
// for a mapped preset, the resolve's own for a fantasy one — and the custom
// engine is always last. Lazy and cached, like the labels, for the same
// bundling reason.
const presetPowerOf = (name) => {
  if (name === CUSTOM_ENGINE) return Infinity;
  if (!ENG_FANTASY.has(name) && typeof POWERPLANTS !== 'undefined'
      && typeof CAGE_JOIN_ENGINES !== 'undefined') {
    const row = POWERPLANTS[CAGE_JOIN_ENGINES[name]];
    if (row && row.engine && row.engine.powerW > 0) return row.engine.powerW;
  }
  const EG = (typeof window !== 'undefined') && window.ENG_GEN;
  const ps = presetSpecOf(name);
  if (EG && EG.engResolve && ps) {
    try { return EG.engResolve(ps).powerW || 0; } catch (e) { return 0; }
  }
  return 0;
};
let PRESET_ORDER_CACHE = null;
const PRESET_ORDER = () => {
  if (!PRESET_ORDER_CACHE) {
    const pw = PRESET_NAMES.map(presetPowerOf);
    PRESET_ORDER_CACHE = PRESET_NAMES.map((_, i) => i)
      .sort((a, b) => (pw[a] - pw[b]) || (a - b));
  }
  return PRESET_ORDER_CACHE;
};
if (typeof window !== 'undefined') {
  window.CAGE_ENG_PRESET_ORDER = PRESET_ORDER;
  window.CAGE_ENG_PRESET_POWER = presetPowerOf;
}
const rowNames = r => r.k === 'material' && CW.MATERIALS
  ? CW.MATERIALS.map(mm => mm.name) : r.names;
// THE PROPELLER'S SHAFT (the user, 27 Oct: "ensure the propeller can be offset from the engine using a slider for
// length of shaft"): the cone's base off the flange IS the extension shaft - the cone grows its own hub back to the
// engine (G244), and the blades ride the cone - so the row says so, and reaches 1.5 m (an extension-shaft nose, a
// long-nosed inline); negative tucks the cone back over the flange as before
const LBL = { noseOff: 'shaft length (prop off the engine)' };
const grpItems = id => ((window.COWL_ROWS || []).find(g => g.id === id) ||
  { rows: [] }).rows
  .filter(r => CW.P[r.k] !== undefined && !DEAD_SPIN.has(r.k))
  .map(r => ['cw_' + r.k, LBL[r.k] || r.label, r.lo,
             r.k === 'material' && CW.MATERIALS ? CW.MATERIALS.length - 1
                                                : r.hi,
             r.step, rowNames(r)]);
const SPINPROP_KEYS = ['g_spin', 'g_prop'].flatMap(id =>
  ((window.COWL_ROWS || []).find(g => g.id === id) || { rows: [] })
    .rows.map(r => r.k));
// the tool's own shaft is RETIRED here (G32, user): the engine provides
// the crank and the flange — its rows go with it
const DEAD_SPIN = new Set(['shaftR', 'shaftLen']);

// A ROW THAT ONLY MEANS SOMETHING ON SOME LAYOUTS SAYS SO (2026-09-06).
// The aim row turns a BANK, and only an inline or a V has one to turn:
// `flat.angles` is ±90 by construction and `radial.angles` is a circle, so
// on those two the drop has always moved nothing — it was as silent under
// the custom engine as it would now be under a catalogue one, and a row
// that cannot change the aeroplane is not a row.
const ROW_WHEN = {
  inlineAim: P => archOf(P) === 'inline' || archOf(P) === 'vee',
  // G2802 (AVIONICS-GPS phase 2, E4): THE BAY'S ELECTRICS ARE THE FIT'S. With the Instruments layer present the
  // battery box, the generator and the starter are drawn from its electrics (bayElec below), so these three rows
  // would be switches that do nothing: they stand only where there is no fit to follow (a page without the panel)
  battOn: P => !bayElec(),
  genOn: P => !bayElec(),
  starter: P => !bayElec(),
};
// what the fit puts in the bay - battery / generator / starter, from the Instruments column's resolved electrics
// (genSystemsResolve's own parts: GEN_ELEC_PARTS), or null with no panel layer (the rows then stand as they were)
function bayElec() {
  const CP = window.CAGE_PANEL;
  if (!CP || typeof CP.resolve !== 'function') return null;
  let R = null;
  try { R = CP.resolve(); } catch (e) { return null; }
  if (!R || !R.elec) return null;
  const part = k => (R.parts || []).find(q => q.key === k) || null;
  return { battOn: R.elec.battery !== 'none' ? 1 : 0, genOn: R.elec.alternator !== 'none' ? 1 : 0,
           starter: R.elec.starter === 'yes' ? 1 : 0, batt: part('battery'), gen: part('alternator') };
}
// bench groups -> cage subgroups, every row, same labels + ranges
const engRow = r => {
  const [k, label, m3, a, b, ] = r;
  if (m3 === 'drop')
    return ['eng_' + k, label, 0, Math.max(1, a.length - 1), 1,
            a.map(o => o[1])];
  if (m3 === 'check') return ['eng_' + k, label, 0, 1, 1];
  return ['eng_' + k, label, m3, a, b];
};
const BENCH_SUBS = [];
for (const g of EP.GROUPS) {
  const [name, rows, show] = g;
  if (name === 'polycount') continue;      // engDetail + screws live in
                                           // the page's own polycount folder
  // the layout row moved to the trunk (2026-09-05): it is a TYPE row now
  const items = rows.filter(r => !SKIP.has(r[0]) && r[0] !== 'arch').map(engRow);
  if (!items.length) continue;
  let when = P => +P.engOn;
  if (show === EP.isElec) when = P => +P.engOn && archOf(P) === 'electric';
  else if (show === EP.isTurbine) when = P => +P.engOn && archOf(P) === 'turbine';
  else if (show === EP.isPiston)
    when = P => +P.engOn && archOf(P) !== 'electric' && archOf(P) !== 'turbine';
  // the radiator only exists on a liquid engine, and a radial coerces
  // air-cooled (G28 audit discipline, applied to the import); a turbine has
  // an oil cooler in the cowl and no radiator
  // THE RADIATOR FOLLOWS THE ENGINE THAT IS FLOWN (2026-09-05, the picker
  // ruling): `liquidOf`, not the dial — see it
  if (name === 'radiator (liquid)')
    when = P => +P.engOn && archOf(P) !== 'electric' && archOf(P) !== 'turbine' &&
                archOf(P) !== 'radial' && liquidOf(P);
  // THE GEOMETRY IS THE CUSTOM ENGINE'S, ROW BY ROW (2026-09-05's ruling,
  // widened 2026-09-06): a catalogue engine keeps every installation row
  // and hides only the ones that would make it a different engine.
  //
  // PER ROW AND NEVER PER GROUP, because three of these groups are MIXED —
  // the exhaust sits beside the injection, the alternator beside the oil
  // filler — and BOTH HOSTS hide a group's rows through the group's own
  // `when`: the accordion by DOM containment, the game's inspector through
  // the `inherited` rules it captures before it moves the rows out. A group
  // rule would take the installation rows down with the geometry, which is
  // exactly the bug this widening exists to fix.
  for (const it of items) {
    const k = it[0].slice(4);                    // the 'eng_' prefix back off
    const own = ROW_WHEN[k] || null;
    if (INSTALL_KEYS.has(k)) { if (own) it.push({ when: own }); continue; }
    it.push(own ? { when: P => own(P) && isCustomEng(P) }
                : { when: isCustomEng });
  }
  BENCH_SUBS.push([name === 'engine' ? 'engine geometry' : name,
                   items, { when }]);
}

const ENG_ITEMS = [
  ['engOn',     'engine',        0, 1, 1],
  ['engPower',  'powertrain',    0, 2, 1, ['piston', 'electric', 'turbine'],
   { when: P => +P.engOn }],
  // THE TYPE ROW (2026-09-05, the picker ruling): the layout is chosen
  // BEFORE the engine, so it sits in the trunk rather than among the
  // geometry rows it used to hide in. Same key, same drop table.
  ['eng_arch',  'layout', 0, Math.max(1, ARCH_LABELS.length - 1), 1,
   ARCH_LABELS, { when: P => +P.engOn && Math.round(P.engPower) === 0 }],
  // THE ENGINE: this type's catalogue, or the custom engine. A catalogue
  // pick is a starter for the dials (the seating-starter pattern) AND a
  // mode — its geometry rows stay hidden and its registry row flies;
  // `optHide` folds the other types' entries away.
  ['engPreset', 'engine', 0,
   Math.max(1, PRESET_NAMES.length - 1), 1, PRESET_NAMES,
   { when: P => +P.engOn, optLabels: PRESET_LABELS, optOrder: PRESET_ORDER,
     // (SEA-OFF, SEAPLANES-LAND 8 Nov: the merge's own engine - the Super Petrel's Rotax 912 iS, HULL-B49 - stands behind
     // the lab switch as its rows do, shown on a build that holds it)
     optHide: P => { let lab = true; try { lab = !window.CAGE_RETRACT_LAB || !!window.CAGE_RETRACT_LAB(); } catch (e) {}
       const cur = PRESET_NAMES[Math.round(+P.engPreset || 0)];
       return PRESET_NAMES.map(n => (n !== CUSTOM_ENGINE && presetArch(n) !== archOf(P)) ||
                                    (!lab && SEA_LAB_PRESETS.includes(n) && n !== cur)); } }],
  ['engMount',  'mount', 0, 8, 1,
   ['nose', 'pusher (aft bulkhead)', 'over the wing (high wing)',
    'wing nacelles (twin)', 'nose + pusher (push-pull)',
    'nose + wing nacelles (three)', 'two pairs of wing nacelles (four)',
    'push-pull on one pylon (tandem)', 'on the fin'],
   // SEA-OFF (SEAPLANES-LAND 8 Nov): the tandem (7) and the fin (8) stand behind the lab switch (_cage_gear.js
   // RETRACT_LAB), shown on a build that holds them
   { when: P => +P.engOn,
     optHide: P => { let lab = true; try { lab = !window.CAGE_RETRACT_LAB || !!window.CAGE_RETRACT_LAB(); } catch (e) {}
       return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => i >= 7 && !lab && Math.round(+P.engMount || 0) !== i); } }],
  ['engAim',    'faces', 0, 2, 1, ['as the mount', 'puller', 'pusher'],
   { when: P => +P.engOn && [2, 3, 5, 6].includes(Math.round(P.engMount)) }],   // (a tandem's aims are its own)
  ['engNacAt',  'nacelle station (semispan)', 0.15, 0.70, 0.01,
   { when: P => +P.engOn && [3, 5, 6].includes(Math.round(P.engMount)) }],
  // G2790: the four's outer pair (kept 0.10 of the semispan outboard of
  // the inner one by engineFaces)
  ['engNacAt2', 'outer nacelle station (semispan)', 0.30, 0.90, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) === 6 }],
  // HULL-B8: the wing nacelles OVER the wing - on its top skin, or lifted on a pylon (_cage_cowl.js engineFaces)
  // (HULL-B30: 'on the rear fuselage' - the Be-103's: each nacelle on a stub pylon from the fuselage's side behind the wing)
  ['engNacOver', 'nacelles', 0, 2, 1, ['through the wing', 'over the wing (on the skin)', 'on the rear fuselage (stub pylons)'],
   { when: P => +P.engOn && [3, 5, 6].includes(Math.round(P.engMount)) }],
  ['engNacLift', 'nacelle pylon height', 0, 1.0, 0.01,
   { when: P => +P.engOn && [3, 5, 6].includes(Math.round(P.engMount)) && +P.engNacOver > 0, dim: 'm' }],
  ['engRotate',  'rotation (pair)', 0, 2, 1,
   ['same hand', 'counter-rotating, tops inward', 'counter-rotating, tops outward'],
   { when: P => +P.engOn && [3, 5, 6].includes(Math.round(P.engMount)) }],
  // ...on the pusher too (G461, the Chinook: its engine sits over the wing's
  // trailing edge, ahead of the pod's aft face — _cage_cowl engineFaces)
  // (CABIN-CRAFT, the FIREWALL RULE - _cage_cowl.js: a cowled pusher, or a push-pull's aft unit, stands on the pod's
  // face; fore / aft it is the stand (eng_mountGap) and the cowl length, so the block rows go where they move nothing)
  ['engBlockZ', 'block fore / aft', -1.0, 2.0, 0.01,   // DC3-EDITABLE: the DC-3's block sits at 1.0
   { when: P => +P.engOn && Math.round(P.engMount) >= 1 && !cowledPusherRow(P), dim: 'm' }],
  ['engBlockY', 'block up / down', -0.6, 0.8, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) >= 1 && !cowledPusherRow(P), dim: 'm' }],
  ['engPylonH', 'pylon height', 0.05, 1.5, 0.01,
   { when: P => +P.engOn && [2, 7].includes(Math.round(P.engMount)), dim: 'm' }],
  // G3913: the pylon's mount - the bars with their cables, or a fairing over them (slab-sided, or a wing section)
  // HULL-B22: the fin engine's height on the fin (of its height)
  // (HULL-B34: to 1 - on the fin's top; below, the nacelle crosses the fin at that height)
  ['engFinFwd', 'on the fin, engine forward of it', 0, 1.5, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) === 8, dim: 'm' }],
  ['engFinAt', 'on the fin, at (of its height; 1 = on top)', 0.2, 1.0, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) === 8 }],
  // HULL-B17: WHERE the over-the-wing pylon stands - on the wing (its centre section, or the cabin roof between the roots)
  // or on the fuselage BEHIND THE CABIN (the Icon's), engPylonAft behind the trailing edge
  ['engPylonAt', 'pylon stands on', 0, 1, 1, ['the wing', 'the fuselage, behind the cabin'],
   { when: P => +P.engOn && Math.round(P.engMount) === 2 }],
  // (HULL-B37: negative = forward of the trailing edge, the nacelle into the wing - the Super Petrel's tower)
  ['engPylonAft', 'behind the trailing edge', -1.5, 1.5, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) === 2 && Math.round(+P.engPylonAt || 0) === 1, dim: 'm' }],
  // HULL-B52 (the user, the Super Petrel: "without moving the engine, move its pylon 50 cm back, so it sits well below
  // the wing it supports, but still on the cowl/nacelle assembly"): the pylon's feet and body FORWARD of the engine's
  // own mount station (negative aft) - the engine stays where engPylonAft puts it, its height over the roof there
  ['engPylonFwd', 'pylon forward of the engine', -0.6, 0.8, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) === 2 && Math.round(+P.engPylonAt || 0) === 1, dim: 'm' }],
  // HULL-B14: the pylon's FORM - the V legs (to both roots) or one wing-section blade on the centreline (flown so)
  ['engPylonForm', 'pylon form', 0, 1, 1, ['V legs', 'single blade'],
   { when: P => +P.engOn && ([2, 7].includes(Math.round(P.engMount)) || (+P.engNacOver > 0 && +P.engNacLift > 0.02)) }],
  ['engPylonFair', 'pylon', 0, 3, 1, ['bars + cables', 'fairing', 'wing-section fairing', 'blended fairing'],
   { when: P => +P.engOn && ([2, 7].includes(Math.round(P.engMount)) || (+P.engNacOver > 0 && +P.engNacLift > 0.02)) }],
  // G250: the label says what the row is — the THRUST LINE. It moves the
  // engine vertically, so the CG line in the room does not move (the user
  // read "the engine stand barely moves the CG" off exactly this slider);
  // fore-aft on a pod is `eng_mountGap`, on a block `engBlockZ`.
  ['engY',      'up / down (thrust line)', -0.5, 0.5, 0.005,
   { when: P => +P.engOn, dim: 'm' }],
  // G477 (the Chinook, the user: "it probably needs the ability to tilt the
  // engine with regards to the frame"): the thrust line's TILT, degrees,
  // downthrust positive — the unit turns about its lateral axis on the
  // mount, the join writes engines[].tilt, the solver turns the force
  ['engTilt',   'thrust line tilt (downthrust +)', -15, 15, 0.5,
   { when: P => +P.engOn, dim: 'deg' }],
  ...BENCH_SUBS,
  ['propOn',    'propeller',     0, 1, 1, { when: P => +P.engOn }],
  ['nose cone', grpItems('g_spin').concat([
    // G244: its own material, or the blades' (0). Same table, same index
    // meaning, one entry longer at the front.
    ['spinMat', 'cone material', 0, (CW.MATERIALS || []).length, 1,
     ['as the blades'].concat((CW.MATERIALS || []).map(m => m.name))],
  ]), { when: P => +P.engOn }],
  ['propeller', grpItems('g_prop'),
   { when: P => +P.engOn && +P.propOn }],
];
const host = (PAGE.groupsOverride || []).find(g => g[0] === '2 · engine');
if (host) host[1].push(...ENG_ITEMS);
else (PAGE.groupsOverride || (PAGE.groups = PAGE.groups || []))
  .push(['2c · engine', ENG_ITEMS]);
const poly = (PAGE.groupsOverride || []).find(g => g[0] === 'polycount');
if (poly) poly[1].push(
  ['engDetail', 'engine detail', 0.3, 2, 0.02, { when: P => +P.engOn }],
  ['eng_screws', 'engine screws', 0, 1, 1, { when: P => +P.engOn }]);

// ---- materials ------------------------------------------------------------
// AEROSKIN (G70). The engine bench's palette is its PARTS LIST — one colour
// per module material, so the legend and the model agree — and G25 dressed
// thirty of them. `AERO_HARD.eng` says what each one is made of; the colour
// on the row is still the colour. An engine is also the closest the camera
// ever gets to any surface here, which is why the cast finish is the one row
// in the table with the smallest tile.
const AKM = () => (typeof window !== 'undefined' && window.AEROSKIN) || null;
const matCache = {};
// WHICH ENGINE PARTS THE BUILDER PAINTS (G113.4). Everything else in
// AERO_HARD.eng stays hardware — a spark plug is chrome and a lead is rubber,
// and those are not choices. What IS a choice is the way an engine is
// finished: the crankcase and its castings in one colour, the cylinders in
// another, the rocker covers as the accent. Three groups, and every part in
// AERO_HARD.eng that is not named here keeps the material the table gives it.
const ENG_SEC = {
  emCase: 'engBlock', emRidge: 'engBlock', emSump: 'engBlock',
  emAcc: 'engBlock', emPad: 'engBlock',
  emBarrel: 'engJug', emFin: 'engJug', emHead: 'engJug',
  emRocker: 'engCover',
  // G156: the braces. `emPuck` stays out — a rubber mount puck is rubber for
  // what it does, and `emFirewall` is the airframe's, not the engine's.
  emMount: 'engMount',
};
// G3913: THE PYLON'S MOUNT (the user, 4 Nov: "the pylon should definitely have a nice shape. By default, it will be
// a couple of bars anchored below ... This will be the mount, and this will be able to get a fairing, wing shaped, or
// not ... You may even draw a few cables between the pillars of the mount, hidden if fairing is selected"). The box it
// was is gone: a rail frame under the engine's mount plate, two legs a side from its ends down to the wing's top
// skin at the root's front and rear spar stations (the face's `foot`; the frame braces the pylon's pair to both
// roots' spars - drawn where it is flown), and
//   engPylonFair 0  bracing CABLES: an X in each side's plane, an X across the front and the rear legs;
//                1  a FAIRING over the legs, slab-sided (a rounded box section lofted from the feet to the plate);
//                2  a WING-SECTION fairing (a symmetric 18 % aerofoil, chord fore / aft), the cables hidden.
// The fairing tapers from the feet's spread to the plate's width; cage metres, the layer's own frame.
const PYLON_R = 0.021, PYLON_RAIL = 0.016, PYLON_CABLE = 0.0022;
// HULL-B16: THE BLENDED FAIRING (engPylonFair 3, the user: "you keep that one because it's great, but another option
// would be ... an aero-fitted one ... the nuclear power plant chimney shape ... a flat surface at the bottom and a flat
// surface at the top ... wider at the base"): the fin section held up the height, and a FILLET at each end - a quarter
// circle added to the half-thickness (and 1.2 x it to the chord) that reaches the wing and the nacelle tangent, flat to
// them: PYLON_FIL_B at the wing, PYLON_FIL_T at the nacelle (metres; at most a share of the height). The plain
// fairings (1, 2) and the plain blade stay as they were
const PYLON_FIL_B = 0.20, PYLON_FIL_T = 0.11;
const filletAt = (d, R) => d >= R ? 0 : R - Math.sqrt(Math.max(0, R * R - (R - d) * (R - d)));
// HULL-B38: THE PYLON THAT HUGS (the user, 5 Nov: "Its main section should always remain straight, we never rotate
// the whole thing. It should sample surface below and on top to build an accurate mesh qui epouse the shape of the
// fuselage, whatever it is. A joint will be drawn, helping with the possibly tricky fit, masking the seams").
//   THE BODY is a PRISM: one plan section (an aerofoil, chord fore / aft; the slab's rounded box) on a FIXED axis -
//   vertical under the plate; a V leg's panel on its leg's line in the cross plane at the plate's station (it leans
//   out to its feet, never fore / aft) - never swept on a path from the feet to the plate, so moving the engine never
//   leans it. Each vertex of the section is a COLUMN on that axis, run down to the first surface below it and up to
//   the first surface above it, each found by a RAY (pylonCaster): the body's drawn skin (cageAirframe's skin faces,
//   as built - a roof, a canopy's back, a taper's deck), every wing plane's skin (a biplane's lower wing under it,
//   the upper wing's lower skin over it - where the nacelle crosses the wing) and the nacelle's drawn shell (the cowl
//   layer's meshes, drawn before this layer). So the base follows whatever it stands on and the top whatever it
//   carries, column by column; no nacelle (a bare engine on its plate) and the top is the plate, its fairing over it.
//   THE BLENDED FAIRING (3) keeps its chimney: the HULL-B16 quarter circles at both ends, each row of a flare its own
//   height off the surface under ITS OWN plan position, so the skirt follows a convex deck instead of diving under it.
//   THE JOINT at each end: a fillet strip (PYLON_JOINT wide) from the wall a joint's width from the end (along the
//   body - round a flare's arc), round the corner, onto the surface just outside the foot, its middle a bead - in its
//   own material, the rubber seal's (emPuck): it masks the seam a sampled fit leaves between columns.
//   Bars + cables (0) keep their tubes and feet.
const PYLON_JOINT_B = 0.03, PYLON_JOINT_T = 0.022, PYLON_SINK = 0.006, PYLON_BEAD = 0.009;
// the section's outline, [u across, w fore (+) / aft], NS points round from the leading edge; `e` the flare (metres)
const PYLON_NS = 36;
function pylonOutline(kind, c, th, hw, e) {
  const pts = [];
  for (let k = 0; k < PYLON_NS; k++) {
    const ang = 2 * Math.PI * k / PYLON_NS, ca = Math.cos(ang), sa = Math.sin(ang);
    if (kind === 'slab') {
      pts.push([(hw + e) * Math.sign(sa) * Math.pow(Math.abs(sa), 0.6), 0.5 * (c + 1.2 * e) * Math.sign(ca) * Math.pow(Math.abs(ca), 0.35)]);
    } else {
      const c2 = c + 1.2 * e, th2 = (th * c + 2 * e) / c2, xc = 0.5 * (1 - ca);
      const yt = 5 * th2 * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
      pts.push([(sa >= 0 ? 1 : -1) * yt * c2, (0.5 - xc) * c2]);
    }
  }
  return pts;
}
// THE RAYS: what a pylon stands on (kind 'body', 'wing') and what it carries ('cowl', 'wing'), cage metres (the layer's
// frame). ONE LOCAL TRIANGLE SOUP, kept to the pylon's neighbourhood `near` [x0, x1, z0, z1]: the body's drawn skin
// (cageAirframe's skin faces, as built - its cut-part rule), every wing plane's skin (the probe geometries the wing layer
// publishes, skinGeos) and the nacelle's shells as drawn (the cowl layer's meshes, not their dark inner twins). The rays
// of one body all run along one axis, so the soup is INDEXED per axis: each triangle in the cells of a PYLON_CELL grid
// across the axis that its shadow covers - a ray tests the few in its own cell (measured: 0.4-0.8 s a pylon brute
// force over the meshes, the editor's every slider drag). cast(o, d, kinds, far) -> the nearest hit { t, p } along
// the unit direction d, or null
const PYLON_CELL = 0.04;
function pylonCaster(ctx, FS, near) {
  const { scene, mesh } = ctx, TA = [], TK = [];       // TA: 9 numbers a triangle; TK: its kind
  const inNear = (a, b, c) => !(Math.max(a[0], b[0], c[0]) < near[0] || Math.min(a[0], b[0], c[0]) > near[1] ||
                                Math.max(a[2], b[2], c[2]) < near[2] || Math.min(a[2], b[2], c[2]) > near[3]);
  const put = (a, b, c, k) => { if (inNear(a, b, c)) { TA.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); TK.push(k); } };
  const MATS = window.GEAR_GEN && window.GEAR_GEN.CAGE_MATS;
  if (mesh && mesh.V && mesh.F && MATS)
    for (const f of mesh.F) {
      if (!f || !f.v || f.v.length < 3 || !MATS.has(f.m)) continue;
      const co = f.cutOff || [0, 0, 0];
      const q = f.v.map(i => [(mesh.V[i][0] - co[0]) * FS, (mesh.V[i][1] - co[1]) * FS, (mesh.V[i][2] - co[2]) * FS]);
      for (let t = 1; t + 1 < q.length; t++) put(q[0], q[t], q[t + 1], 'body');
    }
  const fromGeo = (g, M, k) => {
    const pa = g && g.attributes && g.attributes.position; if (!pa) return;
    const ix = g.index, n = ix ? ix.count : pa.count, v = THREE.Vector3 ? new THREE.Vector3() : null;
    const P3 = i => { if (!M || !v) return [pa.getX(i), pa.getY(i), pa.getZ(i)]; v.set(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(M); return [v.x, v.y, v.z]; };
    for (let t = 0; t + 2 < n; t += 3) put(P3(ix ? ix.getX(t) : t), P3(ix ? ix.getX(t + 1) : t + 1), P3(ix ? ix.getX(t + 2) : t + 2), k);
  };
  const W0 = window.CAGE_WING, planes = W0 ? (W0.planes || [W0]) : [];
  for (const pl of planes) for (const g of (pl.skinGeos || [])) fromGeo(g, null, 'wing');
  let cowl = false;
  if (scene) {
    scene.updateMatrixWorld(true);
    for (const top of scene.children) if (top.name === 'cageLayer:cowl')
      top.traverse(m => { if (m.isMesh && m.geometry && !(m.userData && m.userData.innerTwin)) { cowl = true; fromGeo(m.geometry, m.matrixWorld, 'cowl'); } });
  }
  const nT = TK.length, IDX = new Map();
  const indexFor = d => {                                 // one grid per axis (either way along it)
    const s = (d[1] < -1e-9 || (Math.abs(d[1]) <= 1e-9 && (d[0] < 0 || (d[0] === 0 && d[2] < 0)))) ? -1 : 1;
    const a = d.map(x => x * s), key = a.map(x => x.toFixed(5)).join();
    let I = IDX.get(key);
    if (I) return I;
    let e1 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const dd = e1[0] * a[0] + e1[1] * a[1] + e1[2] * a[2];
    e1 = [e1[0] - dd * a[0], e1[1] - dd * a[1], e1[2] - dd * a[2]];
    const l1 = Math.hypot(...e1); e1 = e1.map(x => x / l1);
    const e2 = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
    const cell = new Map(), pj = (x, y, z) => [Math.floor((x * e1[0] + y * e1[1] + z * e1[2]) / PYLON_CELL), Math.floor((x * e2[0] + y * e2[1] + z * e2[2]) / PYLON_CELL)];
    for (let i = 0; i < nT; i++) {
      const o = 9 * i, A = pj(TA[o], TA[o + 1], TA[o + 2]), B = pj(TA[o + 3], TA[o + 4], TA[o + 5]), C = pj(TA[o + 6], TA[o + 7], TA[o + 8]);
      const i0 = Math.min(A[0], B[0], C[0]), i1 = Math.max(A[0], B[0], C[0]), j0 = Math.min(A[1], B[1], C[1]), j1 = Math.max(A[1], B[1], C[1]);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4000) continue;  // (a sliver along the axis: no shadow to hit)
      for (let ii = i0; ii <= i1; ii++) for (let jj = j0; jj <= j1; jj++) { const k = ii + ',' + jj; let L = cell.get(k); if (!L) cell.set(k, L = []); L.push(i); }
    }
    I = { pj, cell };
    IDX.set(key, I);
    return I;
  };
  const rayTri = (o, d, i) => {                          // Moller-Trumbore, both faces
    const q = 9 * i, a0 = TA[q], a1 = TA[q + 1], a2 = TA[q + 2];
    const e10 = TA[q + 3] - a0, e11 = TA[q + 4] - a1, e12 = TA[q + 5] - a2, e20 = TA[q + 6] - a0, e21 = TA[q + 7] - a1, e22 = TA[q + 8] - a2;
    const p0 = d[1] * e22 - d[2] * e21, p1 = d[2] * e20 - d[0] * e22, p2 = d[0] * e21 - d[1] * e20;
    const det = e10 * p0 + e11 * p1 + e12 * p2;
    if (Math.abs(det) < 1e-14) return -1;
    const s0 = o[0] - a0, s1 = o[1] - a1, s2 = o[2] - a2, u = (s0 * p0 + s1 * p1 + s2 * p2) / det;
    if (u < 0 || u > 1) return -1;
    const q0 = s1 * e12 - s2 * e11, q1 = s2 * e10 - s0 * e12, q2 = s0 * e11 - s1 * e10;
    const v = (d[0] * q0 + d[1] * q1 + d[2] * q2) / det;
    if (v < 0 || u + v > 1) return -1;
    return (e20 * q0 + e21 * q1 + e22 * q2) / det;
  };
  return {
    cowl,
    cast(o, d, kinds, far) {
      const I = indexFor(d), c = I.pj(o[0], o[1], o[2]), L = I.cell.get(c[0] + ',' + c[1]);
      if (!L) return null;
      let bt = Infinity;
      for (const i of L) {
        if (!kinds.includes(TK[i])) continue;
        const t = rayTri(o, d, i);
        if (t > 1e-4 && t <= far && t < bt) bt = t;
      }
      return isFinite(bt) ? { t: bt, p: [o[0] + d[0] * bt, o[1] + d[1] * bt, o[2] + d[2] * bt] } : null;
    },
  };
}
// ONE HUGGING BODY: the outline `out(e)` on the axis `ax` (unit, pointing to the top) through O, its in-plane basis
// eu (across) and ew (fore). Every vertex is cast for from O's level, down for kinds `dn` and up for kinds `up`, AT ITS
// OWN PLAN POSITION: a plain prism's two ends sit on what is under and over each column; a flare's rows (the HULL-B16
// quarter circle, radii fB / fT) stand their own height off the surface under THEIR position, so the skirt follows a
// convex deck instead of diving under it. `top0` / `bot0` the ends (a distance along ax from O) where a ray finds
// nothing. Draws the body into `bag`, the two joints into `jbag`; `topJoint` false = no joint at the top (a bare plate)
function pylonHug(bag, jbag, C, o) {
  const { O, ax, eu, ew, dn, up, top0, bot0 } = o;
  let { fB, fT, out } = o;
  const at = (uw, t) => [O[0] + eu[0] * uw[0] + ew[0] * uw[1] + ax[0] * t, O[1] + eu[1] * uw[0] + ew[1] * uw[1] + ax[1] * t,
                         O[2] + eu[2] * uw[0] + ew[2] * uw[1] + ax[2] * t];
  const neg = ax.map(v => -v), FAR = 4;
  const below = uw => { const h = C.cast(at(uw, 0), neg, dn, FAR); return h ? -h.t : null; };
  const above = uw => { const h = C.cast(at(uw, 0), ax, up, FAR); return h && h.t < top0 + 0.6 ? h.t : null; };
  // THE CHORD FITS WHAT IT JOINS: along the section's chord line, the run around its middle with a surface under it
  // and (a nacelle over it) a surface over it; a chord longer than that run - a wing nacelle's pylon reaching past the
  // leading edge and the cowl - is shortened to it, 3 cm inside each end, and centred on it (never under 40 % of
  // itself). The section stays a prism on its axis; its thickness is kept
  {
    const base = out(0), wl = Math.max(...base.map(p => p[1])), wt = Math.min(...base.map(p => p[1])), N = 40;
    const ok = [];
    for (let i = 0; i <= N; i++) { const uw = [0, wt + (wl - wt) * i / N]; ok.push(below(uw) != null && (!o.topJoint || above(uw) != null)); }
    if (ok.some(v => !v) && ok.some(v => v)) {
      let m = N >> 1;
      if (!ok[m]) { let d = 1; while (!ok[m + d] && !ok[m - d]) d++; m = ok[m + d] ? m + d : m - d; }
      let a = m, b = m;
      while (a > 0 && ok[a - 1]) a--;
      while (b < N && ok[b + 1]) b++;
      const wa = wt + (wl - wt) * a / N + 0.03, wb = wt + (wl - wt) * b / N - 0.03;
      const sc = Math.max(0.4, (wb - wa) / (wl - wt)), wm = 0.5 * (wa + wb), wc = 0.5 * (wl + wt), out0 = out;
      out = e => out0(e).map(p => [p[0], wm + sc * (p[1] - wc)]);
    }
  }
  // a flare's rows: the quarter circle from its foot (j 0: the full flare, on the surface) to the plain wall
  const arc = (R, n) => R > 0 ? Array.from({ length: n + 1 }, (_, j) => { const th = 0.5 * Math.PI * j / n;
    return { e: R * (1 - Math.sin(th)), d: R * (1 - Math.cos(th)) }; }) : [{ e: 0, d: 0 }];
  const aB = arc(fB, 7), aT = arc(fT, 6);
  // the column ends at the plain wall's foot first: the fallback for a flare's ray that finds nothing
  const sec0 = out(0), bot = [], topE = [];
  for (let k = 0; k < PYLON_NS; k++) { const b = below(sec0[k]), t = above(sec0[k]); bot.push(b); topE.push(t); }
  const okB = bot.filter(t => t != null), lowB = okB.length ? Math.min(...okB) : bot0;
  for (let k = 0; k < PYLON_NS; k++) { if (bot[k] == null) bot[k] = Math.min(bot0, lowB); if (topE[k] == null) topE[k] = top0; }
  // A FLARE FITS WHAT IT MEETS: its foot (the full flare's outline) must land on the surface within a slope of one
  // (its own radius, plus 2 cm) of the wall's end in every column - a nacelle's underside curving up its flanks, a
  // narrow deck falling away - or it shrinks (x 0.6, three times, then none)
  const fits = (R, end) => {
    if (R <= 0) return true;
    const sec = out(R);
    for (let k = 0; k < PYLON_NS; k++) {
      const s2 = end < 0 ? below(sec[k]) : above(sec[k]), e0 = end < 0 ? bot[k] : topE[k];
      if (s2 == null || Math.abs(s2 - e0) > R + 0.02) return false;
    }
    return true;
  };
  for (let i = 0; i < 4 && !fits(fB, -1); i++) fB = i < 3 ? 0.6 * fB : 0;
  for (let i = 0; i < 4 && !fits(fT, 1); i++) fT = i < 3 ? 0.6 * fT : 0;
  const rows = [], meta = [];
  const ring = (a, end) => {
    const sec = out(a.e), row = [], ts = [];
    for (let k = 0; k < PYLON_NS; k++) {
      const s = a.e > 0 ? (end < 0 ? below(sec[k]) : above(sec[k])) : null;
      const base = s != null ? s : (end < 0 ? bot[k] : topE[k]);
      let t = end < 0 ? base + a.d : base - a.d;
      if (a.d === 0) t += end < 0 ? -PYLON_SINK : PYLON_SINK;                // the very ends sunk into what they meet
      ts.push(t); row.push([sec[k], t]);
    }
    return { row, ts };
  };
  for (const a of aB) rows.push(ring(a, -1));
  for (let j = aT.length - 1; j >= 0; j--) rows.push(ring(aT[j], 1));
  // a short column: the top's plain wall never below the bottom's
  const wB = rows[aB.length - 1], wT = rows[aB.length];
  for (let k = 0; k < PYLON_NS; k++) if (wT.ts[k] < wB.ts[k]) { wT.ts[k] = wB.ts[k]; wT.row[k][1] = wB.ts[k]; }
  const ids = rows.map(r => r.row.map(([uw, t]) => bag.v(at(uw, t))));
  for (let i = 0; i + 1 < ids.length; i++)
    for (let k = 0; k < PYLON_NS; k++) {
      const k2 = (k + 1) % PYLON_NS;
      bag.quad(ids[i][k], ids[i][k2], ids[i + 1][k2], ids[i + 1][k]);
    }
  // nothing over the top (a bare engine on its plate): the top is CLOSED, a flat cap on its own vertices
  if (!o.topJoint) {
    const ring = rows[rows.length - 1].row.map(([uw, t]) => at(uw, t)), n = ring.length;
    const c = [0, 1, 2].map(a => ring.reduce((m, p) => m + p[a], 0) / n);
    const e1 = ring[0].map((v, a) => v - c[a]), e2 = ring[1].map((v, a) => v - c[a]);
    const up = (e1[1] * e2[2] - e1[2] * e2[1]) * ax[0] + (e1[2] * e2[0] - e1[0] * e2[2]) * ax[1] + (e1[0] * e2[1] - e1[1] * e2[0]) * ax[2];
    const ic = bag.v(c), iv = ring.map(p => bag.v(p));
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; if (up >= 0) bag.tri(ic, iv[k], iv[k2]); else bag.tri(ic, iv[k2], iv[k]); }
  }
  // THE JOINTS: a fillet strip round each end. The wall point a joint's width from the end ALONG the body (up a plain
  // wall, round a flare's arc), the corner the end itself, the outer edge the surface a joint's width outside it (its
  // own ray); a quadratic Bezier through them, its middle a bead PYLON_BEAD off what it lies on
  const strip = (end, R, Rf) => {
    const sec = out(Rf), NJ = 5, rg = [];
    const th = Rf > 0 ? Math.min(R / Rf, 0.5 * Math.PI) : 0, eW = Rf > 0 ? Rf * (1 - Math.sin(th)) : 0;
    const dW = Rf > 0 ? Rf * (1 - Math.cos(th)) : R, secW = out(eW), dir = end < 0 ? 1 : -1;
    const surf = (uw, k) => { const s = end < 0 ? below(uw) : above(uw); return s != null ? s : (end < 0 ? bot[k] : topE[k]); };
    for (let k = 0; k < PYLON_NS; k++) {
      const pa = sec[(k + PYLON_NS - 1) % PYLON_NS], pb = sec[(k + 1) % PYLON_NS];
      // the outline's outward normal in its plane (the outline runs from the leading edge down the +u side)
      let nu = -(pb[1] - pa[1]), nw = pb[0] - pa[0];
      const l = Math.hypot(nu, nw) || 1; nu /= l; nw /= l;
      const tE = surf(sec[k], k), L = Math.abs(topE[k] - bot[k]), r = Math.min(R, 0.3 * L);
      const W = at(secW[k], surf(secW[k], k) + dir * Math.min(dW, 0.3 * L)), Cn = at(sec[k], tE);
      const uwO = [sec[k][0] + nu * r, sec[k][1] + nw * r], hO = end < 0 ? below(uwO) : above(uwO);
      const Sx = hO != null && Math.abs(hO - tE) < 3 * r + 0.05 ? at(uwO, hO - dir * 0.002) : Cn;
      const row = [];
      for (let j = 0; j <= NJ; j++) {
        const s = j / NJ, m = 1 - s, lift = dir * PYLON_BEAD * 4 * s * m;
        row.push(jbag.v([m * m * W[0] + 2 * s * m * Cn[0] + s * s * Sx[0] + ax[0] * lift,
                         m * m * W[1] + 2 * s * m * Cn[1] + s * s * Sx[1] + ax[1] * lift,
                         m * m * W[2] + 2 * s * m * Cn[2] + s * s * Sx[2] + ax[2] * lift]));
      }
      rg.push(row);
    }
    for (let k = 0; k < PYLON_NS; k++) {
      const k2 = (k + 1) % PYLON_NS;
      for (let j = 0; j < NJ; j++) jbag.quad(rg[k][j], rg[k2][j], rg[k2][j + 1], rg[k][j + 1]);
    }
  };
  // (`botCap`: the foot stands on nothing the rays see - the hanging nacelle's mast on a wheel's fork - so no joint
  // strip there: the foot is CLOSED, a flat cap on its own vertices, as the top is with nothing over it)
  if (o.botCap) {
    const ring = rows[0].row.map(([uw, t]) => at(uw, t)), n = ring.length;
    const c = [0, 1, 2].map(a => ring.reduce((m, p) => m + p[a], 0) / n);
    const e1 = ring[0].map((v, a) => v - c[a]), e2 = ring[1].map((v, a) => v - c[a]);
    const up = (e1[1] * e2[2] - e1[2] * e2[1]) * ax[0] + (e1[2] * e2[0] - e1[0] * e2[2]) * ax[1] + (e1[0] * e2[1] - e1[1] * e2[0]) * ax[2];
    const ic = bag.v(c), iv = ring.map(p => bag.v(p));
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; if (up < 0) bag.tri(ic, iv[k], iv[k2]); else bag.tri(ic, iv[k2], iv[k]); }
  } else strip(-1, PYLON_JOINT_B, fB);
  if (o.topJoint) strip(1, PYLON_JOINT_T, fT);
  return { bot, top: topE };
}
// G3913 / HULL-B38: THE PYLON - the bars and cables (0), or a faired body that hugs (1 slab, 2 wing section, 3 blended)
// - the V legs' mount (engPylonForm 0) or ONE blade (1, drawPylonBlade). `C` the caster (pylonCaster), null = the old
// flat ends at the feet and the plate
function drawPylonMount(group, f, P, GK, aft, C) {
  if (Math.round(+P.engPylonForm || 0) === 1) return drawPylonBlade(group, f, P, GK, aft, C);
  const style = Math.max(0, Math.min(3, Math.round(+P.engPylonFair || 0)));
  const ch = f.chord || 1.4, Lp = Math.max(0.30, 0.42 * ch), ox = f.x || 0;
  // the plate stands UNDER the engine: a pusher's block hangs aft of its face, a tractor's forward of it
  // (HULL-B52: the plate and the body stand f.pylonFwd forward of the mount's own station - the engine stays)
  const y0 = f.yc - f.halfH, zc = f.z + (aft ? -1 : 1) * (Lp / 2 - 0.05) + (+f.pylonFwd || 0), zF = zc + Lp / 2, zR = zc - Lp / 2, xt = 0.06;
  const ft = f.foot, fx = Math.max(xt, ft.x);
  // HULL-B79 (the user: "as simple as having an up-down slider for the current setting, and then we just slide it
  // down"): an engine block slid down INTO the wing (engBlockY) has no pylon - its nacelle on the wing is the mount
  if (y0 < Math.max(ft.y, ft.yF != null ? ft.yF : -Infinity, ft.yR != null ? ft.yR : -Infinity) + 0.03) return;
  // the feet stand on the skin: the legs end just inside it, never above it (HULL-B18: a foot on a sloping roof reads its
  // own station's height, ft.yF / ft.yR - the front and the rear pair)
  const yF = ft.y - 0.005, yFf = (ft.yF != null ? ft.yF : ft.y) - 0.005, yFr = (ft.yR != null ? ft.yR : ft.y) - 0.005;
  const bars = GK.Bag(), cab = GK.Bag();
  const top = { fL: [ox - xt, y0, zF], fR: [ox + xt, y0, zF], rL: [ox - xt, y0, zR], rR: [ox + xt, y0, zR] };
  const foot = { fL: [ox - fx, yFf, ft.zF], fR: [ox + fx, yFf, ft.zF], rL: [ox - fx, yFr, ft.zR], rR: [ox + fx, yFr, ft.zR] };
  // the rail frame under the plate and the four legs: bare, with their cables (0); a FAIRING hides them (1, 2, 3)
  if (style === 0) {
    GK.tube(bars, top.fL, top.fR, PYLON_RAIL, 10); GK.tube(bars, top.rL, top.rR, PYLON_RAIL, 10);
    GK.tube(bars, top.fL, top.rL, PYLON_RAIL, 10); GK.tube(bars, top.fR, top.rR, PYLON_RAIL, 10);
    for (const k of ['fL', 'fR', 'rL', 'rR']) GK.tube(bars, top[k], foot[k], PYLON_R, 12);
    const mb = bars.mesh(group, matOf('emMount')); if (mb) mb.name = 'engPylon';
    // the bracing cables between the pillars: each side's plane, the front and the rear pairs
    for (const [a, b] of [[top.fL, foot.rL], [top.rL, foot.fL], [top.fR, foot.rR], [top.rR, foot.fR],
                          [top.fL, foot.fR], [top.fR, foot.fL], [top.rL, foot.rR], [top.rR, foot.rL]])
      GK.tube(cab, a, b, PYLON_CABLE, 4);
    const mc = cab.mesh(group, matOf('emMount')); if (mc) mc.name = 'engPylon';
    return;
  }
  // THE FAIRING (HULL-B38): feet narrow enough (a wing with its centre, the roof behind the cabin) and it is ONE body on
  // the plate's centre, standing VERTICAL: its chord the mean of the feet's spread and the plate's (plus a margin), a
  // slab (1), a 24 % wing section (2) or a 36 % one with the fillets (3, the chimney); feet out at the roots (a cabin
  // wing without its centre) and each side's leg pair is faired as ONE 12 % panel from the plate's edge out to the
  // pair's feet, in the cross plane at the plate's station (the flown legs, fanned fore / aft inside its chord), its
  // ends hugging the root and the nacelle as the body does
  const blend = style === 3, single = fx <= 0.16, fair = GK.Bag(), jb = GK.Bag();
  const kind = style === 1 ? 'slab' : 'foil';
  const yLo = Math.min(yF, yFf, yFr), cMean = 0.5 * (Math.abs(ft.zF - ft.zR) + Lp) + 0.12;
  const C2 = C || { cowl: false, cast: () => null };
  const dn = ['body', 'wing'], up = C2.cowl ? ['wing', 'cowl'] : ['wing'];
  if (single) {
    const hw = 0.5 * (xt + fx) + PYLON_R + 0.012, H = Math.max(0.05, y0 - yLo);
    const O = [ox, yLo + 0.5 * H, zc];
    pylonHug(fair, jb, C2, { O, ax: [0, 1, 0], eu: [1, 0, 0], ew: [0, 0, 1],
      out: e => pylonOutline(kind, cMean, blend ? 0.36 : 0.24, hw, e), fB: blend ? Math.min(PYLON_FIL_B, 0.35 * H) : 0,
      fT: blend ? Math.min(PYLON_FIL_T, 0.25 * H) : 0, dn, up, top0: y0 - O[1], bot0: yLo - O[1], topJoint: C2.cowl });
  } else for (const sd of [-1, 1]) {
    const kF = sd < 0 ? 'fL' : 'fR', kR = sd < 0 ? 'rL' : 'rR';
    // (the panel stands at the plate's station: it leans out to its feet across, never fore / aft)
    const a = [0.5 * (top[kF][0] + top[kR][0]), y0, zc], b = [0.5 * (foot[kF][0] + foot[kR][0]), 0.5 * (foot[kF][1] + foot[kR][1]), zc];
    const Ll = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), ax = [(a[0] - b[0]) / Ll, (a[1] - b[1]) / Ll, (a[2] - b[2]) / Ll];
    // the chord along +z (square to the leg, which stays in its cross plane); across, square to both
    const ew = [0, 0, 1];
    const eu = [ax[1] * ew[2] - ax[2] * ew[1], ax[2] * ew[0] - ax[0] * ew[2], ax[0] * ew[1] - ax[1] * ew[0]];
    const O = [0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1]), 0.5 * (a[2] + b[2])];
    pylonHug(fair, jb, C2, { O, ax, eu, ew, out: e => pylonOutline(kind, cMean, 0.12, PYLON_R + 0.012, e),
      fB: blend ? Math.min(PYLON_FIL_B, 0.35 * Ll) : 0, fT: blend ? Math.min(PYLON_FIL_T, 0.25 * Ll) : 0,
      dn, up, top0: 0.5 * Ll, bot0: -0.5 * Ll - 0.005, topJoint: C2.cowl });
  }
  // the plate's underside (a bare engine on its plate, no nacelle over it): a shallow streamlined fairing over the
  // body's top or between the panels' tops, the rails inside it
  if (!C2.cowl) {
    const NS = 24, path = [[ox - xt - 0.01, y0 - 0.005, zc], [ox + xt + 0.01, y0 - 0.005, zc]];
    GK.sweep(fair, path, () => {
      const pts = [];
      for (let k = 0; k < NS; k++) {
        const ang = 2 * Math.PI * k / NS, ca = Math.cos(ang), sa = Math.sin(ang);
        pts.push([0.025 * Math.sign(sa) * Math.pow(Math.abs(sa), 0.6), (0.5 * Lp + 0.06) * Math.sign(ca) * Math.pow(Math.abs(ca), 0.35)]);
      }
      return pts;
    }, true, [0, 1, 0]);
  }
  pylonMeshes(group, fair, jb);
}
// the body in the cowl's section (the nacelle's paint), the joint in the rubber seal's
// MONOWHEEL: THE HUGGING BODY for another layer - the gear layer's faired skid is this blade hung under the keel
window.CAGE_PYLON = { pylonCaster, pylonHug, pylonOutline, drawPylonBlade };
function pylonMeshes(group, fair, jb) {
  const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
  const m = fair.mesh(group, (SM && SM('cowl', { surf: 0, fieldM: 1 })) || matOf('emMount'));
  if (m) m.name = 'engPylon';
  const j = jb.mesh(group, matOf('emPuck'));
  if (j) j.name = 'engPylonJoint';
}
// HULL-B14: THE SINGLE BLADE - one symmetric wing-section post on the mount's centreline, 12 % thick
// (HULL-B38: a vertical prism under the plate - its chord the mean of the feet's spread and the plate's - hugging what
// it stands on and what it carries; BLENDED (engPylonFair 3) with the fillets to both, HULL-B16)
function drawPylonBlade(group, f, P, GK, aft, C) {
  const ch = f.chord || 1.4, Lp = Math.max(0.30, 0.42 * ch), ox = f.x || 0;
  const y0 = f.yc - f.halfH, zc = f.z + (aft ? -1 : 1) * (Lp / 2 - 0.05) + (+f.pylonFwd || 0);
  const ft = f.foot, yF = Math.min(ft.y, ft.yF != null ? ft.yF : ft.y, ft.yR != null ? ft.yR : ft.y) - 0.02;
  if (f.kind !== 'cabPylon' && y0 < Math.max(ft.y, ft.yF != null ? ft.yF : -Infinity, ft.yR != null ? ft.yR : -Infinity) + 0.03) return;   // (HULL-B79: in the wing, no pylon)
  const blend = Math.round(+P.engPylonFair || 0) === 3, H = Math.max(0.05, y0 - yF);
  const c = blend ? Lp + 0.06 : 0.5 * (Math.abs(ft.zF - ft.zR) + 0.10 + Lp + 0.06);
  const C2 = C || { cowl: false, cast: () => null }, fair = GK.Bag(), jb = GK.Bag(), O = [ox, yF + 0.5 * H, zc];
  pylonHug(fair, jb, C2, { O, ax: [0, 1, 0], eu: [1, 0, 0], ew: [0, 0, 1], out: e => pylonOutline('foil', c, 0.12, 0, e),
    fB: blend ? Math.min(PYLON_FIL_B, 0.35 * H) : 0, fT: blend ? Math.min(PYLON_FIL_T, 0.25 * H) : 0,
    dn: ['body', 'wing'], up: C2.cowl ? ['wing', 'cowl'] : ['wing'], top0: y0 - O[1], bot0: yF - O[1], topJoint: C2.cowl });
  pylonMeshes(group, fair, jb);
}
const matOf = name => {
  const A = AKM();
  // the livery section first, exactly as the propeller does it: AERO_HARD
  // still decides what the part IS (its bottom-out finish), and the section
  // adds the builder's own finish, tint and dials on top.
  const sec = ENG_SEC[name];
  if (sec && typeof window !== 'undefined' && window.CAGE_SECMAT) {
    const m = window.CAGE_SECMAT(sec, {
      fin: A && A.aeroHardFinish && A.aeroHardFinish('eng', name),
      tint0: EP.COL[name] || EP.NEUTRAL,
      surf: 0, fieldM: 1, side: THREE.DoubleSide });
    if (m) return m;
  }
  if (A && A.aeroHardMat) {
    const m = A.aeroHardMat(THREE, 'eng', name,
      new THREE.Color(EP.COL[name] || EP.NEUTRAL).getHex(),
      { side: THREE.DoubleSide });
    if (m) return m;
  }
  if (!matCache[name]) {
    const [met, rgh] = EP.PROPS[name] || [0.55, 0.5];
    matCache[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(EP.COL[name] || EP.NEUTRAL),
      metalness: met, roughness: rgh, side: THREE.DoubleSide });
  }
  return matCache[name];
};
const propM = new THREE.MeshStandardMaterial({
  color: 0xc79a63, metalness: 0.0, roughness: 0.62,
  side: THREE.DoubleSide });
// THE PROPELLER'S MATERIAL IS A CHOICE, not a name — the cowl bench's own
// MATERIALS table, whose index also drives the blade's DENSITY — so it maps
// by index (AERO_PROP_FIN). A laminated wooden blade and a carbon one differ
// in more than colour, and this is where that finally shows.
// G244: THE NOSE CONE IS NOT ALWAYS MADE OF WHAT THE BLADES ARE (the user:
// "the nose cone should be able to set its material independently from the
// blades"). A spun alloy spinner on a wooden propeller is the commonest
// combination there is, and `cw_material` decided both. `spinMat` is 0 for
// "as the blades" — the behaviour every saved aeroplane has — and otherwise
// an index into the SAME table, so the cone gets the finish, the tint, the
// tile and the grain turn of a real material rather than a tint on a blade.
const propMatIdx = sec => {
  if (sec === 'spinner') {
    const n = Math.round(+PCUR.spinMat || 0);
    if (n > 0) return Math.min(CW.MATERIALS.length - 1, n - 1);
  }
  return Math.round(CW.P.material);
};
let PCUR = {};                       // the build's params, for propMatIdx
const propMat = (sec) => {
  const i = Math.max(0, Math.min(CW.MATERIALS.length - 1, propMatIdx(sec)));
  const M = CW.MATERIALS[i];
  const A = AKM();
  // the livery section (phase C): cw_material keeps deciding what the blade
  // IS (its finish AND its density); the section adds the builder's tint and
  // dials on top. The spinner is its own section FOLLOWING the propeller, so
  // by default it wears the blade's material exactly as it always did.
  // G125.1: the row's own tile scale and grain turn ride along — a laminated
  // blade shows its glue lines at BLADE pitch, running SPANWISE. tileK0
  // composes under the builder's dial in secMat; the fallback multiplies the
  // same number in directly.
  if (typeof window !== 'undefined' && window.CAGE_SECMAT) {
    const m = window.CAGE_SECMAT(sec || 'prop',
      { fin: A && A.AERO_PROP_FIN[i], tint0: M.col,
        surf: 0, fieldM: 1, side: THREE.DoubleSide,
        tileK0: M.tileK, detRot: M.detRot });
    if (m) return m;
  }
  if (A && A.aeroHardOn && A.aeroHardOn() && A.AERO_PROP_FIN[i])
    return A.aeroMaterial(THREE, { finish: A.AERO_PROP_FIN[i], tint: M.col,
      surf: 0, fieldM: 1, side: THREE.DoubleSide,
      tileK: M.tileK, detRot: M.detRot, spin: sec === 'spinner' ? 2 : 1 });
  propM.color.setHex(M.col); propM.metalness = M.met; propM.roughness = M.rgh;
  return propM;
};
function meshFrom(m) {
  const pos = new Float32Array(m.V.length * 3);
  m.V.forEach((p, i) => { pos[i*3] = p[0]; pos[i*3+1] = p[1]; pos[i*3+2] = p[2]; });
  const byMat = new Map();
  m.F.forEach(f => {
    if (!byMat.has(f.m)) byMat.set(f.m, []);
    const t = byMat.get(f.m);
    t.push(f.v[0], f.v[1], f.v[2], f.v[0], f.v[2], f.v[3]);
  });
  const idx = [], mats = [], groups = [];
  for (const [name, tris] of byMat) {
    groups.push([idx.length, tris.length, mats.length]);
    for (const i of tris) idx.push(i);
    mats.push(name);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  for (const [start, count, mi] of groups) g.addGroup(start, count, mi);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mats.map(matOf));
  // (PROPER-COWLS: which group is which part, for the cowl's tools - the exhaust may leave the cowl by design)
  mesh.userData.matNames = mats.slice();
  // THE EXHAUST EXIT, MEASURED (G70). The wear needs a source for the soot
  // streak, and the only honest one is where the pipe actually ends — which
  // moves with the cylinder count, the architecture and every slider on the
  // engine panel. So it is read off the pipes' own triangles rather than
  // declared: aft-most first (the cage builds z-forward, so aft is -z), and
  // the lowest vertex among those within 30 mm of it, because a tailpipe
  // exits down as well as back.
  const et = byMat.get('emExhaust');
  if (et && et.length) {
    let zm = Infinity;
    for (const vi of et) zm = Math.min(zm, m.V[vi][2]);
    let best = null;
    for (const vi of et) {
      const p = m.V[vi];
      if (p[2] > zm + 0.03) continue;
      if (!best || p[1] < best[1]) best = p;
    }
    if (best) mesh.userData.exhaustExit = best.slice();
    // G345: the pipe's own direction, where the mesh published one
    const ed = m.ports && m.ports.exhaustDir && m.ports.exhaustDir[0];
    if (best && ed) mesh.userData.exhaustDir = ed.slice();
  }
  return mesh;
}

// ---- the build ------------------------------------------------------------
let group = null;
// THE ONE-SHOT STARTER, as a pure step: "has the preset ROW changed since I
// last looked?" — the first look records, a change fires, and nothing else
// does. Published for GATE STARTER (tools/_starter_check.js), which drives it
// without a scene.
//
// A LOAD IS NOT A ROW CHANGE (2026-09-03). This used to compare against the
// previous BUILD's value, and a loaded build replaces P wholesale — so a file
// naming a different preset than the aeroplane you had open re-fired the
// starter, and the preset's ~40 engine rows overwrote the seven the file had
// actually saved (the user's jodel: mount gap 1.52 -> 0.85, firewall spread
// 2.07 -> 1.50, the exhaust style and its outlet, all gone on load — and
// order-dependent, since loading the same file twice was fine). `PAGE.load`
// is the editor saying "P was replaced, not edited": forget the memory, so
// the next build records the loaded value instead of reacting to it.
let lastPreset = null;           // the one-shot starter's memory
// THE LOAD AUDIT (2026-09-05, the picker ruling). A build saved before the
// ruling may name a catalogue engine while its dials say otherwise — those
// dials used to fly, as "modified <name>". They still do: the audit reads
// the dials the OLD way, and where they resolve to a different engine than
// the preset it flips the row to the custom engine, so nothing a file flew
// changes under it. Runs once per load (and once at the first build).
// Returns true when it flipped. Published for GATE ENGID.
let auditPending = true;
function engCatalogueAudit(P) {
  if (!+P.engOn || isCustomEng(P)) return false;
  const name = PRESET_NAMES[Math.round(P.engPreset)];
  if (!EP.PRESETS[name] || ENG_FANTASY.has(name)) return false;
  const EG = window.ENG_GEN;
  if (!EG || !EG.engResolve) return false;
  let R, R0;
  try {
    R = EG.engResolve(dialSpecOfP(P, null, false));
    R0 = EG.engResolve(presetSpecOf(name));
  } catch (e) { return false; }
  if (!R || !R0) return false;
  const eq = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  if (eq(R.mass, R0.mass) && eq(R.powerW, R0.powerW) && eq(R.rpm, R0.rpm)
      && R.arch === R0.arch) return false;
  P.engPreset = CUSTOM_IDX;
  return true;
}
// THE TYPE LEADS (2026-09-05): a catalogue engine of another layout than
// the type rows (powertrain, layout) say is replaced by the first entry of
// that type — a starter, applied by the caller. Returns the name to apply,
// or null. The custom engine follows no list.
function engTypeFollow(P) {
  if (!+P.engOn || isCustomEng(P)) return null;
  const want = archOf(P);
  const name = PRESET_NAMES[Math.round(P.engPreset)];
  if (presetArch(name) === want) return null;
  const first = PRESET_NAMES.find(n => presetArch(n) === want);
  if (!first) return null;
  P.engPreset = PRESET_NAMES.indexOf(first);
  return first;
}
if (typeof window !== 'undefined') {
  window.CAGE_ENG_AUDIT = engCatalogueAudit;
  window.CAGE_ENG_FOLLOW = engTypeFollow;
  window.CAGE_ENG_CUSTOM = CUSTOM_IDX;
}
function engPresetStarter(P) {
  const psel = Math.round(P.engPreset);
  if (lastPreset === null) { lastPreset = psel; return null; }
  if (psel === lastPreset) return null;
  lastPreset = psel;
  return PRESET_NAMES[psel] || null;
}
const prevLoad = PAGE.load;
PAGE.load = () => { if (prevLoad) prevLoad(); lastPreset = null; auditPending = true; };
if (typeof window !== 'undefined') window.CAGE_ENG_STARTER = engPresetStarter;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};

// write a preset's values into the eng_ rows (drops become indices)
function applyEngPreset(P, name) {
  const pre = EP.PRESETS[name];
  if (!pre) return;
  const base = Object.assign(EP.engDefaults(), pre);
  P.engPower = base.arch === 'electric' ? 1 : base.arch === 'turbine' ? 2 : 0;
  for (const [, rows] of EP.GROUPS)
    for (const r of rows) {
      const k = r[0];
      if (SKIP.has(k) || base[k] === undefined) continue;
      if (r[2] === 'drop') {
        const i = VALS[k].indexOf(base[k]);
        if (i >= 0) P['eng_' + k] = i;
      } else if (r[2] === 'check') P['eng_' + k] = base[k] ? 1 : 0;
      else P['eng_' + k] = base[k];
    }
  P.eng_screws = base.screws ? 1 : 0;
}
// THE ONE EXPORT of that mapping (2026-08-31): the birth flow bakes a
// preset's values into a FRESH cage before cageToSpec (design_flow.js), and
// GATE ARCHETYPES does the same headless — both through this exact function,
// so the tile, the row and the gate cannot apply three different engines.
if (typeof window !== 'undefined') window.CAGE_ENG_APPLY_PRESET = applyEngPreset;

const prevPost = PAGE.post;
PAGE.post = ctx => {
  const { P } = ctx;
  // the preset starter fires exactly when the ROW changes — never on a load.
  // AND IT FIRES BEFORE THE REST OF THE CHAIN (2026-09-05): the cowl's post
  // runs inside prevPost and reads the engine's spec off P, so a preset that
  // changes the architecture had to be written before the cowl looks — or
  // the cowl fitted the OLD engine for one build (the first turboprop came
  // up in a 0.64 m boxer cowl round a 1.46 m engine; a radial preset had
  // always had the same one-build lag).
  if (+P.engOn) {
    const sync = () => {
      const UI = window.CAGE_UI;
      if (UI && UI.syncSliders) UI.syncSliders();
    };
    // the load audit, then the type leads the list (both 2026-09-05, the
    // picker ruling — see the two functions), then the starter
    if (auditPending) { auditPending = false; if (engCatalogueAudit(P)) sync(); }
    const follow = engTypeFollow(P);
    if (follow) {
      applyEngPreset(P, follow);
      lastPreset = Math.round(P.engPreset);
      sync();
    }
    const prevSel = lastPreset;
    const fire = engPresetStarter(P);
    if (fire) {
      // ENGINE-GAP: the switch to the custom engine remembers the catalogue engine it left (its dials stay, the
      // starter writes none); a catalogue pick forgets it
      if (isCustomEng(P)) {
        const was = prevSel == null ? null : PRESET_NAMES[prevSel];
        if (was && was !== CUSTOM_ENGINE && EP.PRESETS[was] && !ENG_FANTASY.has(was)) P.engFrom = prevSel;
      } else delete P.engFrom;
      applyEngPreset(P, fire);
      sync();
    }
  }
  if (prevPost) prevPost(ctx);
  // G2880 (NACELLE-LAG): a unit on the wing (the pylon, the nacelle pair)
  // stands on CAGE_WING, which the wing layer - later in the chain -
  // publishes: the placement is handed to the wing's early readers and placed
  // again, once, over the wing this build publishes (_cage_wing.js
  // CAGE_WING_EARLY). A nose or pusher engine is placed once, as it was.
  const EW = window.CAGE_WING_EARLY;
  if (EW) EW.place('eng', ctx, engPlace, () => {
    const NF = window.CAGE_NOSE, m = Math.round(+P.engMount || 0);
    // (ENGINE-CONFIGS-2: the three's and the four's nacelles stand on the wing too - mounts 5 and 6)
    // (THE HANGING NACELLE: a pusher on the mast's back face stands on the wing's mast too)
    if (!+P.engOn || !([2, 3, 5, 6, 7].includes(m) || (m === 1 && +P.hangOn)) || !NF || !NF.engineFaces) return null;
    const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
    const faces = NF.engineFaces(ctx.mesh, FS, P);
    // (HULL-B38: the pylon's ends read the wing's skins too - its top and underside under each mount, every plane - so
    // a wing that moved under the same faces places it again)
    const W = window.CAGE_WING, PL = W ? (W.planes || [W]) : [], q = v => v && isFinite(v.y) ? +v.y.toFixed(4) : null;
    const under = faces.filter(u => u.face && u.face.foot).map(u => PL.map(pl => [q(pl.overAt && pl.overAt(u.face.x || 0, u.face.z)),
                                                                                q(pl.underAt && pl.underAt(u.face.x || 0, u.face.z))]));
    return JSON.stringify([faces, under]);
  });
  else engPlace(ctx, null);
};
// CONFIG-MATRIX (2 Nov, the user: a push-pull or a pusher on a single rod "is very possible, with Rod on top or
// below the engine and prop. A lot of our current planes use this"): THE ROD CLEARS THE REAR DISC. The rod leaves the
// aft bulkhead right behind the pusher's disc; `rodY` is the builder's free slider (G26), so the layer never moves it
// on its own - a TILE that puts an aft engine on a single rod (Pusher, Rod & pod, Booms·Single) arms one fit, and
// the next placement moves the rod to the far side of the disc from the hub (below a hub over the bulkhead's middle,
// above one under it), clear by ROD_CLEAR, then builds once more so the rod and the tail ride there. A rod the
// builder already set clear of the disc is left where it is.
let rodFitNext = false;
window.CAGE_ROD_FIT_NEXT = () => { rodFitNext = true; };
const ROD_CLEAR = 0.08;      // m between the blade tip and the rod (the Pusher tile's own 80 mm)
// the single rod's axis height (scene metres) at `dz` metres aft of the bulkhead, and its radius; null off a rod
function rodAxis(P, FS) {
  if (!+P.boomStyle || +P.boomTwin) return null;
  const t = Math.tan((+P.rodIncl || 0) * Math.PI / 180);
  return { y: dz => (+P.rodY || 0) * FS + t * dz, r: Math.max(0.015, (+P.rodD || 0.12) / 2) * FS, t };
}
// the layer's own build; `prev` is the first pass's units when the wing places
// it again (G2880) - superseded, their propeller check stands down
function engPlace(ctx, prev) {
  const { scene, mesh, P, stat } = ctx;
  if (prev) prev.superseded = true;
  dispose(group); group = null;
  window.CAGE_ENG_LOST = null;
  if (!P.engOn) return null;

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  // THE FACES (2026-09-04): one per engine, from the cowl layer's own
  // description (nose / aft bulkhead / a pylon over the wing / a nacelle a
  // side). None = say why, draw nothing.
  const NF = window.CAGE_NOSE;
  const mountK = Math.round(P.engMount || 0);
  const units = NF && NF.engineFaces ? NF.engineFaces(mesh, FS, P) : [];
  // CONFIG-MATRIX: EVERY ENGINE THE MOUNT LISTS IS BOLTED ON, OR THE LAYER SAYS WHICH IS NOT AND WHY. The join flies
  // the mount's list whatever was drawn; CAGE_ENG_LOST is what it files as an error row (an engine flown and not
  // drawn), and CAGE_ENG no longer outlives a build that drew nothing (its stations flew on as the old drawing's)
  const want = ({ 3: 2, 4: 2, 5: 3, 6: 4 })[mountK] || 1;
  const aftFace = !!(+P.rearAperture || (CG2 && CG2.cageAftEngineFace && CG2.cageAftEngineFace(P)));
  const whyLost = mountK === 1 || (mountK === 4 && !aftFace)
      ? (aftFace ? 'no aft bulkhead face' : 'an aft engine needs the pod to end at the aft bulkhead (Rod & pod, or twin booms)')
    : mountK === 2 ? ([0, 3].includes(Math.round(P.wgPos || 0)) ? 'no wing to sit on' : 'the over-the-wing mount needs a HIGH wing (or a parasol)')
    : mountK === 3 || mountK >= 5 ? 'no wing to hang the nacelles on'
    : 'no engine face on this body';
  if (units.length < want) window.CAGE_ENG_LOST = { mount: mountK, want, got: units.length, why: whyLost };
  if (!units.length) {
    if (stat) stat.textContent += '  ·  engine: ' + whyLost;
    window.CAGE_ENG = null;
    return null;
  }
  if (units.length < want && stat) stat.textContent += '  ·  engine: ' + units.length + ' of ' + want + ' drawn — ' + whyLost;
  const face = units[0].face;

  // spec: the shared dial dict (engSpecOfP — the join resolves the same
  // one, G134); the plate the builder computes against IS the cage's face
  // (G31 — the mount spread, backing pads and service entries land on the
  // real firewall)
  const spec = engSpecOfP(P);
  // G2802: the bay's battery, generator and starter are the fit's (bayElec): drawn when billed, at the catalogue
  // part's own size - a ride-through key the mesh reads, never the resolve (an install row: GATE ENGID §11)
  const BE = bayElec();
  if (BE) {
    spec.battOn = BE.battOn; spec.genOn = BE.genOn; spec.starter = BE.starter;
    if (BE.batt && BE.batt.dims) spec.battDims = BE.batt.dims.slice();
  }
  spec.quality = Math.max(0.3, P.engDetail || 0.8);
  spec.screws = P.eng_screws ? 1 : 0;
  // the genuine firewall is the cage's — off the body (a pylon, a nacelle)
  // the engine draws its own mount plate
  // (PROPER-COWLS: not inside a pod that houses the engine - _cage_cowl podPlate's `podSized`)
  spec.fwOn = face.synthetic && !face.podSized ? 1 : 0;
  spec.fwW = Math.max(0.2, Math.min(2.2, 2 * face.halfW));
  spec.fwH = Math.max(0.2, Math.min(2.2, 2 * face.halfH));
  let M;
  try { M = EM.engMeshBuild(spec); }
  catch (e) {
    if (stat) stat.textContent += '  ·  engine: ' + e.message;
    return null;
  }
  const R = M.resolved;
  const Pm = Object.assign({}, EM.ENGM_DEFAULT, R.P);
  const cR = R.place.caseR != null ? R.place.caseR : R.place.canR;
  const zFw = R.place.zAft - Pm.mountGap * cR;

  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:eng';

  // spinner + blades — the cowl tool's geometry, on the crank. NO SHAFT
  // (G32, user): the engine provides the crank and the flange, so the
  // tool's own aft shaft is not drawn — the cone is built here from the
  // tool's own profile (spinProfile / spinR / spinLen), base on the
  // flange plus the noseOff dial.
  for (const k of SPINPROP_KEYS)
    if (P['cw_' + k] !== undefined && CW.P[k] !== undefined)
      CW.P[k] = P['cw_' + k];
  PCUR = P;                          // G244: propMat reads `spinMat` off it
  const ax = CW.axisXY();
  const nOff = CW.P.noseOff || 0;
  // ONE ENGINE PER FACE (2026-09-04). The same engine mesh, spinner and
  // blades per unit; an AFT unit is turned round (its +z, the crank, points
  // backwards) so the firewall plate stays on the face and the propeller
  // runs behind it. Group k > 0 names its spinner/prop with a '#k' suffix so
  // the join can spin each one about its own hub.
  const unitOut = [];
  const spinGeo = (() => {
    const d2 = Math.max(0.35, Math.min(2, CW.P.detail || 1));
    const NS = Math.max(10, Math.round(16 * d2));
    const SA = Math.max(20, Math.round(40 * d2));
    const pos = [], idx = [];
    for (let i = 0; i < NS; i++) {
      const u = i / (NS - 1);
      const r2 = CW.P.spinR * CW.spinProfile(u), z2 = u * CW.P.spinLen;
      for (let j = 0; j < SA; j++) {
        const th = j / SA * Math.PI * 2;
        pos.push(Math.cos(th) * r2, Math.sin(th) * r2, z2);
      }
    }
    for (let i = 0; i < NS - 1; i++)
      for (let j = 0; j < SA; j++) {
        const j2 = (j + 1) % SA;
        idx.push(i * SA + j, i * SA + j2, (i + 1) * SA + j2,
                 i * SA + j, (i + 1) * SA + j2, (i + 1) * SA + j);
      }
    // G244: THE SHAFT, AND NO GAP (the user: "the nose cone should generate
    // its own shaft to the engine, or the engine to the nose cone, but there
    // should be no gap"). G32 retired the cowl tool's own shaft because "the
    // engine provides the crank and the flange" — which is true, and which
    // left the cone standing `noseOff` clear of that flange with nothing
    // between them. The cone now grows its own: a backplate at exactly its
    // base radius (so there is no step to see) necking to a hub that runs
    // back to the flange. Drawn in the CONE's frame, where the flange is at
    // -noseOff, so it is right for every offset and disappears at zero.
    // WHERE THE ENGINE ACTUALLY IS. The flange is the unit's z = 0 by
    // construction, but the drawn BLOCK does not always reach it — an
    // electric unit's case, a turbine's, or any engine whose nose sits aft
    // of its mounting face would leave the shaft ending in mid-air. So the
    // shaft runs back to whichever is further aft: the flange, or the block's
    // own forward-most vertex.
    let blkFwd = -Infinity;
    for (const v of (M && M.V) || []) if (v[2] > blkFwd) blkFwd = v[2];
    if (!isFinite(blkFwd)) blkFwd = 0;
    const shaftTo = Math.min(0, blkFwd - 0.004);
    const gap = nOff - shaftTo;
    if (gap > 0.001) {
      const rB = CW.P.spinR, rH = Math.max(0.012, rB * 0.34);
      const prof = [[rB, 0], [rB, -gap * 0.12], [rH, -gap * 0.34],
                    [rH, shaftTo - nOff]];
      const row0 = pos.length / 3;
      for (const [r3, z3] of prof)
        for (let j = 0; j < SA; j++) {
          const th = j / SA * Math.PI * 2;
          pos.push(Math.cos(th) * r3, Math.sin(th) * r3, z3);
        }
      for (let i = 0; i < prof.length - 1; i++)
        for (let j = 0; j < SA; j++) {
          const j2 = (j + 1) % SA, a = row0 + i * SA, b = row0 + (i + 1) * SA;
          idx.push(a + j, b + j2, a + j2, a + j, b + j, b + j2);
        }
      const cap = pos.length / 3;              // the aft face, on the flange
      pos.push(0, 0, shaftTo - nOff);
      for (let j = 0; j < SA; j++)
        idx.push(cap, row0 + (prof.length - 1) * SA + j,
                 row0 + (prof.length - 1) * SA + (j + 1) % SA);
    }
    const base = pos.length / 3;
    pos.push(0, 0, 0);                       // base cap fan
    for (let j = 0; j < SA; j++) {
      const j2 = (j + 1) % SA;
      idx.push(base, j2, j);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  })();
  const propInfo = P.propOn ? CW.propGeometry() : null;
  const ex = Math.max(0, P.explodeD || 0) * FS;
  units.forEach((u, k) => {
    const f = u.face, sfx = k ? '#' + k : '';
    const ug = new THREE.Group();
    // G179.2: NAMED at the source, so the join makes the whole unit ONE
    // part that rides its own engine node — it used to be skin, and the
    // wing-box selector cut it in two on a wing mount (the user: "the
    // engine block and prop seem to be attached to the body, while the
    // support is attached to the wing nacelle structure")
    ug.name = 'edEng' + sfx;
    // G2790: a layout mixes the nose (the cage's own firewall) with faces
    // off the body (a nacelle, the bulkhead of a push-pull drawn plain):
    // a unit whose face is synthetic when the first unit's is not draws
    // its own mount plate, sized to its face
    let MU = M;
    if (!!f.synthetic !== !!face.synthetic || !!f.podSized !== !!face.podSized) {
      try { MU = EM.engMeshBuild(Object.assign({}, spec, { fwOn: f.synthetic && !f.podSized ? 1 : 0,
        fwW: Math.max(0.2, Math.min(2.2, 2 * f.halfW)), fwH: Math.max(0.2, Math.min(2.2, 2 * f.halfH)) })); }
      catch (e) { MU = M; }
    }
    const engMesh = meshFrom(MU);
    ug.add(engMesh);
    const ng = new THREE.Group();
    ng.add(new THREE.Mesh(spinGeo, propMat('spinner')));
    ng.position.set(0, 0, nOff);             // cone base -> flange + dial
    // G55: NAMED for the join's snapshot (G47.2's prescription) — the parts
    // that turn with the propeller carry their identity at the source
    ng.name = 'edSpinner' + sfx;
    ug.add(ng);
    let pg = null;
    if (P.propOn) {
      pg = new THREE.Group();
      pg.name = 'edProp' + sfx;
      // the blade plane rides the cone exactly as the tool placed it
      pg.position.set(0, 0, nOff + CW.P.spinLen *
        Math.max(0.02, Math.min(0.95, CW.P.bladeStation)));
      const pm = propMat();
      for (let b0 = 0; b0 < Math.round(CW.P.bladeN); b0++) {
        const b = new THREE.Group();
        b.add(new THREE.Mesh(propInfo.geom, pm));
        b.add(new THREE.Mesh(propInfo.root, pm));
        b.add(new THREE.Mesh(propInfo.tip, pm));
        b.rotation.z = b0 / Math.round(CW.P.bladeN) * Math.PI * 2;
        pg.add(b);
      }
      ug.add(pg);
    }
    // ON THE THRUSTLINE, BOLTED TO THE FACE — plus the mount's own up/down
    // (G32). An aft unit's firewall plane lands on the face from behind.
    if (u.aft) ug.rotation.y = Math.PI;
    // G477: the tilt — downthrust: the thrust line points down at the
    // aeroplane's front. three.js composes the Euler as Rx·Ry, so the same
    // +x rotation dips a nose unit's crank and raises an aft unit's (its y
    // flip is applied first): one sign for both.
    ug.rotation.x = (+P.engTilt || 0) * Math.PI / 180;
    ug.position.set((f.x || 0) + (u.aft ? -ax.x : ax.x),
                    f.yc + ax.y + (P.engY || 0),
                    u.aft ? f.z + zFw : f.z - zFw);
    if (ex > 0) {
      ng.position.z += ex * 1.5;
      if (pg) pg.position.z += ex * 2.0;
    }
    group.add(ug);
    // HULL-B22: THE FIN MOUNT - steel tubes from the engine's plate (its four corners) back to the fin's leading edge above
    // and below the thrust line, and a pair to the fin's mid-chord (the frame braces the engine to the fin's spars and
    // its section nodes at that height - 61_gen_frame)
    if (u.kind === 'fin' && f.fin && window.GEAR_KIT) {
      const GK = window.GEAR_KIT, bag = GK.Bag(), xt = 0.07, hh = 0.11, zP = f.z, yP = f.yc;
      const zL = f.fin.zLE - 0.02, zM = 0.5 * (f.fin.zLE + f.fin.zTE), yF = f.fin.y;
      const plate = [[-xt, yP + hh, zP], [xt, yP + hh, zP], [-xt, yP - hh, zP], [xt, yP - hh, zP]];
      for (const p of plate) {
        const sg = Math.sign(p[0]);
        GK.tube(bag, p, [0.25 * sg * xt, yF + (p[1] > yP ? 0.22 : -0.22), zL], PYLON_R, 10);
        GK.tube(bag, p, [0.25 * sg * xt, yF, zM], 0.8 * PYLON_R, 10);
      }
      GK.tube(bag, plate[0], plate[1], PYLON_RAIL, 8); GK.tube(bag, plate[2], plate[3], PYLON_RAIL, 8);
      GK.tube(bag, plate[0], plate[2], PYLON_RAIL, 8); GK.tube(bag, plate[1], plate[3], PYLON_RAIL, 8);
      if (!+P.cowlOn) bag.mesh(group, matOf('emMount'));   // (under a nacelle the faired pylon below is the drawn mount: the tubes stand inside it)
      // (HULL-B34: under a nacelle the engine is IN CONTACT with the fin - the nacelle crosses it, no pylon drawn; the
      // tubes above stand for the bare engine's mount only)
    }
    // THE PYLON (the over-the-wing mount): one tapered post from the upper
    // skin to the mount plate, in the mount's own material
    if (u.kind === 'wingTop' && f.yBase != null && !u.tandemRear) {   // (HULL-B15: a tandem's one pylon, under its front unit)
      const GK = window.GEAR_KIT;
      if (!GK || !f.foot) {
        const h = Math.max(0.02, f.yc - f.halfH - f.yBase + 0.02);
        const pl = new THREE.Mesh(new THREE.BoxGeometry(0.09, h, Math.max(0.25, 0.42 * (f.chord || 1))), matOf('emMount'));
        pl.position.set(f.x || 0, f.yBase + h / 2, f.z + 0.05);
        group.add(pl);
      } else drawPylonMount(group, f, P, GK, !!u.aft, pylonCaster(ctx, FS, [(f.x || 0) - 1.0, (f.x || 0) + 1.0, f.z - 1.1, f.z + 1.1]));
    }
    // HULL-B78: THE CABANE AS A CENTRAL PYLON - drawn by the wing layer now, after the wing it stands under (_cage_wing
    // cabPylonDraw: this layer runs BEFORE the wing's, so CAGE_WING here was the previous build's - missing on a first)
    // HULL-B30: A NACELLE ON THE REAR FUSELAGE stands on a STUB PYLON - a short wing-section blade from the fuselage's
    // side (its root flared into the skin, 18 % thick) to the nacelle's inboard flank (16 %, a small fillet), its chord
    // the nacelle's mount station over 0.85 m; the frame's stub truss (61_gen_frame pylonAt 'body') inside it
    if (u.kind === 'nacelle' && f.side && window.GEAR_KIT) {
      const GK = window.GEAR_KIT, bag = GK.Bag(), sd = Math.sign(f.x || 1);
      const x0 = sd * (f.side.x - 0.04), x1 = (f.x || 0) - sd * 0.6 * f.halfW, y0 = f.side.y, y1 = f.yc;
      const C0 = 0.95, C1 = 0.75, NR = 10, NS = 24, path = [], rows = [];
      for (let i = 0; i <= NR; i++) { const t = i / NR, e0 = Math.max(0, 1 - t / 0.25) ** 2, e1 = Math.max(0, (t - 0.8) / 0.2) ** 2;
        path.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, f.side.z]); rows.push([C0 + (C1 - C0) * t + 0.25 * e0 + 0.1 * e1, 0.16 + 0.10 * e0 + 0.04 * e1]); }
      GK.sweep(bag, path, (tt, i) => { const [c, th] = rows[i], pts = [];
        for (let k = 0; k < NS; k++) { const ang = 2 * Math.PI * k / NS, ca = Math.cos(ang), sa = Math.sin(ang), xc = 0.5 * (1 - ca);
          const yt = 5 * th * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
          pts.push([(0.5 - xc) * c, (sa >= 0 ? 1 : -1) * yt * c]); }
        return pts; }, true, [0, 0, 1]);
      const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
      bag.mesh(group, (SM && SM('cowl', { surf: 0, fieldM: 1 })) || matOf('emMount'));
    }
    // HULL-B8: a wing nacelle lifted over the wing stands on the same mount, drawn about its own station
    // (HULL-B38: at its own x in the layer's frame - the rays read the wing and the nacelle where they are)
    if (u.kind === 'nacelle' && f.foot && window.GEAR_KIT)
      drawPylonMount(group, f, P, window.GEAR_KIT, !!u.aft, pylonCaster(ctx, FS, [(f.x || 0) - 1.0, (f.x || 0) + 1.0, f.z - 1.1, f.z + 1.1]));
    // THE EXHAUST EXIT IN THE SCENE'S OWN FRAME (G70). The mesh measured it in
    // the engine's local frame; the group has just been placed on the thrust
    // line, so one localToWorld puts it in the same metric frame the gear
    // publishes its contacts in — which is what lets the wear ask the CAGE
    // where that point is on its skin.
    let exhaustAt = null, exhaustDir = null;
    if (engMesh.userData.exhaustExit) {
      ug.updateMatrixWorld(true);
      const v = new THREE.Vector3().fromArray(engMesh.userData.exhaustExit);
      engMesh.localToWorld(v);
      exhaustAt = [v.x, v.y, v.z];
      // G345: the direction through the same placement (a pusher's flip
      // included), rotation only
      if (engMesh.userData.exhaustDir) {
        const d = new THREE.Vector3().fromArray(engMesh.userData.exhaustDir)
          .transformDirection(engMesh.matrixWorld);
        exhaustDir = [d.x, d.y, d.z];
      }
    }
    // G477 (the Chinook, the user: "your engine clips a lot through the
    // wing ... ensure your prop does not collide. Maybe even write a helper
    // that colors the prop in case of detected collision, like the fuel
    // tank"): THE PROPELLER'S CLEARANCE is measured by `propFitCheck` below,
    // AFTER the whole layer chain (the wing's skin probes and the aft skin
    // are built after this layer): the hub and the radius are kept here.
    let propHub = null;
    if (pg) { ug.updateMatrixWorld(true); const hv = new THREE.Vector3(); pg.getWorldPosition(hv); propHub = [hv.x, hv.y, hv.z]; }
    // DESIGN-AIDS: the blade plane's hub in the SAME frame as `at` (the unit's parent: the join's model frame, metres) -
    // the drawn disc's offset from the mount the aids measure the prop's clearance from (app.js aidPropOff)
    let propAt = null;
    if (pg) { const pv = pg.position.clone(); ug.updateMatrix(); pv.applyMatrix4(ug.matrix); propAt = [pv.x, pv.y, pv.z]; }
    unitOut.push({ kind: u.kind, aft: !!u.aft, exhaustAt, exhaustDir, faceZ: f.z, faceYc: f.yc, propAt,
                   at: [ug.position.x, ug.position.y, ug.position.z],
                   prop: pg ? { hub: propHub, R: 0.5 * Math.max(0.2, +CW.P.propD || 1.5), group: pg } : null,
                   propFit: null });
  });
  scene.add(group);
  const exhaustAt = unitOut[0].exhaustAt;
  // G477: THE PROPELLER'S CLEARANCE, like the fuel tank's fit. The disc is
  // sampled — four radii out to the tip, every 15 degrees, a blade's chord
  // fore and aft — and each point asked of the wing's own skin probes
  // (CAGE_WING.overAt / underAt, the tank layer's) and of the aft skin
  // (CAGE_GEAR.AF: the pod and the rod are one surface). A point inside
  // either is a hit: the blades go the tank's red, the unit carries
  // `propFit`, the join says it (and the status line). Runs after the
  // chain: the engine layer is built before the wing and the gear, so the
  // post schedules it as a microtask and the join calls it outright.
  const FSc = FS;
  const propFitCheck = () => {
    const W = window.CAGE_WING, AF = window.CAGE_GEAR && window.CAGE_GEAR.AF;
    const inWing = (x, y, z) => {
      if (!W || !W.overAt || !W.underAt) return false;
      const o = W.overAt(x, z), un = W.underAt(x, z);
      return !!(o && un && o.y - un.y > 0.005 && y > un.y - 0.02 && y < o.y + 0.02);
    };
    const inBody = (x, y, z, aft) => {
      if (!AF || !AF.surf) return false;
      // ENGINE-CONFIGS-2: a disc on the aft bulkhead turns behind the pod's END when no rod carries on (the
      // push-pull's twin booms): AF.surf holds the last section past AF.z0, which read the whole disc behind a
      // blunt pod as inside it. A rod boom is part of AF (its z0 is the rod's end), so a pusher on a rod reads as before
      if (aft && isFinite(AF.z0) && z < AF.z0 - 1e-3) return false;
      let lo, hi;
      try { lo = AF.surf(z, 0); hi = AF.surf(z, Math.PI); } catch (e) { return false; }
      if (!lo || !hi || !isFinite(lo[1]) || !isFinite(hi[1]) || hi[1] <= lo[1] + 0.01) return false;
      const yc = 0.5 * (lo[1] + hi[1]);
      const ang = Math.atan2(y - yc, x);
      let s; try { s = AF.surf(z, ang + Math.PI / 2); } catch (e) { return false; }
      if (!s) return false;
      const rP = Math.hypot(x, y - yc), rS = Math.hypot(s[0], s[1] - yc);
      return rP < rS - 0.02;
    };
    for (const u of unitOut) {
      if (!u.prop) { u.propFit = null; continue; }
      const [hx, hy, hz] = u.prop.hub, R = u.prop.R;
      let wingHits = 0, bodyHits = 0, n = 0;
      for (const k of [0.35, 0.6, 0.8, 1.0]) for (let j = 0; j < 24; j++) for (const dz of [-0.06, 0, 0.06]) {
        const th = j / 24 * Math.PI * 2;
        const x = hx + R * k * Math.cos(th), y = hy + R * k * Math.sin(th), z = hz + dz;
        n++;
        if (inWing(x, y, z)) wingHits++;
        // the body from 0.6 R out: the innermost ring sits inside the
        // spinner and the cowl's nose on every tractor by construction (the
        // stock Cub read 6 hits there, the 172 twelve, all at the hub)
        else if (k >= 0.6 && inBody(x, y, z, u.aft)) bodyHits++;
      }
      const why = [];
      if (wingHits) why.push('through the wing (' + wingHits + ' of ' + n + ' points)');
      if (bodyHits) why.push('through the body (' + bodyHits + ' points)');
      // CONFIG-MATRIX: THE ROD IN THE DISC, measured exactly (the sampled rings above step 15 deg and miss a 12 cm
      // tube): an aft disc on a single rod strikes it when the rod's axis is nearer the hub than R plus its radius
      const RA = u.aft && rodAxis(P, FSc);
      if (RA && isFinite(u.faceZ)) {
        const miss = Math.abs(hy - RA.y(u.faceZ - hz)) - R - RA.r;
        if (miss < 0) why.push('through the rod boom (' + Math.round(-1000 * miss) + ' mm of blade past it)');
      }
      u.propFit = { ok: !why.length, why, R, hub: u.prop.hub, wingHits, bodyHits, n };
      if (why.length) {
        const bad = new THREE.MeshStandardMaterial({ color: 0x7a1a12, roughness: 0.6, metalness: 0.1,
          emissive: new THREE.Color(0xff2a1a), emissiveIntensity: 0.45 });
        u.prop.group.traverse(o => { if (o.isMesh) o.material = bad; });
      }
      if (stat && why.length) stat.textContent += '  ·  PROP: ' + why.join(', ');
    }
    return unitOut.map(u => u.propFit);
  };
  if (typeof queueMicrotask === 'function') queueMicrotask(() => { if (unitOut.superseded) return; try { propFitCheck(); } catch (e) {} });

  if (rodFitNext && !prev) {
    rodFitNext = false;
    const RA = rodAxis(P, FS), u = unitOut.find(v => v.aft && v.prop && v.prop.hub);
    if (RA && u && isFinite(u.faceZ)) {
      const hy = u.prop.hub[1], R = u.prop.R, dz = u.faceZ - u.prop.hub[2];
      if (Math.abs(hy - RA.y(dz)) < R + RA.r) {
        const below = !(hy < (isFinite(u.faceYc) ? u.faceYc : hy) - 1e-3);
        const yAx = below ? hy - R - ROD_CLEAR - RA.r : hy + R + ROD_CLEAR + RA.r;
        const v = Math.max(-1.5, Math.min(0.9, Math.round(((yAx - RA.t * dz) / FS) / 0.005) * 0.005));
        // what the rod's slider range could not give (metres) goes to the REAR ENGINE ALONE, where the firewall
        // rule lets it move (CABIN-CRAFT-2, engineFaces: a COWLED pusher - or a push-pull's rear - stands on the pod's
        // face itself and ignores the block; the cowl does not read engY, so moving a cowled engine would pull it out
        // of its cowl):
        //   a lone uncowled pusher: engY (one unit - the Pusher tile's own "engine top = boom bottom" rule, carried on)
        //   an uncowled push-pull: engBlockY (it moves the aft face's unit; the nose engine stands on noseFace)
        //   a cowled one: nothing moves - the notice says what is left and the prop check files it
        const short = Math.max(0, (below ? (v * FS + RA.t * dz) - yAx : yAx - (v * FS + RA.t * dz)));
        let eMove = 0, left = short, eRow = null;
        if (short > 1e-3 && !cowledPusherRow(P)) {
          const [k, lo, hi] = mountK === 1 ? ['engY', -0.5, 0.5] : mountK === 4 ? ['engBlockY', -0.6, 0.8] : [null];
          if (k) {
            const e0 = +P[k] || 0, e1 = Math.max(lo, Math.min(hi, e0 + (below ? 1 : -1) * short));
            eMove = e1 - e0; left = Math.max(0, short - Math.abs(eMove)); eRow = k;
            P[k] = Math.round(e1 / 0.005) * 0.005;
          }
        }
        if (Math.abs(v - (+P.rodY || 0)) > 1e-6 || eMove) {
          P.rodY = v;
          if (stat) stat.textContent += '  ·  rod: moved ' + (below ? 'below' : 'above') + ' the disc (rod height ' + v.toFixed(3) + ')' +
            (eMove ? ', the ' + (mountK === 4 ? 'rear ' : '') + 'engine ' + (below ? 'up' : 'down') + ' ' + Math.round(1000 * Math.abs(eMove)) + ' mm (' + eRow + ')' : '') +
            (left > 1e-3 ? ' - ' + Math.round(1000 * left) + ' mm of blade still reach it: ' +
              (cowledPusherRow(P) ? 'a cowled rear engine stands on the pod\'s face (the firewall rule) - shorten the prop, or take the cowl off and raise the block'
                                  : 'raise the rear engine or shorten the prop') : '');
          setTimeout(() => { const UI = window.CAGE_UI; if (UI && UI.syncSliders) UI.syncSliders(); if (UI && UI.build) UI.build(); }, 0);
        }
      }
    }
  }
  window.CAGE_ENG = { name: PRESET_NAMES[Math.round(P.engPreset)],
                      resolved: R, zFw, exhaustAt,
                      propFitCheck,                                // G477: the disc's clearance, per unit (the join calls it)
                      get propFit() { return unitOut.map(u => u.propFit); },
                      mount: ['nose', 'pusher', 'wingTop', 'wing'][mountK] || 'nose',
                      units: unitOut,
                      spec, quads: M.stats && M.stats.quads };
  if (stat) {
    const head = R.arch === 'electric'
      ? (R.powerW / 1000).toFixed(1) + ' kW cont'
      : R.arch === 'turbine'
      ? (R.powerW / 1000).toFixed(0) + ' kW rated (core ' +
        (R.powerThermoW / 1000).toFixed(0) + ')'
      : R.litres.toFixed(2) + ' L · ' + (R.powerW / 1000).toFixed(0) + ' kW';
    stat.textContent += '  ·  engine: ' + R.archName +
      (R.cyl ? ' ' + R.cyl : '') + ' · ' + head + ' · ' +
      R.mass.toFixed(0) + ' kg';
  }
  return unitOut;
}
})();
