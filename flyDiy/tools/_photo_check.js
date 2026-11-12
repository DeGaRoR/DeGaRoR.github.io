#!/usr/bin/env node
// _photo_check.js - GATE PHOTO (PHOTO-MODE-2 P1, 2026-11-12): the photo bar, photo.js run from its own source over a
// small DOM, and its wiring and look (app.js, editor.js, the CSS) read off the sources.
//
//   node tools/_photo_check.js   -> "GATE PHOTO: PASS|FAIL", exit 1 on FAIL
//
// 1. THE BAR (photo.js): hidden until begin; begin shows the top bar and the shutter, one slot per api slot (label over
//    value) in the table's order; a slot opens ITS flyout (its rows built into #photoBody, its title), a second press
//    closes it, another slot switches; Esc closes the flyout first (and stops there), a click on the picture closes it,
//    a click in the bar does not; refresh rewrites the values and the open rows; the shutter calls take, Done calls
//    done; end hides it all; a slot that throws does not take the bar down.
// 2. THE WIRING (app.js / editor.js): the bar opens only through FLYDIY_PHOTO.open (a bare SHOT_MODE.enter, the rigs',
//    stays the render alone), the bar opens in the shed too, Done's bubble gives back the camera, the field of view,
//    the pause, the hour (only when the light slot moved it, never the career's) and the shed's mood; the shed's pill
//    opens photo mode; the shutter fires flydiy:shutter inside the gesture; photo.js is in MANIFEST before app.js.
// 3. THE LOOK (flight.css / editor.css / style.css): the bar on the TOP row (the user: "all the options are on the top
//    bar"), the shutter a round half-transparent button with no frame, bottom centre; the Bone tokens on the bar; held
//    under the loading screen; #shotBack off while the bar is up.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), V = f => fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8');
let fails = 0;
const ok = (c, msg, got) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (got !== undefined ? '  [' + got + ']' : '')); if (!c) fails++; };

// ---- a small DOM: enough tree for photo.js (it builds, finds, toggles, measures) ----------------------------------------
function dom() {
  const listeners = { window: {}, document: {} };
  const on = (bag, t, f, cap) => { (bag[t] = bag[t] || []).push({ f, cap: !!cap }); };
  function El(tag) {
    const e = { tagName: String(tag).toUpperCase(), id: '', className: '', hidden: false, children: [], parentNode: null, dataset: {}, style: {},
      attrs: {}, textContent: '', scrollTop: 0, offsetWidth: 10, type: '', onclick: null, title: '',
      appendChild(c) { if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1); c.parentNode = this; this.children.push(c); return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); },
      get firstChild() { return this.children[0] || null; },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
      contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; },
      getBoundingClientRect() { const i = this.parentNode ? this.parentNode.children.indexOf(this) : 0; return { left: 30 + i * 110, right: 130 + i * 110, top: 18, bottom: 78, width: 100, height: 60 }; },
      click() { if (this.onclick) this.onclick({ target: this }); },
    };
    const set = new Set();
    e.classList = { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), toggle: (c, f) => { const v = f === undefined ? !set.has(c) : !!f; if (v) set.add(c); else set.delete(c); return v; } };
    return e;
  }
  const body = El('body');
  const find = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const r = find(c, id); if (r) return r; } return null; };
  const document = { body, createElement: El, getElementById: id => find(body, id), addEventListener: (t, f, c) => on(listeners.document, t, f, c) };
  const window = { innerWidth: 1280, innerHeight: 720, document, addEventListener: (t, f, c) => on(listeners.window, t, f, c), console };
  const fire = (bag, t, ev) => { let stopped = false; ev.preventDefault = () => {}; ev.stopImmediatePropagation = () => { stopped = true; };
    for (const L of (listeners[bag][t] || [])) { if (stopped) break; L.f(ev); } return stopped; };
  return { window, document, body, find, fire };
}

