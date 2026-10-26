// ===========================================================================
// THE TECH MASK (G3230 TECH-MASK) — the machine shop's three segments, one
// table: every build option -> the segment that unlocks it. The editor greys
// what is above the player's segment, the market and the makers list what is
// at or below it (an occasion one above), and a design's stage is the highest
// segment of any option it uses — computed, never stored.
// futureDesigns/game/GAME-PLAN-2026-10-15.md §R (binding: MACHINE-SHOP, no
// eras, "a segmented tech tree"), §4.1-§4.4.
// ===========================================================================
// THE SHAPE: `career.tech = { seg: 1..3, entries: [key] }` rides the career block (74_career.js careerNormalise
// normalises it when present). A NEW story career gets `{ seg: 1, entries: [] }` (79_story.js storyNewCareer). A career
// without the key (every career made before this, the dev career ?career=1) and the sandbox have NO machine shop:
// everything is open, exactly as before. `entries` is §4.2's later split of a segment into individual entries: a key
// of TECH_TABLE listed there is open whatever the segment (v1 never writes one).
// THE KEYS are '<group>:<option>' over the GEN tables' own option lists (GATE TECH walks every table both ways: every
// option has a row, every row names an option that exists). The groups:
//   mat     fuselage construction        GEN_MATERIALS        spec.fuselage.material
//   surf    a flying surface's own        GEN_SURF_MATERIALS   wings[].material, tail.finMaterial / stabMaterial
//   eng     the engine                    POWERPLANTS          engines[].type
//   cfg     twin                          (engines.length)     more than one engine
//   prop    the blades' material          GEN_PROP_MATS        prop.material
//   pitch   the fixed pitch               GEN_PROP_PITCH       prop.pitch
//   fit     the panel's tier              GEN_SYSTEMS          systems.fit
//   elec.*  battery / alternator / ...    GEN_ELEC             genSystemsResolve(spec).elec
//   av.*    com / xpdr / nav / gps        GEN_AVIONICS         genSystemsResolve(spec).avionics
//   gear    the undercarriage's type      clampSpec's list     gear.type
//   susp    the mains' springing          GEN_SUSPENSION       gear.suspension
//   fair    the fairings' layup           GEN_FAIR_MATS        gear.fairMat, when a fairing is fitted
//   glaze   the glazing's material        GEN_OUTFIT.glassKgM2By  cabin.glazingMat, when glazed
//   canopy  a flat screen or a bubble     clampSpec's list     cabin.canopy.style
//   fuel    the liquid                    GEN_FUELS            energy.fuel (a fuel build)
//   cell    the pack's chemistry          GEN_CELLS            energy.cell (a battery build)
//   kit     the STOL kit (G2820)          GEN_SLATS / GEN_STOL wings[].stol, any device fitted (the kit is on
//                                                             claude/stol-wing-g2820, not on master yet: the row
//                                                             waits for it and reads nothing until then)
// NOT MASKED IN v1 (not in §4.1's columns): flaps, seats, tips, the tail's type, booms, the instrument items of a
// custom fit (the fit's own electrics and avionics are masked), the glazing route (an open cockpit or a screen).
// Pure: no DOM, no storage, no clock.
// ===========================================================================
const TECH_V = 1;
const TECH_MAX = 3;
// §R: the three segments, by material; v1 = the three unlocks
const TECH_SEGS = {
  1: { seg: 1, name: 'Wood and fabric' },
  2: { seg: 2, name: 'Sheets and bolts' },
  3: { seg: 3, name: 'Composite and electronics' },
};
// THE TABLE (a ruling per option, for the user to review: HANDOVER G3230 prints it). The rules it follows:
//   steel tube, wood, fabric = 1; aluminium in any form = 2; carbon and glassfibre = 3.
//   a naturally aspirated piston up to 115 kW (the O-320's 112 kW, the Super Cub's) = 1; a bigger or supercharged one
//   = 2; the modern turbocharged Rotax 915 iS ("economical engines"), every electric motor and every turbine = 3.
//   twins = 2. A tricycle = 2; the taildragger and floats = 1. A bubble canopy and polycarbonate = 2. Fairings: glassfibre
//   = 1 (a homebuilt's wheel spats), alloy = 2, carbon = 3.
//   the steam-gauge panels (minimal / basic) = 1; the IFR panel's 60 A alternator, vacuum pump, transponder and VOR = 2;
//   GPS of any kind, the glass cockpit and a lithium battery = 3 (electronics). Suspension: all 1 (the Jodel's oleo legs).
//   the propeller is bought off the shelf, not built of the airframe's material: every blade material and pitch = 1
//   (the user's Rufus, the story's starter, flies a carbon prop on a wood-and-fabric airframe).
const TECH_TABLE = {
  // ---- materials
  'mat:tubeFabric': 1, 'mat:wood': 1, 'mat:alloy': 2, 'mat:aluTube': 2, 'mat:carbon': 3, 'mat:glass': 3,
  'surf:fabric': 1, 'surf:steel': 1, 'surf:alloy': 2, 'surf:aluFabric': 2, 'surf:carbon': 3, 'surf:glass': 3,
  // ---- engines
  'eng:a65_sensenich74': 1, 'eng:vw2180_wood': 1, 'eng:rotax277_pusher': 1, 'eng:rotax503_wood': 1, 'eng:rotax582_ivo': 1,
  'eng:jabiru2200_std': 1, 'eng:rotax912_warp': 1, 'eng:o200_eprops': 1, 'eng:mikron3_wood': 1, 'eng:gipsymajor1_wood': 1,
  'eng:verner7u_wood': 1, 'eng:rotec3600_std': 1, 'eng:o320_mccauley': 1,
  'eng:io360_mccauley': 2, 'eng:o540_hartzell': 2, 'eng:io550_hartzell3': 2, 'eng:io720_hartzell3': 2, 'eng:ranger440_wood': 2,
  'eng:hirth508_wood': 2, 'eng:argus10c_wood': 2, 'eng:w670_hs2b': 2, 'eng:r755_hs2b': 2, 'eng:m14p_v530': 2,
  'eng:r985_hs2b20': 2, 'eng:r1340_hs12d40': 2, 'eng:r1830_hs23e50': 2,
  'eng:rotax915_carbon': 3,
  'eng:emrax268_carbon': 3, 'eng:emrax228_3blade': 3, 'eng:e811_velis': 3, 'eng:sp260d_class': 3, 'eng:eppg_direct_130': 3,
  'eng:fes_folding_100': 3, 'eng:outrunner2212_9x47': 3, 'eng:outrunner3548_12x6': 3, 'eng:outrunner6374_18x10': 3,
  'eng:pt6a114a_hartzell3': 3, 'eng:pt6a34_hartzell4': 3, 'eng:pt6a42_hartzell4': 3, 'eng:pt6a60a_hartzell4': 3,
  'cfg:twin': 2,
  'prop:wood': 1, 'prop:maple': 1, 'prop:walnut': 1, 'prop:alu': 1, 'prop:carbon': 1,
  'pitch:climb': 1, 'pitch:standard': 1, 'pitch:cruise': 1,
  // ---- systems / avionics
  'fit:minimal': 1, 'fit:basic': 1, 'fit:custom': 1, 'fit:ifr': 2,
  'elec.battery:none': 1, 'elec.battery:lead': 1, 'elec.battery:lithium': 3,
  'elec.alternator:none': 1, 'elec.alternator:gen20': 1, 'elec.alternator:alt60': 2,
  'elec.starter:none': 1, 'elec.starter:yes': 1,
  'elec.vac:none': 1, 'elec.vac:venturi': 1, 'elec.vac:pump': 2,
  'av.com:none': 1, 'av.com:compact': 1,
  'av.xpdr:none': 1, 'av.xpdr:modeS': 2,
  'av.nav:none': 1, 'av.nav:vor': 2,
  'av.gps:none': 1, 'av.gps:portable': 3, 'av.gps:panel': 3, 'av.gps:glass': 3,
  // ---- gear
  'gear:taildragger': 1, 'gear:floats': 1, 'gear:tricycle': 2,
  'susp:bungee': 1, 'susp:spring': 1, 'susp:oleo': 1,
  'fair:glass': 1, 'fair:alloy': 2, 'fair:carbon': 3,
  // ---- canopy / glazing
  'glaze:acrylic': 1, 'glaze:glass': 1, 'glaze:polycarbonate': 2,
  'canopy:screen': 1, 'canopy:bubble': 2,
  // ---- energy (the liquid follows the engine; a pack is electric)
  'fuel:avgas100LL': 1, 'fuel:mogas': 1, 'fuel:jetA': 3,
  'cell:lifepo4': 3, 'cell:nmc': 3, 'cell:nca': 3,
  // ---- the STOL kit (G2820: slats, VGs, cuffs, fences, drooped ailerons)
  'kit:stol': 3,
};
// the gear types and canopy styles clampSpec accepts (60_gen_spec.js clampSpec: an unknown is rewritten to the first);
// GATE TECH probes clampSpec with each and with an unknown, so this list cannot drift from it
const TECH_GEAR_TYPES = ['taildragger', 'tricycle', 'floats'];
const TECH_CANOPY_STYLES = ['screen', 'bubble'];
// the powertrain families of the editor's `engPower` row (piston / electric / turbine), read off POWERPLANTS: a family
// opens with the first of its engines
const TECH_FAMILIES = { piston: ['four', 'two'], electric: ['electric'], turbine: ['turbine'] };

