// ===========================================================================
// LIVERY-MANAGER (the user 13 Nov 2026: "we now make many planes and liveries, so a plane should hold SEVERAL saved
// liveries and swap between them"; the design page ULksoJtJ796Ge9bfFKigHP, approved with its defaults).
//
// A LIVERY IS WHAT A SPRAY GUN AND A SIGN-WRITER CHANGE, AND NOTHING THAT WEIGHS OR AGES:
//   paint    base, trim, sweep, gloss, regX (where the registration sits) - every paint key BUT `job`
//   finish   sections (tint, fin, metal, tile, rough, nrm - but each section's wearM), decals (kit layers m1-m5, text pieces t1-t6, the
//            registration's look reg* / wreg*), glass - every finish key BUT `wear` and `weather`
// NOT the livery's: meta (the name and the REGISTRATION are the plane's: one registration a plane, PLANELISTS canon (b)),
// paint.job (the colour coats WEIGH, GEN_FINISH kgM2: a swap never changes the flight), finish.wear / finish.weather
// (the airframe's condition: the Wear tab's), the energy / systems looks (the inside), everything else (the aeroplane).
//
// WHERE: the save's ENVELOPE, beside the spec as the plaque and the log ride (G63) -
//   { what, v, name, spec, plaque, log, liveries: [{ id, name, paint, finish }], livery: '<id worn>' }
// spec.paint / spec.finish ARE the worn livery, so the spec - and every hash, fixture and gate on it - is today's bytes;
// a save with no `liveries` has none, and writes none (LATENT: absent until the player saves a second livery).
// The certificate: the plaque never saw paint / finish / meta (A9); genCertKey is blind to them too (66_gen_cert.js
// GEN_CERT_KEY_LOOK) - a swap keeps every certificate.
// Pure: no window, no DOM (the gate runs it in node).
// ===========================================================================
const LIVERY_NOT_PAINT = ['job'];
const LIVERY_NOT_FINISH = ['wear', 'weather'];
const LIVERY_NOT_SECTION = ['wearM'];  // a section's own wear (_cage_ui.js secWear): the airframe's condition, kept
const LIVERY_MAX = 24;                 // a plane's library (each a few kB of JSON - recipes, never pixels)
const LIVERY_NAME_MAX = 40;
const lvClone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
// the livery a spec wears: its paint without the job, its finish without the condition (null = the factory finish)
function liveryOf(spec) {
  const p = {}, P = spec && spec.paint && typeof spec.paint === 'object' ? spec.paint : {};
  for (const k of Object.keys(P)) if (LIVERY_NOT_PAINT.indexOf(k) < 0) p[k] = lvClone(P[k]);
  let f = null;
  const F = spec && spec.finish && typeof spec.finish === 'object' && !Array.isArray(spec.finish) ? spec.finish : null;
  if (F) {
    f = {};
    for (const k of Object.keys(F)) if (LIVERY_NOT_FINISH.indexOf(k) < 0) f[k] = lvClone(F[k]);
    if (f.sections && typeof f.sections === 'object') {
      for (const s of Object.keys(f.sections)) {
        const e = f.sections[s];
        if (e && typeof e === 'object') for (const k of LIVERY_NOT_SECTION) delete e[k];
        if (!e || typeof e !== 'object' || !Object.keys(e).length) delete f.sections[s];
      }
      if (!Object.keys(f.sections).length) delete f.sections;
    }
    if (!Object.keys(f).length) f = null;
  }
  return { paint: p, finish: f };
}
// a spec wearing livery `lv`: its paint + finish from the livery, the plane's own job, wear, weather and everything
// else untouched. Returns a NEW spec (the input is not written).
function liveryApply(spec, lv) {
  const s = Object.assign({}, spec);
  const P0 = spec && spec.paint && typeof spec.paint === 'object' ? spec.paint : {};
  const p = lvClone((lv && lv.paint) || {});
  for (const k of LIVERY_NOT_PAINT) { delete p[k]; if (P0[k] !== undefined) p[k] = P0[k]; }
  s.paint = p;
  const F0 = spec && spec.finish && typeof spec.finish === 'object' && !Array.isArray(spec.finish) ? spec.finish : null;
  const f = lv && lv.finish && typeof lv.finish === 'object' ? lvClone(lv.finish) : {};
  for (const k of LIVERY_NOT_FINISH) { delete f[k]; if (F0 && F0[k] !== undefined) f[k] = lvClone(F0[k]); }
  // each section's own wear stays the plane's (the livery's sections carry none)
  if (f.sections) for (const s of Object.keys(f.sections)) if (f.sections[s]) for (const k of LIVERY_NOT_SECTION) delete f.sections[s][k];
  const S0 = F0 && F0.sections && typeof F0.sections === 'object' ? F0.sections : null;
  if (S0) for (const s of Object.keys(S0)) for (const k of LIVERY_NOT_SECTION) {
    if (!S0[s] || S0[s][k] === undefined) continue;
    if (!f.sections) f.sections = {};
    f.sections[s] = Object.assign({}, f.sections[s] || {}, { [k]: lvClone(S0[s][k]) });
  }
  s.finish = Object.keys(f).length ? f : null;                    // null: the factory finish
  return s;
}
// canonical JSON (keys sorted) - "is the worn livery still the saved one?" never depends on key order
function lvCanon(o) {
  if (Array.isArray(o)) return '[' + o.map(lvCanon).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + lvCanon(o[k])).join(',') + '}';
  return JSON.stringify(o === undefined ? null : o);
}
// THE MEASURED ROWS are not a choice, so "modified?" never reads them (the stored livery keeps them, and the page
// measures them again on whatever plane wears it): the registration's width while it is locked to its letters
// (_cage_ui.js: regW = regH x the text's aspect, the font as this browser draws it) and a FITTED kit layer's box (mNFit:
// its L / C / W / H measured off the plane's own outline)
function lvComparable(lv) {
  const f = lv && lv.finish && lv.finish.decals ? lvClone(lv.finish) : (lv && lv.finish) || null;
  if (f && f.decals) {
    const d = f.decals;
    if (d.regLock === undefined || d.regLock) delete d.regW;
    for (let i = 1; i <= 9; i++) if (d['m' + i + 'Fit']) for (const k of ['L', 'C', 'W', 'H']) delete d['m' + i + k];
  }
  return { paint: (lv && lv.paint) || {}, finish: f };
}
function liverySame(a, b) {
  if (!a || !b) return false;
  const A = lvComparable(a), B = lvComparable(b);
  return lvCanon(A.paint) === lvCanon(B.paint) && lvCanon(A.finish) === lvCanon(B.finish);
}
function liveryName(n, fallback) {
  const s = typeof n === 'string' ? n.replace(/\s+/g, ' ').trim().slice(0, LIVERY_NAME_MAX) : '';
  return s || fallback || 'Livery';
}
// the library as a save carries it, checked: an array of { id, name, paint, finish }, ids unique, names non-empty, at
// most LIVERY_MAX; anything else is dropped (a hand-edited file never breaks a load). null when there is none.
function liveriesClean(list) {
  if (!Array.isArray(list)) return null;
  const out = [], ids = new Set();
  for (const e of list) {
    if (!e || typeof e !== 'object' || !e.paint || typeof e.paint !== 'object') continue;
    let id = typeof e.id === 'string' && e.id ? e.id : 'l' + (out.length + 1);
    while (ids.has(id)) id += '_';
    ids.add(id);
    const f = e.finish && typeof e.finish === 'object' && !Array.isArray(e.finish) ? e.finish : null;
    out.push({ id, name: liveryName(e.name, 'Livery ' + (out.length + 1)), paint: lvClone(e.paint), finish: lvClone(f) });
    if (out.length >= LIVERY_MAX) break;
  }
  return out.length ? out : null;
}
// a fresh id not in the list
function liveryNewId(list) {
  const ids = new Set((list || []).map(e => e.id));
  let n = (list || []).length + 1;
  while (ids.has('l' + n)) n++;
  return 'l' + n;
}
// THE LIBRARY'S OPERATIONS - pure: (state) -> new state. state = { list: [...] | null, on: id | null, spec }.
// A plane with no library has an implicit one-entry library: its worn livery, named "Livery 1" (an old save opens
// as that, and writes nothing until a second livery is saved).
function liveryState(spec, list, on) {
  let L = liveriesClean(list);
  if (!L) L = [{ id: 'l1', name: 'Livery 1', paint: liveryOf(spec).paint, finish: liveryOf(spec).finish }];
  const id = L.some(e => e.id === on) ? on : L[0].id;
  return { list: L, on: id, spec };
}
// is the spec still wearing its saved livery?
function liveryModified(st) {
  const e = st.list.find(x => x.id === st.on);
  return !e || !liverySame(e, liveryOf(st.spec));
}
const LIVERY_OPS = {
  // overwrite the worn entry with what the spec wears now
  save(st) { const w = liveryOf(st.spec); return Object.assign({}, st, { list: st.list.map(e => e.id === st.on ? Object.assign({}, e, w) : e) }); },
  // a new entry from what the spec wears, worn from now on
  saveAs(st, name) {
    if (st.list.length >= LIVERY_MAX) return st;
    const id = liveryNewId(st.list), w = liveryOf(st.spec);
    return Object.assign({}, st, { list: st.list.concat([{ id, name: liveryName(name, 'Livery ' + (st.list.length + 1)), paint: w.paint, finish: w.finish }]), on: id });
  },
  rename(st, id, name) { return Object.assign({}, st, { list: st.list.map(e => e.id === id ? Object.assign({}, e, { name: liveryName(name, e.name) }) : e) }); },
  // never the last one, never the one worn
  remove(st, id) {
    if (st.list.length <= 1 || id === st.on || !st.list.some(e => e.id === id)) return st;
    return Object.assign({}, st, { list: st.list.filter(e => e.id !== id) });
  },
  // wear another entry: the spec takes its paint + finish (keeping the plane's job, wear, weather)
  wear(st, id) {
    const e = st.list.find(x => x.id === id);
    if (!e) return st;
    return Object.assign({}, st, { on: id, spec: liveryApply(st.spec, e) });
  },
  // a livery from another plane's library, added (not worn)
  copyIn(st, lv, name) {
    if (!lv || !lv.paint || st.list.length >= LIVERY_MAX) return st;
    const id = liveryNewId(st.list);
    return Object.assign({}, st, { list: st.list.concat([{ id, name: liveryName(name || lv.name, 'Livery ' + (st.list.length + 1)), paint: lvClone(lv.paint), finish: lvClone(lv.finish || null) }]) });
  },
};
// what the envelope writes: NOTHING for a plane with only its implicit "Livery 1" (latent: today's bytes); else the list
// and the worn id
function liveryEnvelope(st) {
  if (!st || !st.list) return null;
  if (st.list.length === 1 && st.list[0].name === 'Livery 1') return null;   // the implicit one, unnamed: nothing to keep
  return { liveries: st.list.map(e => ({ id: e.id, name: e.name, paint: e.paint, finish: e.finish })), livery: st.on };
}
