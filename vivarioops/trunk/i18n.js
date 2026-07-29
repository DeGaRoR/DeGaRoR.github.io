// trunk/i18n.js — Tier S stub.
//
// 20 §2: "The t() call is still used from the first string written; only the
// dictionaries and the language switch are deferred." So this is a passthrough
// with the final signature. Wrapping strings now costs nothing; retrofitting t()
// across every file at step E costs an hour and misses some.
// Tier 1 replaces the body with a dictionary lookup. No call site changes.

let dict = null;   // Tier 1: { key: string }
export function setDictionary(d) { dict = d; }

/**
 * @param {string} key   in the slice this IS the English string
 * @param {object} [vars] {name} interpolation
 */
export function t(key, vars) {
  let s = (dict && dict[key]) || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