const techName = seg => (TECH_SEGS[seg] ? TECH_SEGS[seg].name : '');
// the words written next to a greyed row (nothing hover-only, §4.3)
const techWhy = seg => 'Machine shop: ' + techName(seg);
// a key's segment: the table's row, or a family's (its first engine), or null (an option the mask does not know is
// never greyed)
function techSegOf(key) {
  if (typeof key !== 'string') return null;
  if (TECH_TABLE[key] != null) return TECH_TABLE[key];
  const m = /^fam:(\w+)$/.exec(key);
  if (m && TECH_FAMILIES[m[1]] && typeof POWERPLANTS !== 'undefined') {
    let s = null;
    for (const k of Object.keys(POWERPLANTS)) {
      if (!TECH_FAMILIES[m[1]].includes(POWERPLANTS[k].engine.family)) continue;
      const v = TECH_TABLE['eng:' + k];
      if (v != null && (s == null || v < s)) s = v;
    }
    return s;
  }
  return null;
}

// ---- A DESIGN'S STAGE -------------------------------------------------------------------------------------------------
// every option a spec uses, as table keys (deduplicated, in group order). Raw or resolved: an absent row reads as
// GEN_DEFAULT's (what clampSpec would fill), the systems through genSystemsResolve (the one reader the ledger uses)
function techKeysOfSpec(spec) {
  const S = spec && spec.spec && !spec.engines ? spec.spec : (spec || {});
  const out = [], add = k => { if (!out.includes(k)) out.push(k); };
  const D = typeof GEN_DEFAULT !== 'undefined' ? GEN_DEFAULT : {};
  const fu = S.fuselage || {};
  add('mat:' + (fu.material || (D.fuselage && D.fuselage.material) || 'tubeFabric'));
  const surf = v => (v == null ? null : (typeof GEN_SURF_MATERIALS !== 'undefined' && GEN_SURF_MATERIALS[v]) ? v
    : ((typeof GEN_SURF_LEGACY !== 'undefined' && GEN_SURF_LEGACY[v]) || null));
  for (const w of (Array.isArray(S.wings) ? S.wings : [])) { const m = w && surf(w.material); if (m) add('surf:' + m); }
  for (const f of ['finMaterial', 'stabMaterial']) { const m = S.tail && surf(S.tail[f]); if (m) add('surf:' + m); }
  const E = Array.isArray(S.engines) && S.engines.length ? S.engines : (D.engines || []);
  for (const e of E) if (e && e.type) add('eng:' + e.type);
  if (E.length > 1) add('cfg:twin');
  const pr = S.prop || {};
  add('prop:' + (pr.material || 'wood'));
  add('pitch:' + (pr.pitch || 'standard'));
  for (const k of techKeysOfSystems(S)) add(k);
  const g = S.gear || {};
  add('gear:' + (TECH_GEAR_TYPES.includes(g.type) ? g.type : 'taildragger'));
  add('susp:' + ((typeof GEN_SUSPENSION !== 'undefined' && GEN_SUSPENSION[g.suspension]) ? g.suspension : 'bungee'));
  const faired = (g.fairing && g.fairing !== 'none') || (g.twFairing && g.twFairing !== 'none') || g.legFair === 'fair' || g.twLegFair === 'fair';
  if (faired) add('fair:' + (g.fairMat || 'glass'));
  const cb = S.cabin || {};
  if (cb.glazing !== 'none') add('glaze:' + (cb.glazingMat || 'acrylic'));
  add('canopy:' + (cb.canopy && cb.canopy.style === 'bubble' ? 'bubble' : 'screen'));
  const en = S.energy || {};
  if (en.kind === 'battery') add('cell:' + (en.cell || 'lifepo4'));
  else add('fuel:' + (en.fuel || 'avgas100LL'));
  for (const w of (Array.isArray(S.wings) ? S.wings : [])) if (w && techStolOn(w.stol)) add('kit:stol');
  return out;
}
// the panel's keys: the tier, and the electrics and avionics it resolves to (genSystemsResolve: a radio without a bus
// is dropped, so it is not counted)
function techKeysOfSystems(S) {
  const out = [];
  let R = null;
  try { R = typeof genSystemsResolve === 'function' ? genSystemsResolve(S || {}) : null; } catch (e) { R = null; }
  if (!R) return ['fit:' + ((S && S.systems && S.systems.fit) || 'basic')];
  out.push('fit:' + R.tier);
  for (const k of ['battery', 'alternator', 'starter', 'vac']) out.push('elec.' + k + ':' + R.elec[k]);
  for (const k of ['com', 'xpdr', 'nav', 'gps']) out.push('av.' + k + ':' + R.avionics[k]);
  return out;
}
// a wing's STOL devices: G2820's own reader when it is in the core, else any device that is not 'none' / 0
function techStolOn(st) {
  if (!st || typeof st !== 'object') return false;
  if (typeof genStolOf === 'function') { try { return !!genStolOf(st); } catch (e) { return false; } }
  return Object.keys(st).some(k => !/Span$/.test(k) && st[k] && st[k] !== 'none');
}
// THE STAGE: the highest segment of any option the spec uses (1 for an empty spec). Computed, never stored.
function techStageOfSpec(spec) {
  let s = 1;
  for (const k of techKeysOfSpec(spec)) { const v = techSegOf(k); if (v != null && v > s) s = v; }
  return s;
}
// the keys of a spec above a segment, each with its own: [{ key, seg }]
function techOver(spec, seg) {
  return techKeysOfSpec(spec).map(key => ({ key, seg: techSegOf(key) })).filter(r => r.seg != null && r.seg > seg);
}

