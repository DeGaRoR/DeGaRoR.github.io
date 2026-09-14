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
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.world === world.id) { yaw = v.yaw; pitch = v.pitch; ZOOM = v.zoom; camMode = v.mode || 'orbit'; mapHalf = v.mapHalf || mapHalf; if (v.c) centre.set(v.c[0], v.c[1], v.c[2]); } } catch (e) {}
  const saveView = () => { try { localStorage.setItem(KEY, JSON.stringify({ world: world.id, yaw, pitch, zoom: ZOOM, mode: camMode, mapHalf, c: [centre.x, centre.y, centre.z] })); } catch (e) {} };
  const camera = () => (camMode === 'map' && mapKind === 'ortho' ? ortho : persp);
  const cameras = {
    mode: () => camMode,
    set: m => { camMode = m === 'map' ? 'map' : 'orbit'; if (o.onMode) o.onMode(camMode); saveView(); draw(); },
    toggle: () => cameras.set(camMode === 'map' ? 'orbit' : 'map'),
    // a scripted aim: the orbit's yaw and pitch (radians), for the captures a script takes
    look: (y, p) => { if (isFinite(y)) yaw = y; if (isFinite(p)) pitch = p; saveView(); draw(); },
    view: () => ({ yaw, pitch, zoom: ZOOM, mode: camMode, centre: [centre.x, centre.y, centre.z], mapHalf }),
    frame: bb => { const R = o.R(); if (!bb || !R) return; const F = R.overlay.frame; const a = F.toWorld((bb.x0 + bb.x1) / 2, (bb.z0 + bb.z1) / 2); centre.set(a[0], world.terrainH(a[0], a[1]), a[1]); const span = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0, 20); ZOOM = size * 0.55 / (span * 1.3); mapHalf = span * 0.8; saveView(); draw(); },
    centreOn: (x, z) => { centre.set(x, world.terrainH(x, z), z); saveView(); draw(); },
  };
  // the camera placed for a view of the given rect (the page reads the rect; the game's is the window)
  function place(r) {
    const cam = camera();
    cam.userData.viewH = r.height;
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
    if (!drag || camMode === 'map') return;
    yaw = drag[2] + (e.clientX - drag[0]) * 0.008;
    pitch = Math.max(0.05, Math.min(1.5, drag[3] + (e.clientY - drag[1]) * 0.006));
    draw();
  };
  const onWheel = e => {
    e.preventDefault();
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

// the inspector's row builders: the bench's own DOM shapes (.hd / .note / .btn / .r rows), one keeper
PREMISES_HOST.rows = function () {
  return {
    section: (p, t) => { const d = document.createElement('div'); d.className = 'hd'; d.textContent = t; p.appendChild(d); return d; },
    note: (p, t) => { const d = document.createElement('div'); d.className = 'note'; d.textContent = t; p.appendChild(d); return d; },
    button: (p, t, on) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = t; b.onclick = on; p.appendChild(b); return b; },
    slider: (p, label, lo, hi, st, get, set, fmt) => {
      const d = document.createElement('div'); d.className = 'r';
      d.innerHTML = '<span class="k" title="' + label + '">' + label + '</span><input type="range" min="' + lo + '" max="' + hi + '" step="' + st + '"><span class="v"></span>';
      const inp = d.querySelector('input'), val = d.querySelector('.v');
      const show = v => { val.textContent = fmt ? fmt(v) : (+v).toFixed(2); };
      let v0 = +get(); if (!isFinite(v0)) v0 = lo;
      inp.value = v0; show(v0);
      inp.oninput = () => { set(+inp.value); show(+inp.value); };
      p.appendChild(d); return d;
    },
    select: (p, label, opts, get, set) => {
      const d = document.createElement('div'); d.className = 'r';
      const sel = document.createElement('select');
      if (get() === '') sel.appendChild(new Option('…', ''));
      for (const q of opts) sel.appendChild(new Option(q[1], q[0]));
      sel.value = String(get());
      sel.onchange = () => set(sel.value);
      d.innerHTML = '<span class="k">' + label + '</span>'; d.appendChild(sel); p.appendChild(d); return d;
    },
    check: (p, label, get, set) => {
      const d = document.createElement('div'); d.className = 'r';
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!get();
      c.onchange = () => set(c.checked);
      d.innerHTML = '<span class="k">' + label + '</span>'; d.appendChild(c); p.appendChild(d); return d;
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
