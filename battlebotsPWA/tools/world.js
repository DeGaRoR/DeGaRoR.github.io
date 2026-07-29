// tools/world.js — boot the real HTML in jsdom with a recording 2D context.
//
// Design notes:
//  * No native `canvas` package. getContext returns a *recorder*: every call is
//    logged as a compact op string. That gives us both "the code runs" and a
//    render signature we can diff, with zero native deps.
//  * Image never loads (no data: decoding in jsdom), so naturalWidth stays 0 and
//    chassisSpriteReady() is false → the vector fallback path is exercised.
//    That is deterministic and is what we want to regression-test here.
//  * requestAnimationFrame is queued, never auto-looping. Tests drive frames
//    explicitly with w.step(n) so nothing runs away.
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const PWA_DIR = path.join(ROOT, "pwa");
const HTML_PATH = path.join(PWA_DIR, "index.html");
// jsdom (url https://localhost/) ne résout pas les <script src> locaux :
// on inline chaque fichier référencé avant de nourrir le DOM.
function inlineScripts(html) {
  return html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) =>
    "<script>\n" + fs.readFileSync(path.join(PWA_DIR, f), "utf8") + "\n</script>");
}
const SKEY = "roboclash_s4";

// ---- recording 2D context -------------------------------------------------
const NUM = v => (typeof v === "number" ? Math.round(v * 100) / 100 : v);

function makeRecorder(canvas) {
  const ops = [];
  const rec = (name, args) => { ops.push(name + "(" + args.map(NUM).join(",") + ")"); };

  const ctx = {
    canvas, _ops: ops,
    // state
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
    globalAlpha: 1, globalCompositeOperation: "source-over", font: "10px sans-serif",
    textAlign: "start", textBaseline: "alphabetic", filter: "none",
    shadowBlur: 0, shadowColor: "transparent", shadowOffsetX: 0, shadowOffsetY: 0,
    lineDashOffset: 0, imageSmoothingEnabled: true,
  };

  const voidMethods = [
    "save","restore","beginPath","closePath","moveTo","lineTo","bezierCurveTo","quadraticCurveTo",
    "arc","arcTo","ellipse","rect","roundRect","fill","stroke","clip","clearRect","fillRect",
    "strokeRect","fillText","strokeText","translate","rotate","scale","transform","setTransform",
    "resetTransform","drawImage","putImageData","setLineDash","drawFocusIfNeeded",
  ];
  for (const m of voidMethods) ctx[m] = (...a) => rec(m, a);

  ctx.getLineDash = () => [];
  ctx.measureText = txt => ({ width: String(txt).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
  ctx.createImageData = (w, h) => ({ width: w | 0, height: h | 0, data: new Uint8ClampedArray((w | 0) * (h | 0) * 4) });
  ctx.getImageData = (x, y, w, h) => ({ width: w | 0, height: h | 0, data: new Uint8ClampedArray((w | 0) * (h | 0) * 4) });
  const grad = () => ({ addColorStop() {} });
  ctx.createLinearGradient = (...a) => (rec("createLinearGradient", a), grad());
  ctx.createRadialGradient = (...a) => (rec("createRadialGradient", a), grad());
  ctx.createPattern = () => null;
  ctx.isPointInPath = () => false;
  return ctx;
}

// ---- world ----------------------------------------------------------------
/**
 * openWorld({ save, lang, width, height })
 *   save  : object written to localStorage before boot (a savegame), or null
 * returns { win, dom, eval, S, errors, ops, opsOf, step, close }
 */
function openWorld(opts = {}) {
  const html = inlineScripts(fs.readFileSync(HTML_PATH, "utf8"));
  const errors = [];
  const rafQueue = [];

  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push("jsdomError: " + (e && e.message)));
  vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: false,
    virtualConsole: vc,
    url: "https://localhost/",
    beforeParse(window) {
      // save seeding, before any script runs
      try {
        if (opts.save) window.localStorage.setItem(SKEY, JSON.stringify(opts.save));
        else window.localStorage.removeItem(SKEY);
      } catch (e) { errors.push("seed: " + e.message); }

      // canvas recorder
      window.HTMLCanvasElement.prototype.getContext = function (kind) {
        if (kind !== "2d") return null;
        if (!this.__ctx) this.__ctx = makeRecorder(this);
        return this.__ctx;
      };
      window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
      window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
        return { x: 0, y: 0, left: 0, top: 0, right: this.width || 300, bottom: this.height || 150,
                 width: this.width || 300, height: this.height || 150 };
      };

      // deterministic viewport
      Object.defineProperty(window, "innerWidth", { value: opts.width || 900, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: opts.height || 700, configurable: true });
      Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });

      // controlled animation clock
      window.requestAnimationFrame = cb => rafQueue.push(cb);
      window.cancelAnimationFrame = () => {};

      window.addEventListener("error", e => errors.push("uncaught: " + (e.error ? e.error.message : e.message)));
      window.addEventListener("unhandledrejection", e => errors.push("rejection: " + e.reason));
    },
  });

  const win = dom.window;

  const W = {
    win, dom, errors,
    /** evaluate an expression in the page's global scope (sees const/let globals) */
    eval(expr) { return win.eval(expr); },
    /** the live game state object */
    get S() { return win.eval("S"); },
    /** advance N animation frames, ts in ms */
    step(n = 1, dt = 16) {
      let t = W._t || 0;
      for (let i = 0; i < n; i++) {
        const batch = rafQueue.splice(0, rafQueue.length);
        t += dt;
        for (const cb of batch) { try { cb(t); } catch (e) { errors.push("raf: " + e.message); } }
      }
      W._t = t;
    },
    pendingFrames() { return rafQueue.length; },
    /** click an element by id */
    click(id) {
      const el = win.document.getElementById(id);
      if (!el) { errors.push("click: no #" + id); return false; }
      el.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      return true;
    },
    $(id) { return win.document.getElementById(id); },
    /** recorded draw ops for a canvas id */
    opsOf(id) {
      const cv = win.document.getElementById(id);
      return cv && cv.__ctx ? cv.__ctx._ops : null;
    },
    clearOps(id) { const o = W.opsOf(id); if (o) o.length = 0; },
    close() { try { win.close(); } catch (e) {} },
  };
  return W;
}

module.exports = { openWorld, SKEY, HTML_PATH };