// ---- 1. the bar --------------------------------------------------------------------------------------------------------
console.log('1. the bar (photo.js over a small DOM)');
{
  const D = dom(), W = D.window;
  const box = { window: W, document: D.document, console };
  vm.createContext(box);
  vm.runInContext(V('photo.js'), box, { filename: 'photo.js' });
  const P = W.PHOTO;
  ok(P && ['init', 'begin', 'end', 'refresh', 'flash', 'open', 'on'].every(k => typeof P[k] === 'function'), 'window.PHOTO has its doors');
  const log = [], built = [];
  let fov = 38, hour = '16:00', boom = false;
  const api = {
    slots: () => [
      { k: 'camera', label: 'camera', title: 'The camera', value: () => 'chase · ' + fov + '°', build: b => { built.push('camera'); const r = D.document.createElement('div'); r.className = 'fr'; r.textContent = 'field of view ' + fov; b.appendChild(r); } },
      { k: 'light', label: 'light', title: 'The light', value: () => hour, build: b => { built.push('light'); if (boom) throw new Error('boom'); b.appendChild(D.document.createElement('div')); } },
    ],
    take: () => log.push('take'), done: () => log.push('done'), meta: () => 'paused',
  };
  P.init(api);
  const $ = id => D.find(D.body, id);
  ok($('photoTop') && $('photoTop').hidden && $('photoShutter').hidden && $('photoFly').hidden, 'built hidden: nothing on the screen before begin');
  P.begin();
  const slots = () => $('photoSlots').children;
  ok(!$('photoTop').hidden && !$('photoShutter').hidden && $('photoFly').hidden && P.on() && D.body.classList.contains('photoOn'), 'begin: the top bar and the shutter, no flyout, body.photoOn');
  ok(slots().map(b => b.dataset.k).join() === 'camera,light' && slots()[0].children[0].textContent === 'camera' && slots()[0].children[1].textContent === 'chase · 38°',
     'one slot per api slot, in order, label over value', slots().map(b => b.children[0].textContent + '=' + b.children[1].textContent).join(' '));
  ok($('photoMeta').textContent === 'paused', 'the plate\'s meta is the api\'s');
  slots()[0].click();
  ok(!$('photoFly').hidden && P.openSlot() === 'camera' && built.join() === 'camera' && $('photoBody').children.length === 1 && $('photoFlyHead').textContent === 'The camera', 'a slot opens its flyout: its rows, its title');
  ok(slots()[0].classList.contains('open') && slots()[0].getAttribute('aria-expanded') === 'true', 'the open slot is marked (and says so)');
  ok($('photoFly').style.top === '86px' && $('photoFly').style.left === '30px', 'the flyout sits UNDER its own slot', $('photoFly').style.left + ', ' + $('photoFly').style.top);
  slots()[1].click();
  ok(P.openSlot() === 'light' && built.join() === 'camera,light' && $('photoFly').style.left === '140px', 'another slot switches the flyout (under that slot)', $('photoFly').style.left);
  slots()[1].click();
  ok($('photoFly').hidden && P.openSlot() === null, 'the same slot again closes it');
  slots()[0].click(); fov = 52; P.refresh();
  ok(slots()[0].children[1].textContent === 'chase · 52°' && $('photoBody').children[0].textContent === 'field of view 52', 'refresh rewrites the values and the open rows');
  const stopped = D.fire('window', 'keydown', { key: 'Escape' });
  ok($('photoFly').hidden && stopped && P.on(), 'Esc closes the flyout and stops there (the bar stays)');
  ok(!D.fire('window', 'keydown', { key: 'Escape' }), '...a second Esc passes on (to shotSet: out of photo mode)');
  slots()[0].click();
  D.fire('document', 'pointerdown', { target: $('photoBody') });
  ok(!$('photoFly').hidden, 'a click inside the flyout keeps it');
  D.fire('document', 'pointerdown', { target: D.body });
  ok($('photoFly').hidden, 'a click on the picture closes it');
  $('photoShutter').click(); $('photoDone').click();
  ok(log.join() === 'take,done', 'the shutter takes, Done is the api\'s done', log.join());
  boom = true; slots()[1].click();
  ok(!$('photoFly').hidden && P.on(), 'a slot whose rows throw does not take the bar down');
  P.flash();
  ok($('photoFlash').classList.contains('on'), 'the flash blinks the page');
  // P2: THE SPINNER - in the middle, the ring's %, one line, a fainter one; Esc cancels a picture in progress FIRST
  log.length = 0; boom = false; api.cancel = () => log.push('cancel');
  P.progress({ pct: 0.64, line: 'Growing the far trees', sub: '14 s \u00b7 at most 55 s' });
  ok(!$('photoSpin').hidden && P.busy() && D.body.classList.contains('photoBusy') && $('photoRing').children[0].textContent === '64%' && $('photoLine').textContent === 'Growing the far trees',
     'progress: the spinner shows the %, its line, and the bar waits (body.photoBusy)', $('photoRing').children[0].textContent);
  ok($('photoFly').hidden, '...and an open flyout closes for it');
  ok(D.fire('window', 'keydown', { key: 'Escape' }) && log.join() === 'cancel' && P.on(), 'Esc while busy cancels the picture (and only that)');
  $('photoCancel').click();
  ok(log.join() === 'cancel,cancel', 'the cross cancels too');
  P.progress({ pct: null, line: 'Getting the scene ready' });
  ok($('photoRing').children[0].textContent === '', 'no number until there is one');
  P.progress(null);
  ok($('photoSpin').hidden && !P.busy() && !D.body.classList.contains('photoBusy'), 'progress(null): gone, the bar back');
  P.progress({ pct: 0.1, line: 'x' });
  P.end();
  ok($('photoSpin').hidden && !D.body.classList.contains('photoBusy'), 'end takes the spinner away too');
  ok($('photoTop').hidden && $('photoShutter').hidden && $('photoFly').hidden && !P.on() && !D.body.classList.contains('photoOn'), 'end hides the bar, the flyout and the shutter');
  ok(!D.fire('window', 'keydown', { key: 'Escape' }), 'after end, Esc is not the bar\'s');
  ok(['photoTop', 'photoFly', 'photoShutter', 'photoFlash', 'photoSpin'].every(id => D.body.children.filter(c => c.id === id).length === 1), 'one of each element, at the body (outside #ui and #wsUI, which body.shot hides)');
}