// ---- THE CAREER'S MACHINE SHOP ----------------------------------------------------------------------------------------
const techNew = () => ({ seg: 1, entries: [] });
function techNormalise(t) {
  const d = techNew();
  if (!t || typeof t !== 'object') return d;
  const s = Math.round(+t.seg);
  d.seg = Number.isFinite(s) ? Math.max(1, Math.min(TECH_MAX, s)) : 1;
  if (Array.isArray(t.entries)) for (const k of t.entries) if (typeof k === 'string' && TECH_TABLE[k] != null && !d.entries.includes(k)) d.entries.push(k);
  return d;
}
// the machine shop of a document: null = no mask (the sandbox, a career without one)
const careerTechOf = doc => (doc && doc.mode === 'career' && doc.career && doc.career.tech) ? techNormalise(doc.career.tech) : null;
// the player's segment (TECH_MAX when nothing is masked)
const careerTechSeg = doc => { const t = careerTechOf(doc); return t ? t.seg : TECH_MAX; };
// may this career use this option? (an unknown key is never refused)
function careerTechAllows(doc, key) {
  const t = careerTechOf(doc);
  if (!t) return true;
  const s = techSegOf(key);
  return s == null || s <= t.seg || t.entries.includes(key);
}
// may this career own a design of this stage? an OCCASION may stand one segment above (§4.4: own it and fly it, the
// parts above the segment not modifiable)
const careerTechStageOk = (doc, stage, occasion) => stage <= careerTechSeg(doc) + (occasion ? 1 : 0);
// a segment unlocked (the keystone landmark's effect, §4.2): never down, never past TECH_MAX -> { ok, doc, why }
function careerTechUnlock(doc, seg) {
  const t = careerTechOf(doc);
  if (!t) return { ok: false, doc, why: 'no machine shop in this document' };
  const s = Math.max(1, Math.min(TECH_MAX, Math.round(+seg) || 1));
  if (s <= t.seg) return { ok: false, doc, why: 'segment ' + s + ' is open already' };
  const d = JSON.parse(JSON.stringify(doc));
  d.career.tech = Object.assign(techNormalise(d.career.tech), { seg: s });
  return { ok: true, doc: d, why: null };
}

