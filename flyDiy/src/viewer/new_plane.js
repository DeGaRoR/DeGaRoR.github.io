// NEW PLANE — the full-screen new-aeroplane chooser (NEW-PLANE, the user 2-3 Nov 2026).
//
// "this interface should be full screen. At this stage, we only choose, then generate the plane and we're in the
// normal editor. No calculations or rendering while choosing." · "it gets stuck into its own menu, and does not leave
// to the normal sliders" · "The symbols as they are today are OK for now, simple svg, no need for pictures."
//
// THE CONTRACT, which GATE NEWPLANE's flow half holds:
//   1 CHOOSING COSTS NOTHING. A tile click writes one value into `choices` and redraws this panel's own DOM. No spec,
//     no build, no shakedown, no GARAGE_SPEC call; the garage's render loop is HELD behind the opaque panel
//     (window.FLYDIY_UI_HOLD, app.js) for as long as the panel is up.
//   2 ONE BUILD, AT THE END. "Generate" composes the spec (NEW_PLANE_GEN.bake - the archetypes' own recipe), arms the
//     cowl layer's birth preset, and hands the spec to GARAGE_SPEC.set: the one door a new design has ever entered by.
//     Behind a spinner, with a yield first so the spinner paints (the user's rule: spinner + yield, never a freeze).
//   3 A CLEAN HAND-OVER. The panel closes, the hold is released and the editor is put on its normal STRUCTURE view
//     (every slider). Nothing re-opens it but the NEW button (or a first launch with no build ever saved); Generate
//     cannot fire twice.
//   4 ALWAYS A WAY OUT. Back, Skip (the default for that step) and Cancel on every screen; a summary of every pick
//     before Generate, each line a door back to its step.
// It renders NEW_PLANE_GEN (tools/_new_plane.js) and declares nothing: the steps, the greys and their reasons are there.
'use strict';
(function () {

const NG = () => window.NEW_PLANE_GEN;
const D = () => window.CAGE_DESIGN;
const GS = () => window.GARAGE_SPEC;

function svgFor(icon) {
  if (!icon) return '<svg viewBox="0 0 64 40" aria-hidden="true"></svg>';
  const inner = icon.paths.map(p => '<path d="' + p.d + '" ' +
    (p.fill ? 'fill="' + p.fill + '" stroke="none"'
            : 'fill="none" stroke="currentColor" stroke-width="' + (p.w || 1.5) + '" stroke-linejoin="round" stroke-linecap="round"') +
    '/>').join('');
  return '<svg viewBox="' + icon.vb + '" aria-hidden="true">' + inner + '</svg>';
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let el = null, choices = {}, page = 'start', stepI = 0, busy = false, regText = '';
// what the panel did, for the flow check (GATE NEWPLANE): renders, builds asked, the spec handed over
const LOG = { opened: 0, renders: 0, generated: 0, lastSpec: null };

function hold(on) { try { if (window.FLYDIY_UI_HOLD) window.FLYDIY_UI_HOLD(!!on); } catch (e) {} }

function open() {
  if (!NG() || !D()) return false;
  if (busy) return false;
  if (!el) build();
  choices = {}; page = 'start'; stepI = 0; regText = '';
  el.hidden = false;
  document.documentElement.classList.add('npOpen');
  LOG.opened++;
  hold(true);
  render();
  return true;
}
function close() {
  if (!el) return;
  el.hidden = true;
  document.documentElement.classList.remove('npOpen');
  hold(false);
}
const isOpen = () => !!(el && !el.hidden);

function build() {
  el = document.createElement('div');
  el.id = 'npWrap';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'New aeroplane');
  el.innerHTML =
    '<div class="npHead"><span class="npTitle">NEW AEROPLANE</span><span class="npDots"></span>' +
    '<button type="button" class="npBtn npCancel">cancel</button></div>' +
    '<div class="npBody"></div>' +
    '<div class="npFoot"><button type="button" class="npBtn npBack">‹ back</button>' +
    '<span class="npHint"></span>' +
    '<button type="button" class="npBtn npSkip">skip</button>' +
    '<button type="button" class="npBtn npNext npPrimary">next ›</button></div>' +
    '<div class="npSpin" hidden><div class="npSpinBox"><i></i><span>generating the aeroplane…</span></div></div>';
  el.querySelector('.npCancel').addEventListener('click', close);
  el.querySelector('.npBack').addEventListener('click', back);
  el.querySelector('.npSkip').addEventListener('click', skip);
  el.querySelector('.npNext').addEventListener('click', next);
  document.body.appendChild(el);
  // Escape cancels (the panel is modal: nothing behind it takes keys while it is up)
  window.addEventListener('keydown', e => { if (isOpen() && e.key === 'Escape' && !busy) { e.stopPropagation(); close(); } }, true);
}

const steps = () => NG().STEPS;
function stepDone(s) { return s.rows.every(r => choices[r.key] != null); }

function back() {
  if (busy) return;
  if (page === 'summary') { page = 'step'; stepI = steps().length - 1; }
  else if (page === 'step') { if (stepI > 0) stepI--; else page = 'start'; }
  render();
}
function skip() {
  if (busy || page !== 'step') return;
  // the step's defaults (the class's typical aeroplane, bent by what is chosen so far) - written, so the summary says
  const s = steps()[stepI];
  for (const r of s.rows) if (choices[r.key] == null) choices[r.key] = NG().defaultFor(choices, r.key);
  advance();
}
function next() {
  if (busy) return;
  if (page === 'start') { page = 'step'; stepI = 0; render(); return; }
  if (page === 'step') { skip(); return; }
  if (page === 'summary') generate();
}
function advance() {
  if (stepI < steps().length - 1) stepI++;
  else page = 'summary';
  render();
}
// a pick: one value written, every later pick that the rule table now greys cleared (and the default takes its place
// at the summary), the panel redrawn - nothing else
function pick(rowKey, value) {
  if (busy) return;
  choices[rowKey] = value;
  const done = NG().complete(choices);
  for (const k of done.cleared) delete choices[k];
  const s = steps()[stepI];
  // a one-row step moves on by itself; a several-row step waits for "next" once each row has its pick
  if (s.rows.length === 1) advance();
  else render();
}

function render() {
  LOG.renders++;
  const body = el.querySelector('.npBody');
  const dots = el.querySelector('.npDots');
  const st = steps();
  dots.innerHTML = st.map((s, i) => '<i class="' + (page === 'step' && i === stepI ? 'on' : stepDone(s) ? 'done' : '') +
    '" title="' + esc(s.title) + '"></i>').join('') + '<i class="sum' + (page === 'summary' ? ' on' : '') + '" title="summary"></i>';
  const fb = el.querySelector('.npBack'), fs = el.querySelector('.npSkip'), fn = el.querySelector('.npNext');
  const hint = el.querySelector('.npHint');
  fb.disabled = page === 'start';
  fs.hidden = page !== 'step';
  fn.textContent = page === 'summary' ? 'generate' : page === 'start' ? 'start ›' : 'next ›';
  fn.classList.toggle('npGo', page === 'summary');
  hint.textContent = page === 'step' ? 'step ' + (stepI + 1) + ' of ' + st.length + ' · skip takes the usual choice' : '';
  body.innerHTML = '';
  body.scrollTop = 0;
  if (page === 'start') renderStart(body);
  else if (page === 'step') renderStep(body, st[stepI]);
  else renderSummary(body);
}

function renderStart(body) {
  const g = NG(), d = D();
  let warn = '';
  try { warn = GS().name() ? '' : 'generating replaces the unsaved build on the stand'; } catch (e) {}
  body.insertAdjacentHTML('beforeend',
    '<div class="npLead">Choose the main things - the size, the engines, the wing, the gear, the tail, the cabin, ' +
    'what it is made of and its colour. Nothing is built until you press <b>generate</b>; then you are in the editor ' +
    'with every slider.' + (warn ? '<br><em class="npWarn">' + esc(warn) + '</em>' : '') + '</div>');
  const row = document.createElement('div');
  row.className = 'npGrid npStartGrid';
  const big = (label, note, f, cls) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'npTile npBig ' + (cls || '');
    b.innerHTML = '<b>' + esc(label) + '</b><small>' + esc(note) + '</small>';
    b.addEventListener('click', f);
    row.appendChild(b);
  };
  big('Design a new aeroplane', 'fourteen short choices, then one build', () => { page = 'step'; stepI = 0; render(); }, 'npLit');
  big('Surprise me', 'a random set of working choices - you see them before anything is built', () => {
    choices = g.randomChoices((Date.now() ^ (Math.random() * 1e9)) >>> 0); page = 'summary'; render(); });
  body.appendChild(row);
  // START LIKE A CARD: the shed's generated cards as choice sets (the coverage table, made usable) - to the summary,
  // where every pick is a door back
  const gen = d.ARCHETYPES.filter(a => !g.authored(a) && !d.archInactive(a));
  if (gen.length) {
    body.insertAdjacentHTML('beforeend', '<div class="npSecH">start like one of the shed\'s designs - the choices filled in, yours to change</div>');
    const gg = document.createElement('div');
    gg.className = 'npGrid npSmall';
    for (const a of gen) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'npTile';
      b.innerHTML = svgFor(a.icon || (d.archIcon ? d.archIcon(a) : null)) + '<b>' + esc(a.name) + '</b>';
      b.title = a.note || '';
      b.addEventListener('click', () => { choices = g.complete(g.fromArchetype(a)).choices; page = 'summary'; render(); });
      gg.appendChild(b);
    }
    body.appendChild(gg);
  }
  // CANDIDATE OFFICIAL (FINISH-4, the user 2 Nov: "offered as their own archetype ... labeled as such"): the staging
  // pool's whole builds (builds/candidates/, garage.js candidates) - a card opens the FILE as built, unnamed and with no
  // plaque; drawn when the pool's index answers, the same door the old overlay used (GARAGE_SPEC.openCandidate)
  const g0 = GS();
  if (g0 && g0.candidates && g0.openCandidate) {
    const host = document.createElement('div');
    body.appendChild(host);
    try {
      g0.candidates().then(list => {
        if (!list || !list.length || page !== 'start' || !isOpen()) return;
        host.insertAdjacentHTML('beforeend', '<div class="npSecH">candidate official — built, not validated</div>');
        const gc = document.createElement('div');
        gc.className = 'npGrid npSmall';
        for (const c of list) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'npTile';
          b.innerHTML = '<b>' + esc(c.name || c.file) + '</b><small>' + esc('candidate official' + (c.note ? ' — ' + c.note : '')) + '</small>';
          b.title = c.file + ': designed and built, not validated - no certificate';
          b.addEventListener('click', () => withSpinner(() => { LOG.generated++; g0.openCandidate(c); }));
          gc.appendChild(b);
        }
        host.appendChild(gc);
      }, () => {});
    } catch (e) {}
  }
  // THE AUTHORED RECREATIONS: hand-made to a reference, baked as they are (one build, the same hand-over)
  const auth = d.ARCHETYPES.filter(a => g.authored(a));
  if (auth.length) {
    body.insertAdjacentHTML('beforeend', '<div class="npSecH">or take an authored recreation as it was drawn</div>');
    const ga = document.createElement('div');
    ga.className = 'npGrid npSmall';
    for (const a of auth) {
      const reason = d.archInactive(a);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'npTile';
      b.innerHTML = svgFor(a.icon || (d.archIcon ? d.archIcon(a) : null)) + '<b>' + esc(a.name) + '</b>' +
        (reason ? '<small class="npWhy">' + esc(reason) + '</small>' : '');
      if (reason) b.disabled = true;
      else b.addEventListener('click', () => generateCard(a));
      ga.appendChild(b);
    }
    body.appendChild(ga);
  }
}

