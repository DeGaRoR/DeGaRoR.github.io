"use strict";
/* tools/_load.js — shared project resolver for the test harnesses (PWA split, 2026-07-12).
 * Accepts: the project FOLDER, its index.html, or a legacy single-file HTML build.
 * Returns { kind, root, html, engine, tests, shipping }:
 *   engine   — engine source code (the slice AFTER the header comment that mentions
 *              @ENGINE-START@ and BEFORE the /*@ENGINE-END@ comment — the exact same
 *              slice the legacy single-file harnesses used, so suites run unchanged)
 *   tests    — QC suites source (after @TESTS-START@ header, before the TESTS-END mark)
 *   shipping — everything the browser loads (engine + app, NO tests) for full-app smoke
 *   html     — index.html text (DOM ids for the stubs)
 */
const fs = require("fs"), p = require("path");

function slice(src, startTag, endTag) {
  const s = src.indexOf(startTag);
  if (s < 0) throw new Error("marker not found: " + startTag);
  const cs = src.indexOf("*/", s) + 2;
  const e = src.indexOf(endTag);
  if (e < 0) throw new Error("marker not found: " + endTag);
  return src.slice(cs, e);
}

function load(arg) {
  let root = arg || ".";
  if (fs.existsSync(root) && fs.statSync(root).isFile()) {
    const txt = fs.readFileSync(root, "utf8");
    if (/\/\*@ASSETS-START@\*\//.test(txt) && /<script[^>]*>/.test(txt) && txt.indexOf("@ENGINE-START@") >= 0) {
      // legacy single-file build: everything lives in one <script>
      const scripts = [...txt.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
      return { kind: "single", root: p.dirname(root), html: txt,
        engine: slice(scripts, "@ENGINE-START@", "/*@ENGINE-END@"),
        tests: slice(scripts, "@TESTS-START@", "/*@TESTS-END@"),
        shipping: scripts.replace(/\/\*@TESTS-START@[\s\S]*?@TESTS-END@\*\//g, "") };
    }
    root = p.dirname(root); // an index.html inside a PWA folder
  }
  const eng = fs.readFileSync(p.join(root, "js/engine.js"), "utf8");
  const tst = fs.readFileSync(p.join(root, "js/tests.js"), "utf8");
  const app = fs.readFileSync(p.join(root, "js/app.js"), "utf8");
  const html = fs.readFileSync(p.join(root, "index.html"), "utf8");
  return { kind: "pwa", root, html,
    engine: slice(eng, "@ENGINE-START@", "/*@ENGINE-END@"),
    tests: slice(tst, "@TESTS-START@", "/*@TESTS-END@"),
    shipping: eng + "\n;\n" + app };
}

module.exports = { load };