// ---- THE EDITOR'S ROWS --------------------------------------------------------------------------------------------------
// the cage rows that choose an option, each option index -> its key (null = not masked). The join's own vocabularies
// (_cage_join.js: intCons' order, the surfaces' CONS4 after 'as the aeroplane', glazeMat, the canopy tile, fairCons, the
// nacelle mount, the powertrain). Two rows read the page's tables, handed in by the editor: `engPreset` (the row's
// names through CAGE_JOIN_ENGINES) and `cw_material` (CAGE_JOIN_PROP_MATS). GATE TECH holds every list to the join.
const TECH_SURF_ROW = [null, 'surf:carbon', 'surf:steel', 'surf:fabric', 'surf:alloy', 'surf:aluFabric', 'surf:glass'];
const TECH_ROWS = {
  intCons: ['mat:carbon', 'mat:tubeFabric', 'mat:wood', 'mat:alloy', 'mat:aluTube', 'mat:glass'],
  wgCons: TECH_SURF_ROW, w2Cons: TECH_SURF_ROW, finCons: TECH_SURF_ROW, stCons: TECH_SURF_ROW,
  glazeMat: ['glaze:acrylic', 'glaze:polycarbonate', 'glaze:glass'],
  canopy: ['canopy:screen', 'canopy:screen', 'canopy:screen', 'canopy:bubble'],
  fairCons: ['fair:glass', 'fair:carbon', 'fair:alloy'],
  engMount: [null, null, null, 'cfg:twin'],
  engPower: ['fam:piston', 'fam:electric', 'fam:turbine'],
};
// a row's keys, per option index; ctx: { names (the row's own option names), engines (CAGE_JOIN_ENGINES), propMats
// (CAGE_JOIN_PROP_MATS) } -> [key | null] or null (a row the mask does not read)
function techRowKeys(k, ctx) {
  ctx = ctx || {};
  if (TECH_ROWS[k]) return TECH_ROWS[k].slice();
  if (k === 'engPreset' && Array.isArray(ctx.names) && ctx.engines)
    return ctx.names.map(n => (ctx.engines[n] ? 'eng:' + ctx.engines[n] : null));
  if (k === 'cw_material' && Array.isArray(ctx.propMats)) return ctx.propMats.map(m => (m ? 'prop:' + m : null));
  return null;
}
// a spec PATCH's keys (a design tile's spec writes): the rows it names, only
function techKeysOfPatch(p) {
  const out = [];
  if (!p || typeof p !== 'object') return out;
  if (p.gear && TECH_GEAR_TYPES.includes(p.gear.type)) out.push('gear:' + p.gear.type);
  if (p.systems && p.systems.fit) out.push('fit:' + p.systems.fit);
  if (Array.isArray(p.engines)) { for (const e of p.engines) if (e && e.type) out.push('eng:' + e.type); if (p.engines.length > 1) out.push('cfg:twin'); }
  if (p.fuselage && p.fuselage.material) out.push('mat:' + p.fuselage.material);
  if (p.cabin && p.cabin.canopy && p.cabin.canopy.style) out.push('canopy:' + p.cabin.canopy.style);
  return out;
}