function renderStep(body, s) {
  const g = NG();
  body.insertAdjacentHTML('beforeend', '<div class="npStepH"><b>' + esc(s.title) + '</b><span>' + esc(s.help || '') + '</span></div>');
  for (const r of s.rows) {
    if (s.rows.length > 1) body.insertAdjacentHTML('beforeend', '<div class="npSecH">' + esc(r.label || r.key) + '</div>');
    const grid = document.createElement('div');
    grid.className = 'npGrid';
    for (const o of r.opts()) {
      const why = g.why(choices, r.key, o.value);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'npTile' + (choices[r.key] === o.value ? ' on' : '');
      b.innerHTML = svgFor(o.icon) + '<b>' + esc(o.label) + '</b>' +
        (why ? '<small class="npWhy">' + esc(why) + '</small>' : o.note ? '<small>' + esc(o.note) + '</small>' : '');
      if (why) b.disabled = true;
      else b.addEventListener('click', () => pick(r.key, o.value));
      grid.appendChild(b);
    }
    body.appendChild(grid);
  }
}

function renderSummary(body) {
  const g = NG();
  const done = g.complete(choices);
  body.insertAdjacentHTML('beforeend', '<div class="npStepH"><b>Your aeroplane</b><span>every line is a door back to its ' +
    'step; generate builds it once and opens the editor</span></div>');
  const list = document.createElement('div');
  list.className = 'npSum';
  g.STEPS.forEach((s, i) => {
    for (const r of s.rows) {
      const v = done.choices[r.key];
      const o = r.opts().find(x => x.value === v);
      const chosen = choices[r.key] != null;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'npSumRow';
      b.innerHTML = svgFor(o && o.icon) + '<span>' + esc(s.rows.length > 1 ? s.title + ' · ' + (r.label || r.key) : s.title) +
        '</span><b>' + esc(o ? o.label : '-') + '</b>' +
        (done.cleared.indexOf(r.key) >= 0 ? '<small class="npWhy">your pick no longer fits: the usual one</small>'
          : chosen ? '' : '<small>the usual choice</small>');
      b.addEventListener('click', () => { page = 'step'; stepI = i; render(); });
      list.appendChild(b);
    }
  });
  body.appendChild(list);
  // the registration (the brief's "name + registration": the NAME is the save slot's, G65 - the registration is a
  // spec field, painted on the boom; optional, the editor's own field keeps it)
  const reg = document.createElement('label');
  reg.className = 'npReg';
  reg.innerHTML = '<span>registration (optional)</span>';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.maxLength = 8; inp.value = regText; inp.placeholder = 'e.g. F-PNEW';
  inp.addEventListener('input', () => { regText = String(inp.value || '').toUpperCase().slice(0, 8); });
  reg.appendChild(inp);
  body.appendChild(reg);
}

