// _light_probe.js — THE LIGHTING INSTRUMENT, in the page.
//
// WHY IT IS A FILE. Every lighting verdict this project has ever reached was
// measured by hand in a live page and written into HANDOVER: G62.5's
// six-sources-versus-three, G62.7's scene traverse, G65's all-on/all-off
// emitter count. Not one of them could be re-run, so the same bug came back
// three times. This is the measurement, kept.
//
// Load it into any built page (dev.html, tools/_probe.html):
//   fetch('/flyDiy/tools/_light_probe.js').then(r => r.text()).then(eval)
// then use window.__lit. tools/_light_check.js drives the same file headless.
//
// THE TWO THINGS THAT MAKE IT WORK, both paid for:
//  - The Browser pane does not composite, so screenshots time out and rAF
//    fires once. Everything here renders into a WebGLRenderTarget and reads
//    it back with readRenderTargetPixels — the GATE FIT method — so it needs
//    no compositor at all.
//  - A silhouette cannot be had by clearing to a key colour, because the
//    room's own shadows and fog land on the same pixels. THE MASK IS THE
//    DIFFERENCE: shoot with the subject visible, shoot again with it hidden,
//    and the pixels that changed ARE the subject.
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.THREE) return;
  var T = window.THREE;

  function handles() {
    var GE = window.GARAGE_ENV;
    if (GE && GE._debug) return GE._debug();
    return { renderer: window.__renderer, scene: window.__scene, world: window.__scene };
  }

  var SZ = 320;
  var RT = null, buf = null;
  function target(R) {
    if (RT) return RT;
    RT = new T.WebGLRenderTarget(SZ, SZ, { format: T.RGBAFormat });
    // the readback has to be in the same space the screen shows, or every
    // number here is linear and every judgement about it is wrong
    RT.texture.encoding = T.sRGBEncoding;
    buf = new Uint8Array(SZ * SZ * 4);
    return RT;
  }

  // THE VIEWPORT HAS TO BE SET BY HAND, and this is the single most dangerous
  // line in the file. When the Browser pane is hidden the canvas measures
  // 0x0, the game's own resize handler calls setSize(0, 0), and the renderer's
  // viewport becomes [0, 0, 0, 0]. Every render after that — to the screen OR
  // to a render target — draws nothing, silently, with no error and no warning.
  //
  // It is worse than "no picture": a measurement taken through it comes back
  // as a clean, plausible ZERO. It read "the shop lamps put no light on the
  // wing" for several rounds, which is a sentence a person can believe.
  // Anything measuring a hidden pane must assert its own viewport.
  function shoot(scene, cam) {
    var D = handles(), R = D.renderer;
    target(R);
    var pr = R.getRenderTarget();
    R.setRenderTarget(RT);
    R.setViewport(0, 0, SZ, SZ);
    R.clear(true, true, true);
    R.render(scene, cam);
    R.readRenderTargetPixels(RT, 0, 0, SZ, SZ, buf);
    R.setRenderTarget(pr);
    return Uint8Array.from(buf);
  }

  var shown = function (o) { var p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };

  // THE MASK MUST BE A SILHOUETTE, NOT A DIFFERENCE. The obvious trick — shoot
  // with the subject visible, shoot again with it hidden, keep the pixels that
  // changed — is wrong in exactly the case that matters here: with the shop
  // lamps on, the lit wing and the lit floor behind it are the SAME
  // brightness, the difference is under the threshold, and the wing measures
  // as though it were not lit at all. It reported the lamps contributing
  // nothing to the wing while a close view of that same surface read a mean of
  // 93.6. A test whose failure looks like its pass is not a test.
  //
  // So the subject is put alone on a spare layer and drawn flat white against
  // black. That is a geometric fact about where the subject is on the screen,
  // and it cannot be confused by what colour anything is.
  // IT IS A PROXY IN AN EMPTY SCENE, and the two cleverer ways both failed:
  //  - `layers` — THREE.Layers.set(31) is `1 << 31`, which in JS is NEGATIVE.
  //    Layer 31 is the one channel of the thirty-two that cannot be used, and
  //    the symptom is a camera that renders nothing at all.
  //  - `scene.overrideMaterial` — has to be undone around the room's own
  //    background, fog and clear colour, and r128's getClearColor/setClearColor
  //    round-trip is easy to get wrong in a way that silently white-clears
  //    every LATER render rather than this one.
  // Drawing the geometry once, alone, with its own world matrix, has no state
  // to restore and nothing to get wrong.
  var whiteMat = null, maskScene = null, maskProxy = null;
  function silhouette(scene, cam, tgt) {
    if (!whiteMat) {
      whiteMat = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
      maskScene = new T.Scene();
      maskProxy = new T.Mesh(new T.BufferGeometry(), whiteMat);
      maskProxy.matrixAutoUpdate = false;
      maskScene.add(maskProxy);
    }
    tgt.updateWorldMatrix(true, false);
    maskProxy.geometry = tgt.geometry;
    maskProxy.matrix.copy(tgt.matrixWorld);
    maskProxy.matrixWorldNeedsUpdate = true;
    return shoot(maskScene, cam);
  }

  // THE WING IS FOUND BY ANATOMY, not by name: the generated meshes are
  // anonymous and carry no userData. It is the visible piece of aeroplane skin
  // that is thin relative to its span and PRESENTS THE MOST AREA TO THE SKY.
  //
  // That last clause is not tidiness. Picking by bounding box alone chose a
  // 0.19 m spar tape running the full span — same box as the wing, 1/8 the
  // surface — and every reading taken through it was of a strip of tape. The
  // box of a wing and the box of a batten across a wing are identical; only
  // the projected area tells them apart, and the silhouette pass already
  // computes exactly that.
  var wingCache = null;
  function wing(scene, refresh) {
    scene = scene || handles().scene;
    if (wingCache && !refresh && shown(wingCache) && wingCache.parent) return wingCache;
    var cands = [];
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !shown(o)) return;
      var m = [].concat(o.material)[0];
      if (!(m && m.userData && m.userData.aeroskin)) return;
      var bb = new T.Box3().setFromObject(o);
      if (!isFinite(bb.min.x)) return;
      var s = bb.getSize(new T.Vector3());
      // NO THINNESS TEST. "Thin for its span" is an attitude-dependent
      // property of the BOUNDING BOX, not of the wing: parked and level the
      // wing's box is 0.65 m deep, but banked in the world the same wing
      // measures 1.6 m and the filter threw it away — leaving the spar tape
      // again, and a belly reading taken off a batten. Projected area is the
      // only property here that does not move when the aeroplane does.
      if (Math.max(s.x, s.z) < 3) return;
      cands.push({ o: o, foot: s.x * s.z });
    });
    cands.sort(function (a, b) { return b.foot - a.foot; });
    var best = null, ba = 0;
    cands.slice(0, 8).forEach(function (c) {
      var bb = new T.Box3().setFromObject(c.o);
      var ctr = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3());
      var half = Math.max(sz.x, sz.z) * 0.52;
      var cam = new T.OrthographicCamera(-half, half, half, -half, 0.05, 40);
      cam.position.set(ctr.x, ctr.y + 2.4, ctr.z); cam.up.set(1, 0, 0);
      cam.lookAt(ctr); cam.updateMatrixWorld(true);
      var M = silhouette(scene, cam, c.o), n = 0;
      for (var i = 0; i < SZ * SZ; i++) if (M[i * 4] >= 128) n++;
      if (n > ba) { ba = n; best = c.o; }
    });
    wingCache = best;
    return best;
  }

  // sign +1 = look down on the upper surface, -1 = look up at the underside
  //
  // STAND OFF 2.4 m, NOT 6. The shop lamps hang at 5.31 m and the aeroplane's
  // wing is at 2.14, so a camera six metres over the wing is ABOVE the
  // fittings and shoots the subject through them. It reported the lamps as
  // contributing nothing to the wing's upper surface — while a close view of
  // the same surface under the same lamps read a mean of 93.6. The distance
  // has to clear the subject and stay UNDER the room's own fittings.
  function faceOf(sign, tgt, scene, standOff) {
    scene = scene || handles().scene;
    if (!tgt) return { px: 0, lum: 0 };
    var bb = new T.Box3().setFromObject(tgt);
    var c = bb.getCenter(new T.Vector3()), s = bb.getSize(new T.Vector3());
    var half = Math.max(s.x, s.z) * 0.52;
    var d = standOff || 2.4;
    var cam = new T.OrthographicCamera(-half, half, half, -half, 0.05, 40);
    cam.position.set(c.x, c.y + sign * d, c.z);
    cam.up.set(1, 0, 0);              // chordwise: straight down with up=+Y is degenerate
    cam.lookAt(c);
    cam.updateMatrixWorld(true);
    var A = shoot(scene, cam);
    var M = silhouette(scene, cam, tgt);
    var n = 0, lum = 0, r = 0, g = 0, b = 0;
    for (var i = 0; i < SZ * SZ; i++) {
      var o = i * 4;
      if (M[o] < 128) continue;
      n++; r += A[o]; g += A[o + 1]; b += A[o + 2];
      lum += 0.2126 * A[o] + 0.7152 * A[o + 1] + 0.0722 * A[o + 2];
    }
    if (!n) return { px: 0, lum: 0, rgb: [0, 0, 0] };
    return { px: n, lum: +(lum / n).toFixed(2),
             rgb: [Math.round(r / n), Math.round(g / n), Math.round(b / n)] };
  }

  // THE NUMBER THIS WHOLE CHANTIER IS ABOUT: how bright the underside of the
  // wing is as a percentage of its top. Above 100 the aeroplane is lit from
  // below. A shaded underside in a real room sits well under half.
  function ratio(tgt, scene) {
    tgt = tgt || wing(scene);
    var a = faceOf(+1, tgt, scene), b = faceOf(-1, tgt, scene);
    return { top: a.lum, belly: b.lum, pct: +(100 * b.lum / (a.lum || 1)).toFixed(1),
             topPx: a.px, bellyPx: b.px, topRGB: a.rgb, bellyRGB: b.rgb };
  }

  // ---- the picture ---------------------------------------------------------
  var SW = 900, SH = 560, RT2 = null, px2 = null, cv = null, ctx = null;
  function V(p) {
    if (!p) return new T.Vector3();
    if (p.isVector3) return p;
    if (p.length !== undefined) return new T.Vector3(p[0], p[1], p[2]);
    return new T.Vector3(p.x, p.y, p.z);
  }
  function shot(name, camPos, lookAt, fov, scene) {
    var D = handles(), R = D.renderer;
    scene = scene || D.scene;
    if (!RT2) {
      RT2 = new T.WebGLRenderTarget(SW, SH, { format: T.RGBAFormat });
      RT2.texture.encoding = T.sRGBEncoding;
      px2 = new Uint8Array(SW * SH * 4);
      cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
      ctx = cv.getContext('2d');
    }
    var c = lookAt ? V(lookAt) : new T.Box3().setFromObject(wing(scene)).getCenter(new T.Vector3());
    var cam = new T.PerspectiveCamera(fov || 40, SW / SH, 0.1, 400);
    cam.position.copy(V(camPos));
    // Object3D.lookAt treats its argument as a POINT only when it is a real
    // Vector3; hand it a plain {x,y,z} and it calls set(obj, undefined,
    // undefined), the quaternion goes NaN and the camera renders pure
    // background. That failure looks exactly like "the room is dark at night",
    // and it cost an hour before the guard below existed.
    cam.lookAt(c); cam.updateMatrixWorld(true);
    if (!isFinite(cam.matrixWorld.elements[12])) throw new Error('_light_probe: NaN camera');
    var pr = R.getRenderTarget();
    R.setRenderTarget(RT2);
    R.setViewport(0, 0, SW, SH);        // see shoot(): a hidden pane zeroes it
    R.clear(true, true, true);
    R.render(scene, cam);
    R.readRenderTargetPixels(RT2, 0, 0, SW, SH, px2);
    R.setRenderTarget(pr);
    var mn = 255, mx = 0, sum = 0;
    var img = ctx.createImageData(SW, SH);
    for (var y = 0; y < SH; y++) for (var x = 0; x < SW; x++) {
      var so = ((SH - 1 - y) * SW + x) * 4, d2 = (y * SW + x) * 4;   // GL is bottom-up
      img.data[d2] = px2[so]; img.data[d2 + 1] = px2[so + 1];
      img.data[d2 + 2] = px2[so + 2]; img.data[d2 + 3] = 255;
      var v = px2[so + 1]; if (v < mn) mn = v; if (v > mx) mx = v; sum += v;
    }
    ctx.putImageData(img, 0, 0);
    var stat = { min: mn, max: mx, mean: +(sum / (SW * SH)).toFixed(1) };
    if (mx - mn < 2) throw new Error('_light_probe: uniform frame — the camera sees nothing');
    var sink = window.__lit.sink;
    if (!sink) return Promise.resolve(stat);
    return fetch(sink + '/' + name, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.92) })
      .then(function () { return stat; });
  }

  // wait for anything that runs on wall-clock rather than on pumped frames —
  // PMREM bakes and texture decode both do
  function settle(ms, frames) {
    if (window.__pump) window.__pump(frames || 2);
    return new Promise(function (r) { setTimeout(r, ms === undefined ? 400 : ms); })
      .then(function () { if (window.__pump) window.__pump(frames || 2); });
  }

  window.__lit = {
    sink: 'http://localhost:8199',
    handles: handles, shown: shown, shoot: shoot,
    wing: wing, faceOf: faceOf, ratio: ratio, shot: shot, settle: settle,
    top: function (t, s) { return faceOf(+1, t || wing(s), s); },
    belly: function (t, s) { return faceOf(-1, t || wing(s), s); },
    census: function (scene, claimed) {
      return window.LIGHT_RIG ? window.LIGHT_RIG.census(scene || handles().scene, claimed) : null;
    },
    // every mood, one row each — the table this chantier is judged on
    sweep: function () {
      var GE = window.GARAGE_ENV, out = [], i = 0;
      var step = function () {
        if (i >= GE.moods().length) { GE.setMood(0); return out; }
        GE.setMood(i);
        return settle(420).then(function () {
          var r = ratio();
          out.push({ mood: GE.moods()[i], top: r.top, belly: r.belly, pct: r.pct });
          i++; return step();
        });
      };
      return Promise.resolve().then(step);
    },
    // from black, one source at a time — the user's own prescription
    ablate: function (moodI) {
      var GE = window.GARAGE_ENV, keys = GE.lights().map(function (l) { return l.key; });
      var out = [];
      var rec = function (label) {
        if (window.__pump) window.__pump(1);
        var r = ratio();
        out.push({ on: label, top: r.top, belly: r.belly, pct: r.pct, px: r.bellyPx });
      };
      GE.setMood(moodI === undefined ? 4 : moodI);
      return settle(450).then(function () {
        keys.forEach(function (k) { GE.setLight(k, true); }); rec('ALL');
        keys.forEach(function (k) { GE.setLight(k, false); }); rec('NONE');
        keys.forEach(function (k) {
          keys.forEach(function (x) { GE.setLight(x, x === k); }); rec(k);
        });
        keys.forEach(function (k) { GE.setLight(k, true); });
        return out;
      });
    }
  };
  return 'ok';
})();