// ---- THE MARKET AND THE MAKERS ------------------------------------------------------------------------------------------
// THE VALIDATED DESIGNS' KEYS, as their build files are (CONTRACT_DESIGNS[id].build; the twin's floats patch applied).
// A MEASURED table, never typed: GATE TECH re-derives every row from the file with techKeysOfSpec and fails on any
// difference (`node tools/_tech_check.js --emit` prints the table) - the core cannot read a file, the gate can.
const TECH_DESIGNS = {
  cub: ['mat:tubeFabric', 'eng:a65_sensenich74', 'prop:wood', 'pitch:standard', 'fit:basic', 'elec.battery:lead', 'elec.alternator:gen20', 'elec.starter:yes', 'elec.vac:venturi', 'av.com:compact', 'av.xpdr:none', 'av.nav:none', 'av.gps:none', 'gear:taildragger', 'susp:bungee', 'glaze:acrylic', 'canopy:screen', 'fuel:avgas100LL'],
  jodel: ['mat:wood', 'eng:a65_sensenich74', 'prop:wood', 'pitch:cruise', 'fit:basic', 'elec.battery:lead', 'elec.alternator:gen20', 'elec.starter:yes', 'elec.vac:venturi', 'av.com:compact', 'av.xpdr:none', 'av.nav:none', 'av.gps:none', 'gear:taildragger', 'susp:oleo', 'glaze:acrylic', 'canopy:screen', 'fuel:avgas100LL'],
  c172: ['mat:alloy', 'eng:o540_hartzell', 'prop:alu', 'pitch:standard', 'fit:custom', 'elec.battery:lead', 'elec.alternator:alt60', 'elec.starter:yes', 'elec.vac:pump', 'av.com:compact', 'av.xpdr:modeS', 'av.nav:vor', 'av.gps:none', 'gear:tricycle', 'susp:spring', 'fair:glass', 'glaze:acrylic', 'canopy:screen', 'fuel:avgas100LL'],
  c172f: ['mat:alloy', 'eng:o540_hartzell', 'prop:alu', 'pitch:standard', 'fit:custom', 'elec.battery:lead', 'elec.alternator:alt60', 'elec.starter:yes', 'elec.vac:pump', 'av.com:compact', 'av.xpdr:modeS', 'av.nav:vor', 'av.gps:none', 'gear:floats', 'susp:spring', 'fair:glass', 'glaze:acrylic', 'canopy:screen', 'fuel:avgas100LL'],
  twinf: ['mat:tubeFabric', 'eng:rotax582_ivo', 'cfg:twin', 'prop:carbon', 'pitch:standard', 'fit:basic', 'elec.battery:lead', 'elec.alternator:gen20', 'elec.starter:yes', 'elec.vac:venturi', 'av.com:compact', 'av.xpdr:none', 'av.nav:none', 'av.gps:none', 'gear:floats', 'susp:spring', 'canopy:screen', 'fuel:avgas100LL'],
};
// a maker's model with its options, as keys: the design's keys with the rows its options write replaced (76_procure.js
// prWrite: the engine -> every engine's type; the avionics -> the tier's own electrics and avionics). Exact: GATE TECH
// holds it to techKeysOfSpec(procureSpec(...)) for every model and every option value.
function techKeysOfModel(modelId, opts) {
  if (typeof PROCURE_MODELS === 'undefined' || !PROCURE_MODELS[modelId]) return null;
  const M = PROCURE_MODELS[modelId], o = opts || procureDefaults(modelId), design = procureDesignOf(modelId, o);
  const base = TECH_DESIGNS[design];
  if (!base) return null;
  let keys = base.slice();
  const val = r => (M.opts[r] && o[r] != null && o[r] !== M.opts[r].def) ? M.opts[r].vals[o[r]] : null;
  const ev = val('engine');
  if (ev && ev.eng && PROCURE_ENGINES[ev.eng]) {
    const at = keys.findIndex(k => k.startsWith('eng:'));
    keys = keys.filter(k => !k.startsWith('eng:'));
    keys.splice(Math.max(0, at), 0, 'eng:' + PROCURE_ENGINES[ev.eng].type);
  }
  const av = val('avionics');
  if (av && av.fit) {
    const at = keys.findIndex(k => /^(fit|elec\.|av\.)/.test(k));
    keys = keys.filter(k => !/^(fit|elec\.|av\.)/.test(k));
    keys.splice(Math.max(0, at), 0, ...techKeysOfSystems({ systems: { fit: av.fit } }));
  }
  return keys;
}
function techStageOfKeys(keys) {
  let s = 1;
  for (const k of keys || []) { const v = techSegOf(k); if (v != null && v > s) s = v; }
  return s;
}
const techStageOfModel = (modelId, opts) => { const k = techKeysOfModel(modelId, opts); return k ? techStageOfKeys(k) : null; };
// a listing (used, or a story occasion) of this career: its stage <= the segment, one above for an occasion; a stage the
// table cannot read (a design with no row) is never shown in a masked career
function techListingOk(doc, L) {
  if (!careerTechOf(doc)) return true;
  const s = L ? techStageOfModel(L.model, L.opts) : null;
  return s != null && careerTechStageOk(doc, s, !!(L && L.occasion));
}
// a maker's model in the catalogue: its STOCK model at or below the segment
const techModelOk = (doc, modelId) => { if (!careerTechOf(doc)) return true; const s = techStageOfModel(modelId); return s != null && s <= careerTechSeg(doc); };
// an option value on the sheet: the model with that one value at or below the segment
const techOptionOk = (doc, modelId, opts, row, val) => {
  if (!careerTechOf(doc)) return true;
  const s = techStageOfModel(modelId, Object.assign({}, opts || procureDefaults(modelId), { [row]: val }));
  return s != null && s <= careerTechSeg(doc);
};