// THE ONE BUILD. The spinner paints first (two frames), then the bake (~0.5 s) and GARAGE_SPEC.set (the editor's
// build); the hand-over runs once, whatever happens, and the panel never re-opens by itself.
function withSpinner(work) {
  if (busy) return;
  busy = true;
  const sp = el.querySelector('.npSpin');
  sp.hidden = false;
  for (const b of el.querySelectorAll('button')) b.disabled = true;
  const raf = window.requestAnimationFrame || (f => setTimeout(f, 16));
  raf(() => raf(() => setTimeout(() => {
    let ok = false;
    try { work(); ok = true; }
    catch (e) { console.error('new plane:', e); }
    busy = false;
    sp.hidden = true;
    if (ok) {
      close();
      if (window.EDITOR_SET_VIEW) { try { window.EDITOR_SET_VIEW('shape'); } catch (e) {} }
    } else render();
  }, 0)));
}
function generate() {
  withSpinner(() => {
    const r = NG().bake(choices);
    if (regText.trim()) r.spec.meta = Object.assign({}, r.spec.meta || {}, { reg: regText.trim() });
    LOG.generated++; LOG.lastSpec = r.spec;
    if (window.CAGE_COWL_BIRTH_PRESET) window.CAGE_COWL_BIRTH_PRESET(r.cowlPreset);
    GS().set(r.spec);
    // THE STANCE FIT (NEW_PLANE_GEN.stanceFit): the drawn aeroplane read once - its CG over its drawn wheels - and
    // the legs moved by the core's rules; loaded again only when a leg moved (the same spinner, no other build)
    // (each pass re-reads what the previous load drew: at most FIT_PASSES, stopping as soon as nothing needs to move)
    LOG.fit = null;
    for (let pass = 0; pass < NG().FIT_PASSES; pass++) {
      let fit = null;
      try { fit = NG().stanceFit(GS().get(), null); } catch (e) { fit = null; }
      if (!fit) break;
      const s2 = GS().get();
      s2.cage = Object.assign({}, s2.cage || {}, fit);
      LOG.fit = Object.assign(LOG.fit || {}, fit, { passes: pass + 1 });
      GS().set(s2);
    }
  });
}
function generateCard(a) {
  withSpinner(() => {
    const spec = D().designBake(a.sel, a.over);
    LOG.generated++; LOG.lastSpec = spec;
    if (window.CAGE_COWL_FIT_NEXT) window.CAGE_COWL_FIT_NEXT();
    GS().set(spec);
  });
}

window.NEW_PLANE = { open, close, isOpen, LOG, _state: () => ({ page, stepI, choices: Object.assign({}, choices), busy }),
                     _pick: pick, _next: next, _skip: skip, _back: back };
})();
