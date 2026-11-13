// START_CHOOSER — the sandbox's Fly / Drive verb with its start and destination (START-CHOOSER, the user 13 Nov 2026).
//
// "in sandbox mode, the button 'fly' should have a little option next to it, allowing to choose where to start from ...
// the autopilot takes us from the chosen spawn point to the chosen destination ... 'Fly' for planes and 'Drive' for cars
// ... in the story the planes are real and physical, not in sandbox." (The design page, 13 Nov; the user's answers: one click
// = the remembered start; a plane with no To = the circuit, as today; a car with no To = a random reachable place, said on
// the sheet ("Surprise me: the cannery"); a glider's first start = the car tow; the winch shown greyed until it is built.)
//
// TOW-LAUNCH owns the starts and the go (app.js window.FLYDIY_START: available, vehicle, powered, starts, destinations,
// go); this file draws them, nothing else:
//   THE VERB    the garage's #edRoll reads "Fly" / "Drive" (app.js syncGoLabel calls label(); the bench's "not passed" /
//               "untested" ride the pill's first line and the tooltip). Beside it a pill, #edStart: "From X → Y", opening
//               the sheet. One click on the verb goes from the REMEMBERED start (per kind: plane / glider / car, on this
//               device); nothing remembered yet = today's roll-out, untouched (editor.js asks go() first).
//   THE SHEET   #scSheet: From (grouped: fields / water / launches / places) and To; a row that cannot be used is greyed with
//               its reason and cannot be picked. Desktop: a panel above the verb; the phone: a bottom sheet with From / To
//               tabs. Go rolls out through FLYDIY_START.go; a refusal is said on the sheet and the garage stays.
//   A PLANE'S TO is the route's own (FLYDIY_ROUTE: the flight bar's and the route page's To) - one choice, three places.
//   A CAR'S TO: "Surprise me" (the default): a random place its roads reach, drawn when the sheet opens or at the one click,
//               and said before it drives ("Driving to the cannery").
//   THE STORY (FLYDIY_START.available() false) and a page without FLYDIY_START: the verb is exactly today's, no pill.
// GATE STARTCHOOSER checks it on a DOM stub (tools/_startchooser_check.js).
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : null;
  if (!W) return;
  const S = () => W.FLYDIY_START || null;
  const PREF = 'flydiy.start';
  const SURPRISE = 'SURPRISE', CIRCUIT = 'CIRCUIT';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const GROUP = { field: 'Fields', water: 'Water', trailer: 'Launches', push: 'Launches', cartow: 'Launches', winch: 'Launches', place: 'Places' };
  const GROUP_ORDER = ['Fields', 'Water', 'Launches', 'Places'];
  const LOG = { opens: 0, goes: 0, refused: 0, labels: 0 };
  const st = { el: null, pill: null, open: false, tab: 'from', starts: null, dests: null, pick: null, to: null, surprise: null, msg: '', busy: false, kind: null };

  const avail = () => { try { return !!(S() && S().available()); } catch (e) { return false; } };
  // the kind the start is remembered under: a car, a glider (no engine / motor off) or a plane
  const kindNow = () => { try { const s = S(); return s.vehicle() === 'car' ? 'car' : s.powered() ? 'plane' : 'glider'; } catch (e) { return 'plane'; } };
  const prefs = () => { try { return JSON.parse(W.localStorage.getItem(PREF) || 'null') || {}; } catch (e) { return {}; } };
  const remember = (kind, o) => { try { const p = prefs(); p[kind] = o; W.localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) {} };
  const remembered = kind => { const r = prefs()[kind]; return r && typeof r.start === 'string' ? r : null; };
  // a plane's To is the route's (the flight bar's and the route page's); a car's is its own (remembered, else Surprise me)
  const planeTo = () => { try { const g = W.FLYDIY_ROUTE && W.FLYDIY_ROUTE.get(); return (g && (g.want || g.to)) || CIRCUIT; } catch (e) { return CIRCUIT; } };
  const verbWord = () => (kindNow() === 'car' ? 'Drive' : 'Fly');
  const pickRandom = L => { const ok = (L || []).filter(d => d.ok); return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null; };

  // ---- the verb (app.js syncGoLabel hands it here after it wrote today's words) --------------------------------------
  function label(v, words, warn) {
    LOG.labels++;
    if (!v) return;
    ensurePill(v);
    if (!avail()) { if (st.pill) st.pill.hidden = true; return; }
    v.textContent = verbWord();
    v.title = words + (warn ? ' (the bench has not passed it)' : '');
    syncPill(warn ? words.replace(/^Roll out\s*[—-]?\s*/i, '') : '');
  }
  function ensurePill(v) {
    if (st.pill || !v || !v.parentNode || typeof document === 'undefined') return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'edStart'; b.className = 'verb edStartB';
    b.addEventListener('click', () => openSheet(!st.open));
    v.parentNode.insertBefore(b, v.nextSibling);
    st.pill = b;
  }
  function syncPill(warnWords) {
    if (!st.pill) return;
    st.pill.hidden = !avail();
    if (st.pill.hidden) return;
    const k = kindNow(), r = remembered(k);
    const from = r ? r.label || r.start : 'where it stands';
    const to = k === 'car' ? (r && r.to && r.to !== SURPRISE ? r.toLabel || r.to : 'Surprise me') : toLabelPlane();
    st.pill.innerHTML = '<small>' + esc(warnWords ? warnWords : 'From → to') + '</small><span>' + esc(from) + ' → ' + esc(to) + '</span>';
    st.pill.title = 'Choose where to start and where to go';
  }
  function toLabelPlane() {
    const t = planeTo();
    if (t === CIRCUIT) return 'circuit';
    try { const a = (W.FLIGHT_PROBE && W.FLIGHT_PROBE.world && W.FLIGHT_PROBE.world().aerodromes || []).find(x => x.id === t); return a ? a.name || t : t; } catch (e) { return t; }
  }

  // ---- the one click (editor.js asks before today's roll-out): true = handled here ------------------------------------
  function go() {
    if (!avail() || st.busy) return false;
    const k = kindNow(), r = remembered(k);
    if (!r) return false;                       // nothing chosen yet: today's roll-out, where the plane stands
    if (k !== 'car') { doGo(r.start, planeTo(), r.label); return true; }
    if (r.to && r.to !== SURPRISE) { doGo(r.start, r.to, r.label, r.toLabel); return true; }
    // Surprise me: drawn now from what the roads reach, and said before it drives
    st.busy = true;
    Promise.resolve(S().destinations(r.start)).then(L => {
      st.busy = false;
      const d = pickRandom(L);
      if (!d) { note('No road from ' + (r.label || r.start) + ' reaches another place.'); openSheet(true); return; }
      doGo(r.start, d.id, r.label, d.label);
    }, e => { st.busy = false; note(String((e && e.message) || e)); });
    return true;
  }
  // what go() reads: 'mode:id'. starts() lists a strip or a water lane by its bare aerodrome id ('w3'), which go() would read
  // as mode 'w' and roll out at HOME (the 11:25 page check, 13 Nov) - so a bare id goes as 'field:<id>' (go() treats field
  // and water alike); 'trailer:HOME', 'push:tw_ski', 'cartow:HOME', 'place:...' already carry their mode
  const startArg = s => (!s || /:/.test(String(s))) ? s : 'field:' + s;
  function doGo(start, to, startLabel, toLabel) {
    if (st.busy) return;
    st.busy = true; LOG.goes++; LOG.last = startArg(start);
    if (kindNow() === 'car' && toLabel) note('Driving to ' + toLabel);
    let p;
    try { p = Promise.resolve(S().go({ start: startArg(start), to })); } catch (e) { p = Promise.reject(e); }
    p.then(() => { st.busy = false; closeSheet(); }, e => {
      st.busy = false; LOG.refused++;
      const why = 'Not from there: ' + String((e && e.message) || e);
      openSheet(true); st.msg = why; render();
    });
  }
  function note(t) { st.msg = t; if (st.open) render(); else if (st.pill) st.pill.title = t; }

  // ---- the sheet ------------------------------------------------------------------------------------------------------
  function build() {
    const el = document.createElement('div');
    el.id = 'scSheet'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Where to start');
    el.addEventListener('click', onClick);
    document.body.appendChild(el);
    st.el = el;
    W.addEventListener('keydown', e => { if (st.open && e.key === 'Escape') { e.stopPropagation(); closeSheet(); } }, true);
    W.addEventListener('resize', () => { if (st.open) placeSheet(); });
  }
  // THE SHEET OVER ITS PILL (the 11:25 page check, 13 Nov: anchored right:22 it opened over the editor's panels, far from
  // what was pressed): on a desktop it stands above the pill, centred on it, kept 12 px inside the window; a phone keeps
  // the bottom sheet (the CSS's own place: the inline position cleared)
  function placeSheet() {
    const el = st.el; if (!el || !el.style) return;
    const pill = st.pill || document.getElementById('edStart');
    if (phoneish() || !pill || !pill.getBoundingClientRect) { el.style.left = el.style.right = el.style.bottom = ''; return; }
    const r = pill.getBoundingClientRect(), w = Math.min(540, W.innerWidth - 44);
    if (!(r.width > 0)) { el.style.left = el.style.right = el.style.bottom = ''; return; }
    const left = Math.max(12, Math.min(W.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    el.style.left = Math.round(left) + 'px'; el.style.right = 'auto';
    el.style.bottom = Math.round(Math.max(12, W.innerHeight - r.top + 8)) + 'px';
  }
  function openSheet(on) {
    if (!on) return closeSheet();
    if (!avail()) return;
    if (!st.el) build();
    LOG.opens++;
    st.open = true; st.el.hidden = false; st.tab = 'from'; st.kind = kindNow(); st.msg = '';
    placeSheet();
    const r = remembered(st.kind);
    st.pick = r ? r.start : null;
    st.to = st.kind === 'car' ? (r && r.to) || SURPRISE : planeTo();
    st.starts = null; st.dests = null; st.surprise = null;
    render();
    Promise.resolve(S().starts()).then(L => {
      st.starts = L || [];
      // first time: the glider's car tow (the user's Q4), else the first start that can be used
      if (!st.pick || !st.starts.some(x => x.id === st.pick && x.ok)) {
        const tow = st.kind === 'glider' ? st.starts.find(x => x.mode === 'cartow' && x.ok) : null;
        const first = tow || st.starts.find(x => x.ok);
        st.pick = first ? first.id : null;
      }
      render(); loadDests();
    }, e => { st.starts = []; st.msg = String((e && e.message) || e); render(); });
  }
  function loadDests() {
    if (!st.pick) { st.dests = []; render(); return; }
    const want = st.pick;
    st.dests = null; render();
    Promise.resolve(S().destinations(want)).then(L => {
      if (st.pick !== want) return;
      st.dests = L || [];
      if (st.kind === 'car') {
        st.surprise = pickRandom(st.dests);
        if (st.to !== SURPRISE && !st.dests.some(d => d.id === st.to && d.ok)) st.to = SURPRISE;
      } else if (!st.dests.some(d => d.id === st.to && d.ok)) st.to = CIRCUIT;
      render();
    }, e => { st.dests = []; st.msg = String((e && e.message) || e); render(); });
  }
  function closeSheet() { st.open = false; if (st.el) st.el.hidden = true; syncPill(''); }
  const optHtml = (o, on, kind) => '<button type="button" class="scOpt' + (on ? ' on' : '') + '" data-' + kind + '="' + esc(o.id) + '"' +
    (o.ok ? '' : ' disabled title="' + esc(o.why || '') + '"') + '><b>' + esc(o.label) + '</b><small>' + esc(o.ok ? o.sub || '' : o.why || 'not from here') + '</small></button>';
  function render() {
    if (!st.el || !st.open) return;
    const word = verbWord();
    let from = '<div class="scCol scFrom">';
    if (!st.starts) from += '<div class="scWait">Reading the starts…</div>';
    else {
      for (const g of GROUP_ORDER) {
        const L = st.starts.filter(x => (GROUP[x.mode] || 'Fields') === g);
        if (!L.length) continue;
        from += '<div class="scGh">' + esc(g) + '</div>' + L.map(x => optHtml(x, x.id === st.pick, 'start')).join('');
      }
      if (!st.starts.length) from += '<div class="scWait">Nowhere to start from here.</div>';
    }
    from += '</div>';
    let to = '<div class="scCol scTo"><div class="scGh">To</div>';
    if (!st.dests) to += '<div class="scWait">' + (st.pick ? 'Reading the destinations…' : 'Pick a start first.') + '</div>';
    else {
      if (st.kind === 'car') to += optHtml({ id: SURPRISE, label: 'Surprise me', sub: st.surprise ? 'this time: ' + st.surprise.label : 'a place the roads reach', ok: !!st.surprise, why: 'no road from here reaches another place' }, st.to === SURPRISE, 'to');
      to += st.dests.map(d => optHtml(d, d.id === st.to, 'to')).join('');
    }
    to += '</div>';
    const sOpt = (st.starts || []).find(x => x.id === st.pick), dOpt = st.to === SURPRISE ? st.surprise : (st.dests || []).find(d => d.id === st.to);
    const sum = sOpt ? sOpt.label + ' → ' + (dOpt ? dOpt.label : st.to === CIRCUIT ? 'a circuit' : '…') : 'Pick a start';
    const can = !!(sOpt && sOpt.ok && (st.kind !== 'car' || dOpt) && !st.busy);
    st.el.className = 'scTab-' + st.tab;
    st.el.innerHTML =
      '<div class="scH"><span>START</span><span class="scSeg"><button type="button" data-tab="from"' + (st.tab === 'from' ? ' class="on"' : '') + '>From</button>' +
        '<button type="button" data-tab="to"' + (st.tab === 'to' ? ' class="on"' : '') + '>To</button></span></div>' +
      '<div class="scCols">' + from + to + '</div>' +
      (st.msg ? '<div class="scMsg" role="status">' + esc(st.msg) + '</div>' : '') +
      '<div class="scFoot"><span class="scSum">' + esc(sum) + '</span>' +
        '<button type="button" class="verb" data-act="cancel">Cancel</button>' +
        '<button type="button" class="verb pri" data-act="go"' + (can ? '' : ' disabled') + '>' + esc(word) + '</button></div>';
  }
  function onClick(e) {
    const b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b || b.disabled) return;
    const d = b.dataset || {};
    if (d.tab) { st.tab = d.tab; render(); return; }
    if (d.start) { st.pick = d.start; st.msg = ''; if (phoneish()) st.tab = 'to'; render(); loadDests(); return; }
    if (d.to) { st.to = d.to; st.msg = ''; render(); return; }
    if (d.act === 'cancel') { closeSheet(); return; }
    if (d.act === 'go') choose();
  }
  const phoneish = () => { try { return document.documentElement.classList.contains('phone') || (W.matchMedia && W.matchMedia('(max-width: 700px)').matches); } catch (e) { return false; } };
  // Go from the sheet: remembered for this kind, then rolled out
  function choose() {
    const sOpt = (st.starts || []).find(x => x.id === st.pick);
    if (!sOpt || !sOpt.ok) return;
    let to = st.to, toLabel = '';
    if (st.kind === 'car') {
      const dOpt = to === SURPRISE ? st.surprise : (st.dests || []).find(x => x.id === to);
      if (!dOpt) return;
      remember('car', { start: sOpt.id, label: sOpt.label, to: st.to, toLabel: st.to === SURPRISE ? '' : dOpt.label });
      to = dOpt.id; toLabel = dOpt.label;
    } else remember(st.kind, { start: sOpt.id, label: sOpt.label });
    doGo(sOpt.id, to, sOpt.label, toLabel);
  }

  W.START_CHOOSER = { label, go, open: () => openSheet(true), close: closeSheet, isOpen: () => st.open, LOG,
    _state: () => ({ open: st.open, tab: st.tab, pick: st.pick, to: st.to, surprise: st.surprise && st.surprise.id, msg: st.msg, busy: st.busy, kind: st.kind }),
    _pick: id => onClick({ target: { closest: () => ({ dataset: { start: id }, disabled: false }) } }),
    _to: id => onClick({ target: { closest: () => ({ dataset: { to: id }, disabled: false }) } }),
    _act: a => onClick({ target: { closest: () => ({ dataset: { act: a }, disabled: false }) } }),
    _html: () => (st.el ? st.el.innerHTML : ''), _pill: () => (st.pill ? { hidden: st.pill.hidden, html: st.pill.innerHTML } : null) };
})();
