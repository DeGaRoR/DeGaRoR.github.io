// contracts/hash.js — pure hashing and seed derivation.
//
// PURITY: no Date, no Math.random, no DOM, no imports. Safe for /engine/.
//
// WHY THIS LIVES IN /contracts/ AND NOT /trunk/rng.js (A0 decision, defect 7):
// worldHash is a contract-level function; /engine/ must be able to compute it;
// N3 forbids /engine/ importing /trunk/. Putting fnv1a in trunk/rng.js would make
// /engine/ -> /contracts/ -> /trunk/ a transitive N3 violation. So the *hash* lives
// here and trunk/rng.js (A1) imports it. trunk/rng.js remains the only place a
// stateful PRNG is CONSTRUCTED, which is what N5 actually guards.

/** FNV-1a, 32-bit. Operates on UTF-16 code units — deterministic for any JS string. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** uint32 -> 8-char lowercase hex. The canonical form for storage keys. */
export function hex8(u32) {
  return (u32 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Canonical stringification of a hash input.
 * Numbers use JS Number->String, which ECMA-262 pins exactly (9.81 -> "9.81").
 * undefined/null throw rather than hashing as "undefined" — a missing field must
 * never silently produce a valid-looking hash.
 */
export function canon(v) {
  if (v === undefined || v === null) {
    throw new Error(`hash input is ${v === null ? 'null' : 'undefined'}`);
  }
  if (typeof v === 'number' && !Number.isFinite(v)) {
    throw new Error(`hash input is non-finite: ${v}`);
  }
  return String(v);
}

/** 01 §5: seed(...parts) = fnv1a(parts.join('|')). The only seed derivation. */
export function seed(...parts) {
  return fnv1a(parts.map(canon).join('|'));
}

/** As seed(), returned as hex. */
export function seedHex(...parts) {
  return hex8(seed(...parts));
}

/**
 * Counter-based uniform draw in [0, 1). STATELESS — this is a hash, not a PRNG,
 * so it constructs no generator and does not violate N5. Used by the gate for
 * calibration checks (K7) before trunk/rng.js exists at A1.
 * Murmur3 finalizer over the mixed seed+counter for avalanche.
 */
export function rand01(seedU32, i) {
  let h = ((seedU32 >>> 0) ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