// ---- 2. the wiring -------------------------------------------------------------------------------------------------------
console.log('2. the wiring (app.js, editor.js, build.js)');
{
  const APP = V('app.js'), ED = V('editor.js'), BUILD = fs.readFileSync(path.join(ROOT, 'tools', 'build.js'), 'utf8');
  const sec = (() => { const a = APP.indexOf('// ---- PHOTO-MODE-2 P1: THE PHOTO BAR'); return a < 0 ? '' : APP.slice(a, APP.indexOf('window.FLYDIY_PHOTO = {', a) + 400); })();
  ok(sec.length > 0, 'app.js has the photo section');
  ok(/photoHook = on => \{ if \(on\) \{ if \(photoWant\) photoBegin\(\); \} else photoEnd\(\); \};/.test(sec) && /function photoOpen\(\) \{ photoWant = true;/.test(sec),
     'the bar opens only when asked (FLYDIY_PHOTO.open sets photoWant): a bare SHOT_MODE.enter stays the render alone');
  ok(!/if \(photoOn \|\| inGarage\) return/.test(APP) && /if \(inGarage\) \{ const G = photoGE\(\); photoWas = \{ garage: true/.test(sec), 'the bar opens in the shed too (no inGarage refusal), with the shed\'s own bubble');
  ok(/if \(cam\.mode !== w\.mode\) flCamMode\(w\.mode\);/.test(sec) && /cam\.fov = w\.fov;/.test(sec) && /if \(w\.held && !running && !inGarage\) gmHold\(false\);/.test(sec),
     'Done gives back the camera\'s mode, its field of view and the pause');
  ok(/if \(photoDayTouched && w\.day && now/.test(sec) && /!\(D0\.isCareer && D0\.isCareer\(\)\)/.test(sec), 'the hour comes back only when the light slot moved it, and never the career\'s');
  ok(/if \(garageFov !== w\.fov\) photoGFov\(w\.fov\);/.test(sec) && /G\.setMood\(w\.mood\)/.test(sec), 'in the shed: the field of view and the mood come back');
  ok(/function photoTake\(\) \{\n\s*if \(photoGrab \|\| photoBusy\) return;\n\s*try \{ window\.dispatchEvent\(new CustomEvent\('flydiy:shutter'/.test(sec), 'the shutter fires flydiy:shutter first, inside the gesture (G3744)');
  ok(/if \(window\.PHOTO\) window\.PHOTO\.flash\(\);\n\s*let sc = null; try \{ sc = sceneGet\(/.test(sec), 'P2: the flash at the press (the answer is immediate), the scene taken as it was at the press');
  ok(/photoShoot\(\{ steps: [^\n]*\)\n\s*\.then\(r => \{[^\n]*return photoEmbed\(r\.blob, sc\); \}\)\.then\(photoSave\)/.test(sec), 'P2: the shot is photoShoot\'s, and the PNG carries its scene (photoEmbed)');
  // P4: the high-quality steps - the layer pushed and ALWAYS popped (photoShoot's finally), the cap, the governors
  ok(/finally \{\n\s*if \(o\.steps && o\.steps\.restore\) \{ try \{ o\.steps\.restore\(\);/.test(sec), 'P4: every high-quality setting comes back in the shot\'s finally (a cancel, a throw, a lost context included)');
  ok(/steps\.restore = \(\) => \{\n\s*try \{ if \(G && G\.pop\) G\.pop\(\); \}/.test(sec) && /if \(G && G\.push\) G\.push\(tier === 'full' \? HQ_FULL : HQ_LIGHT, 'photo'\);/.test(sec), 'P4: the settings through GFX.push / pop (the player\'s never written)');
  ok(/const HQ_LOD = \[150, 1000, 1000\], HQ_FADE = 60;/.test(sec) && /density: 200, bands: 'far'/.test(sec), 'P4: the night hero\'s reference (density 200, the full tree to 150 m, real trees to 1000 m, fade 60)');
  ok(/return \(b === 'gamer' \|\| b === 'ultra' \|\| b === 'current'\) \? 'full' : 'light';/.test(sec), 'P4: scaled to the machine (a potato / laptop / retro page keeps its forest)');
  ok(/const capAt = t0 => t0 \+ SCENE_HQ_CAP_S \* 1000 - 4000;/.test(sec) && /document\.hidden\) dl \+= now - last;/.test(sec), 'P4: one cap from the shutter (SCENE_HQ_CAP_S), a hidden tab\'s time not counted');
  ok(/canvas\.addEventListener\('webglcontextlost', onLost\)/.test(sec) && /G\.hw\.hold\(true\)/.test(sec) && /aa\.autoScale\(false\)/.test(sec) && /entryTypes: \['longtask'\]/.test(sec), 'P4: a lost context cancels; the governors held; the long tasks measured');
  ok(/let photoHq = false;/.test(sec) && /prefGet\('flydiy\.photoHq', '0'\) === '1'/.test(sec), 'P4: high quality is OFF by default (opt-in, remembered)');
  ok(/photoGrab = cv => \{\n\s*try \{\n\s*const bw = cv\.width, bh = cv\.height;/.test(sec), 'the picture is still the next presented frame\'s canvas (photoGrab), cut about its centre');
  ok(/window\.FLYDIY_PHOTO = \{ open: photoOpen, take: photoTake/.test(sec), 'window.FLYDIY_PHOTO.open / take');
  ok(/bShot\.onclick = \(\) => \{ gmOpen\(false\); if \(window\.FLYDIY_PHOTO && window\.FLYDIY_PHOTO\.open\) window\.FLYDIY_PHOTO\.open\(\);/.test(APP), 'the flight\'s corner camera opens photo mode');
  ok(/window\.FLYDIY_PHOTO\.open\(\); else window\.SHOT_MODE\.enter\(\);/.test(ED) && /b\.textContent = ph \? 'photo mode' : 'screenshot';/.test(ED), 'the shed\'s pill opens photo mode (\'photo mode\')');
  ok(!/id="photoBar"|'photoBar'|#photoBar/.test(APP + V('flight.css') + V('style.css')), 'the old bottom-left #photoBar is gone everywhere');
  const sc = (BUILD.match(/scripts: \[[\s\S]*?\]/g) || []).find(x => x.includes("'app.js'")) || '';
  ok(sc.indexOf("'photo.js'") > 0 && sc.indexOf("'photo.js'") < sc.indexOf("'app.js'"), 'build.js: photo.js in the viewer scripts, before app.js');
}

// ---- 3. the look -------------------------------------------------------------------------------------------------------------
console.log('3. the look (the CSS)');
{
  const FL = V('flight.css'), ED = V('editor.css'), ST = V('style.css');
  const rule = sel => { const i = FL.indexOf('\n' + sel + ' {'); return i < 0 ? '' : FL.slice(i, FL.indexOf('}', i)); };
  const top = rule('#photoTop'), sh = rule('#photoShutter');
  ok(/position:fixed/.test(top) && /top:18px/.test(top) && /left:22px/.test(top) && /right:22px/.test(top), 'the bar is the TOP row (left 22, right 22, top 18: the flight interface\'s)');
  ok(/margin-left:auto/.test(rule('#photoDone')), 'Done at the right of the top row');
  ok(/left:50%/.test(sh) && /bottom:calc\(/.test(sh) && /border-radius:50%/.test(sh) && /border:0/.test(sh), 'the shutter: round, bottom centre, no border');
  const bg = (sh.match(/background:rgba\(255,255,255,\.(\d+)\)/) || [])[1];
  ok(bg && +('0.' + bg) >= 0.2 && +('0.' + bg) <= 0.6, 'the shutter is half transparent (no plate)', 'alpha .' + bg);
  ok(/:is\([^)]*#photoTop, #photoFly\) \{/.test(ED), 'the Bone tokens reach the bar and its flyout (editor.css\'s list, not a third copy of the hexes)');
  ok(/:root\.fdBoot :is\([^)]*#photoTop, #photoFly, #photoShutter[^)]*\) \{ visibility:hidden !important; \}/.test(ST), 'held under the loading screen (STORY-1)');
  ok(/body\.photoOn #shotBack \{ display:none !important; \}/.test(FL), 'the screenshot mode\'s way back is off while the bar (Done) is up');
  ok(/#photoFlash \{ position:fixed; inset:0;[^}]*pointer-events:none; \}/.test(FL), 'the flash takes no clicks');
}

console.log('GATE PHOTO: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
