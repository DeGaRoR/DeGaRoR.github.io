// tools/check.js — one reporter, used by every suite, so the gate can parse them all.
let fails = 0, total = 0;
const failed = [];

function check(name, cond, detail) {
  total++;
  const ok = !!cond;
  if (!ok) { fails++; failed.push(name); }
  console.log((ok ? "OK   " : "ÉCHEC") + " " + name + (detail != null ? "   [" + detail + "]" : ""));
  return ok;
}

/** run fn, turning a throw into a failed check instead of killing the suite */
function safe(name, fn) {
  try { return fn(); }
  catch (e) { check(name, false, e.message); return undefined; }
}

function report(suite) {
  console.log(`--- ${suite}: ${total - fails}/${total} — ÉCHECS (${fails})`);
  if (failed.length) console.log("    " + failed.join(" | "));
  process.exitCode = fails ? 1 : 0;
  return fails;
}

module.exports = { check, safe, report, counts: () => ({ fails, total }) };
