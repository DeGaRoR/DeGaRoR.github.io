// ui/atlas/lineage.js — who came from whom.
//
// ── IT IS A DAG, NOT A TREE, AND THAT IS NOT PEDANTRY ────────────────────────
//
// Three things make the obvious recursive walk wrong here:
//
//   TWO PARENTS. Crossover gives a child two, so paths reconverge — walk the
//   ancestors of a creature bred from cousins and you meet the same forebear
//   down both branches.
//
//   THE KEY IS THE GENOME, NOT THE INDIVIDUAL. `specimen:<genomeHash>` means two
//   creatures with identical genomes ARE one record. Breed your way back to a
//   genome you already have and the edge points at a node that already exists,
//   somewhere else in the graph.
//
//   SO A CYCLE IS REACHABLE. Not common, but a `null` genome hash resolving
//   oddly or a re-bred identical body is enough, and an unguarded walk would
//   hang the page rather than draw a wrong picture. Every traversal below
//   carries a `seen` set and a depth bound.
//
// ── TWO TIERS OF TRUTH, AND CALLERS MUST NOT CONFLATE THEM ───────────────────
//
// `row.parents` is `null` for every creature saved before edges were recorded,
// `[]` for one genuinely without parents (a founding draw, a stranger), and a
// list otherwise. A UI that renders `null` and `[]` the same way tells the
// player that most of their Atlas sprang from nothing, which is false — it is
// simply not written down. `genome.origin.founder` still attributes those.

/**
 * Index the corpus for lookup in both directions.
 *
 * Descendants are derived rather than stored: an edge is written once, on the
 * child, and inverting it here costs one pass and cannot fall out of sync with
 * the forward direction the way a second stored list would.
 *
 * @param {Array} rows  from ui/atlas/index.js
 * @returns {{byHash: Map<string, object>, children: Map<string, string[]>}}
 */
export function buildForest(rows) {
  const byHash = new Map();
  const children = new Map();
  for (const r of rows) byHash.set(r.hash, r);
  for (const r of rows) {
    for (const p of r.parents ?? []) {
      if (p === r.hash) continue;             // a self-edge is not a relationship
      if (!children.has(p)) children.set(p, []);
      children.get(p).push(r.hash);
    }
  }
  return { byHash, children };
}

/** Rows this creature descends from, nearest first. */
export function ancestorsOf(forest, hash, depth = 4) {
  const seen = new Set([hash]);
  const out = [];
  let front = [hash];
  for (let d = 0; d < depth && front.length; d++) {
    const next = [];
    for (const h of front) {
      for (const p of forest.byHash.get(h)?.parents ?? []) {
        if (seen.has(p)) continue;            // reconverged, or a cycle
        seen.add(p);
        next.push(p);
        out.push({ hash: p, row: forest.byHash.get(p) ?? null, depth: d + 1 });
      }
    }
    front = next;
  }
  return out;
}

/** Rows bred from this one, nearest first. */
export function descendantsOf(forest, hash, depth = 4) {
  const seen = new Set([hash]);
  const out = [];
  let front = [hash];
  for (let d = 0; d < depth && front.length; d++) {
    const next = [];
    for (const h of front) {
      for (const c of forest.children.get(h) ?? []) {
        if (seen.has(c)) continue;
        seen.add(c);
        next.push(c);
        out.push({ hash: c, row: forest.byHash.get(c) ?? null, depth: d + 1 });
      }
    }
    front = next;
  }
  return out;
}

/**
 * How much of the corpus has edges at all.
 *
 * Exported because the honest thing for the UI to say about a sparse graph is
 * how sparse it is. "3 of 41 have recorded parents" explains an empty ancestry
 * block; silence makes it look broken.
 */
export function coverage(rows) {
  let recorded = 0;
  for (const r of rows) if (r.parents != null) recorded++;
  return { recorded, total: rows.length };
}
