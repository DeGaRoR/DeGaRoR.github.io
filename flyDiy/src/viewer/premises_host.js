// premises_host.js — THE EDITOR'S HOST (the premises port, L3): what a page must give the editor
// module (premises_ui.js) besides a renderer - the CAMERAS (orbit and map over the premises),
// the GROUND PICK (an analytic march of the eye's ray against the composed ground, never the
// mesh), the MOUSE on the view (right-drag turns, middle-drag pans, wheel zooms), the ROW
// builders the inspector draws with, and the SITE functions the core publishes. ONE keeper for
// the bench page (tools/_premises.html) and the game's WORLD rail (app.js), which had grown the
// same 120 lines twice.
//
// make(o):  o = { THREE, world, size, view (the element the mouse is read on), canvas (the rect the
//                 ray is cast in), R: () => the RENDER_PREMISES instance (its heightAt is the ground),
//                 persp: a PerspectiveCamera to PLACE (the game hands its own; the bench lets the
//                 host make one), map: 'ortho' | 'persp' (the game renders with one perspective
//                 camera, so its map is a plumb view from high up), storageKey, onDraw() }
//   -> { cameras { mode, set, toggle, look, view, frame }, camera(), place(rect), ray(cx, cy),
//        ground(cx, cy), centre, persp, ortho, saveView(), attach(), detach(), rows, site() }
'use strict';
(function () {
const PREMISES_HOST = {};

PREMISES_HOST.make = function (o) {
  const THREE = o.THREE, world = o.world, size = o.size || 640;
  const view = o.view, cv = o.canvas || view;
  const persp = o.persp || new THREE.PerspectiveCamera(40, 1, 0.5, size * 6);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, size * 6);
  ortho.up.set(0, 0, -1);
  const mapKind = o.map || 'ortho';
  const draw = () => { if (o.onDraw) o.onDraw(); };
  const centre = new THREE.Vector3(0, 0, 0);
  if (world.bounds) { centre.set((world.bounds.x0 + world.bounds.x1) / 2, 0, (world.bounds.z0 + world.bounds.z1) / 2); }
  centre.y = world.terrainH(centre.x, centre.z);
  let camMode = 'orbit', yaw = -0.6, pitch = 0.62, ZOOM = 0.8, mapHalf = size * 0.55;
  let drag = null, panD = null;
  const KEY = o.storageKey || 'flydiy.prem.view';
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.world === world.id) { yaw = v.yaw; pitch = v.pitch; ZOOM = v.zoom; camMode = v.mode === 'map' ? 'map' : 'orbit';   /* (a saved 'fly' reopens as the orbit: the fly's pose is the session's) */ mapHalf = v.mapHalf || mapHalf; if (v.c) centre.set(v.c[0], v.c[1], v.c[2]); } } catch (e) {}
  const saveView = () => { try { localStorage.setItem(KEY, JSON.stringify({ world: world.id, yaw, pitch, zoom: ZOOM, mode: camMode, mapHalf, c: [centre.x, centre.y, centre.z] })); } catch (e) {} };
  const camera = () => (camMode === 'map' && mapKind === 'ortho' ? ortho : persp);
  // THE FLY CAMERA (G2915, the user 11 Oct: "the same controls as the world editor: WASD to move (or ZQSD, depending on
  // the layout), R and F for up and down, and camera speed"): the world editor's own free camera (o.fly = the game's
  // DEV_CAM - its keys read by POSITION, e.code, so ZQSD on AZERTY; R / F; Shift x5; its speed) drives the perspective
  // camera; seeded from where the eye is when it is taken. Right-drag looks, the wheel sets its speed.
  const flyOk = () => !!(o.fly && o.fly.update && o.fly.enter);
  const cameras = {
    mode: () => camMode,
    set: m => {
      const was = camMode;
      camMode = m === 'map' ? 'map' : (m === 'fly' && flyOk()) ? 'fly' : 'orbit';
      if (camMode === 'fly' && was !== 'fly') { o.fly.enter(); if (was === 'map') o.fly.pitch = -0.7; }   // (from the plumb map view: tipped up to a look ahead)
      if (o.onMode) o.onMode(camMode); saveView(); draw();
    },
    toggle: () => cameras.set(camMode === 'orbit' ? 'map' : camMode === 'map' && flyOk() ? 'fly' : 'orbit'),
    flyOk,
    speed: v => { if (!flyOk()) return null; if (isFinite(v)) o.fly.speed = Math.max(1, Math.min(400, +v)); return o.fly.speed; },
    // a scripted aim: the orbit's yaw and pitch (radians), for the captures a script takes
    look: (y, p) => { if (isFinite(y)) yaw = y; if (isFinite(p)) pitch = p; saveView(); draw(); },
    view: () => ({ yaw, pitch, zoom: ZOOM, mode: camMode, centre: [centre.x, centre.y, centre.z], mapHalf }),
    frame: bb => { const R = o.R(); if (!bb || !R) return; if (camMode === 'fly') { camMode = 'orbit'; if (o.onMode) o.onMode(camMode); }   /* (G2915: framing a feature hands the eye back to the orbit round it) */ const F = R.overlay.frame; const a = F.toWorld((bb.x0 + bb.x1) / 2, (bb.z0 + bb.z1) / 2); centre.set(a[0], world.terrainH(a[0], a[1]), a[1]); const span = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0, 20); ZOOM = size * 0.55 / (span * 1.3); mapHalf = span * 0.8; saveView(); draw(); },
    centreOn: (x, z) => { centre.set(x, world.terrainH(x, z), z); saveView(); draw(); },
  };
  // the camera placed for a view of the given rect (the page reads the rect; the game's is the window)
  function place(r) {
    const cam = camera();
    cam.userData.viewH = r.height;
    if (camMode === 'fly' && flyOk()) {
      persp.aspect = r.width / Math.max(1, r.height); persp.updateProjectionMatrix();
      o.fly.update();   // (the DEVCAM's own step: its keys, its speed, the camera placed and turned)
      return;
    }
    if (camMode === 'map') {
      if (mapKind === 'ortho') {
        const asp = r.width / Math.max(1, r.height);
        ortho.left = -mapHalf * asp; ortho.right = mapHalf * asp; ortho.top = mapHalf; ortho.bottom = -mapHalf;
        ortho.position.set(centre.x, centre.y + size * 2, centre.z);
        ortho.lookAt(centre.x, centre.y, centre.z);
        ortho.updateProjectionMatrix();
      } else {
        // a plumb view from the height that shows mapHalf at this fov; north up (the camera's up is -z)
        const h = mapHalf / Math.tan(persp.fov * Math.PI / 360);
        persp.aspect = r.width / Math.max(1, r.height);
        persp.up.set(0, 0, -1);
        persp.position.set(centre.x, centre.y + h, centre.z);
        persp.lookAt(centre.x, centre.y, centre.z);
        persp.updateProjectionMatrix();
      }
    } else {
      const R0 = size * 0.55 / ZOOM;
      persp.aspect = r.width / Math.max(1, r.height);
      persp.up.set(0, 1, 0);
      persp.position.set(centre.x + R0 * Math.sin(yaw) * Math.cos(pitch), centre.y + R0 * Math.sin(pitch), centre.z + R0 * Math.cos(yaw) * Math.cos(pitch));
      persp.lookAt(centre);
      persp.updateProjectionMatrix();
    }
  }
  // the ray from a client point, and the analytic march against the composed ground
  const ndc = new THREE.Vector2(), rc = new THREE.Raycaster();
  function ray(cx, cy) {
    const r = cv.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    rc.setFromCamera(ndc, camera());
    return rc.ray;
  }
  function ground(cx, cy) {
    const R = o.R(); if (!R) return null;
    const ry = ray(cx, cy), org = ry.origin, d = ry.direction;
    const bounds = world.bounds || { x0: -1e9, z0: -1e9, x1: 1e9, z1: 1e9 };
    if (org.y - R.heightAt(org.x, org.z) < 0) return null;
    // the march ends once the ray has been INSIDE the bounds and leaves them (a camera orbiting from
    // outside the bench's window must still pick the ground inside it - the page's own version broke
    // on the second step out and a low orbit click past the bounds answered nothing)
    let wasIn = false;
    const maxT = size * 6, step = 2;
    for (let t = step; t < maxT; t += step) {
      const x = org.x + d.x * t, y = org.y + d.y * t, z = org.z + d.z * t;
      const out = x < bounds.x0 - 50 || x > bounds.x1 + 50 || z < bounds.z0 - 50 || z > bounds.z1 + 50;
      if (out) { if (wasIn) break; continue; }
      wasIn = true;
      if (y - R.heightAt(x, z) < 0) {
        let a = t - step, b = t;
        for (let i = 0; i < 12; i++) { const m = (a + b) / 2; const my = org.y + d.y * m; if (my - R.heightAt(org.x + d.x * m, org.z + d.z * m) < 0) b = m; else a = m; }
        const m = (a + b) / 2;
        return [org.x + d.x * m, org.y + d.y * m, org.z + d.z * m];
      }
    }
    return null;
  }
  // the mouse on the view: right-drag turns, middle-drag pans, wheel zooms; the editor reads the left button
  const onDown = e => {
    if (e.button === 2 && camMode === 'fly') { drag = [e.clientX, e.clientY, 0, 0, true]; e.preventDefault(); return; }
    if (e.button === 2) { drag = [e.clientX, e.clientY, yaw, pitch]; e.preventDefault(); }
    if (e.button === 1) { panD = [e.clientX, e.clientY, centre.clone()]; e.preventDefault(); }
  };
  const onUp = () => { if (drag || panD) saveView(); drag = null; panD = null; };
  const onMove = e => {
    if (panD) {
      const r = cv.getBoundingClientRect(), cam = camera();
      const wpp = camMode === 'map' ? (2 * mapHalf) / Math.max(1, r.height) : 2 * (size * 0.55 / ZOOM) * Math.tan(persp.fov * Math.PI / 360) / Math.max(1, r.height);
      const e0 = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), e1 = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
      const c = panD[2].clone().addScaledVector(e0, -(e.clientX - panD[0]) * wpp).addScaledVector(e1, (e.clientY - panD[1]) * wpp);
      centre.set(c.x, camMode === 'map' ? centre.y : c.y, c.z);
      draw(); return;
    }
    if (drag && drag[4] && camMode === 'fly' && flyOk()) {   // the fly camera looks (the DEVCAM's gimbal rate)
      o.fly.yaw += (e.clientX - drag[0]) * 0.0025; o.fly.pitch = Math.max(-1.5, Math.min(1.5, o.fly.pitch - (e.clientY - drag[1]) * 0.0025));
      drag[0] = e.clientX; drag[1] = e.clientY; draw(); return;
    }
    if (!drag || camMode === 'map') return;
    yaw = drag[2] + (e.clientX - drag[0]) * 0.008;
    pitch = Math.max(0.05, Math.min(1.5, drag[3] + (e.clientY - drag[1]) * 0.006));
    draw();
  };
  const onWheel = e => {
    e.preventDefault();
    if (camMode === 'fly' && flyOk()) { o.fly.speed = Math.max(1, Math.min(400, o.fly.speed * Math.pow(1.15, -Math.sign(e.deltaY)))); if (o.onMode) o.onMode(camMode); return; }
    if (camMode === 'map') mapHalf = Math.max(10, Math.min(size * 1.5, mapHalf * (e.deltaY < 0 ? 1 / 1.12 : 1.12)));
    else ZOOM = Math.max(0.2, Math.min(80, ZOOM * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    saveView(); draw();
  };
  const onCtx = e => e.preventDefault();
  let attached = false;
  function attach() { if (attached) return; attached = true; view.addEventListener('mousedown', onDown); view.addEventListener('contextmenu', onCtx); addEventListener('mouseup', onUp); addEventListener('mousemove', onMove); view.addEventListener('wheel', onWheel, { passive: false }); }
  function detach() { if (!attached) return; attached = false; view.removeEventListener('mousedown', onDown); view.removeEventListener('contextmenu', onCtx); removeEventListener('mouseup', onUp); removeEventListener('mousemove', onMove); view.removeEventListener('wheel', onWheel); }
  return { cameras, camera, place, ray, ground, centre, persp, ortho, saveView, attach, detach, rows: PREMISES_HOST.rows(), site: PREMISES_HOST.site() };
};

// the inspector's row builders: the bench's own DOM shapes (.hd / .note / .btn / .r rows), one keeper.
// Every control also wears the flight flyout's class (pill / fsel / fsw / frng, G398): in the game
// flight.css styles them as the flyout's own controls; the bench page styles the same DOM its way.
PREMISES_HOST.rows = function () {
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return {
    section: (p, t) => { const d = document.createElement('div'); d.className = 'hd'; d.textContent = t; d.title = t; p.appendChild(d); return d; },
    note: (p, t, cls) => { const d = document.createElement('div'); d.className = 'note' + (cls ? ' ' + cls : ''); d.textContent = t; p.appendChild(d); return d; },
    button: (p, t, on) => { const b = document.createElement('button'); b.className = 'btn pill'; b.type = 'button'; b.textContent = t; b.onclick = on; p.appendChild(b); return b; },
    // a row of pills: one is on; opts = [[value, label, title?], ...]
    pills: (p, label, opts, get, set) => {
      const d = document.createElement('div'); d.className = 'r';
      d.innerHTML = '<span class="k" title="' + esc(label) + '">' + esc(label) + '</span>';
      const w = document.createElement('span'); w.className = 'pills';
      const paint = () => { const cur = String(get()); for (const b of w.children) b.classList.toggle('on', b.dataset.v === cur); };
      for (const q of opts) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pill'; b.dataset.v = String(q[0]); b.textContent = q[1]; if (q[2]) b.title = q[2]; b.onclick = () => { set(q[0]); paint(); b.blur(); }; w.appendChild(b); }
      paint(); d.appendChild(w); p.appendChild(d); return d;
    },
    // (G3017, the user 12 Oct: 'for rotation and other parameters, I need to be able to manually input a figure') THE TYPED
    // VALUE: the readout IS the field, as the garage's reference panel has it (refplane.js slider) - focus shows the bare
    // number, Enter or leaving commits it ONCE through the slider's own setter (one undo step, its coalescing key), clamped to
    // the slider's range and snapped to its step, in the slider's own units (the rotations are degrees); Escape gives up
    slider: (p, label, lo, hi, st, get, set, fmt) => {
      const d = document.createElement('div'); d.className = 'r';
      d.innerHTML = '<span class="k" title="' + esc(label) + '">' + esc(label) + '</span><input type="range" class="frng" min="' + lo + '" max="' + hi + '" step="' + st + '"><input type="text" class="v" inputmode="decimal" title="type a value - Enter sets it">';
      const inp = d.querySelector('input'), val = d.querySelector('.v');
      const show = v => { val.value = fmt ? fmt(v) : (+v).toFixed(2); };
      const snap = n => { n = Math.max(+lo, Math.min(+hi, n)); if (+st > 0) n = +lo + Math.round((n - +lo) / +st) * +st; return +n.toFixed(6); };
      let v0 = +get(); if (!isFinite(v0)) v0 = lo;
      inp.value = v0; show(v0);
      inp.oninput = () => { set(+inp.value); show(+inp.value); };
      let typing = false;
      val.onfocus = () => { typing = true; const g = +get(); val.value = String(isFinite(g) ? +g.toFixed(4) : ''); if (val.select) val.select(); };
      val.onchange = () => { if (!typing) return; typing = false; const n = parseFloat(String(val.value).replace(',', '.'));
        if (isFinite(n)) { const q = snap(n); inp.value = q; set(q); show(q); } else show(+get()); };
      val.onblur = () => { if (typing) val.onchange(); show(+get()); };
      val.onkeydown = ev => { if (ev.key === 'Enter') { val.onchange(); if (val.blur) val.blur(); } else if (ev.key === 'Escape') { typing = false; show(+get()); if (val.blur) val.blur(); }
        if (ev.stopPropagation) ev.stopPropagation(); };
      p.appendChild(d); return d;
    },
    // (G3018) A TYPED NUMBER with no slider - a position, a value the handles set: the same field as the slider's readout (focus
    // shows the bare number, Enter or leaving commits it once, Escape gives up), unclamped, wider
    number: (p, label, get, set, fmt) => {
      const d = document.createElement('div'); d.className = 'r';
      d.innerHTML = '<span class="k" title="' + esc(label) + '">' + esc(label) + '</span><input type="text" class="v vn" inputmode="decimal" title="type a value - Enter sets it">';
      const val = d.querySelector('.v');
      const show = v => { val.value = !isFinite(+v) ? '' : fmt ? fmt(+v) : (+v).toFixed(2); };
      show(get());
      let typing = false;
      val.onfocus = () => { typing = true; const g = +get(); val.value = String(isFinite(g) ? +g.toFixed(4) : ''); if (val.select) val.select(); };
      val.onchange = () => { if (!typing) return; typing = false; const n = parseFloat(String(val.value).replace(',', '.'));
        if (isFinite(n)) { set(n); show(n); } else show(get()); };
      val.onblur = () => { if (typing) val.onchange(); show(get()); };
      val.onkeydown = ev => { if (ev.key === 'Enter') { val.onchange(); if (val.blur) val.blur(); } else if (ev.key === 'Escape') { typing = false; show(get()); if (val.blur) val.blur(); }
        if (ev.stopPropagation) ev.stopPropagation(); };
      p.appendChild(d); return d;
    },
    select: (p, label, opts, get, set) => {
      const d = document.createElement('div'); d.className = 'r';
      const sel = document.createElement('select'); sel.className = 'fsel';
      if (get() === '') sel.appendChild(new Option('…', ''));
      for (const q of opts) sel.appendChild(new Option(q[1], q[0]));
      sel.value = String(get());
      sel.onchange = () => set(sel.value);
      d.innerHTML = '<span class="k" title="' + esc(label) + '">' + esc(label) + '</span>'; d.appendChild(sel); p.appendChild(d); return d;
    },
    check: (p, label, get, set) => {
      const d = document.createElement('div'); d.className = 'r';
      const c = document.createElement('input'); c.type = 'checkbox'; c.className = 'fsw'; c.checked = !!get();
      const v = document.createElement('span'); v.className = 'v';
      const word = () => { v.textContent = c.checked ? 'on' : 'off'; };
      c.onchange = () => { set(c.checked); word(); };
      word();
      d.innerHTML = '<span class="k" title="' + esc(label) + '">' + esc(label) + '</span>'; d.appendChild(c); d.appendChild(v); p.appendChild(d); return d;
    },
  };
};

// the core's own airfield functions, when this page has them: the strip's paint, the derived runway,
// the pattern and its validator
PREMISES_HOST.site = function () {
  const g = typeof window !== 'undefined' ? window : {};
  const f = n => (typeof g[n] === 'function' ? g[n] : null);
  return { siteRunway: f('siteRunway'), sitePaintStrip: f('sitePaintStrip'), sitePattern: f('sitePattern'), sitePatternIssues: f('sitePatternIssues'), patternPath: f('patternPath') };
};

if (typeof window !== 'undefined') window.PREMISES_HOST = PREMISES_HOST;
if (typeof module !== 'undefined' && module.exports) module.exports = PREMISES_HOST;
})();
